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

/** "new" adds the card as a new character, "skip" leaves it out, anything else is the id of the character to update. */
export type CardUpdateDecision = "new" | "skip" | string;

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

export function defaultCardUpdateDecision(matches: readonly CardUpdateMatch[]): CardUpdateDecision {
  return matches[0]?.id ?? "new";
}

export function isCardUpdate(decision: CardUpdateDecision | undefined): decision is string {
  return !!decision && decision !== "new" && decision !== "skip";
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
  const otherMode = other || (isCardUpdate(value) && !matched);
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

  return (
    <div className="ov-cupd__row" data-card-update-row={row.key}>
      <div className="ov-cupd__card">
        <span className="ov-cupd__name">{row.name}</span>
        <span className="ov-cupd__meta">{versionSuffix(row.version).replace(/^ · /, "")}</span>
      </div>
      <div className="ov-cupd__pick">
        <select
          className="ov-select ov-cupd__select"
          aria-label={t("ui.cardUpdate.choiceFor", { name: row.name })}
          value={selectValue}
          onChange={(event) => {
            const next = event.target.value;
            if (next === OTHER) {
              setOther(true);
              onChange("skip");
              return;
            }
            setOther(false);
            onChange(next);
          }}
        >
          {row.matches.map((match) => (
            <option key={match.id} value={match.id}>
              {t("ui.cardUpdate.update", { name: match.name }) + versionSuffix(match.version)}
            </option>
          ))}
          <option value={OTHER}>{t("ui.cardUpdate.updateOther")}</option>
          {allowNew ? <option value="new">{t("ui.cardUpdate.keepBoth")}</option> : null}
          <option value="skip">{allowNew ? t("ui.cardUpdate.skip") : t("ui.cardUpdate.cancelUpdate")}</option>
        </select>
        {otherMode ? (
          <PickerField
            value={isCardUpdate(value) ? value : ""}
            items={items}
            ariaLabel={t("ui.cardUpdate.characterToUpdate")}
            missingLabel={t("ui.cardUpdate.chooseCharacter")}
            triggerClassName="ov-select ov-cupd__other"
            onChange={(id) => onChange(id || "skip")}
            searchLabel={t("chat.wizard.select.search")}
            emptyLabel={t("ui.cardUpdate.noCharacters")}
            noMatchesLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
          />
        ) : picked ? (
          <span className="ov-cupd__why">{reasonText(picked)}</span>
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
  className?: string;
}) {
  const { t } = useTranslation();
  const anyUpdate = rows.some((row) => isCardUpdate(decisions[row.key]));
  return (
    <div className={cn("ov-cupd", className)} data-component="CardUpdateChoices">
      <p className="ov-cupd__intro">{t("ui.cardUpdate.intro")}</p>
      <div className="ov-cupd__rows">
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
      <label className={cn("ov-cupd__picture", !anyUpdate && "is-off")}>
        <input
          type="checkbox"
          checked={useCardPicture}
          disabled={!anyUpdate}
          onChange={(event) => onUseCardPictureChange(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        {t("ui.cardUpdate.useCardPicture")}
      </label>
      <label className={cn("ov-cupd__notes", !anyUpdate && "is-off")}>
        <span>{t("ui.cardUpdate.creatorNotes")}</span>
        <select
          className="ov-select ov-cupd__select"
          value={creatorNotes}
          disabled={!anyUpdate}
          onChange={(event) => onCreatorNotesChange(event.target.value as CreatorNotesUpdate)}
        >
          <option value="merge">{t("ui.cardUpdate.notesMerge")}</option>
          <option value="card">{t("ui.cardUpdate.notesCard")}</option>
          <option value="mine">{t("ui.cardUpdate.notesMine")}</option>
        </select>
      </label>
    </div>
  );
}
