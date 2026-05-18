import { z } from "zod";
import { STEP_ORDER } from "./steps";

export const stepSchema = z.enum(STEP_ORDER as unknown as [string, ...string[]]);

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
  step: stepSchema.optional(),
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
    step: stepSchema.optional(),
  })
  .refine(
    (data) =>
      data.email !== undefined ||
      data.name !== undefined ||
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
