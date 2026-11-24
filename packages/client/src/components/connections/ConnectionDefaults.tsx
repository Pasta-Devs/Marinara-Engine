// ──────────────────────────────────────────────
// ConnectionDefaults — the jobs' Models. The Jobs card at the top of the Connections panel shows Main, one
// sentence on what the other jobs follow, and their problems; the Jobs page lists every job: the ones with a
// Model of their own as rows (with "If it fails"), the ones that follow Main or Agents or are off as chips. A row
// or chip opens the job's one picker; a job with settings of its own keeps them behind a gear.
// ──────────────────────────────────────────────
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, ChevronRight, Shuffle, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BUILTIN_EMBEDDING_CONNECTION_ID,
  LOCAL_SIDECAR_CONNECTION_ID,
  isAgentConfigDeleted,
  isChatProvider,
  parseConnectionImageCaptioningDefaults,
  type TTSSource,
  isRetiredBuiltInAgentId,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import {
  useConnections,
  useMayReadImages,
  useDefaultEmbeddingConnection,
  useModelLists,
  useUpdateConnection,
} from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useFeatureModels,
  useSetFeatureModels,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { useAgentConfigs, useUpdateAgent } from "../../hooks/use-agents";
import { useBuiltinEmbedding } from "../../hooks/use-builtin-embedding";
import { useBuiltinTts } from "../../hooks/use-builtin-tts";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import { useFollowVoiceJob, useMigrateVoiceJob, useTTSConfig } from "../../hooks/use-tts";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { i18n } from "../../localization/i18n";
import { openAddConnection, type SetupItem } from "../../lib/add-connection";
import { createLocalSidecarConnectionOption, isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { SpeechToTextCard } from "../panels/settings/SpeechToTextCard";
import { TTSConfigCard } from "../panels/settings/TTSConfigCard";
import { Modal } from "../ui/Modal";
import { ConnectionSelect } from "./ConnectionSelect";
import {
  FLAG_JOBS,
  JOB,
  JOBS,
  jobLabelKey,
  matchesKind,
  voiceRowOf,
  voiceSources,
  foundForJob,
  type Job,
  type JobKey,
} from "../../lib/connection-jobs";
import { summarizeJobs, type JobBucket } from "../../lib/connection-jobs-summary";
import { MARI_QUICK_CONNECTION } from "../../lib/omnibar-aside-text";
import { EmbeddingDefaultControl } from "./EmbeddingDefaultControl";
import { DecisionDefaultControl } from "./DecisionDefaultControl";
import { ImageReadingSettings } from "./ImageReadingSettings";
import { LocalWhisper, SMALL_ACTION } from "./DeviceDetail";
import { ROW_BUTTON, type ConnectionRowData } from "./ConnectionRow";
import { JobRow, isUnset } from "./JobRow";
import { mediaSources } from "../../lib/media-source";
import { Spinner } from "../ui/Spinner";

function JobIcon({ job }: { job: JobKey }) {
  const Icon = JOB[job].icon;
  return <Icon size="0.6875rem" />;
}

/** Feature values that are not a Model: quick answers can follow Professor Mari, Impersonate can shuffle. */
const FEATURE_EXTRA_OPTIONS: Partial<Record<JobKey, Array<{ value: string; key: string; icon: LucideIcon }>>> = {
  quick: [{ value: MARI_QUICK_CONNECTION, key: "connections.defaults.featureOption.sameAsMari", icon: JOB.mari.icon }],
  impersonate: [{ value: "random", key: "connections.defaults.featureOption.random", icon: Shuffle }],
};
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

/** `quiet`: an optional step, not a problem, so its fix shows without the amber warning look. */
type Warning = { text: string; short?: string; quiet?: boolean; fix?: { label: string; run: () => void } };

export type DefaultsTile = {
  key: JobKey;
  icon: ReactNode;
  title: string;
  value: string;
  /** The Connection, or what kind of service it is. */
  hint?: string;
  /** The fallback Model's name, when the job has one. */
  fallback?: string;
  /** The fallback Model, for its picture. */
  fallbackSource?: ConnectionRowData;
  /** The fallback Model's account. */
  fallbackHint?: string;
  /** An unset job reads quieter than a chosen one. */
  muted?: boolean;
  warning: Warning | null;
  /** The chosen Model, for its picture. */
  source?: ConnectionRowData;
  /** The job this one follows ("Follows Main"): `value` and `source` are the Model it really runs. */
  follows?: string;
  /** The engine this job needs is not set up: the tile leads to its set-up screen. */
  setup?: { item: SetupItem; text: string };
  /** An empty job: how many models the accounts' catalogs offer for it (Pick), or none (Add). */
  find?: { count: number; accounts: string[]; unknown?: boolean };
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
  const builtinEmbedding = useBuiltinEmbedding();
  const builtinEmbeddingActive =
    builtinEmbedding.data?.models.find((model) => model.id === builtinEmbedding.data?.activeModelId) ?? null;
  const decisionOptions = useDecisionOptions();
  const deviceSetup = useDeviceSetup();
  const { data: tts } = useTTSConfig();
  const speechToTextEnabled = useUIStore((s) => s.speechToTextEnabled);
  const followVoiceJob = useFollowVoiceJob();
  const featureModels = useFeatureModels();

  const accountById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const mainIsBuiltIn = useSidecarStore((s) => s.config.useAsMainDefault);
  const sidecarRow: ConnectionRowData = createLocalSidecarConnectionOption(sidecarModelDisplayName);
  const sidecarName = sidecarRow.name;
  /** The built-in model as a Model of its own, so its row has a picture and a name like any other. */
  const sidecarModel = { value: sidecarName, source: sidecarRow };
  // A job that points at the built-in model before it is downloaded shows the same fix as the Decision row.
  const builtInDownloaded = useSidecarStore((s) => s.modelDownloaded);
  const builtInWarning = builtInDownloaded
    ? null
    : {
        text: t("connections.defaults.warning.notDownloaded", { model: sidecarName }),
        short: t("connections.defaults.notDownloadedShort"),
        // The built-in model is optional.
        quiet: true,
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
        short: t("connections.defaults.warning.offShort"),
        fix: {
          label: t("connections.defaults.fix.turnOn"),
          run: () => updateAccount.mutate({ id: account.id, enabled: true }),
        },
      };
    }
    return {
      text: t("connections.defaults.warning.needsKey", { connection: account.name }),
      short: t("connections.defaults.warning.needsKeyShort"),
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
  /** An unset job shows the model that really runs, like any row; "Follows Main/Agents" is the row's state. */
  const followsText = (from: JobKey) =>
    t(from === "agents" ? "connections.defaults.followsAgents" : "connections.defaults.followsMain");
  /** The followed job has no model: the plain "Follows ..." line. */
  const followsValue = (from: JobKey) => ({ value: followsText(from), muted: true });
  const inherited = (row: ConnectionRowData | null, from: JobKey) => {
    const model =
      from === "main" && mainIsBuiltIn ? { ...sidecarModel, warning: builtInWarning } : row ? describe(row) : null;
    const warning = from === "main" && mainIsBuiltIn ? builtInWarning : row ? accountWarning(accountOf(row)) : null;
    return model && { ...model, follows: followsText(from), warning };
  };

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
      fallbackSource: fallbackRow ?? undefined,
      fallbackHint: fallbackRow ? describe(fallbackRow).hint : undefined,
      warning: null,
    };
    if (isAgents && sidecarAsAgentsDefault) return { ...tile, ...sidecarModel, warning: builtInWarning };
    if (role.key === "main" && mainIsBuiltIn) return { ...tile, ...sidecarModel, warning: builtInWarning };
    // The TTS card names a row that is gone: the server then fails (tts.routes.ts), it does not use the default.
    if (role.key === "voice" && voiceRowOf(connectionsList, tts?.connectionId).missing) {
      const flagged = voiceRowOf(connectionsList).row;
      return {
        ...tile,
        value: t("connections.defaults.notSet"),
        muted: true,
        warning: {
          text: t("connections.defaults.warning.voiceMissing"),
          short: t("connections.defaults.warning.missingShort"),
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
      // Game sound effects and music still use this row with voice off: a note, not a problem.
      const makesEffects = isConnectionFlagTrue(primary.audioSoundEffects) || isConnectionFlagTrue(primary.audioMusic);
      if (ttsOff && !makesEffects) return { ...tile, value: t("connections.defaults.voiceOff"), muted: true };
      return {
        ...tile,
        ...describe(primary),
        ...(ttsOff ? { hint: t("connections.defaults.ttsOffEffects"), muted: true } : {}),
        warning: blockedWarning(primary, tile.title, fallbackRow),
      };
    }
    // With no Audio connection, text to speech reads with a built-in source.
    if (role.key === "voice" && tts?.enabled) {
      return { ...tile, value: t(`connections.device.ttsSource.${tts.source}`), hint: t("connections.add.device.tts") };
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
      warning:
        role.key === "main"
          ? { text: t("connections.defaults.warning.noMain"), short: t("connections.defaults.warning.noMainShort") }
          : null,
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
    Object.assign(embeddings, { ...sidecarModel, muted: false, warning: builtInWarning });
  else if (embeddingId === BUILTIN_EMBEDDING_CONNECTION_ID) {
    const name = t("connections.builtinEmbedding.name");
    Object.assign(embeddings, {
      // The model's own name says enough; "Built-in model (embeddings)" before it would push it out of the cell.
      value: builtinEmbeddingActive?.label ?? name,
      source: { id: BUILTIN_EMBEDDING_CONNECTION_ID, name, provider: "builtin-embedding" } as ConnectionRowData,
      muted: false,
      warning: builtinEmbeddingActive
        ? null
        : {
            text: t("connections.defaults.warning.notDownloaded", { model: name }),
            short: t("connections.defaults.notDownloadedShort"),
            fix: {
              label: t("connections.defaults.setUp"),
              run: () => useUIStore.getState().openConnectionsPanelPage("device:local-model"),
            },
          },
    });
  } else if (embeddingRow) {
    const account = embeddingRow.accountId ? accountById.get(embeddingRow.accountId) : undefined;
    Object.assign(embeddings, {
      value: embeddingRow.embeddingModel?.trim() || embeddingRow.name,
      hint: account?.name ?? embeddingRow.name,
      // The row draws the embedding model, not the chat model the same Model also saves.
      source: { ...embeddingRow, model: embeddingRow.embeddingModel?.trim() || embeddingRow.model },
      muted: false,
      warning: accountWarning(account),
    });
  } else if (embeddingId) {
    Object.assign(embeddings, {
      value: t("connections.defaults.missing"),
      warning: {
        text: t("connections.defaults.warning.missing"),
        short: t("connections.defaults.warning.missingShort"),
      },
    });
  }

  // Decision: the Local Model slot that is not downloaded yet leads to its set-up screen.
  const decisionSelected = decisionOptions.data?.options.find((entry) => entry.selected) ?? null;
  const decisionNeedsLocal =
    decisionSelected?.slot === "primary" &&
    (decisionSelected.unavailable === "no_model" || decisionSelected.unavailable === "not_installed");
  // The built-in decision model turned off, not installed, or with a runtime an update made stale: its own
  // window turns it on, installs it, or reinstalls the runtime.
  const decisionNeedsBuiltIn =
    decisionSelected?.slot === "decision_sidecar" &&
    (decisionSelected.unavailable === "not_installed" || decisionSelected.unavailable === "not_enabled");
  const decisionRow =
    decisionSelected?.group === "connection"
      ? connectionsList.find((row) => row.id === decisionSelected.id)
      : undefined;
  const decision: DefaultsTile = {
    ...jobTile("decision"),
    ...(decisionRow
      ? { ...describe(decisionRow), value: decisionSelected!.label }
      : decisionSelected
        ? {
            value: decisionSelected.label,
            source: { ...sidecarRow, id: decisionSelected.id, name: decisionSelected.label },
          }
        : { value: t("connections.defaults.off"), muted: true }),
    warning: decisionNeedsLocal
      ? {
          text: t("connections.defaults.warning.notDownloaded", { model: decisionSelected.label }),
          short: t("connections.defaults.notDownloadedShort"),
          fix: {
            label: t("connections.defaults.setUp"),
            run: () => openAddConnection({ category: "device", item: "local-model" }),
          },
        }
      : decisionNeedsBuiltIn
        ? {
            text: t("connections.defaults.warning.decisionBuiltInNotReady"),
            short: t("connections.defaults.notSetUp"),
            fix: {
              label: t("connections.defaults.setUp"),
              run: () => openAddConnection({ category: "device", item: "decision-builtin" }),
            },
          }
        : decisionSelected?.unavailable
          ? {
              text: t("connections.defaults.warning.unavailable"),
              short: t("connections.defaults.warning.unavailableShort"),
            }
          : null,
    ...(decisionNeedsLocal
      ? { setup: { item: "local-model" as const, text: t("connections.defaults.notDownloadedShort") } }
      : decisionNeedsBuiltIn
        ? { setup: { item: "decision-builtin" as const, text: t("connections.defaults.notSetUp") } }
        : {}),
  };

  // Dictation: the chat microphone, and with Calls a speech-to-text server; the gear holds both.
  const sttOn = speechToTextEnabled || deviceSetup.stt.setUp;
  const stt: DefaultsTile = {
    ...jobTile("stt"),
    warning: null,
    value: t(sttOn ? "connections.accounts.state.ok" : "connections.accounts.state.off"),
    muted: !sttOn,
  };

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
      fallbackSource: fallbackRow ?? undefined,
      fallbackHint: fallbackRow ? describe(fallbackRow).hint : undefined,
    };
    if (!value) {
      // What the server runs when unset: Quick answers use the built-in model; Prof. Mari the agents
      // default, then Main; Impersonate the chat's model, which is Main in a new chat; Image reading nothing.
      if (job.follows === "sidecar") return { ...tile, ...sidecarModel, warning: builtInWarning };
      const from =
        job.follows === "agents"
          ? sidecarAsAgentsDefault
            ? { ...sidecarModel, follows: followsText("agents"), warning: builtInWarning }
            : (inherited(agentsRow, "agents") ?? inherited(mainRow, "main"))
          : job.follows === "main"
            ? inherited(mainRow, "main")
            : null;
      return { ...tile, ...(from ?? { value: t(`connections.defaults.featureDefault.${job.feature}`), muted: true }) };
    }
    if (extra) return { ...tile, value: t(extra.key) };
    if (value === LOCAL_SIDECAR_CONNECTION_ID) return { ...tile, ...sidecarModel, warning: builtInWarning };
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
      warning: {
        text: t("connections.defaults.warning.missing"),
        short: t("connections.defaults.warning.missingShort"),
      },
    };
  });

  const byKey = new Map([...tiles, embeddings, decision, stt, ...features].map((tile) => [tile.key, tile]));
  const all = JOBS.map((job) => byKey.get(job.key)).filter((tile): tile is DefaultsTile => !!tile);
  // An empty job counts what the accounts' catalogs offer for it, so its row can say what to pick or that one is needed.
  const notSet = t("connections.defaults.notSet");
  const isEmpty = (tile: DefaultsTile) =>
    !tile.device && !tile.setup && (isUnset(tile, notSet) || (tile.key === "decision" && !decisionSelected));
  const anyEmpty = all.some(isEmpty);
  const catalogRows = (accounts ?? []).flatMap((account) => {
    const row =
      account.state === "ok" &&
      connectionsList.find((entry) => entry.accountId === account.id && entry.provider === account.provider);
    return row ? [{ account, id: row.id }] : [];
  });
  const lists = useModelLists(anyEmpty ? catalogRows.map((entry) => entry.id) : []);
  const catalogs = catalogRows.flatMap(({ account }, index) => {
    const list = lists[index]?.data;
    return list ? [{ name: account.name, provider: account.provider, models: list.models ?? [] }] : [];
  });
  // Accounts with no catalog list (a Decision account) still offer the Models saved under them.
  const listed = new Set(catalogRows.filter((_, index) => lists[index]?.data).map(({ account }) => account.id));
  // A list still loading or failed can hide models: then Pick (the picker shows its own state), never Add.
  const unknown = !lists.every((list) => list.isSuccess);
  const findFor = (job: Job) => {
    const found = foundForJob(job, catalogs, (provider, kind) => mediaSources(provider, kind).length > 0);
    const kind = job.kind;
    const saved =
      kind && job.key !== "embeddings"
        ? connectionsList.filter((row) => !listed.has(row.accountId ?? "") && matchesKind(row, kind))
        : [];
    const names = saved.map((row) => accountOf(row)?.name ?? row.name);
    // A downloaded built-in embedding model is a choice for Embeddings with no account: Pick it, never Add one.
    if (job.key === "embeddings" && builtinEmbeddingActive) names.push(t("connections.builtinEmbedding.name"));
    const builtin = job.key === "embeddings" && builtinEmbeddingActive ? 1 : 0;
    return {
      count: found.count + saved.length + builtin,
      accounts: [...new Set([...found.accounts, ...names])],
      unknown,
    };
  };
  return all.map((tile) => (isEmpty(tile) ? { ...tile, find: findFor(JOB[tile.key]) } : tile));
}

/** Voice job picker values for a built-in text to speech source, not a Model. */
export const DEVICE_VOICE = "tts-source:";

type RoleField = (typeof FLAG_JOBS)[number]["flag"] | (typeof FLAG_JOBS)[number]["fallback"];

/** The jobs' Model pickers and the setters behind them; one hook so the rows stay plain. */
export function useJobModels(connectionsList: ConnectionRowData[]) {
  const { t } = useTranslation();
  const { data: tts } = useTTSConfig();
  const builtinTts = useBuiltinTts();
  const followVoiceJob = useFollowVoiceJob();
  const updateConnection = useUpdateConnection();
  const sidecarAsAgentsDefault = useSidecarStore((s) => s.config.useAsAgentsDefault);
  const mainIsBuiltIn = useSidecarStore((s) => s.config.useAsMainDefault);
  const updateSidecarConfig = useSidecarStore((s) => s.updateConfig);
  const featureModels = useFeatureModels();
  const setFeatureModels = useSetFeatureModels();
  const lite = import.meta.env.VITE_MARINARA_LITE === "true";

  const setRole = (field: RoleField, current: { id: string } | null, nextId: string | null) => {
    if (nextId === (current?.id ?? null)) return;
    if (!nextId) {
      if (current) updateConnection.mutate({ id: current.id, [field]: false });
      return;
    }
    updateConnection.mutate({ id: nextId, [field]: true });
  };
  // Read the sidecar flags fresh: an Undo can run after the window that set the job closed.
  const setMainDefault = (current: { id: string } | null, nextId: string | null) => {
    const mainIsBuiltIn = useSidecarStore.getState().config.useAsMainDefault;
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
  const setAgentsDefault = (current: { id: string } | null, nextId: string | null) => {
    const sidecarAsAgentsDefault = useSidecarStore.getState().config.useAsAgentsDefault;
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
          icon: <extra.icon size="0.875rem" className="mx-[0.3125rem] shrink-0 text-foreground/55" aria-hidden />,
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
    const isVoice = job.key === "voice";
    // The Voice job is the text to speech switch: no Model while it is off; a built-in source has no connection.
    const voiceValue = !tts?.enabled ? null : (primary?.id ?? `${DEVICE_VOICE}${tts.source}`);
    const sources = !tts
      ? []
      : [
          ...new Set([
            ...voiceSources(tts, !!builtinTts.data?.activeModelId),
            ...(voiceValue && !primary ? [tts.source] : []),
          ]),
        ];
    const set = (currentId: string | null, id: string | null) => {
      const current = currentId ? { id: currentId } : null;
      if (isAgents) return setAgentsDefault(current, id);
      if (isMain) return setMainDefault(current, id);
      if (!isVoice) return setRole(role.flag, current, id);
      const source = id?.startsWith(DEVICE_VOICE) ? (id.slice(DEVICE_VOICE.length) as TTSSource) : undefined;
      // A built-in source only speaks while no Audio connection is the default; off keeps the row for effects.
      if (source) setRole(role.flag, rows.find((row) => isConnectionFlagTrue(row[role.flag])) ?? null, null);
      else if (id) setRole(role.flag, current, id);
      // Resolves true once the Voice job is saved, so a caller can wait before saying so.
      return followVoiceJob(source ? null : id, source).then(
        () => true,
        () => {
          toast.error(t("connections.defaults.saveFailed"));
          return false;
        },
      );
    };
    return {
      kind: role.kind,
      value:
        (isAgents && sidecarAsAgentsDefault) || (isMain && mainIsBuiltIn)
          ? LOCAL_SIDECAR_CONNECTION_ID
          : isVoice
            ? voiceValue
            : (primary?.id ?? null),
      /** Moves the job from a known row; Undo passes the row it set, as `primary` is stale then. */
      set,
      onChange: (id: string | null) => set(primary?.id ?? null, id),
      fallback: {
        value: fallbackRow?.id ?? null,
        onChange: (id: string | null) => setRole(role.fallback, fallbackRow, id),
      },
      defaultLabel: isAgents
        ? t("connections.defaults.followsMain")
        : isVoice
          ? t("connections.defaults.voiceOffChoice")
          : t("connections.defaults.none"),
      extraOptions: isVoice
        ? sources.map((source) => ({
            value: `${DEVICE_VOICE}${source}`,
            label: t("connections.defaults.onThisDevice", { name: t(`connections.device.ttsSource.${source}`) }),
          }))
        : [],
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
      <ToggleSetting label={t("connections.defaults.paidWarning")} checked={showPaid} onChange={setShowPaid} />
      <button
        type="button"
        onClick={() => void reset()}
        disabled={resetting || toReset.length === 0}
        className={cn(SMALL_ACTION, "w-fit")}
      >
        {resetting ? <Spinner size="sm" /> : t("connections.defaults.resetAgents")}
      </button>
    </div>
  );
}

const ConnectionEditor = lazy(() =>
  import("./ConnectionEditor").then((module) => ({ default: module.ConnectionEditor })),
);

/** Chat Models whose own row overrides the Embeddings or Image reading job. */
function overridesOf(key: JobKey, rows: readonly ConnectionRowData[]) {
  if (key === "embeddings")
    return rows.filter(
      (row) =>
        isChatProvider(row.provider) &&
        !!(row.embeddingModel?.trim() || row.embeddingBaseUrl?.trim() || row.embeddingConnectionId),
    );
  if (key === "vision")
    return rows.filter(
      (row) =>
        isChatProvider(row.provider) &&
        Object.keys(parseConnectionImageCaptioningDefaults(row.defaultParameters)).length > 0,
    );
  return [];
}

/** Jobs with behaviour of their own: a gear opens the job's settings window. */
const JOB_SETTINGS = new Set<JobKey>(["voice", "stt", "decision", "agents", "vision"]);

/** A titled box in the job settings window. */
function JobSettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{title}</h3>
      {children}
    </section>
  );
}

/** Dictation: the chat microphone switch, and with Calls installed the speech-to-text server. */
export function DictationSettings() {
  const { t } = useTranslation();
  const speechToTextEnabled = useUIStore((s) => s.speechToTextEnabled);
  const setSpeechToTextEnabled = useUIStore((s) => s.setSpeechToTextEnabled);
  const callsInstalled = useDeviceSetup().stt.available;
  return (
    <>
      <ToggleSetting
        label={t("settings.controls.speechToText.label")}
        checked={speechToTextEnabled}
        onChange={setSpeechToTextEnabled}
      />
      {/* ponytail: the speech-to-text server keeps its own address and key here; an account for it comes in S4. */}
      {callsInstalled && <SpeechToTextCard inDictation />}
      {/* The same Local Whisper card as the This device page, so Dictation can download its model here. */}
      {callsInstalled && import.meta.env.VITE_MARINARA_LITE !== "true" && <LocalWhisper />}
    </>
  );
}

/**
 * One job: its row opens the job's picker; a job with behaviour of its own has a gear for its settings window.
 * `chip` draws it as a compact chip (icon and name) that opens the same picker, page or set-up; its text says what
 * the job does ("Follows Main", "Off"), for the chip's name.
 */
function DefaultsJobRow({
  tile,
  job,
  modelFor,
  onOpenDevice,
  overrides = [],
  chip,
  onBusyChange,
}: {
  /** Models that keep a setting of this job on their own row, edited here */
  overrides?: readonly ConnectionRowData[];
  tile: DefaultsTile;
  job: Job;
  modelFor: ReturnType<typeof useJobModels>;
  onOpenDevice: (item: DeviceItem) => void;
  chip?: string;
  /** Told while the job's picker or settings window is open, so the Jobs page keeps it where it is. */
  onBusyChange?: (key: JobKey, busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const mayReadImages = useMayReadImages();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const busy = open || settingsOpen;
  useEffect(() => {
    if (!onBusyChange) return;
    onBusyChange(job.key as JobKey, busy);
    return () => onBusyChange(job.key as JobKey, false);
  }, [busy, job.key, onBusyChange]);
  const connectionSaving = useUIStore((s) => s.connectionSaving);
  const embeddings = job.key === "embeddings";
  const decision = job.key === "decision";
  const hasSettings = JOB_SETTINGS.has(job.key as JobKey) || overrides.length > 0;
  // A settings window that no longer applies (Embeddings' last override cleared) must not hold the job as busy.
  useEffect(() => {
    if (!hasSettings) setSettingsOpen(false);
  }, [hasSettings]);
  const model = embeddings || decision || job.device ? null : modelFor(job);
  const title = t(jobLabelKey(job));
  const onClick = () => {
    if (tile.device) return onOpenDevice(tile.device);
    if (tile.find?.count === 0 && !tile.find.unknown) return openAddConnection({ job: job.key as JobKey });
    if (tile.setup?.item) return openAddConnection({ category: "device", item: tile.setup.item });
    // Dictation has no Model to pick: its row opens its settings.
    if (job.device) return setSettingsOpen(true);
    setOpen(true);
  };
  // A chip that has just been given a Model of its own (the Jobs page keeps it in place while its window is open)
  // names that Model instead of its section's word.
  const chipModel = chip !== undefined && !tile.find && !tile.setup && !tile.follows && !!tile.source;
  const chipAction =
    chip === undefined
      ? null
      : tile.find
        ? t(tile.find.count || tile.find.unknown ? "connections.defaults.pick" : "connections.defaults.add")
        : tile.setup
          ? t("connections.defaults.setUp")
          : chipModel
            ? tile.value
            : null;
  const chevron = <ChevronRight size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />;
  const settingsButton = hasSettings && (
    <button
      type="button"
      onClick={() => setSettingsOpen(true)}
      aria-haspopup="dialog"
      aria-label={t("connections.defaults.settingsFor", { role: title })}
      // The panel's row-button look (quiet at rest, the shared accent hover), like the Connections rows.
      className={ROW_BUTTON}
    >
      <SlidersHorizontal size="0.875rem" aria-hidden />
    </button>
  );
  return (
    <div
      className={chip === undefined ? "relative" : "relative inline-flex max-w-full items-center"}
      data-defaults-role={job.key}
    >
      {chip === undefined ? (
        <JobRow
          // Pick or Add is the fix, so an empty job's own warning chip would only repeat it.
          tile={tile.find ? { ...tile, warning: null } : tile}
          data-defaults-tile={job.key}
          onClick={onClick}
          aria-haspopup={tile.device ? undefined : "dialog"}
          aria-label={t("connections.defaults.jobLabel", {
            role: tile.title,
            value: [tile.follows, tile.value].filter(Boolean).join(" · "),
          })}
          trailing={chevron}
          end={
            <>
              {tile.find && (
                <button
                  type="button"
                  onClick={onClick}
                  className="mari-chrome-control mari-chrome-control--primary shrink-0 !min-h-7 !px-3 !py-1 !text-xs"
                >
                  {t(tile.find.count || tile.find.unknown ? "connections.defaults.pick" : "connections.defaults.add")}
                </button>
              )}
              {settingsButton}
            </>
          }
        />
      ) : (
        <>
          <button
            type="button"
            data-defaults-tile={job.key}
            onClick={onClick}
            aria-haspopup={tile.device ? undefined : "dialog"}
            aria-label={t("connections.defaults.jobLabel", {
              role: tile.title,
              value: chipModel ? tile.value : [chip, chipAction].filter(Boolean).join(" · "),
            })}
            className={cn("mari-connection-chip min-w-0 gap-1.5", FOCUS)}
          >
            <span aria-hidden className="flex shrink-0">
              {tile.icon}
            </span>
            <span className="truncate">{tile.title}</span>
            {/* An empty job's chip says what a click does, as its row's Pick, Add or Set up did. */}
            {chipAction && <span className="shrink-0 text-[var(--muted-foreground)]">· {chipAction}</span>}
          </button>
          {settingsButton}
        </>
      )}
      {model && (
        <ConnectionSelect
          variant="controlled"
          open={open}
          onOpenChange={setOpen}
          job={title}
          jobKey={job.key as JobKey}
          showJobSettings={job.key === "vision"}
          rowFilter={job.key === "vision" ? mayReadImages : undefined}
          {...model}
        />
      )}
      {embeddings && <EmbeddingDefaultControl open={open} onOpenChange={setOpen} />}
      {decision && <DecisionDefaultControl open={open} onOpenChange={setOpen} />}
      {hasSettings && (
        <Modal
          open={settingsOpen}
          onClose={() => void closeIfClean(() => setSettingsOpen(false))}
          closeDisabled={connectionSaving}
          title={t("connections.defaults.settingsFor", { role: title })}
          width="max-w-xl"
        >
          <div className="flex flex-col gap-3">
            {!job.device && (
              <JobSettingsSection title={t("connections.jobSettings.model")}>
                <JobRow tile={tile} onClick={() => setOpen(true)} aria-haspopup="dialog" trailing={chevron} />
              </JobSettingsSection>
            )}
            {job.key === "voice" && <VoiceJobSettings />}
            {job.key === "stt" && <DictationSettings />}
            {decision && <DecisionDefaultControl settings />}
            {decision && tile.source?.provider === "decision" && (
              <Suspense fallback={null}>
                <ConnectionEditor connectionId={tile.source.id} part="decision" />
              </Suspense>
            )}
            {job.key === "vision" && (
              <JobSettingsSection title={t("connections.imageReading.title")}>
                <ImageReadingSettings />
              </JobSettingsSection>
            )}
            {overrides.length > 0 && (
              <JobSettingsSection title={t("connections.jobSettings.overrides")}>
                {overrides.map((row) => (
                  <div key={row.id} className="space-y-2">
                    <p className="text-xs font-medium">{row.name}</p>
                    <Suspense fallback={null}>
                      <ConnectionEditor
                        connectionId={row.id}
                        part={job.key === "vision" ? "captioning" : "embeddings"}
                      />
                    </Suspense>
                  </div>
                ))}
              </JobSettingsSection>
            )}
            {job.key === "agents" && <AgentsSettings />}
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Closes a job settings window, asking first when a model part inside holds unsaved edits. */
export async function closeIfClean(close: () => void) {
  if (
    useUIStore.getState().editorDirty &&
    !(await showConfirmDialog({
      title: i18n.t("ui.layout.chatsidebar.unsavedChanges"),
      message: i18n.t("ui.layout.chatsidebar.youHaveUnsavedChangesDiscardAndContinue"),
      confirmLabel: i18n.t("ui.agents.agenteditor.discard"),
      tone: "destructive",
    }))
  )
    return;
  close();
}

/** Voice settings in both "Voice settings" windows: the card, then the Voice job's own row. */
export function VoiceJobSettings() {
  const connectionsList = (useConnections().data ?? []) as ConnectionRowData[];
  const { data: tts } = useTTSConfig();
  const row = voiceRowOf(connectionsList, tts?.connectionId).row;
  return (
    <>
      <TTSConfigCard />
      {row?.provider === "audio" && (
        <Suspense fallback={null}>
          <ConnectionEditor connectionId={row.id} part="voice" />
        </Suspense>
      )}
    </>
  );
}

/** One job's "Model for" window on its own, for a "Set up" outside the Jobs box. Null for jobs without a row picker. */
export function JobPickerWindow({ job, onClose }: { job: Job; onClose: () => void }) {
  const { t } = useTranslation();
  const connectionsList = (useConnections().data ?? []) as ConnectionRowData[];
  const model = useJobModels(connectionsList)(job);
  if (job.key === "decision") return <DecisionDefaultControl open onOpenChange={(open) => !open && onClose()} />;
  if (!model) return null;
  return (
    <ConnectionSelect
      variant="controlled"
      open
      onOpenChange={(open) => !open && onClose()}
      job={t(jobLabelKey(job))}
      showJobSettings={job.key === "vision"}
      {...model}
    />
  );
}

/** The card shows this many problems; "+N more" opens the Jobs page for the rest. */
const PROBLEMS_SHOWN = 3;

/** The tiles, sorted for the card and the page (lib/connection-jobs-summary.ts). */
function useJobsSummary(connectionsList: ConnectionRowData[]) {
  const { t } = useTranslation();
  const tiles = useConnectionDefaults(connectionsList);
  return summarizeJobs(tiles, t("connections.defaults.followsAgents"));
}

/** One job's problem on the card: "Job: short warning", and its fix when it has one, in the row fix's look. */
function JobProblemLine({ tile }: { tile: DefaultsTile }) {
  const { t } = useTranslation();
  const textId = useId();
  const warning = tile.warning;
  if (!warning) return null;
  return (
    <li className="flex min-h-9 min-w-0 items-center gap-2 px-1.5 text-xs max-md:min-h-11">
      <AlertTriangle size="0.75rem" aria-hidden className="shrink-0 text-[var(--warning)]" />
      <span id={textId} title={warning.text} className="min-w-0 flex-1 truncate text-[var(--foreground)]">
        {t("connections.defaults.jobLabel", { role: tile.title, value: warning.short ?? warning.text })}
      </span>
      {warning.fix && (
        <button
          type="button"
          onClick={warning.fix.run}
          title={warning.text}
          aria-describedby={textId}
          className="group flex min-h-9 shrink-0 items-center rounded-md outline-none focus-visible:[&>span]:ring-1 focus-visible:[&>span]:ring-[var(--ring)] max-md:min-h-11"
        >
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-1.5 py-0.5 text-[0.625rem] text-[var(--warning)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--warning)_20%,transparent)]">
            <AlertTriangle size="0.625rem" aria-hidden className="shrink-0" />
            {warning.fix.label}
          </span>
        </button>
      )}
    </li>
  );
}

/** A quiet text button on the card, such as "All jobs". */
const CARD_LINK = cn(
  "inline-flex min-h-9 w-fit items-center gap-1 rounded-md px-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] max-md:min-h-11",
  FOCUS,
);

/**
 * The Jobs card at the top of the Connections panel: Main (one tap to change), one sentence on what the other jobs
 * follow, their problems, and the way to the Jobs page.
 */
export function ConnectionJobsSummary({
  connectionsList,
  onOpenJobs,
  onOpenDevice,
  current = false,
}: {
  connectionsList: ConnectionRowData[];
  onOpenJobs: () => void;
  onOpenDevice: (item: DeviceItem) => void;
  /** The Jobs page shows beside the list (a wide panel), so its row reads as the current one. */
  current?: boolean;
}) {
  const { t } = useTranslation();
  useMigrateVoiceJob();
  const summary = useJobsSummary(connectionsList);
  const modelFor = useJobModels(connectionsList);
  const titleId = useId();
  // Off jobs are not named: the sentence says what runs, and the Jobs page lists them.
  const sentence = summary.exceptions.length
    ? t("connections.jobs.followMainExcept", {
        jobs: new Intl.ListFormat(i18n.resolvedLanguage ?? i18n.language, { type: "conjunction" }).format(
          summary.exceptions.map((tile) => tile.title),
        ),
      })
    : t("connections.jobs.allFollowMain");
  const shown = summary.problems.slice(0, PROBLEMS_SHOWN);
  const more = summary.problems.length - shown.length;
  return (
    <section aria-labelledby={titleId} className="mari-connection-group mari-connection-defaults-box">
      <button
        type="button"
        data-connections-row="defaults"
        onClick={onOpenJobs}
        aria-current={current || undefined}
        aria-label={t("connections.jobs.openWithSummary", { summary: sentence })}
        className={cn(
          "relative flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-start",
          current && "bg-foreground/[0.06]",
          FOCUS,
        )}
      >
        <span id={titleId} className="min-w-0 flex-1 text-base font-semibold leading-6 text-[var(--foreground)]">
          {t("connections.defaults.title")}
        </span>
        <ChevronRight size="1rem" aria-hidden className="shrink-0 text-[var(--muted-foreground)]" />
      </button>
      <div className="flex flex-col gap-1 pt-0.5">
        {summary.main && (
          <div className="mari-connection-model-well">
            <div className="mari-connection-model-slot min-w-0">
              <DefaultsJobRow tile={summary.main} job={JOB.main} modelFor={modelFor} onOpenDevice={onOpenDevice} />
            </div>
          </div>
        )}
        <p className="px-1.5 pt-1 text-xs text-[var(--muted-foreground)]">{sentence}</p>
        {shown.length > 0 && (
          <ul aria-label={t("connections.jobs.problems", { count: summary.problems.length })} className="flex flex-col">
            {shown.map((tile) => (
              <JobProblemLine key={tile.key} tile={tile} />
            ))}
            {more > 0 && (
              <li>
                <button type="button" onClick={onOpenJobs} className={CARD_LINK}>
                  {t("connections.jobs.moreProblems", { count: more })}
                </button>
              </li>
            )}
          </ul>
        )}
        <button type="button" data-connections-jobs-open onClick={onOpenJobs} className={CARD_LINK}>
          {t("connections.jobs.all")}
          <ChevronRight size="0.875rem" aria-hidden className="shrink-0" />
        </button>
      </div>
    </section>
  );
}

/** One part of the Jobs page under its own small heading. */
function JobsPageSection({ title, part, children }: { title: string; part: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-jobs-section={part} className="flex min-w-0 flex-col">
      <h4 id={id} className="mari-connection-defaults-group">
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * The Jobs page (the Connections panel's "jobs" page): Main, the jobs with a Model of their own (and the ones with a
 * problem) as rows, then the jobs that follow Main or Agents, and the ones that are off, as chips. Every job shows
 * once; Main always shows, so the page is never empty.
 */
export function ConnectionJobsPage({
  connectionsList,
  onOpenDevice,
}: {
  connectionsList: ConnectionRowData[];
  onOpenDevice: (item: DeviceItem) => void;
}) {
  const { t } = useTranslation();
  const live = useJobsSummary(connectionsList);
  const modelFor = useJobModels(connectionsList);
  const titleId = useId();
  const rootRef = useRef<HTMLElement>(null);
  // A job that changes section (an Off chip that gets a Model becomes a row) remounts. While any job's picker or
  // settings window is open, every job keeps its place, so no window closes under the person using it; once they
  // are all closed the page sorts again and focus follows the job it was on.
  const [busy, setBusy] = useState<ReadonlySet<JobKey>>(() => new Set());
  // The job whose window was open last: closing a window can re-sort the page while focus is still in that
  // window (a portal outside the page), so focus then goes back to this job in its new place.
  const lastBusyRef = useRef<JobKey | null>(null);
  const onBusyChange = useCallback((key: JobKey, isBusy: boolean) => {
    if (isBusy) lastBusyRef.current = key;
    setBusy((keys) => {
      if (keys.has(key) === isBusy) return keys;
      const next = new Set(keys);
      if (isBusy) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const liveBuckets = useMemo(() => {
    const buckets = new Map<JobKey, JobBucket>();
    for (const bucket of ["own", "followsMain", "followsAgents", "off"] as const)
      for (const tile of live[bucket]) buckets.set(tile.key, bucket);
    return buckets;
  }, [live]);
  const [placed, setPlaced] = useState(liveBuckets);
  const refocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (busy.size > 0) return;
    // Used once: a later re-sort with nothing open never moves focus on its own.
    const closed = lastBusyRef.current;
    lastBusyRef.current = null;
    const same =
      placed.size === liveBuckets.size && [...liveBuckets].every(([key, bucket]) => placed.get(key) === bucket);
    if (same) return;
    const active = document.activeElement;
    refocusRef.current =
      active instanceof HTMLElement && rootRef.current?.contains(active)
        ? (active.closest("[data-defaults-role]")?.getAttribute("data-defaults-role") ?? null)
        : closed;
    setPlaced(liveBuckets);
  }, [busy, liveBuckets, placed]);
  useLayoutEffect(() => {
    const key = refocusRef.current;
    if (!key) return;
    refocusRef.current = null;
    rootRef.current?.querySelector<HTMLElement>(`[data-defaults-tile="${CSS.escape(key)}"]`)?.focus();
  }, [placed]);
  const sectionOf = (bucket: JobBucket) =>
    (["own", "followsMain", "followsAgents", "off"] as const)
      .flatMap((from) => live[from])
      .filter((tile) => (placed.get(tile.key) ?? liveBuckets.get(tile.key)) === bucket)
      .sort((a, b) => JOBS.findIndex((job) => job.key === a.key) - JOBS.findIndex((job) => job.key === b.key));
  const summary = {
    main: live.main,
    own: sectionOf("own"),
    followsMain: sectionOf("followsMain"),
    followsAgents: sectionOf("followsAgents"),
    off: sectionOf("off"),
  };
  const row = (tile: DefaultsTile) => (
    <div key={tile.key} className="mari-connection-model-slot min-w-0">
      <DefaultsJobRow
        tile={tile}
        job={JOB[tile.key]}
        modelFor={modelFor}
        onOpenDevice={onOpenDevice}
        overrides={overridesOf(tile.key, connectionsList)}
        onBusyChange={onBusyChange}
      />
    </div>
  );
  const chips = (tiles: DefaultsTile[], state: string) => (
    <div className="flex flex-wrap gap-1.5 px-1.5 pb-1">
      {tiles.map((tile) => (
        <DefaultsJobRow
          key={tile.key}
          tile={tile}
          job={JOB[tile.key]}
          modelFor={modelFor}
          onOpenDevice={onOpenDevice}
          overrides={overridesOf(tile.key, connectionsList)}
          chip={state}
          onBusyChange={onBusyChange}
        />
      ))}
    </div>
  );
  return (
    <section ref={rootRef} aria-labelledby={titleId} className="flex flex-col gap-2" data-connections-jobs-page>
      <h3 id={titleId} className="px-1.5 text-base font-semibold leading-tight text-[var(--foreground)]">
        {t("connections.defaults.title")}
      </h3>
      <div className="mari-connection-group flex flex-col gap-1">
        {summary.main && (
          <JobsPageSection title={t(jobLabelKey(JOB.main))} part="main">
            <div className="mari-connection-model-well">{row(summary.main)}</div>
          </JobsPageSection>
        )}
        {summary.own.length > 0 && (
          <JobsPageSection title={t("connections.jobs.section.own")} part="own">
            <div className="mari-connection-model-well">{summary.own.map(row)}</div>
          </JobsPageSection>
        )}
        {summary.followsMain.length > 0 && (
          <JobsPageSection title={t("connections.jobs.section.followMain")} part="follows-main">
            {chips(summary.followsMain, t("connections.defaults.followsMain"))}
          </JobsPageSection>
        )}
        {summary.followsAgents.length > 0 && (
          <JobsPageSection title={t("connections.jobs.section.followAgents")} part="follows-agents">
            {chips(summary.followsAgents, t("connections.defaults.followsAgents"))}
          </JobsPageSection>
        )}
        {summary.off.length > 0 && (
          <JobsPageSection title={t("connections.jobs.section.off")} part="off">
            {chips(summary.off, t("connections.defaults.off"))}
          </JobsPageSection>
        )}
      </div>
    </section>
  );
}
