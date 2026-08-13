import { appOrigin } from "@/lib/appUrl";

const DEFAULT_FROM = "Porchlight <noreply@porchatl.com>";

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "Mail is not configured." };

  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("resend failed", res.status, body.slice(0, 300));
    return { ok: false, error: "Couldn't send the email." };
  }
  return { ok: true };
}

export function resetPasswordEmail(opts: { name: string; token: string }) {
  const url = `${appOrigin()}/reset-password?token=${encodeURIComponent(opts.token)}`;
  const subject = "Reset your Porchlight password";
  const text = `Hi ${opts.name},\n\nSomeone asked to reset the password on your Porchlight account. Open this link in the next 30 minutes:\n\n${url}\n\nIf you didn't ask, you can ignore this. The link expires on its own.\n`;
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#faf7f2;padding:32px 16px;color:#2b2420">
      <div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #e8e0d6;border-radius:16px;padding:28px">
        <p style="margin:0 0 8px;font-size:20px;font-weight:700">🏮 Porchlight</p>
        <p style="margin:0 0 16px;font-size:16px">Hi ${escapeHtml(opts.name)},</p>
        <p style="margin:0 0 20px;line-height:1.5">Someone asked to reset the password on your Porchlight account. The link works for 30 minutes.</p>
        <p style="margin:0 0 24px">
          <a href="${url}" style="display:inline-block;background:#c2661b;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:12px">
            Choose a new password
          </a>
        </p>
        <p style="margin:0;font-size:13px;color:#6b5f56;line-height:1.5">If you didn't ask, ignore this. The link expires on its own.</p>
      </div>
    </div>
  `;
  return { subject, html, text };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
