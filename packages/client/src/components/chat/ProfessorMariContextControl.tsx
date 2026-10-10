import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Check, FileText, Sparkles, UserRound, X } from "lucide-react";
import type { ProfessorMariAskContext } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import type { CharacterPreviewModel } from "../../lib/character-preview";
import type { LorebookPreviewModel } from "../../lib/lorebook-preview";
import { professorMariContextCount, professorMariContextFacets } from "../../lib/professor-mari-presentation";
import { cn } from "../../lib/utils";
import { CharacterSubject } from "../characters/CharacterSubject";
import { CommandCenterMedia } from "../command-center/CommandCenterMedia";
import { LorebookSubject } from "../lorebooks/LorebookSubject";
import { MariContextFacetChips } from "./MariContextFacetChips";

interface Props {
  context: ProfessorMariAskContext | null;
  attachedContextCount: number;
  onOpen: () => void;
  onRemoveFocus: () => void;
  onViewAttachedContext: () => void;
  character?: CharacterPreviewModel | null;
  lorebook?: LorebookPreviewModel | null;
}

type PanelPosition = { top: number; right: number };

const CAPABILITY_LABELS: Record<ProfessorMariAskContext["capability"], { key: string; fallback: string }> = {
  explain: { key: "mari.context.capability.explain", fallback: "Explain" },
  recommend: { key: "mari.context.capability.recommend", fallback: "Recommend" },
  create: { key: "mari.context.capability.create", fallback: "Create" },
  edit: { key: "mari.context.capability.edit", fallback: "Edit" },
  repair: { key: "mari.context.capability.repair", fallback: "Repair" },
  navigate: { key: "mari.context.capability.navigate", fallback: "Navigate" },
};

export function ProfessorMariContextControl({
  context,
  attachedContextCount,
  onOpen,
  onRemoveFocus,
  onViewAttachedContext,
  character,
  lorebook,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  );
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const panelMounted = mobile || position !== null;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTriggerFocusRef = useRef(true);
  const panelId = useId();
  const titleId = useId();
  const focusType = context?.field
    ? t("ui.chat.homeprofessormarichat.contextControlField")
    : context?.resource?.kind === "chat"
      ? t("ui.chat.homeprofessormarichat.contextControlChat")
      : t("ui.chat.homeprofessormarichat.contextControlResource");
  const focusLabel = context?.resource?.label ?? context?.resource?.kind ?? context?.source;
  const capabilityLabel = context
    ? t(CAPABILITY_LABELS[context.capability].key, CAPABILITY_LABELS[context.capability].fallback)
    : "";
  const showCapability = Boolean(context && (context.query || context.field || context.error || context.action));
  const relatedCount = context?.relatedResources?.length ?? 0;
  const contextFacets = professorMariContextFacets(context);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!open || mobile) return;
    const update = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const panelHeight = Math.min(448, Math.max(176, window.innerHeight * 0.8));
      const top =
        anchor.bottom + 8 + panelHeight <= window.innerHeight
          ? anchor.bottom + 8
          : Math.max(8, anchor.top - panelHeight - 8);
      setPosition({ top, right: Math.max(8, window.innerWidth - anchor.right) });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [mobile, open]);

  useEffect(() => {
    if (!open) return;
    const trigger = buttonRef.current;
    // The desktop panel only mounts once `position` is measured, so focus after that.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (buttonRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      if (restoreTriggerFocusRef.current) trigger?.focus();
      restoreTriggerFocusRef.current = true;
    };
  }, [open, panelMounted]);

  const totalCount = professorMariContextCount(attachedContextCount, context);
  const panel = (
    <>
      {mobile && <div className="fixed inset-0 z-[calc(var(--mari-layer-omnibar)+1)] bg-black/50" aria-hidden="true" />}
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal={mobile || undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "fixed z-[calc(var(--mari-layer-omnibar)+2)] flex max-h-[min(28rem,80vh)] flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] text-left shadow-2xl outline-none",
          mobile
            ? "inset-x-2 bottom-[calc(var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))+0.5rem)] rounded-xl"
            : "w-[min(20rem,calc(100vw-1rem))] rounded-lg",
        )}
        style={!mobile && position ? position : undefined}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <Sparkles size="0.8125rem" className="shrink-0 text-[var(--primary)]" />
          <h2 id={titleId} className="min-w-0 flex-1 text-xs font-semibold text-[var(--foreground)]">
            {t("ui.chat.homeprofessormarichat.awareOf")}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label={t("navigation.common.close")}
          >
            <X size="0.875rem" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-3">
          {context ? (
            <div className="rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/8 p-3">
              {character ? (
                <CharacterSubject
                  character={character}
                  label={t("ui.chat.homeprofessormarichat.contextControlWorkingWithCharacter")}
                  className="border-0 bg-transparent p-0"
                />
              ) : lorebook ? (
                <LorebookSubject
                  lorebook={lorebook}
                  label={t("ui.chat.homeprofessormarichat.contextControlWorkingWithLorebook")}
                  className="border-0 bg-transparent p-0"
                />
              ) : (
                <>
                  <p className="text-[0.625rem] font-semibold uppercase text-[var(--muted-foreground)]">
                    {t("ui.chat.homeprofessormarichat.contextControlWorkingWith", { type: focusType })}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">{focusLabel}</p>
                </>
              )}
              {contextFacets.length > 0 && <MariContextFacetChips facets={contextFacets} className="mt-2" />}
              {context.query && (
                <p className="mt-1 line-clamp-3 break-words text-xs text-[var(--muted-foreground)]">
                  {t("ui.chat.homeprofessormarichat.contextControlQuery", { query: context.query })}
                </p>
              )}
              {showCapability && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {t("ui.chat.homeprofessormarichat.contextControlCapability", { capability: capabilityLabel })}
                </p>
              )}
              {context.field && (
                <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                  {t("ui.chat.homeprofessormarichat.contextControlFieldLabel", { field: context.field })}
                </p>
              )}
              {relatedCount > 0 && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {t("ui.chat.homeprofessormarichat.contextControlRelated", { count: relatedCount })}
                </p>
              )}
              {context.error && (
                <p className="mt-1 break-words text-xs text-[var(--destructive)]">
                  {context.error.code
                    ? t("ui.chat.homeprofessormarichat.contextControlErrorWithCode", {
                        code: context.error.code,
                        message: context.error.message,
                      })
                    : context.error.message}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  onRemoveFocus();
                  setOpen(false);
                }}
                className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
              >
                <X size="0.75rem" />
                {t("ui.chat.homeprofessormarichat.contextControlRemoveFocus")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-xs text-[var(--muted-foreground)]">
              <Check size="0.8125rem" className="shrink-0" />
              {t("ui.chat.homeprofessormarichat.contextControlNoFocus")}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              restoreTriggerFocusRef.current = false;
              setOpen(false);
              onViewAttachedContext();
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            <FileText size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
            <span className="min-w-0 flex-1">{t("ui.chat.homeprofessormarichat.contextControlViewDetails")}</span>
            <span className="mari-chrome-muted-badge px-1.5 py-0.5 text-[0.56rem]">{attachedContextCount}</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) onOpen();
          setOpen((current) => !current);
        }}
        className={cn(
          "mari-workspace-destination mari-chrome-accent-text-muted mari-accent-animated",
          context && "text-[var(--primary)]",
        )}
        title={t("ui.chat.homeprofessormarichat.awareOfOpen")}
        aria-label={t("ui.chat.homeprofessormarichat.awareOfOpen")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {character ? (
          <CommandCenterMedia
            size="row"
            role="row"
            icon={UserRound}
            src={character.avatarSrc}
            alt=""
            kind="avatar"
            avatarCropStyle={character.avatarCropStyle}
            className="size-6"
          />
        ) : lorebook ? (
          <CommandCenterMedia
            size="row"
            role="row"
            icon={BookOpen}
            src={lorebook.imageSrc}
            alt=""
            kind="artwork"
            className="size-6"
          />
        ) : (
          <Sparkles size="0.75rem" />
        )}
        <span className="max-w-28 truncate">
          {character?.name ?? lorebook?.name ?? t("ui.chat.homeprofessormarichat.awareOf")}
        </span>
        {totalCount > 0 && <span className="mari-chrome-muted-badge px-1.5 py-0.5 text-[0.56rem]">{totalCount}</span>}
        {context && <span className="sr-only">{t("ui.chat.homeprofessormarichat.contextControlFocused")}</span>}
      </button>
      {open && panelMounted && createPortal(panel, document.body)}
    </>
  );
}
