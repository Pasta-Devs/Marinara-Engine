import { useRef, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Camera,
  Copy,
  Loader2,
  MessageCircle,
  Save,
  Star,
  StarOff,
  Trash2,
  User,
  UserPlus,
  Wand2,
} from "lucide-react";

import type { CharacterData } from "../../../../engine/contracts/types/character";
import { cn, getAvatarCropStyle, type AvatarCrop } from "../../../../shared/lib/utils";

export function CharacterEditorHeader({
  characterId,
  formData,
  characterComment,
  avatarPreview,
  avatarUploading,
  dirty,
  imageGenerationAvailable,
  isImportingPersona,
  isStartingChat,
  saving,
  onAvatarUpload,
  onBack,
  onCommentChange,
  onDelete,
  onDuplicate,
  onExport,
  onGenerateAvatar,
  onImportAsPersona,
  onNameChange,
  onSave,
  onStartChat,
  onToggleFavorite,
}: {
  characterId: string | null;
  formData: CharacterData;
  characterComment: string;
  avatarPreview: string | null;
  avatarUploading: boolean;
  dirty: boolean;
  imageGenerationAvailable: boolean;
  isImportingPersona: boolean;
  isStartingChat: boolean;
  saving: boolean;
  onAvatarUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onCommentChange: (comment: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onGenerateAvatar: () => void;
  onImportAsPersona: () => void;
  onNameChange: (name: string) => void;
  onSave: () => void | Promise<unknown>;
  onStartChat: () => void;
  onToggleFavorite: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveDisabled = !dirty || saving || avatarUploading;
  const headerActionButtonClass =
    "rounded-xl p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] max-md:rounded-lg max-md:p-1.5";

  const headerActions = (
    <>
      <button
        type="button"
        onClick={onStartChat}
        disabled={!characterId || isStartingChat}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 max-md:rounded-lg max-md:px-2.5 max-md:py-1.5"
        title="Start new chat"
      >
        <MessageCircle size="1rem" />
        <span className="max-sm:hidden">Start Chat</span>
      </button>

      <button
        type="button"
        onClick={onToggleFavorite}
        className={cn(
          "rounded-xl p-2 transition-all max-md:rounded-lg max-md:p-1.5",
          formData.extensions.fav ? "text-yellow-400" : "text-[var(--muted-foreground)] hover:text-yellow-400",
        )}
        title={formData.extensions.fav ? "Remove from favorites" : "Add to favorites"}
      >
        {formData.extensions.fav ? <Star size="1rem" fill="currentColor" /> : <StarOff size="1rem" />}
      </button>

      <button type="button" onClick={onExport} className={headerActionButtonClass} title="Export character">
        <svg width="1rem" height="1rem" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 13V3m0 0l-4 4m4-4l4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="3" y="15" width="14" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onImportAsPersona}
        disabled={isImportingPersona}
        className="rounded-xl p-2 text-[var(--muted-foreground)] transition-all hover:bg-emerald-500/10 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 max-md:rounded-lg max-md:p-1.5"
        title="Import character as persona"
      >
        {isImportingPersona ? <Loader2 size="1rem" className="animate-spin" /> : <UserPlus size="1rem" />}
      </button>

      <button
        type="button"
        onClick={onDuplicate}
        className="rounded-xl p-2 text-[var(--muted-foreground)] transition-all hover:bg-sky-400/10 hover:text-sky-400 max-md:rounded-lg max-md:p-1.5"
        title="Duplicate character"
      >
        <Copy size="1rem" />
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="rounded-xl p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] max-md:rounded-lg max-md:p-1.5"
        title="Delete character"
      >
        <Trash2 size="1rem" />
      </button>
    </>
  );

  return (
    <div className="flex min-h-12 flex-shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-0 max-md:gap-2 max-md:px-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 max-md:min-w-full">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl p-2 transition-all hover:bg-[var(--accent)] active:scale-95 max-md:rounded-lg max-md:p-1.5"
          title="Back"
        >
          <ArrowLeft size="1.125rem" />
        </button>

        <div
          className="group relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-md shadow-pink-500/20 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/45 max-md:h-10 max-md:w-10"
          role="button"
          tabIndex={0}
          aria-label="Upload avatar"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            fileInputRef.current?.click();
          }}
        >
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt={formData.name}
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(formData.extensions.avatarCrop as AvatarCrop | undefined)}
            />
          ) : (
            <User size="1.375rem" className="text-white" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="1rem" className="text-white" />
          </div>
          {imageGenerationAvailable && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onGenerateAvatar();
              }}
              className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--card)]/95 text-[var(--primary)] opacity-0 shadow-md ring-1 ring-[var(--border)] transition-opacity hover:bg-[var(--card)] group-hover:opacity-100 max-md:opacity-100"
              title="Generate avatar"
            >
              <Wand2 size="0.75rem" />
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={formData.name}
            onChange={(event) => onNameChange(event.target.value)}
            className="w-full bg-transparent text-lg font-bold outline-none"
            placeholder="Character name"
          />
          <input
            value={characterComment}
            onChange={(event) => onCommentChange(event.target.value)}
            className="w-full bg-transparent text-xs text-[var(--muted-foreground)] outline-none"
            placeholder="Title / comment (e.g. 'Modern AU version')"
          />
          <p className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
            {formData.creator ? `by ${formData.creator}` : "No creator"} · v{formData.character_version || "1.0"}
          </p>
        </div>
      </div>

      <div className="hidden items-center gap-1 md:flex">{headerActions}</div>

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saveDisabled}
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-all",
          !saveDisabled
            ? "bg-gradient-to-r from-pink-400 to-purple-500 text-white shadow-md shadow-pink-500/20 hover:shadow-lg active:scale-[0.98]"
            : "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed",
        )}
      >
        <Save size="0.8125rem" />
        <span className="max-md:hidden">{avatarUploading ? "Uploading…" : saving ? "Saving…" : "Save"}</span>
      </button>

      <div className="flex w-full items-center justify-end gap-1 md:hidden">{headerActions}</div>
    </div>
  );
}
