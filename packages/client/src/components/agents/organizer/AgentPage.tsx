import { ArrowUpRight, Check, ExternalLink, House, MoreHorizontal, Plus } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { useUIStore } from "../../../stores/ui.store";
import { AgentReleaseNoteList } from "../AgentReleaseNoteList";
import { AgentVersionHistory } from "../AgentVersionHistory";
import { useCapabilityPackageReleaseNotes } from "../../../hooks/use-capability-packages";
import {
  formatBytes,
  checkReasonOf,
  hasUpdate,
  MODE_BADGES,
  packageModes,
  sectionLabelKey,
  sectionOf,
  taglineOf,
  typeLabelKey,
  typeOf,
  type OrganizerEntry,
} from "./organizer-model";
import {
  AgentAction,
  AgentIcon,
  AgentRow,
  MenuButton,
  SECONDARY_ACTION,
  StoreBanner,
  useOrganizer,
} from "./OrganizerParts";

const HOW_TO_STEPS = [1, 2, 3] as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-l border-t border-[var(--border)] px-4 py-3">
      <dt className="text-[0.6875rem] text-[var(--muted-foreground)]">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border)] pt-5">
      <h3 className="mb-3 text-base font-semibold text-[var(--foreground)]">{title}</h3>
      {children}
    </section>
  );
}

/** The newest release note, beside About; the Version history below keeps the rest. */
function WhatsNew({ packageId, version }: { packageId: string; version: string }) {
  const { t: localizeUi } = useUiTranslation();
  const note = useCapabilityPackageReleaseNotes(packageId).data?.find((entry) => entry.version === version);
  if (!note) return null;
  return (
    <Section title={localizeUi("ui.agents.organizer.whatsNewVersion", { version })}>
      <AgentReleaseNoteList entries={[note]} />
    </Section>
  );
}

export function AgentPage({
  entry,
  entries,
  customSource,
}: {
  entry: OrganizerEntry;
  entries: readonly OrganizerEntry[];
  customSource: boolean;
}) {
  const { installedById, chatCountById, settingsAgentById, open } = useOrganizer();
  const openAgentDetail = useUIStore((state) => state.openAgentDetail);
  const { t: localizeUi } = useUiTranslation();
  const { manifest } = entry;
  const installed = installedById.get(manifest.id);
  const update = hasUpdate(entry, installed);
  const checkReason = checkReasonOf(installed);
  const settingsAgentId = installed ? settingsAgentById.get(manifest.id) : undefined;
  const section = sectionOf(entry);
  const type = typeOf(entry);
  const modes = packageModes(manifest.id);
  const previews = entry.store?.previewUrls ?? [];
  const more = entries.filter((item) => item.manifest.id !== manifest.id && sectionOf(item) === section).slice(0, 4);

  const installedPermissions = installed?.manifest.permissions;
  const permissionGroups = [
    ...(installed
      ? [{ kind: "installed" as const, version: installed.version, permissions: installed.manifest.permissions }]
      : []),
    ...(!installedPermissions ||
    installedPermissions.length !== manifest.permissions.length ||
    manifest.permissions.some((permission) => !installedPermissions.includes(permission))
      ? [{ kind: "available" as const, version: manifest.version, permissions: manifest.permissions }]
      : []),
  ];

  return (
    <article className="pb-6">
      <div className="relative">
        <StoreBanner
          entry={entry}
          priority
          sizes="100vw"
          className="aspect-[16/8] max-h-[380px] w-full shadow-none! sm:aspect-[16/6]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-[var(--marinara-editor-bg,var(--background))] to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <header className="relative -mt-10 flex flex-wrap items-end gap-x-5 gap-y-3 sm:-mt-16">
          <AgentIcon
            entry={entry}
            className="h-20 w-20 rounded-2xl shadow-[0_0_0_5px_var(--marinara-editor-bg,var(--background)),0_10px_28px_rgb(0_0_0/0.4)] sm:h-[104px] sm:w-[104px]"
          />
          <div className="min-w-0 flex-1 pb-1.5 max-sm:basis-full">
            <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)]">
              {localizeUi(sectionLabelKey(section))} · {localizeUi(typeLabelKey(type))}
            </p>
            <h2 className="text-2xl font-bold break-words text-[var(--foreground)] sm:text-[1.75rem]">
              {manifest.name}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">{taglineOf(entry)}</p>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {installed
                ? localizeUi("ui.agents.organizer.statusInstalled", { version: installed.version })
                : localizeUi("ui.agents.organizer.statusNotInstalled")}
              {update && (
                <>
                  {" "}
                  ·{" "}
                  <b className="font-semibold text-[var(--marinara-chat-chrome-highlight-text,var(--primary))]">
                    {localizeUi("ui.agents.organizer.statusReady", { version: manifest.version })}
                  </b>
                </>
              )}
              {installed && !update && (chatCountById.get(manifest.id) ?? 0) > 0 && (
                <> · {localizeUi("ui.agents.organizer.onInChats", { count: chatCountById.get(manifest.id) })}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 pb-1.5 max-sm:w-full">
            {(!installed || update || type === "app") && <AgentAction entry={entry} size="lg" />}
            {update && type === "app" && (
              <button
                type="button"
                className={cn(SECONDARY_ACTION, "h-10 gap-1 px-4 text-sm font-semibold")}
                onClick={() => open(entry)}
              >
                <ArrowUpRight size="0.9rem" aria-hidden="true" />
                {localizeUi("ui.agents.organizer.open")}
              </button>
            )}
            {settingsAgentId && (
              <button
                type="button"
                className={cn(SECONDARY_ACTION, "h-10 px-4 text-sm font-semibold")}
                onClick={() => openAgentDetail(settingsAgentId)}
              >
                {localizeUi("ui.agents.organizer.settings")}
              </button>
            )}
            <MenuButton entry={entry} className="h-10 w-10" />
          </div>
        </header>
        {checkReason !== null && (
          <p className="mt-4 rounded-xl border border-[var(--marinara-app-accent-static)]/40 bg-[var(--marinara-app-accent-static)]/10 px-4 py-3 text-sm text-[var(--foreground)]">
            <span className="font-semibold text-[var(--marinara-app-accent-static)]">
              {localizeUi("ui.agents.organizer.needsCheck")}
            </span>{" "}
            · {checkReason || localizeUi("ui.agents.organizer.needsCheckHint")}
          </p>
        )}

        <div className="mt-6 overflow-hidden border-y border-[var(--border)]">
          <dl className="-mt-px -ml-px grid grid-cols-2 sm:grid-cols-3 lg:auto-cols-fr lg:grid-flow-col">
            <Fact label={localizeUi("ui.agents.organizer.facts.type")}>{localizeUi(typeLabelKey(type))}</Fact>
            <Fact label={localizeUi("ui.agents.organizer.facts.worksIn")}>
              {modes.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {modes.map((mode) => (
                    <span
                      key={mode}
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[0.625rem] font-semibold",
                        MODE_BADGES[mode].className,
                      )}
                    >
                      {localizeUi(MODE_BADGES[mode].labelKey)}
                    </span>
                  ))}
                </span>
              ) : (
                localizeUi("ui.agents.organizer.facts.anyMode")
              )}
            </Fact>
            <Fact label={localizeUi("ui.agents.organizer.facts.version")}>
              {installed && update
                ? localizeUi("ui.agents.organizer.versionChange", { from: installed.version, to: manifest.version })
                : (installed?.version ?? manifest.version)}
            </Fact>
            <Fact label={localizeUi("ui.agents.organizer.facts.engine")}>
              {localizeUi("ui.agents.organizer.facts.engineValue", { version: manifest.engine.min })}
            </Fact>
            {installed && (
              <Fact label={localizeUi("ui.agents.organizer.facts.usedIn")}>
                {localizeUi("ui.agents.organizer.facts.chatCount", { count: chatCountById.get(manifest.id) ?? 0 })}
              </Fact>
            )}
            <Fact label={localizeUi("ui.agents.organizer.facts.size")}>{formatBytes(entry.artifact.bytes)}</Fact>
            <Fact label={localizeUi("ui.agents.organizer.facts.source")}>
              {localizeUi(customSource ? "ui.agents.organizer.facts.custom" : "ui.agents.organizer.facts.official")}
            </Fact>
          </dl>
        </div>

        <div className="mt-6 space-y-6">
          {previews.length > 0 && (
            <Section title={localizeUi("ui.agents.organizer.preview")}>
              <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
                {previews.map((url, index) => (
                  <img
                    key={url}
                    src={url}
                    alt={localizeUi("ui.agents.organizer.previewAlt", { name: manifest.name, index: index + 1 })}
                    width={640}
                    height={400}
                    loading="lazy"
                    decoding="async"
                    className="h-56 w-auto shrink-0 snap-start rounded-xl border border-[var(--border)] bg-[var(--card)] object-cover sm:h-72"
                  />
                ))}
              </div>
            </Section>
          )}

          {(type === "app" || type === "game" || type === "agent") && (
            <Section title={localizeUi("ui.agents.organizer.howTo")}>
              <ol className="grid gap-3 sm:grid-cols-3">
                {HOW_TO_STEPS.map((step) => (
                  <li key={step} className="overflow-hidden rounded-xl border border-[var(--border)] text-sm">
                    <StepPicture entry={entry} type={type} step={step} />
                    <div className="flex gap-3 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--marinara-chat-chrome-highlight-bg,var(--accent))] text-xs font-bold text-[var(--foreground)]">
                        {step}
                      </span>
                      <span className="text-[var(--foreground)]">
                        {localizeUi(`ui.agents.organizer.steps.${type}.step${step}`, { name: manifest.name })}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <div className="grid gap-x-12 lg:grid-cols-2">
            <Section title={localizeUi("ui.agents.organizer.about")}>
              <p className="max-w-[70ch] text-sm leading-6 text-[var(--muted-foreground)]">{manifest.description}</p>
              {entry.documentationUrl && (
                <a
                  href={entry.documentationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--marinara-chat-chrome-accent,var(--primary))] hover:underline"
                >
                  <ExternalLink size="0.85rem" aria-hidden="true" />
                  {localizeUi("ui.agents.agentcatalogview.readHowThisAgentWorks")}
                </a>
              )}
            </Section>
            <WhatsNew packageId={manifest.id} version={manifest.version} />
          </div>

          <AgentVersionHistory packageId={manifest.id} />

          <Section title={localizeUi("ui.agents.agentcatalogview.permissions")}>
            {(manifest.entrypoints.server || manifest.entrypoints.client) && (
              <p className="mb-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs leading-relaxed text-[var(--foreground)]">
                {localizeUi("ui.agents.agentcatalogview.trustedCodeAccessNotice")}
              </p>
            )}
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.agentcatalogview.permissionScopeNotice")}
            </p>
            {permissionGroups.map((group) => (
              <div key={group.kind} className="mt-3">
                <h4 className="text-xs font-medium">
                  {localizeUi(
                    group.kind === "installed"
                      ? "ui.agents.agentcatalogview.installedPermissions"
                      : "ui.agents.agentcatalogview.availablePermissions",
                    { version: group.version },
                  )}
                </h4>
                {group.permissions.length > 0 ? (
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <li key={permission} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                        <Check
                          size="0.85rem"
                          className="text-[var(--marinara-chat-chrome-highlight-text)]"
                          aria-hidden="true"
                        />
                        {permission.replaceAll("-", " ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.agents.agentcatalogview.noPermissions")}
                  </p>
                )}
              </div>
            ))}
          </Section>

          {more.length > 0 && (
            <Section
              title={localizeUi("ui.agents.organizer.moreIn", { section: localizeUi(sectionLabelKey(section)) })}
            >
              <ul className="grid gap-x-6 md:grid-cols-2">
                {more.map((item) => (
                  <AgentRow key={item.manifest.id} entry={item} />
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </article>
  );
}

const RING =
  "ring-2 ring-[var(--marinara-chat-chrome-accent,var(--primary))] ring-offset-2 ring-offset-[color-mix(in_srgb,var(--foreground)_5%,var(--card))]";
const BOX = "rounded-lg border border-[var(--border)] bg-[var(--card)]";

function Bar({ width, accent }: { width: string; accent?: boolean }) {
  const color = accent
    ? "bg-[color-mix(in_srgb,var(--marinara-chat-chrome-accent,var(--primary))_45%,transparent)]"
    : "bg-[color-mix(in_srgb,var(--foreground)_18%,transparent)]";
  return <span className={cn("block h-1.5 rounded-full", color)} style={{ width }} />;
}

/** A small drawing of the control each how-to step names, built from the app's own colours. */
function StepPicture({ entry, type, step }: { entry: OrganizerEntry; type: "app" | "game" | "agent"; step: number }) {
  const { t: localizeUi } = useUiTranslation();
  const name = entry.manifest.name;
  const icon = <AgentIcon entry={entry} className="h-7 w-7 rounded-lg p-0.5" />;
  const nameLabel = <span className="min-w-0 truncate text-xs font-semibold text-[var(--foreground)]">{name}</span>;
  let picture;
  if (step === 1) {
    picture = (
      <div className={cn(BOX, "flex w-full max-w-60 items-center gap-2 p-2")}>
        {icon}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {nameLabel}
          <Bar width="70%" />
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full bg-[var(--foreground)] px-3 py-1 text-xs font-bold text-[var(--background)]",
            RING,
          )}
        >
          {localizeUi("ui.agents.organizer.get")}
        </span>
      </div>
    );
  } else if (type === "app" && step === 2) {
    picture = (
      <div className={cn(BOX, "flex w-full max-w-60 items-center gap-1 p-1.5")}>
        <span className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--muted-foreground)]">
          <House className="h-3.5 w-3.5" />
          {localizeUi("ui.agents.organizer.home")}
        </span>
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-md bg-[var(--marinara-chat-chrome-highlight-bg,var(--accent))] px-2 py-1",
            RING,
          )}
        >
          <AgentIcon entry={entry} className="h-5 w-5 rounded-md p-0.5" />
          {nameLabel}
        </span>
      </div>
    );
  } else if (type === "app") {
    picture = (
      <div className="relative w-full max-w-60">
        <div className={cn(BOX, "flex items-center gap-2 p-2")}>
          {icon}
          {nameLabel}
          <MoreHorizontal className="ml-auto h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
        </div>
        <span
          className={cn(
            BOX,
            "absolute -bottom-6 right-1 px-3 py-1 text-xs font-semibold text-[var(--foreground)] shadow-md",
            RING,
          )}
        >
          {localizeUi("ui.agents.agentcatalogview.uninstall")}
        </span>
      </div>
    );
  } else if (step === 2) {
    picture = (
      <div className={cn(BOX, "w-full max-w-60 p-2")}>
        <p className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {localizeUi("navigation.topbar.agents")}
        </p>
        <div className="flex items-center gap-2">
          {icon}
          {nameLabel}
          <span
            className={cn(
              "ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)]",
              RING,
            )}
          >
            <Plus className="h-3.5 w-3.5 text-[var(--background)]" strokeWidth={3} />
          </span>
        </div>
      </div>
    );
  } else {
    // Step 3: the chat goes on, with the agent working (agent) or the game started (game).
    picture = (
      <div className="flex w-full max-w-60 flex-col gap-1.5">
        <div className={cn(BOX, "flex w-3/4 flex-col gap-1 p-2")}>
          <Bar width="90%" />
          <Bar width="60%" />
        </div>
        <div className={cn(BOX, "flex w-3/4 flex-col items-end gap-1 self-end p-2", type === "game" && RING)}>
          <Bar width="80%" accent />
          {type === "game" && nameLabel}
        </div>
        {type === "agent" && (
          <span className={cn(BOX, "flex items-center gap-1.5 self-start rounded-full py-0.5 pl-0.5 pr-2.5", RING)}>
            <AgentIcon entry={entry} className="h-5 w-5 rounded-full p-0.5" />
            {nameLabel}
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--marinara-chat-chrome-accent,var(--primary))]" />
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-32 items-center justify-center bg-[color-mix(in_srgb,var(--foreground)_5%,var(--card))] px-4"
    >
      {picture}
    </div>
  );
}
