import { useEffect, useId, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PULL_ICON_SIZE, type PullDropVisuals } from "../../hooks/use-pull-to-open-omnibar";
import { useMariAppearancePack } from "../../hooks/use-mari-appearance-pack";
import type { MariEdgeGlow } from "../../lib/mari-presence-seen";
import type { OmnibarTranslate } from "../../lib/omnibar-entity-rows";
/**
 * The pull-to-open sheet, its circle and small bar. Decorative only: the gesture
 * lives on the top bar and the opened dialog takes focus. The hook paints every
 * frame straight into these elements through `visuals.els`. `edgeGlow` is the top bar's
 * own edge state (R8), so the rim shares its colour.
 */
export function OmnibarPullDrop({ visuals, edgeGlow }: { visuals: PullDropVisuals; edgeGlow: MariEdgeGlow }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const appearance = useMariAppearancePack();
  const id = useId();
  const { els, target, armed, shown } = visuals;
  // Once per pull: the screen does not change under a finger that is pulling. The label is needed only once
  // the pull is armed, well after the small module has loaded.
  const [about, setAbout] = useState<string | null>(null);
  useEffect(() => {
    if (!shown) return setAbout(null);
    let live = true;
    void import("../../lib/mari-pull-about").then(({ readMariPullAbout }) => {
      if (live) setAbout(readMariPullAbout(queryClient, t as OmnibarTranslate));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  if (!shown) return null;
  const releaseToAskMari = about
    ? t("omnibar.pull.releaseAbout", "Release · {{about}}", { about })
    : t("omnibar.pull.releaseToAskMari", "Release to ask Prof. Mari");
  const label =
    target === "mari"
      ? armed
        ? releaseToAskMari
        : about
          ? t("omnibar.pull.askMariAbout", "Ask Prof. Mari · {{about}}", { about })
          : t("omnibar.pull.askMari", "Ask Prof. Mari")
      : armed
        ? t("omnibar.pull.releaseToSearch", "Release to search")
        : t("omnibar.pull.search", "Search");

  if (visuals.labelOnly) {
    return createPortal(
      <div aria-hidden="true" className="mari-pull-overlay">
        <div ref={(el) => void (els.chip = el)} className="mari-pull-lay mari-pull-chip">
          {target === "mari" ? (
            <img src={appearance.portraits.idle} alt="" draggable={false} className="mari-pull-chip-portrait" />
          ) : (
            <Search size={16} />
          )}
          <span>{label}</span>
        </div>
      </div>,
      document.body,
    );
  }

  // Armed, the label is one sentence on two lines: "Release", then what it does, smaller and softer.
  const releaseLines = (key: "about" | "mari" | "search", defaults: string) => (
    <Trans
      i18nKey={`omnibar.pull.releaseLines.${key}`}
      defaults={defaults}
      values={{ about }}
      components={{ soft: <span data-line="soft" /> }}
    />
  );
  const tagLabel = (side: "search" | "mari") =>
    side === "mari"
      ? [
          t("omnibar.pull.askMari", "Ask Prof. Mari"),
          about
            ? releaseLines("about", "Release <soft>{{about}}</soft>")
            : releaseLines("mari", "Release <soft>to ask Prof. Mari</soft>"),
        ]
      : [t("omnibar.pull.search", "Search"), releaseLines("search", "Release <soft>to search</soft>")];

  return createPortal(
    <div
      aria-hidden="true"
      className="mari-pull-overlay"
      data-armed={armed ? "true" : "false"}
      data-context={about ? "true" : "false"}
      data-mari-edge={edgeGlow ?? undefined}
    >
      <div ref={(el) => void (els.shadow = el)} className="mari-pull-shadow" />
      <div ref={(el) => void (els.glass = el)} className="mari-pull-glass" />
      <svg ref={(el) => void (els.rim = el)} className="mari-pull-rim">
        <defs>
          <clipPath id={`${id}clip`}>
            <path ref={(el) => void (els.rimClip = el)} />
          </clipPath>
          {/* The shimmer takes the app's accent (it follows a theme change), or the top bar's edge state colours. */}
          <linearGradient ref={(el) => void (els.rimGrad = el)} id={`${id}rim`} gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: "var(--mari-pull-rim-color)" }} stopOpacity="0.2" />
            <stop offset="0.45" style={{ stopColor: "var(--mari-pull-rim-mid)" }} stopOpacity="0.75" />
            <stop offset="0.7" style={{ stopColor: "var(--mari-pull-rim-end)" }} stopOpacity="0.15" />
            <stop offset="1" style={{ stopColor: "var(--mari-pull-rim-color)" }} stopOpacity="0.45" />
          </linearGradient>
          {/* The rim fades in below the bar, so the sheet leaves the bar without a seam. */}
          <linearGradient
            ref={(el) => void (els.edgeGrad = el)}
            id={`${id}fade`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2="0"
          >
            <stop offset="0" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id={`${id}mask`} maskUnits="userSpaceOnUse" x="-20" y="-20" width="4000" height="4000">
            <rect x="-20" y="-20" width="4000" height="4000" fill={`url(#${id}fade)`} />
          </mask>
        </defs>
        <g mask={`url(#${id}mask)`}>
          <path ref={(el) => void (els.rimEdge = el)} className="mari-pull-rim-edge" />
          <path
            ref={(el) => void (els.rimHair = el)}
            clipPath={`url(#${id}clip)`}
            stroke={`url(#${id}rim)`}
            className="mari-pull-rim-hair"
          />
          <ellipse ref={(el) => void (els.ring = el)} className="mari-pull-rim-ring" />
        </g>
      </svg>
      <div ref={(el) => void (els.icon = el)} className="mari-pull-lay mari-pull-icon">
        <Search size={PULL_ICON_SIZE} strokeWidth={2.2} />
      </div>
      <div ref={(el) => void (els.portrait = el)} className="mari-pull-lay mari-pull-portrait">
        {/* 45b: she looks down at the screen while pulled; armed, she peers (or lights up when there is context). */}
        <span
          ref={(el) => void (els.head = el)}
          className="mari-pull-head"
          data-gaze="neutral"
          style={{ "--mari-pull-heads": `url("${appearance.portraits.pullHeads}")` } as CSSProperties}
        />
      </div>
      {/* M17: on landing her head grows into her sprite where she is in the pane (sized and moved by the hook). */}
      <div ref={(el) => void (els.morph = el)} className="mari-pull-lay mari-pull-morph">
        <span ref={(el) => void (els.morphSprite = el)} className="mari-pull-morph__sprite" />
        <span ref={(el) => void (els.morphPortrait = el)} className="mari-pull-morph__portrait">
          <img src={appearance.portraits.idle} alt="" draggable={false} />
        </span>
      </div>
      <div ref={(el) => void (els.tag = el)} className="mari-pull-lay mari-pull-tag">
        {(["search", "mari"] as const).map((side) => {
          const [idle, release] = tagLabel(side);
          return (
            <span
              key={side}
              ref={(el) => void (side === "mari" ? (els.tagMari = el) : (els.tagSearch = el))}
              className="mari-pull-tag-side"
            >
              <span data-part="idle">{idle}</span>
              <span data-part="armed">{release}</span>
            </span>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
