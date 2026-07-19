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

- **Updates:** On every server startup, already-installed official packages automatically upgrade to the newest compatible version before their runtimes activate and self-check. A fresh install remains empty until you choose packages.
- **Platforms:** The same behavior applies to desktop, Docker, and Termux-hosted Android installations. iOS and other browser clients use the packages installed on their Marinara host server.
- **Persistence:** Packages live under `DATA_DIR/capability-packages`. Docker volumes, custom data directories, backups, and normal upgrades preserve them.
- **Offline resilience:** Existing packages continue working at their installed version when outbound GitHub HTTPS is unavailable or an update fails verification.

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

Marinara watches the `.env` file while it runs. When you save a change, most settings take effect within about 2 seconds, with no restart. The server writes a log line starting with `[env-watcher]` each time it applies a change.

A small group of low-level settings are locked in when the server starts. Changing them needs a full restart. These settings are:

- `PORT`, `HOST`
- `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`
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

| Variable | Default | What it does |
| --- | --- | --- |
| `BASIC_AUTH_USER` | empty | Username for a password prompt. Set with `BASIC_AUTH_PASS` to require a login. |
| `BASIC_AUTH_PASS` | empty | Password for the login prompt. Leave either field empty to turn login off. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Text shown in the browser's password box. |
| `IP_ALLOWLIST` | empty | Comma-separated IPs or CIDR ranges that are always allowed. Loopback is always allowed. |
| `IP_ALLOWLIST_ENABLED` | `true` | Set to `false` to keep the list but pause enforcement. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Restores passwordless access from private networks when no login is set. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Allows passwordless access from any address, including the public internet. Not recommended. |
| `TRUSTED_PRIVATE_NETWORKS` | built-in defaults | Replaces the default private-network ranges. Include any defaults you still want. |
| `BYPASS_AUTH_TAILSCALE` | `true` | Lets Tailscale traffic skip the login and allowlist. |
| `BYPASS_AUTH_DOCKER` | `true` | Lets Docker bridge traffic and the exact default gateway detected inside Docker skip the login and allowlist. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `false` | Forces normal login for Docker traffic that looks reverse-proxied. |
| `SSL_CERT` | empty | Path to a TLS certificate file. Set with `SSL_KEY` to serve HTTPS directly. |
| `SSL_KEY` | empty | Path to the TLS private key file. |
| `CSRF_TRUSTED_ORIGINS` | empty | Extra browser origins allowed to save changes. Use for a public domain or an unusual port. |

Basic Auth is short for HTTP Basic Authentication, a simple username and password prompt. Its credentials are only encoded, not encrypted, so always pair it with HTTPS when your server faces the public internet. HTTPS is the secure, encrypted version of HTTP. To turn it on directly, set both `SSL_CERT` and `SSL_KEY`, or put a reverse proxy in front of Marinara.

To let other devices reach the server at all, the server must bind to a reachable interface. Set `HOST=0.0.0.0`. The shell launchers do this for you, but `pnpm start` binds to loopback only.

## Storage

Storage settings control where your local data lives. Your data includes chats, characters, avatars, and generated media.

| Variable | Default | What it does |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Root folder for all user data. Docker images set `/app/data`. |
| `FILE_STORAGE_DIR` | the `storage` folder inside `DATA_DIR` | Overrides the file-storage folder. |
| `ENCRYPTION_KEY` | empty | Key used to encrypt saved API keys. Generate one with the command below. |

Marinara keeps your data as plain JSON files. This makes backups easy to copy and inspect.

To generate an encryption key, run this command and paste the result into `ENCRYPTION_KEY`:

```
openssl rand -hex 32
```

To learn what each data folder holds, see [Where Your Data Is Stored](data/where-data-is-stored.md).

## Logging levels

Logging controls how much detail the server prints to its console. The main control is `LOG_LEVEL`. The server hides anything below the level you pick.

| Level | What it shows |
| --- | --- |
| `error` | Only serious, unrecoverable failures. |
| `warn` | Errors plus non-fatal warnings. This is the default. |
| `info` | Warnings plus startup and per-request logs. |
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

| Variable | Default | What it does |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 minutes) | Provider headers/time-to-first-token and inter-chunk timeout for ordinary Conversation, Roleplay, and Game generations. Valid range: `10000`-`3600000`. It does not change Agent, media, embedding, tool, or background-job timeouts. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 minutes) | Time allowed for one embedding request. Higher helps slow local embedding servers. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 minutes) | Time allowed for one image generation request. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 minutes) | Time allowed for one scene video generation request, including local ComfyUI video workflows. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 MiB) | Largest scene video download the server will accept. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 minutes, in seconds) | Time allowed for one ComfyUI image workflow after it is queued. |
| `SPRITE_GENERATION_TIMEOUT_MS` | falls back to `IMAGE_GEN_TIMEOUT_MS` | Time allowed for one AI sprite generation job. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 minute) | Time allowed for one custom tool call. |
| `MAX_TOOL_ROUNDS` | `100` | Most tool-call rounds before the model must give a final answer. |

The image, video, sprite, and ComfyUI timeouts are locked in at startup, so a change to them needs a restart. Chat-generation, embedding, and custom-tool timeouts take effect on the next request, with no restart. Invalid, zero, negative, or out-of-range chat timeout values log a warning and safely use the five-minute default. Raise a media timeout when large or high-quality jobs fail partway through. To learn more about video jobs, see [Scene Video](media/scene-video.md).

## Privileged APIs (ADMIN_SECRET)

Some actions are destructive or high-risk, so they need an extra secret on top of the normal access checks. Examples are backups, clearing data, applying updates, and installing themes or extensions.

Set a long, random value for `ADMIN_SECRET` on the server:

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

On the machine running the server (loopback), these actions usually work without the secret. From another device, the app must send the secret. Paste the same value into the app under **Settings**, then **Advanced**, then **Admin Access**. After that, the app sends it for you.

Related privileged settings:

| Variable | Default | What it does |
| --- | --- | --- |
| `ADMIN_SECRET` | empty | Shared secret required for privileged actions from remote devices. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | When `true`, requires the secret even on the local machine. |
| `UPDATES_APPLY_ENABLED` | `false` | Allows the browser to apply ordinary same-channel updates. A deliberate release-channel switch from a browser on the server machine works without this flag. Git-based installs only. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Allows a remote device to apply updates, with a valid secret. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Allows haptic device actions from a remote device, with a valid secret. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Enables custom script tools. Keep off for untrusted or imported tools. |
| `IMPORT_ALLOWED_ROOTS` | empty | Filesystem folders that bulk import may read without a picker token. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 MiB) | Largest single JSON profile export the server will build. |

If `ADMIN_SECRET` is not set on the server, privileged actions fail from any device except the local machine. The error tells you to set the secret and paste it into **Admin Access**.

## Local address opt-ins

By default, outbound requests to providers, image services, and webhooks refuse to reach private or local addresses. This blocks a class of attack called SSRF (server-side request forgery), where a request is tricked into reaching an internal address. Loopback provider addresses stay allowed so local model servers keep working.

Turn on only the switch you need for a self-hosted service on another private-network machine.

| Variable | Default | What it does |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Allows AI provider URLs to reach private or LAN addresses. On by default on Android. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | Allows image provider URLs to reach private or LAN addresses. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | Allows text-to-speech URLs to reach private or LAN addresses. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | Allows DeepLX translation URLs to reach private or LAN addresses. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Allows custom tool webhooks to reach private or LAN addresses. |

To connect a local or self-hosted model, see [Connecting a Local or Self-Hosted Model](connections/local-self-hosted.md).

## Full environment variable reference

This section lists the remaining settings, grouped by purpose. The tables above already cover access control, storage, logging, timeouts, privileged actions, and local address opt-ins.

### Server and startup

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `7860` | The port the server listens on. Keep Android, Docker, and Termux on the same value. |
| `HOST` | `127.0.0.1` (`0.0.0.0` in the shell launchers) | The network interface to bind. Use `0.0.0.0` for LAN access. |
| `AUTO_OPEN_BROWSER` | `true` | Whether the shell launchers open the app URL for you. Set `false` to stop this. |
| `AUTO_UPDATE_ENABLED` | `true` | Whether Git-based Windows, macOS/Linux, and Termux launchers fetch and apply Engine updates before startup. Set `false` for a persistent opt-out; this takes effect on the next launch and does not disable manual update checks, in-app apply, package updates, or model updates. |
| `MARINARA_ENV_FILE` | project-root `.env` | Optional path override for the `.env` file. Set it before startup. |
| `TZ` | system default | Host fallback timezone for server-side jobs. Conversation schedules use the global timezone selected in their schedule controls when one has been saved. Leave `TZ` unset to inherit the host timezone; an empty `TZ=` is also treated as unset. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed to make cross-origin requests. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Legacy flag. Current builds bundle no starter key, so this creates nothing. Add your own connection in the app. |

`AUTO_CREATE_DEFAULT_CONNECTION` is kept only for older installs. New builds no longer ship a bundled starter connection, so leaving it on does nothing. To start chatting, add a connection under [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

Conversation schedule controls default to the timezone reported by the browser or app device. **Schedule timezone** can be changed during Conversation setup, in Conversation Chat Settings, or in the character schedule editor. The selected IANA timezone is one global preference shared by every Conversation chat and synced to other Marinara clients connected to the same server.

### Media and sprite tools

| Variable | Default | What it does |
| --- | --- | --- |
| `FFMPEG_PATH` | empty | Path to an `ffmpeg` program. Used for animated expression GIFs. Falls back to `ffmpeg` on your PATH. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 minutes) | Time allowed to convert one animated expression clip. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | Sprite cleanup engine. `auto` tries adaptive matte cleanup before the optional AI fallback; `builtin` keeps only the matte path; `backgroundremover` forces the AI tool. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | When `true`, installs the optional AI background remover on launch. |
| `BACKGROUNDREMOVER_COMMAND` | empty | Path to a system `backgroundremover` program. |
| `BACKGROUNDREMOVER_PYTHON` | empty | Path to a Python program where `backgroundremover` is installed. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 minutes) | Time allowed for one AI background-removal call. |

### Scene video providers

Scene video providers are set up as connections inside the app, not as environment variables. The settings below only tune the underlying jobs. All values are in milliseconds.

| Variable | Default | What it does |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | How often the server checks a Google Veo job. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | How often the server checks an xAI Imagine job. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | How often the server checks an OpenRouter video job. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | How often the server checks a Seedance job. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | empty | Public HTTPS address of this server, used when a provider must fetch a reference image by URL. |

### Integrations and extras

| Variable | Default | What it does |
| --- | --- | --- |
| `GIPHY_API_KEY` | empty | Giphy key for GIF search in Conversation mode. Search is off when unset. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Default address for the Intiface haptic app. |
| `SPOTIFY_REDIRECT_URI` | derived from request | Override for the Spotify login callback URL. Set it when TLS is handled upstream. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Largest wiki page content Professor Mari reads before trimming. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Time allowed for one wiki request by Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | How long Professor Mari caches a wiki read. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (the Windows launcher sets `true`) | Allows installing the local model runtime without an admin header on loopback. |
| `SSL_CERT` | empty | Path to a TLS certificate. See Access control above. |
| `SSL_KEY` | empty | Path to a TLS private key. See Access control above. |

For a Giphy key, note that GIF search stays unavailable until you set `GIPHY_API_KEY` and restart. For the built-in local model, see [Local Model Setup](connections/local-model.md).

## Related guides

- [Remote Access: Basic Auth and IP Allowlist](REMOTE_ACCESS.md)
- [Where Your Data Is Stored](data/where-data-is-stored.md)
- [Connecting to an AI Provider](connections/connecting-to-a-provider.md)
- [Scene Video](media/scene-video.md)
- [Troubleshooting Marinara Engine](TROUBLESHOOTING.md)
