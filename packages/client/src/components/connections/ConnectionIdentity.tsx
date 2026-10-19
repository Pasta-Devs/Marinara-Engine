import type { ReactNode } from "react";
import type { ConnectionAccountState } from "@marinara-engine/shared";
import { getConnectionIdentity, type ConnectionIdentityRow } from "../../lib/connection-identity";
import { cn } from "../../lib/utils";
import { StateWord, type EngineTone } from "./DeviceDetail";
import { ProviderIcon } from "./ProviderIcon";

const STATE_TONE: Record<ConnectionAccountState, EngineTone> = { ok: "ok", off: "off", needs_key: "warn" };

export function ConnectionIdentity({
  account,
  rows,
  count,
  state,
  stateLabel,
  icon,
  className,
  size = "md",
}: {
  account: { name: string; provider: string; baseUrl?: string | null };
  rows: readonly ConnectionIdentityRow[];
  count?: ReactNode;
  state?: ConnectionAccountState;
  stateLabel?: string;
  icon?: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  const identity = getConnectionIdentity(account, rows);
  const details = [identity.accountLabel, identity.endpoint].filter(Boolean);

  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-3", className)}>
      {icon ?? (
        <ProviderIcon
          provider={account.provider}
          baseUrl={account.baseUrl}
          service={identity.service}
          name={account.name}
          size="sm"
          className={cn(
            "rounded-full bg-[var(--secondary)]/65 text-[var(--foreground)]",
            size === "md" ? "h-8 w-8" : "h-6 w-6",
          )}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="mari-connection-heading-line">
          <strong
            className={cn(
              "min-w-0 truncate font-semibold text-[var(--foreground)]",
              size === "md" ? "text-base leading-5" : "text-xs",
            )}
          >
            {identity.name}
          </strong>
          {count !== undefined && count !== null && (
            <span
              data-connection-group-count
              className={cn(
                "shrink-0 font-normal text-[var(--muted-foreground)]",
                size === "md" ? "text-xs" : "text-[0.6875rem]",
              )}
            >
              {count}
            </span>
          )}
        </span>
        {(details.length > 0 || (state && stateLabel)) && (
          <span
            className={cn(
              "mt-0.5 flex min-w-0 items-center gap-2 text-[var(--muted-foreground)]",
              size === "md" ? "text-xs" : "text-[0.6875rem]",
            )}
          >
            {details.length > 0 && <span className="min-w-0 truncate">{details.join(" · ")}</span>}
            {state && stateLabel && <StateWord tone={STATE_TONE[state]} label={stateLabel} />}
          </span>
        )}
      </span>
    </span>
  );
}
