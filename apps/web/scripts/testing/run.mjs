import { existsSync } from "node:fs";
import { join } from "node:path";
import { localEnvironment } from "./environment.mjs";
import { projectRoot, runNode } from "./process.mjs";

const [lane, ...args] = process.argv.slice(2);
const commands = {
  test: ["node_modules/vitest/vitest.mjs", "run"],
  unit: ["node_modules/vitest/vitest.mjs", "run", "--project", "unit", "--project", "component"],
  db: ["node_modules/vitest/vitest.mjs", "run", "--project", "db"],
  browser: ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.config.ts"],
  built: ["node_modules/@playwright/test/cli.js", "test", "--config", "scripts/testing/playwright.built.config.ts"],
  quality: ["node_modules/@playwright/test/cli.js", "test", "--config", "scripts/testing/playwright.quality.config.ts"],
  typecheck: ["node_modules/next/dist/bin/next", "typegen"],
  lint: ["node_modules/eslint/bin/eslint.js"],
};

async function run(lane, args = []) {
  if (!Object.hasOwn(commands, lane)) throw new Error("Choose an explicit local lane; deployed/provider checks use separate runners.");
  if (args.some((arg) => /^(?:--(?:base-?url|config|project)|-[cp])/i.test(arg))) {
    throw new Error("Local test commands do not accept target/config/project overrides. Use a test-name or file selector.");
  }
  const env = localEnvironment({ lane });
  const command = [...commands[lane]];
  command[0] = join(projectRoot, ...command[0].split("/"));
  const configIndex = command.indexOf("--config");
  if (configIndex !== -1 && !existsSync(join(projectRoot, ...command[configIndex + 1].split("/")))) {
    throw new Error(`The ${lane} lane is not implemented yet; missing ${command[configIndex + 1]}.`);
  }
  console.log(`\n[local:${lane}] isolated fixtures; no hosted provider credentials`);
  await runNode([...command, ...args], env);
  if (lane === "typecheck") {
    await runNode([join(projectRoot, "node_modules", "typescript", "bin", "tsc"), "--noEmit"], env);
    await runNode([join(projectRoot, "node_modules", "typescript", "bin", "tsc"), "--project", join(projectRoot, "../../packages/shared/tsconfig.json")], env);
  }
  if (lane === "lint") {
    await runNode(command, env, { cwd: join(projectRoot, "../../packages/shared") });
  }
}

try {
  if (lane === "local") {
    if (args.length) throw new Error("The local aggregate does not accept extra arguments.");
    for (const name of ["typecheck", "lint", "unit", "db", "browser", "built", "quality"]) await run(name);
  } else {
    await run(lane, args);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local test command failed.");
  process.exitCode = 1;
}
