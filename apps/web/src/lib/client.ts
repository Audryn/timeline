import { z } from "zod";

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function request<T extends z.ZodType>(
  path: string, schema: T, input?: unknown, signal?: AbortSignal,
): Promise<z.output<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: input === undefined ? "GET" : "POST",
      headers: input === undefined ? undefined : { "Content-Type": "application/json" },
      body: input === undefined ? undefined : JSON.stringify(input),
      cache: "no-store", signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new RequestError(0, "Connection lost. Your changes have not been confirmed. Reconnect and retry.");
  }
  const raw: unknown = await response.json();
  if (!response.ok) {
    const problem = z.object({ error: z.string() }).safeParse(raw);
    throw new RequestError(response.status, problem.success ? problem.data.error : "The request failed. Please retry.");
  }
  return schema.parse(raw);
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please retry.";
}
