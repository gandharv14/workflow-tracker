import { z } from "zod";
import { DEFAULT_PROJECT_ID, type ProjectId } from "./projects";
import {
  getProjectSteps,
  normalizeProjectStep,
  normalizeStep,
  STEP_ORDER,
} from "./steps";

export const stepSchema = z.preprocess(
  (value) => normalizeStep(value) ?? value,
  z.enum(STEP_ORDER as unknown as [string, ...string[]]),
);

export function stepSchemaForProject(projectId: ProjectId) {
  const projectSteps = getProjectSteps(projectId);
  return z.preprocess(
    (value) => normalizeProjectStep(projectId, value) ?? value,
    z.enum(projectSteps as unknown as [string, ...string[]]),
  );
}

function createPersonSchemaWithStep(step: z.ZodType) {
  return z.object({
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
    step: step.optional(),
  });
}

export function createPersonSchemaForProject(projectId: ProjectId) {
  return createPersonSchemaWithStep(stepSchemaForProject(projectId));
}

export const createPersonSchema = createPersonSchemaForProject(DEFAULT_PROJECT_ID);

const optionalImportTextSchema = z
  .union([z.string().trim().max(120), z.null()])
  .optional()
  .transform((value) =>
    typeof value === "string" && value.length > 0 ? value : undefined,
  );

function importPersonSchemaWithStep(step: z.ZodType) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Must be a valid email address"),
    name: optionalImportTextSchema,
    role: optionalImportTextSchema,
    step: step.optional(),
    fields: z
      .object({
        name: z.boolean().optional(),
        role: z.boolean().optional(),
        step: z.boolean().optional(),
      })
      .optional(),
  });
}

function updatePersonSchemaWithStep(step: z.ZodType) {
  return z
    .object({
      email: z
        .string()
        .trim()
        .min(1)
        .email("Must be a valid email address")
        .optional(),
      name: z.union([z.string().trim().max(120), z.null()]).optional(),
      role: z.union([z.string().trim().max(120), z.null()]).optional(),
      step: step.optional(),
    })
    .refine(
      (data) =>
        data.email !== undefined ||
        data.name !== undefined ||
        data.role !== undefined ||
        data.step !== undefined,
      { message: "Provide at least one field to update" },
    );
}

export function updatePersonSchemaForProject(projectId: ProjectId) {
  return updatePersonSchemaWithStep(stepSchemaForProject(projectId));
}

export const updatePersonSchema = updatePersonSchemaForProject(DEFAULT_PROJECT_ID);

function bulkSchemaWithStep(step: z.ZodType) {
  return z
    .object({
      action: z.enum(["move", "delete"]),
      ids: z.array(z.string().min(1)).min(1, "Provide at least one id"),
      step: step.optional(),
    })
    .refine(
      (data) => data.action !== "move" || typeof data.step === "string",
      { message: "step is required when action is 'move'", path: ["step"] },
    );
}

export function bulkSchemaForProject(projectId: ProjectId) {
  return bulkSchemaWithStep(stepSchemaForProject(projectId));
}

export const bulkSchema = bulkSchemaForProject(DEFAULT_PROJECT_ID);

export function importPeopleSchemaForProject(projectId: ProjectId) {
  const importPersonSchema = importPersonSchemaWithStep(
    stepSchemaForProject(projectId),
  );
  return z
    .object({
      people: z
        .array(importPersonSchema)
        .min(1, "Upload at least one person")
        .max(500, "Upload at most 500 people at a time"),
    })
    .superRefine((data, ctx) => {
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
}

export const importPeopleSchema = importPeopleSchemaForProject(DEFAULT_PROJECT_ID);
