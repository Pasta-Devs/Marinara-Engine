# 清除或重置数据

使用 **Danger Zone**(危险区域) 永久删除部分或全部数据。删除无法撤销。

如果只想删除一个聊天或一个角色，请改用它自己的删除按钮。参见[管理聊天](../chats/managing-chats.md)和[创建与编辑角色](../characters/creating-and-editing-characters.md)。

**开始之前：** 先做一份备份。这里没有垃圾桶或回收站。参见[备份与恢复 Marinara](backup-and-restore.md)。如果你从其他设备使用 Marinara，还需要管理员密钥。参见[远程访问](../REMOTE_ACCESS.md)。

## 清除部分类别

1. 打开 **Settings → Advanced**，然后滚动到 **Danger Zone**。
2. 勾选你想删除的每个类别。**Select All**(全选) 会勾选所有复选框。全部勾选后，同一个按钮会变成 **Clear Selection**(取消全选)，并取消勾选这些复选框。
3. 点击 **Clear Selected Data**(清除选中的数据)。在你勾选一个类别之前，该按钮一直处于禁用状态。
4. 阅读警告。它会显示你选中了多少个类别。
5. 点击 **Confirm Delete**(确认删除)，或点击 **Cancel**(取消) 停止。确认之前，不会删除任何内容。

操作成功时，会显示一条消息，说明所选数据已清除。如果请求失败，会出现错误信息 “Failed to clear selected data.”。部分数据可能已经被清除，请检查剩余的内容。请确认你拥有管理员权限。

## 清除全部数据

1. 在 **Danger Zone** 中点击 **Clear All Data**(清除全部数据)。无需勾选任何复选框。
2. 警告会询问：“Delete all supported data categories except Professor Mari? There is no undo.”
3. 点击 **Confirm Delete**(确认删除)，或点击 **Cancel**(取消) 停止。

效果与勾选全部八个复选框后清除相同。

## 八类数据

每个类别只删除其所在行列出的内容，表格下方注明的图库文件夹除外。

| 类别 | 删除的内容 |
| --- | --- |
| **Chats & Messages**(聊天与消息) | 所有聊天及其内容，以及整个 `gallery` 文件夹和游戏场景视频。 |
| **Characters**(角色) | 所有角色和分组（Professor Mari 除外），连同它们的头像。 |
| **Personas**(用户角色) | 所有用户角色和分组，连同它们的头像。 |
| **Lorebooks**(世界书) | 所有世界书、条目和文件夹。 |
| **Presets**(预设) | 所有提示词预设和预设文件夹，内置标准预设除外。 |
| **Connections**(连接) | 所有已保存的账号，以及与之关联的模型选择和语音设置。 |
| **Automation & Addons**(自动化与插件) | 所有智能体设置、自定义工具、正则脚本和已同步的主题。不包括 Personal Extensions(个人扩展) 或 External Extensions。 |
| **Media & Assets**(媒体与素材) | 背景、头像、立绘、图库、场景视频、字体和知识源文件。 |

更多细节：

- **Chats & Messages** 还会删除备选回复（同一条消息上保留的多个回答）、记忆、智能体结果、游戏状态和聊天图片。
- **Characters** 和 **Personas** 还会删除 2D 和 3D 虚拟形象模型。
- **Presets** 还会删除它们的分组、分区和变量。如果另一个预设是默认预设，内置标准预设会成为默认预设。
- **Connections** 还会清除语音合成和语音识别设置、你为各项功能选择的模型，以及在 **3D Avatars** 页面保存的 Tripo API 密钥。
- **Automation & Addons** 还会删除智能体结果、智能体记忆、智能体文件夹和智能体首页小组件。
- **Media & Assets** 还会删除素材列表和聊天图片。
- 知识源文件是你为知识智能体上传的文件。已同步的主题是你在 Marinara 中保存的自定义主题。

有些类别会删除名称之外的文件。即使你没有勾选 **Characters** 或 **Personas**，**Chats & Messages** 也会删除整个 `gallery` 文件夹，包括角色和用户角色的图库图片。

清除操作不会影响你的其他设置、`backups/` 文件夹或 `.encryption-key` 文件。Personal Extensions、Game Mode 素材、自定义 emoji 和贴纸、通知音、世界书、预设、智能体和账号的图片，以及长期记忆文件也会保留。参见[Marinara 的数据保存在哪里](where-data-is-stored.md)。

## Professor Mari 始终保留

Professor Mari 是首页上的内置助手。**Danger Zone** 从不删除她，即使使用 **Clear All Data** 也一样。

## 相关指南

- [备份与恢复 Marinara](backup-and-restore.md)
- [Marinara 的数据保存在哪里](where-data-is-stored.md)
- [远程访问](../REMOTE_ACCESS.md)
