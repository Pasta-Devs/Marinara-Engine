# Game Mode 中的 LTX 2.3 分镜

本指南介绍如何把本地的 LTX 2.3 ComfyUI 图生视频工作流接到 Marinara Engine 的 Game Mode(游戏模式) 分镜上。有些玩家把它叫作 Story Mode，Marinara 界面上的控件名则是 **Game Mode** 和 **Storyboards**(分镜)。

下面这套配置是配合 **Krea 2** 首帧生成和 **Z-Image Turbo Narrative** 这个自然语言 Image Style(图像风格) 调出来的。只要图像连接能接受描述性的自然语言场景提示词，别的连接应该也可以用。LTX 视频渲染跑在本地 ComfyUI 里；首帧生成是本地跑还是走云端，取决于选中的图像连接。

完整链路是这样的：

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> Narration Passthrough -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

生成出来的插图就是这段视频的第一帧。这样 LTX 既拿到了画面起点，也拿到了一段专门描述“接下来怎么动”的提示词。

## 开始之前

需要准备：

1. 一套能正常工作、且 Marinara 访问得到的本地 ComfyUI。
2. 可编辑的 `ltx-director-simple` 工作流，或者任何一张能在 ComfyUI 里完整跑通的等价 LTX 2.3 图生视频流程图。
3. 它的 API 格式导出文件 `ltx-director-simple-api`，用于 Marinara 连接。
4. 一个用来出首帧插图的 Marinara 图像生成连接。
5. **Storyboard** 智能体，从 **Agents > Download Agents** 安装，并在 **Chat Settings > Agents** 里为这局游戏启用。

可编辑的 ComfyUI 工作流和它的 API 导出是两个不同的文件。先在 ComfyUI 里打开 `ltx-director-simple`，把 ComfyUI Manager 报出来的缺失自定义节点全部装上，并在 ComfyUI 里测通这张图。然后把 `ltx-director-simple-api` 导入 Marinara 连接。之后每改一次节点或模型，都要重新按 API 格式导出，并替换连接里保存的 JSON。不要把普通的可视化编辑器工作流粘贴进 Marinara。

导出和连接的通用流程见 [ComfyUI 工作流设置](../media/comfyui.md)。

## 挑一个 LTX 2.3 模型

按 GPU 架构挑模型格式，也要看 ComfyUI 加载完文本编码器、VAE 和放大模型之后还剩多少显存。下面这些只是起点，不保证每套工作流都塞得进每张卡。

| GPU 系列 | 实用起点 | 说明 |
| --- | --- | --- |
| RTX 30 系列（Ampere） | INT8 ConvRot | 3070、3080、3090 这一档显卡的低显存起点。 |
| 显存 16 到 24 GB 的 RTX 40 系列 | FP8 input-scaled | 用上 Ada 架构硬件才有的 FP8 加速路径。 |
| 显存 8 到 12 GB 的 RTX 40 系列 | FP8 卸载太慢时改用 INT8 ConvRot | 拿实际工作流把两种都试一遍；可用显存和卸载行为同样有影响。 |
| RTX 50 系列（Blackwell） | NVFP4 dev 工作流 | 需要支持 NVFP4 的 ComfyUI、CUDA 和节点环境。 |
| 沿用现有 distilled 工作流的 RTX 50 | FP8 input-scaled | 在官方 distilled NVFP4 检查点出来之前，先走这条兼容路径。 |

已验证的 RTX 3080 工作流用的是：

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

这些后缀说明的是不同的量化格式和执行路径，不是可以随便互换的画质档位：

- **INT8 ConvRot** 是 RTX 30 系列和显存较小的 Ada 显卡在社区里通行的低显存路径。
- **FP8 input-scaled** 会用上大致 RTX 40 系列及更新的 NVIDIA 硬件上的 FP8 加速矩阵运算。
- **NVFP4** 是 Blackwell 原生的四比特路径，RTX 50 系列工作流用的就是它。
- **Dev** 和 **distilled** 两类工作流的采样假设不一样。不要在没有相应改动工作流的前提下，把 dev 检查点直接塞进随附的 distilled 流程图里。

8 GB 显存的显卡第一次联调，应该从 480p 和 1 个关键帧起步。检查点装得下，不代表更长或分辨率更高的视频也装得下，因为视频潜变量、文本编码器、VAE、音频和放大同样吃显存。

官方入门工作流用到这些组件：

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

自定义工作流可能用 distilled v1.1 检查点、第三方量化版本、不同的加载节点，或者不同的模型文件夹。API 工作流里保存的文件名，必须和 ComfyUI 能看到的文件完全一致。

官方资料：

- [LTX 2.3 图生视频指南](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX 提示词指南](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3 模型卡](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4 模型卡](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [LTX 2.3 官方 ComfyUI 示例](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [社区拆分版 ComfyUI 与 FP8 权重](https://huggingface.co/Kijai/LTX2.3_comfy)

## 准备 ComfyUI 的 API 工作流

先在 ComfyUI 里用一张真实源图和一段简单提示词，把可编辑工作流直接排队跑一次。确认它能存出带音频的 MP4，再动手把 API 导出改成 Marinara 能用的样子。

Marinara 这条简化路径只往 LTX Director 的全局提示词输入里放一段完整提示词：

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

LTX Director 节点照样可以处理图像条件、引导数据、音频和两个采样阶段。这里说的“简化”指的是提示词约定：Marinara 发过去的是一段连贯的图生视频文字，而不是一条 Prompt Relay 时间线。

### 必需的占位符

把 API 导出里对应的值替换成带引号的 Marinara 占位符：

| 占位符 | 传入的值 |
| --- | --- |
| `%prompt%` | 由选中的分镜 Animation Planner 和视频模板产出的完整提示词 |
| `%reference_image_name%` | 上传到 ComfyUI 的首帧图像 |
| `%duration_seconds%` | 分镜片段的时长，单位为秒 |
| `%length%` | 按 Marinara 的 16 FPS 帧约定换算出来的时长 |
| `%fps%` | Marinara 给这段片段用的帧率 |
| `%width%`、`%height%` | 根据视频连接的分辨率和画面比例选定的尺寸 |
| `%seed%` | 本次请求新生成的随机种子 |
| `%model%` | 工作流没有把加载器模型写死时，从连接取的可选模型值 |

参考图要放在 LTX Director 的 `timeline_data` 里的 `segments` 数组内。在 API 工作流中，`timeline_data` 是一段序列化的 JSON 字符串。`%length%` 通过 `normalDurationFrames` 让片段长度保持动态；第 0 帧那个参考图片段则是有意保留自己固定的短值 `"length":16`：

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

不要把 `%reference_image_name%` 放在 `timeline_data` 旁边，也不要放进单独的顶层图像字段。帧数、秒数和帧率要用 `%length%`、`%duration_seconds%`、`%fps%` 跟工作流的外部输入连起来；可编辑 ComfyUI 流程图里显示的那些数值不是 Marinara 的默认值。

`%reference_image_name%` 这类字符串占位符要保留引号。对输入类型严格的数值节点，可以给 `%length%`、`%duration_seconds%`、`%fps%` 加引号，因为 Marinara 会把它们转成数字。但在序列化的 `timeline_data` 字符串内部，`%length%` 要像上面那样不加引号，解码出来的时间线数值才是数字。

### 每次改动后都要重新导出

1. 在 ComfyUI 里把可编辑工作流排队跑一次。
2. 确认当前这张图能出可播放的 MP4。
3. 选择 **Save (API Format)**、**Export (API)** 或 **Export to API**。
4. 在新的 API JSON 里补上或核对占位符。
5. 替换 Marinara 连接里保存的工作流。

删掉一个节点却继续用旧的 API 导出，里面就可能还留着指向已不存在节点的引用。ComfyUI 会在生成开始之前直接拒掉这个请求。

## 创建 Marinara 视频连接

1. 打开 **Settings**(设置)，再进入 **Connections**(连接)。
2. 添加一个 **Video Generation**(视频生成) 连接。
3. 选择 **ComfyUI**。
4. 填入 ComfyUI 的基础 URL，跑在同一台电脑上时通常是 `http://127.0.0.1:8188`。
5. 把完整的 API 格式工作流粘贴到 **ComfyUI Workflow**(ComfyUI 工作流) 里。
6. 第一次低显存测试时，默认时长选 6 秒，比例选 **16:9**，分辨率选 480p。
7. 保存连接。

纯文本的连接测试验证不了 `%reference_image_name%`。保存连接之后，用 Gallery(图库) 里的一张图或者一次分镜来验证图生视频。

## 配置 Game Mode 聊天

打开 Game Mode 聊天，然后打开 **Chat Settings**(聊天设置) 并选择 **Agents**(智能体)。配置下面几节之前，先开启 **Enable Agents**(启用智能体) 和 **Enable Storyboards**(启用分镜)。新建游戏向导里的 Storyboard Optimized 呈现方式不会启用这个智能体。

### Illustrator

| 设置项 | 建议值 |
| --- | --- |
| **Game Illustrator** | On |
| **Image Connection** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | 这套已验证的工作流里设为 Off |

Animation Planner 已经拿到了本回合分镜的角色外观上下文，所以这里把 **Attach Card Appearance** 关掉，免得在最终排版图像提示词时又把同样的信息贴一遍。**Storyboard First Frame** 同样不会围着规划器写好的 T=0 场景重复战役的美术方向。

**Send Avatar References** 控制的是发给首帧图像服务商的参考图，管不到 LTX 的首帧输入。LTX 拿到的首帧是通过 `%reference_image_name%` 传过去的成品分镜插图。这套已验证的 Krea 配置先把头像参考关着，等确认所选图像连接确实支持、而且用了确实有好处，再单独开启。

首帧图像对动画质量影响很大。它应该正好停在计划中的动作发生之前那一瞬间，主体、路线、手、门、道具或目标都要清晰可见。

### Scene Videos

| 设置项 | 建议值 |
| --- | --- |
| **Video Connection** | 上面创建的那个 LTX 2.3 ComfyUI 连接 |
| **Game Video Prompt** | **Narration Passthrough** |

通用的 **Game Video Prompt** 管的是 Gallery 和 Game Assets 里手动触发的动画。分镜片段可以单独选自己的提示词，不影响这些动画操作。

### Storyboards

从这套配置起步：

| 设置项 | 建议起始值 |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 平时用 3；第一次做 8 GB 显存测试时先用 1 |
| **Animation Clip Duration** | 5 秒 |
| **Viewer Display** | 测试期间用 Floating |
| **Illustration Planner** | **Still Keyframes**；保留作为纯静态图的兜底 |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

**LTX Simple Image-to-Video** 是推荐的默认选项。它会规划出一张适合做动画的首帧，外加一段 4 到 8 句的直白运动提示词。它偏向一个主要动作、一种镜头行为、克制的环境运动，以及相关的音频或简短对白。

**LTX Director Storyboard** 仍然作为进阶选项保留。它给出的指导更细，会考虑时长，还带连贯性规则。等简化路径跑稳之后再试，或者在片段确实较长、真的需要多个衔接阶段时再用。两个规划器用的是同一套 `%prompt%` 工作流约定。

**Illustration Planner: Still Keyframes** 在动画开启时不会生成给 Krea 用的提示词。动画模式下由 **LTX Simple Image-to-Video** 同时产出两份内容：给 Krea 的自然语言 `imagePrompt`，以及给 LTX 的 `narrationBeat`。Still Keyframes 之所以还选着，只是为了那些不出视频的回合。

**Storyboard First Frame** 会把 Animation Planner 写好的完整自然语言 T=0 场景原样交给 Krea，不再添加关键帧标题、提示词标签、重复的外观说明或战役美术方向。**Use Storyboard Template** 要保持开启，这个格式化器才会真正生效。

**Narration Passthrough** 有意做得很轻。它只是把 Animation Planner 完成的 `narrationBeat` 按通用视频提示词约定传下去，不在外面再套一层场景复述。

每个关键帧会产生一个 Krea 图像任务和一个本地 LTX 视频任务。所以 3 个关键帧就是 3 次首帧渲染加 3 次视频渲染。8 GB 显存的显卡先用 1 个关键帧、480p 起步。跑通之后再往 3 个关键帧和更高分辨率上加。

## 跑第一次测试

挑一个已经生成完的 GM(游戏主持人) 回合，里面要有一个明显的视觉动作，比如推开一扇门、朝声音的方向看过去、走上几步，或者说一句短台词。

1. 想最快做完低显存检查，可以临时把 **Keyframes per Turn** 设成 1，**Animation Clip Duration** 保持 5 秒。常规的已验证配置用 3 个关键帧。
2. 等当前这个 GM 回合彻底完成之后，再把两个分镜自动开关打开。
3. 打开 Gallery，对那个已完成的 GM 回合选择 **Create storyboard**。这样就能手动启动完整的插图加动画流程，不用等下一个回合。
4. 如果开了提示词展示，提交之前先看一眼首帧提示词。
5. 确认生成出来的首帧确实是一个物理上有用的起始姿势。
6. 等首帧渲染完，再等 ComfyUI 的片段渲染完。
7. 手动流程跑通之后，把 **Keyframes per Turn** 调回 3，两个自动开关都留着开，后面的回合就照常走。

配置阶段用 **Floating** 查看模式，逐张检查图像和片段更方便。工作流稳定之后，如果想让分镜媒体融进 Game Mode 场景里，再切到 **Background**。

## 提示词是怎么交接的

对每个关键帧，Animation Planner 会返回：

- `imagePrompt`：只写 T=0 时刻可见的首帧；
- `narrationBeat`：完整的 LTX 图生视频提示词，描述接下来发生什么。

这两个字段都由选中的 Animation Planner 写。**Storyboard First Frame** 负责排版 `imagePrompt`，把这段自然语言的 T=0 场景发给 Krea 2。图像出来之后，**Narration Passthrough** 解析成 `narrationBeat`。Marinara 把它放进常规视频请求的 `prompt` 字段，替换 ComfyUI 工作流里的 `%prompt%`，上传首帧，再把 `%reference_image_name%` 换成它在 ComfyUI 里的文件名。

不需要建两段局部提示词。对这几个分镜预设来说，单个全局提示词就是常规做法。

## 什么样的 LTX 提示词才算好

角色外观、构图、场景、光线、配色和质感，源图里已经交代清楚了。视频提示词应该集中写运动：

- 一段连贯的现在时文字；
- 一个和片段时长相称的聚焦动作；
- 相对主体来描述的镜头运动；
- 通过视线、表情、姿态、呼吸或手势体现出来的可见反应；
- 至多一个有用的环境运动；
- 相关时可以写环境音、音效、音乐或简短的引号对白；
- 结尾要有一个自然的收束、稳定下来的动作，或者短暂的定格。

要避开的是：场景切换、剪辑、瞬移、多个互不相关的动作、复杂物理、拥挤的调度、精确可读的文字，以及把首帧里已经看得见的细节再罗列一遍。

示例：

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## 记录一套可复现的配置

“8 GB 能跑”这个结论，取决于的东西远不止检查点。分享工作流时，记录下这些：

- 确切的 GPU 型号和显存；
- ComfyUI 版本或 commit；
- NVIDIA 驱动、CUDA、PyTorch 和 Python 的版本；
- 需要的自定义节点包及其版本；
- 确切的模型文件名，以及它们所在的 ComfyUI 文件夹；
- 输出分辨率、时长、关键帧数量和大致渲染时间；
- 这套配置里 Krea 2 是本地跑的，还是走托管的图像连接。

随附的 API JSON 保存的是节点 ID、模型路径和输入名称的一份快照。把模型放在别的文件夹（比如 `LTX2/`）下的人，必须改掉加载器里的值，并重新导出一份 API 文件。一套在作者的 ComfyUI 环境里跑得好好的工作流，换个地方仍可能因为自定义节点或模型路径不同而失败。

## 故障排查

### ComfyUI 返回 HTTP 400 或“Prompt outputs failed validation”

API 工作流和当前装好的流程图对不上。检查是不是删了某个节点、留了悬空的节点 ID、缺了自定义节点、节点更新后输入改了名，或者模型文件名已经不存在了。从能跑通的 ComfyUI 流程图重新导出一份 API 工作流。

### 图像生成了，视频没有

检查 **Automatic Storyboard Animations** 和 Game Mode 的 **Video Connection**。要出动画，首帧插图和选中的视频连接缺一不可。

### LTX 收不到起始图像

确认保存的 API 工作流里有 `%reference_image_name%`，并且它接到了 LTX Director 的图像片段上。只有这个占位符在，Marinara 才会上传首帧。

### 片段画面糊变、角色换人或者一片混乱

回到 **LTX Simple Image-to-Video**，用 1 个关键帧，拿只有一个动作的回合来测。一张源图没法在一段短的连续片段里干净地变出好几个地点、姿势和结果。首帧也要查一查：起始姿势本身如果就含糊，就算运动提示词写得好，动画难度也会大得多。

### 每次生成看起来都差不多

把工作流里写死的采样种子换成 `%seed%`。等跑出一个好结果之后，只有在对比提示词或采样改动时，才临时把种子固定住。

### 生成时显存不够

先从 480p 开始。还不够就再缩短时长。测试期间每回合保持 1 个关键帧，关掉其他占用 GPU 的程序，也不要在同一张低显存显卡上挂着本地语言模型。量化过的检查点能省下模型本身的显存，但省不掉视频潜变量、文本编码器、VAE、音频和放大占用的那部分。

### Marinara 不等了，ComfyUI 还在渲染

关掉浏览器请求或者客户端连接断开，会让 Marinara 停止轮询，但不会取消 ComfyUI 里已经排上队的任务。重新跑同一个渲染之前，先看看 ComfyUI 的队列、历史记录和输出文件夹。

### 工作流在 ComfyUI 里能跑，从 Marinara 发就失败

把连接里保存的 JSON 和最新的 API 导出对一遍。核对基础 URL、占位符拼写、需要的自定义节点、模型路径、输出节点、尺寸和时长字段。可编辑流程图能跑归能跑，Marinara 手里存的那份导出快照可能还是旧的。

想看服务器端的详细追踪，可以开启 debug 级别的日志，找 `[debug/game/storyboard-video]` 和 `[video-gen/comfyui]`。一次正常的请求会打印出完成的全局提示词、上传的参考图文件名、时长、帧数，以及排队的 ComfyUI prompt ID。

## 相关指南

- [Storyboard 智能体指南](storyboard.md)
- [ComfyUI 工作流设置](../media/comfyui.md)
- [场景视频生成](../media/scene-video.md)
- [Game Mode：入门](getting-started.md)
