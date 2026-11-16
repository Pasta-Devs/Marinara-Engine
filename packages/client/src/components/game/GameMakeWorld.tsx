// ──────────────────────────────────────────────
// A world for a game made without one (worldgen W12): the setup wizard's own kit and world choices, in
// the journal, saved to the game only when the player asks. The world starts now; the game's past turns,
// map and people are left as they are.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { parseWorldKit, type WorldKit, type WorldKitInput } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { chatKeys } from "../../hooks/use-chats";
import { GameSetupWorldKitChooser, type WorldKitWriteRequest } from "./GameSetupWorldKitChooser";
import {
  GameSetupWorldChooser,
  worldDraftConfig,
  worldDraftFromWorld,
  type WorldDraft,
  type WorldWriteRequest,
} from "./GameSetupWorldChooser";
import { Spinner } from "../ui/Spinner";

export function GameMakeWorld({
  chatId,
  request,
  ownKit,
  onClose,
}: {
  chatId: string;
  /** What the model writes for: the game's own setting and connection; null without a connection. */
  request: (WorldKitWriteRequest & WorldWriteRequest) | null;
  /** The setting kit the game was made with, when it has one: the world is made in it, and its money,
   *  elements and art stay the game's. */
  ownKit: WorldKit | null;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const [kit, setKit] = useState<WorldKitInput | null>(ownKit);
  const [draft, setDraft] = useState<WorldDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { data: lorebooksList } = useLorebooks();
  const lorebooks = useMemo(
    () =>
      ((lorebooksList ?? []) as Array<{ id: string; name: string }>).map((book) => ({ id: book.id, name: book.name })),
    [lorebooksList],
  );
  const checkedKit = kit ? parseWorldKit(kit) : null;
  const config = checkedKit?.ok && draft ? worldDraftConfig(checkedKit.kit, draft) : null;

  const save = async () => {
    if (!checkedKit?.ok || !config?.ok) return;
    setSaving(true);
    setFailed(null);
    try {
      await api.post(`/game/${chatId}/world`, {
        worldKit: checkedKit.kit,
        world: config.world,
        ...(config.story ? { story: config.story } : {}),
        ...(config.snapshot ? { worldSnapshot: config.snapshot } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      toast.success(localizeUi("ui.game.makeworld.saved"));
      onClose();
    } catch (error) {
      setFailed(error instanceof Error && error.message ? error.message : localizeUi("ui.game.makeworld.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-full w-full max-w-2xl flex-col gap-3 rounded-xl border border-white/15 bg-[var(--background)] p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{localizeUi("ui.game.makeworld.title")}</h3>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label={localizeUi("ui.game.makeworld.cancel")}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{localizeUi("ui.game.makeworld.help")}</p>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {ownKit ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.game.makeworld.ownKit", { kit: ownKit.label })}
          </p>
        ) : (
          <GameSetupWorldKitChooser
            kit={kit}
            onChange={(next) => {
              setKit(next);
              setFailed(null);
            }}
            onImportWorld={(importedKit, world, story, snapshot) => {
              setKit(importedKit);
              setDraft(worldDraftFromWorld(world, story, snapshot));
            }}
            writeRequest={request}
          />
        )}
        {checkedKit?.ok && (
          <GameSetupWorldChooser
            kit={checkedKit.kit}
            draft={draft}
            onChange={setDraft}
            lorebooks={lorebooks}
            request={request}
          />
        )}
      </div>
      {failed && <p className="text-xs text-[var(--destructive)]">{failed}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          {localizeUi("ui.game.makeworld.cancel")}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !config?.ok}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-50"
        >
          {saving ? <Spinner size="sm" /> : <Check size={13} />}
          {localizeUi("ui.game.makeworld.save")}
        </button>
      </div>
    </div>
  );
}
