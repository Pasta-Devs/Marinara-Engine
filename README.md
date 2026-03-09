# 🍝 Marinara Engine

### Release 1.1.0

**An AI-powered chat & roleplay engine** — with conversation, roleplay, and visual novel modes, a full character & sprite system, 18 built-in AI agents, turn-based combat, lorebooks, and more.

Everything runs locally. No accounts, no cloud, no telemetry. Connect to any OpenAI-compatible API (OpenAI, Anthropic, Google, OpenRouter, Mistral, Cohere, or any custom endpoint).

> **⚠️ Alpha Software** — This is an early release. Expect rough edges, missing features, and breaking changes between versions. Bug reports and feedback are very welcome!

---

## Changelog

### v1.1.0

**New Features:**
- **Gallery System** — A per-chat image gallery for storing and viewing generated/uploaded images. Accessible via a dedicated Gallery button on the chat bar.
- **Image Generation Provider** — New provider type supporting 10 sources (OpenAI DALL-E, Stability AI, Together AI, NovelAI, Pollinations, Stable Horde, AUTOMATIC1111/Forge, ComfyUI, Draw Things, Block Entropy).
- **Auto-Update Launcher** — The start scripts now automatically pull the latest version from Git on every launch. No more manual `git pull`.
- **Version Indicator** — Current version displayed at the bottom of the sidebar.

**Improvements:**
- **Agent Prompt Rewrite** — All 18 built-in agent prompts rewritten with improved clarity, tighter instructions, and consistent style.
- **Font System** — Custom font selection for the chat UI.
- **Chat Sorting** — Sort chats by name, date, or mode with persistent sort labels.
- **Chat Message Editing** — Full-width edit mode for chat messages.
- **V3 Character Card Import** — Support for the latest character card specification.
- **Bulk Import Progress** — Progress indicator when importing multiple characters.
- **HTML Rendering** — Inline HTML/CSS/JS rendering in chat messages for immersive elements.
- **Typewriter Speed Control** — Adjustable streaming text speed.
- **Agent Data Toggle** — Show/hide agent data panels per chat.

**Bug Fixes:**
- Fixed stop/pause generation button not actually stopping the stream.
- Fixed SillyTavern character and chat import failures.
- Fixed persona import not loading correctly.
- Fixed preset save errors when creating new presets.
- Fixed font color override not applying in some themes.
- Fixed streaming toggle not persisting across sessions.
- Fixed regeneration producing duplicate messages.
- Fixed server restart leaving stale connections.

---

## Features

### Chat & Roleplay
- **Three Chat Modes** — Conversation (iMessage-style), Roleplay (immersive dark RPG), Visual Novel
- **Character Management** — Create or import characters with avatars, personalities, backstories, and system prompts
- **Persona System** — User personas with custom names, avatars, and descriptions
- **Group Chats** — Multiple characters in a single conversation
- **Chat Branching** — Branch conversations at any message and explore different paths
- **Message Swiping** — Generate alternate responses and swipe between them
- **SillyTavern Import** — Migrate characters, chats, presets, and settings from SillyTavern

### Visual & Immersive
- **Sprite System** — Character expression sprites with automatic emotion-based switching
- **Custom Backgrounds** — Upload backgrounds with per-scene switching
- **Weather Effects** — Dynamic weather overlays (rain, snow, fog, etc.)
- **Two Visual Themes** — Y2K Marinara theme and a faithful SillyTavern classic theme
- **Light & Dark Mode**

### AI Agent System (18 Built-In)
Agents are autonomous AI assistants that run alongside your chat, each handling a specific task:

| Agent | What It Does |
|-------|-------------|
| **World State** | Tracks date/time, weather, location, and present characters |
| **Quest Tracker** | Manages quest objectives, completion, and rewards |
| **Character Tracker** | Monitors character moods, relationships, and inventory |
| **Persona Stats** | Tracks your protagonist's HP, MP, XP, and custom stats |
| **Narrative Director** | Introduces events, NPCs, and plot beats to keep the story moving |
| **Prose Guardian** | Rewrites AI responses to improve prose quality |
| **Continuity Checker** | Detects contradictions with established lore and facts |
| **Combat** | Turn-based RPG combat with initiative, HP tracking, and actions |
| **Expression Engine** | Detects emotions and selects character sprites |
| **Background** | Picks the best background image for the current scene |
| **Echo Chamber** | Simulates a live-stream chat reacting to your roleplay |
| **Prompt Reviewer** | Reviews and scores the assembled prompt before generation |
| **Illustrator** | Generates image prompts for key scenes |
| **Lorebook Keeper** | Automatically creates and updates lorebook entries |
| **Immersive HTML** | Formats roleplay output with styled HTML |
| **Consistency Editor** | Edits responses for internal consistency |
| **Spotify DJ** | Controls Spotify playback to match the scene mood |
| **Chat Summarizer** | Generates condensed summaries of long conversations |

All agents are disabled by default — enable only the ones you want. You can also create **custom agents** with your own prompts and tool configurations.

### Prompt Engineering
- **Preset System** — Save and load full prompt configurations (system prompt sections, sampling parameters, etc.)
- **Prompt Sections** — Modular prompt builder with drag-and-drop ordering, depth injection, and per-section toggles
- **Lorebooks** — World-building entries with keyword triggers that inject context automatically
- **Regex Scripts** — Custom text processing with regex find/replace on inputs and outputs
- **Macro System** — Template variables like `{{char}}`, `{{user}}`, `{{time}}`, and agent markers

### Connections & Providers
- **Multi-Provider** — OpenAI, Anthropic, Google, OpenRouter, Mistral, Cohere, and any custom OpenAI-compatible endpoint
- **Encrypted API Keys** — API keys are encrypted at rest with AES-256
- **Per-Chat Overrides** — Different presets and connections per chat

### Export & Data
- **Export Chats** — Save as JSON or Markdown
- **Fully Local** — SQLite database, all data stays on your machine
- **No Account Required** — Just install and go

---

## Installation

### Option A: Desktop App (Recommended)

Download the latest installer from the [Releases](https://github.com/SpicyMarinara/marinara-engine/releases) page:

| Platform | File |
|----------|------|
| Windows | `Marinara-Engine-Setup-1.1.0.exe` |
| macOS (Apple Silicon) | `Marinara-Engine-1.1.0-arm64.dmg` |
| macOS (Intel) | `Marinara-Engine-1.1.0-x64.dmg` |
| Linux | `Marinara-Engine-1.1.0.AppImage` |

Just run the installer and launch — everything is bundled.

---

### Option B: Run from Source

If you'd rather not run an installer, you can run Marinara directly from source. Same app, just without the Electron desktop wrapper.

#### Prerequisites

You need **Node.js** and **Git** installed before running Marinara Engine. pnpm is handled automatically by the start script.

**Install Node.js v20+:**

| Platform | How to Install |
|----------|---------------|
| Windows | Download the installer from [nodejs.org](https://nodejs.org/en/download) and run it |
| macOS | `brew install node` or download from [nodejs.org](https://nodejs.org/en/download) |
| Linux (Ubuntu/Debian) | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo bash - && sudo apt install -y nodejs` |
| Linux (Fedora) | `sudo dnf install -y nodejs` |
| Linux (Arch) | `sudo pacman -S nodejs npm` |

**Install Git:**

| Platform | How to Install |
|----------|---------------|
| Windows | Download from [git-scm.com](https://git-scm.com/download/win) and run the installer |
| macOS | `brew install git` or install Xcode Command Line Tools: `xcode-select --install` |
| Linux (Ubuntu/Debian) | `sudo apt install -y git` |
| Linux (Fedora) | `sudo dnf install -y git` |
| Linux (Arch) | `sudo pacman -S git` |

Verify both are installed:
```bash
node -v   # should show v20 or higher
git -v    # should show git version 2.x+
```

#### Quick Start

**Windows:**
```
git clone https://github.com/SpicyMarinara/marinara-engine.git
cd marinara-engine
start.bat
```

**macOS / Linux:**
```bash
git clone https://github.com/SpicyMarinara/marinara-engine.git
cd marinara-engine
chmod +x start.sh
./start.sh
```

The start script will:
1. **Auto-update** from Git (if a `.git` folder is detected)
2. Check that Node.js and pnpm are installed
3. Install all dependencies (first run only)
4. Build the application
5. Initialize the database
6. Start the server and open `http://localhost:7860` in your browser

#### Manual Setup

```bash
git clone https://github.com/SpicyMarinara/marinara-engine.git
cd marinara-engine
pnpm install
pnpm build
pnpm db:push
pnpm start
```

Then open **http://localhost:7860**. That's it — no account, no cloud, everything runs locally.

#### Updating

If you use the start scripts (`start.sh` / `start.bat`), **updates are automatic** — the launcher pulls the latest version from Git every time you start.

To update manually:
```bash
git pull
pnpm install
pnpm build
pnpm db:push
```

Then restart the server.

---

## Development

```bash
# Start both server + client with hot reload
pnpm dev

# Server only (port 7860)
pnpm dev:server

# Client only (port 5173, proxies API to server)
pnpm dev:client
```

### Building Desktop Installers

```bash
pnpm package          # Build for current platform
pnpm package:win      # Windows .exe
pnpm package:mac      # macOS .dmg
pnpm package:linux    # Linux .AppImage
```

Output goes to `release/`.

---

## Configuration

Copy `.env.example` to `.env` to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7860` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | `file:./data/marinara-engine.db` | SQLite database path |
| `ENCRYPTION_KEY` | *(empty)* | AES key for API key encryption (generate with `openssl rand -hex 32`) |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |

---

## Project Structure

```
marinara-engine/
├── packages/
│   ├── shared/      # TypeScript types, schemas, constants
│   ├── server/      # Fastify API + SQLite database + AI agents
│   └── client/      # React frontend (Vite + Tailwind v4)
├── electron/        # Electron desktop wrapper
├── start.bat        # Windows launcher
├── start.sh         # macOS/Linux launcher
└── .env.example     # Environment template
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS v4, Framer Motion, Zustand, React Query |
| Backend | Fastify 5, Drizzle ORM, SQLite |
| Desktop | Electron 33, electron-builder |
| Shared | TypeScript 5, Zod |
| Build | Vite 6, pnpm workspaces |

---

## Troubleshooting

### Windows: `EPERM: operation not permitted` when installing pnpm

If you see an error like `EPERM: operation not permitted, open 'C:\Program Files\nodejs\yarnpkg'` or a corepack signature verification failure, this is a Windows permissions issue — corepack can't write to `C:\Program Files\nodejs\`.

**Fix (pick one):**

1. **Run as Administrator** — Right-click your terminal (CMD or PowerShell) and select "Run as administrator", then run `start.bat` again.

2. **Install pnpm manually** (recommended — avoids corepack entirely):
   ```
   npm install -g pnpm
   ```
   Then run `start.bat` again.

3. **Update corepack** (if you want to keep using it):
   ```
   npm install -g corepack
   corepack enable
   corepack prepare pnpm@latest --activate
   ```
   Run these in an Administrator terminal.

---

## License

[AGPL-3.0](LICENSE)
