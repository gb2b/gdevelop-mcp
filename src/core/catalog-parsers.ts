/**
 * Extension source parser — C++ and JS.
 *
 * Walks an Extension.cpp or JsExtension.js file and emits structured
 * instruction specs, including:
 *   - kind (action / condition / expression / strExpression)
 *   - receiver token (the identifier before `.AddXxx` — e.g. "extension",
 *     "obj", "behavior"); useful to know whether an instruction is
 *     attached to an object/behavior or to the extension itself
 *   - parameters from chained `.AddParameter(...)` calls
 *
 * The parser is regex-and-bracket-matching, not a real C++/JS parser.
 * That is enough for GDevelop's hand-written extension builder syntax,
 * which is highly regular (always chained method calls on a builder).
 */

export type ParamSpec = {
  type: string;
  description?: string;
  extraInfo?: string;
  optional?: boolean;
};

export type ParsedInstruction = {
  type: string;
  fullName?: string;
  description?: string;
  kind: "action" | "condition" | "expression" | "strExpression";
  receiver?: string;
  parameters: ParamSpec[];
};

const INSTR_METHODS = new Map<string, ParsedInstruction["kind"]>([
  ["AddAction", "action"],
  ["AddScopedAction", "action"],
  ["addAction", "action"],
  ["addScopedAction", "action"],
  ["AddCondition", "condition"],
  ["AddScopedCondition", "condition"],
  ["addCondition", "condition"],
  ["addScopedCondition", "condition"],
  ["AddExpression", "expression"],
  ["addExpression", "expression"],
  ["AddStrExpression", "strExpression"],
  ["addStrExpression", "strExpression"],
]);

const DUAL_EXPR_COND_PREFIX = "AddExpressionAndCondition";
const DUAL_EXPR_COND_PREFIX_JS = "addExpressionAndCondition";
const PARAM_METHODS = new Set([
  "AddParameter",
  "addParameter",
  "AddCodeOnlyParameter",
  "addCodeOnlyParameter",
]);

const METHOD_CALL_RE = /\.([A-Za-z][A-Za-z0-9_]*)\s*\(/g;

function findMatchingParen(src: string, openPos: number): number {
  let depth = 0;
  let i = openPos;
  let inStr: '"' | "'" | null = null;
  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
    } else if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl < 0 ? src.length : nl;
    } else if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 1;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function splitTopLevelArgs(
  src: string,
  startInside: number,
  endExclusive: number,
): string[] {
  const args: string[] = [];
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  let buf = "";
  for (let i = startInside; i < endExclusive; i++) {
    const ch = src[i];
    if (inStr) {
      buf += ch;
      if (ch === "\\") {
        buf += src[++i] ?? "";
        continue;
      }
      if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
      buf += ch;
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      buf += ch;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      buf += ch;
    } else if (ch === "," && depth === 0) {
      args.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) args.push(buf.trim());
  return args;
}

function extractString(arg: string | undefined): string | undefined {
  if (!arg) return undefined;
  const trimmed = arg.trim();
  const dq = /^"((?:[^"\\]|\\.)*)"$/.exec(trimmed);
  if (dq) return dq[1];
  const sq = /^'((?:[^'\\]|\\.)*)'$/.exec(trimmed);
  if (sq) return sq[1];
  const i18n = /^_\(\s*"((?:[^"\\]|\\.)*)"\s*\)$/.exec(trimmed);
  if (i18n) return i18n[1];
  const tl = /^`([^`$]*)`$/.exec(trimmed);
  if (tl) return tl[1];
  return undefined;
}

function receiverBefore(src: string, dotPos: number): string | undefined {
  let i = dotPos - 1;
  while (i >= 0 && /\s/.test(src[i])) i--;
  const end = i + 1;
  while (i >= 0 && /[A-Za-z0-9_]/.test(src[i])) i--;
  const start = i + 1;
  if (start === end) return undefined;
  const token = src.slice(start, end);
  if (/^[0-9]/.test(token)) return undefined;
  return token;
}

function pushIfNew(out: ParsedInstruction[], inst: ParsedInstruction | null) {
  if (inst && inst.type) out.push(inst);
}

function makeParam(args: string[]): ParamSpec | null {
  const type = extractString(args[0]);
  if (!type) return null;
  return {
    type,
    description: extractString(args[1]),
    extraInfo: extractString(args[2]),
    optional: args[3]?.trim() === "true",
  };
}

type MatchInfo = { index: number; methodName: string; closePos: number };

function collectMethodCalls(src: string): MatchInfo[] {
  const out: MatchInfo[] = [];
  for (const m of src.matchAll(METHOD_CALL_RE)) {
    const openPos = (m.index ?? 0) + m[0].length - 1;
    const closePos = findMatchingParen(src, openPos);
    if (closePos < 0) continue;
    out.push({ index: m.index ?? 0, methodName: m[1], closePos });
  }
  return out;
}

export function parseExtensionSource(
  src: string,
  opts: { language: "cpp" | "js" },
): ParsedInstruction[] {
  void opts;
  const out: ParsedInstruction[] = [];
  let current: ParsedInstruction | null = null;
  let mirror: ParsedInstruction | null = null;

  for (const call of collectMethodCalls(src)) {
    const { index, methodName, closePos } = call;
    const openPos = src.indexOf("(", index);
    const args = splitTopLevelArgs(src, openPos + 1, closePos);

    const kind = INSTR_METHODS.get(methodName);
    if (kind) {
      pushIfNew(out, current);
      pushIfNew(out, mirror);
      mirror = null;
      const name = extractString(args[0]) ?? "";
      const fullName = extractString(args[1]);
      const description = extractString(args[2]);
      const receiver = receiverBefore(src, index);
      current = {
        type: name,
        fullName,
        description,
        kind,
        receiver,
        parameters: [],
      };
      continue;
    }

    if (
      methodName.startsWith(DUAL_EXPR_COND_PREFIX) ||
      methodName.startsWith(DUAL_EXPR_COND_PREFIX_JS)
    ) {
      pushIfNew(out, current);
      pushIfNew(out, mirror);
      const exprBaseType = extractString(args[0]);
      const name = extractString(args[1]) ?? "";
      const fullName = extractString(args[2]);
      const description = extractString(args[3]);
      const receiver = receiverBefore(src, index);
      const exprKind: ParsedInstruction["kind"] =
        exprBaseType === "string" ? "strExpression" : "expression";
      current = {
        type: name,
        fullName,
        description,
        kind: exprKind,
        receiver,
        parameters: [],
      };
      mirror = {
        type: name,
        fullName,
        description,
        kind: "condition",
        receiver,
        parameters: [],
      };
      continue;
    }

    if (current && PARAM_METHODS.has(methodName)) {
      const param = makeParam(args);
      if (param) {
        current.parameters.push(param);
        if (mirror) mirror.parameters.push(param);
      }
    }
  }
  pushIfNew(out, current);
  pushIfNew(out, mirror);
  return out;
}
