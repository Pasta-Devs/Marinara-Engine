import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { MULTIPLAYER_LIMITS, readMarinaraCardClassic, type MultiplayerPersona } from "@marinara-engine/shared";
import { CharacterSelect } from "../../components/characters/CharacterSelect";
import { ClassicCardSection } from "../../components/overhaul/ClassicCardSection";
import { usePersonas } from "../../hooks/use-characters";

export const MULTIPLAYER_INPUT_CLASS =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)] sm:text-sm";
export const MULTIPLAYER_BUTTON_CLASS =
  "mari-chrome-control !min-h-10 rounded-lg px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50";

/** A library persona's MRPG picks (its Game Mode section), kept in personaStats.classic. */
function personaClassic(stats: unknown): MultiplayerPersona["classic"] {
  let parsed = stats;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }
  return readMarinaraCardClassic((parsed as { classic?: unknown } | null)?.classic);
}

export function MultiplayerPersonaFields({
  value,
  onChange,
  game = false,
}: {
  value: MultiplayerPersona;
  onChange: (value: MultiplayerPersona) => void;
  /** A Game Mode room: the player builds their character's MRPG picks and writes their concept for the
   *  Game Master too (owner 2026-11-06), as a host does on their own persona. */
  game?: boolean;
}) {
  const { t } = useTranslation();
  const { data: personas = [] } = usePersonas();
  const id = useId();
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-picker`} className="block text-xs font-medium">
        {t("multiplayer.persona.choose")}
      </label>
      <CharacterSelect
        kind="persona"
        withCharacters={false}
        variant="picker"
        id={`${id}-picker`}
        value={picked ? { persona: picked } : null}
        placeholder={t("multiplayer.persona.manual")}
        onChange={(choice) => {
          const personaId = choice && "persona" in choice ? choice.persona : null;
          const persona = personas.find((item) => item.id === personaId);
          if (!persona) return;
          setPicked(persona.id);
          // Its MRPG picks only where the form shows them (a Game Mode room): nothing hidden is shared.
          const { classic: _old, ...rest } = value;
          const classic = game ? personaClassic((persona as { personaStats?: unknown }).personaStats) : undefined;
          onChange({
            ...rest,
            name: persona.name.slice(0, 80),
            description: persona.description.slice(0, MULTIPLAYER_LIMITS.description),
            ...(classic ? { classic } : {}),
          });
        }}
      />
      <label htmlFor={`${id}-name`} className="block text-xs font-medium">
        {t("multiplayer.persona.name")}
      </label>
      <input
        id={`${id}-name`}
        value={value.name}
        maxLength={80}
        className={MULTIPLAYER_INPUT_CLASS}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
      />
      <label htmlFor={`${id}-description`} className="block text-xs font-medium">
        {t("multiplayer.persona.description")}
      </label>
      <textarea
        id={`${id}-description`}
        value={value.description}
        maxLength={MULTIPLAYER_LIMITS.description}
        rows={4}
        className={MULTIPLAYER_INPUT_CLASS}
        onChange={(event) => onChange({ ...value, description: event.target.value })}
      />
      {game && (
        <>
          <label htmlFor={`${id}-concept`} className="block text-xs font-medium">
            {t("multiplayer.persona.concept")}
          </label>
          <textarea
            id={`${id}-concept`}
            value={value.concept ?? ""}
            maxLength={MULTIPLAYER_LIMITS.description}
            rows={3}
            placeholder={t("multiplayer.persona.conceptHint")}
            className={MULTIPLAYER_INPUT_CLASS}
            onChange={(event) => {
              const { concept: _old, ...rest } = value;
              onChange(event.target.value ? { ...rest, concept: event.target.value } : rest);
            }}
          />
          <ClassicCardSection
            value={value.classic}
            onChange={(classic) => {
              const { classic: _old, ...rest } = value;
              onChange(classic ? { ...rest, classic } : rest);
            }}
            description={value.description}
          />
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("multiplayer.persona.gmDecides")}</p>
        </>
      )}
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("multiplayer.persona.disclosure")}</p>
    </div>
  );
}
