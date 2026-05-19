import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GDevelopInstall } from "./install.js";

// ============================================================================
// STATIC CATALOG — the most common built-in instructions
// These come from C++ extensions (Sprite, BuiltinObject, etc.) and aren't
// parseable from the JS extension files. Hand-curated from the GDevelop docs.
// ============================================================================

export type InstructionSpec = {
  type: string;
  fullName: string;
  description: string;
  kind: "action" | "condition" | "expression" | "strExpression";
  extension: string;
  source: "static" | "dynamic";
};

const STATIC_INSTRUCTIONS: InstructionSpec[] = [
  // Keyboard
  {
    type: "KeyPressed",
    fullName: "Key pressed",
    description: "Check if a key is currently pressed.",
    kind: "condition",
    extension: "BuiltinKeyboard",
    source: "static",
  },
  {
    type: "KeyReleased",
    fullName: "Key released",
    description: "Check if a key was just released.",
    kind: "condition",
    extension: "BuiltinKeyboard",
    source: "static",
  },
  {
    type: "KeyFromTextPressed",
    fullName: "Key pressed (text)",
    description: "Check if a key (text identifier) is pressed.",
    kind: "condition",
    extension: "BuiltinKeyboard",
    source: "static",
  },
  // Mouse / Touch
  {
    type: "SourisBouton",
    fullName: "Mouse button pressed",
    description: "Check if a mouse button is pressed.",
    kind: "condition",
    extension: "BuiltinMouse",
    source: "static",
  },
  {
    type: "MouseButtonReleased",
    fullName: "Mouse button released",
    description: "Check if a mouse button is released.",
    kind: "condition",
    extension: "BuiltinMouse",
    source: "static",
  },
  // Object position
  {
    type: "MettreX",
    fullName: "Set X position",
    description: "Set the X position of an object.",
    kind: "action",
    extension: "BuiltinObject",
    source: "static",
  },
  {
    type: "MettreY",
    fullName: "Set Y position",
    description: "Set the Y position of an object.",
    kind: "action",
    extension: "BuiltinObject",
    source: "static",
  },
  {
    type: "MettreXY",
    fullName: "Set position",
    description: "Set both X and Y of an object.",
    kind: "action",
    extension: "BuiltinObject",
    source: "static",
  },
  {
    type: "PositionX",
    fullName: "X position",
    description: "Compare or read the X position of an object.",
    kind: "condition",
    extension: "BuiltinObject",
    source: "static",
  },
  {
    type: "PositionY",
    fullName: "Y position",
    description: "Compare or read the Y position of an object.",
    kind: "condition",
    extension: "BuiltinObject",
    source: "static",
  },
  // Object lifecycle
  {
    type: "Create",
    fullName: "Create an object",
    description: "Create an instance of an object on a scene.",
    kind: "action",
    extension: "BuiltinObject",
    source: "static",
  },
  {
    type: "Delete",
    fullName: "Delete an object",
    description: "Delete (destroy) an object instance.",
    kind: "action",
    extension: "BuiltinObject",
    source: "static",
  },
  // Variables
  {
    type: "ModVarScene",
    fullName: "Modify scene variable",
    description: "Modify a number scene variable.",
    kind: "action",
    extension: "BuiltinVariables",
    source: "static",
  },
  {
    type: "VarScene",
    fullName: "Scene variable value",
    description: "Compare the value of a scene variable.",
    kind: "condition",
    extension: "BuiltinVariables",
    source: "static",
  },
  {
    type: "ModVarGlobal",
    fullName: "Modify global variable",
    description: "Modify a number global variable.",
    kind: "action",
    extension: "BuiltinVariables",
    source: "static",
  },
  // Scene control
  {
    type: "Scene",
    fullName: "Change scene",
    description: "Switch to another scene.",
    kind: "action",
    extension: "BuiltinScene",
    source: "static",
  },
  {
    type: "Quit",
    fullName: "Quit the game",
    description: "Quit the game (or close the preview).",
    kind: "action",
    extension: "BuiltinScene",
    source: "static",
  },
  // Sprite
  {
    type: "ChangeAnimation",
    fullName: "Change animation (sprite)",
    description: "Change the animation of a Sprite by index.",
    kind: "action",
    extension: "Sprite",
    source: "static",
  },
  {
    type: "ChangeAnimationName",
    fullName: "Change animation by name (sprite)",
    description: "Change the animation of a Sprite using its name.",
    kind: "action",
    extension: "Sprite",
    source: "static",
  },
  // Platformer behavior
  {
    type: "SimulateJumpKey",
    fullName: "Simulate jump key (Platformer)",
    description: "Simulate pressing the jump key for a Platformer character.",
    kind: "action",
    extension: "PlatformBehavior",
    source: "static",
  },
  {
    type: "SimulateLeftKey",
    fullName: "Simulate left key (Platformer)",
    description: "Simulate pressing the left key.",
    kind: "action",
    extension: "PlatformBehavior",
    source: "static",
  },
  {
    type: "SimulateRightKey",
    fullName: "Simulate right key (Platformer)",
    description: "Simulate pressing the right key.",
    kind: "action",
    extension: "PlatformBehavior",
    source: "static",
  },
  {
    type: "IsOnFloor",
    fullName: "Is on floor (Platformer)",
    description: "Check if a Platformer character is on a floor.",
    kind: "condition",
    extension: "PlatformBehavior",
    source: "static",
  },
  // Collision
  {
    type: "CollisionNP",
    fullName: "Collision",
    description: "Detect collision between two objects.",
    kind: "condition",
    extension: "BuiltinObject",
    source: "static",
  },
];

// ============================================================================
// DYNAMIC PARSING — from JsExtension.js files in the local GDJS install
// ============================================================================

const ADD_ACTION_RE = /\.addAction\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;
const ADD_CONDITION_RE = /\.addCondition\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;
const ADD_EXPRESSION_RE = /\.addExpression\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;
const ADD_STR_EXPRESSION_RE =
  /\.addStrExpression\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;

function readSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function extractMatches(src: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(re)) out.push(m[1]);
  return out;
}

let cached: InstructionSpec[] | null = null;

export function buildInstructionCatalog(
  install: GDevelopInstall,
): InstructionSpec[] {
  if (cached) return cached;
  const all: InstructionSpec[] = [...STATIC_INSTRUCTIONS];

  let extensionDirs: string[];
  try {
    extensionDirs = readdirSync(install.extensionsPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    cached = all;
    return all;
  }

  for (const ext of extensionDirs) {
    const jsExtensionPath = join(install.extensionsPath, ext, "JsExtension.js");
    if (!existsSync(jsExtensionPath)) continue;
    const src = readSafe(jsExtensionPath);
    if (!src) continue;
    for (const name of extractMatches(src, ADD_ACTION_RE)) {
      all.push({
        type: name,
        fullName: name,
        description: "(parsed from JsExtension.js)",
        kind: "action",
        extension: ext,
        source: "dynamic",
      });
    }
    for (const name of extractMatches(src, ADD_CONDITION_RE)) {
      all.push({
        type: name,
        fullName: name,
        description: "(parsed from JsExtension.js)",
        kind: "condition",
        extension: ext,
        source: "dynamic",
      });
    }
    for (const name of extractMatches(src, ADD_EXPRESSION_RE)) {
      all.push({
        type: name,
        fullName: name,
        description: "(parsed from JsExtension.js)",
        kind: "expression",
        extension: ext,
        source: "dynamic",
      });
    }
    for (const name of extractMatches(src, ADD_STR_EXPRESSION_RE)) {
      all.push({
        type: name,
        fullName: name,
        description: "(parsed from JsExtension.js)",
        kind: "strExpression",
        extension: ext,
        source: "dynamic",
      });
    }
  }

  cached = all;
  return cached;
}

export function resetInstructionCatalogCache(): void {
  cached = null;
}

export function findInstructions(
  catalog: InstructionSpec[],
  opts: {
    kind?: "action" | "condition" | "expression" | "strExpression";
    extension?: string;
    query?: string;
    limit?: number;
  } = {},
): InstructionSpec[] {
  const { kind, extension, query, limit = 100 } = opts;
  const q = query?.toLowerCase().trim();
  const out: InstructionSpec[] = [];
  for (const inst of catalog) {
    if (kind && inst.kind !== kind) continue;
    if (extension && inst.extension !== extension) continue;
    if (q) {
      const haystack =
        `${inst.type} ${inst.fullName} ${inst.description} ${inst.extension}`.toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    out.push(inst);
    if (out.length >= limit) break;
  }
  return out;
}

export function findInstructionByType(
  catalog: InstructionSpec[],
  type: string,
): InstructionSpec[] {
  return catalog.filter((i) => i.type === type);
}
