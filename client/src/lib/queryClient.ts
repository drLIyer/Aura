import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { userTimeZone } from "./dates";

/** Every request tells the server the user's time zone, so "today" is the user's today. */
const baseHeaders = (): Record<string, string> => ({ "X-Timezone": userTimeZone() });

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const body = JSON.parse(text);
      message = body.issues?.length ? body.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ") : (body.message ?? text);
    } catch {
      // not JSON
    }
    throw new Error(`${res.status}: ${message}`);
  }
}

export async function apiRequest(url: string, method: string, data?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: { ...baseHeaders(), ...(data !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

export async function apiJson<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const res = await apiRequest(url, method, data);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, { credentials: "include", headers: baseHeaders() });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: { retry: false },
  },
});

/** After any write, computed views (forecast, alerts, insights) may change. */
export function invalidateAll() {
  return queryClient.invalidateQueries();
}
