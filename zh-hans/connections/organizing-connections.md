# 整理连接

本指南介绍如何在 Marinara Engine 里把账号和模型整理干净，内容包括账号列表、星标模型、移动和移除模型、文件夹、Shuffle(随机轮换)，以及导出与导入。账号是某个 AI 服务商的一个密钥、一次登录或一个地址；模型是从账号里保存下来的一个 AI 模型。添加账号见[连接 AI 服务商](connecting-to-a-provider.md)。

## 账号列表

**Connections**(连接) 面板在 **Jobs**(分工) 框下方列出你的账号。每个账号显示它的图片、名称、模型数量和地址。模型行显示模型的图片、名称和徽章，比如它负责的工作（**Main**(主模型)、**Agents**(智能体)、**Images**(图像)）、**Custom settings**(自定义设置)、价格，或者订阅里包含的模型会显示 **Plan**(套餐)。

点击账号行可以把它的模型折叠起来，再点一次重新显示。Marinara 会记住哪些账号折叠了。面板顶部的 **More actions**(更多操作) 里有 **Fold all accounts**(折叠全部账号)、**Open all accounts**(展开全部账号)、**Show only Off or Needs key**(只显示 Off 或 Needs key 的账号) 和 **Show cost badges**(显示费用徽章)。面板较宽时，排序下拉菜单在 **Search models and accounts**(搜索模型和账号) 旁边；面板较窄时，排序方式放在 **More actions** 里。

能连到多家模型开发商的网关账号，比如代理或 LinkAPI，会把模型分在 **via** 标题下，比如 **via NanoGPT**，并配上那家开发商的图标。

**Built-in model**(内置模型) 卡片位于 Jobs 框下方，显示跑在你电脑上的模型及其状态。见[本地模型设置](local-model.md)。

### 账号操作

点击账号行上的 **⋯**：

- **Edit account**(编辑账号) 打开它的设置：**Name**(名称)、**API key**(API 密钥)、**Address**(地址)、**Usage and limits**(用量与限制) 和 **Use this account**(使用此账号)。
- **Replace key**(更换密钥) 用来粘贴新密钥。
- **Test**(测试) 检查密钥并显示结果。
- **Add model**(添加模型) 打开这个账号的模型列表。服务商也能生成图像时，还会显示 **Add image model**(添加图像模型)。
- **Select models**(选择模型) 可以一次移动或删除多个模型。
- **Duplicate**(复制) 添加这个账号的副本，连同它所有模型的副本。
- **Turn off**(关闭) 让 Marinara 不再使用这个账号，直到你再 **Turn on**(开启)。
- **Delete account**(删除账号)。Marinara 会先列出仍在使用它的模型的工作、聊天和智能体。

### 服务商图标

每个账号显示它所属服务商的图标。这些图标随 Marinara 一起提供，所以 Marinara 从不从网上加载它们。自定义地址如果在地址或名称里包含某个已知服务器或网关，比如 Ollama、LM Studio、KoboldCpp、Bifrost 或 LiteLLM，就显示它的图标；否则显示名称的首字母。点击账号的图片可以自己选一张。

## 星标模型

星标用来标记想放在手边的模型。加了星标的模型会列在每个模型选择器靠上的 **Starred**(星标) 下：**Jobs** 框的 **Model for**(用于……的模型) 窗口、聊天的 **Model for this chat**(此聊天的模型)，以及 **Chat Settings**(聊天设置) 和智能体编辑器里的模型字段。

要给模型加星标，在账号的 **Add model** 列表里点它的星标，或者在模型的 **⋯** 菜单里选 **Star**(加星标)。把某项工作交给模型，也会把它保存下来。

要取消星标，再点一次它的星标。Marinara 会移除这个模型，并显示 **Undo**(撤销)，持续几秒。如果模型在 **Jobs** 里仍承担工作、有自己的设置，或者是所属账号的最后一个模型，它会留下来，只是去掉星标。提示消息会说明原因。

## 模型操作

点击模型行上的 **⋯**：

- **Make default for…**(设为……的默认模型) 把某项工作交给这个模型，效果和在 **Jobs** 框里选它一样。
- **Edit model**(编辑模型) 打开它的设置。点击模型行效果相同。
- **Move to account…**(移到账号…) 把模型移到同一服务商的另一个账号，或者一个新账号。之后模型使用那个账号的密钥和模型目录。用这个模型的聊天照常工作。
- **Folder**(文件夹) 把模型放进文件夹。在 **More actions** 里选 **Group by folder**(按文件夹分组) 时才会显示文件夹。
- **Duplicate** 直接完整复制一份，设置相同，不再确认。
- **Add to Shuffle**(加入随机轮换) 或 **Remove from Shuffle**(移出随机轮换)。
- **Change picture**(更换图片)。
- **Remove**(移除) 在你确认后删除这个模型。

在电脑上，可以把模型行拖到某个聊天上，让这个聊天使用该模型。

## 搜索

面板顶部的 **Search models and accounts** 会随输入筛选列表。没有匹配结果时，面板会说明。

## Shuffle

Shuffle 让聊天每写一条回复就换一个模型。想把请求分摊到多个服务商或多个模型上时，这个功能很好用。

要把模型加入 Shuffle，在它的 **⋯** 菜单里选 **Add to Shuffle**。要让某个聊天使用 Shuffle，从聊天输入框或 **Chat Settings → Connection → Model**(聊天设置 → 连接 → 模型) 打开 **Model for this chat**，然后选 **Shuffle**。之后每条回复都会从你的 Shuffle 里随机挑一个模型。

如果某条回复挑中的模型失败了，而 **Main** 设置了 **If it fails**(失败时) 模型，就会改由那个模型写这条回复。一条通知会说明失败的是哪个模型以及简短原因，例如“key rejected”、“rate limited”或“not found”，这样你就知道哪个需要修。这条回复会保留一个小小的 **Fallback**(后备) 标签；点按它或把鼠标指向它，就能再次看到同一行说明。

在 **Model for this chat** 里选的模型只改变这个聊天。要更改新聊天用的模型，在 **Jobs** 框里设置 **Main**。

## 导出与导入

账号可以导出成文件，用来备份，或者搬到另一个安装环境，之后再导入回来。

**导出文件里绝不包含 API 密钥。** 导入之后，要逐个打开账号，重新填写密钥。星标会一并导出；服务商的模型目录不会，所以第一次打开该账号的模型时会重新加载。

导出单个模型，先用 **Edit model** 打开它，再点击它的 **Export**(导出) 按钮（上传图标）。要导出全部，打开 **More actions**，选择 **Export all accounts**(导出全部账号)。下载开始前，Marinara 会提醒你文件里不含密钥。

单个模型下载下来是一个 `.connection.json` 文件。多个则一起打包成一个 `marinara-connections.zip` 文件。

导入时，打开 **More actions**，选择 **Import account**(导入账号)。把一个或多个 `.json` 文件拖进窗口，或者点击窗口浏览选择。每个导入的账号在你补上密钥之前，密钥都是空的。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [聊天设置总览](../chats/chat-settings.md)
