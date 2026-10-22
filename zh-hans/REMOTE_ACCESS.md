# 远程访问：登录与 IP 允许列表

本指南介绍怎样从另一台设备访问 Marinara Engine，比如手机、笔记本电脑或者 Docker 容器。主要办法是登录。此外还会讲到 IP 允许列表、登录代理、HTTPS、Admin Access 以及“保存被拦截”的 CSRF 提示。这里几乎所有设置都写在服务器的 `.env` 文件里，不在应用界面中。

先明确几个贯穿全文的说法：

- `.env` 文件：Marinara Engine 文件夹里的一个纯文本设置文件，和 `package.json` 放在一起。
- 环回（Loopback）：真正运行服务器的那台机器，地址是 `127.0.0.1` 或 `localhost`。
- 远程访问：在运行服务器的那台机器以外的任何设备上打开 Marinara。

## Marinara 默认会拦截什么

为了保护数据，全新安装的 Marinara 在你设置访问控制之前会拒绝其他设备的连接。默认只信任三类客户端：

1. 环回地址（`127.0.0.1` 或 `::1`），也就是运行服务器的这台机器本身。同一台机器上的反向代理或隧道转发过来的访客不算在内，见[同一台电脑上的反向代理和隧道](#reverse-proxies-and-tunnels-on-the-same-computer)。
2. 你 tailnet 里的 Tailscale 设备。Tailscale 是一款私有网络工具，地址落在 `100.64.0.0/10` 段。
3. 同一台主机上的 Docker 客户端。Marinara 认得常见的 `172.16.0.0/12` 网桥段，以及容器里检测到的具体默认网关，因此 Docker Desktop 和自定义地址池也都能覆盖。

其余一律拦截，包括连着同一个 Wi-Fi 的手机和公网客户端，直到你设置登录为止。被拦截的设备在浏览器里打开 Marinara 会看到一个深色的设置页面，标题写着 **This Marinara Engine install needs a login before remote devices can connect.**，页面上有一个填写服务器日志里一次性设置码的表单，这样你就能在那台设备上设置登录。

如果什么都不做、也从不设密码，Marinara 就一直只对上面三类来源开放。这是最安全的默认状态。

## .env 文件在哪里

所有访问相关的设置都写在项目根目录的 `.env` 文件里，和 `package.json` 同级。还没有这个文件的话，复制一份示例：

```bash
cp .env.example .env
```

用任意文本编辑器打开 `.env`。多数访问设置几秒内就会生效，不用重启，包括 Basic Auth、IP 允许列表、管理员密钥和 CSRF 来源。少数底层设置仍然需要重启，比如 `PORT`、`HOST` 和 HTTPS 证书路径。

有时其他设备根本连不上服务器，表现为超时而不是 403。这种情况多半是服务器只在本机监听。让服务器在所有网络接口上监听：

```env
HOST=0.0.0.0
```

启动脚本（`start.bat`、`start.sh`）会自动设置 `HOST=0.0.0.0`，直接运行 `pnpm start` 则不会。

不同启动方式下的默认绑定地址：

| 启动方式 | `HOST` 默认值 |
| --- | --- |
| `pnpm start`、`start-local.bat` | `127.0.0.1` |
| `start.sh`、`start.bat`、Windows 安装程序、`start-termux.sh` | `0.0.0.0` |
| Docker 镜像 | 容器内为 `0.0.0.0` |
| `docker-compose.yml` | 只在 `127.0.0.1` 上发布端口 |

## 该选哪个方案

按顺序往下读，读到第一条符合自己情况的就停下。

1. 只通过 Tailscale 连接，或者只从同一台主机上的 Docker 容器连接。什么都不用做，现在就能用。
2. 想在家里 Wi-Fi 下用手机、平板或笔记本电脑访问 Marinara。设置登录（下面的方案 1）。
3. 要把 Marinara 暴露到公网。设置登录，并使用 HTTPS。
4. 你的网络上有登录代理，比如 tinyauth、Authelia 或 Authentik，它已经要求每位访客先登录。读[登录代理（转发认证）](#login-proxies-forward-auth)。

登录是最灵活的选择：任何 IP 都能用，每台设备都不用单独配置，浏览器也会一直保持登录。

<a id="option-1-login-recommended"></a>

## 方案 1：登录(推荐)

登录就是每台远程设备都要输入的一个用户名和密码。有三种设置方式：

- **在 Settings 里设置。**在已经登录的浏览器里，或者在运行 Marinara 的那台电脑上（打开 `http://localhost:7860`），到 **Settings** → **Advanced** → **Access**。在 **Remote login** 下设置用户名和密码。还没有登录时，Marinara 拦下的设备，比如 Docker 主机上的浏览器，可以在同一个地方输入服务器日志里的设置码。
- **用设置码，在任意设备上。**在没有设置登录、且服务器监听范围超出环回地址时，服务器会在日志里打印一个一次性设置码。日志行以 `[login] One-time setup code:` 开头。在运行 Marinara 的终端里找它。在 Docker 里，运行 `docker logs <container> 2>&1 | grep "setup code"`。只要还没有设置登录，日志里的拒绝警告就会重复这个设置码。然后在任意设备上打开 Marinara。拦下该设备的页面有一个表单，填设置码、用户名和密码。设置码形如 `XXXX-XXXX-XXXX-XXXX`，大小写、空格和短横线都不影响。每个设置码只能用一次；重启或重置后会打印一个新的。在 Docker 里，这个页面还会显示怎样在数据文件夹（`/app/data/.env`）里的 `.env` 文件中，或 compose 文件的 `environment:` 列表中设置登录（然后运行 `docker compose up -d`）。主机上没有浏览器的 Docker 和 NAS 安装适合这样用。Marinara 会在屏幕底部以卡片形式，向本机访客和已登录的会话显示一条缺少登录的横幅。
- **在 `.env` 里设置。**加两行：

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

`.env` 里的登录优先于应用里设置的登录，要修改它只能改 `.env`。保存 `.env`。改动几秒内生效，不用重启。

密码要够强、也别和别处重复。应用要求至少 10 个字符。可以生成一个随机密码：

```bash
openssl rand -base64 24
```

然后在远程设备上按下面几步操作。

1. 在浏览器里用服务器的地址打开 Marinara，例如 `http://192.168.1.50:7860`。
2. 在登录页输入你的用户名和密码。
3. 应用应该正常加载。浏览器最多会保持登录一年，直到你退出登录。脚本和 API 客户端每次请求都要带上用户名和密码（Basic Auth）。

不输密码也能在另一台设备上登录，用配对码。在已登录的设备上，打开 **Settings** → **Advanced** → **Access**，选择 **Add a device**。然后在新设备的登录页输入这个码。每个码只能用一次，有效几分钟。过期的码会收到自己的提示；重新生成一个就行。在 **Signed-in devices** 下，可以看到每台设备的登录方式和首次登录的日期。可以让任何设备退出登录，包括你正在用的这台。也可以修改或移除密码。这时 Marinara 会要求输入当前密码，除非你在运行 Marinara 的那台电脑上操作，或者设置了 `ADMIN_SECRET`。

如果忘了密码，在运行 Marinara 的电脑上运行 `pnpm reset-login`。在 Docker 里，运行 `docker exec <container> node scripts/reset-login.mjs`。它会删除应用里设置的登录，并让每个浏览器退出登录。如果服务器监听范围超出环回地址，它随后会打印一个新的设置码。只有这条命令用不了时，才改为从数据文件夹里删除 `.remote-login.json` 和 `.remote-sessions.json`。用默认的 `/app/data` 时，运行 `docker exec <container> rm -f /app/data/.remote-login.json /app/data/.remote-sessions.json`；如果你改过 `DATA_DIR`，就用那个文件夹。你在 `.env` 里设置的登录要在 `.env` 里修改。

**没有浏览器的无头服务器？**无头服务器上的原生安装只在环回地址上监听，也不会打印设置码。在你自己的电脑上，运行 `ssh -L 7860:127.0.0.1:7860 user@server`。然后在那里打开 `http://localhost:7860` 并使用 **Settings**。

如果 15 分钟内输错了 10 个不同的密码或设置码，Marinara 会以 **429 Too Many Requests** 拒绝来自该地址的登录，直到这 15 分钟过去。在此之前输对一次密码就会清零计数。主机上的反向代理或隧道转发过来的访客共用一个计数，其中一人登录成功也不会清零。重启服务器同样会清零。之前登录过的浏览器只要输对密码仍然能进，所以别人输错密码不会把你挡在自己常用的设备之外。登录页会告诉你还要等几分钟。如果忘了密码，登录页有 **Forgot the password?** 提示。

浏览器的密码提示默认显示 **Marinara Engine**，这段文字可以用 `BASIC_AUTH_REALM` 改。

即使开着 Basic Auth，仍有几类客户端不需要输密码：

- 环回地址（`127.0.0.1`、`::1`），所以在服务器本机上永远不用输密码。这台机器上的反向代理或隧道转发过来的访客仍然需要密码。
- `IP_ALLOWLIST` 里的任何地址。注意：一旦设了允许列表，没列进去的地址就全被拦住了（见方案 2）。
- 直连的 Tailscale 流量（`100.64.0.0/10`），除非把它的放行开关关掉。
- Docker 网桥/网关流量，但仅限没有设置登录、允许列表或 `TRUSTED_AUTH_PROXY` 时（见 [Tailscale 与 Docker 放行](#tailscale-and-docker-bypass)）。
- `/api/health` 地址，这样运行状态监控能继续工作。打不开应用的访问者只会收到 `{"status": "ok"}`；版本、系统和模型详情只留给这台电脑、受信任的网络和已登录的浏览器。

重要提醒：Basic Auth 只是把密码编码，并没有加密。任何人只要能监听未加密的连接就能读到它。如果要把 Marinara 暴露到公网，一定要给 Basic Auth 配上 HTTPS(见下文)。

## 方案 2：IP 允许列表

IP 允许列表让指定地址免密码进入，适合设备 IP 地址固定的情况。用逗号分隔写出地址或地址段：

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

例子里的 `/24` 是 CIDR 写法。CIDR 是用一条记录表示一整段地址的简写方式，比如 `192.168.1.0/24` 覆盖从 `192.168.1.0` 到 `192.168.1.255` 的全部地址。不带斜杠的单个地址，比如 `203.0.113.42`，只匹配那一台设备。

IP 允许列表的行为如下：

- 不在列表里的地址一律以 **403 Forbidden** 拒绝。
- 环回地址始终放行，所以不会因为配错而把自己关在本机之外。同一台机器上的反向代理或隧道转发过来的访客不算环回，所以会被允许列表拦下。在代理后面请使用 Basic Auth。
- 在 Docker Desktop、OrbStack 和 rootless Docker 上，每台设备都从同一个网关地址访问容器，允许列表无法区分它们。这种情况下请使用 Basic Auth。
- 直连的 Tailscale 流量也会跳过这个列表，除非把它的放行开关关掉。Docker 网桥/网关流量只有在没有设置登录、允许列表或有效的 `TRUSTED_AUTH_PROXY` 时才会跳过（见 [Tailscale 与 Docker 放行](#tailscale-and-docker-bypass)）。
- 无效条目会被忽略并记进日志，不会让服务器崩溃。
- 就算开着 Basic Auth，允许列表一样严格：列表内的地址跳过密码提示，其余地址依旧以 **403 Forbidden** 拦下，连登录框都不会出现。

允许列表做不到“列表内免密码、其他人输密码登录”这种混合模式。想让其他设备用密码登录，就别设 `IP_ALLOWLIST`，只用 Basic Auth。

不删列表也可以临时停用它，从新 IP 排查问题时很方便。把启用开关设成 false：

```env
IP_ALLOWLIST_ENABLED=false
```

## 私有网络放行（参考）

有几个开关可以为可信的私有网络解除封锁。它们适用于特殊场景。登录是更好的选择。这些开关及其风险见[访问控制](CONFIGURATION.md#access-control)。

<a id="tailscale-and-docker-bypass"></a>

## Tailscale 与 Docker 放行

默认情况下，Marinara 信任直连这台电脑的 Tailscale 网络的设备。它也信任 Docker 容器自己的主机。登录、IP 允许列表或 `TRUSTED_AUTH_PROXY` 会让自动的 Docker 信任失效，这样每台设备都需要自己的登录或在允许列表里的位置。想了解改变这一点的开关，见[访问控制](CONFIGURATION.md#access-control)。

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## 同一台电脑上的反向代理和隧道

运行 Marinara 的那台机器上的反向代理或隧道，例如 nginx、Caddy、Traefik、Cloudflare Tunnel、Tailscale Serve 或 Funnel、ngrok，是从环回地址连接 Marinara 的。Marinara 会根据代理添加的转发请求头识别出这种情况：`Forwarded`、`X-Forwarded-For`、`X-Real-IP`、`X-Forwarded-Host`、`X-Forwarded-Proto`、`CF-Connecting-IP`、`True-Client-IP`、Tailscale 的身份请求头，或者 `Via`。Marinara 也会识别以 HTTP/1.0 到达的请求，因为浏览器从不使用它，而 nginx 的默认 `proxy_pass` 会使用。即使代理没有添加任何请求头，Marinara 也会识别 Host 指向另一台计算机（例如域名或局域网地址）的请求。之后它会把每个请求当作真正的远程访客对待：

- 登录生效（见[方案 1](#option-1-login-recommended)）。没有登录时，访客看到的是设置页面。在这台电脑上的 **Settings** 里，或者在 `.env` 里设置登录。
- `IP_ALLOWLIST` 会拦下转发过来的访客，因为代理隐藏了他们的真实地址。
- 高权限操作需要管理员密钥，只限环回使用的功能仍然不可用。

你自己在这台机器上用 `http://127.0.0.1:7860` 或 `http://localhost:7860` 打开的浏览器，仍然不需要密码。

Caddy、Traefik、Cloudflare Tunnel、Tailscale 和 ngrok 默认会添加转发请求头。nginx 仍然建议在 `location` 块里加上这一行：

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

转发原始连接的工具，例如 `socat` 或 `ssh -R`，不会添加任何请求头，所以它们的流量看起来就像本地流量。不要用它们来公开 Marinara。

如果你的代理在转发之前已经要求每位访客登录，见[登录代理（转发认证）](#login-proxies-forward-auth)。

<a id="login-proxies-forward-auth"></a>

## 登录代理（转发认证）

转发认证代理，例如 [tinyauth](https://tinyauth.app)、[Authelia](https://www.authelia.com)、[Authentik](https://goauthentik.io) 或 oauth2-proxy，会在转发请求之前要求每位访客登录。如果这样的代理是访问 Marinara 的唯一途径，你可以跳过第二道 Marinara 登录。没有这样的代理时不要设置它。

把代理的地址写进 `.env`：

```env
TRUSTED_AUTH_PROXY=192.168.1.5
```

这样，Marinara 会让每个连接来自该地址的请求直接进入。Marinara 不会再要求它自己的登录，也不会打印设置码。Marinara 只检查连接本身的地址。做这个判断时，它会忽略 `X-Forwarded-For` 之类的转发请求头。来自代理的请求也会跳过 `IP_ALLOWLIST`，因为由代理决定谁能进来。它们不算本地，所以高权限操作仍然需要管理员密钥。**Settings** → **Advanced** → **Access** 在设置生效期间会显示 **Trusted login proxy: Set**。

设置之前：

- **代理必须在每条路径上都要求登录。**这包括 `/api/`、WebSocket 连接和静态文件。代理不经登录就放行的路径，对所有人开放。
- **Marinara 不能被绕过代理访问到。**把 Marinara 绑定到只有代理能访问的地址，或者用防火墙拦住它的端口。在 Docker 里，把代理和 Marinara 放在同一个 Docker 网络上，给代理一个固定地址，并且不要发布 Marinara 的端口。如果代理运行在 Docker 主机上，只在环回地址上发布端口（`127.0.0.1:7860:7860`）：Docker Desktop 和 OrbStack 会让已发布端口的每个局域网客户端都显示为 Docker 网关地址，也就是和代理相同的地址。如果另一台设备能直接连上 Marinara，它就会跳过代理的登录。
- **只列出代理自己的地址。**范围必须限定在私有地址空间内；Marinara 会忽略其他范围。它会为每个范围记一条警告，因为范围内的每台设备都会跳过登录。
- **像对待其他代理一样加上公网名称。**把主机名放进 `TRUSTED_HOSTS`，把来源放进 `CSRF_TRUSTED_ORIGINS`（见[保存为什么被拦截（CSRF）](#why-is-my-save-blocked-csrf)）。

设置了 `TRUSTED_AUTH_PROXY` 时，Marinara 也会让自动的 Docker 信任失效。不是代理的 Docker 访客于是需要 Marinara 登录或 IP 允许列表。Marinara 随后还会显示一条严格的“尚无登录”横幅。

如果代理和 Marinara 运行在同一台电脑上，请使用 `TRUSTED_AUTH_PROXY=127.0.0.1`，并让代理指向 `127.0.0.1:7860`，而不是 `localhost:7860`。拨号 `localhost` 的代理可能从 `::1` 连接，它和 `127.0.0.1` 不匹配。这样，这台电脑上的其他每个代理或隧道也都被信任，所以只有当登录代理是唯一的代理时才用它。这不会让被代理的访客获得本机的访问权限。

Caddy 示例，Marinara 在 `192.168.1.20:7860`：

```caddy
marinara.example.com {
  forward_auth tinyauth:3000 {
    uri /api/auth/caddy
  }
  reverse_proxy 192.168.1.20:7860
}
```

对于 Authelia，用 `forward_auth authelia:9091`，加上 `uri /api/authz/forward-auth`。Authentik 还会通过代理提供它自己的登录页面。把这些放进 `route` 块里，这样 Caddy 会保持它们的顺序，而且 outpost 路径不会再经过转发认证：

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

对于 Traefik，请遵循你的代理的转发认证指南。Marinara 需要的不只是代理的地址。

## 通过 HTTPS 提供服务

HTTPS 用 TLS 加密连接。TLS 就是把普通 `http` 地址变成安全的 `https` 地址的那层加密。如果这套安装在完全可信的私有网络之外也能访问到，就一定要用 HTTPS，配合 Basic Auth 时尤其如此。

有两种加上 HTTPS 的办法。

1. 内置 TLS。给服务器指定证书文件和私钥文件：

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. 反向代理。把 Marinara 放在 nginx、Caddy、Traefik 或 Cloudflare Tunnel 后面，由代理负责 HTTPS，再在同一台机器上用普通 HTTP 转发给 Marinara。请先阅读[同一台电脑上的反向代理和隧道](#reverse-proxies-and-tunnels-on-the-same-computer)。

设置 `SSL_CERT` 和 `SSL_KEY` 之前得先有证书和私钥。本地使用可以用 `mkcert` 之类的工具生成，公网域名则可以用 `certbot`。文件缺失或者读不到时，服务器会在启动时停下，并把尝试过的确切路径打印出来。

## Admin Access 与高权限操作

有些操作格外敏感：清除数据、创建或下载备份、导入和导出档案、安装主题、安装本地模型运行时。除了上面选定的访问方案之外，这些操作还需要一个单独的共享密钥，叫管理员密钥。

在环回机器上，这些操作通常不用管理员密钥也能完成。从远程设备操作时就得先把密钥配好，步骤如下。

1. 在 `.env` 里设一个足够强的随机值并保存。几秒内生效，不用重启。

```env
ADMIN_SECRET=some-long-random-string
```

2. 在远程设备上打开 Marinara，进入 **Settings**(设置)，切到 **Advanced**(高级) 选项卡，找到 **Admin Access**(管理员访问) 一节。
3. 把同一个值粘进输入框（占位文字是 **ADMIN_SECRET**），然后点击 **Save**(保存)。
4. 应该会看到提示 **Admin secret saved for this browser**。

关于管理员密钥，有几点要知道：

- 它只保存在那一个浏览器里，不会在设备之间同步。每个需要执行高权限操作的浏览器都得单独粘一次。
- 输入框留空时点击 **Save** 会清除它，并显示 **Admin secret cleared**。
- 服务器管理者如果设了 `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`，那么在环回机器上也要输密钥。
- 它和 Basic Auth 是两回事，两者可以同时用。Basic Auth 守着整个应用，管理员密钥守着这些危险操作。

远程设备上高权限操作失败时，Marinara 会给出一条错误提示，里面写着两种解决办法：一是改从 localhost 打开应用，二是在服务器的 `.env` 里设置 `ADMIN_SECRET`，再把同一个值粘到 **Settings** > **Advanced** > **Admin Access**。

<a id="why-is-my-save-blocked-csrf"></a>

## 保存为什么被拦截（CSRF）

CSRF 指跨站请求伪造，是一种防护机制，用来阻止你同时开着的其他网站在你不知情的情况下悄悄改动 Marinara。它自动运行，没有开启它的设置项。

有时 CSRF 会把你自己的保存操作也拦下来。多半是因为访问 Marinara 用的是公网域名，或者是服务器还不信任的非常规端口。有两处地方会提示这种情况。

- 应用顶部会出现红色横幅，警告说因为当前来源不受信任，**Saves will silently fail**。横幅里会写出该加进 `.env` 的那一行，还带一个 **Copy**(复制) 按钮。
- 保存真的被拒绝时，会弹出一条小提示，标题是 **Save blocked: missing CSRF header**、**Save blocked: cross-site request rejected** 或 **Save blocked: origin not trusted**。

解决办法是把地址加进 `.env` 的受信任列表：

```env
CSRF_TRUSTED_ORIGINS=https://chat.example.com,http://203.0.113.10:7831
```

用公网域名或反向代理域名时，还要把主机名也放行：

```env
TRUSTED_HOSTS=chat.example.com
```

直连的局域网、Tailscale、IPv4 和 IPv6 地址不需要 `TRUSTED_HOSTS`。本地的 `.local`/`.home.arpa` 名称和单段机器名会自动放行。已经写在 `CSRF_TRUSTED_ORIGINS` 里的完整主机名同样有效。

环回地址、普通局域网地址、Tailscale(`100.64.0.0/10`) 和 Docker 网桥（`172.16.0.0/12`）来源都自动受信任，只需要把公网 IP 地址和域名列出来。改动几秒内生效，不用重启。

## 关于本地服务商被拦截

假设把 Marinara 连到本地的 AI 服务商，比如跑在自己机器上的那种。请求可能被拒绝，提示里提到“private, loopback, metadata, or reserved IP range”。这是另一套安全检查，叫 SSRF 防护。SSRF 指服务器端请求伪造，作用是阻止服务器在未获许可的情况下访问私有地址。错误提示会写明该设置哪个 `.env` 变量，比如 `PROVIDER_LOCAL_URLS_ENABLED`。完整清单见[服务器配置参考](CONFIGURATION.md)。

## 从手机或平板访问

要在同一网络下用手机或平板打开 Marinara：

1. 确认 `.env` 里设了 `HOST=0.0.0.0`，让服务器在所有接口上监听。
2. 设置登录（上面的方案 1）。在手机上，可以用服务器日志里的设置码，在拦下手机的页面上设置。
3. 找到服务器所在机器的局域网 IP 地址（例如 `192.168.1.50`）。
4. 在手机浏览器里打开 `http://192.168.1.50:7860`。默认端口是 `7860`。
5. 用你的用户名和密码登录。

页面完全打不开，说明多半连不上服务器，检查 `HOST=0.0.0.0` 和 `PORT` 的值。如果收到的是 403，那说明设备能连上，只是还没被放行，回头再看一遍选定的方案。

<a id="locked-out-after-updating"></a>

## 更新后被锁在外面

较新的版本在访问经由反向代理、隧道、Tailscale Serve 或 Tailscale Funnel 到达时，会要求登录。旧版本会不要密码就放行这些访问。如果你现在看到登录页、设置页或 **403**，原因就在这里。

**升级说明：**如果你用 Tailscale Serve，或者同一台电脑上的其他代理，而且从没设置过密码，那么更新之后你的其他设备就被锁在外面了。同一台电脑上的代理通常是连接一个只在环回地址上监听的服务器，所以服务器不会打印设置码。请改在运行 Marinara 的那台电脑上设置登录。

重新进入的方法：

1. 在运行 Marinara 的那台电脑上，打开 `http://localhost:7860`（或你自己的 `PORT`）。本机使用不需要密码。在无头服务器上，先在你自己的电脑上运行 `ssh -L 7860:127.0.0.1:7860 user@server`，然后在那里打开 `http://localhost:7860`。在 Docker 中，只有在没有设置登录也没有设置 `IP_ALLOWLIST` 时才是这样。否则，在拦下你的页面上输入服务器日志里的设置码（`docker logs <container> 2>&1 | grep "setup code"`），在 **Settings** → **Advanced** → **Access** 里，或者使用仍处于登录状态的浏览器。
2. 到 **Settings** → **Advanced** → **Access**，在 **Remote login** 下设置用户名和密码。或者在那台电脑上打开 `.env` 文件，设置 `BASIC_AUTH_USER` 和 `BASIC_AUTH_PASS`。如果设置了 `IP_ALLOWLIST`，请把你另一台设备的地址加进去，或者删掉该设置，因为不在列表里的设备即使登录也会收到 **403**。
3. 在你的另一台设备上用该用户名和密码登录。

## 搜索引擎

Marinara 会请求搜索引擎不要索引其页面（`X-Robots-Tag: noindex, nofollow`）。这不能保护你的安装，也不会移除已经被索引的页面。请使用上面的访问控制来保持你的安装私密。

## 相关指南

- [服务器配置参考](CONFIGURATION.md)：`.env` 设置的完整清单和各种边界情况。
- [Marinara Engine 故障排查](TROUBLESHOOTING.md)：连接报错、移动端访问等问题。
- [常见问题](FAQ.md)：从另一台设备访问 Marinara 的快速上手说明。
