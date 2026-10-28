import { URL } from "node:url";

export class DeploymentPolicyError extends Error {}

function origin(value) {
  if (!value) throw new DeploymentPolicyError("Set both the deployment origin and its separately approved origin.");
  let url;
  try { url = new URL(value); }
  catch { throw new DeploymentPolicyError("Deployment targets must be valid HTTPS origins."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new DeploymentPolicyError("Deployment targets must be exact HTTPS origins without credentials, paths, or queries.");
  }
  return url.origin;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function deploymentConfig(env, mode) {
  if (mode !== "public" && mode !== "read") throw new DeploymentPolicyError("Choose the public or read lane explicitly.");
  const target = origin(env.TIMELINE_DEPLOYED_ORIGIN);
  if (target !== origin(env.TIMELINE_APPROVED_ORIGIN)) {
    throw new DeploymentPolicyError("The deployment target does not match the explicitly approved origin.");
  }
  if (mode === "public") return { origin: target, mode };
  if (env.TIMELINE_ALLOW_SYNTHETIC_AUTH !== "yes") {
    throw new DeploymentPolicyError("Synthetic authentication requires explicit approval.");
  }
  if (!env.TIMELINE_SYNTHETIC_EMAIL || !env.TIMELINE_SYNTHETIC_PASSWORD ||
      !uuid.test(env.TIMELINE_SYNTHETIC_OWNER_ID ?? "") || !uuid.test(env.TIMELINE_SYNTHETIC_PROJECT_ID ?? "")) {
    throw new DeploymentPolicyError("The read lane requires a dedicated synthetic account and pinned owner/project IDs.");
  }
  return {
    origin: target, mode,
    email: env.TIMELINE_SYNTHETIC_EMAIL,
    password: env.TIMELINE_SYNTHETIC_PASSWORD,
    ownerId: env.TIMELINE_SYNTHETIC_OWNER_ID,
    projectId: env.TIMELINE_SYNTHETIC_PROJECT_ID,
  };
}

export function requestPolicy(config) {
  let count = 0;
  const authentication = new Map();
  return (method, input) => {
    const url = new URL(input, config.origin);
    if (url.origin !== config.origin || url.username || url.password || ++count > 100) {
      throw new DeploymentPolicyError("Blocked a foreign target or excessive request count.");
    }
    const verb = method.toUpperCase();
    const page = ["/", "/account", "/projects"].includes(url.pathname) ||
      config.mode === "read" && url.pathname === `/projects/${config.projectId}`;
    const asset = url.pathname.startsWith("/_next/static/") ||
      ["/favicon.ico", "/file.svg", "/globe.svg", "/next.svg", "/vercel.svg", "/window.svg"].includes(url.pathname);
    const session = url.pathname === "/api/session";
    const project = config.mode === "read" && (
      url.pathname === "/api/projects" ||
      url.pathname === `/api/projects/${config.projectId}` ||
      url.pathname === `/api/projects/${config.projectId}/events`
    );
    if (verb === "GET" && (page || asset || session || project)) {
      const allowedKeys = page ? ["mode", "_rsc"] : session ? [] : project ? ["offset", "undated", "q", "person", "category", "from", "to"] : null;
      if (allowedKeys && [...url.searchParams.keys()].some((key) => !allowedKeys.includes(key))) {
        throw new DeploymentPolicyError("Blocked an unexpected read parameter.");
      }
      if (page && url.searchParams.has("mode") &&
          (url.pathname !== "/account" || !["signin", "signup", "reset", "resend"].includes(url.searchParams.get("mode")))) {
        throw new DeploymentPolicyError("Only ordinary public account navigation is allowed.");
      }
      if (project && url.searchParams.has("offset") && url.searchParams.get("offset") !== "0") {
        throw new DeploymentPolicyError("Bulk enumeration is not permitted by deployed probes.");
      }
      return;
    }
    const isAuth = ["/api/auth/signin", "/api/auth/signout"].includes(url.pathname);
    if (config.mode === "read" && verb === "POST" && isAuth && !url.search) {
      const previous = authentication.get(url.pathname) ?? 0;
      if (previous !== 0) throw new DeploymentPolicyError("Repeated synthetic authentication is not permitted.");
      authentication.set(url.pathname, previous + 1);
      return;
    }
    throw new DeploymentPolicyError("Blocked a request outside the read-only deployment allowlist.");
  };
}
