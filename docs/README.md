# Project guidance and design history

This directory preserves the useful decisions from Timeline's initial design
sessions without requiring access to a particular chat, machine, or USB drive.
It is a starting point for ongoing curation, not a frozen transcript.

## Where guidance belongs

| File | Purpose |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Agent entry point and generated Next.js guidance |
| [Project instructions](../.github/copilot-instructions.md) | Short, durable repository-wide working rules |
| [Scoped instructions](../.github/instructions) | UI, backend/domain, and test rules for matching files |
| [README.md](../README.md) | Setup, commands, implementation milestone, and operational caveats |
| [Product brief](product.md) | Intended experience, vocabulary, scope, and constraints |
| [Architecture](architecture.md) | Current mechanisms, code map, and design invariants |
| [Proposed data model v3](design/Life%20Timeline%20App%20Draft%20Data%20Model%20%28MVP%29%20v3.md) and [SQL draft](design/timeline_schema_v3.sql) | Proposed sharing, contribution, transfer, and date structures; not implemented behavior or a deployable migration |
| [API contract](openapi.yaml) and [API notes](API.md) | Generated HTTP schemas, validation and preserved inconsistencies |
| [User flows](FLOWS.md) | Screen/API map for the web app and future native client |
| [Design tokens](DESIGN-TOKENS.md) | Shared light/dark palettes, Tailwind integration, exact compatibility values and exhaustive deviation audit |
| [Native preparation decision](decisions/0002-native-preparation-workspace.md) | Workspace and framework-neutral boundary scope |
| [Phone account decision](decisions/0003-phone-password-accounts.md) | Optional phone/password signup, SMS confirmation/recovery, and release gates |
| [Testing plan](testing-plan.md) | Manual cases, local automated checks, coverage gaps, and future release gates |
| [Testing runbook](testing-runbook.md) | Executable local/provider/deployed commands, safeguards, and troubleshooting |
| [Project plan](project-plan.md) | Dependency-linked automation milestones and remaining product gates |
| [Accepted web-first decision](decisions/0001-web-first-online-first.md) | Why the active approach differs from the original native plan |
| [Decision template](decisions/TEMPLATE.md) | Structure for proposing and recording later choices |

Copilot repository-wide and path-specific instructions are additive. The scoped
files have `applyTo` frontmatter. Agent/tool support varies; `AGENTS.md` points
agents to them explicitly rather than assuming every client loads every file.

## Keep these distinctions clear

- Current code and tests establish what is implemented. README's milestone
  summarizes it; product/architecture notes must not imply planned work is done.
- Accepted decisions explain intentional direction. Proposed decisions and
  templates are not permission to change runtime behavior.
- If code, instructions, or a requested change disagree, identify the conflict.
  Do not silently revive the earlier native/offline plan or weaken privacy.
- Task progress, local credentials, deployment-specific setup, and personal Git
  identities do not belong in always-loaded project instructions.

## Curation workflow

1. Identify a repeatable rule, a product requirement, or an architectural choice.
2. Put it in the smallest relevant file; link to a canonical explanation rather
   than copying the same paragraph into every instruction.
3. For a significant choice, copy `decisions/TEMPLATE.md` to the next numbered,
   descriptive filename. Start with status Proposed.
4. Record alternatives, tradeoffs, consequences, and the evidence/approval that
   makes a decision Accepted. Use repository links and non-sensitive examples.
5. Implement approved behavior with focused regressions; update affected docs
   in the same change. Mark replaced decisions Superseded and link both ways
   instead of deleting rationale.
6. Review for contradictions, stale status, broken links, overly broad scopes,
   and accidental secrets or machine-specific details before committing.

## Small rule template

For a new scoped instruction, create a `.instructions.md` file under
`.github/instructions`:

```markdown
---
applyTo: "apps/web/src/features/FEATURE/**/*.tsx"
---

# Feature guidance

- Required invariant: state the observable behavior to preserve.
- Existing mechanism: name the repository helper or boundary to reuse.
- Failure behavior: explain how errors and unsaved work stay visible.
- Verification: identify the focused existing test surface.
```

Replace the example scope and text; do not create unused instruction files for
features that do not exist yet. Keep instructions concise and actionable.
