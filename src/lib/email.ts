import { buildLicensePdf, type ReceiptPdfInput } from "./pdf-receipt";

const LICENSOR_COPY = "maxinfeld@gmail.com";

export type EmailResult = {
  sent: boolean;
  to: string[];
  provider?: string;
  error?: string;
};

export async function emailLicenseReceipt(input: ReceiptPdfInput & { to?: string }): Promise<EmailResult> {
  const pdf = await buildLicensePdf(input);
  const recipients = uniqueEmails([input.to, LICENSOR_COPY]);
  const subject = `Xerographer commercial license — ${input.grant.fontName}`;
  const html = receiptHtml(input);
  const text = receiptText(input);
  const filename = `xerographer-${input.grant.fontSlug}-license.pdf`;

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const from = process.env.RESEND_FROM?.trim() || "Xerographer Fonts <licenses@xerographer.fonts>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to ? [input.to] : [LICENSOR_COPY],
        bcc: input.to ? [LICENSOR_COPY] : undefined,
        subject,
        html,
        text,
        attachments: [
          {
            filename,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { sent: false, to: recipients, provider: "resend", error: err.slice(0, 400) };
    }
    return { sent: true, to: recipients, provider: "resend" };
  }

  const smtp = process.env.SMTP_URL?.trim();
  if (smtp) {
    return {
      sent: false,
      to: recipients,
      provider: "smtp",
      error: "SMTP_URL is set but a transport is not wired in this runtime. Use RESEND_API_KEY.",
    };
  }

  return {
    sent: false,
    to: recipients,
    error: "Email is not configured. Set RESEND_API_KEY to deliver PDF receipts. The receipt remains available at the returned URL.",
  };
}

function uniqueEmails(values: Array<string | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const v = value?.trim().toLowerCase();
    if (v && v.includes("@") && !out.includes(v)) out.push(v);
  }
  return out;
}

function receiptText(input: ReceiptPdfInput): string {
  return [
    "Xerographer Fonts — Unlimited Commercial Use License",
    "",
    input.grant.permission,
    "",
    `Receipt: ${input.id}`,
    `Typeface: ${input.grant.fontName} (${input.grant.fontSlug})`,
    `Licensee: ${input.grant.licensee}`,
    `Email: ${input.grant.email ?? "—"}`,
    `Price: US$${input.grant.priceUsd} USDC`,
    `Network: ${input.receipt.network}`,
    `Transaction: ${input.receipt.transaction}`,
    `DaFont: ${input.grant.sources.dafont}`,
    `Download: ${input.grant.sources.download}`,
    `Designer: ${input.grant.sources.designer}`,
    "",
    "A PDF of this grant is attached. A copy is sent to maxinfeld@gmail.com.",
  ].join("\n");
}

function receiptHtml(input: ReceiptPdfInput): string {
  return `<!doctype html>
<html><body style="font-family:Georgia,serif;color:#161513;background:#f2efe6;padding:32px">
  <p style="letter-spacing:.18em;text-transform:uppercase;font-size:12px">Xerographer Fonts</p>
  <h1 style="font-size:28px;font-weight:500">Unlimited Commercial Use License</h1>
  <p>${escapeHtml(input.grant.permission)}</p>
  <table style="font-size:14px;border-collapse:collapse">
    ${row("Receipt", input.id)}
    ${row("Typeface", `${input.grant.fontName} (${input.grant.fontSlug})`)}
    ${row("Licensee", input.grant.licensee)}
    ${row("Price", `US$${input.grant.priceUsd} USDC`)}
    ${row("Transaction", input.receipt.transaction)}
    ${row("DaFont", input.grant.sources.dafont)}
    ${row("Download", input.grant.sources.download)}
  </table>
  <p style="color:#6b665c;font-size:12px">PDF attached. A copy is delivered to the licensor at maxinfeld@gmail.com.</p>
</body></html>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 16px 6px 0;color:#6b665c">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
}

function escapeHtml(value: string): string {
  const map: Record<string, string> = {
    "&": "&" + "amp;",
    "<": "&" + "lt;",
    ">": "&" + "gt;",
    '"': "&" + "quot;",
  };
  return value.replace(/[&<>"]/g, (ch) => map[ch] ?? ch);
}
