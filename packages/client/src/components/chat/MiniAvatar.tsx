// Small profile picture that leads the name on phones (Settings > Appearance > Profile pictures on
// phones: Mini). Hidden everywhere else by CSS; see `.mari-mini-avatar` in overhaul-mobile.css.
// Persona pictures sit to the right of the name, character pictures to the left.
import type React from "react";
import { avatarInitial } from "../../lib/avatar-initial";

export function MiniAvatar({
  url,
  name,
  isUser,
  cropStyle,
  onOpen,
  label,
}: {
  url: string | null | undefined;
  name: string;
  isUser: boolean;
  cropStyle?: React.CSSProperties;
  onOpen?: (anchor: HTMLElement) => void;
  label?: string;
}) {
  const face = url ? (
    <img src={url} alt="" loading="lazy" decoding="async" style={cropStyle} />
  ) : (
    <span className="mari-mini-avatar__initial" aria-hidden="true">
      {avatarInitial(name)}
    </span>
  );
  const props = {
    className: "mari-mini-avatar",
    "data-mari-part": "mini-avatar",
    "data-role": isUser ? "user" : "assistant",
  } as const;
  if (!onOpen) {
    return (
      <span {...props} aria-hidden="true">
        {face}
      </span>
    );
  }
  return (
    <button
      type="button"
      {...props}
      aria-label={label ?? name}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(event.currentTarget);
      }}
    >
      {face}
    </button>
  );
}
