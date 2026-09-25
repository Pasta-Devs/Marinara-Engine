/**
 * Ordinary in-app updates remain opt-in. A deliberate release-channel switch
 * from a loopback browser is allowed because the channel selector is itself the
 * local user's explicit request to change the checkout. The hard-disable flag
 * (set by the dev/e2e launchers, #5646) wins over both: a server booted from a
 * developer's working repo must never rewrite it, no matter who asks.
 */
export function isGitUpdateApplyAllowed(options: {
  updatesApplyEnabled: boolean;
  localChannelSwitchRequested: boolean;
  updatesApplyHardDisabled?: boolean;
}): boolean {
  if (options.updatesApplyHardDisabled === true) return false;
  return options.updatesApplyEnabled || options.localChannelSwitchRequested;
}

/**
 * True when the checkout is on a branch server-side apply may manage. A
 * feature branch is a development checkout: applying an update there would
 * stash the developer's work and move HEAD (#5646). Detached checkouts
 * (null/empty) stay allowed - the stable launcher pins them deliberately.
 */
export function isChannelCheckoutBranch(branch: string | null | undefined): boolean {
  if (!branch) return true;
  return branch === "main" || branch === "master" || branch === "staging";
}

export type UpdateInstallType = "git" | "docker" | "standalone";
export type UpdateChannelId = "stable" | "staging";

export function isUpdateChannelSwitch(
  installType: UpdateInstallType,
  currentChannel: UpdateChannelId,
  selectedChannel: UpdateChannelId,
): boolean {
  return installType !== "standalone" && currentChannel !== selectedChannel;
}

export function resolveDockerChannelImageTags(image: string, latestVersion: string, channel: UpdateChannelId) {
  if (channel === "staging") {
    return {
      dockerImage: image,
      dockerImageTag: `${image}:staging`,
      dockerLiteImageTag: null,
    };
  }

  return {
    dockerImage: image,
    dockerImageTag: `${image}:${latestVersion}`,
    dockerLiteImageTag: `${image}:${latestVersion}-lite`,
  };
}
