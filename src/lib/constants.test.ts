import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_LICENSE_USD,
  LICENSE_TERMS,
  LICENSE_USD,
  usdAtomic,
  usdLabel,
} from "./constants.ts";

describe("license prices and terms", () => {
  it("prices a single face at 95 and the catalog at 65000", () => {
    assert.equal(LICENSE_USD, 95);
    assert.equal(CATALOG_LICENSE_USD, 65_000);
    assert.equal(usdAtomic(LICENSE_USD), "95000000");
    assert.equal(usdAtomic(CATALOG_LICENSE_USD), "65000000000");
    assert.equal(usdLabel(CATALOG_LICENSE_USD), "US$65,000");
  });

  it("forbids resale of font files and unapproved editing", () => {
    assert.match(LICENSE_TERMS, /may not resell/i);
    assert.match(LICENSE_TERMS, /font files/i);
    assert.match(LICENSE_TERMS, /may not modify/i);
    assert.match(LICENSE_TERMS, /derivative typefaces/i);
    assert.match(LICENSE_TERMS, /written permission/i);
  });
});
