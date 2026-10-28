import { credentialsSchema, emailInputSchema, passwordInputSchema } from "@timeline/shared/contracts";
import { ApiError, authenticated, body, type BackendDependencies } from "./core";

export async function session(dependencies: BackendDependencies) {
  if (!dependencies.configured()) return { configured: false, user: null };
  const client = await dependencies.createClient();
  const { data, error } = await client.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError" && error.status !== 401 && error.status !== 403) throw error;
  return {
    configured: true,
    user: data.user?.email_confirmed_at ? { id: data.user.id, email: data.user.email ?? "" } : null,
  };
}

export async function accountAction(request: Request, action: string, dependencies: BackendDependencies) {
  const client = await dependencies.createClient();
  if (action === "signup" || action === "signin") {
    const input = await body(request, credentialsSchema);
    if (action === "signup" && input.password.length < 12) throw new ApiError(400, "Use a password with at least 12 characters.");
    const result = action === "signup"
      ? await client.auth.signUp({ ...input, options: { emailRedirectTo: `${dependencies.appOrigin()}/api/auth/callback` } })
      : await client.auth.signInWithPassword(input);
    if (result.error) {
      if (result.error.status === 429) throw new ApiError(429, "Too many attempts. Please wait before trying again.");
      throw new ApiError(400, action === "signin" ? "Unable to sign in. Check your email, password, and email confirmation." : "Account setup failed. Please check your details or try signing in.");
    }
    if (action === "signup") return { message: "Check your inbox to confirm your email, then sign in." };
    if (!result.data.user?.email_confirmed_at) throw new ApiError(403, "Confirm your email before signing in.");
    return { message: "Signed in." };
  }
  if (action === "reset" || action === "resend") {
    const { email } = await body(request, emailInputSchema);
    const result = action === "reset"
      ? await client.auth.resetPasswordForEmail(email, { redirectTo: `${dependencies.appOrigin()}/api/auth/callback?flow=recovery` })
      : await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${dependencies.appOrigin()}/api/auth/callback` } });
    if (result.error) throw new ApiError(result.error.status === 429 ? 429 : 400, "The email could not be sent. Please wait and try again.");
    return { message: "If eligible, an email is on its way. Check your inbox and spam folder." };
  }
  if (action === "password") {
    const { password } = await body(request, passwordInputSchema);
    await authenticated(dependencies.createClient);
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new ApiError(400, "Password update failed. Please request a fresh reset link.");
    return { message: "Password updated. You can continue to your projects." };
  }
  if (action === "signout") {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new ApiError(503, "Sign-out failed. Please retry.");
    return { message: "Signed out." };
  }
  throw new ApiError(404, "Unknown account action.");
}

export async function accountCallback(request: Request, dependencies: BackendDependencies) {
  const url = new URL(request.url);
  const destination = new URL("/account", dependencies.appOrigin());
  try {
    const client = await dependencies.createClient();
    const token = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    const code = url.searchParams.get("code");
    const result = token && (type === "signup" || type === "recovery")
      ? await client.auth.verifyOtp({ token_hash: token, type })
      : code ? await client.auth.exchangeCodeForSession(code) : null;
    if (!result || result.error) {
      destination.searchParams.set("notice", "expired");
    } else if (type === "recovery" || url.searchParams.get("flow") === "recovery") {
      destination.searchParams.set("mode", "password");
    } else {
      destination.pathname = "/projects";
    }
  } catch (error) {
    console.error("Account callback failed", { type: error instanceof Error ? error.name : typeof error });
    destination.searchParams.set("notice", "failed");
  }
  return destination;
}
