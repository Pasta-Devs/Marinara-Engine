import type { Persona } from "@marinara-engine/shared";
import type { QueryClient } from "@tanstack/react-query";

export const personaCacheKeys = {
  list: ["personas"] as const,
  detail: (id: string) => ["personas", "detail", id] as const,
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

  await Promise.all([
    qc.cancelQueries({ queryKey: personaCacheKeys.list, exact: true }),
    qc.cancelQueries({ queryKey: personaCacheKeys.detail(persona.id), exact: true }),
  ]);

  qc.setQueryData<Persona>(personaCacheKeys.detail(persona.id), persona);
  if (completeList !== undefined) {
    qc.setQueryData<Persona[]>(personaCacheKeys.list, (old) => [
      persona,
      ...(old ?? completeList).filter((row) => row.id !== persona.id),
    ]);
  }

  if (listState !== undefined && listState.data === undefined) {
    await qc.invalidateQueries({ queryKey: personaCacheKeys.list, exact: true, refetchType: "all" });
  }
}
