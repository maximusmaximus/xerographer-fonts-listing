import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentTourStep, guideRouteFromPath, HINTS, TOURS } from "./guide.ts";

describe("guide", () => {
  it("maps routes from pathnames", () => {
    assert.equal(guideRouteFromPath("/"), "catalog");
    assert.equal(guideRouteFromPath("/font/funsized"), "font");
    assert.equal(guideRouteFromPath("/agents"), "agents");
    assert.equal(guideRouteFromPath("/about"), "about");
  });

  it("has copy for every tour stop", () => {
    for (const steps of Object.values(TOURS)) {
      for (const id of steps) {
        assert.ok(HINTS[id].title);
        assert.ok(HINTS[id].body.length > 20);
      }
    }
  });

  it("returns the current tour step", () => {
    assert.equal(currentTourStep("catalog", 0)?.id, "tester");
    assert.equal(currentTourStep("font", 2)?.id, "canvas");
    assert.equal(currentTourStep("font", 4)?.id, "export");
    assert.equal(currentTourStep(null, 0), null);
  });
});
