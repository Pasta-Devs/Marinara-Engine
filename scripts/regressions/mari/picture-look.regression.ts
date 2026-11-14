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
