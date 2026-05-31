import { useCallback } from "react";
import { toast } from "sonner";

import type { CharacterData, RPGStatsConfig } from "../../../../engine/contracts/types/character";
import {
  parseTrackerCardColorConfig,
  serializeTrackerCardColorConfig,
} from "../../../../shared/lib/tracker-card-colors";
import { urlToDataUrl } from "../../../../shared/lib/url-blob";
import { useCreatePersona, useUploadPersonaAvatar } from "../../personas/index";

export function useCharacterEditorImportPersona({
  avatarPreview,
  formData,
}: {
  avatarPreview: string | null;
  formData: CharacterData | null;
}) {
  const createPersona = useCreatePersona();
  const uploadPersonaAvatar = useUploadPersonaAvatar();

  const handleImportAsPersona = useCallback(async () => {
    if (!formData) return;

    const personaName = formData.name.trim();
    if (!personaName) {
      toast.error("Character needs a name before it can be imported as a persona.");
      return;
    }

    const rpgStats = formData.extensions.rpgStats as RPGStatsConfig | undefined;
    const personaStats = rpgStats
      ? {
          enabled: !!rpgStats.enabled,
          bars: [
            { name: "Satiety", value: 100, max: 100, color: "#f59e0b" },
            { name: "Energy", value: 100, max: 100, color: "#22c55e" },
            { name: "Hygiene", value: 100, max: 100, color: "#3b82f6" },
            { name: "Mood", value: 100, max: 100, color: "#ec4899" },
          ],
          rpgStats,
        }
      : null;

    try {
      const created = (await createPersona.mutateAsync({
        name: personaName,
        comment: formData.creator_notes ?? "",
        description: formData.description ?? "",
        personality: formData.personality ?? "",
        scenario: formData.scenario ?? "",
        backstory: (formData.extensions.backstory as string) ?? "",
        appearance: (formData.extensions.appearance as string) ?? "",
        nameColor: (formData.extensions.nameColor as string) ?? "",
        dialogueColor: (formData.extensions.dialogueColor as string) ?? "",
        boxColor: (formData.extensions.boxColor as string) ?? "",
        trackerCardColors: serializeTrackerCardColorConfig(
          parseTrackerCardColorConfig(formData.extensions.trackerCardColors),
        ),
        personaStats,
        altDescriptions: [],
        tags: formData.tags ?? [],
      })) as { id?: string };

      const personaId = created?.id;
      if (!personaId) {
        throw new Error("Persona was created without an id");
      }

      if (avatarPreview) {
        try {
          const avatarDataUrl = await urlToDataUrl(avatarPreview, "Failed to read character avatar");
          const extMatch = avatarDataUrl.match(/^data:image\/([\w+]+)/);
          const ext = extMatch?.[1]?.replace("+xml", "") || "png";
          await uploadPersonaAvatar.mutateAsync({
            id: personaId,
            avatar: avatarDataUrl,
            filename: `persona-${personaId}-${Date.now()}.${ext}`,
          });
        } catch (error) {
          console.warn("[CharacterEditor] Failed to copy avatar to imported persona:", error);
          toast.error("Persona imported, but the avatar could not be copied.");
          return;
        }
      }

      toast.success(`Imported "${personaName}" as a persona.`);
    } catch (error) {
      console.error("[CharacterEditor] Failed to import character as persona:", error);
      toast.error(error instanceof Error ? error.message : "Failed to import character as persona.");
    }
  }, [avatarPreview, createPersona, formData, uploadPersonaAvatar]);

  return {
    handleImportAsPersona,
    isImportingPersona: createPersona.isPending || uploadPersonaAvatar.isPending,
  };
}
