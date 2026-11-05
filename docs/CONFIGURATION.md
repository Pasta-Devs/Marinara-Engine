# Server Configuration Reference

This guide lists the server settings you can change with environment variables, which are settings the server reads from a plain text file named `.env`. Marinara works with no configuration. Most people only need it to let other devices connect, protect a shared server, move the data folder, turn up logging or give slow jobs more time.

Your AI accounts, characters and chat options are set inside the app. To add an AI account, see [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

## Edit the .env file

Marinara creates an empty `.env` the first time it starts. Each line is `KEY=value`. Lines that start with `#` are comments.

| Install | Where `.env` is |
| --- | --- |
| Normal install | The project root folder |
| Official Docker or Podman image | `/app/data/.env`, in the same volume as your data |

1. Open `.env.example` in the same folder. It lists every setting with its default.
2. Copy the line you want into `.env`.
3. Change the value after `=` and save the file.

```text
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

`.env` is data, not a shell script. Marinara does not run `$`, `$(...)` or other shell syntax in a value. A value already set in the launcher's environment wins over the same `.env` entry.

The server reads `.env` however you start it. The launchers (`start.bat`, `start.sh`, `start-termux.sh`) also set `HOST=0.0.0.0` so other devices can connect, and open your browser once the server is ready. `AUTO_OPEN_BROWSER=false` stops that. With bare `pnpm start`, the server listens only on this computer unless you set `HOST`.

## Restart or hot reload

Marinara watches `.env` while it runs. Most settings apply almost at once, with no restart. The log shows an `[env-watcher]` line for each change. If the watch cannot start, the server checks the file every 30 seconds and says so in the log.

If your edits are not picked up, for example when you edit from another machine or into a container bind mount, set `MARINARA_ENV_WATCH=poll`. To turn the watcher off, set `MARINARA_ENV_WATCH=0`. Both are advanced options.

These settings are read only at startup. Changing one needs a restart, and the log warns you:

- `PORT`, `HOST`, `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`, `ENCRYPTION_KEY`, `MARINARA_EAGER_STORAGE`
- `MARINARA_ENV_FILE`, `MARINARA_ENV_WATCH`, `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`, `LOG_FORMAT`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`, `SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- Image, video, sprite and ComfyUI timeouts and poll settings: `IMAGE_GEN_TIMEOUT_MS`, `IMAGE_GEN_MAX_RESPONSE_BYTES`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` and the four `*_VIDEO_POLL_INTERVAL_MS` settings

The launchers read `AUTO_UPDATE_ENABLED` before the server starts, so a change applies from the next launch and the log does not warn about it.

Access-control settings and secrets (`BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, `CSRF_TRUSTED_ORIGINS`) need no restart.

## Access control

Access control decides who can reach a running server. For steps and examples, see [Remote Access: Login and IP Allowlist](REMOTE_ACCESS.md).

You can also set the login without `.env`: use **Settings → Advanced → Access** in a browser that is already signed in, or the one-time setup code from the server log. The server prints that code only while no login is set and it listens beyond loopback. The login is saved in `DATA_DIR/.remote-login.json`. `node scripts/reset-login.mjs` (run in the Marinara folder) removes it and signs out every browser. A login in `.env` wins. Changing or removing the login needs the current password. For login proxies, see [Login proxies (forward auth)](REMOTE_ACCESS.md#login-proxies-forward-auth).

Terms used below:

- **Loopback**: the computer the server runs on, at `127.0.0.1` or `localhost`.
- **CIDR range**: a short way to write a block of IP addresses, such as `192.168.1.0/24`.
- **Basic Auth**: a username and password sent with each request. Scripts and API clients use it, and browsers use the `/login` page. It is encoded, not encrypted, so use HTTPS on a public server.

With no login set, the server accepts only trusted sources: loopback, addresses in `IP_ALLOWLIST`, Tailscale, and same-host Docker bridge traffic. Everyone else, including your home network, gets `403 Forbidden`. To let other devices connect at all, the server must bind to a reachable address: set `HOST=0.0.0.0`.

| Variable | Default | What it does |
| --- | --- | --- |
| `BASIC_AUTH_USER` | empty | Login username. Set with `BASIC_AUTH_PASS`. |
| `BASIC_AUTH_PASS` | empty | Login password. Leave either empty to turn the login off. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Realm name in the Basic Auth challenge. |
| `IP_ALLOWLIST` | empty | Comma-separated IPs or CIDR ranges that are always allowed. Direct loopback is always allowed. A reverse proxy on the same machine is not. |
| `IP_ALLOWLIST_ENABLED` | `true` | `false` keeps the list but stops enforcing it. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Allows passwordless access from private networks when no login is set. Excludes `100.64.0.0/10`, which internet providers share between customers. Add it to `TRUSTED_PRIVATE_NETWORKS` only if you trust it. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Allows passwordless access from any address, including the internet. Not recommended. |
| `TRUSTED_PRIVATE_NETWORKS` | built-in ranges | Replaces the default private ranges. Include any defaults you still want. |
| `BYPASS_AUTH_TAILSCALE` | automatic | Empty: a device skips the login only when it connects straight to this computer's Tailscale address. Tailscale Serve, Funnel or another proxy still need a login. `true`: legacy bypass of all `100.64.0.0/10`. `false`: normal access control. |
| `BYPASS_AUTH_DOCKER` | automatic | Empty: trusts only a detected container interface and its gateway, and only while no login, `IP_ALLOWLIST` or `TRUSTED_AUTH_PROXY` is set. `true`: legacy or custom networks. `false`: normal access control. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | Requires the login or allowlist for Docker traffic a proxy relays. Set `false` only when the proxy itself logs in every visitor. |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | Treats requests forwarded by a proxy or tunnel on the same machine as remote, including HTTP/1.0 such as nginx's default `proxy_pass`. Set `false` only when the proxy itself logs in every visitor. |
| `TRUSTED_AUTH_PROXY` | empty | IPs or CIDRs of a forward-auth proxy (tinyauth, Authelia, Authentik, oauth2-proxy) that logs in every visitor. Its requests skip the login and `IP_ALLOWLIST`. It must protect every path, and Marinara must not be reachable around it. |
| `TRUSTED_HOSTS` | empty | Extra public or proxy hostnames Marinara answers, such as `chat.example.com`. Direct IPs, `localhost`, `.local`, `.home.arpa` and single-label LAN names work without it. Names in `CSRF_TRUSTED_ORIGINS` or `CORS_ORIGINS` are also accepted. |
| `SSL_CERT` | empty | Path to a TLS certificate. Set with `SSL_KEY` to serve HTTPS directly. |
| `SSL_KEY` | empty | Path to the TLS private key. |
| `CSRF_TRUSTED_ORIGINS` | empty | Extra browser origins allowed to save changes, for a public domain or unusual port. The literal `null` is ignored, including for the Android APK. |

> **Warning:** A broad public `IP_ALLOWLIST` range such as `0.0.0.0/0` can admit internet clients without a login. List only addresses you trust.

## Storage

| Variable | Default | What it does |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Root folder for all user data. Docker images set `/app/data`. |
| `FILE_STORAGE_DIR` | `storage` inside `DATA_DIR` | Overrides the file-storage folder. |
| `ENCRYPTION_KEY` | empty | Key that encrypts saved API keys. |
| `MARINARA_MAX_RESIDENT_CHATS` | `0` (unlimited); `8` on SteamOS and Termux | Most chats kept in memory at once. Past the cap, the least recently used chat with no unsaved changes leaves memory (never disk) after each save. Invalid text falls back to the platform default. Positive values below `2` become `2`. `0` turns eviction off. |
| `MARINARA_EAGER_STORAGE` | off | `1` loads every chat at startup, as before 2.4.5. Uses much more memory on large profiles. Needs a restart. |

Generate an encryption key and paste it into `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Marinara keeps your data as plain JSON files, so you can copy and read backups. For what each folder holds, see [Where Your Data Is Stored](data/where-data-is-stored.md).

## Logging levels

`LOG_LEVEL` sets how much the server prints. It hides anything below the level you pick.

| Level | What it shows |
| --- | --- |
| `error` | Serious failures only. |
| `warn` | Errors and warnings. The default. |
| `info` | Adds startup and per-request logs. |
| `debug` | Everything, including full prompts and model replies. Produces a lot of output. |

| Variable | Default | What it does |
| --- | --- | --- |
| `LOG_LEVEL` | `warn` | The level above. |
| `LOG_PRESET` | `default` | `prompt-connections` shows the same prompt and model detail as `debug` but hides routine request lines such as `GET /api/chats`. |
| `LOG_DISABLE_REQUEST_LOGGING` | `false` | `true` hides routine request lines and keeps your level. Needs a restart. |
| `LOG_FORMAT` | automatic | `pretty` prints readable lines everywhere, for example to read **Debug mode** prompts in `docker logs`. `json` prints one JSON object per line. Needs a restart. |

In a terminal, the server prints readable lines. Elsewhere, such as Docker logs, a production server prints JSON lines. The Termux launcher asks for readable lines. Browser logging is separate and not controlled by `LOG_LEVEL`.

## Timeouts

A timeout is the longest the server waits for a slow job. Open **Settings → Advanced → Request timeouts** to change text, agent, Game image-prompt, image, video, ComfyUI and embedding limits in seconds. Higher limits help slow local backends. They cannot override a limit the service sets. Saving needs server administration access.

Those settings apply to every profile and are saved beside the active `.env` as `.env.timeouts.json` (or `<custom-env-path>.timeouts.json`). They override the matching variables without editing `.env`. Text, agent, Game image-prompt and embedding changes apply to new requests. Media changes and installed agent packages need a restart. To go back to variables, delete that file and restart.

Values are in milliseconds unless the name says otherwise. Invalid, zero, negative or out-of-range values for the validated chat, agent and Game image-prompt timeouts log a warning and use the default. To learn about video jobs, see [Scene Video](media/scene-video.md).

| Variable | Default | What it does |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 min) | Time to first token and gap between chunks for Conversation, Roleplay and Game replies. Also the budget for background jobs with no timeout of their own (Professor Mari, Noodle refresh, Slurp replies). Range `10000`-`3600000`. Does not change agent, media, embedding or tool timeouts. |
| `AGENT_CALL_TIMEOUT_MS` | `300000` (5 min) | Longest silence before or during one agent model call, including downloadable agents. Incoming data renews it. Range `10000`-`3600000`. The Illustrator keeps at least its built-in 30-minute idle budget. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 s) | Total time cap for the model call that turns a Game scene into an image prompt. Range `10000`-`3600000`. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 min) | Time for one embedding request. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 min) | Time for one image generation request. |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280` (30 MiB) | Largest image response accepted. Raise it when local ComfyUI embeds large metadata. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 min) | Time for one scene video request, including ComfyUI video workflows. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 MiB) | Largest scene video download accepted. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 min, in seconds) | Time for one ComfyUI image workflow after it is queued. |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` | Time for one AI sprite job. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 min) | Time for one custom tool call. |
| `MAX_TOOL_ROUNDS` | `100` | Most tool-call rounds before the model must answer. A Game turn gets at most 4, an agent 16 and a lorebook backfill 64, or this when lower. |

## Privileged APIs (ADMIN_SECRET)

Destructive or risky actions, such as backups, clearing data, applying updates and installing themes, need an extra secret on top of the normal access checks. You can make one in **Settings → Advanced → Admin Access** on the server's own computer (see [Admin Access](REMOTE_ACCESS.md#admin-access-and-privileged-actions)), or set a long random value on the server:

```text
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

On the server's own computer, these actions usually work without the secret. A request forwarded by a proxy or tunnel on that computer counts as remote unless `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`. Direct requests from another device need the secret. Paste the same value into **Settings → Advanced → Admin Access**, and the app sends it for you. `ADMIN_SECRET` in `.env` wins over a secret made in the app. With no admin secret, privileged actions fail from every device except the server's own computer, and the error tells you to set one. Installed agents work from any device that signed in with the login; installing, updating and removing them need the secret.

| Variable | Default | What it does |
| --- | --- | --- |
| `ADMIN_SECRET` | empty | Secret for privileged actions from remote devices. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | `true` requires the secret on the server's own computer too. |
| `UPDATES_APPLY_ENABLED` | `false` | Lets the browser apply same-channel updates (**Apply Update**). A release-channel switch from a browser on the server's computer works without it. Git installs only. |
| `UPDATES_APPLY_DISABLED` | unset | Refuses all server-side update apply, including the channel switch. Wins over `UPDATES_APPLY_ENABLED`. The dev and e2e launchers set it. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Lets a remote device apply updates, with a valid secret. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Lets a remote device run haptic actions, with a valid secret. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Turns on custom script tools. Keep off for untrusted or imported tools. |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | Lets Professor Mari's database transform scripts run on hosts with no OS sandbox (macOS Seatbelt or Linux Bubblewrap, used when present). Keep off unless you reviewed the script. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Turns on manual GitHub agent-repository preview and sync in Agent Organizer. See [Custom agent repositories](#custom-agent-repositories). |
| `MARINARA_OVERWORLD_GAMES` | `false` | Lets players make Overworld games (a setting kit and a generated world) and turn a legacy game into one. Off, the wizard offers Classic games only. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | First of two gates for third-party extension imports. See [External Extensions](#external-extensions). |
| `IMPORT_ALLOWED_ROOTS` | empty | Folders bulk import may read without a picker token. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 MiB) | Largest single JSON profile export the server builds. |

## Local address opt-ins

By default, outbound requests to AI services, image services and webhooks refuse private or local addresses. This blocks SSRF (server-side request forgery), where a request is tricked into reaching an internal address. Loopback model servers still work. Turn on only the switch you need for a self-hosted service on another private-network machine.

| Variable | Default | What it does |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | AI service URLs may reach private or LAN addresses. On by default on Android. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | Image service URLs may reach private or LAN addresses. Private result URLs must still match the service's exact origin. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | Text-to-speech URLs may reach private or LAN addresses. |
| `STT_LOCAL_URLS_ENABLED` | `false` | The Speech to text server URL may reach private or LAN addresses. A server on the same machine works without it. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | DeepLX translation URLs may reach private or LAN addresses. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Custom tool webhooks may reach private or LAN addresses. |

To connect a local or self-hosted model, see [Connecting a Local or Self-Hosted Model](connections/local-self-hosted.md).

## Feature switches

Optional server behaviors, such as retrying failed provider calls or keeping lorebook group picks stable, are in **Settings → Advanced → Features**. All are off by default. A few have a variable that wins over the switch when set. See [Feature Switches](configuration/features.md).

## Marinara notices

Notices are short warnings from the maintainers, such as a security problem or a manual step your version needs. They show as a banner.

- At startup and then every hour, the server downloads one small file, `notices.json`, from the `notices` branch of the Marinara Engine repository. It keeps only the notices that name your version. Your browser asks your own server for them once on page load and then hourly.
- If a download fails, the server keeps the notices it has and startup is not delayed.
- The request sends no data about you, your chats or your settings. Only maintainers can change the `notices` branch, and each change is reviewed.
- A notice is plain text with a size limit. Links stay only when they point to `https://github.com/Pasta-Devs/`. A notice cannot install, run or change anything.
- Only you see notices: on the server's own computer, from an address in `IP_ALLOWLIST`, or after you sign in. Other visitors get an empty list.

To turn notices off, set `MARINARA_NOTICES_ENABLED=false`.

> **Warning:** With notices off, Marinara cannot tell you about security fixes or required steps. Watch the [GitHub releases](https://github.com/Pasta-Devs/Marinara-Engine/releases) yourself.

Forks can point `MARINARA_NOTICES_URL` at their own file.

## Optional multiplayer

Multiplayer is off by default. It lets people share a private Conversation, Roleplay or Game room with no fixed roster cap. Each guest uses their own trusted Marinara. Guests need no AI account. The host provides the AI accounts and can read and keep shared content. While either gate is off, Marinara makes no background session, certificate or peer checks.

1. Set `MULTIPLAYER_ENABLED=true` in the `.env` of each participating Marinara and restart it. Only the exact value `true` works, and hot reload does not apply it.
2. Open **Settings → Advanced → Multiplayer**, read the warning and turn on the setting. This does not start a listener or join a room.
3. To host, use **Create shared session** or **Play together** in the mode or setup flow. Review the setup, your display name and the persona text you share. An existing chat shares only its setup choices, never its transcript, notes or memories.
4. On the host, set `SSL_CERT` and `SSL_KEY` for a certificate valid for the room hostname and trusted by guests. Choose a separate HTTPS room address and port, such as `https://room.example.org:7861`. The Host action opens that port. Route only the room port through your firewall or router. Do not expose the normal Marinara API. No port forwarding, relay or certificate bypass is set up for you.
5. Set a room password of at least 12 characters, different from your admin credentials. Send the expiring invitation and the password separately to people you trust. The guest checks the hostname fingerprint, room name and persona text, then requests entry. The host approves each request in **Players** before any history is sent.

Limits and behavior:

- TLS checks the certificate chain and hostname, and the invitation's certificate fingerprint, before a password is sent. Self-signed certificates are not accepted silently. A renewed certificate needs a new invitation.
- Invitations expire after 30 minutes. Admitted sessions last at most 12 hours. Replace or revoke stops unused invitations. **Kick** removes an admitted guest.
- The host controls automatic or manual replies, **Pause**/**Resume** and **Stop**. The default allowance is 100 coordinated generation turns per hosting session. A group turn or Game setup can make more than one model call. It is a turn limit, not a price estimate.
- In Game, review the party before **Start Game**. Each required player submits an action or passes, and the GM resolves when all are ready. A disconnected player stays required until they return or the host passes or removes them. Paused or interrupted rounds never repeat a paid request or committed world effects on their own.
- **Stop**, **Leave**, turning off the setting and a server restart end the live session. A restart never hosts or joins by itself.
- Custom and package tools and unsafe commands stay unavailable in rooms. Guests never run a scheduler or local commands from received text. Conversation schedules use the host scheduler.
- New players and persona changes take effect at the next round.
- Rooms carry bounded text only. There is no file, media, extension or package transfer. The Android native wrapper cannot join.

> **Warning:** Connect only to people you trust, and use your own Marinara client. Never install a host-provided client, extension or file. The host can read what you share, and shared content may go to their AI services. Direct connections reveal network addresses. Do not share passwords, API keys or personal information. Leave at once if anything seems wrong.

For exact restrictions and tested platforms, see the [compatibility and verification record](development/multiplayer.md). For problems, see [Troubleshooting](TROUBLESHOOTING.md#multiplayer-connection-or-turn-problems).

## Agents and extensions

Install optional first-party agents in the app: **Agents → Agent Organizer**. Marinara picks the [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) catalog that matches its major version.

- **Updates:** Marinara asks before it downloads a new version of an installed package. **Not now** keeps the current version and leaves **Update** in Agent Organizer. A fresh install has no packages.
- **Where packages live:** `DATA_DIR/capability-packages`. Docker volumes, custom data folders, backups and normal upgrades keep them. This applies to desktop, Docker and Termux. iOS and other browsers use the packages on their host server.
- **Disk use:** Marinara keeps each package's current and previous version, and deletes older versions and the temporary copies in `DATA_DIR/capability-runtime-snapshots`. Package data is never deleted.
- **Offline:** Installed packages keep working at their version when GitHub is unreachable, an update is declined or verification fails.

### Custom Agent imports

External agent files, folders and repositories are locked. To allow them, turn on **Allow custom Agent imports** in **Settings → Advanced → Danger Zone**. This needs no environment variable. The import controls stay grey until you do.

Each import shows the agent's requested capabilities first. Permissions need explicit approval. Bundled functions and tool selections are not imported, generated CSS is cleaned, and result actions are checked against the approved capabilities. Turning the gate off stops imported agents. Agents made in Marinara and official packages are not affected.

### Custom agent repositories

Repositories are off by default because their prompts and tools are unvetted. Set `ENABLE_CUSTOM_AGENT_REPOS=true`, turn on **Allow custom Agent imports**, then open **Agents → Agent Organizer → Custom Sources** to preview a public GitHub repository. Adding a source and applying later changes both need confirmation. Sync is manual, and Marinara never clones or polls repositories in the background. Only repository-root GitHub URLs are accepted.

A repository publishes agents, Game Mode rulesets or both. At the root:

- `agents.json` is an array in the downloadable agent format:

  ```json
  [
    {
      "id": "continuity-helper",
      "name": "Continuity Helper",
      "description": "Checks recent turns for contradictions.",
      "phase": "post_processing",
      "enabledByDefault": false,
      "category": "writer",
      "defaultPromptTemplate": "Check {{messages}} for continuity errors."
    }
  ]
  ```

- `rulesets` holds one ruleset per `.json` file, up to 32 files of 512 KB. Only files directly inside it are read. The preview lists each ruleset's name, version and coverage. A ruleset's Game Master text goes to the model in every game that uses it, so install only from people you trust.

Imported rulesets are named after the repository owner, such as `alice/my-5e`, so they never take an official name. Every version is kept, and a game plays on the exact version it started with. If the same version arrives with different contents, Marinara keeps the installed one and tells you to ask the author to raise the version number. A file Marinara cannot read is listed with the reason and skipped.

On sync, remote prompt, settings and tool values replace the repository-managed values shown in the preview. Your account and artwork choices stay local. If an agent disappears upstream, it stays as a normal local agent and loses only its repository link. Removing a source works the same way, and its rulesets stay installed.

Custom agents can also turn on **Previous output** under Context Sources to read their own last successful output. With **JSON context output**, return `{"text":"main prompt content","agent-context":"private continuation context"}`. Only `text` goes into the main prompt. **Hide output as spoilers** keeps saved outputs collapsed. Regenerations leave out the replaced turn, and deleted messages or inactive swipes cannot supply context.

### External Extensions

Third-party extension imports need two opt-ins. The environment variable is the host operator's permission. The Danger Zone switch is the user's acceptance.

1. Set `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`.
2. Open **Settings → Advanced → Danger Zone**, scroll below the data-deletion controls, read the warning and turn on **Allow third-party extension imports**.

Then the **External Extensions** section appears under **Settings → Addons**. Closing either gate disables external records and stops their code. Manually stored, legacy, profile-imported and unknown-source records count as external, so dropping files into a folder cannot bypass the gates. Professor Mari drafts need neither gate. They start disabled and need approval of their exact code hash.

Sandboxed Browser Extensions are the default. Some older packages show **Full page access** because they need Marinara's page. That mode runs the approved code in Marinara's page, with access to page content, browser storage, network APIs and your session. It is only for External Extensions with both gates open, and it needs a separate warning acknowledgement. Reload the page after disabling it.

## Full environment variable reference

The tables above cover access control, storage, logging, timeouts, privileged actions and local address opt-ins. The rest are here.

### Server and startup

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `7860` | Port the server listens on. Keep Android, Docker and Termux on the same value. |
| `HOST` | `127.0.0.1` (`0.0.0.0` in the launchers and Docker images) | Network interface to bind. Use `0.0.0.0` for LAN access. The default Compose file publishes the Docker port on `127.0.0.1` only. |
| `MARINARA_ANDROID_SECRET` | empty | Internal secret for APK-managed Termux installs. The Android app creates it and the Termux launcher exports it. Never ask users to set it. Must be exactly 64 hex characters. An invalid non-empty value makes device-local requests fail with HTTP 503. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Secret file used by the Termux launcher and the local `mari` command. The APK and launcher manage it. |
| `AUTO_OPEN_BROWSER` | `true` | Whether the launchers open the app URL. `false` stops it. APK-managed setup turns it off. |
| `AUTO_UPDATE_ENABLED` | `true` | Whether Git-based launchers fetch and apply updates before startup. `false` opts out from the next launch. The launcher still checks read-only for newer releases and prints a reminder. `--skip-update` skips both checks for one start. |
| `MARINARA_NOTICES_ENABLED` | `true` | Whether the server fetches maintainer notices. See [Marinara notices](#marinara-notices). |
| `MARINARA_NOTICES_URL` | `notices.json` on the `notices` branch | Notices file override for forks and mirrors. It is validated the same way, and links outside `https://github.com/Pasta-Devs/` are dropped. |
| `MARINARA_ENV_FILE` | project-root `.env` | Path override for the `.env` file. Set before startup. |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | Most image or video requests at once, across the whole server. Lower it to 1-2 if a local ComfyUI or SwarmUI runs out of VRAM. `0` removes the ceiling. Invalid values are ignored with a warning. Batch work never takes the last slot. Works on top of **Queue media generation requests** (**Settings → Generations → Overall Generations**, on by default), which queues image and video jobs per account. |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000` (10 min) | How long a request waits for a free slot before it fails. `0` waits forever. |
| `MARINARA_SHARED_GPU_HOSTS` | empty | Comma-separated `host:port` list for one GPU shared by a local model and a local image or video backend, such as llama-swap. Text and media requests to a listed host take turns, so a picture cannot wait forever behind chat replies. A picture or clip waits at most `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`. Embeddings are not held. Applies to new requests without a restart. |
| `MARINARA_ENV_WATCH` | `1` | How `.env` is watched. Default: change events (about 250 ms debounce) with a 30-second check as fallback. `poll`: always the 30-second check. `0`: off. See [Restart or hot reload](#restart-or-hot-reload). |
| `TZ` | system default | Host fallback timezone for server jobs, such as `Europe/Warsaw`. Leave it unset or empty to use the host timezone. A saved Conversation **Schedule timezone** takes priority for schedules. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed to make cross-origin requests. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Legacy flag. Current builds bundle no starter key, so it creates nothing. Add your own account in the app. |

**Schedule timezone** defaults to your device's timezone. You can change it during Conversation setup, in Conversation Chat Settings or in the character schedule editor. It is one global setting shared by every Conversation chat and synced to other clients on the same server.

### Media and sprite tools

| Variable | Default | What it does |
| --- | --- | --- |
| `FFMPEG_PATH` | empty | Path to `ffmpeg`, used for animated expression GIFs. Falls back to `ffmpeg` on your PATH. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 min) | Time to convert one animated expression clip. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | `auto` tries built-in cleanup, then the optional AI tool. `builtin` uses only built-in cleanup. `backgroundremover` forces the AI tool. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | `true` installs the optional AI background remover on launch. |
| `BACKGROUNDREMOVER_COMMAND` | empty | Path to a system `backgroundremover` program. |
| `BACKGROUNDREMOVER_PYTHON` | empty | Path to a Python where `backgroundremover` is installed. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 min) | Time for one AI background-removal call. |

### Scene video providers

Video accounts are set up in the app. These settings only tune the jobs. Values are in milliseconds.

| Variable | Default | What it does |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | How often the server checks a Google Veo job. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | How often it checks an xAI Imagine job. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | How often it checks an OpenRouter video job. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | How often it checks a Seedance job. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | empty | Public HTTPS address of this server, for services that must fetch a reference image by URL. |

### Lorebooks

Both are off by default and apply on the next generation after a `.env` change. When `LOREBOOK_STABLE_GROUP_WINNERS` is set, it wins over the **Stable lorebook picks** switch in **Settings → Advanced → Features**. Otherwise the switch decides. See [Feature Switches](configuration/features.md).

| Variable | Default | What it does |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | Keeps the same inclusion-group winner per chat while the candidates stay the same, instead of re-rolling each generation. Keeps the prompt start stable for provider prompt caching. |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | Stores the full text of activated entries only on the newest assistant or narrator message. Older messages keep entry ids, keys and scores. Makes chats with large lorebooks much smaller. If newer messages are deleted, Active Context and agent retries show the entry's current text for the message that is newest again. |

`scripts/compact-lorebook-scans.mjs` applies the same rule to older chats. Stop the server first. It is a dry run unless you pass `--apply`, and it backs up both message tables before it writes.

### Robustness

All are off by default, which keeps the old behavior. `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` and `SHUTDOWN_FORCE_EXIT_ON_REPEAT` need a restart. The rest apply after a `.env` change. When `PROVIDER_RETRY_TRANSIENT_ERRORS` is set, it wins over the **Retry failed provider calls** switch in **Settings → Advanced → Features**. Otherwise the switch decides.

| Variable | Default | What it does |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | Retries a refused or unreachable connection, or a 502 or 503, up to twice with a wait of at most 5 s, and only before any text reached you. A 504 or dropped connection is never retried. Not used when the account has a fallback, which is tried at once. A slow-failing host can delay the error by about 20 s. |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | A save skips rewriting a chat file or `manifest.json` when its content matches what this server last wrote and the file on disk is unchanged. A file just restored from its `.bak` is always rewritten. |
| `STORAGE_YIELDING_SERIALIZE` | `false` | Prepares large chat files for saving in short slices, so saving a very long chat does not pause other requests. The bytes written are the same. |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | Windows only. Remembers the boot-time check the storage lock runs at every start (about 1.5 to 2 s of PowerShell) in `.writer-boot-id.json` in `DATA_DIR`, until the next reboot. |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | Windows only. <kbd>Ctrl</kbd>+<kbd>Break</kbd> and closing the console also stop the server cleanly and write pending saves. A console close gets shorter deadlines to fit the roughly 5 s Windows allows. |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | Pressing <kbd>Ctrl</kbd>+<kbd>C</kbd> or <kbd>Ctrl</kbd>+<kbd>Break</kbd> again more than 1.5 s after the first ends the server at once. Unwritten saves may be lost. Without it, repeats are ignored and the 8 s shutdown limit applies. |
| `SHUTDOWN_EARLY_FLUSH` | `false` | Starts writing pending saves when a stop signal arrives, while connections are still closing. The restart in Advanced Settings does not use it. |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | How long a stop signal waits for background runtimes (packages, extensions, built-in model) before it closes storage. `0` waits for all of them. At most `2500`, so storage closes inside the 8 s limit. The Advanced Settings restart still waits for all. |

### Integrations and extras

| Variable | Default | What it does |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | Whether **Claude (Subscription)** accounts use the Claude Code on this computer when it is at least as new as the bundled copy. Android has no bundled copy and needs this on. `false` always uses the bundled copy. Applies within five minutes. |
| `DOCS_I18N_BASE_URL` | official `docs-i18n` branch | Where documentation and UI language packs download from. UI packs use its `ui/` subtree. Must be a public `https://` host. |
| `GIPHY_API_KEY` | empty | Giphy key for GIF search in Conversation mode. Search stays off until you set it and restart. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Default address of the Intiface haptic app. |
| `SPOTIFY_REDIRECT_URI` | derived from the request | Override for the Spotify login callback. Set it when TLS ends upstream. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Largest wiki page content Professor Mari reads before trimming. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Time for one wiki request by Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | How long Professor Mari caches a wiki read. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (the Windows launcher sets `true`) | Lets the **Built-in model** runtime install without an admin header on loopback. |

For the **Built-in model**, see [Built-in model setup](connections/local-model.md).

### Outbound HTTP proxy

Some networks reach the internet only through an HTTP proxy, for example v2rayN without TUN mode. Marinara can send requests to AI services, image services, embedding servers and the agent catalog through it. Set these where Marinara starts or in `.env`, then restart.

| Variable | Default | What it does |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | unset | `1` turns the proxy on. Without it, Marinara ignores the proxy settings, as Node.js does. |
| `HTTP_PROXY` | empty | Proxy address such as `http://127.0.0.1:10809`. Used for every request when `HTTPS_PROXY` is not set. |
| `HTTPS_PROXY` | empty | Proxy for `https://` addresses when it differs from `HTTP_PROXY`. |
| `NO_PROXY` | empty | Comma-separated hosts that skip the proxy. Add model servers on your network. `localhost`, `127.0.0.1` and `::1` always skip it. |

## Related guides

- [Feature Switches](configuration/features.md)
- [Remote Access: Login and IP Allowlist](REMOTE_ACCESS.md)
- [Where Your Data Is Stored](data/where-data-is-stored.md)
- [Connecting to an AI Provider](connections/connecting-to-a-provider.md)
- [Scene Video](media/scene-video.md)
- [Troubleshooting Marinara Engine](TROUBLESHOOTING.md)
