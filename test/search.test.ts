import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Seed a controlled cache root and mock ensureCacheReady to return it.
const CACHE_ROOT = mkdtempSync(join(tmpdir(), "search-test-"));
mkdirSync(join(CACHE_ROOT, "Extensions/Foo"), { recursive: true });
mkdirSync(join(CACHE_ROOT, "Core/Bar"), { recursive: true });
writeFileSync(
  join(CACHE_ROOT, "Extensions/Foo/Extension.cpp"),
  [
    "// header",
    'extension.AddAction("Jump", _("Jump"), _("Make hero jump"));',
    "void unrelated() {}",
  ].join("\n"),
);
writeFileSync(
  join(CACHE_ROOT, "Core/Bar/thing.h"),
  [
    "class GD_CORE_API ThingEvent : public gd::BaseEvent {",
    "  // ...",
    "};",
  ].join("\n"),
);
writeFileSync(join(CACHE_ROOT, "Extensions/Foo/big.cpp"), "x\n".repeat(50));

vi.mock("../src/core/cache.js", () => ({
  ensureCacheReady: () => CACHE_ROOT,
}));

const { searchGdevelopCode } = await import("../src/core/search.js");

describe("searchGdevelopCode", () => {
  it("finds a match via simple regex", () => {
    const r = searchGdevelopCode({ query: "AddAction" });
    expect(r.matchesReturned).toBe(1);
    expect(r.hits[0].file).toBe("Extensions/Foo/Extension.cpp");
    expect(r.hits[0].line).toBe(2);
  });

  it("includes context lines when requested", () => {
    const r = searchGdevelopCode({
      query: "AddAction",
      contextBefore: 1,
      contextAfter: 1,
    });
    expect(r.hits[0].context).toBeDefined();
    expect(r.hits[0].context!.length).toBe(3);
  });

  it("filters by path prefix", () => {
    const r = searchGdevelopCode({
      query: "Event",
      pathPrefixes: ["Core/"],
    });
    expect(r.hits.every((h) => h.file.startsWith("Core/"))).toBe(true);
  });

  it("filters by extension", () => {
    const r = searchGdevelopCode({
      query: "x",
      extensions: [".cpp"],
    });
    expect(r.hits.every((h) => h.file.endsWith(".cpp"))).toBe(true);
  });

  it("throws on invalid regex", () => {
    expect(() => searchGdevelopCode({ query: "(unclosed" })).toThrow(
      /Invalid regex/,
    );
  });
});
