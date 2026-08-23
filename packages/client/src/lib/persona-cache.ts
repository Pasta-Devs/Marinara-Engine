import type { Persona } from "@marinara-engine/shared";
import type { QueryClient } from "@tanstack/react-query";

export const personaCacheKeys = {
  list: ["personas"] as const,
  detail: (id: string) => ["personas", "detail", id] as const,
  active: () => ["personas", "active"] as const,
};

/**
 * Reconcile an authoritative Persona mutation response with caches that can
 * represent it directly. Paginated lists are intentionally left to targeted
 * invalidation because a response cannot safely place an item across their
 * search, sort, and offset boundaries.
 */
export async function syncCachedPersona(qc: QueryClient, persona: Persona) {
  const listState = qc.getQueryState<Persona[]>(personaCacheKeys.list);
  const completeList = listState?.data;
  const activeState = qc.getQueryState<Persona | null>(personaCacheKeys.active());
  const cachedActive = activeState?.data;
  const activeNeedsRefetch =
    !persona.isActive && activeState !== undefined && (cachedActive === undefined || cachedActive?.id === persona.id);

  await Promise.all([
    qc.cancelQueries({ queryKey: personaCacheKeys.list, exact: true }),
    qc.cancelQueries({ queryKey: personaCacheKeys.detail(persona.id), exact: true }),
    ...(persona.isActive || activeNeedsRefetch
      ? [qc.cancelQueries({ queryKey: personaCacheKeys.active(), exact: true })]
      : []),
  ]);

  qc.setQueryData<Persona>(personaCacheKeys.detail(persona.id), persona);
  if (completeList !== undefined) {
    qc.setQueryData<Persona[]>(personaCacheKeys.list, (old) => [
      persona,
      ...(old ?? completeList).filter((row) => row.id !== persona.id),
    ]);
  }

  if (persona.isActive) {
    qc.setQueryData<Persona>(personaCacheKeys.active(), persona);
  }

  await Promise.all([
    ...(listState !== undefined && listState.data === undefined
      ? [qc.invalidateQueries({ queryKey: personaCacheKeys.list, exact: true, refetchType: "all" })]
      : []),
    ...(activeNeedsRefetch
      ? [qc.invalidateQueries({ queryKey: personaCacheKeys.active(), exact: true, refetchType: "all" })]
      : []),
  ]);
}
