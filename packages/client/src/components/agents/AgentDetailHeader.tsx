import type { ReactNode, Ref } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { OrganizerEntry } from "./organizer/organizer-model";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { AgentArtwork } from "./AgentArtwork";
import { StoreBanner } from "./organizer/OrganizerParts";

/**
 * The one header of every agent settings page: Back, store banner and logo, name, an optional
 * "author · version" line and actions. Downloaded agents show their store banner as the header,
 * with Back and actions on top and logo and name below; `compact` shrinks it to one row.
 */
export function AgentDetailHeader({
  storeEntry,
  compact = false,
  headerRef,
  onBack,
  title,
  meta,
  actions,
}: {
  storeEntry?: OrganizerEntry;
  compact?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  onBack: () => void;
  /** The name: a heading, or the editor's name field. */
  title: ReactNode;
  /** A short line under the name, such as "Pasta Devs · v1.5.15". */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const hasBanner = Boolean(storeEntry?.store?.bannerSmallUrl ?? storeEntry?.store?.bannerUrl);
  const iconUrl = storeEntry?.store?.iconUrl;
  const tall = hasBanner && !compact;
  return (
    <div
      ref={headerRef}
      className={cn(
        "mari-editor-header",
        hasBanner &&
          "relative isolate aspect-[16/7] w-full h-auto! max-h-[260px] content-between! border-b-0! bg-transparent! p-4! transition-[max-height] duration-300 motion-reduce:transition-none sm:aspect-[16/5]",
        compact && hasBanner && "max-h-[4.5rem] flex-nowrap! py-3!",
      )}
    >
      {hasBanner && storeEntry && (
        <>
          <div className="@container absolute inset-0 -z-10">
            {/* The tall header's max-h-[260px] at aspect 16/5 (16/7 below sm) caps it at 832px (594px) wide; past that, centre the
                artwork at that width and fade its sides, the fade growing from 0 with the spare width (100cqw - 100%) up to 15%. */}
            <StoreBanner
              entry={storeEntry}
              sizes="100vw"
              className={cn(
                "mx-auto h-full w-full rounded-none! shadow-none! [--fade:clamp(0px,100cqw_-_100%,15%)] [mask-image:linear-gradient(to_right,transparent,black_var(--fade),black_calc(100%_-_var(--fade)),transparent)] transition-[max-width] duration-300 motion-reduce:transition-none",
                tall ? "max-w-[832px] max-sm:max-w-[594px]" : "max-w-full",
              )}
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-[var(--marinara-editor-bg,var(--background))] to-transparent" />
        </>
      )}
      <button
        type="button"
        onClick={onBack}
        aria-label={localizeUi("ui.agents.agenteditor.backToAgents")}
        className={cn("mari-editor-action inline-flex", tall && "order-1")}
      >
        <ArrowLeft size="1.125rem" />
      </button>
      <div
        className={cn(
          "mari-editor-icon-tile",
          iconUrl && (compact && hasBanner ? "h-9! w-9! rounded-xl!" : "h-14! w-14! rounded-2xl!"),
          tall && "order-3",
          hasBanner && "bg-[var(--marinara-editor-bg,var(--background))]!",
        )}
      >
        {iconUrl ? (
          <span className="flex h-[70%] w-[70%]">
            <AgentArtwork imageUrl={iconUrl} alt="" iconSize="1.125rem" />
          </span>
        ) : (
          <Sparkles size="1.125rem" className="max-md:h-[0.875rem]! max-md:w-[0.875rem]!" />
        )}
      </div>
      <div className={cn("min-w-0 flex-1", tall && "order-3", hasBanner && "[text-shadow:0_1px_6px_rgb(0_0_0/0.6)]")}>
        {title}
        {meta && <p className="mari-editor-meta truncate">{meta}</p>}
      </div>
      {actions && (
        <div
          className={cn(
            "mari-editor-actions flex max-md:w-full max-md:justify-end max-md:border-t border-[var(--marinara-editor-divider)] max-md:pt-2",
            tall && "order-2",
            hasBanner && "ml-auto max-md:w-auto! max-md:border-t-0! max-md:pt-0!",
          )}
        >
          {actions}
        </div>
      )}
      {/* Breaks the banner header into a top row (Back, actions) and a bottom row (logo, name). */}
      {tall && <span className="order-2 basis-full" />}
    </div>
  );
}
