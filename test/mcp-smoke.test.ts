/**
 * MCP server smoke test.
 *
 * Boots the built server (dist/index.js) as a child process speaking the
 * Model Context Protocol over stdio, asks for the tool catalog, and
 * verifies that the expected core tools are registered. Acts as the
 * thinnest possible end-to-end check that the wiring in src/index.ts +
 * src/tools/*.ts is functional.
 *
 * Skipped automatically if dist/ hasn't been built — run `pnpm build`
 * first (CI does this).
 */
import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const DIST_ENTRY = resolve(__dirname, "..", "dist", "index.js");
const HAS_BUILD = existsSync(DIST_ENTRY);

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
};

async function callServer(
  messages: JsonRpcRequest[],
): Promise<JsonRpcResponse[]> {
  return new Promise((resolveOuter, rejectOuter) => {
    const child = spawn("node", [DIST_ENTRY], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, GDEVELOP_MCP_LOG_LEVEL: "error" },
    });

    let stdoutBuf = "";
    const responses: JsonRpcResponse[] = [];
    let timer: NodeJS.Timeout | null = null;

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString("utf-8");
      let nl: number;
      while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        try {
          responses.push(JSON.parse(line) as JsonRpcResponse);
        } catch {
          // ignore non-JSON lines (server may emit log frames)
        }
        if (responses.length >= messages.length) {
          if (timer) clearTimeout(timer);
          child.kill();
          resolveOuter(responses);
          return;
        }
      }
    });

    child.on("error", rejectOuter);
    child.on("exit", () => {
      if (responses.length < messages.length) {
        resolveOuter(responses);
      }
    });

    timer = setTimeout(() => {
      child.kill();
      rejectOuter(new Error("MCP server timed out"));
    }, 8000);

    for (const msg of messages) {
      child.stdin.write(JSON.stringify(msg) + "\n");
    }
  });
}

(HAS_BUILD ? describe : describe.skip)("MCP server smoke test", () => {
  it("boots, handshakes, and lists expected tools", async () => {
    const responses = await callServer([
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "smoke-test", version: "1.0.0" },
        },
      },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ]);

    expect(responses).toHaveLength(2);
    expect(responses[0].error).toBeUndefined();

    const toolsResult = responses[1].result as {
      tools: Array<{ name: string }>;
    };
    expect(toolsResult.tools.length).toBeGreaterThan(30);

    const names = new Set(toolsResult.tools.map((t) => t.name));
    const expectedTools = [
      "edit_project",
      "inspect_project",
      "validate_project",
      "diff_projects",
      "undo_last_edit",
      "list_backups",
      "list_instructions",
      "describe_instruction",
      "list_extensions",
      "list_object_types",
      "list_behavior_types",
      "list_event_types",
      "list_variable_types",
      "list_resource_types",
      "describe_extension",
      "read_extension_source",
      "read_github_source",
      "search_gdevelop_code",
      "sync_gdevelop_sources",
      "check_cache_freshness",
      "gdevelop_install_info",
      "check_runtime_freshness",
      "summarize_events",
      "describe_feature",
      "describe_object_schema",
      "gdevelop_overview",
      "list_asset_packs",
      "list_asset_filters",
      "search_assets",
      "get_asset_details",
      "import_assets_into_project",
      "list_examples",
      "list_example_filters",
      "get_example_details",
      "preview_scene",
      "render_scene_static",
      "quick_start_template",
    ];
    for (const tool of expectedTools) {
      expect(names.has(tool), `missing tool: ${tool}`).toBe(true);
    }
  });

  it("lists 6 prompts", async () => {
    const responses = await callServer([
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "smoke-test", version: "1.0.0" },
        },
      },
      { jsonrpc: "2.0", id: 2, method: "prompts/list" },
    ]);

    const promptsResult = responses[1].result as {
      prompts: Array<{ name: string }>;
    };
    expect(promptsResult.prompts.length).toBeGreaterThanOrEqual(6);
  });
});

if (!HAS_BUILD) {
  describe("mcp-smoke", () => {
    it("is skipped — run `pnpm build` first", () => {
      expect(true).toBe(true);
    });
  });
}
