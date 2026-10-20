// A mesh avatar built from one of the owner's sprites (lane: generation).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMayReadImages } from "../../../hooks/use-connections";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { normalizeSpriteExpressionKey, type AvatarOwnerRef } from "@marinara-engine/shared";
import type { SpriteInfo } from "../../../hooks/use-characters";
import { isFullBodySprite } from "../renderers/pngtuber/pngtuber-layers";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { SpritePicker } from "./SpritePicker";
import { useMeshRigJob, useOneAtATime, useSaveMeshRig } from "./use-avatar-generation";

export interface ConnectionOption {
  id: string;
  name: string;
  provider: string;
}

/** The sprite picked for the user until they choose one: the full-body neutral sprite, else the neutral portrait. */
function preferredMeshSource(sprites: readonly SpriteInfo[]): string | null {
  const neutral = sprites.filter((sprite) => normalizeSpriteExpressionKey(sprite.expression) === "neutral");
  return (neutral.find((sprite) => isFullBodySprite(sprite.expression)) ?? neutral[0])?.expression ?? null;
}

export function MeshAvatarSection({
  owner,
  sprites,
  onChanged,
}: {
  owner: AvatarOwnerRef;
  sprites: SpriteInfo[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const mayReadImages = useMayReadImages();
  // Undefined until the user picks or clears a sprite. Without a pick, or once the picked sprite is gone, the
  // preferred one follows the sprite list.
  const [picked, setPicked] = useState<string | null>();
  const label =
    picked === null || (picked !== undefined && sprites.some((sprite) => sprite.expression === picked))
      ? picked
      : preferredMeshSource(sprites);
  const [visionConnectionId, setVisionConnectionId] = useState<string | null>(null);
  const saving = useOneAtATime();
  const job = useMeshRigJob(owner);
  const save = useSaveMeshRig(owner);
  const busy = job.running;

  const start = () => {
    if (job.running || !label) return;
    void job.start({ sourceLabel: label, connectionId: visionConnectionId });
  };

  const keep = () =>
    saving.run(async () => {
      if (!job.draft) return;
      try {
        await save.mutateAsync(job.draft.archive);
        toast.success(t("avatars.generation.meshSaved"));
        job.discard();
        onChanged();
      } catch (error) {
        toast.error(
          t("avatars.generation.saveFailed", { error: error instanceof Error ? error.message : String(error) }),
        );
      }
    });

  return (
    <section className="space-y-3" aria-labelledby="avatar-generation-mesh">
      <div>
        <h4 id="avatar-generation-mesh" className="text-[0.8125rem] font-semibold text-[var(--foreground)]">
          {t("avatars.generation.meshTitle")}
        </h4>
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("avatars.generation.meshDescription")}</p>
      </div>
      <SpritePicker
        sprites={sprites}
        selected={label ? [label] : []}
        disabled={busy}
        label={t("avatars.generation.sourceSprite")}
        onToggle={(expression) => setPicked(label === expression ? null : expression)}
      />
      <div className="md:max-w-sm">
        <label className="flex flex-col gap-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          {t("avatars.generation.visionConnection")}
          <fieldset disabled={busy} className="min-w-0">
            <ConnectionSelect
              value={visionConnectionId}
              onChange={setVisionConnectionId}
              rowFilter={mayReadImages}
              addJob="vision"
              defaultLabel={t("avatars.generation.visionConnectionAgent")}
            />
          </fieldset>
        </label>
      </div>
      <p className="text-[0.625rem] text-[var(--muted-foreground)]">{t("avatars.generation.sourceSpriteHelp")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          disabled={busy || !label}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/85 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size="0.875rem" className="animate-spin" aria-hidden />
          ) : (
            <Sparkles size="0.875rem" aria-hidden />
          )}
          {t("avatars.generation.makeMesh")}
        </button>
        {job.running && (
          <>
            <span role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("avatars.generation.makeMeshRunning")}
            </span>
            <button
              type="button"
              onClick={job.cancel}
              className="inline-flex min-h-9 items-center gap-1 rounded-xl px-3 py-2 text-xs ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] active:scale-95"
            >
              <X size="0.875rem" aria-hidden />
              {t("avatars.generation.cancel")}
            </button>
          </>
        )}
      </div>
      {job.error && (
        <p role="alert" className="flex items-start gap-1.5 text-[0.6875rem] text-[var(--foreground)]">
          <AlertTriangle
            size="0.75rem"
            className="mt-px shrink-0 text-[var(--marinara-app-accent-static)]"
            aria-hidden
          />
          {job.error}
        </p>
      )}
      {job.draft && (
        <div className="space-y-2 rounded-xl bg-[var(--secondary)] p-2 ring-1 ring-[var(--border)]">
          <img
            src={job.draft.preview}
            alt={t("avatars.generation.meshPreviewAlt", { name: job.draft.label.replace(/_/gu, " ") })}
            className="mx-auto max-h-80 w-auto rounded-lg object-contain"
          />
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("avatars.generation.meshCheck")}</p>
          {job.draft.warnings.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-[0.625rem] text-[var(--muted-foreground)]">
              {job.draft.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void keep()}
              disabled={save.isPending}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/85 active:scale-95 disabled:opacity-50"
            >
              {save.isPending && <Loader2 size="0.875rem" className="animate-spin" aria-hidden />}
              {t("avatars.generation.saveMesh")}
            </button>
            <button
              type="button"
              onClick={job.discard}
              disabled={save.isPending}
              className="inline-flex min-h-9 items-center rounded-xl px-3 py-2 text-xs ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] active:scale-95 disabled:opacity-50"
            >
              {t("avatars.generation.discard")}
            </button>
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
              {t("avatars.generation.unsavedHint")}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
