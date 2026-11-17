// ──────────────────────────────────────────────
// Lorebook Editor: bulk edit panel
// Shown in selection mode. Each action is one atomic request against the
// whole selection (enable, constant, folder, keys, probability, order, depth).
// Collapsed by default so the selection toolbar stays small.
// ──────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  parseLorebookBulkKeyText,
  type LorebookBulkEditInput,
  type LorebookBulkKeyField,
  type LorebookBulkSet,
  type LorebookFolder,
} from "@marinara-engine/shared";
import { useBulkEditLorebookEntries } from "../../hooks/use-lorebooks";
import { cn } from "../../lib/utils";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";

interface Props {
  lorebookId: string;
  selectedIds: ReadonlySet<string>;
  folders: LorebookFolder[];
  /** Another batch operation (copy, move, delete) is running. */
  busy?: boolean;
}

const ROOT_FOLDER = "__root__";

function folderPathLabels(folders: LorebookFolder[]): Array<{ id: string; label: string }> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const labelFor = (folder: LorebookFolder) => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let current: LorebookFolder | undefined = folder;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(current.name);
      current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
    }
    return parts.join(" / ");
  };
  return folders
    .map((folder) => ({ id: folder.id, label: labelFor(folder) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-full text-[0.625rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)] sm:w-20 sm:shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

export function LorebookBulkEditPanel({ lorebookId, selectedIds, folders, busy = false }: Props) {
  const { t } = useTranslation();
  const bulkEdit = useBulkEditLorebookEntries();
  const [open, setOpen] = useState(false);
  const [folderChoice, setFolderChoice] = useState("");
  const [keyField, setKeyField] = useState<LorebookBulkKeyField>("keys");
  const [keyText, setKeyText] = useState("");
  const [probability, setProbability] = useState("");
  const [order, setOrder] = useState("");
  const [depth, setDepth] = useState("");
  const folderOptions = useMemo(() => folderPathLabels(folders), [folders]);

  const count = selectedIds.size;
  const disabled = count === 0 || busy || bulkEdit.isPending;
  const parsedKeys = parseLorebookBulkKeyText(keyText);
  const probabilityValue = probability.trim() === "" ? null : Number(probability);
  const probabilityValid =
    probabilityValue === null ||
    (Number.isFinite(probabilityValue) && probabilityValue >= 0 && probabilityValue <= 100);
  const orderValue = Number(order);
  const orderValid = order.trim() !== "" && Number.isInteger(orderValue);
  const depthValue = Number(depth);
  const depthValid = depth.trim() !== "" && Number.isInteger(depthValue) && depthValue >= 0;

  const apply = async (edit: Omit<LorebookBulkEditInput, "entryIds">, onSuccess?: () => void) => {
    if (count === 0) return;
    try {
      const result = await bulkEdit.mutateAsync({ lorebookId, entryIds: Array.from(selectedIds), ...edit });
      toast.success(t("lorebook.editor.bulk.applied", { count: result.updated }));
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("lorebook.editor.batch.updateFailure"));
    }
  };
  const applySet = (set: LorebookBulkSet, onSuccess?: () => void) => void apply({ set }, onSuccess);

  const buttonClass =
    "mari-editor-action mari-editor-action--compact px-2.5 py-1 text-[0.625rem] disabled:opacity-40 max-sm:flex-1";
  const fieldClass = "mari-editor-field px-2 py-1 text-[0.6875rem]";

  return (
    <div className="mari-editor-panel w-full overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--accent)]/30"
      >
        <SlidersHorizontal size="0.8125rem" className="mari-chrome-accent-icon mari-accent-animated shrink-0" />
        <span className="flex-1">{t("lorebook.editor.bulk.title", { count })}</span>
        {bulkEdit.isPending && <Spinner size="sm" className="text-[var(--muted-foreground)]" />}
        <ChevronDown
          size="0.8125rem"
          className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-[var(--marinara-editor-divider)] px-3 py-3">
          {count === 0 && (
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("lorebook.editor.bulk.selectFirst")}</p>
          )}
          <Row label={t("lorebook.editor.bulk.status")}>
            <button
              type="button"
              disabled={disabled}
              className={buttonClass}
              onClick={() => applySet({ enabled: true })}
            >
              {t("lorebook.editor.bulk.enable")}
            </button>
            <button
              type="button"
              disabled={disabled}
              className={buttonClass}
              onClick={() => applySet({ enabled: false })}
            >
              {t("lorebook.editor.bulk.disable")}
            </button>
            <button
              type="button"
              disabled={disabled}
              className={buttonClass}
              onClick={() => applySet({ constant: true })}
            >
              {t("lorebook.editor.bulk.constantOn")}
            </button>
            <button
              type="button"
              disabled={disabled}
              className={buttonClass}
              onClick={() => applySet({ constant: false })}
            >
              {t("lorebook.editor.bulk.constantOff")}
            </button>
          </Row>

          <Row label={t("lorebook.editor.bulk.folder")}>
            <Select
              value={folderChoice || null}
              onChange={(next) => setFolderChoice(next)}
              label={t("lorebook.editor.bulk.folder")}
              placeholder={t("lorebook.editor.bulk.chooseFolder")}
              className={cn(fieldClass, "min-w-0 flex-1")}
              options={[
                { value: ROOT_FOLDER, label: t("lorebook.editor.bulk.noFolder") },
                ...folderOptions.map((folder) => ({ value: folder.id, label: folder.label })),
              ]}
            />
            <button
              type="button"
              disabled={disabled || !folderChoice}
              className={buttonClass}
              onClick={() => applySet({ folderId: folderChoice === ROOT_FOLDER ? null : folderChoice })}
            >
              {t("lorebook.editor.bulk.moveToFolder")}
            </button>
          </Row>

          <Row label={t("lorebook.editor.bulk.keys")}>
            <Select
              value={keyField}
              onChange={(next) => setKeyField(next as LorebookBulkKeyField)}
              label={t("lorebook.editor.bulk.keyField")}
              className={fieldClass}
              options={[
                { value: "keys", label: t("lorebook.editor.bulk.primaryKeys") },
                { value: "secondaryKeys", label: t("lorebook.editor.bulk.secondaryKeys") },
              ]}
            />
            <input
              value={keyText}
              onChange={(event) => setKeyText(event.target.value)}
              placeholder={t("lorebook.editor.bulk.keysPlaceholder")}
              aria-label={t("lorebook.editor.bulk.keysPlaceholder")}
              className={cn(fieldClass, "min-w-0 flex-1 max-sm:basis-full")}
            />
            <button
              type="button"
              disabled={disabled || parsedKeys.length === 0}
              className={buttonClass}
              onClick={() => void apply({ keyField, addKeys: parsedKeys }, () => setKeyText(""))}
            >
              {t("lorebook.editor.bulk.addKeys")}
            </button>
            <button
              type="button"
              disabled={disabled || parsedKeys.length === 0}
              className={buttonClass}
              onClick={() => void apply({ keyField, removeKeys: parsedKeys }, () => setKeyText(""))}
            >
              {t("lorebook.editor.bulk.removeKeys")}
            </button>
          </Row>

          <Row label={t("lorebook.editor.bulk.probability")}>
            <input
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(event) => setProbability(event.target.value)}
              placeholder={t("lorebook.editor.bulk.probabilityPlaceholder")}
              aria-label={t("lorebook.editor.bulk.probability")}
              className={cn(fieldClass, "w-28")}
            />
            <button
              type="button"
              disabled={disabled || !probabilityValid}
              className={buttonClass}
              onClick={() => applySet({ probability: probabilityValue })}
            >
              {t("lorebook.editor.bulk.set")}
            </button>
          </Row>

          <Row label={t("lorebook.editor.bulk.orderDepth")}>
            <input
              type="number"
              step={1}
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              placeholder={t("lorebook.editor.bulk.order")}
              aria-label={t("lorebook.editor.bulk.order")}
              className={cn(fieldClass, "w-20")}
            />
            <button
              type="button"
              disabled={disabled || !orderValid}
              className={buttonClass}
              onClick={() => applySet({ order: orderValue })}
            >
              {t("lorebook.editor.bulk.setOrder")}
            </button>
            <input
              type="number"
              min={0}
              step={1}
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
              placeholder={t("lorebook.editor.bulk.depth")}
              aria-label={t("lorebook.editor.bulk.depth")}
              className={cn(fieldClass, "w-20")}
            />
            <button
              type="button"
              disabled={disabled || !depthValid}
              className={buttonClass}
              onClick={() => applySet({ depth: depthValue })}
            >
              {t("lorebook.editor.bulk.setDepth")}
            </button>
          </Row>
        </div>
      )}
    </div>
  );
}
