# Timeline project instructions

## Direction

Timeline captures personal life events and fictional character histories.
The active approach is a Windows-developed, responsive **web-first** app:
Next.js App Router, React, strict TypeScript, Supabase, and Dexie/IndexedDB.
Use the supported Node version and scripts declared in `package.json`.

The app is **online-first with recoverable local drafts**, not an offline
replica. Native iOS development and custom two-way offline sync were considered
earlier; do not reintroduce them without a new approved decision.

Read `README.md` for actual milestone status/setup, `docs/product.md` for
product boundaries, `docs/architecture.md` for mechanisms, and
`docs/decisions` for rationale. Planned capabilities are not implemented facts.

## Non-negotiable behavior

- A project owns multiple people/characters. A timeline is a view, not a
  separate record. Shared events appear once in a combined project timeline.
- Preserve date precision and wording. Never invent an exact date to make
  sorting easier. Keep TypeScript and PostgreSQL date/filter semantics aligned.
- Only server acknowledgment means an event is saved to the account.
  Browser-draft, uncertain-save, and cloud-saved states must stay distinct.
- Preserve drafts on failed saves and conflicts. Do not silently replay them,
  overwrite a newer edit, discard pending work, or leak it across accounts.
- Keep credentials/session tokens server-side. Use authenticated ownership
  checks, RLS, transactional mutations, expected versions, and idempotency.
- No fake account/save success, silent error fallback, cloud-transcription
  fallback, or claims of app-managed end-to-end encryption.
- Keep personal histories, credentials, email links/tokens, and real user data
  out of source, fixtures, logs, screenshots, and AI instruction files.

## Working approach

- Inspect existing patterns before editing; make focused changes and preserve
  unrelated work. Ask before changing scope, privacy, limits, or date behavior.
- Read the relevant installed Next.js guide as required by `AGENTS.md`;
  do not assume older framework APIs apply.
- Use shared domain schemas and existing request/draft helpers. Avoid `any`,
  redundant abstractions, and dependencies added only for convenience.
- Prefer Windows PowerShell examples and portable repository-relative paths.
  Use winget for suitable Windows tool installations; do not install tools
  merely to work around an uninvestigated failure.
- For substantial independent work, use bounded subagents with explicit file
  ownership and stop conditions. Keep architectural guidance/integration in
  the coordinating context. Do small tasks directly.
- Use intermediate rubber-duck reviews for meaningful architecture,
  persistence, authentication, and draft-lifecycle changes. Resolve findings
  with focused regressions; do not repeatedly delegate the same investigation.
- Do not start a large orchestration workflow or provision cloud services
  without explicit approval.

## Verification and source control

- Use the smallest relevant tests, then typecheck/lint/build where affected.
  Follow `.github/instructions/testing.instructions.md` for runner details.
  Documentation-only edits need link/scope/consistency checks, not app builds.
- Stop the project's dev server before `npm ci` or the browser suite. Windows
  dependency files can be locked, and Next permits one dev server per project.
- Do not overwrite an existing `.env.local` with `.env.example`. Never print
  its values. Supabase needs the base HTTP(S) project URL, not a copied
  environment assignment, dashboard URL, or database connection string.
- Track source, migrations, tests, and the npm lockfile. Do not track builds,
  dependencies, credentials, browser data, or logs; preserve `.gitignore`.
- On shared machines confirm the intended repository-local Git identity before
  committing. Do not infer it from the OS account or change global Git identity.
  Configure remotes, push, or change global Git trust settings only on request.
- Maintain the relevant instructions/design references when behavior changes.
  Record architectural changes as decisions rather than duplicating chat history.
