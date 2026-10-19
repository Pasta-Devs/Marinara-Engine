// ──────────────────────────────────────────────
// ConnectionDefaults — the Defaults box at the top of the Connections panel: which Model or service each job uses.
// Main, Agents and Images always show as one line each (their Model, Connection and fallback) that unfolds its
// pickers in place; a job with a problem always shows, with its fix. The other jobs wait behind one "N more roles"
// line. The box folds, and the fold is remembered.
// Device jobs (Voice, Speech to text) open their engine's page, or the Add window when the engine is not set up.
// ──────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  AudioLines,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Database,
  Film,
  GraduationCap,
  ImageIcon,
  Loader2,
  MessageCircleQuestion,
  MessageSquareText,
  Mic,
  Sparkles,
  VenetianMask,
  Volume2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  isAgentConfigDeleted,
  isChatProvider,
  isRetiredBuiltInAgentId,
  type ConnectionAccountListItem,
  type FeatureModelConnections,
} from "@marinara-engine/shared";
import {
  useCachedCatalogFacts,
  useDefaultEmbeddingConnection,
  useUpdateConnection,
  type CachedCatalogFacts,
} from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useFeatureModels,
  useSetFeatureModels,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { useAgentConfigs, useUpdateAgent } from "../../hooks/use-agents";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import { useTTSConfig } from "../../hooks/use-tts";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { openAddConnection } from "../../lib/add-connection";
import { createLocalSidecarConnectionOption, isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { ConnectionSelect, type ConnectionSelectKind } from "./ConnectionSelect";
import { MARI_QUICK_CONNECTION } from "../../lib/omnibar-aside-text";
import { EmbeddingDefaultControl } from "./EmbeddingDefaultControl";
import { DecisionDefaultControl } from "./DecisionDefaultControl";
import { SMALL_ACTION } from "./DeviceDetail";
import { ProviderIcon } from "./ProviderIcon";
import { ModelRow, mediaService, type ConnectionRowData } from "./ConnectionRow";

type RoleField = "isDefault" | "defaultForAgents" | "fallbackForMain" | "fallbackForAgents";
type FlagRoleKey = "main" | "agents" | "images" | "video" | "audio";
type TileKey = FlagRoleKey | "decision" | "voice" | "stt" | "embeddings" | keyof FeatureModelConnections;

const FLAG_ROLES: Array<{
  key: FlagRoleKey;
  icon: ReactNode;
  kind: ConnectionSelectKind;
  primary: RoleField;
  fallback: RoleField;
}> = [
  {
    key: "main",
    icon: <MessageSquareText size="0.6875rem" />,
    kind: "chat",
    primary: "isDefault",
    fallback: "fallbackForMain",
  },
  {
    key: "agents",
    icon: <Sparkles size="0.6875rem" />,
    kind: "chat",
    primary: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  {
    key: "images",
    icon: <ImageIcon size="0.6875rem" />,
    kind: "image",
    primary: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  {
    key: "video",
    icon: <Film size="0.6875rem" />,
    kind: "video",
    primary: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  {
    key: "audio",
    icon: <AudioLines size="0.6875rem" />,
    kind: "audio",
    primary: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
];

const KIND_PROVIDER: Record<Exclude<ConnectionSelectKind, "chat" | "all">, string> = {
  image: "image_generation",
  video: "video_generation",
  audio: "audio",
  decision: "decision",
};
const matchesKind = (row: ConnectionRowData, kind: ConnectionSelectKind) =>
  kind === "all" || (kind === "chat" ? isChatProvider(row.provider) : row.provider === KIND_PROVIDER[kind]);

const FEATURE_KEYS: Array<keyof FeatureModelConnections> = [
  "mariConnectionId",
  "omnibarAsideConnectionId",
  "impersonateConnectionId",
];
/** Feature values that are not a Model: quick answers can follow Professor Mari, Impersonate can shuffle. */
const FEATURE_EXTRA_OPTIONS: Partial<Record<keyof FeatureModelConnections, Array<{ value: string; key: string }>>> = {
  omnibarAsideConnectionId: [{ value: MARI_QUICK_CONNECTION, key: "connections.defaults.featureOption.sameAsMari" }],
  impersonateConnectionId: [{ value: "random", key: "connections.defaults.featureOption.random" }],
};

const FEATURE_ICONS: Record<keyof FeatureModelConnections, ReactNode> = {
  mariConnectionId: <GraduationCap size="0.6875rem" />,
  omnibarAsideConnectionId: <MessageCircleQuestion size="0.6875rem" />,
  impersonateConnectionId: <VenetianMask size="0.6875rem" />,
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

type Warning = { text: string; fix?: { label: string; run: () => void } };

export type DefaultsTile = {
  key: TileKey;
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
  const featureModels = useFeatureModels();

  const accountById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const sidecarName = createLocalSidecarConnectionOption(sidecarModelDisplayName).name;

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

  const primaryOf = (role: (typeof FLAG_ROLES)[number]) =>
    connectionsList.find((row) => matchesKind(row, role.kind) && isConnectionFlagTrue(row[role.primary])) ?? null;
  const mainRow = primaryOf(FLAG_ROLES.find((role) => role.key === "main")!);
  const agentsRow = primaryOf(FLAG_ROLES.find((role) => role.key === "agents")!);
  /** An unset job shows the model that really runs, and the job it comes from. */
  const inherited = (row: ConnectionRowData | null, from: FlagRoleKey) =>
    row
      ? {
          value: t("connections.defaults.fromRole", {
            model: describe(row).value,
            role: t(`connections.defaults.role.${from}`),
          }),
          source: row,
          muted: true,
        }
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

  const tiles: DefaultsTile[] = FLAG_ROLES.map((role) => {
    const primary = primaryOf(role);
    const fallbackRow =
      connectionsList.find((row) => matchesKind(row, role.kind) && isConnectionFlagTrue(row[role.fallback])) ?? null;
    const isAgents = role.key === "agents";
    const tile = {
      key: role.key,
      icon: role.icon,
      title: t(`connections.defaults.role.${role.key}`),
      fallback: fallbackRow ? describe(fallbackRow).value : undefined,
      warning: null,
    };
    if (isAgents && sidecarAsAgentsDefault) return { ...tile, value: sidecarName };
    if (primary) {
      return { ...tile, ...describe(primary), warning: blockedWarning(primary, tile.title, fallbackRow) };
    }
    // Agents follow the chat's model; a new chat uses Main.
    if (isAgents)
      return {
        ...tile,
        ...(inherited(mainRow, "main") ?? { value: t("connections.defaults.agentsFollowChat"), muted: true }),
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
    key: "embeddings",
    icon: <Database size="0.6875rem" />,
    title: t("connections.defaults.role.embeddings"),
    value: t("connections.defaults.notSet"),
    muted: true,
    warning: null,
  };
  if (embeddingId === LOCAL_SIDECAR_CONNECTION_ID) Object.assign(embeddings, { value: sidecarName, muted: false });
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
    key: "decision",
    icon: <BrainCircuit size="0.6875rem" />,
    title: t("connections.defaults.role.decision"),
    value: decisionSelected?.label ?? t("connections.defaults.notSet"),
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

  // Voice and Speech to text choose a service; the engine row manages the engine.
  const voice: DefaultsTile = {
    key: "voice",
    icon: <Volume2 size="0.6875rem" />,
    title: t("connections.defaults.role.voice"),
    warning: null,
    ...(deviceSetup.tts.setUp && tts
      ? {
          value: t(`connections.device.ttsSource.${tts.source}`),
          hint: t("connections.add.device.tts"),
          device: "tts" as const,
        }
      : {
          value: t("connections.accounts.state.off"),
          muted: true,
          setup: { item: "tts" as const, text: t("connections.defaults.notSetUp") },
        }),
  };
  const stt: DefaultsTile | null = deviceSetup.stt.available
    ? {
        key: "stt",
        icon: <Mic size="0.6875rem" />,
        title: t("connections.defaults.role.stt"),
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
  const features: DefaultsTile[] = FEATURE_KEYS.map((key) => {
    const value = featureModels.data?.[key] ?? null;
    const extra = FEATURE_EXTRA_OPTIONS[key]?.find((option) => option.value === value);
    const row = value ? connectionsList.find((entry) => entry.id === value) : undefined;
    const tile = { key, icon: FEATURE_ICONS[key], title: t(`connections.defaults.feature.${key}`), warning: null };
    if (!value) {
      // What the server runs when unset: Quick answers use the built-in model; Prof. Mari the agents default, then
      // Main; Impersonate the chat's model, which is Main in a new chat.
      if (key === "omnibarAsideConnectionId") return { ...tile, value: sidecarName, muted: true };
      const from =
        key === "mariConnectionId"
          ? sidecarAsAgentsDefault
            ? {
                value: t("connections.defaults.fromRole", {
                  model: sidecarName,
                  role: t("connections.defaults.role.agents"),
                }),
                muted: true,
              }
            : (inherited(agentsRow, "agents") ?? inherited(mainRow, "main"))
          : inherited(mainRow, "main");
      return { ...tile, ...(from ?? { value: t(`connections.defaults.featureDefault.${key}`), muted: true }) };
    }
    if (extra) return { ...tile, value: t(extra.key) };
    if (value === LOCAL_SIDECAR_CONNECTION_ID) return { ...tile, value: sidecarName };
    // A blocked model names who answers instead, as the server falls back: Prof. Mari and Quick answers use the
    // agents default, then Main; Impersonate uses the chat's model, which is Main in a new chat.
    if (row)
      return {
        ...tile,
        ...describe(row),
        warning: blockedWarning(
          row,
          tile.title,
          key === "impersonateConnectionId" ? mainRow : usable(agentsRow) ? agentsRow : mainRow,
        ),
      };
    return {
      ...tile,
      value: t("connections.defaults.missing"),
      warning: { text: t("connections.defaults.warning.missing") },
    };
  });

  const all = [...tiles, embeddings, decision, voice, ...(stt ? [stt] : [])];
  return { tiles: all, features, problems: all.filter((tile) => tile.warning) };
}

type Job = {
  tile: DefaultsTile;
  /** Pickers that unfold under the line. */
  controls?: ReactNode;
  /** A device job opens a page instead. */
  onOpen?: () => void;
};

/** Main, Agents and Images always show; the other jobs wait behind "N more roles" unless they have a problem. */
const PRIMARY_KEYS = new Set<TileKey>(["main", "agents", "images"]);

/** One job as one line: its name, its Model with the Connection and fallback under it, then its problem and fix. */
function JobRow({
  job,
  open,
  onToggle,
  catalog,
  about,
}: {
  job: Job;
  open: boolean;
  onToggle: () => void;
  catalog?: CachedCatalogFacts;
  /** The rarer jobs say in one plain line what they do. */
  about?: boolean;
}) {
  const { t } = useTranslation();
  const { tile } = job;
  const controlsId = `connections-defaults-${tile.key}`;
  const sub = [
    tile.setup?.text ?? tile.hint,
    tile.fallback && t("connections.defaults.thenFallback", { model: tile.fallback }),
  ]
    .filter(Boolean)
    .join(" · ");
  const facts = catalog?.of(tile.source?.model);
  return (
    <section data-defaults-role={tile.key} aria-label={tile.title}>
      {/* The shared model row, with the job's name leading it. */}
      <ModelRow
        rowProps={{
          className: cn("mari-connection-defaults-job pe-0", open && "mari-connection-defaults-job--open"),
        }}
        data-defaults-tile={tile.key}
        onClick={job.onOpen ?? onToggle}
        aria-expanded={job.onOpen ? undefined : open}
        aria-controls={job.onOpen || !open ? undefined : controlsId}
        aria-label={t("connections.defaults.jobLabel", { role: tile.title, value: tile.value })}
        className={cn(
          "min-h-12 gap-2 py-1.5 pe-2 ps-2",
          tile.muted && "[&_[data-model-title]]:font-normal [&_[data-model-title]]:italic",
        )}
        lead={
          <span className="mari-connection-defaults-role w-14 shrink-0 break-words text-xs font-semibold leading-4">
            {tile.title}
          </span>
        }
        tile={
          tile.source ? (
            <ProviderIcon
              size="row"
              provider={tile.source.provider}
              baseUrl={tile.source.baseUrl}
              service={mediaService(tile.source)}
              model={tile.source.model}
              name={tile.hint ?? tile.source.name}
              icon={tile.source.icon}
              imagePath={tile.source.imagePath}
            />
          ) : (
            <span
              aria-hidden
              data-defaults-empty-tile={tile.muted || undefined}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                tile.muted
                  ? "border border-dashed border-foreground/25 text-[var(--muted-foreground)]"
                  : "mari-panel-gradient--connections bg-[var(--mari-connection-tint)] text-[var(--mari-connection-ink)]",
              )}
            >
              {tile.icon}
            </span>
          )
        }
        title={tile.value}
        subtitle={sub}
        dim={tile.muted}
        cost={facts?.cost}
        showPaid={catalog?.showPaid}
        retiring={facts}
        trailing={
          <>
            {tile.warning && <AlertTriangle size="0.75rem" aria-hidden className="shrink-0 text-amber-500" />}
            {job.onOpen ? (
              tile.setup ? (
                <span className="mari-panel-gradient--connections shrink-0 text-xs font-semibold text-[var(--mari-connection-ink)]">
                  {t("connections.defaults.setUpLink")}
                </span>
              ) : (
                <ChevronRight size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
              )
            ) : (
              <ChevronDown
                size="0.875rem"
                className={cn(
                  "shrink-0 text-[var(--muted-foreground)] transition-transform motion-reduce:transition-none",
                  open && "rotate-180",
                )}
              />
            )}
          </>
        }
      />
      {about && (
        <p className="mb-1 ml-16 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
          {t(`connections.defaults.about.${tile.key}`)}
        </p>
      )}
      {tile.warning && (
        <div role="status" className="mari-connection-defaults-problem">
          <span className="min-w-0 flex-1 break-words">{tile.warning.text}</span>
          {tile.warning.fix && (
            <button type="button" onClick={tile.warning.fix.run} className={cn(SMALL_ACTION, "shrink-0")}>
              {tile.warning.fix.label}
            </button>
          )}
        </div>
      )}
      {open && job.controls && (
        <div id={controlsId} className="mb-2 ml-16 mt-0.5 flex flex-col gap-0.5">
          {job.controls}
        </div>
      )}
    </section>
  );
}

/** Persisted with the Connection folds; no Connection id is "defaults". */
export const DEFAULTS_FOLD_ID = "defaults";

export function ConnectionDefaultsBox({
  connectionsList,
  onOpenDevice,
}: {
  connectionsList: ConnectionRowData[];
  onOpenDevice: (item: DeviceItem) => void;
}) {
  const { t } = useTranslation();
  const { tiles, features: featureTiles, problems } = useConnectionDefaults(connectionsList);
  const folded = useUIStore((s) => s.connectionsCollapsed.includes(DEFAULTS_FOLD_ID));
  const toggleFold = useUIStore((s) => s.toggleConnectionCollapsed);
  const updateConnection = useUpdateConnection();
  const showPaidAgentConnectionWarning = useUIStore((s) => s.showPaidAgentConnectionWarning);
  const setShowPaidAgentConnectionWarning = useUIStore((s) => s.setShowPaidAgentConnectionWarning);
  const sidecarModelDownloaded = useSidecarStore((s) => s.modelDownloaded);
  const sidecarAsAgentsDefault = useSidecarStore((s) => s.config.useAsAgentsDefault);
  const updateSidecarConfig = useSidecarStore((s) => s.updateConfig);
  const featureModels = useFeatureModels();
  const setFeatureModels = useSetFeatureModels();
  const { data: agentConfigs } = useAgentConfigs();
  const updateAgent = useUpdateAgent();
  const [resettingAgents, setResettingAgents] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openInUnused, setOpenInUnused] = useState(false);
  const [showUnused, setShowUnused] = useState(false);

  const lite = import.meta.env.VITE_MARINARA_LITE === "true";
  // Keep the option visible while the flag is set, so a stale sidecar default can be cleared here.
  const offerLocalSidecar = !lite && (sidecarModelDownloaded || sidecarAsAgentsDefault);

  const setRole = (field: RoleField, current: ConnectionRowData | null, nextId: string | null) => {
    if (nextId === (current?.id ?? null)) return;
    if (!nextId) {
      if (current) updateConnection.mutate({ id: current.id, [field]: false });
      return;
    }
    updateConnection.mutate({ id: nextId, [field]: true });
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

  const agentsToReset = useMemo(
    () =>
      (agentConfigs ?? []).filter(
        (config) =>
          config.connectionId != null &&
          !isRetiredBuiltInAgentId(config.type) &&
          !isAgentConfigDeleted(config.settings),
      ),
    [agentConfigs],
  );
  const resetAgents = async () => {
    if (resettingAgents || agentsToReset.length === 0) return;
    const confirmed = await showConfirmDialog({
      title: t("connections.defaults.resetAgents"),
      message: t("connections.defaults.resetAgentsConfirm", { count: agentsToReset.length }),
    });
    if (!confirmed) return;
    setResettingAgents(true);
    try {
      const results = await Promise.allSettled(
        agentsToReset.map((config) => updateAgent.mutateAsync({ id: config.id, connectionId: null })),
      );
      const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (rejected) throw rejected.reason;
      toast.success(t("connections.defaults.resetAgentsDone", { count: agentsToReset.length }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("connections.defaults.resetAgentsFailed"));
    } finally {
      setResettingAgents(false);
    }
  };

  const roleControls = (key: FlagRoleKey) => {
    const role = FLAG_ROLES.find((entry) => entry.key === key)!;
    const rows = connectionsList.filter((row) => matchesKind(row, role.kind));
    const primary = rows.find((row) => isConnectionFlagTrue(row[role.primary])) ?? null;
    const fallback = rows.find((row) => isConnectionFlagTrue(row[role.fallback])) ?? null;
    const title = t(`connections.defaults.role.${key}`);
    const isAgents = key === "agents";
    return (
      <>
        <ConnectionSelect
          variant="menu"
          label={t("connections.defaults.default")}
          kind={role.kind}
          value={isAgents && sidecarAsAgentsDefault ? LOCAL_SIDECAR_CONNECTION_ID : (primary?.id ?? null)}
          onChange={(id) => (isAgents ? setAgentsDefault(primary, id) : setRole(role.primary, primary, id))}
          defaultLabel={isAgents ? t("connections.defaults.agentsFollowChat") : t("connections.defaults.none")}
          includeLocalSidecar={isAgents && offerLocalSidecar}
          aria-label={t("connections.defaults.defaultFor", { role: title })}
        />
        <ConnectionSelect
          variant="menu"
          label={t("connections.defaults.fallback")}
          kind={role.kind}
          value={fallback?.id ?? null}
          onChange={(id) => setRole(role.fallback, fallback, id)}
          defaultLabel={t("connections.defaults.none")}
          aria-label={t("connections.defaults.fallbackFor", { role: title })}
        />
        {isAgents && (
          <>
            <ToggleSetting
              label={t("connections.defaults.paidWarning")}
              checked={showPaidAgentConnectionWarning}
              onChange={setShowPaidAgentConnectionWarning}
              help={t("connections.defaults.paidWarningHelp")}
            />
            <button
              type="button"
              onClick={() => void resetAgents()}
              disabled={resettingAgents || agentsToReset.length === 0}
              className={cn(SMALL_ACTION, "w-fit")}
              title={t("connections.defaults.resetAgentsHelp")}
            >
              {resettingAgents ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                t("connections.defaults.resetAgents")
              )}
            </button>
          </>
        )}
      </>
    );
  };

  const features = featureModels.data;
  const jobs: Job[] = [
    ...tiles.map((tile) =>
      tile.device || (tile.setup && tile.key !== "decision")
        ? {
            tile,
            onOpen: () =>
              tile.device
                ? onOpenDevice(tile.device)
                : openAddConnection({ category: "device", item: tile.setup!.item }),
          }
        : {
            tile,
            controls:
              tile.key === "embeddings" ? (
                <EmbeddingDefaultControl connections={connectionsList.filter((row) => isChatProvider(row.provider))} />
              ) : tile.key === "decision" ? (
                <DecisionDefaultControl />
              ) : (
                roleControls(tile.key as FlagRoleKey)
              ),
          },
    ),
    ...featureTiles.map((tile) => {
      const key = tile.key as keyof FeatureModelConnections;
      return {
        tile,
        controls: (
          <ConnectionSelect
            variant="menu"
            label={t("connections.defaults.default")}
            value={features?.[key] ?? null}
            onChange={(value) => setFeatureModels.mutate({ [key]: value })}
            defaultLabel={t(`connections.defaults.featureDefault.${key}`)}
            extraOptions={FEATURE_EXTRA_OPTIONS[key]?.map((extra) => ({
              value: extra.value,
              label: t(extra.key),
            }))}
            includeLocalSidecar={!lite}
            className={cn(!features && "opacity-60")}
            aria-label={t(`connections.defaults.feature.${key}`)}
          />
        ),
      };
    }),
  ];
  // Cost badges from the catalogs already cached for each chosen Model's Connection; nothing is fetched.
  const catalogs = useCachedCatalogFacts(
    jobs.map(({ tile }) =>
      !tile.source
        ? []
        : tile.source.accountId
          ? connectionsList.filter((row) => row.accountId === tile.source!.accountId).map((row) => row.id)
          : [tile.source.id],
    ),
  );
  // Hold an open row in its original group while a picker changes its configuration. Moving it between
  // groups would remount the control and lose keyboard focus before the picker has finished closing.
  const isShown = ({ tile }: Job) =>
    tile.key === openKey ? !openInUnused : PRIMARY_KEYS.has(tile.key) || !!tile.warning;
  const unused = jobs.filter((job) => !isShown(job));
  const unusedNames = unused
    .slice(0, 2)
    .map((job) => job.tile.title)
    .join(", ");
  const renderJob = (job: Job) => (
    <JobRow
      key={job.tile.key}
      job={job}
      catalog={catalogs[jobs.indexOf(job)]}
      about={!isShown(job)}
      open={openKey === job.tile.key}
      onToggle={() => {
        if (openKey === job.tile.key) {
          setOpenKey(null);
          requestAnimationFrame(() => {
            const target =
              document.querySelector<HTMLButtonElement>(`[data-defaults-tile="${job.tile.key}"]`) ??
              document.querySelector<HTMLButtonElement>("[data-defaults-unused]");
            target?.focus();
          });
        } else {
          setOpenInUnused(!isShown(job));
          setOpenKey(job.tile.key);
        }
      }}
    />
  );

  const slot = (job: Job) => (
    <div key={job.tile.key} className="mari-connection-model-slot min-w-0">
      {renderJob(job)}
    </div>
  );

  return (
    <section
      aria-labelledby="connections-defaults-title"
      className="mari-connection-group mari-connection-defaults-box"
    >
      <button
        type="button"
        data-connections-row="defaults"
        onClick={() => toggleFold(DEFAULTS_FOLD_ID)}
        aria-expanded={!folded}
        aria-controls={folded ? undefined : "connections-defaults"}
        className={cn("flex min-h-11 w-full min-w-0 items-start gap-2 rounded-xl px-1.5 py-1 text-left", FOCUS)}
      >
        <span className="min-w-0 flex-1">
          <span
            id="connections-defaults-title"
            className="block text-base font-semibold leading-6 text-[var(--foreground)]"
          >
            {t("connections.defaults.title")}
          </span>
          <span className="block text-xs text-[var(--muted-foreground)]">{t("connections.defaults.help")}</span>
          {folded && problems.length > 0 && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-500">
              <AlertTriangle size="0.6875rem" aria-hidden />
              {t("connections.list.problems", { count: problems.length })}
            </span>
          )}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted-foreground)]">
          <ChevronDown
            size="1rem"
            className={cn("transition-transform motion-reduce:transition-none", folded && "-rotate-90")}
          />
        </span>
      </button>
      {!folded && (
        <div id="connections-defaults" className="flex flex-col gap-1 pt-0.5">
          {/* The same neutral well as a connection's models. */}
          <div className="mari-connection-model-well">{jobs.filter(isShown).map(slot)}</div>
          {unused.length > 0 && (
            <>
              <button
                type="button"
                data-defaults-unused
                onClick={() => {
                  if (showUnused && openInUnused) setOpenKey(null);
                  setShowUnused((shown) => !shown);
                }}
                aria-expanded={showUnused}
                className={cn(
                  "mari-connection-defaults-more flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-xl px-2 text-left text-xs",
                  FOCUS,
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {unused.length > 2
                    ? t("connections.defaults.moreRoles", { names: unusedNames, count: unused.length - 2 })
                    : unusedNames}
                </span>
                <ChevronDown
                  size="0.875rem"
                  className={cn(
                    "shrink-0 transition-transform motion-reduce:transition-none",
                    showUnused && "rotate-180",
                  )}
                />
              </button>
              {showUnused && <div className="mari-connection-model-well">{unused.map(slot)}</div>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
