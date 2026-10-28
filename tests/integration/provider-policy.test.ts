import { describe, expect, it } from "vitest";
import { captureLink, localProviderOrigin, providerSettings } from "../../scripts/testing/provider-policy.mjs";

describe("disposable provider containment", () => {
  it("only accepts loopback API and mail-capture origins", () => {
    expect(localProviderOrigin("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
    for (const value of ["https://real-project.supabase.co", "http://example.invalid", "http://127.0.0.1:54321/path", "http://user:password@localhost:54321", "http://localhost:54321?token=fixture"]) {
      expect(() => localProviderOrigin(value)).toThrow();
    }
  });
  it("keeps fixture-controller credentials separate and rejects incomplete stack status", () => {
    const status = { API_URL: "http://127.0.0.1:54321", INBUCKET_URL: "http://127.0.0.1:54324", ANON_KEY: "local-public", SERVICE_ROLE_KEY: "local-controller" };
    expect(providerSettings(status).publicKey).toBe("local-public");
    expect(providerSettings(status).adminKey).toBe("local-controller");
    expect(() => providerSettings({ ...status, API_URL: "https://real-project.supabase.co" })).toThrow();
    expect(() => providerSettings({ ...status, SERVICE_ROLE_KEY: "" })).toThrow();
  });
  it("only extracts the app callback and expected verification type from captured synthetic mail", () => {
    const origin = "http://127.0.0.1:3100";
    expect(captureLink(`<a href="${origin}/api/auth/callback?token_hash=fixture&amp;type=signup">Confirm</a>`, origin, "signup"))
      .toBe(`${origin}/api/auth/callback?token_hash=fixture&type=signup`);
    expect(() => captureLink(`https://unapproved.invalid/api/auth/callback?token_hash=fixture&type=signup`, origin, "signup")).toThrow();
    expect(() => captureLink(`${origin}/api/auth/callback?token_hash=fixture&type=recovery`, origin, "signup")).toThrow();
  });
});
