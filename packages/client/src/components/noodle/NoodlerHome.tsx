import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type {
  NoodleIdentityDisclosure,
  NoodleAccount,
  NoodlePostAccess,
  NoodleStageProfileInput,
  NoodlerManagedStageProfile,
  NoodlerStageProfile,
  Persona,
} from "@marinara-engine/shared";
import {
  useCreateNoodlerStageProfile,
  useDeleteNoodlerStageProfile,
  useGeneratePrivateNoodlePost,
  useGenerateNoodlerStageProfileDraft,
  useNoodle,
  useNoodlerAccounts,
  useNoodlerEligibleAccounts,
  useNoodlerPosts,
  useNoodlerViewer,
  useToggleNoodlerSubscription,
  useUnlockNoodlerPost,
  useUpdateNoodlerAccess,
  useUpdateNoodleSettings,
  useUpdateNoodlerStageProfile,
} from "../../hooks/use-noodle";
import { useActivePersona, usePersonas } from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import { GuidedPostModal } from "./GuidedPostModal";
import { NoodleShell, NOODLE_PERSONA_SWITCHER_PAGE_SIZE } from "./NoodleShell";
import { Modal } from "../ui/Modal";
import type { NoodleNavigationState } from "./noodle-navigation.types";

export type NoodlerNotificationItem = {
  id: string;
  createdAt: string;
  kind: "account-created";
  accountId: string;
};

interface NoodlerHomeProps {
  navigation: Extract<NoodleNavigationState, { mode: "private" | "verification" }>;
  onNavigate: (destination: NoodleNavigationState) => void;
}

const DISCLOSURE_OPTIONS: Array<{
  value: NoodleIdentityDisclosure;
  label: string;
  shortLabel: string;
  detail: string;
  guidance: string;
}> = [
  {
    value: "open",
    label: "Publicly connected",
    shortLabel: "Open",
    detail: "This stage identity can openly be the same person.",
    guidance: "Names, handles, recognizable details, and continuity may carry over.",
  },
  {
    value: "hinted",
    label: "Inspired alter ego",
    shortLabel: "Hinted",
    detail: "Familiar themes can remain, without naming the public identity.",
    guidance: "Exact names and handles are removed, but broad personality and interests may inspire the draft.",
  },
  {
    value: "secret",
    label: "Separate persona",
    shortLabel: "Secret",
    detail: "Create a genuinely separate identity with no public connection.",
    guidance: "The AI receives a reduced, non-identifying inspiration brief and avoids distinctive canonical details.",
  },
];

const EMPTY_STAGE_PROFILE: NoodleStageProfileInput = {
  displayName: "",
  handle: "",
  bio: "",
  stagePersonality: "",
  disclosureMode: "hinted",
};

const fieldClass =
  "mari-chrome-field h-11 w-full rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-blue)]";
const textareaClass =
  "mari-chrome-field min-h-24 w-full resize-y rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-blue)]";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function NoodlerHome({ navigation, onNavigate }: NoodlerHomeProps) {
  const { data } = useNoodle();
  const updateSettings = useUpdateNoodleSettings();
  const enabled = data?.settings.enableNoodler === true;
  const accountsQuery = useNoodlerAccounts(navigation.mode === "private" && enabled);
  const personasQuery = usePersonas(navigation.mode === "private" && enabled);
  const activePersonaQuery = useActivePersona(navigation.mode === "private" && enabled);
  const storedPersonaId = useUIStore((state) => state.noodleSelectedPersonaId);
  const setStoredPersonaId = useUIStore((state) => state.setNoodleSelectedPersonaId);
  const personas = (personasQuery.data ?? []) as Persona[];
  const viewerPersonaId =
    (storedPersonaId && personas.some((persona) => persona.id === storedPersonaId) ? storedPersonaId : null) ??
    activePersonaQuery.data?.id ??
    personas[0]?.id ??
    null;
  const viewerAccounts = (data?.accounts ?? []).filter((account) => account.kind === "persona");
  const shellPersonaAccount = viewerAccounts.find((account) => account.entityId === viewerPersonaId) ?? null;
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileAccountSwitcherOpen, setMobileAccountSwitcherOpen] = useState(false);
  const [personaAccountLimit, setPersonaAccountLimit] = useState(NOODLE_PERSONA_SWITCHER_PAGE_SIZE);
  const accountSwitcherRef = useRef<HTMLDivElement | null>(null);
  const visiblePersonaAccounts = viewerAccounts.slice(0, personaAccountLimit);
  const switchViewerPersona = (account: NoodleAccount, mobile: boolean) => {
    setStoredPersonaId(account.entityId);
    if (mobile) setMobileDrawerOpen(false);
    else setAccountSwitcherOpen(false);
  };
  useEffect(() => {
    if (accountSwitcherOpen) setPersonaAccountLimit(NOODLE_PERSONA_SWITCHER_PAGE_SIZE);
  }, [accountSwitcherOpen]);
  useEffect(() => {
    if (!mobileDrawerOpen) {
      setMobileAccountSwitcherOpen(false);
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileDrawerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileDrawerOpen]);
  useEffect(() => {
    if (!accountSwitcherOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountSwitcherOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (accountSwitcherRef.current?.contains(event.target)) return;
      setAccountSwitcherOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [accountSwitcherOpen]);
  const exitToPublic = () => onNavigate({ mode: "public", view: "home" });
  const [showManageProfiles, setShowManageProfiles] = useState(false);
  const viewerQuery = useNoodlerViewer(viewerPersonaId, enabled);
  const toggleSubscription = useToggleNoodlerSubscription();
  const unlockPost = useUnlockNoodlerPost();
  const updateAccess = useUpdateNoodlerAccess();
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceKind, setSourceKind] = useState<"all" | "character" | "persona">("all");
  const eligibleAccountsQuery = useNoodlerEligibleAccounts(
    sourceSearch,
    sourceKind,
    navigation.mode === "private" && enabled,
  );
  const createProfile = useCreateNoodlerStageProfile();
  const deleteProfile = useDeleteNoodlerStageProfile();
  const updateProfile = useUpdateNoodlerStageProfile();
  const generatePost = useGeneratePrivateNoodlePost();
  const generateProfileDraft = useGenerateNoodlerStageProfileDraft();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<NoodleStageProfileInput | null>(null);
  const [draftPublicAccountId, setDraftPublicAccountId] = useState<string | null>(null);
  const [creationStep, setCreationStep] = useState<"source" | "disclosure" | "draft" | null>(null);
  const [creationDisclosure, setCreationDisclosure] = useState<NoodleIdentityDisclosure>("hinted");
  const [draftGuidance, setDraftGuidance] = useState("");
  const [previousDraft, setPreviousDraft] = useState<NoodleStageProfileInput | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [guidedProfile, setGuidedProfile] = useState<NoodlerStageProfile | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const selectedProfile = accountsQuery.data?.find((profile) => profile.id === selectedProfileId) ?? null;
  const editingProfile = accountsQuery.data?.find((profile) => profile.id === editingProfileId) ?? null;
  const postsQuery = useNoodlerPosts(selectedProfile?.id ?? null);
  const eligiblePublicAccounts = eligibleAccountsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedSource = eligiblePublicAccounts.find((account) => account.id === draftPublicAccountId) ?? null;
  const sourcePickerLoading = eligibleAccountsQuery.isLoading || eligibleAccountsQuery.isFetching;

  const handleSourceSearch = (value: string) => {
    setSourceSearch(value);
    setDraftPublicAccountId(null);
  };
  const handleSourceKind = (value: "all" | "character" | "persona") => {
    setSourceKind(value);
    setDraftPublicAccountId(null);
  };

  const enableNoodler = () => {
    updateSettings.mutate(
      { enableNoodler: true },
      {
        onSuccess: () => onNavigate({ mode: "private", view: "hub" }),
        onError: (error) => toast.error(errorMessage(error, "Could not enable NoodleR.")),
      },
    );
  };

  const beginCreate = () => {
    setEditingProfileId(null);
    setDraftPublicAccountId(null);
    setProfileDraft(null);
    setCreationStep("source");
    setCreationDisclosure("hinted");
    setDraftGuidance("");
    setPreviousDraft(null);
    setSourceSearch("");
    setSourceKind("all");
  };

  const beginEdit = (profile: NoodlerStageProfile) => {
    setEditingProfileId(profile.id);
    setDraftPublicAccountId(profile.publicAccountId);
    setCreationDisclosure(profile.disclosureMode ?? "hinted");
    setCreationStep("draft");
    setDraftGuidance("");
    setPreviousDraft(null);
    setProfileDraft({
      displayName: profile.displayName,
      handle: profile.handle,
      bio: profile.bio,
      stagePersonality: profile.stagePersonality,
      disclosureMode: profile.disclosureMode ?? "hinted",
    });
  };

  const closeProfileEditor = () => {
    if (editingProfileId && profileDraft && editingProfile) {
      const savedDraft: NoodleStageProfileInput = {
        displayName: editingProfile.displayName,
        handle: editingProfile.handle,
        bio: editingProfile.bio,
        stagePersonality: editingProfile.stagePersonality,
        disclosureMode: editingProfile.disclosureMode ?? "hinted",
      };
      if (
        JSON.stringify(profileDraft) !== JSON.stringify(savedDraft) &&
        !window.confirm("Discard unsaved profile changes?")
      ) {
        return;
      }
    }
    setProfileDraft(null);
    setPreviousDraft(null);
    setEditingProfileId(null);
    setCreationStep(null);
  };

  const changeDisclosure = (value: NoodleIdentityDisclosure) => {
    setCreationDisclosure(value);
    setProfileDraft((current) => (current ? { ...current, disclosureMode: value } : current));
  };

  const generateDraft = () => {
    if (!draftPublicAccountId && !editingProfileId) return;
    generateProfileDraft.mutate(
      {
        ...(editingProfileId ? { privateAccountId: editingProfileId } : { publicAccountId: draftPublicAccountId! }),
        disclosureMode: creationDisclosure,
        guidance: draftGuidance,
        currentDraft: profileDraft ?? undefined,
      },
      {
        onSuccess: (draft) => {
          if (profileDraft) setPreviousDraft(profileDraft);
          setProfileDraft(draft);
          setCreationStep("draft");
        },
        onError: (error) => toast.error(errorMessage(error, "Could not generate a stage profile draft.")),
      },
    );
  };

  const saveProfile = () => {
    if (!profileDraft) return;
    const input = {
      ...profileDraft,
      handle: profileDraft.handle.replace(/^@+/u, ""),
    };
    const onSuccess = (profile: NoodlerStageProfile) => {
      setProfileDraft(null);
      setEditingProfileId(null);
      setDraftPublicAccountId(null);
      setCreationStep(null);
      setPreviousDraft(null);
      setSelectedProfileId(profile.id);
      toast.success(editingProfileId ? "Stage profile updated." : "Stage profile created.");
    };
    const onError = (error: unknown) => toast.error(errorMessage(error, "Could not save the stage profile."));
    if (editingProfileId) {
      updateProfile.mutate({ accountId: editingProfileId, ...input }, { onSuccess, onError });
    } else if (draftPublicAccountId) {
      createProfile.mutate({ publicAccountId: draftPublicAccountId, stageProfile: input }, { onSuccess, onError });
    }
  };

  const submitGuidedPost = ({
    direction,
    access,
    ppvPrice,
  }: {
    direction: string;
    access: NoodlePostAccess;
    ppvPrice: number | null;
  }) => {
    if (!guidedProfile) return;
    setGenerationError(null);
    generatePost.mutate(
      {
        mode: "private",
        targetAccountId: guidedProfile.id,
        privatePostGuide: direction.trim(),
        access,
        ...(access === "ppv" ? { ppvPrice } : {}),
      },
      {
        onSuccess: () => {
          setGuidedProfile(null);
          toast.success("Private post generated.");
        },
        onError: (error) => setGenerationError(errorMessage(error, "Could not generate this post.")),
      },
    );
  };

  const shellProps = {
    activeView: null,
    personaAccount: shellPersonaAccount,
    sortedPersonaAccounts: viewerAccounts,
    visiblePersonaAccounts,
    onLoadMorePersonaAccounts: () =>
      setPersonaAccountLimit((current) => current + NOODLE_PERSONA_SWITCHER_PAGE_SIZE),
    onSwitchPersona: switchViewerPersona,
    accountSwitcherOpen,
    onAccountSwitcherOpenChange: setAccountSwitcherOpen,
    accountSwitcherRef,
    mobileDrawerOpen,
    onMobileDrawerOpenChange: setMobileDrawerOpen,
    mobileAccountSwitcherOpen,
    onMobileAccountSwitcherOpenChange: setMobileAccountSwitcherOpen,
    notificationCount: 0,
    onOpenHome: exitToPublic,
    onOpenMobileHome: exitToPublic,
    onOpenSearch: exitToPublic,
    onOpenNotifications: exitToPublic,
    onOpenProfile: exitToPublic,
    onOpenSettings: () => onNavigate({ mode: "settings" }),
    onCompose: exitToPublic,
  } as const;

  if (navigation.mode === "verification" || !enabled) {
    return (
      <NoodleShell {...shellProps}>
      <NoodlerFrame onBack={() => onNavigate({ mode: "public", view: "home" })} title="About NoodleR">
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 text-[var(--noodle-blue)]">
            <Lock size={28} />
          </span>
          <h2 className="mt-5 text-2xl font-black">NoodleR is an optional private space.</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
            NoodleR is intended for adults. Private creator accounts stay isolated from the public Noodle timeline.
            Enable access only if you are 18 or older and want to create stage profiles.
          </p>
          <button
            type="button"
            onClick={enableNoodler}
            disabled={!data?.settings || updateSettings.isPending}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--noodle-blue)] px-6 text-sm font-bold text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateSettings.isPending ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
            {updateSettings.isPending ? "Enabling..." : "I am 18+ and want to enable NoodleR"}
          </button>
        </div>
      </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (creationStep === "source") {
    return (
      <NoodleShell {...shellProps}>
      <NoodlerFrame onBack={() => setCreationStep(null)} title="Create stage profile" hideBack>
        <StageProfileSourcePicker
          accounts={eligiblePublicAccounts}
          search={sourceSearch}
          kind={sourceKind}
          selectedId={draftPublicAccountId}
          onSearch={handleSourceSearch}
          onKindChange={handleSourceKind}
          onSelect={setDraftPublicAccountId}
          hasMore={Boolean(eligibleAccountsQuery.hasNextPage)}
          isLoadingMore={eligibleAccountsQuery.isFetchingNextPage}
          isLoading={eligibleAccountsQuery.isLoading}
          isError={eligibleAccountsQuery.isError}
          onRetry={() => void eligibleAccountsQuery.refetch()}
          onLoadMore={() => void eligibleAccountsQuery.fetchNextPage()}
          onBack={() => setCreationStep(null)}
          onContinue={() => setCreationStep("disclosure")}
        />
      </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (creationStep === "disclosure") {
    return (
      <NoodleShell {...shellProps}>
      <NoodlerFrame onBack={() => setCreationStep("source")} title="Set identity disclosure" hideBack>
        <DisclosureStep
          source={selectedSource}
          value={creationDisclosure}
          onChange={setCreationDisclosure}
          onBack={() => setCreationStep("source")}
          onContinue={() => setCreationStep("draft")}
        />
      </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (profileDraft || creationStep === "draft") {
    return (
      <NoodleShell {...shellProps}>
      <NoodlerFrame
        onBack={editingProfileId ? closeProfileEditor : () => setCreationStep("disclosure")}
        title={editingProfileId ? "Edit stage profile" : "Create stage profile"}
        hideBack={!editingProfileId}
      >
        <StageProfileForm
          draft={profileDraft ?? { ...EMPTY_STAGE_PROFILE, disclosureMode: creationDisclosure }}
          source={selectedSource}
          disclosureMode={creationDisclosure}
          onDisclosureChange={changeDisclosure}
          guidance={draftGuidance}
          onGuidanceChange={setDraftGuidance}
          onGenerate={generateDraft}
          isGenerating={generateProfileDraft.isPending}
          previousDraft={previousDraft}
          onUndoDraft={() => {
            if (!previousDraft) return;
            setProfileDraft(previousDraft);
            setPreviousDraft(null);
          }}
          onChange={(patch) =>
            setProfileDraft((current) => ({
              ...(current ?? { ...EMPTY_STAGE_PROFILE, disclosureMode: creationDisclosure }),
              ...patch,
            }))
          }
          publicAccountId={draftPublicAccountId}
          isEditing={Boolean(editingProfileId)}
          isPending={createProfile.isPending || updateProfile.isPending}
          onCancel={editingProfileId ? closeProfileEditor : () => setCreationStep("disclosure")}
          onSave={saveProfile}
        />
      </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (selectedProfile) {
    return (
      <NoodleShell {...shellProps}>
      <NoodlerFrame onBack={() => setSelectedProfileId(null)} title={selectedProfile.displayName}>
        <StageProfileView
          profile={selectedProfile}
          posts={postsQuery.data ?? []}
          viewerAccounts={viewerAccounts}
          isLoading={postsQuery.isLoading}
          isError={postsQuery.isError}
          onRetry={() => void postsQuery.refetch()}
          onEdit={() => beginEdit(selectedProfile)}
          onDelete={() => {
            if (!window.confirm(`Delete ${selectedProfile.displayName} and all of this NoodleR profile's posts?`)) {
              return;
            }
            deleteProfile.mutate(selectedProfile.id, {
              onSuccess: () => {
                setSelectedProfileId(null);
                toast.success("Stage profile deleted.");
              },
              onError: (error) => toast.error(errorMessage(error, "Could not delete the stage profile.")),
            });
          }}
          onGuide={() => {
            setGenerationError(null);
            setGuidedProfile(selectedProfile);
          }}
          accessPending={updateAccess.isPending}
          deletePending={deleteProfile.isPending}
          onAccessChange={(access) =>
            updateAccess.mutate(
              { accountId: selectedProfile.id, ...access },
              {
                onSuccess: () => toast.success("Access settings updated."),
                onError: (error) => toast.error(errorMessage(error, "Could not update access settings.")),
              },
            )
          }
        />
        {guidedProfile && (
          <GuidedPostModal
            profile={guidedProfile}
            isPending={generatePost.isPending}
            error={generationError}
            onClose={() => {
              setGuidedProfile(null);
              setGenerationError(null);
            }}
            onGenerate={submitGuidedPost}
          />
        )}
      </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (showManageProfiles) {
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame onBack={() => setShowManageProfiles(false)} title="Manage profiles">
          <div className="flex min-h-14 items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Stage profiles</p>
              <p className="text-xs text-[var(--muted-foreground)]">Private identities and guided posts</p>
            </div>
            <button
              type="button"
              onClick={beginCreate}
              disabled={sourcePickerLoading || eligibleAccountsQuery.isError || eligiblePublicAccounts.length === 0}
              title={
                sourcePickerLoading
                  ? "Loading eligible sources"
                  : eligibleAccountsQuery.isError
                    ? "Sources unavailable"
                    : eligiblePublicAccounts.length === 0
                      ? "Every eligible account already has a stage profile"
                      : undefined
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--noodle-blue)] px-3 text-xs font-bold text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} />
              New profile
            </button>
          </div>
          {accountsQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[var(--noodle-blue)]" />
            </div>
          ) : accountsQuery.isError ? (
            <EmptyState
              title="Stage profiles could not be loaded."
              action="Try again"
              onAction={() => void accountsQuery.refetch()}
            />
          ) : accountsQuery.data && accountsQuery.data.length > 0 ? (
            <div className="divide-y divide-[var(--noodle-divider)]">
              {accountsQuery.data.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => (profile.disclosureMode ? setSelectedProfileId(profile.id) : beginEdit(profile))}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-4 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-blue)]"
                >
                  <ProfileInitial profile={profile} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold">{profile.displayName}</h3>
                      <DisclosureBadge mode={profile.disclosureMode} />
                    </div>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {profile.disclosureMode ? `@${profile.handle}` : "Complete this legacy stage profile"}
                    </p>
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-[var(--muted-foreground)]" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No stage profiles yet."
              detail="Create a separate private identity for an eligible persona or character."
              action={eligiblePublicAccounts.length > 0 ? "Create stage profile" : undefined}
              onAction={eligiblePublicAccounts.length > 0 ? beginCreate : undefined}
            />
          )}
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  return (
    <NoodleShell {...shellProps}>
      <NoodlerFrame
        onBack={() => onNavigate({ mode: "public", view: "home" })}
        title="NoodleR"
        action={
          <button
            type="button"
            onClick={() => setShowManageProfiles(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-blue)] hover:bg-[var(--noodle-blue)]/10"
            title="Manage profiles"
            aria-label="Manage stage profiles"
          >
            <Users size={18} />
          </button>
        }
      >
        <ViewerHub
          personas={personas}
          personaId={viewerPersonaId}
          onPersonaChange={setStoredPersonaId}
          scope={viewerQuery.data}
          isLoading={viewerQuery.isLoading}
          isError={viewerQuery.isError}
          onRetry={() => void viewerQuery.refetch()}
          subscriptionPending={toggleSubscription.isPending}
          unlockPending={unlockPost.isPending}
          onToggleSubscription={(creatorAccountId, subscribed) => {
            if (!viewerPersonaId) return;
            toggleSubscription.mutate({ creatorAccountId, personaId: viewerPersonaId, subscribed });
          }}
          onUnlock={(postId) => {
            if (!viewerPersonaId) return;
            unlockPost.mutate({ postId, personaId: viewerPersonaId });
          }}
        />
      </NoodlerFrame>
    </NoodleShell>
  );
}

function StageProfileForm({
  draft,
  source,
  disclosureMode,
  onDisclosureChange,
  guidance,
  onGuidanceChange,
  onGenerate,
  isGenerating,
  previousDraft,
  onUndoDraft,
  onChange,
  publicAccountId,
  isEditing,
  isPending,
  onCancel,
  onSave,
}: {
  draft: NoodleStageProfileInput;
  source: { displayName: string; handle: string } | null;
  disclosureMode: NoodleIdentityDisclosure;
  onDisclosureChange: (value: NoodleIdentityDisclosure) => void;
  guidance: string;
  onGuidanceChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  previousDraft: NoodleStageProfileInput | null;
  onUndoDraft: () => void;
  onChange: (patch: Partial<NoodleStageProfileInput>) => void;
  publicAccountId: string | null;
  isEditing: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const canSave =
    Boolean((isEditing || publicAccountId) && draft.displayName.trim() && draft.handle.trim()) &&
    !isPending &&
    !isGenerating;
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:py-6">
        <div className="rounded-lg border border-[var(--noodle-divider)] bg-[var(--accent)]/40 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 text-[var(--noodle-blue)]">
              <Sparkles size={16} />
            </span>
            <div>
              <p className="text-sm font-bold">
                {isEditing ? "Refine this stage identity" : "Create the stage identity"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                {source
                  ? `Built from ${source.displayName} (@${source.handle})`
                  : "Your source identity is kept separate from this stage profile."}{" "}
                Relationship:{" "}
                <span className="font-bold">
                  {DISCLOSURE_OPTIONS.find((option) => option.value === disclosureMode)?.label}
                </span>
                .
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <div className="order-2 rounded-lg border border-[var(--noodle-divider)] p-4 lg:order-1 lg:sticky lg:top-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Sparkles size={15} /> AI assist
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              Generate an editable starting point or rewrite the current fields.
            </p>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold">Optional direction for AI</span>
              <textarea
                value={guidance}
                maxLength={2000}
                disabled={isGenerating || isPending}
                onChange={(event) => onGuidanceChange(event.target.value)}
                placeholder="A mysterious late-night photographer with a warm but guarded voice"
                className={`${textareaClass} min-h-20`}
              />
            </label>
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating || isPending}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--noodle-blue)] px-4 text-sm font-bold text-zinc-950 hover:opacity-90 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{" "}
              {isGenerating
                ? "Generating draft..."
                : previousDraft
                  ? "Rewrite editable draft"
                  : "Generate editable draft"}
            </button>
            {previousDraft && !isGenerating && (
              <button
                type="button"
                onClick={onUndoDraft}
                className="mt-1 flex min-h-11 w-full items-center justify-center text-xs font-semibold text-[var(--noodle-blue)] hover:underline"
              >
                Undo AI changes
              </button>
            )}
          </div>
          <div className="order-1 space-y-5 lg:order-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs font-semibold">Stage name</span>
                <input
                  required
                  aria-required="true"
                  disabled={isGenerating || isPending}
                  value={draft.displayName}
                  maxLength={120}
                  onChange={(event) => onChange({ displayName: event.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold">Stage handle</span>
                <input
                  required
                  aria-required="true"
                  disabled={isGenerating || isPending}
                  value={draft.handle}
                  maxLength={40}
                  onChange={(event) => onChange({ handle: event.target.value })}
                  placeholder="afterhours"
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="block space-y-2">
              <span className="text-xs font-semibold">Bio</span>
              <textarea
                disabled={isGenerating || isPending}
                value={draft.bio}
                maxLength={500}
                onChange={(event) => onChange({ bio: event.target.value })}
                className={textareaClass}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold">Stage voice</span>
              <textarea
                disabled={isGenerating || isPending}
                value={draft.stagePersonality}
                maxLength={1000}
                onChange={(event) => onChange({ stagePersonality: event.target.value })}
                placeholder="Voice, attitude, boundaries, and creator persona"
                className={textareaClass}
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold">Identity relationship</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {DISCLOSURE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={disclosureMode === option.value}
                    disabled={isGenerating || isPending}
                    onClick={() => onDisclosureChange(option.value)}
                    className={`min-h-11 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${disclosureMode === option.value ? "border-[var(--noodle-blue)] bg-[var(--noodle-blue)]/10 text-[var(--foreground)]" : "border-[var(--noodle-divider)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      </div>
      <WizardFooter
        step={2}
        onBack={onCancel}
        backLabel={isEditing ? "Cancel" : "Back"}
        showProgress={!isEditing}
        disabled={isPending || isGenerating}
        finalAction={
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--noodle-blue)] px-5 text-sm font-bold text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {isPending ? "Saving..." : isEditing ? "Save changes" : "Create stage profile"}
          </button>
        }
      />
    </div>
  );
}

function StageProfileSourcePicker({
  accounts,
  search,
  kind,
  selectedId,
  onSearch,
  onKindChange,
  onSelect,
  hasMore,
  isLoadingMore,
  isLoading,
  isError,
  onRetry,
  onLoadMore,
  onBack,
  onContinue,
}: {
  accounts: Array<{
    id: string;
    kind: "character" | "persona" | "random_user";
    displayName: string;
    handle: string;
    bio: string;
    avatarUrl: string | null;
  }>;
  search: string;
  kind: "all" | "character" | "persona";
  selectedId: string | null;
  onSearch: (value: string) => void;
  onKindChange: (value: "all" | "character" | "persona") => void;
  onSelect: (id: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:py-6">
        <h2 className="text-xl font-black">Choose a source character or persona</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
          NoodleR will create a separate stage identity from this character or persona. You will choose exactly how much
          of the public identity can carry over next.
        </p>
        <label className="relative mt-5 block">
          <Search size={16} className="absolute left-3 top-3 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search characters and personas"
            className={`${fieldClass} pl-9`}
          />
        </label>
        {selectedId && !accounts.some((account) => account.id === selectedId) && (
          <p className="mt-3 rounded-md border border-[var(--noodle-blue)]/40 bg-[var(--noodle-blue)]/10 p-3 text-xs leading-5 text-[var(--foreground)]">
            A selected source is hidden by the current search or filter. Clear the search or switch to All to review it.
          </p>
        )}
        {isLoading ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--noodle-divider)] py-12 text-sm text-[var(--muted-foreground)]">
            <Loader2 size={18} className="animate-spin" /> Loading sources...
          </div>
        ) : isError ? (
          <div className="mt-4 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-6 text-center">
            <p className="text-sm font-semibold">Sources could not be loaded.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-11 rounded-md border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)]"
            >
              Try again
            </button>
          </div>
        ) : (
          <div
            className="mt-3 grid grid-cols-3 rounded-lg border border-[var(--noodle-divider)] p-1"
            aria-label="Filter profile sources"
          >
            {(["all", "character", "persona"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => onKindChange(option)}
                className={`min-h-11 rounded-md px-2 text-xs font-semibold capitalize ${kind === option ? "bg-[var(--noodle-blue)] text-zinc-950" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"}`}
              >
                {option === "all" ? "All" : option === "character" ? "Characters" : "Personas"}
              </button>
            ))}
          </div>
        )}
        {!isLoading && !isError && (
          <div className="mt-4 max-h-[min(28rem,50vh)] divide-y divide-[var(--noodle-divider)] overflow-y-auto rounded-lg border border-[var(--noodle-divider)]">
            {accounts.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--muted-foreground)]">
                No eligible source accounts match that search.
              </p>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onSelect(account.id)}
                  className={`flex min-h-16 w-full items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-blue)] ${selectedId === account.id ? "bg-[var(--noodle-blue)]/10" : "hover:bg-[var(--accent)]"}`}
                >
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <ProfileInitial profile={account} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{account.displayName}</span>
                    <span className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="truncate">@{account.handle}</span>
                      <span className="shrink-0 rounded-full border border-[var(--noodle-divider)] px-1.5 py-0.5 text-[0.625rem] font-bold capitalize">
                        {account.kind}
                      </span>
                    </span>
                    {account.bio && (
                      <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">{account.bio}</span>
                    )}
                  </span>
                  {selectedId === account.id ? (
                    <Check size={18} className="text-[var(--noodle-blue)]" />
                  ) : (
                    <ChevronRight size={17} className="text-[var(--muted-foreground)]" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
        {!isLoading && !isError && hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--noodle-divider)] text-sm font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {isLoadingMore && <Loader2 size={15} className="animate-spin" />}
            {isLoadingMore ? "Loading more..." : "Load more characters"}
          </button>
        )}
      </div>
      <WizardFooter
        step={0}
        onBack={onBack}
        onNext={onContinue}
        nextDisabled={!selectedId || !accounts.some((account) => account.id === selectedId)}
      />
    </div>
  );
}

function DisclosureStep({
  source,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  source: { displayName: string; handle: string } | null;
  value: NoodleIdentityDisclosure;
  onChange: (value: NoodleIdentityDisclosure) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:py-6">
        <h2 className="text-xl font-black">How connected should this feel?</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Choose the relationship between this private stage identity and the character or persona you selected. This is
          about identity disclosure, not access, subscriptions, or who can view posts.
        </p>
        {source && (
          <p className="mt-4 rounded-md bg-[var(--accent)] p-3 text-xs text-[var(--muted-foreground)]">
            Source: <span className="font-bold text-[var(--foreground)]">{source.displayName}</span> (@{source.handle})
          </p>
        )}
        <div className="mt-5 space-y-3">
          {DISCLOSURE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
              className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left ${value === option.value ? "border-[var(--noodle-blue)] bg-[var(--noodle-blue)]/10" : "border-[var(--noodle-divider)] hover:bg-[var(--accent)]"}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${value === option.value ? "border-[var(--noodle-blue)] bg-[var(--noodle-blue)]" : "border-[var(--noodle-divider)]"}`}
              >
                {value === option.value && <Check size={13} className="text-zinc-950" />}
              </span>
              <span>
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{option.detail}</span>
                <span className="mt-2 block text-xs leading-5 text-[var(--muted-foreground)]">{option.guidance}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <WizardFooter step={1} onBack={onBack} onNext={onContinue} />
    </div>
  );
}

function WizardFooter({
  step,
  onBack,
  onNext,
  nextDisabled = false,
  finalAction,
  disabled = false,
  backLabel = "Back",
  showProgress = true,
}: {
  step: 0 | 1 | 2;
  onBack: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  finalAction?: ReactNode;
  disabled?: boolean;
  backLabel?: string;
  showProgress?: boolean;
}) {
  const labels = ["Source", "Disclosure", "Profile"];
  return (
    <div className="z-10 shrink-0 border-t border-[var(--noodle-divider)] bg-[var(--background)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
      {showProgress && (
        <div
          className="mb-3 flex items-center justify-center gap-1.5"
          role="status"
          aria-label={`Step ${step + 1} of ${labels.length}: ${labels[step]}`}
        >
          {labels.map((label, index) => (
            <span key={label} className="flex items-center gap-1.5">
              <span
                aria-current={index === step ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${label}${index === step ? ", current" : index < step ? ", complete" : ""}`}
                title={label}
                className={`h-1.5 rounded-full transition-all ${index === step ? "w-6 bg-[var(--noodle-blue)]" : index < step ? "w-4 bg-[var(--noodle-blue)]/45" : "w-2 bg-[var(--muted-foreground)]/25"}`}
              />
              {index < labels.length - 1 && <span className="sr-only">to</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
        >
          <ArrowLeft size={15} /> {backLabel}
        </button>
        {finalAction ?? (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || disabled}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--noodle-blue)] px-5 text-sm font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function StageProfileView({
  profile,
  posts,
  viewerAccounts,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onDelete,
  onGuide,
  accessPending,
  deletePending,
  onAccessChange,
}: {
  profile: NoodlerManagedStageProfile;
  posts: Array<{ id: string; content: string; imagePrompt: string | null; createdAt: string }>;
  viewerAccounts: NoodleAccount[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGuide: () => void;
  accessPending: boolean;
  deletePending: boolean;
  onAccessChange: (access: NoodlerManagedStageProfile["access"]) => void;
}) {
  const [accessSettingsOpen, setAccessSettingsOpen] = useState(false);
  return (
    <>
      <section className="border-b border-[var(--noodle-divider)] px-5 py-6">
        <div className="flex items-start gap-4">
          <ProfileInitial profile={profile} large />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black">{profile.displayName}</h2>
              <DisclosureBadge mode={profile.disclosureMode} />
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">@{profile.handle}</p>
            {profile.bio && <p className="mt-3 max-w-[70ch] text-sm leading-6">{profile.bio}</p>}
            {profile.publicIdentity && (
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Openly linked to {profile.publicIdentity.displayName} (@{profile.publicIdentity.handle})
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGuide}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--noodle-blue)] px-3 text-xs font-bold text-zinc-950 hover:opacity-90"
          >
            <Sparkles size={15} />
            Guide post
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
          >
            <Pencil size={14} />
            Edit profile
          </button>
          <button
            type="button"
            onClick={() => setAccessSettingsOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
          >
            <Lock size={14} />
            Subscriber access
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deletePending}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--destructive)]/45 px-3 text-xs font-bold text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:cursor-wait disabled:opacity-50"
          >
            {deletePending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deletePending ? "Deleting..." : "Delete profile"}
          </button>
        </div>
      </section>
      <Modal
        open={accessSettingsOpen}
        onClose={() => setAccessSettingsOpen(false)}
        title="Subscriber access"
        width="max-w-md"
        panelStyle={{ "--noodle-blue": "#7EA7FF" } as React.CSSProperties}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              These rules apply only to this stage profile.
            </p>
            {accessPending && <Loader2 size={16} className="shrink-0 animate-spin text-[var(--noodle-blue)]" />}
          </div>
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-[var(--noodle-divider)] px-3 py-2">
            <span>
              <span className="block text-xs font-bold">Subscriptions include PPV</span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                Subscribers skip individual PPV unlocks.
              </span>
            </span>
            <input
              type="checkbox"
              checked={profile.access.subscriptionIncludesPpv}
              disabled={accessPending}
              onChange={(event) => onAccessChange({ ...profile.access, subscriptionIncludesPpv: event.target.checked })}
              className="h-5 w-5 accent-[var(--noodle-blue)]"
            />
          </label>
          {viewerAccounts.length > 0 && (
            <fieldset>
              <legend className="text-xs font-bold">Hidden from personas</legend>
              <div className="mt-2 divide-y divide-[var(--noodle-divider)] rounded-md border border-[var(--noodle-divider)]">
                {viewerAccounts.map((account) => {
                  const owningAccount = profile.publicAccountId === account.id;
                  const checked = profile.access.hiddenFromAccountIds.includes(account.id);
                  return (
                    <label key={account.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate text-xs font-semibold">{account.displayName}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={accessPending || owningAccount}
                        onChange={(event) =>
                          onAccessChange({
                            ...profile.access,
                            hiddenFromAccountIds: event.target.checked
                              ? [...profile.access.hiddenFromAccountIds, account.id]
                              : profile.access.hiddenFromAccountIds.filter((id) => id !== account.id),
                          })
                        }
                        className="h-5 w-5 accent-[var(--noodle-blue)]"
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      </Modal>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--noodle-blue)]" />
        </div>
      ) : isError ? (
        <EmptyState title="Private posts could not be loaded." action="Try again" onAction={onRetry} />
      ) : posts.length > 0 ? (
        <div className="divide-y divide-[var(--noodle-divider)]">
          {posts.map((post) => (
            <article key={post.id} className="px-5 py-5">
              <p className="whitespace-pre-wrap text-sm leading-6">{post.content}</p>
              {post.imagePrompt && (
                <p className="mt-3 rounded-lg bg-[var(--accent)] p-3 text-xs leading-5 text-[var(--muted-foreground)]">
                  <span className="font-bold text-[var(--foreground)]">Stored image prompt: </span>
                  {post.imagePrompt}
                </p>
              )}
              <time className="mt-3 block text-xs text-[var(--muted-foreground)]">
                {new Date(post.createdAt).toLocaleString()}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No private posts yet."
          detail="Guide the first post for this stage identity."
          action="Guide post"
          onAction={onGuide}
        />
      )}
    </>
  );
}

function ViewerHub({
  personas,
  personaId,
  onPersonaChange,
  scope,
  isLoading,
  isError,
  onRetry,
  subscriptionPending,
  unlockPending,
  onToggleSubscription,
  onUnlock,
}: {
  personas: Persona[];
  personaId: string | null;
  onPersonaChange: (id: string | null) => void;
  scope: ReturnType<typeof useNoodlerViewer>["data"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  subscriptionPending: boolean;
  unlockPending: boolean;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  onUnlock: (postId: string) => void;
}) {
  if (personas.length === 0) {
    return (
      <EmptyState
        title="Create a persona to browse NoodleR."
        detail="Subscriptions and unlocks belong to one viewer persona."
      />
    );
  }
  return (
    <div>
      <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
        <label className="block text-xs font-bold" htmlFor="noodler-viewer-persona">
          Viewer persona
        </label>
        <select
          id="noodler-viewer-persona"
          value={personaId ?? ""}
          onChange={(event) => onPersonaChange(event.target.value || null)}
          className={`${fieldClass} mt-2`}
        >
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.name || persona.convoDisplayName || "Persona"}
            </option>
          ))}
        </select>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--noodle-blue)]" />
        </div>
      ) : isError ? (
        <EmptyState title="NoodleR could not be loaded for this persona." action="Try again" onAction={onRetry} />
      ) : scope && scope.creators.length > 0 ? (
        <div className="divide-y divide-[var(--noodle-divider)]">
          {scope.creators.map((creator) => (
            <section key={creator.profile.id} className="px-4 py-5">
              <div className="flex items-center gap-3">
                <ProfileInitial profile={creator.profile} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold">{creator.profile.displayName}</h3>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">@{creator.profile.handle}</p>
                </div>
                <button
                  type="button"
                  disabled={subscriptionPending}
                  onClick={() => onToggleSubscription(creator.profile.id, creator.subscribed)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-bold ${creator.subscribed ? "border border-[var(--noodle-divider)]" : "bg-[var(--noodle-blue)] text-zinc-950"}`}
                >
                  <Users size={14} /> {creator.subscribed ? "Subscribed" : "Subscribe"}
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {creator.posts.map((post) => (
                  <article key={post.id} className="rounded-md border border-[var(--noodle-divider)] p-4">
                    {post.locked ? (
                      <div className="flex items-center gap-3">
                        <Lock size={18} className="shrink-0 text-[var(--noodle-blue)]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold">
                            {post.access === "ppv" ? "PPV post" : "Subscriber-only post"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {post.access === "ppv"
                              ? `${post.ppvPrice ?? 0} credits to unlock`
                              : "Subscribe to reveal this post."}
                          </p>
                        </div>
                        {post.access === "ppv" && (
                          <button
                            type="button"
                            disabled={unlockPending}
                            onClick={() => onUnlock(post.id)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--noodle-blue)] px-3 text-xs font-bold text-zinc-950"
                          >
                            <Eye size={14} /> Unlock
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6">{post.content}</p>
                    )}
                  </article>
                ))}
                {creator.posts.length === 0 && <p className="text-xs text-[var(--muted-foreground)]">No posts yet.</p>}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title="No stage profiles are visible to this persona." />
      )}
    </div>
  );
}

function ProfileInitial({
  profile,
  large = false,
}: {
  profile: Pick<NoodlerStageProfile, "displayName">;
  large?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 font-black text-[var(--noodle-blue)] ${large ? "h-16 w-16 text-xl" : "h-11 w-11"}`}
    >
      {Array.from(profile.displayName)[0]?.toUpperCase() || <UserRound size={20} />}
    </span>
  );
}

function DisclosureBadge({ mode }: { mode: NoodleIdentityDisclosure | null }) {
  const label = mode ? DISCLOSURE_OPTIONS.find((option) => option.value === mode)?.shortLabel : "Setup needed";
  return (
    <span className="rounded-full border border-[var(--noodle-divider)] px-2 py-0.5 text-[0.68rem] font-bold capitalize text-[var(--muted-foreground)]">
      {label}
    </span>
  );
}

function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-8 py-16 text-center">
      <UserRound size={36} className="mx-auto text-[var(--noodle-blue)]" />
      <p className="mt-4 font-bold">{title}</p>
      {detail && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 h-9 rounded-md border border-[var(--noodle-divider)] px-4 text-xs font-bold hover:bg-[var(--accent)]"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function NoodlerFrame({
  children,
  onBack,
  title,
  hideBack = false,
  action,
}: {
  children: ReactNode;
  onBack: () => void;
  title: string;
  hideBack?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] px-2">
        {!hideBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--noodle-blue)] hover:bg-[var(--noodle-blue)]/10"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
        {action}
        <span className="rounded-full bg-[var(--noodle-blue)]/10 px-2.5 py-1 text-[0.65rem] font-bold text-[var(--noodle-blue)]">
          Private
        </span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
