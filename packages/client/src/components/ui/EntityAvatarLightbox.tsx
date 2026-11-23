import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import type { EntityEditableImage, EntityImageOwner } from "../../hooks/use-entity-image-edit";
import { EntityImageLightbox } from "./EntityImageLightbox";

export function EntityAvatarLightbox({
  owner,
  image,
  onUseAvatar,
  onClose,
}: {
  owner: EntityImageOwner;
  image: EntityEditableImage;
  onUseAvatar: (dataUrl: string, metadata?: { sourceImageId: string }) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const apply = useMutation({
    mutationFn: async (selected: EntityEditableImage) => {
      // Only server-owned gallery URLs are returned by the edit adapter.
      if (!selected.url.startsWith("/api/")) throw new Error(t("images.entity.openFailed"));
      const blob = await api.blob(selected.url.slice(4));
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error(t("images.entity.openFailed")));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      if (!mounted.current) return false;
      await onUseAvatar(dataUrl, { sourceImageId: selected.id });
      return true;
    },
    onSuccess: (applied) => {
      if (applied && mounted.current) onClose();
    },
    onError: (error) => {
      if (mounted.current) toast.error(error.message);
    },
  });
  return (
    <EntityImageLightbox
      owner={owner}
      image={image}
      onClose={onClose}
      busy={apply.isPending}
      applyEditedOnly
      onUseImage={(selected) => apply.mutate(selected)}
    />
  );
}
