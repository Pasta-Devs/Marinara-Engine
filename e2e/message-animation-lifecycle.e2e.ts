import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("message entrance releases rendering hints while long replies keep growing", async ({ page }) => {
  const css = readFileSync(new URL("../packages/client/src/styles/globals.css", import.meta.url), "utf8");
  const entranceCss = css.slice(css.indexOf("@keyframes message-in {"), css.indexOf("@keyframes slide-in-left {"));
  expect(entranceCss).toContain(".animate-message-in");
  await page.setContent(`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      ${entranceCss}
      body { margin: 0; }
      main { height: 80vh; overflow: auto; }
      article { padding: 12px; font: 16px/1.5 sans-serif; }
      p { margin: 0 0 12px; }
    </style>
    <main>${"<article>Saved Roleplay message.</article>".repeat(20)}<article id="reply"></article></main>
  `);
  const reply = page.locator("#reply");
  const longParagraph = "Synthetic Roleplay reply with ordinary words and punctuation. ".repeat(24);
  await reply.evaluate(async (element, paragraph) => {
    element.textContent = paragraph;
    element.classList.add("animate-message-in");
    const animations = element.getAnimations();
    if (animations.length !== 1) throw new Error("The existing message entrance must still animate");
    await animations[0].finished;
  }, longParagraph);

  await expect(reply).toHaveCSS("will-change", "auto");
  await expect(reply).toHaveCSS("transform", "none");
  await expect(reply).toHaveCSS("opacity", "1");
  await reply.evaluate((element, paragraph) => {
    for (let index = 0; index < 12; index++) {
      const line = document.createElement("p");
      line.textContent = paragraph;
      element.append(line);
    }
  }, longParagraph);
  const settledGeometry = await reply.boundingBox();
  expect(settledGeometry!.height).toBeGreaterThan(2_000);
  await expect(reply).toHaveCSS("will-change", "auto");
  expect(await reply.evaluate((element) => element.getAnimations().length)).toBe(0);

  // The retained class must have no visual or layout effect after its entrance.
  await reply.evaluate((element) => element.classList.remove("animate-message-in"));
  expect(await reply.boundingBox()).toEqual(settledGeometry);
});
