import { useEffect, useState } from "react";
import { ExternalLink, MapPinned, Swords, type LucideIcon } from "lucide-react";
import { APP_VERSION } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { Modal } from "../ui/Modal";
import { Trans, useTranslation as useUiTranslation } from "react-i18next";

export const WHATS_NEW_SEEN_VERSION_KEY = "marinara:whats-new:seen-version";

const RELEASES_URL = "https://github.com/Pasta-Devs/Marinara-Engine/releases";

type ReleaseHighlight = {
  id: string;
  label: ReleaseCopy;
  title: ReleaseCopy;
  description: ReleaseCopy;
  icon: LucideIcon;
  media?: Array<{
    url: string;
    alt: ReleaseCopy;
  }>;
};

type ReleaseStorySection = {
  id: string;
  copyKey: string;
  linkUrl?: string;
  media?: Array<{
    url: string;
    altKey: string;
    kind?: "image" | "video";
  }>;
};

type ReleaseAnnouncement = {
  headline: ReleaseCopy;
  intro?: ReleaseCopy;
  outro?: ReleaseCopy;
  highlights: ReleaseHighlight[];
  story?: ReleaseStorySection[];
};

type ReleaseCopy = string | { key: string };

function localizedCopy(key: string): ReleaseCopy {
  return { key };
}

// Add each release here before its version ships. Versions without a tailored
// entry still get a one-time update notice and a link to their full release.
const RELEASE_ANNOUNCEMENTS: Record<string, ReleaseAnnouncement> = {
  "2.4.3": {
    headline: localizedCopy("ui.modals.whatsnewmodal.release243.headline"),
    intro: localizedCopy("ui.modals.whatsnewmodal.release243.intro"),
    highlights: [],
    story: [
      {
        id: "inventory-tracker",
        copyKey: "ui.modals.whatsnewmodal.release243.paragraphs.inventoryTracker",
        media: [
          {
            url: "https://i.imgur.com/EhkASR2.png",
            altKey: "ui.modals.whatsnewmodal.release243.media.inventoryTrackerCatalog",
          },
          {
            url: "https://i.imgur.com/AmhEOED.png",
            altKey: "ui.modals.whatsnewmodal.release243.media.inventoryTrackerPanel",
          },
        ],
      },
      {
        id: "full-changelog",
        copyKey: "ui.modals.whatsnewmodal.release243.paragraphs.fullChangelog",
      },
      {
        id: "release-link",
        copyKey: "ui.modals.whatsnewmodal.release243.paragraphs.releaseLink",
        linkUrl: "https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v2.4.3",
      },
    ],
    outro: localizedCopy("ui.modals.whatsnewmodal.release243.outro"),
  },
  "2.4.2": {
    headline: localizedCopy("ui.modals.whatsnewmodal.release242.headline"),
    intro: localizedCopy("ui.modals.whatsnewmodal.release242.intro"),
    highlights: [],
    story: [
      {
        id: "home-widgets",
        copyKey: "ui.modals.whatsnewmodal.release242.paragraphs.homeWidgets",
        media: [
          {
            url: "/releases/2.4.2/home-widgets.mp4",
            altKey: "ui.modals.whatsnewmodal.release242.media.homeWidgets",
            kind: "video",
          },
          {
            url: "/releases/2.4.2/home-widgets-custom.mp4",
            altKey: "ui.modals.whatsnewmodal.release242.media.homeWidgetsCustom",
            kind: "video",
          },
        ],
      },
      {
        id: "home-navigator",
        copyKey: "ui.modals.whatsnewmodal.release242.paragraphs.homeNavigator",
        media: [
          {
            url: "/releases/2.4.2/home-navigator.mp4",
            altKey: "ui.modals.whatsnewmodal.release242.media.homeNavigator",
            kind: "video",
          },
        ],
      },
      {
        id: "handle-with-care",
        copyKey: "ui.modals.whatsnewmodal.release242.paragraphs.handleWithCare",
      },
      {
        id: "professor-mari-memories",
        copyKey: "ui.modals.whatsnewmodal.release242.paragraphs.professorMariMemories",
        media: [
          {
            url: "/releases/2.4.2/professor-mari-memories.png",
            altKey: "ui.modals.whatsnewmodal.release242.media.professorMariMemories",
          },
        ],
      },
      {
        id: "noodle-agent",
        copyKey: "ui.modals.whatsnewmodal.release242.paragraphs.noodleAgent",
        media: [
          {
            url: "/releases/2.4.2/noodle-agent.png",
            altKey: "ui.modals.whatsnewmodal.release242.media.noodleAgent",
          },
        ],
      },
      {
        id: "character-downloads",
        copyKey: "ui.modals.whatsnewmodal.release242.paragraphs.characterDownloads",
        media: [
          {
            url: "/releases/2.4.2/character-downloads.png",
            altKey: "ui.modals.whatsnewmodal.release242.media.characterDownloads",
          },
        ],
      },
      {
        id: "full-changelog",
        copyKey: "ui.modals.whatsnewmodal.release242.paragraphs.fullChangelog",
      },
      {
        id: "release-link",
        copyKey: "ui.modals.whatsnewmodal.release242.paragraphs.releaseLink",
        linkUrl: "https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v2.4.2",
      },
    ],
    outro: localizedCopy("ui.modals.whatsnewmodal.release242.outro"),
  },
  "2.4.1": {
    headline: localizedCopy("ui.modals.whatsnewmodal.release241.headline"),
    intro: localizedCopy("ui.modals.whatsnewmodal.release241.intro"),
    highlights: [],
  },
  "2.4.0": {
    headline: localizedCopy("ui.modals.whatsnewmodal.release240.headline"),
    highlights: [],
    story: [
      {
        id: "extensions",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.extensions",
      },
      {
        id: "personas",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.personas",
        media: [
          {
            url: "https://i.imgur.com/K4Z9rSA.png",
            altKey: "ui.modals.whatsnewmodal.release240.media.personasIcon",
          },
        ],
      },
      {
        id: "direct-editing",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.directEditing",
        media: [
          {
            url: "https://i.imgur.com/HI1lGvM.gif",
            altKey: "ui.modals.whatsnewmodal.release240.media.directEditingFirst",
          },
          {
            url: "https://i.imgur.com/FHh9LNz.gif",
            altKey: "ui.modals.whatsnewmodal.release240.media.directEditingSecond",
          },
        ],
      },
      {
        id: "drag-and-drop",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.dragAndDrop",
        media: [
          {
            url: "https://i.imgur.com/xnFqaJO.gif",
            altKey: "ui.modals.whatsnewmodal.release240.media.dragAndDrop",
          },
        ],
      },
      {
        id: "custom-parameters",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.customParameters",
        media: [
          {
            url: "https://i.imgur.com/NxRyymz.png",
            altKey: "ui.modals.whatsnewmodal.release240.media.customParameters",
          },
        ],
      },
      {
        id: "bulk-lorebooks",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.bulkLorebooks",
        media: [
          {
            url: "https://i.imgur.com/FkWaDdZ.gif",
            altKey: "ui.modals.whatsnewmodal.release240.media.bulkLorebooks",
          },
        ],
      },
      {
        id: "agent-intro",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.agentIntro",
      },
      {
        id: "world-maps",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.worldMaps",
        media: [
          {
            url: "https://i.imgur.com/Q7IGDN0.png",
            altKey: "ui.modals.whatsnewmodal.release240.media.worldMapsFirst",
          },
          {
            url: "https://i.imgur.com/a0N8bKP.png",
            altKey: "ui.modals.whatsnewmodal.release240.media.worldMapsSecond",
          },
        ],
      },
      {
        id: "storyboard",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.storyboard",
        media: [
          {
            url: "https://i.imgur.com/TFQddVx.png",
            altKey: "ui.modals.whatsnewmodal.release240.media.storyboardFirst",
          },
          {
            url: "https://i.imgur.com/zcqJuI2.jpeg",
            altKey: "ui.modals.whatsnewmodal.release240.media.storyboardSecond",
          },
        ],
      },
      {
        id: "long-term-memory",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.longTermMemory",
        media: [
          {
            url: "https://i.imgur.com/wVFQNbC.png",
            altKey: "ui.modals.whatsnewmodal.release240.media.longTermMemoryFirst",
          },
          {
            url: "https://i.imgur.com/3ymbbOm.png",
            altKey: "ui.modals.whatsnewmodal.release240.media.longTermMemorySecond",
          },
        ],
      },
      {
        id: "download-agents",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.downloadAgents",
      },
      {
        id: "fixes-and-qol",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.fixesAndQol",
      },
      {
        id: "thanks",
        copyKey: "ui.modals.whatsnewmodal.release240.paragraphs.thanks",
      },
    ],
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
        id: "hierarchical-maps",
        label: "New Agent",
        title: "Hierarchical Maps",
        description:
          "Adds persistent hierarchical locations, spatial context, map authoring, and movement to Roleplay and Game modes.",
        icon: MapPinned,
      },
      {
        id: "tactical-combat",
        label: "New Feature",
        title: "Tactical Combat Mode in Games",
        description:
          "Completely new way to handle battles in game mode, inspired by the Fire Emblem series, with a grid, movements, terrain and forecasts.",
        icon: Swords,
        media: [
          {
            url: "https://i.imgur.com/tMhfbej.jpeg",
            alt: "Tactical Combat Mode battlefield with a terrain grid, units, and battle controls",
          },
        ],
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
  const releaseCopy = (copy: ReleaseCopy) => (typeof copy === "string" ? copy : localizeUi(copy.key));

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
      width="max-w-3xl"
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
            <span className="inline-flex rounded-full border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[var(--marinara-chat-chrome-button-text-active)]">
              {localizeUi("ui.characters.metadatatab.version")} {APP_VERSION}
            </span>
            <h3
              data-release-copy
              className="mt-3 text-balance text-2xl font-bold tracking-tight text-[var(--marinara-chat-chrome-panel-title)] sm:text-3xl"
            >
              {releaseCopy(announcement.headline)}
            </h3>
            {announcement.intro ? (
              <p data-release-copy className="mt-2 text-sm leading-6 text-[var(--marinara-chat-chrome-panel-muted)]">
                {releaseCopy(announcement.intro)}
              </p>
            ) : null}
          </header>

          {announcement.story?.length ? (
            <div className="space-y-6" data-release-story={APP_VERSION}>
              {announcement.story.map((section) => (
                <section key={section.id} className="space-y-3">
                  <p data-release-copy className="text-sm leading-6 text-[var(--marinara-chat-chrome-panel-muted)]">
                    {section.linkUrl ? (
                      <a
                        href={section.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-[var(--marinara-chat-chrome-accent)] underline decoration-current/40 underline-offset-2 hover:decoration-current"
                      >
                        {localizeUi(section.copyKey)}
                      </a>
                    ) : (
                      <Trans
                        i18nKey={section.copyKey}
                        components={{
                          strong: <strong className="font-semibold text-[var(--marinara-chat-chrome-panel-title)]" />,
                          env: (
                            <code className="rounded bg-[var(--marinara-chat-chrome-highlight-bg)] px-1 py-0.5 text-[0.8125rem] text-[var(--marinara-chat-chrome-highlight-text)]" />
                          ),
                        }}
                      />
                    )}
                  </p>
                  {section.media?.length ? (
                    <div className="grid grid-cols-1 gap-3" data-release-media-group={section.id}>
                      {section.media.map((media) =>
                        media.kind === "video" ? (
                          <video
                            key={media.url}
                            src={media.url}
                            aria-label={localizeUi(media.altKey)}
                            autoPlay
                            controls
                            loop
                            muted
                            playsInline
                            preload="metadata"
                            data-release-media-kind="video"
                            className="mx-auto max-h-[30rem] w-full rounded-xl border border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--marinara-chat-chrome-highlight-bg)] object-contain shadow-sm"
                          />
                        ) : (
                          <img
                            key={media.url}
                            src={media.url}
                            alt={localizeUi(media.altKey)}
                            loading="lazy"
                            data-release-media-kind="image"
                            className="mx-auto max-h-[30rem] w-full rounded-xl border border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--marinara-chat-chrome-highlight-bg)] object-contain shadow-sm"
                          />
                        ),
                      )}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          ) : null}

          {announcement.highlights.length > 0 ? (
            <div className="divide-y divide-[var(--marinara-chat-chrome-panel-divider)] border-y border-[var(--marinara-chat-chrome-panel-divider)]">
              {announcement.highlights.map((highlight) => {
                const HighlightIcon = highlight.icon;
                return (
                  <article key={highlight.id} className="py-4">
                    <div className="flex gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]">
                        <HighlightIcon size="1.25rem" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[var(--marinara-chat-chrome-accent)]">
                          {releaseCopy(highlight.label)}
                        </p>
                        <h4 className="mt-1 text-base font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                          {releaseCopy(highlight.title)}
                        </h4>
                        <p className="mt-1 text-sm leading-5 text-[var(--marinara-chat-chrome-panel-muted)]">
                          {releaseCopy(highlight.description)}
                        </p>
                      </div>
                    </div>
                    {highlight.media?.length ? (
                      <div
                        className={`mt-3 grid gap-3 ${highlight.media.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}
                      >
                        {highlight.media.map((media) => (
                          <img
                            key={media.url}
                            src={media.url}
                            alt={releaseCopy(media.alt)}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="mx-auto max-h-64 w-auto max-w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--marinara-chat-chrome-highlight-bg)] object-contain shadow-sm"
                          />
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}

          {announcement.outro ? (
            <p data-release-copy className="text-sm leading-6 text-[var(--marinara-chat-chrome-panel-muted)]">
              {releaseCopy(announcement.outro)}
            </p>
          ) : null}

          <footer className="sticky bottom-0 z-10 -mx-5 -mb-6 flex flex-col-reverse gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--marinara-chat-chrome-panel-bg)] px-5 py-3 shadow-[0_-10px_24px_rgba(0,0,0,0.12)] sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
            <a
              href={releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="mari-chrome-control min-h-10 justify-center px-4 py-2 text-sm"
            >
              {localizeUi("ui.modals.whatsnewmodal.viewRelease")}
              <ExternalLink size="0.875rem" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mari-chrome-control mari-chrome-control--primary min-h-10 justify-center px-5 py-2 text-sm"
            >
              {localizeUi("ui.modals.whatsnewmodal.gotIt")}
            </button>
          </footer>
        </div>
      </div>
    </Modal>
  );
}
