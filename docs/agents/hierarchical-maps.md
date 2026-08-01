# World Maps: Setup, Authoring, and Travel

> **Current compatibility:** This guide matches World Maps **1.2.5** on
> Marinara Engine **2.3.5 or later**. The package supports Roleplay and Game
> chats.

World Maps adds persistent world state to Roleplay and Game. Instead of
keeping one free-text location, it represents the world as nested places:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara keeps an authoritative current location in this hierarchy. The current
breadcrumb, exact location details, nearby destinations, and eligible linked
lore can ground the next response. Maps can also follow explicit movement or
discovery established by the latest user message. The visible AI narration can
describe the result, but it cannot move the map or invent locations by itself.

Maps can be independent per chat or linked to one account-owned shared world.
Templates create clean copies that can diverge. A shared world instead keeps one
canonical hierarchy and artwork set while each linked chat retains its own
current location, travel history, snapshots, and Game bindings.

## Feature overview

World Maps 1.2.5 provides:

- nested regions, settlements, places, buildings, floors, and rooms;
- breadcrumbs and an authoritative current story location;
- list, positioned-map, and ordered-layer views for child locations;
- parent/child travel, direct links, and multi-turn route planning;
- validated movement and discovery established by the latest user message;
- account-owned shared worlds that can be linked across Roleplay and Game chats;
- reviewed per-chat drafts with publish, discard, conflict, and detach controls;
- account-wide map templates created manually, with AI, or by import;
- AI-assisted map drafts and expansions grounded in setup or selected lore;
- public location descriptions, private model memory, and exact-location lore;
- one optional chat or Global Gallery reference image for each location;
- a separate chat or Global Gallery background for each positioned child map;
- reviewed batch generation for missing location artwork;
- a global, variable-based Maps artwork prompt override;
- location-reference support for Roleplay illustrations and Game Storyboards;
- import, export, archiving, history-aware editing, and Game map bindings; and
- global prompt libraries for AI map building and the runtime location insert.

Available destinations are included in the model context. When CYOA choices are
enabled, the model can therefore offer current children or connected places as
the next options. The exact choices remain model-generated.

## Choose the right map relationship

The library contains two reusable account-owned resources, while every chat
keeps its own runtime location and history. A resource's friendly name is not
its identity; World Maps 1.2.5 adds **(copy)** or a number when a newly saved
resource would otherwise have the same name.

| Resource or state             | Owned by                        | Choose it when                                                                    | What later edits affect                       |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| **Independent chat map**      | One Roleplay or Game chat       | This story should have its own world                                              | Only that chat                                |
| **Independent template**      | Your account                    | You want a reusable starting point                                                | New copies only; existing chats do not update |
| **Canonical shared world**    | Your account                    | Several chats should use one maintained hierarchy                                 | The shared definition used by linked chats    |
| **Linked-chat draft**         | One linked chat until published | A linked story discovered or edited something that may belong in the shared world | No other chat until you choose **Publish**    |
| **Detached independent copy** | One formerly linked chat        | This story should keep its current map but stop receiving shared-world edits      | Only the detached chat                        |

Copying is not linking. **Use template**, **Add to chat**, and **Independent
copy** create separate maps. **Use shared world** during Game setup and **Link
to chat** in the library attach the chat to the canonical shared world.

## Quick start

1. Open **Agents**, click **Download Agents**, and install **World Maps**.
2. Restart Marinara when prompted. The package contains server code.
3. Open a Roleplay or Game chat.
4. Open the dedicated **World Maps** globe when your Engine provides it, or use
   **Agents → World Maps**, and enable it for the current chat. You can also
   enable it from that chat's **Chat Settings → Agents** section.
5. Create the map with **Use template**, **Create with AI**, or **Build
   manually**. Existing chats can also import a map file.
6. Review the working hierarchy, choose a starting location, enable the map,
   and click **Save**.
7. Open the **Story map** while chatting. Select a reachable destination and
   send the next turn, or directly establish the party's movement in your
   message so Maps can validate and apply the arrival.
8. Optionally assign Gallery artwork to locations or use **Location artwork**
   to review and generate the missing images.

Applying a template, AI draft, or imported file changes only the editor's
working copy. It does not affect replies until the hierarchy is enabled and
saved.

## Install and activate the package

Open **Agents** from the Sparkles tab in the right sidebar. Click **Download
Agents**, select **World Maps**, and click **Install**. If the catalog
then offers **Update**, install that too. Follow the restart prompt before using
the package.

The World Maps page reports the installed package version and readiness,
offers the account-wide world map library, names the currently targeted chat,
and shows that chat's map status. Installing the package makes it available but
does not enable it in every chat.

### Roleplay

1. Open the Roleplay chat.
2. Open **Chat Settings** with the gear button.
3. Turn on **Enable Agents**.
4. Under **Tracker Agents**, enable **World Maps**.
5. Open **Edit world map** or the **World map library**. On supported Engine
   builds, the globe in the desktop top bar opens the same library; on mobile,
   use the globe in the Chats drawer.

The library behaves the same whether it is opened from the main Agents page or
from Roleplay Chat Settings. Use **Add to chat** for an independent template
copy, or **Link to chat** for a durable shared world.

### Game

During Game setup, choose World Maps and then select one of its setup routes:

- **Create with AI** prepares a generated hierarchy for review.
- **Use template** opens the world library before the Game is created.
- **Build manually** starts with an editable blank hierarchy.

After choosing **Use template**, the picker shows **Shared worlds** first and
**Independent templates** second:

- **Use shared world** links the new Game to that canonical account-owned
  world. The Game still keeps its own current location, history, snapshots,
  bindings, and unpublished discoveries.
- **Use template** creates a Game-owned working copy for review. It never edits
  the account template.

The selected resource's locations become the hierarchical starting world. A
fallback regular Game map is not promoted into its place.

You can also add World Maps to an existing Game later from **Chat
Settings → Agents**.

## Create and reuse map templates

Open **World Maps → Open world library**. Templates belong to
your account rather than one chat, so they are suitable for reusable fandom
worlds, campaign settings, dungeons, cities, or personal starter maps.

From the library you can:

- create a template manually;
- use **Create with AI** to draft it;
- import a `.hierarchical-map.json` file;
- search, view, edit, export, or delete a template;
- use **Add to chat** in an open Roleplay or Game chat; or
- choose **Use template** during Game setup.

Each application creates an independent working copy. Later edits to the
template do not change chats that already copied it, and chat edits do not
change the template.

Templates keep account-wide Global Gallery artwork references. When you use
**Save as template** from a chat, Maps promotes referenced chat artwork to the
Global Gallery and reuses an identical shared image when one already exists.
Each chat that applies the template then points to the same shared artwork
without creating another Gallery copy.

Only the artwork is shared. Each applied map definition is still an independent
working copy; editing the template does not update maps already added to chats.

## Link chats to one shared world

Use **Shared worlds** in the World map library when several Roleplay or Game
chats should read the same canonical hierarchy. Create a blank shared world,
import one, promote an existing template with **Make shared**, or open a saved
chat map and choose **Make shared**. The last option promotes its referenced
chat artwork to Global Gallery, creates the account-owned world, and links the
original chat back to it.

Choose **Link to chat** to attach the chat named by the library's target-chat
status. The current location and any location IDs already used by campaign
history must exist in the shared world. Otherwise, use **Independent copy** or
first migrate the chat's current map into a new shared world.

Linked chats share only the map definition and Global Gallery artwork. They do
not share messages, current locations, travel snapshots, Game state, Game map
bindings, provider connections, or credentials.

Edits and discoveries made inside a linked chat are saved as an unpublished
draft for that chat. They do not change the canonical world or other chats until
you choose **Publish**. You can instead **Discard** the draft or **Detach and
keep copy** to stop sharing while keeping the chat's current version. If the
canonical world changes while a draft is pending, Maps reports a conflict and
requires a detach or discard instead of silently overwriting either version.

Editing a shared world from the library updates the canonical definition
directly. The shared-world editor does not offer permanent location deletion;
archive locations so their stable IDs remain available. A linked chat also
cannot permanently delete any location until you choose **Detach and keep
copy**. A shared world itself cannot be deleted until all linked chats are
detached or relinked.

Shared worlds and templates retain Global Gallery artwork references without
copying the image file into every chat. Marinara blocks deletion of a Global
Gallery image while a saved template, shared world, independent chat map, or
linked-chat draft still references it. Remove the artwork links first when you
intend to delete the asset itself.

## Detach, replace, or start over

These actions answer different questions:

- To stop sharing but preserve the linked chat's current hierarchy, save or
  discard pending editor changes, then choose **Detach and keep copy**. The chat
  becomes independent and no longer receives canonical updates.
- To keep sharing but use a different canonical world, open the world library
  for the named target chat and choose **Link to chat** on the replacement. The
  history-compatibility checks still apply.
- To replace an independent chat map, open its editor and choose **Replace /
  start over**. You can save a template or export a backup first, then choose
  **Create with AI**, **Use template or shared world**, **Import map file**, or
  **Start blank**.
- To give a chat an unrelated map, use the same replacement flow. Removing and
  re-adding the Agent is not a map reset.

Replacement remains a working copy until **Save**. Saving a replacement clears
any queued destination or route. Once message history refers to location IDs,
Maps may reject an unrelated replacement to preserve historical breadcrumbs;
in that case, keep an independent copy and expand or archive the existing map.

## Understand the map editor

On desktop, the editor shows three panes. On a narrow screen, switch between the
**Hierarchy**, **Local**, and **Details** tabs.

- **Hierarchy** shows the complete tree. Selecting a location edits it.
  **Enter** changes the part of the hierarchy being viewed; it does not move the
  story.
- **Local** shows the current location's immediate children as a list,
  positioned map, or ordered layers.
- **Details** edits location text, hierarchy, lore, artwork, links, status, and
  Game map bindings.

The editor header contains AI building controls, **Templates**, **Export**,
**Import**, the Enabled switch, and **Save**. Unsaved changes are marked
**Unsaved**. Leaving with unsaved work asks whether to discard it.

### What a location can contain

Each location can have:

- one parent and any number of children;
- a Region, Settlement, Place, Building, Floor, or Room type;
- a name and icon;
- a public description and private model memory;
- a short awareness summary;
- exact-location lorebook links;
- one-way or two-way direct links to other locations;
- a List, Map, or Layers child presentation;
- a location reference image and optional image-use toggle;
- a separate child-map background when using Map presentation; and
- active or archived status.

For **Map** presentation, drag children into place or enter precise X and Y
positions from 0 to 100. The selected parent can also have a Gallery image
behind its children. For **Layers**, give every child a distinct layer order.

Direct links can connect any valid places in the hierarchy: a ferry between
towns, stairs between selected floors, a portal between worlds, or a secret
passage between rooms in different buildings.

A 25-floor tower should normally model the floors as siblings under one tower,
not as a 25-deep parent chain. Maps allow up to 500 locations and 20 hierarchy
levels.

## Draft or expand a map with AI

From an empty map, click **Create with AI** or **Draft with AI**. For an existing
map, click **Expand with AI**.

### Choose what the builder reads

Under **Build from**, choose one of these sources:

- **Game setup** uses the current setup and characters. In Game, this includes
  the world overview and party characters.
- **Selected lore** uses chosen lorebooks. **Strict canon** creates only
  lore-backed places. **Canon + expansion** permits fitting additions.

The builder does not read turn history. Add anything missing from setup or lore
to **What should this world include?** or **What should be added?**

Choose a size:

| Size       | Approximate result |
| ---------- | ------------------ |
| **Small**  | 8 places           |
| **Medium** | 16 places          |
| **Large**  | 28 places          |

Generation creates a draft, not a saved map. Search or expand the complete
preview, select locations, and review their paths, descriptions, private model
memory, and lore provenance. Use **Edit prompt**, **Regenerate**, or **Discard
draft** before continuing.

Click **Continue to editor** for a new map or **Add to working map** for an
expansion. After campaign history refers to location IDs, Maps protects those
references by allowing expansion instead of unrelated wholesale replacement.

## Build or edit a map manually

From an empty map, click **Build manually**. Maps creates one broad starting
location. Select it in the hierarchy, then use:

- **Add child** for a place inside the selected location;
- **Add sibling** for a place beside it under the same parent;
- **Duplicate** to copy a location subtree and then edit it; and
- **Archive** to retire a place without erasing historical references.

Set the story's initial place with **Set as starting location**. A hierarchy
needs an active starting location before it can be enabled. Turn on **Enabled**
and click **Save** after resolving any issues shown by the editor.

## Understand what reaches the model

Every generation with an enabled saved map receives one authoritative
spatial-context block containing:

- the current breadcrumb path;
- the exact current location ID and public description;
- the exact current location's private model memory, when present;
- destinations currently reachable in one move; and
- a bounded index of active known locations and their exact IDs.

The known-location index lets the response recognize an arrival elsewhere in
the saved world. Nearby destinations can also inform ordinary prose or CYOA
choices.

Parent names provide orientation, but parent descriptions, parent private
memory, parent artwork, and parent-linked lore are not inherited. If the current
location is `Tower → Floor 7 → Alchemy Lab`, the lab's details are active while
the tower and floor contribute only their names to the breadcrumb.

**Private model memory** is a saved AI-only note, not self-updating memory. Use
it for secrets, atmosphere, persistent hazards, local rules, or facts that
should be active only at that exact place. Put information that must reach the
model in the public description or private model memory rather than relying on
the awareness summary alone.

## Move during a story

Maps supports queued travel, planned routes, and validated user-led arrival.
Movement is saved with the turn so the location follows the selected message
history and swipe. Restarting Marinara does not intentionally reset the current
location; switching to a message branch or swipe restores the spatial snapshot
saved with that selected history.

### Queue an explicit destination

Selecting a destination queues a move; it does not move immediately. The move
is committed with the next message you send, keeping the location and turn in
sync.

One-move destinations are:

- the current location's parent;
- active children of the current location; and
- locations connected by an available direct link.

Only one hierarchical step can be committed with a turn. Use the X on the
pending destination to cancel it. If the map revision or current location
changes before sending, the pending move becomes **Needs review**.

### Plan a multi-turn route

Select a distant active location on the world map. If the parent/child and
available-link graph contains a path, Maps shows the shortest route and offers
**Plan route**.

A route queues its first step. Sending each subsequent user turn commits one
step and queues the next until the target is reached; there is no separate
advance button. Cancel the route at any time. If the map or current location
changes unexpectedly, the route becomes **Needs review** instead of guessing a
new path.

For example, travel from Floor 1 to its sibling Floor 25 normally takes one turn
to leave for the tower and another to enter Floor 25. A direct link can make
that journey one step.

### Follow user-led travel and discover new places

The latest user message is the authority for automatic map changes:

- Direct present-tense or imperative movement by the focal party establishes
  arrival. “We go to the Kitchen” and “She moves into the outdoor section; we
  follow her” can move to matching known locations.
- Explicit arrival at or discovery of a significant named, durable, revisitable
  place can add it to the world. “We discover a hidden room” can create and
  enter that location.
- The visible response may narrate the consequence, but AI narration alone
  never authorizes a move or new location.
- Future intentions, failed or unfinished travel, mentions, NPC-only movement,
  imagined places, temporary camps, hallways, vehicles, and other transient
  details do not create or move locations.

The model still has to interpret the user's phrasing and emit a hidden Maps
directive, which the application validates. Different language models may vary
on ambiguous prose. Use **Set destination** for a deterministic next-turn move,
or **Set current story location** to correct already-saved state.

A validated user-led arrival can bypass one-step reachability: Maps records an
available direct link from the current location when necessary. If a destination
was already queued, that queued move is first saved with the user message, then
the user-led arrival becomes the final location on the assistant response; the
one-shot queue is cleared. On a planned route, arrival at the next planned step
advances normally. Arrival elsewhere, including a jump to a later route step,
puts the route in **Needs review** so Maps does not silently rewrite the plan.
Cancel or re-plan that route from the resulting current location.

### Starting location versus current story location

The **starting location** is the default when a new story begins. The **current
story location** is where this particular chat is now. Changing the starting
location does not repair an existing chat's current position.

To correct saved state, select an active location in the editor's **Details**
pane and choose **Set current story location**. This is an administrative
correction, not narrated travel. It takes effect when you click **Save**, clears
the queued destination or route, and does not rewrite earlier messages.

### Roleplay travel

The **Story location** control appears above the message box.

1. Open the story map to inspect the hierarchy and current breadcrumb.
2. Select a location to read its description.
3. Use **Explore inside**, **Browse up**, or the breadcrumb to browse without
   moving.
4. Click **Set destination** for a reachable place, or **Plan route** for a
   reachable distant target.
5. Send the next message to commit the queued step.

### Game travel

Game Mode adds a **Hierarchical world map**. **You are here** marks the current
story location. Browsing, centering, and inspecting do not move the party.
Queue a destination or route and then send the next Game turn.

When the latest user message establishes the party's arrival, the generated
Game response can emit the hidden command that updates the hierarchical
location. Current location details then ground the GM, party, scene art, and
eligible Storyboard reference.

## Hierarchical world map versus the regular Game map

Game can contain two map systems:

- **World Maps** is the authoritative story or world location, such as
  `The Shattered Coast → Brinewatch → Tideglass Inn`.
- A regular Game grid or node map is local or tactical detail inside that story
  location and also participates in Game time and weather.

When World Maps owns Game startup, its selected template or reviewed
draft supplies the starting world. The regular Game map is not reused as prompt
input or promoted as a fallback hierarchy.

For advanced setups, a hierarchical location can bind to a whole Game map, one
grid cell, or one node. Selecting a bound Game position stages the corresponding
hierarchical move; unbound positions keep normal tactical behavior. Save the
hierarchy before editing bindings. Clearing a binding does not delete either
map.

## Add visual identity to locations

Location references and child-map backgrounds are independent even when they
reuse the same Gallery image.

| Artwork                      | Purpose                                                                                                                 | Sent to image generation?                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Location reference image** | Anchors the visual identity of the exact current place. Choose chat or shared Global Gallery art, or create with AI.    | Yes, when **Use for Roleplay illustrations and Game storyboards** is enabled and the request is eligible. |
| **Child map background**     | Appears behind movable child locations for a parent using Map presentation. Each map layer can have its own background. | No. It is display-only.                                                                                   |

Character or persona references preserve who is present; the location reference
preserves where the scene occurs. When supported by the provider, combining
them helps keep both characters and backgrounds consistent across images.

The image pipeline adds this instruction when an eligible location reference is
attached:

> Location handling: an attached location reference image is available. Use it
> to set the scene location.

Providers have their own reference-image limits. Explicit request references
and character references can reduce how many automatic references fit.

### Set one location reference

Select a location in the editor and open **Location reference image**.

- **Choose artwork** assigns a reviewed image from the current chat or the
  shared Global Gallery. The picker labels each source.
- **Create with AI** opens an editable establishing-image prompt and saves the
  result to Gallery before you decide whether to use it.
- **Use for Roleplay illustrations and Game storyboards** controls whether the
  selected image participates in eligible generation.

For a parent using Map presentation, open **Child map background** separately.
Choose a Gallery image, then position it behind the child markers. This image is
never sent to a provider merely because it is displayed on the map.

### Generate missing location artwork in a batch

The editor's **Location artwork** section finds locations missing references or
child-map backgrounds.

1. Click **Review requests**.
2. Review the request count before spending provider requests.
3. Confirm the image connection, model, Engine style, campaign-art-style state,
   saved image instructions, and output size.
4. Edit every positive and negative prompt if needed.
5. Cancel the review, or click **Generate N images** to confirm.
6. Review the generated artwork in the working map and click **Save**.

Each distinct missing image is a separate provider request. Large worlds can be
slow or expensive, so the review stays scrollable and keeps the request count
visible. Existing artwork is reused without another request when possible. A
new image becomes the location reference and also the child-map background when
that map needs one.

The exact edited positive and negative prompts shown in review are sent to the
provider. Positive prompt material is not copied into the negative prompt.

## Customize the automatic artwork prompt

Open **Settings → Generations → Prompt Overrides** and select **Maps location
artwork**. This is the global template used when Maps previews and generates
automatic location artwork. Variables use `${variableName}` syntax and can be
inserted from the editor.

| Variable                                            | Meaning                                                    |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `${locationName}`                                   | Location name                                              |
| `${locationDescription}`                            | Exact location's public description                        |
| `${locationType}`                                   | Region, Settlement, Place, Building, Floor, or Room        |
| `${locationPrompt}`                                 | Complete fallback establishing prompt prepared by Maps     |
| `${parentLocationName}`                             | Direct parent name, or empty at the root                   |
| `${parentLocationDescription}`                      | Direct parent's public description, or empty               |
| `${locationPath}`                                   | Full root-to-location breadcrumb                           |
| `${genre}` / `${genreLine}`                         | Raw or punctuated Game genre; empty outside Game           |
| `${campaignArtStyle}` / `${campaignArtStyleLine}`   | Campaign style only when **Use campaign art style** is on  |
| `${imageInstructions}` / `${imageInstructionsLine}` | Raw or formatted image instructions saved in Chat Settings |

The built-in template uses the exact location prompt plus optional genre,
campaign style, and saved image instructions. It intentionally does not include
the parent description or full path by default, which avoids forcing a parent
landmark such as a tower into every child or floor image.

Common customizations:

- Remove `${genreLine}` if the Game genre should not appear in automatic map
  artwork.
- Keep `${campaignArtStyleLine}` only if the per-chat **Use campaign art style**
  toggle should control that material. When the toggle is off, the variable is
  empty.
- Add `${parentLocationName}`, `${parentLocationDescription}`, or
  `${locationPath}` only when the provider needs that broader context.
- Use **Reset to default** to restore the built-in template.

The Engine style profile and global positive and negative image settings are
applied after this template. They remain part of the shared Illustrator/image
workflow rather than Maps-specific settings. If unexpected text remains in the
negative prompt, inspect the global negative image setting and the editable
review field.

## Link lore to locations

World Maps uses lore in two ways:

1. The AI builder can read selected lorebooks while drafting or expanding.
2. A saved location can activate entries while that exact location is current.

To attach runtime lore, select the location, open **Linked lore**, search the
available entries, attach the desired entries, and save.

Opening a linked lorebook entry leaves the map editor. Save the map first when
you want to keep other pending edits, or intentionally confirm that they can be
discarded. World Maps 1.2.5 warns before that action can discard unsaved map
changes.

Linked entries do not pass from parent to child. Lore attached to Brinewatch
does not activate at the Tideglass Inn unless it is attached there too.

Current-location lore does not need a keyword match, but it does not bypass
lorebook controls. Disabled or chat-excluded books and entries remain
unavailable, and entry conditions, timing, probability, and token budgets still
apply. Missing references remain visible in the editor so they can be repaired
or detached.

## Advanced Maps prompt settings

The main **Agents → World Maps** page owns two global prompt systems:

- **Generation prompt** is a named Roleplay/Game library for AI map drafts and
  expansions. Each chat can select an option independently. The resolved
  preview uses live setup, character, lore, and map context without making a
  model request.
- **Turn prompt insert** controls the global Roleplay/Game system text that
  presents the current location during ordinary turns. Marinara keeps the
  application-owned `<spatial_context>` wrapper and required authority
  variables around it.

The **Connection Override** on the same page affects AI map drafts and
expansions. Leave it empty to use the current chat connection. These settings do
not replace the separate **Maps location artwork** override under global
Generation settings.

These controls are intended for advanced customization. Preserve required
variables and use the resolved previews before saving.

## Import, export, and archive safely

Use **Export** from a chat, template, or shared-world editor to download the
working hierarchy as a `.world-map.json` file.
Leave **Include map artwork** enabled to bundle referenced location images and
child-map backgrounds in the same file. Disable it when you want a smaller,
definition-only backup. Older `.hierarchical-map.json` files remain importable.

Use **Import** to load a hierarchy into a chat working copy, independent
template, or shared world. Bundled artwork is
restored and its image links are remapped. Chat-owned artwork returns to the
destination chat's Gallery. Shared artwork is reused from the Global Gallery
when the same image already exists, or added there once when a template or
shared reference needs it. Review the result and click **Save** to make it
authoritative. Import does not save immediately.

Once campaign history refers to a map, imported changes must retain existing
location IDs. Add or update locations instead of replacing the hierarchy with
unrelated IDs.

Archiving preserves old references. Before archiving a location:

- move or archive its active children;
- choose another active starting location if needed; and
- choose an active replacement if it is the current runtime location.

Archived locations can be restored from the Details pane. World Maps 1.2.5
also offers **Delete permanently** for an archived location or fully archived
branch when it is safe to remove. The editor disables that action when the
location is the saved starting or current story location, appears in message
history, has a Game map binding, participates in a queued destination or route,
or belongs to a chat that is still linked to a shared world. The shared-world
and template editors do not offer permanent location deletion. Resolve the
named dependency first, detach the linked chat when appropriate, or keep the
location archived.

Permanent deletion removes the location from the working draft and cleans up
its hierarchy and direct-link references when you click **Save**. Closing
without saving still discards the deletion. Deleted locations no longer appear
in exports; archived locations that remain protected continue to be exported
so their stable IDs can support history and linked data. Do not edit exported
JSON to bypass these protections.

## Troubleshooting

### World Maps is missing from Chat Settings

Confirm that the package is installed and Marinara was restarted. The active
chat must be Roleplay or Game. Turn on **Enable Agents**, then enable
**World Maps** under **Tracker Agents**.

### Add to chat or Link to chat is missing from the world library

Open a supported Roleplay or Game chat before opening the library. The library
names the target chat and shows **Add to chat** for templates or **Link to chat**
for shared worlds. During Game setup the equivalent actions are **Use template**
and **Use shared world**.

If the library lists shared worlds during Game setup but does not show **Use
shared world**, the browser may still be running an older package client from
before the update. In any open map editor, save the map or intentionally discard
its draft, then close the editor. Save unrelated work, hard-refresh Marinara
once, and reopen Game setup. Newer Engine builds explicitly report when a
package update needs that refresh.

### Game setup used the wrong or fallback locations

Choose **Use template**, then confirm either **Use template** for an independent
copy or **Use shared world** for a canonical link before completing Game setup.
Review and save the Game map. A template remains unchanged; a linked Game keeps
changes unpublished until you choose **Publish**.

### The map cannot be enabled

Create at least one active location and set an active starting location. Resolve
every issue shown at the top of the editor, then enable and save again.

### AI map generation is unavailable

Make sure the chat or Maps **Connection Override** has a working language-model
connection. Save or discard existing editor changes before reopening the AI
builder. For an expansion, choose an active target. For lore-grounded
generation, select at least one enabled, non-excluded lorebook.

### The current location did not follow a message

Automatic movement requires the latest user message to directly establish the
focal party's arrival and the model to produce a valid hidden Maps directive.
AI narration alone, intent, discussion, failed travel, NPC-only movement, and
transient places do not move the marker. Try a direct phrase such as “We go to
the Kitchen.” Use **Set destination** for a deterministic next-turn move.

### The current location changed after reopening the chat

Confirm which message branch and swipe are selected; current location follows
the spatial snapshot saved with that history. If the selected history is right
but the marker is not, open the map editor, select the correct active location,
choose **Set current story location**, and click **Save**.

### A destination or route says Needs review

The map revision or current location changed after the move was queued. Open the
story map, review the current path, and select the destination or route again.
If the displayed destination is still queued, cancel it before selecting it
again.

### A planned route does not advance

Each user turn should commit the displayed next step and queue the following
one. There is no separate advance control. If one completed turn does not
advance the route, cancel and re-plan it from the current location. If the
saved location is already wrong, use **Set current story location** and **Save**;
that administrative correction clears the stale route.

### This chat should use a completely different map

Open the map editor and choose **Replace / start over**. Preserve a template or
export first if needed, then create, import, copy, or link the replacement. If
the chat is linked and should preserve its current hierarchy, use **Detach and
keep copy** first. Removing and re-adding World Maps does not erase its map.

### A distant location cannot be selected

Use **Plan route** if an active parent/child/link path exists. Otherwise add an
available direct link or travel through reachable places one turn at a time.
Browsing controls never move the story.

### The automatic artwork prompt always includes the Game genre

Open **Settings → Generations → Prompt Overrides → Maps location artwork** and
remove `${genreLine}` from the template. Save the override, then reopen the
artwork review.

### Campaign style appears when it should be off

Check **Chat Settings → Illustrator → Use campaign art style**. With that toggle
off, `${campaignArtStyle}` and `${campaignArtStyleLine}` resolve to empty. The
review summary should report campaign art style as **Off**.

### A parent landmark appears in every child image

Avoid `${parentLocationDescription}` and `${locationPath}` in the global artwork
template unless they are necessary. The default location prompt is scoped to
the exact location and omits those broad fields.

### The negative image prompt contains unexpected material

Review and edit the negative field before confirming. Then inspect the shared
global negative image setting. The Maps artwork template builds the positive
prompt; it is not copied into the negative field.

### A location reference is not used in images or Storyboards

Confirm that the Gallery image still exists and **Use for Roleplay
illustrations and Game storyboards** is enabled on the exact current location.
The child-map background is display-only and cannot substitute for a reference
unless the same Gallery image is also assigned as the location reference.

### The model ignores the map

Confirm that World Maps is active for the chat, the hierarchy is
**Enabled**, the latest changes were saved, and a current location appears in
the Story location control. Use the **Turn prompt insert** resolved preview for
advanced diagnosis.

### Linked lore does not activate

Confirm that the entry is attached to the exact current location. Check that
the entry and lorebook are enabled and the lorebook is not excluded from the
chat.

## Related guides

- [Agents: AI Helpers for Your Chats](agents-overview.md)
- [Downloadable Agents Reference](built-in-agents.md)
- [Lorebooks](../lorebooks/overview.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Game Mode: Map, Time, and Weather](../game/map-time-weather.md)
