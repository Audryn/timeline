import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import postcss from "postcss";
import { tokens, tokenVariable } from "../../../../packages/shared/tokens.ts";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const sourceRoot = path.join(webRoot, "src");
const generatedPath = path.join(sourceRoot, "app", "tokens.css");
const inventoryPath = new URL("./inventory.json", import.meta.url);
const aliases = {
  paper: "color.neutral.paper", ink: "color.neutral.ink", muted: "color.neutral.muted",
  green: "color.brand.forest", line: "color.neutral.line", surface: "color.neutral.surface",
  "soft-green": "color.compatibility.softGreen", gold: "color.brand.gold",
  danger: "color.semantic.error.foreground",
};

export function flatten(tree, prefix = "", result = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[name] = value;
    else flatten(value, name, result);
  }
  return result;
}

const { colors, ...scales } = tokens;
export const lightTokens = { ...flatten(colors.light, "color"), ...flatten(scales) };
const darkTokens = flatten(colors.dark, "color");
const values = Object.fromEntries(Object.entries(lightTokens).map(([key, value]) => [tokenVariable(key), value]));
for (const [key, target] of Object.entries(aliases)) values[`--${key}`] = `var(${tokenVariable(target)})`;

function declarations(entries) {
  return Object.entries(entries).map(([key, value]) => `  ${tokenVariable(key)}: ${value};`).join("\n");
}

export function generatedCss() {
  return [
    "/* Generated from packages/shared/tokens.ts. Run node scripts/design/tokens.mjs; do not edit. */",
    ":root {",
    declarations(lightTokens),
    ...Object.entries(aliases).map(([alias, target]) => `  --${alias}: var(${tokenVariable(target)});`),
    "}", "",
    "/* Explicit opt-in only. Compatibility colors remain the historical light values. */",
    ':root[data-theme="dark"] {',
    "  color-scheme: dark;",
    declarations(darkTokens),
    "}", "",
  ].join("\n");
}

export function context(declaration) {
  const ancestors = [];
  let node = declaration.parent;
  while (node && node.type !== "root") {
    if (node.type === "atrule") ancestors.unshift(`@${node.name} ${node.params}`);
    else if (node.type === "rule") ancestors.unshift(node.selector);
    node = node.parent;
  }
  return ancestors.join(" / ").replace(/\r\n?/g, "\n");
}

const tokenProperties = /^(?:font(?:-size|-family|-weight)?|line-height|letter-spacing|(?:padding|margin)(?:-.+)?|(?:row-|column-)?gap|border(?:-(?:top-left|top-right|bottom-left|bottom-right))?-radius|box-shadow|text-underline-offset|outline-offset)$/;
const colorLiteral = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|transparent|red|green|blue|yellow|orange|purple|gray|grey|rebeccapurple)\b/i;
const colorProperties = /^(?:color|background(?:-color)?|(?:border(?:-(?:top|right|bottom|left))?|outline|text-decoration)(?:-color)?|fill|stroke|accent-color|caret-color)$/;
const neutral = /^(?:0|auto|none|normal|inherit|initial|unset|revert|revert-layer|currentColor)$/i;

function withoutVariables(value) {
  // Fallbacks are deliberately inspected, not silently exempted.
  return value.replace(/var\(--[\w-]+\)/g, "");
}

export function auditCss(css, file, structural = new Set()) {
  const failures = [];
  const root = postcss.parse(css, { from: file });
  root.walkDecls((declaration) => {
    const { prop, value } = declaration;
    if (prop.startsWith("--")) {
      failures.push(`${file}:${declaration.source.start.line}: custom properties belong in shared tokens (${prop})`);
      return;
    }
    for (const match of value.matchAll(/var\((--[\w-]+)/g)) {
      if (!(match[1] in values)) failures.push(`${file}:${declaration.source.start.line}: unknown token ${match[1]}`);
    }
    const rest = withoutVariables(value).trim();
    const hasColor = colorLiteral.test(rest)
      || (colorProperties.test(prop) && /[a-z]/i.test(rest.replace(/\b(?:solid|dashed|dotted|double|none|inherit|initial|unset|revert|revert-layer|currentColor|auto|inset|outset|groove|ridge|underline|overline|line-through|blink|wavy)\b/gi, "").replace(/-?[\d.]+(?:px|rem|em|%|vh|vw)?/g, "")));
    if (hasColor || (tokenProperties.test(prop) && rest.split(/\s+/).some((part) => part && !neutral.test(part)))) {
      failures.push(`${file}:${declaration.source.start.line}: off-token ${prop}: ${value}`);
    }
    // Nonzero dimensions outside token properties are explicitly inventoried
    // geometry (including borders, breakpoints, transforms and grid tracks).
    if (!tokenProperties.test(prop) && /-?(?:\d*\.)?\d+(?:px|rem|em|%|vh|vw|fr|ms|s)(?![\w-])/.test(rest)) {
      const key = JSON.stringify([file, context(declaration), prop, value]);
      if (!structural.has(key)) failures.push(`${file}:${declaration.source.start.line}: uninventoried structural literal ${prop}: ${value}`);
    }
  });
  root.walkAtRules((rule) => {
    if (rule.name === "media" && /\d/.test(rule.params)) {
      const key = JSON.stringify([file, `@media ${rule.params}`, "@media", rule.params]);
      if (!structural.has(key)) failures.push(`${file}:${rule.source.start.line}: uninventoried breakpoint ${rule.params}`);
    }
  });
  return failures;
}

async function cssFiles(directory) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await cssFiles(location));
    else if (entry.name.endsWith(".css") && location !== generatedPath) files.push(location);
  }
  return files;
}

function markdown(inventory) {
  const escape = (text) => String(text).replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
  const lines = [
    "| File | Original line | Selector / at-rule | Property | Original value | Tokenized value / retained geometry | Decision |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
  ];
  for (const [file, entries] of Object.entries(inventory.files)) {
    for (const entry of entries) {
      lines.push(`| ${[file, entry.line, entry.context, entry.property, entry.original, entry.replacement, entry.decision].map(escape).join(" | ")} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !["--check", "--inventory"].includes(args[0]))) {
    throw new Error("Usage: node scripts/design/tokens.mjs [--check | --inventory]");
  }
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  if (args[0] === "--inventory") {
    process.stdout.write(markdown(inventory));
    return;
  }
  const structural = new Set();
  for (const [file, entries] of Object.entries(inventory.files)) {
    for (const entry of entries) {
      if (entry.decision === "structural") structural.add(JSON.stringify([file, entry.context, entry.property, entry.replacement]));
    }
  }
  const failures = [];
  for (const file of await cssFiles(sourceRoot)) {
    failures.push(...auditCss(await readFile(file, "utf8"), path.relative(webRoot, file).split(path.sep).join("/"), structural));
  }
  const expected = generatedCss();
  if (args[0] === "--check") {
    let actual;
    try { actual = await readFile(generatedPath, "utf8"); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (actual !== expected) failures.push("src/app/tokens.css is missing or stale; run node scripts/design/tokens.mjs");
  }
  if (failures.length) throw new Error(failures.join("\n"));
  if (args[0] !== "--check") await writeFile(generatedPath, expected);
  const entries = Object.values(inventory.files).flat();
  const migrated = entries.filter((entry) => entry.original !== entry.replacement).length;
  console.log(`${args[0] === "--check" ? "Checked" : "Generated"} tokens.css: ${Object.keys(lightTokens).length} light/shared values, ${Object.keys(darkTokens).length} dark overrides; audited ${(await cssFiles(sourceRoot)).length} CSS files; ${entries.length} historical occurrences (${migrated} migrated).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
