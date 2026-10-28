import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

export interface BackendDependencies {
  createClient: () => Promise<SupabaseClient>;
  configured: () => boolean;
  appOrigin: () => string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function authenticated(createClient: BackendDependencies["createClient"]) {
  const client = await createClient();
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
