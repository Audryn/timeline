# Timeline delivery plan

## Active direction

Deliver the Windows-developed, responsive web app described in the
[product brief](product.md) and [accepted web-first decision](decisions/0001-web-first-online-first.md).
Canonical records are online; browser drafts protect work in progress without
claiming full offline navigation or automatic publishing.

The current first-use application is a development milestone, not the full
MVP. [README](../README.md#current-milestone) is the implementation inventory.
Do not silently reintroduce the earlier native iOS/custom-sync plan.

## Test infrastructure workstream

| Milestone | Outcome | Current evidence / remaining gate |
| --- | --- | --- |
| Isolated local lanes | Explicit fixture environment, no hosted credentials/mail, owned server lifecycle | Local aggregate passed |
| Logic/components/routes | Domain/form/client rules, component behavior and actual route validation | 132 unit/component/route/shared tests passed |
| SQL/contracts | Actual PGlite migrations and request-policy containment | 80 tests passed; not actual Supabase Auth/PostgREST |
| Browser recovery | Edge storage/lock/account-transition, replay/conflict, filter/pagination, guarded mobile navigation | 23 browser cases passed |
| Web quality | Accessibility, focus/reflow, reviewed visual and informational metrics | 8 quality cases passed; human/device review remains |
| Built-app boundary | Actual Next HTTP/cookies/nonces/hydration and every documented operation with loopback provider | 4 cases passed; not HTTPS browser-cookie evidence |
| Shared design/API drift | Generated tokens, CSS literal inventory, OpenAPI/Zod and route/response contract agreement | Local aggregate passed; dark UI and native auth remain separate work |
| Real provider/captured email | Disposable Auth/PostgREST/database and Mailpit spec/runner | Passed: real captured signup/reset, atomic events, filters, owner isolation, replay/version checks and owned-stack cleanup |
| Deployed probes | Separate public/synthetic-read guards; no journal writes or emails | No-network guard tests pass; no actual deployment provisioned/tested |
| Runbook and acceptance | Commands, case/evidence map and reporting | Full local aggregate and disposable-provider lane passed; HTTPS deployment, Internet email and real-device acceptance remain unverified |

Use the [testing runbook](testing-runbook.md) for executable procedures and
[testing plan](testing-plan.md) for case IDs, manual evidence, and release gates.
These counts describe the implementation's local acceptance checkpoint, not a
permanent guarantee for future changes. Record the tested commit/dirty state and
rerun affected gates after edits. An unexecuted environment is not a pass.

The 2026-10-29 checkpoint exercised commit `5a601c1` with two working-tree
test-harness fixes: disable the development indicator only in automated
Next.js mode, and handle absent captured stdout when a successful provider
child inherits stdio. All 247 local cases and the real-provider scenario
passed, along with typecheck/lint, token/OpenAPI checks and app smoke.
The provider run used Supabase CLI 2.122.0 and Docker Engine 29.9.2 on ARM64.
The existing local stack was stopped with data retained, then restored;
account/project counts were unchanged and Auth/preview HTTP checks passed.

## Current external prerequisites

- The borrowed Windows PC does not need Docker for local tests.
- Real-provider automation requires a separately approved Docker/Supabase CLI
  runner with a pinned CLI and private mail capture; no hosted inbox is needed.
- No production deployment or production synthetic test account is provisioned
  by the test work. Deployed probes remain gated until these exist.
- Edge-only automation initially. Other engines and real mobile-device evidence
  remain an explicit follow-up, not implied compatibility.
- GitHub account/remote/hosted automation setup is optional separate work.

## Remaining product work

| Feature | Required verification before claiming support |
| --- | --- |
| Category/project/person editing | Historical links, versions and no orphaned shared events |
| Private photos/PDFs | Type/size limits, scoped access, resumable transfer, readiness and cleanup |
| Recording and local speech | Permissions, supported formats, limits/interruption recovery, editable text and no cloud fallback |
| Guided/written/spoken stories | Explicit save, manual event links, source preservation and duplicate prevention |
| Printable PDF | Stable filtered snapshot, actual pagination/fonts/images, omission decisions and sensitive-file handling |
| Trash, purge, account deletion and session lock | Recovery/deletion semantics, account isolation, stale-write rejection and honest browser limits |
| Release/operations | Real-provider/device/accessibility evidence, migrations, backup/restore, privacy/support and observability |

Future features must add focused automated cases in the appropriate lanes and
update the inventory; do not make a local mocked happy path stand in for
provider/device/privacy evidence.

## Acceptance policy

1. A local development checkpoint requires the relevant deterministic tests and
   integrated checks, with no silent draft loss, false saved state, duplicate
   committed effect or wrong-owner content.
2. Auth/SDK/SQL/filter-contract changes require actual disposable-provider
   evidence before release. Missing infrastructure is Blocked, not a passing skip.
3. Automated accessibility targets WCAG 2.2 AA checks, with remaining human
   screen-reader/usability/device assessment documented separately.
4. Production checks are bounded read-only confidence probes, with explicit
   synthetic authentication only. Mutation, email and destructive failure
   tests stay outside production.
5. Instructions, runbook, package scripts and CI configuration must agree.
   Record architectural changes with the [decision template](decisions/TEMPLATE.md).

Commit/push, cloud provisioning, secrets, and off-device backup updates require
their own authorization. Never infer the Git author from the borrowed PC's
operating-system account.
