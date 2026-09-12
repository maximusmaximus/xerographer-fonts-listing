import { LICENSE_USD } from "./constants.ts";
import { categoryTree, getFont, queryFonts, STATS, withSources } from "./fonts.ts";
import { corsHeaders } from "./x402.ts";

export const MCP_PROTOCOL_VERSION = "2025-03-26";

type Json = Record<string, unknown>;

type RpcRequest = {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Json;
};

export function mcpResourceList(origin: string) {
  return {
    resources: [
      {
        uri: `${origin}/api/fonts`,
        name: "Font catalog",
        mimeType: "application/json",
        description: "Full Xerographer Fonts catalog pulled from DaFont.",
      },
      {
        uri: `${origin}/llms.txt`,
        name: "Agent instructions",
        mimeType: "text/plain",
        description: "How agents should browse, preview, and license fonts.",
      },
    ],
  };
}

export function toolList() {
  return {
    tools: [
      {
        name: "list_fonts",
        description: "Search and filter the Xerographer Fonts catalog (1,376 faces from DaFont).",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Name search" },
            category: { type: "string" },
            subcategory: { type: "string" },
            sort: { type: "string", enum: ["popular", "name", "recent"] },
            limit: { type: "number" },
            offset: { type: "number" },
          },
        },
      },
      {
        name: "get_font",
        description: "Get one typeface with DaFont, download, and designer source links.",
        inputSchema: {
          type: "object",
          required: ["slug"],
          properties: { slug: { type: "string" } },
        },
      },
      {
        name: "list_categories",
        description: "List DaFont categories and subcategories with counts.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "preview_text",
        description: "Return URLs to preview custom text in a typeface (live TTF + DaFont specimen).",
        inputSchema: {
          type: "object",
          required: ["slug"],
          properties: {
            slug: { type: "string" },
            text: { type: "string" },
            size: { type: "number" },
          },
        },
      },
      {
        name: "purchase_commercial_license",
        description: `Pay US$${LICENSE_USD} USDC via x402 for an Unlimited Commercial Use license, per font per agent. Optional email receives the PDF receipt; maxinfeld@gmail.com is always copied. Requires PAYMENT-SIGNATURE on the HTTP request.`,
        inputSchema: {
          type: "object",
          required: ["slug"],
          properties: {
            slug: { type: "string", description: "Font slug, e.g. crackvetica" },
            email: { type: "string", description: "Optional email for the PDF receipt" },
            licenseeName: { type: "string", description: "Optional display name for the licensee" },
          },
        },
      },
      {
        name: "get_license",
        description: "Retrieve an issued commercial license and receipt URLs by id.",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    ],
  };
}

function ok(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

function err(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } };
}

function textResult(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

async function callTool(name: string, args: Json, request: Request, origin: string): Promise<Response | unknown> {
  switch (name) {
    case "list_fonts":
      return textResult(
        queryFonts({
          q: str(args.q),
          category: str(args.category),
          subcategory: str(args.subcategory),
          sort: args.sort === "name" || args.sort === "recent" ? args.sort : "popular",
          limit: num(args.limit) ?? 24,
          offset: num(args.offset) ?? 0,
        }),
      );
    case "get_font": {
      const font = getFont(str(args.slug) ?? "");
      if (!font) throw new Error("Unknown font slug");
      return textResult(withSources(font));
    }
    case "list_categories":
      return textResult({ stats: STATS, categories: categoryTree() });
    case "preview_text": {
      const slug = str(args.slug) ?? "";
      const font = getFont(slug);
      if (!font) throw new Error("Unknown font slug");
      const text = str(args.text) || font.name;
      return textResult({
        slug,
        text,
        size: num(args.size) ?? 64,
        liveFontUrl: `${origin}/api/font-file/${slug}`,
        specimenUrl: `${origin}/api/preview-image/${slug}`,
        dafontPreview: `https://www.dafont.com/${slug}.font?text=${encodeURIComponent(text)}`,
        cssFamily: `xf-${slug}`,
      });
    }
    case "purchase_commercial_license": {
      const slug = str(args.slug) ?? "";
      if (!getFont(slug)) throw new Error("Unknown font slug");
      const { purchaseLicense } = await import("./license.ts");
      return purchaseLicense(request, {
        slug,
        email: str(args.email),
        licenseeName: str(args.licenseeName),
        origin,
      });
    }
    case "get_license": {
      const id = str(args.id) ?? "";
      const { getLicenseById } = await import("./license.ts");
      const license = await getLicenseById(id);
      if (!license) throw new Error("License not found");
      return textResult({
        ...license,
        pdfUrl: `${origin}/api/licenses/${license.id}/pdf`,
        receiptUrl: `${origin}/license/${license.id}`,
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function handleMcp(request: Request, origin: string): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method === "GET") {
    return Response.json(
      {
        protocolVersion: MCP_PROTOCOL_VERSION,
        name: "xerographer-fonts",
        title: "Xerographer Fonts",
        instructions:
          "Browse 1,376 Xerographer typefaces, preview custom text, and purchase Unlimited Commercial Use licenses for US$45 USDC via x402 (PAYMENT-SIGNATURE). Optional email on purchase; maxinfeld@gmail.com is always copied.",
        capabilities: { tools: {}, resources: {} },
      },
      { headers: corsHeaders() },
    );
  }

  let rpc: RpcRequest;
  try {
    rpc = (await request.json()) as RpcRequest;
  } catch {
    return Response.json(err(null, -32700, "Parse error"), { status: 400, headers: corsHeaders() });
  }

  const method = rpc.method ?? "";
  try {
    if (method === "initialize") {
      return json(
        ok(rpc.id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "xerographer-fonts", version: "1.0.0" },
          instructions:
            "Use list_fonts / get_font to explore. purchase_commercial_license is x402-gated at US$45 USDC per font per agent.",
        }),
      );
    }
    if (method === "notifications/initialized" || method === "ping") {
      return json(ok(rpc.id, {}));
    }
    if (method === "tools/list") return json(ok(rpc.id, toolList()));
    if (method === "resources/list") return json(ok(rpc.id, mcpResourceList(origin)));
    if (method === "resources/read") {
      const uri = str(rpc.params?.uri) ?? "";
      if (uri.endsWith("/api/fonts")) {
        return json(
          ok(rpc.id, {
            contents: [{ uri, mimeType: "application/json", text: JSON.stringify(queryFonts({ limit: 50 })) }],
          }),
        );
      }
      return json(err(rpc.id, -32002, "Unknown resource"));
    }
    if (method === "tools/call") {
      const name = str(rpc.params?.name) ?? "";
      const args = (rpc.params?.arguments as Json) ?? {};
      const result = await callTool(name, args, request, origin);
      if (result instanceof Response) {
        if (result.status === 402) return result;
        const body = await result.json();
        const headers = new Headers(result.headers);
        for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
        return new Response(JSON.stringify(ok(rpc.id, textResult(body))), {
          status: result.status,
          headers,
        });
      }
      return json(ok(rpc.id, result));
    }
    return json(err(rpc.id, -32601, `Method not found: ${method}`));
  } catch (error) {
    return json(err(rpc.id, -32000, error instanceof Error ? error.message : "Internal error"));
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
