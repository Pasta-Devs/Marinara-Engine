// Mari can look at pictures: `mari images look`, and generate/edit/adjust, return them on the result's `images`
// (data URLs, #9342), which her runtime attaches to her next request. Before, her tools returned only text, so
// "pick the best of 3 versions" was blind.
import assert from "node:assert/strict";
import { withHandbook } from "./_handbook.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- command outputs are probed field by field */
await withHandbook(
  "builtin-theme-design",
  async ({ db }) => {
    const { getSharp } = await import("../../../packages/server/src/services/image/sharp-runtime.js");
    const sharp = await getSharp();
    const { MariImagesService } = await import("../../../packages/server/src/services/mari-db/mari-images.service.js");
    const pixels = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    const images = new MariImagesService(db as any);
    const run = (...args: string[]) =>
      images
        .execute(args, { command: `mari images ${args.join(" ")}`, sessionId: "t" })
        .catch((error: Error) => ({ ok: false, error: error.message }) as any);

    const big = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1200"><rect width="2400" height="1200" fill="#2050d0"/></svg>`;
    const source = `data:image/png;base64,${(await sharp(Buffer.from(big)).png().toBuffer()).toString("base64")}`;

    const looked: any = await run("look", "--source", source);
    assert.equal(looked.ok, true, String(looked.error ?? ""));
    assert.equal(looked.images?.length, 1, "one picture comes back for the model");
    assert.ok(!/base64/u.test(JSON.stringify(looked.output)), "the words only name it, never carry pixels");
    const seen = await sharp(pixels(looked.images[0])).metadata();
    assert.ok(Math.max(seen.width!, seen.height!) <= 1024, "the model gets a smaller copy");
    const low: any = await run("look", source, "--detail", "low");
    const seenLow = await sharp(pixels(low.images[0])).metadata();
    assert.ok(Math.max(seenLow.width!, seenLow.height!) <= 512, "--detail low sends a smaller copy");

    // A tiny see-through sprite is enlarged and laid on grey, so a pink outline on a white flake can be seen.
    const flake = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="10" fill="#fff" stroke="#ff66cc" stroke-width="3"/></svg>') }])
      .png()
      .toBuffer();
    const small: any = await run("look", "--source", `data:image/png;base64,${flake.toString("base64")}`);
    const seenSmall = pixels(small.images[0]);
    const smallMeta = await sharp(seenSmall).metadata();
    assert.equal(Math.max(smallMeta.width!, smallMeta.height!), 384, "small pictures are shown enlarged");
    assert.equal(smallMeta.hasAlpha, false, "see-through parts are laid on grey");
    const corner = await sharp(seenSmall).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    assert.deepEqual([...corner].slice(0, 3), [128, 128, 128]);

    const adjusted: any = await run("adjust", "--source", source, "--resize", "300");
    assert.equal(adjusted.ok, true, String(adjusted.error ?? ""));
    assert.equal(adjusted.images?.length, 1, "adjust shows Mari its result");

    const tooMany: any = await run("look", "--source", [source, source, source, source, source].join(","));
    assert.equal(tooMany.ok, false, "at most 4 at a time");
    console.log("mari picture-look regression passed");
  },
  { dataDir: true },
);
