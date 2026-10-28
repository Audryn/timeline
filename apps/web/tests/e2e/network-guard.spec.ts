import { expect, test } from "./fixtures/test";

test.describe("browser network guard", () => {
  test.use({
    expectedBlockedRequests: [
      "GET https://foreign.example/unexpected",
      "GET /api/unhandled-synthetic",
      "WEBSOCKET wss://foreign.example/socket",
    ],
  });

  test("blocks foreign traffic and unhandled API calls from every tab, while page mocks take precedence", async ({ page, context, baseURL }) => {
    await page.route("**/api/session", (route) => route.fulfill({ json: { configured: false, user: null } }));
    await page.goto("/projects");
    await expect(page.getByText("Supabase has not been configured yet.")).toBeVisible();
    const other = await context.newPage();
    await other.goto("/");
    await expect(other.goto("https://foreign.example/unexpected")).rejects.toThrow("net::ERR_BLOCKED_BY_CLIENT");
    await expect(other.goto(`${new URL(baseURL!).origin}/api/unhandled-synthetic`)).rejects.toThrow("net::ERR_BLOCKED_BY_CLIENT");
    const socketError = await page.evaluate(() => {
      try { new WebSocket("wss://foreign.example/socket"); }
      catch (problem) { return problem instanceof DOMException ? problem.name : "Unexpected failure"; }
      return "Unexpected socket connection";
    });
    expect(socketError).toBe("SecurityError");
  });
});

test.describe("intentional real local API boundary", () => {
  test.use({ realApiRequests: [{ method: "GET", path: "/api/session" }] });

  test("allows only the explicitly selected real session request", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByText("Supabase has not been configured yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open setup instructions" })).toBeVisible();
  });
});
