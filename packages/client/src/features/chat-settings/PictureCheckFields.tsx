// ──────────────────────────────────────────────
// Picture check: a decision model that reads pictures checks each picture
// the Illustrator or a selfie makes, and makes another when it doesn't match.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { AgentSettingsToggle } from "../../components/chat/AgentSettingsControls";
import { VisionDecisionHint } from "../../components/ui/VisionDecisionHint";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { useDecisionReadsPictures } from "../../hooks/use-decision-model";

const MODES = ["off", "retry", "best_of_two"] as const;
type PictureCheckMode = (typeof MODES)[number];

const normalizeMode = (value: unknown): PictureCheckMode =>
  value === "retry" || value === "best_of_two" ? value : "off";

/** One setting for the chat's pictures, shown in the Illustrator card and the selfie settings. */
export function PictureCheckFields({
  chatId,
  metadata,
  illustrator = false,
}: {
  chatId: string;
  metadata: Record<string, unknown>;
  /** The Illustrator card also offers skipping a picture the newest one already shows. */
  illustrator?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const readsPictures = useDecisionReadsPictures();
  const mode = normalizeMode(metadata.pictureCheck);
  const savedLines = typeof metadata.pictureCheckLines === "string" ? metadata.pictureCheckLines : "";
  const [lines, setLines] = useState(savedLines);
  const skipShown = metadata.illustratorSkipShownScene === true;
  const reuseByLooking = metadata.illustratorReuseByLooking === true;
  useEffect(() => setLines(savedLines), [savedLines]);
  return (
    <div className="flex flex-col gap-1">
      {/* The ⓘ stays outside the greyed-out control so it can still be opened. */}
      <span className="flex items-center gap-1 text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.pictureCheck.label")}
        {!readsPictures && <VisionDecisionHint size="0.625rem" />}
      </span>
      <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.pictureCheck.help")}
      </span>
      <select
        aria-label={localizeUi("ui.chat.pictureCheck.label")}
        value={mode}
        // Greyed out without a model that reads pictures; a stored choice can still be turned off.
        disabled={!readsPictures && mode === "off"}
        onChange={(e) => updateMeta.mutate({ id: chatId, pictureCheck: normalizeMode(e.target.value) })}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50 disabled:opacity-50"
      >
        {MODES.map((option) => (
          <option key={option} value={option} disabled={!readsPictures && option !== "off"}>
            {localizeUi(`ui.chat.pictureCheck.mode.${option}`)}
          </option>
        ))}
      </select>
      {illustrator && (
        <>
          <VisionSwitch
            readsPictures={readsPictures}
            checked={skipShown}
            onChange={(checked) => updateMeta.mutate({ id: chatId, illustratorSkipShownScene: checked })}
            label={localizeUi("ui.chat.pictureCheck.skipShown")}
            help={localizeUi("ui.chat.pictureCheck.skipShownHelp")}
          />
          <VisionSwitch
            readsPictures={readsPictures}
            checked={reuseByLooking}
            onChange={(checked) => updateMeta.mutate({ id: chatId, illustratorReuseByLooking: checked })}
            label={localizeUi("ui.chat.pictureCheck.reuseByLooking")}
            help={localizeUi("ui.chat.pictureCheck.reuseByLookingHelp")}
          />
        </>
      )}
      {mode !== "off" && (
        <label className="mt-1 flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.pictureCheck.lines")}
          </span>
          <textarea
            value={lines}
            rows={3}
            maxLength={1500}
            disabled={!readsPictures}
            placeholder={localizeUi("ui.chat.pictureCheck.linesPlaceholder")}
            onChange={(e) => setLines(e.target.value)}
            onBlur={() => {
              if (lines !== savedLines) updateMeta.mutate({ id: chatId, pictureCheckLines: lines });
            }}
            className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]/50 disabled:opacity-50"
          />
          <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.pictureCheck.linesHelp")}
          </span>
        </label>
      )}
    </div>
  );
}

/** A switch greyed out, with an ⓘ, without a decision model that reads pictures; one left on can still be turned off. */
function VisionSwitch({
  readsPictures,
  checked,
  onChange,
  label,
  help,
}: {
  readsPictures: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <div className="mt-1">
      <AgentSettingsToggle
        label={label}
        description={help}
        enabled={checked}
        onToggle={() => onChange(!checked)}
        disabled={!readsPictures && !checked}
        endAction={!readsPictures ? <VisionDecisionHint /> : undefined}
      />
    </div>
  );
}
