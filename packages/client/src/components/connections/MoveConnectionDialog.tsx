// ──────────────────────────────────────────────
// "Move to connection…": step 1 lists the Connections a Model can move to — the same service first (an instant
// move), then chat Connections of other services. Picking another service opens step 2, "Choose the model on X":
// the server's best non-variant match is preselected, variants are marked and never preselected, and the target's
// saved catalog can be searched (a custom endpoint also takes any typed id).
// ──────────────────────────────────────────────
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { ConnectionAccountListItem } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { useMoveConnection } from "../../hooks/use-connections";
import { useCatalogSearch, useSplitModel } from "../../hooks/use-connection-accounts";
import { Modal } from "../ui/Modal";
import { ListFrame, ListSearch } from "./ListFrame";
import { ServiceRow } from "./ServiceRow";
import type { ConnectionRowData } from "./ConnectionRow";

type MoveCandidate = { id: string; name: string; match: "exact" | "prefix" | "catalog"; variant: boolean };
type MovePlan = {
  kind: "same" | "cross" | "mismatch";
  manualModelAllowed: boolean;
  candidates: MoveCandidate[];
  /** Set when the target had no saved list and fetching it failed. */
  catalogError?: string;
};

const ROW =
  "mari-chrome-control mari-chrome-control--card flex min-h-14 w-full !flex-row !items-center gap-3 px-3 py-2 text-left text-xs disabled:opacity-50";
/** `:thinking` and `:free` are the variants the server flags most; any other tail gets the plain word. */
function variantKey(id: string) {
  if (/thinking/i.test(id)) return "connections.move.variant.thinking";
  if (/free/i.test(id)) return "connections.move.variant.free";
  return "connections.move.variant.other";
}

export function MoveConnectionDialog({
  row,
  same,
  other,
  rowsOf,
  splitFrom,
  onClose,
}: {
  row: ConnectionRowData;
  same: ConnectionAccountListItem[];
  other: ConnectionAccountListItem[];
  /** The Model's own Connection when a copy of it may take the Model ("Move to a new connection"). */
  splitFrom?: ConnectionAccountListItem | null;
  rowsOf: (accountId: string) => ConnectionRowData[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const move = useMoveConnection();
  const split = useSplitModel();
  const busy = move.isPending || split.isPending;
  const [target, setTarget] = useState<ConnectionAccountListItem | null>(null);
  const title = row.name?.trim() || row.model;

  const splitOff = (from: ConnectionAccountListItem) => {
    const name = t("connections.move.copyName", { name: from.name });
    split.mutate(
      { accountId: from.id, connectionId: row.id, name },
      {
        onSuccess: () => {
          toast.success(t("connections.accounts.row.moved", { model: title, connection: name }));
          onClose();
        },
        onError: (error) =>
          toast.error(
            t("connections.accounts.row.moveFailed", {
              error: error instanceof Error ? error.message : String(error ?? ""),
            }),
          ),
      },
    );
  };

  const run = (account: ConnectionAccountListItem, model?: string) =>
    move.mutate(
      { id: row.id, accountId: account.id, model },
      {
        onSuccess: () => {
          toast.success(t("connections.accounts.row.moved", { model: title, connection: account.name }));
          onClose();
        },
        onError: (error) =>
          toast.error(
            t("connections.accounts.row.moveFailed", {
              error: error instanceof Error ? error.message : String(error ?? ""),
            }),
          ),
      },
    );

  const targetRow = (account: ConnectionAccountListItem, onPick: () => void) => (
    <li key={account.id} className="mari-connection-group">
      <ServiceRow
        account={account}
        rows={rowsOf(account.id)}
        count={t("connections.list.models", { count: rowsOf(account.id).length })}
        state={account.state}
        stateLabel={t(`connections.accounts.state.${account.state}`)}
        billing={account.billing}
        data-move-target={account.id}
        onClick={onPick}
        disabled={busy}
        trailing={<ChevronRight size="1rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />}
      />
    </li>
  );

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={busy}
      title={t("connections.move.title")}
      width="max-w-md"
      opaque
      panelClassName="mari-connection-scope"
    >
      {target ? (
        <ModelStep row={row} target={target} busy={move.isPending} onBack={() => setTarget(null)} onMove={run} />
      ) : (
        <div data-move-targets className="flex flex-col gap-3">
          <p className="text-xs text-[var(--muted-foreground)]">{t("connections.move.pickHint", { model: title })}</p>
          {same.length > 0 && (
            <ul className="flex flex-col gap-2">{same.map((account) => targetRow(account, () => run(account)))}</ul>
          )}
          {other.length > 0 && (
            <section data-move-other className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-[var(--muted-foreground)]">
                {t("connections.move.otherServices")}
              </h4>
              <ul className="flex flex-col gap-2">
                {other.map((account) => targetRow(account, () => setTarget(account)))}
              </ul>
            </section>
          )}
          {splitFrom && (
            <button
              type="button"
              data-move-new-connection
              onClick={() => splitOff(splitFrom)}
              disabled={busy}
              className={ROW}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{t("connections.move.newConnection")}</span>
                <span className="text-[var(--muted-foreground)]">
                  {t("connections.move.newConnectionHint", { name: splitFrom.name })}
                </span>
              </span>
              <ChevronRight size="1rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

function ModelStep({
  row,
  target,
  busy,
  onBack,
  onMove,
}: {
  row: ConnectionRowData;
  target: ConnectionAccountListItem;
  busy: boolean;
  onBack: () => void;
  onMove: (account: ConnectionAccountListItem, model?: string) => void;
}) {
  const { t } = useTranslation();
  const plan = useQuery({
    queryKey: ["connections", "move-candidates", row.id, target.id],
    queryFn: () =>
      api.get<MovePlan>(`/connections/${row.id}/move-candidates?accountId=${encodeURIComponent(target.id)}`),
  });
  const [query, setQuery] = useState("");
  // ponytail: catalog search spans every Connection, so it asks for more hits and keeps the target's.
  const search = useCatalogSearch(query, 200);
  const [picked, setPicked] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const candidates = plan.data?.candidates ?? [];
  const best = candidates.find((candidate) => !candidate.variant);
  const choice = manual.trim() || picked || best?.id || "";
  const kind = plan.data?.kind;
  const hits = (search.data ?? []).filter(
    (hit) =>
      hit.accountId === target.id &&
      // The search reads the Connection's newest catalog, which can belong to another kind of Model on it.
      hit.provider === target.provider &&
      !candidates.some((candidate) => candidate.id === hit.model),
  );
  const options = [
    ...candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      pill:
        candidate === best
          ? {
              tone: "blue",
              label: t(candidate.match === "catalog" ? "connections.move.closest" : "connections.move.same"),
            }
          : candidate.variant
            ? { tone: "warn", label: t(variantKey(candidate.id)) }
            : null,
    })),
    ...hits.map((hit) => ({ id: hit.model, name: hit.name, pill: null })),
  ];

  return (
    <div data-move-model-step className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("connections.add.back")}
          title={t("connections.add.back")}
          className="mari-connection-btn mari-connection-btn--ghost mari-connection-btn--icon -ms-2"
        >
          <ChevronLeft size="1rem" aria-hidden />
        </button>
        <h4 className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">
          {t("connections.move.chooseModel", { connection: target.name })}
        </h4>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.move.whatMoves")}</p>

      {plan.isLoading ? (
        <p className="text-xs text-[var(--muted-foreground)]">{t("connections.move.loading")}</p>
      ) : plan.isError || kind === "mismatch" ? (
        <p role="alert" className="text-xs text-[var(--muted-foreground)]">
          {t("connections.move.cannotMove", { connection: target.name })}
        </p>
      ) : (
        <>
          {plan.data?.catalogError && !plan.data.manualModelAllowed ? (
            <div data-move-catalog-error role="alert" className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-xs font-semibold">
                {t("connections.move.catalogFailed", { connection: target.name })}
              </p>
              <button
                type="button"
                data-move-catalog-retry
                onClick={() => plan.refetch()}
                disabled={plan.isFetching}
                className="mari-connection-btn mari-connection-btn--ghost shrink-0"
              >
                {t("connections.picker.retry")}
              </button>
            </div>
          ) : (
            !candidates.length &&
            !plan.data?.manualModelAllowed && (
              <p data-move-not-offered className="text-xs font-semibold">
                {t("connections.move.notOffered", { connection: target.name })}
              </p>
            )
          )}
          <ListFrame
            search={
              <ListSearch
                className="mb-2"
                data-move-search
                value={query}
                onChange={setQuery}
                label={t("connections.move.searchLabel", { connection: target.name })}
                placeholder={t("connections.move.searchPlaceholder", { connection: target.name })}
                autoCapitalize="off"
                autoCorrect="off"
              />
            }
            status={
              query.trim() && options.length === 0
                ? t(search.isFetching ? "connections.switcher.searching" : "connections.switcher.noMatches")
                : null
            }
            role="radiogroup"
            aria-label={t("connections.move.chooseModel", { connection: target.name })}
            listClassName="flex max-h-72 flex-col gap-1"
          >
            {options.map((option) => (
              <label
                key={option.id}
                data-move-candidate={option.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg py-1.5 ps-2 pe-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--marinara-chat-chrome-focus-ring)]",
                  !manual.trim() && choice === option.id
                    ? "bg-[var(--mari-connection-tint)]"
                    : "hover:bg-foreground/[0.06]",
                )}
              >
                <input
                  type="radio"
                  name="move-model"
                  value={option.id}
                  checked={!manual.trim() && choice === option.id}
                  onChange={() => {
                    setManual("");
                    setPicked(option.id);
                  }}
                  className="accent-[var(--mari-panel-gradient-end)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{option.name || option.id}</span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">{option.id}</span>
                </span>
                {option.pill && (
                  <span className={`mari-connection-pill mari-connection-pill--${option.pill.tone} shrink-0`}>
                    {option.pill.label}
                  </span>
                )}
              </label>
            ))}
          </ListFrame>
          {plan.data?.manualModelAllowed && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--muted-foreground)]">
              {t("connections.move.manualLabel")}
              <input
                data-move-manual
                value={manual}
                onChange={(event) => setManual(event.target.value)}
                placeholder={row.model}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="mari-chrome-field h-11 w-full px-3 text-xs font-normal md:h-9"
              />
            </label>
          )}
        </>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          data-move-confirm
          // A stale list can offer a same-service Connection here; that move needs no model.
          disabled={busy || (kind === "cross" ? !choice : kind !== "same")}
          onClick={() => onMove(target, kind === "cross" ? choice : undefined)}
          className="mari-connection-btn mari-connection-btn--primary"
        >
          {t("connections.move.confirm")}
        </button>
      </div>
    </div>
  );
}
