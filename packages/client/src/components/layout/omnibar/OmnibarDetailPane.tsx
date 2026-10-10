import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import type {
  CommandCenterPreviewFact,
  CommandResultPreviewAction,
  RichCommandResult,
} from "../../command-center/command-result-preview.types";
import { resultMetadata, type RankedOmnibarResult } from "./omnibar-result-view";

export interface OmnibarDetailPaneProps {
  result: RankedOmnibarResult;
  actions: readonly CommandResultPreviewAction[];
  extraFacts: CommandCenterPreviewFact[];
  /** One lazily fetched line: a greeting, the last message, the first entry. */
  note: string | null;
  detailLoading: boolean;
  /** Contextual state that is useful in the preview but does not belong to the resource itself. */
  contextStatusLabel?: string;
}

/**
 * The body of an expanded result row. The row above it already shows the
 * avatar, title and description, and its selected state is the only frame, so
 * this adds no header, card or divider: a description the row did not show,
 * one Strip of facts, one Note, and the actions Enter does not already run.
 */
export function OmnibarDetailPane({
  result,
  actions,
  extraFacts,
  note,
  detailLoading,
  contextStatusLabel,
}: OmnibarDetailPaneProps) {
  const { t } = useTranslation();
  const preview = result.preview?.();
  const description = preview?.description?.trim();
  const statusLabel =
    result.command.availability?.status === "requires-capability"
      ? t("commandCenter.setupRequired", "Setup required: {{capability}}", {
          capability: result.command.availability.capability ?? t("commandCenter.capability", "capability"),
        })
      : result.command.availability?.status === "requires-admin"
        ? t("commandCenter.adminRequired", "Administrator access required")
        : contextStatusLabel;
  const chips: { label?: string; value: string }[] = [
    ...(statusLabel ? [{ value: statusLabel }] : []),
    // A row with a control already shows this state beside its name.
    ...(preview?.status && !result.control ? [{ value: preview.status.label }] : []),
    ...[...(preview?.facts ?? []), ...extraFacts].map((fact) => ({ label: fact.label, value: String(fact.value) })),
    ...(preview?.supportingInfo ? [{ value: preview.supportingInfo }] : []),
    ...(preview?.tags ?? preview?.badges ?? []).map((value) => ({ value })),
  ].slice(0, 4);
  const steps = preview?.steps?.slice(0, 3) ?? [];

  return (
    <div data-component="GlobalOmnibar.Detail" className="space-y-2">
      {description && description !== resultMetadata(result, preview) ? (
        <p className="line-clamp-2 break-words text-sm leading-5 text-[var(--foreground)]">{description}</p>
      ) : null}
      {chips.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map((chip, index) => (
            <li
              key={`${chip.label ?? ""}-${chip.value}-${index}`}
              className="mari-chrome-control mari-chrome-control--compact max-w-full"
            >
              {chip.label ? <span className="font-normal opacity-70">{chip.label}</span> : null}
              <span>{chip.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {steps.length ? (
        <ol className="list-inside list-decimal space-y-0.5 text-xs leading-5 text-[var(--muted-foreground)]">
          {steps.map((step, index) => (
            <li key={`${step}-${index}`} className="truncate">
              {step}
            </li>
          ))}
        </ol>
      ) : null}
      {note ? (
        <p className="truncate text-xs leading-5 text-[var(--muted-foreground)]">{note}</p>
      ) : detailLoading ? (
        <div
          aria-hidden="true"
          className="h-3 w-2/3 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--foreground)_9%,transparent)] motion-reduce:animate-none"
        />
      ) : null}
      {actions.length ? (
        <div className="flex flex-wrap gap-1.5">
          {actions.slice(0, 3).map((action, index) => {
            const ActionIcon = action.icon ?? ArrowRight;
            return (
              <button
                key={`${action.label}-${index}`}
                type="button"
                onClick={() =>
                  action.onSelect({ command: result.command, score: result.score, preview } as RichCommandResult)
                }
                disabled={action.disabled}
                className={cn(
                  "mari-chrome-control mari-chrome-control--small max-w-full text-xs",
                  action.danger && "mari-chrome-control--danger",
                )}
              >
                <ActionIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
