import {
  MariInstructionDetail,
  MariWorkspaceStatus,
  MariWorkspaceSkillDetail,
  MariInstructionMutationResponse,
} from "@marinara-engine/shared";
import { RefObject, Dispatch, SetStateAction, useCallback, ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../lib/api-client";
import { ProfessorMariWorkspaceDestination } from "../../../lib/professor-mari-workspace-navigation";
import { MemoryDraftState, SkillDraftState } from "../MariPanelControls";
import { WorkspaceSkillMutationResponse, NEW_SKILL_CONTENT } from "./mari-chat-helpers";

/** The Skills and Memories panels' actions: create, upload, save, toggle and delete (#4851 for memories). */
type MariSkillMemoryActionsInput = {
  loadMemories: () => Promise<void>;
  loadSkills: () => Promise<void>;
  memories: MariInstructionDetail[];
  memoryDraft: MemoryDraftState;
  memoryFileInputRef: RefObject<HTMLInputElement | null>;
  refreshWorkspaceStatus: (shouldApply?: () => boolean) => Promise<MariWorkspaceStatus>;
  selectedMemory: MariInstructionDetail | null;
  selectedSkill: MariWorkspaceSkillDetail | null;
  setMemoriesSaving: Dispatch<SetStateAction<boolean>>;
  setSelectedMemoryId: Dispatch<SetStateAction<string | null>>;
  setSelectedSkillId: Dispatch<SetStateAction<string | null>>;
  setSkillsSaving: Dispatch<SetStateAction<boolean>>;
  setWorkspaceDestination: Dispatch<SetStateAction<ProfessorMariWorkspaceDestination>>;
  skillDraft: SkillDraftState;
  skillFileInputRef: RefObject<HTMLInputElement | null>;
  skills: MariWorkspaceSkillDetail[];
};

export function useMariSkillMemoryActions({
  loadMemories,
  loadSkills,
  memories,
  memoryDraft,
  memoryFileInputRef,
  refreshWorkspaceStatus,
  selectedMemory,
  selectedSkill,
  setMemoriesSaving,
  setSelectedMemoryId,
  setSelectedSkillId,
  setSkillsSaving,
  setWorkspaceDestination,
  skillDraft,
  skillFileInputRef,
  skills,
}: MariSkillMemoryActionsInput) {
  const { t: localizeUi } = useTranslation();
  const createSkillFromContent = useCallback(
    async (input: { content: string; fileName?: string; name?: string; description?: string }) => {
      setSkillsSaving(true);
      try {
        const result = await api.post<WorkspaceSkillMutationResponse>("/professor-mari/workspace/skills", {
          ...input,
          enabled: true,
        });
        await loadSkills();
        setSelectedSkillId(result.skill.id);
        setWorkspaceDestination("skills");
        await refreshWorkspaceStatus().catch(() => undefined);
        toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariSkillAdded"));
      } finally {
        setSkillsSaving(false);
      }
    },
    [setSkillsSaving, loadSkills, setSelectedSkillId, setWorkspaceDestination, refreshWorkspaceStatus, localizeUi],
  );

  const handleNewSkill = useCallback(() => {
    void createSkillFromContent({
      name: "custom-skill",
      description: "User-defined Professor Mari skill.",
      content: NEW_SKILL_CONTENT,
    }).catch((error) => {
      console.error("[Professor Mari] Failed to create skill", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotAddThatSkill"));
    });
  }, [createSkillFromContent, localizeUi]);

  const handleSkillUploadClick = useCallback(() => {
    skillFileInputRef.current?.click();
  }, [skillFileInputRef]);

  const handleSkillFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (!file) return;
      void file
        .text()
        .then((content) => createSkillFromContent({ content, fileName: file.name }))
        .catch((error) => {
          console.error("[Professor Mari] Failed to upload skill", error);
          toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUploadThatSkill"));
        });
    },
    [createSkillFromContent, localizeUi],
  );

  const handleSaveSkill = useCallback(async () => {
    if (!selectedSkill) return;
    setSkillsSaving(true);
    try {
      const result = await api.put<WorkspaceSkillMutationResponse>(
        `/professor-mari/workspace/skills/${selectedSkill.id}`,
        {
          name: skillDraft.name,
          description: skillDraft.description,
          content: skillDraft.content,
        },
      );
      await loadSkills();
      setSelectedSkillId(result.skill.id);
      await refreshWorkspaceStatus().catch(() => undefined);
      toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariSkillSaved"));
    } catch (error) {
      console.error("[Professor Mari] Failed to save skill", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotSaveThatSkill"));
    } finally {
      setSkillsSaving(false);
    }
  }, [
    selectedSkill,
    setSkillsSaving,
    skillDraft.name,
    skillDraft.description,
    skillDraft.content,
    loadSkills,
    setSelectedSkillId,
    refreshWorkspaceStatus,
    localizeUi,
  ]);

  const handleToggleSkill = useCallback(
    async (skill: MariWorkspaceSkillDetail) => {
      setSkillsSaving(true);
      try {
        await api.put<WorkspaceSkillMutationResponse>(`/professor-mari/workspace/skills/${skill.id}`, {
          enabled: !skill.enabled,
        });
        await loadSkills();
        await refreshWorkspaceStatus().catch(() => undefined);
      } catch (error) {
        console.error("[Professor Mari] Failed to toggle skill", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUpdateThatSkill"));
      } finally {
        setSkillsSaving(false);
      }
    },
    [setSkillsSaving, loadSkills, refreshWorkspaceStatus, localizeUi],
  );

  const handleDeleteSkill = useCallback(
    async (id: string) => {
      const skill = skills.find((entry) => entry.id === id);
      if (!skill) return;
      if (!window.confirm(localizeUi("ui.chat.homeprofessormarichat.deleteValue1", { value1: skill.name }))) return;
      setSkillsSaving(true);
      try {
        await api.delete(`/professor-mari/workspace/skills/${id}`);
        setSelectedSkillId((current) => (current === id ? null : current));
        await loadSkills();
        await refreshWorkspaceStatus().catch(() => undefined);
        toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariSkillDeleted"));
      } catch (error) {
        console.error("[Professor Mari] Failed to delete skill", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteThatSkill"));
      } finally {
        setSkillsSaving(false);
      }
    },
    [skills, localizeUi, setSkillsSaving, setSelectedSkillId, loadSkills, refreshWorkspaceStatus],
  );

  // #4851: Memories panel handlers. Direct writes to /instructions (reset-free); new
  // memories default disabled (the user enables them from the row switch).
  const createMemory = useCallback(
    async (input: { content: string; name?: string; description?: string }) => {
      setMemoriesSaving(true);
      try {
        const result = await api.post<MariInstructionMutationResponse>("/professor-mari/workspace/instructions", {
          name: input.name?.trim() || "New memory",
          description: input.description ?? "",
          content: input.content,
        });
        await loadMemories();
        setSelectedMemoryId(result.instruction.id);
        setWorkspaceDestination("memories");
        toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariMemoryAdded"));
      } finally {
        setMemoriesSaving(false);
      }
    },
    [loadMemories, localizeUi, setMemoriesSaving, setSelectedMemoryId, setWorkspaceDestination],
  );

  const handleNewMemory = useCallback(() => {
    void createMemory({
      name: "New memory",
      content: "Describe a preference or instruction for Professor Mari.",
    }).catch((error) => {
      console.error("[Professor Mari] Failed to create memory", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotAddThatMemory"));
    });
  }, [createMemory, localizeUi]);

  const handleMemoryUploadClick = useCallback(() => {
    memoryFileInputRef.current?.click();
  }, [memoryFileInputRef]);

  const handleMemoryFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (!file) return;
      // A memory's content is capped server-side at 20k CHARS. UTF-8 chars are up to 4 bytes, so use a
      // generous byte ceiling just to avoid reading a huge file, then validate the exact character
      // length after reading (so a valid multibyte memory, e.g. emoji, is not wrongly rejected).
      const MEMORY_CONTENT_CHAR_CAP = 20_000;
      if (file.size > 4 * MEMORY_CONTENT_CHAR_CAP) {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.thatMemoryFileIsTooLarge"));
        return;
      }
      const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      void file
        .text()
        .then((content) => {
          if (content.trim().length > MEMORY_CONTENT_CHAR_CAP) {
            toast.error(localizeUi("ui.chat.homeprofessormarichat.thatMemoryFileIsTooLarge"));
            return undefined;
          }
          return createMemory({ content, name: baseName || undefined });
        })
        .catch((error) => {
          console.error("[Professor Mari] Failed to upload memory", error);
          toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUploadThatMemory"));
        });
    },
    [createMemory, localizeUi],
  );

  const handleSaveMemory = useCallback(async () => {
    if (!selectedMemory) return;
    setMemoriesSaving(true);
    try {
      const result = await api.put<MariInstructionMutationResponse>(
        `/professor-mari/workspace/instructions/${selectedMemory.id}`,
        { name: memoryDraft.name, description: memoryDraft.description, content: memoryDraft.content },
      );
      await loadMemories();
      setSelectedMemoryId(result.instruction.id);
      toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariMemorySaved"));
    } catch (error) {
      console.error("[Professor Mari] Failed to save memory", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotSaveThatMemory"));
    } finally {
      setMemoriesSaving(false);
    }
  }, [
    selectedMemory,
    setMemoriesSaving,
    memoryDraft.name,
    memoryDraft.description,
    memoryDraft.content,
    loadMemories,
    setSelectedMemoryId,
    localizeUi,
  ]);

  const patchMemoryFlag = useCallback(
    async (memory: MariInstructionDetail, patch: { enabled?: boolean; persistent?: boolean }) => {
      setMemoriesSaving(true);
      try {
        await api.put<MariInstructionMutationResponse>(`/professor-mari/workspace/instructions/${memory.id}`, patch);
        await loadMemories();
      } catch (error) {
        console.error("[Professor Mari] Failed to update memory", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUpdateThatMemory"));
      } finally {
        setMemoriesSaving(false);
      }
    },
    [loadMemories, localizeUi, setMemoriesSaving],
  );

  const handleToggleMemoryEnabled = useCallback(
    (memory: MariInstructionDetail) => void patchMemoryFlag(memory, { enabled: !memory.enabled }),
    [patchMemoryFlag],
  );

  const handleToggleMemoryPersistent = useCallback(
    (memory: MariInstructionDetail) => void patchMemoryFlag(memory, { persistent: !memory.persistent }),
    [patchMemoryFlag],
  );

  const handleDeleteMemory = useCallback(
    async (id: string) => {
      const memory = memories.find((entry) => entry.id === id);
      if (!memory) return;
      if (!window.confirm(localizeUi("ui.chat.homeprofessormarichat.deleteValue1", { value1: memory.name }))) return;
      setMemoriesSaving(true);
      try {
        await api.delete(`/professor-mari/workspace/instructions/${id}`);
        setSelectedMemoryId((current) => (current === id ? null : current));
        await loadMemories();
        toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariMemoryDeleted"));
      } catch (error) {
        console.error("[Professor Mari] Failed to delete memory", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteThatMemory"));
      } finally {
        setMemoriesSaving(false);
      }
    },
    [memories, localizeUi, setMemoriesSaving, setSelectedMemoryId, loadMemories],
  );
  return {
    handleNewSkill,
    handleSkillUploadClick,
    handleSkillFileChange,
    handleSaveSkill,
    handleToggleSkill,
    handleDeleteSkill,
    handleNewMemory,
    handleMemoryUploadClick,
    handleMemoryFileChange,
    handleSaveMemory,
    handleToggleMemoryEnabled,
    handleToggleMemoryPersistent,
    handleDeleteMemory,
  };
}
