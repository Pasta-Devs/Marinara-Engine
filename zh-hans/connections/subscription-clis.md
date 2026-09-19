# Claude、ChatGPT 和 Grok 订阅连接

本指南介绍 3 个用账号登录、而不是用 API 密钥的连接：**Claude (Subscription)**、**OpenAI (ChatGPT)** 和 **Grok CLI (Subscription)**。装一个小巧的命令行工具，登录一次，Marinara Engine 就能借这个账号聊天。命令行工具（CLI）是在终端窗口里敲命令来运行的程序。

## 订阅连接是什么

Marinara Engine 里大多数连接都要 API 密钥。API 密钥是一串秘密字符，作用类似密码，粘贴到连接里之后，AI 服务就知道该向哪个账号计费。

这 3 个连接的机制不一样。它们用本机登录代替 API 密钥：在自己的机器上登录一个 CLI，Marinara 直接复用这份登录信息。什么都不用往 Marinara 里粘。

如果账号本身就包含通过下列某个 CLI 使用模型的权限，就适合用订阅连接：

- **Claude (Subscription)** 用的是 Anthropic 的 **Pro** 或 **Max** 订阅。
- **OpenAI (ChatGPT)** 用的是 ChatGPT 账号。
- **Grok CLI (Subscription)** 用的是 **SuperGrok** 或 **X Premium+** 账号。

## 事先需要准备什么

对账号的要求因服务商而异。

- **Claude (Subscription)** 需要一个受 Claude Code 订阅登录支持的 Claude 套餐。
- **OpenAI (ChatGPT)** 支持符合条件的免费和付费 ChatGPT 套餐。用量上限随套餐不同。
- **Grok CLI (Subscription)** 需要 SuperGrok 或 X Premium+。

这 3 个服务商都有同一个前提：CLI 必须装在运行 Marinara 服务器的那台机器上，并在那里登录好。不是你用来看 Marinara 的浏览器或手机。Marinara 会在本机调用 CLI，所以登录信息必须和服务器待在一起。

如果 Marinara 就跑在自己的电脑上，那台电脑就是服务器。如果跑在另一台机器上或 Docker 里，就要在那边安装并登录 CLI。

## Claude (Subscription)

需要 Anthropic 的 Pro 或 Max 订阅。这和 Visual Studio Code 以及其他 Anthropic 工具用的是同一套登录。

1. 在运行 Marinara 的机器上安装 Claude Code CLI：

```
npm i -g @anthropic-ai/claude-code
```

2. 登录一次：

```
claude auth login
```

3. 在 Marinara 里打开 **Connections**(连接) 面板，点击 **New**(新建)。
4. 在 **Create Connection**(创建连接) 窗口里填一个名称，选择 **Claude (Subscription)** 服务商，然后点击 **Create**(创建)。
5. 进入编辑器后会发现没有 **API Key** 和 **Base URL** 输入框。一个信息面板会说明这两项并不需要。
6. 从 **Model**(模型) 下拉菜单里挑一个 Claude 模型，比如 Opus 或 Sonnet 系列。
7. 点击 **Save**(保存)，再点击 **Send Test Message**(发送测试消息)。收到一句简短回复就说明登录可用。

Claude 订阅连接只支持文字聊天。这个连接还多出两项控件，**Fast Mode** 和 **Diagnose Model Routing**(诊断模型路由)，下文分别说明。

## OpenAI (ChatGPT)

需要一个 ChatGPT 账号。Marinara 通过 Codex CLI 的登录来转发聊天。

1. 在运行 Marinara 的机器上安装 Codex CLI：

```
npm i -g @openai/codex
```

2. 登录一次：

```
codex login
```

3. 在 Marinara 里打开 **Connections** 面板，点击 **New**。
4. 在 **Create Connection** 窗口里填一个名称，选择 **OpenAI (ChatGPT)** 服务商，然后点击 **Create**。
5. 从 **Model** 下拉菜单里选一个模型。能读到 ChatGPT 会话时，列表就来自会话；读不到时用内置列表。
6. 点击 **Save**，再点击 **Send Test Message** 确认能收到回复。

Marinara 会读取本机的 Codex 登录文件，并在条件允许时刷新会话。

## Grok CLI (Subscription)

需要一个 SuperGrok 或 X Premium+ 账号。

1. 在运行 Marinara 的机器上安装 Grok CLI：

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. 登录一次：

```
grok login
```

3. 在 Marinara 里打开 **Connections** 面板，点击 **New**。
4. 在 **Create Connection** 窗口里填一个名称，选择 **Grok CLI (Subscription)** 服务商，然后点击 **Create**。
5. 挑一个模型，或者把 **Model** 输入框留空，直接用 CLI 的默认模型。角色扮演场景下最稳妥的模型通常是 `grok-composer-2.5-fast`。
6. 点击 **Save**，再点击 **Send Test Message**。这个连接即使没设模型也能测试。

Grok CLI 有两点比较特别。一是它不支持流式输出，回复会一次性整段出现，而不是逐字冒出来。二是它的上下文窗口默认只有 32000 Token(模型切分文本的最小单位)，比其他服务商都低，因为提示词太长会撞上 CLI 自身的单轮上限。

要加载 Grok 模型列表，用 **Model** 区域里的 **Fetch Models from Grok CLI** 按钮。

## Claude 提示词缓存时长

Claude 连接编辑器中的 **Prompt Caching → Extended token caching (1 hour)** 会请求保留 1 小时的缓存，方便在消息之间暂停更长时间。需要 Claude Code **2.1.242 或更高版本**。Marinara 只为当前请求传入这个设置，不会修改已保存的 Claude 设置。

关闭后，主对话和 Agent SDK 请求沿用 Claude 的默认行为：目前，订阅套餐额度内的使用保留 1 小时，额外用量、积分或 API 计费保留 5 分钟。Claude Code 自身的子代理在未单独配置时使用 5 分钟；部分由服务器控制的辅助请求可能使用 1 小时。覆盖这个值的现有 CLI 环境变量仍然优先。参见 [Claude Code 提示词缓存](https://code.claude.com/docs/en/prompt-caching)。

调试日志根据 SDK 返回的用量，分别记录 5 分钟和 1 小时的缓存写入。费用折算使用标准 API Token 价格倍率，并不代表订阅账单；如果 SDK 没有按缓存时长提供写入明细，估算费用就会保持未知。

## 为什么没有 API 密钥输入框

这 3 个订阅服务商都会隐藏 **API Key** 和 **Base URL** 输入框，这是有意为之。登录信息保存在服务器那台机器的 CLI 里，所以没有什么需要往 Marinara 里填。

如果是选错了服务商才看不到密钥输入框，回到服务商网格里改选原本想要的那个。基于 API 的服务商会重新显示密钥输入框。

## Fast Mode(仅 Claude)

**Claude (Subscription)** 编辑器里有一个 **Fast Mode** 区域，其中只有一个开关 **Use Claude Code fast-mode routing**，默认关闭。

保持关闭就好。应用自己都写明这个功能目前不起任何作用。它会向 Claude Code 请求一档更快的模型，但现在的 Claude 模型已经不再提供这一档了。开启它没有任何好处，还可能带来额外开销。这个开关留在界面上，只是以防 Anthropic 哪天把功能恢复回来。

尝试开启时会弹出一个标题为 **YOU DON'T WANT THIS SETTING ON!** 的确认窗口。选择 **Keep it off**。

## Diagnose Model Routing(仅 Claude)

**Claude (Subscription)** 编辑器的测试区域里有一个 **Diagnose Model Routing** 按钮。当你指定了某个 Claude 模型、却怀疑实际用的是更小的模型时，就用它。

1. 选好模型并点击 **Save**。没选模型之前这个按钮是禁用的。
2. 点击 **Diagnose Model Routing**。
3. 看结果。Marinara 会通过 Claude Code 登录真实发一次提示词，然后告诉你账号实际是按哪个模型计费的。

这样就能抓出静默降级：你要的是 Opus 这类更大的模型，拿到的却悄悄变成了 Sonnet 或 Haiku。

## 需要了解的限制

- 这些连接都需要付费订阅，并且 CLI 要在服务器机器上登录好。
- 3 个都不支持嵌入。世界书语义搜索和记忆功能需要另配一个连接来做嵌入。
- **Claude (Subscription)** 只支持文字聊天。
- **Grok CLI (Subscription)** 不支持流式输出，上下文窗口起点也更小。
- **Send Test Message** 需要先选好模型，只有 Grok CLI 例外，没选模型也能测。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [支持的 AI 服务商](providers-reference.md)
