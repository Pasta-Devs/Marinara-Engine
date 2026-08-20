# Marinara 的数据保存在哪里

本指南介绍 Marinara Engine 把数据存在自己电脑上的什么位置，包括主数据文件夹、它里面的 `storage` 文件夹和各个素材文件夹，以及保护已保存 API 密钥的加密密钥文件。

Marinara Engine(下文简称 Marinara) 运行在自己的机器上。保存下来的角色、聊天和设置只存在自己的电脑里。不过要注意，生成回复时 Marinara 仍会把聊天内容发给已连接的 AI 服务商。

## 数据文件夹（DATA_DIR）

在 Marinara 里创建的一切，都放在运行服务器的那台机器上的同一个文件夹中。这个文件夹叫数据文件夹，指向它的环境变量名为 `DATA_DIR`。环境变量是在应用之外、在服务器上设置的一个值，在应用的 **Settings**(设置) 面板里找不到它。

默认情况下，数据文件夹就是 Marinara 在服务器文件旁边创建的一个名为 `data` 的文件夹。如果用官方 Docker 容器运行 Marinara，数据文件夹是容器内的 `/app/data`。

不确定数据文件夹在哪，可以看服务器的启动日志。Marinara 启动时会打印一行以 `[storage] DATA_DIR=` 开头的内容，后面跟着数据文件夹的完整路径。

自己设置 `DATA_DIR`，就能把数据文件夹挪到别的位置。设置方法见[服务器配置参考](../CONFIGURATION.md)。新的 `DATA_DIR` 值要重启 Marinara 才会生效。

## storage 文件夹和素材文件夹

在数据文件夹内部，数据分成一个 `storage` 文件夹和若干素材文件夹。

`storage` 文件夹存放角色、聊天、消息、世界书、预设和连接等文本数据。Marinara 会把每张表保存为按所有者分组的小文件，例如一个聊天的消息或一本世界书的条目，因此修改一项内容不会重写不断增长的全局 JSON 文件。从旧存储进行一次性升级时，Marinara 会把原始表文件以 `.pre-shard` 后缀保留在新文件夹旁边。

图像、音频和其他媒体文件各有自己的文件夹，文件夹名就是它装的东西。主要的素材文件夹如下：

| 文件夹 | 存放内容 |
| --- | --- |
| `avatars` | 角色头像和用户角色头像 |
| `sprites` | 角色立绘 |
| `backgrounds` | 上传的聊天背景 |
| `gallery` | 图库图片 |
| `fonts` | 添加的自定义字体 |
| `knowledge-sources` | 为知识智能体上传的文件 |
| `game-assets` | Game Mode 素材 |
| `custom-emojis` | 自定义 emoji 图片 |
| `custom-stickers` | 自定义贴纸图片 |

想深入了解 `storage` 文件夹的技术原理，开发者可以读[文件原生存储](../development/file-storage.md)。

## 加密密钥文件

Marinara 会加密保存 API 密钥，不以明文形式存放。加密用的密钥保存在数据文件夹里一个名为 `.encryption-key` 的文件中。

搬移或恢复数据时，这个文件很关键。假设把数据文件夹复制到了新机器上，却把 `.encryption-key` 文件落下了，Marinara 就再也解不开已保存的 API 密钥，只能重新输入一遍。这个文件要始终和其余数据放在一起。

有些高级配置不用文件，而是通过 `ENCRYPTION_KEY` 环境变量提供密钥。用这个变量的话，要单独把值保管好，这种情况下也就没有 `.encryption-key` 文件需要复制。详情见[服务器配置参考](../CONFIGURATION.md)。

## Android 上的数据在哪里

在 Android 上，服务器的数据文件夹通常位于应用存储空间中，没有 root 权限就访问不到，也就没法直接把文件夹从手机上拷出来。

想在 Android 上取得一份数据副本，用 **Download Backup**(下载备份) 按钮。它在 **Settings** 的 **Advanced**(高级) 选项卡下、**Backup & Export**(备份与导出) 一节里。点它会生成一个包含全部数据的 zip 文件，存在 `.encryption-key` 文件时也会一并打包进去。这是从手机上保存数据最可靠的办法。

同一节还能在数据文件夹内的 `backups/` 里保留 1 到 9999 份轮换的每日、每周或每月自动压缩包。最新的一份叫
`marinara-automatic-backup.zip`，保留下来的较旧自动压缩包带时间戳。这个上限只对自动备份生效。重要的备份
还要再复制一份到应用存储空间以外的地方，因为卸载或重置应用会同时清掉实时数据和
本地的自动备份。

各平台完整的备份与恢复步骤见[备份与恢复 Marinara](backup-and-restore.md)。

## 相关指南

- [备份与恢复 Marinara](backup-and-restore.md)
- [服务器配置参考](../CONFIGURATION.md)
- [文件原生存储](../development/file-storage.md)
