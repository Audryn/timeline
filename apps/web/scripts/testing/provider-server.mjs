import process from "node:process";
import { spawn } from "node:child_process";
import { localEnvironment } from "./environment.mjs";
import { localProviderOrigin } from "./provider-policy.mjs";
import { stopOwnedTree } from "./process.mjs";

const api = localProviderOrigin(process.env.SUPABASE_URL ?? "");
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!key) throw new Error("Disposable stack public credentials are required.");
const env = {
  ...localEnvironment({ lane: "browser" }),
  SUPABASE_URL: api, SUPABASE_PUBLISHABLE_KEY: key,
  TIMELINE_PROVIDER_ADMIN_KEY: "", TIMELINE_PROVIDER_MAIL_ORIGIN: "",
  SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SECRET_KEY: "",
};
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  env, stdio: "inherit",
});
let closing = false;
function close() { closing = true; stopOwnedTree(child); }
process.once("SIGINT", close); process.once("SIGTERM", close);
child.once("error", () => { process.exitCode = 1; });
child.once("exit", (code) => { if (!closing) process.exitCode = code || 1; });
