# Discord 消息镜像

本指南介绍 Marinara Engine 里的 Discord 消息镜像。聊天时，镜像会把消息单向复制一份到 Discord 频道里。Conversation(对话模式)、Roleplay(角色扮演) 和 Game Mode(游戏模式) 都支持。

## 镜像能做什么

Discord 消息镜像是单向转发。Marinara 只负责把消息发到 Discord 频道，Discord 那边的消息不会回传到 Marinara。它不是双向的 Discord 机器人。

镜像走的是 Discord webhook。webhook 是一个特殊的 URL，有了它，一个应用就能往 Discord 频道里发消息。

镜像按聊天单独设置，每个聊天有自己的 webhook URL。在某个聊天里粘贴一个 URL，就等于给这个聊天开了镜像。其他聊天不受影响，各自粘贴各自的 URL 才会生效。

## 创建 Discord webhook URL

webhook 要在 Discord 里创建，不在 Marinara 里。你得有目标 Discord 频道的管理权限。

1. 打开 Discord 服务器，选中希望消息出现的那个频道。
2. 打开该频道的设置，依次进入 **Integrations**(集成) 和 **Webhooks**。
3. 新建一个 webhook，复制它的 webhook URL。

Discord webhook URL 长这样：

```
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

这个 URL 要保密。拿到它的人都能往你的 Discord 频道里发消息。

## 开启镜像

webhook 设置在每个聊天各自的设置里，位于 **Connected Chats**(关联聊天) 一节中。输入框的标签是 **Discord Mirror**(Discord 镜像)，占位文字是 `https://discord.com/api/webhooks/...`。

1. 打开想要镜像的聊天。
2. 打开 **Chat Settings**(聊天设置)。
3. 找到 **Connected Chats** 一节。
4. 把 webhook URL 粘贴到这一节靠下位置的输入框里。

这个聊天的镜像就开好了。想关闭的话，清空输入框即可。

如果填的不是合法的 Discord webhook，输入框下方会出现红字“Invalid webhook URL format”。把 URL 改对，镜像设置就能保存。保存时 Marinara 还会在服务器端再校验一次。

webhook URL 只保存在这个 Marinara 安装实例里。聊天导出、导出的设置方案和 **Export Profile**(导出档案) 文件都不包含它，导入其中任何一种也绝不会开启镜像。把聊天挪到另一个安装实例后，要在那边重新粘贴 URL 才能镜像。在这个安装实例里保存的设置方案，套用时仍会设置你的镜像。

## 会发送哪些内容

Marinara 会在消息和 AI 回复生成的同时把它们镜像过去。

- 发送者名称：你发的消息用当前用户角色的名字，AI 的消息用角色名。
- 在 Game Mode 里，剧情旁白以“Narrator”的名义发送，队伍成员或 NPC(玩家之外的角色) 的回合以“Party”的名义发送。如果游戏用的是 **Character GM**(由角色担任 GM) 选项，游戏主持人（GM）的回复会改用那个角色的名字。
- 不发送任何图片，Discord 上只显示发送者名称和文字。
- 长消息：Discord 限制单条消息最多 2000 个字符。超过 1997 个字符的消息会被截短，镜像过去的那条结尾是“...”
- 文本里的 @everyone、@here 之类的提及不会在你的 Discord 频道里真的通知到人。

## 不会发送哪些内容

- 重新生成的回复和备选回复不会再镜像一次。每个回合只有第一条回复会发到 Discord。
- Impersonate 生成的消息不镜像。Impersonate 这个功能是让 AI 替你写一条消息。
- 发送到 Discord 失败时，Marinara 不会提示错误，也不会重试，只在服务器端记一条日志。

## 速率限制

Discord 对应用发消息的频率有限制。每个 webhook，Marinara 最快约 1.2 秒发一条，差不多每分钟 50 条。多出来的消息进队列排队，按顺序依次发出。如果 Discord 要求放慢速度，Marinara 会先等一会儿，再继续发。

## 相关指南

- [把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)
