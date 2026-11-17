import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { useDefaultEmbeddingConnection, useSetDefaultEmbeddingConnection } from "../../hooks/use-connections";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useBuiltinEmbeddingOption } from "./BuiltinEmbeddingDetail";
import { ConnectionSelect } from "./ConnectionSelect";

/**
 * The Embeddings job's Model picker: the embedding source for Models that set none of their own. Offers the
 * catalog's embedding models, the built-in embedding model and the local sidecar once their models are downloaded.
 */
export function EmbeddingDefaultControl({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const current = useDefaultEmbeddingConnection();
  const select = useSetDefaultEmbeddingConnection();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const selectedId = current.data?.connectionId ?? "";
  const builtinEmbedding = useBuiltinEmbeddingOption(selectedId);
  const showSidecar =
    import.meta.env.VITE_MARINARA_LITE !== "true" &&
    (sidecarModelDownloaded || selectedId === LOCAL_SIDECAR_CONNECTION_ID);

  return (
    <ConnectionSelect
      jobKey="embeddings"
      variant="controlled"
      open={open}
      onOpenChange={onOpenChange}
      job={t("connections.picker.job.embeddings")}
      kind="chat"
      embedding
      value={selectedId || null}
      onChange={(id) =>
        void select.mutateAsync(id ?? null).catch(() => toast.error(t("connections.embeddingDefault.saveFailed")))
      }
      defaultLabel={t("connections.embeddingDefault.none")}
      includeLocalSidecar={showSidecar}
      extraOptions={builtinEmbedding ? [builtinEmbedding] : []}
      disabled={select.isPending || current.isPending}
      aria-label={t("connections.embeddingDefault.label")}
    />
  );
}
