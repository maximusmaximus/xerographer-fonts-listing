import { LICENSE_USD } from "./constants.ts";

/** USDC on Base mainnet. */
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
/** USDC on Base Sepolia. */
export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const LICENSE_AMOUNT_ATOMIC = String(LICENSE_USD * 1_000_000);

export type X402Network = "base" | "base-sepolia";

export type PaymentRequirements = {
  scheme: "exact";
  network: X402Network;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { name: string; version: string };
};

export type PaymentRequiredBody = {
  x402Version: 1;
  accepts: PaymentRequirements[];
  error?: string;
};

export type PaymentPayload = {
  x402Version: 1;
  scheme: "exact";
  network: string;
  payload: {
    signature?: string;
    authorization?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

export type SettlementResponse = {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string;
};

export type LicenseGrant = {
  type: "unlimited-commercial-use";
  permission: "The licensee is granted unlimited commercial use of this typeface.";
  fontSlug: string;
  fontName: string;
  licensee: string;
  email?: string;
  priceUsd: number;
  currency: "USDC";
  sources: {
    dafont: string;
    download: string;
    designer: string;
  };
};

export type X402Receipt = {
  success: true;
  transaction: string;
  network: string;
  payer: string;
  settledAt: string;
  grant: LicenseGrant;
};

export function x402Config() {
  const network = (process.env.X402_NETWORK?.trim() || "base") as X402Network;
  const payTo = process.env.X402_PAY_TO?.trim() || "";
  const facilitator =
    process.env.X402_FACILITATOR_URL?.trim() || "https://x402.org/facilitator";
  const asset = network === "base-sepolia" ? USDC_BASE_SEPOLIA : USDC_BASE;
  return { network, payTo, facilitator, asset };
}

export function encodeHeader(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeHeader<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

export function readPaymentPayload(request: Request): PaymentPayload | null {
  const raw =
    request.headers.get("PAYMENT-SIGNATURE") ??
    request.headers.get("payment-signature") ??
    request.headers.get("X-PAYMENT") ??
    request.headers.get("x-payment");
  return decodeHeader<PaymentPayload>(raw);
}

export function paymentRequired(resource: string, description: string, error?: string): PaymentRequiredBody {
  const { network, payTo, asset } = x402Config();
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network,
        maxAmountRequired: LICENSE_AMOUNT_ATOMIC,
        resource,
        description,
        mimeType: "application/json",
        payTo,
        maxTimeoutSeconds: 120,
        asset,
        extra: { name: "USD Coin", version: "2" },
      },
    ],
    error,
  };
}

export function paymentRequiredResponse(body: PaymentRequiredBody): Response {
  const encoded = encodeHeader(body);
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": encoded,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
      "Access-Control-Allow-Headers":
        "Content-Type, PAYMENT-SIGNATURE, PAYMENT-REQUIRED, X-PAYMENT, X-PAYMENT-RESPONSE",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

export function extractPayer(payload: PaymentPayload): string {
  const auth = payload.payload?.authorization as { from?: string } | undefined;
  if (auth?.from && typeof auth.from === "string") return auth.from.toLowerCase();
  const from = payload.payload?.from;
  if (typeof from === "string") return from.toLowerCase();
  const signature = payload.payload?.signature;
  if (typeof signature === "string" && signature.length > 10) return `sig:${signature.slice(0, 42).toLowerCase()}`;
  throw new Error("Payment payload is missing a payer identity");
}

export async function verifyAndSettle(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<SettlementResponse> {
  const { facilitator, payTo } = x402Config();
  if (!payTo) {
    return { success: false, errorReason: "Merchant payTo address is not configured (X402_PAY_TO)." };
  }

  const body = JSON.stringify({ paymentPayload: payload, paymentRequirements: requirements });
  const headers = { "Content-Type": "application/json" };

  const verifyRes = await fetch(`${facilitator.replace(/\/$/, "")}/verify`, {
    method: "POST",
    headers,
    body,
  });
  if (!verifyRes.ok) {
    const text = await verifyRes.text().catch(() => "");
    return { success: false, errorReason: `Facilitator verify failed (${verifyRes.status}): ${text.slice(0, 400)}` };
  }
  const verifyJson = (await verifyRes.json()) as { isValid?: boolean; invalidReason?: string; payer?: string };
  if (verifyJson.isValid === false) {
    return { success: false, errorReason: verifyJson.invalidReason ?? "Payment was not valid" };
  }

  const settleRes = await fetch(`${facilitator.replace(/\/$/, "")}/settle`, {
    method: "POST",
    headers,
    body,
  });
  if (!settleRes.ok) {
    const text = await settleRes.text().catch(() => "");
    return { success: false, errorReason: `Facilitator settle failed (${settleRes.status}): ${text.slice(0, 400)}` };
  }
  const settled = (await settleRes.json()) as SettlementResponse;
  if (!settled.payer && verifyJson.payer) settled.payer = verifyJson.payer;
  return settled;
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, PAYMENT-SIGNATURE, PAYMENT-REQUIRED, X-PAYMENT, X-PAYMENT-RESPONSE",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
