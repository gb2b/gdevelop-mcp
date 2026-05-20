import { resolve, isAbsolute, normalize, relative } from "node:path";

/**
 * Validates a project file path before any read/write operation in tool
 * handlers. Refuses paths that are non-absolute, that resolve outside an
 * explicit allow-list root (when one is provided), or that contain null
 * bytes (which can fool fs syscalls on some platforms).
 *
 * Returns the normalized, resolved absolute path.
 */
export function validateProjectPath(
  input: string,
  options: { mustBeAbsolute?: boolean; allowedRoot?: string } = {},
): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("Project path must be a non-empty string.");
  }
  if (input.includes("\0")) {
    throw new Error("Project path contains a null byte.");
  }
  if (options.mustBeAbsolute !== false && !isAbsolute(input)) {
    throw new Error(
      `Project path must be absolute (received: "${input}"). Pass the full path to the .json file.`,
    );
  }
  const normalized = normalize(input);
  const resolved = resolve(normalized);

  if (options.allowedRoot) {
    const rootResolved = resolve(options.allowedRoot);
    const rel = relative(rootResolved, resolved);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(
        `Project path "${resolved}" escapes the allowed root "${rootResolved}".`,
      );
    }
  }

  return resolved;
}

/**
 * Validates a sub-path that must stay inside a parent directory. Returns
 * the resolved absolute path. Used by tools that take a relative file
 * name (e.g. read_extension_source) inside a known-safe directory.
 */
export function validateChildPath(parent: string, child: string): string {
  if (typeof child !== "string" || child.length === 0) {
    throw new Error("File name must be a non-empty string.");
  }
  if (child.includes("\0")) {
    throw new Error("File name contains a null byte.");
  }
  const parentResolved = resolve(parent);
  const resolved = resolve(parentResolved, child);
  const rel = relative(parentResolved, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `File name "${child}" escapes its parent directory "${parentResolved}".`,
    );
  }
  return resolved;
}
