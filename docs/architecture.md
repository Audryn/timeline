# Architecture and code map

## Current request and save paths

```text
Browser UI
  -> same-origin Next.js route handlers
  -> request-scoped Supabase client with server-managed session cookies
  -> authenticated reads under RLS / validated transactional write RPCs
  -> canonical Postgres records

Event editor
  -> owner/project-scoped Dexie draft with local revision
  -> explicit online save using a stable request identity and expected version
  -> server acknowledgment
  -> remove the acknowledged draft and reload canonical timeline data
```

This is not a local replica plus sync engine. Browser code does not create
an authenticated Supabase client. Planned binary transfers will need their
own private readiness/recovery protocol, not an assumption that metadata is
equivalent to an uploaded attachment.

## Where to change things

| Surface | Current location |
| --- | --- |
| Welcome, account, project pages | `apps/web/src/app` |
| Account forms | `apps/web/src/features/account` |
| Event editor and form/date conversion | `apps/web/src/features/events` |
| Project/people/timeline UI and filters | `apps/web/src/features/timeline` |
| Civil dates, schemas, query logic | `apps/web/src/domain` |
| Server auth/API helper | `apps/web/src/lib/server.ts` |
| Browser request helper | `apps/web/src/lib/client.ts` |
| IndexedDB draft schema/revision operations | `apps/web/src/lib/drafts.ts` |
| Account/project/event endpoints | `apps/web/src/app/api` |
| CSP, private headers, nonce propagation | `apps/web/src/proxy.ts` |
| Database schema/RLS/aggregate RPCs | `apps/web/supabase/migrations` |
| Unit/draft tests | Adjacent `apps/web/src/**/*.test.ts` |
| Real PostgreSQL contract tests | `apps/web/tests/integration` |
| Browser flows | `apps/web/tests/e2e` |

## Boundaries to preserve

### Authentication and privacy

`apps/web/src/lib/server.ts` owns server client/session setup, verified identity,
same-origin write checks, bounded schema-validated input, and safe errors.
Production cookies are Secure/HttpOnly/SameSite; authenticated responses must
not enter a shared cache. CSP nonces depend on dynamic root rendering.

Configuration uses server-side `APP_ORIGIN`, `SUPABASE_URL`, and
`SUPABASE_PUBLISHABLE_KEY`. Only names/placeholders belong in tracked files.
Keep URLs/redirects consistent; localhost is always the device opening the link.

### Ownership and transactional records

Projects belong to one owner. People/categories belong to a project. Event
associations must stay inside that project, with at least one participant.
Database grants restrict writes to approved functions; RLS scopes reads.

Aggregate saves validate expected versions and request identity/payload
fingerprints before committing content and links atomically. Retry the same
uncertain request rather than generating a new mutation. Reject stale edits
without losing the browser draft or silently upserting missing records.

### Dates and filtering

`apps/web/src/domain/dates.ts` preserves civil components, precision, and approximate
wording independently of time zones. PostgreSQL's date helpers must agree,
including strict JSON shape validation, leap days, and cross-year seasons.
Custom dates may have placement bounds; ongoing ranges keep an open end.

`apps/web/src/domain/filters.ts` composes conjunctive groups into a single PostgREST
logic parameter. Repeated scope-level OR parameters can discard conditions.
Timeline refresh must retain filter intent while resetting pagination and
reconciling canonical rows.

### Drafts and multiple tabs

Drafts are scoped by owner/project/entity context with expected local revisions.
IndexedDB writes are acknowledged separately from account saves. A pending
request retains its exact payload across ambiguous outcomes.

Open editors use Web Locks; sign-out must not discard another tab's editing.
Account changes hide private UI, flush pending edits where possible, and
clear private state. Preserve visibility/account-change revalidation and
explicit cleanup-failure feedback.

## Future mechanisms, not current capabilities

The selected design anticipates private resumable uploads, incremental recording
storage, optional local-only speech, paginated PDF generation, Trash/purge, and
account deletion. These need implementation, tests, and real-browser/provider
verification. Do not infer completed support from this architecture note.

Use [product requirements](product.md) for agreed boundaries and
[README.md](../README.md) for current setup/scripts. Toolchain versions and
installed packages come from `package.json`/`pnpm-lock.yaml`, not copied
version lists in design documents.
