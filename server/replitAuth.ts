// Replit Auth integration (from blueprint:javascript_log_in_with_replit)
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const IS_REPLIT = !!process.env.REPL_ID || !!process.env.REPLIT_DEPLOYMENT;

// In local/dev (non-Replit), don't require Replit env vars
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS ?? "localhost";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset session expiration on every request (keeps users logged in while active)
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  const email = claims["email"];
  
  // Check if user should have admin privileges
  const isAdmin = email === "coryarmer@gmail.com" || 
                 (email && email.endsWith("@readysetfly.us"));
  
  return await storage.upsertUser({
    id: claims["sub"],
    email: email,
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    isAdmin: isAdmin,
    emailVerified: true, // OAuth providers have already verified the email
  });
}

export async function setupAuth(app: Express) {
  // 🔒 Skip Replit auth entirely when not running on Replit
  if (!IS_REPLIT) {
    console.log("[AUTH] Replit auth disabled (local/dev environment).");
    return;
  }

  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    console.log("[AUTH] Verify function called with claims:", tokens.claims());

    const user: any = {};
    updateUserSession(user, tokens);

    try {
      const upsertedUser = await upsertUser(tokens.claims());
      console.log("[AUTH] User upserted successfully:", {
        id: upsertedUser.id,
        email: upsertedUser.email,
      });
    } catch (error) {
      console.error("[AUTH] Error upserting user:", error);
    }

    verified(null, user);
  };

  // Domains allowed for Replit OAuth
  const configuredDomains = REPLIT_DOMAINS.split(",").map((d) => d.trim());

  // Add Replit dev domain if present
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
  const allDomainsSet = new Set(configuredDomains);
  if (replitDevDomain) {
    allDomainsSet.add(replitDevDomain);
  }

  const allDomains = Array.from(allDomainsSet);

  console.log("[AUTH] Registering Replit Auth strategies for domains:", allDomains);

  for (const domain of allDomains) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    console.log("[AUTH] Login initiated for hostname:", req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`)(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log("[AUTH] Callback received for hostname:", req.hostname);

    const isMobileRequest = req.query.mobile === "true";

    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: isMobileRequest
        ? "/api/auth/mobile-oauth-callback"
        : "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("[AUTH] Logout error:", err);
      }

      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("[AUTH] Session destruction error:", destroyErr);
        }

        // 🔧 Fix: clear cookie with the same attributes used when it was set
        res.clearCookie("connect.sid", {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });

        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // If passport isn't initialized (e.g., local/dev with Replit auth disabled),
  // req.isAuthenticated won't exist. In that case, allow the request through.
  const hasPassport = typeof (req as any).isAuthenticated === "function";
  if (!hasPassport) {
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if this is an email/password session (no expires_at)
  // These sessions are managed by express-session with rolling expiration
  if (!user?.expires_at) {
    return next();
  }

  // OAuth sessions with token expiration
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  
  if (!user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Get user from database to check admin status
  let dbUser = await storage.getUser(user.claims.sub);
  
  // Fallback to email lookup (for testing scenarios where sub may change)
  if (!dbUser && user.claims.email) {
    console.log("[isAdmin] User not found by sub, trying email lookup:", user.claims.email);
    dbUser = await storage.getUserByEmail(user.claims.email);
    console.log("[isAdmin] Email lookup result:", dbUser ? `Found user ${dbUser.id}, isAdmin: ${dbUser.isAdmin}` : "Not found");
  }
  
  if (!dbUser || !dbUser.isAdmin) {
    console.log("[isAdmin] Access denied. dbUser:", dbUser ? `exists (isAdmin: ${dbUser.isAdmin})` : "not found");
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }

  next();
};
