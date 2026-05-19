import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const GD_REPO = "4ian/GDevelop";
const CACHE_BASE = join(homedir(), ".cache", "gdevelop-mcp");

/**
 * Path globs (translated to startsWith / endsWith checks below) that we
 * sync from the GitHub repo. Designed to be exhaustive on the parsing
 * surface while excluding large/binary/derived content.
 */
const INCLUDE_PREFIXES = [
  // C++ Core schemas + builtin extensions/events
  "Core/GDCore/Project/",
  "Core/GDCore/Events/Builtin/",
  "Core/GDCore/Extensions/Builtin/",
  "Core/GDCore/IDE/",
  "Core/GDCore/Tools/Localization",
  // Extensions: C++ + JS + TS
  "Extensions/",
  // GDJS runtime
  "GDJS/Runtime/",
  // TypeScript types
  "GDJS/Runtime/types/",
  // GDJS platform-specific C++ (JsCodeEvent, code generation, etc.)
  "GDJS/GDJS/Events/",
  "GDJS/GDJS/Extensions/",
  "GDJS/GDJS/IDE/",
];

const INCLUDE_EXT = [
  ".h",
  ".cpp",
  ".ts",
  ".tsx",
  ".js",
  ".d.ts",
  ".md",
  ".json",
];

const EXCLUDE_PATTERNS = [
  "/tests/",
  "/benchmarks/",
  "/__tests__/",
  "/.github/",
  "/locale/",
  "/locales/",
  "/Translations/",
  "node_modules/",
  "/dist/",
  "/build/",
];

const EXCLUDE_EXT = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".wav",
  ".mp3",
  ".ogg",
  ".m4a",
  ".mp4",
  ".webm",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".glb",
  ".gltf",
  ".obj",
  ".fbx",
];

const MAX_FILE_BYTES = 1_000_000; // skip files > 1 MB

export type CacheManifest = {
  ref: string;
  sha: string | null;
  syncedAt: string;
  lastFreshnessCheck: string;
  filesCount: number;
  totalBytes: number;
  includedPaths: string[];
};

function cacheRoot(): string {
  return CACHE_BASE;
}

function manifestPath(): string {
  return join(cacheRoot(), "manifest.json");
}

function sourcesRoot(ref: string): string {
  return join(cacheRoot(), `ref-${ref.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
}

export function readManifest(): CacheManifest | null {
  const path = manifestPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CacheManifest;
  } catch {
    return null;
  }
}

export function writeManifest(m: CacheManifest): void {
  mkdirSync(cacheRoot(), { recursive: true });
  writeFileSync(manifestPath(), JSON.stringify(m, null, 2), "utf-8");
}

export function getCachedSourcesPath(ref?: string): string | null {
  const m = readManifest();
  if (!m) return null;
  const r = ref ?? m.ref;
  const root = sourcesRoot(r);
  if (!existsSync(root)) return null;
  if (!statSync(root).isDirectory()) return null;
  return root;
}

function shouldInclude(path: string): boolean {
  if (EXCLUDE_PATTERNS.some((p) => path.includes(p))) return false;
  if (EXCLUDE_EXT.some((e) => path.toLowerCase().endsWith(e))) return false;
  if (!INCLUDE_PREFIXES.some((p) => path.startsWith(p))) return false;
  if (!INCLUDE_EXT.some((e) => path.endsWith(e))) return false;
  return true;
}

type GitHubTreeEntry = {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
  sha?: string;
};

async function fetchTree(
  ref: string,
): Promise<{ entries: GitHubTreeEntry[]; sha: string | null }> {
  const url = `https://api.github.com/repos/${GD_REPO}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub trees API returned ${res.status} for ref="${ref}". Check the ref is valid.`,
    );
  }
  const data = (await res.json()) as {
    sha?: string;
    tree: GitHubTreeEntry[];
    truncated?: boolean;
  };
  if (data.truncated) {
    throw new Error(
      "GitHub trees API truncated the response — repo too large to list in one call.",
    );
  }
  return { entries: data.tree, sha: data.sha ?? null };
}

async function fetchLatestRef(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GD_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github.v3+json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string };
    return data.tag_name ?? null;
  } catch {
    return null;
  }
}

async function downloadFile(
  ref: string,
  repoPath: string,
  outPath: string,
): Promise<number> {
  mkdirSync(dirname(outPath), { recursive: true });
  const jsdelivr = `https://cdn.jsdelivr.net/gh/${GD_REPO}@${ref}/${repoPath}`;
  let res = await fetch(jsdelivr);
  if (!res.ok) {
    const raw = `https://raw.githubusercontent.com/${GD_REPO}/${ref}/${repoPath}`;
    res = await fetch(raw);
    if (!res.ok) {
      throw new Error(
        `Failed to download ${repoPath} (jsDelivr ${res.status}, raw GitHub ${res.status})`,
      );
    }
  }
  const text = await res.text();
  writeFileSync(outPath, text, "utf-8");
  return text.length;
}

export type SyncOptions = {
  ref?: string;
  force?: boolean;
  concurrency?: number;
};

export type SyncResult = {
  ref: string;
  sha: string | null;
  cachePath: string;
  filesListed: number;
  filesEligible: number;
  filesDownloaded: number;
  filesSkipped: number;
  totalBytes: number;
  durationMs: number;
};

export async function syncGdevelopSources(
  options: SyncOptions = {},
): Promise<SyncResult> {
  const ref = options.ref ?? (await fetchLatestRef()) ?? "master";
  const concurrency = options.concurrency ?? 12;
  const start = Date.now();
  const root = sourcesRoot(ref);
  mkdirSync(root, { recursive: true });

  const { entries, sha } = await fetchTree(ref);

  const eligible = entries
    .filter((e) => e.type === "blob")
    .filter((e) => shouldInclude(e.path))
    .filter((e) => (e.size ?? 0) <= MAX_FILE_BYTES);

  let downloaded = 0;
  let skipped = 0;
  let totalBytes = 0;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < eligible.length) {
      const i = cursor++;
      const entry = eligible[i];
      const outPath = join(root, entry.path);
      if (!options.force && existsSync(outPath)) {
        skipped++;
        continue;
      }
      const bytes = await downloadFile(ref, entry.path, outPath);
      downloaded++;
      totalBytes += bytes;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, eligible.length) }, () =>
      worker(),
    ),
  );

  const manifest: CacheManifest = {
    ref,
    sha,
    syncedAt: new Date().toISOString(),
    lastFreshnessCheck: new Date().toISOString(),
    filesCount: eligible.length,
    totalBytes,
    includedPaths: INCLUDE_PREFIXES,
  };
  writeManifest(manifest);

  return {
    ref,
    sha,
    cachePath: root,
    filesListed: entries.length,
    filesEligible: eligible.length,
    filesDownloaded: downloaded,
    filesSkipped: skipped,
    totalBytes,
    durationMs: Date.now() - start,
  };
}

export type FreshnessStatus = {
  cached: boolean;
  cachedRef: string | null;
  cachedSha: string | null;
  latestRef: string | null;
  latestSha: string | null;
  stale: boolean;
  reason: string;
};

const FRESHNESS_CHECK_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function checkFreshness(
  options: { force?: boolean } = {},
): Promise<FreshnessStatus> {
  const manifest = readManifest();
  if (!manifest) {
    return {
      cached: false,
      cachedRef: null,
      cachedSha: null,
      latestRef: null,
      latestSha: null,
      stale: true,
      reason: "No cache yet — call sync_gdevelop_sources first.",
    };
  }

  const checkedAgo =
    Date.now() - new Date(manifest.lastFreshnessCheck).getTime();
  if (!options.force && checkedAgo < FRESHNESS_CHECK_TTL_MS) {
    return {
      cached: true,
      cachedRef: manifest.ref,
      cachedSha: manifest.sha,
      latestRef: manifest.ref,
      latestSha: manifest.sha,
      stale: false,
      reason: `Cache last verified ${Math.round(checkedAgo / 60_000)} min ago; assumed fresh.`,
    };
  }

  const latestRef = await fetchLatestRef();
  let latestSha: string | null = null;
  if (latestRef) {
    try {
      const { sha } = await fetchTree(latestRef);
      latestSha = sha;
    } catch {
      // ignore
    }
  }

  const stale =
    latestRef !== null && latestRef !== manifest.ref
      ? true
      : latestSha !== null && latestSha !== manifest.sha
        ? true
        : false;

  // Update lastFreshnessCheck timestamp without re-syncing
  writeManifest({ ...manifest, lastFreshnessCheck: new Date().toISOString() });

  return {
    cached: true,
    cachedRef: manifest.ref,
    cachedSha: manifest.sha,
    latestRef,
    latestSha,
    stale,
    reason: stale
      ? `A newer GDevelop ref is available (current: ${manifest.ref}, latest: ${latestRef ?? "?"}). Call sync_gdevelop_sources to refresh.`
      : "Cache is up to date with the latest GDevelop release.",
  };
}

/**
 * Pre-flight helper for tools that need the cache. Throws a clear error
 * if the cache is missing. Does NOT auto-sync — callers must explicitly
 * call sync_gdevelop_sources first (cheap to fail loud).
 */
export function ensureCacheReady(): string {
  const path = getCachedSourcesPath();
  if (!path) {
    throw new Error(
      "GDevelop source cache is missing. " +
        "Call `sync_gdevelop_sources` first to download the canonical sources from 4ian/GDevelop into ~/.cache/gdevelop-mcp/.",
    );
  }
  return path;
}
