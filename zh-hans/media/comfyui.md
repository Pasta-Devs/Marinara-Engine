# ComfyUI 工作流设置

Marinara Engine 可以把图像生成和视频生成的请求发给本地的 ComfyUI 服务器，也可以把图像请求发给运行着 ComfyUI 的 RunPod Serverless 端点。本地图像连接可以直接用 Marinara 内置的基础工作流，视频连接和进阶的图像配置则要用自定义的 API 格式工作流。

粘贴进 Marinara 的工作流 JSON 只是一份快照，Marinara 不会和 ComfyUI 里打开的工作流保持实时联动。每次在 ComfyUI 里改完工作流，都要重新测试、重新导出，再替换掉保存在 Marinara 连接上的 JSON。

## 开始之前

装好 ComfyUI，把工作流需要的 checkpoint 和自定义节点都加上，然后启动它的服务器。本地地址通常是 `http://127.0.0.1:8188`。

如果 ComfyUI 跑在家庭网络里的另一台电脑上，它的服务器必须监听 Marinara 能访问到的地址。图像连接还需要在 Marinara 的 `.env` 里设置 `IMAGE_LOCAL_URLS_ENABLED=true`，见[服务器配置参考](../CONFIGURATION.md)。连接还是失败的话，检查另一台电脑的防火墙。

本地语言模型和图像模型可能没办法同时装进显存，8 GB 显卡尤其如此。Marinara 的图像队列会避免多个图像任务同时运行，但没法让两个已加载的模型挤进同一块显存。显存不够时，可以改用云端或单独部署的语言模型，把 ComfyUI 挪到另一台设备上跑，或者在使用其中一个模型之前先卸载另一个。

## 创建 Marinara 连接

1. 打开 **Connections**(连接)，新建一个 **Image Generation**(图像生成) 连接。
2. 本地服务器选 **ComfyUI**，RunPod 端点选 **RunPod Serverless (ComfyUI)**。
3. 本地 ComfyUI 填它的 Base URL，不需要 API 密钥。**ComfyUI Workflow**(ComfyUI 工作流) 输入框留空时，Marinara 会使用内置的基础文生图工作流。
4. RunPod 则填 API 密钥和 Endpoint ID，必须提供自定义工作流。
5. 配置 **Local Image Defaults**(本地图像默认值)。这些值会替换掉工作流里对应的占位符。
6. 保存连接，加好工作流之后用 **Test Image**(测试图像) 试一下。

## 构建并导出工作流

1. 在 ComfyUI 里为 Marinara 单独建一个工作流。
2. 像平时一样配置并连接 checkpoint、LoRA、VAE、提示词编码器、潜空间图像或图像输入节点、采样器和输出节点。
3. 在 ComfyUI 里把工作流加入队列，确认它能生成预期的图像。
4. 一定要有输出节点。**SaveImage** 最稳妥，因为 Marinara 是从 ComfyUI 的工作流历史里读取生成好的图像或动画的。
5. 用一个好认的名字保存可编辑的工作流，比如 `Marinara_Workflow`。
6. 以 API 格式导出工作流。ComfyUI 前端版本不同，这个操作可能叫 **Save (API Format)**、**Export (API)** 或 **Export to API**。如果它被隐藏了，去开启 ComfyUI 的开发者模式选项。
7. 用文本编辑器打开导出的 `.json` 文件。

API 格式的工作流和可视化编辑器里的普通工作流不是一回事。它的顶层键是节点 ID，每个节点通常包含 `class_type` 和 `inputs`。要导出的是 API 版本，不要粘贴那个带编辑器可视化布局的普通工作流文件。

<a id="comfyui-video-workflows"></a>

## ComfyUI 视频工作流

新建一个 **Video Generation**(视频生成) 连接，选 **ComfyUI**，把 API 格式的工作流粘进必填的 **ComfyUI Workflow** 输入框。只要同一个工作流能在 ComfyUI 里跑通，并且通过核心的 **SaveVideo** 这类输出节点保存出 MP4，WAN 2.2 和其他本地视频图都可以用。

视频工作流可以用这些带引号的占位符：

| 占位符 | Marinara 提供的值 |
| --- | --- |
| `%prompt%` | 编译好的场景或动画提示词。 |
| `%width%`、`%height%` | 480p 是 `832×480`，720p 是 `1280×720`，9:16 时长宽互换。 |
| `%seed%` | 一个新的随机 32 位种子。 |
| `%length%` | 片段长度，以 16 fps 下的帧数表示。 |
| `%model%` | 连接上设置了 Model 时取该值。 |
| `%reference_image_name%` | 上传的首帧文件名，供 ComfyUI 的 **LoadImage** 节点使用。 |

Marinara 通过 `/prompt` 把工作流排进队列，轮询 `/history`，再下载 `gifs` 或 `images` 输出里指定的 MP4。图生视频的操作会提供 `%reference_image_name%`，纯文本的连接测试不会，所以同一个工作流要同时应付两种情况时，把这个输入设成可选。

本地 WAN 渲染在中端显卡上可能超过 30 分钟。ComfyUI 视频任务用的是 `VIDEO_GEN_TIMEOUT_MS`，不是只管图像的 `COMFYUI_GEN_TIMEOUT`。有效的工作流被提前中断时，调高视频超时时间并重启 Marinara。

## 添加 Marinara 占位符

把希望交给 Marinara 控制的值换成下面这些占位符。

**本地 ComfyUI** 连接的每一个占位符都要留在 JSON 引号里面。Marinara 会先解析工作流，再把 `"%width%"` 这种纯数值占位符转成真正的数字，所以对要求数值输入的节点来说依然有效。

**RunPod Serverless (ComfyUI)** 连接则要区别对待：`"%prompt%"`、`"%model%"`、`"%sampler%"` 这类文本占位符保留引号，`%width%`、`%height%`、`%seed%`、`%steps%`、`%cfg%`、`%denoise%`、`%clip_skip%` 这类数值占位符不要加引号。RunPod 的替换发生在 Marinara 解析工作流之前，填进去的数字才能让提交的 JSON 合法。连接编辑器可能会暂时把这份模板标成非法 JSON，因为不带引号的标记要到生成时才被替换，这个警告不影响保存。

基础的**本地** API 工作流，相关部分大致长这样：

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "portrait, %prompt%, masterpiece"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "watermark, %negative_prompt%"
    }
  }
}
```

这只是一个片段，导出工作流里的节点连线和其他输入都要保留。提示词占位符可以嵌在更长的字符串里，用来在前后拼接固定的标签。数值占位符一般要占满整个值。在工作流的 RunPod 版本里，记得去掉这些数值标记两边的引号。不想让 Marinara 的连接默认值改动某项设置时，也可以把它直接写死。

| 占位符 | Marinara 提供的值 |
| --- | --- |
| `%prompt%` | 正向图像提示词。缺少它时连接编辑器会警告。 |
| `%negative_prompt%` | 负向图像提示词。 |
| `%width%`、`%height%` | 请求的图像尺寸。 |
| `%seed%` | 连接上设置的种子；`-1` 表示每次生成新的随机种子。 |
| `%model%` | 连接上保存的模型。要填加载器节点认的那个 checkpoint 值。 |
| `%steps%` | 采样步数。 |
| `%cfg%` | CFG 系数。也接受 `%cfg_scale%` 和 `%scale%`。 |
| `%sampler%` | 采样器名称。 |
| `%scheduler%` | 调度器名称。 |
| `%denoise%` | 重绘强度。也接受 `%denoising_strength%`。 |
| `%clip_skip%` | 兼容节点使用的 Clip Skip 值。 |

改完保存 JSON，把整个文件复制下来，粘贴到图像连接的 **ComfyUI Workflow** 里，保存连接，然后点击 **Test Image**。

## 使用参考图

发起生成的那个功能有图可以传时，Marinara 最多能提供四张参考图。自定义工作流里必须有兼容的输入节点和占位符；光加一个占位符并不会自动创建或连接这些节点。

### 本地 ComfyUI：给 LoadImage 用的上传文件名

标准的 ComfyUI **LoadImage** 节点用文件名占位符：

```json
{
  "12": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "%reference_image_name%",
      "upload": "image"
    }
  }
}
```

Marinara 会把参考图上传到 ComfyUI 的 input 文件夹，并把占位符替换成 ComfyUI 返回的文件名。`%reference_image_name%` 指第一张图。有多个参考图输入的工作流可以用 `%reference_image_name_01%` 到 `%reference_image_name_04%`。

如果工作流必须有图像输入，就在 **Local Image Defaults** 里开启 **Upload a 1x1 placeholder when no reference image is provided**。这样一来，请求里没有真实参考图时，Marinara 会传一张极小的占位图过去。

### 原始 base64 图像数据

第一张原始 base64 图用 `%reference_image%`，带编号的输入用 `%reference_image_01%` 到 `%reference_image_04%`。这些值是不带 `data:image/...` 前缀的 base64 数据，只能配合直接接受这种格式的自定义节点使用。

RunPod 工作流支持原始 base64 占位符。文件名上传类的占位符只给本地 ComfyUI 用，RunPod 那边的处理程序不支持。

## 为特定角色保留专属工作流

某个角色需要特定的 checkpoint、LoRA 组合、ControlNet 配置或参考图布局时，可以为它单独导出一个工作流，并单独建一个 Marinara 图像连接。凡是那个角色或图像功能允许选连接的地方，选对应的图像连接就行。

这样出来的效果通常比一个通用工作流更稳定，但每个连接保存的都是自己那份复制过来的 JSON。在 ComfyUI 里改过某个角色的工作流之后，导出、编辑、复制、粘贴这几步要对那个连接重做一遍。

## 故障排查

| 问题 | 检查什么 |
| --- | --- |
| Marinara 报告工作流 JSON 非法 | 本地 ComfyUI 要检查加完占位符之后的引号、逗号和括号。RunPod 则只有数值占位符可以不带引号，所有文本占位符和模板的其余部分仍然要符合 JSON 语法。 |
| 提示词或占位符原样传到了节点里 | 确认标记的拼写和表里完全一致，并且粘贴的是刚导出的 API 版本工作流。 |
| 生成的图像不按请求的尺寸来 | 把 `%width%` 和 `%height%` 放进真正接到采样器上的那个潜空间图像节点或同等的尺寸节点。 |
| ComfyUI 找不到模型 | 填加载器认的那个 checkpoint 名称，或者干脆在工作流里写死 checkpoint，不用 `%model%`。 |
| ComfyUI 报告缺少节点或输入 | 把构建工作流时用到的自定义节点包装上，并确认它们的输入名称没有变过。 |
| 任务跑完了，Marinara 却没收到图 | 加一个接好线的 **SaveImage** 输出节点，然后直接在 ComfyUI 里再测一遍工作流。 |
| 参考图节点报错 | 普通的本地 **LoadImage** 节点要用 `%reference_image_name...%` 这类占位符。原始 base64 只能配合专门为它设计的节点使用，另外确认 Marinara 那边的功能确实提供了参考图。 |
| 远程或局域网的 ComfyUI 地址被拦截 | 图像连接要启用 `IMAGE_LOCAL_URLS_ENABLED`。让 ComfyUI 监听网络接口，并检查主机的防火墙。不要把没有认证的 ComfyUI 服务器暴露到公网上。 |
| 报错 `Outbound response exceeded N bytes` | 响应超过了配置的上限，默认是 30 MiB。嵌入的工作流或参考图元数据可能导致这种情况。在 ComfyUI 里关闭元数据，或者调高 Marinara `.env` 里的 `IMAGE_GEN_MAX_RESPONSE_BYTES` 并重启 Marinara。 |
| 耗时较长的图像生成超时 | 调高 Marinara `.env` 里的 `COMFYUI_GEN_TIMEOUT`。这个值以秒为单位，默认是 `2400`。 |
| 耗时较长的视频生成超时 | 调高 Marinara `.env` 里的 `VIDEO_GEN_TIMEOUT_MS`。这个值以毫秒为单位，默认是 `1800000`(30 分钟)。 |
| 生成时显存不足 | 缩小图像尺寸或模型规模，卸载本地语言模型，改用远程语言模型，或者把 ComfyUI 挪到另一台设备上。 |

## 相关指南

- [图像生成服务商与设置](image-providers.md) 介绍所有支持的图像服务和通用图像设置。
- [场景视频生成](scene-video.md) 介绍视频连接以及每一处场景视频入口。
- [Game Mode 中的 LTX 2.3 分镜](../game/ltx-2-3-storyboards.md) 介绍 LTX Director API 工作流、占位符和推荐的 Game 设置。
- [图像风格方案](style-profiles.md) 讲解 Marinara 可复用的提示词风格。
- [Illustrator 智能体](illustrator-agent.md) 介绍自动场景插图。
- [服务器配置参考](../CONFIGURATION.md) 记录了本地网络访问和 ComfyUI 超时的相关内容。
- [ComfyUI 工作流概念](https://docs.comfy.org/development/core-concepts/workflow) 是 ComfyUI 官方文档对工作流的说明。
