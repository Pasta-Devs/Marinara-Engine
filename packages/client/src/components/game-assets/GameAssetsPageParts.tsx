// ──────────────────────────────────────────────
// Library > Assets > Game assets (new layout): the page's header and its file editor pane
//
// The browser used to be the last classic full page (its own toolbar, no way back, purple
// tiles). As a Library page it gets the Library's header pattern (crumbs, Upload, New ▾,
// then search and the folder tools), and a text or Markdown file opens as an editor in the
// right pane with the shared editor header and Save, not in a window.
// ──────────────────────────────────────────────
import { useEffect, type MutableRefObject } from "react";
import { FilePlus, FolderOpen, FolderPlus, Plus, RefreshCw, Search, Upload } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { TreeNode } from "../../hooks/use-game-assets";
import { isHostDeviceBrowser } from "../../lib/host-device";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import { cn } from "../../lib/utils";
import { EditorCrumbs, type RailCrumb } from "../overhaul/EditorRail";
import { OvEditorHead } from "../overhaul/EditorChrome";
import { openLibraryPane, openLibrarySection } from "../overhaul/library-navigation";
import { ViewSwitch } from "../overhaul/LibraryTables";
import { useKitMenu } from "../overhaul/LibraryKit";
import { AssetsTitle } from "../overhaul/AssetsTabs";
import { FileEditorBody, FileEditorModeSwitch, useGameAssetFileEditor } from "./FileEditorModal";

type NewKind = "create-folder" | "new-text-file" | "new-markdown-file";

export function GameAssetsPageHead({
  crumbs,
  onCrumb,
  search,
  onSearch,
  viewMode,
  onViewMode,
  onUpload,
  onNew,
  onRescan,
  rescanning,
  onOpenFolder,
}: {
  /** "Game assets", then the open folder's path parts. */
  crumbs: string[];
  onCrumb: (index: number) => void;
  search: string;
  onSearch: (value: string) => void;
  viewMode: "grid" | "list";
  onViewMode: (mode: "grid" | "list") => void;
  onUpload: () => void;
  onNew: (kind: NewKind) => void;
  onRescan: () => void;
  rescanning: boolean;
  onOpenFolder: () => void;
}) {
  const { t } = useUiTranslation();
  const localize = useLocalizedUiText();
  const mobile = useOverhaulMobile();
  const menu = useKitMenu();
  // A server's file manager only opens on the computer running it.
  const canOpenFolder = isHostDeviceBrowser();
  const trail: RailCrumb[] = [
    { label: localize("Library"), onClick: openLibraryPane },
    ...crumbs.map((label, index) => ({
      label: index === 0 ? t("library.sections.gameAssets") : label,
      onClick: index < crumbs.length - 1 ? () => onCrumb(index) : undefined,
    })),
  ];
  return (
    <>
      <header className="ov-gallery__head ov-ga__head">
        <AssetsTitle>
          <h1 data-mari-part="page-title">{t("library.sections.gameAssets")}</h1>
        </AssetsTitle>
        <button
          type="button"
          className={cn("ov-btn", mobile && "ov-btn--icon")}
          data-ov-anchor="game-assets-new"
          aria-label={localize("New")}
          title={localize("New")}
          onClick={(event) =>
            menu.openFromEvent(
              event,
              localize("New"),
              [
                {
                  key: "folder",
                  label: localize("New folder"),
                  icon: <FolderPlus size={14} />,
                  onSelect: () => onNew("create-folder"),
                },
                {
                  key: "text",
                  label: t("library.gameAssets.newTextFile"),
                  icon: <FilePlus size={14} />,
                  onSelect: () => onNew("new-text-file"),
                },
                {
                  key: "markdown",
                  label: t("library.gameAssets.newMarkdownFile"),
                  icon: <FilePlus size={14} />,
                  onSelect: () => onNew("new-markdown-file"),
                },
              ],
              "button",
            )
          }
        >
          <Plus size={14} aria-hidden="true" />
          {mobile ? null : `${localize("New")} ▾`}
        </button>
        <button type="button" className="ov-btn ov-btn--primary" onClick={onUpload}>
          <Upload size={14} aria-hidden="true" />
          {localize("Upload")}
        </button>
      </header>
      <div className="ov-gallery__tools ov-ga__tools">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t("library.gameAssets.searchFolder")}
          />
        </label>
        <span className="ov-gallery__spacer" />
        <button
          type="button"
          className={cn("ov-btn", mobile && "ov-btn--icon")}
          onClick={onRescan}
          disabled={rescanning}
          aria-label={t("library.gameAssets.rescan")}
          title={t("library.gameAssets.rescanHelp")}
        >
          <RefreshCw size={14} aria-hidden="true" className={cn(rescanning && "animate-spin")} />
          {mobile ? null : t("library.gameAssets.rescan")}
        </button>
        {canOpenFolder ? (
          <button
            type="button"
            className={cn("ov-btn", mobile && "ov-btn--icon")}
            onClick={onOpenFolder}
            aria-label={t("library.gameAssets.openFolder")}
            title={t("library.gameAssets.openFolder")}
          >
            <FolderOpen size={14} aria-hidden="true" />
            {mobile ? null : t("library.gameAssets.openFolder")}
          </button>
        ) : null}
        <ViewSwitch gallery={viewMode === "grid"} onChange={(gallery) => onViewMode(gallery ? "grid" : "list")} />
      </div>
      <div className="ov-ga__crumbs">
        <EditorCrumbs items={trail} />
      </div>
      {menu.node}
    </>
  );
}

/** A text or Markdown file, edited in the page's right pane with the shared editor header and Save. */
export function GameAssetFileEditorPane({
  node,
  initialMode,
  crumbs,
  onClose,
  closeRef,
}: {
  node: TreeNode;
  initialMode: "edit" | "preview";
  crumbs: string[];
  onClose: () => void;
  /** Lets the page's crumbs ask before leaving unsaved edits. */
  closeRef: MutableRefObject<((proceed: () => void) => void) | null>;
}) {
  const { t } = useUiTranslation();
  const localize = useLocalizedUiText();
  const editor = useGameAssetFileEditor({ node, onClose, initialMode, closeOnSave: false });
  const { isDirty, saveFile, handleSave, isMd, content } = editor;
  const confirmLeave = async (proceed: () => void) => {
    if (isDirty) {
      const discard = await showConfirmDialog({
        message: t("ui.gameAssets.fileeditormodal.youHaveUnsavedChangesDiscardThem"),
      });
      if (!discard) return;
    }
    proceed();
  };
  closeRef.current = (proceed) => void confirmLeave(proceed);
  useEffect(
    () => () => {
      closeRef.current = null;
    },
    [closeRef],
  );
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  const folderParts = crumbs.slice(1);
  const trail: RailCrumb[] = [
    { label: localize("Library"), onClick: openLibraryPane },
    {
      label: t("library.sections.gameAssets"),
      onClick: () => void confirmLeave(() => openLibrarySection("game-assets")),
    },
    ...folderParts.map((label) => ({ label, onClick: () => void confirmLeave(onClose) })),
    { label: node.name },
  ];
  return (
    <div className="ov-ga__editor" data-component="GameAssetFileEditor">
      <OvEditorHead
        crumbs={trail}
        onBack={() => void confirmLeave(onClose)}
        sectionLabel={folderParts.at(-1) ?? t("library.sections.gameAssets")}
        title={node.name}
        meta={`${content.length.toLocaleString()} ${t("ui.panels.promptoverrideseditorbody.chars")}`}
        actions={isMd ? <FileEditorModeSwitch editor={editor} /> : undefined}
        save={{ dirty: isDirty, onSave: handleSave, saving: saveFile.isPending }}
      />
      <FileEditorBody editor={editor} />
    </div>
  );
}
