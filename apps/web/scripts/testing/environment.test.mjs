import { expect, test } from "vitest";
import { localEnvironment } from "./environment.mjs";
import { assertLocalDestination } from "./network-guard.mjs";

test("local fixture identity ignores inherited hosted and malformed provider settings", () => {
  const inherited = {
    PATH: "preserved",
    APP_ORIGIN: "https://not-timeline.example",
    PHONE_AUTH_ENABLED: "unexpected",
    SUPABASE_URL: "https://not-a-fixture.example",
    SUPABASE_PUBLISHABLE_KEY: "not-a-fixture-key",
    SUPABASE_SERVICE_ROLE_KEY: "must-not-reach-tests",
    NEXT_PUBLIC_SUPABASE_URL: "https://also-not-a-fixture.example",
    NODE_OPTIONS: "--require=untrusted-bootstrap",
    TIMELINE_TEST_MODE: "arbitrary-source-path",
    HTTPS_PROXY: "https://not-a-fixture.example",
    TIMELINE_PROVIDER_ADMIN_KEY: "controller-only",
    TIMELINE_PROVIDER_MAIL_ORIGIN: "https://not-a-fixture.example",
  };
  const clean = localEnvironment({ lane: "browser" }, {});
  const polluted = localEnvironment({ lane: "browser" }, inherited);
  for (const name of ["APP_ORIGIN", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL", "NODE_OPTIONS", "TIMELINE_TEST_MODE", "NODE_ENV", "PHONE_AUTH_ENABLED"]) {
    expect(polluted[name]).toBe(clean[name]);
  }
  expect(polluted.HTTPS_PROXY).toBe("");
  expect(polluted.TIMELINE_PROVIDER_ADMIN_KEY).toBe("");
  expect(polluted.TIMELINE_PROVIDER_MAIL_ORIGIN).toBe("");
  expect(polluted.PATH).toBe("preserved");
  expect(inherited.SUPABASE_PUBLISHABLE_KEY).toBe("not-a-fixture-key");
});

test("only the production built lane accepts an explicit loopback provider fixture", () => {
  expect(localEnvironment({ lane: "built", providerOrigin: "http://127.0.0.1:3199" }, {}))
    .toMatchObject({ SUPABASE_URL: "http://127.0.0.1:3199", NODE_ENV: "production" });
  for (const providerOrigin of ["https://not-a-fixture.example", "http://localhost:3199",
    "http://127.0.0.1", "http://127.0.0.1:3199/rest/v1", "http://user:password@127.0.0.1:3199"]) {
    expect(() => localEnvironment({ lane: "built", providerOrigin }, {})).toThrow();
  }
  expect(() => localEnvironment({ lane: "browser", providerOrigin: "http://127.0.0.1:3199" }, {})).toThrow();
  expect(() => localEnvironment({ lane: "deployed" }, {})).toThrow();
});

test("local network guard rejects external fetch and socket destinations before connecting", () => {
  expect(() => assertLocalDestination("127.0.0.1")).not.toThrow();
  expect(() => assertLocalDestination("::1")).not.toThrow();
  expect(() => assertLocalDestination("127.0.0.1.not-local.example")).toThrow(/non-loopback/);
  expect(() => globalThis.fetch("https://not-a-fixture.example/private")).toThrow(/non-loopback/);
});
