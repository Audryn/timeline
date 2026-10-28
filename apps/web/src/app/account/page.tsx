import type { Metadata } from "next";
import Link from "next/link";
import AccountForm, { type AccountMode } from "@/features/account/account-form";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

function parseMode(value: string | string[] | undefined): AccountMode {
  switch (value) {
    case "signin":
    case "reset":
    case "resend":
    case "password":
      return value;
    default:
      return "signup";
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const notice =
    query.notice === "expired" || query.notice === "failed"
      ? query.notice
      : undefined;

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.backLink}>
        <span aria-hidden="true">←</span> Back to Timeline
      </Link>
      <div className={styles.accountGrid}>
        <aside className={styles.introduction} aria-labelledby="account-intro">
          <p className={styles.eyebrow}>Make room for your story</p>
          <h2 id="account-intro">
            A home for
            <br />
            <em>all your chapters.</em>
          </h2>
          <p className={styles.introCopy}>
            For the life you are living, the people you remember, and the
            characters you are still imagining.
          </p>
          <ol className={styles.steps}>
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <strong>One private account</strong>
                <p>Keep your projects together across devices.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <strong>A confirmed email</strong>
                <p>Open the email link to confirm it belongs to you.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <strong>A story of your own</strong>
                <p>Start a project, add a person, and capture a moment.</p>
              </div>
            </li>
          </ol>
          <p className={styles.asideNote}>
            People and characters in a project do not need their own accounts.
          </p>
        </aside>
        <section className={styles.card} aria-label="Timeline account">
          <AccountForm key={`${mode}:${notice ?? ""}`} mode={mode} notice={notice} />
        </section>
      </div>
      <p className={styles.bottomNote}>
        Your life, in context. At your own pace.
      </p>
    </div>
  );
}
