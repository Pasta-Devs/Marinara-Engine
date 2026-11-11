# 外观设置

**Appearance**(外观) 选项卡决定 Marinara 的外观：颜色、文字大小、聊天布局，以及每种聊天模式的消息样式。

想找别的内容？

- 换一种字体：[自定义字体与 Google Fonts](fonts.md)。
- 聊天背景图：[聊天背景](chat-backgrounds.md)。
- 自定义主题（**Settings → Addons → Theme Library**(设置 → 插件 → 主题库)）：[自定义 CSS 主题](custom-css-themes.md)。
- 角色在聊天里的专属外观：[角色卡 CSS 主题指南](card-css-theming.md)。

## 打开外观设置

1. 打开 **Settings**(设置)。
2. 选择 **Appearance** 选项卡。
3. 在顶部选一个按钮：**App**(应用)、**Conversation**(对话模式)、**Roleplay**(角色扮演) 或 **Game**(游戏)。

这些按钮按聊天模式给设置分组，选项卡只显示你选中的那一组。

| 按钮 | 板块 |
| --- | --- |
| **App** | **App Style**(应用样式)、**Text & Scale**(文字与缩放)、**Atmosphere**(氛围)、**Backgrounds**(背景) |
| **Conversation** | **Conversation Display**(Conversation 显示)、**Conversation Theme**(Conversation 主题) |
| **Roleplay** | **Tracker Panel**(追踪器面板)、**Roleplay Presentation**(Roleplay 呈现) |
| **Game** | **Game Presentation**(游戏呈现) |

想从头再来，就点击 **App Style** 顶部的 **Reset Appearance**(重置外观)。它会把整个选项卡恢复成 Marinara 的默认设置，清除当前聊天的背景，并关闭主题库里正在生效的主题。

## App 按钮

### 配色方案和视觉风格

在 **App Style** 里，**Color Scheme**(配色方案) 下拉菜单有 **Dark**(默认) 和 **Light** 两个选项。应用会立即切换。分别有深色和浅色默认值的颜色会跟随它，直到你设置了自己的颜色。

**Visual Style**(视觉风格) 有两张卡片。**Default (Marinara)**(默认) 是带辉光效果的复古 Y2K 风格。**SillyTavern** 是干净极简的风格。它只改变外观，和从 SillyTavern 导入没有任何关系。

### 应用背景和 Accent Color

**Accent Color** 可以填纯色，也可以填渐变，也就是两种或多种颜色之间的平滑过渡。用 **Reset to default**(恢复默认) 清空输入框，就会回到默认值。

| 设置 | 着色对象 | 默认值 |
| --- | --- | --- |
| **Accent Color**(强调色) | 按钮、激活状态的图标、聚焦边框、高亮、面板描边，以及聊天周围的控件。 | **Marinara Gradient**(Marinara 渐变)，一种粉、橙、青三色混合的渐变 |

要更改应用主体外壳的背景，请使用 **App Style** 中的 **UI Editor**(界面编辑器)：

1. 打开显示 **Choose what to change…**(选择要更改的内容) 的下拉菜单，选择 **Whole app**(整个应用)。
2. 点击 **Background**(背景)，选一种颜色或渐变。
3. 点击 **Save**(保存)。

没有已保存的背景时，应用在 Dark 下使用 `#050312`，在 Light 下使用 `#faf8ff`。要恢复，请再次打开 **Whole app**，然后点击 **Reset to default**。

`#050312` 这样的值是十六进制颜色码，一种简写颜色的方式。

有两个开关会改变强调色的表现，同一时间只能开一个。

- **Accent Pulse**(强调色脉动) 会让强调色动起来。纯色会明暗交替，渐变会在自身的几种颜色之间循环。它在桌面端默认开启，在手机上默认关闭。
- **RGB Mode**(RGB 模式) 会让强调色在彩虹色里循环。你保存的 **Accent Color** 保持不变。它默认关闭。

如果设备要求减少动态效果，这两种动画都不会播放。

### 其他 App Style 控件

- **Custom Mouse Pointer**(自定义鼠标指针，默认开启) 使用 Marinara 的强调色光标。关闭它就改用系统光标，也可以把光标交给自定义主题控制。
- **Reduce Ambient Animations & Effects**(减少环境动画和特效) 会停止装饰性动画、环境粒子、轮换预览和文字逐渐显现的效果。设备要求减少动态效果时，Marinara 也会这样做。
- **Desktop sidebar width**(桌面端侧边栏宽度) 设置桌面端两侧侧边栏的宽度。**Reset width**(重置宽度) 会恢复原来的宽度。手机保持原有布局。

### 聊天组件样式

在 **App Style** 底部，为可移动的聊天按钮、窗口和区域选择 **Default**(默认)、**Dottore** 或 **Prof. Mari**。字体、形状和三种主要颜色都可以单独更改，三个 **Apply preset**(应用预设) 开关会把这种样式带到消息、输入框和聊天控件里。**Button size (px)**(按钮大小，px) 可以调整可移动聊天按钮及其图标的大小，而不改变 **Display Size**(显示尺寸)。输入 32 到 96 之间的值，或者留空使用默认值。每项控件的说明见[自定义 CSS 主题](custom-css-themes.md#ready-made-chat-window-styles)。

### Display Size 和 Chat Font Size

在 **Text & Scale** 里：

- **Display Size** 决定这台设备上整个应用的基准字号，改动会立即生效。从以下几档中选一个：

| 选项 | 大小 |
| --- | --- |
| **Tiny**(极小) | 12 px |
| **Small**(小) | 14 px |
| **Medium**(中等) | 16 px |
| **Default** | 17 px |
| **Large**(大) | 19 px |
| **Huge**(特大) | 22 px |
| **Extra large**(超大) | 26 px |
| **Extra extra large**(超超大) | 30 px |
| **Maximum**(最大) | 34 px |

- **Chat Font Size**(聊天字号) 是一个滑块，控制聊天消息正文的大小，范围从 12 px 到 72 px，默认 16 px。

**Font**(字体) 下拉菜单也在这个板块。见[自定义字体与 Google Fonts](fonts.md)。

### 聊天文字的颜色和描边

同样在 **Text & Scale** 里：

- **Chat Text Color**(聊天文字颜色) 是消息正文的主色。默认值在 Dark 下是 `#d4d4d4`，在 Light 下是 `#1a1025`。
- **Default Dialogue Color**(默认对白颜色) 决定引号内对白的颜色，前提是角色或用户角色没有自己的 Dialogue Highlight Color。卡片上的颜色优先。开启 **Apply preset colors**(应用预设颜色) 时，对白使用聊天组件样式的文字颜色。
- **Chat Chrome Text Color**(聊天界面文字颜色) 决定聊天周围各控件的文字：追踪器小组件、文件夹标签和设置项说明。它的默认值与 **Chat Text Color** 相同。
- **Text Outline / Stroke**(文字描边) 会加一圈描边，背景再花也能看清文字。可以设置颜色和 **Width**(宽度)，范围 0 到 5 px。默认 0.5 px，设为 0 就是关闭描边。

清空某个颜色输入框，它就会回到配色方案的默认值。

### 氛围

**Dynamic weather effects (rain, snow, fog, etc.)**(动态天气效果) 默认开启。它会根据故事里的天气和时段显示天气粒子。只有这个聊天开启了 **World State**(世界状态) 智能体时，它才会显示出效果。见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

### 背景

**Backgrounds** 板块里有 **Chat Background**(聊天背景) 选择器和 **Background Blur**(背景模糊)。这里还有两项控件。**Conversation background image opacity**(Conversation 背景图片不透明度) 决定 Conversation 模式下聊天背景显示得有多明显，渐变依然可见。**Chat List Backgrounds**(聊天列表背景) 会在聊天列表里，把每个聊天的背景作为一条淡化的横幅显示在该行后面。可选 **Active & Hovered**(当前和悬停的行)、**Every Row**(每一行) 或 **Off**(关闭)。见[聊天背景](chat-backgrounds.md)。

## Conversation 按钮

- **Chat Layout**(聊天布局)（在 **Conversation Display** 里）改变 Conversation 消息的样子，并带实时预览。**Linear**(默认) 显示聊天记录式的逐行排列。**Bubbles** 显示即时通讯式的气泡。
- **Avatar Shape**(头像形状) 可选 **Circular**(圆形) 或 **Square**(方形)。头像大小不变。
- **Always display swipe menu**(始终显示备选回复菜单) 从第一条回复起就显示备选回复的切换箭头和计数。关闭它，就只在重新生成之后才显示。
- **Conversation Theme** 为每个 Conversation 聊天设置背后的双色渐变。**Dark** 和 **Light** 两个选项卡各自保留自己的渐变。这是整台设备的默认设置，不是针对单个聊天的设置。

## Roleplay 按钮

**Tracker Panel** 负责 Roleplay 追踪器侧边面板的样式。见 [Roleplay 的 HUD 与追踪器](../roleplay/hud-and-trackers.md)。

**Roleplay Presentation** 负责 Roleplay 消息的样式。

| 设置 | 作用 | 默认值 |
| --- | --- | --- |
| **Chat position**(聊天位置) | 宽屏时消息和输入框的位置：**Left**(左)、**Center**(居中) 或 **Right**(右)。同一侧打开了侧边栏或 Tracker Panel 时，它们会随之移开。手机上聊天始终占满整个宽度。 | **Center** |
| **Visual Novel display**(视觉小说显示) | 每次显示一个写完的段落，配上对白半身像和你的立绘。它会改变当前的 Roleplay 聊天，也会改变尚未保存样式的聊天所用的默认值。 | 关闭 |
| **Roleplay Messages Background Opacity**(Roleplay 消息背景不透明度) | 0% 到 100% 的滑块。调低它，背景就会透过消息气泡显出来。 | 90% |
| **Roleplay Avatars**(Roleplay 头像) | 每条消息旁边的头像样式：**None**(无)、**Small Circles**(小圆形)、**Small Rectangles**(小矩形) 或 **Glued Side Panel**(贴边侧面板)。 | **Small Circles** |
| **Scrollable Avatars**(可滚动头像) | 滚动阅读长消息时，让头像一直留在视野内。 | 关闭 |
| **Message avatar scale**(消息头像缩放) | 75% 到 250% 的滑块。 | 100% |
| **Default sprite scale**(默认立绘缩放) | 50% 到 175% 的滑块。聊天自己设置的立绘尺寸依然优先。 | 100% |

这个板块还有 **Custom chat width**(自定义聊天宽度)、**Always display swipe menu**、**Reduced paint effects**(降低绘制特效：把开销大的透明和阴影效果压平，让导航保持流畅)、**Show Thinking In Messages**(在消息中显示思考过程)、**Don't Collapse Thinking**(不折叠思考过程) 和 **Narrator's Cycling Avatars**(旁白头像轮换)。开启 **Visual Novel display** 后，还会出现 **Auto-play VN paragraphs**(自动播放视觉小说段落) 及其 **Paragraph delay**(段落间隔)、**Dialogue portrait scale**(对白半身像缩放) 和 **Full-body sprite scale**(全身立绘缩放)。

## Game 按钮

在 **Game Presentation** 里，**Game VN Art**(游戏视觉小说画面) 有两个滑块：**Dialogue portrait scale**(75% 到 175%，默认 100%) 和 **Full-body sprite scale**(75% 到 275%，默认 135%)。

**Game Dialogue Display**(游戏对白显示) 决定对白框的行为方式。

- **Classic Dialogue Box**(经典对白框，默认) 只显示当前这一段。更早的内容在 **Logs**(日志) 按钮里。
- **History Above Dialogue Box**(对白框上方显示历史) 会把之前的段落显示在对白框上方，整场会话都可以在那里滚动查看。

**Game text effects**(游戏文本特效，默认开启) 会给富有戏剧性的词语、全大写字母的强调、括号里的插入语和文字特效标签加上动画。关闭它就显示纯文本。

## 只保存在本设备的设置

大多数外观设置会同步到你的其他设备，**Display Size** 和 **Chat Font Size** 不会。它们保存在你使用的浏览器里。哪些设置会同步，见[设置总览](../settings/settings-overview.md)。

## 相关指南

- [自定义字体与 Google Fonts](fonts.md)
- [聊天背景](chat-backgrounds.md)
- [自定义 CSS 主题（Theme Library）](custom-css-themes.md)
- [角色卡 CSS 主题指南](card-css-theming.md)
- [设置总览](../settings/settings-overview.md)
