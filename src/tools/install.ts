import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findGDevelopInstall } from "../core/install.js";
import { getRuntimeInfo, checkRuntimeFreshness } from "../core/runtime-info.js";
import {
  syncGdevelopSources,
  checkFreshness,
  readManifest,
} from "../core/cache.js";
import { GDEVELOP_OVERVIEW } from "../core/overview.js";
import { textResult, errorResult } from "./shared.js";

export function registerInstallTools(server: McpServer): void {
  server.tool(
    "gdevelop_install_info",
    "Returns the state of the GDevelop sources cache (the parsing pipeline's only source: GitHub 4ian/GDevelop, no fallback), plus optional info about a local desktop install (informational only, not used for parsing). If no cache, call sync_gdevelop_sources first.",
    {},
    async () => {
      try {
        const manifest = readManifest();
        const runtime = getRuntimeInfo();
        if (!manifest) {
          return textResult({
            ready: false,
            message:
              "No cache yet. Call sync_gdevelop_sources to download the GDevelop source tree from 4ian/GDevelop.",
            localDesktop: runtime.localDesktop,
            gdcoreToolsVersion: runtime.gdcoreToolsVersion,
          });
        }
        const install = findGDevelopInstall();
        return textResult({
          ready: true,
          cache: manifest,
          cachePath: install.resourcesPath,
          extensionsPath: install.extensionsPath,
          gdjsRuntimeSourcesPath: install.gdjsRuntimeSourcesPath,
          localDesktop: runtime.localDesktop,
          gdcoreToolsVersion: runtime.gdcoreToolsVersion,
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "sync_gdevelop_sources",
    "Download (or refresh) the canonical GDevelop source tree from 4ian/GDevelop GitHub. Covers Core/, Extensions/, GDJS/Runtime/, types — the exhaustive surface needed by parsing tools. Stores raw files in ~/.cache/gdevelop-mcp/ref-<ref>/, plus a manifest.json with ref+sha+timestamp. Idempotent (skip already-downloaded files unless force:true). Pass `ref` to pin a specific tag/branch/SHA; otherwise uses the latest GDevelop release.",
    {
      ref: z
        .string()
        .optional()
        .describe(
          "GitHub ref (tag/branch/SHA). Defaults to the latest GDevelop release tag.",
        ),
      force: z
        .boolean()
        .optional()
        .describe("Re-download all files (skip the existence check)."),
      concurrency: z.number().int().positive().max(32).optional(),
    },
    async ({ ref, force, concurrency }) => {
      try {
        const result = await syncGdevelopSources({ ref, force, concurrency });
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "check_cache_freshness",
    "Compare the local cache against the latest GDevelop release on GitHub. Cheap; result is itself cached for an hour. Returns whether a refresh would pull a newer ref/SHA.",
    {
      force: z
        .boolean()
        .optional()
        .describe("Bypass the 1h freshness-check TTL"),
    },
    async ({ force }) => {
      try {
        const status = await checkFreshness({ force });
        return textResult(status);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "check_runtime_freshness",
    "Check whether the bundled gdcore-tools runtime is up to date against the npm registry. (gdcore-tools is only used transitively by gdexporter for preview_scene; the parsing pipeline uses GitHub directly.)",
    {},
    async () => {
      try {
        const report = await checkRuntimeFreshness();
        return textResult(report);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "gdevelop_overview",
    "Returns a concise architectural map of GDevelop: where to look for what in the source tree, plus pointers to the right MCP tools for each kind of question. Read this BEFORE deep-diving — it saves token spend by directing you to the right files.",
    {},
    async () => textResult(GDEVELOP_OVERVIEW),
  );
}
