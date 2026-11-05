# 动态表情

动态表情是一小段循环播放的动画，用作角色的立绘。立绘就是聊天时 Marinara 显示的那张站姿角色画。普通的表情立绘是一张静态图，比如一张笑脸。动态表情会在它的位置上播放，并存成 GIF，这是一种本身就能循环播放一小段动画的图像文件。

Marinara 分两步做出一个动态表情：先让一个 **Video Generation**(视频生成) 账号生成一小段表情视频，再在你的电脑上把这段视频转成循环播放的 GIF。存好之后，它和其他立绘用起来完全一样。可下载的 **Expression Engine** 智能体会在场景需要某种情绪时显示它。见[角色立绘](../characters/sprites.md)和[可下载智能体参考](../agents/built-in-agents.md)。

<a id="before-you-start"></a>

## 开始之前

需要准备两样东西。

1. 一个视频账号。添加方法见[场景视频生成](scene-video.md)。
2. 运行 Marinara 的那台电脑上装好 ffmpeg。ffmpeg 是一个免费的媒体工具，负责把视频片段转成 GIF。

如果缺少 ffmpeg，生成会立刻失败，并给出这条提示：

```text
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

装上 ffmpeg，让系统能找到它，或者把环境变量 `FFMPEG_PATH` 设为 ffmpeg 程序的完整路径。环境变量是服务器启动前交给它的一项设置。

## 生成动态表情

用的窗口和生成静态立绘时是同一个。

1. 打开角色的 **Character Editor**(角色编辑器)，或者用户角色的 **Persona Editor**(用户角色编辑器)。
2. 打开 **Sprites**(立绘) 选项卡，再进入 **Facial Expressions**(面部表情) 分类。
3. 点击 **Generate Sprite**(生成立绘)，**Generate Sprites** 窗口随即打开。
4. 勾选 **Generate animated portraits**(生成动态立绘)。窗口会切换到动态模式：图像选择器变成视频选择器，立绘表用的网格设置消失，Marinara 改为一次生成一个表情。
5. 选择你的视频账号。
6. 填写 **Appearance Description**(外观描述)，让服务知道角色长什么样。
7. 选择要生成的表情。
8. 生成单个表情点击 **Generate Animated Portrait**，一次生成多个则点击 **Generate Animated Portraits**。

运行过程中会显示“Generating animated portrait GIFs...”生成结束后，检查结果，点击保存按钮把它们加到角色或用户角色上。如果某个表情失败，Marinara 会保留已完成的部分，并列出失败的表情名，方便重试。

动态表情一次只生成一个，所以比静态立绘慢。先从少量开始。

在 **Settings → Generations → Overall Generations**(设置 → 生成 → 总体生成) 里开启 **Expose media prompts before sending**(发送前显示媒体提示词) 后，Marinara 会暂停，让你在每条提示词发给服务之前先读一遍、改一改。

## 时长与画面比例

每个动态表情都是 9:16 的竖版立绘片段，这个比例无法更改。要调整每段片段的时长，打开 **Settings → Generations**(设置 → 生成)，找到 **Video Generation**，设置 **Animated expression length**(动态表情时长)。默认 3 秒，范围是 1 到 8 秒。Marinara 保存的是一个宽 512 像素的小体积循环 GIF。片段越短，文件越小，循环也越紧凑。

<a id="backgrounds-are-not-removed"></a>

## 背景不会被去除

静态立绘可以清除背景，让角色像浮在场景上一样。动态表情会跳过这一步清理。在动态模式下，**Prefer clean transparent-style background**(倾向于干净的透明风格背景) 复选框只是往视频提示词里加一句提示。它的帮助文字写着“GIF transparency is not guaranteed.”检查环节也会注明：GIF 输出会跳过背景清除、立绘表切分和帧裁剪。所以动态表情可能保留可见的背景。想要画面干净一些，就在 **Appearance Description** 里要求纯色背景。

## 故障排查

- **生成失败，提示里提到 ffmpeg**：装上 ffmpeg，或者设置 `FFMPEG_PATH`。见[开始之前](#before-you-start)。
- **选择器显示找不到视频账号**：先添加一个。见[场景视频生成](scene-video.md)。
- **Generate Sprite 按钮是灰的**：在某些设备上，比如部分 Android 和 Termux 安装环境，Marinara 加载不了自带的图像库。这会关闭所有立绘生成功能，动态表情也在其中。
- **保存下来的 GIF 仍然带背景**：这是正常的。见[背景不会被去除](#backgrounds-are-not-removed)。

## 相关指南

- [角色立绘](../characters/sprites.md)
- [场景视频生成](scene-video.md)
- [可下载智能体参考](../agents/built-in-agents.md)
