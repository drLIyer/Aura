import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "http";
import type { AuthMode } from "./auth";
import { registerRoutes, type RouteOptions } from "./routes";

/**
 * Builds the Express app. Kept separate from index.ts so tests can run it against in-memory
 * storage without a database, Vite or a listening port.
 */
export async function createApp(options: RouteOptions & { beforeRoutes?: (app: express.Express) => Promise<unknown> }): Promise<{ app: express.Express; server: Server }> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));

  // Log method, path, status and timing only. Bodies hold health data and never go to logs.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api") && process.env.NODE_ENV !== "test") {
        console.log(`${new Date().toLocaleTimeString()} [express] ${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
      }
    });
    next();
  });

  await options.beforeRoutes?.(app);
  const server = await registerRoutes(app, options);

  app.use("/api", (_req, res) => res.status(404).json({ message: "Not found" }));

  app.use((err: { status?: number; statusCode?: number; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("[aura] request failed:", err.message);
    if (!res.headersSent) res.status(status).json({ message: status >= 500 ? "Something went wrong" : err.message });
  });

  return { app, server };
}

export type { AuthMode };
