import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GDevelopInstall } from "./install.js";
import {
  buildInstructionCatalog,
  findInstructions,
} from "./catalog-actions.js";

export type DescribeExtensionOptions = {
  /**
   * Restrict the listings included in the response. When set, only the
   * specified kinds are returned (others are still counted). Useful to
   * reduce token cost when the caller only needs e.g. actions.
   */
  include?: Array<"actions" | "conditions" | "expressions" | "strExpressions">;
  /**
   * If true, omit all instruction listings — just counts + paths + files.
   * Cheapest call for a quick orientation.
   */
  summaryOnly?: boolean;
};

export type ExtensionDescription = {
  name: string;
  found: boolean;
  paths: {
    extensionDir: string | null;
    extensionCpp: string | null;
    jsExtension: string | null;
    readme: string | null;
  };
  files: string[];
  counts: {
    actions: number;
    conditions: number;
    expressions: number;
    strExpressions: number;
    runtimeObjects: number;
    runtimeBehaviors: number;
  };
  actions?: Array<{ type: string; fullName: string; description: string }>;
  conditions?: Array<{ type: string; fullName: string; description: string }>;
  expressions?: Array<{ type: string; fullName: string; description: string }>;
  strExpressions?: Array<{
    type: string;
    fullName: string;
    description: string;
  }>;
  runtimeObjects: string[];
  runtimeBehaviors: string[];
  readmeExcerpt: string | null;
};

const MAX_README_BYTES = 2000;

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function safeStatFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

export function describeExtension(
  install: GDevelopInstall,
  name: string,
  options: DescribeExtensionOptions = {},
): ExtensionDescription {
  const includeAll = !options.summaryOnly;
  const includes = options.include
    ? new Set(options.include)
    : new Set<string>([
        "actions",
        "conditions",
        "expressions",
        "strExpressions",
      ]);
  function maybe<T>(
    kind: "actions" | "conditions" | "expressions" | "strExpressions",
    value: T,
  ): T | undefined {
    if (!includeAll) return undefined;
    if (options.include && !includes.has(kind)) return undefined;
    return value;
  }

  const extDir = join(install.extensionsPath, name);
  const found = existsSync(extDir) && statSync(extDir).isDirectory();

  const extensionCpp = (() => {
    const p = join(extDir, "Extension.cpp");
    return found && safeStatFile(p) ? p : null;
  })();
  const jsExtension = (() => {
    const p = join(extDir, "JsExtension.js");
    return found && safeStatFile(p) ? p : null;
  })();
  const readmeCandidates = ["README.md", "Readme.md", "readme.md"];
  const readme = found
    ? (readmeCandidates
        .map((r) => join(extDir, r))
        .find((p) => safeStatFile(p)) ?? null)
    : null;

  const allFiles = found
    ? safeReadDir(extDir).filter((f) => safeStatFile(join(extDir, f)))
    : [];

  const runtimeObjects = allFiles.filter((f) =>
    /runtimeobject\.(ts|js)$/i.test(f),
  );
  const runtimeBehaviors = allFiles.filter((f) =>
    /runtimebehavior\.(ts|js)$/i.test(f),
  );

  const catalog = buildInstructionCatalog(install);
  const extInstructions = findInstructions(catalog, {
    extension: name,
    limit: 9999,
  });

  const byKind = {
    action: extInstructions.filter((i) => i.kind === "action"),
    condition: extInstructions.filter((i) => i.kind === "condition"),
    expression: extInstructions.filter((i) => i.kind === "expression"),
    strExpression: extInstructions.filter((i) => i.kind === "strExpression"),
  };

  const projection = (
    arr: typeof extInstructions,
  ): Array<{ type: string; fullName: string; description: string }> =>
    arr.map((i) => ({
      type: i.type,
      fullName: i.fullName,
      description: i.description,
    }));

  let readmeExcerpt: string | null = null;
  if (readme) {
    try {
      const raw = readFileSync(readme, "utf-8");
      readmeExcerpt =
        raw.length > MAX_README_BYTES
          ? raw.slice(0, MAX_README_BYTES) + "\n…(truncated)"
          : raw;
    } catch {
      // ignore
    }
  }

  return {
    name,
    found,
    paths: {
      extensionDir: found ? extDir : null,
      extensionCpp,
      jsExtension,
      readme,
    },
    files: allFiles,
    counts: {
      actions: byKind.action.length,
      conditions: byKind.condition.length,
      expressions: byKind.expression.length,
      strExpressions: byKind.strExpression.length,
      runtimeObjects: runtimeObjects.length,
      runtimeBehaviors: runtimeBehaviors.length,
    },
    actions: maybe("actions", projection(byKind.action)),
    conditions: maybe("conditions", projection(byKind.condition)),
    expressions: maybe("expressions", projection(byKind.expression)),
    strExpressions: maybe("strExpressions", projection(byKind.strExpression)),
    runtimeObjects,
    runtimeBehaviors,
    readmeExcerpt,
  };
}
