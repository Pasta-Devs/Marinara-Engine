import type { CSSProperties, ReactNode } from "react";
import type { AvatarCrop, PartyDialogueLine } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { formatNarration } from "./game-narration-format";

/** Build inline style for a color that may be a plain color or a CSS gradient. */
export function nameColorStyle(color?: string): CSSProperties | undefined {
  if (!color) return undefined;
  if (color.includes("gradient(")) {
    return {
      backgroundImage: color,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      color: "transparent",
      display: "inline-block",
    };
  }
  return { color };
}

export type SpeakerAvatarInfo = {
  url: string;
  crop?: AvatarCrop | null;
  nameColor?: string;
  dialogueColor?: string;
};

export function CroppedAvatar({
  src,
  alt,
  crop,
  className,
  onLoadError,
}: {
  src: string;
  alt: string;
  crop?: AvatarCrop | null;
  className?: string;
  onLoadError?: () => void;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        style={getAvatarCropStyle(crop)}
        onError={onLoadError}
      />
    </div>
  );
}

export function PartyOverlayBox({
  line,
  avatar,
  color,
  nameColor,
  voiceControl,
  translation,
}: {
  line: PartyDialogueLine;
  avatar: SpeakerAvatarInfo | null;
  color?: string;
  nameColor?: string;
  voiceControl?: ReactNode;
  translation?: ReactNode;
}) {
  const styleByType: Record<string, { border: string; bg: string; icon: string; labelColor: string }> = {
    side: { border: "border-white/15", bg: "bg-black/75", icon: "💬", labelColor: "text-white/85" },
    extra: { border: "border-white/15", bg: "bg-black/75", icon: "💬", labelColor: "text-white/85" },
    thought: { border: "border-purple-400/20", bg: "bg-purple-950/70", icon: "💭", labelColor: "text-purple-200/80" },
    whisper: {
      border: "border-[var(--marinara-chat-chrome-button-border)]",
      bg: "bg-[var(--marinara-chat-chrome-panel-bg)]",
      icon: "🤫",
      labelColor: "text-[var(--marinara-chat-chrome-panel-text)]",
    },
  };
  const style = styleByType[line.type] ?? styleByType.side!;

  return (
    <div
      className={cn(
        "experience-side-line isolate flex w-fit min-w-0 max-w-full transform-gpu items-start gap-2 rounded-xl border bg-clip-padding px-3 py-2 sm:max-w-[75%]",
        (line.type === "side" || line.type === "extra") && "shadow-[0_16px_38px_rgba(0,0,0,0.45)]",
        style.border,
        style.bg,
      )}
      data-line-type={line.type}
    >
      {avatar ? (
        <CroppedAvatar
          src={avatar.url}
          alt={line.character}
          crop={avatar.crop}
          className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-white/15"
        />
      ) : (
        <img
          src="/npc-silhouette.svg"
          alt={line.character}
          className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-white/15 object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[0.5625rem]">{style.icon}</span>
          <span
            className={cn("min-w-0 truncate text-[0.6875rem] font-semibold", style.labelColor)}
            style={nameColorStyle(nameColor ?? color)}
          >
            {line.character}
          </span>
          {line.type === "whisper" && line.target && (
            <span className="min-w-0 truncate text-[0.5625rem] text-white/40">→ {line.target}</span>
          )}
          {voiceControl}
        </div>
        <div className="mt-0.5 min-w-0">
          <p
            className={cn(
              "text-xs leading-relaxed text-white/75 whitespace-normal break-words [overflow-wrap:anywhere]",
              line.type === "thought" && "italic opacity-80",
              line.type === "whisper" && "italic",
            )}
            style={(line.type === "side" || line.type === "extra") && color ? { color } : undefined}
            dangerouslySetInnerHTML={{ __html: formatNarration(line.content, false) }}
          />
          {translation}
        </div>
      </div>
    </div>
  );
}

type ExpressionReactionEffect =
  | "pop"
  | "anger"
  | "sparkle"
  | "heart"
  | "tear"
  | "stress"
  | "thought"
  | "focus"
  | "sleep";

const EXPRESSION_REACTIONS: Record<string, { symbol: string; color: string; effect: ExpressionReactionEffect }> = {
  angry: { symbol: "❗", color: "text-red-400", effect: "anger" },
  furious: { symbol: "‼️", color: "text-red-500", effect: "anger" },
  annoyed: { symbol: "💢", color: "text-red-400", effect: "anger" },
  irritated: { symbol: "💢", color: "text-orange-400", effect: "anger" },
  confused: { symbol: "❓", color: "text-yellow-300", effect: "pop" },
  surprised: { symbol: "❗", color: "text-yellow-300", effect: "pop" },
  shocked: { symbol: "‼️", color: "text-yellow-400", effect: "pop" },
  happy: { symbol: "✨", color: "text-amber-300", effect: "sparkle" },
  amused: { symbol: "✨", color: "text-amber-300", effect: "sparkle" },
  delighted: { symbol: "✨", color: "text-yellow-300", effect: "sparkle" },
  mischievous: { symbol: "😈", color: "text-purple-300", effect: "pop" },
  flirty: { symbol: "💗", color: "text-[var(--marinara-chat-chrome-panel-text)]", effect: "heart" },
  tender: { symbol: "💕", color: "text-[var(--marinara-chat-chrome-panel-text)]", effect: "heart" },
  loving: { symbol: "💕", color: "text-[var(--marinara-chat-chrome-panel-text)]", effect: "heart" },
  sad: { symbol: "💧", color: "text-blue-300", effect: "tear" },
  crying: { symbol: "💧", color: "text-blue-400", effect: "tear" },
  scared: { symbol: "💦", color: "text-sky-300", effect: "stress" },
  worried: { symbol: "💦", color: "text-sky-300", effect: "stress" },
  nervous: { symbol: "💦", color: "text-sky-300", effect: "stress" },
  thinking: { symbol: "💭", color: "text-white/70", effect: "thought" },
  smirk: { symbol: "✧", color: "text-amber-300", effect: "sparkle" },
  smug: { symbol: "✧", color: "text-amber-400", effect: "sparkle" },
  determined: { symbol: "🔥", color: "text-orange-400", effect: "focus" },
  battle_stance: { symbol: "⚔️", color: "text-orange-300", effect: "focus" },
  cold: { symbol: "❄️", color: "text-sky-300", effect: "sparkle" },
  disgusted: { symbol: "💢", color: "text-green-400", effect: "anger" },
  deadpan: { symbol: "…", color: "text-white/40", effect: "pop" },
  eye_roll: { symbol: "…", color: "text-white/40", effect: "pop" },
  bored: { symbol: "💤", color: "text-white/40", effect: "sleep" },
};

export function ExpressionReaction({ expression }: { expression?: string }) {
  if (!expression) return null;
  const key = expression.toLowerCase().replace(/[_\s-]/g, "_");
  const reaction = EXPRESSION_REACTIONS[key];
  if (!reaction) return null;

  return (
    <div
      className={cn(
        "game-expression-reaction absolute -right-1 -top-1 sm:-right-2 sm:-top-2",
        `game-expression-reaction--${reaction.effect}`,
        reaction.color,
      )}
    >
      <span className="game-expression-reaction__halo" />
      <span className="game-expression-reaction__symbol">{reaction.symbol}</span>
      {reaction.effect === "thought" && (
        <>
          <span className="game-expression-reaction__bubble game-expression-reaction__bubble--one" />
          <span className="game-expression-reaction__bubble game-expression-reaction__bubble--two" />
        </>
      )}
      {reaction.effect === "tear" && <span className="game-expression-reaction__drop" />}
    </div>
  );
}
