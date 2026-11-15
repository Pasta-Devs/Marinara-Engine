// Pieces the Characters, Persona and Game party sections all use.
import { PROFESSOR_MARI_ID, type AvatarCrop } from "@marinara-engine/shared";
import { User } from "lucide-react";
import { cn, getAvatarCropStyle } from "../../../lib/utils";

export const PICKER_EXCLUDED_IDS = [PROFESSOR_MARI_ID];

/** A character card as Chat Settings reads it from the library list. */
export type CastCharacter = {
  id: string;
  data: string;
  comment?: string | null;
  avatarPath: string | null;
};

/** Anything with card data a name, title or avatar crop can be read from. */
export type CastCardLike = { id?: string; data: string | Record<string, unknown>; comment?: string | null };

export const CHAT_RESOURCE_REMOVE_BUTTON_CLASS =
  "mari-accent-animated flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-accent)] focus-visible:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] focus-visible:text-[var(--marinara-chat-chrome-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

type DrawerPersona = {
  id: string;
  name: string;
  comment: string;
  avatarPath: string | null;
  avatarCrop?: AvatarCrop | null;
};

export function DrawerPersonaAvatar({ persona, size = "sm" }: { persona: DrawerPersona; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "h-7 w-7" : "h-6 w-6";

  if (!persona.avatarPath) {
    return (
      <div
        className={cn(
          "mari-avatar-placeholder mari-avatar-placeholder--persona flex shrink-0 items-center justify-center rounded-full",
          sizeClass,
        )}
      >
        <User size={size === "md" ? "0.75rem" : "0.625rem"} />
      </div>
    );
  }

  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-full", sizeClass)}>
      <img
        src={persona.avatarPath}
        alt={persona.name}
        loading="lazy"
        className="h-full w-full object-cover"
        style={getAvatarCropStyle(persona.avatarCrop)}
      />
    </span>
  );
}
