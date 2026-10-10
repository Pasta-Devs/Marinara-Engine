// Slice 74 / 87: what Professor Mari changed, as a card under her answer. Built only from the record on her
// message (`mariWorkspaceActionResults`), so it reads the same live, after Undo and after a reload: face and
// name, what changed in words, the changed fields (folded: one key field; opened: every field), her reason,
// and Undo while the undo copy lasts. No Keep: an applied change is already saved, and Undo is the way back.

import { useState, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { AlertTriangle, Check, ChevronDown, ExternalLink, Undo2 } from "lucide-react";
import {
  mariReceiptReviewIds,
  mariReceiptState,
  type MariChangeExcerpt,
  type MariReceiptState,
  type MariWorkspaceActionResult,
  type MariWorkspacePendingApproval,
} from "@marinara-engine/shared";

import { diffWords } from "../../lib/word-diff";
import { fieldLabel } from "../../lib/mari-edit-diff";
import { cn } from "../../lib/utils";

type Localize = (key: string, options?: Record<string, unknown>) => string;

/** The turn's Undo wiring. Absent where the transcript cannot answer reviews. */
export interface MariReceiptControls {
  /** Reviews of this chat still waiting for Undo, by id. */
  pending: ReadonlyMap<string, MariWorkspacePendingApproval>;
  /** Reviews answered in this session before the message caught up. */
  answered: ReadonlyMap<string, "kept" | "undone">;
  busy: boolean;
  /** The omnibar just jumped to this review. */
  isHighlighted?: (reviewId: string) => boolean;
  onAnswer: (approvals: MariWorkspacePendingApproval[], keep: boolean) => void;
  /** The raw command and row counts behind "Technical details". */
  renderRaw?: (approval: MariWorkspacePendingApproval) => ReactNode;
  /** Try again on a change that did not save: sends "try again" in her chat. */
  onRetry?: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "parameters.maxTokens" reads as "Parameters · Max tokens". */
function label(field: string) {
  const [parent, child] = field.split(".");
  return child ? `${fieldLabel(parent!)} · ${fieldLabel(child)}` : fieldLabel(field);
}

function words(text: string) {
  return text.split(/\s+/u).filter(Boolean);
}

/** The share of old words still in the new text, as whole words. Most kept is an edit, else a rewrite. */
function keptShare(before: string, after: string) {
  const now = new Set(words(after));
  const old = words(before);
  return old.length ? old.filter((word) => now.has(word)).length / old.length : 0;
}

// An old message saved every column a row write touched, ids and timestamps too; they say nothing.
const OLD_NOISE = /^(?:id|.+Id|.+_id|(?:created|updated)(?:At|_at)|embedding)$/u;
const oldFields = (result: MariWorkspaceActionResult) => result.changedFields.filter((field) => !OLD_NOISE.test(field));

/** A lorebook's list of entries (its items), not a tag or greeting list. */
const isEntryList = (change: MariChangeExcerpt): change is Extract<MariChangeExcerpt, { kind: "list" }> =>
  change.kind === "list" && change.items !== undefined;

/** "New character · 13 fields", or "Changed description, personality, scenario and 6 more". */
export function receiptSummary(result: MariWorkspaceActionResult, t: Localize, lang: string): string {
  const list = (items: string[]) => new Intl.ListFormat(lang, { type: "conjunction" }).format(items);
  if (!result.changes) {
    const fields = oldFields(result).map((field) => label(field).toLocaleLowerCase(lang));
    return fields.length > 3
      ? t("ui.chat.marichangereceipt.oldFieldsMore", { fields: list(fields.slice(0, 3)), count: fields.length - 3 })
      : t("ui.chat.homeprofessormarichat.changedFields", { fields: list(fields) });
  }
  const count = result.changes.length + (result.moreChanges ?? 0);
  if (result.status === "created") {
    const thing = t(`ui.chat.marichangereceipt.kind.${result.resource.kind}`);
    // A lorebook's entries count apart from its fields: "New lorebook · 3 fields · 3 entries".
    const entries = result.changes.filter(isEntryList);
    const entryCount = entries.reduce((total, { count: n }) => total + n.added + n.edited + n.removed, 0);
    const fieldCount = result.changes.length - entries.length + (result.moreChanges ?? 0);
    return [
      t("ui.chat.marichangereceipt.newRecord", { thing }),
      t("ui.chat.marichangereceipt.fieldCount", { count: fieldCount }),
      ...(entryCount > 0 ? [t("ui.chat.marichangereceipt.entryCount", { count: entryCount })] : []),
    ].join(" · ");
  }
  // A nested setting names its parent once: "Parameters" for max tokens and temperature together.
  const parts = [...new Set(result.changes.map((change) => change.field.split(".")[0]!))];
  const shown = parts.slice(0, 3).map((field) => fieldLabel(field).toLocaleLowerCase(lang));
  return count > shown.length
    ? t("ui.chat.marichangereceipt.changedMore", { fields: shown.join(", "), count: count - shown.length })
    : t("ui.chat.marichangereceipt.changed", { fields: list(shown) });
}

/** "Undo until 19:05" when it ends today, "Undo until tomorrow, 19:05" next day, nothing while it is more than a day away. */
function undoLabel(iso: string | undefined, t: Localize, lang: string): string | null {
  const until = iso ? Date.parse(iso) : NaN;
  const now = Date.now();
  if (!Number.isFinite(until) || until <= now || until - now >= DAY_MS) return null;
  const time = new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit" }).format(until);
  const sameDay = new Date(until).toDateString() === new Date(now).toDateString();
  return t(sameDay ? "ui.chat.marichangereceipt.undoUntilToday" : "ui.chat.marichangereceipt.undoUntilTomorrow", {
    time,
  });
}

/** Field label over a box. Box text: old words struck, new words marked; both marks, not colour only. */
export function Field({ label: name, children, folded }: { label: string; children: ReactNode; folded?: boolean }) {
  return (
    <div className={cn("mari-receipt__field", folded && "mari-receipt__field--folded")}>
      <span className="mari-receipt__label">{name}</span>
      {children}
    </div>
  );
}

function TextBody({ change }: { change: Extract<MariChangeExcerpt, { kind: "text" }> }) {
  if (!change.before || !change.after) {
    return (
      <div className={cn("mari-receipt__box", !change.after && "mari-receipt__box--old")}>
        {change.after || change.before}
      </div>
    );
  }
  if (keptShare(change.before, change.after) >= 0.4) {
    return (
      <div className="mari-receipt__box">
        {diffWords(change.before, change.after).map((part, index) =>
          part.type === "removed" ? (
            <del key={index}>{part.value}</del>
          ) : part.type === "added" ? (
            <ins key={index}>{part.value}</ins>
          ) : (
            <span key={index}>{part.value}</span>
          ),
        )}
      </div>
    );
  }
  // A rewrite: the old text struck in its own quiet box, the new text in a marked box under it.
  return (
    <>
      <div className="mari-receipt__box mari-receipt__box--old">
        <del>{change.before}</del>
      </div>
      <div className="mari-receipt__box mari-receipt__box--new">
        <ins>{change.after}</ins>
      </div>
    </>
  );
}

function ListBody({ change }: { change: Extract<MariChangeExcerpt, { kind: "list" }> }) {
  const { t } = useUiTranslation();
  const hidden =
    change.count.added +
    change.count.edited +
    change.count.removed -
    (change.added.length + change.edited.length + change.removed.length);
  if (change.items?.length) {
    return (
      <div className="mari-receipt__entries">
        {change.items.map((item) => (
          <div key={item.name} className="mari-receipt__entry">
            <span className="mari-receipt__entry-name">
              {item.name}
              {change.added.includes(item.name) ? (
                <span className="mari-new-badge">{t("ui.chat.mariediteasyviewer.actionNew")}</span>
              ) : null}
            </span>
            {item.keys?.length ? (
              <span className="mari-receipt__chips">
                {item.keys.map((key) => (
                  <span key={key} className="mari-receipt__chip">
                    {key}
                  </span>
                ))}
              </span>
            ) : null}
            {item.text ? <span className="mari-receipt__entry-text">{item.text}</span> : null}
          </div>
        ))}
        {hidden > 0 ? (
          <span className="mari-receipt__muted">{t("ui.chat.marichangereceipt.more", { count: hidden })}</span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="mari-receipt__chips">
      {change.added.map((name) => (
        <span key={`+${name}`} className="mari-receipt__chip mari-receipt__chip--ins">
          {name}
        </span>
      ))}
      {change.edited.map((name) => (
        <span key={`~${name}`} className="mari-receipt__chip">
          {name}
        </span>
      ))}
      {change.removed.map((name) => (
        <span key={`-${name}`} className="mari-receipt__chip mari-receipt__chip--del">
          {name}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="mari-receipt__muted">{t("ui.chat.marichangereceipt.more", { count: hidden })}</span>
      ) : null}
    </div>
  );
}

/** One changed field. A created record's switches are grouped by the caller, not shown here. */
function FieldView({ change, folded }: { change: MariChangeExcerpt; folded?: boolean }) {
  const name = label(change.field);
  if (change.kind === "list") {
    return (
      <Field label={name} folded={folded}>
        <ListBody change={change} />
      </Field>
    );
  }
  if (change.kind === "value") {
    return (
      <Field label={name} folded={folded}>
        <div className="mari-receipt__value">
          {change.before ? <del>{change.before}</del> : null}
          {change.before && change.after ? (
            <span className="mari-receipt__arrow" aria-hidden="true">
              →
            </span>
          ) : null}
          {change.after ? <ins>{change.after}</ins> : null}
        </div>
      </Field>
    );
  }
  return (
    <Field label={name} folded={folded}>
      <TextBody change={change} />
    </Field>
  );
}

/** Opened: every changed field. A created record's switches and numbers go to one Settings field of chips. */
function Fields({ result }: { result: MariWorkspaceActionResult }) {
  const { t } = useUiTranslation();
  if (!result.changes) {
    return (
      <>
        <p className="mari-receipt__muted">{t("ui.chat.marichangereceipt.oldNote")}</p>
        <div className="mari-receipt__chips">
          {oldFields(result).map((field) => (
            <span key={field} className="mari-receipt__chip">
              {label(field)}
            </span>
          ))}
        </div>
      </>
    );
  }
  const created = result.status === "created";
  const settings = created
    ? result.changes.filter(
        (change): change is Extract<MariChangeExcerpt, { kind: "value" }> => change.kind === "value",
      )
    : [];
  return (
    <>
      {result.changes
        .filter((change) => !created || change.kind !== "value")
        .map((change) => (
          <FieldView key={`${change.kind}:${change.field}`} change={change} />
        ))}
      {settings.length ? (
        <Field label={t("ui.chat.marichangereceipt.settings")}>
          <span className="mari-receipt__chips">
            {settings.map((change) => (
              <span key={change.field} className="mari-receipt__chip">
                {label(change.field)} {change.after}
              </span>
            ))}
          </span>
        </Field>
      ) : null}
      {result.moreChanges ? (
        <p className="mari-receipt__muted">
          {t("ui.chat.marichangereceipt.moreFields", { count: result.moreChanges })}
        </p>
      ) : null}
    </>
  );
}

/** Folded: one key field - a lorebook's entries, else the first rewritten text, else the first field. */
function keyChange(result: MariWorkspaceActionResult): MariChangeExcerpt | undefined {
  const changes = result.changes ?? [];
  return (
    changes.find(
      (change) => change.kind === "list" && !!change.items?.some((item) => item.keys?.length || item.text),
    ) ??
    changes.find((change) => change.kind === "text" && !!change.before && !!change.after) ??
    changes.find((change) => change.kind === "text" && change.field !== "name" && change.field !== "title") ??
    changes.find((change) => change.kind === "text") ??
    changes[0]
  );
}

function StateMark({ state }: { state: MariReceiptState }) {
  const { t } = useUiTranslation();
  if (state === "old") return null;
  if (state === "undone") {
    return (
      <span className="mari-receipt__state" data-tone="muted">
        <Undo2 aria-hidden="true" />
        {t("ui.chat.mariappliededit.undone")}
      </span>
    );
  }
  return (
    <span className="mari-receipt__state" data-tone="ok">
      <Check aria-hidden="true" />
      {t("ui.chat.marichangereceipt.applied")}
    </span>
  );
}

/** "Created 3 characters" when every record is new and of one kind; "Changed 3 things" otherwise. */
function groupLabel(results: readonly MariWorkspaceActionResult[], t: Localize) {
  const kinds = new Set(results.map((result) => result.resource.kind));
  if (results.every((result) => result.status === "created") && kinds.size === 1) {
    const kind = [...kinds][0]!;
    return t("ui.chat.marichangereceipt.createdMany", {
      count: results.length,
      things: t(`ui.chat.marichangereceipt.kindPlural.${kind}`, { count: results.length }),
    });
  }
  return t("ui.chat.marichangereceipt.labelMany", { count: results.length });
}

/** A change that did not save: "Not saved", her error in plain words, and Try again. */
function FailedReceipt({
  result,
  faceOf,
  name,
  busy,
  onRetry,
}: {
  result: MariWorkspaceActionResult;
  faceOf: (result: MariWorkspaceActionResult) => ReactNode;
  name: string;
  busy: boolean;
  onRetry?: () => void;
}) {
  const { t } = useUiTranslation();
  // A record that was never found has no name: the server summary ("Not saved character.") is no title.
  const title =
    name && name !== result.summary
      ? name
      : t("ui.chat.marichangereceipt.failedTitle", {
          thing: t(`ui.chat.marichangereceipt.kind.${result.resource.kind}`),
        });
  return (
    <section
      className="mari-list mari-receipt"
      data-state="failed"
      aria-label={t("ui.chat.marichangereceipt.failedLabel", { name: title })}
    >
      <div className="mari-receipt__head">
        <span className="mari-receipt__face">{faceOf(result)}</span>
        <span className="mari-receipt__text">
          <span className="mari-receipt__name">
            <span>{title}</span>
          </span>
        </span>
      </div>
      <p className="mari-receipt__error">
        <AlertTriangle aria-hidden="true" />
        <span>{result.error}</span>
      </p>
      <div className="mari-receipt__foot">
        <span className="mari-receipt__actions">
          <span className="mari-receipt__state" data-tone="bad">
            <AlertTriangle aria-hidden="true" />
            {t("ui.chat.marichangereceipt.notSaved")}
          </span>
          {onRetry ? (
            <button type="button" className="mari-btn" disabled={busy} onClick={onRetry}>
              {t("ui.chat.marichangereceipt.tryAgain")}
            </button>
          ) : null}
        </span>
      </div>
    </section>
  );
}

export function MariChangeReceipt({
  results,
  faceOf,
  nameOf,
  fallbackWhy,
  controls,
  onOpen,
}: {
  results: readonly MariWorkspaceActionResult[];
  faceOf: (result: MariWorkspaceActionResult) => ReactNode;
  /** The record's current name (it may have been renamed since). */
  nameOf: (result: MariWorkspaceActionResult) => string;
  /** Her answer's first "Why" point, used when a change carries no reason. */
  fallbackWhy?: string;
  controls?: MariReceiptControls;
  onOpen: (result: MariWorkspaceActionResult) => void;
}) {
  const { t, i18n } = useUiTranslation();
  const lang = i18n.resolvedLanguage ?? "en";
  const [openRecords, setOpenRecords] = useState<ReadonlySet<number>>(() => new Set());
  const pendingIds = new Set(controls?.pending.keys() ?? []);
  const states = results.map((result) => mariReceiptState(result, pendingIds, controls?.answered));
  const ids = results.flatMap(mariReceiptReviewIds);
  const pending = ids.flatMap((id) => {
    const approval = controls?.pending.get(id);
    return approval ? [approval] : [];
  });
  // A "kept" answer is an applied change with its undo copy gone: it reads as applied, with no action.
  const state = states.includes("open")
    ? "open"
    : states.every((value) => value === states[0])
      ? states[0]!
      : states.includes("undone")
        ? "undone"
        : "kept";
  const multi = results.length > 1;
  if (!multi && results[0]!.status === "failed") {
    return (
      <FailedReceipt
        result={results[0]!}
        faceOf={faceOf}
        name={nameOf(results[0]!)}
        busy={controls?.busy ?? false}
        onRetry={controls?.onRetry}
      />
    );
  }
  const why = (multi ? results.find((result) => result.reason)?.reason : results[0]?.reason) ?? fallbackWhy;
  const undoUntil = results
    .map((result) => result.undoUntil)
    .filter(Boolean)
    .sort()[0];
  const deadline = state === "open" ? undoLabel(undoUntil, t, lang) : null;
  const busy = controls?.busy ?? false;
  const name = nameOf;
  const [firstId, ...otherIds] = pending.map((approval) => approval.id);
  const undoAll = (approvals = pending) =>
    // Undo newest first, so each restore finds the rows as the next-newer change left them.
    controls?.onAnswer(
      [...approvals].sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt)),
      false,
    );
  const toggle = (index: number) =>
    setOpenRecords((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <section
      id={firstId ? `mari-workspace-review-${firstId}` : undefined}
      data-review-id={firstId}
      className={cn(
        "mari-list mari-receipt",
        ids.some((id) => controls?.isHighlighted?.(id)) && "mari-inline-review--jump",
      )}
      data-state={state}
      data-multi={multi || undefined}
      aria-label={
        multi
          ? t("ui.chat.marichangereceipt.labelMany", { count: results.length })
          : t("ui.chat.marichangereceipt.label", { name: name(results[0]!) })
      }
    >
      {/* The omnibar jumps to a review by id; a merged record answers for all of its reviews. */}
      {otherIds.map((id) => (
        <span key={id} id={`mari-workspace-review-${id}`} data-review-id={id} hidden />
      ))}
      {multi ? (
        <div className="mari-receipt__group">
          <span className="mari-receipt__faces">
            {results.slice(0, 3).map((result) => (
              <span key={`${result.resource.kind}:${result.resource.id}`}>{faceOf(result)}</span>
            ))}
          </span>
          <span>{groupLabel(results, t)}</span>
        </div>
      ) : null}
      {results.map((result, index) => {
        const open = openRecords.has(index);
        const changes = result.changes ?? [];
        const total = changes.length + (result.moreChanges ?? 0);
        const recordPending = mariReceiptReviewIds(result).flatMap((id) => {
          const approval = controls?.pending.get(id);
          return approval ? [approval] : [];
        });
        const key = multi ? undefined : keyChange(result);
        return (
          <div key={`${result.resource.kind}:${result.resource.id}`} className="mari-receipt__record" data-open={open}>
            <div className="mari-receipt__head">
              <span className="mari-receipt__face">{faceOf(result)}</span>
              <span className="mari-receipt__text">
                <span className="mari-receipt__name">
                  <span>{name(result)}</span>
                  {result.status === "created" ? (
                    <span className="mari-new-badge">{t("ui.chat.mariediteasyviewer.actionNew")}</span>
                  ) : null}
                </span>
                <span className="mari-receipt__what">{receiptSummary(result, t, lang)}</span>
              </span>
              <button
                type="button"
                className="mari-receipt__open"
                aria-label={t("ui.chat.marichangereceipt.open", { name: name(result) })}
                title={t("ui.chat.marichangereceipt.open", { name: name(result) })}
                onClick={() => onOpen(result)}
              >
                <ExternalLink aria-hidden="true" />
              </button>
            </div>
            {!open && key ? (
              <div className="mari-receipt__folded">
                <FieldView change={key} folded />
              </div>
            ) : null}
            {open ? (
              <div className="mari-receipt__body">
                <Fields result={result} />
                {multi && result.reason && result.reason !== why ? (
                  <p className="mari-receipt__why">
                    <b>{t("ui.chat.homeprofessormarichat.why")}</b> {result.reason}
                  </p>
                ) : null}
                <div className="mari-receipt__links">
                  <button type="button" className="mari-link" onClick={() => onOpen(result)}>
                    {t("ui.chat.marichangereceipt.open", { name: name(result) })}
                    <ExternalLink aria-hidden="true" />
                  </button>
                  {multi && recordPending.length > 0 ? (
                    <button type="button" className="mari-link" disabled={busy} onClick={() => undoAll(recordPending)}>
                      <Undo2 aria-hidden="true" />
                      {t("ui.chat.marichangereceipt.undoOnly", { name: name(result) })}
                    </button>
                  ) : null}
                  {controls?.renderRaw && recordPending.length > 0 ? (
                    <details className="mari-receipt__details">
                      <summary className="mari-link">{t("ui.chat.mariapprovalcard.technicalDetails")}</summary>
                      {recordPending.map((approval) => (
                        <div key={approval.id}>{controls.renderRaw?.(approval)}</div>
                      ))}
                    </details>
                  ) : null}
                </div>
              </div>
            ) : null}
            {(multi ? total > 0 : total > 1) ? (
              <button type="button" className="mari-receipt__more" aria-expanded={open} onClick={() => toggle(index)}>
                {open
                  ? t("ui.chat.marichangereceipt.showLess")
                  : t("ui.chat.marichangereceipt.showAll", { count: total })}
                <ChevronDown className="mari-receipt__chev" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        );
      })}
      <div className="mari-receipt__foot">
        {why && state !== "old" ? (
          <p className="mari-receipt__why">
            <b>{t("ui.chat.homeprofessormarichat.why")}</b> {why}
          </p>
        ) : null}
        <span className="mari-receipt__actions">
          {state === "undone" ? (
            <>
              <StateMark state="undone" />
              <span className="mari-receipt__muted">{t("ui.chat.marichangereceipt.restored")}</span>
            </>
          ) : state === "old" ? (
            multi ? null : (
              <button type="button" className="mari-link" onClick={() => onOpen(results[0]!)}>
                {t("ui.chat.marichangereceipt.open", { name: name(results[0]!) })}
                <ExternalLink aria-hidden="true" />
              </button>
            )
          ) : (
            <>
              <StateMark state={state === "open" || state === "kept" || state === "saved" ? "kept" : state} />
              {state === "closed" ? (
                <span className="mari-receipt__muted">
                  {undoUntil && Date.parse(undoUntil) < Date.now()
                    ? t("ui.chat.marichangereceipt.undoClosedOn", {
                        date: new Intl.DateTimeFormat(lang, { month: "short", day: "numeric" }).format(
                          new Date(undoUntil),
                        ),
                      })
                    : t("ui.chat.marichangereceipt.undoClosed")}
                </span>
              ) : null}
              {state === "saved" ? (
                <span className="mari-receipt__muted">{t("ui.chat.marichangereceipt.noUndo")}</span>
              ) : null}
              {deadline ? <span className="mari-receipt__muted">{deadline}</span> : null}
              {state === "open" ? (
                <button type="button" className="mari-btn" disabled={busy} onClick={() => undoAll()}>
                  <Undo2 aria-hidden="true" />
                  {t(multi ? "ui.chat.marichangereceipt.undoAll" : "ui.chat.mariappliededit.undo")}
                </button>
              ) : null}
            </>
          )}
        </span>
      </div>
    </section>
  );
}
