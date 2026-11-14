// Mari can look at pictures: `mari images look`, and generate/edit/adjust, put a marker in their output, and the
// pi runtime swaps it for the pictures themselves (sent to the model like attached pictures). Before, her tools
// returned only text, so "pick the best of 3 versions" was blind.
import assert from "node:assert/strict";
import { withHandbook } from "./_handbook.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- command outputs are probed field by field */
await withHandbook(
  "builtin-theme-design",
  async ({ db }) => {
    const { getSharp } = await import("../../../packages/server/src/services/image/sharp-runtime.js");
    const sharp = await getSharp();
    const { MariImagesService } = await import("../../../packages/server/src/services/mari-db/mari-images.service.js");
    const { takeLookImages } = await import("../../../packages/server/src/services/professor-mari/mari-look-images.js");
    const images = new MariImagesService(db as any);
    const run = (...args: string[]) =>
      images
        .execute(args, { command: `mari images ${args.join(" ")}`, sessionId: "t" })
        .catch((error: Error) => ({ ok: false, error: error.message }) as any);

    const big = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1200"><rect width="2400" height="1200" fill="#2050d0"/></svg>`;
    const source = `data:image/png;base64,${(await sharp(Buffer.from(big)).png().toBuffer()).toString("base64")}`;

    const looked: any = await run("look", "--source", source);
    assert.equal(looked.ok, true, String(looked.error ?? ""));
    const text = JSON.stringify(looked.output);
    const taken = takeLookImages(text);
    assert.equal(taken.images.length, 1, "one picture comes back for the model");
    assert.ok(!/mari-look:/u.test(taken.text), "the marker is removed from the words");
    const seen = await sharp(Buffer.from(taken.images[0]!.data, "base64")).metadata();
    assert.ok(Math.max(seen.width!, seen.height!) <= 1024, "the model gets a smaller copy");
    assert.equal(takeLookImages(text).images.length, 0, "each picture is handed over once");

    // A tiny see-through sprite is enlarged and laid on grey, so a pink outline on a white flake can be seen.
    const flake = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="10" fill="#fff" stroke="#ff66cc" stroke-width="3"/></svg>') }])
      .png()
      .toBuffer();
    const small: any = await run("look", "--source", `data:image/png;base64,${flake.toString("base64")}`);
    const seenSmall = takeLookImages(JSON.stringify(small.output)).images[0]!;
    const smallMeta = await sharp(Buffer.from(seenSmall.data, "base64")).metadata();
    assert.equal(Math.max(smallMeta.width!, smallMeta.height!), 384, "small pictures are shown enlarged");
    assert.equal(smallMeta.hasAlpha, false, "see-through parts are laid on grey");
    const corner = await sharp(Buffer.from(seenSmall.data, "base64")).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    assert.deepEqual([...corner].slice(0, 3), [128, 128, 128]);

    const adjusted: any = await run("adjust", "--source", source, "--resize", "300");
    assert.equal(adjusted.ok, true, String(adjusted.error ?? ""));
    assert.equal(takeLookImages(JSON.stringify(adjusted.output)).images.length, 1, "adjust shows Mari its result");

    const tooMany: any = await run("look", "--source", [source, source, source, source, source].join(","));
    assert.equal(tooMany.ok, false, "at most 4 at a time");
    assert.equal(takeLookImages("no marker here").text, "no marker here");
    console.log("mari picture-look regression passed");
  },
  { dataDir: true },
);
