import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
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
  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "Sign in to continue. Your local draft has not been submitted.");
  if (!data.user.email_confirmed_at) throw new ApiError(403, "Confirm your email before continuing.");
  return { client, user: data.user };
}
export async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Send the required form fields.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > 128 * 1024) {
      await reader.cancel();
      throw new ApiError(413, "This form is too large.");
    }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiError(400, "Send a valid form."); }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join(" "));
  return parsed.data;
}
export function databaseError(error: { code?: string; message: string }) {
  if (error.code === "P0001") throw new ApiError(409, error.message);
  if (error.code === "42501") throw new ApiError(403, "This project or event is unavailable.");
  if (error.code === "22023") throw new ApiError(400, error.message);
  if (["23514", "23502", "22008", "22007", "22P02"].includes(error.code ?? "")) {
    throw new ApiError(400, "Check the event fields and dates, then try again.");
  }
  console.error("Database request failed", { code: error.code });
  throw new ApiError(503, "The database request failed. Your draft has been kept; please retry.");
}
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
