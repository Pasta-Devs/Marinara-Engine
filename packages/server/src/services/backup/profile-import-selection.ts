/**
 * "Choose what to import" for Import Profile: what a profile file holds, grouped into the kinds a
 * person recognises (characters, chats, connections, ...), and a filter that keeps only the kinds and
 * items they ticked. The preview lists the contents; the import validates the choice and filters the
 * snapshot before anything is written, so a left-out item never touches this install.
 */

export type ProfileSelectionRow = Record<string, unknown>;
export type ProfileSelectionSnapshot = {
  version: 1;
  tables: Record<string, ProfileSelectionRow[]>;
  files: Array<{ path: string; data?: string; size: number }>;
};

export const PROFILE_IMPORT_KINDS = [
  "characters",
  "personas",
  "lorebooks",
  "presets",
  "chats",
  "settingsProfiles",
  "connections",
  "agents",
  "customTools",
  "regex",
  "themes",
  "assets",
  "game",
  "social",
  "mari",
  "extensions",
  "memory",
  "settings",
  "other",
] as const;
export type ProfileImportKind = (typeof PROFILE_IMPORT_KINDS)[number];

/** Kinds whose items can be ticked one by one. Their child tables follow the owner's choice. */
export const PROFILE_IMPORT_ITEMIZED_KINDS = ["characters", "personas", "lorebooks", "presets", "chats"] as const;
type ItemizedKind = (typeof PROFILE_IMPORT_ITEMIZED_KINDS)[number];

/** Older profiles (before the storage snapshot) only hold these lists. */
const LEGACY_PROFILE_KINDS: Record<string, ProfileImportKind> = {
  characters: "characters",
  personas: "personas",
  lorebooks: "lorebooks",
  presets: "presets",
  agents: "agents",
  themes: "themes",
};

type TableRule = { kind: ProfileImportKind; owner?: string; via?: { table: string; column: string } };

const OWNER_TABLES: Record<ItemizedKind, string> = {
  characters: "characters",
  personas: "personas",
  lorebooks: "lorebooks",
  presets: "prompt_presets",
  chats: "chats",
};

/** Every Engine table, by kind. `owner` names the column that points at the kind's item. */
const TABLE_RULES: Record<string, TableRule> = {
  characters: { kind: "characters", owner: "id" },
  character_card_versions: { kind: "characters", owner: "characterId" },
  character_images: { kind: "characters", owner: "characterId" },
  character_groups: { kind: "characters" },
  assets: { kind: "characters", owner: "characterId" },

  personas: { kind: "personas", owner: "id" },
  persona_card_versions: { kind: "personas", owner: "personaId" },
  persona_images: { kind: "personas", owner: "personaId" },
  persona_groups: { kind: "personas" },

  lorebooks: { kind: "lorebooks", owner: "id" },
  lorebook_character_links: { kind: "lorebooks", owner: "lorebookId" },
  lorebook_persona_links: { kind: "lorebooks", owner: "lorebookId" },
  lorebook_folders: { kind: "lorebooks", owner: "lorebookId" },
  lorebook_entries: { kind: "lorebooks", owner: "lorebookId" },
  lorebook_entry_activation_stats: { kind: "lorebooks", owner: "lorebookId" },

  prompt_presets: { kind: "presets", owner: "id" },
  prompt_groups: { kind: "presets", owner: "presetId" },
  prompt_sections: { kind: "presets", owner: "presetId" },
  choice_blocks: { kind: "presets", owner: "presetId" },

  chats: { kind: "chats", owner: "id" },
  messages: { kind: "chats", owner: "chatId" },
  message_swipes: { kind: "chats", via: { table: "messages", column: "messageId" } },
  conversation_call_sessions: { kind: "chats", owner: "chatId" },
  conversation_call_messages: { kind: "chats", owner: "chatId" },
  message_trash: { kind: "chats", owner: "chatId" },
  memory_chunks: { kind: "chats", owner: "chatId" },
  advanced_memory_records: { kind: "chats", owner: "chatId" },
  ooc_influences: { kind: "chats", owner: "targetChatId" },
  conversation_notes: { kind: "chats", owner: "targetChatId" },
  chat_images: { kind: "chats", owner: "chatId" },
  chat_folders: { kind: "chats" },
  agent_runs: { kind: "chats", owner: "chatId" },
  agent_memory: { kind: "chats", owner: "chatId" },
  game_state_snapshots: { kind: "chats", owner: "chatId" },
  spatial_context_snapshots: { kind: "chats", owner: "chatId" },
  game_engine_state: { kind: "chats", owner: "chatId" },
  game_checkpoints: { kind: "chats", owner: "chatId" },
  game_scene_videos: { kind: "chats", owner: "chatId" },
  game_turn_storyboards: { kind: "chats", owner: "chatId" },
  game_turn_storyboard_keyframes: { kind: "chats", via: { table: "game_turn_storyboards", column: "storyboardId" } },
  game_dice_pools: { kind: "chats", owner: "chatId" },
  game_world_snapshots: { kind: "chats", owner: "chatId" },

  chat_presets: { kind: "settingsProfiles" },

  api_connections: { kind: "connections" },
  connection_accounts: { kind: "connections" },
  api_connection_folders: { kind: "connections" },

  agent_configs: { kind: "agents" },
  custom_tools: { kind: "customTools" },
  regex_scripts: { kind: "regex" },
  custom_themes: { kind: "themes" },

  global_images: { kind: "assets" },
  gallery_folders: { kind: "assets" },
  custom_emojis: { kind: "assets" },
  custom_stickers: { kind: "assets" },
  conversation_call_sounds: { kind: "assets" },

  game_rulesets: { kind: "game" },
  game_ruleset_catalogs: { kind: "game" },
  game_tile_packs: { kind: "game" },
  game_creature_packs: { kind: "game" },
  game_board_packs: { kind: "game" },
  game_worlds: { kind: "game" },

  mari_instructions: { kind: "mari" },
  mari_workspace_context: { kind: "mari" },

  installed_extensions: { kind: "extensions" },
  capability_documents: { kind: "extensions" },

  app_settings: { kind: "settings" },
  prompt_overrides: { kind: "settings" },
  library_folders: { kind: "settings" },
  achievement_unlocks: { kind: "settings" },
};

/** The table whose rows a kind counts; kinds without one count every row in their tables. */
const COUNTED_TABLES: Partial<Record<ProfileImportKind, string[]>> = {
  characters: ["characters"],
  personas: ["personas"],
  lorebooks: ["lorebooks"],
  presets: ["prompt_presets"],
  chats: ["chats"],
  settingsProfiles: ["chat_presets"],
  connections: ["api_connections"],
  agents: ["agent_configs"],
  customTools: ["custom_tools"],
  regex: ["regex_scripts"],
  themes: ["custom_themes"],
  game: ["game_rulesets", "game_tile_packs", "game_creature_packs", "game_board_packs", "game_worlds"],
  mari: ["mari_instructions"],
  extensions: ["installed_extensions"],
  settings: ["app_settings"],
};

function tableRule(tableName: string): TableRule {
  if (TABLE_RULES[tableName]) return TABLE_RULES[tableName];
  if (/^(noodle|noodler|slurp)_/u.test(tableName)) return { kind: "social" };
  return { kind: "other" };
}

/** File folders by kind. Checked in order, so the more specific folder comes first. */
const FILE_RULES: Array<{ prefix: string; kind: ProfileImportKind; itemSegment?: number }> = [
  { prefix: "gallery/characters/", kind: "characters", itemSegment: 2 },
  { prefix: "gallery/character-videos/", kind: "characters", itemSegment: 2 },
  { prefix: "gallery/personas/", kind: "personas", itemSegment: 2 },
  { prefix: "gallery/persona-videos/", kind: "personas", itemSegment: 2 },
  { prefix: "gallery/global/", kind: "assets" },
  { prefix: "gallery/", kind: "chats", itemSegment: 1 },
  { prefix: "sprites/", kind: "characters", itemSegment: 1 },
  { prefix: "avatar-models/", kind: "characters", itemSegment: 1 },
  { prefix: "conversation-call-character-videos/", kind: "characters", itemSegment: 1 },
  { prefix: "game-scene-videos/", kind: "chats", itemSegment: 1 },
  { prefix: "lorebooks/images/", kind: "lorebooks", itemSegment: 2 },
  { prefix: "prompts/images/", kind: "presets", itemSegment: 2 },
  { prefix: "agents/images/", kind: "agents" },
  { prefix: "connections/images/", kind: "connections" },
  { prefix: "fonts/", kind: "themes" },
  { prefix: "backgrounds/", kind: "assets" },
  { prefix: "custom-emojis/", kind: "assets" },
  { prefix: "custom-stickers/", kind: "assets" },
  { prefix: "notification-sounds/", kind: "assets" },
  { prefix: "game-assets/", kind: "game" },
  { prefix: "long-term-memory/", kind: "memory" },
  { prefix: "knowledge-sources/", kind: "memory" },
];

export type ProfileImportContentItem = {
  id: string;
  name: string;
  /** Chats: their mode and how many messages they hold. */
  mode?: string;
  messages?: number;
  /** Lorebooks: how many entries they hold. */
  entries?: number;
};
export type ProfileImportContentKind = {
  key: ProfileImportKind;
  count: number;
  files: number;
  /** Itemized kinds list their items so single ones can be left out. */
  items?: ProfileImportContentItem[];
  /** Chats: how many messages the chats hold. */
  messages?: number;
};
export type ProfileImportContents = { kinds: ProfileImportContentKind[] };

export type ProfileImportSelection = {
  kinds: ProfileImportKind[];
  /** Per itemized kind, the items to import; a kind left out here imports all of its items. */
  items: Partial<Record<ItemizedKind, string[]>>;
};

export class ProfileImportSelectionError extends Error {}

const MAX_SELECTED_ITEMS = 200_000;
const MAX_ITEM_ID_LENGTH = 512;

function isItemizedKind(kind: string): kind is ItemizedKind {
  return (PROFILE_IMPORT_ITEMIZED_KINDS as readonly string[]).includes(kind);
}

function asId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function rowsOf(snapshot: ProfileSelectionSnapshot, tableName: string): ProfileSelectionRow[] {
  const rows = snapshot.tables[tableName];
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") : [];
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function itemName(kind: ItemizedKind, row: ProfileSelectionRow): string {
  const direct = typeof row.name === "string" ? row.name.trim() : "";
  if (kind === "characters") {
    const data = parseJsonObject(row.data);
    const fromData = typeof data?.name === "string" ? data.name.trim() : "";
    return fromData || direct;
  }
  return direct;
}

/** Splits text into file-name-shaped tokens, so a stored avatar path matches however it was written. */
function fileNameTokens(text: string): string[] {
  return text.split(/[^A-Za-z0-9._-]+/u).filter((token) => token.length > 0 && token.includes("."));
}

type FileOwner = { kind: ProfileImportKind; itemId?: string };

/**
 * Who each file belongs to. Avatars share one folder, so they go with the character or persona whose
 * row names them; an avatar nobody names goes with Characters.
 */
function classifyFiles(snapshot: ProfileSelectionSnapshot, itemIds: Record<ItemizedKind, Set<string>>) {
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  const avatarOwners = new Map<string, FileOwner[]>();
  const avatarNames = new Set<string>();
  for (const file of files) {
    const path = typeof file?.path === "string" ? file.path : "";
    if (path.startsWith("avatars/")) avatarNames.add(path.slice(path.lastIndexOf("/") + 1));
  }
  if (avatarNames.size > 0) {
    for (const kind of ["characters", "personas"] as const) {
      for (const row of rowsOf(snapshot, OWNER_TABLES[kind])) {
        const id = asId(row.id);
        if (!id) continue;
        for (const token of fileNameTokens(JSON.stringify(row))) {
          if (!avatarNames.has(token)) continue;
          const owners = avatarOwners.get(token) ?? [];
          owners.push({ kind, itemId: id });
          avatarOwners.set(token, owners);
        }
      }
    }
  }

  return files.map((file): FileOwner[] => {
    const path = typeof file?.path === "string" ? file.path : "";
    if (path.startsWith("avatars/")) {
      return avatarOwners.get(path.slice(path.lastIndexOf("/") + 1)) ?? [{ kind: "characters" }];
    }
    const rule = FILE_RULES.find((candidate) => path.startsWith(candidate.prefix));
    if (!rule) return [{ kind: "other" }];
    if (rule.itemSegment === undefined || !isItemizedKind(rule.kind)) return [{ kind: rule.kind }];
    const segment = path.split("/")[rule.itemSegment];
    if (segment && itemIds[rule.kind].has(segment)) return [{ kind: rule.kind, itemId: segment }];
    // A sprite folder can belong to a persona too.
    if (rule.kind === "characters" && segment && itemIds.personas.has(segment)) {
      return [{ kind: "personas", itemId: segment }];
    }
    return [{ kind: rule.kind }];
  });
}

function collectItemIds(snapshot: ProfileSelectionSnapshot) {
  const ids = {} as Record<ItemizedKind, Set<string>>;
  for (const kind of PROFILE_IMPORT_ITEMIZED_KINDS) {
    ids[kind] = new Set(rowsOf(snapshot, OWNER_TABLES[kind]).flatMap((row) => asId(row.id) ?? []));
  }
  return ids;
}

/** What the file holds, by kind, for the "Choose what to import" list. Empty kinds are left out. */
export function describeProfileSnapshotContents(snapshot: ProfileSelectionSnapshot): ProfileImportContents {
  const counts = new Map<ProfileImportKind, { count: number; files: number; messages: number }>();
  const entry = (kind: ProfileImportKind) => {
    let current = counts.get(kind);
    if (!current) {
      current = { count: 0, files: 0, messages: 0 };
      counts.set(kind, current);
    }
    return current;
  };

  for (const [tableName, rows] of Object.entries(snapshot.tables ?? {})) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const kind = tableRule(tableName).kind;
    const counted = COUNTED_TABLES[kind];
    if (!counted || counted.includes(tableName)) entry(kind).count += rows.length;
    else entry(kind);
    if (tableName === "messages") entry("chats").messages += rows.length;
  }

  const itemIds = collectItemIds(snapshot);
  for (const owners of classifyFiles(snapshot, itemIds)) {
    entry(owners[0]!.kind).files++;
  }

  const messagesByChat = new Map<string, number>();
  for (const message of rowsOf(snapshot, "messages")) {
    const chatId = asId(message.chatId);
    if (chatId) messagesByChat.set(chatId, (messagesByChat.get(chatId) ?? 0) + 1);
  }
  const entriesByLorebook = new Map<string, number>();
  for (const loreEntry of rowsOf(snapshot, "lorebook_entries")) {
    const lorebookId = asId(loreEntry.lorebookId);
    if (lorebookId) entriesByLorebook.set(lorebookId, (entriesByLorebook.get(lorebookId) ?? 0) + 1);
  }

  const kinds: ProfileImportContentKind[] = [];
  for (const key of PROFILE_IMPORT_KINDS) {
    const current = counts.get(key);
    if (!current || (current.count === 0 && current.files === 0)) continue;
    const kind: ProfileImportContentKind = { key, count: current.count, files: current.files };
    if (key === "chats") kind.messages = current.messages;
    if (isItemizedKind(key)) {
      kind.items = rowsOf(snapshot, OWNER_TABLES[key]).flatMap((row) => {
        const id = asId(row.id);
        if (!id) return [];
        const item: ProfileImportContentItem = { id, name: itemName(key, row) };
        if (key === "chats") {
          if (typeof row.mode === "string" && row.mode) item.mode = row.mode;
          item.messages = messagesByChat.get(id) ?? 0;
        } else if (key === "lorebooks") {
          item.entries = entriesByLorebook.get(id) ?? 0;
        }
        return [item];
      });
    }
    kinds.push(kind);
  }
  return { kinds };
}

/** What an older profile file holds. Its lists can only be chosen whole. */
export function describeLegacyProfileContents(data: Record<string, unknown>): ProfileImportContents {
  const kinds: ProfileImportContentKind[] = [];
  for (const [listName, key] of Object.entries(LEGACY_PROFILE_KINDS)) {
    const list = data[listName];
    if (Array.isArray(list) && list.length > 0) kinds.push({ key, count: list.length, files: 0 });
  }
  return { kinds };
}

/**
 * Reads the choice the page sent. Anything that isn't a list of known kinds and item ids is refused,
 * so a malformed or hostile request can't widen what gets written.
 */
export function parseProfileImportSelection(raw: unknown): ProfileImportSelection | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ProfileImportSelectionError("The import choice is not valid.");
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.kinds)) {
    throw new ProfileImportSelectionError("The import choice has no list of kinds.");
  }
  const kinds = new Set<ProfileImportKind>();
  for (const kind of record.kinds) {
    if (typeof kind !== "string" || !(PROFILE_IMPORT_KINDS as readonly string[]).includes(kind)) {
      throw new ProfileImportSelectionError(`Unknown import kind: ${String(kind).slice(0, 40)}`);
    }
    kinds.add(kind as ProfileImportKind);
  }

  const items: ProfileImportSelection["items"] = {};
  if (record.items !== undefined) {
    if (!record.items || typeof record.items !== "object" || Array.isArray(record.items)) {
      throw new ProfileImportSelectionError("The import choice's item lists are not valid.");
    }
    let total = 0;
    for (const [kind, ids] of Object.entries(record.items as Record<string, unknown>)) {
      if (!isItemizedKind(kind)) {
        throw new ProfileImportSelectionError(`Items can't be chosen one by one for ${kind.slice(0, 40)}.`);
      }
      if (!Array.isArray(ids)) {
        throw new ProfileImportSelectionError(`The chosen ${kind} are not a list.`);
      }
      total += ids.length;
      if (total > MAX_SELECTED_ITEMS) {
        throw new ProfileImportSelectionError("Too many items were chosen.");
      }
      for (const id of ids) {
        if (typeof id !== "string" || id.length === 0 || id.length > MAX_ITEM_ID_LENGTH) {
          throw new ProfileImportSelectionError(`The chosen ${kind} contain an invalid id.`);
        }
      }
      items[kind] = [...new Set(ids as string[])];
    }
  }

  const effective = [...kinds].filter((kind) => !isItemizedKind(kind) || items[kind]?.length !== 0);
  if (effective.length === 0) {
    throw new ProfileImportSelectionError("Choose at least one thing to import.");
  }
  return { kinds: effective, items };
}

/** Keeps only the chosen kinds and items, their child rows, and the files that belong to them. */
export function applyProfileImportSelection<T extends ProfileSelectionSnapshot>(
  snapshot: T,
  selection: ProfileImportSelection,
): T {
  const chosenKinds = new Set(selection.kinds);
  const itemIds = collectItemIds(snapshot);
  const chosenItems = {} as Record<ItemizedKind, Set<string> | null>;
  for (const kind of PROFILE_IMPORT_ITEMIZED_KINDS) {
    const ids = selection.items[kind];
    chosenItems[kind] = ids ? new Set(ids) : null;
  }
  const ownerChosen = (owner: FileOwner) => {
    if (!chosenKinds.has(owner.kind)) return false;
    if (!owner.itemId || !isItemizedKind(owner.kind)) return true;
    const chosen = chosenItems[owner.kind];
    return !chosen || chosen.has(owner.itemId);
  };

  const tables: Record<string, ProfileSelectionRow[]> = {};
  const keptKeys = new Map<string, Set<string>>();
  const deferred: string[] = [];
  for (const [tableName, rows] of Object.entries(snapshot.tables ?? {})) {
    if (!Array.isArray(rows)) {
      // A malformed table stays, so the import's own validation still rejects the file.
      tables[tableName] = rows;
      continue;
    }
    const rule = tableRule(tableName);
    if (!chosenKinds.has(rule.kind)) continue;
    if (rule.via) {
      deferred.push(tableName);
      continue;
    }
    const chosen = isItemizedKind(rule.kind) ? chosenItems[rule.kind] : null;
    const kept =
      chosen && rule.owner
        ? rows.filter((row) => {
            const ownerId = asId(row?.[rule.owner!]);
            // A row that points at no item of this kind (a group sprite, an unowned asset) goes with the kind.
            if (!ownerId || !itemIds[rule.kind as ItemizedKind].has(ownerId)) return true;
            return chosen.has(ownerId);
          })
        : rows;
    tables[tableName] = kept;
    keptKeys.set(tableName, new Set(kept.flatMap((row) => asId(row?.id) ?? [])));
  }
  for (const tableName of deferred) {
    const rule = tableRule(tableName);
    const parentKeys = keptKeys.get(rule.via!.table) ?? new Set<string>();
    tables[tableName] = (snapshot.tables[tableName] ?? []).filter((row) => {
      const parentId = asId(row?.[rule.via!.column]);
      return !parentId || parentKeys.has(parentId);
    });
  }

  const owners = classifyFiles(snapshot, itemIds);
  const files = (Array.isArray(snapshot.files) ? snapshot.files : []).filter((_, index) =>
    owners[index]!.some(ownerChosen),
  );
  return { ...snapshot, tables, files };
}

/** The older profile format: drop the lists that weren't chosen. */
export function applyLegacyProfileImportSelection(
  data: Record<string, unknown>,
  selection: ProfileImportSelection,
): Record<string, unknown> {
  const chosenKinds = new Set(selection.kinds);
  const next = { ...data };
  for (const [listName, kind] of Object.entries(LEGACY_PROFILE_KINDS)) {
    if (!chosenKinds.has(kind)) delete next[listName];
  }
  return next;
}
