const WIKI_BASE = "https://wiki.gdevelop.io";
const MAX_BYTES = 100_000;

export type WikiFetchResult = {
  url: string;
  status: number;
  truncated: boolean;
  markdown: string;
};

function extractMainContent(html: string): string {
  // Prefer <article>, then <main>, then a div with role="main" or class
  // containing 'md-content' (MkDocs Material — the wiki's framework).
  const candidates = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*md-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*role="main"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  for (const re of candidates) {
    const m = html.match(re);
    if (m && m[1].length > 200) return m[1];
  }
  return html;
}

function htmlToMarkdown(html: string): string {
  html = extractMainContent(html);
  // Very rough html→markdown that preserves the parts useful to an agent:
  // headings, lists, paragraphs, links, code blocks. Strips tags otherwise.
  let s = html
    // remove scripts/styles
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    // headings
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    // links
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    // lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n")
    // paragraphs / line breaks
    .replace(/<\/?(?:p|br|div)[^>]*>/gi, "\n")
    // inline code
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n")
    // strip the rest of the tags
    .replace(/<[^>]+>/g, "");
  // decode common entities
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // collapse blank lines
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function resolveWikiPath(input: string): string {
  // Accept slugs like "all-features" or "all-features/timers", or full
  // wiki URLs / paths.
  let path = input.trim();
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return WIKI_BASE + path;
  if (!path.startsWith("gdevelop5/")) path = "gdevelop5/" + path;
  return `${WIKI_BASE}/${path}/`;
}

const MAX_REDIRECTS = 5;

function extractMetaRefresh(html: string): string | null {
  const m = html.match(
    /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)/i,
  );
  return m ? m[1] : null;
}

function joinUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}

export async function fetchWikiPage(input: string): Promise<WikiFetchResult> {
  let url = resolveWikiPath(input);
  let res: Response | null = null;
  let html = "";
  let redirects = 0;
  while (redirects <= MAX_REDIRECTS) {
    res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Wiki returned ${res.status} for ${url}`);
    }
    html = await res.text();
    const refresh = extractMetaRefresh(html);
    if (!refresh) break;
    url = joinUrl(url, refresh);
    redirects++;
  }

  const md = htmlToMarkdown(html);
  const truncated = md.length > MAX_BYTES;
  return {
    url,
    status: res!.status,
    truncated,
    markdown: truncated ? md.slice(0, MAX_BYTES) + "\n…(truncated)" : md,
  };
}
