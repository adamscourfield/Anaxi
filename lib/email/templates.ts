export type EmailTemplatePayload = {
  preheader?: string;
  greeting?: string;
  lines: string[];
  cta?: { label: string; href: string };
  footer?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared HTML layout for transactional email. */
export function renderEmailHtml(options: {
  schoolName: string;
  subject: string;
  payload: EmailTemplatePayload;
}): string {
  const { schoolName, subject, payload } = options;
  const greeting = payload.greeting ? `<p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">${escapeHtml(payload.greeting)}</p>` : "";
  const body = payload.lines
    .map((line) =>
      line === ""
        ? `<p style="margin:0 0 12px;">&nbsp;</p>`
        : `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#333;">${escapeHtml(line)}</p>`
    )
    .join("");
  const cta = payload.cta
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(payload.cta.href)}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">${escapeHtml(payload.cta.label)}</a></p>`
    : "";
  const footer = payload.footer ?? `This message was sent by ${schoolName} via Anaxi.`;
  const preheader = payload.preheader ?? subject;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">${escapeHtml(schoolName)}</p>
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0f172a;">${escapeHtml(subject)}</h1>
              ${greeting}
              ${body}
              ${cta}
              <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">${escapeHtml(footer)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailText(options: {
  schoolName: string;
  payload: EmailTemplatePayload;
}): string {
  const parts: string[] = [];
  if (options.payload.greeting) parts.push(options.payload.greeting, "");
  parts.push(...options.payload.lines);
  if (options.payload.cta) {
    parts.push("", `${options.payload.cta.label}: ${options.payload.cta.href}`);
  }
  parts.push("", options.payload.footer ?? `— ${options.schoolName} via Anaxi`);
  return parts.join("\n");
}
