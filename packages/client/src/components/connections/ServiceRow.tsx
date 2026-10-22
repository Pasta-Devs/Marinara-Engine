// ──────────────────────────────────────────────
// ServiceRow — the one service (Connection account) row: its tile, its name and
// one line of facts ("556.44 left · 3 models · plan · host") with a problem word.
// The sidebar card head, the Move dialog, the Add window, the switcher and the
// pickers all draw it; callers only choose the density and the end slots.
// ──────────────────────────────────────────────
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ConnectionAccountState, ConnectionBilling } from "@marinara-engine/shared";
import { getConnectionIdentity, type ConnectionIdentityRow } from "../../lib/connection-identity";
import { cn } from "../../lib/utils";
import { StateWord, type EngineTone } from "./DeviceDetail";
import { FOCUS, menuAt, type MenuAt } from "./ModelRow";
import { ProviderIcon } from "./ProviderIcon";

const STATE_TONE: Record<ConnectionAccountState, EngineTone> = { ok: "ok", off: "off", needs_key: "warn" };

/**
 * The one service row. With `onClick` the row is a button, without it a plain heading.
 * `trailing` sits inside the row button (a chevron) and is never interactive; `end` holds
 * sibling controls (fix, ⋯ menu, fold) so no button nests in another. `md` is the sidebar
 * card head with the large tile; `sm` is the heading of a service inside a picker.
 */
export function ServiceRow({
  account,
  rows,
  count,
  state,
  stateLabel,
  billing,
  balance,
  tile,
  density = "md",
  hint,
  trailing,
  end,
  current = false,
  onPictureClick,
  className,
  onClick,
  ...button
}: {
  account: { name: string; provider: string; baseUrl?: string | null; icon?: string | null; imagePath?: string | null };
  rows: readonly ConnectionIdentityRow[];
  count?: ReactNode;
  state?: ConnectionAccountState;
  stateLabel?: string;
  billing?: ConnectionBilling;
  /** What is left on the account ("556.44 left"), first on line 2. */
  balance?: string | null;
  /** Replaces the service's own tile, such as the sidebar tile with the account picture. */
  tile?: ReactNode;
  density?: "md" | "sm";
  /** One plain line under the row that says what it does. */
  hint?: string;
  trailing?: ReactNode;
  end?: ReactNode;
  /** The page this row opens is the one on screen. */
  current?: boolean;
  /** Opens the picture menu at the tile, which becomes its own button. */
  onPictureClick?: (at: MenuAt) => void;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
    [key: `data-${string}`]: string | boolean | undefined;
  }) {
  const { t } = useTranslation();
  const hintId = useId();
  const md = density === "md";
  const identity = getConnectionIdentity(account, rows);
  // Line 2 is facts, never a second name: balance first (it survives the cut), count, plan word, host.
  const details = [identity.endpoint].filter(Boolean);
  const hasCount = count !== undefined && count !== null;
  // One card-level cost word: a plan, or a free service.
  const billingWord = billing ? t(`connections.list.billing.${billing}`) : null;
  // A healthy Connection shows no status; only a problem shows its word.
  const problem = state && state !== "ok" && stateLabel ? { state, label: stateLabel } : null;
  // A heading row takes only data-* props; button state (aria-pressed, disabled, tabIndex) never lands on a div.
  const dataProps = Object.fromEntries(Object.entries(button).filter(([key]) => key.startsWith("data-")));
  const describedBy = [hint ? hintId : null, button["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  const tileNode = tile ?? (
    <ProviderIcon
      provider={account.provider}
      baseUrl={account.baseUrl}
      service={identity.service}
      name={account.name}
      icon={account.icon}
      imagePath={account.imagePath}
      size="sm"
      className={cn("rounded-[0.5rem] bg-[var(--secondary)]/65 text-[var(--foreground)]", md ? "h-8 w-8" : "h-6 w-6")}
    />
  );
  const body = (
    <>
      {!onPictureClick && tileNode}
      <span className="min-w-0 flex-1">
        {/* Line 1 is the Connection's own name alone (up to two lines before it cuts); the service
            shows in the tile and the tooltip. */}
        <strong
          className="line-clamp-2 min-w-0 break-words text-[0.9375rem] font-semibold leading-5 text-[var(--foreground)]"
          title={[...new Set([identity.name, identity.accountLabel])].filter(Boolean).join(" · ")}
        >
          {identity.title}
        </strong>
        {(hasCount || balance || billingWord || details.length > 0 || problem) && (
          <span
            data-connection-identity-meta
            className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-[var(--muted-foreground)]"
          >
            <span className="min-w-0 truncate">
              {balance && <span data-connection-balance-word>{balance}</span>}
              {balance && hasCount && " · "}
              {hasCount && <span data-connection-group-count>{count}</span>}
              {[billingWord, ...details]
                .filter(Boolean)
                .map((part, index) => (balance || hasCount || index > 0 ? ` · ${part}` : part))
                .join("")}
            </span>
            {problem && <StateWord tone={STATE_TONE[problem.state]} label={problem.label} />}
          </span>
        )}
      </span>
      {trailing}
    </>
  );
  // Text starts 3.25rem in at both densities: md tile 2.5rem + 0.75rem gap, sm 0.75rem + 1.5rem + 1rem.
  const rowClass = cn(
    "flex min-w-0 flex-1 items-center text-left",
    md ? "min-h-11 gap-3 py-1 pe-1" : "min-h-9 gap-4 py-1 ps-3 pe-1",
    onPictureClick && "ps-3",
    onClick && cn("rounded-lg disabled:cursor-not-allowed disabled:opacity-50", FOCUS),
  );

  return (
    <>
      <div
        className={cn(
          "relative flex min-w-0 items-center rounded-lg",
          md && "mari-connection-card-head",
          onClick && !button.disabled && "transition-colors hover:bg-foreground/[0.04]",
          current && "bg-foreground/[0.06]",
          className,
        )}
      >
        {current && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--mari-panel-gradient-start)]"
          />
        )}
        {onPictureClick && (
          <button
            type="button"
            onClick={(event) => onPictureClick(menuAt(event))}
            aria-label={t("connections.picture.change", { name: account.name })}
            title={t("connections.picture.change", { name: account.name })}
            className={cn("-m-0.5 flex shrink-0 items-center justify-center rounded-xl p-0.5", FOCUS)}
          >
            {tileNode}
          </button>
        )}
        {onClick ? (
          <button type="button" {...button} onClick={onClick} aria-describedby={describedBy} className={rowClass}>
            {body}
          </button>
        ) : (
          <div {...dataProps} aria-describedby={describedBy} className={rowClass}>
            {body}
          </div>
        )}
        {end}
      </div>
      {hint && (
        <p id={hintId} className="mb-1 ms-[3.25rem] text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
          {hint}
        </p>
      )}
    </>
  );
}
