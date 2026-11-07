# 服务器配置参考

本指南列出可以用环境变量修改的服务器设置。环境变量就是服务器从一个名为 `.env` 的纯文本文件里读取的设置项。Marinara 不做任何配置也能用。大多数人只在这几种情况下才需要配置：让其他设备连上来、保护共用的服务器、搬动数据文件夹、调高日志级别，或者给慢任务留出更多时间。

AI 账号、角色和聊天选项都在应用里设置。要添加 AI 账号，见[连接 AI 服务商](connections/connecting-to-a-provider.md)。

<a id="edit-the-env-file"></a>

## 编辑 .env 文件

Marinara 首次启动时会建好一个空的 `.env`。每行写成 `KEY=value`。以 `#` 开头的行是注释。

| 安装方式 | `.env` 所在位置 |
| --- | --- |
| 常规安装 | 项目根文件夹 |
| 官方 Docker 或 Podman 镜像 | `/app/data/.env`，和数据在同一个存储卷里 |

1. 打开同一个文件夹里的 `.env.example`。它列出了每一项设置及其默认值。
2. 把你要改的那行复制到 `.env`。
3. 修改 `=` 后面的值，然后保存文件。

```text
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

`.env` 是数据文件，不是 shell 脚本。Marinara 不会执行值里的 `$`、`$(...)` 或其他 shell 语法。如果启动脚本的环境里已经设置了某个值，它优先于 `.env` 里的同名条目。

无论用什么方式启动，服务器都会读取 `.env`。启动脚本（`start.bat`、`start.sh`、`start-termux.sh`）还会设置 `HOST=0.0.0.0`，让其他设备能连上来，并在服务器就绪后打开浏览器。`AUTO_OPEN_BROWSER=false` 可以关掉自动打开浏览器。如果只用 `pnpm start`，除非你设置了 `HOST`，服务器只监听这台电脑。

<a id="restart-or-hot-reload"></a>

## 重启还是热重载

Marinara 运行期间会监视 `.env`。大部分设置几乎立即生效，无需重启。每次变更，日志里都会出现一行 `[env-watcher]`。如果监视无法启动，服务器会改为每 30 秒检查一次文件，并在日志里说明。

如果修改没有被读到，比如从另一台机器编辑，或者编辑的是容器的绑定挂载，就设置 `MARINARA_ENV_WATCH=poll`。要关闭监视，设置 `MARINARA_ENV_WATCH=0`。这两项都是高级选项。

下面这些设置只在启动时读取。改动其中任何一项都需要重启，日志也会提醒你：

- `PORT`、`HOST`、`SSL_CERT`、`SSL_KEY`
- `DATA_DIR`、`FILE_STORAGE_DIR`、`ENCRYPTION_KEY`、`MARINARA_EAGER_STORAGE`
- `MARINARA_ENV_FILE`、`MARINARA_ENV_WATCH`、`TZ`
- `AUTO_OPEN_BROWSER`、`AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`、`LOG_FORMAT`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`、`SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`、`SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- 图像、视频、立绘和 ComfyUI 的超时与轮询设置：`IMAGE_GEN_TIMEOUT_MS`、`IMAGE_GEN_MAX_RESPONSE_BYTES`、`VIDEO_GEN_TIMEOUT_MS`、`VIDEO_GEN_MAX_RESPONSE_BYTES`、`SPRITE_GENERATION_TIMEOUT_MS`、`SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`、`COMFYUI_GEN_TIMEOUT`，以及四个 `*_VIDEO_POLL_INTERVAL_MS` 设置

启动脚本会在服务器启动前读取 `AUTO_UPDATE_ENABLED`，所以改动从下次启动起生效，日志不会对此发出提醒。

访问控制设置和机密（`BASIC_AUTH_USER`、`BASIC_AUTH_PASS`、`IP_ALLOWLIST`、`ADMIN_SECRET`、`CSRF_TRUSTED_ORIGINS`）不需要重启。

<a id="access-control"></a>

## 访问控制

访问控制决定谁可以访问正在运行的服务器。分步说明和示例见[远程访问：登录与 IP 允许列表](REMOTE_ACCESS.md)。

也可以不用 `.env` 来设置登录：在已经登录的浏览器里打开 **Settings → Advanced → Access**(设置 → 高级 → 访问)，或者使用服务器日志里的一次性设置码。只有在没有设置登录、且服务器监听范围超出环回地址时，服务器才会打印这个设置码。登录保存在 `DATA_DIR/.remote-login.json` 里。在 Marinara 文件夹里运行 `node scripts/reset-login.mjs` 会删除它，并让每个浏览器退出登录。`.env` 里的登录优先。修改或移除登录需要输入当前密码。登录代理见[登录代理（转发认证）](REMOTE_ACCESS.md#login-proxies-forward-auth)。

下面会用到几个术语：

- **环回**（loopback）：运行服务器的那台电脑，地址是 `127.0.0.1` 或 `localhost`。
- **CIDR 段**：一种简写整块 IP 地址的写法，比如 `192.168.1.0/24`。
- **Basic Auth**：随每次请求发送的用户名和密码。脚本和 API 客户端使用它，浏览器则使用 `/login` 页面。它只做编码、不做加密，所以公网服务器上要配合 HTTPS 使用。

没有设置登录时，服务器只接受可信来源：环回地址、`IP_ALLOWLIST` 里的地址、Tailscale，以及同主机的 Docker 网桥流量。其他所有来访者，包括你家里的局域网，都会收到 `403 Forbidden`。要让其他设备能连上来，服务器首先必须绑定到一个可达的地址：设置 `HOST=0.0.0.0`。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `BASIC_AUTH_USER` | 空 | 登录用户名。与 `BASIC_AUTH_PASS` 一起设置。 |
| `BASIC_AUTH_PASS` | 空 | 登录密码。任一项留空即关闭登录。 |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Basic Auth 质询里的 realm 名称。 |
| `IP_ALLOWLIST` | 空 | 始终放行的 IP 或 CIDR 段，用逗号分隔。直连的环回地址始终放行。同一台机器上的反向代理则不会。 |
| `IP_ALLOWLIST_ENABLED` | `true` | 设为 `false` 可保留列表但不再执行。 |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | 在没有设置登录时，允许私有网络免密访问。不包括 `100.64.0.0/10`，这一段由互联网服务商在不同用户之间共用。只有在你信任它时，才把它加入 `TRUSTED_PRIVATE_NETWORKS`。 |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | 允许任意地址免密访问，包括公网。不推荐。 |
| `TRUSTED_PRIVATE_NETWORKS` | 内置范围 | 替换默认的私有网络段。仍想保留的默认段要自己写进去。 |
| `BYPASS_AUTH_TAILSCALE` | 自动 | 留空：只有设备直连这台电脑的 Tailscale 地址时，才跳过登录。经 Tailscale Serve、Funnel 或其他代理的连接仍然需要登录。`true`：旧版行为，放行整个 `100.64.0.0/10`。`false`：执行正常访问控制。 |
| `BYPASS_AUTH_DOCKER` | 自动 | 留空：只信任检测到的容器接口及其网关，而且只在没有设置登录、`IP_ALLOWLIST` 或 `TRUSTED_AUTH_PROXY` 时才信任。`true`：用于旧版或自定义网络。`false`：执行正常访问控制。 |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | 对代理转发的 Docker 流量要求登录或允许列表。只有在代理本身让每位访客登录时，才设为 `false`。 |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | 把同一台机器上的代理或隧道转发过来的请求当作远程请求处理，包括 nginx 默认 `proxy_pass` 这类 HTTP/1.0 请求。只有在代理本身让每位访客登录时，才设为 `false`。 |
| `TRUSTED_AUTH_PROXY` | 空 | 让每位访客登录的转发认证代理（tinyauth、Authelia、Authentik、oauth2-proxy）的 IP 或 CIDR 段。来自它的请求会跳过登录和 `IP_ALLOWLIST`。它必须保护每一条路径，而且 Marinara 不能被绕过它访问到。 |
| `TRUSTED_HOSTS` | 空 | Marinara 额外响应的公网或代理主机名，例如 `chat.example.com`。直连 IP、`localhost`、`.local`、`.home.arpa` 和单段局域网名称不用写进来也能用。`CSRF_TRUSTED_ORIGINS` 或 `CORS_ORIGINS` 里的名称同样会被接受。 |
| `SSL_CERT` | 空 | TLS 证书的路径。与 `SSL_KEY` 一起设置，即可直接提供 HTTPS 服务。 |
| `SSL_KEY` | 空 | TLS 私钥的路径。 |
| `CSRF_TRUSTED_ORIGINS` | 空 | 额外允许保存修改的浏览器源，用于公网域名或非常规端口。字面值 `null` 会被忽略，对 Android APK 也是如此。 |

> **警告：** 在 `IP_ALLOWLIST` 里写 `0.0.0.0/0` 这样的大范围公网地址段，可能让公网客户端不用登录就进来。只列出你信任的地址。

## 存储

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | 所有用户数据的根文件夹。Docker 镜像设为 `/app/data`。 |
| `FILE_STORAGE_DIR` | `DATA_DIR` 里的 `storage` | 覆盖文件存储文件夹。 |
| `ENCRYPTION_KEY` | 空 | 用来加密已保存 API 密钥的密钥。 |
| `MARINARA_MAX_RESIDENT_CHATS` | `0`(无限制)；SteamOS 和 Termux 上为 `8` | 同时保留在内存里的聊天数量上限。超过上限后，每次保存之后，最久未使用、且没有未保存改动的那个聊天会从内存中移出（不会从磁盘删除）。无效文本会退回平台默认值。小于 `2` 的正数会变成 `2`。设为 `0` 则不再移出聊天。 |
| `MARINARA_EAGER_STORAGE` | 关闭 | 设为 `1` 会在启动时载入每一个聊天，和 2.4.5 之前一样。在体量大的档案上会占用多得多的内存。需要重启。 |

生成一个加密密钥，并把它粘贴到 `ENCRYPTION_KEY`：

```bash
openssl rand -hex 32
```

Marinara 把数据保存为普通的 JSON 文件，所以备份可以直接复制和查看。每个文件夹装了什么，见[数据保存在哪里](data/where-data-is-stored.md)。

<a id="logging-levels"></a>

## 日志级别

`LOG_LEVEL` 决定服务器打印多少内容。低于所选级别的内容一律不显示。

| 级别 | 显示内容 |
| --- | --- |
| `error` | 只显示严重故障。 |
| `warn` | 错误和警告。这是默认值。 |
| `info` | 另外加上启动日志和每个请求的日志。 |
| `debug` | 全部内容，包括完整提示词和模型回复。输出量很大。 |

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LOG_LEVEL` | `warn` | 上面所说的级别。 |
| `LOG_PRESET` | `default` | `prompt-connections` 显示的提示词和模型细节与 `debug` 相同，但会隐藏 `GET /api/chats` 这类常规请求行。 |
| `LOG_DISABLE_REQUEST_LOGGING` | `false` | `true` 会隐藏常规请求行，同时保留你设的级别。需要重启。 |
| `LOG_FORMAT` | 自动 | `pretty` 在任何地方都打印便于阅读的行，例如要在 `docker logs` 里读 **Debug mode**(调试模式) 的提示词时。`json` 每行打印一个 JSON 对象。需要重启。 |

在终端里，服务器打印便于阅读的行。在其他地方，比如 Docker 日志里，生产环境的服务器打印 JSON 行。Termux 启动脚本会要求打印便于阅读的行。浏览器端的日志是独立的，不受 `LOG_LEVEL` 控制。

## 超时

超时是服务器等待一个慢任务的最长时间。打开 **Settings → Advanced → Request timeouts**(设置 → 高级 → 请求超时)，即可按秒修改文本、智能体、Game 图像提示词、图像、视频、ComfyUI 和嵌入的时限。提高时限对较慢的本地后端有帮助，但不能突破服务本身设定的限制。保存需要服务器管理权限。

这些设置对所有档案生效，保存在当前 `.env` 旁边，文件名是 `.env.timeouts.json`(或 `<custom-env-path>.timeouts.json`)。它们会覆盖对应的环境变量，而不用改动 `.env`。文本、智能体、Game 图像提示词和嵌入的修改对新请求生效。媒体相关的修改和已安装的智能体包需要重启。要改回用环境变量，删除这个文件并重启。

除非变量名另有说明，取值单位都是毫秒。经过校验的聊天、智能体和 Game 图像提示词超时如果填了无效值、零、负数或超出范围的值，会记录一条警告并使用默认值。想了解视频任务，见[场景视频](media/scene-video.md)。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000`(5 分钟) | Conversation(对话模式)、Roleplay(角色扮演) 和 Game 回复的首个 Token 等待时间以及分块间隔。也是那些自身没有超时设置的后台任务（Professor Mari、Noodle 刷新、Slurp 回复）的时间额度。范围 `10000`-`3600000`。不影响智能体、媒体、嵌入或工具的超时。 |
| `AGENT_CALL_TIMEOUT_MS` | `300000`(5 分钟) | 单次智能体模型调用开始前或进行中允许的最长无数据时间，也适用于可下载的智能体。收到数据会重新计时。范围 `10000`-`3600000`。Illustrator 至少保留其内置的 30 分钟无数据时限。 |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000`(45 秒) | 把 Game 场景转换成图像提示词的那次模型调用的总时长上限。范围 `10000`-`3600000`。 |
| `EMBEDDING_TIMEOUT_MS` | `300000`(5 分钟) | 单次嵌入请求允许的时间。 |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000`(30 分钟) | 单次图像生成请求允许的时间。 |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280`(30 MiB) | 可接受的最大图像响应。本地 ComfyUI 嵌入大量元数据时调高它。 |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000`(30 分钟) | 单次场景视频请求允许的时间，包括 ComfyUI 视频工作流。 |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160`(160 MiB) | 可接受的最大场景视频下载。 |
| `COMFYUI_GEN_TIMEOUT` | `2400`(40 分钟，单位为秒) | 单个 ComfyUI 图像工作流排队之后允许的时间。 |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` | 单个 AI 立绘任务允许的时间。 |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000`(1 分钟) | 单次自定义工具调用允许的时间。 |
| `MAX_TOOL_ROUNDS` | `100` | 模型必须作答之前最多允许的工具调用轮数。Game 的一个回合最多 4 轮，智能体最多 16 轮，世界书回填最多 64 轮；此值更低时以此值为准。 |

## 高权限 API(ADMIN_SECRET)

备份、清空数据、应用更新和安装主题这类具有破坏性或风险较高的操作，在常规访问检查之外还需要一个额外的密钥。可以在服务器所在的电脑上，到 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问) 里生成一个（见 [Admin Access](REMOTE_ACCESS.md#admin-access-and-privileged-actions)），也可以在服务器上设一个长且随机的值：

```text
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

在服务器所在的电脑上，这些操作通常不用密钥也能完成。这台电脑上的代理或隧道转发过来的请求算作远程请求，除非设置了 `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`。从其他设备直接发出的请求需要密钥。把同一个值粘贴到 **Settings → Advanced → Admin Access**，应用就会替你带上它。`.env` 里的 `ADMIN_SECRET` 优先于在应用里生成的密钥。如果没有管理员密钥，那么除服务器本机外，任何设备执行高权限操作都会失败，错误提示会让你设置一个。已安装的智能体在任何用登录信息登录过的设备上都能使用；安装、更新和移除智能体则需要密钥。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ADMIN_SECRET` | 空 | 远程设备执行高权限操作时使用的密钥。 |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | 设为 `true` 时，服务器本机也要求提供密钥。 |
| `UPDATES_APPLY_ENABLED` | `false` | 允许在浏览器里应用同一发布通道内的更新（**Apply Update**(应用更新)）。在服务器本机的浏览器里切换发布通道不需要它。仅适用于基于 Git 的安装。 |
| `UPDATES_APPLY_DISABLED` | 未设置 | 拒绝所有服务端的更新应用，包括切换发布通道。优先级高于 `UPDATES_APPLY_ENABLED`。dev 和 e2e 启动脚本会设上它。 |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | 允许远程设备在提供有效密钥的前提下应用更新。 |
| `HAPTICS_ALLOW_REMOTE` | `false` | 允许远程设备在提供有效密钥的前提下执行触感设备操作。 |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | 启用自定义脚本工具。工具来源不可信或是导入来的，就保持关闭。 |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | 允许 Professor Mari 的数据库转换脚本在没有操作系统沙箱的主机上运行（沙箱指 macOS Seatbelt 或 Linux Bubblewrap，存在时会自动使用）。除非你审查过脚本，否则保持关闭。 |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | 在 Agent Organizer(智能体管理器) 里启用手动的 GitHub 智能体仓库预览与同步。见[自定义智能体仓库](#custom-agent-repositories)。 |
| `MARINARA_OVERWORLD_GAMES` | `false` | 允许玩家创建 Overworld 游戏（一套设定包加一个生成的世界），并把旧版游戏转换成 Overworld 游戏。关闭时，向导只提供 VN 游戏。 |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | 第三方扩展导入两道关中的第一道。见[外部扩展](#external-extensions)。 |
| `IMPORT_ALLOWED_ROOTS` | 空 | 批量导入无需文件选择器授权即可读取的文件夹。 |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456`(256 MiB) | 服务器构建单个 JSON 档案导出文件的大小上限。 |

## 本地地址放行开关

默认情况下，发往 AI 服务、图像服务和 webhook 的出站请求会拒绝私有或本地地址。这样可以挡住 SSRF(服务端请求伪造)，也就是诱骗请求访问内部地址。环回地址上的模型服务器仍然可用。只打开你需要的那一个开关，用于私有网络里另一台机器上的自建服务。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | 允许 AI 服务的 URL 访问私有或局域网地址。Android 上默认开启。 |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | 允许图像服务的 URL 访问私有或局域网地址。私有的结果 URL 仍然必须与该服务的源完全一致。 |
| `TTS_LOCAL_URLS_ENABLED` | `false` | 允许语音合成 URL 访问私有或局域网地址。 |
| `STT_LOCAL_URLS_ENABLED` | `false` | 允许 Speech to text(语音识别) 服务器 URL 访问私有或局域网地址。同一台机器上的服务器不开这个开关也能用。 |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | 允许 DeepLX 翻译 URL 访问私有或局域网地址。 |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | 允许自定义工具的 webhook 访问私有或局域网地址。 |

要连接本地或自建模型，见[连接本地或自托管模型](connections/local-self-hosted.md)。

<a id="feature-switches"></a>

## 功能开关

重试失败的服务商调用、固定世界书组选择等可选的服务器行为，位于 **Settings → Advanced → Features**(设置 → 高级 → 功能)。它们默认全部关闭。少数开关有对应的环境变量，设置了变量时，变量优先于开关。见[功能开关](configuration/features.md)。

<a id="marinara-notices"></a>

## Marinara 通知

通知是维护者发出的简短警告，例如安全问题，或你的版本需要手动完成的步骤。它们以横幅形式显示。

- 启动时以及之后每小时，服务器会从 Marinara Engine 仓库的 `notices` 分支下载一个小文件 `notices.json`。它只保留指明你的版本的通知。你的浏览器会在页面加载时向你自己的服务器请求一次通知，之后每小时请求一次。
- 如果下载失败，服务器会保留已有的通知，启动也不会被延迟。
- 这个请求不会发送任何关于你、你的聊天或你的设置的数据。只有维护者能修改 `notices` 分支，每次修改都要经过审查。
- 通知只是纯文本，并有大小限制。只有指向 `https://github.com/Pasta-Devs/` 的链接才会保留。通知不能安装、运行或更改任何东西。
- 只有你能看到通知：在服务器所在的电脑上、从 `IP_ALLOWLIST` 中的地址访问，或登录之后。其他访问者得到的是空列表。

要关闭通知，设置 `MARINARA_NOTICES_ENABLED=false`。

> **警告：** 关闭通知后，Marinara 就无法告诉你安全修复或必需的步骤。请自己关注 [GitHub 发布页](https://github.com/Pasta-Devs/Marinara-Engine/releases)。

Fork 可以让 `MARINARA_NOTICES_URL` 指向自己的文件。

为了找到通知服务器，以及开启[出站代理](#outbound-http-proxy)时的那个代理，Marinara 会读取 hosts 文件，并直接向 DNS 服务器查询。只有你的本地网络才能识别的名称都不能用，例如 `.local` 名称，以及除 `localhost` 外不带域名的单段名称。在 Termux 上，DNS 服务器就是 `$PREFIX/etc/resolv.conf` 里列出的那些：除非你修改这个文件，否则就是 Google 的 `8.8.8.8` 和 `8.8.4.4`。

<a id="optional-multiplayer"></a>

## 可选多人模式

多人模式默认关闭。它让多人共享一个私人的 Conversation、Roleplay 或 Game 房间，没有固定的人数上限。每位访客使用自己信任的 Marinara。访客不需要 AI 账号。房主提供 AI 账号，并能阅读和保留共享内容。两道开关中只要有一道关闭，Marinara 就不会在后台检查会话、证书或对端。

1. 在每个参与的 Marinara 的 `.env` 里设置 `MULTIPLAYER_ENABLED=true`，然后重启。只有精确值 `true` 才有效，热重载不会应用它。
2. 打开 **Settings → Advanced → Multiplayer**(设置 → 高级 → 多人模式)，阅读警告并打开这项设置。这不会启动监听，也不会加入房间。
3. 要当房主，在模式或设置流程中使用 **Create shared session**(创建共享会话) 或 **Play together**(一起游玩)。检查设置、你的显示名称以及你要分享的用户角色文本。已有聊天只分享其设置选项，绝不分享聊天记录、笔记或记忆。
4. 在房主端设置 `SSL_CERT` 和 `SSL_KEY`，使用对房间主机名有效且受访客信任的证书。选择独立的 HTTPS 房间地址和端口，例如 `https://room.example.org:7861`。Host 操作会打开这个端口。防火墙或路由器只转发房间端口。不要公开普通的 Marinara API。系统不会替你设置端口转发、中继或证书绕过。
5. 设置至少 12 个字符的房间密码，且不要和管理员凭据相同。把会过期的邀请和密码分别发给你信任的人。访客检查主机名指纹、房间名和用户角色文本，然后申请加入。房主在 **Players**(玩家) 中批准每个申请，之后才会发送任何历史记录。

限制与行为：

- 发送密码之前，TLS 会检查证书链和主机名，以及邀请中的证书指纹。不会默默接受自签名证书。证书续期后需要新的邀请。
- 邀请在 30 分钟后过期。已获准的会话最长持续 12 小时。替换或撤销会让未使用的邀请失效。**Kick**(踢出) 会移除一位已获准的访客。
- 房主控制自动或手动回复、**Pause**(暂停) / **Resume**(继续) 和 **Stop**(停止)。默认每次主持会话允许 100 个协调生成回合。一个群组回合或 Game 设置可能调用模型不止一次。这是回合限制，不是价格估算。
- 在 Game 中，**Start Game**(开始游戏) 之前请检查队伍。每位必需的玩家都要提交行动或跳过，所有人就绪后由游戏主持人（GM）结算。断线的玩家仍是必需成员，直到其返回，或房主替其跳过或将其移除。暂停或中断的轮次绝不会自行重复付费请求或已提交的世界效果。
- **Stop**、**Leave**(离开)、关闭这项设置以及重启服务器，都会结束进行中的会话。重启绝不会自行主持或加入。
- 自定义工具、包工具和不安全命令在房间中仍不可用。访客绝不会运行调度器，也不会根据收到的文本执行本地命令。Conversation 日程使用房主的调度器。
- 新玩家和用户角色的变更从下一轮生效。
- 房间只传输有大小上限的文本。不传输文件、媒体、扩展或包。Android 原生封装不能加入。

> **警告：** 只和你信任的人连接，并使用你自己的 Marinara 客户端。绝不要安装房主提供的客户端、扩展或文件。房主能阅读你分享的内容，共享内容也可能被发送给对方的 AI 服务。直接连接会暴露网络地址。不要分享密码、API 密钥或个人信息。发现任何不对劲，立即退出。

具体限制与已测试平台见[兼容性与验证记录](development/multiplayer.md)。遇到问题见[故障排查](TROUBLESHOOTING.md#multiplayer-connection-or-turn-problems)。

## 智能体与扩展

可选的官方智能体在应用里安装：**Agents → Agent Organizer**(智能体 → 智能体管理器)。Marinara 会挑选 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 中与其大版本对应的目录。

- **更新：** Marinara 下载已安装包的新版本之前会先询问。**Not now**(暂不更新) 会保留当前版本，Agent Organizer 里的 **Update**(更新) 也会一直留着。全新安装没有任何包。
- **包存放位置：** `DATA_DIR/capability-packages`。Docker 卷、自定义数据文件夹、备份和常规升级都会保留它们。桌面端、Docker 和 Termux 都是如此。iOS 和其他浏览器使用其宿主服务器上的包。
- **磁盘占用：** Marinara 为每个包保留当前版本和上一个版本，并删除更旧的版本以及 `DATA_DIR/capability-runtime-snapshots` 里的临时副本。包数据永远不会被删除。
- **离线：** 连不上 GitHub、拒绝了某次更新或校验失败时，已安装的包会继续以当前版本工作。

### 导入自定义智能体

外部智能体文件、文件夹和仓库是锁住的。要放开，在 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域) 里打开 **Allow custom Agent imports**(允许导入自定义智能体)。这不需要环境变量。打开之前，导入控件一直是灰的。

每次导入都会先展示该智能体请求的能力。权限需要明确批准。打包的函数和工具选择不会导入，生成的 CSS 会经过净化，执行结果的动作也会和已批准的能力逐一核对。关掉这道开关，导入的智能体就会停止运行。在 Marinara 里创建的智能体和官方包不受影响。

<a id="custom-agent-repositories"></a>

### 自定义智能体仓库

仓库默认关闭，因为其中的提示词和工具未经审核。设置 `ENABLE_CUSTOM_AGENT_REPOS=true`，打开 **Allow custom Agent imports**，然后打开 **Agents → Agent Organizer → Custom Sources**(智能体 → 智能体管理器 → 自定义来源) 预览一个公开的 GitHub 仓库。添加来源和之后应用变更都需要确认。同步是手动的，Marinara 绝不会在后台克隆或轮询仓库。只接受 GitHub 仓库根地址。

仓库可以发布智能体、Game Mode(游戏模式) 规则集，或两者都发布。在仓库根目录下：

- `agents.json` 是一个数组，格式与可下载智能体相同：

  ```json
  [
    {
      "id": "continuity-helper",
      "name": "Continuity Helper",
      "description": "Checks recent turns for contradictions.",
      "phase": "post_processing",
      "enabledByDefault": false,
      "category": "writer",
      "defaultPromptTemplate": "Check {{messages}} for continuity errors."
    }
  ]
  ```

- `rulesets` 文件夹里每个 `.json` 文件放一个规则集，最多 32 个文件，每个不超过 512 KB。只读取直接放在里面的文件。预览会列出每个规则集的名称、版本和覆盖范围。规则集的 Game Master 文本会在每个使用它的游戏中发送给模型，所以只安装你信任的人发布的规则集。

导入的规则集以仓库所有者命名，例如 `alice/my-5e`，因此永远不会占用官方名称。每个版本都会保留，游戏始终使用开始时的那个确切版本。如果同一版本再次传来但内容不同，Marinara 会保留已安装的那份，并提示你请作者提高版本号。Marinara 读不了的文件会列出原因并跳过。

同步时，远程的提示词、设置和工具值会替换预览中显示的那些由仓库管理的值。你的账号和图片选择保留在本地。如果某个智能体在上游消失，它会作为普通的本地智能体保留下来，只失去仓库关联。删除来源也是一样，它提供的规则集仍保持安装。

自定义智能体还可以在 Context Sources(上下文来源) 下打开 **Previous output**(上次输出)，读取自己最近一次成功的输出。使用 **JSON context output**(JSON 上下文输出) 时，返回 `{"text":"main prompt content","agent-context":"private continuation context"}`。只有 `text` 会进入主提示词。**Hide output as spoilers**(将输出折叠为剧透) 会让已保存的输出保持折叠。重新生成会排除被替换的轮次，已删除的消息和未选中的备选回复都不能提供上下文。

<a id="external-extensions"></a>

### 外部扩展

导入第三方扩展需要两道授权。环境变量代表服务器管理者的许可。Danger Zone 里的开关代表用户的同意。

1. 在 `.env` 里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`。
2. 打开 **Settings → Advanced → Danger Zone**，滚动到数据删除控件下方，读完警告，打开 **Allow third-party extension imports**(允许导入第三方扩展)。

之后，**External Extensions**(外部扩展) 一节会出现在 **Settings → Addons**(设置 → 插件) 下。任何一道关上，外部记录都会停用，其代码也会停止运行。手动存入的、遗留的、随档案导入的以及来源不明的记录一律算作外部记录，所以把文件丢进某个文件夹绕不过这两道关。Professor Mari 起草的扩展两道关都不需要。它们创建出来就是禁用状态，并且需要批准其确切的代码哈希。

沙箱化的浏览器扩展是默认形态。有些较老的包会显示 **Full page access**(整页访问)，因为它们需要 Marinara 的页面。这种模式会把批准过的代码运行在 Marinara 页面内部，能够访问页面内容、浏览器存储、网络 API 和你的会话。它只适用于两道关都打开的 External Extensions，而且还要单独确认一次警告。禁用它之后请刷新页面。

## 环境变量完整参考

前面的表格已经覆盖了访问控制、存储、日志、超时、高权限操作和本地地址放行开关。其余设置都在这里。

### 服务器与启动

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PORT` | `7860` | 服务器监听的端口。Android、Docker 和 Termux 上保持同一个值。 |
| `HOST` | `127.0.0.1`(启动脚本和 Docker 镜像里是 `0.0.0.0`) | 要绑定的网络接口。局域网访问用 `0.0.0.0`。默认的 Compose 文件只把 Docker 端口发布到 `127.0.0.1`。 |
| `MARINARA_ANDROID_SECRET` | 空 | APK 管理的 Termux 安装使用的内部密钥。Android 应用会生成它，Termux 启动脚本会导出它。绝不要让用户去设置。必须正好是 64 个十六进制字符。非空值无效时，设备本地请求会以 HTTP 503 失败。 |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Termux 启动脚本和本地 `mari` 命令使用的密钥文件。由 APK 和启动脚本管理。 |
| `AUTO_OPEN_BROWSER` | `true` | 启动脚本是否打开应用 URL。设为 `false` 即可关闭。APK 管理的安装会关闭它。 |
| `AUTO_UPDATE_ENABLED` | `true` | 基于 Git 的启动脚本是否在启动前拉取并应用更新。设为 `false` 从下次启动起不再自动更新。启动脚本仍会只读地检查有没有更新的正式版本，并打印一条提醒。`--skip-update` 让本次启动跳过这两项检查。 |
| `MARINARA_NOTICES_ENABLED` | `true` | 服务器是否获取维护者通知。见 [Marinara 通知](#marinara-notices)。 |
| `MARINARA_NOTICES_URL` | `notices` 分支上的 `notices.json` | 覆盖通知文件，用于 fork 和镜像。该文件的验证方式相同，指向 `https://github.com/Pasta-Devs/` 之外的链接会被丢弃。该 URL 的主机必须能在 hosts 文件或 DNS 中找到。见 [Marinara 通知](#marinara-notices)。 |
| `MARINARA_ENV_FILE` | 项目根目录的 `.env` | 覆盖 `.env` 文件的路径。要在启动前设置。 |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | 整个服务器同时进行的图像或视频请求上限。本地 ComfyUI 或 SwarmUI 显存不足时，降到 1-2。`0` 取消这个上限。无效值会被忽略，并记录一条警告。批量任务永远不会占用最后一个名额。这个上限叠加在 **Queue media generation requests**(媒体生成请求排队) 之上（位于 **Settings → Generations → Overall Generations**(设置 → 生成 → 总体生成)，默认开启），后者会按账号排队图像和视频任务。 |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000`(10 分钟) | 请求在失败之前等待空闲名额的最长时间。`0` 表示一直等待。 |
| `MARINARA_SHARED_GPU_HOSTS` | 空 | 以逗号分隔的 `host:port` 列表，用于本地模型与本地图像或视频后端共享同一块 GPU 的情况，例如 llama-swap。发往列表中主机的文本和媒体请求会轮流执行，这样图片不会一直排在聊天回复后面。图片或片段最多等待 `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`。嵌入请求不会被阻塞。无需重启，对新请求生效。 |
| `MARINARA_ENV_WATCH` | `1` | `.env` 的监视方式。默认：使用变更事件（约 250 ms 防抖），并以 30 秒检查作为后备。`poll`：始终使用 30 秒检查。`0`：关闭。见[重启还是热重载](#restart-or-hot-reload)。 |
| `TZ` | 系统默认 | 服务器任务使用的宿主机后备时区，例如 `Europe/Warsaw`。不设或留空即使用宿主机时区。对日程而言，已保存的 Conversation **Schedule timezone**(日程时区) 优先。 |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 允许发起跨源请求的浏览器源。 |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | 遗留开关。当前版本不再内置任何入门密钥，所以它什么也不会创建。请在应用里自行添加账号。 |

**Schedule timezone** 默认使用你设备的时区。你可以在 Conversation 的设置流程中、Conversation 的 Chat Settings(聊天设置) 里，或者角色日程编辑器里修改它。它是一项全局设置，所有 Conversation 聊天共用，并会同步到同一服务器上的其他客户端。

### 媒体与立绘工具

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `FFMPEG_PATH` | 空 | `ffmpeg` 的路径，用于生成动态表情 GIF。未设置时回退到 PATH 里的 `ffmpeg`。 |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000`(3 分钟) | 转换单个动态表情片段允许的时间。 |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | `auto` 先尝试内置清理，再用可选的 AI 工具。`builtin` 只用内置清理。`backgroundremover` 强制使用 AI 工具。 |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | 设为 `true` 时，启动时安装可选的 AI 背景移除工具。 |
| `BACKGROUNDREMOVER_COMMAND` | 空 | 系统里 `backgroundremover` 程序的路径。 |
| `BACKGROUNDREMOVER_PYTHON` | 空 | 安装了 `backgroundremover` 的 Python 的路径。 |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000`(10 分钟) | 单次 AI 背景移除调用允许的时间。 |

### 场景视频服务商

视频账号在应用里设置。下面这些设置只用来微调任务。取值单位都是毫秒。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | 服务器多久查询一次 Google Veo 任务。 |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | 多久查询一次 xAI Imagine 任务。 |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | 多久查询一次 OpenRouter 视频任务。 |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | 多久查询一次 Seedance 任务。 |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | 空 | 本服务器的公网 HTTPS 地址，供必须按 URL 拉取参考图的服务使用。 |

<a id="lorebooks"></a>

### 世界书

两项设置默认关闭，在 `.env` 变更后的下一次生成生效。设置了 `LOREBOOK_STABLE_GROUP_WINNERS` 时，它优先于 **Settings → Advanced → Features** 中的 **Stable lorebook picks**(固定世界书选择) 开关。否则由开关决定。见[功能开关](configuration/features.md)。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | 只要候选不变，就在每个聊天中保留同一个包含组胜出条目，而不是每次生成重新抽选。这能让提示词开头保持稳定，便于服务商缓存提示词。 |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | 只在最新的助手或旁白消息上保存激活条目的完整文本。旧消息保留条目 ID、关键词和评分。这能让带大型世界书的聊天小得多。如果删除了较新的消息，Active Context 和智能体重试会为再次成为最新的那条消息显示条目当前的文本。 |

`scripts/compact-lorebook-scans.mjs` 会把同样的规则应用到较早的聊天。先停止服务器。不传入 `--apply` 时它只是试运行，写入前会备份两个消息表。

<a id="robustness"></a>

### 稳健性

这里的设置默认全部关闭，保持原有行为。`STORAGE_CACHE_WINDOWS_BOOT_ID`、`SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` 和 `SHUTDOWN_FORCE_EXIT_ON_REPEAT` 需要重启。其余各项在 `.env` 变更后生效。设置了 `PROVIDER_RETRY_TRANSIENT_ERRORS` 时，它优先于 **Settings → Advanced → Features** 中的 **Retry failed provider calls**(重试失败的服务商调用) 开关。否则由开关决定。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | 连接被拒绝或不可达，或者遇到 502 或 503 时，最多重试两次，每次最多等 5 秒，而且只在任何文本到达你之前重试。504 和中断的连接绝不重试。账号设有后备时不使用此机制，而是立即尝试后备。缓慢失败的主机可能让错误晚约 20 秒才显示。 |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | 如果聊天文件或 `manifest.json` 的内容与本服务器上次写入的相同，且磁盘上的文件未变，保存时就跳过重写。刚从 `.bak` 恢复的文件始终会重写。 |
| `STORAGE_YIELDING_SERIALIZE` | `false` | 把大型聊天文件的保存准备拆成短时间片进行，这样保存很长的聊天时不会让其他请求停顿。写入的字节相同。 |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | 仅限 Windows。把存储锁每次启动都要执行的系统启动时间检查（约 1.5 到 2 秒的 PowerShell）记在 `DATA_DIR` 里的 `.writer-boot-id.json` 中，直到下次重启系统。 |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | 仅限 Windows。<kbd>Ctrl</kbd>+<kbd>Break</kbd> 和关闭控制台也会正常停止服务器，并写入待保存的内容。关闭控制台时期限更短，以适应 Windows 允许的约 5 秒。 |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | 第一次按下后超过 1.5 秒再按 <kbd>Ctrl</kbd>+<kbd>C</kbd> 或 <kbd>Ctrl</kbd>+<kbd>Break</kbd>，会立即终止服务器。尚未写入的保存可能丢失。不开启时，重复按键会被忽略，适用 8 秒的关闭期限。 |
| `SHUTDOWN_EARLY_FLUSH` | `false` | 收到停止信号时就开始写入待保存的内容，此时连接可能仍在关闭。Advanced Settings 里的重启不使用它。 |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | 停止信号在关闭存储之前等待后台运行时（包、扩展、内置模型）的时长。`0` 会等待全部结束。最大 `2500`，确保存储在 8 秒期限内关闭。Advanced Settings 里的重启仍会等待全部结束。 |

### 集成与其他

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | **Claude (Subscription)** 账号是否使用这台电脑上的 Claude Code，前提是它的版本不低于自带的那份。Android 上没有自带的版本，需要保持开启。设为 `false` 则始终使用自带的版本。5 分钟内生效。 |
| `DOCS_I18N_BASE_URL` | 官方 `docs-i18n` 分支 | 文档和界面语言包的下载来源。界面语言包使用其中的 `ui/` 子树。必须是公开的 `https://` 主机。 |
| `GIPHY_API_KEY` | 空 | 用于 Conversation 模式里 GIF 搜索的 Giphy 密钥。设置它并重启之前，搜索一直关闭。 |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Intiface 触感应用的默认地址。 |
| `SPOTIFY_REDIRECT_URI` | 由请求推导 | 覆盖 Spotify 登录回调。TLS 在上游终止时需要设置。 |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Professor Mari 读取 wiki 页面内容时截断前的大小上限。 |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Professor Mari 单次 wiki 请求允许的时间。 |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Professor Mari 缓存一次 wiki 读取的时长。 |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false`(Windows 启动脚本会设为 `true`) | 允许 **Built-in model**(内置模型) 运行时在环回访问下不带管理员请求头安装。 |

**Built-in model** 的用法见[内置模型设置](connections/local-model.md)。

<a id="outbound-http-proxy"></a>

### 出站 HTTP 代理

有些网络只能通过 HTTP 代理访问互联网，例如未开启 TUN 模式的 v2rayN。Marinara 可以通过这个代理发送对 AI 服务、图像服务、嵌入服务器和智能体目录的请求。在启动 Marinara 的环境里或 `.env` 中设置下面这些变量，然后重启。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | 未设置 | 设为 `1` 开启代理。不设置时，Marinara 会像 Node.js 一样忽略代理设置。 |
| `HTTP_PROXY` | 空 | 代理地址，例如 `http://127.0.0.1:10809`。没有设置 `HTTPS_PROXY` 时，所有请求都走这个代理。 |
| `HTTPS_PROXY` | 空 | 用于 `https://` 地址的代理，在它与 `HTTP_PROXY` 不同时设置。 |
| `NO_PROXY` | 空 | 不走代理的主机，用逗号分隔。局域网里的模型服务器加在这里。`localhost`、`127.0.0.1` 和 `::1` 始终不走代理。 |

## 相关指南

- [功能开关](configuration/features.md)
- [远程访问：登录与 IP 允许列表](REMOTE_ACCESS.md)
- [数据保存在哪里](data/where-data-is-stored.md)
- [连接 AI 服务商](connections/connecting-to-a-provider.md)
- [场景视频](media/scene-video.md)
- [Marinara Engine 故障排查](TROUBLESHOOTING.md)
