import { glob, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { expect, test, type APIResponse } from "@playwright/test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { z } from "zod";
import { authActionSchema } from "@timeline/shared";

const origin = "http://127.0.0.1:3101";
const project = "20000000-0000-4000-8000-000000000001";
const person = "30000000-0000-4000-8000-000000000001";
const event = "40000000-0000-4000-8000-000000000001";
const documentSchema = z.object({
  components: z.object({ schemas: z.record(z.string(), z.record(z.string(), z.unknown())) }),
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
});
const responseSchema = z.object({
  content: z.object({ "application/json": z.object({ schema: z.record(z.string(), z.unknown()) }) }).optional(),
});
const operationSchema = z.object({ responses: z.record(z.string(), responseSchema) });

test("every documented operation matches actual Next HTTP responses and error contracts", async ({ request }) => {
  const document = documentSchema.parse(parse(await readFile(new URL("../../../../docs/openapi.yaml", import.meta.url), "utf8")));
  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const implemented: string[] = [];
  for await (const file of glob("src/app/api/**/route.ts", { cwd: appRoot })) {
    const source = await readFile(join(appRoot, file), "utf8");
    const path = file.replaceAll("\\", "/").replace(/^src\/app/, "").replace(/\/route.ts$/, "").replace("[id]", "{id}");
    const paths = path.includes("[action]") ? authActionSchema.options.map(action => path.replace("[action]", action)) : [path];
    for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
      implemented.push(...paths.map(path => `${match[1].toLowerCase()} ${path}`));
    }
  }
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const covered = new Set<string>();
  async function check(path: string, method: "get" | "post", response: APIResponse, expectedStatus = 200) {
    expect(response.status(), `${method} ${path}`).toBe(expectedStatus);
    const operation = operationSchema.parse(document.paths[path][method]);
    const spec = operation.responses[String(expectedStatus)];
    expect(spec, `undocumented HTTP ${expectedStatus} for ${path}`).toBeDefined();
    if (spec.content) {
      const validate = ajv.compile({ ...spec.content["application/json"].schema, components: document.components });
      expect(validate(await response.json()), JSON.stringify(validate.errors)).toBe(true);
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
    covered.add(`${method} ${path}`);
  }
  const headers = { Origin: origin };
  await check("/api/session", "get", await request.get("/api/session"));
  await check("/api/projects", "get", await request.get("/api/projects"), 401);
  const login = await request.post("/api/auth/signin", {
    headers, data: { email: "fixture@example.invalid", password: "fixture-password-long" },
  });
  await check("/api/auth/signin", "post", login);
  const cookie = login.headersArray().filter(h => h.name.toLowerCase() === "set-cookie")
    .map(h => h.value.split(";")[0]).join("; ");
  expect(cookie).not.toBe("");
  const authenticated = { ...headers, Cookie: cookie };
  await check("/api/projects", "get", await request.get("/api/projects", { headers: authenticated }));
  await check("/api/projects", "post", await request.post("/api/projects", { headers: authenticated, data: {
    requestId: crypto.randomUUID(), name: "Synthetic project", personName: "Synthetic person",
    personKind: "fictional", hemisphere: "northern",
  } }));
  await check("/api/projects/{id}", "get", await request.get(`/api/projects/${project}`, { headers: authenticated }));
  await check("/api/projects/{id}/people", "post", await request.post(`/api/projects/${project}/people`, {
    headers: authenticated, data: { requestId: crypto.randomUUID(), name: "Synthetic person", kind: "fictional" },
  }));
  await check("/api/projects/{id}/events", "get", await request.get(`/api/projects/${project}/events`, { headers: authenticated }));
  await check("/api/projects/{id}/events", "post", await request.post(`/api/projects/${project}/events`, {
    headers: authenticated, data: {
      requestId: crypto.randomUUID(), id: event, version: 0, title: "Synthetic event",
      description: "", location: "", date: { kind: "unknown" }, personIds: [person], categoryIds: [],
    },
  }));
  for (const action of ["signup", "reset", "resend", "password"] as const) {
    const data = action === "signup" ? { email: "fixture@example.invalid", password: "fixture-password-long" }
      : action === "password" ? { password: "fixture-password-long" } : { email: "fixture@example.invalid" };
    await check(`/api/auth/${action}`, "post", await request.post(`/api/auth/${action}`, { headers: authenticated, data }));
  }
  const callback = await request.get("/api/auth/callback?token_hash=synthetic-fixture-token&type=recovery", { maxRedirects: 0 });
  await check("/api/auth/callback", "get", callback, 307);
  expect(callback.headers().location).toBe(`${origin}/account?mode=password`);
  expect(callback.headers()["referrer-policy"]).toBe("same-origin");
  await check("/api/auth/signout", "post", await request.post("/api/auth/signout", { headers: authenticated, data: {} }));
  await check("/api/projects", "post", await request.post("/api/projects", { headers: authenticated, data: {} }), 400);
  await check("/api/projects", "post", await request.post("/api/projects", { headers: { Origin: "https://foreign.example.invalid" }, data: {} }), 403);
  await check("/api/auth/reset", "post", await request.post("/api/auth/reset", {
    headers, data: { email: "rate-limit@example.invalid" },
  }), 429);
  const expected = Object.entries(document.paths).flatMap(([path, item]) =>
    Object.keys(item).filter(method => ["get", "post"].includes(method)).map(method => `${method} ${path}`));
  expect([...covered].sort()).toEqual(expected.sort());
  expect(implemented.sort()).toEqual(expected.sort());
  const fixture = await request.get("http://127.0.0.1:3102/__test/state");
  expect(await fixture.json()).toEqual({ unexpected: 0 });
});
