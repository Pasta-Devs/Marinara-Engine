/** Select the shared-package build used before a development stack starts. */
export function resolveDevSharedBuildScript(environment = process.env) {
  return environment.DEV_PRESERVE_SHARED_DIST === "true" ? "build:preserve" : "build";
}
