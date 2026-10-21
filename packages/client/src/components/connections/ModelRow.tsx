// ──────────────────────────────────────────────
// ModelRow — the one model row of the Connections panel, the connection editor, the shared picker, the model
// picker, the Defaults box and the chat switcher. Name, kind, roles, status, cost and retirement all draw here;
// callers only choose the density and the end control (⋯, ›, ✓ and star). ModelTile is a saved Model's tile.
// ──────────────────────────────────────────────
import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { AudioLines, Film, ImageIcon, KeyRound, Power, Scale, UserCog, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  isChatProvider,
  type ConnectionAccountListItem,
  ConnectionModelCost,
  ModelCatalogPricing,
} from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { roleBadges, type ConnectionModelRow } from "../../lib/connection-groups";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import type { ModelKind } from "../../lib/connection-identity";
import type { ConnectionRowData } from "./ConnectionRow";
import { CostBadge, RetiringHint, costBadgeShows } from "./CostBadge";
import { ProviderIcon } from "./ProviderIcon";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

export type MenuAt = { x: number; y: number; keyboard: boolean };
export const menuAt = (event: MouseEvent<HTMLElement>): MenuAt => {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.right, y: rect.bottom, keyboard: event.detail === 0 };
};

/** A media Connection's service (ComfyUI, fal…), for its brand icon. */
export const mediaService = (
  row: Pick<
    ConnectionRowData,
    "imageService" | "imageGenerationSource" | "videoService" | "videoGenerationSource" | "audioSource"
  >,
) =>
  row.imageService ||
  row.imageGenerationSource ||
  row.videoService ||
  row.videoGenerationSource ||
  row.audioSource ||
  null;

export const MEDIA_KIND: Record<string, "image" | "video" | "audio"> = {
  image_generation: "image",
  video_generation: "video",
  audio: "audio",
};
/** A Model's role labels: chat roles, or a media kind's Default and Fallback. */
export function modelRoleLabels(row: ConnectionModelRow, t: TFunction): string[] {
  const media = !!row.provider && row.provider in MEDIA_KIND;
  return [
    ...(isChatProvider(row.provider)
      ? roleBadges(row)
          .filter((role) => role !== "random")
          .map((role) => t(`connections.switcher.role.${role}`))
      : []),
    ...(media && isConnectionFlagTrue(row.defaultForAgents) ? [t("connections.accounts.badge.default")] : []),
    ...(media && isConnectionFlagTrue(row.fallbackForAgents) ? [t("connections.switcher.role.fallback")] : []),
  ];
}

const KIND_PILL: Record<Exclude<ModelKind, "chat">, { icon: LucideIcon; label: string }> = {
  image: { icon: ImageIcon, label: "connections.accounts.kind.image" },
  video: { icon: Film, label: "connections.accounts.kind.video" },
  voice: { icon: AudioLines, label: "connections.add.kind.voice" },
  decision: { icon: Scale, label: "connections.decision.label" },
};

type DataAttributes = { [key: `data-${string}`]: string | boolean | undefined };

/**
 * The one model row: line 1 tile, name, one role badge and "+N"; line 2 the kind pill (not for chat), the model id
 * and the custom-settings glyph, with the cost badge under the role badge. `trailing` sits inside the row button (› or ✓); `end` holds sibling controls
 * (⋯, star, fix), so no button nests in another. `onPictureClick` turns the tile into its own button.
 */
export function ModelRow({
  tile,
  title,
  tooltip,
  subtitle,
  kind,
  roles = [],
  roleSlots = 2,
  badgesBelow = false,
  status,
  customized = false,
  facts,
  showPaid = false,
  details,
  lead,
  current = false,
  dim = false,
  trailing,
  end,
  onPictureClick,
  pictureLabel,
  rowProps,
  className,
  ...button
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> &
  DataAttributes & {
    tile: ReactNode;
    title: string;
    /** The name's tooltip; the name by default. */
    tooltip?: string;
    subtitle?: string | null;
    /** Chat shows no pill. */
    kind?: ModelKind | null;
    /** Localized role labels; the first shows, the rest fold into "+N". */
    roles?: readonly string[];
    /** How many role names show before the rest fold into "+N". */
    roleSlots?: 1 | 2;
    /** The role and cost badges on a third line under the text instead of a column at the row end (folder view). */
    badgesBelow?: boolean;
    /** Why it cannot run now (its Connection needs a key or is off…); replaces the role badge. */
    status?: { label: string; state?: string } | null;
    customized?: boolean;
    /** The model's catalog facts: its cost badge (CostBadge decides whether it shows; a known price replaces
     * "Paid") and, when the provider retires it, a quiet amber hint on line 2. */
    facts?: {
      cost?: ConnectionModelCost | null;
      pricing?: ModelCatalogPricing;
      deprecated?: boolean;
      retiresAt?: string;
    } | null;
    showPaid?: boolean;
    /** More facts after the model id on line 2 (context size…). */
    details?: ReactNode;
    /** Before the tile inside the row button, such as a Defaults role name. */
    lead?: ReactNode;
    current?: boolean;
    dim?: boolean;
    trailing?: ReactNode;
    end?: ReactNode;
    /** Opens the picture menu at the tile. */
    onPictureClick?: (at: MenuAt) => void;
    pictureLabel?: string;
    rowProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
  }) {
  const { t } = useTranslation();
  const copyId = useId();
  const pill = kind && kind !== "chat" ? KIND_PILL[kind] : null;
  const cost = facts?.cost ?? undefined;
  const pricing = facts?.pricing;
  const retiring = facts?.deprecated || facts?.retiresAt ? facts : null;
  // Two role names fit; only a third or more folds into "+N" (a tooltip alone would hide them on touch).
  const rest = roles.slice(roleSlots);
  const id = subtitle && subtitle.trim().toLowerCase() !== title.trim().toLowerCase() ? subtitle : null;
  const line2 = !!(pill || id || details || retiring || customized);
  // CostBadge's own rule, so the third line never shows empty.
  const costShown = useUIStore((s) => s.showCostBadges) && costBadgeShows(cost, showPaid, pricing);
  // Role or status, as before: a status (Needs key, Off) replaces the role badge.
  const badge = status ? (
    <span
      data-connection-role
      className={cn("mari-connection-pill shrink-0", status.state === "needs_key" && "mari-connection-pill--warn")}
    >
      {status.state === "needs_key" ? (
        <KeyRound size="0.5625rem" />
      ) : status.state === "off" ? (
        <Power size="0.5625rem" />
      ) : null}
      {status.label}
    </span>
  ) : roles.length > 0 ? (
    <span data-connection-role className="flex shrink-0 items-center gap-1" title={roles.join(", ")}>
      <span className="mari-connection-pill mari-connection-pill--strong">{roles[0]}</span>
      {roleSlots > 1 && roles[1] && <span className="mari-connection-pill">{roles[1]}</span>}
      {rest.length > 0 && (
        <span className="mari-connection-pill">
          <span aria-hidden>+{rest.length}</span>
          <span className="sr-only">{t("connections.row.moreRoles", { roles: rest.join(", ") })}</span>
        </span>
      )}
    </span>
  ) : null;
  return (
    <div
      {...rowProps}
      className={cn(
        "mari-connection-model group relative flex min-w-0 items-center gap-1 pe-1 transition-colors hover:bg-foreground/[0.04]",
        current && "bg-foreground/[0.06]",
        rowProps?.className,
      )}
    >
      {current && (
        <span
          aria-hidden
          className="mari-panel-gradient--connections pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--mari-panel-gradient-start)]"
        />
      )}
      {onPictureClick && (
        <button
          type="button"
          onClick={(event) => onPictureClick(menuAt(event))}
          aria-label={pictureLabel}
          title={pictureLabel}
          className={cn("ms-2 flex min-h-11 shrink-0 items-center justify-center rounded-lg", FOCUS)}
        >
          {tile}
        </button>
      )}
      <button
        type="button"
        {...button}
        aria-describedby={
          [button["aria-label"] ? copyId : null, button["aria-describedby"]].filter(Boolean).join(" ") || undefined
        }
        className={cn(
          // Text starts 3.25rem in: tile 0.5rem in and 2rem wide, then 0.75rem, with or without the picture button.
          "mari-connection-model-choice flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 ps-2 text-left focus-visible:ring-inset disabled:cursor-not-allowed",
          FOCUS,
          className,
        )}
      >
        {lead}
        {!onPictureClick && tile}
        <span id={copyId} data-connection-model-copy className="min-w-0 flex-1">
          <span
            data-model-title
            className={cn(
              "block min-w-0 truncate text-[0.8125rem] font-semibold leading-5",
              dim ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]",
            )}
            title={tooltip ?? title}
          >
            {title}
          </span>
          {line2 && (
            // A retiring hint that does not fit next to the id wraps to its own line, so a narrow row keeps the id readable.
            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs leading-[1.125rem] text-[var(--muted-foreground)]">
              <span className="flex min-w-0 max-w-full grow items-center gap-1.5">
                {pill && (
                  <span data-connection-type className="mari-connection-pill">
                    <pill.icon size="0.6875rem" aria-hidden />
                    {t(pill.label)}
                  </span>
                )}
                {id && (
                  <span className="min-w-0 truncate tabular-nums" title={id}>
                    {id}
                  </span>
                )}
                {/* Custom settings: a quiet person-and-gear mark right after the model id it adjusts; hover names it. */}
                {customized && (
                  <span data-model-customized title={t("connections.row.customSettings")} className="flex shrink-0">
                    <UserCog size="0.6875rem" aria-hidden />
                    <span className="sr-only">{t("connections.row.customSettings")}</span>
                  </span>
                )}
                {details}
              </span>
              {retiring && (
                <span className="flex shrink-0">
                  <RetiringHint deprecated={retiring.deprecated} retiresAt={retiring.retiresAt} />
                </span>
              )}
            </span>
          )}
          {badgesBelow && (badge || costShown) && (
            <span data-connection-badges className="mt-1 flex flex-wrap items-center gap-1">
              {badge}
              <CostBadge cost={cost} showPaid={showPaid} pricing={pricing} />
            </span>
          )}
        </span>
        {/* Badges: one column at the row end. Line 1 says what the model does (role or status), line 2 what it
            costs, each on its text line; a row with one text line and no cost keeps the role centred. */}
        {!badgesBelow && (badge || cost) && (
          <span data-connection-badges className="flex shrink-0 flex-col items-end">
            <span className={cn("flex items-center", (line2 || cost) && "min-h-5")}>{badge}</span>
            {(line2 || cost) && (
              <span className="mt-0.5 flex min-h-[1.125rem] items-center">
                <CostBadge cost={cost} showPaid={showPaid} pricing={pricing} />
              </span>
            )}
          </span>
        )}
        {trailing}
      </button>
      {end}
    </div>
  );
}

/** A model's tile: its Connection's service logo (a media Connection's own service), or the saved Model's own
 * picture. `model` names a catalog model when it differs from the saved Model or there is none. */
export function ModelTile({
  row,
  account,
  model,
  dim,
}: {
  row?: ConnectionModelRow & Parameters<typeof mediaService>[0] & { baseUrl?: string | null };
  account?: Pick<ConnectionAccountListItem, "provider" | "baseUrl" | "name"> | null;
  model?: string | null;
  dim?: boolean;
}) {
  return (
    <ProviderIcon
      provider={row?.provider === "decision" ? row.provider : (account?.provider ?? row?.provider ?? "custom")}
      baseUrl={account?.baseUrl ?? row?.baseUrl}
      service={row && mediaService(row)}
      model={model ?? row?.model}
      name={account?.name ?? row?.name ?? undefined}
      icon={row?.icon}
      imagePath={row?.imagePath}
      size="row"
      dim={dim}
    />
  );
}
