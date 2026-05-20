import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { validateProjectData } from "../core/validation.js";
import { editProject, EditOpSchema } from "../core/edit.js";
import { summarizeEvents } from "../core/events.js";
import { validateProjectPath } from "../core/path-safety.js";
import { textResult, errorResult } from "./shared.js";

export function registerEditingTools(server: McpServer): void {
  server.tool(
    "validate_project",
    "Load a GDevelop project file (.json) and validate it. Checks: top-level structure (zod), known object/behavior types, instance→object references, firstLayout existence. Returns errors AND warnings separately.",
    {
      path: z
        .string()
        .describe("Absolute path to the GDevelop .json project file"),
    },
    async ({ path }) => {
      try {
        const safePath = validateProjectPath(path);
        const raw = readFileSync(safePath, "utf-8");
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          return textResult({
            valid: false,
            stage: "json-parse",
            error: (err as Error).message,
          });
        }
        const result = validateProjectData(parsed);
        const errors = result.issues.filter((i) => i.severity === "error");
        const warnings = result.issues.filter((i) => i.severity === "warning");
        if (!result.project) {
          return textResult({ valid: false, errors, warnings });
        }
        const project = result.project;
        return textResult({
          valid: result.valid,
          errors,
          warnings,
          summary: {
            name: project.properties.name,
            gdVersion: project.gdVersion,
            firstLayout: project.firstLayout,
            layoutsCount: project.layouts.length,
            globalObjectsCount: project.objects.length,
            resourcesCount: project.resources.resources.length,
            layouts: project.layouts.map((l) => ({
              name: l.name,
              objectsCount: l.objects.length,
              instancesCount: l.instances.length,
              eventsCount: l.events.length,
            })),
          },
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "edit_project",
    `Apply a batch of semantic edits to a GDevelop project atomically.

Each operation is one of:
- {op: "add_layout", name: string, setAsFirst?: bool}
- {op: "add_object", type: string, name: string, scope?: "scene"|"global", scene?: string, content?: object, behaviors?: array, tags?: string}
- {op: "add_instance", scene: string, objectName: string, x: number, y: number, layer?: string, zOrder?: number, angle?: number}
- {op: "attach_behavior", objectName: string, scope?: "scene"|"global", scene?: string, type: string, name?: string, properties?: object}
- {op: "add_event", scene: string, parentPath?: number[], position?: number|"append"|"prepend", event: {...}}
- {op: "remove_event", scene: string, path: number[]}
- {op: "move_event", scene: string, fromPath: number[], toParentPath?: number[], toPosition?: ...}
- {op: "add_extension", name: string, ...}
- {op: "add_events_based_object", extension: string, name: string, ...}
- {op: "add_events_based_behavior", extension: string, name: string, ...}
- {op: "add_extension_function", extension: string, parent?: ..., name: string, functionType: ...}
- {op: "add_extension_property", extension: string, parent: ..., parentName: string, property: ...}

RECOMMENDED FLOW:
1. inspect_project(path) — see the current state
2. edit_project(path, ops, dryRun:true) — preview & validate without touching the file
3. edit_project(path, ops, dryRun:false) — apply with auto backup
4. inspect_project(path) or validate_project(path) — confirm

By default: baseline is validated first (refuses to edit a broken project), a timestamped .bak file is created before writing, and you get a 'summary' of what changed.`,
    {
      path: z
        .string()
        .describe("Absolute path to the GDevelop .json project file"),
      operations: z
        .array(EditOpSchema)
        .min(1)
        .describe("Ordered list of edit operations to apply atomically"),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true, run validation only — do not modify the file."),
      backup: z
        .boolean()
        .optional()
        .describe(
          "If true (default), creates a .bak-<timestamp> file before writing.",
        ),
      requireBaselineValid: z
        .boolean()
        .optional()
        .describe(
          "If true (default), refuses to edit if the project has pre-existing errors. Set to false to override.",
        ),
    },
    async ({ path, operations, dryRun, backup, requireBaselineValid }) => {
      try {
        const safePath = validateProjectPath(path);
        const result = await editProject(safePath, operations, {
          dryRun,
          backup,
          requireBaselineValid,
        });
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "inspect_project",
    "Returns a compact, human-readable summary of a GDevelop project: scenes, objects (with type and attached behaviors), instance counts, events counts, global objects, resources. Use this BEFORE editing to see the current state, and AFTER to verify your changes.",
    {
      path: z
        .string()
        .describe("Absolute path to the GDevelop .json project file"),
    },
    async ({ path }) => {
      try {
        const safePath = validateProjectPath(path);
        const raw = readFileSync(safePath, "utf-8");
        const project = JSON.parse(raw) as {
          properties: {
            name: string;
            version: string;
            windowWidth: number;
            windowHeight: number;
          };
          gdVersion: { major: number; minor: number; build: number };
          firstLayout: string;
          layouts: Array<{
            name: string;
            objects: Array<{
              name: string;
              type: string;
              behaviors?: Array<{ name: string; type: string }>;
            }>;
            instances: unknown[];
            events: unknown[];
            layers: Array<{ name: string }>;
          }>;
          objects: Array<{ name: string; type: string }>;
          resources: { resources: Array<{ name?: string }> };
          eventsFunctionsExtensions: unknown[];
        };
        return textResult({
          name: project.properties.name,
          version: project.properties.version,
          resolution: `${project.properties.windowWidth}x${project.properties.windowHeight}`,
          gdVersion: `${project.gdVersion.major}.${project.gdVersion.minor}.${project.gdVersion.build}`,
          firstLayout: project.firstLayout,
          scenes: project.layouts.map((l) => ({
            name: l.name,
            objects: l.objects.map((o) => ({
              name: o.name,
              type: o.type,
              behaviors: (o.behaviors ?? []).map(
                (b) => `${b.name} (${b.type})`,
              ),
            })),
            instances: l.instances.length,
            events: l.events.length,
            layers: l.layers.map((la) => la.name || "<base>"),
          })),
          globalObjects: project.objects.map((o) => ({
            name: o.name,
            type: o.type,
          })),
          resources: project.resources.resources.length,
          customExtensions: project.eventsFunctionsExtensions.length,
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "summarize_events",
    "Summarize the events tree of a scene: total count, per-type breakdown, max nesting depth. Useful to inspect a scene's logic without dumping the full events JSON.",
    {
      projectPath: z.string(),
      scene: z
        .string()
        .optional()
        .describe("Scene name. If omitted, uses firstLayout."),
    },
    async ({ projectPath, scene }) => {
      try {
        const safePath = validateProjectPath(projectPath);
        const raw = readFileSync(safePath, "utf-8");
        const project = JSON.parse(raw) as {
          firstLayout: string;
          layouts: Array<{ name: string; events: unknown[] }>;
        };
        const sceneName = scene ?? project.firstLayout;
        const layout = project.layouts.find((l) => l.name === sceneName);
        if (!layout) {
          return errorResult(
            `Scene "${sceneName}" not found. Available: ${project.layouts
              .map((l) => l.name)
              .join(", ")}`,
          );
        }
        const summary = summarizeEvents(layout.events ?? []);
        return textResult({ scene: sceneName, ...summary });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
