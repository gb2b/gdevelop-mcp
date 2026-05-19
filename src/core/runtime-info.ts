import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type { GDevelopInstall } from "./install.js";

const require_ = createRequire(import.meta.url);

export type RuntimeInfo = {
  source: "local" | "bundled";
  appPath: string | null;
  /** Version string of the runtime currently used. */
  version: string | null;
  /** For bundled: gdcore-tools npm package version. */
  bundledPackageVersion: string | null;
  /** For local: GDevelop version parsed from electron app/build info, when available. */
  localAppVersion: string | null;
};

function readBundledPackageVersion(): string | null {
  try {
    const pkgPath = require_.resolve("gdcore-tools/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

function readLocalAppVersion(install: GDevelopInstall): string | null {
  if (!install.appPath) return null;
  const candidates = [
    join(install.resourcesPath, "app.asar"),
    join(install.appPath, "Contents", "Info.plist"),
    join(install.appPath, "package.json"),
    join(install.resourcesPath, "app", "package.json"),
  ];
  void candidates;
  // app.asar would need a parser. Info.plist is XML. Both require extra deps.
  // For MVP, return null and let the user grep manually if needed.
  return null;
}

export function getRuntimeInfo(install: GDevelopInstall): RuntimeInfo {
  const bundledPackageVersion = readBundledPackageVersion();
  const localAppVersion = readLocalAppVersion(install);
  return {
    source: install.source,
    appPath: install.appPath,
    version:
      install.source === "bundled" ? bundledPackageVersion : localAppVersion,
    bundledPackageVersion,
    localAppVersion,
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
 * available on the npm registry. Best-effort: returns a `note` and `fresh:
 * null`-ish behavior if the network is unavailable.
 */
export async function checkRuntimeFreshness(): Promise<FreshnessReport> {
  const current = readBundledPackageVersion();
  if (!current) {
    return {
      current: null,
      latest: null,
      fresh: false,
      note: "gdcore-tools is not installed locally.",
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
        ? "Bundled runtime is up to date with the npm registry."
        : `A newer gdcore-tools is available (current: ${current}, latest: ${latest}). Run "npm update gdcore-tools" inside the gdevelop-mcp repo to upgrade.`,
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

void dirname;
