import { describe, expect, it } from "vitest";
import {
  canStartGameWithConnection,
  GAME_START_CONNECTION_REQUIRED_MESSAGE,
  normalizeGameStartConnectionId,
  RANDOM_CONNECTION_SENTINEL,
} from "./game-start-connection";

describe("game start connection gate", () => {
  it("blocks explicit None or blank GM model selections", () => {
    expect(canStartGameWithConnection(null)).toBe(false);
    expect(canStartGameWithConnection(undefined)).toBe(false);
    expect(canStartGameWithConnection("")).toBe(false);
    expect(canStartGameWithConnection("   ")).toBe(false);
  });

  it("allows selected connections and the existing random sentinel", () => {
    expect(canStartGameWithConnection("conn-1")).toBe(true);
    expect(canStartGameWithConnection(` ${RANDOM_CONNECTION_SENTINEL} `)).toBe(true);
    expect(normalizeGameStartConnectionId(" conn-1 ")).toBe("conn-1");
  });

  it("exposes the user-facing block reason", () => {
    expect(GAME_START_CONNECTION_REQUIRED_MESSAGE).toBe("Choose a GM / Party Model before starting the game.");
  });
});
