// ──────────────────────────────────────────────
// NoodleR post card — the Patreon-style, media-forward variant of the post card
// used only in the NoodleR viewer hub. Shares all leaf helpers, the ctx contract,
// and the reply/edit/poll machinery's building blocks with NoodlePostCard; only the
// layout (two-line header, filled access pill, full-width body, image-on-top) differs.
// The public Noodle feed keeps the original NoodlePostCard.
// ──────────────────────────────────────────────
import {
  AtSign,
  Bell,
  Eye,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Smile,
  Trash2,
  Lock,
  X,
} from "lucide-react";
import { Fragment, useRef, useState } from "react";
import {
  canManageNoodleReply,
  noodlePollInputSchema,
  readNoodlePollFromMetadata,
  readNoodlePostImageCrop,
  type NoodleAccount,
  type NoodleInteraction,
  type NoodlerPostView,
  type NoodlerStageProfile,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { ConversationMediaPickerPanel } from "../chat/ConversationMediaPickerPanel";
import type { ChatImage } from "../../hooks/use-gallery";
import { Modal } from "../ui/Modal";
import { Avatar, ProfileInitial } from "./NoodleShell";
import { formatTime } from "./NoodleBrowserChrome";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  countInteractions,
  createNoodleLightboxImage,
  fieldClass,
  labelClass,
  noodleIconButtonClass,
  NOODLE_MEDIA_PICKER_TABS,
  NOODLE_TEXT_MEDIA_PICKER_TABS,
  NoodleAnchoredPopover,
  NoodleMentionSuggestions,
  NoodlePollCard,
  NoodleTextContent,
  NoodleToolButton,
  NoodlerToolPopover,
  PostImageEditControls,
  textareaClass,
  type NoodlePostCardCtx,
  type NoodlePostCardModel,
} from "./NoodlePostCard";
import { NoodlePollComposer } from "./NoodlePollComposer";
import { PostImageFrame } from "./PostImageCropEditor";

export function LockedNoodlerPostCard({
  post,
  profile,
  controllerOnly = false,
  subscribed,
  unlockPending,
  subscriptionPending,
  onUnlock,
  onToggleSubscription,
  onManage,
  onOpenProfile,
  demo,
}: {
  post: Pick<NoodlerPostView, "id" | "access" | "createdAt" | "title" | "imageUrl"> &
    Partial<Pick<NoodlerPostView, "likeCount" | "replyCount" | "hasImage">>; // controller-locked managed posts carry no counts
  profile: NoodlerStageProfile;
  controllerOnly?: boolean;
  subscribed: boolean;
  unlockPending: boolean;
  subscriptionPending: boolean;
  onUnlock: (postId: string) => void;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  onManage?: () => void;
  onOpenProfile?: (accountId: string) => void;
  /** Onboarding only: unlocking reveals this text locally instead of calling the server. */
  /** `unlockedImageUrl` lets the demo pay off with a different image than the locked teaser. */
  demo?: {
    body: string;
    unlockedLabel: string;
    unlockedImageUrl?: string;
    lockedTitle?: string;
    onReveal?: () => void;
  };
}) {
  const { t: localizeUi } = useUiTranslation();
  const [unlockSheetOpen, setUnlockSheetOpen] = useState(false);
  const [demoUnlocked, setDemoUnlocked] = useState(false);
  const likeCount = post.likeCount ?? 0;
  const replyCount = post.replyCount ?? 0;
  const openProfile = onOpenProfile ? () => onOpenProfile(profile.id) : undefined;
  const revealed = Boolean(demo && demoUnlocked);
  // Locked posts report hasImage without a URL: the frame renders, the bytes stay server-side.
  const mediaSrc = (revealed && demo?.unlockedImageUrl) || post.imageUrl || null;
  return (
    <article
      data-noodle-post-id={post.id}
      className="border-b border-[var(--noodle-divider)] px-4 py-5 transition-colors hover:bg-[var(--accent)]/25"
    >
      {/* Author row */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={openProfile}
          disabled={!openProfile}
          className="h-fit rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
          title={openProfile ? localizeUi("ui.noodle.noodlehome.viewValue1", { value1: profile.handle }) : undefined}
        >
          <ProfileInitial profile={profile} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={openProfile}
              disabled={!openProfile}
              className="font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)] disabled:cursor-default"
            >
              {profile.displayName}
            </button>
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--noodle-accent)]/12 px-2 py-1 text-[0.68rem] font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/20">
              <Lock size={11} />
              {revealed && demo ? demo.unlockedLabel : localizeUi("ui.noodle.postaccess.locked")}
            </span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            @{profile.handle} · {formatTime(post.createdAt)}
          </p>
        </div>
      </div>

      {/* Full-width body */}
      <div>
        {/* Media frame with Locked badge — only when the post has an image */}
        {(mediaSrc || post.hasImage) && (
          <div
            className={cn(
              "relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-lg bg-[var(--muted)] ring-1 ring-inset ring-white/10",
            )}
          >
            {mediaSrc ? (
              <img
                src={mediaSrc}
                alt={
                  revealed
                    ? localizeUi("ui.noodle.post.imageBy", { name: profile.displayName })
                    : localizeUi("ui.noodle.lockednoodlerpostcard.lockedImageFrom", { name: profile.displayName })
                }
                className={cn(
                  "h-full w-full object-cover transition-[filter,transform] duration-500 motion-reduce:transition-none",
                  // The demo teaser ships pre-blurred, so a full blur-xl on top turns it to mush.
                  revealed ? "scale-100 blur-0" : cn("scale-110", demo ? "blur-sm" : "blur-xl"),
                )}
              />
            ) : (
              <span className="sr-only">
                {localizeUi("ui.noodle.lockednoodlerpostcard.lockedImageFrom", { name: profile.displayName })}
              </span>
            )}
            {!revealed && <div className="absolute inset-0 bg-black/35" aria-hidden="true" />}
            {/* Icon only: the header badge already says "Locked", and the alt text carries it for AT. */}
            {!revealed && (
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <span className="rounded-full bg-black/70 p-2.5 text-white ring-1 ring-white/15">
                  <Lock size={16} />
                </span>
              </span>
            )}
          </div>
        )}

        {/* Title */}
        {(() => {
          // The demo's real title is a punchline; showing it while locked spoils the reveal.
          const title = demo && !revealed ? demo.lockedTitle ?? post.title : post.title;
          return title && <h3 className="mt-3 text-lg font-bold leading-snug">{title}</h3>;
        })()}

        {/* Body: unreadable teaser until unlocked */}
        {revealed && demo ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-6">{demo.body}</p>
        ) : (
          !controllerOnly && (
            <div className="mt-3 space-y-2 select-none" aria-hidden="true">
              <div className="h-2.5 w-full rounded-sm bg-[var(--muted-foreground)]/20" />
              <div className="h-2.5 w-3/4 rounded-sm bg-[var(--muted-foreground)]/15" />
            </div>
          )
        )}

        {/* CTA */}
        {controllerOnly ? (
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.lockednoodlerpostcard.openTheControllerToolsToManageThisPost")}
          </p>
        ) : (
          !revealed && (
            <button
              type="button"
              disabled={unlockPending || subscriptionPending}
              onClick={() => setUnlockSheetOpen(true)}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-[opacity,scale] hover:opacity-90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-zinc-950"
            >
              <Eye size={14} /> {localizeUi("ui.noodle.lockednoodlerpostcard.unlock")}
            </button>
          )
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center gap-4 text-sm tabular-nums text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5">
            <Heart size={18} /> {likeCount}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={18} /> {replyCount}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {onManage && (
              <button
                type="button"
                onClick={onManage}
                className="flex items-center gap-1.5 hover:text-[var(--foreground)]"
              >
                <Pencil size={18} /> {localizeUi("ui.noodle.lockednoodlerpostcard.managePost")}
              </button>
            )}
          </div>
        </div>
      </div>
      <Modal
        open={unlockSheetOpen}
        onClose={() => setUnlockSheetOpen(false)}
        title={localizeUi("ui.noodle.unlocksheet.title")}
        width="max-w-sm"
      >
        <div data-component="NoodlerHome.UnlockSheet" className="divide-y divide-[var(--noodle-divider)]">
          <button
            type="button"
            data-noodler-unlock-action="post"
            disabled={unlockPending}
            onClick={() => {
              setUnlockSheetOpen(false);
              if (demo) {
                setDemoUnlocked(true);
                demo.onReveal?.();
              } else onUnlock(post.id);
            }}
            className="flex min-h-16 w-full items-center gap-3 px-1 py-3 text-left hover:bg-[var(--accent)] disabled:opacity-50"
          >
            <Eye size={20} className="shrink-0 text-[var(--noodle-accent)]" />
            <span>
              <span className="block text-sm font-bold">{localizeUi("ui.noodle.unlocksheet.unlockThisPost")}</span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.unlocksheet.unlockThisPostDetail")}
              </span>
            </span>
          </button>
          <button
            type="button"
            data-noodler-unlock-action="subscribe"
            disabled={subscriptionPending}
            onClick={() => {
              setUnlockSheetOpen(false);
              if (demo) {
                setDemoUnlocked(true);
                demo.onReveal?.();
              } else onToggleSubscription(profile.id, subscribed);
            }}
            className="flex min-h-16 w-full items-center gap-3 px-1 py-3 text-left hover:bg-[var(--accent)] disabled:opacity-50"
          >
            <Bell size={20} className="shrink-0 text-[var(--noodle-accent)]" />
            <span>
              <span className="block text-sm font-bold">{localizeUi("ui.noodle.unlocksheet.subscribe")}</span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.unlocksheet.subscribeDetail")}
              </span>
            </span>
          </button>
        </div>
      </Modal>
    </article>
  );
}

export function NoodlerPostCard({ post, ctx }: { post: NoodlePostCardModel; ctx: NoodlePostCardCtx }) {
  const { t: localizeUi } = useUiTranslation();
  const {
    personaAccount,
    postMenuId,
    setPostMenuId,
    editingPostId,
    editingPostContent,
    setEditingPostContent,
    replyPostId,
    replyParentInteractionId,
    replyText,
    replyHasText,
    setReplyText,
    activeReplyComposerTool,
    setActiveReplyComposerTool,
    highlightedInteractionId,
    mediaPickerTab,
    setMediaPickerTab,
    replyComposerRef,
    replyValueRef,
    replyMediaToolRef,
    startEditingPost,
    deleteNoodlePost,
    cancelEditingPost,
    saveEditedPost,
    reactToPost,
    reactToReply,
    openReplyComposer,
    handleReplyChange,
    clearReplyComposer,
    submitReply,
    appendToReply,
    reactionPendingFor,
    createInteractionPendingFor,
    updatePostPending,
    titleEditing,
    media,
    replyManagement,
    mentions,
  } = ctx;
  const accountById = ctx.accountById ?? new Map<string, NoodleAccount>();
  const accountByHandle = ctx.accountByHandle ?? new Map<string, NoodleAccount>();
  const authorAccount = accountById.get(post.authorAccountId) ?? null;
  const author = authorAccount ?? post.authorSnapshot;

  // Card-owned defaults for absent capability groups. Hosts pass only the capabilities they
  // support (NoodleR omits media/replyManagement/mentions/poll/profile); the card fills the
  // rest with no-ops and empty state, and gates the corresponding UI on group presence — so
  // no host has to hand over discarded setters, dangling refs, or fake mutations. Annotations
  // keep the () => {} fallbacks callable with their real signatures.
  const fallbackDivRef = useRef<HTMLDivElement | null>(null);
  const fallbackFileRef = useRef<HTMLInputElement | null>(null);
  const openProfile: (account: NoodleAccount | null) => void = ctx.openProfile ?? (() => {});
  const canOpenAuthorProfile = Boolean(authorAccount || ctx.openAuthorProfile);
  const openPostAuthor = () => {
    if (authorAccount) openProfile(authorAccount);
    else ctx.openAuthorProfile?.(post.authorAccountId);
  };
  const handleReplyKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void =
    ctx.handleReplyKeyDown ?? (() => {});
  const voteInPoll: (post: NoodlePostCardModel, optionId: string, selectedOptionId: string | null) => void =
    ctx.voteInPoll ?? (() => {});
  const disableReplyImage = !media;
  const setImageLightbox: React.Dispatch<React.SetStateAction<ChatImage | null>> =
    media?.setImageLightbox ?? (() => {});
  const replyImageUrl = media?.replyImageUrl ?? "";
  const setReplyImageUrl: React.Dispatch<React.SetStateAction<string>> = media?.setReplyImageUrl ?? (() => {});
  const replyImageUrlDraft = media?.replyImageUrlDraft ?? "";
  const setReplyImageUrlDraft: React.Dispatch<React.SetStateAction<string>> =
    media?.setReplyImageUrlDraft ?? (() => {});
  const replyImageToolRef = media?.replyImageToolRef ?? fallbackDivRef;
  const replyImageFileRef = media?.replyImageFileRef ?? fallbackFileRef;
  const applyReplyImageUrl: () => void = media?.applyReplyImageUrl ?? (() => {});
  const uploadGlobalImages = media?.uploadGlobalImages ?? { isPending: false };
  const editingReplyId = replyManagement?.editingReplyId ?? null;
  const editingReplyContent = replyManagement?.editingReplyContent ?? "";
  const setEditingReplyContent: React.Dispatch<React.SetStateAction<string>> =
    replyManagement?.setEditingReplyContent ?? (() => {});
  const startEditingReply: (reply: NoodleInteraction) => void = replyManagement?.startEditingReply ?? (() => {});
  const cancelEditingReply: () => void = replyManagement?.cancelEditingReply ?? (() => {});
  const saveEditedReply: (post: NoodlePostCardModel, reply: NoodleInteraction) => void =
    replyManagement?.saveEditedReply ?? (() => {});
  const deleteNoodleReply: (post: NoodlePostCardModel, reply: NoodleInteraction) => void =
    replyManagement?.deleteNoodleReply ?? (() => {});
  const updateInteraction = replyManagement?.updateInteraction ?? { isPending: false };
  const deleteInteraction = replyManagement?.deleteInteraction ?? { isPending: false };
  const canManageReplyOverride = replyManagement?.canManageReply;
  const activeReplyMention = mentions?.activeReplyMention ?? null;
  const activeReplyMentionIndex = mentions?.activeReplyMentionIndex ?? 0;
  const replyMentionSuggestions = mentions?.replyMentionSuggestions ?? [];
  const selectReplyMention: (account: NoodleAccount) => void = mentions?.selectReplyMention ?? (() => {});

  const { imageEditing, pollEditing } = ctx;
  const isEditingPost = Boolean(ctx.postManagement) && editingPostId === post.id;
  const imageCrop = readNoodlePostImageCrop(post.metadata);
  const postInteractions = post.interactions;
  const rootPostInteractions = postInteractions.filter((interaction) => !interaction.parentInteractionId);
  const poll = readNoodlePollFromMetadata(post.metadata);
  const pollVotes = poll
    ? rootPostInteractions.filter(
        (interaction) =>
          interaction.type === "vote" && poll.options.some((option) => option.id === interaction.content),
      )
    : [];
  const personaPollVote = personaAccount
    ? (pollVotes.find((interaction) => interaction.actorAccountId === personaAccount.id)?.content ?? null)
    : null;
  const likedByPersona = personaAccount
    ? rootPostInteractions.some(
        (interaction) => interaction.type === "like" && interaction.actorAccountId === personaAccount.id,
      )
    : false;
  const repostedByPersona = personaAccount
    ? rootPostInteractions.some(
        (interaction) => interaction.type === "repost" && interaction.actorAccountId === personaAccount.id,
      )
    : false;
  const replies = postInteractions.filter((interaction) => interaction.type === "reply");
  const replyById = new Map(replies.map((reply) => [reply.id, reply]));
  const orderedReplies: NoodleInteraction[] = [];
  const visitedReplyIds = new Set<string>();
  const appendReplyBranch = (reply: NoodleInteraction) => {
    if (visitedReplyIds.has(reply.id)) return;
    visitedReplyIds.add(reply.id);
    orderedReplies.push(reply);
    for (const child of replies) {
      if (child.parentInteractionId === reply.id) appendReplyBranch(child);
    }
  };
  for (const reply of replies) {
    if (!reply.parentInteractionId || !replyById.has(reply.parentInteractionId)) appendReplyBranch(reply);
  }
  for (const reply of replies) appendReplyBranch(reply);
  const replyTarget = replyParentInteractionId ? (replyById.get(replyParentInteractionId) ?? null) : null;
  const replyTargetActor = replyTarget
    ? (accountById.get(replyTarget.actorAccountId) ?? replyTarget.actorSnapshot)
    : author;
  const postLikePending = reactionPendingFor(post.id, "like");
  const postRepostPending = reactionPendingFor(post.id, "repost");
  const postReplyPending = createInteractionPendingFor(post.id, "reply", replyParentInteractionId);
  const pollVotePending = createInteractionPendingFor(post.id, "vote");
  const editingExistingPoll = Boolean(poll && pollEditing);
  const editingPollIsValid = !editingExistingPoll || noodlePollInputSchema.safeParse(pollEditing?.value).success;
  const saveEditDisabled =
    (!editingPostContent.trim() && !(ctx.allowPollOnlyEdits && editingPollIsValid && editingExistingPoll)) ||
    !editingPollIsValid ||
    updatePostPending ||
    Boolean(imageEditing?.loading) ||
    Boolean(imageEditing?.cropSource);
  const postEditActions = (
    <>
      <button
        type="button"
        onClick={cancelEditingPost}
        className="h-8 rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
      >
        {localizeUi("chat.delete.dialog.cancel")}
      </button>
      <button
        type="button"
        onClick={() => saveEditedPost(post)}
        disabled={saveEditDisabled}
        className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {updatePostPending ? localizeUi("ui.noodle.noodlehome.saving") : localizeUi("ui.noodle.noodlehome.save")}
      </button>
    </>
  );
  const renderReplyComposer = (nested: boolean) => (
    <div
      data-component="NoodleView.ReplyComposer"
      data-noodle-reply-parent-id={replyParentInteractionId ?? ""}
      className={cn("border-[var(--noodle-divider)] py-3", nested ? "ml-10 border-b" : "mt-3 border-y")}
    >
      {replyParentInteractionId && replyTargetActor && (
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
          <span className="font-semibold text-[var(--noodle-accent)]">@{replyTargetActor.handle}</span>
        </p>
      )}
      <textarea
        ref={replyComposerRef}
        defaultValue={replyText}
        onChange={handleReplyChange}
        onBlur={() => setReplyText(replyValueRef.current)}
        onKeyDown={handleReplyKeyDown}
        className={cn(textareaClass, "min-h-16 resize-none bg-transparent")}
        placeholder={localizeUi("ui.noodle.noodlepostcard.leaveAComment")}
        aria-autocomplete="list"
        aria-controls={activeReplyMention ? "noodle-reply-mention-list" : undefined}
        aria-expanded={Boolean(activeReplyMention)}
        aria-activedescendant={
          activeReplyMention && replyMentionSuggestions.length > 0
            ? `noodle-reply-mention-list-option-${Math.min(
                activeReplyMentionIndex,
                replyMentionSuggestions.length - 1,
              )}`
            : undefined
        }
      />
      <NoodleMentionSuggestions
        activeMention={activeReplyMention}
        activeIndex={activeReplyMentionIndex}
        accounts={replyMentionSuggestions}
        listboxId="noodle-reply-mention-list"
        onSelect={selectReplyMention}
      />
      {replyImageUrl && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-[var(--noodle-divider)]">
          <button
            type="button"
            onClick={() => setImageLightbox(createNoodleLightboxImage(`reply-draft-${post.id}`, replyImageUrl))}
            className="block w-full"
            title={localizeUi("ui.noodle.noodlepostcard.openAttachedImage")}
          >
            <img
              src={replyImageUrl}
              alt={localizeUi("ui.noodle.noodlepostcard.attachedReplyPreview")}
              className="max-h-52 w-full object-cover"
            />
          </button>
          <button
            type="button"
            onClick={() => setReplyImageUrl("")}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white [&_svg]:!text-white transition-colors hover:bg-black/80"
            title={localizeUi("ui.noodle.noodlehome.removeImage")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.removeReplyImage")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!disableReplyImage && (
            <div ref={replyImageToolRef} className="relative">
              <NoodleToolButton
                title={localizeUi("ui.noodle.noodlehome.attachImage")}
                active={activeReplyComposerTool === "image"}
                onClick={() => setActiveReplyComposerTool((current) => (current === "image" ? null : "image"))}
              >
                <ImageIcon size={17} />
              </NoodleToolButton>
            </div>
          )}
          <div ref={replyMediaToolRef} className="relative">
            <NoodleToolButton
              title={localizeUi("ui.noodle.noodlehome.emojiGifsAndStickers")}
              active={activeReplyComposerTool === "media"}
              onClick={() => setActiveReplyComposerTool((current) => (current === "media" ? null : "media"))}
            >
              <Smile size={17} />
            </NoodleToolButton>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearReplyComposer}
            className="h-8 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
          <button
            type="button"
            className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={(!replyHasText && !replyImageUrl.trim()) || postReplyPending}
            onClick={() => submitReply(post)}
          >
            {postReplyPending
              ? localizeUi("ui.noodle.noodlepostcard.replying")
              : localizeUi("ui.noodle.noodlepostcard.reply")}
          </button>
        </div>
      </div>
      {!disableReplyImage && activeReplyComposerTool === "image" && (
        <NoodlerToolPopover
          title={localizeUi("ui.noodle.noodlehome.attachImage")}
          anchorRef={replyImageToolRef}
          onClose={() => setActiveReplyComposerTool(null)}
          wide
        >
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => replyImageFileRef.current?.click()}
              disabled={uploadGlobalImages.isPending}
              className="h-9 w-full rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadGlobalImages.isPending
                ? localizeUi("ui.noodle.noodleprofilesurface.uploading")
                : localizeUi("ui.noodle.noodlehome.uploadFromDevice")}
            </button>
            <div
              data-component="NoodleView.ReplyImageDivider"
              className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-normal text-[var(--noodle-accent)]"
            >
              <span className="h-px flex-1 bg-[var(--noodle-divider)]" />
              {localizeUi("ui.noodle.noodlehome.or")}
              <span className="h-px flex-1 bg-[var(--noodle-divider)]" />
            </div>
            <label className="block space-y-1.5">
              <span className={labelClass}>{localizeUi("ui.noodle.noodlehome.imageUrl")}</span>
              <input
                value={replyImageUrlDraft}
                onChange={(event) => setReplyImageUrlDraft(event.target.value)}
                placeholder={localizeUi("ui.noodle.noodlehome.https")}
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={applyReplyImageUrl}
              className="h-9 w-full rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
            >
              {localizeUi("ui.noodle.noodlehome.attachUrl")}
            </button>
          </div>
        </NoodlerToolPopover>
      )}
      {activeReplyComposerTool === "media" && (
        <NoodleAnchoredPopover anchorRef={replyMediaToolRef} wide>
          <ConversationMediaPickerPanel
            tabs={disableReplyImage ? NOODLE_TEXT_MEDIA_PICKER_TABS : NOODLE_MEDIA_PICKER_TABS}
            activeTab={mediaPickerTab}
            onActiveTabChange={setMediaPickerTab}
            onClose={() => setActiveReplyComposerTool(null)}
            onEmojiSelect={appendToReply}
            onGifSelect={(gifUrl) => {
              setReplyImageUrl(gifUrl);
              setActiveReplyComposerTool(null);
            }}
            onStickerSelect={(name) => {
              appendToReply(`sticker:${name}:`);
              setActiveReplyComposerTool(null);
            }}
            className="w-full !border-[var(--marinara-chat-chrome-panel-border)] !bg-[var(--background)] !text-[var(--foreground)] shadow-2xl shadow-black/35"
          />
        </NoodleAnchoredPopover>
      )}
    </div>
  );
  return (
    <article
      key={post.id}
      data-noodle-post-id={post.id}
      tabIndex={-1}
      className="border-b border-[var(--noodle-divider)] px-4 py-5 transition-colors hover:bg-[var(--accent)]/25"
    >
      <div className="flex gap-3">
        {author ? (
          <button
            type="button"
            onClick={openPostAuthor}
            disabled={!canOpenAuthorProfile}
            className="h-fit rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
            title={
              canOpenAuthorProfile
                ? localizeUi("ui.noodle.noodlehome.viewValue1", { value1: author.handle })
                : undefined
            }
          >
            <Avatar account={author} />
          </button>
        ) : (
          <AtSign size={28} className="text-[var(--noodle-accent)]" />
        )}
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={openPostAuthor}
                disabled={!canOpenAuthorProfile}
                className="font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)] disabled:cursor-default"
              >
                {author?.displayName ?? localizeUi("ui.noodle.noodlepostcard.noodleUser")}
              </button>
              <span className="rounded-full bg-[var(--noodle-accent)]/15 px-2 py-0.5 text-[0.68rem] font-bold text-[var(--noodle-accent)]">
                {localizeUi(post.access === "locked" ? "ui.noodle.postaccess.unlocked" : "ui.noodle.postaccess.public")}
              </span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              @{author?.handle ?? localizeUi("ui.noodle.noodleshell.noodleHandle")} · {formatTime(post.createdAt)}
            </p>
          </div>
          {ctx.postManagement && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPostMenuId((current) => (current === post.id ? null : post.id))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
                title={localizeUi("ui.noodle.noodlepostcard.postActions")}
                aria-label={localizeUi("ui.noodle.noodlepostcard.postActions")}
              >
                <MoreHorizontal size={18} />
              </button>
              {postMenuId === post.id && (
                <div className="absolute right-0 top-[calc(100%+0.25rem)] z-30 min-w-32 overflow-hidden rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] py-1 text-xs shadow-2xl shadow-black/30">
                  <button
                    type="button"
                    onClick={() => startEditingPost(post)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                  >
                    <Pencil size={14} className="text-[var(--noodle-accent)]" />
                    {localizeUi("ui.noodle.noodlepostcard.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteNoodlePost(post)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                  >
                    <Trash2 size={14} className="text-[var(--noodle-accent)]" />
                    {localizeUi("lorebook.editor.batch.delete")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div>
        {/* The image editor renders its own preview while editing, so hide the read-only one. */}
        {isEditingPost && imageEditing ? null : post.imageUrl ? (
          <button
            type="button"
            onClick={() => setImageLightbox(createNoodleLightboxImage(post.id, post.imageUrl!, post.imagePrompt ?? ""))}
            className="mt-3 block w-full overflow-hidden rounded-lg text-left ring-1 ring-inset ring-white/10 ring-offset-[var(--background)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2"
            title={localizeUi("ui.noodle.noodlepostcard.openImage")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.openPostImage")}
          >
            {imageCrop ? (
              <PostImageFrame
                src={post.imageUrl}
                crop={imageCrop}
                alt={localizeUi("ui.noodle.post.imageBy", {
                  name: author?.displayName ?? localizeUi("ui.noodle.profile.fallbackUser"),
                })}
              />
            ) : (
              <img
                src={post.imageUrl}
                alt={localizeUi("ui.noodle.post.imageBy", {
                  name: author?.displayName ?? localizeUi("ui.noodle.profile.fallbackUser"),
                })}
                className="aspect-[4/3] max-h-[32rem] w-full object-cover"
              />
            )}
          </button>
        ) : post.imagePrompt ? (
          <div className="mt-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 text-xs leading-5">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
              <ImageIcon size={13} />
              {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
            </span>
            {post.imagePrompt}
          </div>
        ) : null}
        {isEditingPost ? (
          <div className="mt-2 space-y-2">
            {titleEditing && (
              <label className="block space-y-1">
                <span className={labelClass}>{localizeUi("ui.noodle.noodlepostcard.titleOptional")}</span>
                <input
                  value={titleEditing.editingPostTitle}
                  onChange={(event) => titleEditing.setEditingPostTitle(event.target.value)}
                  maxLength={titleEditing.maxLength}
                  className={fieldClass}
                  placeholder={localizeUi("ui.noodle.noodlepostcard.postTitle")}
                />
              </label>
            )}
            <textarea
              value={editingPostContent}
              onChange={(event) => setEditingPostContent(event.target.value)}
              className={cn(textareaClass, "min-h-28")}
              placeholder={localizeUi("ui.noodle.noodlepostcard.editPost")}
            />
            {imageEditing && (
              <PostImageEditControls
                post={post}
                editing={imageEditing}
                disabled={updatePostPending}
                footer={editingExistingPoll ? null : postEditActions}
              />
            )}
            {editingExistingPoll && pollEditing && (
              <NoodlePollComposer
                value={pollEditing.value}
                onChange={pollEditing.setValue}
                onClose={cancelEditingPost}
                onSubmit={() => saveEditedPost(post)}
                submitLabel={
                  updatePostPending
                    ? localizeUi("ui.noodle.noodlehome.saving")
                    : localizeUi("ui.noodle.noodlehome.save")
                }
                submitDisabled={saveEditDisabled}
                disabled={updatePostPending}
                title={localizeUi("ui.noodle.noodlehome.editPoll")}
                closeLabel="Cancel post editing"
                action={postEditActions}
              />
            )}
            {!imageEditing && !editingExistingPoll && (
              <div className="flex flex-wrap justify-end gap-2">{postEditActions}</div>
            )}
          </div>
        ) : (
          <>
            {post.title && <h3 className="mt-2 break-words text-lg font-bold leading-snug">{post.title}</h3>}
            {!poll || post.content.trim() !== poll.question ? (
              <NoodleTextContent
                content={post.content}
                accountByHandle={accountByHandle}
                onOpenProfile={openProfile}
                className={cn("leading-6", post.title ? "mt-1" : "mt-2")}
              />
            ) : null}
          </>
        )}
        {poll && !isEditingPost && (
          <NoodlePollCard
            poll={poll}
            votes={pollVotes}
            accountById={accountById}
            selectedOptionId={personaPollVote}
            disabled={!personaAccount}
            pending={pollVotePending}
            onVote={(optionId) => voteInPoll(post, optionId, personaPollVote)}
            onOpenProfile={openProfile}
          />
        )}
        <div className="mt-4 flex max-w-md items-center justify-between gap-1 tabular-nums">
          <button
            type="button"
            className={cn(noodleIconButtonClass, "rounded-full", likedByPersona && "bg-[var(--noodle-accent)]/10")}
            disabled={!personaAccount || postLikePending}
            onClick={() => reactToPost(post, "like", likedByPersona)}
            title={
              likedByPersona
                ? localizeUi("ui.noodle.noodlepostcard.unlike")
                : localizeUi("ui.noodle.noodlepostcard.like")
            }
            aria-label={localizeUi(likedByPersona ? "ui.noodle.post.unlikeLabel" : "ui.noodle.post.likeLabel")}
            aria-busy={postLikePending}
            data-noodle-reaction="like"
          >
            <Heart
              size={18}
              fill={likedByPersona ? "currentColor" : "none"}
              strokeWidth={likedByPersona ? 2.4 : 2}
              className={cn(
                "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                likedByPersona && "scale-110",
              )}
            />
            {countInteractions(rootPostInteractions, "like")}
          </button>
          <button
            type="button"
            className={cn(noodleIconButtonClass, "rounded-full", repostedByPersona && "bg-[var(--noodle-accent)]/10")}
            disabled={!personaAccount || postRepostPending}
            onClick={() => reactToPost(post, "repost", repostedByPersona)}
            title={
              repostedByPersona
                ? localizeUi("ui.noodle.noodlepostcard.undoRepost")
                : localizeUi("ui.noodle.noodlepostcard.repost")
            }
            aria-busy={postRepostPending}
            data-noodle-reaction="repost"
          >
            <Repeat2 size={24} strokeWidth={1.55} className="-my-1" />
            {countInteractions(rootPostInteractions, "repost")}
          </button>
          <button
            type="button"
            className={cn(noodleIconButtonClass, "rounded-full hover:text-[var(--noodle-accent)]")}
            disabled={!personaAccount}
            onClick={() => openReplyComposer(post.id)}
            title={localizeUi("ui.noodle.noodlepostcard.reply")}
          >
            <MessageCircle size={18} />
            {replies.length}
          </button>
        </div>

        {replyPostId === post.id && !replyParentInteractionId && renderReplyComposer(false)}

        {replies.length > 0 && (
          <div className="mt-3 border-t border-[var(--noodle-divider)]">
            {orderedReplies.map((reply) => {
              const actorAccount = accountById.get(reply.actorAccountId) ?? null;
              const actor = actorAccount ?? reply.actorSnapshot;
              const parentReply = reply.parentInteractionId ? (replyById.get(reply.parentInteractionId) ?? null) : null;
              const parentActorAccount = parentReply ? (accountById.get(parentReply.actorAccountId) ?? null) : null;
              const parentActor = parentActorAccount ?? parentReply?.actorSnapshot ?? null;
              const replyLikes = postInteractions.filter(
                (interaction) => interaction.type === "like" && interaction.parentInteractionId === reply.id,
              );
              const likedReplyByPersona = personaAccount
                ? replyLikes.some((interaction) => interaction.actorAccountId === personaAccount.id)
                : false;
              const canManageReply = canManageReplyOverride
                ? canManageReplyOverride(reply)
                : Boolean(
                    personaAccount &&
                    canManageNoodleReply({
                      actorKind: actorAccount?.kind ?? reply.actorSnapshot?.kind,
                      actorAccountId: reply.actorAccountId,
                      personaAccountId: personaAccount.id,
                    }),
                  );
              return (
                <Fragment key={reply.id}>
                  <div
                    data-noodle-interaction-id={reply.id}
                    tabIndex={-1}
                    className={cn(
                      "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 border-b border-[var(--noodle-divider)] bg-transparent py-3 text-xs outline-none transition-shadow duration-300 last:border-b-0",
                      highlightedInteractionId === reply.id &&
                        "rounded-lg ring-1 ring-inset ring-[var(--noodle-accent)]/70",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openProfile(actorAccount)}
                      disabled={!actorAccount}
                      className="h-8 w-8 shrink-0 rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
                      title={
                        actorAccount
                          ? localizeUi("ui.noodle.noodlehome.viewValue1", { value1: actorAccount.handle })
                          : undefined
                      }
                    >
                      <Avatar account={actor ?? { displayName: "Noodle User", avatarUrl: null }} size="sm" />
                    </button>
                    <div className="min-w-0 bg-transparent">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <button
                          type="button"
                          onClick={() => openProfile(actorAccount)}
                          disabled={!actorAccount}
                          className="max-w-full truncate font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)] disabled:cursor-default"
                        >
                          {actor?.displayName ?? "Noodle User"}
                        </button>
                        <span className="truncate text-[var(--muted-foreground)]">@{actor?.handle ?? "noodle"}</span>
                        <span className="text-[var(--muted-foreground)]">· {formatTime(reply.createdAt)}</span>
                      </div>
                      {parentActor && (
                        <p className="mt-0.5 text-[var(--muted-foreground)]">
                          {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
                          {parentActorAccount ? (
                            <button
                              type="button"
                              onClick={() => openProfile(parentActorAccount)}
                              className="font-medium text-[var(--noodle-accent)] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
                              aria-label={localizeUi("ui.noodle.profile.viewHandleProfile", {
                                handle: parentActorAccount.handle,
                              })}
                            >
                              @{parentActorAccount.handle}
                            </button>
                          ) : (
                            <span className="text-[var(--noodle-accent)]">@{parentActor.handle}</span>
                          )}
                        </p>
                      )}
                      {editingReplyId === reply.id ? (
                        <div className="mt-2 space-y-2" data-component="NoodleView.CommentEditor">
                          <textarea
                            value={editingReplyContent}
                            onChange={(event) => setEditingReplyContent(event.target.value)}
                            className={cn(textareaClass, "min-h-20 resize-y")}
                            placeholder={localizeUi("ui.noodle.noodlepostcard.editComment")}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditingReply}
                              disabled={updateInteraction.isPending}
                              className="h-8 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                            >
                              {localizeUi("chat.delete.dialog.cancel")}
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditedReply(post, reply)}
                              disabled={(!editingReplyContent.trim() && !reply.imageUrl) || updateInteraction.isPending}
                              className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updateInteraction.isPending
                                ? localizeUi("ui.noodle.noodlehome.saving")
                                : localizeUi("ui.noodle.noodlehome.save")}
                            </button>
                          </div>
                        </div>
                      ) : reply.content ? (
                        <NoodleTextContent
                          content={reply.content}
                          accountByHandle={accountByHandle}
                          onOpenProfile={openProfile}
                          className="mt-1 leading-5"
                        />
                      ) : null}
                      {reply.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setImageLightbox(createNoodleLightboxImage(reply.id, reply.imageUrl!, reply.content ?? ""))
                          }
                          className="mt-2 block w-full overflow-hidden rounded-xl text-left ring-offset-[var(--background)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2"
                          title={localizeUi("ui.noodle.noodlepostcard.openImage")}
                          aria-label={localizeUi("ui.noodle.noodlepostcard.openCommentImage")}
                        >
                          <img
                            src={reply.imageUrl}
                            alt={localizeUi("ui.noodle.noodlepostcard.commentImageAlt", {
                              name: actor?.displayName ?? localizeUi("ui.noodle.noodlepostcard.noodleUser"),
                            })}
                            className="max-h-72 w-full object-cover"
                          />
                        </button>
                      )}
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => reactToReply(post, reply, likedReplyByPersona)}
                          disabled={!personaAccount || reactionPendingFor(post.id, "like", reply.id)}
                          className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-full px-2 font-medium text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50",
                            likedReplyByPersona && "bg-[var(--noodle-accent)]/10",
                          )}
                          title={
                            likedReplyByPersona
                              ? localizeUi("ui.noodle.noodlepostcard.unlikeComment")
                              : localizeUi("ui.noodle.noodlepostcard.likeComment")
                          }
                          aria-busy={reactionPendingFor(post.id, "like", reply.id)}
                        >
                          <Heart
                            size={14}
                            fill={likedReplyByPersona ? "currentColor" : "none"}
                            strokeWidth={likedReplyByPersona ? 2.4 : 2}
                            className={cn(
                              "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                              likedReplyByPersona && "scale-110",
                            )}
                          />
                          {replyLikes.length > 0 && replyLikes.length}
                        </button>
                        <button
                          type="button"
                          onClick={() => openReplyComposer(post.id, reply.id)}
                          disabled={!personaAccount}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                          title={localizeUi("ui.noodle.noodlepostcard.reply")}
                          aria-label={localizeUi("ui.noodle.noodlepostcard.reply")}
                        >
                          <MessageCircle size={14} />
                        </button>
                        {canManageReply && editingReplyId !== reply.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingReply(reply)}
                              disabled={updateInteraction.isPending || deleteInteraction.isPending}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                              title={localizeUi("ui.noodle.noodlepostcard.editComment")}
                              aria-label={localizeUi("ui.noodle.noodlepostcard.editComment")}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNoodleReply(post, reply)}
                              disabled={updateInteraction.isPending || deleteInteraction.isPending}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                              title={localizeUi("ui.noodle.noodlepostcard.deleteComment")}
                              aria-label={localizeUi("ui.noodle.noodlepostcard.deleteComment")}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {replyPostId === post.id && replyParentInteractionId === reply.id && renderReplyComposer(true)}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
