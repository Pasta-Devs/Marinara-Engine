# Game Mode 中的 LTX 2.3 分镜

本指南介绍如何把本地的 LTX 2.3 ComfyUI 图生视频工作流接到 Game Mode(游戏模式) 的分镜上，让每一帧分镜都变成一段短视频片段。这是一套进阶配置，面向有本地 GPU 和 ComfyUI 的玩家。有些玩家把它叫作 Story Mode。在 Marinara 里，相关控件的名称是 **Game Mode** 和 **Storyboards**(分镜)。

这套配置是配合 **Krea 2** 生成的首帧图像和 **Z-Image Turbo Narrative** 这个 Image Style(图像风格) 调出来的。只要图像账号能接受描述性的自然语言场景提示词，别的图像账号应该也能用。LTX 视频在本地的 ComfyUI 里渲染。首帧图像是在本地生成还是走托管服务，取决于你选的图像账号。

完整链路分这几步：

1. 游戏主持人（GM）写出一个叙述回合。
2. Animation Planner(动画规划器) 返回一个 `imagePrompt` 和一个 `narrationBeat`。
3. `imagePrompt` 发给图像账号，生成首帧插图。
4. `narrationBeat` 经过 **Narration Passthrough**，成为 `%prompt%`。
5. 首帧和提示词一起发给 ComfyUI 的 LTX 2.3 工作流，由它生成一段 MP4 片段。

生成的插图就是片段的第一帧。这样 LTX 既拿到了画面的起点，也拿到了一段描述接下来怎么动的提示词。如果一切顺利，片段会出现在 Gallery(图库) 的 **Videos**(视频) 选项卡里。

## 开始之前

需要准备：

1. 一套能正常工作、并且 Marinara 访问得到的本地 ComfyUI。见 [ComfyUI 工作流设置](../media/comfyui.md)。
2. 一块显存够用的 GPU(显存就是显卡上的内存)。8 GB 显存的显卡可以做第一次测试，用 480p 和 1 个关键帧。
3. 可编辑的 `ltx-director-simple` 工作流（或者任何一张能在 ComfyUI 里完整跑通的等价 LTX 2.3 图生视频流程图），以及它的 API 格式导出文件 `ltx-director-simple-api`。
4. Marinara 里一个用来生成首帧插图的图像账号。
5. **Storyboard** 智能体：从 **Agents → Agent Organizer**(智能体 → 智能体管理器) 下载，并在 **Chat Settings → Agents**(聊天设置 → 智能体) 里为这局游戏开启。见 [Storyboard 智能体指南](storyboard.md)。

可编辑的工作流和它的 API 导出是两个不同的文件。先在 ComfyUI 里打开 `ltx-director-simple`，把 ComfyUI Manager 报告缺失的自定义节点全部装上，并在 ComfyUI 里测通这张流程图。然后把 `ltx-director-simple-api` 导入 Marinara。之后每改一次节点或模型，都要重新按 API 格式导出流程图，并替换 Marinara 账号里保存的 JSON。不要把普通的可视化编辑器工作流粘贴进 Marinara。

## 准备 ComfyUI 的 API 工作流

先在 ComfyUI 里用一张真实的源图和一段简单的提示词，把可编辑工作流排队跑一次。确认它能存出带音频的 MP4。

Marinara 的简化路径只往 LTX Director 的全局提示词输入里放一段完整的提示词：

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

LTX Director 节点照样可以处理图像条件、引导数据、音频和两个采样阶段。“简化”指的是 Marinara 发过去的是一段连贯的图生视频文字，而不是一条 Prompt Relay 时间线。

### 占位符

在 API 导出里，把对应的值替换成下面这些带引号的 Marinara 占位符：

| 占位符 | Marinara 传入的值 |
| --- | --- |
| `%prompt%` | 由 Animation Planner 和视频模板产出的完整提示词 |
| `%reference_image_name%` | 上传到 ComfyUI 的首帧图像 |
| `%duration_seconds%` | 片段时长，单位为秒 |
| `%length%` | 以帧数表示的时长，按 Marinara 默认的 16 FPS 计算 |
| `%fps%` | Marinara 使用的帧率 |
| `%width%`、`%height%` | 根据视频账号的分辨率和画面比例得出的尺寸 |
| `%seed%` | 每次请求新生成的随机种子 |
| `%model%` | 工作流没有写死加载器模型时，从账号取的可选模型值 |

Marinara 还可以填 `%length_s%`、`%global_prompt%`、`%local_prompts%` 和 `%segment_lengths%`。这四个都是可选的。简化路径用不到它们，提示词走的是 `%prompt%`。

参考图要放在 LTX Director 的 `timeline_data` 里的 `segments` 数组内；在 API 工作流中，`timeline_data` 是一段序列化的 JSON 字符串。`%length%` 通过 `normalDurationFrames` 让片段长度保持动态。第 0 帧的参考图片段则保留它自己固定的 `"length":16`。

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- 不要把 `%reference_image_name%` 放在 `timeline_data` 旁边，也不要放进单独的顶层图像字段。
- `%reference_image_name%` 这类字符串占位符要保留引号。
- 数值类的节点输入可以给 `%length%`、`%duration_seconds%` 和 `%fps%` 加引号，因为 Marinara 会把它们转成数字。但在序列化的 `timeline_data` 字符串内部，`%length%` 要像上面那样不加引号，解码出来的值才是数字。
- 帧数、秒数和帧率都要接到这些占位符上。可编辑 ComfyUI 流程图里显示的数值不是 Marinara 的默认值。

### 每次改动后都要重新导出

1. 在 ComfyUI 里把可编辑工作流排队跑一次，确认它能出可播放的 MP4。
2. 根据你的 ComfyUI 版本，选择 **Save (API Format)**、**Export (API)** 或 **Export to API**。
3. 在新的 API JSON 里补上或核对占位符。
4. 替换 Marinara 账号里保存的工作流。

删掉一个节点却继续用旧的导出，里面就会留着指向已不存在节点的引用。ComfyUI 随后会拒绝这个请求。

## 创建视频账号

1. 打开 **Settings → Connections**(设置 → 连接)。
2. 点击 **Add account**(添加账号)，选择 **Video Generation**(视频生成) 账号。
3. 选择 **ComfyUI**。
4. 填入 **Base URL**(基础 URL)。ComfyUI 跑在同一台电脑上时，通常是 `http://127.0.0.1:8188`。
5. 把完整的 API 格式工作流粘贴到 **ComfyUI workflow**(ComfyUI 工作流) 里。
6. 第一次做低显存测试时，默认时长选 6 秒，比例选 **16:9**，分辨率选 480p。
7. 保存账号。

纯文本的连接测试验证不了 `%reference_image_name%`。保存之后，用 Gallery 里的一张图或者一次分镜来测试图生视频。

## 配置 Game Mode 聊天

打开 Game Mode 聊天，然后打开 **Chat Settings → Agents**。先开启 **Enable Agents**(启用智能体) 和 **Enable Storyboards**(启用分镜)。设置向导里的 Storyboard Optimized 呈现方式不会开启这个智能体。

### Illustrator

| 设置项 | 建议值 |
| --- | --- |
| **Game Illustrator** | On |
| **Image model** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | 在这套已验证的工作流里设为 Off |

Animation Planner 已经拿到了本回合的角色外观上下文，所以 **Attach Card Appearance** 保持关闭，免得同样的信息加两遍。**Storyboard First Frame** 同样不会在规划器写好的首帧场景外面再重复战役的美术方向。

**Send Avatar References** 控制的是发给首帧图像服务的参考图，管不到 LTX 的首帧输入：LTX 拿到的成品插图是通过 `%reference_image_name%` 传过去的。先确认你的图像账号支持头像参考、而且用了确实有帮助，再把它开启。

首帧对动画质量影响很大。它应该正好停在计划中的动作发生之前的那一瞬间，主体、路线、手、门、道具或目标都要清晰可见。

### Scene Videos

| 设置项 | 建议值 |
| --- | --- |
| **Video model** | 你创建的那个 LTX 2.3 ComfyUI 账号 |
| **Game Video Prompt** | **Narration Passthrough** |

**Game Video Prompt** 管的是 Gallery 和 Game Assets 里手动触发的动画。分镜片段可以用自己的提示词，不会改动这些。

### Storyboards

| 设置项 | 建议起始值 |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 平时用 3。第一次做 8 GB 显存测试时先用 1。 |
| **Animation Clip Duration** | 5 秒 |
| **Viewer Display** | 测试期间用 Floating |
| **Illustration Planner** | **Still Keyframes**，作为不出视频的回合的兜底 |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

- **LTX Simple Image-to-Video** 是推荐的规划器。它会规划一张适合做动画的首帧，外加一段 4 到 8 句的直白运动提示词：一个主要动作、一种镜头行为、围绕它的克制运动，以及相关的音频或简短对白。
- **LTX Director Storyboard** 是进阶选项，指导更细，会考虑时长，还带连贯性规则。等简化路径跑稳之后再试，或者在较长的片段需要更多衔接阶段时再用。两者用的是同一套 `%prompt%` 约定。
- 开启动画时，**LTX Simple Image-to-Video** 会同时写出两份内容：给 Krea 的 `imagePrompt` 和给 LTX 的 `narrationBeat`。**Still Keyframes** 只用于不出视频的回合。
- **Storyboard First Frame** 会把规划器写好的完整自然语言首帧场景原样交给 Krea，不加关键帧标题、提示词标签、重复的外观说明或战役美术方向。**Use Storyboard Template** 要保持开启，它才会生效。
- **Narration Passthrough** 把规划器写好的 `narrationBeat` 按视频提示词约定传下去，不再额外套一层场景复述。

每个关键帧会产生一个 Krea 图像任务和一个本地 LTX 视频任务，所以 3 个关键帧会启动 3 次图像渲染和 3 次视频渲染。

## 跑第一次测试

挑一个已经完成的 GM 回合，里面要有一个明显的视觉动作，比如推开一扇门、朝声音的方向看过去，或者说一句短台词。

1. 想最快做完低显存检查，就把 **Keyframes per Turn** 设成 1，**Animation Clip Duration** 保持 5 秒。
2. 等 GM 回合完成之后，再把两个自动分镜设置都打开。
3. 打开 **Chat Settings → Gallery**(聊天设置 → 图库)，选择 **Create storyboard**(创建分镜)。这会启动完整的插图加动画流程，不用等下一个回合。
4. 如果开了提示词审查，提交之前先检查一下首帧提示词。
5. 确认首帧是一个在物理上可用的起始姿势。
6. 等首帧渲染完，再等 ComfyUI 的片段。
7. 手动流程跑通之后，把 **Keyframes per Turn** 调回 3，两个自动设置都保持开启。

配置阶段用 **Floating**(浮动) 查看器，方便逐张检查图像和片段。之后如果想让分镜媒体显示在 Game 场景里，再切到 **Background**(背景)。

如果没有成功，见[故障排查](#troubleshooting)。

## 提示词是怎么交接的

对每个关键帧，Animation Planner 会返回 `imagePrompt`(只写 T=0 时刻可见的首帧) 和 `narrationBeat`(完整的 LTX 提示词，描述接下来发生什么)。**Storyboard First Frame** 负责排版 `imagePrompt`，并把它发给 Krea 2。图像生成之后，**Narration Passthrough** 解析为 `narrationBeat`。Marinara 把它放进视频请求的 `prompt` 字段，替换 ComfyUI 工作流里的 `%prompt%`，上传首帧，再把 `%reference_image_name%` 换成首帧在 ComfyUI 里的文件名。不需要两段局部提示词。单个全局提示词就是常规做法。

## 写一段好的 LTX 提示词

源图已经交代了外观、构图、场景、光线和风格。视频提示词应该集中写运动：

- 一段连贯的现在时文字；
- 一个与片段时长相称的聚焦动作；
- 相对主体来描述的镜头运动；
- 通过视线、表情、姿态、呼吸或手势体现的可见反应；
- 至多一个有用的环境运动；
- 相关时写上环境音、音效、音乐或简短的引号对白；
- 一个自然的结尾、一个稳定下来的动作，或者短暂的定格。

要避开场景切换、剪辑、瞬移、多个互不相关的动作、复杂物理、拥挤的调度、精确可读的文字，以及重复首帧里已经看得见的细节。

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

<a id="troubleshooting"></a>

## 故障排查

### ComfyUI 返回 HTTP 400 或“Prompt outputs failed validation”

API 工作流和已安装的流程图对不上。检查是不是删了某个节点、留了悬空的节点 ID、缺了自定义节点、某个输入在节点更新后改了名，或者模型文件名已经不存在。从能跑通的流程图重新导出一份 API 工作流。

### 图像生成了，视频没有

检查 **Automatic Storyboard Animations** 和 Game Mode 的 **Video model**。动画既需要首帧插图，也需要选好的视频账号，缺一不可。

### LTX 收不到起始图像

确认保存的 API 工作流里有 `%reference_image_name%`，并且它接到了 LTX Director 的图像片段上。只有这个占位符存在时，Marinara 才会上传首帧。

### 片段画面变形、角色换人或者一片混乱

回到 **LTX Simple Image-to-Video**，用 1 个关键帧，拿只有一个动作的回合来测。一张图没法在一段短片里干净地变出好几个地点、姿势和结果。首帧也要检查：起始姿势含糊，动画就更难做。

### 每次生成看起来都太像

把写死的采样种子换成 `%seed%`。跑出一个有用的结果之后，可以临时在工作流里固定这个种子，但只限于对比提示词或采样改动的时候。

### 生成时显存不够

先从 480p 开始。还不够再缩短时长。测试期间每回合保持 1 个关键帧，关掉其他占用 GPU 的程序，也不要在同一块低显存 GPU 上挂着本地语言模型。量化过的检查点能降低模型本身占用的显存，但降不了视频潜变量、文本编码器、VAE、音频和放大占用的那部分。

### Marinara 不再等待，ComfyUI 却还在渲染

关闭浏览器请求或者连接中断，会让 Marinara 停止轮询，但不会取消 ComfyUI 里已经排上队的任务。重新开始同一个渲染之前，先看看 ComfyUI 的队列、历史记录和输出文件夹。

### 工作流在 ComfyUI 里能跑，从 Marinara 发起就失败

把账号里保存的 JSON 和你最新的 API 导出对比一下。核对基础 URL、占位符拼写、自定义节点、模型路径、输出节点、尺寸和时长字段。可编辑流程图能跑，Marinara 手里存的却可能还是一份更旧的导出快照。

想看服务器端的追踪，就开启 debug 日志，找 `[debug/game/storyboard-video]` 和 `[video-gen/comfyui]`。一次正常的请求会显示填好的全局提示词、上传的参考图文件名、时长、帧数，以及排队的 ComfyUI prompt ID。

## 参考：LTX 2.3 模型

按你的 GPU 系列，以及 ComfyUI 加载完文本编码器、VAE 和放大模型之后剩下的显存，来选模型格式。下面这些只是起点，不是保证。

| GPU 系列 | 实用起点 | 说明 |
| --- | --- | --- |
| RTX 30 系列（Ampere） | INT8 ConvRot | 3070、3080、3090 这一档显卡的低显存起点。 |
| 显存 16 到 24 GB 的 RTX 40 系列 | FP8 input-scaled | 使用 Ada 硬件上的 FP8 加速路径。 |
| 显存 8 到 12 GB 的 RTX 40 系列 | FP8 卸载太慢时改用 INT8 ConvRot | 在你的工作流上把两种都比较一下。 |
| RTX 50 系列（Blackwell） | NVFP4 dev 工作流 | 需要支持 NVFP4 的 ComfyUI、CUDA 和节点环境。 |
| 沿用现有 distilled 工作流的 RTX 50 | FP8 input-scaled | 在官方 distilled NVFP4 检查点出来之前，先用这个。 |

已验证的 RTX 3080 工作流用的是 `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`。这些后缀代表不同的量化格式和执行路径，不是总能随意互换的画质档位。**Dev** 和 **distilled** 两类工作流的采样假设不一样，所以不改工作流，就不要把 dev 检查点放进 distilled 流程图里。检查点装得下，不代表更长或分辨率更高的视频也装得下。

官方入门工作流用的是 `ltx-2.3-22b-dev-fp8.safetensors`、`ltx-2.3-22b-distilled-lora-384.safetensors`、`gemma_3_12B_it_fp4_mixed.safetensors` 和 `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`。自定义工作流可以用别的检查点、量化版本、加载节点或文件夹。API 工作流里保存的文件名，必须和 ComfyUI 能看到的文件完全一致。如果你把模型放在别的文件夹里（比如 `LTX2/`），就要改掉加载器里的值，并重新导出一份 API 文件。

分享工作流时，记下你的 GPU 型号和显存，ComfyUI 版本，NVIDIA 驱动、CUDA、PyTorch 和 Python 的版本，自定义节点及其版本，模型文件名和所在文件夹，分辨率、时长、关键帧数量和渲染时间，以及 Krea 2 是在本地跑的还是走托管服务。

官方资料：

- [LTX 2.3 图生视频指南](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX 提示词指南](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3 模型卡](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4 模型卡](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [LTX 2.3 官方 ComfyUI 示例](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [社区拆分版 ComfyUI 与 FP8 权重](https://huggingface.co/Kijai/LTX2.3_comfy)

## 相关指南

- [Storyboard 智能体指南](storyboard.md)
- [ComfyUI 工作流设置](../media/comfyui.md)
- [场景视频生成](../media/scene-video.md)
- [Game Mode：入门](getting-started.md)
