import { Check, ChevronRight, Cpu, KeyRound, ListChecks, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ConnectionAccountListItem } from "@marinara-engine/shared";
import { ListSearch, ListStatus } from "../../connections/ListFrame";
import type { ConnectionRowData } from "../../connections/ConnectionRow";
import { cn } from "../../../lib/utils";
import { JOB } from "../../../lib/connection-jobs";
import type { AddJob } from "../../../lib/add-connection";
import type { ModelEntry, ModelKind } from "../../../lib/add-model-search";
import {
  CHIP_KINDS,
  DECISION_BUILTIN,
  HIGHLIGHT_BADGE_CLASS,
  KIND_ICONS,
  MODEL_CHIP_KINDS,
  MUTED_BADGE_CLASS,
  SECONDARY_CLASS,
  VENDORS_SHOWN,
  ServiceCard,
  ServiceGroup,
  FirstRunIntro,
  JobCards,
  type ChipKind,
  type AddableKind,
  type ServiceGroupDefinition,
  type ServiceId,
} from "./shared";

type Pick = "job" | "model" | "provider" | null;
type ModelRoutes = {
  mine: Array<[string, string]>;
  services: Array<{ service: ServiceId; model: string }>;
};
type ServiceListStepProps = {
  firstRun: boolean | null;
  pick: Pick;
  setPick: (pick: Pick) => void;
  query: string;
  setQuery: (query: string) => void;
  cards: boolean;
  jobList: boolean;
  rows: ConnectionRowData[];
  chooseJob: (key: AddJob) => void;
  kindFilter: ChipKind | null;
  setKindFilter: (kind: ChipKind | null) => void;
  job: AddJob | null;
  jobLabel: (key: AddJob) => string;
  clearJob: () => void;
  listJobs: AddJob[];
  listModels: ModelEntry[];
  listGroups: Array<ServiceGroupDefinition & { services: ServiceId[] }>;
  shownModels: ModelEntry[];
  routesOf: (entry: ModelEntry) => ModelRoutes;
  accounts?: ConnectionAccountListItem[];
  setWant: (want: { model: string; kind: ModelKind } | null) => void;
  showModelsOf: (accountId: string, connectionId?: string, kind?: AddableKind) => Promise<void>;
  chooseService: (service: ServiceId) => Promise<void>;
  setDecisionOpen: (open: boolean) => void;
  serviceName: (service: ServiceId) => string;
  serviceHint: (service: ServiceId) => string;
  kindItems: (service: ServiceId) => Array<{ kind: ChipKind; label: string }>;
  badgesFor: (service: ServiceId) => Array<{ label: string; highlight?: boolean }>;
  service: ServiceId | null;
  searching: boolean;
  showAllVendors: boolean;
  otherOpen: boolean;
  setOtherOpen: (value: boolean | ((value: boolean) => boolean)) => void;
  setShowAllVendors: (value: boolean) => void;
};

export function ServiceListStep(props: ServiceListStepProps) {
  const { t } = useTranslation();
  const {
    firstRun,
    pick,
    setPick,
    query,
    setQuery,
    cards,
    jobList,
    rows,
    chooseJob,
    kindFilter,
    setKindFilter,
    job,
    jobLabel,
    clearJob,
    listJobs,
    listModels,
    listGroups,
    shownModels,
    routesOf,
    accounts,
    setWant,
    showModelsOf,
    chooseService,
    setDecisionOpen,
    serviceName,
    serviceHint,
    kindItems,
    badgesFor,
    service,
    searching,
    showAllVendors,
    otherOpen,
    setOtherOpen,
    setShowAllVendors,
  } = props;
  const searchLabel = t(
    pick === "model"
      ? "connections.add.searchModels"
      : pick === "provider"
        ? "connections.add.searchProviders"
        : "connections.add.search",
  );
  const modelExample = shownModels[0];
  const exampleRoute = modelExample && routesOf(modelExample);
  const exampleService = exampleRoute
    ? exampleRoute.mine[0]
      ? accounts?.find((account) => account.id === exampleRoute.mine[0]![0])?.name
      : exampleRoute.services[0] && serviceName(exampleRoute.services[0].service)
    : undefined;
  const questions = [
    {
      id: "job",
      Icon: ListChecks,
      examples: (["decision", "voice", "embeddings"] as const).map((key) => ({
        label: jobLabel(key),
        Icon: JOB[key].icon,
      })),
    },
    {
      id: "model",
      Icon: Cpu,
      examples:
        exampleService && modelExample
          ? [
              {
                label: t("connections.add.question.model.example", {
                  model: modelExample.name,
                  service: exampleService,
                }),
              },
            ]
          : [],
    },
    { id: "provider", Icon: KeyRound, examples: [{ label: t("connections.add.question.provider.example") }] },
  ] as const;
  const sectionTitle = (text: string) => (
    <h4 className="px-1 text-xs font-semibold text-[var(--foreground)]">{text}</h4>
  );
  const list = (
    <div className="flex flex-col gap-3 p-4">
      {firstRun && !pick && <FirstRunIntro text={t("connections.add.intro")} />}
      {!jobList && <ListSearch value={query} onChange={setQuery} label={searchLabel} placeholder={searchLabel} />}
      {cards && (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          {questions.map(({ id, Icon, examples }) => (
            <button
              key={id}
              type="button"
              data-add-connection-question={id}
              onClick={() => {
                setPick(id);
                setKindFilter(null);
              }}
              className="mari-chrome-control mari-chrome-control--card min-h-24 !flex-row items-center gap-3 p-4 text-xs lg:min-h-36"
            >
              <span className="flex min-w-0 flex-1 items-start gap-3 self-stretch lg:flex-col">
                <span
                  aria-hidden="true"
                  className="mari-panel-gradient--connections mari-panel-gradient-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                >
                  <Icon size="1.125rem" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[0.9375rem] font-semibold">{t(`connections.add.question.${id}`)}</span>
                  <span className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                    {t(`connections.add.question.${id}.body`)}
                  </span>
                  {examples.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      {examples.map((example) => (
                        <span key={example.label} className={cn(MUTED_BADGE_CLASS, "inline-flex items-center gap-1")}>
                          {"Icon" in example && <example.Icon size="0.625rem" aria-hidden />}
                          {example.label}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight
                size="1rem"
                className="shrink-0 self-center text-[var(--muted-foreground)] lg:hidden"
                aria-hidden
              />
            </button>
          ))}
        </div>
      )}
      {jobList && <JobCards rows={(rows ?? []) as ConnectionRowData[]} onPick={chooseJob} />}
      {!cards && !jobList && pick !== "provider" && (
        <div role="group" aria-label={t("connections.add.kindFilter")} className="flex flex-wrap gap-1.5">
          {/* Voice and Decision have no models to list, so the model list leaves them out. */}
          {[null, ...CHIP_KINDS.filter((kind) => pick !== "model" || MODEL_CHIP_KINDS.has(kind))].map((kind) => (
            <button
              key={kind ?? "all"}
              type="button"
              data-add-connection-kind={kind ?? "all"}
              aria-pressed={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
              className="mari-connection-chip gap-1"
            >
              {kind &&
                (() => {
                  const Icon = KIND_ICONS[kind];
                  return <Icon size="0.75rem" aria-hidden />;
                })()}
              {t(`connections.add.kind.${kind ?? "all"}`)}
            </button>
          ))}
        </div>
      )}
      {job && (
        <p data-add-connection-job={job} className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={cn(HIGHLIGHT_BADGE_CLASS, "gap-1")}>
            {(() => {
              const Icon = JOB[job].icon;
              return <Icon size="0.75rem" aria-hidden />;
            })()}
            {t("connections.add.forJob", { job: jobLabel(job) })}
          </span>
          <button
            type="button"
            data-add-connection-clear-job
            onClick={clearJob}
            aria-label={t("connections.add.clearJob")}
            title={t("connections.add.clearJob")}
            className="mari-connection-btn mari-connection-btn--ghost mari-connection-btn--icon"
          >
            <X size="0.75rem" aria-hidden />
          </button>
          <span className="w-full px-1 text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("connections.add.forJobHint")}
          </span>
        </p>
      )}
      {listJobs.length > 0 && (
        <section data-add-connection-section="job" className="flex flex-col gap-1.5">
          {sectionTitle(t("connections.add.section.job"))}
          <div className="flex flex-wrap gap-1.5">
            {listJobs.map((key) => {
              const Icon = JOB[key].icon;
              return (
                <button
                  key={key}
                  type="button"
                  data-add-connection-job-choice={key}
                  onClick={() => chooseJob(key)}
                  className="mari-connection-chip gap-1"
                >
                  <Icon size="0.75rem" aria-hidden />
                  {jobLabel(key)}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {listModels.length > 0 && (
        <section data-add-connection-section="model" className="flex flex-col gap-1.5">
          {pick !== "model" && sectionTitle(t("connections.add.section.model"))}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {listModels.map((entry) => {
              const { mine, services } = routesOf(entry);
              const pick = { kind: entry.kind };
              return (
                <div
                  key={`${entry.kind}:${entry.key}`}
                  data-add-model={entry.key}
                  className="mari-chrome-control mari-chrome-control--card min-h-16 !items-start gap-1 p-3 text-xs"
                >
                  <span className="block min-w-0 max-w-full truncate text-sm font-medium">{entry.name}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {t("connections.add.model.via")}
                    </span>
                    {mine.map(([accountId, model]) => {
                      const name = accounts?.find((account) => account.id === accountId)?.name ?? "";
                      return (
                        <button
                          key={accountId}
                          type="button"
                          data-add-model-account={accountId}
                          onClick={() => {
                            setWant({ model, ...pick });
                            void showModelsOf(accountId, undefined, entry.kind);
                          }}
                          aria-label={t("connections.add.model.addTo", { model: entry.name, name })}
                          className="mari-connection-chip gap-1 !text-[var(--mari-connection-ink)]"
                        >
                          {t("connections.add.model.yours", { name })}
                          <Check size="0.75rem" aria-hidden />
                        </button>
                      );
                    })}
                    {services.map(({ service: key, model }) => (
                      <button
                        key={key}
                        type="button"
                        data-add-model-service={key}
                        onClick={() => {
                          setWant({ model, ...pick });
                          void chooseService(key);
                        }}
                        aria-label={t("connections.add.model.connectFor", {
                          model: entry.name,
                          service: serviceName(key),
                        })}
                        className="mari-connection-chip"
                      >
                        {serviceName(key)}
                      </button>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {listGroups.length > 0 && (listJobs.length > 0 || listModels.length > 0) && (
        <div className="-mb-1.5">{sectionTitle(t("connections.add.section.provider"))}</div>
      )}
      {listGroups.map((group) => {
        const capped = group.id === "vendors" && !searching && !showAllVendors && group.services.length > VENDORS_SHOWN;
        const shown = capped ? group.services.slice(0, VENDORS_SHOWN) : group.services;
        return (
          <ServiceGroup
            key={group.id}
            // The Decision filter's only folded tile is the on-device model.
            title={t(
              `connections.add.group.${group.id === "other" && kindFilter === "decision" ? "device" : group.id}`,
            )}
            count={group.services.length}
            collapsible={!!group.folded && !searching}
            open={searching || otherOpen}
            onToggle={() => setOtherOpen((value) => !value)}
            more={
              capped && (
                <button
                  type="button"
                  data-add-connection-show-all
                  onClick={() => setShowAllVendors(true)}
                  className="mari-connection-btn mari-connection-btn--ghost mari-add-show-all self-start"
                >
                  {t("connections.add.showAll", { count: group.services.length })}
                </button>
              )
            }
          >
            {shown.map((key) => (
              <ServiceCard
                key={key}
                service={key}
                name={serviceName(key)}
                hint={serviceHint(key)}
                kinds={kindItems(key)}
                badges={badgesFor(key)}
                rail={group.id === "start"}
                selected={service === key}
                onClick={() => {
                  setWant(null);
                  if (key === DECISION_BUILTIN) setDecisionOpen(true);
                  else void chooseService(key);
                }}
              />
            ))}
          </ServiceGroup>
        );
      })}
      {searching && listGroups.length === 0 && listModels.length === 0 && listJobs.length === 0 && (
        <div data-add-connection-no-match className="flex flex-col items-center gap-2 py-4 text-center">
          <ListStatus className="py-0 text-xs text-[var(--muted-foreground)]">
            {t("connections.add.noMatch", { query: query.trim() })}
          </ListStatus>
          <button type="button" onClick={() => void chooseService("custom")} className={SECONDARY_CLASS}>
            {t("connections.add.useCustom")}
          </button>
        </div>
      )}
    </div>
  );
  return <div className="h-full min-h-0 overflow-y-auto overscroll-contain">{list}</div>;
}
