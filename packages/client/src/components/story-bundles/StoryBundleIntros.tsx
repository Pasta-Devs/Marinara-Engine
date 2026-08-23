// ──────────────────────────────────────────────
// Story Bundle Intros Tab
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Pencil, Plus, X } from "lucide-react";
import type { StoryBundleIntro } from "@marinara-engine/shared";

export interface StoryBundleIntrosProps {
  intros: StoryBundleIntro[];
  onIntrosChange: (intros: StoryBundleIntro[]) => void;
}

export function StoryBundleIntros({ intros, onIntrosChange }: StoryBundleIntrosProps) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftText, setDraftText] = useState("");

  const handleStartAdd = () => {
    setDraftName("");
    setDraftText("");
    setAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (intro: StoryBundleIntro) => {
    setDraftName(intro.name);
    setDraftText(intro.text);
    setEditingId(intro.id);
    setAdding(false);
  };

  const handleCancel = () => {
    setAdding(false);
    setEditingId(null);
    setDraftName("");
    setDraftText("");
  };

  const handleSave = () => {
    const trimmedName = draftName.trim();
    const trimmedText = draftText.trim();
    if (!trimmedName || !trimmedText) return;

    if (editingId) {
      onIntrosChange(intros.map((i) => (i.id === editingId ? { ...i, name: trimmedName, text: trimmedText } : i)));
    } else {
      onIntrosChange([...intros, { id: crypto.randomUUID(), name: trimmedName, text: trimmedText }]);
    }
    handleCancel();
  };

  const handleDelete = (id: string) => {
    onIntrosChange(intros.filter((i) => i.id !== id));
    if (editingId === id) handleCancel();
  };

  const isEditing = adding || editingId !== null;

  return (
    <div data-testid="story-bundle-editor-intros" className="flex flex-col gap-6">
      {/* Add / Edit Intro */}
      <section>
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.addIntros", "Add Intro")}
        </h3>

        {!isEditing ? (
          <button
            data-testid="story-bundle-editor-intros-add-button"
            onClick={handleStartAdd}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--muted-foreground)] transition-all hover:border-[var(--ring)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
          >
            <Plus size="0.875rem" />
            {t("storyBundles.introAddHint", "Create a new intro message")}
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <input
              data-testid="story-bundle-editor-intros-name-input"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t("storyBundles.introNamePlaceholder", "Intro name…")}
              className="mari-input w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              autoFocus
            />
            <textarea
              data-testid="story-bundle-editor-intros-text-input"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={t("storyBundles.introTextPlaceholder", "Intro message text…")}
              rows={4}
              className="mari-input w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
            <div className="flex items-center gap-2">
              <button
                data-testid="story-bundle-editor-intros-save-button"
                onClick={handleSave}
                disabled={!draftName.trim() || !draftText.trim()}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingId ? t("storyBundles.introSaveEdit", "Save") : t("storyBundles.introSave", "Add")}
              </button>
              <button
                data-testid="story-bundle-editor-intros-cancel-button"
                onClick={handleCancel}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
              >
                {t("storyBundles.cancel", "Cancel")}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Selected Intros */}
      <section>
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.selectedIntros", "Intros")}
        </h3>

        {intros.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {intros.map((intro) => (
              <div key={intro.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <MessageSquare size="0.75rem" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">{intro.name}</div>
                  <div className="truncate text-xs text-[var(--muted-foreground)]">{intro.text}</div>
                </div>
                <button
                  data-testid="story-bundle-editor-intros-edit-button"
                  onClick={() => handleStartEdit(intro)}
                  className="shrink-0 rounded p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                  title={t("storyBundles.introEdit", "Edit")}
                >
                  <Pencil size="0.875rem" />
                </button>
                <button
                  data-testid="story-bundle-editor-intros-delete-button"
                  onClick={() => handleDelete(intro.id)}
                  className="shrink-0 rounded p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                  title={t("storyBundles.introRemove", "Remove")}
                >
                  <X size="0.875rem" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-intros-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {t("storyBundles.introsEmpty", "No intros added yet.")}
          </div>
        )}
      </section>
    </div>
  );
}
