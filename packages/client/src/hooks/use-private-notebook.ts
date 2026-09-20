import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  privateNotebookDocumentSchema,
  type PrivateNotebookContext,
  type PrivateNotebookDocument,
  type PrivateNotebookTarget,
  type PrivateNotebookUpdateInput,
} from "@marinara-engine/shared";
import { api, ApiError } from "../lib/api-client";

export const privateNotebookKeys = {
  all: ["private-notebook"] as const,
  chat: (chatId: string) => [...privateNotebookKeys.all, "chat", chatId] as const,
};

export function getPrivateNotebookTargetKey(target: PrivateNotebookTarget): string {
  return target.scope === "character" ? `character:${target.characterId}` : target.scope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Return the server's current document for a CAS conflict without surfacing its body in UI errors. */
export function getPrivateNotebookConflictDocument(error: unknown): PrivateNotebookDocument | null {
  if (!(error instanceof ApiError) || error.status !== 409 || !isRecord(error.payload)) return null;
  if (error.payload.code !== "revision-conflict") return null;
  const parsed = privateNotebookDocumentSchema.safeParse(error.payload.document);
  return parsed.success ? parsed.data : null;
}

export function usePrivateNotebook(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: privateNotebookKeys.chat(chatId ?? ""),
    queryFn: () => api.get<PrivateNotebookContext>(`/private-notebook/chats/${chatId}`),
    enabled: !!chatId && enabled,
    staleTime: 0,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 2;
    },
  });
}

export type UpdatePrivateNotebookVariables = {
  chatId: string;
  input: PrivateNotebookUpdateInput;
};

export function useUpdatePrivateNotebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, input }: UpdatePrivateNotebookVariables) =>
      api.put<PrivateNotebookDocument>(`/private-notebook/chats/${chatId}`, input),
    onSuccess: (document, variables) => {
      queryClient.setQueryData<PrivateNotebookContext>(privateNotebookKeys.chat(variables.chatId), (current) => {
        if (!current) return current;
        const documentKey = getPrivateNotebookTargetKey(document.target);
        const existingIndex = current.documents.findIndex(
          (candidate) => getPrivateNotebookTargetKey(candidate.target) === documentKey,
        );
        const documents = [...current.documents];
        if (existingIndex >= 0) documents[existingIndex] = document;
        else documents.push(document);
        return { ...current, documents };
      });
    },
  });
}
