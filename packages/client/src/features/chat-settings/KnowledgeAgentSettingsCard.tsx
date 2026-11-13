import type { KnowledgeAgentType } from "./lib/knowledge-agent-settings";
import type { Lorebook, KnowledgeAgentSourceSettings } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useRef, useMemo } from "react";
import { useKnowledgeSources, useUploadKnowledgeSource } from "../../hooks/use-knowledge-sources";
import { useEntriesAcrossLorebooks } from "../../hooks/use-lorebooks";
import { AgentSettingsCard, AgentSettingsToggle } from "../../components/chat/AgentSettingsControls";
import { renderRoleplayAgentMenuIcon } from "./roleplay-agent-menu-icon";
import { cn } from "../../lib/utils";
import { LorebookListField } from "../../components/ui/LibraryPickers";
import { Check, Loader2, Upload } from "lucide-react";
import { showAlertDialog } from "../../lib/app-dialogs";

export function KnowledgeAgentSettingsCard({
  attachment,
  id,
  agentType,
  title,
  description,
  lorebooks,
  settings,
  order,
  onChange,
  onRemove,
}: {
  attachment?: React.ReactNode;
  id?: string;
  agentType: KnowledgeAgentType;
  title: string;
  description: string;
  lorebooks: Lorebook[];
  settings: KnowledgeAgentSourceSettings;
  order?: number;
  onChange: (patch: Partial<KnowledgeAgentSourceSettings>) => void;
  onRemove?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const knowledgeSourcesQuery = useKnowledgeSources();
  const uploadSource = useUploadKnowledgeSource();
  const sourceLorebookIds = settings.sourceLorebookIds ?? [];
  const sourceFileIds = settings.sourceFileIds ?? [];
  const isRetrieval = agentType === "knowledge-retrieval";
  const {
    entries: routerSourceEntries,
    isLoading: routerEntriesLoading,
    isError: routerEntriesError,
  } = useEntriesAcrossLorebooks(agentType === "knowledge-router" ? sourceLorebookIds : []);
  const descriptionCoverage = useMemo(() => {
    if (agentType !== "knowledge-router" || sourceLorebookIds.length === 0 || !routerSourceEntries) return null;
    const total = routerSourceEntries.length;
    const withDescription = routerSourceEntries.filter((entry) => entry.description?.trim().length > 0).length;
    return { total, withDescription, ratio: total > 0 ? withDescription / total : 0 };
  }, [agentType, routerSourceEntries, sourceLorebookIds.length]);

  const toggleLorebook = (lorebookId: string) => {
    onChange({
      sourceLorebookIds: sourceLorebookIds.includes(lorebookId)
        ? sourceLorebookIds.filter((id) => id !== lorebookId)
        : [...sourceLorebookIds, lorebookId],
    });
  };

  const toggleSourceFile = (sourceId: string) => {
    onChange({
      sourceFileIds: sourceFileIds.includes(sourceId)
        ? sourceFileIds.filter((id) => id !== sourceId)
        : [...sourceFileIds, sourceId],
    });
  };

  return (
    <AgentSettingsCard
      id={id}
      icon={renderRoleplayAgentMenuIcon(agentType)}
      title={title}
      description={description}
      order={order}
      onRemove={onRemove}
    >
      {attachment}
      <AgentSettingsToggle
        label={localizeUi("ui.chat.knowledgesourcefields.useChatActiveLorebooks")}
        description={
          sourceLorebookIds.length > 0
            ? localizeUi("ui.chat.knowledgesourcefields.fixedSourceLorebooksAreSelectedBelowSoTheyOverride")
            : localizeUi("ui.chat.knowledgesourcefields.useTheLorebooksCurrentlyActiveForThisChatWhen")
        }
        enabled={settings.useChatActiveLorebooks !== false}
        onToggle={() => onChange({ useChatActiveLorebooks: settings.useChatActiveLorebooks === false })}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.knowledgeagentsettingscard.fixedSourceLorebooks")}
          </span>
          {agentType === "knowledge-router" &&
            descriptionCoverage &&
            !routerEntriesLoading &&
            !routerEntriesError &&
            (descriptionCoverage.total === 0 ? (
              <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.agents.agenteditor.noEntriesYet")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[0.5625rem] text-[var(--muted-foreground)]">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    descriptionCoverage.ratio >= 0.75
                      ? "bg-emerald-400"
                      : descriptionCoverage.ratio >= 0.25
                        ? "bg-amber-400"
                        : "bg-red-400",
                  )}
                />
                {Math.round(descriptionCoverage.ratio * 100)}
                {localizeUi("ui.agents.agenteditor.described")}
              </span>
            ))}
        </div>
        {lorebooks.length > 0 ? (
          <LorebookListField
            lorebooks={lorebooks}
            selectedIds={sourceLorebookIds}
            onToggle={toggleLorebook}
            onAdd={(ids) =>
              onChange({
                sourceLorebookIds: [...sourceLorebookIds, ...ids.filter((id) => !sourceLorebookIds.includes(id))],
              })
            }
            ariaLabel={localizeUi("ui.chat.knowledgeagentsettingscard.fixedSourceLorebooks")}
            triggerClassName="mari-chrome-field min-h-10 w-full min-w-0 rounded-md px-2.5 py-2 text-base md:text-xs"
          />
        ) : (
          <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            {localizeUi("ui.agents.agenteditor.noLorebooksAvailable")}
          </p>
        )}
        {agentType === "knowledge-router" &&
          (sourceLorebookIds.length > 0 || settings.useChatActiveLorebooks !== false) && (
            <p className="text-[0.625rem] italic text-[var(--muted-foreground)]">
              {localizeUi(
                "ui.chat.knowledgeagentsettingscard.entryDescriptionsHelpRouterChoosePreciselyEntriesWithoutDescriptions",
              )}
            </p>
          )}
      </div>

      {isRetrieval && (
        <div className="space-y-1.5">
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.knowledgeagentsettingscard.uploadedFiles")}
          </span>
          {knowledgeSourcesQuery.data?.length ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-2">
              {knowledgeSourcesQuery.data.map((source) => {
                const selected = sourceFileIds.includes(source.id);
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => toggleSourceFile(source.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all",
                      selected
                        ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] text-[var(--foreground)] ring-1 ring-transparent hover:bg-[var(--accent)]",
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                        selected
                          ? "border-[var(--primary)]/60 bg-[var(--primary)]/20"
                          : "border-[var(--border)] bg-[var(--background)]",
                      )}
                    >
                      {selected && <Check size="0.625rem" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{source.originalName}</span>
                      <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                        {(source.size / 1024).toFixed(1)} {localizeUi("ui.agents.agenteditor.kb")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {localizeUi("ui.chat.knowledgesourcefields.noUploadedKnowledgeFilesYet")}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.xml,.html,.htm,.log,.yaml,.yml,.tsv,.pdf"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const uploaded = await uploadSource.mutateAsync(file);
                onChange({ sourceFileIds: Array.from(new Set([...sourceFileIds, uploaded.id])) });
              } catch (error) {
                await showAlertDialog({
                  title: "Couldn’t Upload File",
                  message: error instanceof Error ? error.message : "The file could not be uploaded.",
                });
              } finally {
                event.target.value = "";
              }
            }}
          />
          <button
            type="button"
            disabled={uploadSource.isPending}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-all",
              uploadSource.isPending
                ? "cursor-wait border-[var(--border)] text-[var(--muted-foreground)]/60"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            {uploadSource.isPending ? (
              <>
                <Loader2 size="0.8125rem" className="animate-spin" />
                {localizeUi("ui.noodle.noodleprofilesurface.uploading")}
              </>
            ) : (
              <>
                <Upload size="0.8125rem" />
                {localizeUi("ui.chat.knowledgesourcefields.uploadFile")}
              </>
            )}
          </button>
        </div>
      )}

      {(sourceLorebookIds.length > 0 || sourceFileIds.length > 0) && (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {[
            sourceLorebookIds.length > 0
              ? `${sourceLorebookIds.length} lorebook${sourceLorebookIds.length === 1 ? "" : "s"}`
              : null,
            sourceFileIds.length > 0 ? `${sourceFileIds.length} file${sourceFileIds.length === 1 ? "" : "s"}` : null,
          ]
            .filter(Boolean)
            .join(", ")}{" "}
          {localizeUi("ui.chat.knowledgeagentsettingscard.selectedForThisChat")}
        </p>
      )}
    </AgentSettingsCard>
  );
}
