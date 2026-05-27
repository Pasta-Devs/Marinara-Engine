# Marinara Engine

Marinara Engine is a local-first AI chat, roleplay, and game engine built as a Tauri desktop app. It combines a React interface, a TypeScript product engine, and Rust capability modules for local storage, managed assets, provider transport, integrations, and an optional hostable runtime.

This repository is an active refactor branch. The app is usable from source, but public release packaging and end-user installation guides are still being rebuilt around the new architecture.
The refactor build keeps an explicit in-app update check in Settings > Advanced. It checks Marinara Engine GitHub releases and opens the matching release page for manual install; signed Tauri auto-install artifacts are not configured on this branch yet.

## Screenshots

Screenshots are coming soon. The previous screenshot set was removed from this refactor branch because it no longer represented the current app structure.

## What It Does

- **Conversation mode** for character chats and direct-message style workflows.
- **Roleplay mode** for scene-based writing, characters, personas, sprites, backgrounds, choices, and roleplay state.
- **Game mode** for AI game-master sessions, party/game state, turns, assets, mechanics, and world tracking.
- **Creative library management** for chats, characters, personas, lorebooks, prompt presets, chat presets, provider connections, agents, gallery items, and knowledge sources.
- **Prompt and generation tooling** for presets, lorebooks, regex processing, context building, streaming generation, retries, branches, summaries, and agent-assisted workflows.
- **Provider connections** for OpenAI, Anthropic, Google, Google Vertex, Mistral, Cohere, OpenRouter, NanoGPT, xAI, Claude subscription mode, OpenAI-compatible custom endpoints, and image-generation backends.
- **Professor Mari** as a standalone assistant surface with access to selected app context and read-only creative-library tools.
- **Local-first data** backed by Rust storage and asset capabilities.

## Architecture

Marinara is split so product behavior, UI, runtime adapters, and privileged capabilities have clear owners:

- `src/app` - React bootstrap, shell, providers, and startup effects.
- `src/features` - React feature UI for catalog resources, runtime systems, concrete modes, and shell tools.
- `src/engine` - React-free TypeScript product behavior, contracts, generation, agents, repositories, and mode engines.
- `src/shared` - reusable frontend components, hooks, stores, browser helpers, generated bindings, and shared API adapters.
- `src/shared/api` - typed wrappers around embedded Tauri commands and the optional remote Rust runtime.
- `src-tauri` - Tauri host, Rust commands, HTTP server/dispatch, and capability crates for storage, security, assets, LLM transport, and integrations.

The optional hostable runtime is the Rust API server only. It does not serve the React UI. Desktop clients can point supported calls at it through the app's Remote Runtime URL setting.

## Run From Source

Prerequisites:

- Node.js
- pnpm
- Rust stable toolchain
- Tauri platform prerequisites for your OS

Install dependencies:

```sh
pnpm install
```

Run the desktop app:

```sh
pnpm tauri dev
```

Run the web shell only:

```sh
pnpm dev
```

Build the frontend:

```sh
pnpm build
```

Build the Tauri desktop bundle:

```sh
pnpm tauri build
```

## Remote Runtime

Start the hostable Rust runtime:

```sh
cargo run --manifest-path src-tauri/Cargo.toml --bin marinara-server
```

By default it listens on:

```text
http://127.0.0.1:8787
```

Health check:

```sh
curl http://127.0.0.1:8787/health
```

Non-loopback clients fail closed unless you configure access control. Use `BASIC_AUTH_USER` and
`BASIC_AUTH_PASS`, `IP_ALLOWLIST`, or an explicit opt-in such as
`ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true` for trusted LAN/private-network access.
Set `CORS_ORIGINS` or `CSRF_TRUSTED_ORIGINS` when the desktop client origin is not one of the
runtime defaults.

With Docker Compose:

```sh
docker compose up --build
```

## Developer Docs

Open the static docs directly:

```text
docs/developer/index.html
```

Or serve them locally:

```sh
pnpm docs:dev
```

Then open:

```text
http://127.0.0.1:4174/
```

The developer docs cover getting started, run/build commands, architecture, module ownership, and impact areas for changes.

## Validation

Use the checks that match the change:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:architecture
pnpm check:docs
cargo check --manifest-path src-tauri/Cargo.toml --workspace
```

Browser smoke tests are self-contained locally:

```sh
pnpm test:ui
```

Both browser smoke commands start a fresh preview server on port `4175` by default. Set `PLAYWRIGHT_PORT` if that port is occupied. Use `pnpm test:ui:run` only after `pnpm build` has already produced `dist/`.

The combined check is:

```sh
pnpm check
```

## Current Status

This branch is focused on the refactored desktop/runtime architecture. Public-facing installation pages, release notes, final screenshots, and license metadata should be added back when they are accurate for the new codebase.
