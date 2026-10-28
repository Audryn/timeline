# 0002: Prepare shared HTTP contracts and design tokens for native clients

Status: Accepted for the Refactor experiment.

The web-first, online-first product decision remains in effect. This work does
not implement SwiftUI, offline synchronization, a separate API deployment, or
native authentication.

Use a pnpm workspace: `apps/web` contains Next.js and server-only Supabase
integration; `packages/shared` contains framework-neutral Zod contracts, the
typed HTTP client, and design tokens. Root `docs` describes flows and HTTP
contracts. Thin Next adapters preserve cookies, CSRF, redirects and private
headers; framework-neutral backend services receive their dependencies.

Existing API behavior and local draft/retry semantics remain unchanged.
Mobile layout and bottom navigation changes are explicitly approved.
Tailwind may use compatibility tokens to preserve existing dimensions.

The app's isolated runner owns local processes, includes shared-package tests,
and retains app-relative paths for fixtures and migrations. Fixed test ports
must not be used by concurrent checkouts. Actual provider acceptance remains
blocked until an approved Docker-capable runner executes that lane.
