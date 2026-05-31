import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { generateClientId } from "../../../../shared/lib/utils";
import { useUploadAvatar } from "./use-characters";

type MutableRef<T> = {
  current: T;
};

export function useCharacterEditorAvatar({
  characterId,
  currentAvatarCrop,
  dirtyRef,
  editRevisionRef,
  saving,
  setDirtyState,
  setExtensionValue,
}: {
  characterId: string | null;
  currentAvatarCrop: unknown;
  dirtyRef: MutableRef<boolean>;
  editRevisionRef: MutableRef<number>;
  saving: boolean;
  setDirtyState: (nextDirty: boolean) => void;
  setExtensionValue: (key: string, value: unknown) => void;
}) {
  const uploadAvatar = useUploadAvatar();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const activeCharacterIdRef = useRef<string | null>(characterId);
  const latestAvatarUploadRef = useRef<{ token: string; characterId: string } | null>(null);
  const avatarUploadInFlightRef = useRef(false);

  useEffect(() => {
    activeCharacterIdRef.current = characterId;
    const upload = latestAvatarUploadRef.current;
    if (upload && upload.characterId !== characterId) {
      latestAvatarUploadRef.current = null;
      avatarUploadInFlightRef.current = false;
      setAvatarUploading(false);
    }
  }, [characterId]);

  const beginAvatarUpload = useCallback(() => {
    if (avatarUploadInFlightRef.current) return false;
    avatarUploadInFlightRef.current = true;
    setAvatarUploading(true);
    return true;
  }, []);

  const isCurrentAvatarUpload = useCallback((uploadToken: string, uploadCharacterId: string) => {
    const upload = latestAvatarUploadRef.current;
    return (
      upload?.token === uploadToken &&
      upload.characterId === uploadCharacterId &&
      activeCharacterIdRef.current === uploadCharacterId
    );
  }, []);

  const finishAvatarUpload = useCallback((uploadToken: string, uploadCharacterId: string) => {
    const upload = latestAvatarUploadRef.current;
    if (upload?.token !== uploadToken || upload.characterId !== uploadCharacterId) return;
    latestAvatarUploadRef.current = null;
    avatarUploadInFlightRef.current = false;
    setAvatarUploading(false);
  }, []);

  const isAvatarUploadInFlight = useCallback(() => avatarUploadInFlightRef.current, []);

  const handleAvatarUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !characterId) return;
      if (saving) {
        event.target.value = "";
        toast.error("Wait for the current save to finish before uploading an avatar.");
        return;
      }
      if (!beginAvatarUpload()) {
        event.target.value = "";
        toast.error("Wait for the current avatar upload to finish.");
        return;
      }

      const uploadCharacterId = characterId;
      const uploadToken = generateClientId();
      latestAvatarUploadRef.current = { token: uploadToken, characterId: uploadCharacterId };
      const fallbackAvatarPreview = avatarPreview;
      const fallbackAvatarCrop = currentAvatarCrop;
      const shouldClearAvatarCrop = fallbackAvatarCrop !== undefined;
      const fallbackDirty = dirtyRef.current;
      const editRevisionAtUploadStart = editRevisionRef.current;

      const reader = new FileReader();
      reader.onload = async () => {
        if (!isCurrentAvatarUpload(uploadToken, uploadCharacterId)) return;
        const dataUrl = reader.result as string;
        setAvatarPreview(dataUrl);
        // Clear saved crop because the replacement image almost certainly has different framing.
        if (shouldClearAvatarCrop) {
          setExtensionValue("avatarCrop", undefined);
        }
        if (fallbackDirty || shouldClearAvatarCrop) {
          setDirtyState(true);
        }
        try {
          await uploadAvatar.mutateAsync({ id: uploadCharacterId, avatar: dataUrl });
        } catch (error) {
          if (!isCurrentAvatarUpload(uploadToken, uploadCharacterId)) return;
          toast.error(error instanceof Error ? error.message : "Failed to upload avatar.");
          setAvatarPreview(fallbackAvatarPreview);
          if (shouldClearAvatarCrop) {
            setExtensionValue("avatarCrop", fallbackAvatarCrop);
          }
          if (editRevisionRef.current === editRevisionAtUploadStart) {
            setDirtyState(fallbackDirty);
          }
        } finally {
          finishAvatarUpload(uploadToken, uploadCharacterId);
        }
      };
      reader.onerror = () => {
        if (!isCurrentAvatarUpload(uploadToken, uploadCharacterId)) return;
        toast.error("Failed to read avatar image.");
        finishAvatarUpload(uploadToken, uploadCharacterId);
      };
      event.target.value = "";
      try {
        reader.readAsDataURL(file);
      } catch {
        toast.error("Failed to read avatar image.");
        finishAvatarUpload(uploadToken, uploadCharacterId);
      }
    },
    [
      avatarPreview,
      beginAvatarUpload,
      characterId,
      currentAvatarCrop,
      dirtyRef,
      editRevisionRef,
      finishAvatarUpload,
      isCurrentAvatarUpload,
      saving,
      setDirtyState,
      setExtensionValue,
      uploadAvatar,
    ],
  );

  const handleGeneratedAvatar = useCallback(
    async (avatarDataUrl: string) => {
      if (!characterId) return;
      if (saving) {
        throw new Error("Wait for the current save to finish before uploading an avatar.");
      }
      if (!beginAvatarUpload()) {
        throw new Error("Wait for the current avatar upload to finish.");
      }
      const uploadCharacterId = characterId;
      const uploadToken = generateClientId();
      latestAvatarUploadRef.current = { token: uploadToken, characterId: uploadCharacterId };
      const fallbackAvatarPreview = avatarPreview;
      const fallbackAvatarCrop = currentAvatarCrop;
      const shouldClearAvatarCrop = fallbackAvatarCrop !== undefined;
      const fallbackDirty = dirtyRef.current;
      const editRevisionAtUploadStart = editRevisionRef.current;

      setAvatarPreview(avatarDataUrl);
      if (shouldClearAvatarCrop) {
        setExtensionValue("avatarCrop", undefined);
      }
      if (fallbackDirty || shouldClearAvatarCrop) {
        setDirtyState(true);
      }
      try {
        await uploadAvatar.mutateAsync({ id: uploadCharacterId, avatar: avatarDataUrl });
        if (isCurrentAvatarUpload(uploadToken, uploadCharacterId)) {
          toast.success("Character avatar generated.");
        }
      } catch (error) {
        if (isCurrentAvatarUpload(uploadToken, uploadCharacterId)) {
          setAvatarPreview(fallbackAvatarPreview);
          if (shouldClearAvatarCrop) {
            setExtensionValue("avatarCrop", fallbackAvatarCrop);
          }
          if (editRevisionRef.current === editRevisionAtUploadStart) {
            setDirtyState(fallbackDirty);
          }
        }
        throw error;
      } finally {
        finishAvatarUpload(uploadToken, uploadCharacterId);
      }
    },
    [
      avatarPreview,
      beginAvatarUpload,
      characterId,
      currentAvatarCrop,
      dirtyRef,
      editRevisionRef,
      finishAvatarUpload,
      isCurrentAvatarUpload,
      saving,
      setDirtyState,
      setExtensionValue,
      uploadAvatar,
    ],
  );

  return {
    avatarPreview,
    avatarUploading,
    handleAvatarUpload,
    handleGeneratedAvatar,
    isAvatarUploadInFlight,
    setAvatarPreview,
  };
}
