# Timeline testing plan

## Purpose and status

Test the current first-use build in detail, with separate gates for future MVP
features. This plan serves both the person trying Timeline in a browser and
developers running automated checks on Windows.

**This is a plan, not a test-results report.** Record results for each tested
commit and lane using the template below. The automated test implementation
and executable procedures are described in the [runbook](testing-runbook.md);
real-provider, deployed, and device checks need their own evidence.

The active product is online-first with browser drafts, not a fully offline
app. See the [product brief](product.md), [architecture](architecture.md), and
[current implementation milestone](../README.md#current-milestone).

## 1. Scope and risk priorities

| Priority | Meaning | Examples |
| --- | --- | --- |
| P0 | Must pass before accepting a tested build for the relevant milestone | Account isolation, no lost drafts, no false save success, safe retry/conflicts |
| P1 | Required before declaring the first-use experience ready | Date/filter correctness, pagination, recovery links, accessibility, target-browser checks |
| P2 | Improvement/scale investigation, unless evidence raises the severity | Large-fixture performance measurements and additional visual refinements |

Current scope: registration/verification/sign-in/password reset/sign-out;
project plus first-person setup; additional real/fictional people; shared events;
date entry; timeline/search/filters; local event drafts; and server saves.

Not current functionality: attachments, recording/transcription, guided
questions/stories, category or project/person editing, deletion/Trash, account
deletion, session lock, and PDF export. Test those against section 8 when
implemented; do not call their absence a regression in this first-use slice
or treat the full MVP as complete.

The highest risks are sensitive data reaching the wrong account, local work
being lost, a rejected/unconfirmed save appearing successful, duplicate
records on retry, and imprecise dates being silently changed.

## 2. What existing tests establish

| Test surface | Existing coverage | Important limit |
| --- | --- | --- |
| [Civil date tests](../apps/web/src/domain/dates.test.ts) | Leap days, date precision, seasons, invalid intervals, unknown/custom/ongoing dates | Does not exercise every form-control transition |
| [Draft tests](../apps/web/src/lib/drafts.test.ts) | Incomplete-draft persistence, stale revision writes/deletes, owner-scoped cleanup | Uses fake IndexedDB, not actual browser quota failures |
| [Server route tests](../apps/web/tests/server/route-boundaries.test.ts) | Actual handlers/helper validation, Origin/auth/provider error and cookie-intent boundaries | Typed provider/request-cookie stubs; not actual Supabase or Next network context |
| [Database contract tests](../apps/web/tests/integration/first-use.test.ts) | Atomic project/category/person setup, idempotency, RLS/grants, cross-owner/project rejection, links/versions, SQL/TypeScript date parity | Real PostgreSQL via PGlite, with test auth roles; not hosted Supabase Auth or its Data API |
| [Filter serialization tests](../apps/web/tests/integration/filters.test.ts) | One combined logic tree; search/date/Undated groups and escaped literals | Captures SDK request URLs; does not execute them through PostgREST against matching records |
| [Browser first-use suite](../apps/web/tests/e2e/first-use.spec.ts) | Setup guidance, first event, draft recovery, narrow screens, uncertain-save retry, conflicts/filter retention, cross-tab sign-out; expanded fault cases alongside it | Most account/project/event responses are mocked; not proof of real signup, email, cookies, or hosted saves |
| [Built-app tests](../apps/web/tests/built/framework.spec.ts) | Actual production-mode Next HTTP, per-request nonces, hydration, protected cookie flags and request-local reads | Loopback provider fixture; explicit HTTP cookie replay is not proof of browser Secure-cookie delivery |
| [Provider workflow](../apps/web/tests/provider/real-provider.spec.ts) | Real signup/reset/captured mail, canonical events, filter membership, isolation and direct-write denial | Requires separate Docker/Supabase runner; not verified merely because the spec exists |
| [Deployed policy tests](../apps/web/tests/integration/deployed-policy.test.ts) | Exact HTTPS approval, synthetic-read restrictions, email/mutation denial and request limits | No-network guard checks; do not establish that any production deployment exists or passes |

The original unconfigured-signup check remains conditional in its test body,
but the isolated local runner explicitly supplies unconfigured provider values.
Additional scenarios are needed for invalid credentials/provider outages.
Do not generalize public narrow-screen checks into full editor/timeline or
cross-browser coverage; the quality lane and later browser work are separate.

No current test result should be inferred from this inventory. Historical
passing runs do not establish that a later checkout/environment still passes.
Use `corepack pnpm test:local` for the integrated credential-free automation gate.
The [project plan](project-plan.md) separates remaining product capabilities
from automation and external-runner prerequisites.

## 3. Safe setup and test data

### Environments

| Environment | Use | Preconditions |
| --- | --- | --- |
| Local isolated automated tests | Dates, drafts, database contracts, mocked browser regressions | Node version from `package.json`, installed dependencies; Edge for Playwright |
| Disposable unconfigured manual instance | ACC-01 setup-required behavior | Separate clone without local credentials; recipe below |
| Local app + development Supabase | Real account/email/first-event checks | Existing development project, applied migrations, configured email and `.env.local` |
| HTTPS staging + development backend | Production-cookie/CSP flow, mobile devices, deployed auth | Reachable HTTPS address, matching origin and Supabase callback settings |

Do not run destructive tests against production or a project with valuable
histories. Account creation sends real email: use dedicated test inboxes under
the tester's control. Do not commit their addresses, passwords, links, tokens,
browser storage, or exported request logs.

Create two test accounts, called **Owner A** and **Owner B** in results, without
recording credentials. Use separate browser profiles for owner-isolation tests.
For concurrent server edits, also use two independent profiles signed into A.
Two ordinary tabs share browser drafts and are a different test.

Suggested synthetic records:

| Record | Setup and purpose |
| --- | --- |
| Project A1: `QA - Personal` | Northern hemisphere; first person `Alex Test`; add real person `Morgan Test` |
| Project A2: `QA - Fiction` | Southern hemisphere; fictional person `Rowan Character` |
| Project B1: `QA - Other owner` | Owned by B only, with a distinct synthetic event |
| Shared event | A1; Alex + Morgan; Education + Travel; title `QA - Shared trip` |
| Undated event | A1; Alex only; no category; Unknown date |
| Boundary fixtures | Section 6 dates, literal search punctuation, overlapping intervals |
| Pagination fixtures | 51+ dated/undated events, including several with equal start dates |

Use unique synthetic titles or a run label so records from earlier tests cannot
make a new run appear to pass. A developer should prepare any bulk fixture
generator as a separate, reviewed task; none exists as a supported command yet.

The current app has no deletion UI. Leave disposable test records isolated, or
arrange authorized cleanup in the development project. Do not truncate tables,
delete auth users, or reapply the initial migration as casual test cleanup.
Never clear browser site data while a meaningful draft remains unsaved.

### Start a manual session

**PowerShell, from the repository root:**

```powershell
node --version
corepack pnpm --version
git rev-parse --short HEAD
git status --short
corepack pnpm dev --hostname localhost --port 3000
```

First check whether a project server is already running. Reuse a healthy
preview instead of launching another. If dependencies are absent, stop the
server and use `corepack pnpm install --frozen-lockfile`; it is not needed for every testing session.
Leave the server window open and wait for Ready.

**Browser:** open `http://localhost:3000`. Follow [README setup](../README.md#connect-a-supabase-development-project)
if this working copy is not configured. Do not overwrite an existing
`.env.local`, print its values, or run SQL filenames in the SQL Editor.
Do not rerun a migration that has already succeeded.

For account problems, check reachability first, then `/api/session`, then
redacted configuration/provider/callback diagnostics. `configured: true`
confirms only that settings are present. It does not validate credentials,
migration deployment, email delivery, or the full account/save path.
Do not publish the session response of a signed-in user as test evidence.

Local confirmation links must open on the computer serving Timeline.
On phones, localhost means the phone. Mobile testing needs an authorized
reachable HTTPS staging address and corresponding auth URL settings.

### Optional unconfigured instance for ACC-01

Use a separate PowerShell window, starting in the repository root. This
creates an independent copy of committed source, not another server in the
configured working copy. Record its actual commit; uncommitted changes are
not copied.

```powershell
$source = (Get-Location).Path
$scratch = Join-Path $env:TEMP ("timeline-unconfigured-" + [guid]::NewGuid().ToString("N"))
git clone --no-hardlinks $source $scratch
# Continue only if cloning succeeded.
Set-Location -LiteralPath $scratch
git rev-parse --short HEAD
corepack pnpm install --frozen-lockfile
# Continue only if dependency installation succeeded.
$env:APP_ORIGIN = "http://localhost:3200"
corepack pnpm dev --hostname localhost --port 3200
```

**Browser:** use `http://localhost:3200/api/session` and confirm
`configured: false`, then open `http://localhost:3200/account?mode=signup`.
The clone does not include ignored `.env.local`; do not copy credentials into it.
If configuration is inherited from the computer/shell and the response is true,
stop this instance and record ACC-01 as Blocked until an engineer isolates that
shell. Do not alter the original project's environment files or global settings.
An occupied port is also a setup blocker, not a reason to terminate an unrelated
process. Stop the disposable server with Ctrl+C when finished.

## 4. First manual smoke test

Run this before the deeper cases. Use only the synthetic test account/data.
If setup is unavailable, record **Blocked** and its reason, not Pass.

| Step | In the browser | Expected result |
| --- | --- | --- |
| 1 | Open welcome and choose Create account | Account form loads; no fake account or unexpected permission prompt |
| 2 | Register A with an approved password of at least 12 characters; confirm email on the serving computer | Verification establishes the correct account; protected projects are unavailable before verification |
| 3 | Create `QA - Personal`, first real person `Alex Test`, Northern hemisphere | Project, person, and default categories appear together; empty timeline requires no separate creation |
| 4 | Add `QA - First school`, Education, Autumn starting in 2005 | Local draft status is distinct from account-save status |
| 5 | Select Save event to account, then wait for acknowledgment | Exactly one event appears, labeled Autumn 2005, not a fabricated exact day |
| 6 | Close/reopen the project or reload after saving | Saved event is fetched again; no duplicate or stale editor |
| 7 | Add Morgan; save the shared trip for Alex + Morgan with two categories | Combined timeline contains one shared event; either participant filter includes it |
| 8 | Apply search/category/person filters; edit a matching event; save and return | Content is updated and filter selections remain in place |
| 9 | Start a new unsaved event; wait for Draft saved on this browser; use Close editor and reopen Add event / recover new draft | Draft is recovered without appearing as a cloud-saved event |
| 10 | Publish or explicitly discard that draft; sign out and sign back in | Account-save persistence is intact, private content is not left visible while signed out |

Record the real hosted result separately from mocked Playwright success.
A smoke pass is a useful first milestone, not a complete release sign-off.

## 5. Detailed current-build scenarios

### Account, project, and ownership cases

| ID / Priority | Steps | Pass condition |
| --- | --- | --- |
| ACC-01 / P0 | Use section 3's disposable-unconfigured recipe; open account/project pages | Setup is required; submit cannot fake an account or cloud save. Do not erase the configured working copy's settings; deterministic automated equivalents are gap 6 |
| ACC-02 / P0 | Submit malformed email, a signup password shorter than 12 characters, and valid-format wrong sign-in credentials | Clear validation/error, no authenticated workspace; no credentials leaked in UI/logs |
| ACC-03 / P0 | Sign in before email confirmation; then use a valid confirmation link | Unverified access is denied; verified access belongs only to the intended account |
| ACC-04 / P1 | Request resend; try an expired/used/malformed confirmation link; obtain a fresh link | Safe error/recovery, no false verification. Respect provider rate limits; do not flood email requests |
| ACC-05 / P0 | Request password reset for A; open its link; set a new valid password; sign out; try old then new password | Reset uses the intended account; old password fails and new one succeeds. Do not record either password |
| ACC-06 / P0 | Expire/revoke A's test session in an authorized test setup while its event editor has an unsaved draft; return to the tab and retry | No unauthorized write or account leak; draft retained or explicit recovery/failure warning. Engineer-assisted fault case; do not force expiry by deleting arbitrary cookies with valuable work open |
| PRJ-01 / P0 | Create A1 and A2; add a real person and fictional character | Context remains project-specific; character is a record, not an invited account |
| PRJ-02 / P0 | Double-submit/retry project or person creation after a controlled lost acknowledgment | Same logical request creates one result, not duplicate projects/people. Verify network identity and DB receipt behavior in automated tests |
| OWN-01 / P0 | In B's profile, navigate directly to A1's copied project URL; try listing A's event ID through the protected API | No A names, notes, categories, or event payload is exposed. Empty/denied/unavailable responses do not count as a data leak |
| OWN-02 / P0 | Developer tests A's IDs with B's authenticated writes; attempts to link A2 people/categories into an A1 event | Server rejects without partial records/links or success-shaped responses; normal UI picker restrictions alone do not prove this |
| OWN-03 / P0 | Sign A out, sign B in using the same profile, inspect current tabs and return to the workspace | No A content/draft recovery is presented to B; checks cover memory and browser storage, not just the project list |

### Capture, filters, and pagination

| ID / Priority | Steps | Pass condition |
| --- | --- | --- |
| EVT-01 / P0 | Attempt event save with empty/whitespace title or no participants; then correct the draft | Validation retains entered content; only valid records publish |
| EVT-02 / P1 | Save with two participants/two categories, then with none selected for categories | One shared record; correct participant views; Uncategorized remains visible |
| EVT-03 / P1 | Save/edit multiline notes, Unicode, and literal text such as `<b>not markup</b>` | Content survives reopen and displays as text; no execution or unintended HTML |
| EVT-04 / P1 | Try title/notes/location boundaries, including direct API inputs over the current schema limits | UI/API agree on limits; failures preserve draft. Use current schemas as limit authority |
| FLT-01 / P1 | Select two people, then two categories; combine with search and date range; use Apply filters | OR inside each filter, AND across types; no ignored search/date group |
| FLT-02 / P1 | Search matching/nonmatching records containing `%`, `_`, quotes, commas, and backslashes | Literal punctuation cannot change filter syntax; result membership is verified against real PostgREST, not just URL strings |
| FLT-03 / P1 | Apply a window that intersects an event range or season at its boundaries; include ongoing dates; toggle Include Undated | Overlap includes the correct dated records; Undated has independent explicit inclusion; impossible From/To is rejected |
| FLT-04 / P1 | With active filters, open/edit/save or close an event; add a person; leave/return to the browser tab | Active search/filter intent remains. Newly fetched records replace stale content without duplicating shared events |
| PAGE-01 / P1 | With 51+ fixtures, choose Load more memories; inspect equal-date entries and Undated at the end | Stable chronological ordering and all intended records; no skipped/duplicated IDs on a stable dataset |
| PAGE-02 / P1 | After loading later pages, edit an existing event's title/date or add an event, then return | Refresh restarts/reloads correctly, edited data is current, filters persist. Do not require the old scroll position if pagination restarts |
| PAGE-03 / P1 | Save another event in an independent profile between page fetches, then refresh | Document offset-pagination behavior under a changing dataset. No false claim of a snapshot or lost canonical data; any unacceptable user-visible omission becomes a regression task |

## 6. Date acceptance matrix

Use labeled synthetic events; save/reopen and inspect the displayed wording and
filter membership. Developers additionally compare TypeScript and SQL placement
bounds. Bounds below are test expectations, not exact dates to display to users.

| ID | Input | Expected behavior |
| --- | --- | --- |
| DATE-01 | Exact day: 29 February 2024 | Valid day; remains that civil date across time zones |
| DATE-02 | Month: February 2024; year only: 2005 | Placement covers 1-29 February / the full year; label preserves precision |
| DATE-03 | Northern Winter 2023 | 1 December 2023 through 29 February 2024; labeled by starting year |
| DATE-04 | Southern Summer 2023; Southern Winter 2023 | December-February cross-year / June-August in 2023 |
| DATE-05 | Range August 2020 to year-only 2020 | Allowed because uncertain endpoints overlap; do not arbitrarily reverse it |
| DATE-06 | Ongoing, start 2021 | No invented end date; date-window overlap treats the end as open |
| DATE-07 | Approximate September 2005 | Approximate wording and month precision survive edits/reopen |
| DATE-08 | Unknown, and custom `Before the move` with no placement | Both discoverable in Undated; original custom wording retained |
| DATE-09 | Custom `Around the move`, placed in February 2024, no end | Single placement window covers the month, not an infinite ongoing range |
| DATE-10 | 29 February 1900, 31 April, year 0, reversed definite interval | Validation; no canonical write and draft remains editable |
| DATE-11 | Change editor type among point/range/season/custom/unknown, recover draft, reopen saved form | No stale hidden fields corrupt the submitted type; round-trip date behavior remains equivalent |
| DATE-12 | Inspect the same events in two browser time zones | Civil labels, order, and date-filter membership do not shift |

Exercise all four seasons for both hemispheres in automated parity coverage.
Retain strict endpoint shape/type rejection in the database; UI-only validation
is insufficient. Uncertainty windows must not look like asserted durations.

## 7. Recovery and privacy-critical failure cases

### REC-01 / P0: connectivity lost in an open editor

1. Open a new event in A1 and type a synthetic title and notes.
2. In Edge DevTools (F12), open Network and change throttling to Offline.
   Keep this already-loaded editor open; offline navigation is not promised.
3. Continue editing and wait for the browser-draft acknowledgment.
4. Try Save event to account. Expect no cloud-save success; keep the draft.
5. Restore Network to Online. There must be no automatic publish.
6. Use the explicit save/retry action. Verify one record after acknowledgment.
7. Close the editor; restore Online before reloading the page and reopening
   the event/new-draft entry. Confirm recovery or successful draft cleanup.

An ordinary network outage does not prove lost-acknowledgment behavior. Test
that separately with the controlled REC-02 harness.

| ID / Priority | Controlled setup and action | Pass condition |
| --- | --- | --- |
| REC-02 / P0 | Engineer lets a mutation commit but drops its response; retries the pending request, including after closing/reopening the editor | Same UUID/payload replayed; exactly one effect; draft removed only after confirmed acknowledgment |
| REC-03 / P0 | Save an incomplete new draft, use Close editor, reload online, reopen recover-new-draft | Fields recover; no cloud event appeared; invalid/incomplete data is allowed in draft storage |
| REC-04 / P0 | A signs into two independent browser profiles; both load event version N. First saves; second edits/saves its older copy | Stale save rejected; local text remains; current account version shown. Explicit merge/base selection saves once without silent last-write-wins |
| REC-05 / P0 | Two ordinary same-account tabs open the same draft; type different changes | Local revision conflict is visible; neither tab silently overwrites the other. No false unconfirmed-server-save state before a request is sent |
| REC-06 / P0 | Keep an editor open in one tab; attempt sign-out in another; close editor, then cancel/accept draft discard prompt | Active editor blocks sign-out; cancellation preserves draft; explicit confirmed discard cleans up only that owner |
| REC-07 / P0 | Controlled account/session-change notification while the last keystrokes are still awaiting autosave | Private UI hidden promptly; latest draft flushed or a visible recovery failure, not silent loss or cross-account display |
| REC-08 / P0 | Engineer injects IndexedDB failure at open/write/delete, or cleanup failure after cloud acknowledgment | No false local-save/cleanup success; in-memory text remains recoverable where possible; no duplicated server write or unintended draft deletion |
| REC-09 / P1 | Download draft copy, then explicitly discard a synthetic local-only draft | Download is readable and warned as sensitive; only the draft disappears, not an existing published event. No archive-import support is implied |
| REC-10 / P1 | Developer removes/blocks Web Locks or account-notification capability in a disposable context | Clear unsupported/failure state; no unsafe editing or accidental account leakage. Do not claim unsupported browsers are fully usable |

Use test harness injection, not filling the computer's disk, for quota failures.
Never use real journal text in browser logs, traces, network exports, downloaded
draft copies, or screenshots. Remove only identified synthetic artifacts after
results are recorded. Do not delete valuable browser storage to "reset" a test.

### Reproducible developer techniques for controlled failures

The following are designs for additional test harness cases, **not existing
debug commands or implemented automated tests**. They belong to section 11's
server/recovery/browser tasks. Until a mechanism is implemented and its
result recorded, mark the associated case Blocked or Not run; do not waive a
required P0 gate or substitute an unrelated happy-path result.

| Case | Concrete mechanism | Evidence and isolation |
| --- | --- | --- |
| REC-02 | In a dedicated real-backend Playwright test, intercept the event POST. Forward it once with `route.fetch()`, require a successful upstream response, then deliberately `route.abort()` instead of delivering it. Restore normal routing before Retry | Read the canonical event after retry; compare captured request IDs/versions and verify exactly one committed effect. Use only a disposable backend/account. Returning a mocked 503 alone cannot prove a server commit occurred |
| REC-07 | In a mocked Playwright context, keep two pages on the same origin. Gate a simulated sign-in/session change, type in the editor, then release a `timeline-account` BroadcastChannel notification while the draft is still awaiting autosave; let `/api/session` switch from fixture A to fixture B | Assert latest fixture text remains in A's draft, private UI is hidden/cleared, and B cannot recover it. Coordinate on observable states, not arbitrary sleeps. This proves client transition behavior; OWN-03 separately verifies real hosted cookies/account switching |
| REC-08 | In a fresh synthetic Playwright context, use `context.addInitScript()` to install fault wrappers before the app runs. Restrict `indexedDB.open` failures to the `timeline-drafts` database; restrict `IDBObjectStore.put`/`delete` exceptions to its `drafts` store. Gate a `QuotaExceededError` or controlled deletion failure at the chosen phase | Run separate open/write/after-acknowledgment-cleanup cases. Assert visible failure, preserved recoverable text, and no duplicate cloud mutation. Use mocked APIs for fault isolation; close the context afterward. Do not patch unrelated databases or a real user's browser |
| REC-10 | In a fresh synthetic Playwright context, use `context.addInitScript()` to make `navigator.locks` unavailable before hydration. In a separate case, block BroadcastChannel construction/notifications | Record the resulting error/disabled behavior and absence of unsafe save or private data exposure. Discard the context to remove overrides. A broken page is a failure, not an acceptable unsupported-capability notice |

### Private API and deployed behavior

Developer tests must cover unauthenticated/unverified requests, malformed JSON,
oversized bodies, invalid UUIDs/versions/filters, missing/foreign Origin on writes,
and callback rejection of expired/invalid tokens without external redirects.
Check no-store responses and session-cookie behavior; these are acceptance tests,
not a claim that this plan is a completed security audit.

On HTTPS staging, repeat registration/reset and the smoke test with actual
production-mode cookies, refresh/expiry, and CSP. No nonce failures should break
hydration; an anonymous cache must not serve a previous owner's private content.
Check application/proxy logs without retaining callback query tokens. A local
HTTP production build cannot validate Secure-cookie authentication.

## 8. Future MVP gates

Add focused automation and manual/device evidence when each feature lands.
Until then use status **Not implemented**, not Pass or a misleading skipped pass.

| Feature | Required gate before claiming support |
| --- | --- |
| Category/project/person editing | Rename/archive preserves associations; last-participant removal cannot orphan events; versions and cross-project constraints preserved |
| Images/PDFs | At/below/above 25 MB, actual type validation, orientation/thumbnails, private scoped reads/uploads, interrupted/expired resumable transfers, missing/corrupt objects, server readiness confirmation and orphan cleanup |
| Recording | Permission denial/revocation, formats, pause/resume/playback, chunk recovery, storage failure, interruptions/lock/background, 60-minute/100 MB boundary with warnings and graceful stop; validate on actual devices |
| Local speech | Hardware/browser/locale/model availability and download failure; verify no remote speech call; unsupported mode retains recording/typing; retries preserve edited text; saved-recording input tested separately from live speech |
| Guided stories | Prompt -> draft -> explicit save; manual event links, multiple people/events, preserved source text; no auto-invented facts or duplicate events |
| PDF | Real page-aware A4/Letter layout, stable export snapshot, selected filters/people/stories, date wording, Unicode/long text/photos, no duplicates, explicit missing-media choices, mobile preview/download/print, sensitive temporary-file handling |
| Trash/purge | 30-day rules, hierarchy restore, stale-edit rejection, no deleted-record resurrection, idempotent blob cleanup, minimal retained deletion/receipt data |
| Account deletion/session lock | Recent authentication, private UI and local-state handling across tabs, retryable deletion of records/objects/sessions, no delayed account deletion disguised as Trash, honest limits for offline devices/browser storage |
| Deployment/operations | Controlled schema upgrade preserving records, backup-and-restore rehearsal, provider/email configuration, monitoring/cost alerts, privacy/support information |

Do not introduce full offline-sync, native-client, book-ordering, or fictional
calendar acceptance requirements into this first-use build without a separate
product decision.

## 9. Browsers, accessibility, and scale

| Target | Evidence required |
| --- | --- |
| Windows Edge | Primary manual path plus the current automated browser suite |
| Windows Chrome and Firefox | Core account/event/draft/filter checks; record exact versions. Current Playwright config does not run these browsers |
| iPhone Safari and Android Chrome | Real HTTPS staging tests for touch/layout/forms/draft behavior and later media/export; desktop emulation is insufficient |
| Keyboard, zoom, screen readers | Welcome -> account -> projects -> event -> filters. Visible focus, labeled fields/groups, announced errors/save states, usable multi-selects, no traps; 200% zoom and narrow layout without clipped actions |
| Reduced motion/non-color use | Respect reduced motion; categories and date uncertainty remain understandable without color |

Start accessibility checks with Windows Narrator and keyboard navigation; add
VoiceOver/TalkBack on target mobile devices. Test the editor and populated
timeline at a 390-pixel viewport as well as the already-covered public screens.
No claim of formal accessibility certification follows from these checks.

Use a developer-generated 10,000-event synthetic project for a scale pass:
record data size, browser/device, query payloads, page behavior, input/scroll
responsiveness, filter latency, and evidence of main-thread stalls. Do not load
all entries to work around pagination bugs. Establish measurable budgets from
representative hardware before defining a performance pass; until agreed,
report measurements and defects, not an invented universal threshold.

## 10. Running the automated checks locally

**PowerShell, repository root.** Existing dependencies must be installed.
No new tooling or package installation is requested by this document.

For an integrated first-use change:

```powershell
corepack pnpm test:local
```

This runs typecheck, lint, unit/component/route tests, SQL/contracts, browser
scenarios, built-app HTTP tests, and web-quality checks, stopping on failure.
For focused iteration, use `test:unit`, `test:db`, `test:browser`, `test:built`,
or `test:quality` as described in the [runbook](testing-runbook.md).
The compatibility `corepack pnpm test` and `test:e2e` commands remain available, but alone
do not include the built-app and quality gates.

The browser suite starts/stops its own server on
`127.0.0.1:3100`, with installed Microsoft Edge and isolated Next output.
Do not reuse an occupied test port, substitute your manual `localhost:3000`
preview, or change the Auth Site URL just for mocked tests.

Focused examples:

```powershell
# One date test by name.
corepack pnpm test src\domain\dates.test.ts -t "validates real leap days"

# Related data/draft regressions in one runner.
corepack pnpm test src\lib\drafts.test.ts tests\integration\first-use.test.ts tests\integration\filters.test.ts

# One browser scenario; this also starts its own test server.
corepack pnpm test:e2e tests\e2e\first-use.spec.ts --grep "a stale edit"
```

Use the smallest relevant selectors while changing code. Broaden to affected
suites/typecheck/lint/build before accepting the change. Documentation-only
changes need links/consistency checks, not runtime suites.

After testing, if a preview was stopped, restore and verify it:

```powershell
corepack pnpm dev --hostname localhost --port 3000
```

Wait for Ready. **Browser:** open `http://localhost:3000` and confirm the page
responds. `corepack pnpm install --frozen-lockfile` replaces dependencies; it is not required after each edit
and must not run while their files are locked by the server.

### CI in plain language

**Continuous Integration (CI)** means a service runs these checks automatically
when code is pushed or a pull request is opened. Timeline already has a
[GitHub Actions workflow](../.github/workflows/ci.yml) for Windows and Node.
It has not been shown to run on a hosted GitHub repository.

A GitHub account/remote is not needed for local commands. If GitHub hosting is
added later, validate that the runner has Edge and dependencies, retain the
same checks, and use synthetic data. Do not add real auth credentials or
end-to-end email tests to the ordinary push workflow.

## 11. Automation map and remaining evidence

The local layers now have executable commands in the runbook. The table keeps
the original gap numbers for traceability; implemented harnesses and passing
local fixtures do not erase unexecuted external requirements.

| Order / Priority | Work | Implementation / remaining evidence |
| --- | --- | --- |
| 1 / P0 | Real provider smoke | Disposable signup/reset/captured-mail/event/isolation spec exists. Actual execution is Blocked until a suitable Docker/Supabase runner is available |
| 2 / P0 | Server-route/auth contracts | Typed boundary tests execute actual handlers/helpers; built tests execute actual Next HTTP/cookies. Real provider refresh and HTTPS evidence remain separate |
| 3 / P0 | Recovery faults | Edge and IndexedDB regressions cover storage failures, reopen/retry, tab conflicts and account transitions. Real committed-acknowledgment loss is specified in the disposable provider workflow, not yet verified here |
| 4 / P1 | Actual PostgREST membership | Provider spec asserts combined text/person/date matching and nonmatching IDs. Real execution and fuller category/Undated membership cases still require that lane |
| 5 / P1 | Pagination and forms | Browser pagination/date cases and focused form round-trip tests supplement domain tests; record exact fixtures and environment with each run |
| 6 / P1 | Explicit test environments | Local runner supplies fixture values and blocks server egress; environment/guard regressions prevent hosted credentials or live email from entering the inner loop |
| 7 / P1 | Web quality and deployed behavior | Edge axe/focus/reflow/visual checks exist. Screen readers, other engines, real devices and actual HTTPS deployments are not established by them |

Each task should name its test boundary, environment, safe fixture setup,
cleanup, and expected failure. Reuse current tests and test runners rather than
adding a new framework or chasing an arbitrary coverage percentage.

## 12. Acceptance and reporting

**Development checkpoint:** relevant automated checks pass; smoke test is
recorded or explicitly Blocked; no known P0 failure in the tested surface.
Mock-only success must remain labeled as such.

**First-use pilot:** applicable P0/P1 scenarios have evidence, including real
hosted auth/saves/isolation, recovery, and intended browsers. Any untested case
is reported as Not run/Blocked, not silently waived.

**Full MVP/public release:** all shipped-feature gates, production/device
checks, deletion/privacy controls, migration/backup procedures, and approved
operational requirements are complete. A first-use smoke pass cannot satisfy
this release gate.

Stop and preserve safe evidence for any wrong-owner exposure, lost draft,
silent overwrite, duplicate committed effect, or false-save message. Do not
work around it by deleting data, disabling assertions, or retrying indefinitely.
Retest a fix with the reproducing regression and related flows.

### Run record template

Copy this into a private test record or a sanitized issue. Keep credentials,
real inbox details, callback links, session payloads, and private traces out.

```text
Commit / dirty-tree changes:
Tester role (no personal contact details):
Environment: local mocked / local + development Supabase / HTTPS staging
Browser and version / OS / device / time zone:
Prerequisites and synthetic fixture label:
Commands and exit results:
Case IDs tested:
Result per case: Pass / Fail / Blocked / Not run / Not implemented
Expected versus actual behavior:
Reproduction steps and sanitized evidence:
Defect priority / issue reference:
Retest commit and result:
Remaining gaps / owner for next action:
Synthetic cleanup performed / records intentionally retained:
Preview restored and reachable (if it was stopped):
```

Keep the plan stable in source control; keep sensitive run artifacts outside it.
Update the inventory and relevant cases as features/tests change. Do not mark
completion merely because a test has been written.
