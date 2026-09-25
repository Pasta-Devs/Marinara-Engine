// A controlled choice inside the Engine wizard; legacy packages retain their separate setup dialog.
import { useState } from "react";
import { Gamepad2, Sparkles, Shuffle } from "lucide-react";
import type { InstalledCapabilityPackage } from "@marinara-engine/shared";
import { MAX_EXPERIENCE_SEED } from "../../lib/game-experience-setup";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { useTranslation as useUiTranslation } from "react-i18next";
const SECONDARY_BUTTON =
  "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:opacity-50";
export function NewGameExperienceChooser({
  experiences,
  activeId,
  onSelect,
  seed,
  onSeedChange,
  onRandomize,
  seedInvalid,
  launching,
}: {
  experiences: InstalledCapabilityPackage[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  seed: string;
  onSeedChange: (seed: string) => void;
  onRandomize: () => void;
  seedInvalid: boolean;
  launching: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setOpen] = useState(false);
  const open = expanded || Boolean(activeId);
  const activeExperience = experiences.find((experience) => experience.id === activeId);
  const openAgentCatalog = useUIStore((state) => state.openAgentCatalog);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--foreground)]">
              {localizeUi("ui.game.newgameexperiencechooser.experiences")}
            </p>
            <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {activeExperience
                ? localizeUi("game.experienceSetup.activeDescription", {
                    name: activeExperience.manifest.name,
                  })
                : localizeUi("game.experienceSetup.description")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          disabled={launching || Boolean(activeId)}
          className={SECONDARY_BUTTON}
        >
          <Sparkles size={13} />
          {open ? localizeUi("ui.noodle.stageprofileview.hide") : localizeUi("ui.chat.hiddenfromaimessagesummary.show")}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          {experiences.length > 0 ? (
            experiences.map((exp) => {
              const isActive = exp.id === activeId;
              return (
                // Same row+switch the host uses for its own on/off options ("customize parameters").
                <div key={exp.id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    disabled={launching}
                    onClick={() => {
                      setOpen(true);
                      onSelect(isActive ? null : exp.id);
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:cursor-wait disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-medium text-[var(--foreground)]">{exp.manifest.name}</span>
                      <span className="line-clamp-2 block text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                        {exp.manifest.description}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        isActive ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white transition-transform",
                          isActive && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                  {isActive && exp.manifest.contributions?.gameSurface?.setup?.seed && (
                    <div className="mt-2 flex flex-wrap items-end gap-2 px-1">
                      <label className="min-w-0 flex-1 text-xs text-[var(--foreground)]">
                        {exp.manifest.contributions.gameSurface.setup.seed.label ||
                          localizeUi("game.experienceSetup.seed")}
                        <input
                          type="number"
                          step={1}
                          min={0}
                          max={MAX_EXPERIENCE_SEED}
                          value={seed}
                          onChange={(event) => onSeedChange(event.target.value)}
                          disabled={launching}
                          aria-invalid={seedInvalid}
                          className="mt-1 block min-h-11 w-full rounded-lg bg-[var(--secondary)] px-3 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]"
                        />
                      </label>
                      <button type="button" className={SECONDARY_BUTTON} disabled={launching} onClick={onRandomize}>
                        <Shuffle size={13} />
                        {localizeUi("game.experienceSetup.randomize")}
                      </button>
                      {seedInvalid && (
                        <p role="alert" className="w-full text-xs text-[var(--destructive)]">
                          {localizeUi("game.experienceSetup.invalidSeed", { max: MAX_EXPERIENCE_SEED })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {localizeUi("ui.game.newgameexperiencechooser.noExperiencesDownloadedYet")}
              </p>
              <button
                type="button"
                onClick={() => openAgentCatalog()}
                disabled={launching}
                className={SECONDARY_BUTTON}
              >
                <Gamepad2 size={13} />
                {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
