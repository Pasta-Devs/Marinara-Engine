import type { BaseLLMProvider } from "./base-provider.js";
import { LocalSidecarProvider } from "./providers/local-sidecar.provider.js";
import { withDiagnosticProvider } from "./diagnostic-provider.js";

export const LOCAL_SIDECAR_MODEL = "local-sidecar";

const localSidecarProvider = withDiagnosticProvider(new LocalSidecarProvider(), "local-sidecar");

export function getLocalSidecarProvider(): BaseLLMProvider {
  return localSidecarProvider;
}
