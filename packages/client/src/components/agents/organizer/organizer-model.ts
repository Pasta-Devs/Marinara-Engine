import {
  CAPABILITY_STORE_SECTIONS,
  compareCapabilityPackageVersions,
  type CapabilityStoreSection,
  type InstalledCapabilityPackage,
  type StampedCapabilityCatalogPackage,
} from "@marinara-engine/shared";
import { isAppCapabilityPackage } from "../../../hooks/use-capability-packages";
import { capabilityPackageAssetUrl } from "../../../lib/capability-package-assets";

export type OrganizerEntry = StampedCapabilityCatalogPackage;

/** "more" holds catalog entries without store data (custom catalogs, older Agents builds). */
export type OrganizerSectionId = CapabilityStoreSection | "more";
export const ORGANIZER_SECTIONS: readonly OrganizerSectionId[] = [...CAPABILITY_STORE_SECTIONS, "more"];

export type OrganizerPage =
  | { kind: "home" }
  | { kind: "updates" }
  | { kind: "installed" }
  | { kind: "section"; id: OrganizerSectionId }
  | { kind: "agent"; id: string };

export function sectionOf(entry: OrganizerEntry): OrganizerSectionId {
  if (entry.store) return entry.store.section;
  if (isAppCapabilityPackage(entry.manifest)) return "apps";
  if (entry.category === "writer") return "writing";
  if (entry.category === "tracker") return "trackers";
  return "more";
}

export const sectionLabelKey = (id: OrganizerSectionId) => `ui.agents.organizer.sections.${id}.title`;
export const sectionHintKey = (id: OrganizerSectionId) => `ui.agents.organizer.sections.${id}.hint`;

export type OrganizerType = "app" | "game" | "rules" | "experience" | "agent";

export function typeOf(entry: OrganizerEntry): OrganizerType {
  const { manifest } = entry;
  if (isAppCapabilityPackage(manifest)) return "app";
  if (manifest.kind.includes("ruleset")) return "rules";
  if (manifest.kind.includes("experience")) return "experience";
  if (manifest.kind.includes("turn-game") || entry.store?.section === "games") return "game";
  return "agent";
}

export const typeLabelKey = (type: OrganizerType) => `ui.agents.organizer.types.${type}`;

/** The short line on rows and cards: the store tagline, else the first sentence of the description. */
export function taglineOf(entry: OrganizerEntry): string {
  if (entry.store?.tagline) return entry.store.tagline;
  const sentence = entry.manifest.description.split(/(?<=\.)\s/)[0] ?? "";
  return sentence.length > 90 ? `${sentence.slice(0, 89)}…` : sentence;
}

/** The store logo first; an installed app without one shows its Home tab icon, then the cover. */
export function iconOf(entry: OrganizerEntry, installed?: InstalledCapabilityPackage): string | undefined {
  if (entry.store?.iconUrl) return entry.store.iconUrl;
  const tabIcon = installed?.manifest.contributions?.homeBrowserTab?.iconPaths?.[0];
  if (installed && tabIcon && isAppCapabilityPackage(installed.manifest)) {
    return capabilityPackageAssetUrl(installed.id, installed.version, tabIcon);
  }
  return entry.iconUrl;
}

/** Why an installed package needs a look (may be empty), or null when it runs fine. */
export function checkReasonOf(installed?: InstalledCapabilityPackage): string | null {
  // Start errors are runtime text for developers; readiness errors are written for users.
  if (installed?.status === "error") return "";
  if (installed?.readiness === "error") return installed.readinessError ?? "";
  return null;
}

export function hasUpdate(entry: OrganizerEntry, installed?: InstalledCapabilityPackage): boolean {
  return Boolean(installed && compareCapabilityPackageVersions(entry.manifest.version, installed.version) > 0);
}

/** Featured order from the store; packages without one never appear on the Featured row. */
export function featuredEntries(entries: readonly OrganizerEntry[]): OrganizerEntry[] {
  return entries
    .filter((entry) => entry.store?.featured)
    .sort((left, right) => left.store!.featured! - right.store!.featured!);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export type CatalogMode = "conversation" | "roleplay" | "game";

const OFFICIAL_PACKAGE_MODES: Readonly<Record<string, readonly CatalogMode[]>> = Object.freeze({
  beholder: ["roleplay"],
  "card-evolution-auditor": ["roleplay"],
  continuity: ["roleplay"],
  "knowledge-retrieval": ["roleplay"],
  "knowledge-router": ["roleplay"],
  director: ["roleplay"],
  "prose-guardian": ["roleplay"],
  background: ["roleplay"],
  "character-tracker": ["roleplay"],
  "custom-tracker": ["roleplay"],
  "inventory-tracker": ["roleplay"],
  quartermaster: ["roleplay"],
  "relationship-tracker": ["roleplay"],
  "memory-nag": ["roleplay"],
  "long-term-memory": ["conversation", "roleplay", "game"],
  expression: ["roleplay"],
  "gacha-forge": ["conversation", "roleplay", "game"],
  "hierarchical-maps": ["roleplay", "game"],
  "persona-stats": ["roleplay"],
  quest: ["roleplay"],
  "world-state": ["roleplay"],
  "2d-avatars": ["roleplay", "game"],
  "3d-avatars": ["roleplay", "game"],
  eightball: ["conversation"],
  chess: ["conversation"],
  combat: ["roleplay"],
  "conversation-calls": ["conversation"],
  cyoa: ["roleplay"],
  "echo-chamber": ["roleplay"],
  haptic: ["conversation", "roleplay", "game"],
  illustrator: ["conversation", "roleplay", "game"],
  storyboard: ["roleplay", "game"],
  html: ["roleplay"],
  "lorebook-keeper": ["roleplay", "game"],
  noodle: ["conversation", "roleplay", "game"],
  slurp: ["conversation", "roleplay", "game"],
  spotify: ["conversation", "roleplay", "game"],
  poker: ["conversation"],
  "rock-paper-scissors": ["conversation"],
  "ruleset-5e-2014": ["game"],
  "tic-tac-toe": ["conversation"],
  uno: ["conversation"],
});

export const MODE_BADGES: Record<CatalogMode, { labelKey: string; className: string }> = {
  conversation: {
    labelKey: "ui.agents.agentcatalogview.conversationMode",
    className:
      "border-[color-mix(in_srgb,var(--mari-logo-cyan)_55%,var(--border))] bg-[color-mix(in_srgb,var(--mari-logo-cyan)_18%,transparent)]",
  },
  roleplay: {
    labelKey: "ui.agents.agentcatalogview.roleplayMode",
    className:
      "border-[color-mix(in_srgb,var(--mari-logo-orange)_55%,var(--border))] bg-[color-mix(in_srgb,var(--mari-logo-orange)_18%,transparent)]",
  },
  game: {
    labelKey: "ui.agents.agentcatalogview.gameMode",
    className:
      "border-[color-mix(in_srgb,var(--marinara-chat-chrome-accent)_55%,var(--border))] bg-[color-mix(in_srgb,var(--marinara-chat-chrome-accent)_18%,transparent)]",
  },
};

export function packageModes(packageId: string): readonly CatalogMode[] {
  return OFFICIAL_PACKAGE_MODES[packageId] ?? [];
}
