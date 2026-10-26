import type { Express } from "express";
import { createServer, type Server } from "http";
import type { AuthMode } from "./auth";
import { requireUser } from "./auth";
import { registerApi, type ApiOptions } from "./api";

export { buildInsights, buildReport, cycleCorrelation } from "./api";

export interface RouteOptions extends Omit<ApiOptions, "allowDemo"> {
  authMode: AuthMode;
}

/** Express adapter: sign-in on every /api route, then the framework-neutral API. */
export async function registerRoutes(app: Express, { authMode, ...options }: RouteOptions): Promise<Server> {
  // Login/logout/auth routes were registered before this.
  app.use("/api", (req, res, next) => {
    if (["/login", "/logout", "/callback", "/auth/user"].includes(req.path)) return next();
    return requireUser(authMode)(req, res, next);
  });
  registerApi(app as never, { ...options, allowDemo: authMode === "dev" });
  return createServer(app);
}
