// The Setting kit choice of the Game setup wizard (worldgen W0): none, one of the starter kits, or
// one the model writes for the player's own setting. A kit gives the Game Master the words this
// kind of world uses and the kinds of change it allows. Every word can be changed here before the
// game starts; the game keeps the kit it was created with.
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Download, Sparkles, Upload } from "lucide-react";
import {
  TACTICAL_ENVIRONMENTS,
  TACTICAL_TERRAINS,
  WORLD_CHANGE_KINDS,
  WORLD_DEFAULT_BATTLEFIELDS,
  WORLD_DEFAULT_ELEMENTS,
  WORLD_LOOT_RARITIES,
  WORLD_PACES,
  WORLD_ART_FAMILIES,
  WORLD_SCALES,
  worldKitArtFamily,
  WORLD_STARTER_KITS,
  parseWorldKit,
  worldKitReworded,
  type WorldKit,
  type WorldKitInput,
} from "@marinara-engine/shared";
import {
  readWorldFile,
  readWorldKitFile,
  worldKitFile,
  type ExperienceMapPack,
  type StoryScript,
  type WorldFileWorld,
  type WorldSnapshot,
} from "@marinara-engine/shared";
import { ApiError, api } from "../../lib/api-client";
import { downloadJsonFile } from "../../lib/download-json";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { useWorldLibrary } from "../../hooks/use-world-library";
import { GAME_SETUP_GHOST_BUTTON_CLASS, GAME_SETUP_INPUT_CLASS as INPUT } from "./game-setup-classes";

export interface WorldKitWriteRequest {
  connectionId?: string;
  genre: string;
  setting: string;
  tone: string;
  language?: string;
}

// A lighter label than the wizard's own, since these fields sit inside one choice of the World step.
const FIELD_LABEL = "mb-1 block text-xs text-[var(--muted-foreground)]";

const splitWords = (text: string) =>
  text
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);

/** A whole number of the kit's, typed freely: the field may be empty or partly typed while it is being
 *  edited, and only a whole number of at least `min` is kept; leaving it shows the kept number again. */
function NumberField({
  value,
  min,
  max,
  step,
  label,
  className,
  onChange,
}: {
  value: number;
  min: number;
  /** The largest number kept, and a decimal step for a number that need not be whole. */
  max?: number;
  step?: number;
  label: string;
  className: string;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(String(value));
  }
  return (
    <input
      type="number"
      min={min}
      {...(max !== undefined ? { max } : {})}
      {...(step !== undefined ? { step } : {})}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const next = Number(event.target.value);
        const shaped = step === undefined ? Number.isInteger(next) : Number.isFinite(next);
        if (event.target.value.trim() !== "" && shaped && next >= min && (max === undefined || next <= max)) {
          setShown(next);
          onChange(next);
        }
      }}
      onBlur={() => setText(String(value))}
      aria-label={label}
      className={className}
    />
  );
}

/** A list of the kit's words, typed as one comma-separated line. The line is kept as typed, so a
 *  trailing comma survives the keystroke, and is reset only when the kit changes from outside. */
export function WordsField({
  id,
  label,
  words,
  onChange,
}: {
  id: string;
  label: string;
  words: string[];
  onChange: (words: string[]) => void;
}) {
  const joined = words.join(", ");
  const [text, setText] = useState(joined);
  const [shown, setShown] = useState(joined);
  if (joined !== shown) {
    setShown(joined);
    setText(joined);
  }
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        value={text}
        onChange={(event) => {
          const next = splitWords(event.target.value);
          setText(event.target.value);
          setShown(next.join(", "));
          onChange(next);
        }}
        className={INPUT}
      />
    </div>
  );
}

/** Seconds since a model began writing, while it writes: a kit or a brief can take minutes on some models,
 *  and a count that moves says it is still going. */
export function useWritingSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return seconds;
}

export function GameSetupWorldKitChooser({
  kit,
  onChange,
  onImportWorld,
  writeRequest,
  required = false,
}: {
  kit: WorldKitInput | null;
  onChange: (kit: WorldKitInput | null) => void;
  /** A world file read (worldgen W9d): its kit and world, both taken. */
  onImportWorld: (kit: WorldKit, world: WorldFileWorld, story?: StoryScript, snapshot?: WorldSnapshot) => void;
  /** What the model writes a kit for; null until a connection is chosen. */
  writeRequest: WorldKitWriteRequest | null;
  /** An Overworld RPG game: its world needs a kit, so "no setting kit" is not offered. */
  required?: boolean;
}) {
  const { t } = useUiTranslation();
  const [writing, setWriting] = useState(false);
  const writingSeconds = useWritingSeconds(writing);
  const [writeError, setWriteError] = useState<string | null>(null);
  // Kit and world files (worldgen W9d): what was read, or why it could not be.
  const [fileNote, setFileNote] = useState<{ error: boolean; text: string } | null>(null);
  const kitFileRef = useRef<HTMLInputElement>(null);
  const worldFileRef = useRef<HTMLInputElement>(null);
  // Only the file picked last is read in: an earlier one still reading never replaces it.
  const lastRead = useRef(0);
  const readFile = async (input: HTMLInputElement, kind: "kit" | "world") => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const turn = ++lastRead.current;
    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      // A file removed or locked after it was picked: say so rather than nothing.
      if (turn !== lastRead.current) return;
      return setFileNote({
        error: true,
        text: t("game.worldKit.setup.fileRefused", { reason: error instanceof Error ? error.message : String(error) }),
      });
    }
    if (turn !== lastRead.current) return;
    if (kind === "kit") {
      const read = readWorldKitFile(text);
      if (!read.ok)
        return setFileNote({ error: true, text: t("game.worldKit.setup.fileRefused", { reason: read.issues[0] }) });
      setWriteError(null);
      onChange(structuredClone(read.kit));
      return setFileNote({ error: false, text: t("game.worldKit.setup.kitImported", { name: read.kit.label }) });
    }
    takeWorld(text);
  };
  /** A world file's text, read in: its kit, world, hand edits and story. */
  const takeWorld = (text: string) => {
    const read = readWorldFile(text);
    if (!read.ok)
      return setFileNote({ error: true, text: t("game.worldKit.setup.fileRefused", { reason: read.issues[0] }) });
    setWriteError(null);
    onImportWorld(structuredClone(read.kit), read.world, read.story, read.snapshot);
    setFileNote({
      error: false,
      text: [t("game.worldKit.setup.worldImported", { name: read.name }), ...read.notes.slice(0, 3)].join(" "),
    });
  };
  // Worlds made outside any game (worldgen W9f): one picked comes in as a world file does.
  const library = useWorldLibrary();
  const pickLibraryWorld = async (id: string) => {
    if (!id) return;
    const turn = ++lastRead.current;
    // The kit as it was asked from: picked or edited meanwhile, the player's choice stands.
    const asked = latest.current;
    const current = () => turn === lastRead.current && latest.current === asked;
    try {
      const file = await api.get<unknown>(`/game-worlds/${encodeURIComponent(id)}/world/file`);
      if (current()) takeWorld(JSON.stringify(file));
    } catch (error) {
      if (current()) {
        setFileNote({
          error: true,
          text: t("game.worldKit.setup.fileRefused", {
            reason: error instanceof Error ? error.message : String(error),
          }),
        });
      }
    }
  };
  const checked = kit ? parseWorldKit(kit) : null;
  // The family its art and music come from: its own, or a kit saved before families its starter's.
  const family = worldKitArtFamily(kit);
  // The kit as last drawn, so a write that comes back late lands only on the kit it was asked for:
  // picking another kit, or changing a word, while it was out keeps what the player did.
  const latest = useRef(kit);
  latest.current = kit;
  // The kit as it came in (picked, written or imported), which retyped words are read against, so a
  // word's id depends only on that kit and the words now typed, never on the keystrokes in between.
  const base = useRef(kit);
  const lastEdit = useRef<WorldKitInput | null>(null);
  if (kit !== lastEdit.current && kit !== base.current) base.current = kit;
  const from = <K extends "layers" | "sizes" | "groupKinds" | "placeTags" | "travel">(key: K) =>
    (base.current?.[key] ?? []) as NonNullable<WorldKitInput[K]>;

  const cardClass = (selected: boolean) =>
    cn(
      "flex w-full flex-col justify-start rounded-lg p-3 text-left text-xs transition-colors ring-1",
      selected
        ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
        : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
    );
  // Choosing the kit already chosen keeps it as it is: a second click must not throw away edits.
  const choose = (next: WorldKitInput | null) => {
    if ((kit?.id ?? null) === (next?.id ?? null)) return;
    setWriteError(null);
    onChange(next ? structuredClone(next) : null);
  };
  const edit = (change: (draft: WorldKitInput) => void) => {
    if (!kit) return;
    const draft = structuredClone(kit);
    change(draft);
    lastEdit.current = draft;
    onChange(draft);
  };
  const settlementsIndex = Math.max(0, kit?.layers.findIndex((layer) => layer.settlements) ?? 0);

  const write = async () => {
    if (!writeRequest || writing) return;
    setWriting(true);
    setWriteError(null);
    try {
      const asked = kit;
      const start = kit ? parseWorldKit(kit) : null;
      const { kit: written } = await api.post<{ kit: WorldKit }>("/game/world-kit", {
        ...writeRequest,
        ...(start?.ok ? { start: start.kit } : {}),
        debugMode: useUIStore.getState().debugMode,
      });
      if (latest.current === asked) onChange(written);
    } catch (error) {
      const reasons =
        error instanceof ApiError &&
        error.payload &&
        typeof error.payload === "object" &&
        Array.isArray((error.payload as { issues?: unknown }).issues)
          ? ((error.payload as { issues: unknown[] }).issues.filter((issue) => typeof issue === "string") as string[])
          : [];
      setWriteError(
        [error instanceof Error ? error.message : t("game.worldKit.setup.writeFailed"), ...reasons.slice(0, 3)].join(
          " ",
        ),
      );
    } finally {
      setWriting(false);
    }
  };

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t("game.worldKit.setup.label")}</span>
      <p className="mb-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
        {t(required ? "game.worldKit.setup.helpOverworld" : "game.worldKit.setup.help")}
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => kitFileRef.current?.click()}
          className={cn(GAME_SETUP_GHOST_BUTTON_CLASS, "gap-2 ring-1 ring-[var(--border)]")}
        >
          <Upload size={13} />
          {t("game.worldKit.setup.importKit")}
        </button>
        <button
          type="button"
          onClick={() => worldFileRef.current?.click()}
          className={cn(GAME_SETUP_GHOST_BUTTON_CLASS, "gap-2 ring-1 ring-[var(--border)]")}
        >
          <Upload size={13} />
          {t("game.worldKit.setup.importWorld")}
        </button>
        <button
          type="button"
          disabled={!checked?.ok}
          onClick={() =>
            checked?.ok &&
            downloadJsonFile(worldKitFile(checked.kit), `${checked.kit.label.replace(/[^\w.-]+/g, "_")}.worldkit.json`)
          }
          className={cn(
            GAME_SETUP_GHOST_BUTTON_CLASS,
            "gap-2 ring-1 ring-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Download size={13} />
          {t("game.worldKit.setup.downloadKit")}
        </button>
        {library.data?.length ? (
          <select
            aria-label={t("game.worldKit.setup.libraryWorld")}
            value=""
            onChange={(event) => void pickLibraryWorld(event.target.value)}
            className={cn(INPUT, "w-auto")}
          >
            <option value="">{t("game.worldKit.setup.libraryWorldPick")}</option>
            {library.data.map((world) => (
              <option key={world.id} value={world.id}>
                {world.kit
                  ? t("game.worldKit.setup.libraryWorldOption", { name: world.name, kit: world.kit })
                  : world.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          ref={kitFileRef}
          type="file"
          accept=".json,application/json"
          aria-label={t("game.worldKit.setup.importKit")}
          className="hidden"
          onChange={(event) => void readFile(event.currentTarget, "kit")}
        />
        <input
          ref={worldFileRef}
          type="file"
          accept=".json,application/json"
          aria-label={t("game.worldKit.setup.importWorld")}
          className="hidden"
          onChange={(event) => void readFile(event.currentTarget, "world")}
        />
      </div>
      {fileNote && (
        <p
          role={fileNote.error ? "alert" : "status"}
          className={cn(
            "mb-2 text-xs",
            fileNote.error ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]",
          )}
        >
          {fileNote.text}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {!required && (
          <button type="button" onClick={() => choose(null)} aria-pressed={!kit} className={cardClass(!kit)}>
            <span className="block font-medium text-[var(--foreground)]">{t("game.worldKit.setup.none")}</span>
            <span className="mt-1 block text-[var(--muted-foreground)]">
              {t("game.worldKit.setup.noneDescription")}
            </span>
          </button>
        )}
        {WORLD_STARTER_KITS.map((starter) => {
          const selected = kit?.id === starter.id;
          return (
            <button
              key={starter.id}
              type="button"
              onClick={() => choose(starter)}
              aria-pressed={selected}
              className={cardClass(selected)}
            >
              <span className="block font-medium text-[var(--foreground)]">{starter.label}</span>
              <span className="mt-1 line-clamp-3 block text-[var(--muted-foreground)]">{starter.summary}</span>
            </button>
          );
        })}
      </div>

      {kit && (
        <div className="mt-2 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => void write()}
              disabled={!writeRequest || writing}
              className={cn(
                GAME_SETUP_GHOST_BUTTON_CLASS,
                "gap-2 ring-1 ring-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Sparkles size={13} />
              {writing
                ? t("game.worldKit.setup.writingFor", { seconds: writingSeconds })
                : t("game.worldKit.setup.write")}
            </button>
            <p className="text-[var(--muted-foreground)]">
              {writing
                ? t("game.world.setup.writingSlow")
                : writeRequest
                  ? t("game.worldKit.setup.writeHelp")
                  : t("game.worldKit.setup.writeNeedsConnection")}
            </p>
            {writeError && (
              <p role="alert" className="text-[var(--destructive)]">
                {writeError}
              </p>
            )}
          </div>

          <details>
            <summary className="cursor-pointer py-1 text-xs font-medium text-[var(--foreground)]">
              {t("game.worldKit.setup.editWords")}
            </summary>
            <div className="mt-2 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="world-kit-label" className={FIELD_LABEL}>
                    {t("game.worldKit.setup.name")}
                  </label>
                  <input
                    id="world-kit-label"
                    value={kit.label}
                    onChange={(event) => edit((draft) => (draft.label = event.target.value))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="world-kit-scale" className={FIELD_LABEL}>
                    {t("game.worldKit.setup.scale")}
                  </label>
                  <select
                    id="world-kit-scale"
                    value={kit.scale}
                    onChange={(event) => edit((draft) => (draft.scale = event.target.value as WorldKit["scale"]))}
                    className={INPUT}
                  >
                    {WORLD_SCALES.map((scale) => (
                      <option key={scale} value={scale}>
                        {t(`game.worldKit.setup.scales.${scale}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="world-kit-summary" className={FIELD_LABEL}>
                  {t("game.worldKit.setup.summary")}
                </label>
                <textarea
                  id="world-kit-summary"
                  value={kit.summary}
                  rows={2}
                  onChange={(event) => edit((draft) => (draft.summary = event.target.value))}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="world-kit-family" className={FIELD_LABEL}>
                  {t("game.worldKit.setup.family")}
                </label>
                <select
                  id="world-kit-family"
                  value={family ?? ""}
                  onChange={(event) =>
                    edit((draft) => {
                      if (event.target.value) draft.family = event.target.value;
                      else delete draft.family;
                    })
                  }
                  className={INPUT}
                >
                  {!family && <option value="">{t("game.worldKit.setup.families.none")}</option>}
                  {[...WORLD_ART_FAMILIES, ...(!family || WORLD_ART_FAMILIES.includes(family) ? [] : [family])].map(
                    (each) => (
                      <option key={each} value={each}>
                        {WORLD_ART_FAMILIES.includes(each) ? t(`game.worldKit.setup.families.${each}`) : each}
                      </option>
                    ),
                  )}
                </select>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {family ? t("game.worldKit.setup.familyHelp", { family }) : t("game.worldKit.setup.familyNoneHelp")}
                </p>
              </div>

              <WordsField
                id="world-kit-layers"
                label={t("game.worldKit.setup.layers")}
                words={kit.layers.map((layer) => layer.label)}
                onChange={(words) =>
                  edit((draft) => {
                    // The settlements stay with the layer of that name while it is still in the list,
                    // and otherwise with the layer at the same place in it.
                    const named = words.indexOf(kit.layers[settlementsIndex]?.label ?? "");
                    const settled = named >= 0 ? named : Math.min(settlementsIndex, words.length - 1);
                    draft.layers = worldKitReworded(from("layers"), words).map(
                      ({ settlements: _was, ...entry }: { id: string; label: string; settlements?: true }, index) =>
                        index === settled ? { ...entry, settlements: true as const } : entry,
                    );
                  })
                }
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="world-kit-settlements" className={FIELD_LABEL}>
                    {t("game.worldKit.setup.settlements")}
                  </label>
                  <select
                    id="world-kit-settlements"
                    value={settlementsIndex}
                    onChange={(event) =>
                      edit((draft) => {
                        const chosen = Number(event.target.value);
                        draft.layers = draft.layers.map(({ settlements: _was, ...layer }, index) =>
                          index === chosen ? { ...layer, settlements: true } : layer,
                        );
                      })
                    }
                    className={INPUT}
                  >
                    {kit.layers.map((layer, index) => (
                      <option key={`${layer.id}-${index}`} value={index}>
                        {layer.label}
                      </option>
                    ))}
                  </select>
                </div>
                <WordsField
                  id="world-kit-sizes"
                  label={t("game.worldKit.setup.sizes")}
                  words={kit.sizes.map((size) => size.label)}
                  onChange={(words) => edit((draft) => (draft.sizes = worldKitReworded(from("sizes"), words)))}
                />
              </div>
              <WordsField
                id="world-kit-groups"
                label={t("game.worldKit.setup.groups")}
                words={kit.groupKinds.map((group) => group.label)}
                onChange={(words) => edit((draft) => (draft.groupKinds = worldKitReworded(from("groupKinds"), words)))}
              />
              <WordsField
                id="world-kit-tags"
                label={t("game.worldKit.setup.placeTags")}
                words={(kit.placeTags ?? []).map((tag) => tag.label)}
                onChange={(words) => edit((draft) => (draft.placeTags = worldKitReworded(from("placeTags"), words)))}
              />
              <WordsField
                id="world-kit-travel"
                label={t("game.worldKit.setup.travel")}
                words={kit.travel.map((way) => way.label)}
                onChange={(words) => edit((draft) => (draft.travel = worldKitReworded(from("travel"), words)))}
              />

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label htmlFor="world-kit-year" className={FIELD_LABEL}>
                    {t("game.worldKit.setup.year")}
                  </label>
                  <input
                    id="world-kit-year"
                    value={kit.calendar.year}
                    onChange={(event) => edit((draft) => (draft.calendar.year = event.target.value))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="world-kit-day" className={FIELD_LABEL}>
                    {t("game.worldKit.setup.day")}
                  </label>
                  <input
                    id="world-kit-day"
                    value={kit.calendar.day}
                    onChange={(event) => edit((draft) => (draft.calendar.day = event.target.value))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="world-kit-era" className={FIELD_LABEL}>
                    {t("game.worldKit.setup.era")}
                  </label>
                  <input
                    id="world-kit-era"
                    value={kit.calendar.era ?? ""}
                    onChange={(event) =>
                      edit((draft) => {
                        if (event.target.value) draft.calendar.era = event.target.value;
                        else delete draft.calendar.era;
                      })
                    }
                    className={INPUT}
                  />
                </div>
              </div>
              <WordsField
                id="world-kit-months"
                label={t("game.worldKit.setup.months")}
                words={kit.calendar.months ?? []}
                onChange={(words) =>
                  edit((draft) => {
                    if (words.length) draft.calendar.months = words;
                    else delete draft.calendar.months;
                  })
                }
              />

              <fieldset className="space-y-1.5">
                <legend className={FIELD_LABEL}>{t("game.worldKit.setup.change")}</legend>
                <p className="text-[var(--muted-foreground)]">{t("game.worldKit.setup.changeHelp")}</p>
                {WORLD_CHANGE_KINDS.map((kind) => (
                  <div key={kind} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`world-kit-change-${kind}`}
                      checked={kit.change.kinds[kind].on}
                      onChange={(event) => edit((draft) => (draft.change.kinds[kind].on = event.target.checked))}
                      aria-label={t(`game.worldKit.setup.kinds.${kind}`)}
                      className="size-4 shrink-0 accent-[var(--primary)]"
                    />
                    <label
                      htmlFor={`world-kit-change-${kind}`}
                      className="w-24 shrink-0 text-[var(--muted-foreground)]"
                    >
                      {t(`game.worldKit.setup.kinds.${kind}`)}
                    </label>
                    <input
                      value={kit.change.kinds[kind].label}
                      onChange={(event) => edit((draft) => (draft.change.kinds[kind].label = event.target.value))}
                      aria-label={t("game.worldKit.setup.kindWords", { kind: t(`game.worldKit.setup.kinds.${kind}`) })}
                      className={cn(INPUT, !kit.change.kinds[kind].on && "opacity-60")}
                    />
                  </div>
                ))}
                <div>
                  <label htmlFor="world-kit-pace" className={FIELD_LABEL}>
                    {t("game.worldKit.setup.pace")}
                  </label>
                  <select
                    id="world-kit-pace"
                    value={kit.change.pace}
                    onChange={(event) =>
                      edit((draft) => (draft.change.pace = event.target.value as WorldKit["change"]["pace"]))
                    }
                    className={INPUT}
                  >
                    {WORLD_PACES.map((pace) => (
                      <option key={pace} value={pace}>
                        {t(`game.worldKit.setup.paces.${pace}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>

              <fieldset className="space-y-1.5">
                <legend className={FIELD_LABEL}>{t("game.worldKit.setup.loot")}</legend>
                <p className="text-[var(--muted-foreground)]">{t("game.worldKit.setup.lootHelp")}</p>
                {WORLD_LOOT_RARITIES.map((rarity) => (
                  <WordsField
                    key={rarity}
                    id={`world-kit-loot-${rarity}`}
                    label={t(`game.worldKit.setup.rarities.${rarity}`)}
                    words={kit.loot?.[rarity] ?? []}
                    onChange={(words) =>
                      edit((draft) => {
                        const loot = {
                          common: [],
                          uncommon: [],
                          rare: [],
                          epic: [],
                          legendary: [],
                          ...draft.loot,
                          [rarity]: words,
                        };
                        // With every list empty, the game drops what its genre usually has.
                        if (Object.values(loot).some((each) => each.length > 0)) draft.loot = loot;
                        else delete draft.loot;
                      })
                    }
                  />
                ))}
              </fieldset>

              <fieldset className="space-y-1.5">
                <legend className={FIELD_LABEL}>{t("game.worldKit.setup.elements")}</legend>
                <p className="text-[var(--muted-foreground)]">{t("game.worldKit.setup.elementsHelp")}</p>
                {kit.elements === undefined ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[var(--muted-foreground)]">{t("game.worldKit.setup.elementsClassic")}</span>
                    <button
                      type="button"
                      onClick={() =>
                        edit((draft) => {
                          // The classic six as this kit's own words, to change; their reactions come too,
                          // as the extra damage they deal.
                          const classic = WORLD_DEFAULT_ELEMENTS;
                          const labelOf = (id: string) => classic.elements.find((each) => each.id === id)!.label;
                          draft.elements = classic.elements.map((element) => ({
                            label: element.label,
                            emoji: element.emoji,
                            color: element.color,
                            ...(element.weather ? { weather: element.weather } : {}),
                            beats: (classic.beats[element.id] ?? []).map(labelOf),
                          }));
                          draft.reactions = classic.reactions.map((reaction) => ({
                            on: labelOf(reaction.trigger),
                            with: labelOf(reaction.appliedWith),
                            label: reaction.reaction,
                            times: reaction.damageMultiplier,
                            note: reaction.description,
                          }));
                        })
                      }
                      className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                    >
                      {t("game.worldKit.setup.elementsChange")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        edit((draft) => {
                          draft.elements = [];
                          delete draft.reactions;
                        })
                      }
                      className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                    >
                      {t("game.worldKit.setup.elementsNone")}
                    </button>
                  </div>
                ) : (
                  <>
                    {kit.elements.length === 0 && (
                      <p className="text-[var(--muted-foreground)]">{t("game.worldKit.setup.elementsEmpty")}</p>
                    )}
                    {kit.elements.map((element, index) => (
                      <div key={`element-${index}`} className="flex flex-wrap items-center gap-2">
                        <input
                          value={element.label}
                          onChange={(event) =>
                            edit((draft) => {
                              // A renamed element is renamed wherever the kit names it: in what beats it
                              // and in its reactions, a keystroke at a time.
                              const was = draft.elements![index]!.label.trim().toLowerCase();
                              const now = event.target.value;
                              draft.elements![index]!.label = now;
                              if (!was) return;
                              const same = (word: string) => word.trim().toLowerCase() === was;
                              for (const each of draft.elements!) {
                                if (each.beats) each.beats = each.beats.map((word) => (same(word) ? now : word));
                              }
                              for (const reaction of draft.reactions ?? []) {
                                if (same(reaction.on)) reaction.on = now;
                                if (same(reaction.with)) reaction.with = now;
                              }
                            })
                          }
                          aria-label={t("game.worldKit.setup.elementName")}
                          className={cn(INPUT, "min-w-32 flex-1")}
                        />
                        <input
                          value={element.emoji ?? ""}
                          onChange={(event) =>
                            edit((draft) => {
                              if (event.target.value.trim()) draft.elements![index]!.emoji = event.target.value.trim();
                              else delete draft.elements![index]!.emoji;
                            })
                          }
                          aria-label={t("game.worldKit.setup.elementSign", { name: element.label })}
                          className={cn(INPUT, "w-14 shrink-0 text-center")}
                        />
                        <input
                          type="color"
                          value={element.color ?? "#888888"}
                          onChange={(event) => edit((draft) => (draft.elements![index]!.color = event.target.value))}
                          aria-label={t("game.worldKit.setup.elementColor", { name: element.label })}
                          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                        />
                        <select
                          value={element.weather ?? ""}
                          onChange={(event) =>
                            edit((draft) => {
                              const value = event.target.value;
                              if (value === "hot" || value === "charged") draft.elements![index]!.weather = value;
                              else delete draft.elements![index]!.weather;
                            })
                          }
                          aria-label={t("game.worldKit.setup.elementWeather", { name: element.label })}
                          className={cn(INPUT, "w-auto shrink-0")}
                        >
                          <option value="">{t("game.worldKit.setup.elementWeathers.none")}</option>
                          <option value="hot">{t("game.worldKit.setup.elementWeathers.hot")}</option>
                          <option value="charged">{t("game.worldKit.setup.elementWeathers.charged")}</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            edit((draft) => {
                              const gone = draft.elements![index]!.label.trim().toLowerCase();
                              draft.elements!.splice(index, 1);
                              // What named it goes with it, so the kit still holds together.
                              for (const each of draft.elements!) {
                                if (each.beats)
                                  each.beats = each.beats.filter((word) => word.trim().toLowerCase() !== gone);
                              }
                              if (draft.reactions) {
                                draft.reactions = draft.reactions.filter(
                                  (reaction) =>
                                    reaction.on.trim().toLowerCase() !== gone &&
                                    reaction.with.trim().toLowerCase() !== gone,
                                );
                              }
                            })
                          }
                          className="shrink-0 rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                        >
                          {t("game.worldKit.setup.removeElement")}
                        </button>
                        <div className="basis-full">
                          <WordsField
                            id={`world-kit-element-beats-${index}`}
                            label={t("game.worldKit.setup.elementBeats", { name: element.label })}
                            words={element.beats ?? []}
                            onChange={(words) =>
                              edit((draft) => {
                                if (words.length) draft.elements![index]!.beats = words;
                                else delete draft.elements![index]!.beats;
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                    {kit.elements.length < 12 && (
                      <button
                        type="button"
                        onClick={() => edit((draft) => draft.elements!.push({ label: "" }))}
                        className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                      >
                        {t("game.worldKit.setup.addElement")}
                      </button>
                    )}
                    {(kit.reactions ?? []).map((reaction, index) => (
                      <div key={`reaction-${index}`} className="flex flex-wrap items-center gap-2">
                        <input
                          value={reaction.label}
                          onChange={(event) => edit((draft) => (draft.reactions![index]!.label = event.target.value))}
                          aria-label={t("game.worldKit.setup.reactionName")}
                          className={cn(INPUT, "min-w-32 flex-1")}
                        />
                        {(["on", "with"] as const).map((key) => (
                          <select
                            key={key}
                            value={reaction[key]}
                            onChange={(event) => edit((draft) => (draft.reactions![index]![key] = event.target.value))}
                            aria-label={t(`game.worldKit.setup.reaction${key === "on" ? "On" : "With"}`, {
                              name: reaction.label,
                            })}
                            className={cn(INPUT, "w-auto shrink-0")}
                          >
                            {kit.elements!.map((element, at) => (
                              <option key={`${element.label}-${at}`} value={element.label}>
                                {element.label}
                              </option>
                            ))}
                          </select>
                        ))}
                        <NumberField
                          value={reaction.times}
                          min={0.1}
                          max={5}
                          step={0.1}
                          onChange={(value) => edit((draft) => (draft.reactions![index]!.times = value))}
                          label={t("game.worldKit.setup.reactionTimes", { name: reaction.label })}
                          className={cn(INPUT, "w-20 shrink-0")}
                        />
                        <button
                          type="button"
                          onClick={() => edit((draft) => draft.reactions!.splice(index, 1))}
                          className="shrink-0 rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                        >
                          {t("game.worldKit.setup.removeReaction")}
                        </button>
                      </div>
                    ))}
                    {kit.elements.length >= 2 && (kit.reactions?.length ?? 0) < 24 && (
                      <button
                        type="button"
                        onClick={() =>
                          edit((draft) => {
                            const [first, second] = draft.elements!;
                            draft.reactions = [
                              ...(draft.reactions ?? []),
                              { on: first!.label, with: second!.label, label: "", times: 1.5 },
                            ];
                          })
                        }
                        className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                      >
                        {t("game.worldKit.setup.addReaction")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        edit((draft) => {
                          delete draft.elements;
                          delete draft.reactions;
                        })
                      }
                      className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                    >
                      {t("game.worldKit.setup.elementsBackToClassic")}
                    </button>
                  </>
                )}
              </fieldset>

              <fieldset className="space-y-1.5">
                <legend className={FIELD_LABEL}>{t("game.worldKit.setup.scenes")}</legend>
                <p className="text-[var(--muted-foreground)]">{t("game.worldKit.setup.scenesHelp")}</p>
                {kit.scenes === undefined ? (
                  <button
                    type="button"
                    onClick={() =>
                      edit((draft) => {
                        draft.scenes = WORLD_DEFAULT_BATTLEFIELDS.scenes.map((scene) => ({ ...scene }));
                      })
                    }
                    className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                  >
                    {t("game.worldKit.setup.scenesOwn")}
                  </button>
                ) : (
                  <>
                    {kit.scenes.map((scene, index) => (
                      <div key={`scene-${index}`} className="flex flex-wrap items-center gap-2">
                        <input
                          value={scene.label}
                          onChange={(event) => edit((draft) => (draft.scenes![index]!.label = event.target.value))}
                          aria-label={t("game.worldKit.setup.sceneName")}
                          className={cn(INPUT, "min-w-32 flex-1")}
                        />
                        <select
                          value={scene.like}
                          onChange={(event) =>
                            edit(
                              (draft) =>
                                (draft.scenes![index]!.like = event.target
                                  .value as (typeof TACTICAL_ENVIRONMENTS)[number]),
                            )
                          }
                          aria-label={t("game.worldKit.setup.sceneLike", { name: scene.label })}
                          className={cn(INPUT, "w-auto shrink-0")}
                        >
                          {TACTICAL_ENVIRONMENTS.map((like) => (
                            <option key={like} value={like}>
                              {t(`game.worldKit.setup.battlefields.${like}`)}
                            </option>
                          ))}
                        </select>
                        {kit.scenes!.length > 1 && (
                          <button
                            type="button"
                            onClick={() => edit((draft) => draft.scenes!.splice(index, 1))}
                            className="shrink-0 rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                          >
                            {t("game.worldKit.setup.removeScene")}
                          </button>
                        )}
                      </div>
                    ))}
                    {kit.scenes.length < 24 && (
                      <button
                        type="button"
                        onClick={() => edit((draft) => draft.scenes!.push({ label: "", like: "plains" }))}
                        className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                      >
                        {t("game.worldKit.setup.addScene")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => edit((draft) => delete draft.scenes)}
                      className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                    >
                      {t("game.worldKit.setup.scenesBack")}
                    </button>
                  </>
                )}
                <div className="grid gap-2 sm:grid-cols-3">
                  {TACTICAL_TERRAINS.map((terrain) => (
                    <div key={terrain}>
                      <label htmlFor={`world-kit-tile-${terrain}`} className={FIELD_LABEL}>
                        {t(`game.worldKit.setup.tiles.${terrain}`)}
                      </label>
                      <input
                        id={`world-kit-tile-${terrain}`}
                        value={kit.tiles?.[terrain] ?? ""}
                        placeholder={WORLD_DEFAULT_BATTLEFIELDS.tiles[terrain]}
                        onChange={(event) =>
                          edit((draft) => {
                            const tiles = { ...draft.tiles };
                            if (event.target.value.trim()) tiles[terrain] = event.target.value;
                            else delete tiles[terrain];
                            if (Object.keys(tiles).length) draft.tiles = tiles;
                            else delete draft.tiles;
                          })
                        }
                        className={INPUT}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-1.5">
                <legend className={FIELD_LABEL}>{t("game.worldKit.setup.money")}</legend>
                <p className="text-[var(--muted-foreground)]">{t("game.worldKit.setup.moneyHelp")}</p>
                {kit.money ? (
                  <>
                    <input
                      value={kit.money.label}
                      onChange={(event) => edit((draft) => (draft.money!.label = event.target.value))}
                      aria-label={t("game.worldKit.setup.moneyName")}
                      className={INPUT}
                    />
                    {kit.money.units.map((unit, index) => (
                      <div key={`coin-${index}`} className="flex items-center gap-2">
                        <input
                          value={unit.label}
                          onChange={(event) => edit((draft) => (draft.money!.units[index]!.label = event.target.value))}
                          aria-label={t("game.worldKit.setup.coinName")}
                          className={INPUT}
                        />
                        <NumberField
                          value={unit.value}
                          min={1}
                          max={1_000_000}
                          onChange={(value) => edit((draft) => (draft.money!.units[index]!.value = value))}
                          label={t("game.worldKit.setup.coinWorth", { coin: unit.label })}
                          className={cn(INPUT, "w-28 shrink-0")}
                        />
                        {kit.money!.units.length > 1 && (
                          <button
                            type="button"
                            onClick={() => edit((draft) => draft.money!.units.splice(index, 1))}
                            className="shrink-0 rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                          >
                            {t("game.worldKit.setup.removeCoin")}
                          </button>
                        )}
                      </div>
                    ))}
                    {kit.money.units.length < 6 && (
                      <button
                        type="button"
                        onClick={() => edit((draft) => draft.money!.units.push({ label: "", value: 1 }))}
                        className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                      >
                        {t("game.worldKit.setup.addCoin")}
                      </button>
                    )}
                    {(kit.shop ?? []).map((thing, index) => (
                      <div key={`shop-${index}`} className="flex flex-wrap items-center gap-2">
                        <input
                          value={thing.name}
                          onChange={(event) => edit((draft) => (draft.shop![index]!.name = event.target.value))}
                          aria-label={t("game.worldKit.setup.shopName")}
                          className={cn(INPUT, "min-w-40 flex-1")}
                        />
                        <NumberField
                          value={thing.price}
                          min={0}
                          max={1_000_000_000}
                          onChange={(value) => edit((draft) => (draft.shop![index]!.price = value))}
                          label={t("game.worldKit.setup.shopPrice", { name: thing.name })}
                          className={cn(INPUT, "w-28 shrink-0")}
                        />
                        <select
                          value={Math.min(thing.from ?? 0, kit.sizes.length - 1)}
                          onChange={(event) => edit((draft) => (draft.shop![index]!.from = Number(event.target.value)))}
                          aria-label={t("game.worldKit.setup.shopFrom", { name: thing.name })}
                          className={cn(INPUT, "w-auto shrink-0")}
                        >
                          {kit.sizes.map((size, rank) => (
                            <option key={`${size.id}-${rank}`} value={rank}>
                              {size.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex shrink-0 items-center gap-1 text-[var(--muted-foreground)]">
                          <input
                            type="checkbox"
                            checked={thing.service === true}
                            onChange={(event) =>
                              edit((draft) => {
                                if (event.target.checked) draft.shop![index]!.service = true;
                                else delete draft.shop![index]!.service;
                              })
                            }
                            className="size-4 accent-[var(--primary)]"
                          />
                          {t("game.worldKit.setup.shopService")}
                        </label>
                        <button
                          type="button"
                          onClick={() => edit((draft) => draft.shop!.splice(index, 1))}
                          className="shrink-0 rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                        >
                          {t("game.worldKit.setup.removeShop")}
                        </button>
                      </div>
                    ))}
                    {(kit.shop?.length ?? 0) < 60 && (
                      <button
                        type="button"
                        onClick={() =>
                          edit((draft) => (draft.shop = [...(draft.shop ?? []), { name: "", price: 1, from: 0 }]))
                        }
                        className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                      >
                        {t("game.worldKit.setup.addShop")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        edit((draft) => {
                          delete draft.money;
                          delete draft.shop;
                        })
                      }
                      className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                    >
                      {t("game.worldKit.setup.noMoney")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => edit((draft) => (draft.money = { label: "", units: [{ label: "", value: 1 }] }))}
                    className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                  >
                    {t("game.worldKit.setup.addMoney")}
                  </button>
                )}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className={FIELD_LABEL}>{t("game.worldKit.setup.cultures")}</legend>
                {kit.cultures.map((culture, index) => (
                  <div
                    key={`${culture.id}-${index}`}
                    className="space-y-1 rounded-md border border-[var(--border)] p-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={culture.label}
                        onChange={(event) => edit((draft) => (draft.cultures[index]!.label = event.target.value))}
                        aria-label={t("game.worldKit.setup.cultureName")}
                        className={INPUT}
                      />
                      {kit.cultures.length > 1 && (
                        <button
                          type="button"
                          onClick={() => edit((draft) => draft.cultures.splice(index, 1))}
                          className="shrink-0 rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                        >
                          {t("game.worldKit.setup.removeCulture")}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={culture.naming}
                      rows={2}
                      onChange={(event) => edit((draft) => (draft.cultures[index]!.naming = event.target.value))}
                      aria-label={t("game.worldKit.setup.cultureNaming")}
                      className={INPUT}
                    />
                  </div>
                ))}
                {kit.cultures.length < 12 && (
                  <button
                    type="button"
                    onClick={() =>
                      edit((draft) => {
                        const ids = new Set(draft.cultures.map((culture) => culture.id));
                        let n = draft.cultures.length + 1;
                        while (ids.has(`culture_${n}`)) n++;
                        draft.cultures.push({ id: `culture_${n}`, label: "", naming: "" });
                      })
                    }
                    className="rounded-md px-2 py-1 text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                  >
                    {t("game.worldKit.setup.addCulture")}
                  </button>
                )}
              </fieldset>
            </div>
          </details>
          {checked && !checked.ok && (
            <div role="status" className="text-[var(--destructive)]">
              <span className="block">{t("game.worldKit.setup.invalid")}</span>
              {checked.issues.slice(0, 5).map((issue) => (
                <span key={issue} className="block">
                  {issue}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The kit, and the maps when it ships any, an Experience's map pack (worldgen W9e) sets while the
 *  Experience is on: shown, not chosen. One of its maps is picked here. */
export function MapPackLock({
  name,
  pack,
  error,
  worldPath,
  onPickWorld,
}: {
  name: string;
  pack: ExperienceMapPack | null;
  error: string | null;
  worldPath: string | null;
  onPickWorld: (path: string) => void;
}) {
  const { t } = useUiTranslation();
  const label = (
    <span className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t("game.worldKit.setup.label")}</span>
  );
  if (!pack) {
    return (
      <div>
        {label}
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {t("game.mapPack.unreadable", { name, reason: error ?? "" })}
        </p>
      </div>
    );
  }
  return (
    <div>
      {label}
      <div className="rounded-lg bg-[var(--primary)]/10 p-3 text-xs ring-1 ring-[var(--primary)]/40">
        <span className="block font-medium text-[var(--foreground)]">{pack.kit.label}</span>
        <span className="mt-1 block text-[var(--muted-foreground)]">{t("game.mapPack.kitSetBy", { name })}</span>
      </div>
      {pack.worlds.length > 0 && (
        <fieldset className="mt-3 space-y-1.5">
          <legend className="mb-1 block text-xs font-medium text-[var(--foreground)]">{t("game.mapPack.maps")}</legend>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("game.mapPack.mapsHelp", { name })}</p>
          {pack.worlds.map((world) => (
            <label key={world.path} className="flex items-center gap-2 text-xs text-[var(--foreground)]">
              <input
                type="radio"
                name="map-pack-world"
                checked={world.path === worldPath}
                onChange={() => onPickWorld(world.path)}
                className="size-4 accent-[var(--primary)]"
              />
              {world.name}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
