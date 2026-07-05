import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ConversationCallIdleResponse,
  ConversationCallCharacterVideoManifest,
  ConversationCallMessage,
  ConversationCallMessageResponse,
  ConversationCallSession,
  ConversationCallSound,
  ConversationCallStatusResponse,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { chatKeys } from "./use-chats";
import { useUIStore } from "../stores/ui.store";

export const conversationCallKeys = {
  status: (chatId: string) => ["conversation-calls", "status", chatId] as const,
  messages: (callId: string) => ["conversation-calls", "messages", callId] as const,
  soundboard: ["conversation-calls", "soundboard"] as const,
  characterVideos: (characterId: string) => ["conversation-calls", "character-videos", characterId] as const,
};

function appendCallMessages(
  queryClient: ReturnType<typeof useQueryClient>,
  callId: string | null,
  messages: ConversationCallMessage[],
) {
  if (!callId || messages.length === 0) return;
  queryClient.setQueryData<ConversationCallMessage[]>(conversationCallKeys.messages(callId), (existing = []) => {
    const byId = new Map(existing.map((message) => [message.id, message]));
    for (const message of messages) byId.set(message.id, message);
    return [...byId.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  });
}

function readCallMusicPlayerState() {
  const state = useUIStore.getState();
  return {
    musicPlayerEnabled: state.musicPlayerEnabled,
    musicPlayerSource: state.musicPlayerSource,
  };
}

export function useConversationCallStatus(chatId: string, enabled = true) {
  return useQuery({
    queryKey: conversationCallKeys.status(chatId),
    queryFn: () => api.get<ConversationCallStatusResponse>(`/conversation-calls/chat/${chatId}/status`),
    enabled: enabled && Boolean(chatId),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useConversationCallMessages(callId: string | null) {
  return useQuery({
    queryKey: conversationCallKeys.messages(callId ?? ""),
    queryFn: () => api.get<ConversationCallMessage[]>(`/conversation-calls/${callId}/messages`),
    enabled: Boolean(callId),
    refetchInterval: 2_000,
    staleTime: 2_000,
  });
}

export function useStartConversationCall(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConversationCallSession>("/conversation-calls/start", { chatId, mode: "audio" }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.status(chatId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      if (session?.id) queryClient.invalidateQueries({ queryKey: conversationCallKeys.messages(session.id) });
    },
  });
}

export function useAcceptConversationCall(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => api.post<ConversationCallSession>(`/conversation-calls/${callId}/accept`),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.status(chatId) });
      if (session?.id) queryClient.invalidateQueries({ queryKey: conversationCallKeys.messages(session.id) });
    },
  });
}

export function useDeclineConversationCall(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => api.post<ConversationCallSession>(`/conversation-calls/${callId}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.status(chatId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
    },
  });
}

export function useEndConversationCall(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => api.post<ConversationCallSession>(`/conversation-calls/${callId}/end`),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.status(chatId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      if (session?.id) queryClient.invalidateQueries({ queryKey: conversationCallKeys.messages(session.id) });
    },
  });
}

export function useSendConversationCallMessage(callId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; inputMode?: "typed" | "speech" }) =>
      api.post<ConversationCallMessageResponse>(`/conversation-calls/${callId}/messages`, {
        content: input.content,
        inputMode: input.inputMode ?? "typed",
        debugMode: useUIStore.getState().debugMode,
        ...readCallMusicPlayerState(),
      }),
    onSuccess: (response) => {
      appendCallMessages(queryClient, callId, [response.userMessage, ...response.assistantMessages]);
      if (callId) queryClient.invalidateQueries({ queryKey: conversationCallKeys.messages(callId) });
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.status(response.session.chatId) });
    },
  });
}

export function useUpdateConversationCallMessageExtra(callId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { messageId: string; extra: Record<string, unknown> }) => {
      if (!callId) throw new Error("No active call is available for this message update.");
      return api.patch<ConversationCallMessage>(
        `/conversation-calls/${callId}/messages/${input.messageId}/extra`,
        input.extra,
      );
    },
    onSuccess: (message) => {
      appendCallMessages(queryClient, message.callId, [message]);
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.messages(message.callId) });
    },
  });
}

export function useSendConversationCallIdle(callId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { quietMs: number }) =>
      api.post<ConversationCallIdleResponse>(`/conversation-calls/${callId}/idle`, {
        ...input,
        debugMode: useUIStore.getState().debugMode,
        ...readCallMusicPlayerState(),
      }),
    onSuccess: (response) => {
      appendCallMessages(queryClient, callId, response.assistantMessages);
      if (callId) queryClient.invalidateQueries({ queryKey: conversationCallKeys.messages(callId) });
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.status(response.session.chatId) });
    },
  });
}

export function useSendConversationCallMedia(callId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      file: File;
      kind: "audio" | "video";
      nativePreferred?: boolean;
      transcriptionMode?: "local_whisper";
    }) => {
      const formData = new FormData();
      formData.set("file", input.file);
      formData.set("kind", input.kind);
      formData.set("nativePreferred", input.nativePreferred === false ? "false" : "true");
      formData.set("debugMode", useUIStore.getState().debugMode ? "true" : "false");
      const musicState = readCallMusicPlayerState();
      formData.set("musicPlayerEnabled", musicState.musicPlayerEnabled ? "true" : "false");
      formData.set("musicPlayerSource", musicState.musicPlayerSource);
      if (input.transcriptionMode) formData.set("transcriptionMode", input.transcriptionMode);
      return api.upload<ConversationCallMessageResponse>(`/conversation-calls/${callId}/media`, formData);
    },
    onSuccess: (response) => {
      appendCallMessages(queryClient, callId, [response.userMessage, ...response.assistantMessages]);
      if (callId) queryClient.invalidateQueries({ queryKey: conversationCallKeys.messages(callId) });
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.status(response.session.chatId) });
    },
  });
}

export function useRecordConversationCallInterruption(callId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { characterId?: string | null; speakerName?: string | null; spokenText?: string }) =>
      api.post<ConversationCallMessage>(`/conversation-calls/${callId}/interruption`, input),
    onSuccess: (message) => {
      appendCallMessages(queryClient, callId, [message]);
      if (callId) queryClient.invalidateQueries({ queryKey: conversationCallKeys.messages(callId) });
    },
  });
}

export function useConversationCallSoundboard() {
  return useQuery({
    queryKey: conversationCallKeys.soundboard,
    queryFn: () => api.get<ConversationCallSound[]>("/conversation-calls/soundboard"),
    staleTime: 60_000,
  });
}

export function useConversationCallCharacterVideos(characterId: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationCallKeys.characterVideos(characterId ?? ""),
    queryFn: () => api.get<ConversationCallCharacterVideoManifest>(`/conversation-calls/character-videos/${characterId}`),
    enabled: enabled && Boolean(characterId),
    refetchInterval: (query) => (query.state.data?.generating ? 15_000 : false),
    staleTime: 15_000,
  });
}

export function useGenerateConversationCallCharacterVideos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { characterId: string }) =>
      api.post<ConversationCallCharacterVideoManifest>(
        `/conversation-calls/character-videos/${input.characterId}/generate`,
        { debugMode: useUIStore.getState().debugMode },
      ),
    onSuccess: (manifest) => {
      queryClient.setQueryData(conversationCallKeys.characterVideos(manifest.characterId), manifest);
      queryClient.invalidateQueries({ queryKey: conversationCallKeys.characterVideos(manifest.characterId) });
    },
  });
}

export function useUploadConversationCallSound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; name?: string }) => {
      const formData = new FormData();
      formData.set("file", input.file);
      if (input.name) formData.set("name", input.name);
      return api.upload<ConversationCallSound>("/conversation-calls/soundboard/upload", formData);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationCallKeys.soundboard }),
  });
}

export function useDeleteConversationCallSound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (soundId: string) => api.delete<void>(`/conversation-calls/soundboard/${soundId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationCallKeys.soundboard }),
  });
}
