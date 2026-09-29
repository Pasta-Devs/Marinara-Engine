export interface MultiplayerAutonomousRequest {
  chatId: string;
  characterId: string;
  autonomousIntentKey: string;
  userTimeZone: string;
}

/** The live host coordinator checks room, AI membership and its generation lock. */
export interface MultiplayerAutonomyService {
  autonomousEnabled(chatId: string): Promise<boolean>;
  generateAutonomous(input: MultiplayerAutonomousRequest): Promise<boolean>;
}

export interface MultiplayerAutonomy {
  canGenerate(chatId: string): Promise<boolean>;
  generate(input: MultiplayerAutonomousRequest): Promise<boolean>;
}

/** Reuse the existing conversation scheduler; never create a second room timer. */
export function createMultiplayerAutonomyAdapter(
  current: () => MultiplayerAutonomyService | undefined,
): MultiplayerAutonomy {
  return {
    async canGenerate(chatId) {
      return (await current()?.autonomousEnabled(chatId)) ?? false;
    },
    async generate(input) {
      const service = current();
      // Busy delays outlive room membership and Stop Hosting. Recheck immediately
      // before dispatch; the coordinator checks again while taking its lock.
      if (!service || !(await service.autonomousEnabled(input.chatId))) return false;
      return service.generateAutonomous(input);
    },
  };
}
