# Storyboard 智能体指南

可下载的 **Storyboard** 智能体会把写完的故事文本变成一组有先后顺序的关键帧图像，还可以再加上短小的图生视频片段。它适用于 Game Mode(游戏模式) 和 Roleplay(角色扮演)。Conversation(对话模式) 的聊天不使用它。

Storyboard 包提供规划用的提示词、各项默认值和按聊天设置的控件。Marinara 负责生成媒体，把结果保存进 Gallery(图库)，再显示在聊天或 Game 查看器里。本指南先讲 Game Mode，Roleplay 的工作流在后面的 [Roleplay 分镜](#roleplay-storyboards)。Roleplay 的其他内容见 [Roleplay 模式：入门](../roleplay/getting-started.md)。

- **Game Mode** 使用一个已完成的游戏主持人（GM）叙述回合。它有 **Automatic Storyboard Illustrations**(自动分镜插图) 和 **Automatic Storyboard Animations**(自动分镜动画) 两个独立开关，最近一个 GM 回合可以用 **Gallery → Create storyboard**(图库 → 创建分镜)。分镜显示在浮动查看器里或作为 Game 背景，与叙述同步，静态规划器和动画规划器各自独立。
- **Roleplay** 使用上一次成功生成剧集之后所有已完成的消息。自动选项有 **Manual only**(仅手动)、**Still images**(静态图) 和 **Animations**(动画)，**Gallery → Create storyboard** 作用于最近一条已完成的 Assistant 回复。分镜内嵌显示在结束该剧集的那条回复下方，使用 episode contract、visual style、可选的 animation addon 和 output contract。

两种模式都会把关键帧图像保存到 Gallery 的 **Images**(图像) 选项卡，把片段保存到 **Videos**(视频) 选项卡。

## 安装智能体

1. 打开 **Agents**(智能体) 面板（Sparkles 图标）。
2. 选择 **Agent Organizer**(智能体管理器)。
3. 打开 **Storyboard**，选择 **Install**(安装)。
4. 打开一个 Game 或 Roleplay 聊天，然后打开 **Chat Settings → Agents**(聊天设置 → 智能体)。
5. 开启 **Enable Agents**(启用智能体)，再在 Storyboard 卡片里开启 **Enable Storyboards**(启用分镜)。

安装只是让这个智能体可以使用，并不会在每个聊天里启用它。不需要重启 Marinara。

如果没有成功，而且 Chat Settings 里没有 Storyboard：确认这个包已经装好、当前聊天是 Game 或 Roleplay，并且包的版本与你的 Marinara 版本兼容。

## Game Mode 分镜

Game Mode 的 Storyboard 只拿一个已完成的 GM 叙述回合当故事来源。它会去掉隐藏的 GM 命令标记，规划出有先后顺序的帧，并把每一帧绑定到回合里一段可阅读的文本范围。读者往下读时，查看器就跟着切换对应的帧。

### 制作 Game 分镜

**开始之前：** 这局游戏需要一个图像账号（游戏自己的，或者全局 Storyboard 设置里的）。见[图像生成服务商与设置](../media/image-providers.md)。

1. 安装 Storyboard，打开一个 Game Mode 聊天。
2. 打开 **Chat Settings → Agents**，开启 **Enable Agents**，再开启 **Enable Storyboards**。
3. 玩完一个 GM 叙述回合。
4. 打开 **Chat Settings → Gallery**(聊天设置 → 图库)，选择 **Create storyboard**(创建分镜)。

在 Gallery 里选择 **View storyboard**(查看分镜)，可以重新打开关掉的查看器。手动生成沿用当前的动画设置：**Automatic Storyboard Animations** 开着时，手动生成的分镜同样会请求片段。

如果没有成功，见[故障排查](#troubleshooting)。

### Game 的自动分镜

Storyboard 卡片上有两个开关：

- **Automatic Storyboard Illustrations** 在一个 GM 回合完成后生成静态关键帧。
- **Automatic Storyboard Animations** 还会为每个关键帧生成一段片段。开启动画会一并开启插图，关闭插图会同时关闭动画。

只有智能体在这局游戏里处于启用状态时，自动生成才会运行；已经有分镜的回合，它也不会再生成一次。想给最近这个回合再做一份，就用 Gallery 里的手动操作。

在 Generation 设置里开启 **Expose media prompts before sending**(发送前显示媒体提示词) 后，手动生成的 Game 分镜可以先把编译好的图像提示词显示出来供检查。自动分镜会跳过检查，以免打断游戏进程。

### Game 设置

打开 **Chat Settings → Agents → Storyboards**(聊天设置 → 智能体 → 分镜)。

| 设置 | 智能体默认值 | 控制什么 |
| --- | --- | --- |
| **Enable Storyboards** | 每个聊天默认 Off | 在这局游戏里启用已安装的智能体。 |
| **Automatic Storyboard Illustrations** | 由 Automatic generation 决定 | 每个 GM 回合之后的静态关键帧。 |
| **Automatic Storyboard Animations** | 由 Automatic generation 决定 | 为每个关键帧生成的 MP4 片段。 |
| **Keyframes per Turn** | 3(范围 1 到 200) | 目标帧数。回合太短时可能少于这个数。 |
| **Animation Clip Duration** | 5 秒（范围 1 到 15） | 每个片段请求的时长。服务可能会把它压到自己允许的范围内。 |
| **Viewer Display** | Floating | 可拖动的查看器，或者铺满整屏的 Game 背景。 |
| **Illustration Planner** | Still Keyframes | 规划成品静态插图。 |
| **Animation Planner** | Comic Page Animation | 规划可直接用于动画的首帧和运动指示。 |
| **Use Storyboard Template** | On | 套用选中的最终插图格式化器。 |
| **Storyboard Illustration Prompt** | Game Scene Illustration | 把规划好的帧整理成图像服务能用的形式。 |
| **Storyboard Video Prompt** | Cinematic Scene Video | 把首帧和运动方案整理成视频服务能用的形式。 |

包里还带了 NovelAI、美漫、漫画、动画和面向 LTX 的规划器。光选一个动画规划器并不会因此开启视频，仍然需要 **Automatic Storyboard Animations** 和一个视频账号。

每个聊天都可以覆盖智能体的默认值。继承来的值，Chat Settings 会标上 **Using agent default**(使用智能体默认值)；你覆盖某一项之后，旁边就会出现一个重置控件。

### Game 分镜是怎么生成的

Game Mode 给静态图和动画各留了一个规划器。

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

挑哪些故事节拍、按什么顺序排，由规划器决定。插图提示词是面向服务的格式化器，不是第二个规划器。开启动画之后，动画规划器会给出一段精确的首帧描述和一段运动指示，视频提示词再把这段运动指示变成最终请求。

### Game 查看器

- **Floating viewer**(浮动查看器) 是浮在游戏上方的一个面板，可以拖动，也可以调大小。它跟着读者在叙述里的阅读位置，显示对应的那一帧。视频就绪时播放视频，否则显示这一帧的图像。关掉它只会在当前回合隐藏。要重新打开，用 **Gallery → View storyboard**。
- **Game background**(Game 背景) 把当前帧铺在画面其余部分的后面。开着时它会替换平时生成的场景背景，所以 **Generate background**(生成背景) 不可用。背景片段只播一次，然后停在最后一帧。

要重播、播放/暂停和静音，打开 **Game controls**(游戏控制)（游戏手柄按钮，在聊天右上角附近）。电脑上它以窗口打开，手机上是面板。如果你已经把它移进 Chat Settings，就打开那里的 **Game controls** 区域。

### Storyboard Optimized 呈现方式不等于智能体开关

设置向导里的 **Storyboard Optimized**(分镜优化) 呈现方式会改动 GM 的叙述提示词，让每个回合带上更适合入画的视觉锚点。它不会安装或启用 Storyboard，不会开启自动媒体生成，也不会替你选图像账号和视频账号。**Standard**(标准) 和 **Storyboard Optimized** 两种呈现方式都可以配合这个智能体使用。智能体要另外安装和启用。

### Game Mode 配置组合

每套组合都把一条 Storyboard 链路和其余的 Game 设置、服务设置搭配在一起。包里有同名链路就直接套用，没有就照着列出的选项手动选。

#### Google 美漫分镜

链路：**Illustration Planner** 选 Still Keyframes，**Animation Planner** 选 Comic Page Animation，**Storyboard Illustration Prompt** 选 Game Scene Illustration，**Storyboard Video Prompt** 选 Comic Page Video，**Use Storyboard Template** 设为 On。

Game 侧的检查清单：

- **Illustrator**: On(在向导的 Features 步骤)
- 图像账号：Google/Nano Banana；**Image Style**: Default；保留设置阶段生成的美术风格
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- 视频账号：None

这样出来的是普通的静态分镜。保存下来的 Comic Page 动画链路，要等你以后选好视频账号并开启 **Automatic Storyboard Animations** 才会生效。

#### NovelAI 直出标签

链路：**Illustration Planner** 选 NovelAI Keyframes。**Storyboard Illustration Prompt** 则新建一个自定义选项，提示词正文只写下面这段文字。把 **Use Storyboard Template** 设为 On。Animation Planner 和 Video Prompt 保持不动。

```text
${scenePrompt}
```

Game 侧的检查清单：

- **Image Style**: Danbooru，并把 Danbooru 方案里那段散文式的 **Style text**(风格描述) 删掉
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- 正面标签、负面标签和插图标签按需要微调

这个直通模板会把规划器给出的精简 NovelAI 标签原样发出去，不再套上平时那层散文式的格式化器。

#### 本地 Krea 2 + LTX 2.3

链路：**Illustration Planner** 选 Still Keyframes，作为只出静态图时的回退选项；**Animation Planner** 选 LTX Simple Image-to-Video；**Storyboard Illustration Prompt** 选 Storyboard First Frame；**Storyboard Video Prompt** 选 Narration Passthrough；**Use Storyboard Template** 设为 On。

显存 8 GB 的显卡先从 480p、单个关键帧起步。跑通之后，再往 3 个关键帧和更高分辨率上加。ComfyUI 账号、占位符和完整的测试见 [Game Mode 中的 LTX 2.3 分镜](ltx-2-3-storyboards.md)。

<a id="roleplay-storyboards"></a>

## Roleplay 分镜

Roleplay 分镜会把已完成的几轮往来合成一段画面剧集，显示在结束这段剧集的那条 Assistant 回复下方。

### 制作 Roleplay 分镜

1. 安装 Storyboard，并在这个 Roleplay 聊天里启用它。
2. 在 **Chat Settings → Agents → Storyboards** 里选好 **Prompt connection**(提示词连接) 和 **Image model**(图像模型)；全局设置已经配齐的话，也可以保持 **Use global default**(使用全局默认值)。
3. 选一种 **Automatic mode**(自动模式)：
   - **Manual only**：不生成自动剧集。**Create storyboard** 按需现做一段静态剧集。
   - **Still images**：自动生成配好插图的剧集。
   - **Animations**：自动生成关键帧图像，并为每一帧生成一段片段。需要视频账号。
4. 设定 **Messages per episode**(每段剧集的消息数) 和 **Keyframes per episode**(每段剧集的关键帧数)。
5. 等一条新的 Assistant 回复生成完，或者打开 **Chat Settings → Gallery** 选择 **Create storyboard**。

多关键帧的分镜上有箭头，用它在各帧之间切换。带动画的帧会内嵌显示片段；片段还在生成或者不可用时，就退回显示图像。

### 剧集间隔是怎么算的

间隔决定两次成功的自动分镜之间要积累多少条新的用户消息和 Assistant 消息。两种角色的消息都算数，剧集会按顺序纳入这些新消息。默认值是 1，所以下一条完成的 Assistant 回复马上就能产出一段剧集。调大之后，对白和动作可以多积累一些。素材限定在最近 20 条消息、12,000 个字符以内，所以很长的聊天也不会生成没有上限的规划请求。

只有在完整或部分分镜保存成功之后，计数才会往前走，所以生成失败的剧集不会消耗掉素材。打开已有的聊天不会回补旧回复，自动生成会等待新完成的 Assistant 回复。

### Roleplay 提示词库

Roleplay 会把选中的四段提示词拼成一个规划请求：

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | 挑出有原文依据的节拍，并保持消息原有的顺序。 |
| **Visual style** | Normal / Anime | 每个关键帧的视觉风格。其他选项：NovelAI、Comic、Colored Manga、B&W Manga。 |
| **Animation addon** | Simple Storyboard Motion | 只在出片段时使用。加入一个做得到的动作、镜头行为、原文对白与音效、环境音和结尾定格。 |
| **Output contract** | Roleplay Keyframe JSON | 规划器返回的结构化关键帧字段。 |

接着由 **Storyboard Illustration Prompt** 把每个首帧整理成图像服务能用的形式；开启片段时，**Storyboard Video Prompt** 再整理运动方案。打开 Stage 1 里折叠的 **Prompt library**(提示词库) 编辑这些提示词。用 **Add option**(添加选项) 添加自定义提示词，然后重命名、填写简短说明并编辑正文。内置选项可以恢复为默认值。改了 Roleplay 的视觉风格，不会动到 Game Mode 的规划器。

### Storyboard 和 Illustrator 一起用

Storyboard 和 Illustrator 是分开的，手动触发的 Illustrator 操作照常可用。Roleplay 的 Storyboard 设为 **Still images** 或 **Animations** 时，Marinara 会为那条回复跳过 Illustrator 平时自动生成的图像，免得两者抢着出图。设为 **Manual only** 则不影响 Illustrator 原本的流程。

## Storyboard 智能体设置

打开 **Agents** 面板，选择 **Storyboard**，进入它的设置。没有自己覆盖设置的聊天，用的就是这里的默认值。

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| 智能体连接 | 你选中的智能体账号 | 用模型规划分镜。 |
| **Image model** | **Use the chat image connection**(使用聊天的图像连接) | 生成每一个关键帧。回退链条上必须有一个图像账号。 |
| **Video connection**(视频连接) | **Use the chat video connection**(使用聊天的视频连接) | 开启动画时生成片段。 |
| **Automatic generation**(自动生成) | Still images | 新启用的聊天一开始的自动行为。 |
| **Keyframes per turn** | 3(范围 1 到 200) | 有序帧的目标数量。 |
| **Clip seconds** | 5(范围 1 到 15) | 每个片段请求的时长。 |
| **Viewer display** | Floating viewer | Game 查看器的默认值。Roleplay 的分镜一律内嵌显示。 |
| **Default Roleplay episode interval** | 1(范围 1 到 100) | 两段自动剧集之间需要积累多少新的 Roleplay 内容。 |
| **Attach Card Appearance** | On | 把匹配到的角色外观加进图像提示词。如果角色卡或用户角色开启了 **Image Appearance Override**(图像专用外貌)，就用那段文字代替它的 **Appearance**(外观) 字段。 |
| **Send Avatar References** | On | 图像服务接受参考图时，发送匹配到的角色头像和用户角色头像。 |
| **Use the final image template** | On | 规划好的帧发给图像服务之前先格式化一次。在 Game 聊天里，这一项是 **Use Storyboard Template**。 |
| **Use NovelAI character prompts** | On | 只在受支持的 NovelAI V4 和 V4.5 官方账号上按角色使用原生提示词。其他服务走共用的提示词路径。 |

对 Game Mode 来说，库里有两条规划通道，按这局游戏出静态图还是出片段来选：**Still planner**(静态规划器)（默认 Still Keyframes）和 **Animation planner**(动画规划器)（默认 Comic Page Animation）。规划器的正文可以在全局的智能体设置里改，每个 Game 聊天在自己的设置里从这些选项中选择。

规划之后，由共用的格式化器生成最终请求：**Default image prompt**(默认图像提示词)（Game Scene Illustration）和 **Default video prompt**(默认视频提示词)（Cinematic Scene Video）。每个编号阶段都有自己折叠的 **Prompt library**：Stage 2 管图像格式化器，Stage 3 管图像感知的运动规划器，Stage 4 管视频直传格式化器。图像选项还包括 **Storyboard Illustration** 和 **Storyboard First Frame**。视频选项包括 **Anime Game Video**、**Comic Page Video** 和 **Narration Passthrough**。Game 和 Roleplay 聊天可以选择不同的格式化器。

Stage 3 的 **Image-aware shot planning**(图像感知镜头规划) 还会遵循视频账号的 **Video prompting instructions**(视频提示词指令)。在账号编辑器的这个字段里写明你的视频模型需要什么，比如镜头用语、提示词长度或声音提示。

账号的选取方式在两种模式下略有不同。Roleplay 提供按聊天设置的提示词、图像和视频选择器，选 **Use global default** 就继承 Storyboard 的设置。Game Mode 会优先用这局游戏自己的规划账号、图像账号和视频账号，没设置时再回退到智能体的默认值。出静态图需要图像账号。出动画需要关键帧图像先生成成功，还要有视频账号。

## 图像提示词与角色一致性

规划器决定画哪些瞬间，并写出每一帧的画面内容。最终的图像模板负责添加面向服务的结构、匹配到的角色外观、参考图处理、地点上下文、战役美术指导和图像指令。

如果规划器返回的语法本来就是图像服务需要的，就用 `${scenePrompt}` 这样的直通模板。只有确实想绕开格式化器时，才关掉 **Use the final image template**。必需的图像指令照样生效。

想让角色形象更稳定：

- 角色卡里的 Appearance 字段要写得具体，也要及时更新。
- 除非规划器已经把需要的细节都重复了一遍，否则保持 **Attach Card Appearance** 开启。
- 服务接受参考图、而且头像和你想要的外形一致时，保持 **Send Avatar References** 开启。
- 每一帧里出场的角色少一点、清楚一点更好。分镜只会带上匹配到的、画面里可见的角色和用户角色，不会把聊天里的每个人都带上。

## 成本与性能

每个关键帧都是一个独立的图像任务。带动画的分镜还会为每个成功的关键帧再加一个视频任务，所以一段 3 帧的动画分镜可能会发出 3 个图像请求和 3 个视频请求。测试新的服务或本地环境时，先从静态图和单个关键帧开始。基本链路跑通之后，再去加帧数、片段时长和自动间隔。

## 从旧分镜系统沿用下来的游戏

已有的 Game 聊天里可能还留着旧版内置 Storyboard 界面写下的设置。装上这个包之后，Marinara 会把它们保留成按聊天的覆盖设置，所以老游戏的表现可能和现在的智能体默认值不一样。打开 **Chat Settings → Agents → Storyboards**，用每一项的重置控件让它重新跟随智能体默认值。这些设置只是迁移数据。要出图，仍然需要安装这个包，并在这局游戏里启用它。

<a id="troubleshooting"></a>

## 故障排查

### Create storyboard 能点，但生成失败

- 在这个聊天里开启 **Enable Agents** 和 **Enable Storyboards**。
- 在 Roleplay 的 Storyboard 卡片、Game 设置或全局的 Storyboard 设置里，选一个可用的图像生成账号。
- 等 Assistant 或 GM 的回复生成完，再试一次。

### Roleplay 没有生成自动剧集

- 选 **Still images** 或 **Animations**，不要选 **Manual only**。
- 等一条新完成的 Assistant 回复。打开聊天不会回补旧消息。
- 检查 **Messages per episode**。要积累足够多的新用户消息和 Assistant 消息。
- 失败的那一次不会推进计数，所以去服务器日志里查最初的服务报错或解析报错。

### 图像出来了，视频没出来

- Roleplay 里选 **Animations**；Game Mode 里开启 **Automatic Storyboard Animations**。
- 选一个支持图生视频输入的 Video Generation 账号。
- 看看 Gallery 的 **Videos** 选项卡。片段可能比它的关键帧图像晚完成。
- 如果模型出错后规划走了回退流程，Marinara 可能会保留回退生成的图像，同时跳过这一次的视频。

### 分镜只出了一半或者卡住了

可能是某个服务任务失败、超时，或者撞上了速率限制、内容限制。服务本身正常、只是慢的话，就在 `.env` 里调高 `IMAGE_GEN_TIMEOUT_MS` 或 `VIDEO_GEN_TIMEOUT_MS`，然后重启 Marinara，因为这两个值只在启动时读取。见[服务器配置参考](../CONFIGURATION.md)。

开启 Debug 模式，在服务器日志里搜 `storyboard`，就能看到规划器、编译出的图像提示词、参考图选择和视频提示词。调试日志里可能含有私密的聊天内容，分享之前先清理一下。

## 相关指南

- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [可下载智能体参考](../agents/built-in-agents.md)
- [Game Mode：入门](getting-started.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [图像生成服务商与设置](../media/image-providers.md)
- [场景视频生成](../media/scene-video.md)
- [Game Mode 中的 LTX 2.3 分镜](ltx-2-3-storyboards.md)
