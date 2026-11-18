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
    name: "Game Mode party NPC ids (npc:, party-npc:) pass through unchanged, turn after turn",
    run: () => {
      const reported = [
        { characterId: "npc:harbormaster", name: "Harbormaster" },
        { characterId: "party-npc:Wren", name: "Wren" },
      ];
      const first = applyTurn(reported, []);
      assert.deepEqual(idsOf(first), ["npc:harbormaster", "party-npc:Wren"]);
      const second = applyTurn(reported, first);
      assert.deepEqual(idsOf(second), ["npc:harbormaster", "party-npc:Wren"]);
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
      assert.deepEqual(updated, [
        // A stored id from before #9541 isn't server-minted, so it collects no aliases.
        { characterId: "Garrick Thum", name: "Garrick Thum", mood: "angry" },
      ]);
      // The namesake guard holds: an unrelated id with a known name changes nobody.
      const guarded = resolveTrackerRowsUpdate(
        { updates: [{ characterId: "guard_2", name: "Mira", mood: "angry" }] },
        stored,
        "characterId",
      )!;
      assert.deepEqual(guarded, stored);
    },
  },
  {
    name: "an NPC is found again through an id the model keeps re-using, e.g. from its previous output",
    run: () => {
      const first = applyTurn([{ characterId: "mara_v", name: "Mara Vex", mood: "wary" }], []);
      const id = first[0]!.characterId;
      assert.ok(isMinted(id));
      assert.deepEqual(first[0]!.idAliases, ["mara_v"]);
      // The same odd id again, and again under a changed name: an alias is an id, so the name doesn't matter.
      const second = applyTurn([{ characterId: "mara_v", name: "Mara Vex", mood: "grim" }], first);
      assert.deepEqual(idsOf(second), [id]);
      const third = applyTurn([{ characterId: "mara_v", name: "Mara the barkeep" }], second);
      assert.deepEqual(idsOf(third), [id]);
      assert.deepEqual(third[0]!.idAliases, ["mara_v"]);
      // Echoing the real id adds nothing.
      assert.deepEqual(applyTurn([{ characterId: String(id), name: "Mara Vex" }], third)[0]!.idAliases, ["mara_v"]);
    },
  },
  {
    name: "aliases keep the newest five, never the row's own id, without duplicates",
    run: () => {
      let rows = applyTurn([{ characterId: "a1", name: "Wren" }], []);
      const id = rows[0]!.characterId;
      // "A1" repeats "a1" in another case; the rest all fold to the name, so they are drift, not a new Wren.
      for (const alias of ["A1", "wren", "WREN_", "w-ren", "w ren", "w.ren", "wr-en"]) {
        rows = applyTurn([{ characterId: alias, name: "Wren" }], rows);
        assert.equal(rows[0]!.characterId, id, alias);
      }
      assert.deepEqual(rows[0]!.idAliases, ["wr-en", "w.ren", "w ren", "w-ren", "WREN_"]);
    },
  },
  {
    name: "incremental updates find a row through its alias and remember a new one",
    run: () => {
      const stored = [{ characterId: "npc-x", name: "Mara Vex", mood: "calm", idAliases: ["mara_v"] }];
      const viaAlias = resolveTrackerRowsUpdate(
        { updates: [{ characterId: "mara_v", mood: "grim" }] },
        stored,
        "characterId",
      )!;
      assert.deepEqual(viaAlias, [{ characterId: "npc-x", name: "Mara Vex", mood: "grim", idAliases: ["mara_v"] }]);
      const viaName = resolveTrackerRowsUpdate(
        { updates: [{ characterId: "Mara Vex", mood: "sly" }] },
        stored,
        "characterId",
      )!;
      assert.deepEqual(viaName[0]!.idAliases, ["Mara Vex", "mara_v"]);
      // And the effect keeps that alias when the row goes through the id assignment.
      const characters = structuredClone(viaName);
      assignTrackerCharacterIds(characters, { previousCharacters: stored, cardIds: [], mintId: mintTestId });
      assert.deepEqual(characters[0]!.idAliases, ["Mara Vex", "mara_v"]);
    },
  },
  {
    name: "an id beats an alias, and an alias beats a name, so a reused id never ties two rows",
    run: () => {
      const stored = [
        { characterId: "npc-a", name: "Ash", idAliases: ["garrick"] },
        { characterId: "npc-b", name: "Garrick" },
        { characterId: "garrick", name: "Old Garrick" },
      ];
      const update = (raw: Row, rows: Row[] = stored) =>
        resolveTrackerRowsUpdate({ updates: [raw] }, rows, "characterId")!;
      // The id itself names the third row.
      assert.equal(update({ characterId: "garrick", mood: "x" })[2]!.mood, "x");
      // Without it, the alias wins over Garrick's name...
      const withoutId = stored.slice(0, 2);
      assert.equal(update({ characterId: "garrick", mood: "x" }, withoutId)[0]!.mood, "x");
      // ...unless the update names the other row: then it is that row's name, not Ash's alias.
      const named = update({ characterId: "garrick", name: "Garrick", mood: "x" }, withoutId);
      assert.deepEqual(
        named.map((row) => [row.characterId, row.name, row.mood]),
        [
          ["npc-a", "Ash", undefined],
          ["npc-b", "Garrick", "x"],
        ],
      );
    },
  },
  {
    name: "only server-minted NPC rows remember aliases, and never an overlong id",
    run: () => {
      const stored = [
        { characterId: "manual-1", name: "Hand Made" },
        { characterId: "npc:wren", name: "Wren" },
        { characterId: "npc-x", name: "Mara Vex" },
      ];
      const rows = resolveTrackerRowsUpdate(
        {
          updates: [
            { characterId: "hand_made", mood: "a" },
            { characterId: "npc_wren", name: "Wren", mood: "b" },
            { characterId: "mara_vex_" + "x".repeat(90), name: "Mara Vex", mood: "c" },
            { characterId: "mara-vex", mood: "d" },
          ],
        },
        stored,
        "characterId",
      )!;
      assert.deepEqual(
        rows.map((row) => [row.characterId, row.mood, row.idAliases]),
        [
          ["manual-1", "a", undefined],
          ["npc:wren", "b", undefined],
          ["npc-x", "d", ["mara-vex"]],
        ],
      );
      // A new NPC whose model id is overlong gets a server id and no alias.
      const nova = applyTurn([{ characterId: "nova_" + "x".repeat(90), name: "Nova" }], []);
      assert.ok(isMinted(nova[0]!.characterId));
      assert.equal(nova[0]!.idAliases, undefined);
      // A card row that replaced an NPC row in the effect drops the NPC's aliases.
      const card = [{ characterId: "card-alice", name: "Alice", idAliases: ["alice_1"] }];
      assignTrackerCharacterIds(card, { previousCharacters: [], cardIds: ["card-alice"], mintId: mintTestId });
      assert.equal(card[0]!.idAliases, undefined);
    },
  },
]);
