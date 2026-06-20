// ──────────────────────────────────────────────
// Modal: Create Character (avatar + name only)
// ──────────────────────────────────────────────
import { useState, useRef } from "react";
import { Modal } from "../ui/Modal";
import { useCreateCharacter, useUploadAvatar } from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import { Loader2, Sparkles, User, Camera } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateCharacterModal({ open, onClose }: Props) {
  const createCharacter = useCreateCharacter();
  const uploadAvatar = useUploadAvatar();
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);

  const [name, setName] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setAvatarDataUrl(null);
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const result = await createCharacter.mutateAsync({
        name,
        data: {
          name,
          description: "",
          personality: "",
          first_mes: "",
          scenario: "",
          system_prompt: "",
          mes_example: "",
          creator_notes: "",
          tags: [],
          creator: "",
          character_version: "1.0",
          extensions: {},
          alternate_greetings: [],
          character_book: undefined,
          post_history_instructions: "",
        },
        format: "chara_card_v2" as const,
      });

      const charId = (result as { id: string })?.id;

      // Upload avatar if one was selected
      if (charId && avatarDataUrl) {
        try {
          await uploadAvatar.mutateAsync({ id: charId, avatar: avatarDataUrl });
        } catch {
          // non-fatal — character still created
        }
      }

      onClose();
      reset();

      // Open the full editor so the user can fill in the rest
      if (charId) {
        openCharacterDetail(charId);
      }
    } catch {
      // creation failed — stay in modal
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Character" width="max-w-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Avatar picker */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-400 to-rose-500 shadow-lg shadow-pink-400/20 transition-transform hover:scale-105"
        >
          {avatarDataUrl ? (
            <img src={avatarDataUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <User size="2.25rem" className="text-white" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="1.25rem" className="text-white" />
          </div>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />

        {/* Name */}
        <div className="w-full">
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Character name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </div>

        {/* Footer */}
        <div className="flex w-full justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            onClick={() => {
              onClose();
              reset();
            }}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || createCharacter.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {createCharacter.isPending ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <Sparkles size="0.75rem" />
            )}
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}
