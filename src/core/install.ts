import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { platform, homedir } from "node:os";
import { ensureCacheReady } from "./cache.js";

/**
 * Runtime sources used by parsing/catalog/validation. Always rooted in
 * the GitHub-synced cache (canonical 4ian/GDevelop repo). The local
 * desktop install is NOT a primary source — `inspectLocalDesktopInstall`
 * exposes it separately for informational purposes.
 */
export type GDevelopInstall = {
  source: "github-cache";
  resourcesPath: string;
  gdjsRuntimeSourcesPath: string;
  extensionsPath: string;
};

export type LocalDesktopInstallInfo = {
  found: boolean;
  appPath: string | null;
  resourcesPath: string | null;
  gdjsRuntimeSourcesPath: string | null;
  extensionsPath: string | null;
  hasTypeScriptSources: boolean;
};

const MACOS_CANDIDATES = [
  "/Applications/GDevelop 5.app",
  join(homedir(), "Applications/GDevelop 5.app"),
];

const LINUX_CANDIDATES = [
  "/opt/GDevelop 5",
  "/usr/lib/gdevelop",
  join(homedir(), ".local/share/applications/gdevelop"),
  join(homedir(), "Applications/GDevelop 5"),
];

const WINDOWS_CANDIDATES = [
  "C:\\Program Files\\GDevelop 5",
  "C:\\Program Files (x86)\\GDevelop 5",
  join(homedir(), "AppData/Local/Programs/GDevelop 5"),
];

function resourcesDirFor(appPath: string): string {
  if (platform() === "darwin") return join(appPath, "Contents/Resources");
  return join(appPath, "resources");
}

function probeLocalInstall(appPath: string): LocalDesktopInstallInfo {
  if (!existsSync(appPath)) {
    return {
      found: false,
      appPath: null,
      resourcesPath: null,
      gdjsRuntimeSourcesPath: null,
      extensionsPath: null,
      hasTypeScriptSources: false,
    };
  }
  const resourcesPath = resourcesDirFor(appPath);
  const gdjsRuntimeSourcesPath = join(resourcesPath, "GDJS/Runtime-sources");
  const extensionsPath = join(gdjsRuntimeSourcesPath, "Extensions");
  const hasTypeScriptSources =
    existsSync(extensionsPath) && statSync(extensionsPath).isDirectory();
  return {
    found: hasTypeScriptSources,
    appPath,
    resourcesPath,
    gdjsRuntimeSourcesPath: hasTypeScriptSources
      ? gdjsRuntimeSourcesPath
      : null,
    extensionsPath: hasTypeScriptSources ? extensionsPath : null,
    hasTypeScriptSources,
  };
}

export function inspectLocalDesktopInstall(): LocalDesktopInstallInfo {
  const override = process.env.GDEVELOP_PATH;
  if (override) return probeLocalInstall(override);
  const candidates =
    platform() === "darwin"
      ? MACOS_CANDIDATES
      : platform() === "win32"
        ? WINDOWS_CANDIDATES
        : LINUX_CANDIDATES;
  for (const candidate of candidates) {
    const info = probeLocalInstall(candidate);
    if (info.found) return info;
  }
  return {
    found: false,
    appPath: null,
    resourcesPath: null,
    gdjsRuntimeSourcesPath: null,
    extensionsPath: null,
    hasTypeScriptSources: false,
  };
}

export function findGDevelopInstall(): GDevelopInstall {
  const cacheRoot = ensureCacheReady();
  // The cache mirrors the GitHub repo structure. Extensions are at
  // Extensions/<Name>/ relative to the cache root. The GDJS runtime
  // sources are at GDJS/Runtime/.
  const extensionsPath = join(cacheRoot, "Extensions");
  const runtimeSourcesPath = join(cacheRoot, "GDJS", "Runtime");
  if (!existsSync(extensionsPath)) {
    throw new Error(
      `Cache at ${cacheRoot} is missing the Extensions/ subdirectory — call sync_gdevelop_sources with force:true to repopulate.`,
    );
  }
  return {
    source: "github-cache",
    resourcesPath: cacheRoot,
    gdjsRuntimeSourcesPath: runtimeSourcesPath,
    extensionsPath,
  };
}

// Re-export for callers that want to know about a local desktop install
// without triggering cache requirements.
void dirname;
