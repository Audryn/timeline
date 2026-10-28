import process from "node:process";
import console from "node:console";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { providerSettings } from "./provider-policy.mjs";
import { localEnvironment } from "./environment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mode = process.argv[2] ?? "check";
const command = process.env.TIMELINE_SUPABASE_CLI || "supabase";
let scratch;
let started = false;
let failed = false;
let completed = false;
let phase = "checking the approved Supabase CLI";
function execute(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root, encoding: "utf8", timeout: 600_000,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: "", SUPABASE_DB_PASSWORD: "", SUPABASE_PROJECT_ID: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "" },
    ...options,
  });
  if (result.error || result.status !== 0) throw new Error("Required integration command failed.");
  return result.stdout.trim();
}
try {
  if (mode === "--help") {
    console.log("Usage: node scripts/testing/provider.mjs check|run");
    console.log("Requires Docker, an installed Supabase CLI, TIMELINE_SUPABASE_VERSION matching that CLI, and available local stack ports.");
    console.log("Run creates an isolated temporary stack with captured mail; it never uses .env.local or a hosted project.");
  } else {
    if (!["check", "run"].includes(mode)) throw new Error("Choose check or run.");
    const version = execute(command, ["--version"]);
    if (!process.env.TIMELINE_SUPABASE_VERSION || version !== process.env.TIMELINE_SUPABASE_VERSION) {
      throw new Error("Pin TIMELINE_SUPABASE_VERSION to the installed approved CLI version.");
    }
    phase = "checking the Docker engine";
    execute("docker", ["info", "--format", "{{.ServerVersion}}"]);
    if (mode === "check") {
      console.log("PASS: external integration-runner prerequisites are available. No stack started.");
    } else {
      phase = "creating the isolated local stack configuration";
      scratch = await fs.mkdtemp(path.join(os.tmpdir(), "timeline-provider-"));
      await fs.mkdir(path.join(scratch, "supabase", "migrations"), { recursive: true });
      await fs.mkdir(path.join(scratch, "supabase", "templates"), { recursive: true });
      await fs.cp(path.join(root, "supabase", "migrations"), path.join(scratch, "supabase", "migrations"), { recursive: true });
      for (const name of ["confirmation", "recovery"]) {
        const type = name === "confirmation" ? "signup" : "recovery";
        await fs.writeFile(path.join(scratch, "supabase", "templates", `${name}.html`),
          `<a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&amp;type=${type}">Continue</a>`);
      }
      const projectId = path.basename(scratch).toLowerCase();
      await fs.writeFile(path.join(scratch, "supabase", "config.toml"), `
project_id = "${projectId}"
[api]
enabled = true
port = 54321
schemas = ["public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
port = 54322
shadow_port = 54320
major_version = 17
[studio]
enabled = false
[inbucket]
enabled = true
port = 54324
[auth]
enabled = true
site_url = "http://127.0.0.1:3100"
additional_redirect_urls = ["http://127.0.0.1:3100/api/auth/callback", "http://127.0.0.1:3100/api/auth/callback?flow=recovery"]
enable_signup = true
[auth.email]
enable_signup = true
enable_confirmations = true
double_confirm_changes = true
max_frequency = "1s"
[auth.email.smtp]
enabled = false
[auth.email.template.confirmation]
subject = "Timeline integration confirmation"
content_path = "./supabase/templates/confirmation.html"
[auth.email.template.recovery]
subject = "Timeline integration recovery"
content_path = "./supabase/templates/recovery.html"
`);
      // Never reset an existing instance. The unique project has a separate data volume.
      started = true;
      phase = "starting the owned local Supabase stack";
      execute(command, ["start", "--workdir", scratch], { stdio: ["ignore", "pipe", "pipe"] });
      const status = JSON.parse(execute(command, ["status", "--workdir", scratch, "--output", "json"]));
      const settings = providerSettings(status);
      phase = "executing the captured-mail provider tests";
      execute(process.execPath, [
        path.join(root, "node_modules", "@playwright", "test", "cli.js"), "test", "--config", "playwright.provider.config.ts",
      ], {
        stdio: "inherit",
        env: {
          ...localEnvironment({ lane: "browser" }),
          NODE_OPTIONS: "",
          APP_ORIGIN: "http://127.0.0.1:3100",
          SUPABASE_URL: settings.api,
          SUPABASE_PUBLISHABLE_KEY: settings.publicKey,
          TIMELINE_PROVIDER_MAIL_ORIGIN: settings.mail,
          TIMELINE_PROVIDER_ADMIN_KEY: settings.adminKey,
          TIMELINE_TEST_LANE: "provider",
        },
      });
      completed = true;
    }
  }
} catch {
  failed = true;
  console.error(`BLOCKED/FAIL: real integration stopped while ${phase}. Check that prerequisite on the separate approved runner. Hosted credentials and raw CLI output were not printed.`);
  process.exitCode = 1;
} finally {
  if (started && scratch) {
    try { execute(command, ["stop", "--no-backup", "--workdir", scratch]); }
    catch { failed = true; console.error("FAIL: owned integration-stack cleanup needs operator attention."); process.exitCode = 1; }
  }
  if (scratch && !failed) await fs.rm(scratch, { recursive: true, force: false });
  else if (scratch) console.error("An isolated temporary integration directory was retained for local operator inspection.");
}
if (completed && !failed) console.log("PASS: disposable provider lane and owned-stack cleanup completed.");
