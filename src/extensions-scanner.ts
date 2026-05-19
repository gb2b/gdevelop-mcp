import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GDevelopInstall } from "./gdevelop-install.js";

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
  const safeName = extensionName.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeFile = fileName.replace(/\.\./g, "");
  const fullPath = join(install.extensionsPath, safeName, safeFile);

  if (!fullPath.startsWith(install.extensionsPath)) {
    throw new Error(`Path traversal blocked: ${fileName}`);
  }
  if (!existsSync(fullPath)) {
    throw new Error(
      `File not found: ${safeName}/${safeFile}. Use list_extensions to see available files.`,
    );
  }

  return readFileSync(fullPath, "utf-8");
}
