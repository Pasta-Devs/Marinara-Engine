import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ConnectionAccountState, ConnectionBilling } from "@marinara-engine/shared";
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
  billing,
}: {
  account: { name: string; provider: string; baseUrl?: string | null; icon?: string | null; imagePath?: string | null };
  rows: readonly ConnectionIdentityRow[];
  count?: ReactNode;
  state?: ConnectionAccountState;
  stateLabel?: string;
  icon?: ReactNode;
  className?: string;
  size?: "sm" | "md";
  billing?: ConnectionBilling;
}) {
  const { t } = useTranslation();
  const identity = getConnectionIdentity(account, rows);
  // Line 2 is facts, never a second name: count, plan word, host.
  const details = [identity.endpoint].filter(Boolean);
  const hasCount = count !== undefined && count !== null;
  // One card-level cost word: a plan, or a free service.
  const billingWord = billing ? t(`connections.list.billing.${billing}`) : null;
  // A healthy Connection shows no status; only a problem shows its word.
  const problem = state && state !== "ok" && stateLabel ? { state, label: stateLabel } : null;

  return (
    <span className={cn("flex min-w-0 flex-1 items-center", size === "md" ? "gap-3" : "gap-4", className)}>
      {icon ?? (
        <ProviderIcon
          provider={account.provider}
          baseUrl={account.baseUrl}
          service={identity.service}
          name={account.name}
          icon={account.icon}
          imagePath={account.imagePath}
          size="sm"
          className={cn(
            "rounded-[0.5rem] bg-[var(--secondary)]/65 text-[var(--foreground)]",
            size === "md" ? "h-8 w-8" : "h-6 w-6",
          )}
        />
      )}
      <span className="min-w-0 flex-1">
        {/* Line 1 is the Connection's own name alone; the service shows in the tile and the tooltip. */}
        <strong
          className="block min-w-0 truncate text-base font-semibold leading-5 text-[var(--foreground)]"
          title={[identity.name, identity.accountLabel].filter(Boolean).join(" · ")}
        >
          {identity.title}
        </strong>
        {(hasCount || billingWord || details.length > 0 || problem) && (
          <span
            data-connection-identity-meta
            className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-[var(--muted-foreground)]"
          >
            <span className="min-w-0 truncate">
              {hasCount && <span data-connection-group-count>{count}</span>}
              {[billingWord, ...details]
                .filter(Boolean)
                .map((part, index) => (hasCount || index > 0 ? ` · ${part}` : part))
                .join("")}
            </span>
            {problem && <StateWord tone={STATE_TONE[problem.state]} label={problem.label} />}
          </span>
        )}
      </span>
    </span>
  );
}
