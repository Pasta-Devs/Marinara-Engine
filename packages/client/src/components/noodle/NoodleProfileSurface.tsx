import { MapPin } from "lucide-react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import { cn } from "../../lib/utils";
import { Avatar, NoodleLogo } from "./NoodleShell";
import { useTranslation as useUiTranslation } from "react-i18next";

type NoodleProfileTab = "posts" | "likes" | "media";

const fieldClass =
  "mari-chrome-field h-9 w-full min-w-0 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]";

const profileTabs: Array<{ id: NoodleProfileTab; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "likes", label: "Likes" },
  { id: "media", label: "Media" },
];

interface NoodleProfileSurfaceProps<TTab extends string = NoodleProfileTab> {
  mobileHeader: ReactNode;
  account: Parameters<typeof Avatar>[0]["account"];
  displayHandle: string;
  handleMeta?: ReactNode;
  banner?: {
    url: string;
    canEdit: boolean;
    uploadTarget: "avatar" | "banner" | null;
    fileRef: RefObject<HTMLInputElement | null>;
    onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  };
  avatarUpload?: {
    canEdit: boolean;
    uploadTarget: "avatar" | "banner" | null;
    fileRef: RefObject<HTMLInputElement | null>;
    onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  };
  editor?: {
    isEditing: boolean;
    onStartEditing: () => void;
    onSave: () => void;
    canSave: boolean;
    isSaving: boolean;
    name: string;
    onNameChange: (value: string) => void;
    handle: string;
    onHandleChange: (value: string) => void;
    bio: string;
    onBioChange: (value: string) => void;
    location: string;
    onLocationChange: (value: string) => void;
  };
  followAction?: { followed: boolean; pending: boolean; onToggle: () => void };
  leadingActions?: ReactNode;
  secondaryActions?: ReactNode;
  decorativeBanner?: boolean;
  location?: string;
  bioContent: ReactNode;
  contentActions?: ReactNode;
  connections?: {
    followingCount: number;
    followerCount: number;
    onOpenFollowing: () => void;
    onOpenFollowers: () => void;
  };
  tabs?: Array<{ id: TTab; label: ReactNode; ariaLabel?: string }>;
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  preTabsContent?: ReactNode;
  postList: ReactNode;
}

export function NoodleProfileSurface<TTab extends string = NoodleProfileTab>({
  mobileHeader,
  account,
  displayHandle,
  handleMeta,
  banner,
  avatarUpload,
  editor,
  followAction,
  leadingActions,
  secondaryActions,
  decorativeBanner = false,
  location,
  bioContent,
  contentActions,
  connections,
  tabs,
  activeTab,
  onTabChange,
  preTabsContent,
  postList,
}: NoodleProfileSurfaceProps<TTab>) {
  const { t: localizeUi } = useUiTranslation();
  const hasBanner = Boolean(banner) || decorativeBanner;
  const resolvedTabs = tabs ?? (profileTabs as Array<{ id: TTab; label: ReactNode; ariaLabel?: string }>);
  return (
    <div className="relative border-b border-[var(--noodle-divider)]">
      {mobileHeader}
      {banner && (
        <>
          <button
            type="button"
            onClick={() => {
              if (banner.canEdit) banner.fileRef.current?.click();
            }}
            disabled={!banner.canEdit || banner.uploadTarget === "banner"}
            className={cn(
              "relative block h-40 w-full overflow-hidden bg-[var(--noodle-accent)]/15 text-left disabled:cursor-default",
              banner.uploadTarget === "banner" && "cursor-wait opacity-80",
            )}
            title={banner.canEdit ? localizeUi("ui.noodle.noodleprofilesurface.uploadBanner") : undefined}
          >
            {banner.url ? (
              <img src={banner.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-[var(--noodle-accent)]/10">
                <NoodleLogo className="h-20 w-32 opacity-70" />
              </div>
            )}
            {banner.uploadTarget === "banner" && (
              <span className="absolute bottom-3 right-3 rounded-full bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--noodle-accent)] shadow-lg ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
                {localizeUi("ui.noodle.noodleprofilesurface.uploading")}
              </span>
            )}
          </button>
          <input ref={banner.fileRef} type="file" accept="image/*" className="hidden" onChange={banner.onFileChange} />
        </>
      )}
      {!banner && decorativeBanner && <div className="h-40 w-full bg-[var(--noodle-accent)]/10" aria-hidden="true" />}

      <div className={decorativeBanner ? "px-6 pb-3" : "px-4 pb-5"}>
        <div className={cn("flex items-end justify-between gap-3", hasBanner ? "-mt-10" : "pt-5")}>
          {avatarUpload ? (
            <button
              type="button"
              onClick={() => {
                if (avatarUpload.canEdit) avatarUpload.fileRef.current?.click();
              }}
              disabled={!avatarUpload.canEdit || avatarUpload.uploadTarget === "avatar"}
              className={cn(
                "relative rounded-full bg-[var(--background)] p-1 text-left disabled:cursor-default",
                avatarUpload.uploadTarget === "avatar" && "cursor-wait opacity-80",
              )}
              title={avatarUpload.canEdit ? localizeUi("editor.avatar.upload") : undefined}
            >
              <Avatar account={account} size="lg" />
              {avatarUpload.uploadTarget === "avatar" && (
                <span className="absolute inset-1 flex items-center justify-center rounded-full bg-black/50 text-[0.625rem] font-semibold text-white">
                  {localizeUi("ui.noodle.noodleprofilesurface.uploading_de27240")}
                </span>
              )}
            </button>
          ) : decorativeBanner ? (
            <div className="shrink-0 rounded-full ring-4 ring-[var(--background)]">
              <Avatar account={account} size="lg" solid />
            </div>
          ) : (
            <Avatar account={account} size="lg" />
          )}
          {avatarUpload && (
            <input
              ref={avatarUpload.fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={avatarUpload.onFileChange}
            />
          )}
          <div className="mb-1 flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            {leadingActions}
            {editor ? (
              <button
                type="button"
                onClick={() => {
                  if (editor.isEditing) editor.onSave();
                  else editor.onStartEditing();
                }}
                disabled={editor.isEditing ? !editor.canSave || editor.isSaving : false}
                className="h-9 rounded-full bg-[var(--noodle-accent)] px-5 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editor.isEditing
                  ? editor.isSaving
                    ? localizeUi("ui.noodle.noodlehome.saving")
                    : localizeUi("ui.noodle.noodlehome.save")
                  : localizeUi("ui.noodle.stageprofileview.editProfile")}
              </button>
            ) : followAction ? (
              <button
                type="button"
                onClick={followAction.onToggle}
                disabled={followAction.pending}
                className={cn(
                  "h-9 rounded-full px-5 text-xs font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
                  followAction.followed
                    ? "border border-[var(--noodle-divider)] text-[var(--foreground)]"
                    : "bg-[var(--foreground)] text-[var(--background)]",
                )}
              >
                {followAction.followed
                  ? localizeUi("ui.noodle.connections.tabs.following")
                  : localizeUi("ui.noodle.noodlehome.follow")}
              </button>
            ) : null}
            {secondaryActions}
          </div>
        </div>

        {editor?.isEditing ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className={labelClass}>{localizeUi("ui.noodle.noodleprofilesurface.displayName")}</span>
                <input
                  value={editor.name}
                  onChange={(event) => editor.onNameChange(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelClass}>{localizeUi("ui.noodle.noodleprofilesurface.name")}</span>
                <input
                  value={editor.handle}
                  onChange={(event) => editor.onHandleChange(event.target.value)}
                  className={fieldClass}
                  placeholder={localizeUi("ui.noodle.noodleprofilesurface.mari")}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className={labelClass}>{localizeUi("ui.noodle.noodleprofilesurface.bio")}</span>
              <textarea
                value={editor.bio}
                onChange={(event) => editor.onBioChange(event.target.value)}
                className={cn(fieldClass, "h-24 resize-none py-2")}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>{localizeUi("ui.noodle.noodleprofilesurface.location")}</span>
              <input
                value={editor.location}
                onChange={(event) => editor.onLocationChange(event.target.value)}
                className={fieldClass}
                placeholder={localizeUi("ui.noodle.noodleprofilesurface.somewhereCozy")}
              />
            </label>
          </div>
        ) : (
          <div className="mt-3">
            <h3 className="text-xl font-bold leading-tight">{account.displayName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <span>@{displayHandle || "noodle"}</span>
              {handleMeta}
            </div>
            {bioContent}
            {contentActions}
            {location && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                <MapPin size={15} className="text-[var(--noodle-accent)]" />
                {location}
              </p>
            )}
            {connections && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--muted-foreground)]">
                <button
                  type="button"
                  onClick={connections.onOpenFollowing}
                  className="transition-colors hover:text-[var(--noodle-accent)]"
                >
                  <span className="font-bold text-[var(--foreground)]">{connections.followingCount}</span>{" "}
                  {localizeUi("ui.noodle.noodleprofilesurface.following")}
                </button>
                <button
                  type="button"
                  onClick={connections.onOpenFollowers}
                  className="transition-colors hover:text-[var(--noodle-accent)]"
                >
                  <span className="font-bold text-[var(--foreground)]">{connections.followerCount}</span>{" "}
                  {localizeUi("ui.noodle.noodleprofilesurface.followers")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-[var(--noodle-divider)]">
        {preTabsContent}
        <div
          className="flex border-b border-[var(--noodle-divider)]"
          role="tablist"
          aria-label={localizeUi("ui.noodle.noodleprofilesurface.profileSections")}
        >
          {resolvedTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.ariaLabel}
              aria-selected={activeTab === tab.id}
              className={cn(
                "relative flex h-12 min-w-0 flex-1 items-center justify-center px-2 text-sm font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
                activeTab === tab.id && "text-[var(--foreground)]",
              )}
            >
              <span className="truncate">{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[var(--noodle-accent)]" />
              )}
            </button>
          ))}
        </div>
        <div>{postList}</div>
      </div>
    </div>
  );
}
