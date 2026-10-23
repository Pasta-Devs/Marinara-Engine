import { useTranslation } from "react-i18next";
import {
  inferImageSource,
  inferVideoSource,
  isChatProvider as isProviderChat,
  PROVIDERS,
  type APIProvider,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import { useCachedCatalogFacts } from "../../../hooks/use-connections";
import type { AddJob } from "../../../lib/add-connection";
import { JOBS } from "../../../lib/connection-jobs";
import { keysOf, modelKey, popularModels, searchModels, withOwnConnections } from "../../../lib/add-model-search";
import type { ModelEntry, ModelKind } from "../../../lib/add-model-search";
import {
  DECISION_BUILTIN,
  IMAGE_VENDOR,
  JOB_PROVIDER,
  LINKAPI_SERVICE,
  MODELS_SHOWN,
  OFFLINE_MODELS,
  SEARCH_ALIASES,
  SERVICE_GROUPS,
  VIDEO_SOURCE_VENDOR,
  isDevice,
  isLinkApiUrl,
  jobSourceOf,
  kindsOf,
  mediaBackendOf,
  rowKind,
  type ChipKind,
  type ConnectionRowLite,
  type ServiceId,
  type Target,
} from "./shared";

type Pick = "job" | "model" | "provider" | null;

interface UseServiceListDataProps {
  service: ServiceId | null;
  target: Target | null;
  accounts?: ConnectionAccountListItem[];
  rows: ConnectionRowLite[];
  accountRows: (accountId: string) => ConnectionRowLite[];
  kindFilter: ChipKind | null;
  query: string;
  pick: Pick;
  step: 1 | 2 | 3;
  job: AddJob | null;
  newChatMode?: string;
  deviceAvailable: (service: ServiceId) => boolean;
  deviceSetUp: (service: ServiceId) => boolean;
  serviceName: (service: ServiceId) => string;
  serviceHint: (service: ServiceId) => string;
  kindItems: (service: ServiceId) => Array<{ kind: ChipKind; label: string }>;
  jobLabel: (job: AddJob) => string;
}

export function useServiceListData(props: UseServiceListDataProps) {
  const { t } = useTranslation();
  const ownAccounts = (props.accounts ?? []).filter((account) => account.id !== props.target?.accountId);
  const accountRows = props.accountRows;
  const rowUsesMediaSource = (row: ConnectionRowLite, source: string) =>
    (row.provider === "image_generation" &&
      (row.imageGenerationSource || row.imageService || inferImageSource(row.model ?? "", row.baseUrl ?? "")) === source) ||
    (row.provider === "video_generation" &&
      (row.videoGenerationSource || row.videoService || inferVideoSource(row.model ?? "", row.baseUrl ?? "")) === source);

  const compatibleAccounts = (key: ServiceId) => {
    const media = mediaBackendOf(key);
    if (media?.job) {
      const provider = JOB_PROVIDER[media.job];
      return ownAccounts.filter((account) =>
        accountRows(account.id).some((row) => row.provider === provider && jobSourceOf(row) === media.source),
      );
    }
    if (media)
      return ownAccounts.filter(
        (account) =>
          accountRows(account.id).some((row) => rowUsesMediaSource(row, media.source)) ||
          (["image_generation", "video_generation"].includes(account.provider) &&
            account.baseUrl.replace(/\/+$/u, "") === media.defaultBaseUrl.replace(/\/+$/u, "")),
      );
    if (isDevice(key)) return [];
    if (key === LINKAPI_SERVICE)
      return ownAccounts.filter((account) => account.provider === "custom" && isLinkApiUrl(account.baseUrl));
    const providerKey = key as APIProvider;
    const imageSources = Object.entries(IMAGE_VENDOR)
      .filter(([, vendor]) => vendor === providerKey)
      .map(([source]) => source);
    const videoSources = Object.entries(VIDEO_SOURCE_VENDOR)
      .filter(([, vendor]) => vendor === providerKey)
      .map(([source]) => source);
    const sharesVendorOrigin = (accountUrl: string) => {
      try {
        return new URL(accountUrl).origin === new URL(PROVIDERS[providerKey].defaultBaseUrl).origin;
      } catch {
        return false;
      }
    };
    return ownAccounts.filter(
      (account) =>
        account.provider === providerKey ||
        (!isProviderChat(account.provider) &&
          sharesVendorOrigin(account.baseUrl) &&
          accountRows(account.id).some((row) =>
            [...imageSources, ...videoSources].some((source) => rowUsesMediaSource(row, source)),
          )),
    );
  };

  const connectedAccounts = props.service ? compatibleAccounts(props.service) : [];
  const connectedAccount = (service: ServiceId) => compatibleAccounts(service)[0];
  const badgesFor = (service: ServiceId) => {
    const badges: Array<{ label: string; highlight?: boolean }> = [];
    if (isDevice(service) && props.deviceSetUp(service))
      badges.push({ label: t("connections.add.badge.setUp"), highlight: true });
    else if (connectedAccount(service)) badges.push({ label: t("connections.add.badge.connected"), highlight: true });
    if (service === LINKAPI_SERVICE) badges.push({ label: t("connections.add.badge.sponsor"), highlight: true });
    if (isDevice(service) || service === DECISION_BUILTIN) badges.push({ label: t("connections.add.badge.builtIn") });
    const billing =
      service === LINKAPI_SERVICE
        ? "pay_per_use"
        : isDevice(service) || mediaBackendOf(service) || service === DECISION_BUILTIN
          ? undefined
          : PROVIDERS[service as APIProvider]?.billing;
    if (service === "nanogpt") badges.push({ label: t("connections.add.badge.planOrPay") });
    else if (billing) badges.push({ label: t(`connections.add.badge.${billing}`) });
    return badges.slice(0, 2);
  };

  const needle = props.query.trim().toLowerCase();
  const searching = needle.length > 0;
  const groups = SERVICE_GROUPS.map((group) => {
    const services = group.services.filter(
      (key) =>
        (!isDevice(key) || props.deviceAvailable(key)) &&
        (!props.kindFilter || kindsOf(key).includes(props.kindFilter)) &&
        (!searching ||
          [
            props.serviceName(key),
            props.serviceHint(key),
            SEARCH_ALIASES[key] ?? "",
            ...props.kindItems(key).map((item) => item.label),
          ].some((text) => text.toLowerCase().includes(needle))),
    );
    return {
      ...group,
      services: group.sorted
        ? services.sort(
            (a, b) =>
              Number(mediaBackendOf(b)?.job === props.kindFilter) - Number(mediaBackendOf(a)?.job === props.kindFilter) ||
              props.serviceName(a).localeCompare(props.serviceName(b)),
          )
        : services,
    };
  }).filter((group) => group.services.length > 0);

  const accounts = props.accounts ?? [];
  const ownCatalogs = useCachedCatalogFacts(
    accounts.map((account) =>
      props.rows.filter((row) => row.accountId === account.id && isProviderChat(row.provider ?? "")).map((row) => row.id),
    ),
  );
  const modelKind: ModelKind | null =
    props.kindFilter === "chat" || props.kindFilter === "image" || props.kindFilter === "video" ? props.kindFilter : null;
  const modelsOff = !!props.kindFilter && !modelKind;
  const modelIndex =
    props.step !== 1 || modelsOff
      ? []
      : withOwnConnections(
          OFFLINE_MODELS,
          accounts.map((account, index) => {
            const models = new Map<string, { id: string; kind: ModelKind }>();
            for (const row of accountRows(account.id)) {
              const kind = rowKind(row.provider);
              if (kind && row.model?.trim()) models.set(modelKey(row.model), { id: row.model, kind });
            }
            for (const ids of ownCatalogs[index]?.idSets ?? [])
              for (const [key, id] of keysOf(ids)) if (!models.has(key)) models.set(key, { id, kind: "chat" });
            return { accountId: account.id, models };
          }),
        );
  const shownModels = searching
    ? searchModels(modelIndex, needle, modelKind, MODELS_SHOWN)
    : popularModels(modelIndex, modelKind, props.pick === "model" ? MODELS_SHOWN : 4);
  const routesOf = (entry: ModelEntry) => {
    const mine = new Map<string, string>();
    const services: Array<{ service: ServiceId; model: string }> = [];
    for (const route of entry.routes) {
      if ("accountId" in route) {
        if (!mine.has(route.accountId)) mine.set(route.accountId, route.model);
        continue;
      }
      const have = compatibleAccounts(route.service as ServiceId);
      if (have.length === 0) services.push({ service: route.service as ServiceId, model: route.model });
      for (const account of have) if (!mine.has(account.id)) mine.set(account.id, route.model);
    }
    return { mine: [...mine], services };
  };
  const shownJobs = props.job
    ? []
    : JOBS.filter((entry) =>
        searching
          ? entry.add !== false && `${props.jobLabel(entry.key)} ${entry.terms ?? ""}`.toLowerCase().includes(needle)
          : entry.add === undefined,
      ).map((entry) => entry.key);
  const cards = props.step === 1 && !props.pick && !props.job && !props.newChatMode && !searching;
  const jobList = props.pick === "job" && !props.job;
  const listJobs = cards || props.pick ? [] : shownJobs;
  const listModels = cards || jobList || props.pick === "provider" ? [] : shownModels;
  const listGroups = cards || jobList || props.pick === "model" ? [] : groups;
  return { connectedAccounts, badgesFor, searching, groups, shownModels, routesOf, shownJobs, cards, jobList, listJobs, listModels, listGroups };
}
