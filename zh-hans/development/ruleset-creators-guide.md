# 规则集创作者指南

在打开参考页面之前，可以先用本页规划如何把自己的桌面系统做成 Game Mode(游戏模式) 规则集。本页说明规则集的各部分如何配合、哪些选择最重要，以及我们在转换 16 套差异很大的系统时学到了什么。逐键说明的参考文档从[编写 Game Mode 规则集](../extending/writing-rulesets.md)开始，下面每一节也都链接到它所概述的页面。

规则集是一个 JSON 文件（或一组文件组成的包），告诉 Marinara Engine 你的系统如何运作。随后 Engine 会掷出每次检定、应用人物卡上的每次改动，还能按你的规则运行整场战斗。规则集里没有代码，所以设计规则集就是填写 Engine 已知的机制。Engine 不知道的机制，需要通过功能请求来添加。

下文会为每个键标出引入它的 Capability API 次版本。使用该键的包需要声明这个次版本或更新版本（见[版本管理、测试与发布](#versioning-testing-and-publishing)）。

有两个概念容易混淆：

- **Classic 和 Tactical** 是_战斗样式_：前者是分前后排的菜单战斗，后者是在棋盘上的战斗。无论是否使用规则集，每场游戏都会采用其中一种。
- **Marinara 自身的规则**是没有规则集时游戏采用的规则。规则集会替换这些规则。

## 规则集的组成

规则集是一个最大 512 KB 的 JSON 文件，导入时会整体校验。更大的规则集会把目录拆分到包中。先复制最接近你所用骰子机制的示例：

- [`ember-roads.json`](../examples/rulesets/ember-roads.json)：2d6 加属性。
- [`gravewatch.json`](../examples/rulesets/gravewatch.json)：d10 骰池。
- Marinara-Agents 中完整的 [5e (SRD 5.1) 包](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014)。

用一行 `$schema` 为编辑器指定 [JSON Schema](../extending/ruleset.schema.json)，以获得自动补全和拼写检查。

| 键 | 内容 | 参考 |
| --- | --- | --- |
| `schemaVersion`, `id`, `version`, `name`, `edition`, `license` | 标识信息。`version` 是每次发布修改时都要递增的整数。 | [编写规则集](../extending/writing-rulesets.md) |
| `coverage` | 规则集处理的内容（检定、战斗等），以及设置向导中的一行摘要。 | [编写规则集](../extending/writing-rulesets.md) |
| `resolution` | 如何掷检定：五种类型之一，加上结果档、资源消费和重掷。 | [检定](../extending/ruleset-checks.md) |
| `sheet` | 属性、技能、字段、列表、实时资源池、轨道、状态、伤势轨道、惩罚和迁移。 | [人物卡](../extending/ruleset-sheets.md) |
| `party`, `clocks` | 共享的队伍人物卡（团队、船只、故事点）和进度时钟。 | [人物卡](../extending/ruleset-sheets.md) |
| `rests` | 每种休息恢复和清除什么。 | [人物卡](../extending/ruleset-sheets.md) |
| `gm`, `gmReference` | 游戏主持人（GM）文本、每个角色的摘要、由谁操控对手，以及最多 16,000 个字符的规则参考。 | [人物卡](../extending/ruleset-sheets.md) |
| `catalogs` | 现成的条目（法术、天赋、生物），每个条目都可带一个 `mechanics` 块。 | [目录](../extending/ruleset-catalogs.md)、[机制](../extending/ruleset-mechanics.md)、[构建器](../extending/ruleset-character-builder.md) |
| `items` | 类别、武器、护甲、弹药、战利品、金钱、初始装备和市场。 | [物品](../extending/ruleset-items.md) |
| `battle` | 把人物卡上的数值提供给 Marinara 自身的 Classic 和 Tactical 战斗。 | [战斗](../extending/ruleset-combat.md) |
| `combat` | 按你的规则运行整场战斗，包含生物图鉴、棋盘、反应和对抗。 | [战斗](../extending/ruleset-combat.md) |
| `layers` | 玩家为单局游戏开启的变体（低魔、严冬）。 | [层与翻译](../extending/ruleset-layers-and-translations.md) |

**ID。**规则集 ID 由小写字母、数字和单个连字符组成（`ember-roads`）。人物卡内的 ID 由小写字母、数字和下划线组成，以字母开头（`grit_max`）。发布后要保持 ID 稳定，因为保存的角色、借用其目录的其他规则集和 Experience 叠加层都会引用它们。

**可安全放入提示词的文本。**任何会发送给模型的内容（名称、标签、GM 文本）都只能占一行，不能包含方括号，也不能包含 `{{` 或 `}}`。

**包。**放不进单个文件的规则集以 `<id>.ruleset.json` 发布：一份清单加上 `ruleset.json`、最多 12 个各为 2 MB 的 `catalogs/<id>.json` 文件，以及最多 40 份译文，全部以 base64 存储。不接受 zip 格式。Pixelforge 等规则集编辑器可以生成这个文件。清单声明规则集需要的 Capability API 次版本。

**规则集的归类。**导入的文件归为 `local/<id>`，GitHub 仓库中的规则集归为 `<owner>/<id>`，官方目录中的则保留裸 ID。两位作者可以各自发布名为 `v20` 的规则集而不会冲突。

## 检定、骰子与人物卡

首先要做、也最重要的选择是 `resolution.kind`，因为其他所有内容都会按它来解读。GM 只指定技能和难度。Engine 负责掷骰、根据人物卡计算，并把结果告诉模型，所以绝不要在 GM 文本中要求模型做计算。

| 类型 | 掷骰方式 | 适合的系统 |
| --- | --- | --- |
| `dice-sum` | 掷骰，加上人物卡数值，达到或超过难度。支持自定义骰面、开放式连续掷骰和爆骰。 | d20 游戏、2d6 加属性、Fate(用 −1/0/+1 骰面表示 4dF)、Rolemaster |
| `dice-pool` | 按人物卡上的数量掷骰，数出达到目标的骰子。每次检定的目标都可从人物卡读取，可以要求高于或低于目标。 | World of Darkness、Exalted、类似 Shadowrun 的系统、Lasers & Feelings |
| `dice-highest` | 掷一个骰池，取最高的一颗，或把最高的几颗相加。支持零骰规则和第二组“黑暗”骰。 | Blades in the Dark 和其他 Forged in the Dark 游戏、Trophy Dark |
| `roll-against` | 掷出不超过（或不低于）人物卡数值的结果。 | Call of Cthulhu、GURPS、BRP、老派的 X-in-6 |
| `symbol-pool` | 组建并升级叙事骰，抵消对立符号。 | Genesys 及类似系统 |

再添加系统需要的内容。这些都在[规则集检定](../extending/ruleset-checks.md)中：

- **结果档**（`resolution.outcomes`，1.135）：按差值或总值划分为两到八个带标签的结果，例如成功程度、“付出代价的成功”，或困难成功和极难成功。每档都可带一行说明，告诉 GM 这个结果在实际游玩中意味着什么。在我们转换过的系统中，这是需求最广泛的功能。
- **按自己的方式掷骰的检定**（`resolution.overrides`，1.140）：让少数技能使用不同的骰子，例如在 d20 游戏中让盗贼技能使用 d100、Open Doors 使用 d6。
- **消耗资源来改变掷骰**（`resolution.spend`）以及免费重掷（`resolution.reroll`）：消耗意志力换取成功、幸运、英雄点。`perCheck` 限制一次掷骰能换取多少收益，避免资源池满时能直接买到必然成功。
- **改变掷骰的护符**：在角色选取的目录条目上添加 `mechanics.check`，按该条目自身的费用支付。

**检定尚不能做什么。**对抗骰池（比较双方掷骰结果），以及 OpenD6 那样带狂野骰的求和骰池。这两者都需要在 Engine 内新增一种结算类型。如果系统依赖其中一种，就在 Engine 仓库提交功能请求，并附上几个演算完整的掷骰例子；这些例子会成为测试。

**人物卡**（[规则集人物卡](../extending/ruleset-sheets.md)）包含属性、技能、字段、列表和派生值，以及 Engine 在游玩中会改变的实时状态：

- **资源池**，例如生命值、意志力、元气点或法术位，通过人物卡命令和休息消耗与恢复。
- **轨道**，例如压力、毁灭值或 XP，填满时会触发效果。
- **伤势轨道**，用于以具名等级或编号格子而非单一数值表示的生命状态，并对掷骰施加惩罚。
- **实时状态**，例如形态、架势或灵光，维持期间可以改变掷骰。
- **队伍人物卡与时钟**：团队、船只或共享故事点，以及分为 4、6 或 8 格的进度时钟。

GM 通过 Engine 自动教给它的人物卡命令来修改人物卡，使用的就是你自己的 ID，所以无需在 `gm.sheetGuidance` 中解释这些命令。永久成长（XP、新增点数、升级）使用目录人物卡命令；见[规则集目录](../extending/ruleset-catalogs.md)。

**创建角色。**[角色构建器](../extending/ruleset-character-builder.md)会引导玩家完成你定义的步骤：出身和职业、分值（掷骰、购买或分配）、熟练、法术、装备和初始货币，并检查是否合法，支持共同创建队伍。目录可用 `from`(1.220) 借用另一个已安装规则集的目录，因此 5e 变体可以复用 SRD 的生物和法术，无需复制。

**GM 文本。**`gm.checkGuidance` 和 `gm.sheetGuidance`（各 1,500 个字符）每回合都会发送，所以要写得精简。`gm.worldGuidance` 只在创建世界时读取一次（“没有火药”“魔法很罕见”）。`gmReference` 在稳定的系统提示词中存放最多 16,000 个字符的详细规则。`gm.sheetSummary` 决定模型能看到每个角色的哪些内容，其中所有内容每回合都会消耗 Token。全部用自己的话来写，绝不要复制规则书原文。

## 战斗

规则集可以在三个深度上参与战斗。可以先浅后深，逐步完善。选择哪种深度，取决于战斗规则在多大程度上体现了系统的特色。

| 深度 | 编写什么 | 战斗中会发生什么 | 适合的系统 |
| --- | --- | --- | --- |
| 不参与 | 不写 `battle` 或 `combat` 块。 | Marinara 自身的 Classic 或 Tactical 战斗自行构建参战者。人物卡不变。 | 战斗依靠叙事的系统（Fate、Blades、Trophy） |
| 借出人物卡 | 一个 `battle` 块：生命池、可选的能量池、法术位，最多 8 个技能列表。 | 使用 Marinara 的计算和骰子，但初始生命条比例与人物卡相同，结果会写回人物卡。 | 希望战斗后果能保留下来的轻量系统 |
| 使用自己的规则 | 一个 `combat` 块。 | 每次攻击、豁免和对抗都用你的骰子结算。对手来自生物图鉴或威胁尺度，每笔消耗都会即时写入人物卡。 | 规则细致的战术系统（5e、Pathfinder、Storyteller、Genesys） |

**`combat` 块**为 Engine 内置的三种类型之一提供参数：`attack-vs-defense`（掷骰对抗防御数值）、`dice-pool`（使用你的骰池，统计成功数）或 `symbol-pool`（带资源消费的叙事骰，1.382）。基本内容是 `health`（递减的资源池、标记伤势的轨道，或不断填满的普通轨道，1.383）、`defense`、`initiative`、`attackRoll`、行动 `economy`，以及用作 `attacks` 和 `abilities` 的列表。一个完整的小型块大约 25 行；[规则集战斗](../extending/ruleset-combat.md#combat-a-fight-your-own-rules-resolve)中的 Ember Roads 块就是很好的模板。

在基本内容之外，再添加系统需要的部分：

- **状态**，效果从固定列表中选择（防御、攻击掷骰、豁免、对抗、速度、最大生命值、造成和受到的伤害）。
- **豁免**、专注、濒死规则，以及在**窗口**中等待的反应（条目可以等待 `used`、`aimed`、`hit`、`harmed`、`falls` 或 `turn-start`）。
- **对抗**，用于擒抱、推撞和挣脱。
- **生物**：战斗会读取的生物图鉴目录，包含属性块、行动、感官和施法。**威胁尺度**让 GM 为单场战斗临时创造对手，`combat.threat.budget`(1.803) 则按每种难度的经验预算构建遭遇。
- 目录条目上的**条目机制**：范围形状、持续区域、墙、召唤物、治愈和感官。见[规则集条目机制](../extending/ruleset-mechanics.md)。

**Classic 或 Tactical。**只有 `combat` 声明了 `distance`（`label`、`perCell`），且人物卡或生物提供了移动能力，按你自己的规则运行的战斗才会有棋盘。缺少这些内容时，即使选择 Tactical，游戏仍会在想象中按你的规则战斗。如果规则依赖站位（范围、触及、夹击），就设置 `"styles": ["tactical"]`(1.379)，让使用该规则集的每场游戏都有棋盘。

**生物美术资源**与规则分开：[生物包](../extending/writing-creature-packs.md)（`.creatures.json`，用 Pixelforge 制作最方便）通过匹配生物 ID，在 Tactical 棋盘上绘制生物图鉴中的生物。没有美术资源的生物仍以标记表示。

**已知限制**列在[尚未支持](../extending/ruleset-combat.md#not-yet)中。转换时最常遇到的是对抗防御掷骰（Dodge 和 Fight Back、Parry 和 Block）、命中部位、阵营先攻，以及对反应作出反应。这些由 GM 在 Engine 的战斗之外通过叙事处理。

## 战斗 AI：心智、性格与由谁操控对手

Engine 操控所有无人控制的对手和 AI 同伴，每回合无需调用模型。它不依赖特定规则集：除了 5e，我们也在 Storyteller、Exalted、老派系统、Call of Cthulhu、GURPS 和 Genesys 的转换版本上做过测试。即使没有下列任何键，它也能工作；这些键让生物的战斗方式更符合自身特点。所有键都在[规则集条目机制](../extending/ruleset-mechanics.md)中，设计说明见 [Game Mode 战斗 AI](game-combat-ai.md)。

| 键 | 控制什么 | API |
| --- | --- | --- |
| 生物上的 `mind`，或按某项属性划分档位的 `combat.minds` | 思考程度：`mindless`、`instinct`、`cunning`、`tactical`、`genius`。野兽默认使用本能，构装体和软泥怪默认无心智。 | 1.761 |
| `behavior.temperament` | 战斗方式：reckless、cautious、opportunistic、protective、supportive、disciplined、cowardly、patient、methodical、coordinated。 | 1.763 |
| 仅由故事指定的性格 | `fanatical`（从不溃逃）、`arrogant`（保留实力，拥有传奇能力且处于劣势时飞上天空）、`territorial`、`cruel`、`honourable`（向队伍提供 Surrender(投降)）、`hungry`（拖走猎物）。从不随机分配。 | 1.778 到 1.784 |
| `behavior.role` | bruiser、bulwark、skirmisher、marksman、spellcaster、supporter、controller、`solo`(1.776)。未指定时按其能力分配。 | 1.763 |
| `behavior.targets`, `opens`, `pack`, `ambush` | 目标优先级、开场动作、群体战术和隐藏待伏。 | 1.763 |
| `behavior.shifts` | 在重伤、盟友倒下、首领倒下或走投无路时转变的性格。 | 1.779 |
| `combat.morale` | 敌人何时、如何检定勇气（2d6 掷出低于某个分值的结果，或进行豁免），以及谁会投降。 | 1.762, 1.775 |
| `gm.opposition: "game-master"` | GM 从 Engine 的合法选项中选择，操控每个对手，Engine 作为后备。 | 1.774 |

`behavior` 可以放在整个 `combat` 块、生物类型或单个属性块上，后者依次覆盖前者。SRD 中的例子：狼 `{"targets": ["wounded"], "pack": true}`、地精 `{"temperament": "cowardly", "targets": ["weakest"]}`、食尸鬼 `{"ambush": true}`。

**棋盘战斗中的 AI 需要** `combat.distance`、移动能力（`combat.economy.movement` 或生物的 `speed`）、远程攻击和武器条目上的 `range`，以及任何范围效果上的 `area`。没有射程，手枪就只能在近身距离使用。没有范围，AI 就永远不会分散站位。

**叙事系统。**默认由 Engine 操控普通敌人，GM 操控首领。对于通过叙事而非伤害来处理对抗的系统（Fate、Blades、Trophy、Lasers & Feelings），`gm.opposition: "game-master"` 让模型按每个对手的角色特点来操控它。只有玩家在设置时开启了“GM directs bosses”(GM 指挥首领) 才会生效，因为这代表玩家同意在战斗中调用模型。

**没有战斗块时**，Classic 和 Tactical 战斗中仍然有士气：每个非首领、非无心智的敌人都会按心智和性格获得一个 2 到 12 的分值，能够思考的敌人可能投降。遭遇的编写者可以标记一方的 `leader`。

**队伍性格。**游戏开始时，每个队员都会根据其 Description(描述) 获得一种性格，之后只会在会话结束回顾时因故事原因而改变。AI 同伴按此性格战斗。规则集不设置性格，但 GM 文本可以利用它。

## 层、叠加层与迁移

有三种机制可以在不另建分支的情况下修改规则集。玩家选择的变体使用层，属于某次冒险的内容使用叠加层，改变人物卡结构时使用迁移。

**层**（`layers`，最多 12 个）是 New Game(新游戏) 设置向导中的开关，在该局游戏的整个生命周期内固定不变。层只能缩小范围或添加文本，不能添加规则：

- 追加 GM 指引（`gm.guidance`、`gm.worldGuidance`；每层 4,000 个字符）；
- 从枚举字段中移除值、替换难度阶梯，或通过声明的过滤器隐藏目录条目；
- 移除货币（1.64）、移除市场卖家、把物品标为不出售，或替换战利品表（1.813）；
- 用 `conflicts` 声明与其他层的冲突。

层不能添加字段、值、技能、资源池、休息、卖家或战利品表，不能改变结算类型，也不能修改战斗数值。角色会保留层所移除的任何东西。SRD 的 **Low magic**(低魔) 层就是很好的范例：法术最高 5 级、高于非普通稀有度的物品更罕见且通常不出售、高魔生物不会进入随机遭遇，世界指引则要求 GM 解释魔法为何罕见。其他作者可以复制它。目前尚不支持为别人的规则集编写层。

**叠加层**(1.355) 让 Experience 的地图包在该 Experience 启用期间，为规则集添加生物、状态、人物卡状态、物品和轨道（1.367）。把冒险专用的怪物和战利品放在叠加层中，不要放进基础规则集。若叠加层复用了已有 ID，或与规则集不兼容，整个叠加层都会被丢弃，这也是保持 ID 稳定的另一个原因。参考：[规则集叠加层](optional-agent-packages.md#capability-api-1355-ruleset-overlays)。

**迁移**（`sheet.migrations`，1.77）说明重命名字段、把单一等级拆成各职业等级，或拆分资源池时，已保存的角色如何转移数据。添加内容无需迁移；人物卡结构改变时，提高 `sheet.version`。参考：[层、翻译与迁移](../extending/ruleset-layers-and-translations.md)。

## 翻译

用英文编写规则集，其他每种语言各自以独立译文文件发布（1.811）。翻译只影响显示：规则、人物卡命令和发给 GM 的所有内容都保持英文，所以翻译绝不会破坏游戏。

译文以逐字一致的英文字符串为键：

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

- 语言代码与 Engine 自身一致（`ru`、`pt-BR`、`zh-Hans`）。字符串缺失或为空时显示英文，`pt-BR` 会先回退到 `pt`。
- **在共享的包文件中**，把译文放在 `locales/<language>.json`，最多 40 份，每份 8 MB。导入时只保留 Engine 当前语言的译文；要切换语言，先改语言，再重新导入。
- **在官方目录中**，每种语言都是一个独立的包，名为 `<id>-<version>.<language>.json`，列在目录条目的 `locales` 下，包含其 URL、sha256、大小，以及翻译后的商店名称和描述。Engine 只下载当前语言的包，语言改变时再替换。把 SRD 的全部 11 种语言放在单个文件里，会让下载量从 7 MB 增至 34 MB，因此各语言包分开提供。
- 修正译文不需要新的 `version`。

SRD 包以这种方式提供 11 种语言，是可以照着做的范例。参考：[翻译](../extending/ruleset-layers-and-translations.md#translations)。

## 5e (SRD 5.1) 包：完整规模的示例

Marinara-Agents 中的 [ruleset-5e-2014 包](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014)几乎使用了本页的所有功能，想看某个键的实际用法时可以参考它。值得借鉴的部分：

- **布局**：`ruleset.json` 加上 `catalogs/` 下每个目录各自的文件（生物、法术、魔法物品等），构建成一个 `.ruleset.json` 包。它的 README 和 MODELING.md 解释了每条规则如何建模。
- **授权许可**：`license` 下的 CC BY 4.0 署名、一行“无隶属关系”声明，以及任何地方都不使用受商标保护的产品名称。
- **完整战斗**：一个 d20 `attack-vs-defense` 块，包含动作、附赠动作和反应额度、专注、Shield 和 Counterspell 等反应、棋盘、带心智和性格的完整生物图鉴，以及遭遇预算。
- **构建器**：种族、职业、掷骰或购买分值、熟练、法术和初始装备。
- **一个层**（低魔）和作为按需包提供的 **11 份译文**。
- **稳定的 ID**：其他规则集会借用其生物和法术，所以它的 ID 从不改变。
- **回归测试**在每次修改时作为独立的 CI 任务运行。

如果你的系统是 d20 变体，可以考虑用 `from`(1.220) 借用它的目录，无需复制。

## 设计类似系统：转换带来的经验

我们把社区合集中的 16 套系统转换成了这种格式，从规则轻量的叙事游戏到 Rolemaster 都有。最重要的经验是：这里的规则集会强制执行，而非仅供参考。Engine 会掷出每次检定、应用人物卡上的每次改动，因此凡是留给“GM 会处理”的内容，实际上都没有处理。尽早决定哪些由 Engine 负责，哪些由 GM 叙述。

| 系统类别 | 示例 | 结算 | 实现所需的关键功能 | 留给 GM 的内容 |
| --- | --- | --- | --- | --- |
| 规则繁复的 d20 和 d% 系统 | 5e、Pathfinder 2e、Rolemaster | `dice-sum` | 用结果档表示成功程度；Rolemaster 使用 `openEnded` 和 `unmodified`；大型表格放在 `gmReference` 中。 | Pathfinder 中不叠加的加值类型；Rolemaster 中超出结果档的重击表。 |
| 老派系统 | OSE | `dice-sum` | 用 `resolution.overrides` 处理盗贼技能（d100）和 X-in-6(d6)；2d6 士气。 | 阵营先攻（按个人先攻运行）。 |
| 掷低系统 | Call of Cthulhu 7e、GURPS Lite | `roll-against` | `against`、奖励和惩罚 `tens` 骰、暴击骰面、困难和极难结果档。 | Dodge、Fight Back、Parry 对抗；GURPS 命中部位。 |
| Storyteller 骰池 | V20、W20、Exalted 3e、Exalted WoD | `dice-pool` | 带惩罚的伤势轨道、实时状态（形态、灵光）、让 1 点不抵消成功的覆盖规则、基于骰池的 `combat` 块。 | 未写成条目的范围 Disciplines 和 Gifts。 |
| Forged in the Dark | Blades in the Dark、Trophy Dark | `dice-highest` | `keep`、`zeroDice`、一组 `dark` 骰、结果档（6 / 4 到 5 / 1 到 3）、带 `onFull` 的轨道、时钟、用于团队的队伍人物卡。 | 通过 `gm.opposition: "game-master"` 处理战斗。 |
| 架势骰池 | Lasers & Feelings、一款原创游戏 | `dice-pool` | 从人物卡读取的 `target`、`stances`（掷低或掷高）、表示恰好相等的 `exact`、用于船只的队伍人物卡。 | 用叙事处理战斗。 |
| Fate | Fate Core | `dice-sum` | 4dF 自定义骰面、用于平局和出色成功的结果档。 | 用故事处理援引和强迫；用叙事处理战斗。 |
| 叙事骰 | Genesys | `symbol-pool` | `combat.kind: "symbol-pool"` 配合 `symbols.spends`、吸收值，以及用不断填满的 Wounds 轨道表示生命状态。 | 战斗外检定的资源消费。 |

**这些转换带来的实用建议：**

1. **先从骰子开始，再做人物卡，最后写 GM 文本。**先让一次检定正确掷出，再添加目录或战斗。
2. **系统哪里有结果档，就在哪里使用。**每档的 `text` 告诉模型实际游玩中会发生什么，而这正是叙事系统的核心。
3. **没有战斗块，也好过只有一半正确的战斗块。**叙事系统使用 Marinara 自身的战斗（或由 GM 操控对手），会比用只实现了一半规则的战斗块玩得更好。
4. **如果编写战斗块，就补齐棋盘基础内容**：`distance`、移动能力、远程武器的射程，以及至少一种范围攻击。我们用 AI 测试的每个转换版本都缺少其中一些内容，导致战斗停滞，或始终不利用站位。
5. **按距离比例检查移动能力。**每格 2 米时，速度为 2 的生物爬不上山坡，战斗因而停滞。
6. **记下来源。**为每个规则集保留一份笔记文件，列出每条原规则及其转换方式，尤其是对相互冲突的解读所作的取舍。这是审核者首先会要的东西。
7. **Engine 确实缺少某种机制时**，在 `gmReference` 中把它交给 GM，并附上演算完整的例子提交功能请求。本页许多功能（结果档、`dice-highest`、`roll-against`、符号骰战斗、时钟、队伍人物卡）都是因为转换时提出了需求才有的。

<a id="versioning-testing-and-publishing"></a>

## 版本管理、测试与发布

**有两个重要的版本号。**规则集的 `version` 是整数，每次发布修改都要提高。已安装的版本永远不会被重写，每场游戏都始终绑定创建时的确切版本，因此进行中的战役不会改变计算方式。**Capability API** 版本说明文件需要哪些 Engine 功能。包的清单声明 `schemaVersion: 2` 和 `capabilityApi: { "major": 1, "minor": N }`，其中 N 是所用键中最高的次版本，因此旧版 Engine 永远不会收到你的规则集。官方目录中的规则集至少需要 1.374。直接导入的普通文件无需声明，因为读取它的 Engine 会校验它。

**起草循环。**编辑、提高 `version`、导入、开始新游戏。同一版本却包含不同内容的导入会被拒绝。旧版本会一直保留，直到移除规则集。人物卡结构改变时提高 `sheet.version`，值需要转移时编写迁移。

**测试。**

- 使用 `$schema` 行，让编辑器在编写时发现拼写和类型错误。
- 导入：开启 **Settings → Advanced → Danger Zone → Allow custom Agent imports**(设置 → 高级 → 危险区域 → 允许导入自定义智能体)，再使用 **Agents → Import agents → Game Mode ruleset**(智能体 → 导入智能体 → Game Mode 规则集)。审核会在保存任何内容之前列出每个问题及其路径，包括没有对应对象的名称。
- 对声明的每种检定都在游戏中尝试几次，包括覆盖规则、资源消费和每个结果档。日志会显示实际计算过程。
- 如果有 `combat` 块，就带上 AI 同伴，在 Classic 和 Tactical 中分别与各类心智的生物战斗。留意停滞（谁也够不到谁）、范围误伤友方，以及始终不用最佳动作的敌人。
- 逐一开启和关闭各个层；如果提供译文，也要切换 Engine 的语言。
- 如果有 Experience 为规则集添加叠加层，`POST /api/game/experience/check` 会报告不兼容的内容。
- 找一位不了解该系统的试玩者，用构建器创建角色。

**发布。**有五种途径，按从简单到复杂排列（详情见[分享你的规则集](../extending/writing-rulesets.md#sharing-your-ruleset)）：

1. 发送 `.json` 文件。
2. 发送 `.ruleset.json` 包，内含目录和译文。
3. 把它放在公开 GitHub 仓库的 `rulesets/` 下（最多 32 个文件）。用户把仓库添加为自定义来源，它会归在你的 GitHub 名下。
4. 按 `ruleset-5e-2014` 的布局，向 [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 提交拉取请求，提议加入官方目录。这适用于游玩广泛、授权清晰的系统。
5. 发布一个 Experience，通过其地图包为规则集叠加冒险内容。

**授权许可。**只发布有权分享的规则文本。许多系统有采用开放许可的参考文档；把它的 SPDX ID 和要求的署名放在 `license` 下。规则集主要需要的是名称和数值，所以所有 GM 文本都要用自己的话来写。

### 分享之前

- [ ] ID 已定稿，并符合 ID 规则。
- [ ] `license` 包含 SPDX ID 和署名，未在未经许可的情况下使用受商标保护的名称。
- [ ] 每种检定、覆盖规则、资源消费和结果档都至少在游戏中掷过一次。
- [ ] `gm.checkGuidance` 和 `gm.sheetGuidance` 简短、从不要求模型做计算，并且用自己的话编写。
- [ ] 已在规则集允许的每种样式中试过战斗，或用 `combat.styles` 限定了样式。
- [ ] 包清单声明了正确的 Capability API 次版本。
- [ ] `version` 高于他人手中上一份文件的版本。
- [ ] 笔记文件解释了每条原规则如何转换。

## 相关指南

- [编写 Game Mode 规则集](../extending/writing-rulesets.md)
- [Game Mode 架构](game-mode-architecture.md)，用于修改 Engine 的规则代码
- [Game Mode 战斗 AI](game-combat-ai.md)
- [使用规则集游玩](../game/rulesets.md)
