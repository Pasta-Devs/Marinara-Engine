# dev-mcp: a developer MCP server for Marinara Engine

Version 1.0.0

`tools/dev-mcp` is an **optional developer tool**. It is a small [MCP](https://modelcontextprotocol.io) server that lets a coding agent (Claude Code, Codex, or any other MCP client) look inside a Marinara Engine running on your machine and, when you allow it, change and restart it. Nothing in the app depends on it: it is not part of the pnpm workspace, it is not built or shipped, and you can ignore or delete the folder without affecting anything.

## Why it exists

When you work on the engine with an agent, a lot of time goes into things the agent cannot see directly:

| Today | With dev-mcp |
|---|---|
| Open `packages/server/data/logs`, search JSON lines by hand for the reference from an error toast. | `lookup_error` takes the `errorId` (or the `x-request-id` header) and returns the matching lines with stack traces plus the whole request trail, in order, ending with its `request.end` line. |
| Scroll through warnings to find what keeps failing. | `logs` groups warnings and errors by event and message, with counts and the last errorId / requestId to follow. |
| Guess why the prompt cache hit rate dropped. | `cache_report` shows the hit % per reply; `diff_prompts` shows exactly where two prompts start to differ, which is where the provider's prefix cache breaks. |
| Check whether a card or rule really reaches the model by adding debug logging. | `get_prompt` returns the exact request the engine saved for a reply, or a free preview of the next turn (no model call), with an outline and a text search. |
| Stop the server by hand, rebuild, start it again, hope nothing else was running. | `restart_engine` takes a lock, waits until nobody is mid-turn, backs up `dist`, builds, relaunches, and rolls back to the previous build if the build fails. |
| Try a risky change on your real data. | `sandbox_refresh` starts a sanitized copy of your data on another port, with every credential removed, so experiments cannot touch real chats or spend model quota. |

## Tools

| Area | Tools |
|---|---|
| Orientation | `engine_status` (running?, process chain, the engine's own startup summary from `/api/health` or the `startup.ready` log line, build times, git state, lock, seconds since the last generation, recent activity), `git_status`, `activity_log` |
| Chats | `list_chats`, `read_messages`, `chat_settings` (connection, preset, game special instructions with length vs the 2000-character limit, continuity config) |
| Prompts and cache | `get_prompt`, `cache_report`, `diff_prompts` |
| Diagnostics | `logs`, `lookup_error`, `continuity_status`, `list_connections` (never returns keys or base URLs) |
| Characters | `find_characters`, `get_character`, `edit_character` (whole field or exact-snippet replace; backup first; `dryRun`) |
| Settings | `set_chat_metadata` (backup first; 2000-character guard for special instructions; `dryRun`) |
| Development | `typecheck`, `run_regressions`, `build`, `restart_engine`, `api_request` (GET freely; anything else needs `confirm` and a reason) |
| Sandbox | `sandbox_refresh`, `sandbox_stop` |

Every tool has a description the agent reads, so you rarely need to explain them. Read-only tools are marked with the MCP `readOnlyHint` annotation, and build / restart / raw API calls with `destructiveHint`, so clients that ask before risky calls can do so.

## Setup

Requirements: Node.js 20 or newer (the engine itself needs 24), a built engine checkout, and git on the PATH.

```sh
cd tools/dev-mcp
npm install
```

Use `npm install` (or `pnpm install --ignore-workspace`) inside this folder. The folder is deliberately not a workspace package, so the root `pnpm install` does not install it and the app build never sees it.

Then register the server with your client. The server talks over stdio; the command is always `node <repo>/tools/dev-mcp/server.mjs`.

**Claude Code**

```sh
claude mcp add marinara-dev -e MARINARA_DEV_AGENT=claude-code -- node /path/to/Marinara-Engine/tools/dev-mcp/server.mjs
```

**Codex** (`~/.codex/config.toml`)

```toml
[mcp_servers.marinara-dev]
command = "node"
args = ["/path/to/Marinara-Engine/tools/dev-mcp/server.mjs"]
env = { MARINARA_DEV_AGENT = "codex" }
```

**Any other MCP client** (the common JSON shape)

```json
{
  "mcpServers": {
    "marinara-dev": {
      "command": "node",
      "args": ["/path/to/Marinara-Engine/tools/dev-mcp/server.mjs"],
      "env": { "MARINARA_DEV_AGENT": "my-agent" }
    }
  }
}
```

On Windows, use forward slashes or escaped backslashes in the path.

To work in the sandbox as well, register a second copy with `MARINARA_DEV_INSTANCE=sandbox` (for example under the name `marinara-sandbox`). Every tool then points at the sandbox port instead of the live engine.

### Settings

All optional. The defaults suit a normal checkout.

| Variable | Default | Meaning |
|---|---|---|
| `MARINARA_DEV_REPO` | two folders above `tools/dev-mcp` | Repository root |
| `MARINARA_DEV_STATE` | `<repo>/.dev-mcp` | Backups, lock, activity log, saved prompts, large outputs, the sandbox |
| `MARINARA_DEV_AGENT` | `unknown-agent` | Name written to the activity log and the lock; give each client its own |
| `MARINARA_DEV_INSTANCE` | `live` | `sandbox` points every tool at the sandbox |
| `MARINARA_DEV_PORT` | `PORT` from the repo `.env`, else 7860 | Engine port |
| `MARINARA_DEV_SANDBOX_PORT` | 7862 | Sandbox port |
| `MARINARA_DEV_SANDBOX_DIR` | `<state>/sandbox` | Sandbox folder |
| `MARINARA_DEV_SANDBOX_DIST` | `dist` | Server build folder the sandbox runs |
| `MARINARA_DEV_PNPM` | `corepack pnpm` | How to run pnpm for builds |

The data and log folders are read from the repo `.env` (`DATA_DIR`, `LOG_DIR`) the same way the server resolves them.

**`.dev-mcp/` holds backups of your cards and chat settings and copies of prompts, which can contain your own campaign text. It must stay out of git:** the root `.gitignore` lists `.dev-mcp/`. If you point `MARINARA_DEV_STATE` somewhere else, keep that folder private too.

## Typical loops

- **A bad reply**: `read_messages`, then `get_prompt grep="..."` (is the card or rule really in the prompt?), then `edit_character` or `set_chat_metadata`, then `get_prompt which=next grep="..."` to confirm. No model call is needed.
- **The cache hit rate dropped**: `cache_report`, then `diff_prompts` (last two replies) or `diff_prompts mode=next`, then fix whatever changes above the break point.
- **A code change that affects prompts**: `get_prompt which=next` (saves a file), edit code, `typecheck`, `run_regressions filter=...`, `restart_engine rebuild=["server"]`, then `diff_prompts fileA=<saved file>`.
- **Test a server change without touching the live engine**: build it into `packages/server/dist-sandbox`, run `sandbox_refresh dist=dist-sandbox`, and compare `get_prompt which=next` snapshots with `diff_prompts`.
- **An error toast**: `lookup_error reference=<errorId>`. For a failed call the agent made itself, the error message already names the `requestId` to pass.

## Safety

- **Read tools are free.** They only read the API and the log files.
- **Backups before writes.** `edit_character` saves the whole card and `set_chat_metadata` saves the previous values under `.dev-mcp/backups` before changing anything. Character edits also go through the engine's own version history with your reason. Both accept `dryRun`.
- **Activity log.** Every write, build and restart made through the server is appended to `.dev-mcp/activity.jsonl` with the agent name and reason. Agents can add notes with `activity_log` for changes they made elsewhere, which helps when several agents share one engine.
- **Engine lock.** `restart_engine` and `build` refuse to run while another agent holds the lock. A lock older than 45 minutes counts as abandoned.
- **Quiet wait.** By default `restart_engine` waits until nobody has generated for 150 seconds (up to 30 minutes), so it never cuts off a reply in progress. Pass `waitForQuiet: false` to skip that.
- **Build rollback.** Every touched `dist` folder is copied before a build (the last five copies are kept). A failed build, or a server build that is missing compiled files, restores the previous `dist` and relaunches it. Stale `tsconfig.tsbuildinfo` files are deleted before each build, since they can make `tsc` emit nothing.
- **Never through `start.bat` or `start.sh`.** Both launchers run `git clean -fd` on `packages/*/src` before starting, which deletes untracked source files you are working on. The tool starts the server the way the launchers' last step does: `node ../../scripts/run-server.mjs dist/index.js` in `packages/server`, with `NODE_ENV=production` and browser auto-open off.
- **Stops only the engine.** Before stopping anything, the tool checks that the process on the port looks like the engine (run-server, `dist/index.js`, or a launcher). Anything else on that port is left alone.
- **Raw API writes need consent.** `api_request` with any method other than GET needs `confirm: true` and a reason, and is logged.
- **No secrets in output.** `list_connections` returns only ids, providers, models, names and default flags.
- **Bounded output.** Long results are cut, and the full text is saved under `.dev-mcp/out` with the path returned, so an agent's context is never flooded.

### The sandbox

`sandbox_refresh` copies the live store (tables only, not images or other assets; `.bak` files and the writer lease are skipped) into `.dev-mcp/sandbox`, sanitizes the copy, and starts it on port 7862. The live store is only read. Isolation comes in layers:

- Every credential-looking field in the copied connections table is blanked, and every remote base URL is pointed at a closed local port, so even a provider that answers without a key is unreachable.
- Discord and other webhook settings are removed from copied chats.
- The sandbox process gets its own `DATA_DIR`, `FILE_STORAGE_DIR`, `LOG_DIR` and env file, binds to `127.0.0.1`, cannot apply updates (`UPDATES_APPLY_DISABLED`), and does not seed a default connection.
- `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_*`, `CODEX_HOME` and `CLAUDE_CONFIG_DIR` point into the sandbox, so subscription logins (ChatGPT through Codex, Claude Code, CLI providers) do not exist there.
- Environment variables whose names look like credentials (keys, tokens, secrets, passwords, sessions) are not passed on.
- The tool refuses to run the sandbox until a sanitize pass has finished, and refuses any layout where the sandbox data folder is the live data folder or inside it.

The result: the sandbox cannot spend model quota or post anywhere. Use it for prompt previews, cache diagnosis, UI checks, code verification and restart testing; real model replies are not possible there by design. Continuity and other agents will log connection warnings in the sandbox, which is expected.

## Platform support

| | Windows | Linux | macOS |
|---|---|---|---|
| Read tools, logs, prompts, characters, settings | Yes | Yes | Yes |
| Find the engine process | PowerShell (`Get-NetTCPConnection`, `Win32_Process`), `netstat` fallback | `lsof`, then `ss`, then the PID file the tool wrote | `lsof`, then the PID file |
| Stop | `taskkill /T /F` on the engine tree | `SIGTERM` to the supervisor (forwarded to the server so it can flush), `SIGKILL` for anything left after 20 s | Same as Linux |
| Start | PowerShell `Start-Process`, hidden window, output in `.dev-mcp/run` | Detached `node` process, output in `.dev-mcp/run` | Same as Linux |
| Sandbox copy | `robocopy /MIR` | Node file copy | Node file copy |

What has been exercised: Windows 11 against a running engine (read tools and process lookup), and the start, stop and sandbox paths on Windows 11 and on Linux (Ubuntu under WSL 2) against a stand-in server on spare ports. macOS uses the same code as Linux (`lsof` and `ps` behave the same way there) but has not been run. Docker and Termux installs are not supported for `restart_engine` and the sandbox: inside a container, restart the container instead; the read tools work anywhere the API and log folder are reachable.

## Limits

- The engine keeps the exact saved request only for the most recent replies of a chat; older turns have none. Take `get_prompt which=next` snapshots going forward.
- On Windows the stop is forced (`taskkill /F`), because console servers ignore a polite `taskkill`. A write in flight at that moment can be lost, which is one more reason the quiet wait is on by default.
- A cold start of a large install can take several minutes; `restart_engine` waits up to 12 minutes for `/api/health`.
- `lookup_error` reads the newest 10 log files. References older than the retained logs (see `LOG_FILE_KEEP` in `LOGGING.md`) are gone.
- The full request trail needs a server that tags every line with `requestId` and writes `request.end`. With older builds `lookup_error` still finds the matching lines, but the trail may be shorter. `continuity_status` needs an engine with the `/api/game/:chatId/continuity` endpoint.
- The sandbox copy is a snapshot. Run `sandbox_refresh` again to pick up newer data.
- The lock and the activity log coordinate agents that use this server. They cannot see someone restarting the engine by hand.

## Smoke test

```sh
node test/smoke.mjs ["chat name or id"]
```

It starts the server over stdio, checks that every tool is listed, and calls the read tools (and `edit_character` / `set_chat_metadata` only with `dryRun`). It never writes, builds or restarts. Online checks are skipped when the engine is not running.
