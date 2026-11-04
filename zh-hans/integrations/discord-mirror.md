# Discord 消息镜像

Discord 消息镜像会在你聊天时，把聊天消息复制一份到 Discord 频道里。Conversation(对话模式)、Roleplay(角色扮演) 和 Game Mode(游戏模式) 都支持。

它是单向转发。Marinara 只把消息发出去，Discord 那边没法回传任何内容，所以它不是双向机器人。镜像走的是 Discord webhook，这是一个特殊的 URL，有了它，一个应用就能往 Discord 频道里发消息。镜像按聊天单独设置。每个聊天有自己的 webhook URL，其他聊天保持关闭，直到你在每个聊天里各自粘贴一个 URL。

## 创建 Discord webhook URL

webhook 要在 Discord 里创建，不在 Marinara 里。你得有目标 Discord 频道的管理权限。

1. 打开 Discord 服务器，选中希望消息出现的那个频道。
2. 打开该频道的设置，依次进入 **Integrations**(集成) 和 **Webhooks**。
3. 新建一个 webhook，复制它的 webhook URL。

Discord webhook URL 长这样：

```text
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

这个 URL 要保密。拿到它的人都能往你的 Discord 频道里发消息。

## 开启镜像

webhook 输入框在每个聊天各自的设置里，位于 **Connected Chats**(关联聊天) 一节中。它的标签是 **Discord Mirror**(Discord 镜像)，占位文字是 `https://discord.com/api/webhooks/...`。

1. 打开想要镜像的聊天。
2. 打开 **Chat Settings**(聊天设置)。
3. 找到 **Connected Chats** 一节。
4. 把 webhook URL 粘贴到这一节靠下位置的输入框里。

这个聊天的镜像就开好了。想关闭的话，清空输入框即可。

如果没有成功：填的 URL 不是合法的 Discord webhook 时，输入框下方会出现红字“Invalid webhook URL format”。把 URL 改对，镜像设置就会保存。保存时 Marinara 还会在服务器端再校验一次 URL。

webhook URL 只保存在这个 Marinara 安装实例里。聊天导出、导出的设置方案和 **Export Profile**(导出档案) 文件都不包含它，导入其中任何一种也绝不会开启镜像。把聊天挪到另一个安装实例后，要在那边重新粘贴 URL 才能镜像。在这个安装实例里保存的设置方案，套用时仍会设置你的镜像。

## 会发送哪些内容

Marinara 会在消息和 AI 回复生成的同时把它们镜像过去。

- 发送者名称：你发的消息用当前用户角色的名字，AI 的消息用角色名。
- 在 Game Mode 里，队伍成员或 NPC(玩家之外的角色) 的回合以“Party”的名义发送，剧情旁白以“Narrator”的名义发送。如果游戏用的是 **Character GM**(由角色担任 GM) 选项，游戏主持人（GM）的回复会改用那个角色的名字。
- 不发送任何图片，Discord 上只显示发送者名称和文字。
- 长消息：Discord 限制单条消息最多 2000 个字符。超过 1997 个字符的消息会被截短，镜像过去的那条结尾是“...”
- 文本里的 @everyone、@here 之类的提及不会在你的 Discord 频道里真的通知到人。

## 不会发送哪些内容

- 重新生成的回复和备选回复不会再镜像一次。备选回复是保留在同一条消息上的另一个回答。每个回合只有第一条回复会发出去。
- Impersonate 生成的消息不镜像。Impersonate 这个功能是让 AI 替你写一条消息。
- 发送失败的消息不会重发。Discord 以速率限制（429）回应的发送也不会重发，见下文。发送失败时，聊天里不会显示错误。速率限制以外的失败只记录在服务器端。

## 速率限制

Discord 对应用发消息的频率有限制。每个 webhook，Marinara 最快约 1.2 秒发一条，差不多每分钟 50 条。多出来的消息进队列排队，按顺序依次发出。如果 Discord 对某次发送回应 429(放慢速度)，这条消息不会重发。Marinara 会等待 Discord 给出的 Retry-After 时间，然后继续发送队列里的下一条消息。

## 相关指南

- [把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)
