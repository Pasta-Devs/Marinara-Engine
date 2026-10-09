// Professor Mari's chat: constants, stored connection, attachments, message extras and failure kinds.
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, ClipboardList, FastForward, Hand, ShieldOff, type LucideIcon } from "lucide-react";
import {
  type Chat,
  type MariWorkspaceSkillDetail,
  type MariWorkspaceStatus,
  type Message,
  type ProfessorMariAskContext,
} from "@marinara-engine/shared";
import { type CharacterPreviewModel } from "../../../lib/character-preview";
import { type LorebookPreviewModel } from "../../../lib/lorebook-preview";
import { api, ApiError, getPrivilegedActionErrorMessage } from "../../../lib/api-client";
import { isPersistentProfessorMariContext } from "../../../lib/professor-mari-presentation";
import { type MariPermissionsMode } from "@marinara-engine/shared";

export const PROFESSOR_MARI_DRAFT_KEY = "__home_professor_mari__";
export const PROFESSOR_MARI_ERROR_TOAST_DURATION_MS = 120_000;
const WORKSPACE_SETTLE_POLL_MS = 1_500;
const WORKSPACE_SETTLE_MAX_WAIT_MS = 30 * 60_000;
const WORKSPACE_SETTLE_REQUEST_TIMEOUT_MS = 10_000;

// After the SSE stream detaches on tab resume, the run keeps going server-side.
// Poll the workspace status until it is no longer active so the caller reloads
// the fully persisted reply and approvals rather than a half-written state.
export class MariWorkspaceRunError extends Error {}

export async function waitForWorkspaceRunToSettle(connectionId: string | null, signal: AbortSignal): Promise<boolean> {
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
      // Drop the abort listener on a normal wake-up too, or each poll leaves one behind on the run's signal.
      const onAbort = () => {
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, WORKSPACE_SETTLE_POLL_MS);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  return sawActiveRun;
}
// One glyph per Permissions Mode, so the bar reads like an agent's mode switch at a glance.
export const MARI_PERMISSIONS_MODE_ICONS: Record<MariPermissionsMode, LucideIcon> = {
  auto: Sparkles,
  manual: Hand,
  "accept-edits": FastForward,
  plan: ClipboardList,
  bypass: ShieldOff,
};

/** R11: the short fact under each mode in the composer's mode menu (Settings keeps the long text). */
export const MARI_PERMISSIONS_MODE_FACT_KEYS: Record<MariPermissionsMode, string> = {
  auto: "ui.chat.homeprofessormarichat.modeFact.auto",
  manual: "ui.chat.homeprofessormarichat.modeFact.manual",
  "accept-edits": "ui.chat.homeprofessormarichat.modeFact.acceptEdits",
  plan: "ui.chat.homeprofessormarichat.modeFact.plan",
  bypass: "ui.chat.homeprofessormarichat.modeFact.bypass",
};

export const MARI_WELCOME =
  "Howdy, welcome to Marinara Engine!\n\nFeeling a little lost? It is not a skill issue yet, I am here to help! Ask me about the app, your setup, or what to do next.\n\nNeed something made or changed? I can create character cards, personas, lorebooks, chats, and presets, and I can make reversible local workspace changes with a Keep/Restore review. Select a connection via the link icon beside the paperclip first and then ask away!";
export const NEW_SKILL_CONTENT = `# Custom Professor Mari Skill

Use this skill when the request matches a workflow you want Professor Mari to follow.

## Workflow

- Add the trigger conditions.
- Add the steps Professor Mari should follow.
- Add any checks or evidence she should collect before saying the work is done.
`;

export type ProfessorMariAttachment = {
  type: string;
  data: string;
  name: string;
  filename?: string;
  resized?: boolean;
};
export const PROFESSOR_MARI_ATTACHMENT_ACCEPT =
  "image/*,application/pdf,.pdf,.txt,.md,.markdown,.json,.jsonl,.csv,.log,.xml,.yaml,.yml";
export const PROFESSOR_MARI_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
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
export const MARI_PANEL_SLOT_CLASS =
  "mari-workspace-canvas absolute inset-0 z-10 flex h-full min-h-0 min-w-0 flex-col sm:relative sm:inset-auto sm:z-auto sm:h-full sm:w-[24rem] sm:min-w-[24rem] sm:shrink-0 sm:border-l sm:border-[var(--mari-hairline)]";

/** M7: the "Aware of" panel's group labels and rows, on the direction A `.mari-edit` group. */
export const SEES_KICKER_CLASS =
  "px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]";

export const PROFESSOR_MARI_PANE_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] } as const;

export type WorkspaceSkillMutationResponse = {
  ok: boolean;
  skill: MariWorkspaceSkillDetail;
};

export type ProfessorMariConnectionOption = {
  id: string;
  name: string;
  model?: string | null;
  provider?: string;
  isDefault?: boolean;
};

export type ProfessorMariChatSummary = Chat & {
  messageCount?: number;
};

// R7: "Continue here" picks per context, so the same door does not ask again.
// ponytail: page-session memory only; a reload asks once more. Persist it on the thread if that annoys.
export const continuedThereByContext = new Map<string, string>();

function isProfessorMariDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
}

export function ProfessorMariMobilePortal({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
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

export function inferProfessorMariAttachmentType(file: File): string {
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

export function isSupportedProfessorMariAttachment(file: File): boolean {
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

export function readProfessorMariFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function isProfessorMariImageAttachment(attachment: ProfessorMariAttachment): boolean {
  return attachment.type.startsWith("image/") && attachment.data.startsWith("data:image/");
}

export function isProfessorMariAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export function toMessageExtra(message: Message): Message["extra"] {
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

export function getProfessorMariAttachments(message: Message): ProfessorMariAttachment[] {
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
export const PROFESSOR_MARI_DEFAULT_CHAT_NAME = "Professor Mari";
const PROFESSOR_MARI_AUTO_TITLE_MAX = 48;

/**
 * A title taken from the first thing the user asked. No second model call: the
 * opening question is already the best short summary of the conversation, and a
 * history of ten chats all called "Professor Mari" cannot be searched at all.
 */
export function buildProfessorMariAutoTitle(text: string): string {
  const line = text.replace(/\s+/gu, " ").trim();
  if (!line) return "";
  if (line.length <= PROFESSOR_MARI_AUTO_TITLE_MAX) return line;
  return `${line.slice(0, PROFESSOR_MARI_AUTO_TITLE_MAX - 1).trimEnd()}…`;
}

export function isProfessorMariChatActive(chat: ProfessorMariChatSummary) {
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

export function createLocalUserMessage(
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

export function getProfessorMariMessageContext(message: Message): ProfessorMariAskContext | null | undefined {
  const extra = toMessageExtra(message);
  if (!extra || typeof extra !== "object" || !("professorMariContext" in extra)) return undefined;
  return extra.professorMariContext ?? null;
}

// One formatter for every row: building it per message per render cost ~1 ms each on a long chat.
const mariMessageTimeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function formatMariMessageTime(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return mariMessageTimeFormat.format(date);
}

export function resolveContextCharacter(
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

export function resolveContextLorebook(
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

export function persistentResourceContext(
  context: ProfessorMariAskContext | null | undefined,
): ProfessorMariAskContext | null {
  if (!context?.resource || !isPersistentProfessorMariContext(context)) return null;
  return {
    source: context.source,
    capability: "explain",
    resource: context.resource,
  };
}

export function getMessageThinking(message: Message): string | null {
  const extra = toMessageExtra(message);
  const thinking = extra?.thinking;
  return typeof thinking === "string" && thinking.trim().length > 0 ? thinking : null;
}

export type ProfessorMariRecovery = {
  text: string;
  attachments: ProfessorMariAttachment[];
  context: ProfessorMariAskContext | null;
  kind: "provider" | "tool" | "context" | "general";
  /** What the provider or server said, shown under the error. */
  detail?: string;
  /** The optimistic bubble of the failed message, replaced when you retry. */
  localMessageId?: string;
};

export function classifyProfessorMariFailure(error: unknown): ProfessorMariRecovery["kind"] {
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

/** What a failed send needs to be sent again: its text, files and context. */
export function retryOf(message: Message | undefined) {
  return {
    text: message?.content ?? "",
    attachments: message ? getProfessorMariAttachments(message) : [],
    context: (message && getProfessorMariMessageContext(message)) ?? null,
  };
}
