import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { platform, homedir } from "node:os";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

export type GDevelopInstall = {
  source: "local" | "bundled";
  appPath: string | null;
  resourcesPath: string;
  gdjsRuntimePath: string;
  /**
   * Path to TypeScript runtime sources, or null when only compiled JS
   * is available (bundled fallback). When null, dynamic catalog parsing
   * of `*DataType` content fields is skipped, but `JsExtension.js`
   * scanning still works.
   */
  gdjsRuntimeSourcesPath: string | null;
  extensionsPath: string;
};

const MACOS_CANDIDATES = [
  "/Applications/GDevelop 5.app",
  join(homedir(), "Applications/GDevelop 5.app"),
];

const LINUX_CANDIDATES = [
  "/opt/GDevelop 5",
  "/usr/lib/gdevelop",
  join(homedir(), ".local/share/applications/gdevelop"),
  // AppImage extracted manually
  join(homedir(), "Applications/GDevelop 5"),
];

const WINDOWS_CANDIDATES = [
  "C:\\Program Files\\GDevelop 5",
  "C:\\Program Files (x86)\\GDevelop 5",
  join(homedir(), "AppData/Local/Programs/GDevelop 5"),
];

function resourcesDirFor(appPath: string): string {
  if (platform() === "darwin") return join(appPath, "Contents/Resources");
  if (platform() === "win32") return join(appPath, "resources");
  return join(appPath, "resources");
}

function isValidLocalInstall(appPath: string): GDevelopInstall | null {
  if (!existsSync(appPath)) return null;
  const resourcesPath = resourcesDirFor(appPath);
  const gdjsRuntimePath = join(resourcesPath, "GDJS/Runtime");
  const gdjsRuntimeSourcesPath = join(resourcesPath, "GDJS/Runtime-sources");
  const extensionsPath = join(gdjsRuntimeSourcesPath, "Extensions");

  if (!existsSync(extensionsPath)) return null;
  if (!statSync(extensionsPath).isDirectory()) return null;

  return {
    source: "local",
    appPath,
    resourcesPath,
    gdjsRuntimePath,
    gdjsRuntimeSourcesPath,
    extensionsPath,
  };
}

/**
 * Cross-platform fallback: use the runtime bundled inside the gdcore-tools
 * npm package (transitive dep of gdexporter). Works in CI / Docker / Linux
 * AppImage scenarios where a desktop install isn't available.
 *
 * Compiled .js — content-fields extraction (catalog-dynamic) is degraded,
 * but JsExtension.js parsing (catalog-actions) is fully functional.
 */
function findBundledRuntime(): GDevelopInstall | null {
  try {
    const gdcoreToolsPkgPath = require_.resolve("gdcore-tools/package.json");
    const gdcoreToolsRoot = dirname(gdcoreToolsPkgPath);
    const distRuntime = join(gdcoreToolsRoot, "dist", "Runtime");
    if (!existsSync(distRuntime)) return null;
    const extensionsPath = join(distRuntime, "Extensions");
    if (!existsSync(extensionsPath) || !statSync(extensionsPath).isDirectory())
      return null;
    return {
      source: "bundled",
      appPath: null,
      resourcesPath: dirname(distRuntime),
      gdjsRuntimePath: distRuntime,
      gdjsRuntimeSourcesPath: null,
      extensionsPath,
    };
  } catch {
    return null;
  }
}

export function findGDevelopInstall(): GDevelopInstall {
  const override = process.env.GDEVELOP_PATH;
  if (override) {
    const install = isValidLocalInstall(override);
    if (install) return install;
    throw new Error(
      `GDEVELOP_PATH is set to "${override}" but no valid GDevelop install was found there.`,
    );
  }

  const forceBundled = process.env.GDEVELOP_USE_BUNDLED === "true";
  if (!forceBundled) {
    const candidates =
      platform() === "darwin"
        ? MACOS_CANDIDATES
        : platform() === "win32"
          ? WINDOWS_CANDIDATES
          : LINUX_CANDIDATES;

    for (const candidate of candidates) {
      const install = isValidLocalInstall(candidate);
      if (install) return install;
    }
  }

  const bundled = findBundledRuntime();
  if (bundled) return bundled;

  throw new Error(
    "Could not locate any GDevelop runtime. " +
      "Tried local install candidates and the gdcore-tools bundled runtime. " +
      "Either install GDevelop (https://gdevelop.io), set GDEVELOP_PATH to its directory, " +
      "or ensure gdcore-tools is installed (it's a transitive dep of gdexporter).",
  );
}
