# Remote Access: Login and IP Allowlist

This guide explains how to reach Marinara Engine from another device, such as your phone, a laptop, or a Docker container. It covers the main option, a login. It also covers the IP allowlist, login proxies, HTTPS, Admin Access, and the "save blocked" CSRF message. Almost every setting here lives in the server `.env` file, not in the app.

A quick word list used throughout this guide:

- `.env` file: a plain text settings file in the Marinara Engine folder, next to `package.json`.
- Loopback: the machine that is actually running the server. Its address is `127.0.0.1` or `localhost`.
- Remote access: opening Marinara from any device that is NOT the machine running the server.

## What Marinara blocks by default

To protect your data, a fresh Marinara install refuses connections from other devices until you set up access control. By default, only three kinds of client are trusted:

1. Loopback (`127.0.0.1` or `::1`), the machine running the server itself. Visitors that a reverse proxy or tunnel on the same machine passes along do not count; see [Reverse proxies and tunnels on the same computer](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Tailscale devices in your tailnet. Tailscale is a private network tool, and its addresses use the `100.64.0.0/10` range.
3. Docker clients on the same host. Marinara recognizes the usual `172.16.0.0/12` bridge range and the container's exact default gateway, which also covers Docker Desktop and custom address pools.

Everything else, such as your phone on the same Wi-Fi or a public-internet client, is blocked until you set a login. A blocked device that opens Marinara in a browser sees a dark setup page. Its title reads **This Marinara Engine install needs a login before remote devices can connect.** The page has a form for the one-time setup code from the server log, so you can set the login from that device.

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

Default bind address by how you start Marinara:

| Start method                                                  | `HOST` default                         |
| ------------------------------------------------------------- | -------------------------------------- |
| `pnpm start`, `start-local.bat`                               | `127.0.0.1`                            |
| `start.sh`, `start.bat`, Windows installer, `start-termux.sh` | `0.0.0.0`                              |
| Docker image                                                  | `0.0.0.0` inside the container         |
| `docker-compose.yml`                                          | Publishes the port on `127.0.0.1` only |

## Which option should you pick

Read these in order and stop at the first one that matches you.

1. You only connect directly over Tailscale, or only from Docker containers on the same host. With `pnpm start`, direct Tailscale clients skip the login; set `HOST=0.0.0.0` so they can reach the server. The default Compose file publishes on `127.0.0.1` only. If you publish the port beyond loopback so a Tailscale device can reach it, set a login first. Docker then asks every device for that login, Tailscale devices included, because Docker sees them at the gateway address. See [Tailscale and Docker bypass](#tailscale-and-docker-bypass).
2. You want to reach Marinara from a phone, tablet, or laptop on your home Wi-Fi. Set a login (Option 1 below).
3. You are exposing Marinara to the public internet. Set a login and use HTTPS.
4. A login proxy on your network, such as tinyauth, Authelia, or Authentik, already asks every visitor to log in. Read [Login proxies (forward auth)](#login-proxies-forward-auth).

A login is the most flexible choice. It works from any IP, needs no per-device setup, and each browser stays signed in.

## Option 1: Login (recommended)

A login is a username and password that every remote device needs. You can set it in three ways:

- **In Settings.** In a browser that is already signed in, or on the computer that runs Marinara (open `http://localhost:7860`), go to **Settings → Advanced → Access**. Set a username and password under **Remote login**. While no login exists, a device that Marinara refuses, such as the browser on a Docker host, can type the setup code from the server log in the same place.
- **With the setup code, from any device.** While no login is set and the server listens beyond loopback, it prints a one-time setup code in its log. The log line starts with `[login] One-time setup code:`. Find it in the terminal that runs Marinara. In Docker, run `docker logs <container> 2>&1 | grep "setup code"`. The refusal warning in the log repeats the code while no login exists. Then open Marinara on any device. The page that blocks the device has a form for the setup code, a username, and a password. The code looks like `XXXX-XXXX-XXXX-XXXX`. Capital letters, spaces, and dashes do not matter. Each code works once; a restart or a reset prints a new one. In Docker, the page also shows how to set the login in the `.env` file in the data folder (`/app/data/.env`) or in the `environment:` list of your compose file (then run `docker compose up -d`). Use this way for Docker and NAS installs with no browser on the host. Marinara shows a banner about the missing login to local visitors and signed-in sessions, as a card at the bottom of the screen.
- **In `.env`.** Add two lines:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

A login in `.env` wins over a login set in the app, and you change it only in `.env`. Save `.env`; the change applies within a couple of seconds, with no restart.

Pick a strong, unique password. The app asks for at least 10 characters. You can generate a random one:

```bash
openssl rand -base64 24
```

Then follow these steps from the remote device.

1. Open Marinara in your browser using the server's address, for example `http://192.168.1.50:7860`.
2. Sign in on the sign-in page with your username and password.
3. You should see the app load. The browser stays signed in for up to a year, until you sign it out. Scripts and API clients send the username and password with every request (Basic Auth).

To sign in another device without typing the password, use a pairing code. On a device that is signed in, open **Settings → Advanced → Access** and choose **Add a device**. Then type the code on the sign-in page of the new device. The code works once, for a few minutes. An expired code gets its own message; make a new one. Under **Signed-in devices**, you see each device with its sign-in method and the date it first signed in. You can sign out any device, including the one you use. You can also change or remove the password. For that, Marinara asks for the current password, unless you work on the computer that runs Marinara or have set `ADMIN_SECRET`.

If you forget the password, run `pnpm reset-login` on the computer that runs Marinara. In Docker, run `docker exec <container> node scripts/reset-login.mjs`. It removes the login set in the app and signs out every browser. If the server listens beyond loopback, it then prints a new setup code. Only if that command does not work, delete `.remote-login.json` and `.remote-sessions.json` from the data folder instead. With the default `/app/data`, run `docker exec <container> rm -f /app/data/.remote-login.json /app/data/.remote-sessions.json`; if you changed `DATA_DIR`, use that folder. A login in `.env` you change in `.env`.

**Headless server with no browser?** A native install on a headless server listens on loopback only and prints no setup code. On your own computer, run `ssh -L 7860:127.0.0.1:7860 user@server`. Then open `http://localhost:7860` there and use **Settings**.

After 10 different wrong passwords or codes within 15 minutes, Marinara refuses sign-ins from that address with **429 Too Many Requests** until the 15 minutes are up. A correct password before then clears the count. Visitors that a reverse proxy or tunnel on the host passes along share one count, and one of them signing in does not clear it. Restarting the server also clears it. A browser that has signed in before still gets in with the correct password, so other people's wrong passwords cannot lock you out of a device you already use. The sign-in page tells you how many minutes to wait. If you forget the password, the sign-in page has a **Forgot the password?** hint.

Browsers sign in on the `/login` page. `BASIC_AUTH_REALM` changes the realm in the Basic Auth challenge for scripts and API clients; it does not change the sign-in page.

Some clients skip the password even when Basic Auth is on:

- Loopback (`127.0.0.1`, `::1`), so you never need a password on the host machine itself. Visitors that a reverse proxy or tunnel on that machine passes along still need it.
- Any address in `IP_ALLOWLIST`. Careful: setting an allowlist also blocks every unlisted address (see Option 2).
- Direct Tailscale traffic (`100.64.0.0/10`), unless you turn its bypass off.
- Docker bridge/gateway traffic, only while no login, allowlist, or `TRUSTED_AUTH_PROXY` is set (see [Tailscale and Docker bypass](#tailscale-and-docker-bypass)).
- The `/api/health` address, so uptime monitors keep working. Visitors who could not open the app get only `{"status": "ok"}`; version, system and model details stay with this machine, trusted networks and signed-in browsers.

Important: Basic Auth only encodes the password. It does not encrypt it. Anyone watching an unencrypted connection can read it. If you expose Marinara to the public internet, pair Basic Auth with HTTPS (see below).

## Option 2: IP allowlist

The IP allowlist lets specific addresses in without a password. It is a good fit when your devices have stable IP addresses. Set a comma-separated list of addresses or ranges:

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

The `/24` in the example is CIDR notation. CIDR is a short way to write a whole range of addresses in one entry. For example, `192.168.1.0/24` covers every address from `192.168.1.0` to `192.168.1.255`. A bare address with no slash, like `203.0.113.42`, matches only that one device.

A broad public range, such as `0.0.0.0/0`, can let internet clients in without a login. List only addresses you trust.

How the IP allowlist behaves:

- Any address not in the list is rejected with **403 Forbidden**.
- Loopback is always allowed, so you cannot lock yourself out of local access. Visitors that a reverse proxy or tunnel on the same machine passes along are not loopback, so the allowlist blocks them. Use Basic Auth behind a proxy.
- On Docker Desktop, OrbStack, and rootless Docker, every device reaches the container from the same gateway address, so the allowlist cannot tell them apart. Use Basic Auth there.
- Direct Tailscale traffic also skips the list. Docker bridge/gateway traffic skips it only while no login, allowlist or valid `TRUSTED_AUTH_PROXY` is set (see [Tailscale and Docker bypass](#tailscale-and-docker-bypass)).
- Invalid entries are ignored and logged. They do not crash the server.
- The allowlist stays strict even with Basic Auth on. Listed addresses skip the password prompt. Every other address is still blocked with **403 Forbidden** and never gets a login prompt.

The allowlist cannot create a mixed setup where listed devices skip the password and everyone else logs in. If you want other devices to log in with a password, leave `IP_ALLOWLIST` unset and use Basic Auth alone.

You can turn enforcement off for a while without deleting your list. This is handy when troubleshooting from a new IP. Set the enable flag to false:

```env
IP_ALLOWLIST_ENABLED=false
```

## Private-network bypass (reference)

A few flags drop the lockdown for a trusted private network. They are for special setups. A login is the better choice. See [Access Control](CONFIGURATION.md#access-control) for the flags and their risks.

## Tailscale and Docker bypass

By default, Marinara trusts a device that connects straight over your Tailscale network. It also trusts a Docker container's own host. A login, an IP allowlist, or `TRUSTED_AUTH_PROXY` stops the automatic Docker trust, so every device then needs its login or its place on the allowlist. For the flags that change this, see [Access Control](CONFIGURATION.md#access-control).

## Reverse proxies and tunnels on the same computer

A reverse proxy or tunnel on the machine running Marinara, such as nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve or Funnel, or ngrok, connects to Marinara from loopback. Marinara recognizes this from the forwarding headers the proxy adds: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, the Tailscale identity headers, or `Via`. Marinara also recognizes a request that arrives over HTTP/1.0, because browsers never use it but a default nginx `proxy_pass` does. Marinara also recognizes a request whose Host names another computer, such as a domain or a LAN address, even when the proxy adds no headers. It then treats each request as the remote visitor it is:

- The login applies (see [Option 1](#option-1-login-recommended)). Without one, visitors see the setup page. Set the login in **Settings** on this computer or in `.env`.
- `IP_ALLOWLIST` blocks the forwarded visitors, because the proxy hides their real addresses.
- Privileged actions need the admin secret, and loopback-only features stay unavailable.

Your own browser on that machine, opened at `http://127.0.0.1:7860` or `http://localhost:7860`, stays passwordless.

Caddy, Traefik, Cloudflare Tunnel, Tailscale, and ngrok add forwarding headers by default. For nginx, this line is still recommended in the `location` block:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Tools that forward raw connections, such as `socat` or `ssh -R`, add no headers, so their traffic looks local. Do not use them to publish Marinara.

If your proxy already makes every visitor log in before it forwards anything, see [Login proxies (forward auth)](#login-proxies-forward-auth).

## Login proxies (forward auth)

A forward-auth proxy, such as [tinyauth](https://tinyauth.app), [Authelia](https://www.authelia.com), [Authentik](https://goauthentik.io), or oauth2-proxy, asks every visitor to log in before it forwards the request. If such a proxy is the only way to reach Marinara, you can skip the second Marinara login. Do not set this without such a proxy.

Put the address of the proxy in `.env`:

```env
TRUSTED_AUTH_PROXY=192.168.1.5
```

Marinara then lets in every request whose connection comes from that address. Marinara does not ask for its own login for them, and it prints no setup code. Marinara checks the address of the connection itself. It ignores forwarding headers such as `X-Forwarded-For` for this decision. Requests from the proxy also pass `IP_ALLOWLIST`, because the proxy decides who gets in. They do not count as local, so privileged actions still need the admin secret. **Settings → Advanced → Access** shows **Trusted login proxy: Set** while the setting is active.

Before you set it:

- **The proxy must ask for a login on every path.** That includes `/api/`, WebSocket connections, and static files. A path that the proxy lets through without a login is open to everyone.
- **Marinara must not be reachable around the proxy.** Bind Marinara to an address that only the proxy can reach, or block its port with a firewall. In Docker, put the proxy and Marinara on the same Docker network, give the proxy a fixed address on it, and do not publish Marinara's port. If the proxy runs on the Docker host instead, publish the port only on loopback (`127.0.0.1:7860:7860`): Docker Desktop and OrbStack show every LAN client of a published port at the Docker gateway address, the same address as the proxy. If another device can connect to Marinara directly, it skips the proxy's login.
- **List only the proxy's own address.** A range must stay inside private address space; Marinara ignores other ranges. It logs a warning for every range, because every device in a range skips the login.
- **Add the public name like for any other proxy.** Put the hostname in `TRUSTED_HOSTS` and the origin in `CSRF_TRUSTED_ORIGINS` (see [Why is my save blocked (CSRF)](#why-is-my-save-blocked-csrf)).

When `TRUSTED_AUTH_PROXY` is set, Marinara also stops the automatic Docker trust. Direct visitors who are not the proxy need the Marinara login or the IP allowlist. Marinara then also shows no "no login yet" banner.

If the proxy runs on the same computer as Marinara, use `TRUSTED_AUTH_PROXY=127.0.0.1` and point the proxy at `127.0.0.1:7860`, not `localhost:7860`. A proxy that dials `localhost` can connect from `::1`, which does not match `127.0.0.1`. Then every other proxy or tunnel on that computer is trusted too, so use it only when the login proxy is the only one. This does not give proxied visitors the local machine's access.

A Caddy example, with Marinara at `192.168.1.20:7860`:

```caddy
marinara.example.com {
  forward_auth tinyauth:3000 {
    uri /api/auth/caddy
  }
  reverse_proxy 192.168.1.20:7860
}
```

For Authelia, use `forward_auth authelia:9091` with `uri /api/authz/forward-auth`. Authentik also serves its own sign-in pages through the proxy. Put its lines in a `route` block so that Caddy keeps their order and the outpost path does not go through forward auth itself:

```caddy
marinara.example.com {
  route {
    reverse_proxy /outpost.goauthentik.io/* authentik-server:9000
    forward_auth authentik-server:9000 {
      uri /outpost.goauthentik.io/auth/caddy
    }
    reverse_proxy 192.168.1.20:7860
  }
}
```

For Traefik and nginx, follow the forward-auth guide of your proxy. Marinara needs nothing more than the address of the proxy.

## Serving over HTTPS

HTTPS encrypts the connection using TLS. TLS is the encryption that turns a plain `http` address into a secure `https` one. Always use HTTPS for any install reachable outside a fully trusted private network, especially with Basic Auth.

You have two ways to add it.

1. Built-in TLS. Point the server at a certificate and private key file:

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. Reverse proxy. Put Marinara behind nginx, Caddy, Traefik, or a Cloudflare Tunnel. The proxy handles the HTTPS part and forwards to Marinara over plain HTTP on the same machine. Read [Reverse proxies and tunnels on the same computer](#reverse-proxies-and-tunnels-on-the-same-computer) first.

You need a certificate and key before setting `SSL_CERT` and `SSL_KEY`. You can create one with a tool like `mkcert` for local use, or `certbot` for a public domain. If the files are missing or unreadable, the server stops on startup and names the exact paths it tried.

## Admin Access and privileged actions

Some actions are extra sensitive: clearing data, creating or downloading backups, importing and exporting profiles, installing themes, and installing the Local Model runtime. These need a separate shared secret called the admin secret, on top of whichever access option you chose above.

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

When you use a public or reverse-proxy domain, also allow the hostname:

```env
TRUSTED_HOSTS=chat.example.com
```

Direct LAN, Tailscale, IPv4, and IPv6 addresses do not need `TRUSTED_HOSTS`. Local `.local`/`.home.arpa` names and single-label machine names are accepted automatically. An exact hostname already listed in `CSRF_TRUSTED_ORIGINS` is accepted too.

Loopback, normal LAN addresses, Tailscale (`100.64.0.0/10`), and Docker bridge (`172.16.0.0/12`) origins are trusted automatically. You only need to list public IP addresses and domain names. The change takes effect within a couple of seconds, no restart needed.

## A note on blocked local providers

Say you connect Marinara to a local AI provider, for example one running on your own machine. The request may be refused with a message about a "private, loopback, metadata, or reserved IP range". That is a different safety check called SSRF protection. SSRF stands for server-side request forgery. It stops the server from calling private addresses unless you allow it. The error names the exact `.env` variable to set, such as `PROVIDER_LOCAL_URLS_ENABLED`. See [Server Configuration Reference](CONFIGURATION.md) for the full list.

## Access from a phone or tablet

To open Marinara from a phone or tablet on the same network:

1. Make sure the server listens on all interfaces with `HOST=0.0.0.0` in `.env`.
2. Set a login (Option 1 above). From the phone, you can do it on the page that blocks you, with the setup code from the server log.
3. Find the server machine's local IP (for example `192.168.1.50`).
4. On the phone, open `http://192.168.1.50:7860` in a browser. The default port is `7860`.
5. Sign in with your username and password.

If the page does not load at all, the server may not be reachable. Check `HOST=0.0.0.0` and the `PORT` value. If you get a 403 instead, your device is reachable but not yet allowed in. Recheck your chosen option above.

## Locked out after updating

Newer versions ask for a login when a visit comes through a reverse proxy, a tunnel, Tailscale Serve, or Tailscale Funnel. Older versions let these visits in without a password. If you now see a login page, a setup page, or a **403**, this is why.

**Upgrade note:** if you use Tailscale Serve, or another proxy on the same computer, and never set a password, your other devices are locked out after the update. A proxy on the same computer usually talks to a server that listens on loopback only, so the server prints no setup code. Set the login on the computer that runs Marinara instead.

To get back in:

1. Open Marinara on the computer that runs it, at `http://localhost:7860` (or your own `PORT`). Local use needs no password. On a headless server, first run `ssh -L 7860:127.0.0.1:7860 user@server` on your own computer, then open `http://localhost:7860` there. In Docker, this works only while no login and no `IP_ALLOWLIST` are set. Otherwise type the setup code from the server log (`docker logs <container> 2>&1 | grep "setup code"`) on the page that blocks you or in **Settings → Advanced → Access**, or use a browser that is still signed in.
2. Go to **Settings → Advanced → Access** and set a username and password under **Remote login**. Or open the `.env` file on that computer and set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS`. If `IP_ALLOWLIST` is set, add your other device's address to it or remove it, because a device that is not on the list gets a **403** even with a login.
3. Sign in from your other device with that username and password.

## Search engines

Marinara asks search engines not to index its pages (`X-Robots-Tag: noindex, nofollow`). This does not protect your installation and does not remove pages that are already indexed. Use the access controls above to keep your installation private.

## Related guides

- [Server Configuration Reference](CONFIGURATION.md) for the full list of `.env` settings and edge cases.
- [Troubleshooting Marinara Engine](TROUBLESHOOTING.md) for connection errors, mobile access, and more.
- [Frequently Asked Questions](FAQ.md) for a quick walkthrough of reaching Marinara from another device.
