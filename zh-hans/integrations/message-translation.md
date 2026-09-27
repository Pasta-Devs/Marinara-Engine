# 消息翻译

Marinara Engine 可以把聊天消息在不同语言之间互译。本指南介绍四种翻译服务商、自动翻译开关、每条消息上的 Translate(翻译) 按钮，以及各家服务商的限制。

翻译是按聊天分别设置的。每个聊天都有自己的服务商、目标语言和密钥。在一个聊天里填的设置不会带到另一个聊天。

## 翻译设置在哪里

1. 在任意模式下打开一个聊天（Conversation、Roleplay 或 Game）。
2. 打开这个聊天的 **Chat Settings**(聊天设置) 面板。
3. 找到 **Translation**(翻译) 这一节。

下面讲到的服务商设置和各个开关，全都在 **Translation** 这一节里。

## 选择服务商

**Provider**(服务商) 下拉菜单有四个选项：

| 服务商 | 需要什么 | 说明 |
|---|---|---|
| **Google Translate** | 什么都不用 | 默认选项。免费，不需要密钥。单次请求最多 5000 个字符。 |
| **DeepL API** | 一个 DeepL API 密钥 | 质量更高。免费密钥和付费密钥都能用。 |
| **DeepLX (self-hosted)** | 一个 DeepLX 服务器地址 | 用于自己搭建的 DeepLX 实例。 |
| **AI (via connection)** | 一个 AI 连接 | 调用已配置好的 AI 服务商来翻译。 |

默认选中的是 **Google Translate**，不需要任何设置。只有需要下面这些能力时，才去换别的服务商。

### Target Language

**Target Language**(目标语言) 输入框决定译文的语言。默认是 `en`(英语)。

填写格式取决于服务商：

- **Google Translate**、**DeepL API** 和 **DeepLX (self-hosted)** 填语言代码，例如 `en`、`ja`、`es`、`de`、`fr`、`zh`、`ko`。
- **AI (via connection)** 填语言名称，例如 `English`、`Japanese`、`Spanish`。

### DeepL API 的设置

选择 **DeepL API** 之后会多出一个 **DeepL API Key**(DeepL API 密钥) 输入框。把 DeepL 账号的密钥粘贴进去。DeepL 密钥长这样：

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

以 `:fx` 结尾的是免费版密钥，Marinara 会把请求发到 DeepL 的免费服务。其他形式的密钥一律按付费密钥处理。

### DeepLX 的设置

DeepLX 是一个免费的翻译服务器，需要自己搭建运行。选择 **DeepLX (self-hosted)** 之后会多出一个 **DeepLX URL**(DeepLX 地址) 输入框，填入 DeepLX 服务器的地址，例如：

```
http://localhost:1188
```

如果 DeepLX 服务器跑在自己的电脑或局域网里，那么它的地址属于本地地址。出于安全考虑，Marinara 默认会拦截发往本地地址的请求。想放行的话，在 `.env` 文件里加上这一行并保存：

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

`.env` 是服务器的设置文件，具体位置见[服务器配置参考](../CONFIGURATION.md)。不用重启服务器，改动几秒钟之内就会生效。

如果 DeepLX 服务器在公网地址上，就不需要这项设置。默认被拦截的只有本地地址和内网地址。

### AI 翻译的设置

选择 **AI (via connection)** 之后，Marinara 会调用已配置好的 AI 服务商来翻译，此时会多出两个输入框。

**Connection**(连接) 下拉菜单用来指定由哪个 AI 连接负责翻译，必须选。留空的话翻译会失败，并提示“Connection ID is required for AI translation”。连接就是保存下来的一套 AI 服务接入信息，创建方法见下面的连接指南。

**AI Prompt**(AI 提示词) 输入框里是发给 AI 的翻译指令，内置了一段默认提示词（Marinara Engine 发给 AI 的那段文字）。这段内容可以只针对当前聊天修改。改动之后旁边会出现 **Restore**(恢复) 按钮，点它就能恢复成内置默认值。默认提示词是：

```
You are a translator. Translate the given text accurately, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## 三个自动翻译开关

服务商设置下面有三个开关，默认全部关闭。

**Auto-Translate Responses**(自动翻译回复) 会在 AI 回复生成完成后立刻自动翻译。在 Game Mode 下，Marinara 会先把叙述里只给游戏主持人（GM）看的标记去掉，再翻译。

**Translate My Messages**(翻译我的消息) 会在你的消息发给 AI 之前，先把它翻译成目标语言，译文直接替换你输入的原文。万一翻译失败，Marinara 会改为发送原文，并显示一条错误提示。

**Show Draft Translate Button**(显示草稿翻译按钮) 会在 **Send**(发送) 按钮旁边加一个 **Translate draft**(翻译草稿) 按钮，让你先翻译再检查或修改，然后才发出去。它相当于 **Translate My Messages** 的手动版，后者是发送时直接翻译，没有检查的机会。

在 **Conversation** 模式中，无论使用桌面端还是移动端，都可以通过消息输入框的笑脸按钮 → **Tools → Translate draft**（工具 → 翻译草稿）翻译尚未发送的草稿。无需开启 **Show Draft Translate Button** 或自动翻译。该操作使用当前聊天的输入翻译设置，将草稿替换为译文供你检查，不会发送消息。如果翻译失败，草稿会保持原样。

## 每条消息上的 Translate 按钮

不管是你的消息还是 AI 的消息，鼠标悬停时出现的操作栏里都有一个 **Translate** 按钮，图标是一个语言符号。这个按钮单独就能用，和上面三个开关没有关系。

1. 把鼠标移到消息上，让操作栏显示出来。
2. 点击 **Translate** 按钮。
3. 译文出现在这条消息下方。
4. 再点一次同一个按钮就能收起译文，此时它的悬停提示变成 **Hide translation**(隐藏译文)。

这样得到的译文会跟消息一起保存下来。刷新页面不会丢，切换到别的聊天再切回来也还在。

每条消息上的按钮，用的就是 **Translation** 这一节里设置的服务商和目标语言。

## 各服务商的限制

选服务商时记得考虑下面这些限制。

- **Google Translate** 不接受超过 5000 个字符的文本，会报错“Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts.”文本更长时改用 DeepL 或 AI。
- **DeepL API**、**DeepLX (self-hosted)** 和 **AI (via connection)** 能处理更长的文本，服务器端的上限是单次请求 50000 个字符。
- **Google Translate**、**DeepL API** 和 **DeepLX (self-hosted)** 超过 15 秒还没完成就会中止并报错。
- **AI (via connection)** 走的是所选连接自身的模型和超时（等待一个任务的最长时间）设置，不受这 15 秒的限制。
- **DeepLX (self-hosted)** 指向本地地址时会被拦截，除非按上面的说明设置 `DEEPLX_LOCAL_URLS_ENABLED=true`。

## 相关指南

- [消息操作：编辑、删除、备选回复、重新生成](../chats/messages.md)
- [聊天设置总览](../chats/chat-settings.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [服务器配置参考](../CONFIGURATION.md)
