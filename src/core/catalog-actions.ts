import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GDevelopInstall } from "./install.js";
import {
  parseExtensionSource,
  type ParamSpec,
  type ParsedInstruction,
} from "./catalog-parsers.js";

// ============================================================================
// INSTRUCTION CATALOG — built entirely from GitHub-synced sources.
// ============================================================================

export type ReceiverKind = "extension" | "object" | "behavior" | "unknown";

export type InstructionSpec = {
  type: string;
  fullName: string;
  description: string;
  kind: "action" | "condition" | "expression" | "strExpression";
  extension: string;
  source: "dynamic-js" | "dynamic-cpp";
  /** Raw identifier preceding `.AddXxx` in the source (e.g. "extension", "obj", "aut"). */
  receiver?: string;
  /** Normalized receiver — "extension" | "object" | "behavior" | "unknown". */
  receiverKind: ReceiverKind;
  parameters: ParamSpec[];
};

export type { ParamSpec };

const RECEIVER_KIND_BY_TOKEN: Record<string, ReceiverKind> = {
  extension: "extension",
  obj: "object",
  object: "object",
  objectMetadata: "object",
  aut: "behavior",
  behavior: "behavior",
  behaviorMetadata: "behavior",
};

function classifyReceiver(token: string | undefined): ReceiverKind {
  if (!token) return "unknown";
  const known = RECEIVER_KIND_BY_TOKEN[token];
  if (known) return known;
  if (/Object$/.test(token) || /Obj$/.test(token)) return "object";
  if (/Behavior$/.test(token) || /^aut/.test(token)) return "behavior";
  return "unknown";
}

function readSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

let cached: InstructionSpec[] | null = null;

function toSpec(
  parsed: ParsedInstruction,
  extension: string,
  source: InstructionSpec["source"],
): InstructionSpec {
  return {
    type: parsed.type,
    fullName: parsed.fullName ?? parsed.type,
    description: parsed.description ?? "",
    kind: parsed.kind,
    extension,
    source,
    receiver: parsed.receiver,
    receiverKind: classifyReceiver(parsed.receiver),
    parameters: parsed.parameters,
  };
}

function ingest(
  all: InstructionSpec[],
  src: string,
  extension: string,
  language: "cpp" | "js",
): void {
  const parsed = parseExtensionSource(src, { language });
  const source: InstructionSpec["source"] =
    language === "js" ? "dynamic-js" : "dynamic-cpp";
  for (const p of parsed) all.push(toSpec(p, extension, source));
}

function walkCppExtensionFiles(extDir: string): string[] {
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
  const all: InstructionSpec[] = [];

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
    const jsExtensionPath = join(extDir, "JsExtension.js");
    if (existsSync(jsExtensionPath)) {
      const src = readSafe(jsExtensionPath);
      if (src) ingest(all, src, ext, "js");
    }
    for (const cppPath of walkCppExtensionFiles(extDir)) {
      const src = readSafe(cppPath);
      if (src) ingest(all, src, ext, "cpp");
    }
  }

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

  cached = dedupeInstructions(all);
  return cached;
}

/**
 * Same (type, kind, extension) entries can be produced more than once
 * when sibling .cpp files share declarations. Keep the richest.
 */
function dedupeInstructions(items: InstructionSpec[]): InstructionSpec[] {
  const bestByKey = new Map<string, InstructionSpec>();
  for (const item of items) {
    const key = `${item.kind}::${item.type}::${item.extension}`;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, item);
      continue;
    }
    const existingRichness =
      (existing.fullName === existing.type ? 0 : 1) +
      (existing.description ? 1 : 0) +
      existing.parameters.length;
    const candidateRichness =
      (item.fullName === item.type ? 0 : 1) +
      (item.description ? 1 : 0) +
      item.parameters.length;
    if (candidateRichness > existingRichness) {
      bestByKey.set(key, item);
    }
  }
  return [...bestByKey.values()];
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
      const extName = entry.name.replace(/Extension$/, "");
      let subFiles;
      try {
        subFiles = readdirSync(full).filter((f) => /\.cpp$/.test(f));
      } catch {
        continue;
      }
      for (const f of subFiles) {
        const src = readSafe(join(full, f));
        if (src) ingest(all, src, extName, "cpp");
      }
    } else if (entry.isFile() && /Extension\.cpp$/.test(entry.name)) {
      const extName = entry.name.replace(/Extension\.cpp$/, "");
      const src = readSafe(full);
      if (src) ingest(all, src, extName, "cpp");
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
    receiverKind?: ReceiverKind;
    query?: string;
    limit?: number;
  } = {},
): InstructionSpec[] {
  const { kind, extension, receiverKind, query, limit = 100 } = opts;
  const q = query?.toLowerCase().trim();
  const out: InstructionSpec[] = [];
  for (const inst of catalog) {
    if (kind && inst.kind !== kind) continue;
    if (extension && inst.extension !== extension) continue;
    if (receiverKind && inst.receiverKind !== receiverKind) continue;
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
