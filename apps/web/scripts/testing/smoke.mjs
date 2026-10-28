import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { localEnvironment, localOrigins } from "./environment.mjs";
import { projectRoot, stopOwnedTree } from "./process.mjs";

const origin = localOrigins.browser;
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(Number(new URL(origin).port), "127.0.0.1", () => probe.close(resolve));
});
const child = spawn(process.execPath, ["scripts/testing/serve.mjs", "browser"], {
  cwd: projectRoot, env: localEnvironment({ lane: "browser" }), stdio: "inherit",
});
const exited = once(child, "exit");
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error("Owned app exited before readiness.");
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(3_000) });
      if (response.ok) { ready = true; break; }
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== "TimeoutError") throw error;
    }
    await setTimeout(1_000);
  }
  if (!ready) throw new Error("Owned app readiness timed out.");
  for (const path of ["/", "/account?mode=signin", "/projects", "/setup"]) {
    const response = await fetch(`${origin}${path}`);
    if (!response.ok) throw new Error(`App smoke failed for ${path}: HTTP ${response.status}.`);
  }
  const response = await fetch(`${origin}/api/session`);
  const session = await response.json();
  if (!response.ok || session.configured !== false || session.user !== null) {
    throw new Error("App smoke expected the isolated unconfigured session.");
  }
  console.log("PASS: app screens respond and anonymous session is honestly unconfigured.");
} finally {
  stopOwnedTree(child);
  await exited;
}
