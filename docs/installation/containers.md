# Run via Container (Docker / Podman)

Run Marinara Engine in a container with Docker or Podman. A container is a package that holds the app and everything it needs, so you install no Node.js. If you want Marinara running with the least setup, start here.

## Before you start

Install one of these on the computer that will run Marinara:

- Docker Desktop (Windows or macOS) or Docker Engine (Linux).
- Podman, a Docker replacement that needs no background service and works without root access.

Terms used below:

- **Image:** a downloadable, read-only copy of Marinara. You run an image to create a container.
- **Volume:** storage that the container tool manages. It keeps your data when you delete and recreate the container.

The official images are at `ghcr.io/pasta-devs/marinara-engine`.

## Start Marinara

The project has a ready-to-use `docker-compose.yml` file. Compose is the part of Docker that reads this file and starts the container. This is the recommended way.

1. Open a terminal, a window where you type commands. If you already have a Marinara checkout, open it in that folder and skip the next two steps.
2. Download the project files.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Open the new folder.

   ```bash
   cd Marinara-Engine
   ```

4. Start the container in the background.

   ```bash
   docker compose up -d
   ```

   The first run downloads the `ghcr.io/pasta-devs/marinara-engine:latest` image, which can take a few minutes. When it finishes, the terminal shows the container as `Started`.

5. Open `http://127.0.0.1:7860` in your browser. The Marinara home screen loads.

If it did not work: another program may use port `7860`. Pick a free port, such as `8080`. Create a file named `.env` in the same folder as `docker-compose.yml` with the line `PORT=8080`, then run `docker compose up -d` again. Compose reads this file every time, so later updates keep the new port. Then open `http://127.0.0.1:8080`. Other fixes are under [Troubleshooting](#troubleshooting).

## Stop Marinara

Run this from the same folder. It stops and removes the container. Your data stays in the volume.

```bash
docker compose down
```

With Podman, use `podman compose down`.

## Where your data is stored

Marinara saves your chats, characters, uploads, fonts and default backgrounds as plain files in a Compose volume named `marinara-data`. Compose adds the project folder name in front, so the real name looks like `PROJECT_marinara-data`. To find the exact name and where it lives:

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

Replace `PROJECT_marinara-data` with the name the first command printed.

Marinara also creates an empty settings file at `/app/data/.env` inside the volume on first start. Add server settings there. They survive restarts and image updates. See the [Server Configuration Reference](../CONFIGURATION.md).

Each time the container starts, it fixes the ownership of the data folder so the app can write to it. It starts as root, fixes ownership, then switches to a non-root user. This works for the volume and for a folder you mount from your computer.

## Open Marinara from another device

By default, Compose lets only this computer reach Marinara. To open it on a phone or another computer, publish the port on all interfaces and set a login first. Never expose Marinara to your network without a login.

Docker Desktop, OrbStack and rootless Docker (Docker without root) show every device as one gateway address. Without a login, a port published on all interfaces lets everyone in. Once a login is set, this computer is asked for it too. See [Tailscale and Docker bypass](../REMOTE_ACCESS.md#tailscale-and-docker-bypass).

1. Open `docker-compose.yml`, in the Marinara folder, in a text editor.
2. In the `ports:` list, remove `127.0.0.1:`.

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. In the `environment:` list, add an admin secret. Use your own long random value.

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. In the same list, add a login. Use your own username and a long random password.

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. Save the file and restart the container.

   ```bash
   docker compose up -d
   ```

6. On the other device, open `http://YOUR_COMPUTER_IP:7860`. If you set `PORT`, use that port. The page asks for your login.

If you leave out `BASIC_AUTH_USER` and `BASIC_AUTH_PASS`, the page asks for a one-time setup code instead. Find it in the logs, then type it on the page with a new username and password.

```bash
docker logs <container> 2>&1 | grep "setup code"
```

You can change an app login later in **Settings → Advanced → Access** in a signed-in browser. If you forget the password, run `docker exec <container> node scripts/reset-login.mjs`. That command does not change a login from `BASIC_AUTH_USER` and `BASIC_AUTH_PASS`. Edit those in the compose file and recreate the container.

On Docker Desktop, OrbStack and rootless Docker, open Marinara on this computer at `http://localhost:7860` to set the login in **Settings**. An IP allowlist cannot tell devices apart there, so use a login. For other ways to limit access, and what the admin secret does, see [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md).

## Update Marinara

Containers do not update themselves. Make a backup first (see [Backing Up and Restoring Marinara](../data/backup-and-restore.md)), then pull the new image and restart. Run this from the folder that holds `docker-compose.yml`:

```bash
docker compose pull && docker compose up -d
```

With Podman, use `podman compose` instead. In the app, **Settings → Advanced → Updates → Check for Updates** shows the image tag and this command. The app cannot apply the update itself for a container.

To go back to an older release, set its tag on the `image:` line of `docker-compose.yml`, then run `docker compose up -d`. See [Going back to an older version](../UPGRADING.md#downgrading-to-an-older-version) first. Older builds cannot open data that newer builds saved.

## Choose an image tag

| Tag | What it is |
| --- | --- |
| `latest` | The stable release. `docker-compose.yml` uses it. |
| `X.Y.Z` | One fixed version, such as `ghcr.io/pasta-devs/marinara-engine:2.5.1`. |
| `staging` | An unstable test build of unreleased code. It may break, and you may not be able to move your data back to a stable build. |
| `lite` | A smaller image. See below. |
| `X.Y.Z-lite` | A fixed version of the lite image. |

If you run `staging`, use a separate volume so it cannot change your stable data:

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### The lite image

The lite image is a smaller download built on Wolfi, a minimal Linux base for containers. It leaves out features that need large local files:

| Left out of lite | What you lose |
| --- | --- |
| Built-in model | You cannot run an AI model on your own hardware. |
| Local embedding model | No on-device text embeddings. |
| Memory Recall (semantic search) | It depends on the local embedding model. |
| Local Whisper voice input | No speech-to-text for Conversation calls. |
| Avatar mood reader | 2D and 3D Avatars pick faces from a word list, not from the small local emotion model. |

Everything else works: chat, roleplay, Game Mode, agents, lorebooks, characters and remote AI services. For AI features you must add an account for an outside service. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

Some older lite images crash on a Raspberry Pi 4 and similar ARM computers with a `SIGILL` error (an illegal-instruction error) during outgoing AI calls. On those devices, use the regular `latest` image. See [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md) for current details.

## Podman

Podman runs the same images. In most commands, replace `docker` with `podman`.

```bash
podman compose up -d
```

To run one container without Compose:

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose` needs the `podman-compose` helper. Install it with one of these:

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

The first line is for Fedora, the second for Debian or Ubuntu, and the third works anywhere with pip.

## Build the image yourself

To build from source instead of downloading:

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

To build the lite image, use the lite build file:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## Troubleshooting

**The page will not load, or the port is in use.** See the port fix under [Start Marinara](#start-marinara).

**Marinara cannot write files, or you see permission errors.** The container fixes folder ownership on every start. The fix can fail on some host file systems, and it is skipped if you set `MARINARA_SKIP_DATA_CHOWN=true`. If errors continue, use the default `marinara-data` volume. It is the most reliable.

**The lite image crashes on a Raspberry Pi 4.** Use the regular `latest` image.

For more help, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Server Configuration Reference](../CONFIGURATION.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
