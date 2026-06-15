import { createHash } from "crypto";

export function contentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}
