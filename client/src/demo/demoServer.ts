/**
 * Browser-only demo: serves the app's real API (server/api.ts) from inside the page, backed by
 * in-memory storage and the fictional demo patient. No server, no sign-in, nothing leaves the
 * browser. Used only by the demo build (VITE_DEMO=1).
 */
import { registerApi, type NextFunction, type Request as ApiRequest, type Response as ApiResponse, type Router } from "../../../server/api";
import { MemStorage } from "../../../server/storage";
import { todayLocal } from "@/lib/dates";

type Handler = (req: ApiRequest, res: ApiResponse, next: NextFunction) => void;
interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export const DEMO_USER = "demo-patient";

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path.replace(/:([a-zA-Z]+)/g, (_, k) => {
    keys.push(k);
    return "([^/]+)";
  });
  return { pattern: new RegExp(`^${source}$`), keys };
}

function createRouter(routes: Route[]): Router {
  const add = (method: string) => (path: string, handler: Handler) => routes.push({ method, ...compile(path), handler });
  return { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
}

async function dispatch(routes: Route[], method: string, url: URL, init?: RequestInit): Promise<Response> {
  if (url.pathname === "/api/auth/user") return Response.json({ id: DEMO_USER, firstName: "Demo" });
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = url.pathname.match(r.pattern);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const headers = new Headers(init?.headers);
    const req: ApiRequest = {
      userId: DEMO_USER,
      params,
      query: Object.fromEntries(url.searchParams),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      protocol: location.protocol.replace(":", ""),
      header: (n) => headers.get(n) ?? undefined,
      get: (n) => (n.toLowerCase() === "host" ? location.host : headers.get(n) ?? undefined),
    };
    return new Promise<Response>((resolve) => {
      let status = 200;
      const outHeaders: Record<string, string> = {};
      const res: ApiResponse = {
        status(code) {
          status = code;
          return res;
        },
        json(body) {
          resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...outHeaders } }));
          return res;
        },
        send(body) {
          resolve(new Response(body, { status, headers: outHeaders }));
          return res;
        },
        end() {
          resolve(new Response(null, { status }));
          return res;
        },
        setHeader(name, value) {
          outHeaders[name] = value;
          return res;
        },
      };
      r.handler(req, res, (err) => {
        console.error("[demo] request failed", err);
        resolve(Response.json({ message: "Something went wrong" }, { status: 500 }));
      });
    });
  }
  return Response.json({ message: "Not found" }, { status: 404 });
}

/** Installs the in-page API and loads the demo patient. Call before rendering the app. */
export async function startDemo(): Promise<void> {
  const routes: Route[] = [];
  registerApi(createRouter(routes), { storage: new MemStorage(), allowDemo: true });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return realFetch(input, init);
    return dispatch(routes, (init?.method ?? "GET").toUpperCase(), url, init);
  };
  await fetch(`/api/demo/load?date=${todayLocal()}`, { method: "POST" });
}

/** The demo follows the viewer's light/dark setting (system or explicit). */
export function syncTheme(): void {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const explicit = root.getAttribute("data-theme");
    root.classList.toggle("dark", explicit ? explicit === "dark" : media.matches);
  };
  apply();
  media.addEventListener("change", apply);
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
}
