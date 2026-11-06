# Troubleshooting Marinara Engine

Find your symptom, then follow the fix. Most problems clear after you restart Marinara through its launcher (`start.bat`, `start.sh` or `start-termux.sh`).

## First things to try

1. Hard refresh the page: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> on Windows or Linux, <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> on a Mac.
2. Look at the server console (the terminal window that runs Marinara) for red error lines. They usually name the real problem.
3. To ask for help, turn on **Debug mode** first. See [Get more help](#get-more-help).

## My character does not reply

Check these in order.

1. Look for a toast (a short message at the bottom of the screen). It usually names the problem. See [Connection and generation errors](#connection-and-generation-errors).
2. Check the chat has an account and a model: open **Chat Settings** and look at the connection. With none, add an account in **Connections**. See [Connecting to an AI Provider](connections/connecting-to-a-provider.md).
3. Check the API key is correct and the account has credit. A wrong key or an empty balance is a common cause.
4. Check the model name and, for a local server such as Ollama or LM Studio, that the server is running.
5. Send your message again, or pick a different model.

If nothing helps, turn on **Debug mode** and read the server console. See [Get more help](#get-more-help).

## App not loading on mobile / another device

Cannot open Marinara from a phone, tablet or another computer?

Most often it is one of these three:

- **Address.** The server listens on `127.0.0.1` (this computer only) by default. The launchers set `HOST=0.0.0.0`. If you started with `pnpm start`, set `HOST=0.0.0.0` in `.env` first.
- **Network.** Both devices must be on the same Wi-Fi network, and no firewall may block the port. The default port is `7860`, or your `PORT`.
- **Login.** Set one. On the blocked device, type the one-time setup code from the server log with a new username and password. In Docker, find the code with `docker logs <container> 2>&1 | grep "setup code"`. Or set it in **Settings → Advanced → Access** in a browser that is already signed in. On a headless server, run `ssh -L 7860:127.0.0.1:7860 user@server`, open `http://localhost:7860` and use **Settings**. See [Remote Access](REMOTE_ACCESS.md#option-1-login-recommended).

More causes:

- **Proxy or tunnel on the same machine.** A reverse proxy or tunnel on the same machine needs the login. Direct Tailscale traffic is trusted by default. Tailscale Serve or Funnel and nginx's default HTTP/1.0 `proxy_pass` count as relayed and need the login. Same-host Docker bridge traffic is trusted only while no login, `IP_ALLOWLIST` or `TRUSTED_AUTH_PROXY` is set.
- **Custom name for this computer.** A name mapped to `127.0.0.1` in `/etc/hosts` counts as relayed. Use `localhost`, `127.0.0.1`, the machine's hostname or a `*.localhost` name instead.
- **Too many wrong passwords.** Wait 15 minutes, then sign in. Forgot the password? Run `node scripts/reset-login.mjs` in the Marinara folder on the computer that runs Marinara. In Docker, run `docker exec <container> node scripts/reset-login.mjs`. Restarting the server also lets it try again.
- **Untrusted request host.** For a public or reverse-proxy domain, add its exact hostname to `TRUSTED_HOSTS` in `.env`. Direct IP addresses stay accepted.
- **Risky actions blocked** (backups, clearing data, updates) from that device. On the server's own computer, open **Settings → Advanced → Admin Access** and click **Make admin secret**, or set `ADMIN_SECRET` in the server `.env`. Type the secret into **Admin Access** on the other device and click **Save**.

See [Remote Access](REMOTE_ACCESS.md) and the [FAQ](FAQ.md). If you were locked out after an update, see [Locked out after updating](REMOTE_ACCESS.md#locked-out-after-updating).

## Save blocked, or settings that do not persist

A save seems to work but reverts when you reload. Cross-site protection (CSRF) is blocking it because it does not trust this browser address. You see a red banner saying saves will silently fail, or a toast titled **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** or **Save blocked: origin not trusted**.

Loopback, private network addresses, Tailscale and the Docker bridge are trusted automatically. This mostly happens on a public IP or a domain name. Add the address to `CSRF_TRUSTED_ORIGINS` in `.env`, comma separated. The banner has a **Copy** button that fills in the line. No restart is needed.

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

## Connection and generation errors

Generation errors show as a toast at the bottom of the screen. It names the reason and stays up long enough to copy.

| Message or symptom | Fix |
| --- | --- |
| **No API connection configured for this chat** | The chat has no account. Add one in **Connections**, then pick it for the chat. See [Connecting to an AI Provider](connections/connecting-to-a-provider.md). |
| The model does not accept a parameter | Open **Chat Settings → Advanced Parameters** and turn off the switch next to the parameter the toast names. |
| The model says a parameter is required | Turn that parameter's switch on. |
| **This model's chat template needs user and assistant messages to take turns** | Some local models, such as Mistral-based models on llama.cpp, need alternating messages. Marinara merges back-to-back messages and retries once. If it persists, set **Post-Processing Messages** to **Single User Message** in **Chat Settings → Advanced Parameters**, or serve the model with a less strict chat template. |
| **The AI returned an empty response. Try sending your message again.** | Send again. If it repeats, try another model or account. |
| **A generation is already in progress for this chat** | A reply is still streaming. Wait, or click **Stop**, then try again. |
| **No connections are marked for the random pool** | Random routing is on but no account is in the pool. Add one, or turn random routing off. |
| Every message fails with a network error, and your computer reaches the internet only through a proxy | Tell Marinara about the proxy. See [Outbound HTTP proxy](CONFIGURATION.md#outbound-http-proxy). |

## After an update

Problems right after an update, in plain words first:

- The screen is blank or looks old: see [Blank, stale or old-looking screen](#blank-stale-or-old-looking-screen) and [Blank page or JavaScript served as HTML after an update](#blank-page-or-javascript-served-as-html-after-an-update).
- Chats or presets look missing: see [Data seems missing after an update](#data-seems-missing-after-an-update). Your data is almost always still on disk.
- Chats look empty after you went back to an older version: see [Chats show no messages after switching to an older version](#chats-show-no-messages-after-switching-to-an-older-version).

### Blank, stale or old-looking screen

The server runs but the browser shows a blank page, or the app looks old after an update. The browser holds a cached copy of the web app.

1. Hard refresh.
2. If that does not help, open **Settings → Advanced → Updates** and click **Refresh App**.

**Refresh App** clears the browser's service worker (a background script that caches the app) and cache, then reloads. It does not change your data or update the server. To update the app itself, see [Upgrading Marinara Engine](UPGRADING.md).

### Blank page or JavaScript served as HTML after an update

An error such as "Failed to load module script" with a `text/html` type means the browser asked for a JavaScript file that is missing from the build. Deleting your data does not fix it.

1. Stop the server.
2. Run `start.bat`, `start.sh` or `start-termux.sh` again. The launcher rebuilds incomplete client assets before it starts. For a manual install, run `pnpm build` from the repository root first.
3. If the page is still blank, hard refresh or try a private window.

If it still fails, report the failing asset's full URL, HTTP status, Content-Type and first response line, with the launcher output.

### Data seems missing after an update

Do not delete any data folders. Marinara keeps live data in a `storage` folder inside its data folder. Look for `storage` in `packages/server/data/` and in `data/`. The server prints the folders it resolved at startup.

### Chats show no messages after switching to an older version

Newer versions of Marinara store each chat's records (messages, swipes, memories, images) in their own files, which makes saving long chats faster. Older versions cannot read that layout, so chats look empty. The data is still on disk.

Marinara blocks obvious downgrades. The launcher skips an auto-update that would land on an incompatible version, and the in-app updater shows an error that points here.

If you updated and then went back to an older version, restore the backup you made before the update. See [Downgrading to an older version](UPGRADING.md#downgrading-to-an-older-version). Technical details follow.

Your data is now at storage format 10. Formats 8, 9 and 10 add 3D avatar settings (MMD, then GLB and FBX) and connection account links that older builds cannot read safely. If your data reached format 8 or newer, restore a full backup made before that upgrade to use an older build. The command below only converts older chat-file layouts. Do not change the format number by hand. See [Downgrading to an older version](UPGRADING.md#downgrading-to-an-older-version).

For data below format 8, convert the chat-file layout:

1. Stop the Marinara server.
2. From the Marinara folder, run:

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. Switch to the older version and start it.

The command rebuilds the single-file layout from the per-chat files. Nothing is deleted. The per-chat files stay in folders named `<table>.post-unshard-<timestamp>`, and any `.pre-shard` originals stay. When you upgrade again, Marinara converts your data back.

In Docker or Podman, data lives in the `marinara-data` volume. Stop the container, run the command below, then start the older image:

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## Install and launch problems

### Termux: CANNOT LINK EXECUTABLE "node"

Termux prints `CANNOT LINK EXECUTABLE "node"` with `cannot locate symbol` or `library ... not found`. Node.js was upgraded without the rest of Termux. The Android app may then stop with **Could not verify that this Marinara Android build can safely read your stored data**. Your data is not the cause, and installing the APK again does not fix it.

1. In Termux, run:

   ```bash
   pkg upgrade -y
   ```

2. Tap **Install / Start Marinara** in the Android app. For a manual install, run `cd "$HOME/Marinara-Engine" && ./start-termux.sh`.

If the upgrade asks whether to keep a configuration file, press Enter to keep yours. Current launchers and Android apps run this upgrade by themselves.

### Termux: JavaScript heap out of memory while building the client

Vite stops with `Reached heap limit` or `JavaScript heap out of memory`. Update, then rerun `./start-termux.sh`. Client builds use their own 1536 MiB heap, capped at half of the device RAM but never below 1280 MiB. A `NODE_OPTIONS` heap limit you set takes precedence, so remove an old 1024 MiB override. Close other apps before you retry. Phones with under about 3 GB of RAM can still run out of memory. Do not delete your chats or profile to fix a build failure.

### Desktop: JavaScript heap out of memory while type-checking the client

The build stops and says `The client type-check needs about 2.5 GiB of Node.js heap`. The limit in your `NODE_OPTIONS` is too small, and the build keeps a limit you set. Raise `--max-old-space-size` to 2560 or more. If `NODE_OPTIONS` has `--max-old-space-size-percentage`, raise that instead, because it overrides the other. Or remove both options. Then run the launcher again. Your data is not touched.

### Termux: missing multiplayer guest asset

Startup reports a missing `packages/client/dist/multiplayer/guest.js`. Update Marinara and rerun `./start-termux.sh`, which runs the full client build. You do not need to turn on multiplayer.

### Termux: server stops when you open Marinara, or Sharp cannot load

Sharp is the image library Marinara uses for thumbnails and sprites. On Android it runs through a WebAssembly fallback. Update Marinara and let the launcher reinstall dependencies. If the server stops before you can update, repair the install by hand in Termux:

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

Your chats and settings are not touched. If Sharp still cannot load, Marinara keeps running with image processing off. Existing thumbnails still show, new ones use the full-size image, and sprite generation and built-in background removal are unavailable. Do not replace Sharp with another version. Keep the full error output for a report.

### Browser opens before startup finishes

Update and restart through the launcher. It opens the browser only after the server reports it is ready. If startup fails, no tab opens, so keep the terminal error. To open the app yourself, set `AUTO_OPEN_BROWSER=false`.

### Windows: EPERM or corepack signature error when installing pnpm

pnpm is the package manager Marinara uses to install its code. `EPERM: operation not permitted` or a corepack signature error means corepack could not write into the Node install folder. Try one fix, then run the launcher again:

1. Right-click your terminal, choose **Run as administrator**, and run the launcher.
2. Install pnpm yourself: `npm install -g pnpm@12.15.0`
3. In an administrator terminal, update corepack: `npm install -g corepack`

### pnpm version error, or `'pnpm' is not recognized`

Marinara uses pnpm 12.15.0. The launcher fetches the right version for you, and an older global pnpm does not need to be replaced first. Update Marinara (`git pull` in its folder if the launcher cannot), then run the launcher again. If it still fails, install the exact version and rerun the launcher:

```bash
npm install -g pnpm@12.15.0
```

### Linux: ERR_PNPM_ENAMETOOLONG during install

An older install left long folder paths behind. From the Marinara folder, run:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Then run `./start.sh` again. For a manual install, run `pnpm install`.

### Install says "Ignored build scripts: @google/genai"

The notice is harmless. Do not run `pnpm approve-builds`, because it changes a file Marinara tracks. If the notice keeps showing after an update, delete `node_modules/.modules.yaml` in the Marinara folder and run the launcher again.

### ERR_PNPM_TRUST_DOWNGRADE during install

This is almost always a half-finished install. Run the launcher again. For a manual install, run this from the Marinara folder:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Built-in model problems

The **Built-in model** runs on your computer with no API key. Some error messages call it the sidecar. For setup, see [Built-in model setup](connections/local-model.md).

- **Sidecar runtime install is disabled.** On your own computer, set `SIDECAR_RUNTIME_INSTALL_ENABLED=true` in `.env`. From another device, save your admin secret in **Settings → Advanced → Admin Access** first.
- **Model download or setup fails from another device** (a network address or Docker). It may need the admin secret too. On your own computer it does not.
- **Size or SHA-256 mismatch** from a bundled llama.cpp, MLX or uv file. Marinara rejected the file before using it. Update or reinstall Marinara and retry. Do not unpack, edit or bypass the file.

## Memory and summaries

### Memory Recall does not recall anything

**Memory Recall** searches earlier messages and adds the most relevant ones back into the prompt.

1. Open **Chat Settings → Memory Recall** and confirm **Enable Memory Recall** is on.
2. Open **Access memories for this chat**. In **Memories for This Chat**, look at each chunk's status.
3. **Waiting for vector** means the memory is still being processed. Wait, then chat again.
4. **Embedding unavailable** means no embedding source works. Set up an embedding account, or let the built-in model load. To use one source for every chat, pick it under **Embeddings** in the **Defaults** section of **Connections**.

A memory needs at least 5 new messages before it is created. Recall shows only memories that closely match your new message, so it can return nothing even when memories exist.

### Advanced Memory says scenes need attention

A steady dot on the **Chat Settings** button, or a notice that Advanced Memory found problems, means some scene memories are unclear, out of date or missing.

1. Open **Chat Settings → Memory Recall**, or click **Fix** in the notice.
2. Click **Fix**. It repairs every scene it can with the Helper model and never changes summaries you edited.
3. Select each scene number under **need your review**, check its text and characters in **Access memories for this chat**, and click **Save correction**.

If **Fix** stops with an error, check the Helper model's account, then click **Resume processing** or **Fix** again. See [Fixing memory problems](agents/memory.md#fixing-memory-problems).

### Summaries are not generating

Summaries need a working text account.

- Roleplay: open **Chat Settings → Chat Summary**, confirm an account is set, and use **Backfill Summary** to catch up an older chat.
- Conversation: open **Automatic Summarization** and use **Backfill** to retry failed days.
- If your chat requires agent write approval, an AI summary waits for your review.
- A summary that keeps failing, for example from a bad API key, is retried later. Fix the account, then use **Backfill**.

## Downloadable agent problems

- **Catalog unavailable in Agent Organizer.** The computer that runs the server, not only your browser, must reach the [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) catalog over HTTPS. Installed agents keep working offline. Restore the connection, then click **Refresh** or **Try again**.
- **An installed map or call does not appear.** Close Marinara completely and start it again. These packages stay in **Restart required** until the next start. Conversation games activate at once. If installation failed, refresh the catalog and check that the game shows as ready. Adding a game under a chat's **Commands** settings is only needed so characters can start it themselves, not for its manual slash command.
- **First package migration cannot finish.** Do not delete `data/capability-packages` or your chat data. Marinara retries on the next start, and your chat selections stay stored.
- **Large `data/capability-runtime-snapshots` or `data/capability-packages/versions`.** No cleanup needed. Marinara removes old copies at start and keeps the current and previous version of each agent.
- **A package download is rejected.** The checksum, file list, Marinara version range or archive paths do not match the official catalog. Update Marinara, refresh the catalog and retry. Do not extract an artifact into the data folder by hand.
- **Updates.** Agent updates never apply at startup. Marinara asks first. **Not now** keeps the installed version, and **Update** stays in **Agents → Agent Organizer**. A failed update leaves the installed version in place. A server runtime that fails its startup check rolls back.

## Card Browser problems

The **Card Browser** searches public character sites. Open it with the **Download** button at the top of the **Characters** or **Personas** panel.

- **JannyAI shows a Cloudflare block.** Visit the JannyAI site once in the same browser to clear the challenge, then retry.
- **Pygmalion login stops after a restart.** Expected. That login lives only in server memory. Open the login window and paste your token again.
- **CharacterTavern shows a notice instead of results.** Expected. Its new website no longer offers the connection Marinara used. Download the card from character-tavern.com and import the file.

## Media generation problems

### Sprite background cleanup struggles with a complex scene

Generated sprites normally use native transparency or a flat background that Marinara removes. A photographed room, detailed scenery, heavy shadows or colors that match the background may need the optional AI fallback:

```bash
pnpm backgroundremover:install
```

Then restart Marinara and click **Reapply Cleanup** in the sprite generation window. Marinara tries the built-in cleanup first and uses the AI model only when the border does not look uniform. If the install fails:

- Confirm Python 3.9 to 3.11 is installed. Newer versions can force slow native builds.
- Run `pnpm backgroundremover:reinstall`.
- To skip the AI fallback while you troubleshoot, set `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` in `.env`.

### Game Mode or Roleplay storyboards do not appear

Storyboards turn finished narration into keyframe images and optional clips. See the [Storyboard Agent Guide](game/storyboard.md) and [Game Mode: Getting Started](game/getting-started.md).

- Install **Storyboard** from **Agents → Agent Organizer**, then turn on **Enable Agents** and **Enable Storyboards** for the chat.
- Keyframes need an image account. Clips also need a video account.
- Game, automatic: open **Chat Settings → Agents → Storyboards** and confirm **Automatic Storyboard Illustrations** is on. Turn on **Automatic Storyboard Animations** for clips.
- Manual scene video: open **Chat Settings → Gallery**, generate or upload an image, then use **Video** or **Animate**. Check the **Videos** tab.
- Roleplay: add the **Storyboard** agent to the chat. Choose **Still images** or **Animations**, set **Messages per episode** and pick the image account. **Manual only** runs from **Create storyboard** in the **Gallery** section of **Chat Settings**.
- If a custom prompt works better with all characters combined, turn off **Use NovelAI Character Prompts**.
- Slow services can time out. Raise `IMAGE_GEN_TIMEOUT_MS` or `VIDEO_GEN_TIMEOUT_MS` in `.env`, then restart Marinara.
- `Outbound response exceeded 31457280 bytes`: an image response over 30 MiB fails by default. ComfyUI files that embed the workflow and reference images can reach this size. Raise `IMAGE_GEN_MAX_RESPONSE_BYTES` in `.env` and restart, or turn off metadata in ComfyUI.

### Game Mode world generation shows a JSON error

If the model returns broken JSON (structured text), Marinara opens the **Repair JSON** window instead of discarding the turn.

1. Fix the brackets, commas or fields in the editor. The banner reads **JSON is valid.** when the text parses.
2. Click **Format** to tidy the layout.
3. Click **Apply Repaired JSON** to use it without regenerating the response.

## Voice, calls and TTS

- **Characters do not speak in a call.** Text to Speech is not set up. Open **Connections → Text to Speech**, turn it on, choose a source, enter your key, pick a voice and save. A character with no voice shows as text only.
- **Speech stops with "No audio after N s".** Your voice server is slower than Marinara waits, which is common for a local server on a laptop. `N` is your current timeout. Raise **Request timeout (seconds)** in **Connections → Text to Speech**, or in the audio account the message names. See [Request timeout](media/tts-setup.md#request-timeout).
- **The microphone does not work.** Install **Calls** from **Agents → Agent Organizer**. Then open **Connections → Speech to text**, find **Local speech model** under **On this device**, choose a Whisper model and click **Download Whisper**. Firefox needs this because it has no browser speech recognition. Uninstalling Calls deletes its Whisper models. You can also use your own server: see [Use your own speech-to-text server](conversation/calls.md#use-your-own-speech-to-text-server).
- **Local Whisper is disabled in Lite mode.** The lite image cannot run the local speech model. Use a full install.

### Music DJ Spotify login fails on a remote or network install

The Music DJ agent's Spotify mode uses OAuth, a login handoff where Spotify sends you back to a callback address (the redirect URI). Spotify accepts only `https://` addresses or `http://127.0.0.1`, and rejects plain network IP addresses.

- At localhost, the editor shows a `127.0.0.1` callback. Register it with Spotify.
- Over HTTPS, the editor shows your HTTPS callback. Register that.
- If HTTPS ends upstream and the host does not match, set `SPOTIFY_REDIRECT_URI` in `.env` to your public callback address.
- On a plain-HTTP network install, the popup cannot load, but its address bar holds a valid code. Copy the full URL, expand **Browser couldn't reach the callback?** under the Connect button and paste it. The URL is valid for 10 minutes.

The cleanest fix is to serve Marinara over HTTPS.

## Storage and data

### Restart Server does not return

Start Marinara with `start.bat`, `start-local.bat`, `start.sh`, `start-termux.sh` or `pnpm start`. These keep the server attached to its launcher and start a replacement after the old process exits. In-app restart closes lingering connections after four seconds and forces exit after eight. A forced exit can interrupt pending writes. Direct `node` runs and development watchers are not replaced: stop and restart them yourself. Docker uses its container restart policy. On Windows, press <kbd>Ctrl</kbd>+<kbd>C</kbd> in the launcher console and wait for **Shutdown complete** before you close it.

Do not start a second server on the same data folder while the first still runs. Stop a leftover process first.

### Startup says another process may be using the data directory

Only one server may write to a local data folder. If startup reports **Another Marinara Engine process ... may be using** the folder, close the other Marinara process and start again.

After a crash or a moved Docker volume, startup can report **The storage writer lease ... is incomplete or invalid**, or name a process that no longer exists.

1. Confirm every Marinara process and container using that data folder is stopped.
2. Remove only the `.writer-lease` folder named in the error.
3. Restart Marinara. Do not remove the `storage` folder or any table files.

Marinara clears a lease left by a crashed process on its own on Linux, Android, containers and Windows when the data folder is on a local drive. The manual step is the fallback for network or shared storage, removable drives, and (on Windows) a computer renamed after the crash.

### Backup or Export returns 403

Same-computer sessions can back up without an admin secret. Requests from another device, a network address, Docker, or a proxy or tunnel on the same computer need one. Make it in **Settings → Advanced → Admin Access** on the server's own computer, or set `ADMIN_SECRET` on the server, then save the same value in **Admin Access** on the other device. To make loopback require it too, set `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`. If `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`, forwarded visitors get the local bypass. Keep it on for a public proxy or tunnel.

### Import says the file is not a readable ZIP archive

Marinara reads `.charx` cards, `.marinara` packages, agent packages and custom agent repositories as ZIP archives. It rejects a damaged archive, or one whose contents do not match its file list, with **The file is not a readable ZIP archive** (or **Could not read .marinara package**). A partial download is the usual cause: download the file again. If you made the archive yourself, create it again with your system's compress option, `zip` or 7-Zip.

**Package contains too many files** means an agent package or repository holds more than 8,192 files. **.marinara package has too many entries** means a `.marinara` package holds more than 8. Remove the extra files and try again.

### Conversation schedules or Noodle use the wrong timezone, or show `Etc/Unknown`

For Conversation schedules, choose **Schedule timezone** in Conversation Chat Settings or a character's schedule editor. **Use device** resets it.

For Noodle or other server jobs, remove any blank `TZ=` line from `.env` and restart Marinara so it uses the host timezone. To set one, use an IANA name such as `TZ=Europe/Warsaw`.

## Android problems

### Android app stuck on Connecting or Waiting for Server

The Android app is a small shell around Termux, a Linux terminal app for Android that runs the real Marinara server.

1. Tap **Install / Start Marinara**.
2. If Android asks to install Termux, approve the prompts.
3. If Android asks to run commands in Termux, grant it.
4. Wait for the launcher to start the server, then return to the app.

The app creates its private localhost credential and signs in automatically. You never paste a secret. Do not add `null`, `http://null` or the APK's secret to `CSRF_TRUSTED_ORIGINS`.

Also confirm the app and Termux use the same port. The default is `7860`. If you built the app with another port, set the matching `PORT` in the Termux `.env`.

### Android localhost opens the login page or returns 401/503

APK-managed Termux installs protect localhost with a private per-install secret, and the app signs in automatically. If the login page appears inside the app, install the [latest APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), tap **Install / Start Marinara** again and return when Termux finishes.

An error naming origin `null` means an older APK and server pair. Editing `.env` cannot fix it. Update the APK and Marinara.

To open a browser on the same phone, tap **Open in browser** on the Android launcher, then **Retry connection**. Reopen it this way after a server restart or an expired session. To return to the launcher, use **Settings → General → App Behavior → Open Android launcher (app or browser)**.

Older APKs sign in at `/android-login` with the value from `cat ~/.marinara-engine/android-secret`. A browser link works once and expires after one minute, so open a new one from the launcher.

- **401:** the pasted secret or challenge was rejected. Reload `/android-login` and paste the current value.
- **503:** the server received a malformed secret. Restart with `./start-termux.sh`. If the launcher says its secret file is invalid or empty, tap **Install / Start Marinara** in the app to provision it again.

The local `mari` command reads the same file automatically. Keep the secret out of screenshots and issue reports.

### Android update stops with exit status 134

Android ran out of memory during a build step. Run the launcher again:

```bash
./start-termux.sh
```

If it stops again, close other apps, reopen Termux and retry.

### Termux closes or restarts while Marinara runs

The launcher requests a wake lock while the server runs and saves each session under `~/.marinara-engine/logs/`. After an unexpected restart, include the newest `server-*.log` in your report. If it ends without a Marinara or Node error, Android or the phone vendor most likely ended Termux.

In Android settings, allow Termux to run in the background and remove its battery optimization. `termux-wake-lock` and `termux-wake-unlock` come with standard Termux. These settings cannot stop every vendor-specific kill.

### Marinara stops responding until Termux is in the foreground

Chats hang at "Opening chat...", the app reports **Server unreachable**, the Support Diagnostics copy shows **Unreachable (request timed out)** for the server fields, and everything recovers the moment you open Termux. Android's cached-app freezer suspended the Termux process. The phone accepts the connection, but the frozen server never answers. A wake lock does not prevent this. The session log shows a gap in timestamps over the frozen time, not an error.

Exempt Termux from battery optimization, allow background activity, lock Termux in the recents screen if your phone supports it, and keep its notification visible. If freezes continue, keep Termux in the foreground or the screen on while you use Marinara.

### Android update runs out of storage while installing dependencies

A large temporary footprint during an update usually comes from pnpm's dependency store after several releases or an interrupted reinstall. The current launcher prunes old packages, and in-app updates install only Android packages. If an older launcher filled the device, free the space and retry:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Do not delete `data`, `storage` or `marinara-engine.db`, because they may hold your chats and settings. If it still stops, capture the lines from `Installing dependencies` onward and include the phone's free space and memory in your report.

### In-app update fails when switching between Stable and Staging on Android

Switching channels forces a near-full dependency reinstall, which is slow on Termux storage. The in-app updater allows extra time for each step. If an update still fails, the error names the failed step and shows the end of its output. A real dependency or lockfile error appears there. You can also update by hand from Termux with the command in the error's hint, or free space first:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Docker problems

### Container permission denied on a volume mount

- Named volume after an update: run `docker compose pull && docker compose up -d`. The official image repairs ownership on start.
- Bind mount: make the host folder writable by user and group ID `1000`, or use a named volume.
- SELinux systems such as Fedora or RHEL: add the `:Z` suffix to the volume mount.

### Lite container crashes on a Raspberry Pi 4

If the lite image restarts whenever it sends an AI request on a Raspberry Pi 4 or similar ARM device, check the exit code. Exit 132 or SIGILL (the CPU hit an instruction it cannot run) points to a known upstream problem in the lite image's Node build on some ARM chips. Use the regular image on that device.

### A Server Extension says no supported sandbox is available

Server Extensions and Professor Mari's raw shell commands run only with macOS Seatbelt or Linux Bubblewrap. On a native Linux host, install `bwrap` and restart Marinara. The official Docker image includes Bubblewrap, but the default container cannot create its nested namespaces, so Marinara keeps these features off.

If you accept broader container privileges, save this as `docker-compose.override.yml` next to `docker-compose.yml`, then recreate the container:

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

> **Warning:** Running the server as root with `SYS_ADMIN` and no AppArmor profile is a broad privilege escalation. Do not enable it only to hide this message.

Docker's default seccomp profile adapts to added capabilities, so you should not need `seccomp=unconfined` on current Docker.

Windows, Android and other unsupported hosts refuse Server Extension execution. Browser Extensions still run in their sandbox.

## Extension problems

### External Extensions is missing from Addons

The section stays hidden until both gates are open.

1. Set `ENABLE_EXTERNAL_EXTENSIONS=true` in the host's `.env`.
2. Wait a moment, then open **Settings → Advanced → Danger Zone**, scroll below the data-deletion controls and turn on **Allow third-party extension imports**.

If the switch is disabled, the host flag is still false or the app has not seen the change. Confirm you edited the active `.env` described in [Server Configuration](CONFIGURATION.md). On Docker it is normally `/app/data/.env`.

While either gate is closed, external extension records do not appear and cannot run. Reopening the gates does not turn them back on.

### An imported browser extension appears but does not work

Open it in **Settings → Addons → External Extensions** and read **Requested access**. Older `marinara.extension` v1 packages with no capabilities declaration show **Full page access**. Approve only the exact hash you inspected and trust.

A package exported again with an empty capabilities list is treated as a safe sandbox extension, and code that needs the page's DOM will not work. Add `full_page_access` to its manifest only if you accept that the code gets the whole page, browser storage, network APIs and your session.

After you disable a full page extension, reload Marinara if a toolbar item, overlay or listener remains. Cleanup is best effort, because page code can cause side effects Marinara does not track.

## Multiplayer connection or turn problems

| Symptom | Fix |
| --- | --- |
| Controls unavailable | Put `MULTIPLAYER_ENABLED=true` in the correct Marinara's `.env`, restart it, then turn on the setting separately. The Android native wrapper cannot join. |
| Host unavailable | Use a separate reachable HTTPS room port, a valid certificate chain and hostname, and the matching invitation fingerprint. Do not turn off TLS checks, add `null` to trusted origins, expose the normal API or open a host-supplied client. |
| Awaiting approval | The host must approve you in Players. You see no transcript before approval. Ask for a new invitation if it expired. |
| Disconnected | Keep your own Marinara running. It reconnects to the same host while the session lives, and unsent drafts stay. After a restart, join again. To keep the same persona name, ask the host to remove your old seat first. |
| Game waiting | Open Players. Disconnected players are not passed automatically. The host can **Pass**, **Kick** or **Pause**. |
| Interrupted generation | Do not resubmit the round. The host should check the saved narration and state, then resume or stop the room. Multiplayer never replays an unclear request or applies its world effects twice. |
| Restricted command or missing media | Rooms carry text only. See the [compatibility matrix](development/multiplayer.md#command-and-feature-compatibility). Do not install a peer-provided file or extension. |

When you report a connection error, include the mode, platform, visible error and whether approval worked. Do not post invitations, room passwords, session tokens, private transcripts or API keys.

## Installing as a PWA on Android Chrome fails behind a login

Use an HTTPS address, sign in, and reload after updating Marinara. The app requests its manifest with credentials, so the login can stay on. If installation is still unavailable, check that your proxy serves `/manifest.json` as JSON, not a login page or an error.

## Get more help

1. Open **Settings → Advanced → Message Tools** and turn on **Debug mode**. It logs the prompt and response to the server console.
2. Note your operating system, Node.js version and the full error text from the console.
3. Remove API keys, access tokens, admin secrets and private chat content before you share anything.

Then ask the community:

- Read the [open issues](https://github.com/Pasta-Devs/Marinara-Engine/issues).
- Join the [Discord](https://discord.com/invite/KdAkTg94ME).
- File a bug report in the same GitHub issues, with the details above.

## Related guides

- [Frequently Asked Questions](FAQ.md)
- [Server Configuration Reference](CONFIGURATION.md)
- [Remote Access](REMOTE_ACCESS.md)
- [Upgrading Marinara Engine](UPGRADING.md)
- [Connecting to an AI Provider](connections/connecting-to-a-provider.md)
- [Built-in model setup](connections/local-model.md)
- [Game Mode: Getting Started](game/getting-started.md)
- [Settings Overview](settings/settings-overview.md)

<details>
<summary>Maintainers: updating pinned local runtimes</summary>

GitHub-generated source archives are not guaranteed to remain byte-for-byte stable, even when their commit contents do not change. Never “fix” a user mismatch by accepting the bytes seen on their machine or weakening verification. Re-pin runtime inputs only in a reviewed Engine change:

1. Select an immutable upstream revision or release asset and review the upstream changes.
2. Download the artifact into a temporary directory, record its exact byte count, and calculate its SHA-256 digest independently.
3. Update `runtime-integrity-manifest.ts` with the revision, URL, size, and digest. For MLX, regenerate `packages/server/src/assets/mlx-runtime-requirements.lock` from its `.in` file with the pinned uv version on Apple Silicon/Python 3.12, review every dependency change, and update `requirementsLockSha256`.
4. Run `pnpm regression:runtime-integrity`, `pnpm check`, and a real clean runtime installation on the affected platform.
5. Ship the reviewed Engine update before asking users to retry. Do not provide a manual checksum override.

</details>
