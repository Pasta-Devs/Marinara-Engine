# 连接 AI 服务商

本指南介绍如何把 Marinara Engine 连到 AI 服务商，让角色能够回复。整个流程是：添加一个账号，粘贴它的密钥，再选好回答聊天的模型。

## 账号与模型

**account**(账号) 是某个 AI 服务商的一个密钥、一次登录或一个地址。它保存服务商、密钥、地址和各项限制。同一个服务商用了两个密钥，就是两个账号。

**model**(模型) 是从某个账号里保存下来的一个 AI 模型，比如 GPT 或 Claude。每个保存的模型都有自己的设置。在 **Connections**(连接) 面板里，模型排在所属账号下面。

API 密钥是 AI 服务商给的一串秘密字符，作用和密码一样。Marinara 会把密钥保存在运行 Marinara 的那台电脑上，导出时也绝不会带上它。

Marinara Engine 不自带现成的账号，也不送免费的入门密钥。开始聊天前至少要添加一个账号。唯一的例外是 **On your computer**(在你的电脑上) 下面的 **Built-in model**(内置模型)：它直接跑在自己的电脑上，不需要账号（见[本地模型设置](local-model.md)）。

## Connections 面板

账号在应用右侧的 **Connections** 面板里管理。面板从上到下依次是：

- **Search models and accounts**(搜索模型和账号)：边输入边筛选列表。
- **Add**(添加)：打开 **Add account**(添加账号) 窗口；**More actions**(更多操作，三个点)：里面有 **Import account**(导入账号)、**Export all accounts**(导出全部账号)、折叠和分组。面板较宽时，排序下拉菜单在 **Search models and accounts** 旁边；面板较窄时，排序放在 **More actions** 里。
- **Jobs**(分工) 框。它说明每项工作由哪个模型负责，比如 **Main**(主模型) 负责聊天回复，**Images**(图像) 负责生成图片。见[为每项工作选择模型](#choosing-the-model-for-each-job)。
- 各个账号，每个账号下面是它保存的模型。见[整理连接](organizing-connections.md)。

## 添加账号

1. 在 **Connections** 面板里点击 **Add**。**Add account** 窗口会把服务商分在 **Popular**(热门)、**Subscriptions**(订阅)、**On your computer** 和 **All providers**(全部服务商) 下面。在 **Search providers**(搜索服务商) 里输入文字可以查找。
2. 点击一个服务商，比如 **OpenAI**、**Anthropic** 或 **OpenRouter**。
3. 把密钥粘贴到 **API key**(API 密钥) 里。**Where do I find my key?**(我的密钥在哪里找？) 会打开服务商的密钥页面。眼睛按钮用来显示或隐藏密钥。**More options**(更多选项) 里有可选的 **Name**(名称)、**Address**(地址)、**Requests per minute**(每分钟请求数) 和 **Parallel jobs**(并行任务数)。
4. 点击 **Connect**(连接)。Marinara 会测试这个密钥。失败时，窗口会说明原因，并给出 **Try again**(再试一次)。自己电脑上的服务器还会多一个 **Continue anyway**(仍然继续)。
5. 添加第一个账号而还没有 Main 模型时，或者在开始聊天的过程中添加账号时，窗口会接着进入模型选择。选一个模型。显示 **Make … my Main**(把……设为我的主模型) 这个选项时，用它就能把这个模型设为 Main。点击 **Done**(完成) 结束；如果是从新聊天进来的，就点 **Start chatting**(开始聊天)。如果已经有 Main，又是从面板添加账号，窗口会在 Connect 之后关闭，面板里会出现新账号。图像、视频和语音服务各有自己的设置控件；内置模型使用它自己的本地设置界面。

之后可以在 **Jobs** 框里更改每项工作用的模型。

**Name** 留空时，Marinara 会用服务商的名字给账号命名。同一个服务商的第二个账号如果没填名字，名字后面会带上密钥的最后 4 个字符，比如 `OpenAI · …a1b2`。自己填的名字永远不会被改动。

**Address** 一般不用动，已知的服务商 Marinara 都会自动填好。只有使用代理或自己电脑上的服务器时才需要改。

有些服务商用自己电脑上的登录代替密钥。它们在 **Subscriptions** 下面，没有密钥输入框。见 [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)。要连接跑在自己电脑上的模型，见[连接本地或自托管模型](local-self-hosted.md)。所有支持的服务商，以及每个密钥的获取地址，见[支持的 AI 服务商](providers-reference.md)。

### 没有账号时开始聊天

如果还没有模型就去开始聊天，Marinara 会先打开 **Add account** 窗口。点击 **Connect** 之后，窗口会列出这个服务商的模型。点一个，再点击 **Start chatting**。窗口底部也可以把这个模型设为你的 **Main** 模型。

<a id="choosing-the-model-for-each-job"></a>

## 为每项工作选择模型

**Jobs** 框列出模型能做的每一项工作，分成四组：

- **Chat**(聊天)：**Main** 在聊天里写回复。**Agents**(智能体) 运行辅助智能体。**Impersonate**(代写) 以你的身份写。
- **Omnibar**(搜索栏)：**Professor Mari** 和 **Quick answers**(快速回答)。
- **Pictures & sound**(画面与声音)：**Images**、**Video**(视频) 和 **Voice (Text to Speech)**(语音合成)。
- **Behind the scenes**(幕后)：**Decision**(判定)、**Embeddings**(嵌入) 和 **Image reading**(读图)。

每一行显示负责这项工作的模型及其服务商；没有模型时，则显示这项工作会怎么处理，比如 **Follows Main**(跟随主模型) 或 **Off**(关闭)。必须有模型才能做的工作会显示 **Choose a model**(选择模型)。

点击某一行，会打开这项工作的 **Model for**(用于……的模型) 窗口。窗口里先在 **Now**(当前) 下显示正在负责这项工作的模型，然后是 **Starred**(星标) 模型，再往下是按账号分组的已保存模型。账号下面的 **All models**(全部模型) 会打开它完整的模型目录。在 **Search all models or paste a model ID**(搜索全部模型或粘贴模型 ID) 里输入文字，可以一次搜索所有目录。点击任意一个模型就把这项工作交给它，不必事先保存。窗口顶部的 **If it fails**(失败时) 用来选第二个模型，第一个模型失败时由它来回答。底部的 **Add account** 会打开添加窗口。

点击 **Jobs** 可以把这个框折叠到只剩标题。

### 功能需要模型时

缺了某类模型就没法工作的智能体或功能，会用 **Needs an image model**(需要图像模型) 标签说明（也可能是视频、音频、判定或聊天模型）。这个标签会出现在 **Agents** 面板里的智能体卡片上、**Chat Settings**(聊天设置) 里、智能体编辑器里，以及图像和视频窗口里。点击旁边的 **Set up**(设置)，会打开这项工作的 **Model for** 窗口，可以在里面选模型，或者点击 **Add account**。这项工作有了模型，标签就会消失。如果某条回复因为没设图像模型而失败，消息里的 **Set up** 会打开 **Connections** 面板。

## 测试账号

**Connect** 已经测试过密钥。之后想再测一次，打开面板里这个账号的 **⋯** 菜单，点击 **Test**(测试)。账号编辑器（**Edit account**(编辑账号)）里有 **Test account**(测试账号)，它在保存之前，按当前填写的内容检查密钥和地址。

<a id="choosing-a-model-for-one-chat"></a>

## 为单个聊天选择模型

新聊天使用你的 **Main** 模型。要给某一个聊天换个模型，打开聊天输入框里的 **Connections** 菜单，或者 **Chat Settings → Connection**(聊天设置 → 连接) 里的 **Model**(模型) 字段。两者都会打开 **Model for this chat**(此聊天的模型)：

- **Now** 显示这个聊天正在用的模型。**This chat only**(仅此聊天) 表示这个聊天有自己单独的选择；**follows Main**(跟随主模型) 表示它用的是 Main。
- **Recent**(最近) 和 **Starred** 按账号列出你的模型。
- **Search models or paste an ID…**(搜索模型或粘贴 ID…) 会搜索所有目录。**Browse**(浏览) 打开某一个账号的完整列表。
- **Follow Main**(跟随主模型) 清除这个聊天自己的选择。**Shuffle**(随机轮换) 每次都换一个不同的模型。

选中的模型只改变这个聊天。选完之后的提示消息里有 **Make it my Main model**(设为我的主模型) 和 **Undo**(撤销)。在 Game Mode(游戏模式) 里，这个字段的标签是 **GM / Party Model**。

## 常见错误

测试或消息发送失败时，先检查这几项：

- 密钥填错了或者已经过期。打开这个账号的 **⋯** 菜单，点击 **Replace key**(更换密钥)，重新粘贴密钥。没有密钥的账号会显示 **Needs key**。
- 账号处于关闭状态。它会显示 **Off**；在它的 **⋯** 菜单里点击 **Turn on**(开启)。
- 用了别家服务商的密钥。每个服务商都要用自己的密钥。
- **Address** 被拦截或者访问不通。除非使用代理或自己电脑上的服务器，否则留空、用服务商自己的地址就行。

更多解决办法，见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [整理连接](organizing-connections.md)
- [支持的 AI 服务商](providers-reference.md)
- [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)
- [连接本地或自托管模型](local-self-hosted.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
