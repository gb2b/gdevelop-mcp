import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ensureCacheReady } from "./cache.js";

const DEFAULT_MAX_RESULTS = 30;
const DEFAULT_CONTEXT_BEFORE = 0;
const DEFAULT_CONTEXT_AFTER = 0;
const DEFAULT_MAX_FILE_BYTES = 1_000_000;

export type SearchOptions = {
  query: string;
  /** Regex flags (default 'i' for case-insensitive). Pass empty string for case-sensitive. */
  flags?: string;
  /** Limit results (default 30). */
  maxResults?: number;
  /** Lines of context before each match (default 0). */
  contextBefore?: number;
  /** Lines of context after each match (default 0). */
  contextAfter?: number;
  /** Restrict to files whose path starts with one of these prefixes. */
  pathPrefixes?: string[];
  /** Restrict to file extensions (e.g. ['.cpp', '.ts']). */
  extensions?: string[];
};

export type SearchHit = {
  file: string;
  line: number;
  text: string;
  context?: string[];
};

export type SearchResult = {
  query: string;
  flags: string;
  cacheRef: string | null;
  filesScanned: number;
  matchesTotal: number;
  matchesReturned: number;
  truncated: boolean;
  hits: SearchHit[];
};

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, out);
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

export function searchGdevelopCode(opts: SearchOptions): SearchResult {
  const cacheRoot = ensureCacheReady();
  const flags = opts.flags ?? "i";
  const maxResults = opts.maxResults ?? DEFAULT_MAX_RESULTS;
  const contextBefore = opts.contextBefore ?? DEFAULT_CONTEXT_BEFORE;
  const contextAfter = opts.contextAfter ?? DEFAULT_CONTEXT_AFTER;

  let re: RegExp;
  try {
    re = new RegExp(opts.query, flags);
  } catch (err) {
    throw new Error(`Invalid regex query: ${(err as Error).message}`);
  }

  const allFiles = walk(cacheRoot);
  const eligible = allFiles.filter((p) => {
    const rel = relative(cacheRoot, p);
    if (
      opts.pathPrefixes &&
      !opts.pathPrefixes.some((pre) => rel.startsWith(pre))
    )
      return false;
    if (opts.extensions && !opts.extensions.some((e) => rel.endsWith(e)))
      return false;
    try {
      const st = statSync(p);
      if (st.size > DEFAULT_MAX_FILE_BYTES) return false;
    } catch {
      return false;
    }
    return true;
  });

  const hits: SearchHit[] = [];
  let matchesTotal = 0;
  let filesScanned = 0;

  outer: for (const filePath of eligible) {
    let text: string;
    try {
      text = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    filesScanned++;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        matchesTotal++;
        if (hits.length < maxResults) {
          const ctx: string[] = [];
          if (contextBefore > 0 || contextAfter > 0) {
            for (
              let j = Math.max(0, i - contextBefore);
              j <= Math.min(lines.length - 1, i + contextAfter);
              j++
            ) {
              ctx.push(`${j + 1}: ${lines[j]}`);
            }
          }
          hits.push({
            file: relative(cacheRoot, filePath),
            line: i + 1,
            text: lines[i],
            context: ctx.length > 0 ? ctx : undefined,
          });
        }
        // Hard cap to prevent pathological regex (e.g. ".") from
        // exhausting memory or burning tokens. We stop counting after
        // 10k matches; the response reports `truncated: true`.
        if (matchesTotal >= 10_000) break outer;
        if (matchesTotal >= maxResults * 5) break outer;
      }
    }
  }

  const cacheRef = (() => {
    try {
      // manifest.json is at parent of ref-<ref>
      const manifestPath = join(cacheRoot, "..", "manifest.json");
      const m = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
        ref?: string;
      };
      return m.ref ?? null;
    } catch {
      return null;
    }
  })();

  return {
    query: opts.query,
    flags,
    cacheRef,
    filesScanned,
    matchesTotal,
    matchesReturned: hits.length,
    truncated: matchesTotal > hits.length,
    hits,
  };
}
