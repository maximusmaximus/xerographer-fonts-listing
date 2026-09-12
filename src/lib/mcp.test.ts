import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toolList } from "./mcp.ts";

describe("MCP tools", () => {
  it("exposes catalog, preview, and paid licensing tools", () => {
    const names = toolList().tools.map((t) => t.name);
    assert.deepEqual(names, [
      "list_fonts",
      "get_font",
      "list_categories",
      "preview_text",
      "purchase_commercial_license",
      "get_license",
    ]);
    const paid = toolList().tools.find((t) => t.name === "purchase_commercial_license");
    assert.match(paid?.description ?? "", /45/);
    assert.match(paid?.description ?? "", /x402/);
    assert.ok(paid?.inputSchema.properties && "email" in paid.inputSchema.properties);
  });
});
