import {
  characterImportDisplayName,
  TAG_IMPORT_OPTIONS,
  type CharacterImportMode,
  type CharacterImportRow,
  type TagImportMode,
} from "../lib/character-import-model";

type CharacterImportOptionsPanelProps = {
  importMode: CharacterImportMode;
  onImportModeChange: (mode: CharacterImportMode) => void;
  targetCharacterId: string;
  onTargetCharacterIdChange: (characterId: string) => void;
  characters: CharacterImportRow[];
  tagImportMode: TagImportMode;
  onTagImportModeChange: (mode: TagImportMode) => void;
};

export function CharacterImportOptionsPanel({
  importMode,
  onImportModeChange,
  targetCharacterId,
  onTargetCharacterIdChange,
  characters,
  tagImportMode,
  onTagImportModeChange,
}: CharacterImportOptionsPanelProps) {
  return (
    <>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-3">
        <div className="mb-2">
          <p className="text-xs font-semibold text-[var(--foreground)]">Import target</p>
          <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
            Import as a new card, or update one existing character while keeping its chat links.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-[var(--primary)]/40 ${
              importMode === "new"
                ? "border-[var(--primary)] bg-[var(--primary)]/10"
                : "border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--muted-foreground)]"
            }`}
          >
            <input
              type="radio"
              name="characterImportMode"
              value="new"
              checked={importMode === "new"}
              onChange={() => onImportModeChange("new")}
              className="sr-only"
            />
            <span className="block text-xs font-medium text-[var(--foreground)]">New copy</span>
            <span className="mt-1 block text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
              Create separate imported characters.
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-[var(--primary)]/40 ${
              importMode === "update"
                ? "border-[var(--primary)] bg-[var(--primary)]/10"
                : "border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--muted-foreground)]"
            }`}
          >
            <input
              type="radio"
              name="characterImportMode"
              value="update"
              checked={importMode === "update"}
              onChange={() => onImportModeChange("update")}
              className="sr-only"
            />
            <span className="block text-xs font-medium text-[var(--foreground)]">Update existing</span>
            <span className="mt-1 block text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
              Save the current card to version history first.
            </span>
          </label>
        </div>
        {importMode === "update" && (
          <select
            value={targetCharacterId}
            onChange={(event) => onTargetCharacterIdChange(event.target.value)}
            className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="">Choose character to update</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {characterImportDisplayName(character)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground)]">Imported card tags</p>
            <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              Choose how source-site tags are applied to character cards.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {TAG_IMPORT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-[var(--primary)]/40 ${
                tagImportMode === option.value
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--muted-foreground)]"
              }`}
            >
              <input
                type="radio"
                name="tagImportMode"
                value={option.value}
                checked={tagImportMode === option.value}
                onChange={() => onTagImportModeChange(option.value)}
                className="sr-only"
              />
              <span className="block text-xs font-medium text-[var(--foreground)]">{option.label}</span>
              <span className="mt-1 block text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
