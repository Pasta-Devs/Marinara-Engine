import { useMemo, useState, type CSSProperties } from "react";
import { Layers } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  assignCardFieldAlternative,
  CARD_FIELD_KEYS,
  cardEntityBelongsToChat,
  normalizeCardFieldAlternatives,
  type CardFieldAlternative,
} from "@marinara-engine/shared";
import { cardFieldAlternativeName } from "../../../components/characters/CardFieldAlternatives";
import { useCardFieldLabels } from "../../../hooks/use-card-field-generation";
import { characterKeys, useUpdateCharacter, useUpdatePersona } from "../../../hooks/use-characters";
import { ChatSettingsSection } from "../ChatSettingsSection";

type Entity = { kind: "character" | "persona"; id: string; name: string; alternatives: CardFieldAlternative[] };

interface CardFieldAlternativesSectionProps {
  chat: { id: string };
  characters: Array<{ id: string; data: unknown }>;
  personas: Array<{ id: string; name: string; cardFieldAlternatives?: unknown }>;
  style?: CSSProperties;
}

function characterEntity(character: { id: string; data: unknown }): Entity {
  let data: Record<string, unknown> = {};
  try {
    const parsed = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // An unreadable card simply has no alternatives to offer.
  }
  const extensions = (data.extensions ?? {}) as Record<string, unknown>;
  return {
    kind: "character",
    id: character.id,
    name: typeof data.name === "string" ? data.name : character.id,
    alternatives: normalizeCardFieldAlternatives(extensions.cardFieldAlternatives),
  };
}

/** Picks, per card field, which alternative this chat uses. Assignment stays on the card (`chatIds`). */
export function CardFieldAlternativesSection({ chat, characters, personas, style }: CardFieldAlternativesSectionProps) {
  const { t } = useTranslation();
  const fieldLabels = useCardFieldLabels();
  const qc = useQueryClient();
  const updateCharacter = useUpdateCharacter();
  const updatePersona = useUpdatePersona();
  // Shown until the saved card reaches the cached lists, so the select doesn't jump back meanwhile.
  const [pending, setPending] = useState<Record<string, string>>({});

  const entities = useMemo(() => {
    const persona = personas.find((entry) => cardEntityBelongsToChat(chat, "persona", entry.id));
    return [
      ...(persona
        ? [
            {
              kind: "persona" as const,
              id: persona.id,
              name: t("ui.chatSettings.cardFieldAlternatives.persona", { name: persona.name }),
              alternatives: normalizeCardFieldAlternatives(persona.cardFieldAlternatives),
            },
          ]
        : []),
      ...characters.filter((entry) => cardEntityBelongsToChat(chat, "character", entry.id)).map(characterEntity),
    ].filter((entity) => entity.alternatives.length > 0);
  }, [chat, characters, personas, t]);

  if (entities.length === 0) return null;

  const choose = async (entity: Entity, field: CardFieldAlternative["field"], alternativeId: string) => {
    const key = `${entity.kind}:${entity.id}:${field}`;
    setPending((current) => ({ ...current, [key]: alternativeId }));
    const next = assignCardFieldAlternative(entity.alternatives, field, chat.id, alternativeId || null);
    try {
      if (entity.kind === "persona") {
        await updatePersona.mutateAsync({ id: entity.id, cardFieldAlternatives: next, skipVersionSnapshot: true });
      } else {
        await updateCharacter.mutateAsync({
          id: entity.id,
          data: { extensions: { cardFieldAlternatives: next } },
          skipVersionSnapshot: true,
        });
        await qc.invalidateQueries({ queryKey: characterKeys.list() });
      }
    } catch {
      toast.error(t("ui.chatSettings.cardFieldAlternatives.saveFailed", { name: entity.name }));
    } finally {
      setPending(({ [key]: _done, ...rest }) => rest);
    }
  };

  return (
    <ChatSettingsSection
      id="card-field-alternatives"
      style={style}
      label={t("ui.chatSettings.cardFieldAlternatives.title")}
      icon={<Layers size="0.875rem" />}
      help={t("ui.chatSettings.cardFieldAlternatives.help")}
    >
      <div className="space-y-3">
        {entities.map((entity) => (
          <div key={`${entity.kind}:${entity.id}`} className="space-y-1.5">
            <p className="mari-chrome-text-strong truncate text-xs font-semibold">{entity.name}</p>
            {CARD_FIELD_KEYS.filter((field) => entity.alternatives.some((entry) => entry.field === field)).map(
              (field) => {
                const key = `${entity.kind}:${entity.id}:${field}`;
                const options = entity.alternatives.filter((entry) => entry.field === field);
                const saved = options.find((entry) => entry.chatIds.includes(chat.id))?.id ?? "";
                return (
                  <label key={field} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 truncate text-[var(--muted-foreground)]">{fieldLabels[field]}</span>
                    <select
                      value={pending[key] ?? saved}
                      disabled={pending[key] !== undefined}
                      onChange={(event) => void choose(entity, field, event.target.value)}
                      aria-label={t("ui.chatSettings.cardFieldAlternatives.selectLabel", {
                        field: fieldLabels[field],
                        name: entity.name,
                      })}
                      className="mari-preset-native-select min-w-0 flex-1 truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
                    >
                      <option value="">{t("ui.chatSettings.cardFieldAlternatives.original")}</option>
                      {options.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {cardFieldAlternativeName(t, entity.alternatives, entry, fieldLabels[field])}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              },
            )}
          </div>
        ))}
      </div>
    </ChatSettingsSection>
  );
}
