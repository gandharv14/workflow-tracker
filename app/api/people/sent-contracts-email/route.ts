import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth";
import {
  EmailConfigurationError,
  EmailDeliveryError,
  sendEmail,
} from "@/lib/email";
import { routeErrorResponse } from "@/lib/route-errors";
import { getProject } from "@/lib/projects";
import { projectIdOrResponse } from "@/lib/project-api";
import {
  SENT_CONTRACTS_EMAIL_SUBJECT,
  sentContractsEmailText,
} from "@/lib/sent-contracts-email";
import { listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResponse = await requireApiAuth();
  if (authResponse) return authResponse;
  const { projectId, response } = projectIdOrResponse(request);
  if (response) return response;
  const project = getProject(projectId);
  if (!project.canEmailSentContracts) {
    return NextResponse.json(
      { error: "Sent Contracts emails are not available for this project" },
      { status: 400 },
    );
  }

  let sentContractsPeople: Awaited<ReturnType<typeof listPeople>>;
  try {
    const people = await listPeople(projectId);
    sentContractsPeople = people.filter((person) => person.step === "sent_contracts");
  } catch (err) {
    const response = routeErrorResponse(err);
    if (response) return response;
    throw err;
  }

  try {
    await Promise.all(
      sentContractsPeople.map((person) =>
        sendEmail({
          to: person.email,
          subject: SENT_CONTRACTS_EMAIL_SUBJECT,
          text: sentContractsEmailText(person),
        }),
      ),
    );
  } catch (err) {
    if (err instanceof EmailConfigurationError) {
      return NextResponse.json(
        { error: "Email sending is not configured. Set RESEND_API_KEY and EMAIL_FROM." },
        { status: 503 },
      );
    }
    if (err instanceof EmailDeliveryError) {
      return NextResponse.json(
        { error: "Failed to send Sent Contracts emails. Please retry." },
        { status: 502 },
      );
    }
    throw err;
  }

  return NextResponse.json({ sent: sentContractsPeople.length });
}
