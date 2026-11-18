// ──────────────────────────────────────────────
// "Already in your library": a card being imported that looks like a newer release of a character you have.
// Each card gets one choice: update that character in place (it keeps its chats, memories, gallery, sprites and
// folder; the old card goes to Version history), add it as a new character, or skip it. "Update another
// character…" links a card to any character, for cards that came another way (a site, then SillyTavern).
// Used by the Import Character window, the Card Browser and the editor's "Update from card file…".
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCharacterListRows } from "../../hooks/use-characters";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { PickerField, PickerTileArt } from "../ui/PickerField";
import { Select, type SelectOption } from "../ui/Select";

/** A character the server found for a card (POST /import/st-character/matches, or `matches` from inspect). */
export interface CardUpdateMatch {
  id: string;
  name: string;
  creator: string;
  version: string;
  avatarPath: string | null;
  updatedAt: string;
  /** "browser": downloaded from the same Card Browser page. "name": same name and creator. */
  reason: "browser" | "name";
}

/**
 * Creator's Notes on update: "merge" keeps your notes (custom CSS, the library blurb) and brings in the author's
 * changes before your CSS, "card" takes the card's notes, "mine" keeps yours untouched.
 */
export type CreatorNotesUpdate = "merge" | "card" | "mine";

/**
 * "new" adds the card as a new character, "skip" leaves it out, "pick" waits for a character to be chosen under
 * "Update another character…", anything else is the id of the character to update.
 */
export type CardUpdateDecision = "new" | "skip" | "pick" | string;

/** "Update another character…" is chosen but no character yet: Continue waits. */
export function isCardUpdatePending(decision: CardUpdateDecision | undefined): boolean {
  return decision === "pick";
}

export interface CardUpdateRow {
  key: string;
  /** The card's own name and version, as it would import. */
  name: string;
  version?: string;
  matches: CardUpdateMatch[];
  /** Open with "Update another character…" chosen (the Card Browser's "Update a character you have"). */
  pickOther?: boolean;
}

const OTHER = "__other__";
const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none";

export function defaultCardUpdateDecision(matches: readonly CardUpdateMatch[]): CardUpdateDecision {
  return matches[0]?.id ?? "new";
}

export function isCardUpdate(decision: CardUpdateDecision | undefined): decision is string {
  return !!decision && decision !== "new" && decision !== "skip" && decision !== "pick";
}

export async function findCardUpdateMatches(card: {
  name?: unknown;
  creator?: unknown;
  botBrowserSource?: string;
  /** Only this character, whatever the card is called (its editor's "Update from card file…"). */
  characterId?: string;
}): Promise<CardUpdateMatch[]> {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await api.post<{ matches?: CardUpdateMatch[] }>("/import/st-character/matches", {
    name: text(card.name),
    creator: text(card.creator),
    botBrowserSource: card.botBrowserSource ?? "",
    characterId: card.characterId ?? "",
  });
  return result.matches ?? [];
}

function versionSuffix(version: string | undefined) {
  const trimmed = version?.trim();
  return trimmed ? ` · v${trimmed.replace(/^v/i, "")}` : "";
}

function CardUpdateChoice({
  row,
  value,
  onChange,
  allowNew,
}: {
  row: CardUpdateRow;
  value: CardUpdateDecision;
  onChange: (value: CardUpdateDecision) => void;
  allowNew: boolean;
}) {
  const { t } = useTranslation();
  const matched = row.matches.some((match) => match.id === value);
  const [other, setOther] = useState(() => !!row.pickOther || (isCardUpdate(value) && !matched));
  const otherMode = other || isCardUpdatePending(value) || (isCardUpdate(value) && !matched);
  const { data: characterRows } = useCharacterListRows({ enabled: otherMode });
  const items = useMemo(
    () =>
      (characterRows ?? []).map((character) => ({
        id: character.id,
        label: character.data.name || t("ui.cardUpdate.unnamed"),
        icon: <PickerTileArt src={character.avatarPath} type="characters" icon={User} />,
      })),
    [characterRows, t],
  );
  const selectValue = otherMode ? OTHER : value;
  const reasonText = (match: CardUpdateMatch) =>
    match.reason === "browser" ? t("ui.cardUpdate.reasonBrowser") : t("ui.cardUpdate.reasonName");
  const picked = row.matches.find((match) => match.id === value);

  const options: SelectOption[] = [
    ...row.matches.map((match) => ({
      value: match.id,
      label: t("ui.cardUpdate.update", { name: match.name }) + versionSuffix(match.version),
    })),
    { value: OTHER, label: t("ui.cardUpdate.updateOther") },
    ...(allowNew ? [{ value: "new", label: t("ui.cardUpdate.keepBoth") }] : []),
    { value: "skip", label: allowNew ? t("ui.cardUpdate.skip") : t("ui.cardUpdate.cancelUpdate") },
  ];

  return (
    <div
      className="grid gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/40 px-3 py-2.5 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] sm:items-start sm:gap-3"
      data-card-update-row={row.key}
    >
      <div className="flex min-w-0 flex-col pt-1">
        <span className="truncate text-sm font-medium text-[var(--foreground)]">{row.name}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{versionSuffix(row.version).replace(/^ · /, "")}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Select
          label={t("ui.cardUpdate.choiceFor", { name: row.name })}
          value={selectValue}
          options={options}
          className={FIELD_CLASS}
          onChange={(next) => {
            if (next === OTHER) {
              setOther(true);
              onChange("pick");
              return;
            }
            setOther(false);
            onChange(next);
          }}
        />
        {otherMode ? (
          <PickerField
            value={isCardUpdate(value) ? value : ""}
            items={items}
            ariaLabel={t("ui.cardUpdate.characterToUpdate")}
            missingLabel={t("ui.cardUpdate.chooseCharacter")}
            triggerClassName={FIELD_CLASS}
            onChange={(id) => onChange(id || "pick")}
            searchLabel={t("chat.wizard.select.search")}
            emptyLabel={t("ui.cardUpdate.noCharacters")}
            noMatchesLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
          />
        ) : picked ? (
          <span className="px-1 text-xs text-[var(--muted-foreground)]">{reasonText(picked)}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The choices for every card that may update a character, with the shared "Use the new picture" box. Callers own
 * the buttons (Continue, Back), since each surface already has its own footer.
 */
export function CardUpdateChoices({
  rows,
  decisions,
  onDecisionChange,
  useCardPicture,
  onUseCardPictureChange,
  creatorNotes,
  onCreatorNotesChange,
  allowNew = true,
  notice,
  className,
}: {
  rows: readonly CardUpdateRow[];
  decisions: Readonly<Record<string, CardUpdateDecision>>;
  onDecisionChange: (key: string, decision: CardUpdateDecision) => void;
  useCardPicture: boolean;
  onUseCardPictureChange: (value: boolean) => void;
  creatorNotes: CreatorNotesUpdate;
  onCreatorNotesChange: (value: CreatorNotesUpdate) => void;
  /** False in the editor's "Update from card file…", which only updates. */
  allowNew?: boolean;
  /** A warning above the choices, such as a library check that could not run. */
  notice?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const anyUpdate = rows.some((row) => isCardUpdate(decisions[row.key]));
  return (
    <div className={cn("flex flex-col gap-3", className)} data-component="CardUpdateChoices">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("ui.cardUpdate.intro")}</p>
      {notice ? (
        <p className="text-xs leading-relaxed text-[var(--destructive)]" role="status">
          {notice}
        </p>
      ) : null}
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {rows.map((row) => (
          <CardUpdateChoice
            key={row.key}
            row={row}
            allowNew={allowNew}
            value={decisions[row.key] ?? defaultCardUpdateDecision(row.matches)}
            onChange={(decision) => onDecisionChange(row.key, decision)}
          />
        ))}
      </div>
      <label className={cn("flex items-center gap-2 px-3 text-sm", !anyUpdate && "opacity-50")}>
        <input
          type="checkbox"
          checked={useCardPicture}
          disabled={!anyUpdate}
          onChange={(event) => onUseCardPictureChange(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        {t("ui.cardUpdate.useCardPicture")}
      </label>
      <div
        className={cn(
          "grid gap-1.5 px-3 text-sm sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] sm:items-center sm:gap-3",
          !anyUpdate && "opacity-50",
        )}
      >
        <span>{t("ui.cardUpdate.creatorNotes")}</span>
        <Select
          label={t("ui.cardUpdate.creatorNotes")}
          value={creatorNotes}
          disabled={!anyUpdate}
          className={FIELD_CLASS}
          onChange={onCreatorNotesChange}
          options={[
            { value: "merge", label: t("ui.cardUpdate.notesMerge") },
            { value: "card", label: t("ui.cardUpdate.notesCard") },
            { value: "mine", label: t("ui.cardUpdate.notesMine") },
          ]}
        />
      </div>
    </div>
  );
}
