import {
  characterStatTrackerLockKey,
  personaStatTrackerLockKey,
  worldTrackerLockKey,
  parseTrackerHiddenFields,
  parseGmTags,
  multiplayerGameStateSchema,
  normalizeCharacterLookupName,
  MULTIPLAYER_LIMITS,
  type MultiplayerGameState,
  type MultiplayerStoredRoom,
} from "@marinara-engine/shared";

function record(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function array(value: unknown): unknown[] {
  if (typeof value === "string") {
    try {
      return array(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}
const shortText = (value: unknown, length: number): string => (typeof value === "string" ? value.slice(0, length) : "");
const numeric = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000;

/** null requests public narration only. Unknown/ambiguous whisper recipients fail closed. */
export function gameNarrationForParticipant(
  content: string,
  room: MultiplayerStoredRoom,
  selfId: string | null,
  audienceSnapshot?: unknown,
): string {
  // A name can be reassigned after a persona change. Only the audience bound when this message
  // was committed can authorize a whisper; old/unbound messages expose public narration only.
  const audience = record(audienceSnapshot);
  const entries = Array.isArray(audience.participants) ? audience.participants.map(record) : [];
  const participants =
    audience.roomId === room.roomId &&
    entries.length > 0 &&
    entries.length <= MULTIPLAYER_LIMITS.players &&
    entries.every(
      (entry) =>
        typeof entry.id === "string" &&
        /^[A-Za-z0-9_-]{8,64}$/u.test(entry.id) &&
        typeof entry.name === "string" &&
        entry.name.length > 0 &&
        entry.name.length <= 80,
    )
      ? entries
      : [];
  let privateBlock = false;
  return content
    .split(/\r?\n/u)
    .filter((line) => {
      const speaker = /^\s*\[[^\]]+\]\s*\[(main|side|extra|action|thought|whisper(?::([^\]]+))?)\]/iu.exec(line);
      if (speaker) {
        const recipientName = speaker[2] ? normalizeCharacterLookupName(speaker[2]) : "";
        const recipients = recipientName
          ? participants.filter((p) => normalizeCharacterLookupName(p.name as string) === recipientName)
          : [];
        privateBlock =
          speaker[1]!.toLowerCase() === "thought" ||
          (speaker[1]!.toLowerCase().startsWith("whisper") &&
            (recipients.length !== 1 || recipients[0]!.id !== selfId));
      } else if (/^\s*(?:\[[^\]]+\]\s*)?\[(?:thought|whisper)\b/iu.test(line)) privateBlock = true;
      else if (/^\s*\[(?:narrator|narration|scene|party-turn|party-chat)\]/iu.test(line)) privateBlock = false;
      return !privateBlock;
    })
    .join("\n");
}

/** Only known public fields are copied; model-authored records are never serialized wholesale. */
export function projectMultiplayerGame(input: {
  room: MultiplayerStoredRoom;
  metadata: unknown;
  state?: unknown;
  messages: readonly { role: string; content: string; extra: unknown }[];
}): MultiplayerGameState {
  const meta = record(input.metadata);
  const state = record(input.state);
  const hidden = parseTrackerHiddenFields(state.hiddenTrackerFields);
  const latest = [...input.messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        record(message.extra).hiddenFromUser !== true &&
        record(message.extra).commandOnly !== true,
    );
  const content = (latest?.content ?? "")
    .slice(0, 64_000)
    .replace(/<(think|thinking|analysis|reasoning)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/giu, "");
  const publicContent = gameNarrationForParticipant(content, input.room, null);
  const tags = parseGmTags(publicContent);
  const rolls: MultiplayerGameState["rolls"] = tags.skillChecks
    .flatMap((check) =>
      check.resolvedResult && numeric(check.resolvedResult.total)
        ? [
            {
              label: shortText(check.who ? `${check.who}: ${check.skill}` : check.skill, 100) || "1d20",
              total: check.resolvedResult.total,
            },
          ]
        : [],
    )
    .slice(0, 12);
  // Untargeted extra dice have no audience attribution. Do not export them from a mixed private/public turn.
  if (latest && publicContent === content && !/<(?:think|thinking|analysis|reasoning)\b/iu.test(latest.content)) {
    const extra = record(latest.extra);
    for (const value of array(extra.diceRollResults)) {
      const roll = record(value);
      if (numeric(roll.total) && typeof roll.notation === "string" && rolls.length < 12)
        rolls.push({ label: roll.notation.slice(0, 100) || "Dice", total: roll.total });
    }
  }
  const owners = [
    ...input.room.participants.map((p) => ({ id: p.id, name: p.persona.name, isHost: p.isHost })),
    ...input.room.characters.filter((character) => character.role !== "gm").map((c) => ({ ...c, isHost: false })),
  ];
  const cards = array(meta.gameCharacterCards).map(record);
  const present = array(state.presentCharacters).map(record);
  const trackers: MultiplayerGameState["trackers"] = [];
  for (const owner of owners) {
    const ownerKey = owner.name.trim().toLocaleLowerCase();
    if (owners.filter((candidate) => candidate.name.trim().toLocaleLowerCase() === ownerKey).length !== 1) continue;
    const values: MultiplayerGameState["trackers"][number]["values"] = [];
    const addStat = (value: unknown, hiddenKey: (label: string, field: "name" | "value" | "max") => string) => {
      const stat = record(value);
      const label = shortText(stat.name, 80);
      if (
        !label ||
        !numeric(stat.value) ||
        ["name", "value", "max"].some((field) => hidden[hiddenKey(label, field as "name" | "value" | "max")])
      )
        return;
      if (values.some((entry) => entry.label === label)) return;
      values.push({ label, value: numeric(stat.max) ? `${stat.value} / ${stat.max}` : String(stat.value) });
    };
    const rowIndex = present.findIndex(
      (row) => row.characterId === owner.id || shortText(row.name, 80).trim().toLocaleLowerCase() === ownerKey,
    );
    if (rowIndex >= 0) {
      const row = present[rowIndex]!;
      for (const stat of array(row.stats))
        addStat(stat, (label, field) =>
          characterStatTrackerLockKey(
            { characterId: typeof row.characterId === "string" ? row.characterId : owner.id, name: owner.name },
            rowIndex,
            { name: label },
            field,
          ),
        );
    }
    if (owner.isHost)
      for (const stat of array(state.personaStats))
        addStat(stat, (label, field) => personaStatTrackerLockKey({ name: label }, field));
    // Starting sheet numbers are room-local and public. Never copy descriptions, inventories or arbitrary extra fields.
    if (rowIndex < 0 && !(owner.isHost && array(state.personaStats).length) && Object.keys(hidden).length === 0) {
      const matches = cards.filter((card) => shortText(card.name, 80).trim().toLocaleLowerCase() === ownerKey);
      if (matches.length === 1) {
        const rpg = record(matches[0]!.rpgStats);
        const hp = record(rpg.hp);
        if (numeric(hp.value) && numeric(hp.max)) values.push({ label: "HP", value: `${hp.value} / ${hp.max}` });
        for (const stat of array(rpg.attributes).slice(0, 12)) {
          const attribute = record(stat);
          if (typeof attribute.name === "string" && numeric(attribute.value))
            values.push({ label: attribute.name.slice(0, 80) || "Stat", value: String(attribute.value) });
        }
      }
    }
    if (values.length) trackers.push({ ownerId: owner.id, name: owner.name, values: values.slice(0, 16) });
  }
  const field = (name: "location" | "weather" | "time") =>
    hidden[worldTrackerLockKey(name)] ? null : shortText(state[name], 200) || null;
  return multiplayerGameStateSchema.parse({
    state: ["exploration", "dialogue", "combat", "travel_rest"].includes(String(meta.gameActiveState))
      ? meta.gameActiveState
      : "exploration",
    location: field("location"),
    weather: field("weather"),
    time: field("time"),
    choices: (tags.choices ?? [])
      .map((choice) => choice.slice(0, 300))
      .filter(Boolean)
      .slice(0, 8),
    rolls,
    trackers: trackers.slice(0, 12),
  });
}
