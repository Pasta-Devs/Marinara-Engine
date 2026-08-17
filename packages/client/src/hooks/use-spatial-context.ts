import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Chat,
  GenerateSpatialMapDraftRequest,
  GenerateSpatialMapDraftResponse,
  Message,
  MessageAttachment,
  PendingSpatialTransition,
  ResolvedSpatialTravel,
  SpatialContextResponse,
  SpatialDefinitionIssue,
} from "@marinara-engine/shared";
import { api, ApiError } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { dispatchSpatialCapabilityEvent, resolveGameExperiencePackageId } from "../lib/capability-client-events";
import { chatKeys } from "./use-chats";
import {
  shouldKeepPendingSpatialTransition,
  spatialOwnerTurnRecoveryPath,
  type RecoveredSpatialOwnerTurnResponse,
} from "./spatial-owner-turn-recovery";

export const spatialContextKeys = {
  all: ["spatial-context"] as const,
  detail: (chatId: string) => [...spatialContextKeys.all, chatId] as const,
};

export interface GenerateSpatialMapDraftInput extends GenerateSpatialMapDraftRequest {
  chatId: string;
  /** Optional World Maps package extension for an exact AI-generated place target. */
  targetLocationCount?: number;
}

export interface CommitSpatialOwnerTurnInput {
  chatId: string;
  content: string;
  transition: PendingSpatialTransition;
  attachments?: MessageAttachment[];
}

interface CommitSpatialOwnerTurnResponse {
  message: Message;
  spatial: SpatialContextResponse;
  travel?: ResolvedSpatialTravel;
}

export interface SpatialContextProblem {
  status: number | null;
  code: string | null;
  message: string;
  issues: SpatialDefinitionIssue[];
  conflict: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readIssues(value: unknown): SpatialDefinitionIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.message !== "string") return [];
    const path = Array.isArray(candidate.path)
      ? candidate.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number")
      : [];
    const spatialCode =
      isRecord(candidate.params) && typeof candidate.params.spatialCode === "string"
        ? candidate.params.spatialCode
        : typeof candidate.code === "string" && candidate.code !== "custom"
          ? candidate.code
          : "stored_definition_invalid";
    const locationId =
      typeof candidate.locationId === "string"
        ? candidate.locationId
        : isRecord(candidate.params) && typeof candidate.params.locationId === "string"
          ? candidate.params.locationId
          : undefined;
    return [
      {
        code: spatialCode as SpatialDefinitionIssue["code"],
        message: candidate.message,
        path,
        ...(locationId ? { locationId } : {}),
      },
    ];
  });
}

export function getSpatialContextProblem(error: unknown): SpatialContextProblem {
  if (!(error instanceof ApiError)) {
    return {
      status: null,
      code: null,
      message: error instanceof Error ? error.message : "The world map could not be saved.",
      issues: [],
      conflict: false,
    };
  }

  const payload = isRecord(error.payload) ? error.payload : {};
  const code = typeof payload.code === "string" ? payload.code : null;
  return {
    status: error.status,
    code,
    message: error.message || "The world map could not be saved.",
    issues: readIssues(payload.issues),
    conflict: error.status === 409 || code === "spatial_definition_stale" || code === "spatial_current_location_stale",
  };
}

export function useSpatialContext(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: spatialContextKeys.detail(chatId ?? ""),
    queryFn: () => api.get<SpatialContextResponse>(`/chats/${chatId}/spatial-context`),
    enabled: !!chatId && enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}

/** Mirror of use-generate's resolver: the Experience package owning this
 *  chat's game. Active chat first, then the query caches — the dispatch often
 *  runs after an await, and a chat switch in that window must not silently
 *  drop the Experience audience (review finding). */
function getGameExperiencePackageId(queryClient: ReturnType<typeof useQueryClient>, chatId: string): string | null {
  const activeChat = useChatStore.getState().activeChat;
  const chat =
    activeChat?.id === chatId
      ? activeChat
      : (queryClient.getQueryData<Chat>(chatKeys.detail(chatId)) ??
        queryClient.getQueryData<Chat[]>(chatKeys.list())?.find((candidate) => candidate.id === chatId));
  const raw = chat?.metadata;
  let metadata: Record<string, unknown> | null = null;
  if (raw && typeof raw === "object") metadata = raw as Record<string, unknown>;
  else if (typeof raw === "string") {
    try {
      metadata = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return resolveGameExperiencePackageId(metadata);
}

export function useCommitSpatialOwnerTurn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, ...request }: CommitSpatialOwnerTurnInput) =>
      api.post<CommitSpatialOwnerTurnResponse>(`/chats/${chatId}/spatial-context/turn`, request),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(spatialContextKeys.detail(variables.chatId), response.spatial);
      const stepwiseRouteRemainsQueued = shouldKeepPendingSpatialTransition(response.travel);
      if (!stepwiseRouteRemainsQueued) {
        useChatStore.getState().clearPendingSpatialTransition(variables.chatId, variables.transition.commandId);
      }
      dispatchSpatialCapabilityEvent(getGameExperiencePackageId(queryClient, variables.chatId), {
        type: "spatial_transition_committed",
        chatId: variables.chatId,
        data: {
          chatId: variables.chatId,
          commandId: variables.transition.commandId,
          currentLocationId: response.spatial.currentLocationId,
          definitionRevision: response.spatial.definition?.revision,
          ...(response.travel ? { travel: response.travel } : {}),
        },
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.messageCount(variables.chatId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      void queryClient.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
    },
    onError: async (error, variables) => {
      let recovered: RecoveredSpatialOwnerTurnResponse | null = null;
      try {
        recovered = await api.get<RecoveredSpatialOwnerTurnResponse>(
          spatialOwnerTurnRecoveryPath(variables.chatId, variables.transition),
        );
      } catch {
        // The original mutation error remains authoritative when command recovery is not confirmed.
      }
      if (recovered?.applied) {
        const stepwiseRouteRemainsQueued = shouldKeepPendingSpatialTransition(recovered.travel);
        if (!stepwiseRouteRemainsQueued) {
          useChatStore.getState().clearPendingSpatialTransition(variables.chatId, variables.transition.commandId);
        }
        dispatchSpatialCapabilityEvent(getGameExperiencePackageId(queryClient, variables.chatId), {
          type: "spatial_transition_committed",
          chatId: variables.chatId,
          data: {
            chatId: variables.chatId,
            commandId: variables.transition.commandId,
            currentLocationId: recovered.currentLocationId,
            definitionRevision: recovered.definitionRevision,
            ...(recovered.travel ? { travel: recovered.travel } : {}),
          },
        });
      } else {
        useChatStore.getState().setPendingSpatialTransitionStatus(variables.chatId, "needs_review");
        // The REST commit path had the same silent-reject gap as the pre-stream
        // game turn: the mutation error never became a capability event. But a
        // reject is synthesized ONLY on definitive evidence — a spatial_* code
        // that is not already_applied. A network-lost 200 (the server applied
        // the move) or an already_applied 409 with a failed recovery GET are
        // inconclusive; those get the untyped refresh nudge instead, so
        // listeners reconcile from server truth rather than a fabricated
        // verdict (review finding).
        const rejectCode =
          error instanceof ApiError && error.payload && typeof error.payload === "object"
            ? (error.payload as Record<string, unknown>).code
            : undefined;
        const definitiveReject =
          typeof rejectCode === "string" &&
          rejectCode.startsWith("spatial_") &&
          rejectCode !== "spatial_transition_already_applied";
        if (definitiveReject) {
          dispatchSpatialCapabilityEvent(getGameExperiencePackageId(queryClient, variables.chatId), {
            type: "spatial_transition_rejected",
            chatId: variables.chatId,
            data: {
              chatId: variables.chatId,
              commandId: variables.transition.commandId,
              code: rejectCode,
            },
          });
        } else {
          dispatchSpatialCapabilityEvent(getGameExperiencePackageId(queryClient, variables.chatId), {
            type: "spatial_context_refresh",
            chatId: variables.chatId,
            data: null,
          });
        }
      }
      void queryClient.invalidateQueries({ queryKey: spatialContextKeys.detail(variables.chatId) });
    },
  });
}

export function useGenerateSpatialMapDraft() {
  return useMutation({
    mutationFn: ({ chatId, ...request }: GenerateSpatialMapDraftInput) =>
      api.post<GenerateSpatialMapDraftResponse>(`/chats/${chatId}/spatial-context/generate`, request),
  });
}
