import { describe, expect, it } from "vitest";
import {
  activeLorebookScopeReasonLabels,
  resolveActiveLorebookScopeReason,
  resolveActiveLorebookScopeReasons,
} from "./active-lorebook-scope";

describe("active lorebook scope", () => {
  it("resolves all active reasons from the shared scope contract", () => {
    const reasons = resolveActiveLorebookScopeReasons(
      {
        id: "book",
        name: "Scope Book",
        enabled: true,
        isGlobal: true,
        characterIds: ["char-1", "other-char"],
        personaIds: ["persona-1"],
        chatId: "chat-1",
      },
      {
        chat: {
          id: "chat-1",
          mode: "roleplay",
          personaId: "persona-1",
          metadata: { activeLorebookIds: ["book"] },
        },
        characters: [{ id: "char-1" }],
        persona: { id: "persona-1" },
      },
    );

    expect(reasons.map((reason) => reason.reason)).toEqual([
      "global",
      "character",
      "persona",
      "chat",
      "selected",
    ]);
    expect(activeLorebookScopeReasonLabels(reasons)).toEqual(["Global", "Character", "Persona", "Chat"]);
  });

  it("keeps scanner primary reason order stable", () => {
    const reason = resolveActiveLorebookScopeReason(
      {
        id: "book",
        enabled: true,
        isGlobal: true,
        characterIds: ["char-1"],
      },
      {
        chat: { id: "chat-1", mode: "roleplay" },
        characters: [{ id: "char-1" }],
        persona: null,
      },
    );

    expect(reason?.reason).toBe("global");
  });

  it("uses persona context id when chat persona id is unavailable", () => {
    const reasons = resolveActiveLorebookScopeReasons(
      {
        id: "book",
        enabled: true,
        personaIds: ["persona-from-context"],
      },
      {
        chat: { id: "chat-1", mode: "roleplay" },
        characters: [],
        persona: { id: "persona-from-context" },
      },
    );

    expect(reasons).toMatchObject([
      {
        reason: "persona",
        matchedIds: ["persona-from-context"],
      },
    ]);
  });

  it("excludes disabled Game Lorebook Keeper books in game scope", () => {
    const disabledKeeperContext = {
      chat: {
        id: "game-chat",
        mode: "game",
        metadata: {
          gameLorebookKeeperEnabled: false,
          gameLorebookKeeperLorebookId: "keeper-book",
        },
      },
      characters: [],
      persona: null,
    };

    expect(
      resolveActiveLorebookScopeReasons(
        { id: "keeper-book", enabled: true, isGlobal: true },
        disabledKeeperContext,
      ),
    ).toEqual([]);
    expect(
      resolveActiveLorebookScopeReasons(
        {
          id: "source-book",
          enabled: true,
          isGlobal: true,
          sourceAgentId: "game-lorebook-keeper",
        },
        disabledKeeperContext,
      ),
    ).toEqual([]);
    expect(
      resolveActiveLorebookScopeReasons(
        {
          id: "source-book",
          enabled: true,
          isGlobal: true,
          sourceAgentId: "game-lorebook-keeper",
        },
        {
          ...disabledKeeperContext,
          chat: {
            ...disabledKeeperContext.chat,
            metadata: { gameLorebookKeeperEnabled: true },
          },
        },
      ).map((reason) => reason.reason),
    ).toEqual(["global"]);
  });
});
