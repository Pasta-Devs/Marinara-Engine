// ──────────────────────────────────────────────
// Peek Prompt Modal — collapsible section viewer
// ──────────────────────────────────────────────
import { useState, useMemo } from "react";
import { X, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";

const PROMPT_TAG_CLASS =
  "border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-highlight-text)]";
const PROMPT_TAG_ACTIVE_CLASS =
  "border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function fmtTokens(n: number): string {
  return n.toLocaleString();
}

interface GenerationInfo {
  model?: string;
  provider?: string;
  temperature?: number | null;
  maxTokens?: number | null;
  showThoughts?: boolean | null;
  reasoningEffort?: string | null;
  verbosity?: string | null;
  serviceTier?: string | null;
  assistantPrefill?: string | null;
  tokensPrompt?: number | null;
  tokensCompletion?: number | null;
  tokensCachedPrompt?: number | null;
  tokensCacheWritePrompt?: number | null;
  durationMs?: number | null;
  finishReason?: string | null;
}

interface PeekPromptModalProps {
  data: {
    messages: Array<{ role: string; content: string }>;
    parameters: unknown;
    source?: "cached" | "live_preview" | "raw_messages";
    exact?: boolean;
    generationInfo?: GenerationInfo | null;
    agentNote?: string;
  };
  onClose: () => void;
}

function sourceLabel(data: PeekPromptModalProps["data"]): string {
  if (data.exact) return "Exact Text Model Request";
  if (data.source === "live_preview") return "Live Preview";
  if (data.source === "raw_messages") return "Raw Messages";
  return "Prompt Preview";
}

function sourceBadgeClass(data: PeekPromptModalProps["data"]): string {
  if (data.exact) return PROMPT_TAG_ACTIVE_CLASS;
  return PROMPT_TAG_CLASS;
}

function prettifyTag(tag: string): string {
  return tag.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ═══════════════════════════════════════════════
//  Section types for the final display list
// ═══════════════════════════════════════════════

interface SectionBlock {
  kind: "section";
  label: string;
  role: string;
  content: string;
}

interface ChatHistoryEntry {
  role: string;
  content: string;
}

interface ChatHistoryBlock {
  kind: "chat-history";
  entries: ChatHistoryEntry[];
  rawContent: string; // for token counting
}

type DisplaySection = SectionBlock | ChatHistoryBlock;

interface PromptSegment {
  role: string;
  content: string;
  inChatHistory: boolean;
}

function isDisplayedChatHistoryRole(role: string): boolean {
  return role === "user" || role === "assistant";
}

// ═══════════════════════════════════════════════
//  Parsing: works on the WHOLE messages array
// ═══════════════════════════════════════════════

/**
 * Parse XML sections from a single message's content.
 * Only matches tags whose opening AND closing appear on their own line
 * (prompt-level sections like <system_prompt>, <character_info>, etc.).
 * Returns named blocks; anything between/around sections becomes a block
 * named after the message role.
 */
function parseXmlSections(content: string, fallbackLabel: string): SectionBlock[] {
  const blocks: SectionBlock[] = [];
  // Match <tag_name>\n...\n</tag_name> where both tags sit on their own line.
  const tagRegex = /(?:^|\n)(<([a-z_][a-z0-9_-]*)>\n[\s\S]*?\n<\/\2>)(?:\n|$)/gi;
  let lastIndex = 0;

  for (const match of content.matchAll(tagRegex)) {
    const matchStart = match.index!;
    const realStart = content[matchStart] === "\n" ? matchStart + 1 : matchStart;
    const before = content.slice(lastIndex, realStart);
    if (before.trim()) {
      blocks.push({ kind: "section", label: fallbackLabel, role: fallbackLabel, content: before.trim() });
    }
    const tagName = match[2]!;
    const tagContent = match[1]!;
    blocks.push({ kind: "section", label: tagName, role: fallbackLabel, content: tagContent.trimEnd() });
    lastIndex = match.index! + match[0].length;
  }

  const remaining = content.slice(lastIndex);
  if (remaining.trim()) {
    blocks.push({ kind: "section", label: fallbackLabel, role: fallbackLabel, content: remaining.trim() });
  }

  return blocks.length > 0 ? blocks : [{ kind: "section", label: fallbackLabel, role: fallbackLabel, content }];
}

function splitPromptSegments(messages: Array<{ role: string; content: string }>): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let inXmlChatHistory = false;
  let inMarkdownChatHistory = false;

  const pushSegment = (role: string, content: string, inChatHistory: boolean) => {
    if (!content.trim()) return;
    segments.push({ role, content: content.trim(), inChatHistory });
  };

  for (const message of messages) {
    let remaining = message.content;

    while (remaining.length > 0) {
      if (inXmlChatHistory) {
        const closeIdx = remaining.search(/\n?<\/chat_history>/i);
        if (closeIdx >= 0) {
          const closeMatch = remaining.slice(closeIdx).match(/^\n?<\/chat_history>/i);
          pushSegment(message.role, remaining.slice(0, closeIdx), true);
          remaining = remaining.slice(closeIdx + (closeMatch?.[0].length ?? 0));
          inXmlChatHistory = false;
          continue;
        }
        pushSegment(message.role, remaining, true);
        break;
      }

      if (inMarkdownChatHistory) {
        const lastMessageIdx = remaining.search(/^## Last Message\n?/im);
        if (lastMessageIdx >= 0) {
          pushSegment(message.role, remaining.slice(0, lastMessageIdx), true);
          remaining = remaining.slice(lastMessageIdx);
          inMarkdownChatHistory = false;
          continue;
        }
        pushSegment(message.role, remaining, true);
        break;
      }

      const xmlOpenIdx = remaining.search(/<chat_history>\n?/i);
      const markdownOpenIdx = remaining.search(/^## Chat History\n?/im);
      const hasXmlOpen = xmlOpenIdx >= 0;
      const hasMarkdownOpen = markdownOpenIdx >= 0;
      const useXmlOpen = hasXmlOpen && (!hasMarkdownOpen || xmlOpenIdx <= markdownOpenIdx);
      const openIdx = useXmlOpen ? xmlOpenIdx : markdownOpenIdx;

      if (openIdx >= 0) {
        pushSegment(message.role, remaining.slice(0, openIdx), false);
        const openMatch = remaining
          .slice(openIdx)
          .match(useXmlOpen ? /<chat_history>\n?/i : /^## Chat History\n?/i);
        remaining = remaining.slice(openIdx + (openMatch?.[0].length ?? 0));
        if (useXmlOpen) inXmlChatHistory = true;
        else inMarkdownChatHistory = true;
        continue;
      }

      pushSegment(message.role, remaining, false);
      break;
    }
  }

  return segments;
}

function appendPromptSection(result: DisplaySection[], segment: PromptSegment) {
  const openIdx = segment.content.search(/<last_message>/i);
  const closingIdx = segment.content.search(/<\/last_message>/i);
  if (openIdx >= 0 && closingIdx >= 0) {
    const beforeOpen = segment.content.slice(0, openIdx).trim();
    const innerContent = segment.content.slice(segment.content.indexOf(">", openIdx) + 1, closingIdx).trim();
    const afterClose = segment.content.slice(segment.content.indexOf(">", closingIdx) + 1).trim();

    if (beforeOpen) {
      const pre = parseXmlSections(beforeOpen, segment.role);
      for (const block of pre) result.push(block);
    }
    if (innerContent) {
      result.push({ kind: "section", label: "last_message", role: segment.role, content: innerContent });
    }
    if (afterClose) {
      const post = parseXmlSections(afterClose, segment.role);
      for (const block of post) result.push(block);
    }
    return;
  }

  if (/^## Last Message\n?/i.test(segment.content)) {
    result.push({
      kind: "section",
      label: "last_message",
      role: segment.role,
      content: segment.content.replace(/^## Last Message\n?/i, "").trim(),
    });
    return;
  }

  const blocks = parseXmlSections(segment.content, segment.role);
  for (const block of blocks) result.push(block);
}

function buildDisplaySections(messages: Array<{ role: string; content: string }>): DisplaySection[] {
  const result: DisplaySection[] = [];
  const historyEntries: ChatHistoryEntry[] = [];
  const historyRawParts: string[] = [];

  const flushChatHistory = () => {
    if (historyEntries.length === 0) return;
    result.push({ kind: "chat-history", entries: [...historyEntries], rawContent: historyRawParts.join("\n\n") });
    historyEntries.length = 0;
    historyRawParts.length = 0;
  };

  for (const segment of splitPromptSegments(messages)) {
    if (segment.inChatHistory && isDisplayedChatHistoryRole(segment.role)) {
      historyEntries.push({ role: segment.role, content: segment.content });
      historyRawParts.push(segment.content);
      continue;
    }

    flushChatHistory();
    appendPromptSection(result, segment);
  }

  flushChatHistory();
  return result;
}

// ═══════════════════════════════════════════════
//  UI Components
// ═══════════════════════════════════════════════

function CollapsibleBlock({
  label,
  content,
  defaultOpen,
  roleColor,
}: {
  label: string;
  content: string;
  defaultOpen: boolean;
  roleColor: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tokens = estimateTokens(content);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        {open ? (
          <ChevronDown size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
        )}
        <span className={cn("rounded-md px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider", roleColor)}>
          {prettifyTag(label)}
        </span>
        <span className="ml-auto text-[0.625rem] text-[var(--muted-foreground)]">
          ~{fmtTokens(tokens)} token{tokens !== 1 ? "s" : ""}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)]/50 px-3 py-2">
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--foreground)]/80">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

function ChatHistorySection({ entries, rawContent }: { entries: ChatHistoryEntry[]; rawContent: string }) {
  const [open, setOpen] = useState(false);
  const tokens = estimateTokens(rawContent);

  const msgRoleColor = (role: string) => {
    if (role === "assistant") return PROMPT_TAG_ACTIVE_CLASS;
    return PROMPT_TAG_CLASS;
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        {open ? (
          <ChevronDown size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
        )}
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider",
            PROMPT_TAG_ACTIVE_CLASS,
          )}
        >
          Chat History
        </span>
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">
          {entries.length} message{entries.length !== 1 ? "s" : ""}
        </span>
        <span className="ml-auto text-[0.625rem] text-[var(--muted-foreground)]">
          ~{fmtTokens(tokens)} token{tokens !== 1 ? "s" : ""}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)]/50 p-2 space-y-1">
          {entries.map((entry, i) => (
            <ChatHistoryMessage key={i} entry={entry} roleColor={msgRoleColor(entry.role)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChatHistoryMessage({ entry, roleColor }: { entry: ChatHistoryEntry; roleColor: string }) {
  const [open, setOpen] = useState(false);
  const tokens = estimateTokens(entry.content);
  const preview = entry.content.split("\n")[0]?.slice(0, 80) ?? "";

  return (
    <div className="rounded-md border border-[var(--border)]/30 bg-[var(--background)]/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--accent)]/30"
      >
        {open ? (
          <ChevronDown size="0.625rem" className="shrink-0 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronRight size="0.625rem" className="shrink-0 text-[var(--muted-foreground)]" />
        )}
        <span className={cn("rounded px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider", roleColor)}>
          {entry.role}
        </span>
        {!open && (
          <span className="min-w-0 flex-1 truncate text-[0.625rem] text-[var(--muted-foreground)]">{preview}</span>
        )}
        <span className="shrink-0 ml-auto text-[0.5625rem] text-[var(--muted-foreground)]">~{fmtTokens(tokens)}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)]/30 px-2.5 py-1.5">
          <pre className="whitespace-pre-wrap break-words text-[0.6875rem] leading-relaxed text-[var(--foreground)]/80">
            {entry.content}
          </pre>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Main Modal
// ═══════════════════════════════════════════════

export function PeekPromptModal({ data, onClose }: PeekPromptModalProps) {
  const sections = useMemo(() => buildDisplaySections(data.messages), [data.messages]);
  const totalTokens = useMemo(() => estimateTokens(data.messages.map((m) => m.content).join("")), [data.messages]);

  const gen = data.generationInfo;
  const params = data.parameters as Record<string, unknown> | null;

  // Build parameter pills from generationInfo (cached) or assembled parameters
  const paramPills = useMemo(() => {
    const pills: Array<{ label: string; value: string }> = [];
    if (gen) {
      if (gen.temperature != null) pills.push({ label: "Temperature", value: String(gen.temperature) });
      if (gen.maxTokens != null) pills.push({ label: "Max Output Tokens", value: fmtTokens(gen.maxTokens) });
      if (gen.showThoughts) pills.push({ label: "Thinking", value: "On" });
      if (gen.reasoningEffort) pills.push({ label: "Reasoning", value: gen.reasoningEffort });
      if (gen.verbosity) pills.push({ label: "Verbosity", value: gen.verbosity });
      if (gen.serviceTier) pills.push({ label: "Service Tier", value: gen.serviceTier });
      if (gen.assistantPrefill) pills.push({ label: "Assistant Prefill", value: "On" });
    } else if (params) {
      if (params.temperature != null) pills.push({ label: "Temperature", value: String(params.temperature) });
      if (params.topP != null && params.topP !== 1) pills.push({ label: "Top P", value: String(params.topP) });
      if (params.topK != null && params.topK !== 0) pills.push({ label: "Top K", value: String(params.topK) });
      if (params.minP != null && params.minP !== 0) pills.push({ label: "Min P", value: String(params.minP) });
      if (params.maxTokens != null)
        pills.push({ label: "Max Output Tokens", value: fmtTokens(params.maxTokens as number) });
      if (params.frequencyPenalty != null && params.frequencyPenalty !== 0)
        pills.push({ label: "Freq Penalty", value: String(params.frequencyPenalty) });
      if (params.presencePenalty != null && params.presencePenalty !== 0)
        pills.push({ label: "Pres Penalty", value: String(params.presencePenalty) });
      if (params.showThoughts) pills.push({ label: "Thinking", value: "On" });
      if (params.reasoningEffort) pills.push({ label: "Reasoning", value: String(params.reasoningEffort) });
      if (params.verbosity) pills.push({ label: "Verbosity", value: String(params.verbosity) });
      if (params.serviceTier) pills.push({ label: "Service Tier", value: String(params.serviceTier) });
      if (params.assistantPrefill) pills.push({ label: "Assistant Prefill", value: "On" });
    }
    return pills;
  }, [gen, params]);

  const sectionRoleColor = (role: string, label: string) => {
    if (/last.?message/i.test(label) || role === "assistant") return PROMPT_TAG_ACTIVE_CLASS;
    return PROMPT_TAG_CLASS;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm max-md:pt-[env(safe-area-inset-top)]"
      onClick={onClose}
    >
      <div
        className={cn(NEUTRAL_PANEL_SHELL, "mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(NEUTRAL_PANEL_HEADER, "shrink-0 flex items-center justify-between gap-3 px-5 py-3")}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className={cn(NEUTRAL_PANEL_TITLE, "shrink-0 text-sm")}>Assembled Prompt</h3>
            <span
              className={cn(
                "shrink-0 rounded-md border px-2 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider",
                sourceBadgeClass(data),
              )}
            >
              {sourceLabel(data)}
            </span>
            <span className="min-w-0 text-[0.625rem] text-[var(--muted-foreground)]">
              {sections.length} section{sections.length !== 1 ? "s" : ""} &middot; ~{fmtTokens(totalTokens)} tokens
            </span>
          </div>
          <button
            onClick={onClose}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            aria-label="Close assembled prompt"
          >
            <X size="1rem" />
          </button>
        </div>
        <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 flex-1 overflow-y-auto p-4 space-y-2")}>
          {/* Generation info panel */}
          {(gen || paramPills.length > 0) && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem]">
                {gen?.model && (
                  <span className="font-medium text-[var(--foreground)]">
                    {gen.provider ? (
                      <span className="text-[var(--muted-foreground)] font-normal">{gen.provider} / </span>
                    ) : null}
                    {gen.model}
                  </span>
                )}
                <span className="text-[var(--muted-foreground)]">
                  ~{fmtTokens(totalTokens)} est. tokens
                  {gen?.tokensPrompt != null && <> · {fmtTokens(gen.tokensPrompt)} actual prompt tokens</>}
                  {(gen?.tokensCachedPrompt ?? 0) > 0 && <> · {fmtTokens(gen?.tokensCachedPrompt ?? 0)} cached</>}
                  {(gen?.tokensCacheWritePrompt ?? 0) > 0 && (
                    <> · {fmtTokens(gen?.tokensCacheWritePrompt ?? 0)} cache write</>
                  )}
                </span>
              </div>
              {paramPills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {paramPills.map((p) => (
                    <span
                      key={p.label}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)]/50 px-2 py-0.5 text-[0.625rem]"
                    >
                      <span className="text-[var(--muted-foreground)]">{p.label}</span>
                      <span className="font-medium text-[var(--foreground)]">{p.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {data.agentNote && (
            <div className="rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-text)]">
              Note: {data.agentNote}
            </div>
          )}
          {sections.map((s, i) =>
            s.kind === "chat-history" ? (
              <ChatHistorySection key={i} entries={s.entries} rawContent={s.rawContent} />
            ) : (
              <CollapsibleBlock
                key={i}
                label={s.label}
                content={s.content}
                defaultOpen={false}
                roleColor={sectionRoleColor(s.role, s.label)}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
