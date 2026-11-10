# Fresh eyes: why the newcomer read is a subagent, and what was measured

Background for declauding's step 4a, the newcomer read. The failure it targets: reader-facing text written right
after a change takes its content from the change. The case that named it is the start screen of Tilt Rally, a phone
racing game, whose first step read *Lock rotation in portrait and pick your options here, upright.* after the
options moved off a sideways screen. *Here* and *upright* carry information only for someone who saw that screen; a
newcomer needed *Lock rotation in portrait, then choose your options below.* The bad sentence contains no word that marks a change, such as *now* or *no longer*. In the
same game's README, the setup paragraph said the steering is zeroed when the start lights go out, after the phone is
turned, while the Controls section still said it is zeroed when you tap the Start engine button, so the README
contradicted itself.

Three ways of catching it automatically were measured on Claude-written commits to READMEs, docs, write-ups and
pages. A fire is a passage the check flagged; whether a fire was real was judged by a separate model that had not
written the check (oaustegard/claude-workspace `docs/failure-modes.md` has the details):

| check | result |
|---|---|
| phrase list (*no longer*, *is now*, *instead of the old*, ...) over 400 sessions | 56 fires on about 12 distinct passages, 0 judged real; missed the start-screen case |
| Haiku judging each change as Before and After, 180 commits | fired on 38, 5 judged real; no threshold separated them |
| Haiku as a cold reader of the After alone, scoring the probability that it leans on an earlier version | ranked the real cases higher, but unstable: the start-screen case scored 0.82, then 0.44 |

The writer cannot be that reader: knowing the old version, the writer reads *upright* as obvious. A scoring judge sees fragments and guesses. A capable reader given the whole current section, and no access to the
old one, reads it the way the audience will. A Sonnet subagent given the Tilt Rally README that way found the
Controls contradiction above, which no fragment judge had been shown.

So step 4a and its Stop hook do not score anything. They decide only whether a read is owed, from a plain fact (did
this turn change visible prose in a reader-facing file?), and leave the reading to the reader.
