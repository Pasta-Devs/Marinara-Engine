export type RuntimeHealth = {
  version: string;
  build?: string | null;
};

export function formatRuntimeBuild(version: string, commit: string | null) {
  return commit ? `${version}+${commit}` : version;
}

export function getServerRuntimeBuild(health: RuntimeHealth) {
  return health.build?.trim() || health.version;
}

export function isRuntimeBuildCurrent(clientVersion: string, clientBuild: string, health: RuntimeHealth) {
  const serverBuild = health.build?.trim();
  // Local/archive builds may not have Git metadata on either side. Compare
  // versions in that case; missing metadata is not evidence of a stale build.
  if (!serverBuild || serverBuild === health.version || clientBuild === clientVersion) {
    return health.version === clientVersion;
  }

  return serverBuild === clientBuild;
}
