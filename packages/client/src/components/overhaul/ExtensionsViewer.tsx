// ──────────────────────────────────────────────
// UI overhaul: Library > Extensions as a viewer, like Custom tools and Regex scripts
//
// The list on the left (Professor Mari's drafts, then imported third-party extensions) with an on/off
// switch per row; the open extension on the right under the shared editor header. Import only shows
// once both third-party gates are open; before that it explains how to open them.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckSquare,
  Copy,
  Download,
  FolderOpen,
  GraduationCap,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  PERSONAL_EXTENSION_CAPABILITIES,
  PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY,
  type PersonalExtensionListItem,
} from "@marinara-engine/shared";
import {
  useDeletePersonalExtension,
  usePersonalExtensionPolicy,
  usePersonalExtensions,
} from "../../hooks/use-personal-extensions";
import {
  extensionDraft,
  sourceLabel,
  usePersonalExtensionActions,
  type EditorDraft,
} from "../panels/settings/PersonalExtensionsSettings";
import {
  createPersonalExtensionPackageFilename,
  createPersonalExtensionPackageFiles,
} from "../../lib/personal-extension-transfer";
import { downloadZipFile } from "../../lib/download-zip";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { executeStateNavigation } from "../../lib/state-navigation";
import { ApiError } from "../../lib/api-client";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { Toggle } from "./LibraryTables";
import { OvViewer, type OvViewerGroup, type OvViewerKit, type OvViewerTool } from "./LibraryViewers";
import { OvEditorHead, OvEyebrow, OvRow } from "./EditorChrome";
import { OvToggle } from "./LoreEntryParts";
import { getPersonalExtensionTraffic } from "../../lib/personal-extension-traffic";
import { formatBytes } from "../../lib/format";
import { cn } from "../../lib/utils";
import { kitDelete, useKitMenu, useKitSelection, type KitAction } from "./LibraryKit";

const isMari = (extension: PersonalExtensionListItem) => extension.source === "professor_mari";

function statusLabel(extension: PersonalExtensionListItem) {
  if (extension.enabled) {
    if (extension.runtime !== "server") return "On";
    return extension.serverStatus === "error" ? "Error" : "Running";
  }
  return extension.approvedHash === extension.contentHash ? "Off" : "Needs approval";
}

function sameDraft(a: EditorDraft, b: EditorDraft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function OvExtensionsViewer() {
  const localize = useLocalizedUiText();
  const { data: extensions = [], error } = usePersonalExtensions();
  const { data: policy } = usePersonalExtensionPolicy();
  const importsAllowed = Boolean(policy?.externalExtensionsEnabled);
  const actions = usePersonalExtensionActions(extensions);
  const deleteExtension = useDeletePersonalExtension();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const selected = selectedId ? (extensions.find((extension) => extension.id === selectedId) ?? null) : null;

  // A deleted (or no longer listed) extension closes its page.
  useEffect(() => {
    if (selectedId && extensions.length && !selected) setSelectedId(null);
  }, [extensions.length, selected, selectedId]);
  // The folder picker needs the non-standard attribute, which React doesn't pass through by name.
  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
  }, [importsAllowed]);

  const groups = useMemo<OvViewerGroup[]>(() => {
    const needle = search.trim().toLowerCase();
    const toRow = (extension: PersonalExtensionListItem) => {
      const fullPage = extension.capabilities.includes(PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY);
      return {
        id: extension.id,
        name: extension.name,
        sub: [
          localize(statusLabel(extension)),
          extension.version ? `v${extension.version}` : null,
          localize(extension.runtime === "server" ? "Server" : "Browser"),
          fullPage ? localize("Full page access") : null,
        ]
          .filter(Boolean)
          .join(" · "),
        dim: !extension.enabled,
        trail: (
          <Toggle
            on={extension.enabled}
            held={actions.busy}
            label={localize(extension.enabled ? "Turn off" : "Turn on")}
            onChange={(next) => void (next ? actions.runExtension(extension) : actions.disableExtension(extension))}
          />
        ),
      };
    };
    const matches = extensions.filter(
      (extension) => !needle || `${extension.name} ${extension.description}`.toLowerCase().includes(needle),
    );
    const mine = matches.filter(isMari);
    const imported = matches.filter((extension) => !isMari(extension));
    // One plain list until there are imports; then Professor Mari's drafts and the imports get a heading each.
    if (!importsAllowed && !imported.length) return [{ id: "mari", label: "", rows: mine.map(toRow) }];
    return [
      { id: "mari", label: localize("From Professor Mari"), rows: mine.map(toRow) },
      { id: "imported", label: localize("Imported"), rows: imported.map(toRow) },
    ];
  }, [actions, extensions, importsAllowed, localize, search]);

  const visibleIds = useMemo(() => groups.flatMap((group) => group.rows.map((row) => row.id)), [groups]);
  const selection = useKitSelection(visibleIds);
  const menu = useKitMenu();
  const byId = useMemo(() => new Map(extensions.map((extension) => [extension.id, extension])), [extensions]);

  const exportMany = async (picked: PersonalExtensionListItem[]) => {
    for (const extension of picked) {
      await downloadZipFile(
        createPersonalExtensionPackageFiles(extension),
        createPersonalExtensionPackageFilename(extension.name),
      );
    }
  };
  const removeMany = async (ids: string[]) => {
    const failed = await kitDelete(ids, (id) => deleteExtension.mutateAsync(id), {
      noun: localize("extensions"),
      localize,
    });
    if (failed && selectedId && ids.includes(selectedId) && !failed.includes(selectedId)) setSelectedId(null);
    if (failed) selection.set(new Set(failed));
    if (failed && !failed.length) selection.stop();
  };
  const rowActions = (extension: PersonalExtensionListItem): KitAction[] => [
    { key: "export", label: "Export", icon: <Upload size={14} />, onSelect: () => void exportMany([extension]) },
    { key: "select", label: "Select", icon: <CheckSquare size={14} />, onSelect: () => selection.start(extension.id) },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      danger: true,
      // One extension: the delete question that also names its private storage.
      onSelect: () =>
        void actions.removeExtension(extension).then((deleted) => {
          if (deleted && selectedId === extension.id) setSelectedId(null);
        }),
    },
  ];
  const kit: OvViewerKit = {
    selection,
    menu,
    bulkActions: [
      {
        key: "export",
        label: "Export",
        icon: <Upload size={14} />,
        onSelect: () => void exportMany(extensions.filter((extension) => selection.has(extension.id))),
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => void removeMany(selection.list),
      },
    ],
    rowMenu: (id) => {
      const extension = byId.get(id);
      return extension ? { title: extension.name, actions: rowActions(extension) } : null;
    },
  };

  // Before both gates are open, Import says how to open them instead of disappearing.
  const explainImports = async () => {
    const open = await showConfirmDialog({
      title: localize("Third-party imports are off"),
      message: policy?.externalExtensionsEnvEnabled
        ? localize(
            "Extensions written by other people stay locked until you allow them. Turn on Allow third-party extension imports in Settings > Advanced > Security, then come back here to import.",
          )
        : localize(
            "Extensions written by other people stay locked until you allow them, in two steps. First, on the computer that runs Marinara, set ENABLE_EXTERNAL_EXTENSIONS=true in the .env file and restart Marinara. Then turn on Allow third-party extension imports in Settings > Advanced > Security.",
          ),
      confirmLabel: localize("Open Security settings"),
    });
    if (open) executeStateNavigation({ kind: "settings", tab: "advanced", sectionId: "admin-access" });
  };
  const tools: OvViewerTool[] = importsAllowed
    ? [
        { label: localize("Import"), icon: Download, onClick: () => fileRef.current?.click() },
        {
          label: localize("Import folder"),
          icon: FolderOpen,
          onClick: () => folderRef.current?.click(),
          compact: true,
        },
      ]
    : [{ label: localize("Import"), icon: Download, onClick: () => void explainImports() }];
  if (extensions.length) {
    tools.push({
      label: localize("Export all"),
      icon: Upload,
      onClick: () => void exportMany(extensions),
      compact: true,
    });
  }
  const enabledCount = extensions.filter((extension) => extension.enabled).length;
  const loadError =
    error instanceof ApiError && error.status === 403
      ? localize(
          "Managing extensions needs this computer, or the admin secret saved under Settings > Advanced > Security.",
        )
      : error
        ? localize("Extensions could not be loaded.")
        : null;

  return (
    <OvViewer
      className="ov-vw--drill"
      title={localize("Extensions")}
      meta={`${extensions.length} ${localize(extensions.length === 1 ? "extension" : "extensions")} · ${enabledCount} ${localize("on")}`}
      tools={tools}
      listLabel={localize("Extensions")}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={localize("Search extensions")}
      newLabel={localize("Ask Professor Mari")}
      newShortLabel={localize("Ask Mari")}
      newIcon={GraduationCap}
      onNew={() => useOverhaulStore.getState().openMari()}
      groups={groups}
      selectedId={selectedId}
      onSelect={setSelectedId}
      emptyList={loadError ?? localize("No extensions yet.")}
      emptyText={
        loadError
          ? undefined
          : localize(
              importsAllowed
                ? "Ask Professor Mari to write one for you, or import one. Nothing runs until you turn it on and approve its exact code."
                : "Ask Professor Mari to write one for you. Nothing runs until you turn it on and approve its exact code.",
            )
      }
      emptyDetail={localize(
        "Pick an extension on the left. Nothing runs until you turn it on and approve its exact code.",
      )}
      kit={kit}
    >
      {importsAllowed ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.json,.css,.js,.mjs,.cjs,application/zip,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void actions.importFile(file);
            }}
          />
          <input
            ref={folderRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = event.target.files;
              if (files?.length) void actions.importFolder(files).finally(() => (event.target.value = ""));
            }}
          />
        </>
      ) : null}
      {selected ? (
        <OvExtensionEditor
          key={selected.id}
          extension={selected}
          actions={actions}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </OvViewer>
  );
}

function OvExtensionEditor({
  extension,
  actions,
  onClose,
}: {
  extension: PersonalExtensionListItem;
  actions: ReturnType<typeof usePersonalExtensionActions>;
  onClose: () => void;
}) {
  const localize = useLocalizedUiText();
  const { t } = useTranslation();
  const editable = !isMari(extension);
  const saved = useMemo(() => extensionDraft(extension), [extension]);
  const [draft, setDraft] = useState<EditorDraft>(saved);
  // A save, restore or approval refreshes the page to what is stored now.
  useEffect(() => setDraft(saved), [saved]);
  const dirty = editable && !sameDraft(draft, saved);
  const fullPage = draft.capabilities.includes(PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY);
  const waiting = !extension.enabled && extension.approvedHash !== extension.contentHash;
  const traffic = getPersonalExtensionTraffic(extension.id);
  const exportOne = () =>
    void downloadZipFile(
      createPersonalExtensionPackageFiles(extension),
      createPersonalExtensionPackageFilename(extension.name),
    );
  const remove = async () => {
    if (await actions.removeExtension(extension)) onClose();
  };
  const update = (patch: Partial<EditorDraft>) => setDraft((value) => ({ ...value, ...patch }));
  const toggleCapability = (capability: (typeof PERSONAL_EXTENSION_CAPABILITIES)[number], on: boolean) =>
    setDraft((value) => ({
      ...value,
      // Full page access replaces the sandboxed permissions; the others can be combined.
      capabilities: on
        ? capability === PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY
          ? [PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY]
          : PERSONAL_EXTENSION_CAPABILITIES.filter(
              (candidate) =>
                candidate !== PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY &&
                (candidate === capability || value.capabilities.includes(candidate)),
            )
        : value.capabilities.filter((candidate) => candidate !== capability),
    }));
  const meta = [
    localize(statusLabel(extension)),
    extension.version ? `v${extension.version}` : null,
    isMari(extension)
      ? localize("From Professor Mari")
      : extension.source === "external"
        ? localize("Imported")
        : sourceLabel(extension.source, t),
  ]
    .filter(Boolean)
    .join(" · ");
  const capabilities = PERSONAL_EXTENSION_CAPABILITIES.filter(
    (capability) => editable || capability !== PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY,
  );
  return (
    <div className="mari-editor-shell flex flex-1 flex-col overflow-hidden" data-component="OverhaulExtensionEditor">
      <div className="ov-ed">
        <OvEditorHead
          section="extensions"
          sectionLabel="Extensions"
          onBack={onClose}
          title={editable ? draft.name : extension.name}
          titlePlaceholder={localize("Extension name")}
          onTitleChange={editable ? (name) => update({ name }) : undefined}
          meta={meta}
          actions={
            <>
              <OvToggle
                label={localize("On")}
                title={dirty ? localize("Save first") : undefined}
                on={extension.enabled}
                onChange={(next) => {
                  if (actions.busy || dirty) return;
                  void (next ? actions.runExtension(extension) : actions.disableExtension(extension));
                }}
              />
              <button type="button" className="ov-edbtn" onClick={exportOne}>
                <Upload size={13} aria-hidden="true" />
                {localize("Export")}
              </button>
            </>
          }
          save={
            editable
              ? {
                  dirty,
                  saving: actions.busy,
                  onSave: async () => {
                    const updated = await actions.saveDraft(extension, draft);
                    if (updated) setDraft(extensionDraft(updated));
                  },
                }
              : undefined
          }
          menu={[
            { label: "Back to Extensions", onSelect: onClose },
            { label: "Delete extension", danger: true, onSelect: () => void remove() },
          ]}
        />
        {extension.serverError ? (
          <div className="ov-ed__banner is-error">
            <AlertTriangle size={13} aria-hidden="true" />
            <span>{extension.serverError}</span>
          </div>
        ) : waiting ? (
          <div className="ov-ed__banner">
            <ShieldAlert size={13} aria-hidden="true" />
            <span>
              {localize(
                dirty
                  ? "Save, then turn it on to review and approve this exact code."
                  : "Off until you turn it on and approve this exact code.",
              )}
            </span>
          </div>
        ) : null}
        <div className="ov-ed__cols">
          <div className="ov-ed__col">
            <OvEyebrow>{localize("Details")}</OvEyebrow>
            {editable ? (
              <>
                <OvRow label={localize("Version")}>
                  <input
                    value={draft.version ?? ""}
                    placeholder="1.0.0"
                    aria-label={localize("Version")}
                    onChange={(event) => update({ version: event.target.value || null })}
                  />
                </OvRow>
                <OvRow label={localize("Runs in")} hint={localize("Server code needs the server sandbox.")}>
                  <select
                    value={draft.runtime}
                    aria-label={localize("Runs in")}
                    onChange={(event) =>
                      update(
                        event.target.value === "server"
                          ? { runtime: "server", capabilities: [] }
                          : { runtime: "client" },
                      )
                    }
                  >
                    <option value="client">{localize("Browser")}</option>
                    <option value="server">{localize("Server")}</option>
                  </select>
                </OvRow>
                <OvRow label={localize("Description")} top>
                  <textarea
                    value={draft.description}
                    rows={2}
                    aria-label={localize("Description")}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                </OvRow>
              </>
            ) : (
              // Professor Mari's drafts change only through her, so their details read as text.
              <>
                <OvRow label={localize("Version")}>
                  <span className="ov-exted__value">{draft.version || "—"}</span>
                </OvRow>
                <OvRow label={localize("Runs in")}>
                  <span className="ov-exted__value">{localize(draft.runtime === "server" ? "Server" : "Browser")}</span>
                </OvRow>
                <OvRow label={localize("Description")} top>
                  <span className="ov-exted__value">{draft.description || "—"}</span>
                </OvRow>
                <p className="ov-exted__note">
                  {localize("Ask Professor Mari to change it. Her edits come back as a draft that is off.")}
                </p>
              </>
            )}
            <OvEyebrow>{localize("Access")}</OvEyebrow>
            <p className={cn("ov-exted__note", fullPage && "is-danger")}>
              {draft.runtime === "server"
                ? t("settings.personalExtensions.sandbox.server")
                : fullPage
                  ? t("settings.personalExtensions.sandbox.fullPage")
                  : t("settings.personalExtensions.sandbox.browser")}
            </p>
            {draft.runtime === "client"
              ? capabilities.map((capability) => {
                  const danger = capability === PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY;
                  const label = t(`settings.personalExtensions.capabilities.${capability}.label`);
                  return (
                    <div key={capability} className={cn("ov-exted__cap", !editable && "is-locked")}>
                      <Toggle
                        on={draft.capabilities.includes(capability)}
                        held={!editable}
                        label={label}
                        onChange={(next) => {
                          if (editable) toggleCapability(capability, next);
                        }}
                      />
                      <span>
                        <b className={cn(danger && "ov-exted__danger")}>{label}</b>
                        <small>{t(`settings.personalExtensions.capabilities.${capability}.description`)}</small>
                      </span>
                    </div>
                  );
                })
              : null}
            {extension.revisions.length ? (
              <>
                <OvEyebrow aside={localize("Restoring saves it as a draft that is off")}>
                  {localize("Revisions")}
                </OvEyebrow>
                {extension.revisions.map((revision) => (
                  <OvRow
                    key={`${revision.contentHash}-${revision.savedAt}`}
                    label={<code className="is-mono">{revision.contentHash.replace(/^sha256:/, "").slice(0, 12)}</code>}
                    hint={[
                      revision.version ? `v${revision.version}` : null,
                      localize(revision.runtime === "server" ? "Server" : "Browser"),
                      new Date(revision.savedAt).toLocaleString(),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <button
                      type="button"
                      className="ov-edbtn"
                      disabled={actions.busy}
                      onClick={() =>
                        void actions.restoreRevision(extension, revision.contentHash).then((restored) => {
                          if (restored) setDraft(extensionDraft(restored));
                        })
                      }
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      {localize("Restore")}
                    </button>
                  </OvRow>
                ))}
              </>
            ) : null}
            <div className="ov-ed__id">
              {localize("Hash")} <code>{extension.contentHash.replace(/^sha256:/, "").slice(0, 16)}</code>
              <button
                type="button"
                className="ov-ed__link"
                onClick={() => void navigator.clipboard?.writeText(extension.contentHash)}
              >
                <Copy size={12} aria-hidden="true" />
                {localize("Copy")}
              </button>
            </div>
            {traffic && traffic.requests > 0 ? (
              <p className="ov-exted__note">
                <Activity size={12} aria-hidden="true" />{" "}
                {t("settings.personalExtensions.traffic.summary", {
                  requests: traffic.requests,
                  bytes: formatBytes(traffic.bytes),
                  rate: traffic.requestsLastMinute,
                })}
                {traffic.sustainedHighRate ? (
                  <strong className="ov-exted__danger"> {t("settings.personalExtensions.traffic.highRate")}</strong>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="ov-ed__col">
            <OvEyebrow>{localize("Code")}</OvEyebrow>
            {draft.runtime === "client" ? (
              <>
                <OvRow label={localize("CSS")} hint={localize(fullPage ? "Used as written" : "Cleaned before use")} top>
                  <textarea
                    className="is-mono ov-exted__code"
                    value={draft.css ?? ""}
                    readOnly={!editable}
                    spellCheck={false}
                    placeholder={localize("Optional")}
                    aria-label={localize("CSS")}
                    onChange={(event) => update({ css: event.target.value })}
                  />
                </OvRow>
                <OvRow label={localize("JavaScript")} hint={localize("Runs in the browser")} top>
                  <textarea
                    className="is-mono ov-exted__code"
                    value={draft.js ?? ""}
                    readOnly={!editable}
                    spellCheck={false}
                    placeholder={localize("Optional")}
                    aria-label={localize("JavaScript")}
                    onChange={(event) => update({ js: event.target.value })}
                  />
                </OvRow>
              </>
            ) : (
              <OvRow label={localize("JavaScript")} hint={localize("Runs on the server")} top>
                <textarea
                  className="is-mono ov-exted__code is-tall"
                  value={draft.serverJs ?? ""}
                  readOnly={!editable}
                  spellCheck={false}
                  aria-label={localize("JavaScript")}
                  onChange={(event) => update({ serverJs: event.target.value })}
                />
              </OvRow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
