# 设置方案

设置方案就是一组起了名字、可以反复套用的聊天设置：连接、提示词预设、智能体、工具、翻译、记忆功能、高级参数等等。想在另一个聊天里用同一套配置，直接套用方案就行，不必从头再设一遍。

方案位于 **Chat Settings**(聊天设置) 的最上方，适用于 Conversation(对话模式) 和 Roleplay(角色扮演)。Game(游戏模式) 聊天不显示方案控件。

**提示词预设**则不同。它控制系统提示词的结构和生成参数，在 Presets(预设) 面板里编辑。见[预设编辑器与提示词管理器](../prompts/presets.md)。设置方案是范围更大的一整套配置，提示词预设可以作为其中一项包含进来。

## 套用方案

1. 打开要修改的聊天，再打开 **Chat Settings**。见[聊天设置](chat-settings.md)。
2. 打开 **Profile**(设置方案) 下拉菜单（提示文字为 **Apply a settings profile to this chat**）。
3. 按名称选择一个方案。

聊天会立即更新。如果方案打开或关闭了 **Hide summarised messages**(隐藏已摘要消息)，聊天里已摘要的消息也会在同一时刻对模型隐藏，或重新显示。

如果没有成功：聊天的设置和任何已保存的方案都对不上时，下拉菜单会显示 **Custom settings profile**。如果套用过的方案已被删除，则显示 **Missing profile - choose a profile**。选择另一个方案即可。

## 创建或编辑方案

1. 点击下拉菜单旁的 **New**(新建)（“New profile from this chat's settings”）。方案构建器会打开，槽位里已经放入这个聊天的设置。要修改已保存的方案，先选中它，再点击 **Edit**(编辑)。Default 方案不能编辑。
2. 输入 **Profile name**(方案名称)。
3. 填好各个槽位（见下面的列表）。
4. 点击 **Save and choose chats…**(保存并选择聊天)。
5. 要让新聊天使用这个方案，勾选 **Make this the default**(设为默认)。列表的第一项是 **New conversation chats**(新的 Conversation 聊天) 或 **New roleplay chats**(新的 Roleplay 聊天)。
6. 勾选现在就要套用这个方案的已有聊天。
7. 点击 **Apply to N chats**(套用到 N 个聊天)；如果一个都没勾，则点击 **Save**(保存)。

构建器把槽位分为 **Chat**(聊天)、**Story**(故事)、**Pictures**(图片) 和 **Behind the scenes**(幕后) 几组。槽位有：

- **Connection**(连接)、**Prompt preset**(提示词预设) 和 **Parameters**(参数)
- **Agents**(智能体)、**Tools**(工具) 和 **Memory & summary**(记忆与摘要)
- **Persona**(用户角色)、**Lorebooks**(世界书) 和 **Background**(背景)
- **Image style**(图像风格) 和 **Translation**(翻译)

填写槽位的方法：

- 从每个槽位的列表中选择项目。**Agents**、**Tools** 和 **Lorebooks** 可以选多个。用 **Tools** 里的复选框逐个开启或关闭工具。对于只能放一项的槽位，选择 **None**(无) 即可清空。
- 在电脑上的智能体和世界书列表中，按住 <kbd>Ctrl</kbd>(macOS 上是 <kbd>Command</kbd>)，就能选择多个项目。在手机上，使用选择控件。**Clear selection**(清除选择) 会清空列表。
- 在电脑上，可以在编辑器保持打开的同时打开资料库侧边栏，然后把项目拖到对应的字段上。
- **Parameters**、**Memory & summary** 和 **Translation** 只显示方案是否包含这些设置。先在 Chat Settings 中修改，再保存到方案里。

在新建聊天的设置向导中，**Use a Profile**(使用方案) 步骤的列表顶部也有 **New profile…**(新建方案)，已保存的方案旁边有 **Edit**。保存后，向导会选中该方案。

## 把聊天设置保存到方案

要从聊天更新方案，先套用方案，修改聊天，再使用下拉菜单下方那排图标。

| 按钮 | 提示文字 | 效果 |
|---|---|---|
| Save | **Save current chat settings into this profile** | 替换方案里保存的值。 |
| Rename | **Rename profile** | 修改名称。 |
| Import | **Import settings profile (.json)** | 载入一个方案文件。 |
| Export | **Export settings profile (.json)** | 下载这个方案。 |
| Delete | **Delete profile** | 永久删除这个方案。 |

### 更新使用该方案的其他聊天

每个聊天都保存着自己的一份方案设置，所以保存方案本身不会改变其他聊天。如果同一模式下还有其他聊天在使用这个方案，**Other chats use this profile**(其他聊天正在使用此方案) 弹窗会询问：

- **Save to this profile only**(仅保存到此方案) 只保存方案，其他聊天保持原样。
- **Save and update N other chats**(保存并更新其他 N 个聊天) 还会把方案的 Chat Settings 复制到那些聊天里。那些聊天自己对这些设置做过的改动会被替换；在你执行保存的聊天里保持默认值的设置，在那些聊天里也会恢复为默认值。

如果没有其他聊天使用这个方案，**Save** 会直接保存，不会询问。多人模式房间永远不会通过这种方式更新。

<a id="choosing-the-default-profile"></a>

## 指定默认方案

下拉菜单旁边的星标用来标记该模式下新建聊天自动使用的方案。每种模式只能有一个默认方案。它的提示文字有 **Mark this profile as default for new chats in this mode**、**This profile is the default for new chats in this mode** 和 **Select a profile to mark it as default**。也可以在构建器里勾选 **Make this the default**。

## 导入和导出方案

**Export settings profile (.json)** 会下载一个 `.marinara-settings-profile.json` 文件，可以留作备份，也可以分享给别人。**Import settings profile (.json)** 会用兼容的文件新建一个方案，绝不会覆盖已有方案。旧版本导出的文件同样可以导入。导入失败时会显示 **Import failed**。

方案里存的是设置，不包含服务商的机密信息。导出或导入的方案也不会带上 Discord 镜像的 webhook、DeepLX 地址、DeepL 密钥和 Intiface 地址。在这个安装上保存的方案会保留它们。导出的文件不包含用户角色和世界书，因为它们只存在于这个安装上。

## Default 方案

Conversation 和 Roleplay 各自内置了一个 **Default**(默认) 方案。套用它会把受方案控制的设置恢复成 Marinara 在该模式下的默认值。它不能改名、覆盖或删除。相应的控件处于禁用状态，提示文字分别是 **Cannot save into the Default profile**、**Cannot rename the Default profile** 和 **Cannot delete the Default profile**。

<a id="favorite-window-layouts"></a>

## 收藏窗口布局

Chat Settings 标题栏里 **Reset View**(重置视图) 旁的星标，会为新聊天保存一个收藏窗口布局。**Profile** 下拉菜单旁的星标则用来选择默认方案。具体步骤见[为新聊天选择布局](chat-settings.md#choosing-a-layout-for-new-chats)。

新聊天使用的默认方案如果保存了布局，这个布局优先于收藏布局。没有保存布局的方案会保留聊天当前的排列，包括来自收藏的排列。方案仍会套用自己的布局提示设置（没有这个设置的旧方案会显示提示），以及自己的 Scoped Regex Scripts(限定正则脚本) 模式；没有设定模式时，使用提示词预设的默认值。

## 方案包含哪些内容

方案保存的是这个聊天与模型对接的方式：

- 连接。
- 提示词预设（在 Conversation 中叫提示词来源）。
- 智能体和工具。
- 翻译、Memory Recall(记忆功能) 和 Advanced Parameters(高级参数)。
- 窗口和按钮布局：位置、大小、固定、锁定、哪些工具在 Chat Settings 里或已弹出、打开的控制窗口，以及电脑和手机上的按钮位置。没有保存布局的方案（比如 **Default**）会保留聊天当前的布局。
- 是否隐藏布局提示。套用 **Default** 或没有这个选项的旧方案，会重新显示提示。
- 其他可复用的聊天选项。

方案还可以保存**初始选择**：一个用户角色、要启用的世界书，以及背景。

- 套用方案时，这些选择会复制到聊天里。如果方案某一项留空，聊天会保留自己的。
- 方案中的其他设置仍会替换聊天的设置。
- 这些选择不会保持关联。之后在聊天中做的改动只留在那个聊天里。
- **Save current chat settings into this profile** 会保留方案自己的用户角色、世界书和背景。如果方案没有背景，保存时会采用聊天的背景。
- 更新其他聊天绝不会改变它们的用户角色、世界书或背景。

方案不会替换属于聊天本身的内容：角色、立绘、摘要、标签和场景提示词。方案里也不包含聊天记录，以及宏变量、你关闭的角色或多人模式房间这类运行状态。

### Save and update 会复制什么

**Save and update** 会把这些复制到其他聊天里：

- 生成和上下文选项。
- 群聊选项。
- 功能和命令开关。
- 智能体及其选项。
- 记忆和摘要设置。
- 翻译。
- 窗口布局。

其余一切都保持各个聊天原有的样子：

- 它的连接、提示词预设和自定义提示词。
- 它的故事和角色。
- 它的世界书和背景。
- 它的笔记和进度。
- 哪些 Roleplay 命令只能由它的旁白使用。
- Noodle 能否使用它的消息。

Advanced Parameters 和图像描述（是否开启，以及由哪个连接描述图像）只在使用方案所用连接的聊天里改变，因为它们是针对那个连接设置的。角色日程只有在你执行保存的聊天里被开启或关闭过，才会改变。Knowledge Retrieval、Knowledge Router、Lorebook Keeper 和 Expression Engine 的开关状态及其提示词模板，都保持各个聊天原有的设置。它们的来源、世界书或立绘由每个聊天自己选择。
