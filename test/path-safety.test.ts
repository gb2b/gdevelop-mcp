import { describe, it, expect } from "vitest";
import {
  validateProjectPath,
  validateChildPath,
} from "../src/core/path-safety.js";

describe("validateProjectPath", () => {
  it("accepts a well-formed absolute path", () => {
    expect(validateProjectPath("/tmp/foo/bar.json")).toBe("/tmp/foo/bar.json");
  });

  it("rejects an empty string", () => {
    expect(() => validateProjectPath("")).toThrow(/non-empty/);
  });

  it("rejects a relative path by default", () => {
    expect(() => validateProjectPath("foo/bar.json")).toThrow(/absolute/);
  });

  it("rejects a path with a null byte", () => {
    expect(() => validateProjectPath("/tmp/foo\0evil")).toThrow(/null byte/);
  });

  it("normalizes a path with .. segments", () => {
    expect(validateProjectPath("/tmp/foo/../bar.json")).toBe("/tmp/bar.json");
  });

  it("rejects a path that escapes the allowed root", () => {
    expect(() =>
      validateProjectPath("/tmp/foo.json", { allowedRoot: "/other/root" }),
    ).toThrow(/escapes/);
  });

  it("accepts a path inside the allowed root", () => {
    const resolved = validateProjectPath("/tmp/area/file.json", {
      allowedRoot: "/tmp/area",
    });
    expect(resolved).toBe("/tmp/area/file.json");
  });
});

describe("validateChildPath", () => {
  it("accepts a simple file inside the parent", () => {
    expect(validateChildPath("/tmp/parent", "child.ts")).toBe(
      "/tmp/parent/child.ts",
    );
  });

  it("rejects ../ escape attempts", () => {
    expect(() => validateChildPath("/tmp/parent", "../escape.txt")).toThrow(
      /escapes/,
    );
  });

  it("rejects a sibling-traversal attempt", () => {
    expect(() => validateChildPath("/tmp/parent", "../../etc/passwd")).toThrow(
      /escapes/,
    );
  });

  it("rejects a null byte in the child name", () => {
    expect(() => validateChildPath("/tmp/parent", "file\0.ts")).toThrow(
      /null byte/,
    );
  });

  it("rejects an empty child name", () => {
    expect(() => validateChildPath("/tmp/parent", "")).toThrow(/non-empty/);
  });
});
