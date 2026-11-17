import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { ChevronDown, ImagePlus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMutating } from "@tanstack/react-query";
import { MAX_LOREBOOK_ENTRY_IMAGES, type LorebookEntryImage } from "@marinara-engine/shared";
import { lorebookKeys, useUpdateLorebookEntry, useUploadLorebookEntryImage } from "../../hooks/use-lorebooks";
import { Spinner } from "../ui/Spinner";

export function LorebookEntryImages({
  lorebookId,
  entryId,
  images,
  onDraftChange,
  onAddWardrobeKey,
  hasWardrobeKey,
}: {
  lorebookId: string;
  entryId: string;
  images: LorebookEntryImage[];
  onDraftChange: (images: LorebookEntryImage[]) => void;
  onAddWardrobeKey: () => void;
  hasWardrobeKey: boolean;
}) {
  const { t } = useTranslation();
  const upload = useUploadLorebookEntryImage(lorebookId, entryId);
  const changingImages = useIsMutating({ mutationKey: lorebookKeys.imageChange(lorebookId, entryId), exact: true }) > 0;
  const update = useUpdateLorebookEntry();
  const remove = useUpdateLorebookEntry({ lorebookId, entryId });
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const [draft, setDraft] = useState(images);
  const draftRef = useRef(images);
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const busy = saving || changingImages;
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const flushOnUnmountRef = useRef(() => {});
  flushOnUnmountRef.current = () => {
    if (dirtyRef.current && !busyRef.current) {
      update.mutate(
        { lorebookId, entryId, images: draftRef.current },
        {
          onError: () => toast.error(t("lorebook.images.saveError")),
        },
      );
    }
  };
  useEffect(() => () => flushOnUnmountRef.current(), []);

  useEffect(() => {
    if (!dirtyRef.current && !busyRef.current) {
      draftRef.current = images;
      setDraft(images);
      onDraftChange(images);
    }
  }, [images, onDraftChange]);

  function setImages(next: LorebookEntryImage[]) {
    draftRef.current = next;
    setDraft(next);
    onDraftChange(next);
  }

  async function save(next: LorebookEntryImage[], mutation = update) {
    const saved = await mutation.mutateAsync({ lorebookId, entryId, images: next });
    setImages(saved.images ?? []);
    dirtyRef.current = false;
  }

  async function run(operation: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError("");
    try {
      await operation();
    } catch {
      setError(t("lorebook.images.saveError"));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  async function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length + draftRef.current.length > MAX_LOREBOOK_ENTRY_IMAGES) {
      setError(t("ui.lorebooks.expandeddrawer.maxImagesError"));
      return;
    }
    if (files.some((file) => file.type && !["image/png", "image/jpeg", "image/webp"].includes(file.type))) {
      setError(t("ui.lorebooks.expandeddrawer.imageTypeError"));
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError(t("ui.lorebooks.expandeddrawer.imageTooLarge"));
      return;
    }
    await run(async () => {
      for (const file of files) {
        try {
          const saved = await upload.mutateAsync({
            file,
            beforeUpload: dirtyRef.current ? () => save(draftRef.current) : undefined,
          });
          setImages(saved.images ?? []);
        } catch {
          setError(t("ui.lorebooks.expandeddrawer.imageUploadError"));
          return;
        }
      }
    });
  }

  return (
    <section ref={sectionRef} className="mt-3 min-w-0 space-y-2" aria-label={t("ui.lorebooks.expandeddrawer.images")}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => {
          setExpanded(!expanded);
          if (expanded && dirtyRef.current) void run(() => save(draftRef.current));
        }}
        className="flex min-h-11 items-center gap-2 rounded-md px-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
      >
        <ImagePlus size={14} aria-hidden="true" />
        {t("ui.lorebooks.expandeddrawer.images")}
        {draft.length > 0 && <span>({draft.length})</span>}
        <ChevronDown size={14} className={expanded ? "rotate-180" : ""} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!expanded}>
        {expanded && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--muted-foreground)]">{t("ui.lorebooks.expandeddrawer.imagesHelp")}</p>
            <div className="space-y-2">
              {draft.map((image, index) => (
                <div
                  key={image.path}
                  className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-2"
                >
                  <a
                    href={image.path}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                    aria-label={t("lorebook.images.openReference", { number: index + 1 })}
                  >
                    <img
                      src={image.path}
                      alt={image.caption || t("lorebook.images.reference", { number: index + 1 })}
                      width={80}
                      height={80}
                      loading="lazy"
                      className="h-20 w-20 rounded-md object-contain"
                    />
                  </a>
                  <label className="min-w-0 flex-1 basis-32 text-xs">
                    {t("ui.lorebooks.expandeddrawer.imageCaption")}
                    <input
                      type="text"
                      name={`reference-caption-${index + 1}`}
                      autoComplete="off"
                      value={image.caption}
                      maxLength={500}
                      disabled={busy}
                      onChange={(event) => {
                        dirtyRef.current = true;
                        setImages(
                          draftRef.current.map((current) =>
                            current.path === image.path ? { ...current, caption: event.target.value } : current,
                          ),
                        );
                      }}
                      onBlur={(event) => {
                        if (event.relatedTarget instanceof Node && sectionRef.current?.contains(event.relatedTarget))
                          return;
                        if (dirtyRef.current) void run(() => save(draftRef.current));
                      }}
                      placeholder={t("ui.lorebooks.expandeddrawer.imageCaptionPlaceholder")}
                      className="mari-editor-field mt-1 min-h-11 w-full px-2"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={t("ui.lorebooks.expandeddrawer.removeImage")}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() =>
                      void run(() =>
                        save(
                          draftRef.current.filter((current) => current.path !== image.path),
                          remove,
                        ),
                      )
                    }
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || draft.length >= MAX_LOREBOOK_ENTRY_IMAGES}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="mari-editor-field flex min-h-11 items-center gap-2 px-3 text-xs disabled:opacity-50"
              >
                {busy ? <Spinner size="md" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
                {t("ui.lorebooks.expandeddrawer.addImage")}
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (dirtyRef.current)
                    void run(async () => {
                      await save(draftRef.current);
                      onAddWardrobeKey();
                    });
                  else onAddWardrobeKey();
                }}
                disabled={hasWardrobeKey || busy}
                className="mari-editor-field min-h-11 px-3 text-xs disabled:opacity-50"
              >
                {t("lorebook.images.addWardrobeKey")}
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(event) => void selectFiles(event)}
            />
          </div>
        )}
      </div>
      <p role="status" className={busy ? "text-xs text-[var(--muted-foreground)]" : "sr-only"}>
        {busy ? t("lorebook.images.saving") : ""}
      </p>
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-[var(--destructive)]">
          <span>{error}</span>
          {dirtyRef.current && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => save(draftRef.current))}
              className="mari-editor-field min-h-11 px-3"
            >
              {t("lorebook.images.retrySave")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
