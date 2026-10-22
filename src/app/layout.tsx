import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import "./globals.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { default: "Timeline — Every life has a story", template: "%s | Timeline" },
  description:
    "A private home for life stories. Bring people, characters, and meaningful moments together in a timeline of your own.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Per-request CSP nonces require request-time HTML, including the welcome page.
  await connection();

  return (
    <html lang="en">
      <body>
        <a href="#main-content" className={styles.skipLink}>
          Skip to content
        </a>
        <header className={styles.siteHeader}>
          <Link href="/" className={styles.brand} aria-label="Timeline home">
            <span className={styles.brandMark} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            Timeline<span className={styles.brandDot}>.</span>
          </Link>
          <nav className={styles.navigation} aria-label="Main navigation">
            <Link href="/projects" className={styles.workspaceLink}>
              Your workspace <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/account?mode=signin" className={styles.headerSignIn}>
              Sign in
            </Link>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1} className={styles.mainContent}>
          {children}
        </main>
      </body>
    </html>
  );
}
