import type { LlmGateway, LlmMessage } from "../../../capabilities/llm";
import type { StorageEntity, StorageGateway } from "../../../capabilities/storage";
import { parseJsonArray, parseJsonObject } from "../../../core/json";
import { parseGameJsonish } from "../../../shared/parsing-jsonish";
import { readString as stringValue } from "../../../shared/value-readers";
import type { RPGStatsConfig } from "../../../contracts/types/character";
import type { Chat, Message } from "../../../contracts/types/chat";
import type {
  CombatActionResult,
  CombatAttack,
  CombatEnemy,
  CombatEnemyAction,
  CombatInitState,
  CombatItemEffect,
  CombatPartyAction,
  CombatPartyMember,
  CombatPlayerActions,
  CombatStatus,
  CombatStyleNotes,
  EncounterActionRequest,
  EncounterActionResponse,
  EncounterInitRequest,
  EncounterInitResponse,
  EncounterLogEntry,
  EncounterSummaryRequest,
  EncounterSummaryResponse,
  NarrativeStyle,
} from "../../../contracts/types/combat-encounter";
import type { PersonaStatsConfig } from "../../../contracts/types/persona";

type JsonRecord = Record<string, unknown>;

type RoleplayEncounterCapabilities = {
  storage: StorageGateway;
  llm: LlmGateway;
};

type RoleplayEncounterContext = {
  chat: JsonRecord;
  personaName: string;
  personaContext: string;
  characterContext: string;
  gameStateContext: string;
  spellbookContext: string;
  spellbookAttacks: CombatAttack[];
  fallbackState: CombatInitState;
};

const COMBAT_BLUEPRINT_OUTPUT_TOKENS = 12_000;
const ACTION_OUTPUT_TOKENS = 8_192;
const SUMMARY_OUTPUT_TOKENS = 8_192;

const DEFAULT_STYLE_NOTES: CombatStyleNotes = {
  environmentType: "plains",
  atmosphere: "tense",
  timeOfDay: "day",
  weather: "clear",
};

export async function initRoleplayEncounter(
  capabilities: RoleplayEncounterCapabilities,
  input: EncounterInitRequest,
): Promise<EncounterInitResponse> {
  if (!input.chatId?.trim()) throw new Error("chatId is required");
  if (!input.settings) throw new Error("settings are required");

  const context = await buildEncounterContext(capabilities.storage, input);
  const history = await recentHistory(capabilities.storage, input.chatId, input.settings.historyDepth);
  const messages = buildInitPrompt(context, history);

  const parsed = await completeJsonObject(capabilities, context.chat, input.connectionId ?? null, messages, {
    temperature: 0.8,
    maxTokens: COMBAT_BLUEPRINT_OUTPUT_TOKENS,
  });
  const rawCombatState = recordValue(parsed?.combatState) ?? parsed;
  const combatState = sanitizeCombatInitState(rawCombatState, context.fallbackState);

  return { combatState };
}

export async function resolveRoleplayEncounterAction(
  capabilities: RoleplayEncounterCapabilities,
  input: EncounterActionRequest,
): Promise<EncounterActionResponse> {
  if (!input.chatId?.trim()) throw new Error("chatId is required");
  if (!input.action?.trim()) throw new Error("action is required");
  if (!input.combatStats) throw new Error("combatStats are required");
  if (!input.settings) throw new Error("settings are required");

  const context = await buildEncounterContext(capabilities.storage, input);
  const history = await recentHistory(capabilities.storage, input.chatId, input.settings.historyDepth);
  const fallback = fallbackActionResult(input);
  const messages = buildActionPrompt(context, history, input);

  const parsed = await completeJsonObject(capabilities, context.chat, input.connectionId ?? null, messages, {
    temperature: 0.8,
    maxTokens: ACTION_OUTPUT_TOKENS,
  });
  // completeJsonObject returns null only when the model output was unparseable
  // or the LLM call failed. In that case there is no real turn: synthesizing a
  // deterministic fallback would silently advance combat (and can reach
  // victory + summary writeback). Surface a recoverable invalid signal instead
  // and leave combat state untouched. A present-but-partial response is still a
  // real turn and continues through sanitizeCombatActionResult below.
  if (parsed === null) {
    return { result: fallback, invalid: true };
  }
  const rawResult = recordValue(parsed?.result) ?? parsed;
  const result = sanitizeCombatActionResult(rawResult, input, fallback);

  return { result };
}

export async function summarizeRoleplayEncounter(
  capabilities: RoleplayEncounterCapabilities,
  input: EncounterSummaryRequest,
): Promise<EncounterSummaryResponse> {
  if (!input.chatId?.trim()) throw new Error("chatId is required");
  if (!input.settings) throw new Error("settings are required");

  const context = await buildEncounterContext(capabilities.storage, input);
  const messages = buildSummaryPrompt(context, input.encounterLog ?? [], input.result, input.settings.summaryNarrative);
  const fallback = fallbackSummary(input.encounterLog ?? [], input.result);
  let summary = fallback;

  try {
    const connectionId = await resolveConnectionId(capabilities.storage, context.chat, input.connectionId ?? null);
    const generated = await capabilities.llm.complete({
      connectionId,
      messages,
      parameters: { temperature: 0.9, maxTokens: SUMMARY_OUTPUT_TOKENS },
    });
    summary = generated.replace(/\[FIGHT CONCLUDED\]\s*/i, "").trim() || fallback;
  } catch {
    summary = fallback;
  }

  const message = await createChatMessage(capabilities.storage, input.chatId, {
    role: "assistant",
    characterId: null,
    content: summary,
  });
  return { summary, messageId: stringValue(recordValue(message)?.id) };
}

async function buildEncounterContext(
  storage: StorageGateway,
  input: Pick<EncounterInitRequest, "chatId" | "spellbookId">,
): Promise<RoleplayEncounterContext> {
  const chat = await requireChat(storage, input.chatId);
  const [persona, characters, worldState, spellbook] = await Promise.all([
    buildPersonaContext(storage, chat),
    buildCharacterContext(storage, chat),
    buildGameStateContext(storage, input.chatId, chat),
    loadSpellbookContext(storage, input.spellbookId),
  ]);
  const fallbackState = fallbackInitState({
    chat,
    personaName: persona.name,
    personaMaxHp: persona.maxHp,
    characters: characters.fallbackMembers,
    worldState,
    spellbookAttacks: spellbook.attacks,
  });

  return {
    chat,
    personaName: persona.name,
    personaContext: persona.context,
    characterContext: characters.context,
    gameStateContext: worldState.context,
    spellbookContext: spellbook.context,
    spellbookAttacks: spellbook.attacks,
    fallbackState,
  };
}

async function buildPersonaContext(
  storage: StorageGateway,
  chat: JsonRecord,
): Promise<{ name: string; context: string; maxHp: number | null }> {
  const personas = await safeList<JsonRecord>(storage, "personas");
  const chatPersonaId = stringValue(chat.personaId);
  const persona =
    (chatPersonaId ? personas.find((item) => stringValue(item.id) === chatPersonaId) : null) ??
    personas.find((item) => boolish(item.isActive));
  if (!persona) return { name: "Player", context: "No persona information available.", maxHp: null };

  const name = stringValue(persona.name, "Player");
  const lines = [`Name: ${name}`];
  for (const key of ["description", "personality", "backstory", "appearance"]) {
    const value = stringValue(persona[key]);
    if (value.trim()) lines.push(value.trim());
  }

  const stats = parsePersonaStats(persona.personaStats);
  const maxHp = personaMaxHp(stats);
  if (stats?.enabled && Array.isArray(stats.bars) && stats.bars.length > 0) {
    const bars = stats.bars
      .map((bar) => {
        const max = numberValue(bar.max, 0);
        return max > 0 ? `- ${bar.name} max: ${max}` : "";
      })
      .filter(Boolean);
    if (bars.length > 0) lines.push(`Persona Stat Bars:\n${bars.join("\n")}`);
  }
  if (maxHp != null) lines.push(`Persona RPG Stats:\n- Max HP: ${maxHp}`);

  return { name, context: lines.join("\n"), maxHp };
}

async function buildCharacterContext(
  storage: StorageGateway,
  chat: JsonRecord,
): Promise<{ context: string; fallbackMembers: Array<{ name: string; maxHp: number | null }> }> {
  const ids = stringArray(chat.characterIds);
  const rows = await Promise.all(ids.map((id) => storage.get<JsonRecord>("characters", id).catch(() => null)));
  const lines: string[] = [];
  const fallbackMembers: Array<{ name: string; maxHp: number | null }> = [];

  for (const row of rows) {
    if (!row) continue;
    const data = parseJsonObject(row.data);
    const extensions = parseJsonObject(data.extensions);
    const rpg = parseRpgStats(extensions.rpgStats);
    const name = stringValue(data.name, "Ally");
    const block = [`<character="${name}">`];
    for (const key of ["description", "personality", "scenario"]) {
      const value = stringValue(data[key]);
      if (value.trim()) block.push(value.trim());
    }
    const maxHp = numberValue(rpg?.hp?.max, 0);
    if (rpg?.enabled && maxHp > 0) block.push(`Max HP: ${maxHp}`);
    if (rpg?.enabled && Array.isArray(rpg.attributes) && rpg.attributes.length > 0) {
      block.push(`Attributes: ${rpg.attributes.map((a) => `${a.name} ${a.value}`).join(", ")}`);
    }
    block.push("</character>");
    lines.push(block.join("\n"));
    fallbackMembers.push({ name, maxHp: maxHp > 0 ? maxHp : null });
  }

  return { context: lines.join("\n\n"), fallbackMembers };
}

async function buildGameStateContext(
  storage: StorageGateway,
  chatId: string,
  chat: JsonRecord,
): Promise<{ context: string; location: string | null; playerItems: string[]; gameCards: JsonRecord[] }> {
  const worldState = await storage.getWorldState<unknown>(chatId).catch(() => ({}));
  const state = parseJsonObject(worldState);
  const meta = parseJsonObject(chat.metadata);
  const gameCards = parseJsonArray<JsonRecord>(meta.gameCharacterCards);
  const lines: string[] = [];

  for (const key of ["location", "weather", "time", "date"]) {
    const value = stringValue(state[key]);
    if (value.trim()) lines.push(`${titleCase(key)}: ${value.trim()}`);
  }

  const playerStats = parseJsonObject(state.playerStats);
  const inventory = parseJsonArray<JsonRecord>(playerStats.inventory);
  const playerItems = inventory
    .map((item) => {
      const name = stringValue(item.name);
      if (!name) return "";
      const quantity = numberValue(item.quantity, 1);
      return quantity > 1 ? `${name} x${quantity}` : name;
    })
    .filter(Boolean);
  if (playerItems.length > 0) lines.push(`Inventory:\n${playerItems.map((item) => `- ${item}`).join("\n")}`);

  const attributes = parseJsonObject(playerStats.attributes);
  const attributeLine = renderRpgAttributes(attributes);
  if (attributeLine) lines.push(`Attributes: ${attributeLine}`);

  if (!attributeLine && gameCards[0]) {
    const rpgStats = parseRpgStats(gameCards[0].rpgStats);
    const mapped = mapAttributeRowsToRpg(rpgStats?.attributes);
    const mappedLine = renderRpgAttributes(mapped);
    if (mappedLine) lines.push(`Player Character Sheet Attributes: ${mappedLine}`);
  }

  const presentCharacters = parseJsonArray<JsonRecord>(state.presentCharacters);
  if (presentCharacters.length > 0) {
    lines.push(
      `Present Characters:\n${presentCharacters
        .map((character) => {
          const name = stringValue(character.name, "Unknown");
          const mood = stringValue(character.mood);
          const action = stringValue(character.action);
          return `- ${name}${mood ? ` (${mood})` : ""}${action ? `: ${action}` : ""}`;
        })
        .join("\n")}`,
    );
  }

  const gameMap = parseJsonObject(meta.gameMap);
  const mapName = stringValue(gameMap.name);
  const location = stringValue(state.location) || mapName || null;
  return { context: lines.join("\n"), location, playerItems, gameCards };
}

async function loadSpellbookContext(
  storage: StorageGateway,
  spellbookId?: string | null,
): Promise<{ context: string; attacks: CombatAttack[] }> {
  if (!spellbookId?.trim()) return { context: "", attacks: [] };
  const entries = await storage
    .listLorebookEntries<unknown>(spellbookId)
    .then((rows) => (Array.isArray(rows) ? rows.filter(isRecord) : []))
    .catch(() => safeList<JsonRecord>(storage, "lorebook-entries", { lorebookId: spellbookId }));

  const enabledEntries = entries.filter((entry) => boolish(entry.enabled, true));
  const context = enabledEntries
    .map((entry) => {
      const name = stringValue(entry.name, "Spell");
      const content = stringValue(entry.content);
      return content.trim() ? `<spell name="${name}">\n${content.trim()}\n</spell>` : "";
    })
    .filter(Boolean)
    .join("\n");
  const attacks = enabledEntries
    .map((entry): CombatAttack | null => {
      const name = stringValue(entry.name).trim();
      if (!name) return null;
      return {
        name,
        type: "single-target",
        description: compact(stringValue(entry.content), 120) || "A spell or ability from the selected spellbook.",
        power: 1.1,
        cooldown: 0,
      };
    })
    .filter((attack): attack is CombatAttack => !!attack)
    .slice(0, 6);
  return { context, attacks };
}

function buildInitPrompt(context: RoleplayEncounterContext, chatHistory: LlmMessage[]): LlmMessage[] {
  const system = [
    `You are an excellent game master crafting a combat encounter in an immersive roleplay. The user plays ${context.personaName}.`,
    context.characterContext ? `Characters:\n<characters>\n${context.characterContext}\n</characters>` : "",
    `Persona:\n<persona>\n${context.personaContext}\n</persona>`,
    context.gameStateContext ? `Current tracked context:\n<context>\n${context.gameStateContext}\n</context>` : "",
    context.spellbookContext
      ? [
          `Available spells and abilities:\n<spellbook>\n${context.spellbookContext}\n</spellbook>`,
          "When generating party attacks, prioritize spells and abilities from the spellbook.",
        ].join("\n\n")
      : "",
    "Return only one JSON object for the initial combat state.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const instruction = [
    "The combat starts now.",
    "Create the party, enemies, environment, styleNotes, optional itemEffects, optional mechanics, optional dialogueCues, and optional visuals.",
    "The JSON shape must be:",
    `{"party":[{"name":"${context.personaName}","hp":24,"maxHp":24,"attacks":[{"name":"Attack","type":"single-target","description":"what it does","power":1,"cooldown":0}],"items":["Healing Potion x1"],"statuses":[],"isPlayer":true}],"enemies":[{"name":"Enemy","hp":18,"maxHp":18,"attacks":[{"name":"Strike","type":"single-target"}],"statuses":[],"description":"Brief enemy description","sprite":"enemy"}],"environment":"Brief description","styleNotes":{"environmentType":"plains","atmosphere":"tense","timeOfDay":"day","weather":"clear"},"itemEffects":[],"mechanics":[],"dialogueCues":[],"visuals":{"isBossFight":false,"enemyImagePrompts":[]}}`,
    "Use configured max HP exactly when the context supplies it. Set hp equal to maxHp at combat start.",
    "Write text in the same language as the recent chat history.",
  ].join("\n\n");

  return [{ role: "system", content: system }, ...chatHistory, { role: "user", content: instruction }];
}

function buildActionPrompt(
  context: RoleplayEncounterContext,
  chatHistory: LlmMessage[],
  input: EncounterActionRequest,
): LlmMessage[] {
  const system = [
    `You are the game master managing this combat encounter. Do not play as ${context.personaName}.`,
    context.characterContext ? `<characters>\n${context.characterContext}\n</characters>` : "",
    `<persona>\n${context.personaContext}\n</persona>`,
    context.spellbookContext ? `<spellbook>\n${context.spellbookContext}\n</spellbook>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const currentState = renderCombatState(input.combatStats, input.playerActions);
  const previousLog = renderEncounterLog(input.encounterLog ?? []);
  const instruction = [
    previousLog ? `Previous Combat Actions:\n${previousLog}` : "",
    `Current Combat State:\n${currentState}`,
    `${context.personaName}'s Action: ${input.action}`,
    "Respond only with JSON.",
    `{"combatStats":{"party":[],"enemies":[]},"playerActions":{"attacks":[],"items":[]},"enemyActions":[{"enemyName":"Name","action":"what they do","target":"target"}],"partyActions":[{"memberName":"Name","action":"what they do","target":"target"}],"narrative":"The roleplay description of what happens"}`,
    `If all enemies are defeated, include "combatEnd": true and "result": "victory". If all party members are defeated, include "combatEnd": true and "result": "defeat".`,
    `Write narrative in ${styleInstruction(input.settings.combatNarrative)}. Keep it under 150 words. Do not use asterisks.`,
    "Write in the same language as the chat history.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [{ role: "system", content: system }, ...chatHistory, { role: "user", content: instruction }];
}

function buildSummaryPrompt(
  context: RoleplayEncounterContext,
  encounterLog: EncounterLogEntry[],
  result: string,
  narrative: NarrativeStyle,
): LlmMessage[] {
  const system = [
    "You are summarizing a combat encounter that just concluded.",
    context.characterContext ? `<characters>\n${context.characterContext}\n</characters>` : "",
    `<persona>\n${context.personaContext}\n</persona>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const user = [
    `Combat has ended with result: ${result}`,
    "Full Combat Log:",
    encounterLog
      .map((entry, index) => [`Round ${index + 1}:`, entry.action, entry.result].filter(Boolean).join("\n"))
      .join("\n\n") || "No detailed combat rounds were recorded.",
    "Provide a narrative summary of the entire fight.",
    `Write in ${styleInstruction(narrative)}. Include NPC or enemy dialogue only if it appears in the combat log.`,
    `Express ${context.personaName}'s actions using indirect speech. Return only the summary text.`,
  ].join("\n\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

async function completeJsonObject(
  capabilities: RoleplayEncounterCapabilities,
  chat: JsonRecord,
  overrideConnectionId: string | null,
  messages: LlmMessage[],
  parameters: Record<string, unknown>,
): Promise<JsonRecord | null> {
  try {
    const connectionId = await resolveConnectionId(capabilities.storage, chat, overrideConnectionId);
    const raw = await capabilities.llm.complete({ connectionId, messages, parameters });
    const parsed = parseGameJsonish(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function resolveConnectionId(
  storage: StorageGateway,
  chat: JsonRecord,
  overrideConnectionId?: string | null,
): Promise<string> {
  const requested = overrideConnectionId?.trim();
  if (requested) {
    await requireStorageRecord(storage, "connections", requested, "Connection");
    return requested;
  }

  const chatConnectionId = stringValue(chat.connectionId).trim();
  if (chatConnectionId === "random") {
    const connections = await safeList<JsonRecord>(storage, "connections");
    const pool = connections.filter((connection) => boolish(connection.useForRandom));
    const selected = pool[Math.floor(Math.random() * pool.length)];
    const id = stringValue(selected?.id);
    if (!id) throw new Error("No connections marked for the random pool");
    return id;
  }
  if (chatConnectionId) {
    await requireStorageRecord(storage, "connections", chatConnectionId, "Chat connection");
    return chatConnectionId;
  }

  const connections = await safeList<JsonRecord>(storage, "connections");
  const selected =
    connections.find((connection) => boolish(connection.isDefault) || boolish(connection.default)) ?? connections[0];
  const id = stringValue(selected?.id);
  if (!id) throw new Error("No LLM connection is configured");
  return id;
}

function fallbackInitState(input: {
  chat: JsonRecord;
  personaName: string;
  personaMaxHp: number | null;
  characters: Array<{ name: string; maxHp: number | null }>;
  worldState: { location: string | null; playerItems: string[]; gameCards: JsonRecord[] };
  spellbookAttacks: CombatAttack[];
}): CombatInitState {
  const gamePlayer = input.worldState.gameCards[0];
  const playerName = stringValue(gamePlayer?.name) || input.personaName || "Player";
  const gameRpgStats = parseRpgStats(gamePlayer?.rpgStats);
  const playerMaxHp = input.personaMaxHp ?? positiveNumber(gameRpgStats?.hp?.max) ?? 24;
  const playerItems = input.worldState.playerItems.length > 0 ? input.worldState.playerItems : ["Healing Potion x1"];
  const defaultAttack: CombatAttack = {
    name: "Attack",
    type: "single-target",
    description: "A basic attack.",
    power: 1,
    cooldown: 0,
  };
  const attacks: CombatAttack[] = input.spellbookAttacks.length > 0 ? input.spellbookAttacks : [defaultAttack];
  const party: CombatPartyMember[] = [
    {
      name: playerName,
      hp: playerMaxHp,
      maxHp: playerMaxHp,
      attacks,
      items: playerItems,
      statuses: [],
      isPlayer: true,
    },
  ];

  const gameAllies = input.worldState.gameCards.slice(1).map((card) => ({
    name: stringValue(card.name, "Ally"),
    maxHp: positiveNumber(parseRpgStats(card.rpgStats)?.hp?.max),
  }));
  for (const ally of [...gameAllies, ...input.characters].slice(0, 3)) {
    const maxHp = ally.maxHp ?? 24;
    party.push({
      name: ally.name || "Ally",
      hp: maxHp,
      maxHp,
      attacks: [{ name: "Attack", type: "single-target", description: "A basic attack.", power: 1, cooldown: 0 }],
      items: [],
      statuses: [],
      isPlayer: false,
    });
  }

  return {
    party,
    enemies: [fallbackEnemy(0)],
    environment: input.worldState.location || "the current area",
    styleNotes: DEFAULT_STYLE_NOTES,
    itemEffects: [
      {
        name: "Healing Potion",
        target: "ally",
        type: "heal",
        description: "Restores a moderate amount of health.",
        power: 0.3,
        consumes: true,
      },
    ],
    dialogueCues: [],
    mechanics: [],
    visuals: { isBossFight: false, enemyImagePrompts: [] },
  };
}

function fallbackActionResult(input: EncounterActionRequest): CombatActionResult {
  const party = sanitizePartyArray(input.combatStats.party, []);
  const enemies = sanitizeEnemyArray(input.combatStats.enemies, []);
  if (party.length === 0 || enemies.length === 0) {
    return {
      combatStats: { party, enemies },
      playerActions: input.playerActions ?? { attacks: [], items: [] },
      enemyActions: [],
      partyActions: [],
      narrative: "The action cannot resolve because combat data is missing.",
      combatEnd: true,
      result: "interrupted",
    };
  }

  const action = input.action.trim() || "Attack";
  const lower = action.toLowerCase();
  const playerIndex = Math.max(
    0,
    party.findIndex((member) => member.isPlayer),
  );
  const player = party[playerIndex]!;
  const playerName = player.name || "Player";
  if (/\b(flee|run away|retreat|escape)\b/i.test(action)) {
    return {
      combatStats: { party, enemies },
      playerActions: input.playerActions ?? playerActionsFromParty(party),
      enemyActions: [],
      partyActions: [],
      narrative: `${playerName} breaks away from the fight and escapes the encounter.`,
      combatEnd: true,
      result: "fled",
    };
  }

  const targetIndex = targetEnemyIndex(enemies, lower);
  const target = enemies[targetIndex]!;
  const targetName = target.name || "Enemy";
  const defensive = /\b(defend|guard|block|dodge|brace)\b/i.test(action);
  const healing = /\b(heal|potion|restore|first aid)\b/i.test(action);
  let narrative: string;

  if (healing) {
    const woundedIndex = party.findIndex((member) => member.hp > 0 && member.hp < member.maxHp);
    const healTargetIndex = woundedIndex >= 0 ? woundedIndex : playerIndex;
    const healTarget = party[healTargetIndex]!;
    const healingAmount = deterministicRange(`${action}:${input.encounterLog.length}:heal`, 6, 12);
    healTarget.hp = clamp(healTarget.hp + healingAmount, 0, healTarget.maxHp);
    narrative = `${playerName} uses ${action}, restoring ${healingAmount} HP to ${healTarget.name}.`;
  } else {
    const damage = defensive ? 0 : deterministicRange(`${action}:${input.encounterLog.length}:damage`, 5, 12);
    target.hp = clamp(target.hp - damage, 0, target.maxHp);
    narrative = defensive
      ? `${playerName} takes a defensive stance and prepares for the enemy's next move.`
      : `${playerName} uses ${action}, dealing ${damage} damage to ${targetName}.`;
  }

  const victory = enemies.every((enemy) => enemy.hp <= 0);
  const enemyActions: CombatEnemyAction[] = [];
  if (!victory) {
    const attacker = enemies.find((enemy) => enemy.hp > 0) ?? target;
    let partyDamage = deterministicRange(`${action}:${input.encounterLog.length}:counter`, 3, 8);
    if (defensive) partyDamage = Math.max(1, Math.floor(partyDamage * 0.45));
    player.hp = clamp(player.hp - partyDamage, 0, player.maxHp);
    enemyActions.push({ enemyName: attacker.name || "Enemy", action: "counterattacks", target: playerName });
    narrative += ` ${attacker.name || "The enemy"} counterattacks for ${partyDamage} damage.`;
  }

  const defeat = party.every((member) => member.hp <= 0);
  if (victory) narrative = `${playerName}'s action ends the fight.`;
  if (defeat) narrative = `${playerName} falls as the encounter turns against the party.`;

  return {
    combatStats: { party, enemies },
    playerActions: input.playerActions ?? playerActionsFromParty(party),
    enemyActions,
    partyActions: [],
    narrative,
    combatEnd: victory || defeat,
    result: victory ? "victory" : defeat ? "defeat" : undefined,
  };
}

function fallbackSummary(encounterLog: EncounterLogEntry[], result: string): string {
  const lines = [`Combat concluded: ${result}.`];
  for (const entry of encounterLog.slice(0, 8)) {
    if (entry.action) lines.push(`- ${entry.action}`);
    if (entry.result) lines.push(`  ${entry.result}`);
  }
  return lines.join("\n");
}

function sanitizeCombatInitState(value: JsonRecord | null, fallback: CombatInitState): CombatInitState {
  const source = value ?? {};
  const itemEffects = arrayValue(source.itemEffects) as CombatItemEffect[] | null;
  const dialogueCues = arrayValue(source.dialogueCues) as CombatInitState["dialogueCues"] | null;
  const mechanics = arrayValue(source.mechanics) as CombatInitState["mechanics"] | null;
  const visuals = recordValue(source.visuals) as CombatInitState["visuals"] | null;
  return {
    party: sanitizePartyArray(arrayValue(source.party), fallback.party),
    enemies: sanitizeEnemyArray(arrayValue(source.enemies), fallback.enemies),
    environment: stringValue(source.environment) || fallback.environment,
    styleNotes: sanitizeStyleNotes(recordValue(source.styleNotes), fallback.styleNotes),
    itemEffects: itemEffects ?? fallback.itemEffects ?? [],
    dialogueCues: dialogueCues ?? fallback.dialogueCues ?? [],
    mechanics: mechanics ?? fallback.mechanics ?? [],
    visuals: visuals ?? fallback.visuals,
  };
}

function sanitizeCombatActionResult(
  value: JsonRecord | null,
  input: EncounterActionRequest,
  fallback: CombatActionResult,
): CombatActionResult {
  const source = value ?? {};
  const combatStats = recordValue(source.combatStats);
  const currentParty = sanitizePartyArray(input.combatStats.party, []);
  const currentEnemies = sanitizeEnemyArray(input.combatStats.enemies, []);
  const party = sanitizePartyArray(arrayValue(combatStats?.party), currentParty);
  const enemies = sanitizeEnemyArray(arrayValue(combatStats?.enemies), currentEnemies);
  const playerActions = sanitizePlayerActions(
    recordValue(source.playerActions),
    input.playerActions ?? playerActionsFromParty(party),
  );
  const result = stringValue(source.result);

  return {
    combatStats: {
      party: party.length ? party : fallback.combatStats.party,
      enemies: enemies.length ? enemies : fallback.combatStats.enemies,
    },
    playerActions,
    enemyActions: sanitizeEnemyActions(arrayValue(source.enemyActions)),
    partyActions: sanitizePartyActions(arrayValue(source.partyActions)),
    narrative: stringValue(source.narrative) || fallback.narrative,
    combatEnd: typeof source.combatEnd === "boolean" ? source.combatEnd : fallback.combatEnd,
    result: isCombatResult(result) ? result : fallback.result,
  };
}

function sanitizePartyArray(values: unknown[] | null, fallback: CombatPartyMember[]): CombatPartyMember[] {
  const source = values?.length ? values : fallback;
  return source
    .map((value, index) => sanitizePartyMember(recordValue(value), fallback[index] ?? fallback[0]))
    .filter((member): member is CombatPartyMember => !!member);
}

function sanitizePartyMember(value: JsonRecord | null, fallback?: CombatPartyMember): CombatPartyMember | null {
  if (!value && !fallback) return null;
  const maxHp = positiveNumber(value?.maxHp) ?? fallback?.maxHp ?? 1;
  return {
    name: stringValue(value?.name) || fallback?.name || "Unknown",
    hp: clamp(numberValue(value?.hp, fallback?.hp ?? maxHp), 0, maxHp),
    maxHp,
    attacks: sanitizeAttacks(arrayValue(value?.attacks), fallback?.attacks ?? []),
    items: stringArray(value?.items).length ? stringArray(value?.items) : (fallback?.items ?? []),
    statuses: sanitizeStatuses(arrayValue(value?.statuses), fallback?.statuses ?? []),
    isPlayer: typeof value?.isPlayer === "boolean" ? value.isPlayer : (fallback?.isPlayer ?? false),
  };
}

function sanitizeEnemyArray(values: unknown[] | null, fallback: CombatEnemy[]): CombatEnemy[] {
  const source = values?.length ? values : fallback;
  return source
    .map((value, index) => sanitizeEnemy(recordValue(value), fallback[index] ?? fallback[0]))
    .filter((enemy): enemy is CombatEnemy => !!enemy);
}

function sanitizeEnemy(value: JsonRecord | null, fallback?: CombatEnemy): CombatEnemy | null {
  if (!value && !fallback) return null;
  const maxHp = positiveNumber(value?.maxHp) ?? fallback?.maxHp ?? 1;
  return {
    name: stringValue(value?.name) || fallback?.name || "Enemy",
    hp: clamp(numberValue(value?.hp, fallback?.hp ?? maxHp), 0, maxHp),
    maxHp,
    attacks: sanitizeAttacks(arrayValue(value?.attacks), fallback?.attacks ?? []),
    statuses: sanitizeStatuses(arrayValue(value?.statuses), fallback?.statuses ?? []),
    description: stringValue(value?.description) || fallback?.description || "",
    sprite: stringValue(value?.sprite) || fallback?.sprite || "enemy",
  };
}

function sanitizeAttacks(values: unknown[] | null, fallback: CombatAttack[]): CombatAttack[] {
  const attacks = (values ?? [])
    .map((value): CombatAttack | null => {
      const record = recordValue(value);
      const name = stringValue(record?.name);
      if (!name) return null;
      const type = stringValue(record?.type);
      const attack: CombatAttack = {
        name,
        type: type === "AoE" || type === "both" || type === "single-target" ? type : "single-target",
      };
      const description = stringValue(record?.description);
      const power = optionalNumber(record?.power);
      const cooldown = optionalNumber(record?.cooldown);
      const element = stringValue(record?.element);
      const statusEffect = stringValue(record?.statusEffect);
      if (description) attack.description = description;
      if (power !== undefined) attack.power = power;
      if (cooldown !== undefined) attack.cooldown = cooldown;
      if (element) attack.element = element;
      if (statusEffect) attack.statusEffect = statusEffect;
      return attack;
    })
    .filter((attack): attack is NonNullable<typeof attack> => attack !== null);
  return attacks.length > 0 ? attacks : fallback;
}

function sanitizeStatuses(values: unknown[] | null, fallback: CombatStatus[]): CombatStatus[] {
  const statuses = (values ?? [])
    .map((value): CombatStatus | null => {
      const record = recordValue(value);
      const name = stringValue(record?.name);
      if (!name) return null;
      const stat = stringValue(record?.stat);
      const status: CombatStatus = {
        name,
        emoji: stringValue(record?.emoji) || "",
        duration: numberValue(record?.duration, 1),
      };
      const modifier = optionalNumber(record?.modifier);
      if (modifier !== undefined) status.modifier = modifier;
      if (stat === "attack" || stat === "defense" || stat === "speed" || stat === "hp") status.stat = stat;
      return status;
    })
    .filter((status): status is NonNullable<typeof status> => status !== null);
  return statuses.length > 0 ? statuses : fallback;
}

function sanitizeStyleNotes(value: JsonRecord | null, fallback: CombatStyleNotes): CombatStyleNotes {
  return {
    environmentType: stringValue(value?.environmentType) || fallback.environmentType,
    atmosphere: stringValue(value?.atmosphere) || fallback.atmosphere,
    timeOfDay: stringValue(value?.timeOfDay) || fallback.timeOfDay,
    weather: stringValue(value?.weather) || fallback.weather,
  };
}

function sanitizePlayerActions(value: JsonRecord | null, fallback: CombatPlayerActions): CombatPlayerActions {
  return {
    attacks: sanitizeAttacks(arrayValue(value?.attacks), fallback.attacks),
    items: stringArray(value?.items).length ? stringArray(value?.items) : fallback.items,
  };
}

function sanitizeEnemyActions(values: unknown[] | null): CombatEnemyAction[] {
  return (values ?? [])
    .map((value) => {
      const record = recordValue(value);
      const enemyName = stringValue(record?.enemyName);
      const action = stringValue(record?.action);
      if (!enemyName || !action) return null;
      return { enemyName, action, target: stringValue(record?.target) };
    })
    .filter((action): action is CombatEnemyAction => !!action);
}

function sanitizePartyActions(values: unknown[] | null): CombatPartyAction[] {
  return (values ?? [])
    .map((value) => {
      const record = recordValue(value);
      const memberName = stringValue(record?.memberName);
      const action = stringValue(record?.action);
      if (!memberName || !action) return null;
      return { memberName, action, target: stringValue(record?.target) };
    })
    .filter((action): action is CombatPartyAction => !!action);
}

function renderCombatState(
  combatStats: EncounterActionRequest["combatStats"],
  playerActions: CombatPlayerActions | null,
): string {
  const lines = [`Environment: ${combatStats.environment || "Unknown location"}`, "", "Party Members:"];
  for (const member of combatStats.party) {
    lines.push(`- ${member.name}${member.isPlayer ? " (Player)" : ""}: ${member.hp}/${member.maxHp} HP`);
    const attacks = member.isPlayer && playerActions?.attacks ? playerActions.attacks : member.attacks;
    const items = member.isPlayer && playerActions?.items ? playerActions.items : member.items;
    if (attacks?.length) lines.push(`  Attacks: ${attacks.map((attack) => attack.name).join(", ")}`);
    if (items?.length) lines.push(`  Items: ${items.join(", ")}`);
    if (member.statuses?.length) {
      lines.push(`  Status Effects: ${member.statuses.map((status) => `${status.emoji} ${status.name}`).join(", ")}`);
    }
  }
  lines.push("", "Enemies:");
  for (const enemy of combatStats.enemies) {
    lines.push(`- ${enemy.name} (${enemy.sprite || ""}): ${enemy.hp}/${enemy.maxHp} HP`);
    if (enemy.description) lines.push(`  ${enemy.description}`);
    if (enemy.attacks?.length) lines.push(`  Attacks: ${enemy.attacks.map((attack) => attack.name).join(", ")}`);
    if (enemy.statuses?.length) {
      lines.push(`  Status Effects: ${enemy.statuses.map((status) => `${status.emoji} ${status.name}`).join(", ")}`);
    }
  }
  return lines.join("\n");
}

function renderEncounterLog(entries: EncounterLogEntry[]): string {
  return entries
    .map((entry) => [`- ${entry.action}`, entry.result ? `  ${entry.result}` : ""].filter(Boolean).join("\n"))
    .join("\n");
}

async function recentHistory(storage: StorageGateway, chatId: string, depth: number): Promise<LlmMessage[]> {
  const messages = await messagesForChat(storage, chatId);
  const limit = Math.max(1, depth || 8);
  return messages
    .filter((message) => !hiddenFromAi(message) && stringValue(message.content).trim())
    .slice(-limit)
    .map((message) => ({
      role: message.role === "assistant" || message.role === "system" ? message.role : "user",
      content: stringValue(message.content),
    }));
}

async function messagesForChat(storage: StorageGateway, chatId: string): Promise<Array<JsonRecord & Partial<Message>>> {
  const rows = await storage.listChatMessages<unknown>(chatId);
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
}

async function createChatMessage(storage: StorageGateway, chatId: string, message: JsonRecord): Promise<unknown> {
  return storage.createChatMessage(chatId, message);
}

async function requireChat(storage: StorageGateway, chatId: string): Promise<JsonRecord & Partial<Chat>> {
  return requireStorageRecord(storage, "chats", chatId, "Chat") as Promise<JsonRecord & Partial<Chat>>;
}

async function requireStorageRecord(
  storage: StorageGateway,
  entity: StorageEntity,
  id: string,
  label: string,
): Promise<JsonRecord> {
  const row = await storage.get<JsonRecord>(entity, id);
  if (!row) throw new Error(`${label} was not found`);
  return row;
}

async function safeList<T extends JsonRecord>(
  storage: StorageGateway,
  entity: StorageEntity,
  filters?: Record<string, unknown>,
): Promise<T[]> {
  try {
    return await storage.list<T>(entity, filters ? { filters } : undefined);
  } catch {
    return [];
  }
}

function playerActionsFromParty(party: CombatPartyMember[]): CombatPlayerActions {
  const player = party.find((member) => member.isPlayer) ?? party[0];
  return { attacks: player?.attacks ?? [], items: player?.items ?? [] };
}

function targetEnemyIndex(enemies: CombatEnemy[], lowerAction: string): number {
  const named = enemies.findIndex((enemy) => enemy.hp > 0 && lowerAction.includes(enemy.name.toLowerCase()));
  if (named >= 0) return named;
  const alive = enemies.findIndex((enemy) => enemy.hp > 0);
  return alive >= 0 ? alive : 0;
}

function fallbackEnemy(index: number): CombatEnemy {
  return {
    name: `Enemy ${index + 1}`,
    hp: 18,
    maxHp: 18,
    attacks: [{ name: "Strike", type: "single-target", description: "A direct attack.", power: 1, cooldown: 0 }],
    statuses: [],
    description: "A hostile combatant.",
    sprite: "enemy",
  };
}

function parsePersonaStats(value: unknown): PersonaStatsConfig | null {
  const parsed = parseJsonObject(value);
  return Object.keys(parsed).length ? (parsed as unknown as PersonaStatsConfig) : null;
}

function parseRpgStats(value: unknown): RPGStatsConfig | null {
  const parsed = parseJsonObject(value);
  return Object.keys(parsed).length ? (parsed as unknown as RPGStatsConfig) : null;
}

function personaMaxHp(stats: PersonaStatsConfig | null): number | null {
  if (!stats?.enabled) return null;
  const hpBar = stats.bars?.find((bar) => /^(hp|health|hit points?)$/i.test(bar.name.trim()));
  return positiveNumber(hpBar?.max);
}

function mapAttributeRowsToRpg(attrs: ReadonlyArray<{ name: string; value: number }> | null | undefined): JsonRecord {
  if (!Array.isArray(attrs)) return {};
  const map: Record<string, string> = {
    str: "str",
    strength: "str",
    dex: "dex",
    dexterity: "dex",
    con: "con",
    constitution: "con",
    int: "int",
    intelligence: "int",
    wis: "wis",
    wisdom: "wis",
    cha: "cha",
    charisma: "cha",
  };
  const out: JsonRecord = {};
  for (const attr of attrs) {
    const key = map[attr.name.trim().toLowerCase()];
    if (!key) continue;
    out[key] = attr.value;
  }
  return out;
}

function renderRpgAttributes(attributes: JsonRecord): string {
  const labels: Record<string, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
  return Object.entries(labels)
    .map(([key, label]) => {
      const value = numberValue(attributes[key], NaN);
      return Number.isFinite(value) ? `${label} ${value}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

function hiddenFromAi(message: JsonRecord): boolean {
  const extra = parseJsonObject(message.extra);
  return boolish(extra.hiddenFromAI ?? extra.hiddenFromAi);
}

function styleInstruction(style: NarrativeStyle): string {
  return `${style.tense} tense ${style.person}-person ${style.narration} from ${style.pov}'s point of view`;
}

function recordValue(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  return parseJsonArray<unknown>(value).filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = numberValue(value, NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveNumber(value: unknown): number | null {
  const parsed = numberValue(value, NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function boolish(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCombatResult(value: string): value is "victory" | "defeat" | "fled" | "interrupted" {
  return value === "victory" || value === "defeat" || value === "fled" || value === "interrupted";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deterministicRange(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return min + (Math.abs(hash) % (max - min + 1));
}

function compact(value: string, maxLength: number): string {
  const normalized = value.split(/\s+/).join(" ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
