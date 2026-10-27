import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { openAddConnection } from "../../lib/add-connection";
import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { useDefaultEmbeddingConnection, useSetDefaultEmbeddingConnection } from "../../hooks/use-connections";
import { createLocalSidecarConnectionOption } from "../../lib/connection-filters";
import { useSidecarStore } from "../../stores/sidecar.store";

type EmbeddingConnectionRow = {
  id: string;
  name: string;
  embeddingModel?: string | null;
  embeddingConnectionId?: string | null;
};

const trimmed = (value: string | null | undefined) => value?.trim() || null;

/**
 * Connections whose own embedding settings win over the default, so it never reaches them.
 * One that borrows the default connection ends up on the same source and is not counted.
 */
function countOwnEmbeddingSettings(connections: EmbeddingConnectionRow[], defaultId: string) {
  return connections.filter((connection) => {
    if (connection.id === defaultId) return false;
    const borrowed = trimmed(connection.embeddingConnectionId);
    return borrowed ? borrowed !== defaultId : trimmed(connection.embeddingModel) !== null;
  }).length;
}

/**
 * Connection defaults > Embeddings: the embedding source for connections that set none of
 * their own. Offers what can embed on its own: connections with an embedding model, and the
 * local sidecar once its model is downloaded.
 */
export function EmbeddingDefaultControl({ connections }: { connections: EmbeddingConnectionRow[] }) {
  const { t } = useTranslation();
  const current = useDefaultEmbeddingConnection();
  const select = useSetDefaultEmbeddingConnection();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const [failed, setFailed] = useState(false);

  const selectedId = current.data?.connectionId ?? "";
  const embedders = connections.filter((connection) => trimmed(connection.embeddingModel));
  // Kept in the list while selected, so a source that stopped qualifying still shows its name.
  const selectedRow =
    selectedId && selectedId !== LOCAL_SIDECAR_CONNECTION_ID && !embedders.some((c) => c.id === selectedId)
      ? connections.find((connection) => connection.id === selectedId)
      : undefined;
  const showSidecar =
    import.meta.env.VITE_MARINARA_LITE !== "true" &&
    (sidecarModelDownloaded || selectedId === LOCAL_SIDECAR_CONNECTION_ID);
  const ownCount = selectedId ? countOwnEmbeddingSettings(connections, selectedId) : 0;

  const change = async (id: string) => {
    setFailed(false);
    try {
      await select.mutateAsync(id || null);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="space-y-2 py-3">
      <label htmlFor="embedding-default" className="block text-xs font-medium">
        {t("connections.embeddingDefault.label")}
      </label>
      <select
        id="embedding-default"
        value={selectedId}
        disabled={select.isPending || current.isPending}
        onChange={(event) => void change(event.target.value)}
        className="w-full min-w-0 rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)]"
      >
        <option value="">{t("connections.embeddingDefault.none")}</option>
        {showSidecar && (
          <option value={LOCAL_SIDECAR_CONNECTION_ID}>
            {createLocalSidecarConnectionOption(sidecarModelDisplayName).name}
          </option>
        )}
        {selectedRow && <option value={selectedRow.id}>{selectedRow.name}</option>}
        {embedders.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.name} ({trimmed(connection.embeddingModel)})
          </option>
        ))}
      </select>
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.embeddingDefault.help")}</p>
      {!showSidecar && import.meta.env.VITE_MARINARA_LITE !== "true" && (
        <button
          type="button"
          onClick={() => openAddConnection({ category: "device", item: "local-model" })}
          className="mari-connection-btn self-start"
        >
          <Download size="0.75rem" aria-hidden />
          {t("connections.builtin.setUp")}
        </button>
      )}
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.embeddingDefault.revectorize")}</p>
      {ownCount > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("connections.embeddingDefault.ownSettings", { count: ownCount })}
        </p>
      )}
      {failed && (
        <p role="status" className="text-xs">
          {t("connections.embeddingDefault.saveFailed")}
        </p>
      )}
    </div>
  );
}
