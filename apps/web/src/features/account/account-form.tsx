"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiClient, message as errorMessage, type AccountAction, type ConnectionState, type Session } from "@timeline/shared";
import { Button, RequestFeedback } from "@/components/ui";
import { useRequestState } from "@/lib/use-request-state";
import styles from "./account.module.css";

export type AccountMode = Exclude<AccountAction, "verify-phone">;
type ContactMethod = "email" | "phone";

const copy = {
  signup: {
    label: "Account setup",
    title: "A home for your stories.",
    description: "Create your private account. Your first chapter starts here.",
    submit: "Create account",
    busy: "Creating account…",
  },
  signin: {
    label: "Welcome back",
    title: "Your stories are waiting.",
    description: "Sign in to return to your projects and pick up where you left off.",
    submit: "Sign in",
    busy: "Signing in…",
  },
  reset: {
    label: "A fresh start",
    title: "Forgot your password?",
    description: "Enter your email and we’ll send instructions for choosing a new password.",
    submit: "Send reset email",
    busy: "Sending reset email…",
  },
  resend: {
    label: "Email confirmation",
    title: "Need a new link?",
    description: "Enter the email you used to sign up to request another confirmation link.",
    submit: "Resend confirmation email",
    busy: "Sending confirmation…",
  },
  password: {
    label: "Account recovery",
    title: "Turn a new page.",
    description: "Choose a new password for your Timeline account.",
    submit: "Save new password",
    busy: "Saving password…",
  },
} satisfies Record<AccountMode, {
  label: string;
  title: string;
  description: string;
  submit: string;
  busy: string;
}>;

function continueToProjects(destination = "/projects") {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("timeline-account");
      try {
        channel.postMessage("changed");
      } finally {
        channel.close();
      }
    }
  } catch (error) {
    console.warn("Unable to notify other Timeline tabs.", {
      type: error instanceof Error ? error.name : typeof error,
    });
  }
  window.location.assign(destination);
}

export default function AccountForm({
  mode,
  notice,
  phoneEnabled = false,
  initialMethod = "email",
}: {
  mode: AccountMode;
  notice?: "expired" | "failed";
  phoneEnabled?: boolean;
  initialMethod?: ContactMethod;
}) {
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<ContactMethod>(phoneEnabled ? initialMethod : "email");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const { busy, setBusy, error, setError } = useRequestState();
  const [step, setStep] = useState<"form" | "verify" | "email-sent" | "sms-sent">("form");
  const [message, setMessage] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);
  const isPhone = method === "phone";
  const contact = isPhone ? { phone } : { email };
  const content = isPhone && (mode === "reset" || mode === "resend")
    ? { ...copy[mode],
      label: mode === "reset" ? "A fresh start" : "Phone confirmation",
      title: mode === "reset" ? "Forgot your password?" : "Need a new code?",
      description: mode === "reset"
        ? "Enter your phone number. Verify the text-message code to choose a new password."
        : "Enter the phone number you used to sign up to request another confirmation code.",
      submit: mode === "reset" ? "Send reset text" : "Send confirmation text",
      busy: "Sending text message…",
    } : copy[mode];
  const accountLink = (nextMode: AccountMode) => `/account?mode=${nextMode}${isPhone ? "&method=phone" : ""}`;
  const needsPassword = mode === "signup" || mode === "signin" || mode === "password";
  const passwordSessionMissing = mode === "password" && connection === "ready" && !session?.user;
  const disabled = busy || connection !== "ready" || passwordSessionMissing;

  useEffect(() => {
    if (step === "sms-sent" && !busy && !error) tokenRef.current?.focus();
  }, [step, busy, error]);

  useEffect(() => {
    const controller = new AbortController();
    apiClient.accountSession(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setSession(result);
        setConnection(result.configured ? "ready" : "setup");
      },
      (failure: unknown) => {
        if (controller.signal.aborted) return;
        setConnectionError(errorMessage(failure));
        setConnection("error");
      },
    );
    return () => controller.abort();
  }, []);

  async function retryConnection() {
    setConnection("checking");
    setConnectionError("");
    try {
      const result = await apiClient.accountSession();
      setSession(result);
      setConnection(result.configured ? "ready" : "setup");
    } catch (failure) {
      setConnectionError(errorMessage(failure));
      setConnection("error");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setBusy(true);
    setError("");
    setMessage("");
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    setEmail(normalizedEmail);
    setPhone(normalizedPhone);
    try {
      const normalizedContact = isPhone ? { phone: normalizedPhone } : { email: normalizedEmail };
      const fields =
        mode === "password"
          ? { password }
          : needsPassword
            ? { ...normalizedContact, password }
            : normalizedContact;
      const result = await apiClient.account(mode, fields);
      setPassword("");
      if (mode === "signin" || mode === "password") {
        continueToProjects();
        return;
      }
      setMessage(result);
      setStep(isPhone ? "sms-sent" : mode === "signup" ? "verify" : "email-sent");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiClient.account("verify-phone", { phone, token });
      setToken("");
      continueToProjects(mode === "reset" ? "/account?mode=password" : "/projects");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function sendAgain() {
    if (disabled) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const action = mode === "reset" ? "reset" : "resend";
      setMessage(await apiClient.account(action, contact));
      if (isPhone) setToken("");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function changeContact() {
    setStep("form");
    setMessage("");
    setError("");
    setPassword("");
    setToken("");
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  function changeMethod(next: ContactMethod) {
    setMethod(next);
    setPassword("");
    setToken("");
    setMessage("");
    setError("");
  }

  return (
    <>
      <p className={styles.eyebrow}>{step === "form" ? content.label : isPhone ? "Phone confirmation" : "Check your email"}</p>
      {step !== "form" && !isPhone && (
        <div className={styles.mailIcon} aria-hidden="true">
          <svg width="30" height="26" viewBox="0 0 30 26" fill="none">
            <rect x="2" y="4" width="26" height="19" rx="3" />
            <path d="m3 6 12 9L27 6" />
          </svg>
        </div>
      )}
      <h1 className={styles.title}>
        {step === "form" ? content.title : isPhone ? "Check your text messages." : "Check your inbox."}
      </h1>
      <p className={styles.description}>
        {step === "form"
          ? content.description
          : isPhone
            ? "Enter the six-digit code sent to your phone. Sending a text does not confirm your account."
          : step === "verify"
            ? "Open the confirmation link sent to your email to confirm your account."
            : "If this address is eligible, an email is on its way. Check your inbox and spam folder."}
      </p>

      {notice && (
        <div className={styles.warning} role="alert">
          <strong>
            {notice === "expired" ? "This email link is invalid or has expired." : "We couldn’t confirm that email link."}
          </strong>
          <p>
            Request a fresh{" "}
            <Link href="/account?mode=resend">confirmation email</Link> or{" "}
            <Link href="/account?mode=reset">password reset link</Link>.
          </p>
        </div>
      )}

      <div aria-live="polite">
        {connection === "checking" && (
          <p className={styles.connectionNote} role="status">Checking account availability…</p>
        )}
        {connection === "setup" && (
          <div className={styles.warning}>
            <strong>Account setup required</strong>
            <p>
              Accounts are not configured on this installation. Follow the README
              setup instructions, then reload this page. No account has been
              created and nothing has been submitted.
            </p>
          </div>
        )}
        {connection === "error" && (
          <div className={styles.warning}>
            <strong>Account service unavailable</strong>
            <p>{connectionError}</p>
            <Button type="button" className={styles.textButton} onClick={retryConnection}>
              Try connecting again
            </Button>
          </div>
        )}
      </div>

      {session?.user && mode !== "password" && step === "form" && (
        <div className={styles.information}>
          Signed in as <strong>{session.user.email || session.user.phone}</strong>.{" "}
          <Link href="/projects">Continue to your workspace</Link>.
        </div>
      )}
      {passwordSessionMissing && (
        <div className={styles.warning} role="alert">
          <strong>A valid recovery session is required.</strong>
          <p>
            Open your password reset email link or verify your SMS recovery code.{" "}
            <Link href="/account?mode=reset">Request password recovery</Link>.
          </p>
        </div>
      )}

      {step === "form" ? (
        <form onSubmit={handleSubmit} className={styles.form} aria-busy={busy}>
          <fieldset disabled={busy} className={styles.fields}>
            {mode !== "password" && (
              <>
                {phoneEnabled && (
                  <div className={styles.field}>
                    <label htmlFor="account-method">Use email or phone</label>
                    <select id="account-method" value={method} onChange={(event) => changeMethod(event.target.value === "phone" ? "phone" : "email")}>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                    </select>
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor="account-email">{isPhone ? "Phone number" : "Email address"}</label>
                  <input
                    ref={emailRef}
                    id="account-email"
                    name={method}
                    type={isPhone ? "tel" : "email"}
                    autoComplete={isPhone ? "tel" : "email"}
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={isPhone ? 16 : 254}
                    pattern={isPhone ? "\\+[1-9][0-9]{1,14}" : undefined}
                    aria-describedby={isPhone ? "phone-guidance" : undefined}
                    placeholder={isPhone ? "+15555550123" : "you@example.com"}
                    value={isPhone ? phone : email}
                    onChange={(event) => isPhone ? setPhone(event.target.value) : setEmail(event.target.value)}
                    required
                  />
                  {isPhone && (
                    <p id="phone-guidance" className={styles.fieldHint}>Include +country code and digits only. Text-message charges may apply.</p>
                  )}
                </div>
              </>
            )}
            {needsPassword && (
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="account-password">
                    {mode === "password" ? "New password" : "Password"}
                  </label>
                  {mode === "signin" && (
                    <Link href={accountLink("reset")}>Forgot password?</Link>
                  )}
                </div>
                <input
                  id="account-password"
                  name="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={mode === "signin" ? 1 : 12}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={mode !== "signin" ? "password-guidance" : undefined}
                  required
                />
                {mode !== "signin" && (
                  <p id="password-guidance" className={styles.fieldHint}>
                    Use 12–128 characters. A few memorable words work well.
                  </p>
                )}
              </div>
            )}
          </fieldset>
          <RequestFeedback error={error} message={message} className={styles.feedback} errorClassName={styles.error} messageClassName={styles.information} />
          <Button type="submit" disabled={disabled} busy={busy} className={styles.primaryButton}>
            {busy ? content.busy : content.submit}
            {!busy && <span aria-hidden="true">→</span>}
          </Button>
        </form>
      ) : step === "sms-sent" ? (
        <form onSubmit={verifyPhone} className={styles.form} aria-busy={busy}>
          <p className={styles.emailAddress}>{phone}</p>
          {message && <p role="status" className={styles.information}>{message}</p>}
          <fieldset disabled={busy} className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="account-code">SMS confirmation code</label>
              <input ref={tokenRef} id="account-code" name="token" type="text" inputMode="numeric"
                autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6}
                value={token} onChange={(event) => setToken(event.target.value)} required />
            </div>
          </fieldset>
          <RequestFeedback error={error} message="" className={styles.feedback} errorClassName={styles.error} messageClassName={styles.information} />
          <Button type="submit" disabled={disabled} busy={busy} className={styles.primaryButton}>
            {busy ? "Verifying code…" : "Verify phone number"}
          </Button>
          <Button type="button" className={styles.secondaryButton} disabled={disabled} onClick={sendAgain}>
            {busy ? "Please wait…" : "Send another text message"}
          </Button>
          <Button type="button" className={styles.changeEmail} disabled={busy} onClick={changeContact}>
            Change phone number
          </Button>
        </form>
      ) : (
        <div className={styles.emailInstructions} aria-busy={busy}>
          <p className={styles.emailAddress}>{email}</p>
          <RequestFeedback error={error} message={message} className={styles.feedback} errorClassName={styles.error} messageClassName={styles.information} />
          <p className={styles.fieldHint}>
            {step === "verify"
              ? "Follow the email link to continue. Timeline checks confirmation on the server before opening your projects; creating an account or resending a link does not confirm your email."
              : mode === "reset"
                ? "Open the email link to choose a new password. Request a fresh link if the previous one has expired."
                : "Follow the confirmation link, then sign in if asked. Sending an email does not confirm the account."}
          </p>
          <Button type="button" className={styles.secondaryButton} disabled={disabled} onClick={sendAgain}>
            {busy ? "Sending email…" : mode === "reset" ? "Send another reset email" : "Resend confirmation email"}
          </Button>
          <Button type="button" className={styles.changeEmail} disabled={busy} onClick={changeContact}>
            Change email address
          </Button>
        </div>
      )}

      <div className={styles.switchMode}>
        {mode === "signup" ? (
          <p>Already have an account? <Link href={accountLink("signin")}>Sign in</Link></p>
        ) : mode === "signin" ? (
          <>
            <p>New to Timeline? <Link href={accountLink("signup")}>Create an account</Link></p>
            <Link href={accountLink("resend")} className={styles.confirmationLink}>
              {isPhone ? "Request a confirmation text" : "Resend a confirmation email"}
            </Link>
          </>
        ) : (
          <p><Link href={accountLink("signin")}>Back to sign in</Link></p>
        )}
      </div>
      {mode === "signup" && (
        <p className={styles.cardNote}>
          Next, confirm your {isPhone ? "phone number" : "email"}. Then start your first project, with space for
          as many people or characters as your story needs.
        </p>
      )}
      <noscript>
        <p className={styles.warning}>
          JavaScript is required to securely submit this account form.
        </p>
      </noscript>
    </>
  );
}
