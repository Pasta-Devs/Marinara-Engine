import { access, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function collectFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

const baseRequiredDocs = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "src/shared/README.md",
  "src/shared/api/README.md",
  "docs/developer/index.html",
  "docs/developer/getting-started.html",
  "docs/developer/run-build.html",
  "docs/developer/architecture.html",
  "docs/developer/modules.html",
  "docs/developer/impact-areas.html",
  "docs/developer/docs.css",
  "docs/developer/shared.js",
];

const expectedSkillFiles = [
  "skills/marinara-architecture-guard/SKILL.md",
  "skills/marinara-mode-separation/SKILL.md",
  "skills/marinara-bugfix-discipline/SKILL.md",
  "skills/marinara-getting-started/SKILL.md",
  "skills/marinara-agent-workflow/SKILL.md",
];

const skillDocs = (await collectFiles("skills")).filter(
  (path) =>
    path.endsWith("/SKILL.md") ||
    path.endsWith("/agents/openai.yaml") ||
    (path.includes("/references/") && path.endsWith(".md")),
);

const requiredDocs = [...new Set([...baseRequiredDocs, ...expectedSkillFiles, ...skillDocs])].sort();

await Promise.all(requiredDocs.map((path) => access(path)));

const htmlDocs = requiredDocs.filter((path) => path.endsWith(".html"));
const htmlByPath = new Map(await Promise.all(htmlDocs.map(async (path) => [path, await readFile(path, "utf8")])));

const expectedLinks = [
  "./index.html",
  "./getting-started.html",
  "./run-build.html",
  "./architecture.html",
  "./modules.html",
  "./impact-areas.html",
];

for (const [path, html] of htmlByPath) {
  for (const link of expectedLinks) {
    if (!html.includes(`href="${link}"`)) {
      throw new Error(`${path} is missing navigation link ${link}.`);
    }
  }

  const assetRefs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of assetRefs) {
    if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("#") || ref.startsWith("mailto:")) {
      continue;
    }

    const target = resolve(dirname(path), ref);
    await access(target);
  }
}

const allHtml = [...htmlByPath.values()].join("\n");
const mermaidBlocks = allHtml.match(/class="mermaid"/g)?.length ?? 0;
if (mermaidBlocks < 6) {
  throw new Error(`Expected at least 6 Mermaid diagrams, found ${mermaidBlocks}.`);
}

const runBuild = htmlByPath.get("docs/developer/run-build.html") ?? "";
for (const command of ["pnpm install", "pnpm tauri dev", "pnpm tauri build", "pnpm docs:dev"]) {
  if (!runBuild.includes(command)) {
    throw new Error(`Run/build docs are missing command: ${command}`);
  }
}

const agents = await readFile("AGENTS.md", "utf8");
if (!agents.includes("pnpm check:docs")) {
  throw new Error("AGENTS.md must include the docs/skills verification command.");
}

for (const skillFile of expectedSkillFiles) {
  const skillText = await readFile(skillFile, "utf8");
  const frontmatter = skillText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    throw new Error(`${skillFile} must declare skill metadata frontmatter.`);
  }

  const name = frontmatter[1]
    .match(/^name:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  const description = frontmatter[1]
    .match(/^description:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  if (!name || !description) {
    throw new Error(`${skillFile} must declare both name and description metadata.`);
  }
  if (description.length < 40) {
    throw new Error(`${skillFile} description metadata is too terse to be discoverable.`);
  }
}

const guidanceDocs = requiredDocs.filter((path) => path.endsWith(".md") || path.endsWith(".html"));
const guidanceByPath = new Map(
  await Promise.all(guidanceDocs.map(async (path) => [path, await readFile(path, "utf8")])),
);
const forbiddenGuidance = [
  {
    snippet: "Engine --> API",
    reason: "engine code must receive capability ports instead of importing shared API adapters",
  },
  {
    snippet: "Final-shape Tauri command wrappers live here once real commands exist.",
    reason: "shared API wrappers are real architecture now, not a future placeholder",
  },
];
for (const [path, text] of guidanceByPath) {
  for (const { snippet, reason } of forbiddenGuidance) {
    if (text.includes(snippet)) {
      throw new Error(`${path} contains stale guidance "${snippet}": ${reason}.`);
    }
  }
}

const sharedApiReadme = guidanceByPath.get("src/shared/api/README.md") ?? "";
if (!sharedApiReadme.includes("Engine code must not import this folder")) {
  throw new Error("src/shared/api/README.md must state the engine/shared API boundary.");
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const expectedDocsDev = "node scripts/run-vite.mjs docs/developer --host 127.0.0.1 --port 4174";
if (packageJson.scripts?.["docs:dev"] !== expectedDocsDev) {
  throw new Error("package.json must expose the expected pnpm docs:dev command.");
}
if (packageJson.scripts?.docs) {
  throw new Error("Do not add a docs script; pnpm docs collides with package documentation behavior.");
}

console.log(`Checked ${requiredDocs.length} docs and repo guidance files.`);
