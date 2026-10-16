// ──────────────────────────────────────────────
// ConnectionDefaults — "Who does what" (variant D): which Model or service each job uses, as one vertical list.
// Every job is a section with its pickers in view (the way staging's Defaults card reads); a problem shows inside
// its section with its fix. The panel list shows the summary row (Main and the problem count).
// Device jobs (Voice, Speech to text) open their engine's page, or the Add window when the engine is not set up.
// ──────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  AudioLines,
  BrainCircuit,
  ChevronRight,
  Database,
  Film,
  GraduationCap,
  ImageIcon,
  Loader2,
  MessageCircleQuestion,
  MessageSquareText,
  Mic,
  Settings2,
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
import { useDefaultEmbeddingConnection, useUpdateConnection } from "../../hooks/use-connections";
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
import { DETAIL_CARD_CLASS, DetailHero, SMALL_ACTION } from "./DeviceDetail";
import type { ConnectionRowData } from "./ConnectionRow";

type RoleField = "isDefault" | "defaultForAgents" | "fallbackForMain" | "fallbackForAgents";
type FlagRoleKey = "main" | "agents" | "images" | "video" | "audio";
type TileKey = FlagRoleKey | "decision" | "voice" | "stt" | "embeddings";

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

const KIND_PROVIDER: Record<Exclude<ConnectionSelectKind, "chat">, string> = {
  image: "image_generation",
  video: "video_generation",
  audio: "audio",
  decision: "decision",
};
const matchesKind = (row: ConnectionRowData, kind: ConnectionSelectKind) =>
  kind === "chat" ? isChatProvider(row.provider) : row.provider === KIND_PROVIDER[kind];

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
  mariConnectionId: <GraduationCap size="0.875rem" />,
  omnibarAsideConnectionId: <MessageCircleQuestion size="0.875rem" />,
  impersonateConnectionId: <VenetianMask size="0.875rem" />,
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
  /** An unset job reads quieter than a chosen one. */
  muted?: boolean;
  warning: Warning | null;
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

  const accountById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const sidecarName = createLocalSidecarConnectionOption(sidecarModelDisplayName).name;

  /** The name the user gave the Model, with its Connection as the muted second line. */
  const describe = (row: ConnectionRowData) => {
    const account = row.accountId ? accountById.get(row.accountId) : undefined;
    return { value: row.name?.trim() || row.model?.trim() || row.id, hint: account?.name };
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

  const tiles: DefaultsTile[] = FLAG_ROLES.map((role) => {
    const primary =
      connectionsList.find((row) => matchesKind(row, role.kind) && isConnectionFlagTrue(row[role.primary])) ?? null;
    const isAgents = role.key === "agents";
    const tile = { key: role.key, icon: role.icon, title: t(`connections.defaults.role.${role.key}`), warning: null };
    if (isAgents && sidecarAsAgentsDefault) return { ...tile, value: sidecarName };
    if (primary) {
      return {
        ...tile,
        ...describe(primary),
        warning: accountWarning(primary.accountId ? accountById.get(primary.accountId) : undefined),
      };
    }
    if (isAgents) return { ...tile, value: t("connections.defaults.agentsFollowChat"), muted: true };
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

  const all = [...tiles, embeddings, decision, voice, ...(stt ? [stt] : [])];
  const main = tiles[0]!;
  return {
    tiles: all,
    mainLabel: main.muted ? t("connections.defaults.notSet") : main.value,
    problems: all.filter((tile) => tile.warning),
  };
}

/** One job: its icon and name, its problem with the fix, then its pickers. */
function RoleSection({
  role,
  icon,
  title,
  warning,
  children,
}: {
  role: string;
  icon: ReactNode;
  title: string;
  warning?: Warning | null;
  children: ReactNode;
}) {
  return (
    <section data-defaults-role={role} aria-label={title} className="px-3 py-2.5">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
        <span
          aria-hidden
          className="mari-panel-gradient-surface mari-panel-gradient--connections flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </h3>
      {warning && (
        <div
          role="status"
          className="mt-1.5 flex items-center gap-2 rounded-lg bg-[var(--marinara-app-accent-static)]/10 px-2.5 py-1.5 text-[0.6875rem] text-[var(--marinara-app-accent-static)]"
        >
          <AlertTriangle size="0.75rem" className="shrink-0" />
          <span className="min-w-0 flex-1 break-words">{warning.text}</span>
          {warning.fix && (
            <button type="button" onClick={warning.fix.run} className={cn(SMALL_ACTION, "shrink-0")}>
              {warning.fix.label}
            </button>
          )}
        </div>
      )}
      <div className="mt-1 flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

/** A device job: its service, and a way to its engine's page, or to the Add window while it is not set up. */
function DeviceJobRow({ tile, onClick }: { tile: DefaultsTile; onClick: () => void }) {
  const { t } = useTranslation();
  const note = tile.setup?.text ?? tile.hint;
  return (
    <button
      type="button"
      onClick={onClick}
      data-defaults-tile={tile.key}
      aria-label={t("connections.defaults.jobLabel", { role: tile.title, value: tile.value })}
      className={cn(
        "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-[var(--sidebar-accent)]/40 md:min-h-9",
        FOCUS,
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block break-words",
            tile.muted ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]",
          )}
        >
          {tile.value}
        </span>
        {note && <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">{note}</span>}
      </span>
      {tile.setup ? (
        <span className="shrink-0 font-semibold text-[var(--primary)]">{t("connections.defaults.setUpLink")}</span>
      ) : (
        <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
      )}
    </button>
  );
}

export function ConnectionDefaultsDetail({
  connectionsList,
  onOpenDevice,
}: {
  connectionsList: ConnectionRowData[];
  onOpenDevice: (item: DeviceItem) => void;
}) {
  const { t } = useTranslation();
  const { tiles } = useConnectionDefaults(connectionsList);
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

  return (
    <div className="flex flex-col gap-3">
      <DetailHero
        icon={
          <span className="mari-panel-gradient-surface mari-panel-gradient--connections flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <Settings2 size="1.25rem" />
          </span>
        }
        title={t("connections.defaults.whoDoesWhat")}
      >
        <span>{t("connections.defaults.whoDoesWhatHelp")}</span>
      </DetailHero>
      <div className={cn(DETAIL_CARD_CLASS, "divide-y divide-[var(--border)]/50 p-0")}>
        {tiles.map((tile) => (
          <RoleSection key={tile.key} role={tile.key} icon={tile.icon} title={tile.title} warning={tile.warning}>
            {tile.device || (tile.setup && tile.key !== "decision") ? (
              <DeviceJobRow
                tile={tile}
                onClick={() =>
                  tile.device
                    ? onOpenDevice(tile.device)
                    : openAddConnection({ category: "device", item: tile.setup!.item })
                }
              />
            ) : tile.key === "embeddings" ? (
              <EmbeddingDefaultControl connections={connectionsList.filter((row) => isChatProvider(row.provider))} />
            ) : tile.key === "decision" ? (
              <DecisionDefaultControl />
            ) : (
              roleControls(tile.key as FlagRoleKey)
            )}
          </RoleSection>
        ))}
        <RoleSection
          role="features"
          icon={<Sparkles size="0.6875rem" />}
          title={t("connections.defaults.featuresTitle")}
        >
          {FEATURE_KEYS.map((key) => (
            <ConnectionSelect
              key={key}
              variant="menu"
              label={
                <>
                  <span className="text-[var(--muted-foreground)]">{FEATURE_ICONS[key]}</span>
                  <span className="font-medium">{t(`connections.defaults.feature.${key}`)}</span>
                </>
              }
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
          ))}
        </RoleSection>
      </div>
    </div>
  );
}
