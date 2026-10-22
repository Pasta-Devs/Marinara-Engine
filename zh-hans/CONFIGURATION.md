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
- **磁盘占用：** Marinara 会为每个包保留当前版本和上一个版本，这样更新失败时还能回滚。更旧的版本和 `DATA_DIR/capability-runtime-snapshots` 里的临时副本会自动删除。包数据永远不会被删除。
- **离线容错：** 连不上 GitHub 的 HTTPS 出站连接、拒绝了某次更新，或者更新没通过校验时，已有的包都会继续以已安装的版本工作。

### 导入自定义智能体

自定义智能体可以在 Context Sources(上下文来源) 中启用 **Previous output**(上次输出)，读取可见消息历史中自己最近一次成功的输出。使用 **JSON context output**(JSON 上下文输出) 时，返回 `{"text":"main prompt content","agent-context":"private continuation context"}`。只有 `text` 会加入主提示词；可选的 `agent-context` 字段留给同一个智能体下次运行使用。**Hide output as spoilers**(将输出折叠为剧透) 会把已保存的输出折叠起来，直到你展开查看。重新生成会排除正在替换的轮次，已删除的消息和未选中的备选回复都不能提供后续运行的上下文。

外部智能体文件、文件夹和自定义仓库默认是锁住的。要放开，打开 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域) 并启用 **Allow custom Agent imports**(允许导入自定义智能体)。和 External Extensions 不同，这道由你自己控制的开关不需要配环境变量。开关打开之前，导入控件一直是灰的。

每次导入都会先展示该智能体请求的权限，然后才存下来。权限必须逐项明确批准；打包的函数和工具选择不会一并导入；生成的 CSS 会经过净化；执行结果的动作也会和已批准的权限集合逐一核对。把开关关掉，外部导入的智能体就不再运行。在 Marinara 里自己创建的智能体，以及通过 **Download Agents** 安装的官方包，不受这道开关影响，照常可用。

### 自定义智能体仓库

自定义仓库默认禁用，因为里面的提示词和工具选择属于未经审核的第三方内容。设置 `ENABLE_CUSTOM_AGENT_REPOS=true`，在 Danger Zone 里启用 **Allow custom Agent imports**，然后打开 **Agents → Download Agents → Custom Sources**(自定义来源) 预览一个公开的 GitHub 仓库。添加来源，以及之后应用任何内容变更，都需要明确确认。同步是手动的，Marinara 不会克隆仓库，也不会在后台轮询。

仓库可以发布智能体、Game Mode 规则集，或两者都发布，但至少要有其中一种。

仓库根目录可以放一个 `agents.json` 数组，格式与可下载智能体包的智能体定义相同。最小的文件长这样：

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

仓库根目录还可以有一个 `rulesets` 文件夹，每个 `.json` 文件放一个 Game Mode 规则集，最多 32 个文件，每个不超过 512 KB。只读取直接放在 `rulesets` 里的文件，子文件夹里的内容一律忽略。预览中会列出每个规则集的名称、版本和覆盖范围。规则集的 Game Master 文本会在每个使用它的游戏中发送给模型，所以只安装你信任的人发布的规则集。

导入的规则集以仓库所有者命名，例如 `alice/my-5e`，因此它永远不会占用官方规则集的名称，两位作者也都可以发布名为 `v20` 的规则集。每个导入的版本都会保留，游戏始终使用创建时的那个确切版本。如果同一版本再次传来但内容不同，Marinara 会保留已安装的那份，并提示你请作者提高版本号。Marinara 读不了的文件会列出原因并跳过，仓库里的其余内容照常安装。

Marinara 只接受 GitHub 仓库根地址，并会在显示预览之前校验有大小上限的压缩包以及每一条智能体定义。同步时，远程的提示词、设置和工具值会替换预览中显示的那些由仓库管理的值。连接和图片的选择保留在本地。如果某个智能体在上游消失，Marinara 会把它保留为普通的本地自定义智能体，只移除它的仓库关联。删除来源也遵循同样的保留在本地策略，它提供的规则集仍保持安装，固定使用这些规则集的游戏可以继续运行。

### 外部扩展

导入外部扩展需要两道彼此独立的授权。先在 `.env` 里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`，再打开 **Settings → Advanced → Danger Zone**，滚动到数据删除控件下方，读完警告，启用 **Allow third-party extension imports**(允许导入第三方扩展)。只有两步都完成，**Settings → Addons**(插件) 下才会出现 **External Extensions** 一节。

环境变量代表服务器管理者给出的许可，Danger Zone 里的开关代表你本人的明确同意。这一节的显示、导入路由、审批路由和两个运行时加载器都会同时校验这两个条件。任何一道关上，外部记录就会停用，正在运行的外部代码也会停下。手动存入的、遗留的、随档案导入的以及来源不明的扩展记录一律按外部处理，所以把文件直接丢进扩展相关文件夹绕不过这两道关。

Professor Mari 起草的扩展不受这个开关限制。它们创建出来就是禁用状态，仍然要批准它确切的代码哈希。

沙箱化的浏览器扩展仍是默认形态。有少数较老的第三方包标记为 **Full page access**(整页访问)，因为它们依赖 Marinara 的 DOM。这种模式会把你批准过的那份代码原样运行在 Marinara 页面内部，能够访问页面内容、浏览器存储、网络 API 和当前的同源会话。只有两道关全部打开后，外部扩展才能使用它，而且还要单独确认一次警告。如果某个扩展留下了视觉或行为上的残留，禁用它并刷新页面。

<a id="optional-multiplayer"></a>

## 可选多人模式

多人模式默认关闭。两个启用条件中只要有一个关闭，就不会在后台检查会话、证书或对端；除非你明确刷新 Settings，客户端只读取一次可用性。它支持 Conversation、Roleplay 和 Game 的私人房间，没有固定的人类或 AI 角色数量上限。每位访客使用自己信任的 Marinara 安装；手机可以使用其所有者信任的 Engine 服务器。访客不需要 AI 连接。房主提供 AI 连接，并能阅读和保留共享内容。

1. 在每个参与的 Engine 的 `.env` 中设置 `MULTIPLAYER_ENABLED=true`，然后重启。只有精确值 `true` 才启用此前提条件；热重载不会更改它。
2. 打开 **Settings → Advanced → Multiplayer**(设置 → 高级 → 多人模式)，阅读警告并启用独立设置。这不会启动监听或加入房间。
3. 创建房间时，在现有模式/设置流程中使用 **Create shared session**(创建共享会话) 或 **Play together**(一起游玩)。检查设置、显示名称以及即将分享的完整 persona 文本。已有聊天只提供设置选项，不会复制其私有记录、笔记或记忆。
4. 在房主端配置 `SSL_CERT` 和 `SSL_KEY`，使用对房间主机名有效且受访客 Engine 信任的证书。选择独立的 HTTPS 房间地址和端口，例如 `https://room.example.org:7861`。明确执行主持操作后才会开放端口。防火墙/路由器只应转发房间监听端口，不要公开普通 Engine API。系统不会自动配置端口转发、中继账户或证书绕过。
5. 设置至少 12 个字符的房间密码，且不同于 Engine/管理员凭据。将会过期的邀请和密码分别发给可信的人。访客在自己的客户端检查与主机名绑定的指纹、房间名和 persona 文本，同意后申请加入。房主必须在 **Players**(玩家) 中批准每个申请，之后才发送任何房间记录。

TLS 验证证书链和主机名，并在发送密码前检查邀请中的证书指纹。不会默默接受自签名证书。证书续期或变更后，需要新邀请并重新检查。邀请在 30 分钟后过期；已获准的会话最长持续 12 小时。替换/撤销邀请可阻止未使用邀请接纳新人；Kick 会撤销已获准参与者的权限。

房主控制自动/手动回复、有上限的生成额度、Pause/Resume 和 Stop。默认每次主持会话允许 100 个协调生成回合；群组回合或 Game 设置可能调用模型多次。这是回合限制，不是价格估算。Conversation 日程使用房主现有的调度器。访客不会运行第二个调度器，也不会从收到的文本执行本地命令。

在 Game 中，Start Game 前请检查已获准的人类队伍。每个必需的玩家都要提交行动或跳过。所有人就绪后 GM 才结算。断线玩家仍是必需成员，直到其返回或房主明确让其跳过/将其移除。新玩家和 persona 变更从下一轮生效。暂停/中断的结算绝不会自动重复付费请求或已经提交的世界效果；继续前请检查记录。

Stop、Leave、关闭 Settings 和重启服务器都会结束相应的活动会话。重启不会自动主持或加入。房间由房主服务器拥有，关闭房主浏览器不会把控制权交给访客。移动浏览器休眠可能延迟更新，但不会导致第二次生成。

只连接可信的人。使用自己信任的 Marinara 客户端，绝不要安装房主提供的客户端、扩展或所谓必需文件。房主可以阅读、保留你分享的内容，并将其发送给所配置的 AI 服务商。直接连接会暴露网络地址。不要分享密码、API 密钥或敏感个人信息。发现可疑情况请立即退出。

共享内容仅限有大小上限的文本。不支持对端文件/媒体传输、可执行内容、包导入、远程资源加载或原生操作。自定义/包工具和不安全命令在房间中仍不可用。Android 原生封装不能加入。具体限制与已测试平台见[兼容性与验证记录](development/multiplayer.md)；这些控制不保证能抵御所有浏览器/操作系统漏洞或独立的外部下载。

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

无论用什么方式启动，服务器都会自己读取 `.env`，直接跑 `pnpm start` 也一样。shell 启动脚本（`start.bat`、`start.sh`、`start-termux.sh`）额外做两件事：设置 `HOST=0.0.0.0` 让其他设备能访问服务器，以及在服务器就绪后打开浏览器。打开浏览器没有固定延时：启动缓慢或修复构建时会等待初始化完成；启动失败则不会打开新标签页。`AUTO_OPEN_BROWSER=false` 仍可关闭自动打开。如果只用 `pnpm start`，除非自己设置 `HOST`，服务器只监听本机。

<a id="restart-or-hot-reload"></a>

## 重启还是热重载

Marinara 在运行期间会盯着 `.env` 文件。保存修改后，大部分设置几乎立即生效，无需重启。每次应用变更，服务器都会写一行以 `[env-watcher]` 开头的日志。如果你的文件系统无法设置文件监视，服务器会退回到每 30 秒检查一次文件，并在日志里说明。

有一点要注意：在某些环境下，监视能正常启动，但变更事件始终收不到。典型情况是文件从*另一台机器或另一个环境*里编辑，比如通过网络共享，或从宿主机编辑容器的绑定挂载。如果你对 `.env` 的修改没有被读到，设置 `MARINARA_ENV_WATCH=poll`，让服务器改为每 30 秒检查一次文件，这样每次写入都能看到。要完全关闭监视，设置 `MARINARA_ENV_WATCH=0`(写在 shell 环境里，或在启动前写进 `.env` 本身)，之后的修改就需要重启才能生效。这两项都是高级选项；访问控制的修改正是靠热重载才能不停机生效，所以除非有明确理由，请保持默认值。

有一小部分底层设置在服务器启动时就固定下来了，改动它们必须完整重启。这些设置是：

- `PORT`、`HOST`
- `SSL_CERT`、`SSL_KEY`
- `DATA_DIR`、`FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`、`MARINARA_ENV_WATCH`
- `TZ`
- `AUTO_OPEN_BROWSER`、`AUTO_UPDATE_ENABLED`、`AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`, `SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- 图像、视频、立绘和 ComfyUI 的超时与轮询设置（`IMAGE_GEN_TIMEOUT_MS`、`IMAGE_GEN_MAX_RESPONSE_BYTES`、`VIDEO_GEN_TIMEOUT_MS`、`VIDEO_GEN_MAX_RESPONSE_BYTES`、`SPRITE_GENERATION_TIMEOUT_MS`、`SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`、`COMFYUI_GEN_TIMEOUT`，以及四个 `*_VIDEO_POLL_INTERVAL_MS` 设置）

其中任何一项发生变化时，日志会提示需要重启。访问控制类设置和 `BASIC_AUTH_USER`、`BASIC_AUTH_PASS`、`IP_ALLOWLIST`、`ADMIN_SECRET`、`CSRF_TRUSTED_ORIGINS` 这类机密则不需要重启。

## 访问控制

访问控制决定谁可以访问正在运行的服务器。本节是速查表。想看带示例的分步说明，读[远程访问：登录与 IP 允许列表](REMOTE_ACCESS.md)。

也可以不用 `.env` 来设置登录：在已经登录的浏览器里，到任意设备的 **Settings** → **Advanced** → **Access** 设置，或者使用服务器日志里的一次性设置码。要修改或移除登录，Marinara 会要求输入当前密码。只有在没有设置登录、且服务器监听范围超出环回地址（例如 `HOST=0.0.0.0` 或 Docker）时，服务器才会在日志里打印这个设置码。这份登录保存在 `DATA_DIR/.remote-login.json` 里；`pnpm reset-login` 会删除它，并让每个浏览器退出登录。`.env` 里的登录优先于它。登录代理使用 `TRUSTED_AUTH_PROXY`，见[登录代理（转发认证）](REMOTE_ACCESS.md#login-proxies-forward-auth)。

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
| `IP_ALLOWLIST` | 空 | 始终放行的 IP 或 CIDR 段，用逗号分隔。直连的环回地址始终放行；同一台机器上的反向代理则不会。 |
| `IP_ALLOWLIST_ENABLED` | `true` | 设为 `false` 可保留列表但暂停生效。 |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | 在没设登录的情况下，恢复私有网络的免密访问。`100.64.0.0/10` 段（运营商级 NAT）不包含在内，因为网络服务商会让互不相关的用户共用这一段；只有在你信任它时，才把它加入 `TRUSTED_PRIVATE_NETWORKS`（它会替换默认范围，所以请保留你的局域网范围）。 |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | 允许任意地址免密访问，包括公网。不推荐。 |
| `TRUSTED_PRIVATE_NETWORKS` | 内置默认值 | 替换默认的私有网络段。仍需保留的默认段要自己写进去。 |
| `BYPASS_AUTH_TAILSCALE` | 自动 | 留空时，只有设备直连这台电脑的 Tailscale 地址，才可以跳过登录。经 Tailscale Serve、Funnel 或其他代理的连接仍然需要登录。设为 `true` 可保留旧版对整个 `100.64.0.0/10` 的放行，设为 `false` 则要求执行正常访问控制。 |
| `BYPASS_AUTH_DOCKER` | 自动 | 留空时，仅信任检测到的容器接口及其确切网关，而且只在没有设置登录（`.env` 或应用内）、`IP_ALLOWLIST` 或有效的 `TRUSTED_AUTH_PROXY` 时才信任。设为 `true` 可兼容旧版或自定义网络，设为 `false` 则要求执行正常访问控制。 |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | 对代理转发的 Docker 流量（带转发请求头、Host 指向另一台计算机或使用 HTTP/1.0）照常执行登录和允许列表检查。只有在代理本身要求每位访客登录时才设为 `false`。 |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | 把同一台机器上的反向代理或隧道转发过来的请求当作远程访客处理，包括 nginx 默认 `proxy_pass` 这类 HTTP/1.0 请求。只有在代理本身要求每位访客登录时才设为 `false`。 |
| `TRUSTED_AUTH_PROXY` | 空 | 转发认证代理（tinyauth、Authelia、Authentik、oauth2-proxy）的 IP 或 CIDR 段，这类代理会让每位访客先登录。来自这些地址的请求会跳过登录和 `IP_ALLOWLIST`；转发请求头从不算数。代理必须保护每条路径，而且 Marinara 不能被绕过代理访问到。见[登录代理（转发认证）](REMOTE_ACCESS.md#login-proxies-forward-auth)。 |
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
| `MARINARA_MAX_RESIDENT_CHATS` | `0`(无限制)；SteamOS/Termux 上为 `8` | 限制服务器同时保留在内存里的聊天数量。聊天在第一次打开时载入内存；超过上限后，每次保存之后会把最久未使用、且没有未保存改动的那个聊天从内存中移出（不会从磁盘删除）。在 Termux(Android) 和 SteamOS(Steam Deck) 上，服务器默认设为 `8`：手机内存有限，而在 Deck 上，游戏会占用大部分共享内存。设置一个有效的非负整数即可覆盖平台默认值；无效文本会记录警告并退回该默认值；小于 `2` 的正数会被抬高到 `2`；显式设为 `0` 会关闭这项清理（不设置则只在没有内存限制的平台上关闭）。 |
| `MARINARA_EAGER_STORAGE` | 关闭 | 设为 `1` 可在启动时把每一个聊天都载入内存，恢复 2.4.5 之前的行为。在体量大的档案上会占用多得多的内存；改动需要重启才生效。 |

Marinara 把数据保存为普通的 JSON 文件，备份时便于直接复制和查看。

要生成加密密钥，运行下面这条命令，把结果粘贴到 `ENCRYPTION_KEY`：

```
openssl rand -hex 32
```

想知道每个数据文件夹装了什么，见[数据保存在哪里](data/where-data-is-stored.md)。

<a id="logging-levels"></a>

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

打开 **Settings → Advanced → Request timeouts**(设置 → 高级 → 请求超时)，即可按秒调整文本、智能体、Game 图像提示词、图像、视频、ComfyUI 和嵌入的时限。提高时限能让较慢的本地后端有足够时间完成任务，但不能突破服务商自身强制执行的限制。保存需要服务器管理权限。

这些设置对所有档案生效，保存在当前 `.env` 旁边的 `.env.timeouts.json` 里（或 `<custom-env-path>.timeouts.json`）。它们会覆盖对应的环境变量，而不会改写你的 `.env`。文本、智能体、Game 图像提示词和嵌入的修改对新请求生效。媒体相关的修改和已安装的智能体包需要重启服务器。要改回用环境变量配置，删除这个超时设置文件并重启服务器。

超时是服务器放弃之前等待一个慢任务的最长时间。图像和视频生成这类媒体任务本来就慢，所以默认超时给得比较宽松。除非变量名另有说明，所有超时值的单位都是毫秒。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000`(5 分钟) | 普通 Conversation(对话模式)、Roleplay(角色扮演) 和 Game 生成的服务商响应头、首个 Token 等待时间以及分块间隔超时，同时也是那些自身没有超时设置的后台生成任务的首个 Token 等待和分块间隔额度（Professor Mari、Noodle 时间线刷新、Slurp 回复）。有效范围：`10000`-`3600000`。它不影响智能体、媒体、嵌入或工具的超时。 |
| `AGENT_CALL_TIMEOUT_MS` | `300000`(5 分钟) | 单次智能体 LLM 调用（追踪器、HTML 重排器和其他智能体）的总时长上限，即使响应仍在流式输出也照样计时。本地模型较慢、单次智能体处理超过 5 分钟时可以调高。有效范围：`10000`-`3600000`。Illustrator 至少保留其内置的 30 分钟额度。 |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000`(45 秒) | 把当前 Game 场景转换成动态图像提示词的那次模型调用的总时长上限。本地模型较慢时可以调高。有效范围：`10000`-`3600000`。 |
| `EMBEDDING_TIMEOUT_MS` | `300000`(5 分钟) | 单次嵌入请求允许的时间。本地嵌入服务器较慢时调高会有帮助。 |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000`(30 分钟) | 单次图像生成请求允许的时间。 |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280`(30 MiB) | 服务器接受的图像服务商响应的最大大小。本地 ComfyUI 在文件里嵌入大量元数据时，请调大它。 |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000`(30 分钟) | 单次场景视频生成请求允许的时间，包含本地 ComfyUI 视频工作流。 |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160`(160 MiB) | 服务器接受的场景视频下载大小上限。 |
| `COMFYUI_GEN_TIMEOUT` | `2400`(40 分钟，单位为秒) | 单个 ComfyUI 图像工作流排队之后允许的时间。 |
| `SPRITE_GENERATION_TIMEOUT_MS` | 回退到 `IMAGE_GEN_TIMEOUT_MS` | 单次 AI 立绘生成任务允许的时间。 |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000`(1 分钟) | 单次自定义工具调用允许的时间。 |
| `MAX_TOOL_ROUNDS` | `100` | 模型必须给出最终答案之前最多允许的工具调用轮数。Game Mode 的一个回合最多 4 轮，智能体最多 16 轮，世界书回填最多 64 轮；此值更低时以此值为准。 |

图像、视频、立绘和 ComfyUI 的超时在启动时就固定下来，改动需要重启。聊天生成、智能体、Game 动态图像提示词、嵌入和自定义工具的超时会在下一次请求或下一次智能体运行时生效，无需重启。经过校验的聊天、智能体和 Game 动态图像提示词超时如果填了无效值、零、负数或超出范围的值，会记录一条警告，并安全地退回文档写明的默认值。大体量或高画质任务中途失败时，就调高对应的媒体超时。想进一步了解视频任务，见[场景视频](media/scene-video.md)。

## 授权 API(ADMIN_SECRET)

有些操作具有破坏性或风险较高，所以在常规访问检查之外还要一个额外的密钥，例如备份、清空数据、应用更新和安装主题。

在服务器上给 `ADMIN_SECRET` 设一个长且随机的值：

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

在运行服务器的那台机器上（环回访问），这些操作通常不用密钥也能完成。默认情况下，这台机器上的反向代理或隧道转发过来的请求算作远程请求。如果你有意设置了 `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`，这些转发请求会被当作本地请求，环回免密钥的规则也同样适用于它们。公开的代理或隧道请保留这道防护。从其他设备直接发出的请求仍然需要密钥。把同一个值粘贴到应用的 **Settings**(设置) → **Advanced**(高级) → **Admin Access**(管理员访问) 里，之后应用会自动带上它。

相关的授权设置：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ADMIN_SECRET` | 空 | 远程设备执行授权操作时必须提供的共享密钥。 |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | 设为 `true` 时，本机操作也要求提供密钥。 |
| `UPDATES_APPLY_ENABLED` | `false` | 允许在浏览器里应用同一发布通道内的常规更新。在服务器本机的浏览器里主动切换发布通道不受这个开关限制。仅适用于基于 Git 的安装。 |
| `UPDATES_APPLY_DISABLED` | 未设置 | 硬性拒绝在服务端应用更新：拦下每一次应用操作，包括环回的发布通道切换，并且优先级高于 `UPDATES_APPLY_ENABLED`。dev 和 e2e 启动脚本会设上它，这样浏览器标签页永远不可能改写开发用的仓库。 |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | 允许远程设备在提供有效密钥的前提下应用更新。 |
| `HAPTICS_ALLOW_REMOTE` | `false` | 允许远程设备在提供有效密钥的前提下执行触感设备操作。 |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | 启用自定义脚本工具。工具来源不可信或是导入来的，就保持关闭。 |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | 允许 Professor Mari 的数据库转换脚本在没有操作系统沙箱的主机上运行（沙箱指 macOS Seatbelt 或 Linux Bubblewrap，存在时会自动使用）。除非你亲自审查过脚本，否则保持关闭。 |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | 在智能体管理器里启用手动的 GitHub 智能体仓库预览与同步。第三方智能体未经审核，导入或更新前都需要明确确认。 |
| `MARINARA_OVERWORLD_GAMES` | `false` | 允许玩家创建 Overworld 游戏（一套设定包加一个生成的世界），并把旧版游戏转换成 Overworld 游戏。关闭时，向导只提供 Classic 游戏。 |
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
| `STT_LOCAL_URLS_ENABLED` | `false` | 允许语音识别（Speech to Text）服务器 URL 访问私有或局域网地址。与 Marinara 在同一台机器上的服务器不开这个开关也能用。 |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | 允许 DeepLX 翻译 URL 访问私有或局域网地址。 |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | 允许自定义工具的 webhook 访问私有或局域网地址。 |

要连接本地或自建模型，见[连接本地或自托管模型](connections/local-self-hosted.md)。

<a id="feature-switches"></a>

## 功能开关

重试失败的服务商调用、固定世界书组选择等可选服务器行为，可在 **Settings > Advanced > Features**(设置 > 高级 > 功能) 中开启，默认全部关闭。部分开关对应环境变量；只要设置了变量，就优先于开关。每个开关及其默认值、变量详见[功能开关](configuration/features.md)。

<a id="marinara-notices"></a>

## Marinara 通知

Marinara 通知是 Marinara 维护者发出的简短警告，例如安全问题，或你的版本需要手动完成的步骤。当某条通知适用于你的版本时，Marinara 会以横幅形式显示给你。

工作方式：

- 启动时以及之后每小时，服务器会从 GitHub 上 Marinara Engine 仓库的 `notices` 分支下载一个小文件 `notices.json`。
- 服务器只保留指明你的版本的通知。你的浏览器会在页面加载时向你自己的服务器请求一次通知，之后每小时请求一次。
- 如果下载失败，服务器会保留已有的通知，启动也不会被延迟。如果该文件已被删除，就不会显示任何通知。

为什么安全：

- 这个请求就是一次普通的文件下载。它不会发送任何关于你、你的聊天或你的设置的数据。
- `notices` 分支受到保护。只有维护者能修改它，每次修改都需要审查。
- 文件会被严格检查。通知只是纯文本，并有大小限制。只有指向 `https://github.com/Pasta-Devs/` 的链接才会保留。
- 只有你能看到通知：在运行 Marinara 的电脑上、从 `IP_ALLOWLIST` 中的地址访问，或用你的登录账号登录之后。其他访问者得到的是空列表。
- 通知不能安装、运行或更改任何东西，它只显示文字。

要关闭通知，请设置 `MARINARA_NOTICES_ENABLED=false`。**警告：** 这样 Marinara 就无法告知你针对你的版本的安全修复或必需步骤。请自己关注 [GitHub 发布页](https://github.com/Pasta-Devs/Marinara-Engine/releases)。Fork 可以让 `MARINARA_NOTICES_URL` 指向自己的文件。

## 环境变量完整参考

本节按用途分组列出其余设置。前面的表格已经覆盖了访问控制、存储、日志、超时、授权操作和本地地址放行开关。

### 服务器与启动

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PORT` | `7860` | 服务器监听的端口。Android、Docker 和 Termux 上保持同一个值。 |
| `HOST` | `127.0.0.1`(shell 启动脚本里是 `0.0.0.0`) | 要绑定的网络接口。局域网访问用 `0.0.0.0`。 |
| `MARINARA_ANDROID_SECRET` | 空 | APK 管理的 Termux 安装使用的内部本地认证密钥。这不是安装程序的输入项：Android 外壳会生成并传递它，Termux 启动脚本会自动导出。不要要求 APK 用户提供，也不要在普通桌面安装或手动 Termux 安装中设置。设置后必须正好是 64 个十六进制字符。非空值无效时，设备本地请求会收到 HTTP 503，而不会通过削弱认证来继续运行。 |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Termux 启动脚本和本地 `mari` CLI 使用的私密密钥文件路径。APK 和启动脚本会自动管理这个文件；普通 APK 用户无需读取或复制。 |
| `AUTO_OPEN_BROWSER` | `true` | 控制 shell 启动脚本是否自动打开应用 URL。设为 `false` 即可关闭。APK 管理的安装会关闭 shell 的浏览器自动打开功能。APK 会单独处理记住的应用或浏览器选择以及认证。 |
| `AUTO_UPDATE_ENABLED` | `true` | 基于 Git 的 Windows、macOS/Linux 和 Termux 启动脚本是否在启动前拉取并应用 Engine 更新。设为 `false` 可长期关闭，下次启动生效。启动脚本仍会只读地检查有没有更新的正式发布版，有的话打印一条下载提醒；手动检查、应用内应用更新、包更新和模型更新都照常可用。加 `--skip-update` 可让本次启动跳过这两项检查。 |
| `MARINARA_NOTICES_ENABLED` | `true` | 服务器是否从 GitHub 获取维护者通知。参见 [Marinara 通知](#marinara-notices)。设为 `false` 可停止这些请求。**警告：** 这样 Marinara 就无法告知你针对你的版本的安全修复，你需要自己关注 GitHub 发布页。 |
| `MARINARA_NOTICES_URL` | `notices` 分支上的 `notices.json` | 覆盖通知文件，用于 fork 和镜像。该文件的验证方式相同，指向 `https://github.com/Pasta-Devs/` 之外的链接会被丢弃。 |
| `MARINARA_ENV_FILE` | 项目根目录的 `.env` | 可选，覆盖 `.env` 文件的路径。要在启动前设置。 |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | 整个进程范围内同时进行的图像/视频服务商请求上限，覆盖所有入口（图库、故事板、游戏素材、立绘、头像）。本地 GPU 性能强劲或服务商限额宽松时可以调高；本地 ComfyUI/SwarmUI 在批量任务中显存不足时，降到 1-2；`0` 完全取消这个上限。无效值会被忽略，并记录一条警告。批量或自动任务永远不会占用最后一个名额，所以始终会给交互式请求留出一个。这个上限叠加在 **Queue media generation requests**(媒体生成请求排队) 之上（位于 **Settings → Generations → Overall Generations**(设置 → 生成 → 总体生成)，默认开启），后者会为每个服务商账户分别排队图像任务和视频任务。 |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000` | 生成请求等待空闲并发名额的最长时间，超时后以明确的错误失败，而不是一直挂起（默认 10 分钟；`0` 表示一直等待）。 |
| `MARINARA_ENV_WATCH` | `1` | 服务器监视 `.env` 实时变更的方式。默认：使用变更事件（约 250 ms 防抖后应用），无法设置监视时自动退回到每 30 秒检查一次文件。`poll` 始终使用 30 秒检查（适用于网络挂载，或从外部编辑的绑定挂载）。`0` 关闭监视，之后的修改需要重启。见[重启还是热重载](#restart-or-hot-reload)。 |
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

<a id="lorebooks"></a>

### 世界书

两项设置默认关闭，在 `.env` 变更后的下一次生成生效。`LOREBOOK_STABLE_GROUP_WINNERS` 固定 Settings > Advanced > Features 中的 **Stable lorebook picks**：设置了变量就以变量为准，未设置则由开关决定（见[功能开关](configuration/features.md)）。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | 只要匹配候选不变，就在每个聊天中保留同一个世界书包含组胜出条目，而不是每次生成重新抽选。这能稳定提示词前缀，便于服务商缓存提示词。 |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | 只在聊天中最新的助手或叙述者消息保存激活条目的完整文本（该行及其 swipes；模拟用户的回合不会替代它）。旧消息保留条目 ID、键和评分，让大型世界书聊天在磁盘和内存中更小。若删除新消息，Active Context 和智能体重试会为再次成为最新的消息显示条目当前保存的文本。 |

`scripts/compact-lorebook-scans.mjs` 将同样规则应用于启用设置前保存的聊天。先停止服务器；未传入 `--apply` 时只是试运行，写入前会备份两个消息表。

<a id="robustness"></a>

### 稳健性

这里的设置默认全部关闭，保持原有行为，并且互相独立。`STORAGE_CACHE_WINDOWS_BOOT_ID`、`SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` 和 `SHUTDOWN_FORCE_EXIT_ON_REPEAT` 在启动时读取，需重启；其他项在 `.env` 变更后的下一次请求、保存或停止时生效。`PROVIDER_RETRY_TRANSIENT_ERRORS` 固定 Settings > Advanced > Features 中的 **Retry failed provider calls**：变量已设置就优先，否则由开关决定（见[功能开关](configuration/features.md)）。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | 连接被拒绝或不可达、网关 502/503 时，短暂随机等待后最多重试两次（最多等 5 秒，即使网关要求更久），且只在任何文本到达前重试。504 和中断连接绝不重试。有 fallback 时立即尝试 fallback，不使用此机制。连接超时也算不可达，因此缓慢失败的主机可能让错误晚约 20 秒显示。 |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | 如果聊天文件或 `manifest.json` 的内容与本服务器上次写入相同，且磁盘文件未变，则跳过重写。刚从 `.bak` 恢复的文件始终重写。 |
| `STORAGE_YIELDING_SERIALIZE` | `false` | 将大型聊天文件的保存准备拆成短时间片，避免保存很长的聊天时暂停其他请求和流。写入字节保持一致。 |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | 仅 Windows。将存储锁每次启动执行的系统启动时间检查（约 1.5 至 2 秒 PowerShell）保存在 `DATA_DIR` 下的 `.writer-boot-id.json`，直到下次系统重启。 |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | 仅 Windows。Ctrl+Break 和关闭控制台窗口也会正常停止服务器并写入待保存内容，而非立即终止。关闭控制台采用较短期限，以适应 Windows 允许的约 5 秒。 |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | 首次按 Ctrl+C（或 Ctrl+Break）超过 1.5 秒后再次按下会立即终止服务器，尚未写入的保存可能丢失。未启用时忽略重复信号，适用正常的 8 秒关闭期限。 |
| `SHUTDOWN_EARLY_FLUSH` | `false` | 收到停止信号（Ctrl+C、SIGTERM）后立即写入待保存内容，此时连接可能仍在关闭。Advanced Settings 的重启不使用此机制。 |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | 停止信号等待后台运行时（能力包、扩展、辅助进程）多久后仍然关闭存储。Advanced Settings 的重启继续等待全部结束。`0` 与以前一样等待全部。最大 `2500`，确保在 8 秒关闭期限内关闭存储。 |

### 集成与其他

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | **Claude (Subscription)** 连接是否改用这台电脑上安装的 Claude Code，前提是它的版本不低于 Marinara 自带的那份。Android 上没有自带的版本，因此会使用已安装的任意 Claude Code，这一项需要保持开启。设为 `false` 则始终使用自带的版本。5 分钟内生效，无需重启。 |
| `DOCS_I18N_BASE_URL` | 官方 `docs-i18n` 分支 | 文档和界面语言包的下载来源。界面语言包位于 `ui/` 子树中。必须使用公开的 `https://` 主机；fork 和镜像可以指向自己的 `docs-i18n` 分支副本。 |
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

<a id="outbound-http-proxy"></a>

### 出站 HTTP 代理

有些网络只能通过 HTTP 代理访问互联网，例如未开启 TUN 模式的 v2rayN。Marinara 可以通过这个代理发送它对 AI 服务商、图像服务、嵌入服务器和智能体目录的请求。在启动 Marinara 的环境里或 `.env` 中设置下面这些变量，然后重启 Marinara。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | 未设置 | 设为 `1` 才会使用下面的代理。不设置时，Marinara 会像 Node.js 一样忽略代理设置，所以只为其他工具设置的代理不会产生任何影响。 |
| `HTTP_PROXY` | 空 | 代理地址，例如 `http://127.0.0.1:10809`。没有设置 `HTTPS_PROXY` 时，所有请求都走这个代理。 |
| `HTTPS_PROXY` | 空 | 用于 `https://` 地址的代理，在它与 `HTTP_PROXY` 不同时设置。 |
| `NO_PROXY` | 空 | 不走代理的主机，用逗号分隔。局域网里的模型服务器加在这里。`localhost`、`127.0.0.1` 和 `::1` 始终不走代理，所以本地模型照常可用。 |

## 相关指南

- [功能开关](configuration/features.md)
- [远程访问：登录与 IP 允许列表](REMOTE_ACCESS.md)
- [数据保存在哪里](data/where-data-is-stored.md)
- [连接 AI 服务商](connections/connecting-to-a-provider.md)
- [场景视频](media/scene-video.md)
- [Marinara Engine 故障排查](TROUBLESHOOTING.md)
