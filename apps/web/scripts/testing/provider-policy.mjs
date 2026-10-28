import { URL } from "node:url";

export function localProviderOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("The integration stack must report a loopback HTTP API URL."); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Refusing non-local integration credentials or endpoint.");
  }
  return url.origin;
}

export function providerSettings(status) {
  const api = localProviderOrigin(status.API_URL ?? "");
  const mail = localProviderOrigin(status.INBUCKET_URL ?? status.MAILPIT_URL ?? "");
  const publicKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  const adminKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  if (!publicKey || !adminKey) throw new Error("The disposable stack did not supply both public and fixture-controller credentials.");
  return { api, mail, publicKey, adminKey };
}

export function captureLink(text, appOrigin, type) {
  const prefix = `${appOrigin}/api/auth/callback?`;
  const normalized = text.replaceAll("&amp;", "&");
  const matches = normalized.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  for (const candidate of matches) {
    if (!candidate.startsWith(prefix)) continue;
    const url = new URL(candidate);
    if (url.origin === appOrigin && url.pathname === "/api/auth/callback" &&
        url.searchParams.get("type") === type && url.searchParams.has("token_hash")) return url.href;
  }
  throw new Error("Captured mail did not contain the expected local application callback.");
}
