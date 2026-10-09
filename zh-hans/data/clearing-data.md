# 清除或重置数据

本指南介绍如何用 **Danger Zone**(危险区域) 永久删除 Marinara Engine 里的数据。既可以只清除其中几类，也可以全部抹掉。删除无法撤销，动手前先把警告读完。

## Danger Zone 在哪里

清除数据的所有工具都集中在同一处。

1. 打开 **Settings**(设置)。
2. 切换到 **Advanced** 选项卡。
3. 滚动到底部的 **Danger Zone** 一节。

**Danger Zone** 下方的说明写着：“Permanently clear selected categories of local data. Professor Mari is always preserved.”

如果不是在运行应用的那台电脑上、而是从别的设备访问 Marinara，清除数据需要管理员权限。配置方法见[远程访问](../REMOTE_ACCESS.md)。

## 清除之前先备份

清除数据无法撤销，既没有垃圾桶也没有回收站。一旦确认，数据就没了。

先做一份备份，改主意时还能恢复回来。见[备份与恢复 Marinara](backup-and-restore.md)。

## 8 类数据

**Danger Zone** 里列出了 8 类数据的复选框。每一类都是独立范围，勾选其中一类不会影响其他类。

| 类别 | 清除的内容 |
|---|---|
| **Chats & Messages** | 聊天、文件夹、消息、场景和 OOC 数据，以及聊天运行时状态。 |
| **Characters** | 角色和角色分组。Professor Mari 始终保留。 |
| **Personas** | 用户角色和用户角色分组。 |
| **Lorebooks** | 世界书和世界书条目。 |
| **Presets** | 提示词预设、分组、分区和变量。 |
| **Connections** | API 连接和模型端点。 |
| **Automation & Addons** | 智能体、工具、正则脚本、已同步的主题，以及自动化状态。 |
| **Media & Assets** | 背景、头像、立绘、图库项目、字体和知识源文件。 |

有几类删除的不只是数据库记录。**Chats & Messages** 还会删掉磁盘上的整个图库文件夹和全部场景视频文件，其中包括角色和用户角色的图库图片，哪怕没有勾选 **Characters** 或 **Personas** 也一样。**Media & Assets** 会删除磁盘上存放背景、头像、立绘、图库、场景视频文件、字体和知识源文件的文件夹。**Connections** 还会清空保存的语音合成（TTS）和语音识别（Speech to Text）设置，因为这些设置是挂在连接上的。

## 清除选中的类别

想抹掉一部分数据、保留其余部分时用这种方式。

1. 勾选每一个要删除的类别。
2. 想一次性切换全部复选框，用 **Select All**(全选) 按钮。全部勾选后，同一个按钮会变成 **Clear Selection**(取消全选)，可以再一次性取消勾选。
3. 点击 **Clear Selected Data**(清除选中的数据)。至少勾选一个类别之前，这个按钮一直是禁用状态。
4. 界面会弹出一个警告框，写明选中了多少个类别，并提醒删除无法撤销。
5. 点击 **Cancel** 放弃，或点击 **Confirm Delete** 执行删除。在点击 **Confirm Delete** 之前不会删除任何东西。

清除成功后会看到一条确认消息，说明选中的数据已清除、运行时缓存也已立即重置。

## 清除全部数据

想一步抹掉全部 8 个类别时用这种方式。

1. 点击 **Clear All Data**(清除全部数据)，不需要事先勾选任何复选框。
2. 弹出的警告框会问：“Delete all supported data categories except Professor Mari? There is no undo.”
3. 点击 **Cancel** 放弃，或点击 **Confirm Delete** 删除全部数据。

效果和勾选全部复选框后一起清除完全相同。

## Professor Mari 始终保留

Professor Mari 是内置的助手角色，这项功能永远不会删除她。就算清除 **Characters** 类别或者使用 **Clear All Data**，Professor Mari 依然在原处。在 **Danger Zone** 里没办法把她删掉。

## 相关指南

- [备份与恢复 Marinara](backup-and-restore.md)
- [远程访问](../REMOTE_ACCESS.md)
