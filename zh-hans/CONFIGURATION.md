# 服务器配置参考

本指南介绍如何用环境变量修改 Marinara Engine 的服务器级设置。环境变量就是写在一个纯文本文件里、由服务器读取的设置项。大多数人从来用不到这一页。完整的变量清单在文末附近。

## 什么时候需要配置 Marinara？

Marinara Engine 开箱即用，不配置也能跑。只有少数几件事才需要看这一页，而且大多和“让多台设备访问同一个服务器”有关。

以下情况可以考虑改配置：

- 让局域网内的其他设备访问服务器（访问控制）。
- 给共用的服务器加上密码或 IP 允许列表。
- 换一个位置存放数据。
- 调高日志级别，方便排查问题。
- 给耗时较长的图像、视频或嵌入任务留出更多时间（超时）。
- 解锁备份、更新这类需要授权的操作，让远程设备也能执行。

其余绝大部分内容，比如 AI 服务商密钥、角色和聊天选项，都在应用里设置，不在这里。要添加 AI 服务商，见[连接 AI 服务商](connections/connecting-to-a-provider.md)。

可选的官方智能体同样在应用里管理。打开 **Agents → Download Agents**(下载智能体) 即可安装或卸载。Marinara 会自动挑选 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 目录中与当前 Engine 大版本对应的分支。

包的生命周期与存放位置：

- **更新：** Marinara 会检查已安装的官方包有没有兼容的新版本，每次下载前都会先确认。选择 **No** 就保留当前版本，之后仍可在 Download Agents 里手动执行 **Update**。全新安装在挑选包之前一直是空的。
- **平台：** 桌面端、Docker 和 Termux 托管的 Android 安装行为完全一致。iOS 和其他浏览器客户端使用各自 Marinara 宿主服务器上已安装的包。
- **持久化：** 包存放在 `DATA_DIR/capability-packages` 下。Docker 卷、自定义数据文件夹、备份和常规更新都会保留它们。
- **离线容错：** 连不上 GitHub 的 HTTPS 出站连接、拒绝了某次更新，或者更新没通过校验时，已有的包都会继续以已安装的版本工作。

### 导入自定义智能体

外部智能体文件、文件夹和自定义仓库默认是锁住的。要放开，打开 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域) 并启用 **Allow custom Agent imports**(允许导入自定义智能体)。和 External Extensions 不同，这道由你自己控制的开关不需要配环境变量。开关打开之前，导入控件一直是灰的。

每次导入都会先展示该智能体请求的权限，然后才存下来。权限必须逐项明确批准；打包的函数和工具选择不会一并导入；生成的 CSS 会经过净化；执行结果的动作也会和已批准的权限集合逐一核对。把开关关掉，外部导入的智能体就不再运行。在 Marinara 里自己创建的智能体，以及通过 **Download Agents** 安装的官方包，不受这道开关影响，照常可用。

### 自定义智能体仓库

自定义仓库默认禁用，因为里面的提示词和工具选择属于未经审核的第三方内容。设置 `ENABLE_CUSTOM_AGENT_REPOS=true`，在 Danger Zone 里启用 **Allow custom Agent imports**，然后打开 **Agents → Download Agents → Custom Sources**(自定义来源) 预览一个公开的 GitHub 仓库。添加来源，以及之后应用任何内容变更，都需要明确确认。同步是手动的，Marinara 不会克隆仓库，也不会在后台轮询。

仓库根目录必须有一个 `agents.json` 数组，格式与可下载智能体包的智能体定义格式相同。一个最简文件长这样：

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

Marinara 只接受 GitHub 仓库根目录的 URL，并且会在显示预览之前校验大小受限的归档文件和其中每一条智能体定义。同步时，远端的提示词、设置和工具取值会覆盖预览里那些由仓库托管的值。连接和插画选择保持本地不变。如果某个智能体在上游消失了，Marinara 会把它保留为普通的本地自定义智能体，只解除仓库关联。移除来源时同样遵循这条“保留本地”的策略。

### 外部扩展

导入外部扩展需要两道彼此独立的授权。先在 `.env` 里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`，再打开 **Settings → Advanced → Danger Zone**，滚动到数据删除控件下方，读完警告，启用 **Allow third-party extension imports**(允许导入第三方扩展)。只有两步都完成，**Settings → Addons**(插件) 下才会出现 **External Extensions** 一节。

环境变量代表服务器管理者给出的许可，Danger Zone 里的开关代表你本人的明确同意。这一节的显示、导入路由、审批路由和两个运行时加载器都会同时校验这两个条件。任何一道关上，外部记录就会停用，正在运行的外部代码也会停下。手动存入的、遗留的、随档案导入的以及来源不明的扩展记录一律按外部处理，所以把文件直接丢进扩展相关文件夹绕不过这两道关。

Professor Mari 起草的扩展不受这个开关限制。它们创建出来就是禁用状态，仍然要批准它确切的代码哈希。

沙箱化的浏览器扩展仍是默认形态。有少数较老的第三方包标记为 **Full page access**(整页访问)，因为它们依赖 Marinara 的 DOM。这种模式会把你批准过的那份代码原样运行在 Marinara 页面内部，能够访问页面内容、浏览器存储、网络 API 和当前的同源会话。只有两道关全部打开后，外部扩展才能使用它，而且还要单独确认一次警告。如果某个扩展留下了视觉或行为上的残留，禁用它并刷新页面。

## .env 文件在哪里

配置写在一个名为 `.env` 的文件里。这是纯文本文件，每行一个设置，形式为 `KEY=value`。以 `#` 开头的行是注释，服务器会忽略。

`.env` 是数据文件，不是 shell 脚本。Marinara 不会执行值里出现的 `$`、`$(...)` 这类命令替换或其他 shell 语法。macOS/Linux 和 Termux 启动脚本在服务器启动前需要读取的那一小部分设置，也遵循同样的“不求值”规则。如果启动脚本的环境里已经提供了某个值，它优先于 `.env` 里的同名条目。

首次启动时 Marinara 会自动建好一个空的 `.env`，不用手动创建。

- 常规安装下，`.env` 位于项目根文件夹。
- 官方 Docker 或 Podman 镜像下，它位于 `/app/data/.env`，和数据在同一个存储卷里。

同一个文件夹里的 `.env.example` 列出了每一项设置及其默认值。要改某项设置，把对应那行从 `.env.example` 复制到 `.env`，再改 `=` 后面的值。

下面是一个改端口并启用密码的 `.env` 示例：

```
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

无论用什么方式启动，服务器都会自己读取 `.env`，直接跑 `pnpm start` 也一样。shell 启动脚本（`start.bat`、`start.sh`、`start-termux.sh`）额外做两件事：设置 `HOST=0.0.0.0` 让其他设备能访问服务器，以及自动打开浏览器。如果只用 `pnpm start`，除非自己设置 `HOST`，服务器只监听本机。

## 重启还是热重载

Marinara 在运行期间会盯着 `.env` 文件。保存修改后，大部分设置约 2 秒内生效，无需重启。每次应用变更，服务器都会写一行以 `[env-watcher]` 开头的日志。

有一小部分底层设置在服务器启动时就固定下来了，改动它们必须完整重启。这些设置是：

- `PORT`、`HOST`
- `SSL_CERT`、`SSL_KEY`
- `DATA_DIR`、`FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`
- `TZ`
- `AUTO_OPEN_BROWSER`、`AUTO_UPDATE_ENABLED`、`AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- 图像、视频、立绘和 ComfyUI 的超时与轮询设置（`IMAGE_GEN_TIMEOUT_MS`、`VIDEO_GEN_TIMEOUT_MS`、`VIDEO_GEN_MAX_RESPONSE_BYTES`、`SPRITE_GENERATION_TIMEOUT_MS`、`SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`、`COMFYUI_GEN_TIMEOUT`，以及四个 `*_VIDEO_POLL_INTERVAL_MS` 设置）

其中任何一项发生变化时，日志会提示需要重启。访问控制类设置和 `BASIC_AUTH_USER`、`BASIC_AUTH_PASS`、`IP_ALLOWLIST`、`ADMIN_SECRET`、`CSRF_TRUSTED_ORIGINS` 这类机密则不需要重启。

## 访问控制

访问控制决定谁可以访问正在运行的服务器。本节是速查表。想看带示例的分步说明，读[远程访问：Basic Auth 与 IP 允许列表](REMOTE_ACCESS.md)。

下面会用到几个术语：

- 环回（loopback）指服务器所在的这台电脑本身，访问地址是 `127.0.0.1` 或 `localhost`。
- CIDR 段是一种简写整块 IP 地址的写法，比如 `192.168.1.0/24`。CIDR 是 Classless Inter-Domain Routing 的缩写。
- RFC 1918 段是家庭和办公网络内部使用的标准私有地址范围，比如 `10.x.x.x` 和 `192.168.x.x`。

默认情况下，只要没设密码，服务器就只接受来自可信来源的连接。可信来源包括环回地址、`IP_ALLOWLIST` 里的任意地址、Tailscale，以及同主机的 Docker 网桥/网关流量。其他所有来访者，包括你家里的普通局域网，都会收到 `403 Forbidden`，直到你选用下面某一种方案。

主要的访问控制设置如下：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `BASIC_AUTH_USER` | 空 | 密码提示框里的用户名。与 `BASIC_AUTH_PASS` 一起设置即可要求登录。 |
| `BASIC_AUTH_PASS` | 空 | 登录提示框里的密码。任一项留空即关闭登录。 |
| `BASIC_AUTH_REALM` | `Marinara Engine` | 浏览器密码框里显示的文字。 |
| `IP_ALLOWLIST` | 空 | 始终放行的 IP 或 CIDR 段，用逗号分隔。环回地址始终放行。 |
| `IP_ALLOWLIST_ENABLED` | `true` | 设为 `false` 可保留列表但暂停生效。 |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | 在没设登录的情况下，恢复私有网络的免密访问。 |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | 允许任意地址免密访问，包括公网。不推荐。 |
| `TRUSTED_PRIVATE_NETWORKS` | 内置默认值 | 替换默认的私有网络段。仍需保留的默认段要自己写进去。 |
| `BYPASS_AUTH_TAILSCALE` | 自动 | 留空时，仅当直连 Tailscale 套接字的两端都是 tailnet 地址才予以信任。设为 `true` 可保留旧版对整个 `100.64.0.0/10` 的放行，设为 `false` 则要求执行正常访问控制。 |
| `BYPASS_AUTH_DOCKER` | 自动 | 留空时，仅信任检测到的容器接口及其确切网关。设为 `true` 可兼容旧版或自定义网络，设为 `false` 则要求执行正常访问控制。 |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | 对经代理转发的 Docker 流量照常执行登录和允许列表检查。只有在确认每一个上游客户端都可信时才设为 `false`。 |
| `TRUSTED_HOSTS` | 空 | Marinara 额外允许响应的公网或反向代理主机名。直连 IP、localhost、`.local`、`.home.arpa` 和单段局域网名称自动生效。 |
| `SSL_CERT` | 空 | TLS 证书文件的路径。与 `SSL_KEY` 一起设置即可直接提供 HTTPS 服务。 |
| `SSL_KEY` | 空 | TLS 私钥文件的路径。 |
| `CSRF_TRUSTED_ORIGINS` | 空 | 额外允许保存修改的浏览器源。用于公网域名或非常规端口。字面值 `null` 会被忽略，不得用于 Android APK；APK 自行认证的登录路由无需全局信任不透明源即可工作。 |

Basic Auth 是 HTTP Basic Authentication 的简称，就是一个简单的用户名密码提示框。它的凭据只做编码、不做加密，所以服务器面向公网时一定要配合 HTTPS 使用。HTTPS 是 HTTP 的安全加密版本。要直接启用，把 `SSL_CERT` 和 `SSL_KEY` 都设上，或者在 Marinara 前面放一个反向代理。

想让其他设备能访问服务器，前提是服务器绑定到一个可达的网络接口。设置 `HOST=0.0.0.0`。shell 启动脚本会替你做这件事，但 `pnpm start` 只绑定环回地址。

手机、平板、Tailscale 节点和其他电脑可以直接用服务器的 IP 地址连接，不必写进 `TRUSTED_HOSTS`。如果你把 Marinara 发布在某个公网或反向代理主机名下，就要把那个名字原样加上，例如 `TRUSTED_HOSTS=chat.example.com`。为兼容起见，已经出现在 `CSRF_TRUSTED_ORIGINS` 或 `CORS_ORIGINS` 里的名称同样会被接受。这项 Host 校验可以防止某个公开网站的 DNS 名称被重新绑定到 Marinara 的环回地址上。

## 存储

存储设置决定本地数据放在哪里。这些数据包括聊天、角色、头像和生成的媒体文件。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | 所有用户数据的根文件夹。Docker 镜像设为 `/app/data`。 |
| `FILE_STORAGE_DIR` | `DATA_DIR` 里的 `storage` 文件夹 | 覆盖文件存储文件夹。 |
| `ENCRYPTION_KEY` | 空 | 用来加密已保存 API 密钥的密钥。用下面的命令生成一个。 |

Marinara 把数据保存为普通的 JSON 文件，备份时便于直接复制和查看。

要生成加密密钥，运行下面这条命令，把结果粘贴到 `ENCRYPTION_KEY`：

```
openssl rand -hex 32
```

想知道每个数据文件夹装了什么，见[数据保存在哪里](data/where-data-is-stored.md)。

## 日志级别

日志控制服务器往控制台打印多少细节。主开关是 `LOG_LEVEL`，低于所选级别的内容一律不显示。

| 级别 | 显示内容 |
| --- | --- |
| `error` | 只显示严重且无法恢复的故障。 |
| `warn` | 错误加上非致命警告。这是默认值。 |
| `info` | 警告加上启动日志和每个请求的日志。 |
| `debug` | 全部内容，包括完整提示词和模型回复。输出量很大。 |

推荐用法：

- 日常使用保持默认的 `warn`。它很安静，只报真正的问题。
- 想看到请求和关键节点又不想刷屏时，用 `info`。
- 需要看清发给模型的确切提示词和回复时，用 `debug`。做好输出量很大的准备。

如果只想看提示词和连接细节，不想被常规请求日志淹没，那就设置一个预设而不是级别：

```
LOG_PRESET=prompt-connections
```

这个预设显示的提示词和模型细节与 `debug` 相同，但会隐藏 `GET /api/chats` 这类重复出现的请求行。如果只想在保持当前级别的前提下让那些常规请求行安静下来，设置下面这项并重启：

```
LOG_DISABLE_REQUEST_LOGGING=true
```

浏览器端的日志是独立的，不受 `LOG_LEVEL` 控制。

## 超时

超时是服务器放弃之前等待一个慢任务的最长时间。图像和视频生成这类媒体任务本来就慢，所以默认超时给得比较宽松。除非变量名另有说明，所有超时值的单位都是毫秒。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000`(5 分钟) | 普通 Conversation(对话模式)、Roleplay(角色扮演) 和 Game 生成的服务商响应头、首个 Token 等待时间以及分块间隔超时，同时也是那些自身没有超时设置的后台生成任务的首字节等待额度（Noodle 时间线刷新、Noodler 回复）。有效范围：`10000`-`3600000`。它不影响智能体、媒体、嵌入或工具的超时。 |
| `AGENT_CALL_TIMEOUT_MS` | `300000`(5 分钟) | 单次智能体 LLM 调用（追踪器、HTML 重排器和其他智能体）的总时长上限，即使响应仍在流式输出也照样计时。本地模型较慢、单次智能体处理超过 5 分钟时可以调高。有效范围：`10000`-`3600000`。Illustrator 至少保留其内置的 30 分钟额度。 |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000`(45 秒) | 把当前 Game 场景转换成动态图像提示词的那次模型调用的总时长上限。本地模型较慢时可以调高。有效范围：`10000`-`3600000`。 |
| `EMBEDDING_TIMEOUT_MS` | `300000`(5 分钟) | 单次嵌入请求允许的时间。本地嵌入服务器较慢时调高会有帮助。 |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000`(30 分钟) | 单次图像生成请求允许的时间。 |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000`(30 分钟) | 单次场景视频生成请求允许的时间，包含本地 ComfyUI 视频工作流。 |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160`(160 MiB) | 服务器接受的场景视频下载大小上限。 |
| `COMFYUI_GEN_TIMEOUT` | `2400`(40 分钟，单位为秒) | 单个 ComfyUI 图像工作流排队之后允许的时间。 |
| `SPRITE_GENERATION_TIMEOUT_MS` | 回退到 `IMAGE_GEN_TIMEOUT_MS` | 单次 AI 立绘生成任务允许的时间。 |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000`(1 分钟) | 单次自定义工具调用允许的时间。 |
| `MAX_TOOL_ROUNDS` | `100` | 模型必须给出最终答案之前最多允许的工具调用轮数。 |

图像、视频、立绘和 ComfyUI 的超时在启动时就固定下来，改动需要重启。聊天生成、智能体、Game 动态图像提示词、嵌入和自定义工具的超时会在下一次请求或下一次智能体运行时生效，无需重启。经过校验的聊天、智能体和 Game 动态图像提示词超时如果填了无效值、零、负数或超出范围的值，会记录一条警告，并安全地退回文档写明的默认值。大体量或高画质任务中途失败时，就调高对应的媒体超时。想进一步了解视频任务，见[场景视频](media/scene-video.md)。

## 授权 API(ADMIN_SECRET)

有些操作具有破坏性或风险较高，所以在常规访问检查之外还要一个额外的密钥，例如备份、清空数据、应用更新和安装主题。

在服务器上给 `ADMIN_SECRET` 设一个长且随机的值：

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

在运行服务器的那台机器上（环回访问），这些操作通常不用密钥也能完成。从其他设备执行时，应用必须把密钥发过去。把同一个值粘贴到应用的 **Settings**(设置) → **Advanced**(高级) → **Admin Access**(管理员访问) 里，之后应用会自动带上它。

相关的授权设置：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ADMIN_SECRET` | 空 | 远程设备执行授权操作时必须提供的共享密钥。 |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | 设为 `true` 时，本机操作也要求提供密钥。 |
| `UPDATES_APPLY_ENABLED` | `false` | 允许在浏览器里应用同一发布通道内的常规更新。在服务器本机的浏览器里主动切换发布通道不受这个开关限制。仅适用于基于 Git 的安装。 |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | 允许远程设备在提供有效密钥的前提下应用更新。 |
| `HAPTICS_ALLOW_REMOTE` | `false` | 允许远程设备在提供有效密钥的前提下执行触感设备操作。 |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | 启用自定义脚本工具。工具来源不可信或是导入来的，就保持关闭。 |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | 在智能体管理器里启用手动的 GitHub 智能体仓库预览与同步。第三方智能体未经审核，导入或更新前都需要明确确认。 |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | 第三方扩展导入的第一道关。你还必须在 Settings → Advanced → Danger Zone 里主动同意。 |
| `IMPORT_ALLOWED_ROOTS` | 空 | 批量导入无需经过文件选择器授权即可读取的文件系统文件夹。 |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456`(256 MiB) | 服务器构建单个 JSON 档案导出文件的大小上限。 |

如果服务器上没设 `ADMIN_SECRET`，那么除本机外，任何设备执行授权操作都会失败。错误提示会让你去设置这个密钥并粘贴到 **Admin Access** 里。

## 本地地址放行开关

默认情况下，发往服务商、图像服务和 webhook 的出站请求不允许访问私有或本地地址。这样可以挡住一类叫 SSRF(服务端请求伪造) 的攻击，也就是诱骗服务器把请求发到内部地址。环回地址的服务商仍然放行，本地模型服务器照常可用。

只打开确实需要的那一个开关，用于访问私有网络里另一台机器上的自建服务。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | 允许 AI 服务商 URL 访问私有或局域网地址。Android 上默认开启。 |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | 允许图像服务商 URL 访问私有或局域网地址。私有的生成图像结果 URL 仍然必须与所配置服务商的源完全一致。 |
| `TTS_LOCAL_URLS_ENABLED` | `false` | 允许语音合成 URL 访问私有或局域网地址。 |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | 允许 DeepLX 翻译 URL 访问私有或局域网地址。 |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | 允许自定义工具的 webhook 访问私有或局域网地址。 |

要连接本地或自建模型，见[连接本地或自托管模型](connections/local-self-hosted.md)。

## 环境变量完整参考

本节按用途分组列出其余设置。前面的表格已经覆盖了访问控制、存储、日志、超时、授权操作和本地地址放行开关。

### 服务器与启动

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PORT` | `7860` | 服务器监听的端口。Android、Docker 和 Termux 上保持同一个值。 |
| `HOST` | `127.0.0.1`(shell 启动脚本里是 `0.0.0.0`) | 要绑定的网络接口。局域网访问用 `0.0.0.0`。 |
| `MARINARA_ANDROID_SECRET` | 空 | APK 管理的 Termux 安装使用的内部本地认证密钥。这不是安装程序的输入项：Android 外壳会生成并传递它，Termux 启动脚本会自动导出。不要要求 APK 用户提供，也不要在普通桌面安装或手动 Termux 安装中设置。设置后必须正好是 64 个十六进制字符。非空值无效时，设备本地请求会收到 HTTP 503，而不会通过削弱认证来继续运行。 |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Termux 启动脚本和本地 `mari` CLI 使用的私密密钥文件路径。APK 和启动脚本会自动管理这个文件；普通 APK 用户无需读取或复制。 |
| `AUTO_OPEN_BROWSER` | `true` | shell 启动脚本是否替你打开应用地址。设为 `false` 即可关闭。APK 管理的设置会在这次启动中关闭浏览器自动打开，让已经认证的 Android 应用连接。 |
| `AUTO_UPDATE_ENABLED` | `true` | 基于 Git 的 Windows、macOS/Linux 和 Termux 启动脚本是否在启动前拉取并应用 Engine 更新。设为 `false` 可长期关闭，下次启动生效。启动脚本仍会只读地检查有没有更新的正式发布版，有的话打印一条下载提醒；手动检查、应用内应用更新、包更新和模型更新都照常可用。加 `--skip-update` 可让本次启动跳过这两项检查。 |
| `MARINARA_ENV_FILE` | 项目根目录的 `.env` | 可选，覆盖 `.env` 文件的路径。要在启动前设置。 |
| `TZ` | 系统默认 | 服务端任务使用的宿主机后备时区。Conversation 日程如果已经在日程控件里保存过全局时区，就用那个时区。不设 `TZ` 即沿用宿主机时区；写成空的 `TZ=` 也等同于未设置。 |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 允许发起跨源请求的浏览器源。 |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | 遗留开关。当前版本不再内置任何入门密钥，所以它什么也不会创建。请在应用里自行添加连接。 |

`AUTO_CREATE_DEFAULT_CONNECTION` 只是为了照顾老安装才保留的。新版本不再附带内置的入门连接，开着它也没有任何作用。要开始聊天，先按[连接 AI 服务商](connections/connecting-to-a-provider.md)添加一个连接。

Conversation 的日程控件默认使用浏览器或应用所在设备报告的时区。**Schedule timezone**(日程时区) 可以在 Conversation 的创建流程中、Conversation 的 Chat Settings(聊天设置) 里，或者角色日程编辑器里修改。选定的 IANA 时区是一项全局偏好，所有 Conversation 聊天共用，并会同步到连接同一服务器的其他 Marinara 客户端。

### 媒体与立绘工具

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `FFMPEG_PATH` | 空 | `ffmpeg` 程序的路径，用于生成动态表情 GIF。未设置时回退到 PATH 里的 `ffmpeg`。 |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000`(3 分钟) | 转换单个动态表情片段允许的时间。 |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | 立绘清理引擎。`auto` 先尝试自适应蒙版清理，再走可选的 AI 后备方案；`builtin` 只保留蒙版方案；`backgroundremover` 强制使用 AI 工具。 |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | 设为 `true` 时，启动时安装可选的 AI 背景移除工具。 |
| `BACKGROUNDREMOVER_COMMAND` | 空 | 系统里 `backgroundremover` 程序的路径。 |
| `BACKGROUNDREMOVER_PYTHON` | 空 | 安装了 `backgroundremover` 的 Python 程序路径。 |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000`(10 分钟) | 单次 AI 背景移除调用允许的时间。 |

### 场景视频服务商

场景视频服务商是在应用里作为连接配置的，不用环境变量。下面这些设置只是微调底层任务。所有取值单位都是毫秒。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | 服务器多久查询一次 Google Veo 任务。 |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | 服务器多久查询一次 xAI Imagine 任务。 |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | 服务器多久查询一次 OpenRouter 视频任务。 |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | 服务器多久查询一次 Seedance 任务。 |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | 空 | 本服务器的公网 HTTPS 地址，供必须按 URL 拉取参考图的服务商使用。 |

### 集成与其他

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `DOCS_I18N_BASE_URL` | 官方 `docs-i18n` 分支 | 翻译文档包的下载地址（Settings → General → Documentation Language）。必须是公开的 `https://` 主机；分叉和镜像可以指向自己那份 `docs-i18n` 分支。 |
| `GIPHY_API_KEY` | 空 | 用于 Conversation 模式里 GIF 搜索的 Giphy 密钥。未设置时搜索功能关闭。 |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Intiface 触感应用的默认地址。 |
| `SPOTIFY_REDIRECT_URI` | 由请求推导 | 覆盖 Spotify 登录回调 URL。TLS 由上游处理时需要设置。 |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Professor Mari 读取 wiki 页面内容时截断前的大小上限。 |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Professor Mari 单次 wiki 请求允许的时间。 |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Professor Mari 缓存一次 wiki 读取的时长。 |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false`(Windows 启动脚本会设为 `true`) | 允许在环回访问下不带管理员请求头安装本地模型运行时。 |
| `SSL_CERT` | 空 | TLS 证书的路径。见上面的访问控制一节。 |
| `SSL_KEY` | 空 | TLS 私钥的路径。见上面的访问控制一节。 |

关于 Giphy 密钥，注意在设置 `GIPHY_API_KEY` 并重启之前，GIF 搜索一直不可用。关于内置的本地模型，见[本地模型设置](connections/local-model.md)。

## 相关指南

- [远程访问：Basic Auth 与 IP 允许列表](REMOTE_ACCESS.md)
- [数据保存在哪里](data/where-data-is-stored.md)
- [连接 AI 服务商](connections/connecting-to-a-provider.md)
- [场景视频](media/scene-video.md)
- [Marinara Engine 故障排查](TROUBLESHOOTING.md)
