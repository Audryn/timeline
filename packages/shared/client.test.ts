import { afterEach, expect, it, vi } from "vitest";
import { createApiClient, RequestError } from "./client";
import type { EventInput } from "./models";

afterEach(() => vi.unstubAllGlobals());

it("keeps explicit uncertain-save retries identical through the typed client", async () => {
  const payload: EventInput = {
    requestId: "10000000-0000-4000-8000-000000000001",
    id: "20000000-0000-4000-8000-000000000001", version: 3,
    title: "Fictional harbour", description: "", location: "",
    date: { kind: "unknown" }, personIds: ["30000000-0000-4000-8000-000000000001"], categoryIds: [],
  };
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockRejectedValueOnce(new TypeError("Connection interrupted"))
    .mockResolvedValueOnce(Response.json({ id: payload.id, version: 4 }));
  const client = createApiClient({ fetch, baseUrl: "https://timeline.example.test" });
  await expect(client.saveEvent(payload.id, payload)).rejects.toMatchObject({ status: 0 });
  expect(fetch).toHaveBeenCalledTimes(1);
  await expect(client.saveEvent(payload.id, payload)).resolves.toEqual({ id: payload.id, version: 4 });
  expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1]);
});

it("preserves repeated filter parameters and forwards cancellation", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ events: [], hasMore: false }));
  const client = createApiClient({ fetch });
  const params = new URLSearchParams([["person", "a"], ["person", "b"], ["offset", "50"]]);
  const controller = new AbortController();
  await client.events("project", params, controller.signal);
  expect(fetch).toHaveBeenCalledWith("/api/projects/project/events?person=a&person=b&offset=50",
    expect.objectContaining({ method: "GET", signal: controller.signal, cache: "no-store" }));
});

it("preserves account-specific malformed-response and HTTP error feedback", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response("not JSON", { status: 502 }))
    .mockResolvedValueOnce(Response.json({ error: "Wait before requesting another email." }, { status: 429 }));
  const client = createApiClient({ fetch });
  await expect(client.account("reset", { email: "fictional@example.test" }))
    .rejects.toThrow("Timeline returned an unreadable response. Please try again.");
  const result = client.account("reset", { email: "fictional@example.test" });
  await expect(result).rejects.toBeInstanceOf(RequestError);
  await expect(result).rejects.toMatchObject({ status: 429, message: "Wait before requesting another email." });
  expect(fetch).toHaveBeenCalledTimes(2);
});
