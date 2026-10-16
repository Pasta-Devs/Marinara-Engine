// ──────────────────────────────────────────────
// ConnectionDefaultsCard — which Model each job uses, one line per role
// ──────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Database,
  Film,
  GraduationCap,
  ImageIcon,
  Loader2,
  MessageCircleQuestion,
  MessageSquareText,
  Music,
  Settings2,
  Sparkles,
  VenetianMask,
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
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { createLocalSidecarConnectionOption, isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { ConnectionSelect, type ConnectionSelectKind } from "./ConnectionSelect";
import { MARI_QUICK_CONNECTION } from "../../lib/omnibar-aside-text";
import { EmbeddingDefaultControl } from "./EmbeddingDefaultControl";
import { DecisionDefaultControl } from "./DecisionDefaultControl";
import { CONNECTION_CARD_CLASS, CONNECTION_TILE_CLASS } from "./ConnectionCard";
import type { ConnectionRowData } from "./ConnectionRow";

type RoleField = "isDefault" | "defaultForAgents" | "fallbackForMain" | "fallbackForAgents";
type FlagRoleKey = "main" | "agents" | "images" | "video" | "audio";

const FLAG_ROLES: Array<{
  key: FlagRoleKey;
  icon: ReactNode;
  kind: ConnectionSelectKind;
  primary: RoleField;
  fallback: RoleField;
}> = [
  {
    key: "main",
    icon: <MessageSquareText size="0.875rem" />,
    kind: "chat",
    primary: "isDefault",
    fallback: "fallbackForMain",
  },
  {
    key: "agents",
    icon: <Sparkles size="0.875rem" />,
    kind: "chat",
    primary: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  {
    key: "images",
    icon: <ImageIcon size="0.875rem" />,
    kind: "image",
    primary: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  {
    key: "video",
    icon: <Film size="0.875rem" />,
    kind: "video",
    primary: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  {
    key: "audio",
    icon: <Music size="0.875rem" />,
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

type Warning = { text: string; fix?: { label: string; run: () => void } };

/** One role as a Settings-style label/value row: the Model's name, its Connection below; tapping opens its pickers. */
function DefaultLine({
  id,
  icon,
  title,
  value,
  hint,
  muted = false,
  warning,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  value: string;
  hint?: string;
  /** An unset role reads quieter than a chosen one. */
  muted?: boolean;
  warning: Warning | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`connection-default-${id}`}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-[var(--sidebar-accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] md:min-h-9"
      >
        <span className="shrink-0 text-[var(--muted-foreground)]">{icon}</span>
        <span className="shrink-0 font-medium text-[var(--foreground)]">{title}</span>
        <span className="min-w-0 flex-1 text-right">
          <span
            className={cn("block break-words", muted ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]")}
          >
            {value}
          </span>
          {hint && <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">{hint}</span>}
        </span>
        <ChevronDown
          size="0.75rem"
          className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
        />
      </button>
      {warning && (
        <div className="mt-1 flex flex-wrap items-center gap-2 pl-7 text-[0.6875rem] text-[var(--warning)]">
          <AlertTriangle size="0.75rem" className="shrink-0" />
          <span className="min-w-0">{warning.text}</span>
          {warning.fix && (
            <button
              type="button"
              onClick={warning.fix.run}
              className="mari-chrome-control mari-chrome-control--small text-[0.6875rem] max-md:min-h-11"
            >
              {warning.fix.label}
            </button>
          )}
        </div>
      )}
      <SmoothFolderContent open={open}>
        <div
          id={`connection-default-${id}`}
          className="ml-7 mt-1 space-y-1 border-l border-[color-mix(in_srgb,var(--mari-panel-gradient-start)_15%,transparent)] pb-1 pl-2"
        >
          {children}
        </div>
      </SmoothFolderContent>
    </div>
  );
}

export function ConnectionDefaultsCard({ connectionsList }: { connectionsList: ConnectionRowData[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const { data: accounts } = useConnectionAccounts();
  const updateConnection = useUpdateConnection();
  const updateAccount = useUpdateConnectionAccount();
  const openModal = useUIStore((s) => s.openModal);
  const showPaidAgentConnectionWarning = useUIStore((s) => s.showPaidAgentConnectionWarning);
  const setShowPaidAgentConnectionWarning = useUIStore((s) => s.setShowPaidAgentConnectionWarning);
  const sidecarModelDownloaded = useSidecarStore((s) => s.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((s) => s.modelDisplayName);
  const sidecarAsAgentsDefault = useSidecarStore((s) => s.config.useAsAgentsDefault);
  const updateSidecarConfig = useSidecarStore((s) => s.updateConfig);
  const embeddingDefault = useDefaultEmbeddingConnection();
  const decisionOptions = useDecisionOptions();
  const featureModels = useFeatureModels();
  const setFeatureModels = useSetFeatureModels();
  const { data: agentConfigs } = useAgentConfigs();
  const updateAgent = useUpdateAgent();
  const [resettingAgents, setResettingAgents] = useState(false);

  const accountById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);
  const lite = import.meta.env.VITE_MARINARA_LITE === "true";
  const sidecarName = createLocalSidecarConnectionOption(sidecarModelDisplayName).name;
  // Keep the option visible while the flag is set, so a stale sidecar default can be cleared here.
  const offerLocalSidecar = !lite && (sidecarModelDownloaded || sidecarAsAgentsDefault);
  const toggleLine = (key: string) => setOpenLine((current) => (current === key ? null : key));

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
  const chooseFix = (key: string) => ({ label: t("connections.defaults.fix.choose"), run: () => setOpenLine(key) });

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

  const roleLines = FLAG_ROLES.map((role) => {
    const rows = connectionsList.filter((row) => matchesKind(row, role.kind));
    const primary = rows.find((row) => isConnectionFlagTrue(row[role.primary])) ?? null;
    const fallback = rows.find((row) => isConnectionFlagTrue(row[role.fallback])) ?? null;
    const title = t(`connections.defaults.role.${role.key}`);
    const isAgents = role.key === "agents";
    const usesSidecar = isAgents && sidecarAsAgentsDefault;

    let summary: { value: string; hint?: string; muted?: boolean };
    let warning: Warning | null = null;
    if (usesSidecar) summary = { value: sidecarName };
    else if (primary) {
      summary = describe(primary);
      warning = accountWarning(primary.accountId ? accountById.get(primary.accountId) : undefined);
    } else if (isAgents) summary = { value: t("connections.defaults.agentsFollowChat"), muted: true };
    else {
      summary = { value: t("connections.defaults.notSet"), muted: true };
      if (role.key === "main") warning = { text: t("connections.defaults.warning.noMain"), fix: chooseFix(role.key) };
    }

    return (
      <DefaultLine
        key={role.key}
        id={role.key}
        icon={role.icon}
        title={title}
        value={summary.value}
        hint={summary.hint}
        muted={summary.muted}
        warning={warning}
        open={openLine === role.key}
        onToggle={() => toggleLine(role.key)}
      >
        <ConnectionSelect
          variant="menu"
          label={t("connections.defaults.default")}
          kind={role.kind}
          value={usesSidecar ? LOCAL_SIDECAR_CONNECTION_ID : (primary?.id ?? null)}
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
              className="mari-chrome-control mari-chrome-control--small w-fit text-[0.6875rem] max-md:min-h-11"
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
      </DefaultLine>
    );
  });

  // Embeddings: an app setting naming a Model with an embedding model, or the sidecar.
  const embeddingId = embeddingDefault.data?.connectionId ?? null;
  const embeddingRow = embeddingId ? connectionsList.find((row) => row.id === embeddingId) : undefined;
  let embeddingSummary: { value: string; hint?: string; muted?: boolean } = {
    value: t("connections.defaults.notSet"),
    muted: true,
  };
  let embeddingWarning: Warning | null = null;
  if (embeddingId === LOCAL_SIDECAR_CONNECTION_ID) embeddingSummary = { value: sidecarName };
  else if (embeddingRow) {
    const account = embeddingRow.accountId ? accountById.get(embeddingRow.accountId) : undefined;
    embeddingSummary = {
      value: embeddingRow.embeddingModel?.trim() || embeddingRow.name,
      hint: account?.name ?? embeddingRow.name,
    };
    embeddingWarning = accountWarning(account);
  } else if (embeddingId) {
    embeddingSummary = { value: t("connections.defaults.missing"), muted: true };
    embeddingWarning = { text: t("connections.defaults.warning.missing"), fix: chooseFix("embeddings") };
  }

  const decisionSelected = decisionOptions.data?.options.find((entry) => entry.selected) ?? null;
  const decisionWarning: Warning | null = decisionSelected?.unavailable
    ? { text: t("connections.defaults.warning.unavailable"), fix: chooseFix("decision") }
    : null;

  const mainRow = connectionsList.find((row) => isChatProvider(row.provider) && isConnectionFlagTrue(row.isDefault));
  const features = featureModels.data;
  const setFeature = (key: keyof FeatureModelConnections, value: string | null) =>
    setFeatureModels.mutate({ [key]: value });

  return (
    <section className={CONNECTION_CARD_CLASS}>
      <div className="flex items-center gap-2.5">
        <div className={CONNECTION_TILE_CLASS}>
          <Settings2 size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--foreground)]">{t("connections.defaults.title")}</div>
          <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("connections.defaults.summary", {
              model: mainRow ? describe(mainRow).value : t("connections.defaults.notSet"),
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="mari-chrome-control mari-chrome-control--small h-8 min-h-0 w-8 !p-0 max-md:h-11 max-md:w-11"
          title={open ? t("connections.defaults.collapse") : t("connections.defaults.expand")}
          aria-label={open ? t("connections.defaults.collapse") : t("connections.defaults.expand")}
          aria-expanded={open}
          aria-controls="connection-defaults-content"
        >
          {open ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
        </button>
      </div>
      <SmoothFolderContent open={open}>
        <div
          id="connection-defaults-content"
          className="mt-3 border-t border-[color-mix(in_srgb,var(--mari-panel-gradient-start)_10%,transparent)] pt-1"
        >
          {roleLines}
          <DefaultLine
            id="embeddings"
            icon={<Database size="0.875rem" />}
            title={t("connections.defaults.role.embeddings")}
            value={embeddingSummary.value}
            hint={embeddingSummary.hint}
            muted={embeddingSummary.muted}
            warning={embeddingWarning}
            open={openLine === "embeddings"}
            onToggle={() => toggleLine("embeddings")}
          >
            <EmbeddingDefaultControl connections={connectionsList.filter((row) => isChatProvider(row.provider))} />
          </DefaultLine>
          <DefaultLine
            id="decision"
            icon={<BrainCircuit size="0.875rem" />}
            title={t("connections.defaults.role.decision")}
            value={decisionSelected?.label ?? t("connections.defaults.notSet")}
            muted={!decisionSelected}
            warning={decisionWarning}
            open={openLine === "decision"}
            onToggle={() => toggleLine("decision")}
          >
            <DecisionDefaultControl />
          </DefaultLine>
          <div className="space-y-0.5 py-2">
            <p className="px-1.5 pb-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {t("connections.defaults.featuresTitle")}
            </p>
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
                onChange={(value) => setFeature(key, value)}
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
          </div>
        </div>
      </SmoothFolderContent>
    </section>
  );
}
