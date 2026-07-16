import type { NoodleAccount } from "@marinara-engine/shared";

function readBooleanSetting(settings: Record<string, unknown>, key: string): boolean {
  const value = settings[key];
  return value === true || value === "true";
}

export function isNoodleProfileGenerated(account: Pick<NoodleAccount, "settings">): boolean {
  return readBooleanSetting(account.settings, "profileGenerated");
}

/** Profiles are generated only for character accounts selected for the current refresh. */
export function noodleAccountsNeedingProfiles(accounts: readonly NoodleAccount[]): NoodleAccount[] {
  return accounts.filter((account) => account.kind === "character" && !isNoodleProfileGenerated(account));
}
