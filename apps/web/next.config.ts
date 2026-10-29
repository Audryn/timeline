import type { NextConfig } from "next";
import { resolve } from "node:path";

const testMode = process.env.TIMELINE_TEST_MODE;
if (testMode && testMode !== "browser" && testMode !== "built") {
  throw new Error("TIMELINE_TEST_MODE must be browser or built; arbitrary build output paths are forbidden.");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: resolve(import.meta.dirname, "../..") },
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  ...(testMode ? {
    devIndicators: false,
    distDir: testMode === "browser" ? ".next-test-browser" : ".next-test-built",
    typescript: { tsconfigPath: `scripts/testing/tsconfig.${testMode}.json` },
  } : {}),
};

export default nextConfig;
