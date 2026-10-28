# Timeline

A Windows-developed, responsive web app for personal life timelines and fictional characters.

## Workspace

Run commands from this repository root using Node 24 and the pinned pnpm
version (`corepack enable pnpm`). `apps/web` contains the Next.js app, its
server adapters, migrations and test runners. `packages/shared` contains
framework-neutral client contracts and design tokens. `docs` stays at root.
Use `corepack pnpm install --frozen-lockfile` to restore dependencies.

The private environment file belongs at `apps\web\.env.local`, not at root.
Do not overwrite an existing file or rerun already deployed migrations.
Local tests need no Supabase credentials. All shared-package tests are included
in the web unit lane. Different checkouts must not run fixed-port tests at once.

## Project guidance

Start with [AGENTS.md](AGENTS.md) and the
[instruction and design index](docs/README.md). They link the curated product
brief, architecture, scoped contributor guidance, and decision-record template.
Keep durable guidance there rather than relying on a particular chat session.

## Current milestone

This is the first-use implementation, not the finished MVP:

- Welcome, signup, verified-email callback, sign-in, reset-password, and server-only sessions.
- Atomic project + first-person + category creation; multiple projects and additional real/fictional people.
- Shared events, notes, location text, flexible Gregorian dates, vertical timelines, search, and filters.
- Account-scoped IndexedDB event drafts with explicit online saves, request replay protection, and stale-edit handling.
- Supabase migrations and real PostgreSQL-WASM integration tests for transactions and owner isolation.

Attachments, recording/transcription, guided prompts/stories, category editing, project/person editing, Trash/purge, account deletion, session lock, and PDF export are **not implemented yet**. Do not use this development build as the sole home for real personal histories or deploy it as a production-ready journal.

Without Supabase configuration the app displays setup guidance. It does not pretend to sign in or save cloud records. Browser tests mock APIs to exercise the interface; those are separate from the real database tests and do not prove hosted Supabase/email integration.

## Run on Windows

Node.js 24 LTS and npm are required. Node was installed using winget during the initial setup:

```powershell
winget install --id OpenJS.NodeJS.LTS --exact
```

Open a fresh PowerShell window after installation, then:

```powershell
# Run from your cloned or extracted timeline folder.
corepack pnpm install --frozen-lockfile
if (!(Test-Path apps\web\.env.local)) {
    Copy-Item apps\web\.env.example apps\web\.env.local
}
corepack pnpm dev
```

Open `http://localhost:3000`. The setup guide is also available at `http://localhost:3000/setup`.

## Connect a Supabase development project

1. Create a dedicated development project at `https://supabase.com/dashboard`. Do not use a production project containing other application data.
2. In its SQL Editor, run the entire `apps\web\supabase\migrations\202610200001_first_use.sql` migration once. Alternatively, use the Supabase CLI migration workflow. Future schema changes should also be migrations.
3. Set these values in the ignored `.env.local` file:

```dotenv
APP_ORIGIN=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use the project's **publishable key**, not a secret/service-role key. The app has no privileged admin client. Environment values stay on the application server; session credentials are stored in HttpOnly cookies, not exposed to browser JavaScript. Never commit `.env.local`.

For `SUPABASE_URL`, paste only the base project URL, not a dashboard address,
database connection string, `/rest/v1` endpoint, or another environment
assignment such as `NEXT_PUBLIC_SUPABASE_URL=...`. Preserve existing local
values when setting up an already-configured working copy.

4. In Supabase Auth, enable email/password with **Confirm email enabled**. Set a minimum password length of 12 to match the UI. Set Site URL to `http://localhost:3000` and allow these development redirect URLs:

```text
http://localhost:3000/api/auth/callback
http://localhost:3000/api/auth/callback?flow=recovery
```

Use the same hostname consistently. `localhost` and `127.0.0.1` are different origins; the app rejects mismatched write origins.

5. Configure email templates to use server-verifiable token hashes. For **Confirm signup**, replace the confirmation link target with:

```html
<a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&amp;type=signup">Confirm your email</a>
```

For **Reset password**, use:

```html
<a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&amp;type=recovery">Reset your password</a>
```

The callback also supports PKCE `code` exchanges, but those require the original browser's verifier cookie. Token-hash templates allow confirmation links to establish the session in the browser where the link is opened. Do not log callback query strings or include third-party analytics on callback/account pages.

For local development, open the confirmation email on the computer running
Timeline. On a phone, `localhost` points to the phone itself. Phone access needs
a reachable app address and matching auth settings; production auth needs HTTPS.

6. Configure a development-appropriate mail service/SMTP if needed. Supabase's default email service has restrictions/rate limits; it is not production mail delivery.
7. Restart the app after changing environment values. Register with an inbox you control, follow the confirmation link, create a project and its first person, then add an event.

The migration enables RLS, grants authenticated read access, and restricts aggregate writes to authenticated ownership-checking RPCs. It does not provision storage buckets or deletion jobs; those belong to later milestones.

## Save and recovery behavior

- Only a server acknowledgment means an event is saved to the account.
- In an open editor, drafts autosave into the current browser/profile's IndexedDB. Saving an event online is an explicit action.
- Unknown dates and unplaced custom wording appear in Undated. Seasons preserve their precision and use the project's hemisphere; cross-year seasons use their starting year.
- Multiple people/categories are OR selections within a filter, combined with AND across filter types. Date filters use overlap. Include Undated controls undated entries independently of the date window.
- A network failure can leave the save outcome uncertain. Retry the same stored request before editing; idempotency avoids duplicate writes.
- If an event changed elsewhere, compare the current account version with the retained draft, merge the draft, and explicitly choose the new base version before resubmitting.
- A second tab cannot silently overwrite the same recovered draft. Download a recovery copy before reopening a conflicting editor. Current browsers with Web Locks coordinate editing and prevent sign-out while another tab has an open editor.
- Sign-out warns about browser drafts and clears the current account's local draft data. Do not share a browser profile containing sensitive local drafts.
- Clearing site data, storage eviction, private browsing, or device loss can destroy unsaved drafts. A draft download is a sensitive recovery copy, not a supported import/backup format.
- Offline startup/navigation and automatic publishing after reconnection are not supported.

## Verification

Use the [testing plan](docs/testing-plan.md) for the manual smoke test,
scenario IDs, safe test data, focused commands, and release criteria.
It distinguishes local automation from real Supabase/email and device checks.
The [automated testing runbook](docs/testing-runbook.md) explains isolated
local lanes, disposable captured-email integration, and explicitly approved
read-only deployment probes. See the [project plan](docs/project-plan.md) for
remaining feature and infrastructure gates.

```powershell
corepack pcorepack pnpm test:local
```

The aggregate runs typecheck, lint, unit/components/routes, database contracts,
Edge browser scenarios, production-built HTTP checks, and automated web-quality
checks. See the runbook for focused lanes; `corepack pnpm test` and `test:e2e` remain
compatible shortcuts but do not cover every gate.

## Source control

Track application source, tests, SQL migrations, public assets, configuration,
`.env.example`, and both `package.json` and `pnpm-lock.yaml`. The lockfile
is source-controlled so `corepack pnpm install --frozen-lockfile` can reproduce the dependency versions.

Do not track `node_modules`, `.next`, build/export folders, test output,
coverage, logs, generated `next-env.d.ts`/`*.tsbuildinfo`, Supabase CLI local
state, or `.env.local`. These are ignored; local environment credentials must
be configured separately on each computer. `.gitattributes` keeps text line
endings consistent across Windows and other development environments.

Before committing:

```powershell
git status --short
git diff --cached
```

Check that the staged files contain no credentials or personal journal
content. Git records source changes, not the hosted Supabase database,
authentication users, or browser-only drafts. A local repository is not an
off-device backup until it is copied or pushed to an appropriate remote.

## Running the browser suite and production build

The browser suite starts/stops its own server on port 3100 and uses installed
Microsoft Edge. Its `.next-test-browser` output is separate from the manual
preview; the built-app lane uses `.next-test-built` on port 3101. Do not start
two lanes that share a test port/output or kill an unrelated process to reclaim
one. Stop servers using shared dependencies before `corepack pnpm install --frozen-lockfile`. No Supabase
credentials are required for local database tests: PGlite runs PostgreSQL with
isolated test auth roles. These tests do not replace real provider validation.

The GitHub Actions workflow is configured for Windows checks; its existence
does not establish a hosted run. It does not deploy or provision cloud resources.

For a local production build:

```powershell
corepack pnpm build
npm start
```

Public/private responses are served through nonce-based CSP with dynamic rendering and private no-store headers. For production, deploy to a supported Node host over HTTPS, set the exact HTTPS `APP_ORIGIN`, update the Auth Site URL/templates/redirect allowlist, and configure production email. Cookies require HTTPS when `NODE_ENV=production`; use the development server for local HTTP account testing.

## Remaining release prerequisites

- Configure and exercise hosted Supabase/email flows with two real test accounts.
- Finish media, stories, PDF, privacy/lifecycle, migration/backup/restore procedures, operational monitoring, and deletion/retention jobs.
- Validate real iPhone Safari/Android Chrome, accessibility, long recordings, large timelines, and export.
- Review hosting/provider data handling, privacy/support documents, backups, and costs. This app is not app-managed end-to-end encrypted.
