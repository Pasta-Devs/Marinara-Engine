/* global console, process */
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);
// Images, fonts and media are already compressed; only text gains.
const COMPRESSIBLE = /\.(?:html|m?js|css|json|svg|webmanifest|txt|xml|md)$/u;
const MIN_BYTES = 1024;
// Starting every file at once held about 1 GB of brotli state; 8 at a time peaks near 220 MB and still keeps
// zlib's threadpool busy.
const FILES_IN_FLIGHT = 8;
// Phones and small boards (build.mjs's low-memory build) take quality 9: about 8% larger, over ten times faster.
const BROTLI_QUALITY = process.platform === "android" || process.env.MARINARA_LOW_MEMORY_BUILD === "1" ? 9 : 11;

async function precompressFile(file, totals) {
  const source = await readFile(file);
  if (source.length < MIN_BYTES) return;
  const [br, gz] = await Promise.all([
    brotliAsync(source, {
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
        [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    }),
    gzipAsync(source, { level: constants.Z_BEST_COMPRESSION }),
  ]);
  totals.files++;
  totals.plain += source.length;
  for (const [extension, compressed] of [
    ["br", br],
    ["gz", gz],
  ]) {
    if (compressed.length >= source.length) continue;
    // Written aside and renamed, so a build stopped part-way never leaves a truncated copy the server would send.
    const temporary = join(dirname(file), `.${basename(file)}.${extension}.tmp`);
    await writeFile(temporary, compressed);
    await rename(temporary, `${file}.${extension}`);
    totals[extension] += compressed.length;
  }
}

/**
 * Writes a .br and a .gz copy next to every text file of 1 KiB or more under dir, keeping a copy only when it is
 * smaller. The server sends them through @fastify/static's preCompressed (client-static-config.ts). Dot folders such
 * as .vite/ are skipped because the server does not serve them.
 * ponytail: overwrites but never deletes copies, so it relies on `vite build` emptying dist first; a step that
 * patches dist in place afterwards must delete the stale .br/.gz copies or rerun this.
 */
export async function precompressDirectory(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && COMPRESSIBLE.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => !/(?:^|[\\/])\./u.test(relative(dir, file)));
  const totals = { files: 0, plain: 0, br: 0, gz: 0 };
  let next = 0;
  await Promise.all(
    Array.from({ length: FILES_IN_FLIGHT }, async () => {
      while (next < files.length) await precompressFile(files[next++], totals);
    }),
  );
  return totals;
}

/** Precompresses the build output after every other plugin, including vite-plugin-pwa's sw.js, has written it. */
export function precompressAssets() {
  let outDir;
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);
  return {
    name: "precompress-assets",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle: {
      order: "post",
      sequential: true,
      async handler(error) {
        if (error) return;
        const started = Date.now();
        const totals = await precompressDirectory(outDir);
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        console.log(
          `[precompress] ${totals.files} files, ${mb(totals.plain)} MB -> br ${mb(totals.br)} MB, gzip ${mb(totals.gz)} MB in ${seconds} s`,
        );
      },
    },
  };
}
