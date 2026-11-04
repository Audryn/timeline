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

it("keeps phone signup on the code step after a failed verification and resends only on request", async () => {
  const pending = Promise.withResolvers<Response>();
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ configured: true, user: null }))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(Response.json({ error: "The code has expired. Request a new text." }, { status: 400 }))
    .mockResolvedValueOnce(Response.json({ message: "If eligible, a text message is on its way." }));
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<AccountForm mode="signup" phoneEnabled />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement).disabled).toBe(false));
  await user.selectOptions(screen.getByLabelText("Use email or phone"), "phone");
  await user.type(screen.getByLabelText("Phone number"), "+15555550123");
  await user.type(screen.getByLabelText("Password"), "fictional-test-password");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(screen.queryByLabelText("SMS confirmation code")).toBeNull();
  expect(screen.getByLabelText("Phone number").closest("fieldset")?.disabled).toBe(true);
  pending.resolve(Response.json({ message: "Check your text messages." }));
  const code = await screen.findByLabelText("SMS confirmation code");
  await waitFor(() => expect(document.activeElement).toBe(code));
  expect(fetch.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ phone: "+15555550123", password: "fictional-test-password" }));
  expect(screen.queryByLabelText("Password")).toBeNull();
  await user.type(code, "123456");
  await user.click(screen.getByRole("button", { name: "Verify phone number" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("expired");
  expect(alert.parentElement).toBe(document.activeElement);
  expect(fetch.mock.calls[2]?.[0]).toBe("/api/auth/verify-phone");
  expect(fetch.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ phone: "+15555550123", token: "123456" }));
  expect((code as HTMLInputElement).value).toBe("123456");
  expect(fetch).toHaveBeenCalledTimes(3);
  await user.click(screen.getByRole("button", { name: "Send another text message" }));
  await waitFor(() => expect((code as HTMLInputElement).value).toBe(""));
  expect(fetch.mock.calls[3]?.[0]).toBe("/api/auth/resend");
  expect(fetch.mock.calls[3]?.[1]?.body).toBe(JSON.stringify({ phone: "+15555550123" }));
  await user.click(screen.getByRole("button", { name: "Change phone number" }));
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Phone number") as HTMLInputElement).value).toBe("+15555550123");
});

it("requests phone recovery without a password and retains phone method in navigation links", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ configured: true, user: null }))
    .mockResolvedValueOnce(Response.json({ message: "If eligible, a text message is on its way." }));
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<AccountForm mode="reset" phoneEnabled initialMethod="phone" />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Send reset text" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByLabelText("Password")).toBeNull();
  await user.type(screen.getByLabelText("Phone number"), "+15555550123");
  await user.click(screen.getByRole("button", { name: "Send reset text" }));
  expect(await screen.findByLabelText("SMS confirmation code")).toBeTruthy();
  expect(fetch.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ phone: "+15555550123" }));
  expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/account?mode=signin&method=phone");
});

it("keeps email as the only method when phone authentication is disabled", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ configured: true, user: null })));
  render(<AccountForm mode="signup" initialMethod="phone" />);
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.queryByLabelText("Phone number")).toBeNull();
  expect(screen.queryByLabelText("Use email or phone")).toBeNull();
  await screen.findByRole("button", { name: "Create account" });
});
