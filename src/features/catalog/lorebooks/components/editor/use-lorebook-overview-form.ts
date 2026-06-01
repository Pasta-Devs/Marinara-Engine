import { useCallback, useEffect, useRef, useState } from "react";
import type { Lorebook, LorebookCategory } from "../../../../../engine/contracts/types/lorebook";
import { readBoolFlag } from "./lorebook-editor-utils";

type UpdateLorebook = (input: { id: string } & Record<string, unknown>) => Promise<unknown>;

type LorebookOverviewFormSnapshot = {
  name: string;
  description: string;
  category: LorebookCategory;
  enabled: boolean;
  isGlobal: boolean;
  excludeFromVectorization: boolean;
  scanDepth: number;
  tokenBudget: number;
  recursiveScanning: boolean;
  maxRecursionDepth: number;
  characterIds: string[];
  personaIds: string[];
  tags: string[];
};

function arrayEquals(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function snapshotsEqual(left: LorebookOverviewFormSnapshot | null, right: LorebookOverviewFormSnapshot): boolean {
  return (
    left !== null &&
    left.name === right.name &&
    left.description === right.description &&
    left.category === right.category &&
    left.enabled === right.enabled &&
    left.isGlobal === right.isGlobal &&
    left.excludeFromVectorization === right.excludeFromVectorization &&
    left.scanDepth === right.scanDepth &&
    left.tokenBudget === right.tokenBudget &&
    left.recursiveScanning === right.recursiveScanning &&
    left.maxRecursionDepth === right.maxRecursionDepth &&
    arrayEquals(left.characterIds, right.characterIds) &&
    arrayEquals(left.personaIds, right.personaIds) &&
    arrayEquals(left.tags, right.tags)
  );
}

export function useLorebookOverviewForm({
  lorebook,
  lorebookId,
  onUpdateLorebook,
}: {
  lorebook: Lorebook | undefined;
  lorebookId: string | null;
  onUpdateLorebook: UpdateLorebook;
}) {
  const [lorebookDirty, setLorebookDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<LorebookCategory>("uncategorized");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formIsGlobal, setFormIsGlobal] = useState(false);
  const [formExcludeFromVectorization, setFormExcludeFromVectorization] = useState(false);
  const [formScanDepth, setFormScanDepth] = useState(2);
  const [formTokenBudget, setFormTokenBudget] = useState(2048);
  const [formRecursive, setFormRecursive] = useState(false);
  const [formMaxRecursionDepth, setFormMaxRecursionDepth] = useState(3);
  const [formCharacterIds, setFormCharacterIds] = useState<string[]>([]);
  const [formPersonaIds, setFormPersonaIds] = useState<string[]>([]);
  const [formTags, setFormTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [characterLinkSearch, setCharacterLinkSearch] = useState("");
  const [personaLinkSearch, setPersonaLinkSearch] = useState("");
  const [characterLinkPickerOpen, setCharacterLinkPickerOpen] = useState(false);
  const [personaLinkPickerOpen, setPersonaLinkPickerOpen] = useState(false);
  const loadedLorebookIdRef = useRef<string | null>(null);
  const formSnapshotRef = useRef<LorebookOverviewFormSnapshot | null>(null);
  const dirtyVersionRef = useRef(0);

  useEffect(() => {
    if (!lorebook) return;
    const hasSwitchedLorebooks = loadedLorebookIdRef.current !== lorebook.id;
    if (!hasSwitchedLorebooks) return;

    setFormName(lorebook.name);
    setFormDescription(lorebook.description);
    setFormCategory(lorebook.category);
    setFormEnabled(lorebook.enabled);
    setFormIsGlobal(lorebook.isGlobal ?? false);
    setFormExcludeFromVectorization(readBoolFlag(lorebook.excludeFromVectorization));
    setFormScanDepth(lorebook.scanDepth);
    setFormTokenBudget(lorebook.tokenBudget);
    setFormRecursive(lorebook.recursiveScanning);
    setFormMaxRecursionDepth(lorebook.maxRecursionDepth ?? 3);
    const characterSource =
      Array.isArray(lorebook.characterIds) && lorebook.characterIds.length > 0
        ? lorebook.characterIds
        : lorebook.characterId
          ? [lorebook.characterId]
          : [];
    const personaSource =
      Array.isArray(lorebook.personaIds) && lorebook.personaIds.length > 0
        ? lorebook.personaIds
        : lorebook.personaId
          ? [lorebook.personaId]
          : [];
    setFormCharacterIds(Array.from(new Set(characterSource)));
    setFormPersonaIds(Array.from(new Set(personaSource)));
    setFormTags(lorebook.tags ?? []);
    dirtyVersionRef.current = 0;
    setLorebookDirty(false);
    loadedLorebookIdRef.current = lorebook.id;
  }, [lorebook]);

  useEffect(() => {
    formSnapshotRef.current = {
      name: formName,
      description: formDescription,
      category: formCategory,
      enabled: formEnabled,
      isGlobal: formIsGlobal,
      excludeFromVectorization: formExcludeFromVectorization,
      scanDepth: formScanDepth,
      tokenBudget: formTokenBudget,
      recursiveScanning: formRecursive,
      maxRecursionDepth: formMaxRecursionDepth,
      characterIds: [...formCharacterIds],
      personaIds: [...formPersonaIds],
      tags: [...formTags],
    };
  }, [
    formName,
    formDescription,
    formCategory,
    formEnabled,
    formIsGlobal,
    formExcludeFromVectorization,
    formScanDepth,
    formTokenBudget,
    formRecursive,
    formMaxRecursionDepth,
    formCharacterIds,
    formPersonaIds,
    formTags,
  ]);

  const markLorebookDirty = useCallback(() => {
    dirtyVersionRef.current += 1;
    setLorebookDirty(true);
  }, []);

  const handleSaveLorebook = useCallback(async () => {
    if (!lorebookId) return;
    const saveSnapshot: LorebookOverviewFormSnapshot = {
      name: formName,
      description: formDescription,
      category: formCategory,
      enabled: formEnabled,
      isGlobal: formIsGlobal,
      excludeFromVectorization: formExcludeFromVectorization,
      scanDepth: formScanDepth,
      tokenBudget: formTokenBudget,
      recursiveScanning: formRecursive,
      maxRecursionDepth: formMaxRecursionDepth,
      characterIds: [...formCharacterIds],
      personaIds: [...formPersonaIds],
      tags: [...formTags],
    };
    formSnapshotRef.current = saveSnapshot;
    const saveVersion = dirtyVersionRef.current;
    setSaving(true);
    try {
      await onUpdateLorebook({
        id: lorebookId,
        name: saveSnapshot.name,
        description: saveSnapshot.description,
        category: saveSnapshot.category,
        enabled: saveSnapshot.enabled,
        isGlobal: saveSnapshot.isGlobal,
        excludeFromVectorization: saveSnapshot.excludeFromVectorization,
        scanDepth: saveSnapshot.scanDepth,
        tokenBudget: saveSnapshot.tokenBudget,
        recursiveScanning: saveSnapshot.recursiveScanning,
        maxRecursionDepth: saveSnapshot.maxRecursionDepth,
        characterIds: saveSnapshot.isGlobal ? [] : saveSnapshot.characterIds,
        personaIds: saveSnapshot.isGlobal ? [] : saveSnapshot.personaIds,
        tags: saveSnapshot.tags,
      });
      if (dirtyVersionRef.current === saveVersion && snapshotsEqual(formSnapshotRef.current, saveSnapshot)) {
        setLorebookDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }, [
    lorebookId,
    formName,
    formDescription,
    formCategory,
    formEnabled,
    formIsGlobal,
    formExcludeFromVectorization,
    formScanDepth,
    formTokenBudget,
    formRecursive,
    formMaxRecursionDepth,
    formCharacterIds,
    formPersonaIds,
    formTags,
    onUpdateLorebook,
  ]);

  return {
    lorebookDirty,
    setLorebookDirty,
    saving,
    formName,
    formDescription,
    formCategory,
    formEnabled,
    formIsGlobal,
    formExcludeFromVectorization,
    formScanDepth,
    formTokenBudget,
    formRecursive,
    formMaxRecursionDepth,
    formCharacterIds,
    formPersonaIds,
    formTags,
    newTag,
    characterLinkSearch,
    personaLinkSearch,
    characterLinkPickerOpen,
    personaLinkPickerOpen,
    setFormName,
    setFormDescription,
    setFormCategory,
    setFormEnabled,
    setFormIsGlobal,
    setFormExcludeFromVectorization,
    setFormScanDepth,
    setFormTokenBudget,
    setFormRecursive,
    setFormMaxRecursionDepth,
    setFormCharacterIds,
    setFormPersonaIds,
    setFormTags,
    setNewTag,
    setCharacterLinkSearch,
    setPersonaLinkSearch,
    setCharacterLinkPickerOpen,
    setPersonaLinkPickerOpen,
    markLorebookDirty,
    handleSaveLorebook,
  };
}
