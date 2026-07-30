import { createHash } from "node:crypto";
import {
  normalizePersonalExtensionCapabilities,
  type PersonalExtensionCapability,
  type PersonalExtensionRuntime,
} from "@marinara-engine/shared";

export type PersonalExtensionExecutable = {
  runtime: PersonalExtensionRuntime;
  capabilities?: readonly PersonalExtensionCapability[] | null;
  css?: string | null;
  js?: string | null;
  serverJs?: string | null;
};

export function computePersonalExtensionHash(extension: PersonalExtensionExecutable): string {
  const payload: unknown[] =
    extension.runtime === "server"
      ? ["server", "", "", extension.serverJs ?? ""]
      : ["client", extension.css ?? "", extension.js ?? "", ""];
  const capabilities = normalizePersonalExtensionCapabilities(extension.capabilities);
  // Preserve the legacy hash for extensions that request no additional data.
  // Requested capabilities extend the executable trust payload so any change
  // disables the extension and requires approval of a new exact hash.
  if (capabilities.length > 0) payload.push(capabilities);
  return `sha256:${createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex")}`;
}
