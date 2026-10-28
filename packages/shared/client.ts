import { z } from "zod";
import { personSchema, sessionSchema, type EventInput, type PersonInput, type ProjectInput } from "./models";
import {
  errorSchema, eventPageSchema, eventSavedSchema, messageSchema, projectCreatedSchema,
  projectDetailSchema, projectsSchema, type AccountAction, type AccountFields,
} from "./contracts";

type Transport = { baseUrl?: string; fetch?: typeof globalThis.fetch; account?: boolean };

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function request<T extends z.ZodType>(
  path: string, schema: T, input?: unknown, signal?: AbortSignal, transport: Transport = {},
): Promise<z.output<T>> {
  let response: Response;
  try {
    response = await (transport.fetch ?? globalThis.fetch)(transport.baseUrl ? new URL(path, transport.baseUrl).href : path, {
      method: input === undefined ? "GET" : "POST",
      headers: input === undefined ? undefined : { "Content-Type": "application/json" },
      body: input === undefined ? undefined : JSON.stringify(input),
      cache: "no-store",
      ...(transport.account ? { credentials: "same-origin" as const, ...(signal ? { signal } : {}) } : { signal }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new RequestError(0, transport.account
      ? "We couldn’t reach Timeline. Check your connection and try again."
      : "Connection lost. Your changes have not been confirmed. Reconnect and retry.");
  }
  let raw: unknown;
  try { raw = await response.json(); }
  catch (error) {
    if (!transport.account) throw error;
    throw new RequestError(response.status, "Timeline returned an unreadable response. Please try again.");
  }
  if (!response.ok) {
    const problem = errorSchema.safeParse(raw);
    throw new RequestError(response.status, problem.success ? problem.data.error : transport.account
      ? "This request could not be completed. Please try again."
      : "The request failed. Please retry.");
  }
  return schema.parse(raw);
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please retry.";
}

export function createApiClient(transport: Omit<Transport, "account"> = {}) {
  const projectPath = (id: string) => `/api/projects/${encodeURIComponent(id)}`;
  const read = <T extends z.ZodType>(path: string, schema: T, signal?: AbortSignal) =>
    request(path, schema, undefined, signal, transport);
  const write = <T extends z.ZodType>(path: string, schema: T, input: unknown) =>
    request(path, schema, input, undefined, transport);
  return {
    session: (signal?: AbortSignal) => read("/api/session", sessionSchema, signal),
    projects: (signal?: AbortSignal) => read("/api/projects", projectsSchema, signal),
    project: (id: string, signal?: AbortSignal) => read(projectPath(id), projectDetailSchema, signal),
    createProject: (input: ProjectInput) => write("/api/projects", projectCreatedSchema, input),
    addPerson: (id: string, input: PersonInput) => write(`${projectPath(id)}/people`, personSchema, input),
    events: (id: string, params = new URLSearchParams(), signal?: AbortSignal) =>
      read(`${projectPath(id)}/events${params.size ? `?${params}` : ""}`, eventPageSchema, signal),
    saveEvent: (id: string, input: EventInput) => write(`${projectPath(id)}/events`, eventSavedSchema, input),
    signOut: () => write("/api/auth/signout", messageSchema, {}),
    async accountSession(signal?: AbortSignal) {
      try {
        return await request("/api/session", sessionSchema, undefined, signal, { ...transport, account: true });
      } catch (error) {
        if (error instanceof z.ZodError) throw new Error("We couldn’t check your account status. Please try again.");
        throw error;
      }
    },
    async account(action: AccountAction, fields: AccountFields) {
      try {
        const result = await request(`/api/auth/${action}`, messageSchema, fields, undefined, { ...transport, account: true });
        return result.message;
      } catch (error) {
        if (error instanceof z.ZodError) throw new Error("We couldn’t confirm the result. Please try again.");
        throw error;
      }
    },
  };
}

export const apiClient = createApiClient();
