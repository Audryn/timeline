# API contract and preserved inconsistencies

`pnpm api:generate` generates [openapi.yaml](openapi.yaml) from the shared Zod
schemas. `pnpm api:check` rejects stale/invalid specifications and runs real
production-mode Next HTTP contract checks against an isolated loopback provider.
These exercise the actual adapters, cookie jar and SDK, not mocked route
responses. They do **not** certify hosted Supabase, SQL, mail delivery or HTTPS
browser cookie behavior; the separate provider lane remains required.

No mutation-capable contract test accepts a deployed target. Never substitute
production URLs. Ordinary local gates include the HTTP contract tests.

## Preserved differences (not silently normalized)

| Surface | Existing behavior / consequence |
| --- | --- |
| Naming | Requests use camelCase (`requestId`, `personIds`); records use snake_case (`project_id`, `person_ids`). |
| Create/update statuses | Successful writes return 200, not 201; create project returns only `{id}`, add person returns the record, event save returns `{id,version}`. |
| Project list | Bare array, capped at 100 newest projects with no page or truncation indicator. |
| Event list | Envelope `{events,hasMore}`, offset pagination in fixed 50-row slices. Exactly 50 rows means `hasMore=true` even if there is no next row. |
| Missing resources | Project detail returns 404; event lookup/unavailable project's event list may return an empty array instead. Ownership-denied RPCs map to 403. |
| Filters | Repeated person/category query keys; only the literal `undated=false` excludes undated entries. Event lookup validates offset but bypasses remaining filters. |
| Authentication errors | Sign-in failure is normally 400, not 401. Private missing session is 401; unconfirmed email is 403. |
| Error payload | `{error:string}` without stable machine-readable code; SQL replay mismatch and stale-version errors both use 409. |
| Account endpoints | Public auth actions still require exact Origin. Sign-out ignores its body. Unknown actions are rejected after configuration/client setup. |
| Callback | Token-consuming GET returns 307 to fixed web screens instead of JSON; invalid/expired/provider failure usually redirects with a notice. |
| Callback header mismatch | The route sets `Referrer-Policy: no-referrer`, but the actual HTTP response is `same-origin` because the proxy overrides it. The spec records observed behavior; resolving the discrepancy is separate follow-up. |
| Event metadata | SQL view may include `created_at`/`updated_at`; the typed client retains only its declared event fields. |
| Cross-field rules | JSON Schema documents structure; Gregorian validity, range ordering, duplicate selections and transactional replay/version/ownership rules also require Zod and database validation. |

## Logic deliberately retained in clients

Form/date editing and validation feedback, filters/query selection, user-driven
navigation, accessibility focus, loading presentation, draft storage/revisions,
cross-tab coordination, recovery download/discard, and pending-request identity
are client responsibilities. None grants ownership or commits canonical records.
Backend services own verified identity, input validation, queries/error mapping
and calls to transactional RLS-protected database functions.

## Recommended next work

1. Design a native auth/deep-link contract and secure device session storage.
2. Execute disposable real-provider acceptance after these API-boundary changes.
3. Decide versioned API naming, stable error codes and cursor pagination as
   explicit behavioral changes, rather than bundling them into this refactor.
