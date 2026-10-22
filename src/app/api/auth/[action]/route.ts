import { z } from "zod";
import { api, ApiError, appOrigin, authenticated, body, supabase } from "@/lib/server";

const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) }).strict();
const emailOnly = z.object({ email: z.email().max(254) }).strict();

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return api(request, async () => {
    const { action } = await context.params;
    const client = await supabase();
    if (action === "signup" || action === "signin") {
      const input = await body(request, credentials);
      if (action === "signup" && input.password.length < 12) throw new ApiError(400, "Use a password with at least 12 characters.");
      const result = action === "signup"
        ? await client.auth.signUp({ ...input, options: { emailRedirectTo: `${appOrigin()}/api/auth/callback` } })
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
      const { email } = await body(request, emailOnly);
      const result = action === "reset"
        ? await client.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/api/auth/callback?flow=recovery` })
        : await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${appOrigin()}/api/auth/callback` } });
      if (result.error) throw new ApiError(result.error.status === 429 ? 429 : 400, "The email could not be sent. Please wait and try again.");
      return { message: "If eligible, an email is on its way. Check your inbox and spam folder." };
    }
    if (action === "password") {
      const { password } = await body(request, z.object({ password: z.string().min(12).max(128) }).strict());
      await authenticated();
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
  });
}
