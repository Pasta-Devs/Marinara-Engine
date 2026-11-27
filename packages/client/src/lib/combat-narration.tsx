// Battle narration on the screen: each blow's dry line is shown at once, then swapped for prose
// when it arrives. One request per batch of blows (a round, or what happened between two of the
// player's choices), never one per blow. With no model set up, or for the small blows in "Key
// moments", a line comes from the free pool below with no request at all.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  COMBAT_NARRATION_MAX_BEATS,
  isKeyCombatBeat,
  type CombatNarrateResponse,
  type CombatNarrationBeat,
  type CombatNarrationMode,
} from "@marinara-engine/shared";
import { api, ApiError } from "./api-client";
import { useUIStore } from "../stores/ui.store";

export const CombatNarrationContext = createContext<{ chatId: string; mode: CombatNarrationMode } | null>(null);

/** The box a game's fight is drawn in, which tells its battle in prose the way the game is set to. */
export function CombatNarrationFrame({
  chatId,
  mode,
  className,
  children,
}: {
  chatId: string;
  mode: CombatNarrationMode;
  className?: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ chatId, mode }), [chatId, mode]);
  return (
    <CombatNarrationContext.Provider value={value}>
      <div className={className}>{children}</div>
    </CombatNarrationContext.Provider>
  );
}

/** After a request finds no model, or fails, this many ms go by on the free pool before asking again. */
const NO_MODEL_PAUSE_MS = 60_000;
const FAILED_PAUSE_MS = 20_000;
/** When each game may ask a model again, by chat: one game's missing model never pauses another's. */
const askAgainAt = new Map<string, number>();
const NO_PROSE: ReadonlyMap<string, string> = new Map();

const POOL_SIZES = { hit: 5, critical: 4, miss: 4, heal: 3, ko: 3 } as const;

function pick(seed: string, count: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  return (Math.abs(hash) % count) + 1;
}

/** A free line for a blow, from the pool in the player's language. */
export function combatNarrationPoolLine(beat: CombatNarrationBeat, t: TFunction): string {
  const kind = beat.ko && beat.outcome !== "heal" && beat.outcome !== "miss" ? "ko" : beat.outcome;
  const move =
    beat.move ||
    (t(
      beat.outcome === "heal" ? "game.combat.narration.pool.healFallback" : "game.combat.narration.pool.moveFallback",
    ) as string);
  const line = t(`game.combat.narration.pool.${kind}${pick(`${beat.id}:${beat.actor}`, POOL_SIZES[kind])}`, {
    actor: beat.actor,
    target: beat.target || beat.actor,
    move,
  }) as string;
  // A line that opens on the stand-in move ("a fierce strike from…") still starts a sentence.
  return line.charAt(0).toLocaleUpperCase() + line.slice(1);
}

/**
 * The prose for each blow told so far, by the blow's id, and the call that tells more. Outside a
 * game (no provider) narration is off and `narrate` does nothing.
 */
export function useCombatNarration() {
  const context = useContext(CombatNarrationContext);
  const { t, i18n } = useTranslation();
  const debugMode = useUIStore((state) => state.debugMode);
  const [prose, setProse] = useState<ReadonlyMap<string, string>>(() => new Map());
  const asked = useRef(new Set<string>());
  const live = useRef(new Set<AbortController>());
  useEffect(() => {
    const requests = live.current;
    return () => {
      for (const controller of requests) controller.abort();
      requests.clear();
    };
  }, []);
  const chatId = context?.chatId;
  const mode = context?.mode ?? "off";
  const language = i18n.resolvedLanguage ?? i18n.language;

  const narrate = useCallback(
    (beats: CombatNarrationBeat[]) => {
      if (!chatId || mode === "off") return;
      const fresh = beats.filter((beat) => !asked.current.has(beat.id));
      if (fresh.length === 0) return;
      for (const beat of fresh) asked.current.add(beat.id);
      const toModel = (mode === "every" ? fresh : fresh.filter(isKeyCombatBeat)).slice(-COMBAT_NARRATION_MAX_BEATS);
      const fromPool = fresh.filter((beat) => !toModel.includes(beat));
      const setLines = (lines: Array<[string, string]>) => {
        if (lines.length === 0) return;
        setProse((previous) => {
          const next = new Map(previous);
          for (const [id, text] of lines) next.set(id, text);
          return next;
        });
      };
      const poolLines = (list: CombatNarrationBeat[]) =>
        list.map((beat): [string, string] => [beat.id, combatNarrationPoolLine(beat, t)]);
      setLines(poolLines(fromPool));
      if (toModel.length === 0) return;
      if (Date.now() < (askAgainAt.get(chatId) ?? 0)) {
        setLines(poolLines(toModel));
        return;
      }
      const controller = new AbortController();
      live.current.add(controller);
      api
        .post<CombatNarrateResponse>(
          "/game/combat/narrate",
          { chatId, beats: toModel, language, debugMode },
          { signal: controller.signal },
        )
        .then((response) => {
          setLines(
            toModel.map((beat, index): [string, string] => [
              beat.id,
              response.lines[index] ?? combatNarrationPoolLine(beat, t),
            ]),
          );
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          askAgainAt.set(
            chatId,
            Date.now() + (error instanceof ApiError && error.status === 503 ? NO_MODEL_PAUSE_MS : FAILED_PAUSE_MS),
          );
          setLines(poolLines(toModel));
        })
        .finally(() => live.current.delete(controller));
    },
    [chatId, mode, language, debugMode, t],
  );

  /** Forgets everything told so far: a different fight now holds the screen. */
  const reset = useCallback(() => {
    for (const controller of live.current) controller.abort();
    live.current.clear();
    asked.current.clear();
    setProse(new Map());
  }, []);

  // Off hides prose already told, and any that arrives after the switch.
  return { mode, prose: mode === "off" ? NO_PROSE : prose, narrate, reset };
}
