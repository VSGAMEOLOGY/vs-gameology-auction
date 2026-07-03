import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    console.error("sendEmail: SMTP not configured");
    return { ok: false, error: "SMTP not configured" };
  }

  try {
    await transport.sendMail({
      from: `"VS GAMEOLOGY" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to send email";
    console.error("sendEmail failed:", error);
    return { ok: false, error };
  }
}
