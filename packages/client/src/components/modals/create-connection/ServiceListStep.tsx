import { useTranslation } from "react-i18next";
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

/** Step 1: every place models come from, as one grid of tiles. */
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
    if (key === "local_model" || key === "tts" || key === "stt") return t("connections.add.tag.device");
    if (key === "custom" || (media && SELF_HOSTED.has(media.source))) return t("connections.add.tag.address");
    return null;
  };
  const tiles: Array<{ id: string; name: string; tag: string | null; icon: React.ReactNode; open: () => void }> = [];
  for (const key of SERVICE_GROUPS.flatMap((group) => group.services)) {
    const name = serviceName(key);
    if (!matches(name, key)) continue;
    if (key === "custom") {
      // The local servers sit before the free-form address, as their own tiles.
      for (const preset of LOCAL_PRESETS) {
        if (matches(preset.label)) {
          tiles.push({
            id: preset.label,
            name: preset.label,
            tag: t("connections.add.tag.address"),
            icon: <BrandMark of={preset.label} className="h-6 w-6" />,
            open: () => void choosePreset(preset),
          });
        }
      }
    }
    tiles.push({
      id: key,
      name,
      tag: tagOf(key),
      icon: <ServiceTile service={key} />,
      open: () => (key === DECISION_BUILTIN ? openDecisionServer() : void chooseService(key)),
    });
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className={TILE}
              data-add-connection-service={tile.id}
              onClick={tile.open}
            >
              {tile.icon}
              <span className="flex min-w-0 flex-col">
                <strong className="truncate text-sm font-medium">{tile.name}</strong>
                {tile.tag && <span className="text-xs text-[var(--muted-foreground)]">{tile.tag}</span>}
              </span>
            </button>
          ))}
        </div>
        {tiles.length === 0 && (
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
