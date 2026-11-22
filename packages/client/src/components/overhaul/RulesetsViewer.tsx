// ──────────────────────────────────────────────
// UI overhaul: Library > Assets > Rulesets
//
// Game Mode rulesets had no Library home: the builder was a window reached from Chat
// settings, and the installed list lived only in the classic Agents panel. This is a
// master-detail viewer like Regex scripts and Custom tools: the installed rulesets on
// the left (yours, then those from packages), the open one on the right. Your own
// rulesets open in the builder as a page with the shared header and Save; a packaged or
// repository ruleset shows a read-only summary, since it is its author's file.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { rulesetBuilderDraftFrom, rulesetBuilderPresetOf, type InstalledRuleset } from "@marinara-engine/shared";
import {
  useInstalledRulesets,
  useRemoveRuleset,
  useRulesetSource,
  useUninstallCapabilityPackage,
} from "../../hooks/use-capability-packages";
import { useAgentImportPolicy } from "../../hooks/use-agents";
import { ApiError } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { rulesetRepositoryLabel } from "../../lib/ruleset-source";
import { rulesetRowKey, useRulesetPageRequest } from "../../lib/ruleset-page-request";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { RulesetBuilderModal } from "../rulesets/RulesetBuilderModal";
import { usePinRoleplayRuleset } from "../chat/RoleplayRuleset";
import { useAgentImportFlow } from "../agents/useAgentImportFlow";
import { OvEditorHead, OvEyebrow, OvRow } from "./EditorChrome";
import { openLibraryPane } from "./library-navigation";
import { OvViewer, type OvViewerGroup, type OvViewerKit } from "./LibraryViewers";
import { useKitMenu, useKitSelection, type KitAction } from "./LibraryKit";
import type { RailCrumb } from "./EditorRail";

const NEW_ID = "new";

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function RulesetsViewer() {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const installed = useInstalledRulesets();
  const removeRuleset = useRemoveRuleset();
  const uninstall = useUninstallCapabilityPackage();
  const imports = useAgentImportPolicy();
  const importFlow = useAgentImportFlow({ toasts: true });
  const request = useRulesetPageRequest((s) => s.request);
  const setRequest = useRulesetPageRequest((s) => s.setRequest);
  const [selectedId, setSelectedId] = useState<string | null>(() => request?.open ?? null);
  const [search, setSearch] = useState("");
  const [builderDirty, setBuilderDirty] = useState(false);
  const { pin } = usePinRoleplayRuleset(request?.chatId ?? "");
  const canBuild = imports.data?.enabled === true;

  // A later request (Chat settings while the page is already open) moves the selection too.
  useEffect(() => {
    if (request) setSelectedId(request.open);
  }, [request]);

  const entries = useMemo(
    () => [...(installed.data ?? [])].sort((left, right) => left.definition.name.localeCompare(right.definition.name)),
    [installed.data],
  );
  const byKey = useMemo(() => new Map(entries.map((entry) => [rulesetRowKey(entry), entry])), [entries]);
  const selected = selectedId && selectedId !== NEW_ID ? (byKey.get(selectedId) ?? null) : null;

  const askLeave = async () =>
    !builderDirty ||
    (await showConfirmDialog({
      title: t("editor.save.unsaved"),
      message: t("ui.gameAssets.fileeditormodal.youHaveUnsavedChangesDiscardThem"),
      tone: "destructive",
    }));
  const select = async (id: string | null) => {
    if (id === selectedId) return;
    if (!(await askLeave())) return;
    setBuilderDirty(false);
    setSelectedId(id);
    // A pick of its own ends what Chat settings asked for.
    if (request && id !== request.open) setRequest(null);
  };

  const needle = search.trim().toLowerCase();
  const matches = (entry: InstalledRuleset) =>
    !needle ||
    entry.definition.name.toLowerCase().includes(needle) ||
    entry.definition.coverage.summary.toLowerCase().includes(needle);
  const sourceLabel = (entry: InstalledRuleset) =>
    entry.source
      ? (rulesetRepositoryLabel(entry.source) ?? t("game.ruleset.panel.importedFile"))
      : entry.packageId
        ? t("library.rulesets.fromPackage", { name: entry.packageId })
        : t("library.rulesets.builtIn");
  const toRow = (entry: InstalledRuleset) => ({
    id: rulesetRowKey(entry),
    name: entry.definition.name,
    sub: `v${entry.definition.version} · ${sourceLabel(entry)}`,
  });
  const yours = entries.filter((entry) => !entry.packageId && matches(entry));
  const packaged = entries.filter((entry) => !!entry.packageId && matches(entry));
  const groups: OvViewerGroup[] = [
    { id: "yours", label: t("library.rulesets.yours"), rows: yours.map(toRow) },
    { id: "packages", label: t("library.rulesets.fromPackages"), rows: packaged.map(toRow) },
  ].filter((group) => group.rows.length || !needle);

  const remove = async (entry: InstalledRuleset) => {
    const name = entry.definition.name;
    if (!entry.source && entry.packageId) {
      const confirmed = await showConfirmDialog({
        title: t("ui.agents.agentcatalogview.uninstallValue1", { value1: name }),
        message: t("ui.panels.agentspanel.uninstallRulesetMessage"),
        confirmLabel: t("ui.agents.agentcatalogview.uninstall"),
        tone: "destructive",
      });
      if (!confirmed) return;
      try {
        await uninstall.mutateAsync(entry.packageId);
        toast.success(t("ui.agents.agentcatalogview.value1Uninstalled", { value1: name }));
        if (selected && rulesetRowKey(selected) === rulesetRowKey(entry)) setSelectedId(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("game.ruleset.remove.failed"));
      }
      return;
    }
    const confirmed = await showConfirmDialog({
      title: t("game.ruleset.remove.title", { name }),
      message: t("game.ruleset.remove.message"),
      confirmLabel: t("game.ruleset.remove.confirm"),
      tone: "destructive",
    });
    if (!confirmed) return;
    const run = async (force: boolean) => {
      await removeRuleset.mutateAsync({ rulesetId: entry.definition.id, force });
      toast.success(t("game.ruleset.remove.done", { name }));
      if (selected && rulesetRowKey(selected) === rulesetRowKey(entry)) setSelectedId(null);
    };
    try {
      await run(false);
    } catch (error) {
      // Games already playing on it are the one refusal with a way forward: ask again, naming how many.
      const inUse =
        error instanceof ApiError && isJsonRecord(error.payload) && error.payload.code === "ruleset_in_use"
          ? Number(error.payload.games) || 0
          : null;
      if (inUse === null) {
        toast.error(error instanceof Error ? error.message : t("game.ruleset.remove.failed"));
        return;
      }
      const forced = await showConfirmDialog({
        title: t("game.ruleset.remove.title", { name }),
        message: t("game.ruleset.remove.inUseMessage", { count: inUse }),
        confirmLabel: t("game.ruleset.remove.confirm"),
        tone: "destructive",
      });
      if (!forced) return;
      try {
        await run(true);
      } catch (retryError) {
        toast.error(retryError instanceof Error ? retryError.message : t("game.ruleset.remove.failed"));
      }
    }
  };
  const removable = (entry: InstalledRuleset) => !!entry.source || !!entry.packageId;
  const rowActions = (entry: InstalledRuleset): KitAction[] =>
    removable(entry)
      ? [
          {
            key: "remove",
            label: entry.source ? t("game.ruleset.remove.confirm") : t("ui.agents.agentcatalogview.uninstall"),
            icon: <Trash2 size={14} />,
            danger: true,
            onSelect: () => void remove(entry),
          },
        ]
      : [];
  const menu = useKitMenu();
  const selection = useKitSelection([]);
  const kit: OvViewerKit = {
    selection,
    menu,
    bulkActions: [],
    rowMenu: (id) => {
      const entry = byKey.get(id);
      const actions = entry ? rowActions(entry) : [];
      return entry && actions.length ? { title: entry.definition.name, actions } : null;
    },
  };

  const crumbs: RailCrumb[] = [
    { label: localize("Library"), onClick: openLibraryPane },
    { label: t("library.sections.rulesets"), onClick: () => void select(null) },
  ];
  const onSaved = (rulesetId: string) => {
    setBuilderDirty(false);
    setSelectedId(`local::${rulesetId}`);
    if (request?.chatId) {
      const chatId = request.chatId;
      if (request.pinOnSave) void pin(rulesetId);
      else toast.info(t("chat.settings.ruleset.newNotPinned"));
      toast(t("library.rulesets.savedForChat"), {
        action: {
          label: t("library.rulesets.backToChat"),
          onClick: () => {
            useUIStore.getState().closeAllDetails();
            useChatStore.getState().setActiveChatId(chatId);
          },
        },
      });
      setRequest(null);
    }
  };

  return (
    <OvViewer
      className="ov-vw--drill ov-vw--rulesets"
      title={t("library.sections.rulesets")}
      meta={t("library.rulesets.count", { count: entries.length })}
      tools={[{ label: localize("Import"), icon: Download, onClick: importFlow.chooseRuleset }]}
      listLabel={t("library.sections.rulesets")}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={t("library.rulesets.search")}
      newLabel={t("chat.settings.ruleset.newRuleset")}
      newShortLabel={localize("New")}
      onNew={() => {
        if (!canBuild) {
          toast.info(t("chat.settings.ruleset.builderNeedsImports"));
          return;
        }
        void select(NEW_ID);
      }}
      groups={groups}
      selectedId={selectedId === NEW_ID ? null : selectedId}
      detailOpen={selectedId === NEW_ID}
      onSelect={(id) => void select(id)}
      kit={kit}
      emptyList={t("library.rulesets.empty")}
      emptyText={t("library.rulesets.emptyHint")}
      emptyDetail={t("library.rulesets.pick")}
      onSection={() => void select(null)}
    >
      {importFlow.inputs}
      {importFlow.dialogs}
      {selectedId === NEW_ID ? (
        <RulesetBuilderModal
          key="new"
          open
          onClose={() => undefined}
          installed={installed.data ?? []}
          onSaved={onSaved}
          page={{ crumbs, onBack: () => void select(null), onDirtyChange: setBuilderDirty }}
        />
      ) : selected ? (
        <RulesetDetail
          key={`${rulesetRowKey(selected)}@${selected.definition.version}`}
          entry={selected}
          installed={installed.data ?? []}
          canBuild={canBuild}
          crumbs={crumbs}
          sourceLabel={sourceLabel(selected)}
          onBack={() => void select(null)}
          onSaved={onSaved}
          onDirtyChange={setBuilderDirty}
          onRemove={removable(selected) ? () => void remove(selected) : undefined}
        />
      ) : null}
    </OvViewer>
  );
}

/** The open ruleset: the builder when it is yours, otherwise what it plays like. */
function RulesetDetail({
  entry,
  installed,
  canBuild,
  crumbs,
  sourceLabel,
  onBack,
  onSaved,
  onDirtyChange,
  onRemove,
}: {
  entry: InstalledRuleset;
  installed: InstalledRuleset[];
  canBuild: boolean;
  crumbs: RailCrumb[];
  sourceLabel: string;
  onBack: () => void;
  onSaved: (rulesetId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const { definition } = entry;
  // Only the player's own (`local/`) rulesets open in the builder: saving a packaged or repository one would
  // make a local copy under another id, a second sheet on every character (as in Chat settings).
  const editable = !entry.packageId && entry.source?.kind === "local";
  const source = useRulesetSource(definition.id, definition.version, editable);
  const draft = useMemo(() => {
    if (!editable || !source.data) return null;
    try {
      return rulesetBuilderDraftFrom(JSON.parse(source.data.ruleset));
    } catch {
      return null;
    }
  }, [editable, source.data]);
  if (editable && canBuild && draft)
    return (
      <RulesetBuilderModal
        open
        onClose={() => undefined}
        initial={draft}
        installedVersion={definition.version}
        installed={installed}
        onSaved={onSaved}
        page={{ crumbs, onBack, onDirtyChange }}
      />
    );
  const preset = rulesetBuilderPresetOf(definition.resolution as Record<string, unknown>);
  const presetKey = preset === "2d6-bands" ? "bands" : preset === "no-dice" ? "noDice" : preset;
  const sheet = definition.sheet;
  const names = (items: Array<{ label: string }>) => items.map((item) => item.label).join(", ") || "—";
  return (
    <div className="ov-rsb" data-component="RulesetSummary">
      <OvEditorHead
        crumbs={[...crumbs, { label: definition.name }]}
        onBack={onBack}
        sectionLabel={t("library.sections.rulesets")}
        title={definition.name}
        meta={`v${definition.version} · ${sourceLabel}`}
        menu={
          onRemove
            ? [
                {
                  label: entry.source ? t("game.ruleset.remove.confirm") : t("ui.agents.agentcatalogview.uninstall"),
                  danger: true,
                  onSelect: onRemove,
                },
              ]
            : undefined
        }
      />
      <div className="ov-rsb__body">
        <p className="ov-rsb__help">{definition.coverage.summary}</p>
        <OvEyebrow>{t("library.rulesets.howItPlays")}</OvEyebrow>
        <OvRow label={t("rulesetBuilder.dice")}>
          {presetKey ? t(`rulesetBuilder.presets.${presetKey}.label`) : t("library.rulesets.customDice")}
        </OvRow>
        <OvRow label={t("rulesetBuilder.abilities")}>{names(sheet.abilities)}</OvRow>
        <OvRow label={t("rulesetBuilder.skills")}>{names(sheet.skills)}</OvRow>
        {entry.versions && entry.versions.length > 1 ? (
          <OvRow label={t("library.rulesets.versions")}>{entry.versions.join(", ")}</OvRow>
        ) : null}
        <p className="ov-rsb__note">
          {editable && !canBuild ? t("chat.settings.ruleset.builderNeedsImports") : t("library.rulesets.authorsFile")}
        </p>
      </div>
    </div>
  );
}
