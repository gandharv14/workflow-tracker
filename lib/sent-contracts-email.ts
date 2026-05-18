import "server-only";

import type { Person } from "./types";

export const SENT_CONTRACTS_EMAIL_SUBJECT =
  "Subject Matter Expert engagement terms";

export function firstNameForGreeting(name: string | undefined): string | null {
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName && firstName.length > 0 ? firstName : null;
}

export function sentContractsEmailText(person: Pick<Person, "name">): string {
  const firstName = firstNameForGreeting(person.name);
  const greeting = firstName ? `Dear ${firstName},` : "Hi There,";

  return `${greeting}
I'm pleased to inform you that you have been selected as a Subject Matter Expert ("SME") for Alignerr LLC. Below are the key terms of this arrangement:
Role & Responsibilities: You will serve as an SME, providing your expertise and collaborating closely with our team on related deliverables, tasks, and meetings.
Time Commitment: You are expected to dedicate 40 hours per week throughout the engagement period.
Task Commitment: You are expected to complete 8 tasks per week.
Compensation: Your hourly rate will be $90/hour.
Term: This engagement will begin on May 17, 2026 and will end on August 17, 2026, covering a three-month period.
Contractor Agreement: The terms of your existing contractor agreement with Alignerr LLC will continue to apply and remain in full force and effect throughout the Term specified in this message.
Failure to comply with the time commitment or task commitment may be grounds for removal from the project. If you agree to these terms, please reply to this email confirming your acceptance.
Thank you for joining us in this capacity. I look forward to our continued working relationship.
Best regards,
Alexia
Alignerr Hiring Manager`;
}
