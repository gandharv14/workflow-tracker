import { getProject, type ProjectId } from "./projects";

export const STEP_ORDER = [
  "eval",
  "interview",
  "background_check",
  "sent_contracts",
  "in_production",
] as const;

export type Step = (typeof STEP_ORDER)[number];

export const STEP_LABELS: Record<Step, string> = {
  eval: "Eval",
  interview: "Interview",
  background_check: "Background Check + Gmail Creation",
  sent_contracts: "Sent Contracts",
  in_production: "In Production",
};

export const STEP_DESCRIPTIONS: Record<Step, string> = {
  eval: "Initial evaluation and screening",
  interview: "Interview round",
  background_check: "Background verification and Gmail provisioning",
  sent_contracts: "Contract sent, awaiting signature",
  in_production: "Live and working",
};

// Tailwind class fragments used by the column header chip.
export const STEP_COLORS: Record<
  Step,
  { ring: string; bg: string; text: string; dot: string }
> = {
  eval: {
    ring: "ring-slate-300/60 dark:ring-slate-700/60",
    bg: "bg-slate-50 dark:bg-slate-900/40",
    text: "text-slate-700 dark:text-slate-200",
    dot: "bg-slate-400",
  },
  interview: {
    ring: "ring-sky-300/60 dark:ring-sky-700/60",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-200",
    dot: "bg-sky-500",
  },
  background_check: {
    ring: "ring-amber-300/60 dark:ring-amber-700/60",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  sent_contracts: {
    ring: "ring-pink-300/60 dark:ring-pink-700/60",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    text: "text-pink-700 dark:text-pink-200",
    dot: "bg-pink-500",
  },
  in_production: {
    ring: "ring-emerald-300/60 dark:ring-emerald-700/60",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
};

export function isStep(value: unknown): value is Step {
  return (
    typeof value === "string" && (STEP_ORDER as readonly string[]).includes(value)
  );
}

export function normalizeStep(value: unknown): Step | null {
  if (isStep(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (isStep(normalized)) return normalized;
  if (
    normalized === "eval_+_interview" ||
    normalized === "eval+interview" ||
    normalized === "eval_interview"
  ) {
    return "eval";
  }
  if (normalized === "gmail_creation") return "background_check";
  for (const step of STEP_ORDER) {
    if (STEP_LABELS[step].toLowerCase().replace(/\s+/g, "_") === normalized) {
      return step;
    }
  }
  return null;
}

export function getProjectSteps(projectId: ProjectId): readonly Step[] {
  return getProject(projectId).steps;
}

export function getDefaultProjectStep(projectId: ProjectId): Step {
  return getProjectSteps(projectId)[0] ?? "eval";
}

export function isProjectStep(
  projectId: ProjectId,
  value: unknown,
): value is Step {
  return isStep(value) && getProjectSteps(projectId).includes(value);
}

export function normalizeProjectStep(
  projectId: ProjectId,
  value: unknown,
): Step | null {
  const step = normalizeStep(value);
  return step && isProjectStep(projectId, step) ? step : null;
}
