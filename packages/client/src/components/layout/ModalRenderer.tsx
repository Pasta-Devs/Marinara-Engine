// ──────────────────────────────────────────────
// ModalRenderer: Maps store modal types → components
// ──────────────────────────────────────────────
import { lazy, Suspense } from "react";
import { useUIStore } from "../../stores/ui.store";
import {
  normalizeAvatarCrop,
  type LorebookCategory,
  type LorebookScope,
  type ScenePromptPreferences,
} from "@marinara-engine/shared";

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
const DocsViewerModal = lazy(() =>
  import("../modals/DocsViewerModal").then((module) => ({ default: module.DocsViewerModal })),
);
const AboutMeViewerModal = lazy(() =>
  import("../modals/AboutMeViewerModal").then((module) => ({ default: module.AboutMeViewerModal })),
);
const ScenePromptPreferencesModal = lazy(() =>
  import("../modals/ScenePromptPreferencesModal").then((module) => ({
    default: module.ScenePromptPreferencesModal,
  })),
);
const StartCharacterChatModal = lazy(() =>
  import("../modals/StartCharacterChatModal").then((module) => ({
    default: module.StartCharacterChatModal,
  })),
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
    case "docs-viewer":
      content = (
        <DocsViewerModal open onClose={closeModal} initialDoc={(modal?.props?.initialDoc as string | null) ?? null} />
      );
      break;
    case "about-me-viewer":
      content = (
        <AboutMeViewerModal
          open
          onClose={closeModal}
          kind={(modal?.props?.kind as "character" | "persona") ?? "character"}
          id={(modal?.props?.id as string) ?? ""}
          anchorRect={
            (modal?.props?.anchorRect as {
              top: number;
              left: number;
              right: number;
              bottom: number;
              width: number;
              height: number;
            } | null) ?? null
          }
          avatarUrl={(modal?.props?.avatarUrl as string | null) ?? null}
          avatarCrop={normalizeAvatarCrop(modal?.props?.avatarCrop)}
          displayName={(modal?.props?.displayName as string | null) ?? null}
          nameColor={(modal?.props?.nameColor as string | null) ?? null}
          status={(modal?.props?.status as "online" | "idle" | "dnd" | "offline" | null) ?? null}
          activity={(modal?.props?.activity as string | null) ?? null}
        />
      );
      break;
    case "scene-prompt-preferences":
      content = (
        <ScenePromptPreferencesModal
          open
          onClose={closeModal}
          initialPreferences={modal?.props?.initialPreferences as ScenePromptPreferences}
          sourceLabel={(modal?.props?.sourceLabel as string | null) ?? null}
          onSubmit={modal?.props?.onSubmit as (preferences: ScenePromptPreferences) => void}
          onCancel={modal?.props?.onCancel as (() => void) | undefined}
        />
      );
      break;
    case "start-character-chat":
      content = (
        <StartCharacterChatModal
          open
          onClose={closeModal}
          characterId={(modal?.props?.characterId as string) ?? ""}
          characterName={(modal?.props?.characterName as string) ?? ""}
        />
      );
      break;
    default:
      content = null;
  }

  return <Suspense fallback={null}>{content}</Suspense>;
}
