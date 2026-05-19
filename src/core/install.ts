import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { platform, homedir } from "node:os";

export type GDevelopInstall = {
  appPath: string;
  resourcesPath: string;
  gdjsRuntimePath: string;
  gdjsRuntimeSourcesPath: string;
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

function isValidInstall(appPath: string): GDevelopInstall | null {
  if (!existsSync(appPath)) return null;
  const resourcesPath = resourcesDirFor(appPath);
  const gdjsRuntimePath = join(resourcesPath, "GDJS/Runtime");
  const gdjsRuntimeSourcesPath = join(resourcesPath, "GDJS/Runtime-sources");
  const extensionsPath = join(gdjsRuntimeSourcesPath, "Extensions");

  if (!existsSync(extensionsPath)) return null;
  if (!statSync(extensionsPath).isDirectory()) return null;

  return {
    appPath,
    resourcesPath,
    gdjsRuntimePath,
    gdjsRuntimeSourcesPath,
    extensionsPath,
  };
}

export function findGDevelopInstall(): GDevelopInstall {
  const override = process.env.GDEVELOP_PATH;
  if (override) {
    const install = isValidInstall(override);
    if (install) return install;
    throw new Error(
      `GDEVELOP_PATH is set to "${override}" but no valid GDevelop install was found there.`,
    );
  }

  const candidates =
    platform() === "darwin"
      ? MACOS_CANDIDATES
      : platform() === "win32"
        ? WINDOWS_CANDIDATES
        : LINUX_CANDIDATES;

  for (const candidate of candidates) {
    const install = isValidInstall(candidate);
    if (install) return install;
  }

  throw new Error(
    `Could not locate GDevelop install. Tried: ${candidates.join(", ")}. ` +
      `Set GDEVELOP_PATH env var to override.`,
  );
}
