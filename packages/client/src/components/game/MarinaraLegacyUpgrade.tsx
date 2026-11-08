// ──────────────────────────────────────────────
// Journal: a Legacy game's way to Classic classes (owner 2026-11-06). Legacy sheets stay for as long as
// the players want them; this moves the party over when they choose to: one class each, the sister tree
// from their temperament, starting at the top of that class. One-way.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Swords } from "lucide-react";
import {
  MARINARA_ARCHETYPES,
  gameCardTemperament,
  guessMarinaraArchetype,
  MARINARA_LEGACY_UPGRADE_LEVEL,
  normalizeCharacterLookupName,
  marinaraTrees,
  type MarinaraArchetype,
  type MarinaraPartyTemperament,
} from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { chatKeys, useChat } from "../../hooks/use-chats";

type GearOffer = { stackId: string; holder: string; from: string; to: string; slot: "weapon" | "armor" };

type Card = Record<string, unknown> & {
  name: string;
  class?: string;
  abilities?: string[];
  shortDescription?: string;
  rpgStats?: { attributes?: Array<{ name?: unknown; value?: unknown }> };
};

function readMeta(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Whether a game's metadata is a Legacy game whose party can move to Classic classes. */
export function marinaraLegacyUpgradeOffered(meta: Record<string, unknown>): boolean {
  const setup = meta.gameSetupConfig as { marinaraClasses?: unknown } | undefined;
  const cards = Array.isArray(meta.gameCharacterCards) ? meta.gameCharacterCards : [];
  return Boolean(setup) && setup?.marinaraClasses !== true && !meta.gameRuleset && cards.length > 0;
}

export function MarinaraLegacyUpgrade({ chatId }: { chatId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: chat } = useChat(chatId);
  const meta = useMemo(() => readMeta(chat?.metadata), [chat?.metadata]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState<Record<string, MarinaraArchetype>>({});
  const cards = useMemo(
    () =>
      (Array.isArray(meta.gameCharacterCards) ? (meta.gameCharacterCards as Record<string, unknown>[]) : []).filter(
        (card): card is Card => typeof card.name === "string" && Boolean(card.name.trim()),
      ),
    [meta.gameCharacterCards],
  );
  const offered = marinaraLegacyUpgradeOffered(meta);
  // What the upgrade offers: the starting tree a library card picked in its Game Mode section (before a
  // guess from the class), and the MRPG piece for each Legacy weapon and armour (owner 2026-11-06).
  const {
    data: preview,
    isError: previewFailed,
    refetch: retryPreview,
  } = useQuery({
    queryKey: ["game", "marinara", "upgrade-legacy", "preview", chatId],
    queryFn: () =>
      api.get<{ trees: Record<string, MarinaraArchetype>; gear: GearOffer[] }>(
        `/game/marinara/upgrade-legacy/preview?chatId=${encodeURIComponent(chatId)}`,
      ),
    enabled: offered && open,
    staleTime: 60_000,
  });
  const [declined, setDeclined] = useState<Record<string, true>>({});
  const gearOf = (name: string) =>
    (preview?.gear ?? []).filter(
      (offer) => normalizeCharacterLookupName(offer.holder) === normalizeCharacterLookupName(name),
    );
  const startingTree = (card: Card): MarinaraArchetype =>
    picks[card.name] ?? preview?.trees[normalizeCharacterLookupName(card.name)] ?? guessMarinaraArchetype(card);
  if (!offered) return null;
  const tree = (id: string) => t(`game.combat.marinara.archetype.${id}`);

  const upgrade = async () => {
    // One-way: only once the preview has loaded, so the trees and gear sent are the ones the player saw.
    if (!preview) return;
    setBusy(true);
    try {
      const result = await api.post<{
        upgraded: Array<{ name: string; level: number; primary: string; secondary: string | null }>;
        temperamentReadFailed?: boolean;
      }>("/game/marinara/upgrade-legacy", {
        chatId,
        members: cards.map((card) => ({
          name: card.name,
          primary: startingTree(card),
        })),
        gear: preview.gear.filter((offer) => !declined[offer.stackId]).map((offer) => offer.stackId),
      });
      await qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      toast.success(
        t("game.combat.marinara.legacy.done", {
          party: result.upgraded
            .map((one) =>
              t("game.combat.marinara.legacy.doneMember", {
                name: one.name,
                level: one.level,
                trees: [one.primary, one.secondary]
                  .filter(Boolean)
                  .map((id) => tree(id!))
                  .join(" + "),
              }),
            )
            .join(", "),
        }),
      );
      if (result.temperamentReadFailed) toast.warning(t("game.combat.marinara.legacy.readFailed"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("game.combat.marinara.legacy.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/75"
      data-testid="marinara-legacy-upgrade"
    >
      <div className="flex items-start gap-2">
        <Swords size={14} className="mt-0.5 shrink-0 text-white/60" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold text-white/85">{t("game.combat.marinara.legacy.title")}</p>
          <p className="leading-relaxed text-white/60">{t("game.combat.marinara.legacy.intro")}</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[0.7rem] font-semibold text-white/85 hover:bg-white/[0.1]"
          >
            {t("game.combat.marinara.legacy.open")}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {cards.map((card) => {
            const primary = startingTree(card);
            const kept = gameCardTemperament(card);
            const secondary = kept ? marinaraTrees(primary, kept.initial as MarinaraPartyTemperament).secondary : null;
            return (
              <div key={card.name} className="grid gap-1.5 rounded-md border border-white/8 bg-black/20 p-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-white/85">{card.name}</span>
                  <span className="text-white/55">
                    {t("game.combat.marinara.legacy.level", { level: MARINARA_LEGACY_UPGRADE_LEVEL })}
                  </span>
                </div>
                <label className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-white/55">{t("game.combat.marinara.legacy.class")}</span>
                  <select
                    className="min-h-8 min-w-0 flex-1 rounded border border-white/15 bg-black/40 px-1.5 text-white/85"
                    value={primary}
                    disabled={busy}
                    onChange={(event) =>
                      setPicks((was) => ({ ...was, [card.name]: event.target.value as MarinaraArchetype }))
                    }
                  >
                    {MARINARA_ARCHETYPES.map((id) => (
                      <option key={id} value={id}>
                        {tree(id)}
                      </option>
                    ))}
                  </select>
                </label>
                {gearOf(card.name).map((offer) => (
                  <label key={offer.stackId} className="flex items-center gap-2 text-white/70">
                    <input
                      type="checkbox"
                      checked={!declined[offer.stackId]}
                      disabled={busy}
                      onChange={(event) =>
                        setDeclined((was) => {
                          const { [offer.stackId]: _gone, ...rest } = was;
                          return event.target.checked ? rest : { ...rest, [offer.stackId]: true };
                        })
                      }
                    />
                    <span className="min-w-0">
                      {t("game.combat.marinara.legacy.gear", { from: offer.from, to: offer.to })}
                    </span>
                  </label>
                ))}
                <p className="text-white/55">
                  {!kept
                    ? t("game.combat.marinara.legacy.sisterRead")
                    : secondary
                      ? t("game.combat.marinara.legacy.sister", {
                          tree: tree(secondary),
                          temperament: kept.initial,
                        })
                      : t("game.combat.marinara.legacy.pure", { temperament: kept.initial })}
                </p>
              </div>
            );
          })}
          <p className="leading-relaxed text-white/50">{t("game.combat.marinara.legacy.kept")}</p>
          {previewFailed && (
            <p className="leading-relaxed text-red-300/80">
              {t("game.combat.marinara.legacy.previewFailed")}{" "}
              <button
                type="button"
                onClick={() => void retryPreview()}
                className="underline underline-offset-2 hover:text-red-200"
              >
                {t("game.combat.marinara.legacy.retry")}
              </button>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-md px-2.5 py-1.5 text-[0.7rem] text-white/60 hover:text-white/85"
            >
              {t("game.combat.marinara.legacy.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void upgrade()}
              disabled={busy || !preview}
              className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-[0.7rem] font-semibold text-[var(--primary-foreground)] disabled:cursor-wait disabled:opacity-50"
            >
              {busy
                ? t("game.combat.marinara.legacy.working")
                : preview
                  ? t("game.combat.marinara.legacy.confirm")
                  : t("game.combat.marinara.legacy.loading")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
