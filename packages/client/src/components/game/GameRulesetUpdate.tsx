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

export function GameRulesetUpdate({
  chatId,
  pin,
  variant = "journal",
}: {
  chatId: string;
  pin: unknown;
  /** The Journal says something only when a newer version is stored; the setup wizard always names
   *  the rules a game already plays by, since it offers no picker for them (laptop playtest
   *  2026-10-24). */
  variant?: "journal" | "wizard";
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const parsed = pin !== undefined && pin !== null ? rulesetRefSchema.safeParse(pin) : null;
  const ref = parsed?.success ? parsed.data : null;
  const installed = useInstalledRulesets(ref !== null);
  const [moving, setMoving] = useState(false);
  const match = ref
    ? installed.data?.find((entry) => entry.definition.id === ref.id && entry.packageId === ref.packageId)
    : undefined;
  if (!ref || !match) return null;
  // Only an import keeps older versions; a package's ruleset already plays its newest.
  const newer = !!match.versions && match.definition.version > ref.version;
  if (!newer && variant === "journal") return null;
  const name = match.definition.name;
  const newest = match.definition.version;
  const playing = match.versions ? ref.version : newest;

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

  const wizard = variant === "wizard";
  return (
    <div
      className={
        wizard
          ? "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]"
          : "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2 text-[0.6875rem] text-white/70"
      }
    >
      <BookOpen size={12} className={wizard ? "shrink-0" : "shrink-0 text-white/50"} />
      <span className="min-w-0 flex-1">
        {newer
          ? localizeUi("ui.game.rulesetUpdate.available", { name, current: ref.version, version: newest })
          : localizeUi("ui.game.rulesetUpdate.current", { name, version: playing })}
      </span>
      {newer && (
        <button
          type="button"
          onClick={() => void update()}
          disabled={moving}
          className={
            wizard
              ? "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1 font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
              : "inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 font-medium text-white/85 transition-colors hover:bg-white/15 disabled:opacity-50"
          }
        >
          {moving && <Loader2 size={12} className="animate-spin" />}
          {localizeUi("ui.game.rulesetUpdate.update")}
        </button>
      )}
    </div>
  );
}
