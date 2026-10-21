# Writing Game Mode Story Scripts

A story script lets a creator steer how a Game Mode game unfolds: scenes that play when the party
arrives somewhere, things the Game Master is asked to do once a condition is met, objectives the player
follows in the journal, and moments the Game Master itself may mark. This guide is for people who write
their own. To play a world that has a story, start with [Making a world](../game/getting-started.md#making-a-world).

A story script is data, not code. Nothing in it runs. The Engine checks it against the world it is for,
plays it turn by turn, and refuses anything that does not fit.

## Where a story lives

A story belongs to one world. It names that world's places and people, so it only makes sense with the
world it was written for (its seed, its brief and its hand edits).

- In a **world file** (`.world.json`), as a top-level `story` beside `world`. An Engine that does not
  know stories still reads the world.
- In an Experience's **map pack**: each world file can carry its story, and a new game takes it with the
  map. See [optional agent packages](../development/optional-agent-packages.md).
- In a world kept in the library, outside any game: `GET`, `PUT` and `DELETE /api/game-worlds/:id/story`,
  the same as a game's. A new game started from that world takes the story with it.
- In a game, once it starts: `GET`, `PUT` and `DELETE /api/game/:chatId/story` read, save and remove it.
  A save is checked against the game's world, hand edits included, and hand edits that would take away
  something the story names are refused.

In a new game's setup, a story read from a file or a map pack is kept while the world's seed and brief
stay as they were.

## The shape

```json
{
  "storyVersion": 1,
  "flags": [],
  "directions": [],
  "events": [],
  "cutscenes": [],
  "fights": [],
  "endings": [],
  "knowledge": []
}
```

Ids are 1 to 40 lowercase letters, digits, `_` or `-`, unique within their list. A story holds at most
64 flags, 64 directions, 256 events (128 before Capability API 1.349), 64 cutscenes, 32 fights, 16 endings
and 600 knowledge entries. No text in it may hold a line break, square brackets or `{{`, and names written
into a tag (a group, a background) may not hold a double quote: nothing a story says can pass for one of
the Game Master's tags.

### Flags

A flag is a value the story keeps: `"bool"` (true or false) or `"number"`.

```json
{ "id": "trust", "kind": "number", "initial": 0, "gm": true, "note": "How far the town trusts the party" }
```

- `gm: true` lets the Game Master set it (see [The Game Master's tags](#the-game-masters-tags)); `note`
  tells it what the flag means.
- Flags are hidden from the player. A flag becomes a **quest objective** in the journal with `quest`:

```json
{
  "id": "favours",
  "kind": "number",
  "initial": 0,
  "quest": { "title": "Favours", "text": "Do the town three favours", "goal": 3 }
}
```

A yes-or-no objective is done when its flag is true; a number objective when it reaches its `goal`
(1 when not given), and with a `goal` written the journal shows how far along it is. An objective with
`"hidden": true` waits in the journal until an event shows it.

#### Clocks

A number flag can be a **clock** the player watches fill (Capability API 1.342): a circle of 2 to 12
segments, one filled per point, shown in the game's HUD and the World tab, with its title and what
happens when it is full.

```json
{
  "id": "reeve",
  "kind": "number",
  "initial": 0,
  "gm": true,
  "clock": { "title": "The Reeve's patience", "segments": 6, "full": "The Reeve sends his men." }
}
```

Set it, add to it and test it in conditions like any number flag. The Game Master is told the clocks
each turn, and once, when one fills (by an event, or by its own tag the turn after), what to bring about.
A clock with `"hidden": true` stays out of sight until an event `show`s it.

### Directions

A direction is a standing instruction to the Game Master, in force while its conditions hold:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

### Conditions

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. All of an `if` list
must hold. A yes-or-no flag is only compared with `=` or `!=`.

`{ "party": "<person id>", "is": "in" | "out" }` asks whether a person of the world travels with the
party now, such as a companion the story recruited (Capability API 1.349).

### Knowledge

What people know and say about themselves, each other and the setting, changing as the story moves
(Capability API 1.348). Each entry is told to the Game Master, as something that person may say if it
comes up, on a turn when:

- its conditions hold,
- its `person` is in the scene: named in the latest reply or the player's message, or travelling with the
  party,
- and, when it has `keys`, one of them is said there too. An entry with no person needs keys, and comes in
  by them alone.

```json
"knowledge": [
  { "id": "hob-self", "person": "p3-4", "text": "Hob was a miller's boy before the year stopped." },
  { "id": "hob-mill", "person": "p3-4", "if": [{ "flag": "act", "is": ">=", "value": 2 }],
    "text": "Since the second act, Hob is afraid of the mill." },
  { "id": "hob-bells", "person": "p3-4", "keys": ["bells"], "text": "Hob thinks the bells are a lie." },
  { "id": "wheel", "keys": ["mill", "millwheel"], "text": "The mill's wheel has not turned in a hundred autumns." }
]
```

A script holds up to 600 entries. At most 12 are told a turn, in the script's order, so put the ones that
matter most first.

### Events

An event is something that happens: when its trigger fires and its conditions hold, it does its actions.

```json
{
  "id": "gates",
  "when": { "on": "arrive", "place": "p11" },
  "if": [{ "flag": "banished", "is": "=", "value": false }],
  "do": [{ "cutscene": "gates" }, { "set": "arrived", "value": true }, { "show": "key" }]
}
```

An event happens once, unless it has `"repeat": true` (which `start`, `turn` and `day` ignore). At most
32 events happen in one turn, each at most once, in the order the script lists them.

**Triggers** (`when.on`), all read from what the game has recorded:

| Trigger  | Fires                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`  | On the game's first reply.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `turn`   | On or after the Game Master's reply number `turn` in the whole game, across sessions.                                                                                                                                                                                                                                                                                                                                                                   |
| `day`    | Once the world's day (moved by the Game Master's time passing and by walks) is `day` or later.                                                                                                                                                                                                                                                                                                                                                          |
| `arrive` | While the party is in `place` (a place id) or a place inside it, having come there by starting there, a walk on the overworld, a visit in town, or a place the Game Master names. With `repeat`, again each time it comes back from elsewhere.                                                                                                                                                                                                          |
| `meet`   | Once a reply has named `person` (a person id such as `p11-3`, or `p11-e1` for one added by hand) in full. With `repeat`, again for each reply that names them. Only this session's replies are read for names.                                                                                                                                                                                                                                          |
| `deed`   | Once the world has recorded a deed of the party, of kind `deed` and at `place` when given. With `repeat`, again for each reply that records one.                                                                                                                                                                                                                                                                                                        |
| `fight`  | When a fight ends in `outcome`: `victory`, `defeat` or `flee`.                                                                                                                                                                                                                                                                                                                                                                                          |
| `broke`  | When a fight broke the prop called `prop` (Capability API 1.316), matched without case. Only a prop painted on one of the world's battlefields can be named.                                                                                                                                                                                                                                                                                            |
| `flags`  | When its conditions hold. With `repeat`, again each time they come true after being false.                                                                                                                                                                                                                                                                                                                                                              |
| `gm`     | Only when the Game Master trips it (the event needs `"gm": true`).                                                                                                                                                                                                                                                                                                                                                                                      |
| `rest`   | After a reply in which the party rested: a `[sheet: op="rest"]` the Game Master's reply took, of the ruleset rest `rest` names (its id or label, such as `long`) or any (1.349).                                                                                                                                                                                                                                                                        |
| `travel` | On a turn the party sets out from one place for another, from inside `from` and to inside `to` when they are given (1.349).                                                                                                                                                                                                                                                                                                                             |
| `idle`   | After `turns` replies in a row with nothing happening: no story event, no walk and no fight (1.349).                                                                                                                                                                                                                                                                                                                                                    |
| `step`   | When a walk goes over the cell `x`, `y` (0-based from the top-left) of `place`: a settlement's town (a visit's path, door to door), or a place's map made by hand (a walk on it). The cell must be one the party can walk onto: in a town, ground the square reaches and not a free lot, where the story may build; on a map, floor its entry reaches. A generated map has no cells to name. With `repeat`, again on each turn whose walk goes over it. |

Hand edits that take a step event's cell away (a building put on it, a map's floor walled) are refused
when saved, naming the event.

A repeating `meet` event whose own scene names that person, or a repeating `deed` event that does the
deed it waits for, would set itself off every turn, so the Engine refuses it.

**Actions** (`do`):

| Action                                                                                                  | Does                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ "set": "<flag>", "value": <value> }`                                                                 | Sets a flag.                                                                                                                                                                                                                                                                                                                                       |
| `{ "add": "<flag>", "amount": <number> }`                                                               | Adds to a number flag.                                                                                                                                                                                                                                                                                                                             |
| `{ "tell": "<text>" }`                                                                                  | Asks something of the Game Master, once, this turn.                                                                                                                                                                                                                                                                                                |
| `{ "cutscene": "<id>" }`                                                                                | Plays a cutscene.                                                                                                                                                                                                                                                                                                                                  |
| `{ "show": "<flag>" }`                                                                                  | Shows a hidden quest objective in the journal.                                                                                                                                                                                                                                                                                                     |
| `{ "world": { "deed": "<kind>", "group": "...", "with": "...", "place": "<place id>", "who": "..." } }` | Records a deed in the world, answered as the Game Master's own would be.                                                                                                                                                                                                                                                                           |
| `{ "give": { "item": "<catalog/entry or a name>", "count": 1, "who": "...", "summary": "..." } }`       | Gives an item (1.343): one of the game's ruleset items by its id, or any other by its name (with `summary` saying what it is), into the player's bag or the party member `who` names. It goes in as the Game Master's own would, so the inventory's rules apply. An id the game's ruleset does not offer is refused, with the reason in the reply. |
| `{ "fight": "<fight id>" }`                                                                             | Starts one of the script's fights (1.343). The Game Master is told to lead into it, and the fight that follows has the story's opponents.                                                                                                                                                                                                          |
| `{ "move": "<place id>" }`                                                                              | Puts the party at a place of the world (1.343), as a walk would; an `arrive` event it brings happens on the same turn.                                                                                                                                                                                                                             |
| `{ "ending": "<ending id>" }`                                                                           | Ends the game with one of the script's endings (1.343): its scene plays, the Game Master closes on its epilogue, and the player is shown the ending and offered to end the session. Nothing in the story happens after it.                                                                                                                         |
| `{ "music": "<track id>" }` or `{ "music": null }`                                                      | Cues one of its Experience's tracks over the place's music (1.345), until another cue, or `null` hands back to the place's. The track must be one of the map pack's `music`.                                                                                                                                                                       |
| `{ "recruit": "<person id>" }`                                                                          | Takes one of its Experience's companions into the party (1.347), with their sheet for the game's ruleset. The Game Master is told to show them joining.                                                                                                                                                                                            |
| `{ "dismiss": "<person id>" }`                                                                          | Lets a companion go from the party (1.347).                                                                                                                                                                                                                                                                                                        |

Each story feature needs a Capability API minor:

- clocks need 1.342;
- fights, endings, and the `give`, `fight`, `move` and `ending` actions need 1.343;
- music cues need 1.345;
- recruiting or dismissing companions needs 1.347;
- knowledge needs 1.348;
- `rest`, `travel` and `idle` events, a `priority`, a `party` condition, or more than 128 events need 1.349.

A companion is a person of the pack's people file marked as one (see the map pack's people in
[optional agent packages](../development/optional-agent-packages.md)).

Of the `rest`, `travel` and `idle` events that could happen on one turn, only one does: the one with the
highest `priority` (a whole number from -100 to 100, 0 when left out; the first in the script on a tie). A
companion's campfire talk, a pair of companions bickering on the road, or a companion coming to the player
in a quiet hour then never pile up. With a `party` condition, such a scene happens only while those
companions travel with the party. A script may have 256 events from 1.349 (128 before).

### Fights

A fight the story sets: who is fought, and where when the world has a board painted for it.

```json
{
  "id": "granary",
  "name": "The Granary",
  "creatures": [
    { "creature": "creatures/scarecrow", "count": 3 },
    { "creature": "The Owed", "name": "The Owed" }
  ],
  "battlefield": "b2",
  "note": "The jars break when hit."
}
```

Each creature is a bestiary creature of the game's ruleset, by its id (`catalog/entry`) or its name, and
`count` of them (numbered when there are several), called `name` in the fight when given. `battlefield`
is a board painted by hand in the world (`b<n>`), fought on wherever the fight starts; without one the
fight is fought where it starts, as any other. `note` tells the Game Master how it comes about. An id the
game's ruleset does not have is refused: those creatures are left out of the fight and the refusal is
logged. A fight left with none still starts as the story set it, on its battlefield, but the Game Master
picks its enemies.

### Endings

```json
{ "id": "kept", "title": "The Year Kept", "cutscene": "bells", "epilogue": "The valley stays held." }
```

`cutscene` is one of the script's scenes, played as the ending begins; `epilogue` is what the Game
Master closes the game on, and what the player reads when the ending is shown.

### Cutscenes

A cutscene is either shown to the player exactly as written, or told to the Game Master to narrate.

```json
{
  "id": "gates",
  "kind": "pages",
  "background": "backgrounds:generated:town-gates",
  "pages": [
    { "text": "The gates creak open." },
    { "speaker": "p11-3", "expression": "happy", "text": "Welcome, travellers." },
    { "speaker": "player", "text": "We come in peace." }
  ]
}
```

A `pages` cutscene plays before the Game Master's reply, in the narration, one page at a time: a page
without a speaker is narration, a page with one is that person's line, by their name in the world (or
the player's, for `player`), with an `expression` from the Game Master's own list. A `background` is a
background the game has, or `backgrounds:generated:<words>` to have one made when image generation is
on. The Game Master is told the scene was shown and carries on from it.

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

A `beats` cutscene is narrated by the Game Master in its own words, beat by beat, on that turn. A
`gm` event's beats are told to the Game Master with the event, and it narrates them in the reply
that marks the moment. So a beats scene a `gm` event uses is known to the Game Master from the start,
even when an Engine event plays it too. Since it is told them on every turn, the beats of all `gm`
events together are kept to 16,000 characters.

### The intro message

`intro` (Capability API 1.339) sets how the game opens, the same choice the GM setup offers any game:

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"` makes the game's first message exactly `text`; the Game Master writes nothing for it, and
regenerating it gives the same text. `"guided"` only shapes the opening the Game Master writes, as guidance
it reads for that first reply alone. `text` is 1 to 8000 characters and may hold line breaks (the one text
in a story that may), but never `{{`; guided text may not hold square brackets either. With `locked`, the
player sees the intro in the GM setup and cannot change it; without it, the intro only fills the setup's
field, and the player may change or clear it. A game whose first reply was already written, or that
carries its party over, has no intro.

## How a story plays

Once each turn, before the Game Master replies, the Engine reads what the story has done so far and
what this turn brings (a walk, a visit, a fight's end) and lets the events happen. What happens is
written into the start of that reply: a tag recording each event and what it set, and any scene shown
as written. Because the story is read back from the replies, a swipe or a regeneration takes back what
its reply did, and a story changed mid-game never rewrites what already happened. It carries into the
game's next session.

### The Game Master's tags

Each turn the Game Master is told the story's values (hidden from the player) and the directions in
force. Of the rest of the script it is told only what the script makes its own: the `gm` events (with
their `note` and any `beats` to narrate with them) and the `gm` flags, and which of those events it
cannot mark now (done, or held back by their conditions). It marks them in its reply:

- `[story: event="<id>"]` trips a `gm` event whose conditions hold (once, unless it repeats).
- `[story: flag="<id>" value="<value>"]`, or `add="<number>"` for a number flag, sets a `gm` flag.

A `gm` event's gifts, fight and move go into the reply with its tag; its ending scene and epilogue come
at the start of the next reply.

The Engine answers each tag in place, an event at most once a turn, and refuses anything else with the
reason. In a game with no story, every story tag is refused. What the Game Master
trips takes effect at once (its flags, its deeds); its scenes and what it asks come at the start of the
next reply, its `beats` excepted (it was asked to narrate them with the moment). Write a `gm`
event's `pages` as what follows the moment, since the Game Master has already told the moment itself.

## Trying a story

Save it to a game with `PUT /api/game/:chatId/story` and `{ "story": { ... } }`: a story that does not
fit is refused with every reason. The game's World tab lists the objectives and clocks the story has shown, and
the Game Master's prompt carries the story's values and directions each turn.
