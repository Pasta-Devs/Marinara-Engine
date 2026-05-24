export type SpriteCleanupEngine = "auto" | "builtin" | "backgroundremover";

export interface SpriteCapabilities {
  imageProcessingAvailable: boolean;
  spriteGenerationAvailable: boolean;
  backgroundRemovalAvailable: boolean;
  reason: string | null;
  cleanupEngine?: {
    engine: SpriteCleanupEngine;
    installed: boolean;
    command: string | null;
    source: "bundled" | "env" | "local" | "path" | "builtin" | null;
    runtimeDir: string;
    reason: string | null;
  };
}
