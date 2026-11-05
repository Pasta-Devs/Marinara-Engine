# 自定义字体与 Google Fonts

更换 Marinara 在整个应用里使用的字体。可以选用内置字体、添加自己的字体文件，或者按名字从 Google Fonts 下载字体。

## 选择应用字体

1. 打开 **Settings**(设置)，点击 **Appearance**(外观) 选项卡，再点击 **App**(应用) 按钮。
2. 找到 **Text & Scale**(文字与缩放) 区域。
3. 打开 **Font**(字体) 下拉菜单，选一款字体。

获取新字体最简单的方法是 [Google Fonts](#downloading-from-google-fonts)。默认是 **Default (Inter)**，这是一款为屏幕阅读挑选的清爽字体。自己添加的字体会出现在同一个下拉菜单里，排在它下面。

字体选择会跨设备同步。连到同一台 Marinara 服务器的每个浏览器都会切换到这款字体。见[设置总览](../settings/settings-overview.md)。

聊天组件另有单独的 **Font** 选项，位于 **Chat widget style**(聊天组件样式) 下。在那里开启 **Apply preset font**(应用预设字体)，消息、输入框和聊天控件也会使用这款字体。见[现成的聊天窗口样式](custom-css-themes.md#ready-made-chat-window-styles)。

## 添加自己的字体

开始之前：字体放在服务器上的一个文件夹里。服务器就是运行 Marinara 的那台电脑。如果 Marinara 跑在你自己的电脑上，那台电脑就是服务器，而数据文件夹是 Marinara 存放你的数据的地方。

1. 点击 **Font** 下拉菜单旁边的 **Open Fonts Folder**(打开字体文件夹)，打开服务器上的 `data/fonts/`。也可以自己在 Marinara 的数据文件夹里找到 `data/fonts/` 文件夹。
2. 把字体文件复制进去。
3. 进入 **Settings → Appearance → App → Text & Scale**(设置 → 外观 → 应用 → 文字与缩放)。
4. 打开 **Font** 下拉菜单，你的字体就在列表里。
5. 选中它。应用里的文字会立刻换成这款字体。

Marinara 读取 `.ttf`、`.otf`、`.woff` 和 `.woff2` 文件，其他类型一律忽略。它根据文件名生成显示名称，所以 `OpenSans-Bold.ttf` 会显示成“Open Sans”。文件名起得清楚些，列表就整齐。

连到同一台服务器的每台设备都能使用 `data/fonts/` 里的字体。

如果没有成功：检查文件类型，并确认文件放在服务器上的 `data/fonts/` 里，而不是你正在浏览的这台设备上。

<a id="downloading-from-google-fonts"></a>

## 从 Google Fonts 下载

这需要服务器能连接互联网。

1. 进入 **Settings → Appearance → App → Text & Scale**。
2. 在 **Google Fonts** 输入框里输入准确的字体名，例如 `Fira Code` 或 `Lora`。
3. 点击 **Add**(添加)。
4. 等下载完成，字体随后会出现在 **Font** 下拉菜单里。

输入框旁边的 **Browse fonts at fonts.google.com →** 链接会打开 Google Fonts 网站，方便查名字。名字只能包含字母、数字和空格。再次下载同一款字体会替换旧的那份。

如果没有成功，先看报错信息。

- 如果 Marinara 连不上 Google Fonts，检查网络连接。
- 如果提示找不到字体，核对拼写，并在 Google Fonts 网站上确认这款字体有 Regular(400) 样式。Marinara 只下载这一种字重。

## Open Fonts Folder 按钮

**Font** 下拉菜单旁边的 **Open Fonts Folder** 按钮，会在服务器那台电脑的文件管理器里打开 `data/fonts/`，而不是在你正在使用的设备上打开。如果 Marinara 跑在你自己的电脑上，它会替你打开这个文件夹。从手机或另一台电脑连过来时，就自己把字体文件复制到服务器的 `data/fonts/` 文件夹里。

选用默认字体时，预设编辑器里的提示词字段和角色的 Example Dialogue(对话示例) 使用等宽字体。选用其他任何字体时，它们也会跟着用那款字体。其他提示词字段，例如智能体的提示词模板，始终使用等宽字体。

## 相关指南

- [外观设置](appearance-settings.md)
