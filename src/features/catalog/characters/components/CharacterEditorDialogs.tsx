import { AvatarGenerationModal } from "../../../../shared/components/ui/AvatarGenerationModal";
import { ExportFormatDialog, type ExportFormatChoice } from "../../../../shared/components/ui/ExportFormatDialog";
import { exportApi } from "../../../../shared/api/export-api";
import type { CharacterData } from "../../../../engine/contracts/types/character";
import type { ImageGenerationConnectionOption } from "../../../../shared/types/image-generation";

type CharacterEditorDialogsProps = {
  characterId: string | null;
  formData: CharacterData;
  avatarPreview: string | null;
  imageConnections: ImageGenerationConnectionOption[];
  exportDialogOpen: boolean;
  avatarGeneratorOpen: boolean;
  onCloseExportDialog: () => void;
  onCloseAvatarGenerator: () => void;
  onUseGeneratedAvatar: (avatar: string) => void;
};

export function CharacterEditorDialogs({
  characterId,
  formData,
  avatarPreview,
  imageConnections,
  exportDialogOpen,
  avatarGeneratorOpen,
  onCloseExportDialog,
  onCloseAvatarGenerator,
  onUseGeneratedAvatar,
}: CharacterEditorDialogsProps) {
  return (
    <>
      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Character"
        description="Native keeps Marinara metadata. Compatible exports direct Chara Card V2 JSON for other platforms."
        compatibleDescription="Exports direct Chara Card V2 JSON without the Marinara wrapper."
        showPngOption
        onClose={onCloseExportDialog}
        onSelect={(format: ExportFormatChoice) => {
          if (!characterId) return;
          onCloseExportDialog();
          if (format === "compatible-png") {
            void exportApi.characterPng(characterId).then(exportApi.triggerDownload);
          } else {
            void exportApi.character(characterId, format).then(exportApi.triggerDownload);
          }
        }}
      />
      <AvatarGenerationModal
        open={avatarGeneratorOpen}
        title="Generate Character Avatar"
        entityName={formData.name}
        defaultAppearance={
          ((formData.extensions.appearance as string | undefined) || formData.description || formData.personality) ?? ""
        }
        defaultAvatarUrl={avatarPreview}
        imageConnections={imageConnections}
        onClose={onCloseAvatarGenerator}
        onUseAvatar={onUseGeneratedAvatar}
      />
    </>
  );
}
