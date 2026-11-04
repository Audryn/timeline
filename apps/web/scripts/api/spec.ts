import { z } from "zod";
import {
  accountContactSchema, civilSchema, credentialsSchema, emailInputSchema, errorSchema, eventDateSchema,
  eventInputSchema, eventPageSchema, eventSavedSchema, eventSchema, messageSchema,
  passwordInputSchema, phoneVerificationSchema, personInputSchema, personSchema, projectCreatedSchema,
  projectDetailSchema, projectInputSchema, projectsSchema, sessionSchema,
} from "@timeline/shared";

const schemas = {
  CivilDate: civilSchema, EventDate: eventDateSchema,
  Credentials: credentialsSchema, EmailInput: emailInputSchema, PasswordInput: passwordInputSchema,
  AccountContact: accountContactSchema, PhoneVerification: phoneVerificationSchema,
  ProjectInput: projectInputSchema, PersonInput: personInputSchema, EventInput: eventInputSchema,
  ProjectCreated: projectCreatedSchema, Person: personSchema, EventSaved: eventSavedSchema,
  Session: sessionSchema, Projects: projectsSchema, ProjectDetail: projectDetailSchema,
  EventPage: eventPageSchema.extend({
    events: z.array(eventSchema.extend({
      created_at: z.iso.datetime({ offset: true }).optional(),
      updated_at: z.iso.datetime({ offset: true }).optional(),
    })),
  }),
  Message: messageSchema, Error: errorSchema,
};

const ref = (name: keyof typeof schemas) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: keyof typeof schemas) => ({ "application/json": { schema: ref(name) } });
const errors = (codes: number[]) => Object.fromEntries(codes.map(code => [code, {
  description: ({
    400: "Invalid fields, filters, credentials or provider-rejected account operation.",
    401: "A verified signed-in session is required.",
    403: "Origin rejected, contact unconfirmed or ownership denied.",
    404: "Project unavailable or account action unknown.",
    409: "Stale version or request identity reused with different content.",
    413: "JSON body exceeds 128 KiB.",
    429: "Provider account/email/SMS rate limit.",
    500: "Unexpected failure; no successful save may be inferred.",
    503: "Provider unconfigured/unavailable or database/sign-out failed.",
  } as Record<number, string>)[code],
  content: json("Error"),
}]));

const projectId = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const originHeader = {
  name: "Origin", in: "header", required: true,
  description: "Must exactly equal the server-configured APP_ORIGIN. Cookie auth is not a native bearer-token contract.",
  schema: { type: "string", format: "uri" },
};
const security = [{ cookieSession: [] }];
const requestBody = (name: keyof typeof schemas) => ({ required: true, content: json(name) });
const operation = (
  operationId: string, summary: string, response: keyof typeof schemas,
  options: { input?: keyof typeof schemas; write?: boolean; public?: boolean; codes?: number[]; description?: string } = {},
) => ({
  operationId, summary, description: options.description,
  security: options.public ? [] : security,
  ...(options.write ? { parameters: [originHeader] } : {}),
  ...(options.input ? { requestBody: requestBody(options.input) } : {}),
  responses: {
    200: {
      description: "Successful response. A mutation is acknowledged only after this response validates.",
      headers: { "Cache-Control": { schema: { type: "string", const: "private, no-store" } } },
      content: json(response),
    },
    ...errors(options.codes ?? [400, 401, 403, 404, 409, 413, 500, 503]),
  },
});

export function createOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Timeline HTTP API", version: "0.1.0",
      description: "Existing web cookie API; native authentication is not implemented. Zod schemas are canonical. Gregorian calendar validity, range ordering, unique participant/category IDs and request replay/version rules are enforced beyond structural JSON Schema.",
    },
    servers: [{ url: "/", description: "Same-origin application backend" }],
    components: {
      securitySchemes: {
        cookieSession: {
          type: "apiKey", in: "cookie", name: "sb-<project-ref>-auth-token",
          description: "Supabase SSR HttpOnly session cookie; actual project-specific name may be chunked (.0/.1). Secure in production, SameSite=Lax. No bearer-token alternative exists yet.",
        },
      },
      schemas: Object.fromEntries(Object.entries(schemas).map(([name, schema]) => {
        const document = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" });
        const { $schema, ...definition } = document;
        void $schema;
        return [name, definition];
      })),
    },
    paths: {
      "/api/session": {
        get: operation("session", "Inspect configuration presence and verified current user", "Session", {
          public: true, codes: [500],
          description: "configured=true means values exist, not proof of provider health. Missing/unconfirmed sessions return user=null.",
        }),
      },
      "/api/auth/signup": {
        post: {
          ...operation("signup", "Create email/password or phone/password account and request confirmation", "Message", {
            public: true, write: true, input: "Credentials", codes: [400, 403, 413, 429, 500, 503],
            description: "Requires 12–128 password characters; successful signup does not establish verified access. Phone operations require PHONE_AUTH_ENABLED and a configured SMS provider.",
          }),
          requestBody: {
            required: true, content: { "application/json": { schema: {
              allOf: [ref("Credentials"), { type: "object", properties: { password: { type: "string", minLength: 12 } } }],
            } } },
          },
        },
      },
      "/api/auth/signin": {
        post: operation("signin", "Sign in using email/password or phone/password; set server session cookies", "Message", {
          public: true, write: true, input: "Credentials", codes: [400, 403, 413, 429, 500, 503],
        }),
      },
      "/api/auth/reset": {
        post: operation("reset", "Request password-recovery email or SMS code", "Message", {
          public: true, write: true, input: "AccountContact", codes: [400, 403, 413, 429, 500, 503],
          description: "Generic eligibility message is not proof of delivery. Phone recovery must not create a new account; verify its SMS code before changing the password. No automatic resend.",
        }),
      },
      "/api/auth/resend": {
        post: operation("resend", "Request another confirmation email or SMS code", "Message", {
          public: true, write: true, input: "AccountContact", codes: [400, 403, 413, 429, 500, 503],
        }),
      },
      "/api/auth/verify-phone": {
        post: operation("verifyPhone", "Verify SMS code and establish a server-only session", "Message", {
          public: true, write: true, input: "PhoneVerification", codes: [400, 403, 413, 429, 500, 503],
          description: "Accepts a six-digit code for signup confirmation or recovery. Requires a provider-confirmed, non-anonymous phone identity. Session credentials are never returned in JSON.",
        }),
      },
      "/api/auth/password": {
        post: operation("password", "Change password using a verified recovery/session cookie", "Message", {
          write: true, input: "PasswordInput", codes: [400, 401, 403, 413, 500, 503],
        }),
      },
      "/api/auth/signout": {
        post: operation("signout", "Sign out this session", "Message", {
          public: true, write: true, codes: [403, 500, 503],
          description: "Request body is ignored. Cross-tab draft protection and local draft cleanup remain client responsibilities.",
        }),
      },
      "/api/auth/callback": {
        get: {
          operationId: "callback", summary: "Consume confirmation/recovery token or PKCE code", security: [],
          description: "This GET consumes a token and is NOT a read-only production probe. Fixed same-origin redirect only. PKCE requires the originating verifier cookie.",
          parameters: [
            { name: "token_hash", in: "query", schema: { type: "string" } },
            { name: "type", in: "query", schema: { type: "string", enum: ["signup", "recovery"] } },
            { name: "code", in: "query", schema: { type: "string" } },
            { name: "flow", in: "query", schema: { type: "string", enum: ["recovery"] } },
          ],
          responses: {
            307: {
              description: "Projects on success; account password mode for recovery; notice=expired/failed otherwise.",
              headers: {
                Location: { required: true, schema: { type: "string", format: "uri" } },
                "Cache-Control": { schema: { type: "string", const: "private, no-store" } },
                "Referrer-Policy": { description: "Current proxy overrides the callback's route-level no-referrer value.", schema: { type: "string", const: "same-origin" } },
              },
            },
            500: { description: "APP_ORIGIN missing/invalid before a redirect can be constructed." },
          },
        },
      },
      "/api/projects": {
        get: operation("projects", "List up to 100 newest owned projects", "Projects", {
          codes: [401, 403, 500, 503], description: "Bare array; no pagination or hasMore indicator.",
        }),
        post: operation("createProject", "Atomically create project, first person and 13 categories", "ProjectCreated", {
          write: true, input: "ProjectInput",
        }),
      },
      "/api/projects/{id}": {
        parameters: [projectId],
        get: operation("project", "Read owned project, people and categories", "ProjectDetail", {
          codes: [401, 403, 404, 500, 503],
        }),
      },
      "/api/projects/{id}/people": {
        parameters: [projectId],
        post: operation("addPerson", "Add a real person or fictional character", "Person", {
          write: true, input: "PersonInput",
        }),
      },
      "/api/projects/{id}/events": {
        parameters: [projectId],
        get: {
          ...operation("events", "List filtered events or fetch a specific event", "EventPage", {
            codes: [400, 401, 403, 404, 500, 503],
            description: "50 rows, ascending placement date then ID; Undated last. hasMore is true for exactly 50 rows, not proof of a next row. Event lookup validates offset then ignores other filters. A valid unavailable project currently returns an empty list.",
          }),
          parameters: [
            { name: "offset", in: "query", schema: { type: "integer", minimum: 0, maximum: 1000000, default: 0 } },
            { name: "event", in: "query", schema: { type: "string", format: "uuid" } },
            ...["person", "category"].map(name => ({
              name, in: "query", style: "form", explode: true,
              description: "Repeated UUID query parameters; OR within a selection, AND between filter types.",
              schema: { type: "array", maxItems: 50, items: { type: "string", format: "uuid" } },
            })),
            { name: "q", in: "query", description: "Trimmed literal substring search.", schema: { type: "string", maxLength: 200 } },
            ...["from", "to"].map(name => ({
              name, in: "query", description: "Inclusive date overlap; empty string means no bound. from must not exceed to.",
              schema: { anyOf: [{ type: "string", format: "date" }, { const: "" }] },
            })),
            { name: "undated", in: "query", description: "Only the literal string false excludes Undated; all other values include it.", schema: { type: "string", default: "true" } },
          ],
        },
        post: operation("saveEvent", "Create/update an event with replay identity and expected version", "EventSaved", {
          write: true, input: "EventInput",
          description: "version=0 creates. Edits use last acknowledged version; replay exact requestId+payload after an uncertain result. Atomic participant/category links. No automatic retry.",
        }),
      },
    },
  };
}
