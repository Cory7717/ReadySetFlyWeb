// Unified OAuth/session auth (Google OAuth 2.0 + optional legacy Replit OIDC)
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

function getGoogleCallbackUrl(): string {
  // If you explicitly provide it, we use it.
  if (process.env.GOOGLE_REDIRECT_URL) return process.env.GOOGLE_REDIRECT_URL;

  // Otherwise derive it.
  return `${getApiBaseUrl()}/api/auth/google/callback`;
}

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
      // In production we must use SameSite=None and Secure so cookies survive cross-site in incognito.
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production" ? true : false,
      // If you have both app + api on the same apex, you can set domain to .readysetfly.us
      // Leave undefined to let the browser scope it to the API host.
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
      return refreshed;
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
      const passportUser = {
        claims: {
          sub: dbUser.id,
          email: dbUser.email,
          first_name: dbUser.firstName,
          last_name: dbUser.lastName,
          profile_image_url: dbUser.profileImageUrl,
        },
      };

      done(null, passportUser);
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
            const dbUser = await resolveUserFromGoogle(profile);
            if (!dbUser) throw new Error("resolveUserFromGoogle returned undefined");

            const passportUser = makePassportUser(dbUser.id, profile);
            done(null, passportUser);
          } catch (err) {
            done(err as any);
          }
        }
      )
    );

    // Start Google auth
    app.get(
      "/api/auth/google",
      passport.authenticate("google", { scope: ["profile", "email"] })
    );

    // Callback
    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/" }),
      (req: any, res: any) => {
        const userId = req.user?.claims?.sub;
        if (userId) req.session.userId = userId;

        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("[AUTH][google callback] session save error:", saveErr);
            return res.status(500).json({ message: "Session save failed", detail: String(saveErr) });
          }

          const frontend = process.env.FRONTEND_BASE_URL || "https://readysetfly.us";
          return res.redirect(frontend);
        });
      }
    );

    console.log("[AUTH] Google OAuth 2.0 enabled. Callback:", getGoogleCallbackUrl());
  } else {
    console.log("[AUTH] Google OAuth 2.0 NOT enabled (missing GOOGLE_CLIENT_ID/SECRET).");
  }
}