import { accountContactSchema, credentialsSchema, passwordInputSchema, phoneVerificationSchema } from "@timeline/shared/contracts";
import { ApiError, authenticated, body, hasVerifiedContact, type BackendDependencies } from "./core";

function requirePhone(dependencies: BackendDependencies) {
  if (!dependencies.phoneEnabled()) throw new ApiError(503, "Phone accounts are not enabled on this installation. Use email or contact support.");
}

export async function session(dependencies: BackendDependencies) {
  if (!dependencies.configured()) return { configured: false, user: null };
  const client = await dependencies.createClient();
  const { data, error } = await client.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError" && error.status !== 401 && error.status !== 403) throw error;
  return {
    configured: true,
    user: !error && data.user && hasVerifiedContact(data.user)
      ? { id: data.user.id, email: data.user.email ?? "", ...(data.user.phone ? { phone: data.user.phone } : {}) }
      : null,
  };
}

export async function accountAction(request: Request, action: string, dependencies: BackendDependencies) {
  const client = await dependencies.createClient();
  if (action === "signup" || action === "signin") {
    const input = await body(request, credentialsSchema);
    const phone = "phone" in input;
    if (phone) requirePhone(dependencies);
    if (action === "signup" && input.password.length < 12) throw new ApiError(400, "Use a password with at least 12 characters.");
    const result = action === "signup"
      ? await client.auth.signUp("phone" in input
        ? { ...input, options: { channel: "sms" } }
        : { ...input, options: { emailRedirectTo: `${dependencies.appOrigin()}/api/auth/callback` } })
      : await client.auth.signInWithPassword(input);
    if (result.error) {
      if (result.error.status === 429) throw new ApiError(429, "Too many attempts. Please wait before trying again.");
      throw new ApiError(400, action === "signin"
        ? phone ? "Unable to sign in. Check your phone number, password, and SMS confirmation."
          : "Unable to sign in. Check your email, password, and email confirmation."
        : "Account setup failed. Please check your details or try signing in.");
    }
    if (action === "signup") return { message: phone
      ? "Check your text messages and enter the six-digit code to confirm your phone number."
      : "Check your inbox to confirm your email, then sign in." };
    if (!hasVerifiedContact(result.data.user) || !(phone ? result.data.user?.phone_confirmed_at : result.data.user?.email_confirmed_at)) {
      throw new ApiError(403, phone ? "Confirm your phone number before signing in." : "Confirm your email before signing in.");
    }
    return { message: "Signed in." };
  }
  if (action === "reset" || action === "resend") {
    const input = await body(request, accountContactSchema);
    if ("phone" in input) {
      requirePhone(dependencies);
      const result = action === "reset"
        ? await client.auth.signInWithOtp({ phone: input.phone, options: { shouldCreateUser: false, channel: "sms" } })
        : await client.auth.resend({ type: "sms", phone: input.phone });
      if (result.error) throw new ApiError(result.error.status === 429 ? 429 : 400, "The text message could not be sent. Please wait and try again.");
      return { message: "If eligible, a text message is on its way. Enter its six-digit code." };
    }
    const { email } = input;
    const result = action === "reset"
      ? await client.auth.resetPasswordForEmail(email, { redirectTo: `${dependencies.appOrigin()}/api/auth/callback?flow=recovery` })
      : await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${dependencies.appOrigin()}/api/auth/callback` } });
    if (result.error) throw new ApiError(result.error.status === 429 ? 429 : 400, "The email could not be sent. Please wait and try again.");
    return { message: "If eligible, an email is on its way. Check your inbox and spam folder." };
  }
  if (action === "verify-phone") {
    requirePhone(dependencies);
    const input = await body(request, phoneVerificationSchema);
    const { data, error } = await client.auth.verifyOtp({ ...input, type: "sms" });
    if (error) throw new ApiError(error.status === 429 ? 429 : 400, "The code could not be verified. Check it or request a new text message.");
    if (!hasVerifiedContact(data.user) || !data.user?.phone_confirmed_at) {
      throw new ApiError(403, "Confirm your phone number before continuing.");
    }
    return { message: "Phone number confirmed." };
  }
  if (action === "password") {
    const { password } = await body(request, passwordInputSchema);
    await authenticated(dependencies.createClient);
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new ApiError(400, "Password update failed. Please request fresh password recovery.");
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
