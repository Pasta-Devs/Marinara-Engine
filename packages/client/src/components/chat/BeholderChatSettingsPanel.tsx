import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, Loader2, Settings2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { AgentSettingsActionButton } from "./AgentSettingsControls";

type Damage = "pristine" | "damaged" | "cracked" | "broken";
type WoundSeverity = "minor" | "serious" | "critical";

type BeholderSlotState = {
  worn?: Array<{ item: string; material?: string; color?: string; damage: Damage }>;
  holding?: { item: string; damage: Damage };
  wounds?: Array<{ text: string; severity: WoundSeverity; bleeding: boolean }>;
  bare?: boolean;
  missing?: boolean;
};

type BeholderStateResponse = {
  state: {
    characters: Array<{
      name: string;
      species?: string;
      body: Record<string, BeholderSlotState>;
    }>;
  };
  messageId: string | null;
  createdAt: string | null;
};

export default function BeholderChatSettingsPanel({
  chatId,
  onOpenAgentSettings,
}: {
  chatId: string;
  onOpenAgentSettings: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["beholder-state", chatId] as const, [chatId]);
  const stateQuery = useQuery({
    queryKey,
    queryFn: () => api.get<BeholderStateResponse>(`/agents/beholder-state/${encodeURIComponent(chatId)}`),
    staleTime: 30_000,
  });

  useEffect(() => {
    const handleGenerationComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId?: string }>).detail;
      if (detail?.chatId === chatId) void queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener("marinara:generation-complete", handleGenerationComplete);
    return () => window.removeEventListener("marinara:generation-complete", handleGenerationComplete);
  }, [chatId, queryClient, queryKey]);

  const characters = stateQuery.data?.state.characters ?? [];
  const damageLabel = (damage: Damage) => localizeUi(`ui.chat.beholder.damage.${damage}`);
  const severityLabel = (severity: WoundSeverity) => localizeUi(`ui.chat.beholder.severity.${severity}`);

  return (
    <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2.5">
      <div className="flex gap-2 rounded-lg bg-[var(--primary)]/8 px-2.5 py-2 ring-1 ring-[var(--primary)]/20">
        <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
        <p className="text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.beholder.sotaRecommendation")}
        </p>
      </div>

      <AgentSettingsActionButton
        onClick={onOpenAgentSettings}
        className="h-auto w-full justify-start px-2.5 py-2 text-left"
      >
        <Settings2 size="0.75rem" className="shrink-0 text-[var(--primary)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.625rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.beholder.configureAgent")}
          </span>
          <span className="block text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.beholder.configureAgentDescription")}
          </span>
        </span>
      </AgentSettingsActionButton>

      <section className="rounded-lg bg-[var(--background)]/65 p-2.5 ring-1 ring-[var(--border)]">
        <div className="mb-2 flex items-center gap-1.5">
          <Eye size="0.75rem" className="text-[var(--primary)]" />
          <h4 className="text-[0.625rem] font-semibold text-[var(--foreground)]">
            {localizeUi("ui.chat.beholder.latestState")}
          </h4>
        </div>

        {stateQuery.isLoading ? (
          <div className="flex items-center gap-1.5 py-1 text-[0.59375rem] text-[var(--muted-foreground)]">
            <Loader2 size="0.6875rem" className="animate-spin" />
            {localizeUi("ui.chat.beholder.loadingState")}
          </div>
        ) : stateQuery.isError ? (
          <p className="text-[0.59375rem] text-[var(--destructive)]">
            {localizeUi("ui.chat.beholder.stateUnavailable")}
          </p>
        ) : characters.length === 0 ? (
          <p className="text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.beholder.emptyState")}
          </p>
        ) : (
          <div className="space-y-2">
            {characters.map((character) => (
              <div key={character.name} className="rounded-md bg-[var(--secondary)]/65 px-2 py-1.5">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-[0.625rem] font-semibold text-[var(--foreground)]">{character.name}</span>
                  {character.species ? (
                    <span className="text-[0.5625rem] text-[var(--muted-foreground)]">{character.species}</span>
                  ) : null}
                </div>
                <div className="mt-1 space-y-1">
                  {Object.entries(character.body).map(([slotName, slot]) => {
                    const details = [
                      ...(slot.missing ? [localizeUi("ui.chat.beholder.missing")] : []),
                      ...(slot.bare ? [localizeUi("ui.chat.beholder.bare")] : []),
                      ...(slot.worn ?? []).map((item) =>
                        localizeUi("ui.chat.beholder.wearingValue", {
                          value: [
                            item.color,
                            item.material,
                            item.item,
                            item.damage !== "pristine" ? damageLabel(item.damage) : null,
                          ]
                            .filter(Boolean)
                            .join(" "),
                        }),
                      ),
                      ...(slot.holding
                        ? [
                            localizeUi("ui.chat.beholder.holdingValue", {
                              value: `${slot.holding.item}${
                                slot.holding.damage !== "pristine" ? ` (${damageLabel(slot.holding.damage)})` : ""
                              }`,
                            }),
                          ]
                        : []),
                      ...(slot.wounds ?? []).map((wound) =>
                        localizeUi("ui.chat.beholder.woundValue", {
                          value: wound.text,
                          severity: severityLabel(wound.severity),
                          bleeding: wound.bleeding ? localizeUi("ui.chat.beholder.bleedingSuffix") : "",
                        }),
                      ),
                    ];
                    return (
                      <div key={slotName} className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-1.5 text-[0.5625rem]">
                        <span className="capitalize text-[var(--muted-foreground)]">
                          {slotName.replaceAll("_", " ")}
                        </span>
                        <span className="min-w-0 text-[var(--foreground)]/85">{details.join(" · ")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
