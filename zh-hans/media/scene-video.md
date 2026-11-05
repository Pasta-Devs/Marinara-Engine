# 场景视频生成

场景视频是表现当前场景的一小段 MP4 短片。它可以让 Gallery(图库) 里的图片动起来：以图片为首帧，由 AI 添加动作。在 Roleplay(角色扮演) 中，也可以只根据故事生成。本指南介绍如何设置视频服务、从 Gallery 和 Game Mode(游戏模式) 生成短片，以及修改视频设置。

场景视频可以在 Roleplay 和 Game Mode 聊天里使用。Conversation(对话模式) 聊天则改为发送视频消息，见[视频消息](../conversation/selfies.md#video-messages)。

Game Mode 和 **Animate illustration**(让插图动起来) 始终从图片开始，所以要先生成或上传一张。在 Roleplay 中，`/video` 和 Gallery 的 **Video**(视频) 按钮遵循 Illustrator 的 **First frame**(首帧) 设置。未选择 First frame 时，它们不需要图片。

场景视频使用一类单独的账号：**Video Generation**(视频生成)，而不是普通的图像生成。生成好的短片会随聊天一起保存，并显示在 Gallery 里，可以在那里固定、下载或观看。

## 设置视频服务

1. 点击顶栏里的 **Connections**(连接)，再点击 **Add**(添加)。**Add account**(添加账号) 窗口随即打开。
2. 在 **Images & video**(图像与视频) 部分选择一个服务。可用的服务列在下面。
3. 云端服务需要粘贴 API 密钥。本地 ComfyUI 不需要。SwarmUI 只有在你的服务器要求账号时才需要 Swarm Auth Token。
4. 点击 **Connect**(连接)，然后选一个模型或保留默认值。NanoGPT 没有默认值，所以要从它的列表里选一个。ComfyUI 则不要设置模型，除非工作流用到了 `%model%`。SwarmUI 的模型可填可不填。
5. 打开视频模型，点击 **Test video**(测试视频) 检查它。

每个服务都会填入默认地址，适用时还会填入默认模型。NanoGPT 没有默认模型，所以要自己选一个。

| 视频服务 | 默认模型 | 说明 |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | 通过 Gemini API 运行 Gemini Omni 和 Veo 模型。 |
| **xAI Imagine** | `grok-imagine-video-1.5` | 通过 xAI Videos API 调用 Grok Imagine 视频。 |
| **OpenRouter Video** | `google/veo-3.1` | 可以手动填写任意 OpenRouter 视频模型 ID。 |
| **NanoGPT** | 无，需自行选择 | 通过 NanoGPT 调用视频模型。 |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | 托管的文生视频和图生视频模型。 |
| **Seedance 2.0** | `seedance-2-0` | 支持纯文本、首帧以及首尾帧模式。 |
| **ComfyUI** | 由工作流决定 | 本地 WAN 及其他 API 格式的视频工作流。 |
| **SwarmUI** | 由工作流决定 | 通过你的 SwarmUI 服务器运行的 ComfyUI 视频工作流。 |

**Google AI Studio** 覆盖两个模型系列。**Gemini Omni** 使用 `gemini-omni-flash-preview`，**Google Veo** 使用 `veo-3.1-generate-preview`。运行哪一个，取决于你选的模型。

使用 **ComfyUI** 时，填 `http://127.0.0.1:8188`，并把 API 格式的视频工作流粘贴到 **ComfyUI workflow (required)**(ComfyUI 工作流，必填) 里。工作流是必填的。占位符和输出节点见 [ComfyUI 工作流设置](comfyui.md#comfyui-video-workflows)。

使用 **SwarmUI** 时，Marinara 会填入 `http://127.0.0.1:7801`。把 API 格式的视频工作流粘贴到 **ComfyUI workflow (required)** 里。工作流是必填的。SwarmUI 用不了 `%reference_image_name%` 占位符，所以要改用 `%reference_image%`。如果你的服务器要求账号，就把 Swarm Auth Token 粘贴到 **API key**(API 密钥)。

### 设为默认视频模型

想让没有自己视频模型的聊天也能用某个视频模型，就在 **Connections** 面板顶部的 **Defaults**(默认值) 下设置 **Video** 这项工作。Chat Settings(聊天设置) 里显示为 **Default video provider**(默认视频服务商)。既没有聊天模型也没有默认模型时，视频操作会提示你先选一个。

### 视频提示词指令

每个视频模型都有一个 **Video prompting instructions**(视频提示词指令) 输入框。用它告诉撰写视频提示词的 AI，你的视频模型需要什么，比如运镜、提示词长度或声音。它会指导 Roleplay 的 Gallery 动画、Conversation 的视频消息，以及 Storyboard 的 **Image-aware shot planning**(图像感知镜头规划)。如果 AI 把其中完整的一句话照抄进提示词，Marinara 会删掉那句话。Game Mode 的场景视频、通话片段和动态表情会另行撰写提示词，不受它影响。

### 每个模型的视频默认值

视频模型有一个 **Video defaults**(视频默认值) 面板，用来设置默认的短片时长、宽高比和分辨率。它们的优先级高于应用全局的备用时长。

各服务的默认时长、时长范围、宽高比和分辨率：

- Gemini Omni：10s，1 到 60s，16:9，服务商默认分辨率。
- Google Veo：8s，4、6 或 8s，16:9，720p。
- xAI Imagine：10s，1 到 15s，16:9，720p。
- OpenRouter Video：10s，1 到 60s，16:9，720p。
- Atlas Cloud：8s，1 到 60s，16:9，720p。
- Seedance 2.0：5s，4 到 15s，16:9，720p。
- ComfyUI 和 SwarmUI：5s，1 到 60s，16:9，720p。

Gemini Omni 没有分辨率字段，时长写进提示词文本里。Google Veo 只要给参考图做动画，就一律使用 8 秒，因为它需要 8 秒来衔接首帧和尾帧。

<a id="seedance-reference-frames"></a>

### Seedance 参考帧

Seedance 必须通过公网链接获取你的参考图。本地的 Marinara 服务器没有公网链接，所以纯本地环境要多做一步。

1. 打开 Seedance 模型。
2. 开启 **Upload Seedance reference frames temporarily**(临时上传 Seedance 参考帧)。参考帧会上传到一个临时公网链接。
3. 可选：设置 **Temporary link lifetime**(临时链接有效期)。默认 12 小时。

如果你的 Marinara 服务器本来就有公网地址，可以改为设置一个环境变量。见[服务器配置参考](../CONFIGURATION.md)。

## 从 Gallery 生成视频

Roleplay 和 Game Mode 聊天都能从 Gallery 生成场景视频。打开 **Chat Settings**，展开 **Gallery**。Gallery 有 **Images**(图片) 和 **Videos**(视频) 两个选项卡，各自带数量。

### 在 Roleplay 中

Gallery 顶部操作行里的 **Video** 会为最新回复生成一段短片，等同于 `/video`。在 `/video` 后面加上描述，可以指定短片要展示什么。

- **First frame**：遵循 Illustrator 的 **First frame** 设置。可以是为最新回复新画的一张 Illustrator 图片（先画图，再做动画）、角色的头像或立绘，或者不用图片。没有选择时，短片只根据故事生成。
- **头像**：短片从你的描述中最先点名的人开始，也包括你的用户角色。只要写出其他人不共用的一部分名字，并以大写字母开头即可（例如用“Lena”指代“Dr. Lena Kowalski”）。没有点名任何人时，从聊天的角色开始。
- **检查**：开启 **Expose media prompts before sending**(发送前显示媒体提示词) 后，可以先检查和修改短片的提示词。
- **上下文**：AI 读取的近期消息数量与 Illustrator 生成图片时相同（Illustrator 的 **Context Size**(上下文大小)，在它设置界面的 **Agent Budget**(智能体预算) 下）。
- **无图片时**：短片从头像开始或不使用图片时，AI 会自己描述场景。它的指令是 **Settings → Generations → Video Generation Prompt Overrides**(设置 → 生成 → 视频生成提示词覆盖) 下的 **Roleplay Clip Director**(Roleplay 短片导演)。

生成好的短片会直接在最新回复下方播放，即使图片来自更早的回复也是如此。短片不会自己在悬浮窗口里打开。想让短片悬浮显示，就在 **Videos** 下使用 **Pin video to chat**(把视频固定到聊天)。点短片的 **X** 按钮可以把它从消息里移除，它仍会留在 Gallery 里。

### 在 Game Mode 中

1. 确认 **Images** 下至少有一张图片。用 **Illustrate**(生成插图) 生成，或上传一张。
2. 点击 Gallery 顶部操作行里的 **Video**。
3. 如果在 **Settings → Generations → Overall Generations**(设置 → 生成 → 总体生成) 下开启了 **Expose media prompts before sending**，先查看或修改提示词，再点击 **Generate**(生成)。取消不会发出请求。
4. 按钮会显示 **Generating...**，同时有一条横幅提示视频正在生成。
5. 完成后，短片会出现在 **Videos** 下。

如果没有图片，Marinara 会提示：“Add or generate a gallery image before generating a scene video.”先生成或上传一张，再试一次。

### 让一张图片动起来

1. 打开 **Images** 选项卡。
2. 把鼠标移到图片上。
3. 点击 **Animate illustration** 按钮，也就是胶片图标。

开启提示词检查后，会弹出一个窗口，显示为这张图片编译出的确切提示词、时长、宽高比和分辨率。你的修改只对这一段短片生效。在 Roleplay 中，规划动作的 AI 读取的近期消息数量与 Illustrator 相同，截止到图片所属的那条回复。它的可复用指令是 **Settings → Generations → Video Generation Prompt Overrides** 下的 **Roleplay Gallery Animation Director**(Roleplay 图库动画导演)。

**Videos** 下的每段短片都能就地播放，并显示时长和模型名。可以使用 **Pin video to chat** 或 **Download scene video**(下载场景视频)。还没有短片时，选项卡显示 **No videos yet**。

## 选择服务

八种服务都能根据你的图片生成短片。

- **Google AI Studio (Gemini Omni)**：时长最长 60 秒，写在提示词里。
- **Google AI Studio (Veo)**：画质出色，时长固定为 4、6 或 8 秒。给图片做动画时使用 8 秒。
- **xAI Imagine**：1 到 15 秒，提示词长度上限比其他服务短。
- **OpenRouter Video**：1 到 60 秒，可以使用你的账号支持的任意视频模型。
- **NanoGPT**：1 到 60 秒，没有默认模型。
- **Atlas Cloud**：加载 Atlas Cloud 当前的视频模型目录，图生视频模型排在前面，每个模型都标出按输出视频每秒计算的起始价格。加载失败时，Marinara 会显示 Veo 3.1 和 Seedance 2.0 的初始模型。你可以输入准确的模型 ID。模型自身的限制仍然适用。
- **Seedance 2.0**：4 到 15 秒，支持首帧和首尾帧两种模式。需要参考图的公网链接。
- **ComfyUI**：通过你的 API 格式工作流在本地生成。工作流用到 `%reference_image_name%` 时，Marinara 会直接上传参考图。
- **SwarmUI**：通过你的工作流和 SwarmUI 服务器在本地生成。参考图通过 `%reference_image%` 传入。

视频任务很慢。服务启动任务后，Marinara 会一直等待并检查，直到短片生成完毕。一段短片可能要几分钟。本地的大型 WAN 模型可能需要超过默认的 30 分钟。调高 `VIDEO_GEN_TIMEOUT_MS`，然后重启 Marinara。

### Atlas Cloud 模型之间的差异

Atlas Cloud 的模型接受的设置并不完全相同。每次请求前，Marinara 都会从 `static.atlascloud.ai` 读取该模型公布的输入结构，并据此调整你的默认设置。

- 原图会放进该模型使用的图像字段。
- 短片时长会调整为模型提供的最接近值。只支持 5 秒或 10 秒的模型会把默认的 8 秒变成 10 秒。
- 分辨率会调整为模型提供的最接近档位。接受像素尺寸的模型，会根据你的宽高比和分辨率得到最接近的 `width*height`。
- 模型没有的设置会被省略，由模型的默认值生效。

服务器日志会在以 `[video-gen/atlas-cloud] fitted request` 开头的一行里列出每个改动过的值。如果读不到输入结构，Marinara 会发送与以前相同的通用请求。

场景视频请选用图生视频模型。文生视频模型没有图像字段。它会忽略你的图片，只根据提示词生成一段无关的短片，服务器日志也会说明这一点。模型需要图像时，**Test video** 会发送一张简单的渐变图作为首帧，这样图生视频模型也能通过测试。

许多 Atlas Cloud 模型有自己的输入，例如 `negative_prompt`、`seed`、`generate_audio`、`shot_type`、`enable_prompt_expansion` 或 LoRA 列表。

1. 打开 Atlas Cloud 模型，选择或输入一个模型。
2. 展开 **Video defaults**，再展开 **Atlas Cloud setup**(Atlas Cloud 设置)。
3. 在时长、宽高比和分辨率控件下面找到 **Model options**(模型选项)。

**Model options** 顶部列出模型接受的时长、分辨率、帧尺寸和宽高比。文生视频模型还会显示一条警告。每个选项都使用 Atlas Cloud 自己的名称和说明，初始为 **Model default**(模型默认值)，括号里显示默认值。保持 **Model default** 的选项不会发送。改动某个选项后，这个模型生成的每个视频都会带上你设置的值，包括 **Test video**。列表和对象输入（例如 LoRA）使用 JSON。

选择按模型分别保存。**Reset model options**(重置模型选项) 会清除当前模型的选择。点击 **Save**(保存) 保留改动。如果某个已保存的选项不再适合该模型，Marinara 会省略它，并在那行日志里写出它的名称。

## 在 Game Assets 里生成视频

Game Mode 还有第二个生成场景视频的地方：**Game Assets**(游戏素材)。点击聊天右上角附近的文件夹按钮。在电脑上它以窗口形式打开，在手机上是全宽面板。如果你把它移到了 Chat Settings 里，就打开那里的 **Game Assets** 区域。

1. 打开 **Game Assets**。
2. 点击 **Generate video**(生成视频)（“Generate a scene video from the latest illustration”）。
3. 准备好后，最新的短片会在那里播放。

游戏同时有了视频模型和场景插图后，**Generate video** 才可用。点得太早，可能会看到“Choose a Video Generation connection in Game Settings first.”（给这局游戏设置一个视频模型），或“Generate a scene illustration before generating a scene video.”短片生成失败时，面板会显示“Scene video generation failed.”再试一次；如果一直失败，检查你的密钥。

## 为聊天选择视频模型

每个聊天在 **Chat Settings → Agents → Scene Videos**(聊天设置 → 智能体 → 场景视频) 下选择自己的视频模型。

- **Roleplay** 显示一张 **Scene Videos** 卡片（“Generate manual MP4 scene videos from gallery images”）。它只有一个控件，即视频模型列表。
- **Game Mode** 显示一张 **Scene Videos** 卡片（“Generate MP4 scene videos from game illustrations”），控件更多。视频模型列表用来选模型。**Game Video Prompt**(游戏视频提示词) 是决定图片如何动起来的模板。内置默认值是 **Cinematic Scene Video**。**Edit Video Prompt Presets**(编辑视频提示词预设) 用来为这个聊天添加和编辑你自己的副本。

在 Game Mode 中，**Game Video Prompt** 控制 Gallery 和 Game Assets 里手动生成的视频。Roleplay 的 Gallery 动画则改用 **Roleplay Gallery Animation Director**。Storyboard 智能体有自己的默认 **Storyboard Video Prompt**(分镜视频提示词)。每个聊天都可以在 **Chat Settings → Agents → Storyboards**(聊天设置 → 智能体 → 分镜) 下覆盖它。重置后会回到 Storyboard 智能体的默认值。

新建 Game Mode 聊天时，设置向导的 **Features**(功能) 步骤里有视频模型选择器，开启视觉生成之后才会出现。

## 视频生成设置

有些视频默认值是应用全局的。打开 **Settings → Generations**(设置 → 生成)，找到 **Video Generation** 一节，它的说明是“Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls”。

- **Scene video fallback length**(场景视频备用时长)：只在所选视频模型没有自己的时长时使用。默认 10 秒，范围是 1 到 60。
- **Video Generation Prompt Overrides**：编辑可复用的视频提示词模板。**Roleplay Gallery Animation Director** 设置在生成 Roleplay Gallery 短片之前发给 Prompt Model 的指令。其中的 `${durationSeconds}` 变量会变成短片时长。
- **Videos per reply**(每条回复的视频数)：Conversation 角色在一条回复中能发送多少条视频消息，以及 Illustrator 为一条 Roleplay 回复添加多少段短片。默认 3，范围是 1 到 10。每个 Conversation 角色最多发送一段。这项设置是为群聊和一次请求多个视频的情况准备的。调高它可以让更多角色发送短片。调低它可以节省请求。超出上限的短片会被跳过。`/video` 和 Gallery 的 **Video** 按钮不计入。
- **Animated expression length**(动态表情时长) 属于会动的角色立绘。见[动态表情](animated-expressions.md)。

## 分镜

可下载的 Storyboard 智能体会在 Roleplay 和 Game Mode 里生成有序的关键帧图像和短片。开启动画后，Marinara 会用所选的视频模型和这个智能体的 **Storyboard Video Prompt**，把每一张成功的关键帧做成动画。见 [Storyboard 智能体指南](../game/storyboard.md)。

## 故障排查

### "Choose a Video Generation connection"

聊天还没有视频模型。打开 **Chat Settings → Agents → Scene Videos**，选一个。如果列表是空的，就到 **Connections** 下添加一个。

### "Add or generate a gallery image before generating a scene video"

Game Mode 和 **Animate illustration** 需要已有图片。未选择首帧时，Roleplay 可以只根据故事生成短片。用 **Illustrate** 生成、上传一张图片，或者对已有图片点击 **Animate illustration**。

### 视频生成很慢

这是正常的。Google、xAI、OpenRouter、NanoGPT、Atlas Cloud 和 Seedance 都是先启动任务，再由 Marinara 等待它完成。一段短片可能要几分钟。

### Seedance 读不到参考图

Seedance 需要你的图片的公网链接。在本地服务器上，打开 Seedance 模型的 **Upload Seedance reference frames temporarily**。见 [Seedance 参考帧](#seedance-reference-frames)。

### 视频请求一直失败

确认账号的 API 密钥有效，并且有视频权限。在 **Connections** 里打开这个账号，核对密钥和模型。服务器超时设置见[服务器配置参考](../CONFIGURATION.md)。

## 相关指南

- [动态表情](animated-expressions.md)
- [Storyboard 智能体指南](../game/storyboard.md)
- [Game Mode 中的 LTX 2.3 分镜](../game/ltx-2-3-storyboards.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
- [服务器配置参考](../CONFIGURATION.md)
