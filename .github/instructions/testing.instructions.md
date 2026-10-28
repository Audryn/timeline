---
applyTo: "apps/web/src/**/*.test.ts,apps/web/src/**/*.test.tsx,apps/web/tests/**/*.ts,apps/web/vitest.config.ts,apps/web/playwright.config.ts,.github/workflows/*.yml"
---

# Tests and verification

- Add focused regressions for changed behavior and meaningful edge cases.
  Extend existing tests; do not test constants or restate implementation.
- Use synthetic people/projects and clearly fictional events. Never add real
  histories, emails, credentials, or hosted auth links to fixtures.
- `corepack pnpm test` runs Vitest: pure domain cases, fake-indexeddb draft tests, and
  real PGlite PostgreSQL integration tests. No hosted project is needed for
  these existing tests; do not point fixtures at real account data.
- `corepack pnpm test:e2e` runs Playwright with installed Microsoft Edge. It starts
  its own Next dev server at `http://127.0.0.1:3100` with a matching origin.
  It uses fixed isolated Next output; leave server lifecycle to the runner and
  do not reuse occupied test ports. Stop shared servers before `corepack pnpm install --frozen-lockfile`.
- Browser API mocks prove client behavior, not hosted authentication or
  backend authorization. Use database role/RLS tests for those contracts and
  report hosted/email/device checks separately when needed.
- Follow `docs/testing-runbook.md` for lane commands. Local routes must execute
  actual handlers/helpers while replacing only request-cookie and external
  provider boundaries. Keep Node/PGlite tests separate from DOM component tests.
- Local test processes use explicit fixture environment and network boundaries;
  inherited `.env.local` must never turn a mocked test into real mail or writes.
  An unhandled mock is a failure, not a successful empty response.
- Production probes use a separate config/command, exact approved HTTPS target,
  pinned synthetic identity and request allowlist. No signup/reset/resend,
  journal mutations, migrations, deletes or fault/load testing in production.
  Email callback GETs consume tokens; they are not harmless read probes.
- Keep screenshots/traces/auth state/mail captures out of deployed reports and
  Git. Synthetic accounts do not make session tokens safe to publish.
- Real provider checks must run before release after auth/SDK/SQL/query contract
  changes; missing infrastructure is Blocked, not Pass. Mailpit capture proves
  local email content/flow, not Internet SMTP deliverability.
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
- Use `corepack pnpm test:local` for the integrated local gate, including built-app
  and quality checks. Use `test:unit`, `test:db`, `test:browser`, `test:built`,
  or `test:quality` with focused selectors while iterating; see the runbook.
  `corepack pnpm test` and `test:e2e` alone do not include all local gates.
- Keep the Windows CI workflow and commands aligned with `package.json`.
  Production builds need no third-party font download.
- Playwright WebKit is not a substitute for real iPhone Safari/device testing.
  Do not claim privacy, long-recording, or mobile export support based only on
  desktop happy-path mocks.
