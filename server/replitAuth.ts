// Unified OAuth/session auth (Google OIDC + optional legacy Replit OIDC)
// Keeps compatibility with existing code expecting req.user.claims.sub

import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Flags / env
const AUTH_DISABLED = String(process.env.AUTH_DISABLED ?? "").toLowerCase() === "true";

// Legacy Replit (optional while migrating)
const HAS_REPLIT = !!process.env.REPL_ID || !!process.env.REPLIT_DEPLOYMENT;
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS ?? "localhost";
const REPLIT_ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";

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

function getGoogleCallbackUrl(): string {
  // If you explicitly provide it, we use it.
  if (process.env.GOOGLE_REDIRECT_URL) return process.env.GOOGLE_REDIRECT_URL;

  // Otherwise derive it.
  return `${getApiBaseUrl()}/api/auth/google/callback`;
}

function getReplitCallbackUrl(): string {
  if (process.env.REPLIT_REDIRECT_URL) return process.env.REPLIT_REDIRECT_URL;
  return `${getApiBaseUrl()}/api/auth/replit/callback`;
}

// OIDC discovery (memoized)
const getGoogleOidcConfig = memoize(
  async () => {
    // Google issuer discovery
    const issuer = await client.Issuer.discover("https://accounts.google.com");

    // Create a confidential client so token exchange sends client_secret (Google requires it for web apps)
    return new issuer.Client({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uris: [getGoogleCallbackUrl()],
      response_types: ["code"],
    });
  },
  { maxAge: 3600 * 1000 }
);

const getReplitOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(REPLIT_ISSUER_URL),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

// Postgres-backed sessions (shared by Passport + your /api/auth/web-login routes)
export function getSession() {
  const sessionTtlSeconds = 7 * 24 * 60 * 60; // 1 week
  const pgStore = connectPg(session);

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
      // Cross-site (frontend on readysetfly.us, API on readysetfly-api.onrender.com)
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production" ? "auto" : false,
      maxAge: sessionTtlSeconds * 1000,
    },
  });
}

// Keep a consistent "shape" for req.user that your code already expects:
// req.user.claims.sub = INTERNAL USER ID
// req.user.claims.email, first_name, last_name, profile_image_url
function makePassportUser(internalUserId: string, claims: any) {
  return {
    claims: {
      sub: internalUserId,
      email: claims?.email ?? null,
      first_name: claims?.given_name ?? claims?.first_name ?? null,
      last_name: claims?.family_name ?? claims?.last_name ?? null,
      profile_image_url: claims?.picture ?? claims?.profile_image_url ?? null,
    },
  };
}

// Resolve user from OAuth claims WITHOUT changing existing IDs:
// 1) If existing user by provider-sub (legacy Replit id), keep it
// 2) Else if existing user by email, use that (keeps uuid ids)
// 3) Else create user (uuid default via DB if you omit id)
async function resolveUserFromOAuth(provider: "google" | "replit", claims: any) {
  const email = claims?.email;
  const providerSub = claims?.sub;

  // Legacy Replit had users.id = claims.sub
  if (provider === "replit" && providerSub) {
    const bySub = await storage.getUser(String(providerSub));
    if (bySub) {
      // Update profile fields on login
      await storage.updateUser(bySub.id, {
        email: email ?? bySub.email,
        firstName: claims?.first_name ?? bySub.firstName,
        lastName: claims?.last_name ?? bySub.lastName,
        profileImageUrl: claims?.profile_image_url ?? bySub.profileImageUrl,
        emailVerified: true,
      });
    const refreshed = await storage.getUser(bySub.id);
    if (!refreshed) throw new Error("User not found after update (replit sub match)");
    return refreshed;
    }
  }

  // Prefer stable email match (best for migration / prevents duplicate accounts)
  if (email) {
    const byEmail = await storage.getUserByEmail(String(email));
    if (byEmail) {
      await storage.updateUser(byEmail.id, {
        // keep id stable; just refresh profile data
        firstName:
          claims?.given_name ?? claims?.first_name ?? byEmail.firstName,
        lastName:
          claims?.family_name ?? claims?.last_name ?? byEmail.lastName,
        profileImageUrl:
          claims?.picture ?? claims?.profile_image_url ?? byEmail.profileImageUrl,
        emailVerified: true,
      });
      const refreshed = await storage.getUser(byEmail.id);
if (!refreshed) throw new Error("User not found after update (email match)");
return refreshed;
    }
  }

  // Create new user (uuid default is handled by DB if InsertUser allows omitting id)
  // If your InsertUser requires id, we can switch to storage.upsertUser with an internal uuid,
  // but based on your schema default, this should be fine.
  const created = await storage.createUser({
    email: email ?? null,
    firstName: claims?.given_name ?? claims?.first_name ?? null,
    lastName: claims?.family_name ?? claims?.last_name ?? null,
    profileImageUrl: claims?.picture ?? claims?.profile_image_url ?? null,
    emailVerified: true,
    // NOTE: hashedPassword remains null for OAuth-only accounts
  } as any);

  return created;
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
    if (req.session?.userId) return next();

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

  export async function setupAuth(app: Express) {
  // Always set trust proxy for secure cookies on Render/behind proxies
  app.set("trust proxy", 1);

  // Always attach sessions so /api/auth/web-login works (email/password)
  app.use(getSession());

  if (AUTH_DISABLED) {
    console.log("[AUTH] AUTH_DISABLED=true (sessions enabled, passport disabled).");
    return;
  }

  // Passport init
  app.use(passport.initialize());
  app.use(passport.session());

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

      // Rehydrate into the same shape code expects
      const passportUser = makePassportUser(dbUser.id, {
        email: dbUser.email,
        first_name: dbUser.firstName,
        last_name: dbUser.lastName,
        profile_image_url: dbUser.profileImageUrl,
      });

      done(null, passportUser);
    } catch (e) {
      done(e as any);
    }
  });
  // -------------------------
  // Google OIDC Strategy
  // -------------------------
  if (HAS_GOOGLE) {
    const googleConfig = await getGoogleOidcConfig();

    const verifyGoogle: VerifyFunction = async (tokens, verified) => {
      try {
        const claims = tokens.claims();
        const dbUser = await resolveUserFromOAuth("google", claims);
        if (!dbUser) throw new Error("resolveUserFromOAuth returned undefined");

        const passportUser = makePassportUser(dbUser.id, claims);
        verified(null, passportUser);
      } catch (err) {
        verified(err as any);
      }
    };

    passport.use(
      "google",
      new Strategy(
        {
          name: "google",
          client: googleConfig,
          params: {
            scope: "openid email profile",
          },
        },
        verifyGoogle
      )
    );

    // Start Google auth
    app.get("/api/auth/google", passport.authenticate("google"));

    // Callback
    app.get(
      "/api/auth/google/callback",
      (req, res, next) => {
        passport.authenticate("google", async (err, user, info) => {
          if (err) {
            const rawBody = (err as any)?.response?.body;
            const statusCode = (err as any)?.response?.statusCode || 500;

            // Provide a structured detail object to make browser debugging easier.
            const detail: Record<string, any> = {
              responseStatus: statusCode,
              responseBody: rawBody ?? null,
              error: (err as any)?.error ?? null,
              error_description: (err as any)?.error_description ?? null,
              message: (err as any)?.message ?? null,
            };

            // Add stack trace only to server logs to avoid leaking in responses.
            console.error("[AUTH][google callback] token exchange error:", {
              statusCode,
              body: rawBody,
              error: (err as any)?.error,
              error_description: (err as any)?.error_description,
              message: (err as any)?.message,
              info,
              stack: (err as any)?.stack,
            });

            return res.status(statusCode).json({ message: "OAuth exchange failed", detail });
          }

          if (!user) {
            console.error("[AUTH][google callback] no user returned from verify", info);
            return res.redirect("/");
          }

          req.logIn(user, (loginErr) => {
            if (loginErr) {
              console.error("[AUTH][google callback] logIn error:", loginErr);
              return res.status(500).json({ message: "Session login failed", detail: String(loginErr) });
            }

            const userId = (user as any)?.claims?.sub;
            if (userId) req.session.userId = userId;

            req.session.save((saveErr: any) => {
              if (saveErr) {
                console.error("[AUTH][google callback] session save error:", saveErr);
                return res.status(500).json({ message: "Session save failed", detail: String(saveErr) });
              }

              const frontend = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";
              return res.redirect(frontend);
            });
          });
        })(req, res, next);
      }
    );

    console.log("[AUTH] Google OIDC enabled. Callback:", getGoogleCallbackUrl());
  } else {
    console.log("[AUTH] Google OIDC NOT enabled (missing GOOGLE_CLIENT_ID/SECRET).");
  }

  // -------------------------
  // Legacy Replit OIDC Strategy (optional during migration)
  // -------------------------
  if (HAS_REPLIT && process.env.REPL_ID) {
    const replitConfig = await getReplitOidcConfig();

    const verifyReplit: VerifyFunction = async (tokens, verified) => {
      try {
        const claims = tokens.claims();
        const dbUser = await resolveUserFromOAuth("replit", claims);
        if (!dbUser) throw new Error("resolveUserFromOAuth returned undefined");

        const passportUser = makePassportUser(dbUser.id, claims);
        verified(null, passportUser);
      } catch (err) {
        verified(err as any);
      }
    };

    passport.use(
      "replit",
      new Strategy(
        {
          name: "replit",
          config: replitConfig,
          scope: "openid email profile",
          callbackURL: getReplitCallbackUrl(),
        },
        verifyReplit
      )
    );

    app.get("/api/auth/replit", passport.authenticate("replit"));

    app.get(
      "/api/auth/replit/callback",
      passport.authenticate("replit", { failureRedirect: "/" }),
      (req: any, res: any) => {
        const userId = req.user?.claims?.sub;
        if (userId) req.session.userId = userId;
        res.redirect("/");
      }
    );

    console.log("[AUTH] Legacy Replit OIDC enabled. Callback:", getReplitCallbackUrl());
  } else {
    console.log("[AUTH] Legacy Replit OIDC disabled.");
  }
}