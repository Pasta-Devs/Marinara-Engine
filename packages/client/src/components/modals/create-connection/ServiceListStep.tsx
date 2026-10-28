import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { ListSearch, ListStatus } from "../../connections/ListFrame";
import { ServiceRow } from "../../connections/ServiceRow";
import { SECONDARY_CLASS, SEARCH_ALIASES, SERVICE_GROUPS, ServiceTile, type ServiceId } from "./shared";

/** Every row shares one inset and height, so the tiles and names line up. */
const ROW = "-mx-2 ps-2 md:min-h-[3.75rem] [&_strong]:font-medium";

interface ServiceListStepProps {
  query: string;
  setQuery: (query: string) => void;
  chooseService: (service: ServiceId) => Promise<void>;
  serviceName: (service: ServiceId) => string;
  serviceHint: (service: ServiceId) => string;
}

/** Step 1: every place models come from, in one list. */
export function ServiceListStep({ query, setQuery, chooseService, serviceName, serviceHint }: ServiceListStepProps) {
  const { t } = useTranslation();
  const needle = query.trim().toLowerCase();
  const services = SERVICE_GROUPS.flatMap((group) => group.services).filter(
    (key) => !needle || `${serviceName(key)} ${SEARCH_ALIASES[key] ?? ""}`.toLowerCase().includes(needle),
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="flex flex-col gap-3 px-3 py-4">
        <ListSearch
          value={query}
          onChange={setQuery}
          label={t("connections.add.searchProviders")}
          placeholder={t("connections.add.searchProviders")}
        />
        {services.map((key) => (
          <ServiceRow
            key={key}
            className={ROW}
            account={{ name: serviceName(key), provider: key }}
            rows={[]}
            tile={<ServiceTile service={key} />}
            hint={serviceHint(key)}
            data-add-connection-service={key}
            onClick={() => void chooseService(key)}
            trailing={<ChevronRight size="1rem" aria-hidden className="shrink-0 text-[var(--muted-foreground)]" />}
          />
        ))}
        {services.length === 0 && (
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
