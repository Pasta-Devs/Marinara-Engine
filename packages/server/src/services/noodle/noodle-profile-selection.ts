import type { NoodleAccount } from "@marinara-engine/shared";

export function isNoodleProfileGenerated(account: Pick<NoodleAccount, "settings">): boolean {
  return account.settings.profile.profileGenerated === true;
}

/** Profiles are generated only for character accounts selected for the current refresh. */
export function noodleAccountsNeedingProfiles(accounts: readonly NoodleAccount[]): NoodleAccount[] {
  return accounts.filter((account) => account.kind === "character" && !isNoodleProfileGenerated(account));
}
