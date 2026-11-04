# 消息翻译

Marinara Engine 可以把聊天消息在不同语言之间互译。本指南介绍如何选择翻译服务、设置语言、开启自动翻译，以及翻译单条消息。

翻译是按聊天分别设置的。每个聊天都有自己的服务、语言和密钥。想让新聊天沿用同样的设置，就把它们保存为[翻译默认设置](#translator-defaults-for-new-chats)。

## 翻译设置在哪里

1. 在任意模式下打开一个聊天（Conversation、Roleplay 或 Game）。
2. 打开 **Chat Settings**(聊天设置)。
3. 找到 **Translation**(翻译) 这一节。

下面的所有设置都在这一节里。

## 选择服务商

**Provider**(服务商) 列表有四个选项。

| 服务商 | 需要什么 | 说明 |
| --- | --- | --- |
| **Google Translate** | 什么都不用 | 默认选项。免费，不需要密钥。单次请求最多 5000 个字符。 |
| **DeepL API** | 一个 DeepL API 密钥 | 质量更高。免费密钥和付费密钥都能用。 |
| **DeepLX (self-hosted)** | 一个 DeepLX 服务器地址 | 用于自己运行的 DeepLX 服务器。 |
| **AI (via connection)** | 一个 AI 账号 | 用你的某个 AI 模型来翻译。 |

Google Translate 不需要任何设置。只有需要别的服务商提供的能力时，才去换。

### 设置语言

两个输入框决定语言，默认都是 `en`(英语)。

- **Model Language**(模型语言) 是 AI 模型理解并用来回复的语言。你用自己的语言输入时，消息会在 AI 读到之前翻译成这种语言。**Translate My Messages**(翻译我的消息) 和 **Translate draft**(翻译草稿) 用的就是它。
- **My Language**(我的语言) 是你阅读的语言。AI 的回复会翻译成这种语言。**Auto-Translate Responses**(自动翻译回复) 和每条消息上的 **Translate** 按钮用的就是它。

例如，你用西班牙语写作，而 AI 用英语效果最好，就把 **Model Language** 设为 `en`，把 **My Language** 设为 `es`。

Google Translate、DeepL API 和 DeepLX 填简短的语言代码，例如 `en`、`ja`、`es`、`de`、`fr`、`zh` 或 `ko`。AI (via connection) 填语言名称，例如 `English`、`Japanese` 或 `Spanish`。

如果没有成功：代码或名称填错时，会报错，或者文本原样不变。检查一下服务商要求的格式。

### DeepL API

选择 **DeepL API**，把 DeepL 账号的密钥粘贴到 **DeepL API Key**(DeepL API 密钥) 里。以 `:fx` 结尾的是免费版密钥，Marinara 会把它发到 DeepL 的免费服务。其他密钥一律按付费密钥处理。

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLX 是一个需要自己运行的免费翻译服务器。选择 **DeepLX (self-hosted)**，在 **DeepLX URL**(DeepLX 地址) 里填入服务器的地址，例如 `http://localhost:1188`。

跑在自己电脑或局域网里的 DeepLX 服务器使用的是本地地址。出于安全考虑，Marinara 默认会拦截本地地址。想放行的话，在 `.env` 文件里加上这一行并保存。不用重启，通常几秒之内就会生效，最多约 30 秒。文件在哪里见[服务器配置参考](../CONFIGURATION.md)。

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

DeepLX 服务器在公网地址上的话，就不需要这项设置。

### AI (via connection)

选择 **AI (via connection)**，用你的某个 AI 模型来翻译。此时会出现三个输入框。

- **Connection**(连接)：由哪个 AI 账号负责翻译，必须选。留空的话翻译会失败，并提示“Connection ID is required for AI translation”。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。
- **Outgoing Message Prompt**(传出消息提示词) 和 **Incoming Response Prompt**(传入回复提示词)：AI 翻译你的消息和它自己的回复时收到的指令。两者一开始都是内置的默认提示词，可以只针对当前聊天修改。`{{targetLanguage}}` 会替换成 **Model Language** 或 **My Language**。改动某段提示词之后，**Restore**(恢复) 可以把它恢复原样。默认提示词是：

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## 开启自动翻译

服务商设置下面有四个开关，默认全部关闭。

- **Auto-Translate Responses**：在 AI 回复生成完成后立刻翻译。在 Game Mode 下，Marinara 会先把叙述里只给游戏主持人（GM）看的标记去掉。
- **Translate My Messages**：在你的消息发给 AI 之前，先把它翻译成 **Model Language**，译文替换你输入的原文。翻译失败时，Marinara 会发送原文，并显示一条错误提示。
- **Show Draft Translate Button**(显示草稿翻译按钮)：在 **Send**(发送) 旁边加一个 **Translate draft** 按钮，让你在发送前检查和修改译文。它相当于 **Translate My Messages** 的手动版。
- **Show Only Translation**(仅显示译文)：翻译过的消息只显示译文，代替原文，而不是把两者一起显示。

在 Conversation 模式中，无论桌面端还是移动端，都可以随时通过消息输入框的笑脸按钮，再选 **Tools → Translate draft**(工具 → 翻译草稿)，翻译尚未发送的草稿。两个开关都不需要开启。它使用当前聊天的输入翻译设置，把草稿替换为译文供你检查。它不会发送任何东西。翻译失败时，草稿保持原样。

<a id="translator-defaults-for-new-chats"></a>

## 新聊天的翻译默认设置

开关下面的 **Save translator defaults**(保存翻译默认设置) 会把这个聊天的翻译设置保存下来，供所有模式的新聊天使用。设置向导和设置方案里的设置优先。已有的聊天保留各自的设置。**Forget saved defaults**(清除已保存的默认设置) 会清除它们。[Noodle](../agents/noodle-settings.md#translation) 也使用同一套默认设置。

DeepL API 密钥和 DeepLX 地址只保存在这个 Marinara 安装实例里。聊天导出、导出的设置方案和 **Export Profile**(导出档案) 文件都不包含它们，导入其中任何一种也绝不会设置它们。把聊天挪到另一个安装实例后，请重新填写。

## 翻译单条消息

每条消息，不管是你的还是 AI 的，操作栏里都有一个 **Translate** 按钮（语言图标）。它不需要上面任何一个开关就能用。

1. 把指针移到消息上，手机上则点一下，让操作栏显示出来。
2. 点击 **Translate**。
3. 译文出现在这条消息下方；开启 **Show Only Translation** 时则代替原文显示。
4. 再点一次这个按钮就能收起译文，此时它的标签变成 **Hide translation**(隐藏译文)。

译文会跟消息一起保存下来，刷新页面或切换聊天都不会丢。它使用上面那一节设置的服务商和 **My Language**。

## 各服务商的限制

- **Google Translate** 不接受超过 5000 个字符的文本，会报错“Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts.”
- **DeepL API**、**DeepLX (self-hosted)** 和 **AI (via connection)** 能处理更长的文本，服务器端的上限是单次请求 50000 个字符。
- **Google Translate**、**DeepL API** 和 **DeepLX (self-hosted)** 超过 15 秒就会中止并报错。
- **AI (via connection)** 遵循 AI 模型自身的超时设置，不受这 15 秒的限制。
- **DeepLX (self-hosted)** 指向本地地址时会被拦截，除非设置了 `DEEPLX_LOCAL_URLS_ENABLED=true`。

## 相关指南

- [消息操作：编辑、删除、备选回复、重新生成](../chats/messages.md)
- [聊天设置总览](../chats/chat-settings.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [服务器配置参考](../CONFIGURATION.md)
