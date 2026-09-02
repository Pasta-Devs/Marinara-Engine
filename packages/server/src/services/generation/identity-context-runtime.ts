import type { AgentContext } from "@marinara-engine/shared";

export function resolveIdentityCharacterScopes(
  promptCharacterIds: string[],
  identity: { id: string | null; source: "persona" | "character" | null },
): { promptCharacterIds: string[]; lorebookCharacterIds: string[] } {
  const lorebookCharacterIds =
    identity.source === "character" && identity.id && !promptCharacterIds.includes(identity.id)
      ? [...promptCharacterIds, identity.id]
      : promptCharacterIds;
  return { promptCharacterIds, lorebookCharacterIds };
}

export function buildRetryAgentPersona(
  identity: {
    identityId: string | null;
    name: string;
    description: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
    personaStats?: NonNullable<AgentContext["persona"]>["personaStats"];
    rpgStats?: NonNullable<AgentContext["persona"]>["rpgStats"];
  },
  resolveText: (value?: string) => string | undefined,
): AgentContext["persona"] {
  if (identity.identityId === null) return null;
  return {
    name: identity.name,
    description: resolveText(identity.description) ?? "",
    personality: resolveText(identity.personality) || undefined,
    backstory: resolveText(identity.backstory) || undefined,
    appearance: resolveText(identity.appearance) || undefined,
    scenario: resolveText(identity.scenario) || undefined,
    ...(identity.personaStats ? { personaStats: identity.personaStats } : {}),
    ...(identity.rpgStats ? { rpgStats: identity.rpgStats } : {}),
  };
}
