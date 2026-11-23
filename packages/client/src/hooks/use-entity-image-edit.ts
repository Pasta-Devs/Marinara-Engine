import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ImageRegenerator } from "../components/chat/ImageRegeneratePanel";
import type { ImagePromptDraft } from "./use-regenerate-chat-image";
import type { ChatImage, RegenerateChatImageInput } from "./use-gallery";
import { characterKeys } from "./use-characters";
import { api } from "../lib/api-client";

export type EntityImageOwner = { kind: "character" | "persona"; id: string };
export type EntityEditableImage = Omit<ChatImage, "chatId">;

export function entityImagePath(owner: EntityImageOwner) {
  return `/characters/${owner.kind === "persona" ? "personas/" : ""}${encodeURIComponent(owner.id)}`;
}

export function useEntityImageRegenerator(owner: EntityImageOwner, avatarPreview = false): ImageRegenerator {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const path = entityImagePath(owner);
  const { mutateAsync: regenerate } = useMutation({
    mutationFn: ({ imageId, ...input }: RegenerateChatImageInput) =>
      api.post<EntityEditableImage>(`${path}/gallery/${encodeURIComponent(imageId)}/regenerate`, input),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: owner.kind === "persona" ? characterKeys.personaGallery(owner.id) : characterKeys.gallery(owner.id),
      });
      if (owner.kind === "character") {
        void qc.invalidateQueries({ queryKey: characterKeys.galleryBackgrounds() });
      }
    },
  });
  const { mutateAsync: revise } = useMutation({
    mutationFn: ({
      imageId,
      ...input
    }: ImagePromptDraft & {
      imageId: string;
      guidance: string;
      connectionId?: string;
      debugMode: boolean;
    }) => api.post<ImagePromptDraft>(`${path}/gallery/${encodeURIComponent(imageId)}/regenerate/prompt`, input),
  });
  return useMemo(
    () => ({
      defaultConnectionLabel: t("images.entity.sameConnection"),
      regeneratedMessage: t(avatarPreview ? "images.entity.avatarEditSaved" : "images.entity.savedEdit"),
      regenerate: async (input) => ({ ...(await regenerate(input)), chatId: "" }),
      revise,
    }),
    [regenerate, revise, t, avatarPreview],
  );
}

export function usePrepareAvatarEdit(owner: EntityImageOwner) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EntityEditableImage>(`${entityImagePath(owner)}/avatar/edit-source`),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: owner.kind === "persona" ? characterKeys.personaGallery(owner.id) : characterKeys.gallery(owner.id),
      });
    },
  });
}
