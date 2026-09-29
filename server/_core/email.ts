import { ENV } from "./env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(message: EmailMessage) {
  if (!ENV.emailProviderUrl || !ENV.emailProviderApiKey || !ENV.emailFrom) {
    throw new Error("Email delivery is not configured");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(ENV.emailProviderUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${ENV.emailProviderApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: ENV.emailFrom, ...message }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the request (${response.status})`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = new URL("/login", ENV.appBaseUrl);
  resetUrl.searchParams.set("resetToken", token);
  await sendEmail({
    to: email,
    subject: "Reset your Uptrail password",
    text: `Reset your Uptrail password using this one-time link: ${resetUrl.toString()}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Reset your Uptrail password using this one-time link:</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}
