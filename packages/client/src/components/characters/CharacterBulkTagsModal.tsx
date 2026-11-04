// ──────────────────────────────────────────────
// Character library: bulk tag editor
// Add, remove, and rename tags across the selected characters. The review
// step previews the exact change with the same shared function the server
// applies, then one request updates each card through its normal versioned
// save path.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRight, Loader2, Plus, X } from "lucide-react";
import {
  isEmptyCharacterTagEdit,
  normalizeCharacterTagEdit,
  summarizeCharacterTagEdit,
  type CharacterTagEdit,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_QUIET } from "../ui/neutral-surface-styles";
import { cn } from "../../lib/utils";
import { useAllCharacterCatalog, useBulkEditCharacterTags } from "../../hooks/use-characters";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedIds: ReadonlySet<string>;
  onApplied: (failedIds: string[]) => void;
}

const splitTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export function CharacterBulkTagsModal({ open, onClose, selectedIds, onApplied }: Props) {
  const { t } = useTranslation();
  const bulkEdit = useBulkEditCharacterTags();
  const catalog = useAllCharacterCatalog(open);
  // Selection survives library search and pagination; the visible page is not the selection.
  const characters = useMemo(
    () => (catalog.data ?? []).filter((character) => selectedIds.has(character.id)),
    [catalog.data, selectedIds],
  );
  const [addText, setAddText] = useState("");
  const [removeTags, setRemoveTags] = useState<Set<string>>(new Set());
  const [renames, setRenames] = useState<Array<{ from: string; to: string }>>([]);
  const [reviewing, setReviewing] = useState(false);

  const existingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const character of characters) for (const tag of character.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [characters]);

  const edit: CharacterTagEdit = useMemo(
    () => normalizeCharacterTagEdit({ add: splitTags(addText), remove: [...removeTags], rename: renames }),
    [addText, removeTags, renames],
  );
  const summary = useMemo(() => summarizeCharacterTagEdit(characters, edit), [characters, edit]);
  const empty = isEmptyCharacterTagEdit(edit);

  const reset = () => {
    setAddText("");
    setRemoveTags(new Set());
    setRenames([]);
    setReviewing(false);
  };
  const close = () => {
    if (bulkEdit.isPending) return;
    reset();
    onClose();
  };

  const apply = async () => {
    try {
      const result = await bulkEdit.mutateAsync({ ids: summary.changedIds, ...edit });
      if (result.failedIds.length > 0) {
        toast.error(t("characters.bulkTags.partialFailure", { count: result.failedIds.length }));
      } else {
        toast.success(t("characters.bulkTags.success", { count: result.updatedIds.length }));
      }
      reset();
      onApplied(result.failedIds);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("characters.bulkTags.failure"));
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t("characters.bulkTags.title", { count: selectedIds.size })}
      width="max-w-md"
      closeDisabled={bulkEdit.isPending}
      footer={
        catalog.isPending || catalog.isError ? undefined : reviewing ? (
          <>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={bulkEdit.isPending || summary.changedIds.length === 0}
              className={SHEET_BUTTON_PRIMARY}
            >
              {bulkEdit.isPending && <Loader2 size="0.75rem" className="animate-spin" />}
              {t("characters.bulkTags.apply", { count: summary.changedIds.length })}
            </button>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={bulkEdit.isPending}
              className={SHEET_BUTTON_QUIET}
            >
              {t("characters.bulkTags.back")}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setReviewing(true)} disabled={empty} className={SHEET_BUTTON_PRIMARY}>
              {t("characters.bulkTags.review")}
            </button>
            <button type="button" onClick={close} className={SHEET_BUTTON_QUIET}>
              {t("characters.bulkTags.cancel")}
            </button>
          </>
        )
      }
    >
      {catalog.isPending ? (
        <p role="status" className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <Loader2 size="0.875rem" className="animate-spin" />
          {t("characters.bulkTags.loading")}
        </p>
      ) : catalog.isError ? (
        <div className="space-y-2 text-xs">
          <p role="alert" className="text-[var(--destructive)]">
            {t("characters.bulkTags.loadFailed")}
          </p>
          <button type="button" onClick={() => void catalog.refetch()} className="mari-chrome-control px-3 py-2">
            {t("characters.duplicates.retry")}
          </button>
        </div>
      ) : !reviewing ? (
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{t("characters.bulkTags.add")}</span>
            <input
              value={addText}
              onChange={(event) => setAddText(event.target.value)}
              placeholder={t("characters.bulkTags.addPlaceholder")}
              className="mari-chrome-field h-9 w-full px-3 text-xs"
            />
          </label>

          {existingTags.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium">{t("characters.bulkTags.remove")}</span>
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                {existingTags.map(([tag, count]) => {
                  const selected = removeTags.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setRemoveTags((current) => {
                          const next = new Set(current);
                          if (next.has(tag)) next.delete(tag);
                          else next.add(tag);
                          return next;
                        })
                      }
                      className={cn(
                        "mari-chrome-control mari-chrome-control--compact",
                        selected && "mari-chrome-control--danger",
                      )}
                    >
                      {selected && <X size="0.5rem" />}
                      {tag}
                      <span className="opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-medium">{t("characters.bulkTags.rename")}</span>
            {renames.map((rename, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <select
                  value={rename.from}
                  onChange={(event) =>
                    setRenames((current) =>
                      current.map((item, i) => (i === index ? { ...item, from: event.target.value } : item)),
                    )
                  }
                  aria-label={t("characters.bulkTags.renameFrom")}
                  className="mari-chrome-field h-9 min-w-0 flex-1 px-2 text-xs"
                >
                  <option value="">{t("characters.bulkTags.renameFrom")}</option>
                  {existingTags.map(([tag]) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <ArrowRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <input
                  value={rename.to}
                  onChange={(event) =>
                    setRenames((current) =>
                      current.map((item, i) => (i === index ? { ...item, to: event.target.value } : item)),
                    )
                  }
                  placeholder={t("characters.bulkTags.renameTo")}
                  aria-label={t("characters.bulkTags.renameTo")}
                  className="mari-chrome-field h-9 min-w-0 flex-1 px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setRenames((current) => current.filter((_, i) => i !== index))}
                  className="mari-chrome-control mari-chrome-control--compact shrink-0 p-1"
                  aria-label={t("characters.bulkTags.removeRename")}
                >
                  <X size="0.625rem" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRenames((current) => [...current, { from: "", to: "" }])}
              disabled={existingTags.length === 0}
              className="mari-chrome-control mari-chrome-control--compact"
            >
              <Plus size="0.625rem" />
              {t("characters.bulkTags.addRename")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            {summary.changedIds.length === 0
              ? t("characters.bulkTags.noChanges")
              : t("characters.bulkTags.willChange", { count: summary.changedIds.length, total: characters.length })}
          </p>
          <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
            {summary.renamed.map((item) => (
              <li key={`rename:${item.from}`}>
                {t("characters.bulkTags.summaryRename", { from: item.from, to: item.to, count: item.count })}
              </li>
            ))}
            {summary.removed.map((item) => (
              <li key={`remove:${item.tag}`}>
                {t("characters.bulkTags.summaryRemove", { tag: item.tag, count: item.count })}
              </li>
            ))}
            {summary.added.map((item) => (
              <li key={`add:${item.tag}`}>
                {t("characters.bulkTags.summaryAdd", { tag: item.tag, count: item.count })}
              </li>
            ))}
          </ul>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("characters.bulkTags.versionNote")}</p>
        </div>
      )}
    </Modal>
  );
}
