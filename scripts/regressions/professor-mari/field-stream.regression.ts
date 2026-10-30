import assert from "node:assert/strict";
import {
  createCharacterFieldStreamExtractor,
  createJsonFieldStreamExtractor,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";

/** Feeds `text` one character at a time, so every escape and tag is split across chunks. */
function feedSplit(sink: (chunk: string) => void, text: string) {
  for (const char of text) sink(char);
}

// `say` decodes every JSON escape, including \u escapes and surrogate pairs cut mid-sequence.
{
  const value = 'Café "quoted"\n\ttab\\slash/ \b\f 😀 end';
  for (const split of [true, false]) {
    let said = "";
    const sink = createJsonFieldStreamExtractor("say", (chunk) => (said += chunk));
    const frame = `{"say":${JSON.stringify(value).replace("é", "\\u00e9").replace("😀", "\\ud83d\\ude00")},"commands":[]}`;
    if (split) feedSplit(sink, frame);
    else sink(frame);
    assert.equal(said, value, split ? "char-by-char" : "one chunk");
  }
}

// A held high surrogate never reaches the sink alone.
{
  const chunks: string[] = [];
  const sink = createJsonFieldStreamExtractor("say", (chunk) => chunks.push(chunk));
  sink('{"say":"a\\ud83d');
  sink("\\ude00b");
  assert.deepEqual(chunks, ["a", "😀b"]);
}

// Character update fields stream by patch key; other commands and keys do not.
{
  const deltas: Record<string, string> = {};
  const ids = new Set<string>();
  const sink = createCharacterFieldStreamExtractor(({ characterId, field, text }) => {
    ids.add(characterId);
    deltas[field] = (deltas[field] ?? "") + text;
  });
  const frame = JSON.stringify({
    say: "",
    commands: [
      { name: "app_data", arguments: { action: "persona.create", data: { description: "not her character" } } },
      {
        name: "app_data",
        arguments: {
          action: "character.update",
          characterId: "char-1",
          patch: { description: 'Tall "quiet"\nsmith ✓', firstMes: "Hi", extensions: { backstory: "Born 😀" } },
          reason: "asked",
          apply: false,
        },
      },
      { name: "docs_read", arguments: { path: "docs/x.md" } },
    ],
    stop: false,
  });
  feedSplit(sink, `\`\`\`json\n${frame.replace("✓", "\\u2713")}\n\`\`\``);
  assert.deepEqual(deltas, {
    description: 'Tall "quiet"\nsmith ✓',
    firstMes: "Hi",
    "extensions.backstory": "Born 😀",
    reason: "asked",
  });
  assert.deepEqual([...ids], ["char-1"]);
}

// A later command for the same field restarts it; action aliases stream; a bad \u escape stays literal.
{
  const fields: Record<string, string> = {};
  const seen: string[] = [];
  const sink = createCharacterFieldStreamExtractor(({ field, text, restart }) => {
    fields[field] = (restart ? "" : (fields[field] ?? "")) + text;
    if (restart) seen.push(text);
  });
  const update = (action: string, description: string) => ({
    name: "app_data",
    arguments: { action, characterId: "char-1", patch: { description } },
  });
  const frame = JSON.stringify({
    commands: [update("Characters.Update", "first try"), update("character.update", "second try")],
  });
  feedSplit(sink, frame);
  assert.deepEqual(seen, ["f", "s"], "the alias streams, and each command restarts the field");
  assert.equal(fields.description, "second try", "second command replaces the first");

  const literal: Record<string, string> = {};
  createCharacterFieldStreamExtractor(({ field, text }) => (literal[field] = (literal[field] ?? "") + text))(
    '{"commands":[{"name":"app_data","arguments":{"action":"character.update","characterId":"c","patch":{"description":"a\\uZZZZb"}}}]}',
  );
  assert.equal(literal.description, "a\\uZZZZb");
}
