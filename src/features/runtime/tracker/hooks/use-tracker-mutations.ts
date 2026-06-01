import { useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type {
  CharacterStat,
  InventoryItem,
  PresentCharacter,
  QuestProgress,
} from "../../../../engine/contracts/types/game-state";
import type { TrackerStateController } from "../../world-state/types";
import { useTrackerCharacterAvatarActions } from "../../world-state/index";
import {
  appendTrackerListItem,
  createManualCharacterStat,
  createManualInventoryItem,
  createManualPresentCharacter,
  createManualQuest,
  mergeCharacterStatListUpdate,
  mergeCustomTrackerFieldListUpdate,
  mergeInventoryItemListItemUpdate,
  mergePresentCharacterListItemUpdate,
  mergeQuestProgressListItemUpdate,
  removeInventoryItemListItem,
  removePresentCharacterListItem,
  removeQuestProgressListItem,
} from "../../world-state/index";
import { getCharacterFeatureKey } from "../components/tracker-character.helpers";

function getQuestIndexByEntryId(quests: readonly QuestProgress[], questEntryId: string) {
  return quests.findIndex((quest) => quest.questEntryId === questEntryId);
}

export function useTrackerMutations({
  activeChatId,
  agentConfigLookupEnabled,
  getSnapshot,
  customTrackerFields,
  inventory,
  personaStats,
  presentCharacters,
  quests,
  patchField,
  patchPlayerStats,
  removeFeaturedCharacterCard,
}: {
  activeChatId: string | null;
  agentConfigLookupEnabled: boolean;
  getSnapshot: TrackerStateController["getSnapshot"];
  customTrackerFields: TrackerStateController["customTrackerFields"];
  inventory: InventoryItem[];
  personaStats: TrackerStateController["personaStats"];
  presentCharacters: PresentCharacter[];
  quests: QuestProgress[];
  patchField: TrackerStateController["patchField"];
  patchPlayerStats: TrackerStateController["patchPlayerStats"];
  removeFeaturedCharacterCard: (key: string) => void;
}) {
  const [avatarUploadIndex, setAvatarUploadIndex] = useState<number | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const updatePresentCharacters = useCallback(
    (characters: PresentCharacter[]) => patchField("presentCharacters", characters),
    [patchField],
  );
  const getLatestPresentCharacters = useCallback(() => getSnapshot().presentCharacters, [getSnapshot]);
  const getLatestInventory = useCallback(() => getSnapshot().inventory, [getSnapshot]);
  const getLatestPersonaStats = useCallback(() => getSnapshot().personaStats, [getSnapshot]);
  const getLatestCustomTrackerFields = useCallback(() => getSnapshot().customTrackerFields, [getSnapshot]);
  const getLatestQuests = useCallback(() => getSnapshot().quests, [getSnapshot]);
  const {
    autoGenerateCharacterAvatars,
    canToggleAutoGenerateCharacterAvatars,
    isUpdatingAutoGenerateCharacterAvatars,
    toggleAutoGenerateCharacterAvatars,
    uploadCharacterAvatar,
  } = useTrackerCharacterAvatarActions({
    chatId: activeChatId,
    characters: presentCharacters,
    onUpdateCharacters: updatePresentCharacters,
    agentConfigLookupEnabled,
  });

  const openAvatarUpload = useCallback((index: number) => {
    setAvatarUploadIndex(index);
    avatarFileInputRef.current?.click();
  }, []);

  const handleAvatarFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const index = avatarUploadIndex;
      setAvatarUploadIndex(null);
      if (file && index !== null) {
        void uploadCharacterAvatar(index, file);
      }
      event.target.value = "";
    },
    [avatarUploadIndex, uploadCharacterAvatar],
  );

  const updateCharacter = useCallback(
    (index: number, character: PresentCharacter) => {
      updatePresentCharacters(
        mergePresentCharacterListItemUpdate(presentCharacters, getLatestPresentCharacters(), index, character),
      );
    },
    [getLatestPresentCharacters, presentCharacters, updatePresentCharacters],
  );

  const removeCharacter = useCallback(
    (index: number) => {
      const latestCharacters = getLatestPresentCharacters();
      const removed = latestCharacters[index] ?? presentCharacters[index];
      if (removed) removeFeaturedCharacterCard(getCharacterFeatureKey(removed, index));
      updatePresentCharacters(removePresentCharacterListItem(presentCharacters, latestCharacters, index));
    },
    [getLatestPresentCharacters, presentCharacters, removeFeaturedCharacterCard, updatePresentCharacters],
  );

  const addCharacter = useCallback(() => {
    updatePresentCharacters(appendTrackerListItem(getLatestPresentCharacters(), createManualPresentCharacter()));
  }, [getLatestPresentCharacters, updatePresentCharacters]);

  const updateInventory = useCallback(
    (items: InventoryItem[]) => patchPlayerStats("inventory", items),
    [patchPlayerStats],
  );

  const updateInventoryItem = useCallback(
    (index: number, item: InventoryItem) => {
      updateInventory(mergeInventoryItemListItemUpdate(inventory, getLatestInventory(), index, item));
    },
    [getLatestInventory, inventory, updateInventory],
  );

  const removeInventoryItem = useCallback(
    (index: number) => {
      updateInventory(removeInventoryItemListItem(inventory, getLatestInventory(), index));
    },
    [getLatestInventory, inventory, updateInventory],
  );

  const addInventoryItem = useCallback(() => {
    updateInventory(appendTrackerListItem(getLatestInventory(), createManualInventoryItem()));
  }, [getLatestInventory, updateInventory]);

  const updateQuests = useCallback(
    (nextQuests: QuestProgress[]) => patchPlayerStats("activeQuests", nextQuests),
    [patchPlayerStats],
  );

  const updateQuest = useCallback(
    (questEntryId: string, quest: QuestProgress) => {
      const latestQuests = getLatestQuests();
      const index = getQuestIndexByEntryId(quests, questEntryId);
      if (index !== -1) {
        updateQuests(mergeQuestProgressListItemUpdate(quests, latestQuests, index, quest));
        return;
      }
      if (getQuestIndexByEntryId(latestQuests, questEntryId) === -1) return;
      updateQuests(latestQuests.map((current) => (current.questEntryId === questEntryId ? quest : current)));
    },
    [getLatestQuests, quests, updateQuests],
  );

  const removeQuest = useCallback(
    (questEntryId: string) => {
      const latestQuests = getLatestQuests();
      const index = getQuestIndexByEntryId(quests, questEntryId);
      if (index !== -1) {
        updateQuests(removeQuestProgressListItem(quests, latestQuests, index));
        return;
      }
      if (getQuestIndexByEntryId(latestQuests, questEntryId) === -1) return;
      updateQuests(latestQuests.filter((current) => current.questEntryId !== questEntryId));
    },
    [getLatestQuests, quests, updateQuests],
  );

  const addQuest = useCallback(() => {
    updateQuests(appendTrackerListItem(getLatestQuests(), createManualQuest()));
  }, [getLatestQuests, updateQuests]);

  const addPersonaStat = useCallback(() => {
    patchField("personaStats", appendTrackerListItem(getLatestPersonaStats(), createManualCharacterStat()));
  }, [getLatestPersonaStats, patchField]);

  const updatePersonaStats = useCallback(
    (stats: CharacterStat[]) => {
      patchField("personaStats", mergeCharacterStatListUpdate(personaStats, getLatestPersonaStats(), stats));
    },
    [getLatestPersonaStats, patchField, personaStats],
  );

  return {
    addCharacter,
    addInventoryItem,
    addPersonaStat,
    addQuest,
    autoGenerateCharacterAvatars,
    avatarFileInputRef,
    canToggleAutoGenerateCharacterAvatars,
    handleAvatarFileInputChange,
    isUpdatingAutoGenerateCharacterAvatars,
    openAvatarUpload,
    removeCharacter,
    removeInventoryItem,
    removeQuest,
    toggleAutoGenerateCharacterAvatars,
    updateCharacter,
    updateCustomFields: (fields: TrackerStateController["customTrackerFields"]) =>
      patchPlayerStats(
        "customTrackerFields",
        mergeCustomTrackerFieldListUpdate(customTrackerFields, getLatestCustomTrackerFields(), fields),
      ),
    updateInventoryItem,
    updatePersonaStats,
    updateQuest,
    savePersonaStatus: (status: string) => patchPlayerStats("status", status),
  };
}
