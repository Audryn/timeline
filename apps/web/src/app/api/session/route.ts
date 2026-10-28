import { api, configured, supabase } from "@/lib/server";

export async function GET(request: Request) {
  return api(request, async () => {
    if (!configured()) return { configured: false, user: null };
    const client = await supabase();
    const { data, error } = await client.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError" && error.status !== 401 && error.status !== 403) throw error;
    return {
      configured: true,
      user: data.user?.email_confirmed_at ? { id: data.user.id, email: data.user.email ?? "" } : null,
    };
  });
}
