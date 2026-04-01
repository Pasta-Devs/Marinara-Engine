// ──────────────────────────────────────────────
// ModalRenderer: Maps store modal types → components
// ──────────────────────────────────────────────
import { useUIStore } from "../../stores/ui.store";
import { CreateCharacterModal } from "../modals/CreateCharacterModal";
import { ImportCharacterModal } from "../modals/ImportCharacterModal";
import { CharacterMakerModal } from "../modals/CharacterMakerModal";
import { CreateLorebookModal } from "../modals/CreateLorebookModal";
import { ImportLorebookModal } from "../modals/ImportLorebookModal";
import { LorebookMakerModal } from "../modals/LorebookMakerModal";
import { CreatePresetModal } from "../modals/CreatePresetModal";
import { ImportPresetModal } from "../modals/ImportPresetModal";
import { EditAgentModal, type AgentData } from "../modals/EditAgentModal";
import { ImportPersonaModal } from "../modals/ImportPersonaModal";
import { PersonaMakerModal } from "../modals/PersonaMakerModal";
import { STBulkImportModal } from "../modals/STBulkImportModal";

export function ModalRenderer() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);

  const type = modal?.type ?? null;

  return (
    <>
      <CreateCharacterModal open={type === "create-character"} onClose={closeModal} />
      <ImportCharacterModal open={type === "import-character"} onClose={closeModal} />
      <CharacterMakerModal open={type === "character-maker"} onClose={closeModal} />
      <CreateLorebookModal open={type === "create-lorebook"} onClose={closeModal} />
      <ImportLorebookModal open={type === "import-lorebook"} onClose={closeModal} />
      <LorebookMakerModal open={type === "lorebook-maker"} onClose={closeModal} />
      <CreatePresetModal open={type === "create-preset"} onClose={closeModal} />
      <ImportPresetModal open={type === "import-preset"} onClose={closeModal} />
      <EditAgentModal
        open={type === "edit-agent"}
        onClose={closeModal}
        agent={(modal?.props?.agent as AgentData | null) ?? null}
      />
      <ImportPersonaModal open={type === "import-persona"} onClose={closeModal} />
      <PersonaMakerModal open={type === "persona-maker"} onClose={closeModal} />
      <STBulkImportModal open={type === "st-bulk-import"} onClose={closeModal} />
    </>
  );
}
