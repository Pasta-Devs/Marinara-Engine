import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { PERSONAL_EXTENSION_DICE_LIMITS } from "../../packages/shared/dist/index.js";
import type {
  PersonalClientExtensionRuntime,
  PersonalExtension,
} from "../../packages/shared/src/types/personal-extension.js";
import { browserWorkerSource } from "../../packages/server/src/routes/personal-extensions.routes.js";
import {
  listPersonalExtensionDiceFormats,
  registerPersonalExtensionDiceFormat,
  removePersonalExtensionDiceFormat,
  removePersonalExtensionDiceFormats,
  resolvePersonalExtensionDiceResponse,
  rollWithPersonalExtensionDiceFormats,
  setPersonalExtensionDiceDispatcher,
} from "../../packages/client/src/lib/personal-extension-dice-formats.js";
import { matchSlashCommand, type SlashCommandContext } from "../../packages/client/src/lib/slash-commands.js";

type Message = Record<string, unknown> & { type?: string };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

// ── The sandbox Worker's half: marinara.dice.registerFormat ──

// A small symbol-dice format, the kind issue 8489 asked for: "2 boost 1 setback".
const extensionJs = `
const SIDES = { boost: 6, setback: 6, ability: 8 };
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0], ability: [0, 1, 1, 2, 0, 1, 1, 2] };
marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  parse(notation) {
    const terms = [...notation.matchAll(/(\\d+)\\s*(boost|setback|ability)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array.from({ length: Number(count) }, () => kind));
    return { dice: kinds.map((kind) => SIDES[kind]), kinds };
  },
  read({ rolls, plan }) {
    const net = rolls.reduce((sum, face, index) => sum + SYMBOLS[plan.kinds[index]][face - 1], 0);
    return { total: net, text: net > 0 ? net + " success" : "failure" };
  },
});
marinara.dice.registerFormat({
  id: "broken",
  label: "Broken",
  parse: (notation) => (notation === "cheat" ? { dice: [1] } : notation === "huge" ? { dice: [6] } : null),
  read: () => ({ total: 1, kept: [3] }),
});
`;
const sent: Message[] = [];
let dispatch: ((event: { data: unknown }) => void) | undefined;
runInNewContext(
  browserWorkerSource({
    id: "dice",
    name: "Dice",
    contentHash: "hash",
    capabilities: [],
    js: extensionJs,
  } as PersonalExtension),
  {
    self: {
      // Through JSON, as a structured clone would arrive from the worker's realm.
      postMessage: (message: Message) => sent.push(JSON.parse(JSON.stringify(message)) as Message),
      setTimeout,
      clearTimeout,
      setInterval: () => 0,
      clearInterval: () => undefined,
      addEventListener: (type: string, listener: typeof dispatch) => {
        if (type === "message") dispatch = listener;
      },
      close: () => undefined,
    },
  },
);
assert.ok(dispatch);
dispatch({ data: { type: "context-update", context: { chatId: null, characterIds: [] } } });
await tick();
assert.ok(
  sent.some((message) => message.type === "ready"),
  "the extension loads",
);
assert.deepEqual(
  sent.filter((message) => message.type === "dice-format-register").map((message) => message.format),
  [
    { id: "narrative", label: "Narrative dice" },
    { id: "broken", label: "Broken" },
  ],
  "registering a format tells the host its id and label, never its functions",
);

async function workerReply(data: Message) {
  const before = sent.length;
  dispatch!({ data: runInNewContext(`(${JSON.stringify(data)})`) });
  for (let attempt = 0; attempt < 5 && sent.length === before; attempt++) await tick();
  return sent.slice(before).find((message) => message.type?.startsWith("dice-"));
}

const parsed = await workerReply({
  type: "dice-parse",
  requestId: "r1",
  formatId: "narrative",
  notation: "2 boost 1 setback",
});
assert.deepEqual(parsed, { type: "dice-parse-result", requestId: "r1", ok: true, dice: [6, 6, 6] });
assert.deepEqual(
  await workerReply({ type: "dice-read", requestId: "r1", rolls: [3, 5, 3] }),
  { type: "dice-read-result", requestId: "r1", ok: true, total: 2, text: "2 success" },
  "read gets the host's faces and the plan parse made",
);
assert.equal(
  (await workerReply({ type: "dice-read", requestId: "r1", rolls: [3, 5, 3] }))?.ok,
  false,
  "a roll is read once",
);
assert.deepEqual(
  await workerReply({ type: "dice-parse", requestId: "r2", formatId: "narrative", notation: "2d6" }),
  { type: "dice-parse-result", requestId: "r2", ok: true, dice: null },
  "a format that does not read the notation says so",
);
await workerReply({ type: "dice-parse", requestId: "r3", formatId: "narrative", notation: "1 ability" });
assert.equal(
  (await workerReply({ type: "dice-read", requestId: "r3", rolls: [9] }))?.ok,
  false,
  "a face past its die's sides is refused before read sees it",
);
assert.equal(
  (await workerReply({ type: "dice-parse", requestId: "r4", formatId: "broken", notation: "cheat" }))?.ok,
  false,
  "a one-sided die is refused",
);
await workerReply({ type: "dice-parse", requestId: "r5", formatId: "broken", notation: "huge" });
assert.equal(
  (await workerReply({ type: "dice-read", requestId: "r5", rolls: [2] }))?.ok,
  false,
  "kept must name thrown dice",
);
assert.equal(
  (await workerReply({ type: "dice-parse", requestId: "r6", formatId: "missing", notation: "1 boost" }))?.ok,
  false,
);
dispatch({ data: { type: "stop" } });
assert.deepEqual(
  sent.filter((message) => message.type === "dice-format-remove").map((message) => message.formatId),
  ["narrative", "broken"],
  "stopping the extension removes its formats",
);

// ── The host's half: the registry, and the host throws every die ──

const extension = { id: "dice", name: "Dice", contentHash: "hash" } as PersonalClientExtensionRuntime;
const toHost: Message[] = [];
let answer: (message: Message) => Message | null = () => null;
setPersonalExtensionDiceDispatcher(extension, (message) => {
  toHost.push(message);
  const reply = answer(message);
  if (reply) {
    queueMicrotask(() =>
      resolvePersonalExtensionDiceResponse(extension, "hash", { requestId: message.requestId, ...reply }),
    );
  }
});
assert.equal(registerPersonalExtensionDiceFormat(extension, { id: "narrative", label: "Narrative dice" }), true);
assert.equal(registerPersonalExtensionDiceFormat(extension, { id: "narrative", label: "Again" }), false);
assert.equal(registerPersonalExtensionDiceFormat(extension, { id: "bad id!", label: "Bad" }), false);
assert.equal(registerPersonalExtensionDiceFormat(extension, { id: "no-label" }), false);
assert.equal(
  registerPersonalExtensionDiceFormat(extension, { id: "blank-description", label: "Blank", description: " " }),
  true,
  "a blank description is no description, as the sandbox lets it through",
);
assert.equal(
  listPersonalExtensionDiceFormats().find((format) => format.id === "blank-description")?.description,
  undefined,
);
removePersonalExtensionDiceFormat("dice", "hash", "blank-description");
assert.equal(listPersonalExtensionDiceFormats().length, 1);

answer = (message) =>
  message.type === "dice-parse"
    ? message.notation === "2 boost"
      ? { type: "dice-parse-result", ok: true, dice: [6, 6] }
      : { type: "dice-parse-result", ok: true, dice: null }
    : { type: "dice-read-result", ok: true, total: 2, text: "2 success", kept: [1] };
const thrown: number[] = [];
const rolled = await rollWithPersonalExtensionDiceFormats("2 boost", (sides) => {
  thrown.push(sides);
  return thrown.length + 2;
});
assert.deepEqual(thrown, [6, 6], "the host throws the dice the format named");
assert.deepEqual(
  toHost.find((message) => message.type === "dice-read")?.rolls,
  [3, 4],
  "and sends the extension the host's faces",
);
assert.deepEqual(rolled, {
  notation: "2 boost",
  formatLabel: "Narrative dice",
  extensionName: "Dice",
  dice: [6, 6],
  rolls: [3, 4],
  total: 2,
  text: "2 success",
  kept: [1],
});
for (const blank of ["", "   "]) {
  answer = (message) =>
    message.type === "dice-parse"
      ? { type: "dice-parse-result", ok: true, dice: [6] }
      : { type: "dice-read-result", ok: true, total: 3, text: blank };
  const plain = await rollWithPersonalExtensionDiceFormats("1 boost", () => 3);
  assert.equal(plain?.total, 3, "blank text still posts the roll");
  assert.equal(plain && "text" in plain, false);
}
answer = (message) =>
  message.type === "dice-parse"
    ? message.notation === "2 boost"
      ? { type: "dice-parse-result", ok: true, dice: [6, 6] }
      : { type: "dice-parse-result", ok: true, dice: null }
    : { type: "dice-read-result", ok: true, total: 2, text: "2 success", kept: [1] };
assert.equal(await rollWithPersonalExtensionDiceFormats("2d6"), null, "no format reads it");
assert.equal(
  await rollWithPersonalExtensionDiceFormats("x".repeat(PERSONAL_EXTENSION_DICE_LIMITS.notationLength + 1)),
  null,
);

// The host checks what the sandbox sends back, whatever the sandbox's own checks said.
for (const bad of [
  { type: "dice-parse-result", ok: true, dice: [1] },
  {
    type: "dice-parse-result",
    ok: true,
    dice: Array.from({ length: PERSONAL_EXTENSION_DICE_LIMITS.dice + 1 }, () => 6),
  },
  { type: "dice-parse-result", ok: true, dice: [PERSONAL_EXTENSION_DICE_LIMITS.maxSides + 1] },
]) {
  answer = (message) => (message.type === "dice-parse" ? bad : null);
  assert.equal(await rollWithPersonalExtensionDiceFormats("2 boost"), null, JSON.stringify(bad.dice).slice(0, 40));
}
for (const bad of [
  { type: "dice-read-result", ok: true, total: Number.NaN },
  { type: "dice-read-result", ok: true, total: 1, text: "x".repeat(PERSONAL_EXTENSION_DICE_LIMITS.textLength + 1) },
  { type: "dice-read-result", ok: true, total: 1, kept: [5] },
  { type: "dice-read-result", ok: false, error: "nope" },
]) {
  answer = (message) => (message.type === "dice-parse" ? { type: "dice-parse-result", ok: true, dice: [6] } : bad);
  assert.equal(await rollWithPersonalExtensionDiceFormats("1 boost"), null, JSON.stringify(bad));
}
// A reply under the wrong kind, or for another extension, settles nothing.
answer = () => null;
const waiting = rollWithPersonalExtensionDiceFormats("1 boost");
const parseRequest = toHost.at(-1)!;
resolvePersonalExtensionDiceResponse(extension, "hash", {
  type: "dice-read-result",
  requestId: parseRequest.requestId,
  ok: true,
});
resolvePersonalExtensionDiceResponse({ id: "other" }, "hash", {
  type: "dice-parse-result",
  requestId: parseRequest.requestId,
  ok: true,
  dice: [6],
});
// Stopping the extension answers its open request with nothing instead of waiting out the timeout.
removePersonalExtensionDiceFormats("dice");
assert.equal(await waiting, null);
assert.equal(listPersonalExtensionDiceFormats().length, 0);

// ── /roll asks extension formats only for notation the shared grammar does not read ──

setPersonalExtensionDiceDispatcher(extension, (message) => {
  toHost.push(message);
  const reply = answer(message);
  if (reply) {
    queueMicrotask(() =>
      resolvePersonalExtensionDiceResponse(extension, "hash", { requestId: message.requestId, ...reply }),
    );
  }
});
registerPersonalExtensionDiceFormat(extension, { id: "narrative", label: "Narrative [dice](https://x.test)" });
answer = (message) =>
  message.type === "dice-parse"
    ? { type: "dice-parse-result", ok: true, dice: [6, 6] }
    : { type: "dice-read-result", ok: true, total: 1, text: "![x](https://x.test/p.png) <b>1</b>\nsuccess" };
async function slashRoll(notation: string) {
  const match = matchSlashCommand(`/roll ${notation}`);
  assert.ok(match);
  const posted: Array<{ content: string; extra?: Record<string, unknown> }> = [];
  const result = await match.command.execute(match.args, {
    chatId: "extension-dice-regression",
    generate: async () => true,
    createMessage: (data: { content: string; extra?: Record<string, unknown> }) => {
      posted.push(data);
    },
    invalidate: () => {},
    characterNames: [],
  } as unknown as SlashCommandContext);
  return { result, posted: posted[0] };
}
const asked = toHost.length;
const slash = await slashRoll("2 boost");
assert.ok(slash.posted, "/roll posts an extension format's roll");
assert.match(slash.posted.content, /^🎲 \*\*2 boost\*\* → \*\*1\*\* \[\d, \d\] · /);
assert.doesNotMatch(
  slash.posted.content,
  /\]\(|<b>|\n/,
  "the extension's text cannot add links, images, HTML or lines",
);
assert.match(slash.posted.content, /\\!\\\[x\\\]\\\(https:\/\/x\\\.test\/p\\\.png\\\) \\<b\\>1\\<\/b\\> success/);
assert.match(slash.posted.content, /_\(Narrative \\\[dice\\\]\\\(https:\/\/x\\\.test\\\)\)_$/);
assert.equal(slash.posted.extra, undefined, "the d20-shaped dice card is not used for extension dice");
const beforePlain = toHost.length;
await slashRoll("2d6");
await slashRoll("500d6");
assert.equal(toHost.length, beforePlain, "NdM, even refused NdM, never reaches an extension");
assert.ok(toHost.length > asked);
answer = (message) => (message.type === "dice-parse" ? { type: "dice-parse-result", ok: true, dice: null } : null);
assert.match((await slashRoll("3 nonsense")).result.feedback ?? "", /Invalid dice notation/);
removePersonalExtensionDiceFormats("dice");

process.stdout.write("Extension dice formats regression passed.\n");
