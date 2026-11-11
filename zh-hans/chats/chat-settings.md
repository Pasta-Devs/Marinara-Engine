# 聊天设置总览

**Chat Settings**(聊天设置) 是当前打开的聊天的选项面板：模型、角色、智能体、搜索、摘要、分支和图库都在这里。大多数设置只属于这个聊天。

## 打开 Chat Settings

1. 打开一个聊天。
2. 点击 **Chat Settings** 按钮（滑块图标），面板随即打开。手机上，**Help**(帮助，即 **?**) 会显示图标说明。
3. 点击某个区域的标题即可展开，再点一次标题就会收起。

新建聊天时，Chat Settings 会自动打开。要关闭它，点击它的 **X**，或者再点一次滑块按钮。

电脑上，滑块按钮最初位于聊天右上角。如果右侧显示着 Tracker Panel(追踪器面板)，它最初会改在那个面板的左边。Tracker Panel 是 Roleplay(角色扮演) 里的侧边面板，显示智能体（随回复一起运行的帮手）追踪的内容，比如场景中的角色。

滑块按钮可以拖到更顺手的位置，拖动时它会与附近的聊天按钮对齐。电脑上按住 <kbd>Alt</kbd> 可以自由放置。每个聊天都会记住按钮位置。按钮上的小圆点表示智能体正在工作。在启用了 Advanced Memory Recall 的 Roleplay 聊天里，按钮另一角的常亮圆点表示有些场景记忆需要处理，见[修复记忆问题](../agents/memory.md#fixing-memory-problems)。

第一次打开聊天时，会播放一段短视频，介绍如何排列按钮和窗口。点击 **Got it**(知道了)。之后在其他聊天里或刷新页面后，它都不会再出现。要在某个聊天里一直隐藏布局提示，点击提示旁的 **X**，也就是 **Hide these tips for this chat**(在此聊天中隐藏这些提示)。

## 各区域一览

能看到哪些区域取决于聊天模式。**Impersonate**(代写) 区域的说明见[引导生成与 Impersonate](guided-and-impersonate.md)。

- 设置方案栏：套用或保存一组聊天设置。见[设置方案](settings-profiles.md)。（Conversation(对话模式) 和 Roleplay）
- **Search messages**(搜索消息)：按文字查找消息，或用 `#` 加消息编号查找。它的 **Bookmarks**(书签) 和 **Trash**(回收站) 选项卡分别列出加了书签和已删除的消息。（Game(游戏模式) 中没有）
- **Chat Name**(聊天名称)：聊天列表里显示的名字。点击即可改名。它永远不会发给模型。
- **Chat Branches**(聊天分支)：切换、改名、导出和导入分支。见[聊天分支](branches.md)。
- **Connection**(连接)：这个聊天由哪个模型回复。见下文。
- **Prompt Preset**(提示词预设)：这个聊天保存的提示词结构。
- **Advanced Parameters**(高级参数)：为这个聊天覆盖温度之类的生成设置。见[生成参数](../prompts/generation-parameters.md)。
- **Persona**(用户角色)：你扮演谁。见[在聊天里选择用户角色](../characters/choosing-your-persona.md)。（Conversation 和 Roleplay）
- **Characters**(角色)：聊天里的角色。（Conversation 和 Roleplay）
- **Ruleset**(规则集)：按桌面规则集游玩聊天，带掷骰检定和人物卡。见[Roleplay：按规则集游玩](../roleplay/rulesets.md)。（Roleplay）
- **Party**(队伍)：取代 **Persona** 和 **Characters**，把两者合并在一处。（Game）
- **Group Chat**(群聊)：群聊里谁来发言。见[群聊](group-chats.md)。（有多个角色的聊天）
- **Scoped Regex Scripts**(限定正则脚本)：按聊天控制属于某个角色的正则脚本。见[正则脚本](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting)。（只有聊天中的角色带有限定脚本时才显示）
- **Chat Variables**(聊天变量)：用 `{{name}}` 重复使用的命名文本。见下文。
- **Connected Chats**(关联聊天)：把一个聊天和另一个聊天关联起来。见[关联聊天](connected-chats.md)。
- **Lorebooks**(世界书)：挂上世界设定。见[世界书总览](../lorebooks/overview.md)。
- **Chat Summary**(聊天摘要)：查看和生成摘要。见[记忆功能与聊天摘要](../agents/memory.md#chat-summary-roleplay)。（适用摘要的聊天）
- **Active Context**(活动上下文)：显示这个聊天里启用的世界书和上下文。见 [Token 预算与递归](../lorebooks/token-budgets.md#seeing-skipped-entries-in-active-context)。
- **Agents**(智能体)：开启帮手。见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。
- **Agent activity**(智能体活动)：显示智能体做了什么。可以重新运行追踪器、重试或停止智能体，以及清空追踪器。见[智能体活动](../roleplay/getting-started.md#agent-activity)。（Roleplay，开启了智能体或 Advanced Memory 时）
- **Author's Notes**(作者注释)：模型每轮都会读取的一段笔记。见 [Author's Notes](../roleplay/getting-started.md#authors-notes)。（Roleplay）
- **Background**(背景)：聊天的背景图片。（Roleplay 和 Game）
- **Gallery**(图库)：聊天的图片和视频。见[场景背景与图库](../media/scene-backgrounds.md)。
- **Widgets**(小组件)：游戏中显示哪些 HUD 小组件。（Game）
- **Impersonate**：`/impersonate` 命令的设置。（Roleplay）
- **Memory Recall**(记忆功能)：记住聊天中较早的内容。见[记忆功能与聊天摘要](../agents/memory.md)。（Lite 版没有）
- **Function Calling**(函数调用)：让模型在这个聊天里使用工具（函数）。
- **Translation**(翻译)：消息自动翻译。见[消息翻译](../integrations/message-translation.md)。

Conversation 聊天还有 Autonomous Messaging(自主消息，角色会先给你发消息)、Commands(命令，角色自己采取的行动) 和笔记几个区域，见 [Conversation 模式：入门](../conversation/getting-started.md)。

## 为聊天选择模型

**Connection** 区域决定这个聊天由哪个模型回复。所选模型只改变这个聊天。

1. 打开 **Chat Settings** 和其中的 **Connection** 区域。
2. 点击 **Model**(模型) 字段，它显示当前模型。
3. 看看它是否显示这个聊天跟随 **Main**(主模型)。Main 是你在 **Connections**(连接) 里设置的默认模型。
4. 选择一个模型。这个选择器和聊天输入框里的模型按钮相同。当前模型固定在最上方，下面是最近用过和加了星标的模型，按账号分组。可以跨模型和账号搜索，也可以用 **Browse**(浏览) 打开某一个账号的模型目录。

**Follow Main**(跟随主模型) 会清除这个聊天自己的选择，这样你更换 Main 时，这个聊天也会跟着变。**Shuffle**(随机轮换) 每条回复都从你的池子里换一个模型，见 [Shuffle](../connections/organizing-connections.md#shuffle)。如果某个账号缺密钥或已关闭，点它的模型会引向修复操作。要添加账号，见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

## 使用聊天变量

聊天变量就是给一段文本起的名字。例如，添加名为 `char1`、值为 `Mary` 的变量，然后在消息里写 `{{char1}} walks in.`，模型读到的就是“Mary walks in.”

1. 打开 **Chat Settings** 和其中的 **Chat Variables** 区域。
2. 点击 **Add variable**(添加变量)，然后填写这一行的 **name**(名称) 和 **value**(值)。
3. 按 <kbd>Enter</kbd> 或点击输入框外部即可保存。垃圾桶按钮会删除变量。

名字只能包含字母、数字和下划线，必须以字母或下划线开头，最长 64 个字符。正好 21 个字符的名字保留给角色引用。`char`、`user` 这类内置宏的名字会被拒绝。

- 你的消息仍显示你输入的标签，只有模型会看到值。之后修改这个值，之前所有用过这个标签的回合也会随之改变。
- 变量只属于这个聊天，重启后仍会保留。
- 它和 `{{setvar}}` 使用同一份存储。提示词章节或世界书条目设置同名变量时，会覆盖你填的值。

变量很多时，点击 **Search and edit all in the State Editor**(在 State Editor 中搜索并编辑全部)。它会列出所有变量，你可以搜索、编辑、以 JSON 一次粘贴许多变量，并在保存前查看改动。见 [State Editor](../roleplay/hud-and-trackers.md#the-state-editor)。其他双大括号宏见[提示词宏](../prompts/macros.md)。

<a id="settings-profiles"></a>

## 设置方案

设置方案就是一组保存下来的聊天设置，可以套用到别的聊天上。方案栏位于面板最上方，Game 中不显示。保存、套用、导入、导出和指定默认方案，见[设置方案](settings-profiles.md)。

## 移动、固定和锁定窗口

电脑上，Chat Settings 浮在聊天上方，内容会随窗口大小重新排列。窗口第一次会在它的按钮下方打开，保存过位置的则在那个位置打开。

- 移动：拖动标题栏。也可以聚焦标题栏后按方向键，按住 <kbd>Shift</kbd> 可以加大步幅。
- 调整大小：拖动边缘或角落。也可以聚焦右下角的手柄后按方向键。
- 固定：点击 **Pin**(固定)。固定的窗口在点击别处时保持打开，刷新页面后也会重新打开。未固定的窗口在点击外部或按 <kbd>Esc</kbd> 时会关闭，但正在输入或使用已打开的菜单时除外。
- 锁定：点击 **Lock**(锁定)。窗口不能移动或调整大小，它的按钮也固定在原位。仍然可以打开它。
- 关闭：点击 **X**。

窗口始终留在聊天区域内。窗口或按钮可以放在消息框旁边，但永远不会盖住它。手机上，Chat Settings 以全宽面板打开，并调整到键盘上方。

## 帮助、追踪器和 Reset View

这些按钮在标题栏里。

- **Help**(即 **?**) 显示解释聊天控件的标签。手机上会先关闭 Chat Settings。要隐藏它，开启 **Settings → General → App Behavior → Hide chat Help button**(设置 → 常规 → 应用行为 → 隐藏聊天帮助按钮)。
- **Reset View**(重置视图，圆形箭头) 先要求确认，然后恢复这个聊天的初始布局：弹出的区域会放回去，窗口大小、位置、固定和锁定状态都会重置。
- **Favorite layout**(收藏布局，星标) 把这套排列保存给新聊天使用。见[为新聊天选择布局](#choosing-a-layout-for-new-chats)。
- **Tracker Panel**(骰子) 在使用智能体或 Advanced Memory 的 Roleplay 聊天中开关这个面板。电脑上它显示在聊天旁边；手机或平板上，由一个可移动按钮打开。它也会改变 **Settings → Appearance**(设置 → 外观) 里的 Tracker Panel 偏好。

Tracker Panel 没有显示时，电脑上的追踪器改用 [Trackers 窗口](../roleplay/hud-and-trackers.md#the-trackers-window)。消息旁空间不足时，它最初会显示为一个小小的 **Trackers**(追踪器) 按钮。用骰子按钮可以重新显示 Tracker Panel。

<a id="popping-a-section-out-into-its-own-window"></a>

## 把区域弹出为独立窗口

把一个区域弹出，就能让它拥有自己的窗口。

1. 点击区域上的 **Pop out**(弹出) 按钮（**?** 旁边带箭头的方框）。电脑上也可以把区域标题直接拖出 Chat Settings。
2. 新窗口可以像 Chat Settings 一样移动、调整大小、固定或锁定。它默认不固定，所以点击别处会缩成按钮。
3. 要放回去，点击 **Put back in Chat Settings**(放回聊天设置，**X** 旁的弯箭头)，或者把窗口拖到 Chat Settings 上。

**X** 会把区域缩成带图标的小按钮。把按钮拖到想要的位置，点击它就能重新打开窗口。追踪器也能以同样方式从 Trackers 窗口弹出，它们的返回按钮是 **Put back in Trackers**(放回追踪器)。

手机上，弹出区域会关闭 Chat Settings，并把它加入三点 **Chat tools**(聊天工具) 菜单。先点击三点按钮，再点击该区域的圆形图标。点击 **Put back in Chat Settings** 可以把它放回。

<a id="the-phones-chat-tools-menu"></a>

## 手机上的 Chat tools 菜单

可移动的三点按钮收纳着你从 Chat Settings 移出的工具。点击它会展开一列圆形图标按钮，再点击某个工具即可打开。再次点击三点按钮就会收起。追踪器按钮、Game 的 Map(地图) 按钮和 Character Profiles(角色资料) 仍单独显示。

拖动三点按钮可以移动整个菜单。打开菜单后，用顶部的锁可以把它固定在原位。未锁定时，上下拖动工具即可调整顺序，也可以让它获得焦点后按方向键。锁定后既不能移动，也不能调整顺序。菜单会沿用你的聊天组件样式。

<a id="control-windows-and-their-buttons"></a>

## 控制窗口及其按钮

有些工具会打开自己的小窗口：游戏的 **Game controls**(游戏控制)、**Session**(会话)、**Volume**(音量) 和 **Game Assets**(游戏素材)，还有 **Connected chat**(所连聊天)，以及已安装资源包提供的控件。

电脑上，这些按钮最初位于聊天右上角附近。点击按钮会打开它的窗口，关闭窗口后按钮会重新出现。手机上，它们在 **Chat tools** 菜单里，打开后是全宽面板。

想把某个工具留在 Chat Settings 里，打开它的窗口，选择 **Put back in Chat Settings**。用区域的弹出按钮可以再次把它分离出来。**Reset View** 会恢复初始排列。

拖动按钮可以移动它，拖动时附近的按钮会对齐。按住 <kbd>Alt</kbd> 可以自由放置，按钮获得焦点时也能用方向键移动。Conversation 的 **Calls**(通话) 仍是普通按钮。在 Game 中，**Character Profiles** 和手机上的 **Map** 按钮都可以移动，锁定后会为每个游戏保留它们的位置。

## 每个聊天单独保存窗口布局

每个聊天都会记住窗口大小和位置、固定与锁定状态、弹出的区域以及按钮位置。手机上的位置，以及 Chat tools 菜单的顺序和锁定状态，与电脑上的位置分开保存。[设置方案](settings-profiles.md)可以保存布局，供其他聊天使用。

<a id="choosing-a-layout-for-new-chats"></a>

## 为新聊天选择布局

**Reset View** 旁的星标会把当前排列设为同一模式新聊天的初始布局。Conversation、Roleplay 和 Game 各有自己的收藏布局。

1. 按需要排列窗口和按钮，把工具放进 Chat Settings 或弹出来。
2. 如果希望新聊天也隐藏布局提示，先把提示隐藏。
3. 点击星标。当前布局、提示选择和 Scoped Regex Scripts 模式都与已保存的收藏一致时，星标会填满。

收藏会保存位置、大小、固定、锁定、弹出或收进设置的工具、布局提示的选择，以及这个聊天的 [Scoped Regex Scripts](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting) 模式。聊天选的是 **Use preset default**(使用预设默认值) 时不保存模式，新聊天会沿用各自的提示词预设。角色、模型、AI 设置和消息仍属于原聊天。

要替换收藏，改变排列后再点一次星标。要停用收藏，点击填满的星标。这只影响之后新建的聊天。

套用自带已保存布局的设置方案时，方案布局优先于收藏。没有保存布局的方案会保留收藏的排列。方案仍会套用自己的布局提示设置和 Scoped Regex Scripts 模式。见[设置方案](settings-profiles.md#favorite-window-layouts)。

从旧版本升级后，你原来的工具按钮排列已经被三种模式收藏，直到你替换或清除它。全新安装则把工具放在 Chat Settings 里，不设收藏。

## 改变聊天窗口的外观

打开 **Settings → Appearance → App**(设置 → 外观 → 应用)，滚动到 **App Style**(应用样式) 底部的 **Chat widget style**(聊天组件样式)。**Default**(默认) 保留 Marinara 原本的外观。**Dottore** 使用冰蓝色、浅金属色和切角。**Prof. Mari** 使用宝石蓝、暖金色和拱形边框。两者都会适应浅色和深色模式，并改变三种聊天模式中可移动按钮、窗口和区域的样式。

- 预设下方的 **Font**(字体)、**Shape**(形状) 和三个颜色选择器可以自由搭配外观。安装到 Marinara 的字体会出现在字体列表中。重新选择预设会重置字体、形状和自定义颜色。
- **Button size (px)**(按钮大小，px) 设置可移动聊天按钮的大小，范围是 32 到 96。留空则保留默认值。
- **Apply preset font**(应用预设字体)、**Apply preset shape**(应用预设形状) 和 **Apply preset colors**(应用预设颜色) 把这套样式扩展到消息、输入框和聊天控件。每个开关独立生效，初始都是关闭的。Conversation 消息会使用所选字体和颜色，但保留自己的形状。开启 **Apply preset colors** 时，引号内的对白仍保留每个角色或用户角色自己的 Dialogue Highlight Color。

这些选择不会移动你的窗口。它们和应用偏好一起保存，并同步到连接同一服务器的浏览器。见[自定义 CSS 主题](../appearance/custom-css-themes.md#ready-made-chat-window-styles)。
