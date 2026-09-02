// ──────────────────────────────────────────────
// Personal Extension Types
// ──────────────────────────────────────────────

export type PersonalExtensionRuntime = "client" | "server";

export type PersonalExtensionSource = "external" | "local" | "professor_mari" | "legacy" | "profile_import";

export type PersonalExtensionSandboxBackend = "browser-opaque-origin" | "macos-seatbelt" | "linux-bubblewrap";

export const PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY = "full_page_access" as const;
export const PERSONAL_EXTENSION_CAPABILITIES = [
  "read_active_characters",
  "read_active_persona",
  PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY,
] as const;
export type PersonalExtensionCapability = (typeof PERSONAL_EXTENSION_CAPABILITIES)[number];

export function normalizePersonalExtensionCapabilities(value: unknown): PersonalExtensionCapability[] {
  if (!Array.isArray(value)) return [];
  const requested = new Set(value);
  return PERSONAL_EXTENSION_CAPABILITIES.filter((capability) => requested.has(capability));
}

export const PERSONAL_EXTENSION_CONTRIBUTION_KINDS = ["button", "menu-item", "panel"] as const;
export type PersonalExtensionContributionKind = (typeof PERSONAL_EXTENSION_CONTRIBUTION_KINDS)[number];

export const PERSONAL_EXTENSION_CONTRIBUTION_SURFACES = [
  "top-bar",
  "chats",
  "bots",
  "characters",
  "personas",
  "lorebooks",
  "presets",
  "connections",
  "agents",
  "settings",
] as const;
export type PersonalExtensionContributionSurface = (typeof PERSONAL_EXTENSION_CONTRIBUTION_SURFACES)[number];

export const PERSONAL_EXTENSION_CONTRIBUTION_POSITIONS = ["header", "before-content", "after-content"] as const;
export type PersonalExtensionContributionPosition = (typeof PERSONAL_EXTENSION_CONTRIBUTION_POSITIONS)[number];

/** Kebab-case Lucide icon name, resolved by the client icon catalog. */
export type PersonalExtensionContributionIcon = string;

export const PERSONAL_EXTENSION_UI_ELEMENT_KINDS = [
  "heading",
  "text",
  "pre",
  "button",
  "input",
  "select",
  "toggle",
  "slider",
  "color",
  "spacer",
] as const;
export type PersonalExtensionUiElementKind = (typeof PERSONAL_EXTENSION_UI_ELEMENT_KINDS)[number];

export const PERSONAL_EXTENSION_UI_LIMITS = {
  contributionsPerExtension: 24,
  panelElements: 60,
  idLength: 64,
  iconLength: 64,
  labelLength: 80,
  descriptionLength: 240,
  textLength: 8_000,
  totalPanelTextLength: 32_000,
  selectOptions: 100,
} as const;

export type PersonalExtensionUiElement =
  | { kind: "heading" | "text" | "pre"; text: string }
  | { kind: "button"; id: string; label: string }
  | {
      kind: "input";
      id: string;
      label?: string;
      placeholder?: string;
      value?: string;
      multiline?: boolean;
    }
  | {
      kind: "select";
      id: string;
      label?: string;
      value?: string;
      options: Array<{ value: string; label: string }>;
    }
  | { kind: "toggle"; id: string; label: string; checked?: boolean }
  | {
      kind: "slider";
      id: string;
      label?: string;
      min: number;
      max: number;
      step?: number;
      value?: number;
    }
  | { kind: "color"; id: string; label?: string; value?: string }
  | { kind: "spacer" };

export interface PersonalExtensionContributionDescriptor {
  id: string;
  kind: PersonalExtensionContributionKind;
  label: string;
  description?: string;
  icon?: PersonalExtensionContributionIcon;
  /** Button destination. Existing descriptors default to the top bar. */
  surface?: PersonalExtensionContributionSurface;
  /** Safe insertion point for side-panel buttons. */
  position?: PersonalExtensionContributionPosition;
  elements?: PersonalExtensionUiElement[];
}

export interface PersonalExtensionHostContribution extends PersonalExtensionContributionDescriptor {
  key: string;
  extensionId: string;
  extensionName: string;
  contentHash: string;
}

/**
 * Bounded context for the chat currently displayed by the client.
 *
 * Browser Personal Extensions always receive opaque chat/Character IDs for
 * namespacing private storage. Active record snapshots remain empty unless
 * their separately approved capabilities are present. The snapshot contains no
 * messages, full-library data, or authority to read or mutate other records.
 */
export interface PersonalExtensionContextSnapshot {
  chatId: string | null;
  /** Present only when the active chat has exactly one Character. */
  characterId: string | null;
  /** All Characters participating in the active chat, including group chats. */
  characterIds: readonly string[];
  /** Selected Persona ID, present only with read_active_persona. */
  personaId: string | null;
  /** Bounded active-card fields, present only with read_active_characters. */
  characters: readonly PersonalExtensionCharacterSnapshot[];
  /** Bounded active Persona fields, present only with read_active_persona. */
  persona: PersonalExtensionPersonaSnapshot | null;
}

export interface PersonalExtensionCharacterSnapshot {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleDialogue: string;
  creator: string;
  characterVersion: string;
  tags: readonly string[];
  backstory: string;
  appearance: string;
  aboutMe: string;
  conversationDisplayName: string;
}

export interface PersonalExtensionPersonaSnapshot {
  id: string;
  source?: "persona" | "character";
  name: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  tags: readonly string[];
  aboutMe: string;
  conversationDisplayName: string;
}

export interface PersonalExtensionPolicy {
  externalExtensionsEnvEnabled: boolean;
  externalExtensionsEnabled: boolean;
  serverSandboxAvailable: boolean;
  serverSandboxBackend: Exclude<PersonalExtensionSandboxBackend, "browser-opaque-origin"> | null;
  serverSandboxReason: string | null;
}

export interface PersonalExtensionRevision {
  contentHash: string;
  version: string | null;
  runtime: PersonalExtensionRuntime;
  capabilities: PersonalExtensionCapability[];
  css: string | null;
  js: string | null;
  serverJs: string | null;
  savedAt: string;
}

/**
 * User-owned code stored by Marinara.
 *
 * Browser code runs in an opaque-origin sandboxed iframe with a message-only
 * capability API. Server code runs in a separate OS-sandboxed process with
 * Node permissions enabled. Unsupported server platforms fail closed.
 * Execution is allowed only while the stored executable bytes still match the
 * exact approved SHA-256 hash.
 */
export interface PersonalExtension {
  id: string;
  name: string;
  version: string | null;
  description: string;
  runtime: PersonalExtensionRuntime;
  capabilities: PersonalExtensionCapability[];
  css: string | null;
  js: string | null;
  serverJs: string | null;
  enabled: boolean;
  contentHash: string;
  approvedHash: string | null;
  source: PersonalExtensionSource;
  revisions: PersonalExtensionRevision[];
  serverStatus?: "running" | "stopped" | "error";
  serverError?: string | null;
  installedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalClientExtensionRuntime {
  id: string;
  name: string;
  description: string;
  capabilities: PersonalExtensionCapability[];
  contentHash: string;
  executionMode: "sandboxed" | "full-page";
  runtimeUrl: string;
  styleUrl: string | null;
}
