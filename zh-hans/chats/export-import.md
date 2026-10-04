# 导出与导入聊天

本指南介绍怎么把聊天保存成文件，以及怎么把聊天重新加载回 Marinara Engine。既可以导出单个聊天，也可以一次导出多个。Marinara 导出的聊天文件可以导入，SillyTavern(另一款角色扮演聊天应用) 导出的文件同样可以。

## 会遇到的文件格式

Marinara 有两种聊天文件格式。

- **JSONL**：JSONL 是 JSON Lines 的缩写，一种纯文本文件，每行保存一条消息。这是默认的导出格式，之后可以重新导入 Marinara。
- **Text**：可读性强的纯文本 `.txt` 记录，方便阅读和分享，但 Marinara 没法把它导入回来。只有想给人看聊天内容时才选 **Text**。

聊天导入功能只接受 `.jsonl` 文件。以后还打算重新导入的话，请导出成 **JSONL**，不要用 **Text**。

## 导出单个聊天

把一个聊天导出成文件，用 **Chat Settings** 里的 **Chat Branches**(聊天分支) 区域最快。

1. 打开要导出的聊天。
2. 打开 **Chat Settings**，展开 **Chat Name** 下方的 **Chat Branches**。
3. 点击 **JSONL** 保存成 JSONL 文件，或者点击 **Text** 保存成可读的文本文件。
4. 浏览器开始下载文件。

下载下来的就是当前打开的这个聊天，消息也都在里面。

## 一次导出多个聊天

可以选中多个聊天，打包成一个 `.zip` 文件一起下载。

1. 打开左侧边栏的聊天列表。
2. 选择需要的模式选项卡：**CONVO**(Conversation)、**RP**(Roleplay) 或 **GM**(Game)。每个选项卡只导出自己名下的聊天。
3. 点击聊天列表顶部的 **Select chats**(选择聊天) 按钮。
4. 逐个点击要包含进去的聊天，每个都会打上一个复选框。
5. 底部会出现一个条，显示已选中的数量，比如“3 selected”。
6. 点击这个条上的 **Export**(导出)。
7. 浏览器开始下载一个 `.zip` 文件，里面是一个聊天一份的 JSONL 记录。

批量导出固定使用 **JSONL** 格式。同一个条上的 **Delete**(删除) 是删除选中的聊天，只在确实想删除时才点。

## 把聊天导入成新聊天

这种方式会用 `.jsonl` 文件新建一个聊天，适合导入 Marinara 保存的聊天文件或者从 SillyTavern 导出的文件。

1. 打开左侧边栏的聊天列表。
2. 选择需要的模式选项卡：**CONVO**、**RP** 或 **GM**。Marinara 会把导入的聊天建在当前打开的选项卡下。
3. 点击列表顶部 **New**(新建) 按钮旁边的导入按钮，它的提示文字是 **Import SillyTavern or Marinara chat JSONL**。
4. 在文件选择器里选中 `.jsonl` 文件。
5. 屏幕上会出现“Imported N messages”的提示，Marinara 随即切换到新聊天。

想让新聊天用 Roleplay 模式，导入前先打开 **RP** 选项卡。决定模式的是当前打开的选项卡，不是文件本身。

## 把聊天导入成新分支

`.jsonl` 文件也可以加载进现有聊天，成为一条新分支。分支就是聊天的一份独立副本，可以单独往下发展。关于分支的更多说明，见[聊天分支](branches.md)。

1. 打开要添加分支的那个聊天。
2. 打开 **Chat Settings**，展开 **Chat Branches** 区域。
3. 点击这个区域里的 **Import**(导入)。
4. 选中 `.jsonl` 文件。
5. 屏幕上会出现“Imported N messages as a new branch”的提示。

新分支挂在当前打开的聊天下，沿用它的角色、用户角色、连接和提示词预设。

## 让导出文件包含推理内容

有些模型会随回复一起保存隐藏的思考或推理文字。这些隐藏内容要不要写进导出文件，由一个设置决定。

这个设置叫 **Include reasoning in exports**(导出时包含推理内容)，位置在 **Settings**(设置) 的 **Advanced** 选项卡下、**Message Tools** 分区里。它是一个开关，默认**关闭**。

- **关闭**时，**JSONL** 和 **Text** 两种导出都不会带上保存的思考和推理文字。
- **开启**时，Marinara 会把这些隐藏的思考和推理文字写进两种格式。

单个聊天的导出和批量 `.zip` 导出都受这个设置影响。

把聊天记录分享给别人之前，记得让 **Include reasoning in exports** 保持关闭。隐藏的推理里可能有本来不打算一并发出去的内容。只有想给自己留一份完整记录时才开启。

## 相关指南

- [聊天分支](branches.md)
- [从 SillyTavern 导入](../data/importing-from-sillytavern.md)
- [备份与恢复 Marinara](../data/backup-and-restore.md)
- [设置总览](../settings/settings-overview.md)
