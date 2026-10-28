import { describe, expect, it } from "vitest";
import { localEnvironment } from "./environment.mjs";

describe("hosted synthetic credentials never enter the local loop", () => {
  it("scrubs the entire Timeline family before resetting explicit local settings", () => {
    const env = localEnvironment({ lane: "unit" }, {
      TIMELINE_SYNTHETIC_EMAIL: "private-fixture@example.invalid",
      TIMELINE_SYNTHETIC_PASSWORD: "hosted-secret-fixture",
      TIMELINE_SYNTHETIC_OWNER_ID: "hosted-owner",
      TIMELINE_APPROVED_ORIGIN: "https://approved.example.invalid",
      TIMELINE_ALLOW_SYNTHETIC_AUTH: "yes",
      TIMELINE_FUTURE_CREDENTIAL: "must-not-inherit",
      SUPABASE_ACCESS_TOKEN: "hosted-secret-fixture",
    });
    for (const name of ["TIMELINE_SYNTHETIC_EMAIL", "TIMELINE_SYNTHETIC_PASSWORD", "TIMELINE_SYNTHETIC_OWNER_ID", "TIMELINE_APPROVED_ORIGIN", "TIMELINE_ALLOW_SYNTHETIC_AUTH", "TIMELINE_FUTURE_CREDENTIAL", "SUPABASE_ACCESS_TOKEN"]) {
      expect(env[name]).toBe("");
    }
    expect(env.TIMELINE_TEST_LANE).toBe("unit");
    expect(env.APP_ORIGIN).toBe("http://127.0.0.1:3100");
  });
});
