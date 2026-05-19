import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectLocalDesktopInstall,
  type LocalDesktopInstallInfo,
} from "./install.js";
import { readManifest, type CacheManifest } from "./cache.js";

export type RuntimeInfo = {
  /** Parsing pipeline always uses the GitHub-synced cache. */
  parsingSource: "github-cache";
  /** The synced cache manifest, when present. */
  cache: CacheManifest | null;
  /** Info about the optional local desktop install (not used for parsing). */
  localDesktop: LocalDesktopInstallInfo;
  /** gdcore-tools npm package version (only used by preview_scene). */
  gdcoreToolsVersion: string | null;
};

function readGdcoreToolsVersion(): string | null {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 10; i++) {
      const candidate = join(
        dir,
        "node_modules",
        "gdcore-tools",
        "package.json",
      );
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, "utf-8")) as {
          version?: string;
        };
        return pkg.version ?? null;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  } catch {
    return null;
  }
}

export function getRuntimeInfo(): RuntimeInfo {
  return {
    parsingSource: "github-cache",
    cache: readManifest(),
    localDesktop: inspectLocalDesktopInstall(),
    gdcoreToolsVersion: readGdcoreToolsVersion(),
  };
}

export type FreshnessReport = {
  current: string | null;
  latest: string | null;
  fresh: boolean;
  note: string;
};

/**
 * Compares the locally installed gdcore-tools version against the latest
 * available on the npm registry. Best-effort. (gdcore-tools only powers
 * preview_scene; the parsing pipeline uses GitHub sources directly.)
 */
export async function checkRuntimeFreshness(): Promise<FreshnessReport> {
  const current = readGdcoreToolsVersion();
  if (!current) {
    return {
      current: null,
      latest: null,
      fresh: false,
      note: "gdcore-tools is not installed (only used transitively by gdexporter for preview_scene).",
    };
  }
  try {
    const res = await fetch("https://registry.npmjs.org/gdcore-tools/latest", {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return {
        current,
        latest: null,
        fresh: false,
        note: `npm registry returned ${res.status}; cannot determine freshness.`,
      };
    }
    const data = (await res.json()) as { version?: string };
    const latest = data.version ?? null;
    const fresh = latest !== null && latest === current;
    return {
      current,
      latest,
      fresh,
      note: fresh
        ? "gdcore-tools (preview_scene runtime) is up to date with the npm registry."
        : `A newer gdcore-tools is available (current: ${current}, latest: ${latest}). Only affects preview_scene.`,
    };
  } catch (err) {
    return {
      current,
      latest: null,
      fresh: false,
      note: `Could not reach the npm registry: ${(err as Error).message}`,
    };
  }
}
