// ──────────────────────────────────────────────
// Chat Settings → Agents → Avatars: arrange, size and frame the chat's 2D and 3D avatars
// ──────────────────────────────────────────────
// The Expression Engine's sprite layout controls, for avatars. Arrange turns dragging on and off on the stage
// (which has no controls of its own); the size and framing apply to the picked avatar. Layouts are saved per chat
// on this device, next to the sprites' layout.
import { useState } from "react";
import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AVATAR_FRAMINGS, type AvatarFraming } from "../../features/avatars/contract";
import type { StageAvatarSummary } from "../../features/avatars/stage/avatar-stage-logic";
import { AgentSettingsActionButton, AgentSettingsSegmentedControl, SpriteRangeSlider } from "./AgentSettingsControls";
import { SPRITE_DISPLAY_SCALE_PERCENT_MAX, SPRITE_DISPLAY_SCALE_PERCENT_MIN } from "./sprite-display-modes";

export interface AvatarLayoutControls {
  /** The avatars the chat's stage shows. */
  avatars: readonly StageAvatarSummary[];
  /** Each shown avatar's size (1 is 100%), by owner id. */
  scales: Readonly<Record<string, number>>;
  /** Each 3D avatar's framing, by owner id (portrait when unset). */
  framings: Readonly<Record<string, AvatarFraming>>;
  /** An avatar has a saved position. */
  hasPlacements: boolean;
  arranging: boolean;
  onToggleArrange: () => void;
  onScaleChange: (ownerId: string, scale: number) => void;
  onFramingChange: (ownerId: string, framing: AvatarFraming) => void;
  onResetPlacements: () => void;
}

const FRAMING_LABEL_KEYS: Record<AvatarFraming, string> = {
  portrait: "avatars.layout.framing.portrait",
  "half-body": "avatars.layout.framing.halfBody",
  "full-body": "avatars.layout.framing.fullBody",
};

export function AvatarLayoutSettings({ chatId, layout }: { chatId: string; layout: AvatarLayoutControls }) {
  const { t: localizeUi } = useTranslation();
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const selected = layout.avatars.find((avatar) => avatar.ownerId === selectedOwnerId) ?? layout.avatars[0];

  if (!selected) {
    return <p className="text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("avatars.layout.none")}</p>;
  }

  const selectId = `avatar-layout-avatar-${chatId}`;
  return (
    <div className="rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
      <div className="flex items-center gap-2">
        <UserRound size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span className="flex-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("avatars.layout.title")}
        </span>
        <AgentSettingsActionButton
          onClick={layout.onToggleArrange}
          variant={layout.arranging ? "primary" : "default"}
          aria-pressed={layout.arranging}
        >
          {layout.arranging
            ? localizeUi("lorebook.editor.batch.done")
            : localizeUi("ui.chat.chatsettingsdrawer.arrange")}
        </AgentSettingsActionButton>
        <AgentSettingsActionButton onClick={layout.onResetPlacements} disabled={!layout.hasPlacements}>
          {localizeUi("ui.characters.charactercliptrimmodal.reset")}
        </AgentSettingsActionButton>
      </div>

      <div className="mt-2 flex flex-col gap-2 @lg:flex-row @lg:items-center">
        <label htmlFor={selectId} className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("editor.avatar.label")}
        </label>
        <select
          id={selectId}
          value={selected.ownerId}
          onChange={(event) => setSelectedOwnerId(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[0.625rem] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/60"
        >
          {layout.avatars.map((avatar) => (
            <option key={avatar.ownerId} value={avatar.ownerId}>
              {avatar.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <SpriteRangeSlider
          label={localizeUi("avatars.stage.size", { name: selected.name })}
          value={Math.round((layout.scales[selected.ownerId] ?? 1) * 100)}
          min={SPRITE_DISPLAY_SCALE_PERCENT_MIN}
          max={SPRITE_DISPLAY_SCALE_PERCENT_MAX}
          step={5}
          suffix="%"
          onChange={(percent) => layout.onScaleChange(selected.ownerId, percent / 100)}
        />
      </div>

      {selected.kind === "vrm" && (
        <div className="mt-2 flex flex-col gap-2 @lg:flex-row @lg:items-center">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("avatars.layout.framing")}
          </span>
          <div className="min-w-0 flex-1">
            <AgentSettingsSegmentedControl<AvatarFraming>
              value={layout.framings[selected.ownerId] ?? "portrait"}
              columns={3}
              options={AVATAR_FRAMINGS.map((framing) => ({
                id: framing,
                label: localizeUi(FRAMING_LABEL_KEYS[framing]),
              }))}
              onChange={(framing) => layout.onFramingChange(selected.ownerId, framing)}
            />
          </div>
        </div>
      )}

      <p className="mt-2 text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
        {localizeUi("avatars.layout.help")}
      </p>
    </div>
  );
}
