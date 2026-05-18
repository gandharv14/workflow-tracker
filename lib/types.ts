import type { Step } from "./steps";

export type Person = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  step: Step;
  createdAt: string;
  updatedAt: string;
};
