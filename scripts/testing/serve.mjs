import net from "node:net";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { localEnvironment, localOrigins } from "./environment.mjs";
import { projectRoot, runNode } from "./process.mjs";

const lane = process.argv[2];
if (lane !== "browser" && lane !== "built") throw new Error("Serve requires browser or built.");
const env = localEnvironment({ lane, providerOrigin: process.argv[3] });
const port = Number(new URL(localOrigins[lane]).port);
const lockPath = join(projectRoot, "test-results", `${lane}.lock`);
await mkdir(join(projectRoot, "test-results"), { recursive: true });
let lock;
try {
  lock = await open(lockPath, "wx");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  const pid = Number(await readFile(lockPath, "utf8"));
  let alive = true;
  if (Number.isSafeInteger(pid) && pid > 0) {
    try { process.kill(pid, 0); } catch (error) { if (error.code === "ESRCH") alive = false; }
  }
  if (!alive) {
    await rm(lockPath);
    lock = await open(lockPath, "wx");
  } else {
    throw new Error(`Another ${lane} lane may be running. Do not stop unknown processes. If no lane is running, remove test-results\\${lane}.lock and retry.`);
  }
}
try {
  await lock.writeFile(String(process.pid));
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`Test port ${port} is occupied. Stop only your own test server, or wait; existing previews are never reused or killed.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
  if (lane === "browser") {
    // Discard only the stopped lane's generated HMR/cache state; never touch the manual preview.
    await rm(join(projectRoot, ".next-test-browser"), { recursive: true, force: true });
  }
  const next = join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  if (lane === "built") await runNode([next, "build"], env);
  await runNode([next, lane === "built" ? "start" : "dev", "--hostname", "127.0.0.1", "--port", String(port)], env);
} finally {
  await lock.close();
  await rm(lockPath, { force: true });
}
