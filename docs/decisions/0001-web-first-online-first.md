# ADR 0001: Web-first delivery with online saves and local drafts

Status: Accepted

## Context

The initial concept targeted native iOS with full local storage and custom
offline synchronization. That would require Mac/Xcode access and substantial
sync/conflict/deletion infrastructure before validating the timeline experience.

The project instead needs to begin on Windows and work in desktop/mobile
browsers. The user explicitly selected a web-first app developed on Windows,
with online-first saves and locally recoverable drafts.

## Decision

Use Next.js/React/TypeScript with Supabase accounts/Postgres/private storage
design, and Dexie/IndexedDB for recoverable browser work.

Canonical events are saved online through authenticated server endpoints.
A local draft is not a published event. Reconnection does not silently replay
drafts. Keep request idempotency and version checks for safe retry/concurrent
online edits, but do not build full replication in this MVP.

Native iOS, an Electron/Tauri desktop wrapper, custom two-way sync, and
PowerSync are outside the active approach unless a later decision changes it.

## Alternatives considered

- Native iOS first: stronger device integration, but Mac/toolchain prerequisites
  and a separate delivery path.
- Full offline-first web app: broader disconnected use, but browser storage
  constraints and a much larger replication/recovery contract.
- Online-only editing without drafts: simpler, but too easy to lose work during
  a transient connection failure.

## Consequences

- No Mac or GitHub account is needed to start local development.
- Browser/device testing matters; recording and private local speech cannot
  be assumed equivalent to native APIs.
- Local drafts remain subject to browser storage loss and do not replace
  backups. No guaranteed offline startup/navigation.
- Future native clients can reuse backend contracts/domain semantics, but
  their UI/device services are not automatically supplied by the web app.
- Hosted data remains sensitive provider-processed data, not app-managed
  end-to-end encrypted content.

## Evidence and verification

This captures the explicitly confirmed Windows/web-first direction and
online-first/local-draft choice from the initial design sessions, not the
superseded native implementation plan.

Preserve visible draft-versus-account status, explicit save after reconnect,
duplicate-request safety, conflict drafts, and account isolation. Check these
in draft/database tests and browser flows as the implementation evolves.

Related: [product brief](../product.md), [architecture](../architecture.md).
