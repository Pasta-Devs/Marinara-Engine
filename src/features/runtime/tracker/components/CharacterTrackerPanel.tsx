import type { ReactNode } from "react";
import { Users } from "lucide-react";
import type { PresentCharacter } from "../../../../engine/contracts/types/game-state";
import type {
  TrackerPanelSizeProfile,
  TrackerPanelSide,
  TrackerThoughtBubbleDisplay,
} from "../../../../shared/stores/ui.store";
import { cn } from "../../../../shared/lib/utils";
import { getCharacterFeatureKey } from "./tracker-character.helpers";
import { getSpriteExpressionForCharacter } from "./tracker-sprite.helpers";
import type { TrackerProfileColors } from "./tracker-profile-colors";
import { AddRowButton, EmptySection, SectionHeader } from "./tracker-data-sidebar.controls";
import { CharacterTrackerCard } from "./CharacterTrackerCard";

const EXPANDED_COMPACT_CARD_GHOST_CLASS =
  "pointer-events-none hidden self-stretch rounded-md border border-dashed border-[var(--border)]/35 bg-[color-mix(in_srgb,var(--card)_10%,transparent)] opacity-55 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent)] @min-[220px]:block";

export function CharacterTrackerPanel({
  activeChatId,
  characters,
  featuredCharacterCards,
  spriteExpressions,
  expressionSpritesEnabled,
  characterPictures,
  characterProfileColors,
  resolveSpriteCharacterId,
  trackerPanelSide,
  trackerPanelSizeProfile,
  thoughtBubbleDisplay,
  dockedThoughtsAlwaysVisible,
  onUpdateCharacter,
  onRemoveCharacter,
  onAddCharacter,
  onToggleFeatured,
  onUploadAvatar,
  deleteMode,
  addMode,
  action,
  collapsed = false,
  onToggleCollapsed,
}: {
  activeChatId: string | null;
  characters: PresentCharacter[];
  featuredCharacterCards: Set<string>;
  spriteExpressions: Record<string, string>;
  expressionSpritesEnabled: boolean;
  characterPictures: Record<string, string>;
  characterProfileColors: Record<string, TrackerProfileColors>;
  resolveSpriteCharacterId: (character: PresentCharacter) => string | null;
  trackerPanelSide: TrackerPanelSide;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  thoughtBubbleDisplay: TrackerThoughtBubbleDisplay;
  dockedThoughtsAlwaysVisible: boolean;
  onUpdateCharacter: (index: number, character: PresentCharacter) => void;
  onRemoveCharacter: (index: number) => void;
  onAddCharacter: () => void;
  onToggleFeatured: (key: string) => void;
  onUploadAvatar: (index: number) => void;
  deleteMode: boolean;
  addMode: boolean;
  action?: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const renderCharacterCards = () => {
    if (characters.length === 0) {
      return (
        <div className="p-1">
          <EmptySection>No characters tracked.</EmptySection>
        </div>
      );
    }

    const characterEntries = characters.map((character, index) => {
      const cardKey = getCharacterFeatureKey(character, index);
      const spriteCharacterId = resolveSpriteCharacterId(character);
      return {
        character,
        cardKey,
        spriteCharacterId,
        spriteExpression: expressionSpritesEnabled
          ? getSpriteExpressionForCharacter(spriteExpressions, character, spriteCharacterId)
          : undefined,
        characterPicture: spriteCharacterId ? characterPictures[spriteCharacterId] : undefined,
        profileColors: spriteCharacterId ? characterProfileColors[spriteCharacterId] : undefined,
        featured: featuredCharacterCards.has(cardKey),
        index,
      };
    });
    const featuredEntries = characterEntries.filter((entry) => entry.featured);
    const compactEntries = characterEntries.filter((entry) => !entry.featured);
    const allowCompactCardColumns = trackerPanelSizeProfile !== "compact";
    const showExpandedGhostCard = trackerPanelSizeProfile === "expanded" && compactEntries.length === 1;
    const renderCharacterCard = ({
      character,
      cardKey,
      spriteCharacterId,
      spriteExpression,
      characterPicture,
      profileColors,
      featured,
      index,
    }: (typeof characterEntries)[number]) => (
      <CharacterTrackerCard
        key={`${activeChatId ?? "chat"}-${character.characterId}-${index}`}
        character={character}
        spriteCharacterId={spriteCharacterId}
        spriteExpression={spriteExpression}
        expressionSpritesEnabled={expressionSpritesEnabled}
        characterPicture={characterPicture}
        profileColors={profileColors}
        trackerPanelSide={trackerPanelSide}
        trackerPanelSizeProfile={trackerPanelSizeProfile}
        thoughtBubbleDisplay={thoughtBubbleDisplay}
        dockedThoughtsAlwaysVisible={dockedThoughtsAlwaysVisible}
        onUpdate={(updated) => onUpdateCharacter(index, updated)}
        onRemove={() => onRemoveCharacter(index)}
        deleteMode={deleteMode}
        addMode={addMode}
        featured={featured}
        onToggleFeatured={() => onToggleFeatured(cardKey)}
        onUploadAvatar={() => onUploadAvatar(index)}
      />
    );

    return (
      <div className="space-y-1">
        {featuredEntries.map(renderCharacterCard)}
        {compactEntries.length > 0 && (
          <div
            className={cn(
              "grid grid-cols-1 items-start gap-1 px-1 pb-1",
              allowCompactCardColumns &&
                (compactEntries.length > 1 || showExpandedGhostCard) &&
                "@min-[220px]:grid-cols-2",
              allowCompactCardColumns && compactEntries.length > 2 && "@min-[420px]:grid-cols-3",
              featuredEntries.length === 0 && "pt-1",
            )}
          >
            {compactEntries.map(renderCharacterCard)}
            {showExpandedGhostCard && <div aria-hidden="true" className={EXPANDED_COMPACT_CARD_GHOST_CLASS} />}
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      className="group/characters relative z-10 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_5%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)]"
      aria-label="Characters"
    >
      <SectionHeader
        icon={<Users size="0.6875rem" />}
        title="Present Characters"
        action={action}
        addAction={
          addMode ? (
            <AddRowButton title="Add character" onClick={onAddCharacter} className="h-4 w-4 rounded-sm" />
          ) : undefined
        }
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && renderCharacterCards()}
    </section>
  );
}
