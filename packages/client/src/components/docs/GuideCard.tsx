// ──────────────────────────────────────────────
// Guide card: the AI basics / Deep dive card inside the docs viewer (Docs tab and Docs modal).
//
// While a quest is active and its guide is open, the passage under the quest's heading that holds its
// quote gets a soft highlight, and the card (plain words + a comparison, or the choice + a try-it step)
// is placed right under that passage and scrolled into view. If the heading or quote can't be found
// (an edited or translated guide), it falls back to the heading alone, then to the top of the guide.
//
// Like the find-in-guide marks, this augments the committed DOM, which is safe because both viewers key
// the content container on the document revision, so React remounts it instead of reconciling.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { FEATURE_TIP_FACE } from "../../lib/feature-tips";
import {
  AI_BASICS_QUESTS,
  DEEP_DIVE_GROUPS,
  deepDiveGroupKey,
  guideQuestKey,
  nextBasicsQuest,
  type DeepDiveGroupId,
  type GuideQuest,
  GUIDE_QUEST_BY_ID,
} from "../../lib/guide-quests";
import { markGuideQuestDone } from "../../lib/guide-quests-progress";
import { useRunFeatureStep } from "../../hooks/use-feature-show";
import { useThingsToTry } from "../../hooks/use-things-to-try";
import { executeStateNavigation } from "../../lib/state-navigation";
import { startGuideQuest, useGuideCardStore } from "../../stores/guide-card.store";

const norm = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

function headingLevel(el: Element): number {
  const match = /^H([1-6])$/.exec(el.tagName);
  return match ? Number(match[1]) : 0;
}

/** The content container's direct children from the heading to the next heading of the same or higher level. */
function sectionOf(container: HTMLElement, heading: string): HTMLElement[] | null {
  const children = [...container.children] as HTMLElement[];
  const wanted = norm(heading);
  const at = children.findIndex((child) => headingLevel(child) > 0 && norm(child.textContent ?? "") === wanted);
  if (at < 0) return null;
  const level = headingLevel(children[at]!);
  const out: HTMLElement[] = [children[at]!];
  for (const child of children.slice(at + 1)) {
    const childLevel = headingLevel(child);
    if (childLevel > 0 && childLevel <= level) break;
    out.push(child);
  }
  return out;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Puts the card in place and highlights the passage. Returns the card's slot, the element to scroll to,
 * and an undo. List items and table rows are highlighted whole. Plain paragraphs are runs of text inside
 * a pre-wrap span (paragraphs split by blank lines), so the paragraph's text gets <mark>s and the card
 * goes in right after it, inside the span.
 */
function placeCard(
  container: HTMLElement,
  quest: GuideQuest,
): { slot: HTMLElement; target: HTMLElement; undo: () => void } {
  const slot = document.createElement("div");
  slot.className = "mari-guide-card-host";
  const children = [...container.children] as HTMLElement[];
  const section = (quest.heading ? sectionOf(container, quest.heading) : null) ?? (quest.heading ? null : children);
  const fallback = () => {
    const heading = section?.[0] && headingLevel(section[0]) > 0 ? section[0] : null;
    if (heading) heading.after(slot);
    else container.prepend(slot);
    return { slot, target: heading ?? slot, undo: () => slot.remove() };
  };
  if (!section?.length) return fallback();

  // The section's text, as text nodes with their offsets in the joined string.
  const nodes: { node: Text; start: number }[] = [];
  let full = "";
  for (const block of section) {
    if (headingLevel(block) > 0) continue;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement?.closest(".docs-copy-button, figure, h1, h2, h3, h4, h5, h6")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push({ node: node as Text, start: full.length });
      full += node.textContent ?? "";
    }
    full += "\n\n";
  }
  // Where the quote is (words in order, any spacing, any case); no quote: the first words of the section.
  const words = quest.quote.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  const match = words.length ? new RegExp(words.join("\\s+"), "i").exec(full) : /\S/.exec(full);
  if (!match) return fallback();
  const at = nodes.findLast((entry) => entry.start <= match.index);
  const element = at?.node.parentElement;
  if (!at || !element) return fallback();

  const topBlock = section.find((block) => block.contains(element)) ?? null;
  const whole = element.closest<HTMLElement>("li, tr, blockquote, pre, table");
  if (whole && topBlock?.contains(whole)) {
    whole.classList.add("mari-guide-passage");
    // A list item or table row: the card goes after the whole list or table.
    topBlock.after(slot);
    return {
      slot,
      target: whole,
      undo: () => {
        whole.classList.remove("mari-guide-passage");
        slot.remove();
      },
    };
  }

  // A paragraph: from the blank line before the quote to the blank line after it.
  const from = Math.max(0, full.lastIndexOf("\n\n", match.index) + 2);
  const nextBreak = full.indexOf("\n\n", match.index + match[0].length);
  const to = nextBreak < 0 ? full.length : nextBreak;
  const marks: HTMLElement[] = [];
  const parents = new Set<Node>();
  for (const { node, start } of nodes) {
    const text = node.textContent ?? "";
    const end = start + text.length;
    if (end <= from || start >= to) continue;
    const a = Math.max(0, from - start);
    const b = Math.min(text.length, to - start);
    const piece = text.slice(a, b);
    if (!piece.trim()) continue;
    const frag = document.createDocumentFragment();
    if (a > 0) frag.appendChild(document.createTextNode(text.slice(0, a)));
    const mark = document.createElement("mark");
    mark.className = "mari-guide-quote";
    mark.textContent = piece;
    frag.appendChild(mark);
    marks.push(mark);
    if (b < text.length) frag.appendChild(document.createTextNode(text.slice(b)));
    const parent = node.parentNode;
    if (parent) {
      parent.replaceChild(frag, node);
      parents.add(parent);
    }
  }
  const last = marks.at(-1);
  if (!last) return fallback();
  // The card goes after the paragraph: after the last mark, or after its inline parent (bold, link).
  let anchor: Node = last;
  while (anchor.parentNode && anchor.parentNode !== topBlock && anchor.parentNode !== container) {
    const parent = anchor.parentNode as HTMLElement;
    if (getComputedStyle(parent).display !== "inline" || !/^(STRONG|EM|B|I|A|CODE|SPAN)$/.test(parent.tagName)) break;
    if (parent.lastChild !== anchor) break;
    anchor = parent;
  }
  anchor.parentNode?.insertBefore(slot, anchor.nextSibling);
  return {
    slot,
    target: marks[0]!,
    undo: () => {
      slot.remove();
      for (const mark of marks) mark.parentNode?.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
      for (const parent of parents) parent.normalize();
    },
  };
}

function useConnectionReady() {
  const things = useThingsToTry();
  return things.done.has("C1");
}

function CardBody({ quest, onClose }: { quest: GuideQuest; onClose: () => void }) {
  const { t } = useTranslation();
  const runStep = useRunFeatureStep();
  const connected = useConnectionReady();
  const basics = quest.set === "basics";
  const step = basics ? AI_BASICS_QUESTS.findIndex((entry) => entry.id === quest.id) + 1 : 0;
  const group = DEEP_DIVE_GROUPS.find((entry) => entry.id === quest.group);
  const eyebrow = basics
    ? t("guideQuests.card.basicsStep", "AI basics · {{step}} of {{total}}", { step, total: AI_BASICS_QUESTS.length })
    : t("guideQuests.card.deepEyebrow", "Deep dive · {{group}}", {
        group: group ? t(deepDiveGroupKey(group.id as DeepDiveGroupId), group.name) : "",
      });

  const gotIt = () => {
    markGuideQuestDone(quest.id);
    const next = basics ? nextBasicsQuest(quest.id) : null;
    if (next) startGuideQuest(next.id);
    else onClose();
  };
  const meetMari = () => {
    markGuideQuestDone(quest.id);
    onClose();
    executeStateNavigation({ kind: "professor" });
  };
  const openConnections = () => {
    executeStateNavigation({ kind: "panel", panel: "connections" });
  };

  return (
    <div
      className="mari-guide-card"
      role="region"
      aria-label={eyebrow}
      data-mari-part="guide-card"
      data-guide-quest={quest.id}
    >
      <div className="mari-guide-card__head">
        <img src={FEATURE_TIP_FACE} alt="" className="mari-guide-card__face" aria-hidden="true" />
        <div className="mari-guide-card__titles">
          <p className="mari-guide-card__eyebrow">{eyebrow}</p>
          <p className="mari-guide-card__title">{t(guideQuestKey(quest.id, "title"), quest.title)}</p>
        </div>
        <button
          type="button"
          className="mari-guide-card__close"
          onClick={onClose}
          aria-label={
            basics ? t("guideQuests.card.stop", "Stop the tour for now") : t("guideQuests.card.close", "Close")
          }
          title={basics ? t("guideQuests.card.stop", "Stop the tour for now") : t("guideQuests.card.close", "Close")}
        >
          <X size="0.95rem" aria-hidden="true" />
        </button>
      </div>
      <p className="mari-guide-card__note">{t(guideQuestKey(quest.id, "note"), quest.note)}</p>
      <p className="mari-guide-card__more">
        <strong>
          {basics ? t("guideQuests.card.compare", "Think of it like this:") : t("guideQuests.card.try", "Try it:")}
        </strong>{" "}
        {t(guideQuestKey(quest.id, "more"), quest.more)}
      </p>
      {quest.special === "setup" && connected ? (
        <p className="mari-guide-card__status">
          <Check size="0.85rem" aria-hidden="true" />{" "}
          {t("guideQuests.card.connected", "You have a working connection.")}
        </p>
      ) : null}
      {quest.special === "mari" && !connected ? (
        <p className="mari-guide-card__status is-warning">
          {t("guideQuests.card.mariNeedsConnection", "She needs a working connection before she can answer.")}
        </p>
      ) : null}
      <div className="mari-guide-card__actions">
        {quest.special === "setup" ? (
          <>
            {!connected ? (
              <button type="button" className="mari-guide-card__button" onClick={openConnections}>
                {t("guideQuests.card.addConnection", "Add a connection")}
              </button>
            ) : null}
            <button type="button" className="mari-guide-card__button is-primary" onClick={gotIt}>
              {connected ? t("guideQuests.card.next", "Next") : t("guideQuests.card.notNow", "Not now")}
            </button>
          </>
        ) : quest.special === "mari" ? (
          <>
            {!connected ? (
              <button type="button" className="mari-guide-card__button" onClick={() => startGuideQuest("AB11")}>
                {t("guideQuests.card.setUpFirst", "Set one up")}
              </button>
            ) : null}
            <button type="button" className="mari-guide-card__button is-primary" onClick={meetMari}>
              {t("guideQuests.card.meetMari", "Meet Professor Mari")}
            </button>
          </>
        ) : (
          <>
            {quest.show ? (
              <button
                type="button"
                className="mari-guide-card__button"
                onClick={() => {
                  if (runStep(quest.show!)) onClose();
                }}
              >
                {t("thingsToTry.showMe", "Show me")}
              </button>
            ) : null}
            <button type="button" className="mari-guide-card__button is-primary" onClick={gotIt}>
              {t("guideQuests.card.gotIt", "Got it")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Mount inside a docs viewer: shows the active quest's card when `path` is its guide. */
export function GuideCardMount({
  container,
  path,
  revision,
}: {
  container: HTMLElement | null;
  path: string | null;
  revision: unknown;
}) {
  const questId = useGuideCardStore((s) => s.questId);
  const startedAt = useGuideCardStore((s) => s.startedAt);
  const close = useGuideCardStore((s) => s.close);
  const quest = questId ? (GUIDE_QUEST_BY_ID.get(questId) ?? null) : null;
  const [host, setHost] = useState<HTMLElement | null>(null);
  const active = !!quest && !!container && !!revision && quest.guide === path;

  useEffect(() => {
    if (!active || !quest || !container) {
      setHost(null);
      return;
    }
    const { slot, target, undo } = placeCard(container, quest);
    setHost(slot);
    // After the card renders: the passage near the top (under its heading), the card right under it.
    // A passage at the top of a guide (no heading): show the guide's title too.
    const scrollTo = quest.heading ? target : (container.querySelector<HTMLElement>("h1") ?? target);
    const frame = window.requestAnimationFrame(() => {
      scrollTo.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      undo();
    };
  }, [active, container, quest, startedAt]);

  if (!active || !quest || !host) return null;
  return createPortal(<CardBody quest={quest} onClose={close} />, host);
}
