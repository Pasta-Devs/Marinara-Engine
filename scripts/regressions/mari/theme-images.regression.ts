// Mari can put a generated picture into one of the user's themes (`mari images assign --target
// theme-image`): it lands in the theme's package as WebP, big pictures are scaled to 2560 px, a
// small one stays lossless, the same name replaces, starters are refused, and theme reads show
// names and sizes instead of the picture data.
import assert from "node:assert/strict";
import { withHandbook } from "./_handbook.js";
import { customThemes } from "../../../packages/server/src/db/schema/themes.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- command outputs are probed field by field */
await withHandbook(
  "builtin-theme-design",
  async ({ mari, db }) => {
    const { getSharp } = await import("../../../packages/server/src/services/image/sharp-runtime.js");
    const sharp = await getSharp();
    const { MariImagesService } = await import("../../../packages/server/src/services/mari-db/mari-images.service.js");
    const images = new MariImagesService(db as any);
    const png = async (width: number, height: number) =>
      `data:image/png;base64,${(
        await sharp({ create: { width, height, channels: 3, background: { r: 30, g: 90, b: 160 } } })
          .png()
          .toBuffer()
      ).toString("base64")}`;
    const run = (...args: string[]) =>
      images.execute(args, { command: `mari images ${args.join(" ")}`, sessionId: "t" });

    const created: any = await mari.executeAction({
      action: "theme.create",
      id: "harbor-glass",
      data: { name: "Harbor Glass", css: ":root { --primary: #3fae7a; }" },
      apply: true,
    });
    assert.equal(created.ok, true);

    const dry: any = await run(
      "assign",
      "--source",
      await png(64, 64),
      "--target",
      "theme-image",
      "--theme",
      "harbor-glass",
      "--name",
      "icon.png",
    );
    assert.equal(dry.mode, "dry-run", "without --apply nothing is saved");

    const big: any = await run(
      "assign",
      "--source",
      await png(4000, 1000),
      "--target",
      "theme-image",
      "--theme",
      "harbor-glass",
      "--name",
      "Night Sky.png",
      "--apply",
    );
    assert.equal(big.ok, true, String(big.error ?? ""));
    const result = big.output.result;
    assert.equal(result.name, "Night-Sky.webp", "the name is cleaned and saved as .webp");
    assert.equal(result.css, 'url("theme:Night-Sky.webp")');
    assert.equal(result.width, 2560, "big pictures are scaled to 2560 px on the longest side");

    const small: any = await run(
      "assign",
      "--source",
      await png(48, 48),
      "--target",
      "theme-image",
      "--theme",
      "harbor-glass",
      "--name",
      "frame",
      "--apply",
    );
    assert.equal(small.ok, true);
    const again: any = await run(
      "assign",
      "--source",
      await png(32, 32),
      "--target",
      "theme-image",
      "--theme",
      "harbor-glass",
      "--name",
      "frame.webp",
      "--apply",
    );
    assert.equal(again.output.result.replaced, true, "the same name replaces the picture");
    assert.deepEqual(again.output.result.pictures, ["Night-Sky.webp", "frame.webp"]);

    const stored = (await (db as any).select().from(customThemes)).find((row: any) => row.id === "harbor-glass");
    const meta = JSON.parse(stored.meta);
    assert.match(meta.images[0].src, /^data:image\/webp;base64,/, "stored as a WebP data: URL in the package");
    assert.equal(stored.css, ":root { --primary: #3fae7a; }", "the CSS is untouched");

    const read: any = await mari.executeAction({ action: "theme.get", id: "harbor-glass" });
    const text = JSON.stringify(read.output);
    assert.doesNotMatch(text, /base64/, "theme.get never returns picture data");
    assert.equal(read.output.meta.images[1].name, "frame.webp");
    assert.ok(read.output.meta.images[1].bytes > 0);

    const kept: any = await mari.executeAction({
      action: "theme.update",
      id: "harbor-glass",
      patch: { css: ':root { --mari-app-backdrop: url("theme:Night-Sky.webp"); }' },
      apply: true,
    });
    assert.equal(kept.ok, true);
    const afterUpdate = (await (db as any).select().from(customThemes)).find((row: any) => row.id === "harbor-glass");
    assert.equal(JSON.parse(afterUpdate.meta).images.length, 2, "a CSS update keeps the pictures");

    const removed: any = await run(
      "delete",
      "--target",
      "theme-image",
      "--theme",
      "harbor-glass",
      "--name",
      "frame.webp",
      "--apply",
    );
    assert.deepEqual(removed.output.result.pictures, ["Night-Sky.webp"]);

    const t = "2026-01-01T00:00:00.000Z";
    await (db as any).insert(customThemes).values({
      id: "starter-petal-os",
      name: "Petal OS",
      css: "",
      installedAt: t,
      createdAt: t,
      updatedAt: t,
      isActive: "false",
      meta: "{}",
    });
    const refused: any = await run(
      "assign",
      "--source",
      await png(8, 8),
      "--target",
      "theme-image",
      "--theme",
      "starter-petal-os",
      "--name",
      "a.webp",
      "--apply",
    ).catch((error: Error) => ({ ok: false, error: error.message }));
    assert.equal(refused.ok, false, "starters are read-only");
    assert.match(String(refused.error), /Clone \+ Edit/);

    // Theme art goes out exactly as Mari wrote it: no style profile text, no prompt prefixes, no
    // LoRAs or style reference, whatever the user set up for character art.
    const { mariImagePrompt } = await import("../../../packages/server/src/services/mari-db/mari-images.service.js");
    const shared: any = await import("../../../packages/shared/src/index.js");
    const profile = {
      id: "anime",
      name: "Anime girls",
      baseStyle: "anime",
      promptMode: "tags",
      styleText: "anime style, cel shading",
      positiveTags: "1girl, masterpiece",
      negativeTags: "bad hands",
      subjectTags: { illustration: "solo, looking at viewer" },
      rules: { dedupeStrength: "normal", preferTagsOverNarrative: false, preserveUserPhrases: true },
    };
    const userDefaults: any = {
      version: 1,
      service: "comfyui",
      seed: 7,
      styleProfileId: "anime",
      comfyui: {
        ...shared.DEFAULT_COMFYUI_DEFAULTS,
        promptPrefix: "score_9, 1girl",
        negativePromptPrefix: "lowres",
        loras: [{ model: "waifu.safetensors", strength: 0.8 }],
      },
      novelai: {
        ...shared.DEFAULT_NOVELAI_DEFAULTS,
        promptPrefix: "1girl",
        styleReferenceImage: "data:image/png;base64,AA",
      },
    };
    const themeArt = "seamless dark navy paper texture with faint gold flecks, no people";
    const sent = mariImagePrompt({
      verbatim: true,
      kind: "illustration",
      prompt: themeArt,
      negativePrompt: "",
      styleProfiles: { defaultProfileId: "anime", profiles: [profile] } as any,
      imageDefaults: userDefaults,
    });
    assert.equal(sent.prompt, themeArt, "the prompt goes out unchanged");
    assert.equal(sent.negativePrompt, "");
    assert.equal(sent.imageDefaults?.styleProfileId, undefined);
    assert.equal(sent.imageDefaults?.comfyui?.promptPrefix, "");
    assert.equal(sent.imageDefaults?.comfyui?.negativePromptPrefix, "");
    assert.deepEqual(sent.imageDefaults?.comfyui?.loras, []);
    assert.equal(sent.imageDefaults?.comfyui?.steps, userDefaults.comfyui.steps, "technical settings stay");
    assert.equal(sent.imageDefaults?.seed, 7);
    assert.equal(sent.imageDefaults?.novelai?.promptPrefix, "");
    assert.equal(sent.imageDefaults?.novelai?.styleReferenceImage, null);
    assert.equal(userDefaults.comfyui.promptPrefix, "score_9, 1girl", "the user's settings are not changed");
    const character = mariImagePrompt({
      verbatim: false,
      kind: "illustration",
      prompt: "a knight",
      negativePrompt: "",
      styleProfiles: { defaultProfileId: "anime", profiles: [profile] } as any,
      imageDefaults: userDefaults,
    });
    assert.notEqual(character.prompt, "a knight", "character art still uses the user's style");

    // --count makes 1 to 4 versions in one command.
    const { imageCount } = await import("../../../packages/server/src/services/mari-db/mari-images.service.js");
    assert.equal(imageCount(new Map()), 1);
    assert.equal(imageCount(new Map([["count", "3"]])), 3);
    assert.throws(() => imageCount(new Map([["count", "9"]])), /1 to 4/);
    assert.throws(() => imageCount(new Map([["count", "2.5"]])), /1 to 4/);
    const tooMany: any = await run("generate", "--prompt", "x", "--count", "9").catch((error: Error) => ({
      ok: false,
      error: error.message,
    }));
    assert.equal(tooMany.ok, false);
    assert.match(String(tooMany.error), /1 to 4/);
  },
  { dataDir: true },
);

console.log("Mari theme images regression passed.");
