# Marinara 的数据保存在哪里

找到 Marinara Engine 保存数据的文件夹，并了解搬移或复制数据时需要保留哪些部分。

Marinara 运行在你自己的电脑上，角色、聊天和设置都保存在那里。生成回复时，Marinara 仍会把聊天内容发送给你连接的 AI 服务商。

## 查找数据文件夹

你创建的所有内容都保存在运行服务器的那台电脑上的同一个文件夹里。这就是数据文件夹。它由 `DATA_DIR` 设置，这是一个在服务器启动前提供的值（环境变量）。它不在 **Settings**(设置) 里。

- 默认情况下，它是服务器文件旁边一个名为 `data` 的文件夹。
- 在官方 Docker 容器中，它是 `/app/data`。
- 要查看确切路径，请查看你启动 Marinara 时所用的窗口（终端或控制台）。Marinara 启动时会打印一行以 `[storage] DATA_DIR=` 开头、后面跟着路径的内容。如果找不到那个窗口，请在 Marinara 文件夹里查找名为 `data` 的文件夹。

要搬移该文件夹，请设置 `DATA_DIR` 并重启 Marinara。参见[服务器配置参考](../CONFIGURATION.md)。

## 文件夹里有什么

你的文本数据保存在 `storage` 文件夹中：角色、聊天、消息、世界书、预设和连接。Marinara 把它们保存为许多小文件。从旧版结构升级之后，`storage/tables/` 里可能会出现名称以 `.pre-shard` 结尾的旧副本。Marinara 从不删除它们。确认一切正常之后，你可以自行删除它们以释放空间。

图片、音频和其他文件保存在各自的文件夹中，与 `storage` 并排。文件夹名称如下：

| 文件夹 | 存放内容 |
| --- | --- |
| `avatars` | 角色和用户角色的头像 |
| `sprites` | 角色立绘 |
| `avatar-models` | **2D Avatars**(2D 虚拟形象) 和 **3D Avatars**(3D 虚拟形象) 智能体所用的文件，例如 PNGTuber 图片和 3D 模型 |
| `backgrounds` | 你上传的聊天背景 |
| `gallery` | 图库图片 |
| `fonts` | 你添加的自定义字体 |
| `knowledge-sources` | 你为知识智能体上传的文件 |
| `game-assets` | Game Mode 素材 |
| `game-scene-videos` | Game Mode 场景视频 |
| `conversation-call-character-videos` | Conversation(对话模式) 通话中使用的角色视频 |
| `custom-emojis` | 自定义 emoji 图片 |
| `custom-stickers` | 自定义贴纸图片 |
| `notification-sounds` | 你自定义的通知音 |
| `long-term-memory` | 长期记忆智能体的数据 |
| `lorebooks/images`、`prompts/images`、`agents/images`、`connections/images` | 附加在世界书、预设、智能体和账号上的图片 |

数据文件夹里还有 `backups/`（你的[自动备份](backup-and-restore.md#automatic-backups)）和加密密钥文件。**Download Backup** 会包含表格中的所有文件夹、`storage` 以及密钥文件。开发者可以阅读[文件原生存储](../development/file-storage.md)。

## 保管加密密钥文件

Marinara 会加密你保存的 API 密钥。用于加密的密钥是数据文件夹中的 `.encryption-key` 文件。

如果把数据复制到新电脑时没有带上这个文件，Marinara 就无法读取已保存的 API 密钥，你必须重新填写。请把它和数据文件夹的其余内容一起复制。

有些部署通过 `ENCRYPTION_KEY` 环境变量提供密钥。这种情况下没有文件需要复制，请单独妥善保管该值。参见[服务器配置参考](../CONFIGURATION.md)。

## 从 Android 复制数据

在 Android 上，数据文件夹位于应用存储空间中，没有 root 权限就无法访问，因此无法直接复制。请使用 **Settings → Advanced → Backup & Export → Download Backup**(设置 → 高级 → 备份与导出 → 下载备份)。`.zip` 中会包含 `.encryption-key` 文件（如果存在）。参见[备份与恢复 Marinara](backup-and-restore.md)。

自动备份也保存在同一个应用存储空间中。卸载或重置应用时，它们可能会和实时数据一起被删除，因此请在别处另存一份。

## 相关指南

- [备份与恢复 Marinara](backup-and-restore.md)
- [清除或重置数据](clearing-data.md)
- [服务器配置参考](../CONFIGURATION.md)
- [文件原生存储](../development/file-storage.md)
