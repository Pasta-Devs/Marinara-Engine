import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { cn } from "../../../lib/utils";
import { ListSearch, ListStatus } from "../../connections/ListFrame";
import {
  DECISION_BUILTIN,
  LOCAL_PRESETS,
  SEARCH_ALIASES,
  SECONDARY_CLASS,
  SELF_HOSTED,
  SERVICE_GROUPS,
  kindsOf,
  ServiceTile,
  mediaBackendOf,
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

const SECTIONS = ["chat", "image", "voice", "decision"] as const;
type Section = (typeof SECTIONS)[number];

const TILE =
  "flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-left transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)]";

interface ServiceListStepProps {
  query: string;
  setQuery: (query: string) => void;
  chooseService: (service: ServiceId) => Promise<void>;
  choosePreset: (preset: { label: string; url: string }) => Promise<void>;
  openDecisionServer: () => void;
  serviceName: (service: ServiceId) => string;
  /** New layout: the menu under "Add account" (tabs by section, one-line rows by group) instead of the tile grid. */
  compact?: boolean;
}

/** Group headings for the compact menu, in SERVICE_GROUPS order. */
const GROUP_TITLES: Record<string, string> = {
  popular: "Recommended",
  plan: "Subscriptions",
  local: "Self-hosted",
  all: "Services A–Z",
};

/** Step 1: every place models come from, in sections by what they give: chat, images and video, voice, decisions. */
export function ServiceListStep({
  query,
  setQuery,
  chooseService,
  choosePreset,
  openDecisionServer,
  serviceName,
  compact = false,
}: ServiceListStepProps) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const [tab, setTab] = useState<Section>("chat");
  const needle = query.trim().toLowerCase();
  const matches = (name: string, key?: ServiceId) =>
    !needle || `${name} ${key ? (SEARCH_ALIASES[key] ?? "") : ""}`.toLowerCase().includes(needle);
  const tagOf = (key: ServiceId) => {
    const media = mediaBackendOf(key);
    if (key === "local_model") return t("connections.add.tag.offline");
    if (key === "openrouter") return t("connections.add.tag.free");
    if (key === "openai_chatgpt" || key === "claude_subscription" || key === "grok_subscription")
      return t("connections.add.tag.signIn");
    if (key === "tts" || key === "stt") return t("connections.add.tag.device");
    if (media && SELF_HOSTED.has(media.source)) return t("connections.add.tag.selfHosted");
    return null;
  };
  // Sections say what you get.
  const sectionOf = (key: ServiceId): Section => {
    if (key === "stt") return "voice";
    const kinds = kindsOf(key);
    return SECTIONS.find((s) => kinds.includes(s) || (s === "image" && kinds.includes("video"))) ?? "chat";
  };
  type Tile = {
    id: string;
    name: string;
    tag: string | null;
    icon: React.ReactNode;
    open: () => void;
    good?: boolean;
    group: string;
  };
  const sections = SECTIONS.map((id) => ({ id, tiles: [] as Tile[] }));
  for (const group of SERVICE_GROUPS) {
    const tiles: (Tile & { section: Section })[] = [];
    for (const key of group.services) {
      const name = serviceName(key);
      if (matches(name, key))
        tiles.push({
          id: key,
          name,
          tag: tagOf(key),
          good: GOOD_NEWS.has(key),
          icon: <ServiceTile service={key} />,
          open: () => (key === DECISION_BUILTIN ? openDecisionServer() : void chooseService(key)),
          section: sectionOf(key),
          group: group.id,
        });
      // The common local servers follow the built-in model, as their own tiles.
      if (key === "local_model")
        for (const preset of LOCAL_PRESETS)
          if (matches(preset.label))
            tiles.push({
              id: preset.label,
              name: preset.label,
              tag: t("connections.add.tag.selfHosted"),
              icon: <ServiceTile service="custom" baseUrl={preset.url} name={preset.label} />,
              open: () => void choosePreset(preset),
              section: "chat",
              group: group.id,
            });
    }
    if (group.sorted) tiles.sort((a, b) => a.name.localeCompare(b.name));
    for (const tile of tiles) sections.find((s) => s.id === tile.section)?.tiles.push(tile);
  }
  // Chat keeps the curated order; the smaller sections read best A–Z.
  for (const section of sections) if (section.id !== "chat") section.tiles.sort((a, b) => a.name.localeCompare(b.name));
  const shown = sections.filter((section) => section.tiles.length > 0);

  if (compact) {
    // Typing searches every section; otherwise the tab picks one.
    const list = needle ? shown : sections.filter((section) => section.id === tab);
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
            <div className="ov-seg ov-add-list__tabs" role="tablist">
              {SECTIONS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={cn(tab === id && "is-on")}
                  onClick={() => setTab(id)}
                >
                  {id === "image" ? localize("Images") : t(`connections.add.group.${id}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ov-add-list__body">
          {list.map((section) => {
            const groups = SERVICE_GROUPS.map((group) => ({
              id: group.id,
              tiles: section.tiles.filter((tile) => tile.group === group.id),
            })).filter((group) => group.tiles.length > 0);
            return (
              <section key={section.id}>
                {needle && <h3 className="ov-add-list__section">{t(`connections.add.group.${section.id}`)}</h3>}
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
              </section>
            );
          })}
          {list.every((section) => section.tiles.length === 0) && (
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
        {shown.map((section) => (
          <section key={section.id} aria-labelledby={`add-group-${section.id}`} className="flex flex-col gap-2">
            <h3
              id={`add-group-${section.id}`}
              className="px-0.5 pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]"
            >
              {t(`connections.add.group.${section.id}`)}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className={TILE}
                  data-add-connection-service={tile.id}
                  onClick={tile.open}
                >
                  {tile.icon}
                  <span className="flex min-w-0 flex-col">
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
                </button>
              ))}
            </div>
          </section>
        ))}
        {shown.length === 0 && (
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
