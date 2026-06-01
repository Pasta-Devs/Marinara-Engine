import { Star, User } from "lucide-react";
import { characterAvatarUrl } from "../lib/character-avatar-url";
import { getCharacterTagsFromData } from "../lib/character-search";
import {
  getCharacterMeta,
  getCharacterSummary,
  getText,
  truncateText,
  type ParsedCharacterRow,
} from "../lib/character-library-model";
import { getCharacterTitle } from "../../../../shared/lib/character-display";
import { cn } from "../../../../shared/lib/utils";
import { CharacterAvatarImage } from "./CharacterAvatarImage";

type CharacterLibraryCardProps = {
  character: ParsedCharacterRow;
  active: boolean;
  onSelect: (id: string) => void;
};

export function CharacterLibraryCard({ character, active, onSelect }: CharacterLibraryCardProps) {
  const characterName = getText(character.parsed.name) || "Unnamed";
  const characterTitle = getCharacterTitle({ name: characterName, comment: character.comment });
  const cardSummary = truncateText(getCharacterSummary(character), 180);
  const cardMeta = getCharacterMeta(character);
  const isFavorite = !!character.parsed.extensions?.fav;
  const tags = getCharacterTagsFromData(character.parsed);
  const avatarUrl = characterAvatarUrl(character);

  return (
    <button
      type="button"
      onClick={() => onSelect(character.id)}
      className={cn(
        "group flex h-full items-stretch overflow-hidden rounded-[1.25rem] border bg-[var(--card)]/70 text-left shadow-[0_20px_50px_-32px_rgba(15,23,42,0.75)] transition-all hover:border-[var(--primary)]/35 hover:shadow-[0_24px_60px_-32px_rgba(244,114,182,0.45)] sm:flex-col sm:rounded-[1.75rem] sm:hover:-translate-y-0.5",
        active ? "border-[var(--primary)]/45 ring-1 ring-[var(--primary)]/25" : "border-[var(--border)]/50",
      )}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-gradient-to-br from-pink-400/25 via-rose-500/15 to-sky-400/15 sm:h-auto sm:w-full sm:aspect-[4/3]">
        {avatarUrl ? (
          <CharacterAvatarImage
            src={avatarUrl}
            avatarFilePath={character.avatarFilePath}
            avatarFilename={character.avatarFilename}
            alt={characterName}
            crop={character.parsed.extensions?.avatarCrop}
            className="transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/85">
            <User size="1.5rem" className="sm:h-8 sm:w-8" />
          </div>
        )}

        {isFavorite && (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[0.5625rem] font-medium text-amber-200 backdrop-blur-sm sm:right-3 sm:top-3 sm:text-[0.625rem]">
            <Star size="0.625rem" className="fill-current sm:h-[0.6875rem] sm:w-[0.6875rem]" /> Favorite
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--foreground)] sm:text-base">{characterName}</div>
          {characterTitle && (
            <div className="mt-0.5 truncate text-[0.625rem] italic text-[var(--muted-foreground)] sm:mt-1 sm:text-[0.6875rem]">
              {characterTitle}
            </div>
          )}
          {cardMeta && (
            <div className="mt-0.5 truncate text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)] sm:mt-1 sm:text-[0.625rem] sm:tracking-[0.18em]">
              {cardMeta}
            </div>
          )}
        </div>

        <p className="line-clamp-3 text-[0.6875rem] leading-4 text-[var(--muted-foreground)] sm:line-clamp-4 sm:text-xs sm:leading-5">
          {cardSummary}
        </p>

        <div className="mt-auto flex flex-wrap gap-1 sm:gap-1.5">
          {tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[var(--primary)]/8 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]/85 sm:px-2 sm:py-1 sm:text-[0.625rem]"
            >
              {tag}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)] sm:px-2 sm:py-1 sm:text-[0.625rem]">
              +{tags.length - 2}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
