import type { NoodleAccount, NoodlePost } from "@marinara-engine/shared";

export function isNoodlerHiddenFromViewer(account: NoodleAccount, viewerAccountId: string): boolean {
  return account.settings.privacy.access.hiddenFromAccountIds.includes(viewerAccountId);
}

export function canViewNoodlerPost(input: {
  post: Pick<NoodlePost, "id" | "access">;
  subscribed: boolean;
  unlockedPostIds: ReadonlySet<string>;
  subscriptionIncludesPpv: boolean;
}): boolean {
  if (input.post.access === "public") return true;
  if (input.post.access === "subscriber") return input.subscribed;
  return input.unlockedPostIds.has(input.post.id) || (input.subscribed && input.subscriptionIncludesPpv);
}
