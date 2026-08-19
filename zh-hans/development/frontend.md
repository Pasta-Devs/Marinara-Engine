# 前端架构（开发者向）

这是面向开发者的材料，不是终端使用指南，讲的是 Marinara Engine 客户端怎么搭起来的：React 应用结构、Zustand store、React Query hook、主要组件，以及服务器 API 全景图。只想上手用这个应用的话，直接看用户指南。

## 概览

Marinara Engine 是一个 AI 聊天应用，提供 Conversation(对话模式)、Roleplay(角色扮演) 和 Game(游戏) 三种模式。客户端是 React 19 单页应用，由 Vite 提供服务，用 Tailwind CSS v4 做样式，并打包成渐进式 Web 应用（PWA）。

客户端代码在 `packages/client`。它通过 REST 和 Server-Sent Events(SSE) 与 Fastify API 服务器（`packages/server`）通信。共享的数据契约（类型、Zod schema、常量）放在 `packages/shared`，两端都会导入。

## 应用架构

### 三栏布局

界面采用 Discord 风格的三栏设计，由 `components/layout/AppShell.tsx` 管理：

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- 左侧边栏（`components/layout/ChatSidebar.tsx`）：聊天列表，按文件夹组织，可按模式（Conversation、Roleplay、Game）筛选。
- 中间区域：要么是当前聊天界面，要么是某个完整编辑器（角色、世界书、预设等）。同一时刻只显示一个，编辑器会顶掉聊天区域。
- 右侧面板（`components/layout/RightPanel.tsx`）：资源浏览器和设置，从顶栏切换。面板一旦挂载就留在 DOM 里（用 CSS 隐藏），以保住滚动位置和本地状态。
- 顶栏（`components/layout/TopBar.tsx`）：每个右侧面板的快速切换按钮。

### 导航

导航由状态驱动，没有 URL 路由。渲染什么由 `stores/ui.store.ts` 这个 Zustand store 决定：

| 导航目标 | Store 字段 | 触发函数 |
| ---------------------- | -------------------- | ------------------------------------------------- |
| 打开角色编辑器 | `characterDetailId` | `openCharacterDetail(id)` |
| 打开世界书编辑器 | `lorebookDetailId` | `openLorebookDetail(id)` |
| 打开预设编辑器 | `presetDetailId` | `openPresetDetail(id)` |
| 打开连接编辑器 | `connectionDetailId` | `openConnectionDetail(id)` |
| 打开智能体编辑器 | `agentDetailId` | `openAgentDetail(id)` |
| 打开用户角色编辑器 | `personaDetailId` | `openPersonaDetail(id)` |
| 切换右侧面板 | `rightPanel` | `openRightPanel(name)` / `toggleRightPanel(name)` |
| 打开窗口 | `modal` | `openModal(type, props?)` |

### 代码分割

主要编辑器和重量级组件在 `AppShell.tsx` 里用 `React.lazy()` 配合 `Suspense` 懒加载，这样初始包体积能保持很小（见下文的打包体积预算）。

## 状态管理

### Zustand store(客户端状态)

客户端在 `packages/client/src/stores/` 下放了一组 Zustand store，用来管理界面和运行时状态。只有 `ui.store.ts` 会持久化，其余保存的是聊天、智能体、游戏、本地模型运行时、翻译、窗口、回填和桌面游戏的运行时状态。

现有的 store 文件有：`agent.store.ts`、`backfill.store.ts`、`chat.store.ts`、`chess-game.store.ts`、`dialog.store.ts`、`encounter.store.ts`、`gallery.store.ts`、`game-asset.store.ts`、`game-mode.store.ts`、`game-state.store.ts`、`poker-game.store.ts`、`sidecar.store.ts`、`translation.store.ts`、`ui.store.ts` 和 `uno-game.store.ts`。

#### `ui.store.ts`：设置与界面外壳

唯一持久化的 store(通过 Zustand 的 `persist` 中间件写入 localStorage)。它保存：

- 主题：`visualTheme`(“default”或“sillytavern”)、`data-theme` 的值（dark 或 light），以及自定义配色覆盖。
- 外观：`fontSize`、`chatFontSize`、`fontFamily`、自定义字体和光标样式。
- 聊天显示：`boldDialogue`、`showTimestamps`、`showModelName` 和 `messagesPerPage`。
- 文字样式：聊天文字颜色、Roleplay 消息背景不透明度和文字描边。
- 流式输出：`enableStreaming` 和 `streamingSpeed`。
- Conversation 主题：消息气泡的渐变色。
- 声音：`convoNotificationSound` 和 `rpNotificationSound`。
- 行为：`confirmBeforeDelete`、`enterToSendRP`、`enterToSendConvo`、`weatherEffects` 和 `guideGenerations`。
- 导航：`rightPanel`、`rightPanelOpen`、`sidebarOpen`、`settingsTab`、全部 `*DetailId` 字段和 `modal`。

同步的自定义主题不存在 `ui.store.ts` 里，而是通过 React Query 从服务器拉取，并在连到同一个 Marinara 实例的各台设备之间镜像。

#### `chat.store.ts`：聊天运行时

不持久化，跟踪当前聊天会话：

- `activeChatId`：当前显示的是哪个聊天。
- `messages`：当前的消息数组。
- `isStreaming`、`streamBuffer`：正在进行的生成。
- `inputDrafts`：每个聊天各自的草稿消息。
- `currentInput`：聊天输入框的当前内容。
- `perChatTyping`：正在输入指示器的状态。
- `unreadCounts`、`chatNotifications`：通知角标。
- `abortControllers`：取消进行中的生成。

#### `agent.store.ts`：智能体执行

跟踪生成过程中和生成之后的智能体流水线状态：

- `activeAgents`：正在运行的智能体。
- `thoughtBubbles`：实时显示的智能体思考过程。
- `echoMessages`：echo chamber(模拟观众聊天)。
- `cyoaChoices`：分支选项界面。
- `debugLog`：性能指标和 Token 用量。
- `failedAgentTypes`：出错的智能体（用于重试界面）。

#### `game-state.store.ts`：RPG 伴生数据

保存 Roleplay 模式的场景和世界上下文：

- `current`(GameState)：日期、时间、地点、天气、在场角色、事件、玩家属性、任务和物品栏。
- `isVisible`、`expandedSections`：HUD(聊天上方的信息条) 的显示状态。

#### `encounter.store.ts`：战斗系统

回合制战斗状态：

- `active`：是否正在进行遭遇战。
- `party`、`enemies`：参战方，含 HP、攻击和状态。
- `environment`：场地细节。
- `playerActions`、`encounterLog`：行动队列和历史。
- `combatResult`：胜利、失败、逃跑或中断。

#### `gallery.store.ts`：图片浮层

- `pinnedImages`：以浮层形式钉在聊天区域上的图片。

### React Query(服务器数据)

所有服务器数据都通过 TanStack React Query 获取和缓存，配置写在 `main.tsx`：

- Stale time：30 秒（全局默认）。
- 重试：1 次。
- 窗口聚焦时重新获取：关闭。
- 缓存：仅存在内存里，不做持久化。

每类实体都有专门的 hook 文件，导出查询 hook 和变更 hook。

## Hook 参考

所有 hook 都放在 `src/hooks/`，命名遵循 `use-{entity}.ts`。

### 聊天 hook(`use-chats.ts`)

| Hook | 类型 | 说明 |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()` | Query | 全部聊天 |
| `useChat(id)` | Query | 按 ID 取单个聊天 |
| `useChatMessages(chatId, perPage)` | Infinite Query | 某个聊天的分页消息 |
| `useChatGroup(groupId)` | Query | 聊天分组 |
| `useCreateChat()` | Mutation | 新建聊天 |
| `useDeleteChat()` | Mutation | 删除聊天 |
| `useUpdateChatMetadata()` | Mutation | 更新聊天元数据（智能体、立绘等） |
| `useBranchChat()` | Mutation | 从指定消息处分支出新聊天 |
| `useUpdateMessage()` | Mutation | 编辑消息内容（乐观更新） |
| `useDeleteMessage()` | Mutation | 删除单条消息 |
| `useDeleteMessages()` | Mutation | 删除多条消息 |
| `useSetActiveSwipe()` | Mutation | 切换到另一条备选回复 |
| `usePeekPrompt()` | Mutation | 预览拼装好的提示词 |
| `useClearAllData()` | Mutation | 删除全部数据（破坏性操作） |

### 角色 hook(`use-characters.ts`)

| Hook | 类型 | 说明 |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()` | Query | 全部角色 |
| `useCharacter(id)` | Query | 单个角色，附解析后的角色卡数据 |
| `useCreateCharacter()` | Mutation | 创建角色 |
| `useUpdateCharacter()` | Mutation | 更新角色卡数据 |
| `useDeleteCharacter()` | Mutation | 删除角色 |
| `useUploadAvatar()` | Mutation | 上传头像图片 |
| `usePersonas()` | Query | 全部用户角色 |
| `usePersona(id)` | Query | 单个用户角色 |
| `useCreatePersona()` | Mutation | 创建用户角色 |
| `useUpdatePersona()` | Mutation | 更新用户角色 |
| `useDeletePersona()` | Mutation | 删除用户角色 |
| `useCharacterGroups()` | Query | 角色分组 |
| `usePersonaGroups()` | Query | 用户角色分组 |

### 预设 hook(`use-presets.ts`)

| Hook | 类型 | 说明 |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()` | Query | 全部预设 |
| `usePreset(id)` | Query | 单个预设 |
| `usePresetFull(id)` | Query | 预设及其段落、分组和选项 |
| `useDefaultPreset()` | Query | 默认预设 |
| `useCreatePreset()` | Mutation | 创建预设 |
| `useUpdatePreset()` | Mutation | 更新预设 |
| `useDeletePreset()` | Mutation | 删除预设 |
| `usePresetSections(presetId)` | Query | 某个预设的提示词段落 |
| `usePresetGroups(presetId)` | Query | 段落分组 |
| `usePresetVariables(presetId)` | Query | 预设变量（原来的 choice block） |
| `usePreviewPreset()` | Mutation | 针对 `{ presetId, chatId, choices }` 渲染提示词预览 |

### 智能体 hook(`use-agents.ts`)

| Hook | 类型 | 说明 |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()` | Query | 全部智能体配置 |
| `useAgentConfig(id)` | Query | 单个智能体配置 |
| `useCreateAgent()` | Mutation | 创建自定义智能体 |
| `useUpdateAgent()` | Mutation | 更新智能体配置 |
| `useDeleteAgent()` | Mutation | 删除智能体 |
| `useToggleAgent()` | Mutation | 开启或关闭内置智能体 |

### 生成 hook(`use-generate.ts`)

最复杂的一个 hook，返回 `{ generate, retryAgents }`。

`generate(params)` 接收一个选项对象，字段包括 `chatId`、`connectionId`、`userMessage`、`regenerateMessageId`、`continueMessageId`、`impersonate` 和 `attachments`。如果该聊天已有生成在进行中，它返回 `false`。流程如下：

1. 在 `chat.store.ts` 里设置流式输出状态。
2. 把生成请求发到 `/api/generate`。
3. 解析 SSE 事件，例如 `token`、`agent_start`、`agent_result`、`agent_error`、`thinking`、`tool_call`、`game_state`、`game_state_patch`、`text_rewrite`、`scene_created`、`done` 和 `error`。
4. 用新消息更新 React Query 缓存。
5. 把思考气泡和调试信息写进智能体 store。
6. 用 toast 通知处理错误。

### 其他 hook

`src/hooks/` 文件夹里还有很多针对具体功能的 hook。举一些有代表性的：

| 文件 | 用途 |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts` | API 连接的增删改查和测试 |
| `use-lorebooks.ts` | 世界书和条目的增删改查 |
| `use-scene.ts` | 场景的规划、创建和收尾 |
| `use-encounter.ts` | 遭遇战的初始化、行动和摘要 |
| `use-autonomous-messaging.ts` | 自主消息的轮询和排期 |
| `use-idle-detection.ts` | 10 分钟无操作检测 |
| `use-background-autonomous.ts` | 对非活跃聊天的后台轮询 |
| `use-translate.ts` | 文本翻译 |
| `use-apply-regex.ts` | 对消息执行正则脚本 |
| `use-custom-tools.ts` | 自定义工具的增删改查 |
| `use-knowledge-sources.ts` | 知识源管理 |
| `use-gallery.ts` | 聊天图库图片 |
| `use-chat-folders.ts` | 聊天文件夹的增删改查和排序 |
| `use-regex-scripts.ts` | 正则脚本的增删改查 |
| `use-haptic.ts` | 触觉设备的连接和指令 |

## 组件指南

### 聊天系统（`components/chat/`）

聊天系统是最大的功能区。`ChatArea.tsx` 懒加载三个渲染界面：Conversation、Roleplay 和 Game Mode。

#### Conversation 模式（`ChatConversationSurface.tsx`）

即时通讯风格的聊天气泡，用户消息在右，assistant 在左。功能包括：

- 无限滚动分页（往上滚就加载更早的消息）。
- 单条消息的操作：编辑、复制、重新生成、删除、分支、查看提示词。
- 支持附件（图片和文件）。
- 表情和 GIF 选择器。
- 斜杠命令。
- 新消息的提示音。
- 每个聊天各自保留草稿。

#### Roleplay 模式（`ChatRoleplaySurface.tsx`）

暗色、沉浸式的 RPG 风格界面。Conversation 的功能它全都有，另外还有：

- 角色立绘，表情由表情智能体驱动切换。
- Roleplay HUD，显示世界状态（时间、地点、天气、在场角色）。
- 天气特效（与场景天气匹配的粒子浮层）。
- echo chamber 面板（模拟观众反应）。
- 带回合制行动系统的遭遇战。
- 显示已激活世界书条目的世界书信息面板。
- 用于分支迷你角色扮演的场景系统。
- 带交叉淡入淡出过渡的背景图。

#### Game Mode(`GameSurface.tsx`)

AI 游戏主持人（GM）界面。它不在 chat 文件夹里，而是位于 `components/game/GameSurface.tsx`。当聊天模式为 `game` 时，`ChatArea.tsx` 会渲染它。它读取专用的游戏 store(`game-mode.store.ts`、`game-asset.store.ts`、`game-state.store.ts`)，并通过 `use-game.ts` 和 `use-game-storyboards.ts` 里的 hook 驱动会话、掷骰、技能检定、地图和回合分镜。

#### 关键组件

- `ChatArea.tsx`：中枢调度者。它获取全部数据（消息、角色、用户角色），构建角色映射表，判定聊天模式，然后渲染对应界面。
- `ChatMessage.tsx`：渲染单条消息，含 Markdown、备选回复导航、编辑和操作菜单。它使用非受控的 `EditTextarea` 子组件，避免编辑过程中反复重渲染。
- `ChatInput.tsx`：用户输入，含自动调整高度、草稿保留、斜杠命令补全、附件处理，以及表情或 GIF 插入。

### 编辑器组件

每类资源都有一个整页编辑器，会顶掉聊天区域：

| 编辑器 | 文件 | 管理内容 |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| 角色编辑器 | `components/characters/CharacterEditor.tsx` | 角色卡字段、头像、开场白、性格、系统提示词、元数据 |
| 世界书编辑器 | `components/lorebooks/LorebookEditor.tsx` | 世界书元数据，以及带关键词、激活规则和注入设置的条目 |
| 预设编辑器 | `components/presets/PresetEditor.tsx` | 提示词段落、分组、标记、生成参数、choice block |
| 连接编辑器 | `components/connections/ConnectionEditor.tsx` | API 服务商、基础 URL、模型、上下文窗口、各种开关 |
| 智能体编辑器 | `components/agents/AgentEditor.tsx` | 智能体提示词模板、阶段、连接、工具、设置 |
| 用户角色编辑器 | `components/personas/PersonaEditor.tsx` | 用户角色的名称、描述、属性、头像 |

### 窗口系统（`components/modals/`）

窗口由 `components/layout/ModalRenderer.tsx` 渲染。它读取 `ui.store.modal`，在 `Suspense` 内渲染对应组件。窗口组件都放在 `components/modals/` 下。

现有的窗口类型包括（下表只是举例，并非全部）：

| 类型 | 组件 | 用途 |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character` | `CreateCharacterModal` | 快速创建角色（名称和头像） |
| `create-connection` | `CreateConnectionModal` | 快速创建连接 |
| `create-persona` | `CreatePersonaModal` | 快速创建用户角色 |
| `create-lorebook` | `CreateLorebookModal` | 快速创建世界书 |
| `create-preset` | `CreatePresetModal` | 快速创建预设 |
| `import-character` | `ImportCharacterModal` | 从文件导入（JSON 或 PNG） |
| `import-connection` | `ImportConnectionModal` | 导入连接包 |
| `import-lorebook` | `ImportLorebookModal` | 从文件导入 |
| `import-preset` | `ImportPresetModal` | 从文件导入 |
| `import-persona` | `ImportPersonaModal` | 从文件导入 |
| `character-card-update` | `CharacterCardUpdateModal` | 审阅智能体提议的角色卡演进 |
| `agent-write-approval` | `AgentWriteApprovalModal` | 智能体写入的授权与审阅 |
| `docs-viewer` | `DocsViewerModal` | 应用内文档浏览器 |
| `st-bulk-import` | `STBulkImportModal` | 批量导入 SillyTavern 数据 |
| `about-me-viewer` | `AboutMeViewerModal` | 查看 Conversation 模式的 About Me |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | 场景提示词偏好设置 |

窗口的通用写法：所有窗口都接收 `{ open, onClose }`，把内容包在 `Modal` 基础组件里，用 mutation 调 API，并根据 `mutation.isPending` 显示加载状态。

### 面板系统（`components/panels/`）

右侧面板展示资源列表，支持搜索、排序和筛选。点击某个资源，会在中间区域打开它的完整编辑器。

面板要在 `RightPanel.tsx` 里两个地方注册：

1. `PANEL_CONFIG`：标题、图标和渐变色。
2. `PANELS`：组件映射表。

面板采用模块级持久化。一个 `mountedPanels` Set 记录哪些面板被访问过。面板一旦挂载就留在 DOM 里（用 `display: none` 或 `aria-hidden` 隐藏），以保住状态。

### UI 基础组件（`components/ui/`）

| 组件 | 说明 |
| ------------------ | --------------------------------------------------------------------- |
| `Modal` | 基础窗口，支持点击遮罩关闭、Esc 关闭、进出场动画 |
| `ColorPicker` | 纯色或渐变选择器，带预设色板 |
| `ExpandedTextarea` | 全屏 portal 浮层，用于编辑大段文本 |
| `EmojiPicker` | 可搜索的表情弹出框（portal 渲染） |
| `GifPicker` | 通过 Giphy API 搜索 GIF |
| `HelpTooltip` | 悬停图标，显示由 portal 定位的提示气泡 |

所有 UI 组件都使用受控属性（value 加 onChange），浮层一律用 portal 渲染。

## API 客户端（`lib/api-client.ts`）

所有与服务器的通信都走 `api` 对象：

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| 方法 | 签名 | 说明 |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)` | `GET /api{path}` | 获取 JSON |
| `api.post<T>(path, body)` | `POST /api{path}` | 发送 JSON，接收 JSON |
| `api.put<T>(path, body)` | `PUT /api{path}` | 全量更新 |
| `api.patch<T>(path, body)` | `PATCH /api{path}` | 部分更新 |
| `api.delete(path)` | `DELETE /api{path}` | 删除资源 |
| `api.upload(path, FormData)` | `POST /api{path}` | Multipart 文件上传 |
| `api.download(path, filename)` | `GET /api{path}` | 下载并弹出另存为窗口 |
| `api.stream(path, body)` | `POST /api{path}` | SSE 异步生成器（只有 token） |
| `api.streamEvents(path, body)` | `POST /api{path}` | SSE 异步生成器（全部事件类型） |

出错时抛出 `ApiError`，它带有 `status` 和 `message` 属性。

## 样式系统

### Tailwind CSS v4

项目使用 Tailwind CSS v4 和 `@tailwindcss/vite` 插件（不需要 PostCSS 配置）。主题 token 从 `globals.css` 里的 CSS 自定义属性映射而来：

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### 主题架构

`globals.css` 按带标签的段落组织，其中包括 Tailwind 的 `@theme` 映射、暗色主题变量、亮色主题覆盖、基础重置、自定义光标、滚动条、玻璃面板、发光工具类、UI 组件和关键帧动画。其余段落涵盖聊天动画、分模式的聊天样式、立绘和游戏 HUD、函数调用卡片、响应式规则、导入的 SillyTavern 主题、无障碍规则和性能提示。

### 自定义主题

自定义主题可以自己做。主题定义存在 Marinara 服务器上，并在已连接的各台设备之间同步，当前启用的自定义主题也一并共享。CSS 由 `CustomThemeInjector.tsx` 以 `style` 标签的形式注入。

同步的主题 CSS 可以用 `--marinara-theme-accent-pulse: enabled` 调用内置的 Accent Pulse 引擎。如果希望脉冲效果使用某个指定的主题强调色，而不是当前 Appearance 里的强调色，再加上 `--marinara-theme-accent-pulse-source: #a78bfa`(也可以是渐变)。

### Personal Extensions

Personal Extensions(个人扩展) 是存在服务器上、按精确哈希审批的沙箱代码。Addons 界面使用 `use-personal-extensions.ts`；`PersonalExtensionInjector.tsx` 把已审批的 Browser 代码托管在一个专用 Worker 中，该 Worker 位于不透明来源的沙箱 iframe 内，并由它中转不可变的当前聊天上下文快照。上下文字段始终存在；不在活动聊天中时，`chatId` 和 `characterId` 为 `null`，`characterIds` 为空。要访问当前角色卡和所选用户角色的受限字段，需要单独声明、且与哈希绑定的权限。服务器端扩展在独立的 Node 进程里运行，外面套 macOS Seatbelt 或 Linux Bubblewrap；两种后端都不可用时直接拒绝运行。使用外部来源需要开启 `.env` 门禁，并在列出、审批和运行三个边界上都完成 Danger Zone 的确认。

改动这个功能之前请先看[个人扩展架构](personal-extensions.md)。

## 共享包（`packages/shared`）

前端从 `@marinara-engine/shared` 导入类型、schema 和常量。

### 常量

`packages/shared/src/constants/` 里的关键文件：

- `defaults.ts`：导出 `APP_VERSION`、`PROFESSOR_MARI_ID`、`DEFAULT_CONNECTION_ID`、`DEFAULT_GENERATION_PARAMS`、`MAX_FILE_SIZES` 和 `LIMITS` 等。版本号以这里为准，默认生成设置也在这里。
- `providers.ts`：导出 `PROVIDERS`，即各 API 服务商的配置（OpenAI、Anthropic、Google 等），含 URL 和鉴权方式。
- `model-lists.ts`：各服务商的静态模型目录，另有用于图像生成服务商的 `IMAGE_GENERATION_SOURCES`。
- `agent-prompts.ts`：仅基础版的摘要提示词和 secret plot 提示词，以及对已安装智能体包所提供提示词的运行时查找。

### Schema(Zod)

所有输入校验都使用 `packages/shared/src/schemas/` 下的 Zod schema。代表性文件：

| Schema 文件 | 涵盖实体 |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts` | AgentConfig 的创建与更新、智能体阶段、结果类型 |
| `character.schema.ts` | 角色卡、兼容性元数据、character book、分组 |
| `chat.schema.ts` | 聊天创建、消息创建、生成请求 |
| `connection.schema.ts` | API 连接的创建与更新 |
| `custom-tool.schema.ts` | 自定义工具定义 |
| `lorebook.schema.ts` | 世界书与条目的创建/更新、激活条件、日程 |
| `prompt.schema.ts` | 预设、段落、分组、choice block、生成参数 |
| `regex.schema.ts` | 正则脚本的创建与更新 |
| `personal-extension.schema.ts` | Personal Extension 的草稿、精确哈希审批、回滚和私有存储 |

这个文件夹里还有应用设置、聊天设置方案、Conversation 通话、自定义表情和贴纸、Noodle 以及主题的 schema。

### 类型

实体类型定义放在 `packages/shared/src/types/`。挑几个关键文件：

| 类型文件 | 主要接口 |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts` | `AgentConfig`、`AgentResult`、`AgentContext`、`ToolDefinition`、`ToolCall`、`ToolResult`、`BUILT_IN_AGENTS` |
| `character.ts` | `Character`、`CharacterCardV2`、`CharacterData`、`RPGStatsConfig` |
| `chat.ts` | `Chat`、`ChatMetadata`、`Message`、`MessageExtra`、`GenerationInfo`、`StreamEvent` |
| `connection.ts` | `APIConnection`、`ModelInfo`、`ModelCapabilities`、`ConnectionTestResult` |
| `combat-encounter.ts` | `CombatPartyMember`、`CombatEnemy`、`CombatActionResult`、`EncounterSettings` |
| `game-state.ts` | `GameState`、`PresentCharacter`、`PlayerStats`、`QuestProgress`、`InventoryItem` |
| `lorebook.ts` | `Lorebook`、`LorebookEntry`、`ActivationCondition`、`LorebookSchedule`、`QuestData` |
| `persona.ts` | `Persona`、`PersonaStatsConfig` |
| `personal-extension.ts` | `PersonalExtension`、运行时元数据、修订版本、来源和服务器运行时状态 |
| `prompt.ts` | `PromptPreset`、`PromptSection`、`PromptGroup`、`ChoiceBlock`、`GenerationParameters` |
| `scene.ts` | `SceneMeta`、`SceneFullPlan` |
| `haptic.ts` | `HapticDevice`、`HapticStatus`、`HapticDeviceCommand` |

### 工具函数

| 文件 | 用途 |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`：替换 `{{date}}`、`{{char}}`、`{{random}}`、`{{roll:2d6}}`、`{{getvar::name}}` 等宏 |
| `xml-wrapper.ts` | `nameToXmlTag()`：把显示名转成 XML 标签 slug(“World Info (Before)”变成“world_info_before”) |

## API 端点

服务器（`packages/server`）在 `/api` 下暴露 REST API。下面是高层次的全景图，不是完整清单。以 `packages/server/src/routes/index.ts` 和各个路由文件为准。

### 核心资源

| 前缀 | 方法 | 说明 |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters` | GET, POST, PATCH, DELETE | 角色的增删改查、分组、导出（JSON 或 PNG） |
| `/api/chats` | GET, POST, PATCH, DELETE | 聊天的增删改查、消息、元数据、连接与断开 |
| `/api/prompts` | GET, POST, PATCH, DELETE | 预设的增删改查、段落、分组、choice block、导出 |
| `/api/connections` | GET, POST, PATCH, DELETE | API 连接的增删改查、复制、测试 |
| `/api/agents` | GET, POST, PATCH, DELETE | 智能体的增删改查、echo 消息、运行记录；内置智能体的开关走 `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks` | GET, POST, PATCH, DELETE | 世界书的增删改查、条目、导出 |
| `/api/custom-tools` | GET, POST, PATCH, DELETE | 自定义工具的增删改查 |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | 正则脚本的增删改查 |

智能体的记忆工具走 `/api/agents/memory/:agentType/:chatId`，其中 `agentType` 是智能体类型字符串，`chatId` 是目标聊天的 id。

### 生成

| 端点 | 方法 | 说明 |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate` | POST | 主生成入口，SSE，带智能体流水线 |
| `/api/generate/retry-agents` | POST | 按调用方传入的智能体类型重试，SSE |

### 聊天功能

| 前缀 | 端点 | 说明 |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders` | 增删改查加重新排序 | 聊天文件夹管理 |
| `/api/conversation` | schedule, status, message, check | 自主消息系统 |
| `/api/scene` | create, plan, conclude | 场景分支 |
| `/api/encounter` | init, action, summary | 遭遇战 |
| `/api/translate` | POST | 文本翻译 |
| `/api/game` | 增删改查和各类动作 | Game Mode 的会话与状态 |
| `/api/game-assets` | 增删改查和上传 | 游戏素材 |
| `/api/turn-games` | Chess、UNO、Poker 路由 | Conversation 桌面游戏 |
| `/api/conversation-calls` | 通话和会话路由 | Conversation 语音通话 |

### 媒体与素材

| 前缀 | 说明 |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | 头像图片服务 |
| `/api/backgrounds` | 背景的增删改查和上传 |
| `/api/sprites/:characterId` | 立绘表情管理 |
| `/api/fonts` | 自定义字体管理 |
| `/api/gallery/:chatId` | 单个聊天的图库图片 |
| `/api/global-gallery` | 全局图库图片 |
| `/api/tts` | 语音合成路由 |
| `/api/youtube` | YouTube DJ 路由 |
| `/api/custom-emojis` | 自定义表情素材 |
| `/api/custom-stickers` | 自定义贴纸素材 |
| `/api/gifs/search` | GIF 搜索（Giphy 代理） |

### 外部集成

| 前缀 | 说明 |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*` | Chub 角色搜索 |
| `/api/bot-browser/chartavern/*` | CharacterTavern 搜索 |
| `/api/bot-browser/janny/*` | JannyAI 搜索 |
| `/api/bot-browser/pygmalion/*` | Pygmalion 搜索 |
| `/api/bot-browser/wyvern/*` | Wyvern 搜索 |
| `/api/bot-browser/datacat/*` | DataCat 搜索 |
| `/api/haptic/*` | 触觉设备控制 |
| `/api/spotify/*` | Spotify 鉴权 |
| `/api/knowledge-sources` | 用于检索的知识库 |

### 系统

| 端点 | 说明 |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check` | 对照 GitHub release 检查版本 |
| `/api/updates/latest` | 最新发布的元数据 |
| `/api/updates/commits-behind` | Git 安装方式落后的提交数 |
| `/api/backup` | 完整备份、导出、导入 |
| `/api/import/*` | SillyTavern 和 Marinara 档案导入 |
| `/api/admin/clear-all` | 清空全部数据 |
| `/api/themes` | 同步的自定义主题 |
| `/api/personal-extensions` | 沙箱扩展的策略、草稿、审批、运行时和私有存储 |
| `/api/app-settings` | 服务器端应用设置 |
| `/api/sidecar` | 本地模型运行时 |
| `/api/chat-presets` | 聊天设置方案（端点名沿用历史叫法） |
| `/api/connection-folders` | 连接文件夹 |
| `/api/prompt-overrides` | 内置提示词覆盖 |
| `/api/achievements` | 成就解锁 |
| `/api/noodle` | Noodle 社交时间线 |
| `/api/professor-mari/workspace` | Professor Mari 工作区操作 |

## PWA 支持

这个应用是用 VitePWA 配置的渐进式 Web 应用：

- Manifest：`public/manifest.json`，应用名为“Marinara Engine”，显示模式为 standalone，暗色主题。
- 图标：64px 的 favicon、192px 和 512px 的 maskable 图标，以及一张启动画面 logo。
- Service worker：Workbox，采用自动更新策略。
- 缓存：静态资源会缓存；`/api/*` 路由使用 NetworkOnly。
- 保活：`lib/keep-alive.ts` 用 Web Locks API 加 BroadcastChannel 心跳，防止选项卡休眠。

### 版本错位检测

`App.tsx` 每 5 分钟轮询一次 `/api/health`。如果服务器版本和客户端缓存的版本不一致，客户端会注销 service worker，同时清空缓存以强制更新。

## 智能体系统

智能体系统通过可配置的流水线加工 AI 回复。智能体分三个阶段运行：

1. 生成前：主 LLM 调用之前（比如注入上下文或检索知识）。
2. 并行：与主生成同时进行（比如追踪世界状态或战斗）。
3. 后处理：主回复完成之后（比如润色文风或更新世界书）。

重试请求走 `/api/generate/retry-agents`，并显式带上 `agentTypes` 列表。像 **Re-run Trackers**(重跑追踪器) 这类范围较大的界面操作会传入全部活跃的追踪器类型，而单个小组件上的控件只传它自己对应的那个追踪器。

智能体的记忆工具，例如 Narrative Director 的 Secret Plot 面板，走 `/api/agents/memory/:agentType/:chatId`。这个路由适用于配置了按聊天存储记忆的智能体。在当前配置中，Secret Plot 的记忆存在 `director` 下，旧聊天用的 `secret-plot-driver` 仍然被接受。

### 官方可下载智能体

轻量版 Engine 出厂时运行时智能体注册表是空的。从公开的 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 目录安装的包，会在运行时提供经过校验的智能体清单、客户端/服务器功能入口和界面插槽。为了兼容，可用的定义依然通过 `BUILT_IN_AGENTS` 暴露，但它们来自安装的包，而不是内置实现。官方目录包含这些包：

| 智能体 | 阶段 | 作用 |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian` | post_processing | 把关文字质量（防重复、少说多演） |
| `continuity` | post_processing | 发现前后矛盾，并可给出改写指引 |
| `director` | pre_generation | 注入叙事方向和可选的 Secret Plot 状态 |
| `echo-chamber` | parallel | 模拟观众反应 |
| `world-state` | post_processing | 从叙述里提取日期、时间、地点和天气 |
| `expression` | post_processing | 挑选角色立绘表情 |
| `quest` | post_processing | 追踪任务的创建、更新和完成 |
| `background` | post_processing | 挑选合适的背景图 |
| `character-tracker` | post_processing | 追踪角色的状态变化 |
| `persona-stats` | post_processing | 追踪玩家用户角色的属性变化 |
| `custom-tracker` | post_processing | 追踪自定义的结构化状态 |
| `inventory-tracker` | post_processing | 追踪货币、已装备物品和随身库存 |
| `illustrator` | post_processing | 生成场景图像提示词和媒体请求 |
| `lorebook-keeper` | post_processing | 自动创建和更新世界书条目 |
| `card-evolution-auditor` | post_processing | 审查角色卡，给出演进建议 |
| `combat` | parallel | 追踪战斗回合、HP、先攻和结果 |
| `html` | post_processing | 改写完成的 Roleplay 回复，加入融入叙事的 HTML 视觉效果 |
| `spotify` | post_processing | 控制 Music DJ 播放（Spotify、YouTube 或本地音乐） |
| `knowledge-retrieval` | pre_generation | 从知识源检索上下文 |
| `knowledge-router` | pre_generation | 路由相关的世界书条目和知识条目 |
| `haptic` | post_processing | 发送触觉设备指令 |
| `cyoa` | post_processing | 生成选项提示 |
| `conversation-calls` | feature | 添加 Conversation 语音/视频通话及相关设置 |
| `hierarchical-maps` | feature | 添加 Roleplay/Game 地图、空间上下文和移动 |
| `uno` | feature | 添加 Conversation 的 UNO 牌桌 |
| `chess` | feature | 添加 Conversation 的国际象棋棋盘 |
| `poker` | feature | 添加 Conversation 的德州扑克牌桌 |
| `eightball` | feature | 添加 Conversation 的八球台球桌 |
| `tic-tac-toe` | feature | 添加 Conversation 的井字棋棋盘 |
| `rock-paper-scissors` | feature | 添加 Conversation 的石头剪刀布对局 |

### 智能体结果类型

智能体产出带类型的结果，由前端负责处理。`packages/shared/src/types/agent.ts` 里的 `AgentResultType` 联合类型包括：

`game_state_update`、`text_rewrite`、`sprite_change`、`echo_message`、`quest_update`、`image_prompt`、`context_injection`、`continuity_check`、`director_event`、`lorebook_update`、`character_card_update`、`background_change`、`character_tracker_update`、`persona_stats_update`、`custom_tracker_update`、`spotify_control`、`youtube_control`、`local_music_control`、`haptic_command`、`cyoa_choices`、`secret_plot`、`game_master_narration`、`party_action`、`game_map_update`、`game_state_transition`、`prompt_patch`、`frontend_theme_update` 和 `about_me_update`。

## 聊天模式

### Conversation 模式

与一个或多个 AI 角色的纯对话。角色可以有不同的在线状态（online、idle、do not disturb、offline），会影响回复的时机和风格。内置智能体是按聊天单独添加的，不是全局启用。

### Roleplay 模式

带世界状态追踪的沉浸式叙事体验：场景上下文（地点、时间、天气）、角色在场情况和心情、玩家属性、物品栏和任务、遭遇战、来自世界书的设定内容，以及立绘表情。

### Game Mode

由 AI 担任 GM 的会话，包含队伍成员、骰子、世界状态、素材、分镜、日志和结构化的会话生命周期。Game Mode 使用专门的 store 和路由来处理世界状态、素材、桌面游戏、场景视频和分镜。面向使用者的流程见 [Game Mode：入门](../game/getting-started.md)。

## 开发

### 命令

安装依赖：

```bash
pnpm install
```

启动服务器和客户端，带热重载：

```bash
pnpm dev
```

只跑客户端开发服务器：

```bash
pnpm dev:client
```

只跑 API 服务器：

```bash
pnpm dev:server
```

跑基线校验（TypeScript 加 ESLint）：

```bash
pnpm check
```

构建生产版本：

```bash
pnpm build
```

### 打包体积预算

- 主入口：最大 1 MB。
- 单个 chunk：最大 500 KB。
- Vendor 分包：react、tanstack、motion、zustand、icons 和 misc。

### 路径别名

在 TypeScript 和 Vite 的配置里，`@/*` 都解析到 `./src/*`。

## 相关指南

- [架构地图（开发者）](architecture-map.md)
- [文件原生存储](file-storage.md)
