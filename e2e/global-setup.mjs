import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

export default async function globalSetup() {
  const dataDir = resolve(process.cwd(), ".tmp/playwright-data");
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
}
