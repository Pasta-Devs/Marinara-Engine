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
  conversationStatus?: "online" | "idle" | "dnd" | "offline";
  [key: string]: unknown;
}

/** RPG stats configuration attached to a character card. */
export interface RPGStatsConfig {
  /** Whether RPG stats are enabled for this character */
  enabled: boolean;
  /** Custom attribute list (e.g. STR, DEX, CHA — user can rename/add/remove) */
  attributes: Array<{ name: string; value: number }>;
  /** Hit Points */
  hp: { value: number; max: number };
  /** Magic/Mana Points */
  mp: { value: number; max: number };
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
  position: "before_char" | "after_char";
}

/** Our internal Character representation (extends V2 with engine-specific fields). */
export interface Character {
  id: string;
  /** Original V2 data preserved for export compatibility */
  data: CharacterData;
  /** Path to avatar image file */
  avatarPath: string | null;
  /** Path to sprite folder */
  spriteFolderPath: string | null;
  createdAt: string;
  updatedAt: string;
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
