import { z } from "zod";
import { normalizeStep, STEP_ORDER } from "./steps";

export const stepSchema = z.preprocess(
  (value) => normalizeStep(value) ?? value,
  z.enum(STEP_ORDER as unknown as [string, ...string[]]),
);

export const createPersonSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Must be a valid email address"),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  role: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  step: stepSchema.optional(),
});

const optionalImportTextSchema = z
  .union([z.string().trim().max(120), z.null()])
  .optional()
  .transform((value) =>
    typeof value === "string" && value.length > 0 ? value : undefined,
  );

const importPersonSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Must be a valid email address"),
  name: optionalImportTextSchema,
  role: optionalImportTextSchema,
  step: stepSchema.optional(),
  fields: z
    .object({
      name: z.boolean().optional(),
      role: z.boolean().optional(),
      step: z.boolean().optional(),
    })
    .optional(),
});

export const updatePersonSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1)
      .email("Must be a valid email address")
      .optional(),
    name: z
      .union([z.string().trim().max(120), z.null()])
      .optional(),
    role: z
      .union([z.string().trim().max(120), z.null()])
      .optional(),
    step: stepSchema.optional(),
  })
  .refine(
    (data) =>
      data.email !== undefined ||
      data.name !== undefined ||
      data.role !== undefined ||
      data.step !== undefined,
    { message: "Provide at least one field to update" },
  );

export const bulkSchema = z
  .object({
    action: z.enum(["move", "delete"]),
    ids: z.array(z.string().min(1)).min(1, "Provide at least one id"),
    step: stepSchema.optional(),
  })
  .refine(
    (data) => data.action !== "move" || typeof data.step === "string",
    { message: "step is required when action is 'move'", path: ["step"] },
  );

export const importPeopleSchema = z.object({
  people: z
    .array(importPersonSchema)
    .min(1, "Upload at least one person")
    .max(500, "Upload at most 500 people at a time"),
}).superRefine((data, ctx) => {
  const seen = new Map<string, number>();
  data.people.forEach((person, index) => {
    const email = person.email.trim().toLowerCase();
    const firstIndex = seen.get(email);
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate email in import: ${email}`,
        path: ["people", index, "email"],
      });
      return;
    }
    seen.set(email, index);
  });
});
