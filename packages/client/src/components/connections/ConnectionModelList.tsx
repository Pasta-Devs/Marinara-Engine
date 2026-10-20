import { useState, type Key, type ReactNode } from "react";
import { ChevronDown, Layers, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PROVIDERS, type APIProvider } from "@marinara-engine/shared";
import { upstreamOf } from "../../lib/connection-groups";
import { MODEL_KINDS, modelKindOf } from "../../lib/connection-identity";
import { cn } from "../../lib/utils";
import { useNanoGptPlanBadges } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { BrandMark } from "./ProviderIcon";

/** A list longer than this starts folded: each upstream shows only its role (or starred) Models. */
const FOLD_AT = 12;

const ROW_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

/**
 * One model well, shared by connection cards, editors, the picker and the switcher. A proxy's upstreams are
 * foldable headings; inside each, Models sort by kind (chat, image, video, voice, decision) and keep their order
 * within a kind.
 */
export function ConnectionModelList<T extends { model?: string | null; provider?: string | null }>({
  provider,
  rows,
  getKey,
  renderRow,
  footer,
  empty,
  className,
  id,
  ariaLabel,
  rolesOf,
  isPinned,
  autoFold = true,
  onAddModels,
  addLabel,
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
  /** Localized role labels of a Model, for a folded upstream's hint. */
  rolesOf?: (row: T) => readonly string[];
  /** Stays visible in a folded upstream; a Model with a role by default. */
  isPinned?: (row: T) => boolean;
  /** Fold long lists; off while a search filters them. */
  autoFold?: boolean;
  /** The last row, "+ Add models". */
  onAddModels?: () => void;
  addLabel?: string;
}) {
  const { t } = useTranslation();
  const nanoGptPlan = useNanoGptPlanBadges();
  const showCostBadges = useUIStore((s) => s.showCostBadges);
  const folding = autoFold && rows.length > FOLD_AT;
  // Upstreams the user flipped from their starting state (open, or folded in a long list).
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(() => new Set());
  const flip = (key: string) =>
    setFlipped((keys) => {
      const next = new Set(keys);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const pinned = (row: T) => (isPinned ? isPinned(row) : (rolesOf?.(row).length ?? 0) > 0);
  const kindRank = (row: T) => MODEL_KINDS.indexOf(modelKindOf(row.provider));

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

  // A folded upstream says what it hides: its roles, else its non-chat kinds.
  const hintOf = (sectionRows: T[]) => {
    const roles = [...new Set(sectionRows.flatMap((row) => rolesOf?.(row) ?? []))];
    const counts = new Map<string, number>();
    for (const row of sectionRows) {
      const kind = modelKindOf(row.provider);
      if (kind !== "chat") counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const kinds = [...counts].map(([kind, count]) => t(`connections.accounts.kindCount.${kind}`, { count })).join(", ");
    return { roles, kinds: roles.length ? "" : kinds };
  };

  return (
    <div id={id} aria-label={ariaLabel} className={cn("mari-connection-model-list min-w-0", className)}>
      {rows.length === 0 && empty}
      {ordered.map(([upstream, section]) => {
        const key = upstream || "models";
        const headed = !!section.label || ordered.length > 1;
        const open = folding === flipped.has(key);
        const sorted = [...section.rows].sort((a, b) => kindRank(a) - kindRank(b));
        const kept = open ? sorted : folding ? sorted.filter(pinned) : [];
        // A heading folds on its own; a list without headings always offers "Show N more".
        const hidden = sorted.length - kept.length;
        const showMore = !open && hidden > 0 && (kept.length > 0 || !headed);
        const hint = open ? null : hintOf(sorted);
        return (
          <div
            key={key}
            data-connection-upstream={upstream || undefined}
            data-connection-section
            className="mari-connection-model-well min-w-0"
          >
            {headed && (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => flip(key)}
                className={cn(
                  // The tinted top strip of its upstream's well: no tile, so it never reads as a model row. The
                  // 0.875rem mark is centred in the rows' tile column; role badges sit at the end.
                  "mari-connection-model-section-head flex min-h-9 w-full min-w-0 items-center gap-2 ps-[1.0625rem] pe-2 text-left text-xs font-semibold text-[var(--foreground)]",
                  ROW_FOCUS,
                )}
              >
                <span
                  className="me-[0.8125rem] flex h-3.5 w-3.5 shrink-0 items-center justify-center opacity-80"
                  aria-hidden
                >
                  {upstream ? <BrandMark of={upstream} className="h-3.5 w-3.5" /> : <Layers size="0.875rem" />}
                </span>
                <span className="min-w-0 truncate">
                  {section.label
                    ? t("connections.accounts.section.via", { service: section.label })
                    : t("connections.accounts.section.other")}
                </span>
                <span className="shrink-0 font-normal tabular-nums text-[var(--muted-foreground)]">
                  {section.rows.length}
                </span>
                <span className="ms-auto flex min-w-0 items-center gap-1">
                  {hint?.roles[0] && (
                    <span className="flex shrink-0 items-center gap-1" title={hint.roles.join(", ")}>
                      <span className="mari-connection-pill mari-connection-pill--strong">{hint.roles[0]}</span>
                      {hint.roles.length > 1 && (
                        <span className="mari-connection-pill">
                          <span aria-hidden>+{hint.roles.length - 1}</span>
                          <span className="sr-only">
                            {t("connections.row.moreRoles", { roles: hint.roles.slice(1).join(", ") })}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                  {hint?.kinds && <span className="min-w-0 truncate font-normal">{hint.kinds}</span>}
                </span>
                <ChevronDown
                  size="0.875rem"
                  aria-hidden
                  className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", !open && "-rotate-90")}
                />
              </button>
            )}
            {/* NanoGPT plan badges need the user's yes once: the server then reads NanoGPT's public list. */}
            {upstream === "nanogpt" && nanoGptPlan.value === null && showCostBadges && (
              <div className="mari-connection-model-slot flex min-h-9 min-w-0 items-center ps-[3.25rem] pe-2">
                <button type="button" onClick={() => void nanoGptPlan.ask()} className="mari-connection-btn">
                  {t("connections.nanogptPlan.show")}
                </button>
              </div>
            )}
            {kept.map((row) => (
              <div key={getKey(row)} className="mari-connection-model-slot min-w-0">
                {renderRow(row, upstream || null)}
              </div>
            ))}
            {showMore && (
              <div className="mari-connection-model-slot min-w-0">
                <button
                  type="button"
                  aria-expanded={false}
                  onClick={() => flip(key)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 ps-2 pe-2 text-left text-xs text-[var(--muted-foreground)] hover:bg-foreground/[0.04]",
                    ROW_FOCUS,
                  )}
                >
                  <span className="w-8 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {t("connections.accounts.showMore", { count: hidden })}
                  </span>
                  <ChevronDown size="0.875rem" aria-hidden className="shrink-0" />
                </button>
              </div>
            )}
          </div>
        );
      })}
      {onAddModels && (
        <button
          type="button"
          data-add-models
          onClick={onAddModels}
          className={cn(
            "mari-connection-browse mari-panel-gradient--connections flex min-h-12 w-full items-center gap-3 rounded-lg ps-2 pe-2 text-left text-sm font-semibold text-[var(--mari-connection-ink)] hover:bg-foreground/[0.04]",
            ROW_FOCUS,
          )}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-[var(--mari-connection-tint)]"
          >
            <Plus size="1rem" />
          </span>
          <span className="min-w-0 truncate">{addLabel ?? t("connections.accounts.addModels")}</span>
        </button>
      )}
      {footer}
    </div>
  );
}
