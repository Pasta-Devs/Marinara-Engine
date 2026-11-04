# 导出与导入聊天

把聊天保存成文件，分享成可读的故事，或者把来自 Marinara 或 SillyTavern(另一款角色扮演聊天应用) 的聊天文件重新加载进来。可以导出单个聊天、聊天的一部分，也可以一次导出多个聊天。

<a id="file-formats-you-will-see"></a>

## 会遇到的文件格式

| 格式 | 说明 | 能重新导入吗？ |
| --- | --- | --- |
| **JSONL** | JSON Lines 的缩写，一种纯文本文件，每行保存一条消息。这是默认格式。 | 能 |
| **Text** | 可读的 `.txt` 记录。 | 不能 |
| **Markdown** | 可读的 `.md` 文件。开头是聊天名称和它涵盖的日期，之后每条消息都列在发言者的名字下面。 | 不能 |
| **Story** | 带样式的 `.html` 网页，显示每位发言者的名字和头像。用浏览器打开就能阅读、分享或打印。 | 不能 |

**Markdown** 和 **Story** 文件不包含系统消息，也不包含对你隐藏的消息。聊天导入只接受 `.jsonl` 文件，所以以后还想导入这个聊天的话，请导出成 **JSONL**。

**JSONL** 文件不会带上聊天里保存的几个地址：Discord 镜像的 webhook、DeepLX 地址、DeepL 密钥和 Intiface 地址。导入时也绝不会把它们带进来。如果你用到了这些，请在导入后的聊天的 **Chat Settings**(聊天设置) 里重新填写。

## 导出单个聊天

1. 打开这个聊天。
2. 打开 **Chat Settings**，展开 **Chat Name** 下方的 **Chat Branches**(聊天分支)。即使聊天只有一个分支，导出按钮也在这个区域里。
3. 点击 **JSONL**、**Text**、**Markdown** 或 **Story**。

浏览器随即下载文件。文件里是你正在查看的分支及其消息。

<a id="export-part-of-a-chat"></a>

## 导出聊天的一部分

想只保存部分消息，就用 **Export a range**(导出指定范围)。Game(游戏模式) 聊天里没有这个功能。

1. 在 **Chat Branches** 里点击 **Export a range**。
2. 先点击第一条消息，再点击最后一条消息。提示文字是“Select the first and last message to export.”
3. 点击 **Export selected**(导出所选)。
4. 在 **Export messages**(导出消息) 窗口里核对消息数量以及第一条和最后一条消息，然后选择 **Text**、**Markdown**、**JSONL** 或 **Story**。

Marinara 会导出从你选的第一条到最后一条之间的所有消息。点击 **Cancel**(取消) 可以中止，不导出任何内容。

## 一次导出多个聊天

1. 在左侧边栏点击要用的模式选项卡：**CONVO**、**RP** 或 **GM**。每个选项卡只导出自己名下的聊天。
2. 点击列表顶部的 **Select chats**(选择聊天)。
3. 逐个点击要导出的聊天。底部会出现一个条，显示已选数量，比如“3 selected”。
4. 点击这个条上的 **Export**(导出)。

浏览器随即下载一个 `.zip` 文件，里面每个聊天一份 JSONL 记录。批量导出固定使用 **JSONL**。见[管理聊天列表](managing-chats.md#selecting-multiple-chats)。

## 把聊天导入成新聊天

这种方式用 Marinara 保存的或从 SillyTavern 导出的 `.jsonl` 文件新建一个聊天。

1. 在左侧边栏点击要用的模式选项卡。导入的聊天采用当前打开的选项卡的模式，而不是文件里记录的模式。
2. 点击 **+** 按钮旁边的 **Import**(导入) 按钮。它的标签是 **Import SillyTavern or Marinara chat JSONL**。
3. 选择你的 `.jsonl` 文件。

屏幕上会出现“Imported N messages”，Marinara 随即打开新聊天。想深入了解 SillyTavern 文件，见[从 SillyTavern 导入](../data/importing-from-sillytavern.md)。

如果没有成功：屏幕底部会出现一条小提示，写着 **Import failed** 和原因。检查文件名是否以 `.jsonl` 结尾。

## 把聊天导入成新分支

这种方式把 `.jsonl` 文件加载进已有的聊天，成为一条新分支。见[聊天分支](branches.md)。

1. 打开要添加分支的那个聊天。
2. 打开 **Chat Settings**，展开 **Chat Branches**，点击 **Import**。
3. 选择你的 `.jsonl` 文件。

屏幕上会出现“Imported N messages as a new branch”。新分支沿用当前聊天的角色、用户角色、连接和提示词预设。

## 让导出文件包含推理内容和私人笔记

有两个设置决定隐藏的文字要不要写进导出文件。两者都是 **Settings → Advanced → Message Tools**(设置 → 高级 → 消息工具) 里的开关，默认都是关闭的。单个聊天的导出和 `.zip` 导出都受它们影响。

| 设置 | 开启时 |
| --- | --- |
| **Include reasoning in exports**(导出时包含推理内容) | 把模型保存的思考内容加入每一种格式。在 **Markdown** 和 **Story** 文件里，它位于消息下方一个可折叠的 **Thinking** 部分中。 |
| **Include private notes in exports**(导出时包含私人笔记) | 把你给消息写的私人笔记加入 **JSONL** 和 **Text** 导出。 |

> **警告：** 分享聊天记录之前，让这两个设置都保持关闭。隐藏的推理和私人笔记里可能有你本不打算发出去的内容。
