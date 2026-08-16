# Game Mode: Experiences

An **Experience** is a downloadable package that takes over how a game looks and plays. Instead of the standard setup wizard and narration layout, the Experience brings its own — a rendered world, its own controls, its own setup form. The AI Game Master still runs the story underneath it.

The first Experience is **Pixelforge**, a walkable pixel-art RPG where your setup preferences generate the world. This page uses it as the running example.

## What an Experience changes, and what it does not

An Experience owns the surface of the game. The engine keeps running everything underneath. This split is what makes Experiences safe to try: your story, saves, and settings work the same way in every game.

| The Experience owns | The engine keeps |
|---|---|
| The setup form you fill in | The GM connection and every AI call |
| The play area (for Pixelforge, a rendered pixel world) | The story itself — turns, swipes, branches, checkpoints |
| Its own controls and on-screen buttons | Combat |
| How your actions become story turns | World Maps, agents, Chat Settings |

## Installing an Experience

Experiences install like agents. Open **Agents → Download Agents**, find the Experience in the catalog, and install it. Installing Pixelforge needs no restart — it is ready as soon as the install finishes. A package that does need a restart says so when it installs, and appears in the wizard after you restart.

Each catalog entry lists the minimum engine version it needs; Pixelforge needs Marinara Engine 2.4.3 or newer. Older engines don't offer it: an engine too old to understand the package skips its catalog entry entirely, and installing a package that needs a newer engine is refused with an error naming the version it needs.

## Starting a game with an Experience

1. Create a **Game Mode** chat as usual. The setup wizard opens.
2. On the first step, find the **Experiences** block and click **Show**. It lists every installed Experience.
3. Turn the Experience on. The wizard is replaced by that Experience's own setup form.

Turning the Experience off returns you to the standard wizard. Nothing else about the chat changes.

Every Experience still needs a GM connection — the Experience runs the surface, but the AI Game Master runs the story. Pixelforge asks for one in its own setup form and only lists text-capable connections.

## Playing Pixelforge

Pixelforge's setup form fits on one screen: a game name, a **Theme** (**Cozy village** or **Sci-fi colony**), a world seed, the setting, tone, difficulty, and content rating you would normally set in the wizard, and an optional **Party characters** pick — the villagers are NPCs, so bring your own characters or none. Pick a GM connection and click **Begin in Hearthvale** (the Begin button carries the current village name).

You start walking immediately. Move with the arrow keys, WASD, or the on-screen D-pad. Walk up to a villager and press **E** — or tap the Talk button, which reads **Talk to <name> (E)** once you are close enough. Pixelforge opens the conversation by sending a greeting turn for you; everything you then type in the message box drives the story, and the GM's narration appears in the panel below the world. Combat, when it happens, is the engine's own combat screen.

### Your preferences generate the world

Since Pixelforge 0.4.0, the setting text and preferences you enter decide what the world contains. Shortly after the game starts, Pixelforge makes one structured GM call that plans the settlement: who lives there, which households they belong to, which buildings and landmarks exist. A deterministic builder then lays out the map from that plan — the AI decides what exists, the algorithm decides where every tile goes.

This happens in the background while you play:

- **"Generating your world — keep exploring meanwhile…"** appears when the game starts. You are walking in a default themed world in the meantime.
- **"The world takes shape."** means the generated world is ready. The map rebuilds in place.
- **"World generation couldn't run — it will retry next visit."** means something temporary got in the way (the engine was busy, or the network dropped). The default world is fully playable, and generation tries again the next time you open the chat.

Generation happens once per game. If the AI's plan cannot be used at all, Pixelforge falls back to a built-in plan for your theme — the map still rebuilds ("The world takes shape."), just with the stock cast and places. The game always works.

### Saves follow the story

The world's state — where you are, the in-game clock, what has been introduced — is saved with the story timeline. If you swipe a GM response, branch the chat, or load a checkpoint, the world rewinds with the story, and a toast says so. You never manage world saves yourself.

## If things look plain

Pixelforge ships authored pixel art, and falls back to simpler procedural art whenever that art cannot load (for example, on a network hiccup). The game keeps working either way, and it retries loading the authored art on its own.

## Uninstalling mid-campaign

If you uninstall an Experience's package while a campaign is using it, the chat is not lost. The next time you open it, the standard Game Mode layout is back and the story continues without the Experience's surface. Reinstall the package to get the surface back.

## Building your own

An Experience is a capability package that contributes a `game-surface` — the same packaging system agents use, with a client entrypoint that renders the game. Pixelforge is open source and is the reference implementation: its package source, build scripts, and the World Brief specification behind its world generation live in the `packages/pixelforge` folder of the [Marinara-Agents repository](https://github.com/Pasta-Devs/Marinara-Agents).

## Related guides

- [Game Mode: Getting Started](getting-started.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Game Mode: Sessions and Saves](sessions-and-saves.md)
- [Game Mode: Combat](combat.md)
