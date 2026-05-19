const DEFAULT_REPO = "4ian/GDevelop";
const ALLOWED_REPOS = new Set([
  "4ian/GDevelop",
  "GDevelopApp/GDevelop-examples",
]);
const MAX_FILE_BYTES = 500_000;

export type GitHubDirEntry = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
};

type GitHubContentsItem = {
  name: string;
  path: string;
  type: string;
  size: number;
};

function sanitizePath(path: string): string {
  const cleaned = path.replace(/^\/+/, "").replace(/\.\.+/g, "");
  if (cleaned !== path.replace(/^\/+/, "")) {
    throw new Error(`Invalid path (contains ".."): ${path}`);
  }
  return cleaned;
}

export async function fetchGitHubPath(
  path: string,
  ref: string = "master",
  repo: string = DEFAULT_REPO,
): Promise<
  | { kind: "directory"; entries: GitHubDirEntry[] }
  | { kind: "file"; size: number; truncated: boolean; content: string }
> {
  if (!ALLOWED_REPOS.has(repo)) {
    throw new Error(
      `Repo "${repo}" is not in the allowed list. Allowed: ${[...ALLOWED_REPOS].join(", ")}`,
    );
  }
  const cleanPath = sanitizePath(path);
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${encodeURI(cleanPath)}?ref=${encodeURIComponent(ref)}`;

  const apiRes = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });
  if (!apiRes.ok) {
    throw new Error(
      `GitHub API error (${apiRes.status}) for ${repo}/${cleanPath}@${ref}: ${apiRes.statusText}`,
    );
  }
  const data = (await apiRes.json()) as GitHubContentsItem | GitHubContentsItem[];

  if (Array.isArray(data)) {
    return {
      kind: "directory",
      entries: data.map((e) => ({
        name: e.name,
        path: e.path,
        type: e.type as GitHubDirEntry["type"],
        size: e.size,
      })),
    };
  }

  const size = data.size;
  const rawUrl = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${encodeURI(cleanPath)}`;
  const rawRes = await fetch(rawUrl);
  if (!rawRes.ok) {
    throw new Error(
      `Raw fetch error (${rawRes.status}) for ${repo}/${cleanPath}@${ref}: ${rawRes.statusText}`,
    );
  }
  const text = await rawRes.text();
  const truncated = text.length > MAX_FILE_BYTES;
  return {
    kind: "file",
    size,
    truncated,
    content: truncated ? text.slice(0, MAX_FILE_BYTES) : text,
  };
}
