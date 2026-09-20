# 场景视频生成

本指南介绍 Marinara Engine 如何把一张场景插图变成一小段 MP4 视频，内容包括可用的视频服务商、在 Gallery 里生成短片的方法、Game Mode 的相关控件，以及视频相关设置。场景视频就是由一张静态图片生成的一小段动画短片。

## 场景视频能做什么

场景视频会取图库里已有的一张图片，把它变成一小段 MP4 短片。静态图片作为第一帧，动态部分由 AI 补出来。场景视频可以在 **Roleplay**(角色扮演) 和 **Game Mode**(游戏模式) 聊天里使用。

必须先有图片。场景视频没法只凭文字生成，动画之前一定要先生成或上传一张图库图片。

场景视频使用的是一类单独的连接，叫 **Video Generation**(视频生成)，和普通的图像生成不是一回事。生成好的短片会随聊天一起保存，并显示在 Gallery 里，可以在那里固定、下载或播放。

## Video Generation 连接

想生成场景视频，先要添加一个能生成视频的连接。用的还是聊天连接和图像连接所在的那个 Connections 面板。

1. 打开 **Settings**(设置)，再打开 **Connections**(连接)。
2. 点击 **Add Connection**(添加连接)。
3. 把服务商类型设为 **Video Generation**。
4. 在 **Video Service**(视频服务) 里选择下面六种服务之一。
5. 云端服务需要填入 API 密钥。本地 ComfyUI 不需要。
6. 云端服务可以选一个模型，也可以保留服务商默认值。ComfyUI 则不要填模型，除非工作流里用到了 `%model%`。
7. 保存连接。

**Video Service** 下拉菜单提供六个选项。每一项都会自动填好默认的网址，需要的话还会填好默认模型：

| 视频服务             | 默认模型                          | 说明                                                                         |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| **Google AI Studio** | `gemini-omni-flash-preview`       | 通过 Gemini API 调用 Gemini Omni 和 Veo 视频模型。                           |
| **xAI Imagine**      | `grok-imagine-video-1.5`          | 通过 xAI Videos API 调用 Grok Imagine 视频。                                 |
| **OpenRouter Video** | `google/veo-3.1`                  | 通过 OpenRouter 调用视频模型。可以手动填写任意 OpenRouter 视频模型 ID。      |
| **Atlas Cloud**      | `google/veo3.1/text-to-video`     | 通过 Atlas Cloud 调用托管的文生视频和图生视频模型。                          |
| **Seedance 2.0**     | `seedance-2-0`                    | 支持纯文本、首帧、首尾帧三种视频模式。                                       |
| **ComfyUI**          | 由工作流决定                      | 本地 WAN 及其他以 API 格式导出的视频工作流。                                 |

**Google AI Studio** 覆盖两个模型系列。**Gemini Omni** 用 `gemini-omni-flash-preview`，**Google Veo** 用 `veo-3.1-generate-preview`。实际跑哪一个，取决于连接里选的模型。

用 **ComfyUI** 时，填本地常用地址 `http://127.0.0.1:8188`，并把 API 格式的视频工作流粘贴到 **ComfyUI Workflow**(ComfyUI 工作流) 里。工作流是必填的。占位符和输出节点的要求见 [ComfyUI 工作流设置](comfyui.md#comfyui-video-workflows)。

### 设为默认视频连接

Video Generation 连接的编辑界面里有一组 **Default for Videos**(视频默认连接) 选项。开启 **Use as default video connection**(用作默认视频连接)，聊天本身没有指定视频连接时，Marinara 就会用这个连接。默认视频连接只标记一个。

### 连接层面的视频默认值

Video Generation 连接在编辑界面里有专属的 **Video Generation Defaults**(视频生成默认值) 面板，用来设置该连接默认的短片时长、宽高比和分辨率。这些连接级默认值的优先级高于应用全局的备用时长。

| 服务             | 默认时长       | 时长范围     | 宽高比       | 分辨率           |
| ---------------- | -------------- | ------------ | ------------ | ---------------- |
| Gemini Omni      | 10s            | 1 到 60s     | 16:9         | 服务商默认       |
| Google Veo       | 8s             | 4、6 或 8s   | 16:9         | 720p             |
| xAI Imagine      | 10s            | 1 到 15s     | 16:9         | 720p             |
| OpenRouter Video | 10s            | 1 到 60s     | 16:9         | 720p             |
| Atlas Cloud      | 8s             | 1 到 60s     | 16:9         | 720p             |
| Seedance 2.0     | 5s             | 4 到 15s     | 16:9         | 720p             |
| ComfyUI          | 5s             | 1 到 60s     | 16:9         | 720p             |

Gemini Omni 没有分辨率字段，时长也不是单独的设置项，而是写进提示词文本里的。Google Veo 只要是给参考图做动画，就一律锁定 8 秒，因为它需要 8 秒来衔接首帧和尾帧。

### Seedance 参考帧

Seedance 必须通过一个公网链接取到参考图，才能给它做动画。本地跑的 Marinara 服务器没有公网链接，所以纯本地环境要多做一步。

打开 Seedance 连接，开启 **Upload Seedance reference frames temporarily**(临时上传 Seedance 参考帧)。这样参考帧会被上传到一个临时公网链接，Seedance 就能读到了。链接的有效期可以在 **Temporary link lifetime**(临时链接有效期) 里选，默认 12 小时。

如果 Marinara 服务器本来就有公网地址，可以改用环境变量，不必走临时上传。视频参考图相关的设置项见[服务器配置参考](../CONFIGURATION.md)。

## 选择服务商

六种服务都能把图片变成短片，区别在速度、片长，以及处理参考图的方式。

- **Google AI Studio (Gemini Omni)**：时长灵活，最长 60 秒。时长写在提示词里，没有单独的控件。
- **Google AI Studio (Veo)**：画质出色，但时长固定为 4、6 或 8 秒。给图片做动画时用 8 秒。
- **xAI Imagine**：1 到 15 秒。提示词长度上限比其他服务更短。
- **OpenRouter Video**：1 到 60 秒，还可以手动填写 OpenRouter 账号支持的任意视频模型。
- **Atlas Cloud**：**Fetch Models**（获取模型）会加载 Atlas Cloud 当前的视频模型目录，优先显示图生视频模型，并列出每个模型按输出视频每秒计算的起始价格。如果无法访问目录，Marinara 会改为显示 Veo 3.1 和 Seedance 2.0 的初始模型。你也可以输入准确的 Atlas Cloud 视频模型 ID；各模型的时长、分辨率和参考图像限制仍然适用。
- **Seedance 2.0**：4 到 15 秒，支持首帧和首尾帧两种模式。需要参考图的公网链接。
- **ComfyUI**：用自己的 API 格式工作流在本地生成。工作流里用到 `%reference_image_name%` 时，Marinara 会把参考图直接上传给 ComfyUI。

视频任务比较慢，要有心理准备。服务商启动任务后，Marinara 会一直等待并轮询，直到短片生成完毕。一段短片往往要几分钟，比出一张静图久得多。本地的大体积 WAN 模型可能超过默认的 30 分钟上限，必要时调高 `VIDEO_GEN_TIMEOUT_MS` 并重启 Marinara。

### Atlas Cloud 模型之间的差异

Atlas Cloud 模型接受的设置并不完全相同。每次请求前，Marinara 都会从 `static.atlascloud.ai` 读取模型公布的输入结构，并据此调整连接的默认设置：

- 原始插画会通过该模型使用的图像字段发送。
- 片段时长会调整为模型支持的最接近值。例如，只支持 5 秒或 10 秒的模型会把默认的 8 秒调整为 10 秒。
- 分辨率会调整为模型支持的最接近档位。对于接受像素尺寸的模型，会根据你的宽高比和分辨率选择最接近的 `width*height`。
- 模型不支持的设置会被省略，以便使用模型自身的默认值。

服务器会在以 `[video-gen/atlas-cloud] fitted request` 开头的日志行中列出每个调整的值。如果无法读取输入结构，Marinara 会发送与之前相同的通用请求。

场景视频请选用 **image-to-video**（图生视频）模型。文生视频模型没有图像字段，因此会忽略你的插画，仅根据提示词生成独立的片段。服务器日志会说明这种情况。

如果所选 Atlas Cloud 模型必须接收图像，**Test Video**（测试视频）会发送一张简单的渐变图作为首帧，这样图生视频模型也能通过连接测试。

### Atlas Cloud 模型选项

许多 Atlas Cloud 模型有自己的输入，例如 `negative_prompt`、`seed`、`generate_audio`、`shot_type`、`enable_prompt_expansion` 或 LoRA 列表。连接编辑器会显示所选模型的选项：

1. 打开 Atlas Cloud 连接，选择或输入模型。
2. 展开 **Video Defaults**（视频默认设置），再展开 **Atlas Cloud setup**（Atlas Cloud 设置）。
3. 在片段时长、宽高比和分辨率控件下找到 **Model options**（模型选项）。

**Model options** 顶部会列出模型接受的片段时长、分辨率、帧尺寸和宽高比。文生视频模型还会在这里显示警告，因为它无法使用图库中的图像。

每个选项都保留 Atlas Cloud 的原始名称和说明。所有选项最初均为 **Model default**（模型默认值），括号内显示提供商的默认值。保持 **Model default** 的选项不会发送，由 Atlas Cloud 决定。更改选项后，该连接生成的每个视频都会发送你设置的值，包括 **Test Video**。LoRA 等列表和对象输入接受 JSON。

选项按模型分别保存，因此切换到其他模型再切回来，各模型的设置都会保留。**Reset model options**（重置模型选项）会清除当前模型的选择。点击连接中的 **Save**（保存）来保留更改。

如果已保存的选项不再适用于模型，例如 Atlas Cloud 修改了模型输入，Marinara 会在请求中省略它，并在 `[video-gen/atlas-cloud] fitted request` 日志行中列出该选项的名称。

## 在 Gallery 里生成视频

**Roleplay** 和 **Game Mode** 聊天都能从 **Gallery**(图库) 面板生成场景视频。点击聊天里的图片或图库图标即可打开。Game Mode 聊天还有第二个入口，也就是本指南后面讲到的 **Game Assets**(游戏素材) 面板。

Gallery 分 **Images**(图片) 和 **Videos**(视频) 两个选项卡，各自带数量标记。静态图片在 **Images** 下，生成好的短片在 **Videos** 下。

给最新的一张图片做动画：

1. 确认 **Images** 选项卡下至少有一张图片。没有就先用 **Illustrate**(生成插图) 或上传一张。
2. 点击 Gallery 顶部操作行里的 **Video**(视频)。
3. 如果在 **Settings**、**Generations**(生成)、**Overall Generations**(总体生成) 下开启了 **Expose media prompts before sending**(发送前显示媒体提示词)，先查看或修改编译好的动画提示词，再点击 **Generate**(生成)。关掉这个窗口不会向服务商发出请求。
4. 按钮会变成 **Generating...**，同时有一条横幅提示视频正在生成。
5. 生成完毕后，短片出现在 **Videos** 选项卡下。

如果想指定某一张图片，而不是最新那张：

1. 打开 **Images** 选项卡。
2. 把鼠标移到想用的那张图片上。
3. 点击悬浮控件里的 **Animate illustration**(让插图动起来) 按钮，也就是胶片图标。

开启提示词预览后，**Animate illustration** 同样会弹出 **Review Video Prompt**(检查视频提示词) 窗口，里面显示服务器为这张选中图片编译出的确切提示词、时长、宽高比和分辨率。在这里做的修改只对这一次生成生效。在 Roleplay 里，生成这段提示词的可复用指令由另一处控制，位于 **Settings**、**Generations**、**Video Generation Prompt Overrides**(视频生成提示词覆盖) 下的 **Roleplay Gallery Animation Director**(Roleplay 图库动画导演)。

在 **Videos** 选项卡下，每段短片都能就地播放，并显示时长和模型名。可以用 **Pin video to chat**(把视频固定到聊天) 固定短片，或者用 **Download scene video**(下载场景视频) 保存到本地。还没有短片时，这个选项卡显示 **No videos yet**。

如果聊天里一张图片都没有就去生成视频，Marinara 会提示：“Add or generate a gallery image before generating a scene video.”先生成或上传一张图片，然后再试。

## Game Mode 场景视频

Game Mode 生成场景视频还有第二个入口，就是 **Game Assets** 面板，用游戏控件里的 **Game Assets** 按钮打开。

1. 打开 **Game Assets** 面板。
2. 点击 **Generate video**(生成视频)，它的提示文字是“Generate a scene video from the latest illustration.”
3. 生成完毕后，最新的短片会在面板里播放。

只有游戏同时具备视频连接和场景插图时，**Generate video** 按钮才可用。点得太早会看到这两条提示之一：

- “Choose a Video Generation connection in Game Settings first.”给这局游戏指定一个视频连接。
- “Generate a scene illustration before generating a scene video.”先生成一张图片。

短片生成失败时，面板会显示“Scene video generation failed.”再试一次；如果一直失败，检查连接和 API 密钥。

## 给聊天指定视频连接

每个聊天各自选用视频连接，位置在 **Chat Settings**(聊天设置)、**Agents**(智能体)、**Scene Videos**(场景视频)。

**Roleplay** 聊天里的 **Scene Videos** 卡片说明为“Generate manual MP4 scene videos from gallery images.”，只有一个控件，即 **Video Connection**(视频连接) 下拉菜单。在这里选 Video Generation 连接即可。

**Game Mode** 聊天里的 **Scene Videos** 卡片说明为“Generate MP4 scene videos from game illustrations.”，控件更多：

- **Video Connection**：这局游戏使用的 Video Generation 连接。
- **Game Video Prompt**(游戏视频提示词)：决定图片如何动起来的提示词模板，内置默认值是 **Cinematic Scene Video**。
- **Edit Video Presets**(编辑视频预设)：为这个聊天添加和编辑自己的视频提示词模板副本。

在 Game Mode 里，Gallery 和 Game Assets 的手动视频依旧由 **Game Video Prompt** 控制。Roleplay 的 Gallery 动画则改由 **Roleplay Gallery Animation Director** 控制。已安装的 Storyboard 智能体自带一个默认的 **Storyboard Video Prompt**(分镜视频提示词)，每个 Roleplay 或 Game 聊天都可以在 **Chat Settings > Agents > Storyboards** 里另选一个把它覆盖掉。重置这个选择，用的就是 Storyboard 智能体的默认值，不会去沿用别的聊天的提示词。

新建 Game Mode 聊天时，设置向导里也有 **Video Generation Connection**(视频生成连接) 选择器。它在 **Features**(功能) 这一步，开启 **Visual Generation**(视觉生成) 之后才会出现。

聊天自己没有视频连接时，Marinara 会回退到标记了 **Use as default video connection** 的那个连接。既没有聊天连接又没有默认连接，视频相关操作会弹出警告，提示先选一个。

## 视频生成设置

有些视频默认值放在应用设置里，而不是连接里。打开 **Settings**、**Generations**，找到 **Video Generation** 一节，它的说明是“Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls.”

这里跟场景视频最相关的设置是 **Scene video fallback length**(场景视频备用时长)，默认 10 秒。只有当选中的视频连接自己没有设时长时才会用到，可设范围是 1 到 60 秒。

这一节还有 **Video Generation Prompt Overrides**，可以在里面编辑可复用的视频提示词模板。**Roleplay Gallery Animation Director** 控制的是：生成 Roleplay Gallery 短片之前，发给所选 Prompt Model 的那段指令。其中的 `${durationSeconds}` 变量会被替换成选定的短片时长。想改变短片的运动方式又不想碰代码，这就是进阶做法。

同一节里还有 **Animated expression length**(动态表情时长) 设置。那属于另一个功能，也就是会动的角色立绘。相关内容见[动态表情](animated-expressions.md)。

## 分镜

可下载的 Storyboard 智能体能在 Roleplay 和 Game Mode 里生成有序的关键帧图像和片段。Game Mode 用的是一轮已完成的 GM(游戏主持人) 回合，Roleplay 则把已完成的几轮往来合成一段内嵌的小剧集。开启动画之后，Marinara 会用选定的视频连接和这个智能体的 **Storyboard Video Prompt**，把每一张成功的关键帧变成片段。

分镜有自己的一套控件和单独的指南。安装步骤和两种模式的工作流见 [Storyboard 智能体指南](../game/storyboard.md)。

## 故障排查

### "Choose a Video Generation connection"

聊天还没有选视频连接。打开 **Chat Settings**、**Agents**、**Scene Videos**，选一个连接。下拉菜单是空的，就先到 **Settings**、**Connections** 下添加一个。

### "Add or generate a gallery image before generating a scene video"

场景视频永远是给已有图片做动画。先用 **Illustrate** 生成、上传一张图片，或者对已有图片点击 **Animate illustration**。

### 视频生成很慢

这是正常现象。服务商启动任务后，Marinara 会一直等待并轮询，直到短片生成完毕。Veo、xAI、OpenRouter、Atlas Cloud 和 Seedance 都是这个流程，一段短片要几分钟很常见。

### Seedance 读不到参考图

Seedance 需要图片的公网链接。本地服务器上，打开 Seedance 连接并开启 **Upload Seedance reference frames temporarily**。详见上面的 Seedance 一节。

### 视频请求一直失败

确认连接里的 API 密钥有效，并且账号有视频权限。到 **Settings**、**Connections** 下打开该连接，核对密钥和模型。视频相关的服务器端超时设置见[服务器配置参考](../CONFIGURATION.md)。

## 相关指南

- [动态表情](animated-expressions.md)
- [Storyboard 智能体指南](../game/storyboard.md)
- [Game Mode 中的 LTX 2.3 分镜](../game/ltx-2-3-storyboards.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
- [服务器配置参考](../CONFIGURATION.md)
