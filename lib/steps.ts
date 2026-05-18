export const STEP_ORDER = [
  "eval",
  "interview",
  "background_check",
  "gmail_creation",
  "sent_contracts",
  "in_production",
] as const;

export type Step = (typeof STEP_ORDER)[number];

export const STEP_LABELS: Record<Step, string> = {
  eval: "Eval",
  interview: "Interview",
  background_check: "Background Check",
  gmail_creation: "Gmail Creation",
  sent_contracts: "Sent Contracts",
  in_production: "In Production",
};

export const STEP_DESCRIPTIONS: Record<Step, string> = {
  eval: "Initial evaluation and screening",
  interview: "Interview round",
  background_check: "Background verification",
  gmail_creation: "Provisioning Gmail account",
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
    ring: "ring-blue-300/60 dark:ring-blue-700/60",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  background_check: {
    ring: "ring-amber-300/60 dark:ring-amber-700/60",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  gmail_creation: {
    ring: "ring-violet-300/60 dark:ring-violet-700/60",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-200",
    dot: "bg-violet-500",
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
