---
applyTo: "src/**/*.test.ts,src/**/*.test.tsx,tests/**/*.ts,vitest.config.ts,playwright.config.ts,.github/workflows/*.yml"
---

# Tests and verification

- Add focused regressions for changed behavior and meaningful edge cases.
  Extend existing tests; do not test constants or restate implementation.
- Use synthetic people/projects and clearly fictional events. Never add real
  histories, emails, credentials, or hosted auth links to fixtures.
- `npm test` runs Vitest: pure domain cases, fake-indexeddb draft tests, and
  real PGlite PostgreSQL integration tests. No hosted project is needed for
  these existing tests; do not point fixtures at real account data.
- `npm run test:e2e` runs Playwright with installed Microsoft Edge. It starts
  its own Next dev server at `http://127.0.0.1:3100` with a matching origin.
  Stop any other project dev server first; leave server lifecycle to the runner.
- Browser API mocks prove client behavior, not hosted authentication or
  backend authorization. Use database role/RLS tests for those contracts and
  report hosted/email/device checks separately when needed.
- Target selectors by role/label. Next's route announcer can also have
  `role=alert`; select the intended error, not every alert on the page.
- Await actual visible states, acknowledged requests, and lock release.
  Do not fix a race by adding arbitrary sleeps or disabling assertions.
- Cover date validation/parity, atomic participant/category saves, owner/project
  isolation, identical-request replay, stale edits, and rejected direct writes.
- Cover draft recovery, failed/ambiguous saves, preserved conflicts,
  multi-tab edits/sign-out, filter retention, Undated, and narrow-screen overflow
  when modifying these paths.
- Preserve private/no-store headers and origin-rejection checks. Do not treat
  unconfigured services as successful accounts or silently skip failure cases.
- Available commands: `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`, `npm run test:e2e`. Use focused selectors for iteration and
  the relevant broader checks before finalizing integrated changes.
- Keep the Windows CI workflow and commands aligned with `package.json`.
  Production builds need no third-party font download.
- Playwright WebKit is not a substitute for real iPhone Safari/device testing.
  Do not claim privacy, long-recording, or mobile export support based only on
  desktop happy-path mocks.
