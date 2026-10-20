# 远程访问：Basic Auth 与 IP 允许列表

本指南介绍怎样从另一台设备访问 Marinara Engine，比如手机、笔记本电脑或者 Docker 容器。主要有两种办法：Basic Auth 和 IP 允许列表。此外还会讲到私有网络放行、HTTPS、Admin Access 以及“保存被拦截”的 CSRF 提示。这里几乎所有设置都写在服务器的 `.env` 文件里，不在应用界面中。

先明确几个贯穿全文的说法：

- `.env` 文件：Marinara Engine 文件夹里的一个纯文本设置文件，和 `package.json` 放在一起。
- 环回（Loopback）：真正运行服务器的那台机器，地址是 `127.0.0.1` 或 `localhost`。
- 远程访问：在运行服务器的那台机器以外的任何设备上打开 Marinara。

## Marinara 默认会拦截什么

为了保护数据，全新安装的 Marinara 在配置好访问控制之前会拒绝其他设备的连接。默认只信任三类客户端：

1. 环回地址（`127.0.0.1` 或 `::1`），也就是运行服务器的这台机器本身。同一台机器上的反向代理或隧道转发过来的访客不算在内，见[同一台电脑上的反向代理和隧道](#reverse-proxies-and-tunnels-on-the-same-computer)。
2. 你 tailnet 里的 Tailscale 设备。Tailscale 是一款私有网络工具，地址落在 `100.64.0.0/10` 段。
3. 同一台主机上的 Docker 客户端。Marinara 认得常见的 `172.16.0.0/12` 网桥段，以及容器里检测到的具体默认网关，因此 Docker Desktop 和自定义地址池也都能覆盖。

其余一律拦截，包括连着同一个 Wi-Fi 的手机和公网客户端，直到你选定下面某个方案为止。被拦截的设备在浏览器里打开 Marinara 会看到一个深色的设置页面，标题写着 **This Marinara Engine install needs access control before remote devices can connect.**，页面上会显示这台设备自己的 IP，还有两段可以直接复制粘贴的 `.env` 配置。

什么都不做、也不设密码的话，Marinara 就一直只对上面三类来源开放。这是最安全的默认状态。

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

## 该选哪个方案

按顺序往下读，读到第一条符合自己情况的就停下。

1. 只通过 Tailscale 连接，或者只从同一台主机上的 Docker 容器连接。什么都不用做，现在就能用。
2. 想在家里 Wi-Fi 下用手机、平板或笔记本电脑访问 Marinara。用 Basic Auth(下面的方案 1)。
3. 要把 Marinara 暴露到公网。用 Basic Auth 加 HTTPS。
4. 客户端设备的 IP 地址固定，而且不想每次输密码。用 IP 允许列表（下面的方案 2）。
5. 整个网络都可信，永远不想要密码。用私有网络放行（下面的方案 3），动手前先看那一节的警告。

Basic Auth 是最灵活的选择：任何 IP 都能用，每台设备都不用单独配置，浏览器还会记住登录信息。

## 方案 1：Basic Auth(推荐)

Basic Auth 就是浏览器先问你要用户名和密码，通过了才放行。开启它只要往 `.env` 里加两行：

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

密码要够强、也别和别处重复。Basic Auth 每次请求都会带上登录信息，所以要像对待其他账号密码一样对待它。可以生成一个随机密码：

```bash
openssl rand -base64 24
```

保存 `.env`。改动几秒内生效，不用重启。然后在远程设备上按下面几步操作。

1. 在浏览器里用服务器的地址打开 Marinara，例如 `http://192.168.1.50:7860`。
2. 浏览器弹出提示时，输入刚才设置的用户名和密码。
3. 应用应该正常加载。本次会话剩下的时间里，浏览器会记住这次登录。

如果 15 分钟内输错了 10 个不同的密码，Marinara 会以 **429 Too Many Requests** 拒绝来自该地址的登录，直到这 15 分钟过去。在此之前输对一次密码就会清零计数。主机上的反向代理或隧道转发过来的访客共用一个计数，其中一人登录成功也不会清零。重启服务器同样会清零。之前登录过的浏览器只要输对密码仍然能进，所以别人输错密码不会把你挡在自己常用的设备之外。

浏览器弹出窗口默认显示 **Marinara Engine**，这段文字可以用 `BASIC_AUTH_REALM` 改。

即使开着 Basic Auth，仍有几类客户端不需要输密码：

- 环回地址（`127.0.0.1`、`::1`），所以在服务器本机上永远不用输密码。这台机器上的反向代理或隧道转发过来的访客仍然需要密码。
- `IP_ALLOWLIST` 里的任何地址。注意：一旦设了允许列表，没列进去的地址就全被拦住了（见方案 2）。
- 直连的 Tailscale 流量（`100.64.0.0/10`），除非把它的放行开关关掉。
- Docker 网桥/网关流量，但仅限设置了 `BYPASS_AUTH_DOCKER=true` 时。开着 Basic Auth 时，自动的 Docker 信任是关闭的（见 [Tailscale 与 Docker 放行](#tailscale-and-docker-bypass)）。
- `/api/health` 地址，这样运行状态监控能继续工作。不带密码访问时，它只报告基本状态，不会透露你的本地模型或显卡信息。

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
- 直连的 Tailscale 流量也会跳过这个列表，除非把它的放行开关关掉。Docker 网桥/网关流量只有在设置了 `BYPASS_AUTH_DOCKER=true` 时才会跳过（见 [Tailscale 与 Docker 放行](#tailscale-and-docker-bypass)）。
- 无效条目会被忽略并记进日志，不会让服务器崩溃。
- 就算开着 Basic Auth，允许列表一样严格：列表内的地址跳过密码提示，其余地址依旧以 **403 Forbidden** 拦下，连登录框都不会出现。

允许列表做不到“列表内免密码、其他人输密码登录”这种混合模式。想让其他设备用密码登录，就别设 `IP_ALLOWLIST`，只用 Basic Auth。

不删列表也可以临时停用它，从新 IP 排查问题时很方便。把启用开关设成 false：

```env
IP_ALLOWLIST_ENABLED=false
```

## 方案 3：私有网络放行（免密码）

如果整个网络都可信，比如没有做端口转发的家庭局域网（LAN），那就可以不设密码直接解除封锁：

```env
ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true
```

这会恢复到以前那种“局域网内开放、公网拦截”的行为，只对标准私有地址段生效，例如 `10.0.0.0/8`、`172.16.0.0/12` 和 `192.168.0.0/16`。CGNAT 段 `100.64.0.0/10` 也算在内。CGNAT 是部分网络服务商使用的共享地址系统，Tailscale 用的正是同一段地址。公网地址仍然会被 403 拦下。

警告：这样一来，同一个网络里的任何人都能免密码访问 Marinara。在自己掌控的网络里没问题，但在咖啡馆、机场或宿舍的共享 Wi-Fi 上就不行。拿不准的时候，改用 Basic Auth。

还有一个范围更大的开关 `ALLOW_UNAUTHENTICATED_REMOTE=true`，它允许任何地址免密码访问，公网也包括在内。不要打开这个开关。确实需要公网访问的话，用 Basic Auth 加 HTTPS，或者在前面架一层负责登录的反向代理。

<a id="tailscale-and-docker-bypass"></a>

## Tailscale 与 Docker 放行

有两个开关能让直连的 Tailscale 和 Docker 流量像环回地址一样，同时跳过 IP 允许列表和 Basic Auth。留空即可使用自动检测：

```env
BYPASS_AUTH_TAILSCALE=
BYPASS_AUTH_DOCKER=
```

自动模式只在直连 Tailscale 套接字的两端都使用 tailnet 地址时信任该对端。只有当 Marinara 在容器内运行，而且来源与检测到的容器接口或其确切网关匹配时，才信任 Docker 流量。这样，常见的私有 Tailscale 和同主机 Docker 配置仍能正常工作，同时不会把无关的 CGNAT、局域网、主机网络或代理流量当作已经认证。

自动的 Docker 信任只在既没有设置 Basic Auth、也没有设置 `IP_ALLOWLIST` 时才生效。Docker Desktop、OrbStack 和 rootless Docker 会让每一台打开已发布端口的设备都经过容器的网关，所以 Marinara 分不清你自己的浏览器、一部手机还是网络上的陌生人。一旦设置了密码或允许列表，每个 Docker 客户端都必须通过它，包括主机上的浏览器。只有当你信任每一台能访问到这个已发布端口的设备时，才设置 `BYPASS_AUTH_DOCKER=true`。

如果想对这些客户端执行常规的 Basic Auth 和 IP 允许列表检查，请把相应开关设为 `false`。自动检测不可用时，设为 `true` 可保留旧版的宽泛放行：Tailscale 会信任整个 `100.64.0.0/10`，Docker 还会信任检测到的接口和网关以及旧版 `172.16.0.0/12` 网段。只有在所有匹配对端都可信时才使用这种兼容模式。

例如，如果 tailnet 里有不太可信的对端，请关掉 Tailscale 放行：

```env
BYPASS_AUTH_TAILSCALE=false
```

如果不想让检测到的 Docker 对端跳过认证，请关掉 Docker 放行，并按需把具体客户端加进 `IP_ALLOWLIST`：

```env
BYPASS_AUTH_DOCKER=false
```

Marinara 也可能架在 Docker 网桥或检测到的网关上的反向代理、隧道容器后面。出现转发请求头，例如 `Forwarded`、`X-Forwarded-For`、`X-Real-IP`、`X-Forwarded-Host` 或 `X-Forwarded-Proto`，就说明这个 Docker 对端代表的是另一个客户端，所以 Marinara 默认会照常执行 Basic Auth 和 IP 允许列表检查：

```env
REQUIRE_AUTH_FOR_DOCKER_PROXY=true
```

把它设成 `false` 可以恢复旧的放行行为。只有当所有能连到这个代理的客户端都可信时才这么做，因为经代理转发的客户端会继承 Docker 的免密码待遇。

这些放行第一次让请求通过时，服务器会记一条 `[auth-bypass]` 警告日志。看到这条警告就说明放行确实生效了。

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## 同一台电脑上的反向代理和隧道

运行 Marinara 的那台机器上的反向代理或隧道，例如 nginx、Caddy、Traefik、Cloudflare Tunnel、Tailscale Serve 或 Funnel、ngrok，是从环回地址连接 Marinara 的。Marinara 会根据代理添加的转发请求头识别出这种情况：`Forwarded`、`X-Forwarded-For`、`X-Real-IP`、`X-Forwarded-Host`、`X-Forwarded-Proto`、`CF-Connecting-IP`、`True-Client-IP`、Tailscale 的身份请求头，或者 `Via`。之后它会把每个请求当作真正的远程访客对待：

- Basic Auth 生效，所以要设置 `BASIC_AUTH_USER` 和 `BASIC_AUTH_PASS`。没有设置的话，访客看到的是设置页面。
- `IP_ALLOWLIST` 会拦下转发过来的访客，因为代理隐藏了他们的真实地址。
- 高权限操作需要管理员密钥，只限环回使用的功能仍然不可用。

你自己在这台机器上用 `http://127.0.0.1:7860` 或 `http://localhost:7860` 打开的浏览器，仍然不需要密码。

Caddy、Traefik、Cloudflare Tunnel、Tailscale 和 ngrok 默认会添加转发请求头。nginx 需要在 `location` 块里加上这一行：

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

转发原始连接的工具，例如 `socat` 或 `ssh -R`，不会添加任何请求头，所以它们的流量看起来就像本地流量。不要用它们来公开 Marinara。

如果你的代理在转发之前已经要求每位访客登录，可以让 Marinara 对它的流量跳过自己的检查：

```env
REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false
```

这样一来，访客会获得和主机本身一样的完整权限，包括不用管理员密钥就能执行高权限操作。只有在代理自己的登录保护了所有路由时才这么做。

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
2. 从上面选一个访问方案。家里 Wi-Fi 下用手机的话，Basic Auth 最省事。
3. 找到服务器所在机器的局域网 IP 地址（例如 `192.168.1.50`）。
4. 在手机浏览器里打开 `http://192.168.1.50:7860`。默认端口是 `7860`。
5. 如果配了 Basic Auth，按提示输入用户名和密码。

页面完全打不开，说明多半连不上服务器，检查 `HOST=0.0.0.0` 和 `PORT` 的值。如果收到的是 403，那说明设备能连上，只是还没被放行，回头再看一遍选定的方案。

## 相关指南

- [服务器配置参考](CONFIGURATION.md)：`.env` 设置的完整清单和各种边界情况。
- [Marinara Engine 故障排查](TROUBLESHOOTING.md)：连接报错、移动端访问等问题。
- [常见问题](FAQ.md)：从另一台设备访问 Marinara 的快速上手说明。
