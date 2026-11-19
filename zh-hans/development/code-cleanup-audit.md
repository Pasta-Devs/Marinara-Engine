# 代码清理审计

**审计日期：**2026-07-22

**目标分支：**`staging`

**目的：**在不改变运行时行为的前提下，找出可以删除的遗留产物，以及影响范围可控的简化项。

**实施状态：**其中高置信度、低风险的结论已经在同一次清理改动里落地。

## 实施结果

已完成：

- 删除了 4 个无法到达的源码模块、已废弃的 sidecar 构建脚本、一个测试都不跑的运行器，以及已完成的任务说明文档；
- 删除了仅为那个无法到达的调试面板而存在的调试日志缓冲区，同时保留了浏览器控制台的诊断信息；
- 处理完全部 60 项由编译器证实的未使用代码，并在客户端和服务器中开启了未使用项检查；
- 按领域分批删除了 53 个没有任何地方使用的客户端 Hook、辅助函数、类型和 UI 声明；
- 删除了 8 个高置信度的孤立依赖，并修好了 lockfile、工作区安装检查和故障排查说明；
- 让根目录的 `pnpm test` 真正跑回归测试，而不是在零测试的情况下报成功；
- 复用了已有的分镜关键帧选择逻辑，并把重复的 Spotify 查询词处理逻辑合并到一处；
- 把预设变量的重排序限制在请求指定的那个预设内，用之前一直被忽略的 `presetId` 作为完整性边界。

出于兼容性或产品层面的考虑，以下内容有意保留，留给单独的改动处理：

- `@rollup/wasm-node`；
- 可能属于仓库外部 API 或测试接缝的服务器导出；
- PNG 解析器和教程几何计算的合并；
- 范围较大的编辑器和输入区重构，以及大模块的重构；
- 计划在下一个大版本才处理的兼容性字段。

下面的详细结论保留为改动前的证据记录。凡是与这里的实施结果冲突的建议措辞，一律以本节为准。

## 验证

这次清理通过了仓库支持的全部验证手段：

- `pnpm install --frozen-lockfile`
- `pnpm check`(未使用代码检查、TypeScript、ESLint 和生产构建)
- `pnpm test`(全部回归测试加浏览器冒烟测试：81 项通过，51 项按预期跳过)

在让这条通用测试命令变得诚实的过程中，浏览器测试还暴露出 4 处依赖页面状态的元素定位假设。这些测试现在会显式跳转页面，把重复出现的移动端控件限定到具体范围，并直接定位 Noodle 时间线真正的滚动容器，同时没有削弱原本的产品断言。

## 总体结论

这个仓库体量不小（纳入版本控制的文件有 1,665 个，本次检查的源码类文件合计约 478,000 行），但其中的大文件大多是仍在使用的产品代码，而不是明显的垃圾。最稳妥的清理方式是一批有证据支撑的小规模删除，而不是大范围重写。

最初那轮审计的第一批清理目标包括：

- 4 个没有任何地方引用的源码模块（合计 899 行）；
- 1 个已废弃的 sidecar 构建脚本（173 行）；
- 1 个一个测试都不跑却报成功的测试运行器（54 行，外加对应的 package 脚本配置）；
- 2 份遗留在仓库根目录、任务已经完成的阶段说明文档（235 行）；
- 60 处由编译器证实未被使用的声明、导入、参数和局部变量；
- 8 个疑似孤立的直接依赖，需要用全新安装和构建来验证；
- 1 张疑似没用到的 Mari 静态立绘，需要浏览器冒烟测试确认。

光是这 4 个无法到达的模块、过时脚本、空转的测试运行器和任务说明文档，就占了 1,361 行受版本控制的代码。即便如此，这些工作仍然应该拆成多个小的清理 PR，让每一次删除都有范围明确的证据，也方便回滚。

## 审计是怎么做的

这次审计综合了几类证据：

1. 清点全部受版本控制的文件、文件类型、主要源码区域和最大的那些文件。
2. TypeScript AST 的导入/导出分析，包含相对路径导入和仓库内的路径别名。
3. 在受版本控制的源码、脚本、文档、清单文件和工作流中做精确符号名和文件名搜索。
4. 为客户端和服务器强制开启 `noUnusedLocals` 和 `noUnusedParameters`，用 TypeScript 编译器做探测。
5. 直接依赖搜索；某个依赖或脚本看起来是被过去的重构落下时，再有针对性地翻查 Git 历史。
6. 归一化之后的重复代码窗口比对，再对其中最有分量的匹配结果逐一人工检查。
7. 对受版本控制的 JSON、Python 和 Bash 文件做语法检查。

下文使用的置信度标记：

- **高置信度：**多项独立检查结论一致，删除属于机械操作。
- **中等置信度：**目前没有任何地方引用，但动态加载、外部使用方或产品设计意图仍可能有影响。
- **暂缓处理：**确实值得做的简化，但回归影响面对于一次只删遗留产物的改动来说太大了。

静态分析无法证明代码里不存在运行时字符串查找、下载包的调用、用户提供的路径或外部使用方。这类情况会单独点出来，而不是直接当成死代码。

## 1. 高置信度的文件删除

### 1.1 无法到达的源码模块

| 候选项 | 证据 | 清理说明 | 需要的验证 |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx`(296 行) | 没有任何地方导入它，`AgentDebugPanel` 只在自己的声明处出现。 | 删除该组件。然后检查智能体 store 里的 `debugLog` 和 `clearDebugLog`，除了这个无法到达的面板之外没有别处使用它们。不要删除 `lastResults`，`SpriteOverlay` 还在用。 | `pnpm check`；打开智能体设置和调试模式，确认仍在使用的调试界面正常。 |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx`(113 行) | 没有任何地方导入它，`AgentThoughtBubbles` 只在自己的声明处出现。现在的思考气泡和清单界面由 `RoleplayHUD` / `RoleplayHUDActionsMenu` 渲染。 | 删除该组件，以及 `packages/client/.instructions.md` 里过时的对应条目。 | `pnpm check`；`pnpm regression:roleplay`；在浏览器里检查 Roleplay(角色扮演) 的 HUD 和连续性清单。 |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx`(468 行) | 没有任何地方导入，没有路由注册，也没有精确同名的引用。 | 只删除这一个面板。**不要**由此推断整个图库功能已经废弃：`NoodleHome`、图库相关 Hook、服务器路由和存储层都还有实际引用。 | `pnpm check`；`pnpm smoke:ui`；手动验证 Noodle 的图片上传和图库行为。 |
| `packages/shared/src/features/turn-games/engine-utils.ts`(22 行) | 没有任何导入，没有 barrel 导出，4 个导出符号全都只在这个文件里出现。 | 直接删除文件。 | `pnpm check`；`pnpm regression`。 |

### 1.2 已废弃的 sidecar 构建脚本

`scripts/build-sidecar-runtime.mjs` 没有被任何 package 脚本、工作流、文档或源码引用。它调用的是 `pnpm exec node-llama-cpp`，而 `node-llama-cpp` 早已不在工作区依赖里。从 Git 历史看，它属于以前那条本地 Gemma sidecar 的构建路径。

**建议（高置信度）：**删除这个脚本。动手前，如果有安装包流水线配置在仓库之外，再到仓库外的发布产物里搜一遍确认。

### 1.3 根目录下已完成的实现说明文档

`MARI_PHASE2_TASK.md` 和 `MARI_PHASE3_TASK.md` 是针对具体分支写的实现指令，对应的工作现在已经进入代码库。仓库里没有任何地方引用它们，它们也不属于需要长期保留的用户文档或贡献者文档。

**建议（高置信度）：**把它们从工作区删掉，历史记录在 Git 里仍然查得到。如果其中某些设计理由仍有价值，就只把这部分理由挪进相应的架构文档，而不是继续保留任务指令本身。

### 1.4 具有误导性的零测试运行器

`packages/server/scripts/run-tests.mjs` 匹配 3 个 `.test.ts` 通配路径，但这些目录里一个测试文件都没有。执行 `pnpm --filter @marinara-engine/server test` 和根目录的 `pnpm test`，两者都会在零测试、零测试套件的情况下正常退出。原来的测试是有意删掉的，仓库规则也不允许保留 `.test.ts` 文件。

这比一般的死代码更危险：`pnpm test` 显示通过，会让人以为存在实际并不存在的测试覆盖。

**建议（高置信度）：**

1. 删除服务器的测试运行器和服务器的 `test` 脚本。
2. 保留 Windows 安装包的目录结构检查，必要时给它一个名副其实的独立脚本名。
3. 把根目录的 `test` 重新定义为跑一组有意挑选的回归和冒烟测试；或者干脆去掉这个通用别名，在文档里写明 `pnpm check`、`pnpm regression:*` 和 `pnpm smoke:ui` 才是真正的验证命令。
4. 确保 CI 不会仅凭一次零测试的调用就报告“测试通过”。

## 2. 依赖清理

除另有说明外，下面这些直接依赖在清单文件和 lockfile 之外，既没有导入，也没有注册、配置或运行时字符串引用。

| 工作区 | 依赖 | 置信度与证据 |
| --- | --- | --- |
| client | `class-variance-authority` | **高置信度。**源码和配置里都没有用到。过去的依赖清理记录也已经把它当作未使用项。 |
| client | `autoprefixer` | **高置信度，需构建验证。**没有 PostCSS 配置，也没有导入；客户端用的是 Tailwind 的 Vite 插件。 |
| server | `@earendil-works/pi-ai` | **高置信度。**Professor Mari 的运行时经过重构，已经不再依赖 Pi。仓库历史里明确写着它当时就已无人导入，留待后续清理。 |
| server | `@fastify/websocket` | **高置信度。**没有插件注册，没有 websocket 路由，也没有导入。 |
| server | `png-chunk-text` | **高置信度。**没有导入。现在的 PNG 元数据处理是直接实现的。 |
| server | `png-chunks-encode` | **高置信度。**没有导入。 |
| server | `png-chunks-extract` | **高置信度。**没有导入。 |
| shared | `chess.js` | **高置信度，需兼容性验证。**当前源码里没有导入。内置的国际象棋功能已经拆分到可选包中。删除它还需要同时删掉 `scripts/check-workspace-install.mjs` 里的对应条目，并更新那段已经过时的“缺少 `chess.js`”故障排查说明。 |

客户端的 `@rollup/wasm-node` 同样没有被引用，但它可能是特定环境下 Rollup 的兜底方案。按**中等置信度**对待：删除前先查打包和 CI 历史，并在受支持的平台上验证构建通过。

不要只凭源码里搜不到导入，就把 `workbox-window`、`pino-pretty`、根目录的 `esbuild`、类型定义包或纯命令行工具判为未使用。它们分别由生成的模块、基于字符串的传输配置、构建脚本或 package 脚本调用。

提交依赖相关的 PR 时，要更新 `pnpm-lock.yaml`，从干净的依赖状态重新安装，并跑完整的构建和检查流程。只是从已经装好的 `node_modules` 里删掉一个包，不足以作为证据。

## 3. 编译器证实的未使用代码

强制开启 TypeScript 的未使用检查后，服务器报出 **57 条诊断**，客户端报出 **3 条诊断**。这类证据比纯文本搜索得到的候选项更有力。其中大部分是导入或局部变量，可以机械删除；回调参数和公开方法的参数则要先核对调用签名。

### 3.1 客户端

- `ChatSettingsDrawer.tsx`：未使用的过滤参数 `subject`。
- `GameCombatUI.tsx`：map 回调里未使用的参数 `line`。
- `hooks/use-encounter.ts`：未使用的 `_res`；直接 await 这个请求，不要赋值。

### 3.2 服务器

- `db/file-backed-store.ts`：未使用的 `TABLES_REVERSE`；未使用的实例字段 `loadedManifest` 及其赋值。
- 路由里的导入和局部变量：`backup.routes.ts`(`dirname`)、`sprites.routes.ts`(`readdir`)、`scene.routes.ts`(`gsStorage`)、`noodle.routes.ts`(`extractNoodleMentionHandles`、`NoodleInteractionType`)，以及 `generate/dry-run-route.ts`(`lorebooksStore`)。
- 路由回调中未使用的参数：`game-assets.routes.ts`、`lorebooks.routes.ts`、`sprites.routes.ts` 和 `youtube.routes.ts`(`reply`)。只有在必须保留 Fastify 签名中的参数位置时，才改名为 `_reply`。
- `game.routes.ts`：`GmPromptContext`、`formatMoraleContext` 和 `sceneSpotifyTrackCandidateSchema`。
- `generate.routes.ts`：`readFileSync`、`LIMITS`、`AgentPhase`、`CharacterStat`、`GameState`、`createLLMProvider`、`formatZonedConversationDate`、`formatZonedConversationTime`、`chatsTable`、`normalizeCustomEmojiSelection`、`embedMemoryRecallTexts`、`latestHistoryUserContent`、`getActiveTurnGame`、`startTurnGame`、`pruneEmptyPromptWrappers`、`areConversationSchedulesEnabled`、`addEventEntry`、`normalizeAgentMaxTokens`、`resolveAgentRunInterval`，以及局部变量 `chatParams`。
- `generate/dry-run-route.ts`：无用的局部辅助函数 `wrapperMessages`。
- `services/agents/agent-executor.ts`：`sanitizeTextAgentResponse` 里未使用的参数 `agentType`；如果删掉这个参数，要同步改内部调用方。
- `services/agents/agent-pipeline.ts`：未使用的 `AgentPhase`。
- `services/conversation/schedule.service.ts`：未使用的 `createLLMProvider` 和 `ConversationStatusOverride`。
- `services/game/perception.service.ts`：未使用的 `RPGAttributes`。
- `services/generation/conversation-react-command-runtime.ts`：辅助函数里未使用的参数 `command`。
- `services/import/st-bulk.importer.ts`：未使用的 `personasTable`。
- `services/lorebook/keyword-scanner.ts`：解构出来却没用到的 `currentMessageIndex`；删除前先确认内部选项对象的结构。
- `services/lorebook/prompt-injector.ts`：未使用的 `LorebookEntry`。
- `services/mari-db/mari-db.service.ts`：无用的辅助函数 `makeEmptyValidation`。
- `services/prompt/assembler.ts`：未使用的 `PromptPreset`、`PromptSection`、`PromptGroup`、`groupOrder` 和 `chatHistoryEndIdx`。
- `services/sidecar/scene-analyzer.ts`：无用的辅助函数 `widgetUpdateHint` 和 `widgetStateSummary`。
- `services/sidecar/scene-postprocess.ts`：无用的辅助函数 `normalizeExpression`。
- `services/sidecar/sidecar-process.service.ts`：`lastReadyAt` 只被赋值，从来没有被读取。
- `services/storage/noodle.storage.ts`：未使用的 `NoodlerStageProfile`。
- `services/storage/prompts.storage.ts`：`reorderVariables` 里未使用的参数 `presetId`；改签名之前先核对调用方和存储层的排序语义。

这份清单清空之后，就在服务器和客户端的 TypeScript 配置里开启 `noUnusedLocals` 和 `noUnusedParameters`。这样这次审计才能从一次性清扫变成长期维持的约束。对于确实必须保留的回调参数，加 `_` 前缀比再次全局关闭这条规则要好。

## 4. 仓库内无人使用的内部导出

导出的声明不在普通未使用局部变量检查的范围内，所以又做了第二轮扫描，找出那些只在自己声明处出现的名字。客户端是一个应用，不是对外发布的库，因此这些都是值得删除的候选项。按领域分批删除，让编译器把与之关联的私有辅助函数和导入一并暴露出来。

### 4.1 客户端 Hook 和辅助函数

- 智能体 Hook：`useAgentConfig`、`useUpdateAgentByType`、`useToggleAgent`。
- 角色 Hook：`useUpdatePersonaGalleryClipTrim`、`useCharacterGroup`。
- 聊天和文件夹 Hook：`useReorderChats`、`useActiveChatPreset`、`useCreateChatPreset`、`useTouchChat`、`useMarkAutonomousUnread`、`useBulkSetMessagesHiddenFromAI`、`useSwipes`、`useMoveConnection`。
- 游戏相关 Hook：`useRegeneratePartyCard`、`useUpdateGameMapBinding`、`useCombatLoot`、`useLootGenerate`、`useGameJournal`、`useGameCheckpoints`、`useCreateCheckpoint`、`useLoadCheckpoint`、`useDeleteCheckpoint`。
- 触觉反馈 Hook：`useHapticStopScan`、`useHapticCommand`、`useHapticStopAll`。
- 世界书 Hook：`useLorebookEntry`、`useBulkCreateEntries`、`useSearchLorebookEntries`。
- 其他 Hook：`useCustomTool`、`useUpdateNoodleAccount`、`usePreset`、`useCreatePreset`、`usePresetGroups`、`useReorderGroups`、`usePresetSections`、`usePresetVariables`、`usePreviewPreset`、`useRegexScript`、`useUpdateSpatialContext`。
- UI 声明：`parseQteTag`、`NoodlerNotificationItem`、`LabelWithHelp`、`RESOURCE_PANEL_SORT_OPTIONS` 和 `SyncedSettings`。
- 库函数：`isManagedChatBackgroundUrl`、`isBrowserSpeechRecognitionSupported`、`requestTurnGameBotGeneration`、`resolveInputMacrosForChat`、`createCustomToolFolderPackageFilename`、`resolveCurrentGameSessionChatId`、`readTextFileFromZip` 和 `buildTTSMessageText`。

客户端某个 Hook 没人用，**并不能**说明对应的服务器接口也没人用。先删 Hook；路由要单独审计，对照界面、能力包和外部 API 兼容性来判断。

### 4.2 需要最终确认是否属于 API 或测试接缝的服务器候选项

下面这些服务器端的导出声明在仓库内同样没有使用方。多数看上去是内部实现，但导出的测试接缝和辅助函数有可能被仓库之外的工具调用，所以在维护者确认它们不属于对外支持的 API 之前，只能算中等置信度：

- 运行时和基础认证：`getServerRoot`、`getSpotifyRedirectUri`、`isAutoOpenBrowserDisabled`、`hasBasicAuthConfigured`；
- 测试接缝：`resetRateLimitBucketsForTests`、`buildKnowledgeRetrievalAgentMessagesForTest`、`splitRuntimeHandledAgentInjectionsForTest`、`__setSdkForTesting`；
- 生成和提示词辅助函数：`normalizeSecretPlotSceneDirections`、`buildUserMessageRegenerationPrompt`、`buildUserMessageRegenerationSourceMessage`、`wrapFields`、`mergeTruncation`、`modelAccessOptions`、`isStandaloneCharacterProfileBlock`、`resolveChatSummaryPromptFromMetadata`；
- 游戏相关辅助函数：`buildNpcPortraitImagePrompt`、`buildBackgroundImagePrompt`、`buildSceneIllustrationImagePrompt`、`buildSessionSummaryPrompt`、`buildCardAdjustmentPrompt`、`moraleDiceModifier`、`buildNpcRelationshipSummary`、`buildSessionCarryoverContext`、`getTurnGameContextText`；
- 世界书辅助函数：`enforceMaxActivatedEntries`、`applyPerLorebookTokenBudgets`、`resolveActivatedLorebookEntryContent`、`resolveBudgetAndRecursivelyActivateLorebookEntries`、`recursiveScan`；
- 工具函数和类型：`AgentPipelineResult`、`resolveVideoRequestDuration`、`newTimeSortableId`、`parseBoolean`、`sanitizePathFilename`。

不要把“只出现一次”这个判据不加区分地套用到 `packages/shared` 上：shared 里的导出是给客户端、服务器和可下载智能体包用的兼容性契约，其中也包括仓库之外的使用方。

## 5. 静态资源候选项

`packages/client/public/sprites/mari/Mari_point_down_left.png` 曾是随包发布的 Mari 立绘中唯一一张文件名和路径都没被仓库引用过的，已在 omnibar slice 38a 中删除。

不要靠搜文件名去清理随包发布的游戏素材。服务器的初始化脚本和清单文件会动态扫描其中一部分素材目录。

## 6. 范围可控的简化

这些属于可维护性改进，不是删死代码。每一项都必须完全保持原有行为，并配上针对性的回归验证。

### 6.1 完全或接近完全重复的业务逻辑

1. **分镜关键帧选择，低风险。**`GameSurface.tsx` 里有一份本地实现的 `findStoryboardKeyframeForSegment`，和 `lib/game-session-replay.ts` 中导出的 `findReplayStoryboardKeyframe` 一致。改用库里的这个辅助函数，删掉本地副本。
2. **Spotify 搜索词归一化，低到中等风险。**`SPOTIFY_STOP_WORDS`、`SPOTIFY_MOOD_EXPANSIONS` 以及整套扩展流程在 `game-spotify-music.service.ts` 和 `tool-executor.ts` 里各有一份。抽出一个小的 Spotify 查询词辅助函数，让两条路径不会各自漂移。
3. **PNG 角色卡元数据提取，中等风险。**`extractCharaFromPng` 在 `import.routes.ts` 和 `st-bulk.importer.ts` 里各自实现了一遍。抽成一个服务器工具函数，并用回归测试样本验证普通文本块、国际化文本块、base64 与原始负载、V2/V3 角色卡以及损坏的 PNG。
4. **教程提示框的位置计算，中等风险。**`GameTutorial.tsx` 和 `OnboardingTutorial.tsx` 里的碰撞检测和摆放逻辑是重复的。只抽出共用的几何计算部分，两个教程各自的移动端策略和产品层面的特殊规则改成显式选项保留。
5. **客户端与服务器的游戏片段编辑归一化，中到高风险。**客户端和服务器里的纯归一化逻辑很相似。只把确实与运行环境无关的 schema 和归一化函数挪进 shared，服务器的解析和持久化相关部分留在服务器。

### 6.2 大面积重复的界面代码：大范围合并暂缓

- `CharacterEditor.tsx` 和 `PersonaEditor.tsx` 里有一大段重复的立绘管理流程。
- `ChatInput.tsx` 和 `ConversationInput.tsx` 重复实现了引导式方案和输入区的行为。

合并确实有价值，但把其中任意一对整体合掉都会带来很大的回归面。一次只抽出一个完整的 Hook 或组件：编辑器先抽立绘管理，输入区先抽引导式方案的行为；每抽完一次，都要在浏览器里测试两边的调用方。

### 6.3 仍在使用的复杂度热点

当前仍在使用的最大模块是 `server/routes/game.routes.ts`、`client/components/game/GameSurface.tsx`、`client/features/chat-settings/ChatSettingsDrawer.tsx`、`server/routes/generate.routes.ts` 和 `client/components/panels/SettingsPanel.tsx`。它们不是删除对象。只在相关功能本来就要改动时，才继续把路由处理函数、领域服务、面板分区和纯辅助函数一块块抽出来。单独开一个“全面拆分”的 PR，只会制造大量改动，却拿不出可靠的行为验证。聊天设置抽屉是个例外：它以每个 PR 拆出一个分区的方式完成了拆分（#9119），目录规则见 `packages/client/.instructions.md` 的 Chat Settings 一节。

## 7. 有意排除在清理范围之外的内容

- 明确标注为在整个 2.x 系列都要保留的兼容性字段，包括图像风格、游戏状态、TTS、用户角色追踪器和 Conversation 上下文这几类兼容结构。只能在下一个大版本里通过带版本的数据迁移来删除。
- 自动生成的能力注册表和清单文件。要通过对应脚本重新生成，不要手工删减。
- 可下载的 Illustrator、Music DJ、Lorebook Keeper 等智能体包的代码。智能体自身的运行时和提示词清理应该在 `Pasta-Devs/Marinara-Agents` 里做，这个仓库只负责宿主侧的集成。
- `custom_components` 下的 Home Assistant 模块，它们的发现机制依赖命名约定和清单文件。
- `MarinaraLauncher.exe`，任务栏快捷方式的迁移代码会用到它。
- `start-local.bat`，虽然没有被任何 package 脚本引用，但它很可能仍是给人用的本地启动脚本。要先向维护者确认意图，再决定是否删除。
- 那些看起来没人引用、实际会在模块初始化或数据表注册时执行的 schema 声明。
- 仅仅因为某个方便用的 React Hook 没人调用就删服务器路由；可下载的包或 API 使用方仍可能在调用这些路由。

## 8. 建议的清理顺序

让每一步都足够简单、便于评审：

1. **PR A，遗留产物：**删除 4 个无法到达的模块、组件文档里过时的条目、已废弃的 sidecar 脚本、已完成的任务说明文档，以及经人工确认之后再删那张没用到的 Mari 立绘。
2. **PR B，让测试面貌变得诚实：**删除零测试的运行器，重命名或重新定义 package 脚本，让“命令执行成功”真正对应实际的检查。
3. **PR C，编译器层面的清理：**处理完 60 条 TypeScript 诊断，然后在客户端和服务器的配置里开启未使用项检查。
4. **PR D，依赖：**删除 8 个高置信度的包，修好工作区安装检查和故障排查说明，重新生成 lockfile，并验证干净环境下的安装与构建。
5. **PR E 及之后，按领域分批：**按领域删除没人使用的客户端导出，再逐个处理低风险的重复辅助函数。

不要把删依赖、大范围界面重构和路由拆分塞进同一个清理 PR。

## 9. 验证对照表

按改动类型选择对应的验证手段：

- 任何代码清理：`pnpm check`。
- shared 包的改动或影响面较大的服务器改动：先跑 `pnpm regression`，或者范围更窄的 `pnpm regression:<domain>`，合并前再跑一遍完整流程。
- 界面组件或 Hook 的清理：`pnpm smoke:ui`，再手动在浏览器里验证受影响的流程。
- 提示词、智能体或 Roleplay 相关代码：`pnpm regression:prompt` 和/或 `pnpm regression:roleplay`。
- 依赖清理：干净环境安装或锁定版本安装、`pnpm check`、生产构建，以及受支持平台上的 CI。
- PNG 导入逻辑的合并：直接跑导入回归测试，覆盖正常角色卡和损坏的角色卡。
- 如果意外改到了发布或版本相关文件：`pnpm version:check` 和 `pnpm credits:check`。

在这次清理之前，通用的 `pnpm test` 结果不能作为测试证据，因为它一个测试都没跑就顺利结束了。

## 10. 审计过程的验证与局限

这次审计过程中：

- 全部受版本控制的 JSON 文件都能正常解析；
- 全部 12 个受版本控制的 Python 文件都能通过 Python 的 AST 解析器解析；
- `start.sh`、`start-termux.sh` 和 `android/build-apk.sh` 都通过了 `bash -n`；
- TypeScript 的未使用项探测得到了上文记录的 57 条服务器诊断和 3 条客户端诊断；
- 直接观察到服务器和根目录的测试命令在零测试的情况下返回成功。

由于环境里没有安装 ShellCheck 和 PowerShell，本次没有做 shell 脚本的语义检查，也没有解析 PowerShell 和 Windows 脚本。Android 和 Home Assistant 相关目标只做了结构层面的检查，没有在这次审计里完整构建。这些平台相关的检查应该放到改动对应文件的清理 PR 里做。
