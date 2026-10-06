// ──────────────────────────────────────────────
// Game: Movable character profiles window
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import { useGameModeStore } from "../../stores/game-mode.store";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import { useMatchMedia } from "../../hooks/use-match-media";
import { useFloatingWindowStore } from "../../stores/floating-window.store";
import { FloatingWindow, PHONE_SHEET_CLASS } from "../ui/FloatingWindow";
import { getChatControlDefaultLayout } from "../chat/ChatControlWindow";

import { useTranslation as useUiTranslation } from "react-i18next";

const CHARACTER_PROFILES_WINDOW_ID = "control:character-profiles";

interface PartyBarMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarCrop?: AvatarCrop | null;
  nameColor?: string;
  canRemove?: boolean;
}

interface PartyBarCard {
  title: string;
  subtitle?: string;
  mood?: string;
  status?: string;
  level?: number;
  avatarUrl?: string | null;
  avatarCrop?: AvatarCrop | null;
  stats?: Array<{ name: string; value: number; max?: number; color?: string }>;
  inventory?: Array<{ name: string; quantity?: number; location?: string }>;
  customFields?: Record<string, string>;
}

interface GamePartyBarProps {
  rowOffset?: number;
  partyMembers: PartyBarMember[];
  partyCards: Record<string, PartyBarCard>;
  onRemovePartyMember?: (member: PartyBarMember) => void;
  removingPartyMemberId?: string | null;
}

type PartyMemberVisual = {
  member: PartyBarMember;
  avatarSrc?: string | null;
  avatarCrop?: AvatarCrop | null;
};

function PartyAvatar({ visual, className }: { visual: PartyMemberVisual; className?: string }) {
  const { member, avatarSrc, avatarCrop } = visual;

  if (avatarSrc) {
    return (
      <span
        className={cn(
          "relative block h-8 w-8 overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-button-border)] shadow-lg shadow-black/25 transition-colors group-hover:border-[var(--marinara-chat-chrome-button-border-hover)]",
          className,
        )}
      >
        <img
          src={avatarSrc}
          alt={member.name}
          className="h-full w-full object-cover"
          style={getAvatarCropStyle(avatarCrop)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-xs font-bold text-[var(--marinara-chat-chrome-button-text-hover)] shadow-lg shadow-black/25 transition-colors group-hover:border-[var(--marinara-chat-chrome-button-border-hover)]",
        className,
      )}
      style={member.nameColor ? { color: member.nameColor } : undefined}
    >
      {member.name[0]}
    </span>
  );
}

export function GamePartyBar({
  rowOffset = 0,
  partyMembers,
  partyCards,
  onRemovePartyMember,
  removingPartyMemberId,
}: GamePartyBarProps) {
  const { t: localizeUi } = useUiTranslation();
  const openCharacterSheet = useGameModeStore((s) => s.openCharacterSheet);
  const reduceAmbientEffects = useReducedAmbientEffects();
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  const [previewIndex, setPreviewIndex] = useState(0);

  const memberVisuals = useMemo(
    () =>
      partyMembers.map((member) => {
        const card = partyCards[member.id];
        return {
          member,
          avatarSrc: card?.avatarUrl ?? member.avatarUrl,
          avatarCrop: card?.avatarCrop ?? member.avatarCrop ?? null,
        };
      }),
    [partyCards, partyMembers],
  );

  useEffect(() => {
    setPreviewIndex((index) => (memberVisuals.length > 0 ? Math.min(index, memberVisuals.length - 1) : 0));
  }, [memberVisuals.length]);

  useEffect(() => {
    if (reduceAmbientEffects || memberVisuals.length <= 1) return undefined;
    const intervalId = window.setInterval(() => {
      setPreviewIndex((index) => (index + 1) % memberVisuals.length);
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [memberVisuals.length, reduceAmbientEffects]);

  if (partyMembers.length === 0) return null;

  const title = localizeUi("game.toolbar.characterProfiles");
  return (
    <FloatingWindow
      id={CHARACTER_PROFILES_WINDOW_ID}
      title={title}
      titleIcon={<Users size={16} />}
      closeLabel={localizeUi("window.controls.close")}
      presentation={phoneLayout ? "sheet" : "window"}
      sheetClassName={PHONE_SHEET_CLASS}
      minimizable={{
        icon: memberVisuals[previewIndex] ? (
          <PartyAvatar visual={memberVisuals[previewIndex]} className="h-6 w-6" />
        ) : (
          <Users size={16} />
        ),
        label: title,
        bubbleBadge:
          memberVisuals.length > 1 ? (
            <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-lg bg-[var(--mari-window-bg,var(--background))] px-1 text-[0.625rem] font-bold ring-1 ring-[var(--border)]">
              {memberVisuals.length}
            </span>
          ) : undefined,
        phoneMenu: false,
        getPhoneBubble: (bounds, size) => ({ x: bounds.left + size + 12, y: bounds.top + rowOffset }),
      }}
      getDefaultLayout={(bounds, bubbleSize) =>
        getChatControlDefaultLayout(bounds, 5, { width: 320, height: 200 }, rowOffset, bubbleSize)
      }
      defaultLayoutKey={String(rowOffset)}
      minWidth={220}
      minHeight={120}
      autoFocus={false}
      className={cn("marinara-chat-popover", NEUTRAL_SURFACE_VARIABLES)}
      rootAttributes={{ "data-tour": "game-party", "data-chat-help": "game-party", "data-game-skip-bg-nav": true }}
    >
      <div className="flex min-h-0 flex-1 flex-wrap content-start items-start gap-3 overflow-y-auto overscroll-contain p-3">
        {memberVisuals.map((visual) => {
          const { member } = visual;

          return (
            <div
              key={member.id}
              className="group relative shrink-0 origin-left transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-[0.98]"
            >
              <button
                type="button"
                onClick={() => {
                  useFloatingWindowStore.getState().minimizeWindow(CHARACTER_PROFILES_WINDOW_ID);
                  openCharacterSheet(member.id);
                }}
                className="flex max-w-24 flex-col items-center gap-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                title={localizeUi("ui.game.gamepartybar.value1ClickToOpenCharacterSheet", { value1: member.name })}
              >
                <PartyAvatar visual={visual} />
                <span className="max-w-full truncate text-xs">{member.name}</span>
              </button>
              {member.canRemove && onRemovePartyMember && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemovePartyMember(member);
                  }}
                  disabled={removingPartyMemberId === member.id}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text-hover)] opacity-80 shadow-md transition-opacity hover:bg-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-60 group-hover:opacity-100 focus:opacity-100 md:opacity-0"
                  aria-label={localizeUi("ui.game.gamepartybar.removeValue1FromParty", { value1: member.name })}
                  title={localizeUi("ui.game.gamepartybar.removeValue1FromParty", { value1: member.name })}
                >
                  <X className="h-2.5 w-2.5" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </FloatingWindow>
  );
}
