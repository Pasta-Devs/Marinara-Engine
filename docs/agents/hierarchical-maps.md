# Hierarchical Maps: Setup, Authoring, and Travel

> **Current compatibility:** This guide matches Hierarchical Maps **1.1.5** on
> Guksu Motor **2.3.3**. Maps 1.1.5 supports Engine 2.3.2 through the current
> 2.x releases. The package supports Roleplay and Game chats.

Hierarchical Maps adds a persistent story map to Roleplay and Game chats. Instead of keeping one free-text location, it can represent a world as nested places:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Customs House
    └── Old Sewers
```

Guksu keeps an authoritative current location in this hierarchy. The current path, exact location details, nearby destinations, and eligible lore linked to the exact current location can be included in the next reply's context. The AI cannot move the story merely by narrating that the party went somewhere; you choose a destination and commit the move with your next turn.

Hierarchical Maps works in **Roleplay** and **Game**. Each chat has its own map and current location.

## What a hierarchical map can represent

Each location can have:

- one parent and any number of children or siblings;
- a Region, Settlement, Place, Building, Floor, or Room type;
- a public description and private AI-only location notes;
- lorebook entries attached to that exact location;
- direct one-way or two-way links to other locations; and
- children displayed as a list, positioned map, or ordered layers.

Direct links are not limited to siblings. They can connect any valid places in the hierarchy: a ferry between towns, a stairwell between floors, a portal between worlds, or a secret passage between distant rooms.

Practical examples include:

- `World → Continent → Region → City → District → Building → Room`
- `City → Neighborhoods → Streets → Shops and landmarks`
- `House → Floors → Rooms → Closets or hidden chambers`
- `Dungeon tower → Floors 1–25 → Rooms, stairs, and boss arenas`
- `Star system → Planets → Settlements → Buildings`

A 25-floor tower should normally model the floors as 25 siblings under one tower, not as a 25-deep parent chain. Maps currently allow up to 500 locations and 20 levels of hierarchy.

## Quick start

1. Open the **Agents** panel, click **Download Agents**, and install **Hierarchical Maps**. If the catalog then offers **Update**, install that too.
2. Restart Guksu when the catalog asks.
3. Open the Roleplay or Game chat where the map should live.
4. Open **Agents → Hierarchical Maps**, turn on **Use in this chat**, and click **Create map**. You can also activate it through **Chat Settings → Agents → Tracker Agents** and open **Hierarchical map** there.
5. Choose **Draft with AI**, describe what you want, and click **Generate draft**.
6. Search and expand the complete generated hierarchy in **Draft preview**. Select places to review their descriptions, private model memory, and lore provenance. Regenerate or edit the prompt if needed.
7. Click **Continue to editor**, review the unsaved working map, and make any manual changes.
8. Set or confirm the starting location, switch the map to **Enabled**, and click **Save**.
9. In the chat, open the **Story map**, select a reachable place, and click **Set destination**. Send your next message to complete the move.

Applying an AI draft or importing a file changes only the editor's working copy. The map does not affect replies until you enable and save it.

## Install and activate the package

Open the **Agents** panel from the Sparkles tab in the right sidebar. Click **Download Agents**, select **Hierarchical Maps**, and click **Install**. If the installed card still offers **Update**, update it before continuing. The package includes server code, so follow the restart prompt before trying to use it.

Installing makes the feature available, but it does not turn it on in every chat.

The installed feature also appears as **Hierarchical Maps** in the main **Agents** panel. With a Roleplay or Game chat open, this page shows the installed package version, readiness, whether Maps is active in the current chat, the saved map status, and an **Open map** or **Create map** button. Map contents, current location, lore bindings, history, and drafts stay with that chat rather than becoming global agent settings.

### Roleplay

1. Open the Roleplay chat.
2. Open **Chat Settings** with the gear button.
3. Find **Agents** and turn on **Enable Agents**.
4. Under **Tracker Agents**, enable **Hierarchical Maps** for this chat.
5. Scroll back to the **Hierarchical map** setting that this adds.
6. Click **Edit hierarchical map**, then **Create map** if the empty-state prompt appears.

### Game

You can select Hierarchical Maps while creating a game, or add it later from that game's **Chat Settings → Agents** section. When selected during setup, Guksu can prepare a hierarchy from the accepted game world for you to review before play.

If you skip the generated map during setup, you can still build one later from Chat Settings.

## Understand the map editor

On a desktop, the editor shows three panes together. On a narrow screen, use the **Hierarchy**, **Local**, and **Details** tabs.

- **Hierarchy** shows the complete location tree. Select a location to edit it. **Enter** changes which part of the hierarchy you are viewing; it does not move the story.
- **Local** shows the selected location's immediate children as a map, ordered layers, or a list.
- **Details** edits the selected location, its lore, parent, display style, direct links, and status.

The editor header contains **Build with AI** or **Expand with AI**, **Export**, **Import**, the Enabled switch, and **Save**. Unsaved changes are marked **Unsaved**. Leaving the editor with unsaved work asks whether to discard it.

## Draft a map with AI

From an empty map, click **Draft with AI**. For an existing map, click **Expand with AI**.

### Choose what the builder reads

Under **Build from**, choose one of these sources:

- **Game setup** uses the current setup and characters. In a Roleplay chat, this means the chat setup and character cards. In a Game chat, it also uses the world overview and party characters.
- **Selected lore** lets you choose one or more available lorebooks. **Strict canon** creates only lore-backed places. **Canon + expansion** allows the AI to add fitting places around the selected lore.

The builder does not read turn history. Use the optional **What should this world include?** or **What should be added?** box for details that are not already in the setup or selected lore.

Choose a size:

| Size       | Approximate result |
| ---------- | ------------------ |
| **Small**  | 8 places           |
| **Medium** | 16 places          |
| **Large**  | 28 places          |

Click **Generate draft** or **Generate expansion**. Generation does not save anything yet.

The current **Draft preview** is a searchable, browsable preview of the complete generated hierarchy. It reports the number of locations and hierarchy levels, proposes a starting location, and lets you expand or collapse every branch. Select a generated place to inspect its full path, public description, private model memory, and—when lore grounding is used—whether it came directly from lore, was inferred from lore, or was added by the AI.

### Apply and review the result

Click **Continue to editor** for a new map or **Add to working map** for an expansion. This loads the result into the unsaved map editor; it does not enable or save it. Expand its disclosure arrows and select locations in the Hierarchy pane to inspect their children, descriptions, private memory, links, layers, and map positions.

If you do not like the generated result, use **Edit prompt**, **Regenerate**, or **Discard draft** directly from the preview. After continuing into the editor, the AI builder cannot generate over unrelated unsaved edits; save or discard the working changes before opening it again.

If a map exists but the story has no committed map history yet, the AI builder can also **Replace draft**. After the campaign has used the map, replacement is protected: expand the existing hierarchy instead so saved turns keep referring to the same location IDs.

For a saved map that has not been used in a turn, open **Expand with AI**, choose **Replace draft**, and generate a replacement. Once committed history exists, Guksu allows expansion but not wholesale replacement. Export the map before major restructuring.

## Build or edit a map manually

From an empty map, click **Build manually**. Guksu creates one broad starting location. Select it in the hierarchy, then use:

- **Add child** for a place inside the selected location.
- **Add sibling** for a place beside it under the same parent.
- **Duplicate** to copy a location subtree and then edit it.
- **Archive** to retire a location without erasing historical references.

Each location has these main fields:

- **Name** and **Icon** identify it in the editor and world map.
- **Kind** can be Region, Settlement, Place, Building, Floor, or Room.
- **Public description** describes the active place in location context.
- **Private model memory** gives the AI facts that should be active only at this location.
- **Awareness summary** is a short orientation cue.
- **Parent** controls where the location sits in the hierarchy.
- **Child presentation** displays its immediate children as a List, Map, or Layers.

For **Map** presentation, each child can have **Map X** and **Map Y** positions from 0 to 100. For **Layers**, give every child a distinct layer order.

## Understand what reaches the AI

When a saved map is enabled, each generation receives one authoritative spatial-context block containing:

- the current breadcrumb path, including parent names;
- the exact current location's public description;
- the exact current location's private model memory, when present; and
- the valid destinations reachable in one move.

Parent names provide orientation, but parent descriptions, parent private memory, and parent-linked lore are not inherited. If the current location is `Tower → Floor 7 → Alchemy Lab`, the lab's description and private memory are active; the tower and floor contribute their names to the path.

**Private model memory** is a saved AI-only note, not an automatically learned or self-updating memory. Use it for secrets, atmosphere, persistent hazards, local rules, or facts the model should know only while that exact place is current. For facts that must reach the model, use **Public description** or **Private model memory** rather than relying on **Awareness summary** alone.

### Add travel routes

A location is automatically reachable from its parent or its active children. Use **Direct links** for every other route, such as a ferry between towns, stairs between selected floors, or a secret passage between rooms in different buildings.

1. Select the source location.
2. Under **Direct links**, choose another location and click **Link**.
3. Add an optional direction label.
4. Choose **Available**, **Hidden**, or **Blocked**.
5. Turn on **Both ways** if travel should work in either direction.

Only available links appear as travel choices. A one-way link must be added from the location where the trip begins.

### Set the starting location and save

Select the location where the story begins and click **Set as starting location** under **Location status**. A map needs an active starting location before it can be enabled.

Switch the header control to **Enabled**, then click **Save**. If the editor reports issues, fix them before saving.

## Link lore to locations

Hierarchical Maps uses lore in two different ways:

1. The AI builder can read selected lorebooks while drafting or expanding the hierarchy.
2. A saved location can activate specific lore entries while that exact location is current.

To attach runtime lore:

1. Select a location and open **Linked lore** in the Details pane.
2. Search the available entries.
3. Click an entry to attach it.
4. Save the map.

Linked entries do not pass automatically from parent to child. Lore attached to Brinewatch does not activate while the current location is the Tideglass Inn unless you attach that entry to the inn too.

An eligible linked entry is selected as **current-location lore**, so it does not need a keyword match. This is more precise than normal keyword activation, but it is not an unconditional bypass of lorebook rules: disabled or chat-excluded books and entries remain unavailable, and entry conditions, timing, probability, and token budgets still apply.

Disabled lorebooks, disabled entries, and lorebooks excluded from the chat are unavailable to the map. The editor keeps unavailable or missing references visible so you can repair or detach them, but they are not sent to the model.

## Move during a story

Selecting a destination queues a move; it does not change the current location immediately. The move is committed together with the next message you send. This keeps the location and the turn in sync when you branch, regenerate, or change swipes.

Valid destinations are:

- the current location's parent;
- active children of the current location; and
- destinations connected by an available direct link.

Only one hierarchical move can be committed with a turn.

### Current one-move limit

**Set destination is already available in Maps 1.1.5**, but it accepts only a place reachable in one move. Browsing the world map can show locations farther away without making them immediately selectable.

For example, if Floor 1 and Floor 25 are siblings under a tower, the current flow is:

1. leave Floor 1 for the tower and send a turn;
2. enter Floor 25 and send another turn.

You can add a direct available link to make a specific jump reachable in one move. Automatic multi-hop **Set target** or **Plan route** behavior—which would remember a distant goal and walk the parent/child/link graph one valid step at a time—is not implemented yet.

### Roleplay travel

The **Story location** panel appears above the message box.

1. Open **Story location** to see **Leave**, **Enter**, and **Routes**.
2. Choose a destination.
3. Confirm that its status says **Moves with your next turn**.
4. Type and send your message.

Use the X on the pending destination to cancel it before sending. If the map or current location changed after you selected the destination, the status becomes **Needs review**. Open the picker and choose again.

### Game travel

Game Mode adds a **Hierarchical world map**. **You are here** marks the current story location.

- Select a place to read its description.
- Use **Explore** to browse inside a location. Browsing does not move the party.
- Use **Browse up** or the breadcrumb to view another part of the hierarchy.
- Use **Center current story location** to return to the party's position.
- Click **Set destination** when the selected place is reachable, then send the next turn.

If a place says **Browse only from here**, it is not reachable in one move from the current location. Browse back and choose an available parent, child, or direct route.

## Hierarchical world map versus the Game map

Game Mode can show two map systems:

- **Hierarchical Maps** tracks the authoritative story or world location, such as `The Shattered Coast → Brinewatch → Tideglass Inn`.
- The regular Game grid or node map tracks local, tactical movement inside that story location and also participates in Game time and weather.

An AI-written arrival or a regular Game map marker cannot change the hierarchical location on its own.

For advanced Game setups, a saved hierarchical location has a **Game map binding** section. You can bind a whole Game map, one grid cell, or one node to that story location. Selecting a bound Game position stages a hierarchical move; unbound positions keep normal tactical movement.

Save the hierarchy before changing bindings. A binding can be cleared later without deleting either map.

## Import, export, and archive safely

Use **Export** to download the working hierarchy as a `.hierarchical-map.json` file. Export before a major edit if you want a small, map-only backup.

Use **Import** to load a hierarchy into the working copy. Review it and click **Save** to make it authoritative. Import does not save immediately.

Once campaign history refers to a map, an imported map must retain every existing location ID. Add or update locations instead of replacing the hierarchy with unrelated IDs.

Archiving preserves old references. Before archiving:

- move or archive its active children;
- choose another active starting location if needed; and
- choose an active replacement if it is the current runtime location.

Archived locations can be restored from the Details pane.

## Troubleshooting

### Hierarchical Maps is missing from Chat Settings

Check that the package is installed, that Guksu was restarted after installation, and that the chat is Roleplay or Game. In the chat, turn on the **Enable Agents** master switch, open **Tracker Agents**, and enable **Hierarchical Maps**. Then scroll back to the **Hierarchical map** setting that appears.

### The map cannot be enabled

Create at least one active location and set an active starting location. Resolve every issue shown at the top of the editor, then enable and save again.

### AI generation is unavailable

Make sure the chat has a working language-model connection. Save or discard existing editor changes before opening the AI builder. For an expansion, choose an active location under **Expand beneath**. For lore-grounded generation, select at least one enabled, non-excluded lorebook.

### Review an AI draft before using it

Use the preview's search, **Expand all**, and **Collapse all** controls to inspect the complete generated hierarchy. Select a location to review its description and private model memory. Use **Edit prompt**, **Regenerate**, or **Discard draft** before continuing to the editor.

### A destination cannot be selected

The place must be the current location's parent, an active child, or the target of an available direct link. **Explore**, **Browse up**, and editor **Enter** only browse the map. They do not bypass travel rules or calculate a multi-hop route.

### A queued destination says Needs review

The definition or current location changed after the destination was chosen. Open the destination picker, review the current path, and select the destination again.

### The AI ignores the map

Confirm that Hierarchical Maps is active for the chat, the hierarchy is **Enabled**, and the latest changes were saved. Also confirm that a current location appears in the **Story location** panel.

### Linked lore does not activate

Confirm that the entry is attached to the exact current location. Check that the entry and its lorebook are enabled and that the lorebook is not excluded from the chat.

## Related guides

- [Agents: AI Helpers for Your Chats](agents-overview.md)
- [Downloadable Agents Reference](built-in-agents.md)
- [Lorebooks](../lorebooks/overview.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Game Mode: Map, Time, and Weather](../game/map-time-weather.md)
