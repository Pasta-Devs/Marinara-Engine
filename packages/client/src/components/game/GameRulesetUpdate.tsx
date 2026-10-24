// ──────────────────────────────────────────────
// Game: a newer version of the game's ruleset
//
// An imported ruleset keeps every version it was imported at, and a game plays the one it was
// created on, so an old save keeps its old rules after the ruleset is updated. The Journal says so
// when a newer version is stored, and moves the game onto it when the player asks.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { rulesetRefSchema } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useInstalledRulesets } from "../../hooks/use-capability-packages";
import { chatKeys } from "../../hooks/use-chats";

export function GameRulesetUpdate({ chatId, pin }: { chatId: string; pin: unknown }) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const parsed = pin !== undefined && pin !== null ? rulesetRefSchema.safeParse(pin) : null;
  const ref = parsed?.success ? parsed.data : null;
  const installed = useInstalledRulesets(ref !== null);
  const [moving, setMoving] = useState(false);
  const match = ref
    ? installed.data?.find((entry) => entry.definition.id === ref.id && entry.packageId === ref.packageId)
    : undefined;
  // Only an import keeps older versions; a package's ruleset already plays its newest.
  if (!ref || !match?.versions || match.definition.version <= ref.version) return null;
  const name = match.definition.name;
  const newest = match.definition.version;

  const update = async () => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.game.rulesetUpdate.confirmTitle"),
      message: localizeUi("ui.game.rulesetUpdate.confirmMessage", { name, version: newest }),
      confirmLabel: localizeUi("ui.game.rulesetUpdate.update"),
      chatStyle: true,
    });
    if (!confirmed) return;
    setMoving(true);
    try {
      await api.post("/game-rulesets/game-version", { chatId, version: newest });
      await queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      toast.success(localizeUi("ui.game.rulesetUpdate.updated", { name, version: newest }));
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : localizeUi("ui.game.rulesetUpdate.failed"));
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2 text-[0.6875rem] text-white/70">
      <BookOpen size={12} className="shrink-0 text-white/50" />
      <span className="min-w-0 flex-1">
        {localizeUi("ui.game.rulesetUpdate.available", { name, current: ref.version, version: newest })}
      </span>
      <button
        type="button"
        onClick={() => void update()}
        disabled={moving}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 font-medium text-white/85 transition-colors hover:bg-white/15 disabled:opacity-50"
      >
        {moving && <Loader2 size={12} className="animate-spin" />}
        {localizeUi("ui.game.rulesetUpdate.update")}
      </button>
    </div>
  );
}
