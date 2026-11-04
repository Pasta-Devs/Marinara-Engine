# 发送消息与流式输出

输入一条消息，发出去，然后看着回复出现。本指南介绍发送消息、附件、流式输出、中断回复、重试，以及怎么读懂错误提示。

## 发送消息

开始之前：你的聊天需要一个模型。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

1. 在聊天底部的输入栏里打字。
2. 点击 **Send**(发送)；如果这个聊天模式开启了 **Send on Enter**(按 Enter 发送)，也可以按 <kbd>Enter</kbd>。

你的消息会先出现，接着回复以流式输出的方式逐步显示。同一个聊天同时只能生成一条回复。回复流式输出期间，**Send** 会变成停止按钮。

如果没有成功：聊天没有设置模型时，回复会立刻失败，并提示没有配置连接。在[聊天设置](chat-settings.md)里选一个。

### Send on Enter

它在 **Settings → General → Input & Editing**(设置 → 常规 → 输入与编辑) 里。每种聊天模式各有一个开关。

| 聊天模式 | 默认 | 关闭时 |
| --- | --- | --- |
| Roleplay | 关闭 | 按 <kbd>Enter</kbd> 会换行，需要点击 **Send** 发送。 |
| Conversations | 开启 | 按 <kbd>Ctrl</kbd>+<kbd>Enter</kbd>(Mac 上是 <kbd>Cmd</kbd>+<kbd>Enter</kbd>) 发送。 |
| Game | 开启 | 按 <kbd>Ctrl</kbd>+<kbd>Enter</kbd>(Mac 上是 <kbd>Cmd</kbd>+<kbd>Enter</kbd>) 发送。 |

Roleplay(角色扮演) 默认关闭，因为角色扮演的消息往往很长，需要换行。Professor Mari 有她自己的开关 **Enter sends to Professor Mari**(按 Enter 发送给 Professor Mari)，在 **Settings → General → Search and Professor Mari settings**(设置 → 常规 → Search 与 Professor Mari 设置) 里。

## 添加图片和文件附件

1. 点一下输入栏里的回形针。
2. 选一个文件。它会以小标签的形式显示在输入框上方。
3. 照常发送。

Marinara 接受图片、PDF 文件和纯文本文件（`.txt`、`.md`、`.markdown`、`.json`、`.jsonl`、`.csv`、`.log`、`.xml`、`.yaml`、`.yml`）。每个文件不能超过 20 MB。文件过大或类型不受支持时，Marinara 会拒绝它并给出提示。

只有支持视觉能力的模型才能看到图片。如果模型只能处理文本，就在 **Chat Settings → Advanced Parameters**(聊天设置 → 高级参数) 里开启 **Image captioning**(图像描述)。它默认关闭。开启后，Marinara 会用你选的模型把每张图片描述成文字，再用这段描述代替图片发出去。

## 在消息中显示图库图片

附件是给模型看的，图库链接则是在消息文字里把图片显示给你看。消息支持 Markdown 图片语法，Marinara 会把 `card://` 链接解析到图库文件：

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

在 Roleplay 中，聊天的资源浏览器可以帮你插入链接。你也可以把链接粘贴到消息、开场白和示例对话里。

引用角色自己图库里的图片时，使用可移植的 `card://self/gallery/<filename>` 形式。角色经过导出和导入后，它仍能正常工作。图库的 **Copy image reference**(复制图片引用) 按钮会生成这种链接。见[角色图库](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings)。

## 回复的流式输出

流式输出会把回复逐词显示出来，而不是一次性全部出现。这些设置在 **Settings → General → Responses**(设置 → 常规 → 回复) 里。

| 设置 | 默认 | 作用 |
| --- | --- | --- |
| **Enable streaming**(启用流式输出) | 开启 | 回复一边写一边显示。关闭后，模型写完时整段回复才会出现。 |
| **Streaming speed**(流式速度) | 50 | 1 到 100 的滑块。数值越低，打字机效果越慢。它不会改变模型写作的速度。 |
| **Trim incomplete sentences from the response**(裁掉回复中不完整的句子) | 关闭 | 保存回复前删掉结尾没写完的那句话。完整的回复和命令式结尾保持原样。 |

## 输入中和进度提示

在第一个字出现之前，你会看到角色名字后面跟着三个跳动的点。在群聊里，每个正在回复的角色名字都会显示。服务器准备提示词期间，会有一行进度提示轮换显示下面这些文案。有些步骤只在聊天用到对应功能时才执行，所以不一定每条都能看到。

- **Preparing context...**(准备上下文)
- **Building prompt...**(拼装提示词)
- **Scanning lorebooks...**(扫描世界书)
- **Recalling memories...**(唤起记忆)
- **Running agents...**(运行智能体)
- **Retrieving knowledge...**(检索知识)
- **Generating...**(生成中)

如果某个角色的状态是忙碌或离开，显示的就不是那三个点，而是等待提示。角色恢复可用后，回复才会开始。

## 查看模型的思考过程

有些模型会返回一段隐藏的推理过程，叫作“thinking”。回复带有这段内容时，消息上会出现一个大脑图标（**View model thoughts**(查看模型思考过程)）。点击它就能读到推理内容。

要让它生效，模型必须返回推理内容。有些模型会用纯文本标签把推理包起来。遇到这类模型，就在生成设置里设置 **Thinking Tags**(思考标签)，让 Marinara 能把推理和回复分开。见[生成参数](../prompts/generation-parameters.md)。

## 中断回复

点击停止按钮，也就是回复流式输出期间的 **Send** 按钮。已经输出的文字通常会保留。主动中断永远不会显示错误。

<a id="retry-without-retyping"></a>

## 不用重打就能重试

如果最后一条消息是你发的，而 AI 一直没有回复，就让输入框保持为空，点击 **Send**(或按 <kbd>Enter</kbd>)。Marinara 会开始生成一条新回复，不会多出一条重复的消息。在 Conversation(对话模式) 中，按钮在这种状态下会显示一个环形箭头。如果输入框里有草稿，**Send** 就会把草稿发出去。

在 Roleplay 中，即使 AI 已经回答过，空输入时点 **Send** 也会开始一条全新的回复。它不会接着上一条回复往下写。要延长上一条回复，用 `/continue`。见[消息操作](messages.md)。

## 生成出错时

回复失败时，屏幕底部会弹出一条通知（一条简短的弹出消息），停留大约 15 秒。通知里的文字可以复制。对于某些错误，Marinara 会把它改写成下一步该怎么做：

| 原因 | 通知告诉你的内容 |
| --- | --- |
| 模型拒绝了一个它不支持的参数 | 打开 **Chat Settings → Advanced Parameters**，把该参数的 **Send** 关掉。 |
| 模型要求一个已关闭的参数 | 在同一个位置把 **Send** 重新打开。 |
| 回复返回的内容为空 | 再发一次你的消息。 |
| 已经有一条回复在生成 | 等它结束，或者用停止按钮中断。 |
| 没有配置连接 | 为这个聊天设置一个。 |

如果错误反复出现，见[故障排查](../TROUBLESHOOTING.md)。

## 网络慢和手机上的选项卡

长回复可能要花一些时间，你随时都可以中断它。在手机上，切到别处后浏览器可能会暂停聊天选项卡。如果当时回复正在流式输出，Marinara 会显示 **Finishing in background...**(正在后台完成)，然后检查服务器上的回复是否已经写完。如果回复还没出现，稍等片刻再刷新聊天。
