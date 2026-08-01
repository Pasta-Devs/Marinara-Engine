import { useEffect, useState } from "react";
import { ExternalLink, MapPinned, Swords, type LucideIcon } from "lucide-react";
import { APP_VERSION } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";

export const WHATS_NEW_SEEN_VERSION_KEY = "marinara:whats-new:seen-version";

const RELEASES_URL = "https://github.com/Pasta-Devs/Marinara-Engine/releases";

type ReleaseHighlight = {
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  imageUrl?: string;
  imageAlt?: string;
};

type ReleaseAnnouncement = {
  headline: string;
  intro?: string;
  highlights: ReleaseHighlight[];
};

// Add each release here before its version ships. Versions without a tailored
// entry still get a one-time update notice and a link to their full release.
const RELEASE_ANNOUNCEMENTS: Record<string, ReleaseAnnouncement> = {
  "2.4.0": {
    headline: "Broader horizons, finer control, stronger foundations.",
    intro:
      "Professor Mari here! This release adds Z.AI image generation, richer custom Agent context and image controls, smarter Roleplay animation planning, bulk history and summary tools, and four new documentation languages. It also strengthens extension and runtime security while polishing chat, card, model, gallery, and mobile behavior throughout the Engine.",
    highlights: [],
  },
  "2.3.5": {
    headline: "More control, polished down to the card.",
    intro:
      "Professor Mari here! This release adds custom quick replies, richer translation controls, Atlas image and video generation, interface localization, stronger update and extension protections, and a substantial collection of chat, card, launcher, image, and settings fixes. Character and Persona cards also keep their creator and version neatly beside the name, even when space is tight.",
    highlights: [],
  },
  "2.3.4": {
    headline: "A safer engine with finer control.",
    intro:
      "Professor Mari here! I removed Extensions, sealed their unsafe code path, and arranged for every old record to be cleared automatically. I also added new prompt macros, character-specific Hide From AI controls, and Grouped or Individual response handling for multi-character Conversations, then corrected a generous stack of smaller regressions. Every good experiment deserves a clean bench.",
    highlights: [],
  },
  "2.3.3": {
    headline: "We fixed the most glaring issues.",
    intro:
      "We’re sorry for the inconvenience caused by the last update. This release fixes the most disruptive Hierarchical Maps, Game message sending, Character library, and Accent Pulse problems, along with several smaller regressions.",
    highlights: [],
  },
  "2.3.2": {
    headline: "A quick patch with bug fixes!",
    highlights: [],
  },
  "2.3.1": {
    headline: "A quick patch with bug fixes!",
    highlights: [],
  },
  "2.3.0": {
    headline: "Choose the Agents you want.",
    intro:
      "We reworked how Agents work! You can now browse and install only the Agents you would like to use, then uninstall any you no longer want. Fresh installs start with no Agents, so be sure to head to Agents → Download Agents to get them!",
    highlights: [
      {
        label: "New Agent",
        title: "Hierarchical Maps",
        description:
          "Adds persistent hierarchical locations, spatial context, map authoring, and movement to Roleplay and Game modes.",
        icon: MapPinned,
      },
      {
        label: "New Feature",
        title: "Tactical Combat Mode in Games",
        description:
          "Completely new way to handle battles in game mode, inspired by the Fire Emblem series, with a grid, movements, terrain and forecasts.",
        icon: Swords,
        imageUrl: "https://i.imgur.com/tMhfbej.jpeg",
        imageAlt: "Tactical Combat Mode battlefield with a terrain grid, units, and battle controls",
      },
    ],
  },
};

const FALLBACK_ANNOUNCEMENT: ReleaseAnnouncement = {
  headline: "Marinara Engine has been updated.",
  intro: "Marinara Engine has been updated! Read the release notes for everything included in this version.",
  highlights: [],
};

function rememberAnnouncementWasShown() {
  try {
    window.localStorage.setItem(WHATS_NEW_SEEN_VERSION_KEY, APP_VERSION);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function hasSeenCurrentAnnouncement() {
  try {
    return window.localStorage.getItem(WHATS_NEW_SEEN_VERSION_KEY) === APP_VERSION;
  } catch {
    return false;
  }
}

export function WhatsNewModal({
  presentationAllowed,
  onOpenChange,
  onResolved,
}: {
  presentationAllowed: boolean;
  onOpenChange?: (open: boolean) => void;
  onResolved?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const hasCompletedOnboarding = useUIStore((state) => state.hasCompletedOnboarding);
  const [open, setOpen] = useState(false);
  const announcement = RELEASE_ANNOUNCEMENTS[APP_VERSION] ?? FALLBACK_ANNOUNCEMENT;
  const releaseUrl = `${RELEASES_URL}/tag/v${encodeURIComponent(APP_VERSION)}`;

  useEffect(() => {
    if (!presentationAllowed || !hasCompletedOnboarding) return;
    if (!hasSeenCurrentAnnouncement()) {
      // Record presentation immediately so closing the app without pressing a
      // button cannot make the same release announcement reappear next launch.
      rememberAnnouncementWasShown();
      setOpen(true);
    }
    onResolved?.();
  }, [hasCompletedOnboarding, presentationAllowed, onResolved]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={localizeUi("ui.modals.whatsnewmodal.whatSNew")}
      width="max-w-xl"
      mobileFullscreen
      panelClassName="overflow-hidden"
    >
      <div data-component="WhatsNewModal" className="-mx-5 -my-4">
        <div className="relative overflow-hidden border-b border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-5 pt-3">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-32 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--marinara-chat-chrome-accent)] opacity-10 blur-3xl"
          />
          <img
            src="/illustrations/professor-mari-whats-new.webp"
            alt={localizeUi("ui.modals.whatsnewmodal.professorMariWinkingAndWaving")}
            className="relative mx-auto h-44 w-auto max-w-full object-contain object-bottom drop-shadow-[0_12px_24px_rgba(0,0,0,0.28)] sm:h-52"
          />
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <header>
            <span className="inline-flex rounded-full border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[var(--marinara-chat-chrome-button-text-active)]">{localizeUi("ui.characters.metadatatab.version")} {APP_VERSION}
            </span>
            <h3 className="mt-3 text-balance text-2xl font-bold tracking-tight text-[var(--marinara-chat-chrome-panel-title)] sm:text-3xl">
              {announcement.headline}
            </h3>
            {announcement.intro ? (
              <p className="mt-2 text-sm leading-6 text-[var(--marinara-chat-chrome-panel-muted)]">
                {announcement.intro}
              </p>
            ) : null}
          </header>

          {announcement.highlights.length > 0 ? (
            <div className="divide-y divide-[var(--marinara-chat-chrome-panel-divider)] border-y border-[var(--marinara-chat-chrome-panel-divider)]">
              {announcement.highlights.map((highlight) => {
                const HighlightIcon = highlight.icon;
                return (
                  <article key={`${highlight.label}:${highlight.title}`} className="py-4">
                    <div className="flex gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]">
                        <HighlightIcon size="1.25rem" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[var(--marinara-chat-chrome-accent)]">
                          {highlight.label}
                        </p>
                        <h4 className="mt-1 text-base font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                          {highlight.title}
                        </h4>
                        <p className="mt-1 text-sm leading-5 text-[var(--marinara-chat-chrome-panel-muted)]">
                          {highlight.description}
                        </p>
                      </div>
                    </div>
                    {highlight.imageUrl ? (
                      <img
                        src={highlight.imageUrl}
                        alt={highlight.imageAlt ?? ""}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="mx-auto mt-3 max-h-36 w-auto max-w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-divider)] object-contain shadow-sm sm:max-h-44"
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}

          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <a
              href={releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="mari-chrome-control min-h-10 justify-center px-4 py-2 text-sm"
            >{localizeUi("ui.modals.whatsnewmodal.viewRelease")}<ExternalLink size="0.875rem" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mari-chrome-control mari-chrome-control--primary min-h-10 justify-center px-5 py-2 text-sm"
            >{localizeUi("ui.modals.whatsnewmodal.gotIt")}</button>
          </footer>
        </div>
      </div>
    </Modal>
  );
}
