import { Fragment } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";

import type { OmnibarUnderstoodLine as Line } from "../../../lib/omnibar-results";
import { resolveOmnibarRowVisual, type OmnibarRowVisualContext } from "../../../lib/omnibar-row-visual";
import { ResultTypeIcon } from "../../command-center/ResultTypeIcon";

// Splits the translated sentence around the chips without HTML in the catalog.
const NAME = "⁣name⁣";
const CHAT = "⁣chat⁣";

function Chip({ rowId, label, context }: { rowId: string; label: string; context: OmnibarRowVisualContext }) {
  const record = context.recordById.get(rowId);
  const visual = record ? resolveOmnibarRowVisual(record, context) : null;
  const src = visual?.src ?? visual?.faces?.[0]?.src;
  const crop = visual?.src ? visual.avatarCropStyle : visual?.faces?.[0]?.avatarCropStyle;
  return (
    <span className="inline-flex min-w-0 shrink items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] py-px pl-0.5 pr-2 font-semibold text-[var(--foreground)]">
      {src ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={crop}
          className="size-4 shrink-0 rounded-full object-cover"
        />
      ) : (
        <ResultTypeIcon type={visual?.type} icon={visual?.icon} glyph className="ml-1 size-3" />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * Slice 79b: one quiet line under the input that repeats what a verb sentence
 * resolved to, with the records' faces: "Add [Eliza] to [Tavern Night]". The
 * field stays plain text. The live region is always mounted so a screen reader
 * hears the line when it appears; the line itself opens with a short height
 * animation instead of pushing the list in one jump.
 */
export function OmnibarUnderstoodLine({ line, context }: { line: Line | null; context: OmnibarRowVisualContext }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const sentence = line
    ? line.kind === "start-chat"
      ? t("commandCenter.understood.startChat", "Start a chat with {{name}}", { name: NAME })
      : line.kind === "add"
        ? t("commandCenter.understood.add", "Add {{name}} to {{chat}}", { name: NAME, chat: CHAT })
        : t("commandCenter.understood.remove", "Remove {{name}} from {{chat}}", { name: NAME, chat: CHAT })
    : "";
  return (
    <div aria-live="polite" data-component="GlobalOmnibar.UnderstoodLine">
      <AnimatePresence initial={false}>
        {line ? (
          <motion.p
            key="understood"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }}
            className="overflow-hidden border-b border-[var(--border)]"
          >
            <span className="flex h-8 min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap px-4 text-xs text-[var(--muted-foreground)]">
              {sentence.split(/(⁣name⁣|⁣chat⁣)/u).map((part, index) =>
                part === NAME ? (
                  <Chip key={index} rowId={line.recordRowId} label={line.name} context={context} />
                ) : part === CHAT && line.chatRowId && line.chatName ? (
                  <Chip key={index} rowId={line.chatRowId} label={line.chatName} context={context} />
                ) : part.trim() ? (
                  <span key={index} className="shrink-0">
                    {part.trim()}
                  </span>
                ) : (
                  <Fragment key={index} />
                ),
              )}
            </span>
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
