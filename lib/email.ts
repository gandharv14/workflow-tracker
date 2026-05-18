import "server-only";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export class EmailConfigurationError extends Error {
  constructor(message = "Email sending is not configured.") {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message = "Failed to send email.") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new EmailConfigurationError();
  return value;
}

export async function sendEmail({ to, subject, text }: SendEmailInput): Promise<void> {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("EMAIL_FROM");

  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new EmailDeliveryError(`Failed to send email to ${to}.`);
  }
}
