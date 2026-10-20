# Noodle 提示词内部结构（开发者）

面向开发者的参考，说明 Noodle 的生成提示词在代码里的位置、怎么自定义，以及怎么调试最终提示词。普通读者是通过 Noodle 的 Settings 面板来配置它的，见 `docs/noodle/` 下的 Noodle 指南。

Noodle 是一个可下载的包。它的路由（`/api/noodle`，在包激活时注册）和生成代码都在 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 的 Noodle 包里，位于 `packages/noodle/src/engine/packages/server/src/` 下。下表中标为 **package** 的来源都是相对于这个文件夹的路径。Engine 保留共享的 Noodle schema 和类型、Noodle 存储、Settings 里列出的已注册提示词覆盖项，以及 `packages/server/src/services/noodle/noodle-prompt.ts` 里的默认时间线提示词文本。包里另有自己的 `services/prompt-overrides/registry/noodle.ts` 和 `services/noodle/noodle-prompt.ts` 副本。

## 提示词来源对照

Noodle 有一条组装而成的时间线提示词、一条内联的资料提示词，以及三条注册的提示词覆盖项：两条用于时间线的系统提示词，一条用于帖子配图。

| 用途 | 来源 | 主要符号 | 怎么自定义 |
| --- | --- | --- | --- |
| 时间线的帖子、回复、关注、投票、投票表决和摘要 | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` | 系统消息由 **Noodle Timeline Prompt**(Noodle 时间线提示词) 覆盖项加上随后的 **Noodle Timeline Voice & Tone** 覆盖项组成（两者见下）。两条用户消息、上下文（账号、用户角色、资料、日程、设定、选择加入的聊天上下文、时间线、已启用的功能和配额）以及 `# JSON Output Format` 消息，都在代码里组装。 |
| 时间线的基础系统提示词 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE`(`noodle.timelineBase`) | 在 **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt**(设置 -> 生成 -> 图像生成提示词覆盖 -> Noodle 时间线提示词) 里修改，或者在代码里改 `noodle-prompt.ts` 中的 `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT`。默认文本包含成人平台、用户角色作者身份、互动和 JSON 规则，所以重写它可能会破坏 `noodleGeneratedRefreshSchema` 的解析。 |
| 时间线的语气和风格指令（追加在基础提示词之后） | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE`(`noodle.timelineVoice`) | 在 **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone** 里修改，或者在代码里改注册的默认值（`noodle-prompt.ts` 中的 `noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)`）。没有改动过的默认值会跟随 Noodle 设置 `enableEnhancedTimelineWriting`(`ctx.enhanced`，默认关闭时得到的就是原来那条单行语气指令)，以及是否允许随机用户；一旦保存了自己的覆盖文本，无论这些设置是什么状态，都以覆盖文本为准。 |
| 角色账号的首次资料生成 | **package** `services/noodle/noodle-public-profiles.service.ts` | `generateMissingNoodleProfiles()` | 在代码里修改内联的 system 和 user 消息。参与者筛选会先跑一遍，只有被选中、且还没有 `profileGenerated` 的角色账号才会进入这条提示词。 |
| 生成帖子配图的提示词 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST`(`noodle.imagePost`) | 在 **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image** 里修改，或者在代码里改注册的默认值。 |
| Noodle 专用的默认图像指令 | `packages/shared/src/schemas/noodle.schema.ts` | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | 在界面里改这条 Noodle 设置，或者在代码里改它的 schema 默认值。 |
| 选择加入后插入时间线生成的聊天上下文 | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildOptedInChatContext()` | 在代码里修改上下文的组装方式；是否加入仍然由每个聊天自己的设置决定。 |
| 时间线帖子和回复的图像输入 | **package** `services/noodle/noodle-vision.ts` | `prepareNoodleVisionAttachments()` | 在代码里修改图像的挑选、归一化、数量上限，或者纯文本兼容回退。 |
| 插入聊天提示词的 Noodle 动态 | **package** `services/noodle/noodle-context.ts` | `buildRecentSocialMediaActivityBlock()` | 包把它注册为 `noodle:prompt-context` 服务。在代码里修改筛选逻辑或区块组装；目标模式和条目数量上限由 Noodle Settings 里的设置控制，包装后的区块有 8,192 Token 的硬上限。 |
| 生成结果的 JSON 契约 | `packages/shared/src/schemas/noodle.schema.ts` | `noodleGeneratedRefreshSchema` | 只能和提示词、路由处理、共享类型以及回归覆盖一起改。 |
| 插入时间线生成的世界书设定上下文 | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()`(调用 `processLorebooks()`) | 由 Noodle 设置 **Lorebook context**(世界书上下文)（`enableLorebookContext`，默认关闭）控制。复用群聊用的那套多角色 `processLorebooks()`，Token 预算来自 `noodle-prompt.ts` 里 Noodle 专用的 `noodleLorebookTokenBudget()`，按活跃角色数量缩放，并硬性封顶在 8,192 Token。运行时带 `previewOnly: true`，因为 Noodle 没有按聊天保存的槽位来持久化 sticky/cooldown 的计时状态。 |

资料提示词没有列在 Prompt Overrides 界面里。**Noodle Timeline Prompt**、**Noodle Timeline Voice & Tone** 和 **Noodle Post Image** 模板则都在那里。开启 **Noodle image generation**(Noodle 图像生成，即 `enableImagePrompts`) 时，Noodle 设置 **Image instructions (sent to your LLM)**(图像指令，会发给你的 LLM) 会发给时间线模型，模型给每条帖子构思配图时会遵循它；默认的 **Noodle Post Image** 模板不再追加这段指令，不过自定义模板仍然可以用 `${userInstructions}` 引用它。

图像服务（**package** `services/noodle/noodle-public-images.service.ts`）先加载 `NOODLE_IMAGE_POST`，再把结果交给 `compileImagePrompt()` 处理，然后才发给图像服务商。也就是说，最终请求还会受到所选图像风格方案和连接默认值的影响。

## 查看最终提示词

在开启 Debug Mode 的情况下手动刷新，最终的资料模型消息和时间线模型消息会通过服务器共享日志打印出来。留意这几行：

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

时间线的图像数据永远不会以 base64 形式写进调试日志。打印出来的文本包含发给模型的那些帖子和回复的附件键，外加原生图像输入的数量。Noodle 会在 `noodle-vision.ts` 里对这些输入做归一化和数量限制。如果某个服务商明确拒绝视觉内容，包会记录日志，并改发组装好的纯文本回退提示词。

图像方面，在 **Settings -> Generations -> Overall Generations**(设置 -> 生成 -> 总体生成) 下开启 **Expose media prompts before sending**(发送前显示媒体提示词)，就可以在请求发出前查看并修改最终编译好的正向和负向提示词。

## 安全地修改

提示词组装是一条高风险的兼容性边界。改动时要让提示词、`noodleGeneratedRefreshSchema`、路由处理，以及 Noodle 的提及和投票回归测试保持一致。在 Engine 里至少要跑：

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

包自有代码的修改要在 Marinara-Agents 里针对它的 `staging` 分支进行和验证。

## 相关指南

- [Noodle：应用内的社交时间线](../noodle/overview.md)
- [Noodle 设置与聊天延续](../noodle/settings.md)
- [可选智能体包与能力包](optional-agent-packages.md)
- [架构地图（开发者）](architecture-map.md)
