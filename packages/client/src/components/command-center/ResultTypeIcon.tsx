import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

import { RESULT_TYPE_ICONS, type ResultType } from "@/lib/command-icons";
import { cn } from "@/lib/utils";

import { CommandCenterMedia, type CommandCenterMediaKind } from "./CommandCenterMedia";
import { getValidatedCommandCenterAccent } from "./command-center-visuals";

export interface ResultTypeFace {
  src?: string | null;
  avatarCropStyle?: CSSProperties;
}

const FACE_POSITIONS: Record<number, string[]> = {
  2: ["left-0 top-0 size-6", "bottom-0 right-0 size-6"],
  3: ["left-0 top-0 size-5", "right-0 top-0 size-5", "bottom-0 left-0 size-5"],
};

/**
 * Q6: what a row, card or chip is, at a glance. One component for the omnibar rows, Mari's
 * reference, outcome and next-step cards, the "Aware of" chips and her Chats panel.
 *
 * - A portrait (`src`) keeps its picture and gets the type as a small corner badge.
 * - Several participants (`faces`, a chat's characters) stack in the same slot: two faces, or
 *   two plus a "+N" once there are more than three.
 * - Anything without a picture shows its type icon in that slot, so mixed lists stay aligned.
 * - `glyph` is the bare icon, for chips and tiles that already draw their own frame.
 *
 * `icon` overrides the type's icon for a command that names its own (Home, Backups); with no
 * `type` there is no badge.
 */
export function ResultTypeIcon({
  type,
  icon,
  src,
  kind = "image",
  avatarCropStyle,
  accent,
  faces,
  faceCount = faces?.length ?? 0,
  glyph = false,
  className,
}: {
  type?: ResultType;
  icon?: LucideIcon;
  src?: string | null;
  kind?: CommandCenterMediaKind;
  avatarCropStyle?: CSSProperties;
  accent?: string | null;
  faces?: readonly ResultTypeFace[];
  faceCount?: number;
  glyph?: boolean;
  className?: string;
}) {
  const TypeIcon = type ? RESULT_TYPE_ICONS[type] : undefined;
  const Icon = icon ?? TypeIcon ?? RESULT_TYPE_ICONS.command;
  if (glyph) return <Icon aria-hidden="true" data-result-type={type} className={cn("shrink-0", className)} />;

  const stacked = faceCount > 1 && (faces?.length ?? 0) > 0;
  // More than three: two faces and the rest as "+N", so the slot never holds more than three things.
  const shown = stacked ? (faces ?? []).slice(0, faceCount > 3 ? 2 : 3) : [];
  const overflow = stacked && faceCount > 3 ? faceCount - 2 : 0;
  const slots = shown.length + (overflow ? 1 : 0);
  const positions = FACE_POSITIONS[slots] ?? FACE_POSITIONS[2]!;
  const badged = Boolean(TypeIcon && (stacked || src));
  const badgeAccent = badged ? getValidatedCommandCenterAccent(accent) : undefined;

  return (
    <span
      aria-hidden="true"
      data-result-type={type}
      className={cn("result-type-icon relative inline-flex size-9 shrink-0", className)}
    >
      {stacked ? (
        <>
          {shown.map((face, index) => (
            <CommandCenterMedia
              key={index}
              size="row"
              icon={RESULT_TYPE_ICONS.character}
              src={face.src}
              kind="avatar"
              avatarCropStyle={face.avatarCropStyle}
              className={cn("result-type-icon__face absolute", positions[index])}
            />
          ))}
          {overflow ? (
            <span className={cn("result-type-icon__face result-type-icon__more absolute", positions[slots - 1])}>
              +{overflow}
            </span>
          ) : null}
        </>
      ) : (
        <CommandCenterMedia
          size="row"
          icon={Icon}
          src={src}
          kind={kind}
          avatarCropStyle={avatarCropStyle}
          accent={badged ? undefined : accent}
          className="size-full"
        />
      )}
      {badged && TypeIcon ? (
        <span
          className="result-type-icon__badge"
          style={badgeAccent ? { color: badgeAccent } : undefined}
          data-component="ResultTypeIcon.Badge"
        >
          <TypeIcon strokeWidth={2.2} />
        </span>
      ) : null}
    </span>
  );
}
