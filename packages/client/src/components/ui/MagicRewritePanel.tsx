// ──────────────────────────────────────────────
// Magic Rewrite Panel
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { api } from "../../lib/api-client";

const PROMPT_KEY = "magic-rewrite-prompt";

type MinimalItem = { id: string; name?: string; title?: string; content?: string; description?: string; data?: unknown };
type ChatMessage = { role?: string; name?: string; content?: string | { text?: string }; characterId?: string; extra?: unknown };

type RewriteResponse = { text: string };
type DiffPart = { text: string; changed: boolean };
type DiffResult =
  | { skipped: true; before: string; after: string }
  | { skipped: false; before: DiffPart[]; after: DiffPart[] };

function readActiveChatId(): string | null {
  try {
    return window.localStorage.getItem("marinara-active-chat-id");
  } catch {
    return null;
  }
}

function parseCardData(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (typeof data === "object") return data as Record<string, unknown>;
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function labelFor(item: MinimalItem, fallback: string): string {
  const data = parseCardData(item.data);
  return item.name || item.title || (typeof data?.name === "string" ? data.name : "") || fallback;
}

function textFromMessage(message: ChatMessage): string {
  if (typeof message.content === "string") return message.content;
  if (message.content && typeof message.content.text === "string") return message.content.text;
  return "";
}

function diffWords(before: string, after: string): DiffResult {
  const beforeWords = before.match(/\S+|\s+/g) ?? [];
  const afterWords = after.match(/\S+|\s+/g) ?? [];
  if (beforeWords.length + afterWords.length > 3000) {
    return { before: before, after: after, skipped: true };
  }

  const dp = Array.from({ length: beforeWords.length + 1 }, () => new Uint16Array(afterWords.length + 1));
  for (let i = 1; i <= beforeWords.length; i++) {
    for (let j = 1; j <= afterWords.length; j++) {
      dp[i][j] = beforeWords[i - 1] === afterWords[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const deleted = new Uint8Array(beforeWords.length);
  const added = new Uint8Array(afterWords.length);
  let i = beforeWords.length;
  let j = afterWords.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeWords[i - 1] === afterWords[j - 1]) {
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      added[--j] = 1;
    } else {
      deleted[--i] = 1;
    }
  }

  return {
    skipped: false,
    before: beforeWords.map((word, index) => ({ text: word, changed: deleted[index] === 1 })),
    after: afterWords.map((word, index) => ({ text: word, changed: added[index] === 1 })),
  };
}

export function MagicRewritePanel({
  value,
  onResultChange,
}: {
  value: string;
  onResultChange: (value: string) => void;
}) {
  const [instruction, setInstruction] = useState(() => {
    try { return window.localStorage.getItem(PROMPT_KEY) ?? ""; } catch { return ""; }
  });
  const [characters, setCharacters] = useState<MinimalItem[]>([]);
  const [lorebooks, setLorebooks] = useState<MinimalItem[]>([]);
  const [characterId, setCharacterId] = useState("");
  const [lorebookId, setLorebookId] = useState("");
  const [includeChat, setIncludeChat] = useState(false);
  const [chatLimit, setChatLimit] = useState(20);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => { try { window.localStorage.setItem(PROMPT_KEY, instruction); } catch { /* noop */ } }, 300);
    return () => window.clearTimeout(timer);
  }, [instruction]);

  useEffect(() => {
    api.get<MinimalItem[]>("/characters").then(setCharacters).catch(() => setCharacters([]));
    api.get<MinimalItem[]>("/lorebooks/").then(setLorebooks).catch(() => setLorebooks([]));
  }, []);

  const diff = useMemo(() => (result ? diffWords(value, result) : null), [value, result]);

  useEffect(() => {
    onResultChange(result);
  }, [onResultChange, result]);

  async function buildContext(): Promise<string> {
    const sections: string[] = [];

    if (characterId) {
      const character = await api.get<Record<string, unknown>>(`/characters/${characterId}`);
      sections.push(`[CHARACTER CARD]\n${JSON.stringify(character, null, 2)}`);
    }

    if (includeChat) {
      const chatId = readActiveChatId();
      if (chatId) {
        const messages = await api.get<ChatMessage[]>(`/chats/${chatId}/messages?limit=${chatLimit}&skip=0`);
        const lines = messages
          .slice(-chatLimit)
          .map((message) => `${message.name || message.role || "unknown"}: ${textFromMessage(message)}`)
          .join("\n");
        sections.push(`[CHAT HISTORY: last ${chatLimit} messages]\n${lines}`);
      }
    }

    if (lorebookId) {
      const entries = await api.get<MinimalItem[]>(`/lorebooks/${lorebookId}/entries`);
      const lorebook = lorebooks.find((item) => item.id === lorebookId);
      const lines = entries.map((entry, index) => `[${labelFor(entry, `Entry ${index + 1}`)}]\n${entry.content ?? entry.description ?? ""}`).join("\n\n");
      sections.push(`[LOREBOOK${lorebook ? `: ${labelFor(lorebook, "")}` : ""}]\n${lines}`);
    }

    return sections.length > 0
      ? `The following context is provided for reference. Use it to maintain consistency with the character, story, and world.\n\n${sections.join("\n\n---\n\n")}`
      : "";
  }

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const context = await buildContext();
      const response = await api.post<RewriteResponse>("/magic-rewrite/generate", {
        text: value,
        instruction,
        context,
      });
      setResult(response.text ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Magic Rewrite failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <div className="flex min-w-0 flex-col">
          <div className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Rewrite instructions</div>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder='e.g. "Make this more vivid and dramatic..."'
            className="min-h-0 flex-1 resize-none rounded-xl bg-[var(--secondary)] p-3 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>

        <div className="space-y-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Included Context</div>
          <label className="block space-y-1 text-xs text-[var(--muted-foreground)]">
            <span>Character Card</span>
            <select value={characterId} onChange={(event) => setCharacterId(event.target.value)} className="w-full rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)]">
              <option value="">— None —</option>
              {characters.map((character, index) => <option key={character.id} value={character.id}>{labelFor(character, `Character ${index + 1}`)}</option>)}
            </select>
          </label>

          <label className="block space-y-1 text-xs text-[var(--muted-foreground)]">
            <span>Lorebook</span>
            <select value={lorebookId} onChange={(event) => setLorebookId(event.target.value)} className="w-full rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)]">
              <option value="">— None —</option>
              {lorebooks.map((lorebook, index) => <option key={lorebook.id} value={lorebook.id}>{labelFor(lorebook, `Lorebook ${index + 1}`)}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeChat} onChange={(event) => setIncludeChat(event.target.checked)} />
            Include Current Chat
          </label>
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>Last</span>
            <input type="range" min={5} max={250} step={5} value={chatLimit} onChange={(event) => setChatLimit(Number(event.target.value))} className="flex-1" />
            <span className="w-14 text-right">{chatLimit} msgs</span>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <Loader2 size="1rem" className="animate-spin" /> : <Sparkles size="1rem" />}
            {loading ? "Rewriting…" : "Generate Rewrite"}
          </button>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="min-h-0 overflow-auto rounded-xl bg-[var(--secondary)] p-3 text-sm ring-1 ring-[var(--border)]">
          <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Before</div>
          <div className="whitespace-pre-wrap break-words font-sans">
            {diff && !diff.skipped && Array.isArray(diff.before)
              ? diff.before.map((part, index) => <span key={index} className={part.changed ? "bg-red-500/20 text-red-200 line-through" : undefined}>{part.text}</span>)
              : value}
          </div>
        </div>
        <div className="min-h-0 overflow-auto rounded-xl bg-[var(--secondary)] p-3 text-sm ring-1 ring-[var(--border)]">
          <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">After</div>
          <div className="whitespace-pre-wrap break-words font-sans">
            {diff && !diff.skipped && Array.isArray(diff.after)
              ? diff.after.map((part, index) => <span key={index} className={part.changed ? "bg-emerald-500/20 text-emerald-200" : undefined}>{part.text}</span>)
              : result || "Generated rewrite will appear here."}
          </div>
        </div>
      </div>
    </div>
  );
}
