import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeHeader,
  encodeHeader,
  extractPayer,
  LICENSE_AMOUNT_ATOMIC,
  paymentRequired,
  type PaymentPayload,
} from "./x402.ts";

describe("x402 helpers", () => {
  it("prices unlimited commercial use at 45 USDC", () => {
    assert.equal(LICENSE_AMOUNT_ATOMIC, "45000000");
    const body = paymentRequired("https://example.com/api/licenses", "license");
    assert.equal(body.x402Version, 1);
    assert.equal(body.accepts[0]?.scheme, "exact");
    assert.equal(body.accepts[0]?.maxAmountRequired, "45000000");
    assert.equal(body.accepts[0]?.extra.name, "USD Coin");
  });

  it("round-trips payment header encoding", () => {
    const payload = { hello: "world", n: 45 };
    const encoded = encodeHeader(payload);
    assert.deepEqual(decodeHeader(encoded), payload);
  });

  it("extracts the payer from an exact-scheme payload", () => {
    const payload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "base",
      payload: {
        signature: "0xabc",
        authorization: { from: "0xAbCDEF0000000000000000000000000000000001" },
      },
    };
    assert.equal(extractPayer(payload), "0xabcdef0000000000000000000000000000000001");
  });
});
