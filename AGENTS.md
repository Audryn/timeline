# Timeline workspace

Read [.github/copilot-instructions.md](.github/copilot-instructions.md) and
[docs/README.md](docs/README.md) before making changes.
The Next.js app and its framework-specific guidance are in
[apps/web/AGENTS.md](apps/web/AGENTS.md). Shared client contracts and design
tokens belong in `packages/shared`; server-only provider code does not.

Run `corepack pnpm install --frozen-lockfile` and `corepack pnpm test:local`
from this directory. The web runner also exercises shared-package tests.
Never run test lanes concurrently in another checkout using ports 3100/3101.
