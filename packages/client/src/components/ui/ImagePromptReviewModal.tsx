import { Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_QUIET } from "./neutral-surface-styles";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Spinner } from "./Spinner";

export type ImagePromptReviewKind = "background" | "illustration" | "portrait" | "sprite" | "avatar" | "video";

export type ImagePromptReviewCharacterPrompt = {
  name: string;
  prompt: string;
  negativePrompt?: string;
  position?: { x: number; y: number };
};

export type ImagePromptReviewItem = {
  id: string;
  kind: ImagePromptReviewKind;
  title: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  details?: string;
  maxLength?: number;
  /** Native per-character captions (NovelAI). Shown read-only; they ride along with the review result. */
  characterPrompts?: ImagePromptReviewCharacterPrompt[];
  /** Which model draws, its fallback and the style. Shown read-only. */
  drawnBy?: { model: string; fallback: string | null; style: string | null };
  /** Where each reference picture goes. Shown read-only. */
  references?: ImagePromptReviewReferences;
};

export type ImagePromptReviewReferencePicture = {
  name: string;
  from: "character-sheet" | "avatar" | "sprite" | "location";
  thumbnail: string | null;
};

export type ImagePromptReviewReferences = {
  workflow: boolean;
  pictures: ImagePromptReviewReferencePicture[];
  slots: Array<{
    slot: number;
    placeholder: string;
    fill: "picture" | "blank" | "empty";
    picture: ImagePromptReviewReferencePicture | null;
  }>;
  unused: ImagePromptReviewReferencePicture[];
  literalLoaders: Array<{ nodeId: string; title: string | null; file: string }>;
};

export type ImagePromptOverride = {
  id: string;
  prompt: string;
  negativePrompt?: string;
};

type ImagePromptReviewModalProps = {
  open: boolean;
  items: ImagePromptReviewItem[];
  isSubmitting?: boolean;
  mediaType?: "image" | "video";
  /** Shown above the prompts, such as why the request failed before. */
  notice?: ReactNode;
  /** The confirm button's label; Generate when not given. */
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (overrides: ImagePromptOverride[]) => void;
};

export function ImagePromptReviewModal({
  open,
  items,
  isSubmitting = false,
  mediaType = "image",
  notice,
  confirmLabel,
  onCancel,
  onConfirm,
}: ImagePromptReviewModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [negativeDrafts, setNegativeDrafts] = useState<Record<string, string>>({});
  const initializedSourceKeyRef = useRef<string | null>(null);
  const draftSource = useMemo(() => {
    const entries = items.map((item) => [item.id, item.prompt, item.negativePrompt ?? ""]);
    return {
      key: JSON.stringify(entries),
      drafts: Object.fromEntries(items.map((item) => [item.id, item.prompt])),
      negativeDrafts: Object.fromEntries(items.map((item) => [item.id, item.negativePrompt ?? ""])),
    };
  }, [items]);

  useEffect(() => {
    if (!open) {
      initializedSourceKeyRef.current = null;
      return;
    }
    if (initializedSourceKeyRef.current === draftSource.key) return;
    initializedSourceKeyRef.current = draftSource.key;
    setDrafts(draftSource.drafts);
    setNegativeDrafts(draftSource.negativeDrafts);
  }, [draftSource, open]);

  const hasEmptyPrompt = useMemo(() => items.some((item) => !(drafts[item.id] ?? item.prompt).trim()), [drafts, items]);
  const mediaLabel = mediaType === "video" ? "video" : "image";
  const mediaTitle = mediaType === "video" ? "Video" : "Image";

  const handleConfirm = () => {
    if (hasEmptyPrompt || isSubmitting) return;
    onConfirm(
      items.map((item) => {
        const negativePrompt = (negativeDrafts[item.id] ?? item.negativePrompt ?? "").trim();
        return {
          id: item.id,
          prompt: (drafts[item.id] ?? item.prompt).trim(),
          ...(item.negativePrompt !== undefined || negativePrompt ? { negativePrompt } : {}),
        };
      }),
    );
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      closeDisabled={isSubmitting}
      title={
        items.length === 1
          ? localizeUi("ui.ui.imagepromptreviewmodal.reviewValue1Prompt", { value1: mediaTitle })
          : localizeUi("ui.ui.imagepromptreviewmodal.reviewValue1Prompts", { value1: mediaTitle })
      }
      width="max-w-4xl"
      pullToClose={false}
      closeButtonClassName="max-sm:hidden"
      footer={
        <>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || hasEmptyPrompt}
            className={SHEET_BUTTON_PRIMARY}
          >
            {isSubmitting ? <Spinner size="sm" /> : <Send size="0.875rem" />}
            {confirmLabel ?? localizeUi("ui.characters.characterclipcard.generate")}
          </button>
          <button type="button" onClick={onCancel} disabled={isSubmitting} className={SHEET_BUTTON_QUIET}>
            <X size="0.875rem" />
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {notice}
        <div className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.ui.imagepromptreviewmodal.editThePrompt")}
          {items.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}{" "}
          {localizeUi("ui.ui.imagepromptreviewmodal.belowBeforeMarinaraSendsThe")} {mediaLabel}{" "}
          {localizeUi("ui.ui.imagepromptreviewmodal.request")}
          {items.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}{" "}
          {localizeUi("ui.ui.imagepromptreviewmodal.toYourProvider")}
        </div>

        <div className="min-h-0 flex-1 space-y-3">
          {items.map((item) => {
            const value = drafts[item.id] ?? item.prompt;
            const negativeValue = negativeDrafts[item.id] ?? item.negativePrompt ?? "";
            const itemDetails =
              item.details ??
              (typeof item.width === "number" && typeof item.height === "number" ? `${item.width}x${item.height}` : "");
            return (
              <div key={item.id} className="flex flex-col gap-2">
                <label className="flex flex-col gap-2 rounded-xl bg-[var(--secondary)]/55 p-3 ring-1 ring-[var(--border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-[var(--foreground)]">{item.title}</div>
                      <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                        {/* Only the kind is capitalized: the details carry account names and model IDs as written. */}
                        <span className="capitalize">{item.kind}</span>
                        {itemDetails ? localizeUi("ui.ui.imagepromptreviewmodal.value1", { value1: itemDetails }) : ""}
                      </div>
                    </div>
                    <span className="rounded-md bg-[var(--background)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                      {value.trim().length}
                      {item.maxLength
                        ? localizeUi("ui.ui.imagepromptreviewmodal.value1_1d0dfc9", { value1: item.maxLength })
                        : ""}{" "}
                      {localizeUi("ui.panels.promptoverrideseditorbody.chars")}
                    </span>
                  </div>
                  <textarea
                    value={value}
                    onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                    maxLength={item.maxLength}
                    rows={8}
                    spellCheck={false}
                    className="min-h-40 resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/70 focus:border-[var(--primary)]"
                  />
                  {(item.negativePrompt !== undefined || negativeValue) && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        {localizeUi("ui.agents.agenteditor.negativePrompt")}
                      </span>
                      <textarea
                        value={negativeValue}
                        onChange={(event) =>
                          setNegativeDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        rows={4}
                        spellCheck={false}
                        className="min-h-24 resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/70 focus:border-[var(--primary)]"
                      />
                    </div>
                  )}
                  {item.characterPrompts && item.characterPrompts.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        {localizeUi("ui.ui.imagepromptreviewmodal.characterPrompts", {
                          value1: item.characterPrompts.length,
                        })}
                      </span>
                      <ul className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)]">
                        {item.characterPrompts.map((character, index) => (
                          <li key={`${item.id}-character-${index}`} className="flex flex-col gap-0.5">
                            <span className="font-semibold">
                              {character.name}
                              {character.position ? (
                                <span className="ml-2 font-normal text-[var(--muted-foreground)]">
                                  {localizeUi("ui.ui.imagepromptreviewmodal.characterPosition", {
                                    value1: character.position.x.toFixed(2),
                                    value2: character.position.y.toFixed(2),
                                  })}
                                </span>
                              ) : null}
                            </span>
                            <span className="whitespace-pre-wrap break-words">{character.prompt}</span>
                            {character.negativePrompt ? (
                              <span className="whitespace-pre-wrap break-words text-[var(--muted-foreground)]">
                                {localizeUi("ui.ui.imagepromptreviewmodal.characterNegative", {
                                  value1: character.negativePrompt,
                                })}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </label>
                {item.drawnBy || item.references ? (
                  <ReviewReferences drawnBy={item.drawnBy} references={item.references} />
                ) : null}
              </div>
            );
          })}
        </div>

        <div>
          {hasEmptyPrompt ? (
            <span className="text-[0.625rem] text-[var(--destructive)]">
              {localizeUi("ui.chat.summarypopover.every")} {mediaLabel}{" "}
              {localizeUi("ui.ui.imagepromptreviewmodal.requestNeedsAPrompt")}
            </span>
          ) : (
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
              {items.length} {localizeUi("ui.ui.imagepromptreviewmodal.request")}
              {items.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}{" "}
              {localizeUi("ui.ui.imagepromptreviewmodal.ready")}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** "Drawn by" and the reference pictures: which picture fills which ComfyUI placeholder, blanks and stale loaders. */
function ReviewReferences({
  drawnBy,
  references,
}: {
  drawnBy?: ImagePromptReviewItem["drawnBy"];
  references?: ImagePromptReviewReferences;
}) {
  const { t } = useUiTranslation();
  const pictureLabel = (picture: ImagePromptReviewReferencePicture) =>
    picture.from === "location"
      ? t("ui.ui.imagepromptreviewmodal.refs.location")
      : t("ui.ui.imagepromptreviewmodal.refs.picture", {
          name: picture.name,
          from: t(
            `ui.ui.imagepromptreviewmodal.refs.from.${picture.from === "character-sheet" ? "characterSheet" : picture.from}`,
          ),
        });
  const thumb = (picture: ImagePromptReviewReferencePicture | null, fill: "picture" | "blank" | "empty") =>
    picture?.thumbnail ? (
      <img src={picture.thumbnail} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
    ) : (
      <span
        aria-hidden
        className={
          fill === "empty"
            ? "h-8 w-8 shrink-0 rounded-md border border-dashed border-[var(--border)]"
            : "h-8 w-8 shrink-0 rounded-md bg-[var(--secondary)] ring-1 ring-[var(--border)]"
        }
      />
    );
  return (
    <div
      data-review-references
      className="flex flex-col gap-2 rounded-xl bg-[var(--secondary)]/55 p-3 ring-1 ring-[var(--border)]"
    >
      {drawnBy ? (
        <div className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
          {t("ui.ui.imagepromptreviewmodal.drawnBy")}{" "}
          <strong className="font-medium text-[var(--foreground)]">{drawnBy.model}</strong>
          {drawnBy.style ? (
            <>
              {" · "}
              {t("ui.ui.imagepromptreviewmodal.style")}{" "}
              <strong className="font-medium text-[var(--foreground)]">{drawnBy.style}</strong>
            </>
          ) : null}
          {drawnBy.fallback ? (
            <>
              {" · "}
              {t("ui.ui.imagepromptreviewmodal.ifItFails")}{" "}
              <strong className="font-medium text-[var(--foreground)]">{drawnBy.fallback}</strong>
            </>
          ) : null}
        </div>
      ) : null}
      {references ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
              {t("ui.ui.imagepromptreviewmodal.refs.title")}
            </span>
            {references.workflow ? (
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                {t("ui.ui.imagepromptreviewmodal.refs.slotCount", { count: references.slots.length })}
              </span>
            ) : null}
          </div>
          {references.workflow ? (
            <ul className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
              {references.slots.map((slot) => (
                <li
                  key={slot.slot}
                  className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 border-b border-[var(--border)] px-2.5 py-1.5 text-[0.6875rem] last:border-b-0"
                >
                  <code className="font-mono text-[0.625rem] text-[var(--muted-foreground)]">{slot.placeholder}</code>
                  {thumb(slot.picture, slot.fill)}
                  <span className="min-w-0 truncate text-[var(--foreground)]">
                    {slot.picture
                      ? pictureLabel(slot.picture)
                      : slot.fill === "blank"
                        ? t("ui.ui.imagepromptreviewmodal.refs.blank")
                        : t("ui.ui.imagepromptreviewmodal.refs.empty")}
                  </span>
                </li>
              ))}
              {references.unused.map((picture, index) => (
                <li
                  key={`unused-${index}`}
                  className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 border-b border-[var(--border)] px-2.5 py-1.5 text-[0.6875rem] last:border-b-0"
                >
                  <code className="font-mono text-[0.625rem] text-amber-400">
                    {t("ui.ui.imagepromptreviewmodal.refs.notSent")}
                  </code>
                  {thumb(picture, "picture")}
                  <span className="min-w-0 truncate text-[var(--muted-foreground)]">{pictureLabel(picture)}</span>
                </li>
              ))}
              {references.slots.length === 0 && references.unused.length === 0 ? (
                <li className="px-2.5 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("ui.ui.imagepromptreviewmodal.refs.noSlotsNoPictures")}
                </li>
              ) : null}
            </ul>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {references.pictures.map((picture, index) => (
                <li key={index} className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] text-[var(--foreground)]">
                  {thumb(picture, "picture")}
                  <span className="min-w-0 truncate">{pictureLabel(picture)}</span>
                </li>
              ))}
            </ul>
          )}
          {references.workflow && references.slots.length === 0 && references.pictures.length > 0 ? (
            <p className="text-[0.625rem] leading-snug text-amber-400">
              {t("ui.ui.imagepromptreviewmodal.refs.noSlots")}
            </p>
          ) : null}
          {references.literalLoaders.map((loader) => (
            <p
              key={`${loader.nodeId}:${loader.file}`}
              className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[0.625rem] leading-snug text-[var(--foreground)]"
            >
              {t("ui.ui.imagepromptreviewmodal.refs.literalLoader", {
                node: loader.title ? `${loader.nodeId} (${loader.title})` : loader.nodeId,
                file: loader.file,
              })}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
