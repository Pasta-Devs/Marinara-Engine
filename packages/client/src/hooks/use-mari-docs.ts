import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export type MariDoc = { path: string; title: string };

/** The canonical docs Professor Mari can open (the `@` picker's Docs group). */
export function useMariDocs() {
  return useQuery({
    queryKey: ["professor-mari", "docs"],
    queryFn: () => api.get<MariDoc[]>("/professor-mari/workspace/docs"),
    staleTime: 10 * 60_000,
  });
}
