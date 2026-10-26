import type { Express, NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Every /api route except the login flow requires a signed-in user.
 *
 * - On Replit (REPL_ID set): Replit Auth (OpenID Connect) with Postgres-backed sessions.
 * - Local development only: AURA_DEV_USER_ID=<any id> signs every request in as that user.
 *   It is refused when NODE_ENV=production, so a deployed app can never run unauthenticated.
 * - Neither configured: the API answers 503 instead of serving data to anonymous callers.
 */

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export type AuthMode = "replit" | "dev" | "none";

export function authMode(env = process.env): AuthMode {
  if (env.REPL_ID && env.DATABASE_URL && env.SESSION_SECRET) return "replit";
  if (env.AURA_DEV_USER_ID) {
    if (env.NODE_ENV === "production") throw new Error("AURA_DEV_USER_ID must not be set in production");
    return "dev";
  }
  return "none";
}

export async function setupAuth(app: Express): Promise<AuthMode> {
  const mode = authMode();
  if (mode === "replit") {
    const { setupAuth: setupReplitAuth } = await import("./replit_integrations/auth/replitAuth");
    const { registerAuthRoutes } = await import("./replit_integrations/auth/routes");
    await setupReplitAuth(app);
    registerAuthRoutes(app);
  } else if (mode === "dev") {
    console.warn(`[aura] Development sign-in: every request is user "${process.env.AURA_DEV_USER_ID}"`);
    app.get("/api/auth/user", (_req, res) => {
      res.json({ id: process.env.AURA_DEV_USER_ID, firstName: "Developer", email: null });
    });
    app.get("/api/login", (_req, res) => res.redirect("/"));
    app.get("/api/logout", (_req, res) => res.redirect("/"));
  } else {
    console.warn("[aura] No sign-in configured: the API will refuse requests. Set up Replit Auth or AURA_DEV_USER_ID.");
  }
  return mode;
}

/** Attaches req.userId or stops the request. */
export function requireUser(mode: AuthMode): RequestHandler {
  if (mode === "dev") {
    return (req, _res, next) => {
      req.userId = process.env.AURA_DEV_USER_ID;
      next();
    };
  }
  if (mode === "none") {
    return (_req, res) => {
      res.status(503).json({ message: "Sign-in is not configured on this server." });
    };
  }
  return async (req: Request, res: Response, next: NextFunction) => {
    const { isAuthenticated } = await import("./replit_integrations/auth/replitAuth");
    isAuthenticated(req, res, () => {
      const sub = (req.user as { claims?: { sub?: string } } | undefined)?.claims?.sub;
      if (!sub) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      req.userId = sub;
      next();
    });
  };
}
