# Marinara Engine 故障排查

找到和你的症状相符的小节，然后按里面的办法处理。大多数问题只要通过启动脚本（`start.bat`、`start.sh` 或 `start-termux.sh`）重新启动 Marinara 就能解决。

## 先试这几步

1. 强制刷新页面：Windows 或 Linux 上按 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>，Mac 上按 <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>。
2. 看服务器控制台（运行 Marinara 的那个终端窗口）里有没有红色报错行。这些行通常会点明真正的问题。
3. 要求助的话，先打开 **Debug mode**(调试模式)。见[获取更多帮助](#get-more-help)。

<a id="my-character-does-not-reply"></a>

## 角色不回复

按顺序检查下面几项。

1. 留意弹出提示（屏幕底部出现的一条简短消息）。它通常会点明问题。见[连接和生成报错](#connection-and-generation-errors)。
2. 确认聊天有账号和模型：打开 **Chat Settings**(聊天设置)，查看连接。如果没有，就在 **Connections**(连接) 里添加一个账号。见[连接 AI 服务商](connections/connecting-to-a-provider.md)。
3. 确认 API 密钥正确，账号里也还有额度。密钥填错或余额用完是常见原因。
4. 检查模型名称；如果用的是 Ollama 或 LM Studio 这类本地服务器，确认服务器正在运行。
5. 重新发送消息，或者换一个模型。

如果都不管用，打开 **Debug mode**，然后查看服务器控制台。见[获取更多帮助](#get-more-help)。

## 手机或其他设备上打不开应用

用手机、平板或另一台电脑打不开 Marinara？

最常见的是下面三种原因之一：

- **地址。** 服务器默认只监听 `127.0.0.1`(仅限本机)。启动脚本会设置 `HOST=0.0.0.0`。如果是用 `pnpm start` 启动的，先在 `.env` 里设置 `HOST=0.0.0.0`。
- **网络。** 两台设备必须连在同一个 Wi-Fi 网络上，而且不能有防火墙拦住端口。默认端口是 `7860`，或者你设置的 `PORT`。
- **登录。** 给服务器设置一个登录。在被拦住的设备上，输入服务器日志里的一次性设置码，并设一个新的用户名和密码。在 Docker 里，用 `docker logs <container> 2>&1 | grep "setup code"` 找到设置码。也可以在已经登录的浏览器里，到 **Settings → Advanced → Access**(设置 → 高级 → 访问) 里设置。在无头服务器上，运行 `ssh -L 7860:127.0.0.1:7860 user@server`，打开 `http://localhost:7860`，然后使用 **Settings**。见[远程访问](REMOTE_ACCESS.md#option-1-login-recommended)。

更多原因：

- **同一台机器上的代理或隧道。** 同一台机器上的反向代理或隧道需要登录。直连的 Tailscale 流量默认受信任。Tailscale Serve 或 Funnel，以及 nginx 默认的 HTTP/1.0 `proxy_pass`，都算作被转发的访问，需要登录。同主机的 Docker 网桥流量只在没有设置登录、`IP_ALLOWLIST` 或 `TRUSTED_AUTH_PROXY` 时才受信任。
- **本机的自定义名称。** 在 `/etc/hosts` 里映射到 `127.0.0.1` 的名称会被算作被转发的访问。改用 `localhost`、`127.0.0.1`、本机的主机名或某个 `*.localhost` 名称。
- **Too many wrong passwords.** 等 15 分钟再登录。忘了密码？在运行 Marinara 的那台电脑上，在 Marinara 文件夹里运行 `node scripts/reset-login.mjs`。在 Docker 里，运行 `docker exec <container> node scripts/reset-login.mjs`。重启服务器也能让它重新尝试。
- **Untrusted request host.** 如果用的是公网域名或反向代理域名，把它准确的主机名加进 `.env` 的 `TRUSTED_HOSTS`。直连 IP 地址仍然会被接受。
- **在那台设备上执行高风险操作被拦截**（备份、清除数据、更新）。在服务器所在的电脑上打开 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问)，点击 **Make admin secret**(生成管理员密钥)；或者在服务器的 `.env` 里设置 `ADMIN_SECRET`。在另一台设备的 **Admin Access** 里输入这个密钥，然后点击 **Save**(保存)。

见[远程访问](REMOTE_ACCESS.md)和[常见问题](FAQ.md)。如果你在更新后被锁在外面，见[更新后被锁在外面](REMOTE_ACCESS.md#locked-out-after-updating)。

## 保存被拦截，或设置存不住

保存看似成功，重新加载后却又变回原样。这是跨站保护（CSRF）在拦截它，因为它不信任当前这个浏览器地址。你会看到一条红色横幅，提示保存会静默失败；或者看到标题为 **Save blocked: missing CSRF header**、**Save blocked: cross-site request rejected** 或 **Save blocked: origin not trusted** 的弹出提示。

环回地址、私有网络地址、Tailscale 和 Docker 网桥都会自动受信任。这种情况大多出现在通过公网 IP 或域名访问时。把这个地址加进 `.env` 的 `CSRF_TRUSTED_ORIGINS`，多个地址用逗号分隔。横幅上有一个 **Copy**(复制) 按钮，会帮你填好这一行。不需要重启。

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

<a id="connection-and-generation-errors"></a>

## 连接和生成报错

生成报错会以弹出提示的形式出现在屏幕底部。提示会写明原因，停留的时间也足够你复制下来。

| 消息或症状 | 解决办法 |
| --- | --- |
| **No API connection configured for this chat** | 这个聊天没有账号。在 **Connections** 里添加一个，然后给聊天选上。见[连接 AI 服务商](connections/connecting-to-a-provider.md)。 |
| 模型不接受某个参数 | 打开 **Chat Settings → Advanced Parameters**(聊天设置 → 高级参数)，关掉提示里点名的那个参数旁边的开关。 |
| 模型说某个参数是必需的 | 把那个参数的开关打开。 |
| **This model's chat template needs user and assistant messages to take turns** | 有些本地模型，比如在 llama.cpp 上运行的 Mistral 系模型，需要消息轮流交替。Marinara 会合并连续的消息并重试一次。如果问题依旧，在 **Chat Settings → Advanced Parameters** 里把 **Post-Processing Messages**(消息后处理) 设为 **Single User Message**(单条用户消息)，或者改用没那么严格的聊天模板来运行模型。 |
| **The AI returned an empty response. Try sending your message again.** | 重新发送。如果反复出现，换一个模型或账号试试。 |
| **A generation is already in progress for this chat** | 还有一条回复正在流式输出。等它结束，或者点击 **Stop**(停止)，然后再试。 |
| **No connections are marked for the random pool** | 开启了随机路由，但随机池里没有任何账号。添加一个，或者关掉随机路由。 |
| 每条消息都以网络错误失败，而你的电脑只能通过代理上网 | 把这个代理告诉 Marinara。见[出站 HTTP 代理](CONFIGURATION.md#outbound-http-proxy)。 |

## 更新之后

刚更新完就遇到的问题，先用简单的话说：

- 屏幕空白或看起来像旧版：见[白屏、内容不刷新或界面像旧版](#blank-stale-or-old-looking-screen)和[更新后页面空白，或 JavaScript 被当作 HTML 返回](#blank-page-or-javascript-served-as-html-after-an-update)。
- 聊天或预设好像不见了：见[更新之后数据像是丢了](#data-seems-missing-after-an-update)。你的数据几乎总是还在磁盘上。
- 回到旧版本后聊天看起来是空的：见[切换到旧版本后聊天不显示消息](#chats-show-no-messages-after-switching-to-an-older-version)。

<a id="blank-stale-or-old-looking-screen"></a>

### 白屏、内容不刷新或界面像旧版

服务器在运行，浏览器却显示空白页面；或者更新后应用看起来还是旧版。这是因为浏览器还留着网页应用的缓存副本。

1. 强制刷新。
2. 如果没用，打开 **Settings → Advanced → Updates**(设置 → 高级 → 更新)，点击 **Refresh App**(刷新应用)。

**Refresh App** 会清掉浏览器的 service worker(在后台缓存应用的脚本) 和缓存，然后重新加载。它不会改动你的数据，也不会更新服务器。要更新应用本身，见[升级 Marinara Engine](UPGRADING.md)。

<a id="blank-page-or-javascript-served-as-html-after-an-update"></a>

### 更新后页面空白，或 JavaScript 被当作 HTML 返回

出现类型为 `text/html` 的“Failed to load module script”之类的错误，说明浏览器请求了一个构建里缺失的 JavaScript 文件。删除数据解决不了这个问题。

1. 停止服务器。
2. 重新运行 `start.bat`、`start.sh` 或 `start-termux.sh`。启动脚本会在启动前重新构建不完整的客户端文件。如果是手动安装，先在仓库根目录运行 `pnpm build`。
3. 如果页面仍然空白，强制刷新，或者试试无痕窗口。

如果还是失败，报告出错文件的完整 URL、HTTP 状态、Content-Type 和响应第一行，并附上启动脚本的输出。

<a id="data-seems-missing-after-an-update"></a>

### 更新之后数据像是丢了

不要删除任何数据文件夹。Marinara 把正在用的数据放在数据文件夹里的 `storage` 文件夹中。到 `packages/server/data/` 和 `data/` 里找找有没有 `storage`。服务器启动时会打印它解析出的文件夹。

<a id="chats-show-no-messages-after-switching-to-an-older-version"></a>

### 切换到旧版本后聊天不显示消息

新版 Marinara 会把每个聊天的记录（消息、备选回复、记忆、图片）存进各自的文件，这样保存长聊天会更快。旧版本读不了这种布局，所以聊天看起来是空的。数据仍在磁盘上。

Marinara 会拦下明显的降级。启动器会跳过会落到不兼容版本的自动更新，应用内更新器则会显示一条指向这里的错误。

如果你更新之后又回到了旧版本，请恢复更新前做的备份。见[降级到旧版本](UPGRADING.md#downgrading-to-an-older-version)。下面是技术细节。

你的数据现在处于存储格式 10。格式 8、9 和 10 加入了 3D 虚拟形象设置（先是 MMD，之后是 GLB 和 FBX）以及连接的账号关联，旧版构建无法安全读取这些内容。如果你的数据已经达到格式 8 或更新的格式，要使用旧版构建，请恢复那次升级之前做的完整备份。下面的命令只转换旧的聊天文件布局。不要手动修改格式编号。见[降级到旧版本](UPGRADING.md#downgrading-to-an-older-version)。

对于格式 8 以下的数据，按下面的步骤转换聊天文件布局：

1. 停止 Marinara 服务器。
2. 在 Marinara 文件夹里运行：

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. 切换到旧版本并启动它。

这条命令会根据每个聊天各自的文件重建单文件布局。不会删除任何东西。每个聊天的文件会保留在名为 `<table>.post-unshard-<timestamp>` 的文件夹里，已有的 `.pre-shard` 原文件也会保留。以后再次升级时，Marinara 会把数据转换回去。

在 Docker 或 Podman 里，数据存放在 `marinara-data` 卷中。停止容器，运行下面的命令，然后启动旧镜像：

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## 安装和启动问题

### Termux：报错 CANNOT LINK EXECUTABLE "node"

Termux 输出 `CANNOT LINK EXECUTABLE "node"`，并带有 `cannot locate symbol` 或 `library ... not found`。这说明 Node.js 升级了，Termux 的其余部分却没有一起升级。Android 应用随后可能会停下并显示 **Could not verify that this Marinara Android build can safely read your stored data**。问题不在你的数据，重新安装 APK 也解决不了。

1. 在 Termux 里运行：

   ```bash
   pkg upgrade -y
   ```

2. 在 Android 应用里点击 **Install / Start Marinara**。如果是手动安装，运行 `cd "$HOME/Marinara-Engine" && ./start-termux.sh`。

如果升级过程询问是否保留某个配置文件，按 Enter 保留当前的那份。当前的启动脚本和 Android 应用会自动执行这次升级。

### Termux：构建客户端时 JavaScript 堆内存不足

Vite 报 `Reached heap limit` 或 `JavaScript heap out of memory` 后停止。更新后重新运行 `./start-termux.sh`。客户端构建使用独立的 1536 MiB 堆，不超过设备 RAM 的一半，但不会低于 1280 MiB。你在 `NODE_OPTIONS` 里设置的堆上限优先，所以请删掉旧的 1024 MiB 覆盖设置。重试前关闭其他应用。RAM 低于约 3 GB 的手机仍可能耗尽内存。不要为了修复构建失败而删除聊天或档案。

### 桌面端：客户端类型检查时 JavaScript 堆内存不足

构建停止并提示 `The client type-check needs about 2.5 GiB of Node.js heap`。这说明你在 `NODE_OPTIONS` 里设置的上限太小，而构建会沿用你设置的上限。把 `--max-old-space-size` 调到 2560 或更高。如果 `NODE_OPTIONS` 里有 `--max-old-space-size-percentage`，就改为调高它，因为它会覆盖另一个。也可以把这两个选项都删掉。然后重新运行启动脚本。你的数据不受影响。

### Termux：缺少多人模式访客文件

启动时报告缺少 `packages/client/dist/multiplayer/guest.js`。更新 Marinara 并重新运行 `./start-termux.sh`，它会执行完整的客户端构建。不需要开启多人模式。

### Termux：打开 Marinara 时服务器停止，或 Sharp 无法加载

Sharp 是 Marinara 用来处理缩略图和立绘的图像库。在 Android 上，它通过 WebAssembly 备用实现运行。更新 Marinara，让启动脚本重新安装依赖。如果服务器在你来得及更新之前就停止了，在 Termux 里手动修复安装：

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

你的聊天和设置不受影响。如果 Sharp 仍然无法加载，Marinara 会关闭图像处理并继续运行。已有的缩略图照常显示，新的缩略图改用原尺寸图片，立绘生成和内置的背景移除不可用。不要把 Sharp 换成其他版本。报告问题时，保留完整的错误输出。

<a id="browser-opens-before-startup-finishes"></a>

### 启动尚未完成，浏览器就打开了

更新后通过启动脚本重新启动。启动脚本只在服务器报告就绪后才打开浏览器。如果启动失败，就不会打开标签页，所以请保留终端里的报错。要自己打开应用，设置 `AUTO_OPEN_BROWSER=false`。

### Windows：安装 pnpm 时出现 EPERM 或 corepack 签名错误

pnpm 是 Marinara 用来安装自身代码的包管理器。出现 `EPERM: operation not permitted` 或 corepack 签名错误，说明 corepack 写不进 Node 的安装文件夹。任选一种办法，然后重新运行启动脚本：

1. 右键点击终端，选择 **Run as administrator**(以管理员身份运行)，然后运行启动脚本。
2. 自己安装 pnpm：`npm install -g pnpm@12.15.0`
3. 在管理员终端里更新 corepack：`npm install -g corepack`

### pnpm 版本错误，或提示 `'pnpm' is not recognized`

Marinara 使用 pnpm 12.15.0。启动脚本会替你获取正确的版本，不需要先替换旧的全局 pnpm。更新 Marinara；如果启动脚本更新不了，就在 Marinara 文件夹里运行 `git pull`。然后重新运行启动脚本。如果仍然失败，安装这个确切版本，再重新运行启动脚本：

```bash
npm install -g pnpm@12.15.0
```

### Linux：安装过程中出现 ERR_PNPM_ENAMETOOLONG

旧的安装留下了过长的文件夹路径。在 Marinara 文件夹里运行：

```bash
rm -rf node_modules .pnpm .pnpm-store
```

然后重新运行 `./start.sh`。如果是手动安装，运行 `pnpm install`。

### 安装时提示“Ignored build scripts: @google/genai”

这条提示无害。不要运行 `pnpm approve-builds`，因为它会改动一个由 Marinara 跟踪的文件。如果更新后这条提示还一直出现，删掉 Marinara 文件夹里的 `node_modules/.modules.yaml`，然后重新运行启动脚本。

### 安装过程中出现 ERR_PNPM_TRUST_DOWNGRADE

这几乎都是安装没装完造成的。重新运行启动脚本。如果是手动安装，在 Marinara 文件夹里运行：

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## 内置模型相关问题

**Built-in model**(内置模型) 在你的电脑上运行，不需要 API 密钥。有些报错信息把它称作 sidecar。设置方法见[内置模型设置](connections/local-model.md)。

- **Sidecar runtime install is disabled.** 在你自己的电脑上，在 `.env` 里设置 `SIDECAR_RUNTIME_INSTALL_ENABLED=true`。从其他设备操作时，先把管理员密钥保存到 **Settings → Advanced → Admin Access**。
- **从其他设备下载模型或完成设置失败**（网络地址或 Docker）。这可能同样需要管理员密钥。在你自己的电脑上则不需要。
- **大小或 SHA-256 不匹配**：出在内置的 llama.cpp、MLX 或 uv 文件上。Marinara 在使用这个文件之前就已经拒绝了它。更新或重装 Marinara 后重试。不要解包、修改或绕过这个文件。

## 记忆和摘要

### Memory Recall 什么都想不起来

**Memory Recall**(记忆功能) 会检索早先的消息，把最相关的几条加回提示词里。

1. 打开 **Chat Settings → Memory Recall**(聊天设置 → 记忆功能)，确认 **Enable Memory Recall** 已开启。
2. 打开 **Access memories for this chat**。在 **Memories for This Chat** 里查看每个记忆块的状态。
3. **Waiting for vector** 表示这条记忆还在处理。等一会儿，再继续聊。
4. **Embedding unavailable** 表示没有可用的嵌入来源。设置一个嵌入账号，或者等内置模型加载完成。想让所有聊天都用同一个来源，就在 **Connections** 的 **Defaults**(默认值) 区域里，从 **Embeddings**(嵌入) 中选择它。

至少要有 5 条新消息，才会生成一条记忆。召回只给出和你的新消息高度相关的记忆，所以即使存在记忆，也可能什么都不返回。

<a id="advanced-memory-says-scenes-need-attention"></a>

### Advanced Memory 提示有场景需要处理

**Chat Settings** 按钮上出现一个常亮的小圆点，或者弹出通知说 Advanced Memory 发现了问题，就表示有些场景记忆不清楚、已经过时或者缺失。

1. 打开 **Chat Settings → Memory Recall**，或者点击通知里的 **Fix**(修复)。
2. 点击 **Fix**。它会用 Helper model(辅助模型) 修复所有能修的场景，而且绝不会改动你编辑过的摘要。
3. 选中 **need your review**(需要你检查) 下面的每个场景编号，在 **Access memories for this chat** 里核对它的文本和角色，然后点击 **Save correction**(保存修正)。

如果 **Fix** 出错停下了，检查 Helper model 的账号，然后点击 **Resume processing**(继续处理)，或者再点一次 **Fix**。见[修复记忆问题](agents/memory.md#fixing-memory-problems)。

### 摘要生成不出来

摘要需要一个能正常工作的文本账号。

- Roleplay(角色扮演)：打开 **Chat Settings → Chat Summary**(聊天设置 → 聊天摘要)，确认已经设好账号，然后用 **Backfill Summary** 给较早的聊天补齐摘要。
- Conversation(对话模式)：打开 **Automatic Summarization**(自动摘要)，用 **Backfill** 重试失败的日期。
- 如果这个聊天要求智能体写入前先审批，AI 生成的摘要会等你审阅。
- 一直失败的摘要（例如 API 密钥有误）会稍后重试。修好账号，然后用 **Backfill**。

## 可下载智能体的问题

- **Agent Organizer 里提示目录不可用。** 运行服务器的那台电脑（而不只是你的浏览器）必须能通过 HTTPS 访问 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 目录。已安装的智能体离线时也能继续工作。恢复连接后，点击 **Refresh**(刷新) 或 **Try again**(再试一次)。
- **装好的地图或通话没有出现。** 把 Marinara 完全关掉，再重新启动。这些包会一直处于 **Restart required** 状态，直到下一次启动。Conversation 游戏会立即生效。如果安装失败，刷新目录，然后确认游戏显示为就绪。只有想让角色自己发起游戏时，才需要在聊天的 **Commands**(命令) 设置里添加它；用它的斜杠命令手动启动则不需要。
- **首次包迁移无法完成。** 不要删除 `data/capability-packages` 或你的聊天数据。Marinara 会在下次启动时重试，你的聊天选择也会保留。
- **`data/capability-runtime-snapshots` 或 `data/capability-packages/versions` 变得很大。** 不需要清理。Marinara 启动时会删除旧副本，每个智能体只保留当前版本和上一个版本。
- **包下载被拒绝。** 校验和、文件列表、Marinara 版本范围或压缩包内路径与官方目录对不上。更新 Marinara，刷新目录，然后重试。不要手动把产物解压进数据文件夹。
- **更新。** 智能体更新绝不会在启动时自动应用。Marinara 会先询问。**Not now**(暂不更新) 会保留已安装的版本，**Update**(更新) 会一直留在 **Agents → Agent Organizer**(智能体 → 智能体管理器) 里。更新失败时，已安装的版本保持不变。启动自检没通过的服务器运行时会回滚。

## Card Browser 相关问题

**Card Browser**(角色卡浏览器) 用来搜索公开的角色站点。用 **Characters**(角色) 或 **Personas**(用户角色) 面板顶部的 **Download**(下载) 按钮打开它。

- **JannyAI 显示 Cloudflare 拦截。** 用同一个浏览器访问一次 JannyAI 网站，通过验证后再重试。
- **重启后 Pygmalion 登录失效。** 这是正常现象。这个登录只保存在服务器内存里。打开登录窗口，重新粘贴你的 Token。
- **CharacterTavern 显示一条说明，而不是搜索结果。** 这是正常现象。它的新网站不再提供 Marinara 原先使用的连接。从 character-tavern.com 下载角色卡，然后导入这个文件。

## 媒体生成问题

### 立绘抠背景在复杂场景下效果不好

生成的立绘一般使用原生透明通道，或者使用 Marinara 会去掉的纯色背景。拍摄的房间、精细的景物、浓重的阴影，或者与背景相近的颜色，可能需要可选的 AI 兜底方案：

```bash
pnpm backgroundremover:install
```

然后重启 Marinara，在立绘生成窗口里点击 **Reapply Cleanup**。Marinara 会先尝试内置的清理流程，只有边缘看起来不均匀时才动用 AI 模型。如果安装失败：

- 确认装的是 Python 3.9 到 3.11。更新的版本可能会触发很慢的原生编译。
- 运行 `pnpm backgroundremover:reinstall`。
- 排查期间想跳过 AI 兜底，在 `.env` 里设置 `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin`。

### Game Mode 或 Roleplay 的分镜不出现

分镜会把完成的叙述变成关键帧图像和可选的短片。见 [Storyboard 智能体指南](game/storyboard.md)和 [Game Mode：入门](game/getting-started.md)。

- 从 **Agents → Agent Organizer** 安装 **Storyboard**(分镜)，然后为这个聊天开启 **Enable Agents**(启用智能体) 和 **Enable Storyboards**(启用分镜)。
- 关键帧需要图像账号。短片还需要视频账号。
- Game Mode(游戏模式) 自动分镜：打开 **Chat Settings → Agents → Storyboards**(聊天设置 → 智能体 → 分镜)，确认 **Automatic Storyboard Illustrations**(自动分镜插图) 已开启。要短片的话，开启 **Automatic Storyboard Animations**(自动分镜动画)。
- 手动场景视频：打开 **Chat Settings → Gallery**(聊天设置 → 图库)，生成或上传一张图像，然后使用 **Video**(视频) 或 **Animate**。去 **Videos**(视频) 选项卡查看。
- Roleplay：把 **Storyboard** 智能体加进聊天。选择 **Still images** 或 **Animations**，设置 **Messages per episode**，再选好图像账号。**Manual only** 需要从 **Chat Settings** 的 **Gallery** 区域里点击 **Create storyboard**(创建分镜) 来运行。
- 如果自定义提示词在所有角色合并处理时效果更好，关掉 **Use NovelAI Character Prompts**。
- 服务太慢可能会超时。在 `.env` 里调大 `IMAGE_GEN_TIMEOUT_MS` 或 `VIDEO_GEN_TIMEOUT_MS`，然后重启 Marinara。
- `Outbound response exceeded 31457280 bytes`：默认情况下，超过 30 MiB 的图像响应会失败。把工作流和参考图嵌进去的 ComfyUI 文件可能达到这个大小。在 `.env` 里调大 `IMAGE_GEN_MAX_RESPONSE_BYTES` 并重启，或者在 ComfyUI 里关闭元数据。

### Game Mode 世界生成报 JSON 错误

如果模型返回了损坏的 JSON(结构化文本)，Marinara 会打开 **Repair JSON**(修复 JSON) 窗口，而不是丢弃这个回合。

1. 在编辑器里修好括号、逗号或字段。文本能解析时，横幅会显示 **JSON is valid.**
2. 点击 **Format**(格式化) 整理排版。
3. 点击 **Apply Repaired JSON**(应用修复后的 JSON)，不用重新生成回复就能直接使用。

## 语音、通话和 TTS

- **通话中角色不出声。** 语音合成还没设置好。打开 **Connections → Text to Speech**(连接 → 语音合成)，开启它，选择来源，填入密钥，选一个声音，然后保存。没有声音的角色只会以文字显示。
- **语音播放停下并提示“No audio after N s”。** 你的语音服务器比 Marinara 等待的时间更慢，笔记本上的本地服务器经常这样。`N` 是你当前的超时时间。在 **Connections → Text to Speech** 里，或者在消息中点名的音频账号里，调高 **Request timeout (seconds)**(请求超时，单位为秒)。见[请求超时](media/tts-setup.md#request-timeout)。
- **麦克风不工作。** 从 **Agents → Agent Organizer** 安装 **Calls**(通话)。然后打开 **Connections → Speech to text**(连接 → 语音识别)，在 **On this device**(在你的电脑上) 下找到 **Local speech model**(本地语音模型)，选一个 Whisper 模型，然后点击 **Download Whisper**(下载 Whisper)。Firefox 需要这一步，因为它没有浏览器语音识别。卸载 Calls 会删掉它的 Whisper 模型。你也可以使用自己的服务器：见[使用你自己的语音识别服务器](conversation/calls.md#use-your-own-speech-to-text-server)。
- **Local Whisper is disabled in Lite mode.** 精简版镜像跑不了本地语音模型。改用完整安装。

### 远程或局域网安装时 Music DJ 的 Spotify 登录失败

Music DJ 智能体的 Spotify 模式使用 OAuth。这是一种登录交接方式，Spotify 会把你送回一个回调地址（重定向 URI）。Spotify 只接受 `https://` 地址或 `http://127.0.0.1`，普通的网络 IP 地址会被拒绝。

- 通过 localhost 访问时，编辑器显示的是 `127.0.0.1` 回调地址。把它注册到 Spotify。
- 通过 HTTPS 访问时，编辑器显示的是你的 HTTPS 回调地址。注册这一个。
- 如果 HTTPS 在上游终结、主机名对不上，在 `.env` 里把 `SPOTIFY_REDIRECT_URI` 设为你的公网回调地址。
- 在纯 HTTP 的局域网安装上，弹出窗口加载不出来，但它的地址栏里带着有效的授权码。复制完整的 URL，展开 Connect 按钮下方的 **Browser couldn't reach the callback?**，然后粘贴进去。这个 URL 的有效期为 10 分钟。

最干净的办法是让 Marinara 通过 HTTPS 提供服务。

## 存储和数据

### 执行 Restart Server 后服务器没有恢复

请用 `start.bat`、`start-local.bat`、`start.sh`、`start-termux.sh` 或 `pnpm start` 启动 Marinara。这些方式会让服务器挂在启动脚本下，并在旧进程退出后启动替代进程。从应用内重启时，会在 4 秒后关闭仍未结束的连接，8 秒后强制退出。强制退出可能中断待完成的写入。直接用 `node` 运行的进程和开发模式下的文件监视进程不会被替换：请自己停止并重新启动它们。Docker 使用容器的重启策略。在 Windows 上，在启动脚本的控制台里按 <kbd>Ctrl</kbd>+<kbd>C</kbd>，等出现 **Shutdown complete** 后再关闭窗口。

旧服务器还在运行时，不要在同一个数据文件夹上启动第二个服务器。先停止遗留的进程。

### 启动时提示其他进程可能正在使用数据目录

只能有一个服务器写入本地数据文件夹。如果启动时报告 **Another Marinara Engine process ... may be using** 这个文件夹，关闭另一个 Marinara 进程，然后重新启动。

崩溃或移动 Docker 卷之后，启动时可能报告 **The storage writer lease ... is incomplete or invalid**，或者点名一个已经不存在的进程。

1. 确认使用这个数据文件夹的所有 Marinara 进程和容器都已停止。
2. 只删除错误中点名的 `.writer-lease` 文件夹。
3. 重启 Marinara。不要删除 `storage` 文件夹或任何表文件。

数据文件夹位于本地磁盘上时，Marinara 会在 Linux、Android、容器和 Windows 上自行清除崩溃进程遗留的租约。手动步骤是以下情况的后备方案：网络存储或共享存储、可移动驱动器，以及（在 Windows 上）崩溃后改过名的电脑。

### 备份或导出返回 403

同一台电脑上的会话不需要管理员密钥就能备份。来自其他设备、网络地址、Docker，或者同一台电脑上的代理或隧道的请求则需要。在服务器所在的电脑上到 **Settings → Advanced → Admin Access** 里生成它，或者在服务器上设置 `ADMIN_SECRET`，然后在另一台设备的 **Admin Access** 里保存同一个值。要让环回访问也必须提供密钥，设置 `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`。如果设置了 `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`，被转发的访客也会走本地放行。面向公网的代理或隧道请让它保持开启。

### 导入时提示文件不是可读的 ZIP 压缩包

Marinara 把 `.charx` 角色卡、`.marinara` 包、智能体包和自定义智能体仓库都当作 ZIP 压缩包读取。压缩包损坏，或者内容与它的文件列表对不上时，Marinara 会拒绝它，并显示 **The file is not a readable ZIP archive**(或 **Could not read .marinara package**)。最常见的原因是文件没下载完整：重新下载一次。如果压缩包是你自己做的，用系统自带的压缩功能、`zip` 或 7-Zip 重新创建。

**Package contains too many files** 表示智能体包或仓库里的文件超过 8,192 个。**.marinara package has too many entries** 表示 `.marinara` 包里的文件超过 8 个。删掉多余的文件后再试。

### Conversation 日程或 Noodle 用错了时区，或者显示 `Etc/Unknown`

Conversation 日程要在 Conversation 的 Chat Settings 或角色的日程编辑器里选择 **Schedule timezone**(日程时区)。**Use device**(使用设备时区) 可以把它重置。

如果是 Noodle 或其他服务器任务，把 `.env` 里空的 `TZ=` 行删掉，然后重启 Marinara，让它使用主机时区。要指定时区，就用一个 IANA 名称，例如 `TZ=Europe/Warsaw`。

## Android 相关问题

### Android 应用卡在 Connecting 或 Waiting for Server

Android 应用只是套在 Termux 外面的一层轻壳。Termux 是 Android 上的 Linux 终端应用，真正的 Marinara 服务器跑在它里面。

1. 点击 **Install / Start Marinara**。
2. 如果 Android 要求安装 Termux，同意这些提示。
3. 如果 Android 要求在 Termux 里执行命令，授予权限。
4. 等启动脚本把服务器启动起来，再回到应用。

应用会生成私密的 localhost 凭据并自动登录。你永远不需要粘贴密钥。不要把 `null`、`http://null` 或 APK 的密钥添加到 `CSRF_TRUSTED_ORIGINS`。

另外确认应用和 Termux 用的是同一个端口。默认是 `7860`。如果你打包应用时用了其他端口，在 Termux 的 `.env` 里设置相同的 `PORT`。

<a id="android-localhost-opens-the-login-page-or-returns-401503"></a>

### Android localhost 打开登录页面或返回 401/503

由 APK 管理的 Termux 安装会用每次安装独有的私密密钥保护 localhost，应用会自动登录。如果应用里出现了登录页面，请安装[最新 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)，再次点击 **Install / Start Marinara**，等 Termux 完成后再返回应用。

提到来源 `null` 的错误，说明你用的是较旧的 APK 和服务器组合。编辑 `.env` 解决不了。请更新 APK 和 Marinara。

要在同一部手机的浏览器里打开，在 Android 启动界面点击 **Open in browser**(在浏览器中打开)，然后点击 **Retry connection**(重试连接)。服务器重启或会话过期后，也用这种方式重新打开。要回到启动界面，使用 **Settings → General → App Behavior → Open Android launcher (app or browser)**(设置 → 常规 → 应用行为 → 打开 Android 启动界面（应用或浏览器）)。

旧版 APK 在 `/android-login` 用 `cat ~/.marinara-engine/android-secret` 显示的值登录。浏览器链接只能用一次，一分钟后过期，所以请从启动界面重新打开一个。

- **401：** 粘贴的密钥或认证质询被拒绝了。重新加载 `/android-login` 并粘贴当前的值。
- **503：** 服务器收到的密钥格式有误。用 `./start-termux.sh` 重新启动。如果启动脚本提示它的密钥文件无效或为空，在应用里点击 **Install / Start Marinara**，重新生成密钥。

本地的 `mari` 命令会自动读取同一个文件。不要让这个密钥出现在截图和问题报告里。

### Android 更新停在 exit status 134

Android 在构建步骤中耗尽了内存。重新运行启动脚本：

```bash
./start-termux.sh
```

如果还是停下来，关掉其他应用，重新打开 Termux，然后重试。

### Marinara 运行时 Termux 关闭或重启

服务器运行期间，启动脚本会申请唤醒锁，并把每次会话保存到 `~/.marinara-engine/logs/`。意外重启后，请在报告中附上最新的 `server-*.log`。如果日志结尾没有 Marinara 或 Node 的报错，最可能是 Android 或手机厂商终止了 Termux。

请在 Android 设置中允许 Termux 在后台运行，并取消它的电池优化。`termux-wake-lock` 和 `termux-wake-unlock` 随标准 Termux 一起提供。这些设置无法阻止所有厂商特有的进程终止。

### Marinara 停止响应，把 Termux 切到前台才恢复

聊天卡在“正在打开聊天...”，应用报出 **Server unreachable**，Support Diagnostics(支持诊断信息) 复制出来的内容在服务器相关字段上显示 **Unreachable (request timed out)**，而一打开 Termux 一切立刻恢复。这是 Android 的缓存应用冻结器挂起了 Termux 进程。手机仍然会接受连接，但被冻结的服务器永远不会回应。唤醒锁防止不了这种情况。会话日志在被冻结的那段时间里只会留下一段时间戳空档，而不是一条报错。

在 Android 设置中取消 Termux 的电池优化并允许后台活动；如果手机支持，就在最近任务界面里锁定 Termux，并让它的通知一直显示。如果还是会被冻结，在使用 Marinara 期间让 Termux 保持在前台，或者让屏幕保持常亮。

### Android 更新时安装依赖把存储空间占满

更新期间临时占用大，通常来自 pnpm 的依赖存储，尤其是连着更新了好几个版本，或者曾经中断过一次重装之后。当前的启动脚本会清理旧的包，应用内更新也只安装 Android 用的包。如果旧的启动脚本已经把设备塞满了，先腾出空间再重试：

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

不要删除 `data`、`storage` 或 `marinara-engine.db`，因为它们可能存着你的聊天和设置。如果仍然中断，把从 `Installing dependencies` 开始的那些行记录下来，连同手机的剩余空间和内存一起写进报告。

### 在 Android 上切换 Stable 和 Staging 时应用内更新失败

切换发布通道会触发近乎完整的依赖重装，在 Termux 的存储上很慢。应用内更新器会给每一步多留一些时间。如果更新仍然失败，报错会写明失败的是哪一步，并显示那一步输出的末尾。真正的依赖或锁文件错误会出现在那里。你也可以用报错提示里的命令在 Termux 里手动更新，或者先腾出空间：

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Docker 相关问题

### 挂载数据卷时容器报权限拒绝

- 更新后使用命名卷：运行 `docker compose pull && docker compose up -d`。官方镜像会在启动时修复归属权。
- 绑定挂载：让宿主机文件夹对用户和组 ID `1000` 可写，或者改用命名卷。
- Fedora 或 RHEL 这类启用 SELinux 的系统：给卷挂载加上 `:Z` 后缀。

### Lite 容器在 Raspberry Pi 4 上崩溃

如果 lite 镜像在 Raspberry Pi 4 或类似的 ARM 设备上一发送 AI 请求就重启，先看退出码。退出码 132 或 SIGILL(CPU 执行到了它跑不了的指令) 指向 lite 镜像的 Node 构建在部分 ARM 芯片上的一个已知上游问题。在那台设备上改用常规镜像。

<a id="a-server-extension-says-no-supported-sandbox-is-available"></a>

### 服务器扩展提示没有可用的沙箱

服务器扩展和 Professor Mari 的原始 shell 命令只能在 macOS Seatbelt 或 Linux Bubblewrap 下运行。在原生 Linux 主机上，安装 `bwrap` 并重启 Marinara。官方 Docker 镜像包含 Bubblewrap，但默认容器无法创建它所需的嵌套命名空间，所以 Marinara 会让这些功能保持关闭。

如果你接受更宽泛的容器权限，把下面的内容保存为 `docker-compose.yml` 旁边的 `docker-compose.override.yml`，然后重新创建容器：

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

> **警告：** 以 root 身份、带 `SYS_ADMIN` 并且不使用 AppArmor 配置运行服务器，属于大范围提权。不要只为了消除这条提示就启用它。

Docker 默认的 seccomp 配置会随新增能力自动调整，所以在当前的 Docker 上，你应该不需要 `seccomp=unconfined`。

Windows、Android 和其他不受支持的宿主环境会拒绝执行服务器扩展。浏览器扩展仍在它们的沙箱里运行。

## 扩展相关问题

### Addons 里找不到 External Extensions

只有两道开关都打开，这一节才会出现。

1. 在宿主机的 `.env` 里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`。
2. 稍等片刻，然后打开 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域)，滚动到数据删除控件下方，开启 **Allow third-party extension imports**(允许导入第三方扩展)。

如果这个开关是禁用状态，说明宿主机的标志仍然是 false，或者应用还没察觉到这次改动。确认你改的是[服务器配置](CONFIGURATION.md)里说明的那个生效中的 `.env`。在 Docker 上，它通常是 `/app/data/.env`。

只要有一道开关是关的，外部扩展记录就不会显示，也无法运行。重新打开开关也不会让它们自动重新启用。

### 导入的浏览器扩展出现了却不工作

在 **Settings → Addons → External Extensions**(设置 → 插件 → 外部扩展) 里打开它，查看 **Requested access**(申请的权限)。没有能力声明的旧版 `marinara.extension` v1 包会显示 **Full page access**(整页访问)。只批准你检查过并且信任的那个准确哈希值。

能力列表为空的重新导出包会被当作安全的沙箱扩展，需要页面 DOM 的代码将无法工作。只有在你接受代码会拿到整个页面、浏览器存储、网络 API 和你的会话时，才给它的清单加上 `full_page_access`。

禁用整页访问扩展后，如果工具栏项、浮层或监听器还留着，重新加载 Marinara。清理只能尽力而为，因为页面代码可能产生 Marinara 无法追踪的副作用。

<a id="multiplayer-connection-or-turn-problems"></a>

## 多人连接或回合问题

| 症状 | 解决办法 |
| --- | --- |
| 控件不可用 | 在正确的那个 Marinara 的 `.env` 里写入 `MULTIPLAYER_ENABLED=true`，重启它，然后再单独开启这项设置。Android 原生封装无法加入。 |
| 房主不可用 | 使用独立且可达的 HTTPS 房间端口、有效的证书链和主机名，以及匹配的邀请指纹。不要关闭 TLS 校验、把 `null` 加入可信来源、暴露普通 API，或者打开房主提供的客户端。 |
| 等待批准 | 房主必须在 Players(玩家) 里批准你。批准之前你看不到任何聊天记录。如果邀请过期了，请索取新的邀请。 |
| 已断线 | 让你自己的 Marinara 保持运行。会话仍然有效时，它会重新连接到同一个房主，未发送的草稿也会保留。重启之后，需要重新加入。想继续用同一个用户角色名称，先请房主移除你原来的席位。 |
| Game 等待中 | 打开 Players。断线的玩家不会被自动跳过。房主可以 **Pass**(跳过)、**Kick**(踢出) 或 **Pause**(暂停)。 |
| 生成中断 | 不要重新提交这一轮。房主应检查已保存的叙述和状态，然后继续或停止房间。多人模式绝不会重放结果不明确的请求，也不会重复应用它的世界效果。 |
| 命令受限或缺少媒体 | 房间只传输文本。见[兼容性矩阵](development/multiplayer.md#command-and-feature-compatibility)。不要安装对方提供的文件或扩展。 |

报告连接错误时，请提供模式、平台、可见的错误，以及批准是否成功。不要发布邀请、房间密码、会话 Token、私密聊天记录或 API 密钥。

## 启用登录后，在 Android Chrome 上安装 PWA 失败

使用 HTTPS 地址，登录，并在更新 Marinara 后重新加载页面。应用请求清单时会带上凭据，所以登录可以保持开启。如果仍然无法安装，检查你的代理是否把 `/manifest.json` 作为 JSON 返回，而不是返回登录页面或错误。

<a id="get-more-help"></a>

## 获取更多帮助

1. 打开 **Settings → Advanced → Message Tools**(设置 → 高级 → 消息工具)，开启 **Debug mode**。它会把提示词和回复记录到服务器控制台。
2. 记下操作系统、Node.js 版本，以及控制台里完整的报错文本。
3. 分享任何内容之前，先删掉 API 密钥、访问 Token、管理员密钥和私密聊天内容。

然后到社区求助：

- 阅读[已有的 issue](https://github.com/Pasta-Devs/Marinara-Engine/issues)。
- 加入 [Discord](https://discord.com/invite/KdAkTg94ME)。
- 带上上面的细节，到同一个 GitHub issues 页面提交 bug 报告。

## 相关指南

- [常见问题](FAQ.md)
- [服务器配置参考](CONFIGURATION.md)
- [远程访问](REMOTE_ACCESS.md)
- [升级 Marinara Engine](UPGRADING.md)
- [连接 AI 服务商](connections/connecting-to-a-provider.md)
- [内置模型设置](connections/local-model.md)
- [Game Mode：入门](game/getting-started.md)
- [设置总览](settings/settings-overview.md)

<details>
<summary>维护者：更新固定版本的本地运行时</summary>

GitHub 自动生成的源码压缩包并不保证逐字节稳定，哪怕提交内容没有变化。绝不要拿用户机器上看到的字节当作正确值来“修复”不匹配，也不要削弱校验。重新固定运行时输入只能通过一次经过评审的 Engine 改动完成：

1. 选定一个不可变的上游修订版本或发布产物，并审阅上游改动。
2. 把产物下载到临时目录，记录准确的字节数，并独立计算它的 SHA-256 摘要。
3. 用修订版本、URL、大小和摘要更新 `runtime-integrity-manifest.ts`。MLX 部分要在 Apple Silicon/Python 3.12 上用固定版本的 uv，从 `.in` 文件重新生成 `packages/server/src/assets/mlx-runtime-requirements.lock`，逐条审阅依赖变化，并更新 `requirementsLockSha256`。
4. 运行 `pnpm regression:runtime-integrity`、`pnpm check`，并在受影响的平台上真实执行一次全新的运行时安装。
5. 先发布经过评审的 Engine 更新，再让用户重试。不要提供手动跳过校验和的开关。

</details>
