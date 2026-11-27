import type { ProfessorMariContextResourceKind } from "@marinara-engine/shared";
import type { SettingsSectionId, SettingsTabId } from "./settings-registry";

// The settings registry owns these. Re-exported under the old name so the many
// existing `ProfessorMariSettingsTab` references keep working.
export type ProfessorMariSettingsTab = SettingsTabId;
export type ProfessorMariNavigationResourceKind = Extract<
  ProfessorMariContextResourceKind,
  "character" | "persona" | "preset" | "lorebook" | "agent"
>;

export type ProfessorMariNavigationTarget =
  | { kind: "home" }
  | { kind: "professor" }
  | { kind: "chats" }
  | { kind: "chat"; chatId: string }
  | {
      kind: "panel";
      /** "profiles", "regex", "tools": Library pages (the classic layout's Presets panel holds them). */
      panel:
        | "characters"
        | "personas"
        | "lorebooks"
        | "presets"
        | "profiles"
        | "regex"
        | "tools"
        | "assets"
        | "rulesets"
        | "backgrounds"
        | "connections"
        | "agents"
        | "extensions";
    }
  | { kind: "settings"; tab: ProfessorMariSettingsTab; controlId?: string; sectionId?: SettingsSectionId }
  | {
      kind: "surface";
      surface:
        | "card-downloads"
        | "lorebook-downloads"
        | "character-library"
        | "persona-library"
        | "lorebook-library"
        | "agent-catalog"
        | "game-assets"
        | "schedules"
        | "prompt-viewer";
    }
  | {
      kind: "window";
      window: "discord" | "support" | "documentation" | "faq" | "widgets" | "tutorial" | "credits";
    }
  /** `entryId` opens a lorebook at that entry. */
  | { kind: "resource"; resource: ProfessorMariNavigationResourceKind; id: string; entryId?: string }
  | { kind: "package"; packageId: string };

export interface ProfessorMariBrowserTab {
  id: string;
  label: string;
  aliases?: string[];
}

export interface ProfessorMariNavigationResource {
  kind: ProfessorMariNavigationResourceKind;
  id: string;
  name: string;
  aliases?: string[];
  /** Bounded display metadata used for local discovery, never prompt context. */
  searchText?: readonly string[];
}

export interface ProfessorMariNavigationChat {
  id: string;
  name: string;
}

export function normalizeProfessorMariNavigationQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
