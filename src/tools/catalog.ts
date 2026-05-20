import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findGDevelopInstall } from "../core/install.js";
import {
  OBJECT_TYPES,
  BEHAVIOR_TYPES,
  findObjectType,
} from "../core/catalog-static.js";
import { buildDynamicCatalog } from "../core/catalog-dynamic.js";
import {
  buildInstructionCatalog,
  findInstructions,
  findInstructionByType,
} from "../core/catalog-actions.js";
import { textResult, errorResult } from "./shared.js";

export function registerCatalogTools(server: McpServer): void {
  server.tool(
    "list_object_types",
    "List known GDevelop object types with their internal JSON identifiers. The 'type' field is what goes in the JSON 'type' property. Use describe_object_schema for content details.",
    {
      category: z
        .string()
        .optional()
        .describe("Optional category filter: general, text, ui, vfx"),
    },
    async ({ category }) => {
      let types = OBJECT_TYPES;
      if (category) {
        types = types.filter((t) => t.category === category);
      }
      return textResult({
        count: types.length,
        types: types.map((t) => ({
          type: t.type,
          displayName: t.displayName,
          category: t.category,
          extension: t.extension,
          description: t.description,
        })),
      });
    },
  );

  server.tool(
    "list_behavior_types",
    "List known GDevelop behavior types with their internal JSON identifiers and which objects they can be attached to.",
    {
      extension: z
        .string()
        .optional()
        .describe("Optional extension name filter"),
    },
    async ({ extension }) => {
      let types = BEHAVIOR_TYPES;
      if (extension) {
        types = types.filter((t) => t.extension === extension);
      }
      return textResult({ count: types.length, behaviors: types });
    },
  );

  server.tool(
    "describe_object_schema",
    "Returns the schema and content example for a GDevelop object type. First checks the curated static catalog (best precision), then falls back to the dynamic catalog parsed from your local install (broader coverage but less detail). Use BEFORE writing object JSON to avoid format errors.",
    {
      type: z
        .string()
        .describe(
          "Internal type identifier, e.g. 'Sprite' or 'TextObject::Text'",
        ),
    },
    async ({ type }) => {
      const info = findObjectType(type);
      if (info) return textResult({ found: true, source: "static", ...info });
      try {
        const install = findGDevelopInstall();
        const dyn = buildDynamicCatalog(install);
        const exactMatch = dyn.allObjects.find((o) => o.typeName === type);
        if (exactMatch) {
          return textResult({
            found: true,
            source: "dynamic",
            type,
            extension: exactMatch.extension,
            contentFields: exactMatch.contentFields,
            sourceFile: exactMatch.source,
            hint: "Dynamic match — fields parsed from runtime TS. Use read_extension_source for the full picture.",
          });
        }
        const ext = type.includes("::") ? type.split("::")[0] : type;
        const extMatches =
          dyn.objectsByExtension[ext] ?? dyn.objectsByExtension[`${ext}Object`];
        if (extMatches?.length) {
          return textResult({
            found: false,
            source: "dynamic-extension-only",
            type,
            extension: ext,
            knownTypesInExtension: extMatches.map((o) => o.typeName),
            hint: "Exact type not parsed but the extension exists. Read its source for details.",
          });
        }
        return textResult({
          found: false,
          type,
          hint: "Type not in static or dynamic catalog. Use list_extensions then read_extension_source.",
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "list_instructions",
    "List GDevelop instructions (actions, conditions, expressions). Parses Extension.cpp (C++) and JsExtension.js (JS) plus a static curated fallback. Use to discover the type.value to put inside add_event ops. Defaults: 100 results — pass a filter or larger limit to widen.",
    {
      kind: z
        .enum(["action", "condition", "expression", "strExpression"])
        .optional(),
      extension: z
        .string()
        .optional()
        .describe(
          "Filter by extension name (e.g. 'PlatformBehavior', 'BuiltinKeyboard', 'Sprite')",
        ),
      receiverKind: z
        .enum(["extension", "object", "behavior", "unknown"])
        .optional()
        .describe(
          "Filter by what the instruction is attached to. 'extension' = free function; 'object' / 'behavior' = scoped to an object or behavior.",
        ),
      query: z
        .string()
        .optional()
        .describe(
          "Case-insensitive substring filter on type/fullName/description",
        ),
      limit: z.number().int().positive().max(500).optional(),
    },
    async ({ kind, extension, receiverKind, query, limit }) => {
      try {
        const install = findGDevelopInstall();
        const catalog = buildInstructionCatalog(install);
        const matches = findInstructions(catalog, {
          kind,
          extension,
          receiverKind,
          query,
          limit,
        });
        return textResult({
          totalIndexed: catalog.length,
          matched: matches.length,
          instructions: matches,
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "describe_instruction",
    "Find every catalog entry matching an instruction type (e.g. 'SimulateJumpKey'). Returns extensions where this type is defined, kind (action/condition/expression), and source (static / dynamic-cpp / dynamic-js). For raw signature details, follow up with read_extension_source or read_github_source.",
    {
      type: z
        .string()
        .describe("The instruction type, e.g. 'KeyPressed', 'SimulateJumpKey'"),
    },
    async ({ type }) => {
      try {
        const install = findGDevelopInstall();
        const catalog = buildInstructionCatalog(install);
        const matches = findInstructionByType(catalog, type);
        return textResult({
          type,
          found: matches.length > 0,
          matches,
          hint:
            matches.length === 0
              ? "Not in catalog. Try list_instructions with a query, or read_extension_source / read_github_source to inspect the source."
              : undefined,
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
