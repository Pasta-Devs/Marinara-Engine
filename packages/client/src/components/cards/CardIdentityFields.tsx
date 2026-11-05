import { useTranslation } from "react-i18next";
import { HelpTooltip } from "../ui/HelpTooltip";
import { MariFieldReview } from "../characters/MariFieldReview";

type Kind = "character" | "persona";
type Fields = { name: string; comment: string; creator: string; phoneticName?: string };

export function CardIdentityFields({
  kind,
  fields,
  onChange,
}: {
  kind: Kind;
  fields: Fields;
  onChange: (field: keyof Fields, value: string) => void;
}) {
  const { t } = useTranslation();
  const character = kind === "character";
  const entries = [
    {
      key: "name",
      label: character ? t("ui.characters.metadatatab.name") : t("ui.personas.personastatstab.name"),
      help: character
        ? t("ui.characters.metadatatab.theCharacterSDisplayNameThisIsWhatAppears")
        : t("ui.personas.personametadatatab.yourPersonaSDisplayNameThisIsInjectedInto"),
      placeholder: character ? undefined : t("ui.personas.personaeditor.personaName"),
    },
    {
      key: "comment",
      label: character ? t("ui.characters.metadatatab.titleComment") : t("ui.personas.personametadatatab.titleComment"),
      help: character
        ? t("ui.characters.metadatatab.aShortNoteShownUnderTheCharacterNameIn")
        : t("ui.personas.personametadatatab.aShortNoteShownUnderThePersonaNameIn"),
      placeholder: character
        ? t("ui.characters.metadatatab.modernAuVersion")
        : t("ui.personas.personametadatatab.modernAuVersion"),
    },
    ...(!character
      ? [
          {
            key: "phoneticName" as const,
            label: t("ui.personas.personametadatatab.phoneticName"),
            help: t("ui.personas.personametadatatab.optionalPronunciationOverrideUsedOnlyWhenYourPersonaName"),
            placeholder: fields.name,
          },
        ]
      : []),
    {
      key: "creator",
      label: character ? t("ui.characters.metadatatab.creator") : t("ui.personas.personametadatatab.creator"),
      help: character
        ? t("ui.characters.metadatatab.thePersonWhoMadeThisCharacterUsefulForGiving")
        : t("ui.personas.personametadatatab.thePersonWhoMadeThisPersonaUsefulForCredit"),
      placeholder: character ? t("ui.characters.metadatatab.yourName") : t("ui.personas.personametadatatab.yourName"),
    },
  ] as const;
  return (
    <>
      {entries.map(({ key, label, help, placeholder }) => {
        const review = !(character && key === "comment");
        const input = (
          <input
            value={fields[key] ?? ""}
            onChange={(event) => onChange(key, event.target.value)}
            onBlur={
              character && key === "name"
                ? () => {
                    const trimmed = fields.name.trim();
                    if (trimmed !== fields.name) onChange("name", trimmed);
                  }
                : undefined
            }
            placeholder={placeholder}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          />
        );
        return (
          <label
            key={key}
            className={key === "name" || key === "comment" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}
            data-mari-field={review ? key : undefined}
          >
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
              {label} <HelpTooltip text={help} />
            </span>
            {review ? <MariFieldReview field={key}>{input}</MariFieldReview> : input}
          </label>
        );
      })}
    </>
  );
}
