import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { ListSearch, ListStatus } from "../../connections/ListFrame";
import { BrandMark } from "../../connections/ProviderIcon";
import {
  DECISION_BUILTIN,
  LOCAL_PRESETS,
  SEARCH_ALIASES,
  SECONDARY_CLASS,
  SELF_HOSTED,
  SERVICE_GROUPS,
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

const TILE =
  "flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-left transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)]";

interface ServiceListStepProps {
  query: string;
  setQuery: (query: string) => void;
  chooseService: (service: ServiceId) => Promise<void>;
  choosePreset: (preset: { label: string; url: string }) => Promise<void>;
  openDecisionServer: () => void;
  serviceName: (service: ServiceId) => string;
}

/** Step 1: every place models come from, in sections: popular, subscriptions, on your computer, all. */
export function ServiceListStep({
  query,
  setQuery,
  chooseService,
  choosePreset,
  openDecisionServer,
  serviceName,
}: ServiceListStepProps) {
  const { t } = useTranslation();
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
    if (key === "custom" || (media && SELF_HOSTED.has(media.source))) return t("connections.add.tag.address");
    return null;
  };
  type Tile = { id: string; name: string; tag: string | null; icon: React.ReactNode; open: () => void; good?: boolean };
  const sections = SERVICE_GROUPS.map((group) => {
    const tiles: Tile[] = [];
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
        });
      // The common local servers follow the built-in model, as their own tiles.
      if (key === "local_model")
        for (const preset of LOCAL_PRESETS)
          if (matches(preset.label))
            tiles.push({
              id: preset.label,
              name: preset.label,
              tag: t("connections.add.tag.address"),
              icon: <BrandMark of={preset.label} className="h-6 w-6" />,
              open: () => void choosePreset(preset),
            });
    }
    if (group.sorted) tiles.sort((a, b) => a.name.localeCompare(b.name));
    return { id: group.id, tiles };
  }).filter((section) => section.tiles.length > 0);

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="flex flex-col gap-3 px-3 py-4">
        <ListSearch
          value={query}
          onChange={setQuery}
          label={t("connections.add.searchProviders")}
          placeholder={t("connections.add.searchProviders")}
        />
        {sections.map((section) => (
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
                    <strong className="text-sm font-medium [overflow-wrap:anywhere]">{tile.name}</strong>
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
        {sections.length === 0 && (
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
