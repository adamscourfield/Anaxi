import { z } from "zod";

export const emailSchema = z.string().email().transform((v) => v.toLowerCase().trim());

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
  tenantId: z.string().trim().optional(),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const meetingCreateBodySchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  type: z.enum(["OTHER", "LINE_MANAGEMENT", "DEPARTMENT", "PASTORAL", "SEN"]),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  attendeeIds: z.array(z.string()).optional().default([]),
  status: z.string().optional(),
  startNow: z.boolean().optional(),
});

export const onCallCreateBodySchema = z.object({
  studentId: z.string().min(1),
  requestType: z.enum(["BEHAVIOUR", "FIRST_AID"]),
  location: z.string().trim().min(1),
  notes: z.string().optional(),
  isEmergency: z.boolean().optional(),
  behaviourReasonCategory: z.string().optional(),
});

export const authTenantsBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  return schema.parse(body);
}
