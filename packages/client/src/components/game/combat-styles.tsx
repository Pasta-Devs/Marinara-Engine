// ──────────────────────────────────────────────
// Combat styles (issue #8109): the seam a combat presentation plugs into, so the game surface asks
// the active style how to start, draw and lay out a battle instead of branching on style names.
// Classic and Tactical are registered here through the same seam, so they behave exactly as before.
// A client that carries its own style registers it once at load with registerCombatStyle().
// ──────────────────────────────────────────────
import { lazy, type ComponentProps, type ReactNode } from "react";
import {
  BUILT_IN_GAME_COMBAT_STYLES,
  type BuiltInGameCombatStyle,
  type Combatant,
  type CombatSummary,
  type GameCombatStyle,
  type TacticalBattlefieldBrief,
  type TacticalCombatState,
} from "@marinara-engine/shared";

const GameCombatUI = lazy(async () => {
  const module = await import("./GameCombatUI");
  return { default: module.GameCombatUI };
});

const TacticalCombatUI = lazy(async () => {
  const module = await import("./TacticalCombatUI");
  return { default: module.TacticalCombatUI };
});

type ClassicProps = ComponentProps<typeof GameCombatUI>;
type TacticalProps = ComponentProps<typeof TacticalCombatUI>;

/** What a style is told when the Game Master starts a fight. */
export interface CombatStyleStartContext {
  chatId: string;
  /** The Game Master message the fight starts from. */
  messageId: string;
}

/** Everything the game surface hands the active style to draw a battle. Mounted inside a Suspense. */
export interface CombatSurfaceContext {
  chatId: string;
  /** The Game Master message the fight started from, when known. */
  anchorMessageId: string | null;
  /** The generated party and enemies. Null for a style that keeps its own state (see isActive). */
  party: Combatant[] | null;
  enemies: Combatant[] | null;
  /** The game's setup (the wizard's choices), as saved. */
  setupConfig: Record<string, unknown> | undefined;
  /** The chat's metadata, as saved. */
  chatMeta: Record<string, unknown>;
  scene: {
    environment: string | null;
    formation: string | null;
    battlefield: TacticalBattlefieldBrief | null;
    battlefieldError: string | null;
    tileWords: TacticalProps["tileWords"];
  };
  elements: ClassicProps["elements"];
  inventoryItems: ClassicProps["inventoryItems"];
  itemEffects: ClassicProps["combatItemEffects"];
  mechanics: ClassicProps["combatMechanics"];
  dialogue: {
    lines: ClassicProps["combatDialogue"];
    cues: ClassicProps["combatDialogueCues"];
    voicedSpeakerNames: ClassicProps["voicedCombatSpeakerNames"];
    voiceVolume: ClassicProps["gameVoiceVolume"];
  };
  /** Whether the Game Master is writing. */
  isStreaming: boolean;
  /** The surface's own battle controls (logs, back to the turn before the fight). */
  controlsSlot: ReactNode;
  /** Ends the fight and hands the Game Master its summary to narrate. */
  onCombatEnd: (outcome: "victory" | "defeat" | "flee", summary: CombatSummary) => void;
  onInventoryItemUsed: ClassicProps["onInventoryItemUsed"];
  onCombatantsChange: ClassicProps["onCombatantsChange"];
  onOpenInventory: () => void;
  /** Lets the Game Master adjudicate a freeform maneuver. */
  onCustomInstruction: (instruction: string) => void;
  onSpriteSuggestionChange: ClassicProps["onSpriteSuggestionChange"];
  onBattlefieldReady: (state: TacticalCombatState) => void;
}

export interface CombatStyleSurface {
  /** Shown where a player picks a style. Built-in styles use their own localized labels. */
  label?: string;
  /** Return true to take over the start of a fight: the classic generation pass is skipped. */
  start?(ctx: CombatStyleStartContext): boolean;
  /** Drawn in place of the built-in battle UI while the fight is active. */
  render(ctx: CombatSurfaceContext): ReactNode;
  /** The style draws its own top bar, so the HUD and controls move below --tactical-chrome-height. */
  ownsTopChrome?: boolean;
  /**
   * For a style that keeps its own state outside the generated party and enemies. Such a style must
   * keep that state over a reload: after one, the fight shows only while this answers true.
   */
  isActive?(chatId: string): boolean;
  /** Tells the surface that isActive may have changed. Returns the unsubscribe. */
  subscribe?(onChange: () => void): () => void;
}

const classicStyle: CombatStyleSurface = {
  render: (ctx) =>
    ctx.party && ctx.enemies ? (
      <GameCombatUI
        elements={ctx.elements}
        chatId={ctx.chatId}
        party={ctx.party}
        enemies={ctx.enemies}
        inventoryItems={ctx.inventoryItems}
        onCombatEnd={ctx.onCombatEnd}
        onInventoryItemUsed={ctx.onInventoryItemUsed}
        onCombatantsChange={ctx.onCombatantsChange}
        onOpenInventory={ctx.onOpenInventory}
        onCustomInstruction={ctx.onCustomInstruction}
        onSpriteSuggestionChange={ctx.onSpriteSuggestionChange}
        isStreaming={ctx.isStreaming}
        narration="Battle starts."
        combatDialogue={ctx.dialogue.lines}
        combatDialogueCues={ctx.dialogue.cues}
        combatItemEffects={ctx.itemEffects}
        combatMechanics={ctx.mechanics}
        voicedCombatSpeakerNames={ctx.dialogue.voicedSpeakerNames}
        gameVoiceVolume={ctx.dialogue.voiceVolume}
        combatControlsSlot={ctx.controlsSlot}
      />
    ) : null,
};

const tacticalStyle: CombatStyleSurface = {
  ownsTopChrome: true,
  render: (ctx) =>
    ctx.party && ctx.enemies ? (
      <TacticalCombatUI
        tileWords={ctx.scene.tileWords}
        key={ctx.chatId}
        chatId={ctx.chatId}
        party={ctx.party}
        enemies={ctx.enemies}
        difficulty={(ctx.setupConfig?.difficulty as string | undefined) ?? "normal"}
        initialState={(ctx.chatMeta.gameTacticalCombatSnapshot as TacticalCombatState | null | undefined) ?? null}
        environment={ctx.scene.environment}
        formation={ctx.scene.formation}
        battlefield={ctx.scene.battlefield}
        battlefieldError={ctx.scene.battlefieldError}
        onBattlefieldReady={ctx.onBattlefieldReady}
        playerCombatantId={ctx.party[0]?.id ?? null}
        onCombatEnd={ctx.onCombatEnd}
        onCustomInstruction={ctx.onCustomInstruction}
      />
    ) : null,
};

const builtInStyles: Record<BuiltInGameCombatStyle, CombatStyleSurface> = {
  classic: classicStyle,
  tactical: tacticalStyle,
};

const registeredStyles = new Map<string, CombatStyleSurface>(Object.entries(builtInStyles));

export function isBuiltInCombatStyle(id: string | null | undefined): id is BuiltInGameCombatStyle {
  return !!id && (BUILT_IN_GAME_COMBAT_STYLES as readonly string[]).includes(id);
}

/**
 * Adds a combat style under `id`. The built-in styles cannot be replaced. Returns a function that
 * removes the style again.
 */
export function registerCombatStyle(id: string, surface: CombatStyleSurface): () => void {
  if (isBuiltInCombatStyle(id)) throw new Error(`The built-in combat style "${id}" cannot be replaced.`);
  registeredStyles.set(id, surface);
  return () => {
    if (registeredStyles.get(id) === surface) registeredStyles.delete(id);
  };
}

/** Every known style id, built-in ones first. */
export function listCombatStyles(): string[] {
  return [...registeredStyles.keys()];
}

/** A saved style id as one this client can play: an id it does not know plays as classic. */
export function resolveCombatStyle(id: string | null | undefined): GameCombatStyle {
  return id && registeredStyles.has(id) ? id : "classic";
}

export function getCombatStyle(id: string | null | undefined): CombatStyleSurface {
  return registeredStyles.get(resolveCombatStyle(id)) ?? classicStyle;
}

/**
 * Offers the start of the fight on `messageId` to its style: "taken" when the style set it up, then
 * the classic generation pass must not run; "declined" when it runs as usual; "already-taken" for a
 * second request for a fight the style already took (a same-frame double request, #5094). The
 * in-flight flag is held while the style is asked, so a request from inside start() is refused by
 * the caller's own guard, and handed back afterwards.
 */
export function offerCombatStart(
  surface: CombatStyleSurface,
  ctx: CombatStyleStartContext,
  refs: { inFlight: { current: boolean }; startedMessageId: { current: string | null } },
): "taken" | "declined" | "already-taken" {
  if (refs.startedMessageId.current === ctx.messageId) return "already-taken";
  if (!surface.start) return "declined";
  refs.inFlight.current = true;
  let taken: boolean;
  try {
    taken = surface.start(ctx);
  } finally {
    refs.inFlight.current = false;
  }
  if (!taken) return "declined";
  refs.startedMessageId.current = ctx.messageId;
  return "taken";
}

/**
 * The pin and anchor of a fight a registered style took over, from a saved combat snapshot: such a
 * fight saves no party, only those two. `style` is null when that style does not report the fight
 * as live for `chatId` (or is gone), so the save is stale. Null for any other snapshot, which restores as before.
 */
export function styleOwnedFightFromSnapshot(
  snapshot:
    { party?: unknown[] | null; combatStyle?: string | null; startMessageId?: string | null } | null | undefined,
  chatId: string,
): { style: GameCombatStyle | null; startMessageId: string | null } | null {
  if (!snapshot || snapshot.party?.length || !snapshot.combatStyle || isBuiltInCombatStyle(snapshot.combatStyle)) {
    return null;
  }
  // A fight without a party shows only while its style reports it (isActive), so a style that
  // does not report this one live, has no isActive, or is no longer registered leaves a stale save.
  const surface = registeredStyles.get(snapshot.combatStyle);
  let live: boolean;
  try {
    live = surface?.isActive?.(chatId) ?? false;
  } catch {
    live = false;
  }
  return { style: live ? snapshot.combatStyle : null, startMessageId: snapshot.startMessageId ?? null };
}
