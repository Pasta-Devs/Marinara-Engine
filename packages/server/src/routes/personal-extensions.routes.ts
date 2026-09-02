import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  approvePersonalExtensionSchema,
  createPersonalExtensionSchema,
  externalExtensionsPolicyUpdateSchema,
  personalExtensionStoragePatchSchema,
  rollbackPersonalExtensionSchema,
  updatePersonalExtensionSchema,
  PERSONAL_EXTENSION_CONTRIBUTION_KINDS,
  PERSONAL_EXTENSION_CONTRIBUTION_POSITIONS,
  PERSONAL_EXTENSION_CONTRIBUTION_SURFACES,
  PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY,
  PERSONAL_EXTENSION_UI_ELEMENT_KINDS,
  PERSONAL_EXTENSION_UI_LIMITS,
  normalizePersonalExtensionCapabilities,
  type CharacterData,
  type PersonalClientExtensionRuntime,
  type PersonalExtension,
  type PersonalExtensionCapability,
  type PersonalExtensionCharacterSnapshot,
  type PersonalExtensionPersonaSnapshot,
} from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { createPersonalExtensionsStorage } from "../services/extensions/personal-extension-storage.service.js";
import { createPersonalExtensionSettingsStorage } from "../services/extensions/personal-extension-settings.service.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { resolveChatUserIdentity } from "../services/chat-user-identity.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { personalServerExtensionRuntime } from "../services/extensions/personal-server-extension-runtime.js";
import {
  canExecutePersonalExtension,
  getPersonalExtensionPolicy,
  isExternalPersonalExtensionSource,
  setExternalExtensionsEnabled,
} from "../services/extensions/personal-extension-policy.service.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const CONTEXT_MAX_ID_LENGTH = 256;
const CONTEXT_MAX_CHARACTER_IDS = 256;
const CONTEXT_TEXT_BUDGET = 256_000;
const CONTEXT_FIELD_LENGTH = 32_000;
const CONTEXT_TAG_COUNT = 100;
const CONTEXT_TAG_LENGTH = 256;

type ContextTextBudget = { remaining: number };
type ContextCharacterSource = { id: string; data: CharacterData };
type ContextPersonaSource = {
  id: string;
  source?: "persona" | "character";
  name: unknown;
  description: unknown;
  personality: unknown;
  scenario: unknown;
  backstory: unknown;
  appearance: unknown;
  tags: unknown;
  aboutMe: unknown;
  convoDisplayName: unknown;
};

function boundedContextText(value: unknown, budget: ContextTextBudget, max = CONTEXT_FIELD_LENGTH) {
  if (typeof value !== "string" || budget.remaining <= 0) return "";
  const text = value.slice(0, Math.min(max, budget.remaining));
  budget.remaining -= text.length;
  return text;
}

function boundedContextTags(value: unknown, budget: ContextTextBudget) {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  for (const candidate of value) {
    const tag = boundedContextText(candidate, budget, CONTEXT_TAG_LENGTH);
    if (!tag || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length >= CONTEXT_TAG_COUNT) break;
  }
  return tags;
}

function characterContextSnapshot(
  character: ContextCharacterSource,
  budget: ContextTextBudget,
): PersonalExtensionCharacterSnapshot {
  const data = character.data;
  const extensions =
    data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};
  return {
    id: character.id,
    name: boundedContextText(data.name, budget),
    description: boundedContextText(data.description, budget),
    personality: boundedContextText(data.personality, budget),
    scenario: boundedContextText(data.scenario, budget),
    firstMessage: boundedContextText(data.first_mes, budget),
    exampleDialogue: boundedContextText(data.mes_example, budget),
    creator: boundedContextText(data.creator, budget),
    characterVersion: boundedContextText(data.character_version, budget),
    tags: boundedContextTags(data.tags, budget),
    backstory: boundedContextText(extensions.backstory, budget),
    appearance: boundedContextText(extensions.appearance, budget),
    aboutMe: boundedContextText(extensions.aboutMe, budget),
    conversationDisplayName: boundedContextText(extensions.convoDisplayName, budget),
  };
}

function personaContextSnapshot(
  persona: ContextPersonaSource,
  budget: ContextTextBudget,
): PersonalExtensionPersonaSnapshot {
  return {
    id: persona.id,
    ...(persona.source ? { source: persona.source } : {}),
    name: boundedContextText(persona.name, budget),
    description: boundedContextText(persona.description, budget),
    personality: boundedContextText(persona.personality, budget),
    scenario: boundedContextText(persona.scenario, budget),
    backstory: boundedContextText(persona.backstory, budget),
    appearance: boundedContextText(persona.appearance, budget),
    tags: boundedContextTags(persona.tags, budget),
    aboutMe: boundedContextText(persona.aboutMe, budget),
    conversationDisplayName: boundedContextText(persona.convoDisplayName, budget),
  };
}

export function createPersonalExtensionRecordContext(options: {
  capabilities: readonly PersonalExtensionCapability[];
  characters: ContextCharacterSource[];
  persona: ContextPersonaSource | null;
}) {
  const capabilities = new Set(normalizePersonalExtensionCapabilities(options.capabilities));
  const budget = { remaining: CONTEXT_TEXT_BUDGET };
  return {
    characters: capabilities.has("read_active_characters")
      ? options.characters
          .slice(0, CONTEXT_MAX_CHARACTER_IDS)
          .map((character) => characterContextSnapshot(character, budget))
      : [],
    persona:
      capabilities.has("read_active_persona") && options.persona
        ? personaContextSnapshot(options.persona, budget)
        : null,
  };
}

function parseContextCharacterIds(value: unknown) {
  let candidates: unknown = value;
  if (typeof value === "string") {
    try {
      candidates = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(candidates)) return [];
  return Array.from(
    new Set(
      candidates.filter(
        (candidate): candidate is string => typeof candidate === "string" && ID_PATTERN.test(candidate),
      ),
    ),
  ).slice(0, CONTEXT_MAX_CHARACTER_IDS);
}

function parseContextCharacter(row: { id: string; data: string } | null): ContextCharacterSource | null {
  if (!row) return null;
  try {
    const data = JSON.parse(row.data) as CharacterData;
    return data && typeof data === "object" ? { id: row.id, data } : null;
  } catch {
    return null;
  }
}

function privileged(
  req: Parameters<typeof requirePrivilegedAccess>[0],
  reply: Parameters<typeof requirePrivilegedAccess>[1],
) {
  return requirePrivilegedAccess(req, reply, { feature: "Personal Extensions" });
}

function escapeClosingTag(source: string, tag: "style") {
  return source.replace(new RegExp(`</${tag}`, "giu"), `<\\/${tag}`);
}

function hasFullPageAccess(extension: Pick<PersonalExtension, "capabilities">) {
  return extension.capabilities.includes(PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY);
}

export function fullPageExtensionSource(extension: PersonalExtension) {
  const identity = JSON.stringify({
    id: extension.id,
    name: extension.name,
    contentHash: extension.contentHash,
  }).replace(/</gu, "\\u003c");
  return `(() => {
  "use strict";
  const extension = ${identity};
  const run = window.__marinaraRunFullPageExtension;
  if (typeof run !== "function") {
    throw new Error("Marinara full-page extension host is unavailable");
  }
  run(extension, async (marinara) => {
    "use strict";
${extension.js ?? ""}
  });
})();`;
}

export function browserWorkerSource(extension: PersonalExtension) {
  const identity = JSON.stringify({
    id: extension.id,
    name: extension.name,
    contentHash: extension.contentHash,
    capabilities: extension.capabilities,
  });
  const contributionContract = JSON.stringify({
    kinds: PERSONAL_EXTENSION_CONTRIBUTION_KINDS,
    surfaces: PERSONAL_EXTENSION_CONTRIBUTION_SURFACES,
    positions: PERSONAL_EXTENSION_CONTRIBUTION_POSITIONS,
    elementKinds: PERSONAL_EXTENSION_UI_ELEMENT_KINDS,
    limits: PERSONAL_EXTENSION_UI_LIMITS,
  });
  return `
(() => {
  "use strict";
  const extension = ${identity};
  const contributionContract = ${contributionContract};
  const send = self.postMessage.bind(self);
  const cleanupFns = [];
  let requestId = 0;
  const pending = new Map();
  const MAX_CONTEXT_ID_LENGTH = ${CONTEXT_MAX_ID_LENGTH};
  const MAX_CONTEXT_CHARACTER_IDS = ${CONTEXT_MAX_CHARACTER_IDS};
  const MAX_CONTEXT_TEXT = ${CONTEXT_TEXT_BUDGET};
  const MAX_CONTEXT_FIELD = ${CONTEXT_FIELD_LENGTH};
  const MAX_CONTEXT_TAGS = ${CONTEXT_TAG_COUNT};
  const MAX_CONTEXT_TAG = ${CONTEXT_TAG_LENGTH};
  const capabilities = new Set(extension.capabilities);
  const contextSubscriptions = new Set();
  const freezeContext = (chatId, characterIds, personaId = null, characters = [], persona = null) => Object.freeze({
    chatId,
    characterId: characterIds.length === 1 ? characterIds[0] : null,
    characterIds: Object.freeze(characterIds),
    personaId,
    characters: Object.freeze(characters),
    persona,
  });
  let currentContext = freezeContext(null, []);
  let resolveInitialContext;
  let initialContextResolved = false;
  const initialContextReady = new Promise((resolve) => { resolveInitialContext = resolve; });
  const markInitialContextReady = () => {
    if (initialContextResolved) return;
    initialContextResolved = true;
    resolveInitialContext();
  };
  const initialContextTimer = self.setTimeout(markInitialContextReady, 1_000);
  const normalizeContextId = (value) => (
    typeof value === "string" && value.trim() && value.length <= MAX_CONTEXT_ID_LENGTH ? value : null
  );
  const boundedContextText = (value, budget, max = MAX_CONTEXT_FIELD) => {
    if (typeof value !== "string" || budget.remaining <= 0) return "";
    const text = value.slice(0, Math.min(max, budget.remaining));
    budget.remaining -= text.length;
    return text;
  };
  const boundedContextTags = (value, budget) => {
    if (!Array.isArray(value)) return Object.freeze([]);
    const tags = [];
    for (const candidate of value) {
      const tag = boundedContextText(candidate, budget, MAX_CONTEXT_TAG);
      if (!tag || tags.includes(tag)) continue;
      tags.push(tag);
      if (tags.length >= MAX_CONTEXT_TAGS) break;
    }
    return Object.freeze(tags);
  };
  const normalizeCharacterContext = (value, allowedIds, budget) => {
    const id = normalizeContextId(value?.id);
    if (!id || !allowedIds.has(id)) return null;
    return Object.freeze({
      id,
      ...(value?.source === "character" || value?.source === "persona" ? { source: value.source } : {}),
      name: boundedContextText(value.name, budget),
      description: boundedContextText(value.description, budget),
      personality: boundedContextText(value.personality, budget),
      scenario: boundedContextText(value.scenario, budget),
      firstMessage: boundedContextText(value.firstMessage, budget),
      exampleDialogue: boundedContextText(value.exampleDialogue, budget),
      creator: boundedContextText(value.creator, budget),
      characterVersion: boundedContextText(value.characterVersion, budget),
      tags: boundedContextTags(value.tags, budget),
      backstory: boundedContextText(value.backstory, budget),
      appearance: boundedContextText(value.appearance, budget),
      aboutMe: boundedContextText(value.aboutMe, budget),
      conversationDisplayName: boundedContextText(value.conversationDisplayName, budget),
    });
  };
  const normalizePersonaContext = (value, expectedId, budget) => {
    const id = normalizeContextId(value?.id);
    if (!id || id !== expectedId) return null;
    return Object.freeze({
      id,
      ...(value?.source === "character" || value?.source === "persona" ? { source: value.source } : {}),
      name: boundedContextText(value.name, budget),
      description: boundedContextText(value.description, budget),
      personality: boundedContextText(value.personality, budget),
      scenario: boundedContextText(value.scenario, budget),
      backstory: boundedContextText(value.backstory, budget),
      appearance: boundedContextText(value.appearance, budget),
      tags: boundedContextTags(value.tags, budget),
      aboutMe: boundedContextText(value.aboutMe, budget),
      conversationDisplayName: boundedContextText(value.conversationDisplayName, budget),
    });
  };
  const normalizeContext = (value) => {
    const chatId = normalizeContextId(value?.chatId);
    const characterIds = [];
    const seen = new Set();
    if (chatId && Array.isArray(value?.characterIds)) {
      for (const candidate of value.characterIds) {
        const id = normalizeContextId(candidate);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        characterIds.push(id);
        if (characterIds.length >= MAX_CONTEXT_CHARACTER_IDS) break;
      }
    }
    const personaId =
      chatId && capabilities.has("read_active_persona") ? normalizeContextId(value?.personaId) : null;
    const budget = { remaining: MAX_CONTEXT_TEXT };
    const allowedIds = new Set(characterIds);
    const characters = [];
    const seenCharacters = new Set();
    if (capabilities.has("read_active_characters") && Array.isArray(value?.characters)) {
      for (const candidate of value.characters) {
        const character = normalizeCharacterContext(candidate, allowedIds, budget);
        if (!character || seenCharacters.has(character.id)) continue;
        seenCharacters.add(character.id);
        characters.push(character);
        if (characters.length >= MAX_CONTEXT_CHARACTER_IDS) break;
      }
    }
    const persona =
      personaId && value?.persona && typeof value.persona === "object"
        ? normalizePersonaContext(value.persona, personaId, budget)
        : null;
    return freezeContext(chatId, characterIds, personaId, characters, persona);
  };
  const contextKey = (value) => JSON.stringify(value);
  const notifyContextSubscription = (subscription) => {
    Promise.resolve()
      .then(() => {
        if (!contextSubscriptions.has(subscription)) return;
        subscription.listener(currentContext);
      })
      .catch((error) => log("error", [error instanceof Error ? error.message : String(error)]));
  };
  for (const name of ["fetch", "WebSocket", "EventSource", "XMLHttpRequest", "Worker", "SharedWorker", "WebTransport", "importScripts"]) {
    try { Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false }); } catch {}
  }
  const storage = (action, payload) => new Promise((resolve, reject) => {
    const id = String(++requestId);
    pending.set(id, { resolve, reject });
    send({ type: "storage", requestId: id, action, payload });
  });
  const managedTimeout = (fn, ms) => {
    const timer = self.setTimeout(fn, Math.max(0, Math.min(2147483647, Number(ms) || 0)));
    cleanupFns.push(() => self.clearTimeout(timer));
    return timer;
  };
  const managedInterval = (fn, ms) => {
    const timer = self.setInterval(fn, Math.max(1, Math.min(2147483647, Number(ms) || 1)));
    cleanupFns.push(() => self.clearInterval(timer));
    return timer;
  };
  const log = (level, args) => send({ type: "log", level, args: args.map((value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
  }) });
  // Constrained UI: the worker describes a window as a small whitelist of
  // element descriptors. The trusted iframe bootstrap renders them with
  // textContent only (never HTML) and routes button clicks back here, so the
  // extension gets interactive UI without any DOM, markup, or host access.
  const MAX_UI_WINDOWS = 4;
  const MAX_UI_ELEMENTS = 60;
  const MAX_UI_TEXT = 8000;
  const UI_ELEMENT_KINDS = new Set(contributionContract.elementKinds);
  const UI_CONTROL_KINDS = new Set(["button", "input", "select", "toggle", "slider", "color"]);
  const uiWindows = new Set();
  const uiEventHandlers = new Map();
  const uiCloseHandlers = new Map();
  let uiWindowCounter = 0;
  const clampText = (value) => String(value == null ? "" : value).slice(0, MAX_UI_TEXT);
  const optionalText = (value) => value == null ? undefined : clampText(value);
  const normalizeControlId = (element) => {
    if (typeof element.id !== "string" || !element.id) {
      throw new Error(element.kind + " element requires a string id");
    }
    return element.id.slice(0, 128);
  };
  const normalizeUiElements = (elements) => {
    if (!Array.isArray(elements)) throw new Error("window elements must be an array");
    if (elements.length > MAX_UI_ELEMENTS) throw new Error("window has too many elements (max " + MAX_UI_ELEMENTS + ")");
    return elements.map((element) => {
      if (!element || typeof element !== "object" || !UI_ELEMENT_KINDS.has(element.kind)) {
        throw new Error("unsupported window element");
      }
      if (element.kind === "spacer") return { kind: "spacer" };
      if (element.kind === "heading" || element.kind === "text" || element.kind === "pre") {
        return { kind: element.kind, text: clampText(element.text) };
      }
      const id = normalizeControlId(element);
      if (element.kind === "button") {
        return { kind: "button", id, label: clampText(element.label ?? element.text) };
      }
      if (element.kind === "input") {
        return {
          kind: "input",
          id,
          label: optionalText(element.label),
          placeholder: optionalText(element.placeholder),
          value: optionalText(element.value),
          multiline: Boolean(element.multiline),
        };
      }
      if (element.kind === "select") {
        if (!Array.isArray(element.options) || element.options.length > contributionContract.limits.selectOptions) {
          throw new Error("select options exceed their limit");
        }
        const values = new Set();
        const options = element.options.map((option) => {
          if (!option || typeof option !== "object" || typeof option.value !== "string" || typeof option.label !== "string") {
            throw new Error("select options require string values and labels");
          }
          const value = clampText(option.value);
          if (!value || values.has(value)) throw new Error("select option values must be non-empty and unique");
          values.add(value);
          return { value, label: clampText(option.label) };
        });
        const value = optionalText(element.value);
        if (value !== undefined && !values.has(value)) throw new Error("select value must match an option");
        return { kind: "select", id, label: optionalText(element.label), value, options };
      }
      if (element.kind === "toggle") {
        return { kind: "toggle", id, label: clampText(element.label), checked: Boolean(element.checked) };
      }
      if (element.kind === "slider") {
        const min = Number(element.min);
        const max = Number(element.max);
        const step = element.step == null ? undefined : Number(element.step);
        const value = element.value == null ? undefined : Number(element.value);
        if (
          !Number.isFinite(min) ||
          !Number.isFinite(max) ||
          min >= max ||
          (step !== undefined && (!Number.isFinite(step) || step <= 0)) ||
          (value !== undefined && !Number.isFinite(value))
        ) {
          throw new Error("slider values are invalid");
        }
        return {
          kind: "slider",
          id,
          label: optionalText(element.label),
          min,
          max,
          step,
          value: value === undefined ? undefined : Math.max(min, Math.min(max, value)),
        };
      }
      const value = optionalText(element.value);
      if (value !== undefined && !/^#[a-f0-9]{6}$/iu.test(value)) throw new Error("color value must be a hex color");
      return { kind: "color", id, label: optionalText(element.label), value };
    });
  };
  const showWindow = (options) => {
    const config = options || {};
    if (uiWindows.size >= MAX_UI_WINDOWS) throw new Error("too many open extension windows (max " + MAX_UI_WINDOWS + ")");
    const windowId = "w" + String(++uiWindowCounter);
    const elements = normalizeUiElements(config.elements);
    uiWindows.add(windowId);
    if (typeof config.onEvent === "function") uiEventHandlers.set(windowId, config.onEvent);
    if (typeof config.onClose === "function") uiCloseHandlers.set(windowId, config.onClose);
    send({ type: "ui-show", windowId, title: clampText(config.title || extension.name), elements });
    return {
      id: windowId,
      update: (next) => {
        if (!uiWindows.has(windowId)) return;
        const patch = next || {};
        send({
          type: "ui-update",
          windowId,
          title: patch.title == null ? undefined : clampText(patch.title),
          elements: patch.elements == null ? undefined : normalizeUiElements(patch.elements),
        });
      },
      close: () => {
        if (!uiWindows.delete(windowId)) return;
        uiEventHandlers.delete(windowId);
        uiCloseHandlers.delete(windowId);
        send({ type: "ui-close", windowId });
      },
    };
  };
  // Host contributions are declarative records only. The extension can ask
  // Marinara to place trusted controls in fixed slots, but it never supplies
  // markup, styles, component code, URLs, or host callbacks.
  const contributionKinds = new Set(contributionContract.kinds);
  const contributionSurfaces = new Set(contributionContract.surfaces);
  const contributionPositions = new Set(contributionContract.positions);
  const contributionControlKinds = new Set(["button", "input", "select", "toggle", "slider", "color"]);
  const uiContributions = new Map();
  const uiContributionActivateHandlers = new Map();
  const uiContributionEventHandlers = new Map();
  const contributionIdPattern = /^[A-Za-z0-9._-]+$/;
  const contributionText = (value, max, required) => {
    if (value == null && !required) return undefined;
    if (typeof value !== "string") throw new Error("contribution text must be a string");
    const text = value.trim();
    if ((required && !text) || text.length > max) throw new Error("contribution text exceeds its limit");
    return text;
  };
  const contributionId = (value) => {
    const id = contributionText(value, contributionContract.limits.idLength, true);
    if (!contributionIdPattern.test(id)) throw new Error("contribution id contains unsupported characters");
    return id;
  };
  const normalizeContributionElements = (elements) => {
    const normalized = normalizeUiElements(elements || []);
    let totalTextLength = 0;
    const interactiveIds = new Set();
    for (const element of normalized) {
      if (contributionControlKinds.has(element.kind)) {
        if (!element.id || element.id.length > contributionContract.limits.idLength) {
          throw new Error("panel control id exceeds its limit");
        }
        if (!contributionIdPattern.test(element.id)) {
          throw new Error("panel control id contains unsupported characters");
        }
        if (interactiveIds.has(element.id)) throw new Error("panel control ids must be unique");
        interactiveIds.add(element.id);
      }
      for (const field of ["id", "text", "label", "placeholder", "value"]) {
        if (typeof element[field] === "string") totalTextLength += element[field].length;
      }
      if (typeof element.label === "string" && element.label.length > contributionContract.limits.labelLength) {
        throw new Error("panel control label exceeds its limit");
      }
      if (
        typeof element.placeholder === "string" &&
        element.placeholder.length > contributionContract.limits.descriptionLength
      ) {
        throw new Error("panel control placeholder exceeds its limit");
      }
      if (element.kind === "select") {
        for (const option of element.options) {
          if (
            option.value.length > contributionContract.limits.labelLength ||
            option.label.length > contributionContract.limits.labelLength
          ) {
            throw new Error("select option text exceeds its limit");
          }
          totalTextLength += option.value.length + option.label.length;
        }
      }
    }
    if (totalTextLength > contributionContract.limits.totalPanelTextLength) {
      throw new Error("panel text exceeds its total limit");
    }
    return normalized;
  };
  const normalizeContribution = (options) => {
    if (!options || typeof options !== "object") throw new Error("contribution options are required");
    const id = contributionId(options.id);
    const kind = contributionKinds.has(options.kind) ? options.kind : null;
    if (!kind) throw new Error("unsupported contribution kind");
    const label = contributionText(options.label, contributionContract.limits.labelLength, true);
    const description = contributionText(options.description, contributionContract.limits.descriptionLength, false);
    const icon = options.icon == null ? undefined : options.icon;
    if (
      icon !== undefined &&
      (typeof icon !== "string" ||
        icon.length > contributionContract.limits.iconLength ||
        !/^[a-z0-9-]+$/.test(icon))
    ) {
      throw new Error("unsupported contribution icon");
    }
    let surface;
    let position;
    if (kind === "button") {
      surface = options.surface == null ? "top-bar" : options.surface;
      if (!contributionSurfaces.has(surface)) throw new Error("unsupported contribution surface");
      if (surface === "top-bar") {
        if (options.position !== undefined) throw new Error("top-bar contributions do not accept a position");
      } else {
        position = options.position == null ? "header" : options.position;
        if (!contributionPositions.has(position)) throw new Error("unsupported contribution position");
      }
    } else if (options.surface !== undefined || options.position !== undefined) {
      throw new Error("only button contributions may select a surface or position");
    }
    if (kind !== "panel" && options.elements !== undefined) {
      throw new Error("only panel contributions may include elements");
    }
    const elements = kind === "panel" ? normalizeContributionElements(options.elements) : undefined;
    return { id, kind, label, description, icon, surface, position, elements };
  };
  const registerContribution = (options) => {
    if (uiContributions.size >= contributionContract.limits.contributionsPerExtension) {
      throw new Error("too many extension contributions");
    }
    const descriptor = normalizeContribution(options);
    if (uiContributions.has(descriptor.id)) throw new Error("contribution id is already registered");
    uiContributions.set(descriptor.id, descriptor);
    if (typeof options.onActivate === "function") {
      uiContributionActivateHandlers.set(descriptor.id, options.onActivate);
    }
    if (typeof options.onEvent === "function") {
      uiContributionEventHandlers.set(descriptor.id, options.onEvent);
    }
    send({ type: "ui-contribution-register", contribution: descriptor });
    return Object.freeze({
      id: descriptor.id,
      update: (patch) => {
        const current = uiContributions.get(descriptor.id);
        if (!current) return;
        const nextOptions = { ...current, ...(patch || {}), id: current.id, kind: current.kind };
        const next = normalizeContribution(nextOptions);
        uiContributions.set(next.id, next);
        if (typeof patch?.onActivate === "function") {
          uiContributionActivateHandlers.set(next.id, patch.onActivate);
        }
        if (typeof patch?.onEvent === "function") {
          uiContributionEventHandlers.set(next.id, patch.onEvent);
        }
        send({ type: "ui-contribution-update", contribution: next });
      },
      remove: () => {
        if (!uiContributions.delete(descriptor.id)) return;
        uiContributionActivateHandlers.delete(descriptor.id);
        uiContributionEventHandlers.delete(descriptor.id);
        send({ type: "ui-contribution-remove", contributionId: descriptor.id });
      },
    });
  };
  const marinara = Object.freeze({
    runtime: "client",
    version: 5,
    extensionId: extension.id,
    extensionName: extension.name,
    capabilities: Object.freeze([...capabilities]),
    log: Object.freeze({
      debug: (...args) => log("debug", args),
      info: (...args) => log("info", args),
      warn: (...args) => log("warn", args),
      error: (...args) => log("error", args),
    }),
    storage: Object.freeze({
      get: () => storage("get"),
      patch: (patch) => storage("patch", patch),
      delete: () => storage("delete"),
    }),
    context: Object.freeze({
      get: () => currentContext,
      subscribe: (listener) => {
        if (typeof listener !== "function") throw new Error("context.subscribe requires a function");
        const subscription = { listener };
        contextSubscriptions.add(subscription);
        notifyContextSubscription(subscription);
        return () => contextSubscriptions.delete(subscription);
      },
    }),
    ui: Object.freeze({
      showWindow,
      registerContribution,
    }),
    setTimeout: managedTimeout,
    setInterval: managedInterval,
    clearTimeout: self.clearTimeout.bind(self),
    clearInterval: self.clearInterval.bind(self),
    onCleanup: (fn) => {
      if (typeof fn !== "function") throw new Error("onCleanup requires a function");
      cleanupFns.push(fn);
    },
  });
  self.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "context-update") {
      const nextContext = normalizeContext(message.context);
      const changed = contextKey(nextContext) !== contextKey(currentContext);
      currentContext = nextContext;
      self.clearTimeout(initialContextTimer);
      markInitialContextReady();
      if (changed) {
        for (const subscription of contextSubscriptions) notifyContextSubscription(subscription);
      }
    }
    if (message?.type === "storage-result") {
      const request = pending.get(message.requestId);
      if (!request) return;
      pending.delete(message.requestId);
      if (message.ok) request.resolve(message.value);
      else request.reject(new Error(message.error || "Extension storage request failed"));
    }
    if (message?.type === "ui-event" && typeof message.windowId === "string") {
      const handler = uiEventHandlers.get(message.windowId);
      if (handler) {
        try {
          handler({
            windowId: message.windowId,
            elementId: typeof message.elementId === "string" ? message.elementId : "",
            values: message.values && typeof message.values === "object" ? message.values : {},
          });
        } catch (error) {
          send({ type: "log", level: "error", args: [error instanceof Error ? error.message : String(error)] });
        }
      }
    }
    if (message?.type === "ui-closed" && typeof message.windowId === "string") {
      if (uiWindows.delete(message.windowId)) {
        const handler = uiCloseHandlers.get(message.windowId);
        uiEventHandlers.delete(message.windowId);
        uiCloseHandlers.delete(message.windowId);
        if (handler) { try { handler({ windowId: message.windowId }); } catch {} }
      }
    }
    if (message?.type === "ui-contribution-activate" && typeof message.contributionId === "string") {
      const handler = uiContributionActivateHandlers.get(message.contributionId);
      if (handler) {
        Promise.resolve()
          .then(() => handler({ contributionId: message.contributionId }))
          .catch((error) => log("error", [error instanceof Error ? error.message : String(error)]));
      }
    }
    if (message?.type === "ui-contribution-event" && typeof message.contributionId === "string") {
      const handler = uiContributionEventHandlers.get(message.contributionId);
      if (handler) {
        Promise.resolve()
          .then(() => handler({
            contributionId: message.contributionId,
            elementId: typeof message.elementId === "string" ? message.elementId : "",
            values: message.values && typeof message.values === "object" ? message.values : {},
          }))
          .catch((error) => log("error", [error instanceof Error ? error.message : String(error)]));
      }
    }
    if (message?.type === "stop") {
      for (const id of uiContributions.keys()) {
        send({ type: "ui-contribution-remove", contributionId: id });
      }
      uiContributions.clear();
      uiContributionActivateHandlers.clear();
      uiContributionEventHandlers.clear();
      contextSubscriptions.clear();
      for (const cleanup of [...cleanupFns].reverse()) {
        try { cleanup(); } catch {}
      }
      cleanupFns.length = 0;
      send({ type: "stopped" });
      self.close();
    }
  });
  self.setInterval(() => send({ type: "heartbeat" }), 1_000);
  Promise.resolve((async () => {
    "use strict";
    await initialContextReady;
${extension.js ?? ""}
  })()).then(
    () => send({ type: "ready", contentHash: extension.contentHash }),
    (error) => send({ type: "error", contentHash: extension.contentHash, message: error instanceof Error ? error.message : String(error) }),
  );
})();
`;
}

export function sandboxDocument(extension: PersonalExtension, nonce: string) {
  const boot = JSON.stringify({
    id: extension.id,
    name: extension.name,
    contentHash: extension.contentHash,
    workerSource: browserWorkerSource(extension),
  }).replace(/</gu, "\\u003c");
  const css = escapeClosingTag(extension.css ?? "", "style");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<style>${css}</style>
</head>
<body>
<script nonce="${nonce}">
(() => {
  "use strict";
  const extension = ${boot};
  const post = (message) => window.parent.postMessage({ channel: "marinara-personal-extension", ...message }, "*");
  const workerUrl = URL.createObjectURL(new Blob([extension.workerSource], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  URL.revokeObjectURL(workerUrl);

  // Host-rendered window layer. The worker only sends element descriptors;
  // everything below builds DOM with textContent (never parsed markup) inside
  // this opaque-origin iframe, so the extension can present interactive UI
  // without touching Marinara's page or being able to inject markup. The iframe
  // is sized by the host to just this floating panel — it does not cover or
  // take over Marinara's page.
  const theme = { accent: "#a855f7", accentText: "#ffffff", surface: "rgba(24,24,27,0.98)", text: "#f4f4f5", border: "rgba(127,127,127,0.35)", muted: "rgba(127,127,127,0.15)" };
  const root = document.createElement("div");
  root.setAttribute("data-ext-root", "");
  Object.assign(root.style, { display: "none", fontFamily: "system-ui, sans-serif", boxSizing: "border-box" });
  document.documentElement.style.background = "transparent";
  document.body.style.margin = "0";
  document.body.style.background = "transparent";
  document.body.appendChild(root);
  const uiWindows = new Map();
  const applyThemeVars = () => {
    root.style.setProperty("--ext-accent", theme.accent);
    root.style.setProperty("--ext-accent-text", theme.accentText);
    root.style.setProperty("--ext-surface", theme.surface);
    root.style.setProperty("--ext-text", theme.text);
    root.style.setProperty("--ext-border", theme.border);
    root.style.setProperty("--ext-muted", theme.muted);
  };
  applyThemeVars();
  const reportSize = () => {
    if (uiWindows.size === 0) return;
    const width = Math.min(420, Math.max(240, Math.ceil(root.scrollWidth)));
    const height = Math.max(80, Math.ceil(root.scrollHeight));
    post({ type: "ui-resize", contentHash: extension.contentHash, width, height });
  };
  const syncVisibility = (justOpened) => {
    const open = uiWindows.size > 0;
    root.style.display = open ? "block" : "none";
    if (!open) { post({ type: "ui-window-close", contentHash: extension.contentHash }); return; }
    if (justOpened) post({ type: "ui-window-open", contentHash: extension.contentHash });
    reportSize();
  };
  const closeWindowLocally = (windowId, notifyWorker) => {
    const entry = uiWindows.get(windowId);
    if (!entry) return;
    entry.card.remove();
    uiWindows.delete(windowId);
    if (notifyWorker) worker.postMessage({ type: "ui-closed", windowId });
    syncVisibility(false);
  };
  const collectValues = (windowId) => {
    const values = {};
    const entry = uiWindows.get(windowId);
    if (entry) {
      for (const [id, node] of entry.inputs) {
        values[id] = node.type === "checkbox" ? String(node.checked) : String(node.value ?? "");
      }
    }
    return values;
  };
  const buildField = (descriptor, inputs, field) => {
    const wrap = document.createElement("label");
    Object.assign(wrap.style, { display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8125rem" });
    if (descriptor.label) {
      const label = document.createElement("span");
      label.textContent = descriptor.label;
      wrap.appendChild(label);
    }
    field.setAttribute("data-ext-input", descriptor.id);
    Object.assign(field.style, { minHeight: "2.25rem", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid var(--ext-border)", background: "var(--ext-muted)", color: "inherit", font: "inherit", boxSizing: "border-box" });
    inputs.set(descriptor.id, field);
    wrap.appendChild(field);
    return wrap;
  };
  const buildElement = (windowId, descriptor, inputs) => {
    if (descriptor.kind === "heading") {
      const el = document.createElement("h2");
      el.textContent = descriptor.text || "";
      Object.assign(el.style, { margin: "0 0 0.25rem", fontSize: "1rem", fontWeight: "700" });
      return el;
    }
    if (descriptor.kind === "text") {
      const el = document.createElement("p");
      el.textContent = descriptor.text || "";
      Object.assign(el.style, { margin: "0", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word" });
      return el;
    }
    if (descriptor.kind === "pre") {
      const el = document.createElement("pre");
      el.textContent = descriptor.text || "";
      Object.assign(el.style, { margin: "0", padding: "0.5rem", borderRadius: "6px", background: "var(--ext-muted)", overflow: "auto", fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem", lineHeight: "1.4" });
      return el;
    }
    if (descriptor.kind === "spacer") {
      const el = document.createElement("div");
      el.style.height = "0.25rem";
      return el;
    }
    if (descriptor.kind === "input") {
      const field = descriptor.multiline ? document.createElement("textarea") : document.createElement("input");
      if (!descriptor.multiline) field.type = "text";
      if (descriptor.placeholder) field.placeholder = descriptor.placeholder;
      field.value = descriptor.value || "";
      if (descriptor.multiline) field.rows = 4;
      return buildField(descriptor, inputs, field);
    }
    if (descriptor.kind === "select") {
      const field = document.createElement("select");
      for (const option of descriptor.options || []) {
        const optionEl = document.createElement("option");
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        field.appendChild(optionEl);
      }
      field.value = descriptor.value || descriptor.options?.[0]?.value || "";
      return buildField(descriptor, inputs, field);
    }
    if (descriptor.kind === "toggle") {
      const wrap = document.createElement("label");
      Object.assign(wrap.style, { display: "flex", alignItems: "center", gap: "0.6rem", minHeight: "2.25rem", fontSize: "0.8125rem" });
      const field = document.createElement("input");
      field.type = "checkbox";
      field.checked = Boolean(descriptor.checked);
      field.setAttribute("data-ext-input", descriptor.id);
      field.style.accentColor = "var(--ext-accent)";
      inputs.set(descriptor.id, field);
      const label = document.createElement("span");
      label.textContent = descriptor.label || "";
      wrap.appendChild(field);
      wrap.appendChild(label);
      return wrap;
    }
    if (descriptor.kind === "slider") {
      const field = document.createElement("input");
      field.type = "range";
      field.min = String(descriptor.min);
      field.max = String(descriptor.max);
      if (descriptor.step !== undefined) field.step = String(descriptor.step);
      field.value = String(descriptor.value ?? descriptor.min);
      field.style.accentColor = "var(--ext-accent)";
      return buildField(descriptor, inputs, field);
    }
    if (descriptor.kind === "color") {
      const field = document.createElement("input");
      field.type = "color";
      field.value = descriptor.value || "#808080";
      return buildField(descriptor, inputs, field);
    }
    if (descriptor.kind === "button") {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = descriptor.label || descriptor.text || "Button";
      Object.assign(el.style, { alignSelf: "flex-start", padding: "0.4rem 0.85rem", borderRadius: "6px", border: "1px solid var(--ext-accent)", background: "var(--ext-accent)", color: "var(--ext-accent-text)", font: "inherit", fontWeight: "600", cursor: "pointer" });
      el.addEventListener("click", () => {
        worker.postMessage({ type: "ui-event", windowId, elementId: descriptor.id, values: collectValues(windowId) });
      });
      return el;
    }
    return document.createElement("span");
  };
  const renderBody = (entry, elements) => {
    entry.body.textContent = "";
    entry.inputs = new Map();
    for (const descriptor of elements) entry.body.appendChild(buildElement(entry.id, descriptor, entry.inputs));
  };
  const showWindow = (windowId, title, elements) => {
    closeWindowLocally(windowId, false);
    const card = document.createElement("section");
    Object.assign(card.style, { display: "block", width: "100%", boxSizing: "border-box", border: "1px solid var(--ext-border)", background: "var(--ext-surface)", color: "var(--ext-text)", overflow: "hidden" });
    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.5rem 0.5rem 0.5rem 0.85rem", borderBottom: "1px solid var(--ext-border)" });
    const titleEl = document.createElement("strong");
    titleEl.textContent = title || extension.name;
    titleEl.style.fontSize = "0.875rem";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, { border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "1rem", lineHeight: "1", padding: "0.35rem 0.5rem", borderRadius: "6px" });
    closeBtn.addEventListener("click", () => closeWindowLocally(windowId, true));
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    const body = document.createElement("div");
    Object.assign(body.style, { display: "flex", flexDirection: "column", gap: "0.6rem", padding: "0.85rem" });
    card.appendChild(header);
    card.appendChild(body);
    root.appendChild(card);
    const entry = { id: windowId, card, body, titleEl, inputs: new Map() };
    uiWindows.set(windowId, entry);
    renderBody(entry, elements);
    syncVisibility(true);
  };
  const updateWindow = (windowId, title, elements) => {
    const entry = uiWindows.get(windowId);
    if (!entry) return;
    if (typeof title === "string") entry.titleEl.textContent = title;
    if (Array.isArray(elements)) renderBody(entry, elements);
    reportSize();
  };

  let lastHeartbeat = Date.now();
  let stopped = false;
  let messageWindowStartedAt = Date.now();
  let messageCount = 0;
  worker.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "heartbeat") {
      lastHeartbeat = Date.now();
      return;
    }
    if (Date.now() - messageWindowStartedAt > 10_000) {
      messageWindowStartedAt = Date.now();
      messageCount = 0;
    }
    messageCount += 1;
    if (messageCount > 200) {
      stopped = true;
      worker.terminate();
      window.clearInterval(watchdog);
      post({ type: "error", contentHash: extension.contentHash, message: "Browser extension was stopped for exceeding the sandbox message limit" });
      return;
    }
    if (message?.type === "storage") {
      let payloadSize = 0;
      try { payloadSize = new TextEncoder().encode(JSON.stringify(message.payload ?? null)).byteLength; } catch { payloadSize = 1_000_001; }
      if (!["get", "patch", "delete"].includes(message.action) || payloadSize > 1_000_000) {
        worker.postMessage({
          type: "storage-result",
          requestId: message.requestId,
          ok: false,
          error: "Storage request was rejected by the sandbox",
        });
        return;
      }
    }
    if (message?.type === "ui-show") {
      showWindow(message.windowId, message.title, Array.isArray(message.elements) ? message.elements : []);
      return;
    }
    if (message?.type === "ui-update") {
      updateWindow(message.windowId, message.title, message.elements);
      return;
    }
    if (message?.type === "ui-close") {
      closeWindowLocally(message.windowId, false);
      return;
    }
    if (
      message?.type === "ui-contribution-register" ||
      message?.type === "ui-contribution-update"
    ) {
      post({
        type: message.type,
        contentHash: extension.contentHash,
        contribution: message.contribution,
      });
      return;
    }
    if (message?.type === "ui-contribution-remove") {
      post({
        type: message.type,
        contentHash: extension.contentHash,
        contributionId: message.contributionId,
      });
      return;
    }
    if (message?.type === "storage" || message?.type === "log" || message?.type === "ready" || message?.type === "error") {
      post(message);
    }
  });
  worker.addEventListener("error", (event) => {
    post({ type: "error", contentHash: extension.contentHash, message: event.message || "Browser extension worker failed" });
  });
  const watchdog = window.setInterval(() => {
    if (stopped || Date.now() - lastHeartbeat <= 5_000) return;
    stopped = true;
    worker.terminate();
    window.clearInterval(watchdog);
    post({ type: "error", contentHash: extension.contentHash, message: "Browser extension was stopped because its sandbox became unresponsive" });
  }, 1_000);
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.channel !== "marinara-personal-extension") return;
    const message = event.data;
    if (message.type === "storage-result") worker.postMessage(message);
    if (
      message.type === "context-update" &&
      message.contentHash === extension.contentHash &&
      message.context &&
      typeof message.context === "object"
    ) {
      worker.postMessage({ type: "context-update", context: message.context });
    }
    if (message.type === "ui-contribution-activate" || message.type === "ui-contribution-event") {
      worker.postMessage(message);
    }
    if (message.type === "ui-theme" && message.theme && typeof message.theme === "object") {
      // The host forwards Marinara's resolved accent/surface colors so the
      // in-iframe window matches the app; values are only ever used as CSS.
      for (const key of ["accent", "accentText", "surface", "text", "border", "muted"]) {
        if (typeof message.theme[key] === "string" && message.theme[key]) theme[key] = message.theme[key];
      }
      applyThemeVars();
    }
    if (message.type === "ui-dismiss") {
      for (const windowId of [...uiWindows.keys()]) closeWindowLocally(windowId, true);
    }
    if (message.type === "stop") {
      stopped = true;
      window.clearInterval(watchdog);
      for (const windowId of [...uiWindows.keys()]) closeWindowLocally(windowId, false);
      worker.postMessage({ type: "stop" });
      window.setTimeout(() => worker.terminate(), 500);
    }
  });
})();
</script>
</body>
</html>`;
}

export async function personalExtensionsRoutes(app: FastifyInstance) {
  const storage = createPersonalExtensionsStorage(app.db);
  const settings = createPersonalExtensionSettingsStorage(createAppSettingsStorage(app.db));
  const charactersStorage = createCharactersStorage(app.db);
  const chatsStorage = createChatsStorage(app.db);

  app.get("/policy", async () => getPersonalExtensionPolicy(app.db));

  app.patch("/policy/external", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = externalExtensionsPolicyUpdateSchema.parse(req.body);
    if (input.enabled && !(await getPersonalExtensionPolicy(app.db)).externalExtensionsEnvEnabled) {
      return reply.status(409).send({
        error: "External Extensions are locked. Set ENABLE_EXTERNAL_EXTENSIONS=true in .env first.",
      });
    }
    const policy = await setExternalExtensionsEnabled(app.db, input.enabled);
    if (!policy.externalExtensionsEnabled) await storage.disableExternal();
    await personalServerExtensionRuntime.enforceExternalPolicy();
    return policy;
  });

  app.get("/", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const policy = await getPersonalExtensionPolicy(app.db);
    return (await storage.list())
      .filter((extension) => canExecutePersonalExtension(extension, policy))
      .map((extension) => personalServerExtensionRuntime.withRuntimeStatus(extension));
  });

  app.get("/runtime/client", async (): Promise<PersonalClientExtensionRuntime[]> => {
    const policy = await getPersonalExtensionPolicy(app.db);
    const extensions = await storage.list();
    return extensions
      .filter(
        (extension) =>
          extension.runtime === "client" &&
          extension.enabled &&
          extension.approvedHash === extension.contentHash &&
          canExecutePersonalExtension(extension, policy),
      )
      .map((extension) => ({
        id: extension.id,
        name: extension.name,
        description: extension.description,
        capabilities: extension.capabilities,
        contentHash: extension.contentHash,
        executionMode: hasFullPageAccess(extension) ? "full-page" : "sandboxed",
        runtimeUrl: hasFullPageAccess(extension)
          ? `/api/personal-extensions/${encodeURIComponent(extension.id)}/page-runtime.js?hash=${encodeURIComponent(extension.contentHash)}`
          : `/api/personal-extensions/${encodeURIComponent(extension.id)}/sandbox.html?hash=${encodeURIComponent(extension.contentHash)}`,
        styleUrl:
          hasFullPageAccess(extension) && extension.css
            ? `/api/personal-extensions/${encodeURIComponent(extension.id)}/page-style.css?hash=${encodeURIComponent(extension.contentHash)}`
            : null,
      }));
  });

  app.get<{ Params: { id: string }; Querystring: { hash?: string } }>("/:id/sandbox.html", async (req, reply) => {
    if (!ID_PATTERN.test(req.params.id)) return reply.status(404).send("Not Found");
    const policy = await getPersonalExtensionPolicy(app.db);
    const extension = await storage.getById(req.params.id);
    if (
      !extension ||
      extension.runtime !== "client" ||
      !extension.enabled ||
      extension.approvedHash !== extension.contentHash ||
      req.query.hash !== extension.contentHash ||
      hasFullPageAccess(extension) ||
      !canExecutePersonalExtension(extension, policy)
    ) {
      return reply.status(404).send("Not Found");
    }
    const nonce = randomBytes(18).toString("base64");
    reply.type("text/html; charset=utf-8");
    reply.header("Cache-Control", "no-store");
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'nonce-${nonce}'; worker-src blob:; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`,
    );
    return sandboxDocument(extension, nonce);
  });

  const approvedFullPageExtension = async (id: string, hash: string | undefined) => {
    const extension = ID_PATTERN.test(id) ? await storage.getById(id) : null;
    if (
      !extension ||
      extension.runtime !== "client" ||
      !extension.enabled ||
      extension.approvedHash !== extension.contentHash ||
      hash !== extension.contentHash ||
      !hasFullPageAccess(extension) ||
      !isExternalPersonalExtensionSource(extension.source) ||
      !canExecutePersonalExtension(extension, await getPersonalExtensionPolicy(app.db))
    ) {
      return null;
    }
    return extension;
  };

  app.get<{ Params: { id: string }; Querystring: { hash?: string } }>("/:id/page-runtime.js", async (req, reply) => {
    const extension = await approvedFullPageExtension(req.params.id, req.query.hash);
    if (!extension) return reply.status(404).send("Not Found");
    reply.type("application/javascript; charset=utf-8");
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    return fullPageExtensionSource(extension);
  });

  app.get<{ Params: { id: string }; Querystring: { hash?: string } }>("/:id/page-style.css", async (req, reply) => {
    const extension = await approvedFullPageExtension(req.params.id, req.query.hash);
    if (!extension || !extension.css) return reply.status(404).send("Not Found");
    reply.type("text/css; charset=utf-8");
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    return extension.css;
  });

  app.post("/", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const policy = await getPersonalExtensionPolicy(app.db);
    if (!policy.externalExtensionsEnabled) {
      return reply.status(403).send({
        error: "External Extension imports require both ENABLE_EXTERNAL_EXTENSIONS=true and the Danger Zone opt-in.",
      });
    }
    const input = createPersonalExtensionSchema.parse(req.body);
    const existing = await storage.getByName(input.name);
    if (existing) {
      return reply
        .status(409)
        .send({ error: `A Personal Extension named "${input.name}" already exists`, id: existing.id });
    }
    return storage.create(input, { source: "external" });
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    if (!ID_PATTERN.test(req.params.id)) return reply.status(404).send({ error: "Personal Extension not found" });
    const input = updatePersonalExtensionSchema.parse(req.body);
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Personal Extension not found" });
    const updated =
      input.enabled === false ? await storage.disable(req.params.id) : await storage.update(req.params.id, input);
    if (existing.runtime === "server" || updated?.runtime === "server") {
      await personalServerExtensionRuntime.reloadExtension(req.params.id);
    }
    return updated;
  });

  app.post<{ Params: { id: string } }>("/:id/approve", async (req, reply) => {
    if (!privileged(req, reply)) return;
    if (!ID_PATTERN.test(req.params.id)) return reply.status(404).send({ error: "Personal Extension not found" });
    const input = approvePersonalExtensionSchema.parse(req.body);
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Personal Extension not found" });
    const policy = await getPersonalExtensionPolicy(app.db);
    if (isExternalPersonalExtensionSource(existing.source) && !policy.externalExtensionsEnabled) {
      return reply.status(403).send({ error: "External Extensions are locked by the two-step safety gate." });
    }
    if (existing.runtime === "server" && !policy.serverSandboxAvailable) {
      return reply
        .status(503)
        .send({ error: policy.serverSandboxReason ?? "No supported server sandbox is available." });
    }
    if (hasFullPageAccess(existing) && input.acknowledgeFullPageAccess !== true) {
      return reply.status(400).send({ error: "Full page access must be explicitly acknowledged." });
    }
    const approved = await storage.approve(req.params.id, input.contentHash);
    if (!approved) return reply.status(404).send({ error: "Personal Extension not found" });
    if (approved.runtime === "server") await personalServerExtensionRuntime.reloadExtension(approved.id);
    return personalServerExtensionRuntime.withRuntimeStatus(approved);
  });

  app.post<{ Params: { id: string } }>("/:id/rollback", async (req, reply) => {
    if (!privileged(req, reply)) return;
    if (!ID_PATTERN.test(req.params.id)) return reply.status(404).send({ error: "Personal Extension not found" });
    const input = rollbackPersonalExtensionSchema.parse(req.body);
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Personal Extension not found" });
    const rolledBack = await storage.rollback(req.params.id, input.contentHash);
    if (existing.runtime === "server" || rolledBack?.runtime === "server") {
      await personalServerExtensionRuntime.reloadExtension(req.params.id);
    }
    return rolledBack;
  });

  const browserStorageExtension = async (id: string) => {
    const extension = ID_PATTERN.test(id) ? await storage.getById(id) : null;
    if (
      !extension ||
      extension.runtime !== "client" ||
      !extension.enabled ||
      extension.approvedHash !== extension.contentHash ||
      !canExecutePersonalExtension(extension, await getPersonalExtensionPolicy(app.db))
    ) {
      return null;
    }
    return extension;
  };

  app.get<{ Params: { id: string } }>("/:id/storage", async (req, reply) => {
    const extension = await browserStorageExtension(req.params.id);
    if (!extension) return reply.status(404).send({ error: "Personal Extension not found" });
    return { value: await settings.get(extension.id) };
  });

  app.patch<{ Params: { id: string } }>("/:id/storage", async (req, reply) => {
    const extension = await browserStorageExtension(req.params.id);
    if (!extension) return reply.status(404).send({ error: "Personal Extension not found" });
    const patch = personalExtensionStoragePatchSchema.parse(req.body ?? {});
    return { value: await settings.patch(extension.id, patch) };
  });

  app.delete<{ Params: { id: string } }>("/:id/storage", async (req, reply) => {
    const extension = await browserStorageExtension(req.params.id);
    if (!extension) return reply.status(404).send({ error: "Personal Extension not found" });
    await settings.remove(extension.id);
    return { value: {} };
  });

  app.post<{ Params: { id: string }; Body: { chatId?: unknown } }>("/:id/context", async (req, reply) => {
    const extension = await browserStorageExtension(req.params.id);
    if (!extension) return reply.status(404).send({ error: "Personal Extension not found" });
    const chatId = typeof req.body?.chatId === "string" && ID_PATTERN.test(req.body.chatId) ? req.body.chatId : null;
    if (!chatId) return { characters: [], persona: null };
    const chat = await chatsStorage.getById(chatId);
    if (!chat) return { characters: [], persona: null };

    const capabilities = new Set(extension.capabilities);
    const characterIds = parseContextCharacterIds(chat.characterIds);
    const characters = capabilities.has("read_active_characters")
      ? (await charactersStorage.getByIds(characterIds))
          .map((row) => parseContextCharacter(row))
          .filter((character): character is ContextCharacterSource => Boolean(character))
      : [];
    const identity = capabilities.has("read_active_persona")
      ? await resolveChatUserIdentity(charactersStorage, chat)
      : null;
    const persona = identity
      ? {
          id: identity.id,
          name: identity.name,
          description: identity.description,
          personality: identity.personality,
          scenario: identity.scenario,
          backstory: identity.backstory,
          appearance: identity.appearance,
          tags: identity.tags,
          aboutMe: identity.aboutMe,
          convoDisplayName: identity.convoDisplayName,
          source: identity.source,
        }
      : null;
    return createPersonalExtensionRecordContext({
      capabilities: extension.capabilities,
      characters,
      persona,
    });
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    if (!ID_PATTERN.test(req.params.id)) return reply.status(404).send({ error: "Personal Extension not found" });
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Personal Extension not found" });
    await settings.remove(existing.id);
    await storage.remove(existing.id);
    if (existing.runtime === "server") await personalServerExtensionRuntime.unloadExtension(existing.id);
    return reply.status(204).send();
  });
}
