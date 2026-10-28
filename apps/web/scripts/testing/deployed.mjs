import process from "node:process";
import console from "node:console";
import { chromium, expect } from "@playwright/test";
import { deploymentConfig, requestPolicy, DeploymentPolicyError } from "./deployed-policy.mjs";

const help = process.argv.includes("--help");
if (help) {
  console.log("Usage: node scripts/testing/deployed.mjs public|read");
  console.log("Requires TIMELINE_DEPLOYED_ORIGIN and matching TIMELINE_APPROVED_ORIGIN (HTTPS).");
  console.log("Read additionally requires explicit synthetic-auth approval and account/owner/project configuration.");
} else {
  let browser;
  let context;
  let cleanupOrigin;
  let authenticated = false;
  let success = false;
  let policy;
  const failures = [];
  try {
    const config = deploymentConfig(process.env, process.argv[2]);
    cleanupOrigin = config.origin;
    policy = requestPolicy(config);
    browser = await chromium.launch({ channel: "msedge" });
    context = await browser.newContext({ baseURL: config.origin, serviceWorkers: "block" });
    context.on("page", (page) => page.on("pageerror", () => failures.push("Unexpected browser runtime error.")));
    await context.route("**/*", async (route) => {
      try { policy(route.request().method(), route.request().url()); }
      catch { failures.push("Deployment request guard rejected a request."); await route.abort(); return; }
      await route.continue();
    });
    async function readJson(path, input) {
      const method = input ? "POST" : "GET";
      policy(method, path);
      const response = await context.request.fetch(path, {
        method, data: input, maxRedirects: 0,
        headers: { Origin: config.origin },
        failOnStatusCode: false,
      });
      if (!response.ok()) throw new Error("A deployed API check failed; response details were intentionally not retained.");
      if (!response.headers()["cache-control"]?.includes("no-store")) throw new Error("Private API cache policy is missing.");
      return response.json();
    }
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    const response = await page.goto("/account?mode=signin", { waitUntil: "networkidle" });
    if (!response?.ok() || !response.headers()["content-security-policy"]?.includes("frame-ancestors 'none'")) {
      throw new Error("Public deployed page or required CSP failed.");
    }
    const session = await readJson("/api/session");
    if (!session.configured || session.user) throw new Error("Anonymous account-service precondition failed.");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    if (config.mode === "read") {
      await readJson("/api/auth/signin", { email: config.email, password: config.password });
      authenticated = true;
      const signedIn = await readJson("/api/session");
      if (signedIn.user?.id !== config.ownerId) throw new Error("Synthetic account identity does not match the approved owner.");
      const projects = await readJson("/api/projects");
      if (!Array.isArray(projects) || !projects.some((project) => project.id === config.projectId)) {
        throw new Error("Approved synthetic project is unavailable.");
      }
      const detail = await readJson(`/api/projects/${config.projectId}`);
      if (detail.project?.id !== config.projectId) throw new Error("Synthetic project identity mismatch.");
      const events = await readJson(`/api/projects/${config.projectId}/events?offset=0&undated=true`);
      if (!Array.isArray(events.events)) throw new Error("Synthetic timeline response contract failed.");
      await page.goto(`/projects/${config.projectId}`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { level: 1 }).waitFor();
    }
    if (failures.length) throw new Error("Deployed browser checks encountered guarded or runtime failures.");
    success = true;
  } catch (error) {
    console.error(error instanceof DeploymentPolicyError
      ? `BLOCKED: ${error.message}`
      : "FAIL: deployed checks did not complete. Verify provider health and approved fixtures locally. No credentials or response payloads were retained.");
    process.exitCode = 1;
  } finally {
    if (authenticated && context && policy) {
      try {
        policy("POST", "/api/auth/signout");
        const result = await context.request.post("/api/auth/signout", {
          data: {}, maxRedirects: 0,
          headers: { Origin: cleanupOrigin },
        });
        if (!result.ok()) {
          console.error("FAIL: synthetic-session cleanup was rejected.");
          process.exitCode = 1;
        }
      } catch {
        console.error("FAIL: synthetic-session cleanup needs operator attention.");
        process.exitCode = 1;
      }
    }
    await context?.close();
    await browser?.close();
  }
  if (success && !process.exitCode) console.log(`PASS: deployed ${process.argv[2]} checks. No journal mutations or email requests were permitted.`);
}
