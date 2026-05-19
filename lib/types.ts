import type { ProjectId } from "./projects";
import type { Step } from "./steps";

export type Person = {
  id: string;
  projectId: ProjectId;
  email: string;
  name?: string;
  role?: string;
  step: Step;
  createdAt: string;
  updatedAt: string;
};
