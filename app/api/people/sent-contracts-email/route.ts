import { NextResponse } from "next/server";

import {
  EmailConfigurationError,
  EmailDeliveryError,
  sendEmail,
} from "@/lib/email";
import { routeErrorResponse } from "@/lib/route-errors";
import {
  SENT_CONTRACTS_EMAIL_SUBJECT,
  sentContractsEmailText,
} from "@/lib/sent-contracts-email";
import { listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  let sentContractsPeople: Awaited<ReturnType<typeof listPeople>>;
  try {
    const people = await listPeople();
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
