import { normalizeStep, STEP_LABELS, STEP_ORDER, type Step } from "./steps";
import type { Person } from "./types";

export type CsvPersonInput = {
  email: string;
  name?: string;
  role?: string;
  step?: Step;
  fields?: {
    name?: boolean;
    role?: boolean;
    step?: boolean;
  };
};

const CSV_HEADERS = ["email", "name", "role", "step"] as const;

type ParsePeopleCsvOptions = {
  steps?: readonly Step[];
};

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (char === "\r" && next === "\n") i += 1;
      continue;
    }

    cell += char;
  }

  if (inQuotes) {
    throw new Error("CSV has an unterminated quoted value");
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((currentRow) =>
    currentRow.some((value) => value.trim().length > 0),
  );
}

function csvValue(value: string | undefined): string {
  const safeValue = value ?? "";
  if (!/[",\n\r]/.test(safeValue)) return safeValue;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function parsePeopleCsv(
  csv: string,
  options: ParsePeopleCsvOptions = {},
): CsvPersonInput[] {
  const validSteps = options.steps ?? STEP_ORDER;
  const rows = parseCsvRows(csv);
  if (rows.length === 0) throw new Error("CSV is empty");

  const headers = rows[0].map(normalizeHeader);
  const emailIndex = headers.indexOf("email");
  const nameIndex = headers.indexOf("name");
  const roleIndex = headers.indexOf("role");
  const stepIndex = headers.indexOf("step");

  if (emailIndex === -1) {
    throw new Error("CSV must include an email column");
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > 500) {
    throw new Error("CSV can include at most 500 people");
  }

  const seenEmails = new Set<string>();
  return dataRows.map((row, index) => {
    const rowNumber = index + 2;
    const email = trimOptional(row[emailIndex]);
    if (!email) throw new Error(`Row ${rowNumber}: email is required`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Row ${rowNumber}: email must be a valid email address`);
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      throw new Error(`Row ${rowNumber}: duplicate email ${normalizedEmail}`);
    }
    seenEmails.add(normalizedEmail);

    const rawStep = trimOptional(stepIndex >= 0 ? row[stepIndex] : undefined);
    let step: Step | undefined;
    if (rawStep) {
      const parsedStep = normalizeStep(rawStep);
      if (parsedStep === null || !validSteps.includes(parsedStep)) {
        throw new Error(
          `Row ${rowNumber}: step must be one of ${validSteps.join(", ")}`,
        );
      }
      step = parsedStep;
    }

    return {
      email,
      name: trimOptional(nameIndex >= 0 ? row[nameIndex] : undefined),
      role: trimOptional(roleIndex >= 0 ? row[roleIndex] : undefined),
      step,
      fields: {
        name: nameIndex >= 0,
        role: roleIndex >= 0,
        step: stepIndex >= 0,
      },
    };
  });
}

export function serializePeopleCsv(people: Person[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...people.map((person) =>
      [
        person.email,
        person.name,
        person.role,
        STEP_LABELS[person.step] ? person.step : undefined,
      ]
        .map(csvValue)
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}
