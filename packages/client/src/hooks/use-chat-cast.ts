import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { MultiplayerHostAction } from "@marinara-engine/shared";
import { useUpdateChat, useUpdateChatMetadata } from "./use-chats";
import { multiplayerActionError, useMultiplayerMutation } from "./use-multiplayer";
import { multiplayerGuestErrorLabelKey } from "../features/multiplayer/multiplayer-guest-labels";
import { normalizeSpritePlacements } from "../components/chat/sprite-placement";

/** Adds or removes a chat's characters: the one write path for Chat Settings and the setup stage. */
export function useChatCast({
  chatId,
  metadata,
  chatCharIds,
  isGame,
  onAdded,
  onRemoved,
}: {
  chatId: string;
  metadata: Record<string, any>;
  chatCharIds: string[];
  isGame: boolean;
  /** Runs after a character joins, with the new cast. */
  onAdded?: (charId: string, current: string[]) => void;
  onRemoved?: (charId: string) => void;
}) {
  const { t } = useTranslation();
  const updateChat = useUpdateChat();
  const updateMeta = useUpdateChatMetadata();
  const roomRoster = useMultiplayerMutation<unknown, MultiplayerHostAction>("/multiplayer/host/actions");
  const spriteCharacterIds: string[] = Array.isArray(metadata.spriteCharacterIds) ? metadata.spriteCharacterIds : [];
  const inactiveCharacterIds: string[] = Array.isArray(metadata.inactiveCharacterIds)
    ? metadata.inactiveCharacterIds.filter(
        (id: unknown): id is string => typeof id === "string" && chatCharIds.includes(id),
      )
    : [];

  const syncGamePartyMetadata = (nextCharacterIds: string[]) => {
    if (!isGame) return;
    const storedPartyIds: unknown[] = Array.isArray(metadata.gamePartyCharacterIds)
      ? metadata.gamePartyCharacterIds
      : Array.isArray((metadata.gameSetupConfig as { partyCharacterIds?: unknown[] } | undefined)?.partyCharacterIds)
        ? (metadata.gameSetupConfig as { partyCharacterIds: unknown[] }).partyCharacterIds
        : [];
    const npcPartyIds = storedPartyIds.filter((id): id is string => typeof id === "string" && id.startsWith("npc:"));
    const nextPartyIds = Array.from(new Set([...nextCharacterIds, ...npcPartyIds]));
    const gameSetupConfig =
      metadata.gameSetupConfig && typeof metadata.gameSetupConfig === "object"
        ? { ...(metadata.gameSetupConfig as Record<string, unknown>), partyCharacterIds: nextPartyIds }
        : metadata.gameSetupConfig;
    updateMeta.mutate({
      id: chatId,
      gamePartyCharacterIds: nextPartyIds,
      ...(gameSetupConfig ? { gameSetupConfig } : {}),
    });
  };

  // A removed character also leaves the chat's sprite and inactive-character lists.
  const clearRemovedCharacterMetadata = (charId: string) => {
    if (spriteCharacterIds.includes(charId)) {
      const nextSpritePlacements = { ...normalizeSpritePlacements(metadata.spritePlacements) };
      delete nextSpritePlacements[charId];
      delete nextSpritePlacements[`${charId}:expressions`];
      delete nextSpritePlacements[`${charId}:full-body`];
      updateMeta.mutate({
        id: chatId,
        spriteCharacterIds: spriteCharacterIds.filter((id) => id !== charId),
        spritePlacements: nextSpritePlacements,
      });
    }
    if (inactiveCharacterIds.includes(charId)) {
      updateMeta.mutate({
        id: chatId,
        inactiveCharacterIds: inactiveCharacterIds.filter((id) => id !== charId),
      });
    }
  };

  // A hosted room keeps its AI roster in the room, so roster changes go through the room and replies keep working.
  const hostedRoom = metadata.multiplayer?.role === "host";
  const changeRoomCharacters = async (add: string[], remove: string[]) => {
    try {
      for (const characterId of remove) {
        await roomRoster.mutateAsync({ type: "remove-character", characterId });
        clearRemovedCharacterMetadata(characterId);
      }
      for (const characterId of add)
        await roomRoster.mutateAsync({ type: "add-character", characterId, role: "character" });
    } catch (error) {
      const code = multiplayerActionError(error);
      toast.error(t(code === "identity-conflict" ? multiplayerGuestErrorLabelKey(code) : "multiplayer.actionFailed"));
    }
  };

  const pendingCast = useRef<string[] | null>(null);
  const toggleCharacter = (charId: string) => {
    if (hostedRoom) {
      const removing = chatCharIds.includes(charId);
      void changeRoomCharacters(removing ? [] : [charId], removing ? [charId] : []);
      return;
    }
    // Two fast clicks before the first write returns must build on each other, not on the same stale cast.
    const current = [...(pendingCast.current ?? chatCharIds)];
    pendingCast.current = current;
    const settled = () => {
      pendingCast.current = null;
    };
    const idx = current.indexOf(charId);
    if (idx >= 0) {
      current.splice(idx, 1);
      updateChat.mutate(
        { id: chatId, characterIds: current },
        { onSuccess: () => syncGamePartyMetadata(current), onSettled: settled },
      );
      clearRemovedCharacterMetadata(charId);
      onRemoved?.(charId);
    } else {
      current.push(charId);
      updateChat.mutate(
        { id: chatId, characterIds: current },
        {
          onSuccess: () => {
            syncGamePartyMetadata(current);
            onAdded?.(charId, current);
          },
          onSettled: settled,
        },
      );
    }
  };

  return { toggleCharacter, changeRoomCharacters, hostedRoom };
}
