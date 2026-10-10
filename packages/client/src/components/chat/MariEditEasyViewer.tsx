// #4919 Easy Viewer, direction A (slice 13): Professor Mari's applied edit reads as one summary line
// per record ("Zylo Vantrell · 3 changes") that opens to tracked changes: old text struck and muted,
// new text underlined on a tint, lists, switches and one-word values as −/+ chips. The exact
// line-by-line diff sits behind one toggle. All data comes from approval.diffPreview (full
// before/after row snapshots), no server call. The card's Undo/Keep still governs the whole batch.

import { useState, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ChevronRight, Undo2 } from "lucide-react";
import type { MariDbPendingApproval, MariDbRowChange } from "@marinara-engine/shared";

import { cn } from "../../lib/utils";
import { buildCharacterPreviewModel } from "../../lib/character-preview";
import { recordFaceResultType } from "../../lib/command-icons";
import {
  changeRecordName,
  computeFieldChanges,
  fieldChangeStyle,
  replyFixChat,
  resolveLorebookVectorStatus,
  reviewRowFact,
  trackListChange,
  trackProseChange,
  type FieldChange,
} from "../../lib/mari-edit-diff";
import { UnifiedLineDiff } from "./MariUnifiedDiff";
import { ResultTypeIcon } from "../command-center/ResultTypeIcon";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringField(row: Record<string, unknown> | null, key: string): string {
  const value = row?.[key];
  return value === null || value === undefined ? "" : String(value);
}

export function rowTitle(
  change: MariDbRowChange,
  localizeUi: (key: string, options?: Record<string, unknown>) => string,
): string {
  const replyChat = replyFixChat(change);
  if (replyChat) {
    return replyChat.name
      ? localizeUi("ui.chat.mariediteasyviewer.replyInChat", { chat: replyChat.name })
      : localizeUi("ui.chat.mariediteasyviewer.reply");
  }
  const name = changeRecordName(change);
  if (name) return name;
  if (change.table === "characters") return localizeUi("ui.chat.mariediteasyviewer.character");
  if (change.table === "lorebook_entries") return localizeUi("ui.chat.mariediteasyviewer.lorebookEntry");
  if (change.table === "mari_instructions") return localizeUi("ui.chat.mariediteasyviewer.memory");
  if (change.table === "prompt_presets") return localizeUi("ui.chat.mariediteasyviewer.preset");
  if (change.table === "agent_configs") return localizeUi("ui.chat.mariediteasyviewer.agent");
  return localizeUi("ui.chat.mariediteasyviewer.change");
}

// A character or preset edit can be previewed as an assembled prompt. Deletes are NOT offered: the
// field diff already shows the removed content, and a synthetic re-assembly of a deleted row is
// either impossible (a character delete has no live row for the proxy to substitute) or misleading
// (Mari's section delete also prunes the id from the preset's sectionOrder, so the assembler skips
// the re-spliced section and the before/after come out identical).
const PROMPT_RENDER_TABLES = new Set(["prompt_presets", "prompt_sections", "prompt_groups", "choice_blocks"]);
export function canRenderPrompt(change: MariDbRowChange): boolean {
  if (change.action === "delete") return false;
  return change.table === "characters" || PROMPT_RENDER_TABLES.has(change.table);
}

function Chip({ type, children }: { type: "added" | "removed" | "equal"; children: ReactNode }) {
  return (
    <span className={cn("mari-tag", type === "removed" && "mari-tag--del", type === "added" && "mari-tag--ins")}>
      {children}
    </span>
  );
}

/** One field as tracked changes. A new record passes `fresh`, so its values read plain, not inserted. */
function TrackedField({ field, fresh }: { field: FieldChange; fresh: boolean }) {
  const before = fresh ? field.after : field.before;
  const style = fieldChangeStyle(field);
  if (style === "list") {
    return (
      <div className="mari-tags">
        {trackListChange(before, field.after).map((item) => (
          <Chip key={`${item.type}:${item.value}`} type={item.type}>
            {item.value}
          </Chip>
        ))}
      </div>
    );
  }
  if (style === "enum") {
    return (
      <div className="mari-tags">
        {before && before !== field.after ? <Chip type="removed">{before}</Chip> : null}
        {field.after ? <Chip type={before === field.after ? "equal" : "added"}>{field.after}</Chip> : null}
      </div>
    );
  }
  return (
    <p className="mari-field__text">
      {trackProseChange(before, field.after).map((segment, index) =>
        segment.type === "removed" ? (
          <del key={index}>{segment.value}</del>
        ) : segment.type === "added" ? (
          <ins key={index}>{segment.value}</ins>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </p>
  );
}

/** Switches turned on read `+Label`, turned off `−Label`; on a new record only the ones that are on. */
function SwitchChips({ fields, fresh }: { fields: FieldChange[]; fresh: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const shown = fields.filter((field) => !fresh || field.after === "on");
  if (shown.length === 0) return null;
  return (
    <div className="mari-field">
      <span className="mari-field__label">{localizeUi("ui.chat.mariediteasyviewer.switches")}</span>
      <div className="mari-tags">
        {shown.map((field) => (
          <Chip key={field.path} type={fresh ? "equal" : field.after === "on" ? "added" : "removed"}>
            {field.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

const ACTIVATION_KEYS = {
  constant: ["ui.chat.mariediteasyviewer.toggleConstant", "ui.chat.mariediteasyviewer.modeConstantHint"],
  selective: ["ui.chat.mariediteasyviewer.modeSelective", "ui.chat.mariediteasyviewer.modeSelectiveHint"],
  normal: ["ui.chat.mariediteasyviewer.modeNormal", "ui.chat.mariediteasyviewer.modeNormalHint"],
} as const;
const VECTOR_KEYS = {
  excluded: ["ui.chat.mariediteasyviewer.vectorExcluded", "ui.chat.mariediteasyviewer.vectorExcludedHint"],
  vectorized: ["ui.chat.mariediteasyviewer.vectorized", "ui.chat.mariediteasyviewer.vectorizedHint"],
  notVectorized: ["ui.chat.mariediteasyviewer.notVectorized", "ui.chat.mariediteasyviewer.notVectorizedHint"],
} as const;

/** A lorebook entry's kind at a glance (activation, vector state), changed or not. */
function LorebookStatus({ change }: { change: MariDbRowChange }) {
  const { t: localizeUi } = useUiTranslation();
  const row = asRecord(change.after) ?? asRecord(change.before);
  const on = (value: unknown) => value === true || value === 1 || value === "true" || value === "1";
  const activation = on(row?.constant) ? "constant" : on(row?.selective) ? "selective" : "normal";
  return (
    <div className="mari-tags">
      {[ACTIVATION_KEYS[activation], VECTOR_KEYS[resolveLorebookVectorStatus(row)]].map(([label, hint]) => (
        <span key={label} className="mari-tag" title={localizeUi(hint)}>
          {localizeUi(label)}
        </span>
      ))}
    </div>
  );
}

export function RecordFace({ change }: { change: MariDbRowChange }) {
  const character = change.table === "characters" ? buildCharacterPreviewModel(change.after ?? change.before) : null;
  // An agent shows its own artwork, as its omnibar row does.
  const agentImage =
    change.table === "agent_configs" ? stringField(asRecord(change.after) ?? asRecord(change.before), "imagePath") : "";
  return (
    <ResultTypeIcon
      type={recordFaceResultType(change.table)}
      src={character?.avatarSrc ?? (agentImage || undefined)}
      kind="avatar"
      avatarCropStyle={character?.avatarCropStyle}
    />
  );
}

/**
 * The review group (R10): one row per record - its face, its name and what the change does in words -
 * that opens in place to its tracked changes. Closed by default. A single-record review carries its
 * `actions` (Undo, Keep) in the row; a batch closes with one line of links and actions for all of it.
 * `raw` is one disclosure in the links line.
 */
export function MariEditEasyViewer({
  approval,
  raw,
  actions,
  onRejectRow,
  onRenderRow,
  busy,
  running,
}: {
  approval: MariDbPendingApproval;
  raw: ReactNode;
  actions: ReactNode;
  onRejectRow?: (change: MariDbRowChange, index: number) => void;
  onRenderRow?: (change: MariDbRowChange, index: number) => void;
  /** Any review is being answered: these buttons wait. */
  busy?: boolean;
  /** This review's Keep or Undo is running: its row dims. */
  running?: boolean;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [exact, setExact] = useState(false);
  const single = approval.diffPreview.length <= 1;
  // Reject reverts one row and keeps the rest; on a single-row change that equals Undo, and the server
  // only accepts top-level lorebook entries.
  const rejectRow = approval.diffPreview.length > 1 ? onRejectRow : undefined;
  const exactToggle =
    approval.diffPreview.length > 0 ? (
      <button type="button" onClick={() => setExact((value) => !value)} aria-pressed={exact} className="mari-link">
        {localizeUi(
          exact ? "ui.chat.mariediteasyviewer.showTrackedChanges" : "ui.chat.mariediteasyviewer.showExactChanges",
        )}
      </button>
    ) : null;

  return (
    <section
      className="mari-list mari-edit-review"
      data-busy={busy ? "true" : undefined}
      aria-label={localizeUi("ui.chat.mariappliededit.label")}
    >
      {approval.diffPreview.length === 0 ? (
        <div className="mari-list__item">
          <div className="mari-row">
            <span className="mari-row__text">
              <span className="mari-row__title">
                <span>{approval.reason || localizeUi("ui.chat.mariediteasyviewer.change")}</span>
              </span>
              <span className="mari-row__fact">{localizeUi("ui.chat.mariediteasyviewer.noPreview")}</span>
            </span>
            <span className="mari-row__trail">{actions}</span>
          </div>
        </div>
      ) : null}
      {approval.diffPreview.map((change, index) => {
        const fields = computeFieldChanges(change);
        const fresh = change.action === "insert";
        const switches = exact ? [] : fields.filter((field) => fieldChangeStyle(field) === "toggle");
        const name = rowTitle(change, localizeUi);
        const open = openIndex === index;
        return (
          <div
            key={`${index}:${change.table}:${change.id}`}
            className="mari-list__item mari-review-row"
            data-open={open}
            data-state={running && single ? "busy" : undefined}
          >
            <div className="mari-row">
              <button
                type="button"
                className="mari-row__toggle"
                aria-expanded={open}
                title={approval.reason ?? undefined}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span className="mari-row__slot">
                  <RecordFace change={change} />
                </span>
                <span className="mari-row__text">
                  <span className="mari-row__title">
                    <span>{name}</span>
                    {fresh ? (
                      <span className="mari-new-badge">{localizeUi("ui.chat.mariediteasyviewer.actionNew")}</span>
                    ) : null}
                  </span>
                  <span className="mari-row__fact">
                    {reviewRowFact(change, fields, localizeUi, i18n.resolvedLanguage ?? "en")}
                  </span>
                </span>
                <span className="mari-row__trail">
                  <ChevronRight className="mari-row__disclose" aria-hidden="true" />
                </span>
              </button>
              {single ? <span className="mari-row__trail">{actions}</span> : null}
            </div>
            {/* Closed rows keep their content for the height animation; inert keeps it out of Tab. */}
            <div className="mari-edit__expand" inert={!open}>
              <div>
                <div className="mari-row__detail">
                  {fresh && change.table === "lorebook_entries" ? <LorebookStatus change={change} /> : null}
                  {fields.length === 0 ? (
                    <p className="mari-edit__reason">{localizeUi("ui.chat.mariediteasyviewer.noFieldChanges")}</p>
                  ) : null}
                  {fields
                    .filter((field) => !switches.includes(field))
                    .map((field) => (
                      <div key={field.path} className="mari-field">
                        <span className="mari-field__label">{field.label}</span>
                        {exact ? (
                          <UnifiedLineDiff before={field.before} after={field.after} />
                        ) : (
                          <TrackedField field={field} fresh={fresh} />
                        )}
                      </div>
                    ))}
                  <SwitchChips fields={switches} fresh={fresh} />
                  <div className="mari-row__links">
                    {single ? exactToggle : null}
                    {onRenderRow && canRenderPrompt(change) ? (
                      <button
                        type="button"
                        onClick={() => onRenderRow(change, index)}
                        disabled={busy}
                        title={localizeUi("ui.chat.mariediteasyviewer.viewAsPromptHint")}
                        className="mari-link"
                      >
                        {localizeUi("ui.chat.mariediteasyviewer.viewAsPrompt")}
                      </button>
                    ) : null}
                    {rejectRow && change.table === "lorebook_entries" ? (
                      <button
                        type="button"
                        onClick={() => rejectRow(change, index)}
                        disabled={busy}
                        title={localizeUi("ui.chat.mariediteasyviewer.rejectHint")}
                        aria-label={localizeUi("ui.chat.mariediteasyviewer.rejectNamed", { name })}
                        className="mari-link"
                      >
                        <Undo2 size="0.8rem" aria-hidden="true" />
                        {localizeUi("ui.chat.mariediteasyviewer.reject")}
                      </button>
                    ) : null}
                    {single ? raw : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {single ? null : (
        <div className="mari-list__item mari-edit__footer">
          <div className="mari-row">
            <div className="mari-row__links">
              {exactToggle}
              {raw}
            </div>
            <span className="mari-row__trail">{actions}</span>
          </div>
        </div>
      )}
      {approval.diffTruncated ? (
        <p className="mari-list__item mari-edit__reason px-[var(--mari-card-pad-inline)] py-2">
          {localizeUi("ui.chat.databaseworkspaceapprovalcard.thisPreviewMayNotShowEveryAffectedRow")}
        </p>
      ) : null}
    </section>
  );
}
