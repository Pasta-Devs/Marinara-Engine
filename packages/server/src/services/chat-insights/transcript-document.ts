// ──────────────────────────────────────────────
// Readable transcript documents: Markdown and a standalone HTML story
// ──────────────────────────────────────────────

export interface TranscriptDocumentEntry {
  /** Stable key for avatar lookup and color assignment. */
  speakerKey: string;
  speaker: string;
  role: string;
  content: string;
  createdAt?: string | null;
  thinking?: string | null;
}

export interface TranscriptDocumentInput {
  title: string;
  entries: TranscriptDocumentEntry[];
  /** Optional data: URIs keyed by speakerKey. Anything else is ignored. */
  avatars?: ReadonlyMap<string, string>;
  /** Formats dates for the header and message stamps; defaults to ISO-like strings. */
  formatDate?: (iso: string) => string;
  generatedAt?: string;
}

/** Hidden, system and empty turns are left out of readable documents. */
export interface TranscriptVisibilityInput {
  role: string;
  content: string;
  extra: Record<string, unknown>;
}

export function isStoryTranscriptMessage(message: TranscriptVisibilityInput): boolean {
  if (message.role === "system") return false;
  if (!message.content.trim()) return false;
  const { extra } = message;
  return extra.hiddenFromUser !== true && extra.commandOnly !== true && extra.roleplayPrivateOnly !== true;
}

function defaultFormatDate(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  return new Date(time).toISOString().slice(0, 16).replace("T", " ");
}

function formatDay(iso: string): string {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : iso;
}

/** "2026-01-02 to 2026-02-03", or a single day, from the first and last dated entries. */
export function describeTranscriptDateRange(entries: readonly TranscriptDocumentEntry[]): string {
  const times = entries
    .map((entry) => (entry.createdAt ? Date.parse(entry.createdAt) : Number.NaN))
    .filter((time) => Number.isFinite(time));
  if (times.length === 0) return "";
  let first = times[0]!;
  let last = times[0]!;
  for (const time of times) {
    if (time < first) first = time;
    if (time > last) last = time;
  }
  const start = formatDay(new Date(first).toISOString());
  const end = formatDay(new Date(last).toISOString());
  return start === end ? start : `${start} to ${end}`;
}

// ── Markdown ──

function escapeMarkdownInline(value: string): string {
  return value.replace(/([\\`*_[\]#<>|])/gu, "\\$1");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

export function renderTranscriptMarkdown(input: TranscriptDocumentInput): string {
  const range = describeTranscriptDateRange(input.entries);
  const lines: string[] = [`# ${escapeMarkdownInline(input.title.trim() || "Chat")}`, ""];
  if (range) lines.push(`_${range}_`, "");
  lines.push("---", "");
  for (const entry of input.entries) {
    lines.push(`### ${escapeMarkdownInline(entry.speaker)}`, "");
    lines.push(escapeMarkdownText(entry.content.trim()), "");
    if (entry.thinking?.trim()) {
      const thinking = escapeMarkdownText(entry.thinking.trim());
      lines.push("<details><summary>Thinking</summary>", "", thinking, "", "</details>", "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

// ── HTML ──

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

/** Escapes first, then applies a small safe subset of Markdown emphasis. */
export function renderStoryInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`\n]+)`/gu, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/gu, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_(?=[^_\w]|$)/gu, "$1<em>$2</em>");
}

function renderStoryBody(content: string): string {
  return content
    .replace(/\r\n?/gu, "\n")
    .trim()
    .split(/\n{2,}/u)
    .map((paragraph) => `<p>${paragraph.split("\n").map(renderStoryInline).join("<br>")}</p>`)
    .join("");
}

const SAFE_AVATAR_URI_HEADER = /^data:image\/(png|jpe?g|gif|webp|avif);base64,/u;
const NON_AVATAR_URI_BODY = /[^A-Za-z0-9+/=]/u;

/**
 * A data: URI safe to inline in the exported stylesheet. The base64 body is checked by a negative test: V8's regexp
 * interpreter recurses once per character, so `^…[A-Za-z0-9+/=]+$` over a large image exhausted the stack (#9060).
 */
function isSafeAvatarUri(uri: string): boolean {
  const header = SAFE_AVATAR_URI_HEADER.exec(uri);
  if (!header) return false;
  const body = uri.slice(header[0].length);
  return body.length > 0 && !NON_AVATAR_URI_BODY.test(body);
}

function speakerHue(key: string): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  return hash % 360;
}

function initialOf(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase() : "?";
}

const STORY_CSS = `
:root{color-scheme:light dark;--bg:#faf8f5;--paper:#fff;--ink:#1f1d1a;--muted:#6b665e;--line:#e6e1d8;--user:#f2efe9;--accent:#8a5a2b}
@media (prefers-color-scheme:dark){:root{--bg:#141312;--paper:#1c1b19;--ink:#ece8e1;--muted:#a39d93;--line:#34312d;--user:#24221f;--accent:#e0a868}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 Georgia,"Iowan Old Style","Palatino Linotype",serif}
main{max-width:46rem;margin:0 auto;padding:3rem 1.25rem 4rem}
header{border-bottom:1px solid var(--line);margin-bottom:2rem;padding-bottom:1.25rem}
h1{font-size:2rem;line-height:1.2;margin:0 0 .35rem;font-weight:600}
.range{color:var(--muted);font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0}
.turn{display:flex;gap:.9rem;padding:1rem 0;border-bottom:1px solid var(--line);break-inside:avoid;page-break-inside:avoid}
.turn:last-child{border-bottom:0}
.turn.user .text{background:var(--user);border-radius:.6rem;padding:.6rem .85rem}
.avatar{flex:0 0 2.5rem;width:2.5rem;height:2.5rem;border-radius:50%;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;font:600 1rem/1 system-ui,sans-serif;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{min-width:0;flex:1}
.meta{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;margin-bottom:.3rem}
.name{font-weight:650;color:var(--accent)}
.time{color:var(--muted)}
.text p{margin:0 0 .75rem;overflow-wrap:anywhere}
.text p:last-child{margin-bottom:0}
.turn.narrator .text{font-style:italic}
code{font:.9em ui-monospace,Consolas,monospace;background:var(--user);padding:0 .25em;border-radius:.25em}
details,.thinking-print{margin-top:.5rem;color:var(--muted);font-size:.9em}
.thinking-print{display:none}
footer{margin-top:2.5rem;color:var(--muted);font:12px/1.4 system-ui,sans-serif;text-align:center}
@media (max-width:480px){body{font-size:16px}main{padding:2rem 1rem 3rem}.avatar{flex-basis:2rem;width:2rem;height:2rem}}
@media print{:root{--bg:#fff;--paper:#fff;--ink:#000;--muted:#555;--line:#ccc;--user:#f3f3f3;--accent:#333}body{font-size:12pt}main{max-width:none;padding:0}details{display:none}.thinking-print{display:block}}
`;

export function renderTranscriptHtml(input: TranscriptDocumentInput): string {
  const title = input.title.trim() || "Chat";
  const formatDate = input.formatDate ?? defaultFormatDate;
  const range = describeTranscriptDateRange(input.entries);
  // Store each raster once in CSS; repeating base64 per turn can dwarf a long story.
  const avatarClasses = new Map<string, string>();
  for (const entry of input.entries) {
    const avatar = input.avatars?.get(entry.speakerKey);
    if (avatar && !avatarClasses.has(avatar) && isSafeAvatarUri(avatar)) {
      avatarClasses.set(avatar, `avatar-${avatarClasses.size}`);
    }
  }
  const avatarCss = [...avatarClasses]
    .map(([avatar, className]) => `.${className}{background-image:url("${avatar}")}`)
    .join("\n");
  const turns = input.entries
    .map((entry) => {
      const avatar = input.avatars?.get(entry.speakerKey);
      const avatarClass = avatar ? avatarClasses.get(avatar) : undefined;
      const avatarHtml = avatarClass
        ? `<div class="avatar ${avatarClass}" aria-hidden="true"></div>`
        : `<div class="avatar" aria-hidden="true" style="background:hsl(${speakerHue(entry.speakerKey)} 45% 45%)">${escapeHtml(initialOf(entry.speaker))}</div>`;
      const time = entry.createdAt
        ? `<time class="time" datetime="${escapeHtml(entry.createdAt)}">${escapeHtml(formatDate(entry.createdAt))}</time>`
        : "";
      const thinkingBody = entry.thinking?.trim() ? renderStoryBody(entry.thinking) : "";
      // ponytail: Extra markup only for included reasoning; remove the print copy
      // once the supported browser baseline permits ::details-content.
      const thinking = thinkingBody
        ? `<details><summary>Thinking</summary>${thinkingBody}</details><div class="thinking-print"><div>Thinking</div>${thinkingBody}</div>`
        : "";
      const roleClass = ["user", "assistant", "narrator"].includes(entry.role) ? entry.role : "assistant";
      return `<article class="turn ${roleClass}">${avatarHtml}<div class="body"><div class="meta"><span class="name">${escapeHtml(entry.speaker)}</span>${time}</div><div class="text">${renderStoryBody(entry.content)}</div>${thinking}</div></article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Marinara Engine">
<title>${escapeHtml(title)}</title>
<style>${STORY_CSS}${avatarCss}</style>
</head>
<body>
<main>
<header><h1>${escapeHtml(title)}</h1>${range ? `<p class="range">${escapeHtml(range)}</p>` : ""}</header>
${turns}
<footer>Exported from Marinara Engine${input.generatedAt ? ` on ${escapeHtml(formatDay(input.generatedAt))}` : ""}</footer>
</main>
</body>
</html>
`;
}
