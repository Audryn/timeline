# Automated testing runbook

This runbook separates fast local fixtures from real provider integration and
deployment probes. Use the [case catalog](testing-plan.md) for expected behavior
and [project plan](project-plan.md) for implementation status. A green local run
does not certify real SMTP delivery, every device, or production readiness.

## 1. Before running anything

**PowerShell:** open the repository root, then:

```powershell
node --version
git rev-parse --short HEAD
git status --short
```

Use the Node version required by `package.json`. If dependencies are missing,
stop the app and restore them with `npm ci`; do not run it after every edit.
Keep `.env.local` intact and never paste its values into test reports.

All commands below are local unless explicitly labeled **disposable
integration** or **deployed**. The default local lane does not require Docker,
Supabase credentials, or an email inbox. First-time npm/browser installation
requires network access; normal fixture tests must not use hosted services.

## 2. Daily local loop

**PowerShell:**

```powershell
npm run test:unit
npm run test:db
npm run test:browser
```

Use focused selectors while changing a feature:

```powershell
npm test -- src\domain\dates.test.ts -t "validates real leap days"
npm test -- tests\server\route-boundaries.test.ts
npm run test:e2e -- --grep "a stale edit"
```

The local runner uses explicit fixture configuration instead of the developer's
hosted Supabase credentials. Browser tests use an isolated Next output and a
test origin matching their server. Never point those mutation-capable tests at
an existing deployed URL. Unsupported custom target overrides must fail.

The runner owns its child server only. If a port is occupied, identify the
specific process rather than killing every Node process. Do not remove build
locks or change the project's manual-preview configuration to hide collisions.

### Full local checkpoint

```powershell
npm run test:local
```

This is the integrated local gate. It includes the appropriate type, lint,
logic/database, browser, built-app, and web-quality checks. A failed stage
stops the aggregate. There is no automatic cloud fallback.

For targeted framework or design checks:

```powershell
npm run test:built
npm run test:quality
```

Built-app tests exercise a real production-mode Next server with a strict
loopback provider fixture, never a hosted backend. HTTP cookie replay in that
lane proves Next's request boundary and intended cookie flags, not actual
browser delivery of Secure cookies. Real HTTPS authentication remains a
provider/staging/deployment requirement.

If work required stopping a manual preview, restore it afterward:

```powershell
npm run dev -- --hostname localhost --port 3000
```

**Browser:** wait for Ready, open `http://localhost:3000`, and verify it responds.
Do not treat a printed URL as proof that the server is ready.

## 3. Understand what each layer proves

| Layer | Replaced dependency | Real behavior under test |
| --- | --- | --- |
| Unit/component | Clock, fetch, supported DOM boundaries | Domain/form/client rules and user-visible form feedback |
| Route | Request-local cookie fixture and typed Supabase boundary | Actual exported route handler, validation, Origin/auth/error mapping |
| SQL | Test `auth.uid` roles in PGlite | Actual migrated PostgreSQL functions, RLS/grants, atomic links and versions |
| Browser | Explicit API fixtures; targeted browser fault wrappers | Edge navigation, IndexedDB, Web Locks, recovery, filters and layout |
| Built app | Narrow loopback provider transport | Actual Next HTTP/cookies, per-request CSP nonces and hydration |
| Disposable provider | No Auth/PostgREST replacement; captured rather than real email delivery | Real Supabase, application callbacks and canonical database behavior |

Unhandled requests and fixture drift are failures. A response-shaped stub is
not proof that a real provider sent an email. Keep independent expected values
and use provider integration after changing auth/SDK/SQL/filter contracts.

## 4. Real provider integration (separate machine/runner)

**Do not install Docker on the borrowed PC just to run the local loop.**
Use an approved machine with Docker, a compatible installed Supabase CLI,
Node, and Microsoft Edge. No hosted project or production credentials are
needed. Bootstrap those prerequisites through a separate approved operation.

**PowerShell on that runner:**

```powershell
supabase --version
# Set this to the exact approved installed version reported above.
$env:TIMELINE_SUPABASE_VERSION = "REPLACE_WITH_APPROVED_CLI_VERSION"
node scripts\testing\provider.mjs check
npm run test:integration
```

If the CLI is not on PATH, set `TIMELINE_SUPABASE_CLI` to its actual executable
path. Missing Docker/CLI/version approval is **Blocked**, not a passing skip.
The runner does not download tools, provision hosted resources, or send mail
to an Internet inbox.

The command creates a uniquely named temporary Supabase project/configuration,
copies repository migrations into it, enables confirmation, disables external
SMTP, captures messages locally, and starts a separate test app. Fixture
controller credentials are not passed into the app process. The API and mail
origins must both be loopback HTTP; hosted status/credentials are rejected.

Mail is read through Mailpit's API. Confirmation/recovery links must point to
the test app origin and expected callback type; unexpected links fail.
No person opens an inbox or copies a token during the automated run.

The stack uses standard local Supabase ports and the app test port. If those
are occupied, use a different approved runner or stop only an instance you own.
The harness does not reset a hosted project or attach to another stack.

After success it stops its owned stack without retaining a data backup and
removes the exact temporary directory it created. After failure it attempts
stack shutdown and may retain that directory for local inspection. Treat
capture/auth diagnostics there as sensitive; never attach them wholesale.
Investigate a cleanup failure explicitly instead of deleting broad temp folders.

### Evidence limitations

This lane cannot be declared verified until it has actually run on a suitable
runner. Its mail capture does not prove Internet SMTP/DNS/inbox deliverability.
Secure-cookie and full HTTPS deployment behavior need a trusted HTTPS
environment; do not weaken cookie settings to make HTTP look equivalent.

## 5. Production/deployed checks

No deployment is selected automatically. These commands do not create a host,
GitHub account, backend, synthetic user, or fixture project.

### Public probes

**PowerShell, after an operator approves an existing HTTPS deployment:**

```powershell
$env:TIMELINE_DEPLOYED_ORIGIN = "https://YOUR_APPROVED_DEPLOYMENT"
$env:TIMELINE_APPROVED_ORIGIN = "https://YOUR_APPROVED_DEPLOYMENT"
npm run test:deployed:public
```

Replace both placeholders with the same exact approved origin. Paths,
credentials, query strings, mismatched origins, and non-HTTPS targets are
rejected before the browser starts. The public lane needs no credentials.

Only public navigation/assets and the anonymous session check are allowed.
No signup, resend, reset, callback token consumption, or journal mutation is
permitted. This is not a vulnerability scanner or a load test.

### Synthetic authenticated reads

Only after separate provisioning of a dedicated synthetic account and
pre-existing synthetic project, inject these through the approved runner's
secret mechanism:

```text
TIMELINE_ALLOW_SYNTHETIC_AUTH=yes
TIMELINE_SYNTHETIC_EMAIL
TIMELINE_SYNTHETIC_PASSWORD
TIMELINE_SYNTHETIC_OWNER_ID
TIMELINE_SYNTHETIC_PROJECT_ID
```

Then run:

```powershell
npm run test:deployed:read
```

Do not type real passwords in shared shell history or use somebody's normal
account. The probe verifies the pinned owner before reading the known project.
It permits one sign-in and session renewal, then read-only listing/rendering,
and one sign-out for session cleanup. These change auth state, not journal
content. A normal app account is not a database-enforced read-only role;
the test request allowlist is extra containment, not elevated privilege.

Every other mutation is blocked before forwarding. In particular there is no
test cleanup through project deletes and no production password/email test.
The email callback is excluded even though it is a GET, because consuming
its token changes state.

### Deployed result handling

- Missing prerequisites, provider errors, identity mismatches, blocked requests,
  CSP/runtime failures or session-cleanup failure produce a nonzero result.
- Screenshots, traces, video, storage-state files and raw response bodies are
  not retained by this runner. Do not enable them on a live private session
  merely to debug a probe.
- A PASS is printed only after owned session cleanup succeeds.
- Do not automatically redeploy, roll back, change auth policy, or delete
  content on failure. Diagnose and escalate to the deployment operator.
- No production execution is implied by passing the guard's no-network tests.

## 6. Web-quality checks

Accessibility checks are WCAG 2.2 AA-oriented: axe scans plus keyboard/focus,
responsive reflow, touch controls and status/error checks. Automation is not
accessibility certification. Keep human screen-reader and real-device review.

Visual baselines must use synthetic states and a consistent OS/Edge/font/
viewport environment. Review intentional visual changes before updating
baselines; never regenerate them simply because the test is red.

Measure production-build performance using fixed synthetic fixtures. Record
the machine/browser/fixture and agree budgets before enforcing them. Local
laboratory measurements are not field-user Web Vitals percentiles. Do not
upload private timeline content to public performance-analysis services.

Edge is the only initial automated engine. Chrome/Firefox/WebKit and actual
iPhone/Android evidence remain explicit future work; viewport emulation does
not erase that gap.

## 7. Failures, artifacts, and reporting

| Symptom | First action |
| --- | --- |
| Port/Next lock conflict | Identify the exact owned server; do not start a duplicate or kill unrelated processes |
| `npm ci` permission/file-lock failure | Stop the server using its dependencies, then retry; do not immediately escalate to administrator |
| Account service unavailable | Check site HTTP, then session endpoint, then redacted configuration/provider diagnostics |
| Successful resend but no email | Check confirmation/no-op status versus actual captured delivery; respect separate user cooldown and project quota |
| Provider command blocked | Verify prerequisites on the separate suitable runner; do not fall back to hosted credentials |
| Deployment command blocked | Check exact HTTPS approval, synthetic identity prerequisites, and mode; do not disable the guard |
| Draft/conflict regression | Keep the synthetic reproducer and independent server/browser state; never erase the draft to hide failure |

Report commit/dirty status, lane, test IDs, counts, outcome and missing
prerequisites. Use Pass / Fail / Blocked / Not run / Not implemented precisely.
Retries may help diagnose flakes but must not turn a required intermittent
failure into an unnoticed green gate.

Keep generated output/auth state/mail captures out of Git and USB source
bundles. Synthetic content does not make passwords/cookies/tokens public.
Never attach `.env.local`, unredacted reset links, SMTP credentials or live
session responses. Source backups do not back up hosted data or browser drafts.

## 8. Hosted automation later

CI means running the same checks automatically on code changes. The existing
GitHub Actions workflow does not require a GitHub account for local use and
does not provision or deploy anything.

Keep ordinary push/pull-request checks credential-free. Run real provider
integration on a suitable isolated runner. Deployed probes need a separate
explicit trigger and approved target/secrets, never the default mutation suite.
Do not grant secrets to untrusted pull requests or assume a workflow has run
merely because its YAML exists.

The Windows workflow includes non-visual quality checks. Pixel comparisons
remain in the full local quality gate and require the reviewed Windows/Edge
baseline environment; the drifting hosted `windows-latest` runner is not
silently treated as an equivalent screenshot platform. Establish that pinned
environment before promoting visual comparisons to a hosted release gate.
