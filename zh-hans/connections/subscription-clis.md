# Claude、ChatGPT 和 Grok 订阅连接

有 3 个服务可以用你已经付费的套餐聊天，不需要 API 密钥：**Claude (Subscription)**、**OpenAI (ChatGPT)** 和 **Grok CLI (Subscription)**。装一个小巧的命令行工具（CLI），登录一次，Marinara Engine 之后就复用这份登录。什么都不用往 Marinara 里粘贴。

需要的套餐：

- **Claude (Subscription)**：Anthropic Pro 或 Max，或者 Claude Code 接受的其他套餐。
- **OpenAI (ChatGPT)**：一个 ChatGPT 账号。用量上限取决于套餐。
- **Grok CLI (Subscription)**：SuperGrok 或 X Premium+。

## 添加订阅账号

开始之前要知道：CLI 必须装在运行 Marinara 服务器的那台电脑上，并在那里登录好。不是你用来看 Marinara 的手机或浏览器。如果 Marinara 跑在另一台电脑上或 Docker 里，就在那边做第 1 步和第 2 步。`npm` 命令需要 Node.js；如果你是从源码安装的 Marinara，就已经有它了。见[安装指南](../INSTALLATION.md)。

1. 在运行 Marinara 的电脑上打开终端。终端就是输入命令的那个窗口。Windows 上打开 PowerShell，macOS 上打开 Terminal。
2. 运行你那个服务的安装命令，再运行它的登录命令。工具会显示自己的登录步骤，通常是打开一个网页让你登录。

| 服务 | 安装 | 登录 |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | 见下文 | `grok login` |

Grok 的安装命令，应用里显示的是下面这条。如果它在你的系统上跑不起来，就按 x.ai 自己对 Grok CLI 的说明安装。

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. 在 Marinara 里点击顶栏的 **Connections**(连接)，再点击 **Add**(添加)。
4. 在 **Chat**(聊天) 下面点击你的服务。这些服务带有 **Sign in**(登录) 标签。
5. 窗口会显示 **Sign in first**，并写出要运行的命令。这里没有密钥输入框。点击 **Connect**(连接)。Marinara 会测试登录。显示 **Connected** 就说明可用。
6. 从列表里选一个模型，然后点击 **Done**(完成)。Grok CLI 也可以把模型留空，这样会用 CLI 自己的默认模型（见 [Grok CLI (Subscription)](#grok-cli-subscription)）。

在聊天里发一条消息确认一下。收到回复就说明可用。

如果没有成功：

- **Marinara could not use the login on this computer.** 说明 Marinara 那台电脑上没装 CLI，或者没登录。在那台电脑上运行登录命令，然后点击 **Try again**(再试一次)。

## Claude (Subscription)

从这里往下的几节都是可选设置，不用它们也能聊天。

这个服务通过 Claude Code 使用你的 Claude 套餐。它在模型编辑器（**Edit model**(编辑模型)）里多出三项控件：提示词缓存、**Fast mode**(快速模式) 和 **Diagnose model routing**(诊断模型路由)。

### 延长 Token 缓存

提示词缓存让 Claude 复用提示词的开头部分，重复的请求就会少占用你的额度。**Prompt caching → Extended token caching (1 hour)**(提示词缓存 → 延长 Token 缓存，1 小时) 会请求保留 1 小时的缓存，在消息之间停顿较久时很有用。它需要 Claude Code 2.1.242 或更高版本。Marinara 会随请求一起发送这个设置，不会修改你已保存的 Claude 设置。

关闭时，Claude 对你的账号使用它自己的默认值。见 [Claude Code 提示词缓存](https://code.claude.com/docs/en/prompt-caching)。

### 快速模式

**Fast mode → Use Claude Code fast-mode routing**(快速模式 → 使用 Claude Code 快速模式路由) 默认关闭。保持关闭就好。它会向 Claude Code 请求一档更快的模型，但应用里写明，现在的模型已经不再提供这一档，所以开启它没有任何好处，还可能带来额外开销。尝试开启时，会弹出一个标题为 **Turn on fast mode?** 的对话框。点击 **Keep it off**(保持关闭)。

### 诊断模型路由

如果你要的是 Opus 这类大模型，却怀疑实际拿到的是更小的模型，就用 **Diagnose model routing**。

1. 选好模型。没设模型之前，这个按钮一直是禁用的。
2. 点击 **Diagnose model routing**。Marinara 会先保存未保存的改动。
3. 看结果。Marinara 会通过你的 Claude Code 登录真实发一次提示词，然后告诉你账号实际是按哪个模型计费的。

## OpenAI (ChatGPT)

这个服务通过 Codex CLI 使用你的 ChatGPT 账号。Marinara 会读取本机的 Codex 登录文件，并在条件允许时刷新会话。

要设置 Codex 回答前思考多久，打开 **Edit model**，开启 **Use custom defaults for this model**(为此模型使用自定义默认值)，然后选一个 **Reasoning Effort**(推理强度)。初始值是 **Default**(默认)，即沿用 Codex 对该模型的级别。单个聊天可以在 **Advanced Parameters**(高级参数) 里选自己的级别。预设里的级别不会改变它。作为备用模型使用的 Codex 模型只遵循它自己的级别，该模型上的智能体使用模型自己的级别。你看到的可选级别与所选模型实际提供的级别一致。

## Grok CLI (Subscription)

这个服务在 Marinara 那台电脑上运行 Grok CLI。它有两点和其他服务不同：

- 它不支持流式输出。回复会一次性整段出现，而不是逐字冒出来。
- 它的上下文窗口默认是 32,000 Token。Token 是模型计数时使用的小段文本。提示词太长会撞上 CLI 自身的单轮上限，所以默认值定得比较低。可以在模型上设一个更大的 **Max Context Window**(最大上下文窗口)。

在模型编辑器里，**Use the Grok CLI default**(使用 Grok CLI 默认值) 会把模型留空，让 CLI 自己选。编辑器指出，角色扮演时最稳妥的通常是 `grok-composer-2.5-fast`，因为 Marinara 以无界面方式运行 CLI，并关闭了 Grok 自带的工具、记忆、网络搜索、计划和子智能体。

## 套餐用量

Claude (Subscription) 和 OpenAI (ChatGPT) 账号可以显示你已经用掉了多少套餐限额。

1. 点击账号行上的 **⋯**，选择 **Edit account**(编辑账号)，打开 **Usage and balance**(用量与余额)。
2. 如果外部读取处于关闭状态，点击 **Turn on**(开启)。
3. 开启 **Show the usage meter on the card**(在卡片上显示用量条)，然后保存。

每个限额窗口都有一条用量条，显示已用百分比和重置时间，例如 `58% · resets in 2h`。这个账号处于活动状态时，同样的用量条也会出现在聊天的连接选择器里，以及聊天的 **Connection**(连接) 设置中。选 **Shuffle**(随机轮换) 时不会显示。

- 用量条统计的是你套餐上的全部使用，而不只是 Marinara。对 Claude 来说，这包括 Claude Code 和 claude.ai。对 ChatGPT 来说，这包括所有 Codex 使用，例如 Codex CLI。chatgpt.com 上的聊天有各自的限额，不计算在内。
- 这些服务只报告每个窗口的百分比，不提供 Token 数。
- 每次读取，都会向 Marinara 那台电脑上的 CLI 请求与它自己的用量命令相同的数据。它不会向模型发送消息，也不消耗你套餐的任何额度。刷新按钮会重新读取一次。
- 只有一个窗口的套餐只显示一条用量条。
- Claude Code 把它的用量数据标为实验性的。如果新版本改动了它，用量条会显示错误和重试按钮，而不是错误的数字。

## 这些服务的限制

- 它们需要付费套餐（或者符合条件的 ChatGPT 套餐），并且 CLI 要在 Marinara 那台电脑上登录好。
- 3 个都不提供嵌入。世界书语义搜索和记忆功能需要另配一个账号来做嵌入。
- **Send test message**(发送测试消息) 需要先选好模型，Grok CLI 除外。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [支持的 AI 服务商](providers-reference.md)
