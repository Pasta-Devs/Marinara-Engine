import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChatUserIdentity } from "../../packages/server/src/services/chat-user-identity.js";
import {
  buildRetryAgentPersona,
  resolveIdentityCharacterScopes,
} from "../../packages/server/src/services/generation/identity-context-runtime.js";
import { resolveToolLorebookCharacterIds } from "../../packages/server/src/services/generation/tool-resolution-runtime.js";
import { createInputMacroResolverForChat } from "../../packages/client/src/lib/chat-macros.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const characterStorage = {
  getById: async (id: string) =>
    id === "identity-character"
      ? {
          id,
          avatarPath: "/characters/identity-character/avatar.png",
          data: JSON.stringify({
            name: "Identity Character",
            description: "Character description",
            personality: "Character personality",
            scenario: "Character scenario",
            first_mes: "Hello",
            mes_example: "",
            creator_notes: "",
            system_prompt: "",
            post_history_instructions: "",
            alternate_greetings: [],
            tags: ["identity"],
            extensions: {
              phoneticName: "Eye-den-ti-tee",
              backstory: "Character backstory",
              appearance: "Character appearance",
              characterSheetImageId: "sheet-1",
              useCharacterSheetAsReference: "true",
            },
          }),
        }
      : null,
  listPersonas: async () => [],
};

const characterIdentity = await resolveChatUserIdentity(characterStorage as never, {
  personaId: "must-not-win",
  personaCharacterId: "identity-character",
  mode: "roleplay",
});
assert.deepEqual(
  characterIdentity && {
    source: characterIdentity.source,
    id: characterIdentity.id,
    phoneticName: characterIdentity.phoneticName,
    characterSheetImageId: characterIdentity.characterSheetImageId,
    useCharacterSheetAsReference: characterIdentity.useCharacterSheetAsReference,
  },
  {
    source: "character",
    id: "identity-character",
    phoneticName: "Eye-den-ti-tee",
    characterSheetImageId: "sheet-1",
    useCharacterSheetAsReference: true,
  },
  "Character-backed identities must retain their source and reference metadata without consulting Persona storage",
);
const missingCharacterResolver = createInputMacroResolverForChat(
  { personaCharacterId: "missing-character", personaId: null, mode: "roleplay" },
  [],
  [{ id: "global-persona", name: "Global Persona", isActive: "true" } as never],
);
assert.equal(
  missingCharacterResolver("{{personaName}} / {{persona}}").includes("Global Persona"),
  false,
  "A missing selected character identity must not fall back to the global Persona",
);

const generateSource = readFileSync(join(repositoryRoot, "packages/server/src/routes/generate.routes.ts"), "utf8");
const dryRunSource = readFileSync(join(repositoryRoot, "packages/server/src/routes/generate/dry-run-route.ts"), "utf8");
const retrySource = readFileSync(
  join(repositoryRoot, "packages/server/src/routes/generate/retry-agents-route.ts"),
  "utf8",
);
const assemblerSource = readFileSync(join(repositoryRoot, "packages/server/src/services/prompt/assembler.ts"), "utf8");
const markerExpanderSource = readFileSync(
  join(repositoryRoot, "packages/server/src/services/prompt/marker-expander.ts"),
  "utf8",
);
const extensionSource = readFileSync(
  join(repositoryRoot, "packages/server/src/routes/personal-extensions.routes.ts"),
  "utf8",
);
const chatAreaSource = readFileSync(join(repositoryRoot, "packages/client/src/components/chat/ChatArea.tsx"), "utf8");
const conversationMessageSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/chat/ConversationMessage.tsx"),
  "utf8",
);
const chatsRouteSource = readFileSync(join(repositoryRoot, "packages/server/src/routes/chats.routes.ts"), "utf8");

assert.match(
  generateSource,
  /personaId = identity\.source === "persona" \? identity\.id : null;[\s\S]*?withIdentityLorebookScope/u,
  "Live generation must not route a character row ID through Persona scope",
);
assert.match(
  dryRunSource,
  /personaId = identity\.source === "persona" \? identity\.id : null;[\s\S]*?withIdentityLorebookScope/u,
  "Prompt dry runs must mirror live identity scope",
);
assert.match(
  assemblerSource,
  /characterIds: input\.characterIds,\s*lorebookCharacterIds: input\.lorebookCharacterIds/u,
  "Preset assembly must keep character markers separate from the lorebook-only identity scope",
);
assert.match(
  markerExpanderSource,
  /characterIds: ctx\.lorebookCharacterIds \?\? ctx\.characterIds/u,
  "Lorebook matching must use the dedicated character-backed identity scope",
);
assert.match(
  retrySource,
  /_userIdentityId = personaContext\.identityId;[\s\S]*?_userIdentitySource = personaContext\.identitySource/u,
  "Agent retries must retain both the active identity ID and its source",
);
assert.match(
  retrySource,
  /retryCharacterIdentity[\s\S]*?retryIdentitySource === "character"[\s\S]*?chatCharacters/u,
  "Illustrator retries must resolve character-backed identity references through character scope",
);
assert.match(
  extensionSource,
  /normalizePersonaContext[\s\S]*?value\?\.source === "character" \|\| value\?\.source === "persona"/u,
  "Personal-extension context normalization must preserve the validated identity source",
);
assert.match(
  chatAreaSource,
  /typeof data\?\.name === "string" && data\.name\.trim\(\) \? data\.name : "Unknown"/u,
  "Malformed or blank imported character names must not enter display, macro, or TTS identity state",
);
assert.match(
  chatAreaSource,
  /conversationStatus === "online"[\s\S]*?conversationActivity:\s*typeof extensions\.conversationActivity === "string"/u,
  "Character-backed identities must retain validated presence metadata",
);
assert.match(
  conversationMessageSource,
  /personaInfo\?\.source === "character" && personaInfo\.id === aboutMeIdentity\.id[\s\S]*?\? personaInfo[\s\S]*?characterMap\?\.get\(aboutMeIdentity\.id\)/u,
  "The About Me viewer must use the active character identity's presence outside the assistant roster",
);
assert.match(
  conversationMessageSource,
  /: message\.characterId && charInfo\s*\? charInfo\s*:\s*null/u,
  "The About Me viewer must not attribute fallback presence metadata to a missing assistant character",
);
assert.equal(
  retrySource.match(/resolvePersonaContext\(chars, chat\)/gu)?.length,
  1,
  "Agent retries must resolve the chat identity only once per request",
);
assert.equal(
  retrySource.match(/personaContext: retryPersonaContext/gu)?.length,
  2,
  "Both retry context builds must reuse the request-scoped identity",
);
assert.equal(
  buildRetryAgentPersona(
    { identityId: "identity-character", name: "User", description: "Still present" },
    (value) => value,
  )?.name,
  "User",
  'Retry agent context must retain valid identities whose display name is "User"',
);
const retryToolScopes = resolveIdentityCharacterScopes(["assistant-character"], {
  id: "identity-character",
  source: "character",
});
assert.deepEqual(
  retryToolScopes,
  {
    promptCharacterIds: ["assistant-character"],
    lorebookCharacterIds: ["assistant-character", "identity-character"],
  },
  "Character-backed identities must extend lorebook scope without entering assistant prompt scope",
);
assert.deepEqual(
  resolveToolLorebookCharacterIds(retryToolScopes.promptCharacterIds, retryToolScopes.lorebookCharacterIds),
  ["assistant-character", "identity-character"],
  "Tool lorebook search must consume the dedicated identity-aware scope",
);
assert.match(
  generateSource,
  /e\.characterId === userIdentityId && !characterIds\.includes\(e\.characterId\)/u,
  "Live expression persistence must prefer assistant routing when an identity overlaps the active cast",
);
assert.match(
  retrySource,
  /e\.characterId === userIdentityId &&\s*!agentContext\.characters\.some\(\(character\) => character\.id === e\.characterId\)/u,
  "Retry expression persistence must prefer assistant routing when an identity overlaps the active cast",
);
assert.match(
  chatsRouteSource,
  /personaDescription && !alreadyInPrompt\(personaDescription\)/u,
  "A preset that already contains only the identity description must still receive its other missing fields",
);

console.info("Character identity regressions passed.");
