// ──────────────────────────────────────────────
// Try mode: a chat can run any model of a Connection's catalog without saving it (maintainer decision 25: plain
// settings, the catalog's limits). While it does, a small note over the composer says so and offers Star (keep it
// near the top), Tune (save it and open its settings) and Undo (back to the chat's last model, or Main).
// Nothing is saved until Star or Tune.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, Star, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { isChatProvider, readChatModelOverride, readChatRecentModels } from "@marinara-engine/shared";
import { useChat, useSetChatModel } from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { starAnchorOf, useHiddenModelIds, useModelStar } from "../../hooks/use-model-star";
import { useUIStore } from "../../stores/ui.store";
import { openLibrarySection } from "../overhaul/library-navigation";

type Row = {
  id: string;
  accountId?: string | null;
  model?: string | null;
  provider?: string | null;
  createdAt?: string | null;
  pinnedModels?: unknown;
};

/** Notes closed this session, per chat and model: closing one never hides a later try. */
const dismissed = new Set<string>();

export function TryingModelNote({ chatId }: { chatId: string | null }) {
  const { t } = useTranslation();
  const { data: chat } = useChat(chatId);
  const { data: connections } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const hiddenIds = useHiddenModelIds();
  const modelStar = useModelStar();
  const setChatModel = useSetChatModel();
  const [busy, setBusy] = useState(false);
  const [, rerender] = useState(0);

  const trying = useMemo(() => {
    if (!chat) return null;
    const override = readChatModelOverride(chat);
    if (!override) return null;
    const rows = ((connections ?? []) as Row[]).filter((row) => !hiddenIds.has(row.id));
    const carrier = rows.find((row) => row.id === override.connectionId);
    if (!carrier?.accountId) return null;
    // A model saved under the Connection (starred or tuned) is no try: the chat just uses it.
    const saved = rows.some(
      (row) => row.accountId === carrier.accountId && row.model === override.model && isChatProvider(row.provider),
    );
    if (saved) return null;
    const accountRows = rows.filter((row) => row.accountId === carrier.accountId);
    return {
      override,
      accountId: carrier.accountId,
      anchorId: (starAnchorOf(accountRows) ?? carrier).id,
      account: accounts?.find((account) => account.id === carrier.accountId)?.name ?? "",
    };
  }, [accounts, chat, connections, hiddenIds]);

  if (!chatId || !chat || !trying) return null;
  const key = `${chatId}:${trying.override.model}`;
  if (dismissed.has(key)) return null;
  const label = trying.override.name ?? trying.override.model;

  const keep = async () => {
    const id = await modelStar.star({
      accountId: trying.accountId,
      model: trying.override.model,
      name: trying.override.name,
      maxContext: trying.override.maxContext,
      maxTokensOverride: trying.override.maxTokensOverride,
      anchorId: trying.anchorId,
    });
    // The chat now uses the saved Model, so its settings apply from the next reply on.
    if (id) await setChatModel.mutateAsync({ chatId, connectionId: id });
    return id;
  };
  const run = (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    void action()
      .catch((error) =>
        toast.error(
          t("connections.switcher.pickFailed", { error: error instanceof Error ? error.message : String(error) }),
        ),
      )
      .finally(() => setBusy(false));
  };
  const undo = async () => {
    const current = trying.override;
    const previous = readChatRecentModels(chat).find(
      (choice) => !(choice.connectionId === current.connectionId && (choice.model ?? null) === current.model),
    );
    await setChatModel.mutateAsync(previous ? { chatId, ...previous } : { chatId, connectionId: null });
  };

  return (
    <div className="ov-trying" role="status" data-trying-model>
      <p className="ov-trying__text">
        <b>{t("connections.trying.title", { model: label })}</b>
        <span>
          {trying.account
            ? t("connections.trying.detailOn", { connection: trying.account })
            : t("connections.trying.detail")}
        </span>
      </p>
      <div className="ov-trying__actions">
        <button type="button" className="ov-trying__btn" disabled={busy} onClick={() => run(keep)}>
          <Star size={13} aria-hidden="true" />
          {t("connections.trying.star")}
        </button>
        <button
          type="button"
          className="ov-trying__btn"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const id = await keep();
              if (!id) return;
              openLibrarySection("connections");
              useUIStore.getState().openConnectionDetail(id);
            })
          }
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
          {t("connections.trying.tune")}
        </button>
        <button type="button" className="ov-trying__btn" disabled={busy} onClick={() => run(undo)}>
          <Undo2 size={13} aria-hidden="true" />
          {t("connections.switcher.undo")}
        </button>
        <button
          type="button"
          className="ov-trying__close"
          aria-label={t("common.close")}
          onClick={() => {
            dismissed.add(key);
            rerender((value) => value + 1);
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
