import type { Key, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PROVIDERS, type APIProvider } from "@marinara-engine/shared";
import { upstreamOf } from "../../lib/connection-groups";
import { cn } from "../../lib/utils";

/** One model well, shared by connection cards, editors and pickers. Upstreams are labels, never folders. */
export function ConnectionModelList<T extends { model?: string | null }>({
  provider,
  rows,
  getKey,
  renderRow,
  footer,
  empty,
  className,
  id,
  ariaLabel,
}: {
  provider: string;
  rows: readonly T[];
  getKey: (row: T) => Key;
  renderRow: (row: T, upstream: string | null) => ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  const sections = new Map<string, { label: string | null; rows: T[] }>();
  for (const row of rows) {
    const prefix = provider === "custom" ? upstreamOf(row.model)?.toLowerCase() : null;
    const label = prefix
      ? (PROVIDERS[prefix as APIProvider]?.name ??
        ({ linkapi: "LinkAPI", arliai: "ArliAI" } as Record<string, string>)[prefix])
      : null;
    // Unknown prefixes can be model organizations rather than proxy routes. Keep their full model id.
    const key = label && prefix ? prefix : "";
    const section = sections.get(key) ?? { label: label ?? null, rows: [] };
    section.rows.push(row);
    sections.set(key, section);
  }
  const ordered = [...sections].sort(([a], [b]) => Number(!a) - Number(!b) || a.localeCompare(b));
  return (
    <div id={id} aria-label={ariaLabel} className={cn("mari-connection-model-list min-w-0", className)}>
      {rows.length === 0 && empty}
      {ordered.map(([upstream, section]) => (
        <div key={upstream || "models"} data-connection-upstream={upstream || undefined} className="min-w-0">
          {(section.label || ordered.length > 1) && (
            <div className="px-4 pb-1 pt-2 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {section.label
                ? t("connections.accounts.upstreamHeading", { upstream: section.label, count: section.rows.length })
                : t("connections.accounts.section.other")}
            </div>
          )}
          {section.rows.map((row) => (
            <div key={getKey(row)} className="mari-connection-model-slot min-w-0">
              {renderRow(row, upstream || null)}
            </div>
          ))}
        </div>
      ))}
      {footer}
    </div>
  );
}
