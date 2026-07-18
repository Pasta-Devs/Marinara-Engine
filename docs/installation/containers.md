# Run via Container (Docker / Podman)

This guide shows you how to run Guksu Motor inside a container using Docker or Podman. A container is a self-contained package that bundles the app and everything it needs to run. You do not have to install Node.js or other tools on your computer. If you are new and just want Guksu running, this is the easiest path.

## Prerequisites

Before you start, install one of these on the machine that will run Guksu:

- Docker Desktop (Windows or macOS) or Docker Engine (Linux). Docker is the most common container tool.
- Or Podman. Podman is a drop-in replacement for Docker. It runs without a background service and works well without root access.

A few terms used below:

- **Image**: a downloadable, read-only template that contains Guksu Motor. You run an image to create a running container.
- **Volume**: a storage area the container tool manages for you. A volume keeps your data even when you delete and recreate the container.
- **LAN**: your local network (the Wi-Fi or wired network at your home or office).

The official Guksu images are published at `ghcr.io/pasta-devs/marinara-engine`.

## Pull and run

The repository includes a ready-to-use `docker-compose.yml` file in the project root. Compose reads this file and starts the container for you. This is the recommended way to run Guksu.

1. Get a copy of the repository. If you already have a Guksu Motor checkout, open a terminal in that folder. If not, clone it first:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Move into the folder:

```bash
cd Marinara-Engine
```

3. Start the container in the background:

```bash
docker compose up -d
```

The `docker-compose.yml` file uses the `ghcr.io/pasta-devs/marinara-engine:latest` image and downloads it the first time you run this command. The first download can take a few minutes.

## Check that it is working

1. Open your web browser.
2. Go to this address:

```text
http://127.0.0.1:7860
```

You should see the Guksu Motor home screen. If you do, the container is running. The address `127.0.0.1` means "this same computer", and `7860` is the default port Guksu listens on.

If the page does not load, see the Troubleshooting section below.

## Where your data is stored

Your data (your chats, characters, uploads, fonts, and default backgrounds) is saved as plain files. Guksu uses file-backed storage, which means your data lives as normal files rather than inside a single database file. Compose keeps these files in a named volume called `marinara-data`.

Compose adds the project folder name in front of volume names, so the real volume name follows a `PROJECT_marinara-data` pattern. To find the exact name on your machine, list the volumes:

```bash
docker volume ls --filter name=marinara-data
```

Then inspect the one from the list to see where it lives:

```bash
docker volume inspect PROJECT_marinara-data
```

Replace `PROJECT_marinara-data` with the name the previous command printed.

Each time the container starts, it prepares the data folder. By default the container starts as root. It fixes the folder ownership so the app can write to it, then switches to a non-root user for safety. This repair works for the named volume and also for a folder you mount from your host. It means older setups can move to file-backed storage without you running any manual ownership commands.

Guksu also creates an empty settings file at `/app/data/.env` inside the volume on first start. This is where you can add server settings later. Because it lives in the volume, your settings survive container restarts and image updates. See [Server Configuration Reference](../CONFIGURATION.md) for the full list of settings.

## Exposing Guksu to your LAN

By default, Compose only lets you reach Guksu from the same computer. This is the safe default. If you want to open Guksu on your phone or another computer on your network, you must do two things. Change the port mapping, and turn on a login so strangers cannot reach it.

Basic Auth is a simple username and password prompt that protects the app. Never expose Guksu to your network without it.

1. Open `docker-compose.yml` in a text editor.

2. Find the port line. It looks like this:

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. Remove the `127.0.0.1:` part so the app is reachable from other devices:

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. In the same file, add a login and an admin secret to the `environment:` list. Use your own values:

```yaml
environment:
  - BASIC_AUTH_USER=yourname
  - BASIC_AUTH_PASS=a-long-random-password
  - ADMIN_SECRET=another-long-random-value
```

5. Save the file and restart the container:

```bash
docker compose up -d
```

Now other devices on your network can reach Guksu at `http://YOUR_COMPUTER_IP:7860` when `PORT` is unset. If you set `PORT`, replace `7860` with that host port. They must enter the username and password you set. To find good ways to allow only certain devices, and to learn what the admin secret does, read [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md).

## Choosing an image: latest, staging, or lite

Guksu publishes several image tags. Pick the one that fits your needs.

- `latest` is the recommended stable release. The `docker-compose.yml` file uses it by default.
- `X.Y.Z` is a fixed version, such as `ghcr.io/pasta-devs/marinara-engine:2.0.6`. Use this when you want to pin one exact release.
- `staging` is an unstable test build from the latest development code. Use it only to try unreleased changes. It may break, may change behavior without notes, and may not let you move data back to a stable build.
- `lite` is a smaller image. It is described in the next section.

If you run the `staging` image, use a separate volume so an unstable build cannot change your stable data:

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### The lite image

The lite image is a smaller variant that trades some offline features for a much smaller download. It is built on Wolfi, a minimal Linux base made for containers.

The lite image removes the features that need large local files:

| Removed in lite | What you lose |
| --- | --- |
| Local Model (Gemma, runs on your machine) | You cannot run an AI model on your own hardware. |
| Local embedding model | No on-device text embeddings. |
| Memory Recall (semantic search) | Depends on the local embedding model. |
| Local Whisper voice input | Speech-to-text for Conversation calls is gone. |

Everything else works the same: chat, roleplay, Game Mode, agents, lorebooks, characters, and connections to remote AI providers. To use any AI features with the lite image, you must connect an external provider (for example OpenRouter, OpenAI, or a self-hosted model). See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

The lite tag is `ghcr.io/pasta-devs/marinara-engine:lite`, and each release also ships a version-pinned lite tag like `ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`. To run it:

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

Some older lite images can crash on Raspberry Pi 4 and similar ARM computers. The crash shows a `SIGILL` error (an illegal-instruction error from the processor) during outgoing AI provider calls. If you use one of these devices, run the regular `latest` image instead. See [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md) for the current details.

## Updating

Container images do not update themselves. You pull a newer image and restart the container by hand.

For Docker Compose, run this one command:

```bash
docker compose pull && docker compose up -d
```

For Podman Compose, run this one command:

```bash
podman compose pull && podman compose up -d
```

You can also check your version inside the app. Open **Settings**, go to the **Advanced** tab, and find the **Updates** section. Click **Check for Updates**. For container installs, Guksu detects that it is running in Docker and shows you the release image tag plus the host command to run. It cannot apply the update from inside the browser, so you still run the command above on the host.

## Podman

Podman runs the same images as Docker. In most cases you can swap `docker` for `podman` in the commands above.

To start with Compose:

```bash
podman compose up -d
```

To run a single container without Compose:

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

The `podman compose` command needs the `podman-compose` helper. Install it with the command for your system.

On Fedora:

```bash
sudo dnf install podman-compose
```

On Debian or Ubuntu:

```bash
sudo apt install podman-compose
```

With pip:

```bash
pip install podman-compose
```

## Build the image yourself

If you prefer to build the image from source instead of downloading it:

```bash
docker build -t marinara-engine .
```

Then run your own build:

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

To build the lite image from source, point Docker at the lite build file:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## Troubleshooting

**The page will not load, or the port is already in use.** Another program may already use port `7860`. Change the port mapping to a free port, such as `8080:7860` in the `ports:` list. Then restart with `docker compose up -d` and open `http://127.0.0.1:8080`.

**Guksu cannot write files, or you see permission errors.** The container repairs the ownership of the data folder each time it starts. This works for named volumes and for folders you mount from your host. The repair can fail on some host file systems, and it is skipped if you set `MARINARA_SKIP_DATA_CHOWN=true`. If the errors continue, use the default `marinara-data` named volume. It is the most reliable choice.

**The lite image crashes on a Raspberry Pi 4.** See the lite image note above. Use the regular `latest` image on that hardware.

For more help, read [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md).

## Related guides

- [Server Configuration Reference](../CONFIGURATION.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
- [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md)
