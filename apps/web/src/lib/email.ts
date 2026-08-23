const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const NOTIFICATIONS_FROM_EMAIL = process.env.NOTIFICATIONS_FROM_EMAIL ?? "orders@snaply-app.example";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/** Thin wrapper around the Resend API. No-ops (with a log line) when unconfigured
 *  so local/dev environments don't need an email provider to exercise the flow. */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[email:noop] to=${to} subject="${subject}"`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: NOTIFICATIONS_FROM_EMAIL, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}
