import { ArrowLeft, Box, MessageSquare, Puzzle, Settings2 } from "lucide-react";
import type { BuiltInAgentManifest, InstalledCapabilityPackage } from "@marinara-engine/shared";
import { CapabilityElement } from "../capabilities/CapabilityElement";

interface ActiveFeatureChat {
  id: string;
  name: string;
  mode: string;
}

interface FeatureAgentDetailHostProps {
  agent: BuiltInAgentManifest;
  installedPackage: InstalledCapabilityPackage | null;
  activeChat: ActiveFeatureChat | null;
  activeChatSupported: boolean;
  enabledForChat: boolean;
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
  onClose: () => void;
  onManagePackage: () => void;
  capabilityProps?: Record<string, unknown>;
}

const MODE_LABELS: Record<string, string> = {
  conversation: "Conversation",
  roleplay: "Roleplay",
  visual_novel: "Visual Novel",
  game: "Game",
};

function modeLabel(mode: string) {
  return MODE_LABELS[mode] ?? mode;
}

export function FeatureAgentDetailHost({
  agent,
  installedPackage,
  activeChat,
  activeChatSupported,
  enabledForChat,
  onEnabledForChatChange,
  onClose,
  onManagePackage,
  capabilityProps,
}: FeatureAgentDetailHostProps) {
  const contributedAgentIds = installedPackage?.manifest.contributions?.agentDetail?.agentIds ?? [];
  const hasDetailContribution =
    Boolean(installedPackage?.manifest.entrypoints.client) && contributedAgentIds.includes(agent.id);

  if (installedPackage && hasDetailContribution) {
    return (
      <CapabilityElement
        packageId={installedPackage.id}
        view="detail"
        capabilityProps={{
          package: {
            id: installedPackage.id,
            name: installedPackage.manifest.name,
            version: installedPackage.version,
            status: installedPackage.status,
            readiness: installedPackage.readiness,
            readinessError: installedPackage.readinessError,
            error: installedPackage.error,
            restartRequired: installedPackage.manifest.restartRequired,
            description: installedPackage.manifest.description,
          },
          agent: {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            modeAllowlist: agent.modeAllowlist ? [...agent.modeAllowlist] : [],
          },
          chatId: activeChatSupported ? (activeChat?.id ?? null) : null,
          chatName: activeChatSupported ? (activeChat?.name ?? null) : null,
          chatMode: activeChatSupported ? (activeChat?.mode ?? null) : null,
          enabledForChat: activeChatSupported && enabledForChat,
          onEnabledForChatChange: activeChatSupported ? onEnabledForChatChange : undefined,
          onClose,
          onManagePackage,
          ...capabilityProps,
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      />
    );
  }

  const supportedModes = agent.modeAllowlist?.map(modeLabel) ?? [];
  const packageState = installedPackage
    ? installedPackage.status === "restart-required"
      ? "Restart required"
      : installedPackage.status === "error" || installedPackage.readiness === "error"
        ? "Needs attention"
        : "Ready"
    : "Not installed";

  return (
    <section
      data-component="FeatureAgentDetailHost"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--background)] text-[var(--foreground)]"
      aria-labelledby="feature-agent-detail-title"
    >
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to Agents"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <ArrowLeft size="1rem" />
        </button>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/12 text-[var(--primary)]">
          <Puzzle size="1rem" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="feature-agent-detail-title" className="truncate text-sm font-semibold">
            {agent.name}
          </h1>
          <p className="text-[0.625rem] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Feature</p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <div>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{agent.description}</p>
          {supportedModes.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Supported chat modes">
              {supportedModes.map((mode) => (
                <span
                  key={mode}
                  className="rounded-full bg-[var(--secondary)] px-2.5 py-1 text-[0.6875rem] font-medium"
                >
                  {mode}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-start gap-3">
              <Box size="1rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
              <div className="min-w-0">
                <h2 className="text-xs font-semibold">Package</h2>
                <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                  {installedPackage ? `Version ${installedPackage.version} · ${packageState}` : packageState}
                </p>
              </div>
            </div>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-start gap-3">
              <MessageSquare size="1rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
              <div className="min-w-0">
                <h2 className="text-xs font-semibold">Current chat</h2>
                <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                  {!activeChat
                    ? "Open a supported chat to use this feature."
                    : activeChatSupported
                      ? `${activeChat.name} · ${enabledForChat ? "Active" : "Not active"}`
                      : `${activeChat.name} is not a supported mode.`}
                </p>
              </div>
            </div>
          </article>
        </div>

        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 p-4">
          <h2 className="text-xs font-semibold">Feature-managed settings</h2>
          <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
            This feature does not use pipeline prompts, tools, or run-frequency settings. Manage its downloaded package
            or open a supported chat to access its controls.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onManagePackage}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 text-xs font-medium transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Settings2 size="0.875rem" /> Manage package
          </button>
        </div>
      </div>
    </section>
  );
}
