// ──────────────────────────────────────────────
// Import windows: the "Tag imported" / "Tag source" checkboxes
//
// Imported content is tagged "Imported" plus where it came from ("ST",
// "Marinara", "Backup", ...) instead of being renamed. Both are on by default
// and the window sends them with every file it imports.
// ──────────────────────────────────────────────
import { useState } from "react";
import { Download } from "lucide-react";
import { IMPORT_TAGS_FIELD, IMPORTED_TAG, type ImportTagOptions } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useOverhaulLook } from "../../stores/overhaul.store";

export type ImportTagChoice = Required<ImportTagOptions>;

export const DEFAULT_IMPORT_TAGS: ImportTagChoice = { imported: true, source: true };

/** The checkboxes' state; `reset` puts both back on when the window closes. */
export function useImportTagChoice() {
  const [choice, setChoice] = useState<ImportTagChoice>(DEFAULT_IMPORT_TAGS);
  return { choice, setChoice, reset: () => setChoice(DEFAULT_IMPORT_TAGS) };
}

/** The choice as the JSON-body key the import routes read. */
export function importTagsBody(choice: ImportTagChoice) {
  return { [IMPORT_TAGS_FIELD]: choice };
}

/** Adds the choice to a multipart upload. Append it before the file: the server reads fields sent ahead of it. */
export function appendImportTags(form: FormData, choice: ImportTagChoice) {
  form.append(IMPORT_TAGS_FIELD, JSON.stringify(choice));
}

export function ImportTagChecks({
  value,
  onChange,
  sources,
  look = "auto",
}: {
  value: ImportTagChoice;
  onChange: (next: ImportTagChoice) => void;
  /** The source tags this window can add, for the hint ("ST or Marinara"). */
  sources: string[];
  /** "card": always the bordered card, to sit among other card-style options (the bot browser's import dialog). */
  look?: "auto" | "card";
}) {
  const { t: localizeUi } = useUiTranslation();
  const overhaulActive = useOverhaulLook();
  const or = localizeUi("ui.modals.importtags.or");
  const sourceList =
    sources.length > 1 ? `${sources.slice(0, -1).join(", ")}${or}${sources.at(-1)}` : (sources[0] ?? "");
  const hint =
    value.imported && value.source
      ? localizeUi("ui.modals.importtags.hintBoth", { imported: IMPORTED_TAG, sources: sourceList })
      : value.imported
        ? localizeUi("ui.modals.importtags.hintImported", { imported: IMPORTED_TAG })
        : value.source
          ? localizeUi("ui.modals.importtags.hintSource", { sources: sourceList })
          : localizeUi("ui.modals.importtags.hintNone");

  const boxes = (
    <>
      <label className="ov-imp__checkrow">
        <input
          type="checkbox"
          checked={value.imported}
          onChange={(e) => onChange({ ...value, imported: e.target.checked })}
          className="h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        {localizeUi("ui.modals.importtags.tagImported")}
      </label>
      <label className="ov-imp__checkrow">
        <input
          type="checkbox"
          checked={value.source}
          onChange={(e) => onChange({ ...value, source: e.target.checked })}
          className="h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        {localizeUi("ui.modals.importtags.tagSource")}
      </label>
    </>
  );

  if (overhaulActive && look === "auto") {
    return (
      <div className="ov-imp__pick ov-imp__check" data-mari-part="import-tags">
        <span className="ov-imp__label">{localizeUi("ui.modals.importtags.tags")}</span>
        <span className="ov-imp__choice">
          <span className="ov-imp__checks">{boxes}</span>
          <p className="ov-imp__desc">{hint}</p>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-3 text-xs">
      <div className="mb-2 font-semibold text-[var(--foreground)]">{localizeUi("ui.modals.importtags.tags")}</div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 [&_.ov-imp__checkrow]:inline-flex [&_.ov-imp__checkrow]:cursor-pointer [&_.ov-imp__checkrow]:items-center [&_.ov-imp__checkrow]:gap-2">
        {boxes}
      </div>
      <p className="mt-2 text-[var(--muted-foreground)]">{hint}</p>
    </div>
  );
}

/** New layout: the one-line dashed drop row the Import Character window uses, for the other import windows. */
export function OvImportDrop({
  types,
  dragOver,
  setDragOver,
  onFiles,
  onBrowse,
  single = false,
}: {
  /** The accepted file types, e.g. "· .json .marinara". */
  types: string;
  /** One file at a time ("Drop a file here"). */
  single?: boolean;
  dragOver: boolean;
  setDragOver: (over: boolean) => void;
  onFiles: (files: File[]) => void;
  onBrowse: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      className={dragOver ? "ov-imp__drop is-over" : "ov-imp__drop"}
    >
      <Download size={16} aria-hidden="true" className="ov-imp__dropicon" />
      <span className="ov-imp__droptext">
        {localizeUi(single ? "ui.modals.importtags.dropFile" : "ui.modals.importcharactermodal.ovDropFiles")}
        <span className="ov-imp__types"> {types}</span>
      </span>
      <button type="button" className="ov-btn" onClick={onBrowse}>
        {localizeUi("ui.modals.importcharactermodal.ovBrowse")}
      </button>
    </div>
  );
}
