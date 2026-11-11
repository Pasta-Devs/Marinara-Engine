import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { HelpTooltip } from "./HelpTooltip";

/**
 * "Other names" (stored as `nameAliases`): nicknames, full names and titles a card also goes by.
 * Sits under Name in the Metadata tab of the character and persona editors, styled like the
 * identity labels around it (`cards/CardIdentityFields.tsx`) and the Tags field on the same tab
 * (chips, comma-separated input, Add button: `CharacterEditor.tsx` MetadataTab).
 */
interface NameAliasesSectionProps {
  kind: "character" | "persona";
  aliases: string[];
  onChange: (aliases: string[]) => void;
  nameColor?: string;
}

function NameAliasInput({ existing, onAdd }: { existing: string[]; onAdd: (aliases: string[]) => void }) {
  const { t: localizeUi } = useTranslation();
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const seen = new Set(existing.map((a) => a.toLowerCase()));
    const additions: string[] = [];
    for (const part of trimmed.split(",").map((p) => p.trim())) {
      if (!part || seen.has(part.toLowerCase())) continue;
      seen.add(part.toLowerCase());
      additions.push(part);
    }

    if (additions.length > 0) {
      onAdd(additions);
    }
    setValue("");
  };

  return (
    <div className="flex gap-1.5">
      <input
        type="text"
        aria-label={localizeUi("ui.cards.otherNames.label")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={localizeUi("ui.cards.otherNames.placeholder")}
        className="w-full min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none focus:border-[var(--primary)]/40"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected px-3 py-1.5"
      >
        {localizeUi("ui.cards.otherNames.add")}
      </button>
    </div>
  );
}

export function NameAliasesSection({ kind, aliases, onChange, nameColor }: NameAliasesSectionProps) {
  const { t: localizeUi } = useTranslation();

  return (
    <div className="space-y-2" data-card-field="other-names">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
        {localizeUi("ui.cards.otherNames.label")}{" "}
        <HelpTooltip
          text={localizeUi(
            kind === "character" ? "ui.cards.otherNames.helpCharacter" : "ui.cards.otherNames.helpPersona",
          )}
        />
      </span>

      {aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aliases.map((alias, idx) => (
            <span key={`${alias}-${idx}`} className="mari-chrome-control mari-chrome-control--compact">
              <span
                className="font-medium"
                style={
                  nameColor
                    ? nameColor.includes("gradient(")
                      ? {
                          backgroundImage: nameColor,
                          backgroundRepeat: "no-repeat",
                          backgroundSize: "100% 100%",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                          color: "transparent",
                        }
                      : { color: nameColor }
                    : undefined
                }
              >
                {alias}
              </span>
              <button
                type="button"
                aria-label={localizeUi("ui.cards.otherNames.remove", { alias })}
                onClick={() => {
                  const next = aliases.filter((_, i) => i !== idx);
                  onChange(next);
                }}
                title={localizeUi("ui.cards.otherNames.remove", { alias })}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
              >
                <X size="0.625rem" />
              </button>
            </span>
          ))}
        </div>
      )}

      <NameAliasInput
        existing={aliases}
        onAdd={(additions) => {
          onChange([...aliases, ...additions]);
        }}
      />
    </div>
  );
}
