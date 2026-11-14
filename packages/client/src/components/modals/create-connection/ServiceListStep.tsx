import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { cn } from "../../../lib/utils";
import { decisionCannotRun, useDecisionSidecar } from "../../../hooks/use-decision-sidecar";
import { useUIStore } from "../../../stores/ui.store";
import { ListSearch, ListStatus } from "../../connections/ListFrame";
import {
  DECISION_BUILTIN,
  isDevice,
  LOCAL_PRESETS,
  SEARCH_ALIASES,
  SECONDARY_CLASS,
  SELF_HOSTED,
  SERVICE_GROUPS,
  kindsOf,
  ServiceTile,
  mediaBackendOf,
  MUTED_BADGE_CLASS,
  type ChipKind,
  type ServiceId,
} from "./shared";

/** Tags that help a new user choose (free, offline, sign in) read green; plain facts stay grey. */
const GOOD_NEWS = new Set<ServiceId>([
  "local_model",
  "openrouter",
  "openai_chatgpt",
  "claude_subscription",
  "grok_subscription",
]);

/** The model types a tile offers, in chip and filter order (Text = chat). */
const TYPES = ["text", "image", "video", "voice"] as const;
type ModelType = (typeof TYPES)[number];
export const typesOf = (key: ServiceId): ModelType[] => {
  const kinds = kindsOf(key);
  return TYPES.filter((type) =>
    type === "text" ? kinds.includes("chat") || key === "local_model" : kinds.includes(type as never),
  );
};

const TILE =
  "flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-left transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)]";

interface ServiceListStepProps {
  query: string;
  setQuery: (query: string) => void;
  chooseService: (service: ServiceId) => Promise<void>;
  choosePreset: (preset: { label: string; url: string }) => Promise<void>;
  serviceName: (service: ServiceId) => string;
  /** The job's kind when the window adds for a job: the type filter starts on it. */
  kind?: ChipKind | null;
  /** New layout: the menu under "Add account" (type tabs, one-line rows by group) instead of the tile grid. */
  compact?: boolean;
}

/** Group headings for the compact menu, in SERVICE_GROUPS order. */
const GROUP_TITLES: Record<string, string> = {
  popular: "Recommended",
  plan: "Subscriptions",
  local: "Self-hosted",
  all: "Services A–Z",
};

/** Step 1: one provider list, filtered by search and model type. Engines on this device live in the This device card. */
export function ServiceListStep({
  query,
  setQuery,
  chooseService,
  choosePreset,
  serviceName,
  kind,
  compact = false,
}: ServiceListStepProps) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  // The compact menu has no "All" tab: it opens on Text, the usual reason to add an account.
  const [type, setType] = useState<ModelType | "all">(
    kind === "chat" ? "text" : kind === "decision" || !kind ? (compact ? "text" : "all") : kind,
  );
  const needle = query.trim().toLowerCase();
  const matches = (name: string, key?: ServiceId) =>
    !needle || `${name} ${key ? (SEARCH_ALIASES[key] ?? "") : ""}`.toLowerCase().includes(needle);
  const tagOf = (key: ServiceId) => {
    const media = mediaBackendOf(key);
    if (key === "local_model") return t("connections.add.tag.offline");
    if (key === "openrouter") return t("connections.add.tag.free");
    if (key === "openai_chatgpt" || key === "claude_subscription" || key === "grok_subscription")
      return t("connections.add.tag.signIn");
    if (media && SELF_HOSTED.has(media.source)) return t("connections.add.tag.selfHosted");
    return null;
  };
  type Tile = {
    id: string;
    name: string;
    tag: string | null;
    icon: React.ReactNode;
    open: () => void;
    good?: boolean;
    types: ModelType[];
    group?: string;
  };
  const tiles: Tile[] = [];
  // The Decision job can also run on this machine; the tile opens the built-in model's page, where it installs.
  const decision = useDecisionSidecar(kind === "decision");
  const builtInName = t("connections.add.device.local_model");
  if (kind === "decision" && decision.data && !decisionCannotRun(decision.data) && matches(builtInName)) {
    tiles.push({
      id: DECISION_BUILTIN,
      name: builtInName,
      tag: t("connections.accounts.section.device"),
      good: true,
      icon: <ServiceTile service="local_model" />,
      open: () => useUIStore.getState().openModal("device-detail", { item: "local-model" }),
      types: ["text"],
      group: "popular",
    });
  }
  for (const group of SERVICE_GROUPS) {
    const groupTiles: Tile[] = [];
    for (const key of group.services) {
      const name = serviceName(key);
      if (matches(name, key) && !isDevice(key) && key !== DECISION_BUILTIN)
        groupTiles.push({
          id: key,
          name,
          tag: tagOf(key),
          good: GOOD_NEWS.has(key),
          icon: <ServiceTile service={key} />,
          open: () => void chooseService(key),
          types: typesOf(key),
          group: group.id,
        });
      // The common local servers, as their own tiles.
      if (key !== "local_model") continue;
      for (const preset of LOCAL_PRESETS) {
        if (matches(preset.label))
          groupTiles.push({
            id: preset.label,
            name: preset.label,
            tag: t("connections.add.tag.selfHosted"),
            icon: <ServiceTile service="custom" baseUrl={preset.url} name={preset.label} />,
            open: () => void choosePreset(preset),
            types: ["text"],
            group: group.id,
          });
      }
    }
    if (group.sorted) groupTiles.sort((a, b) => a.name.localeCompare(b.name));
    tiles.push(...groupTiles);
  }
  // Typing searches every type; otherwise the filter (the compact menu's tab) picks one.
  const visible = tiles.filter((tile) => type === "all" || (compact && needle) || tile.types.includes(type));

  if (compact) {
    const groups = SERVICE_GROUPS.map((group) => ({
      id: group.id,
      tiles: visible.filter((tile) => tile.group === group.id),
    })).filter((group) => group.tiles.length > 0);
    return (
      <div className="ov-add-list">
        <div className="ov-add-list__top">
          <label className="ov-search">
            <Search size={14} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localize("Search services")}
              aria-label={t("connections.add.searchProviders")}
            />
          </label>
          {!needle && (
            <div className="ov-seg ov-add-list__tabs" role="tablist" aria-label={t("connections.add.kindFilter")}>
              {TYPES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={type === option}
                  className={cn(type === option && "is-on")}
                  onClick={() => setType(option)}
                >
                  {t(`connections.add.type.${option}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ov-add-list__body">
          {groups.map((group) => (
            <div key={group.id}>
              <h4 className="ov-add-list__group">{localize(GROUP_TITLES[group.id] ?? group.id)}</h4>
              {group.tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className="ov-add-list__row"
                  data-add-connection-service={tile.id}
                  onClick={tile.open}
                >
                  {tile.icon}
                  <span className="ov-add-list__name">{tile.name}</span>
                  {tile.tag && <span className={cn("ov-add-list__tag", tile.good && "is-good")}>{tile.tag}</span>}
                </button>
              ))}
            </div>
          ))}
          {visible.length === 0 && (
            <div data-add-connection-no-match className="ov-add-list__empty">
              <span>{t("connections.add.noMatch", { query: query.trim() })}</span>
              <button type="button" className="ov-btn" onClick={() => void chooseService("custom")}>
                {t("connections.add.useCustom")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="flex flex-col gap-3 px-3 py-4">
        <ListSearch
          value={query}
          onChange={setQuery}
          label={t("connections.add.searchProviders")}
          placeholder={t("connections.add.searchProviders")}
        />
        <div role="group" aria-label={t("connections.add.kindFilter")} className="flex flex-wrap gap-1.5">
          {(["all", ...TYPES] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={type === option}
              onClick={() => setType(option)}
              className="mari-connection-chip"
            >
              {t(`connections.add.type.${option}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className={TILE}
              data-add-connection-service={tile.id}
              onClick={tile.open}
            >
              {tile.icon}
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                  <span className="text-sm font-medium [overflow-wrap:anywhere]">{tile.name}</span>
                  {tile.tag && (
                    <span
                      className={cn(
                        "text-xs",
                        tile.good
                          ? "text-[color-mix(in_srgb,var(--color-emerald-500)_80%,var(--foreground)_20%)]"
                          : "text-[var(--muted-foreground)]",
                      )}
                    >
                      {tile.tag}
                    </span>
                  )}
                </span>
                {tile.types.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {tile.types.map((option) => (
                      <span key={option} className={MUTED_BADGE_CLASS}>
                        {t(`connections.add.type.${option}`)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        {visible.length === 0 && (
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
