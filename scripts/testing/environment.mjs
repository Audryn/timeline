export const localOrigins = Object.freeze({
  test: "http://127.0.0.1:3100",
  unit: "http://127.0.0.1:3100",
  db: "http://127.0.0.1:3100",
  browser: "http://127.0.0.1:3100",
  quality: "http://127.0.0.1:3100",
  built: "http://127.0.0.1:3101",
  typecheck: "http://127.0.0.1:3101",
  lint: "http://127.0.0.1:3100",
});

/**
 * @param {{ lane: keyof typeof localOrigins, providerOrigin?: string }} options
 * @param {NodeJS.ProcessEnv} inherited
 * @returns {Record<string, string> & {NODE_ENV: "development" | "production" | "test"}}
 */
export function localEnvironment({ lane, providerOrigin }, inherited = process.env) {
  if (!Object.hasOwn(localOrigins, lane)) {
    throw new Error("Unknown local test lane. Deployed/provider checks require their own runner.");
  }
  if (providerOrigin !== undefined) {
    const url = new URL(providerOrigin);
    if (lane !== "built" || url.protocol !== "http:" || url.hostname !== "127.0.0.1" ||
        !url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("A built-app provider fixture must be an explicit HTTP 127.0.0.1 origin with a port.");
    }
    providerOrigin = url.origin;
  }
  const env = Object.fromEntries(Object.entries(inherited).filter(([, value]) => value !== undefined));
  for (const name of Object.keys(env)) {
    if (/supabase|^app_origin$|^timeline_|^node_options$|^(https?|all)_proxy$/i.test(name)) {
      env[name] = "";
    }
  }
  const mode = lane === "built" || lane === "typecheck" ? "built" : "browser";
  return {
    ...env,
    APP_ORIGIN: localOrigins[lane],
    SUPABASE_URL: providerOrigin ?? "",
    SUPABASE_PUBLISHABLE_KEY: providerOrigin ? "sb_publishable_timeline_local_fixture" : "",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_SECRET_KEY: "",
    TIMELINE_PROVIDER_ADMIN_KEY: "",
    TIMELINE_PROVIDER_MAIL_ORIGIN: "",
    NODE_ENV: lane === "built" || lane === "typecheck" ? "production"
      : lane === "browser" || lane === "quality" ? "development" : "test",
    TIMELINE_TEST_MODE: mode,
    TIMELINE_TEST_LANE: lane,
    NEXT_TELEMETRY_DISABLED: "1",
    TZ: "UTC",
    NODE_OPTIONS: `--import="${new URL("./network-guard.mjs", import.meta.url).href}"`,
  };
}
