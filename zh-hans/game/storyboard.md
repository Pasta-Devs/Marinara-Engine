# Storyboard 智能体指南

可下载的 **Storyboard** 智能体会把写完的故事文本变成一组有先后顺序的关键帧图像，还可以再加上短小的图生视频片段。它支持 **Roleplay**(角色扮演) 和 **Game Mode**(游戏模式)。Conversation(对话模式) 的聊天不使用分镜。

这是目前基于智能体的工作流。Storyboard 包提供规划用的提示词、各项默认值和按聊天设置的控件。Marinara Engine 负责宿主端的集成，也就是生成媒体、把它保存进 Gallery(图库)，再显示在聊天或 Game 查看器里。

## Roleplay 和 Game Mode 一览

| | Roleplay | Game Mode |
| --- | --- | --- |
| 故事来源 | 上一次成功生成剧集之后所有已完成的用户消息和 Assistant 消息 | 一个已完成的 GM(游戏主持人) 叙述回合 |
| 自动选项 | **Manual only**、**Still images** 或 **Animations** | **Automatic Storyboard Illustrations** 和 **Automatic Storyboard Animations** 两个独立开关 |
| 手动操作 | 对最近一条已完成的 Assistant 回复用 **Gallery > Create storyboard** | 对最近一个已完成的 GM 回合用 **Gallery > Create storyboard** |
| 显示方式 | 内嵌在结束该剧集的那条 Assistant 回复下方 | 浮动查看器或 Game 背景，与叙述同步 |
| 规划提示词 | Episode contract、visual style、可选的 animation addon 和 output contract | 静态规划器和动画规划器各自独立 |
| 共用的最终提示词 | 插图图像提示词和动画视频提示词 | 插图图像提示词和动画视频提示词 |

两种模式都会把关键帧图像保存到 Gallery 的 **Images** 选项卡，把片段保存到 **Videos** 选项卡。

## 安装智能体

1. 点击闪光图标打开 **Agents**(智能体) 面板。
2. 选择 **Download Agents**(下载智能体)。
3. 打开 **Storyboard**，选择 **Install**。
4. 打开一个 Roleplay 或 Game 聊天，然后打开 **Chat Settings > Agents**(聊天设置 > 智能体)。
5. 开启 **Enable Agents**，再在 Storyboard 卡片里开启 **Enable Storyboards**。

装好这个包只是让兼容的聊天能用它，并不会在每个聊天里悄悄启用。当前这个包安装完之后不需要重启 Marinara。

如果 Chat Settings 里没有 Storyboard，先确认这个包已经装好，并且当前聊天处于 Roleplay 或 Game Mode。

## Storyboard 智能体设置

打开 **Agents** 面板，选择 **Storyboard**，进入它的设置。没有单独设置覆盖的聊天，用的就是这里的值。

### 生成与媒体默认值

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| 智能体连接 | 当前选中的智能体连接 | 用 LLM 规划分镜 |
| **Image connection** | Use the Game image connection | 生成每一个关键帧；回退链条上必须有一个图像连接 |
| **Video connection** | Use the Game video connection | 开启动画时生成片段 |
| **Automatic generation** | Still images | 决定新启用的聊天一开始的自动行为 |
| **Keyframes per turn** | 3(范围 1 到 6) | 设定有序帧的目标数量 |
| **Clip seconds** | 5(范围 1 到 15) | 设定每个片段请求的时长 |
| **Viewer display** | Floating viewer | 设定 Game Mode 查看器的默认值；Roleplay 的分镜一律内嵌显示 |
| **Default Roleplay episode interval** | 1(范围 1 到 100) | 设定两段自动剧集之间要积累多少新的 Roleplay 内容 |
| **Attach Card Appearance** | On | 把匹配到的角色外观细节加进图像提示词 |
| **Send Avatar References** | On | 图像服务商支持参考图时，发送匹配到的角色头像和用户角色头像 |
| **Use the final image template** | On | 规划好的帧发给图像服务商之前先格式化一次 |
| **Use NovelAI character prompts** | On | 在受支持的 NovelAI V4/V4.5 官方连接上按角色使用原生提示词 |

### Game 提示词库

Game 这一侧的库提供两条规划通道。走哪一条，取决于这局游戏当前是出静态图还是出片段。

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| **Still planner** | Still Keyframes | 把一个已完成的 GM 回合拆成一个个成品静态画面 |
| **Animation planner** | Comic Page Animation | 生成可直接用于动画的首帧，以及按时长调整的运动指示 |

包里还带了 NovelAI、美漫、彩色漫画、黑白漫画、动画剧集和面向 LTX 的几种规划器。规划器的提示词正文可以在全局的智能体设置里改。静态选项和动画选项具体选哪个，由 Game 聊天在 **Chat Settings > Agents > Storyboards** 下面决定。

### Roleplay 提示词库

Roleplay 会把选中的四段提示词拼成一个规划请求。

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | 挑出有原文依据的已完成节拍，并保持消息原有的顺序 |
| **Visual style** | Normal / Anime | 定义每个关键帧的视觉处理方式 |
| **Animation addon** | Simple Storyboard Motion | 只在出片段时加入运动、镜头、原文对白与音效、环境音和结尾定格 |
| **Output contract** | Roleplay Keyframe JSON | 定义规划器返回的结构化关键帧字段 |

打开 Stage 1 内折叠的 **Prompt library**(提示词库) 编辑这些完整集合。用 **Add option**(添加选项) 添加自定义提示词、重命名、填写简短说明并编辑正文。内置选项可以恢复为包默认值。

### 共用的服务商格式化器

两种模式各自规划好帧之后，都由共用的格式化器生成发给服务商的最终请求。

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| **Default image prompt** | Game Scene Illustration | 把每个规划好的关键帧整理成图像服务商能用的形式 |
| **Default video prompt** | Cinematic Scene Video | 把首帧图像和运动方案整理成视频服务商能用的形式 |

每个编号阶段都有自己的折叠式 **Prompt library**：Stage 2 管理图像格式化器，Stage 3 管理参考图像的运动规划器，Stage 4 管理视频直传格式化器。内置图像选项还包括 **Storyboard Illustration** 和 **Storyboard First Frame**。视频选项包括 **Anime Game Video**、**Comic Page Video** 和 **Narration Passthrough**。Game 和 Roleplay 聊天可以选择不同格式化器，无须改动底层共享提示词集合。

### 全局默认值与聊天覆盖设置

每个聊天都可以覆盖智能体的默认值。继承来的值，Chat Settings 会标上 **Using agent default**；一旦建立了自己的覆盖设置，旁边就会出现一个重置控件。

连接的优先级在两种模式下略有不同：

- Roleplay 提供按聊天设置的提示词、图像和视频选择器。选 **Use global default** 就继承 Storyboard 的设置。
- Game Mode 会优先用这局游戏自己的规划连接、图像连接和视频连接，没设置时再回退到 Storyboard 智能体的默认值。

出静态图必须有图像连接。出动画则要求关键帧图像先生成成功，同时还要有视频连接。

## Roleplay 分镜

Roleplay 分镜会把已完成的几轮往来合成一段画面剧集，并显示在结束这段剧集的那条 Assistant 回复下方。

### 快速上手

1. 安装 Storyboard，并在这个 Roleplay 聊天里启用它。
2. 在 **Chat Settings > Agents > Storyboards** 里选好 **Prompt connection** 和 **Image connection**；全局设置已经配齐的话，保持 **Use global default** 也可以。
3. 选一种 **Automatic mode**：
   - **Manual only**：不生成自动剧集，需要的时候用 **Create storyboard** 现做一段静态剧集。
   - **Still images**：自动生成配好插图的剧集。
   - **Animations**：自动生成关键帧图像，并为每一帧生成一段片段；这需要视频连接。
4. 设定 **Messages per episode** 和 **Keyframes per episode**。
5. 等一条新的 Assistant 回复生成完，或者打开 Gallery 选择 **Create storyboard**。

多关键帧的分镜上有箭头，用它在各帧之间切换。带动画的帧会内嵌显示可播放的片段；片段还在生成或者用不了时，就退回显示图像。

### 剧集间隔是怎么算的

这个间隔决定两次成功的自动分镜之间要积累多少条新的用户消息和 Assistant 消息。两种角色的消息都会推进计数，剧集则按时间先后把这些新消息全部纳入。

默认值是 1，所以下一条新生成完的 Assistant 回复马上就能产出一段剧集。调大之后，对白和动作可以先多积累一些。素材范围限定在最近 20 条消息、12,000 个字符以内，这样很旧或者很长的聊天也不会生成一个没有上限的规划请求。

只有在完整或部分分镜保存成功之后，节奏锚点才会往前走。剧集生成失败不会消耗掉素材。打开一个已有的聊天不会回补旧回复，自动生成只等新生成完的 Assistant 回复。

### Roleplay 提示词链路

交给共用的服务商格式化器之前，Roleplay 要先经过四层规划：

1. **Episode contract** 挑出已完成、有原文依据的故事节拍，并把它们锚定到传入的消息上。
2. **Visual style** 在 Normal/Anime、NovelAI、Comic、Colored Manga 和 B&W Manga 几种处理方式里选一种。
3. **Animation addon** 只在生成动画分镜时加入。它描述一个做得到的动作、镜头行为、有原文依据的对白与音效、环境音，以及结尾的定格。
4. **Output contract** 定义规划器返回的结构化关键帧结果。

接着由 **Storyboard Illustration Prompt** 把每个规划好的首帧整理成图像服务商能用的形式。开启片段之后，**Storyboard Video Prompt** 再把运动方案整理成视频服务商能用的形式。

Roleplay 提示词库和 Game 规划器库是分开的。改了 Roleplay 的视觉风格，不会动到 Game Mode 的静态规划器或动画规划器。

### Storyboard 和 Illustrator 一起用

Storyboard 和 Illustrator 是两个各自独立的智能体。手动触发的 Illustrator 操作和 Illustrator 的其他媒体照常可用。Roleplay 的 Storyboard 设为 **Still images** 或 **Animations** 时，Marinara 会为那条已完成的回复关掉 Illustrator 平时自动生成的前景图像，免得两个智能体在回复之后抢着出图。设为 **Manual only** 则不影响 Illustrator 原本的流程。

## Game Mode 分镜

Game Mode 的分镜只拿一个已完成的 GM 叙述回合当故事来源。它会先去掉隐藏的 GM 命令标记，再规划出有先后顺序的帧，并把每一帧绑定到回合里一段可阅读的文本范围。往下读的时候，查看器就跟着切换对应的帧。

### 快速上手

1. 安装 Storyboard。
2. 新建或打开一个 Game Mode 聊天。
3. 打开 **Chat Settings > Agents**，开启 **Enable Agents**，再开启 **Enable Storyboards**。
4. 确认这局游戏有图像连接，或者全局的 Storyboard 设置里已经配好了一个。
5. 玩到 GM 讲完一个叙述回合。
6. 打开 **Gallery**，选择 **Create storyboard**。

关掉的 Game 查看器可以重新打开：在 Gallery 里选择 **View storyboard**。手动生成沿用当前的动画设置，也就是说 **Automatic Storyboard Animations** 开着时，手动生成的分镜同样会请求片段。

### Game 的自动分镜

Storyboard 卡片上有两个自动化开关：

- **Automatic Storyboard Illustrations** 在一个 GM 回合结束后生成静态关键帧。
- **Automatic Storyboard Animations** 会额外为每个关键帧生成一段片段。开启动画的同时会一并开启插图；关闭插图则会同时关闭动画。

只有 Storyboard 智能体在这局游戏里处于启用状态，自动生成才会运行。已经有分镜的回合，它也不会再生成一次。确实想给最近这个回合再做一份分镜，就用 Gallery 里的手动操作。

在 Generation 设置里启用了 **Expose image prompts before sending** 之后，手动生成的 Game 分镜可以先把编译好的图像提示词显示出来供检查。自动分镜不会弹出检查窗口，以免打断游戏进程。

### Game 设置

打开 **Chat Settings > Agents > Storyboards**。

| 设置 | 智能体默认值 | 控制什么 |
| --- | --- | --- |
| **Enable Storyboards** | 每个聊天默认 Off | 在这局游戏里启用已安装的智能体 |
| **Automatic Storyboard Illustrations** | 由 Automatic generation 推导 | 每个 GM 回合结束后生成静态关键帧 |
| **Automatic Storyboard Animations** | 由 Automatic generation 推导 | 为每个关键帧生成 MP4 片段 |
| **Keyframes per Turn** | 3(范围 1 到 6) | 目标帧数；回合太短时可能少于这个数 |
| **Animation Clip Duration** | 5 秒（范围 1 到 15） | 每个片段请求的时长；服务商可能会压到更低 |
| **Viewer Display** | Floating | 可拖动的查看器，或者铺满整屏的 Game 背景 |
| **Still Planner** | Still Keyframes | 规划成品静态插图 |
| **Animation Planner** | Comic Page Animation | 规划可直接用于动画的首帧和运动指示 |
| **Use Storyboard Template** | On | 套用选中的最终插图格式化器 |
| **Storyboard Illustration Prompt** | Game Scene Illustration | 把规划好的帧整理成图像服务商能用的形式 |
| **Storyboard Video Prompt** | Cinematic Scene Video | 把首帧和运动方案整理成视频服务商能用的形式 |

包里同样带了 NovelAI、美漫、漫画、动画和面向 LTX 的规划器。光选一个动画规划器并不会因此开启视频生成，仍然需要开启 **Automatic Storyboard Animations** 并配好视频连接。

### Game 提示词链路

Game Mode 给静态结果和动画结果各留了一个规划器：

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

挑哪些故事节拍、按什么顺序排，由规划器决定。插图提示词只是面向服务商的格式化器，不是第二个故事规划器。开启动画之后，动画规划器会同时给出一段精确的首帧描述和一段运动指示，视频提示词再把这段运动指示变成最终请求。

### 修订后的 Game Mode 配置组合

下面这几套组合把包内预置的分镜链路和剩下的 Game 设置、服务商设置搭配在一起。包里有同名链路就直接套用，没有就照着下面列出的选项手动配一遍。

#### Google 美漫分镜

包内预置的链路：

- **Illustration Planner**: Still Keyframes
- **Animation Planner**: Comic Page Animation
- **Storyboard Illustration Prompt**: Game Scene Illustration
- **Storyboard Video Prompt**: Comic Page Video
- **Use Storyboard Template**: On

Game 侧的检查清单：

- **Visual Generation**: On
- **Image Connection**: Google/Nano Banana
- **Image Style**: Default
- 保留创建游戏时生成的美术风格。
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- **Video Connection**: None

这样出来的是普通的静态分镜。保存下来的 Comic Page 动画链路要等以后选好视频连接、并开启 **Automatic Storyboard Animations** 之后才会生效。

#### NovelAI 直出标签

包内预置的链路：

- **Illustration Planner**: NovelAI Keyframes
- **Storyboard Illustration Prompt**：新建一个自定义选项，提示词正文只写：

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template**: On
- Animation Planner 和 Storyboard Video Prompt 保持不动。

Game 侧的检查清单：

- **Image Style**: Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- 把 Danbooru 方案里那段散文式的 **Style Text** 删掉。
- 正面标签、负面标签和插图标签按需要微调。

这个自定义的直通模板会把规划器给出的精简 NovelAI 标签原样发出去，不再套上平时那层散文式的插图格式化器。

#### 本地 Krea 2 + LTX 2.3

包内预置的链路：

- **Illustration Planner**: Still Keyframes，只出静态图时的回退选项
- **Animation Planner**: LTX Simple Image-to-Video
- **Storyboard Illustration Prompt**: Storyboard First Frame
- **Storyboard Video Prompt**: Narration Passthrough
- **Use Storyboard Template**: On

显存 8 GB 的显卡先从 480p、单个关键帧起步。这一步顺利跑通之后，再往 3 个关键帧和更高分辨率上加。ComfyUI 连接、占位符和完整的测试流程见 [Game Mode 中的 LTX 2.3 分镜](ltx-2-3-storyboards.md)。

### Storyboard Optimized 呈现方式不等于智能体开关

Game 设置向导里的 **Storyboard Optimized** 呈现方式只改 GM 的叙述提示词，让每个回合里更容易找到适合入画的视觉锚点。它不会安装或启用 Storyboard，不会开启自动媒体生成，也不会替你选图像连接和视频连接。

Standard 和 Storyboard Optimized 两种呈现方式都可以配合 Storyboard 智能体使用。智能体要另外安装和启用。

### Game 查看器

**Floating viewer** 是浮在游戏上方的一个面板，可以拖动，也可以调大小。它跟着阅读位置在 GM 叙述里移动，显示对应的那一帧。视频就绪时就播视频，否则退回显示这一帧的图像。

**Game background** 把当前帧铺在游戏控件的下层。这个模式开着的时候，它会顶掉平时生成的场景背景，所以普通的 **Generate background** 操作用不了。背景片段只播放一次，播完停在最后一帧；重播、播放/暂停和静音由游戏控件提供。

关掉浮动查看器，只是在当前回合隐藏它。要重新打开，用 **Gallery > View storyboard**。

## 图像提示词与角色一致性

选中的规划器和最终的图像提示词分工不同：

- 规划器决定画哪些瞬间，并写出每一帧的画面内容。
- 最终的图像模板负责添加面向服务商的结构、匹配到的角色外观、参考图处理、地点上下文、战役美术指导和图像指令。

如果规划器返回的提示词语法本来就是图像服务商需要的，就改用 `${scenePrompt}` 这样的直通模板。只有确实想绕开选中的格式化器时，才去关掉 **Use the final image template**。必需的图像指令照样生效。

想让角色形象更稳定：

- 角色卡里的 Appearance 字段要写得具体，也要及时更新。
- 除非选中的规划器已经把需要的外观细节都重复了一遍，否则 **Attach Card Appearance** 保持开启。
- 服务商接受参考图、而且头像和想要的外形一致时，**Send Avatar References** 保持开启。
- 每一帧里出场的角色少一点、清楚一点更好。分镜只会带上匹配到的、画面里可见的角色和用户角色参考，不会把聊天里的每个角色都塞进去。

**Use NovelAI character prompts** 只对走受支持的 NovelAI V4/V4.5 官方连接发出去的请求有影响。换成别的服务商，即使这个开关开着，走的也还是共用的提示词链路。

## 成本与性能

每个关键帧都是一个独立的图像任务。带动画的分镜还会为每个成功的关键帧再加一个视频任务。所以一段 3 帧的动画分镜可能会发出 3 个图像请求和 3 个视频请求。

验证一个新服务商或者本地工作流时，先从静态图和单个关键帧开始。等基本链路稳定了，再去加帧数、片段时长和自动生成的频率。

## 从旧分镜系统沿用下来的游戏

分镜现在是一个可下载的智能体，但已有的 Game 聊天里可能还留着旧版 Engine 内置分镜界面写下的显式设置。装上这个包之后，Marinara 会把这些值保留成按聊天的覆盖设置，不会丢掉一套本来能用的 Game 配置。

也就是说，老游戏的表现可能和现在的智能体默认值不一样。想让某一项重新继承 Storyboard 智能体的默认值，就打开 **Chat Settings > Agents > Storyboards**，点那一项的重置控件。

这些旧设置只是迁移数据，不是第二套分镜实现。现在要出图，仍然要求 Storyboard 包已经安装，并且在这局游戏里处于启用状态。

## 故障排查

### Chat Settings 里找不到 Storyboard

- 在 **Agents > Download Agents** 里安装 **Storyboard**。
- 用 Roleplay 或 Game 聊天，Conversation 不支持分镜。
- 确认这个包的版本和已装的 Engine 版本兼容。

### Create storyboard 能点，但生成失败

- 在这个聊天里开启 **Enable Agents** 和 **Enable Storyboards**。
- 在 Roleplay 的 Storyboard 卡片、Game 设置或全局的 Storyboard 设置里，选一个可用的图像生成连接。
- 等 Assistant 或 GM 的回复生成完，再试一次。

### Roleplay 没有生成自动剧集

- 选 **Still images** 或 **Animations**，不要停在 **Manual only**。
- 等一条新的 Assistant 回复生成完。打开聊天不会回补旧消息。
- 检查 **Messages per episode**。从上一次成功的节奏锚点算起，要积累足够多的新用户消息和 Assistant 消息。
- 失败的那一次不会推进锚点，所以去服务器日志里查最初的服务商报错或解析报错。

### 图像出来了，视频没出来

- Roleplay 里选 **Animations**；Game Mode 里开启 **Automatic Storyboard Animations**。
- 选一个 Video Generation 连接。
- 确认这个视频连接支持图生视频输入。
- 看看 Gallery 的 **Videos** 选项卡。片段可能比它的关键帧图像晚一步完成。
- 如果 LLM 出错后规划走了回退流程，Marinara 会保留回退生成的图像，同时跳过这一次的视频。

### 分镜只出了一半或者卡住了

多半是一个或多个服务商任务失败、超时，或者撞上了速率限制、内容限制。服务商本身正常、只是慢的话，就在 `.env` 里调高 `IMAGE_GEN_TIMEOUT_MS` 或 `VIDEO_GEN_TIMEOUT_MS`，然后重启 Marinara，因为这两个值只在启动时读取。

开启 Debug 模式，在服务器日志里搜 `storyboard`，就能看到规划器、编译出的图像提示词、参考图选择和视频提示词。调试日志里可能含有私密的聊天内容和提示词，分享之前先清理一下。

## 相关指南

- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [可下载智能体参考](../agents/built-in-agents.md)
- [Game Mode：入门](getting-started.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [图像生成服务商与设置](../media/image-providers.md)
- [场景视频生成](../media/scene-video.md)
- [Game Mode 中的 LTX 2.3 分镜](ltx-2-3-storyboards.md)
