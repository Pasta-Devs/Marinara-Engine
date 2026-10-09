# Omnibar feature inventory

What the omnibar does today. This is a behaviour contract, not a design
document: if a change removes a line from this file, that removal must be
deliberate.

Rewritten after the concept work in `omnibar-concept.md` landed. The five panes
described by the previous version are gone; see section 1 and section 11.

Scope: `packages/client/src/components/layout/GlobalOmnibar.tsx`, the surfaces
under `components/layout/omnibar/`, the `lib/omnibar-*.ts` modules, and the
server global chat search the omnibar reads.

Related document: `omnibar-concept.md`, the design rules this implementation
follows. Historical build plans were removed after the implementation landed;
Git history retains them without presenting obsolete architecture as current.

## 1. Surfaces

One list, and the one surface that takes it over. The persisted `pane` holds two
values.

| Surface   | Purpose                                                          | Entered by                                                                                   |
| --------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `results` | The ranked result list. The default, and every open starts here. | Open, or Escape from a takeover                                                              |
| `mari`    | Professor Mari's work surface.                                   | The Mari button, `⌘↵`, a preview's Continue with Mari, a Mari-owned row, or the Ask-Mari row |

Two things render **inside** the list rather than replacing it:

- **Inline expansion.** A focused row grows to show its preview, or a choice
  control's options. The row itself grows; rows above it never move.
- **The aside.** A cheap answer that grows inside the promoted Ask-Mari row as
  that row's expansion, so it only ever pushes rows below the selection and
  nothing above the Ask row moves while it streams. It is not a row of its own:
  never ranked, never in the arrow-key cycle.

Rules that must survive:

- The omnibar always reopens on the list, because closing persists `results`
  rather than whatever pane was open. A session persisted with the removed
  `browse`, `detail` or `quick` panes also falls back to the list.
  `normalizeCommandCenterSessionState` deliberately **preserves** a persisted
  `mari` pane instead of resetting it: `GlobalOmnibarHost` requests Professor
  Mari by writing that pane and then opening the omnibar, so a reset on read
  would break every "open Mari" hand-off from Home, the FAQ and error recovery.
- Escape collapses an expansion if one is open; otherwise it leaves a takeover;
  otherwise it closes. One level, so Escape and the back arrow always agree.
- A view or menu inside the dialog (the settings sheet, Mari's mode,
  connection and paperclip menus, a Chats row's ⋮ menu) takes focus when it opens, keeps Tab inside, and handles
  Escape itself (`useInDialogFocusScope`); the dialog's own Escape needs a
  second press.
- Escape from a takeover never cancels a running answer.
- Leaving `mari` restores focus to the row it came from (`mariReturnResultId`),
  falling back to the input.
- The result preview renders from one `renderResultPreview` body, inline under
  the focused row and nowhere else. Only a "rich" result expands: media, prose,
  facts, or a setup/admin requirement.
- The expanded row has no header, card or divider of its own; the row's selected
  state is its only frame, and the body indents to the row's text column. The
  row's second line wraps to two lines, and the body adds only what the row does
  not show: a description that differs from that line, one Strip of at most four
  `.mari-chrome-control--compact` facts, FAQ steps as a short list of up to
  three, one muted Note line (a character's greeting, a chat's last message, a
  lorebook's first entry), and at most three `--small` action chips (`--danger`
  for remove). It opens with a 180 ms `grid-template-rows` + opacity animation,
  none under reduced motion or Reduce ambient effects.
- **One Mari thread per context** (R7, slice 62b). Each Mari chat stores a
  context key in its metadata (`mariContextKey`, plus `mariContextLabel` for
  display): `chat:<id>` from a chat, the open editor's result id
  (`character:<id>`, `lorebook:<id>`, `agent:<type>`, ...) from an editor, or
  "general" for Home and every other screen; threads from before R7 count as
  general (`mariThreadContextFor` / `readMariThread` in `lib/mari-arrival.ts`).
  An arrival door (⌘J, the pull, the drag, Home's "Ask", ⌘K's empty Ask Mari, a
  Fix-row pick that sends nothing) routes before the thread loads, through the
  pure `chooseMariThread`: the newest thread with the same key continues; with
  none, she continues her most recent conversation (however old; R13, slice 62g:
  a silent empty thread read as "she forgot everything") and the arrival shows
  two quiet buttons, "Continue here" (remembered for this context for the page
  session) and "New about <context>". Only with no conversation at all does a
  thread for the context start. An arrival while she is working never switches
  threads until the run has ended and its done line has shown for the same ~5 s
  the composer halo settles in (`composerHaloEnding`). "+" always starts fresh,
  keyed to the screen.
  An empty, unkeyed thread (the one first opening her made) is reused rather
  than left behind. The Chats panel (titled "Chats") rows show the Mari-chat icon
  in the row slot and one fact, "<context or General> · <time> · N messages";
  the current thread is tinted, and ⋮ shows on hover or focus (always on touch).
  Its search matches the label. Doors that send at once (a typed Ask Mari,
  a reopened past chat, a review row) keep the thread they target.
- **Mari arrives with context** (M9). Every door that brings no text (⌘J, the
  pull's right half and the desktop drag, Home's "Ask Professor Mari") goes
  through one path, `openProfessorMari(null, { arrival: true })`: it attaches
  this screen's context (the same `buildAskContext` as every handoff; the open
  chat travels as its outlined chat chip, not also as a "Current chat"
  resource) and, while her chat is empty, shows the arrival instead of the
  generic welcome: her sprite, one line and its facts, then ONE group of rows
  (R10): the things on that screen (a name the line already shows only when its
  row adds a fact), then 2-4 next steps (`MariNextStepCards`; a ✦ row sends its
  prompt to Mari at once — Shift-click or a touch long-press drafts it into the
  composer instead (N4, slice 45, `mariCardIntent`) — a `›` row acts at once).
  R10 replaced slice 41's visible "Asks Mari" / "Opens now" corner tags with the
  trailing glyph; the words stay as its tooltip and screen-reader text. N6 (R22): the arrival never falls back to the "Fix"
  row as its focus (`mariFallbackFocus`), so a typed question after an arrival
  carries no error text; only the failed-reply "Fix the last reply" card and the
  agent's "Why did the last run fail" card (`fix: true`) send with the error,
  through the same `chat-error` handoff as a deliberate pick of the Fix row. `buildMariArrival` (`lib/mari-arrival.ts`, pure,
  pinned per surface by the command-center regression) builds it on the client
  from `createOmnibarContext`, the chat store, cached query data and
  `lastAppError`; it gets names, counts and times only, never message text,
  and nothing is sent to a model until a card is picked or you type (R22).
  Surfaces: a chat ("You're in <chat> with <character>." · mode · messages ·
  last reply; Fix the last reply when it was cut at the token cap or failed,
  Why didn't an entry fire with an active lorebook, Summarize since the last
  summary, Peek at the prompt — its fact line is "What <character> gets next
  turn", not a second "Opens now"); the agent editor ("This is <agent>, one of your
  agents." · on for <chat> · last run failed; Pick a connection when the error
  names one, Why did the last run fail, Tighten its prompt, What do its
  settings do); a character, persona, lorebook, preset or connection editor
  (the open field and unsaved state; Improve <field>, Check consistency, for
  lorebooks Entries that never fire); Settings (the open section; Explain this
  section, Find a setting, which returns to the search scoped to `set:`, and
  Undo last change while a K5 flip can still be undone); the game setup wizard
  (its step as a label only). Home with nothing open keeps the generic
  welcome. The empty state waits for her chat to load, so it never shows,
  gives way to the history loader and comes back.
- The `mari` pane follows direction A (`docs/development/mockups/mari-v3/index.html`):
  text first, chrome last, and the accent only on her name.
  - Steps are quiet one-line disclosures: a verb icon, a past-tense label
    ("Read character Zylo Vantrell", `pastTenseStepTitle`), the duration, a
    chevron to the technical details. Her thoughts use the same line. The
    running step is only the live line (sprite, present-tense headline, timer);
    it is never also a row in the list.
  - A run reads top to bottom (M5a, slice 36): the goal she reported acting on
    (`latestUnderstoodRequest`, one muted "Goal" line that opens to the commands,
    mode and outcome; no model call), her steps as phases, a short answer, its
    reference cards, one outcome group, a "Why" line, then "Worked for".
    `groupRunPhases` (`lib/mari-work-timeline.ts`) buckets back-to-back steps by
    verb class (`stepVerbClass`, shared with the step icons): read/search are
    "Looked at N things", create/edit/delete "Changed N things", anything else
    "Ran N steps", plus "N failed". Every phase stays open while she runs (R13,
    slice 62g: folding them earlier hid the done marks); only the phase she is in
    reads live ("Looking 3") until she starts answering. Each done step row ends on
    a small green check that draws itself as the row plops in, and a phase whose
    steps all succeeded carries the same check on its summary line. When the run
    ends every phase folds to its line, which opens on click.
    App-data writes are labelled as writes ("Updating lorebook entry"), so they
    land in "Changed".
  - Her answer and what it made sit in one column with an avatar gutter on the
    left (`MariAnswer`), always reserved so nothing reflows when she arrives.
  - When the run ends, the live line becomes "Worked for Ns · N steps" at the
    bottom of the turn and folds the steps and thoughts away. On the newest
    turn her sprite rests beside her reply in that gutter, by its first line
    (success just after the run, then idle, or the retry / stopped / approval
    story); older turns keep only the words. A turn without words keeps her on
    the "Worked for" line instead, and the retry / stopped / approval words stay
    on a line under the turn. An answer without steps ends on a small check and
    "Done" in place of "Worked for". So she is always in the transcript: the welcome
    sprite when empty, the live line while she works, and the resting sprite
    beside her newest reply.
  - **Scroll contract** (slice 31): sending a message reserves
    `clientHeight − dock height` under the header so the new turn's question
    lands at the top; `grow` only autoscrolls while following and already near
    the bottom; `complete` never scrolls. Scrolling up to read while she works
    holds position through completion instead of snapping back down or
    getting stuck.
  - **Cards v5** (R10, slice 62d; mockup `docs/development/mockups/mari-v5/`):
    every Mari card is a row — slot · title · one muted fact · one trailing thing
    (`MariRow` in `mari-primitives.tsx`) — and rows that stack share one inset
    group (`MariList`: one hairline, one radius, dividers inset to the text edge;
    no box inside a box). Three radii only: the group (`--mari-card-radius`), the
    slot (`--mari-card-slot-radius`, concentric with the group corner, a circle for
    portraits) and capsules for buttons and badges. The fact never repeats the
    type the slot already shows. The trailing thing says what a tap does: `›`
    opens now, a gold `✦` asks Mari, a rotating `›` shows the change, a quiet
    Undo, one solid Keep. Calm states: hover is a faint fill, selected is a 9%
    primary tint, no lift and no per-card stagger (a group fades in once). On a
    phone the groups span the transcript and only her text stays beside the
    sprite; on desktop they start at the text edge, and references and next
    steps go two columns from a 36rem group.
  - Reference rows (`MariReferencedResources`) come right after her words:
    characters, personas and lorebooks she read, agents (keyed by type), chats,
    lorebook entries and settings she names in bold by their exact label
    (`findMariSettingReferences`). The fact (`mariReferenceFact`): a character's
    first sentence, a lorebook's entry count, an entry's lorebook and first key,
    a chat's people and when it last moved, an agent's On / Off (or "Last run
    failed") and its description, a setting's section. A portrait with a small
    type badge, or the kind's icon on the slot tile (`ResultTypeIcon`, Q6); a chat
    shows its participants with its mode as the badge. In a narrow group the
    rows are one line each (the fact truncates first). A list result shows only
    when her answer names it. A row opens the thing at once (`mariReferenceTarget`
    → `executeStateNavigation`; an entry opens its lorebook at that entry); its
    description is the row's tooltip.
  - Next steps (M5b, slice 37) are at most 4 rows of one "Next" group under the
    newest turn (`MariNextStepCards`), in the normal flow, not over the
    composer: icon, label, and one fact line from the server's `detail` (bounded to
    80 characters by `sanitizeMariSuggestionChips`; the prompt asks for a real fact
    such as "3 messages since your last summary", never a generic description). A
    spark card asks Mari: it sends its prompt at once (N4, slice 45); Shift-click or
    a touch long-press (500 ms) puts it in the composer to edit first. An arrow card has an
    `action` (`MariSuggestionAction`: open a character/persona/preset/lorebook/agent,
    open a chat, start a chat with a character, open a list panel such as
    Connections, Peek prompt) and runs it at once through `executeStateNavigation`
    or the omnibar's own start-chat / peek-prompt requests, with no Mari request.
    Held-change Accept / Don't apply and guided-plan answers stay as chips by the
    composer: they answer a question. The cards step aside while you type, like
    the chips did.
  - What needs your OK (held changes, install and sensitive-file prompts) and
    what changed (applied reviews, created/updated records, answered prompts)
    render as two groups (`MariOutcomeGroup`), what needs you first; the "Needs
    your OK" / "Changed" labels show only when both exist. One row per record: a
    created/updated result whose record a review in the same turn already shows
    is dropped (`withoutReviewedResults`), the review row stands for both. A trailing "Why:" bullet list in her
    answer folds into one "Why" disclosure (`splitMariAnswerWhy`); the server
    prompt asks for a one- or two-sentence lead, bold names for referenceable
    things, and at most three "Why" bullets.
  - An applied DB edit (`MariEditEasyViewer`: updates, inserts and lorebook
    entries alike) is one row per record, closed by default: avatar or icon,
    name, and what the change does in words (`reviewRowFact`: "Adds 2 keys:
    compass, heirloom", "Changed description and tags", "New lorebook entry").
    A one-record review carries its Undo and Keep in the row (Keep is the one
    solid capsule on a held change, quiet on an applied one, which it only
    closes); a batch ends in one line with its links and actions. Answered, the
    row stays in place as "✓ Kept" / "✓ Undone". It opens in place to tracked
    changes: old text struck and muted, new text underlined on a light tint,
    word by word when much of the old text survives (`trackProseChange`).
    Lists (tags, primary and secondary keys) are −/+ chips (`trackListChange`),
    one-word values (selective logic, probability) are a − old and a + new chip,
    and switches gather into one "Switches" line ("+Case sensitive",
    "−Whole words"; `fieldChangeStyle` decides). A new record's values read
    plain, not inserted. A new lorebook entry also shows its activation
    (Constant, Selective or Normal) and vector state as two plain chips. An agent edit
    (`agent_configs`) reads "Updated agent · …" with the agent's artwork (a
    monogram without one, like every record); its prompt
    template and description are tracked prose, and its nested `settings` JSON
    shows only under Raw (plain setting values still show as fields). A reply
    fix (`chat.updateMessage`, a `messages` change) reads "Reply · <chat name>"
    with meta "New swipe · old reply kept", the reply as tracked prose, and its
    Undo reads "Put the old reply back"; Keep refetches that chat's messages so
    an open chat shows the new swipe without a reload. The detail ends
    in one quiet links line: "Show exact changes" swaps every field to the
    line-by-line diff and back, View as prompt, and Raw, one disclosure (`.mari-tech`: tables,
    rows, the command and every created row's snapshot); the "Edit review opens
    in" setting opens it by default. Undo, Keep (and Keep and enable for a new
    memory) are small capsules (their hit area grows to 44px on touch); a
    multi-row lorebook entry's Reject stays a quiet link. No panel sits inside another. A folded row's content
    is `inert`, so its hidden buttons leave the Tab order.
  - A review renders inside the turn that asked for it, in its outcome group
    before "Worked for" (`assignReviewsToTurns`: the reply between the user
    message before `requestedAt` and the next one). One whose turn has no reply
    stays after the transcript.
  - Something she created or updated is a row of the "Changed" group
    (`MariWorkspaceActionResultRow`): portrait with a type badge or the kind's
    icon, name with "New" for a created record, one fact ("New lorebook · 4
    entries", "Changed description") and `›` to open it.
  - Risky prompts (install, sensitive file, delete) are a `MariCard`
    (R42): one neutral hairline, a small icon tile (red-tinted only for
    danger), one primary and one quiet text secondary. No glow, no gradient
    tile, no accent frame. The dependency-install ("Install nanoid") and
    sensitive-file ("Change package.json") prompts use it: the reason and the
    risk in one line, a solid Install / Apply change, a quiet Not now, and the
    exact package, integrity hash, source, full path and content preview behind
    one "Technical details" disclosure (`.mari-tech`). Once answered, it folds
    to one row of the "Changed" group with a check or minus (`ResolvedPromptLine`: "Installed
    nanoid", "Skipped: Change package.json") in the same place until the next
    send. A DB review that deletes is the `danger` variant: "Delete Old market
    rumor", the record type (plus "· 120 linked items" for its cascade, counted
    from `affectedRows` because the preview stops at 50 rows;
    `summarizeDeleteReview`), the reason plus that she already removed it for
    now, a note when the preview is truncated, a quiet "Put it back" and a red
    Delete, with Raw (the command and the removed row) behind one disclosure.
  - A failed send is one red line under your message with an inline Retry
    (`.mari-send-failed`), not a line of hers. A workspace-status error and
    missing workspace tools are `MariNote` lines (R43).
  - The end-of-run glow is a small, low, faint green band that sinks within
    3.5 s.
  - The header is two lines and has no portrait (she is in the transcript).
    Row 1: Back, "Professor Mari" with her status under it ("Ready to help",
    "Working on it..." with a soft shimmer while she works, "Needs your
    answer" while a review waits), settings and Close; the chat portals the
    status text into the row (`omnibarStatusSlot`). Row 2
    (`.mari-omnibar-header-row`): Skills, Memories and Aware of with its
    count, then Chats with New chat (+) right after it as one group behind a
    hairline that closes the row, at the right under settings and Close (Q5,
    slice 57b; above 30rem the other three stay centred). Every tab fits the
    bar at every width, so there is no ⋮ menu that would only repeat them (Q1,
    slice 56), except while a phone keyboard is open (R11, below). No mode
    control. Below 30rem the tabs show icon + count plus a short visible label
    under the icon (`context`'s short label reuses the "Aware of" composer
    chip copy), not only screen-reader text, so the icons are identifiable
    (F8/D2, slice 41); the full label stays for `aria-label`/`title`.
  - Aware of (M7, renamed from "What Mari sees" in Q3, slice 58; destination
    id `context`, keys `ui.chat.homeprofessormarichat.awareOf*`): the handoff
    facets ride above the textarea behind an "Aware of" label as `MariContextFacetChips`
    with `onRemove`, one X per facet (`withoutProfessorMariContextFacet`
    removes only that facet; the context clears once none is left). Chat,
    field and error facets are outlined (`professorMariFacetSendsContentLater`)
    with the tooltip "Name only for now. The content goes when you send." (R22).
    The panel is three `.mari-edit` groups: "With your next message" (the same
    facets, each with Remove), "Always in this Mari chat" (the persistent
    character/lorebook focus, attached chat histories that open their content,
    and "Attach a chat history"), and "How she works" (the model with context
    use when Show context usage is on, Change, and the sandbox state; this
    replaced the trust strip), then one privacy line. On a phone the panel is
    an opaque canvas sheet over the transcript.
  - Side panels (M6): Chats, Skills, Memories and Aware of share one
    surface: the canvas colour, one hairline on the left beside the stream, a
    full opaque sheet on a phone. They share `MariSidePanelHeader` (title, a
    hint of up to two lines, Close; on a phone Back instead; a sub-view such as an
    attached history keeps its own Back), the `.mari-side-search` field and
    `.mari-edit` group rows. Opening a panel focuses its first visible control;
    closing it returns focus to the tab that opened it, so Escape still steps
    back one level at a time (open row, then panel, then Mari). A Chats row is
    its name and one fact line, "Active · 4 messages" or "8m ago · 2 messages"
    (Q5, slice 57b, like the mari-v4 panel). Its
    Rename and Delete sit in its ⋮ menu (popover, Escape closes
    only the menu); Select keeps multi-select with Delete selected.
  - The composer (R11, slice 62e, composer v5; `.mari-workspace-composer`, its own
    shell, not the regular chat input's `getChatInputShellClass`, which stays for
    character chats) is neutral at rest with a primary ring only on focus. Inside
    one shell: a context row (attachment chips first, then "Aware of" and its
    facet chips, all capsules), the textarea, and a toolbar: attach, the connection
    menu (a red dot when none is set) and the Permissions Mode menu (Bypass in red,
    Plan in the primary colour) as quiet borderless 34px controls with a 44px
    touch area, then Send, a neutral filled circle (grey while empty). The field
    grows with a height transition to 8 lines (6 on a coarse pointer), then
    scrolls with a top fade (`data-scrolled`). Both menus use the v5 row anatomy;
    the mode menu keeps "Use default" plus the five modes, each with a one-line
    fact (`ui.chat.homeprofessormarichat.modeFact.*`; the full description is the
    row's tooltip), writes the same per-chat `PUT
    /professor-mari/workspace/permissions-mode { mode, chatId }`, and keeps the
    Bypass wording. On a phone both menus span the composer. While she works the
    bar folds into the unchanged Stop pill.
  - Phone keyboard (R11): while `useChatKeyboardOpen()` reports the software
    keyboard (below 40rem), header row 2 hides and a ⋮ menu in row 1
    (`omnibarMenuSlot`) lists Skills, Memories, Aware of, Chats and New chat; an
    open menu keeps the header compact. It expands when the keyboard closes.
  - **The composer floats over the transcript** (slice 30): scrolled content
    passes under it through a soft, always-on fade at the top and bottom edges
    instead of a hard cut, and her working glow shows through that fade rather
    than being boxed in behind the composer.

## 2. Query handling

- Input is deferred (`useDeferredValue`) so typing paints before the
  search, rank and present pipeline reruns.
- **Scope prefixes** (`lib/omnibar-scope.ts`): `faq:`, `docs:`, `msg:`, `chat:`,
  `char:`, `persona:`, `lore:`, `preset:`, `conn:`, `agent:`, `set:`, plus long
  and plural aliases. The colon is required. Everything downstream sees only the
  text after the prefix. A bare prefix with no query lists that whole category.
- **Inline ghost completion**: the first ranked title is completed after the
  cursor, accepted with Tab. It completes the name only — the sentence
  completion said the same thing as the add and removal suggestion rows.
- **Intent parsing** (`lib/omnibar-search.ts`): verbs are classified as
  `navigate`, `action`, `create`, `explain`, `recommend` or `repair`, and an
  object kind in the query ("add character eliza") narrows the search to that
  kind. A bare verb matches nothing by text and is answered by the verb
  suggestion builder instead.
- **Removal versus attach**: `remove`, `drop`, `detach`, `disable` and
  `turn off` are detaching verbs. "disable Tavern" never offers to attach it.

## 3. Result sources

Every builder is pure and lives in `lib/omnibar-results.ts` unless noted.

| Source                                                                         | Builder                                                                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entities: chats, characters, personas, lorebooks, presets, connections, agents | `lib/omnibar-entity-rows.ts`                                                                  | `preview` stays a thunk, built only for the focused row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| App commands and personal extensions                                           | `data.commands`                                                                               | Extension commands come from `personal-extension-contributions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Settings destinations                                                          | `lib/omnibar-settings.ts`                                                                     | Derived from `lib/settings-registry.ts`: 6 tabs, 32 sections and every searchable control, each deep-linking to a tab, a section or a control id. A control whose id is in `lib/omnibar-settings-toggle-bindings.ts` flips in place instead; everything else still only deep-links                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Quick controls                                                                 | `buildOmnibarControlResults`                                                                  | Theme and presence as choices; 9 hand-built toggles plus 46 settings-registry toggles bound via `lib/omnibar-settings-toggle-bindings.ts` (client-store booleans only — server-backed, permission-gated and non-boolean toggles stay deep-link-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Active-chat controls                                                           | `buildOmnibarChatControlResults`                                                              | Model, preset, persona (choices, capped at 6 plus the current value) and an agents toggle. These edit the chat in place — nothing navigates away                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| FAQ                                                                            | `buildOmnibarSearchResults`                                                                   | Ids are `faq:<id>`; opens the FAQ viewer modal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Documentation                                                                  | `useDocsCommandSearchProvider`                                                                | Passage search; opens the docs viewer at the match. A natural-language question searches on its real content words (`extractDocsSearchQuery`, `lib/docs-command-search.ts`), stripping question words and punctuation — slice 50 (O4 task 9) stripped the words client-side but the server's `/api/docs/search` still matched the leftover words as one literal phrase, which still almost never occurred verbatim in prose, so a fresh install with no model still got no docs rows for a question-phrased query; slice 51 (F4) fixed the server to match each content word independently (AND across words) instead. `docs/development` is excluded from this search, the docs viewer's index, and (since slice 51, F11) the `/api/docs/language` file-count status, except the small curated set in `DOC_ORDER.development` (`packages/server/src/routes/docs.routes.ts`'s shared `isExcludedDevelopmentDoc` filter), so internal working files (plans, value tables, mockup notes) never show up as "user docs" or inflate that count                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Messages in the open chat                                                      | `buildOmnibarMessageResults`                                                                  | Client-side over the shared transcript cache; 3-character minimum, 6 results                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Messages in every other chat                                                   | `buildOmnibarGlobalMessageResults`                                                            | The shared global chat search; see section 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Lorebook entries (name, keys, content)                                         | `buildOmnibarLorebookEntryResults`                                                            | Server-backed (`GET /api/lorebooks/search/entries?q=&limit=`), same typing pause and 3-character minimum as message search, with no scope or `lore:`. Choosing one opens the lorebook on Entries with that entry expanded and scrolled to. `⌘↵` on the row (or typing "why didn't X fire") hands Mari the entry's id plus the active chat; she calls the read-only `lorebook.testScan` action (wraps the same scanner the "Test" tool and real generations use) and answers with the exact gate reason and the setting to change, never the scanned chat text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Professor Mari's own conversations                                             | `buildOmnibarMariChatResults`                                                                 | They sit behind an internal marker and are absent from the chat list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Slash commands                                                                 | `buildOmnibarSlashResults`                                                                    | Chat surface only. Choosing one types it into the chat input rather than running it, so arguments stay visible                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Context rows                                                                   | `buildOmnibarContextResults`                                                                  | "What am I on?": the open editor, the current chat and everything attached to it, the last error, an unfinished creation session. A failed reply's "Fix: Generate reply failed" row now carries a `choice` control listing the chat's other language-generation connections (`languageConnections`, excluding the broken one): Enter expands it, picking one retries the failed message with it at once through a `marinara:chat-retry-with-connection-request` event (`handleRetryWithConnection` in `ChatArea.tsx`), without changing the chat's own connection (O4 item 3, slice 50) — Ctrl+K → Enter → pick is 3 steps. A failed agent run's "Fix: Run <agent name> failed" row (keyed on `agent:<type>`) is unchanged: Enter opens the agent editor. These are the only rows that hand Mari the error through the `chat-error` source door (`GlobalOmnibar.tsx`'s `buildAskContext`), and only when picked deliberately (⌘↵ on the row, or the arrival's Fix card) — an explicit `fix` flag on `buildAskContext`, never an implicit "focus id equals Fix row id" check, because a built-in agent's editor row shares its id with its Fix row. A door that picks nothing (the arrival, the "Ask Mari" row, the aside's ⌘↵) falls back through `mariFallbackFocus` (N6/A5), which keeps that row as the resource focus — so the agent/connection still reaches Mari — without ever attaching the error text; every other unasked Mari call carries no user content |
| Failed reply retry line (chat surface)                                         | `ChatArea.tsx`'s `failedReplyMessageId`                                                       | A failed generation leaves a quiet "Failed · Retry" line under the user message that triggered it (conversation/roleplay only), derived from the same `lastAppError` the K1 Fix row reads. Hidden while a reply to a newer message in the same chat is still streaming, so a fresh send never shows a stale failed line; dismissed on editing or deleting that exact message                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Chat tool rows (chat surface)                                                  | `buildOmnibarContextResults`                                                                  | Search this chat, Active lorebook entries, Summary (roleplay only) and Regenerate reply. Slice 61 (R2) removed "Preview next prompt": it showed the previous saved prompt when the last message was a reply, and its live fallback was never trimmed. In its place, when the newest reply has a reply-checkup finding (`diagnoseReply`: cut off, empty, older messages not sent, reply limit cut), "Fix: Check the last reply" leads the group (conversation and roleplay) and opens the checkup under that reply: one group of rows (R10), each finding with its number ("Cut off at 512 tokens"), why and the exact setting it opens, then Peek; Peek's header shows the same findings. Slice 62 (R3) gives Professor Mari her own read on the same checkup: `chat.diagnose { chatId, messageId? }` returns the findings, the generation's raw numbers (context/completion tokens, finish reason, what the context fit cut), the chat's attached lorebook budgets and the active preset's name and sampler parameter names — never message text. Asking her "why did that get worse" (or ⌘↵ on the checkup row) has her call it first, name one cause with its real number, and offer one reviewed fix (`preset.update`, `character.update`, `lorebook.updateEntry`) or the finding's own Chat Settings link. Each dispatches a `chat-floating-ui-events.ts` request the chat already listens for, so the row opens or runs the existing UI — nothing new behind it. Since the #7034 chat window redesign moved those tools out of the toolbar, Search this chat, Active lorebook entries and Summary open Chat Settings at their drawer (`ChatArea` → `initialSection`); Search this chat also focuses the search field. Continue is already reachable via the idle `/continue` slash row, so it gets no new row. Game mode gets only Active lorebook entries: it has its own turn-retry reset (`GameSurface`'s `handleRetryTurn`) instead of plain Regenerate, and no listener for Search this chat                                                                                                                                                                      |
| Idle rows                                                                      | `buildOmnibarIdleResults`                                                                     | Unfinished setup first (capped at 2), then recents, then surface commands                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Intent shortcuts                                                               | `buildOmnibarIntentShortcuts`                                                                 | "new character Bob" / "create a lorebook called Silver Court" open the create window with the typed name (casing kept); "chat with Shrek" / "new chat Dottore" / "talk to Eliza" open the start-chat window for each character whose name the text starts (up to three). Current-work group; nothing is created from the omnibar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| New chat commands                                                              | `buildOmnibarNewChatCommands`                                                                 | "New conversation" / "New roleplay" / "New game" are doors into the same `useStartNewChatMode` flow as Home's Conversation/Roleplay/Game buttons. Returned only on a real match, never idle and never as noise beside an unrelated query: a deliberate phrase ("new chat", "new roleplay", "start game", …) scores like the other intent shortcuts; a bare word ("game", "rp", "roleplay", "conversation") scores low enough to stay behind an exact entity name with that word as its title                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Frecent results (idle)                                                         | `lib/omnibar-frecency.ts`, `frecentIdleResults` in `GlobalOmnibar.tsx`                        | O2: the 3-5 results the user actually ran most on this surface (chat, editor, Home — recency and frequency, half-life decay, `localStorage` only, capped at 300 uses), as rows in a "Frequently used here" group that leads an empty query, ahead of Recent. Restricted (slice 51, F3) to rows that navigate somewhere (a chat, an entity, a navigation command) — never a settings toggle or any other write — so an empty Ctrl+K can no longer preselect something a reflexive Enter would silently flip; the idle preselection itself still lands on Recent, not this group. The same scores also give search-time ranking a small boost (capped well under any exact-name-match score) when there is a typed query, applied only to the final display order (slice 51, F8) so it can never be the reason "Ask Professor Mari" gets promoted or a row counts as the one unambiguous hit. "Clear search history" in omnibar settings now clears this store and the older per-command recency store together (slice 51, F7 — it used to leave the second one in place, still biasing ranking)                                                                                                                                                                                                                                                                                                                                                                        |
| Recent chats (idle)                                                            | `recentChatResults` in `GlobalOmnibar.tsx`                                                    | The four most recently active chats other than the open one, as ordinary chat rows in the Recent group. When the first Current-work row is only the open chat, the empty omnibar starts on the first of these, so Cmd/Ctrl+K then Enter switches back. Q6 (slice 58b): every chat row stacks its characters' faces (two, or two and "+N" past three) with the mode as a badge, says the last speaker and one line of the last message (`chatRowContextLine`, from the bounded Home feed; other chats show their cast), the relative time, and the attached-lorebook count as the lorebook icon and a number — still two lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Type icons (Q6)                                                                | `ResultTypeIcon.tsx`, `RESULT_TYPE_ICONS` in `lib/command-icons.ts`                           | One icon per kind, taken from the app's own panels: chat by mode (conversation, roleplay, game), Mari chat, character, persona, lorebook, lorebook entry, preset, agent, setting, command, doc, message, connection. A portrait keeps its picture and gets the type as a small corner badge; anything without one shows the type icon in the same slot. Used by the omnibar rows (and so their expanded rows), Mari's reference, outcome and next-step/arrival cards, the "Aware of" chips and rows, and her Chats panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Verb, attach and detach suggestions                                            | `buildOmnibarVerbSuggestions`, `buildOmnibarAddSuggestions`, `buildOmnibarRemovalSuggestions` | Answer a half-typed sentence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Creation proposal                                                              | `lib/omnibar-creation-proposal.ts`                                                            | Nothing is created until accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Choice values                                                                  | `lib/omnibar-choice-rows.ts`                                                                  | With a query typed, every choice control's options join the searchable set, so "gpt" reaches GPT-4 without finding the Model row first. They stay out of the idle deck. Each row carries its own `chooseValue`, so a row found by typing works when its control is nowhere on screen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| "Ask Professor Mari" fallback                                                  | `buildOmnibarSearchResults`                                                                   | Always last unless promoted. Opens Mari's takeover. The cheap answer arrives on its own, inside this row — see section 12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| "Continue with Mari"                                                           | `buildOmnibarContinueResult`                                                                  | Only when Mari is active or has pending approvals                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Pending Mari approvals                                                         | `buildOmnibarApprovalResults`                                                                 | A DB review is a Keep/Restore choice row titled by the one record it changed ("Mari changed Scene Critic", a reply fix "Mari fixed a reply in <chat>") or by the kinds of several (`describeTable`: "Agent", "Lorebook entry"), never a raw table name; an install or file write opens the Work pane card instead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

De-duplication is by result id, first source wins. Message rows from the open
chat and from the global search share an id shape on purpose, so a hit is never
listed twice.

### 3a. The settings registry

`lib/settings-registry.ts` is the single source of truth for settings
navigation: the 6 tabs, the 32 sections and every searchable control, with the
labels, descriptions and aliases they are found by. It is plain data — no
imports of stores, icons or components — so both the Settings panel and the
omnibar can read it. About 40 of the most-used controls also carry an optional
`keywords` array (O3, slice 49) — looser synonyms such as "bigger text" for
Chat Font Size or "night" for Color Scheme — that the omnibar matches but
scores below a label/alias hit (section 4). Every system command
(`lib/command-center-system-commands.ts`) carries the same optional field.

- `omnibar-settings.ts` **derives** its rows from it and states nothing of its
  own. It previously kept a parallel list of 25 controls; the two drifted until
  three of those 25 pointed at control ids that no longer existed, and choosing
  those rows opened the tab and silently failed to scroll. Of the 99 controls the
  registry defines, 22 had a row and 77 had none.
- `omnibar-settings.test.ts` fails if any emitted row names a tab, section or
  control the registry does not define. That check is the reason a second list
  cannot come back by accident.
- Strings are English and localized by `useLocalizedUiText`, the same path the
  Settings panel's own search uses. There are no `{ key, fallback }` pairs.
- `SettingsPanel`'s `TABS` keeps the icons and the i18n keys, and pins its ids
  to the registry with `satisfies`, so a renamed tab fails the build.
- A row deep-links to a control (`settings-control:<id>`), a section
  (`settings-section-detail:<id>`) or a tab (`settings-section:<tab>`). The tab
  ids keep that older shape because the context bonus matches on them.
- **The `omnibar` section (Q2, slice 57).** Every search and Professor Mari
  setting lives in the omnibar's own settings view (`OmnibarSettingsMenu.tsx`),
  not in the Settings panel: Search (context suggestions, clear search
  history), Quick answers (on/off, model, wait), Professor Mari (Ask Mari from
  Search, permissions mode, suggestion chips, edit review view, Enter sends to
  Mari, Mini Mari visits) and Appearance (the pack grid). Their
  registry entries use `sectionId: "omnibar"`; `isOmnibarSettingsTarget` sends
  any jump to that section or its controls (an omnibar row, the Settings
  panel's own search and Quick Access, Mari's setting links,
  `executeStateNavigation`) to `ui.openOmnibarSettings(controlId)`, which opens
  the view and scrolls to `#omnibar-setting-<id>` with its control focused. The
  omnibar stays open for these rows. Settings > General keeps one row,
  "Search and Professor Mari settings → Open" (Q3, slice 58: the user-facing
  name is Search; "omnibar" stays the code and doc name). The appearance packs are a grid of
  cards around visually hidden native radios (Tab, arrows, Space/Enter; the
  checked card has a primary ring and a check badge); previews are tier 3
  profile poses at 64 px, mounted only once the grid is within 200 px of the
  visible part of the view (an `IntersectionObserver` on the view's scroller).
  R12 (slice 62f): a pack with an `unlock: { playHours }` rule (Golden, 100 h)
  is locked until the Activity overview's `playTime.totalMs` reaches it: a
  disabled radio, a lock icon instead of the preview (none of its art loads),
  and "64h of 100h play time". A stored locked pick renders as Basic and keeps
  its stored id; the first time play time reaches the rule, the id goes into
  `mariUnlockedPackIds` (kept from then on) with one quiet toast.

## 4. Ranking

Score is the source score plus a context bonus plus an intent bonus, then the
shared command ranking (recency) reorders it.

- Text scoring prefers exact title, then prefix, then whole word, then substring.
- **Keyword synonyms (O3, slice 49).** A settings control's or command's
  `keywords` array is matched the same way, but any hit collapses to a fixed
  `KEYWORD_MATCH_SCORE` of 100 (`omnibar-search.ts`) — below every label/alias
  tier (substring starts at 100 + query length, so always just above a keyword
  hit) but still counted a literal match, so `filterOmnibarFuzzyFallback` does
  not discard it. A weak subsequence coincidence inside a keyword never
  qualifies; only a substring tier or better does.
- Context bonuses, highest first: the open resource (80, or "unsaved changes"
  when the editor is dirty), the current settings target (80), something used by
  the active chat (55), something related to a current error (50), available
  setup (35), the current screen (30), recent (15). The winning
  reason becomes the row's context label.
- **Top hit.** Groups render in a fixed category order, so the best match could
  sit below weaker rows of an earlier category. The best-ranked row with a
  prefix match or better (score ≥ 200) whose visible title the query starts —
  or starts one of its words — leads in a "Top hit" group, unless it is already
  the first row. Alias and metadata matches still rank but never lead, and rows
  from late sources (messages, docs) never do, so the top row stays still.
- "Ask Professor Mari" is promoted above the hits when the query reads like a
  question, when the intent is explain, recommend or repair, or when nothing
  matched well — unless one result is a clear direct hit (score ≥ 250 with a
  navigate, action or create intent).
- That promotion is also the aside's trigger (section 12). It is read back from
  the ranked list, not recomputed, so the two can never disagree.
- **Local frecency (O2, slice 48).** `lib/omnibar-frecency.ts` adds a small,
  capped boost on top of the score above, from past selections on the same
  surface (`frecencyBoost`, capped at `FRECENCY_BOOST_CAP = 15`, far below the
  lowest exact-match tier of 300+, so it can only break a tie or lift a weak
  fuzzy hit, never outrank a real name match). The cap and the exclusion of
  "ask-professor-mari" are enforced inside the pure scoring functions
  themselves, not only at the call site.

## 5. Actions

Typed actions (`OmnibarAction`) dispatch through `runResultAction`; results
without one fall through to the generic open path.

- `open-mari-chat`, `slash`, `goto-message`, `add-to-chat`, `detach-from-chat`,
  `refine-query`, `personal-extension`, `open-docs`, `open-faq`,
  `open-global-search` (the "See all results" row under message hits).
- A row with `chooseValue` applies that value and is checked before any other
  path. It exists so a choice option works wherever it was found.
- Direct active-chat actions: "add Eliza" with a chat open attaches instead of
  opening, but only when the result is unambiguous.
- A lorebook row's own Enter/tap attaches it to the open chat when it is not
  already active there (the same unambiguous rule as "add Eliza", but needing
  no verb) instead of flipping its global Enabled switch — that switch used to
  be the default action and, found by plain name, silently disabled the
  lorebook app-wide with no visible Undo (O4 item 1, slice 50). Already
  attached, or no chat open: Enter/tap opens the editor. The switch rendered
  beside the row is the only door left to the global toggle.
- Attaching a character or lorebook keeps the omnibar open, with the Undo
  toast, so the next one can be added. Other kinds close it: they can ask to
  replace the current persona, preset or connection, or open agent setup.
- Choosing an option of a chat-scoped choice control (`control:chat-connection`,
  `control:chat-preset`, `control:chat-persona` — the "Model/Preset/Persona for
  this chat" rows) closes the omnibar and shows a confirmation toast, the same
  as any other completed action; other choice controls (e.g. a setting like
  theme) keep expanding in place (slice 50).
- Attach and detach reuse the drag-and-drop payload and its block rules, so the
  omnibar can never make an assignment a drop would refuse.
- Every navigation passes the dirty-editor confirmation.
- The Enter hint on a row names what `choose` will do for it — Add, Remove,
  Ask, Review, Choose, Create, Start, Insert, Jump to, Search, Run, Read, Edit or Open — from the row's
  action, not only its category. A row that adds a character never says Edit.
- The Ask-Mari row's title is the text it will send (`Ask Mari: “…”`); its line
  says what she will do with it.
- FAQ matches, and docs matches for a single word under five characters, need
  the query at a word start (`matchesAtWordStart`), so "eli" finds Eliza rather
  than every answer that says "reliable".
- Preview actions never repeat what Enter does on the row: no Edit character,
  Resume chat, Open documentation, Open or Set default preset, and no Add, Remove
  or Start chip when the row's Enter already adds, removes or starts. What stays:
  start chat, add to or remove from this chat, Edit lorebook (now always opens
  the editor, since Enter on the row itself attaches or is a no-op, not an edit
  — slice 50), Ask Mari, and continue with Mari — the last only for chats,
  characters, personas, lorebooks and presets, the things she can change.
- On a touch screen the first tap on a rich row expands it and a tap on the
  expanded row runs Enter; the expanded row shows its Enter hint at every width.
  A chat row, a message row (`goto-message`), or a character/agent row is the
  exception: the first tap opens it directly (`resultOpensDirectlyOnTap`,
  `lib/omnibar-search.ts`), since a navigation row is what a phone user expects
  a tap to do (F4, slice 41; extended to characters and agents in O4 item 7,
  slice 50). Opening a chat on the phone shell no longer opens the Chats
  sidebar sheet over it afterward, and closes it if it was already open before
  the navigation (`executeStateNavigation`, `lib/state-navigation.ts`, F3 slice
  41 / O4 item 6 slice 50); the sheet only opens for a target that actually is
  the chat list. Starting a new chat (from the omnibar or the sidebar "+") also
  closes an already-open Chats sheet on the phone shell before the setup wizard
  opens (`hooks/use-start-new-chat-mode.ts`, O4 item 5, slice 50).

## 6. Cross-chat message search

The omnibar reuses the app's global chat search; it has no search of its own.

- Route: `GET /api/chat-insights/search` (`services/chat-insights/chat-insights.service.ts`),
  read through `useGlobalChatSearch`. The same search backs the Search All Chats
  modal, so both surfaces always agree.
- Quoted phrases stay together, other words must all appear, and matching is
  literal and case-insensitive. The server windows the snippet around the match
  and stops at a time budget on large libraries.
- `messageNumber` is the absolute position the goto-message jump takes.
- Professor Mari's chats are excluded by the search itself.
- The client only calls it at 3 characters or more, with no scope or with `msg:`,
  and shows the first few hits from other chats as rows.
- Choosing a hit in another chat opens that chat and then jumps: the goto request
  is keyed by chat id and survives the switch. The jump keeps retrying on a time
  budget until the transcript's own render window has actually widened around
  the target and the scroll has run, instead of giving up after a small fixed
  number of animation frames (`ChatArea.tsx`'s goto effect) — slice 50's
  frame-count retry (O4 item 2a) looked right in its own proof but still gave up
  before a switched-to chat finished mounting on the running app, landing the
  scroll on the newest message instead of the real hit; slice 51 (F2) fixed
  that for real, confirmed live. Both this path and the Search All Chats modal
  (`GlobalSearchModal.tsx`) share the fix, since both scroll through the same
  `gotoRequest` consumer.
- The full list, with filters, is the **Search all chats** command, which opens
  the modal. **Activity overview** is a command too.
- "Ask Mari" is never promoted above a direct hit from messages, lorebook
  entries or docs (`directHitCount` in `GlobalOmnibar.tsx`, F1 slice 41,
  extended to count docs hits too in O4 item 2b, slice 50) — but the row that
  was _selected_ did not always follow once a late-arriving hit demoted Mari, so
  Enter could still ask her even once the ranking was correct. Slice 51 (F1)
  made the selection follow the new top row too, whenever the user has not
  moved it themselves since the query last changed — Enter now reliably jumps
  to the hit instead of asking Mari.

## 7. Keyboard and pointer

This is the part most likely to break silently. All of it must survive.

- Opening: `⌘K` / `Ctrl+K`; `⌘J` / `Ctrl+J` ("Ask Mari about this", M18) opens
  it straight in Mari's pane with the screen's context (the same arrival as every
  other door, see "Mari arrives with context" in section 1); with Mari already open `⌘J` goes back to the
  search, and like `⌘K` it opens over any dialog. The host owns `⌘J` while the
  omnibar is shut, the dialog's own window listener while it is open
  (`isAskMariShortcut`, `lib/command-center.ts`; it is in the **?** list and the
  footer says "Ctrl/⌘+J Ask Mari", the Mari Back button's tooltip "Back to
  search (Ctrl/⌘+J)"). Tab is not a Mari door: in the field it accepts the ghost
  completion and otherwise moves focus through the panel.
  Desktop Home's address pill (`HomeBrowserHub.tsx`, `data-component="HomeBrowserHub.Address"`)
  is a real button, not a decorative `role="status"` field: clicking it opens
  the omnibar, and it shows a muted `Mod+K` hint instead of a star (F9, slice 41).
  On the phone shell a long press on Home, or a
  pull down on the top bar (and the safe-area strip above it). On desktop the
  same gesture is a mouse drag that starts on empty top-bar space, never on a
  control (M18), with the same threshold and halves. The pull
  locks after 10 px when it is at least 45° downward, and opens on
  release past 30% of the height (160-280 px) or on a flick (> 0.5 px/ms after
  40 px). Where the finger is at release picks the target: the left half opens
  the omnibar on search, the right half opens it in Mari's pane (the same door
  as Home's "Ask Professor Mari"; it leaves an open editor open, since she
  arrives with it as context), with a 28 px dead zone around the middle so
  the side cannot flicker; with Mari switched off the whole bar opens search.
  Pulling back under 85% of the threshold, a second finger or `pointercancel`
  cancels it. It never starts while the software keyboard or the omnibar itself
  is open, and a pull that starts on a bar button does not press it. Since L8
  (slice 28b, deliberate) it does start over a dialog or the game setup wizard:
  those cover the bar, so a touch that starts in the bar's strip on top of them
  is followed on the document (the overlay's click is swallowed after a real
  pull; a plain tap still reaches it), and the omnibar opens on top. Feedback (`OmnibarPullDrop`, painted once per
  frame from framer-motion values, no render per move) is a calm, symmetric
  sheet of the top bar's own surface (`--marinara-topbar-surface` over the app
  background, opaque at the bar, more see-through further down) pulled out of
  the bar's edge, ending in a circle with a small bar under it, both above the
  fingertip. The circle shows the magnifier or Mari's portrait from the active
  appearance pack; the small bar reads "Search" / "Ask Mari", and "Release to
  search" / "Release to ask Mari" once armed. At the threshold (one 8 ms
  vibration; 6 ms when the side changes) the sheet thins, lets go of the circle
  and draws back into the bar. On release the circle pops the dialog open
  (`takePullHandoff` hands over the panel, clipped to the circle before its
  first paint; the dialog skips its own pop-in) and the magnifier docks onto the
  search icon. On the Mari side the circle morphs into the present Mari (M17):
  the one sprite marked `data-mari-pull-target="mari-current"` (the live-line
  sprite while she works, else the one resting beside her newest reply, else
  the arrival/welcome sprite), scrolled into view first and re-measured every
  frame. Her head in the circle grows into the sprite's box (transform, opacity
  and the clip only; `pullMorphFrame`), cross-fades to the sprite's current
  sheet frame, and the real sprite shows under the identical morph before it
  fades, so there is never a double Mari. The arrival's line and cards wait at
  their first frame until she has landed. If no sprite appears within 2.5 s the
  circle reveals the dialog where it was let go and fades. The springs follow
  the pointer once per frame (a fast mouse or a 1000 Hz one cannot fling them).
  The overlay is removed even if the dialog never mounts. The
  recognizer, the target choice and the sheet geometry are pure
  (`lib/pull-to-open.ts`) and pinned by the command-center regression. Under
  reduced motion there is no sheet: a label above the finger, and the target
  opens at the threshold.
- **Pull drop at screen edges** (slice 33b): the sheet's rim takes the user's
  accent colour instead of a fixed white, the sheet keeps its full width and
  runs off the side instead of narrowing, the circle follows the finger to the
  edge while staying whole on screen, and releasing near a side pops the
  dialog open from the circle's position instead of from half off-screen.
- **Pull drop shares the edge state** (slice 62c, R8): while the top-bar edge
  line glows (slice 52), the rim and its shimmer take the same state colour —
  the working gradient with a slow waver, green when done, gold for an
  approval, red for an error — from the same CSS variables (`--mari-edge*`);
  `TopBar` passes its one `useMariEdgeGlow()` value to `OmnibarPullDrop`
  (`data-mari-edge`). With no state glow the rim keeps the accent; the body
  keeps the top-bar surface; reduced motion or reduced effects stop the waver.
  A mouse drag that locks as a pull clears any text selection and sets
  `html.mari-pull-no-select` (`user-select: none`) until that pointer comes up
  or is cancelled, so the desktop drag cannot select page text
  (`e2e/pull-drag-text-select.e2e.ts`).
- **Mari looks down on the pull** (slice 45b, N7): on the Mari side the circle
  shows a head from the selected pack's `pull-heads.webp` (six 96 px frames,
  prefetched with the tier-2 portraits). While pulled she looks at the
  screen's middle, where the chat or editor is: straight down within the
  middle third, back across the screen from a side (`pullGazeFrame`); a new
  gaze holds at least 150 ms (`holdPullGaze`). Armed, she peers over her
  glasses, or lights up when there is something to talk about. That is decided
  once per pull from the same screen detection (`resolveOmnibarScreen`) and
  arrival builder as the Mari pane, fed names from the query cache only:
  `mariPullAbout` turns the arrival into "Zylo's chat", "fix that reply",
  "Illustrator settings" or the open editor's name, and the armed label reads
  "Release · <that>" (R22: names and fixed phrases, never content; Home keeps
  "Release to ask Mari"). With Reduce ambient effects her gaze does not follow
  the finger; under reduced motion the label chip reads "Ask Mari · <that>".
- **Tiered appearance loading** (slice 38c): only the selected appearance
  pack's sprites are fetched; the Home "Your guide" card's greet pose (slice
  54: drawn at exactly 1x, 106x192, standing on the card's bottom border, no
  scale, rotation or animation) and the Home profile pose start with the page;
  the omnibar's own Mari portrait loads once the app goes idle so ⌘K, ⌘J and
  the pull show her at once, other poses (tour,
  FAQ, chibi) load lazily on first appearance, and switching packs in settings
  swaps the live images with no reload — no other pack's assets download.
- `↑`/`↓` move the selection; `Home`/`End` jump to the ends. No exceptions:
  there is no surface left that opts out of the keyboard model.
- `Enter` chooses. On a toggle row it flips the toggle; on a choice row it
  expands the row's options beneath it; on an option row it applies that value.
  `Shift+Enter` on a bound settings-control toggle row navigates to the
  control's spot in Settings instead of flipping it, the pre-K5 path.
- `⌘↵` / `Ctrl+↵` takes the selected result to Mari. Not offered for admin-only
  rows. Every Mari door follows one rule, `isMariInstruction`: typed text that
  asks for something is sent; typing only the row's name opens her with the
  draft. The footer hint says which ("Ask Mari" or "Continue with Mari"). There
  is no per-row Mari button: it put the expensive path on every free row.
- `→` expands a choice row's options, or a rich row's preview, in place. `←`
  collapses whichever is open, and otherwise returns focus to the input.
- **Expanded content is inserted below the focused row, never above it.** The
  focused row does not move, so `reconcileActiveResultId` stays valid and the
  two rules below cannot be violated by an expansion.
- `Tab` accepts the ghost completion when there is one; otherwise it cycles
  focus inside the dialog (the dialog traps focus).
- `Escape` collapses an expansion, then leaves a takeover, then closes. An
  Escape pressed inside the omnibar never reaches a dialog beneath it.
- Layering (L8): the omnibar, its Mari pane and Mari's own portalled
  popovers/dialogs sit on one CSS layer, `--mari-layer-omnibar` (globals.css),
  above every app overlay: the game setup wizard, lightboxes, `Modal`s,
  capability screens, the chat help overlay. `⌘K` opens on top of any of them;
  Escape closes the omnibar first, leaves the dialog intact and returns focus to
  it. A `Modal` opened while the omnibar is open (a confirm from Mari) takes the
  same layer and wins by DOM order; `⌘K` inside such a dialog does not close the
  omnibar under it. Over another dialog the panel gets an opaque backing
  (`data-over-dialog`). Only the sonner toaster (Undo stays visible) and user
  extension windows/menus (`PersonalExtension*`, near 2^31) sit higher. While
  the omnibar is open, the toaster also moves off its normal spot
  (`App.tsx`'s `Toaster`): bottom-right on desktop, and to the top under the
  omnibar's own header on the mobile shell — never bottom-center there, which
  would otherwise sit on top of Mari's composer dock. It returns to its usual
  position (top-center or bottom-center, following the notification-position
  setting) once the omnibar closes. The command-center regression fails on
  any numeric z-index at or above the layer.
  One more deliberate exception sits at the layer: the touch folder-drag ghost
  (`use-touch-folder-drag.ts`, equal to the layer).
- Over the game setup wizard the surface is the game setup: the quick answer
  and the Mari handoff use the `game-setup` entry point with the wizard step
  title as the only label (`data-game-setup-step`, R22).
- Native browser autocomplete is off on the input, because its popup steals the
  arrow keys.
- **Hover needs genuinely new screen coordinates.** Keyboard navigation scrolls
  the list under a resting cursor and the browser fires a mousemove for the row
  that slid beneath it; treating that as hover drags the selection back.
- **Arrow keys anchor on the highlight, not on DOM focus.** Hover moves the
  highlight without moving focus, so counting from the focused row would jump.
- The selection is pinned across re-renders by `reconcileActiveResultId`; the
  input's `onChange` must never null it.
- The active row is kept in view with `scrollIntoView({ block: "nearest" })`.

## 8. State and persistence

- Session state (`query`, `filter`, `pane`, `activeResultId`,
  `mariReturnResultId`, `mariHandoff`) survives a close and reopen. `pane` is the
  exception, and not because the normalizer rewrites it: the omnibar's unmount
  flush persists `results`, so the pane a session closed on is never restored
  (section 1 explains why the normalizer must leave a persisted `mari` alone).
  Every field here is read by something; a slot that is only ever written is a
  bug, not a feature (see section 11).
- Both expansions — the focused row's preview and a choice row's options — are
  component state, not session state. Every open starts from a bare list.
- Command ranking (recency) is persisted separately.
- Local frecency (O2) is a third, separate `localStorage` key
  (`marinara:omnibar:frecency:v1`): one `{ resultId, surface, timestamp }`
  tuple per selection, capped at 300, recorded by `recordUse` (the same
  function every row-activation path already calls, so this reuses the
  existing selection handler rather than adding a second one). Purely local —
  no network call, no server persistence. "Clear search history" in omnibar
  settings removes the key outright.
- UI-store slots the omnibar reads: `activeEditorField`, `lastAppError`,
  `creationSession`, the open-detail ids per resource kind, the settings target.
  `activeEditorField` is set by the character editor (per tab) and the agent
  editor (on focus of the name, description or prompt template; the id is the
  `agent.update` field name). It feeds the "Improve {{field}} with Mari" row,
  which sits after the "Editing …" row so an unpinned handoff carries the
  editor's resource beside the field; Enter on the row opens Mari with both.
- Mari can read the installed agent catalog (`agent.list`, merging the
  built-in/package registry with each type's `agent_configs` row), fetch one
  agent (`agent.get`, by id or type) and its recent runs (`agent.runs`) through
  the mari-db service — grounding for the agent editor handoff (L3) and the
  "fix this" row for a failed agent run (L2).

## 9. Accessibility

- The dialog is modal, labelled, and traps focus.
- A polite live region announces result counts, loading, and partial failure.
- Groups are sections with labelled headings.
- Every icon-only button has an accessible label.
- Motion respects `prefers-reduced-motion` throughout.

## 10. Performance constraints

- `preview` is always a thunk. Building preview data eagerly for every entity
  undoes the whole point.
- Row lookups are keyed by result id; a linear scan per rendered row showed up
  on large libraries.
- `chatControls` depends on the stable `mutateAsync` functions, not on the
  mutation objects, which are new every render.
- The bundle budget in `vite.config.ts` is a hard `this.error`, not a warning:
  500 kB per chunk, 1000 kB per entry. It measures `chunk.code` in memory, which
  is **not** the size printed in the build log — the same GameSurface chunk reads
  492 kB to the budget and 509 kB in the log. Debug budget failures with the
  budget's own numbers.
- The dialog's chunk is lazy, and `GlobalOmnibarHost` preloads it when the app
  is idle, so the first ⌘K does not wait on the network.
- Results that need a server round trip — message hits from other chats and
  docs — are the last groups, so a late answer never pushes down the row the
  arrow keys are on. Mari's own chats are fetched when the omnibar opens, not
  on the first keystroke, for the same reason.
- `OmnibarDetailPane`, `OmnibarMariPane` and `OmnibarAside` are lazy and mounted
  behind `Suspense`. So are Mari's Skills and Memories panels, which most
  sessions never open.

## 11. Deliberate non-features

Do not "fix" these; each was a decision.

- No "switch to game mode" action: game mode has a setup wizard and there is no
  safe one-call mode setter.
- The completion-action catalog never emits `show-field`. That branch is
  unreachable — do not re-add it.
- Image generation failures are not wired into error recovery: they are
  swallowed `catch {}` blocks with no single user-visible point.
- Message search does not rank by relevance, only by recency.
- **The omnibar does not roll dice.** It once did, and the branch was removed.
  The game input bar already has a Dices button with eight presets and a custom
  notation field, on the only screen where an omnibar roll was ever offered, and
  its roll queues onto your turn so the model sees the result — the omnibar's
  did not. Restoring it would also restore a dynamic-import rule, because a
  static import of the game stores from here breaks the bundle budget.

- **There is no return stack, and no persisted Mari destination.**
  `returnStack`, `mariDestination` and `mariDetailId` were persisted, capped and
  validated on read — and never read by anything. Escape steps back one level,
  and the Mari pane owns its own destination. `mariReturnPane` went with them: it
  could only ever hold `"results"`.
- **The pane union is declared once**, in `lib/command-center.ts`, next to the
  session state that persists it. `omnibar-result-view` re-exports it. Two
  hand-synced copies of the same union is how `browse` came to need deleting
  twice.
- **There is no Browse pane.** A grid of one category, in a takeover, with its
  own keyboard rules — it was the only surface that opted out of section 7. A
  bare scope prefix (`char:`) already lists a whole category as ordinary rows,
  with arrows, previews and Enter, and the app has real library screens for
  browsing by face. The idle-deck category chips now type the prefix instead of
  opening a grid, which also teaches the prefix by doing it. Compare and batch
  attach went with it: three deliberate steps to reach something the user could
  type.
- **The omnibar does not parse game commands.** `parseGameCommand` matched bare
  keywords — "map", "scene", "fight", "member", "setting" — with no verb and no
  intent check, so ordinary searches in a game chat were hijacked into a Mari
  handoff. The Ask-Mari row answers the same sentences without the false
  positives. This is the dice decision again, for the same reason.
- **A verb does not offer "kind" rows.** A bare "add" once listed "Add a
  character to this chat…", whose action typed `add character ` back into the
  input. A row whose action is more typing is not an answer; the add and removal
  suggestion builders already give the real rows.
- **There is no chat-to-world row.** It created an empty lorebook before Mari
  started, which stayed in the library whenever she failed or was stopped.
  Without that shell the row did exactly what the Ask-Mari row does, which
  already carries the open chat.
- **There is no scope-hint row.** The prefixes are taught by the category chips,
  which type one, and by the idle-deck subtitle. A row that teaches is a row
  that is not what the user came for.
- **There is no detail pane.** A preview expands under its own row instead. The
  pane hid the whole list on narrow screens to show one result. The wide-screen
  external panel is gone too; the inline expansion is the only preview.
- **There is no Quick pane.** The aside answers the cheap case without being
  asked, and the Ask-Mari row opens the takeover. Quick's one surviving job — a
  single-field rewrite from one model call — moved into Mari's takeover, where
  the proposal lands in the pending-change dock like every other change she
  makes. It remains one model call; applying or rejecting the proposal does not
  invoke the model again.
- **There is no floating Mari window, and no floating presence indicator
  either** (slice 53): the bottom-right corner button that used to show her
  state and open her is gone. The top-bar edge glow (slice 52, below) already
  carries that signal from any screen, which made the corner button
  redundant. She cannot sit beside an open editor; she is a place you go.
- **Her state on the app's top bar** (slice 52, fixed in slice 55): while she
  works, or has a result you have not seen yet, the bottom edge of the main top
  bar carries a thin line (about 1.5px core, short soft fade, fading out at both
  ends) in her state colour — her logo colours wavering slowly while she works,
  green when finished, gold when an approval waits, red when the newest change
  failed. It shows with the omnibar closed, from any screen (including on a
  phone, over a docked panel), and is off while Mari is turned off in omnibar
  settings. Opening her pane counts as seeing it and clears it; a new run or a
  newly arrived approval brings the line back
  (`nextMariEdgeSeen`/`resolveMariEdgeGlow` in `lib/mari-presence-seen.ts`,
  `useMariEdgeGlow`; the pane sets the transient `mariPaneVisible`). A
  screen-reader-only live region next to the line announces the same state.
  Reduced motion and Reduce ambient effects keep it as a static line. Her
  working glow behind the omnibar's Mari button fades out inside its own
  circle, so no ancestor crops it into a box.
- **Escape does not walk a pane stack.** There is one level to step back from.
- **Her sprite does not appear in the header or on older messages.** She has
  exactly one sprite in the transcript: the arrival (or welcome) sprite when it is empty,
  the live line while she works, and a resting sprite beside her newest reply
  (on its "Worked for" line only when the turn has no words). Her transcript rows are
  labelled instead.
- **A prose rewrite is not painted red and green.** That reads as
  wrong-and-right, when it is a rewrite. Old text is struck and muted, new text
  is underlined on a light tint, so colour is never the only signal. Structural
  changes outside an applied edit keep diff colouring.

## 12. The aside

The cheap answer, `hooks/use-omnibar-aside.ts` and
`components/layout/omnibar/OmnibarAside.tsx`.

- It renders as the expansion of the promoted Ask-Mari row (R9), through the
  same `expanded` slot of `CommandCenterResultRow` the inline preview uses, and
  only while that row is selected. There is no bottom slot. The answer never
  appears above the selection, and nothing above the Ask row moves while it
  streams.

- Fires only when the Ask-Mari row is promoted — a question-shaped query, an
  `explain` / `recommend` / `repair` intent, or no direct hit at score ≥ 250 —
  and only after the input has been idle. One predicate, already tuned, read
  back from the ranked list rather than duplicated.
- The delay is a knob, not a constant. Default 3s. Too short spends a call on an
  ordinary typing pause; too long makes the feature feel absent. The omnibar
  settings view offers 1, 2, 3 or 5 seconds as "Wait before answering"
  (`omnibarAsideDelayMs`, `OMNIBAR_ASIDE_DELAY_CHOICES_MS`).
- **The unasked call is a different call, not a trimmed one.**
  `buildQuickContextPayload` assembles it from scratch: the surface, the typed
  query, and the focused resource's label. It must never carry persistent
  memories or the contents of the focused field, both of which an _asked_ Quick
  call does send. `quick-context-payload.test.ts` pins this.
- `source` and `resourceLabel` come from where the user really is —
  `GlobalOmnibar` reads the open editor or the active chat off `omnibarContext`
  — not a hard-coded `"command-center"`. With Download Agents open, the label
  is "Download Agents".
- Defaults to the local sidecar, so nothing is spent unasked. The answering
  model is chosen in the omnibar settings view (it replaces the list inside the omnibar card, with a back arrow): the local model or any language
  connection, with a note that a connection may cost money.
- It also makes no call when message hits (this chat or others) or lorebook
  entries match: those arrive after the Ask row was promoted, and when the
  library already answers, no model is asked.
- Without a downloaded local model (and no connection chosen) it makes no call.
  A dead end shows one quiet line instead, offering "Choose a model" and "Turn
  this off".
- Nothing is front-loaded into onboarding. The first answer says where it came
  from and offers to turn the feature off, in place.
- A repeat of the same connection + query within a few minutes is answered from
  a small in-memory cache (`lib/omnibar-aside-text.ts`) instead of asking the
  model again.
- The idle countdown is silent; once the call actually starts, a "Professor
  Mari is thinking…" line with the thinking sprite shows until the first token
  (or the cached answer) arrives.
- The answer is shown with light formatting — bold, lists, inline code —
  through the message renderer Mari's transcript uses (`renderMarkdownBlocks`
  with `renderCompactInline`, `lib/markdown.tsx`), and the prompt asks for only
  that much markdown and exact on-screen labels. Blank lines collapse. The
  screen-reader announcement uses the text with markdown stripped. An answer
  cut off by the token cap is marked with a trailing "…" by the server.
- A finished answer offers Copy and "Answer again"; Answer again asks the same
  question past the answer cache.
- One follow-up line under the answer ("Ask a follow-up…") sends a second quick
  call with the first question and answer as `previous`
  (`ProfessorMariQuickPromptRequest`); follow-ups are never cached. The earlier
  answer stays above it, muted, with the follow-up question. The next question
  typed there goes to full Mari instead. Escape in that line returns to the
  search input rather than closing the omnibar.
- A failed call shows one quiet line and the `shrug` sprite, with "Try again"
  and "Choose a model" actions. Never a toast — the user did not ask for this
  call — and the ranked list is never degraded by it.
- Escalating from the aside sends the question to Mari; it does not only open
  her with a draft. Enter or a click on the Ask row, and `⌘↵` when no real row
  is highlighted (the generic Ask-Mari row does not count as one), escalate a
  live answer (streaming or complete) straight into Mari. After a follow-up the
  whole exchange travels (`omnibarAsideHandoffAnswer`). The aside's query and answer travel
  along as `context.asideAnswer` (`ProfessorMariAskContext`), and the context
  chip on the sent message — which lists every facet the handoff carried
  (resource, chat, field, settings location, error, aside answer), not just
  one — shows it stayed attached (`professorMariContextFacets`,
  `MariContextFacetChips.tsx`).
- A finished answer offers up to three things it names — a setting, a
  character, a lorebook, a chat — as chips that open them like their rows
  (`findMentionedResults`). It is local matching on names of six characters or
  more, in the order the answer names them; the model is never asked for ids,
  and rows with an inline control are never offered.
- The unasked call is grounded in the same docs corpus `docs_search` uses:
  `searchCanonicalDocumentation` runs against the typed query and, if it finds
  matches, the top three excerpts (`formatDocumentationGroundingExcerpts`,
  documentation-tools.ts) are flattened to one capped line each and added to
  the prompt. A compact "tab: sections" list of every real Settings label
  (`quick-answer-settings-labels.ts`, sourced from the same
  `SETTINGS_TABS`/`SETTINGS_SECTIONS` registry `@marinara-engine/shared` and
  the omnibar both use) is always added, so the answer can name a real label
  instead of guessing one. Docs and setting labels only — never chat,
  character, or other user data — and small enough to stay a hint, not a RAG
  pipeline.
- A capability word in the typed query ("images", "music", "maps"...) is
  matched against a small shared keyword map
  (`matchOmnibarCapabilityAgentPackageIds`, `@marinara-engine/shared`) to up to
  3 official Agent package ids. The server grounds the unasked prompt with
  those entries' real catalog lines
  (`formatCapabilityAgentGroundingLines`, `official-agent-knowledge.ts`) —
  static catalog data only, never user content. The client runs the same
  shared matcher on the query it already has (no extra round trip) to decide
  whether to show a "Download Agents" chip beside the answer; clicking it
  opens Agents → Download Agents filtered to the first matched package.
