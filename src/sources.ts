// URL builders and constants for roadmap.sh + the open-source developer-roadmap repo.
export const ROADMAP_BASE = "https://roadmap.sh";

// Validate operator-supplied env values at load time. Without this, a crafted
// ROADMAPSH_OWNER/ROADMAPSH_BRANCH (e.g. "../../other-repo" or "x/@host") could
// inject path segments into the GitHub URLs the server fetches. Fail fast.
function safeEnv(name: string, fallback: string, re: RegExp): string {
  const value = process.env[name] ?? fallback;
  if (!re.test(value)) {
    throw new Error(`Invalid ${name}=${JSON.stringify(value)}: must match ${re}`);
  }
  return value;
}

// The developer-roadmap repo moved from kamranahmedse to nilbuild (2026). The
// GitHub API follows the rename redirect, but raw.githubusercontent.com does not,
// so the current owner must be used directly. Override via ROADMAPSH_OWNER.
export const GH_OWNER = safeEnv("ROADMAPSH_OWNER", "nilbuild", /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
export const GH_REPO = "developer-roadmap";
// Branch names may contain slashes (e.g. "feature/x"), but no path-traversal dots.
export const GH_BRANCH = safeEnv("ROADMAPSH_BRANCH", "master", /^[A-Za-z0-9][A-Za-z0-9._/-]*$/);
export const GH_RAW = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}`;
export const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;

export type DataType = "roadmaps" | "best-practices" | "question-groups" | "projects" | "videos";

export const dataDir = (type: DataType): string => `src/data/${type}`;

// S1: the rendered roadmap graph served by roadmap.sh itself.
export const roadmapGraphUrl = (slug: string): string => `${ROADMAP_BASE}/${encodeURIComponent(slug)}.json`;

// S3: GitHub contents API (directory listing).
export const ghContentsUrl = (path: string): string => `${GH_API}/contents/${path}`;

// S2: raw file from the repo.
export const ghRawUrl = (path: string): string => `${GH_RAW}/${path}`;

// Folder-based data types (roadmaps, best-practices): {type}/{slug}/{slug}.json|md + content/
export const folderGraphRawUrl = (type: DataType, slug: string): string =>
  ghRawUrl(`${dataDir(type)}/${slug}/${slug}.json`);
export const folderMetaRawUrl = (type: DataType, slug: string): string =>
  ghRawUrl(`${dataDir(type)}/${slug}/${slug}.md`);
export const folderContentDirPath = (type: DataType, slug: string): string =>
  `${dataDir(type)}/${slug}/content`;

// Flat .md data types (projects, videos): {type}/{slug}.md
export const flatMdRawUrl = (type: DataType, slug: string): string =>
  ghRawUrl(`${dataDir(type)}/${slug}.md`);
