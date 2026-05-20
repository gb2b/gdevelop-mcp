import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GDevelopInstall } from "./install.js";
import { validateChildPath } from "./path-safety.js";

export type ExtensionInfo = {
  name: string;
  path: string;
  hasJsExtension: boolean;
  runtimeFiles: string[];
};

export function listExtensions(install: GDevelopInstall): ExtensionInfo[] {
  const entries = readdirSync(install.extensionsPath, { withFileTypes: true });
  const extensions: ExtensionInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const extPath = join(install.extensionsPath, entry.name);
    const jsExtensionPath = join(extPath, "JsExtension.js");
    const hasJsExtension = existsSync(jsExtensionPath);

    const runtimeFiles: string[] = [];
    try {
      for (const file of readdirSync(extPath)) {
        const fullPath = join(extPath, file);
        if (statSync(fullPath).isFile() && /\.(ts|js)$/.test(file)) {
          runtimeFiles.push(file);
        }
      }
    } catch {
      // ignore unreadable subdirs
    }

    extensions.push({
      name: entry.name,
      path: extPath,
      hasJsExtension,
      runtimeFiles: runtimeFiles.sort(),
    });
  }

  return extensions.sort((a, b) => a.name.localeCompare(b.name));
}

export function readExtensionFile(
  install: GDevelopInstall,
  extensionName: string,
  fileName: string,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(extensionName)) {
    throw new Error(
      `Invalid extension name "${extensionName}" — only [A-Za-z0-9_-] allowed.`,
    );
  }
  const extDir = join(install.extensionsPath, extensionName);
  const fullPath = validateChildPath(extDir, fileName);
  if (!existsSync(fullPath)) {
    throw new Error(
      `File not found: ${extensionName}/${fileName}. Use list_extensions to see available files.`,
    );
  }
  return readFileSync(fullPath, "utf-8");
}
