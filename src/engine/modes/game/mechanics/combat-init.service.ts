import type { LlmGateway, LlmMessage } from "../../../capabilities/llm";
import type { StorageEntity, StorageGateway } from "../../../capabilities/storage";
import { parseJsonArray, parseJsonObject } from "../../../core/json";
import { parseGameJsonish } from "../../../shared/parsing-jsonish";
import { readString as stringValue } from "../../../shared/value-readers";
import type { RPGStatsConfig } from "../../../contracts/types/character";
import type { Chat, Message } from "../../../contracts/types/chat";
import type {
  CombatAttack,
  CombatDialogueCue,
  CombatEnemy,
  CombatInitState,
  CombatItemEffect,
  CombatMechanic,
  CombatPartyMember,
  CombatStatus,
  CombatStyleNotes,
  CombatVisualRequest,
  EncounterSettings,
  EncounterInitRequest,
  EncounterInitResponse,
} from "../../../contracts/types/combat-encounter";
import type { PersonaStatsConfig } from "../../../contracts/types/persona";

type JsonRecord = Record<string, unknown>;

type GameCombatInitCapabilities = {
  storage: StorageGateway;
  llm: LlmGateway;
};

type EncounterSettingsWithLegacyCount = EncounterSettings & {
  enemies?: unknown;
  enemyCount?: unknown;
};

type GameCombatInitContext = {
  chat: JsonRecord;
  playerName: string;
  playerContext: string;
  partyContext: string;
  worldContext: string;
  spellbookContext: string;
  spellbookAttacks: CombatAttack[];
  fallbackState: CombatInitState;
};

const COMBAT_BLUEPRINT_OUTPUT_TOKENS = 12_000;

const DEFAULT_STYLE_NOTES: CombatStyleNotes = {
  environmentType: "plains",
  atmosphere: "tense",
  timeOfDay: "day",
  weather: "clear",
};

export async function initGameCombatEncounter(
  capabilities: GameCombatInitCapabilities,
  input: EncounterInitRequest,
): Promise<EncounterInitResponse> {
  if (!input.chatId?.trim()) throw new Error("chatId is required");
  if (!input.settings) throw new Error("settings are required");

  const context = await buildGameCombatInitContext(capabilities.storage, input);
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

async function buildGameCombatInitContext(
  storage: StorageGateway,
  input: Pick<EncounterInitRequest, "chatId" | "spellbookId" | "settings">,
): Promise<GameCombatInitContext> {
  const chat = await requireChat(storage, input.chatId);
  const meta = parseJsonObject(chat.metadata);
  const gameCards = parseJsonArray<JsonRecord>(meta.gameCharacterCards);
  const [persona, worldState, spellbook] = await Promise.all([
    buildPersonaContext(storage, chat),
    buildGameStateContext(storage, input.chatId, meta, gameCards),
    loadSpellbookContext(storage, input.spellbookId),
  ]);
  const playerCard = gameCards[0] ?? null;
  const playerName = stringValue(playerCard?.name) || persona.name || "Player";
  const playerContext = buildPlayerContext(playerName, playerCard, persona.context);
  const partyContext = buildPartyContext(gameCards.slice(1));
  const fallbackState = fallbackInitState({
    playerName,
    personaMaxHp: persona.maxHp,
    gameCards,
    worldState,
    spellbookAttacks: spellbook.attacks,
    settings: input.settings,
  });

  return {
    chat,
    playerName,
    playerContext,
    partyContext,
    worldContext: worldState.context,
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

async function buildGameStateContext(
  storage: StorageGateway,
  chatId: string,
  meta: JsonRecord,
  gameCards: JsonRecord[],
): Promise<{ context: string; location: string | null; playerItems: string[] }> {
  const worldState = await storage.getWorldState<unknown>(chatId).catch(() => ({}));
  const state = parseJsonObject(worldState);
  const lines: string[] = [];
  const gameMap = parseJsonObject(meta.gameMap);
  const mapName = stringValue(gameMap.name);
  const trackedLocation = stringValue(state.location);

  for (const key of ["location", "weather", "time", "date"]) {
    const value = key === "location" ? trackedLocation || mapName : stringValue(state[key]);
    if (value.trim()) lines.push(`${titleCase(key)}: ${value.trim()}`);
  }

  const playerStats = parseJsonObject(state.playerStats);
  const inventory = parseJsonArray<JsonRecord>(playerStats.inventory);
  const inventoryItems = inventory
    .map((item) => {
      const name = stringValue(item.name);
      if (!name) return "";
      const quantity = numberValue(item.quantity, 1);
      return quantity > 1 ? `${name} x${quantity}` : name;
    })
    .filter(Boolean);
  const metaItems = parseJsonArray<unknown>(meta.gameInventory)
    .map((item) => stringValue(item))
    .filter(Boolean);
  const playerItems = inventoryItems.length > 0 ? inventoryItems : metaItems;
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

  const location = trackedLocation || mapName || null;
  return { context: lines.join("\n"), location, playerItems };
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
      return content.trim() ? `<spell name="${escapePromptAttr(name)}">\n${content.trim()}\n</spell>` : "";
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

function buildPlayerContext(playerName: string, playerCard: JsonRecord | null, personaContext: string): string {
  const lines = [`Name: ${playerName}`];
  appendGameCardContext(lines, playerCard);
  for (const key of ["description", "personality", "scenario", "backstory", "appearance"]) {
    const value = stringValue(playerCard?.[key]);
    if (value.trim()) lines.push(value.trim());
  }
  const rpg = parseRpgStats(playerCard?.rpgStats);
  const maxHp = positiveNumber(rpg?.hp?.max);
  if (maxHp) lines.push(`Max HP: ${maxHp}`);
  if (rpg?.enabled && Array.isArray(rpg.attributes) && rpg.attributes.length > 0) {
    lines.push(`Attributes: ${rpg.attributes.map((a) => `${a.name} ${a.value}`).join(", ")}`);
  }
  if (personaContext.trim()) lines.push(`Persona:\n${personaContext.trim()}`);
  return lines.join("\n");
}

function buildPartyContext(cards: JsonRecord[]): string {
  return cards
    .map((card, index) => {
      const name = stringValue(card.name, `Party member ${index + 1}`);
      const block = [`<party-member name="${escapePromptAttr(name)}">`];
      appendGameCardContext(block, card);
      for (const key of ["description", "personality", "scenario", "backstory", "appearance"]) {
        const value = stringValue(card[key]);
        if (value.trim()) block.push(value.trim());
      }
      const rpg = parseRpgStats(card.rpgStats);
      const maxHp = positiveNumber(rpg?.hp?.max);
      if (maxHp) block.push(`Max HP: ${maxHp}`);
      if (rpg?.enabled && Array.isArray(rpg.attributes) && rpg.attributes.length > 0) {
        block.push(`Attributes: ${rpg.attributes.map((a) => `${a.name} ${a.value}`).join(", ")}`);
      }
      block.push("</party-member>");
      return block.join("\n");
    })
    .join("\n\n");
}

function appendGameCardContext(lines: string[], card: JsonRecord | null): void {
  const shortDescription = stringValue(card?.shortDescription);
  const characterClass = stringValue(card?.class);
  if (shortDescription) lines.push(shortDescription);
  if (characterClass) lines.push(`Class: ${characterClass}`);
  for (const key of ["abilities", "strengths", "weaknesses"]) {
    const entries = stringArray(card?.[key]);
    if (entries.length > 0) lines.push(`${titleCase(key)}:\n${entries.map((entry) => `- ${entry}`).join("\n")}`);
  }
  const extra = recordValue(card?.extra);
  if (extra && Object.keys(extra).length > 0) {
    const extraLines = Object.entries(extra)
      .map(([key, value]) => {
        const text = stringValue(value);
        return key.trim() && text ? `- ${key.trim()}: ${text}` : "";
      })
      .filter(Boolean);
    if (extraLines.length > 0) lines.push(`Extra:\n${extraLines.join("\n")}`);
  }
}

function buildInitPrompt(context: GameCombatInitContext, chatHistory: LlmMessage[]): LlmMessage[] {
  const system = [
    `You are an excellent game master crafting a combat encounter for Marinara game mode. The user plays ${context.playerName}.`,
    context.partyContext ? `Party members:\n<party>\n${context.partyContext}\n</party>` : "",
    `Player:\n<player>\n${context.playerContext}\n</player>`,
    context.worldContext ? `Current tracked game context:\n<context>\n${context.worldContext}\n</context>` : "",
    context.spellbookContext
      ? [
          `Available spells and abilities:\n<spellbook>\n${context.spellbookContext}\n</spellbook>`,
          "When generating player or party attacks, prioritize spells and abilities from the spellbook.",
        ].join("\n\n")
      : "",
    "Return only one JSON object for the initial combat state.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const instruction = [
    "The combat starts now.",
    "Create a bespoke battle for the current game scene.",
    "Use the player card, party cards, inventory, spellbook, world state, and recent chat history.",
    "Create named/described enemies with multiple scaled attacks when appropriate, party abilities, optional itemEffects, optional boss mechanics with counterplay, optional dialogueCues, and optional visuals.",
    "The JSON shape must be:",
    `{"party":[{"name":"${context.playerName}","hp":24,"maxHp":24,"attacks":[{"name":"Attack","type":"single-target","description":"what it does","power":1,"cooldown":0}],"items":["Healing Potion x1"],"statuses":[],"isPlayer":true}],"enemies":[{"name":"Enemy","hp":18,"maxHp":18,"attacks":[{"name":"Strike","type":"single-target"}],"statuses":[],"description":"Brief enemy description","sprite":"enemy"}],"environment":"Brief description","styleNotes":{"environmentType":"plains","atmosphere":"tense","timeOfDay":"day","weather":"clear"},"itemEffects":[],"mechanics":[],"dialogueCues":[],"visuals":{"isBossFight":false,"enemyImagePrompts":[],"backgroundPrompt":"","illustrationPrompt":"","slug":""}}`,
    "Use configured max HP exactly when the context supplies it. Set hp equal to maxHp at combat start.",
    "Do not use placeholder names like Enemy 1 unless the scene truly has unnamed enemies.",
    "Write text in the same language as the recent chat history.",
  ].join("\n\n");

  return [{ role: "system", content: system }, ...chatHistory, { role: "user", content: instruction }];
}

async function completeJsonObject(
  capabilities: GameCombatInitCapabilities,
  chat: JsonRecord,
  overrideConnectionId: string | null,
  messages: LlmMessage[],
  parameters: Record<string, unknown>,
): Promise<JsonRecord | null> {
  const connectionId = await resolveConnectionId(capabilities.storage, chat, overrideConnectionId);
  const raw = await capabilities.llm.complete({ connectionId, messages, parameters });
  try {
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
  playerName: string;
  personaMaxHp: number | null;
  gameCards: JsonRecord[];
  worldState: { location: string | null; playerItems: string[] };
  spellbookAttacks: CombatAttack[];
  settings: EncounterSettingsWithLegacyCount;
}): CombatInitState {
  const playerCard = input.gameCards[0];
  const gameRpgStats = parseRpgStats(playerCard?.rpgStats);
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
      name: input.playerName,
      hp: playerMaxHp,
      maxHp: playerMaxHp,
      attacks,
      items: playerItems,
      statuses: [],
      isPlayer: true,
    },
  ];

  for (const card of input.gameCards.slice(1, 4)) {
    const maxHp = positiveNumber(parseRpgStats(card.rpgStats)?.hp?.max) ?? 24;
    party.push({
      name: stringValue(card.name, "Ally"),
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
    enemies: Array.from({ length: fallbackEnemyCount(input.settings) }, (_, index) => fallbackEnemy(index)),
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

function sanitizeCombatInitState(value: JsonRecord | null, fallback: CombatInitState): CombatInitState {
  const source = value ?? {};
  return {
    party: sanitizePartyArray(arrayValue(source.party), fallback.party),
    enemies: sanitizeEnemyArray(arrayValue(source.enemies), fallback.enemies),
    environment: stringValue(source.environment) || fallback.environment,
    styleNotes: sanitizeStyleNotes(recordValue(source.styleNotes), fallback.styleNotes),
    itemEffects: sanitizeItemEffects(arrayValue(source.itemEffects), fallback.itemEffects ?? []),
    dialogueCues: sanitizeDialogueCues(arrayValue(source.dialogueCues), fallback.dialogueCues ?? []),
    mechanics: sanitizeMechanics(arrayValue(source.mechanics), fallback.mechanics ?? []),
    visuals: sanitizeVisuals(recordValue(source.visuals), fallback.visuals),
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

function sanitizeItemEffects(values: unknown[] | null, fallback: CombatItemEffect[]): CombatItemEffect[] {
  if (!values) return fallback;
  const effects = values
    .map((value): CombatItemEffect | null => {
      const record = recordValue(value);
      const name = stringValue(record?.name);
      const target = combatItemTarget(record?.target);
      const type = combatItemType(record?.type);
      const description = stringValue(record?.description);
      if (!name || !target || !type || !description) return null;
      const effect: CombatItemEffect = { name, target, type, description };
      const power = optionalNumber(record?.power);
      const element = stringValue(record?.element);
      const status = sanitizeStatus(recordValue(record?.status));
      if (power !== undefined) effect.power = power;
      if (element) effect.element = element;
      if (status) effect.status = status;
      if (typeof record?.consumes === "boolean") effect.consumes = record.consumes;
      return effect;
    })
    .filter((effect): effect is CombatItemEffect => !!effect);
  return effects;
}

function sanitizeDialogueCues(values: unknown[] | null, fallback: CombatDialogueCue[]): CombatDialogueCue[] {
  const cues = (values ?? [])
    .map((value): CombatDialogueCue | null => {
      const record = recordValue(value);
      const speaker = stringValue(record?.speaker);
      const content = stringValue(record?.content);
      const type = combatDialogueType(record?.type);
      const trigger = combatDialogueTrigger(record?.trigger);
      if (!speaker || !content || !type || !trigger) return null;
      const cue: CombatDialogueCue = { speaker, content, type, trigger };
      const expression = stringValue(record?.expression);
      const target = stringValue(record?.target);
      const round = optionalNumber(record?.round);
      const everyNRounds = optionalNumber(record?.everyNRounds);
      if (expression) cue.expression = expression;
      if (target) cue.target = target;
      if (round !== undefined) cue.round = round;
      if (everyNRounds !== undefined) cue.everyNRounds = everyNRounds;
      return cue;
    })
    .filter((cue): cue is CombatDialogueCue => !!cue);
  return cues.length > 0 ? cues : fallback;
}

function sanitizeMechanics(values: unknown[] | null, fallback: CombatMechanic[]): CombatMechanic[] {
  const mechanics = (values ?? [])
    .map((value): CombatMechanic | null => {
      const record = recordValue(value);
      const name = stringValue(record?.name);
      const description = stringValue(record?.description);
      const trigger = combatMechanicTrigger(record?.trigger);
      if (!name || !description || !trigger) return null;
      const mechanic: CombatMechanic = { name, description, trigger };
      const ownerName = stringValue(record?.ownerName);
      const counterplay = stringValue(record?.counterplay);
      const interval = optionalNumber(record?.interval);
      const hpThreshold = optionalNumber(record?.hpThreshold);
      const effectType = combatMechanicEffect(record?.effectType);
      const power = optionalNumber(record?.power);
      const element = stringValue(record?.element);
      const status = sanitizeStatus(recordValue(record?.status));
      if (ownerName) mechanic.ownerName = ownerName;
      if (counterplay) mechanic.counterplay = counterplay;
      if (interval !== undefined) mechanic.interval = interval;
      if (hpThreshold !== undefined) mechanic.hpThreshold = hpThreshold;
      if (effectType) mechanic.effectType = effectType;
      if (power !== undefined) mechanic.power = power;
      if (element) mechanic.element = element;
      if (status) mechanic.status = status;
      return mechanic;
    })
    .filter((mechanic): mechanic is CombatMechanic => !!mechanic);
  return mechanics.length > 0 ? mechanics : fallback;
}

function sanitizeVisuals(value: JsonRecord | null, fallback?: CombatVisualRequest): CombatVisualRequest | undefined {
  if (!value) return fallback;
  const visuals: CombatVisualRequest = {};
  if (typeof value.isBossFight === "boolean") visuals.isBossFight = value.isBossFight;
  else if (typeof fallback?.isBossFight === "boolean") visuals.isBossFight = fallback.isBossFight;

  const prompts = (arrayValue(value.enemyImagePrompts) ?? [])
    .map((prompt): { name: string; prompt: string } | null => {
      const record = recordValue(prompt);
      const name = stringValue(record?.name);
      const text = stringValue(record?.prompt);
      return name && text ? { name, prompt: text } : null;
    })
    .filter((prompt): prompt is { name: string; prompt: string } => !!prompt);
  visuals.enemyImagePrompts = prompts.length > 0 ? prompts : (fallback?.enemyImagePrompts ?? []);

  const backgroundPrompt = stringValue(value.backgroundPrompt) || fallback?.backgroundPrompt;
  const illustrationPrompt = stringValue(value.illustrationPrompt) || fallback?.illustrationPrompt;
  const slug = stringValue(value.slug) || fallback?.slug;
  if (backgroundPrompt) visuals.backgroundPrompt = backgroundPrompt;
  if (illustrationPrompt) visuals.illustrationPrompt = illustrationPrompt;
  if (slug) visuals.slug = slug;
  return visuals;
}

function sanitizeStatus(value: JsonRecord | null, fallback?: CombatStatus): CombatStatus | undefined {
  if (!value && !fallback) return undefined;
  const name = stringValue(value?.name) || fallback?.name;
  if (!name) return undefined;
  const status: CombatStatus = {
    name,
    emoji: stringValue(value?.emoji) || fallback?.emoji || "",
    duration: numberValue(value?.duration, fallback?.duration ?? 1),
  };
  const modifier = optionalNumber(value?.modifier) ?? fallback?.modifier;
  const stat = combatStatusStat(value?.stat) ?? fallback?.stat;
  if (modifier !== undefined) status.modifier = modifier;
  if (stat) status.stat = stat;
  return status;
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
  try {
    const rows = await storage.listChatMessages<unknown>(chatId);
    return Array.isArray(rows) ? rows.filter(isRecord) : [];
  } catch {
    return [];
  }
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

function fallbackEnemyCount(settings: EncounterSettingsWithLegacyCount): number {
  const requested = numberValue(settings.enemyCount ?? settings.enemies, 1) || 1;
  return Math.max(1, Math.min(6, requested));
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

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

function combatItemTarget(value: unknown): CombatItemEffect["target"] | null {
  return oneOf(value, ["self", "ally", "enemy", "any"] as const);
}

function combatItemType(value: unknown): CombatItemEffect["type"] | null {
  return oneOf(value, ["heal", "damage", "buff", "debuff", "status", "utility"] as const);
}

function combatDialogueType(value: unknown): CombatDialogueCue["type"] | null {
  return oneOf(value, ["main", "side", "extra", "thought", "whisper"] as const);
}

function combatDialogueTrigger(value: unknown): CombatDialogueCue["trigger"] | null {
  return oneOf(
    value,
    ["intro", "round", "attack", "hit", "charge", "phase_75", "phase_50", "phase_25", "low_hp", "victory", "defeat"] as const,
  );
}

function combatMechanicTrigger(value: unknown): CombatMechanic["trigger"] | null {
  return oneOf(value, ["round_interval", "hp_threshold", "on_hit", "on_attack", "passive"] as const);
}

function combatMechanicEffect(value: unknown): NonNullable<CombatMechanic["effectType"]> | null {
  return oneOf(
    value,
    ["damage_all", "damage_one", "buff_self", "debuff_party", "status_party", "status_enemy"] as const,
  );
}

function combatStatusStat(value: unknown): CombatStatus["stat"] | null {
  return oneOf(value, ["attack", "defense", "speed", "hp"] as const);
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function compact(value: string, maxLength: number): string {
  const normalized = value.split(/\s+/).join(" ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function escapePromptAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
