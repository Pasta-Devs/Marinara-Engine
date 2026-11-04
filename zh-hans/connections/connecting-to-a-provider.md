# 连接 AI 服务商

要聊天，Marinara Engine 需要一个 AI 模型。你可以为某个 AI 服务添加账号，粘贴它的 API 密钥，再选一个模型。API 密钥是服务给的一串秘密代码，Marinara 靠它使用你在那个服务上的账号。要像保管密码一样保管它。也可以用[内置模型](local-model.md)，这是一个跑在你电脑上的小模型，不需要密钥。

## 添加账号

开始之前，先从想用的服务那里拿到一个 API 密钥。**Add account**(添加账号) 窗口为每个服务都提供了 **Where do I find my key?**(我的密钥在哪里找？) 链接。常见服务打开的是下面这些页面。

- OpenRouter(有免费模型)：`openrouter.ai/keys`
- NanoGPT：`nano-gpt.com/api`
- OpenAI：`platform.openai.com/api-keys`
- Anthropic：`console.anthropic.com/settings/keys`
- Google Gemini：`aistudio.google.com/apikey`

大多数服务要求先注册，有些还要求先充值，密钥才能用。其他服务见[支持的 AI 服务商](providers-reference.md)。想在自己的电脑上用模型、不要密钥，见[内置模型设置](local-model.md)。

1. 点击顶栏里的 **Connections**(连接)。面板会在右侧打开。如果你还没有账号，它会问 **Where do your models come from?**，并列出几个服务。点击一个服务（不要点 **Built-in model**(内置模型)）。**Add account** 窗口会直接打开到填密钥的那一步。跳到第 4 步。
2. 点击 **Add**(添加)。**Add account** 窗口随即打开。
3. 点击你想用的服务。在标着 **Search providers**(搜索服务商) 的输入框里输入文字可以查找。列表分成 **Chat**(聊天)、**Images & video**(图像与视频)、**Voice**(声音) 和 **Decisions**(判定) 几个部分。普通的聊天模型在 **Chat** 下面找。
4. 点击 **API key**(API 密钥)，粘贴密钥。点击眼睛按钮，确认密钥粘贴完整。
5. 点击 **Connect**(连接)。Marinara 会测试这个密钥。测试通过时，会显示 **Connected** 和找到的模型数量。
6. 接下来怎样，取决于你是否已经有 Main 模型。Main 是写聊天回复的那项工作。
   - **还没有 Main 模型，或者你是从新聊天里打开 Add 的：** 窗口会列出这个服务的模型。**Recommended**(推荐) 模型排在最上面。点击一个模型即可添加，也可以在 **Search or enter model ID…**(搜索或输入模型 ID…) 里输入名称。不知道选哪个，就选一个 **Recommended** 的，之后随时可以改。让 **Make … my Main model**(把……设为我的主模型) 保持勾选，只有在你还没有 Main 模型时才会显示这一项。如果你是从新聊天里打开 Add、并且已经有 Main 模型，就会改为显示 **Set … as Main**(把……设为主模型) 按钮。然后点击 **Done**(完成)；如果是从新聊天进来的，就点 **Start chatting**(开始聊天)。
   - **已经有 Main 模型：** 窗口会关闭，并弹出一条消息，说明账号已添加以及它的模型数量。想添加更多模型，点击账号上的 **⋯**，选择 **Add model**(添加模型)。

面板里会出现你的账号。第 5 步显示 **Connected**，就已经说明密钥可用。如果新模型就是你的 Main 模型，开一个聊天发条消息：收到回复就说明一切正常。如果你原本就有 Main 模型，新聊天仍然用原来那个。要用新账号，先给它添加一个模型（**⋯** → **Add model**），再把这个模型选给某个聊天或某项工作（见[为每项工作选择模型](#choosing-the-model-for-each-job)）。

如果没有成功：

- **The key was not accepted. Check that you copied all of it.** 重新粘贴密钥，点击 **Try again**(再试一次)。密钥必须来自你选的那个服务。
- **The service is busy, or your credit is used up.** 到这个服务的网站上充值，或者等一会儿再试。
- **Marinara could not reach** 这个服务。检查网络连接，然后点击 **Try again**。

### 可选的账号字段

填密钥的那一步还会显示下面这些字段。用不上就留空。

- **Name (optional)**(名称，可选)：面板里显示的名称。留空就用服务的名字。同一个服务的第二个账号，名字后面会带上密钥的最后 4 个字符，比如 `OpenAI · …a1b2`。
- **Address**(地址)：Marinara 发送请求的地址。留空时，Marinara 用服务自己的地址。只有使用代理、网关或你自己运行的服务器时才需要填写。在你电脑上登录的服务不显示这一项。
- **Requests per minute**(每分钟请求数)：让 Marinara 放慢在这个账号上的请求速度。留空表示不限。允许的值是 1 到 600。
- **Parallel jobs**(并行任务数)：同时运行多少个请求。留空表示不限。允许的值是 1 到 16。在 **Edit account**(编辑账号) 里，同一项设置叫 **Parallel requests**(并行请求数)。

有些服务用你电脑上的登录代替密钥。它们带有 **Sign in**(登录) 标签，没有密钥输入框。见 [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)。服务器在你自己的电脑上时，见[连接本地或自托管模型](local-self-hosted.md)。测试失败后会出现 **Continue anyway**(仍然继续)，它会在测试没通过的情况下保存账号。

### 没有账号时开始聊天

如果还没有模型就去开始聊天，Marinara 会先打开 **Add account** 窗口。点击 **Connect** 之后，点一个模型，再点击 **Start chatting**。

## Connections 面板

账号在 **Connections** 面板里管理。面板从上到下依次是：

- 一个搜索框，边输入边筛选列表。它的标签是 **Search models and accounts**(搜索模型和账号)。
- **Add**：打开 **Add account**；**More actions**(更多操作，三个点)：里面有 **Import account**(导入账号)、**Export all accounts**(导出全部账号)、折叠和分组。面板较宽时，排序下拉菜单在搜索框旁边；面板较窄时，排序放在 **More actions** 里。
- **Jobs**(分工) 框。它说明每项工作由哪个模型负责。
- **Built-in model** 卡片。见[内置模型设置](local-model.md)。
- 各个账号，每个账号下面是它保存的模型。见[整理连接](organizing-connections.md)。

**account**(账号) 是为某个服务保存的一个密钥、一次登录或一个地址。同一个服务用了两个密钥，就是两个账号。**model**(模型) 是从某个账号里保存下来的一个 AI 模型。每个保存的模型都有自己的设置。

<a id="choosing-the-model-for-each-job"></a>

## 为每项工作选择模型

工作就是模型替你做的某件事。**Jobs** 框把它们分成四组列出：

| 分组 | 工作 |
| --- | --- |
| **Chat** | **Main**(主模型) 在聊天里写回复。**Agents**(智能体) 运行辅助智能体。**Impersonate**(代写) 以你的身份写。 |
| **Omnibar**(搜索栏) | **Professor Mari** 和 **Quick answers**(快速回答)。 |
| **Pictures & sound**(画面与声音) | **Images**(图像)、**Video**(视频)、**Voice (Text to Speech)**(语音合成)，以及可用时的 **Dictation (Speech to Text)**(语音识别)。 |
| **Behind the scenes**(幕后) | **Decision**(判定)、**Embeddings**(嵌入) 和 **Image reading**(读图)。 |

每一行显示负责这项工作的模型；没有模型时，则显示这项工作会怎么处理，比如 **Follows Main**(跟随主模型) 或 **Off**(关闭)。必须有模型才能做的工作会显示 **Choose a model**(选择模型)。点击 **Jobs** 可以折叠这个框。

要更改某项工作的模型，点击它那一行。除了三行以外，都会打开这项工作的 **Model for**(用于……的模型) 窗口。**Decision** 和 **Embeddings** 会打开它们自己的控件（见 [Decision 模型](decision-models.md)和[支持的 AI 服务商](providers-reference.md#embeddings)）。**Dictation (Speech to Text)** 会打开语音设置。

在 **Model for** 窗口里：

1. 看一下列表。
2. 点击一个模型。列表会把它显示在 **Now**(当前) 下面，接着是你的 **Starred**(星标) 模型，再往下是按账号分组的已保存模型。账号下面的 **All models**(全部模型) 会打开它的完整列表。在 **Search all models or paste a model ID**(搜索全部模型或粘贴模型 ID) 里输入文字，可以一次搜索所有账号。模型不必事先保存。

窗口顶部的 **If it fails**(失败时) 用来选第二个模型，第一个模型失败时由它来回答。底部的 **Add account** 会打开添加窗口。

### 功能需要模型时

缺了某类模型就没法工作的功能，会显示 **Needs an image model**(需要图像模型) 标签（也可能是视频、音频、判定或聊天模型）。这个标签会出现在 **Agents** 面板里的智能体卡片上、**Chat Settings**(聊天设置) 里、智能体编辑器里，以及图像和视频窗口里。点击旁边的 **Set up**(设置)，然后选一个模型，或者点击 **Add account**。这项工作有了模型，标签就会消失。

## 测试账号

**Connect** 已经测试过密钥。之后想再测一次，打开面板里这个账号的 **⋯** 菜单，点击 **Test**(测试)。账号编辑器（**Edit account**）里有 **Test account**(测试账号)，它在保存之前，按当前填写的内容检查密钥和地址。

<a id="choosing-a-model-for-one-chat"></a>

## 为单个聊天选择模型

新聊天使用你的 **Main** 模型。要给某一个聊天换个模型，点击聊天输入框里的模型按钮（链接图标，上面标着当前模型），或者用 **Chat Settings → Connection**(聊天设置 → 连接) 里的 **Model**(模型) 字段。两者都会打开 **Model for this chat**(此聊天的模型)：

- **Now** 显示这个聊天正在用的模型。**This chat only**(仅此聊天) 表示这个聊天有自己单独的选择。**follows Main**(跟随主模型) 表示它用的是 Main。
- **Recent**(最近) 和 **Starred** 按账号列出你的模型。
- **Search models or paste an ID…**(搜索模型或粘贴 ID…) 会搜索所有账号。**Browse**(浏览) 打开某一个账号的完整列表。
- **Follow Main**(跟随主模型) 清除这个聊天自己的选择。**Shuffle**(随机轮换) 每次都换一个不同的模型。

选中的模型只改变这个聊天。选完之后的提示消息里有 **Make it my Main model**(设为我的主模型) 和 **Undo**(撤销)。在 Game Mode(游戏模式) 里，这个字段的标签是 **Game Master model**(游戏主持人模型)。

## 常见错误

测试或消息发送失败时，先检查这几项：

- 密钥填错了或者已经过期。点击账号上的 **⋯**，选择 **Replace key**(更换密钥)，重新粘贴密钥。没有密钥的账号会显示 **Needs key**。
- 账号处于关闭状态。它会显示 **Off**。在它的 **⋯** 菜单里点击 **Turn on**(开启)。
- 用了别的服务的密钥。每个服务都要用自己的密钥。
- **Address** 被拦截。留空就会用服务自己的地址。

更多解决办法，见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [整理连接](organizing-connections.md)
- [支持的 AI 服务商](providers-reference.md)
- [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)
- [连接本地或自托管模型](local-self-hosted.md)
