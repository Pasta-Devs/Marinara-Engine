# 图像风格方案

本指南介绍 Marinara Engine 的图像风格方案。风格方案就是一套可以反复使用的“统一画风”，Marinara 在把图像提示词发给图像服务商之前，会先用它给提示词定调。头像、肖像、自拍、背景、插图、立绘都能靠它保持同一种观感。

## 什么是风格方案

Marinara Engine 能生成很多种图像：角色头像和用户角色头像、肖像、Conversation(对话模式) 里的自拍、场景背景、场景插图，还有角色立绘。这些图像最初都是一段文字提示词。

风格方案是一组保存好的规则，Marinara 会把它加进那段提示词里。它可以加正向词（想要的效果）、负向词（想避开的效果），还能指定偏好的提示词写法。这样每张图像的观感都能保持一致，也不用每次重新敲一遍同样的风格词。

其中一个方案会被指定为全应用默认。单个聊天或单个图像连接也可以单独指定方案，优先级高于默认。下文会逐一说明。

按以下步骤打开编辑器。

1. 打开 **Settings**(设置)。
2. 打开 **Generations**(生成) 选项卡。
3. 找到 **Image Generation**(图像生成) 部分。
4. 向下滚动到 **Style Profiles**(风格方案)。

## 内置方案

Marinara 内置了 10 套风格方案，默认使用 **Auto**。每一套都可以编辑，内置方案还能随时恢复成原始值。

下文会用到几个名词：

- SDXL 指 Stable Diffusion XL，一个流行的开源图像模型，可以跑在自己的电脑上，也可以通过云服务使用。
- checkpoint 指一个训练好的图像模型文件。不同的画风要下载不同的 checkpoint。这些方案里提到的例子有 Illustrious、Pony 和 NovelAI。
- Danbooru 是一个大型动漫图像网站。它那种用逗号分隔的短标签（比如“1girl, long hair, smile”）后来成了给动漫图像模型写提示词的常见方式。

内置方案如下：

- **Off**(关闭)：不添加任何统一画风。提示词基本按原样发出。
- **Auto**(自动)：根据角色、游戏、场景和所选图像模型推断出一致的观感。这是默认方案。
- **Anime**(动漫)：通用的动漫风格标签，画面干净。
- **Danbooru / Illustrious**：Danbooru 风格的标签，面向 Illustrious、Pony、NovelAI 这类 SDXL 动漫 checkpoint。
- **Realistic SDXL**(SDXL 写实)：面向 SDXL 模型的自然语言写实描述。
- **Photorealistic**(照片写实)：照片式提示词，皮肤、光照和材质都力求可信。
- **Cinematic**(电影感)：戏剧化的光影和有张力的构图，适合主视觉。
- **Digital Painting**(数字绘画)：概念设计式的笔触和经过设计的光照。
- **Painterly Fantasy**(奇幻厚涂)：柔和的厚涂奇幻插图。
- **Z-Image Turbo Narrative**：紧凑的散文式描述，适合擅长读普通句子的 Z-Image Turbo 系列模型。

## 修改全局风格

除非聊天或连接另行指定，全局默认方案会作用于每一张生成的图像。按以下步骤修改。

1. 依次打开 **Settings**、**Generations** 选项卡、**Image Generation**、**Style Profiles**。
2. 打开 **Default style**(默认风格) 下拉菜单。
3. 选择要在全应用使用的方案。

选择会立即保存。之后生成的图像都会使用选好的方案。

## 复制并自定义方案

内置方案可以直接改，但用 **Clone**(克隆) 按钮能保留原版，另外做一份自己的。按以下步骤新建并自定义方案。

1. 打开 **Editing**(正在编辑) 下拉菜单，选一个最接近目标效果的方案。
2. 点击 **Clone**。Marinara 会复制一份，选中它进入编辑，并立刻把这份副本设为全应用默认风格。
3. 把 **Name** 输入框改成一个自己认得出的名字。
4. 选择 **Prompt grammar**(提示词语法)，下一节会讲。
5. 在 **Style text**(风格描述) 里用大白话写出想要的观感。由 AI 撰写图像提示词时（Illustrator、自拍和 Noodle 都是这样），AI 会参照你的 Style text 来写，而不是照抄。其他图像（比如头像）可能会按原样加入 Style text。
6. 添加 **Positive tags**(正向标签，要包含的词) 和 **Negative tags**(负向标签，要避开的词)。
7. 展开 **Per-image tags**(分图像类型标签) 部分，给每种图像（头像、肖像、自拍、背景、插图、立绘）补充各自的标签。
8. 第 2 步里副本已经成了全应用默认。想把这个身份交还给别的方案，打开 **Default style** 选中它即可。

有两个按钮用来管理方案：

- **Reset**(重置) 只对内置方案有效，作用是把该内置方案恢复成原始值。
- **Delete**(删除) 只对自己新建的方案有效，而且方案总数多于一个时才能用。

## 提示词语法模式

**Prompt grammar** 下拉菜单告诉 Marinara 图像模型习惯用哪种方式读提示词。选一个和自己图像模型相符的模式。一共四种。

- **Hybrid**(混合)：句子和标签混用，通用场合的稳妥选择。
- **Danbooru tags**(Danbooru 标签)：逗号分隔的 Danbooru 风格短标签。最适合 Illustrious、Pony、NovelAI 这类动漫 SDXL checkpoint。
- **Tags**(标签)：逗号分隔的短关键词，不遵循 Danbooru 那套约定。
- **Natural language**(自然语言)：普通句子。最适合读散文的模型，比如 DALL-E 和 Z-Image Turbo 系列。

## 测试台

**Test bench**(测试台) 部分可以在不真正生成图像的前提下，预览 Marinara 到底会发出什么。它在 Style Profiles 编辑器内部。按以下步骤使用。

1. 选择 **Image kind**(图像类型)，比如肖像或背景。
2. 在 **Sample input**(示例输入) 里随手写一段提示词。
3. 查看 **Final positive prompt**(最终正向提示词) 和 **Final negative prompt**(最终负向提示词) 两个框。

测试台还会给出一句关于清理的说明。什么都没改动时，它显示“No cleanup needed for this sample.”改动了提示词时，它会说明清理掉了多少个重复或位置不对的片段。

## Marinara 如何清理提示词

任何图像请求发出之前，Marinara 都会用当前生效的方案编译提示词。编译过程会做这几件事：

- 去掉近似重复的标签，比如重复出现的质量标签。
- 把简单的否定短语（比如“avoid text”或“no watermark”）挪进负向提示词。
- 背景、插图、自拍这三类图像保留原本的措辞。肖像、头像、立绘这三类则会把文字提炼成它能识别的简短视觉标签。
- 按当前生成的图像类型，补上方案里对应的分图像类型标签。

## 处理前后的例子

假设选中 **Danbooru / Illustrious** 方案，把 **Image kind** 设为肖像，并在 **Sample input** 里输入：

```
masterpiece, masterpiece, red-haired knight, no watermark
```

测试台给出的 **Final positive prompt** 是：

```
detailed eyes, solo, upper body, portrait, looking at viewer, anime screencap, masterpiece, best quality, absurdres
```

这里发生了三件事：

- “no watermark”从正向提示词挪进了 **Final negative prompt**，清理说明会把这次改动计入。
- 方案补上了自己的风格标签、肖像的分图像类型标签和质量标签。结果里的“masterpiece”来自方案自带的标签，不是输入的文字。
- 输入的文字被提炼过。肖像类图像只保留编译器能识别为明确视觉线索的片段，“red-haired knight”不属于其中，因此被丢掉了。

如果肖像、头像或立绘把主体描述弄丢了，可以改用 **illustration** 图像类型，这一类会保留原本的措辞。

## 优先级：聊天、连接、全局

Marinara 会从三个地方挑选风格方案，越具体的选择优先级越高。顺序是：

1. 当前聊天或游戏里明确指定的方案。
2. 图像连接上设置的 **Style Profile**(风格方案)，位于连接编辑器的 **Local Image Defaults**(本地图像默认值) 下面。
3. 在 **Settings** 里设置的全局 **Default style**。

**Local Image Defaults** 部分只对本地 Stable Diffusion 连接（AUTOMATIC1111 / SD Web UI、ComfyUI 和 NovelAI）出现。其余服务商一律直接回落到全局 **Default style**。要给单个连接指定风格方案，打开该连接，展开 **Local Image Defaults**，在 **Style Profile** 下拉菜单里选一个方案。保持 **Use global default** 就是跟随全局选择。当 Marinara 能从连接的模型名猜出合适的方案时，会显示一个“Use ...”按钮，点一下即可套用。

## 相关指南

- [图像生成服务商与设置](image-providers.md)
- [Illustrator 智能体](illustrator-agent.md)
- [自拍](../conversation/selfies.md)
