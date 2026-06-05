import type { CharacterSummary } from "../../../../catalog/characters";
import type { Chat } from "../../../../catalog/chats";
import { pluginMemoryApi } from "../../../../../shared/api/plugin-memory-api";
import { ME_NOTES_MODULE_ID } from "../../lib/core-module-registry";
import { loadLayoutState } from "./layout";
import {
  DEFAULT_TAB,
  NOTEPAD_MEMORY_KEY,
  type BranchMode,
  type NoteScope,
  type NotepadContext,
  type NotepadMemoryState,
  type NotepadState,
  type NotepadTab,
  type ScopeResolution,
} from "../types";
import { asRecord, hasWindow, makeId, nowIso, readString } from "./utils";

const BACKUP_TYPE = "marinara-plugin-notepad-backup";
const MEMORY_SHADOW_STORAGE_KEY = "marinara-notepad-memory-shadow-v1";

function isNullableString(value: unknown): boolean {
  return value === null || value === undefined || typeof value === "string";
}

function isBackupTab(value: unknown): boolean {
  const raw = asRecord(value);
  return Boolean(
    raw &&
      typeof raw.id === "string" &&
      raw.id.trim() &&
      typeof raw.title === "string" &&
      (raw.scope === "global" || raw.scope === "character" || raw.scope === "chat") &&
      (raw.branchMode === "branch" || raw.branchMode === "family") &&
      isNullableString(raw.characterId) &&
      isNullableString(raw.chatId) &&
      isNullableString(raw.groupId) &&
      isNullableString(raw.createdAt) &&
      isNullableString(raw.updatedAt),
  );
}

function isNotesRecord(value: unknown): boolean {
  const raw = asRecord(value);
  return Boolean(raw && Object.values(raw).every((note) => typeof note === "string"));
}

function isBackupMemoryState(value: unknown): boolean {
  const raw = asRecord(value);
  return Boolean(
    raw &&
      raw.version === 1 &&
      Array.isArray(raw.tabs) &&
      raw.tabs.every(isBackupTab) &&
      isNotesRecord(raw.notes) &&
      (raw.activeTabId === null || raw.activeTabId === undefined || typeof raw.activeTabId === "string"),
  );
}

function normalizeTab(value: unknown): NotepadTab {
  const raw = asRecord(value) ?? {};
  const scope = raw.scope === "global" || raw.scope === "character" || raw.scope === "chat" ? raw.scope : "chat";
  const branchMode = raw.branchMode === "family" ? "family" : "branch";
  const timestamp = nowIso();
  return {
    id: readString(raw.id) ?? makeId("tab"),
    title: readString(raw.title) ?? "Notes",
    scope,
    branchMode,
    characterId: readString(raw.characterId),
    chatId: readString(raw.chatId),
    groupId: readString(raw.groupId),
    createdAt: readString(raw.createdAt) ?? timestamp,
    updatedAt: readString(raw.updatedAt) ?? timestamp,
  };
}

function normalizeNotes(value: unknown): Record<string, string> {
  const raw = asRecord(value);
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw).flatMap(([key, note]) => (typeof note === "string" ? [[key, note] as const] : [])),
  );
}

function timestampMs(value: unknown): number {
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextDuplicateTabId(baseId: string, usedIds: Set<string>): string {
  let index = 2;
  let candidate = `${baseId}-${index}`;
  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `${baseId}-${index}`;
  }
  return candidate;
}

function normalizeUniqueTabs(
  tabs: NotepadTab[],
  notes: Record<string, string>,
  requestedActiveTabId: unknown,
): NotepadMemoryState {
  const usedIds = new Set<string>();
  const reservedIds = new Set(tabs.map((tab) => tab.id));
  const unavailableIds = new Set(reservedIds);
  const remaps: Array<{ from: string; to: string }> = [];
  const uniqueTabs = tabs.map((tab) => {
    if (!usedIds.has(tab.id)) {
      usedIds.add(tab.id);
      return tab;
    }
    const nextId = nextDuplicateTabId(tab.id, unavailableIds);
    usedIds.add(nextId);
    unavailableIds.add(nextId);
    remaps.push({ from: tab.id, to: nextId });
    return { ...tab, id: nextId };
  });

  const nextNotes = { ...notes };
  for (const remap of remaps) {
    const prefix = `${remap.from}::`;
    for (const [key, note] of Object.entries(notes)) {
      if (!key.startsWith(prefix)) continue;
      nextNotes[`${remap.to}::${key.slice(prefix.length)}`] = note;
    }
  }

  const activeTabId =
    typeof requestedActiveTabId === "string" && uniqueTabs.some((tab) => tab.id === requestedActiveTabId)
      ? requestedActiveTabId
      : (uniqueTabs[0]?.id ?? null);

  return {
    version: 1,
    activeTabId,
    tabs: uniqueTabs,
    notes: nextNotes,
  };
}

function normalizeMemoryState(value: unknown): NotepadMemoryState {
  const raw = asRecord(value) ?? {};
  const tabs = (Array.isArray(raw.tabs) && raw.tabs.length > 0 ? raw.tabs : [DEFAULT_TAB]).map(normalizeTab);
  return normalizeUniqueTabs(tabs, normalizeNotes(raw.notes), raw.activeTabId);
}

function notepadMemoryStateFromState(state: NotepadState): NotepadMemoryState {
  return {
    version: 1,
    activeTabId: state.activeTabId,
    tabs: state.tabs,
    notes: state.notes,
  };
}

function readMemoryStateShadow(): { revision: number; updatedAt: string; state: NotepadMemoryState } | null {
  if (!hasWindow()) return null;
  try {
    const raw = asRecord(JSON.parse(window.localStorage.getItem(MEMORY_SHADOW_STORAGE_KEY) || "null"));
    if (!raw || raw.version !== 1 || typeof raw.updatedAt !== "string" || !isBackupMemoryState(raw.state)) {
      return null;
    }
    const revision = typeof raw.revision === "number" && Number.isFinite(raw.revision) ? raw.revision : 0;
    return {
      revision,
      updatedAt: raw.updatedAt,
      state: normalizeMemoryState(raw.state),
    };
  } catch {
    return null;
  }
}

export function writeMemoryStateShadow(state: NotepadMemoryState, revision: number): boolean {
  if (!hasWindow()) return true;
  try {
    window.localStorage.setItem(
      MEMORY_SHADOW_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        revision,
        updatedAt: nowIso(),
        state,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearMemoryStateShadow(savedRevision: number): void {
  if (!hasWindow()) return;
  const shadow = readMemoryStateShadow();
  if (shadow && shadow.revision > savedRevision) return;
  try {
    window.localStorage.removeItem(MEMORY_SHADOW_STORAGE_KEY);
  } catch {
    // A failed cleanup should not hide the successful plugin-memory save.
  }
}

export function initialState(): NotepadState {
  return {
    ...normalizeMemoryState(null),
    ...loadLayoutState(),
  };
}

export async function loadMemoryState(): Promise<NotepadMemoryState> {
  const record = await pluginMemoryApi.get<NotepadMemoryState>(ME_NOTES_MODULE_ID, NOTEPAD_MEMORY_KEY);
  const synced = normalizeMemoryState(record?.value);
  const shadow = readMemoryStateShadow();
  if (shadow && timestampMs(shadow.updatedAt) >= timestampMs(record?.updatedAt)) return shadow.state;
  return synced;
}

export async function saveMemoryState(state: NotepadMemoryState): Promise<void> {
  await pluginMemoryApi.put(ME_NOTES_MODULE_ID, NOTEPAD_MEMORY_KEY, state);
}

export function parseImportMemoryState(value: unknown): NotepadMemoryState {
  const raw = asRecord(value);
  if (!raw) throw new Error("Backup file must be a ME Notes JSON object.");

  if (raw.type === BACKUP_TYPE) {
    if (raw.version !== 1 || raw.pluginId !== ME_NOTES_MODULE_ID || raw.key !== NOTEPAD_MEMORY_KEY) {
      throw new Error("Backup file is not a compatible ME Notes backup.");
    }
    if (!isBackupMemoryState(raw.data)) {
      throw new Error("Backup file does not contain valid ME Notes tabs and notes.");
    }
    return normalizeMemoryState(raw.data);
  }

  if (!isBackupMemoryState(raw)) {
    throw new Error("Backup file does not contain valid ME Notes tabs and notes.");
  }
  return normalizeMemoryState(raw);
}

export function characterName(character: CharacterSummary): string {
  return readString(character.data?.name) ?? `Character ${character.id.slice(0, 6)}`;
}

export function currentCharacterIds(chat: Chat | null): string[] {
  return Array.isArray(chat?.characterIds) ? chat.characterIds.filter((id) => typeof id === "string" && id.trim()) : [];
}

export function characterLabel(context: NotepadContext, id: string | null | undefined): string {
  if (!id) return "Character";
  return context.characterLabels.get(id) ?? `Character ${id.slice(0, 6)}`;
}

export function titleForScope(
  scope: NoteScope,
  context: NotepadContext,
  characterId: string | null,
  branchMode: BranchMode,
): string {
  if (scope === "global") return "Global";
  if (scope === "character") return characterLabel(context, characterId);
  if (branchMode === "family") return "Branch-wide";
  return "Chat";
}

export function uniqueTabTitle(tabs: NotepadTab[], base: string): string {
  const cleanBase = base.trim() || "Notes";
  const existing = new Set(tabs.map((tab) => tab.title.trim().toLowerCase()));
  if (!existing.has(cleanBase.toLowerCase())) return cleanBase;
  let index = 2;
  while (existing.has(`${cleanBase} ${index}`.toLowerCase())) index += 1;
  return `${cleanBase} ${index}`;
}

export function tabRowLabel(scope: NoteScope): string {
  if (scope === "global") return "ALL";
  if (scope === "character") return "CHAR";
  return "CHAT";
}

export function labelForTabTarget(tab: NotepadTab, context: NotepadContext): string {
  if (tab.scope === "chat") return tab.branchMode === "family" ? "branch-wide scope" : "this chat";
  if (tab.scope === "character")
    return tab.characterId ? characterLabel(context, tab.characterId) : "current character";
  return "every chat";
}

export function noteEntryCount(tab: NotepadTab | null, state: NotepadState): number {
  if (!tab) return 0;
  const prefix = `${tab.id}::`;
  return Object.keys(state.notes).filter((key) => key.startsWith(prefix)).length;
}

function hasNoteForScopeKey(state: NotepadState, tab: NotepadTab, scopeKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(state.notes, `${tab.id}::${scopeKey}`);
}

export function resolveScope(tab: NotepadTab, context: NotepadContext, state: NotepadState): ScopeResolution {
  const chat = context.chat;
  if (tab.scope === "global") {
    return {
      key: "global",
      label: "Every chat",
      placeholder: "Write anything you want available everywhere in Marinara.",
    };
  }

  if (tab.scope === "character") {
    const ids = currentCharacterIds(chat);
    const characterId =
      tab.characterId ?? ids.find((id) => hasNoteForScopeKey(state, tab, `character:${id}`)) ?? ids[0] ?? null;
    if (!characterId) {
      return {
        key: "character:none",
        label: "Needs character chat",
        placeholder: "This tab saves per character once the active chat has a character.",
      };
    }
    return {
      key: `character:${characterId}`,
      label: characterLabel(context, characterId),
      placeholder: `Notes for ${characterLabel(context, characterId)}.`,
    };
  }

  if (!chat?.id) {
    return {
      key: "chat:none",
      label: "Open a chat",
      placeholder: "Open a chat to save this note.",
    };
  }

  if (tab.branchMode === "family") {
    const groupId = tab.groupId ?? chat.groupId ?? chat.id;
    const currentFamilyKey = chat.groupId ? `chat-family:${chat.groupId}` : null;
    return {
      key:
        currentFamilyKey && hasNoteForScopeKey(state, tab, currentFamilyKey)
          ? currentFamilyKey
          : `chat-family:${groupId}`,
      label: "Branch-wide",
      placeholder: "Notes shared across every branch of this chat.",
    };
  }

  const currentBranchKey = `chat:${chat.id}`;
  const chatId = tab.chatId ?? chat.id;
  return {
    key: hasNoteForScopeKey(state, tab, currentBranchKey) ? currentBranchKey : `chat:${chatId}`,
    label: "This chat",
    placeholder: "Notes for this chat.",
  };
}

export function noteKey(tab: NotepadTab, context: NotepadContext, state: NotepadState): string {
  return `${tab.id}::${resolveScope(tab, context, state).key}`;
}

function tabRelevant(state: NotepadState, tab: NotepadTab, context: NotepadContext): boolean {
  const chat = context.chat;
  if (tab.scope === "global") return true;
  if (!chat?.id) return false;

  if (tab.scope === "character") {
    const ids = currentCharacterIds(chat);
    if (tab.characterId) return ids.includes(tab.characterId);
    return ids.some((id) => hasNoteForScopeKey(state, tab, `character:${id}`));
  }

  if (tab.branchMode === "family") {
    const currentGroupId = chat.groupId ?? chat.id;
    const currentFamilyKey = chat.groupId ? `chat-family:${chat.groupId}` : null;
    return Boolean(
      (tab.groupId && tab.groupId === currentGroupId) ||
      (currentFamilyKey && hasNoteForScopeKey(state, tab, currentFamilyKey)),
    );
  }

  return Boolean(tab.chatId === chat.id || hasNoteForScopeKey(state, tab, `chat:${chat.id}`) || !tab.chatId);
}

export function visibleTabs(state: NotepadState, context: NotepadContext): NotepadTab[] {
  return state.tabs.filter((tab) => tabRelevant(state, tab, context));
}

export function ensureContextTargets(state: NotepadState, chat: Chat | null): NotepadState {
  if (!chat?.id) return state;
  let changed = false;
  const ids = currentCharacterIds(chat);
  const tabs = state.tabs.map((tab) => {
    if (tab.scope === "character" && !tab.characterId && ids.length > 0) {
      changed = true;
      return { ...tab, characterId: ids[0], updatedAt: nowIso() };
    }
    if (tab.scope !== "chat") return tab;
    if (tab.branchMode === "family") {
      if (tab.groupId) return tab;
      changed = true;
      return { ...tab, groupId: chat.groupId ?? chat.id, updatedAt: nowIso() };
    }
    if (tab.chatId) return tab;
    changed = true;
    return { ...tab, chatId: chat.id, groupId: chat.groupId ?? null, updatedAt: nowIso() };
  });
  if (!changed) return state;
  return { ...state, tabs };
}

export function ensureActiveTab(state: NotepadState, context: NotepadContext): NotepadState {
  const visible = visibleTabs(state, context);
  if (visible.length === 0 || visible.some((tab) => tab.id === state.activeTabId)) return state;
  return { ...state, activeTabId: visible[0].id };
}

export function makeBackupPayload(state: NotepadState) {
  return {
    type: BACKUP_TYPE,
    version: 1,
    exportedAt: nowIso(),
    pluginId: ME_NOTES_MODULE_ID,
    key: NOTEPAD_MEMORY_KEY,
    data: notepadMemoryStateFromState(state),
  };
}
