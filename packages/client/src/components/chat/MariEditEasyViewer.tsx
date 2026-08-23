// #4919 Easy Viewer: a human-readable rendering of Professor Mari's edits for the Keep/Restore
// review card. Instead of the raw `app_data … {JSON}` command, it shows each affected row as a
// before/after diff (removed text red, added text green), with a lorebook-entry layout that
// resembles the editor users know. All data comes from approval.diffPreview (full before/after row
// snapshots) — no server call. Per-row Dismiss hides a reviewed change to reduce clutter; the
// card's Keep/Restore still governs the whole batch.

import type { ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  computeFieldChanges,
  resolveLorebookVectorStatus,
  type FieldChange,
  type LorebookVectorStatus,
} from "../../lib/mari-edit-diff";
import { diffWords } from "../../lib/word-diff";
import type { MariDbPendingApproval, MariDbRowChange } from "@marinara-engine/shared";
import { ChevronDown, ChevronRight, Eye, FileText, Pencil, Sparkles, Trash2, Undo2 } from "lucide-react";

type Row = Record<string, unknown> | null | undefined;

export function rowKey(change: MariDbRowChange): string {
  return `${change.table}:${change.id}:${change.action}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringField(row: Row, key: string): string {
  const value = row?.[key];
  return value === null || value === undefined ? "" : String(value);
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}

function csvToList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string" && value.trim())
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  return [];
}

// ── Inline text diff (removed red / added green) ────────────────────────────

function InlineTextDiff({ before, after }: { before: string; after: string }) {
  const segments = diffWords(before, after);
  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((seg, i) => {
        if (seg.type === "equal") return <span key={i}>{seg.value}</span>;
        if (seg.type === "added") {
          return (
            <span key={i} className="rounded bg-emerald-500/25 text-[var(--foreground)]">
              {seg.value}
            </span>
          );
        }
        return (
          <span key={i} className="rounded bg-[var(--destructive)]/25 text-[var(--foreground)] line-through">
            {seg.value}
          </span>
        );
      })}
    </span>
  );
}

function EmptyValue() {
  const { t: localizeUi } = useUiTranslation();
  return <span className="italic opacity-60">{localizeUi("ui.chat.mariediteasyviewer.empty")}</span>;
}

// A single changed field: unified inline diff when both sides exist, otherwise a single
// green (added) or red (removed) block.
function FieldChangeView({ change }: { change: FieldChange }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {change.label}
      </div>
      {change.kind === "changed" ? (
        <p className="max-h-40 overflow-auto rounded-md bg-[var(--background)]/70 p-1.5 text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
          <InlineTextDiff before={change.before} after={change.after} />
        </p>
      ) : change.kind === "added" ? (
        <p className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-emerald-500/10 p-1.5 text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
          {change.after || <EmptyValue />}
        </p>
      ) : (
        <p className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[var(--destructive)]/10 p-1.5 text-[0.6875rem] leading-relaxed text-[var(--foreground)] line-through">
          {change.before || <EmptyValue />}
        </p>
      )}
    </div>
  );
}

// ── Lorebook key chips (added green / removed red / unchanged neutral) ───────

function KeyChips({ before, after }: { before: string[]; after: string[] }) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const all = [...new Set([...before, ...after])];
  if (all.length === 0) return <EmptyValue />;
  return (
    <div className="flex flex-wrap gap-1">
      {all.map((key) => {
        const added = afterSet.has(key) && !beforeSet.has(key);
        const removed = beforeSet.has(key) && !afterSet.has(key);
        return (
          <span
            key={key}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[0.625rem]",
              added && "bg-emerald-500/25 text-[var(--foreground)]",
              removed && "bg-[var(--destructive)]/25 text-[var(--foreground)] line-through",
              !added && !removed && "bg-[var(--secondary)]/60 text-[var(--muted-foreground)]",
            )}
          >
            {key}
          </span>
        );
      })}
    </div>
  );
}

// `enabled`/`constant`/`selective` are shown as prominent status (the Disabled badge + activation
// pill), not as generic on/off chips; the rest stay here as small "changed" chips.
const LOREBOOK_TOGGLES: Array<{ key: string; labelKey: string }> = [
  { key: "enabled", labelKey: "ui.chat.mariediteasyviewer.toggleEnabled" },
  { key: "matchWholeWords", labelKey: "ui.chat.mariediteasyviewer.toggleWholeWords" },
  { key: "caseSensitive", labelKey: "ui.chat.mariediteasyviewer.toggleCaseSensitive" },
  { key: "useRegex", labelKey: "ui.chat.mariediteasyviewer.toggleRegex" },
  { key: "locked", labelKey: "ui.chat.mariediteasyviewer.toggleLocked" },
];

// Fields the lorebook layout renders itself; anything else Mari changes (probability, timing,
// recursion, group weight, scan depth, folder, filters, selective logic) falls through to a generic
// field diff so no editable setting is silently missing from the view. `constant` is always shown by
// the activation pill (flipping it always moves the activation type) and `excludeFromVectorization`
// by the vectorization pill, so they are handled here. `selective` is NOT — it is dominated by
// `constant` in the pill, so it is filtered dynamically below (only when it actually moved the
// activation type) to avoid dropping a `selective` flip on a constant entry.
const LOREBOOK_HANDLED_PATHS = new Set([
  "name",
  "keys",
  "secondaryKeys",
  "content",
  "description",
  "enabled",
  "constant",
  "excludeFromVectorization",
  "matchWholeWords",
  "caseSensitive",
  "useRegex",
  "locked",
]);

// ── Lorebook entry activation + vectorization status ────────────────────────
// Mirror the engine's own lorebook editor (LorebookEntryRow / ChatRoleplayPanels): activation is a
// 3-way constant/selective/normal enum shown as a colored dot, "disabled" is the orthogonal `enabled`
// flag, and vectorization distinguishes excluded, embedded, and not-yet-embedded entries. Render
// them as always-visible status pills so a reviewer can tell an entry's kind at a glance, not only
// when Mari's edit happens to change one. Dots reuse the engine's colors (constant = yellow, selective = red, normal =
// emerald, vector = cyan); the pill background stays neutral so those colors are never confused with
// the diff's added-green / removed-red text.
type ActivationType = "constant" | "selective" | "normal";

const ACTIVATION_DOT: Record<ActivationType, string> = {
  constant: "bg-yellow-300",
  selective: "bg-red-400",
  normal: "bg-emerald-400",
};

const ACTIVATION_LABEL_KEY: Record<ActivationType, string> = {
  constant: "ui.chat.mariediteasyviewer.toggleConstant",
  selective: "ui.chat.mariediteasyviewer.modeSelective",
  normal: "ui.chat.mariediteasyviewer.modeNormal",
};

const ACTIVATION_HINT_KEY: Record<ActivationType, string> = {
  constant: "ui.chat.mariediteasyviewer.modeConstantHint",
  selective: "ui.chat.mariediteasyviewer.modeSelectiveHint",
  normal: "ui.chat.mariediteasyviewer.modeNormalHint",
};

function activationType(row: Row): ActivationType {
  if (truthy(row?.constant)) return "constant";
  if (truthy(row?.selective)) return "selective";
  return "normal";
}

function StatusPill({ dot, label, title, faded }: { dot?: string; label: string; title?: string; faded?: boolean }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-[var(--secondary)]/60 px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--foreground)]",
        faded && "opacity-55 line-through",
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />}
      {label}
    </span>
  );
}

// Render one status as a single pill, or `from → to` when Mari's edit changes it. `before`/`after`
// are null on the missing side of an insert/delete, so those collapse to a single pill. The `before`
// pill's strikethrough + the arrow are visual-only, so `srChangedTo` gives assistive tech the
// direction ("changed to") between the two labels.
function renderStatusSlot<T>(
  before: T | null,
  after: T | null,
  pill: (value: T, faded?: boolean) => ReactNode,
  srChangedTo: string,
): ReactNode {
  if (before !== null && after !== null && before !== after) {
    return (
      <span className="inline-flex items-center gap-1">
        {pill(before, true)}
        <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
          <span aria-hidden>→</span>
          <span className="sr-only"> {srChangedTo} </span>
        </span>
        {pill(after)}
      </span>
    );
  }
  const value = after ?? before;
  return value !== null ? pill(value) : null;
}

function LorebookEntryDiff({ change, collapsed }: { change: MariDbRowChange; collapsed?: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const before = change.before ?? null;
  const after = change.after ?? null;
  const source = after ?? before; // for delete, describe the removed row
  const nameBefore = stringField(before, "name");
  const nameAfter = stringField(after, "name");
  const contentBefore = stringField(before, "content");
  const contentAfter = stringField(after, "content");
  const descBefore = stringField(before, "description");
  const descAfter = stringField(after, "description");

  // A disabled entry effectively stops firing, so surface it as a prominent badge next to the name
  // rather than a small chip lost among the others. Show "Disabled" whenever the resulting (or, for
  // a delete, the removed) entry is disabled — covering a new disabled entry, an update that leaves
  // it disabled, and a disable — and "Enabled" only when an entry is re-enabled.
  const isDisabled = Boolean(source && !truthy((source as Row)?.enabled));
  const wasReEnabled = Boolean(before && after && !truthy(before.enabled) && truthy(after.enabled));
  // Only surface toggle CHANGES on a genuine update; on insert/delete the whole entry is added or
  // removed (shown by the name/content), so per-toggle chips would misrepresent it as flips.
  const changedToggles =
    before && after
      ? LOREBOOK_TOGGLES.filter(({ key }) => key !== "enabled" && truthy(before[key]) !== truthy(after[key])).map(
          ({ key, labelKey }) => ({
            label: localizeUi(labelKey),
            on: truthy(after[key]),
          }),
        )
      : [];

  // Activation (constant / selective / normal) and vectorization are shown as always-visible status
  // pills so an entry's kind is obvious even when Mari's edit didn't touch them; a change renders as
  // `from → to`.
  const beforeAct = before ? activationType(before) : null;
  const afterAct = after ? activationType(after) : null;
  const beforeVec = before ? resolveLorebookVectorStatus(before) : null;
  const afterVec = after ? resolveLorebookVectorStatus(after) : null;
  const activationPill = (type: ActivationType, faded?: boolean) => (
    <StatusPill
      key={`act-${type}-${faded ? "from" : "to"}`}
      dot={ACTIVATION_DOT[type]}
      label={localizeUi(ACTIVATION_LABEL_KEY[type])}
      title={localizeUi(ACTIVATION_HINT_KEY[type])}
      faded={faded}
    />
  );
  const vectorPill = (status: LorebookVectorStatus, faded?: boolean) => {
    const excluded = status === "excluded";
    const vectorized = status === "vectorized";
    return (
      <StatusPill
        key={`vec-${status}-${faded ? "from" : "to"}`}
        dot={vectorized ? "bg-cyan-300" : excluded ? undefined : "bg-[var(--muted-foreground)]"}
        label={localizeUi(
          excluded
            ? "ui.chat.mariediteasyviewer.vectorExcluded"
            : vectorized
              ? "ui.chat.mariediteasyviewer.vectorized"
              : "ui.chat.mariediteasyviewer.notVectorized",
        )}
        title={localizeUi(
          excluded
            ? "ui.chat.mariediteasyviewer.vectorExcludedHint"
            : vectorized
              ? "ui.chat.mariediteasyviewer.vectorizedHint"
              : "ui.chat.mariediteasyviewer.notVectorizedHint",
        )}
        faded={faded}
      />
    );
  };

  // `selective` is shown by the activation pill only when it actually moved the type; when `constant`
  // dominates on both sides (the pill stays "constant"), keep the raw selective change in the generic
  // diff so a selective flip on a constant entry is never silently dropped.
  const activationChanged = beforeAct !== null && afterAct !== null && beforeAct !== afterAct;
  const remainingFields = computeFieldChanges(change).filter(
    (field) => !LOREBOOK_HANDLED_PATHS.has(field.path) && (field.path !== "selective" || !activationChanged),
  );

  return (
    <div className="mari-editor-panel mari-editor-panel--soft space-y-2 rounded-lg p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
          {nameBefore || nameAfter ? (
            <InlineTextDiff before={nameBefore} after={nameAfter} />
          ) : (
            localizeUi("ui.chat.mariediteasyviewer.untitledEntry")
          )}
        </div>
        {(isDisabled || wasReEnabled) && (
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[0.625rem] font-semibold",
              isDisabled
                ? "bg-[var(--destructive)]/30 text-[var(--foreground)]"
                : "bg-emerald-500/25 text-[var(--foreground)]",
            )}
          >
            {isDisabled
              ? localizeUi("ui.chat.mariediteasyviewer.disabled")
              : localizeUi("ui.chat.mariediteasyviewer.toggleEnabled")}
          </span>
        )}
        {renderStatusSlot(beforeAct, afterAct, activationPill, localizeUi("ui.chat.mariediteasyviewer.changedTo"))}
        {renderStatusSlot(beforeVec, afterVec, vectorPill, localizeUi("ui.chat.mariediteasyviewer.changedTo"))}
      </div>

      {/* Collapsing keeps the name + status summary above and folds away the bulky details. */}
      {!collapsed && (
        <>
          <div>
            <div className="mb-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.mariediteasyviewer.primaryKeys")}
            </div>
            <KeyChips before={csvToList(before?.keys)} after={csvToList(after?.keys)} />
          </div>

          {(csvToList(before?.secondaryKeys).length > 0 || csvToList(after?.secondaryKeys).length > 0) && (
            <div>
              <div className="mb-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.mariediteasyviewer.secondaryKeys")}
              </div>
              <KeyChips before={csvToList(before?.secondaryKeys)} after={csvToList(after?.secondaryKeys)} />
            </div>
          )}

          {contentBefore !== contentAfter && (
            <div>
              <div className="mb-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.mariediteasyviewer.content")}
              </div>
              <p className="max-h-40 overflow-auto rounded-md bg-[var(--background)]/70 p-1.5 text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
                <InlineTextDiff before={contentBefore} after={contentAfter} />
              </p>
            </div>
          )}

          {descBefore !== descAfter && (
            <div>
              <div className="mb-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.mariediteasyviewer.description")}
              </div>
              <p className="max-h-40 overflow-auto rounded-md bg-[var(--background)]/70 p-1.5 text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
                <InlineTextDiff before={descBefore} after={descAfter} />
              </p>
            </div>
          )}

          {changedToggles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {changedToggles.map((toggle) => (
                <span
                  key={toggle.label}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[0.625rem]",
                    toggle.on
                      ? "bg-emerald-500/25 text-[var(--foreground)]"
                      : "bg-[var(--destructive)]/25 text-[var(--foreground)]",
                  )}
                >
                  {toggle.label}:{" "}
                  {toggle.on
                    ? localizeUi("ui.chat.mariediteasyviewer.on")
                    : localizeUi("ui.chat.mariediteasyviewer.off")}
                </span>
              ))}
            </div>
          )}

          {remainingFields.length > 0 && (
            <div className="space-y-1.5">
              {remainingFields.map((field) => (
                <FieldChangeView key={field.path} change={field} />
              ))}
            </div>
          )}

          {!source && <EmptyValue />}
        </>
      )}
    </div>
  );
}

function GenericRowDiff({ change, collapsed }: { change: MariDbRowChange; collapsed?: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  // A character/preset row is identified by the card header (its name), so collapsing hides the whole
  // field diff.
  if (collapsed) return null;
  const fields = computeFieldChanges(change);
  if (fields.length === 0) {
    return (
      <p className="text-[0.6875rem] italic text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.mariediteasyviewer.noFieldChanges")}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {fields.map((field) => (
        <FieldChangeView key={field.path} change={field} />
      ))}
    </div>
  );
}

// ── Row title + action metadata ─────────────────────────────────────────────

function rowTitle(change: MariDbRowChange, localizeUi: (key: string) => string): string {
  const row = asRecord(change.after) ?? asRecord(change.before);
  if (change.table === "characters") {
    const data = asRecord(row?.data);
    return (data && stringField(data, "name")) || localizeUi("ui.chat.mariediteasyviewer.character");
  }
  if (change.table === "lorebook_entries") return localizeUi("ui.chat.mariediteasyviewer.lorebookEntry");
  const name = row ? stringField(row, "name") : "";
  if (name) return name;
  if (change.table === "mari_instructions") return localizeUi("ui.chat.mariediteasyviewer.memory");
  if (change.table === "prompt_presets") return localizeUi("ui.chat.mariediteasyviewer.preset");
  return localizeUi("ui.chat.mariediteasyviewer.change");
}

function actionMeta(action: MariDbRowChange["action"], localizeUi: (key: string) => string) {
  if (action === "insert") {
    return { label: localizeUi("ui.chat.mariediteasyviewer.actionNew"), icon: Sparkles, tone: "text-[var(--primary)]" };
  }
  if (action === "delete") {
    return {
      label: localizeUi("ui.chat.mariediteasyviewer.actionRemoved"),
      icon: Trash2,
      tone: "text-[var(--destructive)]",
    };
  }
  return {
    label: localizeUi("ui.chat.mariediteasyviewer.actionEdited"),
    icon: Pencil,
    tone: "text-[var(--muted-foreground)]",
  };
}

// A character or preset edit can be previewed as an assembled prompt. Deletes are NOT offered: the
// field diff already shows the removed content, and a synthetic re-assembly of a deleted row is
// either impossible (a character delete has no live row for the proxy to substitute) or misleading
// (Mari's section delete also prunes the id from the preset's sectionOrder, so the assembler skips
// the re-spliced section and the before/after come out identical).
const PROMPT_RENDER_TABLES = new Set(["prompt_presets", "prompt_sections", "prompt_groups", "choice_blocks"]);
function canRenderPrompt(change: MariDbRowChange): boolean {
  if (change.action === "delete") return false;
  return change.table === "characters" || PROMPT_RENDER_TABLES.has(change.table);
}

function RowCard({
  change,
  index,
  collapsed,
  onToggleCollapse,
  onReject,
  onRender,
  busy,
}: {
  change: MariDbRowChange;
  index: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onReject?: (change: MariDbRowChange, index: number) => void;
  onRender?: (change: MariDbRowChange, index: number) => void;
  busy?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const meta = actionMeta(change.action, localizeUi);
  const MetaIcon = meta.icon;
  // A delete is Mari's most destructive action — make the whole row unmistakably red.
  const isDelete = change.action === "delete";
  // Reject reverts the row on the server (a real undo). Only top-level lorebook entries are
  // individually rejectable — the server refuses anything else — so the control is offered only there.
  const canReject = Boolean(onReject) && change.table === "lorebook_entries";
  const canRender = Boolean(onRender) && canRenderPrompt(change);
  // rowTitle is the generic "Lorebook entry" for every entry row, so include the entry's own name in
  // the toggle's accessible name; otherwise every collapse button reads identically to a screen reader.
  const entryName = change.table === "lorebook_entries" ? stringField(change.after ?? change.before, "name") : "";
  const accessibleName = entryName || rowTitle(change, localizeUi);
  return (
    <div
      className={cn(
        "rounded-lg border p-2",
        isDelete
          ? "border-[var(--destructive)]/60 bg-[var(--destructive)]/10"
          : "border-[var(--border)] bg-[var(--background)]/40",
      )}
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
        {/* The header is the accordion toggle: click to fold the details away and re-open later. */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={localizeUi(
            collapsed ? "ui.chat.mariediteasyviewer.expand" : "ui.chat.mariediteasyviewer.collapse",
            {
              name: accessibleName,
            },
          )}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {collapsed ? (
            <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
          ) : (
            <ChevronDown size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
          )}
          <MetaIcon size="0.75rem" className={cn("shrink-0", meta.tone)} />
          <span className="truncate text-[0.6875rem] font-semibold text-[var(--foreground)]">
            {rowTitle(change, localizeUi)}
          </span>
          <span
            className={cn(
              "shrink-0 text-[0.625rem]",
              isDelete ? "font-semibold uppercase tracking-wide text-[var(--destructive)]" : meta.tone,
            )}
          >
            {meta.label}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {canRender && (
            <button
              type="button"
              onClick={() => onRender?.(change, index)}
              disabled={busy}
              title={localizeUi("ui.chat.mariediteasyviewer.viewAsPromptHint")}
              aria-label={localizeUi("ui.chat.mariediteasyviewer.viewAsPrompt")}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Eye size="0.7rem" />
              {localizeUi("ui.chat.mariediteasyviewer.viewAsPrompt")}
            </button>
          )}
          {canReject && (
            <button
              type="button"
              onClick={() => onReject?.(change, index)}
              disabled={busy}
              title={localizeUi("ui.chat.mariediteasyviewer.rejectHint")}
              aria-label={localizeUi("ui.chat.mariediteasyviewer.reject")}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Undo2 size="0.7rem" />
              {localizeUi("ui.chat.mariediteasyviewer.reject")}
            </button>
          )}
        </div>
      </div>
      {change.table === "lorebook_entries" ? (
        <LorebookEntryDiff change={change} collapsed={collapsed} />
      ) : (
        <GenericRowDiff change={change} collapsed={collapsed} />
      )}
    </div>
  );
}

export function MariEditEasyViewer({
  approval,
  collapsed,
  onToggleCollapse,
  onRejectRow,
  onRenderRow,
  busy,
}: {
  approval: MariDbPendingApproval;
  collapsed: ReadonlySet<string>;
  onToggleCollapse: (key: string) => void;
  onRejectRow?: (change: MariDbRowChange, index: number) => void;
  onRenderRow?: (change: MariDbRowChange, index: number) => void;
  busy?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  // Key by the row's stable diffPreview index too: planTransform can emit multiple rows sharing
  // table/id/action, so the index guarantees a unique React key AND collapse-Set key. The index is
  // also the identifier a reject sends — it maps 1:1 to the server's plan.changes[index].
  const rows = approval.diffPreview.map((change, index) => ({ change, index, key: `${index}:${rowKey(change)}` }));
  // Reject reverts one row and keeps the rest; on a single-row change that is identical to the whole-
  // card Restore, so don't offer the redundant per-row control there.
  const rejectRow = onRejectRow && approval.diffPreview.length > 1 ? onRejectRow : undefined;

  if (approval.diffPreview.length === 0) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[0.6875rem] italic text-[var(--muted-foreground)]">
        <FileText size="0.75rem" />
        {localizeUi("ui.chat.mariediteasyviewer.noPreview")}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {rows.map((item) => (
        <RowCard
          key={item.key}
          change={item.change}
          index={item.index}
          collapsed={collapsed.has(item.key)}
          onToggleCollapse={() => onToggleCollapse(item.key)}
          onReject={rejectRow}
          onRender={onRenderRow}
          busy={busy}
        />
      ))}
      {approval.diffTruncated && (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.databaseworkspaceapprovalcard.thisPreviewMayNotShowEveryAffectedRow")}
        </p>
      )}
    </div>
  );
}
