interface GitTreeEntry {
  path: string;
  type: "blob" | "tree";
}

interface GitTreeResponse {
  tree: GitTreeEntry[];
}

const GITHUB_API_TREE_URL =
  "https://api.github.com/repos/github/gitignore/git/trees/main?recursive=1";
const RAW_BASE_URL = "https://raw.githubusercontent.com/github/gitignore/main";
const ROOT_TEMPLATE_PATTERN = /^[^/]+\.gitignore$/;
const GLOBAL_TEMPLATE_PATTERN = /^Global\/.+\.gitignore$/;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ignore-hub"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

export async function fetchTemplatePaths(): Promise<string[]> {
  const payload = await fetchJson<GitTreeResponse>(GITHUB_API_TREE_URL);

  return payload.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter(
      (path) => ROOT_TEMPLATE_PATTERN.test(path) || GLOBAL_TEMPLATE_PATTERN.test(path)
    )
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export async function fetchTemplateSource(path: string): Promise<string> {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const url = `${RAW_BASE_URL}/${encodedPath}`;
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "ignore-hub"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch template ${path} (${response.status})`);
  }

  return response.text();
}
