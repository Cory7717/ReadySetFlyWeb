// Unified OAuth/session auth (Google OAuth 2.0 + session-backed web auth)
// Keeps compatibility with existing code expecting req.user.claims.sub

import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Profile as GoogleProfile } from "passport-google-oauth20";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Flags / env
const AUTH_DISABLED = String(process.env.AUTH_DISABLED ?? "").toLowerCase() === "true";

// Google (new primary)
const HAS_GOOGLE =
  !!process.env.GOOGLE_CLIENT_ID &&
  !!process.env.GOOGLE_CLIENT_SECRET;

// Helpful base URL for callback construction
function getApiBaseUrl(): string {
  // Prefer explicit config
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;

  // Render often exposes an external URL env var depending on setup
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;

  // Fallback local
  const port = process.env.PORT || "5000";
  return `http://localhost:${port}`;
}

function normalizeReadySetFlyApiUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === "readysetfly-api.onrender.com" &&
      String(process.env.NODE_ENV).toLowerCase() === "production"
    ) {
      parsed.hostname = "api.readysetfly.us";
      return parsed.toString().replace(/\/$/, "");
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

function getGoogleCallbackUrl(): string {
  // Normalize stale production values so OAuth does not keep pointing at the
  // legacy Render hostname after the custom-domain cutover.
  if (process.env.GOOGLE_REDIRECT_URL) {
    return normalizeReadySetFlyApiUrl(process.env.GOOGLE_REDIRECT_URL);
  }

  // Otherwise derive it.
  return `${normalizeReadySetFlyApiUrl(getApiBaseUrl())}/api/auth/google/callback`;
}

function getSessionCookieDomain(): string | undefined {
  const explicit = String(process.env.SESSION_COOKIE_DOMAIN || "").trim();
  if (explicit) return explicit;

  const candidates = [
    process.env.FRONTEND_BASE_URL,
    process.env.WEB_ORIGIN,
    process.env.API_BASE_URL,
    process.env.RENDER_EXTERNAL_URL,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      const hostname = new URL(candidate).hostname.toLowerCase();
      if (hostname === "readysetfly.us" || hostname.endsWith(".readysetfly.us")) {
        return "readysetfly.us";
      }
    } catch {
      // Ignore invalid URLs in optional env vars.
    }
  }

  return undefined;
}

function normalizeFrontendReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const parsed = new URL(value, "http://readysetfly.local");
    if (parsed.pathname === "/login" || parsed.pathname === "/register") {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

// Postgres-backed sessions (shared by Passport + your /api/auth/web-login routes)
export function getSession() {
  const sessionTtlSeconds = 7 * 24 * 60 * 60; // 1 week
  const pgStore = connectPg(session);
  const cookieDomain = getSessionCookieDomain();

  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtlSeconds,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: {
      httpOnly: true,
      // Production runs frontend + API on sibling subdomains under readysetfly.us.
      // SameSite=None + Secure keeps OAuth/session cookies available across that split.
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production" ? true : false,
      domain: cookieDomain,
      maxAge: sessionTtlSeconds * 1000,
    },
  });
}

// Keep a consistent "shape" for req.user that your code already expects:
// req.user.claims.sub = INTERNAL USER ID
// req.user.claims.email, first_name, last_name, profile_image_url
function makePassportUser(internalUserId: string, profile: GoogleProfile) {
  return {
    claims: {
      sub: internalUserId,
      email: profile.emails?.[0]?.value ?? null,
      first_name: profile.name?.givenName ?? null,
      last_name: profile.name?.familyName ?? null,
      profile_image_url: profile.photos?.[0]?.value ?? null,
    },
  };
}

function makeRequestUserFromDbUser(dbUser: {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  isAdmin?: boolean | null;
  isSuperAdmin?: boolean | null;
}) {
  return {
    claims: {
      sub: dbUser.id,
      email: dbUser.email ?? null,
      first_name: dbUser.firstName ?? null,
      last_name: dbUser.lastName ?? null,
      profile_image_url: dbUser.profileImageUrl ?? null,
    },
    isAdmin: Boolean(dbUser.isAdmin),
    isSuperAdmin: Boolean(dbUser.isSuperAdmin),
  };
}

// Resolve user from OAuth profile WITHOUT changing existing IDs:
// 1) If existing user by email, use that (keeps uuid ids)
// 2) Else create user (uuid default via DB if you omit id)
async function resolveUserFromGoogle(profile: GoogleProfile) {
  const email = profile.emails?.[0]?.value;

  // Prefer stable email match (best for migration / prevents duplicate accounts)
  if (email) {
    const byEmail = await storage.getUserByEmail(String(email));
    if (byEmail) {
      await storage.updateUser(byEmail.id, {
        // keep id stable; just refresh profile data
        firstName: profile.name?.givenName ?? byEmail.firstName,
        lastName: profile.name?.familyName ?? byEmail.lastName,
        profileImageUrl: profile.photos?.[0]?.value ?? byEmail.profileImageUrl,
        emailVerified: true,
      });
      const refreshed = await storage.getUser(byEmail.id);
      if (!refreshed) throw new Error("User not found after update (email match)");
      return { user: refreshed, isNew: false };
    }
  }

  // Create new user (uuid default is handled by DB if InsertUser allows omitting id)
  const created = await storage.createUser({
    email: email ?? null,
    firstName: profile.name?.givenName ?? null,
    lastName: profile.name?.familyName ?? null,
    profileImageUrl: profile.photos?.[0]?.value ?? null,
    emailVerified: true,
    // NOTE: hashedPassword remains null for OAuth-only accounts
  } as any);

  return { user: created, isNew: true };
}

  // ✅ Unified auth guard:
  // - Passport OAuth users: req.isAuthenticated() + req.user.claims.sub
  // - Web email/password users: req.session.userId
  export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
    if (AUTH_DISABLED) return next();

    // Passport session (Google/Replit OAuth)
    if (typeof req.isAuthenticated === "function") {
      if (req.isAuthenticated() && req.user?.claims?.sub) return next();
    }

    // Email/password web session (set in /api/auth/web-login)
    if (req.session?.userId) {
      if (!req.user?.claims?.sub) {
        const dbUser = await storage.getUser(String(req.session.userId));
        if (!dbUser) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        req.user = makeRequestUserFromDbUser(dbUser);
      }
      return next();
    }

    return res.status(401).json({ message: "Unauthorized" });
  };

  export const isAdmin: RequestHandler = async (req: any, res, next) => {
    if (AUTH_DISABLED) return next();

    const userId = req.user?.claims?.sub || req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(String(userId));
    if (!dbUser || !dbUser.isAdmin) {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }

    next();
  };

  export const isSuperAdmin: RequestHandler = async (req: any, res, next) => {
    if (AUTH_DISABLED) return next();

    const userId = req.user?.claims?.sub || req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(String(userId));
    if (!dbUser || !dbUser.isSuperAdmin) {
      return res.status(403).json({ message: "Forbidden - Super Admin access required" });
    }

    next();
  };

  export async function setupAuth(app: Express) {
  // Always set trust proxy for secure cookies on Render/behind proxies
  app.set("trust proxy", 1);

  // Always attach sessions so /api/auth/web-login works (email/password)
  app.use(getSession());

  if (AUTH_DISABLED) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[AUTH] AUTH_DISABLED=true (sessions enabled, passport disabled).");
    }
    return;
  }

  // Passport init
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(async (req: any, _res, next) => {
    try {
      if (!req.user?.claims?.sub && req.session?.userId) {
        const dbUser = await storage.getUser(String(req.session.userId));
        if (dbUser) {
          req.user = makeRequestUserFromDbUser(dbUser);
        }
      }
      next();
    } catch (error) {
      next(error as any);
    }
  });

  passport.serializeUser((user: any, done) => {
    // store internal user id in session
    const id = user?.claims?.sub;
    done(null, id);
  });

  passport.deserializeUser(async (id: any, done) => {
    try {
      if (!id) return done(null, false);
      const dbUser = await storage.getUser(String(id));
      if (!dbUser) return done(null, false);
      done(null, makeRequestUserFromDbUser(dbUser));
    } catch (e) {
      done(e as any);
    }
  });

  // -------------------------
  // Google OAuth 2.0 Strategy
  // -------------------------
  if (HAS_GOOGLE) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: getGoogleCallbackUrl(),
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const result = await resolveUserFromGoogle(profile);
            if (!result?.user) throw new Error("resolveUserFromGoogle returned undefined");

            if (result.isNew && result.user.email) {
              try {
                const { sendWelcomeEmail } = await import("./email-templates");
                await sendWelcomeEmail({
                  email: result.user.email,
                  firstName: result.user.firstName,
                });
              } catch (emailError) {
                console.error("Failed to send welcome email:", emailError);
              }
            }

            const passportUser = makePassportUser(result.user.id, profile);
            done(null, passportUser);
          } catch (err) {
            done(err as any);
          }
        }
      )
    );

    // Start Google auth (web)
    app.get(
      "/api/auth/google",
      (req: any, _res, next) => {
        const returnTo = normalizeFrontendReturnTo(req.query?.redirect);
        if (returnTo) {
          req.session.oauthReturnTo = returnTo;
        } else if (req.session.oauthReturnTo) {
          delete req.session.oauthReturnTo;
        }
        next();
      },
      passport.authenticate("google", { scope: ["profile", "email"] })
    );

    // Start Google auth (mobile deep link flow)
    app.get(
      "/api/auth/google/mobile",
      passport.authenticate("google", {
        scope: ["profile", "email"],
        callbackURL: `${getApiBaseUrl()}/api/auth/google/mobile/callback`,
      } as any)
    );

    // Callback (web)
    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/" }),
      (req: any, res: any) => {
        const userId = req.user?.claims?.sub;
        if (userId) req.session.userId = userId;
        const returnTo = normalizeFrontendReturnTo(req.session.oauthReturnTo) || "/";
        delete req.session.oauthReturnTo;

        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("[AUTH][google callback] session save error:", saveErr);
            return res.status(500).json({ message: "Session save failed", detail: String(saveErr) });
          }

          void storage.createAnalyticsEvent({
            event: "oauth_login_completed",
            page: returnTo,
            visitorId: req.sessionID || `oauth_${userId || Date.now()}`,
            userId: userId || undefined,
            meta: {
              provider: "google",
              source_page: returnTo,
            },
          }).catch((error) => {
            console.warn("[AUTH][google callback] failed to record analytics:", error);
          });

          const frontend = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";
          return res.redirect(new URL(returnTo, frontend).toString());
        });
      }
    );

    // Callback (mobile)
    app.get(
      "/api/auth/google/mobile/callback",
      passport.authenticate("google", {
        failureRedirect: "/",
        callbackURL: `${getApiBaseUrl()}/api/auth/google/mobile/callback`,
      } as any),
      (req: any, res: any) => {
        const userId = req.user?.claims?.sub;
        if (userId) req.session.userId = userId;

        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("[AUTH][google mobile callback] session save error:", saveErr);
            return res.status(500).json({ message: "Session save failed", detail: String(saveErr) });
          }

          const apiBase = getApiBaseUrl();
          return res.redirect(`${apiBase}/api/auth/mobile-oauth-callback`);
        });
      }
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("[AUTH] Google OAuth 2.0 enabled. Callback:", getGoogleCallbackUrl());
    }
  } else {
    if (process.env.NODE_ENV !== "production") {
      console.log("[AUTH] Google OAuth 2.0 NOT enabled (missing GOOGLE_CLIENT_ID/SECRET).");
    }
  }
}
