import {
  BookOpen,
  BookOpenText,
  Boxes,
  Command,
  FileText,
  Gamepad2,
  Home,
  LibraryBig,
  Link,
  MessageCircle,
  MessageCircleQuestion,
  MessageSquareText,
  Music2,
  Package,
  RefreshCw,
  Settings,
  Sparkles,
  Upload,
  Users,
  VenetianMask,
  Volume2,
  Activity,
  ArchiveRestore,
  type LucideIcon,
} from "lucide-react";
import type { ChatMode } from "@marinara-engine/shared";
import { CHAT_MODE_ICON_COMPONENTS } from "../components/chat/ChatModeIcon";
import type { CommandIcon, CommandKind } from "./command-center";

/**
 * Q6: one icon per kind of thing, everywhere a row, card or chip names one. Each is the icon the
 * app already shows for that kind in its own panel (top bar, panel header, chat mode pill), so a
 * search result looks like the Lorebooks panel's lorebook. A lorebook entry has no panel of its
 * own and the editor's Entries tab shares FileText with presets, so it takes the open book with
 * text: the lorebook's icon, one level down.
 */
export const RESULT_TYPE_ICONS = {
  ...CHAT_MODE_ICON_COMPONENTS,
  chat: MessageSquareText,
  "mari-chat": MessageCircleQuestion,
  character: Users,
  persona: VenetianMask,
  lorebook: BookOpen,
  "lorebook-entry": BookOpenText,
  preset: FileText,
  agent: Sparkles,
  setting: Settings,
  command: Command,
  doc: LibraryBig,
  message: MessageCircle,
  connection: Link,
} satisfies Record<string, LucideIcon>;

export type ResultType = keyof typeof RESULT_TYPE_ICONS;

/** A chat's type is its mode when known; the plain chat icon otherwise. */
export function chatResultType(mode: string | null | undefined): ResultType {
  return mode && Object.hasOwn(CHAT_MODE_ICON_COMPONENTS, mode) ? (mode as ChatMode) : "chat";
}

/** Mari's resource kinds (`lorebookEntry`, `setting`, `game`, ...) as the type they show. */
export function resourceResultType(kind: string): ResultType {
  if (kind === "lorebookEntry") return "lorebook-entry";
  return Object.hasOwn(RESULT_TYPE_ICONS, kind) ? (kind as ResultType) : "command";
}

const RECORD_FACE_TYPE_BY_TABLE = {
  characters: "character",
  lorebooks: "lorebook",
  lorebook_entries: "lorebook-entry",
  agent_configs: "agent",
  personas: "persona",
  presets: "preset",
  prompt_presets: "preset",
  chats: "chat",
  messages: "message",
  connections: "connection",
} satisfies Record<string, ResultType>;

/** A Mari edit-review record's own table (`characters`, `lorebook_entries`, ...) as its type. */
export function recordFaceResultType(table: string): ResultType {
  return Object.hasOwn(RECORD_FACE_TYPE_BY_TABLE, table)
    ? RECORD_FACE_TYPE_BY_TABLE[table as keyof typeof RECORD_FACE_TYPE_BY_TABLE]
    : "command";
}

export const COMMAND_ICONS = {
  command: RESULT_TYPE_ICONS.command,
  home: Home,
  chats: RESULT_TYPE_ICONS.chat,
  character: RESULT_TYPE_ICONS.character,
  persona: RESULT_TYPE_ICONS.persona,
  lorebook: RESULT_TYPE_ICONS.lorebook,
  preset: RESULT_TYPE_ICONS.preset,
  connection: RESULT_TYPE_ICONS.connection,
  agent: RESULT_TYPE_ICONS.agent,
  settings: RESULT_TYPE_ICONS.setting,
  extensions: Boxes,
  documentation: RESULT_TYPE_ICONS.doc,
  "game-assets": Gamepad2,
  package: Package,
  professor: Sparkles,
  music: Music2,
  upload: Upload,
  updates: RefreshCw,
  diagnostics: Activity,
  backups: ArchiveRestore,
  speech: Volume2,
} satisfies Record<CommandIcon, LucideIcon>;

export const DEFAULT_COMMAND_ICON_BY_KIND = {
  navigation: "command",
  chat: "chats",
  resource: "package",
  settings: "settings",
  action: "command",
} as const satisfies Record<CommandKind, CommandIcon>;

export function getCommandIcon(icon: CommandIcon | undefined, kind: CommandKind): LucideIcon {
  return COMMAND_ICONS[icon ?? DEFAULT_COMMAND_ICON_BY_KIND[kind]];
}
