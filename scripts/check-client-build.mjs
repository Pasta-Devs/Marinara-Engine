import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Use Vite's own chunk inventory, including lazy imports, to detect partial builds. */
export function checkClientBuild(clientDist) {
  const root = resolve(clientDist);
  const requireFile = (file) => {
    if (typeof file !== "string" || !file) throw new Error("Invalid client build entry");
    const path = resolve(root, file);
    const within = relative(root, path);
    if (isAbsolute(within) || within === ".." || within.startsWith("../") || within.startsWith("..\\")) {
      throw new Error(`Client build entry escapes dist: ${file}`);
    }
    const stat = statSync(path);
    if (!stat.isFile() || stat.size === 0) throw new Error(`Missing or empty client file: ${file}`);
  };
  requireFile("index.html");
  const manifest = JSON.parse(readFileSync(resolve(root, ".vite/manifest.json"), "utf8"));
  if (!manifest?.["index.html"]?.isEntry) throw new Error("Missing client entry in Vite manifest");
  for (const chunk of Object.values(manifest)) {
    requireFile(chunk.file);
    for (const file of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) requireFile(file);
    for (const id of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
      if (!manifest[id]) throw new Error(`Missing client chunk in Vite manifest: ${id}`);
    }
  }
  // A stale index beside a newer manifest is also an incomplete build.
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  if (!html.includes(`/${manifest["index.html"].file}`)) throw new Error("Client index and Vite manifest disagree");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    checkClientBuild(resolve(root, "packages/client/dist"));
  } catch (error) {
    console.error(`Client build is incomplete: ${error.message}`);
    process.exitCode = 1;
  }
}
