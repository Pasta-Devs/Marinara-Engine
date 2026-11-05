# 整理连接

本指南介绍如何在 **Connections**(连接) 面板里把账号和模型整理干净：折叠、加星标、移动、移除、文件夹、Shuffle(随机轮换) 和导出。添加账号见[连接 AI 服务商](connecting-to-a-provider.md)。

## 账号列表

面板在 **Jobs**(分工) 框下方列出你的账号。每个账号显示它的图片、名称、模型数量和地址。模型行显示模型的图片、名称和徽章，比如它负责的工作（**Main**(主模型)、**Agents**(智能体)、**Images**(图像)）、**Custom settings**(自定义设置)、价格，或者订阅里包含的模型会显示 **Plan**(套餐)。**Built-in model**(内置模型) 卡片位于 **Jobs** 框下方。见[内置模型设置](local-model.md)。

点击账号行可以把它的模型折叠起来，再点一次重新显示。Marinara 会记住哪些账号折叠了。面板顶部的 **More actions**(更多操作，三个点) 里有这些项：

| 项 | 作用 |
| --- | --- |
| **Fold all accounts**(折叠全部账号)、**Open all accounts**(展开全部账号) | 折叠或展开所有账号。 |
| **Show only Off or Needs key**(只显示 Off 或 Needs key 的账号) | 只列出需要处理的账号。 |
| **Show cost badges**(显示费用徽章) | 显示每个模型的价格。 |
| **Group by folder**(按文件夹分组)、**Group by account**(按账号分组) | 切换模型的分组方式。见[文件夹](#folders)。 |
| **Import account**(导入账号)、**Export all accounts**(导出全部账号) | 见[导出与导入](#export-and-import)。 |

面板较宽时，排序下拉菜单在 **Search models and accounts**(搜索模型和账号) 旁边；面板较窄时，排序放在 **More actions** 里。排序方式有 **Custom**(自定义)、**A–Z**、**Z–A**、**Newest** 和 **Oldest**。**Search models and accounts** 会随输入筛选列表。

有些账号能用到多家开发商的模型，比如 NanoGPT 或代理。它们的模型会分在 **via NanoGPT** 这样的标题下面。

### 账号操作

点击账号行上的 **⋯**：

| 操作 | 作用 |
| --- | --- |
| **Edit account**(编辑账号) | 打开它的设置，包括 **Name**(名称)、**Address**(地址)、**API key**(API 密钥) 和 **Use this account**(使用此账号)。 |
| **Replace key**(更换密钥) | 粘贴新密钥。如果其他账号上也有旧密钥，Marinara 会问要不要一并更新。 |
| **Test**(测试) | 检查密钥并显示结果。 |
| **Add model**(添加模型) | 打开这个账号的模型列表。服务也能生成图像时，还会显示 **Add image model**(添加图像模型)。 |
| **Select models**(选择模型) | 可以一次移动或删除多个模型。 |
| **Duplicate**(复制) | 添加这个账号的副本，连同它所有模型的副本。 |
| **Turn off**(关闭) / **Turn on**(开启) | 让 Marinara 停止或恢复使用这个账号。 |
| **Delete account**(删除账号) | 见下文。 |

要删除账号，点击 **Delete account**。Marinara 会请你确认，并在 **Used by**(使用者) 下面列出用到它的模型的东西：聊天、智能体、模型和工作。点击 **Delete with its N models**(连同它的 N 个模型一起删除)，就会删除这个账号和它的模型。之后那些聊天和工作需要另选模型。如果某个模型删不掉，编辑器会把它列在 **This account still has models. Remove these first:** 下面。逐个打开它们并移除。

在 **Edit account** 里，**Test account**(测试账号) 检查密钥，**Usage and balance**(用量与余额) 显示套餐用量，**More options**(更多选项) 里有 **Requests per minute**(每分钟请求数) 和 **Parallel requests**(并行请求数)。

### 服务商图标

每个账号显示它所属服务的图标。这些图标随 Marinara 一起提供，从不从网上加载。自定义地址如果在地址或名称里包含某个已知服务器或网关，比如 Ollama、LM Studio、KoboldCpp、Bifrost 或 LiteLLM，就显示它的图标；否则显示名称的首字母。想自己选，点击账号的图片，然后选一个服务的标志、上传一张图片，或者用文字。

## 星标模型

星标用来标记想快速找到的模型。加了星标的模型会列在每个模型选择器靠上的 **Starred**(星标) 下：**Jobs** 框的 **Model for**(用于……的模型) 窗口、**Model for this chat**(此聊天的模型)，以及 **Chat Settings**(聊天设置) 和智能体编辑器里的模型字段。

要给模型加星标，在账号的 **Add model** 列表里点它的星标，或者在模型的 **⋯** 菜单里选 **Star**(加星标)。把某项工作交给模型，也会把它保存下来。

要取消星标，再点一次它的星标。Marinara 会移除这个模型，并显示 **Undo**(撤销)，持续几秒。如果有聊天在用这个模型、它在 **Jobs** 里承担工作、有自己的设置，或者是所属账号的最后一个模型，它会留下来，只是去掉星标。提示消息会说明原因。

## 模型操作

点击模型行上的 **⋯**：

| 操作 | 作用 |
| --- | --- |
| **Make default for…**(设为……的默认模型) | 把某项工作交给这个模型，效果和在 **Jobs** 框里选它一样。 |
| **Edit model**(编辑模型) | 打开它的设置。点击模型行效果相同。 |
| **Move to account…**(移到账号…) | 把模型移到另一个账号。之后它使用那个账号的密钥。 |
| **Folder**(文件夹) | 把模型放进文件夹。 |
| **Duplicate** | 完整复制一份，设置相同。 |
| **Add to Shuffle**(加入随机轮换) / **Remove from Shuffle**(移出随机轮换) | 见 [Shuffle](#shuffle)。 |
| **Change picture**(更换图片) | 打开图片选项。 |
| **Remove**(移除) | 在你确认后删除这个模型。确认窗口会列出用到它的东西。 |

移动模型时，它的名称、图片、工作和聊天都会跟着一起移过去，服务相关的选项会重置。

在电脑上，可以把模型行拖到某个聊天上，让这个聊天使用该模型。

<a id="folders"></a>

## 文件夹

文件夹用来给模型分组，比如 **RP** 和 **Work**。在 **More actions** 里选 **Group by folder** 就能显示文件夹。一个模型只放在一个文件夹里。

1. 点击模型上的 **⋯**，选择 **Folder**。
2. 选一个文件夹，或者点击 **New folder…**(新建文件夹…)，输入名称，再点击 **Create**(创建)。

文件夹可以设置图标和颜色。要重命名或删除文件夹，打开它的 **⋯** 菜单。删除文件夹会保留其中的模型，它们会归到 **Not in a folder**(不在文件夹中) 下面。

## Shuffle

Shuffle 让聊天每写一条回复就换一个模型。用它可以把请求分摊到多个服务或多个模型上。

1. 点击每个想放进池子的模型上的 **⋯**，选择 **Add to Shuffle**。
2. 在聊天里，从聊天输入框打开 **Model for this chat**，或者打开 **Chat Settings → Connection → Model**(聊天设置 → 连接 → 模型)，然后选 **Shuffle**。

之后每条回复都会从你的 Shuffle 池里随机挑一个模型。

如果某条回复挑中的模型失败了，而 **Main** 设置了 **If it fails**(失败时) 模型，就会改由那个模型写这条回复。一条通知会说明失败的是哪个模型以及简短原因，例如“key rejected”、“rate limited”或“not found”。这条回复会保留一个小小的 **Fallback**(后备) 标签。点按它或把鼠标指向它，就能再次看到同一行说明。

在 **Model for this chat** 里选的模型只改变这个聊天。要更改新聊天用的模型，在 **Jobs** 框里设置 **Main**。

<a id="export-and-import"></a>

## 导出与导入

账号可以导出成文件，用来备份，或者搬到另一个安装环境，之后再导入回来。

> **警告：** 导出文件里绝不包含 API 密钥。导入之后，要逐个打开账号，重新填写密钥。永远不要把密钥分享给任何人。

- **导出单个模型：** 用 **Edit model** 打开它，点击 **Export model**(导出模型)。
- **导出全部：** 打开 **More actions**，选择 **Export all accounts**。Marinara 会提醒你文件里不含密钥。点击 **Export**(导出)。
- **导入：** 打开 **More actions**，选择 **Import account**。把一个或多个文件（`.json`、`.jsonl` 或 `.zip`）拖进窗口，或者点击窗口浏览选择。你导出的 `marinara-connections.zip` 也可以导入。每个导入的账号在你补上密钥之前，密钥都是空的。

单个模型下载下来是一个 `.connection.json` 文件。多个则一起打包成 `marinara-connections.zip`。星标会一并导出。服务的模型目录不会，所以第一次打开该账号的模型时会重新加载。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [聊天设置总览](../chats/chat-settings.md)
