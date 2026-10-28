import { describe, expect, it } from "vitest";
import { deploymentConfig, requestPolicy } from "../../scripts/testing/deployed-policy.mjs";

const approved = { TIMELINE_DEPLOYED_ORIGIN: "https://timeline.example.invalid", TIMELINE_APPROVED_ORIGIN: "https://timeline.example.invalid" };
const credentials = {
  ...approved, TIMELINE_ALLOW_SYNTHETIC_AUTH: "yes",
  TIMELINE_SYNTHETIC_EMAIL: "synthetic@example.invalid", TIMELINE_SYNTHETIC_PASSWORD: "fixture-only",
  TIMELINE_SYNTHETIC_OWNER_ID: "10000000-0000-4000-8000-000000000001",
  TIMELINE_SYNTHETIC_PROJECT_ID: "20000000-0000-4000-8000-000000000001",
};
describe("production probe guard (no network)", () => {
  it("fails closed for missing target/approval, non-HTTPS, mismatched origins, or credential-bearing URLs", () => {
    for (const env of [{}, { ...approved, TIMELINE_APPROVED_ORIGIN: "" }, { ...approved, TIMELINE_DEPLOYED_ORIGIN: "http://timeline.example.invalid" }, { ...approved, TIMELINE_DEPLOYED_ORIGIN: "https://other.example.invalid" }, { ...approved, TIMELINE_DEPLOYED_ORIGIN: "https://user:pass@timeline.example.invalid" }]) {
      expect(() => deploymentConfig(env, "public")).toThrow();
    }
  });
  it("requires separate explicit credentials and pinned identities for synthetic reads", () => {
    expect(() => deploymentConfig(approved, "read")).toThrow();
    expect(deploymentConfig(credentials, "read").projectId).toBe(credentials.TIMELINE_SYNTHETIC_PROJECT_ID);
    expect(() => deploymentConfig(credentials, "unknown")).toThrow();
  });
  it("public mode cannot send mail, consume callbacks, sign in, or read private records", () => {
    const allow = requestPolicy(deploymentConfig(approved, "public"));
    allow("GET", "/"); allow("GET", "/api/session"); allow("GET", "/account?mode=signin");
    for (const [method, path] of [["POST", "/api/auth/reset"], ["POST", "/api/auth/signup"], ["POST", "/api/auth/signin"], ["GET", "/api/auth/callback?token_hash=fixture"], ["GET", "/api/projects"]]) {
      expect(() => allow(method, path)).toThrow();
    }
  });
  it("synthetic mode permits one signin/signout and approved project reads only", () => {
    const allow = requestPolicy(deploymentConfig(credentials, "read"));
    allow("POST", "/api/auth/signin");
    allow("GET", `/api/projects/${credentials.TIMELINE_SYNTHETIC_PROJECT_ID}/events?offset=0&undated=true`);
    allow("POST", "/api/auth/signout");
    expect(() => allow("POST", "/api/auth/signin")).toThrow();
    expect(() => allow("POST", "/api/auth/signout")).toThrow();
    for (const [method, path] of [["POST", `/api/projects/${credentials.TIMELINE_SYNTHETIC_PROJECT_ID}/events`], ["DELETE", "/api/projects"], ["GET", "/api/projects/30000000-0000-4000-8000-000000000001"], ["GET", `/api/projects/${credentials.TIMELINE_SYNTHETIC_PROJECT_ID}/events?offset=50`], ["GET", "https://unapproved.example.invalid/"]]) {
      expect(() => allow(method, path)).toThrow();
    }
  });
  it("bounds requests and refuses unexpected read parameters", () => {
    const allow = requestPolicy(deploymentConfig(approved, "public"));
    expect(() => allow("GET", "/api/session?token=unexpected")).toThrow();
    for (let index = 0; index < 99; index++) allow("GET", "/api/session");
    expect(() => allow("GET", "/api/session")).toThrow();
  });
});
