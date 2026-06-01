import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const registryPath = "src/features/shell/discovery/discovery-entries.json";
const validCategories = new Set([
  "Getting started",
  "Chat modes",
  "Library",
  "Agents",
  "Media",
  "Settings",
  "Advanced",
  "Help",
]);
const validCoverage = new Set(["core", "advanced", "experimental", "needs-polish"]);
const validPanels = new Set([
  "characters",
  "lorebooks",
  "presets",
  "connections",
  "agents",
  "personas",
  "settings",
  "bot-browser",
  "discover",
]);
const coreSurfaceIds = [
  "conversation-mode",
  "roleplay-mode",
  "game-mode",
  "characters",
  "personas",
  "lorebooks",
  "presets",
  "connections",
  "agents",
  "settings",
  "imports",
  "bot-browser",
  "professor-mari",
];
const discoveryMetadataPaths = ["src/features/shell/discovery/"];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateAction(action, entryId, index) {
  const path = `${entryId}.actions[${index}]`;
  const errors = [];
  if (!action || typeof action !== "object" || Array.isArray(action)) return [`${path} must be an object.`];
  if (action.label !== undefined && action.label !== null && !hasText(action.label)) {
    errors.push(`${path}.label must be non-empty.`);
  }

  switch (action.type) {
    case "open-panel":
      if (!hasText(action.panel) || !validPanels.has(action.panel)) {
        errors.push(`${path}.panel must target a known right panel.`);
      }
      break;
    case "open-settings":
      if (!hasText(action.tab)) errors.push(`${path}.tab must be non-empty.`);
      break;
    case "replay-onboarding":
    case "open-professor-mari":
    case "go-home":
      break;
    default:
      errors.push(`${path}.type must be a supported discovery action.`);
      break;
  }

  return errors;
}

function validateRegistry(entries) {
  const errors = [];
  const ids = new Set();
  const coreIds = new Set();

  if (!Array.isArray(entries)) return ["Discovery registry must be a JSON array."];

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`Entry ${index} must be an object.`);
      return;
    }

    const id = hasText(entry.id) ? entry.id.trim() : "";
    if (!id) {
      errors.push(`Entry ${index} is missing id.`);
    } else if (ids.has(id)) {
      errors.push(`Duplicate discovery id: ${id}.`);
    } else {
      ids.add(id);
    }

    for (const key of ["title", "summary", "audience", "where"]) {
      if (!hasText(entry[key])) errors.push(`${id || `Entry ${index}`}.${key} must be non-empty.`);
    }

    if (!hasText(entry.category) || !validCategories.has(entry.category)) {
      errors.push(`${id || `Entry ${index}`}.category must be a valid discovery category.`);
    }

    if (!hasText(entry.coverage) || !validCoverage.has(entry.coverage)) {
      errors.push(`${id || `Entry ${index}`}.coverage must be a valid coverage value.`);
    } else if (entry.coverage === "core" && id) {
      coreIds.add(id);
    }

    if (!Array.isArray(entry.keywords) || entry.keywords.length === 0) {
      errors.push(`${id || `Entry ${index}`}.keywords must include at least one keyword.`);
    } else {
      entry.keywords.forEach((keyword, keywordIndex) => {
        if (!hasText(keyword)) errors.push(`${id || `Entry ${index}`}.keywords[${keywordIndex}] must be non-empty.`);
      });
    }

    if (!Array.isArray(entry.actions)) {
      errors.push(`${id || `Entry ${index}`}.actions must be an array.`);
    } else {
      entry.actions.forEach((action, actionIndex) => errors.push(...validateAction(action, id || `Entry ${index}`, actionIndex)));
    }
  });

  for (const coreId of coreSurfaceIds) {
    if (!coreIds.has(coreId)) errors.push(`Core discovery surface is missing or not marked core: ${coreId}.`);
  }

  return errors;
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function gitChangedFiles(base) {
  const output = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter(Boolean);
}

function isDiscoveryMetadataPath(path) {
  return discoveryMetadataPaths.some((prefix) => path.startsWith(prefix));
}

function isLikelyUserFacingPath(path) {
  if (isDiscoveryMetadataPath(path)) return false;
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)) return false;
  if (path.startsWith("docs/") || path.startsWith("skills/") || path.startsWith("scripts/")) return false;
  if (path.startsWith(".github/") || path === "AGENTS.md" || path === "CONTRIBUTING.md" || path === "README.md") return false;

  return (
    path.startsWith("src/app/") ||
    path.startsWith("src/features/") ||
    path.startsWith("src/shared/components/") ||
    path.startsWith("src/shared/stores/ui") ||
    path.startsWith("src/styles/") ||
    path.startsWith("public/")
  );
}

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const errors = validateRegistry(registry);
if (errors.length > 0) {
  console.error("Discovery metadata check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const prAware = process.argv.includes("--pr-aware");
const changedFrom = getArgValue("--changed-from") ?? (prAware ? `origin/${process.env.GITHUB_BASE_REF || "refactor"}` : undefined);

if (changedFrom) {
  const changed = gitChangedFiles(changedFrom);
  const userFacing = changed.filter(isLikelyUserFacingPath);
  const discoveryTouched = changed.some(isDiscoveryMetadataPath);
  if (userFacing.length > 0 && !discoveryTouched && process.env.DISCOVERY_CHECK_ALLOW_MISSING !== "1") {
    console.error(
      `Discovery metadata was not updated, but ${userFacing.length} likely user-facing file(s) changed relative to ${changedFrom}.`,
    );
    for (const path of userFacing.slice(0, 12)) console.error(`- ${path}`);
    console.error("Update src/features/shell/discovery/ or rerun with DISCOVERY_CHECK_ALLOW_MISSING=1 for an intentional N/A.");
    process.exit(1);
  }
  console.log(`Checked ${registry.length} discovery entries and ${changed.length} changed file(s).`);
} else {
  console.log(`Checked ${registry.length} discovery entries.`);
}
