// ──────────────────────────────────────────────
// ConnectionDefaults — the Jobs box at the top of the Connections panel: one row per job with its Model, and
// its "If it fails" Model when set. A row opens the job's one picker (Model and If it fails). A job with a
// problem shows it as a chip on its row. Agents and Decision keep their other settings behind a gear.
// ──────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Loader2, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  isAgentConfigDeleted,
  isRetiredBuiltInAgentId,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import { useMayReadImages, useDefaultEmbeddingConnection, useUpdateConnection } from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useFeatureModels,
  useSetFeatureModels,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { useAgentConfigs, useUpdateAgent } from "../../hooks/use-agents";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import { useFollowVoiceJob, useTTSConfig, useUpdateTTSConfig } from "../../hooks/use-tts";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { openAddConnection } from "../../lib/add-connection";
import { createLocalSidecarConnectionOption, isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { ConnectionSelect } from "./ConnectionSelect";
import {
  FLAG_JOBS,
  JOB,
  JOBS,
  jobLabelKey,
  matchesKind,
  voiceRowOf,
  type Job,
  type JobKey,
} from "../../lib/connection-jobs";
import { MARI_QUICK_CONNECTION } from "../../lib/omnibar-aside-text";
import { EmbeddingDefaultControl } from "./EmbeddingDefaultControl";
import { DecisionDefaultControl } from "./DecisionDefaultControl";
import { SMALL_ACTION } from "./DeviceDetail";
import type { ConnectionRowData } from "./ConnectionRow";
import { JobRow } from "./JobRow";
import { Modal } from "../ui/Modal";

function JobIcon({ job }: { job: JobKey }) {
  const Icon = JOB[job].icon;
  return <Icon size="0.6875rem" />;
}

/** Feature values that are not a Model: quick answers can follow Professor Mari, Impersonate can shuffle. */
const FEATURE_EXTRA_OPTIONS: Partial<Record<JobKey, Array<{ value: string; key: string }>>> = {
  quick: [{ value: MARI_QUICK_CONNECTION, key: "connections.defaults.featureOption.sameAsMari" }],
  impersonate: [{ value: "random", key: "connections.defaults.featureOption.random" }],
};
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

type Warning = { text: string; fix?: { label: string; run: () => void } };

export type DefaultsTile = {
  key: JobKey;
  icon: ReactNode;
  title: string;
  value: string;
  /** The Connection, or what kind of service it is. */
  hint?: string;
  /** The fallback Model's name, when the job has one. */
  fallback?: string;
  /** An unset job reads quieter than a chosen one. */
  muted?: boolean;
  warning: Warning | null;
  /** The chosen Model, for its picture. */
  source?: ConnectionRowData;
  /** The engine this job needs is not set up: the tile leads to its set-up screen. */
  setup?: { item: DeviceItem; text: string };
  /** A device job opens its engine's page instead of pickers. */
  device?: DeviceItem;
};

/** Every job's tile, the Main summary for the list row, and the problems. */
export function useConnectionDefaults(connectionsList: ConnectionRowData[]) {
  const { t } = useTranslation();
  const { data: accounts } = useConnectionAccounts();
  const updateAccount = useUpdateConnectionAccount();
  const openModal = useUIStore((s) => s.openModal);
  const sidecarModelDisplayName = useSidecarStore((s) => s.modelDisplayName);
  const sidecarAsAgentsDefault = useSidecarStore((s) => s.config.useAsAgentsDefault);
  const embeddingDefault = useDefaultEmbeddingConnection();
  const decisionOptions = useDecisionOptions();
  const deviceSetup = useDeviceSetup();
  const { data: tts } = useTTSConfig();
  const updateTTS = useUpdateTTSConfig();
  const followVoiceJob = useFollowVoiceJob();
  const featureModels = useFeatureModels();

  const accountById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const mainIsBuiltIn = useSidecarStore((s) => s.config.useAsMainDefault);
  const sidecarName = createLocalSidecarConnectionOption(sidecarModelDisplayName).name;
  // A job that points at the built-in model before it is downloaded shows the same fix as the Decision row.
  const builtInDownloaded = useSidecarStore((s) => s.modelDownloaded);
  const builtInWarning = builtInDownloaded
    ? null
    : {
        text: t("connections.defaults.warning.notDownloaded", { model: sidecarName }),
        fix: {
          label: t("connections.defaults.setUp"),
          run: () => openAddConnection({ category: "device", item: "local-model" }),
        },
      };

  /** The name the user gave the Model, with its Connection as the muted second line. */
  const describe = (row: ConnectionRowData) => {
    const account = row.accountId ? accountById.get(row.accountId) : undefined;
    return { value: row.name?.trim() || row.model?.trim() || row.id, hint: account?.name, source: row };
  };
  /** A broken Connection behind the chosen Model, and its one fix. */
  const accountWarning = (account: ConnectionAccountListItem | undefined): Warning | null => {
    if (!account || account.state === "ok") return null;
    if (account.state === "off") {
      return {
        text: t("connections.defaults.warning.off", { connection: account.name }),
        fix: {
          label: t("connections.defaults.fix.turnOn"),
          run: () => updateAccount.mutate({ id: account.id, enabled: true }),
        },
      };
    }
    return {
      text: t("connections.defaults.warning.needsKey", { connection: account.name }),
      fix: {
        label: t("connections.defaults.fix.addKey"),
        run: () => openModal("connection-account", { accountId: account.id }),
      },
    };
  };

  const jobTile = (key: JobKey) => ({ key, icon: <JobIcon job={key} />, title: t(jobLabelKey(JOB[key])) });
  const primaryOf = (role: (typeof FLAG_JOBS)[number]) =>
    (role.key === "voice"
      ? voiceRowOf(connectionsList, tts?.connectionId).row
      : connectionsList.find((row) => matchesKind(row, role.kind) && isConnectionFlagTrue(row[role.flag]))) ?? null;
  const mainRow = primaryOf(FLAG_JOBS.find((role) => role.key === "main")!);
  const agentsRow = primaryOf(FLAG_JOBS.find((role) => role.key === "agents")!);
  /** An unset job shows the model that really runs; line 2 names the job it comes from, then the Connection. */
  const followsValue = (from: JobKey) => ({
    value: t(from === "agents" ? "connections.defaults.followsAgents" : "connections.defaults.followsMain"),
    muted: true,
  });
  const inherited = (row: ConnectionRowData | null, from: JobKey) =>
    from === "main" && mainIsBuiltIn
      ? { value: sidecarName, muted: true, warning: builtInWarning }
      : row
        ? followsValue(from)
        : null;

  const accountOf = (row: ConnectionRowData) => (row.accountId ? accountById.get(row.accountId) : undefined);
  const usable = (row: ConnectionRowData | null | undefined) => !!row && (accountOf(row)?.state ?? "ok") === "ok";
  /** A blocked job names the model that answers instead, as the server falls back to it; its fix stays. */
  const blockedWarning = (row: ConnectionRowData, job: string, instead: ConnectionRowData | null | undefined) => {
    const account = accountOf(row);
    const warning = accountWarning(account);
    if (!warning || !account || !usable(instead)) return warning;
    const key =
      account.state === "off" ? "connections.defaults.warning.offUses" : "connections.defaults.warning.needsKeyUses";
    return { ...warning, text: t(key, { job, model: describe(instead!).value }) };
  };

  const tiles: DefaultsTile[] = FLAG_JOBS.map((role) => {
    const primary = primaryOf(role);
    const fallbackRow =
      connectionsList.find((row) => matchesKind(row, role.kind) && isConnectionFlagTrue(row[role.fallback])) ?? null;
    const isAgents = role.key === "agents";
    const tile = {
      ...jobTile(role.key),
      fallback: fallbackRow ? describe(fallbackRow).value : undefined,
      warning: null,
    };
    if (isAgents && sidecarAsAgentsDefault) return { ...tile, value: sidecarName, warning: builtInWarning };
    if (role.key === "main" && mainIsBuiltIn) return { ...tile, value: sidecarName, warning: builtInWarning };
    // The TTS card names a row that is gone: the server then fails (tts.routes.ts), it does not use the default.
    if (role.key === "voice" && voiceRowOf(connectionsList, tts?.connectionId).missing) {
      const flagged = voiceRowOf(connectionsList).row;
      return {
        ...tile,
        value: t("connections.defaults.notSet"),
        muted: true,
        warning: {
          text: t("connections.defaults.warning.voiceMissing"),
          fix: {
            label: flagged
              ? t("connections.defaults.fix.useModel", { model: describe(flagged).value })
              : t("connections.defaults.fix.clear"),
            run: () =>
              void followVoiceJob(flagged?.id ?? null).catch(() => toast.error(t("connections.defaults.saveFailed"))),
          },
        },
      };
    }
    if (primary) {
      const ttsOff = role.key === "voice" && tts && !tts.enabled;
      // Game sound effects and music still use this row with text to speech off: a note, not a problem.
      const makesEffects = isConnectionFlagTrue(primary.audioSoundEffects) || isConnectionFlagTrue(primary.audioMusic);
      return {
        ...tile,
        ...describe(primary),
        ...(ttsOff && makesEffects ? { hint: t("connections.defaults.ttsOffEffects") } : {}),
        warning:
          blockedWarning(primary, tile.title, fallbackRow) ??
          (ttsOff && !makesEffects
            ? {
                text: t("connections.defaults.warning.ttsOff"),
                fix: {
                  label: t("connections.defaults.fix.turnOn"),
                  run: () => updateTTS.mutate({ ...tts, enabled: true }),
                },
              }
            : null),
      };
    }
    // With no Audio connection, text to speech reads with the TTS card's own source settings.
    if (role.key === "voice" && tts?.enabled) {
      const value = t(`connections.device.ttsSource.${tts.source}`);
      return { ...tile, value, hint: t("connections.add.device.tts"), muted: true };
    }
    // Agents follow the chat's model; a new chat uses Main.
    if (isAgents)
      return {
        ...tile,
        ...(inherited(mainRow, "main") ?? followsValue("main")),
      };
    return {
      ...tile,
      value: t("connections.defaults.notSet"),
      muted: true,
      warning: role.key === "main" ? { text: t("connections.defaults.warning.noMain") } : null,
    };
  });

  // Embeddings: an app setting naming a Model with an embedding model, or the sidecar.
  const embeddingId = embeddingDefault.data?.connectionId ?? null;
  const embeddingRow = embeddingId ? connectionsList.find((row) => row.id === embeddingId) : undefined;
  const embeddings: DefaultsTile = {
    ...jobTile("embeddings"),
    value: t("connections.defaults.notSet"),
    muted: true,
    warning: null,
  };
  if (embeddingId === LOCAL_SIDECAR_CONNECTION_ID)
    Object.assign(embeddings, { value: sidecarName, muted: false, warning: builtInWarning });
  else if (embeddingRow) {
    const account = embeddingRow.accountId ? accountById.get(embeddingRow.accountId) : undefined;
    Object.assign(embeddings, {
      value: embeddingRow.embeddingModel?.trim() || embeddingRow.name,
      hint: account?.name ?? embeddingRow.name,
      muted: false,
      warning: accountWarning(account),
    });
  } else if (embeddingId) {
    Object.assign(embeddings, {
      value: t("connections.defaults.missing"),
      warning: { text: t("connections.defaults.warning.missing") },
    });
  }

  // Decision: the Local Model slot that is not downloaded yet leads to its set-up screen.
  const decisionSelected = decisionOptions.data?.options.find((entry) => entry.selected) ?? null;
  const decisionNeedsLocal =
    decisionSelected?.slot === "primary" &&
    (decisionSelected.unavailable === "no_model" || decisionSelected.unavailable === "not_installed");
  const decision: DefaultsTile = {
    ...jobTile("decision"),
    value: decisionSelected?.label ?? t("connections.defaults.off"),
    muted: !decisionSelected,
    warning: decisionNeedsLocal
      ? {
          text: t("connections.defaults.warning.notDownloaded", { model: decisionSelected.label }),
          fix: {
            label: t("connections.defaults.setUp"),
            run: () => openAddConnection({ category: "device", item: "local-model" }),
          },
        }
      : decisionSelected?.unavailable
        ? { text: t("connections.defaults.warning.unavailable") }
        : null,
    ...(decisionNeedsLocal
      ? { setup: { item: "local-model" as const, text: t("connections.defaults.notDownloadedShort") } }
      : {}),
  };

  // Speech to text chooses a service; the engine row manages the engine.
  const stt: DefaultsTile | null = deviceSetup.stt.available
    ? {
        ...jobTile("stt"),
        warning: null,
        ...(deviceSetup.stt.setUp
          ? { value: t("connections.accounts.state.ok"), hint: t("connections.add.device.stt"), device: "stt" as const }
          : {
              value: t("connections.accounts.state.off"),
              muted: true,
              setup: { item: "stt" as const, text: t("connections.defaults.notSetUp") },
            }),
      }
    : null;

  // Features name a Model, the sidecar, or a value of their own; unset ones follow their default. They stay out of
  // the problem count, as before.
  const features: DefaultsTile[] = JOBS.filter((job) => job.feature).map((job) => {
    const value = featureModels.data?.[job.feature!] ?? null;
    const extra = FEATURE_EXTRA_OPTIONS[job.key]?.find((option) => option.value === value);
    const row = value ? connectionsList.find((entry) => entry.id === value) : undefined;
    const fallbackId = job.fallbackFeature ? featureModels.data?.[job.fallbackFeature] : null;
    const fallbackRow = fallbackId ? connectionsList.find((entry) => entry.id === fallbackId) : undefined;
    const tile = {
      ...jobTile(job.key),
      warning: null,
      fallback: fallbackRow ? describe(fallbackRow).value : undefined,
    };
    if (!value) {
      // What the server runs when unset: Quick answers use the built-in model; Prof. Mari the agents
      // default, then Main; Impersonate the chat's model, which is Main in a new chat; Image reading nothing.
      if (job.follows === "sidecar") return { ...tile, value: sidecarName, muted: true, warning: builtInWarning };
      const from =
        job.follows === "agents"
          ? sidecarAsAgentsDefault
            ? { value: sidecarName, muted: true, warning: builtInWarning }
            : (inherited(agentsRow, "agents") ?? inherited(mainRow, "main"))
          : job.follows === "main"
            ? inherited(mainRow, "main")
            : null;
      return { ...tile, ...(from ?? { value: t(`connections.defaults.featureDefault.${job.feature}`), muted: true }) };
    }
    if (extra) return { ...tile, value: t(extra.key) };
    if (value === LOCAL_SIDECAR_CONNECTION_ID) return { ...tile, value: sidecarName, warning: builtInWarning };
    // A blocked model names who answers instead, as the server falls back: Impersonate uses the chat's model,
    // which is Main in a new chat; Image reading has no fallback; the rest use the agents default, then Main.
    if (row)
      return {
        ...tile,
        ...describe(row),
        warning: blockedWarning(
          row,
          tile.title,
          job.follows === "main" ? mainRow : job.follows === "off" ? null : usable(agentsRow) ? agentsRow : mainRow,
        ),
      };
    return {
      ...tile,
      value: t("connections.defaults.missing"),
      warning: { text: t("connections.defaults.warning.missing") },
    };
  });

  const byKey = new Map(
    [...tiles, embeddings, decision, ...(stt ? [stt] : []), ...features].map((tile) => [tile.key, tile]),
  );
  return JOBS.map((job) => byKey.get(job.key)).filter((tile): tile is DefaultsTile => !!tile);
}

/** Persisted with the Connection folds; no Connection id is "defaults". */
export const DEFAULTS_FOLD_ID = "defaults";

type RoleField = (typeof FLAG_JOBS)[number]["flag"] | (typeof FLAG_JOBS)[number]["fallback"];

/** The jobs' Model pickers and the setters behind them; one hook so the rows stay plain. */
function useJobModels(connectionsList: ConnectionRowData[]) {
  const { t } = useTranslation();
  const { data: tts } = useTTSConfig();
  const followVoiceJob = useFollowVoiceJob();
  const updateConnection = useUpdateConnection();
  const sidecarAsAgentsDefault = useSidecarStore((s) => s.config.useAsAgentsDefault);
  const mainIsBuiltIn = useSidecarStore((s) => s.config.useAsMainDefault);
  const updateSidecarConfig = useSidecarStore((s) => s.updateConfig);
  const featureModels = useFeatureModels();
  const setFeatureModels = useSetFeatureModels();
  const lite = import.meta.env.VITE_MARINARA_LITE === "true";

  const setRole = (field: RoleField, current: ConnectionRowData | null, nextId: string | null) => {
    if (nextId === (current?.id ?? null)) return;
    if (!nextId) {
      if (current) updateConnection.mutate({ id: current.id, [field]: false });
      return;
    }
    updateConnection.mutate({ id: nextId, [field]: true });
  };
  const setMainDefault = (current: ConnectionRowData | null, nextId: string | null) => {
    if (nextId === LOCAL_SIDECAR_CONNECTION_ID) {
      if (mainIsBuiltIn) return;
      void updateSidecarConfig({ useAsMainDefault: true });
      // The built-in model replaces any row-level Main; keep one source.
      if (current) updateConnection.mutate({ id: current.id, isDefault: false });
      return;
    }
    if (mainIsBuiltIn) void updateSidecarConfig({ useAsMainDefault: false });
    setRole("isDefault", current, nextId);
  };
  const setAgentsDefault = (current: ConnectionRowData | null, nextId: string | null) => {
    if (nextId === LOCAL_SIDECAR_CONNECTION_ID) {
      if (sidecarAsAgentsDefault) return;
      void updateSidecarConfig({ useAsAgentsDefault: true });
      // The sidecar default replaces any row-flag default; keep one source.
      if (current) updateConnection.mutate({ id: current.id, defaultForAgents: false });
      return;
    }
    if (sidecarAsAgentsDefault) void updateSidecarConfig({ useAsAgentsDefault: false });
    setRole("defaultForAgents", current, nextId);
  };

  /** What a job's picker needs: its two slots' values and setters. */
  const modelFor = (job: Job) => {
    const feature = job.feature;
    if (feature) {
      const fallbackKey = job.fallbackFeature;
      return {
        kind: job.kind ?? "chat",
        value: featureModels.data?.[feature] ?? null,
        onChange: (id: string | null) => setFeatureModels.mutate({ [feature]: id }),
        fallback: fallbackKey
          ? {
              value: featureModels.data?.[fallbackKey] ?? null,
              onChange: (id: string | null) => setFeatureModels.mutate({ [fallbackKey]: id }),
            }
          : undefined,
        defaultLabel: t(`connections.defaults.featureDefault.${feature}`),
        extraOptions: (FEATURE_EXTRA_OPTIONS[job.key as JobKey] ?? []).map((extra) => ({
          value: extra.value,
          label: t(extra.key),
        })),
        includeLocalSidecar: !lite && job.key !== "vision",
      };
    }
    const role = FLAG_JOBS.find((entry) => entry.key === job.key);
    if (!role) return null;
    const rows = connectionsList.filter((row) => matchesKind(row, role.kind));
    const primary =
      job.key === "voice"
        ? voiceRowOf(connectionsList, tts?.connectionId).row
        : (rows.find((row) => isConnectionFlagTrue(row[role.flag])) ?? null);
    const fallbackRow = rows.find((row) => isConnectionFlagTrue(row[role.fallback])) ?? null;
    const isAgents = job.key === "agents";
    const isMain = job.key === "main";
    return {
      kind: role.kind,
      value:
        (isAgents && sidecarAsAgentsDefault) || (isMain && mainIsBuiltIn)
          ? LOCAL_SIDECAR_CONNECTION_ID
          : (primary?.id ?? null),
      onChange: (id: string | null) => {
        if (isAgents) return setAgentsDefault(primary, id);
        if (isMain) return setMainDefault(primary, id);
        setRole(role.flag, primary, id);
        if (job.key === "voice") void followVoiceJob(id).catch(() => toast.error(t("connections.defaults.saveFailed")));
      },
      fallback: {
        value: fallbackRow?.id ?? null,
        onChange: (id: string | null) => setRole(role.fallback, fallbackRow, id),
      },
      defaultLabel: isAgents ? t("connections.defaults.followsMain") : t("connections.defaults.none"),
      extraOptions: [],
      includeLocalSidecar: (isAgents || isMain) && !lite,
      required: isMain,
    };
  };
  return modelFor;
}

/** The rest of the Agents job: the paid-model warning and a reset of every agent's own Model. */
function AgentsSettings() {
  const { t } = useTranslation();
  const showPaid = useUIStore((s) => s.showPaidAgentConnectionWarning);
  const setShowPaid = useUIStore((s) => s.setShowPaidAgentConnectionWarning);
  const { data: agentConfigs } = useAgentConfigs();
  const updateAgent = useUpdateAgent();
  const [resetting, setResetting] = useState(false);
  const toReset = useMemo(
    () =>
      (agentConfigs ?? []).filter(
        (config) =>
          config.connectionId != null &&
          !isRetiredBuiltInAgentId(config.type) &&
          !isAgentConfigDeleted(config.settings),
      ),
    [agentConfigs],
  );
  const reset = async () => {
    if (toReset.length === 0) return;
    const confirmed = await showConfirmDialog({
      title: t("connections.defaults.resetAgents"),
      message: t("connections.defaults.resetAgentsConfirm", { count: toReset.length }),
    });
    if (!confirmed) return;
    setResetting(true);
    try {
      const results = await Promise.allSettled(
        toReset.map((config) => updateAgent.mutateAsync({ id: config.id, connectionId: null })),
      );
      const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (rejected) throw rejected.reason;
      toast.success(t("connections.defaults.resetAgentsDone", { count: toReset.length }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("connections.defaults.resetAgentsFailed"));
    } finally {
      setResetting(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 p-4">
      <ToggleSetting
        label={t("connections.defaults.paidWarning")}
        checked={showPaid}
        onChange={setShowPaid}
        help={t("connections.defaults.paidWarningHelp")}
      />
      <button
        type="button"
        onClick={() => void reset()}
        disabled={resetting || toReset.length === 0}
        className={cn(SMALL_ACTION, "w-fit")}
        title={t("connections.defaults.resetAgentsHelp")}
      >
        {resetting ? <Loader2 size="0.75rem" className="animate-spin" /> : t("connections.defaults.resetAgents")}
      </button>
    </div>
  );
}

/** One job: its row opens the job's picker; Agents and Decision keep their other settings behind a gear. */
function DefaultsJobRow({
  tile,
  job,
  modelFor,
  onOpenDevice,
}: {
  tile: DefaultsTile;
  job: Job;
  modelFor: ReturnType<typeof useJobModels>;
  onOpenDevice: (item: DeviceItem) => void;
}) {
  const { t } = useTranslation();
  const mayReadImages = useMayReadImages();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const embeddings = job.key === "embeddings";
  const decision = job.key === "decision";
  const hasSettings = job.key === "agents" || decision;
  const model = embeddings || decision || job.device ? null : modelFor(job);
  const title = t(jobLabelKey(job));
  const onClick = () => {
    if (tile.device) return onOpenDevice(tile.device);
    if (tile.setup?.item) return openAddConnection({ category: "device", item: tile.setup.item });
    setOpen(true);
  };
  return (
    <div className="relative" data-defaults-role={job.key}>
      <JobRow
        tile={tile}
        data-defaults-tile={job.key}
        onClick={onClick}
        aria-haspopup={tile.device ? undefined : "dialog"}
        aria-label={t("connections.defaults.jobLabel", { role: tile.title, value: tile.value })}
        trailing={
          <>
            {hasSettings && <span aria-hidden className="w-8 shrink-0" />}
            <ChevronRight size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
          </>
        }
      />
      {hasSettings && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t("connections.defaults.settingsFor", { role: title })}
          className="absolute right-9 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)]/40 hover:text-[var(--foreground)] max-md:right-7"
        >
          <SlidersHorizontal size="0.875rem" />
        </button>
      )}
      {model && (
        <ConnectionSelect
          variant="controlled"
          open={open}
          onOpenChange={setOpen}
          job={title}
          rowFilter={job.key === "vision" ? mayReadImages : undefined}
          {...model}
        />
      )}
      {embeddings && <EmbeddingDefaultControl open={open} onOpenChange={setOpen} />}
      {decision && <DecisionDefaultControl open={open} onOpenChange={setOpen} />}
      {hasSettings && (
        <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title={title} width="max-w-md">
          {decision ? <DecisionDefaultControl settings /> : <AgentsSettings />}
        </Modal>
      )}
    </div>
  );
}

/** The Jobs box at the top of the Connections panel: every job, its Model, and its "If it fails" Model. */
export function ConnectionDefaultsBox({
  connectionsList,
  onOpenDevice,
}: {
  connectionsList: ConnectionRowData[];
  onOpenDevice: (item: DeviceItem) => void;
}) {
  const { t } = useTranslation();
  const tiles = useConnectionDefaults(connectionsList);
  const modelFor = useJobModels(connectionsList);
  const folded = useUIStore((s) => s.connectionsCollapsed.includes(DEFAULTS_FOLD_ID));
  const toggleFold = useUIStore((s) => s.toggleConnectionCollapsed);
  const groups = [...new Set(JOBS.map((job) => job.group))];
  return (
    <section
      aria-labelledby="connections-defaults-title"
      className="mari-connection-group mari-connection-defaults-box"
    >
      <button
        type="button"
        data-connection-row="defaults"
        onClick={() => toggleFold(DEFAULTS_FOLD_ID)}
        aria-expanded={!folded}
        aria-controls={folded ? undefined : "connections-defaults"}
        className={cn("relative flex min-h-11 w-full min-w-0 items-center gap-1.5 px-1.5 py-1 text-start", FOCUS)}
      >
        <span
          id="connections-defaults-title"
          className="min-w-0 flex-1 text-base font-semibold leading-6 text-[var(--foreground)]"
        >
          {t("connections.defaults.title")}
        </span>
        <ChevronDown
          size="1rem"
          className={cn(
            "shrink-0 text-[var(--muted-foreground)] transition-transform motion-reduce:transition-none",
            folded && "-rotate-90",
          )}
        />
      </button>
      {!folded && (
        <div id="connections-defaults" className="flex flex-col gap-1 pt-0.5">
          {groups.map((group) => (
            <div key={group} role="group" aria-labelledby={`connections-defaults-group-${group}`}>
              <p id={`connections-defaults-group-${group}`} className="mari-connection-defaults-group">
                {t(`connections.defaults.group.${group}`)}
              </p>
              <div className="mari-connection-model-well">
                {tiles
                  .filter((tile) => JOB[tile.key].group === group)
                  .map((tile) => (
                    <div key={tile.key} className="mari-connection-model-slot min-w-0">
                      <DefaultsJobRow tile={tile} job={JOB[tile.key]} modelFor={modelFor} onOpenDevice={onOpenDevice} />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
