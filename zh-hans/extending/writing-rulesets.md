# 编写 Game Mode 规则集

规则集告诉 Game Mode 桌面系统如何运作：检定掷什么骰子、人物卡有哪些内容、消耗哪些资源，以及休息恢复什么。本指南面向希望自行编写并分享规则集的人。若要游玩别人制作的规则集，请先阅读[选择规则](../game/getting-started.md#choosing-rules)。

规则集是一个 JSON 文件，是数据而非代码，其中没有任何内容会运行，因此导入不会在你的电脑上执行任何操作。导入他人的文件前，值得仔细阅读的部分是 Game Master 文本，因为每场使用该规则集的游戏都会将它发送给模型。

## 先读这里：规则集能做什么、不能做什么

规则集只能填写 Engine 已理解机制中的空项。当前 Engine 有两种检定结算方式，文件通过 `resolution.kind` 选择：

- **`dice-sum`**：掷骰，加上人物卡数值，达到或超过难度。适用于 d20、2d6 加属性等许多系统。
- **`dice-pool`**：掷出角色数值对应数量的骰子，数出达到目标的骰子。适用于评级代表一把骰子而非加值的系统。

两者都在[结算类型](#resolution-kinds)中完整说明。

不符合两种形式的机制无法写进规则集文件，例如取骰池最高骰、掷低于目标的百分骰检定、符号骰或对抗骰池。每种都需要 Engine 内新增结算类型，也就是带测试的代码贡献，而非 JSON 文件。若系统需要，请在 Engine 仓库提出功能请求，用几个演算完整的掷骰例子说明机制。这些例子会成为测试。

Game Mode 可用 Marinara 自身战斗或规则集规则结算战斗。可选的 `battle` 块将人物卡数值提供给 Marinara 战斗，见[战斗桥接](#battles-lending-the-sheet-to-marinaras-combat)。可选的 `combat` 块则定义规则集如何自行结算，见[独立规则战斗](#combat-a-fight-your-own-rules-resolve)。Engine 目前已能执行这些规则。游戏的 Combat Preference 选择 Classic 呈现，或在规则集定义距离时选择 Tactical 战场。

## 快速开始

1. 复制符合系统掷骰方式的示例文件。[`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) 是三个属性的小型 2d6 系统，用来说明格式不预设 d20 或六项属性。[`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) 是三个评级、六项专业技能的小型十面骰池。完整规模的例子见 [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json) 中的 5e (SRD 5.1)。
2. 将 `id` 改为自己的值。ID 使用小写字母、数字和单个连字符，例如 `ember-roads`。
3. 编辑人物卡、休息和 Game Master 文本。
4. 导入，参见[试用规则集](#trying-your-ruleset)。导入会在保存前检查整个文件，逐行说明问题。
5. 创建新游戏，在 **Rules**(规则) 中选中规则集，实际进行几次检定。

要获得输入辅助，请在文件最外层花括号内的第一行添加以下内容，为编辑器指定 JSON Schema：

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

模式会在输入时发现键名拼写和类型错误，但无法检查名称是否指向真实存在的对象，例如技能引用的属性。这由导入完成。

你可以在文件的任何对象中添加 `"$comment": "..."` 一行作为备注。Engine 会忽略它。

## 文件组成

| 键 | 内容 |
| --- | --- |
| `schemaVersion` | 始终为 `1`。 |
| `id`, `version` | Engine 使用的规则集名称，以及每次发布修改时递增的整数。 |
| `name` | 玩家在设置向导中看到的名称。 |
| `edition` | 可选，用一行说明版本或草案。 |
| `license` | 可选，SPDX ID 和来源要求的署名文本。 |
| `coverage` | 规则集覆盖范围，以及设置向导展示的一行摘要。 |
| `resolution` | 如何掷检定或豁免。 |
| `sheet` | 人物卡中的所有内容。 |
| `rests` | 各种休息恢复和清除什么。 |
| `gm` | 给 Game Master 模型的文本，以及它能看到的各角色人物卡数值。 |
| `catalogs` | 可选，人物卡编辑器提供的现成条目，省去手动输入长列表。 |
| `battle` | 可选，战斗可从人物卡读取什么，以及结束后写回什么。 |
| `combat` | 可选，如何按自身规则结算战斗，以及战斗界面执行什么。 |
| `layers` | 可选，玩家创建游戏时启用的规则集变体。 |

文件最大 256 KB。会进入提示词的文本(名称、标签、Game Master 文本)不能包含换行、方括号或双花括号。

人物卡内的 ID(属性、技能、字段、池等)以字母开头，使用小写字母、数字和下划线，例如 `grit_max`。

<a id="resolution-kinds"></a>

### 结算类型

`resolution.kind` 选择检定如何掷骰。两种类型读取相同人物卡，共享三个键，因此切换时 `resolution` 以下的文件部分不用改变：

- `abilityModifier`：人物卡分值如何变成一个数字。`identity` 表示直接使用分值；`floorHalfMinusTen` 是 5e 规则；`stepTable` 允许用 `[[score, number], ...]` 列出自己的阈值。
- `proficiencyTiers`：技能或豁免的训练等级。未列出的技能使用第一档。每档增加 `flat`、熟练加值的 `multiplier` 倍或两者都有。如果系统有熟练加值，用 `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }` 指定来源。
- `proficiency`：可选，仅乘算档位需要。

结果数字的含义由类型决定：`dice-sum` 把它加到掷骰上，`dice-pool` 掷出相应数量的骰子。

#### `dice-sum`：将骰子求和

```json
"resolution": {
  "kind": "dice-sum",
  "dice": { "count": 2, "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained" },
    { "id": "trained", "label": "Trained", "flat": 1 }
  ],
  "advantage": false,
  "difficultyLadder": [
    { "label": "Easy", "dc": 6 },
    { "label": "Hard", "dc": 10 }
  ]
}
```

- `dice`：骰子数量和面数。总和用于与难度比较。
- `advantage`：是否允许 Game Master 要求掷两次并保留其中一次。
- `naturals`：单颗骰子的最高和最低点数对检定及豁免的影响，取 `none`、`both`、`max-only` 或 `min-only`。纯算术可省略。它要求单颗骰子，所以 2d6 系统必须使用 `none`。
- `difficultyLadder`：向 Game Master 提供的难度候选。`dc` 是总和必须达到的数字。

#### `dice-pool`：掷骰并计数

人物卡数字代表**骰池大小**，而不是额外加值。评级 3 加专业技能 2 就掷五颗骰子。原理仅此而已：无需新人物卡词汇或编辑器，评级代表一把骰子的系统同样使用 `abilities`、`skills` 和 `proficiencyTiers` 编写。

```json
"resolution": {
  "kind": "dice-pool",
  "die": { "sides": 10 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "rating_0", "label": "Untried" },
    { "id": "rating_1", "label": "Shown once", "flat": 1 }
  ],
  "pool": { "min": 1, "max": 15 },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`：骰池中每颗骰子的面数，2 到 100。
- `pool`：任何爆骰发生前，人物卡数值被限制到的范围。`min` 为 0 时，空池可以完全不掷骰就失败；`max` 最高为 100。
- `target`：骰子计为成功需要达到的点数。将 `min` 设为低于 `max`，允许 Game Master 用 `threshold=` 逐次调整；三个值相同则固定。
- `double`：可选，点数达到或超过 `from` 时计两次。
- `explode`：可选，达到或超过 `from` 时多掷一颗，新增骰也可继续爆骰。额外骰在原骰池之外最多 `pool.max` 颗，因此单次检定最多掷两倍 `pool.max`，较低的 `from` 也不会无限掷下去。
- `cancel`：可选，点数不高于 `upTo` 时减去一次成功，成功数不低于零。
- `botch`：可选，**没有任何**骰子成功，且出现不高于 `upTo` 的点数时为大失败。唯一一次成功被抵消的骰池是普通失败，不是大失败。
- `exceptional`：可选，成功的检定净成功数达到此值或更多时为大成功。
- `situationalDice`：可选，Game Master 为特技、伤势或昏暗照明等情境，用 `bonus=` 对单次检定增减骰子的范围。
- `difficultyLadder`：`successes` 是要求的成功次数。某一档也可指定 `target`，但仅当目标可调且在范围之内时有效。

`cancel` 和 `botch` 的点数必须低于最低目标，所有规则指定的点数必须实际存在于骰子上。永远无法触发的规则会在导入时被拒绝，而不是等游玩时才发现。

打包形式的骰池规则集要求 Capability API 1.24。导入的社区规则集由读取它的 Engine 验证，无须另行声明。

#### Game Master 可以在骰池检定中写什么

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
```

- `dc` 是所需**成功次数**，不是目标点数。范围为 1 到一次掷骰理论上最多可计的成功数：骰池最大值，允许爆骰时翻倍，点数可计两次时再翻倍。
- `threshold=` 调整单骰目标，仅在 `target.min` 小于 `target.max` 时提供。
- `bonus=` 增减骰子，仅在声明 `situationalDice` 时提供。
- `with=` 用其他属性替代技能或豁免原有属性。两种类型都支持，因此 5e 的 "Strength (Intimidation)" 也使用同一属性表达。

所有值都受文件声明约束：越界值会拉回最近边界，规则集未提供的属性则忽略，而不拒绝检定。保存记录显示实际使用的值，包括限制后的阈值和奖励骰；只有实际替换属性时才保留 `with=`。Engine 始终自行掷骰，替换模型填写的骰池结果；该类型没有优势，因此忽略 `mode="advantage"`，玩家在回合前自行掷出的骰子也不适用。

#### 范围之外的机制及原因

以下都无法表示为“数出达到目标的骰子”，因此各需自己的结算类型：

- **取最高骰**(如 Blades in the Dark) 需要检定结果尚未具备的部分成功档位。
- **与属性比较的姿态骰池**(如 Lasers and Feelings) 每次检定决定“高于还是低于”，是不同的比较方式。
- **符号骰**(如 Genesys) 根本不产生数字。
- **对抗骰池**同时结算两个角色，而一次检定只有一个掷骰者。
- **掷低于目标与开放式百分骰**使用相反的比较方向。
- **带狂野骰的求和骰池**(如 OpenD6) 将骰子相加并特殊处理其中一颗。

该类型过去遗漏的另外两项现在都已建模，下方“消费资源改变掷骰”说明其方式。系统自身的“花一点换一次成功”是 `resolution.spend`，购买成功或骰子，绝不购买重掷。重掷属于角色实际选取的内容，因此放在目录条目的 `mechanics.check` 中，用该条目自己的成本购买。

### 消费资源改变掷骰

有些系统允许玩家为即将进行的掷骰支付资源，例如一点意志换一次自动成功。`resolution.spend` 将其声明为系统常设规则，而非角色另行购得的特性：

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` 是某个 `live.pools`。不能是初始为空的池，否则开始游玩时无资源可花。
- `amount` 是一次购买的成本。购买所得为 `successes` 和 `dice`，至少要有其中一项。成功在骰子计数及抵消之后加入，因为它们并非掷出。骰子则在池自身范围内随骰池一起掷。
- `perCheck` 是单次检定可购买的次数，因此最多购买 `amount * perCheck` 点的效果。这个上限防止满池买出绝不会失败的掷骰。
- 仅限 `dice-pool`。求和掷骰没有可加的成功次数，也没有可加入骰子的池，因此声明 `spend` 的 `dice-sum` 会在导入时被拒绝。
- 两项不能指向同一资源池，否则检定无法说明指的是哪项。

**它写在检定本身。** Game Master 写 `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`，而非独立 `[sheet:]` 命令，因为骰子在应用人物卡命令之前就已掷出，另写命令将无从改变。一次结算同时掷骰并支付改变骰子的费用。

### 改变掷骰的护符

`resolution.spend` 是系统规则。角色实际选取的条目也能通过目录项的 `mechanics.check` 改变检定：

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll` 重掷不高于 `upTo` 的骰子。`once` 对每颗只替换一次，并接受新点数；`until` 则继续重掷。`upTo` 必须是低于最高面的实际点数，否则会永远重掷整个池；无论文件怎么写，Engine 都限制单次检定的重掷数量。
- `dice` 在掷池之前增加骰子，`successes` 在计数之后增加成功，`threshold` 则在 `target` 允许范围内设定本次单骰目标。
- 四者至少声明一个，否则条目没有效果而被拒绝。
- 只有 `dice-pool` 能实现这些内容，因此含 `mechanics.check` 的 `dice-sum` 会在导入时被拒绝。

**成本是条目自身的 `cost`**，通过与使用其他内容完全相同的机制支付：资源池，以及该条目写入的每个计数器的一次使用量。`perCostStep` 表示条目会缩放；声明它时按实际支付了几份价格购买几份，未声明时无论提出多少都只买一次。

**Game Master 在检定中点名：** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`。同样不能另写人物卡命令，因为骰子在任何记账处理之前就已掷出。

**要么全部成功，要么完全不买。** 资源池不足时不购买也不扣除，仍进行原本的掷骰。不足以构成整数次购买的点数也买不到任何东西。请求超过 `perCheck` 时会限制到上限而非拒绝，且只支付上限对应金额。全部由 Engine 计算，Game Master 只写玩家声明要花的资源，不碰骰子。记录显示真实支付量、应用条目、未掷骰获得的成功数，以及重掷了多少骰子。角色未选取的护符，或 Engine 无法读取目录的护符，完全不生效，不会凭信任应用。

### 人物卡

- `sections` 对编辑器内容分组。
- `abilities` 是核心属性值。`skills` 和 `saves` 可各自指定使用的属性。
- `fields` 是单值，类型有 `number`、`text`、`longtext`、`boolean`、`enum`(固定候选列表) 和 `dice`(如 `1d8` 的文本)。
- `derived` 从其他值计算，不可手动覆盖。运算有 `sum`、`min`、`max`、`scale`(乘算并取整) 和 `stepTable`(按阈值查表，如等级对应熟练加值)。
- `lists` 是自定义列的表，如装备、法术或特性。带 `pools` 的列表让每行成为有自身上限的资源，适用于有限使用次数的职业特性。
- `live` 是游玩中变化的内容：`pools`(生命、法术位、Grit)、`tracks`(如力竭的刻度数值，或勾格子的伤势轨道)、`text`(如角色正专注什么的短备注) 和 `conditions`。

凡是读取数字的地方都用值引用指定。它是恰好含一个键的对象，键为 `const`、`field`、`derived`、`abilityScore`、`abilityMod`、`abilityModFromField`、`skillMod` 或 `saveMod`。例如，最大值来自派生值的池：`"max": { "derived": "grit_max" }`。

`hideWhen` 在另一字段具有指定值时隐藏字段、列表或池。5e 文件用它为不施法的角色隐藏法术位。

### 伤势轨道：用轨道而非数字表示生命

许多系统根本不计生命点，而是有一列每格比前一格更严重的格子，受伤时标一格。给 `live.tracks` 条目添加 `levels` 和 `kinds`，它就从刻度数字变为这种轨道：

**系统需要哪种形式？** 池记录承受多少伤害；轨道记录每份伤害的量与种类。如果伤势分为冲击、致命或恶化，并且因为恶化伤害恢复更慢、无法吸收或最终致死，种类在打击之后仍有意义，就必须在掷骰后保留它，而只有标记能携带种类。点数池做不到：扣伤后只剩更小数字，人物卡不记得哪些点属于哪类。因此，生命为池时 `combat.damageKinds` 会被拒绝，而非静默忽略。池仍可有 `damageTypes`，对手仍能抵抗或免疫，因为那关乎一击实际造成多少伤害，而非事后伤势是什么。

```json
{
  "id": "harm",
  "label": "Harm",
  "min": 0,
  "max": 4,
  "levels": [
    { "label": "Scuffed", "penalty": 0 },
    { "label": "Winded", "penalty": -1 },
    { "label": "Bleeding", "penalty": -3 },
    { "label": "Down", "penalty": -99 }
  ],
  "kinds": [
    { "id": "knock", "label": "K", "severity": 0 },
    { "id": "tear", "label": "T", "severity": 1 }
  ]
}
```

- `levels` 为 1 到 16 级，最好在前、最差在后。每级有 `label` 和不大于 0 的整数 `penalty`。这类系统用很大的负数表示失去行动能力，因此 `-99` 也有效。
- `kinds` 为轨道能接受的 1 到 6 类伤害，每类含 `id`、格子使用的简短 `label` 和 `severity`。严重度必须互不相同；数值除排序外没有含义，间隔随意。
- 两者必须配套。没有 `levels` 的 `kinds` 会被拒绝，因为无处标记；没有 `kinds` 的 `levels` 也会被拒绝，因为标记必须有种类。
- **区分两个术语。** `kinds` 定义规则集允许标记成为哪些种类。标记则是游玩时某一种类实际占据轨道的实例。定义保存种类，人物卡保存标记。
- 伤势轨道长度就是级数，因此 `min` 为 0，`max` 为 `levels.length`。不符的文件会被拒绝而非悄悄修正，避免同时携带两个冲突长度。

模糊理解会得到错误轨道，因此以下是**精确规则**：

- 标记按**最严重优先**排序保存。七级轨道最多容纳七个标记。
- 标记按已有标记的**严重度顺序插入**，从不直接追加末尾。它占据严重度允许的最高等级，并将较轻标记向下推。
- 生效惩罚取**最低已标记等级**，而非各格之和。上面轨道的三个标记是 `-3`，不是 `0 + -1 + -3`。
- `amount` 是某一类标记的个数，**逐个应用**，因此中途填满和原本已满的轨道使用相同规则。
- 向**已满**轨道标记时，不新增标记，而将**最轻标记提升一档**。按自身种类阶梯上升一档，与新增标记原本是什么种类无关。
- 超过最高严重度的标记停在最高级，无法落下的那一个计作**溢出**。溢出会保存，因此重载不会忘记已受伤害。
- **治疗使用同一命令和负数数量。** 先清较轻标记，且先清溢出再清任何标记。

**游玩时标记。** Game Master 写 `[sheet: op="damage" track="harm" kind="knock" amount="1"]`，用负 `amount` 治疗。原先指定 `pool=` 的 `damage` 形式不变。伤势轨道拒绝普通 `track` 命令，因为单一数字无法说明新增标记是什么。玩家也可在人物卡手动标记和清除格子，符合这些系统的预期。

**战斗也能标记。** 将 `combat.health` 指向轨道而非池，命中一击就按 `combat.damageKinds.marks` 指定格数，以及该块将伤害类型映射到的种类进行标记。轨道填满的角色倒下，濒死规则读取这一状态。治疗清一个标记。轨道没有临时点数缓冲，因此拒绝临时点数。Engine 把轨道视为剩余级数，所以战斗的其他部分、倒下、复活、日志和战后摘要都不变。

**休息可以治疗伤势轨道。** 用 `"to"` 指定轨道的恢复步骤会连同溢出一起清到指定标记数；用 `"by"` 则先清溢出，清除指定数量。会增加标记的步骤不做任何事，因为休息没有指定要标记的种类。

### 掷骰惩罚

`resolution.penaltyFrom` 指定伤势轨道，其惩罚应用于规则集掷出的每次检定。它需要声明而非推定，因此省略时与伤势轨道出现之前完全一样。

惩罚如何作用，由结算类型决定，与人物卡自身数字相同：

- `dice-pool` 是**从骰池减骰**，下限为自身 `pool.min`。`pool.min` 为 1 时，即使最底一档也掷一颗；`pool.min` 为 0 时则不掷骰直接失败。
- `dice-sum` 是**掷骰固定调整值**，合入属性和训练原本添加的数字。

指定的必须是伤势轨道。普通轨道没有可应用的惩罚，导入时会拒绝。结果说明用了哪个惩罚，让玩家理解为何少掷骰；Game Master 的人物卡块也显示档位及代价。

### 休息

休息是恢复步骤和清除内容的列表。每步指定一个目标(`pool`、`poolGroup`、`listPools` 或 `track`)，并设置为某值(`"to": "max"`、`"to": "min"` 或数字)，或改变它(`"by": { "const": 1 }` 或 `"by": { "fractionOfMax": 0.5 }`)。指定伤势轨道的步骤只能治疗，见上文。

### Game Master 文本

- `checkGuidance` 替换内置的检定请求说明段落。请说明是什么系统、何时掷骰。Game Master 仅指定技能和难度，Engine 依据人物卡计算并掷骰，所以不要要求模型做算术。
- `sheetGuidance` 在提示词中介绍人物卡，用来说明重要资源及何时消耗。
- `worldGuidance` 可选，在生成世界时只读一次，让 GM 创造的背景符合规则，例如无火药、魔法稀有、死者行走。它从不进入回合提示词。
- `sheetSummary` 选择 GM 对各角色可见的字段、派生值和列表行。Engine 始终显示属性调整值、受训练技能和豁免，以及实时数值。其余保持简短，因为每回合都会发送。

## 目录：人物卡列表的现成条目

逐行输入法术列表、装备表或整页职业特性很费力。目录是随规则集提供的具名现成条目集合。人物卡编辑器在目录供给的每个列表提供选择器，选中一个就填好对应行。

目录可选，规则集最多十二个。Engine 不知道它们各自关于什么；每个 ID、列、筛选条件和词语都来自文件。

### 头部

头部放在文件顶层、与 `gm` 并列的 `catalogs` 中。

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id` 与 `label`：ID 遵循人物卡 ID 规则，标签是选择器名称。
- `holds`：取 `"rows"`(默认，也是本次发布前全部目录的形式) 或 `"creatures"`。生物目录是战斗读取的图鉴，不写人物卡、不声明 `feeds`，也不出现在选择器。见下方[生物](#creatures-a-bestiary-a-fight-reads)。
- `feeds`：该目录条目可写入的 1 到 8 个人物卡列表。行目录必填，生物目录禁止。条目不能写入未列出的列表，也不能写入列无法容纳的值。
- `filters`：可选，最多八个，说明选择器可按什么缩小范围。筛选项为 `number`、`text` 或 `tags`(多个词)。`startFrom` 指定选择器打开时使用的人物卡字段，所以 Calling 为 Tinker 的角色先看到 Tinker 条目。
- `units`：可选，说明条目 `mechanics` 块中的射程或区域尺寸在系统中代表什么。

### 条目

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id`：小写字母、数字和单个连字符，在目录内唯一。
- `label` 与 `summary`：选择器展示的内容。摘要可选、单行、最多 300 字符。
- `filters`：头部声明的筛选值。`number` 接受数字，`text` 接受一个字符串，`tags` 接受字符串列表。
- `rows`：选中条目时写入的 1 到 6 行。`list` 是目录某个 `feeds`，`values` 按该列表的列 ID 定键。
- `creature`：在 `holds` 为生物的目录中，用对手代替行。条目恰好包含 `rows` 或 `creature` 之一；生物不带 `mechanics`，而在自身动作中说明行为。

每个值都按目标列表的列检查，因此列名拼错或数字越界会连同来源条目一起报告。规则集文件内的条目在加载时验证；导入文件就是导入时验证。包的独立目录文件在选择器首次请求时检查；有错误时显示原因而非任何条目。

### 一个条目，多个列表

有限使用次数的特性在人物卡上是两行：特性本身及跟踪次数的计数器，但仍只需选择一次。

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

### 规则集持续更新的值

行一旦被选取，数值便属于玩家。值得保留一个例外：随角色变化的上限，例如次数等于属性值，或随等级增长的职业资源。行可以在 `scaled` 映射中指定自身最多四个数字列，由人物卡编辑器维护正确值。

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- 键是列表某个 `number` 列。
- `from` 是普通值引用，使用与其他位置相同的封闭词汇。更复杂的计算由人物卡声明为 `derived` 值，再让 `from` 引用，例如 `"from": { "derived": "lay_on_hands_max" }`。这里不增加新算术。
- `table` 可选，将引用值按阶梯表查找，从而让等级给出数字：`"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`。
- `values` 仍须为该列提供普通数字，缺失会被拒绝。这是尚不知道具体人物卡时的值，也是没有该引用的人物卡保留的值。
- 带 `scaled` 的行必须是该条目写入该列表的唯一一行，确保人物卡上带标记的行始终只对应一份规格。

值在编辑人物卡时计算，读取时不计算，因此已存行始终就是其声明的数字。值按目标列的 `min`、`max` 限制，整数列则向下取整。上例中 Heart 3 有三次，Heart 0 或以下没有次数。行仍以 0 次保留；上限为 0 的计数器不是资源池，因此游玩时没有可消耗内容。

打包规则集的缩放列要求 Capability API 1.23。导入社区规则集由读取它的 Engine 验证，无须另行声明。

### 选中的行是副本

每个选中行复制到人物卡时，会增加 `_catalog` 键，保存 `<catalog id>/<entry id>`。列 ID 始终以字母开头，因此该键绝不会是你自定义的列。

副本属于角色。玩家之后可编辑任何部分，未安装规则集时人物卡仍可用，发布新版也绝不会重写任何人的角色。选择器读取此标记以显示人物卡已有内容，下方 Refresh 也读取它。

### 从规则集刷新

选中行保留标记，因此人物卡编辑器能在新文本与现有行不同时提醒玩家。列表下方简短说明有多少行更新，**Review**(检查) 按钮逐项并列显示人物卡和规则集内容，每行有勾选项。玩家点击 **Update selected**(更新所选) 前不会写入，而且只写入勾选行中不同的列。其余内容全部保留，包括标记。

比较范围有意保持狭窄：

- 只比较 `text`、`longtext`、`dice` 和 `enum` 列的现有值。已有的 `number` 和 `boolean` 值属于玩家，包括 0 和 false 在内都会保留。对于行中尚不存在的列，可以提议加入符合类型的值，包括数字和开关。随人物卡缩放的列不参与比较，因为它已经跟随人物卡变化。
- 只涉及条目设置的列。条目未填写的列始终不会改动，无论人物卡中存了什么。
- 列本身会拒绝的值，例如已不再提供的 `enum` 选项或超过 `maxLength` 的文本，会跳过，不会写入。
- 在该列表中携带同一标记的各行之间，按位置将人物卡行匹配到它源自的条目行。只要人物卡中这些行的数量仍等于条目写入的数量，这种匹配就成立。否则，只有条目向该列表写入单行时才能匹配。如果玩家删除了双行条目中的一行，就保留该条目不动，不去猜测。
- 如果行所属的条目已不在目录中，该行会静默保留原状。

因此，修改条目措辞或名称可以触达已经选择它的角色，前提是玩家接受。改变数字的含义则不能、也不会这样传播：行归玩家所有之后，那一列也就属于玩家。

### `mechanics`：条目的数值效果

条目可以带可选的 `mechanics` 块，用数值说明其效果：`kind`(`attack`、`heal`、`buff`、`debuff`、`utility`、`rider`)、`range`、`area`、`targets`、`targetCount`、`friendlyFire`、`amount`(`2d6` 等骰子表达式或固定数值)、`damageType`、`attackRoll`、`autoHit`、`save`(人物卡中的一种豁免，以及成功后的效果)、`applies`(为接触到的对象施加的状态)、`temporary`(生命池的临时点数)、`scales`(随人物卡增长的数量)、`cost`(使用时消耗哪个池)、`perCostStep`、`budget`(消耗行动经济的哪部分)、`concentration`、`reaction`、`plus`、`free`、`gives`、`standard`、`rider` 和 `check`。

选择器会用一行展示这个块。其余内容由谁读取，取决于规则集选择启用了哪个块：

- 带有 [`combat` 块](#combat-a-fight-your-own-rules-resolve)时，战斗读取其中的战斗效果。`range`、`area` 和 `friendlyFire` 在有位置的战场上生效；`reaction` 表示该条目用于回应某件事，在条目能够声明所等待的触发条件之前，这类条目不会出现在任何菜单上。`check` 按前文所述应用于技能检定。
- 只有 [`battle` 块](#battles-lending-the-sheet-to-marinaras-combat)时，战斗读取 `kind`、`range`、`area`、`friendlyFire`、`amount`、`damageType` 和 `cost`，因为 Marinara 自身的战斗系统只能使用这些部分。

词汇范围是封闭的。上述列表之外的键或值会被拒绝，而不是静默忽略。

`cost` 也是 Game Master 在战斗外使用 `use` 命令时支付的费用，下一节会说明。

### `use` 命令：让 Game Master 支付你写下的费用

Game Master 在叙述时使用 `[sheet: ...]` 命令保持各人物卡最新：`spend`、`restore`(`heal` 含义相同)、`damage`、`temp`、`track`、`condition`、`note` 和 `rest`。提供目录的规则集还会多一个命令：

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` 与 `op="use"` 含义相同，`spell=` 与 `name=` 也相同。因此，无须让格式认识“法术”这个词，Game Master 自然选用的措辞也能工作。

名称会与该角色人物卡中来自你所提供目录的行进行匹配，不区分大小写。行会响应 Game Master 看到的名称(依次取该列表的 `sheetSummary` 名称列、列表的 `pools.nameColumn`、第一个文本列)，也响应原条目的 `label`，因此玩家重命名行后仍能找到它。没有任何行响应的名称，以及两个不同条目都响应的名称，均会被拒绝。

它消耗以下内容：

- 条目 `mechanics.cost` 中的每一项。指定实时池的费用项从该池支付；指定池组的费用项，按声明顺序从该组中第一个付得起的池支付。不会自动向更高的池升级，因为池组不一定是逐级阶梯。
- 再从同一条目写入的每个列表行池中各扣一份，例如追踪特性使用次数的计数器。这就是上文 `Last Ember` 条目的第二行。最大值为 0 的计数器没有可用次数，因此会拒绝命令，不会免费放行。

`pool=` 表示升阶使用：从同组另一个池支付相同的单项费用。仅当费用恰好有一项，且指定池与该项属于同一组时才接受。其他情况会被拒绝，不会另行解释。

支付要么全部成功，要么全部取消。如果任一部分付不起，整个命令都会被拒绝，不作任何更改，并告知玩家。戏法或被动特性等完全没有费用的条目会被接受，也不会改变任何数值。

### 内联或独立文件

小目录内联放在 `ruleset.json` 头部的 `entries` 中。长目录存于独立文件，头部改用 `asset` 指向它。每个目录必须且只能选其中一种。

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

路径始终是 `catalogs/<the catalog's id>.json`。文件本身如下：

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

独立目录文件用于通过官方目录发布的包：包必须在 `contributions.assets.paths` 中将该文件与 `ruleset.json` 一同列出，并且需要 Capability API 1.21。生物目录无论内联还是独立文件，都需要 Capability API 1.27。**以单个文件导入或通过 GitHub 仓库分享的规则集，必须内联携带目录**，所以目录也得装进整个规则集文件 256 KB 的限制内。这大约能容纳数百个短条目。

限制为每个规则集 12 个目录、无论哪种方式每个目录 2000 个条目、每个目录文件 1 MB。

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## 战斗：将人物卡借给 Marinara 的战斗系统

默认情况下，战斗对人物卡一无所知。它照常构建参战者，角色打完一场战斗后，人物卡上的生命值可能完全没变。

可选的 `battle` 块只从一个方向改变这一点：将人物卡数值借给战斗，并将战斗结果写回。**它不会让战斗遵循你的规则。** 骰子计算仍属于 Marinara，谁打中谁、造成多少伤害也一样。因此生命按最大值的比例传递，而非直接使用你的原始数值：人物卡上半血的角色，会以 Marinara 为其构建的生命条的一半开始战斗。你的 9 点生命池绝不会原样放进一次攻击就造成 12 点伤害的战斗。

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`：必填。作为角色战斗生命值的实时池。必须来自 `sheet.live.pools`，不能是各行为池的列表。
- `energy`：可选。供战斗消耗的实时池，成为 MP 条。必须与 `health` 是不同的池，因为战斗不能将生命值当作燃料消耗。
- `slots`：可选。战斗每次消耗一个的实时池，各自具有 1 到 9 的 `level`：`[{ "pool": "slots_1", "level": 1 }]`。每个等级和池只能使用一次。
- `skills`：可选，最多八项。其行会成为角色战斗技能的人物卡列表。只计算来自你所提供目录的行，而且该行背后的条目必须具有 `mechanics` 块：手动填写的行没有数值意义。`onlyWhen` 指定行中必须设为真的布尔列，例如已准备的法术。`alwaysWhen` 指定一个列和值，允许行例外通过，例如无需准备即可施放的法术。它是 `onlyWhen` 的例外，所以未同时指定后者时会被拒绝。

### 带入与带出的内容

**带入：** 对游戏中已有人物卡的每位队友，生命池占最大值的比例决定其在 Marinara 自身生命条上的起点；能量池成为 MP；每个法术位池成为对应等级的法术位；带标记的行成为技能。最大生命、攻击、防御、速度和等级仍采用 Marinara 自身数值。生命池为零的角色以倒下状态开始战斗，因为人物卡就是这样记录的；生命大于零的角色则至少以 1 点生命开始，因此小比例不会因舍入而让人倒下。

**带出：** 战斗结束后，将参战者最终生命条的比例读回生命池自身的刻度，再把与开战时的差额作为伤害或治疗应用。能量和法术位是计数而非比例，所以原样写回。所有更改都经过人物卡自身按钮所遵循的规则，人物卡拒绝的更改会跳过并报告，而不会强行应用。如果战斗没有改变某位参战者的生命值，就完全不写生命变化，因此两次转换本身绝不会改变人物卡。

**均不涉及：** 攻击检定、豁免、专注，以及更高费用会增加什么效果。这些内容保存在 `mechanics` 块中，供真正的战斗系统日后读取；这项桥接功能不会应用它们，规则集也不应声称会应用。

放弃的战斗不会写回任何内容。如果你删除了战斗开始所在的消息，或战斗始终没有结束，人物卡就与原先完全一致：视同战斗没有发生。

### 条目如何成为技能

目录条目的 `mechanics` 块按以下方式读取：

- `kind` 成为技能类型。`utility` 条目及所有标为 `reaction` 的条目都会排除，因为 Marinara 的战斗系统没有对应的处理位置。
- `amount` 决定命中威力，但使用的是相对参战者自身攻击力的倍率，而非伤害数值。更大的骰子不会打得更轻，倍率也保持在生成技能原本使用的范围内。
- `range` 和 `area.size` 除以目录的 `units.distance.perCell` 后得到网格格数，绝不会向下取整成零。爆发取其半径，锥形取其一半，直线取一格。凡有范围的效果都以覆盖的所有敌人为目标，并遵守 `friendlyFire`。
- `damageType` 成为技能元素。`targets` 不会带入：Marinara 的战斗系统根据技能类型，决定治疗、增益或攻击可以指向谁。
- 能量池上的 `cost` 成为 MP 费用，多项能量费用会相加。恰好一个法术位的 `cost` 会消耗对应等级的一个法术位。Marinara 的战斗系统只收取一种能量数值或一个法术位，从不两者兼收。因此，消耗两个法术位、两个不同等级的法术位、或法术位加能量的条目，会从战斗中排除。任何其他池的费用也一样，例如生命或职业资源，否则 Engine 就会免费提供它。
- `buff` 或 `debuff` 成为 Marinara 自身的增益或减益。条目文本承诺的其他效果，例如清除人物卡上的状态，不会在战斗中应用。如果条目的效果只有在战斗外才有意义，就不要为它添加 `mechanics`。

`coverage.combat` 独立设置，含义仍和以前一样：只有战斗真正遵循你的系统规则时才设置它。

<a id="combat-a-fight-your-own-rules-resolve"></a>

## 战斗：由你自己的规则结算

上面的 `battle` 块将人物卡数值借给战斗，计算方式仍属于 Marinara。可选的 `combat` 块则是另一回事：它说明如何用你的规则结算战斗。它为 Engine 所拥有的一种战斗类型提供参数，正如 `resolution` 为检定类型提供参数一样，其中每个名称都由你决定。目前只有一种类型。

**规则集声明了 `combat` 的游戏，会按你的块进行战斗。** 队伍数值取自各自的人物卡；敌人来自你的生物图鉴或威胁尺度；每个回合都按你的骰子结算；角色消耗或损失的任何内容都立即写回人物卡，因此中途关闭标签页也不会丢失。战斗画面使用你的措辞：菜单中是你的攻击和能力，使用你的行动额度和状态，日志展示实际算式。尚未实现的内容列在“尚未支持”中。

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

这就是 Ember Roads 块的全部内容，Ember Roads 游戏按它进行战斗。5e 草案将相同的键用于 d20 系统：

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

### 各个键

- `kind`：`"attack-vs-defense"`。一方投骰对抗另一方的防御，命中则造成伤害。
- `health`：必填。战斗扣除的对象。可以是 `{ "pool": "grit" }`，表示向下扣减的实时池；若有临时缓冲，伤害先扣缓冲。也可以是 `{ "track": "harm" }`，表示需要标记的伤势轨道。轨道必须同时指定 `damageKinds`，且不提供临时点数。
- `defense`：必填的值引用。可以是玩家输入的字段，或由你计算的派生值。
- `initiative`：必填。开始时投一次的骰子，以及可选的调整值引用。同值时调整值较高者优先，再按战斗建立时的顺序排列。
- `attackRoll`：必填。指定骰子、是否投两次取其一(`advantage`)、单骰最大与最小点数的效果(`naturals.max`：`critical`、`hit` 或 `none`；`naturals.min`：`miss` 或 `none`)，以及重击对伤害的影响(`critical`：`double-dice` 再投一次伤害骰，`max-dice` 加一次最高骰面，`none` 则是普通命中)。特殊骰面和检定一样，需要单颗骰子。战斗内的豁免也投相同的骰子。
- `economy`：必填。`budgets` 是一个回合可持有的行动额度，包含 ID、标签、`per`(`turn` 在持有者自己的回合开始时补充，`round` 在新轮开始时补充)和 `count`。你首先声明的额度是主额度，标准行动消耗它。`movement` 是可选的值引用，表示按你自己的距离单位，一回合可以走多远。它由棋盘上的战斗读取(见“位置”)。
- `attacks`：可选。其行为武器的人物卡列表。`name` 是给行命名的文本列，`damage.dice` 是骰子列；`toHit.ability`、`toHit.proficiency`、`toHit.bonus`、`damage.ability`、`damage.bonus` 和 `damage.type` 各自指定同一列表中的列。`ability` 列是保存某个自定义属性 ID 的 `enum`，不属于属性 ID 的值不作任何加成。`proficiency` 列是 `boolean`，设为真时加入熟练加值。没有可读骰子的行不是攻击，所以同一列表中的绳索仍只是绳索。`strikes` 是可选的值引用，说明消耗一次该列表额度能获得几次打击。手中没有剩余打击时选取一行，会消耗额度并将其余打击交到手中；只要手中还有，所有声明了 `strikes` 的行都不再消耗额度，因此换武器、换目标、在两次攻击间行走，都自然地由菜单支持。`strikesCappedBy` 指定一个布尔列，无论列表一次给出几次打击，该列都将自己所在的行限制为一次。这用于无论使用者攻击次数多少，每回合都只能发射一次的武器；它正是为了表达 SRD 5.1 的 Loading 属性而设。若列表本来就一次消耗只给一次打击，该设置毫无意义，会被拒绝。手中的打击属于参战者，不属于某个列表：如果角色的两个武器列表都声明 `strikes`，不论挥动哪一行，都消耗同一份剩余打击。它们在获得它们的回合结束时清除。未声明此项的列表一次消耗获得一次打击，与该功能出现前的所有战斗相同。

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`：可选。其带目录标记的行为能力的人物卡列表，使用 `onlyWhen` 和 `alwaysWhen`，完全按 `battle.skills` 的方式筛选。每个能力的效果取自条目自己的 `mechanics`；该块指定默认消耗的 `budget`、需要攻击检定的条目所加的 `toHit`，以及条目豁免所对抗的 `saveDifficulty`。如果条目要求豁免，无论是自己的豁免，还是结束其施加状态的豁免，而落入的列表没有 `saveDifficulty`，就会被拒绝：没有难度的豁免总会成功。
- `standard`：可选，取自封闭列表 `dash`、`disengage`、`dodge`、`help`、`hide`、`ready`。`dodge`(攻击闪避者时投两次取较差结果)和 `help`(受助盟友下次攻击投两次取较好结果)始终会结算。`dash`(再获得相同移动额度)和 `disengage`(本回合走开时无人能借机攻击你)在棋盘上结算，无棋盘时仅记录。`hide` 和 `ready` 会接受，但目前没有效果。
- `standardEffects`：可选，表达标准行动标记本身无法涵盖的部分。目前仅 `dodge` 有此项：`{ "dodge": { "saves": ["dex_save"] } }` 指定闪避期间哪些自定义豁免投两次取较好结果。只能指定人物卡已声明的豁免，并且 `standard` 列表必须含有 `dodge`。省略后闪避与原来完全相同：更难被命中，仅此而已。
- `conditions`：可选。将你自己的状态 ID 映射到效果，使人物卡状态和战斗状态成为同一份记录，中毒角色战后仍然中毒。效果取自封闭列表：`own-attacks-advantage`、`own-attacks-disadvantage`、`attacks-against-advantage`、`attacks-against-disadvantage`、`attacks-against-adjacent-advantage`、`attacks-against-far-disadvantage`、`attacks-from-adjacent-critical`、`cannot-act`、`cannot-react`、`speed-zero`、`half-move-to-stand`、`ends-on-damage`、`own-saves-advantage`、`own-saves-disadvantage`、`resist-all`、`cannot-target-source` 和 `cannot-approach-source`。`failsSaves` 指定在该状态下无须投骰便失败的豁免。需要距离或移动的六项(`attacks-against-adjacent-advantage`、`attacks-against-far-disadvantage`、`attacks-from-adjacent-critical`、`speed-zero`、`half-move-to-stand`、`cannot-approach-source`)由有棋盘的战斗读取，没有棋盘时不产生效果(见“位置”)。`cannot-react` 会将持有者排除在走动打开的响应窗口之外，因此从不会征询其回应。效果旁还有三个键：
  - `saves`：两种豁免效果涉及哪些自定义豁免。省略时表示全部；若未包含两种效果中的任何一种却指定它，会被拒绝。
  - `whileSourceInSight`：只有施加者在持有者视线内时才生效的部分。`true` 限制整个状态；写该状态自身效果的列表，则只限制所列效果，其余继续有效。这适合无论是否看得到来源，都阻止你走近的恐惧。指定状态并不具备的效果会被拒绝。没有棋盘就没有可打断的视线，因此两种写法都会让所有效果生效。
  - `endsWhenSourceDown`：施加者倒下的瞬间移除状态。

`own-saves-advantage` 及其相反效果与攻击一样，将豁免投两次取其一，彼此抵消。`resist-all` 在目标自身抗性的基础上将所有种类的伤害减半，并按相同方式与易伤抵消。`cannot-target-source` 阻止持有者将任何东西指向施加该状态的人；`cannot-approach-source` 阻止持有者走到比当前格更靠近施加者的位置，连路径也算：绕到同样远的一格仍会提供，但先靠近对方再穿到另一侧的路不会提供。

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

- `concentration`：可选。指定记录维持内容的实时 `text` 字段、伤害强制要求的 `save`、难度下限 `floor`，以及所受伤害的比例 `fromDamage`，在后者更高时用它确定难度。开始第二个需要专注的能力会结束第一个；豁免失败也会结束专注，并一并移除它维持的状态。
- `dying`：可选，`kind: "saves"`。指定记录投骰次数的两条轨道(所需次数取各轨道自身最大值)、`dice`、`succeedAt`、最大与最小骰面的效果(`naturals.max`：`revive-1` 或 `success`；`naturals.min`：`one-failure` 或 `two-failures`)、倒下时受伤的代价(`damageWhileDown`、`criticalWhileDown`)，以及倒下角色所处的 `condition`。没有此块时，角色降到零就只是倒下，治疗即可恢复。
- `damageTypes`：可选。你的系统拥有的伤害类型，不区分大小写匹配。
- `damageKinds`：`health` 指定伤势轨道时必填，指定池时则拒绝，因为只有标记能携带种类，点数池没有位置保存种类(见前文“伤势轨道”)。它说明一次打击标为轨道的哪个 `kinds`，以及勾几格。`default` 用于一切未映射的情况，包括完全不带类型的打击；`byType` 将你的 `damageTypes` 映射到标记种类，键和类型本身一样不区分大小写，所以 `"Fire"` 和 `"fire"` 是同一个键，同时指定会被拒绝。`marks` 没有默认值，因为两种选择含义相反：`"per-point"` 表示伤害骰计算生命等级，3 点打击勾三格，减轻 1 点也有价值；`"per-blow"` 表示打击要么命中要么未中，无论打得多重都只勾一格。带多个伤害子项的打击也只标一格，采用实际生效的最严重种类。请明确你的系统采用哪一种。`{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`。
- `threat`：可选，生物图鉴需要它。`tiers` 是选取敌人的尺度，包含 ID、标签、`health` 区间、`defense`、`toHit`、`damagePerRound` 区间和 `saveDifficulty`。你提供的每个生物都指定其中一档；没人预先编写的敌人则会拉回 Game Master 要求的档位，因此不会超出你的尺度。`damagePerRound` 区间按生物一轮内对一个目标造成的伤害读取，包含完整动作序列。

### 战斗会从 `mechanics` 读取什么

`kind` 决定 `amount` 是伤害还是治疗；所有标为 `reaction` 的条目都不会出现在菜单中，`utility` 条目也一样，除非它改变回合自身可持有的内容(见下文)。`attackRoll` 使用列表的 `toHit` 对目标防御投骰；`autoHit` 完全跳过这一步。`save` 使用目标自己的豁免对抗列表的 `saveDifficulty`，`onSuccess` 决定成功时承受一半还是零。`targetCount` 表示能指向几个目标。没有攻击检定的能力(人人豁免的范围、直接命中的效果)只为所有人投一次伤害骰；对各目标分别作攻击检定的能力，则每次命中都重新投伤害骰。`applies` 为受影响对象施加状态，每项具有 `duration`：`instant`(没有自己的计时，直到被移除才结束)、`until-save`(须同时有 `saveEnds`)或 `{ "rounds": n }`；还可用 `saveEnds` 指定豁免及其在 `turn-end` 或 `turn-start` 重复。`temporary` 为生命池给予临时点数，永不叠加，只保留较大的缓冲。`scales` 按读取值所对应的表项增加额外骰子。`cost` 通过人物卡自身的 `use` 命令支付，`budget` 则覆盖其消耗的行动额度部分。

`plus` 在同一次打击的 `amount` 之外，增加最多三项数值，各自投骰、各自指定类型("and 2d6 fire")。子项形如 `{ "dice": "2d6", "flat": 1, "type": "fire" }`，还可以具有自己的 `save`：`{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`。无论行动已经要求目标做过什么，目标都要为此再作豁免：成功时 `none` 使该子项归零，`half` 留下一半，两者都不改变打击的其他部分。未写 `difficulty` 时，先回退到行动自身豁免使用的数值，再回退到列表的 `saveDifficulty`。重击按首项数值相同的规则翻倍各子项骰子；未写 `type` 的子项沿用打击自己的伤害类型。整个打击依然只按合计伤害做一次专注检定，以及一次倒下检查。子项必须依附 `amount`，`heal` 不携带子项。

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

三个键说明条目对回合自身的行动经济有何影响。声明其中任意一个的 `utility` 条目会被提供，不会被丢弃：

- `free`：完全不消耗行动额度。仍支付所声明的 `cost`，且不能同时指定 `budget`。
- `gives`：`[{ "budget": "action", "count": 1 }]`，最多四项。使用瞬间向对应额度增加数量，增加后的上限为本回合原本可持有的量加赠送量，因此无法存到后续回合。
- `standard`：`{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`。持有者可以用该额度执行这些标准行动。它们以 `standard:<id>@<budget>` 的形式和普通行动并列提供；如果条目只有这种许可，条目自身就不会出现在菜单中，因为许可并不是人可以执行的动作。

新的 `kind: "rider"` 条目是被动效果：无人执行，永不上菜单，并会自动为每个周期内第一次符合条件的命中增加一个伤害子项。它携带 `rider`，不携带其他可执行内容：

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources` 指定适用的攻击列表，`requires` 指定这些行中一个求值为真的列。因此，只在特定武器上触发的附加效果可以声明哪些武器适用，而不要求 Engine 理解什么是武器。两者都不写，就表示持有者造成的任何命中。`when` 满足任意一项即可：`advantage` 表示攻击检定最终的优势倾向；`ally-adjacent` 表示攻击者一名站立且能行动的盟友，在棋盘上须位于目标一格内，没有棋盘时则可在任何位置。`oncePer` 是 `turn`(每个人的每次回合开始时都会刷新，因此在别人行动时打出的攻击也能附加)或 `round`。`amount` 随条目自己的 `scales` 增长，`type` 是伤害类型，默认沿用打击自身的类型。

<a id="creatures-a-bestiary-a-fight-reads"></a>

### 生物：供战斗读取的生物图鉴

声明 `"holds": "creatures"` 的目录携带敌人，而非人物卡行。它不向任何列表供给内容，人物卡编辑器的选择器也从不提供它；其中每个数值都用 `combat` 块已经声明的键书写。它需要 `combat` 块和 `threat` 尺度，因为生物要归入你自己的某个档位。

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

下面是直接用数值编写生物的方式。如果改用规则集自己的定义写成 `sheet`，就从该人物卡获取 `health`、`defense`、`initiativeModifier`、`speed`、`abilities` 和 `saves`(见下文“用规则集自身定义编写生物”)。

- `health`：数值，或在创建战斗时投一次的 `{ "dice": "3d6", "flat": 2 }`。预测读取平均值，因此菜单不会承诺尚未投出的骰子结果。
- `defense`、`initiativeModifier`、`speed`：分别为攻击检定对抗的数值、先攻所加的值，以及按你自己的距离单位一回合能走多远。
- `abilities` 和 `saves`：以人物卡声明的属性 ID 和豁免 ID 为键。未指定的豁免读作零。
- `resist`、`vulnerable`、`immune`：伤害类型，不区分大小写匹配；如果声明了 `combat.damageTypes`，还会据此验证。`conditionImmunities` 指定你自己的状态。
- `tier`：属于 `combat.threat` 的哪一档。
- `traits`：展示给 Game Master 的简短名称与文本对。它们从不自动结算，因此凡是涉及数值的内容都应写入行动。
- `signaturePoints`：在自己的回合开始时补回的点数，用于支付 `signature` 行动。
- `riders`：最多四项，与目录条目的 `rider` 相同，只是写在块上。每项形如 `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`，可选 `type`，还可用 `actions` 指定它在本块哪些行动上触发。块的附加效果不读取人物卡列表，所以没有 `sources` 和 `requires` 这两个键。写成人物卡的生物则和角色一样，获得其列表携带的附加效果。
- `actions`：最多十二项，每项有自己的 `id`。行动包含手写数值块所包含的内容(`toHit`、`autoHit`、`damage`、`save`、`applies`、`targetCount`、`reach`、`range`、`area`)，以及四项生物独有内容。`reach` 是打击触及距离，`range` 是投掷或射击距离，`area` 是落点形状，全都使用你自己的距离单位。`range` 可以是普通数值，或在付出惩罚后仍能打得更远时写成 `{ "normal": 30, "long": 120 }`；`area` 为 `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }`(见“位置”)：
  - `uses`：`{ "per": "encounter" | "day", "count": n }`。耗尽后该行动离开菜单。
  - `recharge`：`{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`。开战时可用，使用后消耗；在生物自己的回合开始时投骰，达到 `from` 或更高便恢复。无论结果如何，日志都记录骰子。
  - `sequence`：按顺序执行同一块的其他行动，每个行动有自己的目标。**一个行动攻击两次的生物就是这样编写的。** 一次额度支付整个序列。序列不携带自己的效果，也绝不能指定另一个序列。
  - `signature`：`{ "cost": n }`，使用生物自己的点数而非行动额度支付，并且仅在别人行动时可用：战斗会在一回合与下一回合之间的窗口提供它(见“窗口”)。
- 豁免需要在行动本身指定难度：行动强制的豁免使用 `save.difficulty`；若行动没有自己的豁免，而状态在豁免成功时结束，则使用 `saveDifficulty`。即使生物有人物卡，块行动仍使用直接数值编写，所以该数值放在行动上。子项自己的豁免可以省略 `difficulty`，回退到同一个数值。
- `damage.plus` 与目录条目的 `plus` 是同一种子项列表，读取方式完全相同：`"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` 表示带热量的啃咬，热量有独立数值，独立受到抗性影响，也独立翻倍。

5e 草案自己的生物图鉴是在 `docs/development/ruleset-5e-2014.example.json` 中手写的五个生物，覆盖动作序列、充能、带状态的豁免、抗性与免疫、有限次数、招牌点数，以及一个以人物卡编写的生物。

#### 用规则集自身定义编写生物

生物不必用直接数值书写。改给它一份与角色人物卡形状完全一致的 `sheet`，战斗就会按构建队友的方式构建它：生命、防御、豁免、先攻、速度，以及列表中的每项攻击和能力，都由你自己的人物卡公式得出。如果规则集中的敌人与角色使用相同的属性、技能和列表，无论具体是什么，都可以这样说明。Ember Roads 的 Toll Warden 如下：

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **每部分都可省略：** `abilities`、`skills`、`saves`、`bonuses`、`fields` 和 `lists`，以人物卡声明的 ID 为键。所有省略内容都读取人物卡自身默认值，与空白角色完全一样。守卫的 Grit 为 9，是因为 `grit_max` 将 4、Toughness 和 Brawn 相加；Guard 为 7 也是同类计算结果。
- **每个数值只有一个来源。** 带人物卡的生物不能再提供 `health`、`defense`、`initiativeModifier`、`speed`、`abilities` 或 `saves`，否则 Engine 拒绝文件。它可以没有自己的 `actions`，因为它的列表决定它能做什么。没有人物卡的生物仍须提供前三项和至少一个行动。
- **按作者编写的数据验证。** 每个 ID 都必须由人物卡声明；技能或豁免设为你为其提供的某个熟练档次；字段、数值、加值或列须持有声明允许的内容(范围内的整数、某个选项值等)；列表行数不得超过允许数量。没有 `live` 部分，因为生物已消耗的内容由战斗保管。
- **行可以来自目录。** `_catalog: "<catalog>/<entry>"` 和角色人物卡一样，指定行所选自的条目；战斗也从该条目读取这行的费用和效果。目录必须向该列表供给内容。目录内联时，条目必须在其中；目录为独立文件时，若行指定文件中没有的条目，该行就不给生物任何效果。生物图鉴中人物卡所引用的目录，会与图鉴一起为战斗加载。
- **条目在人物卡之外声明的内容仍有效：** `tier`、`traits`、`actions`、`signaturePoints`、`riders`、`resist`、`vulnerable`、`immune` 和 `conditionImmunities`。
- **从自己的池中支付。** 池以满额开始，生物为列表提供的行动消耗它们；无论由 Engine 还是 Game Master 决策，都会像队友一样获得更大额支付的选项(用更高法术位施法)。守卫的 Hold the Line 消耗 Luck。
- **使用伤势轨道时，生命就是轨道。** 打击先应用 `resist`、`vulnerable` 和 `immune`，再按 `damageKinds` 标记生物自身轨道，因此免疫某种伤害的生物不会因它获得标记。
- **它仍是敌人。** 降到零时出局而非濒死，从不作死亡豁免；画面显示原本就会展示的敌人信息，不显示其人物卡。即便有同名角色，也不会将它的消耗写回任何地方。
- **计算结果完全没有生命的人物卡**会被排除出战斗，并在开场日志说明原因，不会作为无人能伤害的存在入场。
- 如果某层从枚举字段中移除一个值，使用该值的生物不会因此丢失：该层启用期间，该字段和角色一样读作默认值，不会因此拒绝生物。
- Game Master 也可以创作一个，并按其档位约束(见“无人预先编写的敌人”)。
- 提供这种生物的包须声明 Capability API 1.34。

5e 草案的 Toll Sergeant 在 d20 人物卡上采用相同做法：其 Armor Class、生命、豁免，以及每行动两次挥击，都来自自身字段和攻击列表。

#### 无人预先编写的敌人

Game Master 创作敌人时，Engine 会在任何投骰发生前，将提案拉回你的 `threat` 尺度：生命限制在该档区间内，防御、命中和豁免难度最多高于该档自身值 2 点，并持续降低伤害，直到生物的最佳一轮(最强动作序列或最强单个行动，按一个目标衡量)落入该档的 `damagePerRound`。它先减少骰子数量，再减固定值，再从序列减少一次打击，最后才缩小骰子面数，绝不减到什么都没有。规则集不存在的名称会丢弃，包括未知伤害类型、状态和豁免，以及前六个之后的所有行动。未声明的档位回退到尺度最底档。每次更改都返回一句易懂的话，因此日志可以说明做了什么。

创作的敌人也能像图鉴生物一样写成 `sheet`，这让即兴创造的法师获得法术位和法术。Game Master 会看到人物卡 ID 及各项允许的值、战斗读取的列表，以及目录为这些列表提供的名称，因此法术按名称指定，而非用描述代替：凡是指定目录条目的行，不区分大小写，都会成为该条目，再叠上 Game Master 自己的值(例如法术已准备)。因为由模型编写，人物卡会宽松读取：规则集没有的名称丢弃，值调整到字段或列允许的范围，写在人物卡旁边的数值不采用。

不是首领的创作生物，只能使用规则集向它开放的内容。带 `startFrom` 的目录筛选器指定组织条目的人物卡字段(5e 包的法术列表按 `class`)；创作生物只保留筛选器匹配自身该字段值的条目，匹配方式与选择器按它打开时相同。因此 Sorcerer 永远不会获得整个法术列表，未指定职业的生物也不会从按职业组织的目录中得到任何内容。之后，无须再询问 Game Master，就会填补尚未作出的选择：对于只有选中后行才有效的每个列表(战斗能力来源带有 `onlyWhen`)，从向它开放且能用自身池支付的条目中，为每个现有池补足少量条目(能力越高的生物越多)，也补足能随意使用的条目。获得的内容受它战斗时同样使用的性情与能力影响：保护型或支援型选择支撑己方的内容，鲁莽型选择伤害，条理型或耐心型选择牵制敌人的内容；能力越高，越可能携带反应、反制或其他改变回合的效果。抽取使用战斗自身的种子，因此同一战斗总会以相同方式填充。Game Master 在这类列表中按名指定的行视为已选中。

首领可能是例外，因此完全由 Game Master 编写：不会删去任何内容，也不会填补任何内容。

之后，两者都按档位约束：

- 通过生命读取自的唯一字段，将生命调整到档位区间。池的最大值要么直接是该字段，要么是恰好包含一个字段的 `sum`(5e 的最大生命、Ember Roads 的 Toughness)。不含单一字段的生命公式保持原样，并在日志中说明。伤势轨道长度由你决定，永不更改。
- 生物构建完成后，将防御、命中和豁免难度限制为最多高于档位自身值 2 点，并降低伤害，直到计入它所能负担的最大支付后，其最佳一轮仍处于该档 `damagePerRound` 内。先削减更大支付带来的增量，再减骰子、固定值、一次打击，最后才缩小骰子面数。

你自己的生物图鉴永远不会被限幅。那是你编写的数据，所以 Engine 按原样采用。

### 位置：棋盘上的战斗

在你的块声明棋盘每格代表多远之前，战斗都靠想象进行。声明 `distance` 后便可在网格上作战，此时移动、触及、射程、范围、视线、掩护，以及对走开者的打击才开始有意义。每项数值都由你写下，Engine 只提供棋盘。

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2 },
"opportunity": { "budget": "reaction" }
```

Ember Roads 只声明其中一行，没有其他内容，这正说明其余部分均非必填。

```json
"distance": { "label": "paces", "perCell": 2 }
```

**格子。** `distance.perCell` 表示一格相当于你自己单位的多少，`label` 是该单位的名称。块所在世界中的所有距离都用它：`economy.movement`、生物的 `speed`、武器的 `reach` 和 `range`，以及生物行动的 `reach` 和 `range`。声明了自身 `units.distance` 的目录，用自己的 `perCell` 转换 `mechanics.range` 和 `area.size`；没有声明的目录则用这里的设置。大于零的距离会舍入到最近格数，但绝不舍入成零，因此任何有正数距离的内容至少触及一格。零不是短距离，而是保留自身含义：`mechanics.range` 为 0 表示自身或接触(接触别人可以触及邻格)；武器行的 `reach` 或 `range` 列为 0，则表示该行没有这种距离。

**是否使用棋盘。** 两个条件必须同时满足：你的块声明了 `distance`，且玩家游戏设置为 Tactical 战斗样式。使用 Classic 样式或规则集未声明 `distance` 时，战斗与以前一样靠想象进行：任何人都可以指向任何人，完全不读取下面的内容。

**玩家看到什么。** 棋盘会绘出 Tactical 样式自身的地形。每格都是可用指针或方向键访问的按钮，说明它是什么、谁在上面，以及尚未完成的选择如何影响它。行走时会点亮菜单提供的格子，每格以你自己的单位标出费用，绘出到达路径，并将路径中有人会出手攻击的格子标为琥珀色，在棋盘下方列出攻击者。需要目标的选项会在棋盘和列表中同时高亮可选对象。带 `area` 的选项瞄准格子，指针下的格子会说明将卷入谁，包括友军。剩余移动额度显示在行动额度旁边，也使用你的单位。画面不自行测量任何内容：每个格子、费用、路径、目标和瞄准位置都由服务器发送。

**移动。** 每回合的移动额度，队友取 `economy.movement`，生物取自己的 `speed`，除以 `perCell` 后向下取整；但只要还能移动，就至少为一格。额度在持有者自己的回合开始时补满，可在行动前、行动间和行动后使用：走动、攻击、再走动。踏入一格费用为 1，崎岖地面则更高。八个方向的费用相同，因为这正是所面向的桌面网格玩法。可以经过友军，但不能停在任何人的格子上；敌人视作墙；不能进入实体障碍，也不能从两个实体格之间斜切墙角。

**触及与射程。** 武器行从 `combat.attacks[].reach` 和 `.range` 获取它们，各自可以是同一列表中的列，或对每行相同的数值：

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

某列在一行读作 0，表示该行没有这种距离，这让普通剑能和投掷斧放在同一列表。完全没有触及距离的行可触及一格。生物行动使用自己的 `reach` 或 `range`，目录能力使用 `mechanics.range`(0 表示自身或接触，指向别人时为一格)。

两者都有的行是投掷武器：触及范围内为挥击，超出后为射击。因此，下述射击规则不会影响拿在手中的挥击；它还能打击经过的人，而弓不能。

生物行动还可以携带其落点 `area`，使用你自己的单位：`{ "shape": "cone",
"size": 15 }`，并用 `"friendlyFire": false` 放过己方。这让吐息武器成为棋盘上的真实锥形，而非一个目标数。序列不带自身形状，由它指定的各行动分别携带。没有棋盘的战斗会忽略形状，使用 `targetCount`，所以生物条目可以两者兼有，并在两种情况下都准确表达。

**形状能送到多远。** 由 `range` 指定：投到一百英尺外的球需要射程。没有射程时，爆发在放下的位置、即行动者自己的格子生效；锥形或直线则可以瞄准所画长度内的任何位置，因为此时格子只表示方向。这既适用于生物，也适用于目录条目的 `mechanics.area`。

`ranged` 说明超出普通 `normal` 距离射击，或邻格有敌人时射击的代价。两项都可为 `"disadvantage"` 或 `"normal"`；省略整个块，则两者都没有代价。挥击永远不是射击，所以两条规则都不影响它；在自身触及范围内使用的投掷武器也一样。

**范围。** 条目的 `mechanics.area` 成为棋盘上的真实形状，瞄准格子而非某个人，`targetCount` 对此没有意义：触及多少人由形状决定。除非条目指定 `"friendlyFire": false`，否则格子中的所有人都会卷入，不分敌友。

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

爆发包含瞄准格周围大小范围内的每一格。锥形从行动者朝该格延伸，每一步的宽度等于其距离。直线朝同一方向延伸，宽一格。三种形状遇到实体障碍都会停止。

**视线与掩护。** 以两者之间的直线格子判断：任何实体障碍都会阻挡射击并阻止范围扩散到其后，目标也就不会出现在菜单上。有掩护价值的地形会为攻击所对抗的防御增加 `cover.bonus`，日志会说明。没有四分之三掩护、全掩护或高低差。

**打击走开的人。** 声明 `opportunity.budget` 后，如果参战者走出某个站立、可行动、持有该额度并有近战手段的敌人的触及范围，行走会停在当前位置，询问该敌人是否攻击。选择攻击则消耗额度，并与其自己回合的同一攻击完全一样地结算；放行不消耗任何内容。不论哪种情况，之后行走都从暂停处继续，支付实际经过的每格费用；如果打击让移动者倒下，行走就在倒下处结束。整次行走对每个敌人只给一次机会，无论路径反复离开同一触及范围多少次。`disengage` 在本回合余下时间阻止它；未声明 `opportunity` 的规则集完全没有这一机制。

这次询问就是一个窗口，会暂停整场战斗：被询问者全部回答之前，其他任何内容都不推进。队友的窗口由玩家回答，旁边提供攻击和 Pass；其他人的窗口由其操作者回答，Game Master 所扮演的首领则通过 Game Master 自己的决策回答。见下文“窗口”。

**敌人如何使用棋盘。** 没人操控的敌人会将每个可达格与从那里可用的每个选项组合评估，为行走中会遭遇的每次打击扣分；若当前格已经可以做到最佳，就倾向于不移动。没有任何目标在范围内时，它会靠近；若 `standard` 列表有 `dash`，就先疾走。

**可能看到的拒绝原因。** `out-of-reach`(超过触及范围)、`no-line-of-sight`(中间有实体障碍)、`unreachable`(无法支付行走费用或不能停留的格子)，以及 `bad-cell`(将形状瞄准不允许的位置)。

### 服务器如何用你的块处理战斗

规则集声明了 `combat` 的游戏，会在 Engine 一直使用的同一份已保存战斗中，按该块结算：

- **谁参战。** Game Master 指定参战者，Engine 从每位队友自己的人物卡读取数值。没有该规则集人物卡的成员会按名拒绝，不会给它你没写过的数值。
- **敌人数值的来源**按以下顺序：Game Master 在图鉴中指定的生物；标签与敌人自身名称匹配的生物；Game Master 为本场战斗提议、并经限幅拉回威胁尺度的数值块；最后是用档位自身数值构建的普通生物。每次回退和限幅都以易懂的话记录，让战斗能说明做了什么。如果规则集既没有图鉴条目、没有提案，也没有威胁尺度，就拒绝战斗，不会凭空创造敌人。
- **人物卡就是记录。** 每个接受的行动之后，生命、池、状态、专注以及濒死规则的计数都通过人物卡自身规则写入。因此战斗中途重新加载也会准确显示战斗留下的结果，不存在可能与它冲突的战后结算总账。
- **菜单是合法性的唯一依据。** 所有行动者，无论玩家还是敌人，都从你的块生成的同一菜单选择 ID。Engine 扮演的敌人用 Engine 自己的战术选择；Game Master 扮演的敌人则被要求从同一菜单选一个 ID，能看到你的数值，却不会被告知骰子将产生什么结果。
- **你的骰子。** 战斗持有自己的种子和游标，因此从磁盘读回后，会继续使用原本将投出的骰子序列。

### 屏幕显示

战斗画面使用你的措辞。菜单包含你的攻击、能力和列出的标准行动，每项说明从你的行动额度和池中消耗什么。行动顺序、轮次、你命名的每种状态及剩余轮数、临时点数、专注，以及濒死规则的两项计数都会显示。日志按你的术语打印真实算式："Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." 每个接受的行动都会立即写入人物卡，因此中途重新加载也精确无误，之后还会告知 Game Master 不要再次修改这些数值。

有位置的战斗绘制在棋盘上，而非立绘舞台上；玩家如何操作见“位置”。棋盘、菜单和日志中的每个距离都使用你的单位："Juno moves to 4, 6 for 6 paces and has 2 paces left."

### 窗口：让战斗等待

有些时刻属于当前行动者之外的人。Engine 会为其保留战斗、等待选择，而不是代为决定；这段暂停就是窗口。

四种情况会打开窗口，其中两种来自你已经声明的内容：

- **有人脱离。** 行走离开可以攻击的敌人触及范围时，在那一步停下并询问敌人。见上文“打击走开的人”。
- **一回合与下一回合之间。** 回合结束后、下一回合开始前，会询问所有持有 `signaturePoints` 且能负担自身某个 `signature` 行动的敌人是否购买一次。这是唯一能购买的时刻：招牌行动不在任何人的回合菜单里，包括它自己的菜单。
- **某个效果指向某人。** 在结算前，会询问被指向的对方阵营中，所有持有等待此刻条目的人。友军治疗你并不是需要应对的威胁，因此友军行动不会打开窗口。
- **某个效果伤害了某人。** 结算后，无论是谁造成的，都会询问所有受伤且持有等待此刻条目的人。受伤是发生在你身上的事实；但反指向伤害来源的条目仍不能指向友军。

最后两种情况由目录条目通过指定所等待的时刻来请求。

无论由什么打开，窗口都会这样运作：

- **窗口打开期间，其他任何内容都不推进。** 当前回合的行动者、回合结束、其他窗口都不能推进。战斗等待。
- **按行动顺序逐个询问，每人只问一次。** 放弃始终是有效答复，不收费用。如果轮到的人没有可用选择，就直接跳过，不再询问。
- **从暂停处精确恢复。** 行走继续完成剩余格子，并支付实际经过的每一格。
- **谁操控，谁回答。** 自己队友的窗口由你回答，菜单中选项旁会有 Pass；敌人由其操作者回答，Game Master 的首领通过 Game Master 回答，放过这个时机也是可选答复之一。
- **随战斗保存。** 行走中关闭游戏，回来后仍是相同的人等待询问、相同的格子等待行走。

前两种不需要额外声明：带 `opportunity.budget` 的规则集获得其中一种，带 `signaturePoints` 的图鉴获得另一种；两者都没有的规则集从不会看到它们。

**声明条目等待哪个时刻。** 将 `mechanics.reaction` 写成对象，而非 `true`：

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` 为 `aimed` 或 `harmed`，决定将条目放入哪个窗口菜单。Engine 只监听这两个时刻。仍然只写 `"reaction": true` 的条目，仅表示不在回合内执行，不足以将它放入任何位置，所以仍不上任何菜单。
- `at` 为 `source`(默认)或 `chosen`。`source` 将执行内容指向引发该时刻的人，并填入目标，无须任何人再选；`chosen` 则保留条目自己的目标设置并询问。
- `cancels` 阻止窗口保留的事情发生。只有 `aimed` 条目能指定它：已经发生的时刻不能撤销。

也请指定 `budget`，否则消耗列表默认额度。反应几乎总是使用自己的额度，这正是阻止一个回合内使用多次的机制。

**询问任何人之前，费用就已经支付。** 取消行动阻止的是事情发生，不是撤销购买：额度和池已经消耗。如果你的系统会退款，目前还无法表达。

指定时刻的包需要 Capability API 1.33。

### 尚未支持

在此明确列出，因为规则集不应声称 Engine 会做尚未支持的事：

- **超出简易棋盘的内容：** 没有四分之三掩护、全掩护、高低差、飞越障碍、挤过狭处、坐骑、擒抱或推撞造成的移动、躲藏或突袭，也没有任何效果会把人推到别处。
- **条目只能等待 `aimed` 和 `harmed` 两个时刻**(见上文“窗口”)。这是 Engine 为条目感知的时刻；另外两种窗口，即有人脱离和两回合之间的暂停，由战斗本身打开，并不是条目可以请求的时刻。没有豁免投骰、施法本身、死亡、回合开始或坠落时刻。
- **不会连锁。** 战斗保留一个窗口，而非窗口栈，因此窗口内发生的事情不会再开另一个窗口：反制不能再被反制，反应造成的效果也不会打开后续时刻。
- **反应能阻止某事或执行某事，但不能修改其数值。** 由于状态是封闭列表中的名称而非调整值，所以无法表达“直到你的下回合前更难命中”。这是状态的限制，不是反应的限制。
- **没有退款。** 被取消行动的费用已经消耗。
- 状态只能实现封闭效果列表所表达的内容。使属性检定获得劣势的状态，或像力竭那样逐级恶化的状态，目前只是人物卡上的普通记录。
- **直接用数值编写的生物没有伤势轨道。** 即使规则集用轨道表示生命，这类生物仍然扣点数；给它 `sheet` 后，受到的打击才会先应用自身 `resist`、`vulnerable` 和 `immune`，再标记格子。
- **附加效果自行触发。** `on` 只有 `hit` 一个值，因此周期内第一次符合条件的命中就使用它，不存在询问是否消耗的时刻。

## 层：规则集自身的变体

层是规则集的具名变体，由玩家创建游戏时开启，例如 Low magic、Hard winter，或更残酷的难度。层位于规则集文件的可选 `layers` 数组中，因此随文件一起流转，不会从使用过它的游戏中丢失。向导在规则集下将其显示为开关，选择与规则集本身一样，在游戏整个生命周期中固定。

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**层能做什么。** 列表是封闭的，每个效果要么缩小范围，要么添加文本：

- `gm.guidance` 追加到 `gm.checkGuidance`，位于你自己的文本及任何先前层之后。`gm.worldGuidance` 以同样方式追加到 `gm.worldGuidance`。
- `fields` 从 **enum** 字段移除值。`removeValues` 指定字段已有的值，必须至少保留一个；若字段的 `default` 也被移除，层须指定一个仍保留的 `default` 代替。
- `difficultyLadder` 以另一套梯度替换原梯度，形状须符合自身的结算类型：`dice-sum` 用 `{label, dc}`，`dice-pool` 用 `{label, successes, target?}`。它接受与原梯度完全相同的验证。若多个启用层都声明了它，最后一个优先。
- `catalogs` 从人物卡编辑器选择器中隐藏条目。每条规则指定该目录已声明的某个 `filters`，以及恰好一种比较：`number` 筛选用 `above` 或 `below`，`text` 或 `tags` 筛选用 `equals` 或 `notIn`。完全没有设置该筛选项的条目永不隐藏。

**层不能做什么。** 不能添加枚举值、字段、技能、池或休息，不能改变结算类型、触及实时状态或战斗数值，也不能增加模型调用。层所_添加_的值，对人物卡的其他读取者都会是未知值，因此只能移除值。超出这份列表的内容，应当修改规则集本身，或成为第二个规则集。

**冲突。** `conflicts` 指定不能同时开启的层。只在成对关系的一侧声明就够了。向导会禁用另一个开关；如果保存的选择不知为何包含两者，就丢弃声明**较晚**的那个，因此相同的两个选择总会得到相同规则。

**已经持有被移除值的人物卡会保留它。** 不会重写角色。编辑器只是停止提供该值，而已经拥有它的角色仍按原值显示。在新游戏中关闭该层后，该值又能选择。隐藏的目录条目也一样：只从选择器中排除，玩家已经选择的行仍留在人物卡上。

**限制。** 每个规则集最多 12 个层，每层两段指引字符串合计最多 4000 字符。声明 `layers` 或基础 `gm.worldGuidance` 的打包规则集需要 Capability API 1.25。导入的规则集由读取它的 Engine 验证，因此不需要这项声明。

**其他人编写的层**(例如为不是自己编写的规则集提供独立文件的 Low Magic 层)会在以后添加。目前层随其所属规则集一起提供。

<a id="trying-your-ruleset"></a>

## 试用你的规则集

社区规则集使用与导入智能体相同的开关。打开 **Settings**(设置) > **Advanced**(高级) > **Danger Zone**(危险区域)，确认 **Allow custom Agent imports**(允许导入自定义智能体) 已开启。导入还需要 localhost 访问，或已配置的 **Admin Access**(管理员访问)。

1. 打开 **Agents**(智能体) 面板，选择 **Import agents**(导入智能体) 按钮，即面板顶部按钮行中的下载图标。
2. 选择 **Game Mode ruleset**(Game Mode 规则集)，再选择 JSON 文件。
3. 阅读审核信息，其中包含名称、版本、许可证、规则集覆盖范围，以及 Game Master 文本。选择 **Import**(导入)。

规则集会出现在面板的 **Rules**(规则) 区域，以及新游戏设置向导的 **Rules** 选项中。文件导入的规则集归为 `local/<your id>`，因此绝不会与官方规则集或别人的规则集混淆。

### 修改已导入的规则集

已经导入的版本永不重写。如果更改文件后仍以相同 `version` 再次导入，会被拒绝，并要求提高版本号。这是有意设计的：游戏绑定创建时的精确版本，因此进行中的战役不会突然使用不同的计算方式。

所以起草时的循环是：编辑、提高 `version`、导入、开始新游戏。旧版本会与新版本并列安装，直到你从 **Rules** 区域移除规则集。移除仍被游戏使用的规则集后，该游戏会提示规则集缺失，直到再次导入。

如果改变了人物卡结构(添加、删除或重命名内容)，也请提高 `sheet.version`。现有人物卡会宽容读取：新人物卡不认识的值会保留，缺少的值使用默认值。

## 分享你的规则集

**作为文件。** 将 JSON 文件发给朋友，对方按相同方式导入即可。

**通过 GitHub 仓库。** 如果将作品保存在公开 GitHub 仓库，请把每个规则集放在仓库顶层的 `rulesets` 文件夹中，每个规则集一个文件：

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

用户通过自定义智能体仓库列表添加你的仓库一次，审核内容后，便可在以后同步获取新版本。自定义仓库列表是高级功能，需要服务器运营者使用 `ENABLE_CUSTOM_AGENT_REPOS=true` 开启。仓库中的规则集归到仓库所有者名下，例如 `alice/ember-roads`，所以两个作者都能发布名为 `v20` 的规则集而不冲突。

有两项限制。仓库的 `rulesets` 目录下最多直接存放 32 个 JSON 文件，超过则拒绝该仓库。名为 `local` 的账号不能发布规则集，因为 `local/` 保留给从文件导入的规则集。

**进入官方目录。** 广泛游玩且授权明确的系统，可以通过 **Download Agents**(下载智能体) 提供给所有人。这需要向 [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 仓库提交拉取请求。布局请参考其中的 `ruleset-5e-2014` 包。

## 授权许可

只发布你有权分享的规则文本。许多系统会按开放许可证发布参考文档，你可以复制的是该文档。将许可证 ID 及许可证要求的署名文本放入 `license`。不要从非开放授权的规则书复制文本。规则集主要需要名称和数值，Game Master 文本应使用你自己的措辞。

## 故障排查

- **导入提示某个名称不存在。** 文件中某处引用了未声明的 ID，例如技能引用已删除的属性。消息会给出该位置的路径。
- **导入提示同一版本已安装但内容不同。** 提高 `version` 后重新导入。
- **设置向导中没有我的规则集。** 检查 **Allow custom Agent imports** 是否开启。关闭时，导入的规则集不会提供给新游戏；已经使用它的游戏仍继续工作。
- **游戏提示规则集缺失。** 没有安装游戏创建时所用的精确版本。请重新导入该版本文件。
