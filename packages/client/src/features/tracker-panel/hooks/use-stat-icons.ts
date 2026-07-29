import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CharacterStat,
  Persona,
  PresentCharacter,
  SupportedStatIcon,
  TrackerStatIconAssignment,
} from "@marinara-engine/shared";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import {
  normalizeStatIconAssignments,
  remapStatIconAssignments,
  resolveStatIconAssignment,
  setStatIconAssignment,
} from "../../../lib/stat-icon-assignments";
import { parseTrackerCardColorConfig } from "../../../lib/tracker-card-colors";
import type { TrackerSpriteLookup } from "../tracker-panel.types";

interface ResolvedStatIcon {
  /** Chat-local ownership: undefined inherits, null hides, an icon overrides. */
  value: SupportedStatIcon | null | undefined;
  /** Effective icon after profile fallback. */
  displayIcon: SupportedStatIcon | null;
}

export interface StatIconLookup {
  resolvePersonaStatIcon: (statName: string, occurrence: number) => ResolvedStatIcon;
  setPersonaStatIcon: (statName: string, occurrence: number, icon: SupportedStatIcon | null | undefined) => void;
  remapPersonaStatIcons: (
    previousStats: CharacterStat[],
    nextStats: CharacterStat[],
    previousIndexForNext: (nextIndex: number) => number | undefined,
  ) => void;
  resolveCharacterStatIcon: (
    character: PresentCharacter,
    characterIndex: number,
    statName: string,
    occurrence: number,
  ) => ResolvedStatIcon;
  setCharacterStatIcon: (
    character: PresentCharacter,
    characterIndex: number,
    statName: string,
    occurrence: number,
    icon: SupportedStatIcon | null | undefined,
  ) => void;
  remapCharacterStatIcons: (
    character: PresentCharacter,
    characterIndex: number,
    previousStats: CharacterStat[],
    nextStats: CharacterStat[],
    previousIndexForNext: (nextIndex: number) => number | undefined,
  ) => void;
}

interface UseStatIconsOptions {
  activeChatId: string | null;
  trackerStatIconOverrides: unknown;
  activePersona: Persona | null;
  presentCharacters: PresentCharacter[];
  characterProfileColorsById: TrackerSpriteLookup["profileColorsById"];
  resolveProfileCharacterId: (character: PresentCharacter) => string | null;
}

function parseOverrides(value: unknown): Record<string, TrackerStatIconAssignment[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([owner, assignments]) => [owner, normalizeStatIconAssignments(assignments)] as const)
      .filter(([, assignments]) => assignments.length > 0),
  );
}

interface CharacterOwnerKeys {
  primary: string;
  readOrder: string[];
}

type StatIconOverrides = Record<string, TrackerStatIconAssignment[]>;
type StatIconWrite = (overrides: StatIconOverrides) => StatIconOverrides;

function characterOwnerKeys(
  character: PresentCharacter,
  characterIndex: number,
  presentCharacters: PresentCharacter[],
): CharacterOwnerKeys {
  const slotOwner = `character-slot:${characterIndex}`;
  const characterId = character.characterId?.trim() ?? "";
  const hasUniqueCharacterId =
    !!characterId &&
    presentCharacters.filter((candidate) => candidate.characterId?.trim() === characterId).length === 1;

  // Unique ids remain reorder-safe. Duplicate and id-less rows use isolated
  // positional buckets because the tracker state has no stable instance id.
  // A slot is read first when uniqueness returns so its newer value can migrate
  // back to the stable id on the next write.
  return hasUniqueCharacterId
    ? { primary: `character:${characterId}`, readOrder: [slotOwner, `character:${characterId}`] }
    : { primary: slotOwner, readOrder: [slotOwner] };
}

function resolveOwnerAssignments(overrides: Record<string, TrackerStatIconAssignment[]>, owners: CharacterOwnerKeys) {
  for (const owner of owners.readOrder) {
    if (Object.prototype.hasOwnProperty.call(overrides, owner)) {
      return { owner, assignments: overrides[owner] ?? [] };
    }
  }
  return { owner: owners.primary, assignments: [] };
}

export function useStatIcons({
  activeChatId,
  trackerStatIconOverrides,
  activePersona,
  presentCharacters,
  characterProfileColorsById,
  resolveProfileCharacterId,
}: UseStatIconsOptions): StatIconLookup {
  const updateChatMetadata = useUpdateChatMetadata();
  const personaProfileIcons = useMemo(
    () => parseTrackerCardColorConfig(activePersona?.trackerCardColors).statIcons ?? [],
    [activePersona],
  );
  const overrides = useMemo(() => parseOverrides(trackerStatIconOverrides), [trackerStatIconOverrides]);
  const persistedOverridesRef = useRef(new Map<string, StatIconOverrides>());
  const optimisticOverridesRef = useRef(new Map<string, StatIconOverrides>());
  const queuedWritesRef = useRef(new Map<string, StatIconWrite[]>());
  const writingChatIdsRef = useRef(new Set<string>());
  const [, refreshOptimisticOverrides] = useState(0);

  const getWritableOverrides = useCallback(() => {
    if (!activeChatId) return overrides;
    return (
      optimisticOverridesRef.current.get(activeChatId) ?? persistedOverridesRef.current.get(activeChatId) ?? overrides
    );
  }, [activeChatId, overrides]);

  useEffect(() => {
    if (!activeChatId || writingChatIdsRef.current.has(activeChatId) || queuedWritesRef.current.has(activeChatId)) {
      return;
    }
    persistedOverridesRef.current.delete(activeChatId);
    optimisticOverridesRef.current.delete(activeChatId);
  }, [activeChatId, trackerStatIconOverrides]);

  const rebuildOptimisticOverrides = useCallback((chatId: string) => {
    const persisted = persistedOverridesRef.current.get(chatId) ?? {};
    const queued = queuedWritesRef.current.get(chatId) ?? [];
    if (queued.length === 0) {
      optimisticOverridesRef.current.delete(chatId);
      refreshOptimisticOverrides((version) => version + 1);
      return;
    }
    const optimistic = queued.reduce((current, write) => write(current), persisted);
    optimisticOverridesRef.current.set(chatId, optimistic);
    refreshOptimisticOverrides((version) => version + 1);
  }, []);

  const drainWrites = useCallback(
    async (chatId: string) => {
      if (writingChatIdsRef.current.has(chatId)) return;
      writingChatIdsRef.current.add(chatId);

      try {
        let write = queuedWritesRef.current.get(chatId)?.[0];
        while (write) {
          const persisted = persistedOverridesRef.current.get(chatId) ?? {};
          const nextOverrides = write(persisted);
          try {
            await updateChatMetadata.mutateAsync({
              id: chatId,
              trackerStatIconOverrides: nextOverrides,
            });
            persistedOverridesRef.current.set(chatId, nextOverrides);
          } catch (error) {
            console.error("Failed to persist tracker stat icons", { chatId, error });
            // Rebase queued writes on the last confirmed map so a failed whole-map
            // payload is not replayed by a later icon edit.
          }

          const queued = queuedWritesRef.current.get(chatId);
          queued?.shift();
          if (queued?.length === 0) queuedWritesRef.current.delete(chatId);
          rebuildOptimisticOverrides(chatId);
          write = queuedWritesRef.current.get(chatId)?.[0];
        }
      } finally {
        writingChatIdsRef.current.delete(chatId);
        if (queuedWritesRef.current.get(chatId)?.length) void drainWrites(chatId);
      }
    },
    [rebuildOptimisticOverrides, updateChatMetadata],
  );

  const queueWrite = useCallback(
    (write: StatIconWrite) => {
      if (!activeChatId) return;
      if (!persistedOverridesRef.current.has(activeChatId)) {
        persistedOverridesRef.current.set(activeChatId, getWritableOverrides());
      }
      const queued = queuedWritesRef.current.get(activeChatId) ?? [];
      queued.push(write);
      queuedWritesRef.current.set(activeChatId, queued);
      rebuildOptimisticOverrides(activeChatId);
      void drainWrites(activeChatId);
    },
    [activeChatId, drainWrites, getWritableOverrides, rebuildOptimisticOverrides],
  );

  const persistOwner = queueWrite;

  const personaOwner = activePersona ? `persona:${activePersona.id}` : null;

  return {
    resolvePersonaStatIcon: (statName, occurrence) => {
      const writableOverrides = getWritableOverrides();
      const value = personaOwner
        ? resolveStatIconAssignment(writableOverrides[personaOwner] ?? [], statName, occurrence)
        : undefined;
      const fallback = resolveStatIconAssignment(personaProfileIcons, statName, occurrence) ?? null;
      return { value, displayIcon: value === undefined ? fallback : value };
    },
    setPersonaStatIcon: (statName, occurrence, icon) => {
      if (!personaOwner) return;
      persistOwner((currentOverrides) => {
        const nextOverrides = { ...currentOverrides };
        const assignments = setStatIconAssignment(currentOverrides[personaOwner] ?? [], statName, occurrence, icon);
        if (assignments.length > 0) nextOverrides[personaOwner] = assignments;
        else delete nextOverrides[personaOwner];
        return nextOverrides;
      });
    },
    remapPersonaStatIcons: (previousStats, nextStats, previousIndexForNext) => {
      if (!personaOwner) return;
      persistOwner((currentOverrides) => {
        const nextOverrides = { ...currentOverrides };
        const assignments = remapStatIconAssignments(
          currentOverrides[personaOwner] ?? [],
          previousStats,
          nextStats,
          previousIndexForNext,
        );
        if (assignments.length > 0) nextOverrides[personaOwner] = assignments;
        else delete nextOverrides[personaOwner];
        return nextOverrides;
      });
    },
    resolveCharacterStatIcon: (character, characterIndex, statName, occurrence) => {
      const owners = characterOwnerKeys(character, characterIndex, presentCharacters);
      const { assignments } = resolveOwnerAssignments(getWritableOverrides(), owners);
      const value = resolveStatIconAssignment(assignments, statName, occurrence);
      const profileCharacterId = resolveProfileCharacterId(character);
      const fallback = profileCharacterId
        ? (resolveStatIconAssignment(
            characterProfileColorsById[profileCharacterId]?.trackerCardColors?.statIcons ?? [],
            statName,
            occurrence,
          ) ?? null)
        : null;
      return { value, displayIcon: value === undefined ? fallback : value };
    },
    setCharacterStatIcon: (character, characterIndex, statName, occurrence, icon) => {
      const owners = characterOwnerKeys(character, characterIndex, presentCharacters);
      persistOwner((currentOverrides) => {
        const source = resolveOwnerAssignments(currentOverrides, owners);
        const nextOverrides = { ...currentOverrides };
        if (source.owner !== owners.primary) delete nextOverrides[source.owner];
        const assignments = setStatIconAssignment(source.assignments, statName, occurrence, icon);
        if (assignments.length > 0) nextOverrides[owners.primary] = assignments;
        else delete nextOverrides[owners.primary];
        return nextOverrides;
      });
    },
    remapCharacterStatIcons: (character, characterIndex, previousStats, nextStats, previousIndexForNext) => {
      const owners = characterOwnerKeys(character, characterIndex, presentCharacters);
      persistOwner((currentOverrides) => {
        const source = resolveOwnerAssignments(currentOverrides, owners);
        const nextOverrides = { ...currentOverrides };
        if (source.owner !== owners.primary) delete nextOverrides[source.owner];
        const assignments = remapStatIconAssignments(
          source.assignments,
          previousStats,
          nextStats,
          previousIndexForNext,
        );
        if (assignments.length > 0) nextOverrides[owners.primary] = assignments;
        else delete nextOverrides[owners.primary];
        return nextOverrides;
      });
    },
  };
}
