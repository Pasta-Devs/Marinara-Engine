// ──────────────────────────────────────────────
// Game: Compact Party Portraits Bar (top-left, horizontal)
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useGameModeStore } from "../../stores/game-mode.store";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";

interface PartyBarMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarCrop?: AvatarCropValue | null;
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
  avatarCrop?: AvatarCropValue | null;
  stats?: Array<{ name: string; value: number; max?: number; color?: string }>;
  inventory?: Array<{ name: string; quantity?: number; location?: string }>;
  customFields?: Record<string, string>;
}

interface GamePartyBarProps {
  partyMembers: PartyBarMember[];
  partyCards: Record<string, PartyBarCard>;
  onRemovePartyMember?: (member: PartyBarMember) => void;
  removingPartyMemberId?: string | null;
}

type PartyMemberVisual = {
  member: PartyBarMember;
  avatarSrc?: string | null;
  avatarCrop?: AvatarCropValue | null;
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
  partyMembers,
  partyCards,
  onRemovePartyMember,
  removingPartyMemberId,
}: GamePartyBarProps) {
  const openCharacterSheet = useGameModeStore((s) => s.openCharacterSheet);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

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
    if (memberVisuals.length <= 1) setMobileMenuOpen(false);
  }, [memberVisuals.length]);

  useEffect(() => {
    if (memberVisuals.length <= 1) return undefined;
    const intervalId = window.setInterval(() => {
      setPreviewIndex((index) => (index + 1) % memberVisuals.length);
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [memberVisuals.length]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (mobileMenuRef.current?.contains(target)) return;
      setMobileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileMenuOpen]);

  if (partyMembers.length === 0) return null;

  return (
    <>
      <div ref={mobileMenuRef} className="relative shrink-0 md:hidden">
        {memberVisuals[previewIndex] && (
          <button
            type="button"
            onClick={() => {
              if (memberVisuals.length === 1) {
                openCharacterSheet(memberVisuals[0].member.id);
                return;
              }
              setMobileMenuOpen((open) => !open);
            }}
            className="group relative block rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close party members" : "Open party members"}
            title={memberVisuals.length === 1 ? "Open character sheet" : "Open party members"}
          >
            <PartyAvatar visual={memberVisuals[previewIndex]} />
            {memberVisuals.length > 1 && (
              <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-1 text-[0.55rem] font-bold leading-none text-[var(--marinara-chat-chrome-button-text-hover)] shadow-md">
                {memberVisuals.length}
              </span>
            )}
          </button>
        )}

        {mobileMenuOpen && memberVisuals.length > 1 && (
          <div
            className={cn(
              NEUTRAL_SURFACE_VARIABLES,
              "marinara-chat-popover absolute left-0 top-9 z-50 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-1.5 shadow-2xl backdrop-blur-md",
            )}
          >
            <div className="flex max-h-[min(44svh,18rem)] flex-col items-center gap-1.5 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
              {memberVisuals.map((visual) => (
                <div key={visual.member.id} className="group relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      openCharacterSheet(visual.member.id);
                      setMobileMenuOpen(false);
                    }}
                    className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                    title={`${visual.member.name} - Click to open character sheet`}
                  >
                    <PartyAvatar visual={visual} />
                  </button>
                  {visual.member.canRemove && onRemovePartyMember && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemovePartyMember(visual.member);
                      }}
                      disabled={removingPartyMemberId === visual.member.id}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text-hover)] shadow-md transition-colors hover:bg-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Remove ${visual.member.name} from party`}
                      title={`Remove ${visual.member.name} from party`}
                    >
                      <X className="h-2.5 w-2.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="scrollbar-hide hidden max-w-full touch-pan-x items-center gap-1.5 overflow-x-auto px-0.5 py-1 [-webkit-overflow-scrolling:touch] md:flex">
        {memberVisuals.map((visual) => {
          const { member } = visual;

          return (
            <div
              key={member.id}
              className="group relative shrink-0 origin-left transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-[0.98]"
            >
              <button
                type="button"
                onClick={() => openCharacterSheet(member.id)}
                className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                title={`${member.name} - Click to open character sheet`}
              >
                <PartyAvatar visual={visual} />
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
                  aria-label={`Remove ${member.name} from party`}
                  title={`Remove ${member.name} from party`}
                >
                  <X className="h-2.5 w-2.5" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
