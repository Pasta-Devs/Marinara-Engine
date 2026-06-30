// ──────────────────────────────────────────────
// Character Card V2 Types (compatible with ST / Chub)
// ──────────────────────────────────────────────
/** Full Character Card V2 envelope. */
export interface CharacterCardV2 {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CharacterData;
}

/** Core character data (V2 spec). */
export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  tags: string[];
  creator: string;
  character_version: string;
  alternate_greetings: string[];
  extensions: CharacterExtensions;
  character_book: CharacterBook | null;
  [key: string]: unknown;
}

/** ST-compatible extension fields. */
export interface CharacterExtensions {
  talkativeness: number;
  fav: boolean;
  world: string;
  depth_prompt: DepthPrompt;
  /** Marinara Engine extension: character backstory / lore */
  backstory: string;
  /** Marinara Engine extension: physical appearance description */
  appearance: string;
  /** Marinara Engine: Name display color/gradient (CSS value, e.g. "linear-gradient(90deg, #ff6b6b, #ffd93d)" or "#ff6b6b") */
  nameColor?: string;
  /** Marinara Engine: Dialogue highlight color — text in quotation marks is bold + colored with this */
  dialogueColor?: string;
  /** Marinara Engine: Chat bubble / dialogue box background color */
  boxColor?: string;
  /** Marinara Engine: RPG stats toggle + custom attributes */
  rpgStats?: RPGStatsConfig;
  /** Marinara Engine: Conversation-mode availability status */
  conversationStatus?: import("./chat.js").ConversationPresenceStatus;
  [key: string]: unknown;
}

/** RPG stats configuration attached to a character card. */
export interface RPGStatPool {
  name: string;
  value: number;
  max: number;
  color: string;
}

export interface RPGStatsConfig {
  /** Whether RPG stats are enabled for this character */
  enabled: boolean;
  /** Custom attribute list (e.g. STR, DEX, CHA — user can rename/add/remove) */
  attributes: Array<{ name: string; value: number }>;
  /** Hit Points */
  hp: { value: number; max: number };
  /** HP-like bars such as HP, MP, EP, Sanity, etc. */
  pools?: RPGStatPool[];
}

/** Depth-injected prompt attached to a character. */
export interface DepthPrompt {
  prompt: string;
  depth: number;
  role: "system" | "user" | "assistant";
}

/** Embedded lorebook inside a character card. */
export interface CharacterBook {
  name: string;
  description: string;
  scan_depth: number;
  token_budget: number;
  recursive_scanning: boolean;
  extensions: Record<string, unknown>;
  entries: CharacterBookEntry[];
}

export type CharacterBookEntryPosition =
  | "before_char"
  | "after_char"
  | "at_depth"
  | "depth"
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6;
export type CharacterBookEntryRole = "system" | "user" | "assistant" | 0 | 1 | 2;

/** A single entry in a character book. */
export interface CharacterBookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  case_sensitive: boolean;
  name: string;
  priority: number;
  id: number;
  comment: string;
  selective: boolean;
  secondary_keys: string[];
  constant: boolean;
  position: CharacterBookEntryPosition;
  depth?: number;
  role?: CharacterBookEntryRole;
  [key: string]: unknown;
}

/** Our internal Character representation (extends V2 with engine-specific fields). */
export interface Character {
  id: string;
  /** Original V2 data preserved for export compatibility */
  data: CharacterData;
  /** User-only note shown under the character name in selectors and editors */
  comment: string;
  /** Path to avatar image file */
  avatarPath: string | null;
  /** Path to sprite folder */
  spriteFolderPath: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Saved snapshot of a previous character card state. */
export interface CharacterCardVersion {
  id: string;
  characterId: string;
  data: CharacterData;
  comment: string;
  avatarPath: string | null;
  version: string;
  source: "manual" | "agent" | "command" | "restore" | string;
  reason: string;
  createdAt: string;
}

/** Snapshot data saved for a previous persona card state. */
export interface PersonaCardSnapshot {
  name: string;
  creator: string;
  personaVersion: string;
  creatorNotes: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  avatarCrop: string;
  nameColor: string;
  dialogueColor: string;
  boxColor: string;
  trackerCardColors: string;
  personaStats: string;
  tags: string;
  savedStatusOptions: string;
}

/** Saved snapshot of a previous persona card state. */
export interface PersonaCardVersion {
  id: string;
  personaId: string;
  data: PersonaCardSnapshot;
  comment: string;
  avatarPath: string | null;
  version: string;
  source: "manual" | "agent" | "command" | "restore" | string;
  reason: string;
  createdAt: string;
}

/** A group of characters (e.g. "Fatui Harbingers") — acts as a preset that adds all members to a chat. */
export interface CharacterGroup {
  id: string;
  name: string;
  description: string;
  avatarPath: string | null;
  /** IDs of characters belonging to this group */
  characterIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** A group of personas — for organising user personas. */
export interface PersonaGroup {
  id: string;
  name: string;
  description: string;
  /** IDs of personas belonging to this group */
  personaIds: string[];
  createdAt: string;
  updatedAt: string;
}
