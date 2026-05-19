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
  source: "static" | "dynamic-js" | "dynamic-cpp";
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
// DYNAMIC PARSING — JsExtension.js (JS extensions) + Extension.cpp (C++)
// ============================================================================

// JS pattern: extension.addAction("Name", ...)
const JS_ADD_ACTION_RE =
  /\.addAction\s*\(\s*['"]([A-Za-z0-9_]+)['"](?:\s*,\s*['"]([^'"]*)['"])?(?:\s*,\s*['"]([^'"]*)['"])?/g;
const JS_ADD_CONDITION_RE =
  /\.addCondition\s*\(\s*['"]([A-Za-z0-9_]+)['"](?:\s*,\s*['"]([^'"]*)['"])?(?:\s*,\s*['"]([^'"]*)['"])?/g;
const JS_ADD_EXPRESSION_RE =
  /\.addExpression\s*\(\s*['"]([A-Za-z0-9_]+)['"](?:\s*,\s*['"]([^'"]*)['"])?(?:\s*,\s*['"]([^'"]*)['"])?/g;
const JS_ADD_STR_EXPRESSION_RE =
  /\.addStrExpression\s*\(\s*['"]([A-Za-z0-9_]+)['"](?:\s*,\s*['"]([^'"]*)['"])?(?:\s*,\s*['"]([^'"]*)['"])?/g;

// C++ pattern: extension.AddAction("Name", _("Full"), _("Desc"), _("Sentence"), _("Group"), "icon", "smallicon")
// Captures name (always plain string), fullName and description (i18n-wrapped, optional)
const CPP_ADD_ACTION_RE =
  /\.AddAction\s*\(\s*"([A-Za-z0-9_]+)"(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?/g;
const CPP_ADD_CONDITION_RE =
  /\.AddCondition\s*\(\s*"([A-Za-z0-9_]+)"(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?/g;
const CPP_ADD_EXPRESSION_RE =
  /\.AddExpression\s*\(\s*"([A-Za-z0-9_]+)"(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?/g;
const CPP_ADD_STR_EXPRESSION_RE =
  /\.AddStrExpression\s*\(\s*"([A-Za-z0-9_]+)"(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?/g;

// Some C++ files use AddExpressionAndCondition / AddDuplicatedAction / etc.
// Capture commonly-named variants as actions/conditions by name.
const CPP_ADD_EXPR_AND_COND_RE =
  /\.AddExpressionAndCondition(?:For[A-Za-z]+)?\s*\(\s*"([A-Za-z0-9_]+)"\s*,\s*"([A-Za-z0-9_]+)"(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?/g;
const CPP_ADD_SCOPED_BEHAVIOR_RE =
  /\.AddScopedAction\s*\(\s*"([A-Za-z0-9_]+)"(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?(?:\s*,\s*_\(\s*"([^"]*)"\s*\))?/g;

function readSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

type Match = { name: string; fullName?: string; description?: string };

function extractTriplets(src: string, re: RegExp): Match[] {
  const out: Match[] = [];
  for (const m of src.matchAll(re)) {
    out.push({
      name: m[1],
      fullName: m[2] || undefined,
      description: m[3] || undefined,
    });
  }
  return out;
}

let cached: InstructionSpec[] | null = null;

function pushAll(
  all: InstructionSpec[],
  matches: Match[],
  kind: InstructionSpec["kind"],
  extension: string,
  source: InstructionSpec["source"],
): void {
  for (const m of matches) {
    all.push({
      type: m.name,
      fullName: m.fullName ?? m.name,
      description: m.description ?? "",
      kind,
      extension,
      source,
    });
  }
}

function parseJsExtension(
  all: InstructionSpec[],
  extension: string,
  src: string,
): void {
  pushAll(
    all,
    extractTriplets(src, JS_ADD_ACTION_RE),
    "action",
    extension,
    "dynamic-js",
  );
  pushAll(
    all,
    extractTriplets(src, JS_ADD_CONDITION_RE),
    "condition",
    extension,
    "dynamic-js",
  );
  pushAll(
    all,
    extractTriplets(src, JS_ADD_EXPRESSION_RE),
    "expression",
    extension,
    "dynamic-js",
  );
  pushAll(
    all,
    extractTriplets(src, JS_ADD_STR_EXPRESSION_RE),
    "strExpression",
    extension,
    "dynamic-js",
  );
}

function parseCppExtension(
  all: InstructionSpec[],
  extension: string,
  src: string,
): void {
  pushAll(
    all,
    extractTriplets(src, CPP_ADD_ACTION_RE),
    "action",
    extension,
    "dynamic-cpp",
  );
  pushAll(
    all,
    extractTriplets(src, CPP_ADD_CONDITION_RE),
    "condition",
    extension,
    "dynamic-cpp",
  );
  pushAll(
    all,
    extractTriplets(src, CPP_ADD_EXPRESSION_RE),
    "expression",
    extension,
    "dynamic-cpp",
  );
  pushAll(
    all,
    extractTriplets(src, CPP_ADD_STR_EXPRESSION_RE),
    "strExpression",
    extension,
    "dynamic-cpp",
  );
  // AddExpressionAndCondition: register as both kinds
  for (const m of src.matchAll(CPP_ADD_EXPR_AND_COND_RE)) {
    const name = m[2] || m[1];
    const desc = m[3] || "";
    all.push({
      type: name,
      fullName: name,
      description: desc,
      kind: "expression",
      extension,
      source: "dynamic-cpp",
    });
    all.push({
      type: name,
      fullName: name,
      description: desc,
      kind: "condition",
      extension,
      source: "dynamic-cpp",
    });
  }
  pushAll(
    all,
    extractTriplets(src, CPP_ADD_SCOPED_BEHAVIOR_RE),
    "action",
    extension,
    "dynamic-cpp",
  );
}

function walkCppExtensionFiles(extDir: string): string[] {
  // Look for Extension.cpp + AllBuiltin*.cpp + <Name>Extension.cpp variants
  try {
    return readdirSync(extDir)
      .filter((f) => /\.cpp$/.test(f))
      .map((f) => join(extDir, f));
  } catch {
    return [];
  }
}

export function buildInstructionCatalog(
  install: GDevelopInstall,
): InstructionSpec[] {
  if (cached) return cached;
  const all: InstructionSpec[] = [...STATIC_INSTRUCTIONS];

  // 1. Extensions/<Name>/JsExtension.js and Extensions/<Name>/Extension.cpp
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
    const extDir = join(install.extensionsPath, ext);
    // JS extensions
    const jsExtensionPath = join(extDir, "JsExtension.js");
    if (existsSync(jsExtensionPath)) {
      const src = readSafe(jsExtensionPath);
      if (src) parseJsExtension(all, ext, src);
    }
    // C++ extensions (Extension.cpp + sibling .cpp files in same dir)
    for (const cppPath of walkCppExtensionFiles(extDir)) {
      const src = readSafe(cppPath);
      if (src) parseCppExtension(all, ext, src);
    }
  }

  // 2. Core/GDCore/Extensions/Builtin/*.cpp — built-in C++ extensions
  // Walks both flat files (e.g. AudioExtension.cpp) AND subdirectories
  // (e.g. SpriteExtension/SpriteExtension.cpp, SpriteExtension/SpriteObject.cpp).
  const coreBuiltinPath = join(
    install.resourcesPath,
    "Core",
    "GDCore",
    "Extensions",
    "Builtin",
  );
  if (existsSync(coreBuiltinPath)) {
    parseCoreBuiltinDir(all, coreBuiltinPath);
  }

  cached = all;
  return cached;
}

function parseCoreBuiltinDir(all: InstructionSpec[], dir: string): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // e.g. SpriteExtension/<files>. The extension name is the dir name
      // minus the trailing "Extension".
      const extName = entry.name.replace(/Extension$/, "");
      let subFiles;
      try {
        subFiles = readdirSync(full).filter((f) => /\.cpp$/.test(f));
      } catch {
        continue;
      }
      for (const f of subFiles) {
        const src = readSafe(join(full, f));
        if (src) parseCppExtension(all, extName, src);
      }
    } else if (entry.isFile() && /Extension\.cpp$/.test(entry.name)) {
      const extName = entry.name.replace(/Extension\.cpp$/, "");
      const src = readSafe(full);
      if (src) parseCppExtension(all, extName, src);
    }
  }
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
