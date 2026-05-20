import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findGDevelopInstall } from "../core/install.js";
import { searchGdevelopCode } from "../core/search.js";
import { fetchWikiPage } from "../core/wiki.js";
import {
  listEventTypes,
  listResourceTypes,
  listVariableTypes,
} from "../core/catalog-features.js";
import { textResult, errorResult } from "./shared.js";

export function registerDiscoveryTools(server: McpServer): void {
  server.tool(
    "search_gdevelop_code",
    "Grep-style search across the local GDevelop sources cache. Pass a regex query and optional filters (path prefixes, extensions, context lines). Returns concise hits — file path, line number, matching text, optional context. Use to discover where features live before reading specific files.",
    {
      query: z.string().describe("Regex pattern to search for"),
      flags: z
        .string()
        .optional()
        .describe("Regex flags (default 'i' for case-insensitive)"),
      pathPrefixes: z
        .array(z.string())
        .optional()
        .describe(
          "Restrict to files starting with these paths (e.g. ['Core/GDCore/', 'Extensions/Sprite/'])",
        ),
      extensions: z
        .array(z.string())
        .optional()
        .describe(
          "Restrict to files with these extensions (e.g. ['.cpp', '.ts'])",
        ),
      contextBefore: z.number().int().nonnegative().max(10).optional(),
      contextAfter: z.number().int().nonnegative().max(10).optional(),
      maxResults: z.number().int().positive().max(200).optional(),
    },
    async ({
      query,
      flags,
      pathPrefixes,
      extensions,
      contextBefore,
      contextAfter,
      maxResults,
    }) => {
      try {
        const result = searchGdevelopCode({
          query,
          flags,
          pathPrefixes,
          extensions,
          contextBefore,
          contextAfter,
          maxResults,
        });
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "describe_feature",
    "Fetch a GDevelop wiki page (wiki.gdevelop.io) and return it as concise markdown. Use to read user-facing docs about features — typically more readable than the C++/TS source. Accepts a slug ('all-features', 'all-features/timers') or a full URL.",
    {
      page: z
        .string()
        .describe(
          "Wiki slug (e.g. 'all-features') or full https URL. The MCP normalizes to /gdevelop5/<slug>/.",
        ),
    },
    async ({ page }) => {
      try {
        const result = await fetchWikiPage(page);
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "list_event_types",
    "List the built-in event types defined in Core/GDCore/Events/Builtin/ and GDJS/GDJS/Events/Builtin/. Each entry has the JSON type identifier (BuiltinCommonInstructions::<X>) and whether it can have nested sub-events.",
    {},
    async () => {
      try {
        const install = findGDevelopInstall();
        const eventTypes = listEventTypes(install);
        return textResult({ count: eventTypes.length, eventTypes });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "list_resource_types",
    "List the resource types (image, audio, font, json, video…) defined in Core/GDCore/Project/. Use to know what kinds of assets a project's resources array can hold.",
    {},
    async () => {
      try {
        const install = findGDevelopInstall();
        const resourceTypes = listResourceTypes(install);
        return textResult({ count: resourceTypes.length, resourceTypes });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "list_variable_types",
    "List GDevelop's variable primitive types (Number, String, Boolean, Structure, Array). Parsed from Core/GDCore/Project/Variable.h.",
    {},
    async () => {
      try {
        const install = findGDevelopInstall();
        const variableTypes = listVariableTypes(install);
        return textResult({ count: variableTypes.length, variableTypes });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
