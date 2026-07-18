import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";

import { LOCAL_SIDECAR_MODEL } from "../llm/local-sidecar.js";
import { sidecarModelService } from "../sidecar/sidecar-model.service.js";

export type LocalSidecarGenerationConnection = {
  id: typeof LOCAL_SIDECAR_CONNECTION_ID;
  name: string;
  provider: "local_sidecar";
  baseUrl: string;
  apiKey: string;
  apiKeyEncrypted: string;
  model: string;
  imagePath: null;
  maxContext: number;
  isDefault: "false";
  fallbackForMain: "false";
  useForRandom: "false";
  enableCaching: "false";
  anthropicExtendedCacheTtl: "false";
  cachingAtDepth: number;
  defaultForAgents: "false";
  fallbackForAgents: "false";
  embeddingModel: string;
  embeddingBaseUrl: string;
  embeddingConnectionId: null;
  openrouterProvider: null;
  imageGenerationSource: null;
  comfyuiWorkflow: null;
  imageService: null;
  imageEndpointId: null;
  defaultParameters: null;
  promptPresetId: null;
  maxTokensOverride: null;
  maxParallelJobs: number;
  treatAsLocalEndpoint: "true";
  claudeFastMode: "false";
  folderId: null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function createLocalSidecarGenerationConnection(): LocalSidecarGenerationConnection {
  const config = sidecarModelService.getConfig();
  return {
    id: LOCAL_SIDECAR_CONNECTION_ID,
    name: "Local Model (sidecar)",
    provider: "local_sidecar",
    baseUrl: "local-sidecar://runtime",
    apiKey: "",
    apiKeyEncrypted: "",
    model: LOCAL_SIDECAR_MODEL,
    imagePath: null,
    maxContext: config.contextSize,
    isDefault: "false",
    fallbackForMain: "false",
    useForRandom: "false",
    enableCaching: "false",
    anthropicExtendedCacheTtl: "false",
    cachingAtDepth: 5,
    defaultForAgents: "false",
    fallbackForAgents: "false",
    embeddingModel: "",
    embeddingBaseUrl: "",
    embeddingConnectionId: null,
    openrouterProvider: null,
    imageGenerationSource: null,
    comfyuiWorkflow: null,
    imageService: null,
    imageEndpointId: null,
    defaultParameters: null,
    promptPresetId: null,
    maxTokensOverride: null,
    maxParallelJobs: 1,
    treatAsLocalEndpoint: "true",
    claudeFastMode: "false",
    folderId: null,
    sortOrder: 0,
    createdAt: "local-sidecar",
    updatedAt: "local-sidecar",
  };
}
