// Guards the avatar "Generate with AI" lead prompt against tag-grammar profiles.
//
// The avatar path has no prompt-writing LLM: its lead sentence is a fixed template that the
// compiler keeps verbatim (avatar prompts are never compacted). With a Danbooru or tags profile
// that sentence became a prose clause inside a tag prompt, which NovelAI and Illustrious-style
// checkpoints treat as noise. The profile's avatar subject tags already say what the image is.
import assert from "node:assert/strict";
import { compileImagePrompt, DEFAULT_IMAGE_STYLE_PROFILES } from "../../packages/shared/src/index.js";
import { buildAvatarPortraitLeadPrompt } from "../../packages/server/src/services/image/avatar-generation-prompt.js";

const subjectTags = "solo, upper body, looking at viewer, centered composition";

// Tag grammars: the subject tags carry the composition, so no sentence is emitted.
assert.equal(
  buildAvatarPortraitLeadPrompt({ name: "Delaney Rhodes", profileSubjectTags: subjectTags, promptMode: "danbooru" }),
  "",
  "Danbooru profiles with avatar subject tags get no prose lead",
);
assert.equal(
  buildAvatarPortraitLeadPrompt({ name: "Delaney Rhodes", profileSubjectTags: subjectTags, promptMode: "tagged" }),
  "",
  "plain tag profiles behave the same way",
);

// Tag grammars without avatar subject tags still need a composition, expressed as tags.
const taggedFallback = buildAvatarPortraitLeadPrompt({
  name: "Delaney Rhodes",
  profileSubjectTags: "",
  promptMode: "danbooru",
});
assert.match(taggedFallback, /^solo, /, "fallback composition is written as tags");
assert.doesNotMatch(taggedFallback, /Create a|portrait for/i, "no prose sneaks into the tag fallback");
assert.doesNotMatch(taggedFallback, /Delaney/, "the character name is not a tag");

// Prose grammars keep the existing sentences unchanged.
assert.equal(
  buildAvatarPortraitLeadPrompt({ name: "Delaney Rhodes", profileSubjectTags: subjectTags, promptMode: "natural" }),
  "Create a polished character avatar portrait for Delaney Rhodes.",
);
assert.equal(
  buildAvatarPortraitLeadPrompt({ name: "Delaney Rhodes", profileSubjectTags: "", promptMode: "hybrid" }),
  "Create a polished character avatar portrait for Delaney Rhodes. Composition: centered face-and-shoulders portrait, readable expression, clear silhouette, suitable as a chat avatar.",
);
assert.equal(
  buildAvatarPortraitLeadPrompt({ name: "   ", profileSubjectTags: subjectTags, promptMode: "natural" }),
  "Create a polished character avatar portrait for Character.",
  "blank names fall back to the generic label",
);

// #6074: LoRA syntax in either style field must leave the character appearance intact.
const appearance = "silver-furred fox-woman, braided crown, persimmon kimono, embroidered moonflowers";
for (const promptMode of ["natural", "hybrid", "tagged", "danbooru"] as const) {
  const profile = {
    ...DEFAULT_IMAGE_STYLE_PROFILES[0]!,
    promptMode,
    positiveTags: "<lora:portrait-style:0.8>, detailed face",
    negativeTags: "<lora:negative-style:1.2>, blurry",
    subjectTags: { avatar: subjectTags },
  };
  const compiled = compileImagePrompt({
    kind: "avatar",
    prompt: buildAvatarPortraitLeadPrompt({ name: "Lyra", profileSubjectTags: subjectTags, promptMode }),
    userPositive: appearance,
    styleProfiles: { defaultProfileId: profile.id, profiles: [profile] },
  });
  assert.ok(compiled.prompt.includes(appearance), `${promptMode} must preserve the complete appearance`);
  assert.ok(compiled.prompt.includes("<lora:portrait-style:0.8>"));
  assert.ok(compiled.negativePrompt.includes("<lora:negative-style:1.2>"));
}

console.log("Avatar lead prompt regression passed.");
