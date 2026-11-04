import { z } from "zod";
import {
  categorySchema, eventSchema, personSchema, projectSchema,
} from "./models";

export const emailInputSchema = z.object({ email: z.email().max(254) }).strict();
export const phoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, "Use a phone number with +country code and digits only.");
export const phoneInputSchema = z.object({ phone: phoneSchema }).strict();
export const accountContactSchema = z.union([emailInputSchema, phoneInputSchema], {
  error: "Enter a valid email address or a phone number with +country code, not both.",
});
export const credentialsSchema = z.union([
  emailInputSchema.extend({ password: z.string().min(1).max(128) }),
  phoneInputSchema.extend({ password: z.string().min(1).max(128) }),
], { error: "Enter either email or phone with +country code, and a password of 1-128 characters." });
export const phoneVerificationSchema = phoneInputSchema.extend({
  token: z.string().regex(/^\d{6}$/, "Enter the six-digit code from your text message."),
});
export const passwordInputSchema = z.object({ password: z.string().min(12).max(128) }).strict();
export const messageSchema = z.object({ message: z.string() });
export const errorSchema = z.object({ error: z.string() });
export const projectCreatedSchema = z.object({ id: z.uuid() });
export const eventSavedSchema = z.object({ id: z.uuid(), version: z.number() });
export const projectDetailSchema = z.object({
  project: projectSchema, people: z.array(personSchema), categories: z.array(categorySchema),
});
export const eventPageSchema = z.object({ events: z.array(eventSchema), hasMore: z.boolean() });
export const projectsSchema = z.array(projectSchema);
export const authActionSchema = z.enum(["signup", "signin", "reset", "resend", "verify-phone", "password", "signout"]);
export const eventQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
  event: z.uuid().optional(),
  person: z.array(z.uuid()).max(50).optional(),
  category: z.array(z.uuid()).max(50).optional(),
  q: z.string().max(200).optional(),
  from: z.union([z.iso.date(), z.literal("")]).optional(),
  to: z.union([z.iso.date(), z.literal("")]).optional(),
  undated: z.string().optional(),
});

export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type EventPage = z.infer<typeof eventPageSchema>;
export type AuthAction = z.infer<typeof authActionSchema>;
export type AccountAction = Exclude<AuthAction, "signout">;
export type AccountFields =
  | z.infer<typeof credentialsSchema>
  | z.infer<typeof accountContactSchema>
  | z.infer<typeof phoneVerificationSchema>
  | z.infer<typeof passwordInputSchema>;
export type ConnectionState = "checking" | "ready" | "setup" | "error";
export type ApiRequestState = "idle" | "loading" | "success" | "error";
