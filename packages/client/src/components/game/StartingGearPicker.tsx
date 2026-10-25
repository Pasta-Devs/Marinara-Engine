// The inventory's "Starting gear": a ruleset's gear a character may take into their bag at the start
// (Capability API 1.78). Never given on its own: the player picks a gear, an option for each of its
// choices and an item from each list, and takes it. Gear the character's sheet fits is listed first;
// a strict builder step (1.109) keeps other gear for free edit.
//
// What the gear adds is worked out by the shared resolver the server also uses, so what is shown is
// what is added; the server checks it all again.
import { useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  gameInventoryBagKey,
  gameInventoryBearerStatus,
  resolveRulesetStartingGear,
  rulesetStartingGearCoinCount,
  rulesetStartingGearCoins,
  rulesetBuilderStartingGearOptions,
  rulesetStartingGearFits,
  rulesetStartingGearKind,
  rulesetStartingGearTakenBy,
  type GameInventoryStack,
  type RulesetBuilderStep,
  type RulesetDefinition,
  type RulesetItemBook,
  type RulesetItemBookSheets,
  type RulesetLayerOptions,
  type RulesetStartingGear,
  type RulesetStartingGearLine,
  type RulesetStartingGearSelection,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { rulesetItemStatsLine } from "./RulesetItemPicker";
import { GAME_DIALOG_CLASS } from "../../lib/chat-widget-colors";
import type { InventoryBag } from "./GameInventory";

const inputClass =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs text-[var(--foreground)]";
const labelClass = "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";
const chipClass =
  "rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]";

/** The gear each bag has taken, by bag key ("" for the player's own). */
export type StartingGearTaken = Record<string, string[]>;

export function StartingGearPicker({
  open,
  onClose,
  definition,
  layerOptions,
  book,
  bags,
  holder: initialHolder,
  stacks,
  sheets,
  taken,
  onTake,
}: {
  open: boolean;
  onClose: () => void;
  definition: RulesetDefinition;
  /** The game's layers, which may take items and coins out of the gear, as they do on the server. */
  layerOptions?: RulesetLayerOptions | null;
  book: RulesetItemBook;
  /** Whose bags gear may go into, the player's first: the party members with a card. */
  bags: readonly InventoryBag[];
  /** The bag the inventory has open: absent for the player's. */
  holder?: string;
  /** Every stack, for what each bag already weighs. */
  stacks: readonly GameInventoryStack[];
  /** Each character's sheet, for which gear their sheet fits. */
  sheets?: RulesetItemBookSheets;
  taken: StartingGearTaken;
  /** Resolves to whether the gear went into the bag. */
  onTake: (holder: string | undefined, selection: RulesetStartingGearSelection, again: boolean) => Promise<boolean>;
}) {
  const { t } = useUiTranslation();
  const firstRef = useRef<HTMLSelectElement>(null);
  const [freeEdit, setFreeEdit] = useState(false);
  const step = definition.sheet.builder?.steps.find(
    (each): each is Extract<RulesetBuilderStep, { kind: "startingGear" }> =>
      each.kind === "startingGear" && !!each.strict,
  );
  const [holder, setHolder] = useState<string | undefined>(initialHolder);
  const bagKey = gameInventoryBagKey(holder);
  const who = bags.find((bag) => gameInventoryBagKey(bag.holder) === bagKey)?.name ?? bags[0]?.name ?? "";
  const build =
    holder === undefined
      ? sheets?.player
      : sheets?.members?.find((member) => gameInventoryBagKey(member.name) === bagKey)?.build;
  const gear = useMemo(
    () =>
      step
        ? rulesetBuilderStartingGearOptions(definition, step, build, freeEdit)
        : (definition.items?.startingGear ?? []),
    [build, definition, freeEdit, step],
  );
  const fits = useMemo(
    () => new Set(gear.filter((each) => rulesetStartingGearFits(definition, each, build)).map((each) => each.id)),
    [build, definition, gear],
  );
  const takenHere = rulesetStartingGearTakenBy(taken, bagKey);

  const [gearId, setGearId] = useState<string | null>(null);
  const [choices, setChoices] = useState<number[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [again, setAgain] = useState(false);
  const [pending, setPending] = useState(false);
  const [pickCleared, setPickCleared] = useState(false);
  const chosen = gear.find((each) => each.id === gearId);
  // A sheet changed behind the picker, or free edit ended: discard the whole stale selection before
  // it can be taken, so returning to that class never restores a pick the player was told was gone.
  if (step && !freeEdit && gearId !== null && !chosen) {
    setGearId(null);
    setChoices([]);
    setPicks({});
    setAgain(false);
    setPickCleared(true);
  }
  const chooseGear = (next: RulesetStartingGear) => {
    setPickCleared(false);
    setGearId(next.id);
    setChoices(next.choices.map(() => -1));
    setPicks({});
    setAgain(false);
  };
  // The gear this bag took of the chosen one's kind, which taking this as well needs the word for.
  const replaces = chosen
    ? takenHere.find((id) => rulesetStartingGearKind(definition, id) === rulesetStartingGearKind(definition, chosen.id))
    : undefined;
  const replacedLabel = replaces ? (gear.find((each) => each.id === replaces)?.label ?? replaces) : undefined;

  const selection: RulesetStartingGearSelection | null = chosen ? { gear: chosen.id, choices, picks } : null;
  const resolved = useMemo(
    () =>
      selection
        ? resolveRulesetStartingGear(
            definition,
            book,
            selection,
            layerOptions,
            step ? { step, build, freeEdit } : undefined,
            { build },
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book, definition, layerOptions, gearId, choices, picks, step, build, freeEdit],
  );
  // What the gear weighs against what this bag's bearer can still carry, where the ruleset says.
  const status = useMemo(() => gameInventoryBearerStatus(stacks, holder, book), [book, holder, stacks]);
  const weight =
    resolved?.ok === true
      ? resolved.adds.reduce(
          (total, add) => total + (add.item ? (book.itemOf(add.item)?.weight ?? 0) : 0) * add.count,
          0,
        )
      : 0;
  const room = status.limit !== undefined ? status.limit - status.load : undefined;
  const tooHeavy = room !== undefined && weight > room + 1e-9;
  const canTake = resolved?.ok === true && !tooHeavy && (!replaces || again) && !pending;

  // Written as the bag writes a stack: "Handaxe x2".
  const counted = (name: string, count: number) =>
    count > 1 ? t("ui.game.inventoryslot.value1XValue2", { value1: name, value2: count }) : name;
  const lineText = (line: RulesetStartingGearLine): string => {
    if (line.item) return counted(book.itemOf(line.item)?.name ?? line.item, line.count);
    if (line.coins) {
      // In the coin the game pays it in; coins a layer takes out are named as left out instead.
      // Coins rolled or read off the sheet (1.157) are said as such: the amount comes when taken.
      const amount = rulesetStartingGearCoinCount(definition, line, { build });
      const paid = rulesetStartingGearCoins(
        definition,
        { coins: line.coins, count: Math.max(1, amount?.count ?? line.count) },
        layerOptions,
      );
      if (!paid) return "";
      if (line.roll)
        return t("game.ruleset.startingGear.rolledCoins", { dice: amount?.rolled ?? line.roll, coin: paid.label });
      // In the coin it is paid in, and nothing when the sheet's number is 0 (nothing is added then).
      if (line.countFrom) {
        if (!amount) return t("game.ruleset.startingGear.sheetCoins", { coin: paid.label });
        return amount.count > 0 ? `${paid.count} ${paid.label}` : "";
      }
      return `${paid.count} ${paid.label}`;
    }
    if (line.name) return counted(line.name, line.count);
    return "";
  };
  const renderLine = (line: RulesetStartingGearLine, key: string) => {
    if (!line.oneOf) {
      const text = lineText(line);
      if (!text) return null;
      return (
        <li key={key} className="text-[0.6875rem] text-[var(--foreground)]">
          {text}
        </li>
      );
    }
    const options = line.oneOf.flatMap((ref) => {
      const entry = book.entries.find((each) => each.item === ref);
      return entry ? [entry] : [];
    });
    // A list the game's layers took every item of is left out, and named as such.
    if (options.length === 0) return null;
    const picked = options.find((entry) => entry.item === picks[key]);
    const stats = picked ? rulesetItemStatsLine(picked.facts) : "";
    return (
      <li key={key} className="space-y-1">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>
            {line.count > 1
              ? t("game.ruleset.startingGear.pickCount", { count: line.count })
              : t("game.ruleset.startingGear.pickOne")}
          </span>
          <select
            value={picks[key] ?? ""}
            onChange={(event) => setPicks((current) => ({ ...current, [key]: event.target.value }))}
            className={inputClass}
          >
            <option value="" disabled>
              {t("game.ruleset.startingGear.pickPlaceholder")}
            </option>
            {options.map((entry) => (
              <option key={entry.item} value={entry.item}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        {stats && <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">{stats}</span>}
      </li>
    );
  };

  // Gear this sheet fits, gear for anyone (it names nobody), and gear for another kind of character.
  const fitting = gear.filter((each) => fits.has(each.id));
  const anyone = gear.filter((each) => !each.fits);
  const others = gear.filter((each) => each.fits && !fits.has(each.id));
  const renderGear = (each: RulesetStartingGear) => (
    <label
      key={each.id}
      className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
    >
      <input
        type="radio"
        name="starting-gear"
        checked={gearId === each.id}
        onChange={() => chooseGear(each)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--foreground)]">{each.label}</span>
          {takenHere.includes(each.id) && <span className={chipClass}>{t("game.ruleset.startingGear.takenChip")}</span>}
        </span>
        {each.summary && <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">{each.summary}</span>}
      </span>
    </label>
  );

  // Gear for any character follows the gear this sheet fits; with none that fits, it follows the rest.
  const anyoneSection = anyone.length > 0 && (
    <fieldset className="space-y-1.5">
      <legend className={labelClass}>
        {fitting.length > 0 || others.length > 0
          ? t("game.ruleset.startingGear.anyone")
          : t("game.ruleset.startingGear.all")}
      </legend>
      {anyone.map(renderGear)}
    </fieldset>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("game.ruleset.startingGear.title")}
      width="max-w-2xl"
      mobileFullscreen
      panelClassName={GAME_DIALOG_CLASS}
      {...(bags.length > 1 ? { initialFocusRef: firstRef } : {})}
      contentClassName="flex flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("game.ruleset.startingGear.intro")}</p>
        {step && (
          <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
            <input type="checkbox" checked={freeEdit} onChange={(event) => setFreeEdit(event.target.checked)} />
            {t("ui.rulesets.builder.freeEditGear")}
          </label>
        )}
        {pickCleared && (
          <p role="status" className="text-xs text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.pickCleared")}
          </p>
        )}
        {step && !freeEdit && gear.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.noOptions")}</p>
        )}
        {bags.length > 1 && (
          <label className="flex max-w-xs flex-col gap-1">
            <span className={labelClass}>{t("game.ruleset.startingGear.for")}</span>
            <select
              ref={firstRef}
              value={bagKey}
              onChange={(event) => {
                const next = bags.find((bag) => gameInventoryBagKey(bag.holder) === event.target.value);
                setHolder(next?.holder);
                setAgain(false);
              }}
              className={inputClass}
            >
              {bags.map((bag) => (
                <option key={gameInventoryBagKey(bag.holder)} value={gameInventoryBagKey(bag.holder)}>
                  {bag.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {fitting.length > 0 && (
            <fieldset className="space-y-1.5">
              <legend className={labelClass}>{t("game.ruleset.startingGear.fits", { who })}</legend>
              {fitting.map(renderGear)}
            </fieldset>
          )}
          {fitting.length > 0 && anyoneSection}
          {others.length > 0 && (
            <fieldset className="space-y-1.5">
              <legend className={labelClass}>
                {fitting.length > 0 ? t("game.ruleset.startingGear.other") : t("game.ruleset.startingGear.all")}
              </legend>
              {fitting.length > 0 && (
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("game.ruleset.startingGear.otherHint")}
                </p>
              )}
              {others.map(renderGear)}
            </fieldset>
          )}
          {fitting.length === 0 && anyoneSection}

          {chosen && (
            <div className="space-y-3 rounded-lg border border-[var(--border)] p-2">
              {chosen.lines.length > 0 && (
                <div className="space-y-1">
                  <span className={labelClass}>{t("game.ruleset.startingGear.always")}</span>
                  <ul className="space-y-1">{chosen.lines.map((line, index) => renderLine(line, String(index)))}</ul>
                </div>
              )}
              {chosen.choices.map((choice, choiceIndex) => (
                <fieldset key={choiceIndex} className="space-y-1.5">
                  <legend className={labelClass}>{choice.label}</legend>
                  {choice.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="space-y-1">
                      <label className="flex items-start gap-2 text-xs text-[var(--foreground)]">
                        <input
                          type="radio"
                          name={`starting-gear-choice-${choiceIndex}`}
                          checked={choices[choiceIndex] === optionIndex}
                          onChange={() => {
                            setChoices((current) =>
                              current.map((value, index) => (index === choiceIndex ? optionIndex : value)),
                            );
                            // Another option's lists are its own: a pick made for the last one goes.
                            setPicks((current) =>
                              Object.fromEntries(
                                Object.entries(current).filter(([key]) => !key.startsWith(`${choiceIndex}.`)),
                              ),
                            );
                          }}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                        />
                        <span className="min-w-0 flex-1">{option.label}</span>
                      </label>
                      {choices[choiceIndex] === optionIndex && (
                        <ul className="ml-6 space-y-1">
                          {option.lines.map((line, lineIndex) => renderLine(line, `${choiceIndex}.${lineIndex}`))}
                        </ul>
                      )}
                    </div>
                  ))}
                </fieldset>
              ))}
              {resolved?.ok === false && resolved.reason === "empty" && (
                <p className="text-[0.6875rem] text-[var(--destructive)]">{t("game.ruleset.startingGear.empty")}</p>
              )}
              {resolved?.ok === true && resolved.dropped.length > 0 && (
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("game.ruleset.startingGear.dropped", { items: resolved.dropped.join(", ") })}
                </p>
              )}
              {room !== undefined && resolved?.ok === true && (
                <p
                  className={`text-[0.6875rem] ${tooHeavy ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"}`}
                >
                  {t(tooHeavy ? "game.ruleset.startingGear.tooHeavy" : "game.ruleset.startingGear.weight", {
                    who,
                    weight: Math.round(weight * 100) / 100,
                    room: Math.max(0, Math.round(room * 100) / 100),
                  })}
                </p>
              )}
              {replacedLabel && (
                <label className="flex items-start gap-2 text-[0.6875rem] text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={again}
                    onChange={(event) => setAgain(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span>{t("game.ruleset.startingGear.again", { who, gear: replacedLabel })}</span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-2">
          <button type="button" onClick={onClose} className="mari-chrome-control mari-chrome-control--small text-xs">
            {t("game.ruleset.catalog.cancel")}
          </button>
          <button
            type="button"
            disabled={!canTake || !selection}
            onClick={async () => {
              if (!selection) return;
              setPending(true);
              try {
                if (await onTake(holder, selection, again)) onClose();
              } finally {
                setPending(false);
              }
            }}
            className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--small text-xs"
          >
            {t("game.ruleset.startingGear.take", { gear: chosen?.label ?? "" })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
