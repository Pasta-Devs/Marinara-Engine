# 动态表情

本指南介绍 Marinara Engine 的动态表情：一小段循环播放的动画，用作角色的立绘。立绘就是聊天时 Marinara 为角色显示的那张站姿画。有了动态表情，立绘就会动起来，不再是一张静止的图。

## 什么是动态表情

普通的表情立绘是一张静态图，比如一张笑脸或者一张怒脸。动态表情则是一小段循环动画，播放时顶替原来那张静态图。Marinara 会把每个动态表情存成 GIF 立绘。GIF 是一种图像文件，本身就能循环播放一小段动画。

Marinara 分两步做出一个动态表情。先让一个 **Video Generation**(视频生成) 连接生成一小段表情视频，再在本机把这段视频转成循环播放的 GIF 立绘。

存好之后，动态表情和其他立绘用起来完全一样。可下载的 **Expression Engine** 智能体会在场景需要某种情绪时挑中它并显示出来。立绘的显示方式见[角色立绘](../characters/sprites.md)，Expression Engine 的说明见[可下载智能体参考](../agents/built-in-agents.md)。

## 开始之前

生成动态表情之前，有两样东西要先准备好。

1. 一个 **Video Generation** 连接。连接就是保存下来的一套 AI 服务接入信息，这里需要的是能生成视频的服务商。添加方法见[场景视频生成](scene-video.md)。
2. 运行 Marinara 的那台机器上装好 ffmpeg。ffmpeg 是一个免费的媒体工具，负责把视频片段转成 GIF 立绘。

如果找不到 ffmpeg，生成会立刻失败，并给出这条提示：

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

解决办法是装上 ffmpeg，并确认系统能找到它。也可以设置环境变量 `FFMPEG_PATH`，值为 ffmpeg 程序的完整路径。环境变量是服务器启动前交给它的一项设置。

## 开启动态立绘

生成动态表情用的窗口，和生成静态立绘的是同一个。

1. 打开角色的 **Character Editor**(角色编辑器)，用户角色则打开 **Persona Editor**(用户角色编辑器)。
2. 切到 **Sprites**(立绘) 选项卡，再进入 **Facial Expressions**(面部表情) 分类。
3. 点击 **Generate Sprite**(生成立绘)，**Generate Sprites** 窗口随即打开。
4. 勾选 **Generate animated portraits**(生成动态立绘) 复选框，窗口随即切换到动态模式：
   - 连接选择器从 **Image Generation Connection**(图像生成连接) 变成 **Video Generation Connection**(视频生成连接)。
   - 静态立绘表用的网格设置消失。
   - Marinara 改为一次生成一个表情，不再一次生成一整张立绘表。
5. 在下拉菜单里选好 **Video Generation Connection**。
6. 填写 **Appearance Description**(外观描述)，让服务商知道角色长什么样。
7. 选择要生成哪些表情。
8. 生成单个表情点击 **Generate Animated Portrait**，一次生成多个则点击 **Generate Animated Portraits**。

运行过程中会看到提示“Generating animated portrait GIFs...”每个表情先变成一小段视频，然后由 Marinara 转成 GIF 立绘。

生成结束后，检查一下结果，点击保存按钮把它们加到角色或用户角色上。其中某个表情失败也不影响已完成的部分，Marinara 会保留它们，并列出失败的表情名，方便重试。

## 时长与画面比例

动态表情都是竖版立绘片段。画面比例固定为 9:16(竖屏)，无法更改。

每段片段的时长可以调。打开 **Settings**(设置)，找到 **Video Generation** 区域，那项设置叫 **Animated expression length**(动态表情时长)，默认 3 秒，可以设为 1 到 8 秒。

Marinara 最终保存的是一个循环播放的小体积 GIF，宽 512 像素。片段越短，文件越小，循环也越紧凑利落。

## 关于透明背景的提醒

静态立绘可以清除背景，让角色像浮在场景上一样。动态表情不一样，Marinara 不会对它们做背景清除。

在动态模式下，透明背景复选框叫 **Prefer clean transparent-style background**(倾向于干净的透明风格背景)。这个复选框只是往视频提示词里加一句提示，提示词就是 Marinara 发给 AI 的那段文字。它的帮助文字写得很明白：“Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed.”

检查环节也会再说明一次，显示这条说明：“Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output.”所以动态表情有可能保留可见的背景。想要画面干净一些，就在 **Appearance Description** 里要求一个纯色背景。

## 生成时会遇到什么

动态表情比静态立绘慢。Marinara 一次只生成一个表情，不会批量处理。一口气选很多表情会等上不少时间，建议先从少量开始。

如果开启了 **Expose media prompts before sending**(发送前显示媒体提示词)（位于 **Settings** 的 **Overall Generations**(总体生成) 区域），Marinara 会在提示词检查环节暂停。发给服务商之前，每条提示词都可以先读一遍、改一改。关闭这项设置就会跳过检查。

## 故障排查

生成失败，提示信息里提到 ffmpeg。装上 ffmpeg 并确认服务器能找到它，或者设置环境变量 `FFMPEG_PATH`。见上文“开始之前”。

下拉菜单显示找不到视频生成连接。先添加一个 **Video Generation** 连接，见[场景视频生成](scene-video.md)。

**Generate Sprite** 按钮是灰的。在某些设备上 Marinara 加载不了自带的图像库，于是所有立绘生成功能都会关闭，动态表情也在其中。部分 Android 和 Termux 安装环境会出现这种情况。

保存下来的 GIF 仍然带背景。这是正常现象，动态表情不做背景清除。见上文“关于透明背景的提醒”。

## 相关指南

- [角色立绘](../characters/sprites.md)
- [场景视频生成](scene-video.md)
- [可下载智能体参考](../agents/built-in-agents.md)
