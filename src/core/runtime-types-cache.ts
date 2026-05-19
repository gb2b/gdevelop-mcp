import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

function findNodeModulePackageRoot(name: string): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const GD_REPO = "4ian/GDevelop";
// On the GitHub repo, runtime extension sources live at /Extensions/<name>/*.ts
// The desktop app's build process copies them to /GDJS/Runtime-sources/Extensions/.
// We mirror the app's layout in the local cache so the rest of the codebase
// (extensions scanner, catalog-dynamic) doesn't need to care about the difference.
const REPO_EXTENSIONS_PREFIX = "Extensions/";
const CACHE_EXTENSIONS_PREFIX = "GDJS/Runtime-sources/Extensions/";
const CACHE_RUNTIME_SOURCES_PREFIX = "GDJS/Runtime-sources/";

/**
 * Extracts the GDevelop git tag/sha from the gdcore-tools npm package
 * version string. Versions look like "2.0.0-gd-v5.6.269-autobuild".
 */
export function getBundledGdRef(): string | null {
  try {
    const root = findNodeModulePackageRoot("gdcore-tools");
    if (!root) return null;
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf-8"),
    ) as {
      version?: string;
    };
    if (!pkg.version) return null;
    // Match patterns like "2.0.0-gd-v5.6.269-autobuild" → capture "v5.6.269"
    const match = pkg.version.match(/-gd-(v[\d]+\.[\d]+\.[\d]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function cacheRoot(ref: string): string {
  return join(homedir(), ".cache", "gdevelop-mcp", `gdjs-types-${ref}`);
}

function cacheRuntimeSources(ref: string): string {
  return join(cacheRoot(ref), CACHE_RUNTIME_SOURCES_PREFIX.replace(/\/$/, ""));
}

export function getCachedRuntimeSources(ref?: string): string | null {
  const r = ref ?? getBundledGdRef();
  if (!r) return null;
  const path = cacheRuntimeSources(r);
  if (!existsSync(path) || !statSync(path).isDirectory()) return null;
  return path;
}

type GitHubTreeEntry = {
  path: string;
  type: "blob" | "tree" | "commit";
};

async function listRepoFiles(ref: string): Promise<string[]> {
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
    tree: GitHubTreeEntry[];
    truncated?: boolean;
  };
  if (data.truncated) {
    throw new Error(
      "GitHub trees API truncated the response — repo too large to list in one call.",
    );
  }
  return data.tree
    .filter(
      (e) =>
        e.type === "blob" &&
        e.path.startsWith(REPO_EXTENSIONS_PREFIX) &&
        (e.path.endsWith(".ts") || e.path.endsWith("/JsExtension.js")) &&
        !e.path.includes("/tests/") &&
        !e.path.includes("/benchmarks/"),
    )
    .map((e) => e.path);
}

function remapRepoPath(repoPath: string): string {
  // Repo: Extensions/<name>/file.ts → Cache: GDJS/Runtime-sources/Extensions/<name>/file.ts
  if (repoPath.startsWith(REPO_EXTENSIONS_PREFIX)) {
    return (
      CACHE_EXTENSIONS_PREFIX + repoPath.slice(REPO_EXTENSIONS_PREFIX.length)
    );
  }
  return repoPath;
}

async function downloadOne(
  ref: string,
  repoPath: string,
  cacheRoot: string,
): Promise<{ bytes: number; outPath: string }> {
  const outPath = join(cacheRoot, remapRepoPath(repoPath));
  mkdirSync(dirname(outPath), { recursive: true });
  // Try jsDelivr first (CDN, no rate limit), fallback to GitHub raw
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
  return { bytes: text.length, outPath };
}

export type SyncResult = {
  ref: string;
  cachePath: string;
  filesListed: number;
  filesDownloaded: number;
  filesSkipped: number;
  totalBytes: number;
  durationMs: number;
};

export async function syncRuntimeTypes(
  options: { ref?: string; force?: boolean; concurrency?: number } = {},
): Promise<SyncResult> {
  const resolvedRef: string | null = options.ref ?? getBundledGdRef();
  if (!resolvedRef) {
    throw new Error(
      "Could not determine the GDevelop ref to sync. Pass a `ref` (e.g. 'v5.6.269') or install gdcore-tools.",
    );
  }
  const ref: string = resolvedRef;
  const concurrency = options.concurrency ?? 12;
  const start = Date.now();
  const root = cacheRoot(ref);
  mkdirSync(root, { recursive: true });

  const files = await listRepoFiles(ref);

  let downloaded = 0;
  let skipped = 0;
  let totalBytes = 0;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < files.length) {
      const i = cursor++;
      const repoPath = files[i];
      const outPath = join(root, remapRepoPath(repoPath));
      if (!options.force && existsSync(outPath)) {
        skipped++;
        continue;
      }
      const { bytes } = await downloadOne(ref, repoPath, root);
      downloaded++;
      totalBytes += bytes;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, () => worker()),
  );

  return {
    ref,
    cachePath: cacheRuntimeSources(ref),
    filesListed: files.length,
    filesDownloaded: downloaded,
    filesSkipped: skipped,
    totalBytes,
    durationMs: Date.now() - start,
  };
}
