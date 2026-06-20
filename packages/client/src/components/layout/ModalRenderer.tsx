// ──────────────────────────────────────────────
// ModalRenderer: Maps store modal types → components
// ──────────────────────────────────────────────
import { lazy, Suspense } from "react";
import { useUIStore } from "../../stores/ui.store";
import type { AgentData } from "../modals/EditAgentModal";
import type { LorebookCategory, LorebookScope } from "@marinara-engine/shared";

const CreateCharacterModal = lazy(() =>
  import("../modals/CreateCharacterModal").then((module) => ({ default: module.CreateCharacterModal })),
);
const ImportCharacterModal = lazy(() =>
  import("../modals/ImportCharacterModal").then((module) => ({ default: module.ImportCharacterModal })),
);
const CreateLorebookModal = lazy(() =>
  import("../modals/CreateLorebookModal").then((module) => ({ default: module.CreateLorebookModal })),
);
const ImportLorebookModal = lazy(() =>
  import("../modals/ImportLorebookModal").then((module) => ({ default: module.ImportLorebookModal })),
);
const CreatePresetModal = lazy(() =>
  import("../modals/CreatePresetModal").then((module) => ({ default: module.CreatePresetModal })),
);
const ImportPresetModal = lazy(() =>
  import("../modals/ImportPresetModal").then((module) => ({ default: module.ImportPresetModal })),
);
const EditAgentModal = lazy(() =>
  import("../modals/EditAgentModal").then((module) => ({ default: module.EditAgentModal })),
);
const STBulkImportModal = lazy(() =>
  import("../modals/STBulkImportModal").then((module) => ({ default: module.STBulkImportModal })),
);
const ImportPersonaModal = lazy(() =>
  import("../modals/ImportPersonaModal").then((module) => ({ default: module.ImportPersonaModal })),
);
const CreateConnectionModal = lazy(() =>
  import("../modals/CreateConnectionModal").then((module) => ({ default: module.CreateConnectionModal })),
);
const ImportConnectionModal = lazy(() =>
  import("../modals/ImportConnectionModal").then((module) => ({ default: module.ImportConnectionModal })),
);
const CreatePersonaModal = lazy(() =>
  import("../modals/CreatePersonaModal").then((module) => ({ default: module.CreatePersonaModal })),
);
const CharacterCardUpdateModal = lazy(() =>
  import("../modals/CharacterCardUpdateModal").then((module) => ({ default: module.CharacterCardUpdateModal })),
);
const AgentWriteApprovalModal = lazy(() =>
  import("../modals/AgentWriteApprovalModal").then((module) => ({ default: module.AgentWriteApprovalModal })),
);

export function ModalRenderer() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);

  const type = modal?.type ?? null;
  if (!type) return null;

  let content = null;
  switch (type) {
    case "create-character":
      content = <CreateCharacterModal open onClose={closeModal} />;
      break;
    case "import-character":
      content = <ImportCharacterModal open onClose={closeModal} />;
      break;
    case "create-lorebook":
      content = (
        <CreateLorebookModal
          open
          onClose={closeModal}
          defaultCategory={(modal?.props?.defaultCategory as LorebookCategory | undefined) ?? undefined}
          characterId={(modal?.props?.characterId as string | null | undefined) ?? null}
          personaId={(modal?.props?.personaId as string | null | undefined) ?? null}
          defaultScope={(modal?.props?.defaultScope as LorebookScope | null | undefined) ?? null}
        />
      );
      break;
    case "import-lorebook":
      content = <ImportLorebookModal open onClose={closeModal} />;
      break;
    case "create-preset":
      content = <CreatePresetModal open onClose={closeModal} />;
      break;
    case "import-preset":
      content = <ImportPresetModal open onClose={closeModal} />;
      break;
    case "edit-agent":
      content = <EditAgentModal open onClose={closeModal} agent={(modal?.props?.agent as AgentData | null) ?? null} />;
      break;
    case "import-persona":
      content = <ImportPersonaModal open onClose={closeModal} />;
      break;
    case "create-connection":
      content = <CreateConnectionModal open onClose={closeModal} />;
      break;
    case "import-connection":
      content = <ImportConnectionModal open onClose={closeModal} />;
      break;
    case "create-persona":
      content = <CreatePersonaModal open onClose={closeModal} />;
      break;
    case "st-bulk-import":
      content = <STBulkImportModal open onClose={closeModal} />;
      break;
    case "character-card-update":
      content = <CharacterCardUpdateModal open onClose={closeModal} />;
      break;
    case "agent-write-approval":
      content = <AgentWriteApprovalModal open onClose={closeModal} />;
      break;
    default:
      content = null;
  }

  return <Suspense fallback={null}>{content}</Suspense>;
}
