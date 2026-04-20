# Run via Container (Docker / Podman)

## Pre-built Image (Docker)

```bash
docker compose up -d
```

Then open **<http://127.0.0.1:7860>**.

Data (SQLite database, uploads, fonts, default backgrounds) is stored in the named volume `marinara-data`. To inspect it:

```bash
docker volume inspect marinara-data
```

To pull the latest image and restart:

```bash
docker compose down && docker compose pull && docker compose up -d
```

## Build from Source (Docker)

If you prefer to build the image yourself:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
docker build -t marinara-engine .
docker run -d -p 7860:7860 -v marinara-data:/app/data marinara-engine
```

## Podman

Podman is a drop-in replacement for Docker with better security features. Rootless mode is supported out of the box — no daemon required.

**Pre-built image:**

```bash
podman compose up -d
```

Or:

```bash
podman run -d -p 7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

> **Note:** `podman compose` requires the [`podman-compose`](https://github.com/containers/podman-compose/) plugin. On most distributions you can install it with `sudo dnf install podman-compose` (Fedora), `sudo apt install podman-compose` (Debian/Ubuntu), or `pip install podman-compose`.
