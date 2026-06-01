import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createChatSchema } from "../../../../engine/contracts/schemas/chat.schema";
import type { Chat } from "../../../../engine/contracts/types/chat";
import { clearChatActivity } from "../../../../engine/modes/chat/autonomous/autonomous.service";
import { chatCommandApi } from "../../../../shared/api/chat-command-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { lorebookKeys } from "../../lorebooks/query-keys";
import { chatKeys } from "../query-keys";
import {
  applyChatMetadataPatch,
  cancelChatCacheQueries,
  setChatCacheRecord,
  type ChatCacheRecord,
} from "./chat-cache";
import type { ChatListItem } from "./use-chat-summaries";

type DeleteChatInput = string | { id: string; groupId?: string | null };

interface DeleteChatResult {
  deleted: boolean;
  deletedChatIds?: string[];
}

function getDeleteChatId(input: DeleteChatInput) {
  return typeof input === "string" ? input : input.id;
}

function getDeleteChatGroupId(input: DeleteChatInput) {
  return typeof input === "string" ? null : (input.groupId ?? null);
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)));
}

function patchAffectsActiveLorebooks(patch: Record<string, unknown>): boolean {
  return [
    "activeLorebookIds",
    "lorebookTokenBudget",
    "lorebookKeeperTargetLorebookId",
    "gameLorebookKeeperEnabled",
    "gameLorebookKeeperLorebookId",
  ].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      mode: string;
      characterIds?: string[];
      groupId?: string | null;
      connectionId?: string | null;
      personaId?: string | null;
      promptPresetId?: string | null;
    }) => storageApi.create<Chat>("chats", createChatSchema.parse(data)),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.summaries() });
      if (variables.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(variables.groupId) });
      }
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteChatInput): Promise<DeleteChatResult> =>
      (await storageApi.delete("chats", getDeleteChatId(input))) as DeleteChatResult,
    onMutate: async (input) => {
      const id = getDeleteChatId(input);
      const providedGroupId = getDeleteChatGroupId(input);
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      if (providedGroupId) {
        await qc.cancelQueries({ queryKey: chatKeys.group(providedGroupId) });
      }
      await qc.cancelQueries({ queryKey: chatKeys.summaries() });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      const previousSummaries = qc.getQueriesData<ChatListItem[]>({ queryKey: chatKeys.summaries() });
      const previousGroup = providedGroupId ? qc.getQueryData<Chat[]>(chatKeys.group(providedGroupId)) : undefined;
      const deletedChat =
        previous?.find((c) => c.id === id) ??
        previousGroup?.find((c) => c.id === id) ??
        previousSummaries.flatMap(([, rows]) => rows ?? []).find((c) => c.id === id) ??
        null;
      const groupId = deletedChat?.groupId ?? providedGroupId;

      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.id !== id));
      qc.setQueriesData<ChatListItem[]>({ queryKey: chatKeys.summaries() }, (old) => old?.filter((c) => c.id !== id));

      if (groupId) {
        qc.setQueryData<Chat[]>(chatKeys.group(groupId), (old) => old?.filter((c) => c.id !== id));
      }

      return { previous, previousSummaries, previousGroup, groupId };
    },
    onSuccess: (data, input) => {
      for (const chatId of uniqueIds([getDeleteChatId(input), ...(data.deletedChatIds ?? [])])) {
        clearChatActivity(chatId);
      }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(chatKeys.list(), context.previous);
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.list() });
      }
      for (const [queryKey, data] of context?.previousSummaries ?? []) {
        qc.setQueryData(queryKey, data);
      }
      if (context?.groupId) {
        if (context.previousGroup) {
          qc.setQueryData(chatKeys.group(context.groupId), context.previousGroup);
        } else {
          qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
        }
      }
    },
    onSettled: (_data, _err, input, context) => {
      const groupId = context?.groupId ?? getDeleteChatGroupId(input);
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.summaries() });
      if (groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(groupId) });
      }
    },
  });
}

export function useDeleteChatGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => chatCommandApi.groupDelete(groupId),
    onMutate: async (groupId) => {
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      await qc.cancelQueries({ queryKey: chatKeys.summaries() });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      const previousSummaries = qc.getQueriesData<ChatListItem[]>({ queryKey: chatKeys.summaries() });

      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.groupId !== groupId));
      qc.setQueriesData<ChatListItem[]>({ queryKey: chatKeys.summaries() }, (old) =>
        old?.filter((c) => c.groupId !== groupId),
      );
      qc.setQueryData<Chat[]>(chatKeys.group(groupId), []);

      return { previous, previousSummaries, groupId };
    },
    onSuccess: (data) => {
      for (const chatId of uniqueIds(data.deletedChatIds ?? [])) {
        clearChatActivity(chatId);
      }
    },
    onError: (_err, _groupId, context) => {
      if (context?.previous) qc.setQueryData(chatKeys.list(), context.previous);
      for (const [queryKey, data] of context?.previousSummaries ?? []) {
        qc.setQueryData(queryKey, data);
      }
      if (context?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
      }
    },
    onSettled: (_data, _err, _groupId, context) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.summaries() });
      if (context?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
      }
    },
  });
}

export function useUpdateChatMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...metadata }: { id: string; [key: string]: unknown }) =>
      storageApi.patchChatMetadata<Chat>(id, metadata),
    onMutate: ({ id, ...metadata }) => {
      cancelChatCacheQueries(qc, id);
      const previousDetail = qc.getQueryData<ChatCacheRecord>(chatKeys.detail(id));
      const previousListQueries = qc.getQueriesData<ChatCacheRecord[]>({ queryKey: chatKeys.list() });
      const previousGroupQueries = qc.getQueriesData<ChatCacheRecord[]>({ queryKey: [...chatKeys.all, "group"] });
      const previousActiveChat = useChatStore.getState().activeChat;

      setChatCacheRecord(qc, id, (chat) => applyChatMetadataPatch(chat, metadata));

      return { previousDetail, previousListQueries, previousGroupQueries, previousActiveChat };
    },
    onError: (_error, vars, context) => {
      if (context?.previousDetail) qc.setQueryData(chatKeys.detail(vars.id), context.previousDetail);
      for (const [queryKey, data] of context?.previousListQueries ?? []) qc.setQueryData(queryKey, data);
      for (const [queryKey, data] of context?.previousGroupQueries ?? []) qc.setQueryData(queryKey, data);
      if (context?.previousActiveChat) useChatStore.getState().setActiveChat(context.previousActiveChat);
    },
    onSuccess: (data, vars) => {
      const { id, ...metadata } = vars;
      if (data) {
        qc.setQueryData(chatKeys.detail(id), data);
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.detail(id) });
      }
      setChatCacheRecord(qc, id, (chat) => applyChatMetadataPatch(chat, metadata));
      if (patchAffectsActiveLorebooks(metadata)) qc.invalidateQueries({ queryKey: lorebookKeys.active(id) });
    },
  });
}
