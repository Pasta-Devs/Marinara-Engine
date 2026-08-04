# Troubleshooting Marinara Engine

This guide lists common problems in Marinara Engine and how to fix them. Find the section that matches your symptom, then follow the steps. If nothing here helps, see the last section, Getting more help.

## First things to try

Many problems clear up with two quick steps.

1. Do a hard refresh of the page. Press **Ctrl+Shift+R** on Windows or Linux, or **Cmd+Shift+R** on a Mac.
2. Look at the server console (the terminal window that runs Marinara) for red error lines. Those lines usually name the real problem.

If you are asking the team for help, turn on **Debug mode** first so the server logs the prompt and response. See Getting more help at the end of this guide.

## Install and launch problems

### Windows: EPERM or corepack signature error when installing pnpm

pnpm is the package manager Marinara uses to install its code. If you see `EPERM: operation not permitted` or a corepack signature verification failure, corepack could not write into the Node install folder.

Pick one fix:

1. Right-click your terminal, choose Run as administrator, then run the launcher again.
2. Install pnpm yourself. Run this command, then run the launcher again:

```bash
npm install -g pnpm@10.34.5
```

3. Update corepack in an administrator terminal, then run the launcher again:

```bash
npm install -g corepack
```

### Windows: `'pnpm' is not recognized` while building the shared package

Marinara v2.3.0 could start pnpm through Corepack successfully and then fail during the shared-package build because that build tried to launch a second, global `pnpm` executable. v2.3.1 removes that nested requirement. Close the failed launcher and run `start.bat` again so it can pull the corrected build script before rebuilding. Your data does not need to be removed.

If the checkout itself cannot update, run `git pull` in the Marinara folder and start it again. As a temporary v2.3.0 workaround, install the pinned package manager globally, rerun the launcher, and then update normally:

```bash
npm install -g pnpm@10.34.5
```

### Launcher stops once after the pnpm 10.34.5 security update

If an update prints `Expected version: >=10.34.5` and `Got: 10.33.2`, close the launcher and run it again. This one-time stop is intentional: the old launcher has already downloaded the updated Marinara files, but the new engine requirement prevents the affected pnpm version from installing dependencies. On the second launch, the refreshed launcher selects pnpm 10.34.5 before continuing. Corepack verifies the release against the SHA-512 digest pinned in `package.json`; the npm fallback also requests exactly 10.34.5 rather than an unpinned latest version.

Do not use the generic unpinned command suggested by pnpm's engine error. If the second launch cannot obtain the pinned release automatically, install the same exact version and rerun the launcher:

```bash
npm install -g pnpm@10.34.5
```

### Linux: ERR_PNPM_ENAMETOOLONG during install

This means an older install left behind long folder paths. From the Marinara folder, clear the partial install and run the launcher again:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Then start Marinara again with `./start.sh`. If you install by hand, run `pnpm install` after removing those folders.

### ERR_PNPM_TRUST_DOWNGRADE during install

This is almost always a half-finished install. First rerun the launcher so it can repair the workspace. If you install by hand, run this single command from the Marinara folder:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Blank, stale, or old-looking screen

Sometimes the server is running but the browser shows a blank page, or the app looks like an old version after an update. In that case your browser is holding a cached copy of the web app.

1. Do a hard refresh (**Ctrl+Shift+R** or **Cmd+Shift+R**).
2. If that does not help, open **Settings**, go to the **Advanced** tab, then the **Updates** section, and click **Refresh App**.

**Refresh App** clears the browser service worker (a background script that caches the web app) and the browser cache, then reloads. It does not change your data. Your chats, settings, and other local data stay intact. It also does not update the server code, so it is not a substitute for a real update. See [Upgrading Marinara Engine](UPGRADING.md) to update the app itself.

## Downloadable agent problems

If **Agents → Download Agents** says the catalog is unavailable, the machine running the Marinara server—not only the browser—must be able to reach the official [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) catalog over GitHub HTTPS. Installed agents continue to work offline at their current version. Restore the server connection, then click **Refresh** or **Try again** to browse the catalog and check for updates.

If an installed map or call does not appear, close Marinara Engine completely and start it again. Those route-bearing packages remain in **Restart required** state until the next process start. Conversation games are different: current Engine builds hot-activate them immediately. Refresh the catalog if installation failed, then confirm the game shows as ready; adding it under a chat's **Commands** settings is only necessary when you want characters to initiate it themselves, not for the game's manual slash command.

If an older installation cannot complete its first package migration, do not delete the `data/capability-packages` folder or your chat data. Marinara leaves the migration incomplete and retries on the next startup. Existing chat selections and settings remain stored while the catalog is unreachable.

Package downloads are rejected when their checksum, declared file list, Engine version range, or archive paths do not match the official catalog. Update Marinara Engine first, refresh the catalog, and retry. Do not manually extract an artifact into the data directory.

Agent updates are never applied at startup. When a newer compatible version is available, Marinara asks whether to apply it. Choose **No** to keep the installed version; the **Update** button remains available in **Agents → Download Agents**. A failed update also leaves the installed version registered, and a newly updated server runtime that fails its startup self-check rolls back to the previous version.

## Accessing Marinara from another device

If you cannot access Marinara from a phone, tablet, or another computer on your network, work through these checks.

- Bind the server to a reachable address. The server listens on `127.0.0.1` (loopback, your own machine only) by default. The shell launchers set `HOST=0.0.0.0` for you. If you started with `pnpm start` by hand, set `HOST=0.0.0.0` in your `.env` file first.
- Confirm both devices are on the same Wi-Fi network.
- Confirm no firewall blocks the port. The default port is `7860`, or whatever you set as `PORT`.
- Set up access control. For ordinary network or public clients, set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` in `.env`. Loopback stays passwordless. Direct traffic over Tailscale and the same-host Docker bridge or detected container gateway is trusted by default; proxy-forwarded Docker traffic requires normal authorization unless you explicitly set `REQUIRE_AUTH_FOR_DOCKER_PROXY=false`.
- For privileged actions from that device (backups, data clearing, updates), set `ADMIN_SECRET` in the server `.env`. Then paste the same value into **Settings** > **Advanced** > **Admin Access** on that device and click **Save**.
- If you use a public or reverse-proxy domain and see **Untrusted request host**, add its exact hostname to `TRUSTED_HOSTS` in `.env`. Direct IP addresses used by phones, LAN computers, and Tailscale peers remain accepted automatically.

For the full walkthrough, see [Remote Access](REMOTE_ACCESS.md) and the [Frequently Asked Questions](FAQ.md).

## Save blocked, or settings that do not persist

If a save seems to work but reverts when you reload, Marinara's cross-site protection is blocking it. CSRF (cross-site request forgery) protection guards actions that change data. It only trusts certain browser origins.

You will see one or both of these signs:

- A red banner at the top of the screen warning that saves will silently fail because this origin is not trusted.
- A toast titled **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected**, or **Save blocked: origin not trusted**.

Loopback, private network addresses, Tailscale, and the Docker bridge are trusted automatically. This usually only happens when you reach Marinara through a public IP address or a domain name. Add that address to `CSRF_TRUSTED_ORIGINS` in `.env`. Use a comma-separated list for more than one, for example:

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

No restart is needed. The banner has a Copy button that fills in the exact line for you. See [Remote Access](REMOTE_ACCESS.md) for more.

## Connection and generation errors

Generation errors appear as a toast at the bottom of the screen. If a connection failed, the toast names the reason. The toast stays up long enough to read and copy.

- **No API connection configured for this chat**: the chat has no connection selected. Open the **Connections** panel, create one, then pick it for the chat. See [Connecting to an AI Provider](connections/connecting-to-a-provider.md). An API key is a secret code from a provider that lets Marinara use their models.
- The model does not accept a parameter: the toast tells you which one. Open **Chat Settings** > **Advanced Parameters** and find that parameter. Turn off the switch next to its name (the tooltip reads "This parameter is sent to the model").
- The model says a parameter is required: do the same, but turn the switch next to that parameter on.
- **The AI returned an empty response. Try sending your message again.**: send your message again. If it keeps happening, try a different model or connection.
- **A generation is already in progress for this chat**: one reply is still streaming. Wait for it to finish or click the Stop button, then try again.
- **No connections are marked for the random pool**: you turned on random connection routing but marked no connections for the pool. Add at least one connection to the pool, or turn random routing off.

## Local Model problems

The **Local Model** is an AI model that runs on your own machine with no API key. Some error messages use the word sidecar for this feature.

- If installing a runtime fails with **Sidecar runtime install is disabled**, the server has that action turned off for safety. On your own machine, set `SIDECAR_RUNTIME_INSTALL_ENABLED=true` in `.env`. From another device, paste your admin secret into **Settings** > **Advanced** > **Admin Access** first.
- If the model download or setup fails from another device (a network address or Docker), it may also need the admin secret. On your own machine, no admin secret is needed. See the point above for where to paste the secret.
- If a bundled llama.cpp, MLX, uv, or MLX dependency-lock check reports a file-size or SHA-256 mismatch, Marinara has discarded or refused it before extraction or installation. Update or reinstall Marinara and retry; do not manually run, unpack, edit, or bypass the rejected artifact.

### Maintainers: updating pinned local runtimes

GitHub-generated source archives are not guaranteed to remain byte-for-byte stable, even when their commit contents do not change. Never “fix” a user mismatch by accepting the bytes seen on their machine or weakening verification. Re-pin runtime inputs only in a reviewed Engine change:

1. Select an immutable upstream revision or release asset and review the upstream changes.
2. Download the artifact into a temporary directory, record its exact byte count, and calculate its SHA-256 digest independently.
3. Update `runtime-integrity-manifest.ts` with the revision, URL, size, and digest. For MLX, regenerate `packages/server/src/assets/mlx-runtime-requirements.lock` from its `.in` file with the pinned uv version on Apple Silicon/Python 3.12, review every dependency change, and update `requirementsLockSha256`.
4. Run `pnpm regression:runtime-integrity`, `pnpm check`, and a real clean runtime installation on the affected platform.
5. Ship the reviewed Engine update before asking users to retry. Do not provide a manual checksum override.

For full setup, see [Local Model Setup](connections/local-model.md).

## Memory and summaries

### Memory Recall does not recall anything

**Memory Recall** searches earlier messages and quietly adds the most relevant ones back into the prompt. If it seems to remember nothing, check these.

1. Open **Chat Settings** > **Memory Recall** and confirm **Enable Memory Recall** is on.
2. Open **Access memories for this chat**. In the **Memories for This Chat** window, look at each chunk's status.
3. A status of **Waiting for vector** means the memory is still being processed. Wait, then chat again.
4. A status of **Embedding unavailable** means no embedding source is working. Configure an embedding connection, or let the built-in local model load. See [Local Model Setup](connections/local-model.md).

A memory needs at least 5 new messages before it is created. Recall also only shows memories that closely match your new message, so it can return nothing even when memories exist.

### Summaries are not generating

Chat summaries need a working text connection to write them.

- In Roleplay mode, open the **Chat Summary** popover and confirm a connection is set. Use **Backfill Summary** to catch up an older chat.
- In Conversation mode, open **Automatic Summarization** and use **Backfill** to retry days that failed.
- If your chat requires agent write approval, an AI summary waits for your review before it takes effect.
- A summary that keeps failing (for example, a bad API key) is retried on a delay. Fix the connection, then use **Backfill**.

## Card Browser problems

The **Card Browser** lets you search public character sites and import characters. Open it from the **Card Browser** icon in the top bar, then click **Download Cards**.

- If JannyAI search or a character page fails with a Cloudflare block, Marinara shows a message. It asks you to visit the JannyAI site once in the same browser to clear the challenge, then retry.
- If your CharacterTavern or Pygmalion login stops working after you restart the server, that is expected. Those logins live only in server memory and clear on restart. Open the login window and paste your cookie or token again.

## Media generation problems

### Sprite background cleanup struggles with a complex scene

Generated still sprites normally use native transparency or an adaptive flat chroma matte. The built-in cleanup also recognizes older white mattes, preserves enclosed subject details, softens the alpha edge, and removes matte-color spill. A photographed room, detailed scenery, heavy cast shadows, or a subject whose colors match the background may still need the optional AI fallback:

```bash
pnpm backgroundremover:install
```

Then restart Marinara and click **Reapply Cleanup** in the sprite generation window. Marinara will still try the built-in matte path first and use the AI model only when the border does not look uniform. If the install fails:

- Confirm Python 3.9 to 3.11 is installed. Newer Python versions can force slow native builds.
- Rebuild the tool with `pnpm backgroundremover:reinstall`.
- To force automatic matte cleanup without the AI fallback while you troubleshoot, set `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` in `.env`.

### Game Mode or Roleplay storyboards do not appear

Game Mode Storyboards turn a completed GM narration into keyframe images and optional clips. Roleplay Storyboards combine completed exchanges and display the result inline after the assistant response.

- Confirm **Storyboard** is installed from **Agents** > **Download Agents**, then turn on **Enable Agents** and **Enable Storyboards** for the chat.
- For a manual scene video, generate or upload a **Gallery** image first, then use its **Video** or **Animate** action. The **Gallery** splits **Images** and **Videos** into tabs, so check the **Videos** tab.
- For automatic Game Mode Storyboards, open **Chat Settings** > **Agents** > **Storyboards** and confirm **Automatic Storyboard Illustrations** is on. Turn on **Automatic Storyboard Animations** too if you also want clips.
- In Roleplay, add the **Storyboard** Agent to the chat. Choose **Still images** or **Animations**, set **Messages per episode**, and select the Storyboard image connection. **Manual only** runs from **Create storyboard** in the Gallery instead.
- Keyframe images need an image connection. Clips also need a video connection.
- If a custom prompt works better with all characters combined, turn off **Use NovelAI Character Prompts**.
- Slow providers can hit a timeout. Raise `IMAGE_GEN_TIMEOUT_MS` or `VIDEO_GEN_TIMEOUT_MS` in `.env`, then restart Marinara. The server only reads these values at startup.

See the [Storyboard Agent Guide](game/storyboard.md) for both workflows and [Game Mode: Getting Started](game/getting-started.md) for Game setup.

### Game Mode world generation shows a JSON error

If starting a game fails because the model returned broken JSON, Marinara opens the **Repair JSON** window instead of throwing the whole turn away. JSON is the structured text format the model must return.

1. Fix the brackets, commas, or fields in the editor. The banner reads **JSON is valid.** once the text parses.
2. Click **Format** to tidy the layout.
3. Click **Apply Repaired JSON** to use it without regenerating the whole response.

## Voice, calls, and TTS

- If characters do not speak during a call, Text to Speech is not set up. Open **Connections** > **Text to Speech**, enable it, choose a source, enter your key, pick a voice, and save. A character with no voice appears as text only.
- If the microphone is not working, you may need the local speech model. Install **Calls** from **Agents > Download Agents**, then open **Connections** > **Local Model**, expand the card, find **Local Speech Model**, choose a Whisper model, and click **Download Whisper**. Firefox in particular needs this because it lacks browser speech recognition. Uninstalling Calls deletes its Whisper models to reclaim disk space.
- On a Lite build, the message **Local Whisper is disabled in Lite mode** means that small build cannot run the local speech model. Use a full Marinara install instead.

### Music DJ Spotify login fails on a remote or network install

The Music DJ agent's Spotify mode uses OAuth. OAuth is a login handoff where Spotify sends you back to a callback address. A redirect URI is that callback address, and Spotify only accepts `https://` addresses or the loopback address `http://127.0.0.1`. It rejects plain network IP addresses.

- If you reach Marinara at localhost, the editor shows a `127.0.0.1` callback. Register that with Spotify and the login completes.
- If you reach Marinara over HTTPS, the editor shows your HTTPS callback. Register that.
- If HTTPS is terminated upstream and the host does not match, set `SPOTIFY_REDIRECT_URI` in `.env` to your public callback address.
- On a plain-HTTP network install, the popup cannot load, but the address bar still holds a valid code. Copy the full URL from the popup. Then expand **Browser couldn't reach the callback?** under the Connect button and paste it. The pasted URL is valid for 10 minutes.

The cleanest long-term fix is to put the server behind HTTPS. Last checked against Marinara Engine 2.2.0. Spotify tightened these rules in February 2025.

## Storage and data

### Data seems missing after an update

If your chats or presets look missing after an update, do not delete any data folders yet. Marinara keeps your live data in a `storage` folder inside its data directory.

Check both of these local locations for a `storage` folder:

1. `packages/server/data/`
2. `data/`

The server prints the data and storage directories it resolved on startup.

### Backup or Export returns 403

Loopback sessions can make backups without an admin secret. From another device, a network address, or Docker, backups and profile exports need more. Set `ADMIN_SECRET` on the server and save the same value in **Settings** > **Advanced** > **Admin Access**. If you want loopback to require the secret too, set `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`.

## Android and Docker

### Android app stuck on Connecting or Waiting for Server

The Android app is a small shell around Termux. Termux is a Linux terminal app for Android, and it runs the real Marinara server.

1. Tap **Install / Start Marinara**.
2. If Android asks to install Termux, approve the prompts.
3. If Android asks to run commands in Termux, grant it.
4. Wait for the launcher to finish and start the server, then return to the app.

Also confirm the app and Termux use the same port. The default is `7860`. If you built the app with a different port, set the matching `PORT` in the Termux `.env` too.

### Android update stops with exit status 134

Exit status 134 usually means Android ran out of memory during a build step. Update again from the latest launcher:

```bash
./start-termux.sh
```

If it still stops, close other Android apps, reopen Termux, and run the command again.

### Android update runs out of storage while installing dependencies

The built Marinara app is not several gigabytes, and Noodle does not download its own AI models. A large temporary footprint during an update usually comes from pnpm's dependency store and virtual store, especially after several releases or an interrupted forced reinstall.

The current launcher prunes packages left over from older releases and avoids rebuilding the dependency store more than once for the same update. If an older launcher already filled the device, update the launcher and reclaim its unreferenced cache before trying again:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Do not delete `data`, `storage`, or `marinara-engine.db`; those locations may contain your chats and settings. If the command still stops, capture the lines beginning at `Installing dependencies` and include the phone's free-space and memory figures in the report.

### In-app update fails when switching between Stable and Staging on Android

Switching channels (Stable ↔ Staging) forces a near-full dependency reinstall, which on Termux's slower storage can take much longer than an ordinary update. The in-app updater now allows extra time for each step on Android, so a channel switch that used to stop with a bare `Update failed: Command failed: corepack pnpm ... install` should complete.

If an update still fails, the error now names the step that failed and includes the tail of its output. Read that message: a genuine dependency or lockfile error is reported there. You can also run the update by hand from Termux with the manual command shown in the error's hint, or reclaim space first:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

### Noodle shows `Etc/Unknown` or schedules use the wrong timezone

For Conversation schedules, open Conversation Chat Settings or a character schedule editor and choose **Schedule timezone**. This global selection applies to every Conversation chat, including background autonomous messages, and can be reset with **Use device**.

For Noodle or server jobs without a Conversation override, remove any blank `TZ=` line from `.env` and restart Marinara so the server inherits the host timezone. To choose a host fallback explicitly, set a valid IANA name such as `TZ=Europe/Warsaw` or `TZ=America/New_York`. Current releases treat a blank value as unset, but a restart is still required for Node's timezone state and scheduled jobs to be rebuilt consistently.

### Container permission denied on a volume mount

If a Docker or Podman container fails with permission errors on the data volume:

- For named volumes after an update, pull the latest image and restart with `docker compose pull && docker compose up -d`. The official image repairs ownership on startup.
- For bind mounts, make the host folder writable by user and group ID `1000`, or use a named volume instead.
- On SELinux systems such as Fedora or RHEL, add the `:Z` suffix to the volume mount.

### Lite container crashes on a Raspberry Pi 4

If the lite container restarts whenever it sends an AI request on a Raspberry Pi 4 or similar ARM device, check the exit code. Exit 132 or SIGILL points to a known upstream problem in the lite image's Node build on some ARM chips. SIGILL means the program hit an instruction the CPU cannot run.

The regular (non-lite) image is not affected. Until the upstream fix ships, use the regular image on that device. Known affected lite images include `1.5.7-lite` and `1.5.8-lite`. Last checked against Marinara Engine 2.2.0.

### External Extensions is missing from Addons

The section is intentionally hidden until both safety gates are open:

1. Set `ENABLE_EXTERNAL_EXTENSIONS=true` in the host's `.env`.
2. Wait about two seconds for the configuration watcher, then open **Settings → Advanced → Danger Zone**, scroll below the data-deletion controls, and enable **Allow third-party extension imports**.

If the Danger Zone switch is disabled, the host flag is still false or the app has not observed the change. Confirm that you edited the active `.env` path described in [Server Configuration](CONFIGURATION.md). On Docker, that is normally `/app/data/.env`.

When either gate is closed, external, legacy, profile-imported, manually stored, and unknown-source extension records do not appear and cannot run. Reopening the gates does not automatically re-enable them.

### An imported browser extension appears but does not work

Open the extension in **Settings → Addons → External Extensions** and inspect **Requested access**. Older packages that use the `marinara.extension` v1 format without a capabilities declaration should show **Full page access**. Approve only the exact hash you inspected and trust.

If an older package was exported again with an explicit empty capabilities list, Marinara treats it as a safe sandbox extension; DOM-dependent code will not work there. Add `full_page_access` to its manifest only if you understand that the code will gain access to the whole Marinara page, browser storage, network APIs, and same-origin session.

After disabling a full page extension, reload Marinara if a toolbar item, overlay, listener, or visual change remains. Cleanup is best effort because page code can create side effects outside Marinara's tracked compatibility API.

### A Server Extension says no supported sandbox is available

Server Extensions and Professor Mari's raw shell commands run only with macOS Seatbelt or Linux Bubblewrap. Install `bwrap` on a native Linux host, then restart Marinara. The official Docker image already includes Bubblewrap, but the default container remains least-privileged and cannot create Bubblewrap's nested namespaces and mounts. Marinara detects that state and keeps OS-sandbox features disabled instead of attempting broken commands.

If you accept the broader container privileges and need these features in Docker, save this as `docker-compose.override.yml` next to `docker-compose.yml`:

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

Recreate the container after adding the override. Keeping the server process as root is necessary here so the added capability is not discarded when Marinara's entrypoint normally drops to the `node` user. Running the server as root with `SYS_ADMIN` is a broad privilege escalation, and disabling the container's AppArmor profile further weakens its outer security boundary; do not enable this merely to silence the unavailable-sandbox message. Docker's default seccomp profile adapts to added capabilities, so a blanket `seccomp=unconfined` setting should not be necessary on current Docker releases.

Windows, Android, and other unsupported hosts deliberately refuse Server Extension execution instead of falling back to the main server process. Browser Extensions can still use their opaque-origin Worker sandbox.

## Getting more help

If you still need help, gather good detail first.

1. Open **Settings** > **Advanced** > **Message Tools** and turn on **Debug mode**. This logs the prompt and response payloads to the server console so you can share them.
2. Note your operating system, your Node.js version, and the full error text from the server console.

Before sharing debug output, remove API keys, access tokens, admin secrets, private prompts, and private chat content.

Then reach the community:

- Read the open issues at https://github.com/Pasta-Devs/Marinara-Engine/issues
- Join the Discord for community help at https://discord.com/invite/KdAkTg94ME
- File a bug report at https://github.com/Pasta-Devs/Marinara-Engine/issues with your details above.

## Related guides

- [Frequently Asked Questions](FAQ.md)
- [Server Configuration Reference](CONFIGURATION.md)
- [Remote Access](REMOTE_ACCESS.md)
- [Upgrading Marinara Engine](UPGRADING.md)
- [Connecting to an AI Provider](connections/connecting-to-a-provider.md)
- [Local Model Setup](connections/local-model.md)
- [Game Mode: Getting Started](game/getting-started.md)
- [Settings Overview](settings/settings-overview.md)
