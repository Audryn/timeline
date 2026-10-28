import type { Config } from "tailwindcss";
import { tokens, tokenVariable } from "@timeline/shared/tokens";

type TokenTree = { readonly [key: string]: string | TokenTree };
type Variables<T> = { [K in keyof T]: T[K] extends string ? string : Variables<T[K]> };

function variables<T extends TokenTree>(tree: T, prefix: string): Variables<T> {
  return Object.fromEntries(Object.entries(tree).map(([key, value]) => [
    key,
    typeof value === "string" ? `var(${tokenVariable(`${prefix}.${key}`)})` : variables(value, `${prefix}.${key}`),
  ])) as Variables<T>;
}

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  corePlugins: { preflight: false },
  theme: {
    colors: { ...variables(tokens.colors.light, "color"), transparent: "transparent", current: "currentColor" },
    spacing: {
      ...variables(tokens.spacing, "spacing"),
      ...Object.fromEntries(Object.keys(tokens.compatibility.spacing).map((key) => [
        `compat-${key}`, `var(${tokenVariable(`compatibility.spacing.${key}`)})`,
      ])),
    },
    fontSize: {
      ...variables(tokens.typeScale, "typeScale"),
      ...Object.fromEntries(Object.keys(tokens.compatibility.fontSize).map((key) => [
        `compat-${key}`, `var(${tokenVariable(`compatibility.fontSize.${key}`)})`,
      ])),
    },
    fontFamily: variables(tokens.fontFamily, "fontFamily"),
    fontWeight: { ...variables(tokens.fontWeight, "fontWeight"), ...variables(tokens.compatibility.fontWeight, "compatibility.fontWeight") },
    lineHeight: { ...variables(tokens.lineHeight, "lineHeight"), ...variables(tokens.compatibility.lineHeight, "compatibility.lineHeight") },
    letterSpacing: variables(tokens.compatibility.letterSpacing, "compatibility.letterSpacing"),
    borderRadius: {
      ...variables(tokens.radii, "radii"),
      ...Object.fromEntries(Object.keys(tokens.compatibility.radii).map((key) => [
        `compat-${key}`, `var(${tokenVariable(`compatibility.radii.${key}`)})`,
      ])),
    },
    boxShadow: variables(tokens.shadows, "shadows"),
  },
  plugins: [],
} satisfies Config;
