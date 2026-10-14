# 外观设置

本指南按板块逐一介绍 Marinara Engine 的 **Settings -> Appearance**(设置 → 外观) 选项卡，内容涵盖颜色、文字大小、聊天布局、各模式下的消息样式，以及如何把所有设置恢复成默认值。

字体、背景和自定义 CSS 主题各有专门的指南，本页会在相应位置给出链接。

## 打开外观设置

1. 打开 **Settings**(设置)。
2. 选择 **Appearance** 选项卡。

这个选项卡分成若干板块，向下滚动依次是：**App Style**(应用样式)、**Text & Scale**(文字与缩放)、**Conversation Display**(Conversation 显示)、**Tracker Panel**(追踪器面板)、**Roleplay Messages**(Roleplay 消息)、**Game Presentation**(游戏呈现)、**Atmosphere**(氛围)、**Conversation Theme**(Conversation 主题) 和 **Backgrounds**(背景)。

## 配色方案（Dark 或 Light）

**Color Scheme**(配色方案) 下拉菜单位于 **App Style** 板块，有两个选项：

- **Dark**(默认)。在暗光环境下更护眼。
- **Light**。

下面的好几项颜色都有各自的深色和浅色默认值。在没有指定自己的颜色之前，它们会自动跟随当前的 Color Scheme。

## 整体视觉风格

**Visual Style**(视觉风格) 决定整个应用的外观基调，有两张卡片可选：

- **Default (Marinara)**(默认)。带辉光效果的复古 Y2K 风格。
- **SillyTavern**。取自初代 SillyTavern 的干净极简风格。

这只改变外观，和从 SillyTavern 导入数据没有任何关系，那是另一个独立的功能。

## Background Color 和 Accent Color

这两项控件位于 **App Style** 板块，都可以填纯色，也可以填渐变。渐变就是两种或多种颜色之间的平滑过渡。

- **Background Color**(背景色) 决定应用最底层的整体底色。默认值在 Dark 模式下是 `#050312`，在 Light 模式下是 `#faf8ff`。
- **Accent Color**(强调色) 决定按钮、激活状态的图标、聚焦边框、高亮和面板描边的颜色。两种配色方案下的默认值都是 `#d4acfb`。

`#d4acfb` 这种写法是十六进制颜色码，一种简写颜色的方式。想恢复成配色方案的默认色，用 **Reset to default**(恢复默认) 清空这个输入框。

有两个开关会改变 Accent Color 的表现：

- **Accent Pulse**(强调色脉动，默认关闭) 会让 Accent Color 轻微地动起来。纯色会明暗交替，渐变会在自身的几种颜色之间循环。
- **RGB Mode**(RGB 模式，默认关闭) 开启期间，强调色会在彩虹色板里循环。保存好的 Accent Color 本身不受影响。

两者只能开一个。开启 **RGB Mode** 会关闭 **Accent Pulse**，开启 **Accent Pulse** 也会关闭 **RGB Mode**。只要 Appearance 选项卡是打开的，Accent Pulse 就会实时预览。如果设备开启了减少动态效果，这两种动画都不会播放。

## 聊天组件样式

在 **App Style** 底部，为可移动的聊天按钮、窗口和区域选择 **Default**(默认)、**Dottore** 或 **Prof. Mari**。字体、边框形状和三种主要颜色都可以单独更改。颜色选择器也支持渐变。

**Button size (px)**(按钮大小，px) 可以改变可移动聊天按钮及其图标的大小，而不改变 Display Size。输入 32 到 96 像素之间的值。留空或使用重置按钮，会保留当前默认值。大小会和外观偏好一起保存，选择其他预设也不会改变。

颜色选择器下方的 **Apply preset font**(应用预设字体)、**Apply preset shape**(应用预设形状) 和 **Apply preset colors**(应用预设颜色) 可以让聊天的其他区域保持同样的风格。它们初始都是关闭的，且独立生效。它们作用于消息、输入框和聊天控件。在 Game Mode 中，它们还作用于 HUD 组件、地图面板、补充发言、角色表、日志、物品栏、战斗面板和弹窗。Conversation 消息可以使用所选字体和颜色，但保留自己的形状。你自定义的字体、形状和颜色也会一并应用。开启 **Apply preset colors** 时，引号内的对白仍使用每个角色或用户角色自己的 Dialogue Highlight Color。示例和自定义主题见[自定义 CSS 主题](custom-css-themes.md#ready-made-chat-window-styles)。

## 自定义鼠标指针

**Custom Mouse Pointer**(自定义鼠标指针，默认开启) 会在整个应用里使用 Marinara 的强调色光标。关闭它就恢复成系统原本的光标，也可以把光标交给自定义 CSS 主题去控制。

## Display Size 和 Chat Font Size

这两项控件位于 **Text & Scale** 板块。

- **Display Size**(显示尺寸) 决定当前设备上整个应用的基准字号。可选 **Tiny**、**Small**、**Medium**、**Default**(17px)、**Large** 和 **Huge**。
- **Chat Font Size**(聊天字号) 是一个滑块，控制聊天消息正文的大小，范围从 12px 到 48px，默认 16px。

**Font**(字体) 下拉菜单也在这个板块。想添加自己的字体或者从 Google Fonts 下载，见[自定义字体与 Google Fonts](fonts.md)。

## 聊天文字的颜色和描边

同样在 **Text & Scale** 板块，有四项控件决定聊天文字在背景上的观感。

- **Chat Text Color**(聊天文字颜色) 决定聊天消息正文的主色。默认值在 Dark 模式下是 `#d4d4d4`，在 Light 模式下是 `#1a1025`。
- **Default Dialogue Color**(默认对白颜色) 决定引号内对白的颜色，前提是角色卡或用户角色没有指定自己的 Dialogue Highlight Color。角色卡自带的颜色优先级更高。开启 **Apply preset colors** 时，这类对白会改用聊天组件样式的文字颜色。
- **Chat Chrome Text Color**(聊天界面文字颜色) 决定追踪器小组件、文件夹标签和设置项说明里的普通文字。默认值与 **Chat Text Color** 相同。
- **Text Outline / Stroke**(文字描边) 会给聊天文字加一圈描边，背景再花也能看清。可以设置描边颜色和 **Width**(宽度)，范围 0px 到 5px，默认 0.5px。宽度设为 0 就是关闭描边。

在没有指定自己的颜色之前，每项颜色都跟随配色方案的默认值。清空某个颜色输入框，它会回到配色方案的默认值，而不是变成空白。

## 聊天布局（Conversation Display）

**Conversation Display** 板块只有一项控件 **Chat Layout**(聊天布局)，用来改变 Conversation 模式下消息的样子。选择时右侧会实时预览。

- **Linear**(默认)。聊天记录式的逐行排列。
- **Bubbles**。即时通讯式的气泡。

## 追踪器面板

**Tracker Panel** 板块负责 Roleplay 追踪器侧边面板的样式。那个面板本身是独立功能，有自己的指南，见 [Roleplay 的 HUD 与追踪器](../roleplay/hud-and-trackers.md)。

## Roleplay 消息的外观

**Roleplay Messages** 板块负责 Roleplay 聊天中消息的样式。

- **Chat position**(聊天位置) 决定宽屏时消息和输入框的位置，可选 **Left**、**Center**(默认) 或 **Right**。两者会一起移动；同一侧打开了侧边栏或 Tracker Panel 时，它们会随之让开，聊天就不会被压在下面。在手机上或窗口较窄时，聊天始终占满整个宽度，Game Mode 的对白框也保持居中。
- **Roleplay Messages Background Opacity**(Roleplay 消息背景不透明度) 是一个滑块，范围 0% 到 100%，默认 90%。调低它，背景就会透过消息气泡显出来。
- **Roleplay Avatars**(Roleplay 头像) 决定每条消息旁边的头像样式，四个选项是 **None**、**Small Circles**(默认)、**Small Rectangles** 和 **Glued Side Panel**。
- **Scrollable Avatars**(可滚动头像，默认关闭) 会在滚动阅读长消息时让头像一直留在视野内。
- **Message avatar scale**(消息头像缩放) 是一个滑块，范围 75% 到 250%，默认 100%。
- **Default sprite scale**(默认立绘缩放) 是一个滑块，范围 50% 到 175%，默认 100%。单个聊天里单独设置的立绘尺寸依然会覆盖这个默认值。

## 游戏呈现

**Game Presentation** 板块负责 Game Mode 下画面素材的缩放。Game Mode 可以同时显示一张对白半身像和一张全身立绘，这两个滑块分别控制它们的大小。

- **Dialogue portrait scale**(对白半身像缩放) 是一个滑块，范围 75% 到 175%，默认 100%。
- **Full-body sprite scale**(全身立绘缩放) 是一个滑块，范围 75% 到 275%，默认 135%。

**Game Dialogue Display**(游戏对白显示) 决定对白框的行为方式：

- **Classic VN**(默认)。对白框里只显示当前这一段，更早的内容收在 **Logs**(日志) 按钮里。
- **History Above VN**。之前的段落显示在对白框上方，整场会话都可以在那里向上滚动查看。

## 氛围天气效果

**Atmosphere** 板块只有一个开关 **Dynamic weather effects (rain, snow, fog, etc.)**(动态天气效果)，默认开启。它会根据故事里的天气和时段显示动态的天气粒子。

只有当这个聊天启用了 **World State**(世界状态) 智能体时，这个开关才会有实际效果，因为天气是由那个智能体从故事里读出来的。没有它，开关开着也看不出任何变化。见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

## Conversation 主题

**Conversation Theme** 板块为所有 Conversation 模式的聊天设置一个双色渐变背景。它有独立的 **Dark** 和 **Light** 两个选项卡，两种配色方案各自保留自己的渐变。这是整台设备上所有 Conversation 聊天的默认设置，不是针对单个聊天的设置。

## 背景

**Backgrounds** 板块用来导入和选择聊天背景图，并设置 **Background Blur**(背景模糊)。它自成一个功能区，还带有自己的图库，所以另有专门的指南，见[聊天背景](chat-backgrounds.md)。

## 重置外观

**Reset Appearance**(重置外观) 按钮位于 **App Style** 板块的顶部，会把整个 **Appearance** 选项卡恢复成 Marinara 的默认设置，包括颜色、文字大小、布局、头像和立绘缩放以及渐变。

重置还会清除当前聊天的背景，并关闭主题库里正在生效的自定义主题。样式调乱了想从头再来时，用它最合适。

## 只保存在本设备的设置

大多数外观设置会同步到其他设备，只有两项不会：**Display Size** 和 **Chat Font Size** 保存在当前使用的浏览器里，永远不参与同步。

想完整了解哪些设置跨设备同步、哪些只留在本地，见[设置总览](../settings/settings-overview.md)。

## 相关指南

- [自定义字体与 Google Fonts](fonts.md)
- [聊天背景](chat-backgrounds.md)
- [自定义 CSS 主题（Theme Library）](custom-css-themes.md)
- [角色卡 CSS 主题指南](card-css-theming.md)
- [设置总览](../settings/settings-overview.md)
