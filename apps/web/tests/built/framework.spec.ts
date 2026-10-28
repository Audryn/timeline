import { expect, test } from "@playwright/test";

test.afterEach(async ({ request }) => {
  const fixture = await request.get("http://127.0.0.1:3102/__test/state");
  expect(await fixture.json()).toEqual({ unexpected: 0 });
});

test("production HTML has per-request nonces, private headers and functioning hydration", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  const first = await request.get("/");
  const second = await request.get("/");
  expect(first.headers()["cache-control"]).toContain("no-store");
  const nonce = first.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
  const nextNonce = second.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy(); expect(nextNonce).toBeTruthy(); expect(nextNonce).not.toBe(nonce);
  expect(await first.text()).toContain(`nonce="${nonce}"`);
  expect(first.headers()["content-security-policy"]).not.toContain("unsafe-eval");
  await page.goto("/account?mode=signin");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("actual Next HTTP handlers issue protected cookies and read them with a request-local provider client", async ({ request }) => {
  const login = await request.post("/api/auth/signin", {
    headers: { Origin: "http://127.0.0.1:3101" },
    data: { email: "fixture@example.invalid", password: "fixture-password-long" },
  });
  expect(login.status()).toBe(200);
  const cookies = login.headersArray().filter((header) => header.name.toLowerCase() === "set-cookie");
  expect(cookies.length).toBeGreaterThan(0);
  for (const cookie of cookies) {
    expect(cookie.value).toMatch(/httponly/i);
    expect(cookie.value).toMatch(/secure/i);
    expect(cookie.value).toMatch(/samesite=lax/i);
  }
  // HTTP cannot prove browser Secure-cookie delivery; replay only synthetic fixture cookies to test Next's request boundary.
  const cookie = cookies.map((header) => header.value.split(";")[0]).join("; ");
  const signedIn = await request.get("/api/session", { headers: { Cookie: cookie } });
  expect(await signedIn.json()).toMatchObject({ configured: true, user: { id: "10000000-0000-4000-8000-000000000001" } });
  const own = await request.get("/api/projects", { headers: { Cookie: cookie } });
  expect(own.status()).toBe(200);
  expect(await own.json()).toEqual([{ id: "20000000-0000-4000-8000-000000000001", name: "Synthetic built project", hemisphere: "northern" }]);
});

test("actual HTTP write validation rejects missing/foreign origin before authentication", async ({ request }) => {
  for (const origin of [undefined, "https://foreign.example.invalid"]) {
    const response = await request.post("/api/projects", {
      headers: origin ? { Origin: origin } : {}, data: {},
    });
    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
