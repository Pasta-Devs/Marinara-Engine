// Guards the avatar "Generate with AI" lead prompt against tag-grammar profiles.
//
// The avatar path has no prompt-writing LLM: its lead sentence is a fixed template that the
// compiler keeps verbatim (avatar prompts are never compacted). With a Danbooru or tags profile
// that sentence became a prose clause inside a tag prompt, which NovelAI and Illustrious-style
// checkpoints treat as noise. The profile's avatar subject tags already say what the image is.
import assert from "node:assert/strict";
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

console.log("Avatar lead prompt regression passed.");
