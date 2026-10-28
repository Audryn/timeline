// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import AccountForm from "./account-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("disables pending email requests and focuses a rate-limit error before an explicit successful retry", async () => {
  const pending = Promise.withResolvers<Response>();
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ configured: true, user: null }))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(Response.json({ message: "If eligible, reset instructions are on their way." }));
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<AccountForm mode="reset" />);

  const submit = screen.getByRole("button", { name: "Send reset email" });
  await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
  await user.type(screen.getByRole("textbox", { name: "Email address" }), "fictional@example.test");
  await user.click(submit);

  const busy = screen.getByRole("button", { name: "Sending reset email…" });
  expect((busy as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("textbox", { name: "Email address" }).closest("fieldset")?.disabled).toBe(true);
  expect(screen.queryByRole("heading", { name: "Check your inbox." })).toBeNull();
  await user.click(busy);
  expect(fetch).toHaveBeenCalledTimes(2);

  pending.resolve(Response.json({ error: "Please wait before requesting another email." }, { status: 429 }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("Please wait before requesting another email.");
  expect(alert.parentElement).toBe(document.activeElement);
  expect((screen.getByRole("textbox", { name: "Email address" }) as HTMLInputElement).value)
    .toBe("fictional@example.test");
  expect(screen.queryByRole("heading", { name: "Check your inbox." })).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);

  await user.click(screen.getByRole("button", { name: "Send reset email" }));
  expect(await screen.findByRole("heading", { name: "Check your inbox." })).toBeTruthy();
  const status = screen.getByRole("status");
  expect(status.textContent).toBe("If eligible, reset instructions are on their way.");
  expect(status.parentElement).toBe(document.activeElement);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(fetch).toHaveBeenLastCalledWith("/api/auth/reset", {
    cache: "no-store", credentials: "same-origin", method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "fictional@example.test" }),
  });
});
