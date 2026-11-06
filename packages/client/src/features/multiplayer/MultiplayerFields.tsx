import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { MULTIPLAYER_LIMITS, type MultiplayerPersona } from "@marinara-engine/shared";
import { CharacterSelect } from "../../components/characters/CharacterSelect";
import { usePersonas } from "../../hooks/use-characters";

export const MULTIPLAYER_INPUT_CLASS =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)] sm:text-sm";
export const MULTIPLAYER_BUTTON_CLASS =
  "mari-chrome-control !min-h-10 rounded-lg px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50";

export function MultiplayerPersonaFields({
  value,
  onChange,
}: {
  value: MultiplayerPersona;
  onChange: (value: MultiplayerPersona) => void;
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
          onChange({
            name: persona.name.slice(0, 80),
            description: persona.description.slice(0, MULTIPLAYER_LIMITS.description),
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
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("multiplayer.persona.disclosure")}</p>
    </div>
  );
}
