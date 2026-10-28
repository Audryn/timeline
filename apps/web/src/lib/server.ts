import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createBackend } from "@/backend";
import { ApiError, authenticated as verifyAuthentication } from "@/backend/core";

export { ApiError, body, databaseError } from "@/backend/core";
export function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}
export function appOrigin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new ApiError(503, "Set APP_ORIGIN before using account features.");
  return new URL(value).origin;
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin()) {
    throw new ApiError(403, "This request must come from the Timeline website.");
  }
}
export async function supabase() {
  if (!configured()) throw new ApiError(503, "Timeline needs Supabase setup. See the local setup guide.");
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          jar.set(name, value, { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
        }
      },
    },
  });
}
export async function authenticated() {
  return verifyAuthentication(supabase);
}

export const backend = createBackend({ createClient: supabase, configured, appOrigin });

export async function api(request: Request, handler: () => Promise<unknown>) {
  try {
    if (!["GET", "HEAD"].includes(request.method)) checkOrigin(request);
    return NextResponse.json(await handler(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof ApiError)) console.error("Unexpected API failure", { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json(
      { error: error instanceof ApiError ? error.message : "The request failed. Please retry; your draft has not been submitted." },
      { status: error instanceof ApiError ? error.status : 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
