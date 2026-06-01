import { useCallback, useEffect, useRef, useState } from "react";
import type { Lorebook, LorebookCategory } from "../../../../../engine/contracts/types/lorebook";
import { readBoolFlag } from "./lorebook-editor-utils";

type UpdateLorebook = (input: { id: string } & Record<string, unknown>) => Promise<unknown>;

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

  useEffect(() => {
    if (!lorebook) return;
    const hasSwitchedLorebooks = loadedLorebookIdRef.current !== lorebook.id;
    if (!hasSwitchedLorebooks && lorebookDirty) return;

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
    setLorebookDirty(false);
    loadedLorebookIdRef.current = lorebook.id;
  }, [lorebook, lorebookDirty]);

  const markLorebookDirty = useCallback(() => setLorebookDirty(true), []);

  const handleSaveLorebook = useCallback(async () => {
    if (!lorebookId) return;
    setSaving(true);
    try {
      await onUpdateLorebook({
        id: lorebookId,
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
        characterIds: formIsGlobal ? [] : formCharacterIds,
        personaIds: formIsGlobal ? [] : formPersonaIds,
        tags: formTags,
      });
      setLorebookDirty(false);
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
