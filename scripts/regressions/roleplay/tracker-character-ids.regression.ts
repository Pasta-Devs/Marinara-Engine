// #9541: the server owns Character Tracker NPC ids. The model writes "Garrick Thum" one run and "garrick_thum" the
// next; locks, hidden fields, avatars and portraits key on the id, so a drifted id used to detach them. These cases
// run the tracker steps the way the Character Tracker effect does (card identity, ids, UI fields, locks), and the
// incremental `{ updates, removed }` resolution.
import assert from "node:assert/strict";
import {
  applyTrackerFieldLocksToGameStatePatch,
  characterTrackerLockKey,
  isTrackerFieldLocked,
  resolveTrackerRowsUpdate,
  type GameState,
} from "../../../packages/shared/src/index.js";
import {
  applyTrackerCharacterCardIdentity,
  assignTrackerCharacterIds,
  buildTrackerCastCharacterId,
  preserveTrackerCharacterUiFields,
} from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import { runNamedCases } from "../fixtures/named-cases.js";

type Row = Record<string, unknown>;

const cards = [
  { id: "card-alice", name: "Alice", avatarPath: "/api/avatars/alice.png" },
  { id: "card-flagon", name: "The Gilded Flagon" },
];

// One counter for the whole file, so a row that should keep its id can't pass by being minted the same id again.
let minted = 0;
const mintTestId = () => `npc-test${++minted}`;
const isMinted = (id: unknown) => typeof id === "string" && id.startsWith("npc-test");

/** One tracker result applied like the Character Tracker effect applies it. */
function applyTurn(
  reported: Row[],
  previous: Row[],
  options: { history?: Row[]; fieldLocks?: Record<string, boolean>; mintId?: () => string } = {},
): Row[] {
  const characters = structuredClone(reported);
  applyTrackerCharacterCardIdentity(characters, cards, {
    previousCharacters: [...previous, ...(options.history ?? [])],
  });
  assignTrackerCharacterIds(characters, {
    previousCharacters: previous,
    history: options.history,
    cardIds: cards.map((card) => card.id),
    mintId: options.mintId ?? mintTestId,
  });
  preserveTrackerCharacterUiFields(characters, previous);
  const state = { presentCharacters: previous, fieldLocks: options.fieldLocks ?? {} } as unknown as GameState;
  return applyTrackerFieldLocksToGameStatePatch({ presentCharacters: characters }, state).presentCharacters as Row[];
}

const idsOf = (rows: Row[]) => rows.map((row) => row.characterId);

await runNamedCases([
  {
    name: "a new NPC gets a server id, and keeps it when the model writes the id differently",
    run: () => {
      const first = applyTurn([{ characterId: "Garrick Thum", name: "Garrick Thum", mood: "calm" }], []);
      const id = first[0]!.characterId;
      assert.ok(isMinted(id));
      for (const drifted of ["garrick_thum", "Garrick-Thum", "GARRICK THUM", String(id)]) {
        const next = applyTurn([{ characterId: drifted, name: "Garrick Thum", mood: "angry" }], first);
        assert.deepEqual(idsOf(next), [id], drifted);
        assert.equal(next[0]!.mood, "angry", drifted);
      }
      const nameOnly = applyTurn([{ name: "Garrick Thum", mood: "tired" }], first);
      assert.deepEqual(idsOf(nameOnly), [id]);
    },
  },
  {
    name: "a locked and a hidden field stay on the NPC when the model's id drifts",
    run: () => {
      const stored = [{ characterId: "Garrick Thum", name: "Garrick Thum", mood: "calm", thoughts: "secret" }];
      const moodKey = characterTrackerLockKey(stored[0] as never, 0, "mood");
      const next = applyTurn([{ characterId: "garrick_thum", name: "Garrick Thum", mood: "angry" }], stored, {
        fieldLocks: { [moodKey]: true },
      });
      // A grandfathered id is kept as it is, so its lock and hidden keys still match: no migration.
      assert.deepEqual(idsOf(next), ["Garrick Thum"]);
      assert.equal(characterTrackerLockKey(next[0] as never, 0, "thoughts"), "characters.id:Garrick%20Thum.thoughts");
      assert.equal(next[0]!.mood, "calm");
      assert.ok(isTrackerFieldLocked({ [moodKey]: true }, characterTrackerLockKey(next[0] as never, 0, "mood")));
    },
  },
  {
    name: "a stored NPC without an id stays without one, so its name-keyed locks keep matching",
    run: () => {
      const stored = [{ name: "Old Tom", mood: "calm" }];
      const moodKey = characterTrackerLockKey(stored[0] as never, 0, "mood");
      assert.equal(moodKey, "characters.name:Old%20Tom.mood");
      for (const reported of [
        { name: "Old Tom", mood: "angry" },
        { characterId: "old_tom", name: "Old Tom", mood: "angry" },
      ]) {
        const next = applyTurn([reported], stored, { fieldLocks: { [moodKey]: true } });
        assert.equal(next.length, 1, JSON.stringify(reported));
        assert.equal(next[0]!.characterId, undefined, JSON.stringify(reported));
        assert.equal(next[0]!.mood, "calm", JSON.stringify(reported));
      }
    },
  },
  {
    name: "two NPCs with the same name get two ids and keep their own avatars",
    run: () => {
      const first = applyTurn(
        [
          { characterId: "Guard", name: "Guard", avatarPath: "/api/avatars/npc/c/guard-a.png" },
          { characterId: "Guard", name: "Guard", avatarPath: "/api/avatars/npc/c/guard-b.png" },
        ],
        [],
      );
      const [a, b] = idsOf(first);
      assert.ok(isMinted(a) && isMinted(b) && a !== b);
      const next = applyTurn(
        [
          { characterId: b, name: "Guard" },
          { characterId: a, name: "Guard" },
        ],
        first,
      );
      assert.deepEqual(idsOf(next), [b, a]);
      assert.equal(next[0]!.avatarPath, "/api/avatars/npc/c/guard-b.png");
      assert.equal(next[1]!.avatarPath, "/api/avatars/npc/c/guard-a.png");
    },
  },
  {
    name: "two incoming rows can't share one stored row, so a second guard gets its own id",
    run: () => {
      const stored = [{ characterId: "Guard", name: "Guard" }];
      const next = applyTurn(
        [
          { characterId: "Guard", name: "Guard" },
          { characterId: "Guard", name: "Guard" },
        ],
        stored,
      );
      assert.equal(next[0]!.characterId, "Guard");
      assert.ok(isMinted(next[1]!.characterId));
    },
  },
  {
    name: "an id naming another NPC does not take that NPC's id when the row names someone else",
    run: () => {
      const stored = [
        { characterId: "npc-a", name: "Guard" },
        { characterId: "npc-b", name: "Captain" },
      ];
      const next = applyTurn([{ characterId: "Captain", name: "Guard" }], stored);
      assert.notEqual(next[0]!.characterId, "npc-b");
    },
  },
  {
    name: "an id unrelated to every stored row is a new character, as before (namesake guard)",
    run: () => {
      const next = applyTurn([{ characterId: "guard_2", name: "Guard" }], [{ characterId: "npc-a", name: "Guard" }]);
      assert.equal(next.find((row) => row.characterId === "npc-a")?.name, undefined);
      assert.ok(isMinted(next[0]!.characterId));
    },
  },
  {
    name: "card characters, cast members and hand-added rows keep their ids",
    run: () => {
      const cast = buildTrackerCastCharacterId("card-flagon", "Bram Holt");
      const next = applyTurn(
        [
          { characterId: "Alice", name: "Alice" },
          { characterId: cast, name: "Bram Holt" },
          { characterId: "manual-7", name: "Odd stranger" },
        ],
        [{ characterId: cast, name: "Bram Holt" }],
      );
      assert.deepEqual(idsOf(next), ["card-alice", cast, "manual-7"]);
    },
  },
  {
    name: "an NPC seen only in earlier turns keeps that id, but never one a current namesake already has",
    run: () => {
      const history = [{ characterId: "npc-old", name: "Mira" }];
      assert.deepEqual(idsOf(applyTurn([{ name: "Mira" }], [], { history })), ["npc-old"]);
      // A current Mira wins over a history Mira from another swipe.
      const current = [{ characterId: "npc-now", name: "Mira" }];
      assert.deepEqual(idsOf(applyTurn([{ name: "Mira" }], current, { history })), ["npc-now"]);
      // Two history Miras with different ids are ambiguous: a new id.
      const twoMiras = [...history, { characterId: "npc-other", name: "Mira" }];
      assert.ok(isMinted(applyTurn([{ name: "Mira" }], [], { history: twoMiras })[0]!.characterId));
      // A renamed NPC: history knows npc-old as "Mira", the stored list has it as "Mira Vale". The new "Mira" must
      // not take npc-old, or two rows would share one id.
      const renamed = applyTurn(
        [{ name: "Mira" }, { name: "Mira Vale" }],
        [{ characterId: "npc-old", name: "Mira Vale" }],
        {
          history,
        },
      );
      assert.ok(isMinted(renamed[0]!.characterId));
      assert.equal(renamed[1]!.characterId, "npc-old");
    },
  },
  {
    name: "incremental updates reach the row through a drifted id and keep its stored id",
    run: () => {
      const stored = [
        { characterId: "Garrick Thum", name: "Garrick Thum", mood: "calm" },
        { characterId: "npc-b", name: "Mira", mood: "wary" },
      ];
      const updated = resolveTrackerRowsUpdate(
        { updates: [{ characterId: "garrick_thum", mood: "angry" }], removed: ["mira"] },
        stored,
        "characterId",
      )!;
      assert.deepEqual(updated, [{ characterId: "Garrick Thum", name: "Garrick Thum", mood: "angry" }]);
      // The namesake guard holds: an unrelated id with a known name changes nobody.
      const guarded = resolveTrackerRowsUpdate(
        { updates: [{ characterId: "guard_2", name: "Mira", mood: "angry" }] },
        stored,
        "characterId",
      )!;
      assert.deepEqual(guarded, stored);
    },
  },
]);
