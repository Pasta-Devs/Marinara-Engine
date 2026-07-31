import { sanitizeFolderSegment, type PersonalExtension } from "@marinara-engine/shared";
import type { ZipFileInput } from "./download-zip";

export function createPersonalExtensionPackageFiles(extension: PersonalExtension): ZipFileInput[] {
  const folder = `Personal Extensions/${sanitizeFolderSegment(extension.name, "personal-extension")}`;
  const runtime = extension.runtime;
  const config = {
    name: extension.name,
    ...(extension.version ? { version: extension.version } : {}),
    description: extension.description,
    runtime,
    enabled: false,
    // Keep the empty declaration too: its presence distinguishes a modern
    // sandbox package from a pre-sandbox `marinara.extension` import.
    capabilities: extension.capabilities,
    ...(runtime === "server"
      ? { serverJsPath: "server-extension.js" }
      : {
          ...(extension.css ? { cssPath: "extension.css" } : {}),
          ...(extension.js ? { jsPath: "extension.js" } : {}),
        }),
  };
  const manifest = {
    kind: runtime === "server" ? "marinara.personal-server-extension" : "marinara.personal-extension",
    version: 1 as const,
    config,
  };
  return [
    { path: `${folder}/manifest.json`, content: JSON.stringify(manifest, null, 2) },
    ...(extension.css ? [{ path: `${folder}/extension.css`, content: extension.css }] : []),
    ...(extension.js ? [{ path: `${folder}/extension.js`, content: extension.js }] : []),
    ...(extension.serverJs ? [{ path: `${folder}/server-extension.js`, content: extension.serverJs }] : []),
  ];
}

export function createPersonalExtensionPackageFilename(name: string) {
  return `${sanitizeFolderSegment(name, "personal-extension")}.personal-extension.zip`;
}
