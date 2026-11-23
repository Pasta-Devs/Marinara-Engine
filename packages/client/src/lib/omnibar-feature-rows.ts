/**
 * Ctrl+K's Feature group: when the search uses a word from the feature finder ("chat preset",
 * "world info", "how do I see the prompt"), a row names the Marinara feature and opens its guide,
 * and rows under it do the thing. Only the best match gets action rows; a second match gets its
 * name row, so a vague word never fills the list.
 */
import { matchFeatures, type FeatureAction, type FeatureStep } from "./feature-finder";
import type { OmnibarTranslate } from "./omnibar-entity-rows";
import type { OmnibarResult } from "./omnibar-search";

const MAX_FEATURES = 2;
export const FEATURE_ROW_SCORE = 900;

function stepRow(step: FeatureStep, activeChatId: string | null): Partial<OmnibarResult> | null {
  switch (step.kind) {
    case "docs":
      return {
        category: "docs",
        action: { kind: "open-docs", path: step.path },
        kind: "resource",
        icon: "documentation",
      };
    case "start-chat":
      return {
        category: "navigation",
        action: { kind: "start-chat", mode: step.mode, profile: step.profile },
        kind: "action",
        icon: "chats",
      };
    case "target":
      return { category: "navigation", target: step.target, kind: "navigation", icon: "command" };
    case "chat-tool":
      return activeChatId
        ? {
            category: "navigation",
            action: { kind: "open-chat-tool", chatId: activeChatId, tool: step.tool },
            kind: "action",
            icon: "chats",
          }
        : null;
  }
}

export function buildOmnibarFeatureResults({
  query,
  activeChatId,
  t,
}: {
  query: string;
  activeChatId: string | null;
  t: OmnibarTranslate;
}): OmnibarResult[] {
  const matches = matchFeatures(query).slice(0, MAX_FEATURES);
  const rows: OmnibarResult[] = [];
  matches.forEach((match, matchIndex) => {
    const { feature } = match;
    const base = FEATURE_ROW_SCORE - matchIndex * 10;
    // A feature that is a place in the app (Connections, Lorebooks) opens that place on Enter, and its guide
    // becomes a row of its own: typing a page's name and pressing Enter opened a docs article (QC Nov 21 IA14).
    const pageAction = feature.actions.find((action) => action.step.kind === "target");
    const pageTarget = pageAction?.step.kind === "target" ? pageAction.step.target : undefined;
    rows.push({
      id: `feature:${feature.id}`,
      title: t(feature.nameKey, feature.name),
      description: t(feature.summaryKey, feature.summary),
      badge: match.fromSillyTavern
        ? t("featureFinder.sillyTavernBadge", "SillyTavern: {{term}}", { term: match.term })
        : undefined,
      category: "docs",
      group: "features",
      score: base,
      matchKind: "literal",
      ...(pageTarget
        ? { category: "navigation" as const, target: pageTarget, kind: "navigation" as const, icon: "command" as const }
        : {
            action: { kind: "open-docs" as const, path: feature.guide },
            kind: "resource" as const,
            icon: "documentation" as const,
          }),
    });
    if (matchIndex > 0) return;
    const actions: readonly FeatureAction[] = pageAction
      ? [
          ...feature.actions.filter((action) => action !== pageAction),
          {
            id: "guide",
            labelKey: "featureFinder.readGuide",
            label: "Read the guide",
            step: { kind: "docs", path: feature.guide },
          },
        ]
      : feature.actions;
    actions.forEach((action, actionIndex) => {
      const row = stepRow(action.step, activeChatId);
      if (!row) return;
      rows.push({
        ...row,
        id: `feature:${feature.id}:${action.id}`,
        title: t(action.labelKey, action.label),
        group: "features",
        score: base - 1 - actionIndex,
        matchKind: "literal",
      } as OmnibarResult);
    });
  });
  return rows;
}
