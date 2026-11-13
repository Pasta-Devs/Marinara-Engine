// Mari can fix a picture without an image model (`mari images adjust`): crop, trim, a flat background
// made see-through (only where it touches the edge unless --everywhere), resize, flip, rotate and tint.
// Each makes a new preview asset that can then go into a theme.
import assert from "node:assert/strict";
import { withHandbook } from "./_handbook.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- command outputs are probed field by field */
await withHandbook(
  "builtin-theme-design",
  async ({ mari, db }) => {
    const { getSharp } = await import("../../../packages/server/src/services/image/sharp-runtime.js");
    const sharp = await getSharp();
    const { MariImagesService, pictureAdjustments } =
      await import("../../../packages/server/src/services/mari-db/mari-images.service.js");
    const images = new MariImagesService(db as any);
    const run = (...args: string[]) =>
      images
        .execute(args, { command: `mari images ${args.join(" ")}`, sessionId: "t" })
        .catch((error: Error) => ({ ok: false, error: error.message }) as any);

    // White 200×100 card, a red disc in the middle, a white dot inside the disc.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#ffffff"/><circle cx="100" cy="50" r="40" fill="#d02020"/><circle cx="100" cy="50" r="6" fill="#ffffff"/></svg>`;
    const source = `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
    const pixel = async (assetUrl: string, x: number, y: number) => {
      const id = assetUrl;
      const got: any = await run("get", id);
      const file = got.output?.asset?.filePath ?? got.output?.filePath;
      assert.ok(file, `asset ${id} can be read back`);
      const { DATA_DIR } = await import("../../../packages/server/src/utils/data-dir.js");
      const raw = await sharp(`${DATA_DIR}/gallery/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const o = (y * raw.info.width + x) * 4;
      return {
        r: raw.data[o]!,
        g: raw.data[o + 1]!,
        b: raw.data[o + 2]!,
        a: raw.data[o + 3]!,
        w: raw.info.width,
        h: raw.info.height,
      };
    };

    const edges: any = await run("adjust", "--source", source, "--transparent");
    assert.equal(edges.ok, true, String(edges.error ?? ""));
    const edgeId = edges.output.asset.id;
    assert.equal((await pixel(edgeId, 2, 2)).a, 0, "the white background is see-through");
    assert.equal((await pixel(edgeId, 70, 50)).a, 255, "the red disc stays");
    assert.equal((await pixel(edgeId, 100, 50)).a, 255, "white inside the disc stays (not touching the edge)");

    const everywhere: any = await run("adjust", "--source", source, "--transparent", "#fff", "--everywhere");
    assert.equal((await pixel(everywhere.output.asset.id, 100, 50)).a, 0, "--everywhere clears the dot too");

    const trimmed: any = await run("adjust", "--source", source, "--trim", "--crop", "0,0,100%,100%");
    const t = await pixel(trimmed.output.asset.id, 0, 0);
    assert.ok(t.w <= 82 && t.h <= 82, `trim cuts to the disc, got ${t.w}×${t.h}`);

    const cropped: any = await run("adjust", "--source", source, "--crop", "0,0,50%,100%");
    assert.deepEqual([cropped.output.width, cropped.output.height], [100, 100]);

    const resized: any = await run("adjust", "--source", edgeId, "--resize", "50");
    assert.deepEqual([resized.output.width, resized.output.height], [50, 25], "an asset id works as the source");

    const turned: any = await run("adjust", "--source", source, "--rotate", "90", "--flip", "h", "--tint", "#3366ff");
    assert.deepEqual([turned.output.width, turned.output.height], [100, 200]);
    assert.equal(turned.output.steps.length, 3);

    assert.throws(() => pictureAdjustments(new Map()), /Say what to change/);
    assert.throws(() => pictureAdjustments(new Map([["crop", "1,2,3"]])), /left,top,width,height/);
    assert.throws(() => pictureAdjustments(new Map([["rotate", "45"]])), /90, 180 or 270/);
    assert.throws(() => pictureAdjustments(new Map([["tint", "red"]])), /hex/);
    const outside: any = await run("adjust", "--source", source, "--crop", "300,0,10,10");
    assert.equal(outside.ok, false);
    assert.match(String(outside.error), /outside/);

    // The adjusted picture goes into a theme like any other, transparency kept.
    await mari.executeAction({
      action: "theme.create",
      id: "glass-sticker",
      data: { name: "Glass Sticker", css: ":root{}" },
      apply: true,
    });
    const assigned: any = await run(
      "assign",
      "--asset",
      edgeId,
      "--target",
      "theme-image",
      "--theme",
      "glass-sticker",
      "--name",
      "disc",
      "--apply",
    );
    assert.equal(assigned.ok, true, String(assigned.error ?? ""));
    const theme: any = await mari.executeAction({ action: "theme.get", id: "glass-sticker" });
    assert.equal(theme.output.meta.images[0].name, "disc.webp");
    const { createThemesStorage } = await import("../../../packages/server/src/services/storage/themes.storage.js");
    const row: any = await createThemesStorage(db as any).getById("glass-sticker");
    const stored = (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta).images[0].src as string;
    const webp = Buffer.from(stored.split(",")[1]!, "base64");
    const corner = await sharp(webp).ensureAlpha().raw().toBuffer();
    assert.equal(corner[3], 0, "the theme picture keeps its see-through background");
  },
  { dataDir: true },
);

console.log("Mari picture adjust regression passed.");
