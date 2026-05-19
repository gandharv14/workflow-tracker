import { describe, expect, it } from "vitest";

import {
  CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
  TRANSCRIPT_CONSENSUS_PROJECT_ID,
  getProject,
  normalizeProjectId,
  resolveProjectId,
} from "./projects";
import {
  getDefaultProjectStep,
  getProjectSteps,
  normalizeProjectStep,
} from "./steps";

describe("project workflow configuration", () => {
  it("normalizes project ids and falls back to the default project", () => {
    expect(normalizeProjectId(" transcript-consensus ")).toBe(
      TRANSCRIPT_CONSENSUS_PROJECT_ID,
    );
    expect(normalizeProjectId("missing")).toBeNull();
    expect(resolveProjectId("missing")).toBe(CC_AGENTIC_CODING_TAIGA_PROJECT_ID);
  });

  it("exposes different workflow steps per project", () => {
    expect(getProject(CC_AGENTIC_CODING_TAIGA_PROJECT_ID)).toMatchObject({
      name: "CC-Agentic-Coding-Taiga",
      canEmailSentContracts: true,
    });
    expect(getProjectSteps(CC_AGENTIC_CODING_TAIGA_PROJECT_ID)).toEqual([
      "eval",
      "interview",
      "background_check",
      "sent_contracts",
      "in_production",
    ]);
    expect(getProjectSteps(TRANSCRIPT_CONSENSUS_PROJECT_ID)).toEqual([
      "eval",
      "background_check",
      "in_production",
    ]);
    expect(getDefaultProjectStep(TRANSCRIPT_CONSENSUS_PROJECT_ID)).toBe("eval");
    expect(
      normalizeProjectStep(TRANSCRIPT_CONSENSUS_PROJECT_ID, "Sent Contracts"),
    ).toBeNull();
  });
});
