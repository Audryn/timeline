import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.welcome}>
      <section className={styles.hero} aria-labelledby="welcome-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" /> Your life, in context
          </p>
          <h1 id="welcome-title">
            Every life
            <br />
            has a <em>story.</em>
          </h1>
          <p className={styles.heroDescription}>
            The little moments. The turning points. The people who made you, you.
            Give them a place to belong.
          </p>
          <div className={styles.heroActions}>
            <Link href="/account?mode=signup" className={styles.primaryButton}>
              Create your account <span aria-hidden="true">→</span>
            </Link>
            <p>
              Already have an account?{" "}
              <Link href="/account?mode=signin">Sign in</Link>
            </p>
          </div>
          <p className={styles.privacyNote}>
            <svg
              width="15"
              height="17"
              viewBox="0 0 20 22"
              fill="none"
              aria-hidden="true"
            >
              <rect x="3" y="9" width="14" height="11" rx="3" />
              <path d="M6 9V6a4 4 0 0 1 8 0v3M10 13v3" />
            </svg>
            A private space. A story that is yours.
          </p>
        </div>

        <aside className={styles.storyPaper} aria-labelledby="story-paper-title">
          <div className={styles.paperHeader}>
            <span className={styles.paperOverline}>A little space for a whole life</span>
            <span className={styles.paperStar} aria-hidden="true">✳</span>
          </div>
          <h2 id="story-paper-title">
            Collect the moments.
            <br />
            See how they connect.
          </h2>
          <div className={styles.storyRail}>
            <div className={styles.storyPrompt}>
              <span className={styles.promptNumber} aria-hidden="true">01</span>
              <div>
                <p className={styles.promptLabel}>The people</p>
                <h3>Every story has its people.</h3>
                <p>Make room for yourself, family, or a cast of characters.</p>
              </div>
            </div>
            <div className={styles.storyPrompt}>
              <span className={styles.promptNumber} aria-hidden="true">02</span>
              <div>
                <p className={styles.promptLabel}>The moments</p>
                <h3>Start with what you remember.</h3>
                <p>Add a life event in your own words, at your own pace.</p>
              </div>
            </div>
            <div className={styles.storyPrompt}>
              <span className={styles.promptNumber} aria-hidden="true">03</span>
              <div>
                <p className={styles.promptLabel}>The bigger picture</p>
                <h3>A life, seen in context.</h3>
                <p>Bring people and events together on one timeline.</p>
              </div>
            </div>
          </div>
          <p className={styles.paperFootnote}>
            No perfect beginning needed. Start anywhere.
          </p>
        </aside>
      </section>

      <section className={styles.waysToBegin} aria-labelledby="possibilities-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>One place. Many perspectives.</p>
          <h2 id="possibilities-title">For the stories you want to keep.</h2>
        </div>
        <div className={styles.possibilities}>
          <article>
            <span className={styles.featureIndex}>I.</span>
            <h3>Your own life</h3>
            <p>Keep the everyday memories alongside the milestones.</p>
          </article>
          <article>
            <span className={styles.featureIndex}>II.</span>
            <h3>The people around you</h3>
            <p>Trace family stories and see where different lives intersect.</p>
          </article>
          <article>
            <span className={styles.featureIndex}>III.</span>
            <h3>The worlds you imagine</h3>
            <p>Give fictional characters a history, together in one project.</p>
          </article>
        </div>
      </section>

      <footer className={styles.welcomeFooter}>
        <p>Your account holds the projects. Each project holds its people and events.</p>
        <Link href="/projects">
          Open your workspace <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </div>
  );
}
