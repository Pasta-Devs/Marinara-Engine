// Scores one Game Master reply for the tail-caching eval (scripts/eval/gm-tail-eval.mjs).
// Everything here is read from the reply and from the prompt that produced it, so the same
// checks hold for any ruleset: the tag vocabulary and the sheets come out of the prompt itself.

const SPEAKER_TYPES = /^(main|side|thought|whisper:[^\]]+)$/;

/** The text of every message the model was sent, joined. */
export function promptText(messages) {
  return messages.map((message) => (typeof message.content === "string" ? message.content : "")).join("\n\n");
}

/** Every [tag: ...] name the prompt teaches. */
export function taughtTags(prompt) {
  const names = new Set(["on success", "on failure", "/branch", "think"]);
  for (const match of prompt.matchAll(/\[([A-Za-z_/][A-Za-z_ ]*?)\s*:/g)) names.add(match[1].trim().toLowerCase());
  return names;
}

function stripThinking(reply) {
  let text = reply.trimStart();
  const leading = /^<think>[\s\S]*?<\/think>\s*/i.exec(text);
  if (leading) text = text.slice(leading[0].length);
  return text;
}

/** The commands in a reply: name and raw params. */
export function replyTags(reply) {
  const tags = [];
  for (const match of reply.matchAll(/\[([A-Za-z_/][A-Za-z_ ]*?)\s*:\s*([^\]]*)\]/g)) {
    tags.push({ name: match[1].trim().toLowerCase(), params: match[2], raw: match[0] });
  }
  return tags;
}

/** A character's sheet block from the <character_sheets> or <party_state> the prompt carries. */
export function sheetFacts(prompt, name) {
  const sheets = [...prompt.matchAll(/<character_sheets>([\s\S]*?)<\/character_sheets>/g)].map((m) => m[1]);
  const blocks = (sheets.at(-1) ?? "").split(/\n\s*\n/);
  const block = blocks.find((text) => text.trimStart().toLowerCase().startsWith(name.toLowerCase()));
  if (!block) return null;
  const ac = /\b(?:AC|Armor Class|Armour Class)\D{0,6}(\d{1,2})\b/i.exec(block)?.[1];
  const hp = /\b(?:HP|Hit Points|Health)\D{0,6}(\d{1,3})\s*\/\s*(\d{1,3})/i.exec(block);
  return { block, ac: ac ?? null, hpNow: hp?.[1] ?? null, hpMax: hp?.[2] ?? null };
}

/**
 * The generic checks every reply gets, then the scenario's own.
 * Returns { checks: { name: true|false|null }, notes: string[] } where null is "does not apply".
 */
export function scoreReply({ reply, messages, scenario, partyNames = [] }) {
  const prompt = promptText(messages);
  const taught = taughtTags(prompt);
  const text = stripThinking(reply);
  const notes = [];
  const checks = {};

  // Format: no planning in the open, a well-formed line for every speaker.
  const planningLeak =
    /^(plan|location|opening scene|scene|notes?|analysis)\s*:/i.test(text) ||
    /<\/?think>/i.test(text) ||
    /^#{1,3} /m.test(text);
  checks.noPlanningLeak = !planningLeak;
  if (planningLeak) notes.push("planning or headings in the open");

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const speakerLines = lines.filter((line) => /^\[[^\]:\n]+\]\s*\[/.test(line));
  const badSpeaker = speakerLines.filter((line) => {
    const m = /^\[([^\]\n]+)\] \[([^\]\n]+)\] \[([^\]\n]+)\]: \S/.exec(line);
    return !m || !SPEAKER_TYPES.test(m[2]);
  });
  checks.speakerFormat = badSpeaker.length === 0;
  if (badSpeaker.length) notes.push(`bad speaker lines: ${badSpeaker.slice(0, 2).join(" | ")}`);
  if (partyNames.length && speakerLines.length) {
    const party = new Set(partyNames.map((name) => name.toLowerCase()));
    const near = speakerLines
      .map((line) => /^\[([^\]]+)\]/.exec(line)[1])
      .filter(
        (name) =>
          !party.has(name.toLowerCase()) && partyNames.some((p) => name.toLowerCase().includes(p.toLowerCase())),
      );
    checks.partyLabels = near.length === 0;
    if (near.length) notes.push(`party name expanded: ${near[0]}`);
  }

  // Commands: only tags the prompt teaches.
  const tags = replyTags(text);
  const unknown = tags.filter((tag) => !taught.has(tag.name));
  checks.knownTags = unknown.length === 0;
  if (unknown.length) notes.push(`unknown tags: ${unknown.map((tag) => tag.name).join(", ")}`);

  // Dice: never a number the Engine did not roll.
  const prose = text.replace(/\[\[[^\]]*\]\]/g, "").replace(/\[[^\]]*\]/g, "");
  const invented =
    /\b(rolls?|rolled|rolling)\b[^.\n]{0,24}\b\d{1,2}\b/i.test(prose) ||
    /\bnatural (1|20)\b/i.test(prose) ||
    /\b\d{1,2}\s*(vs\.?|versus|against)\s*(the\s*)?(DC|AC)\s*\d+/i.test(prose) ||
    /\btotal(s|ling)?\s*(of\s*)?\d{1,2}\b/i.test(prose);
  checks.noInventedRolls = !invented;
  if (invented) notes.push("a die number in the prose");

  // The scenario's own expectations.
  for (const [i, expect] of (scenario.expect ?? []).entries()) {
    const key = expect.name ?? `expect${i}`;
    if (expect.tag) {
      const re = new RegExp(expect.tag, "i");
      const hit = tags.some((tag) => re.test(tag.raw)) || re.test(text);
      checks[key] = expect.absent ? !hit : hit;
      if (checks[key] === false) notes.push(`${key}: ${expect.absent ? "unexpected" : "missing"} ${expect.tag}`);
    } else if (expect.sheet) {
      // The reply must state the sheet's own numbers, which shows the model read the sheet.
      const facts = sheetFacts(prompt, expect.sheet);
      const wanted = facts ? expect.fields.map((field) => facts[field]).filter(Boolean) : [];
      if (!wanted.length) {
        checks[key] = null;
        notes.push(`${key}: no ${expect.sheet} numbers found in the prompt`);
      } else {
        const missing = wanted.filter((value) => !new RegExp(`\\b${value}\\b`).test(text));
        checks[key] = missing.length === 0;
        if (missing.length) notes.push(`${key}: missing ${missing.join(", ")} (sheet says ${wanted.join(", ")})`);
      }
    } else if (expect.speakers) {
      const names = new Set(speakerLines.map((line) => /^\[([^\]]+)\]/.exec(line)[1].toLowerCase()));
      const count = partyNames.filter((name) => names.has(name.toLowerCase())).length;
      checks[key] = count >= expect.speakers;
      if (!checks[key]) notes.push(`${key}: ${count} party members spoke`);
    } else if (expect.noSpeakerLines) {
      checks[key] = speakerLines.length === 0;
      if (!checks[key]) notes.push(`${key}: scene lines in an out-of-character answer`);
    }
  }
  return { checks, notes };
}
