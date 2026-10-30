// Slice 5: Professor Mari's change shown in the editor field itself. While her change to the open
// character waits, each changed field shows her diff in place (read-only) with Keep / Not this one
// / Edit / Next; after Keep the field says "Edited by Prof. Mari" with Undo until the user edits
// it, leaves, or the undo window ends. Her card stays the full record; this is an extra surface.
import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Trans, useTranslation as useUiTranslation } from "react-i18next";
import { ArrowDown, Check, Pencil, Undo2 } from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { useMariAppearancePack } from "../../hooks/use-mari-appearance-pack";
import { fieldLabel } from "../../lib/mari-edit-diff";
import { heldChangeSettledByUser } from "../../lib/mari-editor-fields";
import { mariFieldLabel } from "../../hooks/use-mari-editor-fields";
import { TextBody, undoLabel } from "../chat/MariChangeReceipt";
import { MariFieldWriting } from "./MariFieldWriting";

interface MariFieldReviewValue {
  entityId: string;
  /** Fields still under review here, editor order. */
  waiting: Array<{ fieldId: string; value: string }>;
  total: number;
  others: number;
  /** True when Keep was sent. */
  keep: () => Promise<boolean>;
  decline: (fieldId: string) => void;
  edit: (fieldId: string, value: string) => void;
  /** The field's current form text. */
  current: (fieldId: string) => string;
  /** The user has unsaved text in this field. */
  touched: (fieldId: string) => boolean;
  declined: string | null;
  kept: { fieldIds: string[]; undoUntil: string | null; undo: () => void; savedUnsaved: boolean } | null;
  dismissKept: (fieldId: string) => void;
}

const MariFieldReviewContext = createContext<MariFieldReviewValue | null>(null);
export const MariFieldReviewProvider = MariFieldReviewContext.Provider;

/** The editor's review state. `edit` puts her text into the form as the user's unsaved edit. */
export function useMariFieldReview({
  entityId,
  current,
  touched,
  edit,
  beforeKeep,
  keepDropped,
  memberIds,
}: {
  entityId: string | null;
  /** Records shown inside this editor whose fields it reviews too (a lorebook's entries). */
  memberIds?: ReadonlySet<string>;
  current: (fieldId: string) => string;
  touched: (fieldId: string) => boolean;
  edit: (fieldId: string, value: string) => void;
  /** Runs before Keep: "saved" when it saved the user's unsaved text, "failed" stops Keep. */
  beforeKeep: (takenOver: string[]) => Promise<"saved" | "clean" | "failed">;
  /** A Keep that saved but sent nothing. */
  keepDropped: () => void;
}) {
  const review = useUIStore((state) => state.mariFieldReview);
  // A kept change already listed when the editor opened is old news: leaving ends its line.
  const [staleKeptKey] = useState(() => (review?.mode === "kept" ? review.key : null));
  const [edited, setEdited] = useState<{ key: string; ids: string[]; before: Record<string, string> }>({
    key: "",
    ids: [],
    before: {},
  });
  // The held change answered here (Keep or Not this one) until her reply ends; `declined` names
  // the declined field. A reply that leaves the same change waiting (a failed send) shows it again.
  const [answered, setAnswered] = useState<{
    key: string;
    entityId: string;
    declined: string | null;
    busy?: boolean;
  } | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  // The kept review that saved the user's unsaved text first; "pending" until it arrives.
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const keeping = useRef(false);
  const [, setTick] = useState(0);

  const waitingReview = review?.mode === "waiting" ? review : null;
  const keptReview = review?.mode === "kept" && review.key !== staleKeptKey ? review : null;
  const undoUntil = keptReview?.undoUntil ? Date.parse(keptReview.undoUntil) : NaN;
  useEffect(() => {
    if (!Number.isFinite(undoUntil)) return;
    const timer = window.setTimeout(
      () => setTick((tick) => tick + 1),
      Math.min(Math.max(undoUntil - Date.now(), 0), 2 ** 31 - 1),
    );
    return () => window.clearTimeout(timer);
  }, [undoUntil]);

  const editedIds = waitingReview && edited.key === waitingReview.key ? edited.ids : [];
  const answeredHere = answered?.entityId === entityId ? answered : null;
  const waiting =
    (answeredHere?.key === waitingReview?.key ? null : waitingReview)?.fields
      .filter(
        (field) =>
          (field.entityId === entityId || !!memberIds?.has(field.entityId)) && !editedIds.includes(field.fieldId),
      )
      .map(({ fieldId, value }) => ({ fieldId, value })) ?? [];
  // Her header names this count; it is 0 while no character editor is open.
  const waitingCount = waiting.length;
  useEffect(() => {
    useUIStore.getState().setMariFieldWaitingCount(waitingCount);
    return () => useUIStore.getState().setMariFieldWaitingCount(0);
  }, [waitingCount]);
  // Edit, then the user's own Save, of every field she held answers her held change; nothing is sent.
  const settling = useRef<string | null>(null);
  useEffect(() => {
    if (!waitingReview || answeredHere || keeping.current || settling.current === waitingReview.key) return;
    const here = (id: string) => id === entityId || !!memberIds?.has(id);
    const before = edited.key === waitingReview.key ? edited.before : {};
    if (!heldChangeSettledByUser(waitingReview, here, before, touched, current)) return;
    const { key } = waitingReview;
    settling.current = key;
    void waitingReview.settle(key).then((done) => {
      if (!done && settling.current === key) settling.current = null;
    });
  });
  const keptIds =
    keptReview && !(undoUntil <= Date.now())
      ? keptReview.fields
          .filter(
            (field) =>
              (field.entityId === entityId || !!memberIds?.has(field.entityId)) &&
              !dismissed.includes(`${keptReview.key}:${field.fieldId}`),
          )
          .map((field) => field.fieldId)
      : [];
  const declinedField = answeredHere?.declined ?? null;
  if (answered && !answered.busy && review?.mode === "busy") setAnswered({ ...answered, busy: true });
  if (answered?.busy && review?.mode !== "busy") setAnswered(null);
  // Her Keep reply brought no kept review; a later reply's kept review is not this Keep's.
  if (savedFor === "pending" && !answered && review?.mode === "busy") setSavedFor(null);
  if (savedFor === "pending" && keptReview) setSavedFor(keptReview.key);

  const value: MariFieldReviewValue | null =
    entityId && (waiting.length > 0 || keptIds.length > 0 || declinedField)
      ? {
          entityId,
          waiting,
          total: waitingReview?.total ?? 0,
          others: waitingReview?.others ?? 0,
          keep: async () => {
            if (!waitingReview || keeping.current) return false;
            const { key } = waitingReview;
            keeping.current = true;
            try {
              const saved = await beforeKeep(editedIds);
              // The save can outlast a thread switch: accept only the change it saved for.
              const live = useUIStore.getState().mariFieldReview;
              if (saved === "failed") return false;
              if (live?.mode !== "waiting" || live.key !== key || !live.keep()) {
                keepDropped();
                return false;
              }
              setSavedFor(saved === "saved" ? "pending" : null);
              setAnswered({ key, entityId, declined: null });
              return true;
            } finally {
              keeping.current = false;
            }
          },
          decline: (fieldId) => {
            if (!waitingReview) return;
            if (waitingReview.decline(fieldId)) setAnswered({ key: waitingReview.key, entityId, declined: fieldId });
          },
          edit: (fieldId, text) => {
            if (!waitingReview) return;
            // The field's text before Edit: only a saved value that differs from it answers her change.
            const before = current(fieldId);
            setEdited((prev) => {
              const same = prev.key === waitingReview.key;
              return {
                key: waitingReview.key,
                ids: [...(same ? prev.ids : []), fieldId],
                before: { [fieldId]: before, ...(same ? prev.before : {}) },
              };
            });
            edit(fieldId, text);
          },
          current,
          touched,
          declined: declinedField,
          kept:
            keptReview && keptIds.length > 0
              ? {
                  fieldIds: keptIds,
                  undoUntil: keptReview.undoUntil,
                  undo: keptReview.undo,
                  savedUnsaved: savedFor === keptReview.key,
                }
              : null,
          dismissKept: (fieldId) => keptReview && setDismissed((prev) => [...prev, `${keptReview.key}:${fieldId}`]),
        }
      : null;
  return { value, review };
}

function focusSoon(selector: string) {
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }));
}

/** Wraps one editor field: her diff in place while it waits, else the field plus its kept line. */
export function MariFieldReview({ field, children }: { field: string; children: ReactNode }) {
  const review = useContext(MariFieldReviewContext);
  // While the user types here her review waits for blur; a focused field hands focus to it.
  const [focus, setFocus] = useState<"none" | "focused" | "typing">("none");
  const index = review?.waiting.findIndex((item) => item.fieldId === field) ?? -1;
  const showReview = review && index >= 0 && focus !== "typing";
  const kept = review?.kept?.fieldIds.includes(field) ? review.kept : null;
  const writing = useUIStore((state) => state.mariFieldStream?.[state.characterDetailId ?? ""]?.[field]);
  if (writing !== undefined && focus === "none") return <MariFieldWriting text={writing} />;
  return (
    <div
      className="contents"
      onFocusCapture={() => setFocus((prev) => (prev === "none" ? "focused" : prev))}
      onBlurCapture={() => setFocus("none")}
      onInputCapture={() => {
        setFocus("typing");
        if (kept) review?.dismissKept(field);
      }}
    >
      {showReview ? <ReviewBox review={review} index={index} autoFocus={focus === "focused"} /> : children}
      {!showReview && kept ? <KeptLine kept={kept} /> : null}
      {review?.declined === field ? <DeclinedLine field={field} /> : null}
    </div>
  );
}

function ReviewBox({ review, index, autoFocus }: { review: MariFieldReviewValue; index: number; autoFocus: boolean }) {
  const { t } = useUiTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const [focusOnMount] = useState(autoFocus);
  useEffect(() => {
    if (focusOnMount) boxRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);
  const pack = useMariAppearancePack();
  const { fieldId, value } = review.waiting[index]!;
  const count = review.waiting.length;
  const label = mariFieldLabel(fieldId);
  const before = review.current(fieldId);
  const touched = review.touched(fieldId);
  const next = () => {
    const target = review.waiting[(index + 1) % count]!.fieldId;
    useUIStore.getState().revealMariField(review.entityId, target);
    focusSoon(`[data-mari-review="${CSS.escape(target)}"]`);
  };
  // The box unmounts after an answer; focus goes back to the field.
  const focusField = () => focusSoon(`[data-mari-field="${CSS.escape(fieldId)}"] textarea`);
  const keep = () => void review.keep().then((done) => done && focusField());
  const decline = () => {
    review.decline(fieldId);
    focusField();
  };
  const edit = () => {
    review.edit(fieldId, value);
    focusSoon(`[data-mari-field="${CSS.escape(fieldId)}"] textarea`);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      keep();
    } else if (event.key === "Escape") {
      // Esc answers the field; it must not also close Prof. Mari.
      event.preventDefault();
      event.stopPropagation();
      decline();
    } else if (event.key === "Tab" && !event.shiftKey && count > 1 && event.target === event.currentTarget) {
      event.preventDefault();
      next();
    }
  };
  return (
    <div
      ref={boxRef}
      className="mari-field-review"
      role="group"
      tabIndex={0}
      data-mari-review={fieldId}
      aria-label={t("mari.fieldReview.label", { field: label })}
      aria-keyshortcuts="Control+Enter Meta+Enter Escape"
      onKeyDown={onKeyDown}
    >
      <div className="mari-field-review__strip">
        <img src={pack.portraits.idle} alt="" draggable={false} />
        <span>
          <Trans i18nKey="mari.fieldReview.suggests" components={{ b: <b /> }} />
        </span>
        {count > 1 ? (
          <span className="mari-field-review__count">
            {t("mari.fieldReview.position", { index: index + 1, count })}
          </span>
        ) : null}
      </div>
      <p className="sr-only">{t("mari.fieldReview.proposes", { text: value })}</p>
      <div className="mari-field-review__text" aria-hidden="true">
        <TextBody change={{ field: fieldId, kind: "text", before, after: value }} />
      </div>
      {touched ? <p className="mari-field-review__conflict">{t("mari.fieldReview.conflict")}</p> : null}
      {review.others > 0 ? (
        <p className="mari-field-review__note">{t("mari.fieldReview.others", { count: review.others })}</p>
      ) : null}
      <div className="mari-field-review__bar">
        <button type="button" className="mari-link" onClick={edit}>
          <Pencil aria-hidden="true" />
          {t("mari.fieldReview.edit")}
        </button>
        {count > 1 ? (
          <button type="button" className="mari-link" onClick={next}>
            <ArrowDown aria-hidden="true" />
            {t("mari.fieldReview.next")}
          </button>
        ) : null}
        <span className="mari-field-review__spacer" />
        <button type="button" className="mari-btn" onClick={decline}>
          {t("mari.fieldReview.notThisOne")}
        </button>
        <button
          type="button"
          className="mari-btn mari-btn--solid"
          title={t("mari.fieldReview.keepHint")}
          onClick={keep}
        >
          <Check aria-hidden="true" />
          {review.total > 1 ? t("mari.fieldReview.keepAll", { count: review.total }) : t("mari.fieldReview.keep")}
        </button>
      </div>
    </div>
  );
}

function KeptLine({ kept }: { kept: NonNullable<MariFieldReviewValue["kept"]> }) {
  const { t, i18n } = useUiTranslation();
  const pack = useMariAppearancePack();
  const deadline = undoLabel(kept.undoUntil ?? undefined, t, i18n.resolvedLanguage ?? "en");
  return (
    <p className="mari-field-review-line" role="status">
      <img src={pack.portraits.idle} alt="" draggable={false} />
      <span>
        {[t("mari.fieldReview.edited"), kept.savedUnsaved ? t("mari.fieldReview.savedUnsaved") : null, deadline]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <button type="button" className="mari-btn" onClick={kept.undo}>
        <Undo2 aria-hidden="true" />
        {t("ui.chat.mariappliededit.undo")}
      </button>
    </p>
  );
}

function DeclinedLine({ field }: { field: string }) {
  const { t } = useUiTranslation();
  const pack = useMariAppearancePack();
  return (
    <p className="mari-field-review-line" role="status">
      <img src={pack.portraits.idle} alt="" draggable={false} />
      <span>{t("mari.fieldReview.declined", { field: mariFieldLabel(field, fieldLabel(field).toLowerCase()) })}</span>
    </p>
  );
}
