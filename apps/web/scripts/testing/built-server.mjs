import http from "node:http";
import process from "node:process";
import console from "node:console";
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { localEnvironment } from "./environment.mjs";
import { stopOwnedTree } from "./process.mjs";

const port = 3102;
const owner = "10000000-0000-4000-8000-000000000001";
const project = "20000000-0000-4000-8000-000000000001";
const person = { id: "30000000-0000-4000-8000-000000000001", project_id: project, name: "Synthetic person", kind: "fictional" };
const event = {
  id: "40000000-0000-4000-8000-000000000001", project_id: project, version: 1,
  title: "Synthetic event", description: "", location: "", date: { kind: "unknown" },
  start_date: null, end_date: null, person_ids: [person.id], category_ids: [],
};
const user = {
  id: owner, email: "fixture@example.invalid", email_confirmed_at: "2020-01-01T00:00:00Z",
  created_at: "2020-01-01T00:00:00Z", aud: "authenticated", role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
let unexpected = 0;
const provider = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  response.setHeader("Content-Type", "application/json");
  if (url.pathname === "/__test/state" && request.method === "GET") {
    response.end(JSON.stringify({ unexpected })); return;
  }
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password" && request.method === "POST") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    let payload;
    try { payload = JSON.parse(raw); } catch { payload = null; }
    if (payload?.email !== user.email || payload?.password !== "fixture-password-long") {
      response.writeHead(400); response.end(JSON.stringify({ code: "invalid_credentials", message: "Invalid login credentials" })); return;
    }
    response.end(JSON.stringify({ access_token: token, token_type: "bearer", expires_in: 3600, refresh_token: "fixture-refresh-token", user })); return;
  }
  if (url.pathname === "/auth/v1/user" && request.method === "GET" && request.headers.authorization === `Bearer ${token}`) {
    response.end(JSON.stringify(user)); return;
  }
  if (url.pathname === "/auth/v1/logout" && request.method === "POST") { response.writeHead(204); response.end(); return; }
  if (url.pathname === "/rest/v1/projects" && request.method === "GET" && request.headers.authorization === `Bearer ${token}`) {
    response.end(JSON.stringify([{ id: project, name: "Synthetic built project", hemisphere: "northern" }])); return;
  }
  if (["/auth/v1/signup", "/auth/v1/recover", "/auth/v1/resend", "/auth/v1/verify"].includes(url.pathname) && request.method === "POST") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const payload = JSON.parse(raw);
    if (payload.email === "rate-limit@example.invalid") {
      response.writeHead(429); response.end(JSON.stringify({ code: "over_email_send_rate_limit", message: "Synthetic rate limit" })); return;
    }
    response.end(JSON.stringify(url.pathname.endsWith("/verify")
      ? { access_token: token, token_type: "bearer", expires_in: 3600, refresh_token: "fixture-refresh-token", user }
      : url.pathname.endsWith("/signup") ? { user } : {})); return;
  }
  if (url.pathname === "/auth/v1/user" && request.method === "PUT") {
    response.end(JSON.stringify(user)); return;
  }
  if (url.pathname === "/rest/v1/people" && request.method === "GET") {
    response.end(JSON.stringify([person])); return;
  }
  if (url.pathname === "/rest/v1/categories" && request.method === "GET") {
    response.end(JSON.stringify([])); return;
  }
  if (url.pathname === "/rest/v1/events" && request.method === "GET") {
    response.end(JSON.stringify([event])); return;
  }
  if (["/rest/v1/rpc/create_project", "/rest/v1/rpc/add_person", "/rest/v1/rpc/save_event"].includes(url.pathname) && request.method === "POST") {
    response.end(JSON.stringify(url.pathname.endsWith("/create_project") ? { id: project }
      : url.pathname.endsWith("/add_person") ? person : { id: event.id, version: 1 })); return;
  }
  unexpected++;
  response.writeHead(500);
  response.end(JSON.stringify({ error: "Unhandled local provider fixture request" }));
});
provider.on("error", () => { console.error("Built fixture port is unavailable; no existing process was stopped."); process.exitCode = 1; });
await new Promise((resolve, reject) => {
  provider.once("error", reject);
  provider.listen(port, "127.0.0.1", resolve);
});
const env = localEnvironment({ lane: "built", providerOrigin: `http://127.0.0.1:${port}` });
const child = spawn(process.execPath, ["scripts/testing/serve.mjs", "built", `http://127.0.0.1:${port}`], { env, stdio: "inherit" });
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  stopOwnedTree(child);
  provider.close();
}
process.once("SIGINT", close);
process.once("SIGTERM", close);
child.once("error", () => { process.exitCode = 1; close(); });
child.once("exit", (code) => {
  if (!closing) process.exitCode = code || 1;
  if (unexpected) process.exitCode = 1;
  provider.close();
});
