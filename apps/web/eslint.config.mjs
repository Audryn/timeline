import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["scripts/testing/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly", fetch: "readonly", Buffer: "readonly", setTimeout: "readonly", clearTimeout: "readonly" },
    },
  },
  { files: ["**/*.{ts,tsx}"], plugins: { "react-hooks": hooks }, rules: hooks.configs.recommended.rules },
  globalIgnores([
    ".next/**",
    ".next-test-browser/**",
    ".next-test-built/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
