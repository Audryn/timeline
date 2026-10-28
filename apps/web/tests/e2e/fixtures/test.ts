import { expect, test as base } from "@playwright/test";

type AllowedRequest = { method: string; path: string };
type GuardOptions = {
  realApiRequests: AllowedRequest[];
  expectedBlockedRequests: string[];
};
type GuardFixtures = { networkGuard: void };
type GuardWindow = Window & { reportBlockedTimelineSocket?: (request: string) => Promise<void> };

export const test = base.extend<GuardOptions & GuardFixtures>({
  realApiRequests: [[], { option: true }],
  expectedBlockedRequests: [[], { option: true }],
  networkGuard: [async ({ context, baseURL, realApiRequests, expectedBlockedRequests }, use) => {
    if (!baseURL) throw new Error("Browser fixtures require an explicit local baseURL.");
    const origin = new URL(baseURL).origin;
    const blocked: string[] = [];
    // Page routes, and context routes registered by a scenario later, run first.
    // Unhandled API calls must never fall through to the real application.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const sameOrigin = url.origin === origin;
      const api = url.pathname === "/api" || url.pathname.startsWith("/api/");
      const allowed = realApiRequests.some((entry) => entry.method === request.method() && entry.path === url.pathname);
      if (!sameOrigin || (api && !allowed)) {
        blocked.push(`${request.method()} ${sameOrigin ? "" : url.origin}${url.pathname}`);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    // Keep allowed sockets native: Next's development client carries binary HMR
    // traffic that this guard must not proxy.
    await context.exposeBinding("reportBlockedTimelineSocket", (_source, request: string) => { blocked.push(request); });
    await context.addInitScript((allowedOrigin) => {
      window.WebSocket = new Proxy(window.WebSocket, {
        construct(target, args) {
          const url = new URL(String(args[0]), location.href);
          const http = new URL(url);
          if (http.protocol === "ws:") http.protocol = "http:";
          if (http.protocol === "wss:") http.protocol = "https:";
          if (http.origin !== allowedOrigin || http.pathname === "/api" || http.pathname.startsWith("/api/")) {
            void (window as GuardWindow).reportBlockedTimelineSocket?.(`WEBSOCKET ${url.origin}${url.pathname}`);
            throw new DOMException("Blocked unexpected test WebSocket.", "SecurityError");
          }
          return Reflect.construct(target, args);
        },
      });
    }, origin);
    await use();
    expect(blocked, "Unexpected browser traffic; mock it or explicitly allow a real local API request.")
      .toEqual(expectedBlockedRequests);
  }, { auto: true }],
});

export { expect };
