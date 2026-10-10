import { ProfessorMariAskContext, MariWorkspaceStatus } from "@marinara-engine/shared";
import { type LucideIcon, Sparkles, FileText, ChevronRight, Plus, Link, Lock, ShieldOff } from "lucide-react";
import { Dispatch, SetStateAction, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MariWorkspaceContextItem } from "../../../hooks/use-mari-workspace-context";
import { ResultType, resourceResultType } from "../../../lib/command-icons";
import { ProfessorMariContextBudget, formatCompactTokenCount } from "../../../lib/professor-mari-context-budget";
import {
  ProfessorMariContextFacet,
  professorMariFacetSendsContentLater,
} from "../../../lib/professor-mari-presentation";
import { ProfessorMariWorkspaceDestination } from "../../../lib/professor-mari-workspace-navigation";
import { cn } from "../../../lib/utils";
import { ResultTypeIcon } from "../../command-center/ResultTypeIcon";
import { facetIcon } from "../MariContextFacetChips";
import { MARI_SIDE_ROW_CLASS, MariSidePanelHeader } from "../MariPanelControls";
import { ProfessorMariConnectionOption, SEES_KICKER_CLASS } from "./mari-chat-helpers";

/** M7: the "What Mari sees" side panel: what goes with the next message, what is always on, and how she works. */
type MariSeesPanelProps = {
  attachedContext: MariWorkspaceContextItem[] | undefined;
  contextBudget: ProfessorMariContextBudget | null;
  effectiveConnection: ProfessorMariConnectionOption;
  handleOpenHistoryPicker: () => Promise<void>;
  handoffContext: ProfessorMariAskContext | null;
  oneShotContext: ProfessorMariAskContext | null;
  oneShotContextFacets: ProfessorMariContextFacet[];
  removeOneShotFacet: (facet: ProfessorMariContextFacet) => void;
  selectedContextId: string | null;
  setConnectionMenuOpen: Dispatch<SetStateAction<boolean>>;
  setHandoffContext: Dispatch<SetStateAction<ProfessorMariAskContext | null>>;
  setSelectedContextId: Dispatch<SetStateAction<string | null>>;
  setWorkspaceDestination: Dispatch<SetStateAction<ProfessorMariWorkspaceDestination>>;
  showContextUsage: boolean;
  workspaceStatus: MariWorkspaceStatus | null;
};

export function MariSeesPanel({
  attachedContext,
  contextBudget,
  effectiveConnection,
  handleOpenHistoryPicker,
  handoffContext,
  oneShotContext,
  oneShotContextFacets,
  removeOneShotFacet,
  selectedContextId,
  setConnectionMenuOpen,
  setHandoffContext,
  setSelectedContextId,
  setWorkspaceDestination,
  showContextUsage,
  workspaceStatus,
}: MariSeesPanelProps) {
  const { t: localizeUi } = useTranslation();
  const sandboxAvailable = workspaceStatus?.shellSandbox.available ?? null;
  const renderSeesRow = ({
    key,
    Icon,
    type,
    title,
    meta,
    onRemove,
    action,
  }: {
    key: string;
    Icon?: LucideIcon;
    /** Q6: a row that names a thing shows that kind's icon. */
    type?: ResultType;
    title: string;
    meta?: string;
    onRemove?: () => void;
    action?: ReactNode;
  }) => (
    <div key={key} className={MARI_SIDE_ROW_CLASS}>
      <ResultTypeIcon type={type} icon={Icon} glyph className="size-[0.85rem] text-[var(--muted-foreground)]" />
      <span className="mari-edit__text">
        <span className="mari-edit__title">{title}</span>
        {meta ? <span className="text-xs text-[var(--muted-foreground)]">{meta}</span> : null}
      </span>
      {onRemove ? (
        <button
          type="button"
          className="mari-link"
          onClick={onRemove}
          aria-label={localizeUi("ui.chat.homeprofessormarichat.awareOfRemoveFacet", { text: title })}
        >
          {localizeUi("ui.chat.homeprofessormarichat.contextViewerRemove")}
        </button>
      ) : null}
      {action}
    </div>
  );
  return (
    <>
      <MariSidePanelHeader
        title={
          (selectedContextId ? attachedContext?.find((item) => item.id === selectedContextId)?.label : undefined) ??
          localizeUi("ui.chat.homeprofessormarichat.awareOf")
        }
        hint={localizeUi("ui.chat.homeprofessormarichat.awareOfHint")}
        onClose={() => setWorkspaceDestination("chat")}
        closeLabel={localizeUi("ui.chat.homeprofessormarichat.awareOfClose")}
        onBack={selectedContextId ? () => setSelectedContextId(null) : undefined}
        backLabel={selectedContextId ? localizeUi("ui.chat.homeprofessormarichat.awareOfBack") : undefined}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
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
          <div className="mx-auto max-w-2xl space-y-4" data-component="HomeProfessorMariChat.WhatMariSees">
            <section className="space-y-1.5" data-group="next">
              <h4 className={SEES_KICKER_CLASS}>{localizeUi("ui.chat.homeprofessormarichat.awareOfNextMessage")}</h4>
              <div className="mari-edit">
                {oneShotContextFacets.length > 0 ? (
                  oneShotContextFacets.map((facet) =>
                    renderSeesRow({
                      key: facet.kind,
                      Icon: facetIcon(facet),
                      title: facet.text,
                      meta: localizeUi(
                        professorMariFacetSendsContentLater(facet.kind)
                          ? "ui.chat.homeprofessormarichat.awareOfNameOnly"
                          : "ui.chat.homeprofessormarichat.awareOfGoesNext",
                      ),
                      onRemove: () => removeOneShotFacet(facet),
                    }),
                  )
                ) : oneShotContext?.query ? (
                  renderSeesRow({
                    key: "query",
                    Icon: Sparkles,
                    title: localizeUi("ui.chat.homeprofessormarichat.searchContextValue1", {
                      value1: oneShotContext.query,
                    }),
                    meta: localizeUi("ui.chat.homeprofessormarichat.awareOfGoesNext"),
                    onRemove: () => setHandoffContext(null),
                  })
                ) : (
                  <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.homeprofessormarichat.awareOfNextEmpty")}
                  </p>
                )}
              </div>
            </section>
            <section className="space-y-1.5" data-group="always">
              <h4 className={SEES_KICKER_CLASS}>{localizeUi("ui.chat.homeprofessormarichat.awareOfAlways")}</h4>
              <div className="mari-edit">
                {handoffContext && !oneShotContext
                  ? renderSeesRow({
                      key: "focus",
                      ...(handoffContext.resource
                        ? { type: resourceResultType(handoffContext.resource.kind) }
                        : { Icon: Sparkles }),
                      title: handoffContext.resource?.label ?? handoffContext.resource?.kind ?? handoffContext.source,
                      meta: localizeUi("ui.chat.homeprofessormarichat.awareOfFocusMeta"),
                      onRemove: () => setHandoffContext(null),
                    })
                  : null}
                {attachedContext?.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedContextId(item.id)}
                    className={cn(MARI_SIDE_ROW_CLASS, "w-full text-left hover:bg-[var(--mari-hover)]")}
                  >
                    <FileText size="0.85rem" className="shrink-0 text-[var(--muted-foreground)]" />
                    <span className="mari-edit__text">
                      <span className="mari-edit__title">{item.label}</span>
                      <span className="mari-edit__meta">
                        {localizeUi("ui.chat.homeprofessormarichat.attachedTokenEstimate", {
                          count: formatCompactTokenCount(item.tokenEstimate),
                        })}
                      </span>
                    </span>
                    <ChevronRight size="0.8rem" className="text-[var(--muted-foreground)]" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleOpenHistoryPicker()}
                  className={cn(
                    MARI_SIDE_ROW_CLASS,
                    "min-h-11 w-full text-left text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--mari-hover)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Plus size="0.85rem" className="shrink-0" aria-hidden="true" />
                  {localizeUi("ui.chat.homeprofessormarichat.awareOfAttach")}
                </button>
              </div>
            </section>
            <section className="space-y-1.5" data-group="how">
              <h4 className={SEES_KICKER_CLASS}>{localizeUi("ui.chat.homeprofessormarichat.awareOfHowSheWorks")}</h4>
              <div className="mari-edit">
                {renderSeesRow({
                  key: "connection",
                  Icon: Link,
                  title:
                    workspaceStatus?.connection?.name ??
                    effectiveConnection?.name ??
                    localizeUi("ui.chat.homeprofessormarichat.missingConnection"),
                  meta:
                    showContextUsage && contextBudget
                      ? localizeUi("ui.chat.homeprofessormarichat.awareOfContextUse", {
                          used: formatCompactTokenCount(contextBudget.usedTokens),
                          maximum: formatCompactTokenCount(contextBudget.maxTokens),
                        })
                      : localizeUi("ui.chat.homeprofessormarichat.awareOfModelMeta"),
                  action: (
                    <button
                      type="button"
                      className="mari-link"
                      onClick={() => {
                        setWorkspaceDestination("chat");
                        setConnectionMenuOpen(true);
                      }}
                    >
                      {localizeUi("ui.chat.homeprofessormarichat.awareOfChangeModel")}
                    </button>
                  ),
                })}
                {renderSeesRow({
                  key: "sandbox",
                  Icon: sandboxAvailable === false ? ShieldOff : Lock,
                  title: localizeUi(
                    sandboxAvailable === false
                      ? "ui.chat.homeprofessormarichat.sandboxUnavailable"
                      : sandboxAvailable === null
                        ? "ui.chat.homeprofessormarichat.sandboxUnknown"
                        : "ui.chat.homeprofessormarichat.sandboxAvailable",
                  ),
                  meta:
                    sandboxAvailable === null
                      ? undefined
                      : localizeUi(
                          sandboxAvailable
                            ? "ui.chat.homeprofessormarichat.awareOfSandboxOn"
                            : "ui.chat.homeprofessormarichat.awareOfSandboxOff",
                        ),
                })}
              </div>
            </section>
            <p className="px-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.homeprofessormarichat.awareOfPrivacy")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
