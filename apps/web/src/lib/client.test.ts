import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { request, RequestError } from "./client";

const saved = z.object({ id: z.uuid(), version: z.number().int().positive() });
const acknowledgment = { id: "10000000-0000-4000-8000-000000000001", version: 2 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("same-origin browser requests", () => {
  it("uses explicit no-store JSON writes and returns only a validated acknowledgment", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(acknowledgment));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const input = { title: "Fictional departure", version: 1 };

    await expect(request("/api/projects/example/events", saved, input, controller.signal))
      .resolves.toEqual(acknowledgment);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/projects/example/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input), cache: "no-store", signal: controller.signal,
    });
  });

  it("preserves cancellation instead of reporting an uncertain network save", async () => {
    const aborted = new DOMException("Cancelled by navigation", "AbortError");
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(aborted);
    vi.stubGlobal("fetch", fetch);

    await expect(request("/api/session", saved)).rejects.toBe(aborted);
  });

  it("marks a real transport failure as unconfirmed, without silently retrying", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError("Fictional transport failure"));
    vi.stubGlobal("fetch", fetch);

    const result = request("/api/projects/example/events", saved, { title: "Fictional memory" });
    await expect(result).rejects.toBeInstanceOf(RequestError);
    await expect(result).rejects.toMatchObject({
      status: 0,
      message: "Connection lost. Your changes have not been confirmed. Reconnect and retry.",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 409, body: { error: "This event changed elsewhere." }, message: "This event changed elsewhere." },
    { status: 503, body: { message: "Fictional provider detail" }, message: "The request failed. Please retry." },
    { status: 429, body: { error: 429 }, message: "The request failed. Please retry." },
  ])("preserves HTTP $status with only a valid error message", async ({ status, body, message }) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status })));

    await expect(request("/api/projects", saved)).rejects.toMatchObject({ status, message });
  });

  it.each([200, 502])("never confirms malformed JSON at HTTP %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<html>Fictional gateway response</html>", { status }),
    ));

    await expect(request("/api/projects/example/events", saved, {})).rejects.toBeInstanceOf(SyntaxError);
  });

  it("rejects a successful HTTP response that does not contain a valid saved record", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ id: acknowledgment.id, version: "2", message: "Saved" }),
    ));

    await expect(request("/api/projects/example/events", saved, {})).rejects.toBeInstanceOf(z.ZodError);
  });

  it("does not turn a read into an empty JSON write", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(acknowledgment));
    vi.stubGlobal("fetch", fetch);

    await request("/api/projects", saved);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/projects", {
      method: "GET", headers: undefined, body: undefined, cache: "no-store", signal: undefined,
    });
  });
});
