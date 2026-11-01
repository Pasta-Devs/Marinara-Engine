// The star is a saved model's only state (concept decision 30). One hook for every place with a star: the
// Connections panel, the quick switch and the Add model screen.
// - Star: saves the model under its Connection (or finds the saved one) and stars it.
// - Unstar: removes the star. When nothing else keeps the model (no role, no settings of its own, no feature that
//   uses it), its row goes at once with "Removed … · Undo"; the server removes it when the Undo is gone.
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { create } from "zustand";
import { isChatProvider, parsePinnedModels } from "@marinara-engine/shared";
import { connectionKeys, useSetConnectionModelPinned } from "./use-connections";
import { usePickModel, useRemoveUnstarredModel, useUnstarModel, type ModelKeepReason } from "./use-connection-accounts";

/** Rows hidden while their Undo is open. */
const useHiddenModels = create<{ ids: ReadonlySet<string> }>(() => ({ ids: new Set() }));
const setHidden = (id: string, hidden: boolean) =>
  useHiddenModels.setState(({ ids }) => {
    const next = new Set(ids);
    if (hidden) next.add(id);
    else next.delete(id);
    return { ids: next };
  });

export function useHiddenModelIds(): ReadonlySet<string> {
  return useHiddenModels((state) => state.ids);
}

type AnchorRow = { id: string; provider?: string | null; createdAt?: string | null; pinnedModels?: unknown };

/**
 * The one Model whose stars a Connection shows (maintainer decision): its oldest chat Model. Every place reads the
 * stars here and passes it as the star's anchor; the server mirrors a star to the Connection's other Models, and the
 * upgrade step merged older stars onto all of them.
 */
export function starAnchorOf<T extends AnchorRow>(rows: readonly T[]): T | undefined {
  return rows
    .filter((row) => isChatProvider(row.provider))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id))[0];
}

/** The model ids a Connection has starred, read from its anchor. */
export function starsOfRows(rows: readonly AnchorRow[]): ReadonlySet<string> {
  return new Set(parsePinnedModels(starAnchorOf(rows)?.pinnedModels));
}

export type StarTarget = {
  accountId: string;
  model: string;
  /** The model's display name, for the toast and a newly saved Model. */
  name?: string;
  maxContext?: number | null;
  maxTokensOverride?: number | null;
  /** A Model of the Connection whose stars hold a model that has no saved Model of its own. */
  anchorId: string;
};

type Row = { id: string; accountId?: string | null; model?: string | null; provider?: string | null };

const STAYS_REASONS: ReadonlySet<ModelKeepReason> = new Set(["role", "settings", "in_use", "last"]);

export function useModelStar() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const pickModel = usePickModel();
  const setPinned = useSetConnectionModelPinned();
  const unstarModel = useUnstarModel();
  const removeModel = useRemoveUnstarredModel();

  const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : t("connections.star.failed"));

  /** Returns the saved Model that holds the star, or null when it failed. */
  const star = async (target: StarTarget): Promise<string | null> => {
    try {
      const { connectionId } = await pickModel.mutateAsync({
        accountId: target.accountId,
        model: target.model,
        ...(target.name ? { name: target.name } : {}),
        ...(target.maxContext ? { maxContext: target.maxContext } : {}),
        ...(target.maxTokensOverride ? { maxTokensOverride: target.maxTokensOverride } : {}),
      });
      await setPinned.mutateAsync({ id: connectionId, model: target.model, pinned: true });
      setHidden(connectionId, false);
      return connectionId;
    } catch (error) {
      fail(error);
      return null;
    }
  };

  const unstar = async (target: StarTarget) => {
    const label = target.name || target.model;
    const findSaved = () =>
      ((qc.getQueryData(connectionKeys.list()) as Row[] | undefined) ?? []).find(
        (row) => row.accountId === target.accountId && row.model === target.model && isChatProvider(row.provider),
      );
    try {
      let saved = findSaved();
      // A model starred a moment ago may not be in the list yet.
      if (!saved) {
        await qc.refetchQueries({ queryKey: connectionKeys.list(), exact: true });
        saved = findSaved();
      }
      if (!saved) {
        await setPinned.mutateAsync({ id: target.anchorId, model: target.model, pinned: false });
        return;
      }
      const row = saved;
      const { removable, reason } = await unstarModel.mutateAsync({
        accountId: target.accountId,
        connectionId: row.id,
      });
      if (!removable) {
        if (reason && STAYS_REASONS.has(reason)) {
          toast(t("connections.star.stays", { model: label, reason: t(`connections.star.reason.${reason}`) }));
        }
        return;
      }
      setHidden(row.id, true);
      let undone = false;
      let settled = false;
      // ponytail: the removal waits for the toast; a closed tab leaves the Model saved without a star (harmless,
      // it shows unstarred). A server-side expiry if that ever matters.
      const finish = () => {
        if (undone || settled) return;
        settled = true;
        // Not mutate's onSettled: that one is dropped when the menu that started it has closed.
        removeModel
          .mutateAsync({ accountId: target.accountId, connectionId: row.id })
          // A refusal (starred again, a new role) keeps the Model; showing it again is the answer.
          .catch(() => undefined)
          .finally(() => setHidden(row.id, false));
      };
      toast(t("connections.star.removed", { model: label }), {
        duration: 6000,
        action: {
          label: t("connections.star.undo"),
          onClick: () => {
            if (settled) return;
            undone = true;
            setHidden(row.id, false);
            setPinned.mutate({ id: row.id, model: target.model, pinned: true });
          },
        },
        onAutoClose: finish,
        onDismiss: finish,
      });
    } catch (error) {
      fail(error);
    }
  };

  return {
    toggle: (target: StarTarget, starred: boolean) => (starred ? unstar(target) : star(target)),
    star,
    unstar,
    pending: pickModel.isPending || setPinned.isPending || unstarModel.isPending,
  };
}
