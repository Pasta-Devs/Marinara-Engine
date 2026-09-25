import {
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Circle,
  Database,
  FileText,
  Link,
  Loader2,
  MessageCircle,
  EllipsisVertical,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  X,
  ClipboardList,
  FastForward,
  Hand,
  RotateCcw,
  ShieldOff,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  MARI_AUTHORIZATION_ACCEPT_CHIP,
  MARI_AUTHORIZATION_DECLINE_CHIP,
  isMariHeldChangeApprovalChip,
  withHeldChangeDeclineChip,
  MARI_STARTER_CHIPS,
  type APIConnection,
  type Chat,
  type MariGuidedPlanStep,
  type MariSuggestionChip,
  type MariWorkspaceSkillDetail,
  type MariWorkspaceActionResult,
  type MariWorkspaceSkillsResponse,
  type MariInstructionDetail,
  type MariInstructionsResponse,
  type MariInstructionMutationResponse,
  type MariWorkspaceStatus,
  type MariWorkspaceTraceItem,
  type Message,
  type ProfessorMariAskContext,
  type ProfessorMariHandoff,
} from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useTrackAchievement } from "../../hooks/use-achievements";
import { chatKeys } from "../../hooks/use-chats";
import { characterKeys, useCharacters, usePersonas } from "../../hooks/use-characters";
import { getCharacterDisplayIdentity } from "../../lib/character-display";
import { buildCharacterPreviewModel, type CharacterPreviewModel } from "../../lib/character-preview";
import { resolveRunSeconds, resolveRunStartMs } from "../../lib/mari-work-card-timing";
import { buildLorebookPreviewModel, type LorebookPreviewModel } from "../../lib/lorebook-preview";
import { completeInline } from "../../lib/inline-completion";
import { selectMariWorkAnimation } from "../../lib/mari-work-animations";
import { resolveStepSeconds } from "../../lib/mari-step-duration";
import { InlineGhostText } from "../ui/InlineGhostText";
import { lorebookKeys, useLorebooks } from "../../hooks/use-lorebooks";
import { presetKeys, usePresets } from "../../hooks/use-presets";
import { useMariWorkspaceContext } from "../../hooks/use-mari-workspace-context";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";
import { MariAttachButton } from "./MariAttachButton";
import { MariChatHistoryPicker } from "./MariChatHistoryPicker";
import { MariContextViewer } from "./MariContextViewer";
import { ProfessorMariContextControl } from "./ProfessorMariContextControl";
import { CharacterSubject } from "../characters/CharacterSubject";
import { LorebookSubject } from "../lorebooks/LorebookSubject";
import { homeFeedKeys } from "../../hooks/use-home-feed";
import { filterLanguageGenerationConnections } from "../../lib/connection-filters";
import { api, ApiError, getPrivilegedActionErrorMessage, isPassiveStreamDisconnect } from "../../lib/api-client";
import { describeProfessorMariError } from "../../lib/professor-mari-errors";
import { resolveProfessorMariVisualState, type ProfessorMariVisualState } from "../../lib/professor-mari-visual-state";
import {
  isPersistentProfessorMariContext,
  professorMariContextCount,
  resolveProfessorMariPresentationState,
  shouldOfferProfessorMariStarterSuggestions,
  shouldShowProfessorMariConnectionHint,
  stripProfessorMariSpeakerPrefix,
} from "../../lib/professor-mari-presentation";
import {
  resolveProfessorMariWorkspaceBackAction,
  type ProfessorMariWorkspaceDestination,
} from "../../lib/professor-mari-workspace-navigation";
import { useMariApprovals } from "../../hooks/use-mari-approvals";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import {
  awaitMariPermissionsModeWrites,
  enqueueMariPermissionsModeWrite,
} from "../../lib/mari-permissions-write-chain";
import {
  DEFAULT_MARI_PERMISSIONS_MODE,
  MARI_PERMISSIONS_MODE_LABELS,
  MARI_PERMISSIONS_MODES,
  type MariPermissionsMode,
} from "@marinara-engine/shared";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useChatStore } from "../../stores/chat.store";
import { useAgentStore } from "../../stores/agent.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import { WorkspaceApprovalCard, WorkspaceErrorEvent } from "./MariApprovalCards";
import { CommandResultPreview } from "../command-center/CommandResultPreview";
import { CommandCenterMedia } from "../command-center/CommandCenterMedia";
import type { RichCommandResult } from "../command-center/command-result-preview.types";
import {
  MariPanelSortSelect,
  compareMariPanelItems,
  type MemoryDraftState,
  type SkillDraftState,
} from "./MariPanelControls";

// The Skills and Memories panels are a management surface most sessions never
// open. Keeping them out of the eager chunk leaves room under the hard bundle
// budget for the work surface itself.
const ProfessorMariSkillsMenu = lazy(() =>
  import("./MariSkillsMenu").then((module) => ({ default: module.ProfessorMariSkillsMenu })),
);
const ProfessorMariMemoriesMenu = lazy(() =>
  import("./MariMemoriesMenu").then((module) => ({ default: module.ProfessorMariMemoriesMenu })),
);
import { TranscriptRow } from "./MariTranscriptRow";
import type { MariPromptRenderSide } from "./MariPromptPreviewModal";
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
import { useCodeBlockCopy } from "../../hooks/use-code-block-copy";
import { rafThrottle } from "../../lib/raf-throttle";
import { prepareImageAttachment } from "../../lib/chat-attachment-images";
import { cn } from "../../lib/utils";
import { executeStateNavigation } from "../../lib/state-navigation";
import { MacroTextarea } from "../ui/MacroTextarea";
import { MariSuggestionChips } from "./MariSuggestionChips";
import { MariNote, MariStrip } from "./mari-primitives";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import {
  consumeProfessorMariOpenRequest,
  PROFESSOR_MARI_OPEN_EVENT,
  type ProfessorMariOpenDetail,
} from "../../lib/professor-mari-open";

const MARI_AVATAR_URL = "/sprites/mari/Mari_profile.png";
const MARI_CHIBI_URL = "/sprites/mari/chibi-professor-mari.png";
const PROFESSOR_MARI_BOOTSTRAP_ERROR_TOAST_ID = "professor-mari-bootstrap-error";
const PROFESSOR_MARI_DRAFT_KEY = "__home_professor_mari__";
const MARI_CONNECTION_STORAGE_KEY = "marinara:home-professor-mari-connection-id";
const PROFESSOR_MARI_ERROR_TOAST_DURATION_MS = 120_000;
const WORKSPACE_SETTLE_POLL_MS = 1_500;
const WORKSPACE_SETTLE_MAX_WAIT_MS = 30 * 60_000;
const WORKSPACE_SETTLE_REQUEST_TIMEOUT_MS = 10_000;

// After the SSE stream detaches on tab resume, the run keeps going server-side.
// Poll the workspace status until it is no longer active so the caller reloads
// the fully persisted reply and approvals rather than a half-written state.
class MariWorkspaceRunError extends Error {}

async function waitForWorkspaceRunToSettle(connectionId: string | null, signal: AbortSignal): Promise<boolean> {
  const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
  const startedAt = Date.now();
  let sawActiveRun = false;
  let inactiveReadings = 0;
  while (!signal.aborted && Date.now() - startedAt < WORKSPACE_SETTLE_MAX_WAIT_MS) {
    const pollController = new AbortController();
    const abortPoll = () => pollController.abort();
    const pollTimeout = window.setTimeout(abortPoll, WORKSPACE_SETTLE_REQUEST_TIMEOUT_MS);
    signal.addEventListener("abort", abortPoll, { once: true });
    try {
      const status = await api.get<MariWorkspaceStatus>(`/professor-mari/workspace/status${query}`, {
        signal: pollController.signal,
      });
      if (status.active) {
        sawActiveRun = true;
      } else if (sawActiveRun) {
        return true;
      } else {
        // The prompt route does storage work (connection resolution, message
        // persistence, history listing) BEFORE the run flips active, so one
        // early inactive reading is not proof the run never started — require
        // two, a poll apart, before concluding that.
        inactiveReadings += 1;
        if (inactiveReadings >= 2) return false;
      }
    } catch {
      // The resumed tab may still be restoring network access; keep polling.
    } finally {
      window.clearTimeout(pollTimeout);
      signal.removeEventListener("abort", abortPoll);
    }
    if (signal.aborted) return sawActiveRun;
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
  return sawActiveRun;
}
// One glyph per Permissions Mode, so the bar reads like an agent's mode switch at a glance.
const MARI_PERMISSIONS_MODE_ICONS: Record<MariPermissionsMode, LucideIcon> = {
  auto: Sparkles,
  manual: Hand,
  "accept-edits": FastForward,
  plan: ClipboardList,
  bypass: ShieldOff,
};

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
/**
 * R50: the panel slot. Beside the stream once there is room for both, and over
 * it below that - the same component either way, so there is no second layout to
 * keep in step.
 */
const MARI_PANEL_SLOT_CLASS =
  "absolute inset-0 z-10 h-full min-h-0 min-w-0 bg-[var(--card)] sm:relative sm:inset-auto sm:z-auto sm:h-full sm:w-[24rem] sm:min-w-[24rem] sm:shrink-0 sm:border-l sm:border-[var(--border)]/60 sm:bg-transparent";

const PROFESSOR_MARI_PANE_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] } as const;

type WorkspaceSkillMutationResponse = {
  ok: boolean;
  skill: MariWorkspaceSkillDetail;
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

/** The name every Mari chat is created with, before it earns a real one. */
const PROFESSOR_MARI_DEFAULT_CHAT_NAME = "Professor Mari";
const PROFESSOR_MARI_AUTO_TITLE_MAX = 48;

/**
 * A title taken from the first thing the user asked. No second model call: the
 * opening question is already the best short summary of the conversation, and a
 * history of ten chats all called "Professor Mari" cannot be searched at all.
 */
function buildProfessorMariAutoTitle(text: string): string {
  const line = text.replace(/\s+/gu, " ").trim();
  if (!line) return "";
  if (line.length <= PROFESSOR_MARI_AUTO_TITLE_MAX) return line;
  return `${line.slice(0, PROFESSOR_MARI_AUTO_TITLE_MAX - 1).trimEnd()}…`;
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

function createLocalUserMessage(
  chatId: string,
  content: string,
  attachments: ProfessorMariAttachment[] = [],
  context: ProfessorMariAskContext | null = null,
): Message {
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
      professorMariContext: context,
    },
  };
}

function getProfessorMariMessageContext(message: Message): ProfessorMariAskContext | null | undefined {
  const extra = toMessageExtra(message);
  if (!extra || typeof extra !== "object" || !("professorMariContext" in extra)) return undefined;
  return extra.professorMariContext ?? null;
}

function formatMariMessageTime(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function resolveContextCharacter(
  context: ProfessorMariAskContext | null | undefined,
  characters: ReadonlyMap<string, CharacterPreviewModel>,
  fallbackName: string,
): CharacterPreviewModel | null {
  if (context?.resource?.kind !== "character") return null;
  return (
    characters.get(context.resource.id) ?? {
      id: context.resource.id,
      name: context.resource.label ?? fallbackName,
      tags: [],
      lorebookCount: 0,
    }
  );
}

function resolveContextLorebook(
  context: ProfessorMariAskContext | null | undefined,
  lorebooks: ReadonlyMap<string, LorebookPreviewModel>,
  fallbackName: string,
): LorebookPreviewModel | null {
  if (context?.resource?.kind !== "lorebook") return null;
  return (
    lorebooks.get(context.resource.id) ?? {
      id: context.resource.id,
      name: context.resource.label ?? fallbackName,
      category: "uncategorized",
      isGlobal: false,
      enabled: true,
      linkedNames: [],
      tags: [],
    }
  );
}

function persistentResourceContext(
  context: ProfessorMariAskContext | null | undefined,
): ProfessorMariAskContext | null {
  if (!context?.resource || !isPersistentProfessorMariContext(context)) return null;
  return {
    source: context.source,
    capability: "explain",
    resource: context.resource,
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
  /** First time we saw this call. Preserved across upserts so a RUNNING step can tick live. */
  startedAt: number;
  /** Server-measured wall time of a finished call. Authoritative - it survives a reload. */
  durationMs?: number;
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

function isMariWorkspaceActionResult(value: unknown): value is MariWorkspaceActionResult {
  const result = asRecord(value);
  const resource = asRecord(result?.resource);
  return (
    (result?.status === "created" || result?.status === "updated") &&
    typeof result.summary === "string" &&
    !!resource &&
    ["character", "persona", "lorebook", "preset"].includes(String(resource.kind)) &&
    typeof resource.id === "string" &&
    resource.id.length > 0 &&
    Array.isArray(result.changedFields) &&
    result.changedFields.every((field) => typeof field === "string")
  );
}

function getMessageWorkspaceActionResults(message: Message): MariWorkspaceActionResult[] {
  const extra = toMessageExtra(message);
  const results = extra?.mariWorkspaceActionResults;
  return Array.isArray(results) ? results.filter(isMariWorkspaceActionResult) : [];
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
          // A replayed step never ticks, so it has no local anchor. Its duration comes from the
          // server-stamped pair; a trace written before those existed stays "—" rather than
          // showing a fabricated 1s.
          startedAt: 0,
          durationMs:
            item.tool.startedAt && item.tool.updatedAt
              ? Math.max(0, item.tool.updatedAt - item.tool.startedAt)
              : undefined,
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
        // The update carries its own timestamp; the first sighting is what dates the step.
        startedAt: item.tool.startedAt || update.startedAt,
        // A later event without a duration must not erase one we already have.
        durationMs: update.durationMs ?? item.tool.durationMs,
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
  const input = asRecord(tool.input);
  const appDataAction = typeof input?.action === "string" ? input.action : null;
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

  if (appDataAction && /app[ _-]?data/i.test(name)) {
    const actionTitles: Record<string, string> = {
      "chat.get": "Reading chat",
      "chat.messages": "Reading recent messages",
      "character.get": "Reading character",
      "instruction.get": "Reading instruction",
    };
    return {
      eyebrow: "App data",
      title: actionTitles[appDataAction] ?? `Reading ${appDataAction.replaceAll(".", " ")}`,
      detail: null,
      tone: "db",
    };
  }

  const skillPresentation = getSkillReadPresentation(tool);
  if (skillPresentation) return skillPresentation;

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
  const trimmed = content.trim();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const rendered = useMemo(
    () => (trimmed ? renderMarkdownBlocks(trimmed, renderCompactInline, "home-mari") : null),
    [trimmed],
  );
  useCodeBlockCopy(container, rendered);
  if (!trimmed) return null;
  return (
    <div
      ref={setContainer}
      className="mari-message-content text-[0.8125rem] leading-[1.42] text-[var(--foreground)] [&_.mari-md-codeblock]:my-1.5 [&_.mari-md-codeblock]:max-h-44 [&_.mari-md-codeblock]:pb-12! [&_.mari-md-heading]:mb-0.5 [&_.mari-md-heading]:mt-1 [&_.mari-md-ol]:my-1 [&_.mari-md-ul]:my-1"
    >
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

/**
 * R34: her transcript rows are labelled, not portraited. Repeating her face down
 * the left edge is what turns a mascot into a toy, and it competes with the one
 * sprite in the header that actually carries her state. The label mirrors the
 * "You" marker on user rows, so the two sides stay symmetric.
 */
function MariAvatar({
  active,
  messageTime,
  dateTime,
}: {
  active?: boolean;
  messageTime?: string | null;
  dateTime?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <span
      className={cn(
        "flex flex-col pt-0.5 text-[0.6875rem] font-semibold",
        active ? "text-[var(--primary)]" : "text-[var(--marinara-chat-chrome-panel-muted)]",
      )}
    >
      <span>{localizeUi("ui.chat.compactmarimessage.mari")}</span>
      {messageTime && dateTime ? (
        <time className="mari-transcript-marker-time" dateTime={dateTime}>
          {messageTime}
        </time>
      ) : null}
    </span>
  );
}

function MariReasoningPanel({ thinking, live, forceOpen }: { thinking: string; live?: boolean; forceOpen?: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const lineCount = Math.max(1, thinking.trim().split(/\n+/).length);
  return (
    <details
      open={forceOpen || live || undefined}
      className="mari-reasoning-panel group overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--muted)]/20 text-xs text-[var(--muted-foreground)]"
      data-live={live ? "true" : "false"}
    >
      <summary className="flex min-h-7 cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
        <Brain
          size="0.72rem"
          className={cn("shrink-0", live ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")}
        />
        <span className="text-[var(--foreground)]">{localizeUi("ui.chat.marireasoningpanel.reasoning")}</span>
        {live ? (
          <span className="mari-reasoning-panel__live" role="status">
            <i />
            <i />
            <i />
            <span>{localizeUi("ui.chat.marireasoningpanel.live")}</span>
          </span>
        ) : (
          <span className="rounded-md bg-[var(--background)]/70 px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.12em] opacity-75">
            {localizeUi("ui.chat.marireasoningpanel.value1LineValue2", {
              value1: lineCount,
              value2: lineCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
            })}
          </span>
        )}
        <span className="ml-auto text-[0.65rem] opacity-60 transition-transform group-open:rotate-90">›</span>
      </summary>
      <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words border-t border-[var(--border)]/50 px-2 py-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
        {thinking.trimEnd()}
      </pre>
    </details>
  );
}

/**
 * Ticks while the run is active. Anchored to the run's own start when the steps carry one, so
 * closing and reopening the omnibar mid-run resumes the count instead of restarting at zero.
 */
function useWorkspaceElapsedSeconds(active: boolean, startedAtMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  const mountedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      mountedAtRef.current = null;
      return;
    }
    mountedAtRef.current ??= Date.now();
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!active) return 0;
  const anchor = startedAtMs ?? mountedAtRef.current;
  return anchor ? Math.max(0, Math.floor((now - anchor) / 1_000)) : 0;
}

function WorkspaceLiveWorkCard({
  activity,
  items,
  character,
  lorebook,
  active = true,
  onStop,
}: {
  activity: string;
  items: WorkspaceTimelineItem[];
  character?: CharacterPreviewModel | null;
  lorebook?: LorebookPreviewModel | null;
  active?: boolean;
  onStop?: () => void;
}) {
  const { t } = useUiTranslation();
  const localizeUi = t;
  const reduceMotion = useReducedMotion();
  const disabledAnimationPacks = useUIStore((state) => state.disabledMariAnimationPacks);
  const toolItems = items.filter(
    (item): item is Extract<WorkspaceTimelineItem, { type: "tool" }> => item.type === "tool",
  );
  const liveElapsedSeconds = useWorkspaceElapsedSeconds(active, resolveRunStartMs(toolItems.map((i) => i.tool)));
  const visibleSteps = [...toolItems].sort((left, right) => left.tool.updatedAt - right.tool.updatedAt).slice(-4);
  const latestNarrative = [...items]
    .reverse()
    .find(
      (item): item is Extract<WorkspaceTimelineItem, { type: "text" | "thinking" | "status" }> =>
        item.type !== "tool" && Boolean(item.content.trim()),
    );
  const runningTool = [...toolItems].reverse().find(({ tool }) => tool.status === "running");
  const currentTool = runningTool ?? toolItems.at(-1);
  const workTitle = currentTool ? inferToolPresentation(currentTool.tool).title : activity;
  const completedToolCount = toolItems.filter(({ tool }) => tool.status === "done").length;
  const workSummary = currentTool
    ? localizeUi("ui.chat.homeprofessormarichat.workSummaryValue1", {
        value1: inferToolPresentation(currentTool.tool).title,
        count: completedToolCount,
      })
    : items.length > 0
      ? localizeUi("ui.chat.homeprofessormarichat.recentWorkspaceUpdates", { count: items.length })
      : localizeUi("ui.chat.homeprofessormarichat.preparingWorkspace");
  const workAnimation = selectMariWorkAnimation({
    seed: items[0]?.id ?? activity,
    activity: latestNarrative?.content ?? currentTool?.tool.name ?? activity,
    toolNames: currentTool ? [currentTool.tool.name] : [],
    disabledPacks: disabledAnimationPacks,
  });
  const elapsedSeconds = active ? liveElapsedSeconds : resolveRunSeconds(toolItems.map((i) => i.tool));
  // A finished run that still holds a failed step is not a success, whatever the last step was.
  const failed = !active && toolItems.some(({ tool }) => tool.status === "error");

  return (
    <TranscriptRow marker={null} layout="document">
      <motion.section
        className="mari-live-work"
        data-active={active ? "true" : "false"}
        data-outcome={failed ? "failed" : undefined}
        aria-label={t("mari.workCard.label")}
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mari-live-work__body">
          <div className="mari-live-work__scene" aria-hidden="true">
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={workAnimation.id}
                className="mari-live-work__sprite"
                data-scene={workAnimation.id}
                style={{ "--mari-work-sprite": `url(${workAnimation.src})` } as CSSProperties}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96, y: -2 }}
                transition={{ duration: reduceMotion ? 0 : 0.24 }}
              />
            </AnimatePresence>
          </div>
          <div className="mari-live-work__content">
            <div className="mari-live-work__heading">
              {active ? (
                <span className="mari-live-work__activity" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              ) : failed ? (
                <AlertTriangle size="0.875rem" className="mari-live-work__failed-icon" aria-hidden="true" />
              ) : (
                <Check size="0.875rem" className="mari-live-work__complete-icon" aria-hidden="true" />
              )}
              <h3>{workTitle}</h3>
            </div>
            <p className="mari-live-work__summary">{workSummary}</p>
            <div className="mari-live-work__controls">
              <span className="mari-live-work__elapsed">
                {active ? <i aria-hidden="true" /> : null}
                {t("mari.workCard.elapsed", { seconds: elapsedSeconds })}
              </span>
              {active && onStop ? (
                <button type="button" onClick={onStop} className="mari-live-work__stop">
                  <Square size="0.7rem" aria-hidden="true" />
                  {localizeUi("ui.chat.summarypopover.stop")}
                </button>
              ) : null}
            </div>

            {visibleSteps.length > 0 ? (
              <ol className="mari-live-work__steps" aria-label={t("mari.workCard.progress")}>
                <AnimatePresence initial={false} mode="popLayout">
                  {visibleSteps.map(({ id, tool }) => {
                    const presentation = inferToolPresentation(tool);
                    const running = tool.status === "running";
                    const stepFailed = tool.status === "error";
                    const Icon = stepFailed ? AlertTriangle : running ? Circle : Check;
                    const stepSeconds = resolveStepSeconds({
                      running,
                      startedAt: tool.startedAt,
                      durationMs: tool.durationMs,
                      updatedAt: tool.updatedAt,
                      now: Date.now(),
                    });
                    return (
                      <motion.li
                        layout={!reduceMotion}
                        key={`${id}:${tool.status}`}
                        data-status={tool.status}
                        initial={reduceMotion ? false : { opacity: 0, x: -8, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: "auto" }}
                        exit={reduceMotion ? undefined : { opacity: 0, x: 6, height: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <details className="mari-live-work__step-details group">
                          <summary>
                            <Icon size="0.75rem" className="mari-live-work__step-icon shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">{presentation.title}</span>
                            <span className="mari-live-work__step-duration">
                              {stepSeconds === null ? "—" : t("mari.workCard.stepSeconds", { seconds: stepSeconds })}
                            </span>
                            <ChevronRight
                              size="0.7rem"
                              className="mari-live-work__step-chevron shrink-0"
                              aria-hidden="true"
                            />
                          </summary>
                          <div className="mari-live-work__step-details-body">
                            <div className="mari-live-work__step-details-label">
                              <Terminal size="0.7rem" aria-hidden="true" />
                              {t("mari.workCard.technicalDetails")}
                            </div>
                            <code>{formatToolName(tool.name)}</code>
                            {tool.input !== undefined ? <pre>{previewValue(tool.input, 240)}</pre> : null}
                            {tool.output !== null && tool.output !== undefined ? (
                              <pre>{previewValue(tool.output, 320)}</pre>
                            ) : null}
                          </div>
                        </details>
                      </motion.li>
                    );
                  })}
                  {toolItems.length > visibleSteps.length ? (
                    <motion.li
                      key="earlier-steps"
                      data-status="earlier"
                      layout={!reduceMotion}
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {t("mari.workCard.earlierSteps", { count: toolItems.length - visibleSteps.length })}
                      </span>
                    </motion.li>
                  ) : null}
                </AnimatePresence>
              </ol>
            ) : null}

            <MariResourceSubject
              character={character}
              lorebook={lorebook}
              compact={false}
              className="mari-live-work__subject"
            />

            {toolItems.length > 0 ? (
              <p className="mari-live-work__technical-count">
                {t("mari.workCard.completedSteps", { count: completedToolCount })}
              </p>
            ) : null}
          </div>
        </div>
      </motion.section>
    </TranscriptRow>
  );
}

const MARI_MESSAGE_ACTIONS_CLASS =
  "mt-1 flex gap-1.5 opacity-100 transition-opacity [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100";
const MARI_MESSAGE_ACTION_BUTTON_CLASS =
  "rounded p-1 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:text-[var(--primary)]";

function MariWorkspaceActionResultRow({
  result,
  onOpen,
  onReview,
  character,
  lorebook,
  compact = false,
}: {
  result: MariWorkspaceActionResult;
  onOpen: (result: MariWorkspaceActionResult) => void;
  onReview: (reviewId: string) => void;
  character?: CharacterPreviewModel | null;
  lorebook?: LorebookPreviewModel | null;
  compact?: boolean;
}) {
  const { t } = useUiTranslation();
  const localizeUi = t;
  const characterPreview =
    result.resource.kind === "character" && character?.id === result.resource.id ? character : null;
  const lorebookPreview = result.resource.kind === "lorebook" && lorebook?.id === result.resource.id ? lorebook : null;
  const description = characterPreview?.description ?? lorebookPreview?.description;
  const statusLabel =
    result.status === "created"
      ? localizeUi("ui.chat.homeprofessormarichat.createdResource")
      : localizeUi("ui.chat.homeprofessormarichat.updatedResource");
  const previewResult: RichCommandResult = {
    command: {
      id: `mari-result:${result.resource.kind}:${result.resource.id}`,
      title: result.resource.label || result.summary,
      kind: "resource",
      icon:
        result.resource.kind === "character"
          ? "character"
          : result.resource.kind === "lorebook"
            ? "lorebook"
            : result.resource.kind === "persona"
              ? "persona"
              : "preset",
    },
    score: 0,
    preview: {
      kind: result.resource.kind,
      title: result.resource.label || result.summary,
      eyebrow: statusLabel,
      description,
      media:
        characterPreview?.avatarSrc || lorebookPreview?.imageSrc
          ? {
              src: characterPreview?.avatarSrc ?? lorebookPreview?.imageSrc ?? "",
              alt:
                characterPreview?.name ??
                lorebookPreview?.name ??
                result.resource.label ??
                result.summary ??
                statusLabel,
              kind: characterPreview ? "avatar" : "image",
              avatarCropStyle: characterPreview?.avatarCropStyle,
            }
          : undefined,
      tags: characterPreview?.tags ?? lorebookPreview?.tags,
      supportingInfo:
        result.changedFields.length > 0
          ? localizeUi("ui.chat.homeprofessormarichat.changedFields", {
              fields: result.changedFields.join(", "),
            })
          : result.summary,
    },
  };
  return (
    <CommandResultPreview
      result={previewResult}
      variant={compact ? "compact" : "inline"}
      className={cn(
        "mari-workspace-artifact mari-workspace-artifact--complete mt-3",
        compact && "mari-workspace-artifact--compact",
      )}
      actions={[
        ...(result.reviewId
          ? [
              {
                label: localizeUi("ui.chat.homeprofessormarichat.reviewResult"),
                onSelect: () => onReview(result.reviewId!),
              },
            ]
          : []),
        {
          label: localizeUi("ui.chat.homeprofessormarichat.openResult"),
          onSelect: () => onOpen(result),
        },
      ]}
    />
  );
}

function MariResourceSubject({
  character,
  lorebook,
  compact = true,
  className,
}: {
  character?: CharacterPreviewModel | null;
  lorebook?: LorebookPreviewModel | null;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useUiTranslation();
  if (character) {
    return (
      <CharacterSubject
        character={character}
        label={t("ui.chat.homeprofessormarichat.aboutCharacter")}
        compact={compact}
        className={cn("w-fit max-w-full border-0 bg-[var(--primary)]/6", className)}
      />
    );
  }
  if (lorebook) {
    return (
      <LorebookSubject
        lorebook={lorebook}
        label={t("ui.chat.homeprofessormarichat.aboutLorebook")}
        compact={compact}
        className={cn("w-fit max-w-full border-0 bg-[var(--primary)]/6", className)}
      />
    );
  }
  return null;
}

const CompactMariMessage = memo(function CompactMariMessage({
  message,
  thinking,
  onDelete,
  onEdit,
  onRegenerate,
  canRegenerate = false,
  onRemoveAttachment,
  onOpenActionResult,
  onReviewActionResult,
  characterSubject,
  lorebookSubject,
  characterPreviews,
  lorebookPreviews,
}: {
  message: Message;
  thinking?: string | null;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  canRegenerate?: boolean;
  onRemoveAttachment?: (messageId: string, attachmentIndex: number) => void;
  onOpenActionResult: (result: MariWorkspaceActionResult) => void;
  onReviewActionResult: (reviewId: string) => void;
  characterSubject?: CharacterPreviewModel | null;
  lorebookSubject?: LorebookPreviewModel | null;
  characterPreviews: ReadonlyMap<string, CharacterPreviewModel>;
  lorebookPreviews: ReadonlyMap<string, LorebookPreviewModel>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const content = message.content ?? "";
  const attachments = getProfessorMariAttachments(message);
  const actionResults = getMessageWorkspaceActionResults(message);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const messageTime = formatMariMessageTime(message.createdAt);

  if (message.role === "user") {
    const requestSubject = characterSubject;
    return (
      <TranscriptRow
        className="mari-user-request group"
        marker={
          requestSubject ? (
            <CommandCenterMedia
              size="row"
              role="row"
              icon={MessageCircle}
              src={requestSubject.avatarSrc}
              alt=""
              kind="avatar"
              avatarCropStyle={requestSubject.avatarCropStyle}
              className="size-8"
            />
          ) : (
            <span className="mari-user-request__fallback">
              {localizeUi("ui.chat.compactmarimessage.you").slice(0, 1)}
            </span>
          )
        }
      >
        <p className="mari-message-byline">
          <strong>{requestSubject?.name ?? localizeUi("ui.chat.compactmarimessage.you")}</strong>
          {messageTime ? <time dateTime={message.createdAt}>{messageTime}</time> : null}
        </p>
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
    const traceItems = timelineItemsFromTrace(workspaceTrace, message);
    const traceActivity =
      [...traceItems]
        .reverse()
        .find((item): item is Extract<WorkspaceTimelineItem, { type: "text" | "status" }> =>
          ["text", "status"].includes(item.type),
        )?.content ?? localizeUi("ui.chat.homeprofessormarichat.readyToHelp");
    return (
      <div className="group space-y-2">
        <WorkspaceLiveWorkCard
          activity={stripProfessorMariSpeakerPrefix(traceActivity)}
          items={traceItems}
          character={characterSubject}
          lorebook={lorebookSubject}
          active={false}
        />
        <div className="ml-[2.625rem] min-w-0">
          {actionResults.map((result) => (
            <MariWorkspaceActionResultRow
              key={`${result.status}-${result.resource.kind}-${result.resource.id}`}
              result={result}
              onOpen={onOpenActionResult}
              onReview={onReviewActionResult}
              character={characterPreviews.get(result.resource.id)}
              lorebook={lorebookPreviews.get(result.resource.id)}
              compact
            />
          ))}
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
      </div>
    );
  }

  return (
    <>
      <TranscriptRow className="group" marker={<MariAvatar messageTime={messageTime} dateTime={message.createdAt} />}>
        <MariResourceSubject character={characterSubject} lorebook={lorebookSubject} className="mb-2" />
        <CompactMarkdown content={stripProfessorMariSpeakerPrefix(content)} />
        {actionResults.map((result) => (
          <MariWorkspaceActionResultRow
            key={`${result.status}-${result.resource.kind}-${result.resource.id}`}
            result={result}
            onOpen={onOpenActionResult}
            onReview={onReviewActionResult}
            character={characterPreviews.get(result.resource.id)}
            lorebook={lorebookPreviews.get(result.resource.id)}
            compact
          />
        ))}
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

type ProfessorMariRecovery = {
  text: string;
  attachments: ProfessorMariAttachment[];
  context: ProfessorMariAskContext | null;
  kind: "provider" | "tool" | "context" | "general";
};

function classifyProfessorMariFailure(error: unknown): ProfessorMariRecovery["kind"] {
  const kinds = new Set<ProfessorMariRecovery["kind"]>(["provider", "tool", "context", "general"]);
  const explicitKind = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const kind = (value as Record<string, unknown>).kind;
    return typeof kind === "string" && kinds.has(kind as ProfessorMariRecovery["kind"])
      ? (kind as ProfessorMariRecovery["kind"])
      : null;
  };
  const structuredKind = explicitKind(error) ?? (error instanceof ApiError ? explicitKind(error.payload) : null);
  if (structuredKind) return structuredKind;
  const message = getPrivilegedActionErrorMessage(error, "").toLowerCase();
  if (/context|token|prompt|too large|limit/.test(message)) return "context";
  if (/tool|sandbox|capability|permission|workspace|shell|file/.test(message)) return "tool";
  if (/connection|provider|model|api|network|timeout|timed out|remote/.test(message)) return "provider";
  return "general";
}

function ProfessorMariTrustStrip({
  connectionName,
  contextBudget,
  sandboxAvailable,
  pendingApprovalCount,
  onConnectionClick,
  onContextClick,
  onApprovalClick,
}: {
  connectionName: string | null;
  contextBudget: ProfessorMariContextBudget | null;
  sandboxAvailable: boolean | null;
  pendingApprovalCount: number;
  onConnectionClick: () => void;
  onContextClick: () => void;
  onApprovalClick: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const used = contextBudget ? formatCompactTokenCount(contextBudget.usedTokens) : "-";
  const maximum = contextBudget ? formatCompactTokenCount(contextBudget.maxTokens) : "-";
  return (
    <div
      data-component="HomeProfessorMariChat.TrustStrip"
      data-group="end"
      className="text-[0.625rem] text-[var(--muted-foreground)]"
    >
      <button
        type="button"
        onClick={onConnectionClick}
        className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--regular-label max-w-[12rem]"
        title={localizeUi("ui.chat.homeprofessormarichat.trustConnectionTitle")}
      >
        <Link size="0.65rem" className="shrink-0" />
        <span className="min-w-0 truncate">
          {connectionName ?? localizeUi("ui.chat.homeprofessormarichat.missingConnection")}
        </span>
      </button>
      {contextBudget ? (
        <button
          type="button"
          onClick={onContextClick}
          className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--regular-label tabular-nums"
          title={localizeUi("ui.chat.homeprofessormarichat.trustContextTitle")}
        >
          {localizeUi("ui.chat.homeprofessormarichat.contextBudgetValue", { used, maximum })}
        </button>
      ) : null}
      <span
        className={cn(
          "mari-chrome-control mari-chrome-control--compact mari-chrome-control--regular-label",
          sandboxAvailable === false && "text-[var(--destructive)]",
        )}
        title={localizeUi("ui.chat.homeprofessormarichat.trustSandboxTitle")}
        aria-label={
          sandboxAvailable === false
            ? localizeUi("ui.chat.homeprofessormarichat.sandboxUnavailable")
            : sandboxAvailable === null
              ? localizeUi("ui.chat.homeprofessormarichat.sandboxUnknown")
              : localizeUi("ui.chat.homeprofessormarichat.sandboxAvailable")
        }
      >
        {sandboxAvailable === false ? (
          localizeUi("ui.chat.homeprofessormarichat.sandboxUnavailable")
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              sandboxAvailable === null ? "bg-[var(--muted-foreground)]/50" : "bg-[var(--primary)]/70",
            )}
          />
        )}
      </span>
      {pendingApprovalCount > 0 ? (
        <button
          type="button"
          onClick={onApprovalClick}
          className="mari-chrome-control mari-chrome-control--compact font-semibold text-[var(--foreground)]"
          title={localizeUi("ui.chat.homeprofessormarichat.trustApprovalTitle")}
        >
          {localizeUi("ui.chat.homeprofessormarichat.pendingApprovals", { count: pendingApprovalCount })}
        </button>
      ) : null}
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

type HomeProfessorMariChatProps = {
  pageActive?: boolean;
  attachedFooter?: boolean;
  chatWindowOpen?: boolean;
  embeddedTab?: boolean;
  omnibarMode?: boolean;
  launchHidden?: boolean;
  initialAskContext?: ProfessorMariAskContext | null;
  /** Increments on every omnibar handoff that should send its query at once. */
  submitDraftRequest?: number;
  /** A past Mari conversation to open, handed in from the omnibar. */
  openChatId?: string | null;
  pendingReviewRequest?: number;
  omnibarHeaderSlot?: HTMLElement | null;
  onChatWindowOpenChange?: (open: boolean) => void;
  onChatWindowExitComplete?: () => void;
  onVisualStateChange?: (state: ProfessorMariVisualState, hasConversation: boolean, statusLabel: string) => void;
};

export function HomeProfessorMariChat({
  pageActive = true,
  attachedFooter = false,
  chatWindowOpen: controlledChatWindowOpen,
  embeddedTab = false,
  omnibarMode = false,
  launchHidden = false,
  initialAskContext = null,
  submitDraftRequest = 0,
  openChatId = null,
  pendingReviewRequest = 0,
  omnibarHeaderSlot = null,
  onChatWindowOpenChange,
  onChatWindowExitComplete,
  onVisualStateChange,
}: HomeProfessorMariChatProps) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
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
  // Ghost-text completion for the composer: the user's own names first, because
  // "tell me about cel|" almost always means one of their characters.
  const completionCharacters = useCharacters();
  const completionPersonas = usePersonas();
  const completionLorebooks = useLorebooks();
  const completionPresets = usePresets();
  const completionCandidates = useMemo(
    () => [
      // A character's display name lives inside its card data, not on the row —
      // reading `.name` here returned nothing, which is why characters never
      // completed.
      ...(completionCharacters.data ?? []).map((item) => {
        const record = item as Record<string, unknown>;
        return getCharacterDisplayIdentity({ data: record.data, comment: record.comment as string | null | undefined });
      }),
      ...[completionPersonas.data, completionLorebooks.data, completionPresets.data].flatMap((list) =>
        (list ?? []).map((item) => (item as { name?: string }).name ?? ""),
      ),
    ],
    [completionCharacters.data, completionLorebooks.data, completionPersonas.data, completionPresets.data],
  );
  const characterPreviewById = useMemo(() => {
    const previews = new Map<string, CharacterPreviewModel>();
    for (const item of completionCharacters.data ?? []) {
      const preview = buildCharacterPreviewModel(item);
      if (preview) previews.set(preview.id, preview);
    }
    return previews;
  }, [completionCharacters.data]);
  const lorebookPreviewById = useMemo(
    () =>
      new Map(
        (completionLorebooks.data ?? []).map((item) => {
          const preview = buildLorebookPreviewModel(item);
          return [preview.id, preview] as const;
        }),
      ),
    [completionLorebooks.data],
  );
  const draftSuffix = useMemo(() => completeInline(draft, completionCandidates), [completionCandidates, draft]);
  const acceptDraftCompletion = useCallback(() => {
    if (draftSuffix) setDraft((current) => current + draftSuffix);
  }, [draftSuffix, setDraft]);
  const [attachments, setAttachments] = useState<ProfessorMariAttachment[]>([]);
  const [composerScroll, setComposerScroll] = useState({ left: 0, top: 0 });
  const [handoffContext, setHandoffContext] = useState<ProfessorMariAskContext | null>(null);
  const characterFallbackName = t("omnibar.categories.character", "Character");
  const focusedCharacter = resolveContextCharacter(handoffContext, characterPreviewById, characterFallbackName);
  const lorebookFallbackName = t("omnibar.categories.lorebook", "Lorebook");
  const focusedLorebook = resolveContextLorebook(handoffContext, lorebookPreviewById, lorebookFallbackName);
  const [isReadingAttachments, setIsReadingAttachments] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(() => readStoredConnectionId());
  const [workspaceStatus, setWorkspaceStatus] = useState<MariWorkspaceStatus | null>(null);
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const [workspaceActivity, setWorkspaceActivity] = useState<string | null>(null);
  const [workspaceTimeline, setWorkspaceTimeline] = useState<WorkspaceTimelineItem[]>([]);
  const [workspaceReviewActionId, setWorkspaceReviewActionId] = useState<string | null>(null);
  const [workspaceDestination, setWorkspaceDestination] = useState<ProfessorMariWorkspaceDestination>("chat");
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const chatHistoryOpen = workspaceDestination === "chats";
  // R52: the slot is empty by default. A user who never opens a panel sees a
  // stream and a composer, and nothing else exists for them.
  const [chatHistory, setChatHistory] = useState<ProfessorMariChatSummary[]>([]);
  const [chatHistoryQuery, setChatHistoryQuery] = useState("");
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatHistorySelectionMode, setChatHistorySelectionMode] = useState(false);
  const [selectedChatHistoryIds, setSelectedChatHistoryIds] = useState<Set<string>>(new Set());
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const skillsMenuOpen = workspaceDestination === "skills";
  const [skills, setSkills] = useState<MariWorkspaceSkillDetail[]>([]);
  const [skillsDiagnostics, setSkillsDiagnostics] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsQuery, setSkillsQuery] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillDraftState>({ name: "", description: "", content: "" });
  const memoriesMenuOpen = workspaceDestination === "memories";
  const [memories, setMemories] = useState<MariInstructionDetail[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesSaving, setMemoriesSaving] = useState(false);
  const [memoriesQuery, setMemoriesQuery] = useState("");
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraftState>({ name: "", description: "", content: "" });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadedMessagesChatId, setLoadedMessagesChatId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [recovery, setRecovery] = useState<ProfessorMariRecovery | null>(null);
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);
  const [permissionsMenuOpen, setPermissionsMenuOpen] = useState(false);
  // #5740: keyed by messageId so expansion never carries over when a new
  // round's record replaces the old one under a different reply.
  const [expandedUnderstoodRequestMessageId, setExpandedUnderstoodRequestMessageId] = useState<string | null>(null);
  const permissionsModeWriteSeqRef = useRef(0);
  // Chat id of pending mode writes (null = none): polls hold mode fields only
  // for the chat the write targets, and count tracks overlapping writes.
  const permissionsModeWritePendingChatRef = useRef<string | null>(null);
  const permissionsModeWritePendingCountRef = useRef(0);

  const permissionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const permissionsMenuRef = useRef<HTMLDivElement | null>(null);
  const omnibarModeMenuRef = useRef<HTMLDivElement | null>(null);
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [contextViewerOpen, setContextViewerOpen] = useState(false);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [internalChatWindowOpen, setInternalChatWindowOpen] = useState(false);
  const [mobileFocusMode, setMobileFocusMode] = useState(false);
  const hasLoadedRef = useRef(false);
  const notifiedApprovalIdsRef = useRef<Set<string>>(new Set());
  const lastAutoOpenedApprovalKeyRef = useRef("");
  const activeChatIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  const messageLoadAbortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptScrollFrameRef = useRef<number | null>(null);
  const suggestionFocusFrameRef = useRef<number | null>(null);
  const transcriptFollowOutputRef = useRef(true);
  const connectionButtonRef = useRef<HTMLButtonElement>(null);
  const connectionMenuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
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
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const workspaceAbortRef = useRef<AbortController | null>(null);
  const workspaceRunIdRef = useRef(0);
  const pendingWorkspaceTextRef = useRef("");
  const handledWorkspaceRefreshIdsRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    if (controlledChatWindowOpen) focusComposer();
  }, [controlledChatWindowOpen, focusComposer]);

  useLayoutEffect(() => {
    resizeComposer(embeddedTextareaRef.current);
    resizeComposer(floatingTextareaRef.current);
  }, [draft, resizeComposer]);

  const hasActiveGeneration = useChatStore((state) => (chatId ? state.abortControllers.has(chatId) : false));
  const reduceMotion = useReducedMotion();
  // The omnibar already has a fixed shell. Destination animation makes its
  // contents appear to reload and moves the composer while switching tabs.
  const paneTransition = omnibarMode
    ? { duration: 0 }
    : reduceMotion
      ? { duration: 0 }
      : PROFESSOR_MARI_PANE_TRANSITION;
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
  const showContextUsage = useUIStore((state) => state.showContextUsage);

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
  const persistentContextCount = professorMariContextCount(attachedContext?.length ?? 0, handoffContext);
  const oneShotContext = handoffContext && !isPersistentProfessorMariContext(handoffContext) ? handoffContext : null;
  const contextBudget = useMemo(
    () => resolveProfessorMariContextBudget(messages, workspaceStatus?.connection?.maxContext),
    [messages, workspaceStatus?.connection?.maxContext],
  );
  const isBusy = sending || hasActiveGeneration || workspaceActive;
  useEffect(() => {
    messageMutationBusyRef.current = isBusy;
  }, [isBusy]);
  const canSubmitMessage = (draft.trim().length > 0 || attachments.length > 0) && !isReadingAttachments;
  const starterSuggestionsAvailable = shouldOfferProfessorMariStarterSuggestions({
    chatId,
    loadedMessagesChatId,
    messageCount: messages.length,
    busy: isBusy,
  });
  // #5748: re-derive the Accept chip from the persisted deferral flag, because the
  // shared chips slot is ephemeral and a reload or unrelated run clears it.
  const lastLoadedMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const lastLoadedMessageExtra =
    lastLoadedMessage && typeof lastLoadedMessage.extra === "object" ? lastLoadedMessage.extra : null;
  const pendingDeferredMutations =
    chatId !== null &&
    loadedMessagesChatId === chatId &&
    !isBusy &&
    lastLoadedMessage?.role === "assistant" &&
    lastLoadedMessageExtra?.mariDeferredMutations === true;
  const storeChipsForChat = mariChipsChatId === chatId ? mariChips : [];
  const visibleSuggestionChips =
    pendingDeferredMutations && !storeChipsForChat.some((chip) => chip.id === MARI_AUTHORIZATION_ACCEPT_CHIP.id)
      ? withHeldChangeDeclineChip([
          MARI_AUTHORIZATION_ACCEPT_CHIP,
          ...(professorMariSuggestionsEnabled ? storeChipsForChat : []),
        ])
      : storeChipsForChat.some((chip) => chip.id === "authorization-accept")
        ? withHeldChangeDeclineChip(
            storeChipsForChat.filter((chip) => professorMariSuggestionsEnabled || chip.id === "authorization-accept"),
          )
        : professorMariSuggestionsEnabled && storeChipsForChat.length > 0
          ? storeChipsForChat
          : professorMariSuggestionsEnabled && starterSuggestionsAvailable
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
  const chatHistorySortMode = useUIStore((state) => state.mariPanelSortMode);
  const setChatHistorySortMode = useUIStore((state) => state.setMariPanelSortMode);
  const displayedChatHistory = useMemo(() => {
    const normalizedQuery = chatHistoryQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? chatHistory.filter((item) => (item.name ?? "").toLowerCase().includes(normalizedQuery))
      : chatHistory;
    return [...filtered].sort((left, right) =>
      compareMariPanelItems(
        { name: left.name ?? "", createdAt: left.createdAt },
        { name: right.name ?? "", createdAt: right.createdAt },
        chatHistorySortMode,
      ),
    );
  }, [chatHistory, chatHistoryQuery, chatHistorySortMode]);
  const desktopChatWindowOpen = controlledChatWindowOpen ?? internalChatWindowOpen;
  const chatWindowOpen = desktopChatWindowOpen || mobileFocusMode;
  const setChatWindowOpen = useCallback(
    (open: boolean) => {
      setInternalChatWindowOpen(open);
      onChatWindowOpenChange?.(open);
    },
    [onChatWindowOpenChange],
  );

  const applyHandoff = useCallback(
    (handoff: ProfessorMariHandoff) => {
      if (handoff.draft !== undefined) setDraft(handoff.draft);
      setHandoffContext(handoff.context ?? null);
      if (handoff.completion?.kind === "return-to-source") {
        setRecovery(null);
      }
      setChatWindowOpen(true);
      focusComposer();
    },
    [focusComposer, setChatWindowOpen, setDraft],
  );

  useEffect(() => {
    const destination = omnibarMode ? "omnibar" : "home";
    const pending = consumeProfessorMariOpenRequest(destination);
    if (pending) applyHandoff(pending);
    const handleOpen = (event: Event) => {
      const handoff = (event as CustomEvent<ProfessorMariOpenDetail>).detail;
      if ((handoff.destination ?? "home") !== destination) return;
      applyHandoff(consumeProfessorMariOpenRequest(destination) ?? handoff);
    };
    window.addEventListener(PROFESSOR_MARI_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(PROFESSOR_MARI_OPEN_EVENT, handleOpen);
  }, [applyHandoff, omnibarMode]);

  // Direct prop channel (e.g. the omnibar Mari pane) — avoids the global open
  // event so a co-mounted Home instance never steals the handoff context.
  useEffect(() => {
    if (initialAskContext) setHandoffContext(initialAskContext);
  }, [initialAskContext]);

  const loadMessages = useCallback(
    async (id: string, options: { restoreFocus?: boolean; shouldApply?: () => boolean } = {}) => {
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
        const normalizedMessages = items.map((message) => ({ ...message, extra: toMessageExtra(message) }));
        setMessages(normalizedMessages);
        let restoredContext: ProfessorMariAskContext | null = null;
        for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
          const messageContext = getProfessorMariMessageContext(normalizedMessages[index]!);
          if (messageContext === undefined) continue;
          restoredContext = messageContext;
          break;
        }
        if (options.restoreFocus !== false) setHandoffContext(persistentResourceContext(restoredContext));
        setLoadedMessagesChatId(id);
      } catch (error) {
        if (controller.signal.aborted) return;
        throw error;
      } finally {
        if (messageLoadAbortRef.current === controller) messageLoadAbortRef.current = null;
      }
    },
    [],
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
    if (hasLoadedSkillsRef.current && skills.length > 0) return;
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
  }, [skills.length]);

  const loadMemories = useCallback(async () => {
    if (hasLoadedMemoriesRef.current && memories.length > 0) return;
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
  }, [memories.length]);

  const ensureProfessorMariChat = useCallback(
    async (connectionId: string | null) => {
      const params = new URLSearchParams();
      if (connectionId) params.set("connectionId", connectionId);
      const query = params.toString();
      const chat = await api.get<Chat>(`/chats/internal/professor-mari${query ? `?${query}` : ""}`);
      setActiveChatId(chat.id);
      // The ensure/restart/activate writes in this file are deliberately
      // unguarded (#5641): each loads or switches to a Mari chat whose id is
      // unknown before the request, with no concurrent local metadata edits
      // to protect.
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
      // #5725: the server resolves the EFFECTIVE mode (chat override ?? global
      // default) for the chat we name here - so a response is only valid for
      // the chat that was active when the request STARTED.
      const chatIdAtStart = activeChatIdRef.current;
      const params = new URLSearchParams();
      if (effectiveConnectionId) params.set("connectionId", effectiveConnectionId);
      if (chatIdAtStart) params.set("chatId", chatIdAtStart);
      const query = params.toString();
      const writeSeqAtStart = permissionsModeWriteSeqRef.current;
      const status = await api.get<MariWorkspaceStatus>(`/professor-mari/workspace/status${query ? `?${query}` : ""}`);
      if (shouldApply?.() === false || activeChatIdRef.current !== chatIdAtStart) return status;
      // A mode write that landed while this poll was in flight is newer than
      // the polled value - keep the current mode fields, apply the rest.
      setWorkspaceStatus((current) =>
        current &&
        (permissionsModeWriteSeqRef.current !== writeSeqAtStart ||
          (permissionsModeWritePendingCountRef.current > 0 &&
            permissionsModeWritePendingChatRef.current === chatIdAtStart))
          ? {
              ...status,
              permissionsMode: current.permissionsMode,
              permissionsModeDefault: current.permissionsModeDefault,
              permissionsModeSource: current.permissionsModeSource,
            }
          : status,
      );
      return status;
    },
    [effectiveConnectionId],
  );

  const refreshApprovalSurfaces = useCallback(async () => {
    await refreshWorkspaceStatus().catch(() => undefined);
    // Refresh the Memories panel after a keep or restore: a kept memory has to show
    // up, and reverting a memory insert deletes the row, so the panel would keep
    // rendering a stale client-side entry.
    await loadMemories().catch(() => undefined);
  }, [loadMemories, refreshWorkspaceStatus]);

  // #5725: the status payload is CHAT-SCOPED (effective mode for the active
  // chat), so a chat switch must refetch it immediately - the 15s interval
  // alone leaves the shield showing the PREVIOUS chat's mode in exactly the
  // window where the user reads it and decides to send. The guard drops the
  // response if the user switched again while it was in flight.
  useEffect(() => {
    if (!chatId) return;
    const id = chatId;
    void refreshWorkspaceStatus(() => activeChatIdRef.current === id).catch(() => undefined);
  }, [chatId, refreshWorkspaceStatus]);

  const invalidateWorkspaceData = useCallback(async () => {
    // Invalidation marks every query stale either way; the default 'active'
    // refetch pulls only what is mounted now, and everything else refreshes on
    // its next mount. refetchType:'all' here made every cached chat re-drain
    // its full message page history on each Mari workspace change (#4703).
    await qc.invalidateQueries();
  }, [qc]);

  const invalidateActionResult = useCallback(
    async (result: MariWorkspaceActionResult) => {
      if (result.resource.kind === "character") {
        await Promise.all([
          qc.invalidateQueries({ queryKey: characterKeys.all }),
          qc.invalidateQueries({ queryKey: characterKeys.detail(result.resource.id) }),
        ]);
      } else if (result.resource.kind === "persona") {
        await Promise.all([
          qc.invalidateQueries({ queryKey: characterKeys.personas }),
          qc.invalidateQueries({ queryKey: characterKeys.personaDetail(result.resource.id) }),
        ]);
      } else if (result.resource.kind === "lorebook") {
        await qc.invalidateQueries({ queryKey: lorebookKeys.all });
      } else {
        await qc.invalidateQueries({ queryKey: presetKeys.all });
      }
    },
    [qc],
  );

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
        return loadMessages(chat.id, { restoreFocus: !initialAskContext });
      })
      .catch((error) => {
        console.error("[Professor Mari] Failed to load home assistant", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotLoad"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      })
      .finally(() => setLoadingHistory(false));
  }, [
    connectionOptions,
    connectionsLoading,
    ensureProfessorMariChat,
    initialAskContext,
    loadMessages,
    selectedConnectionId,
    localizeUi,
  ]);

  useEffect(() => {
    if (!pageActive) return;
    void refreshWorkspaceStatus().catch((error) => {
      setWorkspaceStatus((current) => current && { ...current, error: "Workspace status unavailable" });
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceToolsAreUnavailable"), {
        id: PROFESSOR_MARI_BOOTSTRAP_ERROR_TOAST_ID,
        description:
          error instanceof ApiError && (error.status === 401 || error.status === 403)
            ? localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceToolsNeedAdminAccess")
            : localizeUi("ui.chat.homeprofessormarichat.workspaceImportsAndChangesMayNotShowLiveProgress"),
        duration: 12_000,
      });
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

  // Recovery for runs this client is no longer attached to (#5719): if the
  // status poll watches a server-side run finish while no local send closure
  // is driving it — the stream died, or Mini-Mari was closed and reopened —
  // reload the persisted reply so it does not sit invisible until a manual
  // chat switch. Arming requires TWO status writes observing the run active
  // with no local closure (a single observation is routinely the STALE
  // active:true a local run's finally leaves behind for one render before
  // refreshAfterWorkspaceRun's own refresh lands — firing on that duplicated
  // the reload and the app-wide invalidation for every long local run), and
  // both the fire and the reload's shouldApply are pinned to the armed run id
  // so a new local send cancels the recovery instead of racing it. Deps use
  // the status OBJECT deliberately: each poll writes a fresh object, and the
  // observation count must advance on same-value active readings.
  const detachedRunArmingRef = useRef<{ observations: number; runId: number } | null>(null);
  useEffect(() => {
    const remoteActive = workspaceStatus?.active === true;
    if (remoteActive && !workspaceActive) {
      const runId = workspaceRunIdRef.current;
      const current = detachedRunArmingRef.current;
      detachedRunArmingRef.current =
        current && current.runId === runId
          ? { observations: current.observations + 1, runId }
          : { observations: 1, runId };
      return;
    }
    const armed = detachedRunArmingRef.current;
    detachedRunArmingRef.current = null;
    if (
      !remoteActive &&
      !workspaceActive &&
      armed &&
      armed.observations >= 2 &&
      armed.runId === workspaceRunIdRef.current
    ) {
      const chatIdToReload = activeChatIdRef.current;
      const armedRunId = armed.runId;
      if (chatIdToReload) {
        void loadMessages(chatIdToReload, {
          shouldApply: () => activeChatIdRef.current === chatIdToReload && workspaceRunIdRef.current === armedRunId,
        }).catch((error) => {
          console.error("[Professor Mari] Failed to reload messages after a detached workspace run", error);
        });
        void invalidateWorkspaceData();
      }
    }
  }, [workspaceStatus, workspaceActive, loadMessages, invalidateWorkspaceData]);

  useEffect(() => {
    void loadSkills().catch((error) => {
      console.error("[Professor Mari] Failed to load skills", error);
      setSkillsDiagnostics(["Professor Mari skills unavailable"]);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceToolsAreUnavailable"), {
        id: PROFESSOR_MARI_BOOTSTRAP_ERROR_TOAST_ID,
        description:
          error instanceof ApiError && (error.status === 401 || error.status === 403)
            ? localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceToolsNeedAdminAccess")
            : describeProfessorMariError(error),
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
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceToolsAreUnavailable"), {
        id: PROFESSOR_MARI_BOOTSTRAP_ERROR_TOAST_ID,
        description:
          error instanceof ApiError && (error.status === 401 || error.status === 403)
            ? localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceToolsNeedAdminAccess")
            : describeProfessorMariError(error),
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
  const visiblePendingChangeReviews = useMemo(
    () => (!sending && !workspaceTimelineActive ? pendingChangeReviews : []),
    [pendingChangeReviews, sending, workspaceTimelineActive],
  );
  const visiblePendingChangeReviewKey = visiblePendingChangeReviews.map((approval) => approval.id).join("|");
  const latestMessage = messages[messages.length - 1];
  const latestActionResults = useMemo(
    () => (latestMessage ? getMessageWorkspaceActionResults(latestMessage) : []),
    [latestMessage],
  );
  const mariPresentationState = resolveProfessorMariPresentationState({
    hasRecovery: Boolean(recovery),
    hasWorkspaceError: Boolean(workspaceStatus?.error),
    pendingReviewCount: visiblePendingChangeReviews.length,
    working: workspaceTimelineActive,
    hasDraft: Boolean(draft.trim()),
    attachmentCount: attachments.length,
    hasActionResult: latestActionResults.length > 0,
    messageCount: messages.length,
  });
  const mariVisualState = resolveProfessorMariVisualState({
    busy: isBusy,
    hasActionResult: latestActionResults.length > 0,
    hasAssistantReply: latestMessage?.role === "assistant",
    hasConversation: messages.length > 0,
    needsAttention: Boolean(recovery) || visiblePendingChangeReviews.length > 0,
  });
  const mariStatusLabel = workspaceTimelineActive
    ? focusedCharacter || focusedLorebook
      ? localizeUi("ui.chat.homeprofessormarichat.workingOnValue1", {
          value1: focusedCharacter?.name ?? focusedLorebook?.name ?? "",
        })
      : localizeUi("ui.chat.homeprofessormarichat.workingOnIt")
    : focusedCharacter
      ? localizeUi("ui.chat.homeprofessormarichat.aboutCharacterValue1", { value1: focusedCharacter.name })
      : focusedLorebook
        ? localizeUi("ui.chat.homeprofessormarichat.aboutLorebookValue1", { value1: focusedLorebook.name })
        : localizeUi("ui.chat.homeprofessormarichat.readyToHelp");

  useEffect(() => {
    if (!omnibarMode) return;
    onVisualStateChange?.(mariVisualState, messages.length > 0, mariStatusLabel);
  }, [mariStatusLabel, mariVisualState, messages.length, omnibarMode, onVisualStateChange]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !transcriptFollowOutputRef.current) return;
    scrollProfessorMariTranscriptToBottom(node);
  }, [messages, workspaceTimeline, workspaceActivity, visiblePendingChangeReviewKey, workspaceStatus?.error]);

  const handleTranscriptScroll = useCallback(() => {
    const node = scrollRef.current;
    if (node) transcriptFollowOutputRef.current = isProfessorMariTranscriptNearBottom(node);
  }, []);

  const displayMessages = messages;
  const showConnectionFirstHint = shouldShowProfessorMariConnectionHint({
    chatId,
    loadedMessagesChatId,
    sending,
    effectiveConnectionId,
  });

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

  useEffect(() => {
    if (!panelMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !headerMenuRef.current?.contains(event.target)) setPanelMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [panelMenuOpen]);

  useEffect(() => {
    if (!omnibarHeaderSlot) setPanelMenuOpen(false);
  }, [omnibarHeaderSlot]);

  useEffect(() => {
    if (!permissionsMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        permissionsButtonRef.current?.contains(target) ||
        permissionsMenuRef.current?.contains(target) ||
        omnibarModeMenuRef.current?.contains(target)
      )
        return;
      setPermissionsMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [permissionsMenuOpen]);

  // #5725: the server-authoritative Permissions Mode. Display rides the status
  // payload; writes go through the dedicated validated PUT. The change applies
  // to Mari's NEXT run - an in-flight turn is never aborted by a mode switch.
  const permissionsMode: MariPermissionsMode = workspaceStatus?.permissionsMode ?? DEFAULT_MARI_PERMISSIONS_MODE;
  const permissionsModeDefault: MariPermissionsMode =
    workspaceStatus?.permissionsModeDefault ?? DEFAULT_MARI_PERMISSIONS_MODE;
  const permissionsModeOverridden = workspaceStatus?.permissionsModeSource === "chat";
  // #5725 per-chat: the header picker writes THIS chat's override; null clears
  // it back to the global default (which Settings -> Application sets).
  const changePermissionsMode = useCallback(
    async (mode: MariPermissionsMode | null) => {
      setPermissionsMenuOpen(false);
      const chatIdForMode = activeChatIdRef.current;
      if (!chatIdForMode) return;
      const writeSeq = ++permissionsModeWriteSeqRef.current;
      // No same-value short-circuits: the check state can be stale for up to
      // one poll after a chat switch, and silently dropping the user's click
      // (especially a "Use default" de-escalation) is worse than sending an
      // idempotent write that converges via the refetch below.
      setWorkspaceStatus((current) =>
        current
          ? {
              ...current,
              permissionsMode: mode ?? current.permissionsModeDefault,
              permissionsModeSource: mode === null ? "default" : "chat",
            }
          : current,
      );
      permissionsModeWritePendingChatRef.current = chatIdForMode;
      permissionsModeWritePendingCountRef.current += 1;
      // Chained on the SHARED coordinator, not concurrent: rapid A-then-B
      // selections must persist in click order, and the chain also covers the
      // Settings panel's global-default writes.
      const write = enqueueMariPermissionsModeWrite(async () => {
        try {
          await api.put("/professor-mari/workspace/permissions-mode", { mode, chatId: chatIdForMode });
          // A status poll that was in flight during the PUT resolves with the
          // OLD mode and would clobber the optimistic patch - refetch so the
          // panel converges on the server value. Guarded: a chat switch or a
          // newer mode write while the refetch is in flight drops it.
          void refreshWorkspaceStatus(
            () => activeChatIdRef.current === chatIdForMode && permissionsModeWriteSeqRef.current === writeSeq,
          ).catch(() => undefined);
        } catch (error) {
          // Only the LATEST write may surface - a stale failure must not
          // clobber a newer selection that already succeeded. Refetch the
          // authoritative state rather than restoring a rendered snapshot
          // (which can itself be an optimistic value or another chat's).
          if (permissionsModeWriteSeqRef.current !== writeSeq) return;
          console.error("[Professor Mari] Failed to change permissions mode", error);
          toast.error(localizeUi("ui.chat.homeprofessormarichat.couldNotChangeThePermissionsMode"));
          void refreshWorkspaceStatus(
            () => activeChatIdRef.current === chatIdForMode && permissionsModeWriteSeqRef.current === writeSeq,
          ).catch(() => undefined);
        } finally {
          permissionsModeWritePendingCountRef.current -= 1;
          if (permissionsModeWritePendingCountRef.current <= 0) {
            permissionsModeWritePendingCountRef.current = 0;
            permissionsModeWritePendingChatRef.current = null;
          }
        }
      });
      await write;
    },
    [localizeUi, refreshWorkspaceStatus],
  );

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
    setConnectionMenuOpen(false);
    setWorkspaceDestination("chat");
    setMobileFocusMode(false);
    setChatWindowOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [setChatWindowOpen]);

  useDialogFocusScope(chatWindowOpen && mobileFocusMode && !embeddedTab, mobileDialogRef, floatingTextareaRef);

  const openChatWindow = useCallback(() => {
    setWorkspaceDestination("chat");
    setConnectionMenuOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (window.matchMedia("(max-width: 639px)").matches) {
      setMobileFocusMode(true);
      return;
    }
    setChatWindowOpen(true);
  }, [setChatWindowOpen]);

  const toggleSkillsMenu = useCallback(() => {
    const next = !skillsMenuOpen;
    if (next) {
      setConnectionMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setWorkspaceDestination(next ? "skills" : "chat");
  }, [skillsMenuOpen]);

  const toggleMemoriesMenu = useCallback(() => {
    const next = !memoriesMenuOpen;
    if (next) {
      setConnectionMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setWorkspaceDestination(next ? "memories" : "chat");
  }, [memoriesMenuOpen]);

  const toggleChatHistory = useCallback(() => {
    if (!chatHistoryOpen && isBusy) {
      toast.info(localizeUi("ui.chat.homeprofessormarichat.waitForProfessorMariToFinishBeforeSwitchingChats"));
      return;
    }
    const next = !chatHistoryOpen;
    if (next) {
      setConnectionMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setWorkspaceDestination(next ? "chats" : "chat");
  }, [chatHistoryOpen, isBusy, localizeUi]);

  useEffect(() => {
    window.addEventListener("marinara:home-professor-mari-close", closeChatWindow);
    return () => window.removeEventListener("marinara:home-professor-mari-close", closeChatWindow);
  }, [closeChatWindow]);

  // The omnibar can hand us a past conversation to open. The effect lives after
  // handleSelectProfessorChat so it can call it directly.
  const requestedChatIdRef = useRef<string | null>(null);

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
  // #5820: the Accept action for held edits is NOT a suggestion. Captioning
  // the row "Suggestions only" told users the one control that applies Mari's
  // pending changes was optional flavour text, so they concluded she had
  // silently done nothing - the visible half of the defer-and-approve
  // mechanism read as a failure of it.
  const chipRowAwaitsApproval = chipRowChips.some(isMariHeldChangeApprovalChip);
  const suggestionQuestion = guidedPlanStep
    ? guidedPlanStep.question
    : chipRowAwaitsApproval
      ? localizeUi("ui.chat.homeprofessormarichat.awaitingApprovalHint")
      : chipRowChips.length > 0
        ? messages.length === 0
          ? localizeUi("ui.chat.homeprofessormarichat.suggestions.start")
          : latestActionResults.length > 0
            ? localizeUi("ui.chat.homeprofessormarichat.suggestions.afterChange")
            : localizeUi("ui.chat.homeprofessormarichat.suggestions.next")
        : null;
  // Held changes stay answerable while the user types; ordinary suggestions step aside.
  const suggestionsSuppressed =
    !chipRowAwaitsApproval && !["empty", "history", "completed"].includes(mariPresentationState);
  const showSuggestionPrompt = !suggestionsSuppressed && Boolean(suggestionQuestion) && chipRowChips.length > 0;

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

  // Keep and restore live in a shared hook so the omnibar's approval rows do the
  // same thing, with the same toasts, as this pane.
  const {
    keepApproval: keepWorkspaceChange,
    restoreApproval: restoreWorkspaceChange,
    pendingId: sharedApprovalPendingId,
  } = useMariApprovals({ onRefresh: refreshApprovalSurfaces });
  // Single-row reject still runs from this component, so the busy state is the
  // union of both in-flight ids.
  const approvalBusyId = sharedApprovalPendingId ?? workspaceReviewActionId;

  // #4931: reject a single reviewed row (revert just that lorebook entry). Mirrors
  // restoreWorkspaceChange but posts the row's diffPreview index + identity tuple; the server reverts
  // only that row and either shrinks the pending card or resolves it.
  const rejectWorkspaceRows = useCallback(
    async (id: string, rows: Array<{ index: number; table: string; id: string; action: string }>): Promise<boolean> => {
      if (approvalBusyId) return false;
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
    [approvalBusyId, invalidateWorkspaceData, loadMemories, refreshWorkspaceStatus, localizeUi],
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
    clearMariChips();
    clearMariPlan();
    try {
      await api.post("/professor-mari/workspace/abort");
    } catch (error) {
      console.error("[Professor Mari] Failed to stop workspace task", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotStopTheWorkspaceTask"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    }
  }, [clearMariChips, clearMariPlan, localizeUi]);

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
        setWorkspaceDestination("skills");
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
        setWorkspaceDestination("memories");
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
        return false;
      }
      try {
        const chat = await api.post<Chat>(`/chats/internal/professor-mari/chats/${id}/activate`);
        setActiveChatId(chat.id);
        qc.setQueryData(chatKeys.detail(chat.id), chat);
        setWorkspaceDestination("chat");
        setWorkspaceTimeline([]);
        useChatStore.getState().clearStreamBuffer(chat.id);
        useChatStore.getState().clearThinkingBuffer(chat.id);
        await loadMessages(chat.id);
        await loadChatHistory();
        return true;
      } catch (error) {
        console.error("[Professor Mari] Failed to open previous chat", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotOpenThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
        return false;
      }
    },
    [isBusy, loadChatHistory, loadMessages, qc, setActiveChatId, localizeUi],
  );

  useEffect(() => {
    if (isBusy || !openChatId || openChatId === chatId || requestedChatIdRef.current === openChatId) return;
    requestedChatIdRef.current = openChatId;
    void handleSelectProfessorChat(openChatId).then((selected) => {
      if (!selected && requestedChatIdRef.current === openChatId) requestedChatIdRef.current = null;
    });
  }, [chatId, handleSelectProfessorChat, isBusy, openChatId]);

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
      context: ProfessorMariAskContext | null = handoffContext,
    ) => {
      // A mode change immediately before send must not race its PUTs: the run
      // resolves the mode server-side, so the WHOLE shared write chain - the
      // per-chat picker AND Settings' global default - lands first.
      await awaitMariPermissionsModeWrites();
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
      // Mirror use-generate's backgrounding bookkeeping: Android browsers tear
      // down a hidden tab's connection with a plain TypeError, and the shared
      // classifier needs to know the page was hidden to call that passive.
      let pageWasHiddenDuringStream = typeof document !== "undefined" && document.visibilityState !== "visible";
      const markPageHidden = () => {
        pageWasHiddenDuringStream = true;
      };
      const recordBackgroundedStream = () => {
        if (document.visibilityState !== "visible") markPageHidden();
      };
      const canTrackVisibility = typeof document !== "undefined" && typeof window !== "undefined";
      if (canTrackVisibility) {
        document.addEventListener("visibilitychange", recordBackgroundedStream);
        window.addEventListener("pagehide", markPageHidden);
      }
      try {
        for await (const event of api.streamEvents(
          "/professor-mari/workspace/prompt",
          {
            chatId: chat.id,
            message: text,
            connectionId: effectiveConnectionId,
            debugMode: useUIStore.getState().debugMode,
            attachments,
            context: context ?? undefined,
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
              startedAt: Date.now(),
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
              startedAt: Date.now(),
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
              startedAt: Date.now(),
              durationMs: typeof data?.durationMs === "number" ? data.durationMs : undefined,
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
          } else if (event.type === "metadata") {
            const data = asRecord(event.data);
            if (isMariWorkspaceActionResult(data?.actionResult)) {
              void invalidateActionResult(data.actionResult).catch((error) => {
                console.error("[Professor Mari] Failed to refresh action result", error);
              });
            }
          } else if (event.type === "done") {
            received = true;
          } else if (event.type === "error") {
            // The SERVER reported this over a live stream — the run itself
            // failed. It must never be mistaken for a transport death below.
            throw new MariWorkspaceRunError(
              typeof event.data === "string" ? event.data : "Workspace generation failed",
            );
          }
        }
        if (!received && !controller.signal.aborted) {
          // The stream closed CLEANLY before any reply event — mobile browsers
          // can shut a backgrounded socket down without an error while the
          // server keeps running (#5719). If the status endpoint confirms a
          // live run, this was a passive disconnect: wait it out and let the
          // caller reload the persisted reply instead of toasting "no reply".
          setWorkspaceActivity("Finishing in the background…");
          received = await waitForWorkspaceRunToSettle(effectiveConnectionId, controller.signal);
        }
      } catch (error) {
        if (error instanceof MariWorkspaceRunError) throw error;
        if (!isPassiveStreamDisconnect(error, pageWasHiddenDuringStream, controller.signal)) throw error;
        // Detached by backgrounding (the resume watchdog, or the browser
        // killing the hidden tab's socket outright), not a failure — the run
        // continues and persists server-side. Wait for it to actually settle
        // before reporting success, so handleSubmit reloads the finished
        // reply and approvals rather than a half-written state.
        setWorkspaceActivity("Finishing in the background…");
        await waitForWorkspaceRunToSettle(effectiveConnectionId, controller.signal);
        received = true;
      } finally {
        if (canTrackVisibility) {
          document.removeEventListener("visibilitychange", recordBackgroundedStream);
          window.removeEventListener("pagehide", markPageHidden);
        }
        workspaceTextThrottle.flush();
        workspaceAbortRef.current = null;
        setWorkspaceActive(false);
        setWorkspaceActivity(null);
        useChatStore.getState().setAbortController(chat.id, null);
        useChatStore.getState().setMariPhase(chat.id, "idle");
      }
      // hiddenDuringStream lets callers suppress the "no reply" toast when the
      // page's visibility history makes a false negative likely (the run may
      // have finished before the settle poll could observe it active) — the
      // authoritative reload either shows the persisted reply or the user
      // retries; a red toast beside a visible reply is worse than silence.
      return { received, runId, hiddenDuringStream: pageWasHiddenDuringStream };
    },
    [
      clearMariPlan,
      effectiveConnectionId,
      handoffContext,
      invalidateActionResult,
      setMariChips,
      setMariPlan,
      workspaceTextThrottle,
    ],
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
        const { received, runId, hiddenDuringStream } = await sendWorkspaceMessage(
          { id: chatId },
          userMessage.content,
          getProfessorMariAttachments(userMessage),
          userMessage.id,
          getProfessorMariMessageContext(userMessage) ?? null,
        );
        if (!received && !hiddenDuringStream) throw new Error("Professor Mari did not return a regenerated response");
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

  const handleSubmit = async (
    overrideText?: string,
    overrideRecovery?: Pick<ProfessorMariRecovery, "attachments" | "context">,
  ) => {
    const text = (overrideText ?? draft).trim();
    const submittedAttachments = overrideRecovery?.attachments ?? attachments;
    const submittedContext = overrideRecovery?.context ?? handoffContext;
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
      setHandoffContext(persistentResourceContext(submittedContext));
      setMessages((current) => [
        ...current,
        createLocalUserMessage(chat.id, messageText, submittedAttachments, submittedContext),
      ]);
      if (messagesRef.current.length === 0 && (chat.name ?? "") === PROFESSOR_MARI_DEFAULT_CHAT_NAME) {
        const autoTitle = buildProfessorMariAutoTitle(messageText);
        if (autoTitle) {
          // Best effort: a failed rename must never block the message.
          void api
            .patch(`/chats/internal/professor-mari/chats/${chat.id}`, { name: autoTitle })
            .then(() => loadChatHistory())
            .catch((error) => console.error("[Professor Mari] Failed to auto-title chat", error));
        }
      }
      trackAchievement.mutate("prof_mari_message_sent");
      const { received, runId, hiddenDuringStream } = await sendWorkspaceMessage(
        chat,
        messageText,
        submittedAttachments,
        undefined,
        submittedContext,
      );
      setRecovery(null);
      void refreshAfterWorkspaceRun(chat.id, runId);
      if (!received && !hiddenDuringStream) {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariDidNotReceiveAReplyFromThe"), {
          description: localizeUi("ui.chat.homeprofessormarichat.theModelOrServerMayStillBeBusyThis"),
          duration: PROFESSOR_MARI_ERROR_TOAST_DURATION_MS,
        });
      }
    } catch (error) {
      if (isProfessorMariAbortError(error)) return;
      setDraft(text);
      setAttachments(submittedAttachments);
      setHandoffContext(submittedContext);
      setRecovery({
        text: messageText,
        attachments: submittedAttachments,
        context: submittedContext,
        kind: classifyProfessorMariFailure(error),
      });
      console.error("[Professor Mari] Failed to send", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotAnswerRightNow"), {
        description: describeProfessorMariError(error),
        duration: PROFESSOR_MARI_ERROR_TOAST_DURATION_MS,
      });
    } finally {
      setSending(false);
    }
  };

  // Each handoff is one request id, sent once. The effect also depends on `draft`,
  // so a flag that stayed true would re-fire on every keystroke and send whatever
  // the user had typed so far; a flag that was already true would deliver no change
  // at all on the next handoff, and that query would silently never send.
  const handledSubmitRequestRef = useRef(0);
  useEffect(() => {
    if (!omnibarMode || !submitDraftRequest || handledSubmitRequestRef.current === submitDraftRequest) return;
    // Not marked handled yet: an empty or still-busy moment must retry, not drop it.
    if (!draft.trim() || isBusy) return;
    handledSubmitRequestRef.current = submitDraftRequest;
    void handleSubmit();
  }, [draft, handleSubmit, isBusy, omnibarMode, submitDraftRequest]);

  const handleSuggestionSelect = useCallback(
    (chip: MariSuggestionChip) => {
      if (chip.id === MARI_AUTHORIZATION_ACCEPT_CHIP.id || chip.id === MARI_AUTHORIZATION_DECLINE_CHIP.id) {
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
          setDraft((current) =>
            current.trim() ? `${current.trimEnd()} Create it - ${summary}` : `Create it - ${summary}`,
          );
          focusComposer();
        }
        return;
      }
      setDraft((current) => (current.trim() ? `${current.trimEnd()} ${chip.prompt}` : chip.prompt));
      focusComposer();
    },
    [clearMariPlan, focusComposer, guidedPlanStep, handleSubmit, recordMariPlanAnswer, setDraft],
  );

  const retryRecovery = () => {
    if (!recovery) return;
    setDraft(recovery.text);
    setAttachments(recovery.attachments);
    setHandoffContext(recovery.context);
    void handleSubmit(recovery.text, recovery);
  };

  const [requestedReviewId, setRequestedReviewId] = useState<string | null>(null);
  const openPendingApprovals = useCallback(() => {
    setRequestedReviewId(visiblePendingChangeReviews[0]?.id ?? null);
    setWorkspaceDestination("chat");
    void refreshWorkspaceStatus();
  }, [refreshWorkspaceStatus, visiblePendingChangeReviews]);

  const handledPendingReviewRequestRef = useRef(0);
  useEffect(() => {
    if (!chatWindowOpen || pendingReviewRequest <= handledPendingReviewRequestRef.current) return;
    handledPendingReviewRequestRef.current = pendingReviewRequest;
    openPendingApprovals();
  }, [chatWindowOpen, openPendingApprovals, pendingReviewRequest]);

  const pendingApprovalsPanel = visiblePendingChangeReviews.map((approval) => (
    <WorkspaceApprovalCard
      key={approval.id}
      approval={approval}
      busy={approvalBusyId === approval.id}
      disabled={approvalBusyId !== null}
      onKeep={(id) => void keepWorkspaceChange(id)}
      onKeepEnable={(id) => void keepWorkspaceChange(id, { enable: true })}
      onRestore={(id) => void restoreWorkspaceChange(id)}
      onRejectRows={(id, rows) => rejectWorkspaceRows(id, rows)}
      onRenderPrompt={renderWorkspacePrompt}
    />
  ));
  const headerDestinations = [
    { id: "chats", Icon: MessageCircle, label: localizeUi("navigation.common.chats"), count: 0 },
    {
      id: "skills",
      Icon: Brain,
      label: localizeUi("ui.chat.homeprofessormarichat.skills"),
      count: activeSkillCount,
    },
    {
      id: "memories",
      Icon: BookOpen,
      label: localizeUi("ui.chat.homeprofessormarichat.memories"),
      count: activeMemoryCount,
    },
    {
      id: "context",
      Icon: Database,
      label: localizeUi("ui.chat.homeprofessormarichat.contextControlLabel"),
      count: persistentContextCount,
    },
    {
      id: "details",
      Icon: FileText,
      label: localizeUi("ui.chat.homeprofessormarichat.detailsDestination"),
      count: latestActionResults.length + visiblePendingChangeReviews.length,
    },
  ] as const satisfies ReadonlyArray<{
    id: Exclude<ProfessorMariWorkspaceDestination, "chat">;
    Icon: typeof MessageCircle;
    label: string;
    count: number;
  }>;

  const selectHeaderDestination = (destination: Exclude<ProfessorMariWorkspaceDestination, "chat">) => {
    const desktopDetails =
      destination === "details" && typeof window !== "undefined" && window.matchMedia("(min-width: 64rem)").matches;
    setWorkspaceDestination(desktopDetails || workspaceDestination === destination ? "chat" : destination);
    setPanelMenuOpen(false);
  };

  const ActivePermissionsModeIcon = MARI_PERMISSIONS_MODE_ICONS[permissionsMode];
  const renderPermissionsModeRow = ({
    key,
    Icon,
    mode,
    label,
    description,
    selected,
    onSelect,
  }: {
    key: string;
    Icon: LucideIcon;
    mode?: MariPermissionsMode;
    label: string;
    description: string;
    selected: boolean;
    onSelect: () => void;
  }) => (
    <button
      key={key}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-mode={mode}
      className="mari-permissions-mode-row flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
    >
      <span className="mari-permissions-mode-row__icon mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md">
        <Icon size="0.8rem" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[0.6875rem] font-semibold text-[var(--foreground)]">{label}</span>
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">{description}</span>
      </span>
      <span className="mt-1 w-3.5 shrink-0 text-[var(--primary)]">
        {selected ? <Check size="0.8rem" aria-hidden="true" /> : null}
      </span>
    </button>
  );
  const permissionsModeOptions = (
    <>
      <div className="border-b border-[var(--border)] px-3 py-2 text-[0.6875rem] font-semibold text-[var(--foreground)]">
        {localizeUi("ui.chat.homeprofessormarichat.permissionsModeForThisChat")}
      </div>
      <div className="border-b border-[var(--border)]">
        {renderPermissionsModeRow({
          key: "default",
          Icon: RotateCcw,
          label: localizeUi("ui.chat.homeprofessormarichat.useDefaultMode", {
            value1: localize(MARI_PERMISSIONS_MODE_LABELS[permissionsModeDefault].label),
          }),
          description: localizeUi("ui.chat.homeprofessormarichat.followsTheGlobalDefaultFromSettings"),
          selected: !permissionsModeOverridden,
          onSelect: () => void changePermissionsMode(null),
        })}
      </div>
      {MARI_PERMISSIONS_MODES.map((mode) =>
        renderPermissionsModeRow({
          key: mode,
          Icon: MARI_PERMISSIONS_MODE_ICONS[mode],
          mode,
          label: localize(MARI_PERMISSIONS_MODE_LABELS[mode].label),
          description: localize(MARI_PERMISSIONS_MODE_LABELS[mode].description),
          selected: permissionsModeOverridden && mode === permissionsMode,
          onSelect: () => void changePermissionsMode(mode),
        }),
      )}
    </>
  );

  const omnibarHeaderChrome =
    omnibarMode && omnibarHeaderSlot
      ? createPortal(
          <div className="mari-omnibar-header-controls">
            <nav
              className="mari-omnibar-header-destinations"
              aria-label={localizeUi("ui.chat.homeprofessormarichat.workspaceDestinations")}
            >
              {headerDestinations.map(({ id, Icon, label, count }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={workspaceDestination === id}
                  onClick={() => selectHeaderDestination(id)}
                  disabled={id === "chats" && isBusy}
                  data-destination={id}
                  data-active={workspaceDestination === id ? "true" : "false"}
                >
                  <Icon size="0.8rem" aria-hidden="true" />
                  <span>{label}</span>
                  {count > 0 ? <b>{count}</b> : null}
                </button>
              ))}
            </nav>
            {workspaceTimelineActive ? (
              <button
                type="button"
                onClick={() => void stopWorkspace()}
                className="mari-omnibar-header-stop"
                aria-label={localizeUi("ui.chat.homeprofessormarichat.stopProfessorMariWorkspaceAgent")}
                title={localizeUi("ui.chat.homeprofessormarichat.stopProfessorMariWorkspaceAgent")}
              >
                <Square size="0.75rem" aria-hidden="true" />
              </button>
            ) : null}
            <div
              ref={omnibarModeMenuRef}
              className="mari-omnibar-mode"
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !permissionsMenuOpen) return;
                event.stopPropagation();
                setPermissionsMenuOpen(false);
                event.currentTarget.querySelector<HTMLButtonElement>(".mari-omnibar-mode__trigger")?.focus();
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setPanelMenuOpen(false);
                  setPermissionsMenuOpen((open) => !open);
                }}
                className="mari-omnibar-mode__trigger"
                data-mode={permissionsMode}
                aria-expanded={permissionsMenuOpen}
                aria-label={localizeUi("ui.chat.quickreplymenu.value1Value2", {
                  value1: localizeUi("ui.chat.homeprofessormarichat.permissionsMode"),
                  value2: localize(MARI_PERMISSIONS_MODE_LABELS[permissionsMode].label),
                })}
                title={localizeUi("ui.chat.homeprofessormarichat.permissionsMode")}
              >
                <ActivePermissionsModeIcon size="0.8rem" aria-hidden="true" />
                <span>{localize(MARI_PERMISSIONS_MODE_LABELS[permissionsMode].label)}</span>
              </button>
              {permissionsMenuOpen ? <div className="mari-omnibar-mode__menu">{permissionsModeOptions}</div> : null}
            </div>
            <button
              type="button"
              onClick={() => void runRestart()}
              disabled={isBusy}
              className="mari-omnibar-header-menu__trigger"
              aria-label={localizeUi("ui.chat.homeprofessormarichat.newChat")}
              title={t("home.professorMari.newChat")}
            >
              <Plus size="0.85rem" aria-hidden="true" />
            </button>
            <div
              ref={headerMenuRef}
              className="mari-omnibar-header-menu"
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.stopPropagation();
                setPanelMenuOpen(false);
                event.currentTarget.querySelector<HTMLButtonElement>(".mari-omnibar-header-menu__trigger")?.focus();
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setPermissionsMenuOpen(false);
                  setPanelMenuOpen((open) => !open);
                }}
                className="mari-omnibar-header-menu__trigger"
                aria-expanded={panelMenuOpen}
                aria-label={localizeUi("ui.chat.homeprofessormarichat.moreMariActions", "More Professor Mari actions")}
              >
                <EllipsisVertical size="0.9rem" aria-hidden="true" />
              </button>
              {panelMenuOpen ? (
                <div className="mari-omnibar-header-menu__popover">
                  <div className="mari-omnibar-header-menu__destinations">
                    {headerDestinations.map(({ id, Icon, label, count }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selectHeaderDestination(id)}
                        disabled={id === "chats" && isBusy}
                        aria-pressed={workspaceDestination === id}
                        data-destination={id}
                      >
                        <Icon size="0.875rem" aria-hidden="true" />
                        <span>{label}</span>
                        {count > 0 ? <b>{count}</b> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>,
          omnibarHeaderSlot,
        )
      : null;

  useEffect(() => {
    if (visiblePendingChangeReviewKey && visiblePendingChangeReviewKey !== lastAutoOpenedApprovalKeyRef.current) {
      lastAutoOpenedApprovalKeyRef.current = visiblePendingChangeReviewKey;
      setRequestedReviewId(visiblePendingChangeReviews[0]?.id ?? null);
      setWorkspaceDestination("chat");
    }
  }, [visiblePendingChangeReviewKey, visiblePendingChangeReviews]);

  const trustStrip = (
    <ProfessorMariTrustStrip
      connectionName={workspaceStatus?.connection?.name ?? effectiveConnection?.name ?? null}
      contextBudget={showContextUsage ? contextBudget : null}
      sandboxAvailable={workspaceStatus?.shellSandbox.available ?? null}
      pendingApprovalCount={visiblePendingChangeReviews.length}
      onConnectionClick={() => setConnectionMenuOpen(true)}
      onContextClick={() => {
        if (omnibarMode) setWorkspaceDestination("context");
        else void handleOpenContextViewer();
      }}
      onApprovalClick={openPendingApprovals}
    />
  );

  // R43: nothing touched your data, so this is a Note, not a bordered panel - and
  // Notes belong in the transcript, in order, rather than stacked over the composer.
  const recoveryNotice = recovery ? (
    <TranscriptRow marker={<MariAvatar />}>
      <MariNote tone="danger" role="alert">
        {localizeUi(`ui.chat.homeprofessormarichat.recovery.${recovery.kind}`)}{" "}
        <span className="text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.homeprofessormarichat.recoveryDescription")}
        </span>
      </MariNote>
      <button
        type="button"
        onClick={retryRecovery}
        disabled={isBusy}
        className="mari-chrome-control mari-chrome-control--compact mt-1.5"
      >
        <RefreshCw size="0.7rem" />
        {localizeUi("ui.chat.homeprofessormarichat.retry")}
      </button>
    </TranscriptRow>
  ) : null;

  const openActionResult = useCallback(
    async (result: MariWorkspaceActionResult) => {
      await invalidateActionResult(result).catch((error) => {
        console.error("[Professor Mari] Failed to refresh action result before opening", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariAppliedAWorkspaceChangeButAppData"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      });
      executeStateNavigation({
        kind: "resource",
        resource: result.resource.kind,
        id: result.resource.id,
      });
      if (omnibarMode) closeChatWindow();
    },
    [closeChatWindow, invalidateActionResult, localizeUi, omnibarMode],
  );

  const reviewActionResult = useCallback(
    async (reviewId: string) => {
      await refreshWorkspaceStatus().catch(() => undefined);
      setRequestedReviewId(reviewId);
      setWorkspaceDestination("chat");
    },
    [refreshWorkspaceStatus],
  );

  const detailsPanel = (
    <>
      <div className="shrink-0 border-b border-[var(--border)]/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <FileText size="0.9rem" className="text-[var(--primary)]" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-[var(--foreground)]">
              {localizeUi("ui.chat.homeprofessormarichat.detailsDestination")}
            </h3>
            <p className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.homeprofessormarichat.detailsDestinationHint")}
            </p>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-4">
          {visiblePendingChangeReviews.length > 0 ? (
            <section>
              <div className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                {localizeUi("commandCenter.completion.review")}
              </div>
              {pendingApprovalsPanel}
            </section>
          ) : null}
          {focusedCharacter || focusedLorebook ? (
            <section>
              <div className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.homeprofessormarichat.focusedResource")}
              </div>
              <MariResourceSubject
                character={focusedCharacter}
                lorebook={focusedLorebook}
                compact={false}
                className="w-full"
              />
            </section>
          ) : null}
          {latestActionResults.length > 0 ? (
            <section className="mari-completed-history">
              <div className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.homeprofessormarichat.completedResults")}
              </div>
              <div className="space-y-1.5">
                {latestActionResults.map((result) => (
                  <MariWorkspaceActionResultRow
                    key={`${result.status}-${result.resource.kind}-${result.resource.id}`}
                    result={result}
                    onOpen={openActionResult}
                    onReview={reviewActionResult}
                    character={characterPreviewById.get(result.resource.id)}
                    lorebook={lorebookPreviewById.get(result.resource.id)}
                    compact
                  />
                ))}
              </div>
            </section>
          ) : null}
          {!focusedCharacter &&
          !focusedLorebook &&
          latestActionResults.length === 0 &&
          visiblePendingChangeReviews.length === 0 ? (
            <div className="mari-details-empty rounded-xl border border-dashed border-[var(--mari-workspace-blush)]/30 bg-[var(--mari-workspace-blush)]/5 px-3 py-6 text-center">
              <Sparkles size="1rem" className="mx-auto mb-2 text-[var(--mari-workspace-blush)]" aria-hidden="true" />
              <p className="text-xs font-semibold text-[var(--foreground)]">
                {localizeUi("ui.chat.homeprofessormarichat.detailsEmptyTitle", "Nothing to review yet")}
              </p>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.homeprofessormarichat.detailsEmpty")}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  useEffect(() => {
    if (workspaceDestination !== "chat" || !requestedReviewId) return;
    window.requestAnimationFrame(() => {
      const review = document.getElementById(`mari-workspace-review-${requestedReviewId}`);
      if (!review) return;
      setRequestedReviewId(null);
      review.scrollIntoView({ block: "start" });
      review.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    });
  }, [requestedReviewId, visiblePendingChangeReviewKey, workspaceDestination]);

  const renderDisplayMessage = (message: Message) => {
    const canManageMessage = true;
    // #5740: under the reply the latest mutating round produced, show the
    // phrase Mari reported acting on - user-visible by default so people can
    // self-correct ("that wasn't a request!") before filing reports. One
    // record only (latest round). The server also reads the record back to
    // Mari as context, so asking her "why did you treat that as permission?"
    // gets an answer grounded in this same record - never a gate either way.
    const understoodRequest =
      message.role === "assistant" &&
      workspaceStatus?.latestUnderstoodRequest &&
      workspaceStatus.latestUnderstoodRequest.messageId === message.id
        ? workspaceStatus.latestUnderstoodRequest
        : null;
    const understoodRequestExpanded = understoodRequest !== null && expandedUnderstoodRequestMessageId === message.id;
    const understoodRequestOutcomeLabel = understoodRequest
      ? localizeUi(
          understoodRequest.outcome === "held"
            ? "ui.chat.homeprofessormarichat.heldForYourApproval"
            : understoodRequest.outcome === "applied"
              ? "ui.chat.homeprofessormarichat.actingOnOutcomeApplied"
              : understoodRequest.outcome === "failed"
                ? "ui.chat.homeprofessormarichat.actingOnOutcomeFailed"
                : "ui.chat.homeprofessormarichat.actingOnOutcomeInterrupted",
        )
      : null;
    const messageContext = getProfessorMariMessageContext(message);
    const messageCharacter = resolveContextCharacter(messageContext, characterPreviewById, characterFallbackName);
    const messageLorebook = resolveContextLorebook(messageContext, lorebookPreviewById, lorebookFallbackName);
    return (
      <div key={message.id}>
        <CompactMariMessage
          message={message}
          thinking={message.role === "assistant" ? getMessageThinking(message) : null}
          onDelete={canManageMessage && !isBusy ? handleDeleteMessage : undefined}
          onEdit={canManageMessage && !isBusy ? handleEditMessage : undefined}
          onRegenerate={canManageMessage ? handleRegenerateMessage : undefined}
          canRegenerate={canManageMessage && !isBusy && message.id === messages[messages.length - 1]?.id}
          onRemoveAttachment={canManageMessage && !isBusy ? handleRemoveAttachment : undefined}
          onOpenActionResult={openActionResult}
          onReviewActionResult={reviewActionResult}
          characterSubject={messageCharacter}
          lorebookSubject={messageLorebook}
          characterPreviews={characterPreviewById}
          lorebookPreviews={lorebookPreviewById}
        />
        {understoodRequest && (
          <button
            type="button"
            onClick={() =>
              setExpandedUnderstoodRequestMessageId((current) => (current === message.id ? null : message.id))
            }
            aria-expanded={understoodRequestExpanded}
            title={localizeUi(
              understoodRequestExpanded
                ? "ui.chat.homeprofessormarichat.actingOnCollapse"
                : "ui.chat.homeprofessormarichat.actingOnExpand",
            )}
            className="mt-1 flex w-full items-start gap-1.5 rounded-md px-2 py-1 text-left text-[0.6875rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            <Quote size="0.6875rem" className="mt-0.5 shrink-0 opacity-70" />
            {/* break-words: the phrase is model-authored and routinely carries
                unbreakable tokens (paths, URLs) that would otherwise force a
                horizontal scrollbar onto the whole transcript. */}
            <span
              className={understoodRequestExpanded ? "min-w-0 whitespace-pre-wrap break-words" : "min-w-0 truncate"}
            >
              {understoodRequest.text
                ? localizeUi("ui.chat.homeprofessormarichat.actingOnValue1", { value1: understoodRequest.text })
                : localizeUi("ui.chat.homeprofessormarichat.actingOnNothingReported")}
              {understoodRequestExpanded && (
                <span className="mt-0.5 block text-[0.625rem] opacity-80">
                  {understoodRequest.commands.join(", ")}
                  <span className="block">
                    {localizeUi("ui.chat.homeprofessormarichat.actingOnModeOutcomeValue1Value2", {
                      value1: localize(MARI_PERMISSIONS_MODE_LABELS[understoodRequest.permissionsMode].label),
                      value2: understoodRequestOutcomeLabel ?? "",
                    })}
                  </span>
                </span>
              )}
            </span>
          </button>
        )}
      </div>
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

  return (
    <>
      {attachModals}
      {omnibarHeaderChrome}
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
              ref={mobileDialogRef}
              key="professor-mari-window"
              data-component="HomeProfessorMariChat.Window"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={paneTransition}
              role={mobileFocusMode && !embeddedTab ? "dialog" : undefined}
              aria-modal={mobileFocusMode && !embeddedTab ? true : undefined}
              aria-label={mobileFocusMode && !embeddedTab ? localizeUi("ui.chat.homefaq.professorMari") : undefined}
              tabIndex={mobileFocusMode && !embeddedTab ? -1 : undefined}
              className={cn(
                "flex min-h-0 items-stretch justify-center",
                embeddedTab
                  ? "relative z-auto h-full w-full bg-transparent p-0"
                  : "fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)_+_3rem)] z-[80] bg-[var(--background)] pb-[var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:h-full sm:max-h-none sm:w-full sm:flex-1 sm:bg-transparent sm:p-0",
              )}
            >
              <div
                className={cn(
                  "flex h-full min-h-0 w-full flex-col",
                  embeddedTab ? "max-w-none" : "max-w-none sm:max-w-5xl",
                )}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  const hasDetail =
                    (workspaceDestination === "context" && Boolean(selectedContextId)) ||
                    (workspaceDestination === "skills" && Boolean(selectedSkillId)) ||
                    (workspaceDestination === "memories" && Boolean(selectedMemoryId));
                  const action = resolveProfessorMariWorkspaceBackAction(workspaceDestination, hasDetail);
                  if (action === "workspace") {
                    if (mobileFocusMode && !embeddedTab) {
                      event.stopPropagation();
                      closeChatWindow();
                    }
                    return;
                  }
                  event.stopPropagation();
                  if (action === "detail" && workspaceDestination === "context") {
                    setSelectedContextId(null);
                    return;
                  }
                  if (action === "detail" && workspaceDestination === "skills") {
                    setSelectedSkillId(null);
                    return;
                  }
                  if (action === "detail" && workspaceDestination === "memories") {
                    setSelectedMemoryId(null);
                    return;
                  }
                  setWorkspaceDestination("chat");
                }}
              >
                <div
                  data-mari-panel="open"
                  data-mari-state={mariPresentationState}
                  className="relative flex min-h-0 flex-1 flex-col sm:flex-row"
                >
                  <motion.div
                    key="professor-mari-chat"
                    transition={paneTransition}
                    className="h-full min-h-0 min-w-0 flex-1"
                  >
                    <div
                      className={cn(
                        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden border bg-[var(--background)]",
                        omnibarMode
                          ? "rounded-none border-0 bg-transparent shadow-none"
                          : embeddedTab
                            ? "rounded-2xl border-[color-mix(in_srgb,oklch(0.73_0.21_345)_28%,var(--border))] shadow-[0_24px_70px_-42px_oklch(0.73_0.21_345/0.8)]"
                            : "rounded-none border-0 sm:rounded-xl sm:border sm:border-[var(--border)]/70 sm:shadow-2xl",
                      )}
                    >
                      <div
                        className={cn(
                          "flex min-h-12 items-center justify-between gap-2 border-b border-[var(--border)]/60 px-2 pt-2 sm:px-3 sm:py-2",
                          omnibarMode ? "hidden" : "bg-[var(--card)]/80",
                        )}
                      >
                        {omnibarMode ? (
                          <div />
                        ) : (
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[oklch(0.73_0.21_345/0.4)] bg-[oklch(0.73_0.21_345/0.1)] text-[var(--primary)] shadow-[0_0_18px_oklch(0.73_0.21_345/0.18)]">
                              {workspaceTimelineActive ? (
                                <Sparkles size="0.9rem" aria-hidden="true" />
                              ) : (
                                <img src={MARI_AVATAR_URL} alt="" className="h-full w-full object-cover" />
                              )}
                            </span>
                            {/* At phone widths the header buttons crush this into "P. / R…" -
                                the avatar carries the identity VISUALLY there, so hide the
                                text but keep a screen-reader label (the avatar's alt is empty). */}
                            <span className="sr-only sm:hidden">{localizeUi("ui.chat.homefaq.professorMari")}</span>
                            <span className="hidden min-w-0 sm:block">
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
                        )}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={toggleChatHistory}
                            disabled={isBusy && !chatHistoryOpen}
                            className={cn(
                              "mari-chrome-control mari-chrome-control--compact",
                              "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                            )}
                            title={t("home.professorMari.openPreviousChats")}
                            aria-expanded={chatHistoryOpen}
                          >
                            <BookOpen size="0.75rem" />
                            <span>{localizeUi("navigation.common.chats")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={toggleSkillsMenu}
                            className={cn(
                              "mari-chrome-control mari-chrome-control--compact",
                              "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                            )}
                            title={localizeUi("ui.chat.homeprofessormarichat.openSkills")}
                            aria-expanded={skillsMenuOpen}
                          >
                            <ArrowDown size="0.75rem" />
                            <span>{localizeUi("ui.chat.homeprofessormarichat.skills")}</span>
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
                              "mari-chrome-control mari-chrome-control--compact",
                              "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                            )}
                            title={localizeUi("ui.chat.homeprofessormarichat.openMemories")}
                            aria-expanded={memoriesMenuOpen}
                          >
                            <Brain size="0.75rem" />
                            <span>{localizeUi("ui.chat.homeprofessormarichat.memories")}</span>
                            {memories.length > 0 && (
                              <span className="mari-chrome-muted-badge px-1.5 py-0.5 text-[0.56rem]">
                                {activeMemoryCount}
                              </span>
                            )}
                          </button>
                          <div className="relative">
                            <button
                              ref={permissionsButtonRef}
                              type="button"
                              onClick={() => {
                                setConnectionMenuOpen(false);
                                setPermissionsMenuOpen((current) => !current);
                              }}
                              className={cn(
                                "mari-chrome-control mari-chrome-control--compact",
                                "mari-chrome-accent-text-muted mari-accent-animated hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                              )}
                              title={localizeUi("ui.chat.homeprofessormarichat.permissionsMode")}
                              aria-expanded={permissionsMenuOpen}
                            >
                              <ActivePermissionsModeIcon size="0.75rem" />
                              <span className="max-[420px]:hidden">
                                {localize(MARI_PERMISSIONS_MODE_LABELS[permissionsMode].label)}
                              </span>
                            </button>
                            {permissionsMenuOpen && (
                              <div
                                ref={permissionsMenuRef}
                                className="absolute right-0 top-full z-20 mt-2 flex w-[19rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] text-left shadow-2xl"
                              >
                                {permissionsModeOptions}
                              </div>
                            )}
                          </div>
                          <ProfessorMariContextControl
                            context={handoffContext}
                            character={focusedCharacter}
                            lorebook={focusedLorebook}
                            attachedContextCount={attachedContext?.length ?? 0}
                            onOpen={() => {
                              setConnectionMenuOpen(false);
                            }}
                            onRemoveFocus={() => setHandoffContext(null)}
                            onViewAttachedContext={() => void handleOpenContextViewer()}
                          />
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
                          {visiblePendingChangeReviews.length > 0 ? (
                            <button
                              type="button"
                              onClick={openPendingApprovals}
                              className="mari-chrome-control mari-chrome-control--compact font-semibold"
                            >
                              <ShieldAlert size="0.75rem" />
                              <span>
                                {localizeUi("ui.chat.homeprofessormarichat.pendingApprovals", {
                                  count: visiblePendingChangeReviews.length,
                                })}
                              </span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void runRestart()}
                            disabled={isBusy}
                            className="mari-chrome-control mari-chrome-control--compact mari-chrome-accent-text-muted mari-accent-animated disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={localizeUi("ui.chat.homeprofessormarichat.newChat")}
                            title={t("home.professorMari.newChat")}
                          >
                            <Plus size="0.75rem" />
                            <span>{localizeUi("ui.chat.homeprofessormarichat.newChat")}</span>
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
                        data-mari-state={mariPresentationState}
                        className={cn(
                          "min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 pb-5 text-left sm:px-7",
                          omnibarMode
                            ? "mari-workspace-transcript bg-transparent"
                            : "bg-[radial-gradient(circle_at_12%_8%,oklch(0.79_0.16_205/0.06),transparent_26%),radial-gradient(circle_at_88%_12%,oklch(0.73_0.21_345/0.07),transparent_28%)]",
                        )}
                      >
                        {loadingHistory ? (
                          <LoadingHistoryState />
                        ) : (
                          <>
                            {displayMessages.map(renderDisplayMessage)}
                            {omnibarMode && messages.length === 0 && !isBusy && loadedMessagesChatId === chatId ? (
                              <div className="mari-omnibar-empty-welcome">
                                <div className="mari-omnibar-empty-welcome__eyebrow">
                                  <Sparkles size="0.8rem" aria-hidden="true" />
                                  {localizeUi("ui.chat.homeprofessormarichat.readyToHelp")}
                                </div>
                                <h3>{localizeUi("ui.chat.homeprofessormarichat.emptyWelcomeTitle")}</h3>
                                <p>{localizeUi("ui.chat.homeprofessormarichat.emptyWelcomeDescription")}</p>
                                <MariSuggestionChips
                                  chips={chipRowChips}
                                  onSelect={handleSuggestionSelect}
                                  disabled={isBusy}
                                />
                              </div>
                            ) : null}
                            {showConnectionFirstHint && (
                              <p className="px-3 py-1 text-center text-xs text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.homeprofessormarichat.selectAConnectionFirst")}
                              </p>
                            )}
                            {workspaceTimelineActive ? (
                              <WorkspaceLiveWorkCard
                                activity={workspaceActivity ?? localizeUi("ui.chat.homeprofessormarichat.workingOnIt")}
                                items={workspaceTimeline}
                                character={focusedCharacter}
                                lorebook={focusedLorebook}
                                onStop={() => void stopWorkspace()}
                              />
                            ) : null}
                            {recoveryNotice}
                            {workspaceStatus?.error && <WorkspaceErrorEvent message={workspaceStatus.error} />}
                            {visiblePendingChangeReviews.length > 0 ? (
                              <div className="space-y-3 lg:hidden">{pendingApprovalsPanel}</div>
                            ) : null}
                            {omnibarMode && messages.length > 0 && showSuggestionPrompt && suggestionQuestion ? (
                              <TranscriptRow marker={<MariAvatar active />} className="mari-suggestion-turn">
                                <div className="mari-suggestion-question-turn">
                                  <CompactMarkdown content={suggestionQuestion} />
                                </div>
                              </TranscriptRow>
                            ) : null}
                          </>
                        )}
                      </div>

                      <form
                        className={cn(
                          "border-t border-[var(--border)]/60 px-2.5 py-2.5",
                          omnibarMode && "mari-workspace-composer-dock px-3 py-3 sm:px-7",
                        )}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleSubmit();
                        }}
                      >
                        {showSuggestionPrompt && suggestionQuestion && (!omnibarMode || messages.length > 0) ? (
                          <div className="mari-workspace-question-dock mb-2">
                            {!omnibarMode ? (
                              <div className="mari-workspace-question-dock__prompt">
                                <Sparkles size="0.875rem" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                  <CompactMarkdown content={suggestionQuestion} />
                                </div>
                              </div>
                            ) : null}
                            <div className="mari-workspace-answer-strip">
                              <MariSuggestionChips
                                chips={chipRowChips}
                                onSelect={handleSuggestionSelect}
                                disabled={isBusy}
                              />
                            </div>
                          </div>
                        ) : null}
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
                        <div
                          className={cn(
                            "mari-professor-composer relative flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 shadow-inner shadow-black/10 focus-within:border-[var(--primary)]/50",
                            omnibarMode && "mari-workspace-composer rounded-xl shadow-none",
                          )}
                        >
                          <div className="mari-workspace-composer__attach">
                            <MariAttachButton
                              onAttachFiles={() => attachmentInputRef.current?.click()}
                              onAddChatHistory={() => void handleOpenHistoryPicker()}
                              onViewContext={() => void handleOpenContextViewer()}
                              attachedFileCount={attachments.length}
                              attachedContextCount={attachedContext?.length ?? 0}
                              disabled={isBusy || isReadingAttachments}
                              isReading={isReadingAttachments}
                            />
                          </div>

                          {oneShotContext ? (
                            <div className="mari-omnibar-context-attachment min-w-0">
                              <span className="mari-workspace-context-chip inline-flex min-w-0 max-w-[18rem] shrink items-center gap-1.5 rounded-md border border-[var(--primary)]/25 bg-[var(--primary)]/8 px-2 py-1 text-[0.6875rem] text-[var(--foreground)]">
                                <Sparkles size="0.7rem" className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
                                <span className="min-w-0 truncate">
                                  {oneShotContext.resource?.label
                                    ? oneShotContext.field
                                      ? localizeUi("ui.chat.homeprofessormarichat.resourceContextValue1Value2", {
                                          value1: oneShotContext.resource.label,
                                          value2: oneShotContext.field,
                                        })
                                      : oneShotContext.resource.label
                                    : oneShotContext.activeChat?.label
                                      ? oneShotContext.activeChat.label
                                      : oneShotContext.settingsLocation?.tab
                                        ? localizeUi("ui.chat.homeprofessormarichat.settingsContextValue1", {
                                            value1: oneShotContext.settingsLocation.tab,
                                          })
                                        : oneShotContext.query
                                          ? localizeUi("ui.chat.homeprofessormarichat.searchContextValue1", {
                                              value1: oneShotContext.query,
                                            })
                                          : localizeUi("ui.chat.homeprofessormarichat.contextControlLabel")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setHandoffContext(null)}
                                  className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
                                  aria-label={localizeUi("ui.chat.homeprofessormarichat.contextControlRemoveFocus")}
                                >
                                  <X size="0.7rem" aria-hidden="true" />
                                </button>
                              </span>
                            </div>
                          ) : null}

                          <button
                            ref={connectionButtonRef}
                            type="button"
                            onClick={() => setConnectionMenuOpen((current) => !current)}
                            className={cn(
                              "mari-workspace-composer__connection flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
                              effectiveConnection && "mari-workspace-composer__connection--active",
                              connectionMenuOpen
                                ? "bg-foreground/10 text-foreground/75"
                                : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
                            )}
                            aria-label={
                              effectiveConnection?.name
                                ? localizeUi("ui.chat.homeprofessormarichat.connectionValue1", {
                                    value1: effectiveConnection.name,
                                  })
                                : localizeUi("ui.chat.homeprofessormarichat.selectConnection")
                            }
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

                          <div className="relative flex min-w-0 flex-1">
                            <InlineGhostText
                              value={draft}
                              suffix={draftSuffix}
                              multiline
                              scrollLeft={composerScroll.left}
                              scrollTop={composerScroll.top}
                              className="px-1 py-1.5 text-sm leading-normal"
                            />
                            <textarea
                              ref={floatingTextareaRef}
                              value={draft}
                              onChange={(event) => {
                                setDraft(event.target.value);
                                if (mobileFocusMode) event.currentTarget.scrollIntoView({ block: "end" });
                              }}
                              onScroll={(event) =>
                                setComposerScroll({
                                  left: event.currentTarget.scrollLeft,
                                  top: event.currentTarget.scrollTop,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Tab" && !event.shiftKey && draftSuffix) {
                                  event.preventDefault();
                                  acceptDraftCompletion();
                                  return;
                                }
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
                              className="mari-chat-input-textarea min-h-8 max-h-32 w-full resize-none overflow-y-auto bg-transparent px-1 py-1.5 text-sm leading-normal text-foreground/90 outline-hidden placeholder:text-foreground/30 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={isBusy}
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={!canSubmitMessage || isBusy}
                            className={cn(
                              "mari-chat-send-btn mari-workspace-composer__send inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-lg text-white transition-all duration-200",
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
                  <AnimatePresence initial={false}>
                    {chatHistoryOpen ? (
                      <motion.div
                        key="professor-mari-chats"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={paneTransition}
                        className={MARI_PANEL_SLOT_CLASS}
                      >
                        <section className="flex h-full min-h-0 min-w-0 flex-col rounded-none border-0 bg-[var(--background)] sm:rounded-xl sm:border sm:border-[var(--border)]/70 sm:bg-[var(--background)] sm:shadow-2xl">
                          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-[var(--foreground)]">
                                {t("home.professorMari.chats")}
                              </div>
                              <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.homeprofessormarichat.newChatSavesTheCurrentChatHere")}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {/* #5752: the affordance people hunt for lives where they look for it. */}
                              <button
                                type="button"
                                onClick={() => {
                                  setWorkspaceDestination("chat");
                                  void runRestart();
                                }}
                                disabled={isBusy}
                                className="mari-chrome-control mari-chrome-control--small h-8 px-2 text-[0.625rem]"
                                title={t("home.professorMari.newChat")}
                              >
                                <Plus size="0.75rem" />
                                {localizeUi("ui.chat.homeprofessormarichat.newChat")}
                              </button>
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
                                onClick={() => setWorkspaceDestination("chat")}
                                className="mari-chrome-control mari-chrome-control--small h-8 w-8 p-0"
                                aria-label={t("home.professorMari.closeChats")}
                                title={t("home.professorMari.closeChats")}
                              >
                                <X size="0.85rem" />
                              </button>
                            </div>
                          </div>
                          {chatHistory.length > 0 ? (
                            <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--border)]/50 px-2.5 py-2">
                              <div className="relative min-w-0 flex-1">
                                <Search
                                  size="0.8rem"
                                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                                />
                                <input
                                  value={chatHistoryQuery}
                                  onChange={(event) => setChatHistoryQuery(event.target.value)}
                                  placeholder={localizeUi("ui.chat.homeprofessormarichat.searchChats")}
                                  aria-label={localizeUi("ui.chat.homeprofessormarichat.searchChats")}
                                  className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] pl-7 pr-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55"
                                />
                              </div>
                              <MariPanelSortSelect value={chatHistorySortMode} onChange={setChatHistorySortMode} />
                            </div>
                          ) : null}
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
                            ) : displayedChatHistory.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.homeprofessormarichat.noMatchingChats")}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {displayedChatHistory.map((item) => {
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
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={paneTransition}
                        className={MARI_PANEL_SLOT_CLASS}
                      >
                        <Suspense fallback={null}>
                          <ProfessorMariMemoriesMenu
                            memories={memories}
                            query={memoriesQuery}
                            selectedMemory={selectedMemory}
                            draft={memoryDraft}
                            loading={memoriesLoading}
                            saving={memoriesSaving}
                            fileInputRef={memoryFileInputRef}
                            onClose={() => setWorkspaceDestination("chat")}
                            onNew={handleNewMemory}
                            onUploadClick={handleMemoryUploadClick}
                            onFileChange={handleMemoryFileChange}
                            onSelect={setSelectedMemoryId}
                            onDraftChange={setMemoryDraft}
                            onSave={() => void handleSaveMemory()}
                            onDelete={(id) => void handleDeleteMemory(id)}
                            onToggleEnabled={handleToggleMemoryEnabled}
                            onTogglePersistent={handleToggleMemoryPersistent}
                            onQueryChange={setMemoriesQuery}
                            className="h-full rounded-none border-0 bg-[var(--background)] sm:rounded-xl sm:border sm:bg-[var(--background)] sm:shadow-2xl"
                          />
                        </Suspense>
                      </motion.div>
                    ) : skillsMenuOpen ? (
                      <motion.div
                        key="professor-mari-skills"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={paneTransition}
                        className={MARI_PANEL_SLOT_CLASS}
                      >
                        <Suspense fallback={null}>
                          <ProfessorMariSkillsMenu
                            skills={skills}
                            query={skillsQuery}
                            selectedSkill={selectedSkill}
                            draft={skillDraft}
                            loading={skillsLoading}
                            saving={skillsSaving}
                            diagnostics={skillsDiagnostics}
                            fileInputRef={skillFileInputRef}
                            onClose={() => setWorkspaceDestination("chat")}
                            onNew={handleNewSkill}
                            onUploadClick={handleSkillUploadClick}
                            onFileChange={handleSkillFileChange}
                            onSelect={setSelectedSkillId}
                            onDraftChange={setSkillDraft}
                            onSave={() => void handleSaveSkill()}
                            onDelete={(id) => void handleDeleteSkill(id)}
                            onToggle={(skill) => void handleToggleSkill(skill)}
                            onQueryChange={setSkillsQuery}
                            className="h-full rounded-none border-0 bg-[var(--background)] sm:rounded-xl sm:border sm:bg-[var(--background)] sm:shadow-2xl"
                          />
                        </Suspense>
                      </motion.div>
                    ) : workspaceDestination === "details" ? (
                      <motion.section
                        key="professor-mari-details"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={paneTransition}
                        className={cn(
                          MARI_PANEL_SLOT_CLASS,
                          "flex min-h-0 flex-col bg-[var(--background)]/45 lg:hidden",
                        )}
                      >
                        <div className="shrink-0 border-b border-[var(--border)]/60 px-3 py-3">
                          <div className="flex items-center gap-2">
                            <FileText size="0.9rem" className="text-[var(--primary)]" aria-hidden="true" />
                            <div className="min-w-0">
                              <h3 className="truncate text-xs font-semibold text-[var(--foreground)]">
                                {localizeUi("ui.chat.homeprofessormarichat.detailsDestination")}
                              </h3>
                              <p className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.homeprofessormarichat.detailsDestinationHint")}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
                          <div className="space-y-4">
                            {focusedCharacter || focusedLorebook ? (
                              <section>
                                <div className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                  {localizeUi("ui.chat.homeprofessormarichat.focusedResource")}
                                </div>
                                <MariResourceSubject
                                  character={focusedCharacter}
                                  lorebook={focusedLorebook}
                                  compact={false}
                                  className="w-full"
                                />
                              </section>
                            ) : null}
                            {latestActionResults.length > 0 ? (
                              <section>
                                <div className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                  {localizeUi("ui.chat.homeprofessormarichat.completedResults")}
                                </div>
                                {latestActionResults.map((result) => (
                                  <MariWorkspaceActionResultRow
                                    key={`${result.status}-${result.resource.kind}-${result.resource.id}`}
                                    result={result}
                                    onOpen={openActionResult}
                                    onReview={reviewActionResult}
                                    character={characterPreviewById.get(result.resource.id)}
                                    lorebook={lorebookPreviewById.get(result.resource.id)}
                                  />
                                ))}
                              </section>
                            ) : null}
                            {visiblePendingChangeReviews.length > 0 ? (
                              <section>
                                <div className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                  {localizeUi("commandCenter.completion.review")}
                                </div>
                                {pendingApprovalsPanel}
                              </section>
                            ) : null}
                            {!focusedCharacter &&
                            !focusedLorebook &&
                            latestActionResults.length === 0 &&
                            visiblePendingChangeReviews.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-8 text-center text-xs text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.homeprofessormarichat.detailsEmpty")}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </motion.section>
                    ) : workspaceDestination === "context" ? (
                      <motion.section
                        key="professor-mari-context"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={paneTransition}
                        className={cn(MARI_PANEL_SLOT_CLASS, "flex flex-col bg-[var(--background)]/45")}
                      >
                        <MariStrip className="shrink-0 border-b border-[var(--border)]/45 px-2 py-1.5">
                          {trustStrip}
                        </MariStrip>
                        <div className="flex items-center gap-2 border-b border-[var(--border)]/60 px-3 py-2.5">
                          {selectedContextId ? (
                            <button
                              type="button"
                              onClick={() => setSelectedContextId(null)}
                              className="mari-chrome-control mari-chrome-control--compact"
                              aria-label={localizeUi("ui.chat.homeprofessormarichat.contextBackToList")}
                            >
                              <ChevronRight size="0.8rem" className="rotate-180" />
                            </button>
                          ) : (
                            <Sparkles size="0.9rem" className="text-[var(--primary)]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-xs font-semibold text-[var(--foreground)]">
                              {selectedContextId
                                ? attachedContext?.find((item) => item.id === selectedContextId)?.label
                                : localizeUi("ui.chat.homeprofessormarichat.contextControlTitle")}
                            </h3>
                            <p className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                              {localizeUi("ui.chat.homeprofessormarichat.contextDestinationHint")}
                            </p>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
                          {selectedContextId ? (
                            (() => {
                              const selected = attachedContext?.find((item) => item.id === selectedContextId);
                              return selected ? (
                                <article className="mx-auto max-w-2xl">
                                  <div className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                                    <span>{selected.kind}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      {localizeUi("ui.chat.homeprofessormarichat.attachedTokenEstimate", {
                                        count: formatCompactTokenCount(selected.tokenEstimate),
                                      })}
                                    </span>
                                  </div>
                                  <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-[var(--border)]/70 bg-[var(--card)]/70 p-3 text-xs leading-relaxed text-[var(--foreground)]">
                                    {selected.content}
                                  </pre>
                                </article>
                              ) : null;
                            })()
                          ) : (
                            <div className="mx-auto max-w-2xl space-y-2">
                              {handoffContext ? (
                                <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/7 p-3">
                                  <div className="flex items-start gap-2">
                                    <Sparkles size="0.8rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
                                        {localizeUi("ui.chat.homeprofessormarichat.contextControlFocused")}
                                      </p>
                                      <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                                        {handoffContext.resource?.label ??
                                          handoffContext.resource?.kind ??
                                          handoffContext.source}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setHandoffContext(null)}
                                      className="mari-chrome-control mari-chrome-control--compact text-[var(--destructive)]"
                                    >
                                      <X size="0.75rem" />
                                      {localizeUi("ui.chat.homeprofessormarichat.contextControlRemoveFocus")}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {(attachedContext?.length ?? 0) === 0 ? (
                                <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">
                                  {localizeUi("ui.chat.homeprofessormarichat.contextViewerEmpty")}
                                </div>
                              ) : (
                                attachedContext?.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedContextId(item.id)}
                                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)]/70 bg-[var(--card)]/65 px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
                                  >
                                    <FileText size="0.85rem" className="shrink-0 text-[var(--mari-workspace-hoodie)]" />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-semibold text-[var(--foreground)]">
                                        {item.label}
                                      </span>
                                      <span className="mt-0.5 block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                        {localizeUi("ui.chat.homeprofessormarichat.attachedTokenEstimate", {
                                          count: formatCompactTokenCount(item.tokenEstimate),
                                        })}
                                      </span>
                                    </span>
                                    <ChevronRight size="0.8rem" className="text-[var(--muted-foreground)]" />
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </motion.section>
                    ) : null}
                  </AnimatePresence>
                  <aside
                    className={cn(
                      "hidden h-full min-h-0 w-96 min-w-96 shrink-0 flex-col border-l border-[var(--border)]/60 bg-[var(--background)]/45",
                      workspaceDestination === "chat" ? "lg:flex" : "lg:hidden",
                    )}
                  >
                    {detailsPanel}
                  </aside>
                </div>
              </div>
            </motion.div>
          </ProfessorMariMobilePortal>
        )}
      </AnimatePresence>
    </>
  );
}
