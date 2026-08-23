import {
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Database,
  FileUp,
  FileText,
  ImageIcon,
  Link,
  Loader2,
  MessageCircle,
  PackagePlus,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Star,
  Terminal,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  MARI_STARTER_CHIPS,
  PROFESSOR_MARI_ID,
  type APIConnection,
  type Chat,
  type MariDbHistoryEntry,
  type MariDbPendingApproval,
  type MariDependencyInstallApproval,
  type MariGuidedPlanStep,
  type MariSuggestionChip,
  type MariWorkspaceSkillDetail,
  type MariWorkspaceSkillsResponse,
  type MariInstructionDetail,
  type MariInstructionsResponse,
  type MariInstructionMutationResponse,
  type MariWorkspaceStatus,
  type MariWorkspacePendingApproval,
  type MariSensitiveFileApproval,
  type MariWorkspaceTraceItem,
  type Message,
} from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useTrackAchievement } from "../../hooks/use-achievements";
import { chatKeys } from "../../hooks/use-chats";
import { useMariWorkspaceContext } from "../../hooks/use-mari-workspace-context";
import { MariAttachButton } from "./MariAttachButton";
import { MariChatHistoryPicker } from "./MariChatHistoryPicker";
import { MariContextViewer } from "./MariContextViewer";
import { homeFeedKeys } from "../../hooks/use-home-feed";
import { filterLanguageGenerationConnections } from "../../lib/connection-filters";
import { api, getPrivilegedActionErrorMessage, StreamResumeDisconnectError } from "../../lib/api-client";
import { formatGenerationParameterError } from "../../lib/generation-parameter-errors";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useChatStore } from "../../stores/chat.store";
import { useAgentStore } from "../../stores/agent.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore, type MariEditViewMode, type MariPanelSortMode } from "../../stores/ui.store";
import { MariEditEasyViewer } from "./MariEditEasyViewer";
import { MariPromptPreviewModal, type MariPromptRenderSide } from "./MariPromptPreviewModal";
import { showLocalMessageNotification, showNativeMessageNotification } from "../../lib/local-notifications";
import {
  isProfessorMariTranscriptNearBottom,
  scrollProfessorMariTranscriptToBottom,
} from "../../lib/professor-mari-transcript-scroll";
import {
  formatCompactTokenCount,
  resolveProfessorMariContextBudget,
  type ProfessorMariContextBudget,
} from "../../lib/professor-mari-context-budget";
import { applyInlineMarkdown, renderMarkdownBlocks } from "../../lib/markdown";
import { rafThrottle } from "../../lib/raf-throttle";
import { prepareImageAttachment } from "../../lib/chat-attachment-images";
import { cn } from "../../lib/utils";
import { ProfessorMariWorkingWindow } from "../ui/ProfessorMariWorkingWindow";
import { MacroTextarea } from "../ui/MacroTextarea";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import {
  PROFESSOR_MARI_FLOATING_HIDE_EVENT,
  PROFESSOR_MARI_FLOATING_SHOW_EVENT,
  dispatchProfessorMariFloatingEvent,
  rememberProfessorMariFloatingEnabled,
} from "./professor-mari-floating-events";
import { MariSuggestionChips } from "./MariSuggestionChips";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";

const MARI_AVATAR_URL = "/sprites/mari/Mari_profile.png";
const MARI_CHIBI_URL = "/sprites/mari/chibi-professor-mari.png";
const PROFESSOR_MARI_WELCOME_MESSAGE_ID = "__professor_mari_home_welcome__";
const PROFESSOR_MARI_DRAFT_KEY = "__home_professor_mari__";
const MARI_CONNECTION_STORAGE_KEY = "marinara:home-professor-mari-connection-id";
const PROFESSOR_MARI_ERROR_TOAST_DURATION_MS = 120_000;
const WORKSPACE_SETTLE_POLL_MS = 1_500;
const WORKSPACE_SETTLE_MAX_WAIT_MS = 30 * 60_000;
const WORKSPACE_SETTLE_REQUEST_TIMEOUT_MS = 10_000;

// After the SSE stream detaches on tab resume, the run keeps going server-side.
// Poll the workspace status until it is no longer active so the caller reloads
// the fully persisted reply and approvals rather than a half-written state.
async function waitForWorkspaceRunToSettle(connectionId: string | null, signal: AbortSignal): Promise<void> {
  const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
  const startedAt = Date.now();
  while (!signal.aborted && Date.now() - startedAt < WORKSPACE_SETTLE_MAX_WAIT_MS) {
    const pollController = new AbortController();
    const abortPoll = () => pollController.abort();
    const pollTimeout = window.setTimeout(abortPoll, WORKSPACE_SETTLE_REQUEST_TIMEOUT_MS);
    signal.addEventListener("abort", abortPoll, { once: true });
    try {
      const status = await api.get<MariWorkspaceStatus>(`/professor-mari/workspace/status${query}`, {
        signal: pollController.signal,
      });
      if (!status.active) return;
    } catch {
      // The resumed tab may still be restoring network access; keep polling.
    } finally {
      window.clearTimeout(pollTimeout);
      signal.removeEventListener("abort", abortPoll);
    }
    if (signal.aborted) return;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, WORKSPACE_SETTLE_POLL_MS);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
}
const PROFESSOR_MARI_NO_CONNECTION_TOAST =
  "You haven't set up a connection yet! Click the link icon beside the paperclip to select one.";
const MARI_WELCOME =
  "Howdy, welcome to Marinara Engine!\n\nFeeling a little lost? It is not a skill issue yet, I am here to help! Ask me about the app, your setup, or what to do next.\n\nNeed something made or changed? I can create character cards, personas, lorebooks, chats, and presets, and I can make reversible local workspace changes with a Keep/Restore review. Select a connection via the link icon beside the paperclip first and then ask away!";
const NEW_SKILL_CONTENT = `# Custom Professor Mari Skill

Use this skill when the request matches a workflow you want Professor Mari to follow.

## Workflow

- Add the trigger conditions.
- Add the steps Professor Mari should follow.
- Add any checks or evidence she should collect before saying the work is done.
`;

type ProfessorMariAttachment = {
  type: string;
  data: string;
  name: string;
  filename?: string;
  resized?: boolean;
};
const PROFESSOR_MARI_ATTACHMENT_ACCEPT =
  "image/*,application/pdf,.pdf,.txt,.md,.markdown,.json,.jsonl,.csv,.log,.xml,.yaml,.yml";
const PROFESSOR_MARI_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const PROFESSOR_MARI_TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "csv",
  "json",
  "jsonl",
  "log",
  "markdown",
  "md",
  "txt",
  "xml",
  "yaml",
  "yml",
]);
const PROFESSOR_MARI_PDF_ATTACHMENT_MIME_TYPE = "application/pdf";
const PROFESSOR_MARI_PANE_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] } as const;
const PROFESSOR_MARI_FLOATING_EDGE_GAP = 12;
const PROFESSOR_MARI_FLOATING_MOBILE_TOP_GAP = 64;

type WorkspaceApprovalResponse = {
  ok: boolean;
  approval?: MariWorkspacePendingApproval;
  history?: MariDbHistoryEntry | null;
  completed?: boolean;
  outcome?: "applied" | "discarded" | "state_changed" | "failed";
  error?: string | null;
};

type WorkspaceSkillMutationResponse = {
  ok: boolean;
  skill: MariWorkspaceSkillDetail;
};

type SkillDraftState = {
  name: string;
  description: string;
  content: string;
};

// #4851: draft for the Memories panel. `enabled` and `persistent` are toggled directly
// on the row/editor (not staged in the draft); name/description/content save together.
type MemoryDraftState = {
  name: string;
  description: string;
  content: string;
};

type ProfessorMariConnectionOption = {
  id: string;
  name: string;
  model?: string | null;
  provider?: string;
  isDefault?: boolean;
};

type ProfessorMariChatSummary = Chat & {
  messageCount?: number;
};

type FloatingDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

function readStoredConnectionId() {
  try {
    return window.localStorage.getItem(MARI_CONNECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberConnectionId(id: string) {
  try {
    window.localStorage.setItem(MARI_CONNECTION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function isProfessorMariDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
}

function ProfessorMariMobilePortal({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const [mobile, setMobile] = useState(() => !isProfessorMariDesktopViewport());

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  if (disabled) return children;
  return mobile ? createPortal(children, document.body) : children;
}

function getProfessorMariFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function inferProfessorMariAttachmentType(file: File): string {
  const extension = getProfessorMariFileExtension(file.name);
  if (extension === "pdf") return PROFESSOR_MARI_PDF_ATTACHMENT_MIME_TYPE;
  if (file.type) return file.type;
  if (extension === "json" || extension === "jsonl") return "application/json";
  if (extension === "csv") return "text/csv";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "xml") return "application/xml";
  if (extension === "yaml" || extension === "yml") return "application/yaml";
  if (extension === "txt" || extension === "log") return "text/plain";
  return "application/octet-stream";
}

function isSupportedProfessorMariAttachment(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type.startsWith("text/")) return true;
  const type = inferProfessorMariAttachmentType(file);
  if (type === PROFESSOR_MARI_PDF_ATTACHMENT_MIME_TYPE) return true;
  if (
    type === "application/json" ||
    type === "application/xml" ||
    type === "application/yaml" ||
    type === "application/x-yaml"
  ) {
    return true;
  }
  return PROFESSOR_MARI_TEXT_ATTACHMENT_EXTENSIONS.has(getProfessorMariFileExtension(file.name));
}

function readProfessorMariFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function isProfessorMariImageAttachment(attachment: ProfessorMariAttachment): boolean {
  return attachment.type.startsWith("image/") && attachment.data.startsWith("data:image/");
}

function describeProfessorMariError(error: unknown) {
  const message = getPrivilegedActionErrorMessage(error, "").trim();
  if (message) {
    return `${formatGenerationParameterError(message)} This message will stay visible long enough to screenshot for troubleshooting.`;
  }
  return "The request failed before Professor Mari could answer. This message will stay visible long enough to screenshot for troubleshooting.";
}

function isProfessorMariAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function toMessageExtra(message: Message): Message["extra"] {
  if (typeof message.extra === "string") {
    try {
      return JSON.parse(message.extra) as Message["extra"];
    } catch {
      return {
        displayText: null,
        isGenerated: message.role === "assistant",
        tokenCount: null,
        generationInfo: null,
      };
    }
  }
  return message.extra;
}

function getProfessorMariAttachments(message: Message): ProfessorMariAttachment[] {
  const extra = toMessageExtra(message);
  const rawAttachments =
    extra && typeof extra === "object" && "attachments" in extra
      ? (extra as { attachments?: unknown }).attachments
      : undefined;
  if (!Array.isArray(rawAttachments)) return [];
  return rawAttachments.flatMap((attachment): ProfessorMariAttachment[] => {
    if (!attachment || typeof attachment !== "object") return [];
    const candidate = attachment as Partial<ProfessorMariAttachment>;
    if (typeof candidate.type !== "string" || typeof candidate.data !== "string") return [];
    if (!candidate.data.startsWith("data:")) return [];
    const filename =
      typeof candidate.filename === "string" && candidate.filename.trim() ? candidate.filename.trim() : undefined;
    const name =
      typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : (filename ?? "attachment");
    const normalized: ProfessorMariAttachment = { type: candidate.type, data: candidate.data, name };
    if (filename) normalized.filename = filename;
    if (typeof candidate.resized === "boolean") normalized.resized = candidate.resized;
    return [normalized];
  });
}

function isProfessorMariChatActive(chat: ProfessorMariChatSummary) {
  const raw = chat.metadata;
  try {
    const metadata =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown> | null);
    if (!metadata) return false;
    return metadata.professorMariActive === true && metadata.professorMariArchived !== true;
  } catch {
    return false;
  }
}

function createWelcomeMessage(chatId: string | null): Message {
  return {
    id: PROFESSOR_MARI_WELCOME_MESSAGE_ID,
    chatId: chatId ?? "__professor_mari_home__",
    role: "assistant",
    characterId: PROFESSOR_MARI_ID,
    content: MARI_WELCOME,
    activeSwipeIndex: 0,
    createdAt: new Date(0).toISOString(),
    extra: {
      displayText: null,
      isGenerated: false,
      tokenCount: null,
      generationInfo: null,
    },
  };
}

function createLocalUserMessage(chatId: string, content: string, attachments: ProfessorMariAttachment[] = []): Message {
  return {
    id: `__professor_mari_local_${Date.now()}`,
    chatId,
    role: "user",
    characterId: null,
    content,
    activeSwipeIndex: 0,
    createdAt: new Date().toISOString(),
    extra: {
      displayText: null,
      isGenerated: false,
      tokenCount: null,
      generationInfo: null,
      ...(attachments.length > 0 ? { attachments } : {}),
    },
  };
}

function getMessageThinking(message: Message): string | null {
  const extra = toMessageExtra(message);
  const thinking = extra?.thinking;
  return typeof thinking === "string" && thinking.trim().length > 0 ? thinking : null;
}

type WorkspaceToolCall = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  input?: unknown;
  detail: string | null;
  output: string | null;
  updatedAt: number;
};

type ToolTone = "db" | "shell" | "file" | "search" | "write" | "theme" | "image" | "wiki" | "skill" | "generic";

type ToolPresentation = {
  eyebrow: string;
  title: string;
  detail: string | null;
  tone: ToolTone;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function previewValue(value: unknown, limit = 180): string | null {
  if (value == null) return null;
  let text: string;
  if (typeof value === "string") text = value;
  else {
    const record = asRecord(value);
    if (record) {
      const primary = record.command ?? record.path ?? record.pattern ?? record.query ?? record.url ?? record.reason;
      if (typeof primary === "string") text = primary;
      else {
        try {
          text = JSON.stringify(record);
        } catch {
          text = String(value);
        }
      }
    } else text = String(value);
  }

  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
}

function outputValue(value: unknown, limit = 8000): string | null {
  if (value == null) return null;
  let text: string;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }
  const trimmed = text.trimEnd();
  if (!trimmed) return null;
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

function getToolCallId(data: Record<string, unknown> | null, name: string) {
  const id = data?.id;
  return typeof id === "string" && id.trim() ? id : `${name}-${Date.now()}`;
}

function formatToolName(name: string) {
  return name
    .replace(/^functions\./, "")
    .replace(/^multi_tool_use\./, "")
    .replace(/_/g, " ");
}

function isWorkspaceTraceItem(value: unknown): value is MariWorkspaceTraceItem {
  const record = asRecord(value);
  if (!record || typeof record.type !== "string") return false;
  if (["text", "thinking", "status"].includes(record.type)) return typeof record.content === "string";
  if (record.type !== "tool") return false;
  const tool = asRecord(record.tool);
  return (
    !!tool &&
    typeof tool.id === "string" &&
    typeof tool.name === "string" &&
    ["running", "done", "error"].includes(String(tool.status))
  );
}

function getMessageWorkspaceTrace(message: Message): MariWorkspaceTraceItem[] | null {
  const extra = toMessageExtra(message);
  const trace = extra?.mariWorkspaceTimeline;
  if (!Array.isArray(trace)) return null;
  const items = trace.filter(isWorkspaceTraceItem);
  return items.length > 0 ? items : null;
}

type WorkspaceTimelineItem =
  | { id: string; type: "text"; content: string }
  | { id: string; type: "thinking"; content: string }
  | { id: string; type: "tool"; tool: WorkspaceToolCall }
  | { id: string; type: "status"; content: string };

function timelineId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function timelineItemsFromTrace(trace: MariWorkspaceTraceItem[], message: Message): WorkspaceTimelineItem[] {
  const items = trace.map((item, index): WorkspaceTimelineItem => {
    if (item.type === "tool") {
      return {
        id: `${message.id}-tool-${item.tool.id || index}`,
        type: "tool",
        tool: {
          id: item.tool.id || `${message.id}-${index}`,
          name: item.tool.name || "tool",
          status: item.tool.status === "running" ? "done" : item.tool.status,
          input: item.tool.input,
          detail: previewValue(item.tool.input),
          output: item.tool.output ?? null,
          updatedAt: item.tool.updatedAt ?? 0,
        },
      };
    }
    return { id: `${message.id}-${item.type}-${index}`, type: item.type, content: item.content };
  });

  if (!items.some((item) => item.type === "text") && message.content.trim()) {
    items.push({ id: `${message.id}-text-fallback`, type: "text", content: message.content });
  }
  return items;
}

function appendTextTimeline(current: WorkspaceTimelineItem[], delta: string): WorkspaceTimelineItem[] {
  if (!delta) return current;
  const last = current[current.length - 1];
  if (last?.type === "text") return [...current.slice(0, -1), { ...last, content: `${last.content}${delta}` }];
  return [...current, { id: timelineId("text"), type: "text", content: delta }];
}

function appendThinkingTimeline(current: WorkspaceTimelineItem[], delta: string): WorkspaceTimelineItem[] {
  if (!delta) return current;
  const last = current[current.length - 1];
  if (last?.type === "thinking") return [...current.slice(0, -1), { ...last, content: `${last.content}${delta}` }];
  return [...current, { id: timelineId("thinking"), type: "thinking", content: delta }];
}

function appendStatusTimeline(current: WorkspaceTimelineItem[], content: string): WorkspaceTimelineItem[] {
  const trimmed = content.trim();
  if (!trimmed) return current;
  const last = current[current.length - 1];
  if (last?.type === "status" && last.content === trimmed) return current;
  return [...current, { id: timelineId("status"), type: "status", content: trimmed }];
}

function upsertToolTimeline(current: WorkspaceTimelineItem[], update: WorkspaceToolCall): WorkspaceTimelineItem[] {
  const existingIndex = current.findIndex((item) => item.type === "tool" && item.tool.id === update.id);
  if (existingIndex < 0) {
    const toolItem: WorkspaceTimelineItem = { id: `tool-${update.id}`, type: "tool", tool: update };
    return [...current, toolItem];
  }
  return current.map((item, index) => {
    if (index !== existingIndex || item.type !== "tool") return item;
    return {
      ...item,
      tool: {
        ...item.tool,
        ...update,
        name: update.name === "tool" && item.tool.name !== "tool" ? item.tool.name : update.name,
        input: update.input ?? item.tool.input,
        detail: update.detail ?? item.tool.detail,
        output: update.output ?? item.tool.output,
      },
    };
  });
}

const MARI_DB_MUTATIONS = new Set(["insert", "patch", "replace", "delete", "transform"]);

function splitShellWords(command: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (!quote && /\s/.test(char)) {
      if (current) words.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) words.push(current);
  return words;
}

function humanizeIdentifier(value: string | null | undefined) {
  if (!value) return "data";
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactCommand(command: string, limit = 220) {
  const compact = command.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
}

function getBashCommand(tool: WorkspaceToolCall) {
  const input = asRecord(tool.input);
  const command = input?.command;
  if (typeof command === "string" && command.trim()) return command.trim();
  return null;
}

function shellTokenBasename(token: string) {
  const clean = token.trim().replace(/^["']|["']$/g, "");
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

function isMariExecutableToken(token: string) {
  return /^(?:mari|mari\.(?:cmd|ps1|exe))$/i.test(shellTokenBasename(token));
}

function getMariTokens(command: string): string[] | null {
  const tokens = splitShellWords(command);
  const start = tokens.findIndex(isMariExecutableToken);
  return start >= 0 ? tokens.slice(start) : null;
}

function firstCommandValue(tokens: string[], start = 0) {
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || token === "--" || token.startsWith("-") || token.includes("=")) continue;
    return token;
  }
  return null;
}

function looksLikeHelpToken(token: string | null | undefined) {
  return !token || token === "help" || token === "--help" || token === "-h";
}

function extractMariDbCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || tokens[1] !== "db") return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "status");
  const target = tokens.slice(3).find((token) => token && !token.startsWith("-") && !token.includes("=")) ?? null;
  return {
    action,
    target,
    apply: tokens.includes("--apply"),
    dryRun: tokens.includes("--dry-run") || (MARI_DB_MUTATIONS.has(action) && !tokens.includes("--apply")),
  };
}

function mariDbTitle(info: NonNullable<ReturnType<typeof extractMariDbCommand>>) {
  const target = humanizeIdentifier(info.target);
  switch (info.action) {
    case "status":
      return "Checking database status";
    case "help":
      return "Opening database command help";
    case "tables":
      return "Listing database tables";
    case "counts":
      return "Counting database rows";
    case "schema":
      return `Reading ${target} schema`;
    case "list":
      return `Listing ${target}`;
    case "get":
      return `Reading ${target} row`;
    case "search":
      return `Searching ${info.target === "all" ? "all tables" : target}`;
    case "select":
      return `Querying ${target}`;
    case "validate":
      return "Validating workspace data";
    case "insert":
      return info.apply ? `Creating ${target}` : `Previewing new ${target}`;
    case "patch":
      return info.apply ? `Applying ${target} update` : `Previewing ${target} update`;
    case "replace":
      return info.apply ? `Replacing ${target}` : `Previewing ${target} replacement`;
    case "delete":
      return info.apply ? `Deleting ${target}` : `Previewing ${target} deletion`;
    case "transform":
      return info.apply ? `Applying ${target} transform` : `Previewing ${target} transform`;
    default:
      return `Running mari db ${info.action}`;
  }
}

function mariDbDetail(info: NonNullable<ReturnType<typeof extractMariDbCommand>>) {
  if (!info.target || ["status", "tables", "counts", "validate", "data-dir", "now", "new-id"].includes(info.action))
    return null;
  return info.target === "all" ? "all tables" : humanizeIdentifier(info.target);
}

function tokenFlagValue(tokens: string[], flag: string) {
  const prefixed = `${flag}=`;
  const inline = tokens.find((token) => token.startsWith(prefixed));
  if (inline) return inline.slice(prefixed.length);
  const index = tokens.indexOf(flag);
  return index >= 0 ? (tokens[index + 1] ?? null) : null;
}

function extractMariCodeCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || tokens[1] !== "code") return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "status");
  return {
    action,
    subaction: action === "reload" ? (tokens[3] ?? null) : null,
    kind: tokenFlagValue(tokens, "--kind"),
    changed: tokens.includes("--changed"),
    patch: tokens.includes("--patch") || tokens.includes("--full"),
  };
}

function mariCodeTitle(info: NonNullable<ReturnType<typeof extractMariCodeCommand>>) {
  switch (info.action) {
    case "status":
      return "Checking workspace status";
    case "help":
      return "Opening workspace command help";
    case "diff":
      return info.patch ? "Inspecting workspace diff" : "Summarizing workspace diff";
    case "check":
      return info.changed ? "Checking changed workspace files" : "Running workspace checks";
    case "health":
      return "Checking workspace health";
    case "reload":
      return info.subaction === "request"
        ? `Requesting ${info.kind ?? "workspace"} reload`
        : "Managing workspace reload";
    case "continue":
      return "Continuing workspace run";
    default:
      return `Running mari code ${info.action}`;
  }
}

function mariCodeDetail(info: NonNullable<ReturnType<typeof extractMariCodeCommand>>) {
  if (info.action === "reload" && info.kind) return info.kind;
  if (info.action === "diff" && info.patch) return "patch included";
  if (info.action === "check" && info.changed) return "changed scope requested";
  return null;
}

const MARI_THEME_MUTATIONS = new Set(["create", "update", "set-active"]);

function extractMariThemesCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || (tokens[1] !== "themes" && tokens[1] !== "theme")) return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "list");
  const name = tokenFlagValue(tokens, "--name");
  return {
    action,
    name,
    apply: tokens.includes("--apply"),
    activate: tokens.includes("--activate") || tokens.includes("--active") || action === "set-active",
    dryRun: MARI_THEME_MUTATIONS.has(action) && !tokens.includes("--apply"),
  };
}

function mariThemesTitle(info: NonNullable<ReturnType<typeof extractMariThemesCommand>>) {
  const suffix = info.name ? `: ${info.name}` : "";
  switch (info.action) {
    case "list":
      return "Listing themes";
    case "help":
      return "Opening theme command help";
    case "active":
      return "Checking active theme";
    case "get":
      return "Reading theme";
    case "create":
      return info.apply ? `Creating theme${suffix}` : `Previewing theme${suffix}`;
    case "update":
      return info.apply ? "Updating theme" : "Previewing theme update";
    case "set-active":
      return info.apply ? "Activating theme" : "Previewing theme activation";
    default:
      return `Running mari themes ${info.action}`;
  }
}

function mariThemesDetail(info: NonNullable<ReturnType<typeof extractMariThemesCommand>>) {
  if (info.dryRun) return "dry run, not saved";
  if (info.activate) return "activate";
  return null;
}

const MARI_IMAGE_WRITES = new Set(["assign", "add", "replace", "delete", "remove", "clear"]);

function extractMariImagesCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || !["image", "images", "media"].includes(tokens[1] ?? "")) return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "help");
  return {
    action,
    target: tokenFlagValue(tokens, "--target") ?? firstCommandValue(tokens, 3),
    asset: tokenFlagValue(tokens, "--asset") ?? tokenFlagValue(tokens, "--id"),
    prompt: tokenFlagValue(tokens, "--prompt"),
    source: tokenFlagValue(tokens, "--source"),
    connection: tokenFlagValue(tokens, "--connection"),
    edit: tokens.includes("--edit"),
    mutating: MARI_IMAGE_WRITES.has(action),
  };
}

function mariImagesTitle(info: NonNullable<ReturnType<typeof extractMariImagesCommand>>) {
  switch (info.action) {
    case "connections":
      return info.edit ? "Finding edit-capable image connections" : "Checking image connections";
    case "capabilities":
      return info.edit ? "Checking image edit capabilities" : "Checking image capabilities";
    case "preview":
      return "Preparing image preview";
    case "generate":
      return "Generating review image";
    case "edit":
      return "Editing review image";
    case "assign":
    case "add":
    case "replace":
      return "Assigning image asset";
    case "delete":
    case "remove":
    case "clear":
      return "Removing image asset";
    case "list":
      return `Listing ${humanizeIdentifier(info.target)}`;
    case "get":
      return "Reading image asset";
    case "help":
      return "Opening image command help";
    default:
      return `Running mari images ${info.action}`;
  }
}

function mariImagesDetail(info: NonNullable<ReturnType<typeof extractMariImagesCommand>>) {
  if (info.target && !["list", "get"].includes(info.action)) return humanizeIdentifier(info.target);
  if (info.asset) return compactCommand(info.asset, 70);
  if (info.source) return compactCommand(info.source, 70);
  if (info.prompt) return compactCommand(info.prompt, 70);
  if (info.connection) return compactCommand(info.connection, 70);
  return null;
}

function extractMariWikiCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || !["wiki", "fandom"].includes(tokens[1] ?? "")) return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "help");
  const wiki =
    tokenFlagValue(tokens, "--wiki") ??
    (["search", "search-wiki", "pages", "category", "category-members", "site-info"].includes(action)
      ? tokens[3]
      : null);
  return {
    action,
    wiki,
    title: tokenFlagValue(tokens, "--title"),
    pageUrl: tokenFlagValue(tokens, "--page-url") ?? tokenFlagValue(tokens, "--pageUrl"),
    query: tokenFlagValue(tokens, "--query") ?? firstCommandValue(tokens, action === "search-in-page" ? 5 : 3),
    category:
      tokenFlagValue(tokens, "--category") ??
      (["category", "category-members"].includes(action)
        ? tokens.slice(4).find((token) => token && !token.startsWith("-"))
        : null),
    content: tokenFlagValue(tokens, "--content"),
  };
}

function mariWikiTitle(info: NonNullable<ReturnType<typeof extractMariWikiCommand>>) {
  switch (info.action) {
    case "find":
    case "find-wikis":
      return "Finding Fandom wikis";
    case "search-all":
      return "Searching Fandom pages";
    case "search":
    case "search-wiki":
      return "Searching wiki";
    case "get":
    case "get-page":
      return "Reading wiki page";
    case "pages":
      return "Reading wiki pages";
    case "sections":
      return "Reading wiki sections";
    case "category":
    case "category-members":
      return "Listing wiki category";
    case "site-info":
      return "Checking wiki site info";
    case "search-in-page":
      return "Searching inside wiki page";
    case "help":
      return "Opening wiki command help";
    default:
      return `Running mari wiki ${info.action}`;
  }
}

function mariWikiDetail(info: NonNullable<ReturnType<typeof extractMariWikiCommand>>) {
  const detail = info.title ?? info.category ?? info.pageUrl ?? info.wiki ?? info.query ?? info.content;
  return detail ? compactCommand(detail, 70) : null;
}

function extractMariStorageCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || tokens[1] !== "storage") return null;
  return {
    action: looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "help"),
  };
}

function extractMariGenericCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  const group = looksLikeHelpToken(tokens[1]) ? "help" : (tokens[1] ?? "help");
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "help");
  return { group, action };
}

function mariGenericTitle(info: NonNullable<ReturnType<typeof extractMariGenericCommand>>) {
  if (info.group === "help") return "Opening Mari CLI help";
  if (info.group === "storage") return "Checking reserved storage command";
  if (info.action === "help") return `Opening mari ${info.group} help`;
  return `Running mari ${info.group} ${info.action}`;
}

function mariGenericDetail(info: NonNullable<ReturnType<typeof extractMariGenericCommand>>) {
  if (info.group === "help") return null;
  return info.action === "help" ? info.group : `${info.group} ${info.action}`;
}

function toolInputPath(tool: WorkspaceToolCall) {
  const input = asRecord(tool.input);
  const candidate = input?.path ?? input?.file ?? input?.filePath ?? input?.file_path ?? input?.uri ?? tool.detail;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function skillNameFromPath(path: string) {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  const file = parts[parts.length - 1]?.toLowerCase();
  const parent = file === "skill.md" ? parts[parts.length - 2] : parts[parts.length - 1];
  return humanizeIdentifier(parent ?? "skill");
}

function getSkillReadPresentation(tool: WorkspaceToolCall): ToolPresentation | null {
  const path = toolInputPath(tool);
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  if (!normalized.endsWith("/skill.md") && normalized !== "skill.md") return null;
  const professorMariSkill = normalized.includes("/.mari-workspace/skills/");
  const skillName = skillNameFromPath(path);
  return {
    eyebrow: professorMariSkill ? "Mari skill" : "Skill",
    title: professorMariSkill ? "Loading Professor Mari skill" : `Loading ${skillName}`,
    detail: professorMariSkill ? skillName : null,
    tone: "skill",
  };
}

function summarizeShellCommand(command: string) {
  const compact = compactCommand(command, 120);
  const words = splitShellWords(command);
  if (words[0] === "pnpm" && words[1]) return `Running pnpm ${words[1]}`;
  if (words[0] === "git" && words[1]) return `Running git ${words[1]}`;
  if (words[0] === "node") return "Running node script";
  return compact ? `$ ${compact}` : "Running shell command";
}

function inferToolPresentation(tool: WorkspaceToolCall): ToolPresentation {
  const name = formatToolName(tool.name);
  const command = getBashCommand(tool);
  const mariDb = command ? extractMariDbCommand(command) : null;
  const mariCode = command ? extractMariCodeCommand(command) : null;
  const mariThemes = command ? extractMariThemesCommand(command) : null;
  const mariImages = command ? extractMariImagesCommand(command) : null;
  const mariWiki = command ? extractMariWikiCommand(command) : null;
  const mariStorage = command ? extractMariStorageCommand(command) : null;
  const mariGeneric = command ? extractMariGenericCommand(command) : null;
  if (command && mariDb) {
    return {
      eyebrow: mariDb.dryRun ? "DB preview" : "Database",
      title: mariDbTitle(mariDb),
      detail: mariDbDetail(mariDb),
      tone: "db",
    };
  }
  if (command && mariCode) {
    return {
      eyebrow: "Workspace",
      title: mariCodeTitle(mariCode),
      detail: mariCodeDetail(mariCode),
      tone: "shell",
    };
  }
  if (command && mariThemes) {
    return {
      eyebrow: mariThemes.dryRun ? "Theme preview" : "Theme",
      title: mariThemesTitle(mariThemes),
      detail: mariThemesDetail(mariThemes),
      tone: "theme",
    };
  }
  if (command && mariImages) {
    return {
      eyebrow: mariImages.mutating ? "Image change" : "Images",
      title: mariImagesTitle(mariImages),
      detail: mariImagesDetail(mariImages),
      tone: mariImages.mutating ? "write" : "image",
    };
  }
  if (command && mariWiki) {
    return {
      eyebrow: "Wiki",
      title: mariWikiTitle(mariWiki),
      detail: mariWikiDetail(mariWiki),
      tone: "wiki",
    };
  }
  if (command && mariStorage) {
    return {
      eyebrow: "Storage",
      title: "Checking reserved storage command",
      detail: mariStorage.action === "help" ? null : mariStorage.action,
      tone: "shell",
    };
  }
  if (command && mariGeneric) {
    return {
      eyebrow: "Mari CLI",
      title: mariGenericTitle(mariGeneric),
      detail: mariGenericDetail(mariGeneric),
      tone: "shell",
    };
  }

  if (command) {
    return {
      eyebrow: "Shell",
      title: summarizeShellCommand(command),
      detail: compactCommand(command, 90),
      tone: "shell",
    };
  }

  const skillPresentation = getSkillReadPresentation(tool);
  if (skillPresentation) return skillPresentation;

  const input = asRecord(tool.input);
  const detail = previewValue(
    input?.path ?? input?.pattern ?? input?.query ?? input?.url ?? input?.command ?? tool.detail,
    90,
  );
  if (/grep|find|search/i.test(name)) {
    return { eyebrow: "Search", title: name === "grep" ? "Searching text" : "Finding files", detail, tone: "search" };
  }
  if (/read|file/i.test(name)) {
    return { eyebrow: "File", title: "Reading file", detail, tone: "file" };
  }
  if (/write|edit/i.test(name)) {
    return {
      eyebrow: "File change",
      title: name.includes("edit") ? "Editing file" : "Writing file",
      detail,
      tone: "write",
    };
  }
  if (name === "ls") {
    return { eyebrow: "Files", title: "Listing folder", detail, tone: "file" };
  }
  return { eyebrow: "Tool", title: name, detail, tone: "generic" };
}

function toolToneClasses(tone: ToolTone) {
  switch (tone) {
    case "db":
    case "skill":
      return "border-[var(--primary)]/20 bg-[var(--primary)]/10";
    case "theme":
      return "border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-highlight-bg)]";
    case "image":
      return "border-sky-400/20 bg-sky-400/10";
    case "wiki":
      return "border-emerald-400/20 bg-emerald-400/10";
    case "write":
      return "border-amber-400/20 bg-amber-400/10";
    case "search":
      return "border-cyan-400/20 bg-cyan-400/10";
    default:
      return "border-[var(--border)]/70 bg-[var(--card)]/70";
  }
}

function ToolGlyph({ tool, tone }: { tool: WorkspaceToolCall; tone: ToolTone }) {
  if (tool.status === "running") return <Loader2 size="0.72rem" className="animate-spin" />;
  if (tool.status === "error") return <AlertTriangle size="0.72rem" />;
  if (tone === "db") return <Database size="0.72rem" />;
  if (tone === "theme") return <Palette size="0.72rem" />;
  if (tone === "image") return <ImageIcon size="0.72rem" />;
  if (tone === "wiki" || tone === "skill") return <BookOpen size="0.72rem" />;
  if (tone === "search") return <Search size="0.72rem" />;
  if (tone === "shell") return <Terminal size="0.72rem" />;
  if (tone === "file" || tone === "write") return <FileText size="0.72rem" />;
  return <Wrench size="0.72rem" />;
}

function renderCompactInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split("\n").flatMap((line, index) => {
    const nodes = applyInlineMarkdown(line, `${keyPrefix}-${index}`);
    return index === 0 ? nodes : [<br key={`${keyPrefix}-br-${index}`} />, ...nodes];
  });
}

const CompactMarkdown = memo(function CompactMarkdown({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const trimmed = content.trim().replace(/\n{3,}/g, "\n\n");
  const rendered = useMemo(
    () => (trimmed ? renderMarkdownBlocks(trimmed, renderCompactInline, "home-mari") : null),
    [trimmed],
  );
  if (!trimmed) return null;
  return (
    <div className="mari-message-content text-[0.8125rem] leading-[1.42] text-[var(--foreground)] [&_.mari-md-codeblock]:my-1.5 [&_.mari-md-codeblock]:max-h-44 [&_.mari-md-heading]:mb-0.5 [&_.mari-md-heading]:mt-1 [&_.mari-md-ol]:my-1 [&_.mari-md-ul]:my-1">
      {rendered}
      {streaming && (
        <span className="ml-1 inline-block h-3 w-1 translate-y-0.5 rounded-full bg-[var(--primary)] opacity-80 animate-pulse" />
      )}
    </div>
  );
});

function ProfessorMariAttachedFiles({
  attachments,
  onRemove,
}: {
  attachments: ProfessorMariAttachment[];
  onRemove?: (index: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((attachment, index) =>
        isProfessorMariImageAttachment(attachment) ? (
          <div key={`${attachment.name}-${index}`} className="relative">
            <a
              href={attachment.data}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]/70"
              title={attachment.name}
            >
              <img
                src={attachment.data}
                alt={attachment.name || "Attached image"}
                className="h-24 w-24 object-cover sm:h-28 sm:w-28"
                draggable={false}
              />
            </a>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1 rounded bg-[var(--background)]/80 p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:text-[var(--primary)]"
                aria-label={localizeUi("ui.chat.homeprofessormarichat.removeAttachment")}
                title={localizeUi("ui.chat.homeprofessormarichat.removeAttachment")}
              >
                <X size="0.75rem" />
              </button>
            )}
          </div>
        ) : (
          <div key={`${attachment.name}-${index}`} className="relative max-w-[14rem]">
            <a
              href={attachment.data}
              target="_blank"
              rel="noreferrer"
              download={attachment.name}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/70 px-2.5 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                onRemove && "pr-8",
              )}
              title={attachment.name}
            >
              <FileText size="0.875rem" className="shrink-0 text-[var(--primary)]" />
              <span className="min-w-0 truncate">{attachment.name}</span>
            </a>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:text-[var(--primary)]"
                aria-label={localizeUi("ui.chat.homeprofessormarichat.removeAttachment")}
                title={localizeUi("ui.chat.homeprofessormarichat.removeAttachment")}
              >
                <X size="0.75rem" />
              </button>
            )}
          </div>
        ),
      )}
    </div>
  );
}

function ProfessorMariAttachmentPreviews({
  attachments,
  isReading,
  onRemove,
}: {
  attachments: ProfessorMariAttachment[];
  isReading: boolean;
  onRemove: (index: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (attachments.length === 0 && !isReading) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((attachment, index) => (
        <div
          key={`${attachment.name}-${index}`}
          className="group relative flex max-w-[9rem] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/70 p-1.5 pr-7"
        >
          {isProfessorMariImageAttachment(attachment) ? (
            <img
              src={attachment.data}
              alt={attachment.name}
              className="h-9 w-9 shrink-0 rounded-md object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground/10 text-[var(--primary)]">
              <FileText size="1rem" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {attachment.name}
          </span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute right-1.5 top-1.5 rounded-md p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label={localizeUi("ui.chat.professormariattachmentpreviews.removeValue1", { value1: attachment.name })}
            title={localizeUi("ui.chat.professormariattachmentpreviews.removeFile")}
          >
            <X size="0.7rem" />
          </button>
        </div>
      ))}
      {isReading && (
        <div className="flex min-h-12 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/70 px-2 text-[0.6875rem] text-[var(--muted-foreground)]">
          <Loader2 size="0.8rem" className="animate-spin" />
          {localizeUi("ui.chat.chatinput.readingFile")}
        </div>
      )}
    </div>
  );
}

function MariAvatar({ active }: { active?: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[var(--secondary)] shadow-sm",
        active ? "mari-chrome-accent-soft-tile mari-accent-animated" : "border-[var(--border)]/70",
      )}
    >
      <img src={MARI_AVATAR_URL} alt="" className="h-full w-full object-cover" draggable={false} />
    </span>
  );
}

function MariReasoningPanel({ thinking, live, forceOpen }: { thinking: string; live?: boolean; forceOpen?: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const lineCount = Math.max(1, thinking.trim().split(/\n+/).length);
  return (
    <details
      open={forceOpen || live || undefined}
      className="group overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--muted)]/20 text-xs text-[var(--muted-foreground)]"
    >
      <summary className="flex min-h-7 cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
        <Brain
          size="0.72rem"
          className={cn("shrink-0", live ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")}
        />
        <span className="text-[var(--foreground)]">{localizeUi("ui.chat.marireasoningpanel.reasoning")}</span>
        <span className="rounded-full bg-[var(--background)]/70 px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.12em] opacity-75">
          {live
            ? localizeUi("ui.chat.marireasoningpanel.live")
            : localizeUi("ui.chat.marireasoningpanel.value1LineValue2", {
                value1: lineCount,
                value2: lineCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
              })}
        </span>
        <span className="ml-auto text-[0.65rem] opacity-60 transition-transform group-open:rotate-90">›</span>
      </summary>
      <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words border-t border-[var(--border)]/50 px-2 py-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
        {thinking.trimEnd()}
      </pre>
    </details>
  );
}

function TranscriptRow({
  marker,
  children,
  className,
}: {
  marker: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2", className)}>
      <div className="flex min-w-0 justify-start pt-0.5">{marker}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function WorkspaceToolEvent({ tool }: { tool: WorkspaceToolCall }) {
  const { t: localizeUi } = useUiTranslation();
  const presentation = inferToolPresentation(tool);
  const isError = tool.status === "error";

  return (
    <TranscriptRow
      marker={
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border bg-[var(--card)] shadow-sm",
            isError
              ? "border-[var(--destructive)]/40 text-[var(--destructive)]"
              : "border-[var(--border)]/70 text-[var(--muted-foreground)]",
          )}
        >
          <ToolGlyph tool={tool} tone={presentation.tone} />
        </span>
      }
    >
      <div className="min-w-0 space-y-1.5">
        <div
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[0.7rem] leading-5 shadow-sm",
            toolToneClasses(presentation.tone),
            isError && "border-[var(--destructive)]/35 bg-[var(--destructive)]/10",
          )}
          title={presentation.detail ?? presentation.title}
        >
          <span className="shrink-0 rounded-full bg-[var(--background)]/70 px-1.5 py-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {presentation.eyebrow}
          </span>
          <span className="min-w-0 truncate font-semibold text-[var(--foreground)]">{presentation.title}</span>
          {presentation.detail && (
            <span className="min-w-0 truncate text-[var(--muted-foreground)]">· {presentation.detail}</span>
          )}
          {isError && (
            <span className="shrink-0 text-[0.65rem] font-semibold text-[var(--destructive)]">
              {localizeUi("ui.chat.workspacetoolevent.needsAttention")}
            </span>
          )}
        </div>
        {isError && tool.output?.trim() && (
          <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/8 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--destructive)]">
            {tool.output.trim()}
          </pre>
        )}
      </div>
    </TranscriptRow>
  );
}

function WorkspaceStatusEvent({ content, active }: { content: string; active?: boolean }) {
  const lower = content.toLowerCase();
  const warning = /\b(failed|cancelled|limit|error|attention)\b/.test(lower);
  const complete = /\b(compacted|completed|done)\b/.test(lower) && !/\b(compacting|retrying|working)\b/.test(lower);
  const working = active && !warning && !complete;
  const Icon = warning ? AlertTriangle : complete ? Check : working ? Loader2 : RefreshCw;
  return (
    <TranscriptRow
      marker={
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border bg-[var(--card)] shadow-sm",
            warning
              ? "border-amber-400/35 text-amber-300"
              : complete
                ? "border-emerald-400/25 text-emerald-300"
                : "border-[var(--primary)]/25 text-[var(--primary)]",
          )}
        >
          <Icon size="0.72rem" className={working ? "animate-spin" : undefined} />
        </span>
      }
      className="text-[0.7rem] text-[var(--muted-foreground)]"
    >
      <span
        className={cn(
          "inline-flex max-w-full rounded-lg border px-2 py-1 leading-5 shadow-sm",
          warning
            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
            : complete
              ? "border-emerald-400/20 bg-emerald-400/10 text-[var(--foreground)]"
              : "border-[var(--primary)]/20 bg-[var(--primary)]/10 text-[var(--foreground)]",
        )}
      >
        {content}
      </span>
    </TranscriptRow>
  );
}

const WorkspaceTimelineEvent = memo(function WorkspaceTimelineEvent({
  item,
  active,
  forceOpenThinking,
}: {
  item: WorkspaceTimelineItem;
  active: boolean;
  forceOpenThinking?: boolean;
}) {
  if (item.type === "text") {
    return (
      <TranscriptRow marker={<MariAvatar active={active} />}>
        <CompactMarkdown content={item.content} streaming={active} />
      </TranscriptRow>
    );
  }
  if (item.type === "thinking") {
    return (
      <TranscriptRow marker={<Brain size="0.78rem" className="mt-1 text-[var(--primary)]" />}>
        <MariReasoningPanel thinking={item.content} live={active} forceOpen={forceOpenThinking} />
      </TranscriptRow>
    );
  }
  if (item.type === "tool") return <WorkspaceToolEvent tool={item.tool} />;
  return <WorkspaceStatusEvent content={item.content} active={active} />;
});

function getActiveTimelineIndex(items: WorkspaceTimelineItem[], active: boolean) {
  if (!active) return -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.type === "tool" && item.tool.status === "running") return index;
    if ((item.type === "text" || item.type === "thinking") && item.content.trim()) return index;
    if (item.type === "status" && item.content.trim()) return index;
  }
  return -1;
}

function WorkspaceTimelineList({
  items,
  active,
  openReasoning = true,
}: {
  items: WorkspaceTimelineItem[];
  active: boolean;
  openReasoning?: boolean;
}) {
  const activeIndex = getActiveTimelineIndex(items, active);
  return (
    <>
      {items.map((item, index) => (
        <WorkspaceTimelineEvent
          key={item.id}
          item={item}
          active={index === activeIndex}
          forceOpenThinking={item.type === "thinking" && openReasoning}
        />
      ))}
    </>
  );
}

const MARI_MESSAGE_ACTIONS_CLASS =
  "mt-1 flex gap-1.5 opacity-100 transition-opacity [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100";
const MARI_MESSAGE_ACTION_BUTTON_CLASS =
  "rounded p-1 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:text-[var(--primary)]";

const CompactMariMessage = memo(function CompactMariMessage({
  message,
  thinking,
  onDelete,
  onEdit,
  onRegenerate,
  canRegenerate = false,
  onRemoveAttachment,
}: {
  message: Message;
  thinking?: string | null;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  canRegenerate?: boolean;
  onRemoveAttachment?: (messageId: string, attachmentIndex: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const content = message.content ?? "";
  const attachments = getProfessorMariAttachments(message);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  if (message.role === "user") {
    return (
      <TranscriptRow
        className="group border-y border-[var(--border)]/60 py-2.5"
        marker={
          <span className="pt-0.5 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-panel-muted)]">
            {localizeUi("ui.chat.compactmarimessage.you")}
          </span>
        }
      >
        {isEditing ? (
          <div className="mt-1">
            <MacroTextarea
              value={editContent}
              onChange={setEditContent}
              rows={8}
              title={localizeUi("ui.chat.homeprofessormarichat.editMessage")}
              ariaLabel={localizeUi("ui.chat.homeprofessormarichat.editMessage")}
              showMacroReference={false}
              showMarkdownPreview={false}
              className="w-full"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                disabled={!editContent.trim()}
                onClick={() => {
                  onEdit?.(message.id, editContent);
                  setIsEditing(false);
                }}
                className="rounded bg-[var(--primary)] px-2 py-1 text-xs text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {localizeUi("ui.noodle.noodlehome.save")}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              >
                {localizeUi("ui.chat.homeprofessormarichat.cancelSelection")}
              </button>
            </div>
          </div>
        ) : (
          <CompactMarkdown content={content} />
        )}
        <ProfessorMariAttachedFiles
          attachments={attachments}
          onRemove={onRemoveAttachment ? (index) => onRemoveAttachment(message.id, index) : undefined}
        />
        {(onDelete || onEdit) && (
          <div className={MARI_MESSAGE_ACTIONS_CLASS}>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  setEditContent(content);
                  setIsEditing(true);
                }}
                className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
                aria-label={localizeUi("ui.chat.homeprofessormarichat.editMessage")}
                title={localizeUi("ui.chat.homeprofessormarichat.editMessage")}
              >
                <Pencil size="0.8rem" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
                aria-label={localizeUi("ui.chat.homeprofessormarichat.deleteMessage")}
                title={localizeUi("ui.chat.homeprofessormarichat.deleteMessage")}
              >
                <Trash2 size="0.8rem" />
              </button>
            )}
          </div>
        )}
      </TranscriptRow>
    );
  }

  const workspaceTrace = getMessageWorkspaceTrace(message);
  if (workspaceTrace) {
    return (
      <div className="group">
        <WorkspaceTimelineList items={timelineItemsFromTrace(workspaceTrace, message)} active={false} openReasoning />
        {(onDelete || (onRegenerate && canRegenerate)) && (
          <div className={MARI_MESSAGE_ACTIONS_CLASS}>
            {onRegenerate && canRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
                aria-label={localizeUi("ui.chat.chatmessage.regenerate")}
                title={localizeUi("ui.chat.chatmessage.regenerate")}
              >
                <RefreshCw size="0.8rem" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
                aria-label={localizeUi("lorebook.editor.batch.delete")}
                title={localizeUi("lorebook.editor.batch.delete")}
              >
                <Trash2 size="0.8rem" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <TranscriptRow className="group" marker={<MariAvatar />}>
        <CompactMarkdown content={content} />
        {(onDelete || (onRegenerate && canRegenerate)) && (
          <div className={MARI_MESSAGE_ACTIONS_CLASS}>
            {onRegenerate && canRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
                aria-label={localizeUi("ui.chat.chatmessage.regenerate")}
                title={localizeUi("ui.chat.chatmessage.regenerate")}
              >
                <RefreshCw size="0.8rem" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                className={MARI_MESSAGE_ACTION_BUTTON_CLASS}
                aria-label={localizeUi("lorebook.editor.batch.delete")}
                title={localizeUi("lorebook.editor.batch.delete")}
              >
                <Trash2 size="0.8rem" />
              </button>
            )}
          </div>
        )}
      </TranscriptRow>
      {thinking && (
        <TranscriptRow marker={<Brain size="0.78rem" className="mt-1 text-[var(--muted-foreground)]" />}>
          <MariReasoningPanel thinking={thinking} />
        </TranscriptRow>
      )}
    </>
  );
});

function LoadingHistoryState() {
  return (
    <div className="flex h-full flex-col justify-end gap-2 px-1 pb-2" aria-live="polite">
      <TranscriptRow marker={<MariAvatar active />}>
        <div className="space-y-1.5 py-1">
          <div className="h-2 w-24 rounded-full bg-[var(--muted)]/45 animate-pulse" />
          <div className="h-2 w-full rounded-full bg-[var(--muted)]/35 animate-pulse" />
          <div className="h-2 w-3/4 rounded-full bg-[var(--muted)]/30 animate-pulse" />
        </div>
      </TranscriptRow>
    </div>
  );
}

function ProfessorMariContextBudgetIndicator({ budget }: { budget: ProfessorMariContextBudget }) {
  const { t: localizeUi } = useUiTranslation();
  const used = formatCompactTokenCount(budget.usedTokens);
  const maximum = formatCompactTokenCount(budget.maxTokens);
  const ariaLabel = localizeUi("ui.chat.homeprofessormarichat.contextBudgetAria", { used, maximum });
  const progressStyle = { "--mari-context-budget": `${budget.percentage}%` } as CSSProperties;

  return (
    <div
      data-component="HomeProfessorMariChat.ContextBudget"
      className="mb-2 space-y-1 px-0.5 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]"
    >
      <div className="flex items-center justify-between gap-3">
        <span>{localizeUi("ui.chat.homeprofessormarichat.contextBudget")}</span>
        <span className="tabular-nums text-[var(--marinara-chat-chrome-panel-text)]">
          {localizeUi("ui.chat.homeprofessormarichat.contextBudgetValue", { used, maximum })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={budget.maxTokens}
        aria-valuenow={Math.min(budget.usedTokens, budget.maxTokens)}
        className="h-1 overflow-hidden rounded-full bg-[var(--muted)]/55"
      >
        <div
          className="h-full w-[var(--mari-context-budget)] rounded-full bg-[var(--primary)] transition-[width] duration-200"
          style={progressStyle}
        />
      </div>
    </div>
  );
}

export function ProfessorMariPixelScene({ active }: { active: boolean }) {
  return (
    <div className="mari-professor-pixel-scene" data-state={active ? "active" : "idle"} aria-hidden="true">
      <div data-part="glow" />
      <div data-part="desk" />
      <img src={MARI_CHIBI_URL} alt="" data-part="sprite" draggable={false} />
      <div data-part="laptop">
        <div data-part="screen">
          <span />
          <span />
          <span />
        </div>
        <div data-part="base">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

function summarizeTables(tables: Record<string, number>) {
  const entries = Object.entries(tables);
  if (entries.length === 0) return "No rows";
  return entries
    .slice(0, 3)
    .map(([table, count]) => `${count} ${table}`)
    .join(", ");
}

function summarizeDeletedRow(change: MariDbPendingApproval["diffPreview"][number]) {
  const name =
    typeof change.before?.name === "string"
      ? change.before.name
      : typeof change.before?.title === "string"
        ? change.before.title
        : null;
  return name ? `${change.table}: ${name}` : `${change.table}: ${change.id}`;
}

function summarizeCreatedRow(change: MariDbPendingApproval["diffPreview"][number]) {
  const data = change.after?.data;
  const dataName = data && typeof data === "object" ? (data as Record<string, unknown>).name : undefined;
  const name =
    typeof change.after?.name === "string"
      ? change.after.name
      : typeof change.after?.title === "string"
        ? change.after.title
        : typeof dataName === "string"
          ? dataName
          : null;
  return name ? `${change.table}: ${name}` : `${change.table}: ${change.id}`;
}

function formatRowPreview(row: Record<string, unknown> | null | undefined) {
  if (!row) return "No row snapshot available.";
  try {
    const text = JSON.stringify(row, null, 2);
    return text.length > 700 ? `${text.slice(0, 700)}\n...` : text;
  } catch {
    return "Row snapshot could not be displayed.";
  }
}

function WorkspaceErrorEvent({ message }: { message: string }) {
  return (
    <TranscriptRow marker={<AlertTriangle size="0.8rem" className="mt-1 text-[var(--destructive)]" />}>
      <div className="py-0.5 text-xs text-[var(--destructive)]">{message}</div>
    </TranscriptRow>
  );
}

function getScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

function DatabaseWorkspaceApprovalCard({
  approval,
  busy,
  disabled,
  onKeep,
  onKeepEnable,
  onRestore,
  onRejectRows,
  onRenderPrompt,
}: {
  approval: MariDbPendingApproval;
  busy: boolean;
  disabled: boolean;
  onKeep: (id: string) => void;
  onKeepEnable?: (id: string) => void;
  onRestore: (id: string) => void;
  onRejectRows?: (
    id: string,
    rows: Array<{ index: number; table: string; id: string; action: string }>,
  ) => Promise<boolean>;
  onRenderPrompt?: (
    id: string,
    row: { index: number; table: string; id: string; action: string },
  ) => Promise<{ before: MariPromptRenderSide; after: MariPromptRenderSide } | null>;
}) {
  const { t: localizeUi } = useUiTranslation();
  // #4931: synthetic prompt-preview modal state for a character/preset row.
  const [promptPreview, setPromptPreview] = useState<{
    loading: boolean;
    error: boolean;
    before: MariPromptRenderSide;
    after: MariPromptRenderSide;
  } | null>(null);
  // Each open/close bumps the token so a late render resolve can't re-open a modal the user closed.
  const renderTokenRef = useRef(0);
  const closePromptPreview = useCallback(() => {
    renderTokenRef.current += 1;
    setPromptPreview(null);
  }, []);
  const handleRenderRow = useCallback(
    async (change: MariDbPendingApproval["diffPreview"][number], index: number) => {
      if (!onRenderPrompt) return;
      const token = (renderTokenRef.current += 1);
      setPromptPreview({ loading: true, error: false, before: null, after: null });
      try {
        const result = await onRenderPrompt(approval.id, {
          index,
          table: change.table,
          id: change.id,
          action: change.action,
        });
        if (renderTokenRef.current !== token) return; // closed or superseded while assembling
        if (result) setPromptPreview({ loading: false, error: false, before: result.before, after: result.after });
        else setPromptPreview({ loading: false, error: true, before: null, after: null });
      } catch {
        if (renderTokenRef.current !== token) return;
        setPromptPreview({ loading: false, error: true, before: null, after: null });
      }
    },
    [onRenderPrompt, approval.id],
  );
  // Easy/Raw is toggled PER CARD (seeded from the saved default), so flipping one card no longer
  // flips the rest.
  const defaultViewMode = useUIStore((s) => s.mariEditViewMode);
  const setDefaultViewMode = useUIStore((s) => s.setMariEditViewMode);
  const [viewMode, setViewMode] = useState<MariEditViewMode>(defaultViewMode);
  // #4931: which rows are collapsed (folded to their name + status summary). Reversible — unlike the
  // old one-way Dismiss.
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(() => new Set());
  const cardRef = useRef<HTMLDivElement>(null);
  const toggleAnchorRef = useRef<number | null>(null);
  // Keep this card anchored in the scroll viewport across a height change so the toggle doesn't
  // shove what the user is reading off-screen.
  const changeViewMode = useCallback(
    (mode: MariEditViewMode) => {
      toggleAnchorRef.current = cardRef.current?.getBoundingClientRect().top ?? null;
      setViewMode(mode);
      // Persist as the saved default so the choice survives this card remounting and new cards open
      // the same way. Already-mounted cards keep their own local state, so one card's toggle still
      // does not flip the others.
      setDefaultViewMode(mode);
    },
    [setDefaultViewMode],
  );
  useLayoutEffect(() => {
    const anchor = toggleAnchorRef.current;
    toggleAnchorRef.current = null;
    if (anchor === null || !cardRef.current) return;
    const delta = cardRef.current.getBoundingClientRect().top - anchor;
    if (Math.abs(delta) < 1) return;
    const scroller = getScrollableAncestor(cardRef.current);
    if (scroller) scroller.scrollTop += delta;
  }, [viewMode]);
  const deletedRows = approval.diffPreview.filter((change) => change.action === "delete");
  const insertedRows = approval.diffPreview.filter((change) => change.action === "insert");
  // #4851: a saved memory lands disabled; offer "Keep & Enable" to keep AND switch it on.
  // Gated to mari_instructions inserts (matches the server-side guard), and only for
  // NON-persistent ones, because enabling a Persistent memory injects its full body every turn, a
  // heavier commitment, so route that through the Memories panel where Persistent is visible.
  const enableableMemoryInsert = insertedRows.some((change) => {
    if (change.table !== "mari_instructions") return false;
    const after = change.after as { enabled?: unknown; persistent?: unknown } | null;
    return Number(after?.enabled) !== 1 && Number(after?.persistent) !== 1;
  });

  return (
    <TranscriptRow marker={<ShieldAlert size="0.85rem" className="mt-1 text-[var(--primary)]" />}>
      <div
        ref={cardRef}
        className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3 text-xs text-[var(--foreground)]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-semibold">
            {localizeUi("ui.chat.databaseworkspaceapprovalcard.reviewMariSChanges")}
          </span>
          <span className="rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[0.625rem] text-[var(--primary)]">
            {localizeUi("ui.chat.databaseworkspaceapprovalcard.saved")}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-md bg-[var(--background)]/60 p-0.5">
            <button
              type="button"
              onClick={() => changeViewMode("easy")}
              aria-pressed={viewMode === "easy"}
              className={cn(
                "rounded px-1.5 py-0.5 text-[0.625rem] font-medium transition-colors",
                viewMode === "easy"
                  ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              {localizeUi("ui.chat.databaseworkspaceapprovalcard.easyView")}
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("raw")}
              aria-pressed={viewMode === "raw"}
              className={cn(
                "rounded px-1.5 py-0.5 text-[0.625rem] font-medium transition-colors",
                viewMode === "raw"
                  ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              {localizeUi("ui.chat.databaseworkspaceapprovalcard.rawView")}
            </button>
          </div>
        </div>
        <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.databaseworkspaceapprovalcard.mariAlreadyAppliedThisKeepItOrRestoreThe")}
        </p>
        {viewMode === "raw" && (
          <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--background)]/80 p-2 font-mono text-[0.6875rem] text-[var(--muted-foreground)]">
            {approval.command}
          </pre>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1">
            <Database size="0.7rem" /> {summarizeTables(approval.affectedTables)}
          </span>
          <span>
            {approval.affectedRows} {localizeUi("ui.chat.databaseworkspaceapprovalcard.row")}
            {approval.affectedRows === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
          </span>
        </div>
        {viewMode === "raw" && approval.diffTruncated && (
          <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.databaseworkspaceapprovalcard.thisPreviewMayNotShowEveryAffectedRow")}
          </p>
        )}
        {viewMode === "easy" && (
          <MariEditEasyViewer
            approval={approval}
            collapsed={collapsedRows}
            onToggleCollapse={(key) =>
              setCollapsedRows((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            onRejectRow={
              onRejectRows
                ? (change, index) => {
                    void (async () => {
                      const reverted = await onRejectRows(approval.id, [
                        { index, table: change.table, id: change.id, action: change.action },
                      ]);
                      // A successful reject prunes the row, shifting every later index, so the
                      // positional collapse keys go stale — reset them then. On a no-op (state_changed
                      // / invalid_selection) diffPreview is unchanged, so keep the collapse state.
                      if (reverted) setCollapsedRows(new Set());
                    })();
                  }
                : undefined
            }
            onRenderRow={onRenderPrompt ? handleRenderRow : undefined}
            busy={busy || disabled}
          />
        )}
        {viewMode === "raw" && deletedRows.length > 0 && (
          <div className="mt-2 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-2 text-[0.6875rem] text-[var(--foreground)]">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--destructive)]">
              <Trash2 size="0.75rem" />
              {localizeUi("ui.chat.databaseworkspaceapprovalcard.mariDeleted")} {deletedRows.length}{" "}
              {localizeUi("ui.chat.databaseworkspaceapprovalcard.item")}
              {deletedRows.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}.
            </div>
            <p className="mt-1 text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.databaseworkspaceapprovalcard.restoreWillPutTheSavedRowSnapshotBack")}
            </p>
            <div className="mt-2 space-y-2">
              {deletedRows.slice(0, 3).map((change) => (
                <details key={`${change.table}:${change.id}`} className="rounded-md bg-[var(--background)]/80 p-2">
                  <summary className="cursor-pointer font-medium text-[var(--foreground)]">
                    {summarizeDeletedRow(change)}
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[0.625rem] text-[var(--muted-foreground)]">
                    {formatRowPreview(change.before)}
                  </pre>
                </details>
              ))}
              {deletedRows.length > 3 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {deletedRows.length - 3} {localizeUi("ui.chat.databaseworkspaceapprovalcard.moreDelete")}
                  {deletedRows.length - 3 === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}{" "}
                  {localizeUi("ui.chat.databaseworkspaceapprovalcard.hiddenInThisPreview")}
                </p>
              )}
            </div>
          </div>
        )}
        {viewMode === "raw" && insertedRows.length > 0 && (
          <div className="mt-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-2 text-[0.6875rem] text-[var(--foreground)]">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--primary)]">
              <Sparkles size="0.75rem" />
              {localizeUi("ui.chat.databaseworkspaceapprovalcard.mariCreatedNewItems")}
            </div>
            <p className="mt-1 text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.databaseworkspaceapprovalcard.keepSavesThemToYourLibraryRestoreRemovesEverything")}
            </p>
            <div className="mt-2 space-y-2">
              {insertedRows.slice(0, 3).map((change) => (
                <details key={`${change.table}:${change.id}`} className="rounded-md bg-[var(--background)]/80 p-2">
                  <summary className="cursor-pointer font-medium text-[var(--foreground)]">
                    {summarizeCreatedRow(change)}
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[0.625rem] text-[var(--muted-foreground)]">
                    {formatRowPreview(change.after)}
                  </pre>
                </details>
              ))}
              {insertedRows.length > 3 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.databaseworkspaceapprovalcard.moreNewItemsAreHiddenInThisPreview")}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="mt-2 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onRestore(approval.id)}
            disabled={busy || disabled}
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="inline-flex items-center gap-1">
              <RefreshCw size="0.7rem" />
              {localizeUi("ui.chat.databaseworkspaceapprovalcard.restore")}
            </span>
          </button>
          {enableableMemoryInsert && onKeepEnable && (
            <button
              type="button"
              onClick={() => onKeepEnable(approval.id)}
              disabled={busy || disabled}
              className="rounded-md border border-[var(--primary)]/50 bg-[var(--primary)]/10 px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="inline-flex items-center gap-1">
                <Check size="0.7rem" />
                {localizeUi("ui.chat.databaseworkspaceapprovalcard.keepAndEnable")}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onKeep(approval.id)}
            disabled={busy || disabled}
            className="rounded-md bg-[var(--primary)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="inline-flex items-center gap-1">
              {busy ? <Loader2 size="0.7rem" className="animate-spin" /> : <Check size="0.7rem" />}
              {busy
                ? localizeUi("ui.noodle.stageprofileform.saving")
                : localizeUi("ui.chat.databaseworkspaceapprovalcard.keep")}
            </span>
          </button>
        </div>
      </div>
      {promptPreview && (
        <MariPromptPreviewModal
          title={localizeUi("ui.chat.maripromptpreviewmodal.title")}
          loading={promptPreview.loading}
          error={promptPreview.error}
          before={promptPreview.before}
          after={promptPreview.after}
          onClose={closePromptPreview}
        />
      )}
    </TranscriptRow>
  );
}

function DependencyWorkspaceApprovalCard({
  approval,
  busy,
  disabled,
  onApprove,
  onDiscard,
}: {
  approval: MariDependencyInstallApproval;
  busy: boolean;
  disabled: boolean;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <TranscriptRow marker={<PackagePlus size="0.85rem" className="mt-1 text-[var(--primary)]" />}>
      <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3 text-xs text-[var(--foreground)]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-semibold">
            {localizeUi("ui.chat.dependencyworkspaceapprovalcard.installThisDependency")}
          </span>
          <span className="rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[0.625rem] text-[var(--primary)]">
            {localizeUi("ui.chat.dependencyworkspaceapprovalcard.notInstalled")}
          </span>
        </div>
        <p className="mt-1 max-w-[70ch] text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.dependencyworkspaceapprovalcard.professorMariRequestedAnExactPublicNpmPackageMarinara")}
        </p>
        <div className="mt-2 rounded-lg bg-[var(--background)]/80 p-2">
          <div className="break-all font-mono text-[0.75rem] font-semibold text-[var(--foreground)]">
            {approval.packageName}@{approval.version}
          </div>
          <div className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
            {approval.target} · {approval.dependencyType}
          </div>
          <div className="mt-2 break-all font-mono text-[0.625rem] text-[var(--muted-foreground)]">
            {approval.integrity}
          </div>
          <div className="mt-2 break-words text-[0.6875rem] text-[var(--muted-foreground)]">
            {approval.directDependencies.length === 0
              ? localizeUi("ui.chat.dependencyworkspaceapprovalcard.noDirectDependenciesDeclared")
              : localizeUi("ui.chat.dependencyworkspaceapprovalcard.value1DirectValue2Value3Value4", {
                  value1: approval.directDependencies.length,
                  value2:
                    approval.directDependencies.length === 1
                      ? localizeUi("ui.chat.dependencyworkspaceapprovalcard.dependency")
                      : localizeUi("ui.chat.dependencyworkspaceapprovalcard.dependencies"),
                  value3: approval.directDependencies
                    .slice(0, 6)
                    .map((dependency) => `${dependency.name} ${dependency.range}`)
                    .join(", "),
                  value4:
                    approval.directDependencies.length > 6
                      ? localizeUi("ui.chat.dependencyworkspaceapprovalcard.andMore")
                      : "",
                })}
          </div>
        </div>
        {approval.reason && <p className="mt-2 text-[0.6875rem] text-[var(--muted-foreground)]">{approval.reason}</p>}
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onDiscard(approval.id)}
            disabled={busy || disabled}
            className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1.5 text-[0.6875rem] font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {localizeUi("ui.chat.dependencyworkspaceapprovalcard.notNow")}
          </button>
          <button
            type="button"
            onClick={() => onApprove(approval.id)}
            disabled={busy || disabled}
            className="min-h-9 rounded-md bg-[var(--primary)] px-3 py-1.5 text-[0.6875rem] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="inline-flex items-center justify-center gap-1">
              {busy ? <Loader2 size="0.75rem" className="animate-spin" /> : <PackagePlus size="0.75rem" />}
              {busy
                ? localizeUi("ui.chat.dependencyworkspaceapprovalcard.installing")
                : localizeUi("ui.agents.agentcatalogview.install")}
            </span>
          </button>
        </div>
      </div>
    </TranscriptRow>
  );
}

function SensitiveFileWorkspaceApprovalCard({
  approval,
  busy,
  disabled,
  onApprove,
  onDiscard,
}: {
  approval: MariSensitiveFileApproval;
  busy: boolean;
  disabled: boolean;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <TranscriptRow marker={<ShieldAlert size="0.85rem" className="mt-1 text-[var(--primary)]" />}>
      <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3 text-xs text-[var(--foreground)]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-semibold">
            {localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.applySensitiveFileChange")}
          </span>
          <span className="rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[0.625rem] text-[var(--primary)]">
            {localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.staged")}
          </span>
        </div>
        <p className="mt-1 max-w-[70ch] text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi(
            "ui.chat.sensitivefileworkspaceapprovalcard.thisFileCanAffectDependenciesStartupInstallationOrAutomation",
          )}
        </p>
        <div className="mt-2 break-all rounded-lg bg-[var(--background)]/80 p-2 font-mono text-[0.75rem] font-semibold">
          {approval.path}
        </div>
        <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          {approval.changeType === "create"
            ? localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.thisFileDoesNotExistYetApprovingCreatesIt")
            : localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.thisWillOverwriteTheExistingFile")}
        </p>
        <details className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/60 p-2">
          <summary className="cursor-pointer text-[0.6875rem] font-semibold">
            {localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.reviewProposedContent")}
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.625rem] text-[var(--muted-foreground)]">
            {approval.preview}
            {approval.previewTruncated ? "\n\nPreview truncated." : ""}
          </pre>
        </details>
        {approval.reason && <p className="mt-2 text-[0.6875rem] text-[var(--muted-foreground)]">{approval.reason}</p>}
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onDiscard(approval.id)}
            disabled={busy || disabled}
            className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1.5 text-[0.6875rem] font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {localizeUi("ui.agents.agenteditor.discard")}
          </button>
          <button
            type="button"
            onClick={() => onApprove(approval.id)}
            disabled={busy || disabled}
            className="min-h-9 rounded-md bg-[var(--primary)] px-3 py-1.5 text-[0.6875rem] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="inline-flex items-center justify-center gap-1">
              {busy ? <Loader2 size="0.75rem" className="animate-spin" /> : <Check size="0.75rem" />}
              {busy
                ? localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.applying")
                : localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.applyChange")}
            </span>
          </button>
        </div>
      </div>
    </TranscriptRow>
  );
}

function WorkspaceApprovalCard({
  approval,
  busy,
  disabled,
  onKeep,
  onKeepEnable,
  onRestore,
  onRejectRows,
  onRenderPrompt,
}: {
  approval: MariWorkspacePendingApproval;
  busy: boolean;
  disabled: boolean;
  onKeep: (id: string) => void;
  onKeepEnable?: (id: string) => void;
  onRestore: (id: string) => void;
  onRejectRows?: (
    id: string,
    rows: Array<{ index: number; table: string; id: string; action: string }>,
  ) => Promise<boolean>;
  onRenderPrompt?: (
    id: string,
    row: { index: number; table: string; id: string; action: string },
  ) => Promise<{ before: MariPromptRenderSide; after: MariPromptRenderSide } | null>;
}) {
  if (approval.kind === "dependency_install") {
    return (
      <DependencyWorkspaceApprovalCard
        approval={approval}
        busy={busy}
        disabled={disabled}
        onApprove={onKeep}
        onDiscard={onRestore}
      />
    );
  }
  if (approval.kind === "sensitive_file") {
    return (
      <SensitiveFileWorkspaceApprovalCard
        approval={approval}
        busy={busy}
        disabled={disabled}
        onApprove={onKeep}
        onDiscard={onRestore}
      />
    );
  }
  return (
    <DatabaseWorkspaceApprovalCard
      approval={approval}
      busy={busy}
      disabled={disabled}
      onKeep={onKeep}
      onKeepEnable={onKeepEnable}
      onRestore={onRestore}
      onRejectRows={onRejectRows}
      onRenderPrompt={onRenderPrompt}
    />
  );
}

// #4868: client-side sort for the Skills/Memories panels. Deliberately keyed on name or
// createdAt, never updatedAt, so saving or toggling a row does NOT reorder it (which used to
// snap the open editor out of view). Persistent memories are pinned above the rest by the caller.
function compareMariPanelItems(
  a: { name: string; createdAt: string },
  b: { name: string; createdAt: string },
  mode: MariPanelSortMode,
): number {
  switch (mode) {
    case "za":
      return b.name.localeCompare(a.name);
    case "newest":
      return String(b.createdAt).localeCompare(String(a.createdAt));
    case "oldest":
      return String(a.createdAt).localeCompare(String(b.createdAt));
    default:
      return a.name.localeCompare(b.name);
  }
}

const MARI_PANEL_SORT_OPTIONS: MariPanelSortMode[] = ["az", "za", "newest", "oldest"];

function MariPanelSortSelect({
  value,
  onChange,
}: {
  value: MariPanelSortMode;
  onChange: (mode: MariPanelSortMode) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const labels: Record<MariPanelSortMode, string> = {
    az: localizeUi("ui.chat.homeprofessormarichat.sortAToZ"),
    za: localizeUi("ui.chat.homeprofessormarichat.sortZToA"),
    newest: localizeUi("ui.chat.homeprofessormarichat.sortNewest"),
    oldest: localizeUi("ui.chat.homeprofessormarichat.sortOldest"),
  };
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as MariPanelSortMode)}
      aria-label={localizeUi("ui.chat.homeprofessormarichat.sortLabel")}
      title={localizeUi("ui.chat.homeprofessormarichat.sortLabel")}
      className="h-8 shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55"
    >
      {MARI_PANEL_SORT_OPTIONS.map((mode) => (
        <option key={mode} value={mode}>
          {labels[mode]}
        </option>
      ))}
    </select>
  );
}

function ProfessorMariSkillsMenu({
  skills,
  selectedSkill,
  draft,
  loading,
  saving,
  diagnostics,
  fileInputRef,
  onClose,
  onNew,
  onUploadClick,
  onFileChange,
  onSelect,
  onDraftChange,
  onSave,
  onDelete,
  onToggle,
  className,
}: {
  skills: MariWorkspaceSkillDetail[];
  selectedSkill: MariWorkspaceSkillDetail | null;
  draft: SkillDraftState;
  loading: boolean;
  saving: boolean;
  diagnostics: string[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onNew: () => void;
  onUploadClick: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelect: (id: string | null) => void;
  onDraftChange: (draft: SkillDraftState) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onToggle: (skill: MariWorkspaceSkillDetail) => void;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const enabledCount = skills.filter((skill) => skill.enabled).length;
  const hasSkills = skills.length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  // Pure textual match: drives the noMatches message. The open (selected) row is re-added in
  // `displayed` below so its editor stays visible even when the search excludes it.
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? skills.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(normalizedQuery))
        : skills,
    [skills, normalizedQuery],
  );
  const sortMode = useUIStore((s) => s.mariPanelSortMode);
  const setSortMode = useUIStore((s) => s.setMariPanelSortMode);
  const displayed = useMemo(() => {
    // Re-add the open (selected) row BEFORE sorting so it lands in its correct sorted position,
    // not appended out of order at the end.
    const candidates =
      selectedSkill && !filtered.some((skill) => skill.id === selectedSkill.id)
        ? [...filtered, selectedSkill]
        : filtered;
    return [...candidates].sort((a, b) => compareMariPanelItems(a, b, sortMode));
  }, [filtered, sortMode, selectedSkill]);
  // Keep the open editor in view when its row moves (selection change, or a rename that re-sorts it).
  const activeEditorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeEditorRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedSkill?.id, selectedSkill?.updatedAt, sortMode, normalizedQuery]);

  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/70",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 px-3 py-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <ArrowDown size="0.9rem" className="shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]" />
            <span className="truncate text-xs font-semibold text-[var(--foreground)]">
              {localizeUi("ui.chat.professormariskillsmenu.professorMariSkills")}
            </span>
          </div>
          {hasSkills && (
            <div className="mt-0.5 truncate text-[0.6875rem] text-[var(--muted-foreground)]">
              {enabledCount} {localizeUi("ui.chat.professormariskillsmenu.active")} {skills.length}{" "}
              {localizeUi("ui.chat.professormariskillsmenu.total")}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          aria-label={t("home.professorMari.skills.close")}
          title={t("home.professorMari.skills.close")}
        >
          <X size="0.95rem" />
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border)]/50 px-2.5 py-2">
        <button
          type="button"
          onClick={() => {
            setQuery("");
            onNew();
          }}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[0.6875rem] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size="0.78rem" />
          {localizeUi("ui.lorebooks.lorebookassignmentsection.new")}
        </button>
        <button
          type="button"
          onClick={onUploadClick}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[0.6875rem] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileUp size="0.78rem" />
          {localizeUi("ui.characters.characterclipcard.upload")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {hasSkills && (
        <div className="shrink-0 border-b border-[var(--border)]/50 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search
                size="0.8rem"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={localizeUi("ui.chat.professormariskillsmenu.searchPlaceholder")}
                aria-label={localizeUi("ui.chat.professormariskillsmenu.searchPlaceholder")}
                className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] pl-7 pr-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55"
              />
            </div>
            <MariPanelSortSelect value={sortMode} onChange={setSortMode} />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {!loading && hasSkills && filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.professormariskillsmenu.noMatches")}
            </div>
          )}
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-10 animate-pulse rounded-lg bg-[var(--muted)]/30" />
              <div className="h-10 animate-pulse rounded-lg bg-[var(--muted)]/20" />
            </div>
          ) : !hasSkills ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.professormariskillsmenu.noCustomSkillsYet")}
            </div>
          ) : (
            displayed.map((skill) => {
              const active = selectedSkill?.id === skill.id;
              return (
                <div
                  key={skill.id}
                  className={cn(
                    "group w-full min-w-0 overflow-hidden rounded-lg border transition-colors",
                    active
                      ? "border-[var(--primary)]/45 bg-[var(--primary)]/10"
                      : "border-[var(--border)]/70 bg-[var(--card)]/70 hover:bg-[var(--accent)]/70",
                  )}
                >
                  <div className="flex w-full min-w-0 items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect(active ? null : skill.id)}
                      aria-expanded={active}
                      className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                    >
                      <ChevronRight
                        size="0.8rem"
                        className={cn(
                          "shrink-0 text-[var(--muted-foreground)] transition-transform",
                          active && "rotate-90",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.75rem] font-semibold text-[var(--foreground)]">
                          {skill.name}
                        </span>
                        {skill.description && (
                          <span className="mt-0.5 hidden truncate text-[0.65rem] text-[var(--muted-foreground)] md:block">
                            {skill.description}
                          </span>
                        )}
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center pr-1">
                      <SettingsSwitch
                        ariaLabel={
                          skill.enabled
                            ? localizeUi("ui.chat.professormariskillsmenu.disableSkill")
                            : localizeUi("ui.chat.professormariskillsmenu.enableSkill")
                        }
                        title={
                          skill.enabled
                            ? localizeUi("ui.noodle.noodlehome.enabled")
                            : localizeUi("ui.agents.agenteditor.disabled")
                        }
                        checked={skill.enabled}
                        onChange={() => onToggle(skill)}
                        disabled={saving}
                        className="p-0 hover:bg-transparent"
                      />
                    </span>
                  </div>
                  {active && (
                    <div
                      ref={active ? activeEditorRef : undefined}
                      className="space-y-2 border-t border-[var(--border)]/50 px-2.5 py-2.5"
                    >
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("ui.characters.metadatatab.name")}
                        <input
                          value={draft.name}
                          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                          disabled={saving}
                          className="mt-1 h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("chat.settings.inlineEditor.fields.description")}
                        <input
                          value={draft.description}
                          onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
                          disabled={saving}
                          className="mt-1 h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.professormariskillsmenu.instructions")}
                        <textarea
                          value={draft.content}
                          onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
                          disabled={saving}
                          rows={9}
                          className="mt-1 min-h-40 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2 font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onDelete(skill.id)}
                          disabled={saving}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.6875rem] font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Trash2 size="0.75rem" />
                          {localizeUi("lorebook.editor.batch.delete")}
                        </button>
                        <button
                          type="button"
                          onClick={onSave}
                          disabled={saving}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--primary)] px-2.5 text-[0.6875rem] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {saving ? <Loader2 size="0.75rem" className="animate-spin" /> : <Save size="0.75rem" />}
                          {localizeUi("ui.noodle.noodlehome.save")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {diagnostics.length > 0 && (
          <div className="mx-2 mb-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-2 text-[0.6875rem] text-amber-200">
            {diagnostics[0]}
          </div>
        )}
      </div>
    </section>
  );
}

// #4851: the Memories management panel, next to Skills. Mirrors ProfessorMariSkillsMenu;
// adds a Persistent toggle (with a "keep it small" tooltip) and drops file diagnostics
// (memories are DB-backed). Enable + Persistent are direct toggles; name/description/
// content save together.
function ProfessorMariMemoriesMenu({
  memories,
  selectedMemory,
  draft,
  loading,
  saving,
  fileInputRef,
  onClose,
  onNew,
  onUploadClick,
  onFileChange,
  onSelect,
  onDraftChange,
  onSave,
  onDelete,
  onToggleEnabled,
  onTogglePersistent,
  className,
}: {
  memories: MariInstructionDetail[];
  selectedMemory: MariInstructionDetail | null;
  draft: MemoryDraftState;
  loading: boolean;
  saving: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onNew: () => void;
  onUploadClick: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelect: (id: string | null) => void;
  onDraftChange: (draft: MemoryDraftState) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (memory: MariInstructionDetail) => void;
  onTogglePersistent: (memory: MariInstructionDetail) => void;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [query, setQuery] = useState("");
  const enabledCount = memories.filter((memory) => memory.enabled).length;
  const hasMemories = memories.length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  // Pure textual match: drives the noMatches message. The open (selected) row is re-added in
  // `displayed` below so its editor stays visible even when the search excludes it.
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? memories.filter((memory) => `${memory.name} ${memory.description}`.toLowerCase().includes(normalizedQuery))
        : memories,
    [memories, normalizedQuery],
  );
  const sortMode = useUIStore((s) => s.mariPanelSortMode);
  const setSortMode = useUIStore((s) => s.setMariPanelSortMode);
  const displayed = useMemo(() => {
    // Re-add the open (selected) row BEFORE sorting/partitioning so it lands in its correct group
    // and sorted position, not appended out of order at the end.
    const candidates =
      selectedMemory && !filtered.some((memory) => memory.id === selectedMemory.id)
        ? [...filtered, selectedMemory]
        : filtered;
    const sorted = [...candidates].sort((a, b) => compareMariPanelItems(a, b, sortMode));
    // Persistent memories are pinned above the rest; each group keeps the chosen sort order.
    return [...sorted.filter((memory) => memory.persistent), ...sorted.filter((memory) => !memory.persistent)];
  }, [filtered, sortMode, selectedMemory]);
  // Keep the open editor in view when its row moves (selection change, persistent toggle, or a rename).
  const activeEditorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeEditorRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedMemory?.id, selectedMemory?.persistent, selectedMemory?.updatedAt, sortMode, normalizedQuery]);

  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/70",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 px-3 py-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Brain size="0.9rem" className="shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]" />
            <span className="truncate text-xs font-semibold text-[var(--foreground)]">
              {localizeUi("ui.chat.professormarimemoriesmenu.professorMariMemories")}
            </span>
          </div>
          {hasMemories && (
            <div className="mt-0.5 truncate text-[0.6875rem] text-[var(--muted-foreground)]">
              {enabledCount} {localizeUi("ui.chat.professormariskillsmenu.active")} {memories.length}{" "}
              {localizeUi("ui.chat.professormariskillsmenu.total")}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          aria-label={localizeUi("ui.chat.professormarimemoriesmenu.close")}
          title={localizeUi("ui.chat.professormarimemoriesmenu.close")}
        >
          <X size="0.95rem" />
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border)]/50 px-2.5 py-2">
        <button
          type="button"
          onClick={() => {
            setQuery("");
            onNew();
          }}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[0.6875rem] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size="0.78rem" />
          {localizeUi("ui.lorebooks.lorebookassignmentsection.new")}
        </button>
        <button
          type="button"
          onClick={onUploadClick}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[0.6875rem] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileUp size="0.78rem" />
          {localizeUi("ui.characters.characterclipcard.upload")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {hasMemories && (
        <div className="shrink-0 border-b border-[var(--border)]/50 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search
                size="0.8rem"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={localizeUi("ui.chat.professormarimemoriesmenu.searchPlaceholder")}
                aria-label={localizeUi("ui.chat.professormarimemoriesmenu.searchPlaceholder")}
                className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] pl-7 pr-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55"
              />
            </div>
            <MariPanelSortSelect value={sortMode} onChange={setSortMode} />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {!loading && hasMemories && filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.professormarimemoriesmenu.noMatches")}
            </div>
          )}
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-10 animate-pulse rounded-lg bg-[var(--muted)]/30" />
              <div className="h-10 animate-pulse rounded-lg bg-[var(--muted)]/20" />
            </div>
          ) : !hasMemories ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.professormarimemoriesmenu.noMemoriesYet")}
            </div>
          ) : (
            displayed.map((memory) => {
              const active = selectedMemory?.id === memory.id;
              return (
                <div
                  key={memory.id}
                  className={cn(
                    "group w-full min-w-0 overflow-hidden rounded-lg border transition-colors",
                    active
                      ? "border-[var(--primary)]/45 bg-[var(--primary)]/10"
                      : "border-[var(--border)]/70 bg-[var(--card)]/70 hover:bg-[var(--accent)]/70",
                  )}
                >
                  <div className="flex w-full min-w-0 items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect(active ? null : memory.id)}
                      aria-expanded={active}
                      className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                    >
                      {memory.persistent && (
                        <Star
                          size="0.72rem"
                          aria-label={localizeUi("ui.chat.professormarimemoriesmenu.persistent")}
                          className="shrink-0 fill-[var(--primary)] text-[var(--primary)]"
                        />
                      )}
                      <ChevronRight
                        size="0.8rem"
                        className={cn(
                          "shrink-0 text-[var(--muted-foreground)] transition-transform",
                          active && "rotate-90",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.75rem] font-semibold text-[var(--foreground)]">
                          {memory.name}
                        </span>
                        {memory.description && (
                          <span className="mt-0.5 hidden truncate text-[0.65rem] text-[var(--muted-foreground)] md:block">
                            {memory.description}
                          </span>
                        )}
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center pr-1">
                      <SettingsSwitch
                        ariaLabel={
                          memory.enabled
                            ? localizeUi("ui.chat.professormarimemoriesmenu.disableMemory")
                            : localizeUi("ui.chat.professormarimemoriesmenu.enableMemory")
                        }
                        title={
                          memory.enabled
                            ? localizeUi("ui.noodle.noodlehome.enabled")
                            : localizeUi("ui.agents.agenteditor.disabled")
                        }
                        checked={memory.enabled}
                        onChange={() => onToggleEnabled(memory)}
                        disabled={saving}
                        className="p-0 hover:bg-transparent"
                      />
                    </span>
                  </div>
                  {active && (
                    <div
                      ref={active ? activeEditorRef : undefined}
                      className="space-y-2 border-t border-[var(--border)]/50 px-2.5 py-2.5"
                    >
                      {!memory.enabled && (
                        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[0.65rem] text-amber-200">
                          {localizeUi("ui.chat.professormarimemoriesmenu.disabledHint")}
                        </div>
                      )}
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("ui.characters.metadatatab.name")}
                        <input
                          value={draft.name}
                          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                          disabled={saving}
                          className="mt-1 h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("chat.settings.inlineEditor.fields.description")}
                        <input
                          value={draft.description}
                          onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
                          disabled={saving}
                          className="mt-1 h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.professormarimemoriesmenu.memory")}
                        <textarea
                          value={draft.content}
                          onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
                          disabled={saving}
                          rows={9}
                          className="mt-1 min-h-40 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2 font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <div
                        className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)]/60 bg-[var(--card)]/60 px-2.5 py-1.5"
                        title={localizeUi("ui.chat.professormarimemoriesmenu.persistentHint")}
                      >
                        <span className="min-w-0">
                          <span className="block text-[0.6875rem] font-semibold text-[var(--foreground)]">
                            {localizeUi("ui.chat.professormarimemoriesmenu.persistent")}
                          </span>
                          <span className="mt-0.5 block text-[0.6rem] leading-snug text-[var(--muted-foreground)]">
                            {localizeUi("ui.chat.professormarimemoriesmenu.persistentHint")}
                          </span>
                        </span>
                        <SettingsSwitch
                          ariaLabel={localizeUi("ui.chat.professormarimemoriesmenu.persistent")}
                          checked={memory.persistent}
                          onChange={() => onTogglePersistent(memory)}
                          disabled={saving}
                          className="shrink-0 p-0 hover:bg-transparent"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onDelete(memory.id)}
                          disabled={saving}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.6875rem] font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Trash2 size="0.75rem" />
                          {localizeUi("lorebook.editor.batch.delete")}
                        </button>
                        <button
                          type="button"
                          onClick={onSave}
                          disabled={saving}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--primary)] px-2.5 text-[0.6875rem] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {saving ? <Loader2 size="0.75rem" className="animate-spin" /> : <Save size="0.75rem" />}
                          {localizeUi("ui.noodle.noodlehome.save")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

type HomeProfessorMariChatProps = {
  pageActive?: boolean;
  attachedFooter?: boolean;
  chatWindowOpen?: boolean;
  embeddedTab?: boolean;
  floatingMode?: boolean;
  launchHidden?: boolean;
  onChatWindowOpenChange?: (open: boolean) => void;
  onChatWindowExitComplete?: () => void;
  onFloatingDismiss?: () => void;
};

export function HomeProfessorMariChat({
  pageActive = true,
  attachedFooter = false,
  chatWindowOpen: controlledChatWindowOpen,
  embeddedTab = false,
  floatingMode = false,
  launchHidden = false,
  onChatWindowOpenChange,
  onChatWindowExitComplete,
  onFloatingDismiss,
}: HomeProfessorMariChatProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: connectionsRaw, isLoading: connectionsLoading } = useConnections();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const sidecarNativeToolCalls = useSidecarStore((state) => state.config.enableNativeToolCalls);
  const fetchSidecarStatus = useSidecarStore((state) => state.fetchStatus);
  const trackAchievement = useTrackAchievement();
  const [chatId, setChatId] = useState<string | null>(null);
  const { data: attachedContext } = useMariWorkspaceContext(chatId);
  const [messages, setMessages] = useState<Message[]>([]);
  const draft = useChatStore((state) => state.inputDrafts.get(PROFESSOR_MARI_DRAFT_KEY) ?? "");
  const setInputDraft = useChatStore((state) => state.setInputDraft);
  const enterToSend = useUIStore((state) => state.enterToSendProfessorMari);
  const setDraft = useCallback(
    (next: string | ((current: string) => string)) => {
      const current = useChatStore.getState().inputDrafts.get(PROFESSOR_MARI_DRAFT_KEY) ?? "";
      setInputDraft(PROFESSOR_MARI_DRAFT_KEY, typeof next === "function" ? next(current) : next);
    },
    [setInputDraft],
  );
  const [attachments, setAttachments] = useState<ProfessorMariAttachment[]>([]);
  const [isReadingAttachments, setIsReadingAttachments] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(() => readStoredConnectionId());
  const [workspaceStatus, setWorkspaceStatus] = useState<MariWorkspaceStatus | null>(null);
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const [workspaceActivity, setWorkspaceActivity] = useState<string | null>(null);
  const [workspaceTimeline, setWorkspaceTimeline] = useState<WorkspaceTimelineItem[]>([]);
  const [workspaceReviewActionId, setWorkspaceReviewActionId] = useState<string | null>(null);
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ProfessorMariChatSummary[]>([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatHistorySelectionMode, setChatHistorySelectionMode] = useState(false);
  const [selectedChatHistoryIds, setSelectedChatHistoryIds] = useState<Set<string>>(new Set());
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [skillsMenuOpen, setSkillsMenuOpen] = useState(false);
  const [skills, setSkills] = useState<MariWorkspaceSkillDetail[]>([]);
  const [skillsDiagnostics, setSkillsDiagnostics] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillDraftState>({ name: "", description: "", content: "" });
  const [memoriesMenuOpen, setMemoriesMenuOpen] = useState(false);
  const [memories, setMemories] = useState<MariInstructionDetail[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesSaving, setMemoriesSaving] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraftState>({ name: "", description: "", content: "" });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadedMessagesChatId, setLoadedMessagesChatId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [contextViewerOpen, setContextViewerOpen] = useState(false);
  const [internalChatWindowOpen, setInternalChatWindowOpen] = useState(
    () => floatingMode && isProfessorMariDesktopViewport(),
  );
  const [mobileFocusMode, setMobileFocusMode] = useState(false);
  const [floatingSmallViewport, setFloatingSmallViewport] = useState(() => !isProfessorMariDesktopViewport());
  const [floatingPosition, setFloatingPosition] = useState<{ x: number; y: number } | null>(null);
  const hasLoadedRef = useRef(false);
  const notifiedApprovalIdsRef = useRef<Set<string>>(new Set());
  const activeChatIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  const messageLoadAbortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptScrollFrameRef = useRef<number | null>(null);
  const suggestionFocusFrameRef = useRef<number | null>(null);
  const transcriptFollowOutputRef = useRef(true);
  const floatingSurfaceRef = useRef<HTMLDivElement>(null);
  const floatingButtonRef = useRef<HTMLDivElement>(null);
  const floatingDragRef = useRef<FloatingDragState | null>(null);
  const floatingDragMovedRef = useRef(false);
  const floatingFollowupEligibleRef = useRef(false);
  const connectionButtonRef = useRef<HTMLButtonElement>(null);
  const connectionMenuRef = useRef<HTMLDivElement>(null);
  const skillFileInputRef = useRef<HTMLInputElement>(null);
  const memoryFileInputRef = useRef<HTMLInputElement>(null);
  const lastSyncedMemoryIdRef = useRef<string | null>(null);
  const lastSyncedSkillIdRef = useRef<string | null>(null);
  const hasLoadedSkillsRef = useRef(false);
  const hasLoadedMemoriesRef = useRef(false);
  const memoriesLoadSeqRef = useRef(0);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const embeddedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const floatingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const workspaceAbortRef = useRef<AbortController | null>(null);
  const workspaceRunIdRef = useRef(0);
  const pendingWorkspaceTextRef = useRef("");
  const handledWorkspaceRefreshIdsRef = useRef<Set<string>>(new Set());
  const workspaceStatusErrorToastShownRef = useRef(false);
  const latestConnectionSelectionRef = useRef<string | null>(selectedConnectionId);
  const pendingConnectionPersistRef = useRef<string | null>(null);
  const connectionPersistInFlightRef = useRef(false);
  const attachmentRemovalInFlightRef = useRef<Set<string>>(new Set());
  const regenerationInFlightRef = useRef(false);
  const messageMutationBusyRef = useRef(false);

  const appendPendingWorkspaceText = useCallback(() => {
    const pendingText = pendingWorkspaceTextRef.current;
    pendingWorkspaceTextRef.current = "";
    if (pendingText) setWorkspaceTimeline((current) => appendTextTimeline(current, pendingText));
  }, []);
  const workspaceTextThrottle = useMemo(
    () => rafThrottle<void>(appendPendingWorkspaceText),
    [appendPendingWorkspaceText],
  );

  useEffect(() => () => workspaceTextThrottle.cancel(), [workspaceTextThrottle]);

  useEffect(
    () => () => {
      messageLoadAbortRef.current?.abort();
      messageLoadAbortRef.current = null;
      if (transcriptScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(transcriptScrollFrameRef.current);
        transcriptScrollFrameRef.current = null;
      }
      if (suggestionFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(suggestionFocusFrameRef.current);
        suggestionFocusFrameRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const setActiveChatId = useCallback((id: string) => {
    activeChatIdRef.current = id;
    setChatId(id);
  }, []);

  const setTranscriptScrollNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (transcriptScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(transcriptScrollFrameRef.current);
        transcriptScrollFrameRef.current = null;
      }
      scrollRef.current = node;
      if (!node || loadingHistory || !chatId || loadedMessagesChatId !== chatId) return;
      transcriptFollowOutputRef.current = true;
      transcriptScrollFrameRef.current = window.requestAnimationFrame(() => {
        transcriptScrollFrameRef.current = null;
        if (scrollRef.current === node) scrollProfessorMariTranscriptToBottom(node);
      });
    },
    [chatId, loadedMessagesChatId, loadingHistory],
  );

  const resizeComposer = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, []);

  const focusComposer = useCallback(() => {
    if (suggestionFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(suggestionFocusFrameRef.current);
    }
    suggestionFocusFrameRef.current = window.requestAnimationFrame(() => {
      suggestionFocusFrameRef.current = null;
      const textarea = floatingTextareaRef.current ?? embeddedTextareaRef.current;
      textarea?.focus();
    });
  }, []);

  useLayoutEffect(() => {
    resizeComposer(embeddedTextareaRef.current);
    resizeComposer(floatingTextareaRef.current);
  }, [draft, resizeComposer]);

  const hasActiveGeneration = useChatStore((state) => (chatId ? state.abortControllers.has(chatId) : false));
  const mariPhase = useChatStore((state) => (chatId ? (state.mariPhaseByChatId.get(chatId) ?? null) : null));
  const mariChips = useAgentStore((state) => state.mariChips);
  const mariChipsChatId = useAgentStore((state) => state.mariChipsChatId);
  const setMariChips = useAgentStore((state) => state.setMariChips);
  const clearMariChips = useAgentStore((state) => state.clearMariChips);
  const mariPlan = useAgentStore((state) => state.mariPlan);
  const mariPlanChatId = useAgentStore((state) => state.mariPlanChatId);
  const mariPlanCursor = useAgentStore((state) => state.mariPlanCursor);
  const setMariPlan = useAgentStore((state) => state.setMariPlan);
  const recordMariPlanAnswer = useAgentStore((state) => state.recordMariPlanAnswer);
  const clearMariPlan = useAgentStore((state) => state.clearMariPlan);
  const professorMariSuggestionsEnabled = useUIStore((state) => state.professorMariSuggestionsEnabled);
  const showTokenUsage = useUIStore((state) => state.showTokenUsage);

  const languageConnections = useMemo<ProfessorMariConnectionOption[]>(
    () => filterLanguageGenerationConnections((connectionsRaw ?? []) as APIConnection[]),
    [connectionsRaw],
  );
  const connectionOptions = useMemo<ProfessorMariConnectionOption[]>(() => {
    if (!sidecarModelDownloaded) return languageConnections;
    return [
      ...languageConnections,
      {
        id: LOCAL_SIDECAR_CONNECTION_ID,
        name: sidecarModelDisplayName ? `Local Model (${sidecarModelDisplayName})` : "Local Model (sidecar)",
        model: sidecarModelDisplayName ?? "local-sidecar",
        provider: "local_sidecar",
        isDefault: languageConnections.length === 0,
      },
    ];
  }, [languageConnections, sidecarModelDisplayName, sidecarModelDownloaded]);
  const selectedConnection = useMemo(
    () => connectionOptions.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connectionOptions, selectedConnectionId],
  );
  const effectiveConnection =
    selectedConnection ?? connectionOptions.find((connection) => connection.isDefault) ?? connectionOptions[0] ?? null;
  const effectiveConnectionId = effectiveConnection?.id ?? null;
  const contextBudget = useMemo(
    () => resolveProfessorMariContextBudget(messages, workspaceStatus?.connection?.maxContext),
    [messages, workspaceStatus?.connection?.maxContext],
  );
  const isBusy = sending || hasActiveGeneration || workspaceActive;
  useEffect(() => {
    messageMutationBusyRef.current = isBusy;
  }, [isBusy]);
  const canSubmitMessage = (draft.trim().length > 0 || attachments.length > 0) && !isReadingAttachments;
  const visibleSuggestionChips =
    mariChipsChatId === chatId && mariChips.some((chip) => chip.id === "authorization-accept")
      ? mariChips.filter((chip) => professorMariSuggestionsEnabled || chip.id === "authorization-accept")
      : professorMariSuggestionsEnabled && mariChipsChatId === chatId && mariChips.length > 0
        ? mariChips
        : professorMariSuggestionsEnabled && chatId !== null && loadedMessagesChatId === chatId && !isBusy
          ? MARI_STARTER_CHIPS
          : [];
  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedSkillId, skills],
  );
  const activeSkillCount = skills.filter((skill) => skill.enabled).length;
  const selectedMemory = useMemo(
    () => memories.find((memory) => memory.id === selectedMemoryId) ?? null,
    [selectedMemoryId, memories],
  );
  const activeMemoryCount = memories.filter((memory) => memory.enabled).length;
  const desktopChatWindowOpen = controlledChatWindowOpen ?? internalChatWindowOpen;
  const chatWindowOpen = desktopChatWindowOpen || mobileFocusMode;
  const setChatWindowOpen = useCallback(
    (open: boolean) => {
      setInternalChatWindowOpen(open);
      onChatWindowOpenChange?.(open);
    },
    [onChatWindowOpenChange],
  );

  useEffect(() => {
    if (professorMariSuggestionsEnabled) return;
    clearMariChips();
    clearMariPlan();
  }, [clearMariChips, clearMariPlan, professorMariSuggestionsEnabled]);

  useEffect(() => {
    if (!floatingMode) return;
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const syncFloatingViewport = () => {
      setFloatingSmallViewport(mediaQuery.matches);
      setChatWindowOpen(!mediaQuery.matches);
      if (!mediaQuery.matches) setMobileFocusMode(false);
    };
    syncFloatingViewport();
    mediaQuery.addEventListener("change", syncFloatingViewport);
    return () => mediaQuery.removeEventListener("change", syncFloatingViewport);
  }, [floatingMode, setChatWindowOpen]);

  useLayoutEffect(() => {
    if (floatingMode) return;
    rememberProfessorMariFloatingEnabled(false);
    dispatchProfessorMariFloatingEvent(PROFESSOR_MARI_FLOATING_HIDE_EVENT);
    return () => {
      if (floatingFollowupEligibleRef.current) {
        rememberProfessorMariFloatingEnabled(true);
        dispatchProfessorMariFloatingEvent(PROFESSOR_MARI_FLOATING_SHOW_EVENT);
      }
    };
  }, [floatingMode]);

  useLayoutEffect(() => {
    if (floatingMode || controlledChatWindowOpen === undefined) return;
    floatingFollowupEligibleRef.current = controlledChatWindowOpen;
    rememberProfessorMariFloatingEnabled(controlledChatWindowOpen);
  }, [controlledChatWindowOpen, floatingMode]);

  const loadMessages = useCallback(
    async (id: string, options: { clearSuggestions?: boolean; shouldApply?: () => boolean } = {}) => {
      messageLoadAbortRef.current?.abort();
      const controller = new AbortController();
      messageLoadAbortRef.current = controller;
      try {
        const items = await api.get<Message[]>(`/chats/${id}/messages?limit=80`, {
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          messageLoadAbortRef.current !== controller ||
          activeChatIdRef.current !== id ||
          options.shouldApply?.() === false
        ) {
          return;
        }
        setMessages(items.map((message) => ({ ...message, extra: toMessageExtra(message) })));
        setLoadedMessagesChatId(id);
        if (options.clearSuggestions) clearMariChips();
      } catch (error) {
        if (controller.signal.aborted) return;
        throw error;
      } finally {
        if (messageLoadAbortRef.current === controller) messageLoadAbortRef.current = null;
      }
    },
    [clearMariChips],
  );

  const loadChatHistory = useCallback(async () => {
    setChatHistoryLoading(true);
    try {
      const items = await api.get<ProfessorMariChatSummary[]>("/chats/internal/professor-mari/chats");
      setChatHistory(items);
      setSelectedChatHistoryIds((current) => {
        const availableIds = new Set(items.map((item) => item.id));
        return new Set([...current].filter((id) => availableIds.has(id)));
      });
    } finally {
      setChatHistoryLoading(false);
    }
  }, []);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const response = await api.get<MariWorkspaceSkillsResponse>("/professor-mari/workspace/skills");
      setSkills(response.skills);
      setSkillsDiagnostics(response.diagnostics);
      const isInitialSkillsLoad = !hasLoadedSkillsRef.current;
      hasLoadedSkillsRef.current = true;
      setSelectedSkillId((current) => {
        if (current && response.skills.some((skill) => skill.id === current)) return current;
        // Only auto-expand the first row on the very first load. On later refreshes, keep the user's
        // choice: a null (collapsed) selection stays collapsed, and a removed selection falls back to
        // null instead of reopening the first row.
        return isInitialSkillsLoad ? (response.skills[0]?.id ?? null) : null;
      });
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const loadMemories = useCallback(async () => {
    const seq = ++memoriesLoadSeqRef.current;
    setMemoriesLoading(true);
    try {
      const response = await api.get<MariInstructionsResponse>("/professor-mari/workspace/instructions");
      // Ignore a stale response that resolved after a newer load (mount load vs post-write refresh),
      // so an older list can't overwrite the newer one or reset the selection.
      if (seq !== memoriesLoadSeqRef.current) return;
      setMemories(response.instructions);
      const isInitialMemoriesLoad = !hasLoadedMemoriesRef.current;
      hasLoadedMemoriesRef.current = true;
      setSelectedMemoryId((current) => {
        if (current && response.instructions.some((memory) => memory.id === current)) return current;
        // Only auto-expand the first row on the very first load; a later refresh preserves a null
        // (collapsed) selection and falls back to null (not the first row) if the selection was removed.
        return isInitialMemoriesLoad ? (response.instructions[0]?.id ?? null) : null;
      });
    } finally {
      if (seq === memoriesLoadSeqRef.current) setMemoriesLoading(false);
    }
  }, []);

  const ensureProfessorMariChat = useCallback(
    async (connectionId: string | null) => {
      const params = new URLSearchParams();
      if (connectionId) params.set("connectionId", connectionId);
      const query = params.toString();
      const chat = await api.get<Chat>(`/chats/internal/professor-mari${query ? `?${query}` : ""}`);
      setActiveChatId(chat.id);
      qc.setQueryData(chatKeys.detail(chat.id), chat);
      return chat;
    },
    [qc, setActiveChatId],
  );

  // #5073: attaching chat history needs a Mari workspace chat to attach TO; create one if the user
  // hasn't sent a message yet, then open the picker (the picker itself is gated on a live chatId).
  const handleOpenHistoryPicker = useCallback(async () => {
    if (!activeChatIdRef.current) {
      try {
        await ensureProfessorMariChat(effectiveConnectionId);
      } catch {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryNeedsChat"));
        return;
      }
    }
    setHistoryPickerOpen(true);
  }, [ensureProfessorMariChat, effectiveConnectionId, localizeUi]);

  // The Context Viewer is gated on a live chatId too (attachModals), so ensure one before opening —
  // otherwise the menu item would be a silent no-op when the user hasn't sent a message yet.
  const handleOpenContextViewer = useCallback(async () => {
    if (!activeChatIdRef.current) {
      try {
        await ensureProfessorMariChat(effectiveConnectionId);
      } catch {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryNeedsChat"));
        return;
      }
    }
    setContextViewerOpen(true);
  }, [ensureProfessorMariChat, effectiveConnectionId, localizeUi]);

  const refreshWorkspaceStatus = useCallback(
    async (shouldApply?: () => boolean) => {
      const params = new URLSearchParams();
      if (effectiveConnectionId) params.set("connectionId", effectiveConnectionId);
      const query = params.toString();
      const status = await api.get<MariWorkspaceStatus>(`/professor-mari/workspace/status${query ? `?${query}` : ""}`);
      if (shouldApply?.() === false) return status;
      setWorkspaceStatus(status);
      workspaceStatusErrorToastShownRef.current = false;
      return status;
    },
    [effectiveConnectionId],
  );

  const invalidateWorkspaceData = useCallback(async () => {
    // Invalidation marks every query stale either way; the default 'active'
    // refetch pulls only what is mounted now, and everything else refreshes on
    // its next mount. refetchType:'all' here made every cached chat re-drain
    // its full message page history on each Mari workspace change (#4703).
    await qc.invalidateQueries();
  }, [qc]);

  useEffect(() => {
    void fetchSidecarStatus();
  }, [fetchSidecarStatus]);

  useEffect(() => {
    const workspaceHistory = workspaceStatus?.history ?? [];
    const visibleHistoryIds = new Set(workspaceHistory.map((entry) => entry.id));
    for (const id of handledWorkspaceRefreshIdsRef.current) {
      if (!visibleHistoryIds.has(id)) handledWorkspaceRefreshIdsRef.current.delete(id);
    }

    const appliedChanges = workspaceHistory.filter((entry) => {
      if (entry.status !== "approved") return false;
      return !handledWorkspaceRefreshIdsRef.current.has(entry.id);
    });
    if (appliedChanges.length === 0) return;
    for (const entry of appliedChanges) {
      handledWorkspaceRefreshIdsRef.current.add(entry.id);
    }
    void invalidateWorkspaceData().catch((error) => {
      console.error("[Professor Mari] Failed to refresh app data after workspace change", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariAppliedAWorkspaceChangeButAppData"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    });
  }, [invalidateWorkspaceData, workspaceStatus?.history, localizeUi]);

  useEffect(() => {
    latestConnectionSelectionRef.current = selectedConnectionId;
  }, [selectedConnectionId]);

  useEffect(() => {
    if (hasLoadedRef.current || connectionsLoading) return;
    hasLoadedRef.current = true;
    setLoadingHistory(true);
    const storedConnectionExists =
      !!selectedConnectionId && connectionOptions.some((connection) => connection.id === selectedConnectionId);
    ensureProfessorMariChat(storedConnectionExists ? selectedConnectionId : null)
      .then((chat) => {
        const restoredConnectionId =
          typeof chat.connectionId === "string" && chat.connectionId ? chat.connectionId : null;
        if (restoredConnectionId) {
          setSelectedConnectionId(restoredConnectionId);
          rememberConnectionId(restoredConnectionId);
        }
        return loadMessages(chat.id);
      })
      .catch((error) => {
        console.error("[Professor Mari] Failed to load home assistant", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotLoad"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      })
      .finally(() => setLoadingHistory(false));
  }, [connectionOptions, connectionsLoading, ensureProfessorMariChat, loadMessages, selectedConnectionId, localizeUi]);

  useEffect(() => {
    if (!pageActive) return;
    void refreshWorkspaceStatus().catch(() => {
      setWorkspaceStatus((current) => current && { ...current, error: "Workspace status unavailable" });
      if (!workspaceStatusErrorToastShownRef.current) {
        workspaceStatusErrorToastShownRef.current = true;
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceStatusIsUnavailable"), {
          description: localizeUi("ui.chat.homeprofessormarichat.workspaceImportsAndChangesMayNotShowLiveProgress"),
          duration: 12_000,
        });
      }
    });
    const refreshVisibleWorkspaceStatus = () => {
      if (document.hidden) return;
      void refreshWorkspaceStatus().catch(() => undefined);
    };
    const timer = window.setInterval(refreshVisibleWorkspaceStatus, 15_000);
    document.addEventListener("visibilitychange", refreshVisibleWorkspaceStatus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisibleWorkspaceStatus);
    };
  }, [pageActive, refreshWorkspaceStatus, localizeUi]);

  useEffect(() => {
    void loadSkills().catch((error) => {
      console.error("[Professor Mari] Failed to load skills", error);
      setSkillsDiagnostics(["Professor Mari skills unavailable"]);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariSkillsAreUnavailable"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    });
  }, [loadSkills, localizeUi]);

  useEffect(() => {
    if (!chatHistoryOpen) return;
    void loadChatHistory().catch((error) => {
      console.error("[Professor Mari] Failed to load chats", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotLoadHerPreviousChats"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    });
  }, [chatHistoryOpen, loadChatHistory, localizeUi]);

  useEffect(() => {
    if (chatHistoryOpen) return;
    setChatHistorySelectionMode(false);
    setSelectedChatHistoryIds(new Set());
  }, [chatHistoryOpen]);

  useEffect(() => {
    const id = selectedSkill?.id ?? null;
    // Only reload the draft when the SELECTED skill changes, not when the same skill's row ref
    // changes because the enabled toggle refetched it, which would silently clobber unsaved
    // name/description/content edits (the toggle sits on the row, above the open editor).
    if (id === lastSyncedSkillIdRef.current) return;
    lastSyncedSkillIdRef.current = id;
    if (!selectedSkill) {
      setSkillDraft({ name: "", description: "", content: "" });
      return;
    }
    setSkillDraft({
      name: selectedSkill.name,
      description: selectedSkill.description,
      content: selectedSkill.content,
    });
  }, [selectedSkill]);

  useEffect(() => {
    void loadMemories().catch((error) => {
      console.error("[Professor Mari] Failed to load memories", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariMemoriesAreUnavailable"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    });
  }, [loadMemories, localizeUi]);

  useEffect(() => {
    const id = selectedMemory?.id ?? null;
    // Only reload the draft when the SELECTED memory changes, not when the same memory's row
    // ref changes because a flag toggle (enable/Persistent) refetched it, which would silently
    // clobber unsaved name/description/content edits, since the Persistent toggle sits in the pane.
    if (id === lastSyncedMemoryIdRef.current) return;
    lastSyncedMemoryIdRef.current = id;
    if (!selectedMemory) {
      setMemoryDraft({ name: "", description: "", content: "" });
      return;
    }
    setMemoryDraft({
      name: selectedMemory.name,
      description: selectedMemory.description,
      content: selectedMemory.content,
    });
  }, [selectedMemory]);

  const pendingChangeReviews = useMemo(
    () => workspaceStatus?.pendingApprovals ?? [],
    [workspaceStatus?.pendingApprovals],
  );

  // Alert the user when Professor Mari finished her work and is now blocked
  // waiting on an approval. The notification helpers no-op while the app is
  // focused, so a present user just sees the in-app review card. Reviews are
  // re-fetched from the workspace service on re-entry, so the card is already waiting too.
  useEffect(() => {
    const fresh = pendingChangeReviews.filter((approval) => !notifiedApprovalIdsRef.current.has(approval.id));
    const liveIds = new Set(pendingChangeReviews.map((approval) => approval.id));
    for (const id of notifiedApprovalIdsRef.current) if (!liveIds.has(id)) notifiedApprovalIdsRef.current.delete(id);
    if (fresh.length === 0) return;
    for (const approval of fresh) notifiedApprovalIdsRef.current.add(approval.id);
    const uiState = useUIStore.getState();
    const notification = {
      characterName: "Professor Mari",
      title: "Professor Mari needs your approval",
      tag: "marinara-mari-approval",
    };
    void showLocalMessageNotification({ ...notification, enabled: uiState.generationBrowserNotifications });
    showNativeMessageNotification({ ...notification, enabled: uiState.generationMobileNotifications });
  }, [pendingChangeReviews]);

  const workspaceTimelineActive = workspaceActive || hasActiveGeneration;
  const workspaceHasResponseText = workspaceTimeline.some((item) => item.type === "text" && item.content.trim());
  const showDottoreSupport = workspaceTimelineActive && !workspaceHasResponseText;
  const visiblePendingChangeReviews = !sending && !workspaceTimelineActive ? pendingChangeReviews : [];
  const visiblePendingChangeReviewKey = visiblePendingChangeReviews.map((approval) => approval.id).join("|");

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !transcriptFollowOutputRef.current) return;
    scrollProfessorMariTranscriptToBottom(node);
  }, [messages, workspaceTimeline, workspaceActivity, visiblePendingChangeReviewKey, workspaceStatus?.error]);

  const handleTranscriptScroll = useCallback(() => {
    const node = scrollRef.current;
    if (node) transcriptFollowOutputRef.current = isProfessorMariTranscriptNearBottom(node);
  }, []);

  const displayMessages = useMemo(() => [createWelcomeMessage(chatId), ...messages], [chatId, messages]);
  const showConnectionFirstHint =
    chatId !== null &&
    loadedMessagesChatId === chatId &&
    !sending &&
    !messages.some((message) => message.role === "user");

  useEffect(() => {
    if (!mobileFocusMode) return;
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const previousOverflow = document.body.style.overflow;
    const syncScrollLock = () => {
      if (!mediaQuery.matches) {
        setMobileFocusMode(false);
        document.body.style.overflow = previousOverflow;
        return;
      }
      document.body.style.overflow = "hidden";
    };
    syncScrollLock();
    mediaQuery.addEventListener("change", syncScrollLock);
    return () => {
      mediaQuery.removeEventListener("change", syncScrollLock);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileFocusMode]);

  useEffect(() => {
    if (!connectionMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (connectionButtonRef.current?.contains(target) || connectionMenuRef.current?.contains(target)) return;
      setConnectionMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [connectionMenuOpen]);

  const persistLatestConnectionSelection = useCallback(() => {
    if (connectionPersistInFlightRef.current) return;
    connectionPersistInFlightRef.current = true;

    void (async () => {
      try {
        while (pendingConnectionPersistRef.current) {
          const id = pendingConnectionPersistRef.current;
          pendingConnectionPersistRef.current = null;
          try {
            await ensureProfessorMariChat(id);
          } catch (error) {
            if (!pendingConnectionPersistRef.current && latestConnectionSelectionRef.current === id) {
              console.error("[Professor Mari] Failed to save selected connection", error);
              toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRememberThatConnection"), {
                description: describeProfessorMariError(error),
                duration: 12_000,
              });
            }
          }
        }
      } finally {
        connectionPersistInFlightRef.current = false;
      }
    })();
  }, [ensureProfessorMariChat, localizeUi]);

  const handleConnectionChange = (id: string) => {
    setSelectedConnectionId(id);
    latestConnectionSelectionRef.current = id;
    pendingConnectionPersistRef.current = id;
    rememberConnectionId(id);
    setConnectionMenuOpen(false);
    persistLatestConnectionSelection();
  };

  const closeChatWindow = useCallback(() => {
    if (!floatingMode) {
      floatingFollowupEligibleRef.current = false;
      rememberProfessorMariFloatingEnabled(false);
    }
    setConnectionMenuOpen(false);
    setSkillsMenuOpen(false);
    setMemoriesMenuOpen(false);
    setChatHistoryOpen(false);
    setMobileFocusMode(false);
    setChatWindowOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [floatingMode, setChatWindowOpen]);

  const openChatWindow = useCallback(() => {
    if (!floatingMode) {
      floatingFollowupEligibleRef.current = true;
      rememberProfessorMariFloatingEnabled(true);
    }
    setSkillsMenuOpen(false);
    setMemoriesMenuOpen(false);
    setChatHistoryOpen(false);
    setConnectionMenuOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (window.matchMedia("(max-width: 639px)").matches) {
      setMobileFocusMode(true);
      return;
    }
    setChatWindowOpen(true);
  }, [floatingMode, setChatWindowOpen]);

  const toggleSkillsMenu = useCallback(() => {
    const next = !skillsMenuOpen;
    if (next) {
      setConnectionMenuOpen(false);
      setChatHistoryOpen(false);
      setMemoriesMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setSkillsMenuOpen(next);
  }, [skillsMenuOpen]);

  const toggleMemoriesMenu = useCallback(() => {
    const next = !memoriesMenuOpen;
    if (next) {
      setConnectionMenuOpen(false);
      setChatHistoryOpen(false);
      setSkillsMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setMemoriesMenuOpen(next);
  }, [memoriesMenuOpen]);

  const toggleChatHistory = useCallback(() => {
    if (!chatHistoryOpen && isBusy) {
      toast.info(localizeUi("ui.chat.homeprofessormarichat.waitForProfessorMariToFinishBeforeSwitchingChats"));
      return;
    }
    const next = !chatHistoryOpen;
    if (next) {
      setConnectionMenuOpen(false);
      setSkillsMenuOpen(false);
      setMemoriesMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setChatHistoryOpen(next);
  }, [chatHistoryOpen, isBusy, localizeUi]);

  useEffect(() => {
    window.addEventListener("marinara:home-professor-mari-close", closeChatWindow);
    return () => window.removeEventListener("marinara:home-professor-mari-close", closeChatWindow);
  }, [closeChatWindow]);

  const clampFloatingPosition = useCallback(
    (x: number, y: number, width: number, height: number) => {
      if (typeof window === "undefined") return { x, y };
      const minX = PROFESSOR_MARI_FLOATING_EDGE_GAP;
      const minY = floatingSmallViewport ? PROFESSOR_MARI_FLOATING_MOBILE_TOP_GAP : PROFESSOR_MARI_FLOATING_EDGE_GAP;
      const maxX = Math.max(minX, window.innerWidth - width - PROFESSOR_MARI_FLOATING_EDGE_GAP);
      const maxY = Math.max(minY, window.innerHeight - height - PROFESSOR_MARI_FLOATING_EDGE_GAP);
      return {
        x: Math.min(Math.max(x, minX), maxX),
        y: Math.min(Math.max(y, minY), maxY),
      };
    },
    [floatingSmallViewport],
  );

  const beginFloatingDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-professor-mari-floating-action]")) return;
      const surface = floatingSurfaceRef.current ?? floatingButtonRef.current ?? event.currentTarget;
      const rect = surface.getBoundingClientRect();
      floatingDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
      floatingDragMovedRef.current = false;
      setFloatingPosition(clampFloatingPosition(rect.left, rect.top, rect.width, rect.height));
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [clampFloatingPosition],
  );

  const moveFloatingDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = floatingDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) {
        floatingDragMovedRef.current = true;
      }
      setFloatingPosition(
        clampFloatingPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY, drag.width, drag.height),
      );
    },
    [clampFloatingPosition],
  );

  const endFloatingDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = floatingDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    floatingDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const floatingPositionStyle = useMemo<CSSProperties | undefined>(() => {
    if (!floatingPosition) return undefined;
    return { left: floatingPosition.x, top: floatingPosition.y };
  }, [floatingPosition]);

  const handleFloatingButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (floatingDragMovedRef.current) {
        floatingDragMovedRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      openChatWindow();
    },
    [openChatWindow],
  );

  const handleRestart = useCallback(async () => {
    const params = new URLSearchParams();
    if (effectiveConnectionId) params.set("connectionId", effectiveConnectionId);
    const query = params.toString();
    const chat = await api.post<Chat>(`/chats/internal/professor-mari/restart${query ? `?${query}` : ""}`);
    setActiveChatId(chat.id);
    qc.setQueryData(chatKeys.detail(chat.id), chat);
    await api.post("/professor-mari/workspace/reset", { clearHistory: true });
    setMessages([]);
    setLoadedMessagesChatId(chat.id);
    setDraft("");
    clearMariChips();
    setWorkspaceActive(false);
    setWorkspaceActivity(null);
    useChatStore.getState().clearStreamBuffer(chat.id);
    useChatStore.getState().clearThinkingBuffer(chat.id);
    useChatStore.getState().setAbortController(chat.id, null);
    useChatStore.getState().setMariPhase(chat.id, "idle");
    setWorkspaceTimeline([]);
    if (chatHistoryOpen) await loadChatHistory();
    await qc.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
    toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariSPreviousChatWasSaved"));
  }, [
    chatHistoryOpen,
    clearMariChips,
    effectiveConnectionId,
    loadChatHistory,
    qc,
    setActiveChatId,
    setDraft,
    localizeUi,
  ]);

  const guidedPlan = professorMariSuggestionsEnabled && mariPlanChatId === chatId ? mariPlan : null;
  const guidedPlanStep = guidedPlan ? (guidedPlan[mariPlanCursor] ?? null) : null;
  const chipRowChips = guidedPlanStep ? guidedPlanStep.chips : visibleSuggestionChips;
  const chipRowHint = guidedPlanStep
    ? `${guidedPlanStep.question} Suggestions only; you can type your own answer.`
    : chipRowChips.length > 0
      ? "Suggestions only. Pick one, or type your own."
      : null;
  const showSuggestionLoading =
    professorMariSuggestionsEnabled &&
    chipRowChips.length === 0 &&
    workspaceActivity?.toLocaleLowerCase().includes("suggestion") === true;

  function handleSuggestionSelect(chip: MariSuggestionChip) {
    if (chip.id === "authorization-accept") {
      void handleSubmit(chip.prompt);
      return;
    }
    if (guidedPlanStep) {
      const result = recordMariPlanAnswer(guidedPlanStep.fieldKey, chip.prompt);
      if (result === "complete") {
        const answers = useAgentStore.getState().mariPlanAnswers;
        const summary = Object.entries(answers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("; ");
        clearMariPlan();
        setDraft(`Create it - ${summary}`);
        focusComposer();
      }
      return;
    }
    setDraft((current) => (current.trim() ? `${current.trimEnd()} ${chip.prompt}` : chip.prompt));
    focusComposer();
  }

  const runRestart = useCallback(async () => {
    if (isBusy) return;
    setSending(true);
    try {
      await handleRestart();
      clearMariPlan();
    } catch (error) {
      console.error("[Professor Mari] Failed to restart", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRestartHerNotes"));
    } finally {
      setSending(false);
    }
  }, [clearMariPlan, handleRestart, isBusy, localizeUi]);

  const keepWorkspaceChange = useCallback(
    async (id: string, opts?: { enable?: boolean }) => {
      if (workspaceReviewActionId) return;
      setWorkspaceReviewActionId(id);
      try {
        // #4851 "Keep & Enable": pass { enable: true } so a kept memory insert is switched on.
        const result = await api.post<WorkspaceApprovalResponse>(
          `/professor-mari/workspace/approvals/${id}/approve`,
          opts?.enable ? { enable: true } : undefined,
        );
        await refreshWorkspaceStatus().catch(() => undefined);
        // Refresh the Memories panel after any keep so a kept memory (enabled or not) shows up.
        await loadMemories().catch(() => undefined);
        if (result.outcome === "applied") {
          await invalidateWorkspaceData();
          toast.success(
            result.approval?.kind === "dependency_install"
              ? localizeUi("ui.chat.homeprofessormarichat.installedValue1Value2", {
                  value1: result.approval.packageName,
                  value2: result.approval.version,
                })
              : localizeUi("ui.chat.homeprofessormarichat.appliedProfessorMariSSensitiveFileChange"),
          );
        } else if (result.history?.status === "kept") {
          toast.success(localizeUi("ui.chat.homeprofessormarichat.keptMariSWorkspaceChange"));
        } else {
          toast.error(
            result.outcome === "state_changed"
              ? localizeUi("ui.chat.homeprofessormarichat.theWorkspaceChangedAfterProfessorMariStagedThisProposal")
              : localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotApplyThatWorkspaceChange"),
            { description: result.error ?? undefined, duration: 12_000 },
          );
        }
      } catch (error) {
        console.error("[Professor Mari] Failed to keep workspace change", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotKeepThatWorkspaceChange"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      } finally {
        setWorkspaceReviewActionId((current) => (current === id ? null : current));
      }
    },
    [invalidateWorkspaceData, loadMemories, refreshWorkspaceStatus, workspaceReviewActionId, localizeUi],
  );

  const restoreWorkspaceChange = useCallback(
    async (id: string) => {
      if (workspaceReviewActionId) return;
      setWorkspaceReviewActionId(id);
      try {
        const result = await api.post<WorkspaceApprovalResponse>(`/professor-mari/workspace/approvals/${id}/reject`);
        await refreshWorkspaceStatus().catch(() => undefined);
        // Refresh the Memories panel after a restore: reverting a Mari memory insert deletes the
        // row, so the panel would otherwise keep rendering a stale client-side entry.
        await loadMemories().catch(() => undefined);
        if (result.outcome === "discarded") {
          toast.success(localizeUi("ui.chat.homeprofessormarichat.discardedProfessorMariSProposedChange"));
        } else if (result.history?.status === "restored") {
          await invalidateWorkspaceData();
          toast.success(localizeUi("ui.chat.homeprofessormarichat.restoredThePreviousAppDataSnapshot"));
        } else {
          toast.error(
            result.outcome === "state_changed"
              ? localizeUi("ui.chat.homeprofessormarichat.theWorkspaceChangedAfterProfessorMariStagedThisProposal")
              : localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRestoreThatWorkspaceChange"),
            { description: result.error ?? undefined, duration: 12_000 },
          );
        }
      } catch (error) {
        console.error("[Professor Mari] Failed to restore workspace change", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRestoreThatWorkspaceChange"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      } finally {
        setWorkspaceReviewActionId((current) => (current === id ? null : current));
      }
    },
    [invalidateWorkspaceData, loadMemories, refreshWorkspaceStatus, workspaceReviewActionId, localizeUi],
  );

  // #4931: reject a single reviewed row (revert just that lorebook entry). Mirrors
  // restoreWorkspaceChange but posts the row's diffPreview index + identity tuple; the server reverts
  // only that row and either shrinks the pending card or resolves it.
  const rejectWorkspaceRows = useCallback(
    async (id: string, rows: Array<{ index: number; table: string; id: string; action: string }>): Promise<boolean> => {
      if (workspaceReviewActionId) return false;
      setWorkspaceReviewActionId(id);
      try {
        const result = await api.post<{
          ok?: boolean;
          outcome?: string;
          error?: string | null;
          rejected?: number;
          remaining?: number;
          completed?: boolean;
        }>(`/professor-mari/workspace/approvals/${id}/reject-rows`, { rows });
        await refreshWorkspaceStatus().catch(() => undefined);
        // A rejected entry is deleted, so refresh any panel that mirrors app data.
        await loadMemories().catch(() => undefined);
        if (result.ok) {
          await invalidateWorkspaceData();
          toast.success(localizeUi("ui.chat.homeprofessormarichat.revertedTheSelectedEntry"));
          return true;
        }
        if (result.outcome === "state_changed") {
          toast.error(
            localizeUi("ui.chat.homeprofessormarichat.theWorkspaceChangedAfterProfessorMariStagedThisProposal"),
            { description: result.error ?? undefined, duration: 12_000 },
          );
        } else {
          toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRejectThatEntry"), {
            description: result.error ?? undefined,
            duration: 12_000,
          });
        }
        return false;
      } catch (error) {
        console.error("[Professor Mari] Failed to reject workspace rows", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRejectThatEntry"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
        return false;
      } finally {
        setWorkspaceReviewActionId((current) => (current === id ? null : current));
      }
    },
    [invalidateWorkspaceData, loadMemories, refreshWorkspaceStatus, workspaceReviewActionId, localizeUi],
  );

  // #4931: fetch the synthetic Peek-Prompt render of one reviewed character/preset row. Read-only,
  // so it needs no review-action lock and can run while other reviews are in flight.
  const renderWorkspacePrompt = useCallback(
    async (id: string, row: { index: number; table: string; id: string; action: string }) => {
      try {
        const result = await api.post<{
          ok?: boolean;
          before?: MariPromptRenderSide;
          after?: MariPromptRenderSide;
        }>(`/professor-mari/workspace/approvals/${id}/render-prompt`, row);
        if (!result.ok) return null;
        return { before: result.before ?? null, after: result.after ?? null };
      } catch (error) {
        console.error("[Professor Mari] Failed to render workspace prompt", error);
        return null;
      }
    },
    [],
  );

  const stopWorkspace = useCallback(async () => {
    workspaceAbortRef.current?.abort();
    try {
      await api.post("/professor-mari/workspace/abort");
    } catch (error) {
      console.error("[Professor Mari] Failed to stop workspace task", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotStopTheWorkspaceTask"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    }
  }, [localizeUi]);

  const createSkillFromContent = useCallback(
    async (input: { content: string; fileName?: string; name?: string; description?: string }) => {
      setSkillsSaving(true);
      try {
        const result = await api.post<WorkspaceSkillMutationResponse>("/professor-mari/workspace/skills", {
          ...input,
          enabled: true,
        });
        await loadSkills();
        setSelectedSkillId(result.skill.id);
        setSkillsMenuOpen(true);
        await refreshWorkspaceStatus().catch(() => undefined);
        toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariSkillAdded"));
      } finally {
        setSkillsSaving(false);
      }
    },
    [loadSkills, refreshWorkspaceStatus, localizeUi],
  );

  const handleNewSkill = useCallback(() => {
    void createSkillFromContent({
      name: "custom-skill",
      description: "User-defined Professor Mari skill.",
      content: NEW_SKILL_CONTENT,
    }).catch((error) => {
      console.error("[Professor Mari] Failed to create skill", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotAddThatSkill"));
    });
  }, [createSkillFromContent, localizeUi]);

  const handleSkillUploadClick = useCallback(() => {
    skillFileInputRef.current?.click();
  }, []);

  const handleSkillFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (!file) return;
      void file
        .text()
        .then((content) => createSkillFromContent({ content, fileName: file.name }))
        .catch((error) => {
          console.error("[Professor Mari] Failed to upload skill", error);
          toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUploadThatSkill"));
        });
    },
    [createSkillFromContent, localizeUi],
  );

  const handleSaveSkill = useCallback(async () => {
    if (!selectedSkill) return;
    setSkillsSaving(true);
    try {
      const result = await api.put<WorkspaceSkillMutationResponse>(
        `/professor-mari/workspace/skills/${selectedSkill.id}`,
        {
          name: skillDraft.name,
          description: skillDraft.description,
          content: skillDraft.content,
        },
      );
      await loadSkills();
      setSelectedSkillId(result.skill.id);
      await refreshWorkspaceStatus().catch(() => undefined);
      toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariSkillSaved"));
    } catch (error) {
      console.error("[Professor Mari] Failed to save skill", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotSaveThatSkill"));
    } finally {
      setSkillsSaving(false);
    }
  }, [loadSkills, refreshWorkspaceStatus, selectedSkill, skillDraft, localizeUi]);

  const handleToggleSkill = useCallback(
    async (skill: MariWorkspaceSkillDetail) => {
      setSkillsSaving(true);
      try {
        await api.put<WorkspaceSkillMutationResponse>(`/professor-mari/workspace/skills/${skill.id}`, {
          enabled: !skill.enabled,
        });
        await loadSkills();
        await refreshWorkspaceStatus().catch(() => undefined);
      } catch (error) {
        console.error("[Professor Mari] Failed to toggle skill", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUpdateThatSkill"));
      } finally {
        setSkillsSaving(false);
      }
    },
    [loadSkills, refreshWorkspaceStatus, localizeUi],
  );

  const handleDeleteSkill = useCallback(
    async (id: string) => {
      const skill = skills.find((entry) => entry.id === id);
      if (!skill) return;
      if (!window.confirm(localizeUi("ui.chat.homeprofessormarichat.deleteValue1", { value1: skill.name }))) return;
      setSkillsSaving(true);
      try {
        await api.delete(`/professor-mari/workspace/skills/${id}`);
        setSelectedSkillId((current) => (current === id ? null : current));
        await loadSkills();
        await refreshWorkspaceStatus().catch(() => undefined);
        toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariSkillDeleted"));
      } catch (error) {
        console.error("[Professor Mari] Failed to delete skill", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteThatSkill"));
      } finally {
        setSkillsSaving(false);
      }
    },
    [loadSkills, refreshWorkspaceStatus, skills, localizeUi],
  );

  // #4851: Memories panel handlers. Direct writes to /instructions (reset-free); new
  // memories default disabled (the user enables them from the row switch).
  const createMemory = useCallback(
    async (input: { content: string; name?: string; description?: string }) => {
      setMemoriesSaving(true);
      try {
        const result = await api.post<MariInstructionMutationResponse>("/professor-mari/workspace/instructions", {
          name: input.name?.trim() || "New memory",
          description: input.description ?? "",
          content: input.content,
        });
        await loadMemories();
        setSelectedMemoryId(result.instruction.id);
        setMemoriesMenuOpen(true);
        toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariMemoryAdded"));
      } finally {
        setMemoriesSaving(false);
      }
    },
    [loadMemories, localizeUi],
  );

  const handleNewMemory = useCallback(() => {
    void createMemory({
      name: "New memory",
      content: "Describe a preference or instruction for Professor Mari.",
    }).catch((error) => {
      console.error("[Professor Mari] Failed to create memory", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotAddThatMemory"));
    });
  }, [createMemory, localizeUi]);

  const handleMemoryUploadClick = useCallback(() => {
    memoryFileInputRef.current?.click();
  }, []);

  const handleMemoryFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (!file) return;
      // A memory's content is capped server-side at 20k CHARS. UTF-8 chars are up to 4 bytes, so use a
      // generous byte ceiling just to avoid reading a huge file, then validate the exact character
      // length after reading (so a valid multibyte memory, e.g. emoji, is not wrongly rejected).
      const MEMORY_CONTENT_CHAR_CAP = 20_000;
      if (file.size > 4 * MEMORY_CONTENT_CHAR_CAP) {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.thatMemoryFileIsTooLarge"));
        return;
      }
      const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      void file
        .text()
        .then((content) => {
          if (content.trim().length > MEMORY_CONTENT_CHAR_CAP) {
            toast.error(localizeUi("ui.chat.homeprofessormarichat.thatMemoryFileIsTooLarge"));
            return undefined;
          }
          return createMemory({ content, name: baseName || undefined });
        })
        .catch((error) => {
          console.error("[Professor Mari] Failed to upload memory", error);
          toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUploadThatMemory"));
        });
    },
    [createMemory, localizeUi],
  );

  const handleSaveMemory = useCallback(async () => {
    if (!selectedMemory) return;
    setMemoriesSaving(true);
    try {
      const result = await api.put<MariInstructionMutationResponse>(
        `/professor-mari/workspace/instructions/${selectedMemory.id}`,
        { name: memoryDraft.name, description: memoryDraft.description, content: memoryDraft.content },
      );
      await loadMemories();
      setSelectedMemoryId(result.instruction.id);
      toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariMemorySaved"));
    } catch (error) {
      console.error("[Professor Mari] Failed to save memory", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotSaveThatMemory"));
    } finally {
      setMemoriesSaving(false);
    }
  }, [loadMemories, selectedMemory, memoryDraft, localizeUi]);

  const patchMemoryFlag = useCallback(
    async (memory: MariInstructionDetail, patch: { enabled?: boolean; persistent?: boolean }) => {
      setMemoriesSaving(true);
      try {
        await api.put<MariInstructionMutationResponse>(`/professor-mari/workspace/instructions/${memory.id}`, patch);
        await loadMemories();
      } catch (error) {
        console.error("[Professor Mari] Failed to update memory", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUpdateThatMemory"));
      } finally {
        setMemoriesSaving(false);
      }
    },
    [loadMemories, localizeUi],
  );

  const handleToggleMemoryEnabled = useCallback(
    (memory: MariInstructionDetail) => void patchMemoryFlag(memory, { enabled: !memory.enabled }),
    [patchMemoryFlag],
  );

  const handleToggleMemoryPersistent = useCallback(
    (memory: MariInstructionDetail) => void patchMemoryFlag(memory, { persistent: !memory.persistent }),
    [patchMemoryFlag],
  );

  const handleDeleteMemory = useCallback(
    async (id: string) => {
      const memory = memories.find((entry) => entry.id === id);
      if (!memory) return;
      if (!window.confirm(localizeUi("ui.chat.homeprofessormarichat.deleteValue1", { value1: memory.name }))) return;
      setMemoriesSaving(true);
      try {
        await api.delete(`/professor-mari/workspace/instructions/${id}`);
        setSelectedMemoryId((current) => (current === id ? null : current));
        await loadMemories();
        toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariMemoryDeleted"));
      } catch (error) {
        console.error("[Professor Mari] Failed to delete memory", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteThatMemory"));
      } finally {
        setMemoriesSaving(false);
      }
    },
    [loadMemories, memories, localizeUi],
  );

  const handleSelectProfessorChat = useCallback(
    async (id: string) => {
      if (isBusy) {
        toast.info(localizeUi("ui.chat.homeprofessormarichat.waitForProfessorMariToFinishBeforeSwitchingChats"));
        return;
      }
      try {
        const chat = await api.post<Chat>(`/chats/internal/professor-mari/chats/${id}/activate`);
        setActiveChatId(chat.id);
        qc.setQueryData(chatKeys.detail(chat.id), chat);
        setSkillsMenuOpen(false);
        setMemoriesMenuOpen(false);
        setChatHistoryOpen(false);
        setWorkspaceTimeline([]);
        useChatStore.getState().clearStreamBuffer(chat.id);
        useChatStore.getState().clearThinkingBuffer(chat.id);
        await loadMessages(chat.id);
        await loadChatHistory();
      } catch (error) {
        console.error("[Professor Mari] Failed to open previous chat", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotOpenThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      }
    },
    [isBusy, loadChatHistory, loadMessages, qc, setActiveChatId, localizeUi],
  );

  const handleRenameProfessorChat = useCallback(
    async (id: string) => {
      const name = renameDraft.trim();
      if (!name) return;
      try {
        await api.patch(`/chats/internal/professor-mari/chats/${id}`, { name });
        setRenamingChatId(null);
        setRenameDraft("");
        await Promise.all([
          loadChatHistory(),
          qc.invalidateQueries({ queryKey: chatKeys.detail(id) }),
          qc.invalidateQueries({ queryKey: chatKeys.list() }),
          qc.invalidateQueries({ queryKey: homeFeedKeys.all }),
        ]);
      } catch (error) {
        console.error("[Professor Mari] Failed to rename chat", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRenameThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      }
    },
    [loadChatHistory, qc, renameDraft, localizeUi],
  );

  const handleTitleCommand = useCallback(
    async (messageText: string) => {
      const match = /^\/title(?:\s+(.*))?$/iu.exec(messageText);
      if (!match) return false;
      const name = match[1]?.trim() ?? "";
      if (!name) {
        toast.info(localizeUi("ui.chat.homeprofessormarichat.titleCommandUsage"));
        return true;
      }
      if (!chatId) {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.titleCommandNoActiveChat"));
        return true;
      }
      try {
        await api.patch(`/chats/internal/professor-mari/chats/${chatId}`, { name });
        setDraft("");
        await Promise.all([
          loadChatHistory(),
          qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
          qc.invalidateQueries({ queryKey: chatKeys.list() }),
          qc.invalidateQueries({ queryKey: homeFeedKeys.all }),
        ]);
        toast.success(localizeUi("ui.chat.homeprofessormarichat.titleCommandRenamed", { name }));
      } catch (error) {
        console.error("[Professor Mari] Failed to rename chat with /title", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRenameThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      }
      return true;
    },
    [chatId, loadChatHistory, qc, setDraft, localizeUi],
  );

  const handleDeleteProfessorChat = useCallback(
    async (id: string) => {
      const item = chatHistory.find((chat) => chat.id === id);
      if (!item) return;
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.chat.homeprofessormarichat.deleteValue1", {
          value1: item.name || localizeUi("ui.chat.homeprofessormarichat.thisProfessorMariChat"),
        }),
        message: localizeUi("ui.chat.homeprofessormarichat.deleteSelectedChatsConfirmation", { count: 1 }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      });
      if (!confirmed) return;
      try {
        await api.delete(`/chats/internal/professor-mari/chats/${id}`);
        if (id === chatId) {
          const chat = await ensureProfessorMariChat(effectiveConnectionId);
          setActiveChatId(chat.id);
          await loadMessages(chat.id);
        }
        await loadChatHistory();
      } catch (error) {
        console.error("[Professor Mari] Failed to delete chat", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      }
    },
    [
      chatHistory,
      chatId,
      effectiveConnectionId,
      ensureProfessorMariChat,
      loadChatHistory,
      loadMessages,
      setActiveChatId,
      localizeUi,
    ],
  );

  const toggleProfessorChatSelection = useCallback((id: string) => {
    setSelectedChatHistoryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDeleteProfessorChats = useCallback(async () => {
    if (selectedChatHistoryIds.size === 0) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.chat.homeprofessormarichat.deleteSelectedChats"),
      message: localizeUi("ui.chat.homeprofessormarichat.deleteSelectedChatsConfirmation", {
        count: selectedChatHistoryIds.size,
      }),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!confirmed) return;

    const selectedIds = [...selectedChatHistoryIds];
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => api.delete(`/chats/internal/professor-mari/chats/${id}`)),
      );
      const deletedIds = new Set(selectedIds.filter((_, index) => results[index]?.status === "fulfilled"));
      const failedDeletion = results.find((result) => result.status === "rejected");
      setChatHistorySelectionMode(false);
      setSelectedChatHistoryIds(new Set());
      if (chatId && deletedIds.has(chatId)) {
        const chat = await ensureProfessorMariChat(effectiveConnectionId);
        setActiveChatId(chat.id);
        await loadMessages(chat.id);
      }
      await loadChatHistory();
      if (failedDeletion?.status === "rejected") throw failedDeletion.reason;
    } catch (error) {
      console.error("[Professor Mari] Failed to delete selected chats", error);
      await loadChatHistory().catch(() => undefined);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteSelectedChats"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    }
  }, [
    chatId,
    effectiveConnectionId,
    ensureProfessorMariChat,
    loadChatHistory,
    loadMessages,
    setActiveChatId,
    localizeUi,
    selectedChatHistoryIds,
  ]);

  const handleAttachmentUpload = useCallback(
    async (files: FileList | null) => {
      const acceptedFiles = Array.from(files ?? []).filter((file) => {
        if (file.size > PROFESSOR_MARI_ATTACHMENT_MAX_BYTES) {
          toast.error(localizeUi("ui.chat.homeprofessormarichat.value1IsTooLargeMax20Mb", { value1: file.name }));
          return false;
        }
        if (!isSupportedProfessorMariAttachment(file)) {
          toast.error(
            localizeUi("ui.chat.homeprofessormarichat.value1IsNotSupportedHereAttachImagesPdfsOr", {
              value1: file.name || localizeUi("ui.chat.chatinput.thatFile"),
            }),
          );
          return false;
        }
        return true;
      });
      if (acceptedFiles.length === 0) return;

      setIsReadingAttachments(true);
      const prepared: ProfessorMariAttachment[] = [];
      try {
        for (const file of acceptedFiles) {
          const displayName = file.name || "attached-file";
          if (file.type.startsWith("image/")) {
            prepared.push(await prepareImageAttachment(file, displayName));
            continue;
          }
          prepared.push({
            type: inferProfessorMariAttachmentType(file),
            data: await readProfessorMariFileAsDataUrl(file),
            name: displayName,
          });
        }
      } catch (error) {
        console.error("[Professor Mari] Failed to prepare attachment", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotAttachThatFile"), {
          description:
            error instanceof Error ? error.message : localizeUi("ui.chat.homeprofessormarichat.theFileCouldNotBeRead"),
          duration: PROFESSOR_MARI_ERROR_TOAST_DURATION_MS,
        });
      } finally {
        if (prepared.length > 0) {
          setAttachments((current) => [...current, ...prepared]);
        }
        const resizedCount = prepared.filter((attachment) => attachment.resized).length;
        if (resizedCount > 0) {
          toast.info(
            localizeUi("ui.chat.homeprofessormarichat.value1ImageValue2ResizedForProfessorMariSVision", {
              value1: resizedCount,
              value2: resizedCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
            }),
          );
        }
        setIsReadingAttachments(false);
      }
    },
    [localizeUi],
  );

  const sendWorkspaceMessage = useCallback(
    async (
      chat: Pick<Chat, "id">,
      text: string,
      attachments: ProfessorMariAttachment[] = [],
      existingUserMessageId?: string,
    ) => {
      const runId = ++workspaceRunIdRef.current;
      const controller = new AbortController();
      workspaceAbortRef.current = controller;
      workspaceTextThrottle.cancel();
      pendingWorkspaceTextRef.current = "";
      setWorkspaceActive(true);
      setWorkspaceActivity("Thinking...");
      setWorkspaceTimeline([]);
      setMariChips(chat.id, []);
      useChatStore.getState().setAbortController(chat.id, controller);
      useChatStore.getState().clearStreamBuffer(chat.id);
      useChatStore.getState().clearThinkingBuffer(chat.id);
      useChatStore.getState().setMariPhase(chat.id, "thinking");
      let received = false;
      try {
        for await (const event of api.streamEvents(
          "/professor-mari/workspace/prompt",
          {
            chatId: chat.id,
            message: text,
            connectionId: effectiveConnectionId,
            debugMode: useUIStore.getState().debugMode,
            attachments,
            existingUserMessageId,
          },
          controller.signal,
          // Backgrounding leaves the socket half-open; detach on resume. The
          // server keeps the run going and persists it, so we reload the result
          // (and pending approvals) on return instead of hanging.
          { disconnectOnResume: true },
        )) {
          if (event.type === "token" && typeof event.data === "string") {
            received = true;
            setWorkspaceActivity(null);
            pendingWorkspaceTextRef.current += event.data;
            workspaceTextThrottle.call(undefined);
            useChatStore.getState().appendStreamBuffer(event.data, chat.id);
            continue;
          }
          workspaceTextThrottle.flush();
          if (event.type === "thinking" && typeof event.data === "string") {
            setWorkspaceTimeline((current) => appendThinkingTimeline(current, event.data as string));
            useChatStore.getState().appendThinkingBuffer(event.data, chat.id);
          } else if (event.type === "status") {
            const data = asRecord(event.data);
            const content =
              typeof event.data === "string"
                ? event.data
                : typeof data?.content === "string"
                  ? data.content
                  : "Working...";
            setWorkspaceTimeline((current) => appendStatusTimeline(current, content));
            setWorkspaceActivity(content);
          } else if (event.type === "tool_start") {
            const data = asRecord(event.data);
            const name = typeof data?.name === "string" ? data.name : "tool";
            const toolCall: WorkspaceToolCall = {
              id: getToolCallId(data, name),
              name,
              status: "running",
              input: data?.input,
              detail: previewValue(data?.input),
              output: null,
              updatedAt: Date.now(),
            };
            setWorkspaceTimeline((current) => upsertToolTimeline(current, toolCall));
            setWorkspaceActivity(`Using ${formatToolName(name)}...`);
            useChatStore.getState().setMariPhase(chat.id, "updating");
          } else if (event.type === "tool_update") {
            const data = asRecord(event.data);
            const name = typeof data?.name === "string" ? data.name : "tool";
            const toolCall: WorkspaceToolCall = {
              id: getToolCallId(data, name),
              name,
              status: "running",
              detail: null,
              output: outputValue(data?.output),
              updatedAt: Date.now(),
            };
            setWorkspaceTimeline((current) => upsertToolTimeline(current, toolCall));
          } else if (event.type === "tool_end") {
            const data = asRecord(event.data);
            const name = typeof data?.name === "string" ? data.name : "tool";
            const isError = data?.isError === true;
            const toolCall: WorkspaceToolCall = {
              id: getToolCallId(data, name),
              name,
              status: isError ? "error" : "done",
              detail: null,
              output: outputValue(data?.output),
              updatedAt: Date.now(),
            };
            setWorkspaceTimeline((current) => upsertToolTimeline(current, toolCall));
            setWorkspaceActivity(isError ? "Tool needs attention" : "Thinking...");
          } else if (event.type === "suggestions") {
            const chips = Array.isArray(event.data) ? (event.data as MariSuggestionChip[]) : [];
            if (
              useUIStore.getState().professorMariSuggestionsEnabled ||
              chips.some((chip) => chip.id === "authorization-accept")
            ) {
              setMariChips(chat.id, chips);
            }
          } else if (event.type === "plan") {
            if (useUIStore.getState().professorMariSuggestionsEnabled) {
              const steps = Array.isArray(event.data) ? (event.data as MariGuidedPlanStep[]) : [];
              if (steps.length > 0) setMariPlan(chat.id, steps);
              else clearMariPlan();
            }
          } else if (event.type === "done") {
            received = true;
          } else if (event.type === "error") {
            throw new Error(typeof event.data === "string" ? event.data : "Workspace generation failed");
          }
        }
      } catch (error) {
        if (!(error instanceof StreamResumeDisconnectError)) throw error;
        // Detached by backgrounding, not a failure — the run continues and
        // persists server-side. Wait for it to actually settle before reporting
        // success, so handleSubmit reloads the finished reply and approvals
        // rather than a half-written state.
        setWorkspaceActivity("Finishing in the background…");
        await waitForWorkspaceRunToSettle(effectiveConnectionId, controller.signal);
        received = true;
      } finally {
        workspaceTextThrottle.flush();
        workspaceAbortRef.current = null;
        setWorkspaceActive(false);
        setWorkspaceActivity(null);
        useChatStore.getState().setAbortController(chat.id, null);
        useChatStore.getState().setMariPhase(chat.id, "idle");
      }
      return { received, runId };
    },
    [clearMariPlan, effectiveConnectionId, setMariChips, setMariPlan, workspaceTextThrottle],
  );

  const refreshAfterWorkspaceRun = useCallback(
    async (completedChatId: string, runId: number) => {
      let messagesReloaded = false;
      try {
        if (workspaceRunIdRef.current !== runId || activeChatIdRef.current !== completedChatId) return;
        await loadMessages(completedChatId, {
          shouldApply: () => workspaceRunIdRef.current === runId && activeChatIdRef.current === completedChatId,
        });
        messagesReloaded = true;
      } catch (error) {
        console.error("[Professor Mari] Failed to reload messages after completed workspace run", error);
      }
      if (workspaceRunIdRef.current !== runId || activeChatIdRef.current !== completedChatId) return;
      if (messagesReloaded) {
        useChatStore.getState().clearStreamBuffer(completedChatId);
        useChatStore.getState().clearThinkingBuffer(completedChatId);
        setWorkspaceTimeline([]);
      }
      await Promise.allSettled([
        refreshWorkspaceStatus(
          () => workspaceRunIdRef.current === runId && activeChatIdRef.current === completedChatId,
        ),
        invalidateWorkspaceData(),
      ]);
    },
    [invalidateWorkspaceData, loadMessages, refreshWorkspaceStatus],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!chatId || isBusy) return;
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.chat.homeprofessormarichat.deleteMessage"),
        message: localizeUi("ui.chat.homeprofessormarichat.deleteMessageConfirmation"),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      });
      if (!confirmed || messageMutationBusyRef.current) return;
      messageLoadAbortRef.current?.abort();
      // Optimistic update from local state
      setMessages((current) => current.filter((m) => m.id !== messageId));
      try {
        await api.delete(`/chats/${chatId}/messages/${messageId}`);
      } catch (error) {
        console.error("[Professor Mari] Failed to delete message", error);
        await loadMessages(chatId).catch(() => undefined);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteThatMessage"), {
          description: describeProfessorMariError(error),
        });
      }
    },
    [chatId, isBusy, loadMessages, localizeUi],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!chatId || isBusy) return;
      messageLoadAbortRef.current?.abort();
      setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, content } : m)));
      try {
        await api.patch(`/chats/${chatId}/messages/${messageId}`, { content });
      } catch (error) {
        console.error("[Professor Mari] Failed to edit message", error);
        await loadMessages(chatId).catch(() => undefined);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotSaveThatEdit"), {
          description: describeProfessorMariError(error),
        });
      }
    },
    [chatId, isBusy, loadMessages, localizeUi],
  );

  const handleRegenerateMessage = useCallback(
    async (messageId: string) => {
      if (isBusy || regenerationInFlightRef.current || !chatId) return;
      if (!effectiveConnectionId) {
        toast.error(PROFESSOR_MARI_NO_CONNECTION_TOAST);
        setConnectionMenuOpen(true);
        useUIStore.getState().openRightPanel("connections");
        return;
      }
      const initialMessages = messagesRef.current;
      const initialIndex = initialMessages.findIndex((message) => message.id === messageId);
      if (
        initialIndex <= 0 ||
        initialIndex !== initialMessages.length - 1 ||
        initialMessages[initialIndex]?.role !== "assistant" ||
        initialMessages[initialIndex - 1]?.role !== "user"
      )
        return;

      regenerationInFlightRef.current = true;
      setSending(true);
      try {
        const confirmed = await showConfirmDialog({
          title: localizeUi("ui.chat.homeprofessormarichat.regenerateResponse"),
          message: localizeUi("ui.chat.homeprofessormarichat.regenerateResponseConfirmation"),
          confirmLabel: localizeUi("ui.chat.chatmessage.regenerate"),
          tone: "destructive",
        });
        if (!confirmed || activeChatIdRef.current !== chatId) return;

        const currentMessages = messagesRef.current;
        const index = currentMessages.findIndex((message) => message.id === messageId);
        if (index <= 0 || index !== currentMessages.length - 1 || currentMessages[index]?.role !== "assistant") return;
        const userMessage = currentMessages[index - 1];
        if (userMessage.role !== "user") return;

        messageLoadAbortRef.current?.abort();
        setMessages((current) => current.filter((message) => message.id !== messageId));
        await api.delete(`/chats/${chatId}/messages/${messageId}`);
        const { received, runId } = await sendWorkspaceMessage(
          { id: chatId },
          userMessage.content,
          getProfessorMariAttachments(userMessage),
          userMessage.id,
        );
        if (!received) throw new Error("Professor Mari did not return a regenerated response");
        void refreshAfterWorkspaceRun(chatId, runId);
      } catch (error) {
        console.error("[Professor Mari] Failed to regenerate response", error);
        void loadMessages(chatId).catch(() => undefined);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRegenerateThatResponse"), {
          description: describeProfessorMariError(error),
        });
      } finally {
        regenerationInFlightRef.current = false;
        setSending(false);
      }
    },
    [chatId, effectiveConnectionId, isBusy, loadMessages, localizeUi, refreshAfterWorkspaceRun, sendWorkspaceMessage],
  );

  const handleRemoveAttachment = useCallback(
    async (messageId: string, attachmentIndex: number) => {
      if (!chatId || isBusy || attachmentRemovalInFlightRef.current.has(messageId)) return;
      attachmentRemovalInFlightRef.current.add(messageId);
      try {
        const confirmed = await showConfirmDialog({
          title: localizeUi("ui.chat.homeprofessormarichat.removeAttachment"),
          message: localizeUi("ui.chat.homeprofessormarichat.removeAttachmentConfirmation"),
          confirmLabel: localizeUi("ui.panels.agentspanel.remove"),
          tone: "destructive",
        });
        if (!confirmed || messageMutationBusyRef.current) return;
        const message = messagesRef.current.find((item) => item.id === messageId);
        if (!message) return;
        const currentAttachments = getProfessorMariAttachments(message);
        const updated = currentAttachments.filter((_, index) => index !== attachmentIndex);
        if (updated.length === currentAttachments.length) return;
        messageLoadAbortRef.current?.abort();
        setMessages((current) =>
          current.map((item) => {
            if (item.id !== messageId) return item;
            const extra = toMessageExtra(item);
            return { ...item, extra: { ...extra, attachments: updated } };
          }),
        );
        await api.patch(`/chats/${chatId}/messages/${messageId}/extra`, { attachments: updated });
      } catch (error) {
        console.error("[Professor Mari] Failed to remove attachment", error);
        await loadMessages(chatId).catch(() => undefined);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRemoveThatAttachment"), {
          description: describeProfessorMariError(error),
        });
      } finally {
        attachmentRemovalInFlightRef.current.delete(messageId);
      }
    },
    [chatId, isBusy, loadMessages, localizeUi],
  );

  async function handleSubmit(overrideText?: string) {
    const text = (overrideText ?? draft).trim();
    const submittedAttachments = attachments;
    const messageText = text || (submittedAttachments.length > 0 ? "Please inspect the attached file." : "");
    if (!messageText || isBusy || regenerationInFlightRef.current || isReadingAttachments) return;

    if (messageText === "/restart") {
      await runRestart();
      return;
    }

    if (await handleTitleCommand(messageText)) return;

    if (!effectiveConnectionId) {
      toast.error(PROFESSOR_MARI_NO_CONNECTION_TOAST);
      setConnectionMenuOpen(true);
      useUIStore.getState().openRightPanel("connections");
      return;
    }

    setSending(true);
    try {
      const chat = await ensureProfessorMariChat(effectiveConnectionId);
      setDraft("");
      setMariChips(chat.id, []);
      clearMariPlan();
      setAttachments([]);
      setMessages((current) => [...current, createLocalUserMessage(chat.id, messageText, submittedAttachments)]);
      trackAchievement.mutate("prof_mari_message_sent");
      const { received, runId } = await sendWorkspaceMessage(chat, messageText, submittedAttachments);
      void refreshAfterWorkspaceRun(chat.id, runId);
      if (!received) {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariDidNotReceiveAReplyFromThe"), {
          description: localizeUi("ui.chat.homeprofessormarichat.theModelOrServerMayStillBeBusyThis"),
          duration: PROFESSOR_MARI_ERROR_TOAST_DURATION_MS,
        });
      }
    } catch (error) {
      if (isProfessorMariAbortError(error)) return;
      setDraft(text);
      setAttachments(submittedAttachments);
      console.error("[Professor Mari] Failed to send", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotAnswerRightNow"), {
        description: describeProfessorMariError(error),
        duration: PROFESSOR_MARI_ERROR_TOAST_DURATION_MS,
      });
    } finally {
      setSending(false);
    }
  }

  const renderDisplayMessage = (message: Message) => {
    const canManageMessage = message.id !== PROFESSOR_MARI_WELCOME_MESSAGE_ID;
    return (
      <CompactMariMessage
        key={message.id}
        message={message}
        thinking={message.role === "assistant" ? getMessageThinking(message) : null}
        onDelete={canManageMessage && !isBusy ? handleDeleteMessage : undefined}
        onEdit={canManageMessage && !isBusy ? handleEditMessage : undefined}
        onRegenerate={canManageMessage ? handleRegenerateMessage : undefined}
        canRegenerate={canManageMessage && !isBusy && message.id === messages[messages.length - 1]?.id}
        onRemoveAttachment={canManageMessage && !isBusy ? handleRemoveAttachment : undefined}
      />
    );
  };

  // #5073: the chat-history picker + Context Viewer. createPortal to document.body, so they render
  // correctly from whichever composer (floating or docked) is active. Gated on a live chatId.
  const attachModals = chatId ? (
    <>
      <MariChatHistoryPicker
        open={historyPickerOpen}
        workspaceChatId={chatId}
        onClose={() => setHistoryPickerOpen(false)}
      />
      <MariContextViewer
        open={contextViewerOpen}
        workspaceChatId={chatId}
        onClose={() => setContextViewerOpen(false)}
      />
    </>
  ) : null;

  const renderFloatingChatBody = () => (
    <>
      {attachModals}
      <div
        ref={setTranscriptScrollNode}
        onScroll={handleTranscriptScroll}
        data-component="HomeProfessorMariChat.Transcript"
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3 pb-4 text-left"
      >
        {loadingHistory ? (
          <LoadingHistoryState />
        ) : (
          <>
            {displayMessages.map(renderDisplayMessage)}
            {showConnectionFirstHint && (
              <p className="px-3 py-1 text-center text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.homeprofessormarichat.selectAConnectionFirst")}
              </p>
            )}
            {workspaceTimeline.length === 0 && workspaceTimelineActive && !showDottoreSupport && (
              <WorkspaceStatusEvent content={workspaceActivity ?? "Thinking..."} />
            )}
            {showDottoreSupport && (
              <TranscriptRow marker={<MariAvatar active />}>
                <ProfessorMariWorkingWindow visible className="max-w-[18rem]" />
              </TranscriptRow>
            )}
            <WorkspaceTimelineList items={workspaceTimeline} active={workspaceTimelineActive} openReasoning />
            {workspaceStatus?.error && <WorkspaceErrorEvent message={workspaceStatus.error} />}
            {visiblePendingChangeReviews.map((approval) => (
              <WorkspaceApprovalCard
                key={approval.id}
                approval={approval}
                busy={workspaceReviewActionId === approval.id}
                disabled={workspaceReviewActionId !== null}
                onKeep={(id) => void keepWorkspaceChange(id)}
                onKeepEnable={(id) => void keepWorkspaceChange(id, { enable: true })}
                onRestore={(id) => void restoreWorkspaceChange(id)}
                onRejectRows={(id, rows) => rejectWorkspaceRows(id, rows)}
                onRenderPrompt={renderWorkspacePrompt}
              />
            ))}
          </>
        )}
      </div>

      <form
        className="border-t border-[var(--border)]/60 px-2.5 py-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {showTokenUsage && contextBudget && <ProfessorMariContextBudgetIndicator budget={contextBudget} />}
        <input
          ref={attachmentInputRef}
          type="file"
          accept={PROFESSOR_MARI_ATTACHMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            void handleAttachmentUpload(event.target.files);
            event.target.value = "";
          }}
        />
        <ProfessorMariAttachmentPreviews
          attachments={attachments}
          isReading={isReadingAttachments}
          onRemove={(index) => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        />
        {chipRowHint && (
          <p className="mb-1 flex items-center gap-1.5 px-0.5 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
            <Sparkles size="0.75rem" className="shrink-0 text-[var(--primary)]" />
            <span>{chipRowHint}</span>
          </p>
        )}
        {showSuggestionLoading && (
          <div className="mb-1 flex items-center gap-1.5 px-0.5 text-xs text-[var(--muted-foreground)]">
            <Sparkles size="0.75rem" className="shrink-0 animate-pulse text-[var(--primary)]" />
            {localizeUi("ui.chat.homeprofessormarichat.thinkingUpSuggestions")}
          </div>
        )}
        <MariSuggestionChips chips={chipRowChips} onSelect={handleSuggestionSelect} disabled={isBusy} />
        <div className="relative flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 shadow-inner shadow-black/10 focus-within:border-[var(--primary)]/50">
          <MariAttachButton
            onAttachFiles={() => attachmentInputRef.current?.click()}
            onAddChatHistory={() => void handleOpenHistoryPicker()}
            onViewContext={() => void handleOpenContextViewer()}
            attachedFileCount={attachments.length}
            attachedContextCount={attachedContext?.length ?? 0}
            disabled={isBusy || isReadingAttachments}
            isReading={isReadingAttachments}
          />

          <button
            ref={connectionButtonRef}
            type="button"
            onClick={() => setConnectionMenuOpen((current) => !current)}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
              connectionMenuOpen
                ? "bg-foreground/10 text-foreground/75"
                : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title={
              effectiveConnection?.name
                ? localizeUi("ui.chat.homeprofessormarichat.connectionValue1", { value1: effectiveConnection.name })
                : localizeUi("ui.chat.homeprofessormarichat.selectConnection")
            }
          >
            <Link size="1rem" />
          </button>

          {connectionMenuOpen && (
            <div
              ref={connectionMenuRef}
              className="absolute bottom-full left-12 z-20 mb-2 flex max-h-72 min-w-[15rem] max-w-[20rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] text-left shadow-2xl"
            >
              <div className="border-b border-[var(--border)] px-3 py-2 text-[0.6875rem] font-semibold text-[var(--foreground)]">
                {localizeUi("navigation.topbar.connections")}
              </div>
              <div className="overflow-y-auto p-1">
                {connectionOptions.length > 0 ? (
                  connectionOptions.map((connection) => {
                    const isActive = effectiveConnectionId === connection.id;
                    return (
                      <button
                        key={connection.id}
                        type="button"
                        onClick={() => handleConnectionChange(connection.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                          isActive && "font-semibold text-[var(--foreground)]",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {connection.name || connection.id}
                          {connection.id === LOCAL_SIDECAR_CONNECTION_ID && (
                            <span className="ml-1 text-[0.625rem] font-normal text-[var(--muted-foreground)]">
                              {sidecarNativeToolCalls
                                ? localizeUi("ui.chat.homeprofessormarichat.nativeTools")
                                : localizeUi("ui.chat.homeprofessormarichat.toolsOff")}
                            </span>
                          )}
                        </span>
                        {isActive && <Check size="0.75rem" className="shrink-0 text-[var(--primary)]" />}
                      </button>
                    );
                  })
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConnectionMenuOpen(false);
                      useUIStore.getState().openRightPanel("connections");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <Link size="0.875rem" />
                    {localizeUi("ui.chat.homeprofessormarichat.addAConnection")}
                  </button>
                )}
              </div>
            </div>
          )}

          <textarea
            ref={embeddedTextareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (mobileFocusMode) event.currentTarget.scrollIntoView({ block: "end" });
            }}
            onKeyDown={(event) => {
              const shouldSend =
                event.key === "Enter" && !event.shiftKey && (enterToSend || event.metaKey || event.ctrlKey);
              if (shouldSend) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            rows={1}
            placeholder={t("home.professorMari.placeholder")}
            className="mari-chat-input-textarea min-h-8 max-h-32 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1.5 text-sm leading-normal text-foreground/90 outline-hidden placeholder:text-foreground/30 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={!canSubmitMessage || isBusy}
            className={cn(
              "mari-chat-send-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition-all duration-200",
              canSubmitMessage && !isBusy ? "hover:text-white active:scale-90" : "cursor-not-allowed opacity-40",
            )}
            aria-label={t("home.professorMari.send")}
            title={t("home.professorMari.send")}
          >
            <Send size="0.9375rem" className={cn(canSubmitMessage && "translate-x-[1px]")} />
          </button>
        </div>
      </form>
    </>
  );

  if (floatingMode) {
    if (!chatWindowOpen) {
      if (!floatingSmallViewport) return null;
      return (
        <div
          ref={floatingButtonRef}
          className={cn(
            "mari-chrome-token-scope fixed z-[95] touch-none sm:hidden",
            floatingPosition ? "" : "bottom-4 left-4",
          )}
          style={floatingPositionStyle}
          onPointerDown={beginFloatingDrag}
          onPointerMove={moveFloatingDrag}
          onPointerUp={endFloatingDrag}
          onPointerCancel={endFloatingDrag}
        >
          <button
            type="button"
            onClick={handleFloatingButtonClick}
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--primary)]/40 bg-[var(--background)] shadow-lg shadow-black/35 ring-1 ring-black/20"
            aria-label={t("home.professorMari.open")}
          >
            <img
              src={MARI_AVATAR_URL}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
              aria-hidden="true"
            />
          </button>
          <button
            data-professor-mari-floating-action
            type="button"
            onClick={onFloatingDismiss}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] shadow-lg"
            aria-label={t("home.professorMari.dismiss")}
            title={t("home.professorMari.dismiss")}
          >
            <X size="0.65rem" />
          </button>
        </div>
      );
    }

    if (floatingSmallViewport) {
      return (
        <motion.div
          key="professor-mari-floating-mobile"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={PROFESSOR_MARI_PANE_TRANSITION}
          className="mari-chrome-token-scope fixed inset-x-0 top-[calc(3rem_+_env(safe-area-inset-top))] z-[95] flex h-[calc(100vh_-_3rem_-_env(safe-area-inset-top))] max-h-[calc(100vh_-_3rem_-_env(safe-area-inset-top))] flex-col bg-[var(--background)] supports-[height:100dvh]:h-[calc(100dvh_-_3rem_-_env(safe-area-inset-top))] supports-[height:100dvh]:max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-top))] sm:hidden"
        >
          <div className="flex h-12 shrink-0 items-center justify-end border-b border-[var(--border)]/60 bg-[var(--card)]/80 px-2">
            <button
              type="button"
              onClick={closeChatWindow}
              className="mari-chrome-control mari-chrome-control--small mari-accent-animated inline-flex h-8 w-8 items-center justify-center rounded-md p-0"
              aria-label={t("home.professorMari.close")}
              title={t("home.professorMari.close")}
            >
              <X size="0.9rem" />
            </button>
          </div>
          {renderFloatingChatBody()}
        </motion.div>
      );
    }

    return (
      <div
        ref={floatingSurfaceRef}
        className={cn(
          "mari-chrome-token-scope fixed z-[95] flex h-[min(32rem,calc(100vh-5rem))] w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-accent)] bg-[var(--background)] shadow-2xl shadow-black/40 ring-1 ring-black/15",
          floatingPosition ? "" : "bottom-3 left-3",
        )}
        style={floatingPositionStyle}
      >
        <div
          className="flex h-9 shrink-0 touch-none cursor-move items-center justify-between border-b border-[var(--border)]/60 bg-[var(--card)]/85 px-2"
          onPointerDown={beginFloatingDrag}
          onPointerMove={moveFloatingDrag}
          onPointerUp={endFloatingDrag}
          onPointerCancel={endFloatingDrag}
        >
          <div className="min-w-0 truncate text-xs font-semibold text-[var(--marinara-chat-chrome-accent)]">
            {t("home.professorMari.ask")}
          </div>
          <button
            data-professor-mari-floating-action
            type="button"
            onClick={onFloatingDismiss}
            className="mari-chrome-control mari-chrome-control--small mari-accent-animated h-7 w-7 shrink-0 p-0"
            aria-label={t("home.professorMari.dismiss")}
            title={t("home.professorMari.dismiss")}
          >
            <X size="0.875rem" />
          </button>
        </div>
        {renderFloatingChatBody()}
      </div>
    );
  }

  return (
    <>
      {attachModals}
      {!launchHidden && (
        <div
          className={cn(
            "home-professor-mari-chat mt-4 w-full",
            attachedFooter && "rounded-t-xl",
            desktopChatWindowOpen && "hidden",
            mobileFocusMode && "hidden",
          )}
          data-paused={pageActive ? "false" : "true"}
        >
          <section
            className="mari-chrome-accent-frame mari-chrome-accent-panel mari-accent-animated relative flex min-w-0 flex-col items-center gap-2 overflow-visible rounded-2xl border p-3 text-center sm:p-4"
            data-component="HomeProfessorMariChat.MariPanel"
          >
            <span
              className="mari-accent-soft-fill mari-accent-animated pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl"
              aria-hidden="true"
            />
            <div className="flex w-full flex-col items-center gap-2">
              <div
                className="relative z-[1] mt-3 w-full max-w-[10.5rem] [--mari-professor-sprite-bottom:5%] sm:max-w-[11.5rem] lg:mt-0 lg:max-w-[10.5rem] xl:max-w-[11.5rem]"
                data-component="HomeProfessorMariChat.Scene"
              >
                <ProfessorMariPixelScene active={isBusy || mariPhase !== null} />
              </div>
              <div className="w-full min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.chat.homefaq.professorMari")}
                </div>
                <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                  {isBusy
                    ? localizeUi("ui.chat.homeprofessormarichat.workingOnIt")
                    : localizeUi("ui.chat.homeprofessormarichat.readyToHelp")}
                </div>
              </div>
            </div>
            <div
              className="flex min-h-0 w-full max-w-2xl flex-col justify-center gap-1 px-1 text-center text-[0.6875rem] leading-[1.35] text-[var(--muted-foreground)]"
              data-component="HomeProfessorMariChat.Welcome"
            >
              {MARI_WELCOME.split("\n\n")
                .slice(0, 2)
                .map((paragraph, index) => (
                  <p key={paragraph} className={cn(index === 0 && "font-semibold text-[var(--foreground)]")}>
                    {paragraph}
                  </p>
                ))}
            </div>
            <button
              type="button"
              onClick={openChatWindow}
              className="mari-chrome-control mari-chrome-control--primary w-full justify-center gap-2 text-xs"
            >
              <MessageCircle size="0.9rem" />
              {t("home.professorMari.ask")}
            </button>
          </section>
        </div>
      )}

      <AnimatePresence onExitComplete={onChatWindowExitComplete}>
        {chatWindowOpen && (
          <ProfessorMariMobilePortal disabled={embeddedTab}>
            <motion.div
              key="professor-mari-window"
              data-component="HomeProfessorMariChat.Window"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={PROFESSOR_MARI_PANE_TRANSITION}
              className={cn(
                "flex min-h-0 items-stretch justify-center",
                embeddedTab
                  ? "relative z-auto h-full w-full bg-transparent p-0"
                  : "fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)_+_3rem)] z-[80] bg-[var(--background)] pb-[env(safe-area-inset-bottom)] sm:static sm:z-auto sm:h-full sm:max-h-none sm:w-full sm:flex-1 sm:bg-transparent sm:p-0",
              )}
            >
              <div className={cn("h-full min-h-0 w-full", embeddedTab ? "max-w-none" : "max-w-none sm:max-w-5xl")}>
                <AnimatePresence mode="wait" initial={false}>
                  {chatHistoryOpen ? (
                    <motion.div
                      key="professor-mari-chats"
                      initial={{ opacity: 0, y: -14, rotateX: -10, transformOrigin: "top center" }}
                      animate={{ opacity: 1, y: 0, rotateX: 0, transformOrigin: "top center" }}
                      exit={{ opacity: 0, y: 12, rotateX: 8, transformOrigin: "bottom center" }}
                      transition={PROFESSOR_MARI_PANE_TRANSITION}
                      className="h-full min-w-0"
                    >
                      <section className="flex h-full min-h-0 min-w-0 flex-col rounded-none border-0 bg-[var(--background)] sm:rounded-xl sm:border sm:border-[var(--border)]/70 sm:bg-[var(--background)] sm:shadow-2xl">
                        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-[var(--foreground)]">
                              {t("home.professorMari.chats")}
                            </div>
                            <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                              {localizeUi("ui.chat.homeprofessormarichat.restartSavesTheCurrentChatHere")}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (chatHistorySelectionMode) {
                                  setChatHistorySelectionMode(false);
                                  setSelectedChatHistoryIds(new Set());
                                } else {
                                  setChatHistorySelectionMode(true);
                                }
                              }}
                              disabled={chatHistory.length === 0 || chatHistoryLoading}
                              className="mari-chrome-control mari-chrome-control--small h-8 px-2 text-[0.625rem]"
                              aria-pressed={chatHistorySelectionMode}
                            >
                              <Check size="0.75rem" />
                              {localizeUi(
                                chatHistorySelectionMode
                                  ? "ui.chat.homeprofessormarichat.cancelSelection"
                                  : "ui.chat.homeprofessormarichat.selectChats",
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatHistoryOpen(false)}
                              className="mari-chrome-control mari-chrome-control--small h-8 w-8 p-0"
                              aria-label={t("home.professorMari.closeChats")}
                              title={t("home.professorMari.closeChats")}
                            >
                              <X size="0.85rem" />
                            </button>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                          {chatHistoryLoading ? (
                            <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">
                              <Loader2 size="0.875rem" className="mr-2 animate-spin" />
                              {localizeUi("ui.chat.homeprofessormarichat.loadingChats")}
                            </div>
                          ) : chatHistory.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
                              {t("home.professorMari.noPreviousChats")}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {chatHistory.map((item) => {
                                const active = item.id === chatId || isProfessorMariChatActive(item);
                                const renaming = renamingChatId === item.id;
                                const selected = selectedChatHistoryIds.has(item.id);
                                return (
                                  <div
                                    key={item.id}
                                    data-professor-mari-chat-id={item.id}
                                    className={cn(
                                      "rounded-lg border border-[var(--border)] bg-[var(--card)]/70 p-2",
                                      active && "border-[var(--primary)]/50 bg-[var(--primary)]/5",
                                      selected && "ring-1 ring-[var(--primary)]",
                                    )}
                                  >
                                    {renaming ? (
                                      <form
                                        className="flex items-center gap-1.5"
                                        onSubmit={(event) => {
                                          event.preventDefault();
                                          void handleRenameProfessorChat(item.id);
                                        }}
                                      >
                                        <input
                                          value={renameDraft}
                                          onChange={(event) => setRenameDraft(event.target.value)}
                                          aria-label={localizeUi("ui.chat.homeprofessormarichat.renameChatInput")}
                                          className="min-w-0 flex-1 rounded-md bg-[var(--background)] px-2 py-1.5 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]"
                                          autoFocus
                                        />
                                        <button
                                          type="submit"
                                          className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--small h-8 px-2 text-[0.625rem]"
                                        >
                                          {localizeUi("ui.noodle.noodlehome.save")}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRenamingChatId(null);
                                            setRenameDraft("");
                                          }}
                                          className="mari-chrome-control mari-chrome-control--small h-8 px-2 text-[0.625rem]"
                                        >
                                          {localizeUi("chat.delete.dialog.cancel")}
                                        </button>
                                      </form>
                                    ) : (
                                      <div className="flex items-start gap-2">
                                        {chatHistorySelectionMode && (
                                          <span className="mt-1 shrink-0 text-[var(--primary)]" aria-hidden="true">
                                            {selected ? <Check size="0.875rem" /> : <Square size="0.875rem" />}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            chatHistorySelectionMode
                                              ? toggleProfessorChatSelection(item.id)
                                              : void handleSelectProfessorChat(item.id)
                                          }
                                          disabled={isBusy}
                                          aria-pressed={chatHistorySelectionMode ? selected : undefined}
                                          className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <div className="truncate text-xs font-semibold text-[var(--foreground)]">
                                            {item.name || localizeUi("ui.chat.homeprofessormarichat.unnamedChat")}
                                          </div>
                                          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                                            <span>
                                              {item.messageCount ?? 0} {localizeUi("ui.agents.agenteditor.messages")}
                                            </span>
                                            {active && <span>{localizeUi("ui.characters.lorebooktab.active")}</span>}
                                          </div>
                                        </button>
                                        {!chatHistorySelectionMode && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setRenamingChatId(item.id);
                                                setRenameDraft(item.name || "");
                                              }}
                                              className="mari-chrome-control mari-chrome-control--small h-8 px-2 text-[0.625rem]"
                                            >
                                              {localizeUi("ui.chat.homeprofessormarichat.renameChat")}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void handleDeleteProfessorChat(item.id)}
                                              className="mari-chrome-control mari-chrome-control--danger mari-chrome-control--small h-8 px-2 text-[0.625rem]"
                                            >
                                              {localizeUi("lorebook.editor.batch.delete")}
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {chatHistorySelectionMode && (
                          <div className="flex items-center gap-2 border-t border-[var(--border)]/60 px-3 py-2">
                            <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)]">
                              {localizeUi("ui.chat.homeprofessormarichat.selectedChats", {
                                count: selectedChatHistoryIds.size,
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleBulkDeleteProfessorChats()}
                              disabled={selectedChatHistoryIds.size === 0}
                              className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--small h-8 px-3 text-[0.625rem]"
                            >
                              <Trash2 size="0.75rem" />
                              {localizeUi("ui.chat.homeprofessormarichat.deleteSelectedChats")}
                            </button>
                          </div>
                        )}
                      </section>
                    </motion.div>
                  ) : memoriesMenuOpen ? (
                    <motion.div
                      key="professor-mari-memories"
                      initial={{ opacity: 0, y: -14, rotateX: -10, transformOrigin: "top center" }}
                      animate={{ opacity: 1, y: 0, rotateX: 0, transformOrigin: "top center" }}
                      exit={{ opacity: 0, y: 12, rotateX: 8, transformOrigin: "bottom center" }}
                      transition={PROFESSOR_MARI_PANE_TRANSITION}
                      className="h-full min-w-0"
                    >
                      <ProfessorMariMemoriesMenu
                        memories={memories}
                        selectedMemory={selectedMemory}
                        draft={memoryDraft}
                        loading={memoriesLoading}
                        saving={memoriesSaving}
                        fileInputRef={memoryFileInputRef}
                        onClose={() => setMemoriesMenuOpen(false)}
                        onNew={handleNewMemory}
                        onUploadClick={handleMemoryUploadClick}
                        onFileChange={handleMemoryFileChange}
                        onSelect={setSelectedMemoryId}
                        onDraftChange={setMemoryDraft}
                        onSave={() => void handleSaveMemory()}
                        onDelete={(id) => void handleDeleteMemory(id)}
                        onToggleEnabled={handleToggleMemoryEnabled}
                        onTogglePersistent={handleToggleMemoryPersistent}
                        className="h-full rounded-none border-0 bg-[var(--background)] sm:rounded-xl sm:border sm:bg-[var(--background)] sm:shadow-2xl"
                      />
                    </motion.div>
                  ) : skillsMenuOpen ? (
                    <motion.div
                      key="professor-mari-skills"
                      initial={{ opacity: 0, y: -14, rotateX: -10, transformOrigin: "top center" }}
                      animate={{ opacity: 1, y: 0, rotateX: 0, transformOrigin: "top center" }}
                      exit={{ opacity: 0, y: 12, rotateX: 8, transformOrigin: "bottom center" }}
                      transition={PROFESSOR_MARI_PANE_TRANSITION}
                      className="h-full min-w-0"
                    >
                      <ProfessorMariSkillsMenu
                        skills={skills}
                        selectedSkill={selectedSkill}
                        draft={skillDraft}
                        loading={skillsLoading}
                        saving={skillsSaving}
                        diagnostics={skillsDiagnostics}
                        fileInputRef={skillFileInputRef}
                        onClose={() => setSkillsMenuOpen(false)}
                        onNew={handleNewSkill}
                        onUploadClick={handleSkillUploadClick}
                        onFileChange={handleSkillFileChange}
                        onSelect={setSelectedSkillId}
                        onDraftChange={setSkillDraft}
                        onSave={() => void handleSaveSkill()}
                        onDelete={(id) => void handleDeleteSkill(id)}
                        onToggle={(skill) => void handleToggleSkill(skill)}
                        className="h-full rounded-none border-0 bg-[var(--background)] sm:rounded-xl sm:border sm:bg-[var(--background)] sm:shadow-2xl"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="professor-mari-chat"
                      initial={{ opacity: 0, y: 14, rotateX: 8, transformOrigin: "bottom center" }}
                      animate={{ opacity: 1, y: 0, rotateX: 0, transformOrigin: "bottom center" }}
                      exit={{ opacity: 0, y: -12, rotateX: -10, transformOrigin: "top center" }}
                      transition={PROFESSOR_MARI_PANE_TRANSITION}
                      className="h-full min-w-0"
                    >
                      <div
                        className={cn(
                          "flex h-full min-h-0 min-w-0 flex-col overflow-hidden border bg-[var(--background)]",
                          embeddedTab
                            ? "mari-chrome-accent-frame mari-accent-animated rounded-2xl"
                            : "rounded-none border-0 sm:rounded-xl sm:border sm:border-[var(--border)]/70 sm:shadow-2xl",
                        )}
                      >
                        <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[var(--border)]/60 bg-[var(--card)]/80 px-2 pt-2 sm:px-3 sm:py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="mari-chrome-accent-soft-tile mari-accent-animated h-8 w-8 shrink-0 overflow-hidden rounded-md border">
                              <img src={MARI_AVATAR_URL} alt="" className="h-full w-full object-cover" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-bold text-[var(--foreground)]">
                                {localizeUi("ui.chat.homefaq.professorMari")}
                              </span>
                              <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                {isBusy
                                  ? localizeUi("ui.chat.homeprofessormarichat.workingOnIt")
                                  : localizeUi("ui.chat.homeprofessormarichat.readyToHelp")}
                              </span>
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={toggleChatHistory}
                              disabled={isBusy && !chatHistoryOpen}
                              className={cn(
                                "inline-flex h-8 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-semibold transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
                                "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                              )}
                              title={t("home.professorMari.openPreviousChats")}
                              aria-expanded={chatHistoryOpen}
                            >
                              <BookOpen size="0.75rem" />
                              <span className="max-[360px]:hidden">{localizeUi("navigation.common.chats")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={toggleSkillsMenu}
                              className={cn(
                                "inline-flex h-8 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-semibold transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
                                "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                              )}
                              title={localizeUi("ui.chat.homeprofessormarichat.openSkills")}
                              aria-expanded={skillsMenuOpen}
                            >
                              <ArrowDown size="0.75rem" />
                              <span className="max-[360px]:hidden">
                                {localizeUi("ui.chat.homeprofessormarichat.skills")}
                              </span>
                              {skills.length > 0 && (
                                <span className="mari-chrome-muted-badge px-1.5 py-0.5 text-[0.56rem]">
                                  {activeSkillCount}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={toggleMemoriesMenu}
                              className={cn(
                                "inline-flex h-8 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-semibold transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
                                "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                              )}
                              title={localizeUi("ui.chat.homeprofessormarichat.openMemories")}
                              aria-expanded={memoriesMenuOpen}
                            >
                              <Brain size="0.75rem" />
                              <span className="max-[360px]:hidden">
                                {localizeUi("ui.chat.homeprofessormarichat.memories")}
                              </span>
                              {memories.length > 0 && (
                                <span className="mari-chrome-muted-badge px-1.5 py-0.5 text-[0.56rem]">
                                  {activeMemoryCount}
                                </span>
                              )}
                            </button>
                            {(workspaceActive || hasActiveGeneration) && (
                              <button
                                type="button"
                                onClick={() => void stopWorkspace()}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] text-[var(--destructive)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                                title={localizeUi("ui.chat.homeprofessormarichat.stopProfessorMariWorkspaceAgent")}
                              >
                                <Square size="0.7rem" /> {localizeUi("ui.chat.summarypopover.stop")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void runRestart()}
                              disabled={isBusy}
                              className="mari-chrome-accent-text-muted mari-accent-animated inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={t("home.professorMari.restart")}
                              title={t("home.professorMari.restart")}
                            >
                              <RefreshCw size="0.75rem" />
                              <span className="max-[380px]:hidden">
                                {localizeUi("ui.chat.homeprofessormarichat.restart")}
                              </span>
                            </button>
                            {!embeddedTab && (
                              <button
                                type="button"
                                onClick={closeChatWindow}
                                className="mari-editor-action mari-accent-animated inline-flex shrink-0"
                                aria-label={t("home.professorMari.close")}
                                title={t("home.professorMari.close")}
                              >
                                <X size="1.125rem" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div
                          ref={setTranscriptScrollNode}
                          onScroll={handleTranscriptScroll}
                          data-component="HomeProfessorMariChat.Transcript"
                          className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[radial-gradient(circle_at_12%_8%,oklch(0.79_0.16_205/0.06),transparent_26%),radial-gradient(circle_at_88%_12%,color-mix(in_srgb,var(--marinara-app-accent-solid)_7%,transparent),transparent_28%)] px-3 py-3 pb-4 text-left"
                        >
                          {loadingHistory ? (
                            <LoadingHistoryState />
                          ) : (
                            <>
                              {displayMessages.map(renderDisplayMessage)}
                              {showConnectionFirstHint && (
                                <p className="px-3 py-1 text-center text-xs text-[var(--muted-foreground)]">
                                  {localizeUi("ui.chat.homeprofessormarichat.selectAConnectionFirst")}
                                </p>
                              )}
                              {workspaceTimeline.length === 0 && workspaceTimelineActive && !showDottoreSupport && (
                                <WorkspaceStatusEvent content={workspaceActivity ?? "Thinking..."} />
                              )}
                              {showDottoreSupport && (
                                <TranscriptRow marker={<MariAvatar active />}>
                                  <ProfessorMariWorkingWindow visible className="max-w-[18rem]" />
                                </TranscriptRow>
                              )}
                              <WorkspaceTimelineList
                                items={workspaceTimeline}
                                active={workspaceTimelineActive}
                                openReasoning
                              />
                              {workspaceStatus?.error && <WorkspaceErrorEvent message={workspaceStatus.error} />}
                              {visiblePendingChangeReviews.map((approval) => (
                                <WorkspaceApprovalCard
                                  key={approval.id}
                                  approval={approval}
                                  busy={workspaceReviewActionId === approval.id}
                                  disabled={workspaceReviewActionId !== null}
                                  onKeep={(id) => void keepWorkspaceChange(id)}
                                  onKeepEnable={(id) => void keepWorkspaceChange(id, { enable: true })}
                                  onRestore={(id) => void restoreWorkspaceChange(id)}
                                  onRejectRows={(id, rows) => rejectWorkspaceRows(id, rows)}
                                  onRenderPrompt={renderWorkspacePrompt}
                                />
                              ))}
                            </>
                          )}
                        </div>

                        <form
                          className="border-t border-[var(--border)]/60 px-2.5 py-2.5"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleSubmit();
                          }}
                        >
                          {showTokenUsage && contextBudget && (
                            <ProfessorMariContextBudgetIndicator budget={contextBudget} />
                          )}
                          <input
                            ref={attachmentInputRef}
                            type="file"
                            accept={PROFESSOR_MARI_ATTACHMENT_ACCEPT}
                            multiple
                            className="hidden"
                            onChange={(event: ChangeEvent<HTMLInputElement>) => {
                              void handleAttachmentUpload(event.target.files);
                              event.target.value = "";
                            }}
                          />
                          <ProfessorMariAttachmentPreviews
                            attachments={attachments}
                            isReading={isReadingAttachments}
                            onRemove={(index) =>
                              setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
                            }
                          />
                          {chipRowHint && (
                            <p className="mb-1 flex items-center gap-1.5 px-0.5 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                              <Sparkles size="0.6875rem" className="shrink-0 text-[var(--primary)]" />
                              <span>{chipRowHint}</span>
                            </p>
                          )}
                          {showSuggestionLoading && (
                            <div className="mb-1 flex items-center gap-1.5 px-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                              <Sparkles size="0.6875rem" className="shrink-0 animate-pulse text-[var(--primary)]" />
                              {localizeUi("ui.chat.homeprofessormarichat.thinkingUpSuggestions")}
                            </div>
                          )}
                          <MariSuggestionChips
                            chips={chipRowChips}
                            onSelect={handleSuggestionSelect}
                            disabled={isBusy}
                            compact
                          />
                          <div className="relative flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 shadow-inner shadow-black/10 focus-within:border-[var(--primary)]/50">
                            <MariAttachButton
                              onAttachFiles={() => attachmentInputRef.current?.click()}
                              onAddChatHistory={() => void handleOpenHistoryPicker()}
                              onViewContext={() => void handleOpenContextViewer()}
                              attachedFileCount={attachments.length}
                              attachedContextCount={attachedContext?.length ?? 0}
                              disabled={isBusy || isReadingAttachments}
                              isReading={isReadingAttachments}
                            />

                            <button
                              ref={connectionButtonRef}
                              type="button"
                              onClick={() => setConnectionMenuOpen((current) => !current)}
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
                                connectionMenuOpen
                                  ? "bg-foreground/10 text-foreground/75"
                                  : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
                              )}
                              title={
                                effectiveConnection?.name
                                  ? localizeUi("ui.chat.homeprofessormarichat.connectionValue1", {
                                      value1: effectiveConnection.name,
                                    })
                                  : localizeUi("ui.chat.homeprofessormarichat.selectConnection")
                              }
                            >
                              <Link size="1rem" />
                            </button>

                            {connectionMenuOpen && (
                              <div
                                ref={connectionMenuRef}
                                className="absolute bottom-full left-12 z-20 mb-2 flex max-h-72 min-w-[15rem] max-w-[20rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] text-left shadow-2xl"
                              >
                                <div className="border-b border-[var(--border)] px-3 py-2 text-[0.6875rem] font-semibold text-[var(--foreground)]">
                                  {localizeUi("navigation.topbar.connections")}
                                </div>
                                <div className="overflow-y-auto p-1">
                                  {connectionOptions.length > 0 ? (
                                    connectionOptions.map((connection) => {
                                      const isActive = effectiveConnectionId === connection.id;
                                      return (
                                        <button
                                          key={connection.id}
                                          type="button"
                                          onClick={() => handleConnectionChange(connection.id)}
                                          className={cn(
                                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                                            isActive && "font-semibold text-[var(--foreground)]",
                                          )}
                                        >
                                          <span className="min-w-0 flex-1 truncate">
                                            {connection.name || connection.id}
                                            {connection.id === LOCAL_SIDECAR_CONNECTION_ID && (
                                              <span className="ml-1 text-[0.625rem] font-normal text-[var(--muted-foreground)]">
                                                {sidecarNativeToolCalls
                                                  ? localizeUi("ui.chat.homeprofessormarichat.nativeTools")
                                                  : localizeUi("ui.chat.homeprofessormarichat.toolsOff")}
                                              </span>
                                            )}
                                          </span>
                                          {isActive && (
                                            <Check size="0.75rem" className="shrink-0 text-[var(--primary)]" />
                                          )}
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConnectionMenuOpen(false);
                                        useUIStore.getState().openRightPanel("connections");
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                                    >
                                      <Link size="0.875rem" />
                                      {localizeUi("ui.chat.homeprofessormarichat.addAConnection")}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            <textarea
                              ref={floatingTextareaRef}
                              value={draft}
                              onChange={(event) => {
                                setDraft(event.target.value);
                                if (mobileFocusMode) event.currentTarget.scrollIntoView({ block: "end" });
                              }}
                              onKeyDown={(event) => {
                                const shouldSend =
                                  event.key === "Enter" &&
                                  !event.shiftKey &&
                                  (enterToSend || event.metaKey || event.ctrlKey);
                                if (shouldSend) {
                                  event.preventDefault();
                                  void handleSubmit();
                                }
                              }}
                              rows={1}
                              placeholder={t("home.professorMari.placeholder")}
                              className="mari-chat-input-textarea min-h-8 max-h-32 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1.5 text-sm leading-normal text-foreground/90 outline-hidden placeholder:text-foreground/30 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={isBusy}
                            />
                            <button
                              type="submit"
                              disabled={!canSubmitMessage || isBusy}
                              className={cn(
                                "mari-chat-send-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition-all duration-200",
                                canSubmitMessage && !isBusy
                                  ? "hover:text-white active:scale-90"
                                  : "cursor-not-allowed opacity-40",
                              )}
                              aria-label={t("home.professorMari.send")}
                              title={t("home.professorMari.send")}
                            >
                              <Send size="0.9375rem" className={cn(canSubmitMessage && "translate-x-[1px]")} />
                            </button>
                          </div>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </ProfessorMariMobilePortal>
        )}
      </AnimatePresence>
    </>
  );
}

export function ProfessorMariFloatingAssistant({ onDismiss }: { onDismiss: () => void }) {
  return <HomeProfessorMariChat pageActive floatingMode onFloatingDismiss={onDismiss} />;
}
