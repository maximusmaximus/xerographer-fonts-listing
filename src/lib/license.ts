import {
  CATALOG_FONT_NAME,
  CATALOG_LICENSE_USD,
  CATALOG_SLUG,
  DAFONT_AUTHOR,
  DESIGNER_URL,
  LICENSE_PERMISSION_CATALOG,
  LICENSE_PERMISSION_FONT,
  LICENSE_TERMS,
  LICENSE_USD,
  usdAtomic,
} from "@/lib/constants";
import { getSql } from "@/lib/db";
import { emailLicenseReceipt } from "@/lib/email";
import { getFontOrThrow, withSources } from "@/lib/fonts";
import { buildLicensePdf } from "@/lib/pdf-receipt";
import {
  corsHeaders,
  extractPayer,
  paymentRequired,
  paymentRequiredResponse,
  readPaymentPayload,
  verifyAndSettle,
  type LicenseGrant,
  type PaymentPayload,
  type X402Receipt,
} from "@/lib/x402";

export type StoredLicense = {
  id: string;
  fontSlug: string;
  fontName: string;
  payerId: string;
  email: string | null;
  licenseeName: string | null;
  amountUsd: number;
  network: string;
  asset: string;
  txHash: string | null;
  receipt: X402Receipt;
  emailedTo: string | null;
  emailStatus: string;
  createdAt: string;
};

type LicenseRow = {
  id: string;
  font_slug: string;
  font_name: string;
  payer_id: string;
  email: string | null;
  licensee_name: string | null;
  amount_usd: string | number;
  network: string;
  asset: string;
  tx_hash: string | null;
  receipt: X402Receipt | string;
  emailed_to: string | null;
  email_status: string;
  created_at: string;
};

export type PurchaseInput = {
  slug?: string;
  catalog?: boolean;
  email?: string;
  licenseeName?: string;
  origin: string;
};

export type PurchaseSuccess = {
  ok: true;
  alreadyLicensed: boolean;
  license: StoredLicense;
  pdfUrl: string;
  receiptUrl: string;
  emailed: boolean;
  emailError?: string;
};

function parseReceipt(value: X402Receipt | string): X402Receipt {
  if (typeof value === "string") return JSON.parse(value) as X402Receipt;
  return value;
}

function mapRow(row: LicenseRow): StoredLicense {
  return {
    id: row.id,
    fontSlug: row.font_slug,
    fontName: row.font_name,
    payerId: row.payer_id,
    email: row.email,
    licenseeName: row.licensee_name,
    amountUsd: typeof row.amount_usd === "number" ? row.amount_usd : Number(row.amount_usd),
    network: row.network,
    asset: row.asset,
    txHash: row.tx_hash,
    receipt: parseReceipt(row.receipt),
    emailedTo: row.emailed_to,
    emailStatus: row.email_status,
    createdAt: row.created_at,
  };
}

function newId(): string {
  return crypto.randomUUID();
}

export function licenseUrls(origin: string, id: string) {
  const base = origin.replace(/\/$/, "");
  return {
    receiptUrl: `${base}/license/${id}`,
    pdfUrl: `${base}/api/licenses/${id}/pdf`,
    jsonUrl: `${base}/api/licenses/${id}`,
  };
}

export async function getLicenseById(id: string): Promise<StoredLicense | null> {
  const sql = await getSql();
  const rows = await sql<LicenseRow>`select * from licenses where id = ${id} limit 1`;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getLicenseByFontPayer(slug: string, payerId: string): Promise<StoredLicense | null> {
  const sql = await getSql();
  const rows = await sql<LicenseRow>`
    select * from licenses
    where font_slug = ${slug} and payer_id = ${payerId.toLowerCase()}
    limit 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function pdfForLicense(license: StoredLicense): Promise<Uint8Array> {
  return buildLicensePdf({
    id: license.id,
    issuedAt: license.createdAt,
    grant: license.receipt.grant,
    receipt: license.receipt,
  });
}

async function persistLicense(input: {
  fontSlug: string;
  fontName: string;
  payerId: string;
  email?: string;
  licenseeName?: string;
  amountUsd: number;
  network: string;
  txHash: string;
  payload: PaymentPayload;
  receipt: X402Receipt;
}): Promise<StoredLicense> {
  const sql = await getSql();
  const id = newId();
  const rows = await sql<LicenseRow>`
    insert into licenses (
      id, font_slug, font_name, payer_id, email, licensee_name,
      amount_usd, network, asset, tx_hash, payment_payload, payment_response, receipt
    ) values (
      ${id}, ${input.fontSlug}, ${input.fontName}, ${input.payerId}, ${input.email ?? null},
      ${input.licenseeName ?? null}, ${input.amountUsd}, ${input.network}, ${"USDC"},
      ${input.txHash}, ${JSON.stringify(input.payload)}::jsonb, ${JSON.stringify(input.receipt)}::jsonb,
      ${JSON.stringify(input.receipt)}::jsonb
    )
    returning *
  `;
  return mapRow(rows[0]!);
}

async function deliverEmail(license: StoredLicense, origin: string): Promise<PurchaseSuccess> {
  const urls = licenseUrls(origin, license.id);
  const mail = await emailLicenseReceipt({
    id: license.id,
    issuedAt: license.createdAt,
    grant: license.receipt.grant,
    receipt: license.receipt,
    to: license.email ?? undefined,
  });
  const sql = await getSql();
  await sql`
    update licenses
    set email_status = ${mail.sent ? "sent" : "failed"},
        emailed_to = ${mail.to.join(",") || null}
    where id = ${license.id}
  `;
  return {
    ok: true,
    alreadyLicensed: false,
    license: { ...license, emailStatus: mail.sent ? "sent" : "failed", emailedTo: mail.to.join(",") || null },
    emailed: mail.sent,
    emailError: mail.error,
    ...urls,
  };
}

function alreadyResponse(existing: StoredLicense, origin: string): Response {
  const urls = licenseUrls(origin, existing.id);
  const body = { ok: true, alreadyLicensed: true, license: existing, emailed: existing.emailStatus === "sent", ...urls };
  return Response.json(body, {
    headers: {
      ...corsHeaders(),
      "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(existing.receipt), "utf8").toString("base64"),
    },
  });
}

export async function purchaseLicense(request: Request, input: PurchaseInput): Promise<Response> {
  const catalog = Boolean(input.catalog) || input.slug === CATALOG_SLUG;
  const font = catalog ? null : getFontOrThrow(input.slug ?? "");
  const sources = font
    ? withSources(font)
    : { dafontUrl: DAFONT_AUTHOR, downloadUrl: DAFONT_AUTHOR, designerUrl: DESIGNER_URL };
  const fontSlug = catalog ? CATALOG_SLUG : font!.slug;
  const fontName = catalog ? CATALOG_FONT_NAME : font!.name;
  const amountUsd = catalog ? CATALOG_LICENSE_USD : LICENSE_USD;
  const amountAtomic = usdAtomic(amountUsd);
  const resource = `${input.origin}/api/licenses`;
  const description = catalog
    ? `Unlimited Commercial Use License for the entire Xerographer Fonts catalog (one agent)`
    : `Unlimited Commercial Use License for ${fontName} (Xerographer Fonts)`;
  const required = paymentRequired(resource, description, undefined, amountAtomic);
  const requirement = required.accepts[0]!;

  const payload = readPaymentPayload(request);
  if (!payload) {
    return paymentRequiredResponse(
      paymentRequired(resource, description, "PAYMENT-SIGNATURE header required to purchase a license", amountAtomic),
    );
  }

  let payer: string;
  try {
    payer = extractPayer(payload);
  } catch (err) {
    return paymentRequiredResponse(
      paymentRequired(resource, description, err instanceof Error ? err.message : "Invalid payment payload", amountAtomic),
    );
  }

  const catalogExisting = await getLicenseByFontPayer(CATALOG_SLUG, payer);
  if (catalogExisting) return alreadyResponse(catalogExisting, input.origin);

  if (!catalog) {
    const existing = await getLicenseByFontPayer(fontSlug, payer);
    if (existing) return alreadyResponse(existing, input.origin);
  }

  const settled = await verifyAndSettle(payload, requirement);
  if (!settled.success || !settled.transaction) {
    return paymentRequiredResponse(
      paymentRequired(resource, description, settled.errorReason ?? "Payment could not be settled", amountAtomic),
    );
  }

  const grant: LicenseGrant = {
    type: catalog ? "catalog-unlimited-commercial-use" : "unlimited-commercial-use",
    scope: catalog ? "catalog" : "font",
    permission: catalog ? LICENSE_PERMISSION_CATALOG : LICENSE_PERMISSION_FONT,
    terms: LICENSE_TERMS,
    fontSlug,
    fontName,
    licensee: (input.licenseeName?.trim() || payer).toLowerCase(),
    email: input.email?.trim() || undefined,
    priceUsd: amountUsd,
    currency: "USDC",
    sources: {
      dafont: sources.dafontUrl,
      download: sources.downloadUrl,
      designer: sources.designerUrl,
    },
  };

  const receipt: X402Receipt = {
    success: true,
    transaction: settled.transaction,
    network: settled.network ?? requirement.network,
    payer,
    settledAt: new Date().toISOString(),
    grant,
  };

  const stored = await persistLicense({
    fontSlug,
    fontName,
    payerId: payer,
    email: input.email?.trim(),
    licenseeName: input.licenseeName?.trim(),
    amountUsd,
    network: receipt.network,
    txHash: receipt.transaction,
    payload,
    receipt,
  });

  const result = await deliverEmail(stored, input.origin);
  return Response.json(result, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(receipt), "utf8").toString("base64"),
      "X-PAYMENT-RESPONSE": Buffer.from(JSON.stringify(receipt), "utf8").toString("base64"),
    },
  });
}
