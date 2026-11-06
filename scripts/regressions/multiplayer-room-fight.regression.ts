/**
 * A shared room's fight played by every player (laptop room playtest 2026-10-27: no board opened for the
 * host or a guest, and a guest showed as offline until their tab opened the room).
 *
 * What is pinned here:
 *   - A guest is shown the fight as a projection copied field by field from the host's view of it for
 *     them: their own party members marked, who plays the others, their own menu only while one of
 *     theirs is asked, and what each choice needs (nothing, targets, or a square). An option this
 *     view cannot carry stays on the host's screen. The projection fits the snapshot's bounds.
 *   - The snapshot and the guest's fight command are strict: nothing past the listed fields, and a
 *     command only for a ruleset choice, a placement or the guest's own controller switch.
 *   - The fight's end is the host's turn: the round closes on it, everybody yet to act passing, and a
 *     room with no round collecting refuses it. A guest's fight command keeps its receipt in the room,
 *     so their next action's sequence follows on, and writes nothing to the story.
 *   - The host's Game screen is what a room fight is played on, and its result goes to the room.
 *   - A joined Engine polls on its own, so the host sees the guest as here from the moment they join.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  multiplayerActionSchema,
  multiplayerFightSchema,
  multiplayerSnapshotSchema,
  type DirectedCombatView,
  type MultiplayerAction,
  type MultiplayerStoredRoom,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-room-fight-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createMultiplayerRoomStore, createRoomParticipant, nextRound } =
  await import("../../packages/server/src/services/multiplayer/room-store.js");
const { projectMultiplayerFight, MULTIPLAYER_FIGHT_BYTES } =
  await import("../../packages/server/src/services/multiplayer/fight-projection.js");
const { projectRoomSnapshot, roomUserText } =
  await import("../../packages/server/src/services/multiplayer/room-projection.js");
const { newId } = await import("../../packages/server/src/utils/id-generator.js");

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const action = (sequence: number, input: Record<string, unknown>) =>
  ({ operationId: newId(), sequence, ...input }) as MultiplayerAction;
const expectCode = (code: string) => (error: unknown) =>
  !!error && typeof error === "object" && "code" in error && error.code === code;

const option = (input: Record<string, unknown>) => ({
  kind: "attack",
  label: "Longsword",
  targets: { side: "enemy", count: 1 },
  targetIds: [],
  ...input,
});
const combatant = (id: string, name: string, side: "party" | "enemy", extra: Record<string, unknown> = {}) => ({
  id,
  name,
  side,
  initiative: 10,
  health: { value: 20, max: 30, temp: 0 },
  defense: 14,
  conditions: [],
  budgets: {},
  down: false,
  dying: false,
  stable: false,
  defeated: false,
  ...extra,
});
const view = (ruleset: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({
    id: "fight_1",
    instanceId: "row_1",
    revision: 7,
    style: "ruleset",
    round: 2,
    stage: "action",
    party: [
      { id: "corwin", name: "Corwin", controller: "manual" },
      { id: "brenna", name: "Brenna", controller: "manual" },
    ],
    enemies: [],
    inventory: [],
    budgets: {},
    log: [],
    ruleset: {
      ruleset: { id: "local/5e", version: 1 },
      round: 2,
      order: ["corwin", "brenna", "hound"],
      controller: "manual",
      actorId: "corwin",
      players: {
        corwin: { participantId: "guest_participant", name: "Gil" },
        brenna: { participantId: "host_participant", name: "Hana", host: true },
      },
      yours: ["corwin"],
      grid: {
        width: 4,
        height: 3,
        tiles: [
          ["plains", "plains", "forest", "wall"],
          ["plains", "water", "plains", "plains"],
          ["ruin", "plains", "plains", "mountain"],
        ],
        distance: { label: "ft", perCell: 5 },
      },
      combatants: [
        combatant("corwin", "Corwin", "party", { x: 0, y: 0, conditions: [{ id: "blessed", label: "Blessed" }] }),
        combatant("brenna", "Brenna", "party", { x: 1, y: 0 }),
        combatant("hound", "Cinder Hound", "enemy", { x: 2, y: 1, creature: { catalogId: "x", entryId: "y" } }),
        combatant("lurker", "Lurker", "enemy", { x: 3, y: 2, hidden: true }),
      ],
      options: [
        option({ id: "sword", targetIds: ["hound"] }),
        option({ id: "volley", label: "Volley", targets: { side: "enemy", count: 3 }, targetIds: ["hound"] }),
        option({ id: "far", label: "Spear", targetIds: [] }),
        option({
          id: "walk",
          kind: "move",
          label: "Move",
          targets: { side: "self", count: 0 },
          cells: [{ x: 1, y: 1, cost: 1, path: [], provokes: [] }],
        }),
        option({
          id: "burst",
          kind: "ability",
          label: "Burning Hands",
          area: { shape: "cone", size: 3, range: 0 },
          aim: [{ x: 2, y: 1, targetIds: ["hound"] }],
        }),
        option({ id: "dodge", kind: "standard", label: "Dodge", targets: { side: "self", count: 1 } }),
        option({ id: "dash", kind: "standard", label: "dash", targets: { side: "self", count: 0 } }),
        option({
          id: "ready:sword@acts",
          kind: "standard",
          label: "ready",
          targets: { side: "self", count: 0 },
          ready: { optionId: "sword", label: "Longsword", on: "acts" },
        }),
        option({
          id: "ready:move:walk@comes",
          kind: "standard",
          label: "ready",
          targets: { side: "self", count: 0 },
          ready: { optionId: "move:walk", label: "walk", on: "comes" },
        }),
        option({ id: "misty", kind: "ability", label: "Misty Step", teleport: { cells: [{ x: 3, y: 0 }] } }),
        option({ id: "end", kind: "end-turn", label: "End turn", targets: { side: "self", count: 0 } }),
      ],
      events: [
        { seq: 1, event: { type: "round", round: 2 } },
        { seq: 2, event: { type: "turn", actorId: "corwin", round: 2 } },
        {
          seq: 3,
          event: {
            type: "attack",
            actorId: "hound",
            targetId: "corwin",
            optionId: "bite",
            label: "Bite",
            mode: "normal",
            rolls: [12],
            kept: 12,
            modifier: 4,
            total: 16,
            defense: 14,
            outcome: "hit",
          },
        },
        { seq: 4, event: { type: "reasoning", actorId: "hound", reasons: [] } },
      ],
      adjustments: [],
      ...ruleset,
    },
    ...extra,
  }) as unknown as DirectedCombatView;

const db = await getDB();
try {
  // ── The guest's own view of the fight ──
  {
    const fight = projectMultiplayerFight("anchor_1", view({}))!;
    assert.ok(fight, "a ruleset fight is shared");
    assert.ok(multiplayerFightSchema.safeParse(fight).success);
    assert.deepEqual(
      [fight.anchor, fight.id, fight.instanceId, fight.revision, fight.round],
      ["anchor_1", "fight_1", "row_1", 7, 2],
    );
    assert.deepEqual(
      fight.combatants.map((one) => one.id),
      ["corwin", "brenna", "hound"],
      "an opponent hidden from the party is left out",
    );
    const corwin = fight.combatants.find((one) => one.id === "corwin")!;
    assert.equal(corwin.mine, true);
    assert.equal(corwin.player, "Gil");
    assert.equal(corwin.controller, "manual");
    assert.deepEqual(corwin.conditions, ["Blessed"]);
    assert.deepEqual([corwin.x, corwin.y], [0, 0]);
    const brenna = fight.combatants.find((one) => one.id === "brenna")!;
    assert.equal(brenna.mine, false);
    assert.equal(brenna.player, "Hana", "who plays the others is named");
    assert.equal(fight.combatants.find((one) => one.id === "hound")!.controller, null);
    assert.ok(!JSON.stringify(fight).includes("catalogId"), "nothing but the listed fields crosses");
    assert.equal(fight.grid?.width, 4);
    assert.equal(fight.grid?.tiles[0]?.[3], "wall");
    const byId = new Map(fight.options.map((one) => [one.id, one]));
    assert.deepEqual(
      [...byId.keys()],
      ["sword", "volley", "walk", "burst", "dodge", "dash", "ready:sword@acts", "ready:move:walk@comes", "end"],
      "nobody in reach and a teleport's landing stay on the host's screen",
    );
    assert.equal(byId.get("sword")!.pick, "targets");
    assert.equal(byId.get("sword")!.count, 1);
    assert.deepEqual(byId.get("sword")!.targetIds, ["hound"]);
    assert.equal(byId.get("volley")!.count, 3);
    assert.equal(byId.get("walk")!.pick, "cell");
    assert.equal(byId.get("walk")!.moves, true);
    assert.deepEqual(byId.get("walk")!.cells, [{ x: 1, y: 1 }]);
    assert.equal(byId.get("burst")!.pick, "cell");
    assert.equal(byId.get("burst")!.moves, false, "a shape is aimed at its square");
    assert.deepEqual(byId.get("burst")!.cells, [{ x: 2, y: 1 }]);
    assert.equal(byId.get("dodge")!.pick, "none", "one aimed at the actor themselves needs no pick");
    assert.equal(byId.get("end")!.pick, "none");
    assert.deepEqual(
      ["dodge", "dash", "ready:sword@acts", "ready:move:walk@comes"].map((id) => byId.get(id)!.label),
      ["Dodge", "Dash", "Ready Longsword: when an enemy acts", "Ready Move: when an enemy comes in reach"],
      'each Ready names what it readies and for when, never ten bare "ready" buttons',
    );
    assert.equal(fight.waitingOn, null);
    assert.deepEqual(fight.log, ["Round 2", "Corwin's turn", "Cinder Hound uses Bite on Corwin: 16 against 14, hit"]);

    // Someone else's turn: no menu, and the room says whom it waits on.
    const theirs = projectMultiplayerFight(
      "anchor_1",
      view({ actorId: "brenna", options: undefined, yours: ["corwin"] }),
    )!;
    assert.deepEqual(theirs.options, []);
    assert.equal(theirs.waitingOn, "Hana");
    assert.equal(theirs.actorId, "brenna");
    // A moment that asks the guest's own: its words come with the menu.
    const asked = projectMultiplayerFight(
      "anchor_1",
      view({
        actorId: "hound",
        window: { id: "w", kind: "reaction", actorId: "corwin", waiting: 0, controller: "manual", label: "Shield?" },
        options: [option({ id: "shield", kind: "block", label: "Shield", targets: { side: "self", count: 0 } })],
      }),
    )!;
    assert.equal(asked.prompt, "Shield?");
    assert.deepEqual(
      asked.options.map((one) => one.id),
      ["shield"],
    );
    // Over: nothing more to do.
    const over = projectMultiplayerFight("anchor_1", view({}, { outcome: "victory" }))!;
    assert.equal(over.over, true);
    assert.deepEqual(over.options, []);
    assert.equal(over.actorId, null);
    // A fight the ruleset does not resolve is not shared.
    assert.equal(projectMultiplayerFight("anchor_1", { ...view({}), style: "tactical" }), null);
    // A board too big to send is left out, and the fight still reads as a list.
    const wide = 64;
    const huge = projectMultiplayerFight(
      "anchor_1",
      view({
        grid: {
          width: wide,
          height: wide,
          tiles: Array.from({ length: wide }, () => Array.from({ length: wide }, () => "x".repeat(24))),
          distance: { label: "ft", perCell: 5 },
        },
        options: [
          option({ id: "sword", targetIds: ["hound"] }),
          option({
            id: "walk",
            kind: "move",
            label: "Move",
            targets: { side: "self", count: 0 },
            cells: Array.from({ length: 400 }, (_, index) => ({
              x: index % wide,
              y: Math.floor(index / wide),
              cost: 1,
              path: [],
              provokes: [],
            })),
          }),
        ],
      }),
    );
    assert.ok(huge);
    assert.ok(Buffer.byteLength(JSON.stringify(huge)) <= MULTIPLAYER_FIGHT_BYTES);
    if (huge.grid === null)
      assert.deepEqual(
        huge.options.map((one) => one.id),
        ["sword"],
      );
  }

  // ── Strict at the edges ──
  {
    const fight = projectMultiplayerFight("anchor_1", view({}))!;
    assert.equal(multiplayerFightSchema.safeParse({ ...fight, art: "https://example.test/x.png" }).success, false);
    const command = {
      operationId: newId(),
      sequence: 3,
      type: "fight-command",
      fight: { anchor: "anchor_1", id: "fight_1", instanceId: "row_1", revision: 7 },
      command: { type: "ruleset", optionId: "sword", targetIds: ["hound"] },
    };
    assert.ok(multiplayerActionSchema.safeParse(command).success);
    for (const refused of [
      { ...command, command: { type: "continue" } },
      { ...command, command: { type: "controlCompanions", controller: "ai" } },
      { ...command, command: { type: "ruleset", optionId: "sword", targetIds: [], wall: { x: 0, y: 0 } } },
      { ...command, command: { type: "ruleset", optionId: "__proto__", targetIds: [] } },
      { ...command, fight: { ...command.fight, extra: true } },
    ])
      assert.equal(multiplayerActionSchema.safeParse(refused).success, false, JSON.stringify(refused.command));
  }

  // ── The room: a fight's end closes the round, a guest's command keeps its receipt ──
  {
    const chats = createChatsStorage(db);
    const game = await chats.create({ name: "Shared fight", mode: "game", characterIds: [] } as never);
    assert.ok(game);
    const hostPlayer = createRoomParticipant("Hana", { name: "Brenna", description: "" }, true);
    const guestPlayer = createRoomParticipant("Gil", { name: "Corwin", description: "" });
    const room: MultiplayerStoredRoom = {
      version: 1,
      role: "host",
      roomId: newId(),
      epoch: newId(),
      revision: 1,
      status: "active",
      generation: "idle",
      generationOperationId: null,
      automaticReplies: true,
      pendingResponse: false,
      generations: 0,
      maxGenerations: 10,
      participants: [hostPlayer, guestPlayer],
      characters: [],
      round: null,
      receipts: [],
      lastActivityAt: new Date().toISOString(),
    };
    room.round = nextRound(room);
    await chats.patchMetadata(game.id, { multiplayer: room });
    const store = createMultiplayerRoomStore(db, game.id, room.roomId, room.epoch);

    const sent = action(0, {
      type: "fight-command",
      fight: { anchor: "anchor_1", id: "fight_1", instanceId: "row_1", revision: 7 },
      command: { type: "ruleset", optionId: "end", targetIds: [] },
    });
    const kept = await store.action(guestPlayer.id, sent);
    assert.equal(kept.claim, null);
    assert.equal(kept.duplicate, false);
    assert.equal((await store.action(guestPlayer.id, sent)).duplicate, true, "a retried command is not sent twice");
    const afterCommand = (await store.read()).room;
    assert.equal(afterCommand.participants.find((p) => p.id === guestPlayer.id)!.lastSequence, 0);
    assert.equal((await chats.listMessages(game.id)).length, 0, "a fight command writes nothing to the story");

    const result = "*The battle is won.*\n\n[combat_result]\nOUTCOME: VICTORY (after 2 rounds)\n[/combat_result]";
    const claim = await store.fightResult(result);
    assert.ok(claim, "the round closes on the fight's result");
    const messages = await chats.listMessages(game.id);
    assert.deepEqual(
      messages.map((message) => message.content),
      [result],
      "the guests played in the fight, so nobody passes in the story (laptop room playtest 2026-10-30)",
    );
    // The room shows the result's words, never the recap written for the Game Master.
    assert.equal(roomUserText(result), "*The battle is won.*");
    assert.equal(roomUserText("[combat_result]\nRewards: give gold\n"), "");
    assert.equal(roomUserText("I swing at it."), "I swing at it.");
    const closed = (await store.read()).room;
    assert.equal(closed.round!.phase, "resolving");
    await assert.rejects(store.fightResult(result), expectCode("busy"), "only a round still collecting takes it");

    // A guest's snapshot carries the fight, and a fight that does not check out is refused.
    const fight = projectMultiplayerFight("anchor_1", view({}))!;
    const snapshot = projectRoomSnapshot({
      room: closed,
      chat: { name: "Shared fight", mode: "game" },
      selfId: guestPlayer.id,
      connected: new Set([guestPlayer.id]),
      messages: [],
      fight,
    });
    assert.deepEqual(snapshot.fight, fight);
    assert.ok(multiplayerSnapshotSchema.safeParse(snapshot).success);
    assert.equal(
      "fight" in
        projectRoomSnapshot({
          room: closed,
          chat: { name: "x", mode: "game" },
          selfId: guestPlayer.id,
          connected: new Set(),
          messages: [],
        }),
      false,
    );
  }

  // ── Wiring ──
  {
    const chat = read("../../packages/client/src/features/multiplayer/MultiplayerChat.tsx");
    assert.match(chat, /host\.snapshot\.game\?\.state === "combat"/u, "a room fight opens the host's Game screen");
    assert.match(
      chat,
      /\(!!host\.snapshot\.fight && !host\.snapshot\.fight\.over\)/u,
      "a fight still being set down opens it too, before the game says combat",
    );
    // Kept mounted while the room is shown, so going back finds the board as it was.
    assert.match(
      chat,
      /\{gameMounted && \(\s*<div className=\{`[^`]*\$\{gameShown \? "flex" : "hidden"\}`\}>\{renderGame!\(\)\}<\/div>/u,
    );
    // Outside a fight the host can open the Game screen for the party's sheets.
    assert.match(
      chat,
      /const gameShown = gameOpenable && \(screen === "game" \|\| \(screen === "auto" && fighting\)\);/u,
    );
    assert.match(chat, /"multiplayer\.host\.showGame"/u);
    // A round waiting on a player who is not here offers Pass and Remove; blank sheets are named before a fight.
    assert.match(chat, /<MultiplayerAwayPlayers host=\{host\} \/>/u);
    const controls = read("../../packages/client/src/features/multiplayer/MultiplayerHostControls.tsx");
    assert.match(controls, /!player\.connected &&\s*round\.requiredParticipantIds\.includes\(player\.id\)/u);
    assert.match(chat, /gameOpenable && !fighting && \(\s*<MultiplayerBlankSheets/u);
    // The host's Game screen plays the host as their room persona and lists each guest on their room card,
    // so both sheets can be built there; the room header keeps the Game screen's bubbles off its buttons.
    const hostSurface = read("../../packages/client/src/components/game/GameSurface.tsx");
    assert.match(hostSurface, /const roomHumans = useMemo\(\(\) => readHostedRoomHumans\(chatMeta\.multiplayer\)/u);
    assert.match(hostSurface, /: \{ name: own\.name, \.\.\.\(own\.description/u);
    assert.match(
      hostSurface,
      /for \(const guest of roomHumans\?\.guests \?\? \[\]\) \{\s*const gc = findGameCard\(guest\.name\);/u,
    );
    // Combat asked for opens once ready, without stepping through the narration, and a second press
    // opens the fight already made instead of making another (laptop room playtest 2026-10-30).
    assert.match(hostSurface, /\(!latestNarrationText \|\| narrationDone \|\| !!queuedCombatGeneration\?\.asked\)/u);
    assert.match(
      hostSurface,
      /if \(preparedCombatStateRef\.current && queuedCombatGenerationRef\.current\?\.messageId === messageId\) \{/u,
    );
    assert.match(hostSurface, /setQueuedCombatGeneration\(\{ messageId, notify, asked: true \}\);/u);
    // The blueprint intro is the opening's alone, and played directions never replay (laptop room
    // playtest 2026-10-30: black Game screen after Continue story until Skip effects).
    assert.match(
      hostSurface,
      /if \(isRestoredRef\.current \|\| messages\.some\(\(message\) => message\.role === "user"\)\) \{/u,
    );
    assert.match(
      hostSurface,
      /if \(!playing\) setActiveDirections\(\(current\) => \(current\.length \? \[\] : current\)\);/u,
    );
    assert.match(chat, /data-multiplayer-room-header\s+data-chat-window-top-obstacle/u);
    // The room view's own header, where Stop hosting sits, keeps the Chat Settings bubble off it too:
    // inside [data-chat-mode], the selector's first half reaches it.
    assert.match(
      read("../../packages/client/src/features/multiplayer/MultiplayerGuestView.tsx"),
      /data-chat-mode=\{snapshot\?\.mode\}[\s\S]*<header\s+data-chat-window-top-obstacle\s/u,
    );
    assert.match(
      read("../../packages/client/src/components/ui/FloatingWindow.tsx"),
      /\[data-multiplayer-room-header\]\[data-chat-window-top-obstacle\]/u,
    );
    const snapshotting = read("../../packages/server/src/services/multiplayer/service.ts");
    // An Approve refused for a name in use declines the request with that reason, and the host is told
    // (laptop room playtest 2026-10-30: a silent 400, the guest waiting forever).
    assert.match(
      snapshotting,
      /session\.status = "declined";\s+session\.declinedFor = "identity-conflict";\s+this\.wake\(host\);/u,
    );
    assert.match(snapshotting, /error: session\.declinedFor \?\? "declined"/u);
    assert.match(
      read("../../packages/client/src/features/multiplayer/MultiplayerHostControls.tsx"),
      /t\("multiplayer\.host\.approveConflict", \{ name: request\.persona\.name \}\)/u,
    );
    // Each fighter its own id: a rejoined guest's hero never takes the host's "persona:active".
    assert.match(
      hostSurface,
      /if \(takenIds\.has\(combatant\.id\)\) \{\s+(?:\/\/[^\n]*\s+)?combatant\.id = `generated-party-\$\{index\}-\$\{slugifyCombatantId\(member\.name\)\}`;\s+combatant\.sprite = undefined;/u,
    );
    // Members named exactly as a unit claim it before name-variant matches, in either party order,
    // and a later member only sees units nobody holds yet.
    assert.match(
      hostSurface,
      /\.sort\(\(a, b\) => Number\(!isExact\(a\.member\)\) - Number\(!isExact\(b\.member\)\)\)/u,
    );
    assert.match(hostSurface, /combatAvatarCandidates\.filter\(\(candidate\) => !takenIds\.has\(candidate\.id\)\)/u);
    assert.match(hostSurface, /partyCombatants\[index\] = combatant;/u);
    const { findNamedEntry, hasExactNamedEntry } =
      await import("../../packages/client/src/lib/game-character-name-match.js");
    const units = [{ id: "persona:active", name: "Lyra Dawnblade" }];
    const byName = (unit: { name: string }) => unit.name;
    assert.equal(hasExactNamedEntry(units, "Lyra Dawnblade", byName), true);
    assert.equal(hasExactNamedEntry(units, "lyra  dawnblade", byName), true, "case and spacing still match exactly");
    assert.equal(hasExactNamedEntry(units, "Lyra", byName), false, "a variant is not an exact match");
    assert.equal(findNamedEntry(units, "Lyra", byName)?.id, "persona:active", "while a variant still finds the unit");
    assert.equal(hasExactNamedEntry(units, "", byName), false);
    assert.match(snapshotting, /const viewer = forLocalHost \? \{ host: true \} : \{ host: false, participantId \};/u);
    assert.match(
      snapshotting,
      /fight = projected && \(!projected\.over \|\| game\.state === "combat"\) \? projected : null;/u,
    );
    const area = read("../../packages/client/src/components/chat/ChatArea.tsx");
    assert.match(area, /<MultiplayerChat[\s\S]{0,200}renderGame=\{\(\) => \(\s*<LocalChatArea/u);
    const surface = read("../../packages/client/src/components/game/GameSurface.tsx");
    assert.match(
      surface,
      /if \(hostedRoom\) \{[\s\S]{0,400}"\/multiplayer\/host\/actions", \{ type: "fight-result"/u,
      "the fight's result goes to the room",
    );
    const guestView = read("../../packages/client/src/features/multiplayer/MultiplayerGuestView.tsx");
    assert.match(guestView, /<MultiplayerGuestFight[\s\S]{0,400}type: "fight-command"/u);
    const directed = read("../../packages/client/src/hooks/use-directed-combat.ts");
    assert.match(directed, /const roomFight = !!query\.data\?\.ruleset\?\.players/u, "the host sees guests' moves");
    const service = read("../../packages/server/src/services/multiplayer/service.ts");
    assert.match(service, /guest\.poll = null;\s*this\.keepPolling\(guest\);/u, "a joined Engine keeps polling");
    assert.match(service, /void this\.guestState\(\)\.catch\(\(\) => undefined\);\s*return \{ localChatId: chat!\.id/u);
    const index = read("../../packages/server/src/routes/index.ts");
    assert.match(index, /absent: \(chatId: string\) => multiplayer\.fightAbsent\(chatId\)/u);
    // The host's own Room screen commands the fight as the host; a guest who left is absent.
    assert.match(service, /isHost \? \{ host: true \} : \{ host: false, participantId \}/u);
    assert.match(service, /\(s\.status === "approved" \|\| s\.status === "revoked"\) && !connected\.has/u);
  }

  console.log("multiplayer-room-fight: ok");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
