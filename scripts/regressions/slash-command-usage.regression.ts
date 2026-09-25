import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../packages/client/src/lib/api-client.js";
import {
  getSlashCommandUsage,
  getSlashCompletions,
  matchSlashCommand,
  parseTargetedHideArguments,
  type SlashCommandContext,
} from "../../packages/client/src/lib/slash-commands.js";
import { i18n, translate } from "../../packages/client/src/localization/i18n.js";

const english = JSON.parse(
  readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
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
const writes: Array<{ path: string; body: unknown }> = [];
const originalGet = api.get;
const originalPatch = api.patch;
api.get = (async () => messages) as typeof api.get;
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
assert.equal(parameterized.length, 16);
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
