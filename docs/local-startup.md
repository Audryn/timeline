# Starting Timeline locally on Windows

This guide starts the implemented app, not the proposed collaboration design.
Next.js serves both the web interface and its API; there is no separate API
server to launch. Use synthetic development data, not real personal histories.

## 1. Choose your Supabase backend

| Backend | What runs on your PC | Docker needed? |
| --- | --- | --- |
| Existing hosted development project | Timeline only; Supabase runs in the cloud | No |
| Local development stack | Timeline plus Supabase containers | Yes |
| No backend configured | Timeline's welcome/setup screens only; no account saves | No |

Keep using your existing backend unless you intend to switch. Inspect
`apps\web\.env.local` privately in an editor: a hosted project URL uses the
hosted path; a loopback URL such as `http://127.0.0.1:54321` uses Docker/local
Supabase. Never paste the file or its values into chat, screenshots, or Git.

Hosted and local Supabase have separate users and databases. Switching URLs
does not move accounts, records, or browser drafts. Preserve pending drafts
before switching; use a separate browser profile for each backend.

## 2. Open the repository and check Node

**PowerShell:** open your checkout, then run:

```powershell
# Replace this example if your checkout is elsewhere.
Set-Location C:\Users\dan\work\timeline
node --version
corepack --version
```

The root `package.json` requires **Node 24** and pins pnpm. Stop if `node`
reports another major version. Select your installed Node 24 installation or
install that major, open a fresh terminal, and check again. To diagnose which
installation PowerShell selected:

```powershell
Get-Command node | Select-Object Source
```

Do not install an unspecified "latest LTS"; it may select a different major.
If pnpm shims have not been enabled, run:

```powershell
corepack enable pnpm
```

**First checkout or missing/outdated dependencies only:** stop any Timeline
server using this checkout before restoring dependencies to avoid Windows locks.

```powershell
corepack pnpm install --frozen-lockfile
```

Do not reinstall dependencies on every startup.

## 3A. Hosted Supabase: normal startup

**Supabase Dashboard:** confirm your existing development project is available
and not paused. Docker Desktop and the Supabase CLI are not needed.

**`apps\web\.env.local`:** preserve your existing configuration. For an already
configured checkout, no edits or SQL execution are normally needed.

Proceed to [Start Timeline](#4-start-timeline).

### First-time hosted configuration only

Follow [Connect a Supabase development project](../README.md#connect-a-supabase-development-project)
for the full authentication and email-template setup.

**PowerShell:** create the ignored environment file only if absent:

```powershell
if (!(Test-Path apps\web\.env.local)) {
    Copy-Item apps\web\.env.example apps\web\.env.local
}
```

**`apps\web\.env.local`:** edit privately:

```dotenv
APP_ORIGIN=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
PHONE_AUTH_ENABLED=false
```

Use the base project HTTP(S) URL and its publishable key, not a database URL,
Dashboard URL, secret key, or service-role key. Do not overwrite another
backend's configuration accidentally.

**Supabase SQL Editor:** only for a dedicated development database where the
initial migration has not already been applied, copy its SQL contents:

```powershell
Get-Content -Raw apps\web\supabase\migrations\202610200001_first_use.sql |
    Set-Clipboard
```

Paste the **SQL contents**, not the filename or PowerShell command, into a new
SQL Editor query for the intended development project and run it once.
Do not rerun it on a configured database. Never apply
`docs\design\timeline_schema_v3.sql`; it is a nondeployable design reference.

**Supabase Dashboard:** enable email/password and email confirmation, set the
minimum password length to 12, and configure:

| Field | Value |
| --- | --- |
| Site URL | `http://localhost:3000` |
| Allowed redirect URL | `http://localhost:3000/api/auth/callback` |
| Additional allowed redirect URL | `http://localhost:3000/api/auth/callback?flow=recovery` |

Complete the signup/recovery token-hash email templates in the linked README.
Hosted email is delivered through the hosted project's configured mail service,
not the local captured-email inbox. Phone authentication is optional and
requires separate SMS-provider setup; leave it disabled unless configured.

## 3B. Docker and local Supabase: normal startup

Use this path only on a machine approved to run Docker, with Docker Desktop
and a compatible Supabase CLI already installed. Installation references:
[Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
and [Supabase CLI/local development](https://supabase.com/docs/guides/local-development/cli/getting-started).
This guide does not install tools or provision cloud services.

**Docker Desktop:** launch it from Windows and wait until its engine is running.
Use Linux containers for the Supabase stack.

**PowerShell, from the repository root:**

```powershell
docker info
supabase --version
Push-Location apps\web
supabase start
if ($LASTEXITCODE -eq 0) {
    supabase status
}
Pop-Location
```

Keep the output private: Supabase startup/status can display credentials.
Run these commands from `apps\web`, where the repository's `supabase` directory
is located, not from the root. Do not run `supabase init` over the existing
configuration. If the CLI is not on PATH, use its installed executable path.

On an initialized stack, `start` resumes local services and retained data.
On first creation, it initializes the database using repository migrations.
Do not use `supabase db reset` as a startup command: it destroys local data.
If you later pull new migrations, stop and review them before applying them;
starting containers is not proof that an existing database has been upgraded.

The checked-in configuration uses project ID `web` and standard Supabase ports.
Other checkouts/stacks can collide with it. If startup reports an occupied port
or an unexpected existing stack, identify it before proceeding; do not stop or
delete containers belonging to somebody else.

### Point Timeline at the local stack

**`apps\web\.env.local`:** on first local setup, create it using the guarded copy
in section 3A, then privately enter the local API URL and publishable key reported
by the CLI:

```dotenv
APP_ORIGIN=http://localhost:3000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=YOUR_LOCAL_PUBLISHABLE_KEY
PHONE_AUTH_ENABLED=false
```

If your compatible CLI exposes only a legacy `anon` key, use that public client
key, never its `service_role` or secret key. Use the actual status output rather
than assuming another stack's values. Never commit local keys or `.env.local`.

The checked-in local auth configuration enables email confirmation and points
callbacks to `http://localhost:3000`. It currently sets a backend password
minimum of 6; the app still requires passwords of at least 12 characters.
Local SMS signup/provider delivery is not configured.

| Local service | Default URL |
| --- | --- |
| Supabase API (backend URL, not the app) | `http://127.0.0.1:54321` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Captured development email | `http://127.0.0.1:54324` |

Open captured signup/recovery emails in the local email interface; this does not
send mail to an Internet inbox. Open confirmation links on the computer running
Timeline, using the same browser/profile that started signup when relying on
the default PKCE email flow.

## 4. Start Timeline

**PowerShell, from the repository root:** first check whether port 3000 already
has a listener:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, LocalPort, OwningProcess
```

If a known Timeline server is already responding, use it rather than starting
another. If the listener is unfamiliar, identify it; do not kill it to free the
port. Start your server when port 3000 is available:

```powershell
corepack pnpm dev --hostname localhost --port 3000
```

Leave that terminal open. Explicitly selecting port 3000 avoids silently moving
the app to a different port that would not match its origin/auth configuration.
Restart this command after changing `.env.local`.

**Browser:** open `http://localhost:3000`. The app and its API are served by
this same process. Setup guidance is at `http://localhost:3000/setup`.
Use `localhost` consistently for the app, not `127.0.0.1`.
The backend's loopback API URL can still use `127.0.0.1` as shown above.

**Second PowerShell terminal:** verify HTTP readiness:

```powershell
(Invoke-WebRequest http://localhost:3000).StatusCode
```

Expect `200`; a printed startup URL alone is not proof of readiness.
Then open `http://localhost:3000/api/session` privately in your browser.
`configured: true` means configuration is present, not proof that authentication,
mail delivery, or database migrations work.

For a complete manual check, sign in with a development account (or register
and confirm it), open/create a test project and person, and explicitly save a
synthetic event. Only the server acknowledgment means it reached the account;
a recoverable browser draft is not a cloud save.

## 5. Stop and restart safely

Close the event editor first so its latest browser draft can flush. Save
explicitly if you want the event stored in the account. Do not clear browser
storage or sign out casually with unsaved drafts.

**Timeline terminal:** press `Ctrl+C` to stop your Next.js server.

**Local Supabase only, PowerShell from the repository root:**

```powershell
Push-Location apps\web
supabase stop
Pop-Location
```

Use ordinary `stop` to retain local data for later startup. Do not add
`--no-backup`, run `db reset`, or delete Docker volumes. Quit Docker Desktop only
if no other work depends on it. Hosted Supabase needs no local shutdown.

Next time: start Docker Desktop and `supabase start` if using the local backend,
then run the Timeline command in section 4. No daily migration rerun or dependency
installation is needed.

## 6. Troubleshooting order

1. **App reachability:** check the terminal, Node 24, port 3000, and HTTP readiness.
2. **Session/configuration:** inspect `/api/session` privately and verify the
   environment file location, base URL, key type, and exact app origin. Restart
   Next.js after edits. Never print `.env.local` as a diagnostic.
3. **Backend:** for local Supabase, verify Docker and status from `apps\web`; for
   hosted Supabase, check the intended development project is running.
4. **Authentication/email:** check confirmation, redirects, callback templates,
   captured local mail versus hosted email delivery, and provider limits.
5. **Account reads/saves:** verify the implemented migrations were applied to
   the intended backend. Do not reset the database or apply the design SQL to
   work around a failed save.

The app is online-first, not an offline replica. A stopped backend may leave
browser drafts recoverable, but it does not permit account saves.

Automated testing is separate: see the [testing runbook](testing-runbook.md).
Normal local fixture tests need neither Docker nor hosted credentials.
`test:integration` starts a disposable Supabase stack and can conflict with the
manual stack's ports; it is not the command for launching your everyday app.
