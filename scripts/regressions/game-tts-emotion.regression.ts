// Exercise the actual Game voice helpers without mounting their browser-only components or calling a provider.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { ttsConfigSchema, type TTSConfig } from "../../packages/shared/src/types/tts.js";
import { normalizeTextForMatch } from "../../packages/shared/src/utils/text-matching.js";
import type { GameNpc, PartyDialogueLine } from "../../packages/shared/src/types/game.js";
import type { NarrationSegment } from "../../packages/client/src/components/game/GameNarration.js";
import { normalizeSpriteExpressionKey } from "../../packages/client/src/lib/sprite-expression-match.js";
import {
  buildTTSVoiceRequests,
  extractDialogueUtterances,
  resolveTTSNarratorVoice,
  resolveTTSVoiceForSpeaker,
  splitTTSChunks,
} from "../../packages/client/src/lib/tts-dialogue.js";

function componentSource(name: string): ts.SourceFile {
  return ts.createSourceFile(
    name,
    readFileSync(new URL(`../../packages/client/src/components/game/${name}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function declarations(source: ts.SourceFile, names: string[]): string {
  return names
    .map((name) => {
      const declaration = source.statements.find(
        (statement) =>
          (ts.isFunctionDeclaration(statement) && statement.name?.text === name) ||
          (ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.some(
              (entry) => ts.isIdentifier(entry.name) && entry.name.text === name,
            )),
      );
      assert.ok(declaration, `${name} remains available for the Game TTS regression`);
      return declaration.getText(source);
    })
    .join("\n");
}

type VoiceMetadata = { speaker?: string; tone?: string; voice?: string; signal?: AbortSignal };
type VoiceRequest = VoiceMetadata & { chunks: string[] };
type VoiceJob = VoiceMetadata & { chunk: string; cacheKey: string; textCacheKey: string };
const generated: Array<{ text: string; options: VoiceMetadata }> = [];
const ttsService = {
  async generateAudio(text: string, options: VoiceMetadata) {
    generated.push({ text, options });
    return new Blob(["fixture-audio"]);
  },
};
const dependencies = {
  normalizeTextForMatch,
  normalizeSpriteExpressionKey,
  splitTTSChunks,
  resolveTTSNarratorVoice,
  resolveTTSVoiceForSpeaker,
  ttsService,
  getOrCreateCachedTTSAudioBlob: (_key: string, generate: () => Promise<Blob>) => generate(),
};
const narration = componentSource("GameNarration.tsx");
const gameCode = declarations(narration, [
  "GAME_TTS_EMOTIONS",
  "GAME_TTS_EMOTION_SET",
  "GAME_TTS_EMOTION_ALIASES",
  "GAME_TTS_CHUNK_ATTEMPTS",
  "normalizeGameTtsEmotion",
  "resolveGameSegmentTtsEmotion",
  "hashVoiceKey",
  "buildVoiceConfigSignature",
  "buildVoiceLineTextCacheKey",
  "buildVoiceLineSegmentCacheKey",
  "buildGameVoiceAudioJobs",
  "findNpcVoiceHint",
  "normalizeGameVoiceSpeakerName",
  "getGameVoicePlayerSpeakerNames",
  "isGameVoicePlayerSpeaker",
  "isGameVoicePlayerTaggedNarration",
  "shouldSkipGameVoiceSegment",
  "getGameSegmentVoiceRequest",
  "getGameSegmentVoiceKeyForRequests",
  "getGameSideLineVoiceKeyForRequests",
  "waitForGameTTSRetry",
  "waitForGameTTSBlob",
  "generateGameVoiceJobBlob",
]);
const game = new Function(
  ...Object.keys(dependencies),
  `${ts.transpileModule(gameCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}
   return {
     request: getGameSegmentVoiceRequest, jobs: buildGameVoiceAudioJobs, generate: generateGameVoiceJobBlob,
     playerNames: getGameVoicePlayerSpeakerNames, signature: buildVoiceConfigSignature,
     segmentKey: getGameSegmentVoiceKeyForRequests, sideKey: getGameSideLineVoiceKeyForRequests,
     textKey: buildVoiceLineTextCacheKey,
   };`,
)(...Object.values(dependencies)) as {
  request: (
    segment: NarrationSegment,
    config: TTSConfig,
    npcs?: GameNpc[],
    options?: { playerSpeakerNames?: ReadonlySet<string> },
  ) => VoiceRequest | null;
  jobs: (key: string, requests: VoiceRequest[], config: TTSConfig) => VoiceJob[];
  generate: (job: VoiceJob, controller: AbortController) => Promise<Blob>;
  playerNames: (persona: string) => Set<string>;
  signature: (config: TTSConfig) => string;
  segmentKey: (segment: NarrationSegment, signature: string, requests: VoiceRequest[]) => string;
  sideKey: (
    segment: NarrationSegment,
    line: PartyDialogueLine,
    index: number,
    signature: string,
    requests: VoiceRequest[],
  ) => string;
  textKey: (config: TTSConfig, job: Omit<VoiceJob, "cacheKey" | "textCacheKey">) => string;
};

const config = ttsConfigSchema.parse({
  enabled: true,
  source: "elevenlabs",
  voice: "fixture-voice",
  skipBracketedText: true,
  roleplaySpeakerExtractorEmotionsEnabled: true,
});
const main: NarrationSegment = {
  id: "main",
  type: "dialogue",
  speaker: "Dottore",
  sprite: "angry",
  partyType: "main",
  content: "[whispering] Stay close. [sigh]",
  sourceMessageId: "turn",
  sourceSegmentIndex: 0,
  sourceRole: "assistant",
};
const side: NarrationSegment = {
  ...main,
  id: "side",
  speaker: "Guard",
  sprite: "amused",
  partyType: "side",
  content: "[chuckle] As you wish.",
};
const mainRequest = game.request(main, config);
const sideRequest = game.request(side, config);
assert.ok(mainRequest && sideRequest);
assert.deepEqual(mainRequest.chunks, [main.content], "Game keeps inline cues despite skip-brackets when enabled");
assert.equal(mainRequest.tone, "angry", "the existing sprite tone is preserved alongside inline cues");
assert.deepEqual(sideRequest.chunks, [side.content]);
assert.equal(sideRequest.tone, "laughing", "side-line sprite aliases resolve through the real Game helper");
const disabled = { ...config, roleplaySpeakerExtractorEmotionsEnabled: false };
const taggedDialogue = '<speaker="Guard">[angry] Stay close. [Quietly, with controlled fear] Move.</speaker>';
assert.deepEqual(
  buildTTSVoiceRequests(taggedDialogue, config).map(({ text }) => text),
  ["[angry] Stay close. [Quietly, with controlled fear] Move."],
  "speaker extraction must preserve known emotion labels alongside descriptive cues",
);
assert.deepEqual(
  buildTTSVoiceRequests(taggedDialogue, disabled).map(({ text }) => text),
  ["Stay close. Move."],
);
const quotedDialogue = '"[laughing] As you wish. [Gentle laugh, then sincere] I understand."';
assert.deepEqual(
  buildTTSVoiceRequests(quotedDialogue, { ...config, dialogueOnly: true }).map(({ text }) => text),
  ["[laughing] As you wish. [Gentle laugh, then sincere] I understand."],
  "quoted dialogue extraction must receive the configured cue-preservation option",
);
assert.deepEqual(
  buildTTSVoiceRequests(quotedDialogue, { ...disabled, dialogueOnly: true }).map(({ text }) => text),
  ["As you wish. I understand."],
);
assert.deepEqual(
  buildTTSVoiceRequests(`[sad] The room quiets. ${taggedDialogue}`, config).map(({ text }) => text),
  ["[sad] The room quiets.", "[angry] Stay close. [Quietly, with controlled fear] Move."],
  "narration around speaker tags keeps its configured cues too",
);
assert.deepEqual(
  extractDialogueUtterances('"[laughing] As you wish."'),
  [{ text: "As you wish.", speaker: undefined }],
  "unconfigured extraction callers retain their existing defaults",
);
for (const [segment, plain] of [
  [main, "Stay close."],
  [side, "As you wish."],
] as const) {
  const request = game.request(segment, disabled);
  assert.ok(request);
  assert.deepEqual(request.chunks, [plain]);
  assert.equal(request.tone, game.request(segment, config)?.tone);
}

const options = { playerSpeakerNames: game.playerNames("Mari") };
for (const segment of [
  { ...main, sourceRole: "user" },
  { ...main, sourceRole: "system" },
  { ...main, partyType: "thought" },
  { ...main, speaker: "Mari" },
  { ...main, speaker: "You" },
  { ...main, type: "narration", content: "[Mari][main]: This is the player's line." },
] satisfies NarrationSegment[]) {
  assert.equal(game.request(segment, config, [], options), null, "Game voice exclusions still apply");
}

const jobs = game.jobs("turn-voice", [mainRequest, sideRequest], config);
assert.deepEqual(
  jobs.map(({ tone }) => tone),
  ["angry", "laughing"],
);
for (const job of jobs) await game.generate(job, new AbortController());
assert.deepEqual(
  generated.map(({ text, options: { speaker, tone } }) => ({ text, speaker, tone })),
  [
    { text: main.content, speaker: "Dottore", tone: "angry" },
    { text: side.content, speaker: "Guard", tone: "laughing" },
  ],
  "the actual Game synthesis helper forwards inline cues with the existing tone",
);

const combat = componentSource("GameCombatUI.tsx");
const combatCode = declarations(combat, [
  "hashCombatVoiceKey",
  "buildCombatVoiceConfigSignature",
  "buildCombatVoiceLineKey",
]);
const combatCache = new Function(
  `${ts.transpileModule(combatCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}
   return { signature: buildCombatVoiceConfigSignature, key: buildCombatVoiceLineKey };`,
)() as {
  signature: (config: TTSConfig) => string;
  key: (signature: string, line: PartyDialogueLine, chunks: string[], voice?: string) => string;
};
const line: PartyDialogueLine = { character: "Guard", type: "side", expression: "angry", content: side.content };
const narrationSegment: NarrationSegment = { ...main, type: "narration", content: "[softly] The fog gathers." };
const narrationRequest = game.request(narrationSegment, config);
assert.ok(narrationRequest);
assert.deepEqual(narrationRequest.chunks, [narrationSegment.content]);
for (const flag of [
  "roleplaySpeakerExtractorEmotionsEnabled",
  "skipTagContent",
  "skipCodeBlocks",
  "skipBracketedText",
] as const) {
  const changed = { ...config, [flag]: !config[flag] };
  assert.notEqual(game.signature(changed), game.signature(config), `${flag} invalidates Game voice entries`);
  assert.notEqual(
    game.segmentKey(narrationSegment, game.signature(changed), [narrationRequest]),
    game.segmentKey(narrationSegment, game.signature(config), [narrationRequest]),
    `${flag} invalidates narration audio`,
  );
  assert.notEqual(
    game.sideKey(main, line, 0, game.signature(changed), [sideRequest]),
    game.sideKey(main, line, 0, game.signature(config), [sideRequest]),
    `${flag} invalidates side-line audio`,
  );
  assert.notEqual(
    combatCache.key(combatCache.signature(changed), line, sideRequest.chunks),
    combatCache.key(combatCache.signature(config), line, sideRequest.chunks),
    `${flag} invalidates combat audio`,
  );
}
assert.notEqual(
  game.textKey(config, jobs[0]!),
  game.textKey(config, { ...jobs[0]!, chunk: "Stay close." }),
  "the reusable text cache distinguishes a line with delivery cues from a stripped line",
);

// Execute the component's actual generateAudio call expression, with its provider replaced by a recorder.
const combatCalls: ts.CallExpression[] = [];
function findCombatSynthesis(node: ts.Node): void {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.expression.getText(combat) === "ttsService" &&
    node.expression.name.text === "generateAudio"
  )
    combatCalls.push(node);
  ts.forEachChild(node, findCombatSynthesis);
}
findCombatSynthesis(combat);
assert.equal(combatCalls.length, 1);
const generateCombat = new Function(
  "ttsService",
  "chunk",
  "line",
  "ttsConfig",
  "controller",
  `return ${combatCalls[0]!.getText(combat)};`,
) as (
  service: typeof ttsService,
  chunk: string,
  line: PartyDialogueLine,
  config: TTSConfig,
  controller: AbortController,
) => Promise<Blob>;
for (const current of [config, disabled]) {
  const chunks = splitTTSChunks(line.content, current);
  assert.deepEqual(chunks, [current.roleplaySpeakerExtractorEmotionsEnabled ? line.content : "As you wish."]);
  await generateCombat(ttsService, chunks[0]!, line, current, new AbortController());
  const spoken = generated.at(-1)!;
  assert.equal(spoken.text, chunks[0]);
  assert.equal(spoken.options.speaker, line.character);
  assert.equal(spoken.options.tone, line.expression);
}
