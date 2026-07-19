import { ArrowLeft, Check, ChevronRight, Loader2, Lock, Pencil, Plus, Sparkles, UserRound } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import type { NoodleIdentityDisclosure, NoodleStageProfileInput, NoodlerStageProfile } from "@marinara-engine/shared";
import {
  useCreateNoodlerStageProfile,
  useGeneratePrivateNoodlePost,
  useNoodle,
  useNoodlerAccounts,
  useNoodlerEligibleAccounts,
  useNoodlerPosts,
  useUpdateNoodleSettings,
  useUpdateNoodlerStageProfile,
} from "../../hooks/use-noodle";
import { GuidedPostModal } from "./GuidedPostModal";
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
  detail: string;
}> = [
  { value: "open", label: "Open", detail: "Public identity may be named." },
  { value: "hinted", label: "Hinted", detail: "General allusions, never the exact public name or handle." },
  { value: "secret", label: "Secret", detail: "The linked public identity stays fully withheld." },
];

const EMPTY_STAGE_PROFILE: NoodleStageProfileInput = {
  displayName: "",
  handle: "",
  bio: "",
  stagePersonality: "",
  disclosureMode: "hinted",
};

const fieldClass =
  "mari-chrome-field h-10 w-full rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-blue)]";
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
  const eligibleAccountsQuery = useNoodlerEligibleAccounts(navigation.mode === "private" && enabled);
  const createProfile = useCreateNoodlerStageProfile();
  const updateProfile = useUpdateNoodlerStageProfile();
  const generatePost = useGeneratePrivateNoodlePost();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<NoodleStageProfileInput | null>(null);
  const [draftPublicAccountId, setDraftPublicAccountId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [guidedProfile, setGuidedProfile] = useState<NoodlerStageProfile | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const selectedProfile = accountsQuery.data?.find((profile) => profile.id === selectedProfileId) ?? null;
  const postsQuery = useNoodlerPosts(selectedProfile?.id ?? null);
  const eligiblePublicAccounts = eligibleAccountsQuery.data ?? [];

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
    setDraftPublicAccountId(eligiblePublicAccounts[0]?.id ?? null);
    setProfileDraft({ ...EMPTY_STAGE_PROFILE });
  };

  const beginEdit = (profile: NoodlerStageProfile) => {
    setEditingProfileId(profile.id);
    setDraftPublicAccountId(profile.publicAccountId);
    setProfileDraft({
      displayName: profile.displayName,
      handle: profile.handle,
      bio: profile.bio,
      stagePersonality: profile.stagePersonality,
      disclosureMode: profile.disclosureMode ?? "hinted",
    });
  };

  const saveProfile = () => {
    if (!profileDraft) return;
    const input = {
      ...profileDraft,
      handle: profileDraft.handle.replace(/^@+/u, ""),
    };
    const onSuccess = () => {
      setProfileDraft(null);
      setEditingProfileId(null);
      setDraftPublicAccountId(null);
      toast.success(editingProfileId ? "Stage profile updated." : "Stage profile created.");
    };
    const onError = (error: unknown) => toast.error(errorMessage(error, "Could not save the stage profile."));
    if (editingProfileId) {
      updateProfile.mutate({ accountId: editingProfileId, ...input }, { onSuccess, onError });
    } else if (draftPublicAccountId) {
      createProfile.mutate({ publicAccountId: draftPublicAccountId, stageProfile: input }, { onSuccess, onError });
    }
  };

  const submitGuidedPost = (direction: string) => {
    if (!guidedProfile) return;
    setGenerationError(null);
    generatePost.mutate(
      { targetAccountId: guidedProfile.id, privatePostGuide: direction.trim() },
      {
        onSuccess: () => {
          setGuidedProfile(null);
          toast.success("Private post generated.");
        },
        onError: (error) => setGenerationError(errorMessage(error, "Could not generate this post.")),
      },
    );
  };

  if (navigation.mode === "verification" || !enabled) {
    return (
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
    );
  }

  if (profileDraft) {
    return (
      <NoodlerFrame
        onBack={() => {
          setProfileDraft(null);
          setEditingProfileId(null);
        }}
        title={editingProfileId ? "Edit stage profile" : "Create stage profile"}
      >
        <StageProfileForm
          draft={profileDraft}
          onChange={(patch) => setProfileDraft((current) => (current ? { ...current, ...patch } : current))}
          publicAccountId={draftPublicAccountId}
          publicAccounts={eligiblePublicAccounts}
          onPublicAccountChange={setDraftPublicAccountId}
          isEditing={Boolean(editingProfileId)}
          isPending={createProfile.isPending || updateProfile.isPending}
          onCancel={() => setProfileDraft(null)}
          onSave={saveProfile}
        />
      </NoodlerFrame>
    );
  }

  if (selectedProfile) {
    return (
      <NoodlerFrame onBack={() => setSelectedProfileId(null)} title={selectedProfile.displayName}>
        <StageProfileView
          profile={selectedProfile}
          posts={postsQuery.data ?? []}
          isLoading={postsQuery.isLoading}
          isError={postsQuery.isError}
          onRetry={() => void postsQuery.refetch()}
          onEdit={() => beginEdit(selectedProfile)}
          onGuide={() => {
            setGenerationError(null);
            setGuidedProfile(selectedProfile);
          }}
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
    );
  }

  return (
    <NoodlerFrame onBack={() => onNavigate({ mode: "public", view: "home" })} title="NoodleR">
      <div className="flex min-h-14 items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Stage profiles</p>
          <p className="text-xs text-[var(--muted-foreground)]">Private identities and guided posts</p>
        </div>
        <button
          type="button"
          onClick={beginCreate}
          disabled={eligiblePublicAccounts.length === 0}
          title={eligiblePublicAccounts.length === 0 ? "Every eligible account already has a stage profile" : undefined}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--noodle-blue)] px-3 text-xs font-bold text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-[var(--accent)]"
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
  );
}

function StageProfileForm({
  draft,
  onChange,
  publicAccountId,
  publicAccounts,
  onPublicAccountChange,
  isEditing,
  isPending,
  onCancel,
  onSave,
}: {
  draft: NoodleStageProfileInput;
  onChange: (patch: Partial<NoodleStageProfileInput>) => void;
  publicAccountId: string | null;
  publicAccounts: Array<{ id: string; displayName: string; handle: string }>;
  onPublicAccountChange: (id: string) => void;
  isEditing: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const canSave =
    Boolean((isEditing || publicAccountId) && draft.displayName.trim() && draft.handle.trim()) && !isPending;
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="space-y-5">
        {!isEditing && (
          <label className="block space-y-2">
            <span className="text-xs font-semibold">Linked public account</span>
            <select
              value={publicAccountId ?? ""}
              onChange={(event) => onPublicAccountChange(event.target.value)}
              className={fieldClass}
            >
              {publicAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName} (@{account.handle})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-xs font-semibold">Stage name</span>
            <input
              value={draft.displayName}
              maxLength={120}
              onChange={(event) => onChange({ displayName: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold">Stage handle</span>
            <input
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
            value={draft.bio}
            maxLength={500}
            onChange={(event) => onChange({ bio: event.target.value })}
            className={textareaClass}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold">Stage voice</span>
          <textarea
            value={draft.stagePersonality}
            maxLength={1000}
            onChange={(event) => onChange({ stagePersonality: event.target.value })}
            placeholder="Voice, attitude, boundaries, and creator persona"
            className={textareaClass}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold">Identity disclosure</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {DISCLOSURE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={draft.disclosureMode === option.value}
                onClick={() => onChange({ disclosureMode: option.value })}
                className={`min-h-24 rounded-lg border p-3 text-left transition-colors ${draft.disclosureMode === option.value ? "border-[var(--noodle-blue)] bg-[var(--noodle-blue)]/10" : "border-[var(--noodle-divider)] hover:bg-[var(--accent)]"}`}
              >
                <span className="text-sm font-bold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{option.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="h-10 rounded-md border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--noodle-blue)] px-5 text-sm font-bold text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {isPending ? "Saving..." : "Save stage profile"}
        </button>
      </div>
    </div>
  );
}

function StageProfileView({
  profile,
  posts,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onGuide,
}: {
  profile: NoodlerStageProfile;
  posts: Array<{ id: string; content: string; imagePrompt: string | null; createdAt: string }>;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onGuide: () => void;
}) {
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
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--noodle-blue)] px-3 text-xs font-bold text-zinc-950 hover:opacity-90"
          >
            <Sparkles size={15} />
            Guide post
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
          >
            <Pencil size={14} />
            Edit profile
          </button>
        </div>
      </section>
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
  return (
    <span className="rounded-full border border-[var(--noodle-divider)] px-2 py-0.5 text-[0.68rem] font-bold capitalize text-[var(--muted-foreground)]">
      {mode ?? "Setup needed"}
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

function NoodlerFrame({ children, onBack, title }: { children: ReactNode; onBack: () => void; title: string }) {
  return (
    <div
      className="mari-chrome-token-scope relative flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]"
      style={
        { "--noodle-blue": "#7EA7FF", "--noodle-divider": "var(--marinara-chat-chrome-panel-divider)" } as CSSProperties
      }
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--noodle-divider)] px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-blue)] hover:bg-[var(--noodle-blue)]/10"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
        <span className="rounded-full bg-[var(--noodle-blue)]/10 px-2.5 py-1 text-[0.65rem] font-bold text-[var(--noodle-blue)]">
          Private
        </span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
