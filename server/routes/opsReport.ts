import express, { type Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { tipsUsers } from "@shared/schema";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const OPS_REPORT_ADMIN_EMAILS = new Set(
  (process.env.OPS_REPORT_ADMIN_EMAILS || "coryarmer@gmail.com,cory.armer@marriott.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function publicOpsUser(user: any) {
  const email = normalizeEmail(String(user.email || ""));
  const role = OPS_REPORT_ADMIN_EMAILS.has(email) || user.role === "super_admin" ? "super_admin" : user.role === "manager" ? "manager" : "employee";
  const explicitAccess = getExplicitToolAccess(user, "opsreport");
  const unlocked = explicitAccess ?? (role === "manager" || role === "super_admin");
  return {
    id: user.id,
    email,
    employeeDisplayName: user.employeeDisplayName,
    role,
    isAdmin: unlocked,
    isSuperAdmin: role === "super_admin",
    toolAccess: getToolAccess(user),
    disabledAt: user.disabledAt ?? null,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

function getToolAccess(user: any): Record<string, boolean> {
  const access = user?.toolAccessJson;
  return access && typeof access === "object" && !Array.isArray(access) ? access as Record<string, boolean> : {};
}

function getExplicitToolAccess(user: any, tool: "schedule" | "tips" | "opsreport") {
  const value = getToolAccess(user)[tool];
  return typeof value === "boolean" ? value : null;
}

async function getUserBySession(req: any) {
  const userId = req.session?.tipsUserId;
  if (!userId) return null;
  const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, String(userId))).limit(1);
  return user || null;
}

export function registerOpsReportRoutes(app: Express) {
  const router = express.Router();

  router.get("/access", async (req: any, res, next) => {
    try {
      const user = await getUserBySession(req);
      if (!user || user.disabledAt) return res.json({ unlocked: false, user: null });
      const publicUser = publicOpsUser(user);
      if (publicUser.mustChangePassword) return res.json({ unlocked: false, user: publicUser, passwordChangeRequired: true });
      res.json({ unlocked: publicUser.isAdmin, user: publicUser });
    } catch (error) {
      next(error);
    }
  });

  router.post("/access", async (req: any, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Email and password are required." });
      // Login is handled by /api/tips/auth/login. This endpoint remains for compatibility
      // with the initial invite-code gate and simply reports the current session state.
      const user = await getUserBySession(req);
      if (!user || user.disabledAt) return res.status(401).json({ error: "Courtyard login required." });
      const publicUser = publicOpsUser(user);
      if (!publicUser.isAdmin) return res.status(403).json({ error: "Ops report manager access required." });
      res.json({ unlocked: true, user: publicUser });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (req: any, res) => {
    if (req.session) delete req.session.tipsUserId;
    req.session?.save(() => res.json({ ok: true }));
  });

  app.use("/api/opsreport", router);
}
