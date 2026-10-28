import { NextResponse } from "next/server";
import { appOrigin, supabase } from "@/lib/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/account", appOrigin());
  try {
    const client = await supabase();
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
  return NextResponse.redirect(destination, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
