import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GDevelopInstall } from "./install.js";

function readSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

// ============================================================================
// EVENT TYPES — parsed from Core/GDCore/Events/Builtin/*.cpp
// ============================================================================

export type EventTypeInfo = {
  type: string;
  className: string;
  canHaveSubEvents: boolean;
  sourceFile: string;
};

const EVENT_CLASS_RE =
  /class\s+GD_CORE_API\s+([A-Za-z0-9_]+)\s*:\s*(?:public|protected|private)?\s*BaseEvent/g;

export function listEventTypes(install: GDevelopInstall): EventTypeInfo[] {
  const dir = join(
    install.resourcesPath,
    "Core",
    "GDCore",
    "Events",
    "Builtin",
  );
  if (!existsSync(dir)) return [];
  const out: EventTypeInfo[] = [];
  try {
    const files = readdirSync(dir).filter((f) =>
      /Event\.h$|Event\.cpp$/.test(f),
    );
    const seen = new Set<string>();
    for (const f of files) {
      const src = readSafe(join(dir, f));
      if (!src) continue;
      for (const m of src.matchAll(EVENT_CLASS_RE)) {
        const className = m[1];
        if (seen.has(className)) continue;
        seen.add(className);
        const canHaveSubEvents = /CanHaveSubEvents|GetSubEvents/.test(src);
        // Best-effort: derive the BuiltinCommonInstructions::X type from the class name
        const stripped = className.replace(/Event$/, "");
        out.push({
          type: `BuiltinCommonInstructions::${stripped}`,
          className,
          canHaveSubEvents,
          sourceFile: f,
        });
      }
    }
  } catch {
    // ignore
  }
  return out;
}

// ============================================================================
// RESOURCE TYPES — parsed from Core/GDCore/Project/*Resource.h + Resource.cpp
// ============================================================================

export type ResourceTypeInfo = {
  type: string;
  className: string;
  kind: string;
  sourceFile: string;
};

const RESOURCE_CLASS_RE =
  /class\s+GD_CORE_API\s+([A-Za-z0-9_]+Resource)\s*:\s*(?:public|protected|private)?\s*(?:Resource|[A-Za-z0-9_]+Resource)\b/g;

export function listResourceTypes(
  install: GDevelopInstall,
): ResourceTypeInfo[] {
  const dir = join(install.resourcesPath, "Core", "GDCore", "Project");
  if (!existsSync(dir)) return [];
  const out: ResourceTypeInfo[] = [];
  try {
    const files = readdirSync(dir).filter((f) =>
      /Resource.*\.h$|^Resource\.cpp$/.test(f),
    );
    const seen = new Set<string>();
    for (const f of files) {
      const src = readSafe(join(dir, f));
      if (!src) continue;
      for (const m of src.matchAll(RESOURCE_CLASS_RE)) {
        const className = m[1];
        if (seen.has(className) || className === "Resource") continue;
        seen.add(className);
        const kind = className.replace(/Resource$/, "").toLowerCase();
        out.push({
          type: className,
          className,
          kind,
          sourceFile: f,
        });
      }
    }
  } catch {
    // ignore
  }
  return out;
}

// ============================================================================
// VARIABLE TYPES — parsed from Core/GDCore/Project/Variable.h enum Type
// ============================================================================

export type VariableTypeInfo = {
  name: string;
  description: string;
};

export function listVariableTypes(
  install: GDevelopInstall,
): VariableTypeInfo[] {
  const headerPath = join(
    install.resourcesPath,
    "Core",
    "GDCore",
    "Project",
    "Variable.h",
  );
  const src = readSafe(headerPath);
  if (!src) {
    // fallback: known primitives
    return [
      { name: "Number", description: "Numeric value" },
      { name: "String", description: "Text value" },
      { name: "Boolean", description: "True/false value" },
      { name: "Structure", description: "Key/value record of variables" },
      { name: "Array", description: "Ordered list of variables" },
    ];
  }
  // Look for `enum Type { ... }` or `enum class Type { ... }`
  const enumMatch = src.match(/enum(?:\s+class)?\s+Type\s*\{([^}]+)\}/);
  if (!enumMatch) {
    return [
      { name: "Number", description: "Numeric value" },
      { name: "String", description: "Text value" },
      { name: "Boolean", description: "True/false value" },
      { name: "Structure", description: "Key/value record of variables" },
      { name: "Array", description: "Ordered list of variables" },
    ];
  }
  const body = enumMatch[1];
  const items = body
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(/\s|=/)[0])
    .filter((s) => /^[A-Z][A-Za-z0-9_]*$/.test(s));
  return items.map((name) => ({ name, description: "" }));
}
