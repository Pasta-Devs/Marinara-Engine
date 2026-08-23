# Server Configuration Reference

This guide explains how to change server-level settings for Marinara Engine using environment variables. An environment variable is a setting you write in a plain text file that the server reads. Most users never need this page. The full variable list is near the bottom.

## When would you configure Marinara?

Marinara Engine works out of the box with no configuration. You only need this page for a small number of tasks. Most of them involve running the server for more than one device.

You might edit configuration when you want to:

- Let other devices on your network reach the server (access control).
- Protect a shared server with a password or an IP allowlist.
- Change where your data is stored on disk.
- Turn up logging to help diagnose a problem.
- Give slow image, video, or embedding jobs more time to finish (timeouts).
- Unlock privileged actions like backups or updates from a remote device.

Almost everything else, like your AI provider keys, characters, and chat options, is set inside the app, not here. To add an AI provider, see [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

Optional first-party agents are also managed inside the app. Open **Agents → Download Agents** to install or uninstall them. Marinara automatically selects the [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) catalog lane matching its Engine major version.

Package lifecycle and storage:

- **Updates:** Marinara checks already-installed official packages for compatible updates and asks before downloading each new version. Choosing **No** keeps the current version and leaves the manual **Update** action available in Download Agents. A fresh install remains empty until you choose packages.
- **Platforms:** The same behavior applies to desktop, Docker, and Termux-hosted Android installations. iOS and other browser clients use the packages installed on their Marinara host server.
- **Persistence:** Packages live under `DATA_DIR/capability-packages`. Docker volumes, custom data directories, backups, and normal upgrades preserve them.
- **Offline resilience:** Existing packages continue working at their installed version when outbound GitHub HTTPS is unavailable, an update is declined, or an update fails verification.

### Custom Agent imports

External Agent files, folders, and custom repositories are locked by default. To allow them, open **Settings → Advanced → Danger Zone** and enable **Allow custom Agent imports**. Unlike External Extensions, this user-controlled gate does not require an environment variable. The import controls remain greyed out until it is enabled.

Every import shows the Agent's requested capabilities before it is stored. Permissions must be approved explicitly, bundled functions and tool selections are not imported, generated CSS is sanitized, and result actions are checked against the approved capability set. Turning the gate off stops externally imported Agents from running. Custom Agents created in Marinara and official packages installed through **Download Agents** remain runnable and do not use this gate.

### Custom agent repositories

Custom repositories are disabled by default because their prompts and tool selections are unvetted third-party content. Set `ENABLE_CUSTOM_AGENT_REPOS=true`, enable **Allow custom Agent imports** in the Danger Zone, then open **Agents → Download Agents → Custom Sources** to preview a public GitHub repository. Adding a source and applying any later content change both require explicit confirmation. Synchronization is manual; Marinara does not clone repositories or poll them in the background.

The repository root must contain an `agents.json` array using the same agent-definition format as downloadable agent packages. A minimal file looks like this:

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

Marinara accepts GitHub repository-root URLs only and validates the bounded archive plus every agent definition before showing the preview. During synchronization, remote prompt, settings, and tool values replace the repository-managed values shown in that preview. Connection and artwork choices remain local. If an agent disappears upstream, Marinara keeps it as a normal local custom agent and removes only its repository link. Removing a source follows the same keep-local policy.

### External Extensions

External Extension imports require two independent opt-ins. Set `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`, then open **Settings → Advanced → Danger Zone**, scroll below the data-deletion controls, read the warning, and enable **Allow third-party extension imports**. Only then does the **External Extensions** section appear under **Settings → Addons**.

The environment variable is the host-operator permission; the Danger Zone toggle is the user's explicit acceptance. The section, import routes, approval routes, and both runtime loaders all enforce the combined policy. Closing either gate disables external records and stops running external code. Manually stored, legacy, profile-imported, and unknown-source extension records are treated as external, so dropping files into an extension-related folder cannot bypass the gates.

Professor Mari drafts remain available without this flag. They are created disabled and still require approval of their exact code hash.

Sandboxed Browser Extensions remain the default. Some older third-party packages are marked **Full page access** because they depend on Marinara's DOM. That mode runs the exact approved code inside Marinara's page and can access page content, browser storage, network APIs, and the current same-origin session. It is available only to External Extensions after both gates are open and requires a separate warning acknowledgement. Disable it and reload the page if the extension leaves visual or behavioral changes behind.

## Where the .env file is

Configuration lives in a file named `.env`. This is a plain text file with one setting per line, in the form `KEY=value`. Lines that start with `#` are comments and the server ignores them.

The `.env` file is data, not a shell script. Marinara does not execute `$`, command substitutions such as `$(...)`, or other shell syntax found in a value. The macOS/Linux and Termux launchers use the same non-evaluating rule for the small set of settings they need before server startup. A value already supplied in the launcher's environment takes precedence over the matching `.env` entry.

Marinara creates an empty `.env` for you the first time it starts, so you do not have to make one by hand.

- On normal installs, the `.env` file sits in the project root folder.
- On official Docker or Podman images, it sits at `/app/data/.env`, inside the same storage volume as your data.

A file named `.env.example` in the same folder lists every setting with its default. To change a setting, copy the line from `.env.example` into `.env`, then edit the value after the `=` sign.

Here is a sample `.env` that changes the port and enables a password:

```
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

The server reads `.env` by itself, no matter how you start it. This includes running `pnpm start` directly. The shell launchers (`start.bat`, `start.sh`, `start-termux.sh`) add two extras. They set `HOST=0.0.0.0` so other devices can reach the server, and they open the browser for you. With bare `pnpm start`, the server listens only on this computer unless you set `HOST` yourself.

## Restart or hot reload

Marinara watches the `.env` file while it runs. When you save a change, most settings take effect almost immediately, with no restart. The server writes a log line starting with `[env-watcher]` each time it applies a change. If the file watch cannot be set up on your filesystem, the server falls back to checking the file every 30 seconds and says so in the log.

One caveat: on some setups the watch starts fine but change events never arrive — typically when the file is edited from *another machine or context*, such as across a network share or from the host into a container bind mount. If your `.env` edits are not being picked up, set `MARINARA_ENV_WATCH=poll` to make the server check the file every 30 seconds instead; that sees every write. To turn the watcher off entirely, set `MARINARA_ENV_WATCH=0` (in the shell environment, or in `.env` itself before starting) — changes then require a restart. Both are advanced options; the hot-reload path is how access-control changes take effect without downtime, so leave the default unless you have a specific reason.

A small group of low-level settings are locked in when the server starts. Changing them needs a full restart. These settings are:

- `PORT`, `HOST`
- `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`, `MARINARA_ENV_WATCH`
- `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_UPDATE_ENABLED`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- The image, video, sprite, and ComfyUI timeout and poll settings (`IMAGE_GEN_TIMEOUT_MS`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT`, and the four `*_VIDEO_POLL_INTERVAL_MS` settings)

When one of these changes, the log warns that a restart is required. Access-control settings and secrets like `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, and `CSRF_TRUSTED_ORIGINS` do not need a restart.

## Access control

Access control decides who is allowed to reach a running server. This section is a quick reference. For a step-by-step walkthrough with examples, read [Remote Access: Basic Auth and IP Allowlist](REMOTE_ACCESS.md).

A few terms used below:

- Loopback means the same computer the server runs on. You reach it at `127.0.0.1` or `localhost`.
- A CIDR range is a short way to write a whole block of IP addresses, like `192.168.1.0/24`. CIDR stands for Classless Inter-Domain Routing.
- RFC 1918 ranges are the standard private address ranges used inside home and office networks, such as `10.x.x.x` and `192.168.x.x`.

By default, when you set no password, the server accepts connections only from trusted sources. Those are loopback, any address in `IP_ALLOWLIST`, Tailscale, and same-host Docker bridge/gateway traffic. Every other caller, including your normal home network, gets a `403 Forbidden` until you pick one of the options below.

The main access-control settings are:

| Variable                                | Default           | What it does                                                                                                                                              |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASIC_AUTH_USER`                       | empty             | Username for a password prompt. Set with `BASIC_AUTH_PASS` to require a login.                                                                            |
| `BASIC_AUTH_PASS`                       | empty             | Password for the login prompt. Leave either field empty to turn login off.                                                                                |
| `BASIC_AUTH_REALM`                      | `Marinara Engine` | Text shown in the browser's password box.                                                                                                                 |
| `IP_ALLOWLIST`                          | empty             | Comma-separated IPs or CIDR ranges that are always allowed. Loopback is always allowed.                                                                   |
| `IP_ALLOWLIST_ENABLED`                  | `true`            | Set to `false` to keep the list but pause enforcement.                                                                                                    |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false`           | Restores passwordless access from private networks when no login is set.                                                                                  |
| `ALLOW_UNAUTHENTICATED_REMOTE`          | `false`           | Allows passwordless access from any address, including the public internet. Not recommended.                                                              |
| `TRUSTED_PRIVATE_NETWORKS`              | built-in defaults | Replaces the default private-network ranges. Include any defaults you still want.                                                                         |
| `BYPASS_AUTH_TAILSCALE`                 | automatic         | Empty trusts direct Tailscale sockets only when both endpoints use Tailnet addresses. Set `true` for the legacy whole-`100.64.0.0/10` bypass or `false` to require normal access control. |
| `BYPASS_AUTH_DOCKER`                    | automatic         | Empty trusts only a detected container interface and its exact gateway. Set `true` for legacy/custom-network compatibility or `false` to require normal access control. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY`         | `true`            | Requires normal login/allowlist checks for proxy-forwarded Docker traffic. Set to `false` only when every upstream client is trusted.                     |
| `TRUSTED_HOSTS`                         | empty             | Extra public or reverse-proxy hostnames Marinara may answer. Direct IP, localhost, `.local`, `.home.arpa`, and single-label LAN names work automatically. |
| `SSL_CERT`                              | empty             | Path to a TLS certificate file. Set with `SSL_KEY` to serve HTTPS directly.                                                                               |
| `SSL_KEY`                               | empty             | Path to the TLS private key file.                                                                                                                         |
| `CSRF_TRUSTED_ORIGINS`                  | empty             | Extra browser origins allowed to save changes. Use for a public domain or an unusual port. Literal `null` is ignored and must not be used for the Android APK; its self-authenticating login routes work without globally trusting an opaque origin. |

Basic Auth is short for HTTP Basic Authentication, a simple username and password prompt. Its credentials are only encoded, not encrypted, so always pair it with HTTPS when your server faces the public internet. HTTPS is the secure, encrypted version of HTTP. To turn it on directly, set both `SSL_CERT` and `SSL_KEY`, or put a reverse proxy in front of Marinara.

To let other devices reach the server at all, the server must bind to a reachable interface. Set `HOST=0.0.0.0`. The shell launchers do this for you, but `pnpm start` binds to loopback only.

Phones, tablets, Tailscale peers, and other computers can continue to connect by the server's IP address without adding it to `TRUSTED_HOSTS`. If you publish Marinara at a public or reverse-proxy hostname, add that exact name, for example `TRUSTED_HOSTS=chat.example.com`. Names already present in `CSRF_TRUSTED_ORIGINS` or `CORS_ORIGINS` are also accepted for compatibility. This Host check prevents a public website's DNS name from being rebound to Marinara's loopback address.

## Storage

Storage settings control where your local data lives. Your data includes chats, characters, avatars, and generated media.

| Variable           | Default                                | What it does                                                             |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------ |
| `DATA_DIR`         | `packages/server/data`                 | Root folder for all user data. Docker images set `/app/data`.            |
| `FILE_STORAGE_DIR` | the `storage` folder inside `DATA_DIR` | Overrides the file-storage folder.                                       |
| `ENCRYPTION_KEY`   | empty                                  | Key used to encrypt saved API keys. Generate one with the command below. |

Marinara keeps your data as plain JSON files. This makes backups easy to copy and inspect.

To generate an encryption key, run this command and paste the result into `ENCRYPTION_KEY`:

```
openssl rand -hex 32
```

To learn what each data folder holds, see [Where Your Data Is Stored](data/where-data-is-stored.md).

## Logging levels

Logging controls how much detail the server prints to its console. The main control is `LOG_LEVEL`. The server hides anything below the level you pick.

| Level   | What it shows                                                       |
| ------- | ------------------------------------------------------------------- |
| `error` | Only serious, unrecoverable failures.                               |
| `warn`  | Errors plus non-fatal warnings. This is the default.                |
| `info`  | Warnings plus startup and per-request logs.                         |
| `debug` | Everything, including full prompts and model replies. Very verbose. |

Recommended choices:

- Keep the default `warn` for normal use. It is quiet and shows only real problems.
- Use `info` when you want to see requests and milestones without flooding the console.
- Use `debug` when you need to see the exact prompt sent to the model and the reply. Expect a lot of output.

To read prompt and connection details without the routine request logs, set a preset instead of a level:

```
LOG_PRESET=prompt-connections
```

That preset shows the same prompt and model detail as `debug`, but hides repeated request lines like `GET /api/chats`. To silence only those routine request lines while keeping your current level, set this and restart:

```
LOG_DISABLE_REQUEST_LOGGING=true
```

Browser logging is separate and is not controlled by `LOG_LEVEL`.

## Timeouts

A timeout is the longest time the server waits for a slow job before giving up. Media jobs like image and video generation can be slow, so their timeouts are generous by default. All timeout values are in milliseconds unless the name says otherwise.

| Variable                               | Default                              | What it does                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHAT_GENERATION_TIMEOUT_MS`           | `300000` (5 minutes)                 | Provider headers/time-to-first-token and inter-chunk timeout for ordinary Conversation, Roleplay, and Game generations, and the time-to-first-byte budget for background generation that has no timeout of its own (Noodle timeline refresh, Noodler replies). Valid range: `10000`-`3600000`. It does not change Agent, media, embedding, or tool timeouts.                                                                                      |
| `AGENT_CALL_TIMEOUT_MS`                | `300000` (5 minutes)                 | Total-duration cap for one agent LLM call (trackers, HTML reformatter, and other agents), applied even while the response is still streaming. Raise it for slow local models that need longer than 5 minutes per agent pass. Valid range: `10000`-`3600000`. The Illustrator keeps at least its built-in 30-minute budget. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 seconds)                 | Total-duration cap for the model call that turns the current Game scene into a dynamic image prompt. Raise it for slower local models. Valid range: `10000`-`3600000`.                                                                                                                                                     |
| `EMBEDDING_TIMEOUT_MS`                 | `300000` (5 minutes)                 | Time allowed for one embedding request. Higher helps slow local embedding servers.                                                                                                                                                                                                                                         |
| `IMAGE_GEN_TIMEOUT_MS`                 | `1800000` (30 minutes)               | Time allowed for one image generation request.                                                                                                                                                                                                                                                                             |
| `VIDEO_GEN_TIMEOUT_MS`                 | `1800000` (30 minutes)               | Time allowed for one scene video generation request, including local ComfyUI video workflows.                                                                                                                                                                                                                              |
| `VIDEO_GEN_MAX_RESPONSE_BYTES`         | `167772160` (160 MiB)                | Largest scene video download the server will accept.                                                                                                                                                                                                                                                                       |
| `COMFYUI_GEN_TIMEOUT`                  | `2400` (40 minutes, in seconds)      | Time allowed for one ComfyUI image workflow after it is queued.                                                                                                                                                                                                                                                            |
| `SPRITE_GENERATION_TIMEOUT_MS`         | falls back to `IMAGE_GEN_TIMEOUT_MS` | Time allowed for one AI sprite generation job.                                                                                                                                                                                                                                                                             |
| `CUSTOM_TOOL_TIMEOUT_MS`               | `60000` (1 minute)                   | Time allowed for one custom tool call.                                                                                                                                                                                                                                                                                     |
| `MAX_TOOL_ROUNDS`                      | `100`                                | Most tool-call rounds before the model must give a final answer.                                                                                                                                                                                                                                                           |

The image, video, sprite, and ComfyUI timeouts are locked in at startup, so a change to them needs a restart. Chat-generation, agent, dynamic Game image-prompt, embedding, and custom-tool timeouts take effect on the next request or agent run, with no restart. Invalid, zero, negative, or out-of-range values for the validated chat, agent, or dynamic Game image-prompt timeouts log a warning and safely use their documented defaults. Raise a media timeout when large or high-quality jobs fail partway through. To learn more about video jobs, see [Scene Video](media/scene-video.md).

## Privileged APIs (ADMIN_SECRET)

Some actions are destructive or high-risk, so they need an extra secret on top of the normal access checks. Examples are backups, clearing data, applying updates, and installing themes.

Set a long, random value for `ADMIN_SECRET` on the server:

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

On the machine running the server (loopback), these actions usually work without the secret. From another device, the app must send the secret. Paste the same value into the app under **Settings**, then **Advanced**, then **Admin Access**. After that, the app sends it for you.

Related privileged settings:

| Variable                                    | Default               | What it does                                                                                                                                                                          |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_SECRET`                              | empty                 | Shared secret required for privileged actions from remote devices.                                                                                                                    |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false`               | When `true`, requires the secret even on the local machine.                                                                                                                           |
| `UPDATES_APPLY_ENABLED`                     | `false`               | Allows the browser to apply ordinary same-channel updates. A deliberate release-channel switch from a browser on the server machine works without this flag. Git-based installs only. |
| `UPDATES_ALLOW_REMOTE_APPLY`                | `false`               | Allows a remote device to apply updates, with a valid secret.                                                                                                                         |
| `HAPTICS_ALLOW_REMOTE`                      | `false`               | Allows haptic device actions from a remote device, with a valid secret.                                                                                                               |
| `CUSTOM_TOOL_SCRIPT_ENABLED`                | `false`               | Enables custom script tools. Keep off for untrusted or imported tools.                                                                                                                |
| `ENABLE_CUSTOM_AGENT_REPOS`                 | `false`               | Enables manual GitHub agent-repository preview and sync in Agents Manager. Third-party agents are unvetted and require explicit confirmation before import or update.                 |
| `ENABLE_EXTERNAL_EXTENSIONS`                | `false`               | First of two gates for third-party extension imports. The user must also opt in under Settings → Advanced → Danger Zone.                                                              |
| `IMPORT_ALLOWED_ROOTS`                      | empty                 | Filesystem folders that bulk import may read without a picker token.                                                                                                                  |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES`           | `268435456` (256 MiB) | Largest single JSON profile export the server will build.                                                                                                                             |

If `ADMIN_SECRET` is not set on the server, privileged actions fail from any device except the local machine. The error tells you to set the secret and paste it into **Admin Access**.

## Local address opt-ins

By default, outbound requests to providers, image services, and webhooks refuse to reach private or local addresses. This blocks a class of attack called SSRF (server-side request forgery), where a request is tricked into reaching an internal address. Loopback provider addresses stay allowed so local model servers keep working.

Turn on only the switch you need for a self-hosted service on another private-network machine.

| Variable                      | Default | What it does                                                                         |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Allows AI provider URLs to reach private or LAN addresses. On by default on Android. |
| `IMAGE_LOCAL_URLS_ENABLED`    | `false` | Allows image provider URLs to reach private or LAN addresses. Private generated-image result URLs must still match the configured provider's exact origin. |
| `TTS_LOCAL_URLS_ENABLED`      | `false` | Allows text-to-speech URLs to reach private or LAN addresses.                        |
| `DEEPLX_LOCAL_URLS_ENABLED`   | `false` | Allows DeepLX translation URLs to reach private or LAN addresses.                    |
| `WEBHOOK_LOCAL_URLS_ENABLED`  | `false` | Allows custom tool webhooks to reach private or LAN addresses.                       |

To connect a local or self-hosted model, see [Connecting a Local or Self-Hosted Model](connections/local-self-hosted.md).

## Full environment variable reference

This section lists the remaining settings, grouped by purpose. The tables above already cover access control, storage, logging, timeouts, privileged actions, and local address opt-ins.

### Server and startup

| Variable                         | Default                                        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                           | `7860`                                         | The port the server listens on. Keep Android, Docker, and Termux on the same value.                                                                                                                                                                                                                                                                                                                                                                                              |
| `HOST`                           | `127.0.0.1` (`0.0.0.0` in the shell launchers) | The network interface to bind. Use `0.0.0.0` for LAN access.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `MARINARA_ANDROID_SECRET`        | empty                                          | Internal local-auth secret for APK-managed Termux installs. This is not an installer input: the Android wrapper generates and provisions it, and the Termux launcher exports it automatically. Do not ask APK users to supply it or set it for ordinary desktop or manual Termux installs. When configured, it must be exactly 64 hexadecimal characters. An invalid non-empty value makes device-local requests fail with HTTP 503 rather than weakening authentication.                                                                              |
| `MARINARA_ANDROID_SECRET_FILE`   | `~/.marinara-engine/android-secret`            | Private secret-file path used by the Termux launcher and the local `mari` CLI. The APK and launcher manage this file automatically; normal APK users never need to read or copy it.                                                                                                                                                                                                                                                                                                |
| `AUTO_OPEN_BROWSER`              | `true`                                         | Whether the shell launchers open the app URL for you. Set `false` to stop this. APK-managed setup disables browser auto-open for its launch so the already-authenticated Android app connects instead.                                                                                                                                                                                                                                                                             |
| `AUTO_UPDATE_ENABLED`            | `true`                                         | Whether Git-based Windows, macOS/Linux, and Termux launchers fetch and apply Engine updates before startup. Set `false` for a persistent opt-out; this takes effect on the next launch. The launcher still performs a read-only check for newer published releases and prints a download reminder when one is available, while manual checks, in-app apply, package updates, and model updates remain available. Use `--skip-update` to skip both launcher checks for one start. |
| `MARINARA_ENV_FILE`              | project-root `.env`                            | Optional path override for the `.env` file. Set it before startup.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4`                                            | Process-wide ceiling on concurrent image/video provider requests, across every surface (galleries, storyboards, game assets, sprites, avatars). Raise it for a beefy local GPU or a provider with generous limits; lower it to 1-2 if a local ComfyUI/SwarmUI runs out of VRAM during batches; `0` disables the ceiling entirely. Invalid values are ignored with a logged warning. Batch/automatic work never occupies the last slot, so one permit always stays available for interactive requests. Applies on top of the per-connection request queue. |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000`                                   | How long a generation request may wait for a free concurrency slot before failing with a clear error instead of hanging (10 minutes by default; `0` waits forever). |
| `MARINARA_ENV_WATCH`             | `1`                                            | How the server watches `.env` for live changes. Default: change events (applied after a ~250 ms debounce), with an automatic fallback to a 30-second file check if the watch cannot be set up. `poll` uses the 30-second check always (for network mounts or bind mounts edited from outside). `0` turns watching off; changes then need a restart. See [Restart or hot reload](#restart-or-hot-reload).                                                                          |
| `TZ`                             | system default                                 | Host fallback timezone for server-side jobs. Conversation schedules use the global timezone selected in their schedule controls when one has been saved. Leave `TZ` unset to inherit the host timezone; an empty `TZ=` is also treated as unset.                                                                                                                                                                                                                                 |
| `CORS_ORIGINS`                   | `http://localhost:5173,http://127.0.0.1:5173`  | Browser origins allowed to make cross-origin requests.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true`                                         | Legacy flag. Current builds bundle no starter key, so this creates nothing. Add your own connection in the app.                                                                                                                                                                                                                                                                                                                                                                  |

`AUTO_CREATE_DEFAULT_CONNECTION` is kept only for older installs. New builds no longer ship a bundled starter connection, so leaving it on does nothing. To start chatting, add a connection under [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

Conversation schedule controls default to the timezone reported by the browser or app device. **Schedule timezone** can be changed during Conversation setup, in Conversation Chat Settings, or in the character schedule editor. The selected IANA timezone is one global preference shared by every Conversation chat and synced to other Marinara clients connected to the same server.

### Media and sprite tools

| Variable                            | Default               | What it does                                                                                                                                                             |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FFMPEG_PATH`                       | empty                 | Path to an `ffmpeg` program. Used for animated expression GIFs. Falls back to `ffmpeg` on your PATH.                                                                     |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 minutes)  | Time allowed to convert one animated expression clip.                                                                                                                    |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE`  | `auto`                | Sprite cleanup engine. `auto` tries adaptive matte cleanup before the optional AI fallback; `builtin` keeps only the matte path; `backgroundremover` forces the AI tool. |
| `BACKGROUNDREMOVER_AUTO_INSTALL`    | `false`               | When `true`, installs the optional AI background remover on launch.                                                                                                      |
| `BACKGROUNDREMOVER_COMMAND`         | empty                 | Path to a system `backgroundremover` program.                                                                                                                            |
| `BACKGROUNDREMOVER_PYTHON`          | empty                 | Path to a Python program where `backgroundremover` is installed.                                                                                                         |
| `BACKGROUNDREMOVER_TIMEOUT_MS`      | `600000` (10 minutes) | Time allowed for one AI background-removal call.                                                                                                                         |

### Scene video providers

Scene video providers are set up as connections inside the app, not as environment variables. The settings below only tune the underlying jobs. All values are in milliseconds.

| Variable                            | Default | What it does                                                                                   |
| ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | How often the server checks a Google Veo job.                                                  |
| `XAI_VIDEO_POLL_INTERVAL_MS`        | `5000`  | How often the server checks an xAI Imagine job.                                                |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | How often the server checks an OpenRouter video job.                                           |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS`   | `10000` | How often the server checks a Seedance job.                                                    |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL`   | empty   | Public HTTPS address of this server, used when a provider must fetch a reference image by URL. |

### Integrations and extras

| Variable                          | Default                                    | What it does                                                                      |
| --------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `DOCS_I18N_BASE_URL`              | official `docs-i18n` branch                | Where translated documentation packs download from (Settings → General → Documentation Language). Must be a public `https://` host; forks and mirrors can point it at their own copy of the `docs-i18n` branch. |
| `GIPHY_API_KEY`                   | empty                                      | Giphy key for GIF search in Conversation mode. Search is off when unset.          |
| `INTIFACE_URL`                    | `ws://127.0.0.1:12345`                     | Default address for the Intiface haptic app.                                      |
| `SPOTIFY_REDIRECT_URI`            | derived from request                       | Override for the Spotify login callback URL. Set it when TLS is handled upstream. |
| `MARI_WIKI_CONTENT_MAX_BYTES`     | `50000`                                    | Largest wiki page content Professor Mari reads before trimming.                   |
| `MARI_WIKI_REQUEST_TIMEOUT_MS`    | `30000`                                    | Time allowed for one wiki request by Professor Mari.                              |
| `MARI_WIKI_CACHE_TTL_MS`          | `300000`                                   | How long Professor Mari caches a wiki read.                                       |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (the Windows launcher sets `true`) | Allows installing the local model runtime without an admin header on loopback.    |
| `SSL_CERT`                        | empty                                      | Path to a TLS certificate. See Access control above.                              |
| `SSL_KEY`                         | empty                                      | Path to a TLS private key. See Access control above.                              |

For a Giphy key, note that GIF search stays unavailable until you set `GIPHY_API_KEY` and restart. For the built-in local model, see [Local Model Setup](connections/local-model.md).

## Related guides

- [Remote Access: Basic Auth and IP Allowlist](REMOTE_ACCESS.md)
- [Where Your Data Is Stored](data/where-data-is-stored.md)
- [Connecting to an AI Provider](connections/connecting-to-a-provider.md)
- [Scene Video](media/scene-video.md)
- [Troubleshooting Marinara Engine](TROUBLESHOOTING.md)
