import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { fetchWikiPage } = await import("../src/core/wiki.js");

function mockFetch(handler: (url: string) => Promise<Response> | Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      return handler(url);
    }),
  );
}

describe("fetchWikiPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a bare slug to /gdevelop5/<slug>/", async () => {
    let calledUrl = "";
    mockFetch(async (url) => {
      calledUrl = url;
      return new Response(
        "<html><body><main><h1>Title</h1><p>Body</p></main></body></html>",
      );
    });
    const result = await fetchWikiPage("all-features");
    expect(calledUrl).toContain("/gdevelop5/all-features/");
    expect(result.markdown).toContain("Title");
    expect(result.markdown).toContain("Body");
  });

  it("follows a meta-refresh redirect", async () => {
    const calls: string[] = [];
    mockFetch(async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return new Response(
          '<html><head><meta http-equiv="refresh" content="0; url=../destination/"></head></html>',
        );
      }
      return new Response(
        "<html><body><article><h1>Destination reached</h1></article></body></html>",
      );
    });
    const result = await fetchWikiPage("all-features/foo");
    expect(calls.length).toBe(2);
    expect(result.markdown).toContain("Destination reached");
  });

  it("extracts only the <article> when both <article> and noise exist", async () => {
    mockFetch(async () => {
      return new Response(
        "<html><body><nav>Nav menu</nav><article><h1>Real content</h1></article><footer>Footer</footer></body></html>",
      );
    });
    const result = await fetchWikiPage("all-features/timers");
    expect(result.markdown).toContain("Real content");
    expect(result.markdown).not.toContain("Nav menu");
    expect(result.markdown).not.toContain("Footer");
  });

  it("falls back to <main> when no <article>", async () => {
    mockFetch(async () => {
      return new Response(
        `<html><body><main>${"X".repeat(250)}<h1>Found in main</h1></main></body></html>`,
      );
    });
    const result = await fetchWikiPage("all-features/audio");
    expect(result.markdown).toContain("Found in main");
  });

  it("throws on non-2xx", async () => {
    mockFetch(async () => new Response("not found", { status: 404 }));
    await expect(fetchWikiPage("all-features/missing")).rejects.toThrow(/404/);
  });
});
