# Game Mode(游戏模式) 架构：规则集、检定与战斗

这是一份供准备修改 Game Mode 规则代码的人使用的导览：规则集在哪里读取、检定与战斗如何结算、状态存在哪里，以及新增规则集键需要做什么。玩家文档位于 `docs/game/`，规则集作者指南从 [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md) 开始，战斗 AI 则有独立页面：[Game Mode 战斗 AI](game-combat-ai.md)。

## 代码位置

| 范围 | 代码 |
| --- | --- |
| 规则集格式 | `packages/shared/src/schemas/ruleset.schema.ts`：zod 架构、`RulesetRef`(固定引用)及导入时执行的交叉校验。编辑器使用的 JSON Schema `docs/extending/ruleset.schema.json` 由 `pnpm ruleset:schema` 从中生成。 |
| Capability API | `packages/shared/src/schemas/capability-package.schema.ts` 中的 `supportedCapabilityApi`，每个次版本对应一行注释，说明该版本新增的内容。 |
| 人物卡计算与实时状态 | `packages/shared/src/features/rulesets/`：`sheet-math.ts`、`live-state.ts`(处理 `[sheet:]` 操作)、`sheet-commands.ts`、`sheet-builder.ts`、`layers.ts`、`item-*.ts`、`loot.ts`、`market.ts`、`combat-bridge.ts`(处理 `battle` 块)。 |
| 规则集战斗 | `packages/shared/src/features/ruleset-combat/`：`resolve.ts`、`options.ts`(决定菜单内容)、`grid.ts`、`sight.ts`、`zones.ts`、`creatures.ts`、`pool.ts`、`symbols.ts`、`dice.ts`。全部是以 `(definition, state)` 为输入的纯函数。 |
| Marinara 自有战斗 | `packages/shared/src/features/tactical-combat/`(Tactical 引擎、网格生成、AI)、`combat-director.ts`、`combat-conditions.ts`。 |
| 战斗 AI | `packages/shared/src/features/combat-ai.ts`、`combat-minds.ts`；见 [Game Mode 战斗 AI](game-combat-ai.md)。 |
| 服务器：规则集 | `packages/server/src/services/game/ruleset-registry.service.ts`(读取已安装和已导入的规则集，解析游戏的固定引用)、`ruleset-catalog.service.ts`、`ruleset-sheet-turn.service.ts`(应用一个回合的 `[sheet:]` 命令)、`game-ruleset-version.service.ts`、`routes/game-rulesets.routes.ts`。 |
| 服务器：检定与骰子 | `skill-check-resolution.service.ts`、`skill-check.service.ts`、`dice.service.ts`、`dice-pool.service.ts`、`one-request-dice.ts`、`dice-rng.ts`。 |
| 服务器：战斗 | `combat-director.service.ts`(Classic 与 Tactical)、`combat.service.ts`(Classic 的轮计算，`resolveCombatRound`)、`ruleset-combat-director.service.ts`(由规则集结算的战斗)、`combat-ai.service.ts`、`combat-boss.service.ts`、`tactical-battlefield.service.ts`、`made-battlefield.service.ts`。路由：`routes/combat-director.routes.ts`(调度器的启动、状态与命令)、`routes/encounter.routes.ts`，以及 `routes/game.routes.ts` 中较早的 `POST /game/combat/round`、`/game/combat/tactical/start` 和 `/game/combat/tactical/action`。 |
| 提示词 | `gm-prompts.ts`(`buildGmFormatReminder`、人物卡块及教给模型的标签)。 |
| 客户端 | `packages/client/src/components/game/`：`GameRulesetSheet.tsx`、`GameSetupRulesChooser.tsx`、`RulesetCombatScreen.tsx` 和其他 `RulesetCombat*.tsx`、`TacticalCombatUI.tsx`、`GameCombatUI.tsx`、`DirectedCombatUI.tsx`。 |

## 规则集从包到游戏的流程

1. **来源。**官方规则集是类型为 `ruleset` 的能力包，在 `contributions.assets.paths` 中列出 `ruleset.json`（以及所有 `catalogs/<id>.json`），并在 `files[]` 中固定其哈希。社区规则集可作为单个文件、`<name>.ruleset.json` 包文件导入，也可从仓库的 `rulesets/` 文件夹导入；存储时使用带命名空间的 id(`local/<id>`、`<owner>/<id>`)，因此绝不会覆盖官方规则集。
2. **语言。**官方规则集的译文是按语言分别提供的包，列在对应的目录条目中；包管理器只保留 Engine 所用语言的包（`package-manager.service.ts` 中的 `syncRulesetLocalePack`）。导入的包文件只保留导入时启用的语言。
3. **注册表。**`ruleset-registry.service.ts` 用共享架构解析每份定义，丢弃无法使用的定义并记录一行日志。定义按 id 和版本存储；版本相同而字节内容不同的定义会被拒绝。
4. **固定引用。**创建游戏时只写入一次 `chat.metadata.gameRuleset`：`{ id, version, packageId, source?, options }`，其中 `options` 存放所选的层。没有固定引用就使用 Marinara 自有规则。如果当前安装无法满足固定引用（缺失，或版本低于固定引用要求），就会报告问题，游戏的检定仍待结算；绝不会用另一套系统的规则结算。

## 状态

| 部分 | 内容 | 位置 | 是否随备选回复回退 |
| --- | --- | --- | --- |
| 初始构建 | 玩家在角色卡或用户角色上填写的人物卡 | 角色卡的 `data.extensions.rulesetSheets[rulesetId]`，用户角色的 `personaStats.rulesetSheets[rulesetId]` | 不适用 |
| 游戏内构建 | 设置时创建的副本，可通过 **Edit sheet**(编辑人物卡) 和升级修改 | `chat.metadata.gameCharacterCards[].rulesetSheet` | 否 |
| 实时状态 | 资源池、轨道、状态、状态值、备注 | `game_state_snapshots.ruleset_live` | 是 |
| 一场战斗 | 遭遇、种子与骰子游标、当前轮到谁的回合 | 战斗调度器的存储行，每个聊天一行 | 随启动战斗的回合一起恢复 |

实时状态属于快照，因此重新生成回合不会重复消耗资源。存储的人物卡格式为 `{ v, build }`，上限为 64 KB，读取时采用宽松处理：保留未知字段，缺失字段使用默认值。如果布局将值移到新的 id，就要声明 `sheet.migrations`，由 `readRulesetSheetEnvelope` 和 `readStoredLiveState` 在读取时应用。尚未安装的规则集对应的人物卡会保持休眠，绝不丢弃。

## 检定的完整流程

1. 游戏主持人（GM）写入 `[skill_check: …]`，可选带上 `who=`、`with=`、阶梯步骤名称、符咒或资源消耗。开启单次请求掷骰时，也可以改写为分支块或 `[[roll: …]]` 占位符（`one-request-dice.ts`）。
2. `skill-check-resolution.service.ts` 读取固定引用的规则集，并根据 `resolution.kind` 分派：`dice-sum`、`dice-pool`、`dice-highest`、`roll-against` 或 `symbol-pool`。模型写出的数值会接受审计，除非规则集担保其有效，否则会被替换；骰池、保留的骰子和分档结果一律不受这种担保。
3. 骰子：检定使用 `rollDieSecurely` 掷骰（Web Crypto，位于 `packages/shared/src/utils/dice-notation.ts`）。规则集战斗及其中的物品使用、战利品和市场使用同一模块中的 `seededDieRoller(seed, cursor)` 掷骰，因此战斗可从种子重放。自 #8608 起，不再有其他掷骰实现。
4. 结果以完整标签和骰子卡片的形式写回，并记入 **Logs**(日志)。

## 人物卡命令

GM 通过 `[sheet: who="Name" op="…"]` 修改人物卡。标签可指定的操作包括 `spend`、`restore`(别名 `heal`)、`damage`、`temp`、`track`、`condition`、`state`、`note`、`rest`、`use`(别名 `cast`)、`pass`、`advance`、`dismiss`、`prepare` 和 `unprepare`(`live-state.ts` 中的 `RULESET_SHEET_OP_NAMES` 和 `RulesetSheetOp`)。`ruleset-sheet-turn.service.ts` 根据实时人物卡逐一验证；无法执行的操作（例如没有剩余法术位时施法）会被拒绝、记入日志，并在每个回合提示一次，任何操作都不会只应用一半。`sheet` 是保留的 GM 标签。

## 战斗的完整流程

游戏中的战斗采用三种风格之一，由规则集和游戏的 **Combat Preference**(战斗偏好) 决定：

| 规则集 | 风格 | 服务器 |
| --- | --- | --- |
| 无规则集，或没有 `battle`/`combat` 块 | Marinara 的 Classic 或 Tactical 战斗 | `combat-director.service.ts` |
| `battle` 块 | Marinara 的战斗，借用人物卡的资源池、槽位和目录技能；生命值按最大值的比例带入并写回 | `combat-director.service.ts` 配合 `combat-bridge.ts` |
| `combat` 块 | 规则集自有战斗；当 `combat` 提供每格的距离且游戏采用 Tactical 时，在棋盘上进行 | `ruleset-combat-director.service.ts` |

三种风格共用调度器账本：每个聊天一行存储记录、一个修订号、请求 id 防重机制及一个独立队列。账本只覆盖由调度器支持的战斗。`game.routes.ts` 中较早的路由 `POST /game/combat/round`（对接收到的参战者调用 `resolveCombatRound`）、`/game/combat/tactical/start` 和 `/game/combat/tactical/action` 不保留账本：客户端持有战斗状态，并在每次调用时回传。在规则集战斗中，菜单决定合法性（`options.ts`），结算器应用选择（`resolve.ts`），骰子来自战斗的种子与游标，队员的所有消耗或损失都通过人物卡自身的规则写入，因此战斗中途关闭标签页也不会丢失任何内容。未专门编写的对手由规则集的生物图鉴和遭遇额度生成；GM 可以操控具名对手与首领，从 Engine 排序后的建议中选择。

## 新增规则集键

1. 将键及其交叉校验加入 `ruleset.schema.ts`，并加入结算器读取的 TypeScript 类型。
2. 将 `supportedCapabilityApi` 提升一个次版本，并添加对应的注释行。为该键设置版本限制，要求使用它的规则集必须声明该次版本或更新版本。
3. 先在共享纯函数代码中实现，再接入服务器，最后接入客户端。
4. 运行 `pnpm ruleset:schema`，重新生成 `docs/extending/ruleset.schema.json`。
5. 在作者指南的对应页面（`docs/extending/ruleset-*.md`）中记录；如果玩家会看到，也要写入玩家文档。
6. 添加一个 `scripts/regressions/*.regression.ts`，通过纯函数代码实际运行该键的逻辑，并包含会被拒绝的输入。
7. 在尚未关闭的 `[docs-i18n]` 议题中列出已修改的英文页面。

`docs/development/ruleset-5e-2014.example.json` 是一份精简的 5e 草案，数百项回归与端到端测试将它作为测试夹具读取。它不是随应用发布的 SRD 包；后者位于 Marinara-Agents 的 `packages/ruleset-5e-2014/` 下。

## 待完成的工作

- 在规则集棋盘上飞越障碍：飞行者目前与其他单位一样移动。
- Marinara 自有 Classic 和 Tactical 战斗中的召唤（规则集战斗已支持召唤）。设计见 [Game Mode 战斗 AI](game-combat-ai.md#summoning-design-extension)。
- 为战斗准备地形简报的 Battlefield Scout 智能体，说明见 [Game Mode 战斗 AI](game-combat-ai.md#encounter-environment-agent-handoff)。
