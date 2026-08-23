import DOMPurify from "dompurify";
import { escapeStandaloneGameNarrationAngleLines } from "../../lib/game-tag-parser";
import { HTML_SAFE_DIALOGUE_QUOTE_PATTERN_SOURCE } from "../../lib/dialogue-quotes";

function commandBadge(className: string, label: string, detail?: string): string {
  return `<span class="inline-flex max-w-full flex-wrap items-center gap-1 rounded px-1.5 py-0.5 text-xs ${className}">${label}${
    detail ? ` <span class="opacity-75">${detail}</span>` : ""
  }</span>`;
}

function parseCommandAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(source)) !== null) {
    attrs[match[1]!] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function formatSignedNumber(value: string): string {
  const numeric = Number(value.trim());
  if (!Number.isFinite(numeric)) return value.trim();
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

export function formatNarration(content: string, boldDialogue = true): string {
  let html = escapeStandaloneGameNarrationAngleLines(content)
    .replace(/\[combat_result]\s*([\s\S]*?)\s*\[\/combat_result]/gi, (_match, recap: string) => {
      const cleaned = recap.trim();
      return `${commandBadge("bg-red-500/15 text-red-200 ring-1 ring-red-400/20", "⚔ Combat Result")}${
        cleaned ? `\n${cleaned}` : ""
      }`;
    })
    .replace(
      /\[dice:\s*((?:\d+)?d\d+(?:[+-]\d+)?)\s*=\s*(-?\d+)(?:\s*\([^\]]+\))?\]/gi,
      (_match, notation: string, total: string) =>
        commandBadge("bg-white/10 text-white/60 font-mono", "🎲", `${notation} → ${total}`),
    )
    .replace(/\[qte_bonus:\s*(-?\d+)\]/gi, (_match, bonus: string) =>
      commandBadge("bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20", "⏱ QTE Bonus", formatSignedNumber(bonus)),
    )
    .replace(/\[qte_result:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      const status = attrs.status === "fail" ? "Fail" : attrs.status === "success" ? "Success" : "Result";
      const modifier = attrs.modifier ? formatSignedNumber(attrs.modifier) : "";
      return commandBadge("bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20", `⏱ QTE ${status}`, modifier);
    })
    .replace(/\[skill_check:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      const skill = attrs.skill || "Skill";
      const dc = attrs.dc ? `DC ${attrs.dc}` : "";
      const total = attrs.total ? `total ${attrs.total}` : "";
      const result = attrs.result ? attrs.result.replace(/_/g, " ") : "";
      return commandBadge(
        "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20",
        "🎯 Skill Check",
        [skill, dc, total, result].filter(Boolean).join(" · "),
      );
    })
    .replace(/\[combat:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge(
        "bg-red-500/15 text-red-200 ring-1 ring-red-400/20",
        "⚔ Combat",
        attrs.enemies || rawAttrs.trim(),
      );
    })
    .replace(/\[status:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      const modifier = attrs.modifier ? `${attrs.stat || "modifier"} ${formatSignedNumber(attrs.modifier)}` : "";
      const turns = attrs.turns || attrs.duration ? `${attrs.turns || attrs.duration} turns` : "";
      return commandBadge(
        "bg-[var(--destructive)]/15 text-[var(--destructive)] ring-1 ring-[var(--destructive)]/20",
        "✦ Status",
        [attrs.effect || attrs.name || "Effect", attrs.target ? `on ${attrs.target}` : "", turns, modifier]
          .filter(Boolean)
          .join(" · "),
      );
    })
    .replace(/\[element_attack:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge(
        "bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/20",
        "✦ Element",
        [attrs.element, attrs.target ? `on ${attrs.target}` : ""].filter(Boolean).join(" · ") || rawAttrs.trim(),
      );
    })
    .replace(/\[qte:\s*([^\]]+)\]/gi, (_match, body: string) =>
      commandBadge("bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20", "⏱ QTE", body.trim()),
    )
    .replace(/\[choices:\s*([^\]]+)\]/gi, (_match, body: string) =>
      commandBadge("bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/20", "☑ Choices", body.trim()),
    )
    .replace(/\[inventory:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge(
        "bg-lime-500/15 text-lime-200 ring-1 ring-lime-400/20",
        "🎒 Inventory",
        [attrs.action, attrs.item].filter(Boolean).join(": "),
      );
    })
    .replace(/\[map_update:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge(
        "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20",
        "🗺 Map",
        attrs.new_location || rawAttrs.trim(),
      );
    })
    .replace(/\[reputation:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge(
        "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-text)] ring-1 ring-[var(--marinara-chat-chrome-button-border)]",
        "◆ Reputation",
        [attrs.npc, attrs.action].filter(Boolean).join(": "),
      );
    })
    .replace(/\[party_change:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge(
        "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/20",
        "👥 Party",
        [attrs.change, attrs.character].filter(Boolean).join(": "),
      );
    })
    .replace(/\[party_add:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge(
        "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/20",
        "👥 Party",
        attrs.character || rawAttrs.trim(),
      );
    })
    .replace(/\[session_end:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge("bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20", "🏁 Session End", attrs.reason);
    })
    .replace(/\[(music|sfx|bg|ambient):\s*([^\]]+)\]/gi, (_match, kind: string, body: string) =>
      commandBadge("bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/20", kind.toUpperCase(), body.trim()),
    )
    .replace(/\[direction:\s*([^\]]+)\]/gi, (_match, body: string) =>
      commandBadge("bg-zinc-500/15 text-zinc-200 ring-1 ring-zinc-400/20", "Direction", body.trim()),
    )
    .replace(/\[widget:\s*([^\]]+)\]/gi, (_match, body: string) =>
      commandBadge("bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/20", "Widget", body.trim()),
    )
    .replace(/\[dialogue:\s*([^\]]+)\]/gi, (_match, rawAttrs: string) => {
      const attrs = parseCommandAttributes(rawAttrs);
      return commandBadge(
        "bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20",
        "Dialogue",
        attrs.npc || rawAttrs.trim(),
      );
    })
    .replace(/\[state:\s*(\w+)\]/gi, (_match, state: string) =>
      commandBadge("bg-sky-500/20 text-sky-300", "⚡ State", state),
    )
    .replace(/(^|\n)[ \t]*-#(?:[ \t]+([^\n]*))?(?=\n|$)/g, '$1<small class="mari-md-subtext">$2</small>')
    .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
    .replace(/__(.+?)__/gs, '<u class="mari-md-underline">$1</u>')
    .replace(/\*(.+?)\*/gs, "<em>$1</em>")
    .replace(/\n/g, "<br />");

  if (boldDialogue) {
    const narrationQuoteRe = new RegExp(`(?<![=\\w])(?:${HTML_SAFE_DIALOGUE_QUOTE_PATTERN_SOURCE})`, "g");
    html = html.replace(narrationQuoteRe, (match) => `<strong>${match}</strong>`);
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["strong", "em", "u", "small", "br", "span"],
    ALLOWED_ATTR: ["class"],
  });
}
