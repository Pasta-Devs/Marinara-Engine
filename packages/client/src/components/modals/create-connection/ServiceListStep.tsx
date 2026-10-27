import { ChevronRight, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ConnectionAccountListItem } from "@marinara-engine/shared";
import { ListHeading, ListSearch, ListStatus } from "../../connections/ListFrame";
import { ServiceRow } from "../../connections/ServiceRow";
import { ModelRow, ModelTile } from "../../connections/ModelRow";
import { JobTile } from "../../connections/JobRow";
import { getConnectionIdentity } from "../../../lib/connection-identity";
import { IconTile, ProviderIcon } from "../../connections/ProviderIcon";
import { JOB, jobHintKey } from "../../../lib/connection-jobs";
import type { AddJob } from "../../../lib/add-connection";
import type { ModelEntry, ModelKind } from "../../../lib/add-model-search";
import {
  CHIP_KINDS,
  DECISION_BUILTIN,
  KIND_ICONS,
  SECONDARY_CLASS,
  ServiceTile,
  FirstRunIntro,
  type ChipKind,
  type AddableKind,
  type ConnectionRowLite,
  type ServiceGroupDefinition,
  type ServiceId,
} from "./shared";

/** Every list row shares one inset and height, and every tile is 40px, so the labels, tiles and titles line up. */
// Rows keep a hover pad that bleeds 0.5rem outside the content edge, so tiles and labels share that edge.
const ROW = "-mx-2 ps-2 md:min-h-14";
const MODEL_ROW = { className: "-mx-2" };
const TILE = "h-10 w-10 rounded-xl [&_svg]:size-5";

type ServiceListStepProps = {
  firstRun: boolean | null;
  pick: "job" | "model" | "provider" | null;
  setPick: (pick: "job" | "model" | "provider" | null) => void;
  query: string;
  setQuery: (query: string) => void;
  rows: ConnectionRowLite[];
  chooseJob: (key: AddJob) => void;
  kindFilter: ChipKind | null;
  setKindFilter: (kind: ChipKind | null) => void;
  job: AddJob | null;
  jobLabel: (key: AddJob) => string;
  clearJob: () => void;
  listJobs: AddJob[];
  listModels: ModelEntry[];
  listGroups: Array<ServiceGroupDefinition & { services: ServiceId[] }>;
  routesOf: (entry: ModelEntry) => {
    mine: Array<[string, string]>;
    services: Array<{ service: ServiceId; model: string }>;
  };
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
};

export function ServiceListStep(props: ServiceListStepProps) {
  const { t } = useTranslation();
  const {
    firstRun,
    pick,
    setPick,
    query,
    setQuery,
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
  } = props;
  const searchLabel = t(
    firstRun || job || pick === "provider" ? "connections.add.searchServices" : "connections.add.search",
  );
  const ownAccounts = (accounts ?? []).filter((account) => {
    const children = rows.filter((row) => row.accountId === account.id);
    return (
      (!kindFilter ||
        children.some((row) => {
          const provider =
            kindFilter === "image"
              ? "image_generation"
              : kindFilter === "video"
                ? "video_generation"
                : kindFilter === "voice"
                  ? "audio"
                  : kindFilter;
          return (
            row.provider === provider ||
            (kindFilter === "chat" &&
              !["audio", "decision", "image_generation", "video_generation"].includes(row.provider ?? ""))
          );
        })) &&
      (!searching || `${account.name} ${account.provider}`.toLowerCase().includes(query.trim().toLowerCase()))
    );
  });
  const serviceRow = (key: ServiceId) => (
    <ServiceRow
      className={ROW}
      key={key}
      account={{ name: serviceName(key), provider: key }}
      rows={[]}
      tile={<ServiceTile service={key} />}
      hint={serviceHint(key)}
      count={[...kindItems(key).map((item) => item.label), ...badgesFor(key).map((badge) => badge.label)].join(" · ")}
      data-add-connection-service={key}
      aria-pressed={service === key}
      onClick={() => {
        setWant(null);
        if (key === DECISION_BUILTIN) setDecisionOpen(true);
        else void chooseService(key);
      }}
      trailing={<ChevronRight size="1rem" aria-hidden className="shrink-0 text-[var(--muted-foreground)]" />}
    />
  );
  const allServices = listGroups.flatMap((group) => group.services);
  const popular: ServiceId[] = ["linkapi", "nanogpt", "openrouter", "openai", "anthropic", "google"];
  const firstGroups = [
    { id: "popular", services: popular.filter((key) => allServices.includes(key)) },
    ...listGroups.map((group) => ({ ...group, services: group.services.filter((key) => !popular.includes(key)) })),
  ].filter((group) => group.services.length > 0);
  const groups = firstRun && !job ? firstGroups : listGroups;
  // Before the long list of missing jobs: the one choice that needs no account. It is not repeated below.
  const builtInOffer =
    !firstRun &&
    !job &&
    !kindFilter &&
    pick !== "provider" &&
    listJobs.length > 0 &&
    allServices.includes("local_model");
  const home = !firstRun && !job && !kindFilter && pick !== "provider";

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div
        className="flex flex-col gap-3 px-3 py-4"
        data-add-connection-path={job ? "job" : firstRun ? "first-run" : pick === "provider" ? "services" : "existing"}
      >
        {firstRun && !job && <FirstRunIntro text={t("connections.add.intro")} />}
        <ListSearch value={query} onChange={setQuery} label={searchLabel} placeholder={searchLabel} />
        {!job && (pick === "provider" || searching) && (
          <div role="group" aria-label={t("connections.add.kindFilter")} className="flex flex-wrap gap-1.5">
            {[null, ...CHIP_KINDS].map((kind) => {
              const Icon = kind ? KIND_ICONS[kind] : null;
              return (
                <button
                  key={kind ?? "all"}
                  type="button"
                  data-add-connection-kind={kind ?? "all"}
                  aria-pressed={kindFilter === kind}
                  onClick={() => setKindFilter(kind)}
                  className="mari-connection-chip min-h-11 gap-1"
                >
                  {Icon && <Icon size="0.75rem" aria-hidden />}
                  {t(`connections.add.kind.${kind ?? "all"}`)}
                </button>
              );
            })}
          </div>
        )}
        {job && (
          <div className="flex items-center gap-2" data-add-connection-job={job}>
            <span className="text-xs font-medium">{t("connections.add.forJob", { job: jobLabel(job) })}</span>
            <button
              type="button"
              data-add-connection-clear-job
              onClick={clearJob}
              aria-label={t("connections.add.clearJob")}
              className="mari-connection-btn mari-connection-btn--ghost mari-connection-btn--icon"
            >
              <X size="0.875rem" aria-hidden />
            </button>
          </div>
        )}
        {builtInOffer && (
          <section data-add-connection-section="built-in-offer">
            <ListHeading className="px-0">{t("connections.add.section.noAccount")}</ListHeading>
            {serviceRow("local_model")}
          </section>
        )}
        {home && listJobs.length > 0 && (
          <section data-add-connection-section="missing-jobs">
            <ListHeading className="px-0">{t("connections.add.section.missingJobs")}</ListHeading>
            {listJobs.map((key) => {
              const Icon = JOB[key].icon;
              return (
                <ModelRow
                  rowProps={MODEL_ROW}
                  key={key}
                  title={jobLabel(key)}
                  subtitle={t(jobHintKey(JOB[key]))}
                  wrapTitle
                  tile={
                    <JobTile unset className={TILE}>
                      <Icon aria-hidden />
                    </JobTile>
                  }
                  data-add-connection-job-choice={key}
                  onClick={() => chooseJob(key)}
                  trailing={<span className="mari-connection-pill shrink-0">{t("connections.add.setUp")}</span>}
                />
              );
            })}
          </section>
        )}
        {home && ownAccounts.length > 0 && (
          <section data-add-connection-section="your-services">
            <ListHeading className="px-0">{t("connections.add.section.yourServices")}</ListHeading>
            {ownAccounts.map((account) => {
              const children = rows.filter((row) => row.accountId === account.id);
              return (
                <ServiceRow
                  className={ROW}
                  key={account.id}
                  account={account}
                  rows={children}
                  tile={
                    <ProviderIcon
                      provider={account.provider}
                      baseUrl={account.baseUrl}
                      name={account.name}
                      icon={account.icon}
                      imagePath={account.imagePath}
                      service={getConnectionIdentity(account, children).service}
                      size="add"
                    />
                  }
                  count={t("connections.add.accountModels", {
                    count: children.filter((row) => row.model?.trim()).length,
                  })}
                  data-add-connection-account={account.id}
                  onClick={() => {
                    setWant(null);
                    void showModelsOf(account.id);
                  }}
                  trailing={<ChevronRight size="1rem" aria-hidden />}
                />
              );
            })}
          </section>
        )}
        {listModels.length > 0 && (
          <section data-add-connection-section="model">
            <ListHeading className="px-0">{t("connections.add.section.model")}</ListHeading>
            {listModels.flatMap((entry) => {
              const { mine, services } = routesOf(entry);
              return [
                ...mine.map(([accountId, model]) => (
                  <ModelRow
                    rowProps={MODEL_ROW}
                    key={`${entry.key}:${accountId}`}
                    title={entry.name}
                    kind={entry.kind}
                    subtitle={accounts?.find((account) => account.id === accountId)?.name}
                    tile={<ModelTile model={model} size="add" />}
                    data-add-model={entry.key}
                    data-add-model-account={accountId}
                    onClick={() => {
                      setWant({ model, kind: entry.kind });
                      void showModelsOf(accountId, undefined, entry.kind);
                    }}
                    trailing={<ChevronRight size="1rem" aria-hidden />}
                  />
                )),
                ...services.map(({ service: key, model }) => (
                  <ModelRow
                    rowProps={MODEL_ROW}
                    key={`${entry.key}:${key}`}
                    title={entry.name}
                    kind={entry.kind}
                    subtitle={serviceName(key)}
                    tile={<ModelTile model={model} size="add" />}
                    data-add-model={entry.key}
                    data-add-model-service={key}
                    onClick={() => {
                      setWant({ model, kind: entry.kind });
                      void chooseService(key);
                    }}
                    trailing={<ChevronRight size="1rem" aria-hidden />}
                  />
                )),
              ];
            })}
          </section>
        )}
        {home && !searching && (
          <section data-add-connection-section="new-service">
            <ListHeading className="px-0">{t("connections.add.section.newService")}</ListHeading>
            <ModelRow
              rowProps={MODEL_ROW}
              title={t("connections.add.chooseService")}
              subtitle={t("connections.add.chooseServiceHint")}
              tile={
                <IconTile size="add">
                  <Plus size="1.125rem" aria-hidden />
                </IconTile>
              }
              data-add-connection-browse
              onClick={() => setPick("provider")}
              trailing={<ChevronRight size="1rem" aria-hidden />}
            />
          </section>
        )}
        {groups.map((group) => (
          <section key={group.id} data-add-connection-group={group.id}>
            <ListHeading className="px-0">
              {t(`connections.add.${group.id === "popular" ? "popular" : `group.${group.id}`}`)}
            </ListHeading>
            {group.services.filter((key) => !(builtInOffer && key === "local_model")).map(serviceRow)}
          </section>
        ))}
        {searching &&
          groups.length === 0 &&
          listModels.length === 0 &&
          listJobs.length === 0 &&
          ownAccounts.length === 0 && (
            <div data-add-connection-no-match className="flex flex-col items-center gap-2 py-4 text-center">
              <ListStatus>{t("connections.add.noMatch", { query: query.trim() })}</ListStatus>
              <button type="button" onClick={() => void chooseService("custom")} className={SECONDARY_CLASS}>
                {t("connections.add.useCustom")}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
