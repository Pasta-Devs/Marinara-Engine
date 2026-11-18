// ──────────────────────────────────────────────
// The editor's ⋯ actions for a newer release of this character's card:
// "Update from card file…" picks a card file (PNG, JSON, CharX) and updates this character in place, and
// "Check for update" opens the card's Card Browser page when it was downloaded there. Both keep the character's
// chats, memories, gallery, sprites and folder; the old card is saved to Version history first.
// ──────────────────────────────────────────────
import { useRef, useState } from "react";
import { FileUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { characterKeys } from "../../hooks/use-characters";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { api } from "../../lib/api-client";
import { inspectCharacterFiles } from "../../lib/character-import";
import { useUIStore } from "../../stores/ui.store";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_SECONDARY } from "../ui/neutral-surface-styles";
import { Spinner } from "../ui/Spinner";
import type { ContextMenuItem } from "../ui/ContextMenu";
import {
  CardUpdateChoices,
  findCardUpdateMatches,
  isCardUpdate,
  type CardUpdateDecision,
  type CardUpdateRow,
  type CreatorNotesUpdate,
} from "./CardUpdateChoices";

const CARD_FILE_TYPES = ".png,.json,.charx";

/** Where a Card Browser download came from: `extensions.botBrowserSource` is "<source>:<card id>". */
export function readBotBrowserSource(value: unknown): { source: string; id: string } | null {
  if (typeof value !== "string") return null;
  const at = value.indexOf(":");
  if (at <= 0 || at === value.length - 1) return null;
  return { source: value.slice(0, at), id: value.slice(at + 1) };
}

export function useCharacterCardUpdate({
  characterId,
  name,
  botBrowserSource,
  dirty,
}: {
  characterId: string | null;
  name: string;
  botBrowserSource: unknown;
  /** Unsaved edits block an update, which would replace the card under them. */
  dirty: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; row: CardUpdateRow } | null>(null);
  const [decision, setDecision] = useState<CardUpdateDecision>("skip");
  const [useCardPicture, setUseCardPicture] = useState(true);
  const [creatorNotes, setCreatorNotes] = useState<CreatorNotesUpdate>("merge");
  const [working, setWorking] = useState(false);
  const source = readBotBrowserSource(botBrowserSource);

  const blockedByEdits = () => {
    if (!dirty) return false;
    toast.error(t("ui.cardUpdate.saveFirst"));
    return true;
  };

  const pickFile = async (file: File) => {
    if (!characterId) return;
    setWorking(true);
    try {
      const [inspection] = await inspectCharacterFiles([file]);
      if (!inspection?.success) {
        toast.error(inspection?.error ?? t("ui.modals.importcharactermodal.importFailed"));
        return;
      }
      const matches = await findCardUpdateMatches({ characterId });
      if (matches.length === 0) {
        toast.error(t("ui.cardUpdate.characterGone"));
        return;
      }
      setDecision(characterId);
      setUseCardPicture(true);
      setCreatorNotes("merge");
      setPending({
        file,
        row: { key: "file", name: inspection.name ?? file.name, version: inspection.version, matches },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.modals.importcharactermodal.importFailed"));
    } finally {
      setWorking(false);
    }
  };

  const runUpdate = async () => {
    if (!pending || !isCardUpdate(decision)) {
      setPending(null);
      return;
    }
    setWorking(true);
    try {
      const form = new FormData();
      form.append("files", pending.file);
      form.append(
        "updateTargets",
        JSON.stringify([{ index: 0, name: pending.file.name, characterId: decision, useCardPicture, creatorNotes }]),
      );
      const result = await api.upload<{
        results: Array<{ success: boolean; name?: string; error?: string; lorebookError?: string; lorebook?: unknown }>;
      }>("/import/st-character/batch", form);
      const row = result.results[0];
      if (!row?.success) throw new Error(row?.error ?? t("ui.modals.importcharactermodal.importFailed"));
      const updatedName = row.name ?? name;
      if (row.lorebookError)
        toast.warning(t("ui.cardUpdate.updatedLorebookFailed", { name: updatedName, error: row.lorebookError }));
      else toast.success(t("ui.cardUpdate.updatedName", { name: updatedName }));
      setPending(null);
      void qc.invalidateQueries({ queryKey: characterKeys.all });
      if (row.lorebook) void qc.invalidateQueries({ queryKey: lorebookKeys.all });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.modals.importcharactermodal.importFailed"));
    } finally {
      setWorking(false);
    }
  };

  const menuItems: ContextMenuItem[] = [
    {
      label: t("ui.cardUpdate.updateFromFile"),
      icon: <FileUp size="0.75rem" />,
      disabled: !characterId || working,
      onSelect: () => {
        if (blockedByEdits()) return;
        fileRef.current?.click();
      },
    },
    ...(source
      ? [
          {
            label: t("ui.cardUpdate.checkForUpdate"),
            icon: <RefreshCw size="0.75rem" />,
            disabled: !characterId,
            onSelect: () => {
              if (blockedByEdits()) return;
              useUIStore.getState().openBotBrowserCard({ source: source.source, id: source.id, name });
            },
          },
        ]
      : []),
  ];

  const element = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={CARD_FILE_TYPES}
        className="hidden"
        data-card-update-file
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void pickFile(file);
        }}
      />
      <Modal
        open={pending !== null}
        onClose={() => {
          if (!working) setPending(null);
        }}
        title={t("ui.cardUpdate.updateFromFileTitle")}
        width="max-w-lg"
        closeDisabled={working}
        footer={
          <>
            <button
              type="button"
              disabled={working || !isCardUpdate(decision)}
              data-card-update-continue
              onClick={() => void runUpdate()}
              className={SHEET_BUTTON_PRIMARY}
            >
              {working ? <Spinner size="sm" /> : <RefreshCw size="0.75rem" />}
              {t("ui.cardUpdate.updateButton")}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => setPending(null)}
              className={SHEET_BUTTON_SECONDARY}
            >
              {t("ui.cardUpdate.cancel")}
            </button>
          </>
        }
      >
        {pending ? (
          <CardUpdateChoices
            rows={[pending.row]}
            decisions={{ [pending.row.key]: decision }}
            onDecisionChange={(_key, next) => setDecision(next)}
            useCardPicture={useCardPicture}
            onUseCardPictureChange={setUseCardPicture}
            creatorNotes={creatorNotes}
            onCreatorNotesChange={setCreatorNotes}
            allowNew={false}
          />
        ) : null}
      </Modal>
    </>
  );

  return { menuItems, element };
}
