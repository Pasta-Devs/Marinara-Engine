// ──────────────────────────────────────────────
// Story Bundle Personas Tab
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Dices, Plus, Search, X } from "lucide-react";
import type { AvatarCrop } from "@marinara-engine/shared";
import { normalizeAvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";

const PERSONA_PICKER_PAGE_SIZE = 20;

interface Persona {
  id: string;
  name: string;
  avatarPath?: string | null;
  avatarCrop?: string | null;
  comment?: string | null;
  description?: string | null;
}

export interface StoryBundlePersonasProps {
  personaIds: string[];
  onPersonaIdsChange: (ids: string[]) => void;
  personas: Persona[];
  validPersonaIds: Set<string>;
}

function getPersonaTitle(persona: Persona): string | null {
  return persona.comment?.trim() || null;
}

function CroppedAvatarImage({
  avatarPath,
  avatarCrop,
  alt,
  className,
}: {
  avatarPath?: string | null;
  avatarCrop?: string | null;
  alt: string;
  className?: string;
}) {
  const normalized: AvatarCrop | null = normalizeAvatarCrop(avatarCrop ?? null);
  const cropStyle: CSSProperties = getAvatarCropStyle(normalized);

  if (!avatarPath) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]",
          className,
        )}
        aria-label={alt}
      >
        <span className="text-xs font-semibold">{alt.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full", className)}>
      <img src={avatarPath} alt={alt} className="h-full w-full object-cover" style={cropStyle} />
    </div>
  );
}

export function StoryBundlePersonas({
  personaIds,
  onPersonaIdsChange,
  personas,
  validPersonaIds,
}: StoryBundlePersonasProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [personaPickerLimit, setPersonaPickerLimit] = useState(PERSONA_PICKER_PAGE_SIZE);

  useEffect(() => {
    setPersonaPickerLimit(PERSONA_PICKER_PAGE_SIZE);
  }, [search]);

  const selectedIds = useMemo(() => new Set(personaIds), [personaIds]);

  const available = useMemo(() => {
    const query = search.toLowerCase().trim();
    return personas.filter((p) => {
      if (selectedIds.has(p.id)) return false;
      if (!validPersonaIds.has(p.id)) return false;
      if (!query) return true;
      const name = p.name.toLowerCase();
      const title = p.comment?.trim().toLowerCase() ?? "";
      return name.includes(query) || title.includes(query);
    });
  }, [personas, selectedIds, validPersonaIds, search]);

  const visibleAvailable = useMemo(() => available.slice(0, personaPickerLimit), [available, personaPickerLimit]);

  const selectedPersonas = useMemo(
    () => personas.filter((p) => selectedIds.has(p.id) && validPersonaIds.has(p.id)),
    [personas, selectedIds, validPersonaIds],
  );

  // True when the active search matches the already-selected persona. In that
  // case the picker's empty state should say a persona is selected, not that
  // nothing matches the search (the persona does match — it is just picked).
  const searchMatchesSelected = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return false;
    return selectedPersonas.some((p) => {
      const name = p.name.toLowerCase();
      const title = p.comment?.trim().toLowerCase() ?? "";
      return name.includes(query) || title.includes(query);
    });
  }, [search, selectedPersonas]);

  const handleToggle = (id: string) => {
    // A story bundle plays exactly one persona: picking a persona replaces any
    // previous selection instead of adding to it.
    if (selectedIds.has(id)) {
      onPersonaIdsChange([]);
    } else {
      onPersonaIdsChange([id]);
    }
  };

  const handleRandom = () => {
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    onPersonaIdsChange([pick.id]);
  };

  return (
    <div data-testid="story-bundle-editor-personas" className="flex flex-col gap-6">
      {/* Add Persona */}
      <section>
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.addPersona", "Add Persona")}
        </h3>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size="0.875rem"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              data-testid="story-bundle-editor-personas-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("storyBundles.searchPersonas", "Search personas…")}
              className="mari-input w-full rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 pl-8 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
          <button
            data-testid="story-bundle-editor-personas-random"
            onClick={handleRandom}
            disabled={available.length === 0}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            title={t("storyBundles.personaRandomHint", "Pick a random persona")}
          >
            <Dices size="0.75rem" />
            <span className="block truncate text-xs">{t("storyBundles.random", "Random")}</span>
          </button>
        </div>

        {visibleAvailable.length > 0 ? (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {visibleAvailable.map((persona) => {
              const title = getPersonaTitle(persona);
              return (
                <button
                  key={persona.id}
                  data-testid={`story-bundle-editor-personas-add-${persona.id}`}
                  onClick={() => handleToggle(persona.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-[var(--accent)]"
                >
                  <CroppedAvatarImage
                    avatarPath={persona.avatarPath}
                    avatarCrop={persona.avatarCrop}
                    alt={persona.name}
                    className="h-7 w-7"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{persona.name}</div>
                    {title && <div className="truncate text-xs text-[var(--muted-foreground)]">{title}</div>}
                  </div>
                  <Plus size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                </button>
              );
            })}
            {available.length > personaPickerLimit && (
              <button
                data-testid="story-bundle-editor-personas-load-more"
                onClick={() => setPersonaPickerLimit((limit) => limit + PERSONA_PICKER_PAGE_SIZE)}
                className="w-full rounded-md px-2 py-1.5 text-center text-xs text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
              >
                {t("storyBundles.loadMore", "Load more")} ({visibleAvailable.length} {t("storyBundles.of", "of")}{" "}
                {available.length})
              </button>
            )}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-personas-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {search && !searchMatchesSelected
              ? t("storyBundles.noPersonasMatch", "No personas match your search.")
              : selectedPersonas.length > 0
                ? t("storyBundles.personaAlreadySelected", "A persona is already selected.")
                : t("storyBundles.noPersonasAvailable", "No personas available.")}
          </div>
        )}
      </section>

      {/* Selected Persona */}
      <section data-testid="story-bundle-editor-personas-selected">
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.selectedPersona", "Selected Persona")}
        </h3>

        {selectedPersonas.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {selectedPersonas.map((persona) => {
              const title = getPersonaTitle(persona);
              return (
                <div key={persona.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                  <CroppedAvatarImage
                    avatarPath={persona.avatarPath}
                    avatarCrop={persona.avatarCrop}
                    alt={persona.name}
                    className="h-7 w-7"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{persona.name}</div>
                    {title && <div className="truncate text-xs text-[var(--muted-foreground)]">{title}</div>}
                  </div>
                  <button
                    data-testid={`story-bundle-editor-personas-remove-${persona.id}`}
                    onClick={() => handleToggle(persona.id)}
                    className="shrink-0 rounded p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                    title={t("storyBundles.removePersona", "Remove")}
                  >
                    <X size="0.875rem" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-personas-selected-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {t("storyBundles.personaEmpty", "No persona selected yet.")}
          </div>
        )}
      </section>
    </div>
  );
}
