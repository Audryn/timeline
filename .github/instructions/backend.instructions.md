---
applyTo: "src/app/api/**/*.ts,src/lib/server.ts,src/lib/client.ts,src/lib/drafts.ts,src/features/events/form.ts,src/domain/**/*.ts,src/proxy.ts,supabase/**/*.sql"
---

# Backend, domain, and persistence

- Keep Supabase access behind same-origin server routes. No authenticated
  browser Supabase client or client-exposed account/service credentials.
- Reuse `src/lib/server.ts`: verified identity, write-origin checks, bounded
  JSON validation, private/no-store responses, and explicit errors.
- Create request-scoped Supabase clients. Keep auth cookies HttpOnly,
  SameSite, and Secure in production; preserve refresh cookie/cache behavior.
  Do not cache authenticated responses or redirect tokens through shared caches.
- Use the exact configured `APP_ORIGIN` and fixed callback destinations.
  `localhost` on a phone is not the development PC; deployed auth needs HTTPS
  plus matching Supabase Site URL/redirect settings.
- Derive ownership from authenticated identity, never payload owner fields.
  Enforce same-owner/same-project relationships, RLS, and restricted grants.
- Aggregate mutations must be atomic and versioned. Reuse request identities
  only for identical payloads; reject stale versions without partial changes.
  Do not bypass these rules with direct client writes or update-as-upsert.
- Keep errors useful but redact credentials/content. Do not log raw provider
  exceptions if they may include tokens, URLs, or personal journal text.
- New database changes belong in new forward migrations. Do not edit a
  migration already applied to a shared environment as a deployment strategy.
  Review compatibility and data preservation before changing existing schemas.
- Keep PostgreSQL and TypeScript date shapes equally strict. Civil Gregorian
  components must not acquire browser-time-zone timestamps. Preserve year,
  month, season, approximate/custom/unknown precision and open ongoing ends.
- Season bounds use project hemisphere and the year a season starts.
  Placement bounds are not assertions of exact occurrence.
- Date filters use overlap; Undated is explicit. OR within one selected filter,
  AND across filter types. Compose one PostgREST logic tree per scope so search
  and date conditions cannot overwrite each other.
- Dexie stores owner/project-scoped drafts, not canonical event replicas.
  Preserve revision checks and uncertain-request payloads. Local cleanup and
  sign-out must not silently lose work or expose another account's drafts.
- Future private media needs separate readiness/transfer state and
  server-validated scoped storage access. A metadata save is not a completed
  file upload. Do not proxy large recordings through an unbounded JSON route.
- Do not add automatic offline replay, a sync engine, or schema/storage
  features outside the approved task just because the long-term plan mentions them.
