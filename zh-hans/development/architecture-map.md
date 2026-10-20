# 架构地图（开发者）

本指南面向参与贡献的开发者，介绍 Marinara Engine 的代码组织方式：共享基础层、功能系统、各模式的归属范围，以及每一部分代码应该放在哪里。文中还列出了当前的大文件，以及后续重构的方向。

涉及范围：`packages/client/src`、`packages/server/src` 和 `packages/shared/src`。仓库里没有常规的 `.test.ts` 测试套件，自动化验证靠纳入版本管理的回归脚本和 Playwright 冒烟用例；临时的 `.test.ts` 验证文件已被 gitignore 忽略，用完即删。

文件数、行数、路由数会随着仓库变动而变化。这份地图只给出大致规模和名称，确切数字请以当前代码树为准。

## 分区代码

规划代码搬迁、给 Issue 打标签，或者给暂时挪不动的文件加一行文件头注释时，用下面这套代码。

| 代码 | 含义 | 主要归属位置 |
| --- | --- | --- |
| `CORE-CONTRACT` | 客户端与服务器共用的类型、schema、常量和纯函数 | `packages/shared/src` |
| `CLIENT-APP` | React 应用启动、布局外壳、全局 UI 接线 | `packages/client/src/App.tsx`、`main.tsx`、`components/layout` |
| `CLIENT-SHARED` | 仅客户端使用的 UI 基础组件、通用 hook、通用浏览器辅助函数、全局 store | `packages/client/src/components/ui`、`hooks`、`lib`、`stores` |
| `SERVER-APP` | Fastify 应用启动、中间件、路由注册、运行时配置 | `packages/server/src/app.ts`、`index.ts`、`middleware`、`config` |
| `SERVER-SHARED` | 仅服务器使用的存储、数据库、LLM、提示词、世界书、导入和集成基础层 | `packages/server/src/services`、`db`、`utils`、`lib` |
| `MODE-CONVERSATION` | 仅 Conversation 用到的 UI 和服务器行为 | conversation 组件、`/api/conversation`、conversation 服务 |
| `MODE-ROLEPLAY` | Roleplay 的 UI、场景、立绘、遭遇战辅助逻辑 | roleplay 聊天组件、`/api/scene`、`/api/encounter`、`/api/sprites` |
| `MODE-GAME` | Game Mode 的 UI、GM 提示词、骰子、队伍、地图、战斗、素材、会话 | `components/game`、`/api/game`、game 服务 |
| `FEATURE-AGENTS` | 智能体定义、执行、调试状态、知识路由 | 智能体组件、智能体 store、智能体路由与服务 |
| `FEATURE-ASSETS` | 背景、头像、图库、生成的图像、立绘、游戏素材 | 素材路由、图库存储、图像服务 |
| `FEATURE-SIDECAR` | 本地模型运行时、场景分析、下载、进程控制 | sidecar store、`/api/sidecar`、sidecar 服务 |
| `FEATURE-TTS` | TTS 配置、语音路由、缓存键、音频播放 | TTS 设置、hook、路由与服务 |
| `FEATURE-IMPORT` | SillyTavern 和 Marinara 的导入器与迁移辅助逻辑 | 导入路由与服务 |
| `TEST` | 纳入版本管理的回归与浏览器冒烟覆盖，必要时再加临时验证测试 | `scripts/regressions`、`e2e`，以及用完即删的临时 `packages/server/src/**/__tests__/` 文件 |

尽量让路径本身说明它属于哪个分区。`// Section: MODE-GAME` 这样的注释只在文件还待在混杂目录里时才有意义。

## 包边界

### packages/shared

`CORE-CONTRACT`。这个包应当与运行时无关。

当前内容：

- `types`：聊天、角色、game、game state、战斗、场景、sidecar、TTS、智能体、提示词、世界书、导出、主题。
- `schemas`：持久化实体和共享实体的 Zod schema。
- `constants`：服务商、默认值、聊天模式、模型列表、智能体提示词。
- `utils`：宏展开、XML 包装、音乐评分之类的纯函数。
- `features`：智能体清单与注册表、函数调用定义、文件夹包、UNO、Chess、Poker 的回合制游戏引擎、Game Mode 规则集及其战斗（`rulesets`、`ruleset-combat`、`tactical-combat` 以及 `combat-*` 文件），还有 `world` 里的世界生成器及其分享文件（设定包、世界、地块包、棋盘包和生物包）。

规则：

- 不放 React、DOM、Fastify、服务器存储、文件系统、网络或服务商 SDK 相关代码。
- 只有当客户端和服务器需要同一份契约或同一个纯算法时，才把代码挪进来。
- 不要把 `shared` 变成客户端专用辅助函数的垃圾场。

### packages/client

React 19 加 Vite PWA，目前有好几百个源文件。

当前顶层结构：

- `App.tsx`、`main.tsx`：应用启动、React Query、PWA、全局副作用。
- `components/layout`：应用外壳、侧边栏、顶栏、窗口渲染器。
- `components/ui`：可复用的 UI 基础组件。
- `components/chat`：通用聊天、conversation、roleplay、场景、立绘、遭遇战 UI 混在一起。
- `components/game`：Game Mode 的主界面和各个面板。
- `components/panels`、`components/modals`、实体编辑器：设置与资源管理。
- `features`：已抽出的功能模块，目前包括聊天设置的各个分区、追踪器面板的组成部分、多人模式，以及虚拟形象智能体的契约、设置、舞台和渲染器（`features/avatars`）。
- `hooks`：大部分 API 功能的 React Query hook 和运行时 hook。
- `lib`：浏览器和客户端辅助函数。目前通用辅助函数和 Game Mode 专用辅助函数混在一起。
- `stores`：UI、聊天运行时、智能体、game state、game mode、素材、sidecar、翻译、图库、遭遇战和回合制游戏的 Zustand store。
- `styles`：全局样式表和各主题专用的 CSS。

当前需要注意的交叉依赖：

- `components/game` 会从 `components/chat` 引入天气、图库抽屉之类的共享视觉模块。
- `components/chat` 为了 roleplay 功能引入了 game state 和遭遇战状态。
- `hooks/use-generate.ts` 同时碰了聊天状态、智能体状态、game state、game mode 状态、翻译状态和 UI 设置。
- `lib/game-*` 系列辅助函数只服务于 Game Mode，却和全局辅助函数放在一起。

### packages/server

Fastify API、文件原生存储和服务商集成，目前有好几百个源文件。

当前顶层结构：

- `app.ts`、`index.ts`：应用工厂、启动流程、静态资源服务、文件存储水合、种子数据。
- `routes`：路由文件很多。大部分是薄薄一层 CRUD API，但 `generate.routes.ts` 和 `game.routes.ts` 是体量很大的编排文件。`routes/generate/` 文件夹里放的是目前为止从生成路径中抽出来的部分，包括 Token 输出链（`generation-stream-output.ts`）、工具调用轮次（`tool-rounds.ts`）、回复命令解析和文本清理，以及回复保存（`save-generated-reply.ts`）。
- `services/storage`：聊天、角色、提示词、世界书、设置、素材、主题、game state 的存储门面层。
- `services/llm`：服务商注册表、基础服务商契约、OpenAI 兼容服务商、本地 sidecar 桥接。
- `services/prompt`：非 Game Mode 生成路径共用的提示词组装逻辑。
- `services/conversation`：日程、自主消息、感知、conversation 个人资料、conversation 命令处理。
- `services/game`：GM 提示词、骰子、战斗、状态机、队伍提示词、地图、天气、时间、会话、检查点、声望、素材。
- `services/sidecar`：本地运行时、模型管理、场景分析、场景后处理。
- `services/agents`：智能体执行与知识路由。
- 功能基础层：`services/import`、`services/lorebook`、`services/image`、`services/haptic`、`services/tools`、`services/regex`、`services/professor-mari`、`services/mari-db`、`services/turn-games`、`services/spotify`、`services/video`、`services/generation`、`services/chat-summary`、`services/achievements`、`services/prompt-overrides`、`services/setup`、`services/noodle`、`services/memory-recall`、`services/avatars`(虚拟形象智能体的虚拟形象模型存储、生成和情绪分类器)、`speech-to-text.service.ts`，以及 `discord-webhook.ts`。
- `db/schema`：存放在 `DATA_DIR/storage` 下的数据所对应的文件表定义。
- `db/file-schema.ts`、`db/file-query.ts`：原生表元数据和查询表达式。
- `db/file-backed-store.ts`：内存表存储、事务边界、崩溃恢复和 JSON 快照持久化。参见[文件原生存储](file-storage.md)。

当前需要注意的交叉依赖：

- 路由直接引入存储、LLM、提示词、世界书、game、sidecar 和各功能服务。
- `generate.routes.ts` 既负责 Conversation 和 Roleplay 的主生成路径，也负责智能体流水线。
- `game.routes.ts` 掌管 Game Mode 的编排，同时还伸手去动 LLM、sidecar、世界书、图像、存储和 Discord webhook 的行为。
- 场景分析的代码放在 sidecar 服务里，但 Game Mode 既可以走 sidecar，也可以走选定的 LLM 连接来跑它。

## 模式归属

### 所有模式共用

以下属于全局基础层：

- 聊天与消息持久化：`packages/server/src/routes/chats.routes.ts`、`packages/server/src/services/storage/chats.storage.ts`，以及共享的聊天类型和 schema。
- 角色与用户角色：角色路由、存储、schema，以及客户端的角色 hook 和编辑器。
- 连接与服务商：连接路由、存储、共享的服务商常量，以及 `services/llm`。
- 提示词预设、世界书、正则脚本、自定义工具：共用的创作和提示词注入基础层。
- 生成传输：`packages/client/src/hooks/use-generate.ts`、`packages/server/src/routes/generate.routes.ts` 和服务商注册表。
- TTS、翻译、图库、主题、设置、导入、备份。

### Conversation 模式

主要代码：

- 客户端：`components/chat/ChatConversationSurface.tsx`、`ConversationView.tsx`、`ConversationMessage.tsx`、`ConversationInput.tsx`，以及 `ChatArea.tsx` 里的 conversation 快速开始接线。
- 客户端 hook：`use-autonomous-messaging.ts`、`use-background-autonomous.ts`。
- 服务器：`/api/conversation`、`services/conversation/*`。
- 共享元数据：`conversationSchedulesEnabled`、`characterSchedules`、`scheduleWeekStart`，以及按天和按周的摘要。

预期边界：

- Conversation 应当掌管日程、自主问候、conversation 活动状态，以及非 Roleplay 的消息展示。
- Conversation 不应该知道游戏骰子、GM 标签、快速反应事件、游戏地图或游戏战斗的存在。

### Roleplay 模式

主要代码：

- 客户端：`components/chat/ChatRoleplaySurface.tsx`、`ChatMessage.tsx`、`ChatInput.tsx`、`RoleplayHUD` 系列组件、`SpriteOverlay.tsx`、`SceneBanner.tsx`、`CyoaChoices.tsx` 和 `EncounterModal.tsx`。
- 服务器：`/api/scene`、`/api/encounter`、`/api/sprites`，以及 `/api/generate` 的一部分。
- 共享契约：`scene`、Roleplay 相关的聊天元数据字段，以及立绘摆位类型。

预期边界：

- Roleplay 应当掌管场景、立绘显示、CYOA 选项、Roleplay 的 HUD，以及 Roleplay 的遭遇战辅助流程。
- Game Mode 也会用到的共享视觉效果，应当从 `components/chat` 里挪出去。

### Game Mode

主要代码：

- 客户端：`components/game/*`、`hooks/use-game.ts`、`hooks/use-scene-analysis.ts`、`stores/game-mode.store.ts`、`stores/game-state.store.ts`、`stores/game-asset.store.ts`、`lib/game-*`、`lib/party-dialogue-parser.ts`。
- 服务器：`/api/game`、`/api/game-assets`、`services/game/*`，以及 `services/sidecar/scene-analyzer.ts` 和 `scene-postprocess.ts` 里跟 Game Mode 有关的部分。
- 共享契约：`types/game.ts`、`types/game-state.ts`、`types/combat-encounter.ts`，以及 `ChatMetadata` 里的 game 字段。

预期边界：

- Game Mode 应当掌管 GM 提示词、队伍提示词、骰子、技能检定、快速反应事件、游戏战斗、地图、旅行与休息、天气与时间、NPC 声望、游戏会话摘要、生成的游戏素材，以及游戏日志。
- Game Mode 不应该依赖聊天模式的 UI，除非走共享基础组件或明确标为共享的功能组件。

## 当前的大文件

下面这些文件最容易拖慢后续工作，因为它们把很多关注点塞进了同一个地方。行数经常变，所以这个列表只给出大致的排序和各自的关注点，不给准确体量。

| 文件 | 分区 | 关注点 |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | 共享生成与智能体 | 路由、流式输出、提示词、智能体、存储和副作用全在一个文件里。 |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | API 处理器、GM 流程、场景分析、素材、战斗和持久化耦合在一起。 |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | 渲染、状态编排、素材、日志、旁白、战斗和特效耦合在一起。 |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | 混杂的聊天设置 | 分区抽取正在 `features/chat-settings` 里推进，但这个抽屉依然很大。 |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | 展示渲染和命令格式化紧紧耦合在一起。 |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | 战斗展示、控件和日志可以拆成更小的面板和 hook。 |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | 已经通过 `RoleplayHUDActionsMenu.tsx` 和 `RoleplayHUDPanels.tsx` 拆掉了一部分。 |

## 目标结构

这是后续重构的方向，不要求一次性全部搬完。

### 客户端目标结构

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### 服务器目标结构

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### 共享包目标结构

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

过去那套扁平的 `types`、`schemas`、`constants` 布局已经不能概括全部了。`packages/shared/src/features/` 现在还装着智能体、函数调用、文件夹包、回合制游戏、规则集和战斗，以及世界生成器。共享包的第一轮清理仍然应该停留在类型层面、小步推进，不要搞大规模文件搬迁。

## 迁移规则

1. 新代码放进最窄的那个正确分区。
2. 如果两个及以上模式都在用某个客户端组件，先把它挪到 `CLIENT-SHARED`，再往上加模式专属行为。
3. 如果客户端和服务器都需要某个类型、schema 或纯函数，把它挪到 `CORE-CONTRACT`。
4. 如果只有服务器需要，就别往 `packages/shared` 里放。
5. 路由文件只负责校验 HTTP 输入并调用服务，领域决策要下沉到服务里。
6. store 要么是全局的（`ui`、`chat`、`sidecar`），要么是模式专属的（`game-mode`、`encounter`）。避免一个 store 悄悄同时管着好几个模式。
7. 元数据应当按 `ChatMode` 做可辨识联合：基础元数据加上 conversation、roleplay 和 game 各自的字段。
8. 一次只搬一个功能。如果某条引入路径改动面太广，会在整个仓库里掀起大片改动，那就留下兼容导出或包装层。
9. 每搬完一次，跑一遍 lint：

   ```bash
   pnpm lint
   ```

   然后对改动过的文件做一次针对性的 Prettier 检查。

## 优先考虑的重构

以下几项适合作为首轮清理，因为它们能在不改变行为的前提下降低耦合。

1. 把 `components/chat` 拆成通用、conversation 和 roleplay 三组。
   - 通用候选：`ChatCommonOverlays`、`ChatBranchSelector`、`ChatGalleryDrawer`、`WeatherEffects`，以及共享的消息和输入基础组件。
   - Conversation 候选：`ChatConversationSurface`、`ConversationView`、`ConversationMessage`、`ConversationInput`。
   - Roleplay 候选：`ChatRoleplaySurface`、`SpriteOverlay`、`SceneBanner`、`CyoaChoices`、`EncounterModal`。Roleplay 的 HUD 已经在 `RoleplayHUDActionsMenu.tsx` 和 `RoleplayHUDPanels.tsx` 里拆掉了一部分。
2. 把只服务于 Game Mode 的客户端辅助函数挪到 game 模块下。
   - 候选：`game-audio`、`game-tag-parser`、`game-full-body-pose`、`game-character-name-match`、`game-segment-edits`、`party-dialogue-parser`。
3. 把 `GameSurface.tsx` 拆成运行时 hook 和更小的容器组件。
   - 候选 hook：旁白运行时、素材运行时、场景分析运行时、战斗运行时、日志与历史运行时、音频运行时。
4. 把 `GameNarration.tsx` 拆成命令解析与格式化，再加上展示组件。
5. 按处理器分组拆分 `game.routes.ts`。
   - 候选分组：初始化与会话，回合生成，骰子、技能与快速反应事件，日志与物品栏，地图、旅行与天气，战斗，素材与场景分析。
6. 把 `generate.routes.ts` 拆成生成传输、智能体流水线处理、重试路由，以及命令与后处理辅助逻辑。Issue #7573 已经开始做这件事：Token 输出链、工具轮次、回复命令、回复文本清理、已保存消息的生成信息、隐藏的命令锚点和回复保存，现在都放在 `routes/generate/` 里，各自带有回归测试。
7. 把 `ChatMetadata` 拆成各模式专属的元数据契约。
8. 趁 Game Mode 还没引入更多聊天内部实现，先把共享的 Roleplay 和 Game Mode 视觉模块从 `components/chat` 里挪出去。

## 实际动手顺序

下一个清理 PR 建议按这个顺序来：

1. 只为一个区域创建目标目录。
2. 先搬纯函数。
3. 再搬叶子组件。
4. 大编排文件先原地留着，等它的引入大多指向新模块了再动。
5. 只在引入路径的大片改动会喧宾夺主时，才添加兼容再导出。
6. 跑一遍 lint：

   ```bash
   pnpm lint
   ```

   然后对改动过的文件做针对性的 Prettier 检查。

## 相关指南

- [前端架构（开发者向）](frontend.md)
- [文件原生存储](file-storage.md)
