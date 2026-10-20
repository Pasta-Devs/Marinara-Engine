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
- **上限。** 每规则集 12 个目录，每目录 8 个供给列表与 8 个筛选器，无论内联还是资源文件每目录 2000 条，每条目 6 行，每资源文件 `RULESET_CATALOG_MAX_BYTES = 2 MB`(1.340 之前为 1 MB)；读取文件前先核对清单声明的 `files[].bytes`。
- **保持列表精简。** `GET /api/capability-packages/rulesets` 会移除内联 `entries`，改报 `entryCount`，因为每次打开人物卡编辑器都会读取列表。没有目录的规则集仍按原样逐字节列出。`GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=` 提供单个目录：内联条目，或已解析、已验证的资源。它与 `/rulesets` 一样不要求特权，并在 `/:id/...` 路由之前注册，防止包 ID 遮蔽它。未知规则集、版本或目录返回带代码的 404；Engine 不读取的资源返回 422，并带作者可处理的问题行。
- **Capability API 1.21 分两部分执行。** 声明 `catalogs/<id>.json` 资源需要 1.21，以及旁边的 `ruleset.json`。目录也能存在规则集文件内部，清单无法表达，所以安装时读取已验证字节，在较低 API 声明下发现 `catalogs` 键便拒绝。无法解析的规则集不会导致安装失败：仍交由注册表报告，并留一条日志。
- **`mechanics` 会验证，且部分内容被使用。** 可选块(类型、射程、范围、目标、友军伤害、数量、伤害类型、攻击检定、豁免、费用、每费用步长、专注、反应)使用封闭严格词汇，因此拼写错误会现在暴露，而不是等到终于有组件读取时才发现。切片 8a 只验证它，并在选择器显示一行简述。战斗桥接使用类型、射程、范围、友军伤害、数量、伤害类型、费用和反应(用于排除反应条目)。攻击检定、豁免、专注和每费用步长仍没有读取者。
- **已知上限：社区目录仅支持内联。** 以单文件导入或从 GitHub 仓库获得的规则集，将目录包含在同一文件中，因此也受 512 KB 上限约束（1.340 之前为 256 KB）。社区规则集独立目录文件(`rulesets/<id>/catalogs/*.json`)被有意排除：仓库渠道只读取 `rulesets/` 的直接子文件，单文件渠道按定义就只有一个文件。列表超过 512 KB 的社区作者应改发包。如果这成为实际限制，则另设一个切片处理。
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

**切片。** C1 是模式与结算器。C2 是生物图鉴目录、数值块行动、序列与充能、威胁限幅，以及 5e 包自己的生物和更完整的法术。C3 是导演的 `ruleset` 样式，分为 C3a(会话、路由、持久化、敌人从菜单选择)和 C3b(使用真实数值的 Classic 外壳、`coverage.combat` 为真)。C4 是棋盘，分为 C4a(格式、位置、移动、触及与射程、范围、掩护、借机攻击、选择器和视图)和 C4b(使用 Tactical 样式自身外观在屏幕显示棋盘)。C5 是回合能做什么，以及什么会打断回合，分为 C5a(回合行动经济、附加效果和状态词汇)与 C5b(窗口本身：暂停的行走，以及购买招牌行动的窗口)。C5c 是还有什么会打开窗口（条目等待的时机），C5d 是对抗检定，C5e 是 `used` 时机以及反应回应什么，C5f 是状态改变的数值和轨道的等级，C5g 是命中之后的时机以及会作出反应的生物。

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
- **由 Engine 操控的队员可以从更大的资源池付费。** 此项并入自[问题 #6528](https://github.com/Pasta-Devs/Marinara-Engine/issues/6528)，因为它涉及同一个衔接点：玩家可以选择为能力付费的资源池，而 Engine 自己的选择器只看得到基础费用，因此交给 Engine 操控的角色从不会施放增强版本的法术。候选构建器现在为每种付费方式生成一个候选，分别携带 `choice.payWith`、额外级数实际带来的预测效果、标明资源池的标签，以及同时计算攀升档数和用量的价格，避免把更强版本当成免费版本。**对手保持不变，因为它们没有可向上攀升的资源池：** 属性块的动作不消耗任何资源池，所以无论 Engine 操控的对手还是 Game Master 的首领，都没有更大的付费方式。给属性块增加自身资源池属于格式变更，并非本次变更。(这项变更随后实现了：以人物卡形式编写的生物拥有资源池，也会像其他人一样获得更大的付费方式。参见“生物人物卡确定了什么”。)
- **留待以后处理**：改变被回应内容中的某个数值，而非将其阻止的反应。状态词汇是封闭的名称列表，并非修正值，所以规则集尚不能表达“在你的下一回合之前更难被命中”，无论由反应还是其他内容来表达。这是状态问题，而非反应问题。

### 生物人物卡确定了什么

[问题 #6610](https://github.com/Pasta-Devs/Marinara-Engine/issues/6610)：用规则集自己的术语编写图鉴生物。并非每个规则集的对手都适合用一组固定的简单数值表示；对手也无法从自己没有的资源池中支付任何费用。

- **生物可以携带 `sheet`**，形状与人物卡相同，但每个部分都可选，而且没有 `live` 部分；由于图鉴是编写的数据，因此严格校验。Capability API 1.34，与 1.27 完全一样，从规则集和目录文件自身的字节读取。
- **每个数值只有一个来源。** 有人物卡时，禁止在旁边填写 `health`、`defense`、`initiativeModifier`、`speed`、`abilities` 和 `saves`，也可以没有属性块动作；没有人物卡时，仍像以前一样要求前三项和一个动作。发布的 JSON Schema 表达了这两种情况(生成器中的 `oneSourceForCreature`)。
- **共用一个构建器。** `encounter.ts` 中的 `sheetCombatant` 同时构建队员和基于人物卡的对手，两者因此不会逐渐偏离。属性块增加的内容(自己的动作、招牌点数、附带效果和能够抵御的伤害)叠加在其上。
- **按编写数据校验**：逐个对照人物卡声明检查 ID，按提供的熟练等级检查技能和豁免，按各自范围中的整数检查属性值和加值，按每个列表的 `maxItems` 检查行，通过共享的 `rulesetListRowIssues` 检查字段和行单元格(现在也会检查字段)，并对照供给该列表的目录检查 `_catalog`，若目录内联还要检查其是否包含该条目。
- **路由加载人物卡要读取的内容。** `rulesetBestiarySheetCatalogIds` 列出图鉴人物卡选取行所用的目录，这些目录在图鉴之后加载，而且仅当人物卡指定了目录时才加载。
- **资源池和更大的付费方式自然生效。** 候选构建器从未按阵营限制，只看动作是否有可向上攀升的资源池，因此拥有人物卡的对手会在 Engine 的选择器和 Game Master 的决策中获得更大的付费方式；后者原本就携带 `payWith`。
- **现在可以在对手的伤势轨道上作标记。** 先读取其抗伤能力，再标记轨迹，因此对拥有人物卡的生物而言，“抗性不能描述轨迹”的旧限制已经消失；使用简单数值的生物仍然扣除点数。
- **它仍然是对手。** 零点时判定战败依据的是阵营，死亡轨迹也是如此。实时回写不仅以是否拥有人物卡为条件，还以阵营为键：否则，基于人物卡的对手若恰好与队员同名，就会覆盖该队员存储的人物卡。
- **Game Master 临时创造的生物也可以使用人物卡**，因为临时创造的法师需要法术位和法术(用户在 PR 上作出的裁定)。`rulesetProposedCreatureSchema` 接受宽松的 `sheet`(角色构建所用的 schema)，并丢弃人物卡旁边填写的数值，而不是拒绝整个提案。`hold.ts` 分三步限制它：`readProposedRulesetSheet` 按名称丢弃规则集中不存在的内容，调整值使其符合要求，并将以目录条目命名的行转换成该条目(路由会加载供给提议人物卡所填写列表的所有目录)；`holdRulesetSheetHealth` 通过生命资源池读取的单个字段，或仅含一个字段的 `sum`，把生命值调整到档位区间内，其他情况则保留原值并附上一行说明；战斗构建完成后，`holdRulesetCombatant` 直接在战斗单位上限制防御、命中和豁免难度，并缩放最佳回合的效果，计算时考虑支付得起的最大费用。一次支出购买的攻击会保留待用，可以分配给任意攻击行，因此衡量攻击回合时，采用付费的那一行，并将其余攻击算在最重的攻击行上。人物卡旁边的属性块部分仍经过普通限幅。蓝图提示词携带一个 `EncounterSheetBrief`：各个 ID、每项允许的内容、战斗读取的列表、打开每个列表目录的字段，以及每个列表最多 60 个目录名称。
- **临时创造的非首领敌人遵循其规则集自身的职业限制**(用户的裁定：“让 Sorcerers 无法使用整个法术列表”)。无需更改格式：目录过滤器的 `startFrom` 原本就指定条目按哪个人物卡字段组织，`restrictRulesetSheetEntries` 只保留过滤条件匹配人物卡值的条目，由 `sheetFieldMatchTexts` 进行匹配(已移至共享层，使选择器和战斗保持一致)。任何规则集都没有声明各职业等级的法术位数量(5e 将这些数量输入字段)，因此没有职业表可据以限制；档位限制约束的是这些法术位能购买的效果。
- **按性格和能力水平填充未定选择，无需模型调用。** `fillRulesetSheetChoices` 会为生物需要作选择的每个列表(带有 `onlyWhen` 的能力来源)填入向其开放、且自身资源池付得起的条目，每个资源池档位采用固定数量(新手到大师分别为 1、2、2、3)，随意使用的条目也采用固定数量(2、2、3、3)。在规则集能声明职业有多少选择之前，这是 Engine 侧的限制。填充时，将条目的性质(伤害、支援、控制或改变回合进程)与战斗 AI 自身的性格相权衡，能力水平越高，越重视改变回合进程的内容。路由在构建战斗前，就用选择器会使用的同一单位和种子为敌人赋予战术，使生物以同一种性格填充选项并作战。首领免于这两项处理：由 Game Master 完整编写。
- **缩小枚举字段取值范围的层不会让生物丢失。** 生物的枚举值可以是被某个层删去的值，这些值从定义自身的 `layers` 读回；除此之外，仍不允许任何未声明内容：`refineRulesetDefinition` 传递 `layersApplied`，而可能持有分层定义的游戏目录加载器传递 `narrowedByLayers`，因此层不会被悄悄丢弃，图鉴文件不会因为层删去的值而遭拒，拼写错误仍然会被拒绝。软件包安装从不解析目录文件，所以没有需要设置的安装时路径。
- **`no-health`。** 总计没有生命值的人物卡在创建战斗时会被排除，并给出专门原因，而不是以无法击杀的状态加入。图鉴中的字段如果超出范围，在导入时就已遭拒，因此只有结果为零的公式或手工构建的属性块会走到这里。
- **每个拒绝原因在两侧都有文字说明。** C5b 的 `window-open` 和 `stale-window` 此前在英语文案目录和服务器上都没有对应句子，C4a 的四个位置相关原因在服务器上也没有。现在全都有了；如果新增原因却没有两侧说明，屏幕客户端测试通道就会失败。
- **已验证**：`scripts/regressions/game-ruleset-combat-creature-sheets.regression.ts` 覆盖单一来源、ID 和引用、在 5e 草稿和 Ember Roads 上与队员相同的数值、人物卡旁保留的属性块、自身 Luck、解析器以及 Engine 选择器和 Game Master 中的更大法术位、伤势轨道和免疫、战败、投影、回写、拒绝、提案以及 1.34 门槛；此外还有路由测试通道中法术来自另一目录的施法者，以及 JSON Schema 测试通道。

### C4a 确定了什么

C4a 是共享层和服务器侧的棋盘。C4b 是绘制棋盘的屏幕。

- **一个格子代表多远，由规则集决定；声明这一点后，战斗才可以具有位置。** 新增可选的 `combat.distance: { label, perCell }`。属性块世界中声明的每种距离都使用这个单位：`economy.movement`、生物的 `speed`、武器的 `reach` 和 `range`、生物动作的 `reach` 和 `range`。声明了自身 `units.distance` 的目录使用自己的 `perCell` 转换自己的 `mechanics.range` 和 `area.size`；未声明的则使用属性块的单位。Capability API 1.28，与 1.21 以来的每一级完全一样，从规则集自身的字节读取。
- **现有可用行为没有变化。** 没有棋盘的战斗与此前逐字节一致：在如今声明格子大小的规则集上，以及删去所有新键的副本上，比较同一场景的完整事件日志。状态仍为 `v: 1`，因为每个新字段都可选，而且没有相应功能的战斗中不会出现这些字段。
- **要么所有人都在棋盘上，要么谁都不在。** `createRulesetEncounter` 接受可选的 `board: { grid, placements }`，只有当规则集声明了 `distance` 且每个战斗单位都占有格子内的一个位置时才保存。少一个部署位置，整场战斗就保持为想象中的战场，因为有人无处站立的战斗无法回答任何距离问题。
- **格子使用战术引擎自身的实现。** 服务器使用仅携带阵营、首领标记和地块的替代单位，以战术风格使用的同一种子和同一游标调用 `generateTacticalBattlefield` 与 `placeSpawns`。为此，`placeSpawns` 扩展为接受结构类型 `TacticalPlaceable`，`TacticalUnit` 原本就满足它。没有第二套生成器、第二张地形表，也没有这类战斗专属的棋盘大小。
- **八个相邻方向各算一格，距离取两个轴差值中的较大者。** 这正是本功能针对的桌面游戏格子的玩法，并且刻意不采用战术引擎自身的四方向和曼哈顿距离；后者在自己的战斗中完全保持原样。地形 `moveCost` 是进入某格的费用，不能进入任何实心障碍格，不能从两个实心障碍格之间斜穿拐角，可以经过朋友，但不能停在任何人占据的格子上。
- **新增一个纯模块**：`packages/shared/src/features/ruleset-combat/grid.ts`，包含 `rulesetInCells`、`rulesetCellDistance`、`rulesetReachableCells`、`rulesetLineOfSight`、`rulesetAreaCells` 和 `rulesetOpportunityAttack`。它处理真实的爆发、锥形和直线形状，而非旧连接层的单一半径。
- **菜单仍是唯一合法性依据。** 可以走到哪里、选项能指向谁、形状可以瞄准哪里，都是结算用来检查选择的同一套规则；如果目标只要更近一些就会被允许，则以 `out-of-reach` 或 `no-line-of-sight` 拒绝，而非笼统的 `bad-target`。
- **选择器会移动。** 它结合可达的每个格子及从那里可用的每个选项进行权衡，为行走会引发的每次攻击扣分；如果原地已经能发挥最佳效果，就倾向于不动；如果没有任何目标在范围内，就拉近距离(规则集列出 `dash` 时先疾跑)。最多评估 48 格，Game Master 窗口最多提供 24 个候选。
- **已验证**：`scripts/regressions/game-ruleset-combat-grid.regression.ts` 覆盖手绘棋盘、预设骰子、两个示例规则集以及逐字节比较，此外还有 `ruleset-combat-director.regression.ts` 和 `ruleset-combat-director-route.regression.ts` 中带位置的案例。
- **留待以后处理**：飞越障碍、挤过狭窄空间、躲藏和强制移动（分级掩护随战斗 C6a-2 加入，高度随 C6b 加入）。反应窗口本身属于 C5b。

### C4b 确定了什么

C4b 是屏幕上的棋盘。它绘制 C4a 结算的内容，不自行作出任何决定。

- **屏幕遵循视图，而非偏好设置。** 规则集视图携带 `grid` 时，`DirectedCombatUI` 挂载棋盘；没有时保留 Classic 舞台。只有当战斗属于规则集自身、游戏的战斗偏好为 Tactical、且解析后的规则集声明 `combat.distance` 时，客户端才会向 `/start` 发送 `positioned: true`；是否能够绘制棋盘仍由服务器决定。
- **新增一个纯展示组件**：`RulesetCombatBoard.tsx`。没有重构 `TacticalCombatUI`：它的调色板、纹理、地形图标、地块阴影、关键帧和标记辅助函数原样移入 `lib/tactical-board-look.ts`，供两个棋盘导入，因此两者看起来属于同一产品，新地形主题也不会在两者之间产生偏差。
- **客户端不进行计算。** 可达格子及其费用、路径、某一步会引发谁的反应、可选目标、形状可瞄准位置及其涵盖的所有人，全都来自视图。`lib/ruleset-combat-board.ts` 按格子索引这些信息；它唯一推导的数值是规则集自身的距离，即格数乘以 `perCell`，整个屏幕都用这个单位表达。
- **每格只有一个可聚焦元素。** 地块是带有漫游 tabindex 和方向键移动的按钮；标记以 `pointer-events-none` 绘制在上面，因此点击标记就是点击其格子，键盘也只有一种含义。Escape 会放弃尚未完成的选择，并将键盘控制交还菜单，这符合 C3 规则：只有玩家主动关闭时才归还焦点。
- **尚未完成的选择保存在棋盘中**，通过可选的受控 `step` 传回 `RulesetCombatMenu`。没有这对组件时，菜单保留自身状态，C3 屏幕与此前逐字节一致。
- **棋盘保持自己的最小高度**，菜单、提示行和日志各自限制自身大小。在进行中的战斗和 17 行日志下，分别于 1366x850 和 375x812 测量：两种尺寸都没有页面横向滚动，标记不重叠，整个棋盘均可见。
- **已验证**：`scripts/regressions/ruleset-combat-screen-client.regression.ts` 在两个示例规则集上覆盖格子、行走、路径、目标、瞄准、文案、“没有目标在范围内”规则、距离格式化及四种拒绝原因；`e2e/game-combat-director.e2e.ts` 的第四种模式则在真实浏览器中游玩带位置的 Ember Roads 战斗。

### C5d 确定了什么

Capability API 1.43，对应 #6707。

- **对抗检定作为数据。** `combat.checks` 是对抗检定读取的数值，每一项都是人物卡上的一个值，和防御、豁免一样在战斗开始时读取一次；普通生物给出自己的 `checks`，带人物卡的生物则从人物卡读取（`checks` 加入了人物卡会替换的键）。`combat.contests` 中的每一项都指定一个预算、双方各自可用的检定（掷其中最好的那个）、平局时谁胜出、可选的 `reach` 和 `strike`、可选的 `from: { holding }`，以及 `onWin`：它对败者 `applies` 的状态（以胜者为来源，可选 `rounds`）、它对任一方 `ends` 的状态，以及一个 `push`。`reach` 和 `push` 需要 `combat.distance`。**有意与问题描述不同：** 问题里只给攻击方一个 `check`；双方都取一个列表，因为挣脱要掷两者中较好的那个。
- **战斗。** 每个参战者都会为每种对抗检定获得一个动作（`contest:<id>`，类型为 `contest`），只有规则集有对抗检定时才会加入，因此没有对抗检定的规则集，战斗与以前逐字节相同。对抗检定消耗它的预算（或手中剩余的一次攻击），并当场结算，不打开任何窗口。双方都掷 `attackRoll.dice`，再加上自己最好的检定值；`contest` 事件携带双方和胜者。推撞会立即让败者移动（`rulesetPushPath`），在碰到任何实体、站着的人、边缘和狭窄角落之前停下；它不消耗任何东西，也不会引发攻击。
- **菜单和选择器。** 预测值是获胜的确切概率（`rulesetContestChance`），显示为“to win”。挣脱只在被抓住时提供，而且只能指向抓住者。Engine 的选择器把对抗检定评为一种适度的铺垫（挣脱 1、擒抱 0.3、推撞 0.15，再乘以概率），所以带种子的战斗仍会结束；Game Master 的对手也从同一个菜单中选择它。编造出来的对手，其检定值被限制在该档位的命中值之内，无论是普通限幅还是构建出的人物卡都是如此。
- **示例。** 5e 参考规则集可以擒抱、把对手推倒、把对手推开 5 尺以及挣脱，Grappled 现在会在其来源倒下时结束；Ember Roads 可以抓住（新的 Held 状态）、挣脱，并把对手推回 4 步。
- **已验证**：`scripts/regressions/game-ruleset-combat-contests.regression.ts`(三十六处有意的破坏，每一处都会被发现)、`scripts/regressions/ruleset-combat-director.regression.ts` 中的种子扫描（会进行对抗检定，有时获胜，从不被拒绝；从不选用对抗检定的选择器会被发现），以及 `e2e/game-combat-director.e2e.ts` 中的 Contests 组。

### C5e 确定了什么

Capability API 1.44，对应 #6712。

- **第三个时机。** `mechanics.reaction.on` 可以取 `used`：对方阵营有人使用了某样东西。它在这次使用结算之前打开，面向对方阵营中所有持有对应条目的人，无论这次使用指向谁；和 `aimed` 一样，它也允许 `cancels`。只有真正的动作（攻击、能力、数值块动作）才会打开它；标准动作和对抗检定不会。
- **反应回应什么。** `mechanics.reaction.against: { catalogs }` 可用于任何时机，把条目限制为只回应来自这些目录中条目的动作。由目录行构建的能力动作带有 `catalog`，`aimed`、`used` 和 `harmed` 触发器带有来源动作的目录；背后没有条目的动作（武器行、数值块自己的动作）不带目录，永远不会匹配指定了目录的条目。目录 ID 在导入时检查。
- **触及范围。** 只有当持有者自己的触及范围或射程覆盖使用者时（`rulesetTargetRefusal`，所以也包括视线），才会提供 `used` 回应，即使这个回应是取消型的、不指向任何人也一样。否则，不考虑位置的规则会让反制从棋盘另一端作出回应。
- **顺序。** 在一个回合中，`used` 先打开；它关闭且没有被取消时，`aimed` 会以同一个暂缓的动作为目标们打开，等它也关闭后，动作才结算。和以前一样一次只开一个窗口，所以反制本身不能再被反制。
- **示例。** Ember Roads 新增了 Smother，这是一项免费技艺，花一点 Luck 就能阻止八步之内使用的一项技艺。5e 参考规则集不含法术；5e 包的 Counterspell 会在下一个版本中采用 `{ "on": "used", "against": { "catalogs": ["spells"] }, "cancels": true }`。
- **已验证**：`scripts/regressions/game-ruleset-combat-moments.regression.ts`(各种拒绝、时机及其取消、目录过滤、棋盘上的触及范围、`used` 先于 `aimed`、不形成连锁、日志行以及 1.44 门槛)。

### C5f 确定了什么

Capability API 1.45，对应 #6719。

- **修正值。** `combat.conditions[].modifiers`(最多 6 项)：`to` 取 `defense`、`attacks`、`saves`、`checks`、`speed` 之一；然后是一个 `flat` 数值（自带正负号，绝不为 0）、每次使用时都要掷的 `dice`(只用于三种需要掷骰的数值，`minus` 表示减去)，或者 `times` 0.5 或 2(仅限速度，在固定值变化之后应用)。状态上的 `saves` 现在也会收窄豁免修正值的适用范围。速度修正值只在棋盘上读取，写入时不需要 `distance`，这一点和 `speed-zero` 一样。
- **在哪里读取。** 不会向参战者写入任何东西：每个数值被使用时，都会去询问 `rulesetConditionModifiers`。防御在 `rulesetDefenseAgainst` 中读取（结算和预测都是）；攻击检定、豁免和对抗检定的双方会在掷骰本身的骰子之后掷这些骰子，并携带 `bonuses`(防御则携带 `guards`)，其中记有来源状态，如果来自等级还记有等级；预测中的命中概率和获胜概率会对加值骰做卷积（`rulesetBonusDice`），在 `own-checks-advantage`/`-disadvantage` 要求时，对抗检定的一方会掷两次（`rulesetCheckMode`，仅当存在 `attackRoll.advantage` 时）。速度在 `rulesetMovementAllowance` 中读取，所以 Dash 也会读取它。
- **结束方式。** 施加的 `duration: { rounds, at: "turn-start" }` 在持有者的回合开始时倒数；`endsAfter`(`own-attack`、`attacked`、`own-save`) 会在其中第一件事发生后，以原因 `spent` 移除状态。攻击在掷骰时记下它用到的一次性状态，并在这一击结束后恰好消耗这些状态，所以只挡一次攻击的守护仍会把这一击的伤害减半，而这一击新加上的标记会保留。回合开始时的计时器运行之后，会重新读取行走距离，因此在回合开始时结束的状态，不再限制这个回合的行走（这对已有的、在回合开始时以豁免结束的状态也是一个变化）。
- **等级。** `combat.levels`(最多 20 项)：`{ track, at, effects?, modifiers?, failsSaves?, saves? }`，作用于普通的实时轨道（伤势轨道会被拒绝，同一个等级不能有两个条目）。每个已达到的等级都会以一个 `condition` 为轨道 ID 的条目，合成进 `rulesetActiveConditions`，所以每个读取方都能看到它。等级上会被拒绝的有：`half-move-to-stand`、`ends-on-damage`、`cannot-target-source`、`cannot-approach-source`。只有人物卡才有轨道。
- **示例。** 5e 参考规则集计入力竭的第 1、2、3 和 5 级（4 和 6 级是 Not yet），Poisoned 和 Frightened 会让检定更难。Ember Roads 的 Heat 从 3 级起让攻击减 1，到 5 级时速度减半；Wounded 更容易被命中 1 点，并且慢 2 步。
- **已验证**：`scripts/regressions/game-ruleset-combat-conditions.regression.ts`(各种拒绝和发布的模式、防御、两个方向都带骰子的攻击、收窄的豁免、带优劣势和加值的检定、在回合开始时减半并恢复的速度、三种一次性结束方式、两个示例中的等级、日志以及 1.45 门槛)。

### C5g 确定了什么

Capability API 1.46，对应 #6728。

- **时机。** `mechanics.reaction.on: "hit"`(反应对象现在共用一个模式 `rulesetReactionMomentSchema`)：攻击检定已经命中持有者，但伤害尚未结算。它上面不允许 `cancels`。它只为被命中的那个人打开（任何一方都可以），只在对方持有回应时打开，而且已经有窗口打开时绝不打开，所以借机攻击、招牌动作和回应都不会被暂缓。
- **暂缓攻击。** `resolveAction` 会返回一个暂缓状态，而不是直接造成这一击：目标、它之后的目标（`rest`）、掷骰结果（`mode`、`total`、`defense`、`critical`、`natural`）、攻击者用到的一次性状态（`mine`，按 ID），以及通过 `resolveSequence` 得到的、由其他动作组成的动作中的 `part`。`harmedBy` 会在动作的恢复记录上带着暂缓的攻击打开 `hit` 窗口（`resume.held`，以及 `hurt`，即这个动作已经伤害过的人），并且只在整个动作结束后才询问受伤时机。`resumeAction` 会把 `held` 传回去：前置部分（gives、专注）被跳过，较早的部分被跳过，暂缓的部分不会再次付费，暂缓的掷骰会按当前的防御重新检查。防御有变化时会记录一个 `recheck` 事件；天然点数保持其结果。目标的一次性状态在重新检查时读取，所以作为回应加上的防护会被这次攻击消耗。
- **生物。** 生物动作可以带 `reaction`(同样的对象) 和 `self: true`(以持有者自身为目标，不带 `targetCount` 或 `area`)；序列不能带其中任何一个，也不能点名一个反应，而反应也不能同时是招牌动作。生物上的 `against` 目录同样会被检查。
- **选择器。** `rulesetAnswerDeflects(definition, state, actor, optionId)`：在暂缓的命中上，如果回应自身状态加上的防御能胜过这次掷骰，就为 true；不能胜过时（或遇到天然点数时）为 false；回应不改变防御时为 null。导演会跳过结果为 false 的回应，把结果为 true 的回应评为 `healing: 1`。
- **日志和视图。** 窗口事件和定向视图在命中时携带 `total` 和 `defense`；例如“Snag hits Brenna with Scimitar: 20 against Armor Class 18. Brenna may answer.”和“Against Armor Class 23 (Shielded + 5), Snag's Scimitar now misses Brenna.”
- **示例。** 5e 参考规则集的 Toll Sergeant 可以招架（一个 `parrying` 状态，对一次攻击 +2 防御）。Ember Roads 没有反应可以消耗的预算，所以不加入任何反应。
- **已验证**：`scripts/regressions/game-ruleset-combat-hit.regression.ts`(Shield 化解一次命中、胜过 Shield 的掷骰、天然 20、放过时机、Uncanny Dodge 减半、被这次攻击消耗的生物 Parry、在每个部分都被暂缓的两段式动作、多个目标时其余目标在回应之后掷骰且受伤时机在最后询问、在窗口中途保存并重新加载、窗口内不暂缓任何东西、各种拒绝、日志以及 1.46 门槛)，以及 `scripts/regressions/ruleset-combat-director.regression.ts` 中一个四十种子的用例（Engine 只在 Shield 能化解命中时才举起它，其他攻击则任其命中）。

### 骰池类型确定了什么

Capability API 1.47，对应 #6736。这是差距报告点名的 Storyteller 类型（W10，连同 W9），分两个切片完成：这一个是类型本身；第二个（见下文）是让攻击推动先攻数值。

- **第二种类型，以及一条原则。** `combat.kind: "dice-pool"` 需要 `dice-pool` 结算方式，并按检定读取人物卡的方式来读取它：掷骰时“加上”的每个数值都是骰子，掷骰要“达到”的每个数值都是成功数。所以不需要重命名任何键。`toHit` 是骰池，`defense` 是一击需要的成功数（绝不少于一），豁免的数值是它的骰池、难度是它需要的成功数，对抗检定的检定值是一个骰池，状态的 `flat` 修正值是骰子（掷骰的 `dice` 修正值会被拒绝）。参战者为行动而掷的每个骰池都经过 `rollDicePoolCheck`，所以骰子、目标值、双倍计数、爆骰、抵消和大失败都由结算方式决定，`resolution.penaltyFrom` 也会减去骰子，这是攻击对防御的战斗从来不会做的。大失败即未命中；没有重击。
- **伤害。** 超出所需数量的每个成功都会增加一颗伤害骰。伤害量中的 `dice` 是规则集自己那种骰子（否则会被拒绝，条目和生物都一样），`flat` 部分是自动成功；攻击行的骰子列按数量读取，`damage.ability` 增加骰子，`damage.bonus` 增加自动成功。伤害按目标逐一对照 `pool.damageTarget` 掷出（缺省时取结算方式的默认目标值），不做双倍计数、爆骰、抵消或大失败。治疗量和临时数值仍然是求和；先攻是求和，除非作为骰池掷出（1.48，见下文）；濒死保留它自己的骰子。
- **吸收。** `pool.soak` 按生命轨道的伤害种类给出数值引用（`byKind`，优先于 `all`），要么对照伤害目标值掷出（`roll: true`，每个成功减去一点），要么先从伤害骰中扣除（`roll: false`）。绝不低于零，一击什么都没计入时绝不掷吸收，并且在抗性之前应用。生物给出自己的 `soak`；人物卡生物从人物卡读取；编造出来的对手的吸收会被限幅去掉，因为没有任何档位为它设定界限。
- **两种类型都适用。** `initiative.each: "round"` 会在每轮开始时重新掷所有人的先攻，修正值按当时的人物卡读取，并重新排序。`combat.spendLimits` 限制一个参战者每回合或每轮从某个实时资源池中消耗多少：`planRulesetCombatCost` 会把超出剩余额度的费用定为负担不起，每一笔支付都计入其中，包括窗口中的回应。`toHit.skill` 让攻击行改掷一项技能，并像检定的 `with=` 那样换入该行的属性。
- **未实现。** 在每个参战者轮到自己时才选择一个动作的战斗中，倒序宣告动作不会改变任何规则读取的内容，所以没有键表达它。
- **示例。** Gravewatch 会战斗：带有 knocks 和 tears 的伤害轨道、一个 Arms 列表、两个战斗护符（其中一个使用快速预算，所以它每回合一点 Resolve 的上限会生效）、按种类划分的吸收、每轮重掷先攻，以及一个含两种生物的图鉴。它在检定渠道中的变体不包含战斗。
- **已验证**：`scripts/regressions/game-ruleset-combat-pool.regression.ts`(骰池、抵消、大失败和爆骰、额外骰子、自动成功、防御、掷出和从骰子扣除的吸收、伤势惩罚和状态骰、带优劣势的掷骰、豁免、对抗检定、以成功数重新检查的暂缓命中、按当前修正值每轮重掷先攻、消耗上限、精确预测、图鉴中的吸收、限幅、每一种拒绝、日志以及 1.47 门槛)，以及 `scripts/regressions/ruleset-combat-director.regression.ts` 中由 Engine 打的二十场带种子的 Gravewatch 战斗。

### 移动先攻确定了什么

Capability API 1.48，对应 #6740。Storyteller 的第二个切片：先攻成为攻击会推动的数值。

- **开场。** `initiative` 要么是 `dice`(搭配 `modifier`)，要么是 `pool`(搭配 `plus`)，二者只能取一。骰池通过检定掷骰器掷出，成功数加上 `plus` 就是数值；生物的 `initiativeModifier` 就是它的骰池。`pool` 和 `resource` 只属于 `dice-pool` 战斗，`resource` 需要 `pool`(求和的骰子表示的是顺序，不是可以消耗的骰子)，`each` 不能与 `resource` 并存，带骰池的 `each: "round"` 会重新掷骰池。
- **风格，与选项并列。** `resource.styles`(一到四个，每个是 `takes` 或 `spends`，至少有一个是夺取型，这样崩溃的参战者总有一个可用) 由 `choice.style` 选择，而不是并进选项 ID，所以凡是按 ID 查找动作的地方都不受影响。攻击是掷骰命中并造成伤害的动作，或者是一个序列（每个部分都用它的风格，而且只能是夺取型，因为数值只能花在一击上）；对抗检定从不带风格。没有风格的选择取第一个风格，选项不提供的风格会以 `unknown-style` 被拒绝，而在回合之外进行的任何事（借机攻击、招牌动作、反应）都以第一个风格进行，所以窗口菜单不提供风格。风格在攻击发起时就固定下来，并和消耗型风格掷出的数值一起记在恢复记录上，所以改变发起者数值的回应永远不会改变这两者。
- **夺取。** 这一击的伤害照常掷出，包括吸收，并通过一击中每个部分都经过的同一个 `land()` 计入目标的数值，所以附加伤害段和附加效果也会夺取。发起者获得总数加 `gain`，然后以发起者为来源结算崩溃，并支付奖励。生命值不受影响，所以一击之后的任何事（专注、受到伤害时结束的状态）都不会发生。
- **消耗。** 只在崩溃线之上提供。这一击掷出发起者发起时的数值，`throwHarm` 的吸收关闭，没有额外骰子、附加伤害段或附加效果；整个动作结束后，只要有任何部分命中，数值就重置为 `base`，否则按发起时的数值读取并减去 `onMiss`。
- **崩溃**由一个函数与数值保持同步：越过崩溃线就会加上状态（有来源时以它为来源），并开始计算 `crashedTurns`；升到线以上就会去掉状态。`recoverAfter` 计算崩溃者自己回合开始的次数，并把数值重置为 `base`。开场就在线上的参战者会在第一个回合前崩溃，战斗结束时所有崩溃都会解除（`liftRulesetFightEffects`，由每种结局都会经过的 `pushOutcome` 调用，逃跑时也会调用），所以人物卡永远不会保留它。同一个函数还会解除战斗中以计时、`endsAfter` 或专注加上的所有状态（战斗 C6d），不触发它们的 `onEnd`，并结束专注。
- **顺序和窗口。** 每轮开始时，按数值重新排序，不掷骰；一轮结束时的暂停不点名下一个人，与重新掷骰的轮次一样。
- **菜单和选择器。** `option.styles` 携带每种风格的预测：夺取型风格是它会夺取的量（`shift`），消耗型风格是发起者数值的价值。导演的选择器把每种付费方式都按风格展开成各自的候选。它把夺取型的一击放到一个回合后来衡量（先夺取再消耗，对比现在就消耗、之后从 base 再来一次，并计入崩溃的奖励），把消耗型的一击按它造成的伤害来衡量。Game Master 的决策选项和路由的 `ruleset` 命令都携带 `style`。
- **未实现。** 任何改变消耗型一击掷出内容的东西（武器自己的数值、骰子下限）、任何在面对坚韧目标时缩减夺取型一击的东西，以及崩溃越深持续越久的规则。
- **示例。** Gravewatch 保留它每轮重掷的求和先攻；作者指南展示了一个变体，各渠道都能运行它。
- **已验证**：`scripts/regressions/game-ruleset-combat-moving-initiative.regression.ts`(开场、菜单及其文字、带日志的夺取和崩溃、没有吸收和额外骰子的消耗、未命中表、让发起者崩溃的未命中、升到线以上、按次数恢复、开场即崩溃、战斗结束、在崩溃中保持风格和数值的暂缓命中、以第一个风格进行的反应攻击、只能夺取的序列、一轮结束时的窗口、每轮掷出的骰池、每一种拒绝以及 1.48 门槛)，以及 `scripts/regressions/ruleset-combat-director.regression.ts` 中的二十场带种子的战斗、一个 Game Master 带风格的选择和一个玩家的命令。

### 物品格式确定了什么

Capability API 1.49，对应 #6765。这是规则集物品计划的第一个切片：物品是什么，以及规则集为它的物品声明的词汇。目前还没有运行时读取它。

- **`items` 块。** 类别（至少一个）、稀有度、标签、像列表列一样声明的属性（带 `promptVisible`）、带数量的槽位、`binding`(一个标签和一个最大值)、`carry`(重量属性、`encumberedAbove` 和可选的 `limit`)、货币体系、`native`(默认为 `true`) 和 `freeform`(`"plain"` 或 `"refuse"`)。绑定和携带的值是数值引用，像资源池的最大值一样不依赖实时状态读取。重量属性是一个 `min` 为 0 或以上的数值。
- **货币。** 一个货币体系的 `value` 以它最小的硬币计数，所以一枚这种硬币值 1，而且没有两种硬币价值相同。单位 ID 在所有货币体系中都唯一，因为价格只写单位名，而 `perWeight` 需要 `carry`。两个货币体系之间永远不会互相兑换。
- **第三种目录类型。** `holds: "items"` 不声明 `feeds`，并且需要 `items` 块。一个条目恰好有 `rows`、`creature` 或 `item` 之一，物品不带 `mechanics`。类型检查推广了图鉴的规则（“一个目录，一种条目”），读取时没有模式默认值的目录头会被算作行目录。人物卡选择器和战斗都按 `feeds` 或 `holds` 选择目录，所以两者都不会读取物品目录；Game Master 的 `op="use"` 那一行现在只在行目录中教给它。
- **一件物品**会从块中指定它的类别、稀有度和标签，用每个属性都能容纳的值填写声明的属性（复用列表行检查，名词换成“Stat”），占用的槽位不超过角色拥有的数量，最多堆叠 `GAME_INVENTORY_MAX_QUANTITY` 个，价格是某个已声明单位的整数数额，而且只在规则集声明了绑定时才能绑定。
- **留给对它们起作用的切片：** 穿戴和携带的效果、需求和 `itemStat`(I4)、攻击（I5）、使用和充能（I6）、稀有度上限和编造（I3）、战利品表以及移除某个单位的层（I7）。每一项都随对它起作用的切片一起到来。
- **示例。** Gravewatch 以 Nerve 为上限绑定信物，并用一种没有重量的硬币支付；Ember Roads 按体积对照一个新的派生值 `load` 携带物品，并用硬币和盐支付。
- **已验证**：`scripts/regressions/game-ruleset-items.regression.ts`(两个示例、块和物品的每一种拒绝、一个目录文件、发布的模式、`use` 那一行，以及内联和文件中的 1.49 门槛)，其中 39 处有意的破坏每一处都会被发现。

### 编造物品确定了什么

Capability API 1.51，对应 #6814。规则集物品计划的切片 I3-1：Game Master 编造规则集的物品，规则集为它能编造什么划定界限。

- **格式。** `items.rarityCaps`(每种稀有度最多一个，每个都指定块中声明过的一种稀有度) 只限制数值属性，限制范围在每个属性自己的取值范围之内，整数属性则取整数；对穿戴和携带修正值的限制要等这些修正值出现（I4）。`items.propose`(默认 `true`) 为 `false` 时禁止编造。两个键在安装时都需要 1.51，和其他门槛一样从原始文件按结构读取。
- **提案**是 Game Master 带有各部分（`like`、`category`、`rarity`、`tags`、`stats`、`slots`、`binds`、`summary`）的添加标签，每个词都可以用 ID 或标签，不区分大小写。对照块来读取：未知的类别、标签、属性或槽位会被去掉，规则集没有的稀有度会变成它最低的稀有度，属性容纳不了的值会被去掉，数字会被取整、限制在它的取值范围内，再限制在其稀有度的上限内（`like` 作为起点的那部分也一样），价格绝不会编造。每一处改动都写成一句平实的句子，最多八句，保存在物品上；回答的 `note` 会略去那些涉及 Game Master 看不到的属性的句子。
- **身份。** 编造出的物品在堆叠上记为 `invented:<id>`，ID 由它的名称拼出（`mourning-edge`）或取一个指纹，冲突时加编号。与规则集自身某件物品同名的，就是那件物品。仍被持有的名称就是那件物品，提案永远不会改变它；做出它的物品簿还能再找到它（回复会在保存前后各读取一次）。否则，提案就是一件使用新 ID 的独立物品，即使某件较早的物品用过这个名称也一样：重述的回合中的物品绝不会覆盖第一次讲述中的物品，所以切换回去时，找到的就是那次讲述所持有的物品。每局游戏最多 200 件。
- **存放位置。** 聊天元数据 `gameInventedItems`，与回合的堆叠在同一次保存中写入；只有当堆叠或回合记住的讲述仍持有它时才保留，只有当每个部分仍然是规则集的词汇时才会读回，不会进入聊天设置方案，只有在被带过去的堆叠仍持有它时才会带入新会话。物品簿在规则集自身的物品之后读取编造物品（目录名称优先），而且绝不会把它们列进选择器；只有 Game Master 的物品簿可以编造。
- **告诉 Game Master 什么。** 提案格式和规则集的词汇（类别、从低到高的稀有度、标签、向它展示的属性及其种类、槽位以及上限），只在规则集有物品且允许编造时才提供，并且绝不包括 Game Master 看不到的属性及其上限。编造出的物品在物品栏中的显示方式与规则集自身的物品一样，事实信息写在括号里。
- **示例。** Ember Roads 按稀有度把 Guard 的上限设为 1、2 和 3。
- **已验证**：`scripts/regressions/game-ruleset-invented-items.regression.ts`(格式、每一种拒绝和 1.51 门槛、提案可能遇到的每一种改动、物品簿、标签和提示词)，以及 `scripts/regressions/game-inventory-turn.regression.ts` 中的真实路由（一个回合编造物品，重述的回合替换它，下一个提示词读取它，新会话只保留被持有的物品），其中 48 处有意的破坏每一处都会被发现。

### 原生物品开关确定了什么

没有新键，对应 #6822。规则集物品计划的切片 I3-2：自 1.49 起就已声明的 `items.native: false` 现在会按字面意思生效。

- **Game Master 的添加。** 它的物品簿会拒绝一个新的、没有类型的名称（`not-ruleset-item`），所以它只添加规则集的物品和它自己编造的物品；为已持有的东西增加数量、移除和给予照常有效。它的指令会在提案格式旁边说明这一点；如果规则集同时禁止编造，则说明它只能给予列出的物品。玩家手动输入的物品仍然遵循 `freeform`。
- **带入新会话。** 无论这个开关怎么设，新会话都会恢复队伍携带的东西，所以开关关闭之前持有的普通物品会回来。
- **战斗。** 战斗开始时的蓝图不再请求 `itemEffects`，并丢弃模型给出的任何内容；导演主持的战斗开始时没有物品，也没有效果；回合路由和战术路由会拒绝物品动作；界面不提供物品。在 I6 和 I8 让规则集能说明物品的作用之前，物品在战斗中不起任何作用。
- **已验证**：`game-inventory-turn.regression.ts`(一个 Game Master 回合：拒绝新的无类型名称，增加已持有的普通物品，添加目录物品和编造物品；玩家仍可手动输入物品；下一个提示词；带入新会话的普通物品)、`ruleset-combat-director-route`(蓝图提示词)、`combat-director-route`(没有物品的导演战斗，物品栏保留)、`hybrid-terrain-route`(回合路由和战术路由) 和 `game-ruleset-invented-items`(允许和不允许编造时的指令)，以及 `combat-boss-provider`(战斗开始路由不请求猜测，并丢弃给出的猜测) 和 `e2e/game-ruleset-items.e2e.ts`(恢复的 classic 战斗不提供物品)，其中 13 处有意的破坏每一处都会被发现，去掉界面那一部分后浏览器检查会失败。

### 人物卡上的物品确定了什么

Capability API 1.52，对应 #6826。规则集物品计划的切片 I4-1：人物卡读取角色持有的物品。

- **格式。** 数值引用 `itemStat`：`from`(`worn`、`carried` 或 `all`)、`pick`(`sum`、`max`、`min` 或 `count`)，以及可选的 `stat`、`slot`、`category`、`tag` 和 `default`。除非是计数，否则必须有 `stat`；`sum`、`max` 和 `min` 需要数值属性。每个名称都会对照物品块检查，没有物品块的规则集无法读取物品。凡是要求实时读取的地方都会拒绝它（资源池和轨道的最大值、熟练加值、`binding.max`、携带数值、缩放列和缩放），无论是直接引用还是经由派生值引用，因为物品会在游戏中变化。安装时需要 1.52，检查方式是遍历规则集文件和每个目录文件，查找这个驼峰式的键，人物卡 ID 不可能是这种形式。
- **它读取什么。** 穿戴的物品是：装备时占用槽位的物品、绑定时进行绑定的物品，两者都做的物品则在两种状态都满足时才算；两者都不做的物品只算携带。`sum` 是每个值乘以堆叠数量，`max` 和 `min` 取单个值，`count` 是数量（指定了属性时，只计提供该属性的物品）。什么都没选中时读取 `default`，否则为 0。只有规则集自身的物品才计入，包括编造的物品；普通堆叠没有属性。
- **谁的。** 玩家的角色卡（以聊天的用户角色命名，否则取第一张，这是携带和绑定已经在用的规则）读取玩家的背包；其他每张角色卡读取以它名字命名的背包。
- **在哪里。** 物品是一次求值所取的实时数值的一部分，所以游戏中的每次求值都会传入它们：检定的人物卡、Game Master 的人物卡块、游戏内人物卡（及其编辑器），以及规则集战斗的开始；战斗中的参战者会保留他们持有的东西，供战斗再次计算的任何内容使用（每轮重掷的先攻）。调用方只有在规则集某处用到 `itemStat` 时才读取物品栏和物品目录。游戏之外什么都不持有。
- **示例。** Ember Roads 把穿戴护甲的 Guard 加到它的 Guard 上，它的 Game Master 摘要现在也显示 Guard。模拟较旧 Engine 的渠道会连同物品块一起去掉这种读取。
- **已验证**：`scripts/regressions/game-ruleset-item-stats.regression.ts`(每一种拒绝和位置、规则集和目录文件中的 1.52 门槛、每一种选取和过滤、穿戴与归属、通过真实上下文加载器进行的检定、人物卡块、战斗的先攻，以及通过真实路由开始的规则集战斗)、`game-inventory-turn.regression.ts`(真实回合中 Game Master 的提示词) 和 `e2e/game-ruleset-wearing.e2e.ts`(穿上外套前后游戏内人物卡上的 Guard)，其中 40 处有意的破坏每一处都会被发现。

### 检定中的穿戴效果确定了什么

Capability API 1.53，对应 #6832。规则集物品计划的切片 I4-2：在战斗之外，状态以及穿戴或携带的物品会改变检定。

- **格式。** 物品的 `worn` 和 `carried` 块接受状态中被检定读取的那些部分：四种检定和豁免效果、对检定或豁免的修正值、`failsSaves`，以及收窄范围的 `skills` 和 `saves`；物品在战斗中的作用要等 I5，所以其余部分会被拒绝。状态或等级新增 `skills`(收窄它的检定效果和对检定的修正值)，修正值新增自己的 `skills`(针对检定)、`saves`(针对豁免) 和 `mode`，所以同一个来源可以让一项技能带上优劣势，同时给另一项技能加值。修正值可以只有一个 mode。`rarityCaps[].bonus` 限制编造物品的穿戴或携带固定加值；在有上限的稀有度上，以骰子表示的加值会被去掉，惩罚则永远不设上限。点名的每项技能和豁免都会对照人物卡检查。安装时需要 1.53，从规则集文件和每个目录文件按结构读取。
- **战斗之外的检定**会读取掷骰者处于生效状态的人物卡状态（来源相关的门槛按“在视线内”读取，与没有棋盘的战斗一样）、它们的轨道已达到的等级，以及它们的物品在穿戴时的 `worn` 效果和仅携带时的 `carried` 效果，每件物品只计一次。修正值自己的收窄优先于其来源的收窄；属性检定或未知检定只读取没有收窄到任何东西的部分，豁免只读取与豁免有关的部分。数值像 `resolution.adjust` 一样掷出并相加（骰池上是骰子，求和上是数字）；优劣势与 Game Master 的 `mode=` 相互抵消，但只在规则集会掷两次的地方；失败的豁免不掷任何骰子，也不买到任何东西。记录携带 `effects=`、`from=`(是什么改变了它) 和 `automatic="true"`，并会读回它们。Game Master 为一个受到任何改变的检定写出的完整记录，永远不会被认可；声称豁免失败却没有掷骰的记录，永远不会被采信（规则集游戏会重新判定这次豁免；没有规则集的游戏只保留这次请求）；当效果让掷骰带上优劣势时，预览骰池会多消耗一颗 d20。效果自己的骰子永远不从那个骰池中取。
- **战斗**会把收窄到技能的内容排除在对抗检定之外（对抗检定掷的是战斗自己的检定），像效果一样计算修正值的 mode，按修正值自己的豁免收窄豁免修正值，并把只有 mode 的修正值排除在数值之外。
- **看到的和说出的。** 物品事实带有穿戴和携带事实：物品详情和选择器用本地化的文字显示它们，Game Master 的物品栏行会附上它们。在规则集有其中任何一种时，检定行会告诉 Game Master，Engine 会应用状态以及穿戴或携带的物品。Game Master 可以给编造的物品加上 `worn=` 和 `carried=`(各项改动用 `;` 分隔)，它们会对照人物卡的技能和豁免读取，否则从 `like=` 复制，并受 `bonus` 限制。
- **顺带发现。** 通用骰子结算器会在规则集自己处理完之后，把每个非 d20 的规则集检定再掷一遍（#6835），导致每个 2d6 和骰池游戏都丢失了人物卡；这个问题已单独修复，并带进了这里。
- **示例。** Ember Roads 的皮外套在穿戴时让 Sneak 减 1，携带的路标石有助于 Sway，它的稀有度把编造加值的上限设为 1、1 和 2；Gravewatch 绑定的 Dawn bell 给 Ward 加一颗骰子，Rattled 让 Soothe 和 Barter 各少一颗骰子。
- **已验证**：`scripts/regressions/game-ruleset-check-effects.regression.ts`(规则集和目录文件中的每一种拒绝和 1.53 门槛、来源和收窄、在 5e 示例、Ember Roads 和 Gravewatch 上通过回合结算器进行的检定和豁免、读回的记录、认可、战斗、物品事实、编造物品以及 Game Master 的那一行)、`game-inventory-turn.regression.ts`(真实回合保存了穿着外套的 Sneak 检定) 和 `e2e/game-ruleset-check-effects.e2e.ts`(外套的详情和真实回合的骰子卡片)，其中 65 处有意的破坏每一处都会被发现。发布的 JSON 模式同步了这些新的细化规则，由 `game-ruleset-json-schema.regression.ts` 固定。

### 需求、属性和派生等级确定了什么

Capability API 1.54，对应 #6846。规则集物品计划的切片 I4-3，也是 I4 的最后一个切片。

- **属性。** 穿戴或携带效果可以带 `abilities`，每一项是 `{ set }`(一个下限，更高的属性值保持不变) 或 `{ add }`(不为 0)，对照人物卡的属性检查，`set` 还要对照属性的取值范围。`evaluateRulesetSheet` 会先应用它们，取自实时数值中的物品：先加值，再取最高的下限，结果限制在属性自己的取值范围内，每件物品只计一次。所以游戏中的每个读取方（人物卡、检定、Game Master 的人物卡块、战斗）读到的都是改变后的属性。最大值和熟练加值不依赖实时状态计算，因此也不依赖物品，这和 `itemStat` 原本的情况一样。`rulesetReadsItems` 现在表示“有物品块”，因为属性和派生等级会在没有 `itemStat` 的情况下读取物品。
- **需求。** 物品的 `requires`(最多四个) 指定一个数值引用、`atLeast`，以及一个用穿戴词汇写的 `otherwise` 效果，这个效果不能改变属性（数值本身可以读取属性）。物品处于穿戴状态、而这个数值（在应用物品后从人物卡读取）达不到要求时，`otherwise` 就会成为以该物品命名的又一个检定来源。物品在战斗中的作用仍要等 I5。
- **派生等级。** 等级读取一个 `track` 或一个 `derived` 值，二者只能取一；派生值会结合实时状态和物品计算，在战斗之外的检定和战斗中都是如此（战斗中取战斗开始时参战者持有的东西）。派生值可以和某条轨道共用 ID，所以派生等级在进入掷骰的加值和防护时会标为 `derived`，导入时与轨道的等级分开计数，战斗日志用派生值的标签来称呼它。
- **看到的和说出的。** 物品事实带有属性变化（“Brawn at least 2”、“+1 Heart”）和需求（“needs Sinew 3, otherwise -1 on checks (Dig)”），在界面上以本地化的文字显示，在 Game Master 的物品栏行中也有。需求可能读取的每个数值都有标签：修正值和物品计数会注明（“Sinew modifier”、“Silver items”），列表的列会写出所属列表。编造物品把 `worn=`/`carried=` 中出现的属性名当作加值，受稀有度的 `bonus` 限制；从 `like=` 复制来的 `set` 在有上限的稀有度上会被去掉，`like=` 还会带来它的需求。一个真实的小模型（Gemma 4 E4B）把加值写成了 `Brawn +1`，有时写在 `stats=` 里，有时写在 `tags="none"` 旁边，所以提案会读取名称后面的数字；当没有属性叫这个名字时，也会读取 `stats=` 里的 `worn=`、`carried=` 或 `summary=`；并把 `none` 当作空列表。
- **门槛和模式。** `requires`、效果的 `abilities`(内联和目录文件中的都算) 以及等级的 `derived` 在安装时需要 1.54。发布的 JSON 模式同步了等级的二选一、作为物品效果内容的属性，以及未满足需求中不允许出现属性。
- **示例。** Ember Roads：牛皮护手把 Brawn 设为至少 2，派生的“Bulk carried”会让携带 10 或以上的人变慢。Gravewatch：墓铲要求 Sinew 3。
- **已验证**：`scripts/regressions/game-ruleset-requirements.regression.ts`(每一种拒绝和门槛、人物卡上来自物品的属性、派生值、Game Master 的人物卡块和战斗、检定中的需求（包括靠物品满足的需求）、检定和战斗中的派生等级、物品事实、编造物品以及提案中的笔误)、`game-inventory-turn.regression.ts`(真实回合的 Sneak 检定在外套旁边带上了体积等级) 和 `e2e/game-ruleset-wearing.e2e.ts`(游戏内人物卡上的 Brawn +2，以及两种物品详情)，其中 57 处有意的破坏每一处都会被发现。

### 作为物品的武器确定了什么

Capability API 1.55，对应 #6855。规则集物品计划的切片 I5-1，于 2026-09-29 从 I5 中拆出：护甲以及穿戴物品在战斗中的作用属于 I5-2，弹药和火器属于 I5-3。

- **结构。** 物品的 `attack` 是一个用数值代替列的攻击行：`budget`；`toHit`(`abilities`，取最好的那个；`skill`，像攻击行一样换入攻击的属性；`proficiency`，持有者身上的一个值，大于 0 时加上熟练加值；`bonus`；`target`)；`damage`(`dice`、`abilities` 中最好的那个、`bonus`、`type`)；`reach`；`range`；`versatile`；`strikes`。每个数字或词都可以是 `{ "stat": id }`，从物品自己的属性读取，所以编造出的武器用它自己的属性战斗，并受 `rarityCaps` 限制。没有 `thrown` 键：同时有触及范围和射程的武器就是投掷武器，攻击行本来就是这个意思。
- **导入时检查**是否符合规则集：预算、属性、技能、伤害类型，以及按种类读取的每个属性（作为属性、技能或类型读取的枚举，只能包含这些词）。求和型战斗需要骰子；`target` 用于目标值会变化的骰池战斗；距离需要 `combat.distance`；武器必须可以穿戴（有槽位或绑定），`versatile` 需要槽位。没有战斗块的规则集可以携带武器，但什么都不读取，与目录条目的 `budget` 一样。
- **在战斗中**，每件带攻击的穿戴物品都是一个动作 `item:<index>`，以堆叠的名称命名，在战斗开始时构建一次，与攻击行并列（`abilityAndSkill` 现在与攻击行共用）。只要武器占用的每个槽位，在穿戴的物品中还有同样多的空位（堆叠按数量计），就应用 `versatile` 骰子。骰池动作携带自己的 `target`，攻击的掷骰和它的预测都会把它传给骰池掷骰器，并限制在规则集的取值范围内。
- **什么能穿透。** 生物的 `resist` 和 `immune` 条目可以是 `{ type, except }`，`except` 指定物品标签；武器的伤害带着物品的标签作为 `qualities`，这一击的每个部分都是如此。普通的词保持原来的含义，GM 编造的生物保留通过已知类型过滤后剩下的条目。
- **看到的和说出的。** 物品事实新增 `attack`(求和用标签、数字和正负号书写，属性中取最好者时用“/”连接)，Game Master 的物品行以它结尾，物品详情用两行本地化文字显示它。除非物品根本不可能穿戴，否则 `like=` 会把攻击复制到编造物品上。Gemma 4 E4B 会把武器描述得很完整，却从不写 `like=`，所以在武器类别中编造、又没有可以起步的物品时，会采用名称最相近的那件武器的攻击（双向共有一个词的那件，否则取第一件），并把该攻击读取、而提案遗漏的属性重新编造出来，让稀有度上限能限制它们；说明会写“It fights as Hand axe does.”，在规则集有战斗时，提案格式也会说明仿照某件武器做出的武器会像它一样战斗。
- **示例。** Ember Roads：手斧（可投掷）、新的野猪矛（触及两格、可投掷、versatile 1d8）和猎弓（射程 30 到 60）。Gravewatch：墓铲（target 6）和银棺钉，以及一种新的墓穴尸妖，它对撕裂的抗性会被银穿透。
- **已验证**：`scripts/regressions/game-ruleset-weapons.regression.ts`(每一种拒绝和门槛、求和战斗和骰池战斗中的武器、空出一只手和双手都满时的 versatile、属性读取、最好的属性、技能、熟练、多次攻击、武器自己的目标值在掷骰和预测中的作用、银穿透抗性和免疫、事实以及编造武器)、固定物品事实或示例的各条渠道，以及 `e2e/game-ruleset-weapons.e2e.ts`(斧头的攻击出现在它的详情中，也出现在战斗菜单上，而携带的弓则不会)，其中 67 处有意的破坏每一处都会被发现。

### 护甲和战斗中的穿戴效果确定了什么

Capability API 1.56，对应 #6857。规则集物品计划的切片 I5-2。

- **词汇。** 物品的 `worn` 和 `carried` 接受除等级不能拥有的那四种之外的所有状态效果（理由相同：没有人施加它，它也永远不会自行结束）、针对所有目标的修正值，以及新键 `resist`、`vulnerable`、`immune`(伤害类型，对照 `combat.damageTypes` 检查) 和 `conditionImmunities`。`RULESET_ITEM_CHECK_EFFECTS` 指出战斗之外的检定读取什么，也就是物品以前能做的全部；原来那条说“战斗以后再支持”的拒绝已经去掉。未满足需求的 `otherwise` 也接受同样的内容。
- **一个读取方。** `rulesetItemSources`(check-effects.ts) 就是角色的物品所起的作用：穿戴与携带对照、每件物品只计一次，以及穿戴物品未满足的需求；检定和战斗都通过它读取物品。战斗把它的来源作为标为 `item`、以堆叠命名的条目加入 `rulesetActiveConditions`，所以攻击、防御、速度、效果、失败的豁免、豁免和检定的 mode 都能读取它们，无需新的路径；`item` 会带到修正值、掷骰的加值和防护上，日志用堆叠名称称呼它，而不是把它当成状态去查找。`rulesetCombatHide` 把生物的外皮和它物品的外皮合在一起计算伤害，`rulesetImmuneToCondition` 接收规则定义以便读取物品（一击带来的状态和开场崩溃都会传入它）。
- **战斗中的 `resolution.adjust`。** 战斗从人物卡构建的每次掷骰都会加上它，与检定一样：攻击行和武器（经由 `abilityAndSkill`）、需要掷骰命中的能力条目、豁免、对抗检定的检定值和先攻，无论是战斗开始时还是每轮重掷时。引用属性修正值或属性值、技能或豁免的数值引用，算作用该属性进行的掷骰；其他任何掷骰只取适用于所有掷骰的条目。两个示例中的东西默认都不会变化，因为它们的条目读取的都是处于默认值的实时状态。
- **硬度。** `combat.pool.hardness`(人物卡上的一个值，像吸收一样读取) 和生物的 `hardness`，除非有风格消耗先攻，否则会被拒绝；以人物卡形式编写的生物从人物卡取得它。Game Master 编造的生物没有硬度：限幅会把它去掉，就像去掉吸收一样，因为没有任何档位为它设定界限。骰子低于硬度的消耗型一击仍算命中（数值回到 base），并记录一个 `hardness` 事件，而不是造成伤害；消耗型风格对它会被挡住的第一个目标的预测为 0(对于范围攻击，是任何合法瞄准会先覆盖到的那一个)。这是 Exalted 的硬度，针对决定性的（消耗型）攻击。Storyteller 记录中关于“面对坚韧目标的夺取型一击”的“Not built”说明措辞不够严谨：夺取型一击本来就会遇到吸收，作者指南中的“Not yet”那一行现在也这样说明。
- **看到的和说出的。** 物品事实新增战斗类内容：攻击、防御（用规则集自己的词称呼，如“Guard”）、速度（一个数值，或者减半、加倍）、用文字描述的战斗效果，以及被挡开的伤害和状态；界面上是本地化的文字，给 Game Master 的则是英文。以数字形式写出的防御没有名称，所以读作“defense”。在骰池规则集中，物品对攻击的修正值是固定数量的骰子，与状态的修正值一样，导入时和编造时都是如此。它对检定和豁免的修正值仍然可以是骰子，在 1.56 之前就可以：战斗会把它们掷出的结果作为骰子加上，与战斗之外的骰池检定完全一样，所以现在拒绝它们只会拒绝在 1.54 上就已安装的规则集。编造物品会读取攻击上的 `+N`/`-N`/优势或劣势，以及防御（或它的称呼）上的 `+N`/`-N`，受稀有度的加值限制；复制来的速度变化不设上限（它是距离，不是加值），而复制来的效果如果只剩下它所挡开的部分，也会保留。Gemma 4 E4B 在 6 个护腕中有 4 个，为了一个 +1 同时写了“+1 Guard”和 `guard=1` 属性，并忽略了要求二选一的格式说明，所以如果编造物品提供了防御会计入的属性（`rulesetItemStatsRead`，会追溯派生值），就会去掉对防御的穿戴变化并加以说明；格式说明仍然点出那个属性（仅限 Game Master 能看到的那个）。攻击或防御后面的“Bonus”也会被读取（“+1 attack roll bonus”）。
- **示例。** Ember Roads 的路标石在携带时可以抵抗灼伤。Gravewatch 被诅咒的寡妇戒指会让攻击少一颗骰子，它的 Dawn bell 在绑定时让持有者不会陷入 rattled。
- **已验证**：`scripts/regressions/game-ruleset-armor.regression.ts`(每个部分的导入和门槛；战斗中物品对攻击、防御、速度、效果、豁免、伤害和状态的作用；被挡开的一击带来的状态和崩溃；需求；日志中的名称；每种掷骰上的 `resolution.adjust`；一击上的硬度、预测和图鉴生物；事实；编造物品)、固定较旧门槛、示例或提案格式的各条渠道，以及 `e2e/game-ruleset-armor.e2e.ts`，其中 62 处有意的破坏每一处都会被发现。

### 弹药和装填确定了什么

Capability API 1.57，对应 #6871。规则集物品计划的切片 I5-3，从第 4.4 节的其余部分（射击模式、副手攻击、伤害下限和命中时的状态，现在属于 I5-4）中拆出，让写入物品栏的那部分可以单独发布。

- **键。** 武器的 `attack` 新增 `ammo`(`tag`，物品块的标签之一；`perAttack`，默认 1；`recover`，一个 0 到 1 的比例) 和 `clip`(`max`，一个数字或物品的数值属性；`reload`，一个预算)。弹匣里的弹药不会被捡回，所以 `clip` 旁边的 `recover` 会被拒绝，一次射击超过写明的弹匣容量的攻击也会被拒绝。没有战斗块的规则集两者都不读取，与它不读取攻击的其他任何部分一样。
- **记在参战者身上。** `sheet.items` 是参战者在战斗开始时持有的东西，永远不会改变；参战者身上的 `itemsUsed`、`loaded` 和 `recoverable` 以物品在该列表中的位置为键，记录战斗中做了什么（`ammo.ts`）。弹药从每个带该标签的携带堆叠中抽取，先抽第一个堆叠，不论是否穿戴。`rulesetActionAvailable` 会询问 `rulesetShotsAvailable`，所以菜单、窗口和序列看待空武器的方式一致，`rulesetOpportunityAttack` 也是如此，它保留了一份自己的记账副本（菜单所在的模块会读取它）；`spendAvailability` 在任何地方执行动作时都会消耗射击次数。
- **装填。** 带弹匣的武器会新增第二个动作 `reload:<index>`，属于新的 `reload` 类型（不指向任何人，不掷骰，不打开窗口），在弹匣还有空位、并且（如果它抽取 `ammo`）背包里还有弹药时提供。它从背包中装填到 `max`，没有 `ammo` 时则直接装满。战斗 AI 把它当作任何不指向他人的动作（铺垫）来衡量；由于空武器不在菜单上，Engine 操控的队员会先装填，再开火。
- **装填数，记在堆叠上。** `GameInventoryStack.loaded` 只保存在单件物品的堆叠上（穿戴的堆叠总是如此），读入 `RulesetSheetItem.loaded`，没有这个值的武器视为已装满。把堆叠合并在一起会丢失它（这是堆叠类型上的一个 `ponytail:` 上限）。
- **回收。** `pushOutcome` 只在 `victory` 时回收：逃跑的战斗永远到不了这一步（由导演结束），失败的战斗也没有可以回收的战场。回收比例按堆叠在射出时累加，最后只向下取整一次，并为分数之和留出一点容差。
- **写回。** `RulesetSheetItem.stack` 携带物品栏堆叠的 ID、物品引用和持有者。导演的 `save()` 会把战斗与存储的状态比较（`rulesetFightItemChanges`），并通过 `applyGameInventoryChangeHeld` 按堆叠 ID 写入变化（`applyRulesetFightItemChanges`），与队伍的实时人物卡在同一个事务中完成，并写入日志条目（“used”，以及回收物的“acquired”）。打赢的战斗归还给一个已被用空的堆叠时，会以它自己的 ID 重新创建这个堆叠；堆叠不存在、数量不足，或者该 ID 下放的是另一件物品时，这一步会被拒绝，与 classic 消耗一样。
- **看到的和说出的。** 物品事实新增 `ammo`(标签名称、每次攻击用量、回收比例) 和 `clip`(最大值、装填预算的名称)；Game Master 的那一行以 `ammunition Arrow (1 an attack, 50%
  picked up after a won fight)` 或 `holds 1, reload (Act)` 结尾。菜单在选项旁显示 `3 to shoot` 或 `0 of 1 loaded`，Reload 组会写出武器名，日志会打印 `shot`、`reload` 和 `recovered`。
- **示例。** Ember Roads 的箭带上新的 `arrow` 标签，它的猎弓可以射这些箭，能捡回一半。Gravewatch 新增 `shot` 标签、`powder` 类别、一把守夜手枪（弹匣容量一发，用 act 装填）以及弹丸和火药。
- **已验证**：`scripts/regressions/game-ruleset-ammo.regression.ts`(导入和门槛、从一个和两个堆叠射击、空武器不在菜单上且会被拒绝、打赢后回收而打输不回收、弹匣用尽、从背包或免费装填、从属性读取的弹匣、按堆叠 ID 写回（包括移除和重新创建堆叠）、单件堆叠上的装填数、事实以及日志)、固定较旧门槛或示例的各条渠道，以及 `e2e/game-ruleset-ammo.e2e.ts`，其中 61 处有意的破坏每一处都会被发现（其中导演写入那一处由 e2e 发现）。

### 模式、副手攻击、下限和命中时的状态确定了什么

Capability API 1.58，对应 #6875。规则集物品计划的切片 I5-4：第 4.4 节的其余部分。

- **模式。** 武器的 `attack.modes`(最多六个) 每个都带有 `id`、`label` 以及它们改变的内容：`ammo`(一次攻击的射击次数，所以武器要有 `ammo` 或 `clip`，而且不能超过写明的弹匣容量)、`toHit`、`target`(目标值可以变化的骰池战斗) 和 `targets`。`rulesetModedAction`(ammo.ts) 派生出某个模式下的攻击：标签在括号中加上模式名称，`toHit` 相加，骰池目标值从武器自己的目标值移动，否则从骰池的默认值移动，目标数量取模式的值，`shots` 替换其弹药的每次攻击用量。菜单在选项上列出持有者有足够射击次数的模式，每个都有自己的预测，窗口中则不列出。选择中的 `mode`(以及暂缓攻击的 `resume.mode`) 会以该模式进行攻击；选项不提供的模式会以 `unknown-mode` 被拒绝。模式的传递方式与先攻风格相同：命令模式、导演的命令和 GM 候选路径、客户端的菜单步骤（在风格步骤之后）、棋盘以及 `DirectedCombatUI`。
- **Engine 的选择器会衡量模式**（`modedWays`，与 `styledWays` 并列），但只在瞄准单个目标时：它让每个候选都瞄准一个目标，而针对多个目标的模式会为它根本不会射出的射击付费（这是一条 `ponytail:` 说明；升级办法是为每组目标各生成一个候选）。
- **副手。** `combat.offHand`(`budget`，`ability` 为 `full` 或 `penalty-only`) 和物品的 `attack.offHand`。穿戴着副手武器时，主攻击会带有 `pairs`(副手武器的物品索引)，第二个动作 `offhand:<index>` 使用副手预算并带有 `offHandOf`，它只有一击（没有 `strikes`），伤害属性按规则集允许的方式计入。在一个回合中使用带 `pairs` 的攻击会设置 `flags.offHand`，它会在下一回合开始时与其他标志一起清除；`rulesetActionAvailable` 只在另一件武器攻击之后才提供副手攻击。`rulesetOpportunityAttack` 从不选择它。选项注明 `offHand`，客户端称它为“<weapon>, off hand”。
- **下限。** `attack.floor`(一个数字或数值属性) 就是动作上的 `damage.floor`。骰池一击经过吸收后的第一段伤害，或者求和一击的第一段伤害，会在豁免将其减半、抗性将其减少之前提高到这个下限；提高了伤害时，伤害事件会带有 `floor`，日志也会注明。消耗型一击的流程从不读取它。
- **命中时。** `attack.onHit` 条目（`condition`、`atLeast`、`rounds`）会在这一击之后，当造成的伤害（经过吸收和抗性之后）达到 `atLeast` 时，通过 `applyConditionId` 施加，持续 `rounds` 轮，或者不计时；免疫按任何状态的方式读取。
- **看到的和说出的。** 物品事实新增 `modes`、`offHand`(预算的名称)、`floor` 和 `onHit`(状态的名称)；Game Master 的那一行以 `modes Volley (2 shots, -2 to hit, up to
  2 targets)`、`off hand (Quick)`、`at least 1 on a hit before resistance` 或 `Marked for 2
  rounds when a hit deals 2 or more` 结尾，物品详情也用本地化的文字说明同样的内容。
- **示例。** Ember Roads 的猎弓新增齐射。Gravewatch 在快速预算上新增 `combat.offHand`；它的银棺钉是一件副手武器，会把它伤害两点或以上的目标标记两轮，它的墓铲命中时造成的伤害绝不少于一。
- **已验证**：`scripts/regressions/game-ruleset-weapon-modes.regression.ts`(导入和门槛、两个目标和一个目标的齐射、被拒绝或不提供的模式、骰池模式的目标值、在另一件武器之后的副手攻击（而不是在墓铲之后或单独使用）、从不在顺带时使用、`penalty-only`、骰池和求和战斗中以及抗性之下的下限、刚好达到和低于数值时命中所带的状态、持续和被抵抗的状态、导演的命令、Engine 的选择器选择模式、事实以及日志)、固定较旧门槛、示例或 Game Master 那几行的各条渠道，以及 `e2e/game-ruleset-weapon-modes.e2e.ts`，其中 60 处有意的破坏每一处都会被发现（其中客户端的模式步骤及其命令这两处由 e2e 发现）。

### 战斗中使用物品确定了什么

Capability API 1.59，对应 #6880。规则集物品计划的切片 I6-1，从战斗之外使用物品（Use 按钮、Game Master 的 `use`、卷轴门槛、在休息时恢复的充能以及 `breaksOn`，现在属于 I6-2）中拆出，让战斗这一侧可以单独发布。

- **键。** 物品新增 `use` 和 `charges`。`use` 是 `mechanics` 词汇去掉只有人物卡行才有意义的部分（`cost`、`perCostStep`、`check`、`concentration`、`reaction`、`scales`、`gives`、`standard`、`rider`，以及 `utility` 和 `rider` 类型），再加上武器式的 `toHit`(仅与 `attackRoll` 一起使用)、`saveDifficulty`(一个数字或数值属性，只要其中有任何内容要求豁免就必须提供，因为物品没有可供读取的目录来源)、`consumes` 和一项 `charges` 费用。`charges.max` 是一个数字或数值属性。一次使用要么会被用掉，要么消耗充能，绝不会两者兼有；充能需要有消耗它的使用，并且 `stack` 为 1。有战斗块时，一次使用需要预算或 `free`，它的预算和命中会像武器一样检查，骰池战斗中伤害骰是骰池的骰子，伤势轨道会拒绝它的 `temporary`，就像拒绝能力的那样。
- **每次使用一个动作。** `mechanicsAction`(从 `abilityAction` 中提取出来) 可以从两者中的任一个构建动作；`itemUseActions` 为每件带有使用的持有物品添加新的 `item` 类型的 `use:<index>`，占用槽位或进行绑定的物品要在穿戴时才行，动作带有 `itemUse`(物品的索引、`consumes`，以及充能的费用和最大值)。只有人物卡行会带 `use`(资源池支付)，所以物品用它自己来支付。如果充能或豁免数值读取的是物品不提供的属性，这次使用就不会出现在菜单上。
- **记在参战者身上。** `rulesetItemUseLeft` 读取剩余数量：堆叠数量减去 `itemsUsed`，或者参战者身上的 `charges`，否则是堆叠保存的数量，再否则是 `max`。`rulesetShotsAvailable` 会询问它，所以菜单、窗口和序列看待已经用完的物品的方式一致；`spendRulesetShots` 会从堆叠或充能中扣除一次，并发出已有的 `uses` 事件。`rulesetOpportunityAttack` 从不选择使用。
- **充能，记在堆叠上。** `GameInventoryStack.charges` 只保存在单件物品的堆叠上，并读入 `RulesetSheetItem.charges`；把堆叠合并在一起会丢失它，与丢失 `loaded` 一样。
- **写回。** `RulesetFightItemChange` 新增 `charges`；导演的 `save()` 通过与射击和装填相同的 `applyGameInventoryChangeHeld` 路径写入它，堆叠不存在时这一步会被拒绝。
- **看到的和说出的。** 菜单在能力之后有一个 **Items**(物品) 组，棋盘把使用算作触及范围内可做的事。物品事实新增 `use`(预算名称、类型、数量、伤害类型、命中、豁免、状态、临时数值、射程、范围、距离单位、`consumes`、充能)；Game Master 的那一行以 `use (Action): heals 1d4 + 1, range 0 paces, used up` 结尾，物品详情也用本地化的文字说明同样的内容，并显示剩余的充能。
- **编造物品。** 以 `like=` 仿照带使用的物品做出的物品会复制 `use` 和 `charges`，`stack` 本来就会一起带过来。
- **示例。** Ember Roads 新增一种药膏（Action 上的治疗，用后即耗尽）。Gravewatch 的暖身药剂在快速预算上治疗一格伤害，用后即耗尽；它的 dawn bell 在穿戴并绑定时，可以消耗三次充能中的一次，让 Steel 豁免对 7 失败的目标陷入 rattled。
- **已验证**：`scripts/regressions/game-ruleset-item-use.regression.ts`(导入和门槛、对持有者和友方使用药膏而绝不对敌人使用、用尽后被拒绝、Items 组、在快速预算上与一击并用的药剂、只在穿戴时可用的铃铛、它消耗和保留的充能、一次消耗两点的使用、从属性读取的充能、从不在顺带时使用、按堆叠 ID 写回、单件堆叠上的充能、Engine 自己的队员治疗受伤的人、事实、Game Master 的那几行以及编造物品)、固定较旧门槛、示例或菜单分组的各条渠道，以及 `e2e/game-ruleset-item-use.e2e.ts`，其中 69 处有意的破坏每一处都会被发现。

### 战斗之外使用物品确定了什么

Capability API 1.60，对应 #6881。规则集物品计划的切片 I6-2，又从在休息时恢复的充能、`breaksOn` 和卷轴 `gate`(现在属于 I6-3) 中拆出，让物品栏和生成这两个衔接点可以单独发布。

- **`restore`。** 使用的 `restore`(`pool`、`amount`) 是一个已声明的、不是生命资源池的实时资源池，用于治疗或增益，并带一个数量。在战斗中它是 `action.restore`，会在临时数值之后写入每个有人物卡的目标，并发出 `restored` 事件；选项带有 `restores`，Engine 的选择器会跳过资源池已满的目标（或友方构成的范围）。
- **战斗之外的一次使用。** `useRulesetItemOutsideFight`(共享的 `item-use.ts`) 是纯函数：它找到堆叠及其物品，拒绝不是规则集物品、没有使用、占用槽位或进行绑定却没有穿戴、或者充能不足的物品，然后把作用在使用者身上的部分应用到使用者身上（没有瞄准敌人的治疗或增益）：通过与战斗相同的操作进行治疗（资源池的 `restore`，或清除一个伤势标记）、`temp`、`restore`，以及施加每个状态。有害的或瞄准敌人的使用不应用任何东西，只说明它的作用（`rulesetItemUseDoes`）。它通过 `applyRulesetFightItemChanges` 进行消耗，把消耗充能的使用记入日志为“used”，并返回说明的各部分；`rulesetItemUseLine` 是给 Game Master 的那句话。
- **Use 按钮。** `POST /api/game/inventory/use`(`useGameRulesetItem`) 在聊天的元数据队列和一个事务中运行：背包通过 `applyGameInventoryChangeHeld` 处理，携带者的实时人物卡在可见的游戏状态行上处理，用 `rollDieSecurely` 掷骰。客户端通过与其他物品栏保存相同的有序路径（`sendInventory`）发送它，让游戏状态存储跟上，并发送“I use my X.”以及一个包含那句话的 `[item_used]` 块。这个块是保留的标签名，会和战斗回顾一起被去掉（`stripEngineResultBlocks`），并显示为一个徽标。没有使用的物品仍然只发送那句普通的话。
- **Game Master 的 `use`。** `InventoryTagAction` 新增 `use`；`applyGameInventoryTags` 接收一个 `GameInventoryItemUser`，由生成路由根据人物卡命令的实时状态和每回合的种子（`rulesetCombatRoller`），从 `gameInventoryItemUser` 提供，所以预览的回答和保存的回答掷出的结果相同。回答把那句话作为它的 `note`；使用之后留下的人物卡会在回合保存前替换该回合的实时状态。提示词在有物品目录的规则集中提供这个标签并解释 `[item_used]`，客户端会提示“You used Poultice.”
- **示例。** Gravewatch 的暖身药剂还会恢复一点 Resolve。
- **已验证**：`scripts/regressions/game-ruleset-item-use-outside.regression.ts` 和 `e2e/game-ruleset-item-use-outside.e2e.ts`，其中 48 处有意的破坏每一处都会被发现。

### 随时间恢复的充能确定了什么

Capability API 1.61，对应 #6888。规则集物品计划的切片 I6-3，从卷轴门槛（现在属于 I6-4）中拆出，让休息衔接点和检定衔接点可以单独发布。

- **键。** 物品的 `charges` 新增 `recharge`(`rests`，规则集的一到十二个休息 ID；`amount`，`"max"` 或一个数量) 和 `breaksOn`(`die` 为 2 到 100，`atMost` 不超过 die)。未知的休息和空数量会在导入时被拒绝。
- **损坏。** 战斗中的使用在 `itemUse.charges` 上带有 `breaksOn`；`breakRulesetItem`(ammo.ts) 由 `spendAvailability` 在一次把物品用空的消耗之后立即调用，它用战斗的骰子掷骰，损坏时把物品从它的单件堆叠中拿走，并标记为 `broken`，发出 `broke` 事件。写回时把拿走的东西记入日志为“lost”。在战斗之外，`useRulesetItemOutsideFight` 以同样的方式掷骰，并说明 `broke`。
- **恢复充能。** `rechargeRulesetItems`(item-use.ts) 为一次休息补满一个背包中携带的物品，绝不超过 `max`，充满后去掉保存的数量。在有物品的规则集中，人物卡的 Rest 按钮会经过 `POST /api/game/inventory/rest`(`restGameRulesetCharacter`)：在任何仍待保存的人物卡编辑落地之后，在一个事务中完成角色人物卡上的休息和其背包的充能恢复（玩家的角色卡对应玩家自己的背包）。Game Master 的休息从 `applySheetCommandTags` 作为 `rests` 返回（按角色卡计，所以队伍休息会计入每个成员），生成路由的物品栏处理也会为它们运行，从回合开始时恢复充能，所用的骰子与使用的骰子分开保存（`gameInventoryRestRecharge`）。
- **看到的和说出的。** Game Master 的物品栏行会给出每个带充能的堆叠剩余的充能（`gameInventoryTotals` 的 `chargesOf`）；物品事实和详情会说明什么会恢复、什么会损坏，使用的费用现在读作“spends 1 of 3 charges”。
- **示例。** Gravewatch 的 dawn bell 在结束守夜时恢复充能，敲空时可能会裂开。
- **已验证**：`scripts/regressions/game-ruleset-item-charges.regression.ts`、`game-inventory-turn.regression.ts` 中 Game Master 的休息，以及 `e2e/game-ruleset-item-charges.e2e.ts`，其中 35 处有意的破坏每一处都会被发现。

### 物品门槛确定了什么

Capability API 1.62，对应 #6892。规则集物品计划的切片 I6-4，是从随时间恢复的充能中拆出的检定衔接点。

- **键。** 使用的 `gate`：`check` 恰好是技能、属性或数值引用之一（数值形式用于因角色而异的数字，比如 5e 施法者的施法调整值）；`difficulty` 是 1 到 100 或一个物品属性；`unless` 是一个数值引用加上 `atLeast`。未知的技能、属性、数值引用和物品属性会在导入时被拒绝。
- **只计算一次。** `rulesetItemGateCheck`(check-effects.ts) 在满足 `unless` 时返回 null，否则返回目标、人物卡上的数值（`rulesetCheckModifier`，或者那个值）加上 `resolution.adjust`，以及难度（`rulesetItemGateDifficulty`，item-book.ts；属性缺失时它为未定义：战斗会去掉这次使用，Use 按钮会以 `no-use` 拒绝它）。
- **在战斗中。** `itemUseActions` 在战斗开始时把门槛放在 `itemUse.gate` 上（满足 `unless` 时没有门槛）。主选择路径在 `spendAvailability` 之后立即掷它（`passesGate`，形式与 `rollSave` 相同）：骰池战斗中掷骰池，否则掷战斗的骰子，并带上使用者的状态和穿戴物品的“checks”修正值和掷骰模式。`rulesetConditionModifiers` 和 `rulesetCheckMode` 现在会放行点名的技能，所以收窄到这项技能的内容会计入；对抗检定仍然不点名任何技能。门槛失败会发出 `gate` 事件，并以物品已被消耗结束这个动作。物品使用从来不是反应、序列的一部分或招牌动作，所以其他消耗路径都不需要它。
- **在战斗之外。** `useRulesetItemOutsideFight` 会在应用任何东西之前掷它，使用使用者自己的物品（堆叠持有者的 `rulesetSheetItems`）、规则集的掷骰器（`rollDiceSumCheck`，或 `rollDicePoolCheck`，难度会被限制在骰池能计数的范围内）、伤势惩罚和 `rulesetCheckEffects`。失败会消耗物品但不应用任何东西；`said.gate` 把这次掷骰带进那句话里。
- **看到的和说出的。** 物品事实带有 `gate`(检定名称、难度、以数值标签表示的 `unless`)；Game Master 的那一行会说“needs a Ward check against 2 first, unless Nerve is 3 or more; failed, it is used up for nothing”，详情也会这样说明，战斗日志中有通过和失败的记录行。
- **示例。** Gravewatch 的守夜祷文残页在通过 Ward 门槛后恢复两点 Resolve，Nerve 达到 3 时可以跳过门槛。
- **已验证**：`scripts/regressions/game-ruleset-item-gate.regression.ts` 和 `e2e/game-ruleset-item-gate.e2e.ts`，其中 36 处有意的破坏每一处都会被发现。

### 战利品确定了什么

Capability API 1.63，对应 #6894 以及 #6758 的战利品偏差。规则集物品计划的切片 I7-1，从货币（I7-2）中拆出。用户在 2026-09-30 裁定，没有规则集的游戏也能得到战斗指南一直承诺的原生掉落。

- **键。** `items.lootTables`(`rolls` 是一个数字或骰子，`entries` 是 `item` 引用或按稀有度、类别和标签的 `filter`，每一项都带 `weight` 和 `count`)，以及图鉴生物指定一张表的 `loot`。未知的目录、内联目录中的物品、词汇和表会在导入时被拒绝。安装门槛最后才要求 1.63，排在所有较旧的检查之后，所以声明较旧次版本号的包会先得知那个次版本缺少什么。
- **一条来源规则。** `planGameVictoryLoot`(game-loot.service.ts)：有战利品表的规则集会掷被击败者的表（`rollRulesetLootTable`，features/rulesets/loot.ts），放进共享的视图中（`among`，玩家的角色卡在前，玩家的角色卡按 Use 和 Rest 路由的方式选择）；否则，在开启原生物品时，`generateCombatLoot`(loot.service.ts，其随机性现在由外部注入) 把普通物品放进玩家的背包；否则什么都不掉。
- **每场战斗一次。** 导演主持的战斗（所有规则集战斗，以及启用战斗导演的 Classic 或 Tactical 战斗）在获胜的那一步掉落，在那一步的事务中完成（combat-director.routes.ts 中的 `save()`），并保存在 `CombatDirectorState.loot` 上，`sync()` 会把它复制进摘要，没有掉落时为空。战斗状态在构建战斗时保存每个图鉴对手的表（`RulesetFightState.lootTables`）。只在界面上进行的战斗会请求 `POST /api/game/inventory/loot`(`lootGameFight`)，以开始这场战斗的消息为键，并记录在堆叠旁边的 `gameLootedFights` 中。未使用的 `/game/combat/loot` 和 `/game/loot/generate` 路由已经去掉。
- **说出的。** `handleCombatEnd` 会在回顾之前等待掉落：“Loot (already in the party's bags)”、留下了什么、日志行和一条通知；只有在什么都没掉落时才出现“decide a reward”那一行。
- **Game Master 的 `[loot:]`。** 与物品栏标签一起解析（`createLootTagRegex`、`parseLootTagBody`），由 `applyGameInventoryTags` 接收的一个钩子掷出，按回合设定种子（`gameLootTagRoller`，与使用和休息的骰子分开），并作为已结算的添加来回答，所以界面会提示它，下一回合也会像读取任何添加一样读取它；什么都没掉落的表或被拒绝的标签会保留它自己的位置。它是保留标签，会从叙述中去掉，在会话日志中显示为徽标，并且只在规则集有表时才列入 Game Master 的指令。Mari 的指令会说明实际发生了什么。
- **示例。** Gravewatch 的陪葬品，由 hollow warden 和 grave wight 携带，还有一行可掉落任意武器的过滤条目。Ember Roads 没有战利品表，所以裁剪它的那些渠道保持原样。
- **已验证**：`scripts/regressions/game-ruleset-loot.regression.ts`(其中包括一场通过路由打赢的导演主持的 Ember 战斗)、`game-inventory-turn.regression.ts` 中的 `[loot:]` 回合，以及 `e2e/game-ruleset-loot.e2e.ts`，其中 40 处有意的破坏每一处都会被发现。

### 货币确定了什么

Capability API 1.64，对应 #6901。规则集物品计划的切片 I7-2，在战利品（I7-1）之后。

- **硬币就是堆叠。** 硬币是一个 `item` 为 `coin:<unit id>` 的物品栏堆叠（`GAME_INVENTORY_ITEM_REF_PATTERN`），以单位的标签命名，所以它拥有堆叠已有的一切：背包、给予、拆分、合并、带入新会话、回合重来和分支。物品簿（`rulesetItemBook`）为每种硬币给出一个条目，重量为携带属性的 `1 / perWeight`，`coinNamed` 可以按 ID 或标签（单数或复数）找到硬币。不需要新的存储。
- **支付和赚取。** `[inventory: action="pay" amount="3 shillings" who="..."]` 和 `action="earn"`。支付由 `payGameInventoryCoins`(game-inventory-coins.ts) 处理：一个背包、一个货币体系，先用最大的硬币，然后把能覆盖余额的最小硬币破开，用较小的硬币贪心地找零；会以 `cannot-afford`、`unknown-coin` 或 `no-currencies` 拒绝。日志会列出花了什么、找回了什么。赚取就是添加硬币，按携带规则放置。
- **说出的。** 物品栏堆叠上方的钱袋行（`ui.game.gameinventory.purse`）、选择器的 Coins 列表、每次支付和赚取的通知；对 Game Master 而言，则是每个背包按货币体系计算的价值（`rulesetPurseText`）、物品事实中的价格，以及只在规则集有硬币时才出现的支付和赚取那一行。
- **层隐藏硬币，绝不改写它们。** 层的 `currencies`(`removeUnits`、`removeFamilies`；一个货币体系的最小硬币只能随其体系一起移除) 由 `rulesetLayeredCurrencies` 读取，方式与 `catalogEntryHiddenByLayers` 隐藏目录条目相同：生效的定义保留所有硬币，所以以已经移除的硬币定价的物品仍然能通过校验，它的价格会以同等价值、用剩下的能恰好支付它的最大硬币来表述。改为从生效定义中删除硬币，会让带层的定义校验失败（Gravewatch 有两件物品以 crown 定价），结果悄无声息地丢掉了整个层。
- **战利品掉落硬币。** 战利品行可以指定 `coins`(一个单位 ID)，而不是物品或过滤条件。
- **浏览器在战利品表上保留层。** 从 I7-1 起，战利品行中的物品也会在带层的定义中对照其目录的内联条目检查，而浏览器的列表在发送目录时不带条目，所以检查在那里失败，客户端会丢掉有战利品表的规则集的每一个层，服务器却保留着它们。带层的定义（`layersApplied`）现在跳过这项检查：文件在导入时已经检查过。
- **安装门槛**在 1.63 检查之后，为层的 `currencies` 或战利品行的 `coins` 要求 1.64。
- **示例。** Gravewatch 的陪葬品会掉落几枚 shilling，它的长夜层会去掉 crown。
- **已验证**：`scripts/regressions/game-ruleset-money.regression.ts` 和 `e2e/game-ruleset-money.e2e.ts`，其中 55 处有意的破坏每一处都会被发现。另有两处发现了支付中永远不会改变结果的条件，这些条件已被删除。

### Classic 和 Tactical 战斗中的物品确定了什么

Capability API 没有变化：规则集物品计划的切片 I8-1(#6905) 读取的是随 1.59 发布的键。

- **来自 `use` 的效果。** `rulesetItemFightEffect`(features/rulesets/item-fight.ts) 把物品的 `use` 转换成标为 `ruleset: true` 的 `CombatItemEffect`：按目标最大生命值的一定比例治疗或造成伤害（`average / AVERAGE_AMOUNT_PER_POWER * 0.22`，范围 0.05 到 1，是按 Engine 典型的一击 11 到 15 点、总生命约 60 点来衡量的桥接比例），伤害类型作为元素，第一个施加的状态按其标签作为异常状态，`targets` 或按类型给出的默认值，以及 `consumes`。描述是物品自己的使用说明。
- **战斗提供哪些物品。** `gameFightItems` 在 `native` 开启时保留普通物品，规则集的物品则只有在有效果时才保留；只保留普通物品会采用的猜测（所以为规则集物品做出的猜测会被丢弃，与规则集物品同名的普通物品无论哪个先列出都保留它自己的），声称属于规则集的猜测也会被丢弃。没有物品簿时，和以前一样会对每件物品进行猜测。服务器的 `loadGameFightItems` 会在以下场合读取它：遭遇开始时（其提示词会列出模型不得改动的规则集物品）、战斗导演开始时（它不再信任界面为这些物品提供的效果），以及在有规则集物品的游戏中的 Classic 回合路由（它会拒绝战斗不提供的物品，并把计算出的效果放在规则集的物品上）。界面只在战斗的效果包含某件规则集物品时才列出它。
- **规则集的治疗决定其强度。** `resolveItemAction` 对规则集效果按 `power` 治疗；猜测出的治疗仍按其名称暗示的量来治疗，与以前一样。
- **从 I8-2 中拆出。** 在 I8-2(见下文) 之前，使用时会消耗充能或要求先进行检定的物品不会出现在这些战斗中。只在界面上进行的 Tactical 战斗和以前一样完全不提供物品，而它的路由（其引擎会用交给它的任何物品治疗）现在只接受战斗提供的普通物品。
- **已验证**：`scripts/regressions/game-ruleset-classic-items.regression.ts` 和 `e2e/game-ruleset-classic-items.e2e.ts`，其中 39 处有意的破坏每一处都会被发现。第四十处表明，在只保留普通物品会采用的猜测之后，对猜测的一项检查永远不会改变结果，所以这项检查已被删除。

### Classic 和 Tactical 战斗中的充能和门槛确定了什么

Capability API 没有变化：规则集物品计划的切片 I8-2(#6909)。

- **按使用次数提供，取自可以使用它们的堆叠。** 效果带有 `charges`(费用和最大值) 和 `wear`(在物品要求时须穿戴和绑定)。服务器和界面都会读取的 `gameFightOffers`，会按可用堆叠（没有计数的堆叠视为满）计算带充能的条目还能用几次，只在还剩至少一次时提供这个条目。这也补上了 I8-1 的一个缺口：占用槽位或进行绑定的物品，在没有穿戴时也会被提供。
- **通过 `charge` 操作消耗。** 新的物品栏操作：按物品自己的名称消耗 `count` 次，每次都从第一个有足够充能的可用堆叠中扣除，先扣玩家自己的（或者用 `from` 指定一个背包）；堆叠被用空时，会用调用方传入的骰子掷物品的 `breaksOn`(`applyGameInventoryOps` 接收一个 `roll`；物品栏路由和导演传入 `rollDieSecurely`)，损坏时物品消失。物品簿中的物品带有它们的充能规则（`GameInventoryRulesetItem.charges`）。界面在一轮之后为带充能的物品发送它；导演在保存一步时，把带充能条目的消耗转换成它。
- **从可以使用它的堆叠中用掉。** `take` 操作新增的 `worn` 标志（`gameInventoryUsableStack`，与 `charge` 操作共用）只消耗穿戴着的、在需要绑定时也已绑定的堆叠；界面和导演都会设置它。没有它的话，战斗会计入穿戴着的药剂，却从背包里喝掉一瓶备用的；穿戴着的诅咒戒指也会在原位把备用戒指用掉。同一条规则，即 `gameInventoryWearNeeds` 加上 `gameInventoryWearMet`，为 Use 按钮、战斗菜单和这些消耗统一说明穿戴的含义，所以它们不会再各行其是。
- **门槛在服务器上掷骰。** `rollRulesetItemGate`(item-use.ts) 从 Use 按钮的路径中提取出来，按使用者的人物卡、实时状态和穿戴物品掷骰。`rollGameFightItemGate`(game-item-use.service.ts) 按单位的名称找到使用者的角色卡；只有玩家自己的单位（玩家的角色卡，或用户角色的名称）会退回到玩家的角色卡，其他没有角色卡的人会用来自他们自己背包的空白人物卡掷骰，与规则集战斗构建他们的方式一样。Classic 回合路由为这一轮把物品交给的单位掷骰；导演的命令路由在玩家的 classic 或 tactical 物品命令之前掷骰，并把动作标记为 `failed`。失败的使用是一次什么都不做的未命中，带有一个 `note`，日志会显示它，而不是通常的那一行。
- **已验证**：`scripts/regressions/game-ruleset-classic-items.regression.ts` 中关于充能和门槛的部分，以及 `e2e/game-ruleset-classic-items.e2e.ts`，其中 40 处有意的破坏每一处都会被发现。

### 市场确定了什么

Capability API 1.65：规则集物品计划的切片 I9-1(#6917)。

- **市场位于物品块中。** `items.market` 包含价格档次（物品价格的 `times`，其中一个为 `default`）、地点规模（一条阶梯，从最小的开始）、`sold` 规则（按战利品行的方式读取的过滤条件，第一条匹配的规则决定结果）以及 `sellers`(过滤条件、一个最小地点，以及一个像门槛的 `unless` 那样从买家人物卡读取的 `only`)。物品可以带有它自己的 `sold` 地点，以及一个 `service` 标记，用于只购买、从不携带的东西。`market.ts` 计算所有内容：按 ID 或标签确定地点、物品从哪个等级开始出售、某个等级上有哪些卖家、价格（以最小的硬币计算并在此取整，如果价格所写的那种硬币能恰好支付，就用那种硬币表述，否则用各层留下的、能恰好支付的最大硬币表述（1.69 加入了前半部分；在那之前，5e 中 50 gp 的药水会读作 5 platinum pieces），与 `itemPrice` 表述价格的方式一致）、用来回答购买的报价器，以及 Game Master 的块。
- **地点来自聊天，而不是存储的状态。** Game Master 的 `[place:]` 标签会就地回答（`game-place-tag.ts`），生效的地点是从最近一次对话开始起、玩家看到的 Game Master 回复中最后回答的那个（玩家输入的标签从不计入）（`gamePlaceBefore`，它只读取重新生成所替换的那次讲述之前的内容），然后才是回复自己的地点。所以备选回复、删除和分支都不需要额外处理。`place` 是保留的 GM 标签名。世界生成计划会用生成的世界填充同一个衔接点。
- **购买要么同时是一次支付和一次添加，要么两者都不是。** `buy` 动作会报价，用 `payGameInventoryCoins` 从买家的背包中付款，然后在已付款的堆叠上添加；添加被拒绝，或者只放得下所买东西的一部分时，堆叠保持原样。服务会被添加本身拒绝（`service`），所以没有任何东西会把服务放进背包，选择器也不列出服务。市场的构建器每回合构建一次（`loadGameMarket`），保存在物品栏回合上，并为预览和保存各构建一个新的市场（1.69：市场会计入回复中的买卖），所以两者的回答一致。`only` 会对照买家自己的角色卡检查（没有名字或是玩家自己时用玩家的角色卡；没有角色卡的队员用空白人物卡），并使用他们在该标签处携带的东西（回复中较早的标签留下的堆叠）以及该回合自己的实时状态，也就是该回合使用其物品时的那个状态（绝不是被替换的那次讲述的记录行）。
- **只在规则集有市场时告诉 Game Master：** 地点行和购买行，以及一个 MARKET 块，列出在场的每个卖家及其十几件商品，最便宜的在前。
- **已验证**：`scripts/regressions/game-ruleset-markets.regression.ts` 和 `e2e/game-ruleset-markets.e2e.ts`，其中 61 处有意的破坏每一处都会被发现。

### 集市日确定了什么

Capability API 1.69：规则集物品计划的切片 I9-2(#6934)。

- **一天和地点一样，是从聊天中读出来的。** `answeredGamePlaces` 列出 Engine 回答过的每个地点标签及其位置；`gameMarketDayStart` 找出开启最后一个标签所在那一天的标签：另一个地点（名称不区分大小写，或者一个规模），或者同一个地点再次以 `day="new"` 说出。这一天以聊天、该标签在地点标签中的序号和地点来命名，这个名称就是为它掷出的一切的种子，所以一条回复的提示词、预览和保存，以及之后的每个回合，掷出的都是同一排货架。`gameMarketDayFor` 读取一条回复之前的那一天（以及回复自己的地点标签），以及 Engine 在开启这一天的标签之后回答过的买卖，这些买卖是从已回答的标签（`stock="true"`、`seller`、`price`）中读回的。什么都不存储，所以备选回复、重新生成和分支都不需要额外处理。
- **货架**（`rulesetMarketShelf`）：每个卖家的 `stock` 表按这一天掷出（只有物品，绝不包括硬币），每个 `limited` 数量也按这一天为每件物品掷出。购买会先取这个地点自己的商品，在上限允许的范围内取，然后才取某个卖家的存货（只取那个卖家的，仍会检查 `only`）；超出剩余数量的购买会以 `sold-out` 被拒绝。物品的地点和上限各自来自它自己的 `sold`，否则取第一条指定了它的规则。
- **出售要么同时是一次拿走和一次支付，要么两者都不是。** `sell` 需要一个 `buyBack` 比例，并且这里要有出售这类东西的卖家；它的价格是默认档次乘以这个比例，计入这个地点在该钱袋货币体系中的 `purse`，从卖家自己的背包中拿走物品（要么全部拿走，要么都不拿；绑定的诅咒物品永远不会被拿走），并从最大的硬币开始添加硬币；硬币放不下时，堆叠保持原样。日志会把它列为已售出。
- **市场会计入回复所做的事**（`record`），所以同一条回复中第二次购买仅有的那把手枪会被拒绝；这就是物品栏回合上需要那个构建器的原因。
- **告诉 Game Master 的内容：** 每个卖家今天的存货，以及限量物品还剩多少；一行出售说明，附上今天钱袋剩余的数额，如果钱袋自己的货币能恰好表述，就用那种货币；地点行教会 `day="new"`，在市场会回购的地方还会教出售那一行。
- **已验证**：`scripts/regressions/game-ruleset-markets.regression.ts`(1.65 的市场作为它自己的变体保留，所以较早的部分不会随这一天的骰子变化) 和 `e2e/game-ruleset-markets.e2e.ts`，其中 78 处有意的破坏每一处都会被发现。

### 持握武器上的附加效果确定了什么

Capability API 1.70，在 5e 包把武器作为物品（P1）之前完成。

- **附加效果读取的是行，所以持握的武器从来都不符合条件。** `riderActionIds` 会把 `sources` 和 `requires` 转换成符合条件的攻击行 ID，而从背包中持握的武器是一个 `item:<n>` 动作，所以包里的武器变成物品的那一天，5e 的 Sneak Attack 就会停止触发。附加效果的 `weapons: { tags }` 会加入带有其中任一标签的持握武器，以及在有副手攻击时的副手攻击；只点名行的附加效果仍然不会在持握的武器上触发，什么都不点名的附加效果则在任何命中时触发，与以前一样。
- **导入时检查**（每个标签都必须是物品块声明过的）并在 **1.70 设置门槛**，内联和目录文件中都是如此。
- **已验证**：`scripts/regressions/game-ruleset-weapons.regression.ts` 中关于附加效果的部分，其中 11 处有意的破坏每一处都会被发现。

## 一位规则集作者发现的不足

[Marinara-RPG-Extension](https://github.com/Kenhito/Marinara-RPG-Extension) 的作者已经以扩展的形式为 Marinara 发布了多个桌面系统。他用其中两个系统写成的 `ruleset.json` 文件（一个 Storyteller 风格的 Vampire 和一个 Exalted）对这个格式做了衡量。两者都能在 `staging` 上导入和运行；它们表达不了的内容就成了这个系列。每一项在提交之前都在 `staging` 的 e15c9e558(Capability API 1.36) 上重新检查过，只有人物卡块的阶梯标签已经完成。

**维护者裁定的顺序：** 先更新 5e 包（[Marinara-Agents#1082](https://github.com/Pasta-Devs/Marinara-Agents/pull/1082)，已合并），然后是下面的切片 1 到 6，然后是剩余的规则集战斗切片，最后是 Storyteller 战斗类型。报告中关于人物卡、提示词和文档的小项目是 [#6657](https://github.com/Pasta-Devs/Marinara-Engine/issues/6657)。这些项目先交给了报告作者；没有得到回复后，就并入了切片 1，任何没有按作者的意愿实现的内容都可以作为后续工作再提出来。每个切片是一个 Engine PR，在新增文件键的地方对应一个 Capability API 次版本号，示例放在 Gravewatch(骰池) 和 Ember Roads(求和) 上，其中没有任何内容使用某一款游戏专有的词汇。

| 切片 | 问题 | 新增内容 |
| --- | --- | --- |
| 1 | [#6651](https://github.com/Pasta-Devs/Marinara-Engine/issues/6651), [#6657](https://github.com/Pasta-Devs/Marinara-Engine/issues/6657) | 按名称选择的难度，以及在牌桌上使用的阶梯级目标值；检定可以移动其点数的骰池规则；两种属性合并掷骰；按半数骰子判定的大失败；以及关于人物卡、摘要、提醒和文档的小项目 |
| 2 | [#6652](https://github.com/Pasta-Devs/Marinara-Engine/issues/6652) | 常驻的重掷和通过消耗买到的重掷；从人物卡读取的消耗上限和更多消耗条目；从人物卡随附的修正值 |
| 3 | [#6653](https://github.com/Pasta-Devs/Marinara-Engine/issues/6653) | 读取实时轨道或资源池的派生值、技能和豁免的上限、对列表列求和，以及带“不等于”和“属于其一”的 `hideWhen` |
| 4 | [#6654](https://github.com/Pasta-Devs/Marinara-Engine/issues/6654) | 长度由公式决定、并按格子带惩罚表的伤势轨道，满了就拒绝的编号格子，按伤害种类治疗，以及每个角色的额外等级 |
| 5 | [#6655](https://github.com/Pasta-Devs/Marinara-Engine/issues/6655) | 属性、技能和豁免的分节，以及按技能或分节设定的未受训练规则 |
| 6 | [#6656](https://github.com/Pasta-Devs/Marinara-Engine/issues/6656) | 一个实时状态以及跟随它变化的数值，可通过休息重置（依赖 2 和 3） |

### 切片 1 确定了什么

Capability API 1.37，对应这个 PR 关闭的两个问题：#6651 以及 #6657 中的小项目。

- **按名称指定难度，两种类型都适用。** 标签上的 `difficulty="Label"` 会选取阶梯中的一级，匹配时不区分大小写和标点，并且只选取恰好有一级对应的名称：两级共用一个标签时，两级都不选。标签没有写 `dc=` 时，它会提供数值（骰池上是成功数，求和上是难度），在骰池上还提供这一级自己的目标值。写明的 `dc=` 仍然优先决定数值，`threshold=` 仍然优先决定目标值。记录写下的是数值，绝不是名称，所以保存的检定的任何读取方都不会变化。
- **阶梯级的目标值会在牌桌上使用。** 它以前只会印在提醒中，掷骰却忽略它。现在单独的 `dc=` 会按恰好需要这么多成功数的那一级的目标值来计数；如果有几级需要相同的数量（Storyteller 的难度表有七级都只需一个成功），就无从判断指的是哪一级，所以保持默认值，要指定就用名称。这有意改变了现有的掷骰：Gravewatch 的 `dc="1"` 现在按 6 计数，这正是它自己的阶梯一直写着的。
- **有名称而没有数值的标签是一次请求。** 读取方会保留它（`dc` 缺失，共享类型现在允许这样），只有规则集游戏能把它转换成数值，没有阶梯的游戏会让它保持原样，每一次稀疏改写都会保留这个名称。技能检定端点和单次请求分支也会在拿到规则集之后读取它；对于任何地方都读不懂的名称，端点会返回 400(`skill_check_difficulty_unknown`)。
- **检定可以移动其点数的骰池规则。** `explode` 和 `double` 可以带 `min`，即检定能把它们移动到的最低点数；`from` 变为可选，只有 `min` 的规则只在检定要求时才触发（一项让某个技能掷出 10 时重掷的专长）。标签上的 `explode="N"` 和 `double="N"`，以及角色使用的条目上的 `mechanics.check.explode` / `.double`，都会被限制在 `[min, sides]` 之内；条目优先于标签，就像买来的阈值那样。没有 `min` 的规则会忽略这个请求。如果规则集不允许任何检定移动那条规则，或者条目移动得比检定允许的更远，条目会在导入时被拒绝。只有在检定确实移动了点数时，记录才会写出这个点数。
- **两种属性合并。** `pool.abilityPlusAbility` 让属性检定上的 `with=` 加入第二种属性。只有骰池类型才有 `pool`，所以求和规则集无法声明它；在技能或豁免上，`with=` 仍然是替换属性。
- **按半数骰子判定的大失败。** `botch.rule: "halfOrMore"` 统计最初掷出的骰子中点数不超过 `upTo` 的数量，爆骰不计。没有任何骰子成功时就是大失败；否则结果保持不变，记录会加上 `complication="true"`，卡片和摘要会在结果旁注明这一点。报告用的是某款游戏自己的词（“glitch”）；Engine 用的是中性的说法。`"noSuccesses"` 是默认值，也就是现在的规则。
- **从人物卡读取轨道的上限（#6657）。** 普通轨道的 `max` 可以是数值引用，像资源池的最大值一样按角色在实时状态中解析，并且绝不低于轨道的 `min`。伤势轨道的上限仍然是它的等级数。每个原本从规则定义读取轨道上限的读取方，现在都从角色解析后的轨道读取，包括战斗中的死亡豁免计数以及导演对它的视图。
- **隐藏的和始终显示的。** 普通轨道可以带 `hideWhen`，隐藏的轨道会像隐藏的资源池一样被排除在实时状态之外，所以人物卡命令也无法触及它。伤势轨道不可以：无论人物卡显示什么，掷骰都会读取它的惩罚，战斗都会把它当作生命值读取。`alwaysShow` 会在人物卡块中以默认值印出一条轨道。
- **摘要列表说得更多。** 列表的 `nameColumn` 可以是枚举列（按其值的标签显示），`columns` 会在名称之后印出该行自己最多三列；布尔值在为真时印出其列的标签。
- **伤势轨道命令由 Engine 来教。** 规则集有伤势轨道时，提醒会加上 `op="damage"` 那一行和一行 `Wound tracks:`(从最好的一级到最差的一级，以及伤害种类)，`Tracks:` 那一行现在只列出 `op="track"` 会移动的普通轨道。Gravewatch 自己的指引不再重复这些内容。
- **文档。** 骰池上限的注释现在说明一次掷骰最多可以达到 `pool.max` 的两倍，指南也说明休息只有在 `by` 为负时才会治疗伤势轨道。
- **已验证**：`scripts/regressions/game-ruleset-check-rules.regression.ts`(对 #6651 规则的十三处有意破坏，以及预览骰池的延迟读取，每一处都会被发现) 和 `scripts/regressions/game-ruleset-sheet-extras.regression.ts`(对 #6657 的十一处破坏，每一处都会被发现)，死亡轨道的用例在 combat-core 渠道中。

### 切片 2 确定了什么

Capability API 1.38，对应 #6652。

- **常驻的重掷。** `resolution.reroll` 列出系统免费给予的最多六种重掷，每种是 `{ id, upTo, mode }`，仅限骰池类型。Game Master 用 `reroll="id"` 点名其中一种（不区分大小写，未知的名称会被忽略）；不请求就不会重掷。`upTo` 被限制在骰子面数以下，因为重掷所有点数就永远不会停止，而 `until` 仍会在一次检定达到 Engine 的一百次重掷时停止。只有当它是被掷出的那一种、并且确实重掷了东西时，记录才会写出它的名字（`reroll="id"`）。
- **每次掷骰只重掷一次。** 消耗现在也可以买到 `reroll`，与条目的 `mechanics.check` 重掷并列。两种都适用时，掷覆盖点数更多的那一种；覆盖范围相同时，`until` 优先于 `once`。没有任何系统会对同一批骰子叠加两次重掷。无论一次检定购买多少次，一项消耗只买一次重掷。
- **从人物卡读取消耗上限。** `perCheck` 可以是数值引用，也可以是 `"pool"`，表示检定自己的骰子数：人物卡上为它给出的数值，在伤势、奖励骰或修正值之前计算，所以受伤的角色仍然可以按评级买到相应的数量。它为掷骰的人计算，向下取整，并限制在 `[0, RULESET_POOL_MAX_DICE]` 之内；上限为零时，既买不到也不付出任何东西。最多四项消耗，每个资源池仍然只有一项。
- **从人物卡读取修正值。** `resolution.adjust`(最多八项，两种类型都适用) 会把人物卡上的一个值，加到每个使用其 `abilities` 之一掷骰的检定上，或者加到每个不使用这些属性的检定上：通过自身属性或 `with=` 掷骰的技能或豁免、属性检定，或者包含该属性的两两组合。它加在伤势惩罚所在的位置（骰池上是骰子，下限相同；求和上是修正值中的固定数值），记录会写下它（`adjust="-2"`）并读回，骰子卡片会说明它，而且只有当 Game Master 写的求和记录的修正值包含它时，那条记录才会被认可。陌生人得不到它。
- **提醒**只在规则集有重掷时，才提供带每个 ID 及其点数的 `reroll=`；消耗那一行会说明它买到的重掷以及它的上限如何设定（“up to as many times per check as the check has dice”、“as the sheet's Nerve”）。
- **示例。** Gravewatch 的 `careful` 重掷（六点或以下，一次）；Ember Roads 的 `burden` 字段，由一个派生值变为负数，并从每次 Brawn 掷骰中扣除。
- **已验证**：`scripts/regressions/game-ruleset-rerolls-spends.regression.ts`：报告自己的数字通过掷骰器验证，每条规则通过结算器验证，还有分支、预览骰池的请求和真实端点、提醒、每一种拒绝以及 1.38 门槛；二十七处有意的破坏，每一处都会被发现。

### 切片 3 确定了什么

Capability API 1.39，对应 #6653。

- **实时读取。** 两个新的数值引用键：`liveTrack`(带 `read`：`value`、`filled`、`remaining`，或者伤势轨道上的 `penalty`) 和 `livePool`(剩余的量，绝不是列表行的资源池)。**有意与问题使用不同的名称：** 问题提议的是 `{ "track": … }` 和 `{ "pool": … }`，但战斗块已经把完全相同的结构用于它的生命值和能量，所以安装门槛和读取方都无法区分它们；“live”也说明了为什么最大值不能使用它们。隐藏的资源池或轨道读作 0。
- **它们不能用在哪里。** 任何在实时状态存在之前就要计算的东西：资源池或轨道的最大值、熟练加值、目录的缩放列或缩放。直接使用、通过派生值使用（可传递，只需一遍就能找到，因为派生值只读取排在它们前面的值）以及通过被实时值限制上限的技能或豁免使用，都会被拒绝。
- **求值。** `evaluateRulesetSheet(definition, build, live?)` 以结构类型接收已解析的实时状态，所以 sheet-math 永远不导入 live-state(live-state 会导入它)。没有实时状态时，实时读取为 0，这只在格式拒绝它们的地方才是正确的。live-state 中的 `evaluateRulesetSheetLive(definition, build,
stored?)` 会先解析实时状态（它的最大值无法反过来读取实时状态），检定上下文、Game Master 的人物卡块、游戏的人物卡界面、战斗中的参战者和编辑器都使用它；什么都没有存储时，它读取声明的默认值。求值后的人物卡携带实时数值，所以之后针对它解析的引用（`adjust`、消耗的 `perCheck`、战斗的防御）读到的是同一个快照。
- **上限。** 技能或豁免上的 `cap`；`skillMods`/`saveMods` 保存限制后的数值，`skillCaps`/`saveCaps` 保留未限制的数值，所以 `with=` 替换会从未限制的数值出发，然后再次限制。上限不读取任何技能或豁免，它所读取的值之前的任何派生值也不读取（这是熟练加值的规则），这样求值只需从上到下一遍。
- **列表求和。** `listSum: { list, column, onlyWhen? }`，对布尔值标记的行求某个数字列的和；空单元格取该列的默认值，隐藏的列表不加任何东西。它只读取构建数据，所以最大值可以读取它。目录的缩放列不可以，无论直接还是通过任何东西间接读取都不行：列表可能包含同一次重新计算会改写的缩放单元格，而目录文件是逐个检查的，所以没有更窄的规则能看到它们之间的每一个循环。
- **更宽的 hideWhen。** `equals`、`notEquals`、`in` 三者恰好取一，每个值都对照字段检查；层不能移除其中任何一个用来比较的值。
- **示例。** Ember Roads 的 Burden 现在是打包装备的体积（`listSum`），它的 Brawn 修正值是基于此的阶梯表；Gravewatch 把 Soothe 的上限设为剩余的 Resolve，从实时轨道显示“Harm still to take”，并用 `notEquals` 把灯油限定在守夜时使用。
- **已验证**：`scripts/regressions/game-ruleset-sheet-reads.regression.ts`：每一种拒绝，每种读取在默认值下和游戏中的表现，有替换和没有替换时的上限，列表求和，三种比较，检定上下文，战斗，提醒，以及 1.39 门槛（包括目录文件）；四十处有意的破坏，每一处都会被发现。

### 切片 4 确定了什么

Capability API 1.40，对应 #6654。

- **格子轨道。** 伤势轨道由 `kinds` 加上 `levels` 或 `boxes` 中恰好一项构成。**有意与问题描述不同：** 问题把数量放在 `boxes.count` 中，但轨道已经在 `max` 中说明了自己的长度，而且自 1.37 起，它可以是人物卡按角色计算出来的值（自 1.39 起绝不会是实时值），所以数量就是 `max`，`boxes` 只携带惩罚表。格子有编号（人物卡上显示“Box N”；Game Master 的那一行会说明标记了多少格），上限为 64，生效的惩罚总是按已填或剩余的格数查表得到，没有任何标记时也是如此。
- **按角色区分的等级。** 解析后的伤势带有这个角色的等级（具名的等级加上 `extra` 增加的等级，或者格子），所以每个原本从规则定义读取长度的读取方（战斗生命值、桥接、人物卡块、人物卡界面）现在都读取解析后的轨道。惩罚读取方会接收构建数据。
- **按格填写和拒绝。** `fill: "indexed"` 按位置存储标记（标记之间的空格子记为 ""），并把标记放在 `box=` 指定的格子上，或者放在它上方下一个空格子上；`onFull: "refuse"`(与 indexed 一起使用时必须提供) 在任何一个标记无法放下时拒绝整条命令，原因是新的 `no-box`。解析后的伤势新增 `filled`、`lowest`、`numbered`、`indexed` 和 `refusesWhenFull`，每个读取 `marks.length` 的地方都改为读取 `filled`。伤害命令新增 `box`，而不是给 `amount` 赋予第二层含义，所以桥接和人物卡的 Mark 按钮仍然表示“这么多个标记”。
- **战斗。** 在编号轨道上，`per-point` 伤害就是它落到的那一格，`per-blow` 则瞄准第一格。没有任何格子能承受的一击会让站着的参战者倒下：在使用这种轨道的系统中，这就是被打出局，没有这一条，这样的战斗永远不会结束。
- **按种类治疗。** 指定了轨道所具有的种类的负数 `damage` 只清除该种类，先清除溢出部分；不指定种类（或指定了轨道没有的种类）时，仍然先清除最轻的。休息步骤可以指定 `kind`。战斗和桥接不指定种类进行治疗，因为它们的治疗针对任何伤害，而以前每次治疗都带着默认种类。
- **额外等级。** 等级轨道上的 `extra: { list, countColumn, penaltyColumn }`；每一行（最多 16 个等级）放在最后一个至少同样好的等级之后，惩罚相同时以那个等级命名。轨道缩短后超出范围的标记会作为溢出保留，而不是被丢弃。
- **示例。** Gravewatch 的伤疤会给 Harm 增加等级，“Catch your breath”只清除 knocks；Ember Roads 的 Strain 是一条按格填写、满了就拒绝的格子轨道。
- **已验证**：`scripts/regressions/game-ruleset-wound-boxes.regression.ts`(三十四处有意的破坏，每一处都会被发现)，以及 `e2e/ruleset-wound-sheet.e2e.ts` 中针对人物卡界面上格子轨道的浏览器用例。

### 切片 5 确定了什么

Capability API 1.41，对应 #6655。

- **属性、技能和豁免的分节。** 与字段原有的可选 `section` 相同，对照 `sheet.sections` 检查。一个共享的辅助函数 `rulesetSectionGroups` 按人物卡的分节为它们排序，把没有分节的放在最后、不加标题；没有任何东西指定分节时，它返回一个普通的组，所以对于所有不带分节的文件，Game Master 的人物卡块（属性行和 `Trained:` 行，现在写作“Heading: a, b; Heading: c”）、人物卡编辑器和游戏的人物卡界面读起来与以前完全一样。
- **未受训练规则。** 技能、豁免或分节上的 `untrained`(条目自己的优先)，在条目处于第一个熟练档位时适用。**有意与问题使用不同的名称：** 问题中的 `{ "dice": -3 }` 在求和规则集上是一个固定数量，所以键是 `by`，这也是休息和轨道命令已经在用的词。`by` 会加到人物卡自己的数值中（在上限之前），所以人物卡会显示它，每个检定和认可都会读取它。`harder` 会在读取阶梯、标签和默认值之后，给骰池的单颗骰子目标值加一（掷骰器会对它进行限制）；在求和规则集上，或者目标值无法移动时，它会在导入时被拒绝。`refuse` 会在掷骰中抛出 `SkillCheckUntrainedError`；内容结算器会先检查，并以 `reason="untrained"` 把请求写回，端点返回 400 `skill_check_untrained`，分支则两半都不保留，并写入同样的记录。标签会读取 `reason`，客户端的回退和端点的记录替换会跳过带有它的标签，所以之后不会有任何东西去掷一个被拒绝的检定。共享的 `isEngineRollableSkillCheckTag` 不会读取它：通用的骰子处理在结算器之后运行，会把不可掷骰的技能检定当作外来的骰子，从而把已经确定的请求改写掉，丢失它的原因。拒绝在结算器循环中最先处理，排在认可审核、可掷骰检查和难度读取之前，所以 Game Master 写的任何记录、骰子或难度都无法让被拒绝的检定通过，而 Game Master 自己写的原因也不能阻止掷骰：Engine 会重新判定。叙述日志会说明这次检定没有进行，人物卡编辑器会为它显示一个短横线。陌生人（没有人物卡）没有这条规则。
- **提醒。** 一行 `Untrained checks:`，按分节或条目列出每条规则，只有在有内容被拒绝时才附上说明原因的句子。
- **示例。** Gravewatch 把它的技能分成 Labour(未受训练时 -1 颗骰子)、The watch 和 Company，拒绝未受训练的 Dig，并让未受训练的 Listen 更难；Ember Roads 未受训练的 Tinker 为 -2。
- **已验证**：`scripts/regressions/game-ruleset-sections.regression.ts`(二十五处有意的破坏，每一处都会被发现)，以及针对编辑器和游戏人物卡的 `e2e/ruleset-sheet-sections.e2e.ts`。

### 切片 6 确定了什么

Capability API 1.42，对应 #6656。

- **实时状态。** `sheet.live.states`：最多十二个，每个有两到四十个 `values`(遵循标签规则，并且绝不包含双引号，因为命令会给它们加引号)、可选的 `valueLabels`、一个 `default`(否则取第一个值) 和 `hideWhen`。只有偏离默认值时，才会以稀疏形式存储在实时数据块新的 `states` 记录中；状态已经不再提供的存储值读作默认值，隐藏的状态则完全不进入解析后的实时状态。
- **命令。** `[sheet: op="state" state="State" value="Value"]`，状态按 ID 或标签指定，值按其本身或标签指定，会以 `unknown-state` 或 `unknown-value` 被拒绝。在这个操作上，标签的 `state=` 指定状态；在状态效果上，它仍然表示开或关；由操作决定含义。人物卡块总会说明每个状态的值（形态是每回合都成立的事实，而处于默认值的轨道则不是），只有规则集有实时状态时，提醒才会加上这条命令以及一行列出每个值的 `States:`。游戏的人物卡界面为每个状态显示一个选择框。
- **跟随变化的数值。** 派生值 `enumTable`：`from` 恰好指定 `field`(一个枚举字段) 或 `liveState` 之一，`table` 为每个值给出一个数字（一到四十项，每一项都必须是那个字段或状态能取的值），`default` 用于其余的值。**有意与问题使用不同的名称：** 问题中的 `{ "state": … }` 改为 `{ "liveState": … }`，因为每一个对实时状态的读取都以 `live` 命名，作者和导入就是靠这一点分辨最大值不能使用什么。字段的表只读取构建数据，可以用于最大值；状态的表是一个实时读取方，适用切片 3 加入的可传递拒绝。它通过切片 2 的 `adjust` 作用到骰子上，限于某一种属性。带层的定义不会重新检查字段表的各行，因为层可能会移除表中有对应行的值。
- **休息。** 恢复步骤可以指定一个 `state`，`to` 为 `"default"` 或它的某个值（绝不能用 `by`）；其他步骤上的 `to` 仍然是 `"max"`、`"min"` 或一个数字。
- **示例。** Ember Roads 的 Stance(Guarded、Steady、Reckless) 会给 Brawn 掷骰加 -1 或 +2，扎营时会把它恢复；Gravewatch 的 Light(Lit、Shuttered、Out) 会让 Nerve 少一或两颗骰子，守夜会重新点亮它，而通过 `watch` 字段上的一张表，值黎明班的守望者会多一点 Resolve。
- **一并处理：#6678。** 战斗选择器的靠近动作按直线来衡量“更近”，所以分别站在一道无法通行的地形墙两侧的两名战士（相隔两格，绕路却很远）都会永远站着不动，这就是有位置的 Ember Roads 浏览器用例偶尔无果而终的原因。现在它按行走距离来衡量，即共享网格模块中的 `rulesetWalkingDistances`(与行走时支付的步数、地形消耗和拐角规则相同)，触及范围和射程仍然按直线计算。在这个用例的 2000 个种子中，现在每场战斗都会在七个回合内结束，而以前大约每七十五场就有一场停滞。
- **已验证**：`scripts/regressions/game-ruleset-live-states.regression.ts`(三十一处有意的破坏，每一处都会被发现)、`scripts/regressions/ruleset-combat-director.regression.ts` 中一道手绘的山脊（没有这个修复时会站着不动 200 轮），以及针对选择器和游戏人物卡上休息的 `e2e/ruleset-live-states.e2e.ts`。

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

软件包在 `contributions.assets.paths` 中列出 `ruleset.json`，并在 `files[]` 中用哈希固定它。与 `gm-verbs.json` 一样，通过这个保留文件名发现它。Engine 在读取前就拒绝声明大小超过 512 KB 的文件（1.340 之前为 256 KB），用严格的共享 zod schema 验证，若无法使用则记录一行日志并丢弃。没有这个衔接点，规则集软件包就毫无用处，因此它声明 1.20，让旧版 Engine 明确拒绝安装。

顶层结构(参见草稿文件)：`id`、`version`、`name`、`edition`、`license`、`coverage`、`resolution`、`sheet`、`rests`、`gm`。

### 结算类型

`resolution.kind` 是可辨识联合。已实现两种类型：

- **`dice-sum`**(切片 2)：投掷规则集的骰子(默认 1d20)，加上属性调整值、熟练等级加值和人物卡上的任意自由加值，达到或超过 DC。支持优势和劣势，以及按投掷类型配置的单枚骰子极端点数策略。`5e-2014` 的检定和豁免使用 `none`，这是与 `engine-legacy` 的刻意差异。第一版草稿将此类型称为 `d20-sum`；后来将骰子改为参数，使 2d6 加属性的系统不必另设一种类型。
- **`dice-pool`**(切片 7b)：投掷人物卡自身指定数量的骰子，统计达到目标点数的骰子，支持可选的双倍成功点数、爆骰点数、抵消点数、大失败、非凡成功和情境骰。使用同一张人物卡：`dice-sum` 中加到投掷结果上的值，在这里就是骰子数量(§ 切片 7b 确定了什么)。

两种类型共享的人物卡计算(`abilityModifier`、`proficiency`、`proficiencyTiers`)只声明一次，再展开到各成员中，因此交叉检查会对每种类型运行，第三种类型也不能为同一个数值另生一套规则。

解析器保留当前服务文档列出的所有不变量：绝不抛出异常，无法进行的投掷会以稀疏字段重写标签，GM 编造的数值会被替换，**Logs**(日志)中的记录由 Engine 写入。

### 人物卡 schema 基本元素

这是一个封闭集合：`abilities`、`skills` 和 `saves`(每项都可以选择指定对应属性)、有类型的 `fields`(`number`、`text`、`longtext`、`boolean`、`enum`、`dice`)、`derived` 值(对值引用应用封闭运算集 `sum`、`stepTable`、`scale`、`min`、`max`)、带 `maxItems` 的有类型列 `lists`，以及 `live` 状态(`pools`、`tracks`、`text`、`conditions`)。值引用是一个对象，必须且只能包含 `const`、`field`、`derived`、`abilityScore`、`abilityMod`、`abilityModFromField`、`skillMod`、`saveMod` 中的一项；不存在表达式字符串。编辑器和游戏内人物卡据此通用渲染，不需要软件包客户端代码，也不需要编辑器插槽。

装备刻意不作为列表：Game Mode 已经负责物品栏。人物卡携带 `attacks` 和手动输入的 `ac`。

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

v1 刻意不包括：职业和子职业表（法术位上限与 HP 采用输入值，而非派生）、兼职法术位计算、结构化法术汇编、由护甲派生的 AC、自动升级、敌人和 NPC 人物卡、攻击检定和重击（战斗适配器）、工具检定。其中大部分后来都实现了：5e 包借助 Multiclass Spellcaster 表，按每个职业的等级算出法术位上限（0.18.0，基于 `sheet.migrations` 和 Capability API 1.77 的共享休息步骤），根据穿戴的装备派生 Armor Class，附带法术和生物目录，并按它自己的战斗块作战；HP 和升级仍然手动输入。

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
- 人物卡按其规则集当前 schema 宽松读取：保留未知字段，缺失字段采用默认值，超出范围的值在编辑时限幅，绝不在读取时限幅。把数值移到新 ID 的布局要声明 `sheet.migrations`(Capability API 1.77，C6e-0)，在读取时应用：构建由 `readRulesetSheetEnvelope` 处理（以存储的 `v` 为门槛，每一步都复制，并通过 `rulesetSheetStamp` 让戳记绝不低于存储的 `v`），实时状态则在唯一的存储实时状态读取器（`readStoredLiveState`）中处理，读取方和写入方共用这个读取器。
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

每个切片对应一个面向 `staging` 的 PR，在工作开始时打开草稿 PR，并包含本地化文案、文档、一个 `[docs-i18n]` 后续事项，以及未勾选的手动验证复选框。验证文件采用 `*.regression.ts`；不在代码树中保留 `.test.ts`。

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
