import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate as nextTurn } from "node:timers/promises";
import { api } from "../../../packages/client/src/lib/api-client.js";
import {
  getSlashCommandUsage,
  getSlashCompletions,
  matchSlashCommand,
  parseTargetedHideArguments,
  type SlashCommandContext,
} from "../../../packages/client/src/lib/slash-commands.js";
import { i18n, translate } from "../../../packages/client/src/localization/i18n.js";

const english = JSON.parse(
  readFileSync(new URL("../../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
);
i18n.addResourceBundle("en", "translation", english);

const characters = [
  { id: "maria", name: "Lady Maria" },
  { id: "maukie", name: "Maukie" },
  { id: "maurice", name: "Maurice" },
  { id: "numeric", name: "123" },
];
const messages: Array<{ id: string; extra: unknown }> = [
  { id: "first", extra: { hiddenFromAICharacterIds: ["other"] } },
  { id: "second", extra: JSON.stringify({ hiddenFromAICharacterIds: ["maukie"] }) },
  { id: "third", extra: { hiddenFromAI: true, hiddenFromAICharacterIds: ["other"] } },
];
// The Illustrator's saved Prompt Mode options, as /agents returns them.
const agentConfigs = [
  {
    type: "illustrator",
    settings: JSON.stringify({
      defaultPromptTemplateName: "Illustration",
      promptTemplates: [
        { id: "comic-page", name: "Comic Page", promptTemplate: "Comic page." },
        { id: "painterly-cinematic", name: "Painterly Cinematic", promptTemplate: "Painterly." },
        { id: "house-default", name: "Default", promptTemplate: "House style." },
        { id: "night-a", name: "Night Sky", promptTemplate: "Night A." },
        { id: "night-b", name: "Night Sky", promptTemplate: "Night B." },
        // A custom option renamed to a built-in's name keeps its generated id.
        { id: "background", name: "Background", promptTemplate: "Background." },
        { id: "prompt-6", name: "Background", promptTemplate: "Custom background." },
        // Ids that differ only by "_" and "-" stay separate options.
        { id: "dusk_sky", name: "Dusk_Sky", promptTemplate: "Dusk underscore." },
        { id: "dusk-sky", name: "Dusk Sky", promptTemplate: "Dusk hyphen." },
      ],
    }),
  },
];
const getFixture = (async (path: string) => (path === "/agents" ? agentConfigs : messages)) as typeof api.get;
const writes: Array<{ path: string; body: unknown }> = [];
const originalGet = api.get;
const originalPatch = api.patch;
api.get = getFixture;
api.patch = (async (path: string, body: unknown) => {
  writes.push({ path, body });
  if (path.endsWith("/extra")) {
    const message = messages.find((candidate) => path.endsWith(`/${candidate.id}/extra`))!;
    message.extra = {
      ...(typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra),
      ...(body as object),
    };
  }
  return {};
}) as typeof api.patch;
const context: SlashCommandContext = {
  chatId: "slash-chat",
  mode: "roleplay",
  characters,
  characterNames: characters.map((character) => character.name),
  invalidate: () => {},
  createMessage: async () => {},
  generate: async () => {},
};

try {
  const illustrate = matchSlashCommand("/illustrate", { mode: "roleplay" })!.command;
  const illustrations: unknown[] = [];
  const illustrationContext = {
    ...context,
    illustrate: async (prompt?: string, range?: [string, string], template?: string) => {
      illustrations.push({ prompt, range, ...(template ? { template } : {}) });
    },
  };
  await illustrate.execute("range=1-2", illustrationContext);
  await illustrate.execute("range=2 a moonlit garden", illustrationContext);
  await illustrate.execute("a moonlit garden", illustrationContext);
  assert.deepEqual(illustrations, [
    { prompt: undefined, range: ["first", "second"] },
    { prompt: "a moonlit garden", range: ["second", "second"] },
    { prompt: "a moonlit garden", range: undefined },
  ]);
  for (const args of [
    "range=0",
    "range=2-1",
    "range=1-201",
    "range=4",
    "range=x",
    "range=1-",
    "range=9007199254740992",
  ]) {
    assert.ok((await illustrate.execute(args, illustrationContext)).feedback, args);
  }
  assert.equal(illustrations.length, 3, "invalid ranges never start illustration");

  const historyLookup = Promise.withResolvers<typeof messages>();
  const pendingIllustration = Promise.withResolvers<void>();
  let concurrentIllustrations = 0;
  const concurrentContext = {
    ...context,
    illustrate: async () => {
      concurrentIllustrations++;
      await pendingIllustration.promise;
    },
  };
  api.get = (() => historyLookup.promise) as typeof api.get;
  const firstIllustration = illustrate.execute("range=1", concurrentContext);
  const secondIllustration = illustrate.execute("range=2", concurrentContext);
  historyLookup.resolve(messages);
  try {
    await nextTurn();
    assert.equal(concurrentIllustrations, 1, "concurrent history lookups must not start duplicate illustrations");
    assert.ok((await secondIllustration).feedback, "the second command explains that illustration is busy");
  } finally {
    pendingIllustration.resolve();
    await Promise.all([firstIllustration, secondIllustration]);
    api.get = getFixture;
  }
  await illustrate.execute("range=2", illustrationContext);
  assert.equal(illustrations.length, 4, "illustration is available again after the first request finishes");

  // template= picks one of the Illustrator's Prompt Mode options for this call only (#9409).
  illustrations.length = 0;
  for (const args of [
    "template=painterly_cinematic range=2 Claire holds the gate x=y",
    'range=1-2 template="Painterly Cinematic"',
    "template=\u201cpainterly cinematic\u201d range=1 dusk",
    "template=default a garden",
    "template=Illustration",
    "TEMPLATE=Comic-Page",
    "template=night-b",
    "a garden template=comic-page",
    // The exact id an ambiguity message lists always resolves it.
    "template=background",
    "template=prompt-6",
    "template=dusk_sky",
    "template=dusk-sky",
  ]) {
    await illustrate.execute(args, illustrationContext);
  }
  assert.deepEqual(illustrations, [
    { prompt: "Claire holds the gate x=y", range: ["second", "second"], template: "painterly-cinematic" },
    { prompt: undefined, range: ["first", "second"], template: "painterly-cinematic" },
    { prompt: "dusk", range: ["first", "first"], template: "painterly-cinematic" },
    { prompt: "a garden", range: undefined, template: "default" },
    { prompt: undefined, range: undefined, template: "default" },
    { prompt: undefined, range: undefined, template: "comic-page" },
    { prompt: undefined, range: undefined, template: "night-b" },
    { prompt: "a garden template=comic-page", range: undefined },
    { prompt: undefined, range: undefined, template: "background" },
    { prompt: undefined, range: undefined, template: "prompt-6" },
    { prompt: undefined, range: undefined, template: "dusk_sky" },
    { prompt: undefined, range: undefined, template: "dusk-sky" },
  ]);
  assert.equal(
    (await illustrate.execute("template=watercolor a garden", illustrationContext)).feedback,
    translate("ui.chat.slash.illustrate.templateNotFound", {
      name: "watercolor",
      available:
        "Illustration, Comic Page, Painterly Cinematic, Default, Night Sky, Night Sky, Background, Background, Dusk_Sky, Dusk Sky",
    }),
  );
  for (const [args, name, matches] of [
    ['range=1 template="Night Sky" stars', "Night Sky", "Night Sky (night-a), Night Sky (night-b)"],
    // A name that ties with another option's id is ambiguous too, not a silent pick of the id.
    ["template=Background", "Background", "Background (background), Background (prompt-6)"],
    ['template="Dusk Sky"', "Dusk Sky", "Dusk_Sky (dusk_sky), Dusk Sky (dusk-sky)"],
  ] as const) {
    assert.equal(
      (await illustrate.execute(args, illustrationContext)).feedback,
      translate("ui.chat.slash.illustrate.ambiguousTemplate", { name, matches }),
      args,
    );
  }
  assert.equal(illustrations.length, 12, "an unknown or ambiguous Prompt Mode never starts illustration");

  const command = matchSlashCommand("/hide 1-2 Lady Maria", { mode: "roleplay" })!;
  await command.command.execute(command.args, context);
  assert.deepEqual(
    writes,
    [
      { path: "/chats/slash-chat/messages/first/extra", body: { hiddenFromAICharacterIds: ["other", "maria"] } },
      { path: "/chats/slash-chat/messages/second/extra", body: { hiddenFromAICharacterIds: ["maukie", "maria"] } },
    ],
    "Range-first hide must append the target to each selected message without replacing other character IDs",
  );
  writes.length = 0;
  await command.command.execute('1-3 "Lady Maria"', context);
  assert.deepEqual(writes, [], "Repeated targeting is idempotent and globally hidden messages remain untouched");

  await command.command.execute("Maukie 1", context);
  assert.deepEqual(
    writes,
    [
      {
        path: "/chats/slash-chat/messages/first/extra",
        body: { hiddenFromAICharacterIds: ["other", "maria", "maukie"] },
      },
    ],
    "Existing name-first execution still preserves unrelated targets",
  );

  writes.length = 0;
  for (const args of [
    "1 Nobody",
    "1 Mau",
    "123 1",
    "1 123",
    "0 Lady Maria",
    "1-x Lady Maria",
    "1,,2 Lady Maria",
    "1, Lady Maria",
    "1-,2 Lady Maria",
    "4 Lady Maria",
    '1 "Lady Maria" extra',
  ]) {
    const result = await command.command.execute(args, context);
    assert.ok(result.feedback, `Invalid target/range must explain rejection: ${args}`);
    assert.deepEqual(writes, [], `Invalid target/range must never fall back to a global write: ${args}`);
  }
  const wrongMode = await command.command.execute("1 Lady Maria", { ...context, mode: "conversation" });
  assert.equal(wrongMode.feedback, english["ui.chat.slash.hideTargetRoleplayOnly"]);
  assert.deepEqual(writes, []);

  await command.command.execute("1-2", { ...context, mode: "conversation" });
  assert.deepEqual(
    writes,
    [{ path: "/chats/slash-chat/messages/bulk-hidden", body: { messageIds: ["first", "second"], hidden: true } }],
    "An index-only command remains global in Conversation",
  );
  writes.length = 0;
  await command.command.execute("1-3", context);
  assert.deepEqual(writes, [
    { path: "/chats/slash-chat/messages/bulk-hidden", body: { messageIds: ["first", "second"], hidden: true } },
  ]);
  writes.length = 0;
  await matchSlashCommand("/unhide 1-3")!.command.execute("1-3", context);
  assert.deepEqual(
    writes,
    [{ path: "/chats/slash-chat/messages/bulk-hidden", body: { messageIds: ["third"], hidden: false } }],
    "/unhide retains its global-only behavior",
  );
  assert.deepEqual((messages[0]!.extra as { hiddenFromAICharacterIds: string[] }).hiddenFromAICharacterIds, [
    "other",
    "maria",
    "maukie",
  ]);
} finally {
  api.get = originalGet;
  api.patch = originalPatch;
}

for (const input of ['1-2 "Lady Maria"', '"Lady Maria" 1-2', "2-1 Lady Maria", "1, 2 Lady Maria"]) {
  assert.deepEqual(
    parseTargetedHideArguments(input, "roleplay", characters),
    { kind: "targeted", character: characters[0], indices: [1, 2] },
    input,
  );
}
for (const input of ["123 1-2", '"123" 1-2', '1-2 "123"']) {
  assert.deepEqual(
    parseTargetedHideArguments(input, "roleplay", characters),
    { kind: "targeted", character: characters[3], indices: [1, 2] },
    input,
  );
}
assert.deepEqual(parseTargetedHideArguments("123", "roleplay", characters), { kind: "global", indices: [123] });
for (const input of ["1 123", "123 1"]) {
  const parsed = parseTargetedHideArguments(input, "roleplay", characters);
  assert.equal(parsed.kind, "error", `Conflicting range/name interpretations must be rejected: ${input}`);
  assert.equal(parsed.kind === "error" && parsed.reason, "ambiguous");
}
for (const input of ['1 "123"', '"123" 1', "1 ‘123’"]) {
  assert.deepEqual(parseTargetedHideArguments(input, "roleplay", characters), {
    kind: "targeted",
    character: characters[3],
    indices: [1],
  });
}
assert.equal(parseTargetedHideArguments("1 Mau", "roleplay", characters).kind, "error");
assert.deepEqual(parseTargetedHideArguments("Mau 1", "roleplay", characters), {
  kind: "error",
  reason: "ambiguous",
  targetName: "Mau",
});

const availability = {
  mode: "conversation" as const,
  conversationGames: [{ packageId: "uno", packageName: "UNO", command: "/uno", aliases: [] }],
};
const commands = getSlashCompletions("/", availability);
const parameterized = [
  ...new Map(
    [...commands, ...getSlashCompletions("/", { mode: "roleplay" })]
      .filter((command) => command.usage.includes("["))
      .map((command) => [command.name, command]),
  ).values(),
];
assert.equal(parameterized.length, 17);
for (const command of parameterized) {
  assert.equal(english[`ui.chat.slash.usage.${command.name}`], command.usage);
  assert.equal(getSlashCommandUsage(command, translate), command.usage);
  assert.doesNotMatch(command.usage, /<|e\.g\./u);
}
assert.equal(getSlashCommandUsage(matchSlashCommand("/dice")!.command, translate), "/roll [dice (optional)]");
assert.equal(getSlashCommandUsage(matchSlashCommand("/uno", availability)!.command, translate), "/uno");
i18n.addResource("en", "translation", "ui.chat.slash.usage.roll", "/roll [localized dice]");
const help = await matchSlashCommand("/help", availability)!.command.execute("", { ...context, ...availability });
assert.ok(
  help.feedback?.includes("/roll [localized dice] - Roll dice"),
  "/help must use the same translated usage helper as suggestions",
);
assert.ok(
  help.feedback?.includes("/uno - Start UNO"),
  "Argument-free package commands must retain their fallback usage",
);
assert.ok(help.feedback?.includes(english["ui.chat.slash.help.arguments"]));
assert.ok(help.feedback?.includes(english["ui.chat.slash.help.ranges"]));

const emote = matchSlashCommand("/emote", { mode: "roleplay" })!.command;
const switched: Array<[string, string]> = [];
try {
  api.get = (async () => [{ expression: "happy", label: "joy" }, { expression: "neutral" }]) as typeof api.get;
  const emoteContext = {
    ...context,
    setSpriteExpression: async (id: string, handle: string) => {
      switched.push([id, handle]);
    },
  };
  const listing = await emote.execute("", emoteContext);
  assert.match(listing.feedback ?? "", /joy, neutral/);
  assert.doesNotMatch(listing.feedback ?? "", /happy/);
  await emote.execute('"Lady Maria" joy', emoteContext);
  assert.deepEqual(switched, [["maria", "happy"]], "a renamed emote resolves to the concrete file handle");
  await emote.execute('"all" joy', emoteContext);
  assert.equal(switched.length, 5);
  assert((await emote.execute('"Lady Maria" unavailable', emoteContext)).feedback?.includes("not found"));
  assert.equal(switched.length, 5, "an unknown emote must not fall back to another picture");
} finally {
  api.get = originalGet;
}
