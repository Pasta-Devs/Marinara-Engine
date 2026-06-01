import { MessageCircle, Pencil, Star, User } from "lucide-react";
import { useStartChatFromCharacter } from "../hooks/use-start-chat-from-character";
import { characterAvatarUrl } from "../lib/character-avatar-url";
import {
  getCharacterMeta,
  getCharacterSections,
  getText,
  truncateText,
  type ParsedCharacterRow,
} from "../lib/character-library-model";
import { getCharacterTitle } from "../../../../shared/lib/character-display";
import { CharacterAvatarImage } from "./CharacterAvatarImage";

type CharacterLibraryDetailCardProps = {
  character: ParsedCharacterRow;
  onEdit: (id: string) => void;
  fullRecordLoading?: boolean;
  fullRecordError?: boolean;
  onRetryFullRecord?: () => void;
};

export function CharacterLibraryDetailCard({
  character,
  onEdit,
  fullRecordLoading = false,
  fullRecordError = false,
  onRetryFullRecord,
}: CharacterLibraryDetailCardProps) {
  const { startChatFromCharacter, isStartingChat } = useStartChatFromCharacter();
  const characterName = getText(character.parsed.name) || "Unnamed";
  const characterTitle = getCharacterTitle({ name: characterName, comment: character.comment });
  const characterMeta = getCharacterMeta(character);
  const creatorNotes = getText(character.parsed.creator_notes);
  const sections = getCharacterSections(character);
  const avatarUrl = characterAvatarUrl(character);
  const startDisabled = isStartingChat || fullRecordLoading || fullRecordError;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)]/50 bg-[var(--background)]/70 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.95)] sm:rounded-[2rem]">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-pink-400/25 via-rose-500/15 to-sky-400/15">
          {avatarUrl ? (
            <CharacterAvatarImage
              src={avatarUrl}
              avatarFilePath={character.avatarFilePath}
              avatarFilename={character.avatarFilename}
              alt={characterName || "Selected character"}
              crop={character.parsed.extensions?.avatarCrop}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/85">
              <User size="2.5rem" />
            </div>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{characterName}</h2>
                {characterTitle && (
                  <p className="mt-1 truncate text-sm italic text-[var(--muted-foreground)]">{characterTitle}</p>
                )}
                {characterMeta && (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                    {characterMeta}
                  </p>
                )}
              </div>
              {Boolean(character.parsed.extensions?.fav) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[0.6875rem] font-medium text-amber-300">
                  <Star size="0.75rem" className="fill-current" /> Favorite
                </span>
              )}
            </div>

            {creatorNotes && (
              <p className="mt-4 rounded-[1.5rem] border border-[var(--border)]/50 bg-[var(--secondary)]/70 px-4 py-3 text-sm leading-6 text-[var(--muted-foreground)]">
                {creatorNotes}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  startChatFromCharacter({
                    characterId: character.id,
                    characterName,
                    mode: "roleplay",
                    firstMessage: getText(character.parsed.first_mes),
                    alternateGreetings: Array.isArray(character.parsed.alternate_greetings)
                      ? character.parsed.alternate_greetings
                      : [],
                  })
                }
                disabled={startDisabled}
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] shadow-lg shadow-pink-500/15 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MessageCircle size="0.875rem" />
                {fullRecordLoading ? "Loading..." : "Start New Chat"}
              </button>
              <button
                onClick={() => onEdit(character.id)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-rose-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/15 transition-all hover:shadow-pink-500/25"
              >
                <Pencil size="0.875rem" />
                Edit Character
              </button>
            </div>

            {fullRecordError && (
              <button
                type="button"
                onClick={onRetryFullRecord}
                className="mt-3 text-xs font-medium text-[var(--destructive)] transition-colors hover:opacity-80"
              >
                Character details could not be loaded. Retry
              </button>
            )}
          </div>
        </div>
      </div>

      {sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.5rem] border border-[var(--border)]/50 bg-[var(--background)]/65 p-4"
            >
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                {section.title}
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]/88">
                {truncateText(section.content, section.title === "Opening Message" ? 420 : 620)}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
