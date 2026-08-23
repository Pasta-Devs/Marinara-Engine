import {
  BookOpen,
  Bot,
  Dices,
  Link2,
  MessageCircle,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  UserRound,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MariChipEntity, MariSuggestionChip } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

interface MariSuggestionChipsProps {
  chips: MariSuggestionChip[];
  onSelect: (chip: MariSuggestionChip) => void;
  disabled?: boolean;
  compact?: boolean;
}

const CHIP_ICONS: Record<string, LucideIcon> = {
  UserPlus,
  BookOpen,
  Sparkles,
  UserRound,
  Wand2,
  Dices,
};

const ENTITY_DEFAULT_ICON: Partial<Record<MariChipEntity, LucideIcon>> = {
  characters: UserPlus,
  lorebooks: BookOpen,
  personas: UserRound,
  presets: SlidersHorizontal,
  connections: Link2,
  agents: Bot,
  settings: Settings,
  chat: MessageCircle,
};

const ENTITY_LABEL_MATCHERS: Array<[MariChipEntity, RegExp]> = [
  ["characters", /\b(character|characters|character card|character cards)\b/i],
  ["lorebooks", /\b(lorebook|lorebooks|lore book|lore books)\b/i],
  ["personas", /\b(persona|personas)\b/i],
];

function inferChipEntity(chip: MariSuggestionChip): MariChipEntity | undefined {
  if (chip.entity) return chip.entity;
  return ENTITY_LABEL_MATCHERS.find(([, matcher]) => matcher.test(chip.label))?.[0];
}

// Fade + rise + scale, keyed per chip set, mode="wait" so the old set fully exits before the
// next enters - this is the exact recipe GameSetupWizard/ChatSetupWizard use for step changes
// (see GameSetupWizard.tsx / ChatSetupWizard.tsx step transitions), reused here so a new
// suggestion set reads as "the next step" rather than an abrupt content swap.
export function MariSuggestionChips({ chips, onSelect, disabled = false, compact = false }: MariSuggestionChipsProps) {
  const { t: localizeUi } = useUiTranslation();
  const reducedMotion = useReducedMotion();
  const setKey = chips.map((chip) => chip.id).join("|");

  return (
    <AnimatePresence mode="wait">
      {chips.length > 0 && (
        <motion.div
          key={setKey}
          role="group"
          aria-label={localizeUi("ui.chat.marisuggestionchips.suggestedReplies")}
          className={cn("mari-suggestion-chips", compact && "mari-suggestion-chips--compact")}
          initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {chips.map((chip) => {
            const entity = inferChipEntity(chip);
            const Icon = (chip.icon && CHIP_ICONS[chip.icon]) || (entity && ENTITY_DEFAULT_ICON[entity]) || undefined;
            const label =
              chip.id === "authorization-accept"
                ? localizeUi("ui.chat.marisuggestionchips.acceptAuthorization")
                : chip.label;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onSelect(chip)}
                disabled={disabled}
                className={cn(
                  "mari-suggestion-chip text-left",
                  entity && `mari-panel-gradient--${entity}`,
                  !entity && !chip.tone && "mari-suggestion-chip--neutral",
                  chip.tone === "danger" && "mari-suggestion-chip--danger",
                  chip.tone === "caution" && "mari-suggestion-chip--caution",
                  chip.tone === "success" && "mari-suggestion-chip--success",
                )}
                aria-label={label}
                title={chip.prompt}
              >
                {Icon ? <Icon size={compact ? "0.6875rem" : "0.8125rem"} className="shrink-0" /> : null}
                <span className="min-w-0 truncate">{label}</span>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
