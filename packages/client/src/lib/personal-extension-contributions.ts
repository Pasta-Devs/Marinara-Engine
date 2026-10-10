import { useMemo, useSyncExternalStore } from "react";
import {
  PERSONAL_EXTENSION_CONTRIBUTION_KINDS,
  PERSONAL_EXTENSION_CONTRIBUTION_POSITIONS,
  PERSONAL_EXTENSION_CONTRIBUTION_SURFACES,
  PERSONAL_EXTENSION_UI_ELEMENT_KINDS,
  PERSONAL_EXTENSION_UI_LIMITS,
  personalExtensionCommandContributionSchema,
  type PersonalClientExtensionRuntime,
  type PersonalExtensionContributionDescriptor,
  type PersonalExtensionHostContribution,
  type PersonalExtensionUiElement,
} from "@marinara-engine/shared";
import { useUIStore } from "../stores/ui.store";
import type { CommandDefinition } from "./command-center";

type ContributionSnapshot = {
  contributions: readonly PersonalExtensionHostContribution[];
  activePanelKey: string | null;
};

type ContributionDispatcher = {
  contentHash: string;
  send: (message: Record<string, unknown>) => void;
};

type InternalContribution = PersonalExtensionHostContribution & {
  order: number;
};

const CONTRIBUTION_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const CONTRIBUTION_ICON_PATTERN = /^[a-z0-9-]+$/;
const contributionKinds = new Set<string>(PERSONAL_EXTENSION_CONTRIBUTION_KINDS);
const contributionSurfaces = new Set<string>(PERSONAL_EXTENSION_CONTRIBUTION_SURFACES);
const contributionPositions = new Set<string>(PERSONAL_EXTENSION_CONTRIBUTION_POSITIONS);
const uiElementKinds = new Set<string>(PERSONAL_EXTENSION_UI_ELEMENT_KINDS);
const listeners = new Set<() => void>();
const dispatchers = new Map<string, ContributionDispatcher>();
let contributions: InternalContribution[] = [];
let activePanelKey: string | null = null;
let nextOrder = 0;
let snapshot: ContributionSnapshot = { contributions, activePanelKey };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number, options: { required?: boolean; trim?: boolean } = {}) {
  if (value === undefined && !options.required) return undefined;
  if (typeof value !== "string") return null;
  const normalized = options.trim ? value.trim() : value;
  if ((options.required && !normalized) || normalized.length > maxLength) return null;
  return normalized;
}

function boundedId(value: unknown) {
  const id = boundedString(value, PERSONAL_EXTENSION_UI_LIMITS.idLength, { required: true, trim: true });
  return id && CONTRIBUTION_ID_PATTERN.test(id) ? id : null;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeUiElement(value: unknown): PersonalExtensionUiElement | null {
  if (!isRecord(value) || typeof value.kind !== "string" || !uiElementKinds.has(value.kind)) return null;
  if (value.kind === "spacer") return { kind: "spacer" };
  if (value.kind === "heading" || value.kind === "text" || value.kind === "pre") {
    const text = boundedString(value.text, PERSONAL_EXTENSION_UI_LIMITS.textLength, { required: true });
    return text === null || text === undefined ? null : { kind: value.kind, text };
  }
  if (value.kind === "button") {
    const id = boundedId(value.id);
    const label = boundedString(value.label ?? value.text, PERSONAL_EXTENSION_UI_LIMITS.labelLength, {
      required: true,
      trim: true,
    });
    return id && label ? { kind: "button", id, label } : null;
  }

  const id = boundedId(value.id);
  if (!id) return null;
  if (value.kind === "select") {
    if (!Array.isArray(value.options) || value.options.length > PERSONAL_EXTENSION_UI_LIMITS.selectOptions) return null;
    const options: Array<{ value: string; label: string }> = [];
    const optionValues = new Set<string>();
    for (const rawOption of value.options) {
      if (!isRecord(rawOption)) return null;
      const optionValue = boundedString(rawOption.value, PERSONAL_EXTENSION_UI_LIMITS.labelLength, {
        required: true,
      });
      const optionLabel = boundedString(rawOption.label, PERSONAL_EXTENSION_UI_LIMITS.labelLength, {
        required: true,
        trim: true,
      });
      if (!optionValue || !optionLabel || optionValues.has(optionValue)) return null;
      optionValues.add(optionValue);
      options.push({ value: optionValue, label: optionLabel });
    }
    const label = boundedString(value.label, PERSONAL_EXTENSION_UI_LIMITS.labelLength, { trim: true });
    const selectedValue = boundedString(value.value, PERSONAL_EXTENSION_UI_LIMITS.labelLength);
    if (label === null || selectedValue === null || (selectedValue !== undefined && !optionValues.has(selectedValue))) {
      return null;
    }
    return {
      kind: "select",
      id,
      options,
      ...(label === undefined ? {} : { label }),
      ...(selectedValue === undefined ? {} : { value: selectedValue }),
    };
  }
  if (value.kind === "toggle") {
    const label = boundedString(value.label, PERSONAL_EXTENSION_UI_LIMITS.labelLength, {
      required: true,
      trim: true,
    });
    return label ? { kind: "toggle", id, label, checked: Boolean(value.checked) } : null;
  }
  if (value.kind === "slider") {
    const min = finiteNumber(value.min);
    const max = finiteNumber(value.max);
    const step = value.step === undefined ? undefined : finiteNumber(value.step);
    const sliderValue = value.value === undefined ? undefined : finiteNumber(value.value);
    const label = boundedString(value.label, PERSONAL_EXTENSION_UI_LIMITS.labelLength, { trim: true });
    if (
      min === null ||
      max === null ||
      min >= max ||
      step === null ||
      (step !== undefined && step <= 0) ||
      sliderValue === null ||
      label === null
    ) {
      return null;
    }
    return {
      kind: "slider",
      id,
      min,
      max,
      ...(step === undefined ? {} : { step }),
      ...(sliderValue === undefined ? {} : { value: Math.max(min, Math.min(max, sliderValue)) }),
      ...(label === undefined ? {} : { label }),
    };
  }
  if (value.kind === "color") {
    const label = boundedString(value.label, PERSONAL_EXTENSION_UI_LIMITS.labelLength, { trim: true });
    const colorValue = value.value === undefined ? undefined : boundedString(value.value, 7);
    if (label === null || colorValue === null || (colorValue !== undefined && !/^#[a-f0-9]{6}$/iu.test(colorValue))) {
      return null;
    }
    return {
      kind: "color",
      id,
      ...(label === undefined ? {} : { label }),
      ...(colorValue === undefined ? {} : { value: colorValue }),
    };
  }

  const label = boundedString(value.label, PERSONAL_EXTENSION_UI_LIMITS.labelLength, { trim: true });
  const placeholder = boundedString(value.placeholder, PERSONAL_EXTENSION_UI_LIMITS.descriptionLength);
  const inputValue = boundedString(value.value, PERSONAL_EXTENSION_UI_LIMITS.textLength);
  if (label === null || placeholder === null || inputValue === null) return null;
  return {
    kind: "input",
    id,
    ...(label === undefined ? {} : { label }),
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(inputValue === undefined ? {} : { value: inputValue }),
    multiline: Boolean(value.multiline),
  };
}

function uiElementTextLength(element: PersonalExtensionUiElement) {
  if (element.kind === "spacer") return 0;
  if (element.kind === "heading" || element.kind === "text" || element.kind === "pre") return element.text.length;
  if (element.kind === "button") return element.id.length + element.label.length;
  if (element.kind === "select") {
    return (
      element.id.length +
      (element.label?.length ?? 0) +
      (element.value?.length ?? 0) +
      element.options.reduce((total, option) => total + option.value.length + option.label.length, 0)
    );
  }
  if (element.kind === "toggle") return element.id.length + element.label.length;
  if (element.kind === "slider" || element.kind === "color") {
    return element.id.length + (element.label?.length ?? 0);
  }
  if (element.kind === "input") {
    return (
      element.id.length +
      (element.label?.length ?? 0) +
      (element.placeholder?.length ?? 0) +
      (element.value?.length ?? 0)
    );
  }
  return 0;
}

export function normalizePersonalExtensionContribution(value: unknown): PersonalExtensionContributionDescriptor | null {
  if (!isRecord(value)) return null;
  if (value.kind === "command") {
    const parsed = personalExtensionCommandContributionSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  const id = boundedId(value.id);
  const kind = typeof value.kind === "string" && contributionKinds.has(value.kind) ? value.kind : null;
  const label = boundedString(value.label, PERSONAL_EXTENSION_UI_LIMITS.labelLength, {
    required: true,
    trim: true,
  });
  const description = boundedString(value.description, PERSONAL_EXTENSION_UI_LIMITS.descriptionLength, { trim: true });
  const icon =
    value.icon === undefined
      ? undefined
      : typeof value.icon === "string" &&
          value.icon.length <= PERSONAL_EXTENSION_UI_LIMITS.iconLength &&
          CONTRIBUTION_ICON_PATTERN.test(value.icon)
        ? value.icon
        : null;
  if (!id || !kind || !label || description === null || icon === null) return null;

  let surface: PersonalExtensionContributionDescriptor["surface"];
  let position: PersonalExtensionContributionDescriptor["position"];
  if (kind === "button") {
    const requestedSurface = value.surface ?? "top-bar";
    if (typeof requestedSurface !== "string" || !contributionSurfaces.has(requestedSurface)) return null;
    surface = requestedSurface as NonNullable<PersonalExtensionContributionDescriptor["surface"]>;
    if (surface === "top-bar") {
      if (value.position !== undefined) return null;
    } else {
      const requestedPosition = value.position ?? "header";
      if (typeof requestedPosition !== "string" || !contributionPositions.has(requestedPosition)) return null;
      position = requestedPosition as NonNullable<PersonalExtensionContributionDescriptor["position"]>;
    }
  } else if (value.surface !== undefined || value.position !== undefined) {
    return null;
  }

  let elements: PersonalExtensionUiElement[] | undefined;
  if (kind === "panel") {
    if (value.elements !== undefined && !Array.isArray(value.elements)) return null;
    const rawElements = Array.isArray(value.elements) ? value.elements : [];
    if (rawElements.length > PERSONAL_EXTENSION_UI_LIMITS.panelElements) return null;
    elements = [];
    const interactiveIds = new Set<string>();
    let totalTextLength = 0;
    for (const rawElement of rawElements) {
      const element = normalizeUiElement(rawElement);
      if (!element) return null;
      if (
        element.kind === "button" ||
        element.kind === "input" ||
        element.kind === "select" ||
        element.kind === "toggle" ||
        element.kind === "slider" ||
        element.kind === "color"
      ) {
        if (interactiveIds.has(element.id)) return null;
        interactiveIds.add(element.id);
      }
      totalTextLength += uiElementTextLength(element);
      if (totalTextLength > PERSONAL_EXTENSION_UI_LIMITS.totalPanelTextLength) return null;
      elements.push(element);
    }
  } else if (value.elements !== undefined) {
    return null;
  }
  if (value.targetContributionId !== undefined) return null;
  if (kind === "command") return null;

  return {
    id,
    kind: kind as PersonalExtensionContributionDescriptor["kind"],
    label,
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    ...(surface ? { surface } : {}),
    ...(position ? { position } : {}),
    ...(elements ? { elements } : {}),
  } as unknown as PersonalExtensionContributionDescriptor;
}

function publish() {
  snapshot = {
    contributions: contributions.map(({ order: _order, ...contribution }) => contribution),
    activePanelKey,
  };
  for (const listener of listeners) listener();
}

function contributionKey(extensionId: string, contributionId: string) {
  return `${extensionId}:${contributionId}`;
}

function commandId(key: string) {
  return `personal-extension:${key}`;
}

export function registerPersonalExtensionContribution(
  extension: PersonalClientExtensionRuntime,
  value: unknown,
): boolean {
  const descriptor = normalizePersonalExtensionContribution(value);
  if (!descriptor) return false;
  const key = contributionKey(extension.id, descriptor.id);
  const existing = contributions.find((contribution) => contribution.key === key);
  const extensionContributionCount = contributions.filter(
    (contribution) => contribution.extensionId === extension.id,
  ).length;
  if (!existing && extensionContributionCount >= PERSONAL_EXTENSION_UI_LIMITS.contributionsPerExtension) return false;

  const next: InternalContribution = {
    ...descriptor,
    key,
    extensionId: extension.id,
    extensionName: extension.name,
    contentHash: extension.contentHash,
    order: existing?.order ?? nextOrder++,
  };
  contributions = existing
    ? contributions.map((contribution) => (contribution.key === key ? next : contribution))
    : [...contributions, next];
  contributions.sort((left, right) => left.order - right.order);
  publish();
  return true;
}

export function removePersonalExtensionContribution(extensionId: string, contentHash: string, contributionId: unknown) {
  const id = boundedId(contributionId);
  if (!id) return;
  const key = contributionKey(extensionId, id);
  const before = contributions.length;
  contributions = contributions.filter(
    (contribution) => contribution.key !== key || contribution.contentHash !== contentHash,
  );
  if (contributions.length === before) return;
  if (activePanelKey === key) activePanelKey = null;
  publish();
}

export function removePersonalExtensionContributions(extensionId: string) {
  const before = contributions.length;
  contributions = contributions.filter((contribution) => contribution.extensionId !== extensionId);
  dispatchers.delete(extensionId);
  if (activePanelKey && !contributions.some((contribution) => contribution.key === activePanelKey)) {
    activePanelKey = null;
  }
  if (contributions.length !== before || snapshot.activePanelKey !== activePanelKey) publish();
}

export function setPersonalExtensionContributionDispatcher(
  extension: PersonalClientExtensionRuntime,
  send: (message: Record<string, unknown>) => void,
) {
  dispatchers.set(extension.id, { contentHash: extension.contentHash, send });
}

function sendToContribution(
  contribution: PersonalExtensionHostContribution,
  message: Record<string, unknown>,
): boolean {
  const dispatcher = dispatchers.get(contribution.extensionId);
  if (!dispatcher || dispatcher.contentHash !== contribution.contentHash) return false;
  dispatcher.send(message);
  return true;
}

export function activatePersonalExtensionContribution(key: string) {
  const contribution = contributions.find((candidate) => candidate.key === key);
  if (!contribution) return false;
  return sendToContribution(contribution, {
    type: "ui-contribution-activate",
    contributionId: contribution.id,
  });
}

const warnedMissingCommandTargets = new Set<string>();

export function resolvePersonalExtensionCommand(key: string): PersonalExtensionHostContribution | null {
  const command = contributions.find((candidate) => candidate.key === key && candidate.kind === "command");
  if (!command || command.kind !== "command" || !command.targetContributionId) return null;
  const target =
    contributions.find(
      (candidate) =>
        candidate.extensionId === command.extensionId &&
        candidate.contentHash === command.contentHash &&
        candidate.id === command.targetContributionId &&
        candidate.kind !== "command",
    ) ?? null;
  // Targets register incrementally, so this cannot be validated at registration time.
  // Warn instead, otherwise the command just silently never appears. Once per command:
  // every snapshot resolves it again while it waits for its target.
  if (!target && !warnedMissingCommandTargets.has(key)) {
    warnedMissingCommandTargets.add(key);
    console.warn(
      `Personal extension "${command.extensionId}": command "${command.id}" targets "${command.targetContributionId}", which is not a registered non-command contribution.`,
    );
  }
  return target;
}

export function collectPersonalExtensionCommands(): CommandDefinition[] {
  return contributions.flatMap((contribution) => {
    if (contribution.kind !== "command" || !resolvePersonalExtensionCommand(contribution.key)) return [];
    return [
      {
        id: commandId(contribution.key),
        title: contribution.label,
        kind: "action" as const,
        icon: "extensions" as const,
        aliases: [contribution.extensionName, ...(contribution.description ? [contribution.description] : [])],
      },
    ];
  });
}

export function activatePersonalExtensionCommand(id: string): boolean {
  const command = contributions.find((candidate) => candidate.kind === "command" && commandId(candidate.key) === id);
  if (!command) return false;
  const target = resolvePersonalExtensionCommand(command.key);
  if (!target) return false;
  if (target.kind !== "panel") return activatePersonalExtensionContribution(target.key);
  if (!openPersonalExtensionPanel(target.key)) return false;
  useUIStore.getState().openRightPanel("extensions");
  return true;
}

export function openPersonalExtensionPanel(key: string) {
  const contribution = contributions.find((candidate) => candidate.key === key && candidate.kind === "panel");
  if (!contribution) return false;
  activePanelKey = contribution.key;
  publish();
  return sendToContribution(contribution, {
    type: "ui-contribution-activate",
    contributionId: contribution.id,
  });
}

export function dispatchPersonalExtensionContributionEvent(
  key: string,
  elementId: string,
  values: Record<string, string>,
) {
  const contribution = contributions.find((candidate) => candidate.key === key && candidate.kind === "panel");
  if (!contribution) return false;
  return sendToContribution(contribution, {
    type: "ui-contribution-event",
    contributionId: contribution.id,
    elementId,
    values,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function usePersonalExtensionContributions() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePersonalExtensionCommands() {
  // collectPersonalExtensionCommands reads module state, so the snapshot is the
  // cache key rather than an argument. Without it every render returns new
  // command identities and re-ranks the omnibar.
  const contributions = usePersonalExtensionContributions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => collectPersonalExtensionCommands(), [contributions]);
}
