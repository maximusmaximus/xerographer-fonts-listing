import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { PROMO_PAGES, PROMO_SNOOZE_MS, promoAllowedOnPath, promoSrc, shouldShowPromo, wrapIndex } from "./book-promo.ts";

const base = { pathname: "/", now: 1_800_000_000_000, dismissedAt: null, shownThisSession: false };

describe("book promo", () => {
  it("never shows on /book, thanks, order, admin or api routes", () => {
    for (const p of ["/book", "/book/", "/book/thanks", "/order/abc", "/admin/store", "/api/store/status", "/license/x"]) {
      assert.equal(promoAllowedOnPath(p), false, p);
    }
    for (const p of ["/", "/about", "/agents", "/font/funsized", "/terms", "/bookish"]) assert.equal(promoAllowedOnPath(p), true, p);
  });

  it("shows on first visit, hides for 3 days after dismissal, then again", () => {
    assert.equal(shouldShowPromo(base), true);
    const d = String(base.now);
    assert.equal(shouldShowPromo({ ...base, dismissedAt: d, now: base.now + 1000 }), false);
    assert.equal(shouldShowPromo({ ...base, dismissedAt: d, now: base.now + PROMO_SNOOZE_MS - 1 }), false);
    assert.equal(shouldShowPromo({ ...base, dismissedAt: d, now: base.now + PROMO_SNOOZE_MS }), true);
  });

  it("at most once per session; garbage storage values are ignored", () => {
    assert.equal(shouldShowPromo({ ...base, shownThisSession: true }), false);
    assert.equal(shouldShowPromo({ ...base, dismissedAt: "nope" }), true);
    assert.equal(shouldShowPromo({ ...base, dismissedAt: String(base.now + 10 * PROMO_SNOOZE_MS) }), true); // future clock skew
  });

  it("has 10 preview pages, each in two sizes under 250 KB", () => {
    assert.equal(PROMO_PAGES.length, 10);
    for (const p of PROMO_PAGES) {
      for (const s of [640, 1200] as const) {
        const f = new URL(`../../public${promoSrc(p.file, s)}`, import.meta.url);
        assert.ok(existsSync(f), f.pathname);
        assert.ok(statSync(f).size < 250 * 1024, f.pathname);
      }
      assert.ok(p.alt.length > 10);
    }
  });

  it("wraps carousel indices", () => {
    assert.equal(wrapIndex(-1, 10), 9);
    assert.equal(wrapIndex(10, 10), 0);
    assert.equal(wrapIndex(3, 10), 3);
  });
});

describe("swipe", () => {
  it("needs a horizontal move past the threshold", async () => {
    const { swipeDirection, SWIPE_THRESHOLD_PX } = await import("./book-promo.ts");
    assert.equal(swipeDirection(-80, 5), 1);
    assert.equal(swipeDirection(80, -5), -1);
    assert.equal(swipeDirection(-(SWIPE_THRESHOLD_PX - 1), 0), 0);
    assert.equal(swipeDirection(-SWIPE_THRESHOLD_PX, 0), 1);
    assert.equal(swipeDirection(-60, 90), 0); // vertical scroll wins
    assert.equal(swipeDirection(0, 0), 0);
  });
});
