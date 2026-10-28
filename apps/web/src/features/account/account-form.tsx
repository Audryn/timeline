"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiClient, message as errorMessage, type AccountAction, type ConnectionState, type Session } from "@timeline/shared";
import styles from "./account.module.css";

export type AccountMode = AccountAction;

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

function continueToProjects() {
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
  window.location.assign("/projects");
}

export default function AccountForm({
  mode,
  notice,
}: {
  mode: AccountMode;
  notice?: "expired" | "failed";
}) {
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "verify" | "email-sent">("form");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const content = copy[mode];
  const needsPassword = mode === "signup" || mode === "signin" || mode === "password";
  const passwordSessionMissing = mode === "password" && connection === "ready" && !session?.user;
  const disabled = busy || connection !== "ready" || passwordSessionMissing;

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

  useEffect(() => {
    if (error || message) feedbackRef.current?.focus();
  }, [error, message]);

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
    setEmail(normalizedEmail);
    try {
      const fields =
        mode === "password"
          ? { password }
          : needsPassword
            ? { email: normalizedEmail, password }
            : { email: normalizedEmail };
      const result = await apiClient.account(mode, fields);
      setPassword("");
      if (mode === "signin" || mode === "password") {
        continueToProjects();
        return;
      }
      setMessage(result);
      setStep(mode === "signup" ? "verify" : "email-sent");
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
      setMessage(await apiClient.account(action, { email }));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setStep("form");
    setMessage("");
    setError("");
    setPassword("");
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  return (
    <>
      <p className={styles.eyebrow}>{step === "form" ? content.label : "Check your email"}</p>
      {step !== "form" && (
        <div className={styles.mailIcon} aria-hidden="true">
          <svg width="30" height="26" viewBox="0 0 30 26" fill="none">
            <rect x="2" y="4" width="26" height="19" rx="3" />
            <path d="m3 6 12 9L27 6" />
          </svg>
        </div>
      )}
      <h1 className={styles.title}>
        {step === "form" ? content.title : "Check your inbox."}
      </h1>
      <p className={styles.description}>
        {step === "form"
          ? content.description
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
            <button type="button" className={styles.textButton} onClick={retryConnection}>
              Try connecting again
            </button>
          </div>
        )}
      </div>

      {session?.user && mode !== "password" && step === "form" && (
        <div className={styles.information}>
          Signed in as <strong>{session.user.email}</strong>.{" "}
          <Link href="/projects">Continue to your workspace</Link>.
        </div>
      )}
      {passwordSessionMissing && (
        <div className={styles.warning} role="alert">
          <strong>A valid recovery session is required.</strong>
          <p>
            Open the link from your password reset email, or{" "}
            <Link href="/account?mode=reset">request a fresh reset link</Link>.
          </p>
        </div>
      )}

      {step === "form" ? (
        <form onSubmit={handleSubmit} className={styles.form} aria-busy={busy}>
          <fieldset disabled={busy} className={styles.fields}>
            {mode !== "password" && (
              <div className={styles.field}>
                <label htmlFor="account-email">Email address</label>
                <input
                  ref={emailRef}
                  id="account-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            )}
            {needsPassword && (
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="account-password">
                    {mode === "password" ? "New password" : "Password"}
                  </label>
                  {mode === "signin" && (
                    <Link href="/account?mode=reset">Forgot password?</Link>
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
          <div ref={feedbackRef} tabIndex={-1} className={styles.feedback}>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {message && <p role="status" className={styles.information}>{message}</p>}
          </div>
          <button type="submit" disabled={disabled} className={styles.primaryButton}>
            {busy ? content.busy : content.submit}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </form>
      ) : (
        <div className={styles.emailInstructions} aria-busy={busy}>
          <p className={styles.emailAddress}>{email}</p>
          <div ref={feedbackRef} tabIndex={-1} className={styles.feedback}>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {message && <p role="status" className={styles.information}>{message}</p>}
          </div>
          <p className={styles.fieldHint}>
            {step === "verify"
              ? "Follow the email link to continue. Timeline checks confirmation on the server before opening your projects; creating an account or resending a link does not confirm your email."
              : mode === "reset"
                ? "Open the email link to choose a new password. Request a fresh link if the previous one has expired."
                : "Follow the confirmation link, then sign in if asked. Sending an email does not confirm the account."}
          </p>
          <button type="button" className={styles.secondaryButton} disabled={disabled} onClick={sendAgain}>
            {busy ? "Sending email…" : mode === "reset" ? "Send another reset email" : "Resend confirmation email"}
          </button>
          <button type="button" className={styles.changeEmail} disabled={busy} onClick={changeEmail}>
            Change email address
          </button>
        </div>
      )}

      <div className={styles.switchMode}>
        {mode === "signup" ? (
          <p>Already have an account? <Link href="/account?mode=signin">Sign in</Link></p>
        ) : mode === "signin" ? (
          <>
            <p>New to Timeline? <Link href="/account?mode=signup">Create an account</Link></p>
            <Link href="/account?mode=resend" className={styles.confirmationLink}>
              Resend a confirmation email
            </Link>
          </>
        ) : (
          <p><Link href="/account?mode=signin">Back to sign in</Link></p>
        )}
      </div>
      {mode === "signup" && (
        <p className={styles.cardNote}>
          Next, confirm your email. Then start your first project, with space for
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
