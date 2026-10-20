// ──────────────────────────────────────────────
// Avatar generation: server calls and job state (lane: generation)
// ──────────────────────────────────────────────
// Generating returns drafts the browser holds; nothing is stored until the user keeps a result, so the
// owner's avatar stays as it was. Draft shapes mirror packages/server/src/services/avatars/generation/.
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AVATAR_API_PREFIXES,
  type AvatarGenerationResponse,
  type AvatarOwnerRef,
  type AvatarPngtuberVariant,
} from "@marinara-engine/shared";
import { useAvatarModelChanged } from "../../../hooks/use-avatar-models";
import { api } from "../../../lib/api-client";
import { translate } from "../../../localization/i18n";
import { useUIStore } from "../../../stores/ui.store";
import type { ImagePromptOverride, ImagePromptReviewItem } from "../../../components/ui/ImagePromptReviewModal";

const PREFIX = AVATAR_API_PREFIXES.generation;

export interface PngtuberVariantDraft {
  label: string;
  variant: AvatarPngtuberVariant;
  /** PNG data URL at the sprite's size (the new face's, with `face`). */
  image: string;
  width: number;
  height: number;
  /** Which version of the sprite it was drawn from; saving refuses a sprite replaced since. */
  sourceHash: string;
  /** From an image connection that can't edit pictures: the new face (PNG data URL) drawn with this picture
   *  and the other variant, as one set. Keeping the set replaces the face. */
  face?: string;
}

interface PngtuberDraftsResponse {
  drafts: PngtuberVariantDraft[];
  failed: Array<{ label: string; variant: AvatarPngtuberVariant; error: string }>;
}

export interface MeshRigDraft {
  /** The `.mavatar`, base64. */
  archive: string;
  /** The sprite with the face parts the vision model found. */
  preview: string;
  warnings: string[];
}

export interface VariantJobItem {
  id: string;
  label: string;
  variant: AvatarPngtuberVariant;
  status: "waiting" | "running" | "done" | "failed";
  draft?: PngtuberVariantDraft;
  error?: string;
  kept: boolean;
}

/** One picture to make: a sprite and which variant of it. */
export interface VariantPair {
  label: string;
  variant: AvatarPngtuberVariant;
}

export interface GenerationRunOptions {
  connectionId: string | null;
  promptOverrides?: ImagePromptOverride[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

function isAbort(error: unknown): boolean {
  return !!error && typeof error === "object" && "name" in error && error.name === "AbortError";
}

interface RunningJob {
  controller: AbortController;
  owner: AvatarOwnerRef;
}

/** The last Cancel's request to the server. A new start waits for it, so a cancel that arrives late never
 *  stops the job started after it. */
let pendingCancel: Promise<unknown> = Promise.resolve();

/** Stops a running job: closes its request and asks the server to stop it too, since a proxy between the
 *  browser and the server can keep the server's side of a closed request going. */
function stopJob(job: RunningJob | null, kind: "pngtuber" | "mesh-avatar") {
  if (!job || job.controller.signal.aborted) return;
  job.controller.abort();
  pendingCancel = api.post(`${PREFIX}/cancel`, { owner: job.owner, kind }).catch((error: unknown) => {
    console.warn("[avatars] Cancel request failed", error);
  });
}

/** Runs one async action at a time: a second call while one runs (a fast double click) does nothing.
 *  A failure is shown as a toast. */
export function useOneAtATime() {
  const runningRef = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setPending(true);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      runningRef.current = false;
      setPending(false);
    }
  }, []);
  return { pending, run };
}

export function variantJobId(label: string, variant: AvatarPngtuberVariant): string {
  return `${label}\u0000${variant}`;
}

/** The exact prompts a run would send, for the image prompt review. */
export function previewVariantPrompts(
  owner: AvatarOwnerRef,
  labels: string[],
  variants: AvatarPngtuberVariant[],
  connectionId: string | null,
) {
  return api.post<{ items: ImagePromptReviewItem[] }>(`${PREFIX}/pngtuber-variants/preview`, {
    owner,
    labels,
    variants,
    connectionId,
  });
}

/** Makes blink and talk pictures one at a time, so each can be checked, kept or tried again, and Cancel
 *  stops the picture being made, on the server too, and drops the ones not started. A second start while one
 *  runs does nothing. Pictures already made stay: a new start makes only the chosen ones not made yet, and a
 *  failed or cancelled try keeps the picture it was replacing (a failed redo or single picture says so in a
 *  toast too).
 *  `progress` counts the pictures of the run going on. */
export function usePngtuberVariantJob(owner: AvatarOwnerRef) {
  const [items, setItems] = useState<VariantJobItem[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const runningRef = useRef(false);
  const jobRef = useRef<RunningJob | null>(null);

  useEffect(() => () => stopJob(jobRef.current, "pngtuber"), []);
  // Another owner's pictures never belong to this one.
  useEffect(() => {
    stopJob(jobRef.current, "pngtuber");
    setItems([]);
  }, [owner.ownerType, owner.ownerId]);

  const update = useCallback((id: string, patch: Partial<VariantJobItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);
  /** Shows a new picture of `item`'s face. A set (a new face with both of its pictures) fills the other slot
   *  too; a picture for the face as it is drops the pictures of a new face the user didn't keep. */
  const showDrafts = useCallback((item: VariantJobItem, drafts: readonly PngtuberVariantDraft[]) => {
    setItems((current) => {
      const own = drafts.find((draft) => draft.label === item.label && draft.variant === item.variant);
      const setDrafts = own?.face
        ? drafts.filter((draft) => draft.label === item.label && draft.face === own.face)
        : [];
      const next = current.flatMap((entry): VariantJobItem[] => {
        if (entry.label !== item.label) return [entry];
        const draft = setDrafts.find((candidate) => variantJobId(candidate.label, candidate.variant) === entry.id);
        if (entry.id === item.id || draft) {
          return [{ ...entry, status: "done", draft: draft ?? own, kept: false, error: undefined }];
        }
        // A picture drawn for a new face that is no longer offered.
        return entry.draft?.face && !own?.face ? [] : [entry];
      });
      for (const draft of setDrafts) {
        const id = variantJobId(draft.label, draft.variant);
        if (!next.some((entry) => entry.id === id)) {
          next.push({ id, label: draft.label, variant: draft.variant, status: "done", draft, kept: false });
        }
      }
      return next;
    });
  }, []);
  /** A failed redo or single picture is a toast too (the slot may keep showing its old picture); a run of
   *  many shows each failure in its slot only, so one provider outage doesn't stack a toast per picture. */
  const failed = useCallback(
    (item: VariantJobItem, error: string, single: boolean) => {
      update(item.id, { status: "failed", error });
      if (item.draft || single) toast.error(error || translate("avatars.generation.failed"));
    },
    [update],
  );

  const run = useCallback(
    async (queue: VariantJobItem[], options: GenerationRunOptions) => {
      if (runningRef.current || !queue.length) return;
      runningRef.current = true;
      setRunning(true);
      const controller = new AbortController();
      jobRef.current = { controller, owner };
      try {
        await pendingCancel;
        /** Pictures a set already brought in this run. */
        const made = new Set<string>();
        for (const [index, item] of queue.entries()) {
          if (controller.signal.aborted) break;
          if (made.has(item.id)) continue;
          setProgress({ current: index + 1, total: queue.length });
          // Redoing a picture of a new face redoes the whole set, so its other picture is being redone too.
          setItems((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: "running", error: undefined }
                : item.draft?.face && entry.label === item.label && entry.draft?.face
                  ? { ...entry, status: "running" }
                  : entry,
            ),
          );
          const settleSet = () =>
            setItems((current) =>
              current.map((entry) =>
                entry.id !== item.id && entry.label === item.label && entry.status === "running"
                  ? { ...entry, status: entry.draft ? "done" : "waiting" }
                  : entry,
              ),
            );
          try {
            const response = await api.post<PngtuberDraftsResponse>(
              `${PREFIX}/pngtuber-variants`,
              {
                owner,
                labels: [item.label],
                variants: [item.variant],
                connectionId: options.connectionId,
                // The server picks each picture's reviewed prompt by its id.
                promptOverrides: options.promptOverrides,
                debugMode: useUIStore.getState().debugMode,
              },
              { signal: controller.signal },
            );
            const own = response.drafts.find((draft) => draft.label === item.label && draft.variant === item.variant);
            if (own) {
              showDrafts(item, response.drafts);
              if (own.face) {
                for (const draft of response.drafts) {
                  if (draft.label === item.label && draft.face === own.face)
                    made.add(variantJobId(draft.label, draft.variant));
                }
              }
            } else {
              settleSet();
              failed(item, response.failed[0]?.error ?? "", queue.length === 1);
            }
          } catch (error) {
            settleSet();
            if (controller.signal.aborted || isAbort(error)) {
              update(item.id, { status: item.draft ? "done" : "waiting" });
              break;
            }
            failed(item, errorMessage(error), queue.length === 1);
          }
        }
      } finally {
        if (jobRef.current?.controller === controller) jobRef.current = null;
        runningRef.current = false;
        setRunning(false);
        setProgress(null);
      }
    },
    [failed, owner, showDrafts, update],
  );

  const start = useCallback(
    (pairs: readonly VariantPair[], options: GenerationRunOptions) => {
      if (runningRef.current) return;
      const queue = pairs.flatMap(({ label, variant }): VariantJobItem[] => {
        const id = variantJobId(label, variant);
        return items.some((item) => item.id === id && item.draft)
          ? []
          : [{ id, label, variant, status: "waiting", kept: false }];
      });
      const queued = new Set(queue.map((item) => item.id));
      setItems([...items.filter((item) => !queued.has(item.id)), ...queue]);
      void run(queue, options);
    },
    [items, run],
  );

  const retry = useCallback(
    (id: string, options: GenerationRunOptions) => {
      const item = items.find((entry) => entry.id === id);
      if (item) void run([item], options);
    },
    [items, run],
  );

  const cancel = useCallback(() => {
    if (!jobRef.current) return;
    stopJob(jobRef.current, "pngtuber");
    // Back to idle: only pictures already made stay (a picture being redone keeps its last version).
    setItems((current) =>
      current.flatMap((item) =>
        item.status === "waiting" || item.status === "running"
          ? item.draft
            ? [{ ...item, status: "done" as const }]
            : []
          : [item],
      ),
    );
  }, []);
  /** Keeps a picture, or lets it go. The pictures of a new face are kept or let go together. */
  const setKept = useCallback(
    (id: string, kept: boolean) =>
      setItems((current) => {
        const face = current.find((item) => item.id === id)?.draft?.face;
        return current.map((item) =>
          item.id === id || (face && item.draft?.face === face) ? { ...item, kept } : item,
        );
      }),
    [],
  );
  /** Keeps every new picture among `ids` (the ones shown). */
  const keepAll = useCallback(
    (ids: ReadonlySet<string>) =>
      setItems((current) => current.map((item) => (item.draft && ids.has(item.id) ? { ...item, kept: true } : item))),
    [],
  );
  const removeSaved = useCallback(
    (ids: readonly string[]) => setItems((current) => current.filter((item) => !ids.includes(item.id))),
    [],
  );

  return { items, running, progress, start, retry, cancel, setKept, keepAll, removeSaved };
}

/** Builds one mesh avatar draft. A second start while one runs does nothing. */
export function useMeshRigJob(owner: AvatarOwnerRef) {
  const [draft, setDraft] = useState<(MeshRigDraft & { label: string }) | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const jobRef = useRef<RunningJob | null>(null);

  useEffect(() => () => stopJob(jobRef.current, "mesh-avatar"), []);
  useEffect(() => {
    stopJob(jobRef.current, "mesh-avatar");
    setDraft(null);
    setError(null);
  }, [owner.ownerType, owner.ownerId]);

  const start = useCallback(
    async (body: { sourceLabel: string; connectionId: string | null }) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);
      setError(null);
      const controller = new AbortController();
      jobRef.current = { controller, owner };
      try {
        await pendingCancel;
        controller.signal.throwIfAborted();
        const result = await api.post<MeshRigDraft>(
          `${PREFIX}/mesh-rig`,
          { owner, ...body, debugMode: useUIStore.getState().debugMode },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setDraft({ ...result, label: body.sourceLabel });
      } catch (caught) {
        if (!controller.signal.aborted && !isAbort(caught)) setError(errorMessage(caught));
      } finally {
        if (jobRef.current?.controller === controller) jobRef.current = null;
        runningRef.current = false;
        setRunning(false);
      }
    },
    [owner],
  );

  const cancel = useCallback(() => stopJob(jobRef.current, "mesh-avatar"), []);
  const discard = useCallback(() => setDraft(null), []);
  return { draft, running, error, start, cancel, discard };
}

export function useSavePngtuberVariants(owner: AvatarOwnerRef) {
  const changed = useAvatarModelChanged(owner);
  return useMutation({
    mutationFn: (
      images: Array<{
        label: string;
        variant: AvatarPngtuberVariant;
        image: string;
        sourceHash: string;
        face?: string;
      }>,
    ) => api.post<AvatarGenerationResponse>(`${PREFIX}/pngtuber-variants/save`, { owner, images }),
    onSuccess: (response) => changed(response.config),
  });
}

export function useSaveMeshRig(owner: AvatarOwnerRef) {
  const changed = useAvatarModelChanged(owner);
  return useMutation({
    mutationFn: (archive: string) => api.post<AvatarGenerationResponse>(`${PREFIX}/mesh-rig/save`, { owner, archive }),
    onSuccess: (response) => changed(response.config),
  });
}
