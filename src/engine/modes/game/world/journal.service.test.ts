import { describe, expect, it } from "vitest";

import type { GameNpc } from "../../../contracts/types/game";
import type { PlayerStats } from "../../../contracts/types/game-state";
import {
  applyJournalEntry,
  buildStructuredRecap,
  createJournal,
  syncJournalFromGameState,
} from "./journal.service";

describe("game journal service", () => {
  it("routes NPC and quest journal commands into structured journal logs", () => {
    const npc: GameNpc = {
      id: "npc-elira",
      name: "Elira",
      emoji: "E",
      description: "A careful archivist.",
      location: "Archive",
      reputation: 12,
      met: true,
      notes: [],
    };

    const withNpc = applyJournalEntry(createJournal(), "npc", {
      npc,
      interaction: "Shared the moon-key clue.",
    });
    const withQuest = applyJournalEntry(withNpc, "quest", {
      quest: {
        id: "moon-key",
        name: "Find the Moon Key",
        status: "active",
        description: "Ask Elira about the archive vault.",
        objectives: ["Speak to Elira"],
      },
    });

    expect(withQuest.npcLog).toEqual([{ npcName: "Elira", interactions: ["Shared the moon-key clue."] }]);
    expect(withQuest.quests).toMatchObject([
      {
        id: "moon-key",
        name: "Find the Moon Key",
        status: "active",
        description: "Ask Elira about the archive vault.",
        objectives: ["Speak to Elira"],
      },
    ]);
    expect(withQuest.entries.map((entry) => entry.type)).toEqual(["npc", "quest"]);
  });

  it("preserves location and item journal command payload fields", () => {
    const withLocation = applyJournalEntry(createJournal(), "location", {
      location: "Moonlit Archive",
      description: "The party entered the archive.",
    });
    const withItem = applyJournalEntry(withLocation, "item", {
      item: "Moon Key",
      action: "acquired",
      quantity: 1,
    });

    expect(withItem.locations).toEqual(["Moonlit Archive"]);
    expect(withItem.inventoryLog).toMatchObject([{ item: "Moon Key", action: "acquired", quantity: 1 }]);
    expect(withItem.entries.map((entry) => entry.title)).toEqual(["Discovered: Moonlit Archive", "Found: Moon Key"]);
  });

  it("syncs tracked NPCs and active player quests into deterministic recaps", () => {
    const playerStats: PlayerStats = {
      stats: [],
      attributes: null,
      skills: {},
      inventory: [],
      activeQuests: [
        {
          questEntryId: "moon-key",
          name: "Find the Moon Key",
          currentStage: 1,
          completed: false,
          objectives: [
            { objectiveId: "speak", text: "Speak to Elira", completed: true },
            { objectiveId: "vault", text: "Open the archive vault", completed: false },
          ],
        },
      ],
      status: "",
    };
    const npc: GameNpc = {
      id: "npc-elira",
      name: "Elira",
      emoji: "E",
      description: "A careful archivist.",
      location: "Archive",
      reputation: 12,
      met: true,
      notes: [],
    };

    const journal = syncJournalFromGameState(createJournal(), {
      gameNpcs: [npc],
      playerStats,
    });
    const recap = buildStructuredRecap(journal, 2);

    expect(journal.npcLog).toEqual([{ npcName: "Elira", interactions: ["Tracked at Archive."] }]);
    expect(journal.quests).toMatchObject([
      {
        id: "moon-key",
        name: "Find the Moon Key",
        status: "active",
        description: "Open the archive vault",
        objectives: ["[Done] Speak to Elira", "Open the archive vault"],
      },
    ]);
    expect(recap).toContain("Active quests: Find the Moon Key");
    expect(recap).toContain("Key NPC interactions:");
    expect(recap).toContain("Elira: Tracked at Archive.");
  });
});
