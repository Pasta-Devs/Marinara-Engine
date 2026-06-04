import type { ConversationAvatarMode, ConversationAvatarOverride } from "../../../../engine/contracts/types/character";
import { useEffect, useState } from "react";
import { cn } from "../../../../shared/lib/utils";
import { useSprites } from "../../sprites/index";
import { useCharacterGalleryImages } from "../hooks/use-characters";
import { CharacterEditorSectionHeader } from "./CharacterEditorSectionHeader";

/**
 * Defensively parse an open-ended `extensions.conversationAvatar` bag into a known-good
 * override. Imported cards, stale saves, or hand-edited extensions can carry an unknown
 * mode or malformed value; anything that doesn't match a supported mode (or "default",
 * which means "no override") collapses to `undefined` so the control falls back to its
 * default state instead of an impossible one. The type annotation alone is not a parser.
 */
export function parseConversationAvatarOverride(value: unknown): ConversationAvatarOverride | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const mode = (value as { mode?: unknown }).mode;
  if (mode === "hide") return { mode };
  if (mode === "emoji" || mode === "sprite" || mode === "gallery") {
    const raw = (value as { value?: unknown }).value;
    return { mode, value: typeof raw === "string" && raw ? raw : undefined };
  }
  // "default" or any unrecognized mode ⇒ no override.
  return undefined;
}

const MODES: { mode: ConversationAvatarMode; label: string; hint: string }[] = [
  { mode: "default", label: "Default", hint: "Use the character's normal avatar" },
  { mode: "hide", label: "Hide", hint: "Show no avatar in Conversation mode" },
  { mode: "emoji", label: "Emoji", hint: "Show an emoji instead of an avatar" },
  { mode: "sprite", label: "Sprite", hint: "Pick one of this character's sprites" },
  { mode: "gallery", label: "Gallery", hint: "Pick one of this character's gallery images" },
];

type GridItem = { key: string; src: string; label: string; selected: boolean };

function isAssetMode(mode: ConversationAvatarMode | undefined): mode is "sprite" | "gallery" {
  return mode === "sprite" || mode === "gallery";
}

/**
 * Per-character avatar override for Conversation mode. Stored on the character card's
 * extensions as `{ mode, value }`; "default" clears the override entirely.
 */
export function ConversationAvatarControl({
  characterId,
  value,
  onChange,
}: {
  characterId: string | null;
  value: ConversationAvatarOverride | undefined;
  onChange: (next: ConversationAvatarOverride | undefined) => void;
}) {
  const [draftMode, setDraftMode] = useState<ConversationAvatarMode>(value?.mode ?? "default");
  const mode: ConversationAvatarMode = draftMode;

  useEffect(() => {
    const nextMode = value?.mode ?? "default";
    const isDraftingDifferentAssetMode = isAssetMode(draftMode) && draftMode !== value?.mode;
    if (!isDraftingDifferentAssetMode) {
      setDraftMode(nextMode);
    }
  }, [draftMode, value]);

  const selectMode = (next: ConversationAvatarMode) => {
    setDraftMode(next);
    if (next === "default") {
      onChange(undefined);
      return;
    }
    if (next === value?.mode) return;
    if (next === "sprite" || next === "gallery") {
      onChange(undefined);
      return;
    }
    onChange({ mode: next, value: undefined });
  };

  // Only fetch the asset list for the active mode (passing null disables the query).
  const { data: sprites, isLoading: spritesLoading } = useSprites(mode === "sprite" ? characterId : null);
  const { data: gallery, isLoading: galleryLoading } = useCharacterGalleryImages(
    mode === "gallery" ? characterId : null,
  );

  return (
    <div className="space-y-3">
      <CharacterEditorSectionHeader
        title="Conversation Avatar"
        subtitle="Override the avatar shown next to this character's messages in Conversation mode. Roleplay mode is unaffected."
      />

      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            onClick={() => selectMode(m.mode)}
            title={m.hint}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              mode === m.mode
                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/40"
                : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "emoji" && (
        <div className="flex items-center gap-3">
          <input
            value={value?.value ?? ""}
            onChange={(e) => onChange({ mode: "emoji", value: e.target.value })}
            maxLength={8}
            placeholder="🥞"
            aria-label="Avatar emoji"
            className="w-20 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-center text-2xl outline-none focus:ring-1 focus:ring-purple-400/40"
          />
          <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
            Type or paste an emoji to use as the avatar.
          </span>
        </div>
      )}

      {mode === "sprite" && (
        <AssetGrid
          loading={spritesLoading}
          emptyText={
            characterId ? "No sprites uploaded for this character yet." : "Save the character first to use its sprites."
          }
          items={(sprites ?? []).map((s) => ({
            key: s.expression,
            src: s.url,
            label: s.expression,
            selected: value?.value === s.expression,
          }))}
          onSelect={(key) => {
            setDraftMode("sprite");
            onChange({ mode: "sprite", value: key });
          }}
        />
      )}

      {mode === "gallery" && (
        <AssetGrid
          loading={galleryLoading}
          emptyText={
            characterId
              ? "No gallery images for this character yet."
              : "Save the character first to use its gallery images."
          }
          items={(gallery ?? []).map((g, i) => ({
            key: g.id,
            src: g.url,
            // Fall back to a deterministic name so assistive tech never gets an empty
            // button title / image alt when a gallery image has no prompt.
            label: g.prompt || `Gallery image ${i + 1}`,
            selected: value?.value === g.id,
          }))}
          onSelect={(key) => {
            setDraftMode("gallery");
            onChange({ mode: "gallery", value: key });
          }}
        />
      )}
    </div>
  );
}

function AssetGrid({
  loading,
  emptyText,
  items,
  onSelect,
}: {
  loading: boolean;
  emptyText: string;
  items: GridItem[];
  onSelect: (key: string) => void;
}) {
  if (loading) {
    return <p className="text-[0.6875rem] text-[var(--muted-foreground)]">Loading…</p>;
  }
  if (items.length === 0) {
    return <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{emptyText}</p>;
  }
  return (
    <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onSelect(it.key)}
          title={it.label}
          className={cn(
            "relative aspect-square overflow-hidden rounded-lg bg-black/30 ring-1 transition-all",
            it.selected ? "ring-2 ring-purple-400" : "ring-[var(--border)] hover:ring-purple-400/50",
          )}
        >
          <img src={it.src} alt={it.label} loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
