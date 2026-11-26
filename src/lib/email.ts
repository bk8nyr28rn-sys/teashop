import "server-only";

type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

/**
 * Sends the one-time sign-in code. Uses Resend's HTTP API when RESEND_API_KEY
 * is set; in development without a key the code is printed to the server log.
 *
 * Subject and body are intentionally neutral: an email notification must not
 * reveal to anyone glancing at the inbox what kind of community this is.
 */
export async function sendOtpEmail(email: string, otp: string, type: OtpType): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is required in production to send sign-in codes.");
    }
    console.info(`[dev-email] ${type} code for ${email}: ${otp}`);
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM must be set when RESEND_API_KEY is set.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: `Your code: ${otp}`,
      text: `Your one-time code is ${otp}. It expires in 10 minutes.\n\nIf you did not request it, you can ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
}
