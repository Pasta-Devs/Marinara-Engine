// The World choice of the Game setup wizard (worldgen W1), under the setting kit: off, or a world made
// from a seed in the kit's words. The places the player's lore states are read first and kept; the
// model writes the brief (what else exists); code lays the world out, and the preview here is that
// same compile, run in the browser. The game keeps the world it was created with.
import { useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Download, Shuffle, Sparkles } from "lucide-react";
import {
  WORLD_GENERATOR_VERSION,
  worldGeneratorReads,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  withWorldCanon,
  worldEditIssues,
  worldFile,
  type StoryScript,
  type WorldEdits,
  type WorldBrief,
  type WorldBriefEvent,
  type WorldBriefInput,
  type WorldBriefPlace,
  type WorldKit,
  gameWorldFromSnapshot,
  worldSnapshot,
  type WorldSnapshot,
} from "@marinara-engine/shared";
import { ApiError, api } from "../../lib/api-client";
import { downloadJsonFile } from "../../lib/download-json";
import { parseExperienceSeed } from "../../lib/game-experience-setup";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { WordsField, useWritingSeconds } from "./GameSetupWorldKitChooser";
import { GAME_SETUP_GHOST_BUTTON_CLASS, GAME_SETUP_INPUT_CLASS as INPUT } from "./game-setup-classes";

/** What the wizard holds while a world is being made. */
export interface WorldDraft {
  seed: string;
  grounding: "expand" | "strict";
  lorebookIds: string[];
  /** The places read from the lore, kept exactly by the brief. */
  canon: WorldBriefPlace[];
  /** The dated events read from the lore (worldgen W3), kept exactly by the brief. Absent in drafts
   *  made before events were read. */
  canonEvents?: WorldBriefEvent[];
  /** The brief the model wrote, as the player has changed it; null until one is written. */
  brief: WorldBriefInput | null;
  /** The hand edits (worldgen W9c) of a world read from a file, and the seed, grounding and brief they
   *  were made for: kept while those stay as they are and the edits fit them. */
  edits?: WorldEdits;
  editsFor?: string;
  /** The world's story script (worldgen W10), kept on the same terms as the hand edits: while the seed,
   *  grounding and brief stay as they were, and it fits the world. */
  story?: StoryScript;
  /** The world as it was made (W11), for a world from a file another generator made: kept on the same
   *  terms, since changing the seed or brief makes a new world with this Engine's generator. */
  snapshot?: WorldSnapshot;
  /** The generator version of a world read from a file, a setup or a map pack: kept on the same terms
   *  as the hand edits, so a world made before sites is made again without them. */
  generatorVersion?: number;
}

const editsKey = (seed: number, grounding: WorldDraft["grounding"], brief: WorldBriefInput | null) =>
  JSON.stringify([seed, grounding, brief]);

/** A world (from a setup or world file) as a draft: its lore-read places and events kept as canon. */
export function worldDraftFromWorld(
  world: {
    seed: number;
    grounding?: WorldDraft["grounding"];
    brief: WorldBriefInput;
    edits?: WorldEdits;
    generatorVersion?: number;
  },
  story?: StoryScript,
  snapshot?: WorldSnapshot,
): WorldDraft {
  // An older version this Engine still makes (a world made before sites); one it does not make comes with
  // its snapshot instead, and a new world from it is this Engine's.
  const olderGenerator =
    worldGeneratorReads(world.generatorVersion) && world.generatorVersion !== WORLD_GENERATOR_VERSION;
  return {
    seed: String(world.seed),
    grounding: world.grounding ?? "expand",
    lorebookIds: [],
    canon: (world.brief.places ?? [])
      .filter((place) => place.lore?.length)
      .map((place) => ({ ...place, tags: place.tags ?? [] })),
    canonEvents: (world.brief.events ?? [])
      .filter((event) => event.lore?.length)
      .map((event) => ({ ...event, places: event.places ?? [], groups: event.groups ?? [] })),
    brief: world.brief,
    ...(world.edits ? { edits: world.edits } : {}),
    ...(story ? { story } : {}),
    ...(snapshot ? { snapshot } : {}),
    ...(olderGenerator ? { generatorVersion: world.generatorVersion } : {}),
    ...(world.edits || story || snapshot || olderGenerator
      ? { editsFor: editsKey(world.seed, world.grounding ?? "expand", world.brief) }
      : {}),
  };
}

export interface WorldWriteRequest {
  connectionId?: string;
  genre: string;
  setting: string;
  tone: string;
  playerGoals?: string;
  language?: string;
}

export const rollWorldSeed = () => String(crypto.getRandomValues(new Uint32Array(1))[0]);

/** A fresh world for a kit: a rolled seed, grounded loosely in the lore, with no brief yet. */
export const newWorldDraft = (): WorldDraft => ({
  seed: rollWorldSeed(),
  grounding: "expand",
  lorebookIds: [],
  canon: [],
  brief: null,
});

/** The world a draft makes, or why it cannot be made yet. A draft with no brief yet is a world of the
 *  kit and the lore alone, with the kit's own summary as its premise. */
export function worldDraftConfig(
  kit: WorldKit,
  draft: WorldDraft,
):
  | {
      ok: true;
      world: {
        seed: number;
        generatorVersion: number;
        grounding: WorldDraft["grounding"];
        brief: WorldBrief;
        edits?: WorldEdits;
      };
      /** The world's story, when it fits the world as made. */
      story?: StoryScript;
      /** The world as another generator made it (W11), played as it is. */
      snapshot?: WorldSnapshot;
      /** What of the brief the kit no longer fits, left out or changed. */
      repairs: string[];
      /** The draft's hand edits no longer fit it (its seed or brief changed), so they are left out. */
      editsLeftOut?: true;
      /** The same for the draft's story. */
      storyLeftOut?: true;
    }
  | { ok: false; issues: string[] } {
  const seed = parseExperienceSeed(draft.seed);
  if (seed === null) return { ok: false, issues: ["seed"] };
  // A world another generator made is the snapshot's while the draft keeps its seed, brief and kit (W11);
  // another kit, like another seed, makes a new world with this Engine's generator.
  const snapshot = draft.snapshot;
  if (
    snapshot &&
    draft.editsFor === editsKey(seed, draft.grounding, draft.brief) &&
    JSON.stringify(snapshot.kit) === JSON.stringify(kit)
  ) {
    const storyFits = draft.story && checkStoryScript(gameWorldFromSnapshot(snapshot), draft.story).ok;
    return {
      ok: true,
      world: {
        seed: snapshot.seed,
        generatorVersion: snapshot.generatorVersion,
        grounding: snapshot.grounding,
        brief: snapshot.brief,
        ...(snapshot.edits ? { edits: snapshot.edits } : {}),
      },
      ...(storyFits ? { story: draft.story } : {}),
      snapshot,
      repairs: [],
      ...(draft.story && !storyFits ? { storyLeftOut: true as const } : {}),
    };
  }
  const brief = draft.brief ?? {
    briefVersion: 1 as const,
    premise: kit.summary,
    places: draft.canon,
    placeNames: [],
    events: draft.canonEvents ?? [],
  };
  const checked = checkWorldBrief(kit, brief);
  if (!checked.ok) return { ok: false, issues: checked.issues };
  // Hand edits are made for one compile: they stay while they fit it, and are left out once the seed or
  // the brief changes under them. So does the generator version a world was made by: a new seed or brief
  // is a new world, made by this Engine's generator.
  const unchanged = draft.editsFor === editsKey(seed, draft.grounding, draft.brief);
  const world = {
    seed,
    generatorVersion: (unchanged && draft.generatorVersion) || WORLD_GENERATOR_VERSION,
    grounding: draft.grounding,
    brief: checked.brief,
  };
  const fits = draft.edits && unchanged && worldEditIssues({ kit, ...world }, draft.edits).length === 0;
  const made = fits ? { ...world, edits: draft.edits } : world;
  // A story names the world's places and people (by id), so it stays only with the very world it was
  // written for, and only while it fits it.
  const storyFits =
    draft.story &&
    unchanged &&
    checkStoryScript({ kit, ...made, world: compileGameWorld({ kit, ...made }) }, draft.story).ok;
  return {
    ok: true,
    world: made,
    ...(storyFits ? { story: draft.story } : {}),
    repairs: checked.repairs,
    ...(draft.edits && !fits ? { editsLeftOut: true as const } : {}),
    ...(draft.story && !storyFits ? { storyLeftOut: true as const } : {}),
  };
}

const FIELD_LABEL = "mb-1 block text-xs text-[var(--muted-foreground)]";
const CELL = 6;

function apiReasons(error: unknown): string[] {
  return error instanceof ApiError &&
    error.payload &&
    typeof error.payload === "object" &&
    Array.isArray((error.payload as { issues?: unknown }).issues)
    ? ((error.payload as { issues: unknown[] }).issues.filter((issue) => typeof issue === "string") as string[])
    : [];
}

export function GameSetupWorldChooser({
  kit,
  draft,
  onChange,
  lorebooks,
  request,
  required = false,
}: {
  kit: WorldKit;
  draft: WorldDraft | null;
  onChange: (draft: WorldDraft | null) => void;
  lorebooks: Array<{ id: string; name: string }>;
  /** What the model writes for; null until a connection is chosen. */
  request: WorldWriteRequest | null;
  /** An Overworld RPG game: it always has a world, so there is no switch to leave one out. */
  required?: boolean;
}) {
  const { t } = useUiTranslation();
  const [busy, setBusy] = useState<"lore" | "brief" | null>(null);
  const writingSeconds = useWritingSeconds(busy === "brief");
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  // As in the kit chooser: an answer lands only on the draft it was asked for.
  const latest = useRef(draft);
  latest.current = draft;

  const config = draft ? worldDraftConfig(kit, draft) : null;
  // The same compile the game will run; it keeps its own cache of recent worlds by their inputs.
  const preview = config?.ok
    ? config.snapshot
      ? gameWorldFromSnapshot(config.snapshot).world
      : compileGameWorld({ kit, ...config.world })
    : null;

  const edit = (change: (next: WorldDraft) => void) => {
    if (!draft) return;
    const next = structuredClone(draft);
    change(next);
    onChange(next);
  };

  const ask = async <T,>(
    kind: "lore" | "brief",
    path: string,
    body: Record<string, unknown>,
    apply: (value: T, into: WorldDraft) => void,
    done: (value: T) => string,
  ) => {
    if (!draft || !request || busy) return;
    const asked = draft;
    setBusy(kind);
    setMessage(null);
    try {
      const value = await api.post<T>(path, { ...body, debugMode: useUIStore.getState().debugMode });
      if (latest.current !== asked) return;
      const next = structuredClone(asked);
      apply(value, next);
      onChange(next);
      setMessage({ error: false, text: done(value) });
    } catch (error) {
      const reasons = apiReasons(error);
      setMessage({
        error: true,
        text: [error instanceof Error ? error.message : t("game.world.setup.failed"), ...reasons.slice(0, 3)].join(" "),
      });
    } finally {
      setBusy(null);
    }
  };

  const readLore = () =>
    ask<{
      places: WorldBriefPlace[];
      events: WorldBriefEvent[];
      repairs: string[];
      entriesRead: number;
      entriesLeft: number;
    }>(
      "lore",
      "/game/world-canon",
      { connectionId: request!.connectionId, kit, lorebookIds: draft!.lorebookIds },
      (value, into) => {
        into.canon = value.places;
        into.canonEvents = value.events;
        // A brief already written takes the lore read now, so it never drifts from what is shown.
        if (into.brief) into.brief = withWorldCanon(into.brief, value.places, value.events) as WorldBriefInput;
      },
      (value) =>
        t(value.entriesLeft > 0 ? "game.world.setup.loreReadSome" : "game.world.setup.loreRead", {
          count: value.places.length,
          read: value.entriesRead,
          left: value.entriesLeft,
        }),
    );
  const writeBrief = () =>
    ask<{ brief: WorldBriefInput; repairs: string[] }>(
      "brief",
      "/game/world-brief",
      { ...request!, kit, canon: draft!.canon, canonEvents: draft!.canonEvents ?? [], grounding: draft!.grounding },
      (value, into) => {
        into.brief = value.brief;
      },
      (value) =>
        value.repairs.length
          ? t("game.world.setup.briefRepaired", { count: value.repairs.length })
          : t("game.world.setup.briefWritten"),
    );

  const settlementsDepth = kit.layers.findIndex((layer) => layer.settlements);
  const sizeLabel = (id: string | undefined) => kit.sizes.find((size) => size.id === id)?.label ?? id ?? "";
  const sized = (place: { name: string; size?: string }) =>
    t("game.world.setup.placeWithSize", { name: place.name, size: sizeLabel(place.size) });
  const kinds = (kit.terrain ?? [{ kind: "open" as const }]).map((entry) => entry.kind);

  return (
    <div className="space-y-2">
      {required ? (
        <div className="rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
          <span className="block">{t("game.world.setup.labelOverworld")}</span>
          <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
            {t("game.world.setup.helpOverworld")}
          </span>
        </div>
      ) : (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={Boolean(draft)}
            onChange={(event) => onChange(event.target.checked ? newWorldDraft() : null)}
            className="mt-1 size-4 accent-[var(--primary)]"
          />
          <span>
            {t("game.world.setup.label")}
            <span className="mt-1 block text-xs text-[var(--muted-foreground)]">{t("game.world.setup.help")}</span>
          </span>
        </label>
      )}

      {draft && (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="world-seed" className={FIELD_LABEL}>
                {t("game.world.setup.seed")}
              </label>
              <input
                id="world-seed"
                inputMode="numeric"
                value={draft.seed}
                onChange={(event) => edit((next) => (next.seed = event.target.value))}
                aria-invalid={parseExperienceSeed(draft.seed) === null}
                className={INPUT}
              />
            </div>
            <button
              type="button"
              onClick={() => edit((next) => (next.seed = rollWorldSeed()))}
              className={cn(GAME_SETUP_GHOST_BUTTON_CLASS, "ring-1 ring-[var(--border)]")}
            >
              <Shuffle size={13} />
              {t("game.world.setup.roll")}
            </button>
            <button
              type="button"
              disabled={!config?.ok}
              onClick={() =>
                config?.ok &&
                downloadJsonFile(
                  worldFile(
                    `${kit.label} ${config.world.seed}`,
                    kit,
                    config.world,
                    config.story,
                    // The world as made (W11), so the file reads the same after the generator changes.
                    config.snapshot ?? (preview ? worldSnapshot({ kit, ...config.world, world: preview }) : null),
                  ),
                  `${`${kit.label} ${config.world.seed}`.replace(/[^\w.-]+/g, "_")}.world.json`,
                )
              }
              className={cn(
                GAME_SETUP_GHOST_BUTTON_CLASS,
                "gap-2 ring-1 ring-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Download size={13} />
              {t("game.world.setup.download")}
            </button>
          </div>
          {config?.ok && config.world.edits && (
            <p className="text-[var(--muted-foreground)]">{t("game.world.setup.handEdits")}</p>
          )}
          {config?.ok && config.editsLeftOut && (
            <p role="status" className="text-[var(--muted-foreground)]">
              {t("game.world.setup.editsLeftOut")}
            </p>
          )}
          {config?.ok && config.story && (
            <p className="text-[var(--muted-foreground)]">{t("game.world.setup.story")}</p>
          )}
          {config?.ok && config.storyLeftOut && (
            <p role="status" className="text-[var(--muted-foreground)]">
              {t("game.world.setup.storyLeftOut")}
            </p>
          )}

          {lorebooks.length > 0 && (
            <fieldset className="space-y-1.5">
              <legend className={FIELD_LABEL}>{t("game.world.setup.lore")}</legend>
              {lorebooks.map((book) => (
                <label key={book.id} className="flex items-center gap-2 text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={draft.lorebookIds.includes(book.id)}
                    onChange={(event) =>
                      edit((next) => {
                        next.lorebookIds = event.target.checked
                          ? [...next.lorebookIds, book.id]
                          : next.lorebookIds.filter((id) => id !== book.id);
                      })
                    }
                    className="size-4 accent-[var(--primary)]"
                  />
                  {book.name}
                </label>
              ))}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor="world-grounding" className={FIELD_LABEL}>
                    {t("game.world.setup.grounding")}
                  </label>
                  <select
                    id="world-grounding"
                    value={draft.grounding}
                    onChange={(event) =>
                      edit((next) => (next.grounding = event.target.value as WorldDraft["grounding"]))
                    }
                    className={INPUT}
                  >
                    <option value="expand">{t("game.world.setup.groundingExpand")}</option>
                    <option value="strict">{t("game.world.setup.groundingStrict")}</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void readLore()}
                  disabled={!request || busy !== null || draft.lorebookIds.length === 0}
                  className={cn(
                    GAME_SETUP_GHOST_BUTTON_CLASS,
                    "gap-2 ring-1 ring-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {busy === "lore" ? t("game.world.setup.reading") : t("game.world.setup.readLore")}
                </button>
              </div>
              {draft.canon.length > 0 && (
                <p className="text-[var(--muted-foreground)]">
                  {t("game.world.setup.canon", { names: draft.canon.map((place) => place.name).join(", ") })}
                </p>
              )}
              {(draft.canonEvents ?? []).length > 0 && (
                <p className="text-[var(--muted-foreground)]">
                  {t("game.world.setup.canonEvents", { count: draft.canonEvents!.length })}
                </p>
              )}
            </fieldset>
          )}

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => void writeBrief()}
              disabled={!request || busy !== null}
              className={cn(
                GAME_SETUP_GHOST_BUTTON_CLASS,
                "gap-2 ring-1 ring-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Sparkles size={13} />
              {busy === "brief"
                ? t("game.world.setup.writingFor", { seconds: writingSeconds })
                : t("game.world.setup.writeBrief")}
            </button>
            <p className="text-[var(--muted-foreground)]">
              {busy === "brief"
                ? t("game.world.setup.writingSlow")
                : request
                  ? t("game.world.setup.writeHelp")
                  : t("game.world.setup.needsConnection")}
            </p>
            {message && (
              <p
                role={message.error ? "alert" : "status"}
                className={message.error ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"}
              >
                {message.text}
              </p>
            )}
          </div>

          {draft.brief && (
            <details>
              <summary className="cursor-pointer py-1 text-xs font-medium text-[var(--foreground)]">
                {t("game.world.setup.editBrief")}
              </summary>
              <div className="mt-2 space-y-3">
                <div>
                  <label htmlFor="world-premise" className={FIELD_LABEL}>
                    {t("game.world.setup.premise")}
                  </label>
                  <textarea
                    id="world-premise"
                    rows={3}
                    value={draft.brief.premise}
                    onChange={(event) => edit((next) => (next.brief!.premise = event.target.value))}
                    className={INPUT}
                  />
                </div>
                {(draft.brief.places ?? []).map((place, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <input
                      value={place.name}
                      onChange={(event) =>
                        edit((next) => {
                          // The places inside it, the groups seated in it and the events there follow the new name.
                          const was = next.brief!.places![index]!.name.toLowerCase();
                          const now = event.target.value;
                          next.brief!.places![index]!.name = now;
                          for (const other of next.brief!.places!) {
                            if (other.parent?.toLowerCase() === was) other.parent = now;
                          }
                          for (const group of next.brief!.groups ?? []) {
                            if (group.seat?.toLowerCase() === was) group.seat = now;
                          }
                          for (const past of next.brief!.events ?? []) {
                            past.places = (past.places ?? []).map((name) => (name.toLowerCase() === was ? now : name));
                          }
                        })
                      }
                      aria-label={t("game.world.setup.placeName", {
                        layer: kit.layers.find((layer) => layer.id === place.layer)?.label ?? place.layer,
                      })}
                      className={INPUT}
                    />
                    <input
                      value={place.note ?? ""}
                      onChange={(event) =>
                        edit((next) => {
                          if (event.target.value) next.brief!.places![index]!.note = event.target.value;
                          else delete next.brief!.places![index]!.note;
                        })
                      }
                      aria-label={t("game.world.setup.placeNote", { name: place.name })}
                      placeholder={t("game.world.setup.notePlaceholder")}
                      className={INPUT}
                    />
                  </div>
                ))}
                {kit.cultures.map((culture) => {
                  const group = (draft.brief!.placeNames ?? []).find((each) => each.culture === culture.id);
                  return (
                    <WordsField
                      key={culture.id}
                      id={`world-names-${culture.id}`}
                      label={t("game.world.setup.placeNames", { culture: culture.label })}
                      words={group?.names ?? []}
                      onChange={(words) =>
                        edit((next) => {
                          const others = (next.brief!.placeNames ?? []).filter((each) => each.culture !== culture.id);
                          next.brief!.placeNames = words.length
                            ? [...others, { culture: culture.id, names: words }]
                            : others;
                        })
                      }
                    />
                  );
                })}
                {kit.cultures.map((culture) => {
                  const names = (draft.brief!.peopleNames ?? []).find((each) => each.culture === culture.id);
                  const setNames = (key: "given" | "family", words: string[]) =>
                    edit((next) => {
                      const all = next.brief!.peopleNames ?? [];
                      const own = all.find((each) => each.culture === culture.id) ?? {
                        culture: culture.id,
                        given: [],
                        family: [],
                      };
                      const updated = { ...own, [key]: words };
                      const others = all.filter((each) => each.culture !== culture.id);
                      next.brief!.peopleNames =
                        updated.given.length || (updated.family ?? []).length ? [...others, updated] : others;
                    });
                  return (
                    <div key={`people-${culture.id}`} className="grid gap-2 sm:grid-cols-2">
                      <WordsField
                        id={`world-given-${culture.id}`}
                        label={t("game.world.setup.givenNames", { culture: culture.label })}
                        words={names?.given ?? []}
                        onChange={(words) => setNames("given", words)}
                      />
                      <WordsField
                        id={`world-family-${culture.id}`}
                        label={t("game.world.setup.familyNames", { culture: culture.label })}
                        words={names?.family ?? []}
                        onChange={(words) => setNames("family", words)}
                      />
                    </div>
                  );
                })}
                {(draft.brief.groups ?? []).map((group, index) => (
                  <div key={`group-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <input
                      value={group.name}
                      onChange={(event) =>
                        edit((next) => {
                          // The groups that call it an ally or a rival, and the events that name it, follow the new name.
                          const was = next.brief!.groups![index]!.name.toLowerCase();
                          const now = event.target.value;
                          next.brief!.groups![index]!.name = now;
                          for (const other of next.brief!.groups!) {
                            other.allies = (other.allies ?? []).map((name) =>
                              name.toLowerCase() === was ? now : name,
                            );
                            other.rivals = (other.rivals ?? []).map((name) =>
                              name.toLowerCase() === was ? now : name,
                            );
                          }
                          for (const past of next.brief!.events ?? []) {
                            past.groups = (past.groups ?? []).map((name) => (name.toLowerCase() === was ? now : name));
                          }
                        })
                      }
                      aria-label={t("game.world.setup.groupName", {
                        kind: kit.groupKinds.find((kind) => kind.id === group.kind)?.label ?? group.kind,
                      })}
                      className={INPUT}
                    />
                    <input
                      value={group.note ?? ""}
                      onChange={(event) =>
                        edit((next) => {
                          if (event.target.value) next.brief!.groups![index]!.note = event.target.value;
                          else delete next.brief!.groups![index]!.note;
                        })
                      }
                      aria-label={t("game.world.setup.groupNote", { name: group.name })}
                      placeholder={t("game.world.setup.groupNotePlaceholder")}
                      className={INPUT}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}

          {config?.ok && config.repairs.length > 0 && (
            <div role="status" className="text-[var(--muted-foreground)]">
              <span className="block">{t("game.world.setup.repairs")}</span>
              {config.repairs.slice(0, 5).map((repair) => (
                <span key={repair} className="block">
                  {repair}
                </span>
              ))}
            </div>
          )}

          {config && !config.ok && (
            <div role="status" className="text-[var(--destructive)]">
              <span className="block">
                {config.issues[0] === "seed" ? t("game.world.setup.badSeed") : t("game.world.setup.invalid")}
              </span>
              {config.issues[0] !== "seed" &&
                config.issues.slice(0, 5).map((issue) => (
                  <span key={issue} className="block">
                    {issue}
                  </span>
                ))}
            </div>
          )}

          {preview && (
            <div className="space-y-2" data-testid="world-preview">
              <svg
                viewBox={`0 0 ${preview.width * CELL} ${preview.height * CELL}`}
                className="w-full rounded-md ring-1 ring-[var(--border)]"
                role="img"
                aria-label={t("game.world.setup.mapLabel")}
              >
                <rect width={preview.width * CELL} height={preview.height * CELL} fill="var(--secondary)" />
                {Array.from({ length: preview.height }, (_, y) => {
                  // One rectangle per run of the same kind in a row.
                  const runs: Array<{ x: number; length: number; kind: string }> = [];
                  for (let x = 0; x < preview.width; x++) {
                    const kind = kinds[parseInt(preview.ground[y * preview.width + x]!, 36)] ?? "open";
                    const last = runs.at(-1);
                    if (last && last.kind === kind && last.x + last.length === x) last.length++;
                    else runs.push({ x, length: 1, kind });
                  }
                  return runs
                    .filter((run) => run.kind !== "open")
                    .map((run) => (
                      <rect
                        key={`${y}-${run.x}`}
                        x={run.x * CELL}
                        y={y * CELL}
                        width={run.length * CELL}
                        height={CELL}
                        fill={run.kind === "water" ? "var(--primary)" : "var(--muted-foreground)"}
                        opacity={run.kind === "water" ? 0.35 : 0.5}
                      />
                    ));
                })}
                {preview.links.map((link) => {
                  const from = preview.places.find((place) => place.id === link.from)!;
                  const to = preview.places.find((place) => place.id === link.to)!;
                  return (
                    <line
                      key={`${link.from}-${link.to}`}
                      x1={(from.at.x + 0.5) * CELL}
                      y1={(from.at.y + 0.5) * CELL}
                      x2={(to.at.x + 0.5) * CELL}
                      y2={(to.at.y + 0.5) * CELL}
                      stroke="var(--foreground)"
                      strokeOpacity={0.3}
                      strokeWidth={1}
                    />
                  );
                })}
                {preview.places
                  .filter((place) => place.depth === settlementsDepth)
                  .map((place) => (
                    <circle
                      key={place.id}
                      cx={(place.at.x + 0.5) * CELL}
                      cy={(place.at.y + 0.5) * CELL}
                      r={1.5 + place.rank! * 0.75}
                      fill={place.id === preview.startId ? "var(--primary)" : "var(--foreground)"}
                    >
                      <title>{sized(place)}</title>
                    </circle>
                  ))}
              </svg>
              <p className="text-[var(--muted-foreground)]">
                {t("game.world.setup.start", {
                  name: preview.places.find((place) => place.id === preview.startId)?.name ?? "",
                })}
              </p>
              <details>
                <summary className="cursor-pointer py-1 text-xs font-medium text-[var(--foreground)]">
                  {t("game.world.setup.places", {
                    count: preview.places.filter((place) => place.depth === settlementsDepth).length,
                  })}
                </summary>
                <ul className="mt-1 space-y-1">
                  {preview.places
                    .filter(
                      (place) => place.depth === settlementsDepth - 1 || (settlementsDepth === 0 && place.depth === 0),
                    )
                    .map((region) => (
                      <li key={region.id} className="text-[var(--muted-foreground)]">
                        {settlementsDepth > 0
                          ? t("game.world.setup.region", {
                              name: region.name,
                              places: preview.places
                                .filter((place) => place.parentId === region.id)
                                .map((place) => sized(place))
                                .join(", "),
                            })
                          : sized(region)}
                      </li>
                    ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
