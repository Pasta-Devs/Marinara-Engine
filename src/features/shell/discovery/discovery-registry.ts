import rawDiscoveryEntries from "./discovery-entries.json";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_COVERAGE,
  type DiscoveryAction,
  type DiscoveryCategory,
  type DiscoveryCoverage,
  type DiscoveryEntry,
  type DiscoveryPanelTarget,
} from "./discovery-types";

export const DISCOVERY_CORE_SURFACE_IDS = [
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
] as const;

const DISCOVERY_PANEL_TARGETS = [
  "characters",
  "lorebooks",
  "presets",
  "connections",
  "agents",
  "personas",
  "settings",
  "bot-browser",
  "discover",
] as const satisfies readonly DiscoveryPanelTarget[];

const categorySet = new Set<string>(DISCOVERY_CATEGORIES);
const coverageSet = new Set<string>(DISCOVERY_COVERAGE);
const panelTargetSet = new Set<string>(DISCOVERY_PANEL_TARGETS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDiscoveryAction(action: unknown, entryId: string, index: number): string[] {
  const path = `${entryId}.actions[${index}]`;
  if (!isPlainObject(action)) return [`${path} must be an object.`];
  const type = action.type;
  const panel = action.panel;
  const tab = action.tab;
  const errors: string[] = [];
  if (action.label !== undefined && action.label !== null && !hasText(action.label)) {
    errors.push(`${path}.label must be non-empty.`);
  }

  switch (type) {
    case "open-panel":
      if (!hasText(panel) || !panelTargetSet.has(panel)) {
        errors.push(`${path}.panel must target a known right panel.`);
      }
      break;
    case "open-settings":
      if (!hasText(tab)) errors.push(`${path}.tab must be non-empty.`);
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

export function validateDiscoveryEntries(entries: readonly unknown[] = rawDiscoveryEntries): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const coreIds = new Set<string>();

  entries.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`Entry ${index} must be an object.`);
      return;
    }

    const rawId = entry.id;
    const id = hasText(rawId) ? rawId.trim() : "";
    if (!id) {
      errors.push(`Entry ${index} is missing id.`);
    } else if (ids.has(id)) {
      errors.push(`Duplicate discovery id: ${id}.`);
    } else {
      ids.add(id);
    }

    for (const key of ["title", "summary", "audience", "where"] as const) {
      if (!hasText(entry[key])) errors.push(`${id || `Entry ${index}`}.${key} must be non-empty.`);
    }

    const category = entry.category;
    if (!hasText(category) || !categorySet.has(category)) {
      errors.push(`${id || `Entry ${index}`}.category must be a valid discovery category.`);
    }

    const coverage = entry.coverage;
    if (!hasText(coverage) || !coverageSet.has(coverage)) {
      errors.push(`${id || `Entry ${index}`}.coverage must be a valid coverage value.`);
    } else if (coverage === "core" && id) {
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
      entry.actions.forEach((action, actionIndex) => {
        errors.push(...validateDiscoveryAction(action, id || `Entry ${index}`, actionIndex));
      });
    }
  });

  for (const coreId of DISCOVERY_CORE_SURFACE_IDS) {
    if (!coreIds.has(coreId)) errors.push(`Core discovery surface is missing or not marked core: ${coreId}.`);
  }

  return errors;
}

export const DISCOVERY_ENTRIES = rawDiscoveryEntries as DiscoveryEntry[];

export type {
  DiscoveryAction,
  DiscoveryCategory,
  DiscoveryCoverage,
  DiscoveryEntry,
  DiscoveryPanelTarget,
};
