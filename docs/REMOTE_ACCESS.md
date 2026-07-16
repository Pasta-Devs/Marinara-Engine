# Remote Access: Basic Auth and IP Allowlist

This guide explains how to reach Marinara Engine from another device, such as your phone, a laptop, or a Docker container. It covers the two main options: Basic Auth and the IP allowlist. It also covers the private-network bypass, HTTPS, Admin Access, and the "save blocked" CSRF message. Almost every setting here lives in the server `.env` file, not in the app.

A quick word list used throughout this guide:

- `.env` file: a plain text settings file in the Marinara Engine folder, next to `package.json`.
- Loopback: the machine that is actually running the server. Its address is `127.0.0.1` or `localhost`.
- Remote access: opening Marinara from any device that is NOT the machine running the server.

## What Marinara blocks by default

To protect your data, a fresh Marinara install refuses connections from other devices until you set up access control. By default, only three kinds of client are trusted:

1. Loopback (`127.0.0.1` or `::1`), the machine running the server itself.
2. Tailscale devices in your tailnet. Tailscale is a private network tool, and its addresses use the `100.64.0.0/10` range.
3. Docker clients on the same host. Marinara recognizes the usual `172.16.0.0/12` bridge range and the container's exact default gateway, which also covers Docker Desktop and custom address pools.

Everything else, such as your phone on the same Wi-Fi or a public-internet client, is blocked until you pick an option below. A blocked device that opens Marinara in a browser sees a dark setup page. Its title reads **This Marinara Engine install needs access control before remote devices can connect.** The page shows your device's own IP and two copy-paste `.env` snippets.

If you do nothing and never set a password, Marinara stays locked to those three trusted sources. That is the safe default.

## Where the .env file lives

All access settings live in your `.env` file in the project root, next to `package.json`. If you do not have one yet, copy the example:

```bash
cp .env.example .env
```

Open `.env` with any text editor. Most access settings, including Basic Auth, the IP allowlist, the admin secret, and CSRF origins, apply within a couple of seconds without a restart. A few low-level settings still need a restart, including `PORT`, `HOST`, and the HTTPS certificate paths.

Other devices may fail to reach the server at all, with a timeout rather than a 403. In that case, the server may only be listening on the local machine. Set the server to listen on every network interface:

```env
HOST=0.0.0.0
```

The shell launchers (`start.bat`, `start.sh`) set `HOST=0.0.0.0` for you. Running `pnpm start` directly does not.

## Which option should you pick

Read these in order and stop at the first one that matches you.

1. You only connect over Tailscale, or only from Docker containers on the same host. You do not need to do anything. It already works.
2. You want to reach Marinara from a phone, tablet, or laptop on your home Wi-Fi. Use Basic Auth (Option 1 below).
3. You are exposing Marinara to the public internet. Use Basic Auth plus HTTPS.
4. Your client devices have fixed IP addresses and you would rather not type a password. Use the IP allowlist (Option 2 below).
5. Your whole network is trusted and you never want a password. Use the private-network bypass (Option 3 below). Read the warning there first.

Basic Auth is the most flexible choice. It works from any IP, needs no per-device setup, and the browser remembers the login.

## Option 1: Basic Auth (recommended)

Basic Auth means the browser asks for a username and password before it lets you in. To turn it on, add two lines to `.env`:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Pick a strong, unique password. Basic Auth sends your login with every request, so treat it like any other account password. You can generate a random one:

```bash
openssl rand -base64 24
```

Save `.env`. The change applies within a couple of seconds, with no restart. Then follow these steps from the remote device.

1. Open Marinara in your browser using the server's address, for example `http://192.168.1.50:7860`.
2. Enter the username and password you set when the browser prompts you.
3. You should see the app load. The browser remembers the login for the rest of the session.

By default, the browser prompt says **Marinara Engine**. You can change that text with `BASIC_AUTH_REALM`.

Some clients skip the password even when Basic Auth is on:

- Loopback (`127.0.0.1`, `::1`), so you never need a password on the host machine itself.
- Any address in `IP_ALLOWLIST`. Careful: setting an allowlist also blocks every unlisted address (see Option 2).
- Tailscale (`100.64.0.0/10`) and same-host Docker bridge/gateway traffic, unless you turn their bypass off.
- The `/api/health` address, so uptime monitors keep working.

Important: Basic Auth only encodes the password. It does not encrypt it. Anyone watching an unencrypted connection can read it. If you expose Marinara to the public internet, pair Basic Auth with HTTPS (see below).

## Option 2: IP allowlist

The IP allowlist lets specific addresses in without a password. It is a good fit when your devices have stable IP addresses. Set a comma-separated list of addresses or ranges:

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

The `/24` in the example is CIDR notation. CIDR is a short way to write a whole range of addresses in one entry. For example, `192.168.1.0/24` covers every address from `192.168.1.0` to `192.168.1.255`. A bare address with no slash, like `203.0.113.42`, matches only that one device.

How the IP allowlist behaves:

- Any address not in the list is rejected with **403 Forbidden**.
- Loopback is always allowed, so you cannot lock yourself out of local access.
- Tailscale and same-host Docker bridge/gateway traffic also skips the list, unless you turn their bypass off (see below).
- Invalid entries are ignored and logged. They do not crash the server.
- The allowlist stays strict even with Basic Auth on. Listed addresses skip the password prompt. Every other address is still blocked with **403 Forbidden** and never gets a login prompt.

The allowlist cannot create a mixed setup where listed devices skip the password and everyone else logs in. If you want other devices to log in with a password, leave `IP_ALLOWLIST` unset and use Basic Auth alone.

You can turn enforcement off for a while without deleting your list. This is handy when troubleshooting from a new IP. Set the enable flag to false:

```env
IP_ALLOWLIST_ENABLED=false
```

## Option 3: Private-network bypass (no password)

Your whole network may be trusted, for example a home LAN (local network) with no port forwarding. In that case, you can drop the lockdown without setting a password:

```env
ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true
```

This restores the older "open on the LAN, blocked from the public internet" behavior. It applies only to standard private-network ranges, for example `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`. The CGNAT range `100.64.0.0/10` also counts. CGNAT is a shared address system used by some internet providers, and Tailscale uses the same range. Public-internet addresses are still blocked with a 403.

Warning: anyone on the same network can then reach Marinara with no password. That is fine on a network you control. It is not fine on shared Wi-Fi at a coffee shop, airport, or dorm. When in doubt, use Basic Auth instead.

There is also a broader flag, `ALLOW_UNAUTHENTICATED_REMOTE=true`, which allows passwordless access from ANY address, including the public internet. Do not turn this on. If you truly need public access, use Basic Auth plus HTTPS, or put a reverse proxy in front that handles the login.

## Tailscale and Docker bypass

Two flags let Tailscale and Docker traffic skip both the IP allowlist and Basic Auth, the same way loopback does. Both flags are ON by default. That is why a fresh install is already reachable over Tailscale or from your Docker containers with no setup:

```env
BYPASS_AUTH_TAILSCALE=true
BYPASS_AUTH_DOCKER=true
```

These defaults are safe. A Tailscale peer already logged in to your Tailscale account to join. Docker bridge addresses and the exact gateway detected from inside the container represent the same Docker host. Even with Basic Auth on, your Tailscale and Docker clients still skip the prompt. The rest of your network must log in.

Set a flag to false if you want a password from those clients too. There are two less common reasons to turn one off.

Your internet provider may use CGNAT on the `100.64.0.0/10` range, the same range Tailscale uses. In that case, turn the Tailscale bypass off:

```env
BYPASS_AUTH_TAILSCALE=false
```

Your regular LAN may use `172.16.x.x` addresses. In that case, turn the Docker bypass off, and add your specific containers to `IP_ALLOWLIST`:

```env
BYPASS_AUTH_DOCKER=false
```

Marinara may also sit behind a reverse proxy container on the Docker bridge or detected gateway. To make Marinara's own access checks apply to the clients the proxy forwards, set:

```env
REQUIRE_AUTH_FOR_DOCKER_PROXY=true
```

The server logs an `[auth-bypass]` warning the first time one of these bypasses lets a request through. That warning confirms the bypass is active.

## Serving over HTTPS

HTTPS encrypts the connection using TLS. TLS is the encryption that turns a plain `http` address into a secure `https` one. Always use HTTPS for any install reachable outside a fully trusted private network, especially with Basic Auth.

You have two ways to add it.

1. Built-in TLS. Point the server at a certificate and private key file:

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. Reverse proxy. Put Marinara behind nginx, Caddy, Traefik, or a Cloudflare Tunnel. The proxy handles the HTTPS part and forwards to Marinara over plain HTTP on the same machine.

You need a certificate and key before setting `SSL_CERT` and `SSL_KEY`. You can create one with a tool like `mkcert` for local use, or `certbot` for a public domain. If the files are missing or unreadable, the server stops on startup and names the exact paths it tried.

## Admin Access and privileged actions

Some actions are extra sensitive: clearing data, creating or downloading backups, importing and exporting profiles, installing themes or extensions, and installing the Local Model runtime. These need a separate shared secret called the admin secret, on top of whichever access option you chose above.

On the loopback machine, these actions usually work with no admin secret. From a remote device, you need to set the secret up. Follow these steps.

1. In `.env`, set a strong random value and save. It applies within a couple of seconds, no restart.

```env
ADMIN_SECRET=some-long-random-string
```

2. On the remote device, open Marinara and go to **Settings**, then the **Advanced** tab, then the **Admin Access** section.
3. Paste the same value into the box (its placeholder reads **ADMIN_SECRET**), then click **Save**.
4. You should see the message **Admin secret saved for this browser**.

A few things to know about the admin secret:

- It is stored in that one browser only. It does not sync across devices. Each browser that needs privileged actions must paste it in separately.
- Clicking **Save** with the box empty clears it and shows **Admin secret cleared**.
- If the server operator sets `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`, even the loopback machine needs the secret.
- This is separate from Basic Auth. You can use both. Basic Auth gates the whole app, and the admin secret gates the dangerous actions.

If a privileged action fails on a remote device, Marinara shows an error message with two fixes. One fix is to open the app through localhost. The other is to set `ADMIN_SECRET` in the server `.env`, then paste the same value in **Settings** > **Advanced** > **Admin Access**.

## Why is my save blocked (CSRF)

CSRF stands for cross-site request forgery. It is a protection that stops another website you have open from quietly making changes in Marinara without your permission. It runs automatically. There is no setting to turn it on.

Sometimes CSRF blocks your own saves. This usually happens when you reach Marinara through a public domain name or an unusual port that the server does not yet trust. Two things tell you when this happens.

- A red banner at the top of the app warns that **Saves will silently fail** because this origin is not trusted. The banner shows the exact `.env` line to add and has a **Copy** button.
- If a save is actually rejected, a small pop-up message appears. Its title is **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected**, or **Save blocked: origin not trusted**.

To fix it, add your address to the trusted list in `.env`:

```env
CSRF_TRUSTED_ORIGINS=https://chat.example.com,http://203.0.113.10:7831
```

Loopback, normal LAN addresses, Tailscale (`100.64.0.0/10`), and Docker bridge (`172.16.0.0/12`) origins are trusted automatically. You only need to list public IP addresses and domain names. The change takes effect within a couple of seconds, no restart needed.

## A note on blocked local providers

Say you connect Marinara to a local AI provider, for example one running on your own machine. The request may be refused with a message about a "private, loopback, metadata, or reserved IP range". That is a different safety check called SSRF protection. SSRF stands for server-side request forgery. It stops the server from calling private addresses unless you allow it. The error names the exact `.env` variable to set, such as `PROVIDER_LOCAL_URLS_ENABLED`. See [Server Configuration Reference](CONFIGURATION.md) for the full list.

## Access from a phone or tablet

To open Marinara from a phone or tablet on the same network:

1. Make sure the server listens on all interfaces with `HOST=0.0.0.0` in `.env`.
2. Pick an access option above. Basic Auth is the simplest for a phone on your home Wi-Fi.
3. Find the server machine's local IP address (for example `192.168.1.50`).
4. On the phone, open `http://192.168.1.50:7860` in a browser. The default port is `7860`.
5. If you set Basic Auth, enter your username and password when prompted.

If the page does not load at all, the server may not be reachable. Check `HOST=0.0.0.0` and the `PORT` value. If you get a 403 instead, your device is reachable but not yet allowed in. Recheck your chosen option above.

## Related guides

- [Server Configuration Reference](CONFIGURATION.md) for the full list of `.env` settings and edge cases.
- [Troubleshooting Marinara Engine](TROUBLESHOOTING.md) for connection errors, mobile access, and more.
- [Frequently Asked Questions](FAQ.md) for a quick walkthrough of reaching Marinara from another device.
