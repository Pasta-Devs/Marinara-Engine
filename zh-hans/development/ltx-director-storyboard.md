# LTX 分镜图生视频

状态：简化方案的后续改动，正在本地评审中。

## 问题

Marinara 最早的 LTX Director Storyboard 集成方案，会把每个规划好的镜头拆成一段固定的全局提示词，外加多段用竖线分隔的局部提示词。分镜路由随后会识别内置模板的 ID，绕开常规的视频提示词约定，自行拼装一份 LTX 专用的载荷。

这个设计让提示词自定义变得难以预料：复制或修改内置模板会改变它的 ID，特殊交接逻辑就此静默失效。它还会诱导规划器在一段很短的片段里塞进过多动作。规划一旦失败，通用的兜底分镜可能把一大段原始叙述直接送去生成视频，于是运行日志里就出现了那些负担过重的提示词。

本地已经跑通的 ComfyUI 工作流并不需要这一层时序提示词。LTX 2.3 只用一条直接的图生视频提示词，就能让传入的首帧动起来。

## 产品决策

为了兼容已保存的聊天，保留现有的可选模板 ID 和设置项，但把它们的约定简化：

- **LTX Director Storyboard** 为每个镜头规划首帧，并给出一条完整的 LTX 2.3 图生视频提示词。
- **Storyboard First Frame** 负责格式化用作参考图的那张精确的 T=0 插图。
- **Narration Passthrough** 的内容只有 `${narrationSummary}`，因此规划器写好的提示词会走通用视频模板路径，和其他所有工作流完全一致。

分镜路由不得检查这些模板 ID，不得自行制造局部片段，也不得附加 LTX 专用的提示词载荷。选中的视频模板依然可以完全自定义。

## 规划器约定

分镜的 JSON 结构保持不变：

- `imagePrompt` 只描述 T=0 时刻的那一帧画面。
- `narrationBeat` 是连同该图一起发给视频模型的完整提示词。
- 章节锚点和 `characters` 的含义不变。

每条 `narrationBeat` 都要遵循官方的 [LTX 图生视频指南](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)和[提示词编写指南](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)：

- 写成一段连贯的现在时文字，1 到 6 秒大约 2 到 4 个短句，7 到 10 秒 3 到 5 句，11 到 15 秒 4 到 8 句，且只在动作确实撑得起这些细节时才写这么多；
- 从 `imagePrompt` 呈现的状态起笔，往下描述接着发生了什么；
- 1 到 6 秒只用一个主要动作和一种运镜，7 到 10 秒最多两个相连的阶段和两种运镜，11 到 15 秒最多三个；
- 每一种镜头行为都相对于主体来描述，只有时长足够把转换交代清楚时才变换角度；
- 反应通过看得见的表情、视线、姿态、呼吸或手势来传达；
- 环境动态要克制，可以带上相关音效或简短的引语对白；
- 结尾让动作完成、平息或定住；
- 静态外观、构图、场景、光线、色调、质感和风格都交给源图去决定；
- 不要出现场景切换、新登场主体、堆砌的动作、复杂物理效果、可读文字、UI、凭空捏造的事件，也不要出现任何在该时长内交代不清的剪辑或镜头变化。

从简单写起。四句话如果已经把镜头交代完整，那就够了；规划器不能为了增加动感，硬给一个简单动作注水。

示例：

```text
She opens the door and walks outside as the camera follows behind her. A light breeze moves her hair. She glances toward the street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## 数据流

1. 规划器为每个镜头返回一条 T=0 的 `imagePrompt` 和一条完整的 `narrationBeat`。
2. 分镜图像生成负责产出首帧参考插图。
3. Narration Passthrough 模板把 `${narrationSummary}` 解析为该镜头的 `narrationBeat`。
4. 常规的视频生成请求用它现有的 `prompt` 字段携带这个结果。
5. ComfyUI 适配器替换已保存工作流里的 `%prompt%`，并提供现成的参考图、尺寸、时长、帧数、种子和模型值。

整条流程里没有 LTX 专用的分镜路由分支。

## ComfyUI 约定

使用那套已验证可用的 LTX 2.3 图生视频工作流，配合 Marinara 的常规占位符。它的 Director 输入应当是：

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

工作流原本在哪里期待 `%reference_image_name%`、`%duration_seconds%`、`%length%`、`%width%`、`%height%`、`%seed%` 和 `%model%`，就把它们保留在哪里。按 Marinara 现有的 16 FPS 约定，一个六秒的请求仍然是 96 帧。

用 `%global_prompt%`、`%local_prompts%` 和 `%segment_lengths%` 写成的旧工作流依然兼容：适配器会把普通请求的提示词映射到全局值，局部提示词和片段长度留空。这些占位符只是兼容手段，不是推荐的分镜配置。

## 失败时的行为

- 客户端断开连接或规划器中止时，把取消状态传递下去，不要继续生成兜底媒体。
- 规划器确实失败时，现有的兜底规划器可以保留静态图像的行为，但要跳过这次请求的视频生成。原始叙述不是安全的图生视频提示词。
- 客户端提供且已审核过的分镜仍然可以生成视频，因为它的提示词在上游就已经审核过了。

## 范围

这次改动不会对生成出的参考图再加一次视觉模型的处理。规划器已经同时指导了首帧和它紧接着的动作，而图像本身会在生成时对 LTX 起到约束作用。如果首帧漂移的问题确实明显，可以另行评估一种能读图重写的方案。

不需要改动客户端界面、本地化、存储结构、迁移、版本、服务重启，也不涉及 Marinara-Agents。

## 验收标准

- LTX 分镜规划器请求的是一条完整的、考虑了时长的图生视频提示词，其中有清晰可读的动作阶段、相对主体的运镜方向，以及可选的音效或对白。
- Narration Passthrough 模板的内容正好是 `${narrationSummary}`。
- 分镜路由里没有精确模板 ID 的绕行逻辑、局部提示词清洗器，也没有 LTX 专用的交接。
- 带 `global_prompt: "%prompt%"` 的工作流能收到规划器写出的完整提示词；`local_prompts` 和 `segment_lengths` 保持为空。
- 现有的 `%global_prompt%` 工作流仍能收到普通请求提示词，作为兼容兜底。
- 规划器被取消时整个操作停止，真正走到兜底规划时跳过视频生成。
- 最终补丁要经过 `pnpm regression:prompt`、`pnpm check` 和 `git diff --check` 的检查。
