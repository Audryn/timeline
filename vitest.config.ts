import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { localEnvironment } from "./scripts/testing/environment.mjs";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };
const env = localEnvironment({ lane: "unit" });

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          env,
          include: ["src/**/*.test.ts", "tests/server/**/*.test.ts", "tests/unit/**/*.test.ts", "scripts/testing/**/*.test.mjs"],
          testTimeout: 30_000,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "component",
          environment: "jsdom",
          env,
          include: ["src/**/*.test.tsx", "tests/unit/**/*.test.tsx"],
          setupFiles: ["./scripts/testing/component-setup.ts"],
          testTimeout: 30_000,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          env: localEnvironment({ lane: "db" }),
          include: ["tests/integration/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
