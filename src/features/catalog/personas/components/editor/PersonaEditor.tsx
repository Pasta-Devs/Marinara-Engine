// ──────────────────────────────────────────────
// Persona Editor — Full-page detail view
// Replaces the chat area when editing a persona.
// Sections: Description, Personality, Backstory,
//           Appearance, Scenario
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { usePersona, useUpdatePersona, useUploadPersonaAvatar, useDeletePersona } from "../../hooks/use-personas";
import { useConnections } from "../../../connections/index";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import {
  ArrowLeft,
  Save,
  User,
  FileText,
  Heart,
  BookOpen,
  Eye,
  MapPin,
  Camera,
  Trash2,
  AlertTriangle,
  Palette,
  Activity,
  Maximize2,
  Image,
  Wand2,
} from "lucide-react";
import { cn, generateClientId, getAvatarCropStyle } from "../../../../../shared/lib/utils";
import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { HelpTooltip } from "../../../../../shared/components/ui/HelpTooltip";
import { ExpandedTextarea } from "../../../../../shared/components/ui/ExpandedTextarea";
import { exportApi } from "../../../../../shared/api/export-api";
import { AvatarGenerationModal } from "../../../../../shared/components/ui/AvatarGenerationModal";
import { ExportFormatDialog, type ExportFormatChoice } from "../../../../../shared/components/ui/ExportFormatDialog";
import { buildPersonaFormData, type PersonaFormData, type PersonaRow } from "../../lib/persona-editor-model";
import { PersonaColorsTab } from "./PersonaColorsTab";
import { PersonaDescriptionTab } from "./PersonaDescriptionTab";
import { PersonaSpritesTab } from "../sprites/PersonaSpritesTab";
import { PersonaStatsTab } from "./PersonaStatsTab";

// ── Tabs ──
const TABS = [
  { id: "description", label: "Description", icon: FileText },
  { id: "personality", label: "Personality", icon: Heart },
  { id: "backstory", label: "Backstory", icon: BookOpen },
  { id: "appearance", label: "Appearance", icon: Eye },
  { id: "scenario", label: "Scenario", icon: MapPin },
  { id: "sprites", label: "Sprites", icon: Image },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "stats", label: "Stats", icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PersonaEditor() {
  const personaId = useUIStore((s) => s.personaDetailId);
  const closeDetail = useUIStore((s) => s.closePersonaDetail);
  const { data: rawPersona, isLoading } = usePersona(personaId);
  const updatePersona = useUpdatePersona();
  const uploadAvatar = useUploadPersonaAvatar();
  const deletePersona = useDeletePersona();
  const { data: connectionsList } = useConnections();
  const imageConnections = useMemo(
    () =>
      Array.isArray(connectionsList)
        ? (
            connectionsList as Array<{ id: string; name: string; model?: string | null; provider?: string | null }>
          ).filter((connection) => connection.provider === "image_generation")
        : [],
    [connectionsList],
  );

  const [activeTab, setActiveTab] = useState<TabId>("description");
  const [formData, setFormData] = useState<PersonaFormData | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [avatarGeneratorOpen, setAvatarGeneratorOpen] = useState(false);
  const loadedPersonaIdRef = useRef<string | null>(null);
  const latestAvatarUploadTokenRef = useRef<string | null>(null);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  useEffect(() => {
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);
  const [saving, setSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageGenerationAvailable = imageConnections.length > 0;

  const persona = rawPersona as PersonaRow | undefined;

  // Parse persona into form data when it first loads (or when switching personas).
  // Important: don't overwrite local unsaved edits if server data refetches (e.g. after avatar upload).
  useEffect(() => {
    if (!persona) return;

    const isSwitchingPersona = loadedPersonaIdRef.current !== persona.id;
    if (!isSwitchingPersona && dirty) return;

    loadedPersonaIdRef.current = persona.id;

    setFormData(buildPersonaFormData(persona));
    setAvatarPreview(persona.avatarPath);
    setDirty(false);
  }, [persona, dirty]);

  const updateField = useCallback(<K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!personaId || !formData) return;
    setSaving(true);
    try {
      const { altDescriptions, tags, avatarCrop, ...rest } = formData;
      await updatePersona.mutateAsync({
        id: personaId,
        ...rest,
        altDescriptions,
        tags,
        avatarCrop: avatarCrop ?? null,
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !personaId) return;

    const uploadToken = generateClientId();
    latestAvatarUploadTokenRef.current = uploadToken;
    const fallbackAvatarPath = persona?.avatarPath ?? null;
    // Capture the saved crop so we can revert if the upload fails. The new image
    // almost certainly has different framing/dimensions, so the old normalized
    // crop coords are meaningless for it — clear immediately on upload start
    // and let the cropper re-init from default centered max-square.
    const fallbackAvatarCrop = formData?.avatarCrop ?? null;

    const reader = new FileReader();
    reader.onload = async () => {
      if (latestAvatarUploadTokenRef.current !== uploadToken) return;
      const dataUrl = reader.result as string;
      setAvatarPreview(dataUrl);
      updateField("avatarCrop", null);
      try {
        await uploadAvatar.mutateAsync({
          id: personaId,
          avatar: dataUrl,
          filename: `persona-${personaId}-${Date.now()}.${file.name.split(".").pop()}`,
        });
      } catch {
        if (latestAvatarUploadTokenRef.current !== uploadToken) return;
        setAvatarPreview(fallbackAvatarPath);
        updateField("avatarCrop", fallbackAvatarCrop);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleGeneratedAvatar = useCallback(
    async (avatarDataUrl: string) => {
      if (!personaId) return;
      const uploadToken = generateClientId();
      latestAvatarUploadTokenRef.current = uploadToken;
      setAvatarPreview(avatarDataUrl);
      // Same rationale as handleAvatarUpload — a freshly generated avatar
      // shouldn't inherit the prior image's crop coords.
      updateField("avatarCrop", null);
      await uploadAvatar.mutateAsync({
        id: personaId,
        avatar: avatarDataUrl,
        filename: `persona-${personaId}-${Date.now()}.png`,
      });
      toast.success("Persona avatar generated.");
    },
    [personaId, updateField, uploadAvatar],
  );

  const handleDelete = async () => {
    if (!personaId) return;
    if (
      !(await showConfirmDialog({
        title: "Delete Persona",
        message: "Are you sure you want to delete this persona?",
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }
    await deletePersona.mutateAsync(personaId);
    closeDetail();
  };

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeDetail();
  }, [dirty, closeDetail]);

  const forceClose = useCallback(() => {
    setShowUnsavedWarning(false);
    setDirty(false);
    closeDetail();
  }, [closeDetail]);

  if (isLoading || !formData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="shimmer h-16 w-16 rounded-2xl" />
          <div className="shimmer h-3 w-32 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Persona"
        description="Native keeps Marinara persona metadata. Compatible exports simple persona JSON for other tools."
        compatibleDescription="Exports persona fields directly without the Marinara wrapper."
        onClose={() => setExportDialogOpen(false)}
        onSelect={(format: ExportFormatChoice) => {
          if (!personaId) return;
          setExportDialogOpen(false);
          void exportApi.persona(personaId, format).then(exportApi.triggerDownload);
        }}
      />
      <AvatarGenerationModal
        open={avatarGeneratorOpen}
        title="Generate Persona Avatar"
        entityName={formData.name}
        defaultAppearance={formData.appearance || formData.description || formData.personality}
        defaultAvatarUrl={avatarPreview}
        imageConnections={imageConnections}
        onClose={() => setAvatarGeneratorOpen(false)}
        onUseAvatar={handleGeneratedAvatar}
      />

      {/* ── Header ── */}
      <div className="flex min-h-12 flex-shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-0 max-md:gap-2 max-md:px-3">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-xl p-2 transition-all hover:bg-[var(--accent)] active:scale-95"
          title="Back"
        >
          <ArrowLeft size="1.125rem" />
        </button>

        {/* Avatar */}
        <div
          className="group relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-500/20 max-md:h-10 max-md:w-10"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt={formData.name}
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(formData.avatarCrop)}
            />
          ) : (
            <User size="1.375rem" className="text-white" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="1rem" className="text-white" />
          </div>
          {imageGenerationAvailable && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setAvatarGeneratorOpen(true);
              }}
              className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--card)]/95 text-[var(--primary)] opacity-0 shadow-md ring-1 ring-[var(--border)] transition-opacity hover:bg-[var(--card)] group-hover:opacity-100 max-md:opacity-100"
              title="Generate avatar"
            >
              <Wand2 size="0.75rem" />
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full bg-transparent text-lg font-bold outline-none"
            placeholder="Persona name"
          />
          <input
            value={formData.comment}
            onChange={(e) => updateField("comment", e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--muted-foreground)] outline-none"
            placeholder="Comment (e.g. 'Modern AU version')"
          />
          <p className="flex items-center gap-1 truncate text-xs text-[var(--muted-foreground)]">
            Your persona
            <HelpTooltip text="This is how the AI sees you. Fill in description, personality, backstory, and appearance — just like a character card. The active persona is injected into every prompt." />
          </p>
        </div>

        {/* Export */}
        <button
          type="button"
          onClick={() => setExportDialogOpen(true)}
          className="rounded-xl p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="Export persona"
        >
          <svg width="1.125rem" height="1.125rem" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 13V3m0 0l-4 4m4-4l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="3" y="15" width="14" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-xl p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
          title="Delete persona"
        >
          <Trash2 size="1.125rem" />
        </button>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-all",
            dirty
              ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg active:scale-[0.98]"
              : "bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed",
          )}
        >
          <Save size="0.8125rem" />
          <span className="max-md:hidden">{saving ? "Saving…" : "Save"}</span>
        </button>
      </div>

      {/* ── Unsaved changes warning ── */}
      {showUnsavedWarning && (
        <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <AlertTriangle size="0.9375rem" className="shrink-0 text-amber-500" />
          <p className="flex-1 text-xs font-medium text-amber-500">You have unsaved changes. Close without saving?</p>
          <button
            type="button"
            onClick={() => setShowUnsavedWarning(false)}
            className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={forceClose}
            className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-500 transition-all hover:bg-amber-500/25"
          >
            Discard & close
          </button>
          <button
            type="button"
            onClick={async () => {
              await handleSave();
              closeDetail();
            }}
            className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:shadow-md"
          >
            Save & close
          </button>
        </div>
      )}

      {/* ── Body: Tabs + Content ── */}
      <div className="flex flex-1 overflow-hidden @max-5xl:flex-col">
        {/* Tab Rail */}
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-2 @max-5xl:w-full @max-5xl:flex-row @max-5xl:overflow-x-auto @max-5xl:border-r-0 @max-5xl:border-b @max-5xl:p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left @max-5xl:whitespace-nowrap @max-5xl:px-2.5 @max-5xl:py-1.5",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-emerald-400/15 to-teal-500/15 text-emerald-400 ring-1 ring-emerald-400/20"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                )}
              >
                <Icon size="0.875rem" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 @max-5xl:p-4">
          <div className="mx-auto max-w-2xl">
            {activeTab === "description" && (
              <PersonaDescriptionTab formData={formData} updateField={updateField} avatarPreview={avatarPreview} />
            )}
            {activeTab === "personality" && (
              <TextareaTab
                title="Personality"
                subtitle="Your personality traits, temperament, and behavioral patterns."
                value={formData.personality}
                onChange={(v) => updateField("personality", v)}
                placeholder="Calm and analytical, but quick to act when someone's in danger. Has a dry sense of humor…"
                rows={8}
              />
            )}
            {activeTab === "backstory" && (
              <TextareaTab
                title="Backstory"
                subtitle="Your character's history, origin story, and formative life events."
                value={formData.backstory}
                onChange={(v) => updateField("backstory", v)}
                placeholder="Grew up in a frontier town, apprenticed under a traveling scholar…"
                rows={12}
              />
            )}
            {activeTab === "appearance" && (
              <TextareaTab
                title="Appearance"
                subtitle="Physical description — height, build, hair, eyes, clothing, distinguishing features."
                value={formData.appearance}
                onChange={(v) => updateField("appearance", v)}
                placeholder="Average height, dark hair worn loose. Prefers practical clothing — boots, a worn jacket…"
                rows={8}
              />
            )}
            {activeTab === "scenario" && (
              <TextareaTab
                title="Scenario"
                subtitle="Your default situation or context within roleplays."
                value={formData.scenario}
                onChange={(v) => updateField("scenario", v)}
                placeholder="A wandering adventurer seeking answers about a mysterious artifact…"
                rows={8}
              />
            )}
            {activeTab === "colors" && (
              <PersonaColorsTab formData={formData} updateField={updateField} avatarUrl={avatarPreview} />
            )}
            {activeTab === "sprites" && personaId && (
              <PersonaSpritesTab
                personaId={personaId}
                defaultAppearance={formData.appearance || formData.description}
                defaultAvatarUrl={avatarPreview}
                imageConnections={imageConnections}
              />
            )}
            {activeTab === "stats" && <PersonaStatsTab formData={formData} updateField={updateField} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextareaTab({
  title,
  subtitle,
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="Expand editor"
        >
          <Maximize2 size="0.875rem" />
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">{value.length} characters</p>
      <ExpandedTextarea
        open={expanded}
        onClose={() => setExpanded(false)}
        title={title}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}
