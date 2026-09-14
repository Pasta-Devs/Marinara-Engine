// Installed game EXPERIENCES, offered as one block inside the setup wizard's first step. They are
// discovered from their manifest (the `game-surface` slot) by the WIZARD, which resolves the list and owns
// the selection, so no package is named here and this file stays presentational. Activating one no longer
// swaps the wizard body: the wizard stays where it is and the experience's own questions are drawn inside
// this block. The choice travels in the setup config.
import { useState, type ReactNode } from "react";
import { Gamepad2, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";
import { type InstalledCapabilityPackage } from "@marinara-engine/shared";

import { useUIStore } from "../../stores/ui.store";
import { useTranslation as useUiTranslation } from "react-i18next";

// Same treatment the wizard gives its own "import setup" button, so the block reads as part of the step.
const SECONDARY_BUTTON =
  "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:cursor-wait disabled:opacity-50";

/**
 * The Experiences block. Controlled: the wizard passes the resolved experiences, which one is active, and
 * whether the step is frozen mid-launch.
 */
export function NewGameExperienceChooser({
  experiences,
  activeId,
  onActiveIdChange,
  disabled,
  children,
}: {
  /** Installed, runtime-ready game-surface packages, resolved by the wizard. */
  experiences: InstalledCapabilityPackage[];
  /** The activated experience's id, or null when the built-in setup answers everything. */
  activeId: string | null;
  onActiveIdChange: (nextId: string | null) => void;
  /** The wizard's `isLoading`: freezes every control that could tear down a launch in flight. */
  disabled: boolean;
  /** The active experience's own questions, drawn by the host under the experience rows. */
  children?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);

  const activeExperience = experiences.find((e) => e.id === activeId) ?? null;
  // An active experience puts its own fields in here, so the region cannot be collapsed out from under
  // them: hiding a control the player still has to answer would hide the reason Start is refused.
  const expanded = open || activeId !== null;

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
                ? localizeUi("ui.game.newgameexperiencechooser.value1WillRunThisGameTurnItOffTo", {
                    value1: activeExperience.manifest.name,
                  })
                : localizeUi("ui.game.newgameexperiencechooser.runThisGameWithADownloadedExperienceInsteadOf")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={expanded}
          disabled={disabled || activeId !== null}
          className={SECONDARY_BUTTON}
        >
          <Sparkles size={13} />
          {expanded
            ? localizeUi("ui.noodle.stageprofileview.hide")
            : localizeUi("ui.chat.hiddenfromaimessagesummary.show")}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          {experiences.length > 0 ? (
            experiences.map((exp) => {
              const isActive = exp.id === activeId;
              return (
                // Same row+switch the host uses for its own on/off options ("customize parameters").
                <button
                  key={exp.id}
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  disabled={disabled}
                  onClick={() => onActiveIdChange(isActive ? null : exp.id)}
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
              );
            })
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {localizeUi("ui.game.newgameexperiencechooser.noExperiencesDownloadedYet")}
              </p>
              <button type="button" onClick={() => openAgentCatalog()} disabled={disabled} className={SECONDARY_BUTTON}>
                <Gamepad2 size={13} />
                {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
              </button>
            </div>
          )}
          {/* The active experience's declared fields (the world seed today), drawn under its own row. */}
          {activeExperience && children}
        </div>
      )}
    </div>
  );
}
