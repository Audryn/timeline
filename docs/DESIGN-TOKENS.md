# Design tokens: appearance-preserving extraction

`packages/shared/tokens.ts` is the framework-neutral source of truth. This step
extracts the **existing** welcome, account and workspace styles; it does not
approve a redesign, normalize near-identical colors, change mobile breakpoints,
or approve/update screenshot baselines.

The subsequent approved mobile step adds a bottom navigation bar and
single-column workspace controls at 700px and below. Its colors, typography
and spacing use the same tokens; desktop rendering is unchanged. The four
deliberate new structural entries in `inventory.json` are listed separately:

| File | Context | Retained geometry |
| --- | --- | --- |
| `src/components/mobile-navigation.module.css` | Mobile breakpoint | `(max-width: 700px)` |
| `src/components/mobile-navigation.module.css` | Navigation destinations | `repeat(3, minmax(0, 1fr))` |
| `src/features/timeline/workspace.module.css` | Mobile breakpoint | `(max-width: 700px)` |
| `src/features/timeline/workspace.module.css` | Filters, civil inputs, projects | `minmax(0, 1fr)` |

These are additions, not replacements of the 831 original audit occurrences.
Safe-area geometry uses the browser's inset; bottom content clearance is
composed from shared spacing tokens. The audit now checks five stylesheets.

## Contract and commands

Run with the repository's Node 24 (native TypeScript stripping, no TS runtime
dependency). From the repository root in PowerShell:

```powershell
# Generate the committed variable sheet; first audit the handwritten CSS.
node apps\web\scripts\design\tokens.mjs
# Read-only: fail on missing/stale output, unknown vars, off-token declarations,
# or new, uninventoried structural dimensions/breakpoints.
node apps\web\scripts\design\tokens.mjs --check
# Reproduce the complete, occurrence-by-occurrence migration table on stdout.
node apps\web\scripts\design\tokens.mjs --inventory
```

From `apps\web`, the equivalent entry point is
`node scripts\design\tokens.mjs [--check | --inventory]`.
Generation changes **only** `apps/web/src/app/tokens.css`; check and inventory
never write files. Invalid arguments fail. No network, server, secrets,
environment configuration, TS runner, or browser is needed.

The generator reads the explicit token object, not values extracted from CSS.
`scripts/design/inventory.json` is historical audit evidence, **not** a source
used to generate tokens. Its table records all 831 original declaration and
numeric-media-query occurrences, with original line, file, selector/at-rule,
property, exact original value, chosen replacement and decision. There are 462
changed occurrences, including the nine legacy variable declarations relocated
to the generated sheet. Repeated declarations and responsive overrides have
separate rows. The table includes unchanged declarations so that retained
geometry and behavior are not hidden.

## Token choices

- **Brand:** existing forest, hover forest and gold.
- **Neutrals:** warm paper, ink, muted ink, line, surface, white and transparent.
- **Semantic success/warning/error:** the existing account information,
  warning and error foreground/background/border triples. Workspace notices
  and errors deliberately keep their different exact colors under
  `colors.light.compatibility`; they are not silently merged into these roles.
- **Spacing:** canonical `spacing.1/2/4/6/8` = **4/8/16/24/32px**.
  Other nonzero margins, padding, gaps, underline offsets and outline offsets
  use explicit `compatibility.spacing` values, including negative values and
  both original fluid gap expressions. No rounding to a grid occurred.
- **Type:** caption/small/body/heading/title = **12/14/16/24/32px**,
  existing system/serif stacks and regular/semibold/bold weights. Every other
  original size (including fluid clamps and distinct `rem` sizes), tracking,
  weight and line-height is preserved explicitly as compatibility typography.
  A `rem` size is not replaced with a nominally equivalent `px` size.
- **Radii:** control/card/circle = **8px/16px/50%**; the exact remaining
  radii are compatibility values.
- **Shadows:** story/account/project retain their entire original expressions,
  including subtly different translucent colors and the story's stacked sheet.
  They are named composites, not additional palette or spacing primitives.

There are **197 light/shared leaf values**, of which **154 are explicitly
compatibility values**, and **19 dark overrides**. Reuse semantic/canonical
values when they are exactly equal; compatibility values document intentional
non-normalization, not a preferred new scale. The table's `structural` decision
can include both tokenized color and retained geometry (for example a border).
An unchanged `behavior` row can contain a pre-existing named variable; its
replacement column shows that preserved alias directly.

## Remaining literals and audit boundary

The complete table is the exhaustive retained-literal inventory. The 122
`structural` rows retain the existing box geometry and responsive rules:
container/text widths; control minimum heights; rail/dot/icon dimensions and
positions; grid tracks/ratios; border/outline/stroke thicknesses; percentages;
transforms; transition durations; and numeric breakpoints. These are geometry
or behavior, not an excuse to leave component margins, padding, gaps, colors,
font sizes or typography untokenized. Structural rows also document tokenized
border colors alongside their unchanged `1px`/`2px`/`3px` thickness.

Zero and layout/inheritance keywords (`auto`, `none`, `inherit`, `normal`,
`currentColor`, etc.) remain literals. Unitless opacity, z-index, flex factors,
stroke widths, and ordering are unchanged behavior/geometry in their own table
rows, not new spacing values. Existing reduced-motion behavior is unchanged.

The PostCSS-based audit walks **all** handwritten `src/**/*.css`, not just the
original modules. It rejects literal colors, literal typography/spacing/radii/
shadows, new custom-property definitions outside the generated sheet, unknown
variables, and nonzero dimensioned geometry/breakpoints without an exact
file/context/property/value inventory entry. It inspects variable fallbacks
rather than exempting them. Thus adding a compatibility token is a visible
source change, not automatic approval of a visual difference.

The inventory is a historical snapshot: do not regenerate it from already
tokenized CSS or use it to bless new screenshots. An approved later redesign
must explain its changed tokens/geometry and deliberately revise applicable
structural audit entries. The audit is a CSS declaration check, not an
accessibility, contrast, browser, screenshot or TS/JS inline-style checker.

## Tailwind v3 and CSS integration

`apps/web/postcss.config.mjs` enables Tailwind v3 and Autoprefixer.
`tailwind.config.ts` imports `@timeline/shared/tokens` and maps colors, spacing,
type, families, weights, line heights, tracking, radii and shadows to the same
generated variables. Theme scales replace default Tailwind scales rather than
quietly offering unrelated defaults. Canonical utilities include `p-4`
(16px), `text-body`, `bg-brand-forest`, `rounded-card`, and `shadow-story`;
compatibility spacing/type/radius utilities are prefixed `compat-`.
Color utilities use CSS variables; no separate hardcoded Tailwind palette is
maintained. Opacity modifiers are not defined for these whole-color variables.

`globals.css` imports `tokens.css` **first**, before `@tailwind base`.
The original handwritten reset remains in its existing order and with the
same resolved values. Components/utilities follow it. **Preflight is disabled**:
Tailwind must not replace the reset or change native control/heading defaults.
Tailwind may emit internal `--tw-*` initializers, not a second visual reset.

The existing `--paper`, `--ink`, `--muted`, `--green`, `--line`, `--surface`,
`--soft-green`, `--gold` and `--danger` names are generated aliases. They do
not require another runtime import or an import after CSS rules.

Light is always the default, regardless of OS preference. Dark core palettes
exist for explicit future use through `:root[data-theme="dark"]`; nothing in
this step sets that attribute or listens to `prefers-color-scheme`.
Compatibility colors and shadows intentionally remain historical light values
even under this opt-in: **the dark theme is not a finished or approved UI**.
Its visual/accessibility acceptance, mobile redesign and screenshot comparison
remain separate gates.
