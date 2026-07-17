// ──────────────────────────────────────────────
// Routes: In-app documentation (serves docs/*.md)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { logger } from "../lib/logger.js";
import { existsSync } from "fs";
import { readdir, readFile, realpath, stat } from "fs/promises";
import { join, resolve } from "path";
import { getMonorepoRoot } from "../config/runtime-config.js";
import { assertInsideDir } from "../utils/security.js";

const DOCS_DIR = resolve(getMonorepoRoot(), "docs");

/** Internal artifact folders that are not user documentation */
const EXCLUDED_DIRS = new Set(["evidence", "pr-evidence", "screenshots", "examples"]);

/** Max markdown file size served: 5 MB (real docs are well under 100 KB) */
const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** Root-level docs pinned to the top of the index, in this order */
const PINNED_DOCS = ["FAQ.md", "INSTALLATION.md", "UPGRADING.md", "CONFIGURATION.md", "TROUBLESHOOTING.md"];

/**
 * Category folders in browse order: new-user flow first (getting started,
 * install, connect a provider, then the three chat modes side by side),
 * reference material later, developer docs last. Folders missing from this
 * list sort alphabetically after the listed ones, so a new category still
 * shows up without a code change.
 */
const DIR_ORDER = [
  "home",
  "installation",
  "connections",
  "conversation",
  "roleplay",
  "game",
  "characters",
  "chats",
  "lorebooks",
  "agents",
  "media",
  "prompts",
  "noodle",
  "appearance",
  "settings",
  "data",
  "extending",
  "integrations",
  "development",
];

/**
 * Reading order inside each category folder: overview and getting-started
 * guides first, then task guides, then reference. Files missing from a list
 * sort alphabetically after the listed ones.
 */
const DOC_ORDER: Record<string, string[]> = {
  home: ["welcome.md", "tutorial.md", "professor-mari.md", "achievements.md"],
  installation: ["windows.md", "macos-linux.md", "containers.md", "android-termux.md", "ios-pwa.md"],
  connections: [
    "connecting-to-a-provider.md",
    "providers-reference.md",
    "subscription-clis.md",
    "local-self-hosted.md",
    "local-model.md",
    "organizing-connections.md",
  ],
  conversation: [
    "getting-started.md",
    "profiles.md",
    "schedules.md",
    "calls.md",
    "selfies.md",
    "emoji-stickers-gifs.md",
    "table-games.md",
  ],
  roleplay: [
    "getting-started.md",
    "backgrounds.md",
    "hud-and-trackers.md",
    "combat-encounters.md",
    "narrative-director.md",
    "scenes.md",
  ],
  game: [
    "getting-started.md",
    "combat.md",
    "party-and-npcs.md",
    "sessions-and-saves.md",
    "map-time-weather.md",
    "dice-and-skill-checks.md",
    "hud-widgets.md",
    "game-assets.md",
    "storyboard.md",
  ],
  characters: [
    "creating-and-editing-characters.md",
    "personas.md",
    "choosing-your-persona.md",
    "sprites.md",
    "galleries.md",
    "library-organization.md",
    "colors-and-stats.md",
    "import-export.md",
    "bot-browser.md",
  ],
  chats: [
    "managing-chats.md",
    "sending-and-streaming.md",
    "messages.md",
    "branches.md",
    "guided-and-impersonate.md",
    "peek-prompt.md",
    "chat-settings.md",
    "slash-commands.md",
    "group-chats.md",
    "connected-chats.md",
    "export-import.md",
  ],
  lorebooks: [
    "overview.md",
    "entries.md",
    "token-budgets.md",
    "semantic-search.md",
    "linking-to-characters.md",
    "import-export.md",
  ],
  agents: [
    "agents-overview.md",
    "built-in-agents.md",
    "custom-agents.md",
    "knowledge-sources.md",
    "memory.md",
    "approvals-and-agent-suite.md",
  ],
  media: [
    "image-providers.md",
    "comfyui.md",
    "style-profiles.md",
    "illustrator-agent.md",
    "scene-backgrounds.md",
    "scene-video.md",
    "animated-expressions.md",
    "tts-setup.md",
    "music.md",
  ],
  prompts: [
    "presets.md",
    "preset-variables.md",
    "macros.md",
    "conditional-prompts.md",
    "generation-parameters.md",
    "chat-settings-presets.md",
    "prompt-overrides.md",
  ],
  noodle: ["overview.md", "settings.md"],
  appearance: ["appearance-settings.md", "fonts.md", "chat-backgrounds.md", "custom-css-themes.md", "card-css-theming.md"],
  data: ["importing-from-sillytavern.md", "backup-and-restore.md", "where-data-is-stored.md", "clearing-data.md"],
  extending: ["regex-scripts.md", "custom-tools.md", "extensions.md"],
  integrations: ["home-assistant.md", "discord-mirror.md", "message-translation.md", "haptic-feedback.md"],
  development: [
    "architecture-map.md",
    "frontend.md",
    "file-storage.md",
    "noodle-internals.md",
    "writing-extensions.md",
    "ios-pwa-safe-area.md",
  ],
};

interface DocSummary {
  /** Path relative to the docs folder, forward slashes (e.g. "installation/windows.md") */
  path: string;
  /** First `# ` heading in the file, or the filename when no heading exists */
  title: string;
  /** Subfolder relative to docs ("" for root-level guides) */
  dir: string;
  /** File modification time (ISO). Reflects install/update time on fresh clones. */
  updatedAt: string;
}

interface DocSearchSnippet {
  line: number;
  text: string;
}

interface DocSearchResult extends DocSummary {
  matches: number;
  snippets: DocSearchSnippet[];
}

/** Max snippet lines returned per document */
const MAX_SNIPPETS_PER_DOC = 3;

/**
 * Trim a matched line to a readable snippet. The sidebar only shows the first
 * ~40 characters, so window the slice to keep the matched term near the start.
 */
function toSnippet(line: string, matchIndex: number): string {
  const leading = line.length - line.trimStart().length;
  const trimmed = line.trim();
  const index = Math.max(0, matchIndex - leading);
  const start = index <= 30 ? 0 : index - 30;
  const slice = trimmed.slice(start, start + 160);
  return `${start > 0 ? "…" : ""}${slice}${start + 160 < trimmed.length ? "…" : ""}`;
}

function isSafeSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0")
  );
}

async function assertRealDocsPath(candidatePath: string): Promise<string> {
  const [root, candidate] = await Promise.all([realpath(DOCS_DIR), realpath(candidatePath)]);
  return assertInsideDir(root, candidate);
}

async function extractTitle(filePath: string, fallback: string): Promise<string> {
  try {
    const head = (await readFile(filePath, "utf8")).slice(0, 4096);
    return head.match(/^#\s+(.+?)\s*$/m)?.[1] ?? fallback;
  } catch {
    return fallback;
  }
}

async function collectDocs(dir: string, relativeDir: string): Promise<DocSummary[]> {
  const docs: DocSummary[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (relativeDir === "" && EXCLUDED_DIRS.has(entry.name)) continue;
      const childRelative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      docs.push(...(await collectDocs(join(dir, entry.name), childRelative)));
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const filePath = join(dir, entry.name);
    try {
      docs.push({
        path: relativePath,
        title: await extractTitle(filePath, entry.name.replace(/\.md$/i, "")),
        dir: relativeDir,
        updatedAt: (await stat(filePath)).mtime.toISOString(),
      });
    } catch {
      // File vanished between readdir and stat; skip it rather than failing the whole index.
    }
  }

  return docs;
}

/** Position of `value` in `list`; unlisted values sort after every listed one. */
function rankIn(list: string[] | undefined, value: string): number {
  const index = list ? list.indexOf(value) : -1;
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

// Root-level guides first (pinned ones ahead of the rest), then category
// folders in DIR_ORDER, each folder's docs in DOC_ORDER reading order.
// Alphabetical fallbacks keep unlisted folders and files browsable.
function docSortKey(doc: DocSummary): [number, number, string, number, string] {
  if (doc.dir === "") {
    return [0, rankIn(PINNED_DOCS, doc.path), "", 0, doc.path];
  }
  const fileName = doc.path.slice(doc.dir.length + 1);
  return [1, rankIn(DIR_ORDER, doc.dir), doc.dir, rankIn(DOC_ORDER[doc.dir], fileName), fileName];
}

export async function docsRoutes(app: FastifyInstance) {
  /** List available documentation files plus the on-disk docs folder path */
  app.get("/", async (_req, reply) => {
    if (!existsSync(DOCS_DIR)) {
      return reply.status(404).send({ error: "Documentation folder not found" });
    }
    try {
      const docs = await collectDocs(DOCS_DIR, "");
      docs.sort((a, b) => {
        const ka = docSortKey(a);
        const kb = docSortKey(b);
        return (
          ka[0] - kb[0] ||
          ka[1] - kb[1] ||
          ka[2].localeCompare(kb[2]) ||
          ka[3] - kb[3] ||
          ka[4].localeCompare(kb[4])
        );
      });
      return { root: DOCS_DIR, docs };
    } catch (err) {
      logger.error(err, "Failed to list documentation files");
      return reply.status(500).send({ error: "Failed to list documentation files" });
    }
  });

  /** Full-text search across all documentation files (case-insensitive substring) */
  app.get("/search", async (req, reply) => {
    const { q } = req.query as { q?: string };
    const query = typeof q === "string" ? q.trim().slice(0, 200) : "";
    if (query.length < 2) {
      return reply.status(400).send({ error: "Query must be at least 2 characters" });
    }
    if (!existsSync(DOCS_DIR)) {
      return reply.status(404).send({ error: "Documentation folder not found" });
    }

    try {
      const needle = query.toLowerCase();
      const results: DocSearchResult[] = [];

      for (const doc of await collectDocs(DOCS_DIR, "")) {
        let content: string;
        try {
          const filePath = join(DOCS_DIR, ...doc.path.split("/"));
          if ((await stat(filePath)).size > MAX_DOC_BYTES) continue;
          content = await readFile(filePath, "utf8");
        } catch {
          continue;
        }
        const snippets: DocSearchSnippet[] = [];
        let matches = 0;

        content.split(/\r?\n/).forEach((line, index) => {
          const matchIndex = line.toLowerCase().indexOf(needle);
          if (matchIndex === -1) return;
          matches++;
          if (snippets.length < MAX_SNIPPETS_PER_DOC) {
            snippets.push({ line: index + 1, text: toSnippet(line, matchIndex) });
          }
        });

        // Count a title hit only when no content line matched (the H1 the title
        // came from is already counted by the line scan).
        if (matches === 0 && doc.title.toLowerCase().includes(needle)) matches = 1;

        if (matches > 0) results.push({ ...doc, matches, snippets });
      }

      results.sort((a, b) => b.matches - a.matches || a.path.localeCompare(b.path));
      return { query, results };
    } catch (err) {
      logger.error(err, "Failed to search documentation files");
      return reply.status(500).send({ error: "Failed to search documentation files" });
    }
  });

  /** Serve a single markdown file from the docs folder */
  app.get("/content", async (req, reply) => {
    const { path: docPath } = req.query as { path?: string };
    if (!docPath || typeof docPath !== "string") {
      return reply.status(400).send({ error: "Missing path" });
    }

    const segments = docPath.split("/");
    const filename = segments[segments.length - 1];
    if (!segments.every(isSafeSegment) || !filename || !filename.toLowerCase().endsWith(".md")) {
      return reply.status(400).send({ error: "Invalid path" });
    }
    // Lowercase so the exclusion can't be bypassed on case-insensitive filesystems
    if (segments[0] && EXCLUDED_DIRS.has(segments[0].toLowerCase())) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    let filePath: string;
    try {
      const candidatePath = assertInsideDir(DOCS_DIR, join(DOCS_DIR, ...segments));
      if (!existsSync(candidatePath)) {
        return reply.status(404).send({ error: "Not found" });
      }
      filePath = await assertRealDocsPath(candidatePath);
    } catch {
      return reply.status(400).send({ error: "Invalid path" });
    }

    try {
      const info = await stat(filePath);
      if (!info.isFile() || info.size > MAX_DOC_BYTES) {
        return reply.status(400).send({ error: "Invalid path" });
      }
      const content = await readFile(filePath, "utf8");
      const title = content.slice(0, 4096).match(/^#\s+(.+?)\s*$/m)?.[1] ?? filename;
      return { path: docPath, title, content, updatedAt: info.mtime.toISOString() };
    } catch (err) {
      logger.error(err, "Failed to read documentation file");
      return reply.status(500).send({ error: "Failed to read documentation file" });
    }
  });
}
