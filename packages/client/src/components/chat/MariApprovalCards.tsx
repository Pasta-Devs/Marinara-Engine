import { type ReactNode, useCallback, useRef, useState } from "react";
import { Trans, useTranslation as useUiTranslation } from "react-i18next";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  MariDbPendingApproval,
  MariDependencyInstallApproval,
  MariHeldChange,
  MariSensitiveFileApproval,
  MariWorkspacePendingApproval,
} from "@marinara-engine/shared";

import { describeTable, describeTablePlural, fieldLabel, replyFixChat } from "../../lib/mari-edit-diff";
import { describeMariHeldChanges, summarizeDeleteReview } from "../../lib/professor-mari-presentation";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { MariEditEasyViewer, rowTitle } from "./MariEditEasyViewer";
import { MariCard, MariRow } from "./mari-primitives";
import { MariPromptPreviewModal, type MariPromptRenderSide } from "./MariPromptPreviewModal";
import { TranscriptRow } from "./MariTranscriptRow";
import { Field } from "./MariChangeReceipt";

/**
 * Professor Mari's approval gates and the summaries they are built from.
 *
 * These are what the user reads while deciding whether to allow a change. Each
 * one renders inside the turn that asked for it (`assignReviewsToTurns`).
 */
function summarizeTables(tables: Record<string, number>) {
  const entries = Object.entries(tables);
  if (entries.length === 0) return "No rows";
  return entries
    .slice(0, 3)
    .map(([table, count]) => `${count} ${table}`)
    .join(", ");
}

function formatRowPreview(row: Record<string, unknown> | null | undefined) {
  if (!row) return "No row snapshot available.";
  try {
    const text = JSON.stringify(row, null, 2);
    return text.length > 700 ? `${text.slice(0, 700)}\n...` : text;
  } catch {
    return "Row snapshot could not be displayed.";
  }
}

/** Raw is one disclosure: the command Mari ran, then the snapshot of every row she created or removed. */
export function RawDetails({
  approval,
  open,
  onToggle,
}: {
  approval: MariDbPendingApproval;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const snapshots = approval.diffPreview
    .filter((change) => change.action === "insert" || change.action === "delete")
    .map(
      (change) =>
        `${change.action} ${change.table} ${change.id}\n${formatRowPreview(change.action === "delete" ? change.before : change.after)}`,
    );
  return (
    <TechnicalDetails
      label={localizeUi("ui.chat.databaseworkspaceapprovalcard.rawView")}
      open={open}
      onToggle={onToggle}
      rows={[
        [localizeUi("ui.chat.mariapprovalcard.tables"), summarizeTables(approval.affectedTables)],
        [localizeUi("ui.chat.mariapprovalcard.rows"), String(approval.affectedRows)],
      ]}
    >
      <pre>{[approval.command, ...snapshots].join("\n\n")}</pre>
    </TechnicalDetails>
  );
}

function DatabaseWorkspaceApprovalCard({
  approval,
  busy,
  disabled,
  onKeep,
  onTurnOn,
  onRestore,
  onRejectRows,
  onRenderPrompt,
}: {
  approval: MariDbPendingApproval;
  busy: boolean;
  disabled: boolean;
  onKeep: (id: string) => void;
  onTurnOn?: (memoryId: string) => Promise<boolean>;
  onRestore: (id: string) => void;
  onRejectRows?: (
    id: string,
    rows: Array<{ index: number; table: string; id: string; action: string }>,
  ) => Promise<boolean>;
  onRenderPrompt?: (
    id: string,
    row: { index: number; table: string; id: string; action: string },
  ) => Promise<{ before: MariPromptRenderSide; after: MariPromptRenderSide } | null>;
}) {
  const { t: localizeUi } = useUiTranslation();
  // #4931: synthetic prompt-preview modal state for a character/preset row.
  const [promptPreview, setPromptPreview] = useState<{
    loading: boolean;
    error: boolean;
    before: MariPromptRenderSide;
    after: MariPromptRenderSide;
  } | null>(null);
  // Each open/close bumps the token so a late render resolve can't re-open a modal the user closed.
  const renderTokenRef = useRef(0);
  const closePromptPreview = useCallback(() => {
    renderTokenRef.current += 1;
    setPromptPreview(null);
  }, []);
  const handleRenderRow = useCallback(
    async (change: MariDbPendingApproval["diffPreview"][number], index: number) => {
      if (!onRenderPrompt) return;
      const token = (renderTokenRef.current += 1);
      setPromptPreview({ loading: true, error: false, before: null, after: null });
      try {
        const result = await onRenderPrompt(approval.id, {
          index,
          table: change.table,
          id: change.id,
          action: change.action,
        });
        if (renderTokenRef.current !== token) return; // closed or superseded while assembling
        if (result) setPromptPreview({ loading: false, error: false, before: result.before, after: result.after });
        else setPromptPreview({ loading: false, error: true, before: null, after: null });
      } catch {
        if (renderTokenRef.current !== token) return;
        setPromptPreview({ loading: false, error: true, before: null, after: null });
      }
    },
    [onRenderPrompt, approval.id],
  );
  // "Edit review opens in: Raw" opens the Raw disclosure; toggling one saves the choice for the next
  // card without flipping the cards already on screen.
  const defaultViewMode = useUIStore((s) => s.mariEditViewMode);
  const setDefaultViewMode = useUIStore((s) => s.setMariEditViewMode);
  const [rawOpen] = useState(defaultViewMode === "raw");
  const raw = (
    <RawDetails approval={approval} open={rawOpen} onToggle={(open) => setDefaultViewMode(open ? "raw" : "easy")} />
  );
  const deleteReview = summarizeDeleteReview(approval);
  // #4851: a saved memory lands disabled; offer "Turn on" to switch it on. The review stays open, so
  // Undo still works. Gated to mari_instructions inserts, and only for NON-persistent ones, because
  // enabling a Persistent memory injects its full body every turn, a heavier commitment, so route that
  // through the Memories panel where Persistent is visible.
  const enableableMemoryId =
    approval.diffPreview.find((change) => {
      if (change.action !== "insert" || change.table !== "mari_instructions") return false;
      const after = change.after as { enabled?: unknown; persistent?: unknown } | null;
      return Number(after?.enabled) !== 1 && Number(after?.persistent) !== 1;
    })?.id ?? null;
  // The diff keeps the memory's old "off" state, so the card itself remembers that Turn on worked.
  const [turnedOn, setTurnedOn] = useState(false);

  const promptPreviewModal = promptPreview ? (
    <MariPromptPreviewModal
      title={localizeUi("ui.chat.maripromptpreviewmodal.title")}
      loading={promptPreview.loading}
      error={promptPreview.error}
      before={promptPreview.before}
      after={promptPreview.after}
      onClose={closePromptPreview}
    />
  ) : null;

  // R42: a delete is a risky prompt. Mari already removed the rows; Delete keeps them gone.
  if (deleteReview) {
    return (
      <TranscriptRow layout="document" marker={null}>
        <DeleteReviewCard
          approvals={[approval]}
          raw={raw}
          busy={busy}
          disabled={disabled}
          onDelete={() => onKeep(approval.id)}
          onPutBack={() => onRestore(approval.id)}
        />
      </TranscriptRow>
    );
  }

  return (
    <TranscriptRow layout="document" marker={null}>
      <MariEditEasyViewer
        approval={approval}
        raw={raw}
        busy={busy || disabled}
        onRenderRow={onRenderPrompt ? handleRenderRow : undefined}
        onRejectRow={
          onRejectRows
            ? (change, index) =>
                void onRejectRows(approval.id, [{ index, table: change.table, id: change.id, action: change.action }])
            : undefined
        }
        running={busy}
        actions={
          <>
            <button
              type="button"
              onClick={() => onRestore(approval.id)}
              disabled={busy || disabled}
              className="mari-link"
            >
              {localizeUi(
                approval.diffPreview.some((change) => replyFixChat(change))
                  ? "ui.chat.mariappliededit.restoreReply"
                  : "ui.chat.mariappliededit.undo",
              )}
            </button>
            {enableableMemoryId && onTurnOn && !turnedOn ? (
              <button
                type="button"
                onClick={() => void onTurnOn(enableableMemoryId).then((done) => done && setTurnedOn(true))}
                disabled={busy || disabled}
                className="mari-btn"
              >
                {localizeUi("ui.chat.databaseworkspaceapprovalcard.turnOn")}
              </button>
            ) : null}
            {/* Slice 87: an applied change is already saved, so it has no Keep; Undo is the only answer. A
                change still waiting for the user is a real question, so Apply is its one solid button. */}
            {approval.kind === "applied_review" ? null : (
              <button
                type="button"
                onClick={() => onKeep(approval.id)}
                disabled={busy || disabled}
                className="mari-btn mari-btn--solid"
              >
                {busy ? <Loader2 size="0.8rem" className="animate-spin" aria-hidden="true" /> : null}
                {localizeUi("ui.chat.mariappliededit.apply")}
              </button>
            )}
          </>
        }
      />
      {promptPreviewModal}
    </TranscriptRow>
  );
}

/**
 * Slice 71 (N3, N7): the deletes of one turn as ONE "Needs you" card - "Delete 2 lorebook entries", their
 * names, what each button does. Mari already hid the rows; Delete keeps them gone, Put back restores
 * them, for every review in the group at once.
 * ponytail: a preset section or group delete also edits the preset (and orphans the group's sections);
 * those automatic side-effect updates show only in Raw's command and table counts, not as rows here.
 * Split the card if Mari ever mixes deletes with edits the user should judge.
 */
export function DeleteReviewCard({
  approvals,
  raw,
  busy,
  disabled,
  onDelete,
  onPutBack,
}: {
  approvals: MariDbPendingApproval[];
  /** The single review's Raw disclosure; a group has none (each review's command differs). */
  raw?: ReactNode;
  busy: boolean;
  disabled: boolean;
  onDelete: () => void;
  onPutBack: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const reviews = approvals.flatMap((approval) => {
    const summary = summarizeDeleteReview(approval);
    return summary ? [summary] : [];
  });
  const first = reviews[0];
  if (!first) return null;
  const names = reviews.flatMap(({ selected }) => selected.map((change) => rowTitle(change, localizeUi)));
  const count = reviews.reduce((total, review) => total + review.count, 0);
  const oneTable = reviews.every(({ parent }) => parent.table === first.parent.table);
  const reasons = [...new Set(approvals.map((approval) => approval.reason?.trim()).filter(Boolean))];
  const title =
    names.length === 1
      ? localizeUi("ui.chat.marideleteprompt.title", { name: names[0] })
      : oneTable
        ? localizeUi("mari.needsYou.deleteMany", { count, things: describeTablePlural(first.parent.table) })
        : localizeUi("ui.chat.marideleteprompt.titleMany", { count });
  const meta =
    names.length === 1
      ? first.linkedCount > 0
        ? localizeUi("ui.chat.marideleteprompt.metaLinked", {
            type: describeTable(first.parent.table),
            count: first.linkedCount,
          })
        : describeTable(first.parent.table)
      : `${names.slice(0, 3).join(", ")}${names.length > 3 ? ", …" : ""}`;
  return (
    <MariCard
      needsYou
      variant="danger"
      media={<Trash2 size="1rem" aria-hidden="true" />}
      title={title}
      meta={meta}
      then={<Trans i18nKey="mari.needsYou.then.delete" count={count} components={{ b: <b /> }} />}
      actions={
        <>
          <button type="button" onClick={onPutBack} disabled={busy || disabled} className="mari-link">
            {localizeUi("ui.chat.marideleteprompt.restore", { count })}
          </button>
          <button type="button" onClick={onDelete} disabled={busy || disabled} className="mari-btn mari-btn--danger">
            {busy ? <Loader2 size="0.8rem" className="animate-spin" aria-hidden="true" /> : null}
            {busy
              ? localizeUi("ui.chat.marideleteprompt.deleting")
              : names.length === 1
                ? localizeUi("ui.chat.marideleteprompt.delete")
                : localizeUi("mari.needsYou.deleteCount", { count })}
          </button>
        </>
      }
    >
      {reasons.length > 0 ? (
        <TechnicalDetails label={localizeUi("ui.chat.homeprofessormarichat.why")} rows={[]}>
          {reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </TechnicalDetails>
      ) : null}
      {approvals.some((approval) => approval.diffTruncated) ? (
        <p>{localizeUi("ui.chat.databaseworkspaceapprovalcard.thisPreviewMayNotShowEveryAffectedRow")}</p>
      ) : null}
      {raw}
    </MariCard>
  );
}

/**
 * Slice 71 (N3): a change Mari held behind Accept, as a "Needs you" card. Its words come from the saved
 * commands (`mariHeldChanges`), never from her prose; an old turn without them still gets the card,
 * named generically. Accept and Don't apply send the same replies the chips did.
 */
export function MariHeldChangeCard({
  held,
  nameOf,
  disabled,
  onAccept,
  onDecline,
}: {
  held: readonly MariHeldChange[] | null | undefined;
  nameOf: (id: string) => string | undefined;
  disabled: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const { kind, name, count, fields } = describeMariHeldChanges(held, nameOf);
  const named = name || localizeUi("mari.needsYou.held.thisRecord");
  const title =
    kind === "update"
      ? localizeUi("mari.needsYou.held.update", { count, name: named })
      : kind === "many"
        ? localizeUi("mari.needsYou.held.many", { count })
        : name
          ? localizeUi(`mari.needsYou.held.${kind}`, { name })
          : localizeUi("mari.needsYou.held.generic");
  const labels = fields.map(({ key }) => fieldLabel(key));
  // Folded: one key field. A new record's name is already the title, so its first other field shows.
  const peek = Math.max(
    0,
    fields.findIndex(({ key }) => key !== "name"),
  );
  // One short head line: a new record counts its fields; an edit names up to three, then "+N".
  const named3 = labels
    .slice(0, 3)
    .map((label, index) => (index === 0 ? label : label.toLowerCase()))
    .join(", ");
  const fact =
    kind === "many"
      ? name
      : kind === "create" && fields.length > 0
        ? localizeUi("ui.chat.marichangereceipt.fieldCount", { count: fields.length })
        : labels.length > 3
          ? `${named3} ${localizeUi("ui.chat.marichangereceipt.more", { count: labels.length - 3 })}`
          : named3;
  const Icon = kind === "delete" ? Trash2 : kind === "create" ? Plus : Pencil;
  return (
    <div className="mari-list mari-receipt">
      <div className="mari-receipt__record" data-open={open}>
        <div className="mari-receipt__head">
          <span className="mari-receipt__face">
            <Icon size="1rem" aria-hidden="true" />
          </span>
          <span className="mari-receipt__text">
            <span className="mari-receipt__name">
              <span>{title}</span>
            </span>
            {fact ? <span className="mari-receipt__what">{fact}</span> : null}
          </span>
        </div>
        {fields.length > 0 ? (
          <div className={open ? "mari-receipt__body" : "mari-receipt__folded"}>
            {fields.map(
              (field, index) =>
                (open || index === peek) && (
                  <Field key={field.key} label={labels[index]!}>
                    <div className="mari-receipt__box">{field.value}</div>
                  </Field>
                ),
            )}
          </div>
        ) : null}
        {fields.length > 1 ? (
          <button type="button" className="mari-receipt__more" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open
              ? localizeUi("ui.chat.marichangereceipt.showLess")
              : localizeUi("ui.chat.marichangereceipt.showAll", { count: fields.length })}
            <ChevronDown className="mari-receipt__chev" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="mari-receipt__why">
        <Trans i18nKey="mari.needsYou.then.held" components={{ b: <b /> }} />
      </p>
      <div className="mari-receipt__foot">
        <span className="mari-receipt__state" data-tone="wait">
          <Clock aria-hidden="true" />
          {localizeUi("ui.chat.marichangereceipt.notAppliedYet")}
        </span>
        <span className="mari-receipt__actions">
          <button type="button" onClick={onDecline} disabled={disabled} className="mari-link">
            {localizeUi("mari.needsYou.decline")}
          </button>
          <button type="button" onClick={onAccept} disabled={disabled} className="mari-btn mari-btn--solid">
            {localizeUi("mari.needsYou.accept")}
          </button>
        </span>
      </div>
    </div>
  );
}

/**
 * R42 (direction A): the prompt names what happens and why; the exact package, hash and file
 * contents sit behind one "Technical details" disclosure.
 */
function TechnicalDetails({
  rows,
  children,
  label,
  open,
  onToggle,
}: {
  rows: Array<[string, ReactNode]>;
  children?: ReactNode;
  label?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <details
      className="mari-tech"
      open={open}
      onToggle={onToggle ? (event) => onToggle(event.currentTarget.open) : undefined}
    >
      <summary className="mari-link -ml-2">
        <ChevronRight size="0.8rem" aria-hidden="true" />
        {label ?? localizeUi("ui.chat.mariapprovalcard.technicalDetails")}
      </summary>
      {rows.length > 0 ? (
        <dl>
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </details>
  );
}

function DependencyWorkspaceApprovalCard({
  approval,
  busy,
  disabled,
  onApprove,
  onDiscard,
}: {
  approval: MariDependencyInstallApproval;
  busy: boolean;
  disabled: boolean;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const dependencies = approval.directDependencies;
  return (
    <MariCard
      needsYou
      media={<PackagePlus size="1rem" aria-hidden="true" />}
      title={localizeUi("ui.chat.dependencyworkspaceapprovalcard.title", { name: approval.packageName })}
      meta={localizeUi("ui.chat.dependencyworkspaceapprovalcard.meta", { version: approval.version })}
      then={<Trans i18nKey="mari.needsYou.then.install" components={{ b: <b /> }} />}
      actions={
        <>
          <button
            type="button"
            onClick={() => onDiscard(approval.id)}
            disabled={busy || disabled}
            className="mari-link"
          >
            {localizeUi("ui.chat.dependencyworkspaceapprovalcard.notNow")}
          </button>
          <button
            type="button"
            onClick={() => onApprove(approval.id)}
            disabled={busy || disabled}
            className="mari-btn mari-btn--solid"
          >
            {busy ? <Loader2 size="0.8rem" className="animate-spin" aria-hidden="true" /> : null}
            {busy
              ? localizeUi("ui.chat.dependencyworkspaceapprovalcard.installing")
              : localizeUi("ui.agents.agentcatalogview.install")}
          </button>
        </>
      }
    >
      {approval.reason ? <p>{approval.reason}</p> : null}
      <TechnicalDetails
        rows={[
          [
            localizeUi("ui.chat.dependencyworkspaceapprovalcard.package"),
            <code>
              {approval.packageName}@{approval.version}
            </code>,
          ],
          [
            localizeUi("ui.chat.dependencyworkspaceapprovalcard.target"),
            `${approval.target} · ${approval.dependencyType}`,
          ],
          [
            localizeUi("ui.chat.dependencyworkspaceapprovalcard.dependencies"),
            dependencies.length === 0
              ? localizeUi("ui.chat.dependencyworkspaceapprovalcard.none")
              : dependencies.map((dependency) => `${dependency.name} ${dependency.range}`).join(", "),
          ],
          [localizeUi("ui.chat.dependencyworkspaceapprovalcard.integrity"), <code>{approval.integrity}</code>],
          [localizeUi("ui.chat.dependencyworkspaceapprovalcard.source"), <code>{approval.tarballUrl}</code>],
        ]}
      />
    </MariCard>
  );
}

function SensitiveFileWorkspaceApprovalCard({
  approval,
  busy,
  disabled,
  onApprove,
  onDiscard,
}: {
  approval: MariSensitiveFileApproval;
  busy: boolean;
  disabled: boolean;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const file = approval.path.split(/[\\/]/u).at(-1) || approval.path;
  const created = approval.changeType === "create";
  return (
    <MariCard
      needsYou
      media={<FileText size="1rem" aria-hidden="true" />}
      title={localizeUi(
        created
          ? "ui.chat.sensitivefileworkspaceapprovalcard.titleCreate"
          : "ui.chat.sensitivefileworkspaceapprovalcard.titleUpdate",
        { file },
      )}
      meta={localizeUi("mari.needsYou.fileFact")}
      then={<Trans i18nKey="mari.needsYou.then.file" components={{ b: <b /> }} />}
      actions={
        <>
          <button
            type="button"
            onClick={() => onDiscard(approval.id)}
            disabled={busy || disabled}
            className="mari-link"
          >
            {localizeUi("ui.chat.dependencyworkspaceapprovalcard.notNow")}
          </button>
          <button
            type="button"
            onClick={() => onApprove(approval.id)}
            disabled={busy || disabled}
            className="mari-btn mari-btn--solid"
          >
            {busy ? <Loader2 size="0.8rem" className="animate-spin" aria-hidden="true" /> : null}
            {busy
              ? localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.applying")
              : localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.applyChange")}
          </button>
        </>
      }
    >
      {approval.reason ? <p>{approval.reason}</p> : null}
      <TechnicalDetails
        rows={[
          [localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.path"), <code>{approval.path}</code>],
          [localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.hash"), <code>{approval.afterHash}</code>],
        ]}
      >
        <pre>
          {approval.preview}
          {approval.previewTruncated
            ? `\n\n${localizeUi("ui.chat.sensitivefileworkspaceapprovalcard.previewTruncated")}`
            : ""}
        </pre>
      </TechnicalDetails>
    </MariCard>
  );
}

/**
 * Direction A / R10: once answered, a prompt folds to one row of the outcome group. A data review keeps
 * its face, name and fact and ends in "✓ Kept" / "✓ Undone"; an install or file prompt is its line.
 */
export function ResolvedPromptLine({
  approval,
  outcome,
}: {
  approval: MariWorkspacePendingApproval;
  outcome: "applied" | "discarded";
}) {
  const { t: localizeUi } = useUiTranslation();
  if (approval.kind !== "dependency_install" && approval.kind !== "sensitive_file") {
    // Slice 72: the answered change still opens to what changed, as it did while it waited; only its
    // buttons become "✓ Kept" / "✓ Undone".
    return (
      <MariEditEasyViewer
        approval={approval}
        raw={null}
        actions={
          <span className="mari-row__done" role="status">
            <Check aria-hidden="true" />
            {localizeUi(outcome === "applied" ? "ui.chat.mariappliededit.kept" : "ui.chat.mariappliededit.undone")}
          </span>
        }
      />
    );
  }
  const install = approval.kind === "dependency_install";
  const name = install ? approval.packageName : approval.path.split(/[\\/]/u).at(-1) || approval.path;
  const title = install
    ? localizeUi("ui.chat.dependencyworkspaceapprovalcard.title", { name })
    : localizeUi(
        approval.changeType === "create"
          ? "ui.chat.sensitivefileworkspaceapprovalcard.titleCreate"
          : "ui.chat.sensitivefileworkspaceapprovalcard.titleUpdate",
        { file: name },
      );
  const Icon = outcome === "discarded" ? Minus : Check;
  return (
    <MariRow
      slot={<Icon aria-hidden="true" />}
      title={
        outcome === "discarded"
          ? localizeUi("ui.chat.mariresolvedprompt.skipped", { title })
          : localizeUi(install ? "ui.chat.mariresolvedprompt.installed" : "ui.chat.mariresolvedprompt.saved", { name })
      }
      role="status"
    />
  );
}

export function WorkspaceApprovalCard({
  approval,
  busy,
  disabled,
  highlighted = false,
  onKeep,
  onTurnOn,
  onRestore,
  onRejectRows,
  onRenderPrompt,
}: {
  approval: MariWorkspacePendingApproval;
  busy: boolean;
  disabled: boolean;
  /** R9: a brief highlight when the omnibar jumped straight to this review. */
  highlighted?: boolean;
  onKeep: (id: string) => void;
  onTurnOn?: (memoryId: string) => Promise<boolean>;
  onRestore: (id: string) => void;
  onRejectRows?: (
    id: string,
    rows: Array<{ index: number; table: string; id: string; action: string }>,
  ) => Promise<boolean>;
  onRenderPrompt?: (
    id: string,
    row: { index: number; table: string; id: string; action: string },
  ) => Promise<{ before: MariPromptRenderSide; after: MariPromptRenderSide } | null>;
}) {
  const { t: localizeUi } = useUiTranslation();
  let card: ReactNode;
  if (approval.kind === "dependency_install") {
    card = (
      <DependencyWorkspaceApprovalCard
        approval={approval}
        busy={busy}
        disabled={disabled}
        onApprove={onKeep}
        onDiscard={onRestore}
      />
    );
  } else if (approval.kind === "sensitive_file") {
    card = (
      <SensitiveFileWorkspaceApprovalCard
        approval={approval}
        busy={busy}
        disabled={disabled}
        onApprove={onKeep}
        onDiscard={onRestore}
      />
    );
  } else {
    card = (
      <DatabaseWorkspaceApprovalCard
        approval={approval}
        busy={busy}
        disabled={disabled}
        onKeep={onKeep}
        onTurnOn={onTurnOn}
        onRestore={onRestore}
        onRejectRows={onRejectRows}
        onRenderPrompt={onRenderPrompt}
      />
    );
  }
  return (
    <div
      id={`mari-workspace-review-${approval.id}`}
      data-review-id={approval.id}
      className={cn("mari-inline-review", highlighted && "mari-inline-review--jump")}
      aria-label={localizeUi("commandCenter.completion.review")}
    >
      {card}
    </div>
  );
}
