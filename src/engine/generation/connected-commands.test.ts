import { describe, expect, test } from "vitest";
import { persistConnectedCommandTags } from "./connected-commands";

const storage = {} as never;

type HapticGateCase = {
  name: string;
  metadata: Record<string, unknown>;
  shouldExecute: boolean;
};

const hapticGateCases: HapticGateCase[] = [
  {
    name: "character commands disabled, haptic feedback disabled",
    metadata: { characterCommands: false, enableHapticFeedback: false },
    shouldExecute: false,
  },
  {
    name: "character commands enabled, haptic feedback disabled",
    metadata: { characterCommands: true, enableHapticFeedback: false },
    shouldExecute: false,
  },
  {
    name: "character commands disabled, haptic feedback enabled",
    metadata: { characterCommands: false, enableHapticFeedback: true },
    shouldExecute: false,
  },
  {
    name: "character commands enabled, haptic feedback enabled",
    metadata: { characterCommands: true, enableHapticFeedback: true },
    shouldExecute: true,
  },
];

describe("persistConnectedCommandTags", () => {
  test.each(hapticGateCases)("gates haptic commands when $name", async (testCase) => {
    let commandCalls = 0;
    const result = await persistConnectedCommandTags(
      storage,
      { id: "chat-1", mode: "conversation", metadata: testCase.metadata },
      'ok [haptic: action="vibrate", intensity=0.7, duration=2]',
      {
        haptic: {
          status: async <T = unknown>() => ({ connected: true, devices: [] } as T),
          connect: async <T = unknown>() => ({ connected: true, devices: [] } as T),
          command: async <T = unknown>() => {
            commandCalls += 1;
            return { ok: true } as T;
          },
          stopAll: async <T = unknown>() => ({ ok: true } as T),
        },
        spotify: {} as never,
        customTools: {} as never,
        image: {} as never,
      },
    );

    expect(commandCalls > 0).toBe(testCase.shouldExecute);
    expect(result.executedCommands.includes("haptic")).toBe(testCase.shouldExecute);
  });
});
