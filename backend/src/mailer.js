// Pluggable transactional email. Provider is chosen from environment variables:
//   RESEND_API_KEY (+ MAIL_FROM)                          -> Resend HTTP API
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (+ MAIL_FROM) -> SMTP via nodemailer
// With neither configured: in development the message (incl. the code) is printed to the
// console; in production nothing is printed and sending fails with MailNotConfiguredError.
import { isProduction } from "./env.js";

export class MailNotConfiguredError extends Error {
  constructor() {
    super("No email provider configured (set SMTP_* or RESEND_API_KEY)");
    this.name = "MailNotConfiguredError";
  }
}

let smtpTransport = null;

function activeProvider() {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return null;
}

async function sendViaResend({ to, subject, text, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM || "Shringar <onboarding@resend.dev>", to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}

async function sendViaSmtp({ to, subject, text, html }) {
  if (!smtpTransport) {
    const { default: nodemailer } = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT || 587);
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  await smtpTransport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
}

/**
 * Sends one email. `devPreview` is extra text printed ONLY in non-production console fallback.
 * Throws MailNotConfiguredError (production, no provider) or a generic Error (provider failure).
 */
export async function sendMail({ to, subject, text, html, devPreview }) {
  const provider = activeProvider();
  if (!provider) {
    if (isProduction()) {
      console.error("[mail] cannot send: no email provider configured");
      throw new MailNotConfiguredError();
    }
    console.log(`[mail:dev] no provider configured, printing instead\n  to: ${to}\n  subject: ${subject}\n  ${devPreview ?? text}`);
    return { provider: "console" };
  }
  try {
    if (provider === "resend") await sendViaResend({ to, subject, text, html });
    else await sendViaSmtp({ to, subject, text, html });
  } catch (err) {
    // Log the failure reason only; never the message body (it contains the OTP).
    console.error(`[mail] ${provider} send failed: ${err.message}`);
    throw new Error("Email delivery failed");
  }
  return { provider };
}

const PURPOSE_LABEL = { login: "sign in", signup: "finish creating your account", reset: "reset your password" };

export function sendOtpEmail(to, code, purpose = "login") {
  const what = PURPOSE_LABEL[purpose] ?? "continue";
  const text = `Your Shringar code to ${what} is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`;
  const html = `<p>Your Shringar code to ${what} is:</p><p style="font-size:28px;letter-spacing:6px"><b>${code}</b></p><p>It expires in 10 minutes. If you did not request it, you can ignore this email.</p>`;
  return sendMail({ to, subject: `Your Shringar code: ${code}`, text, html, devPreview: `code: ${code}` });
}
