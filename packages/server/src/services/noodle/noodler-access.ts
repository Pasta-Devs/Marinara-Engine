import type { NoodleAccount, NoodlePost } from "@marinara-engine/shared";

export function isNoodlerHiddenFromViewer(account: NoodleAccount, viewerAccountId: string): boolean {
  return account.settings.privacy.access.hiddenFromAccountIds.includes(viewerAccountId);
}

export function canViewNoodlerPost(input: {
  post: Pick<NoodlePost, "id" | "access">;
  subscribed: boolean;
  unlockedPostIds: ReadonlySet<string>;
}): boolean {
  if (input.post.access === "public") return true;
  return input.subscribed || input.unlockedPostIds.has(input.post.id);
}
