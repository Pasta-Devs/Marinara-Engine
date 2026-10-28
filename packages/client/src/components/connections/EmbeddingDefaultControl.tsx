import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { ConnectionSelect } from "./ConnectionSelect";
import { openAddConnection } from "../../lib/add-connection";
import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { useDefaultEmbeddingConnection, useSetDefaultEmbeddingConnection } from "../../hooks/use-connections";
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
  const [failed, setFailed] = useState(false);

  const selectedId = current.data?.connectionId ?? "";
  const embedders = connections.filter((connection) => trimmed(connection.embeddingModel));
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
      <ConnectionSelect
        id="embedding-default"
        kind="chat"
        value={selectedId || null}
        onChange={(id) => void change(id ?? "")}
        defaultLabel={t("connections.embeddingDefault.none")}
        includeLocalSidecar={showSidecar}
        rowFilter={(row) => embedders.some((candidate) => candidate.id === row.id)}
        disabled={select.isPending || current.isPending}
        aria-label={t("connections.embeddingDefault.label")}
      />
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
