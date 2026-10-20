// ──────────────────────────────────────────────
// Avatar stage: avatars in Roleplay and Game chats (lane: base)
// ──────────────────────────────────────────────
// Mounted lazily by the chat surfaces. Picks each participant's kind (AvatarConfig.activeKind, falling
// back by AVATAR_KIND_AGENT to a kind whose agent is on; with 2D Avatars on, expression sprites are a
// PNGTuber avatar until one is saved), loads renderers with loadAvatarRenderer(), creates one director
// once an avatar shows, and runs the single frame loop within AVATAR_RENDER_BUDGET (visible count, DPR
// cap, fps, pause when hidden, offscreen, covered or effects-paused, reduced motion). It never hides the
// full-body sprite: the user turns that off by hand. Avatars share the saved sprite layout (placement key
// `<ownerId>:avatar`); Chat Settings' Avatars drawer turns Arrange on, sizes and frames them, with or without the
// Expression Engine. The stage itself has no controls.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useQueries, type QueryObserverResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AVATAR_2D_AGENT_ID,
  type AvatarConfig,
  type AvatarFeatureFlags,
  type AvatarImageRef,
  type AvatarKind,
  type PngtuberAvatarData,
  type SpriteCharacterVisualSettings,
  type SpritePlacement,
  type SpriteSide,
} from "@marinara-engine/shared";
import { clampSpritePlacement, getDefaultSpritePlacement } from "../../../components/chat/sprite-placement";
import { useSpritePlacementDrag } from "../../../components/chat/use-sprite-placement-drag";
import { SPRITE_DISPLAY_SCALE_MAX, SPRITE_DISPLAY_SCALE_MIN } from "../../../components/chat/sprite-display-modes";
import { fetchAvatarModel, useAvatarModelList } from "../../../hooks/use-avatar-models";
import { spriteKeys, type SpriteInfo } from "../../../hooks/use-characters";
import { useMatchMedia } from "../../../hooks/use-match-media";
import { useReducedAmbientEffects } from "../../../hooks/use-reduced-ambient-effects";
import { useTTSConfig } from "../../../hooks/use-tts";
import { api } from "../../../lib/api-client";
import {
  AVATAR_RENDER_BUDGET,
  avatarModelKeys,
  type AvatarDirector,
  type AvatarFraming,
  type AvatarRenderer,
  type AvatarStageProps,
} from "../contract";
import { createAvatarDirector } from "../director/avatar-director";
import { buildPngtuberLayersFromSprites } from "../renderers/pngtuber/pngtuber-layers";
import {
  AVATAR_PHONE_QUERY,
  applyAvatarFeatures,
  avatarDrawDue,
  avatarsUnderLoad,
  ownerKey,
  recordAvatarDrawCost,
  resolveAvatarImage,
  selectStageAvatars,
  withSpriteAvatar,
  type AvatarDrawClock,
  type StageAvatar,
  type StageAvatarSummary,
} from "./avatar-stage-logic";
import { useAvatarEffectsPaused, useChatCovered, useOnScreen } from "./use-avatar-pause";
import { useAvatarRenderer } from "./use-avatar-renderer";

/** Where avatars stand, matching the chat's saved sprite layout. */
export interface AvatarStageLayout {
  side?: SpriteSide | "center";
  placements?: Record<string, SpritePlacement>;
  characterVisualSettings?: Record<string, SpriteCharacterVisualSettings>;
  /** Full-body sprite scale, which avatars share. */
  scale?: number;
  /** Scene-wide multiplier (Visual Novel sprite size). */
  scaleMultiplier?: number;
  /** Each 3D avatar's framing, by owner id (portrait when unset). */
  framings?: Record<string, AvatarFraming>;
  /** Arrange mode, turned on in Chat Settings: avatars can be dragged and moved with the arrow keys. */
  editing?: boolean;
  onPlacementChange?: (placementKey: string, placement: SpritePlacement) => void;
  /** The avatars the stage shows, for Chat Settings' Avatars drawer; empty once the stage is gone. */
  onShownChange?: (avatars: StageAvatarSummary[]) => void;
}

interface StageSlot {
  renderer: AvatarRenderer;
  features: AvatarFeatureFlags;
}

/** Each participant's sprite list: null while loading, empty when it failed. Structurally shared by React
 *  Query, so an unchanged list keeps its identity. */
function combineSpriteLists(results: QueryObserverResult<SpriteInfo[]>[]): (SpriteInfo[] | null)[] {
  return results.map((result) => result.data ?? (result.isError ? [] : null));
}

/** The PNGTuber setup a sprite list makes, built once per list so avatars do not remount on every render. */
const spriteSetupCache = new WeakMap<SpriteInfo[], PngtuberAvatarData | null>();
function spriteSetupFor(sprites: SpriteInfo[] | null | undefined): PngtuberAvatarData | null {
  if (!sprites) return null;
  if (!spriteSetupCache.has(sprites)) spriteSetupCache.set(sprites, buildPngtuberLayersFromSprites(sprites));
  return spriteSetupCache.get(sprites) ?? null;
}

export function avatarPlacementKey(ownerId: string) {
  return `${ownerId}:avatar`;
}

export function AvatarStage({
  chatId,
  mode,
  participants,
  enabledAgentIds,
  side = "left",
  placements,
  characterVisualSettings,
  scale = 1,
  scaleMultiplier = 1,
  framings,
  editing = false,
  onPlacementChange,
  onShownChange,
}: AvatarStageProps & AvatarStageLayout) {
  const { t } = useTranslation();
  const phone = useMatchMedia(AVATAR_PHONE_QUERY);
  const reducedMotion = useReducedAmbientEffects();
  const effectsPaused = useAvatarEffectsPaused();
  const stageRef = useRef<HTMLDivElement>(null);

  const { data: summaries } = useAvatarModelList(participants.length > 0 && enabledAgentIds.length > 0);
  // With 2D Avatars on, an owner's expression sprites are a PNGTuber avatar until one is saved.
  const spriteLists = useQueries({
    queries: participants.map(({ owner }) => ({
      queryKey: spriteKeys.list(owner.ownerId),
      queryFn: () => api.get<SpriteInfo[]>(`/sprites/${owner.ownerId}`),
      enabled: enabledAgentIds.includes(AVATAR_2D_AGENT_ID),
      staleTime: 5 * 60_000,
    })),
    combine: combineSpriteLists,
  });
  const spritesByOwner = useMemo(
    () => new Map(participants.map((participant, position) => [ownerKey(participant.owner), spriteLists[position]])),
    [participants, spriteLists],
  );
  const spriteAvatarOwners = useMemo(
    () => new Set([...spritesByOwner].filter(([, sprites]) => spriteSetupFor(sprites)).map(([key]) => key)),
    [spritesByOwner],
  );
  const maxVisible = phone ? AVATAR_RENDER_BUDGET.maxVisible.phone : AVATAR_RENDER_BUDGET.maxVisible.desktop;
  const shown = useMemo(
    () => selectStageAvatars(participants, summaries, enabledAgentIds, maxVisible, spriteAvatarOwners),
    [enabledAgentIds, maxVisible, participants, spriteAvatarOwners, summaries],
  );
  useEffect(() => {
    onShownChange?.(
      shown.map(({ participant, kind }) => ({ ownerId: participant.owner.ownerId, name: participant.name, kind })),
    );
  }, [onShownChange, shown]);
  useEffect(() => {
    if (!onShownChange) return;
    return () => onShownChange([]);
  }, [onShownChange]);
  const configQueries = useQueries({
    queries: shown.map(({ participant, saved }) => ({
      queryKey: avatarModelKeys.detail(participant.owner),
      queryFn: () => fetchAvatarModel(participant.owner),
      enabled: saved,
      staleTime: 5 * 60_000,
    })),
  });

  // One director per chat, created only once an avatar shows (it may start downloading the classifier
  // model); it subscribes to its own feeds.
  const showsAvatars = shown.length > 0;
  const [director, setDirector] = useState<AvatarDirector | null>(null);
  useEffect(() => {
    if (!showsAvatars) return;
    const created = createAvatarDirector({ chatId, mode, reducedMotion });
    setDirector(created);
    return () => {
      created.dispose();
      setDirector(null);
    };
  }, [chatId, mode, reducedMotion, showsAvatars]);
  useEffect(() => {
    director?.setParticipants(participants);
  }, [director, participants]);
  // Read the way ChatArea decides to auto-play a Roleplay reply: the avatar then waits for the voice.
  const { data: ttsConfig } = useTTSConfig();
  const voiceAutoplay =
    !!ttsConfig?.enabled && (mode === "roleplay" ? !!ttsConfig.autoplayRP : !!ttsConfig.autoplayGame);
  useEffect(() => {
    director?.setVoiceAutoplay(voiceAutoplay);
  }, [director, voiceAutoplay]);

  const onScreen = useOnScreen(stageRef, shown.length > 0);
  const covered = useChatCovered(stageRef, shown.length > 0);

  // Mounted renderers, keyed by owner id. The loop reads this map; slots add and remove themselves.
  const slotsRef = useRef(new Map<string, StageSlot>());
  const [slotsVersion, setSlotsVersion] = useState(0);
  const setSlot = useCallback((ownerId: string, slot: StageSlot | null) => {
    if (slot) slotsRef.current.set(ownerId, slot);
    else slotsRef.current.delete(ownerId);
    setSlotsVersion((version) => version + 1);
  }, []);

  const paused = effectsPaused || !onScreen || covered;
  useEffect(() => {
    const slots = slotsRef.current;
    for (const slot of slots.values()) slot.renderer.setPaused(paused || !director);
    if (paused || !director || slots.size === 0) return;
    let frameRequest = 0;
    const loopStarted = performance.now();
    // One loop, one clock per avatar: the speaking avatar draws at the talking rate, the others at the idle rate.
    const clocks = new Map<string, AvatarDrawClock>();
    let underLoad = false;
    const tick = (now: number) => {
      frameRequest = requestAnimationFrame(tick);
      let drew = false;
      for (const [ownerId, slot] of slots) {
        let clock = clocks.get(ownerId);
        if (!clock) clocks.set(ownerId, (clock = { lastDrawMs: loopStarted, talking: false, costMs: 0 }));
        if (!avatarDrawDue(clock, now, { phone, underLoad })) continue;
        const started = performance.now();
        const dtMs = Math.min(now - clock.lastDrawMs, 250);
        clock.lastDrawMs = now;
        const frame = applyAvatarFeatures(director.frame(ownerId, now), slot.features, reducedMotion);
        clock.talking = frame.state === "talking";
        slot.renderer.update(frame, dtMs);
        recordAvatarDrawCost(clock, performance.now() - started);
        drew = true;
      }
      if (drew) underLoad = avatarsUnderLoad(clocks.values(), phone);
    };
    frameRequest = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRequest);
  }, [director, paused, phone, reducedMotion, slotsVersion]);

  if (shown.length === 0) return null;

  return (
    <div
      ref={stageRef}
      data-avatar-stage
      data-avatar-paused={paused ? "true" : undefined}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${editing ? "z-[35]" : "z-[5]"}`}
    >
      {shown.map((avatar, position) => {
        const sprites = spritesByOwner.get(ownerKey(avatar.participant.owner));
        const ownerId = avatar.participant.owner.ownerId;
        const ownerSettings = characterVisualSettings?.[ownerId];
        const ownerSide = ownerSettings?.spritePosition ?? side;
        const key = avatarPlacementKey(ownerId);
        const placement = clampSpritePlacement(
          placements?.[key] ??
            placements?.[`${ownerId}:full-body`] ??
            placements?.[ownerId] ??
            getDefaultSpritePlacement(avatar.index, shown.length, ownerSide),
        );
        return (
          <AvatarSlot
            key={`${ownerId}:${avatar.kind}`}
            avatar={avatar}
            savedConfig={avatar.saved ? configQueries[position]?.data : null}
            spriteSetup={spriteSetupFor(sprites)}
            sprites={avatar.kind === "vrm" ? undefined : (sprites ?? null)}
            placementKey={key}
            placement={placement}
            count={shown.length}
            scale={(ownerSettings?.fullBodySpriteScale ?? scale) * scaleMultiplier}
            framing={framings?.[ownerId] ?? "portrait"}
            editing={editing}
            phone={phone}
            reducedMotion={reducedMotion}
            stageRef={stageRef}
            label={t("avatars.stage.avatarLabel", { name: avatar.participant.name })}
            dragLabel={t("ui.chat.charactersprite.dragToMove")}
            releaseLabel={t("ui.chat.charactersprite.releaseToSave")}
            moveHelp={t("avatars.stage.moveHelp")}
            onSlot={setSlot}
            onPlacementChange={onPlacementChange}
          />
        );
      })}
    </div>
  );
}

/** Sizes follow the full-body sprite's, so swapping the sprite for an avatar keeps the scene's scale. */
function avatarSizeClass(count: number) {
  if (count >= 3) {
    return "h-[calc(54vh*var(--avatar-scale))] max-w-[calc(58vw*var(--avatar-scale))] md:h-[calc(50vh*var(--avatar-scale))] md:max-w-[calc(28vw*var(--avatar-scale))]";
  }
  if (count === 2) {
    return "h-[calc(60vh*var(--avatar-scale))] max-w-[calc(64vw*var(--avatar-scale))] md:h-[calc(56vh*var(--avatar-scale))] md:max-w-[calc(34vw*var(--avatar-scale))]";
  }
  return "h-[calc(64vh*var(--avatar-scale))] max-w-[calc(86vw*var(--avatar-scale))] md:h-[calc(62vh*var(--avatar-scale))] md:max-w-[calc(44vw*var(--avatar-scale))]";
}

function AvatarSlot({
  avatar,
  savedConfig,
  spriteSetup,
  sprites,
  placementKey,
  placement,
  count,
  scale,
  framing,
  editing,
  phone,
  reducedMotion,
  stageRef,
  label,
  dragLabel,
  releaseLabel,
  moveHelp,
  onSlot,
  onPlacementChange,
}: {
  avatar: StageAvatar;
  /** The owner's avatar.json: undefined while loading, null when it has none. */
  savedConfig: AvatarConfig | null | undefined;
  /** The PNGTuber setup the owner's expression sprites make, used while none is saved. */
  spriteSetup: PngtuberAvatarData | null;
  /** The owner's sprites for a 2D avatar (null while loading); a mesh avatar falls back to them. Undefined for VRM. */
  sprites: SpriteInfo[] | null | undefined;
  placementKey: string;
  placement: SpritePlacement;
  count: number;
  scale: number;
  framing: AvatarFraming;
  editing: boolean;
  phone: boolean;
  reducedMotion: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  label: string;
  dragLabel: string;
  releaseLabel: string;
  moveHelp: string;
  onSlot: (ownerId: string, slot: StageSlot | null) => void;
  onPlacementChange?: (placementKey: string, placement: SpritePlacement) => void;
}) {
  const { owner } = avatar.participant;
  const { ownerType, ownerId } = owner;
  const config = useMemo(() => {
    if (savedConfig === undefined) return null;
    const shownConfig = withSpriteAvatar({ ownerType, ownerId }, savedConfig, spriteSetup);
    return shownConfig?.enabled ? shownConfig : null;
  }, [ownerId, ownerType, savedConfig, spriteSetup]);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const resolveImage = useMemo(() => {
    if (!config || sprites === null) return null;
    return (ref: AvatarImageRef) => resolveAvatarImage(owner, config, sprites, ref);
  }, [config, owner, sprites]);
  const imagesKey = sprites ? sprites.map((sprite) => sprite.url).join("|") : "";
  const kind: AvatarKind | null = config ? avatar.kind : null;
  const { renderer } = useAvatarRenderer({
    canvas,
    owner,
    config,
    kind,
    resolveImage,
    imagesKey,
    reducedMotion: reducedMotion || config?.features.idleMotion === false,
    phone,
  });
  const features = config?.features;
  // Before the slot joins the stage's loop, so the first frame is already framed.
  useEffect(() => {
    renderer?.setFraming?.(framing);
  }, [framing, renderer]);
  useEffect(() => {
    if (!renderer || !features) return;
    onSlot(owner.ownerId, { renderer, features });
    return () => onSlot(owner.ownerId, null);
  }, [features, onSlot, owner.ownerId, renderer]);

  const {
    placement: current,
    dragging,
    onPointerDown,
    nudgePlacement,
  } = useSpritePlacementDrag({
    placement,
    placementKey,
    editing,
    stageRef,
    onPlacementChange,
  });

  const style = useMemo<CSSProperties>(
    () =>
      ({
        left: `${current.x}%`,
        top: `${current.y}%`,
        zIndex: dragging ? 40 : 10 + avatar.index,
        touchAction: editing ? "none" : "auto",
        "--avatar-scale": Math.max(SPRITE_DISPLAY_SCALE_MIN, Math.min(SPRITE_DISPLAY_SCALE_MAX, scale)),
      }) as CSSProperties,
    [avatar.index, current.x, current.y, dragging, editing, scale],
  );

  return (
    <div
      data-avatar-owner={owner.ownerId}
      data-avatar-kind={avatar.kind}
      data-game-skip-bg-nav={editing ? "true" : undefined}
      className={`absolute -translate-x-1/2 -translate-y-full select-none ${editing ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
      style={style}
      onPointerDown={onPointerDown}
    >
      {editing && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-[2] -translate-x-1/2 -translate-y-[calc(100%+0.35rem)] whitespace-nowrap rounded-full border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-2 py-1 text-[0.5625rem] font-semibold uppercase tracking-wide text-[var(--marinara-chat-chrome-button-text-hover)] shadow-md">
          {dragging ? releaseLabel : dragLabel}
        </div>
      )}
      <canvas
        ref={setCanvas}
        role="img"
        aria-label={label}
        tabIndex={editing ? 0 : undefined}
        title={editing ? moveHelp : undefined}
        aria-keyshortcuts={editing ? "ArrowUp ArrowDown ArrowLeft ArrowRight" : undefined}
        onKeyDown={(event) => {
          if (!editing) return;
          const step = event.shiftKey ? 5 : 1;
          const directions: Record<string, SpritePlacement> = {
            ArrowLeft: { x: -step, y: 0 },
            ArrowRight: { x: step, y: 0 },
            ArrowUp: { x: 0, y: -step },
            ArrowDown: { x: 0, y: step },
          };
          const delta = directions[event.key];
          if (!delta) return;
          event.preventDefault();
          event.stopPropagation();
          nudgePlacement(delta);
        }}
        className={`${avatarSizeClass(count)} block aspect-[3/4] ${editing ? "outline-dashed outline-1 outline-[var(--marinara-chat-chrome-button-border)]" : ""}`}
      />
    </div>
  );
}
