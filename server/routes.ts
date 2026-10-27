import type { Express } from "express";
import { createServer, type Server } from "http";
import type { AuthMode } from "./auth";
import { requireUser } from "./auth";
import { registerApi, type ApiOptions } from "./api";
import { RuleProvider } from "@shared/assist/ruleProvider";
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeProvider, type MessagesClient } from "./assist/claudeProvider";

export { buildInsights, buildReport, cycleCorrelation } from "./api";

export interface RouteOptions extends Omit<ApiOptions, "allowDemo"> {
  authMode: AuthMode;
}

/** Express adapter: sign-in on every /api route, then the framework-neutral API. */
/** AI mode only when the server has a key; otherwise basic mode. The key is read here and never sent to the browser. */
export function defaultAssistant(env: Record<string, string | undefined> = process.env) {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  return apiKey ? new ClaudeProvider(new Anthropic({ apiKey }) as unknown as MessagesClient) : new RuleProvider();
}

export async function registerRoutes(app: Express, { authMode, assistant = defaultAssistant(), ...options }: RouteOptions): Promise<Server> {
  // Login/logout/auth routes were registered before this.
  app.use("/api", (req, res, next) => {
    if (["/login", "/logout", "/callback", "/auth/user"].includes(req.path)) return next();
    return requireUser(authMode)(req, res, next);
  });
  registerApi(app as never, { ...options, assistant, allowDemo: authMode === "dev" });
  console.log(`[aura] assistant: ${assistant.mode === "ai" ? "AI mode (Claude)" : "basic mode (no ANTHROPIC_API_KEY)"}`);
  return createServer(app);
}
