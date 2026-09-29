import { useId } from "react";
import { useTranslation } from "react-i18next";
import { MULTIPLAYER_LIMITS, type MultiplayerPersona } from "@marinara-engine/shared";
import { usePersonas } from "../../hooks/use-characters";

export const MULTIPLAYER_INPUT_CLASS =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)] sm:text-sm";
export const MULTIPLAYER_BUTTON_CLASS =
  "mari-chrome-control !min-h-10 rounded-lg px-3 py-2 text-xs !text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50";

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
  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-picker`} className="block text-xs font-medium">
        {t("multiplayer.persona.choose")}
      </label>
      <select
        id={`${id}-picker`}
        className={MULTIPLAYER_INPUT_CLASS}
        defaultValue=""
        onChange={(event) => {
          const persona = personas.find((item) => item.id === event.target.value);
          if (persona)
            onChange({
              name: persona.name.slice(0, 80),
              description: persona.description.slice(0, MULTIPLAYER_LIMITS.description),
            });
        }}
      >
        <option value="">{t("multiplayer.persona.manual")}</option>
        {personas.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.name}
          </option>
        ))}
      </select>
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
