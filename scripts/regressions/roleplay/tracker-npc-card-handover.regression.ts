// #9556: a character card that joins the chat later takes over the NPC row the Character Tracker kept for that
// person. Before, a locked NPC row stayed behind next to the card row, its locks and hidden fields stayed on the NPC
// id, and a shorter name ("Mara" for "Mara Vex") never linked to the card even when the card lists it as an Other
// name. These cases run the tracker steps in the order the Character Tracker effect runs them.
import assert from "node:assert/strict";
import {
  applyTrackerFieldLocksToGameStatePatch,
  characterTrackerLockKey,
  type GameState,
} from "../../../packages/shared/src/index.js";
import {
  applyTrackerCharacterCardIdentity,
  assignTrackerCharacterIds,
  handOverTrackerNpcsToCards,
  preserveTrackerCharacterUiFields,
  resolveTrackerGroupUpdate,
} from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import { runNamedCases } from "../fixtures/named-cases.js";

type Row = Record<string, unknown>;
type Card = { id: string; name: string; avatarPath?: string | null; nameAliases?: string[]; description?: string };

const mara: Card = { id: "card-mara", name: "Mara Vex", avatarPath: "/api/avatars/mara.png" };
const maraWithAlias: Card = { ...mara, nameAliases: ["Mara"] };
const storedMara: Row = {
  characterId: "npc-abc",
  name: "Mara Vex",
  mood: "calm",
  outfit: "red coat",
  avatarPath: "/api/avatars/npc/mara.png",
  portraitZoom: 2,
};
const lockKey = (id: string, field: "outfit" | "mood" | "thoughts") =>
  characterTrackerLockKey({ characterId: id }, 0, field);

let minted = 0;
const mintTestId = () => `npc-test${++minted}`;

/** One tracker result applied like the Character Tracker effect applies it. */
function applyTurn(
  reported: unknown,
  stored: Row[],
  cards: Card[],
  options: { fieldLocks?: Record<string, boolean>; hidden?: Record<string, boolean>; history?: Row[] } = {},
) {
  const handover = handOverTrackerNpcsToCards({
    previousCharacters: stored,
    history: options.history ?? [],
    fieldLocks: options.fieldLocks,
    hiddenFields: options.hidden,
    cards,
  });
  const previous = handover.previousCharacters;
  const lockState = {
    presentCharacters: previous,
    fieldLocks: handover.fieldLocks,
    hiddenTrackerFields: handover.hiddenFields,
  } as unknown as GameState;
  const characters = structuredClone(
    (resolveTrackerGroupUpdate(reported, previous, lockState, "presentCharacters") ?? previous) as Row[],
  );
  applyTrackerCharacterCardIdentity(characters, cards, { previousCharacters: [...previous, ...handover.history] });
  assignTrackerCharacterIds(characters, {
    previousCharacters: previous,
    history: handover.history,
    cardIds: cards.map((card) => card.id),
    mintId: mintTestId,
  });
  preserveTrackerCharacterUiFields(characters, previous);
  preserveTrackerCharacterUiFields(characters, handover.history);
  const rows = applyTrackerFieldLocksToGameStatePatch({ presentCharacters: characters }, lockState)
    .presentCharacters as Row[];
  return { rows, handover };
}

const idsOf = (rows: Row[]) => rows.map((row) => row.characterId);

await runNamedCases([
  {
    name: "a card's Other name links a shorter tracker name to the card; without it the row stays an NPC",
    run: () => {
      const linked = applyTurn([{ characterId: "npc-abc", name: "Mara", mood: "grim" }], [], [maraWithAlias]).rows;
      assert.deepEqual(idsOf(linked), ["card-mara"]);
      assert.equal(linked[0]!.name, "Mara Vex");
      const unlinked = applyTurn([{ characterId: "npc-xyz", name: "Mara", mood: "grim" }], [], [mara]).rows;
      assert.ok(String(unlinked[0]!.characterId).startsWith("npc-test"));
    },
  },
  {
    name: "an Other name two cards share, or one that is another card's name, links to neither by alias",
    run: () => {
      const twin: Card = { id: "card-twin", name: "Mara Twin", nameAliases: ["Mara"] };
      const shared = applyTurn([{ characterId: "npc-1", name: "Mara" }], [], [maraWithAlias, twin]).rows;
      assert.ok(String(shared[0]!.characterId).startsWith("npc-test"));
      const vex: Card = { id: "card-vex", name: "Vex" };
      const named = applyTurn([{ name: "Vex" }], [], [{ ...mara, nameAliases: ["Vex"] }, vex]).rows;
      assert.deepEqual(idsOf(named), ["card-vex"]);
    },
  },
  {
    name: "an Other name on a card with a cast reaches the card itself, not a cast member",
    run: () => {
      const castCard: Card = {
        id: "card-flagon",
        name: "The Gilded Flagon",
        nameAliases: ["Flagon"],
        description: "[CHARACTER: Ana Voss] a barmaid. [CHARACTER: Bram Holt] the cook.",
      };
      const rows = applyTurn([{ name: "Flagon", mood: "busy" }], [], [castCard]).rows;
      assert.deepEqual(idsOf(rows), ["card-flagon"]);
    },
  },
  {
    name: "a locked NPC row hands over to the card: one row, the locked value, the lock under the card id",
    run: () => {
      const locks = { [lockKey("npc-abc", "outfit")]: true };
      for (const reportedId of ["npc-abc", "card-mara"]) {
        const { rows, handover } = applyTurn(
          [{ characterId: reportedId, name: "Mara Vex", outfit: "blue", mood: "grim" }],
          [storedMara],
          [mara],
          { fieldLocks: locks },
        );
        assert.deepEqual(idsOf(rows), ["card-mara"], reportedId);
        assert.equal(rows[0]!.outfit, "red coat", reportedId);
        assert.equal(rows[0]!.mood, "grim", reportedId);
        assert.deepEqual(handover.fieldLocks, { [lockKey("card-mara", "outfit")]: true }, reportedId);
        assert.deepEqual(handover.handedOver, [{ from: "npc-abc", to: "card-mara" }], reportedId);
      }
    },
  },
  {
    name: "a hidden field moves to the card id with the row",
    run: () => {
      const { handover } = applyTurn([{ characterId: "card-mara", name: "Mara Vex" }], [storedMara], [mara], {
        hidden: { [lockKey("npc-abc", "thoughts")]: true },
      });
      assert.deepEqual(handover.hiddenFields, { [lockKey("card-mara", "thoughts")]: true });
    },
  },
  {
    name: "a snapshot that already holds both rows folds them: card values win, the NPC's locked field and every lock stay",
    run: () => {
      const stored = [
        { characterId: "card-mara", name: "Mara Vex", mood: "tired", outfit: "blue", avatarPath: mara.avatarPath },
        storedMara,
      ];
      const locks = { [lockKey("npc-abc", "outfit")]: true, [lockKey("card-mara", "mood")]: true };
      const { handover } = applyTurn([], stored, [mara], { fieldLocks: locks });
      assert.equal(handover.previousCharacters.length, 1);
      const [row] = handover.previousCharacters;
      assert.equal(row!.characterId, "card-mara");
      assert.equal(row!.mood, "tired");
      assert.equal(row!.outfit, "red coat");
      assert.deepEqual(row!.idAliases, ["npc-abc"]);
      assert.deepEqual(handover.fieldLocks, {
        [lockKey("card-mara", "outfit")]: true,
        [lockKey("card-mara", "mood")]: true,
      });
    },
  },
  {
    name: "after the handover an incremental update or a full list by the old NPC id reaches the card row",
    run: () => {
      const handed = applyTurn([{ characterId: "card-mara", name: "Mara Vex" }], [storedMara], [mara]).rows;
      assert.deepEqual(handed[0]!.idAliases, ["npc-abc"]);
      const update = applyTurn({ updates: [{ characterId: "npc-abc", mood: "furious" }] }, handed, [mara]).rows;
      assert.deepEqual(idsOf(update), ["card-mara"]);
      assert.equal(update[0]!.mood, "furious");
      const full = applyTurn([{ characterId: "npc-abc", name: "Mara", mood: "sly" }], handed, [mara]).rows;
      assert.deepEqual(idsOf(full), ["card-mara"]);
      assert.equal(full[0]!.mood, "sly");
      assert.deepEqual(full[0]!.idAliases, ["npc-abc"]);
      // An earlier turn knew her as "Mara" under the NPC id: history must not hand that id to a new "Mara" row.
      const history = [{ characterId: "npc-abc", name: "Mara" }];
      const nameOnly = applyTurn([{ name: "Mara" }], handed, [mara], { history }).rows;
      assert.ok(!idsOf(nameOnly).includes("npc-abc"));
    },
  },
  {
    name: "two NPC rows for one card hand over neither; npc-X hands over to card X by id whatever the name",
    run: () => {
      const twoMaras = [storedMara, { characterId: "npc-def", name: "Mara Vex" }];
      const ambiguous = applyTurn([], twoMaras, [mara]).handover;
      assert.deepEqual(idsOf(ambiguous.previousCharacters), ["npc-abc", "npc-def"]);
      assert.deepEqual(ambiguous.ambiguousCardIds, ["card-mara"]);
      const promoted: Card = { id: "q7Kp2", name: "Captain Ilse" };
      const byId = applyTurn([], [{ characterId: "npc-q7Kp2", name: "The Captain" }], [promoted]).handover;
      assert.deepEqual(idsOf(byId.previousCharacters), ["q7Kp2"]);
    },
  },
  {
    name: "the NPC portrait and its framing don't land on a card with a picture; a card without one keeps them",
    run: () => {
      const history = [{ ...storedMara }];
      const withPicture = applyTurn([{ characterId: "npc-abc", name: "Mara Vex" }], [storedMara], [mara], {
        history,
      }).rows;
      assert.equal(withPicture[0]!.avatarPath, mara.avatarPath);
      assert.equal(withPicture[0]!.portraitZoom, undefined);
      const bare: Card = { id: "card-mara", name: "Mara Vex", avatarPath: null };
      const without = applyTurn([{ characterId: "npc-abc", name: "Mara Vex" }], [storedMara], [bare], {
        history,
      }).rows;
      assert.equal(without[0]!.characterId, "card-mara");
      assert.equal(without[0]!.avatarPath, storedMara.avatarPath);
      assert.equal(without[0]!.portraitZoom, 2);
    },
  },
  {
    name: "manual rows, cast members and NPCs no card names are left alone",
    run: () => {
      const stored = [
        { characterId: "manual-1", name: "Mara Vex" },
        { characterId: "npc-zzz", name: "Garrick" },
      ];
      const { handover } = applyTurn([], stored, [mara]);
      assert.deepEqual(handover.handedOver, []);
      assert.deepEqual(idsOf(handover.previousCharacters), ["manual-1", "npc-zzz"]);
    },
  },
]);
