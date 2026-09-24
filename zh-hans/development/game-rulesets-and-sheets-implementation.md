# Game Mode 规则集与规则集人物卡：实现交接

状态：进行中。写于 2026 年 9 月 18 日，基于 `staging` 的 `459f8b85`(v2.4.6)。切片 1(共享模式、固定引用、注册表和 Capability API 1.20)、切片 2(`dice-sum` 结算器、`who=` 和 Game Master 提醒替换)、切片 3(角色卡和用户角色上的人物卡)、切片 4(Rules 选择、创建时固定、设置时复制及设置共享)、切片 5(游戏内人物卡、实时状态和 `[sheet:]` 命令)、切片 7a(社区渠道)、切片 8a(目录格式、路由和 Capability API 1.21)、战斗桥接(`battle` 块、共享辅助函数和 Capability API 1.22)、切片 8c(随人物卡缩放的目录值、`use` 命令、Refresh from ruleset 和 Capability API 1.23)、切片 7b(`dice-pool` 结算类型、`with=`、`threshold=` 和 `bonus=` 标签属性，以及 Capability API 1.24)、层 L1(规则集自身文件携带的变体、向导中的层开关、`gm.worldGuidance` 槽位和 Capability API 1.25)，以及真正的规则集战斗 C1(`combat` 块、纯结算器、机制扩展和 Capability API 1.26)、C2(生物图鉴、生物行动和威胁限幅、Capability API 1.27)、C3a(在服务器自身账本上结算战斗的战斗导演)、C3b(使用规则集自身措辞在屏幕上呈现这场战斗)、C4a(位置、触及与射程、范围、掩护和借机攻击，Capability API 1.28)、C4b(在战场上绘制战斗)、C5a(一回合能做什么：第二个伤害子项、一次额度多次打击、改变行动经济的能力、附加效果、新状态效果和 Capability API 1.29)均已实现，有客户端部分的也包含在内；C5a 之后的切片仍是提案。“格式决策”节记录了已实现格式与最初草案的差异及原因。本文补充 `game-combat-rulesets-implementation.md`(战斗交接文档)。两者有差异时，“与战斗交接文档的关系”节会明确说明并请求签核，而非静默覆盖。

配套文件：[`ruleset-5e-2014.example.json`](ruleset-5e-2014.example.json)，既是首个规则集定义，也是“完整人物卡”含义的精确说明，还是切片 1 回归验证所检查的文件。格式的权威定义是 `packages/shared/src/schemas/ruleset.schema.ts` 中的 zod 模式。

## 原因

功能需求来自 [Marinara-RPG-Extension](https://github.com/Kenhito/Marinara-RPG-Extension) 的作者，该扩展以覆盖层提供十六种桌面规则系统：Game Mode 检定固定为 d20 加 Engine 调整值，人物卡只有六项属性，而目前运行另一种系统需要为每个规则集配置四到五个逐回合智能体。作者更希望原生运行。其 `docs/ENGINE-CONSTRAINTS.md` 是有用的需求列表，但覆盖层架构并非目标。

第一方范围是**固定到 SRD 5.1 的 5e(`5e-2014`)**。V20 和其他系统通过同一种数据格式留给社区作者实现(切片 7)，因此格式不能做成 5e 专用形状。

## 产品约定

1. 规则集在创建游戏时选择，并在游戏整个生命周期内固定。它独立于 Experience、战斗呈现、参与方式和控制者。
2. 没有固定规则集就表示 `engine-legacy`：当前行为逐字节保持不变，包含提示词。
3. **规则集绝不增加模型调用。** 检定使用现有骰子流程；人物卡更改通过 GM 自身叙述中的标签传递；提示词上下文由人物卡和规则集数据拼接字符串生成。没有规则集使用 `api.registerTool`，也没有规则集携带逐回合智能体。
4. Engine 负责骰子、调整值、资源计算和合法性。GM 选择检定内容与难度，并叙述真实结果。
5. 角色卡或用户角色上的人物卡，是该角色在此规则集中的**初始构筑**。游戏获取一份副本，游戏中的任何内容都不会写回资料库。
6. 规则集声明覆盖范围，UI 在开局前展示。在战斗交接文档中的适配器为某规则集实现之前，该规则集的战斗使用 `engine-legacy`，UI 会以易懂的话说明。

## 已验证的当前行为

从源码读取，而非由文档推断。

| 事实 | 位置 |
| --- | --- |
| 检定是 d20 + 技能调整值 + 属性调整值，对抗 DC；自然 20 和 1 自动结算；技能通过硬编码表映射到属性，回退为 INT | `services/game/skill-check.service.ts` |
| 调整值始终只读取玩家角色卡，通过用户角色名称查找，并回退到第一张卡 | `skill-check-resolution.service.ts` `findPlayerCharacterCard` |
| `[skill_check:]` 接受 `dice=` 和 `resolution="successes" threshold=`，但这些路径不接收人物卡输入，且“永不审计或重写” | 同一文件；`docs/game/dice-and-skill-checks.md` |
| 设置时，将队伍角色卡的 `extensions.rpgStats` 和用户角色的 `personaStats.rpgStats` 复制到 `chat.metadata.gameCharacterCards[].rpgStats`，并将 HP 重置为最大值 | `routes/game.routes.ts` `loadSetupRpgContext`、`applyGameSetupPayload` |
| Edit Sheet 保存到这份聊天元数据副本。没有在 `game.routes.ts` 中发现写回资料库角色卡的行为 | `GameSurface.tsx` `handleSaveCharacterSheet` |
| `playerStats`(仅玩家：技能、属性、物品栏)位于每条消息的游戏状态快照中，并跟随滑动分支。`playerStats.attributes` 从不填入初始值 | `types/game-state.ts`；`skill-check-resolution.service.ts` 中的注释 |
| 没有 GM 标签会更改人物卡数值。提醒写明属性与队伍 HP“仍保留在各自的权威系统中” | `services/game/gm-prompts.ts` |
| 已有战斗法术位(`spellSlots`、`slotLevel`)，但只由遭遇生成在“已经确立时”提供 | `routes/encounter.routes.ts`、`combat-director.service.ts` |
| 整个战斗只有一个模型调用点：首领从 Engine 枚举的菜单中选择 `candidateId` | `combat-boss.service.ts` |
| 客户端槽位为 `conversation-surface`、`conversation-toolbar`、`chat-settings`、`spatial-workspace`、`chat-runtime`、`game-world-map`、`home-browser-tab`、`game-surface`、`roleplay-tracker`、`tracker-panel`。没有一个触达角色或用户角色编辑器 | `schemas/capability-package.schema.ts` |
| 角色的 `extensions` 与用户角色数值模式均使用 `.passthrough()`，两个导入器都会完整展开 `extensions` | `character.schema.ts`、`persona.schema.ts`、`persona-normalization.ts`、`marinara.importer.ts`、`st-character.importer.ts` |
| 已有声明式内容的社区渠道：GitHub 仓库在顶层放一个 `agents.json`，从 `github.com` 或 `codeload.github.com` 以归档下载，限制大小，以更改列表预览，按摘要追踪更新，并受 **Allow custom Agent imports**(允许导入自定义智能体) 控制。单文件和文件夹导入共用此开关 | `services/agents/custom-agent-repositories.service.ts`；`docs/agents/custom-agents.md` 的“导入与导出”节 |
| `gm-verbs.json` 是保留文件名声明式资源的先例，由 Engine 读取、验证并据此行动，无须包代码 | `optional-agent-packages.md` 第 1.16 节；`capability-gm-verb-runtime.service.ts` |

## 与战斗交接文档的关系

战斗交接文档写道：“从内置、纯 TypeScript 适配器的封闭注册表开始。不要添加脚本语言或任意可执行规则包。”

以下是建议的解读。切片 1 据此构建，议题要求维护者对该解读及扩展后的 `RulesetRef` 签核：

- **封闭注册表**是 Engine TypeScript 中的_结算类型_与_派生运算_集合。新增类型应通过附带回归验证的 Engine PR 完成。
- **规则集定义**是经验证的数据，为类型提供参数并声明人物卡。它不含表达式字符串，绝不被求值执行，也不引入包代码。
- **战斗适配器仍属于 Engine TypeScript**，以同一规则集 ID 为键，与战斗交接文档完全一致。数据无法合理表达声明顺序、行动经济或反应窗口，本文也不尝试这样做。
- 两份文档共享同一个 `RulesetRef`。本文将它固定到游戏，战斗交接文档将其快照到每次遭遇。

这样既不开放可执行渠道，也能让基础发行版不包含可选规则内容，与智能体包的目标一致。

**战斗桥接与这条边界。** 桥接功能(见“战斗桥接确定了什么”节)位于上述解读之下，而非与其平行另起一套。它不增加结算规则：只为通过 `battle` 块选择加入的规则集，在人物卡与 Engine 现有战斗模型的边界间双向传递数值。它不应用攻击检定、豁免或专注，也不改变伤害计算，因此不声称实现任何系统的战斗。它是通用功能，所以落地当天就能服务社区 2d6 系统，而不只是 5e。它还明确按规则集让位：一旦某规则集有了真正的战斗适配器，战斗就归该适配器负责，桥接退出。PR 请求维护者对此签核，因为它最接近的是战斗交接文档的边界，而不是本文的边界。

## 格式决策

格式必须服务于尚未有人编写的规则集，其中许多会由读取 5e 文件作为示例的 AI 智能体起草。5e 文件恰好需要的每件事都转化为有名称的通用原语，避免作者认为某件事“只能按 5e 的方式做”。

- **没有特殊 ID。** Engine 绝不查找 `level`、`dex`、`slots` 或 `hp`。熟练加值由 `resolution.proficiency.bonus` 引用的值决定；它可以省略，此时档次使用 `flat` 加值。等级表就是读取普通字段的普通 `stepTable` 派生值。
- **骰子是 `dice-sum` 的参数**(`{ count, sides }`)；除非规则集只投单骰，否则自然骰面结果会被拒绝。
- **属性调整值使用封闭运算：** `floorHalfMinusTen`、`identity`(属性值就是调整值)或 `stepTable`。
- **豁免和技能一样是列表**，不是“每种属性一个”，因此能表达三豁免系统。技能和豁免可以省略属性。
- **每项技能和豁免都能在人物卡上携带自由的数字加值**(`bonuses`)，无须新增原语就能支持等级点数制和物品加值。
- **被动数值不是一种运算。** 它是 `{ "const": 10 }` 与 `{ "skillMod": "perception" }` 的 `sum`。
- **各行为资源的列表声明 `pools`**(名称、最大值及可选的充能列)，休息通过按 `recharge` 筛选的 `listPools` 恢复它们。没有任何组件需要认识“计数器”这个词。
- **休息恢复量采用封闭形状：** `to`(`"max"`、`"min"` 或数值)或者 `by`(常量，或带舍入与下限的最大值比例)。5e 的“生命骰的一半，至少一个”表示为 `{ "fractionOfMax": 0.5, "round": "down", "min": 1 }`。
- **池可以从空开始**(`start: "empty"`)，用于压力、腐化等逐步增加的轨道。
- **`gm.sheetSummary`** 指定精简提示词块展示哪些字段、派生值和列表，因此 Engine 无须硬编码“AC、被动 Perception、已准备法术”。
- **任何对象都允许 `$comment`**，根对象允许 `$schema`；两者均在验证前丢弃。其他部分严格验证：Engine 只能理解一部分的规则集会静默改变游戏计算，所以未知键会导致整份文件被拒绝，并列出作者可以据此修正的 `path: message` 行。
- **项目引用分区之前，必须先声明分区**，让编辑器中每个组都有标签。
- **派生值只读取在它之前声明的值**，使循环无法表达。为熟练加值提供值的项及其之前的所有项，均不能读取技能或豁免调整值。
- **每个标签和指引字符串都遵循 gm-verbs 提示词规范：** 单行、无控制字符、无方括号、无宏花括号。
- **包声明类型 `ruleset`**，不需要权限或入口点，列出 `ruleset.json` 时必须声明 Capability API 1.20。

## 切片 2 确定了什么

- **结算器位于现有上下文之后。** `SkillCheckModifierContext` 增加可选的 `ruleset`。每个调用者已经通过 `resolveSkillCheckWithContext`，因此端点、生成后处理、单请求骰子和可预先看到结果的骰池，都无须新调用点就能触达规则集。
- **看似完成的标签也要与人物卡核验。** 在 `engine-legacy` 下，算式正确的完整标签直接接受：不为其加载上下文、不对人物卡审计，也不重掷。规则集游戏中，生成路由传入 `rulesetPinned` 提示，也为这些标签加载上下文；若调整值、骰子数量或自然骰面结果不是规则集能产生的，就将标签送回重掷。该提示的存在，是为了让旧版游戏仍然不为完成标签加载上下文。
- **安装状态无法兑现固定引用时，按拒绝方式失败。** 加载上下文会抛出异常，标签驱动器现有失败路径将检定保存为稀疏状态，仍需投骰。
- **`who=` 随结果传递。** `SkillCheckResult.who` 仅由规则集结算器设置，再由序列化器写入，所以旧记录保留原字节。
- **陌生人投无调整值的骰子。** 不匹配任何队伍角色卡或被两张卡共用的 `who=`，不获得任何调整值，因为规则集默认值并非在所有系统中都中立。没有人物卡的队友(或玩家)按规则集空白默认构筑投骰，这也正是设置时给他们复制的内容。规则集不认识的技能名同样不加任何值，也绝不回退到猜测的属性。玩家自己的角色卡对与队友重名的名称保持优先权。
- **注入的 d20 和玩家预掷的 d20，仅在规则集使用单颗 d20 时采用。** 其他骰子来自 Engine 的公平骰子。
- **端点的难度上限仍为 40**(标为 `ponytail:`)；生成后处理遵循更宽的难度梯度。
- **人物卡块与人物卡命令和实时状态同属切片 5。** 切片 2 只替换提醒中的检定行，并移除教授其他骰子记法的那一行，因为规则集游戏只有一套规则系统。

## 切片 3 确定了什么

- **存储边界只限制大小，不检查形状。** 在角色扩展和用户角色数值模式上将 `rulesetSheets` 声明为映射：键必须是规则集 ID，值必须是不超过 64 KB 的对象，最多 32 个。规则集可能未安装，因此不在此验证人物卡形状。突破限制的更新会被拒绝并附带消息。
- **导入器进行裁剪，不拒绝整个导入。** `capImportedRulesetSheets` 只丢弃边界会拒绝的人物卡，因此一张坏人物卡不会导致整张角色卡无法导入。它在原生角色导入器、SillyTavern 导入器，以及 `normalizePersonaStats` 内运行，后者也是用户角色的读取路径。
- **编辑器是根据定义渲染的单个通用组件**(`RulesetSheetEditor`)，由 `RulesetSheetsSection` 挂载到两个 **Stats**(数值) 标签页。已安装规则集来自 `GET /api/capability-packages/rulesets`，归在功能包查询键下，所以安装或移除会刷新它。
- **值只在编辑时限幅，读取时绝不限幅**；规则集不再提供的已存熟练档次，仍按原值显示。
- **安装列表加载完成之前，不会将任何内容标为休眠**，因此慢请求不会把有效人物卡显示为缺失。

## 切片 4 确定了什么

- **由服务器构建固定引用。** 向导在 `GameSetupConfig` 中发送 `ruleset`，但只信任其 `id`：`POST /game/create` 从自己的注册表重新构建 `RulesetRef`，并同时写入 `gameSetupConfig.ruleset` 与 `chat.metadata.gameRuleset`。未安装的规则集以 `ruleset_not_installed` 拒绝，绝不替换成其他规则。
- **没有规则集的游戏不新增键。** 仅在选择了规则集时写入 `gameRuleset`，所以旧元数据保留原字节。
- **设置时复制集中在一处。** `applyGameSetupPayload` 自行加载队伍和用户角色已存的人物卡，让两个设置入口(`/game/setup` 和 `/game/setup/apply-json`)以相同方式复制。和已有的 `rpgStats` 一样，角色卡按规范化名称匹配；与队友重名时用户角色优先。没有已存人物卡的成员获得空白默认构筑。
- **设置共享遵循 Experience 规则。** 如果当前安装具有共享版本或更新版本，就为新游戏恢复共享的规则集，否则丢弃；向导随后用文件的 `rulesetName` 标签指出缺失规则集。共享文件里的固定引用是不可信输入，通过 `rulesetRefSchema` 读取。
- **Rules 块是独立组件**(`GameSetupRulesChooser`)，放在 Combat Preference 旁，仅在至少安装了一个规则集的新游戏中渲染。

## 切片 5 确定了什么

- **实时状态使用独立的快照列。** `game_state_snapshots.ruleset_live` 保存 `RulesetLiveStates`，以规范化的角色卡名称为键。文件存储新增一列无须提高 `STORAGE_VERSION`：旧行将该列读作 null，而 null 表示每个池都处于默认状态。它不是 `playerStats` 内的键，因为多个追踪器会根据已知字段重建该对象。
- **实时状态是稀疏的。** 只保存已经设置的值，回到默认值的项又会丢弃。因此，未动过的“满额”池在升级提高最大值时会跟随变化；没有任何消耗的角色甚至不会有记录项。
- **回合以开始时的状态为基准。** `[sheet:]` 命令在回复每次重写之后、保存之前，应用于该回合紧前一行的实时状态之上；续写时则使用被续写消息已有的行。重新生成的回合从它之前的消息解析基础状态，所以不会支付两次，每个滑动分支也保留其结束状态。
- **规则集游戏保存的每个回合都会写入自己的行，无论是否更改**，让下一回合、滑动分支和新会话始终有行作为起点。追踪器随后重建同一消息及分支时，也会保留实时状态：除非调用者传入，否则 `create` 从被替换行继承它。
- **命令属于 Engine，名称属于规则集。** 语法(`spend`、`restore`、`damage`、`temp`、`track`、`condition`、`note`、`rest`，以及按 `restore` 读取的 `heal`)对每个规则集都相同。最初提案中的 `concentrate` 变为通用的 `note`，因为“专注”只是某个系统的词。池、轨道、状态、注记和休息的名称来自规则集，按 ID 或标签匹配。
- **保存的回复就是记录。** 每条命令原地重写为 `result="ok" now="…"` 或 `result="refused" reason="…"`。模型自行写下的结果会被忽略。被拒绝的命令不改变任何内容，并记录日志；客户端每回合提示一次。
- **人物卡在提示词后段交给 Game Master。** 人物卡块和命令行属于每回合格式提醒，绝不进入系统提示词，因为实时状态每回合变化，而服务商缓存的是系统提示词。没有规则集时，提醒逐字节保持一致。
- **玩家通过同样规则编辑。** 游戏内人物卡对每个按钮应用 `applyRulesetSheetOp`，通过 `PATCH /chats/:id/game-state` 保存；该接口限制实时状态(`rulesetLiveStatesSchema`)，但不判断其他内容，因为这是玩家自己的游戏。
- **`sheet` 已保留。** 同名包动词会被拒绝，动词名称扫描会找到提醒中教授的标签。
- **这里尚未实现：** 队友自己的回合(`/party-turn`)不应用人物卡命令，只有 Game Master 的回复应用。

## 切片 7a 确定了什么

- **存储。** 社区规则集位于新的文件存储表 `game_rulesets`，每个命名空间 ID 与版本一行，保存精确导入原文及其 sha256。不提升存储格式。表没有所有者或级联删除：移除提供规则集的仓库，只清空 `repositoryId`。
- **ID。** 文件始终携带裸 ID。Engine 将所选文件归为 `local/<id>`，仓库内容归为 `<owner>/<id>`(小写 GitHub 所有者)，注册表将 `definition.id` 重写为该带命名空间的 ID，让人物卡、固定引用和向导都以它为键。名为 `local` 的 GitHub 账号会被拒绝，防止其他人把规则集放进用户自己的分组。
- **版本。** 已存版本永不重写。相同字节不作操作，已有版本下的不同字节会被拒绝(`RulesetVersionConflictError`)，并提示作者提高版本。社区固定引用解析其指定的精确版本，丢失时为 `version-missing`；官方包继续使用“已安装版本至少等于固定版本”的规则。
- **访问条件。** 单文件导入需要特权访问及 **Allow custom Agent imports**。仓库渠道在此基础上保留自己的环境开关。关闭导入时，`/game/create` 拒绝社区规则集(`ruleset_imports_disabled`)，向导也不列出它们；但结算从不读取该策略，因此现有游戏继续工作。移除只需要特权访问，所以导入关闭时仍能执行。
- **移除。** `DELETE /api/game-rulesets?rulesetId=` 删除所有已存版本。若有游戏固定该规则集，会返回带数量的 409 `ruleset_in_use`，客户端再次询问后才以 `force=true` 重试。
- **审核。** 没有能力权限复选框，因为规则集没有这些权限。审核展示身份、许可证、覆盖范围、检定方式和 Game Master 文本原文，并说明文本将发送给模型。
- **仓库渠道。** `<top>/rulesets/*.json`，仅直接子文件，最多 32 个，每个不超过 `RULESET_MAX_BYTES`。仓库可包含智能体、规则集或两者。一个不可用文件只会成为附带原因的预览行，不会让整个仓库失败。上游撤回的规则集仍保留安装。
- **编写。** `docs/extending/writing-rulesets.md` 首先说明能力上限。`docs/extending/ruleset.schema.json` 由 `pnpm ruleset:schema` 从 zod 模式生成，过期时回归验证失败。指南为每种结算类型提供一个示例，两者都不采用 d20 形状：Ember Roads 投 2d6，Gravewatch 投十面骰池。回归验证会验证两者，也会检查公开模式是否为每种类型包含成员。

## 切片 8a 确定了什么

- **头部在规则集中，条目可以不在。** `ruleset.json` 增加可选 `catalogs` 数组(最多 12 项)。每个头部包含 `id`、`label`、它供给的 `feeds` 人物卡列表(1 到 8 个)、已声明的 `filters`、可选 `units`，以及 `entries`(内联)或 `asset` 中恰好一个。规则集没有目录时省略该键，而非空数组，因此目录出现前编写的文件仍解析成相同字节。
- **资源路径派生得出，不能任意选择。** `asset` 必须等于 `catalogs/<the catalog's id>.json`，让路由仅凭规则集就能找到文件，也防止目录指定另一个目录的文件。
- **由一个辅助函数决定列表能存什么。** 共享包导出的 `rulesetListRowIssues(list, values)` 是“此行能否保存”的唯一判断：模式对每个内联条目运行它，`parseRulesetCatalogFile` 在读取资源条目时运行它，客户端又对玩家选中的行运行它。因此目录无法写入编辑器随后会拒绝的内容。`rulesetCatalogEntryIssues(definition, catalog, entries)` 是两条验证路径调用的共享封装。
- **选择时复制，与设置时复制相同。** `rowsFromCatalogEntry` 返回的行包含一个保留键 `RULESET_CATALOG_ROW_KEY = "_catalog"`，值为 `<catalogId>/<entryId>`。列 ID 必须以字母开头，因此永不冲突。行是副本：玩家可以编辑，卸载规则集后人物卡仍可读取，新的规则集版本也不会重写角色。
- **上限。** 每规则集 12 个目录，每目录 8 个供给列表与 8 个筛选器，无论内联还是资源文件每目录 2000 条，每条目 6 行，每资源文件 `RULESET_CATALOG_MAX_BYTES = 1 MB`；读取文件前先核对清单声明的 `files[].bytes`。
- **保持列表精简。** `GET /api/capability-packages/rulesets` 会移除内联 `entries`，改报 `entryCount`，因为每次打开人物卡编辑器都会读取列表。没有目录的规则集仍按原样逐字节列出。`GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=` 提供单个目录：内联条目，或已解析、已验证的资源。它与 `/rulesets` 一样不要求特权，并在 `/:id/...` 路由之前注册，防止包 ID 遮蔽它。未知规则集、版本或目录返回带代码的 404；Engine 不读取的资源返回 422，并带作者可处理的问题行。
- **Capability API 1.21 分两部分执行。** 声明 `catalogs/<id>.json` 资源需要 1.21，以及旁边的 `ruleset.json`。目录也能存在规则集文件内部，清单无法表达，所以安装时读取已验证字节，在较低 API 声明下发现 `catalogs` 键便拒绝。无法解析的规则集不会导致安装失败：仍交由注册表报告，并留一条日志。
- **`mechanics` 会验证，且部分内容被使用。** 可选块(类型、射程、范围、目标、友军伤害、数量、伤害类型、攻击检定、豁免、费用、每费用步长、专注、反应)使用封闭严格词汇，因此拼写错误会现在暴露，而不是等到终于有组件读取时才发现。切片 8a 只验证它，并在选择器显示一行简述。战斗桥接使用类型、射程、范围、友军伤害、数量、伤害类型、费用和反应(用于排除反应条目)。攻击检定、豁免、专注和每费用步长仍没有读取者。
- **已知上限：社区目录仅支持内联。** 以单文件导入或从 GitHub 仓库获得的规则集，将目录包含在同一文件中，因此也受现有 256 KB 上限约束。社区规则集独立目录文件(`rulesets/<id>/catalogs/*.json`)被有意排除：仓库渠道只读取 `rulesets/` 的直接子文件，单文件渠道按定义就只有一个文件。列表超过 256 KB 的社区作者应改发包。如果这成为实际限制，则另设一个切片处理。
- **验证依据是第二个非 d20 规则集。** `docs/examples/rulesets/ember-roads.json` 增加了 `knacks` 列表、各行为池的 `tricks` 列表，以及向两者供给的目录，包含写两行的条目和携带 `mechanics` 的条目。格式没有任何 5e 专用形状，回归验证读取此文件而非 5e 文件。

## 战斗桥接确定了什么

- **规则集主动选择，未声明时不改变任何内容。** `ruleset.json` 增加可选 `battle` 块：`health`(必填，作为生命值的实时池)、可选 `energy`(成为 MP 的池)、可选 `slots`(带 1 到 9 等级的池)，以及可选 `skills`(最多八个人物卡列表，每个可有 `onlyWhen` 布尔列和 `alwaysWhen: { column, equals }` 例外)。没有该块时，战斗与以前逐字节相同。它属于 Capability API 1.22，像 `catalogs` 一样在安装时把关，因为块位于规则集文件内，而非清单中。
- **每个名称都指向已声明的实时池。** 各行为池的列表不能充当生命值：行池按行名称索引，随人物卡编辑增减。生命与能量必须不同，法术位池和等级分别唯一，列表必须存在，`onlyWhen` 是布尔列，`alwaysWhen.column` 是同一列表的列。
- **桥接由三个纯共享辅助函数组成**，位于 `packages/shared/src/features/rulesets/combat-bridge.ts`：`seedCombatantFromSheet`、`combatSkillsFromSheet` 和 `sheetOpsFromCombatResult`，再加上 `applyCombatResultToLive`；它们建立在生命双向都经过的唯一转换 `carryHealthShare` 之上。没有 I/O、不抛异常、没有服务器路由。客户端在三个战斗 UI 共用的同一个边界两侧调用它们。
- **生命值双向都按最大值比例传递。** 首轮浏览器检查发现：Engine 构建的 1 级参战者约有 60 生命，每次命中造成 11 到 15 伤害，而 Ember Roads 角色有 9 Grit，1 级 5e 法师有 8 生命。伤害计算属于 Engine 且保持不变，所以借用人物卡原始数值会让桥接角色在每场战斗第一击就倒下。参战者保留 Engine 自己的 `maxHp`，以人物卡生命池相同的比例开始；写回时将最终比例读回人物卡尺度，并写入差额。能量和法术位保持绝对值：它们是小额计数，费用来自同一人物卡，Engine 一次消耗一个。提示通知、`docs/game/combat.md` 和规则集指南都说明，战斗中的数值属于 Marinara。
- **比例本身绝不会改变人物卡。** 未改变参战者生命值的战斗完全不写生命操作，因此两次舍入不会让人物卡漂移一点。两个方向都不会把大于零转换成小于一，所以不会有人因舍入而从战斗或人物卡中出局。
- **零生命就是真实数值。** 生命池为空的成员以倒下状态开战，这正是战斗中被击倒成员已有的状态。限制为 1 会凭空创造人物卡没有的生命。全员倒下的队伍立即战败并结束战斗，这才是准确结果。反向也相同：零生命的参战者将人物卡写为零。
- **只有带目录标记的行会成为技能。** 手填行背后没有 `mechanics`，因此无从转成数值。费用若指向 Engine 无法消耗的池(生命、池组、职业资源)，会排除该技能，而不是变成免费。`utility` 和反应条目也会排除。
- **`power` 是校准值，而非直接计算结果。** 它是相对参战者攻击力的倍率，因此桥接将平均数量除以 7，限制到 0.5 至 3：基本武器于是落在 Engine 自身基本技能的水平(攻击 1.35、治疗 1.15)，三级范围法术则达到生成技能已经使用的上限。更大的骰池绝不会产生更小的倍率。
- **写回经过人物卡自身规则。** 每个差额转为 `damage`、`restore` 或 `spend` 操作，通过 `applyRulesetSheetOp` 应用，因此战斗绝不能写入来自 Game Master 或玩家时会被人物卡拒绝的内容。写回不是全成或全败：拒绝的操作跳过并返回给调用者，已接受的操作保持生效。放弃的战斗不写任何内容，视为战斗没有发生。
- **摘要携带人物卡需要的内容。** `buildTacticalSummary` 现在也报告 `mp`、`maxMp` 和 `spellSlots`，与导演摘要原本的做法相同。
- **桥接刻意不读取的内容。** `attackRoll`、`save`、`concentration` 和 `perCostStep` 保持已验证但未使用，`coverage.combat` 保留自身含义。应用这些就意味着声称实现某系统的战斗，那属于战斗交接文档的工作。

## 切片 8c 确定了什么

三部分均已实现：随人物卡缩放的目录值、`use` 命令，以及 Refresh from ruleset。

- **一行可以携带四个由规则集维护的数字。** 目录条目行增加可选的 `scaled` 映射：最多四个该行自身的 `number` 列，每个形如 `{ from: <value reference>, table?: <step table> }`。没有 `table` 时，列直接取引用值(诀窍使用次数等于属性值)；有表时则查表(按等级确定 Rage)。更复杂的内容由规则集声明 `derived` 值，再由条目引用，因此格式不学习新的计算方法。`values` 仍保存尚未知道人物卡时该行的普通数值。
- **两种目录形状共用一次检查。** 交叉检查位于内联条目和资源条目都经过的 `rulesetCatalogEntryIssues`，所以缩放行无论如何分发都受同样规则约束：键是该行列表的 `number` 列，`from` 可解析，且该行是条目在该列表中的唯一行，让人物卡上的标记行能无须猜测地映射到一份规格。原本验证其他全部值引用的 `checkRef` 闭包成为共享的 `rulesetValueRefIssues`，因此派生值中有效的引用，在缩放列中也有效。缩放列可像实时池的 `max` 一样引用任何已声明派生值，因为它不属于人物卡自身由上到下的顺序。
- **编辑时计算，读取时绝不计算。** `packages/shared/src/features/rulesets/scaled-rows.ts` 中的 `recomputeScaledRows(definition, build, catalogs)` 在没有变化时返回同一个构筑引用，所以仅打开的人物卡绝不重写。值会适配目标列(限制到 `min` 和 `max`，整数列向下取整)，因此不能写入编辑器会拒绝的值。实时状态、提示词块、战斗桥接和服务器继续读取已存数字。`scaledRowColumns` 告诉编辑器应锁定哪些单元格。
- **不会根据缺失目录猜测。** 没有 `_catalog` 标记的行、调用者未获取的目录、已经消失的条目，均原样保留，因为无法知道规则集对该行的意图。
- **`use` 是不使用“法术”一词的施放辅助命令。** 形式为 `[sheet: who="Name" op="use" name="..."]`，以 `op="cast"` 和 `spell=` 为别名，正如 `heal` 是 `restore` 的别名。它支付每项 `mechanics.cost`，再从同一条目写入的每个列表行池各扣一份。指定池组的费用按声明顺序，从组内第一个付得起的池支付，绝不会自动升级到更高池，因为组不一定是阶梯。`pool=` 表示升阶支付，仅对同一组内的单项费用接受。要么全成，要么全败：在工作副本上逐步通过 `applyRulesetSheetOp` 执行，首次拒绝就拒绝整个命令。无费用条目返回 `ok`，不改变任何内容。新增拒绝原因是 `unknown-entry`、`ambiguous-entry` 和 `bad-pool`。
- **名称就是 Game Master 看到的名称。** 行依次响应 `gm.sheetSummary` 名称列、`pools.nameColumn`、列表第一个文本列，以及条目自身的 `label`，所以重命名的行仍有效。无法加载的目录读作 `unknown-entry`，并记录服务器日志：Engine 不知道价格，也不会捏造。
- **只有回合需要时才加载目录。** 回复未携带 `use` 或 `cast` 命令时，`loadTurnRulesetCatalogs` 不读取任何内容；需要时也只读队伍自身行引用的目录。路由读取资源的部分移至 `services/game/ruleset-catalog.service.ts`，将打开目录与读取目录分两步，使路由仍能在解析一兆字节之前回答 304。加载失败记为 `logger.warn`，绝不丢失回合。
- **从字节读取 Capability API 1.23 要求。** `scaled` 是严格文件中的新键，所以旧 Engine 会拒绝包含它的内容。安装时已具有 `ruleset.json` 和每个声明的 `catalogs/<id>.json` 的已验证字节，因此两者都检查：缩放行无论内联还是资源文件，都需要 1.23。无法解析的文件仍如往常一样跳过检查。
- **刷新只提供规则集更新后的文本。** `packages/client/src/lib/ruleset-catalog.ts` 中的 `planCatalogRefresh` 和 `applyCatalogRefresh` 只比较条目实际设置的 `text`、`longtext`、`dice` 和 `enum` 列，绝不比较缩放列，也不比较列本身会拒绝的值。数字或布尔值保存玩家状态，又没有存下可合并的基线，所以原样保留；编写指南将其明确为限制。行数一致时，按同一列表内同标记行之间的位置匹配原条目行，否则只在条目对该列表写单行时匹配；原条目已消失的行静默跳过。
- **必须审核，绝不背着玩家应用。** 没有差异就不显示任何内容。有差异行的列表会显示一行普通提示(不是实时通知区域，避免输入人物卡时反复播报)，以及打开 `RulesetCatalogRefreshModal` 的 **Review**(审核) 按钮。弹窗并列展示每行不同列的人物卡文本与规则集文本，并为每行提供默认勾选的选框。**Update selected**(更新所选项) 以一次 `commit` 应用全部，只写不同列，保留行的其他所有键，包括 `_catalog` 标记。取消不作更改。
- **编辑器只加载人物卡引用的内容。** `RulesetSheetEditor` 通过基于选择器自身 `rulesetCatalogQuery` 的 `useQueries` 获取构筑标记所指定的目录，让选择器、战斗预取和编辑器共享同一个缓存项；没有标记的构筑不获取任何内容。待完成或失败的加载读作“暂时没有目录”，不锁定也不重新计算。`commit` 仍是唯一更改路径，现在会对补丁后的构筑运行 `recomputeScaledRows`；仅打开人物卡从不调用 `onChange`，在目录到达前编辑过的人物卡，会在目录到达时更新一次。
- **在两个示例上验证。** `docs/examples/rulesets/ember-roads.json` 在完全没有等级的 2d6 系统上，无须表格，直接按属性值缩放诀窍次数；5e 示例则配合测试目录，其职业资源通过阶梯表跟随 `level`。验证包括 `scripts/regressions/game-ruleset-scaled-rows.regression.ts`、实时与目录回归中的 `use` 用例，以及对两个示例检查刷新的客户端路径 `scripts/regressions/ruleset-catalog-refresh.regression.ts`。

## 切片 7b 确定了什么

第二种结算类型 `dice-pool`。计划原本希望与已经使用骰池系统的社区作者一起定义，但无人回应，因此词汇取自现实骰池系统的实际需求，并在 PR 中邀请这类审核。

- **同一人物卡，数字含义不同。** 人物卡已经为检定计算的一切(属性调整值、熟练档次加值、自由的逐项加值)，在 `dice-pool` 下都表示骰子数量。没有新的人物卡词汇、新编辑器或第二种声明评级的方式。`formatRulesetCheckValue(definition, value)` 是唯一决定数字显示为 "+5" 还是 "5 dice" 的位置，提示词人物卡块、编辑器和游戏内人物卡全部经过它。
- **两种类型通过结构共享人物卡计算。** `abilityModifier`、`proficiency` 和 `proficiencyTiers` 组成一个对象，再展开到联合类型的两个成员中，所以拒绝“有倍率却没有可乘加值”的交叉检查同时运行；dice-sum 独有规则(自然骰面需要单骰)留在自身分支。
- **此类型能表达什么。** `die.sides`、`pool`(人物卡数字被限制的范围，`min` 为 0 允许空池无须投骰直接失败)、`target`(固定，或 Game Master 可调整的范围)、`double`、`explode`(可连锁，上限为骰池自身最大值)、`cancel`、`botch`、`exceptional`、`situationalDice`，以及所需成功数的 `difficultyLadder`，每档可选单独目标。永不可能触发的规则在导入时拒绝：骰子范围外的骰面、同时算成功的抵消骰面，以及指定 Game Master 无法设定目标的梯度档。
- **大失败在抵消前判断。** 规则是“没有骰子成功，并且出现大失败骰面”，因此唯一成功被抵消的骰池属于失败而非大失败。大失败强制检定失败，所以不能同时报告大失败与成功。
- **三个逐检定属性会限幅，而非拒绝。** `threshold=`(仅目标可调整时)、`bonus=`(仅有 `situationalDice` 时)和 `with=`(用自身之外的属性作技能或豁免检定)。超出声明范围的值拉回最近边界；规则集不提供的属性则忽略，并记一条调试日志。已结算记录由结果(`SkillCheckResult.threshold`、`bonusDice`、`withAbility`)写出，所以显示实际应用值，而非原始请求；只有没有投骰的稀疏重写才保留原请求。由于共用调整值函数，`with=` 对两种类型都有效，5e 规则集因而自动获得 "Strength (Intimidation)"。
- **骰池结果始终由 Engine 产生。** `rulesetVouchesFor` 从不为骰池担保：数值虽能审计，但一把骰子有太多内部自洽的结果，审计无法约束任何东西。因此 `isRulesetRollableSkillCheckTag` 接受模型习惯性写出的任何 `dice=` 或 `resolution=`，并忽略 `mode=`，因为骰池来自人物卡，而此类型没有优势机制。玩家在回合前投的骰子绝不适用。
- **难度是成功次数。** 在 `isResolvableSkillCheckRequest` 中，其上限为 `rulesetPoolMaxSuccesses`(最大骰池，加上同样多的爆骰，骰面计双份时再翻倍)，即模式允许梯度档或 `exceptional` 请求的同一个数，而非 d20 边界。结算器再限幅一次，因为可预见骰池会在加载任何规则集之前限制写下的 DC。
- **可预见的单请求骰池不参与。** 该池保存二十面骰，因此 `dice-pool` 游戏与已有的 2d6 `dice-sum` 规则集一样走不可预见分支：Engine 投检定，不消耗池值，也不为非池决定的投骰记录槽位。由于骰池规则集根本没有 `dice`，相同门控现在先读类型再读骰子。骰子占位符(`[[roll: 1d8+NAME]]`)在骰池规则集下不解析人物卡名称，提示词也不提供这些名称，因为将骰子数量加到伤害骰上，会产生含义不同的数字。
- **`SkillCheckResult` 增加 `threshold?`。** 两条骰池路径都设置它：`dice-pool` 规则集知道自身规则选定的目标，旧 `resolution="successes"` 标签知道收到的目标。序列化器从结果写出 `threshold=`，因此两种写法不会漂移，而旧路径的字节保持不变。
- **从字节读取 Capability API 1.24 要求。** `dice-pool` 结算是旧 Engine 严格模式会直接拒绝的形状，因此安装读取 `ruleset.json`，在较旧声明下拒绝该类型，正如 1.21 的 `catalogs`、1.22 的 `battle`、1.23 的 `scaled`。
- **刻意省略，并在文档中明确说明的内容。** 取最高骰(需要结果类型尚无的部分成功档次)、与属性比较的架势骰池、符号骰、对抗骰池、掷低判定和开放式百分骰，以及带狂野骰的求和骰池。每种都需要独立类型。花资源购买重掷和自动成功，由 Game Master 的 `bonus=` 与 `[sheet:]` 命令处理，而非结算器规则。
- **验证。** `docs/examples/rulesets/gravewatch.json` 是与 Ember Roads 并列提供的原创十面骰池系统。`scripts/regressions/game-ruleset-dice-pool.regression.ts` 固定验证模式拒绝、注入骰序列下的每条特殊规则、限幅、标签属性、各类型提示词行、人物卡块措辞、1.24 安装门控、不变的旧骰池路径，以及可预见骰池回退到不可预见分支。

## 层 L1 确定了什么

这是“未决事项”第 5 项的切片 L1：层是规则集在自身文件内部携带的变体，因此不会在已固定的游戏中缺失，不需要新存储、新渠道，或 API 编号之外的新安装门控。L2(他人分发的层)仍待处理。

- **效果是封闭集合，每项都只收窄或追加。** 向 `gm.checkGuidance` 和新的 `gm.worldGuidance` 追加指引，从枚举字段移除值，以相同结算类型的梯度替换难度梯度，从人物卡编辑器选择器中隐藏目录条目。层不添加选项：层添加的值，对人物卡其他所有读取者以及关闭该层的所有游戏都会是未知值。它也不增加模型调用、实时状态或战斗数值。
- **`gm.worldGuidance` 是基础槽位，不是层的键。** 基础规则集原本无法塑造其游戏所生成的世界。`/game/setup` 解析固定引用一次，将叠层后的 `worldGuidance` 传入 `buildSetupPrompt`，后者渲染为 `<ruleset_world>`。它只在设置时读取一次，永不进入回合；已有的设置提示词调试日志会将其与其他内容一并打印。
- **选择冻结进固定引用的 `options` 记录**，该记录本来就是为此准备的，之前为空。`/game/create` 使用 `rulesetLayerSelectionIssues` 对照定义验证，并以 400 回答 `ruleset_layer_unknown` 或 `ruleset_layer_conflict`，而不是用玩家未选的规则开局。Engine 不拥有的键原样随行，记录仅在输入时按 `RULESET_REF_MAX_OPTIONS` 限制；固定引用本身仍宽容读取，因为现有游戏绝不能变得不可读。
- **只在一个地方应用。** `resolveGameRuleset` 返回生效定义，因此提示词、结算器、人物卡块、编辑器和战斗桥接无须各自修改，就都能看到叠层后的规则集。它还公开 `baseDefinition` 与启用的 `layers: {id,label}[]`。没有调用者依赖注册表对象的身份，因此不需要其他改动。
- **重新验证生效定义，并记录两项放宽。** `rulesetEffectiveDefinitionSchema` 是允许命名空间 ID 的文件模式(注册表会改写社区规则集键，而文件模式拒绝斜杠)，并放宽指引上限，因为层会向每文件限制 1500 的文本追加。它仍有上限，为基础文本加每层自身的 4000。生效定义唯一跳过的是层与字段交叉检查：要移除的值已经消失，这正是目的。
- **层绝不会让游戏失去规则集。** `applyRulesetLayers` 从不抛异常。它先一起验证所有启用层，仅在失败时才逐层添加，保留可用者。已选但文件中不再有的层，以及冲突对中较晚声明的层，只是不应用。两者都写调试日志而非警告，因为每回合都要解析。
- **指引用空格连接，不用空行。** 按 `promptSafeText` 自身规则，格式中的每段指引都是单行；Game Master 提醒在同一个列表项里渲染 `checkGuidance`，换行会被读成新指令。
- **冲突对称，移除较晚的层。** 只指定一侧就够了，由声明顺序决定，所以同样两个选择总会产生同样规则。
- **不重写角色。** 已持有被移除枚举值的人物卡保留并显示该值，编辑器只停止提供；层隐藏的目录条目从选择器排除，玩家已经选过的行仍保留。`catalogEntryHiddenByLayers` 是选择器筛选函数，规则集本身的条目绝不改动。
- **客户端部分建立在同样两个辅助函数上。** `GameSetupRulesChooser` 在所选规则集下为每层绘制复选框，禁用已勾层排斥的层并标出名称；`packages/client/src/lib/ruleset-layers.ts` 保存纯逻辑：切换、选项记录，以及丢弃已安装定义不再包含层 ID 的恢复过程。`useGameRuleset` 应用固定引用的层一次，使所有游戏内读取者看到生效定义，人物卡标题显示规则集名称和启用层。选择器用 `visibleCatalogEntries` 过滤，仅收窄提供范围：Refresh from ruleset 和缩放列直接从查询读取目录，角色与用户角色编辑器完全不传选项，所以不隐藏任何内容。`scripts/regressions/ruleset-layers-client.regression.ts` 固定验证这些行为。
- **Capability API 1.25** 从字节读取，与 1.21 的 `catalogs`、1.22 的 `battle`、1.23 的 `scaled` 和 1.24 的 `dice-pool` 相同：非空 `layers` 数组或基础 `gm.worldGuidance` 都需要声明。
- **在三个示例上验证。** Ember Roads 增加 "Hard winter"(更严苛的梯度、两个指引槽位，以及隐藏消耗 Grit 的诀窍的选择器规则)；Gravewatch 增加 "The long night"(成功数梯度与逐档目标，说明这里没有任何 d20 专属形状)；5e 草案增加 "Low magic"(从施法枚举移除两个值)，以及与之冲突的 "High magic"。`scripts/regressions/game-ruleset-layers.regression.ts` 固定验证模式拒绝、每个示例每种组合的应用、相同引用情况、回退、路由拒绝与冻结引用、提醒、世界提示词，以及 1.25 门控。

## 真正的规则集战斗

**决定。** 在被问及战斗应该采用每规则集 TypeScript 适配器还是数据时，用户在 [#6361](https://github.com/Pasta-Devs/Marinara-Engine/issues/6361) 决定：“为了实现我们能做到的最忠实的 5e 战斗，需要什么就做什么，PR 顺序由你决定。”因此，`combat` 块和 `resolution` 一样，成为为 Engine 所有类型提供参数的已验证数据；战斗交接文档预留的 `5e-2014` 适配器转为 5e 包自己的数据，而原有规则仍成立：格式绝不做成 5e 专属形状。忠实度来自丰富的封闭词汇加包数据，而非只能写某个系统术语的文件。

**架构。** 按以下顺序划分四个边界：

1. 位于 `packages/shared/src/features/ruleset-combat/` 的纯共享结算器，无 I/O，注入投骰器，使用普通可序列化状态。每个行动者从同一合法菜单选 ID。
2. 在战斗导演现有账本上建立一个服务器拥有的会话，作为 `classic` 与 `tactical` 旁的第三种 `style`：相同存储行、修订号、幂等性、互斥锁、窗口，以及单个“选择候选 ID”模型调用。没有第二本账。
3. 现有外壳由其已经接受的 `directed` 属性驱动，用选项菜单替换硬编码菜单，并在日志中显示真实投骰。
4. 桥接按规则集让位：声明 `combat` 的规则集绝不走 `battle` 路径，`coverage.combat` 终于具有实际意义。

**切片。** C1 是模式与结算器。C2 是生物图鉴目录、数值块行动、序列与充能、威胁限幅，以及 5e 包自己的生物和更完整的法术。C3 是导演的 `ruleset` 样式，分为 C3a(会话、路由、持久化、敌人从菜单选择)和 C3b(使用真实数值的 Classic 外壳、`coverage.combat` 为真)。C4 是棋盘，分为 C4a(格式、位置、移动、触及与射程、范围、掩护、借机攻击、选择器和视图)和 C4b(使用 Tactical 样式自身外观在屏幕显示棋盘)。C5 是回合能做什么，以及什么会打断回合，分为 C5a(回合行动经济、附加效果和状态词汇)与 C5b(窗口本身：暂停的行走，以及购买招牌行动的窗口)。C5c 及之后包括其他打开窗口的情况、传奇行动、对抗检定和剩余状态。

### C1 确定了什么

- **块是可选的，未使用时省略而非留空，放在 `battle` 旁。** 规则集可以同时携带两者：过旧而不支持 `combat` 的 Engine 可回退到桥接，一场战斗绝不同时使用两者。它属于 Capability API 1.26，从规则集自身字节读取，与 1.21 的 `catalogs`、1.22 的 `battle`、1.23 的 `scaled`、1.24 的 `dice-pool` 和 1.25 的 `layers` 完全一样。
- **只有 `attack-vs-defense` 一种类型**，像 `dice-sum` 一样参数化：先攻和攻击骰子由声明指定，所以 2d6 系统不需要自己的类型。战斗内豁免投攻击骰，因为 `dice-pool` 规则集没有可与难度比较的总数；编写指南明确说明这一点。
- **每个名称都属于规则集，并且全部交叉检查：** 生命池是已声明、且不从空开始的实时池；防御和先攻调整值是值引用；攻击列属于其指定列表且类型正确；能力列表与 `battle.skills` 使用相同筛选；状态将人物卡自身 ID 映射到封闭效果列表；专注指定实时文本和豁免；濒死指定两个不同轨道；额度 ID 唯一；`attacks[].budget`、`abilities[].budget` 和 `mechanics.budget` 指定已声明额度。
- **行动经济是额度列表**，每项具有按回合或轮次的 `per` 与计数。首先声明的额度是主额度，标准行动消耗它。采用约定而非新增键，是因为标准行动属于 Engine，另一种做法会迫使每份文件用第二种方式声明“行动”。
- **`mechanics` 增加六个可选、增量兼容的键：** `targetCount`、`autoHit`、`applies`(状态、持续时间、可选的结束豁免)、`temporary`、`scales`(按值引用查阶梯表得到的额外骰子)和 `budget`。由 `rulesetCatalogEntryIssues` 检查，因此内联目录和资源目录遵循同样规则。
- **基于人物卡与基于数值块的参战者。** 队友通过 `evaluateRulesetSheet`、`resolveRulesetValueRef`、`readRulesetLive` 和 `rulesetCheckModifier` 读取，并通过 `applyRulesetSheetOp` 写入遭遇内携带的实时数据块。因此，战斗中与战斗后的生命、资源、状态和专注都属于人物卡，中途重新加载也精确一致。敌人则是普通数值块，只存在于遭遇中。
- **合法性只存在于菜单。** `rulesetCombatOptions` 提供行动者当前能负担的内容，费用通过人物卡自身 `use` 命令的试运行定价(`planRulesetUse`，复用而非重写)。它包含升阶使用：同一族的更高池，并由 `perCostStep` 为声明池与支付池之间的每一步增加一次骰子。
- **定义是参数，不是状态的一部分。** `rulesetCombatOptions`、`applyRulesetCombatChoice`、`advanceRulesetTurn` 和 `rulesetEncounterSummary` 都接收固定引用解析到的定义。状态携带 `{ id, version }`，让持久化战斗说明使用什么结算，并保持足够小：队友目录仅保留其自身行引用的条目。
- **事件携带算式，而非结论：** 实际骰面、调整值、总数、对抗的防御或难度、抗性做了什么，以及剩余多少。日志无须自己计算，就能打印 "17 + 5 = 22 against 15: hit, 9 slashing"。
- **不抛异常。** 非法选择按同一引用返回原状态，不作更改，并返回一个带封闭列表原因的 `refused` 事件。
- **C1 刻意不做的内容**保留扩展边界，并在编写指南明确说明：位置、距离、触及、射程、地图范围、掩护和移动(`range`、`area`、`economy.movement` 及四种读取距离的状态效果会验证但不读取)；反应和窗口(`cannot-react`，以及 `reaction` 条目不上菜单)；生物图鉴、多重攻击与充能；敌人选择攻击谁。此时还不能游玩：没有路由、会话或画面。
- **用脚本骰序列在两个示例验证。** `scripts/regressions/game-ruleset-combat-core.regression.ts` 固定验证模式拒绝、机制交叉检查、先攻及两种同值处理、菜单、行动经济、命中、未中、特殊骰面、重击、优势劣势抵消、带抗性/易伤/免疫的类型伤害、优先消耗临时点数、成功半伤或无伤的豁免、范围共用一次伤害骰、经人物卡消耗法术位与空位拒绝、升阶使用、缩放戏法、豁免结束与持续时间状态、受伤打断或第二能力替换专注、幸运骰面复苏与三次失败死亡的濒死、从零治疗、胜利、失败、摘要、1.26 安装门控，以及战斗中通过 `JSON.parse(JSON.stringify(...))` 的状态往返。

### C2 确定了什么

- **目录声明自己装什么。** `holds` 为 `"rows"`(默认，因此此版本之前的所有目录不变)或 `"creatures"`。生物图鉴不声明 `feeds`，需要 `combat` 块和 `threat` 尺度，也从不出现在人物卡编辑器选择器中，因为选择器按 `feeds` 工作，根本看不到它。条目携带 `rows` 或 `creature`，不能同时有，也不能都没有；生物不带 `mechanics`，而是在自身行动中说明效果。混合目录无论内联还是 `catalogs/<id>.json` 资源都会被拒绝，因为两者都在 `rulesetCatalogEntryIssues` 验证。
- **生物用 `combat` 已声明的键编写：** 生命是数值或创建遭遇时投的骰子，另有防御、先攻调整值、以人物卡自身 ID 为键的属性值与豁免调整值、按已声明伤害类型的抗性、按人物卡自身状态的免疫、规则集自身尺度的档位、展示给 Game Master 但从不结算的安全提示词特征，以及行动。它属于 Capability API 1.27，与 1.21 至 1.26 一样从规则集自身字节读取。
- **数值块携带自己的豁免难度。** 使用 `save.difficulty`；若行动本身不要求豁免，而状态通过豁免结束，则用 `saveDifficulty`。任何要求豁免的位置都必须有其一。C1 对目录行的规则(能力来源提供数字)在这里没有对应项，因为数值块不是人物卡。
- **只有生物行动才有的四项：** `uses`(每遭遇或每天)、`recharge`(使用时消耗、所有者回合开始时投骰、达到 `from` 或以上恢复、初始可用)、`sequence`(同一块的其他行动按顺序执行，整体一次额度，每部分独立目标与投骰，绝不指定另一序列)，以及 `signature`(用块自身 `signaturePoints` 购买，自身回合开始时刷新，不在自身回合菜单上)。`rulesetSignatureOptions` 为其定价，`applyRulesetCombatChoice` 消耗，只能在 C5b 于两回合间打开的窗口里使用。
- **序列接收所有部分的目标。** 如果给得更少，每部分就使用列表前面的目标，所以一个 ID 表示“全部打同一个目标”。对其而言战斗已结束的目标所对应部分会跳过，也不会另选目标：选择是调用者的责任。
- **限幅只针对提案。** 已分发的图鉴是作者编写的数据，按原样接受；Game Master 创作的生物通过 `clampRulesetStatBlock`，将生命拉回档位区间，将防御、命中和豁免难度限制为最多高于档位 2 点，丢弃规则集没有的名称及六个之后的所有行动，并减伤直到最佳一轮符合档位 `damagePerRound` 上限。依次减少骰子数量、固定值、序列中的一次打击，最后才减骰子面数，绝不缩减成零。未声明档位回退到最低档，每次更改都返回供日志使用的易懂句子。
- **`damagePerRound` 按一个目标在完整一轮内承受的量读取**，包含序列，而不是单次攻击，因为限幅需要约束的是整轮。
- **查找依次用精确引用、简化名称，再返回空。** `findRulesetCreature` 先匹配 `<catalogId>/<entryId>`，再忽略大小写和标点匹配标签或 ID，最后返回 null。传入目录中没有的引用会让该敌人不参加战斗，并留一个携带 `unknown-creature` 的 `refused` 事件，而不会让没有数值的生物入场。
- **两个示例均已验证**，位于 `scripts/regressions/game-ruleset-combat-creatures.regression.ts`：Ember Roads 提供三个原创生物和三档威胁尺度，5e 草案提供四个；两份文件的格式都不认识对方的术语。

### C3a 确定了什么

C3 分成两部分：C3a 是服务器部分，C3b 是画面。格式未变，因此不提高 Capability API。

- **一本账，第三种 `style`。** `DirectedCombatView.style` 增加 `"ruleset"`。共用相同存储行、命名空间、修订号、实例与请求 ID 幂等性、每聊天队列，以及“模型只从 Engine 枚举的菜单选择候选 ID”的规则。玩家偏好 `GameCombatStyle` 仍只有两个值：规则集样式从来不是偏好，而是带 `combat` 块的规则集游戏所采用的方式。
- **样式自身逻辑位于自己的文件。** `ruleset-combat-director.service.ts` 对 `(definition, state)` 是纯函数，因此回归验证可以无数据库地运行整场战斗。现有 `combat-director.service.ts` 只增加三个分发点：扩展的 `style`、持久状态上的 `rulesetFight` 字段，以及 `advanceCombatDirector` 和 `commandCombatDirector` 中的提前返回，防止任务队列为无法结算的战斗运行。
- **服务器决定战斗按什么结算。** `/start` 自行解析聊天的固定引用，拒绝没有规则集或没有 `combat` 块的游戏。队伍通过 `rulesetSheetBuildsByName` 从聊天自身人物卡读取；该函数移入共享战斗桥接，让 `battle` 桥接和此样式用同样规则将参战者匹配到人物卡。客户端发送的人物卡绝不读取，没有人物卡的成员按名拒绝。
- **敌人数值**依次来自：以 Game Master 指定引用调用 `findRulesetCreature`，再按敌人自身名称查询，再对共享生物形状的提案调用 `clampRulesetStatBlock`，最后由档位自身数值生成普通块(`rulesetTierStatBlock`：生命区间中点、档位防御和命中、一个造成 `damagePerRound` 中点固定无类型伤害的攻击)。每个回退和每条限幅信息都存为会话的 `adjustments`，并记录日志一次。
- **Engine 自身的 `party` 与 `enemies` 每步后保持同步**，因为 `handleCombatEnd`、回顾和日志会读取它们，战斗结束时 `CombatSummary` 也据此填充。胜负由 `rulesetEncounterOutcome` 决定；生命值一致，因为它们就是同一组数值。
- **行动被接受时，在账本自身保存过程中写入实时人物卡状态**；新数据块随响应返回，所以客户端存储不需要重新获取。写入失败则该步失败，因此账本与人物卡永不冲突，此样式根本没有战后写回。
- **菜单由服务器发送，不自行计算。** `rulesetOptionTargets` 是结算器旁新增的共享辅助函数，`applyRulesetCombatChoice` 自己的目标检查也改为通过它，因此客户端收到的列表与规则接受的列表是同一份。
- **`continue` 恰好结算一个无人类操控行动者的完整回合：** 其所有行动、回合结束，以及下一位行动者。选择器将菜单转为 `CombatAiCandidate`，让现有 `chooseCombatCandidate` 选择，所以规则集战斗按与另外两种样式相同的战术评分。每回合最多十二个行动，始终结束回合，也绝不把爆发指向己方：目标是否友军从目标自身读取，而不是从选项原本面向的阵营读取，这正是允许友军伤害的作者所需要的。
- **首领则打开窗口。** 每个候选对应一个 `CombatDecisionOption`，增量扩展 `optionId`、`targetIds` 和 `label`。现有 `continue` 任务通过 `buildCombatBossPrompt` 旁理解规则集的提示词构建器回答：相同的纯 JSON `{"candidateId"}` 答复、调试日志、十秒超时、调用上限；遇到无效输出或菜单中没有的 ID，也同样回退到本地选择器。
- **拒绝不改变任何内容**，不增加修订号、不消耗请求 ID，并以 400 回答，在稳定的 `code` 字段(`ruleset_combat_<refusal>`)中给出结算器自身原因。
- **规则集已消失的战斗**返回已结束、结果为 `flee` 的状态，并有一个导演事件说明原因，而不是 500 或按其他规则结算。这些结果完全不持久化，所以重新安装规则集后，同一战斗会从原处恢复。
- **蓝图使用规则集术语。** 聊天规则集声明 `combat` 时，`/encounter/init` 列出威胁档位和有限大小的图鉴索引(按声明顺序前六十个名称)，并要求每个敌人的 `creature`、`tier` 或 `proposed` 块。没有规则集或没有 `combat` 的游戏仍获得当前不变的提示词；格式错误的 `proposed` 会被丢弃，不会让整个蓝图失败。
- **验证**位于 `scripts/regressions/ruleset-combat-director.regression.ts`(纯逻辑、两个示例规则集)和 `ruleset-combat-director-route.regression.ts`(真实路由、实时写回、不变的 Classic 战斗、模拟模型的首领窗口，以及蓝图提示词)。

### C3b 确定了什么

C3b 是画面。仍不提高 Capability API：格式没有变化，下面三项共享新增内容都是 Engine 外部不会写入的字段。

- **一个判定决定战斗是否属于规则集自身，所有地方都读取它：** `packages/client/src/lib/ruleset-combat-bridge.ts` 中的 `isRulesetCombatFight({ combatDirector, definition, anchor })`。三项必须全部满足。它读取文件声明的块，绝不读取 `coverage.combat`，后者是作者的声称，而非文件实际内容。设置向导和导入审核也通过同一检查说明战斗将如何运行。
- **舞台是 Classic 外壳。** `GameCombatUI` 的 `directed` 属性增加可选 `ruleset` 部分；没有它时，所有 Classic 路径保持原样；有它时，硬编码的攻击/技能/防御菜单、子阶段以及方向键处理，全部替换为规则集自身菜单。立绘、生命条及其动画已经读取由服务器保持同步的 `party` 与 `enemies`，因此完全没有改动。
- **画面不计算合法性或算式。** 菜单、合法目标 ID、费用、预测，以及日志中每个数字都来自服务器视图。规则拒绝的选项直接不发送，所以客户端不会将它置灰；400 拒绝按每个 `code` 显示本地化句子，对于当前构建不认识的代码，回退为服务器自身的句子。
- **措辞属于规则集。** 额度、状态、豁免、轨道、档位、池，以及攻击所对抗的数值，都打印文件声明的标签，所以 5e 显示 "Armor Class"，Ember Roads 显示 "Guard"。只有类型自身的封闭标准行动列表和结束回合由 Engine 命名。
- **日志是单个纯模块** `packages/client/src/lib/ruleset-combat-log.ts`，因此每种事件的句子都能固定验证。没有加值的投骰只显示骰子；多颗骰子的和等于保留值时显示整把骰子；优势和劣势显示两次骰子及所保留的一次，但仅在事件说明倾向哪边时显示。
- **桥接只为这一场战斗让位。** `startBattleParty` 不从人物卡初始化，`handleCombatEnd` 不调用 `applyRulesetBattleResult`，因为服务器已经在每个被接受的步骤发生时写入。带 `battle` 而不带 `combat` 的规则集，以及没有导演的游戏，继续保留原桥接。
- **回顾使用真实摘要。** `CombatSummary` 增加可选 `ruleset` 字段，携带 `RulesetEncounterSummary`；回顾以规则集自身池的当前值和最大值显示生命，列出谁倒下、濒死或稳定，按标签显示状态，显示规则集自身轮次，并用一行说明人物卡已保持最新，取代百分比描述。
- **三项小型共享新增，全部为增量扩展：** `RulesetEncounterSummary.party[].stable`(否则回顾无法区分已停止恶化与仍在倒计时的人)、`CombatSummary.ruleset`，以及 `CombatEnemy` 和 `Combatant` 上的 `creature`/`tier`/`proposed`，让蓝图自身术语通过客户端流程抵达 `/start`。
- **一项小服务器改动：** `syncRulesetCombatants` 现在按战斗轮次设置导演自己的 `round`。以前它始终停在一，导致整场都显示 "Round 1"，回顾也显示 "after 1 round"。
- **验证**位于 `scripts/regressions/ruleset-combat-screen-client.regression.ts`(通过真实英文词库检查两个示例规则集的每种事件句子、菜单分组、目标选择、上述判定的全部组合，以及来自真实摘要的回顾)，以及 `e2e/game-combat-director.e2e.ts` 的第三种模式：通过真实路由导入 Ember Roads 并完成一场战斗。

### C5a 确定了什么

C5a 处理共享端和服务器端一个回合能做什么。所有内容都是可选的增量扩展，未声明任何内容的规则集仍按原先方式逐字节结算。

- **一次打击可以包含多个数值。** 目录条目的 `mechanics.plus` 和生物行动的 `damage.plus` 最多包含三个子项，各自投骰、指定类型、独立应用目标自身抗性、独立被重击翻倍，也各自可以要求目标进行独立豁免(`onSuccess: "none"` 令该子项归零，`"half"` 留下一半)。组合后的打击只按合计伤害作一次专注检定，也只作一次倒下检查。预测、威胁限幅和每轮伤害测量都计入子项；带豁免条件的子项按全量计算，因为预测描述的是这一击可能做什么。
- **一次额度可换多次打击。** `combat.attacks[].strikes` 是值引用。首次执行消耗额度，将剩余次数放入 `combatant.strikesLeft`；只要手中还有，声明 `strikes` 的列表中每行都以零额度费用提供，并携带 `option.strikes` 让菜单说明剩余次数。不同武器、不同目标及其间行走都自然来自菜单，无须特殊处理。一次支付只买一次打击的列表不会产生剩余次数，也不发事件，因此现有日志不变。
- **改变行动经济的能力。** `mechanics.free` 不消耗额度；`mechanics.gives` 在使用瞬间增加额度并限制增加后的上限；`mechanics.standard` 以 `standard:<id>@<budget>` 提供具名标准行动，由授予该许可的能力定价。声明 `gives` 或 `standard` 的 `utility` 条目会构建为行动，而非丢弃；只有 `standard` 的条目自身仍不出现在菜单，因为许可不是可以执行的动作。
- **附加效果。** 新目录条目类型 `rider`，以及生物自身的 `riders[]`。它们是被动的，永不上菜单，并为周期内第一次符合条件的命中增加一个子项。适用哪些攻击在开战时解析一次，来自指定攻击列表及其行中一个真值列，因此结算时不再读取人物卡。`oncePer: "turn"` 在每个回合开始时清除，无论是谁的回合，所以别人在行动时打出的攻击也可以携带它。
- **状态词汇。** 新增五个效果，以及 `saves`(两个豁免效果涉及哪些豁免)、`whileSourceInSight`(控制该状态全部效果的条件)和 `endsWhenSourceDown`。追踪状态本来就记录施加者，因此三种与来源绑定的效果无须新增存储。
- **验证**使用 `scripts/regressions/game-ruleset-combat-core.regression.ts` 的 C5a 块(拒绝、子项、打击、行动经济、附加效果、状态、两个示例，以及与不携带任何这些键的规则集同场战斗逐事件比较)，还有 `game-ruleset-combat-grid.regression.ts` 中仅适用于棋盘的状态用例。
- **留给 C5b 及之后：** `on` 只有 `hit` 一个值，所以附加效果仍自行触发。`combat.standard` 保持为普通字符串的封闭列表，因为现有规则集都这样编写；闪避在更难命中之外做什么，则写在旁边的 `combat.standardEffects.dodge.saves` 中。

### C5b 确定了什么

C5b 是窗口：为当前行动者之外的人，在一步和下一步之间让战斗等待。

- **没有新键，也不提高能力 API。** 窗口读取的词汇全部已经存在：`combat.opportunity.budget` 说明打击经过者的费用，生物的 `signature` 和 `signaturePoints` 说明点数可以买什么。变化在于 Engine 改为询问，而非代为决定：借机攻击原本会替持有者执行，招牌行动原本可在自身回合之外的任何时刻购买。本切片之前构建的包，也会一问一答地进行同一场战斗。
- **窗口存在于状态中。** `RulesetEncounterState.window` 保存类型、开启原因、谁仍需回答；若由行走打开，还保存剩余行走：已经经过的格子、待经过的格子、已支付内容和已经询问的人。行走中保存的战斗回来后，仍有相同的人等待询问、相同的格子等待走完。`windows` 统计曾打开的每个窗口，因此针对已关闭窗口写下的回答会被拒绝，而不是消耗在取代它的新窗口上。
- **窗口打开期间，其他任何内容都不推进。** 包括结束回合在内的其他选择都以 `window-open` 拒绝，指向其他窗口的回答以 `stale-window` 拒绝。两种情况共用一个入口：`applyRulesetCombatChoice` 像接收回合选择一样，从 `rulesetWindowOptions` 或 `RULESET_PASS_OPTION` 接收回答。
- **每人一次回答。** 窗口对每个等待的参战者只问一次，无论攻击或放弃；已经没有可用回答的人会被移除，而不会为了只剩放弃的菜单继续暂停战斗。整次行走每人一次机会，无论路径多少次离开同一触及范围。
- **即使最后一击结束了战斗，行走也要完成收尾**，因为行走自身事件说明移动者实际停在哪里。
- **由导演驱动。** 窗口中所有不由人操控的参战者都会当场回答，从窗口自身菜单、按操控其回合的相同评分来选择；Game Master 的首领通过 Game Master 自己的决策询问，并将放过此刻列为一种答复。窗口只为某人的自身队友保持等待，客户端用 `DirectedRulesetView.window` 绘制问题及 Pass。
- **验证**由 `scripts/regressions/game-ruleset-combat-grid.regression.ts` 的窗口块(保持等待、菜单、攻击、放弃、拒绝、每次行走一次机会)、`game-ruleset-combat-creatures.regression.ts` 的招牌窗口，以及 `ruleset-combat-director-route.regression.ts` 的首领自身窗口覆盖。
- **留给 C5c 及之后：** 还有什么会打开窗口。标记 `reaction` 的目录条目尚未指定触发条件，所以仍不上任何菜单；说明反应回应什么的词汇，以及反制带来的嵌套、取消和退款，属于下个切片。

### C5c 确定了什么

C5c 处理的是时机：反应等待哪一个时机，让标为 `reaction` 的条目终于有了属于自己的窗口。

- **`mechanics.reaction` 可以是对象，而不只是 `true`。** `on` 指定时机，`at` 指定所执行内容指向谁，`cancels` 则中止窗口暂缓的内容。`true` 仍保持原意，仅表示某项内容不在回合内执行；只写这些信息的条目仍不会出现在任何菜单上。Capability API 1.33，与 1.23、1.26 至 1.30 完全一样，从目录资源自身的字节读取。
- **只有两种时机，因为必须由 Engine 来察觉。** `aimed` 是某项内容命中持有者之前，`harmed` 是某项内容伤害了持有者之后。时机列表封闭的原因与效果列表相同：没有任何逻辑监视的时机，就不会打开任何窗口。
- **`aimed` 只针对对方打开；`harmed` 针对任何人打开。** 被瞄准关注的是别人打算对你做什么，朋友为你治疗并不是需要回应的威胁；如果也打开窗口，由 Engine 操控的盟友就可能取消自己朋友的治疗。受到伤害则是发生在你身上的事实，无论出手的是谁；而指回来源的反应仍受普通目标合法性规则约束，不会指向朋友。
- **恢复记录说明自己的类型。** 行走的恢复记录带有 `kind: "walk"`，动作的带有 `kind: "action"`。C5b 保存的行走中途战斗，其恢复记录没有这个字段，会被读取为它唯一可能代表的行走。
- **Engine 可以放过一个时机。** 窗口菜单将“放过这个时机”作为候选项，像结束回合一样参与权衡，因此有可用反应不再意味着一定会花掉它；这也包括 C5b 对走开者的攻击。无需选择目标却会作用于某人(移动者或时机来源)的选项，会按它将对那个人造成的效果来权衡(`rulesetWindowTargetOf`)。选择器给出的答案若被规则拒绝，就会放过时机并记录日志，因为拒绝永远不会被记入记录，否则这次放过会看起来像是主动选择。
- **在询问任何人之前，先支付费用。** `aimed` 窗口在预算和资源池已经支出之后打开，所以取消型回应阻止的是动作发生，而非阻止购买动作。这就是战斗本身对“被反制的法术是否仍消耗法术位”的回答；想要另一种答案的规则集需要退款词汇，而这里还没有。
- **`harmed` 从动作自身写下的伤害读取**，而且在动作完全结算之后读取，因此解析器内部不必知道窗口存在。一个动作伤害三个人，会打开一个列出这三人的窗口。
- **`at: "source"` 会填入目标，而不是提供目标选择。** 对于大多数此类反应，造成该时机的人是唯一目标，因此选项完全不携带目标，客户端也不显示选择器。`at: "chosen"` 则保留条目自身的目标。
- **会取消内容的 `utility` 条目确实有作用。** 此前，没有 `gives` 也没有 `standard` 的 `utility` 条目会因没有可结算内容而被丢弃；取消某件事本身也是结算。
- **仍然一次只开一个窗口。** 窗口内发生的内容不会再打开窗口，因此反制本身不能再被反制，伤害某人的反应也不会打开第二个时机。源码将其标为当前限制，并将战斗交接文档描述的有界栈作为后续解决办法。
- **已验证**：`scripts/regressions/game-ruleset-combat-core.regression.ts` 的时机测试块覆盖了不出现在任何回合菜单上、窗口及其触发条件、菜单只包含等待当前时机的内容、取消、无论哪种结果都已花掉的预算、放过时让暂缓动作继续、受到伤害打开第二个时机、回应指回造成时机的人，以及不会打开第三个窗口。
- **由 Engine 操控的队员可以从更大的资源池付费。** 此项并入自[问题 #6528](https://github.com/Pasta-Devs/Marinara-Engine/issues/6528)，因为它涉及同一个衔接点：玩家可以选择为能力付费的资源池，而 Engine 自己的选择器只看得到基础费用，因此交给 Engine 操控的角色从不会施放增强版本的法术。候选构建器现在为每种付费方式生成一个候选，分别携带 `choice.payWith`、额外级数实际带来的预测效果、标明资源池的标签，以及同时计算攀升档数和用量的价格，避免把更强版本当成免费版本。**对手保持不变，因为它们没有可向上攀升的资源池：** 属性块的动作不消耗任何资源池，所以无论 Engine 操控的对手还是Game Master的首领，都没有更大的付费方式。给属性块增加自身资源池属于格式变更，并非本次变更。(这项变更随后实现了：以人物卡形式编写的生物拥有资源池，也会像其他人一样获得更大的付费方式。参见“生物人物卡确定了什么”。)
- **留待以后处理**：改变被回应内容中的某个数值，而非将其阻止的反应。状态词汇是封闭的名称列表，并非修正值，所以规则集尚不能表达“在你的下一回合之前更难被命中”，无论由反应还是其他内容来表达。这是状态问题，而非反应问题。

### 生物人物卡确定了什么

[问题 #6610](https://github.com/Pasta-Devs/Marinara-Engine/issues/6610)：用规则集自己的术语编写图鉴生物。并非每个规则集的对手都适合用一组固定的简单数值表示；对手也无法从自己没有的资源池中支付任何费用。

- **生物可以携带 `sheet`**，形状与人物卡相同，但每个部分都可选，而且没有 `live` 部分；由于图鉴是编写的数据，因此严格校验。Capability API 1.34，与 1.27 完全一样，从规则集和目录文件自身的字节读取。
- **每个数值只有一个来源。** 有人物卡时，禁止在旁边填写 `health`、`defense`、`initiativeModifier`、`speed`、`abilities` 和 `saves`，也可以没有属性块动作；没有人物卡时，仍像以前一样要求前三项和一个动作。发布的 JSON Schema 表达了这两种情况(生成器中的 `oneSourceForCreature`)。
- **共用一个构建器。** `encounter.ts` 中的 `sheetCombatant` 同时构建队员和基于人物卡的对手，两者因此不会逐渐偏离。属性块增加的内容(自己的动作、招牌点数、附带效果和能够抵御的伤害)叠加在其上。
- **按编写数据校验**：逐个对照人物卡声明检查 ID，按提供的熟练等级检查技能和豁免，按各自范围中的整数检查属性值和加值，按每个列表的 `maxItems` 检查行，通过共享的 `rulesetListRowIssues` 检查字段和行单元格(现在也会检查字段)，并对照供给该列表的目录检查 `_catalog`，若目录内联还要检查其是否包含该条目。
- **路由加载人物卡要读取的内容。** `rulesetBestiarySheetCatalogIds` 列出图鉴人物卡选取行所用的目录，这些目录在图鉴之后加载，而且仅当人物卡指定了目录时才加载。
- **资源池和更大的付费方式自然生效。** 候选构建器从未按阵营限制，只看动作是否有可向上攀升的资源池，因此拥有人物卡的对手会在 Engine 的选择器和Game Master的决策中获得更大的付费方式；后者原本就携带 `payWith`。
- **现在可以在对手的伤势轨道上作标记。** 先读取其抗伤能力，再标记轨迹，因此对拥有人物卡的生物而言，“抗性不能描述轨迹”的旧限制已经消失；使用简单数值的生物仍然扣除点数。
- **它仍然是对手。** 零点时判定战败依据的是阵营，死亡轨迹也是如此。实时回写不仅以是否拥有人物卡为条件，还以阵营为键：否则，基于人物卡的对手若恰好与队员同名，就会覆盖该队员存储的人物卡。
- **Game Master临时创造的生物也可以使用人物卡**，因为临时创造的法师需要法术位和法术(用户在 PR 上作出的裁定)。`rulesetProposedCreatureSchema` 接受宽松的 `sheet`(角色构建所用的 schema)，并丢弃人物卡旁边填写的数值，而不是拒绝整个提案。`hold.ts` 分三步限制它：`readProposedRulesetSheet` 按名称丢弃规则集中不存在的内容，调整值使其符合要求，并将以目录条目命名的行转换成该条目(路由会加载供给提议人物卡所填写列表的所有目录)；`holdRulesetSheetHealth` 通过生命资源池读取的单个字段，或仅含一个字段的 `sum`，把生命值调整到档位区间内，其他情况则保留原值并附上一行说明；战斗构建完成后，`holdRulesetCombatant` 直接在战斗单位上限制防御、命中和豁免难度，并缩放最佳回合的效果，计算时考虑支付得起的最大费用。一次支出购买的攻击会保留待用，可以分配给任意攻击行，因此衡量攻击回合时，采用付费的那一行，并将其余攻击算在最重的攻击行上。人物卡旁边的属性块部分仍经过普通限幅。蓝图提示词携带一个 `EncounterSheetBrief`：各个 ID、每项允许的内容、战斗读取的列表、打开每个列表目录的字段，以及每个列表最多 60 个目录名称。
- **临时创造的非首领敌人遵循其规则集自身的职业限制**(用户的裁定：“让 Sorcerers 无法使用整个法术列表”)。无需更改格式：目录过滤器的 `startFrom` 原本就指定条目按哪个人物卡字段组织，`restrictRulesetSheetEntries` 只保留过滤条件匹配人物卡值的条目，由 `sheetFieldMatchTexts` 进行匹配(已移至共享层，使选择器和战斗保持一致)。任何规则集都没有声明各职业等级的法术位数量(5e 将这些数量输入字段)，因此没有职业表可据以限制；档位限制约束的是这些法术位能购买的效果。
- **按性格和能力水平填充未定选择，无需模型调用。** `fillRulesetSheetChoices` 会为生物需要作选择的每个列表(带有 `onlyWhen` 的能力来源)填入向其开放、且自身资源池付得起的条目，每个资源池档位采用固定数量(新手到大师分别为 1、2、2、3)，随意使用的条目也采用固定数量(2、2、3、3)。在规则集能声明职业有多少选择之前，这是 Engine 侧的限制。填充时，将条目的性质(伤害、支援、控制或改变回合进程)与战斗 AI 自身的性格相权衡，能力水平越高，越重视改变回合进程的内容。路由在构建战斗前，就用选择器会使用的同一单位和种子为敌人赋予战术，使生物以同一种性格填充选项并作战。首领免于这两项处理：由Game Master完整编写。
- **缩小枚举字段取值范围的层不会让生物丢失。** 生物的枚举值可以是被某个层删去的值，这些值从定义自身的 `layers` 读回；除此之外，仍不允许任何未声明内容：`refineRulesetDefinition` 传递 `layersApplied`，而可能持有分层定义的游戏目录加载器传递 `narrowedByLayers`，因此层不会被悄悄丢弃，图鉴文件不会因为层删去的值而遭拒，拼写错误仍然会被拒绝。软件包安装从不解析目录文件，所以没有需要设置的安装时路径。
- **`no-health`。** 总计没有生命值的人物卡在创建战斗时会被排除，并给出专门原因，而不是以无法击杀的状态加入。图鉴中的字段如果超出范围，在导入时就已遭拒，因此只有结果为零的公式或手工构建的属性块会走到这里。
- **每个拒绝原因在两侧都有文字说明。** C5b 的 `window-open` 和 `stale-window` 此前在英语文案目录和服务器上都没有对应句子，C4a 的四个位置相关原因在服务器上也没有。现在全都有了；如果新增原因却没有两侧说明，屏幕客户端测试通道就会失败。
- **已验证**：`scripts/regressions/game-ruleset-combat-creature-sheets.regression.ts` 覆盖单一来源、ID 和引用、在 5e 草稿和 Ember Roads 上与队员相同的数值、人物卡旁保留的属性块、自身 Luck、解析器以及 Engine 选择器和Game Master中的更大法术位、伤势轨道和免疫、战败、投影、回写、拒绝、提案以及 1.34 门槛；此外还有路由测试通道中法术来自另一目录的施法者，以及 JSON Schema 测试通道。

### C4a 确定了什么

C4a 是共享层和服务器侧的棋盘。C4b 是绘制棋盘的屏幕。

- **一个格子代表多远，由规则集决定；声明这一点后，战斗才可以具有位置。** 新增可选的 `combat.distance: { label, perCell }`。属性块世界中声明的每种距离都使用这个单位：`economy.movement`、生物的 `speed`、武器的 `reach` 和 `range`、生物动作的 `reach` 和 `range`。声明了自身 `units.distance` 的目录使用自己的 `perCell` 转换自己的 `mechanics.range` 和 `area.size`；未声明的则使用属性块的单位。Capability API 1.28，与 1.21 以来的每一级完全一样，从规则集自身的字节读取。
- **现有可用行为没有变化。** 没有棋盘的战斗与此前逐字节一致：在如今声明格子大小的规则集上，以及删去所有新键的副本上，比较同一场景的完整事件日志。状态仍为 `v: 1`，因为每个新字段都可选，而且没有相应功能的战斗中不会出现这些字段。
- **要么所有人都在棋盘上，要么谁都不在。** `createRulesetEncounter` 接受可选的 `board: { grid, placements }`，只有当规则集声明了 `distance` 且每个战斗单位都占有格子内的一个位置时才保存。少一个部署位置，整场战斗就保持为想象中的战场，因为有人无处站立的战斗无法回答任何距离问题。
- **格子使用战术引擎自身的实现。** 服务器使用仅携带阵营、首领标记和地块的替代单位，以战术风格使用的同一种子和同一游标调用 `generateTacticalBattlefield` 与 `placeSpawns`。为此，`placeSpawns` 扩展为接受结构类型 `TacticalPlaceable`，`TacticalUnit` 原本就满足它。没有第二套生成器、第二张地形表，也没有这类战斗专属的棋盘大小。
- **八个相邻方向各算一格，距离取两个轴差值中的较大者。** 这正是本功能针对的桌面游戏格子的玩法，并且刻意不采用战术引擎自身的四方向和曼哈顿距离；后者在自己的战斗中完全保持原样。地形 `moveCost` 是进入某格的费用，不能进入任何实心障碍格，不能从两个实心障碍格之间斜穿拐角，可以经过朋友，但不能停在任何人占据的格子上。
- **新增一个纯模块**：`packages/shared/src/features/ruleset-combat/grid.ts`，包含 `rulesetInCells`、`rulesetCellDistance`、`rulesetReachableCells`、`rulesetLineOfSight`、`rulesetAreaCells` 和 `rulesetOpportunityAttack`。它处理真实的爆发、锥形和直线形状，而非旧连接层的单一半径。
- **菜单仍是唯一合法性依据。** 可以走到哪里、选项能指向谁、形状可以瞄准哪里，都是结算用来检查选择的同一套规则；如果目标只要更近一些就会被允许，则以 `out-of-reach` 或 `no-line-of-sight` 拒绝，而非笼统的 `bad-target`。
- **选择器会移动。** 它结合可达的每个格子及从那里可用的每个选项进行权衡，为行走会引发的每次攻击扣分；如果原地已经能发挥最佳效果，就倾向于不动；如果没有任何目标在范围内，就拉近距离(规则集列出 `dash` 时先疾跑)。最多评估 48 格，Game Master窗口最多提供 24 个候选。
- **已验证**：`scripts/regressions/game-ruleset-combat-grid.regression.ts` 覆盖手绘棋盘、预设骰子、两个示例规则集以及逐字节比较，此外还有 `ruleset-combat-director.regression.ts` 和 `ruleset-combat-director-route.regression.ts` 中带位置的案例。
- **留待以后处理**：四分之三掩护、完全掩护、高度、飞越障碍、挤过狭窄空间、躲藏和强制移动。反应窗口本身属于 C5b。

### C4b 确定了什么

C4b 是屏幕上的棋盘。它绘制 C4a 结算的内容，不自行作出任何决定。

- **屏幕遵循视图，而非偏好设置。** 规则集视图携带 `grid` 时，`DirectedCombatUI` 挂载棋盘；没有时保留 Classic 舞台。只有当战斗属于规则集自身、游戏的战斗偏好为 Tactical、且解析后的规则集声明 `combat.distance` 时，客户端才会向 `/start` 发送 `positioned: true`；是否能够绘制棋盘仍由服务器决定。
- **新增一个纯展示组件**：`RulesetCombatBoard.tsx`。没有重构 `TacticalCombatUI`：它的调色板、纹理、地形图标、地块阴影、关键帧和标记辅助函数原样移入 `lib/tactical-board-look.ts`，供两个棋盘导入，因此两者看起来属于同一产品，新地形主题也不会在两者之间产生偏差。
- **客户端不进行计算。** 可达格子及其费用、路径、某一步会引发谁的反应、可选目标、形状可瞄准位置及其涵盖的所有人，全都来自视图。`lib/ruleset-combat-board.ts` 按格子索引这些信息；它唯一推导的数值是规则集自身的距离，即格数乘以 `perCell`，整个屏幕都用这个单位表达。
- **每格只有一个可聚焦元素。** 地块是带有漫游 tabindex 和方向键移动的按钮；标记以 `pointer-events-none` 绘制在上面，因此点击标记就是点击其格子，键盘也只有一种含义。Escape 会放弃尚未完成的选择，并将键盘控制交还菜单，这符合 C3 规则：只有玩家主动关闭时才归还焦点。
- **尚未完成的选择保存在棋盘中**，通过可选的受控 `step` 传回 `RulesetCombatMenu`。没有这对组件时，菜单保留自身状态，C3 屏幕与此前逐字节一致。
- **棋盘保持自己的最小高度**，菜单、提示行和日志各自限制自身大小。在进行中的战斗和 17 行日志下，分别于 1366x850 和 375x812 测量：两种尺寸都没有页面横向滚动，标记不重叠，整个棋盘均可见。
- **已验证**：`scripts/regressions/ruleset-combat-screen-client.regression.ts` 在两个示例规则集上覆盖格子、行走、路径、目标、瞄准、文案、“没有目标在范围内”规则、距离格式化及四种拒绝原因；`e2e/game-combat-director.e2e.ts` 的第四种模式则在真实浏览器中游玩带位置的 Ember Roads 战斗。

## 架构

### 固定引用

```ts
type RulesetRef = {
  id: string; // bare for an official ruleset, "<owner>/<id>" or "local/<id>" for a community one
  version: number;
  packageId: string | null;
  source?: string; // where a community ruleset came from
  options: Record<string, boolean | number | string>;
};
// chat.metadata.gameRuleset?: RulesetRef   (absent means engine-legacy)
```

与 `gameExperienceId` 一样，由游戏创建过程写入一次。`gameRuleset` 在 `ChatMetadata` 接口上声明，因此 GM 动词命名空间推导会将其视为 Engine 所有。未知 ID，或固定的 `version` 比已安装定义更新，都会让游戏进入可恢复的只读状态，并显示清晰消息，绝不会悄悄重新解释。允许已安装定义比固定版本更新，因为人物卡会按当前 schema 宽松读取。战斗交接文档中的 `RulesetRef` 将 `id` 限定为四个内置名称；这里将其扩展为字符串，以支持社区规则集，这也是上文请求签署批准的内容之一。

### `ruleset.json`(Capability API 1.20)

软件包在 `contributions.assets.paths` 中列出 `ruleset.json`，并在 `files[]` 中用哈希固定它。与 `gm-verbs.json` 一样，通过这个保留文件名发现它。Engine 在读取前就拒绝声明大小超过 256 KB 的文件，用严格的共享 zod schema 验证，若无法使用则记录一行日志并丢弃。没有这个衔接点，规则集软件包就毫无用处，因此它声明 1.20，让旧版 Engine 明确拒绝安装。

顶层结构(参见草稿文件)：`id`、`version`、`name`、`edition`、`license`、`coverage`、`resolution`、`sheet`、`rests`、`gm`。

### 结算类型

`resolution.kind` 是可辨识联合。已实现两种类型：

- **`dice-sum`**(切片 2)：投掷规则集的骰子(默认 1d20)，加上属性调整值、熟练等级加值和人物卡上的任意自由加值，达到或超过 DC。支持优势和劣势，以及按投掷类型配置的单枚骰子极端点数策略。`5e-2014` 的检定和豁免使用 `none`，这是与 `engine-legacy` 的刻意差异。第一版草稿将此类型称为 `d20-sum`；后来将骰子改为参数，使 2d6 加属性的系统不必另设一种类型。
- **`dice-pool`**(切片 7b)：投掷人物卡自身指定数量的骰子，统计达到目标点数的骰子，支持可选的双倍成功点数、爆骰点数、抵消点数、大失败、非凡成功和情境骰。使用同一张人物卡：`dice-sum` 中加到投掷结果上的值，在这里就是骰子数量(§ 切片 7b 确定了什么)。

两种类型共享的人物卡计算(`abilityModifier`、`proficiency`、`proficiencyTiers`)只声明一次，再展开到各成员中，因此交叉检查会对每种类型运行，第三种类型也不能为同一个数值另生一套规则。

解析器保留当前服务文档列出的所有不变量：绝不抛出异常，无法进行的投掷会以稀疏字段重写标签，GM 编造的数值会被替换，**Logs**(日志)中的记录由 Engine 写入。

### 人物卡 schema 基本元素

这是一个封闭集合：`abilities`、`skills` 和 `saves`(每项都可以选择指定对应属性)、有类型的 `fields`(`number`、`text`、`longtext`、`boolean`、`enum`、`dice`)、`derived` 值(对值引用应用封闭运算集 `sum`、`stepTable`、`scale`、`min`、`max`)、带 `maxItems` 的有类型列 `lists`，以及 `live` 状态(`pools`、`tracks`、`text`、`conditions`)。值引用是一个对象，必须且只能包含 `const`、`field`、`derived`、`abilityScore`、`abilityMod`、`abilityModFromField`、`skillMod`、`saveMod` 中的一项；不存在表达式字符串。编辑器和游戏内人物卡据此通用渲染，不需要软件包客户端代码，也不需要编辑器插槽。

装备刻意不作为列表：Game Mode已经负责物品栏。人物卡携带 `attacks` 和手动输入的 `ac`。

### 存储：构建与实时状态

| 部分 | 内容 | 存放位置 | 是否随滑动切换回退 |
| --- | --- | --- | --- |
| 起始构建 | 作者输入的全部内容 | 角色卡：`data.extensions.rulesetSheets[rulesetId]`。用户角色：`personaStats.rulesetSheets[rulesetId]` | 不适用 |
| 游戏构建 | 设置时取得的副本，由 Edit Sheet 和升级修改 | `chat.metadata.gameCharacterCards[].rulesetSheet` | 否，与当前的 `rpgStats` 相同 |
| 实时状态 | 当前 HP、临时 HP、剩余法术位、生命骰、职业计数器、状态、专注、力竭、死亡豁免 | 以角色卡名称为键的游戏状态快照 | 是 |

实时状态属于快照，因为人物卡命令是相对操作(“消耗一个 3 环法术位”)，重新生成的回合不能消耗两次。它使用独立列 `game_state_snapshots.ruleset_live`，无需提高 `STORAGE_VERSION`。关于回合如何读写它，参见 § 切片 5 确定了什么。

每张存储的人物卡都是 `{ v, build }`，序列化后超过 64 KB 则被拒绝。

### GM 接口

当游戏的规则集可以解析时，每回合格式提醒(`buildGmFormatReminder`，绝不是系统提示词)会：

1. 用 `gm.checkGuidance` 和难度阶梯替换内置的技能检定段落；
2. 在 `<character_sheets>` 内为每名队员添加紧凑的人物卡块：属性调整值、受训技能和豁免、`gm.sheetSummary` 字段、剩余资源、偏离默认值的轨迹、备注、当前状态以及摘要列表；
3. 教授一条 Engine 所有的命令 `[sheet: who="Name" op="…" …]`，操作集合封闭为：`spend`、`restore`(`heal` 按 `restore` 读取)、`damage`、`temp`、`track`、`condition`、`note`、`rest`。最初提案中的 `concentrate` 已改为通用的 `note`。

Engine 根据实时人物卡验证每项操作。没有剩余法术位的施法会被拒绝、记入日志、以被拒绝的形式写回回复，并每回合显示一次，绝不会让资源池变为负值。`sheet` 属于保留 GM 标签集，动词名称回归检查会在提醒中找到所教授的标签。未固定规则集时，提示词逐字节一致；`game-ruleset-checks.regression.ts` 和 `one-request-dice-prompt.regression.ts` 固定验证这一点，`pnpm regression:prompt` 覆盖提示词的其余部分。

`[skill_check:]` 新增可选的 `who=`。省略时像现在一样检定玩家。豁免通过 `skill="Dexterity save"` 请求，现有标准化器已经能够识别。

单次请求掷骰占位符新增 `PROF`(规则集具有熟练加值时)，以及按 ID 或标签指定的规则集技能、豁免和属性，作为可解析名称；仍遵循现有规则：无法解析的名称会被拒绝，而非当作零。

### 设置、编辑器和游戏内 UI

- **设置向导**：在战斗呈现方式旁边，而非其内部，提供本地化的 **Rules**(规则)选项。默认采用 Marinara 自身规则。每个已安装规则集显示其 `coverage.summary`。队员和用户角色显示是否拥有所选规则集的人物卡；缺少时提供编辑器或空白默认构建。生成过程绝不会编造具有最终效力的属性数值。
- **设置分享**(`game-setup-share.ts`)：若规则集已安装且兼容，则恢复它；否则像 Experience 导入一样报告问题，并回退到默认规则。
- **角色和用户角色编辑器**：在 **Stats**(属性)下，为每个已安装规则集提供一个按 schema 渲染的可折叠子区块。为未安装规则集存储的人物卡显示为一行，带有 **Remove**(移除)按钮。
- **游戏内人物卡**(`GameCharacterSheet.tsx`)：游戏具有规则集时，渲染规则集人物卡，包含实时资源池、休息控件和生命骰消耗。v1 中升级为手动操作：玩家编辑构建，派生值随之重新计算。

### 导入与导出

无需新增内容，人物卡就能随数据传递：`extensions` 和用户角色属性已经通过每个导入器和 schema。规则是**保留休眠数据，绝不丢弃**：导入器缺少其规则集的人物卡保留在自己的键下，不进入提示词，显示为可移除的一行，导入时限制大小，只有在该规则集首次安装并使用时才根据其 schema 验证。丢弃数据会悄悄销毁后来安装规则集的用户，以及重新导出后所有下游接收者的人物卡。

尚未验证：Compatible JSON 和 PNG 导出器是否保留未知扩展键。在文档中说明此行为之前先检查。

## `5e-2014` 人物卡覆盖的范围

| 层级 | 含义 | 内容 |
| --- | --- | --- |
| A. Engine 用于计算 | 具有最终效力的算术计算 | 六项属性值、等级、熟练加值、技能熟练等级(无、半熟练、熟练、专精)、豁免熟练项、施法属性、法术豁免 DC、法术攻击加值、被动感知、先攻 |
| B. Engine 追踪数值 | 强制执行记账，不裁定叙事 | HP 和临时 HP、生命骰、1–9 环法术位、Pact Magic 法术位、短休或长休恢复的具名职业计数器、死亡豁免、力竭、SRD 的十四种状态、专注、短休和长休 |
| C. Engine 存储，GM 读取 | 结构化列表 | 法术(环级、已准备、仪式、专注、备注)、攻击、特性和特质、其他熟练项及语言、职业、子职业、种族、背景、阵营、XP |

v1 刻意不包括：职业和子职业表(法术位上限与 HP 采用输入值，而非派生)、兼职法术位计算、结构化法术汇编、由护甲派生的 AC、自动升级、敌人和 NPC 人物卡、攻击检定和重击(战斗适配器)、工具检定。

法术刻意归于 C 层级。战斗外由 GM 裁定效果；Engine 保证法术确实在人物卡上，且法术位确实消耗。后续战斗适配器为一小部分支持的法术提供机制定义，届时战斗法术位将来自人物卡，而非遭遇生成。

## 软件包

Marinara-Agents 中的 `packages/ruleset-5e-2014/`：包含 `manifest.json`(schema 2、API 1.20、`contributions.assets.paths: ["ruleset.json"]`)、`ruleset.json`、`locales/en.json`、`README.md`、`CHANGELOG.md` 和 SRD 署名。没有服务器入口、客户端入口或 LLM 智能体。切片 1 已确认 `capabilityPackageManifestSchema` 接受 `entrypoints` 为空的软件包，因此无需修改 Engine schema，也不需要虚设智能体。Marinara-Agents 目录验证器仍要求每个上架软件包具有 `entrypoints.agents`，切片 6 必须针对 `ruleset` 类型放宽这一要求。

显示名称为“5e (SRD 5.1)”。不要在名称、描述或美术作品中使用 Wizards of the Coast 商标。逐字复制 SRD 5.1 PDF 中的署名声明。先将 ID 列入 `INCOMPLETE_PACKAGE_IDS`，之后列入 `STAGING_ONLY_PACKAGE_IDS`。

v1 不提供规则世界书。对于能力足够的模型，指引块加人物卡块已经足够；社区中也已经有 CC-BY SRD 世界书，可供希望附加它的用户使用。

## 编写和分享社区规则集

**编写。** 作者从 5e 文件出发，编写一个 `ruleset.json`。选择 Engine 支持的结算类型，声明人物卡、休息和 GM 指引，并用从共享 zod schema 生成、随文档发布的 JSON Schema，以及一个小型验证脚本进行验证。在任何编辑器 UI 出现之前，通过 **Edit Spoilers**(编辑剧透)手工输入人物卡，就足以测试一次检定。

**能力上限。** 数据只能为已有类型设置参数。没有任何类型能表达的机制(爆骰、掷出低于目标值的百分骰、成功程度、Fate 阶梯)，需要提交为 Engine 新增类型并附带回归验证的 PR，不能靠规则集文件实现。这是不使用脚本语言的代价，编写文档必须先说明这一点，而不是留到最后。已经实现这些机制的社区作者正是适合贡献这些类型的人，他们现有的案例就是现成的回归测试。

**分享，共有三条途径。**

| 途径 | 方法 | 适用情况 |
| --- | --- | --- |
| 官方目录 | 向 Marinara-Agents 提交软件包 PR；从 **Download Agents**(下载智能体)一键安装 | 玩家众多且许可清晰的系统 |
| 自定义仓库 | 现有自定义智能体仓库途径也读取 `rulesets/*.json`。用户添加一次作者的 GitHub URL，审阅预览，之后以同样方式获取更新 | 拥有多个系统的作者；请求者的仓库已经采用这种结构 |
| 单个文件 | **Import ruleset**(导入规则集)接受一个 `ruleset.json` | 本地迭代，或向朋友传递文件 |

所有社区途径都受 **Allow custom Agent imports**(允许自定义智能体导入)控制。虽然不执行任何代码，`gm.*` 文本仍会进入 GM 提示词，因此导入审阅会说明这一点，并以与导入智能体提示词或世界书相同的信任标准对待规则集。

**让分享安全的规则。**

- 官方 ID 不带命名空间(`5e-2014`)。社区 ID 按来源区分命名空间(仓库使用 `<owner>/<id>`，文件使用 `local/<id>`)，因此两个作者的 `v20` 永不冲突，也无法遮蔽官方规则集。
- 定义按 ID 和版本存储。更新添加版本，绝不重写旧版本。游戏继续解析自己固定的版本；同一版本若带来不同字节，则拒绝并提示作者提高版本号。
- 人物卡按其规则集当前 schema 宽松读取：保留未知字段，缺失字段采用默认值，超出范围的值在编辑时限幅，绝不在读取时限幅。没有迁移脚本。
- 社区 `RulesetRef` 携带来源 URL。因此，共享设置文件或休眠人物卡可以告诉接收者缺少的规则集来自哪里，而不只是说明缺失。

角色可以独立传递。导出时携带社区人物卡的角色卡会保留它，没有该规则集的接收者将其保持为休眠状态；添加作者仓库的那一刻，它便会激活。

## 提案：目录的其余功能

状态：格式、路由、Capability API 1.21 和人物卡编辑器的选择器均已实现(§ 切片 8a 确定了什么)。第一方 SRD 内容随 `ruleset-5e-2014` 软件包 0.2.0 发布，战斗桥接也已实现(§ 战斗桥接确定了什么)。随等级等因素变化的目录值、`use` 命令和 Refresh from ruleset 也均已实现(§ 切片 8c 确定了什么)。这一需求来自首次实际使用 5e 人物卡：逐行输入法术、攻击和职业特性十分痛苦，社区作者也会希望以同样方式分发自己系统的内容。

**选择器。** 人物卡编辑器为目录供给的每个列表增加 **Add from catalog**(从目录添加)按钮。它打开可搜索的选择器，带有目录声明的过滤器、多选功能，以及人物卡已拥有条目的标记；标记从所选行携带的 `_catalog` 键读取。它只在打开时才从目录路由读取条目，绝不提前读取。**Refresh from ruleset**(从规则集刷新)使用同一标记，提供作者修改过的条目的新文本(§ 切片 8c 确定了什么)。

**目录条目与战斗。** 人物卡及其目录并不会让战斗遵循规则集。现在 Tactical 和 Classic 战斗运行于 Engine 自身的战斗模型(`CombatSkill`：射程、范围半径、法术位环级、相对于攻击属性的威力倍率)，Engine 不按规则集自身规则结算任何内容。没有 `battle` 块的规则集完全不会被战斗读取；有该块的则通过战斗桥接将生命、能量、法术位和目录选择的行提供给战斗(§ 战斗桥接确定了什么)，但仍使用 Engine 的计算。严格遵循规则的结算(豁免成功伤害减半、升环施法、动作经济、哪些超魔可以作用于哪些法术)属于代码，归于战斗交接文档中的各规则集适配器(`game-combat-rulesets-implementation.md`，其中 `5e-2014` 对应切片 5)，而非数据文件。目录能够携带的是这类适配器需要的事实，这正是切片 8a 已为条目提供可选、带类型的 `mechanics` 块的原因：射程、范围形状与大小、攻击检定或豁免(人物卡声明的豁免，以及成功时的效果)、伤害骰与类型、每提高一级费用增加什么、目标、专注。目的就是只输入一次 SRD。在任何适配器存在之前可以先做的较小一步，如今已经实现(§ 战斗桥接确定了什么)：规则集通过 `battle` 块选择参与，战斗开始时从人物卡初始化战斗单位(生命值作为 Engine 自身上限的比例、一个能量池、法术位)，带目录标记的行变成 Engine 技能(以格为单位的射程、范围、法术位费用、元素)，之后将生命、能量和法术位写回。人物卡在战斗中发挥作用，同时伤害计算仍由 Engine 决定，文档和 UI 都会说明这一点。

**曾是后续工作，如今已实现。** 随等级增长的上限(Ki 点数等于等级、按表确定的 Rage 次数)和施法助手(查找法术位的 `[sheet: op="cast" spell="Fireball"]`)都已加入(§ 切片 8c 确定了什么)。条目行携带值引用，并可为该列附带阶梯表；编辑器在编辑时重新计算，绝不在读取时计算，助手则成为通用的 `use` 命令。

**无需修改格式、成本较低的辅助功能**，值得一并实现：把名称列表粘贴进列表以创建各行，以及已经列出的未决事项 1(“根据这张角色卡建议一张人物卡”，由用户审阅并接受)。

格式存在后，为 **`5e-2014` 提供的第一方内容**：SRD 5.1 法术、带资源计数器的 SRD 职业特性(Second Wind、Action Surge、Rage、Ki、Channel Divinity、Bardic Inspiration、Sorcery Points、Wild Shape、Lay on Hands、Arcane Recovery)，以及作为现成攻击行的 SRD 武器表。SRD 5.1 采用 CC-BY-4.0，因此文本可以随软件包已有的署名一起分发。必须依据权威、机器可读的 SRD 副本构建，绝不能凭记忆输入。

**切片。** 8a，Engine：目录格式、资源加载器和路由，以及人物卡编辑器的 **Add from catalog** 选择器，并对第二个非 5e 规则集进行回归验证。已实现。8b，Agents：包含 SRD 目录的 `ruleset-5e-2014` 0.2.0。已发布。8c，Engine：随等级等因素变化的目录值、`use` 命令和 Refresh from ruleset。已实现。将社区目录放在独立文件中(§ 切片 8a 确定了什么记录了此处未包含它们的原因)将是另一个切片。

## 切片与完成证据

每个切片对应一个面向 `staging` 的 PR，在工作开始时打开草稿 PR，并包含 `CHANGELOG.md` 的 `[Unreleased]` 条目、本地化文案、文档、一个 `[docs-i18n]` 后续事项，以及未勾选的手动验证复选框。验证文件采用 `*.regression.ts`；不在代码树中保留 `.test.ts`。

| # | 仓库 | 工作 | 最小而有用的验证 |
| --- | --- | --- | --- |
| 0 | 不适用 | 打开问题(附录)，并取得对 § 与战斗交接文档的关系的批准 | 维护者在问题中的回复 |
| 1 | Engine + Agents | 共享 zod schema 和类型、`RulesetRef`、从已安装软件包读取 `ruleset.json` 的规则集注册表、标为未完成的软件包骨架。无行为变更 | 草稿文件通过验证；未知类型、未知键、过大文件和重复 ID 均被拒绝并记录一行日志；未固定规则集的游戏解析为 `engine-legacy` |
| 2 | Engine | 将 `dice-sum` 解析器接入 `skill-check-resolution.service.ts`；替换 GM 提醒；`who=` | 熟练、专精、半熟练、豁免熟练、等级边界 4→5 和 16→17、优势、低于 DC 的自然 20 失败而高于 DC 的自然 1 成功；旧版聊天的提示词和结果逐字节一致。手动：通过 **Edit Spoilers** JSON 输入人物卡，并查看实际横幅 |
| 3 | Engine | 角色卡和用户角色上的人物卡：存储、通用 Stats 子区块、休眠处理、大小限制 | 在安装和未安装软件包两种情况下，完成 Marinara Native 导出再导入；用户角色标准化保留该键；浅色、深色和 400 px 截图 |
| 4 | Engine | 设置向导中的规则选择、缺失人物卡处理、设置时复制、设置分享 | 新游戏复制构建；游戏内编辑后，库中的角色卡保持不变；没有软件包时导入设置，附带说明并回退 |
| 5 | Engine | 游戏内规则集人物卡、实时状态、`[sheet:]` 命令、休息、保留标签全面检查 | 消耗后滑动切换可恢复法术位；重新生成不会重复消耗；无法术位的施法被拒绝并显示通知；长休恢复一半生命骰，至少一个；名为 `sheet` 的动词被拒绝 |
| 6 | Agents | 完成软件包并放入 staging | `validate-catalog.mjs` 通过；在 staging Engine 上安装、更新和卸载；软件包卸载后的游戏以可恢复的只读状态打开 |
| 7a | Engine | 社区途径：通过 **Import ruleset** 导入单文件，以及通过现有自定义智能体仓库途径读取 `rulesets/*.json` | 带命名空间的 ID 不能遮蔽官方 ID；预览列出新增、变更和移除的规则集；同版本不同字节被拒绝；更新后游戏保留固定版本；关闭导入开关会对新游戏隐藏社区规则集，而不破坏现有游戏 |
| 7b | Engine | `dice-pool` 结算类型。已实现 | 已实现：schema 拒绝、用注入骰子序列验证每项骰池规则、限幅、标签属性、各类型的提示词行、1.24 安装门槛、旧骰池路径保持不变，以及预知结果骰池回退到不预知结果的方式 |
| 不适用 | Engine | `5e-2014` 战斗适配器 | 战斗交接文档的切片 5，在其切片 1–4 之后 |

先做切片 1 和 2，因为它们完全不需要 UI 就能端到端测试，这是发现 schema 错误成本最低的方式。

切片 7a 只依赖 1，7b 只依赖 2。两者都不应等待 3–6：请求来自社区作者，若严格按编号顺序执行，他们反而会最后才得到支持。切片 2 合并后，将 7a 和 7b 与人物卡 UI 并行推进。两者均已实现。

## 未决事项及默认方案

1. **没有人物卡的同伴。** 默认方案：空白构建加手工输入。之后可以合理地添加可选的“根据这张角色卡建议一张人物卡”操作，由用户审阅并接受；因为接受是用户的行为，这仍符合“生成不制造具有最终效力的属性数值”的原则。
2. **XP 或里程碑。** 默认方案：人物卡存储 XP，没有任何机制自动奖励 XP，等级手动编辑。
3. **命令标签名称。** `[sheet:]` 是提案；只要加入保留集合，任何名称都可以。
4. **谁来实现 `dice-pool`。** 默认方案：邀请请求者在问题中给出规格，并在愿意时贡献实现。他们拥有可运行的实现和系统知识；Engine 侧提供衔接点和审阅。

5. **规则集之上的层(例如 5e 上的 Low Magic)。** L1 已确定，即规则集在自身文件内分发的层；参见 § 层 L1 确定了什么。L2，即由其他人分发的层，仍未确定：它是指定 `appliesTo: { ruleset, minVersion }` 的软件包资源或导入文件，像社区规则集一样存储和管理版本，并增加“层缺失”的解析状态。它原样复用 L1 的格式和应用方式。在 L1 合并之前，不进一步设计。

## 本文档尚未验证的内容

`game-state.storage.ts` 以及快照字段是否需要提高存储版本；Compatible JSON 和 PNG 导出路径；`GameSetupWizard.tsx` 以及 Experiences 块在何处写入 `gameExperienceId`；`game-setup-share.ts`；自定义智能体仓库途径在客户端如何呈现，以及其归档读取器是否容许额外顶层文件夹；预知结果骰池与规则集解析器的交互；`game-combat-ai-design.md`。

## 附录：问题草稿

> **Game Mode：可选规则集与规则集人物卡(先从 5e 开始)**
>
> 请求来自 Marinara-RPG-Extension 的作者，目前每个系统每回合都需要四到五个智能体，才能绕过仅支持 d20 的检定和六属性人物卡限制。提案：规则集是经过验证的数据(`ruleset.json`，与 `gm-verbs.json` 一样使用保留文件名的软件包资源)，为 Engine 所有的封闭结算类型集合设置参数，并声明完整人物卡。没有软件包代码、表达式字符串，也不增加模型调用。人物卡作为起始构建存放在角色卡和用户角色中，再复制进各个游戏。
>
> 这里将战斗交接文档中的“内置适配器封闭注册表”理解为适用于结算类型和战斗适配器，而规则集定义属于数据。这样是否可以接受？是否有人正在进行相关工作？第一方范围是基于 SRD 5.1 的 `5e-2014`。战斗保持不变，仍归战斗交接文档负责。完整计划：`docs/development/game-rulesets-and-sheets-implementation.md`。
