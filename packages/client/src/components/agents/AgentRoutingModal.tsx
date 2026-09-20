import { useState } from "react";
import type { ChatMetadata } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useUpdateAgent, useUpdateAgentByType } from "../../hooks/use-agents";
import { useConnections, useTestMessage } from "../../hooks/use-connections";
import { useChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import {
  appendLocalSidecarConnectionOption,
  isConnectionFlagTrue,
  type ConnectionProviderLike,
} from "../../lib/connection-filters";
import { Modal } from "../ui/Modal";

export interface AgentRoutingRow {
  id: string;
  type: string;
  name: string;
  description: string;
  connectionId: string | null;
  builtin: boolean;
}

const fieldClass = "mari-chrome-field w-full min-w-0 px-2 py-2 text-xs";

/** Configuration only: never runs an agent or changes its activation in a chat. */
export function AgentRoutingModal({ rows, onClose }: { rows: AgentRoutingRow[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: rawConnections, isLoading, isError } = useConnections();
  const updateAgent = useUpdateAgent();
  const updateByType = useUpdateAgentByType();
  const updateMetadata = useUpdateChatMetadata();
  const testMessage = useTestMessage();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: chat } = useChat(activeChatId);
  const sidecar = useSidecarStore((s) => s.modelDownloaded);
  const sidecarName = useSidecarStore((s) => s.modelDisplayName);
  const localDefault = useSidecarStore((s) => s.config.useAsAgentsDefault);
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConnection, setBulkConnection] = useState("");
  const [saving, setSaving] = useState(false);
  const [probeId, setProbeId] = useState("");
  const [probeResult, setProbeResult] = useState("");
  const connections = (rawConnections ?? []) as (ConnectionProviderLike & { defaultForAgents?: unknown })[];
  const options = appendLocalSidecarConnectionOption(
    connections,
    import.meta.env.VITE_MARINARA_LITE !== "true" && sidecar,
    sidecarName,
  );
  const agentDefault = connections.find((c) => isConnectionFlagTrue(c.defaultForAgents));
  const connectionLabel = (id: string | null | undefined) => {
    const connection = options.find((c) => c.id === id);
    return connection
      ? `${connection.name} · ${connection.model || t("agentRouting.automaticModel")}`
      : t("agentRouting.unavailableConnection", { id });
  };
  const defaultLabel =
    localDefault && sidecar && import.meta.env.VITE_MARINARA_LITE !== "true"
      ? sidecarName || t("agentRouting.localModel")
      : agentDefault
        ? connectionLabel(agentDefault.id)
        : t("agentRouting.chatConnection");
  const visible = rows.filter((row) =>
    `${row.name} ${row.type} ${row.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const meta: Partial<ChatMetadata> = chat?.metadata ?? {};
  const activeTypes = Array.isArray(meta.activeAgentIds) ? new Set(meta.activeAgentIds) : null;

  const renderOptions = (value: string | null, inheritedLabel: string) => (
    <>
      <option value="">{inheritedLabel}</option>
      {value && !options.some((c) => c.id === value) && <option value={value}>{connectionLabel(value)}</option>}
      {options.map((c) => (
        <option key={c.id} value={c.id ?? ""}>
          {connectionLabel(c.id)}
        </option>
      ))}
    </>
  );

  async function assign(targets: AgentRoutingRow[], connectionId: string) {
    if (saving || !targets.length) return;
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        targets.map((row) =>
          row.builtin
            ? updateByType.mutateAsync({ agentType: row.type, connectionId: connectionId || null })
            : updateAgent.mutateAsync({ id: row.id, connectionId: connectionId || null }),
        ),
      );
      const failed = targets.filter((_row, index) => results[index].status === "rejected");
      setSelected(
        (previous) =>
          new Set(
            [...previous].filter((id) => !targets.some((row) => row.id === id) || failed.some((row) => row.id === id)),
          ),
      );
      if (failed.length) toast.error(t("agentRouting.saveFailed", { names: failed.map((row) => row.name).join(", ") }));
      else toast.success(t("agentRouting.saved", { count: targets.length }));
    } finally {
      setSaving(false);
    }
  }

  async function saveChatOverride(
    key: "gameSceneConnectionId" | "roleplayStoryboardPromptConnectionId" | "illustratorPromptConnectionId",
    value: string,
  ) {
    if (!chat || saving) return;
    setSaving(true);
    try {
      // Reset the legacy setup fallback too, otherwise clearing the override still uses it.
      await updateMetadata.mutateAsync({
        id: chat.id,
        [key]: value || null,
        ...(key === "gameSceneConnectionId" && !value && meta.gameSetupConfig?.sceneConnectionId
          ? { gameSetupConfig: { ...meta.gameSetupConfig, sceneConnectionId: null } }
          : {}),
      });
      toast.success(t("agentRouting.chatSaved"));
    } catch {
      toast.error(t("agentRouting.chatSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function probe() {
    if (!probeId || testMessage.isPending) return;
    setProbeResult("");
    try {
      const result = await testMessage.mutateAsync(probeId);
      setProbeResult(
        result.success
          ? t("agentRouting.probeSuccess", { seconds: (result.latencyMs / 1000).toFixed(3), response: result.response })
          : t("agentRouting.probeFailed"),
      );
    } catch (error) {
      setProbeResult(error instanceof Error ? error.message : t("agentRouting.probeFailed"));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("agentRouting.title")}
      width="max-w-5xl"
      mobileFullscreen
      closeDisabled={saving}
    >
      <div className="space-y-5">
        <p className="text-sm text-[var(--muted-foreground)]">{t("agentRouting.description")}</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("agentRouting.default", { connection: defaultLabel })}
        </p>
        {isError && <p role="alert">{t("agentRouting.loadFailed")}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("agentRouting.search")}
            aria-label={t("agentRouting.search")}
            className={`${fieldClass} sm:!w-56`}
          />
          <button
            type="button"
            disabled={saving || !visible.length}
            onClick={() => setSelected(new Set(visible.map((row) => row.id)))}
            className="mari-chrome-control text-xs"
          >
            {t("agentRouting.selectVisible")}
          </button>
          <button
            type="button"
            disabled={saving || !selected.size}
            onClick={() => setSelected(new Set())}
            className="mari-chrome-control text-xs"
          >
            {t("agentRouting.clearSelection")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] p-3">
          <span className="text-xs">{t("agentRouting.selected", { count: selected.size })}</span>
          <select
            aria-label={t("agentRouting.bulkConnection")}
            value={bulkConnection}
            disabled={saving || isLoading || isError}
            onChange={(e) => setBulkConnection(e.target.value)}
            className={`${fieldClass} sm:!w-auto sm:flex-1`}
          >
            {renderOptions(bulkConnection, t("agentRouting.inherit"))}
          </select>
          <button
            type="button"
            onClick={() =>
              void assign(
                rows.filter((row) => selected.has(row.id)),
                bulkConnection,
              )
            }
            disabled={saving || !selected.size || isLoading || isError}
            className="mari-chrome-control mari-chrome-control--primary text-xs"
          >
            {t(saving ? "agentRouting.saving" : "agentRouting.applySelected")}
          </button>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {visible.map((row) => {
            const overrideKey =
              row.type === "storyboard"
                ? chat?.mode === "game"
                  ? "gameSceneConnectionId"
                  : "roleplayStoryboardPromptConnectionId"
                : row.type === "illustrator"
                  ? "illustratorPromptConnectionId"
                  : null;
            const override = overrideKey
              ? meta[overrideKey] ||
                (overrideKey === "gameSceneConnectionId" ? meta.gameSetupConfig?.sceneConnectionId : null)
              : null;
            return (
              <div
                key={row.id}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                data-agent-type={row.type}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={t("agentRouting.selectAgent", { name: row.name })}
                    checked={selected.has(row.id)}
                    disabled={saving}
                    onChange={(e) =>
                      setSelected((previous) => {
                        const next = new Set(previous);
                        if (e.target.checked) next.add(row.id);
                        else next.delete(row.id);
                        return next;
                      })
                    }
                    className="mt-1"
                  />
                  <div className="min-w-0 space-y-1">
                    <h3 className="break-words text-sm font-semibold">{row.name}</h3>
                    {activeTypes && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {t(activeTypes.has(row.type) ? "agentRouting.activeInChat" : "agentRouting.notSelectedInChat")}
                      </p>
                    )}
                    <p className="text-xs text-[var(--muted-foreground)]">{row.description}</p>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        onClose();
                        openAgentDetail(row.builtin ? row.type : row.id);
                      }}
                      className="text-xs text-[var(--primary)] underline underline-offset-4"
                    >
                      {t("agentRouting.details")}
                    </button>
                  </div>
                </div>
                <div className="min-w-0 space-y-2">
                  <label className="block text-xs">
                    {t("agentRouting.connection")}
                    <select
                      value={row.connectionId ?? ""}
                      onChange={(e) => void assign([row], e.target.value)}
                      disabled={saving || isLoading || isError}
                      className={`${fieldClass} mt-1`}
                    >
                      {renderOptions(row.connectionId, t("agentRouting.inherit"))}
                    </select>
                  </label>
                  {overrideKey && chat && (
                    <label className="block text-xs text-[var(--muted-foreground)]">
                      {t("agentRouting.chatOverride", { title: chat.name })}
                      <select
                        value={typeof override === "string" ? override : ""}
                        onChange={(e) => void saveChatOverride(overrideKey, e.target.value)}
                        disabled={saving || isLoading || isError}
                        className={`${fieldClass} mt-1`}
                      >
                        {renderOptions(
                          typeof override === "string" ? override : null,
                          t("agentRouting.noChatOverride"),
                        )}
                      </select>
                    </label>
                  )}
                  {override && (
                    <p className="text-xs text-[var(--muted-foreground)]">{t("agentRouting.overrideWins")}</p>
                  )}
                  {overrideKey && (
                    <p className="text-xs text-[var(--muted-foreground)]">{t("agentRouting.mediaNote")}</p>
                  )}
                </div>
              </div>
            );
          })}
          {!visible.length && <p className="py-5 text-sm">{t("agentRouting.noMatches")}</p>}
        </div>
        <div className="space-y-2 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold">{t("agentRouting.probeTitle")}</h3>
          <p className="text-xs text-[var(--muted-foreground)]">{t("agentRouting.probeHelp")}</p>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label={t("agentRouting.probeConnection")}
              value={probeId}
              onChange={(e) => {
                setProbeId(e.target.value);
                setProbeResult("");
              }}
              disabled={testMessage.isPending || isLoading || isError}
              className={`${fieldClass} sm:!w-auto sm:flex-1`}
            >
              <option value="">{t("agentRouting.chooseConnection")}</option>
              {options
                .filter((c) => !c.isLocalSidecar)
                .map((c) => (
                  <option key={c.id} value={c.id ?? ""}>
                    {connectionLabel(c.id)}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => void probe()}
              disabled={!probeId || testMessage.isPending}
              className="mari-chrome-control text-xs"
            >
              {t(testMessage.isPending ? "agentRouting.testing" : "agentRouting.test")}
            </button>
          </div>
          {probeResult && (
            <p role="status" className="break-words text-xs">
              {probeResult}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
