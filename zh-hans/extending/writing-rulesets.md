# 编写 Game Mode 规则集

规则集告诉 Game Mode 桌面系统如何运作：检定掷什么骰子、人物卡有哪些内容、消耗哪些资源，以及休息恢复什么。本指南面向希望自行编写并分享规则集的人。若要游玩别人制作的规则集，请先阅读[选择规则](../game/getting-started.md#choosing-rules)。

规则集是一个 JSON 文件，是数据而非代码，其中没有任何内容会运行，因此导入不会在你的电脑上执行任何操作。导入他人的文件前，值得仔细阅读的部分是 Game Master 文本，因为每场使用该规则集的游戏都会将它发送给模型。

## 先读这里：规则集能做什么、不能做什么

规则集只能填写 Engine 已理解机制中的空项。当前 Engine 有五种检定结算方式，文件通过 `resolution.kind` 选择：

- **`dice-sum`**：掷骰，加上人物卡数值，达到或超过难度。适用于 d20、2d6 加属性等许多系统。
- **`dice-pool`**：掷出角色数值对应数量的骰子，数出达到目标的骰子。适用于评级代表一把骰子而非加值的系统。

- **`dice-highest`**：掷一个骰池并读取其中最高的一颗，或把最高的几颗相加。适用于 Blades in the Dark 和 Trophy Dark。
- **`roll-against`**：掷出不超过（或不低于）人物卡数值的结果。适用于百分制技能和 GURPS 检定。
- **`symbol-pool`**：组建并升级叙事骰，再抵消对立的符号。适用于 Genesys 检定。

五种类型都在[结算类型](#resolution-kinds)中完整说明。

不符合这些形式的机制无法写进规则集文件，对抗骰池就是一例。每种这样的机制都需要 Engine 内新增结算类型，也就是带测试的代码贡献，而非 JSON 文件。若系统需要，请在 Engine 仓库提出功能请求，用几个演算完整的掷骰例子说明机制。这些例子会成为测试。

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
| `items` | 可选，书写物品所用的词汇：类别、稀有度、数值、槽位和货币。 |
| `battle` | 可选，战斗可从人物卡读取什么，以及结束后写回什么。 |
| `combat` | 可选，如何按自身规则结算战斗，以及战斗界面执行什么。 |
| `layers` | 可选，玩家创建游戏时启用的规则集变体。 |

文件最大 512 KB(Capability API 1.340 之前为 256 KB)。会进入提示词的文本(名称、标签、Game Master 文本)不能包含换行、方括号或双花括号。

人物卡内的 ID(属性、技能、字段、池等)以字母开头，使用小写字母、数字和下划线，例如 `grit_max`。

<a id="resolution-kinds"></a>

### 结算类型

`resolution.kind` 选择检定如何掷骰。每种类型都读取相同人物卡，共享三个键，因此切换时 `resolution` 以下的文件部分不用改变：

- `abilityModifier`：人物卡分值如何变成一个数字。`identity` 表示直接使用分值；`floorHalfMinusTen` 是 5e 规则；`stepTable` 允许用 `[[score, number], ...]` 列出自己的阈值。
- `proficiencyTiers`：技能或豁免的训练等级。未列出的技能使用第一档。每档增加 `flat`、熟练加值的 `multiplier` 倍或两者都有。如果系统有熟练加值，用 `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }` 指定来源。
- `proficiency`：可选，仅乘算档位需要。

结果数字的含义由类型决定：`dice-sum` 把它加到掷骰上，`dice-pool` 和 `dice-highest` 掷出相应数量的骰子。`symbol-pool` 把属性和训练分开，用来组建并升级叙事骰。

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
- `dice.faces`：每个骰面代表的值，从最低面开始列出，用于骰面并非其本身数字的骰子（Capability API 1.136）。Fate 的四颗 Fudge 骰写作 `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`：骰子卡显示 −、空白和 +，并把它们相加，概率与 Fate 完全一致。每个骰面给一个值。
- `openEnded`：会继续往上掷的单颗骰子（1.136）。点数达到或超过 `high` 时再掷一次并相加，新骰子显示 `high` 或更高时继续掷；点数不高于 `low` 时再掷一次并减去，这次掷骰同样会在 `high` 上继续连锁。Rolemaster 的开放式百分骰写作一颗 d100 上的 `{ "high": 96, "low": 5 }`。一次掷骰最多掷 20 颗骰子。骰子的自然点数和结果档的偏移，都读取第一颗骰子。
- `unmodified`：单颗骰子的若干点数，第一颗骰子显示这些点数时，记录会加以标记（1.136），这样就能应用那些单独处理“未修正的 66”的表：`[66, 100]`。记录写明 `unmodified="66"`，骰子卡也会显示，Game Master 会被告知按规则对它的规定处理。
- `difficultyLadder`：向 Game Master 提供的难度候选。`dc` 是总和必须达到的数字。Game Master 也可以不写数字，而是直接点名某一档，如 `difficulty="Hard"`，Engine 会从该档读出数字。

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
  "pool": { "min": 1, "max": 15, "abilityPlusAbility": true },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10, "min": 8 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "reroll": [{ "id": "careful", "upTo": 6, "mode": "once" }],
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`：骰池中每颗骰子的面数，2 到 100。
- `pool`：任何爆骰发生前，人物卡数值被限制到的范围。`min` 为 0 时，空池可以完全不掷骰就失败；`max` 最高为 100。`abilityPlusAbility: true` 允许属性检定用 `with=` 指定第二个属性并把两者一起掷出，适用于同时掷两个属性的系统；没有它时，`with=` 对属性检定没有意义。
- `target`：骰子计为成功需要达到的点数。将 `min` 设为低于 `max`，允许 Game Master 用 `threshold=` 逐次调整；三个值相同则固定。
- `double`：可选，点数达到或超过 `from` 时计两次。
- `explode`：可选，达到或超过 `from` 时多掷一颗，新增骰也可继续爆骰。额外骰在原骰池之外最多 `pool.max` 颗，因此单次检定最多掷两倍 `pool.max`，较低的 `from` 也不会无限掷下去。
- 两者都可以带 `min`：检定能把该规则下调到的最低点数，通过标签上的 `explode="N"` 或 `double="N"`，或角色使用的条目来调整。有 `min` 时可以省略 `from`，此时只有提出要求的检定才会触发该规则：只让某一项技能的十点再掷一次的专长写作 `"explode": { "min": 10 }`。`from` 不能低于 `min`。
- `cancel`：可选，点数不高于 `upTo` 时减去一次成功，成功数不低于零。
- `botch`：可选，**没有任何**骰子成功，且出现不高于 `upTo` 的点数时为大失败。唯一一次成功被抵消的骰池是普通失败，不是大失败。`"rule": "halfOrMore"` 换一种读法：首次掷出的骰子（不计爆骰）中至少一半点数不高于 `upTo` 时，若没有骰子成功就是大失败；否则结果照常成立，并标记 `complication="true"`，表示同时出了岔子。默认值是 `"noSuccesses"`。
- `exceptional`：可选，成功的检定净成功数达到此值或更多时为大成功。
- `situationalDice`：可选，Game Master 为特技、伤势或昏暗照明等情境，用 `bonus=` 对单次检定增减骰子的范围。
- `reroll`：可选，系统免费给予的重掷，最多六项，每项有一个 `id`，Game Master 在检定中用 `reroll=` 点名。点数不高于 `upTo` 的骰子会再掷一次：`"once"` 表示新点数无论是多少都保留，`"until"` 则一直重掷到点数更高为止。`upTo` 取 1 到骰子面数减一，因为重掷所有点数永远不会停下；`until` 在单次检定重掷一百次后也会停止。检定不点名就不会重掷。一次检定只进行一次重掷：如果角色的消耗或使用的条目也买了一次，就采用覆盖点数更多的那一次，覆盖相同时 `until` 优先于 `once`。
- `difficultyLadder`：`successes` 是要求的成功次数。某一档也可指定 `target`，但仅当目标可调且在范围之内时有效。该档的检定就按这个目标计数：Game Master 用 `difficulty=` 点名该档时，或者写下恰好只有一档需要的 `dc=` 时。如果几档需要相同的成功次数，单靠 `dc=` 无法说明指的是哪一档，目标就保持默认；请点名该档。

- `target.from`：可选。从每个角色的人物卡读取其目标，就像 Lasers & Feelings 中由角色一次性选定的 Number(任意值引用：属性、字段、派生值)。它被限制在 `min`..`max` 之内，`threshold=` 不会移动它，因为这个数字是角色自己的；但角色所用条目买来的阈值仍然有效。记录的 `threshold=` 会说明实际使用的值。
- `stances`：可选。最多六种，每种有 `id`、`label`、`count`(`"below"` 或 `"above"`) 以及它涵盖的 `skills`。对其中某项技能的检定改为计数**低于**目标或**高于**目标的骰子，而不是达到或超过目标的骰子：Lasers & Feelings 就是一个计数低于目标的 Lasers 姿态和一个计数高于目标的 Feelings 姿态，每项技能归入其中之一。一项技能只能属于一种姿态。姿态不使用 `explode`、`double`、`cancel` 和 `botch`，因为这些规则按“达到或超过”读取。
- `exact`：可选。恰好等于目标点数的骰子：`label` 为其命名（`"LASER FEELINGS"`），`text` 可以说明它在牌桌上的作用；除非 `counts` 为 `false`，否则它计为一次成功。记录带有 `exact="N"`，即这类骰子的数量，骰子卡会在结果旁显示它，让 Game Master 能给予玩家它所换来的洞察。

`cancel` 和 `botch` 的点数必须低于最低目标，所有规则指定的点数必须实际存在于骰子上。永远无法触发的规则会在导入时被拒绝，而不是等游玩时才发现。

打包形式的骰池规则集要求 Capability API 1.24；`explode` 或 `double` 上的 `min`、`pool.abilityPlusAbility` 和 `botch.rule` 要求 1.37；`reroll` 要求 1.38；`target.from`、`stances` 和 `exact` 要求 1.137。导入的社区规则集由读取它的 Engine 验证，无须另行声明。

#### Game Master 可以在骰池检定中写什么

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc` 是所需**成功次数**，不是目标点数。范围为 1 到一次掷骰理论上最多可计的成功数：骰池最大值，允许爆骰时翻倍，点数可计两次时再翻倍。
- `threshold=` 调整单骰目标，仅在 `target.min` 小于 `target.max` 时提供。
- `bonus=` 增减骰子，仅在声明 `situationalDice` 时提供。
- `with=` 用其他属性替代技能或豁免原有属性。两种类型都支持，因此 5e 的 "Strength (Intimidation)" 也使用同一属性表达。在 `pool.abilityPlusAbility` 开启时，它在属性检定上改为追加第二个属性。
- `difficulty=` 在两种类型上都可以代替 `dc=` 点名难度梯度的某一档：取该档的成功次数（求和检定则取其难度），骰池检定还会取该档的目标。同时写下的 `dc=` 仍决定数字，`threshold=` 仍决定目标。没有任何一档对应的名称，或两档共用的名称，会被忽略。
- `explode=` 和 `double=` 为本次检定调整这两条规则的点数，仅在规则带 `min` 时提供。
- `reroll=` 为本次检定点名某个 `reroll` 项，仅在你声明过重掷时提供。没有任何一项对应的名称会被忽略。

所有值都受文件声明约束：越界值会拉回最近边界，规则集未提供的属性则忽略，而不拒绝检定。保存记录显示实际使用的值：以数字表示的难度和阈值、限制后的奖励骰；只有实际替换或追加属性时才保留 `with=`，只有检定实际调整过点数时才显示该点数，只有它点名的重掷正是实际进行的那一次、且确实重掷了骰子时才保留 `reroll=`；`halfOrMore` 大失败在结果之外出了岔子时会记下 `complication="true"`。Engine 始终自行掷骰，替换模型填写的骰池结果；该类型没有优势，因此忽略 `mode="advantage"`，玩家在回合前自行掷出的骰子也不适用。

#### `dice-highest`：掷骰并读取最高的一颗

Blades in the Dark 和 Trophy Dark 掷一把 d6，只读取其中最高的一颗。Capability API 1.138。

```json
"resolution": {
  "kind": "dice-highest",
  "die": { "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "rating_0", "label": "0" }, { "id": "rating_1", "label": "1", "flat": 1 }],
  "pool": { "min": 0, "max": 6 },
  "zeroDice": "lowest-of-two",
  "critical": { "count": 2 },
  "situationalDice": { "min": -1, "max": 2 },
  "difficultyLadder": [{ "label": "Partial", "dc": 4 }, { "label": "Full", "dc": 6 }],
  "outcomes": {
    "by": "total",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "full", "label": "Full success", "atLeast": 6, "success": true },
      { "id": "partial", "label": "Partial success", "atLeast": 4, "success": true, "text": "You do it, with a consequence." },
      { "id": "bad", "label": "Bad outcome" }
    ]
  }
}
```

- 人物卡数值就是骰子数量，与骰池相同，限制在 `pool` 之内（最多 20）。伤势、`adjust`、状态和物品会增减骰子。
- `keep`：可选，1 到 3，默认为 1。把最高的几颗骰子相加：1 是 Blades，2 是 Trophy Dark 的战斗。
- `zeroDice`：没有骰子的角色怎么办。`"lowest-of-two"`(默认) 掷两颗取较低者，且永远不会算作大成功；`"fail"` 不掷骰直接失败。
- `critical`：可选。`count` 颗骰子显示最高面（或 `face` 及以上）即为大成功：Blades 的两个六。
- `dark`：可选，Trophy Dark 的暗骰。含 `label`、`max`(1 到 10) 和 `text`。Game Master 用 `dark="N"` 把它们加入一次检定。`outcome` 默认为 `"all"`：暗骰与其余骰子一起读取。设为 `"outcome": "light"`(Capability API **1.149**) 时，只有明骰决定保留的骰子、总和、结果档和大成功。没有明骰时，对明骰一方应用 `zeroDice`：掷两颗明骰取较低者，或直接失败，但暗骰仍照常掷出。暗骰总是最后掷出、最后记录；`darkHighest="true"` 表示有一颗暗骰严格高于每一颗明骰（包括回退时掷的明骰；一颗明骰都没掷时，任何暗骰都算胜出）。这样的代价（Ruin）由 Game Master 施加。声明 `dark.outcome`，即使值为 `"all"`，也要求 capabilityApi 1.149。
- `situationalDice`：可选，Game Master 可用 `bonus=` 增减的骰子（协助、硬撑）。
- `spend` 只能购买骰子。
- `difficultyLadder`：带 `dc` 的各档，即保留的骰子须达到的数字。检定上的 `dc=` 就是这个数字，范围为 1 到 `keep` 乘以骰子面数。
- `outcomes` 以 `by: "total"` 从保留的骰子读取，`on: "critical-success"` 的结果档接住大成功。

记录保留求和的形式（`resolution="sum"`、`modifier="0"`，保留的骰子作为总和），并加上 `highest="1"`，适用时还有 `zeroDice="true"` 和 `dark="N"`；暗骰是 `rolls` 中的最后几颗。只读明骰的结果还会记录 `darkOutcome="light"`，因此骰子卡只高亮保留的明骰，重新加载后也是如此。这类规则集没有自己的战斗，因此与它并列的 `combat` 会被拒绝。

#### `roll-against`：掷出不超过（或不低于）人物卡数值的结果

Call of Cthulhu、GURPS 以及老派盗贼的百分比技能，都是对照人物卡上的数字掷骰，而不是把数字加到骰子上。Capability API 1.139。

```json
"resolution": {
  "kind": "roll-against",
  "dice": { "count": 1, "sides": 100 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "base", "label": "Base" }],
  "against": "at-most",
  "criticalSuccess": [{ "from": 1, "to": 1 }],
  "criticalFailure": [{ "from": 100, "to": 100 }, { "from": 96, "whenTarget": { "below": 50 } }],
  "tens": { "max": 2 },
  "difficultyLadder": [
    { "label": "Regular", "dc": 0 },
    { "label": "Hard", "dc": 0, "divide": 2 },
    { "label": "Extreme", "dc": 0, "divide": 5 }
  ],
  "outcomes": {
    "by": "fraction",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "extreme", "label": "Extreme success", "atLeast": 5, "success": true },
      { "id": "hard", "label": "Hard success", "atLeast": 2, "success": true },
      { "id": "regular", "label": "Regular success", "atLeast": 1, "success": true },
      { "id": "fail", "label": "Failure" },
      { "id": "fumble", "label": "Fumble", "on": "critical-failure" }
    ]
  }
}
```

- 检定所用的人物卡数值就是目标。技能的百分比就是人物卡上该技能的加值（`bonusRange` 最高到 100），不加属性，也不加档位加值；GURPS 的技能是其属性加上该加值。
- `dice`：掷出并相加的骰子，默认为 1d100(GURPS 为 3d6，豁免检定为 1d20)。
- `against`：`"at-most"`(默认) 在不高于目标时成功，`"at-least"` 在不低于目标时成功。
- `difficultyLadder`：每档的 `dc` 移动目标，`divide`(2 到 10) 先把人物卡数值相除。Game Master 用 `difficulty=` 指定某一档；标签上的 `dc=` 移动这个数字，范围为 -100 到 100。记录的 `dc` 是掷骰所对照的数字，记录还会写明 `against="at-most"`。
- `criticalSuccess` 和 `criticalFailure`：各最多六条规则。规则指定点数（`from`、`to`，任一端都可以不写），对于失败还可以是 `pastTarget`，即在失败一侧超出目标这么多或更多的掷骰结果。`whenTarget`(`atLeast`、`below`) 把规则限定于某些目标：GURPS 的 5 只有在目标为 15 或以上时才是大成功。大成功总是成功，大失败总是失败。
- `tens`：可选，仅用于单颗 d100。`bonus="+N"` 多掷 N 颗十位骰并保留最好的结果，`bonus="-N"` 则保留最差的结果，最多 `max` 颗。
- 在 `at-most` 掷骰上，`outcomes` 可以用 `by: "fraction"` 读取：每个结果档的 `atLeast` 去除目标，掷出不高于所得份额的结果就落入该档。`margin`(低于目标多少) 和 `total` 两种度量也同样可用。

#### `symbol-pool`：掷叙事骰并读取符号

Genesys 先用一项特征值和一项技能等级组建骰池，再加入对立骰。骰面上带的是成功、优势、胜利、失败、威胁和绝望，而不是数字。Capability API 1.141。

```json
"resolution": {
  "kind": "symbol-pool",
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained", "flat": 0 },
    { "id": "rank_one", "label": "Rank 1", "flat": 1 }
  ],
  "symbols": [
    { "id": "s", "label": "Success" },
    { "id": "f", "label": "Failure", "cancels": "s" },
    { "id": "a", "label": "Advantage" },
    { "id": "h", "label": "Threat", "cancels": "a" },
    { "id": "t", "label": "Triumph", "counts": "s" },
    { "id": "d", "label": "Despair", "counts": "f" }
  ],
  "dice": [
    { "id": "ability", "label": "Ability", "faces": [[], ["s"], ["s"], ["s", "s"], ["a"], ["a"], ["s", "a"], ["a", "a"]] },
    { "id": "proficiency", "label": "Proficiency", "faces": [[], ["s"], ["s"], ["s", "s"], ["s", "s"], ["a"], ["s", "a"], ["s", "a"], ["s", "a"], ["a", "a"], ["a", "a"], ["t"]] },
    { "id": "difficulty", "label": "Difficulty", "faces": [[], ["f"], ["f", "f"], ["h"], ["h"], ["h"], ["h", "h"], ["f", "h"]] },
    { "id": "challenge", "label": "Challenge", "faces": [[], ["f"], ["f"], ["f", "f"], ["f", "f"], ["h"], ["h"], ["f", "h"], ["f", "h"], ["h", "h"], ["h", "h"], ["d"]] },
    { "id": "boost", "label": "Boost", "faces": [[], [], ["s"], ["s", "a"], ["a", "a"], ["a"]] },
    { "id": "setback", "label": "Setback", "faces": [[], [], ["f"], ["f"], ["h"], ["h"]] }
  ],
  "success": { "symbol": "s", "needed": 1 },
  "pool": { "die": "ability", "upgrade": "proficiency", "max": 6 },
  "difficulty": { "die": "difficulty", "upgrade": "challenge", "max": 5 },
  "boost": { "die": "boost", "max": 3 },
  "setback": { "die": "setback", "max": 3 },
  "criticalSuccess": "t",
  "criticalFailure": "d",
  "difficultyLadder": [{ "label": "Easy", "dc": 1 }, { "label": "Average", "dc": 2 }, { "label": "Hard", "dc": 3 }]
}
```

- `symbols`：2 到 10 个命名符号。`counts` 在抵消之前额外计入另一种符号一个：胜利会增加一个成功，并且仍是胜利。它指定的符号不能有自己的 `counts`；链式引用和自引用会被拒绝。`cancels` 让两种符号一对一抵消，每种最多一个搭档。反向声明可写可不写。`text` 向 Game Master 解释符号。
- `dice`：2 到 8 种命名骰子，每种有 2 到 20 个面。骰面是最多三个符号 ID 的数组；`[]` 表示空白面，重复的 ID 计两次。所有引用都必须存在。
- `pool`：`larger-upgraded`(默认) 掷出属性与等级中较大数量的骰子，声明了 `upgrade` 时，再按较小的数升级相应数量的骰子。`sum` 把两者相加，不升级任何骰子。`max` 默认为 6，不能超过 12。属性使用 `abilityModifier`，所以 Genesys 的特征值请用 `identity`。等级来自技能或豁免的熟练档位；单纯的属性检定等级为零。`with=` 像其他检定一样替换特征值。人物卡加值、伤势、调整值和效果通过下文带正负号的加值，增加增益骰或挫折骰。
- `difficulty`：`dc=` 计数对立骰，从 0 到 `max`(默认 5，上限 12)。`difficulty=` 改为指定难度梯度的某一档。`upgrade="N"` 把相应数量的对立骰换成升级骰，以实际掷出的数量为限。它从不在难度之外增加骰子。
- `boost` 和 `setback`：可选，分别由 `bonus="+N"` 和 `bonus="-N"` 加入的骰子，各自最多 `max` 颗（默认 3，上限 6）。带正负号的调整先合并，再应用这个上限。Capability API **1.150** 还接受独立的 `setback="N"`：`bonus="2" setback="1"` 会同时掷两边。负的加值计入 `setback`，合并后的挫折骰数量限制在 `setback.max` 之内；增益骰仍受 `boost.max` 约束。
- `allowOwnUpgrade`：可选，缺省时为 false。设为 `true` 时，`upgradeOwn="N"` 在人物卡升级和购买的骰子之后，再把 N 颗角色骰升级为 `pool.upgrade`(必须已声明)。现有骰子全部升级后，每次额外升级会增加一颗升级骰，仍受 `pool.max` 约束。这也适用于 `pool.build: "sum"`。声明这个键，即使值为 `false`，也要求 capabilityApi **1.150**。标签参数名使用驼峰式，如 `zeroDice`；`upgradeOwn` 影响掷骰者，`upgrade` 仍只影响难度骰。`setback` 和 `upgradeOwn` 都接受非负整数，在符号骰池之外会被忽略；未启用时 `upgradeOwn` 也会被忽略。
- `success`：抵消后需要多少个该符号，默认为一个。大成功和大失败标记会在其指定符号出现时标出，即使它额外计入的成功或失败被抵消了也一样。两种标记可以同时出现，且都不改变净成功数是否通过检定。
- `outcomes` 可以读取净成功数（`total`），或 `net successes - needed + 1`(`margin`)。结果档仍按通常方式决定成败；原本的大成功和大失败符号仍会被标记。`spend` 只能在 `pool.max` 之内购买额外的基础角色骰。与 `dice-highest` 一样，不支持战斗。
- 记录保留 `resolution="sum"`，并带有 `symbols="2s 1a 1t"`、标识每颗骰子的 `thrown=`，以及保存其从 1 开始的骰面序号的 `rolls=`。编码后的 `symbolDetails` 保留标签、骰面符号以及大成功和大失败两种标记。`setback` 记录在共用挫折骰上限之后实际加入的独立挫折骰，`upgradeOwn` 记录实际应用的额外升级；被忽略或为零的增量不记录。骰子卡和摘要会写出净符号（包括空结果），而不是把骰面数字相加。覆盖可以改变这一类型的规则，但不能替换 `symbols` 或 `dice`。

#### 范围之外的机制及原因

以下机制仍需要各自的结算类型：

- **对抗骰池**同时结算两个角色，而一次检定只有一个掷骰者。
- **带狂野骰的求和骰池**(如 OpenD6) 将骰子相加并特殊处理其中一颗。

该类型过去遗漏的另外两项现在都已建模，下方“消费资源改变掷骰”说明其方式。系统自身的规则，如“花一点换一次成功”或“花一点把失败的骰子再掷一次”，是 `resolution.spend`。情境需要时系统免费给予的重掷，是上文的 `resolution.reroll`。属于角色实际选取内容的重掷，则是目录条目的 `mechanics.check`，用该条目自己的成本购买。

### 结果档：不只是成功或失败

许多系统把一次检定读作若干结果之一，而不只是单纯的通过或失败：Pathfinder 的四级成功、付出代价才勉强成功的“险胜”、Call of Cthulhu 的困难成功和极难成功、Fate 的“漂亮成功”。`resolution.outcomes` 为这些结果档命名，Engine 会在每次检定中说明它落入了哪一档（Capability API 1.135）。它适用于所有结算类型。

```json
"outcomes": {
  "by": "margin",
  "naturals": "shift",
  "tiers": [
    { "id": "critical_success", "label": "Critical success", "atLeast": 10, "success": true, "critical": true },
    { "id": "success", "label": "Success", "atLeast": 0, "success": true },
    { "id": "failure", "label": "Failure", "atLeast": -9 },
    { "id": "critical_failure", "label": "Critical failure", "critical": true }
  ]
}
```

- `by`：结果档读取的依据。`"margin"`(默认) 是结果超出检定所需的量：求和总数减去难度，或骰池净成功数减去所需成功数。`"total"` 是结果本身：求和总数或净成功数，无论难度是多少。
- `tiers`：两到八个结果档，**最好的在前**。`atLeast` 是落入该档的最低数字；每档的值都低于前一档，最后一档没有这个值，因为它接住以下的一切。`success` 说明该档是否算成功，`critical` 将其标记为同类中的大成功或大失败（`success` 为真时是大成功，否则是大失败）。至少要有一档成功、一档失败。`text` 是可选的一行文字，最多 200 字符，告诉 Game Master 该档在牌桌上意味着什么（“You do it, but the Game Master adds a complication”）。
- `on`：`"critical-success"` 或 `"critical-failure"` 让某一档成为大成功或大失败所落入的那一档，无论数字是多少，其他任何结果都不会落入这里。它没有 `atLeast`；大成功的档算成功，大失败的档不算；每种最多一档。Blades in the Dark 的“两个六”就是位于单个六那一档之上的大成功档；其余从数字读取的结果档，彼此之间遵循上面的规则。
- `naturals: "shift"`：单颗骰子的最高面让结果提高一档，最低面让结果降低一档，但不会越过两端。它需要单颗骰子，并取代 `resolution.naturals`，因此请在它旁边把那两项都设为 `none`。

结果档决定结果：成功以及大成功和大失败都来自结果档，从不来自单纯的比较。求和规则集的 `naturals` 让某个点数自动成功或失败时，该点数落入对应的大成功或大失败档，否则落入最好或最差的一档，并仍算作大成功或大失败。骰池的大失败规则（botch）在底部同理；带结果档的骰池省略 `exceptional`，因为结果档已经说明了什么是大成功。

以 `by: "total"` 读取的骰池，就是难度固定的系统表达结果的方式：Lasers & Feelings 的“1 次成功：勉强做到；2 次：做得很好；3 次：大成功”，就是 3、2、1 次成功的三个结果档，加上低于它们的一个失手档。

记录用 `outcome="Critical success"` 写出结果档，骰子卡用它代替简单的成败字样，Game Master 也会学到各结果档及其 `text`，并被要求按该档叙述。声明了结果档的打包规则集要求 Capability API 1.135。

### 以自己的方式掷骰的检定

有些游戏大多数检定按一种方式掷，少数按另一种：老派游戏用 d20 掷低于属性值，但盗贼技能用 d100，Open Doors 用 d6。`resolution.overrides` 列出这些检定，以及它们改用的结算键。Capability API 1.140。

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- 每项覆盖指定 `skills`、`saves` 或 `abilities`(三者中的一种或多种)、`label`，以及给 Game Master 的可选 `text`。
- `set` 保存规则集自身类型的结算键，对这些检定取代规则集原有的键。`null` 移除一个键：exwod 中受青睐属性上不会抵消的 1，就是 `"cancel": null`。类型、人物卡计算（`abilityModifier`、`proficiency`、`proficiencyTiers`、`penaltyFrom`、`spend`、`adjust`）和 `difficultyLadder` 都不能更改。符号骰池还会锁定其 `symbols` 和 `dice`。覆盖产生的结算方式会像规则集自己的一样接受检查，因此它指定的点数必须存在于其骰子上。
- `when`：可选。掷骰者人物卡上的一个值；只有它不为 0 时覆盖才适用，例如表示受青睐属性的 0 或 1 数字字段。没有它时，覆盖始终适用。
- 第一个指定了该检定、且 `when` 成立的覆盖就是所用的覆盖。一项检定最多只能出现在一个不带 `when` 的覆盖中。

### 消费资源改变掷骰

有些系统允许玩家为即将进行的掷骰支付资源，例如一点意志换一次自动成功。`resolution.spend` 将其声明为系统常设规则，而非角色另行购得的特性：

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` 是某个 `live.pools`。不能是初始为空的池，否则开始游玩时无资源可花。
- `amount` 是一次购买的成本。购买所得为 `successes`、`dice` 和 `reroll`，至少要有其中一项。成功在骰子计数及抵消之后加入，因为它们并非掷出。骰子则在池自身范围内随骰池一起掷。`reroll` 写作 `{ "upTo": 6, "mode": "once" }`，读法与 `resolution.reroll` 相同；无论检定购买几次，它都只买一次：同一颗骰子重掷两遍，仍然只算一次重掷。
- `perCheck` 是单次检定可购买的次数，因此最多购买 `amount * perCheck` 点的效果。这个上限防止满池买出绝不会失败的掷骰。它可以是 1 到 10 的数字；可以是人物卡上的值，写法与派生值读取的形式相同（`{ "abilityScore": "nerve" }`、`{ "derived": "focus" }`）；也可以是 `"pool"`，即检定有几颗骰子就能买几次，指的是计入伤势、奖励骰或调整值之前人物卡给出的数字。人物卡上的值按掷骰者读取，向下取整并限制在 0 到 100 之间；上限算出为 0 的角色什么也买不到，也不支付任何费用。
- `dice-pool` 规则集可以购买成功、骰子或重掷。`dice-highest` 和 `symbol-pool` 只能购买骰子。其他类型不能声明 `spend`。
- 最多四项，且两项不能指向同一资源池，否则检定无法说明指的是哪项。
- 购买 `reroll` 的消耗、不是数字的 `perCheck`，以及超过两项，对打包规则集要求 Capability API 1.38。

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
- `explode` 和 `double` 为这一次掷骰调整这两条规则的点数，仅在你的规则带 `min` 时有效，且不能越过它：`"check": { "explode": 8 }` 是让八点再掷一次的条目。和 `threshold` 一样，它们优先于 Game Master 在标签上写的值。Capability API 1.37。
- 这些键至少声明一个，否则条目没有效果而被拒绝。
- 只有 `dice-pool` 能实现这些内容，因此含 `mechanics.check` 的 `dice-sum` 会在导入时被拒绝。

**成本是条目自身的 `cost`**，通过与使用其他内容完全相同的机制支付：资源池，以及该条目写入的每个计数器的一次使用量。`perCostStep` 表示条目会缩放；声明它时按实际支付了几份价格购买几份，未声明时无论提出多少都只买一次。

**Game Master 在检定中点名：** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`。同样不能另写人物卡命令，因为骰子在任何记账处理之前就已掷出。

**要么全部成功，要么完全不买。** 资源池不足时不购买也不扣除，仍进行原本的掷骰。不足以构成整数次购买的点数也买不到任何东西。请求超过 `perCheck` 时会限制到上限而非拒绝，且只支付上限对应金额。全部由 Engine 计算，Game Master 只写玩家声明要花的资源，不碰骰子。记录显示真实支付量、应用条目、未掷骰获得的成功数，以及重掷了多少骰子。角色未选取的护符，或 Engine 无法读取目录的护符，完全不生效，不会凭信任应用。

### 人物卡

- `sections` 对编辑器内容分组。字段、派生值和列表用 `section` 指定自己所在的分区，属性、技能和豁免也可以这样做：编辑器、游戏内人物卡和 Game Master 的人物卡块都会在该标题下显示它们（未给它们指定分区的人物卡，显示方式与以前完全相同）。分区还可以带 `untrained` 规则（见下文）。
- `abilities` 是核心属性值。`skills` 和 `saves` 可各自指定使用的属性、`cap` 和 `untrained` 规则（见下文）。
- `fields` 是单值，类型有 `number`、`text`、`longtext`、`boolean`、`enum`(固定候选列表) 和 `dice`(如 `1d8` 的文本)。
- `derived` 从其他值计算，不可手动覆盖。一张人物卡最多可以有 400 个（Capability API 1.111；1.88 起为 240，1.84 起为 120，之前为 60）；超过 240 个的包要声明 1.111。运算有 `sum`、`min`、`max`、`scale`(乘以一个固定数字并取整)、`multiply`(两到六个值相乘，例如 Constitution 调整值乘以等级；Capability API 1.82)、`stepTable`(按阈值查表，如等级对应熟练加值) 和 `enumTable`(为枚举字段或实时状态的每个值给出一个数字，见下文“实时状态”)。
- `lists` 是自定义列的表，如装备、法术或特性。一个列表最多 24 列；有列表超过 12 列的包要声明 Capability API 1.165。带 `pools` 的列表让每行成为有自身上限的资源，适用于有限使用次数的职业特性。数字列可以由掷骰填写：`"roll": { "count": 1, "sides": 8 }`，其中 `sides` 是一个数字、同一行的另一列（`{ "column": "die" }`，可以是数字列，或取值读作骰子的枚举列，如 `d8`），或人物卡上的一个值。人物卡编辑器会显示 Roll 按钮，用 Engine 自己的骰子掷出并写入总数，限制在该列的 `min` 和 `max` 之内（Capability API 1.85）。
- `live` 是游玩中变化的内容：`pools`(生命、法术位、Grit)、`tracks`(如力竭的刻度数值，或勾格子的伤势轨道)、`text`(如角色正专注什么的短备注)、`conditions` 和 `states`(从封闭集合中取一个值，如形态或姿态)。

凡是读取数字的地方都用值引用指定。它是恰好含一个键的对象，键为 `const`、`field`、`derived`、`abilityScore`、`abilityMod`、`abilityModFromField`、`skillMod`、`saveMod`、`listSum`、`livePool`、`liveTrack` 或 `itemStat`。例如，最大值来自派生值的池：`"max": { "derived": "grit_max" }`。

- `listSum` 把列表的某个数字列相加：`{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`。`onlyWhen` 可选，指定一个布尔列，只计入该列为真的行。空单元格按该列的默认值计算，被 `hideWhen` 隐藏的列表不加任何数。Ember Roads 就这样根据角色打包的装备算出 Burden，因此它永远不会像手动输入的数字那样与列表脱节。目录的缩放列不能读取列表合计，经由派生值也不行：列表里可能有缩放单元格，无论是自己的，还是反过来读取它的，重新计算将永远无法收敛。
- `livePool` 读取某个 `live.pools` 的剩余量（列表行的池不在其中）。`liveTrack` 读取某个 `live.tracks`，可选 `read`：`"value"` 是当前所处位置（默认）；`"filled"` 是高出 `min` 多少；`"remaining"` 是距离 `max` 还有多少；仅限伤势轨道的 `"penalty"` 是当前生效的惩罚。被隐藏的池或轨道读作 0。Gravewatch 的 “Harm still to take” 写作 `{ "liveTrack": "harm", "read": "remaining" }`。
- 实时读取使用掷出检定、战斗开始或写入 Game Master 人物卡块那一刻的实时状态。尚无实时状态时（人物卡编辑器、导入审核），读取游玩开始时的状态：池按其 `start` 为满或为空，轨道处于其 `default`，伤势轨道没有标记。
- 在实时状态存在之前就要算出的内容，都不能读取实时值：池或轨道的 `max`、熟练加值，以及目录的缩放列或缩放。经由读取实时值的派生值，或经由被实时值限制上限的技能，同样不行；导入会指出是哪个值这样做了。
- 这三项对打包规则集要求 Capability API 1.39。
- `itemStat` 读取角色持有的物品，例如所穿护甲的 guard，并受与实时读取相同的规则约束。见[人物卡上的物品](#items-on-the-sheet)。Capability API 1.52。

**未受训练时的检定。** 角色没有受过训练的技能或豁免（其档位为第一档）照常掷骰，除非规则集另有规定：在技能或豁免上，或在其所在的分区上写 `untrained`(技能或豁免自身的规则优先)：

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"`：照常掷骰（默认）。
- `{ "by": -3 }`：加到检定的数字上，范围 -20 到 20：骰池上是骰子，求和上是固定值。它属于人物卡显示、每次检定都会掷出的那个数字，在任何 `cap` 之前计入。
- `"harder"`：难一档。骰池上的单骰目标提高一点（且保持在目标范围之内），因此需要目标可调的骰池规则集；其他情况都会在导入时被拒绝，因为它永远不可能改变掷骰。
- `"refuse"`：完全不掷这次检定。Engine 把 Game Master 的请求连同 `reason="untrained"` 写回，检定就此了结：之后不会有任何东西再掷它，Game Master 会被告知角色无法尝试，叙述也会这样交代。技能检定接口对这类检定返回 400(`skill_check_untrained`)，以它为条件的分支块两半文字都不保留。人物卡编辑器不为它显示数字。
- 没有人物卡的角色没有可读取的训练，因此任何未受训练规则都不适用于他们。
- Game Master 的提醒会按分区或技能列出未受训练规则，让它只要求角色能够进行的检定。

属性、技能和豁免上的分区，以及任何位置的 `untrained`，对打包规则集要求 Capability API 1.41。

技能或豁免可以带 `cap`，这是一个值引用，表示其检定最多能达到的数字：角色无法超越的评级，或压制它的轨道。Gravewatch 把 Soothe 限制为守望者剩余的 Resolve：`"cap": { "livePool": "resolve" }`。限制后的数字就是人物卡显示、每次检定掷出的数字；`with=` 替换先在限制前的数字上计算，再重新限制。上限不能读取技能或豁免调整值，它所读取的派生值，以及声明在该派生值之前的任何派生值也都不能，因此人物卡仍然自上而下只计算一遍。Capability API 1.39。

`hideWhen` 按另一字段的值隐藏字段、派生值、列表、池或普通轨道，方式恰好是以下三种之一：`equals` 某个值；`notEquals` 某个值（字段为其他任何值时都隐藏，“只适用于这类角色”就这样表达）；或 `in` 一组值。指定的每个值都必须是该字段能取的值，否则规则永远不会匹配；这会逐个值检查，对 `notEquals` 和 `in` 来说还包括数字字段的范围和文本字段的长度。规则读取人物卡编辑器显示的值：未设置的字段取空白人物卡的初始值，规则集已不再提供的枚举值取字段默认值。5e 文件用 `equals` 为不施法的角色隐藏法术位；Gravewatch 用 `"hideWhen": { "field": "watch", "notEquals": "night" }`，让所有不值夜班的守望者人物卡上都不出现灯油。层不能移除这些规则所比较的任何值。伤势轨道不能隐藏，因为无论人物卡显示什么，掷骰和战斗都会读取它。`notEquals` 和 `in` 要求 Capability API 1.39。

普通轨道的 `max` 可以是值引用而非数字，这样角色拥有的评级就决定了它的长度：`"max": { "field": "willpower_rating" }`。其 `min` 和 `default` 仍是数字。带命名等级的伤势轨道，`max` 等于等级数；编号格子的轨道长度等于自身的 `max`(见下文“编号格子代替命名等级”)。`alwaysShow: true` 让轨道即使处于默认值也会印在 Game Master 的人物卡块中，适合每回合都重要的评级；没有它时，处于默认值的轨道会被省略，因为三个为零的死亡豁免什么也没说明。这三项对打包规则集要求 Capability API 1.37。

### 实时状态：形态、姿态、灯光

枚举字段在创建角色时选定，之后保持不变；状态只有开和关。**实时状态**则是从封闭集合中取的一个值，会在游玩中变化：变形者的形态、战斗姿态、提灯的亮度。

```json
"live": {
  "states": [
    {
      "id": "stance",
      "label": "Stance",
      "values": ["guarded", "steady", "reckless"],
      "valueLabels": { "guarded": "Guarded", "steady": "Steady", "reckless": "Reckless" },
      "default": "steady"
    }
  ]
}
```

- `values` 为 2 到 40 个，各自显示为 `valueLabels` 中的对应项，或显示其本身。它们遵循所有标签都遵循的规则（单行、无方括号、无宏花括号），且不得包含双引号，因为人物卡命令会给它们加引号。最多十二个状态。
- `default` 是每张人物卡的起点，省略时取第一个值。只有离开默认值的状态才会保存；已保存但状态不再提供的值读作默认值。
- `hideWhen` 按字段的值把状态从人物卡上拿掉，与池的做法相同：不显示、不能被命令设置，被表（见下文）读取时视为没有值。
- Game Master 用 `[sheet: who="Name" op="state" state="Stance" value="Reckless"]` 设置状态，状态用 ID 或标签指定，值用其本身或标签指定。人物卡没有的状态或值会被拒绝（`unknown-state`、`unknown-value`）。只有规则集含有状态时，Engine 才会教授这条命令并列出每个值；每个人物卡块都会写出每个状态的值，包括默认值，因为“处于人形”是叙述每回合都需要的事实。
- 游戏的人物卡画面为每个状态提供选择器。
- 休息通过指定该状态的恢复步骤把它复原：`{ "state": "stance", "to": "default" }`，或让 `"to"` 取某个值。

**随之变化的数字。** `"op": "enumTable"` 的派生值为枚举字段或实时状态的每个值给出一个数字：

```json
{
  "id": "stance_brawn",
  "label": "Stance on Brawn",
  "op": "enumTable",
  "from": { "liveState": "stance" },
  "table": { "guarded": -1, "reckless": 2 },
  "default": 0
}
```

- `from` 恰好指定 `field`(枚举字段) 或 `liveState` 之一。`table` 的每一行都是该来源能取的值，共 1 到 40 行。表中未列出的值，以及被人物卡隐藏的状态，都读作 `default`(省略时为 0)。
- 字段在创建角色时固定，因此以字段为键的表可以用来提供最大值：Gravewatch 让值晨班的守望者多一点 Resolve。实时状态会在游玩中变化，因此以它为键的表是一种实时读取，与 `liveTrack` 一样：在实时状态存在之前就要算出的内容，无论直接还是经由其他派生值，都不能读取它。这就是键名是 `liveState` 而非 `state` 的原因：对实时状态的每次读取都带 `live` 字样，你和导入都能据此分辨最大值不能使用什么。
- 要让这个数字作用于骰子，请将 `resolution.adjust` 指向它（见“来自人物卡的调整值”）。Ember Roads 把 Stance 加到每次 Brawn 掷骰上；Gravewatch 在提灯关闭或熄灭时，从每次 Nerve 掷骰中扣除。
- 层可以从表中有对应行的字段里移除某个值。该层开启期间，这一行只是永远不会被读取。

实时状态、`enumTable` 以及指定 `state` 的休息步骤，对打包规则集要求 Capability API 1.42。

### 伤势轨道：用轨道而非数字表示生命

许多系统根本不计生命点，而是有一列每格比前一格更严重的格子，受伤时标一格。给 `live.tracks` 条目添加 `kinds`，再加上命名的 `levels` 或编号的 `boxes`(见下文) 之一，它就从刻度数字变为这种轨道：

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
- 两者必须配套。既没有 `levels` 也没有 `boxes` 的 `kinds` 会被拒绝，因为无处标记；没有 `kinds` 的 `levels` 或 `boxes` 也会被拒绝，因为标记必须有种类。轨道只能有 `levels` 或 `boxes` 之一，不能两者都有。
- **区分两个术语。** `kinds` 定义规则集允许标记成为哪些种类。标记则是游玩时某一种类实际占据轨道的实例。定义保存种类，人物卡保存标记。
- 伤势轨道开始时没有标记，因此 `min` 为 0。带命名等级的轨道长度就是级数，因此 `max` 为 `levels.length`；不符的文件会被拒绝而非悄悄修正，避免同时携带两个冲突长度。格子轨道的长度等于自身的 `max`，它可以是人物卡计算出的值（见下文“编号格子代替命名等级”）。

模糊理解会得到错误轨道，因此以下是**精确规则**：

- 标记按**最严重优先**排序保存。七级轨道最多容纳七个标记。
- 标记按已有标记的**严重度顺序插入**，从不直接追加末尾。它占据严重度允许的最高等级，并将较轻标记向下推。
- 生效惩罚取**最低已标记等级**，而非各格之和。上面轨道的三个标记是 `-3`，不是 `0 + -1 + -3`。
- `amount` 是某一类标记的个数，**逐个应用**，因此中途填满和原本已满的轨道使用相同规则。
- 向**已满**轨道标记时，不新增标记，而将**最轻标记提升一档**。按自身种类阶梯上升一档，与新增标记原本是什么种类无关。
- 超过最高严重度的标记停在最高级，无法落下的那一个计作**溢出**。溢出会保存，因此重载不会忘记已受伤害。
- **治疗使用同一命令和负数数量。** 先清溢出再清任何标记。指定轨道某一种类的治疗只清该种类的标记，因此“冲击伤恢复，致命伤留下”就是带负数数量的 `kind="bashing"`；未指定轨道所具有种类的治疗，先清较轻标记。

**游玩时标记。** Game Master 写 `[sheet: op="damage" track="harm" kind="knock" amount="1"]`，用负 `amount` 治疗。在按格填充的轨道上，它还会加上 `box="3"`，指明这次打击落在哪一格。原先指定 `pool=` 的 `damage` 形式不变。伤势轨道拒绝普通 `track` 命令，因为单一数字无法说明新增标记是什么。玩家也可在人物卡手动标记和清除格子，符合这些系统的预期。

**战斗也能标记。** 将 `combat.health` 指向轨道而非池，命中一击就按 `combat.damageKinds.marks` 指定格数，以及该块将伤害类型映射到的种类进行标记。轨道填满的角色倒下，濒死规则读取这一状态。在按格填充的轨道上，`per-point` 伤害会指定落在哪一格，`per-blow` 则瞄准第一格；没有任何格子能承受的打击会让角色倒下，在采用这类轨道的系统中，这就是被击倒出局的含义。治疗清一个标记，即最轻的那个，不论种类。轨道没有临时点数缓冲，因此拒绝临时点数。Engine 把轨道视为剩余级数，所以战斗的其他部分、倒下、复活、日志和战后摘要都不变。

**休息可以治疗伤势轨道。** 用 `"to"` 指定轨道的恢复步骤会连同溢出一起清到指定标记数；用负数 `"by"` 则先清溢出，清除指定数量，因此 `"by": { "const": -2 }` 清除两个。同时指定 `kind` 的步骤只清该种类的标记：Gravewatch 的 “Catch your breath” 写作 `{ "track": "harm", "kind": "knock", "to": "min" }`，治好冲击伤而留下撕裂伤。会增加标记的步骤不做任何事，因为休息不造成伤害，正数 `"by"` 也是如此：它会被一声不响地跳过，所以请写上负号。

#### 编号格子代替命名等级

如果轨道的长度取决于角色有多坚韧，就用 `boxes` 代替 `levels`。格子数等于自身的 `max`，它可以是人物卡计算出的值（但绝不能读取实时状态），最多 64：

```json
{
  "id": "strain",
  "label": "Strain",
  "min": 0,
  "max": { "derived": "strain_boxes" },
  "boxes": {
    "penalty": {
      "by": "remaining",
      "table": [
        [0, -1],
        [1, 0]
      ]
    }
  },
  "kinds": [{ "id": "strain", "label": "S", "severity": 0 }],
  "fill": "indexed",
  "onFull": "refuse"
}
```

- 生效惩罚按 `filled` 或 `remaining` 的格子数，从 `table`(与派生值相同的阶梯表，惩罚不大于 0) 中读出，无论这个数是多少，所以即使没有任何标记，表也可以产生代价。它不取决于标记了哪些格子。
- 格子带编号：人物卡显示 “Box 3”，Game Master 的人物卡块写出已标记几格、共几格，而不是说出等级名称。

#### 按格填充，以及拒绝标记的轨道

- `"fill": "indexed"` 把标记放在命令用 `box=` 指定的格子上（未指定时为第一格），或其上方下一个空格，标记一旦放下就不再移动。治疗清除最轻标记中位置最高的那一个。人物卡画面允许玩家点击任何空格。
- `"onFull": "refuse"` 在没有空格时拒绝新标记，而不是将最轻标记升级。整个命令都会被拒绝，因此只剩两个空格时，三个标记一个也不会落下。按编号填充的轨道总是拒绝；请在其旁边写上 `"onFull": "refuse"` 加以说明。

#### 由列表增加的等级

在带命名等级的轨道上写 `"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }`，人物卡上的列表就能为每个角色单独延长它。每一行按顺序以其惩罚增加其计数的等级（最多 16），放在惩罚至少同样好的最后一级之后；惩罚相同时以该级命名，否则以惩罚命名。Gravewatch 的伤疤就是这样运作的。被人物卡隐藏的列表不增加任何等级；如果某行在其等级带有标记时被删除，放不下的标记会作为溢出保留：编辑人物卡不能抹消伤害。

`boxes`、`fill`、`onFull`、`extra` 以及休息步骤的 `kind`，对打包规则集要求 Capability API 1.40。

### 掷骰惩罚

`resolution.penaltyFrom` 指定伤势轨道，其惩罚应用于规则集掷出的每次检定。它需要声明而非推定，因此省略时与伤势轨道出现之前完全一样。

惩罚如何作用，由结算类型决定，与人物卡自身数字相同：

- `dice-pool` 是**从骰池减骰**，下限为自身 `pool.min`。`pool.min` 为 1 时，即使最底一档也掷一颗；`pool.min` 为 0 时则不掷骰直接失败。
- `dice-sum` 是**掷骰固定调整值**，合入属性和训练原本添加的数字。

指定的必须是伤势轨道。普通轨道没有可应用的惩罚，导入时会拒绝。结果说明用了哪个惩罚，让玩家理解为何少掷骰；Game Master 的人物卡块也显示档位及代价。

### 来自人物卡的调整值

人物卡上有些数字会伴随它所涉及的每一次掷骰：每次攀爬都背着的沉重行囊、每次潜行都有的护甲惩罚、对一切都有效的祝福。`resolution.adjust` 就用来表达这一点，两种结算类型都适用：

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value` 是人物卡上的值，写法与派生值读取的形式相同，包括实时状态。负数表示扣除。Ember Roads 把角色打包装备的 bulk 加总成 Burden，再用阶梯表让每三点使每次 Brawn 掷骰减一。以实时状态为键的表，就是形态或姿态作用于骰子的方式（见“实时状态”）。
- `abilities` 可选。有它时，调整值只作用于使用其中某个属性的检定：该属性本身、使用该属性的技能或豁免、通过 `with=` 用该属性掷的技能，或包含该属性的属性组合。没有它时，作用于每次检定。
- 它在伤势惩罚所在的位置应用：骰池上是骰子，受同一个 `pool.min` 下限约束；求和上是固定数字，计入记录加总的调整值中。最多八项，每次检定把它们相加。
- 规则集战斗在战斗开始时，把它加到从人物卡构建的每次掷骰上：用属性或技能进行的攻击、豁免、对抗检定，以及从属性、技能或豁免读取的先攻，采用针对该属性的项；其他任何掷骰只采用适用于所有掷骰的项。
- 没有人物卡的角色得不到它，正如他们也没有调整值一样。

结果会说明人物卡加了多少（记录上的 `adjust="-2"`，以及骰子卡上的一行），让玩家明白掷骰为何是这个结果。它对打包规则集要求 Capability API 1.38。

### 休息

休息是恢复步骤和清除内容的列表。每步指定一个目标(`pool`、`poolGroup`、`listPools`、`track` 或 `state`)，并设置为某值(`"to": "max"`、`"to": "min"` 或数字)，或改变它(`"by": { "const": 1 }` 或 `"by": { "fractionOfMax": 0.5 }`)。指定伤势轨道的步骤只能治疗，因此其 `by` 为负数，见上文。指定实时状态的步骤只能设置它，取 `"default"` 或其某个值。带 `fractionOfMax` 的 `poolGroup` 步骤按各池自己的比例改变组内每个池；加上 `"shared": true`(Capability API 1.77) 则改为按整组的最大值计算这个比例，再按人物卡列出池的顺序分给组内各池，每个池最多补到其所缺的量。5e 的长休息恢复“角色总生命骰数的一半”，生命骰按骰子种类各存一个池，写作 `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`。

### Game Master 文本

- `checkGuidance` 替换内置的检定请求说明段落。请说明是什么系统、何时掷骰。Game Master 仅指定技能和难度，Engine 依据人物卡计算并掷骰，所以不要要求模型做算术。
- `sheetGuidance` 在提示词中介绍人物卡，用来说明重要资源及何时消耗。
- `worldGuidance` 可选，在生成世界时只读一次，让 GM 创造的背景符合规则，例如无火药、魔法稀有、死者行走。它从不进入回合提示词。
- `sheetSummary` 选择 GM 对各角色可见的字段、派生值和列表行。Engine 始终显示属性调整值、受训练技能和豁免，以及实时数值。其余保持简短，因为每回合都会发送。摘要列表的 `nameColumn` 可以是文本列或枚举列（枚举显示其值的标签），`columns` 指定最多三个该行自身的其他列，打印在名称之后，因此人物卡块显示为 `Gear: Crowbar 1d6`，而不只有名称。布尔列为真时打印其标签。两者对打包规则集都要求 Capability API 1.37。
- 不必在 `sheetGuidance` 中教授人物卡命令。Engine 会使用文件声明的名称自行教授每条命令；规则集有伤势轨道时，它会加上用于标记轨道的 `op="damage"` 命令，并列出轨道的等级和伤害种类。规则集有实时状态时，它会加上 `op="state"` 命令，并列出每个状态可取的值。

### 完整的 GM 规则参考（Capability API 1.145）

可选的**顶层** `gmReference` 保存规则集给 Game Master 的完整规则参考，最多 16,000 字符。把详细的裁定规则放在这里，而把简短的检定和资源说明留在 `gm.checkGuidance` 和 `gm.sheetGuidance` 中。这些字段以及 `gm.worldGuidance` 仍各有 1,500 字符的上限；层的指引也保持其现有上限。

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

参考内容出现在稳定系统提示词的 **Game Master rules reference**(Game Master 规则参考) 之下，每次请求一次。它从不复制到每回合的提醒中。与其他提示词安全文本一样，它必须是一行，不含控制字符、方括号或宏花括号（`{{` 和 `}}`）。如果在通常的历史和回复预算调整之后，请求仍超出上下文上限，就会先以带标记的截断缩短参考内容，再截断核心指令。不设置它，就保持现有提示词不变。使用它的包必须声明清单 `schemaVersion: 2` 和 `capabilityApi: { "major": 1, "minor": 145 }` 或更新版本。

## 队伍与场景的进度钟（`clocks`）

Capability API **1.143** 新增可选的顶层 `clocks` 对象。省略它，进度钟命令就保持禁用。这个对象是严格的：只接受下面这三个键。

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes` 允许一到六个互不相同的整数分段数，每个取 2 到 12；默认为 `[4, 6, 8]`。`max` 是同时保留的进度钟数量上限，取 1 到 12，默认为 8。可选的 `text` 是一行提示词安全文本，最多 400 字符，说明 GM 何时应创建和推进进度钟。空对象表示启用默认值。

进度钟属于队伍或场景，而不属于某个角色。GM 提醒每回合列出它们的名称和填充程度，并教授以下命令：

- `[clock: name="Alarm raised" size="6"]` 创建一个空的进度钟。不允许的分段数、已存在的名称（不区分大小写），或已达到 `max`，都会拒绝创建。
- `[clock: name="Alarm raised" tick="2"]` 增加分段。负数推进会移除分段；填充程度限制在 `0..size` 之内。填满的进度钟即为完成，仍保持可见，并在清除之前计入 `max`。负数推进可以让它重新打开。
- `[clock: name="Alarm raised" clear]` 移除指定的进度钟。

名称是 1–100 个字符的单行文字，不含双引号、方括号、控制字符或宏花括号。每个标签只请求一个操作。命令按在回复中出现的顺序应用，因此一个进度钟可以在同一条回复中创建并推进。Engine 会把每个标签改写为带 `result="ok" now="4/6"`(或 `now="cleared"`) 的形式，或带 `result="refused" reason="..."` 的形式。模型自行填写的结果属性会被丢弃。未知的进度钟和格式错误的请求会被拒绝；每条回复最多应用 40 条命令。

Game Mode 在队伍状态旁显示分段圆环、名称和填充程度。标签作为凭据留在保存的回复中，并从叙述中隐藏。进度钟以 `rulesetClocks` 的形式保存在每份游戏状态快照中；没有该数据就表示没有进度钟。重新生成从前一份快照开始，继续则从当前快照开始；选择或移除备选回复和消息时，进度钟会随该快照的其余部分一起恢复。

## 队伍人物卡：团伙、飞船或共享的 Story Points

Capability API **1.144** 在 `sheet` 旁新增可选的顶层 `party`。它为每局游戏保存一张共享人物卡，例如 Blades 的团伙、Lasers & Feelings 的飞船，或 Genesys 的 Story Points：

```json
"party": {
  "label": "Crew",
  "fields": [
    { "id": "heat", "label": "Heat", "type": "number", "min": 0, "max": 9, "default": 0 },
    { "id": "vault", "label": "Vault capacity", "type": "number", "min": 0, "max": 16, "default": 8 },
    { "id": "upgrades", "label": "Upgrades", "type": "text", "maxLength": 400 }
  ],
  "pools": [{ "id": "coin", "label": "Coin", "max": { "field": "vault" }, "start": "empty" }],
  "advancement": { "fields": ["heat", "vault", "upgrades"], "text": "Record heat after a score." },
  "text": "Coin belongs to the crew."
}
```

`fields` 使用与 `sheet.fields` 相同的字段结构；`pools` 使用 `sheet.live.pools` 的结构，包括 `start`、`group`、`hideWhen` 和 `allowTemp`。至少需要一个字段或池，其 ID 在队伍人物卡内必须唯一。角色人物卡和队伍人物卡的 ID 可以重合。在这一小版本中，队伍人物卡没有分区、列表、属性、派生值或角色人物卡迁移。池的 `max` 读取常量或队伍的数字字段。角色公式不能读取队伍的值，队伍公式也不能读取角色的值。`hideWhen` 也只能指定队伍字段。

`advancement.fields` 指定 GM 可以永久修改的 number、text 或 longtext 字段。`advancement.text` 和 `text` 各接受一行提示词安全文本，最多 400 字符。可选的 `summary` 复用 `gm.sheetSummary`：其 `fields` 选择队伍字段；`derived` 和 `lists` 必须为空。没有摘要时，显示所有可见的队伍字段。池总是会显示。

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"` 选择共享人物卡；不要写 `who`。现有的 `who="party"` 仍作用于每个**角色**，从不改变共享人物卡。这一小版本允许在队伍人物卡上使用 `spend`、`restore` 和字段的 `advance`。未知的人物卡、不支持的操作、池不足、未声明的成长和无效的值都会被拒绝，并改写为 Engine 的结果。队伍池遵循与角色池相同的当前值/最大值算法和默认值。

GM 每回合会在角色人物卡块旁收到队伍的标签、字段和池。Game Mode 在角色头像旁提供一张可折叠的只读队伍人物卡，使用相同的人物卡呈现方式。永久值在聊天元数据中只保存一份（`gamePartySheet`），与 `gameCharacterCards` 并列，并共用成长凭据。实时池使用 `rulesetLive` 中保留的 `$party` 条目；规范化后的角色名不会与之冲突。重新生成从回复之前开始，选择或删除备选回复会通过现有历史同时恢复永久值和实时值。没有 `party` 的规则集保持原有行为。

**共享的队伍创建（Capability API 1.163）。** 队伍人物卡可以带 `lists`(最多 12 个，写法与角色人物卡的列表相同)、自己的引导式 `builder`，以及 `fromMembers`：最多 8 个从队伍角色读取的队伍数字字段，每个写作 `{ "field", "count": true }`(有几个角色) 或 `{ "field", "sum": "<character number field>" }`(角色们该字段的总和，例如 Totem 点数)。每次读取共享人物卡时，成员字段都会按角色当下的状态计算，因此角色加入或离开会立即改变它们。有列表时，队伍的 `summary.lists` 可以指定它们。

构建器的写法与角色的完全相同（池、步骤、定价行、消费选项、方案），并针对队伍自己的字段和列表遵循同样的规则。它的目录步骤和复制行步骤可以读取为队伍列表供给内容的规则集目录。在 Game Mode 中，任何玩家都可以打开共享人物卡的 Edit，其中提供引导式设置，保存后对整个队伍生效。每次保存都会注明打开时所基于的修订版本（聊天元数据中的 `gamePartySheetRevision`，每次保存和故事自身的改动都会使其递增）：如果打开之后别人的保存已经落地，这次保存会被拒绝，并显示较新的人物卡，玩家的草稿保持打开，是否再次保存以替换它由玩家决定。

```json
"party": {
  "label": "The Crew",
  "fields": [
    { "id": "tier", "label": "Tier", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "size", "label": "Crew size", "type": "number", "min": 0, "max": 12, "default": 0 }
  ],
  "lists": [{ "id": "upgrades", "label": "Upgrades", "columns": [{ "id": "name", "label": "Name", "type": "text" }] }],
  "builder": { "steps": [{ "id": "upgrades", "label": "Upgrades", "kind": "rows", "list": "upgrades" }] },
  "fromMembers": [{ "field": "size", "count": true }]
}
```

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
- `holds`：取 `"rows"`(默认，也是本次发布前全部目录的形式)、`"creatures"` 或 `"items"`。生物目录是战斗读取的图鉴，物品目录则列出队伍携带的东西。两者都不写人物卡、不声明 `feeds`，也从不出现在选择器。见下方[生物](#creatures-a-bestiary-a-fight-reads)和[物品](#items-what-a-party-carries)。
- `feeds`：该目录条目可写入的 1 到 8 个人物卡列表。行目录必填，生物目录和物品目录禁止。条目不能写入未列出的列表，也不能写入列无法容纳的值。
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
- 带 `scaled` 的行必须是该条目写入该列表的唯一一行，确保人物卡上带标记的行始终只对应一份规格；或者（Capability API 1.92）该条目写入该列表的每一行，都必须在列表的名称列（其池的 `nameColumn`，否则为第一个文本列）中带有自己的名称。这样人物卡的行会按该名称与其规格匹配，因此一个特性可以给出两种各自增长的使用次数；玩家重命名过的行则保持不动。

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

条目可以带可选的 `mechanics` 块，用数值说明其效果：`kind`(`attack`、`heal`、`buff`、`debuff`、`utility`、`rider`)、`range`、`area`、`targets`、`targetCount`、`friendlyFire`、`amount`(`2d6` 等骰子表达式或固定数值)、`amountAdd`(从使用者人物卡读取并加到数量上的值，例如 `{ "field": "level_fighter" }`，表示 1d10 加战士等级的 Second Wind；它需要 `amount`，只在规则集自己的战斗中读取（Engine 的 Classic 和 Tactical 战斗按写下的数量使用），并需要 Capability API 1.83)、`damageType`、`attackRoll`、`autoHit`、`save`(人物卡中的一种豁免，以及成功后的效果)、`applies`(为接触到的对象施加的状态)、`temporary`(生命池的临时点数)、`scales`(随人物卡增长的数量)、`cost`(使用时消耗哪个池)、`perCostStep`、`targetsPerCostStep`、`budget`(消耗行动经济的哪部分)、`concentration`、`reaction`、`plus`、`free`、`gives`、`standard`、`rider` 和 `check`。

瞄准敌人的攻击可以用 `summons`(Capability API 1.122) 留下一样东西，在之后的回合继续打击。对于 Spiritual Weapon，在其攻击条目上写 `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }`。施法本身进行第一次攻击，并在反应结束后把武器留在第一个目标旁边；被取消的施法什么也不留下。之后的打击只消耗所声明的行动经济额度，保留施法时的支付等级用于伤害缩放，并打开相同的反应窗口。距离使用目录的单位；省略移动时为零，省略触及时为一格。在棋盘上，武器可以打击移动距离加触及范围之内的敌人，无视墙壁，并移到其旁边。没有棋盘时，任何站着的敌人都在触及范围内。轮数在持有者的回合结束时倒数，施法的那个回合不计。召唤物在归零、持有者被击败，或其条目的专注结束时结束。再次施放同一条目会替换它的召唤物。

带 `area` 的条目可以用 `zone`(Capability API 1.172) 留在场上：`{ "rounds", "anchor", "triggers", "atCast" }`。它持续其施法者的 `rounds`(1 到 1000) 个回合，计数方式与召唤物相同；维持它的专注结束或施法者被击败时，它会提前结束。`anchor: "point"`(默认) 保持在施放时的那些格子上；`anchor: "caster"` 是围绕施法者、随其移动的爆发，因此其射程为 0。`triggers` 指定它何时对一个生物再次产生条目本身的效果（amount、plus、save、applies）：`enter`(对方移入其中，或施法者携带的区域到达对方)、`turn-start` 或 `turn-end`(对方在其中开始或结束回合)。无论哪种触发，一个生物每回合只会被卷入一次，施法本身卷入的人在那个回合也算已被卷入。卷入谁取决于条目：`friendlyFire: false` 不卷入施法者一方，治疗或针对盟友的条目只卷入己方，施法者携带的区域从不卷入施法者本人。`atCast: false` 在出现时不做任何事。再次施放该条目会替换它的区域。棋盘会给其格子着色，战斗会列出它及其剩余回合数，日志会说明每次卷入。没有棋盘时，它保持施放时所卷入的对象，`turn-start` 和 `turn-end` 会卷入他们。

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

这就是 Cloudkill。Spirit Guardians 写作 `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false`，并带 `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`；Moonbeam 是带 `"triggers": ["enter", "turn-start"]` 的 5 英尺爆发。

固定在某一点的区域可以移动，也可以改变其地面（Capability API 1.173）。`move: { "budget", "distance" }` 让施法者在自己的回合移动它：战斗会为该额度提供“Move <zone>”，像行走一样在棋盘上选取，可以移到距其中心 `distance` 之内的任何格子。`drift: { "distance" }` 在施法者每个回合开始时，把它沿远离施法者的方向直线移动这么远，到棋盘边缘为止。无论哪种方式，它现在覆盖而之前未覆盖的人，都会按 `enter` 的规定被卷入。只有固定在某一点的爆发才能移动或漂移。`terrain: { "difficult": true }` 让被它卷入的人移入其每一格的费用加倍（本已崎岖的地面不会再加倍），`terrain: { "perDistance": { "every", "amount", "damageType" } }` 则让被它卷入的人在其中每移动 `every` 距离，就受到 `amount`(骰子和固定值，与条目自身的写法相同) 的伤害，不作豁免，跨多次行走累计。日志会说明每次移动、漂移和伤害。

```json
{
  "id": "moonbeam",
  "name": "Moonbeam",
  "mechanics": {
    "kind": "attack",
    "range": 120,
    "area": { "shape": "burst", "size": 5 },
    "amount": { "dice": "2d10" },
    "damageType": "radiant",
    "save": { "save": "con_save", "onSuccess": "half" },
    "concentration": true,
    "zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "move": { "budget": "action", "distance": 60 } }
  }
}
```

Cloudkill 加上 `"drift": { "distance": 10 }`。Spike Growth 是一个 20 英尺爆发，本身没有数量，带 `"triggers": []`(它只靠地面起作用)、`"atCast": false` 和 `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`。

区域还能对被卷入的人做更多事（Capability API 1.174）。`breaksConcentration: true` 让正在专注且被它卷入的生物，在条目效果之前，对抗条目自身的豁免难度进行规则集的专注豁免，失败就失去专注；该条目需要 `save`。`damageCap` 在区域出现后累计造成这么多伤害时结束它，卷入和地面造成的伤害都计入。Sleet Storm 是一个 40 英尺爆发，带 `"save": { "save": "dex" }`、`"applies": [{ "condition": "prone", "duration": "instant" }]` 和 `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`。Guardian of Faith 是一个爆发，带 `"friendlyFire": false`、`"amount": { "flat": 20 }` 和 `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`。

条目施加的状态以什么难度挣脱，可以是条目自身的豁免难度（1.174）：在 `applies` 项上写 `"escapeDc": "save"`，并配合一个 `from.holding` 为该状态的对抗。Web 和 Black Tentacles 用 `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }` 束缚目标，被束缚的生物进行挣脱对抗时，对抗的是施法者的法术豁免 DC。若施加它的东西没有豁免难度，就仍按对抗的规定、对抗施加者来挣脱。

物品的 `use` 也可以像目录条目一样带 `concentration` 和 `zone`(1.174)，因此 Cloudkill 或 Moonbeam 的法术卷轴会保留其持续范围，并由阅读者的专注维持。

被移动的区域可以冲撞，其地面的代价也可以更高（Capability API 1.175）。`move: { ..., "ram": true }` 让它一次一格、直线朝被移往的位置前进；在第一个碰到之前未覆盖之人的格子上，它会停下，把对方当作被冲撞一样卷入（无论其触发条件如何），并且该回合不能再被移动。走进它的生物只按其触发条件被卷入。Flaming Sphere 是一个 5 英尺爆发，带 `"triggers": ["turn-end"]` 和 `"move": { "budget": "bonus", "distance": 30, "ram": true }`。`terrain.costTimes`(2 到 10) 让踏入其中的每一步都花费相当于这么多普通步的费用，本已崎岖的地面也不会超过这个费用：Plant Growth 写作 `"terrain": { "costTimes": 4 }`。它取代 `difficult`，后者等于 `costTimes: 2`。`terrain.halvesSpeed: true` 让其中的每一步在任何崎岖地面之外再加倍：Spirit Guardians 写作 `"terrain": { "halvesSpeed": true }`。

法术施加的束缚只能按法术的规定挣脱（同样是 1.175）。带 `"from": { "holding": "restrained", "escapable": true }` 的挣脱对抗，只针对指定了 `escapeDc` 的束缚提供，因此同一个对抗可以挣脱蛛网，却永远挣脱不了石化。`applies[].escapeChecks` 指定可以挣脱该束缚的对抗检定，代替对抗自身的攻击方检定：Black Tentacles 用 `"escapeDc": "save", "escapeChecks": ["might", "agility"]` 束缚，Web 用 `"escapeChecks": ["might"]`。`zone.whileHeld: { "condition", "amount", "damageType" }` 对在其中开始回合、且已被施法者以该状态束缚的人造成其数量的伤害，不作豁免，并代替区域本身的效果：Black Tentacles 的 `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }`。

条目或物品的使用可以治愈（Capability API 1.176）。`ends: { "conditions": [...], "count"? }` 按列出的顺序移除目标身上的这些状态，最多 `count` 个：Lesser Restoration 写作 `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`。`stabilizes: true` 让濒死的目标稳定下来，不再进行濒死豁免，它需要带 `dying` 规则的战斗块：Spare the Dying。`revives: { "withinRounds", "health" }` 只能指向死亡不超过这么多轮的人，并让其以该数量的生命复活：Revivify 写作 `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`。只移除状态或只让目标稳定的条目，只针对它能帮到的人提供；`utility` 类型、别无其他作用的条目，只要能治愈就会提供。

范围可以是方形，持续的范围可以是墙（Capability API 1.177）。`area.shape: "box"` 是边长为 `size` 的正方形，其近角位于所瞄准的格子上，朝远离施放者的方向延伸；在与施放者对齐的轴上，则改为以该格为中心。没有 `range` 时，它紧贴施放者。Web 写作 `"area": { "shape": "box", "size": 20 }`，射程为 60。`area.shape: "wall"` 只能持续存在，因此需要 `zone`：它长 `size`、厚 `width`(没有时为一格)，穿过所瞄准的格子、横跨施放者到该格的连线，或从那里朝选择的 `toward` 格子延伸；`"ring": <diameter>` 让施法者在选择写明 `"ring": true` 时，改为把它布成围绕所瞄准格子、直径为这个值的环。墙不需要触发：Wind Wall 只在出现时产生效果。墙从不移动、漂移或跟随施放者。`zone.blocks: ["move", "sight"]` 在墙存在期间，对行走、视线或两者封闭其格子，墙升起处站着的人会被放到最近的空格上（距离相同时放在所选的一侧）：Wall of Stone 两者都阻挡，Wall of Force 阻挡移动，Wall of Fire 阻挡视线。`zone.side: { "distance", "triggers" }` 让墙一侧 `distance` 之内的格子按自己的 `triggers` 卷入，与墙本身的格子并列；选择的 `side` 说明是哪一侧：`near` 靠近施放者（环内），`far` 远离施放者（环外），省略时为远侧。Wall of Fire 写作 `"area": { "shape": "wall", "size": 60, "ring": 20 }`、`"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`。

视线很重要（Capability API 1.178）。`combat.senses` 列出能在眼睛看不见之处看见的感官，每个写作 `{ "id", "label", "sheet"?, "blind"? }`：角色的感知距离通过 `sheet` 从其人物卡读取（为零时没有），生物以 `"senses": { "darkvision": 60 }` 携带自己的感官，使用规则集的距离单位；`blind` 感官（盲视、震颤感知）不需要眼睛也能生效。此时该块需要 `combat.distance`。带 `obscures` 的区域会遮蔽其中的一切，以及透过它看到的一切，使其对在距离内不具备 `pierced` 所列任何感官的人不可见：Fog Cloud 写作 `"obscures": {}`，Darkness 写作 `"obscures": { "pierced": ["blindsight", "truesight"] }`。这种区域不需要触发；只留下一片持续范围、别无其他作用的 `utility` 条目（Fog Cloud、Darkness、墙）会出现在菜单上，放在施法者选择的任何位置。带 `unseen` 的 `combat.conditions` 项以同样方式隐藏其持有者：隐形写作 `"unseen": { "pierced": ["blindsight", "truesight"] }`。`combat.sight` 说明这有什么作用：`unseenAttacks: true` 在目标看不见攻击者时给攻击优势，在攻击者看不见目标时给攻击劣势；`eyes` 指定哪种感官是视觉（与状态的 `lacks` 指定感官的方式相同），因此目盲的生物只能靠 `blind` 感官看见。带 `seen: true` 的条目或生物行动只能选择施放者看得见的目标，正如“射程内一个你看得见的生物”这句规则所说。爆发或方形可以用 `area.copies`(2 到 10) 一次放下多份，每份都与另一份相接，由玩家逐一放置：Fire Storm 写作 `"area": { "shape": "box", "size": 10, "copies": 10 }`。放下多份的区域会留在施放的位置。

区域可以作用于站在其中的人（Capability API 1.179）。`combat.components` 指定使用某样东西可能需要什么，每个写作 `{ "id", "label" }`(5e 的言语、姿势、材料)，条目或生物行动在 `components` 中列出自己所需的成分。区域的 `inside` 对其中的人施加 `conditions`，并在他们停留期间使其免受 `immune` 中的伤害类型；其 `forbids: { "components": [...] }` 阻止在其中使用需要这些成分的任何东西，与状态的 `forbids` 对其持有者的作用相同（被堵住嘴）。Silence 写作 `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`。区域的 `wards: { "catalogs": [...], "maxLevel": N }` 让其中的人免受从外部以 N 级或更低等级使用的、来自这些目录的任何东西，按支付时的等级判断：Globe of Invulnerability 写作 `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`。拿走额度的状态（带负数 `flat` 的 `budgets`），如果在持有者自己的回合中施加，也会从当回合拿走，因此 Stinking Cloud 在回合开始时豁免失败，会让那个回合失去动作。

感官与视线还能更进一步（Capability API 1.180）。条目施加的状态可以在持有者行动时结束：`"endsWhenHolder": { "attacks": true, "casts": ["spells"] }` 在他们进行一次攻击，或使用了所列目录中的条目后移除它；写明 `"casts": "spells"` 的物品使用（卷轴、魔杖）算作从该目录施法。结束它的那次攻击或法术仍享有它，因此 Invisibility 让那一次攻击获得优势，之后才消失。持续区域自行产生的作用不算施法者行动。`combat.conditions` 中的状态，或物品的 `worn` 或 `carried` 效果，可以给予以规则集距离单位计的感官：`"senses": { "darkvision": 60 }`；生效期间，取它与持有者自身距离中较长的一个，因此 Darkvision 法术、True Seeing(`{ "truesight": 120 }`) 和 goggles of night 都能实现。带 `"cancelsUnseen": true` 的状态让所有人都能看见其持有者，无论什么状态在隐藏他们，就像 Faerie Fire 勾勒出隐形者的轮廓；遮蔽区域和墙仍会隐藏他们。

防护、豁免、怪物施法和卷轴更进一步（Capability API 1.181）。区域的 `wards` 比较法术支付时的等级，除非写明 `"by": "base"`，此时比较法术本身的等级，无论以何种等级支付，Globe of Invulnerability 就是这样。`"maxLevelPerCostStep": 1` 让防护自身施放时每高于基础等级支付一级，就多挡住一个等级。条目或生物行动的 `save` 可以说明它还算作针对什么：`"against": { "damage": ["poison"] }`，因此 `against` poison 的豁免调整值也适用于它；还可以说明谁无须掷骰即成功：`"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }`(满足任一项即可)，Stinking Cloud 就需要这样。生物的 `spellcasting` 可以为整个特性或逐个法术说明其法术需要什么，代替各条目自身的 `components`；不需要任何成分的天生施法写 `[]`，这样 Silence 就阻止不了它。物品的使用在唯一作用是留下一片持续范围时（Fog Cloud、Darkness、Silence 或 Globe of Invulnerability 的卷轴），可以写作 `"kind": "utility"`；它需要 `area` 和 `zone`。

推开、风和护目镜（Capability API 1.182）。条目的 `"push": 15` 把它落在其身上且未通过豁免的人，沿远离施放者的方向直线推开 15 个目录距离单位，碰到任何实体或站着的人时停下；区域以同样方式推开被它卷入的人。由施法者携带的区域（`"anchor": "caster"`）现在除了爆发，还可以是直线或锥形：它指向施放时的方向，随施法者移动，`"turn": { "budget": "bonus" }` 让施法者在自己的回合消耗该额度把它转向另一个方向，并把它现在覆盖的人当作移入其中一样卷入（5e 的 Gust of Wind）。区域的 `terrain` 带 `"towardCaster": true` 时，其崎岖地面只对让移动者更靠近施法者的那一步生效。状态或物品给予的感官可以写作 `{ "add": 60 }` 而不是距离，表示加到持有者该感官自身的距离上，或给没有该感官的人 60 的距离（5e 的 goggles of night）。

稍后引爆或燃烧殆尽的区域（Capability API 1.183）。带 `"detonates"` 的区域在存在期间和施放时都不做任何事：当它结束时，无论是因为专注结束、轮数耗尽，还是被再次施放，它都会对其中的每个人产生一次条目本身的效果。`"grows": { "dice": "1d6" }` 在施法者每个回合结束时（包括施放的那个回合）给它的数量加上这么多，因此它掷的骰子与条目本身的数量相同；`"touched": true` 让移到其中心上的人进行条目的豁免，失败时引爆它（5e 的 Delayed Blast Fireball）。它留在施放的位置。带 `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }` 的区域，在其中一种伤害类型落到它的任何格子或其中任何人身上时被点燃；施法者的回合再次到来时它燃烧殆尽，法术随之结束，在此期间，在其中开始回合的其他任何人都会受到其数量的伤害，不作豁免（5e 的 Web）。

生物也能推开（Capability API 1.184）。生物的行动像目录条目一样接受以规则集自身距离单位计的 `"push": 60`：它落在其身上的人会被沿远离生物的方向直线推开这么远；带 `save` 时，只在对方豁免失败时推开，因此 `"onSuccess": "none"` 保留伤害，只免除推开和 `applies` 施加的状态（dragon turtle 的 Tail）。物品的使用可以给直线设定 `width`，就像 Gust of Wind 卷轴的 60 乘 10 英尺。

生物是什么，作用更大了（Capability API 1.185）。豁免可以写 `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`，因此属于该类型的目标会掷两次取较差者（Sunbeam）；条目的 `"maxAgainst": { "types": ["plant"] }` 对属于该类型的目标造成最大伤害（Blight）。`targetTypes` 还可以写 `"abilityAtMost": { "int": 3 }`，表示分值不超过该值的目标（没有写分值的生物不会被排除），以及 `"notImmuneTo": ["charmed"]`(Sleep)。状态的调整值可以让攻击掷两次：`{ "to": "attacks", "mode": "disadvantage", "atSource": true }` 是持有者对施加者的攻击（Chill Touch），`{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }` 是属于该类型的攻击者对持有者发动的攻击（Protection from Evil and Good）。对豁免的改动可以写 `"against": { "from": { "types": ["dragon"] } }`，匹配针对该类生物所做之事的任何豁免（Dragon Scale Mail）。

生物的行动可以一起充能（Capability API 1.186）：给每个 `"recharge"` 相同的 `"group"` 和相同的骰子，使用任一个都会同时消耗两者，而在生物回合开始时掷一次就能让两者都恢复（metallic dragon 的两种吐息武器）。打击可以带 `"charge"`：`{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }` 会在生物本回合的行走以至少 `atLeast` 的直线冲刺结束、径直冲向被它击中的人（每一步都离对方近一格）时，加入其子项；然后目标进行豁免，失败时（没有豁免则总是）被推开并受到这些状态（minotaur 的 Charge）。冲锋依附于对一个目标的一次打击，并且只在棋盘上测量。

物品的 `attack` 可以对其命中对象说明更多（Capability API 1.187）。`"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]` 对属于该类型的目标增加命中加值（mace of smiting）。`plus` 子项可以写 `"not": { "types": ["construct", "undead"] }` 跳过属于该类型的目标，写 `"blow": "ranged"` 只在投掷或射击的打击上计入（dwarven thrower），或写 `"melee"` 只在触及范围内的打击上计入，写 `"tempHp": true` 则给予持用者等于其所造成伤害的临时生命值（sword of life stealing）。`onHit` 状态可以指定 `"targetIs"`(giant slayer 把巨人击倒) 和 `"oncePerTurn": true`(sword of wounding)。`"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]` 会直接杀死被这次命中打到 `healthAtMost` 或以下的目标（有豁免时须豁免失败），并在生效时消耗物品的充能（nine lives stealer）；`"immuneTo": ["slashing"]` 放过免疫该伤害的目标（vorpal sword）。生命在打击的伤害之后读取。

人物卡的 `live.conditions`、休息的 `clear.conditions` 以及 `combat.conditions` 最多容纳 320 项（Capability API 1.269；1.188 起为 160，之前为 80）。`to: "attacks"` 的调整值可以指定 `"ability": "str"`，只改变以该属性进行的攻击（gold dragon 的 Weakening Breath）；`to: "checks"` 的调整值可以指定 `"abilities": ["str"]`，只改变以其中某个属性进行的属性检定，包括该属性的对抗检定和技能检定（barbarian 的 Rage）。生物数值块中的行动不指定属性，因此限定于属性的攻击调整值永远不会作用于它们。

`combat.conditions` 中的状态可以伤害其持有者（Capability API 1.189）：`"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }` 在其每个回合开始时（或 `"turn-end"`）造成该伤害，来源是施加者，在任何结束它的豁免之前结算。`"stacks": 10` 允许在它生效期间再次施加，最多叠加这么多次，每层各造成一次伤害（sword of wounding）；结束它会结束所有层。`"onePerSource": true` 让同一来源只在一个持有者身上保留它：施加到另一个人身上时，它会离开原先从同一来源获得它的人（oathbow 的 sworn enemy）。物品攻击的 `against` 项可以写 `"marked": "sworn"` 代替 `is` 或与之并列，匹配带有持用者所施加该状态的目标；除了 `toHit`，还可以写 `"mode": "advantage"`、`"ignoresCover": true`(未达到全掩护的掩护一律不算) 和 `"ignoresLongRange": true`；`plus` 子项也可以写 `"marked": "sworn"`(oathbow 的 3d6 穿刺伤害)。生物数值块中的行动可以指定 `"ability": "str"`，即其攻击所用的属性，这样限定于某个属性的攻击或伤害改动就能作用于它。

物品攻击的 `modes` 项可以是使用武器的一种完全不同的方式（Capability API 1.190）：`"range": { "normal": 120 }` 是该模式下能打多远，使用规则集自身的距离单位；`"plus"` 像攻击自身的子项一样给命中加上子项；`"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }` 是一道闪电，站在持用者与目标之间的每个人（两者本身除外）都要在攻击掷骰之前对它进行豁免；`"charges": 1` 消耗物品自身相应数量的充能，因此只有在还有充能时才提供该模式（javelin of lightning：物品上 `charges.max` 为 1，`stack` 为 1）。直线需要有棋盘才能穿过。

带 `"cannot-heal"` 效果的战斗状态在持续期间阻止对其持有者的一切治疗，日志也会说明（Capability API 1.191）：5e 的 Chill Touch。战斗状态上的 `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]` 只在符合 `from` 的生物施加这些状态时才挡住它们；已经生效的仍然保留（Protection from Evil and Good）。法术的 `targetTypes.abilityAtLeast` 是下限，`abilityAtMost` 则是上限：`{ "int": 5 }` 会跳过 Intelligence 4 或以下的生物（Hideous Laughter），没有写该分值的生物不会被排除。豁免调整值的 `against.actions` 按 ID、名称或共用的充能组指定行动，不区分大小写，并收窄 `against` 所说的其他一切：`{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }` 是龙的吐息或 Frightful Presence，从不是它的 Wing Attack，而结束其中之一所施加状态的重复豁免也算在内。

物品攻击可以携带更多附加效果（Capability API 1.192）。`"ignoresResistance": true` 让其伤害穿透目标对攻击自身伤害类型的抗性（包括对一切伤害的抗性），而其他类型的 `plus` 子项仍会减半（vorpal sword 的挥砍伤害）；免疫仍然有效。`slay` 项的 `"saved"` 以与 `applies` 相同的形式列出状态，通过斩杀豁免的目标改为受到这些状态：`[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]` 就是 mace of disruption 让邪魔在持用者下个回合结束前一直惧怕持用者。`"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }` 让持用者在其施加了 `sworn` 的生物仍站着时，所进行的其他每次武器攻击都以该模式掷骰，或加上 `"ranged": true` 时只对远程攻击生效（oathbow）。此外，在没有棋盘的战斗中，范围行动（生物的或法术的）可以指向任意一方的人，但绝不指向施放者自己，因为它会卷入其中的每个生物；`friendlyFire: false` 让它只作用于另一方，与在棋盘上一样。

对抗可以是对照固定数字的检定，而不是双方对掷（Capability API 1.193）。省略 `defender`，并给出 `"difficulty": 15`；行动者掷其 `attacker` 检定中最好的一个，达到该数字即获胜。`"targets"` 说明可以对谁进行：`"enemy"`(默认)、`"ally"` 或 `"any"`，包括行动者自己。`"targetHolds": "wounded"` 只在目标带有该状态时提供，`"targetDying": true` 只在目标濒死且尚未稳定时提供。`onWin.stabilizes` 让濒死的目标稳定下来。因此，结束 sword of wounding 所造成伤口的 DC 15 Wisdom (Medicine) 检定写作 `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`，救助濒死者的 DC 10 检定写作 `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`。骰池战斗计算成功数，因此拒绝 `difficulty`。物品攻击的 `"healedOnlyByRest": true` 会封存它夺走的生命值：任何治疗都不能让持有者超过其最大值减去被封存的部分，任何休息都会恢复它们并解除封存。战斗状态的 `harms` 也接受同样的 `"healedOnlyByRest": true`，因此这把剑留下的伤口也会封存它们夺走的生命。

一种体型可以占据多于一格（Capability API 1.194）。给 `combat.sizes.order` 中的某项加上 `"cells"` 数量，`{ "id": "large", "label": "Large", "cells": 2 }`，该体型的生物在棋盘上每边占据这么多格，其自身格子是左上角那一格：5e 的 Large 为 2，Huge 为 3，Gargantuan 为 4。它会被放在能完全容纳它、且离要求站立处最近的位置。触及和射程以它所占据的最近一格为起止点，因此剑可以从 ogre 四格中任何一格的旁边打到它；它只走能完全容纳它的地方，也没有人能穿过它的任何部分；范围只要包含它的任何一格就会卷入它；推开会移动它的整体；能否看见它、它有多少掩护，都以它最无遮挡的那一格为准。没有 `cells` 的体型占据一格，与以前完全相同。

状态可以让持有者变大或变小（Capability API 1.195）。给 `combat.conditions` 中的某项加上 `"size": { "steps": 1 }`，在它生效期间，持有者沿 `combat.sizes.order` 向后移动这么多个体型，负数则向前，但不会越过第一个或最后一个：5e 的 Enlarge 是 `1`，Reduce 是 `-1`。其触及、范围对其的卷入，以及任何询问其体型的内容都读取新体型，状态结束时他们恢复原来的体型。在棋盘上，变大的人会在其原先站立的每一格之上铺开新体型，前提是那里是空地、没有其他人；否则采用能放下的、比它小的最大体型，因此在走廊中被放大的 ogre 只会长到走廊允许的大小；变小的人保留其左上角那一格。日志会说明谁变了、变成什么。它需要 `combat.sizes`；请搭配用于武器骰的 `damage` 调整值，以及用于法术其余部分的 Strength `checks` 和 `saves` 模式。

条目可以按目标剩余的生命来选取目标（Capability API 1.196）。其 `mechanics` 中的 `"healthPool": { "dice": "5d8" }` 在使用时掷一次，从剩余生命最少的目标开始依次分配：只有生命不超过剩余数值的目标才会受影响，并随即用掉相应数值，其余目标则完全不受影响，5e 的 Sleep 和 Color Spray 就是这样运作的；以更高等级施放时，`perCostStep` 会增加它。`"healthAtMost": 150` 只影响生命不超过该值的目标，如 Power Word Stun；`"kills": true` 直接杀死它所影响的人，因此 Power Word Kill 写作 `"healthAtMost": 100, "kills": true`。两者都读取目标剩余的生命，在 `targetTypes` 说明它能作用于谁之后才判断。日志会说明生命池掷出多少，以及够影响谁。

伤害调整值可以把一次打击自己的骰子多掷几遍（Capability API 1.197）。状态上的 `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }` 让 war pick 的 1d8 + 2 在其生效期间造成 2d8 + 2，就像被放大的 duergar 的武器那样；其固定部分保持不变，重击会像对其余部分一样把额外的骰子翻倍，菜单的平均值也会计入它们。它只改变打击造成的伤害，不改变其他任何东西。带 `"self": true` 的生物行动在其自己的回合执行时，现在会作用于生物自身，与在反应中一样，因此其 `applies` 会生效。

区域在触发时可以造成与其出现时不同的伤害类型（Capability API 1.198）。在自身 `damageType` 为 `"piercing"` 的条目上写 `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }`，会对墙出现时被围住的人造成穿刺伤害，对之后移入其中的人造成挥砍伤害，就像 5e 的 Wall of Thorns。它需要条目自身的 `amount`，以及造成该伤害的触发、侧面或冲撞；在规则集声明了 `combat.damageTypes` 时，须指定其中之一。

生命池可以跳过部分目标（Capability API 1.199）。与 `healthPool` 并列的 `"healthPoolSkips": { "conditions": ["unconscious"] }` 不影响带有其中任一状态的人，也不为他们花费生命池，就像 5e 的 Sleep 无视昏迷者；`"unseeing": true` 对看不见条目施放者的人（目盲，或与施放者之间没有视线）做同样的事，就像 Color Spray 无视看不见的生物。它指定 `conditions`、`unseeing` 或两者，并需要 `healthPool`。

墙可以分段竖立，各段逐一被打击和破坏（Capability API 1.200）。`"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }` 就是 5e 的 Wall of Ice：每块 10 英尺的墙板有 AC 12 和 30 点生命值，受到火焰伤害时加倍（`resist` 和 `immune` 的作用方式相同）。瞄准一个敌人或任何人并造成伤害的攻击，可以改为指向一段墙：其选项以 `walls` 列出它可以打击的格子，选择则以 `wall` 指定其中之一。攻击照常掷骰并造成伤害，就像针对生物一样，日志会说明该段受到多少、还剩多少。降到 0 的段被破坏：它不再阻挡，进入其中（或按其 `triggers` 的规定，在那里开始或结束回合）的人会受到其 `amount`，每回合一次，并以其 `save` 对抗条目自身的难度豁免，成功则减半（`onSave: "none"` 则为零）。分段需要带 `blocks` 的墙，破碎段的 `save` 需要条目自身的 `save`。

条目可以移动人物卡的实时轨道，并归还被封存的生命（Capability API 1.201）。`"tracks": [{ "track": "exhaustion", "by": -1 }]` 让它作用到的人减少一级力竭，就像 5e 的 Greater Restoration；带豁免的条目上的 `"by": 1`(Sickening Radiance) 让豁免失败者增加一级。每条轨道都保持在其自身范围之内，让生命最大值减半的等级会立即生效，达到带 `defeats` 的等级即被杀死。`"unseals": true` 归还只有休息才能恢复的生命（`seals` 打击夺走的部分），就像 Greater Restoration 结束对生命值最大值的削减。只以这种方式治愈的条目，只针对它能帮到的人提供。墙段的 `broken` 可以带自己的 `perCostStep`，施法每高于基础等级支付一级就加上一次：Wall of Ice 的寒气，`{ "dice": "1d6" }`。这里的轨道是普通轨道，不是伤势轨道，`unseals` 需要以点数计的生命。

条目施加的状态可以随它施加的另一个状态一起结束（Capability API 1.202）。5e 的 Hypnotic Pattern 写作 `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`，其中失能状态会在魅惑结束时一起结束：豁免、治愈、施法者的专注被打断、盟友把他们摇醒，或战斗结束。只有同一次使用施加的那个状态会随之结束，日志会说明原因。`endsWith` 指定同一 `applies` 列表（或 `onEnd`、`charge` 或 `saved` 列表）中的另一个状态，绝不能是它自己。

生物的行动可以降低目标的生命最大值（Capability API 1.203）。wraith 的 Life Drain 上的 `"reducesMax": { "save": "con_save", "difficulty": 14 }` 让目标在打击落下时进行该豁免；失败时，它受到的伤害既从生命中扣除，也从最大值中扣除，在休息之前任何治疗都不能恢复。带 `"lasting": true`(clay golem 的 Slam) 时，连休息也不行，只有带 `unseals` 的条目（Greater Restoration）才可以。最大值以这种方式降到 0 的目标会死亡。人物卡把任何休息都恢复不了的部分保存在 `sealed` 中，作为其池的 `lasting`。它需要以点数计的生命。

治愈可以只执行其中一种，而不是全部（Capability API 1.204）。带 `"cureOneOf": true` 时，`ends` 某些状态、移动 `tracks` 并 `unseals` 的条目（5e 的 Greater Restoration：魅惑、石化、一级力竭，或生命值最大值）只执行恰好一种：每种都作为该选项的一种模式提供（状态、轨道或生命池，以其标签表示），与武器的模式相同；没有选择任何模式的使用，会按此顺序执行目标第一个有对应内容的那一种。它至少需要两种治愈可供选择。

降低的最大值可以不需要自己的豁免（Capability API 1.235）。不带 `save` 和 `difficulty` 的 `reducesMax`，每次打击命中都按其伤害降低最大值（5e 的 vampire Bite）；带 `"onFailedSave": true` 时，只在目标没有通过条目自身的豁免时才降低（5e 的 Harm，一个带豁免的目录条目；在那里 `reducesMax` 从不带自己的豁免）。`damageType` 只计算该类型的伤害（Bite 的黯蚀伤害），`"heals": true` 让施放者恢复与降低量相等的生命值。目录的 mechanics 也接受 `reducesMax`，`leavesAtLeast` 让条目的伤害不会使目标的生命值低于这个数（Harm 保留 1）。生物行动或目录 mechanics 上的 `targetHolds` 限制它能指向谁：带有其 `conditions` 之一的人，或带有由该行动施放者施加的其 `fromSelf` 之一的人（Bite：被 vampire 擒抱，或失能或被束缚）。

状态可以给其持有者带来自己的使用方式（Capability API 1.236）。战斗状态的 `actions` 列出持有者在带有该状态期间可以使用的目录条目（`spells/break-enchantment`）：它们只在那时出现在菜单上，除了各自消耗的额度外，不从人物卡支付任何东西，并以持有者自己的数字掷骰，与其法术相同（会施法的生物使用其施法数值）。带 `"endsCondition": "<condition>"` 的条目在使用后结束其使用者身上的该状态，当维持该状态的专注属于使用者自己时，也一并结束那份专注：5e 的 Dispel Evil and Good，其 Break Enchantment 和 Dismissal 都会结束该法术。`ends.from`(类型和标签测试) 只治愈通过该测试的生物所施加的东西：Break Enchantment 结束由天界生物、元素生物、精类、邪魔或不死生物施加的魅惑或恐惧，而保留由其他任何人施加的。`dismisses` 把它作用到且未通过豁免的人送出战斗，对方仍然活着，但离开棋盘和行动顺序：`true` 表示永久（Dismissal），`{ "while": "<condition>" }` 表示在他们带有该状态期间，该状态必须由同一条目施加（5e 的 Banishment）。此时其计时按施法者的回合进行，当它因时间耗尽、豁免或施法者专注结束而结束时，他们会回到原来的位置，或回到最近的能容纳他们的空位。带 `gone`(类型和标签测试) 时，通过测试、且状态持续满全部时间的人会一直离开。

战斗开始时，部分参与者可以措手不及（Capability API 1.237）。由场景说明是谁：生成战斗的遭遇战会把他们标记为 `"surprised": true`，队伍或敌人都可以。在他们的第一个回合，他们不能移动或行动，菜单中只有结束回合；在那个回合结束或第一轮结束之前（以先到者为准），他们不能进行反应，也不能使用传奇动作。带 `"cannotBeSurprised": true` 的战斗状态让其持有者永远不会措手不及：5e 的 Foresight。带 `"ignoresSurpriseWith": "<catalog>/<entry>"` 的目录条目指定一种持有者在措手不及时仍可进行的使用，进行它会当场结束措手不及，因此回合余下的部分归他们所有：5e 的 Feral Instinct，让措手不及的野蛮人先进入狂暴就能正常行动。

目录条目可以让持有者在战斗第一轮获得第二个回合（Capability API 1.238）。在人物卡列表持有的条目上写 `"extraFirstTurn": { "initiative": -10 }`，会把第二个回合放在持有者自身先攻加上该数字的位置，排在该数字及以上的所有人之后；两个回合都是完整的回合，从第二轮起他们照常每轮进行一个回合。在第二个回合到来之前被击倒的持有者会直接错过它。带 `"unlessSurprised": true` 时，战斗开始时措手不及的人没有第二个回合：5e 的 Thief's Reflexes。

战斗状态可以把其授予的额度能买到的东西收窄为触及范围内的挥击，并在结束时在持有者的轨道上留下印记（Capability API 1.239）。带 `"grants": { "budget": "bonus", "attacks": true, "melee": true }` 时，该额度支付的那一次打击只能用在触及范围内打击的武器进行，投掷武器也只能用于其触及范围内的人，因为它是被挥动而不是被投出；有射程而没有触及的武器不会提供。`"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }` 在状态结束时（无论以何种方式结束）按等级移动持有者的实时轨道，与目录条目上的 `tracks` 相同；`applies` 和 `tracks` 可以一起出现，也可以单独出现。目录条目的 `"usesOf": "<row name>"` 消耗该行条目（其计数器行）的使用次数，而不是自己的。于是 5e 的 Frenzy 就是 Berserker 的一个条目 Frenzied Rage，带 `"usesOf": "Rage"`，它施加狂暴，以及一个随狂暴结束（`endsWith`）的 `frenzied` 状态，后者同时带有上述两项。

先攻可以掷两次，保留较好或较差的结果（Capability API 1.240）。`combat.initiative.checkAbility` 说明先攻是用该属性进行的检定，因此凡是让这类检定掷两次的东西，也会让先攻掷两次：带 `own-checks-advantage` 的状态（5e 的 Foresight），或带 `mode`、收窄到该属性或不收窄的 `checks` 调整值（Enhance Ability 在 Dexterity 上的 Cat's Grace）。人物卡列表持有的、带 `"initiativeMode": "advantage"`(或 `"disadvantage"`) 的目录条目，无论持有者带有什么，都会让其先攻掷两次：5e 的 Feral Instinct。优势和劣势与任何掷骰一样相互抵消；日志的先攻条目带有 `mode` 和被舍弃的那次投掷 `dropped`。每轮都投先攻的战斗每轮都会掷两次。仅限投掷的骰子：骰池先攻不会掷两次。

反应可以回应其持有者自身攻击的命中（Capability API 1.241）：带 `"by": "self"` 的 `"hit"` 反应，在攻击者的掷骰命中、且被打击命中的每个人都已回应之后提供给攻击者，并指向被命中者（写 `"at": "target"`）。`"weapon": true` 把任何命中时刻收窄为武器的打击：不来自任何目录的攻击，或生物的单目标行动。对自己命中的反应不会被阻止反应的东西阻止，因为选择它是攻击的一部分；除非它确实消耗额度，否则请标为 `"free"`。5e 的 Stunning Strike 就是一例：`"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`，免费、消耗一点 ki、一次 Constitution 豁免，以及持续到武僧下个回合结束的 `stunned`。带 `"addsToBlow": true` 时，攻击条目的数量会加入那次打击，而不是单独造成：在打击落下时掷骰，随其重击翻倍，其子项只作用于它们能触及的目标。5e 的 Divine Smite 是 2d8 光耀伤害，`perCostStep` 1d8，一个对 fiend 或 undead 以 `targetIs` 生效的 1d8 光耀子项，以及 `"perCostStepsMax": 3`：对任何带 `perCostStep` 或 `targetsPerCostStep` 的条目，表示更高费用最多计入几级。在另一个窗口内进行的攻击（借机攻击）从不会因命中而暂停，因此不会给它加入任何东西。

人物卡持有的东西可以改变其攻击行、授予打击，并等待攻击动作（Capability API 1.242）。人物卡列表持有的、带 `attackRows` 的目录条目，在其 `when` 界限成立时（人物卡上的一个值，例如所穿护甲至多为 0），改变名称列在其中的行（不区分大小写匹配）：`abilities` 在命中上，以及在该行伤害加上同一属性时的伤害上，使用该行自身属性与这些属性中最好的一个；`die`(`from` 一个人物卡值，经过阶梯 `table`，得到面数) 在平均值更好时，掷一颗该面数的骰子代替该行的骰子；`qualities` 增加打击穿透抗性所携带的性质。5e 的 Martial Arts 写作 `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`，Ki-Empowered Strikes 写作 `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`。持有条目的 `grantsStrike` 让持有者在攻击自身的额度用完后，用另一种额度购买一次打击，与状态的 `grants.attacks` 完全相同：`names` 把它收窄到这些攻击，`melee` 收窄到触及范围，`afterAttack` 收窄到进行过攻击动作的回合（`true`，或写 `{ "names": [...] }` 表示用其中之一进行的攻击动作）。Martial Arts 的额外徒手打击写作 `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`。状态的 `grants` 接受同样的 `names` 和 `afterAttack`。带 `afterAttack` 的条目只在攻击动作之后提供：Flurry of Blows 是一个使用 bonus 额度的 `utility` 条目，消耗一点 ki，带 `afterAttack`，`gives` 一个声明数量为 0 的额度 2 次，并带有一个在该额度上进行 Unarmed Strike 的 `grantsStrike`。攻击动作是指从攻击列表或物品进行、支付其自身额度或使用已买到打击的任何攻击，绝不包括由授予支付的攻击。

借机攻击会在命中处暂停，与回合中的攻击完全相同（Capability API 1.243）：会询问对该命中有回应的每个人，施放者最后回答，以加上自己的东西（Divine Smite、Stunning Strike），而行走自身的窗口（其打击者已回答）在打击落下后才继续询问。途中被定住的行走者（带 `speed-zero` 的状态，例如震慑或被擒抱）不会走出被打中的那一格。属于反应或加到另一次打击上的条目，永远不会被选作借机攻击本身。

攻击规则会作用于手持武器，攻击列表也可以给每张人物卡一行（Capability API 1.244）。`combat.attacks[].always` 列出最多 4 行，按该列表的列书写，每张人物卡的战斗除了自己的行之外都会有它们；同名的人物卡行会取代它。5e 的徒手打击写作 `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`。`attackRows` 规则的 `names` 现在也能按手持武器的攻击所用名称匹配，其 `items` 按标签匹配手持武器：`tags` 全部具备且 `notTags` 一个都没有（`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`，因此 dagger +1 也算）；规则指定 `names`、`items` 或两者。`wielding: { "only": {...} }` 带同样的 `names`、`tags` 和 `notTags`，只在手持的每件武器都属于其中、或没有手持武器时才保留规则：“徒手或只持武僧武器”。`grantsStrike` 接受同样的 `wielding`，以及与 `attackRows` 规则相同的 `when`，因此穿着护甲时不会提供 Martial Arts 的额外打击。

一次多次使用、降到 0 的豁免、指定攻击的命中，以及状态结束时的伤害（Capability API 1.245）。条目的 `usesSpent` 在一次使用中消耗其所在行（或 `usesOf` 的行）这么多次使用次数，并且只在还剩这么多次时提供：Quivering Palm 的 3 点 ki。`"hit"` 反应的 `names` 只回应这些攻击的命中，按名称不区分大小写匹配：Quivering Palm 写作 `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }`，施加一个持续很久的 `quivering` 状态。带豁免的条目上的 `dropsOnFailedSave` 让豁免失败的目标生命降到 0，而不是造成其数量的伤害（生物出局；在规则集有濒死规则时，角色进入濒死）；通过豁免的目标按豁免的 `onSuccess` 受到其数量的伤害。结束振动是一个行动，带 `targetHolds: { "fromSelf": ["quivering"] }`、10d10 黯蚀伤害、`onSuccess: "none"` 的 Constitution 豁免以及 `dropsOnFailedSave`。状态的 `onEnd.harm`(`dice`、`flat`、`type`、`unless`) 在状态结束时对其持有者造成伤害，来源是施加者，除非持有者属于 `unless` 指定的类型：Hurl Through Hell 是一个命中反应，带 `dismisses: { "while": "hurled" }`，`hurled` 持续 `{ "rounds": 1, "of": "source" }`，而 `hurled` 状态的 `onEnd` 是 `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`。

`afterAttack` 也会按标签匹配进行攻击动作所用的武器（Capability API 1.246）：`{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }` 表示在用这些名称之一进行攻击之后，或用一件 `tags` 全部具备且 `notTags` 一个都没有的手持武器（不论它叫什么）进行攻击之后，因此 dagger +1 也算。它指定 `names`、`items` 或两者，在条目上、`grantsStrike` 上或状态授予上都一样。

鲁莽与凶残的打击（Capability API 1.247）。带 `beforeAttack` 的条目只在持有者自己的回合、且在该回合攻击之前提供：Reckless Attack 是野蛮人身上的一个免费 `buff`，带 `beforeAttack`，施加持续 `{ "rounds": 1 }` 的 `reckless` 和持续 `{ "rounds": 1, "at": "turn-start" }` 的 `exposed`。对攻击的改动像对伤害的改动一样接受 `attacks`(`weapon`、`spell` 或 `any`) 和 `blow`(`melee` 或 `ranged`)，以及 `ability`：`reckless` 写作 `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`，`exposed` 带 `attacks-against-advantage` 效果。伤害改动的 `criticalDice` 只在重击时加上这么多颗打击自身的伤害骰，且不翻倍：Brutal Critical 是野蛮人某个派生值上的等级，带 `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`，每颗骰子一个等级。

对连击命中的回应（Capability API 1.248）。`hit` 时刻的 `budget` 把它收窄为由该额度支付的打击所造成的命中：Open Hand Technique 回应 `{ "on": "hit", "by": "self", "budget": "flurry" }`，即 Flurry of Blows `gives` 并由其 `grantsStrike` 消耗的额度。反应的 `oneOf` 指定一组对持有者自身命中的回应，每次命中只能采用其中一个：Open Hand Technique 是三个共用 `"oneOf": "open-hand"` 的免费条目，一个带 Dexterity `save` 并施加 `prone`，一个带 Strength `save` 和 15 的 `push`，还有一个施加带 `cannot-react` 效果、持续 `{ "rounds": 1, "at": "turn-start" }` 的状态。采用其中一个会用掉这次命中的另外两个；下一次命中会再次提供全部三个。`oneOf` 写在 `by` `self`、不带 `also` 的 `hit` 时刻上。

掷骰之后的补救（Capability API 1.249）。带 `"rescue": true` 的 `attacks`、`saves` 或 `checks` 改动会在掷骰时先保留：只有当持有者自己的掷骰差一点、而它的最大值（固定部分加上每颗骰子的最高面）能补足差距时，才会掷出并加上它，它所来自的状态也随之用掉。无法扭转结果的掷骰会保留它。Bardic Inspiration 是施加给盟友的一个状态，带 `{ "to": "saves", "dice": "1d6", "rescue": true }`，`attacks` 和 `checks` 也一样（每种骰子大小一个状态，像其他档位一样按吟游诗人的等级选择）；Guidance 是带 `1d4` 的 `checks`，Resistance 是带 `1d4` 的 `saves`。自然未命中永远不会被补救，骰池战斗不保留任何东西。条目的 `rescue` 让它离开菜单：在持有者自己的同类掷骰失败时，它会连同使用次数和费用一起被用掉。`{ "roll": "saves", "by": "reroll" }` 重掷豁免，以新结果为准（Indomitable 用自己的使用次数；Diamond Soul 以 `usesOf` 使用 Ki）；`{ "roll": "attacks", "by": "success" }` 把未命中变为命中，`{ "roll": "checks", "by": "success" }` 把失败的检定变为成功（Stroke of Luck）。保留的改动会先尝试。

Cutting Words 与 Evasion(Capability API 1.250)。条目的 `lowersRoll` 在别人的攻击命中时、于不带 `by` 的 `hit` 反应上采用（用 `for` 和 `within` 为盟友回应）：其 `dice`，或像 Martial Arts 那样按某个值确定大小的一颗 `die`(`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`)，会从掷骰中扣除，然后再与防御比较一次；自然命中仍然命中。Cutting Words 是一个免费 `debuff`，带 `{ "on": "hit", "for": "ally", "within": 60 }`，并以 `usesOf` 使用吟游诗人的激励计数器。战斗状态或等级的 `evasion` 指定豁免：对抗成功时减半的效果，豁免成功则不受伤害，失败则只受一半。Evasion 是游荡者或武僧等级上的一个等级，带 `"evasion": ["dex_save"]`。

Lay on hands(Capability API 1.251)。条目的 `usesChosen` 让使用者选择一次使用消耗多少次使用次数，从一次到剩余的全部，并治疗相应倍数的数量。选项带有 `amount: { max }`，选择则发送 `amount`；省略时，消耗按平均值能把第一个目标完全治好的次数。它用于没有 `usesSpent` 的 `heal`。Lay on Hands 是 `"amount": { "flat": 1 }` 的 `heal`，以 `usesOf` 使用每圣武士等级五点的计数器，带 `usesChosen` 和 `"targetTypes": { "not": { "types": ["undead", "construct"] } }`。

Font of magic(Capability API 1.252)。条目的 `restore` 在 `heal` 或 `buff` 上为它作用到的人恢复某个池：实时池用 ID 指定，列表行的池用其名称指定（`"Sorcery Points"`）。当 `cost` 位于一个池组中时，`perCostStep` 会为高出最便宜一级的每一级增加它，因此术士的法术位会变成等于其等级的 Sorcery Points：一个消耗 `slots_1` 的自身 `buff`，带 `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }` 和 `"perCostStep": { "flat": 1 }`。`overMax` 允许它超过池的最大值；超出的部分单独保存，在休息把池恢复到最大值时消失。用点数制造的法术位是每个等级一个条目，以 `usesOf` 使用点数，`usesSpent` 为其价格，并带 `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`。为使用者自己恢复其并不拥有的池的条目，不会出现在其菜单上。

Metamagic(Capability API 1.253)。条目的 `alters` 改变其 `catalogs` 中条目的使用方式：它自己从不出现在菜单上，而是随每个适用的条目一起提供，在使用该条目时选择，并用自己的使用次数支付（以 `usesOf` 使用 Sorcery Points，配合 `usesSpent`，或按法术支付等级的 `usesSpentByLevel`，至少一点）。它是不带反应的 `utility`。每次使用只能有一个，除非它 `joins` 另一个。它能改变的内容如下，每种只适用于它确实有东西可改的法术：`spares`(人物卡上的一个值：它卷入的使用者及其盟友中，有这么多人直接通过其豁免：Careful)、`range`(`{ "times": 2, "touch": 30 }`：Distant)、`rerolls`(低于平均值的这么多颗伤害骰重新投掷，从最低的开始：Empowered，带 `joins`)、`lasts`(它施加的持续一分钟或更久的东西，持续时间变为这么多倍，但不超过一天：Extended)、`heightens`(其第一个目标的第一次豁免带劣势：Heightened)、`budget`(`{ "from": "action", "to": "bonus" }`：Quickened)、`drops`(此后不再需要的成分，并且没有人能回应它的施放：Subtle) 和 `twins`(为单目标、并非只能作用于使用者自身、且不因更高法术位获益的法术增加一个目标：Twinned)。眼下只能借助其中某一项才能施放的法术（动作用完后的 Quickened、Silence 中的 Subtle）会带 `alterNeeded` 提供，选择必须带上它。选择发送 `alters`，即选项 `alters` 中的 ID；日志写 `altered`。

选择时的 Metamagic(Capability API 1.254)。`rerolls` 在法术的所有伤害骰中重投最低的那些，总共不超过这么多颗：它自己的、`plus` 中每个子项的，以及重击时剩余数量范围内的额外骰子。攻击法术对它命中的每个目标分别掷这些骰子。当 `spares` 改动卷入的使用者一方人数多于它能放过的人数时，由使用者选择放过谁：选项的 `alters` 提供中带有 `spares`(数量)，选择则发送 `spares`，即使用者一方要放过的人的 ID(一个都不写就谁也不放过)。省略时，放过它最先卷入的人。这个选择在回应施法的窗口中保持有效。在不放过任何人的改动上写 `spares`、ID 多于它能放过的人数、同一 ID 写两次或写了另一方的 ID，都会以 `bad-alter` 拒绝。

Heightened 的目标与 Acid Arrow(Capability API 1.255)。当 `heightens` 改动卷入多于一人时，由使用者选择谁的第一次豁免带劣势：选项的 `alters` 提供中带有 `heightens: true`，选择则发送 `heightens`，即一个参战者的 ID(在它指向某些人时，必须是它所指向的人之一，并且绝不能是使用者自己)。省略时，取它最先卷入的人。带 `halfOnMiss: true` 的条目（必须有 `attackRoll` 和 `amount`）在未命中时仍造成一半伤害，其子项也一样，但不产生命中时的其他任何效果。`applies` 项的 `harmsPerCostStep`(`{ "dice": "1d4" }`) 让该状态的 `harms` 在其施加时每高出一级费用就多造成这么多：Acid Arrow 的后续酸蚀伤害，法术位每比 2 环高一级多 1d4。

持有者自己的补救、从不作用于使用者的条目，以及一次只能有一个的状态（Capability API 1.256）。条目的 `rescue` 也可以是 `by: "twenty"`(只能配合 `roll: "checks"`)：失败检定的 d20 视为 20，只在这样能让检定成功时才用掉，就像 Stroke of Luck 对属性检定所做的那样。`by: "die"` 在给予持有者的任何东西都无法补足差距、而这颗骰子可以时，加上一颗持有者自己的骰子：`dice`(`"1d10"`，Dark One's Own Luck)，或按人物卡上的值确定大小的一颗 `die`，`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`(Peerless Skill)。给予他们的状态会先尝试。指向 `ally` 或 `any` 生物的条目上的 `notSelf: true` 让它不能作用于使用者自己：Bardic Inspiration。战斗状态的 `oneAtATime` 指定一个组（`"bardic"`）：当一个生物带有该组的一个状态时，该组的其他状态（包括同一个状态）都不会生效；状态事件写 `already`。

回应更多种类的掷骰（Capability API 1.257）。`lowersRoll` 还可以列出 `"also": ["checks", "damage"]`：除了命中的攻击掷骰，它的骰子还会在别人的属性检定（擒抱之类的对抗、物品的 gate、Counterspell 的检定）或伤害掷骰进行时从中扣除。这种用法会自动用掉，连同条目的额度、使用次数和费用，由另一方中第一个其条目能触及掷骰者的人使用，并且只在其最大值能扭转掷骰时才用掉：本会成功、扣除后可能失败的检定，或本会让其持有者一方某人倒下、扣除后可能让其继续站着的伤害。Cutting Words 写作 `{ "dice": "1d6", "also": ["checks", "damage"] }`，其骰子大小按等级确定，带 `needs: ["hearing"]` 和 `targetTypes: { "notImmuneTo": ["charmed"] }`。补救可以指定 `saves`(只适用于 `saves` 的补救)：它只在这些豁免上用掉。带 `budget` 时，它还会消耗一份该额度，没有该额度时不会用掉：ring of evasion 写作 `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }`，以其充能作为使用次数。物品的使用也可以带 `halfOnMiss`，配合 `attackRoll` 和 `amount`：Acid Arrow 卷轴。

疾病（Capability API 1.258）。战斗状态的 `kinds`(`["disease"]`) 说明它是哪种状态。种类绝不能是状态自己的 ID。治愈的 `ends` 可以用种类代替状态：该种类的每个状态都计入，而其 `count` 仍只移除这么多个，因此 Lesser Restoration 的“一种疾病”写作 `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`。免疫（生物或物品的 `conditionImmunities`，或状态或等级的免疫）也可以指定种类：Divine Health 是一个带 `"conditionImmunities": ["disease"]` 的状态。`saveEnds` 可以计数：`successes`(2 到 10) 是结束它所需的成功次数，`failures`(`{ "count": 3, "becomes": "blinding_sickness" }`) 在这么多次豁免失败后，改为施加 `becomes`，不带计时，也不再豁免。状态事件写 `worsened`。这就是 Contagion：一个在每个回合结束时进行豁免的 `until-save` 状态，成败各三次。没有计时的状态在战斗结束时不会解除，因此已经发作的疾病会在战斗之后持续，直到有东西治愈它。

穿戴物品上的补救（Capability API 1.259）。物品的 `use` 可以像条目的 mechanics 一样带 `rescue`，包括 `saves` 和 `budget`。它从不出现在菜单上，只在物品处于穿戴状态（有槽位时）、且有其使用所消耗的 `charges` 时才会用掉。用掉它会消耗一点充能。ring of evasion 是一件带 `"charges": { "max": 3 }` 和 `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }` 的物品。其充能按物品的 `recharge` 恢复。

战斗之间的疾病（Capability API 1.260）。战斗状态可以带 `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }`：持有者在带有它时每进行一次这些休息，在休息恢复其应恢复的内容之后，生命的最大值就降低这么多，在休息时掷出。没有 `lasting` 时，下一次休息会恢复它；有它时，只有解除封存的东西才能恢复。`onRest.save: { "save": saveId, "difficulty": 15, "cures": true }` 会先掷，与规则集的检定一样，并使用人物卡自身的调整值：只有失败才降低最大值，带 `cures` 时成功会结束该状态（otyugh 的疾病）。只有以点数计的生命才有可降低的最大值。5e 的 Mummy Rot 是一个没有计时的状态，带 `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`。计数到结束或到转变的豁免（1.258）不再随战斗结束而停止：任何战斗结束时（包括逃跑），持有者剩余的回合豁免都会掷完，因此 Contagion 到那时要么被摆脱，要么已经发作。只在受伤时进行的豁免会等到受伤时。

疾病的阶段（Capability API 1.261）。战斗状态可以带 `onDamaged: { "applies": [...] }`，每次持有者受到伤害时施加给他们，计时方式与 `onEnd` 的相同（Slimy Doom 的震慑，持续到持有者下个回合结束）；`expires: { "becomes": conditionId }`，在其自身计时耗尽时（包括战斗结束）转变成的状态，不带计时，但以其他方式结束时不会转变（aboleth 的 Tentacle 疾病在一分钟之后）；以及 `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`，只有以该等级或更高等级支付的、来自这些目录的治愈才能结束它。`onRest.restoredWhenCured: true`(配合 `lasting`) 在该状态解除时（无论以何种方式，包括自身豁免成功），归还其休息从最大值中夺走的部分。`cannot-heal-nonmagical` 效果挡住除魔法治疗以外的一切治疗：战斗中是性质写有 `"magical"` 的行动，战斗外是带 `"magical": true` 的恢复操作（标记为 `magical` 的药水就是一例），休息永远不算；被拒绝的恢复会写 `cannot-heal`。数值块中的行动可以像目录条目一样带 `ends`，包括种类：unicorn 的 Healing Touch 写作 `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`。由施法者在其状态中选择的治愈（多个诅咒中的一个）使用 `cureOneOf`(1.204)。

生物行动上的性质（Capability API 1.262）。数值块中的行动可以像目录条目一样带 `qualities`，即规则集声明的物品标签：`["magical"]` 让它的治疗成为魔法治疗，可以穿过 `cannot-heal-nonmagical`，针对它的豁免也算作针对魔法的豁免。物品在战斗中的使用以同样方式带上物品自身的标签，因此标记为 `magical` 的药水在战斗中也像在人物卡上一样以魔法方式治疗。

光环（Capability API 1.263）。战斗状态可以带 `auras`，最多四个：每个都把其 `conditions` 散布给站在持有者 `distance` 之内的人，范围按 `side` 为 `allies`、`enemies` 或 `all`，加上 `self: true` 时也作用于持有者本人（不能与 `enemies` 同用）。`when` 用 `atLeast` 或 `atMost` 读取持有者人物卡上的一个值，因此光环可以在某个等级开启。倒下、被击败或带有 `cannot-act` 效果的持有者不散布任何东西。光环散布的东西随战斗推进而生效，在两者分开时移除（日志写 `aura` 和 `parted`），从不写入人物卡，并在战斗结束时消失；光环散布的状态本身不能再带光环。没有棋盘时，光环会触及其一方的每个人。要让持有者在每场战斗开始时就带有该状态，请给目录条目的 mechanics 或数值块加上 `keepsOn`：它在整场战斗中持有的状态，同样从不写入人物卡。5e 的 Aura of Protection 是一个保持的 `aura-of-protection`，其光环散布一个把圣武士的 Charisma 加到豁免上的状态；Holy Nimbus 是一个作用于敌人的光环，其状态在敌人回合开始时造成伤害。

强制行为（Capability API 1.264）。战斗状态可以带 `behavior`，决定持有者在其回合做什么。`only` 列出回合中除结束回合之外能做的所有事：`move`(行走和起身)、`escape`(挣脱束缚) 以及规则集声明的标准行动；空列表只留下结束回合（Command 的 halt）。`onlyWhenStuck` 指定只有在无处可走时才允许的标准行动（Turn Undead 的 Dodge）。`moves: "away"` 只能远离施加该状态的人行走，绝不靠近一步，结束时离得更远；`moves: "toward"` 只能靠近（Command 的 approach、Sympathy）。`table` 在持有者每个回合开始时掷一次，`{dice, rows: [{atMost, does}]}`，掷骰结果不超过的第一行决定这个回合：`wander` 朝 d8 选出的方向走完全部速度并结束回合，`nothing` 直接结束回合，`strike` 只允许对骰子选出的、在触及范围内的一个生物进行近战攻击（不论敌友；那里没人则什么也不做），而 `normal` 与高于每一行的掷骰一样，不干预这个回合（Confusion、Mindfire）。日志把这次掷骰显示为 `compelled` 事件，其他任何行动都会以 `compelled` 拒绝。结束状态的豁免也可以是 `at: "action"`：持有者花费其动作进行该豁免（Irresistible Dance）。

光环的更多用法（Capability API 1.265）。光环的 `conditions` 现在是可选的，只要它散布状态、造成伤害或要求豁免即可。`needs` 列出接收者必须具备的感官，持有者和接收者都不能站在 `inside.conditions` 会夺走这些感官的区域中：带 `needs: ["hearing"]` 的 Countercharm 会被 Silence 阻断。`harms` `{dice, flat, type}` 在持有者自己的每个回合开始时，由持有者对光环触及的每个人造成（balor 的 Fire Aura）。`save` `{save, difficulty, applies, seen?, immuneOnSuccess?}` 由光环触及的每个人在其自己的回合开始时进行：失败时以该难度施加来自持有者的 `applies`，`seen` 只在两者能互相看见时才要求豁免（basilisk 的凝视），`immuneOnSuccess` 在成功之后，让该持有者的光环在战斗余下时间内不再作用于他们（pit fiend 的 Fear Aura）。豁免调整值的 `against.casts` 把它收窄为针对从这些目录施放之物的豁免（包括从其中施法的物品使用），然后再按它指定的其他内容收窄：Holy Nimbus 对邪魔或不死生物所施法术的优势写作 `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`。

更多强制行为（Capability API 1.266）。`behavior` 可以带 `drops` `{slots?, tags?, at, pickUp?}`：持有者放下占用 `slots` 之一或带有 `tags` 之一的每件穿戴物品，以及 `qualities` 带有 `tags` 之一的每个数值块行动，时机是状态生效时（`at: "applied"`，Fear 的“丢下手中所持之物”），或持有者每个回合开始时（`at: "turn-start"`，Command 的“丢下”）。掉落的东西留在他们原本站立的格子上：它的行动都不再属于他们（以 `dropped` 拒绝），它不再给予穿戴时给予的任何东西，它在持有者防御中所占的部分也消失（盾牌的 2）。他们站在那一格或其旁边时可以捡起它，使用回合中的一次免费拾取，或在状态指定了 `pickUp` 额度时消耗该额度；日志显示 `letFall` 和 `pickedUp`。`onlyWhenStuck: "any"` 让开始时按状态允许的方式无处可走的回合，完全归持有者自己支配（Fear 的“除非无处可移动”）。`keepsOut` 是与施加该状态之人的距离：在这个距离之内，持有者只能往更远处走，并且只要距离之外的任何位置可以到达，就只会停在距离之外（Turn Undead 的“不能主动移动到距离你 30 英尺以内的空间”）。结束状态的豁免可以是 `unseen: true`，只在持有者看不见施加者时才进行（Fear 在视线之外的豁免）。条目的 `applies` 可以带 `destroysUpTo` `[{tier, when?}]`：豁免失败、且其威胁档位不高于使用者人物卡上 `when` 成立的最高 `tier` 的生物，会被直接摧毁（Destroy Undead，牧师 5 级时 CR 1/2，到 17 级时 CR 4）；角色或没有档位的生物永远不会。

按任一感官选取目标、彼此靠近的目标、增长的范围、更多使用方式以及持有物（Capability API 1.267）。`needs` 感官的条目或生物行动可以加上 `needsAny: true`：保有其中任意一种的目标即符合条件，只有全部缺少的目标才会被拒绝（Turn Undead 的“每个能看见或听见你的不死生物”）。`targetsWithin` 是所选目标两两之间必须在其之内的距离，否则以 `targets-apart` 拒绝（Command 在更高法术位时的多个生物须“彼此相距 30 英尺以内”）。`area` 可以带 `sizePerCostStep`，即其费用每提高一级，大小增长的距离（Confusion 的球体每高一环增长 5 英尺）；墙永不增长。带 `use` 的物品可以列出 `moreUses` `[{label, use}]`：每项都是另一个菜单条目，以物品名称和其 `label` 命名，使用相同的充能，并随物品一起掉落（多法术的魔杖）。生物可以列出 `held` `[{label, tags, defense?}]`，即它持有、但并非其自身行动的东西（数值块上印着的盾牌）：`drops` 指定了其 `tags` 之一的状态，会让它们连同带该标签的行动一起掉落，它们的 `defense` 会从生物自身的防御中消失，直到生物捡起它们，每样东西的捡起方式都与掉落的物品相同。

凝视，以及按触及对象区分的光环（Capability API 1.268）。光环可以带 `targetTypes`，读法与条目的相同：它只触及属于该类型的人（sea hag 的 Horrific Appearance，只对类人生物）。`sourcesOf` 指定状态：它只触及对其持有者施加过其中某个状态的人（barbed devil 的 Barbed Hide，伤害擒抱它的人）。光环的 `save` 可以带 `failedBy` `{atLeast, applies}`：失败幅度至少达到该值时，改为施加这些状态（medusa 的凝视，失败 5 或更多时直接石化）。`seen` 豁免可以带 `avert: true`：它触及的人可以在自己的回合免费将目光从其持有者身上移开；在他们再次看过去之前（这同样是他们自己的免费选择），他们跳过该豁免，也看不见持有者，因此他们对它的攻击视为在看不见的情况下进行；日志显示 `averted`，只要还有其他人在战斗，调度器就会让其生物保持移开目光。结束状态的豁免可以带 `seenLean`(`"advantage"` 或 `"disadvantage"`)：在持有者能看见施加者时，以此方式掷骰（sea hag 的重复豁免，她在视线内时带劣势）。

用持有者数值施法的法杖（Capability API 1.269）。物品的 `use` 可以用 `sheetDifficulty` 从持有者的人物卡读取其豁免难度，读取方式与 `toHit.sheetBonus` 读值相同（`{ "derived": "spell_save_dc" }`），代替 `saveDifficulty`；其攻击加值本来就以同样方式从人物卡读取，用 `toHit.sheetBonus`(`{ "derived": "spell_attack" }`) 且不带属性。带 `charges` 的使用可以带 `chargeStep` `{max, amount?, targets?}`：使用者最多可以多花 `max` 点充能，每点算作更高一级的费用，像更高法术位增加 `perCostStep` 和 `targetsPerCostStep` 一样增加 `amount` 和 `targets`，并用 `sizePerCostStep` 扩大范围（Staff of Power 以更高等级施放的法术、Staff of Striking 每点充能 1d6 力场伤害）。菜单以名为 `charges:<how many more>` 的支付方式提供它们，数量以物品剩余的充能为限。同一小版本把规则集可声明的状态数量提高到 320，光环的 `save` 还可以带 `immuneWhenEnds: true`：一旦失败所施加的东西结束（无论是豁免、计时还是治愈），该持有者的光环在战斗余下时间内不再作用于他们，就像 `immuneOnSuccess` 在豁免成功后让光环不再作用于他们一样（sea hag 的“豁免成功或效果对其结束”）。

施放时指定的种类（Capability API 1.270）。带 `applies` 的目录条目 `mechanics` 可以带 `kindChoice: true`：使用者在使用时指定 `combat.creatureTypes` 中的一项（类型或标签），以模式 `kind-<id>` 提供，它施加的东西会记住这个种类。它所施加之物的光环带 `chosenKind: true` 时，只触及该种类的生物；带 `orSeen: true` 时，还会触及能看见其持有者的人，无论距离多远。因此 5e 的 Antipathy 会在目标身上施加一个状态，其光环（`side: "all"`）让 60 英尺内或视线内的所选种类陷入恐惧，被恐惧者会远离（`moves: "away"`），而 Sympathy 的被魅惑者会靠近。状态的 `saveEnds` 可以带 `beyond`，以规则集的距离单位计：只有当持有者与施加者的距离超过该值时才进行豁免，加上 `unseen` 时还需不在其视线内（Antipathy 的“不在目标 60 英尺内，也看不见它”）。

法杖和戒指的更多作用（Capability API 1.271）。物品的 `use` 可以带 `label`，像 `moreUses` 项的标签一样显示在物品名称旁（“Staff of Fire: Burning Hands”）；其他用法以各自的 `label` 命名。使用可以带 `amountAdd`，即从持有者人物卡读取并加到其数量上的值，与目录条目的相同（Staff of Healing 的 Cure Wounds，`{ "abilityModFromField": "spellcasting_ability" }`），在战斗中和战斗外都有效。`chargeStep` 可以带 `push`，以规则集的距离单位计：每多花一点充能，就把目标再推远这么多，与使用自身的 `push` 叠加（Ring of the Ram 每点充能 5 英尺）。物品的 `charges.breaksOn` 可以带 `regains` `{atLeast, amount}`：在最后一点充能用掉、且其骰子显示 `atLeast` 或更高时，物品改为恢复 `amount` 点充能（Staff of the Magi 在掷出 20 时恢复 1d12 + 1），在战斗中、战斗外以及物品栏消耗充能时都适用；对永不损坏的物品，此时可以省略 `atMost`。

变成另一件物品的物品（Capability API 1.272）。物品的 `charges.breaksOn` 可以在 `atMost` 旁边带 `becomes`，即规则集中以 `<catalog>/<entry>` 指定的另一件物品：在会让它损坏的点数上，物品改为变成那件物品（Staff of Striking 变成非魔法的长棍，或 Staff of Power 变成只保留 +2 的物品，后者写成一件只带这一项的物品）。在战斗中，它的使用方式随之消失，此后以新物品的身份打击，战斗会把那一叠作为该物品写回，使用其名称且不带充能；在战斗外以及物品栏消耗充能时，那一叠也以同样方式改变。所指定的物品必须是规则集中的另一件物品，无论它在哪个目录文件中。

命中时消耗的充能（Capability API 1.273）。武器的 `attack.spends` 列出最多四种方式，让持有者在用它打出的一击命中后消耗物品的充能：每种都有 `label`、所需的 `charges`、加到这次打击上的骰子与固定部分 `amount` 及其伤害 `type`(未指定时为武器的类型)，以及可选的 `blow`(只限 `melee` 或 `ranged` 打击)、`chargeStep`(最多再花 `max` 点充能，每点再加一次其 `amount`：Staff of Striking 每点充能 1d6 力场伤害，最多三点) 和 `onHit`(被命中者受到的最多两个状态，每个带 `rounds`、能挡住它的 `save`，或 `saveEnds`：Staff of Withering 的 Constitution 豁免)。在战斗中，每种方式只在持有者用这把武器命中时提供给持有者，在被命中者回应之后提供；其骰子随打击一起掷出，并随其重击翻倍，物品的最后一点充能骰也像使用时一样掷出。该物品须持有充能。

按施加者确定的数字（Capability API 1.274）。条目 `applies` 的状态可以带 `value`，即在状态生效时从施加者人物卡读取的值引用（Heroism 的 `{ "abilityModFromField": "spellcasting_ability" }`）；战斗状态的 `temporary` 在持有者每个回合开始或结束时（`at`）给予其临时点数：`dice` 和 `flat`，带 `value: true` 时再加上该值；带 `lostWhenEnds` 时，状态结束时剩下的临时点数会随之消失，除非持有者从别处获得的临时点数比它给的更多。光环的 `save.appliedDifficulty` 让其豁免对抗把光环状态施加到其持有者身上的那个东西的豁免难度，在状态生效时确定（Antipathy/Sympathy 施法者的法术豁免 DC）；对没有被任何东西施加的光环，仍使用其 `difficulty`。`at: "damaged"` 时结束状态的豁免可以写 `bySource`：只在施加者造成伤害时才进行（Sympathy 在目标伤害其持有者时的豁免）。状态的 `behavior.keepsIn` 让持有者一旦进入与施加者相距该距离之内，就再也不能往更远处走（Sympathy 的“不能主动远离”）。此外，物品的 `use` 可以像条目的 mechanics 一样带 `kindChoice`(1.270)，因此 Antipathy/Sympathy 的卷轴会在使用时指定其种类。

被压制而非结束的状态（Capability API 1.275）。与 `whileSourceInSight` 并列，战斗状态的 `orSourceWithin`(以规则集自身单位计的距离) 让它在持有者离施加者这么近时持续生效，无论看不看得见：既不在视线内也不在距离内时，它被压制，仍留在持有者身上，计时照常运行，一旦其中任一条件成立就立即重新生效（Antipathy 的恐惧，在 60 英尺内或视线内）。战斗状态的 `suppresses` 列出它生效期间压制的其他状态：它们的作用停止，但仍留在身上，并在它结束后重新生效（Calm Emotions 的魅惑和恐惧、Mindless Rage 的同类状态）。

传送（Capability API 1.276）。目录条目的 `mechanics.teleport`、物品的 `use.teleport` 或生物行动的 `teleport`，会立即把使用者移到 `distance`(规则集自身单位) 之内的一个空位：中间没有任何一步，因此没有人能在其离开时打击，它落入的区域会像走进去一样卷入它。只在棋盘上有效，因此需要 `combat.distance`；没有棋盘时，只会传送的行动不会提供。带 `seen` 时，只能去使用者此刻看得见的位置（墙、雾，或夺走视力的目盲会把其后的格子排除在列表之外）：5e 的 Misty Step，`{ "distance": 30, "seen": true }`。`carries`(1 到 8) 从 `carriesWithin` 之内（省略时为接触距离）带上使用者一方这么多个自愿的、体型不大于使用者的生物，每个都落在尽可能靠近使用者的空位：Dimension Door，`{ "distance": 500, "carries": 1, "carriesWithin": 5 }`。带传送的生物行动作用于生物自身（blink dog 的 Teleport）。选项以 `teleport.cells` 列出它能去的格子，以 `teleport.carries` 列出可以同行的人；选择以 `at` 指定格子，以 `carries` 指定同行者。传送永远不是范围或反应。

一次六个状态，以及真正看得见的视线（Capability API 1.277）。目录条目的 mechanics、物品的使用和生物行动上的 `applies` 最多容纳 6 项（之前为 4）：Rage 和 Frenzy 都在各自的四项旁加上 Mindless Rage 的状态。`whileSourceInSight`(以及与之并列的 `orSourceWithin`) 现在读取持有者自身的视线，与光环的 `orSeen` 相同：棋盘上仍需要一条无遮挡的直线，在此之上，持有者还必须用眼睛或感官看见其来源，因此夺走视力的目盲、起遮蔽作用的雾、超出其视野的黑暗，或它看不见的来源（隐形），都会像墙一样打断它。

Calm Emotions(Capability API 1.278)。豁免可以写 `alliesMayFail: true`(在目录条目、物品使用或生物行动的 `save` 上)：使用者自己一方的目标会放它进来，不掷骰直接失败，日志也会说明，而其他人照常掷骰。状态的 `effects` 可以带 `cannot-target-source-side`：持有者不能把任何东西指向施加者或其一方的任何人，除非那一方就是持有者自己的一方（此时它不排除任何人）。`endsWhen` 在 `damaged` 和 `harmed-by-source-side` 之外再接受两种结束方式，最多四种全用：`attacked`，任何人对持有者进行的攻击掷骰，无论命中与否（不掷骰就命中的行动不算）；以及 `ally-harmed-in-sight`，持有者看见其一方的其他任何人受到伤害（棋盘上有无遮挡的直线，且有它自己的眼睛或感官）。`endsWhenHarmedFrom` 列出目录：任何人从其中某个目录施放的任何东西（包括卷轴的法术和持续区域）对持有者造成伤害，都会结束它；伤害是指受到伤害，或成为有害行动的目标，与 `harmed-by-source-side` 相同，而对其再次施加同一状态会刷新它，而不是结束它。这些都会等到引起它的那一步完成后才生效。此外，持有者自身生效中的状态所 `suppresses` 的状态，不再会因同一状态给予的免疫而结束：它是被暂停，而不是被治愈，因此在免疫恐惧的狂暴开始时已有的恐惧，会在狂暴结束时回来（5e 的 Mindless Rage），而新的恐惧仍然无法施加。

传送出战斗、可见的同行者与烟雾（Capability API 1.279）。`teleport`(在目录条目、物品使用或生物行动上) 再接受三个键。`leaves: true`：它可以把使用者完全带出战斗，就像 unicorn 的一英里传送，而不是送到某一格；此时选择不指定 `at`(菜单显示一个“Leave the fight”按钮)，使用者及其同行者都活着离开（显示为“Left the fight”，生命保持不变，且没有任何东西能把他们带回来）。没有棋盘时，离开是它唯一能去的地方，使用者一方任何站着的人都可以同行，因为没有东西能测量谁站得近。有成员以这种方式离开、自身已不在战斗中的队伍视为逃跑（结果为 `fled`，与逃跑一样结束战斗）；以这种方式离开的敌人既不算被击败，也不算仍站着，而是逃脱了，战后回顾也会这样说明。调度器自己的生物在生命降到四分之一或以下时离开，并尽量带上同行者。`carriesSeen: true`(配合 `carries`)：只有使用者看得见的人才能同行，即 unicorn 的“它看得见的自愿生物”。还有 `smoke`(`{}`，或 `{ "pierced": [senses] }`)：从落地那一刻起，直到使用者下个回合结束，在使用者离开的格子和落入的格子上都会出现一团烟云，像区域的 `obscures` 一样起遮蔽作用，即 Cape of the Mountebank 的烟雾。

带打击的传送（Capability API 1.280）。生物的传送可以用 `strike`(其 `id`) 指定它自己的一个行动：blink dog 的“传送之前或之后，这只狗可以进行一次啮咬攻击。”传送之后，该行动可以在本回合免费接着进行一次（菜单显示“Free, part of the same action”），菜单还会以相反顺序提供它，即在传送的额度上的“Bite, then Teleport”，之后传送可以免费接着进行一次。两者都不会再引出第三个。先进行的打击会连同自身一起消耗传送的使用次数和充能，并且只在两者都还有剩余时提供。打击是同一生物的另一个普通行动：不能是传送本身、序列、另一个传送、反应或用点数购买的东西。只有生物的传送才能指定它；目录条目或物品使用的会被拒绝。在不测量距离的战斗中，传送哪儿也去不了，因此不会配对任何东西。调度器也会使用它：离猎物太远、走不过去的生物会传送到其旁边，并在同一回合啮咬。

吸取的打击（Capability API 1.281）。目录条目的 `mechanics` 或生物的行动可以带 `drain`：使用者恢复的生命等于这次打击对每个目标造成的伤害（在抗性之后计算，向下取整，且不超过其最大值），目标的最大值不会因此减少（要减少最大值，请见 `reducesMax`）。`share`(大于 0，最多为 1，省略时为全部) 是恢复的比例，`damageType` 只计算该类型的伤害：aboleth 的 Psychic Drain 写作 `drain: {}`，Vampiric Touch 写作 `drain: { "share": 0.5, "damageType": "necrotic" }`。阻止治疗的东西也会阻止它。吸取需要有伤害才能归还，因此写在没有 `amount` 的条目上、治疗上或没有 `damage` 的生物行动上的吸取会被拒绝。

以使用者为中心的爆发（Capability API 1.282）。`area`(目录条目的或生物行动的) 可以写 `around: true`：一个以使用者为中心、大小为 `size` 的爆发，从不需要瞄准。使用时，使用者 `size` 之内的每个人都会被卷入，不分敌友，除非 `friendlyFire` 为 false(治疗性的只卷入使用者自己一方)，且从不卷入使用者本人。两者之间的墙会把生物挡在外面，除非范围还写有 `throughWalls: true`：mummy lord 的 Channel Negative Energy，“包括屏障之后和拐角处的生物”。在没有棋盘的战斗中，它会卷入所有人。它不指向任何人，因此既可以在回合中使用，也可以作为在回合之间购买的招牌行动使用。只有单个爆发才能以使用者为中心（不能有 `copies`），`throughWalls` 只能与 `around` 一起使用，条目以使用者为中心的爆发会立即生效，因此不会留下 `zone`。Channel Negative Energy 是一个生物行动，带 `signature: { "cost": 2 }`、`area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }`，并以 `applies` 施加一个带 `cannot-heal` 效果、持续 `{ "rounds": 1, "of": "source" }` 的状态，直到 mummy lord 下个回合结束。调度器会像评估瞄准的形状一样，按它卷入的人来评估这种爆发。

传奇移动（Capability API 1.283）。带 `signature` 费用的生物行动可以写 `move`，且不做其他任何事：其施放者在回合之间行走，像在自己的回合行走一样在棋盘上选一格，使用的是仅为这次移动借出的额度，因此它自己回合的移动不受影响。`move: { "share": 0.5 }` 是其速度的一部分（tarrasque“移动至多其速度的一半”），`move: { "distance": 60 }` 是以规则集自身单位计的距离，`move: {}` 则是其全部速度；不能同时写 `share` 和 `distance`。它在离开某人的触及范围时会像任何行走一样遭到打击，打击落下后，购买它的那个窗口才继续询问。`noOpportunity: true` 不会引发任何人的借机攻击（vampire“移动至多其速度，且不会引发借机攻击”）。`untouchable: true` 是任何东西都无法伤害或束缚的移动（mummy lord 的 Whirlwind of Sand，`{ "distance": 60, "untouchable": true }`）：束缚其施放者的东西会先松开，没有人会打击它，它穿过的区域或地面也不会对它产生任何作用。被定住或没有速度的生物，用其他任何移动都无处可去。没有棋盘时不会提供任何移动。调度器像购买传送一样购买移动：在重伤时脱离身旁的敌人，或在没有敌人在触及范围内时接近一个。

传奇施法（Capability API 1.284）。带 `signature` 费用的生物行动可以写 `casting`，且不做其他任何事：在回合之间，它提供施放者在自己回合用该行动的 `budget` 能施放的每个法术，来自其 `spellcasting` 或其人物卡的法术，命名为“Cast a Spell: Fireball”等。每个法术的瞄准、支付和结算都与在生物回合中完全相同（目标、范围所用的格子、照常消耗法术位或使用次数），以点数代替额度支付，因此它自己的回合保留原有的全部额度。`casting: { "cantripsOnly": true }` 只提供戏法（不从任何池支付的法术）：lich 的 Cantrip，`signature: { "cost": 1 }`。sphinx 的 Cast a Spell 是 `casting: {}`，带 `signature: { "cost": 3 }`。法术引发的任何东西（Counterspell、对被它伤害的反应）都像在回合中一样被回应，购买它的那个窗口要等这些都结束后才继续询问。调度器会在法术值得这些点数时购买，就像评估其他任何招牌行动一样。

行动之后的移动，以及按某一种速度移动（Capability API 1.285）。做某件事（伤害、范围、豁免、状态）的招牌行动也可以带 `move`：它所做的事先生效，然后其施放者可以移动到菜单提供、随行动一起选定的格子；不选也是一种选择，而做完之后已经无法到达的格子就不会去走。`move` 还可以用 `speed`(`walk`、`fly`、`swim`、`climb` 或 `burrow`) 指定一种移动方式：其 `share` 只按该速度计算，只能以该方式移动，没有该速度的生物无处可去。龙的 Wing Attack 是围绕自身的爆发（`area: { "shape": "burst", "size": 10, "around": true }`，带其豁免和倒地），加上 `move: { "share": 0.5, "speed": "fly" }`：“之后龙可以飞行至多其飞行速度的一半。”`move` 仍不能带 `teleport`、`sequence`、`reaction` 或 `charge`。调度器会在重伤且身旁有敌人时，在扇击之后飞离，或飞去接近触及范围之外的敌人。

轻度遮蔽与风（Capability API 1.286）。区域的 `obscures` 或传送的 `smoke` 可以写 `light: true`：此时它不隐藏任何人，只让透过它或在其中被看到的人处于轻度遮蔽，就像 5e 的微光或 Cape of the Mountebank 的烟雾（Engine 知道谁是以这种方式被看到的；Hide 和 Perception 会读取这一点）。它还可以写 `dispersed: true`：此时规则写有 `disperses: true` 的区域会在每个行动之后，在两者交汇处结束它，连同维持它的专注一起。5e 的 Fog Cloud 写作 `obscures: { "dispersed": true }`，其 Gust of Wind 是一个带 `disperses: true` 的区域；Darkness 两者都不写，因此风不会影响它。只负责驱散的区域不需要触发。

躲藏、Search 与 Detect(Capability API 1.287)。`combat.hiding` 让 `hide` 标准行动真正生效：`{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }` 指定 `combat.checks` 中的两项，并可选指定 `passive`(10)、`lightly`(5) 以及会发出声响的 `combat.components`。Hide 用战斗自己的骰子掷 `stealth`；之后，对于每个没有清楚看见使用者（在墙后、在雾中、隐形，或只在轻度遮蔽下看见他们）、且被动 Perception 被该总数达到的对手，使用者都处于隐藏状态；被动 Perception 为 `passive` 加上其 `perception` 检定，在对手只在轻度遮蔽下看见他们时再减去 `lightly`。使用者对其隐藏的对手看不见使用者，因此不能把任何东西指向他们，他们攻击该对手时视为看不见的攻击者，`combat.sight.unseenAttacks` 给这次攻击优势。躲藏跨回合持续，并在以下情况结束：对所有人而言，一旦使用者攻击、进行对抗、伤害某人或要求豁免，或使用了需要 `noisy` 成分的任何东西（没有言语成分的法术，或放下一团雾，会让他们保持隐藏）；对每个对手而言，在任何一步之后以及行走的每一格上，只要该对手能清楚看见他们，或其被动值现在超过了该总数。`search` 标准行动（把它加入 `combat.standard`；它需要 `combat.hiding`）掷 `perception`，为搜索者找出所有对其隐藏、且总数被这次投掷达到的人。带 `search: true` 的生物行动做同样的事，且不做其他任何事：传奇 Detect 写作 `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`。生物从自己的 `checks` 读取这两项检定。当所有对手都对它隐藏时，调度器会搜索，只要有任何对手隐藏，它就会在回合之间使用 Detect。没有棋盘时，没有人能隐藏，除非已有状态在隐藏他们。

Ready(Capability API 1.288)。`combat.readying: { "budget": "reaction" }` 让 Ready 动作真正生效：对于使用者此刻能用其 `standard` 额度采取的每个选项（攻击、法术、生物行动）以及一次行走，菜单都提供两个条目，分别准备在对手进入触及范围时（`comes`）或在对手行动时（`acts`）触发。采用其中一个会消耗标准额度，并把该选项保留到使用者下个回合开始。当对手的行走在任何一步把它带到被保留的选项能指向它的位置（且持有者看得见它），或对手在那里完成其所做的任何事时，会有一个窗口询问持有者，持有者可以用 `budget`(5e 的反应) 采取名为 `readied` 的选项，或放过它，在那次行走中不会再被询问。被保留的行走最远可以走到持有者全部速度所及之处，途中离开触及范围会像任何行走一样引发借机攻击。带 `"concentrates": true`(需要 `combat.concentration`) 时，法术在准备时就已支付，并由专注维持：触发时不会再次支付，失去专注就失去它，从未触发的法术仍算已经花费。准备其他任何东西在触发之前都不支付。5e 的写法是 `{ "budget": "reaction", "concentrates": true }`。

缓慢驱散（Capability API 1.289）。雾的 `dispersed` 可以写 `{ "after": N }` 而不是 `true`：触及它的风只有在连续吹满 N 个完整轮次后才会结束它，从风第一次触及它的那个回合开始计。在此之前风停止触及它（被移走、结束或消失），之后再有风触及时会重新计数。5e 的 Stinking Cloud 会在 Gust of Wind 这样的强风吹过 1 轮后被驱散，写作 `"obscures": { "dispersed": { "after": 1 } }`。

搜寻隐藏者时的加减（Capability API 1.290）。从技能读取的战斗检定（`{ "skillMod": "stealth" }`）现在在掷骰时算作该技能的检定，因此以 `skills` 收窄到它的改动会作用于 Hide、Search 和对抗：重甲在 Stealth 上的劣势、Pass without Trace 的 +10、Eyes of the Eagle 在 Perception 上的优势。`combat.hiding.passiveMode`(5e 为 5) 在被动 Perception 有优势时加上，有劣势时减去；没有它时，被动值不读取任何模式。改动 `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }` 让寻找其持有者的检定带上该模式，包括对手的被动值和其 Search；它只接受 `mode`，不接受其他内容。5e 的 Cloak of Elvenkind 就是如此。当一次 Search 发现某人对其掷法有所改变时，它会单独为该人再掷一次，日志也会显示这次投掷。

生物自己的躲藏和观察方式（Capability API 1.291）。生物行动可以是一项许可，`"standard": { "actions": ["disengage", "hide"] }`：用该行动自己的额度采取这些标准行动（来自 `combat.standard`），就像 5e 的 goblin 用附赠动作进行 Nimble Escape。带 `"while": "obscured"` 时，它只在生物站在雾或霾中，或战斗在微光或黑暗中进行时才有效：shadow 的 Shadow Stealth。生物的 `checkModes` 让它某些技能的检定掷两次：`{ "skills": ["perception"], "mode": "advantage", "sight": true }` 只在它能看见时有效（Keen Sight），带 `"light": ["sunlight"]` 时只在该光照下有效（Sunlight Sensitivity，带 `"mode": "disadvantage"`），带 `"terrain": ["snow"]` 时只在它指定的棋盘地块或地点类型上有效（Snow Camouflage；地点使用战术生成器的类型：snow、cave、mountains、water 等）。生物的 `passive` 是其印在数值块上的被动 Perception，用来代替 `hiding.passive` 加其检定（需要 `combat.hiding`）。战斗所处的光照来自场景的时刻：白天户外为阳光，黎明和黄昏为微光，夜晚为黑暗，室内或时间信息中没有 Engine 能读取的内容时，为非阳光的明亮光照。光照只影响读取它的东西（这些模式，以及 `while: "obscured"`）。没有 `combat.sight.darkness`(1.294) 时，它不改变谁能看见谁。

某人自己的躲藏与发现隐藏者的方式（Capability API 1.292）。目录条目的 `mechanics.hiding`(任何类型，包括 `utility`) 和生物的 `hiding` 是许可，在 `combat.hiding` 真正生效的地方读取。`"behindLarger": true` 让持有者可以躲在体型至少大一级的人身后，前提是对方站在它与观察者之间的每条连线上（halfling 的 Naturally Stealthy；需要 `combat.sizes`）。`"still": 10` 在它躲藏时给其 Stealth 总数加上这么多，一旦它移动或采取行动就再减去（ranger 的 Hide in Plain Sight）。`"slow": "advantage"` 在它本回合移动不超过其速度一半时，让其 Hide 带优势（thief 的 Supreme Sneak）。`"aware": { "within": 10, "lostWith": ["deafened"] }` 表示在该距离（规则集自身单位）之内，没有人能对它隐藏，除非它带有这些状态之一（rogue 的 Blindsense）。生物的 `"starts": 15` 让它以该总数在众目睽睽之下隐藏着开始战斗，对被动 Perception 不超过该总数的人隐藏，无论他们是否清楚看见它，直到它移动为止，并可用 Hide 动作以同样方式再次隐藏（gelatinous cube 的 Transparent）。

生物自身的攻击掷骰掷两次（Capability API 1.293）。生物的 `attackModes` 在其 `checkModes` 会生效的地方生效：`{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }` 就是 5e 的 Sunlight Sensitivity，在它能看见且战斗在阳光下进行时，其攻击带劣势。每种模式都用 `sight`、`light` 或 `terrain` 说明在哪里生效。该模式与掷骰上的其他所有优势和劣势合并，因此两者仍会相互抵消。

黑暗（Capability API 1.294）。有 `combat.sight.darkness` 时，战斗所处的光照会让眼睛看不见：`{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`。处于黑暗中的人不可见，处于微光中的人不能被清楚看见，除非观察者有在其距离内的 `seeIn` 感官（它把黑暗视为微光，把微光视为明亮），或有在其距离内的 `blind` 感官或 `pierced` 之一（无论光照如何都能看见）。照亮黑暗的东西：`carried`，即每个以人物卡参战的人都携带的光源，除非有 `seeIn` 感官能看见他们（火把）；以及 `light`，可以写在状态上（Light 戏法）、物品的 `worn` 或 `carried` 效果上（提灯），或生物上（持火把的强盗、火元素）。每个都写作 `{ "bright": N, "dim": N }`，以规则集自身的距离单位计：这么远的明亮光照，再往外同样距离的微光。墙会挡住光线，被击倒的人不发光。在黑暗真正生效的地方，凡是读取光照的东西，都读取某人所站位置的光照：谁能看见谁（攻击看不见的人、躲藏、你看得见的生物）、处于遮蔽中（`while: "obscured"`），以及生物的 `checkModes` 和 `attackModes`。在洞穴或地下城中的战斗，无论什么时刻都在黑暗中进行。

熄灭光源与重新点亮（Capability API 1.295）。携带 `carried` 光源的人在菜单上有一个开关，以其 `label` 命名（`"Torch"`；没有标签时为“Light”）。在它指定了 `budget` 时消耗该额度，否则每回合可以免费使用一次。熄灭的光源不发光，因此其持有者可以在黑暗中不被看见；重新点亮后，他们会被看见，如果原本在躲藏也会被发现。带 `toggle` 的物品只在打开时才发出其效果的 `light`，就像带罩提灯那样。

由生物和物品开关的光源（Capability API 1.296）。带 `"sheds": { "bright": 10, "dim": 10 }` 的生物行动设定使用者从此以后发出的光，`"sheds": "out"` 则将其熄灭。它不做其他任何事，也不指向任何人：magmin 的 Ignited Illumination 是其附赠动作上的两个这样的行动，will-o'-wisp 的 Variable Illumination 则是每种照明距离各一个行动。带 `"unlit": true` 的生物开始战斗时其 `light` 是熄灭的，需要用它的某个行动才能点亮。物品的 `toggle.offLight` 是它关闭时发出的光，代替其效果的光：放下罩子的带罩提灯发出 `{ "bright": 0, "dim": 5 }`。没有明亮距离的光源只发出微光，即使在持有它的位置也是如此。

来自区域的光，以及终结黑暗或显出隐形者的光（Capability API 1.297）。法术区域的 `lights`(与任何 `light` 一样以英尺计) 只在区域自身的格子上发光，从其中心起算：爆发施放的那一点，或对于由施法者携带的区域则是施法者本人，因此 bullseye lantern 是一个固定在施法者身上的 60 英尺锥形，带 `"lights": { "bright": 60, "dim": 60 }`，不照亮其后方的任何东西。Dancing Lights 是一个可移动的点区域，带 `{ "bright": 0, "dim": 10 }`。带 `"obscures": { "darkness": true }` 的遮蔽区域是魔法黑暗，带 `"dispelsDark": { "upTo": 3 }` 的区域会在两者任一施放时，结束其格子触及的、法术位等级不超过该值的每一片这类黑暗：Daylight。带 `"reveals": true` 的光（在区域、物品效果、状态或生物上），会显出站在其明亮光照中、因状态而不可见的每个人：lantern of revealing。其中任何一项都需要 Capability API 1.297。

被状态隐藏的光，以及阳光（Capability API 1.298）。生物的 `"lightOutWhile": ["invisible"]` 在它带有其中任一状态时熄灭它自己的光，无论它的行动最后设定的是什么，并在状态结束时恢复：will-o'-wisp 的 Invisibility 也会隐藏它的光。带 `"sunlight": true` 的光（在生物、物品效果、状态或区域上）让其明亮光照成为阳光，检定或攻击模式中的 `"light": ["sunlight"]` 读取的就是它：sun blade 对抗 Sunlight Sensitivity。在本已明亮的棋盘上，它的阳光同样有效。

魔法黑暗对抗光（Capability API 1.299）。带 `"dispelsLight": { "upTo": 2 }` 的魔法黑暗区域（`"obscures": { "darkness": true }`），会熄灭该等级或更低等级法术所造成的光，无论两者在哪里交汇、谁先出现：区域的 `lights`，或由法术施加的状态的 `light`，后者在由法术专注维持时随该专注一起结束（5e 的 Darkness 作用于 Flame Blade）。无论战斗在何种光照下进行，只有魔法光能照亮魔法黑暗的格子：区域或状态上的法术光总是魔法光，其他光在写明 `"magical": true` 时才是（sun blade 的光）；黑暗之中的火把在那里照不亮任何东西。带 `"within": 60` 的 `dispelsDark` 只结束离其中心这么近的黑暗：Daylight 的明亮球体，而不是其外的微光部分。其中任何一项都需要 Capability API 1.299。

更高费用每隔几级才增加（Capability API 1.300）。`"perCostStepsEvery": 2` 让更高费用每两级才加一次 `perCostStep`，而不是每级都加。状态给予的行动（1.236）现在会按施加该状态的法术所支付的费用增长，使用其自身的 `perCostStep`、`perCostStepsEvery` 和 `perCostStepsMax`：5e 的 Flame Blade 打击是 `3d6`，带 `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`，因此用 4 环法术位召出的刀刃打击造成 4d6。使用 `perCostStepsEvery` 需要 Capability API 1.300。

随人携带的区域，以及彼此分开放置的副本（Capability API 1.301）。区域的 `"carried": "any"` 让放在某人所站格子上的爆发随其移动，以其为中心：5e 的 Darkness 或 Daylight 施放在其手持的物体上。写 `"own"` 时，只有施法者所站的格子才算，用于只能施放在施法者自己手持物体上的法术。放在空格上时，它留在原地。被携带的区域是位于一点的单个爆发，自身从不移动。范围的 `"copiesWithin": 20` 让其 `copies` 放置时每个中心都在另一个中心 20 英尺之内，而不是彼此相接；施法者可以 `move` 的多副本区域，会以同样方式移动所有副本：5e 的 Dancing Lights 是一个 10 英尺爆发，带 `"copies": 4, "copiesWithin": 20` 和 `"lights": { "bright": 0, "dim": 10 }`。两者都需要 Capability API 1.301。

改变其他条目的条目（Capability API 1.302）。人物卡列表持有的、带 `"amends": [{ "entry": "spells/eldritch-blast", ... }]` 的条目，会在持有者每次使用那个条目时改变它，多个修改可以叠加。`"damageAdd"`(一个值，如 `{ "abilityMod": "cha" }`) 在每次命中时加到其伤害上：Agonizing Blast。`"range"`(以规则集距离单位计) 在更远时作为其射程：Eldritch Spear 的 300 英尺。`"push"` 把被命中者沿直线推开这么远，`"pushOptional": true` 还会以“Eldritch Blast (no push)”的形式提供它：Repelling Blast。射程或推开需要 `combat.distance`，所指定的条目必须存在。需要 Capability API 1.302。

只在某些光照下可用的使用，以及因移动或行动而结束的状态（Capability API 1.303）。带 `"usableIn": { "light": ["dark", "dim"] }` 的条目只在使用者站在其中一种光照下时提供：One with Shadows。状态的 `endsWhenHolder` 除了 `attacks` 和 `casts`，还可以写 `"moves": true`(持有者移动时结束) 或 `"acts": true`(持有者采取动作、攻击或施法时结束)：阴影会隐藏保持不动的邪术师。需要 Capability API 1.303。

每个生物在休息前只限一次（Capability API 1.304）。带 `"oncePerTarget": { "until": "long" }`(规则集声明的一种休息) 的条目，在使用者进行该休息之前，不会再对已经用过的生物提供，无论中间隔了多少场战斗：Chains of Carceri。用在了谁身上，会按名称保存在使用者的实时人物卡上，只有那种休息才能清除。不能用于范围，也不能用于指向使用者自己的条目。需要 Capability API 1.304。

随人物卡增长的目标数，以及重复的同一目标（Capability API 1.305）。`"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }` 在其读取值的每一档增加这么多个目标，就像 `scales` 增加骰子一样。带 `"targetsRepeat": true` 时，同一目标可以被选择多次，每次选择都是一次独立的攻击、各自掷骰，并携带修改该条目的一切：eldritch blast 的光束，每道都带 Agonizing Blast 的伤害和 Repelling Blast 的推开。战斗的目标选择器在还有余量时每点击一次就加一道光束；Engine 扮演参战者时，会把剩余的光束都放在它所选的那个目标上。两者都不能用于范围，也不能用于指向使用者自己的条目。需要 Capability API 1.305。

放到手中的武器（Capability API 1.306）。带 `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }` 的 `"utility"` 条目，会把其中一把近战武器放到使用者手中，持续到战斗结束，在使用时像选择武器模式一样选取；`binds` 还会提供它匹配的每件手持武器，此后那件武器视为这一把。带 `proficient` 时以熟练使用它，其打击携带 `qualities`。再次使用会替换它，被绑定的武器会恢复原样。对召出条目的修改会作用于该武器：修改的 `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }` 在命中时加上其自身类型的伤害（Lifedrinker），`"strikes": 2` 让消耗一次攻击额度能买到这么多次攻击（Thirsting Blade）。Engine 扮演参战者时，会把打击力最强的武器放到手中一次。需要 Capability API 1.306：Pact of the Blade。

使用者自己持有的东西（Capability API 1.307）。生物自身的行动可以像目录条目一样写 `"concentration": true`：它施加的东西在该专注结束时结束，伤害也会照常检验它。imp 或 quasit 的 Invisibility 就是如此。状态的 `endsWhenHolder` 还可以写 `"uses": ["scare", "spells/bolt"]`：在持有者使用了其中之一时结束，生物自身的行动用 ID 指定，目录条目用 `<catalog>/<entry>` 指定。quasit 的隐形在它使用 Scare 时结束。条目的 `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]` 在使用时对其使用者施加这些状态，无论其目标发生什么，有专注时由专注维持，并采用施放时的等级：Sunbeam 的光点，一个带 `light` 和 `"actions": ["spells/sunbeam-line"]` 的战斗状态，用于之后的光束。始终隐形的生物不需要任何新东西：`keepsOn: ["invisible"]`(1.263) 会让它保持隐形。需要 Capability API 1.307。

1.303 到 1.306 遗留的部分（Capability API 1.308）。卷轴或魔杖的 `use` 可以带 `targetsScale` 和 `targetsRepeat`，从其使用者的人物卡读取：eldritch blast 卷轴在阅读者 5 级时多发一道光束，魔杖的飞弹可以全部射向同一个生物。需要 Capability API 1.308。另有三项改动不需要新键。反应也算行动：`endsWhenHolder` 写有 `"acts": true` 的状态，在持有者进行任何反应时也会结束，就像 One with Shadows 在“反应”时结束一样。`oncePerTarget` 能区分两个同名生物：对一只 imp 使用 Chains of Carceri 不影响另一只 imp，之后战斗中的 imp 只有在名称属于那同一个生物时才会被禁止。放到手中的武器（1.306）可以是可投掷的近战武器（同时具有 `reach` 和 `range` 的攻击，如 dagger 或 javelin）。它可以从战斗菜单中不花动作地解除，并在其召出者死亡时消失。它离召出者从不超过 5 英尺，因为战斗从不会让它离开召出者的手。

躲藏的条件、Feral Senses、突袭与绑定仪式（Capability API 1.309）。带 `still` 的 `hiding` 可以写 `"stillWhile": { "holds": "camouflaged", "wall": true }`：加值只在持有者带有该状态（事先完成的伪装，用一个 1 分钟的 utility 条目，或在战斗前设置）、并且（带 `wall` 时）站在阻挡视线的格子旁边时才计入。这就是 Hide in Plain Sight。`"unseenStrikes": true` 取消攻击持有者看不见之人的劣势，这是 Feral Senses 的前一半。后一半什么也不需要，因为战斗本来就知道每个未隐藏的生物在哪里。生物带 `starts` 的 `hiding` 可以写 `"surprises": true`：它开始时对其隐藏的人都会在战斗开始时措手不及，就像 gelatinous cube 的 Transparent。带 `binds` 的 `conjures` 可以在 `"boundIn"` 中指定一个实时文本字段：只有名称写在那里的手持武器才会被绑定，字段为空时则一件都不绑定。把名称写进去，就相当于在战斗之外、短休期间完成了长达一小时的仪式。需要 Capability API 1.309。

重复施放，以及因距离而结束的状态（Capability API 1.310）。专注条目的 mechanics 可以写 `"repeats": { "budget": "action" }`：在使用者专注于它期间，它的效果会在该额度上再次提供，不从人物卡支付任何东西，不开始新的专注，也不会再次对使用者施加任何东西，并采用施法时支付的等级和费用级别。菜单将其显示为“Vampiric Touch again”。`"notSaved": true` 永远不会对已经通过这次施法豁免的生物提供它（Eyebite），`"sameTargets": true` 只对施法所瞄准的对象提供它（Heat Metal，用附赠动作）。`repeats` 需要 `concentration` 和一个已知的额度。`applies` 可以写 `"endsAway": { "beyond": 60, "unseen": true }`：一旦持有者与施加者的距离超过该值，并且（带 `unseen` 时）看不见对方，状态就会移除。这就是 Eyebite 的惊慌。它在任何人行走的每一步，以及每个回合结束时都会检查。需要 Capability API 1.310。

1.307 和 1.309 遗留的部分（Capability API 1.311）。物品的 `use` 可以像条目的 mechanics 一样带 `appliesSelf`：Sunbeam 卷轴会把光点及随后的光束留在阅读者手中，由阅读时的专注维持。生物的行动可以写 `"dyingOnly": true`(只能选择生命为零但仍活着的生物)、`"slaysOnFailedSave": true`(没有通过该行动自身豁免的目标死亡) 和 `"healsOnSlay": { "dice": "3d6" }`(每有一个目标死亡，生物就恢复这么多)。这就是 will-o'-wisp 的 Consume Life。`slaysOnFailedSave` 需要 `save`，`healsOnSlay` 需要 `slaysOnFailedSave`。`combat.conditions` 中的规则可以写 `"endsWhenHolder": { "moves": true, "acts": true }`：无论状态是如何施加的，持有者在迈出第一步时（`moves`），或做除 Hide 以外的任何事时（包括反应，`acts`），状态都会从持有者身上以及其人物卡上移除。这就是 Hide in Plain Sight 的伪装，在战斗前于人物卡上勾选。需要 Capability API 1.311。

围绕命中的雷鸣（Capability API 1.312）。武器的模式可以写 `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`。以该模式命中时，被命中者以及站在其 `within` 之内的每个人都要豁免，否则受到 `condition`。这包括盟友和持用者，如果他们站得那么近的话。`rounds` 计算他们自己的回合，或在写 `of: "source"` 时计算持用者的回合，因此 `rounds: 1, of: "source"` 就是“直到你下个回合结束”。`of` 需要 `rounds`。没有棋盘时，只有被命中者豁免。配合该模式的 `range` 和 `charges`，这就是消耗一点充能投掷的 Hammer of Thunderbolts。其 Giant's Bane 是武器带 `when: "critical"` 的 `slay`。需要 Capability API 1.312。

Maze、Expeditious Retreat、一次施法的选项，以及有上限的属性增加（Capability API 1.313）。带 `while` 的 `dismisses` 可以写 `"turns": true`。该生物离开战斗，但仍进行自己的回合，在回合中只会提供能结束使其离开之状态的选项，或结束回合。`applies` 可以带 `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }`：持有者可以花费标准额度，以该 `combat.checks` 检定对抗该数字来结束它。符合 `passes` 的生物不掷骰即成功。两者合在一起就是 5e 的 Maze 及其对 minotaur 的例外，检定成功时生物回到原来的位置。条目的 mechanics 可以写 `"takes": ["dash"]`(或 `disengage`、`dodge`)，使用者在使用它时就采取这些标准行动：Expeditious Retreat 在施放时就进行 Dash。此后的附赠动作 Dash 来自其状态的 `grants`。`repeats` 可以指定一个 `group`：同一组的条目是一次施法的不同选项，只要其中任何一个处于专注中，组内每一个都会再次提供。`notSaved` 和施法等级是共用的，就像 Eyebite 的沉睡、惊慌和不适。物品的属性改动 `{ "add": 4, "max": 30 }` 叠加在所有 `set` 留下的分值之上，最多到 `max`，并且从不降低已经高于它的分值。没有 `max` 时，增加与以前相同。物品的 `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }` 只允许在同一个角色穿戴着每组中的一件物品（并在该物品需要绑定时已绑定）时绑定它，一旦其中任何一件被脱下、解除绑定或离开其背包，就立即解除绑定。配合 `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }`，这就是 Hammer of Thunderbolts。需要 Capability API 1.313。

Resilient Sphere(Capability API 1.314)。`combat.conditions` 项可以带 `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`。状态生效期间，持有者与其他所有人隔绝。其他人都不能把任何东西瞄准他们，范围或爆发会绕过他们，其他人的任何东西都不能伤害、治疗他们或对他们施加状态，包括区域和光环。他们自己的东西也触及不到其他任何人，没有人会在他们移动时打击他们，他们也不会打击任何人。他们自己的移动为零，但带 `rolls` 时，他们可以花费该额度移动至多其速度的 `share`。带 `lifted` 时，站在他们旁边的人可以花费该额度把他们举起来。之后持有者会随搬运者行走而移动，直到搬运者把他们放下（免费），或状态结束。`brokenBy` 中的条目仍可以瞄准持有者，它们不会产生原本的效果，而是结束该状态以及维持它的专注：Disintegrate 作用于球体。条目的 mechanics 可以写 `"targetsUpTo": "large"`(`combat.sizes` 之一)，此时它只能瞄准该体型或更小的生物。这就是 Resilient Sphere 的“Large 或更小体型”。需要 Capability API 1.314。

巢穴动作（Capability API 1.315）。生物行动可以带 `"lair": true`，生物则带 `"lairInitiative"`(省略时为 20)。当生物在其巢穴中战斗时（Game Master 对该敌人写 `"inLair": true`，或遭遇战的 `inLair` 列表），每轮在战斗的计数经过其巢穴数字时进行一次巢穴动作，平局时排在后面：在该数字所落入的两个回合之间；所有人都等于或高于该数字时，在本轮最后一个回合之后；所有人都低于该数字时，在第一个回合之前。它不能连续两轮进行同一个巢穴动作。巢穴动作的瞄准和结算与在其自己的回合中相同，为此借出其 `budget`，不消耗生物自己回合的任何东西。它从不出现在生物自己回合的菜单上，生物倒下或无法行动时也不会进行。巢穴动作既不是反应，也不用点数购买，序列也从不指定它，`lairInitiative` 至少需要一个巢穴动作。5e 的龙在先攻计数 20 时进行巢穴动作。

道具（Capability API 1.316）。棋盘上的战斗可以有立在棋盘上、可被破坏的道具：遭遇战的 `board.props`，或世界战场绘制的 `props`。每个道具有 `label`、占据的 `cells`、`health`、`defense`(省略时为 10)，以及可选的 `resist`、`vulnerable` 和 `immune` 伤害类型。`blocks` 在道具存在期间对行走（`move`）、视线（`sight`）或两者封闭其格子，任何人都不会在战斗开始时处于其中。`fragile` 道具会被击中它的任何东西破坏。能打击墙段的攻击可以改为打击道具：它列在选项的 `walls` 中，选择的 `wall` 指定其格子。范围会卷入它触及的每个道具，并造成与对其他人相同的伤害骰结果；道具从不豁免。降到 0 的道具被破坏：它不再封闭任何东西，其标签被加入棋盘的 `broken` 列表、战斗摘要以及 Game Master 读取的战后回顾（`Broken: Sluice Gate; Oil Jar`）。故事的 `broke` 触发器会因它触发。

Legendary Resistance(Capability API 1.317)。生物的 `"legendaryResistance": 3` 把它在一场战斗中的前三次豁免失败变为成功，即 5e 的“如果龙豁免失败，它可以选择改为成功”（3/Day）。Engine 总是选择这样做，适用于任何豁免，包括状态直接判定失败的豁免；但生物倒下时永远不会。豁免会按掷出的结果记录，随后一行说明它改为成功以及还剩几次。取 1 到 20 的整数。

物品的使用也可以带 `"targetsUpTo"`(Capability API 1.317)，与 1.314 起条目的 mechanics 相同：Resilient Sphere 卷轴的 `"targetsUpTo": "large"` 只能作用于该体型或更小的生物。它读取 `combat.sizes`，用于指向生物而非范围的使用。

棋盘事件与生长物（Capability API 1.318）。战斗的棋盘可以随着轮次推进自行变化：遭遇战的 `board.events`，或世界战场绘制的 `events`。每个事件有 `id`、可选的 `label`，并在 `"round-start"` 或 `"round-end"` 时（`at`）发生，从某一轮开始（`from`，省略时：轮开始为 2，轮结束为 1），每隔这么多轮（`every`，默认 1）发生一次，如有说明则直到某一轮（`until`）为止。`where` 指定其格子：`cells`、一个 `block`(`x`、`y`、`w`、`h`)、围绕某格（`x`、`y`）的 `ring`(第一次触及 `start` 格，之后每次再向外扩展 `step` 格)、从一条边向内推进的 `sweep`(`from` 为 `north`、`south`、`east` 或 `west`，使用同样的 `start` 和 `step`)，或 `{"spread": "growth"}`，即生长物旁边的每个空格。环形或推进只触及其最新的一圈，深 `step` 格（至少一格），第一次也是如此，因此 `start` 为 3 的环形不会触及其中心；`filled` 则触及内部的一切。`onlyOn` 把它限制在这些地形的格子上。`change` 说明那里发生什么，至少一项：`terrain`、`height`(0 到 3)、`light`(`bright`、`dim`、`dark`、`sunlight` 或 `clear`)、`obscured`(`light`、`heavy` 或 `clear`)、`growth`(true 或 false)、`season`(一个名称，或用 null 移除)、`rotate`(只能用于正方形 `block`，连同其中的地块、高度、地面、完全位于其中的道具以及完全站在其中的人，顺时针转 1、2 或 3 个四分之一圈)，以及 `tell`，即日志代替普通说明所写的那一行。留在没有人能站立之处的人（冰裂开变成水）会被放到最近的空格上。一块棋盘最多容纳 32 个事件。

被带走（Capability API 1.329）。棋盘事件的 `change` 还可以写 `push`，`{"toward": "east", "squares": 3}`(一条边，`north`、`south`、`east` 或 `west`，以及 1 到 6 格)：站在其格子地面上的人会被一次一格地带往那个方向，永远不会被带出棋盘、撞进墙或关闭的道具、带到没有人能站立的地面上，或撞到其他任何人，也没有人会因此打击他们；离那条边最近的人先移动，处于空中的人不受影响。日志会说明它带走了谁。Mill of Hours 的水渠就是这样。或者写 `drift`，形式相同：遮蔽其格子的东西（轻度或重度）会被吹往那个方向，并从其 `block` 的另一侧回来，若 `where` 是其他形式则从棋盘另一侧回来；格子上的其他东西都不移动，轻度遮蔽被吹到重度遮蔽的格子上时，那里仍保持重度遮蔽。Leaffall 的飘移就是这样。战场绘制的事件两者都接受。

格子上的生长物会让进入该格的费用加倍（不超过其他崎岖地面），并让站在其中的人处于轻度遮蔽。伤害类型能砍断生长物的打击（挥砍，除非棋盘的 `growth.cutBy` 另有规定），可以瞄准它能触及的生长物格子，列在选项的 `walls` 中：它不掷骰就清除该格，并消耗这次动作。能烧掉生长物的伤害类型（火焰，除非 `growth.burnedBy` 另有规定）会把它落到的每一格上的生长物烧掉，即范围的整个覆盖区域，或被命中者所在的格子。带 `"clears": "growth"` 和 `area` 的条目 mechanics 或物品使用，会清除该范围内的生长物：修枝剪，`{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`。遭遇战的 `board.ground` 在开始时就把生长物、光照、遮蔽和季节绘制到格子上；世界战场把生长物绘制为由 `g` 和 `.` 组成的 `growth` 行，季节则与 Experiences 中的绘制方式相同。

阴影、光照规则、风铃与畏光者（Capability API 1.319）。带 `"shade": true` 的光会投下阴影：在其 `dim` 所及范围内为微光，那里的明亮光照和阳光也都变为微光，无论还有什么照亮它们。它没有明亮光照，也既不是 `reveals` 也不是 `sunlight`。阴影永远不会伸入魔法黑暗。展示用例中的 Lantern of Dusk 是一件携带的物品，带 `{"light": {"bright": 0, "dim": 15, "shade": true}}`。格子自身的光照（1.318）和阴影也是眼睛在那里读取的光照：在明亮的棋盘上，站在黑暗格子里的生物不可见，除非用能在黑暗中视物的感官。

战斗的棋盘可以有一条光照规则：遭遇战的 `board.lightRule`，或世界战场绘制的 `lightRule`。每轮结束时，完全站在其某种光照中（`in`，未写明时为明亮光照和阳光；明亮光照包括阳光）的每个人，都在那里多计一次轮末，每到第 `rounds` 次（未写明时为 1），其 `tracks` 按 `by` 移动，其 `applies` 中的状态施加到他们身上。走出去，哪怕只是走进一格阴影，都会重新计数。`spares` 指定它永远不会影响的生物 `types` 和 `tags`。不移动人物卡上任何轨道、也不施加战斗已知的任何状态的规则不起作用，会被丢弃。Noonfield 写作 `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`：在阳光下每一分钟增加一级力竭。

光照规则的豁免（Capability API 1.321）。光照规则的 `save`(`save`、`difficulty`) 由它即将影响的每个生物进行，豁免成功则这次免于它；无论哪种情况，计数都会重新开始。其 `against`(战斗已知的 `conditions`、`damage` 类型) 是该豁免所针对的东西，因此 `against` 匹配的豁免调整值会生效：穿戴或携带的草帽带 `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`。轨道项的 `upTo` 是规则最多把它移到哪里，因此会超过它的力竭停在那里，达到之后就不再增加。Noonfield 完整写法：`{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`，并带有一个由 experience 加入、供草帽指定的 `noon_light` 状态。

作为反应的物品使用（Capability API 1.322）。物品的 `use`(或其 `moreUses` 之一) 可以带 `reaction`，写法与目录条目的相同，此时只在该时刻打开时提供，从 `budget`(持有者的反应) 支付，并像任何使用一样从其充能或物品本身支付。Liesl's Coffin 每天一次，在持有者 5 英尺内的生物被命中时，让对方的 AC 加 5，持续到持有者下个回合开始，对这次命中也有效：在带 `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}` 的物品上写 `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}`。Straw Proxy 让瞄准其主人的攻击落空，代价是替身被烧毁：`{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`。物品的使用必须指定其时刻：`"reaction": true` 会被拒绝。

Held Ground 与收割（Capability API 1.323）。战斗可以在 Held Ground 上进行，那是死亡被扣留的地方：战斗的 `heldGround`(`label`、一个 `condition`，以及写作 `[{"track", "by"}]` 的 `marks`)，由故事的区域规则交给它。在那里，生命降到零的人会被放倒，而不是死亡或倒下：对手退出战斗；角色躺下并保持稳定，从不进行死亡掷骰，受伤也不会累积失败，可以照常被治疗。被放倒的人受到其 `condition`(角色还会受到规则集自身表示倒下的状态)，每个有人物卡的人都会移动其 `marks` 轨道：展示用例中的 Owing 印记。原本会直接杀死的效果改为将其放倒。带 `reaps` 的打击（在生物行动或物品攻击上）会收割被它放倒的人：他们保持倒下，不受到状态也不留下印记，被收割的角色即死亡。Reaping Hook 是一件 `attack` 带 `"reaps": true` 的武器。被放倒和被收割的参战者分别带有 `felled` 和 `reaped`，供故事日后让被放倒者复起。

解除 Held Ground(Capability API 1.330)。故事可以在战斗中途解除 Held Ground，例如在年岁更替之时：调度器的 `releaseRulesetHeldGround(definition, state, release)`(其下是共享的 `rulesetReleaseHeldGround`)。从那时起，生命降到零的人会像在其他任何地方一样死亡或倒下。未被收割的被放倒者会死亡，对手和角色都一样，除非 `release.felled` 为 `"down"`，此时角色改为倒下，并按规则集自身的规则开始濒死。带 `release.owing`(`{"track"?, "bonus"?}`，省略轨道时为 Held Ground 第一条标记的轨道) 时，每个角色在该轨道上的印记都会到期：每个印记进行一次规则集的濒死豁免，每次加上 `bonus`(队伍的 Debts Settled)，一直掷到印记用完或计数已有结果，特殊点数按濒死规则处理；之后这些印记被消耗。三次失败（失败轨道的顶端）即死亡。日志会说明谁死了、谁倒下了，以及每个角色的掷骰。不在 Held Ground 上的战斗保持原样。

生物的范围与地面（Capability API 1.324）。带 `area` 的生物行动可以用 `zone` 让该范围持续存在，写法与目录条目的区域相同（`rounds`、`triggers`、`obscures`、`terrain` 等）：The Owed 的 Freezing Fog、Scatter Flour 的面粉立方体、冻结成崎岖地面的地面。带 `"untilLair": true` 的区域，如果其 `rounds` 尚未让它结束，还会在其施放者的巢穴计数下次到来时、选择那个巢穴动作之前结束：“直到下一次巢穴动作”。生物行动也可以改用 `ground` 永久改变其范围覆盖的地面，写法与棋盘事件的 `change` 相同（`terrain`、0 到 3 的 `height`、`light`、`obscured`、`growth`、`season`，以及供日志使用的 `tell`）：篝火摇曳将熄（`"light": "dark"`）、冰面裂开（`"terrain": "water"`）；留在没有人能站立的格子上的人会被移到最近的空格。两者都需要行动的 `area`，`ground` 必须改变某些东西。使用其中任何一项，或在任何地方使用 `untilLair` 的规则集，需要 Capability API 1.324。

召入战斗的生物（Capability API 1.325）。生物行动可以写 `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }`：使用时，这么多个指定的图鉴生物（来自规则集目录或交给该战斗的图鉴中的 `"<catalogId>/<entryId>"`；`count` 是 `{"dice"}`、`{"flat"}` 或两者，每次最多八个）加入战斗，站在使用者一方，按战斗构建其自身生物的方式构建，并逐一命名（“Zombie 1”、“Zombie 2”）。有 `area` 时，它们被放在瞄准的位置，满了之后尽量靠近那里；没有时，放在召唤者旁边，该行动不指向任何人。它们自己投先攻并在顺序中就位：本轮回合已经经过的位置，算作下一轮的位置。带 `"initiative": "after"` 时，它们的回合改为紧跟在召唤者之后。巢穴动作也可以召唤（Shelves Lean），其计数所处的那个回合照常继续。战斗开始时在任何地方都找不到的生物不会召唤任何人，一场战斗最多容纳 40 个参战者。日志会说明谁来了。使用 `calls` 的规则集需要 Capability API 1.325。

被拉向某个生物（Capability API 1.326）。生物行动可以写 `"draws": { "spends": "reaction" }`：它落在其身上的人（带 `save` 时，只有豁免失败的人）当场消耗该额度，朝该生物走至多其速度，沿畅通的路线走向他们能到达的、离它最近的格子，且不会引发打击。没有剩余该额度，或无法再靠近的人，不消耗任何东西，留在原地。The Owed 的 Whisper a Name。`spends` 是行动经济的某个额度。使用 `draws` 的规则集需要 Capability API 1.326。

巢穴时机（Capability API 1.327）。带 `"actedOnly": true` 的生物行动只能指向本轮已经开始其回合的人，包括正在进行回合的人；在战斗的第一个回合之前，巢穴先于所有人行动时，还没有人开始过回合。这就是 Hour Bell 的“本轮已经行动过的一个生物”。状态的持续时间可以在其 `rounds` 上加上 `"untilLair": true`：在施加者下次到达其巢穴计数时、选择那个巢穴动作之前，它也会移除（Hour Bell 的“直到下一次巢穴动作”）。由其 `concentration` 维持的生物行动可以指定 `"brokenNextLair"`，即它自己的一个巢穴动作：一旦该专注被打断（因伤害、倒下或区域的作用，而不是持有者自行结束或开始另一个专注），那个巢穴动作就是它接下来进行、也是唯一提供的巢穴动作，无论上一轮进行的是什么；进行之后，选择再次恢复自由。Father Ivo 的 Litany of Keeping 与书架倾倒就是这样。使用其中任何一项的规则集需要 Capability API 1.327。

被状态移动的豁免难度（Capability API 1.328）。状态的改动 `{ "to": "save-difficulty", "flat": -2 }` 在持有者带有它期间，移动持有者所要求的每一次豁免的难度：其行动自身的豁免，以及结束这些行动所施加之物的豁免难度。它只接受 `flat` 数量，不接受其他内容，并且从不影响检定的难度、专注豁免（由伤害决定），或行动召入战斗的生物。Miller of Hours 的 Un-age：法术豁免 DC 降低 2。使用它的规则集需要 Capability API 1.328。

道具与汲取（Capability API 1.331）。战斗状态可以写 `"whileNearProp": {"prop": "Year-Wheel", "within": 10}`：只有当持有者站在棋盘上带该标签、仍立着的道具的该距离（规则集自身单位）之内时，它才生效；在其他任何地方，或该道具被破坏后，它被压制而不是结束；没有棋盘的战斗中它保持生效。The Wheel's Favour 就是如此。生物行动的爆发 `area` 可以写 `"aroundProp": "Shelf"`：无论瞄准哪里，它都覆盖带该标签、仍立着的道具 `size` 之内的每一格，包括道具之后的格子。Granary 书架行周围的 Shelves Lean 就是如此。光环可以写 `"feeds": 15`：每当光环触及的人被放倒、倒下或被杀死时，其持有者就恢复这么多生命值，光环也可以只做这件事。The Owed 的 Collector 就是如此。使用其中任何一项的规则集需要 Capability API 1.331。

重新点亮、坠入，以及道具旁的使用（Capability API 1.332）。棋盘道具（遭遇战的 `board.props`，或战场上绘制的道具）可以写 `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}`：只要它 `squares` 格之内有任何一格按战斗的读取不处于该光照，站在它旁边的人就会以该额度（未写明时为 `action`）获得“Light it again”选项，把该光照施加到所有这些格子上。Bonfire Gutters 之后 The Owed 的篝火就是如此。生物行动的 `ground` 可以在其 `terrain` 旁写 `"occupants": "stay"`：站在地面变得无人能站之处的人会留在那里，穿过冰面掉进水里，而不是被移到最近的空格（默认的 `"shove"`）。目录条目或物品使用可以写 `"usableNear": {"prop": "Year-Wheel", "within": 5}`：只在使用者站在以 ID 或标签指定的、仍立着的道具的该距离之内时才提供，在没有棋盘的战斗中从不提供。在 Year-Wheel 旁的 Fennick's Hymnal 就是如此。从 1.332 起，`whileNearProp`、`aroundProp` 和 `usableNear` 都以相同方式指定道具：用其 ID(`"p1"`)，或宽松地读取其标签，忽略大小写、开头的“the”以及字母和数字以外的一切，因此 `"Year-Wheel"` 能找到标签为“The Year-Wheel”的道具。使用 `usableNear` 或 `occupants` 的规则集需要 Capability API 1.332。

战斗棋盘美术（Capability API 1.333）。战斗棋盘可以用棋盘包绘制：按格子网格排列的 PNG 图集（RPG Maker 风格为 48 像素），地块使用固定 ID，在 Pixelforge 中制作并保存在素材库中（`POST /api/game-tile-packs/boards`）。`bt_plains`、`bt_forest`、`bt_mountain`、`bt_ruin`、`bt_water` 和 `bt_wall` 是地形，每种最多八个变体，按格子逐一挑选，或使用一个比格子更大的图案铺满整个棋盘；`bt_edge_water` 和 `bt_edge_wall` 是由十六块组成的双网格块，四格乘四格，按 Pixelforge 的 `edge_` 块排列，用来把水和墙与旁边的平原融合；`bt_height1` 到 `bt_height3` 是抬高地面上的边缘。`bo_dim`、`bo_dark`、`bo_sunlight`、`bo_fog_light`、`bo_fog_heavy`、`bo_growth`、`bo_ice`(冬季的格子)、`bo_zone`、`bo_aim` 和 `bo_reach` 绘制在格子之上，代替现在的着色。道具的贴图是横跨其格子的 `bp_<name>`(道具上写 `"art": "bp_bonfire"`；省略时取其标签的小写单词，用 `_` 连接，并去掉开头的“the”，因此“The Year-Wheel”是 `bp_year_wheel`)，被破坏后则为 `bp_<name>_broken`。绘制的战场或遭遇战的棋盘可以用 `"pack": "local/<id>"` 指定其包；没有指定时，先用素材库中与其环境对应的包（包的 `environment`），再用内置的 `board/<environment>`，最后按现在的方式绘制；道具还会在素材库的道具包（`"environment": "props"`）中查找，然后是内置的 `board/props`。包中缺少的地块按现在的方式绘制。目录区域可以写 `"art": "bz_<name>"`：它覆盖的每一格都用棋盘包中的该地块绘制，否则用 `bo_zone`。使用区域 `art` 的规则集需要 Capability API 1.333。

物品提供的更多回合（Capability API 1.334）。物品的使用可以像目录条目的 mechanics 一样写 `"gives": [{"budget": "action", "count": 1}]`(Action Surge)：使用它会立即给使用者这么多额外的回合额度，并在加上时设定上限，因此不会留到以后。Time-Flour Loaf 用附赠动作吃下，立即多给一个动作。使用它的规则集需要 Capability API 1.334。

休息时花费的骰子（Capability API 1.335）。休息可以写 `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}`：此时 Game Master 的 `[sheet: op="rest" rest="short" dice="2"]`(或针对整个队伍的命令) 会先从 `pool` 花费这么多骰子，每颗骰子掷 `die`(任意值，或写作“d8”的枚举字段) 再加上 `add`，每颗不低于 0，然后在休息执行其规定的内容之前，把这么多作为非魔法治疗交给 `heals`。`extra` 是给每个花费了骰子的人的额外一颗骰子：`die` 读出面数最多的队伍成员为每个人掷它，并加上其自己的 `add`。5e 的 Song of Rest，以及 Pell's Brown Teapot 作为 `add` 读取的物品数值、为每颗骰子带来的 +1。使用休息 `dice` 的规则集需要 Capability API 1.335。

跨多个池的休息骰（Capability API 1.337）。休息的 `"dice"` 可以是一个列表，每个池一项，各自有 `die`、`add`、`heals` 和 `extra`：`[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`，因此 fighter 1 / wizard 1 会花费一颗 d10 和一颗 d6。`[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]` 只从该池花费；不带 `pool` 时，骰子来自列出的第一个还有骰子的池，然后是下一个，总数不够时会被拒绝，且什么也不花费。额外骰子（Song of Rest）取第一个带有它的项，整次花费只掷一次，治疗对象与首个花费骰子之池的治疗对象相同；即使只有后面的池支付，它也会出现。在游戏中，休息骰会读取每个角色携带的东西，因此 `add` 或额外骰子的 `add` 中的 `itemStat` 会计入：Pell's Teapot，`{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`。在这里使用列表的规则集需要 Capability API 1.337。

图标（Capability API 1.338）。目录条目和人物卡状态可以指定其图标，`"icon": "ic_poison_cloud"`：游戏图标包（类型为 `icons` 的棋盘包；见 packages/server/src/assets/board-packs/README.md）中的一个地块。没有指定时，Engine 会查找推导出的名称：状态为 `ic_cond_<id>`，物品为 `ic_item_<entry id>`(Game Master 自创的物品为 `ic_item_<name>`)，其他目录条目为 `ic_<catalog id>_<entry id>`(`ic_spells_fireball`)，连字符写作 `_`。两者都没有时，显示现在的字母或文字。指定了图标的规则集需要 Capability API 1.338。

专注被打断时的巢穴动作列表（Capability API 1.336）。`"brokenNextLair"` 可以是它自己的巢穴动作的列表，每个只出现一次，而不只是一个：`["shelves_lean_north", "shelves_lean_south"]`。一旦该专注被打断，下一个巢穴动作就是其中之一，不会是别的，无论上一轮进行的是什么，由操控该生物的人选择哪一个。由 Engine 操控的生物会选择能卷入最多敌人的那一个；同样好的选项之间，按它评估其他任何东西的方式权衡。进行之后，选择再次恢复自由。在这里使用列表的规则集需要 Capability API 1.336。

带 `"alerts": 15` 的状态、穿戴或携带的物品，会暴露在其持有者该距离之内隐藏移动的人：他们不再对任何人隐藏，日志记录为被其持有者暴露。展示用例中的 Wind-Chime 是一件携带的物品，带 `{"alerts": 15}`。生物的 `"stillIn": ["bright"]` 让它在任何一格处于这些光照之一时无法移动：在那里，其菜单上没有行走。展示用例中的 Lantern-Shy 就是如此。

增长的光环、有上限的束缚、挣脱与死撑（Capability API 1.320）。光环的 `"grows": {"by": 10, "upTo": 40}` 在其持有者每个回合开始时再向外延伸 `by`，最多到 `upTo`，该值大于其 `distance`；日志会说明它现在触及多远。其 `harms` 可以写 `"on": "their-turn"`：在被它触及的每个人的回合开始时分别造成，而不是在持有者回合开始时一次性造成。`"lingers": true` 让它散布的东西在不再被它触及的人身上保留到其下个回合开始，如果在此之前光环又触及他们，就重新持有它。The Owed 的 Frost Debt 写作 `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`。

行动施加的东西可以带 `"heldAtMost": 2`：当其来源已经用它束缚着这么多个其他人时，它不会施加到第三个人身上（日志记为未生效），就像 The Owed 的 Grasps。状态的 `shakeOff` 带 `"self": true` 时，持有者也可以花费该额度、不进行检定来结束它：Seed Hopper，`{"budget": "action", "self": true}`，可由被束缚者或其身旁的盟友挣脱。生物的 `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}` 让它在本会降到 0 时改为保留 1 点生命值，每场战斗 `uses` 次，但对直接杀死的效果无效；带 `extraTurn` 时，它在发生这件事的回合之后立即进行一个自己的回合，该回合结束后顺序恢复原样。

选择器会用一行展示这个块。其余内容由谁读取，取决于规则集选择启用了哪个块：

- 带有 [`combat` 块](#combat-a-fight-your-own-rules-resolve)时，战斗读取其中的战斗效果。`range`、`area` 和 `friendlyFire` 在有位置的战场上生效；`reaction` 表示该条目用于回应某件事，而不是在回合内执行，并指定它所等待的时刻（见[窗口](#windows-holding-the-fight-open)）；只写 `true` 的条目没有指定时刻，不会出现在任何菜单上。`check` 按前文所述应用于技能检定。
- 只有 [`battle` 块](#battles-lending-the-sheet-to-marinaras-combat)时，战斗读取 `kind`、`range`、`area`、`friendlyFire`、`amount`、`damageType` 和 `cost`，因为 Marinara 自身的战斗系统只能使用这些部分。

词汇范围是封闭的。上述列表之外的键或值会被拒绝，而不是静默忽略。

`cost` 也是 Game Master 在战斗外使用 `use` 命令时支付的费用，下一节会说明。

### 人物卡命令：永久成长（Capability API 1.142）

规则集可以用 `sheet.advancement` 选择允许对永久构建进行修改：

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

只写人物卡声明为数字或文本（`text` 或 `longtext`）的字段 ID，最多 24 个。这些布尔值分别允许所有属性、技能或豁免；省略或为 false 表示不允许。空的许可集合、未知字段、不支持的字段类型或未知键都会在导入时被拒绝。`text` 是可选的指引，最多 400 个提示词安全字符。没有 `advancement` 时，现有命令行为不变，每个 `advance` 请求都会被拒绝。

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

恰好指定一个目标。字段和属性恰好接受 `by` 或 `to` 之一；文本只接受 `to`。名称和档位按 ID 或标签匹配，不区分大小写。技能和豁免接受 `resolution.proficiencyTiers` 中声明的任何档位。数字字段遵循 `integer`、`min` 和 `max`；属性遵循其整数界限；文本遵循 `maxLength`。无效的值会以说明界限的 `bad-amount` 原因拒绝，绝不会静默限制。未启用成长、不允许的目标、未知名称和未知档位也会被拒绝。改写后的标签带有 `result`，并在 `now` 中给出新值。不写 `who` 表示玩家，或用 `who="party"` 表示每张无歧义的队伍成员角色卡；部分拒绝时会说明哪些卡无法成长。

Engine 通过与玩家编辑相同的元数据存储，把构建保存在游戏的角色卡上，保留其人物卡版本，并根据新构建重新计算派生值。角色库中的角色卡不会改变。与实时命令一样，备选回复或重新生成的回复从发出回复的改动之前开始。每条回复都会记录其结束时的构建，包括没有成长的回复。选择某个备选回复会恢复其快照；删除最新的回复会显出前一份快照。删除较早的回复时，较晚的快照仍然生效，直到那条较晚的回复被移除。继续生成会更新同一条回复的快照。撤销只改变仍与记录结果相符的值，因此之后玩家的编辑会保留，无关的编辑也不会妨碍撤销一次 XP 奖励。

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

`pool=` 表示升阶使用：从同组另一个池支付相同的单项费用。仅当费用恰好有一项，且指定池与该项属于同一组，或可以为其支付时才接受。其他情况会被拒绝，不会另行解释。

**能为其他组支付的池**（Capability API 1.171）。实时池的 `pays` 指定最多四个其他组，它也可以按自己的等级（其 `level`，或在其自身组中的位置）为这些组的费用支付，但绝不支付高于其自身等级的费用。5e 的契约法术位可以为以法术位计费的法术支付，就像兼职的邪术师那样：

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

战斗会在该法术自身组的更高等级池旁提供这样的池，从它支付会让法术按其等级高出法术等级的级数增长：3 环契约法术位为 Magic Missile 支付时，效果与 3 环法术位相同。即使自身的池已空，使用仍会提供，只从更高等级的池或能为其支付的池付款，因此 1 环法术位用完后，1 环法术会用 2 环法术位施放。条目 `mechanics` 上的 `targetsPerCostStep`(1.171，1 到 10) 在每支付高一级时增加这么多个目标，最多 20 个：Hold Person 写作 `"targetCount": 1, "targetsPerCostStep": 1`。

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

独立目录文件随包提供：通过官方目录发布的包，或你自己导入的规则集包文件（见[分享你的规则集](#sharing-your-ruleset)）。包在 `contributions.assets.paths` 中将该文件与 `ruleset.json` 一同列出，并且需要 Capability API 1.21。生物目录无论内联还是独立文件，都需要 Capability API 1.27，物品目录需要 1.49。**以单个文件导入或通过 GitHub 仓库分享的规则集，必须内联携带目录**，所以目录也得装进整个规则集文件 512 KB 的限制内。这大约能容纳数百个短条目。

限制为每个规则集 12 个目录、无论哪种方式每个目录 2000 个条目、每个目录文件 2 MB。`ruleset.json` 超过 256 KB、或有目录文件超过 1 MB 的包，需要 Capability API 1.340，正是它提高了这两项限制。

### 引导式构建器：分步创建角色

人物卡可以声明 `sheet.builder`(Capability API 1.86)。此后，人物卡编辑器（在角色编辑器和用户角色编辑器中，以及游戏的 **Edit sheet**(编辑人物卡) 中）会在完整表单（**All fields**(全部字段)）旁打开一个 **Guided**(引导式) 视图：步骤横排在顶部，每个都带有一个徽标，计数它仍在等待的选择；**Back**(返回) 和 **Next**(下一步) 从不阻挡（玩家可以把选择留到以后）；旁边则是角色的当前状态：各步骤写入的内容、分值、`gm.sheetSummary` 指定的值（护甲等级、熟练加值），以及受训练的豁免和技能。

```json
"builder": {
  "tier": "proficient",
  "steps": [
    { "id": "race", "label": "Race", "kind": "catalog", "catalog": "races", "field": "race" },
    { "id": "subrace", "label": "Subrace", "kind": "catalog", "catalog": "races", "min": 0,
      "within": { "step": "race", "filter": "parent" } },
    { "id": "class", "label": "Class", "kind": "catalog", "catalog": "classes", "field": "class" },
    { "id": "level", "label": "Level", "kind": "fields", "fields": ["level", "background"] },
    { "id": "scores", "label": "Ability Scores", "kind": "abilities", "methods": {
      "pointBuy": { "budget": 27, "costs": [[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]] },
      "standardArray": [15, 14, 13, 12, 10, 8],
      "roll": { "count": 4, "sides": 6, "keep": 3 },
      "manual": true } },
    { "id": "skills", "label": "Proficiencies", "kind": "trained" },
    { "id": "gear", "label": "Equipment", "kind": "startingGear" }
  ]
}
```

最多 24 个步骤，每个写作 `{ id, label, kind, ... }`；超过 16 个步骤的包要声明 Capability API 1.112：

- `catalog`：行目录中的条目，以卡片形式显示，其 `summary` 位于 **Info**(信息) 之后。`min`(默认 1) 是该步骤要求选几个，`max`(默认 1) 是最多能选几个；`max` 为 1 时，新的选择会替换旧的。两者最高都可以到 40；任一超过 20 的包要声明 Capability API 1.110。`field` 指定一个文本或枚举字段，所选的标签会写入其中（枚举字段取条目的 ID 或标签中属于其取值的那一个）。`filters` 固定目录筛选项的值，`within: { step, filter }` 只提供其 `filter` 指向更早那个步骤中所选条目的条目，就像亚种指定其种族；取消选择种族后，其亚种就不再计入。`upTo: { filter, value }`(Capability API 1.87) 只提供数字 `filter` 不超过 `value` 的条目，后者是按人物卡当前状态读取的值，例如不超过角色等级的特性（`{ "filter": "level", "value": { "derived": "level" } }`）；没有该筛选项的条目总会提供，人物卡之后低于其要求的选择不再计入，但会保留。改变所读取值的选择（设定等级的职业）会在同一次改动中结算，在 **All fields** 中改变的值也一样（在那里降低等级，会立即收回高于它的特性所给予的东西）。`countFrom`(Capability API 1.90) 是以同样方式从人物卡读取、同时代表 `min` 和 `max` 的值：该步骤要求选几个、最多能选几个，向下取整且不超过 `max`，例如某职业在角色当前等级已知的法术数（`{ "derived": "spells_known" }`）。超出的选择会保留，但在数量再次上升之前不计入。目录步骤还可以带 `stamp`(Capability API 1.108)，即写入它所添加的每一行的 1 到 4 个列值，例如在法师的法术步骤上写 `"stamp": { "class": "wizard" }`，在牧师的步骤上写 `"stamp": { "class": "cleric" }`。每个键都必须是该目录供给的每个列表中的列；值为字符串、数字或布尔值。印记取代目录的初始值。已有的行以及之后在 **All fields** 中的编辑仍属于玩家。从 Capability API 1.130 起，印记值也可以是一个对象，其 `fromWithin` 为 `"id"`、`"label"` 或父目录声明的筛选项 ID：它按选择顺序读取第一个匹配的父条目，在添加该行时写入一次字符串或数字；如果没有匹配的父条目，或其筛选项缺失或为数组，则该列不加印记。

  ```json
  {
    "id": "spells",
    "label": "Spells",
    "kind": "catalog",
    "catalog": "spells",
    "within": { "step": "class", "filter": "class_ids" },
    "stamp": { "class": { "fromWithin": "label" } }
  }
  ```

- `fields`：由指定字段组成的简短表单。其徽标计数仍为空的字段，`optional` 中列出的除外（更高等级才选择的子职业）。`shownWhen: { "field_id": { "field": "level" } }`(Capability API 1.107) 只在其值引用按人物卡当前状态读数大于 0 时，才显示并计数该步骤的某个指定字段；隐藏的字段保留其值。`total: { "fields": ["level_bard", "level_other"], "max": 20 }`(1.107) 把该步骤的至少两个数字字段限制在合计上限之内（1 到 1000 的整数），按其他字段的当前值降低每个输入的最大值，但不低于其自身最小值，合计超过上限时徽标加一；**Next** 仍然可用。
- `abilities`：各项分值（`abilities`，省略时为全部），可通过任一 `methods` 设定：`pointBuy`(`budget` 不超过把每项分值都买到最高所需的花费，再加上从最低分值起每升一级的各项花费，每项分值都从最低分值起步；手动输入的分值从表中最接近的分值起算)、`standardArray`(每项分值分配一个值)、`roll`(掷 `count` 颗 `sides` 面骰，保留最高的 `keep` 颗，由 Engine 自己的骰子掷出，每项分值掷一次，再像数组一样分配) 和 `manual`。`manual: true` 保留现有的分值界限；`manual: { min, max }`(Capability API 1.110) 在加成之前把手动输入的基础分值限制在这些整数界限内，min 至少为 -100，max 至多为 1000，且 min 不大于 max，而每个属性自身的界限仍约束总值。`default`(1.87) 是构建器从空白人物卡开始的角色所采用的方法（即使规则集的默认值之后改变，也会保持），因此新手会先看到比如点数购买，直到他们选择其他方法；由描述生成的角色从不采用它，其分值保持原样，直到玩家在描述之后选择一种方法；**Manual entry**(手动输入) 仍是在界限内手动编辑，**All fields** 始终可用。所选内容增加的部分叠加在上面：该步骤显示基础值、加值、总值和调整值。最多只能有一个 abilities 步骤。
- `allocate`(Capability API 1.152)：带优先级配额或组预算的分阶段点数分配，见下文。
- `trained`：所选内容提供的技能和豁免选择，以及该步骤自身的 `choose: [{ "what": "skills", "count": 2, "from": [...] }]`(省略 `from` 时可从全部中选择)。
- `startingGear`：列出规则集的初始装备。装备照常在游戏中从物品栏领取。
- `choices`(Capability API 1.91)：`catalog` 指定一个行目录，该步骤用来选择所选内容从中授予的条目（下文的 `grants.entries`），例如一门自选语言。

初始装备步骤可以带 `"strict": true`(Capability API 1.109)。在默认的仅限合规模式下，它只提供 `fits` 按人物卡当前状态（不含实时状态）读数为真的装备，以及没有 `fits` 的装备；没有 Other gear 列表。对于 5e，在 Wizard 套装上写 `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }`，在其他每个职业套装上写对应的职业等级字段；Acolyte 套装不写 `fits`，这样它适合所有人。自由编辑会再次提供每一套装备。物品栏选择器会清除在更换职业或离开自由编辑后不再适合的选择，并说明原因；它在领取装备之前也会检查是否适合。没有适合的装备时，该步骤显示其空状态，Next 仍然可用。没有 `strict` 的步骤继续提供每一套装备。该模式只属于各个画面本地，不随已保存的构建记录，也不发送到服务器。

所选内容给予的是其条目的 `grants`，只有构建器会读取它：

```json
{
  "id": "half-elf",
  "label": "Half-Elf",
  "grants": {
    "abilities": { "add": { "cha": 2 }, "choose": [{ "count": 2, "amount": 1, "except": ["cha"] }] },
    "trained": { "skills": [], "saves": [], "choose": [{ "what": "skills", "count": 2 }] },
    "sets": { "speed": 30 }
  }
}
```

- `abilities.add` 增加分值；`abilities.choose` 让玩家选择 `count` 项分值（不能重复选同一项，也不能选 `except` 中的项），每项获得 `amount`。带 `"repeat": true`(Capability API 1.93) 时，同一项分值可以被选择多次，每次各得 `amount`，因此 `{ "count": 2, "amount": 1, "repeat": true }` 就是属性值提升的一项 +2 或两项各 +1；该步骤会在分值旁显示一个减号，用来撤回一次。无论哪种方式，分值都不会超过其 `max`。`upTo`(Capability API 1.96) 在其他所有加成之后，限制该选择本身能把分值提高到多少：`{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }` 就是 SRD 的属性提升，“不能把属性值提高到 20 以上”；该步骤会禁用已达到该值的分值。选择显示在 abilities 步骤中，没有该步骤时则显示在选择该条目的位置。
- `trained` 训练技能和豁免，并提供选择，显示在第一个 trained 步骤中或选择该条目的位置。它们被训练到加成的 `tier`，否则是构建器的 `tier`，再否则是人物卡为技能或豁免提供的、高于未受训练的第一档。选择从不提供所选内容已经直接或通过更早的选择训练到其档位或更高的东西（Capability API 1.104）：训练了 Insight 的背景会把职业的技能选择留给其他技能，正如 SRD 所要求的。在这种方式出现之前保存的选择不再计入，因此该步骤会要求另选一个，而没有任何可提供内容的选择不会显示。选择可以写 `"held": "<tier>"`(Capability API 1.105)：它只提供所选内容训练到该档位或更高的东西，或低于其自身档位的选择所保持在该档位的东西，就像 5e 的 Expertise 是你已熟练的两项技能：`{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`。`held` 的档位低于该选择所训练到的档位。
- `sets` 写入字段值：职业的生命骰、其施法属性。
- 目录条目可以说明构建器步骤何时提供它：`offeredWhen`(Capability API 1.99) 是按人物卡当前状态读取的值，只有在其读数大于 0 时才提供该条目，就像 5e 只有在满足兼职先决条件时才提供第二职业（每个职业一个派生值）。之后读数为 0 的选择不再计入并会保留，与 `upTo` 的情况相同。自身被选择后会改变其 `offeredWhen` 读数的条目（它提高的分值、设定的字段、训练的技能、写入的列表，直接或通过派生值）会被拒绝，因为它会提供自己、撤回自己，然后再次提供自己。带 `exclusive` 组的条目，会在不计该步骤在此组中所保存的每个选择的情况下读取人物卡（Capability API 1.100），因为选择它会丢弃那些选择：代替属性值提升、以 Strength 13 为条件的专长，不会因那次提升带来的 Strength 而提供。条目授予的选择（`grants.entries.choose`）以同样方式让其选项受其 `offeredWhen` 约束（Capability API 1.106）。**All fields** 中的目录选择器照常提供每个条目。
- 目录条目可以指定一个 `exclusive` 组（Capability API 1.94）：构建器步骤每组只保留一个选择，因此选择一个会丢弃该步骤在同组中的另一个选择，只有最新的计入。代替属性值提升的专长与它共用一个组：`"exclusive": "fighter-asi-4"`。
- `entries`(Capability API 1.91) 提供另一个行目录中的条目供选择：`{ "choose": [{ "catalog": "languages", "count": 1 }] }`，最多六项选择。`filters` 固定该目录筛选项的值，`ids` 列出唯一提供的条目（`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`）。它们在构建器针对该目录的 `choices` 步骤中选择（指定的目录没有这样的步骤时，授予会被拒绝），只提供会写入行的条目，其行会写到人物卡上，为一项授予选择的条目不会再提供给另一项授予。它们自己的 grants 不会被应用。
- 选择还会写入条目的 `rows`，只写一次。条目可以带 `grants` 而完全没有 `rows`(其特性来自另一个目录的职业)，所有条目都只做授予的目录不需要 `feeds`；目录选择器从不提供这类条目。

取消选择会收回该选择给予的东西，也只收回这些：其增加值（在分值界限允许其增加的范围内）、其训练、其字段值和其行。人物卡上原本属于玩家自己的东西（手动训练的技能、从目录选择器添加的行）仍属于玩家，在 **All fields** 中所做的编辑会一直保留，直到构建器自己对该值的答案改变。在一个目录的两个步骤中都选择的条目只授予一次，被游戏的层隐藏的条目仍按其所给予的东西计入。所选内容 `sets` 的字段只在仍为空白、或构建器已经对其负责时才写入，因此手动输入的等级永远不会被覆盖；构建器负责、而玩家在其自身 fields 步骤中修改的值仍归构建器，并在之后的选择不再需要它时消失。玩家的选择会保存在人物卡旁，因此之后可以重新打开某个步骤。

**分阶段的评级分配（Capability API 1.152）。** `allocate` 步骤每点购买一个点数，有自己的预算和创建上限。它不改变唯一的 `abilities` 步骤的方法或已保存答案。属性、Virtues 和之后的 freebie 点数请分别使用不同的步骤：

```json
{
  "id": "attributes",
  "label": "Attributes",
  "kind": "allocate",
  "priorities": [7, 5, 3],
  "annotations": true,
  "groups": [
    {
      "id": "physical",
      "label": "Physical",
      "targets": [{ "ability": "strength" }, { "ability": "dexterity" }, { "ability": "stamina" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "social",
      "label": "Social",
      "targets": [{ "ability": "charisma" }, { "ability": "manipulation" }, { "ability": "appearance" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "mental",
      "label": "Mental",
      "targets": [{ "ability": "perception" }, { "ability": "intelligence" }, { "ability": "wits" }],
      "base": 1,
      "min": 1,
      "max": 5
    }
  ]
}
```

共有 1–12 个组，每个都有稳定的 `id`、`label` 和 1–120 个目标。目标在整个步骤中互不相同。目标恰好指定一个已有的 `{ ability }`、数字 `{ field }`、`{ skill }`、`{ save }` 或 `{ bonus }`；bonus 是针对已有技能或豁免的数字 `build.bonuses` 项。各组恰好使用一种预算模式：`priorities` 为每组提供一个非负整数配额（允许重复），或者**每个**组都声明 `budget: Ref`。优先级位置需要明确分配，把组分配到已占用的位置会交换两组。数组顺序依次表示主要、次要、第三，之后是编号的优先级；如果希望这些名称按大小排列，请把较大的配额放在前面。预算最多 1,200,000 点。

`base` 可选；`min` 和 `max` 必填。每项都接受整数或非实时的 `Ref`，例如 `{ "derived": "archetype_floor" }`。评级必须解析为 0 到 10,000 的整数，并符合目标的存储界限或档位映射。第一个 base 会取代空白目标的默认值，保留已有的方法分值和加成；之后的 base 是对之前阶段的下限。没有 base 时，该阶段从现有评级开始。min 与 max 相等时固定创建分值：`base: 0, min: 0, max: 0` 表示固定的 Appearance。最小值不会自动购买点数。预算和界限可以使用现有的派生运算，但不能读取由本步骤或之后步骤改变的目标，经由派生值也不行。免费加成的条件也不能读取它们能改变的分配组中的评级，包括其他阶段中相关联的组。不支持公式定价：每次付费的增加都花费一点。无法解析或无效的来源显示为 **not configured**(未配置)。

技能和豁免目标需要 `sheet.builder.ratingTiers`，每个目标单独设置：

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

数组索引就是数字评级。映射有 1–12 个已有的、递增的提供档位 ID，从规则集的未受训练档位开始；它们从不根据档位加值推断。不同的目标可以使用不同的映射。创建上限不同的目标请放在不同的组中。

目录的 `grants.ratings` 提供免费点数，在**全部**付费阶段之前：

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

每项加成有一个正数 `add` 或一个非负数 `set`，绝不同时有两者。所有 `set` 加成都是下限：取最高者，然后所有 add 叠加，到目标的存储上限为止。因此两次免费的等级增加会达到第二级，且不计入付费预算。已有的训练以及字段/属性加成在这些评级加成之前组合。条目选择仍只写入行；它们从不递归应用所选条目的 grants。

界面显示基础/先前、免费、购买和总评级，创建范围以及剩余预算。达到上限、没有预算，或无效购买或手动覆盖需要处理时，加号会被禁用。花费不足、无法达到的最小值和覆盖都会显示徽标；Back 和 Next 仍然可用。重新分配优先级会保留该组已保存的增加量。超支的组整体失效；超过目标上限的购买对该目标失效。减少或清除这些答案即可修复，或恢复之前的配额使其重新生效。之后的阶段可以超过之前的创建上限。**All fields** 仍是自由编辑，覆盖会明确显示，而不会按创建规则限制。

保存的 `builder.allocations[stepId]` 按组 ID 保存优先级位置索引，按稳定的 `kind/id` 目标键（例如 `ability/strength`）保存付费的 `bought` 增加量和可选的 `notes`。`annotations: true` 为每个目标提供最多 1,000 个字符，用于说明血统或专长；构建器不评判这些文字。已应用的增加量按阶段分别归属。重新打开从不会重新授予加成或补满资源，描述已有的人物卡会记录选择而不改写它，描述结束时也是如此。取消选择会重新计算免费评级和付费阶段，同时保留手动差异。

**共享预算与定价购买（Capability API 1.153）。** 在 `sheet.builder.pools` 中声明最多 12 个创建池。多个 `spend` 步骤可以使用同一个池；分开的池让职业点数和个人兴趣点数互不影响。预算是非实时的值引用，包括现有的 `sum`、`scale`、`multiply`、`min`、`max`、`stepTable`、`enumTable` 和 `listSum` 计算。其解析值必须是有限值，且在 0 到 100,000 之间。缺失的来源显示为“not configured”。

```json
{
  "pools": [
    { "id": "occupation", "label": "Occupation", "budget": { "derived": "occupation_points" }, "creditLimit": 0 },
    { "id": "interest", "label": "Personal interest", "budget": { "derived": "interest_points" } }
  ],
  "steps": [
    {
      "id": "occupation_skills",
      "label": "Occupation skills",
      "kind": "spend",
      "pool": "occupation",
      "offers": [
        {
          "id": "accounting",
          "label": "Accounting",
          "target": { "field": "accounting_value" },
          "cost": { "flat": 1 },
          "min": 5,
          "max": 99
        }
      ]
    }
  ]
}
```

每个步骤最多有 120 个选项，各有稳定的 `id` 和 `label`。目标使用与分配阶段相同的恰好一个 `ability`、数字 `field`、带映射的 `skill`/`save` 或 `bonus` 约定。列表行的购买保留给行身份功能（F4）；这个 API 不按数组位置识别行。界限必须符合目标的存储界限。起始评级和免费加成会保留，绝不再次收费：有两个免费点数和五个付费点数的 Background 共有七点。

费用恰好是以下之一：

- `{ "flat": 1 }`：评级每增加一次花一点。
- `{ "perRank": 5 }`：下一等级的五倍，因此从 2 提高到 3 花费 15。
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }`：递增评级处的累计价格。下一次购买移到相邻的评级，花费差额（这里先是 5，然后是 7）。小数评级需要非整数的数字字段；表要包含选项的两端界限。

可选的 `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]` 最多包含 12 项。第一个为正的条件生效。条件读取购买之前的人物卡；没有匹配时使用基础价格。预算和条件不能读取被购买的目标，经由派生值也不行，也不能依赖之后的选择。免费加成和分配阶段在定价购买之前应用。

价格的边际花费总为正，明确声明的抵扣除外。对于评级越高越糟的缺陷，使用 `"credit": true, "cost": { "flat": -1 }`。对于从声明的基线降低，使用 `"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }`：一次购买把 10 降到 9，并记录一点抵扣。起始值必须等于基线。抵扣目标在整个构建器中只有一个选项，以防止购买与抵扣循环。

池默认没有抵扣额度。将 `creditLimit` 设为抵扣总额的上限，并可选加上最多 12 个 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`。筛选项指定选项的 `tags: ["flaw"]`，因此缺陷和劣势的抵扣可以有各自的上限。上限计算抵扣总额，与正向花费无关。不同怪癖的数量仍属于选择/行约束。

**计数行与匹配行（Capability API 1.205）。** `listSum` 可以带 `where: { "column", "equals" }`，只读取其单元格等于某个值的行（空单元格读作该列默认值），也可以用 `count: true` 代替 `column`，计数行数而不是把某列相加。Genesys 的天赋金字塔是两个派生计数加一条创建规则：

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

配合一条规则，其 `value` 读取 `tier2`，其 `max` 读取第 1 级天赋的数量减一。

**逐行计算的行价格（Capability API 1.206）。** rows 步骤的对象 `cost` 可以把其 `column` 乘以 `times` 再加上 `add`，因此 `{ "column": "tier", "times": 5 }` 把 Genesys 天赋定价为每级 5 XP；只有 `add` 时是写成对象的固定价格。`overrides`(最多 4 个) 给出一个替代价格，在由前缀和该行自身单元格指定的派生值于人物卡上读数大于 0 时使用：`{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }` 在 `affinity_<its Ability>` 大于 0 时把 Exalted 的 Charm 定价为 4 Bonus Points。枚举单元格必须为它能取的每个值都提供派生值。

**未定价的选项（Capability API 1.207）。** 在来源尚未提供价格时，消费选项的 `cost`(或覆盖的) 可以是 `{ "unpriced": true }`：该选项会带着说明显示，不占用池中的任何点数，并且永远不会被购买。以某个价格保存、而该价格之后变为未定价的购买会失效，并保留以待修复。

**更多字段（Capability API 1.208）。** 人物卡最多可以声明 240 个字段；1.208 之前上限为 160。Rolemaster 的技能等级、类别等级、潜力值和总值需要这些空间。

**写入属性的掷骰（Capability API 1.209）。** `roll` 步骤的掷骰可以指定 `ability` 而不是 `field`(两者恰好其一)。结果受该属性自身界限约束。带 `gain` 时，检定对照分值进行，只有高于分值的结果才会加上增益，构建器随后将其保留为一次增加：再次掷出或购买该分值时，这次提升仍叠加在上面。没有 `gain` 时，结果像手动输入的分值一样写入，一直保留到构建器自己对该分值的答案改变。计算得出的属性不能掷骰，每个属性在每个步骤中最多掷一次。

**计算得出的列表列（Capability API 1.210）。** 数字列可以指定 `sum`：同一行中最多六个其他数字列，相加（空单元格读作该列默认值）后限制在该列的 `min` 和 `max` 之内。该单元格显示为只读，在每次读取已存人物卡时填入，并像手动输入的单元格一样被求和、行检定及其他一切读取。计算得出的列不会掷骰，也从不把另一个计算得出的列相加。CoC 专长的评级写作 `"sum": ["base", "occupation", "interest"]`。

**部分分值提升（Capability API 1.211）。** 加成的 `abilities.choose` 可以指定 `partialFrom`。做出选择时已经达到或超过该标记的分值只获得部分提升，两次部分提升合起来给一次 `amount`。选择按构建器做出它们的顺序计算，在所有完整提升之后，因此 Pathfinder 2e 的后续提升写作 `"amount": 1, "partialFrom": 4`：+4 调整值需要两次提升才能达到 +5。它可以与 `upTo` 组合使用。

**采用姿态的行检定（Capability API 1.212）。** 列表的 `checks[]` 项可以指定 `stance`，即骰池 `resolution.stances` 之一。此后每一行的检定都采用该姿态，就像该姿态列出的技能一样：Stewpot 的 pursuits 按 STILLNESS 的方式计数骰子。Game Master 的提醒会把这些行与该姿态的技能一起列出。

**属性专长（Capability API 1.213）。** 列表的 `contextual` 可以设置 `"abilities": true`。此后其 `skill` 单元格除了技能，还可以指定一个属性（用 ID、标签或简写），该行适用于以该属性进行的任何检定：单纯的属性检定、以它为自身属性的技能，或用 `with=` 换成它的技能。World of Darkness 的属性专长“Strength: lifting”就是一行名为“lifting”、技能单元格写着“Strength”的行。

**关闭抵消（Capability API 1.214）。** 情境 `check`(在列表的 `contextual` 或条目的 `mechanics.contextual` 上) 可以设置 `"cancel": false`。在它所应用的掷骰上，不高于 `resolution.cancel.upTo` 的点数不会减去成功；大失败仍会读取它们。规则集必须有可关闭的 `resolution.cancel`。

**不必携带即可取用的物品（Capability API 1.215）。** 目录条目的 `grants.itemAccess` 列出规则集中最多 48 件物品（`<catalog>/<entry>`，绝不能是服务）。在引导式构建器中选择该条目，会向角色开放这些物品：人物卡和 Game Master 的人物卡块会把它们列为未携带，背包里不会放入任何东西。被取用时，Game Master 会把一件添加到物品栏，就像 Blades 角色在一次劫案开始时声明负重一样。

**创建时的行点数（Capability API 1.216）。** `allocate` 组可以指定 `rows`，最多四个 `{list, column}` 对：列表各行中该数字列的点数，与组的目标一起计入组预算。这些行在列表上编辑；行点数超出预算的组会等待玩家处理。rows 步骤的费用覆盖可以给出 `times`，即费用列的单位费率，代替固定的 `cost`。Exalted 的 Craft 行把“dots”计入 28 个 Ability 点数，并以 `times: 2` 为“bought”点数定价，在设置了 `affinity_<ability>` 时覆盖为 `times: 1`；计算得出的评级列（1.210）把两者相加。

**最佳评级（Capability API 1.217）。** 情境 `check` 可以设置 `"best": true`：它所应用的技能检定在角色最佳的技能评级高于所要求的技能时，改用最佳评级掷骰。`dice-highest` 规则集可以使用只做这件事的情境检定；其他所有检定效果仍需要骰池。Blades 的 Rook's Gambit 是一个带 `"check": {"best": true}` 的特殊能力行，按名称应用。

**标记轨道的费用（Capability API 1.218）。** 情境 `cost` 项除了 `{"pool", "amount"}`，还可以是 `{"track": "<id>", "by": N}`：应用该行或条目时，把那条普通实时轨道标记 N，以其界限允许为限（伤势轨道不能这样标记）。列表的 `contextual` 也可以带 `cost`。Blades 的 Rook's Gambit 是一个带 `"check": {"best": true}` 和 `"cost": [{"track": "stress", "by": 2}]` 的行。用 `apply=` 应用的名称对弯撇号和直撇号、弯引号和直引号一视同仁。

**借用的目录（Capability API 1.220）。** 目录可以借用另一个已安装规则集的目录，而不携带自己的：`{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`。出借方按其 ID 查找，可以是裸 ID，也可以在社区命名空间之下；其条目按借用方规则集读取，因此指定了借用方未声明之物（状态、威胁档位、感官）的条目会被省略并记录，其余照常引入。与 `from` 并列的 `entries` 会添加到借来的条目中，或替换同 ID 的条目；它们在读取规则集时检查，因此头部要指定它们所带的任何 `filters`(没有指定的头部采用出借方的)。写成人物卡的借来生物使用出借方的 ID；`from.sheet` 说明这些 ID 在借用方中如何读取：`fields` 把字段映射到另一个 ID(或用 `null` 省略)，`values` 映射字段的取值，`tiers` 映射熟练档位（生物自身的，以及任何条目授予或要求的），例如 `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`。任何借来的条目（包括物品）还可以带两项：`refs` 把出借方的派生值读作借用方的某个值（`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`），`slots` 把物品的槽位放到借用方的名称之下（`"slots": { "body": "armor" }`）。目录不能从自己所在的规则集借用，也不能从本身也在借用的目录借用。借来生物的美术按出借方的匹配（生物包中的 `5e-2014/creatures/<id>`）。对借用目录的引用（例如生物的法术）在读取该目录时检查，而不是在读取规则集时。

**更长的成长列表（Capability API 1.219）。** `sheet.advancement.fields` 最多接受 64 个字段（原为 24 个），因此升一级会提高许多字段的游戏（例如每个法术等级的法术位和熟练列表），可以让 GM 提高所有这些字段。超过 24 个字段的列表需要 1.219。

**双向、拥有型与交换型购买（Capability API 1.164）。** `"direction": "both"` 让一个选项从其起点开始提高或降低评级（声明了 `baseline` 时，它必须与人物卡相符）：每升一级花费曲线的价格，每降到起点以下一级就把它作为抵扣赚回，受池的 `creditLimit` 和上限约束。账目只朝一个方向运行，因此降低已购买的评级会按支付时的价格收回最后一次购买，提高已降低的评级会偿还其抵扣；先买后降永远不会产生抵扣。这样的目标在整个构建器中只有一个选项。GURPS 的 ST 写作 `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14, "cost": { "flat": 10 } }`；表格费用可以为 Basic Speed 这类小数步长定价。`"direction": "increase"` 和 `"decrease"` 直接指定单向选项（`"decrease"` 就是上文带基线和抵扣的降低）。

`"effect": "ownership"` 按选项自己的阶梯定价，从其 `baseline`(或 `min`) 向上，人物卡保留其自身值和所购等级中较高者：即使默认值已经更好，一点的 GURPS 熟悉度也会被付费并列出，退款也不会让人物卡失去任何东西。

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }` 让一个选项成为封闭的创建交换：每次购买把 `from` 降低 `units`，并把目标提高 `gain`(默认 1)，绝不让 `from` 低于 `floor`，也不让目标超过 `max`。它不花费池中的任何东西，因此省略 `cost`。交换得来的点数不能再次交换：一旦某次交换提高了一项评级，其他交换都不能降低它；一旦某次交换降低了一项评级，其他交换都不能提高它。某个职业不能进行的交换（`when`）可以反向指定相同的评级。退款会把两项评级都恢复原状。OSE 的主属性交换是每降低一项分值一个选项：

```json
{
  "id": "wis_to_int",
  "label": "Lower Wisdom to raise Intelligence",
  "target": { "ability": "int" },
  "exchange": { "from": { "ability": "wis" }, "units": 2, "floor": 9 },
  "min": 3,
  "max": 18
}
```

构建器在稳定的步骤/选项 ID 下保存带符号的付费增量及其原始价格，每个选项最多 1,000 条购买记录。退款移除最新的一条记录，并精确撤销其贡献和记录的价格，包括移除抵扣。它从不退还免费评级。不会花费任何实时 XP、物品栏、货币或队伍资源。

更改职业、免费加成或预算来源会保留账目。无效的购买会失效；池会显示其原始花费、超支时为负的剩余点数，以及建议的新价格。共享的目标还会暂停其他池中依赖它的购买。**Reprice saved purchases**(重新为已保存的购买定价) 明确接受池的合法新价格；否则请退还记录来修复它。没有任何购买会被静默删除或出售。未花费的点数仅供参考。Back/Next 仍然可用，**All fields** 会在结构界限之内保留可见的手动覆盖。描述已有角色和重新打开已保存的选择永远不会再次授予点数。

**命名行（Capability API 1.154）。** `rows` 步骤让玩家在构建时，在人物卡的某个列表上添加、编辑和移除自己的行：随从、联系人、仪式及其材料，或任何目录没有列出的东西。

```json
{
  "id": "retainers",
  "label": "Retainers",
  "kind": "rows",
  "list": "retainers",
  "columns": ["name", "role", "loyalty"],
  "required": ["name"],
  "min": 1,
  "max": 4,
  "defaults": { "role": "Hireling" }
}
```

`columns` 是该步骤编辑的列表列的子集（省略时为全部）。`required` 指定一行必须填写才算数的列。徽标计数低于 `min`(0 到 20) 时仍缺少的完整行数，加上每个有空白必填单元格的行，因此写了一半的材料仍算未完成。`max` 会停止 **Add a row**(添加一行)，且从不超过列表的 `maxItems`。新行先取各列自己的默认值，再取 `defaults`，后者必须适合每一列。

该步骤编辑每行所在的列表，因此两个同名随从仍是两行，移除其中一个会保留另一个。由目录选择写入的行以只读方式显示，并带有“Added by a pick”说明，随该选择出现和消失。**All fields** 照旧编辑每一行。

**有条件的选项、从人物卡读取的界限与创建规则（Capability API 1.155）。** 消费选项还可以带：

- `when: Ref`：只在购买之前它在人物卡上的读数大于 0 时提供，例如职业自身的技能，或某个部族可以选取的 Background。从未被购买的选项不会改变池；角色已不能选取的选项上已保存的购买会保留并失效，以待修复。
- `minFrom: Ref` 和 `maxFrom: Ref`：从人物卡读取的下限和上限，限制在 `min` 和 `max` 之内。Credit Rating 采用其职业的范围；Dodge 止于 DEX。低于下限的评级会在一次购买中买到下限。
- `allowedRatings: number[]`：购买可以停在的唯一评级，例如以 1、3 或 5 点出售的 Merit。每次购买都按曲线价格直接到达下一个允许的评级。

与预算和覆盖一样，这些都不能读取被购买的目标。带 `onDuplicate: "replace"` 的训练选择可以指定 `replacementFrom`，即重复项可以替换成的技能（或豁免），代替人物卡上的全部技能；它对显示、保存和应用的内容都有效。

`sheet.builder.constraints` 最多容纳 40 条创建规则。每条指定承载它的 `step` 徽标，以及在规则不满足时在那里显示的 `label`、可选的 `when: Ref`，并恰好包含以下之一：

- `value: Ref`，带 `min` 和/或 `max`(各为数字或 Ref)。
- `rows: { list, filter?, sum? }`，带 `min` 和/或 `max`：在 `filter` 保留的行（`{ column, equals?, below?, above? }`）中，列表行的数量，或数字列 `sum` 的总和。
- `distinct: { list, column }`：任意两行都不共用已填写的值（忽略大小写和空格）。
- `approved: fieldId`：必须打开的布尔字段，例如 Storyteller 的批准。

```json
{
  "constraints": [
    {
      "id": "disadvantage_cap",
      "label": "Disadvantages give at most 50 points.",
      "step": "traits",
      "rows": { "list": "traits", "filter": { "column": "cost", "below": 0 }, "sum": "cost" },
      "min": -50
    }
  ]
}
```

不满足的规则从不阻挡 Back、Next 或 **All fields**。

**计算得出的分值与应用于单次掷骰的效果（Capability API 1.156）。** 属性可以带 `value: Ref[]`(1 到 8 个)：其分值是这些值的总和，限制在其 `min` 和 `max` 之内，并以只读方式显示。Blades 的属性是其已标记行动的总和；GURPS 的 Perception 是 `[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`，随它掷骰的技能也会随所购买的值变化。派生值、上限和技能可以读取计算得出的分值，但计算得出的分值之间不能互相读取，经由派生值也不行。构建器从不设定它，为它保存的任何东西都会被忽略。

列表可以声明 `contextual`，让其行在 Game Master 点名时应用于掷骰：

```json
{
  "id": "stunts",
  "label": "Stunts",
  "maxItems": 10,
  "columns": [
    { "id": "name", "label": "Name", "type": "text", "maxLength": 80 },
    { "id": "skill", "label": "Skill", "type": "text", "maxLength": 40 },
    { "id": "bonus", "label": "Bonus", "type": "number", "min": -5, "max": 5, "default": 2 }
  ],
  "contextual": { "name": "name", "skill": "skill", "bonus": "bonus" }
}
```

`name` 是 Game Master 点名一行时所用的列。`skill`(可选) 保存该行适用的技能，用 ID 或标签；空单元格适用于任何检定。`bonus`(数字列) 和 `dice`(骰子列) 加到检定上，在骰池规则集上则是骰子。`to: "saves"` 让各行改为应用于豁免。在骰池规则集上，`check: { dice?, successes?, double?, explode? }` 给每个被应用的行对骰池相同的效果，例如十点会爆骰的专长。

目录条目可以带 `mechanics.contextual`，其中有 `effects`(`own-checks-advantage` 及其他检定和豁免效果)、对 `checks` 或 `saves` 的 `modifiers`、用于收窄的 `skills` 和 `saves`、骰池的 `check` 效果，以及在其所应用的那次掷骰上支付一次的 `cost: [{ "pool": "...", "amount": 1 }]`。Game Master 在检定上写 `apply="Strong Back; Quick Eye"`(最多四个名称)。只有适用于该检定的名称才会改变它：针对其他技能的行、两行共用的名称，以及池无法支付的费用都不会改变任何东西。仅仅拥有某一行永远不会自行改变掷骰。记录在 `from` 中列出应用了什么。

**掷出和从人物卡读取的起始钱币（Capability API 1.157）。** 初始装备中的钱币行可以用 `roll`(如 `"2d6"` 的骰子) 或 `countFrom`(从持有者人物卡读取的 Ref) 代替 `count`，两者不能同时使用，`times`(1 到 10000) 可以与任一者相乘：

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

选择器会显示骰子（“5d4 gold, rolled when taken”）。掷骰只发生一次，在队伍或持有者领取装备包时进行，因此重新打开选择器不会再次掷骰。`countFrom` 读取持有者自己的人物卡，例如 Credit Rating 字段；没有人物卡的持有者会被拒绝，数量为 0 时不添加任何东西。物品行保留其固定的 `count`。

**只设定一次的起始值（Capability API 1.158）。** `kind: "initialize"` 的构建器步骤在玩家确认时写入起始值，之后从不自行再写：

```json
{
  "id": "start",
  "label": "Starting values",
  "kind": "initialize",
  "writes": [
    { "field": "san_start", "value": { "abilityScore": "pow" } },
    { "field": "xp", "remaining": "creation" }
  ]
}
```

每项写入指定一个人物卡字段，以及一个 `value`(固定值，或数字字段的 Ref) 或 `remaining`，即构建器池中剩余未花费的量。该步骤显示每个字段的当前值和将被设成的值；其徽标会等到玩家设定它们为止。写入的值随构建器保存，因此之后重新打开构建器、导入角色或改变 POW 都不会再次写入。人物卡在此之后有所改变时，该步骤会显示再次设定将替换的内容，只有玩家点击 **Set again**(重新设置) 才会执行。正在按其现状被描述的角色永远不会被写入。

实时池可以声明 `startFrom: Ref`，从人物卡读取的值开始，而不是满或空，限制在 0 和其最大值之间；普通轨道可以用 `startFrom` 代替 `default`。指向初始化步骤写入的字段时，SAN 从设定它所依据的 POW 开始，并停留在游玩让它到达的位置：已保存的实时值总是优先于池的起点。

**定价的选择与行（Capability API 1.159）。** 目录步骤或 rows 步骤可以指定一个构建器 `pool` 和一个 `cost`，因此玩家选择或写入的内容，会和 spend 步骤一样从同一个池中支付。目录步骤的费用是一个数字或 `{ "filter": "tier" }`，即条目自身的数字筛选项。rows 步骤的费用是一个数字或 `{ "column": "cost" }`，从每一行读取；负价格是抵扣，受池的 `creditLimit` 约束，因此缺陷可以为特质提供资金。rows 步骤还可以指定 `from`，即为其列表供给内容的行目录：玩家可以随意多次添加某个条目行的副本，每个副本都是玩家自己的行，单独定价和移除：

```json
{
  "id": "charms",
  "label": "Charms",
  "kind": "rows",
  "list": "charms",
  "pool": "bonus",
  "cost": { "column": "cost" },
  "from": "charm_book"
}
```

池无法支付的选择不会提供。定价的选择和行最先支付，也永远不会替玩家卖掉：当移除一个缺陷导致池超支时，spend 步骤的购买会停止生效，直到玩家修复它，每个定价步骤的徽标都会计入这次修复。某列不能超过的总数（Rite 等级）是带 `rows.sum` 和 `max` 的创建规则（1.155）。

**创建方案与更早的阶段（Capability API 1.160）。** `sheet.builder.profiles`(最多 16 个) 让角色类型、职业或套装带来自己的步骤和预算：

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

第一个 `when` 读数大于 0 的方案就是该角色的方案，构建器会说明是哪一个。任何方案列出的步骤，只在列出它的方案是该角色的方案时才显示；隐藏期间其答案会保留，但不授予任何东西。方案的 `budgets` 取代这些池自身的预算，因此切换类型永远不会保留另一类型的预算：它不再覆盖的购买会停止生效，直到玩家修复它们。

目录步骤或初始化步骤可以声明 `reads: { "before": "step_id" }`。此时其条目的 `offeredWhen` 和其 `upTo`(或初始化步骤的值) 按该步骤之前的各步骤所形成的人物卡读取：之后步骤选择、授予或购买的一切都会撤回，玩家手动输入的内容则保留。兼职步骤读取本级属性提升之前的属性值；Humanity 快照读取 freebie 点数之前的 Virtues，无论玩家在各步骤之间如何来回切换。

**自身就是检定的行（Capability API 1.161）。** 列表最多可以声明四个 `checks`，因此玩家写下的每一行都是 Game Master 可以按名称要求的检定：

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name` 是称呼一行所用的文本列，`rating` 是作为其评级的数字列；`ability`(可选) 按技能属性的方式相加。Science (Physics) 和 Science (Biology) 是两行、两项检定，各有自己的评级。同一列表上的两项检定是由同一评级支撑的两种姿态，各有一个 Game Master 在行名后说出的 `label`：“Fire stew (bold)”和“Fire stew (careful)”。人物卡自身的技能、豁免和属性会先匹配。两行共用的名称在其中一行改名之前不构成任何检定，删除的行其检定也随之消失。Game Master 的人物卡块列出每项行检定及其数值，`with=` 的作用与在技能上相同。按评级列定价的 rows 步骤（1.159）会从创建池中购买评级。

**保留骰子的创建掷骰（Capability API 1.162）。** 创建骰写作 `{ "count", "sides", "keep"?, "add"?, "multiplier"? }`：取最高的 `keep` 个点数，加上 `add`，再乘以 `multiplier`，因此 CoC 的 `(2d6+6) x 5` 写作 `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`。

abilities 步骤的 `methods.rolls` 按顺序为每项分值掷骰，各自使用其所在组的骰子，且从不让某次掷骰移到另一项分值上（方法 `"rolls"`）：

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

`kind: "roll"` 的步骤最多列出 12 个 `rolls`，每个写入一个数字 `field`：Luck、生命值、起始资金。`best`(2 或 3) 掷这么多次并保留最好的结果；`floor`(数字或 Ref) 是结果的最小值，例如 1 点生命值，或永不低于其属性值的潜力值；`gain` 则让它成为提升检定，对照字段掷骰，只有结果高于字段时才加上 `gain`，就像 CoC 的 EDU 提升那样。每次掷骰都会连同其点数一起保留和显示。已经掷出的结果保持有效；重新打开构建器从不会再次掷骰，只有带 `retry: true` 的步骤才会提供重掷。正在被描述的角色永远不会被掷骰。

**计数的选择与创建约束（Capability API 1.151）。** 每个步骤都可以带 `when: Ref`(只在非实时的人物卡值大于零时显示并应用它) 和 `requiredWhen: Ref`(只在大于零时把未完成的选择计入其徽标)。隐藏的步骤保留其已保存的答案。即使选择不完整或无效，Next 和 Back 仍然可用；All fields 仍是自由编辑。

目录步骤最多可以声明 12 个 `quotas`，每个使用目录的一个有类型的筛选项：

```json
{
  "id": "ratings",
  "label": "Skill ratings",
  "kind": "catalog",
  "catalog": "ratings",
  "min": 10,
  "max": 10,
  "distinctBy": "skill",
  "quotas": [
    { "filter": "rating", "value": 4, "min": 1, "max": 1 },
    { "filter": "rating", "value": 3, "min": 2, "max": 2 },
    { "filter": "rating", "value": 2, "min": 3, "max": 3 },
    { "filter": "rating", "value": 1, "min": 4, "max": 4 }
  ]
}
```

当目录在每个评级上都提供每项技能时，这就是 Fate 式的金字塔。条目用明确的熟练档位 ID 声明其训练加成；数字筛选值从不凭空创造档位映射。配额满足 `0 <= min <= max <=` 步骤的最大值。最小值影响徽标；最大值禁用更多匹配的选择。`distinctBy` 指定一个已有的筛选项：各选择不能共用其值（对标签筛选项而言是任何标签），缺少该筛选项的条目不能计入。否则按条目 ID 判断是否不同。`quotaBelow: { "filter": "tier" }` 要求对于大于 1 的正整数档位，第 n−1 档的有效选择严格多于第 n 档。第 1 档是底部。移除起支撑作用的选择会让多出的较高选择失效，收回其加成，同时保留其答案以待修复。

`abilities.choose`、`trained.choose`、trained 步骤的 `choose` 以及 `entries.choose` 选择位接受：

- `id`：稳定的人物卡 ID。新的选择位应该使用它；这样已保存的答案在重新排序后仍然有效。没有 ID 的旧选择位保留其按位置的键。ID 在一个来源步骤提供的所有选择中唯一。
- `countFrom: Ref`，带明确的 `max`(1–20，属性最多 6)。没有 `countFrom` 时，`count` 仍是固定数量。动态数量向下取整，并限制在零到 `max` 之间。它读取现有的派生运算，从不读取可执行表达式。
- `excludeChoices: ["background/restricted"]`：同类更早选择的 ID，写作 `source_step/choice_id`。它们排除更早选择的有效答案，包括替换项。引用必须能在定义或同一个目录文件中验证。因此，内联的更早加成选择或明确的 trained 步骤可以为之后的目录文件提供内容；指向另一个外部目录文件的引用会被拒绝。一个步骤中各个可选条目之间的选择 ID 也必须唯一。

属性选择还接受 `from`，与人物卡的属性和 `except` 取交集。对于互不相同的 PF2e 提升，`restricted` 选择可以提供 `["str", "dex"]`，后面接一个排除 `background/restricted` 的 `free_boost` 选择。条目选择接受与目录步骤相同的 `quotas`、`distinctBy` 和 `quotaBelow`，受 `max` 或 `count` 约束；它们仍只写入行，不应用所选条目自身的 grants。

训练选择还接受 `tier`(高于未受训练的某个提供档位，覆盖加成或构建器的档位)、`only: "any" | "trained" | "untrained"` 和 `onDuplicate: "replace"`。资格读取手动训练和更早的有效加成，不包括构建器自己之前的写入。已经被这些来源训练过的所选技能，会在同类未受训练的技能中打开一个单独的替换选择位，并保留原来的答案。替换项遵循该选择的排除项和档位。其保存的键是原选择位的键加上 `/replacement`。Human 的非职业等级可以排除更早的职业选择，并使用 `only: "untrained"`；更改职业会保留之后变得无效的答案。

条件和新的选择位数量只能读取由更早步骤改变的值，以防止自我启用或循环加成。当之后的外部目录文件可能改变人物卡值时，选择位数量不能读取它们；请把其来源步骤提前，或让该目录保持内联。条件可以使用现有的派生 `enumTable`，让亚种步骤只对某一个血统必填。`requiredWhen` 只影响徽标，可以读取任何有效的非实时值。缺少符合条件的内容时，新的受约束选择保持未完成，并带有“not configured”说明。它们从不静默地把所需数量降到可用内容的数量。手动编辑人物卡和由描述生成的角色保留构建器现有的归属规则。

不用构建器创建的角色（一张不为空白、且还没有构建器选择的人物卡）会以**已描述**状态打开：选择只记录角色已经是什么（其种族的增加值视为已包含在其分值中），不改变人物卡上的任何东西，直到玩家选择 **Done: let picks change the sheet**(完成：让选择改动人物卡)。从那以后，更改选择会收回已描述的那个选择所给予的东西。

没有 `tier` 时，训练会到达人物卡提供的、高于未受训练的第一档；提供半档（如 5e 的技能）的人物卡要设置 `"tier": "proficient"`。

<a id="items-what-a-party-carries"></a>

## 物品：队伍携带的东西

护甲、武器、药水、装备、弹药和钱都是物品。可选的 `items` 块声明规则集中每件物品所用的词汇，`holds: "items"` 的目录则列出物品本身。两者都需要 Capability API 1.49；该块中管理 Game Master 自创物品的 `rarityCaps` 和 `propose` 需要 1.51；读取角色所持物品的值（`itemStat`）需要 1.52；物品在穿戴或携带时对检定的作用，以及该块的 `bonus` 上限，需要 1.53；物品对穿戴者的要求及其改变的属性需要 1.54；武器的 `attack` 需要 1.55；物品在战斗中的作用需要 1.56；武器射出什么、装填多少需要 1.57；武器的模式、副手攻击、下限和命中时施加的状态需要 1.58；在战斗中使用物品的效果及其储存的充能需要 1.59；恢复池的使用需要 1.60；休息时恢复充能，或用尽时会损坏的物品需要 1.61；先要求检定的使用（`gate`）需要 1.62；战利品表和生物的战利品需要 1.63；掉落钱币的战利品项，或移除钱币的层需要 1.64；市场、物品的 `sold` 地点和 `service` 需要 1.65；集市日（钱袋、`buyBack`、卖家的 `stock`、`limited` 数量，或不指定地点的 `sold`）需要 1.69；在手持武器上触发的附加效果（`weapons`）需要 1.70；初始装备（`startingGear`）需要 1.78；有风险的物品、赝品或不诚实的卖家需要 1.79。

### 物品块

该块放在文件顶层的 `items` 中。下面是 Ember Roads 的物品块，略有删减：

```json
"items": {
  "categories": [
    { "id": "weapon", "label": "Weapon" },
    { "id": "armor", "label": "Armor" },
    { "id": "ammunition", "label": "Ammunition" }
  ],
  "rarities": [
    { "id": "common", "label": "Common" },
    { "id": "storied", "label": "Storied" }
  ],
  "tags": [
    { "id": "thrown", "label": "Thrown" },
    { "id": "ranged", "label": "Ranged" },
    { "id": "two_handed", "label": "Two-handed" },
    { "id": "arrow", "label": "Arrow" }
  ],
  "stats": [
    { "id": "bulk", "label": "Bulk", "type": "number", "min": 0, "max": 10, "default": 0 },
    { "id": "guard", "label": "Guard", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "damage", "label": "Damage", "type": "dice", "example": "1d6" },
    { "id": "swing", "label": "Rolls with", "type": "enum", "values": ["brawn", "wits", "heart"], "default": "brawn" },
    { "id": "reach", "label": "Reach", "type": "enum", "values": ["close", "near", "far"], "default": "close" }
  ],
  "slots": [
    { "id": "body", "label": "Body", "count": 1 },
    { "id": "hands", "label": "Hands", "count": 2 }
  ],
  "carry": { "stat": "bulk", "encumberedAbove": { "derived": "load" }, "limit": { "const": 12 } },
  "rarityCaps": [
    { "rarity": "common", "stats": { "guard": 1 }, "bonus": 1 },
    { "rarity": "storied", "stats": { "guard": 3 }, "bonus": 2 }
  ],
  "currencies": [
    {
      "id": "coin",
      "label": "Coin",
      "perWeight": 100,
      "units": [
        { "id": "bit", "label": "bits", "value": 1 },
        { "id": "mark", "label": "marks", "value": 10 },
        { "id": "sovereign", "label": "sovereigns", "value": 100 }
      ]
    },
    {
      "id": "salt",
      "label": "Salt",
      "perWeight": 10,
      "units": [
        { "id": "pinch", "label": "pinches", "value": 1 },
        { "id": "cake", "label": "cakes", "value": 20 }
      ]
    }
  ]
}
```

- `categories`：1 到 24 个。每件物品恰好属于一个类别，如护甲、武器或药水。
- `rarities`：可选，最多 12 个。按从最常见到最稀有的顺序列出。
- `tags`：可选，最多 48 个。物品可能具有的特性，如可投掷或镀银。
- `stats`：可选，最多 24 个。物品携带的数字和词语，声明方式与列表列完全相同：`number`、`text`、`boolean`、`enum` 或 `dice`，类型支持时还带范围、取值和默认值。`promptVisible`(默认 `true`) 决定 Game Master 是否会在物品旁看到该数值。只应让玩家看到的内容，例如物品藏在哪里，请设为 `false`。
- `slots`：可选，最多 12 个。物品穿戴或手持的位置，以及角色有多少个该槽位，1 到 20。
- `binding`：可选。同调、灌注，或其他任何限制一个角色同时能绑定多少件物品的机制。`label` 是它的名称，`max` 是从角色人物卡读取的值，如 `{ "abilityScore": "nerve" }` 或派生值。它不能读取实时状态，因为角色能绑定多少物品不会随每次打击而改变。
- `carry`：可选。`stat` 指定作为物品重量的数字数值，其 `min` 须为 0 或以上。`encumberedAbove` 是角色在超重之前能携带多少，`limit`(可选) 是最多能携带多少。两者都像 `binding.max` 一样从人物卡读取。没有 `carry` 时，重量没有意义，也没有人会超重。
- `currencies`：可选，最多六个货币体系，每个体系 1 到 10 种钱币。
  - 同一体系的钱币按 `value` 相互兑换，它以该体系最小的钱币计数。因此最小的钱币价值为 1，同一体系中没有两种钱币价值相同。
  - 两个体系之间从不兑换。另一个国家的钱币，或某个设定中的人情，都是独立的体系。
  - 钱币的 ID 在所有体系中唯一，因为物品的价格只写钱币名。
  - 钱币的 `label` 是它任意数量时的名称（`pennies`）；`one`(Capability API 1.89) 是它恰好一枚时的名称（`penny`），用于价格、钱袋或市场提到一枚钱币的任何地方。没有它时，`label` 也代表一枚。
  - `perWeight`(可选，且只能与 `carry` 同时使用) 是该体系多少枚钱币重一个携带数值单位。
  - 钱币是队伍的钱，和任何物品一样装在背包里（见下文“金钱”）。
- `rarityCaps`：可选，每个稀有度最多一项。Game Master 自创的物品在该稀有度下最多能给出多少：`stats` 中列出的每个数字数值的最大值（在该数值自身范围之内，取整数的数值须为整数），以及 `bonus`(Capability API 1.53)，即其穿戴或携带调整值所能增加的最大固定加值。在带 `bonus` 的稀有度下，以骰子表示的加值会被省略，因为骰子无法限制到一个数字；惩罚从不受限。自创物品受此约束；目录列出的物品属于你，从不受限。
- `propose`：默认为 `true`。设为 `false` 时禁止 Game Master 自创规则集的物品。
- `native`：默认为 `true`。设为 `false` 时，在使用该规则集的游戏中关闭 Game Mode 自带的无类型物品（见**什么会读取物品**）。Game Master 仍可自创物品，用规则集的词汇书写。
- `freeform`：玩家手动输入的物品会成为什么。`"plain"`(默认) 将它保留为没有规则的物品，与现在一样。`"refuse"` 只允许规则集的物品。
- `lootTables`(Capability API 1.63)：可选，最多 24 个。打赢的战斗中的生物，以及 Game Master 的 `[loot:]` 会掉落什么（见下文“战利品”）。

### 一件物品

物品目录不声明 `feeds`：

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

每个条目携带 `item`，而不是 `rows` 或 `creature`：

```json
{
  "id": "hunting-bow",
  "label": "Hunting bow",
  "summary": "Yew, waxed string, and a grip worn smooth by someone else's hand.",
  "item": {
    "category": "weapon",
    "rarity": "common",
    "tags": ["ranged", "two_handed"],
    "stats": { "bulk": 2, "damage": "1d8", "swing": "wits", "reach": "far" },
    "slots": { "hands": 2 },
    "cost": { "amount": 3, "unit": "sovereign" }
  }
}
```

- `id`、`label`、`summary` 和 `filters` 的作用与任何条目相同。标签就是物品的名称。
- `category` 必填。`rarity` 和 `tags` 可选，三者都使用该块自己的 ID。只有该块声明了稀有度，物品才能有稀有度。
- `stats`：该块各数值的值。每个值都必须是对应数值能取的值。
- `slots`：物品占用每种槽位的数量，绝不超过角色拥有的数量。
- `stack`：一叠最多容纳多少，1 到 999,999。没有它时，一叠的容量与任何 Game Mode 物品叠相同。带 `charges` 的物品每叠只有一件。
- `cost`：某种钱币的整数 `amount`，用其 `unit` ID 指定。选择器会显示它，Game Master 也会在物品旁看到它（见下文“金钱”）。
- `sold`(Capability API 1.65)：`{ "place": "city" }`，即市场中出售该物品的最小地点，优先于任何作出不同规定的规则；在 1.69 中，它也可以改为或同时说明一个地点一天备有多少件（`"limited": 2` 或 `"limited": "1d3"`）（见下文“市场”）。
- `service`(Capability API 1.65)：住宿、船票、祝福等设为 `true`：像物品一样购买，但从不携带。购买它只是付钱；其他任何操作都不会把它放进背包（添加它会以 `service` 为由被拒绝），选择器也不列出服务。服务有 `cost`，但没有任何与携带或使用相关的内容（`slots`、`stack`、`binds`、`worn`、`carried`、`requires`、`attack`、`use`、`charges`）。
- `binds`：物品必须先绑定，穿戴时才会产生任何作用。`restriction`(可选) 用文字说明谁可以绑定它，`cursed: true` 标记一旦绑定就无法摆脱的物品。只有带 `binding` 的规则集才能有需要绑定的物品。
- `worn` 和 `carried`(可选，Capability API 1.53)：物品在穿戴时及仅携带时对持有者检定和豁免的作用，它设定或提高的属性（1.54），以及它在战斗中的作用（1.56）。见[战斗外的检定](#checks-outside-a-fight)和[战斗中的护甲与穿戴效果](#armor-and-worn-effects-in-a-fight)。
- `requires`(可选，Capability API 1.54)：物品对穿戴者的要求，以及未达到要求时适用的效果。见[战斗外的检定](#checks-outside-a-fight)。
- `attack`(可选，Capability API 1.55)：物品穿戴时在战斗中作为武器的作用，它射出什么、装填多少（1.57），以及它的其他模式、副手攻击、伤害下限和命中时施加的状态（1.58）。见[战斗中的武器](#weapons-in-a-fight)、[弹药与装填](#ammunition-and-reloading)，以及[模式、第二把武器、下限和命中时的状态](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit)。
- `toggle`(可选，Capability API 1.170)：物品所带的开关，`{ "label", "budget" }`。战斗会把它作为该额度上的一个选项提供（“Turn on Flame Tongue: Flames”），物品栏会以带该标签的按钮提供，无论最后处于哪种状态，都会在战斗之间保留在那一叠上；初始为关闭。带开关的物品在开启期间每叠只有一件。武器带 `when: "toggled"` 的 `plus` 子项只在开启时造成伤害。5e 的 flame tongue：`"toggle": { "label": "Flames", "budget": "bonus" }` 和 `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`。
- `use` 和 `charges`(可选，Capability API 1.59)：在战斗中和战斗外使用该物品的效果、它为该使用储存的充能，以及它恢复的池（1.60）。见[在战斗中使用物品](#using-items-in-a-fight)和[在战斗外使用物品](#using-items-outside-a-fight)。

物品不携带 `mechanics`：它的作用写在自己的 `item` 块中。

### 什么会读取物品

以上所有内容都会在导入规则集时检查，物品目录也随规则集一起提供。游戏中，Game Mode 的物品栏会读取它们：

- **你的物品就在背包里。** 一叠物品可以是你的某件物品，无论玩家如何称呼，它始终是那件物品。物品栏的 **From the ruleset**(来自规则集) 按钮会打开一个选择器，列出目录中的所有物品，带目录的搜索和筛选；隐藏某个条目的层，在这里也会隐藏它。
- **名称能找到你的物品。** 玩家输入的名称，或 Game Master 在 `[inventory: action="add"]` 中写的名称，只要是你某件物品的 `label`(不区分大小写)，就会添加那件物品。两件物品标签相同时，名称找到的是目录中先列出的那一件。
- **`stack`** 会被遵守：添加、设置、合并或给予超过上限时，会填满这一叠并开始新的一叠。
- **`freeform: "refuse"`** 让玩家只能使用你的物品：选择器，以及属于你物品的名称。
- **`native: false`** 让 Game Master 只能使用你的物品和它自创的物品：两者都不是的名称会被拒绝（`not-ruleset-item`），但已持有的东西仍可以继续添加，它的指令也会这样说明。战斗不再询问模型物品栏中的物品有什么作用，因此只有你的物品参与战斗：在规则集战斗中是手持的武器和物品的使用（见下文“战斗中的武器”），在 Classic 或 Tactical 战斗中是带 `use` 的物品（见下文“Classic 与 Tactical 战斗中的物品”）。玩家输入的内容仍遵循 `freeform`，而队伍携带的东西无论哪种情况都会在新会话中回来。
- **物品是什么**会显示在选中的那一叠上：按标签显示其类别、稀有度和标签，它给出的数值、摘要，以及一叠能容纳多少。选择器还会显示它的 `cost`。Game Master 会看到物品栏中你的每件物品，连同类别、稀有度、标签，以及你保留 `promptVisible` 的数值，例如 `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`。

- **`slots`**：占用槽位的物品可以由携带者装备，前提是对应槽位有空；较大的一叠中，会取出一件单独成叠来穿戴。物品栏会按角色显示每个已占用的槽位。
- **`binding`**：带 `binds` 的物品可以绑定，数量上限为从持有者自己的人物卡读取的 `binding.max`(没有人物卡的角色读取空白人物卡)。`cursed` 物品一旦绑定就保持绑定：玩家不能解除绑定、脱下、送人或移除它，只有 Game Master 能结束诅咒。
- **`carry`**：物品的重量是它的 `carry.stat` 值（没有该值的物品没有重量），角色的负重是其背包的重量，与从其人物卡读取的 `encumberedAbove` 和 `limit` 比较。由玩家，或由不带 `who=` 的 Game Master 添加到物品栏共享视图中的物品，会交给能携带它而不超重的人（先是玩家，再按顺序是队伍成员）；没有人能全部拿下时，按各人剩余的空间分配。任何人都不会超过自己的 `limit`：没有人能携带的东西会被留下，并告知 Game Master。像四分之一磅这样的重量，请给重量数值设 `"integer": false`。
- **Game Master 用你的词汇自创物品。** 除非你设置 `propose: false`，否则它的 `[inventory: action="add"]` 可以描述一件新物品：先用 `like=` 指定作为起点的某件你的物品，再写任意 `category=`、`rarity=`、`tags=`、`stats=`(`id=value` 对)、`slots=`(`id=count`)、`binds=`(`yes`、`cursed` 或 `no`)、`worn=` 和 `carried=`(用 `;` 分隔的改动，每项为 `+N`、`-N`、`advantage`、`disadvantage`，或针对豁免的 `fails`，作用于按名称指定的技能或豁免，或作用于代表全部的 `checks` 或 `saves`；在属性名上写 `+N` 或 `-N` 以提高或降低属性；规则集有战斗时，还可以在攻击上写 `+N`、`-N`、优势或劣势，在防御或你对防御的称呼上写 `+N` 或 `-N`：`worn="+1 Sneak; disadvantage on Sway checks"`、`carried="+1 Brawn"`、`worn="+1 Guard"`，或 `none`) 以及 `summary=`，每部分都用 ID 或标签指定。如果防御已经计入某个物品数值（Ember Roads 的 Guard 会加总所穿戴物品的 `guard`），护甲就是靠该数值提高防御的，因此与这种数值并列的穿戴防御改动会被省略，答复也会说明：小模型会为同一个 +1 同时写 `guard=1` 和 `+1 Guard`。它也能读懂小模型常写的替代写法：名称后的数字（`Brawn +1`）、攻击或防御后的 “bonus”（`+1 attack roll bonus`）、表示空标签、空数值或空槽位列表的 `none`，以及没有同名数值时写在 `stats=` 里的 `worn=`、`carried=` 或 `summary=`。Engine 只保留你的块中有的内容：未知的类别、标签、数值、槽位、技能或豁免会被省略；没有的稀有度变为最低稀有度；数字先限制在其数值的范围内，再按其稀有度限制到 `rarityCaps`；穿戴或携带加值限制到其稀有度的 `bonus`(`like` 作为起点的部分也一样)；名称就是你某件物品的，直接就是那件物品。答复会告诉 Game Master 改动了什么（绝不涉及你不向它展示的数值），物品详情会向玩家显示每一处改动。游戏会保存这件物品，因此在本局游戏余下的时间里，同一名称都指这件物品；只要还有人持有，新会话也会保留它。
- 规则集有 `slots` 时，Game Master 可以用物品栏命令 `equip` 和 `unequip` 你的物品；有 `binding` 时，可以 `bind` 和 `unbind` 它们：它只会被告知规则集具有的那些操作。它能看到每个角色的负重、已绑定物品和槽位，以及穿戴或绑定了什么。

- **物品在穿戴或携带时的作用**显示在选中的那一叠和选择器中（“While worn: -1 on checks (Sneak)”），Game Master 也会在物品旁看到它（`worn: -1 on checks (Sneak)`）。战斗外的检定会应用它（见下文“战斗外的检定”）。
- **武器的作用**以同样方式显示（“Attack (Action): Brawn to hit, 1d6 + Brawn cut damage”），手持时战斗会提供它（见下文“战斗中的武器”）。
- **使用物品的效果**也以同样方式显示（“Use (Action): heals 1d4 + 1, range 0 paces, used up”），并附带剩余充能。战斗会提供它，物品栏的 **Use**(使用) 按钮和 Game Master 的 `[inventory: action="use"]` 也一样（见下文“在战斗中使用物品”和“在战斗外使用物品”）。

在 Classic 或 Tactical 战斗中，每件带 `use` 的物品都按其描述生效，没有它的物品不会提供（见下文“Classic 与 Tactical 战斗中的物品”）。无论 `native` 如何设置：人物卡都能读取你的物品（见下文）；在规则集战斗中，手持的武器就是一次攻击，射出从背包中取出的东西；物品在穿戴或携带时的作用在规则集战斗中也会计入（见下文“战斗中的护甲与穿戴效果”）；带 `use` 的物品在战斗中和战斗外都按其自身规则使用（见下文“在战斗中使用物品”和“在战斗外使用物品”）；你的 `currencies` 就是队伍的钱（见下文“金钱”）。

<a id="items-on-the-sheet"></a>

### 人物卡上的物品

值引用可以用 `itemStat` 读取角色持有的物品（Capability API 1.52）。Ember Roads 把旅人所穿护甲的 guard 加到其 Guard 上，也就是打击必须超过的数值：

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`：`"worn"` 是角色身上的物品：占用槽位的物品在装备时、带 `binds` 的物品在绑定时、两者兼有的物品在两者都满足时。两者都不是的物品从不算作穿戴。`"carried"` 是其持有的其余物品，`"all"` 是两者合计。
- `pick`：`"sum"` 把每件物品的值乘以数量后相加，`"max"` 和 `"min"` 读取单件的最高或最低值，`"count"` 按数量清点物品。
- `stat` 指定某个物品数值。`sum`、`max` 和 `min` 需要 `number` 数值。`count` 可以省略它以清点所有物品，也可以指定任意数值，只清点给出该数值的物品。
- `slot`、`category` 和 `tag`(均可选) 只保留占用该槽位、属于该类别或带有该标签的物品。
- `default`(可选，省略时为 0) 是没有选中物品，或选中的物品都不给出该数值时读到的值。

物品会在游玩中变化，因此 `itemStat` 受与实时读取相同的规则约束：池或轨道的 `max`、熟练加值、`binding.max`、`carry` 的数字，以及目录的缩放列或缩放都不能读取它，经由派生值也不行。其他任何读取数字的地方都可以：派生值、检定的 `adjust`、技能的 `cap`、战斗的防御、吸收或先攻。

角色的物品就是其自己背包里的物品。玩家的角色卡（聊天设定为玩家扮演的那张，否则为第一张）读取玩家的背包，其他每张角色卡读取各自的背包。只有规则集的物品才计入，因为普通物品没有可读取的数值。屏幕上的人物卡、检定、Game Master 的人物卡块，以及开始时的战斗，都读取每个角色当时持有的东西。在游戏之外，即人物卡编辑器或导入审核中，没有人持有任何东西，`itemStat` 读取其 `default`。

<a id="checks-outside-a-fight"></a>

### 战斗外的检定

Game Master 在战斗外要求的检定或豁免，读取的不只是人物卡：还有角色自身生效的状态、已达到的等级、物品在穿戴或携带时的作用，以及未达到穿戴物品要求时的代价。它使用与战斗状态相同的词汇（物品相关的键和范围收窄需要 Capability API 1.53）。

物品用 `worn` 说明穿在身上时（需要绑定的还须已绑定）的作用，用 `carried` 说明仅携带时的作用。Ember Roads 的皮外套在你潜行时会吱嘎作响，而路石让商队的人信任你：

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

两者都使用检定所读取的那部分状态内容：

- `effects`：`own-checks-advantage`、`own-checks-disadvantage`、`own-saves-advantage` 和 `own-saves-disadvantage`。
- `modifiers`：用 `to` 指定改动检定或豁免，带 `flat`、`dice`(及 `minus`)、`mode`，以及各自的 `skills` 或 `saves`，与状态的写法完全相同。
- `failsSaves`：持有者无须掷骰便失败的豁免。
- `skills` 和 `saves`：效果以及未自行指定范围的调整值涉及哪些技能或豁免。
- `abilities`(Capability API 1.54)：按 ID 指定它改变的属性，每项为 `{ "set": N }`(至少为 N：更高的分值保持不变) 或 `{ "add": N }`(负数则降低)。它们在计算人物卡之前应用，因此读取该属性的一切都读取改变后的值：屏幕上的人物卡、派生值、检定、Game Master 的人物卡块，以及开始时的战斗。先加上增加值，再取最高的 `set`，属性自身的 `min` 和 `max` 仍然有效。池或轨道的最大值以及熟练加值只根据人物卡计算，因此物品不会改变它们。

Ember Roads 的牛皮护手能让无力的手握得像赶牲口的人一样牢：

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

物品在战斗中的作用（防御、攻击、速度、战斗的其他效果，以及它能挡下的伤害和状态）见[战斗中的护甲与穿戴效果](#armor-and-worn-effects-in-a-fight)；战斗外的检定只读取上述部分。无论某人持有同一物品多少叠，它都只生效一次。

物品还可以用 `requires` 对穿戴者提出要求：其人物卡上的某个值（`value`，任意值引用，读取方式与游玩中的一切相同）、该值的最低要求（`atLeast`），以及未达到时适用的效果（`otherwise`，使用相同词汇，但不能改变属性，因为要求本身可能读取属性）。最多四项。对力弱的守望者来说，Gravewatch 的墓地铁锹是份重活：

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

要求读取的是穿戴者的物品改变之后的属性，因此把 Sinew 设为 3 的护手就能满足铁锹的要求。

检定时：

- 与该检定相关的每个调整值都会加上其数字，并掷出其骰子：求和检定上是固定数字，骰池上是骰子。属性检定，以及规则集无法指名的检定，只读取未收窄到任何范围的内容；豁免只读取与豁免相关的内容。
- 来自各个来源的优势和劣势（包括 Game Master 的 `mode=`）会相互抵消：两种各有任意一个，检定就只掷一次。只有本来就会掷两次的规则集（`resolution.advantage`）才会偏向一方。
- 被状态或物品判定失败的豁免无须掷骰直接失败，也不为它消耗任何东西。
- 记录会说明是什么改变了它：数字用 `effects="-1"`，改变它的来源用 `from="Leather coat"`，无须掷骰便失败的豁免用 `automatic="true"`。骰子卡显示相同内容，Game Master 会在下一回合读到。它会被告知 Engine 已应用这些内容，因此不会再加一次。

Gravewatch 在骰池上展示了同样的做法：已绑定的 Dawn bell 为 Ward 加一颗骰子，Rattled 则从 Soothe 和 Barter 中减去一颗。

### 来自状态、等级、物品和人物卡行的分类防御（Capability API 1.132）

`combat.conditions[]` 和 `combat.levels[]` 可以给予 `resist`、`vulnerable`、`immune`(各 1–30 项) 和 `conditionImmunities`(1–40 个状态 ID)。它们在状态持续期间或等级阈值达到时生效。新获得的状态免疫会结束已经生效的该状态，并防止再次施加它。免疫优先于抗性；抗性与易伤相互抵消。多重抗性从不会让伤害减半两次。

`resist` 和 `immune` 使用生物的写法：一个伤害词，或 `{ "type": "bludgeoning", "except": ["magical"] }`。打击上任何被指定的标签都会绕过该项。`vulnerable` 仍是普通的伤害词。同样的例外写法也适用于物品的 `worn` 和 `carried` 效果。在 `items.tags` 中声明例外标签，并把它们放在武器或法术的性质上。例如，Stoneskin 是这样一个状态映射：

```json
{
  "condition": "stoneskin",
  "resist": [
    { "type": "bludgeoning", "except": ["magical"] },
    { "type": "piercing", "except": ["magical"] },
    { "type": "slashing", "except": ["magical"] }
  ]
}
```

Armor of invulnerability 在其 `worn` 效果中使用同样的 `resist` 数组。Protection from Energy 可以给予 `resist: ["fire"]`；类似 Brave 的特性可以给予 `conditionImmunities: ["frightened"]`。等级可以在达到其阈值时给予 `resist: ["poison"]`。在 `combat.damageTypes` 声明了词汇时，未知的静态伤害词会被报告，与生物相同；没有该声明时，伤害词是自由文本。

对于血统或目录特性，`combat.sheetHides` 最多容纳八个来源（允许空数组）。每个来源指定一个人物卡列表、该列表中的一个文本或枚举列，以及四种类型之一。对于特性行在 `resistance` 列中包含 `"poison"` 的矮人：

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

每一行都提供以逗号分隔的词，去掉首尾空格并不区分大小写匹配；空词会被跳过。添加一行 `"fire"` 会增加火焰抗性；删除它会移除这个来源。抗性和免疫词可以包含 `except`，例如 `"bludgeoning except magical silvered"`。易伤和状态免疫是普通的词。人物卡文本中未知的已声明伤害词会被忽略，未知的状态 ID 也一样；用于状态免疫的枚举列在导入时只能声明状态 ID。人物卡、战斗和 Game Master 的摘要都包含这些防御及其例外。

<a id="weapons-in-a-fight"></a>

### 战斗中的武器

物品可以是武器（Capability API 1.55）。它的 `attack` 与战斗块的[攻击行](#combat-a-fight-your-own-rules-resolve)形状相同，只是用值代替列；物品穿戴时，[规则集战斗](#combat-a-fight-your-own-rules-resolve)会把它作为攻击提供：拿在它所占用的手中，需要绑定的还须已绑定。收起或仅携带的武器不提供任何东西，攻击行和生物自身的行动与以前完全一样。Ember Roads 的手斧：

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`：它消耗的额度，取 `combat.economy.budgets` 之一。
- `toHit`：命中时加上什么。`abilities` 是一个或多个属性 ID，取其中最好的一个（灵巧武器会列出两个）。`skill` 加上该技能检定所加的值，并像攻击行一样，用攻击的属性代替技能自己的属性。`proficiency` 是持有者人物卡上的值：读数大于 0 时，加上规则集的熟练加值（`{ "const": 1 }` 表示始终加）。`bonus` 是一个数字。`sheetBonus` 是从持有者人物卡读取、按原样加上的数字，表示持有者带给某一类所有武器的东西，而非武器本身：5e 的 Archery 战斗风格为每件远程武器给出 `{ "derived": "archery" }`，这是一个对弓箭手为 2、对其他人为 0 的派生值（Capability API 1.95；物品的说明会以它在人物卡上的名称称呼它）。`target` 是骰池战斗中这把武器攻击专用的单骰目标（Gravewatch 的铁锹从 6 起计每颗骰子，而不是骰池的 7），只有 `target` 可调的 `dice-pool` 规则集才能给出；在求和战斗中，用它的 `bonus` 表达同样的意思。
- `damage`：它造成的 `dice`、加上其伤害 `abilities` 中最好的一个、`bonus` 和 `type`。求和战斗需要 `dice`；在骰池战斗中，命中造成的伤害等于其成功数，`dice` 则再加上相应数量的骰池自身骰子。`sheetBonus`(Capability API 1.97) 是从持有者人物卡读取、像 `toHit` 的一样加到伤害上的数字，带 `"oneHanded": true` 时只在单手持用该武器时计入：不包括双手持用的 `versatile` 武器，也不包括占用某种槽位两格的武器。5e 的 Dueling 给出 `{ "derived": "dueling" }`，对单持一把武器的决斗者为 2。`rerollUpTo`(Capability API 1.98) 是从持有者人物卡读取的值：武器自身不高于该值的伤害骰会重掷一次并以新点数为准，重击的额外骰子也一样，只在双手持用武器时（双手空出的 `versatile` 武器，或占用某种槽位两格的武器）且只在求和战斗中生效。5e 的 Great Weapon Fighting 给出 `{ "derived": "great_weapon_fighting" }`，有该风格时为 2。
- `reach` 和 `range`(`normal`，以及表示超出后仍能打到多远的 `long`) 使用你的 `combat.distance` 单位，因此需要声明它。两者都有的武器是投掷武器，与攻击行相同：近处挥击，远处投掷。两者都没有时触及一格。
- `versatile`：当它占用的每种槽位，在持有者所穿戴的物品中还能再容纳同样多时，改为造成的 `dice`：一手持矛、另一只手空着。
- `strikes`：一次消耗能买几次打击，从持有者的人物卡读取，与攻击行的 `strikes` 相同。没有它的武器每次消耗一次打击，无论使用者有多少次攻击。

这些数字或词语中的任何一个都可以改为读取物品自己的数值：`{ "stat": "damage" }` 就是物品的 `damage`，物品没有给出的数值视同没有写这个值。`abilities` 和 `skill` 读取取值为属性或技能 ID 的枚举数值，`type` 读取文本或枚举数值。因此，Game Master 用 `like=` 某件武器自创的物品也是武器，用自己的数值作战，并像任何数值一样受 `rarityCaps` 限制（你直接写下的值按原样复制）。自创时没有槽位也没有绑定的物品从不算作穿戴，因此不会带有攻击。小模型往往会描述一件武器却省略 `like=`，所以在你的某个武器类别中自创、没有起点的物品，会按名称最相近的该类别武器作战（任一方向共用一个词即可，所以 crossbow 和 bow 相近），找不到就按该类别的第一件武器，并采用该攻击读取、而提议中省略的数值，答复也会说明这一点（“It fights as Hand axe does.”）。Game Master 的提议格式也会告诉它，照某件武器做出的武器会像它一样作战。

武器的标签会随其打击一起传递。生物的 `resist` 或 `immune` 项可以说明什么能穿透它：`{ "type": "tearing", "except": ["silver"] }` 表示来自带 `silver` 标签武器的伤害全额承受，来自其他东西的则被抵抗。Gravewatch 的墓地尸妖就是这样写的，银棺钉能够穿透它。不是武器物品造成的伤害，用 `qualities`(Capability API 1.101) 以同样的物品标签说明它所携带的东西：写在目录条目的 `mechanics` 上（法术），以及生物行动的 `damage` 上（deva 的 mace）。5e 的“对非魔法攻击造成的钝击、穿刺和挥砍伤害具有抗性”写作 `{ "type": "slashing", "except": ["magical"] }`，另外两种也同样写，再在其魔法武器的标签上加上 `magical`，并在其法术以及 SRD 称为魔法的生物攻击上加上 `"qualities": ["magical"]`。

武器详情和 Game Master 看到的那一行会说明它的作用：`attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`；Ember Roads 的野猪矛会带 `1d8 with a hand free`，Gravewatch 的铁锹旁会有 `at 6`。

<a id="ammunition-and-reloading"></a>

#### 弹药与装填

武器可以射出某种东西，也可以自己保留已装填的数量（Capability API 1.57）。Ember Roads 的猎弓射箭，Gravewatch 的守夜手枪装一颗弹丸，从守望者的弹丸和火药中装填：

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`：武器射出什么，用某个物品 `tags` 指定。每次攻击从持有者携带的（无论是否穿戴）带该标签的物品中取 `perAttack` 个（未写时为 1），先从背包中第一叠取，再取下一叠。只有携带足够时才会提供该武器，战斗菜单会显示剩余数量。队伍打赢战斗后，每人射出的东西中有 `recover`(0 到 1) 的比例回到其原来那一叠：比例按整场战斗累计，每叠只向下取整一次，因此从同一个箭袋射出五支箭，收回一半就是两支。打输或逃跑的战斗不会收回任何东西。
- `clip`：武器自身保留的已装填数量。`max` 是它能装多少，可以直接写下，或从物品的某个数字数值读取；`reload` 是装填一次消耗的额度。攻击消耗已装填的弹药，而不是从背包取，只有装填量足够一次攻击时才会提供该武器。战斗菜单上的 **Reload**(装填) 选项消耗 `reload` 并将其装满：有 `ammo` 时从背包取（背包剩余较少时就取剩下的全部），没有时直接装满。数量保存在武器的物品栏那一叠上，因此在一场战斗中打空的手枪，下一场仍是空的。从未开过火的武器是已装填的；玩家把它倒入有多件同类武器的一叠时也一样，因为装填数属于单件武器。弹匣里的弹药在战斗后不会捡回，因此 `recover` 适用于没有弹匣的武器。

战斗射出、装填和捡回的东西，会在每一步执行时写入物品栏，与队伍的生命值一样，冒险日志也会记下用掉了什么。如果某一步对应的那一叠已经不在，或数量少于战斗所预计的，这一步会被拒绝，就像战斗找不到已消耗的物品时一样。战斗日志记录每次射击、装填和捡回（“Hunting bow: 2 left to shoot.”、“Ada loads 1 into Watch pistol: 1 of 1 loaded.”），物品详情和 Game Master 看到的那一行会说明武器射出什么、装了多少：`ammunition Arrow (1 an attack, 50% picked up after a won fight)` 和 `holds 1, reload (Act)`。

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

#### 模式、第二把武器、下限和命中时的状态

武器可以有其他攻击方式、副手中的搭档、造成伤害的下限，以及施加给被命中者的状态（Capability API 1.58）。Ember Roads 的猎弓可以齐射，Gravewatch 的银棺钉可以两手各持一枚，并标记被它深深刺中的目标：

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`：最多六种其他攻击方式，每种有 `id`、`label` 及其改变的内容。`ammo` 是该模式下一次攻击射出的数量，因此武器须有 `ammo` 或 `clip` 作为弹药来源。`toHit` 是命中加值，骰池战斗中是骰子，求和战斗中是数字。在骰池目标可调时，`target` 将骰池战斗的单骰目标移动这么多（以武器自身的目标为基准，没有则以骰池的为准；`+1` 表示更难）。`targets` 是它可以瞄准几个目标，每个目标各作一次攻击检定。选定攻击后（有先攻方式时在选定方式之后），战斗菜单会询问用哪种模式，每种都附带预期效果，并只提供持有者弹药足够的模式。Engine 扮演的队伍成员会评估瞄准单一目标的每种模式，而把瞄准多个目标的模式留给玩家。在窗口中，攻击按原样进行。
- `offHand`：副手武器。战斗块指定第二次攻击消耗的额度，以及其伤害是否保留为正的属性值：

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  持有者本回合用一件标为 `offHand` 的武器攻击过之后，其穿戴的其他每件此类武器都会提供一次消耗该额度的第二次攻击，在菜单上名为 “Silver coffin nail, off hand”。`ability` 为 `full`(默认) 或 `penalty-only`；后者只在伤害属性为减值时才加上它，与 5e 的双武器战斗相同。副手攻击只是一次打击，无论主攻击买了几次打击，也绝不会用于打击走开的人。标为 `offHand` 的武器需要战斗块的 `offHand`。`fullWhen`(Capability API 1.97) 是从战斗者人物卡读取的值：大于 0 时，无论 `ability` 怎么写，该战斗者的副手都保留完整的属性加值，就像 5e 的 Two-Weapon Fighting 战斗风格那样。

- `floor`：一次命中至少造成的伤害，可以直接写下，或从物品的某个数字数值读取。骰池战斗中吸收后的伤害，或求和战斗的伤害，会在抗性减半之前提高到这个值，日志也会说明。消耗型打击掷出的是攻击者自身的数字，从不提高。
- `onHit`：打击造成的伤害达到 `atLeast` 时，目标会受到的最多四种状态，持续其自身的 `rounds` 个回合；没有它时，持续到被某种东西移除。伤害指吸收和抗性之后实际作用于目标的部分；夺取型打击夺取的是先攻而不是造成伤害，因此不会施加状态。每一项还可以带 `save: { "save": <save id>, "difficulty": n }`，目标在状态即将施加时进行该豁免，成功则不受该状态；以及 `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`，让状态持续到持有者在每个回合开始或结束时、或在受到大于零的伤害时通过该豁免为止（此时它没有 `rounds`）。两者都算作针对该状态的豁免，武器为魔法武器时还算作针对魔法的豁免（Capability API 1.169）。5e 的 sword of wounding：`{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`。
- `plus`：每次命中额外最多三项数值，每项写作 `{ "dice", "flat", "type", "save", "targetIs", "when" }`，各自掷骰、各有类型、各自受抗性影响（Capability API 1.169）。`save` 指定其自身的 `difficulty` 和 `onSuccess`(`half` 或 `none`)。`targetIs` 只对属于这些生物类型或标签的目标造成它（见“生物类型与目标测试”）。`when: "critical"` 只在重击时造成它；任何子项的骰子在重击时都像武器的骰子一样翻倍。javelin of lightning 写作 `{ "dice": "4d6", "type": "lightning" }`；dragon slayer 写作 `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`；sword of sharpness 写作 `{ "flat": 14, "type": "slashing", "when": "critical" }`。预测只对子项能触及的目标计入它，且从不计入只在重击时生效的子项。`when: "toggled"` 只在物品的开关打开时造成它（Capability API 1.170，见下文 `toggle`）。

武器详情和 Game Master 看到的那一行会说明全部内容：`modes Volley (2 shots, -2 to hit, up to 2 targets)`、`off hand (Quick)`、`at least 1 on a hit before resistance`、`+3d6 slashing against Dragon` 和 `Marked for 2 rounds when a hit deals 2 or more`。

<a id="armor-and-worn-effects-in-a-fight"></a>

### 战斗中的护甲与穿戴效果

物品在穿戴或携带时的作用也可以改变战斗（Capability API 1.56），作用于其持有者，与其状态和等级并列。两者都使用战斗所读取的那部分状态内容：

- `effects`：状态的任何效果，但等级不能有的五种除外（`half-move-to-stand`、`ends-on-damage`、`cannot-target-source`、`cannot-target-source-side`、`cannot-approach-source`），因为没有人把物品施加给持有者，它也从不自行结束：`own-attacks-advantage`、`attacks-against-disadvantage`、`resist-all`、`speed-zero` 等。
- `modifiers`：用 `to` 改动防御、攻击和速度，以及检定和豁免，与状态的写法完全相同；在 `dice-pool` 战斗中，对攻击的改动是固定数量的骰子，与状态相同。
- `resist`、`vulnerable` 和 `immune`：持有者受到一半、双倍或完全不受的伤害种类，与生物的写法相同（声明了 `combat.damageTypes` 时还会据此检查）。`conditionImmunities`：永远不会施加给持有者的状态。

Gravewatch 受诅咒的寡妇戒指让每次攻击少一颗骰子，已绑定的 Dawn bell 让持有者不会陷入 rattled，而携带 Ember Roads 的路石能挡住灼热：

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

与检定一样，战斗对每件物品只读取一次，并以那一叠的名称标注（日志中掷骰旁和防御上的 “Widow's ring”）；未满足要求时的 `otherwise` 在战斗中同样计入，因此对穿戴者过重的护甲会降低速度。物品详情和 Game Master 看到的那一行会说明全部内容（“While worn: -1 on attacks”、“worn: +1 on checks (Ward), immune to Rattled”）。只是增加防御或吸收的护甲，是用 `itemStat` 读取的物品数值（见“人物卡上的物品”），就像 Ember Roads 的 Guard 读取所穿的外套一样。

**硬度。** 在先攻是会被攻击改变的数字时，`combat.pool.hardness` 是战斗者的硬度，在战斗开始时从其人物卡读取（通过 `itemStat` 读取其护甲的硬度），生物则给出自己的 `hardness`。骰子数低于硬度的消耗型打击虽然命中，却没有任何效果：攻击者的数字仍会回到基准值，日志会说明（“Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing.”），菜单也不会为它预测伤害。只有带消耗型方式的规则集才能使用它，以人物卡编写的生物从人物卡获取它。

<a id="using-items-in-a-fight"></a>

### 在战斗中使用物品

物品可以在战斗中使用（Capability API 1.59）：按在伤口上的药膏、吞下的补剂、敲响的铃铛。它的 `use` 用目录条目 `mechanics` 的词汇说明使用效果（见[战斗会从 `mechanics` 读取什么](#what-a-fight-reads-from-mechanics)）：`kind`(`heal`、`attack`、`buff` 或 `debuff`)、`amount`、`damageType`、`plus`、`attackRoll`、`save`、`applies`、`temporary`、`range`、`area`、`targets`、`targetCount`、`friendlyFire`，以及从 Capability API 1.174 起的 `concentration` 和 `zone`，再加上它消耗的 `budget`，或 `free`。Ember Roads 的药膏，以及 Gravewatch 的暖身补剂和 Dawn bell：

```json
"use": { "kind": "heal", "budget": "act", "range": 0, "targets": "ally", "amount": { "dice": "1d4", "flat": 1 }, "consumes": true }
```

```json
"use": { "kind": "heal", "budget": "quick", "targets": "self", "amount": { "flat": 1 }, "consumes": true }
```

```json
"stack": 1,
"use": {
  "kind": "debuff",
  "budget": "act",
  "targets": "enemy",
  "save": { "save": "steel", "onSuccess": "negates" },
  "saveDifficulty": 7,
  "applies": [{ "condition": "rattled", "duration": { "rounds": 2 } }],
  "charges": 1
},
"charges": { "max": 3 }
```

- 使用出现在战斗菜单的 **Items**(物品) 下，以物品名称命名（“Poultice”），无论那一叠叫什么。占用槽位或需要绑定的物品在穿戴时（需要绑定的还须已绑定）使用，就像铃铛那样；其他物品在携带时即可使用。
- 它消耗一份额度，或为 `free`，并以自身作为代价：`cost`、`perCostStep`、`check`、`concentration`、`reaction`、`scales`、`gives`、`standard` 或 `rider` 属于人物卡持有的目录条目，写在使用上会被拒绝。
- 带 `attackRoll` 的使用上，`toHit` 是命中加值，写法与武器的 `toHit` 相同（见“战斗中的武器”）：属性、技能、加值，在骰池战斗中还有单骰目标。没有它时，掷骰不加任何值。
- `saveDifficulty`：它所要求的豁免要对抗的数字（它自己的豁免、结束其所施加状态的豁免，或没有 `difficulty` 的子项豁免），可以直接写下，或从物品的某个数字数值读取。人物卡上的条目从其目录来源读取这个数字；物品没有来源，所以自己写明。
- `consumes: true` 每使用一次就从物品那一叠中减去一件，菜单会显示剩余数量。用掉最后一件时，那一叠也随之消失。
- `restore`(Capability API 1.60) 为它作用到的每张人物卡恢复某个池的一部分，就像血袋补回血液：`{ "pool": "resolve", "amount": { "flat": 1 } }`，`dice` 和 `flat` 的写法与 `amount` 相同。它指定某个实时池，但绝不能是生命池（生命通过治疗恢复），并且只能用于有益的使用，即 `heal` 或 `buff`。生物没有池，因此什么也得不到。日志会说明（“Ada gets back 1 Resolve, and is on 3 of 4.”），Engine 扮演的队伍成员不会对已满的池使用它。Gravewatch 的暖身补剂在治疗之外还恢复一点 Resolve。
- `charges` 消耗物品自身 `charges` 中相应的数量，后者的 `max` 是它能储存多少，1 到 100，可以直接写下，或从物品的某个数字数值读取（给出的该数值小于 1 的物品会被拒绝，超过 100 的按 100 计）。数量保存在物品的物品栏那一叠上，因此一场战斗中敲过两次的铃铛，下一场只剩一次充能，而从未敲过的铃铛是满的。充能属于单件物品，因此带充能的物品 `stack` 为 1。一次使用要么用掉物品，要么消耗充能，不会两者兼有，而物品的充能总是由其使用消耗。`charges` 还有两个键（Capability API 1.61），Gravewatch 的 Dawn bell 就带有这两个键：

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`：哪些 `rests` 会恢复充能，以及恢复多少：`"max"` 将物品充满，数量（`{ "dice": "1d6", "flat": 1 }`）则恢复相应的数量，绝不超过 `max`。休息会恢复该角色携带的、指定了这种休息的每件物品的充能，无论是通过人物卡的 Rest 按钮还是 Game Master 的 `[sheet: op="rest"]` 进行；人物卡和背包会一起写入，重新生成的回复只会恢复一次。休息后，人物卡会说明恢复了什么（“Dawn bell 3/3 charges”），Game Master 也会在物品栏中每件物品旁看到其剩余充能（“2 of 3 charges left”）。
  - `breaksOn`：使用消耗最后一点充能时，Engine 掷一颗 d`die`，结果不高于 `atMost` 时物品损坏，从背包中消失，战斗中和战斗外都是如此。战斗日志会说明（“Dawn bell breaks (a 1 on its die).”），Use 按钮的报告也会说明（“Its last charge spent, it breaks.”），冒险日志会把它记为遗失。

- `gate`(Capability API 1.62) 是使用者在物品生效前必须通过的检定，就像高于阅读者自身水平的法术卷轴所要求的那样。`check` 指定掷什么：`{ "skill": "ward" }`、`{ "ability": "wits" }`，或人物卡上的某个值（`{ "value": { "derived": "spell_mod" } }`，用于因角色而异的数字，例如 5e 施法者的施法调整值）。`difficulty` 取 1 到 100，可以直接写下，或从物品的某个数字数值读取（没有给出该数值的物品不会出现在菜单上，其 Use 按钮会直接说明原因）。使用者人物卡上的某个值至少为 `atLeast` 时，`unless` 跳过检定。检定失败时，物品白白用掉（或白白消耗充能）。在战斗中，检定在消耗物品时掷出，使用战斗自己的骰子（骰池战斗中是骰池，此时 `difficulty` 是所需成功数），以及战斗开始时读取的人物卡数字；使用者的状态和穿戴物品对该检定的加值都会计入，包括技能自身的。日志会说明（“Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success.”）。Gravewatch 的守夜祷文残页就带有它：

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

战斗用掉的物品和剩余的充能，会像武器的射击一样在每一步执行时写入物品栏，冒险日志也会记下用掉了什么。战斗日志记录每次使用（“Poultice: 1 of 2 left.”、“Dawn bell: 2 of 3 left.”）。Engine 扮演的队伍成员只对受伤的人使用治疗，也没有人会用物品打击走开的人。物品详情和 Game Master 看到的那一行会说明使用效果：“Use (Action): heals 1d4 + 1, range 0 paces, used up” 和 `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`，详情还会显示剩余充能。Game Master 用 `like=` 你的某件物品自创的物品，会像那件物品一样使用，充能等一应俱全。

### Classic 与 Tactical 战斗中的物品

不自行结算战斗的规则集，会把战斗交给 Game Mode 自己的 Classic 和 Tactical 战斗；在那里，战斗开始时会询问模型物品栏中的物品有什么作用。你的物品不靠猜测：每件带 `use` 的物品都按其描述、以 Engine 自己的数值生效，只有不属于你的物品才会请 Game Master 猜测（`native: false` 时一件也不会）。

- `heal` 治疗、`attack` 伤害的量，是按其 `amount` 平均值换算的目标最大生命值比例：平均值 7，即基础武器的 `1d8+3`，略多于五分之一，最少二十分之一，最多为全部。这与战斗桥接读取目录条目数值时使用的尺度相同。`damageType` 就是元素。
- `applies` 中的第一个状态以其自身名称作为状态效果施加，持续其 `rounds` 回合（没有时为 2）；`buff` 或 `debuff` 就只是这个状态效果，像 Engine 自身的状态效果一样提高或降低防御。
- `targets` 说明对谁使用。没有它时，治疗或增益用于友方，攻击或减益用于敌方。
- `consumes: true` 从那一叠中减去一件，没有它的使用会把物品留在原处。
- 命中检定、豁免、范围、临时点数和恢复池，在这些战斗中都没有对应位置，与目录条目的 `mechanics` 在其中的情况相同：菜单上的物品描述仍会写出它们。
- 与规则集战斗中一样，占用槽位的物品只在穿戴时使用，需要绑定的物品只在绑定时使用。用掉的物品从穿戴的那件中扣除，绝不从背包里的备用品中扣。
- 使用会消耗 `charges` 的物品，在还剩可用次数时提供，Items 菜单会显示其使用次数。每次使用都从该物品那一叠中消耗，先用玩家自己的；消耗最后一点时掷其 `breaksOn`：损坏后它会从背包中消失，冒险日志把它记为遗失。
- 先要求检定的物品（`gate`）在队伍成员使用时由服务器掷出检定，使用该成员的人物卡和穿戴物品（没有自己角色卡的同伴用空白人物卡掷骰，只有玩家自己的单位才会回退到玩家的角色卡），与 Use 按钮的掷法相同；`unless` 成立时跳过。失败时，物品被消耗（或其充能被消耗）且没有任何效果，日志会说明：“Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing.”
- 没有 `use` 的物品不会在这些战斗中提供，没有 `amount` 的治疗也一样。

Engine 自行计算每件物品的效果，因此画面发送的内容永远决定不了你的物品做什么。

### 战利品

在每个 Game Mode 游戏中，打赢的战斗都会掉落一次战利品，放进队伍的背包。没有规则集时，战利品来自 Game Mode 自己的表（难度越高越多、越稀有）；未声明战利品表且保持 `native` 开启的规则集也是如此。声明了战利品表的规则集改为掉落自己的物品；设为 `native: false` 且没有表的规则集什么也不掉落。

`items` 块中的 `lootTables`(Capability API 1.63) 列出这些表，Gravewatch 的陪葬品就是这样写的：

```json
"lootTables": [
  {
    "id": "grave_goods",
    "label": "Grave goods",
    "rolls": "1d2",
    "entries": [
      { "item": "kit/shot-and-powder", "weight": 4, "count": "1d4" },
      { "item": "kit/warming-tonic", "weight": 3 },
      { "item": "kit/litany-page", "weight": 2 },
      { "filter": { "category": "arm" }, "weight": 1 },
      { "coins": "shilling", "weight": 2, "count": "1d6" }
    ]
  }
]
```

- `rolls` 是该表抽取几次：0 到 20 的数字，或骰子（`"1d2"`），默认为 1。
- 每次抽取按 `weight`(默认为 1) 与其他项比较，抽中一行。一行可以用 `<catalog>/<entry>` 指定你的某件物品；可以是按 `rarity`、`category` 和 `tag` 筛选的 `filter`，在所有匹配的物品中均匀抽取；也可以是 `coins`(Capability API 1.64)，用 ID 指定你的某种钱币。`count` 是掉落数量，数字或骰子，默认为 1。被层移除的物品或钱币不会掉落，找不到任何物品的筛选也一样。
- 生物图鉴中的生物用 `loot` 指定它携带的表（见下文“生物”）。打赢的规则集战斗会为每个被击败的生物掷其表；Engine 不按你的规则结算的战斗没有图鉴生物，因此什么也不掉落。
- 掉落的东西像添加一样进入共享视图，先问玩家的背包，没有人能携带的东西会被留下。Game Master 收到的战后摘要会说明掉落了什么、已经放进背包，冒险日志也会记录，并显示通知。
- Game Master 在故事中用 `[loot: table="grave_goods" who="Ada"]` 掷表（`who=` 指定某个角色的背包），与其物品栏标签一样以回合开始时为基准，因此重新生成的回复只掉落一次。每件掉落的物品都按添加来答复，它的指令会列出你的表。

### 金钱

你的 `currencies` 就是队伍的钱。钱币是背包里的物品，每种钱币和其他物品一样成一叠，以其 `label` 命名：

- 其体系中每 `perWeight` 枚钱币重一个携带数值单位，计入持有者的负重，进入时按携带规则分配。没有 `perWeight` 的体系没有重量。
- 玩家从选择器的 **Coins**(钱币) 列表中添加钱币，并像任何一叠物品一样拆分、给予和合并它们。
- 物品栏各叠物品上方有一行，显示视图中每个体系的钱币，以及它们折合该体系最小钱币的价值。Game Master 会在每个背包旁看到这一价值（`Coin worth 432 pennies`，空钱袋则为 `no coins`，玩家的背包即使是空的也会列出），并在物品旁看到物品的 `cost`(`costs 3 shillings`)。
- Game Master 用 `[inventory: action="pay" amount="3 shillings" who="Ada"]` 付款，用 `action="earn"` 收款。`amount` 是数量加钱币，钱币用 ID 或标签指定，单数复数均可，不区分大小写（`1 penny`、`12 pennies`）。付款从一个背包中支出（不带 `who=` 时为玩家的背包），且只使用该钱币自己的体系：先付能用上的最大面额钱币，再把剩下的、足以付清余款的最小钱币破开，找零以该体系较小的钱币返还，面额从大到小。答复会说明付了什么、找回什么：从只有一枚 crown 的钱袋中付 3 shillings，就是 `Paid with crowns ×1; shillings ×2 back.`。背包付不起的付款会被拒绝（`cannot-afford`），你没有的钱币（`unknown-coin`），以及在没有货币的规则集中的任何付款（`no-currencies`）也一样。收款就是添加该钱币，放进 `who` 的背包，或按携带规则分配。冒险日志会列出支出和收入，并显示通知。它的指令会列出你的钱币，只有带钱币的规则集才有这些指令。
- 购买就是先付款再添加；在有市场的规则集中，则是 `buy`(见下文)。没有商店画面。

### 初始装备

`items.startingGear`(Capability API 1.78) 列出角色在开始时可以放进背包的装备：职业套装、背景套装、Calling 套装。它从不自行给出。物品栏会显示 **Starting gear**(初始装备) 一行，玩家选择一套装备、为其每个选择选一个选项、从每个列表选一件物品，然后把它放进玩家的背包或某个队伍成员的背包。角色人物卡 `fits` 的装备排在最前，然后是没有 `fits` 的装备（适合任何角色，例如背景套装）；每套装备都会提供，因为角色的设定由玩家和 Game Master 共同商定。

```json
"startingGear": [
  {
    "id": "fighter", "label": "Fighter", "group": "class",
    "fits": { "value": { "field": "level_fighter" }, "atLeast": 1 },
    "lines": [{ "item": "equipment/shield", "equip": true }],
    "choices": [
      {
        "label": "Armor",
        "options": [
          { "label": "Chain mail", "lines": [{ "item": "equipment/chain-mail", "equip": true }] },
          { "label": "Leather armor and a longbow", "lines": [
            { "item": "equipment/leather-armor", "equip": true },
            { "item": "equipment/longbow" }, { "item": "equipment/arrow", "count": 20 }
          ] }
        ]
      },
      { "label": "A martial weapon", "options": [
        { "label": "Pick one", "lines": [{ "oneOf": ["equipment/longsword", "equipment/battleaxe"] }] },
        { "label": "A greataxe", "lines": [{ "item": "equipment/greataxe" }] }
      ] }
    ]
  },
  { "id": "acolyte", "label": "Acolyte", "group": "background", "lines": [{ "coins": "gp", "count": 15 }, { "name": "Vestments" }] }
]
```

- 每一行是规则集的一件物品（`item`）、钱币（`coins`，一个单位 ID）、玩家从固定列表中选择的一件物品（`oneOf`，2 到 48 件物品），或按名称给出的普通物品（`name`，在 `freeform` 允许普通物品时可用；受标签规则约束，因此不能有方括号、`{{` 或换行）。`count` 为 1 到 999；`equip: true` 在领取时就把物品穿上（只要其槽位空着），因此护甲从一开始就计入。
- `choices` 为 0 到 8 个，每个有 2 到 6 个由各自的行组成的选项。
- `group`：角色每组只领取一次的装备（职业的和背景的）。再次领取同一组是玩家在对话框中做出的选择，会加到背包中已有的东西上。没有组的装备自成一组，绝不与同名的组相同。
- `fits` 读取不含实时状态的人物卡，与携带相同。它只影响列表的排序。
- 领取要么全部完成，要么完全不做：对其持有者过重的装备会整体被拒绝，对话框会说明它的重量与持有者还能携带的重量。被层移出游戏的物品会被省略并点名，其中所有物品都被移出的列表也一样；被层移除的钱币，会以剩下的同等价值的最大钱币支付，对话框也会这样显示。什么都不剩的装备会被拒绝，因此它永远不会被白白标记为已领取。服务永远不会从列表中提供。
- 导入会检查每件物品（在内联目录中；独立文件中的目录会在领取装备时检查）、钱币、普通物品和 `fits` 引用，拒绝服务，并拒绝需要的叠数超过背包一次所能容纳数量的数量。

### 市场

`items` 块中的 `market`(Capability API 1.65) 说明一个地点卖什么、卖什么价，而不是每家店都按标价出售一切。下面是 Gravewatch 的市场，略有删减：

```json
"market": {
  "prices": [
    { "id": "cheap", "label": "cheap", "times": 0.75 },
    { "id": "fair", "label": "fair", "times": 1, "default": true },
    { "id": "dear", "label": "dear", "times": 1.5 }
  ],
  "places": [
    { "id": "hamlet", "label": "hamlet" },
    { "id": "village", "label": "village" },
    { "id": "town", "label": "market town" },
    { "id": "city", "label": "city" }
  ],
  "sold": [
    { "filter": { "rarity": "rare" }, "place": "town" },
    { "filter": { "category": "arm" }, "place": "village" }
  ],
  "sellers": [
    { "id": "chandler", "label": "chandler", "sells": [{ "category": "coat" }, { "category": "tonic" }] },
    { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "place": "village" },
    {
      "id": "chapel",
      "label": "chapel of the Vigil",
      "sells": [{ "category": "page" }],
      "place": "town",
      "only": { "value": { "abilityScore": "nerve" }, "atLeast": 3, "label": "wardens of Nerve 3 or more" }
    }
  ]
}
```

- `prices`：1 到 8 个档位，每个都是物品 `cost` 的倍率（`times`，大于 0），其中一个为 `default`。价格是以该体系最小钱币计的成本乘以档位倍率，在最小钱币上取整（有成本的东西绝不低于一枚钱币）；如果成本所用的钱币能正好付清，就以它表示，否则以层所保留的、能正好付清的最大钱币表示：在 `dear` 档位下，成本 8 shillings 的外套是 12 shillings，成本 50 gp 的 5e 药水是 50 gold pieces，绝不会是 5 platinum。讨价还价或卖家的心情改变的是档位，而不是数字。
- `places`：1 到 12 种地点规模，从小到大，用你自己的措辞。
- `sold`：规定筛选选中的物品从多小的地点起就有出售。筛选可以指定 `rarity`、`category` 和 `tag` 中的任意几项，匹配具有其所指定全部各项的物品；第一条匹配某物品的规则起决定作用。物品自身的 `sold` 优先于这些规则，没有任何规则指定的物品在任何地方都有出售。
- `sellers`：卖家种类，每种带其 `sells`(若干筛选，任意一个选中即可)、有这种卖家的最小 `place`(没有时为任何地方)，以及可选的 `only`，即只卖给谁：买家人物卡上的某个值（连同其实时状态和所携带的东西）至少为 `atLeast`，并以 `label` 告知 Game Master。没有 `sellers` 时，一个地点的任何人都出售该地点出售的任何东西。
- 没有 `cost` 的物品不出售，被层隐藏的物品，或其钱币被层移除的物品也不出售。

**队伍在哪里。** Game Master 用 `[place: name="Millbrook" size="market town"]` 说明场景所在的地点及其规模，规模用 ID 或标签指定；没有市场的地方（道路、荒野）则省略规模。Engine 就地答复每个标签，拒绝你没有的规模；从最近一次对话开始算起，它在玩家可见的自身回复中最后答复的地点，就是当前生效的地点，直到另有说明。玩家输入的地点标签从不计入。重新生成的回复只读取它所替换的那次叙述之前的内容。

**购买。** Game Master 用 `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]` 购买，`level`(没有时为默认档位) 和 `seller`(没有时为此地任何出售该物品的卖家) 可选。Engine 按回复结束时生效的地点定价，像付款一样从买家的钱袋（不带 `who=` 时为玩家的钱袋）中付款并找零，然后把物品放进其背包；如果是服务，则只付款。两者要么都发生，要么都不发生。答复会说明花了多少（`price="12 shillings"`）、付了什么、找回什么，并显示通知。以下情况购买会被拒绝，且不作任何更改：未说明地点（`no-place`）；你没有的档位、物品或卖家（`unknown-level`、`unknown-item`）；没有价格（`not-for-sale`）；地点太小，不卖该物品（`not-here`）；此地没有出售它的卖家（`no-seller`）；买家不满足卖家的 `only`(`not-to-you`)；钱袋付不起（`cannot-afford`）；或背包装不下。

**Game Master 看到什么。** 场景位于有市场的地点时，MARKET 块会写出地点及其规模、价格档位，以及此地的每个卖家，并按默认档位从便宜到贵列出各自出售的十来样东西；他们出售的任何东西都可以按名称购买。它的指令会教授 `[place:]` 和 `buy`，只有带市场的规则集才有这些指令。

#### 集市日

集市日（Capability API 1.69）让一个地点的货架会变化、会售罄，并允许队伍把东西卖回去。下面是 Gravewatch 的集市日，略有删减：

```json
"places": [
  { "id": "hamlet", "label": "hamlet", "purse": { "amount": 10, "unit": "shilling" } },
  { "id": "town", "label": "market town", "purse": { "amount": 100, "unit": "shilling" } }
],
"buyBack": 0.5,
"sold": [{ "filter": { "rarity": "rare" }, "place": "town", "limited": "1d2" }],
"sellers": [
  { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "stock": { "table": "smiths_odd_lot" } }
]
```

- **一天。** 在一个地点的一天，持续到 Game Master 点名另一个地点为止；在同一地点再说一次并带上 `day="new"`，就开始新的一天（`[place: name="Millbrook" size="market town" day="new"]`）。以下所有内容都根据玩家可见的 Game Master 回复按天计算，因此备选回复、重新生成的回复或分支都不需要保存任何东西，同一天掷出的货架总是相同。
- **`limited`**，写在 `sold` 规则或物品自身的 `sold` 上：一个地点一天备有多少件，可以是数字，或为当天掷出的骰子。规则可以只写限量而不写地点（任何地方都卖，每次几件）；物品的地点取自第一条指定地点的规则，限量取自第一条指定限量的规则。买完之后，购买会被拒绝（`sold-out`），直到新的一天。
- **`stock`**，写在卖家上：你的某个战利品表，每天掷一次，决定该卖家在常规货品之外还有什么存货。掷出的东西（只有物品，从不包括钱币）只由该卖家出售，数量就是掷出的数量，无论 `sells` 和 `sold` 怎么规定；卖家的 `only` 仍然适用。
- **`buyBack`**：卖家按物品默认价格的多少比例（大于 0，最多为 1）收购它。此地出售这类东西的卖家会收购它（没有卖家设置时任何人都会）。没有 `buyBack` 时，没有人回收任何东西。
- **`purse`**，写在地点规模上：此地所有卖家一天合计最多付出多少，以你的某种钱币计。以该钱币所在体系支付的出售都计入其中；没有钱袋时，收购没有上限。
- **出售。** Game Master 用 `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]` 出售。Engine 为它定价，从出售者的背包中取出（不带 `who=` 时为玩家的背包；绝不取已绑定的诅咒物品），并按面额从大到小付入钱币；否则拒绝且不作任何更改：未说明地点、此地无人收购（`not-bought`）、没有价格（`not-for-sale`）、今天的钱袋已花光（`purse-spent`）、没有持有，或背包装不下这些钱币。答复会说明卖了多少钱（`price="4 shillings"`），冒险日志将它列为已售出，并显示通知。
- MARKET 块还会写出每个卖家今天的存货、限量物品还剩多少，以及此地卖家的收购价和今天的钱袋还剩多少；它的指令会教授 `sell` 和 `day="new"`。

#### 诚实与不诚实的卖家

Capability API 1.79 允许物品有风险或是赝品，也允许卖家不诚实。

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`**，写在物品上：诚实的卖家在出售前会警告的内容。MARKET 块会在诚实卖家的商品旁写上“(warn the buyer first: ...)”；不诚实的卖家什么也不说。
- **`passesFor`**，写在物品上，让它成为另一件物品（`<catalog>/<entry>`）的赝品：一件真实、可出售、同类别、穿戴在相同槽位上的物品，赝品需要绑定时它也需要绑定。在两者都可读取时会在导入时检查，安装时对每个目录文件检查，市场提供它时再检查一次，因此目标缺失或被层隐藏的赝品永远不会被出售。被诅咒的物品（`binds.cursed`）或赝品永远不会出现在任何人的商品中，也永远不会出现在诚实卖家的存货中。
- **`honest: false`**，写在卖家上：其 `stock` 表掷出的赝品会被当作它所冒充的物品、以那件物品的价格出售，MARKET 块会在旁边向 Game Master 显示真相。指定了该卖家和该物品的购买会得到赝品；不指定卖家的购买永远不会。
- **背包里的赝品**在玩家看到的所有地方（背包、冒险日志、通知、战斗）都显示为它所冒充的物品，同时保留其真实身份。Game Master 的物品栏块会把它标记为 `[FAKE: really ...]`，并要求它继续用显示的名称称呼它。
- **被识破**：`[inventory: action="reveal" item="Bag of Holding" who="Ada"]`、绑定它（同调会显出诅咒）、使用它（它真正的作用会发生；规则算不出任何作用时，由 Game Master 讲述），或把它卖给诚实的买家，买家会说出它的真实身份并按其价值（它自己的 `cost`）付款，没有价值时则拒绝收购。不诚实的买家会按它看起来的样子收下赝品。从此以后，它就是其真实的物品。
- **穿戴或携带**：赝品在角色人物卡上产生的是它真正的作用（其 `worn` 或 `carried` 效果及其数值）。只要某次物品栏变动之后，人物卡显示出它所冒充的物品不会给出的数字或检定加值，它就会被识破，冒险日志和画面都会说明它原本是什么。只有战斗才会读取的差异（抗性）不会识破它，只改动人物卡、直到下一次物品栏变动之前也不会。在战斗中，穿戴的赝品武器仍会像它所冒充的武器一样攻击。
- 在单人信任模式下，Peek Prompt 会显示 Game Master 的视角，包括真相。

<a id="using-items-outside-a-fight"></a>

### 在战斗外使用物品

同一个 `use` 在战斗外也有效（`restore` 需要 Capability API 1.60；其余不需要新的声明）。对带 `use` 的物品，物品栏的 **Use** 按钮和 Game Master 的 `[inventory: action="use" item="Poultice" who="Juno"]` 都会用 Engine 的骰子，对携带者产生该物品的效果：

- 治疗恢复生命：在生命池上恢复其数量，在伤势轨道上清除一个标记，与战斗中的治疗相同。`temporary` 点数加到生命池上，`restore` 恢复其池，它 `applies` 的每个状态都会施加，直到被某种东西移除。
- 造成伤害或瞄准对方阵营的使用（`kind` 为 `attack` 或 `debuff`，或 `targets` 为 `enemy`）不会作用于任何人：战斗外棋盘上没有可以打的人。物品仍会被使用，Game Master 会被告知它的作用，以便叙述。
- 它与战斗中完全一样，从那一叠中减去一件或消耗其充能；已经用完的物品，或占用槽位、需要绑定却未穿戴的物品，会被拒绝且不作任何更改。人物卡和背包会一起写入。
- `gate` 像检定一样先掷：使用规则集自己的骰子和人物卡的数字，以及使用者的伤势惩罚、其状态和穿戴或携带物品对该检定的作用。失败时物品白白用掉，那一行会说明（“Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.”）。

发生的事用一行说明：“Juno uses Poultice: heals 4 (Grit 6/11). 1 left.” Use 按钮会在 “I use my Poultice.” 之后，用 `[item_used]` 块把它发送给 Game Master，聊天会将其显示为徽章；Game Master 自己的标签也以它答复，与其他标签一样以回合开始时为基准，因此重新生成的回复绝不会把一件物品用两次。没有 `use` 的物品，或在没有规则集的游戏中，仍然只是简单地说：“I use my rope.”

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

上面的 `battle` 块将人物卡数值借给战斗，计算方式仍属于 Marinara。可选的 `combat` 块则是另一回事：它说明如何用你的规则结算战斗。它为 Engine 所拥有的一种战斗类型提供参数，正如 `resolution` 为检定类型提供参数一样，其中每个名称都由你决定。共有两种类型：`attack-vs-defense` 把骰子相加后与一个数字比较；`dice-pool` 则让战斗掷出 `dice-pool` 规则集自己的骰池并计算成功数（见下文“以骰池进行的战斗”）。

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

- `kind`：`"attack-vs-defense"`(一方投骰对抗另一方的防御，命中则造成伤害) 或 `"dice-pool"`(见“以骰池进行的战斗”)。下面每个键在两种类型下含义相同，只是按该类型读取数字的方式来读。
- `health`：必填。战斗扣除的对象。可以是 `{ "pool": "grit" }`，表示向下扣减的实时池；若有临时缓冲，伤害先扣缓冲。也可以是 `{ "track": "harm" }`，表示需要标记的伤势轨道。轨道必须同时指定 `damageKinds`，且不提供临时点数。
- `defense`：必填的值引用。可以是玩家输入的字段，或由你计算的派生值。
- `initiative`：必填。开始时投一次的骰子，以及可选的调整值引用。同值时调整值较高者优先，再按战斗建立时的顺序排列。`"each": "round"` 在每个新轮次开始时让所有人重新投先攻，使用当时的调整值（因此读取伤势轨道的调整值在受伤后会更慢），该轮从新顺序中的第一位开始。Capability API 1.47。`dice-pool` 战斗可以改为以骰池投先攻：`pool`(值引用) 是骰子数量，其成功数加上 `plus` 就是先攻数字，此时旁边不能有 `dice` 或 `modifier`。`resource` 需要 `pool`，它会保留这个数字并允许攻击改变它（见下文“会被攻击改变的先攻”）。Capability API 1.48。
- `attackRoll`：在 `attack-vs-defense` 下必填，在 `dice-pool` 下会被拒绝，因为后者掷的是结算规则自己的骰池。指定骰子、是否投两次取其一(`advantage`)、单骰最大与最小点数的效果(`naturals.max`：`critical`、`hit` 或 `none`；`naturals.min`：`miss` 或 `none`)，以及重击对伤害的影响(`critical`：`double-dice` 再投一次伤害骰，`max-dice` 加一次最高骰面，`none` 则是普通命中)。特殊骰面和检定一样，需要单颗骰子。战斗内的豁免也投相同的骰子。`criticalFrom` 扩大重击点数：它是从攻击者人物卡读取的值，即算作重击的最低自然点数，例如对于人物卡写着 19 的 5e Champion，写 `{ "field": "critical_from" }`。它受骰子最高面的约束，低于 2 的值表示完全没有范围（只有最高面，就像该字段保持为 0 的角色），并且需要单颗骰子且 `naturals.max` 设为 `critical`。Capability API 1.81。
- `economy`：必填。`budgets` 是一个回合可持有的行动额度，包含 ID、标签、`per`(`turn` 在持有者自己的回合开始时补充，`round` 在新轮开始时补充)和 `count`。你首先声明的额度是主额度，标准行动消耗它。`movement` 是可选的值引用，表示按你自己的距离单位，一回合可以走多远。它由棋盘上的战斗读取(见“位置”)。
- `attacks`：可选。其行为武器的人物卡列表。`name` 是给行命名的文本列，`damage.dice` 是骰子列；`toHit.ability`、`toHit.proficiency`、`toHit.bonus`、`damage.ability`、`damage.bonus` 和 `damage.type` 各自指定同一列表中的列。`ability` 列是保存某个自定义属性 ID 的 `enum`，不属于属性 ID 的值不作任何加成。`proficiency` 列是 `boolean`，设为真时加入熟练加值。没有可读骰子的行不是攻击，所以同一列表中的绳索仍只是绳索。`toHit.skill` 指定保存某个技能 ID 的 `enum` 列：该行加上这项技能检定所加的值；如果行指定了自己的 `ability`，就用它代替技能的属性，与检定的 `with=` 替换方式完全相同（Capability API 1.47）。`strikes` 是可选的值引用，说明消耗一次该列表额度能获得几次打击。手中没有剩余打击时选取一行，会消耗额度并将其余打击交到手中；只要手中还有，所有声明了 `strikes` 的行都不再消耗额度，因此换武器、换目标、在两次攻击间行走，都自然地由菜单支持。`strikesCappedBy` 指定一个布尔列，无论列表一次给出几次打击，该列都将自己所在的行限制为一次。这用于无论使用者攻击次数多少，每回合都只能发射一次的武器；它正是为了表达 SRD 5.1 的 Loading 属性而设。若列表本来就一次消耗只给一次打击，该设置毫无意义，会被拒绝。手中的打击属于参战者，不属于某个列表：如果角色的两个武器列表都声明 `strikes`，不论挥动哪一行，都消耗同一份剩余打击。它们在获得它们的回合结束时清除。未声明此项的列表一次消耗获得一次打击，与该功能出现前的所有战斗相同。

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`：可选。其带目录标记的行为能力的人物卡列表，使用 `onlyWhen` 和 `alwaysWhen`，完全按 `battle.skills` 的方式筛选。每个能力的效果取自条目自己的 `mechanics`；该块指定默认消耗的 `budget`、需要攻击检定的条目所加的 `toHit`，以及条目豁免所对抗的 `saveDifficulty`。如果条目要求豁免，无论是自己的豁免，还是结束其施加状态的豁免，而落入的列表没有 `saveDifficulty`，就会被拒绝：没有难度的豁免总会成功。从 Capability API 1.108 起，`byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` 按行的职业选择引用。cleric 3 / wizard 2 可以根据熟练加值加 Wisdom 推导牧师的攻击，根据 8 加该攻击推导 DC，法师的则改用 Intelligence。该列必须存在于来源的列表中，`values` 容纳 1 到 20 项。每一项都可以替换任一引用；省略的引用、缺失的列值或未列出的值，都保留来源自身的引用。战斗、人物卡的行摘要和 Game Master 的摘要读取相同的逐行数字。`stamp` 和 `byColumn` 都需要 schemaVersion 2 和 capabilityApi 1.108 或更新版本。
- `standard`：可选，取自封闭列表 `dash`、`disengage`、`dodge`、`help`、`hide`、`ready`。`dodge`(攻击闪避者时投两次取较差结果)和 `help`(受助盟友下次攻击投两次取较好结果)始终会结算。`dash`(再获得相同移动额度)和 `disengage`(本回合走开时无人能借机攻击你)在棋盘上结算，无棋盘时仅记录。`hide` 和 `ready` 会接受，但目前没有效果。
- `standardEffects`：可选，表达标准行动标记本身无法涵盖的部分。目前仅 `dodge` 有此项：`{ "dodge": { "saves": ["dex_save"] } }` 指定闪避期间哪些自定义豁免投两次取较好结果。只能指定人物卡已声明的豁免，并且 `standard` 列表必须含有 `dodge`。省略后闪避与原来完全相同：更难被命中，仅此而已。
- `conditions`：可选。将你自己的状态 ID 映射到效果，使人物卡状态和战斗状态成为同一份记录，中毒角色战后仍然中毒。效果取自封闭列表：`own-attacks-advantage`、`own-attacks-disadvantage`、`attacks-against-advantage`、`attacks-against-disadvantage`、`attacks-against-adjacent-advantage`、`attacks-against-far-disadvantage`、`attacks-from-adjacent-critical`、`cannot-act`、`cannot-react`、`speed-zero`、`half-move-to-stand`、`ends-on-damage`、`own-saves-advantage`、`own-saves-disadvantage`、`own-checks-advantage`、`own-checks-disadvantage`、`resist-all`、`cannot-target-source`、`cannot-target-source-side`(1.278) 和 `cannot-approach-source`。`failsSaves` 指定在该状态下无须投骰便失败的豁免。需要距离或移动的六项(`attacks-against-adjacent-advantage`、`attacks-against-far-disadvantage`、`attacks-from-adjacent-critical`、`speed-zero`、`half-move-to-stand`、`cannot-approach-source`)由有棋盘的战斗读取，没有棋盘时不产生效果(见“位置”)。`cannot-react` 会将持有者排除在走动打开的响应窗口之外，因此从不会征询其回应。效果旁还有四个键：
  - `modifiers`：状态持续期间它改变的数字。见下文“状态改变的数字”。
  - `saves`：两种豁免效果，以及任何针对豁免的调整值，涉及哪些自定义豁免。省略时表示全部；两者都没有却指定它，会被拒绝。
  - `skills`：两种检定效果，以及任何未自行指定技能的检定调整值，涉及哪些自定义技能。省略时表示全部；两者都没有却指定它，会被拒绝。战斗中的对抗掷的是战斗自己的检定，而不是技能，因此收窄到技能的内容永远不会作用于对抗；战斗外针对这些技能的检定会读取它（见下文“战斗外的检定”）。Capability API 1.53。
  - `whileSourceInSight`：只有施加者在持有者视线内时才生效的部分。`true` 限制整个状态；写该状态自身效果的列表，则只限制所列效果，其余继续有效。这适合无论是否看得到来源，都阻止你走近的恐惧。指定状态并不具备的效果会被拒绝。没有棋盘就没有可打断的视线，因此两种写法都会让所有效果生效。
  - `endsWhenSourceDown`：施加者倒下的瞬间移除状态。
  - 感官（Capability API 1.127）：状态的 `lacks` 指定其持有者不具备的感官，目录条目的 `mechanics.needs` 或生物行动的 `needs` 指定目标必须具备、它才能对其生效的感官。对于 5e 的 Deafened，写 `"lacks": ["hearing"]`；对于 Command，在其 mechanics 中写 `"needs": ["hearing"]`。耳聋的目标不会出现在 Command 的目标菜单中。需要听觉的范围或多目标效果会完全跳过该目标：没有豁免、伤害或状态。Deafened 结束后，该目标再次合法。每个列表有一到四个互不相同的感官 ID，用规则集自己的词；Engine 不认识任何感官名称。
  - 只在人物卡允许时可用（Capability API 1.166）：目录条目的 `mechanics.usableWhen` 写作 `{ "value": <value reference>, "atLeast": n, "atMost": n }`(一个界限或两个)。在战斗中，只有当从持有者人物卡、实时状态和物品读取的值处于界限之内时，才会在其回合或反应窗口中提供该条目；每次绘制菜单时都会读取。5e 的 Protection 需要手持盾牌：`"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`。Rage 的“未穿重甲”与此相同，在重甲数量上写 `"atMost": 0`。写成数值块的生物没有人物卡，因此没有东西限制它。
  - 只在施加者人物卡允许时施加的状态（Capability API 1.167）：目录条目 mechanics 或物品使用上的 `applies` 项可以带 `"when"`，形式与 `usableWhen` 相同。它在状态即将生效时，从施加者的人物卡、实时状态和物品读取，超出界限的项会被跳过；其他项仍然施加。5e 的 Rage 在四项上限之内施加 `raging` 和三种伤害状态之一：`{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`，然后是带 `"atLeast": 9, "atMost": 15` 的 `raging_damage_3` 和带 `"atLeast": 16` 的 `raging_damage_4`。没有人物卡的施加者施加每一项。生物的数值块和状态的 `onEnd` 没有可读取的施加者人物卡，因此在那里 `when` 会被拒绝。需要 schemaVersion 2 和 capabilityApi 1.167 或更新版本。
  - 生物类型与目标测试（Capability API 1.168）：`combat.creatureTypes` 列出参战者可以是什么，`{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id": "devil", "label": "devil" }], "field": "race", "default": "humanoid" }`。生物指定自己的 `type` 和 `tags`；角色的类型是文本或选择字段 `field` 的值（当它是其中一种类型时），否则为 `default`(5e 的角色是类人生物)。目标测试写作 `{ "types": [...], "tags": [...] }`，匹配任意一项即通过；没有类型也没有标签的参战者永远不匹配。它用于三处：伤害子项的 `targetIs` 只对匹配的目标造成该子项（dragon slayer：`"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`，圣水：`{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`）；`applies` 项的 `targetIs` 只对匹配的目标施加该状态；`mechanics.targetTypes: { "is": test, "not": test }` 说明谁能被选中或卷入（Animal Friendship：`{ "is": { "types": ["beast"] } }`；Sleep：`{ "not": { "types": ["undead"] } }`）。范围会跳过 `targetTypes` 排除的人。预测只对 `targetIs` 子项能触及的目标计入它；人物卡上的普通平均值不包含它。战斗面板和 Game Master 能看到每个参战者的类型和标签。需要 schemaVersion 2 和 capabilityApi 1.168 或更新版本。
  - 状态的结束方式（Capability API 1.125）：Charm Person 使用 `"endsWhen": ["harmed-by-source-side"]`。来自施加者或其一方任何人的大于零的伤害，或他们以攻击、豁免或有害状态指向其持有者，都会在该有害行动完全结算后结束它，即使攻击未命中或豁免成功也是如此。`"saveWhenDamaged": true` 在受伤时重复回合豁免：每次受到大于零的伤害，都会以保存的 DC 重复施加行动的 `saveEnds`；成功则结束它。没有保存的豁免或 DC 时，不会掷骰。Hypnotic Pattern 使用 `"endsWhen": ["damaged"]` 和 `"shakeOff": { "budget": "action" }`：任何大于零的伤害都会立即结束它，或者持有者一方的另一个参战者可以在自己的回合花费该额度来结束它。`shakeOff.reach` 以规则集的距离单位计，默认为一格；没有棋盘时不测量距离。行动经济必须声明该额度。`endsWhen` 有一到两个互不相同的项。这些键不改变来源倒下和专注的结束方式。对于只在受到大于零的伤害时进行、从不在回合开始或结束时进行的豁免，使用 `saveEnds.at: "damaged"`(Capability API 1.129)：Dominate Person 的 applies 是 `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`，每次打击以施加行动保存的 DC 掷一次，不需要 `saveWhenDamaged`。
  - 行动经济（Capability API 1.76），就像 Haste 和 Slow 改变它的那样：
    - `budgets`：`[{ "budget": "haste", "flat": 1 }]` 让持有者每回合多获得（或少获得）这么多的某种回合额度，但不会低于零。只有按 `per` 回合补充的额度才能这样改变。额度可以用 `"count": 0` 声明，表示只有状态才会填充它，画面只在有人拥有它时才显示。自创的对手从不花费它。
    - `grants`：`{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true, "items": true }` 说明该额度可以花在什么上：所列的标准行动（来自规则集自己的 `standard` 列表，从不用于主额度，因为每个标准行动本来就在那里）、一次单次打击的武器攻击（无论一个动作原本会把多少次打击交到手中；对生物而言，是对一个目标的数值块攻击，从不是多重攻击），以及物品的使用：`true` 表示任何物品，`{ "tags": ["mundane"] }` 表示只限带有这些物品标签之一的物品（5e 的 Use an Object 是普通物品的使用，从不是魔法物品的启动）。它们只在通常会消耗的额度用完之后才提供，并且只在持有者自己的回合：授予永远不会为反应支付。
    - `exclusive`：`["action", "bonus"]`，一个回合只能花费其中之一的两种额度：花费任一种都会清空另一种。
    - `attacksPerTurn`：其持有者在自己的回合能进行多少次攻击（进行命中掷骰的行动、序列中每个进行攻击的部分，以及代替一次打击的对抗，例如擒抱），无论一个动作原本会给多少次。在别人回合中的反应既不受限，也不计数。
    - `onEnd`：`{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`，状态最终结束时（耗尽、被豁免或伤害结束、专注被打断）留下的东西，再次施加时则不会。它持续若干 `rounds`(从不是 `"until-save"` 或 `"instant"`)。在持有者自己的回合中途留下时，其轮数从下一个回合开始计算，因此一轮就是整个下一个回合。
  - 战斗结束时，无论以何种方式结束，它以计时、`endsAfter` 或专注施加的每个状态都会从人物卡上移除，且不留下任何东西，专注也随之结束。没有计时的状态（坠落造成的倒地）会保留。

  `own-saves-advantage` 及其相反效果与攻击一样，将豁免投两次取其一，彼此抵消。`own-checks-advantage` 及其相反效果对持有者在对抗中的一方做同样的事（战斗在对抗中进行属性检定），也作用于其在战斗外的检定。`resist-all` 在目标自身抗性的基础上将所有种类的伤害减半，并按相同方式与易伤抵消。`cannot-target-source` 阻止持有者将任何东西指向施加该状态的人（`cannot-target-source-side`，1.278：或指向其一方的任何人，除非那一方就是持有者自己的一方）；`cannot-approach-source` 阻止持有者走到比当前格更靠近施加者的位置，连路径也算：绕到同样远的一格仍会提供，但先靠近对方再穿到另一侧的路不会提供。

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **状态改变的伤害（Capability API 1.133）。** `damage` 改变持有者造成的伤害；`damage-taken` 改变持有者受到的伤害。两者都接受 `flat`、`dice`(及 `minus`) 或 `times: 0.5 | 2`。增加量每次攻击命中只加一次，即使该命中有多个伤害子项；重击会像规则集翻倍其他骰子那样把增加的骰子翻倍。豁免和自动命中不获得任何增加。`times` 在增加之后、抗性之前改变整个命中，跨其所有子项把总数向下取整一次。增加的数量按其自身的 `damageType`(省略时按命中的类型) 接受抗性。同类型的增加量在抗性之前并入该数量。

  `attacks` 为 `weapon`、`spell` 或 `any`(默认)。攻击列表行和装备的物品攻击是武器，单目标的数值块攻击掷骰也是；目录能力（包括生物施法）和物品使用是法术或其他攻击。`blow: "melee" | "ranged"` 遵循 1.118，因此在触及范围内的投掷武器算近战。`ability` 指定攻击掷骰实际所选的属性：行的属性，或物品提供的第一个最佳属性（包括灵巧）。普通数值块行动没有属性，永远不匹配属性限制。这些键和 `damageType` 在其他调整值目标上会被拒绝。`fromSource: true` 只用于 `damage-taken`：命中必须来自施加所追踪状态的人。未被追踪的状态、等级或物品没有施加来源，无法匹配它。

  在 5e 中，在人物卡上声明这些状态 ID，然后把这些项放入 `combat.conditions`：

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor 和 Rage 施加在施法者身上；Ray of Enfeeblement 和 Hunter's Mark 施加在目标身上。Hex 使用标记的 `damage-taken` 项，带 `attacks: "any"` 和 `damageType: "necrotic"`。等级以及物品的 `worn`、`carried` 和要求的 `otherwise` 效果共用这些调整值。攻击菜单只计入持有者自己的增加量和倍数；目标身上的标记从不会在那里预先承诺。人物卡和提示词摘要描述持有者自己的伤害调整值，战斗视图还会描述受到的调整值。使用其中任一目标的包需要 schemaVersion 2 和 capabilityApi 1.133 或更新版本，物品位于独立目录文件中时也是如此。

  **状态改变的数字。** `modifiers` 中的每一项用 `to` 指定改变什么，并说明改变多少：
  - `defense`：针对持有者的攻击必须达到的数字。只能是固定数字。
  - `attacks`、`saves`、`checks`：持有者自己的攻击检定、豁免和对抗检定。可以是固定数字，或每次掷骰时都掷的 `dice`(`"1d4"`)；`minus: true` 表示减去这些骰子而不是加上。
  - `speed`：持有者能走多远，用你自己的距离单位（`flat`），或用 `times` 0.5 或 2 表示减半或加倍，在所有固定改动之后应用。和 `speed-zero` 一样，只在棋盘上读取。
  - `health-max`：`times` 0.5 且不带其他内容时，把持有者的生命最大值减半，向下取整且不低于 1(Capability API 1.115)。格子式生命轨道没有可减半的最大值。超过减半后最大值的生命在战斗开始时失去，治疗也从不超过它。

  针对 `checks` 的调整值可以指定自己的 `skills`，针对 `saves` 的可以指定自己的 `saves`，以此代替状态的范围进行收窄。两者都可以用 `mode: "advantage"` 或 `"disadvantage"` 掷两次，与同名效果一起计算并以相同方式抵消，旁边可以有数字，也可以没有；因此一个状态可以同时让 Sneak 更难、让 Climb 更容易。这三个键需要 Capability API 1.53。

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  固定数字自带正负号，0 会被拒绝。每个调整值都会显示在日志中它所改变的掷骰旁，并附上状态名称（“12 + 5 + 3 (Blessed) = 20”），菜单的命中几率和获胜几率也会计入它。状态之间可以叠加；同一个状态出现两次仍是一个状态。

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`：可选。实时轨道的等级，轨道足够高时视为状态；力竭这类逐级恶化的状态就是这样表达的。每一项指定一条普通 `track`(不是伤势轨道)、开始生效的等级 `at`，以及它的作用，使用与状态相同的 `effects`、`modifiers`、`failsSaves`、`saves` 和 `skills`。轨道已达到的每个等级都会计入，因此随着轨道上升而累加。等级没有来源，只有在它读取的值下降时才结束，因此 `half-move-to-stand`、`ends-on-damage`、`cannot-target-source`、`cannot-target-source-side` 和 `cannot-approach-source` 写在等级上会被拒绝。只有带人物卡的参战者才有轨道。日志以轨道和数字命名等级（“- 1 (Heat 3)”）。

  等级也可以不读 `track`，而读取一个 `derived` 值（Capability API 1.54），该值根据角色的实时状态和物品计算，因此不需要任何人去勾选：Ember Roads 会让携带 10 点或更多 bulk 的人变慢。

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  因角色而异的阈值（“超过 Strength 的五倍”）用一个减去它的派生值表达：用 `scale` 乘以 -1 得到要减去的部分，两者的 `sum` 就是等级读取的值。

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` 在战斗开始时、任何人行动之前，就让持有者永久退出战斗（Capability API 1.115）。它和减半最大值所失去的生命都只在战斗开始时结算一次；其他每个等级在它所改变的数字被读取时都会读取。

  对手也带有轨道（Capability API 1.115）。没有人物卡的对手从给予它的 `tracks` 开始，按你的轨道 ID：Game Master 提议的生物可以指定它们（`"tracks": { "exhaustion": 2 }`），放入战斗的图鉴对手也可以。生物的 `conditionImmunities` 可以指定某个等级所读取的轨道，此后该轨道的任何等级都不会影响它，无论有没有人物卡：5e 的不死生物和构装生物免疫力竭。

  调整值、等级和检定效果需要 Capability API 1.45。

- `checks` 和 `contests`：可选。对抗读取什么，以及战斗中任何人都可以发起的对抗：擒抱、推撞、挣脱。见下文“对抗”。Capability API 1.43。
- `concentration`：可选。指定记录维持内容的实时 `text` 字段、伤害强制要求的 `save`、难度下限 `floor`，以及所受伤害的比例 `fromDamage`，在后者更高时用它确定难度。开始第二个需要专注的能力会结束第一个；豁免失败也会结束专注，并一并移除它维持的状态。
- `dying`：可选，`kind: "saves"`。指定记录投骰次数的两条轨道(所需次数取各轨道自身最大值)、`dice`、`succeedAt`、最大与最小骰面的效果(`naturals.max`：`revive-1` 或 `success`；`naturals.min`：`one-failure` 或 `two-failures`)、倒下时受伤的代价(`damageWhileDown`、`criticalWhileDown`)，以及倒下角色所处的 `condition`。没有此块时，角色降到零就只是倒下，治疗即可恢复。
- `damageTypes`：可选。你的系统拥有的伤害类型，不区分大小写匹配。
- `damageKinds`：`health` 指定伤势轨道时必填，指定池时则拒绝，因为只有标记能携带种类，点数池没有位置保存种类(见前文“伤势轨道”)。它说明一次打击标为轨道的哪个 `kinds`，以及勾几格。`default` 用于一切未映射的情况，包括完全不带类型的打击；`byType` 将你的 `damageTypes` 映射到标记种类，键和类型本身一样不区分大小写，所以 `"Fire"` 和 `"fire"` 是同一个键，同时指定会被拒绝。`marks` 没有默认值，因为两种选择含义相反：`"per-point"` 表示伤害骰计算生命等级，3 点打击勾三格，减轻 1 点也有价值；`"per-blow"` 表示打击要么命中要么未中，无论打得多重都只勾一格。带多个伤害子项的打击也只标一格，采用实际生效的最严重种类。请明确你的系统采用哪一种。`{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`。
- `pool`：在 `dice-pool` 下必填，在 `attack-vs-defense` 下会被拒绝。见“以骰池进行的战斗”。
- `spendLimits`：可选。在战斗中，一个参战者每 `turn` 或每 `round` 最多能从某个实时池消耗多少，无论哪种池都适用：`[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`。`max` 在战斗开始时读取一次。超出剩余限额的费用视为付不起，因此不会出现在菜单上，无论池中还有多少。每回合的限额在持有者自己的回合开始时重新计算，每轮的限额在新一轮开始时重新计算。以直接数值编写的对手不从人物卡支付任何东西，因此限额从不约束它；以人物卡编写的对手从自己的池中支付，与其他人一样受限额约束。Capability API 1.47。
- `threat`：可选，生物图鉴需要它。`tiers` 是选取敌人的尺度，包含 ID、标签、`health` 区间、`defense`、`toHit`、`damagePerRound` 区间和 `saveDifficulty`。你提供的每个生物都指定其中一档；没人预先编写的敌人则会拉回 Game Master 要求的档位，因此不会超出你的尺度。`damagePerRound` 区间按生物一轮内对一个目标造成的伤害读取，包含完整动作序列。

### 针对状态、伤害或魔法的豁免（Capability API 1.134）

带 `to: "saves"` 的调整值可以带 `against`。它至少需要 `conditions`(人物卡状态 ID)、`damage`(伤害类型) 或 `magic: true` 之一。匹配任意一项即可；`saves` 仍以“且”的方式收窄是哪种豁免。请使用调整值的 `mode: "advantage"`，而不是 `effects`，以这种方式收窄优势。这些调整值适用于状态、已达到的轨道或派生等级，以及物品效果。对于种族特性，从人物卡的种族选择派生一个值，并把调整值附加到该值为 1 时达到的等级上。调整值示例：

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave 使用 `conditions: ["frightened"]`。Magic Resistance 使用不带 `saves` 的 `magic: true`，写在生物由人物卡派生的等级或轨道等级上。行动的 `applies` 即使被豁免阻止也会计入；其伤害包括每个 `plus` 子项。伤害名称不区分大小写匹配。魔法是指 1.101 的 `"magical"` 性质：目录的 `mechanics.qualities`(即使没有伤害)、生物行动的 `damage.qualities`，或武器物品的标签。法术必须带有该性质；仅凭其名称或所在目录不能让它成为魔法。结束状态的豁免（包括 `saveWhenDamaged` 和 `saveEnds.at: "damaged"`）只针对该状态。专注豁免和死亡豁免不针对任何东西。在战斗外，Game Master 的豁免请求不带结构化的来源或状态；`against` 从不匹配这些请求。人物卡、物品详情、战斗详情和 Game Master 的人物卡摘要都会显示这些限制。需要 schemaVersion 2 和 capabilityApi 1.134 或更新版本。

### 以骰池进行的战斗：`dice-pool`

`dice-pool` 规则集计算成功数而不是把骰子相加，它的战斗也可以如此。`"kind": "dice-pool"` 要求 `resolution.kind` 为 `"dice-pool"`，并以骰池检定已有的方式读取人物卡：**掷骰所加的每个数字都是骰子数量，所要达到的每个数字都是成功次数。** 因此不需要改任何名称：

- 命中数字（攻击行的、能力列表 `toHit` 的、生物行动的）就是攻击所掷的骰池。骰子、单骰须达到的目标，以及哪些点数计两次、爆骰、抵消和大失败，都取自你的 `resolution`。`resolution.penaltyFrom` 指定的伤势轨道会从骰池中扣除其惩罚，与检定相同。
- `defense` 是攻击所需的成功次数，绝不少于一次。状态对 `defense` 的调整值和掩护（`cover.bonus` 或 `cover.threeQuarters`）都会加到它上面。
- 超过所需的每次成功增加一颗伤害骰。大失败一律未命中，无论计了多少成功。没有重击：强力命中的价值就在于额外的骰子。
- 豁免的数字就是其骰池，难度就是所需的成功次数。对抗把双方的检定都作为骰池掷出，成功更多的一方获胜。
- 状态对攻击、豁免或检定的调整值是增减的骰子，因此是 `flat` 数字：掷骰得出的调整值（`dice`）会被拒绝。
- 伤害就是你的骰子：数量的 `dice`(生物的、条目的) 说明掷几颗，且必须是你的骰子；其 `flat` 部分是自动成功，从不掷出。攻击行的伤害骰列只读取其骰子数量，`damage.ability` 把该属性的评级作为骰子加入，`damage.bonus` 增加自动成功。`perCostStep` 和 `scales` 一如既往地增加骰子。治疗和临时点数是数量，照旧相加。
- 先攻是总和（`initiative.dice` 加 `modifier`），或在你要求时为骰池（`initiative.pool`，见下文），濒死规则保留自己的骰子。

除此之外，骰池战斗还会掷的内容由其 `pool` 块决定：

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`：偏向一方的掷骰是否掷两次并保留成功更多的那次（大失败视为少于任何未大失败的掷骰）。没有它时，无论状态怎么说，战斗都只掷一次。
- `damageTarget`：伤害骰和吸收骰所对抗的单骰目标。省略时取结算规则的默认目标。这些骰子只把达到或超过它的点数各计一次，别无其他：它们不会计两次、爆骰、抵消或大失败。
- `soak`：目标按伤害种类从一次命中造成的伤害中减去多少。`all` 是适用于任何种类的值引用，`byKind` 则为生命轨道的每个种类各给一个，对其种类优先于 `all`；两者都未指定的种类不吸收。`"roll": true` 时，目标对抗伤害目标掷相应数量的骰子，每次成功减去一点。`"roll": false` 时，这个数字在掷伤害骰之前从伤害骰中扣除，因此从不触及自动成功；而掷骰吸收会像减去其他成功一样减去自动成功。任何值都不会低于零，没有计到任何成功的打击也不会掷骰吸收。生物用 `soak: { "all": 1, "byKind": { "knock": 3 } }` 给出自己的数字，这需要该块的 `soak` 说明如何吸收。抗性、易伤、免疫和 `resist-all` 在吸收之后作用于剩下的部分。
- `hardness`：在先攻是会被攻击改变的数字时，表示战斗者硬度的值引用。见[战斗中的护甲与穿戴效果](#armor-and-worn-effects-in-a-fight)。

每个目标的伤害都为该目标单独掷出，因为命中超出所需成功数所赢得的部分，以及目标吸收的部分，都只属于该目标。打击的第二个子项和附加效果各自是一个独立的、有自己种类的伤害骰池，不会从命中获得额外骰子。菜单会精确预测骰池：达到所需成功数的几率，以及第一个目标吸收之后伤害骰的价值。

Gravewatch 就是这样写的：它的守望者掷一个评级加一个专业技能，用 Sinew 吸收冲击伤，完全不吸收撕裂伤，每回合可以消耗一点 Resolve，并且每轮重新投先攻。

**逆序声明没有实现。** 有些系统要求所有人在任何人行动之前先声明行动，最慢的人先声明。在每个参战者轮到时才选一个行动的战斗中，先声明不会改变任何规则读取的内容，因此没有需要用键表达的东西。

### 最低伤害骰（Capability API 1.146）

骰池战斗即使面对强大的吸收也能保留骰子，就像 Exalted 的 **Overwhelming**：

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

这就是 `combat.damage.minimum`，一个从**攻击者**当前人物卡读取的值引用。静态吸收从一次命中的第一个伤害骰池中扣除骰子后，骰池会被提高到至少这个数。它是整数颗骰子，向下取整并限制在零到 `resolution.pool.max` 之间，而不是自动成功：每颗留下的骰子都可能失败。掷骰吸收仍在伤害掷骰之后扣除成功；它不减少骰池，因此最小值无法保护成功不被它扣除。抗性和免疫仍然适用。消耗先攻的打击无视最小值，就像它们无视武器伤害和吸收一样；夺取先攻的打击会使用它。

武器可以用 `item.attack.damage.minimum` 覆盖通用最小值。它接受针对持有者的同样的值引用，或用 `{ "stat": "overwhelming" }` 指定物品自身的某个数字数值。声明为零也会覆盖通用最小值。这与现有的武器 `floor` 不同，后者保证的是吸收之后的伤害量。额外的伤害子项和附加效果不会再获得一个最小值。战斗记录和日志会在骰子旁显示解析后的最小值。战斗键和武器键在包中都需要 **Capability API 1.146**，包括外部目录文件中的武器。

### 让人眩晕的命中（Capability API 1.147）

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` 用于骰池战斗。`over` 在命中之前立即读取**目标**当前的人物卡。一次命中在吸收、豁免和抗性之后造成的伤害，必须**严格大于**该数字。其伤害子项合并计算；分开的命中永远不会累积起来造成眩晕。在按每次打击标记的轨道上，造成伤害的命中算作一级。夺取先攻而非生命的打击不能造成眩晕。`measure` 目前只能是 `"damage"`。

目标跳过其紧接着的下一个回合。在那个回合之前的更多眩晕命中不会叠加额外的跳过。被跳过的回合仍会推进状态计时和其他回合记账，包括轮次变化和重投先攻。保存/重新加载战斗会保留待执行的跳过。有 `condition` 时，它指定一个已声明的人物卡状态。战斗会标记它，直到被跳过的回合过去或战斗结束。已经存在的状态保持原样；状态免疫会阻止标记，但不会阻止跳过。`text` 是可选的叙述，不是另一项效果。日志和 Game Master 的战斗上下文会记录这次命中和跳过。该键需要 **Capability API 1.147**。

### 由目标决定伤势种类（Capability API 1.148）

在现有的 `combat.damageKinds` 映射中加入 `remap`；保留其 `default`、`byType` 和 `marks`：

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

骰池战斗先用普通映射选出攻击的种类，然后在**目标**身上读取每条重映射的 `when`。非零数字启用该规则。`from` 和 `to` 都必须是生命伤势轨道上的种类。第一条匹配的规则生效；重映射不会连锁。最多可以给出 12 条。带 `tags` 时，至少要有一个与攻击匹配：武器已经带有 `item.tags`，目录 mechanics 和生物伤害已经带有 `qualities`。这些名称来自 `items.tags`。没有 `tags` 时，该种类的任何攻击都可能匹配。不需要新的攻击标签字段。

得出的种类同时决定**吸收**和伤势标记。因此，火器的致命命中打在吸血鬼身上可以变成冲击伤，并使用冲击伤的吸收；同一火器打在别人身上，或刀刃打在那个吸血鬼身上，则保持其普通种类。攻击原本的伤害*类型*在抗性和免疫上不变。每个伤害子项使用其自身的种类和攻击的标签。战斗记录和日志会显示原来的种类和重映射后的种类，伤害预测也读取同一规则。没有人物卡的普通生物可以满足常量引用，但不能为这些规则提供人物卡值；为此请给它一张生物人物卡。只有新的 `remap` 键需要 **Capability API 1.148**；旧的伤害种类映射保持其现有的兼容性。

### 会被攻击改变的先攻

有些骰池系统在整场战斗中把先攻作为一个数字保留，并允许攻击改变它：一种攻击方式从目标那里夺取先攻，另一种把攻击者自己的先攻作为伤害消耗掉，跌到某条线的人就崩溃了。`dice-pool` 战斗可以表达这一点（Capability API 1.48）：

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **开场。** 战斗开始时，所有人掷 `pool` 颗骰子，成功数加上 `plus` 就是各自的数字，因此 `resource` 需要 `pool`：相加的骰子只能排出顺序，不是骰子数量。生物的 `initiativeModifier` 就是它的骰池，因为骰池战斗所加的每个数字都是骰子。这个数字会一直保留：从不重新投掷（`resource` 旁边不能有 `each`），每轮开始时按当时的数字排序。
- **方式。** 每种攻击（攻击行、作命中检定并造成伤害的能力或目录条目、造成伤害的生物行动，以及由其他行动组成的行动）都按每种方式各提供一次，玩家先选方式再选目标。最多四种，每种要么夺取、要么消耗，且至少有一种是夺取。未指定方式的选择按第一种进行；指定了攻击未提供的方式会被拒绝。攻击在结束之前一直保持它发起时的方式，即使有回应在它落下之前改变了攻击者的数字。
- **夺取型方式。** 命中时照常掷伤害（命中带来的额外骰子、武器的骰子、按种类吸收、自动成功），计得的数值从目标的数字中扣除，而不是从生命中扣除。攻击者获得全部数值，再加上 `gain`。
- **消耗型方式。** 只在攻击者的数字高于崩溃线时提供（未给出 `crash` 时为 0），且从不用于由其他行动组成的行动，因为一个数字只能花在一次打击上。命中时，伤害就是攻击者发起攻击时的数字，以骰子对抗伤害目标，此外别无其他：没有武器骰、没有命中带来的额外骰子、没有自动成功、没有吸收。它按攻击自身的伤害种类标记生命。攻击结束后，在任何目标上命中过的数字回到 `base`；一处也没命中的，则按发起时的数字失去 `onMiss` 所规定的量（阶梯表：`[at least, lose]` 对，升序排列；低于第一档时不失去任何东西）。
- **崩溃。** 跌到 `crash.at` 或以下的数字就崩溃了：对其施加 `condition`(你自己的状态之一，可选)，把他们打到这里的人获得 `bonus`。让攻击者自己崩溃的未命中不给任何人奖励。崩溃的参战者不能使用消耗型方式。以下情况会解除崩溃，连同状态一起：其数字再次升到线以上时；经过其自己的 `recoverAfter` 个回合后（该回合开始时其数字回到 `base`）；以及战斗结束时，无论以何种方式结束。开场投掷就处于线上或线以下的人，以崩溃状态开始战斗。`base` 必须高于 `crash.at`，否则回到基准值又会让他们崩溃。

菜单显示每种方式各自的预测：命中几率，以及夺取型方式会夺取多少，或消耗型方式会造成多少伤害。状态面板显示每个人的数字，日志说明每次变化及原因：“Ada gains 5 initiative for crashing Rats, and is on 14.” Engine 的选择器会向前看一个回合来评估夺取型打击：比较先夺取再消耗，与现在消耗、之后从基准值再消耗。

<a id="what-a-fight-reads-from-mechanics"></a>

### 战斗会从 `mechanics` 读取什么

`kind` 决定 `amount` 是伤害还是治疗；所有标为 `reaction` 的条目都不会出现在菜单中，`utility` 条目也一样，除非它改变回合自身可持有的内容(见下文)。`attackRoll` 使用列表的 `toHit` 对目标防御投骰；`autoHit` 完全跳过这一步。`save` 使用目标自己的豁免对抗列表的 `saveDifficulty`，`onSuccess` 决定成功时承受一半还是零。`targetCount` 表示能指向几个目标。没有攻击检定的能力(人人豁免的范围、直接命中的效果)只为所有人投一次伤害骰；对各目标分别作攻击检定的能力，则每次命中都重新投伤害骰。`applies` 为受影响对象施加状态，每项具有 `duration`：`instant`(没有自己的计时，直到被移除才结束)、`until-save`(须同时有 `saveEnds`)或 `{ "rounds": n }`；还可用 `saveEnds` 指定豁免及其在 `turn-end` 或 `turn-start` 重复。轮数在持有者自己的每个回合结束时倒数；`{ "rounds": 1, "at": "turn-start" }` 则在每个回合开始时倒数，“直到你下个回合开始”就这样表达。`"of": "source"`(Capability API 1.119) 改为倒数施加者的回合，从其下一个回合开始，对别人身上的状态说“直到你下个回合结束”就这样表达。Guiding Bolt 的 `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` 让施法者下个回合结束前针对其目标的下一次攻击掷骰获得优势。如果来源离开战斗，轮数改按持有者自己的回合计算。战斗状态的 `delays`(Capability API 1.120) 会扣住其持有者使用的东西：来自其 `catalogs` 之一、以其 `budget` 支付的行动，会掷一颗 `chance.sides` 面骰，达到 `chance.atLeast` 或更高时暂不发生。在持有者下个回合开始时，它会用同样的额度完成，并照原样进行，回应等一应俱全；如果持有者无法行动或没有该额度，它就会丢失。无论哪种情况，花费都已经付出。5e 的 Slow 写作 `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`。`endsAfter` 让状态在第一次 `own-attack`(持有者的下一次攻击检定)、`attacked`(针对持有者的下一次攻击检定) 或 `own-save`(持有者的下一次豁免) 之后移除，无论其计时如何，因此 `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` 表示“在其下个回合结束前的下一次攻击时”。持续一次攻击的状态会覆盖整次攻击，包括其伤害，而同一次打击新施加的状态会保留。两者都需要 Capability API 1.45。`temporary` 为生命池给予临时点数，永不叠加，只保留较大的缓冲。`scales` 按读取值所对应的表项增加额外骰子。`cost` 通过人物卡自身的 `use` 命令支付，`budget` 则覆盖其消耗的行动额度部分。

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
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
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

`sources` 指定适用的攻击列表，`requires` 指定这些行中一个求值为真的列。因此，只在特定武器上触发的附加效果可以声明哪些武器适用，而不要求 Engine 理解什么是武器。两者都不写，就表示持有者造成的任何命中。从背包中拿在手上的武器不是行，因此 `weapons`(Capability API 1.70) 还会指定它在哪些物品标签上触发：`"weapons": { "tags": ["finesse", "ranged"] }` 表示用带有其中任一标签的手持武器命中时触发，包括其副手打击。只写 `weapons` 时不在任何行上触发，只写行时不在任何手持武器上触发。`when` 满足任意一项即可：`advantage` 表示攻击检定最终的优势倾向；`ally-adjacent` 表示攻击者一名站立且能行动的盟友，在棋盘上须位于目标一格内，没有棋盘时则可在任何位置。`ally-adjacent-no-disadvantage`(Capability API 1.126) 还要求在优势与劣势抵消后，最终掷骰不处于劣势；上面的例子用它表达 Sneak Attack。`oncePer` 是 `turn`(每个人的每次回合开始时都会刷新，因此在别人行动时打出的攻击也能附加)或 `round`。`amount` 随条目自己的 `scales` 增长，`type` 是伤害类型，默认沿用打击自身的类型。

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

下面是直接用数值编写生物的方式。如果改用规则集自己的定义写成 `sheet`，就从该人物卡获取 `health`、`defense`、`initiativeModifier`、`speed`、`abilities`、`saves`、`checks`、`soak` 和 `hardness`(见下文“用规则集自身定义编写生物”)。

- `health`：数值，或在创建战斗时投一次的 `{ "dice": "3d6", "flat": 2 }`。预测读取平均值，因此菜单不会承诺尚未投出的骰子结果。
- `defense`、`initiativeModifier`、`speed`：分别为攻击检定对抗的数值、先攻所加的值（或在以骰池投先攻时，所掷的骰子数），以及按你自己的距离单位一回合能走多远。
- `abilities` 和 `saves`：以人物卡声明的属性 ID 和豁免 ID 为键。未指定的豁免读作零。
- `checks`：它在对抗中所加的值，以 `combat.checks` 的 ID 为键。未指定的读作零。Capability API 1.43。
- `soak`：仅用于 `dice-pool` 战斗，表示它吸收什么：`all` 表示任何伤害，`byKind` 表示生命轨道的某个种类。Capability API 1.47。
- `hardness`：在先攻是会被攻击改变的数字时，骰子数低于它的消耗型打击没有任何效果。Capability API 1.56。
- `speeds` 和 `hover`：它除行走之外的移动方式（见“位置”中的“其他移动方式”）。Capability API 1.113。
- `shield: true`：它的双手已被占用，因此行动的 `twoHanded` 替代方案不成立。Capability API 1.102。
- `size`：`combat.sizes` 之一，用 ID 指定，供对抗的 `maxSizeAbove` 读取（见“体型与挣脱 DC”）。Capability API 1.103。
- `type` 和 `tags`：`combat.creatureTypes.types` 之一及其最多八个 `tags`，用 ID 指定，供目标测试读取（见“生物类型与目标测试”）。Capability API 1.168。
- `resist`、`vulnerable`、`immune`：伤害类型，不区分大小写匹配；如果声明了 `combat.damageTypes`，还会据此验证。`resist` 或 `immune` 项还可以说明什么能穿透它，`{ "type": "tearing", "except": ["silver"] }`：来自带有其中某个物品标签的武器物品的打击按原样承受（Capability API 1.55，见[战斗中的武器](#weapons-in-a-fight)），`damage.qualities` 或目录条目 `mechanics.qualities` 指定了其中之一的行动也一样（Capability API 1.101）。`conditionImmunities` 指定你自己的状态，或你的 `combat.levels` 读取的轨道（Capability API 1.115）。
- `tier`：属于 `combat.threat` 的哪一档。
- `loot`(Capability API 1.63)：打赢战斗时为它掷的战利品表 ID(见上文“战利品”)。
- `traits`：展示给 Game Master 的简短名称与文本对。它们从不自动结算，因此凡是涉及数值的内容都应写入行动。
- `signaturePoints`：在自己的回合开始时补回的点数，用于支付 `signature` 行动。
- `riders`：最多四项，与目录条目的 `rider` 相同，只是写在块上。每项形如 `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`，可选 `type`，还可用 `actions` 指定它在本块哪些行动上触发。块的附加效果不读取人物卡列表，所以没有 `sources` 和 `requires` 这两个键。写成人物卡的生物则和角色一样，获得其列表携带的附加效果。
- `actions`：最多十二项，每项有自己的 `id`。行动包含手写数值块所包含的内容(`toHit`、`autoHit`、`damage`、`save`、`applies`、`targetCount`、`reach`、`range`、`area`)，以及四项生物独有内容。`reach` 是打击触及距离，`range` 是投掷或射击距离，`area` 是落点形状，全都使用你自己的距离单位。`range` 可以是普通数值，或在付出惩罚后仍能打得更远时写成 `{ "normal": 30, "long": 120 }`；`area` 为 `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }`(见“位置”)：
  - `uses`：`{ "per": "encounter" | "day", "count": n }`。耗尽后该行动离开菜单。
  - `recharge`：`{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`。开战时可用，使用后消耗；在生物自己的回合开始时投骰，达到 `from` 或更高便恢复。无论结果如何，日志都记录骰子。
  - `damage.alternatives`(Capability API 1.102)：最多四个代替其首项造成的数量，每个写作 `{ "when": ..., "dice": "1d10", "flat": 3 }`，第一个成立的生效。类型、子项和性质保持行动自身的。`"when": "twoHanded"` 在生物没有 `"shield": true` 时成立，即 5e 的“双手使用时造成 8 (1d10 + 3) 点挥砍伤害”；`"when": { "selfHealthAtMost": 0.5 }` 在其生命不超过其最大值的该比例时成立，即集群的“如果集群的生命值只剩一半或更少，则造成 5 (2d4) 点穿刺伤害”。菜单的预测和打击都按当前状态读取它。
  - `sequence`：按顺序执行同一块的其他行动，每个行动有自己的目标。**一个行动攻击两次的生物就是这样编写的。** 一次额度支付整个序列。序列不携带自己的效果，也绝不能指定另一个序列。
  - `signature`：`{ "cost": n }`，使用生物自己的点数而非行动额度支付，并且仅在别人行动时可用：战斗会在一回合与下一回合之间的窗口提供它(见“窗口”)。
  - `reaction`：与目录条目的 `mechanics.reaction` 相同的对象（见“窗口”）：该行动不出现在任何回合的菜单上，而是在它指定的时刻提供。反应不能同时是招牌行动，任何序列也不能包含反应。
  - `self: true`：它作用于生物自身而不是别人，因此不带 `targetCount` 或 `area`。两者都需要 Capability API 1.46。Parry 就同时使用这两者，并带有一个让防御加 2 的 `parrying` 状态：

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```

- 豁免需要在行动本身指定难度：行动强制的豁免使用 `save.difficulty`；若行动没有自己的豁免，而状态在豁免成功时结束，则使用 `saveDifficulty`。即使生物有人物卡，块行动仍使用直接数值编写，所以该数值放在行动上。子项自己的豁免可以省略 `difficulty`，回退到同一个数值。
- `damage.plus` 与目录条目的 `plus` 是同一种子项列表，读取方式完全相同：`"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` 表示带热量的啃咬，热量有独立数值，独立受到抗性影响，也独立翻倍。

生物行动可以用 `heal`(骰子、固定数量或两者) 恢复生命值，以目标的最大值为上限。`targets: "ally"` 作用于自己一方，包括它自己；`targets: "any"` 作用于任意一方。没有 `targets` 时，与以前一样作用于另一方。这些键需要 Capability API 1.121。治疗不带 `damage`、`toHit`、`save` 或 `area`；`targets` 不接受 `self` 或 `sequence`，序列也不带这两个键。deva 的 Healing Touch 写作：

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

生物的 `spellcasting`(Capability API 1.123) 施放目录法术，不消耗法术位或点数。其 `saveDifficulty` 和 `toHit` 提供法术的数值；带 `sheet` 的生物可以省略它们，使用其人物卡的施法数值。普通生物必须提供其法术所需的每个数值。每个 `entry` 指定一个带 `mechanics` 的已有目录条目。省略 `uses` 表示随意施放；`level` 是用于 `perCostStep` 缩放的施法等级，省略时为条目的基础等级。条目仍提供其额度、目标、专注、反应、范围和召唤物。dryad 的列表可以这样写；这些法术 ID 仅作示例，必须在 `spells` 目录中提供：

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

对于 hag coven，在 `spells` 旁加上 `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }`，并在每个共享法术上写 `"coven": true`。只有当施法者一方至少有三个站着的参战者带有该 coven ID，且每个都按普通格子距离在施法者 30 个规则集距离单位之内时，才会提供这些法术。没有棋盘时，所有站着的成员都计入。每个法术的使用次数是整个 coven 共享的一个池，以 coven ID 和条目为键。coven 块需要一个 coven 法术，coven 法术也需要该块；重复的项会被拒绝。Game Master 提议的生物在被限幅时会失去 `spellcasting`，因为威胁尺度无法约束法术列表。

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
- **每个数值只有一个来源。** 带人物卡的生物不能再提供 `health`、`defense`、`initiativeModifier`、`speed`、`abilities`、`saves` 或 `checks`，否则 Engine 拒绝文件。它可以没有自己的 `actions`，因为它的列表决定它能做什么。没有人物卡的生物仍须提供前三项和至少一个行动。
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
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
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

**其他移动方式**（Capability API 1.113）。生物的 `speeds` 给出它除行走之外的移动方式，`{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }`，使用你的单位；`"hover": true` 表示飞行者无须移动即可停留在空中（需要 `fly` 速度）。队伍成员的这些速度通过 `economy.movementModes` 从人物卡读取，它是以同样方式定键的值引用，就像种族的游泳速度或法术的飞行速度；零表示不能以该方式移动。`speed` 和 `economy.movement` 仍表示行走。在棋盘上：

- 移动额度取其最快的移动方式，每移动一格都会同时从所有方式中扣除，因此行走 30、飞行 60 的生物可以先走 10 再飞 40，且永远不会走超过 30；
- 飞行者以一格的费用踏入任何非实体的格子，包括水和任何高度的台阶；
- 游泳者以一格的费用穿过水，在陆地上则行走；
- 攀爬者以所踏上地面的费用迈上任何高度的台阶；
- 掘穴者的速度会传达给 Game Master，但按行走移动，因为棋盘上没有可以挖掘穿过的地面。

每一步都以剩余额度足够的最便宜方式进行。没有棋盘的战斗不读取这些，只会行走的人移动方式与以前完全相同。

**飞行高度**（Capability API 1.114）。在规则集给出 `combat.elevation.levelHeight` 和 `combat.distance.perCell` 的棋盘上，飞行者会在其所在位置获得 Fly up 和 Fly down 选项，每次花费相当于一层高度的飞行距离（5 英尺的格子上一层 5 英尺就是一格）。最多可以升到其下方地面之上 20 层。在空中时：

- 它只能飞行，每步一格，飞越任何非实体的东西；
- 它与其他任何人之间的距离，取水平距离和两者之间高度差中较大的那个，因此触及 5 英尺的剑碰不到 30 英尺高处的龙，龙自己的啮咬也碰不到骑士；
- 它对任何更低的人都占据高地，就像山丘给予的那样；
- 离开因高度太高而够不到它之人的触及范围，不会引发打击；
- 被击倒、被撞倒在地或被限制到零速度时，它会按 `falling` 的规定坠落到下方地面，除非它有 `hover`。

飞到与其高度相同或更高的地面上就会降落，就像地面上的飞行者飞上悬崖一样。没有新键：1.114 之前的 Engine 会让飞行者留在地面上，因此依赖高度的包要声明 1.114。

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

条目 `mechanics.area` 或生物行动 `area` 上的直线可以带 `width`，单位与 `size` 相同，取整到格数，最少一格（Capability API 1.128），例如 `{ "shape": "line", "size": 60, "width": 10 }` 表示 60 英尺长、10 英尺宽的直线；省略时为一格，偶数格宽会把多出的那一列放在施法者左侧。

**视线与掩护。** 以两者之间的直线格子判断：其上的墙或山会阻挡射击并阻止范围扩散到其后，目标也就不会出现在菜单上。水不遮挡视线：射击可以越过河流，直线范围也会延伸过去。Engine 自己的战斗使用同样的视线测试。

掩护按攻击者所站的位置读取，采用 DMG 可选网格规则的角线方法：从攻击者最有利的一角，向目标所在格的每一角各引一条线。三条或四条线穿过墙或山为四分之三掩护；任何一条线穿过墙或山，或穿过有掩护价值的地面（树林、废墟），为半掩护；只有低矮地面时最多为半掩护。攻击者完全看不见的目标拥有全掩护，不会出现在菜单上。面对攻击时，站在有掩护价值的地面上的目标至少有半掩护，一如既往；豁免只会得到位于它与效果之间的东西的帮助。

- `cover.bonus` 是半掩护给攻击所对抗的防御增加的数值，日志会说明。
- `cover.threeQuarters`(Capability API 1.74) 是四分之三掩护增加的数值；没有它时，`bonus` 两者通用。
- `cover.saves`(1.74) 指定掩护也会帮助的豁免，针对行动自身的豁免（从不针对结束状态或维持专注的豁免）：爆发从其落点算起，其他东西从其施放者算起。日志也会说明。
- `cover.creatures`(1.74) 让挡在中间的任何人都提供半掩护，不论敌友。
- 文字说明目标无法从掩护获益的豁免（5e 的 Sacred Flame）写 `"ignoresCover": true`(1.74)，写在条目的 `mechanics.save`、生物行动的 `save` 或物品使用的 `save` 上。

**高度。** 棋盘可以有高度，最多三层，无论规则集怎么说，每场有位置的战斗都按它行走和判断视线：爬上一层多花一格，下来不花费任何东西，两层或更高的台阶是没有人能走上去的悬崖（也没有人会被推上去），比两端都高的地面会阻挡视线。从更高处向下射击时，中间的低矮掩护遮挡不了任何东西。规则集用 `elevation` 说明其系统额外增加的内容（Capability API 1.75，需要 `distance`）：

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` 是一层有多高，以规则集自身的距离单位计。
- `highGround` 是从更高处向下打击给攻击掷骰的好处：`"advantage"`，或 `{ "bonus": n }`(从攻击所对抗的防御中扣除)。省略时不给任何好处。
- `rangeBonus` 是从更高处射击时射程多出的格数。
- `falling` 是坠落的作用：被从两层或更高的台阶上推下的人落到下方，每 `per` 的落差（层数乘以 `levelHeight`）受到 `dice`，最多 `max` 颗骰子，伤害类型为 `type`，之后如有 `prone` 状态则受到该状态。骰子按系统掷伤害的方式掷出：相加，或在 `dice-pool` 下计为成功并扣除吸收。坠落和其他打击一样，因此可能让人倒下或打断其专注。日志会说明他们落了多远。没有 `falling` 时，坠落只会被记录，不产生任何作用。

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

战斗画面使用你的措辞。菜单包含你的攻击、能力、对抗和列出的标准行动，每项说明从你的行动额度和池中消耗什么。行动顺序、轮次、你命名的每种状态及剩余轮数、临时点数、专注，以及濒死规则的两项计数都会显示。日志按你的术语打印真实算式："Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." 每个接受的行动都会立即写入人物卡，因此中途重新加载也精确无误，之后还会告知 Game Master 不要再次修改这些数值。

有位置的战斗绘制在棋盘上，而非立绘舞台上；玩家如何操作见“位置”。棋盘、菜单和日志中的每个距离都使用你的单位："Juno moves to 4, 6 for 6 paces and has 2 paces left."

### 对抗：擒抱、推撞、挣脱

有些动作不是对抗防御的攻击，而是一场对抗：双方都掷骰，结果更好的一方如愿以偿。擒抱某人、把对方推倒或推开，以及挣脱，都是同一种形状，因此规则集把它们都写成数据：

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** 是对抗读取的数字，每个都是人物卡上的值，像防御或豁免一样在战斗开始时读取一次。以直接数值编写的生物给出自己的值（`"checks": { "brawn": 2 }`）；带人物卡的生物从人物卡读取。最多十二个。
- **掷骰。** 双方都掷你的 `attackRoll.dice`，并加上此处可用检定中最好的一个（`attacker.checks`、`defender.checks`）。总数较高者获胜；平局时防守方获胜，除非 `ties` 写为 `"attacker"`。日志会写出双方：“Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins.”
- **获胜**时执行 `onWin` 所规定的内容，至少一项：
  - `applies` 以获胜者为来源，对失败者施加状态，因此标为 `endsWhenSourceDown` 的状态会在抓住对方的人倒下时结束。`rounds` 为状态设定计时；没有它时，持续到被某种东西结束。
  - `ends` 移除行动者或目标身上的状态。
  - `push` 将失败者沿远离获胜者的方向直线推开，距离按你的距离单位计，在碰到任何实体障碍、任何站着的人、棋盘边缘或窄得挤不过去的角落前停下。这是强制移动：不消耗其任何移动额度，也没有人会借机打击它。没有棋盘的战斗不会移动任何人。
    失败没有任何效果，失败的擒抱就是这样。
- **`from: { "holding": "held" }`** 让对抗只瞄准对行动者施加该状态的人，并且只在该状态持续时才出现在菜单上：挣脱就是这样表达的。
- **`reach`** 以你的距离单位表示它能触及多远；省略时为相邻格。`reach` 和 `push` 需要 `combat.distance`。
- **`strike: true`** 让它在一个行动买到多次打击时，像攻击一样占用其中一次：先选它时，消耗额度并把其余打击留在手中；手中已有打击时选它，则消耗其中一次。5e 参考规则集的擒抱和推撞就是这样做的。
- **在菜单上**，对抗有自己的分组，并显示获胜几率。Engine 扮演的对手会像评估其他选项一样评估对抗，但比较保守：擒抱或推撞是为后续做铺垫，挣脱价值最高，但只在被抓住时才有意义。扮演对手的 Game Master 从同一菜单中选择。
- Game Master 自创的对手，其检定与命中几率一样受其档位约束。

对抗对打包规则集要求 Capability API 1.43。

<a id="windows-holding-the-fight-open"></a>

### 窗口：让战斗等待

有些时刻属于当前行动者之外的人。Engine 会为其保留战斗、等待选择，而不是代为决定；这段暂停就是窗口。

七种情况会打开窗口，其中两种来自你已经声明的内容：

- **有人脱离。** 行走离开可以攻击的敌人触及范围时，在那一步停下并询问敌人。见上文“打击走开的人”。
- **一回合与下一回合之间。** 回合结束后、下一回合开始前，会询问所有持有 `signaturePoints` 且能负担自身某个 `signature` 行动的敌人是否购买一次。这是唯一能购买的时刻：招牌行动不在任何人的回合菜单里，包括它自己的菜单。
- **有人使用某样东西。** 在结算前，会询问对方阵营中所有持有等待此刻条目的人，不论它指向谁，只要该条目能触及使用者。标准行动和对抗不会打开这一时刻。
- **某个效果指向某人。** 在结算前，会询问被指向的对方阵营中，所有持有等待此刻条目的人。友军治疗你并不是需要应对的威胁，因此友军行动不会打开窗口。
- **攻击检定命中某人。** 在造成伤害之前，如果被命中者持有等待此刻的条目，就会询问他们。他们选择的内容对这次攻击生效：见下文“命中之后的时刻”。
- **某个效果伤害了某人。** 结算后，无论是谁造成的，都会询问所有受伤且持有等待此刻条目的人。受伤是发生在你身上的事实；但反指向伤害来源的条目仍不能指向友军。
- **有人坠落。** 在伤害和倒地之前，询问持有能触及坠落者、且允许其所在一方的反应的人（Capability API 1.124）。

- **有人开始其回合。** 在他们行动之前，询问持有能以其目标一方触及他们的条目的人（Capability API 1.131）。

最后六种情况由目录条目或生物自身的行动通过指定所等待的时刻来请求。一个行动同时打开 `used` 和 `aimed` 时，先询问使用；如果没有人取消它，再询问它所指向的人，两者都答复后才结算。被命中在每次掷骰命中时询问，受伤则在整个行动结束后询问。

无论由什么打开，窗口都会这样运作：

- **窗口打开期间，其他任何内容都不推进。** 当前回合的行动者、回合结束、其他窗口都不能推进。战斗等待。坠落会在引起它的行动步骤完成之前暂缓落地；更多的坠落在之后才询问。
- **按行动顺序逐个询问，每人只问一次。** 放弃始终是有效答复，不收费用。如果轮到的人没有可用选择，就直接跳过，不再询问。
- **从暂停处精确恢复。** 行走继续完成剩余格子，并支付实际经过的每一格。
- **谁操控，谁回答。** 自己队友的窗口由你回答，菜单中选项旁会有 Pass；敌人由其操作者回答，Game Master 的首领通过 Game Master 回答，放过这个时机也是可选答复之一。
- **随战斗保存。** 行走中关闭游戏，回来后仍是相同的人等待询问、相同的格子等待行走。

前两种不需要额外声明：带 `opportunity.budget` 的规则集获得其中一种，带 `signaturePoints` 的图鉴获得另一种；两者都没有的规则集从不会看到它们。

**声明条目等待哪个时刻。** 将 `mechanics.reaction` 写成对象，而非 `true`：

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` 为 `used`、`aimed`、`hit`、`harmed`、`falls` 或 `turn-start`，决定将条目放入哪个窗口菜单。Engine 只监听这六个时刻。仍然只写 `"reaction": true` 的条目，仅表示不在回合内执行，不足以将它放入任何位置，所以仍不上任何菜单。
- `at` 为 `source`(默认)、`target` 或 `chosen`。`source` 将执行内容指向引发该时刻的人，并填入目标，无须任何人再选；`chosen` 则保留条目自己的目标设置并询问。`target` 指向该时刻所涉及的生物。`falls` 的回应作用于其所选的坠落者。
- `cancels` 阻止窗口保留的事情发生。只有 `used` 或 `aimed` 条目能指定它：已经发生的时刻不能撤销，而命中时攻击检定已经掷出。
- `against` 把条目回应的范围收窄到使用自特定目录的东西：`"against": { "catalogs": ["spells"] }` 只回应法术，别无其他。背后没有条目的行动（列表上的武器、生物自身的行动）不来自任何目录，因此永远不会为指定了目录的条目打开这一时刻。省略 `against` 时，条目回应任何东西。

也请指定 `budget`，否则消耗列表默认额度。反应几乎总是使用自己的额度，这正是阻止一个回合内使用多次的机制。

**询问任何人之前，费用就已经支付。** 取消行动阻止的是事情发生，不是撤销购买：额度和池已经消耗。如果你的系统会退款，目前还无法表达。

反制这样写，在棋盘上它只回应处于其自身 `range` 之内的人：

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**只能反制到一定等级的反制**（Capability API 1.116）。在会取消的 `used` 反应上写 `"upTo": "paid"`，只阻止支付等级不高于回应本身支付等级的东西；`"above": { "check": <value>, "dc": 10 }` 则是仍能阻止更高等级之物的检定，对抗 `dc` 加上其等级。5e 的 Counterspell 会阻止其法术位等级或更低等级的法术，对更高等级的法术则要求一次对抗 10 + 法术等级的施法属性检定，并且像任何法术一样可以升环施放：

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

任何被支付之物的等级，就是它所来自的池的等级：池在指定了自己的 `level`(一个从其持有者人物卡读取的值) 时就用它（5e 的契约法术位，以邪术师的法术位等级施放），否则用它在其组中的位置，第一个池为 1。没有花费的东西，或来自不属于任何组的池的东西，等级为 0，因此每个这样的反制都能阻止它。该检定使用战斗自己的骰子，以及回应者对检定的状态；`dice-pool` 战斗没有要达到的 DC，因此拒绝 `above`。没有人物卡的生物把它的检定写作 `{ "const": n }`。每当回应超出自身等级时，日志会说明等级和掷骰，阻止成功时会照常写出那一行。没有 `above` 时，更高等级的东西就不会被阻止，而回应的花费仍然付出。

**命中之后的时刻。** `hit` 上的条目用于表达 Shield、Parry 和 Uncanny Dodge。攻击在掷骰之后暂停，在造成任何伤害之前询问被命中者。他们选择的内容对这次攻击生效：不会重新掷骰，而是按其当前的防御重新判定，因此增加防御的状态可以把命中变成未命中，而总是命中的自然点数仍然命中。作为回应施加、持续一次攻击的状态（`endsAfter: "attacked"`）覆盖这次攻击，包括其伤害，并随这次攻击用掉；“这次攻击的伤害减半”就是这样表达的：作用于一次攻击的 `resist-all`。

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

攻击从暂停处精确继续：剩余的目标，以及对由其他行动组成的生物行动而言，剩余的部分。每次命中持有此类回应者的掷骰都会依次暂停，窗口打开期间保存的战斗也会以相同方式恢复。在窗口内进行的攻击（打击走开的人、招牌行动、回应）从不暂停，因为窗口内打开的任何东西都不会再开另一个窗口。窗口打开时，日志会显示掷骰结果及其对抗的数值；如果回应改变了防御，还会显示现在是否未命中。Engine 扮演的对手只在防护能把命中变成未命中时才会使用它。

指定时刻的包需要 Capability API 1.33，使用 `used` 或 `against` 的包需要 1.44。等待 `hit` 的包需要 1.46。

**按名称回应某个法术**（Capability API 1.117）。`against` 可以在 `catalogs` 旁以 `<catalog>/<entry>` 指定 `entries`，两者任一匹配都会打开该时刻。`also` 在最多三个额外时刻采用同一个回应，每个都有自己的 `against`。状态的 `noDamageFrom` 在其生效期间让这些条目的伤害完全不作用于其持有者，无论是哪种伤害。5e 的 Shield 在攻击命中时，以及 Magic Missile 瞄准其施法者时采用，在它之下 Magic Missile 不产生任何作用：

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

只有第一个时刻可以取消，因此会取消的反应没有 `also`。条目所指定的目录必须是规则集拥有的。不在其中的条目永远不会打开该时刻。以这种方式挡下的打击在日志中显示为目标免疫的打击。

**只回应某些打击**（Capability API 1.118）。`hit` 时刻可以写 `"blow": "melee"` 或 `"blow": "ranged"`。目标站在武器触及范围内时，打击算近战，因此从远处投出的匕首是远程，在目标旁边使用的同一把匕首是近战。有触及而无射程的武器总是近战，有射程而无触及的武器总是远程。在没有棋盘的战斗中，有触及的武器视为在手中挥击。`"seesSource": true` 可用于除 `falls` 之外的任何时刻，只在其持有者看得见引发者时才打开它。这意味着棋盘上两者之间有视线（没有棋盘时所有人都能看见所有人），并且永远不包括采取了 Hide 标准行动、在其下个回合开始失效之前的人。5e 的 Parry 两者都用：

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

两个键也都可以写在 `also` 中的时刻上，而 `blow` 只能写在 `hit` 时刻上。

**接住坠落**（Capability API 1.124）。`falls` 上的反应（包括在 `also` 中）会在坠落造成伤害或使其倒地之前，回应从边缘坠落的生物或被迫落地的飞行者。其射程和目标一方会对照坠落者检查，回应作用于该生物。对于 Feather Fall，给条目这些 mechanics，并在人物卡的实时状态中声明 `feather_falling`：

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

其 `combat.conditions` 项为 `{ "condition": "feather_falling", "fallsSafely": true }`。在生效期间，该状态会阻止坠落伤害以及坠落会施加的倒地状态；它不会移除导致坠落的状态。只回应施法者自己坠落时，请使用 `targets: "self"`。坠落没有来源条目，因此其反应不能带 `cancels`、`blow`、`seesSource` 或 `against`。单目标条目会分别询问每次坠落。这处理的是落地；不会追踪减缓的下降过程。

**为另一个生物回应**（Capability API 1.131）。`for` 默认为 `self`；`ally` 排除持有者，`any` 则包括持有者。两者都会询问目标一方、在所需 `within`(以目录的距离单位计) 之内的持有者，且只在 `aimed` 或 `hit` 时询问。这些键也适用于每个 `also` 时刻。`seesSource` 仍要求能看见攻击者。Protection 在攻击骰掷出之前对来源施加 `own-attacks-disadvantage`。其 `this-action` 持续时间在该行动结算或被取消时结束。没有明确的来源射程时，旁观者的回应能触及该来源；`within` 测量的是到被保护生物的距离。在人物卡上声明 `protected_attack`，并给其战斗状态该效果：

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**把回应施加在目标身上。** `at: "target"` 作用于被攻击的生物，而 `source` 仍是攻击者。Shield Guardian 把护身符佩戴者表示为 5 以内的盟友；`parrying` 给予 `+2` 防御。被暂停的命中会在回应之后重新检查该盟友的防御：

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**在回合开始时。** `on: "turn-start"` 在条目目标一方的生物于其射程内开始回合时、在该生物行动之前询问。该生物就是 `source`。有害条目回应另一方，有益条目回应自己一方。它不能带 `cancels`、`blow`、`against` 或 `upTo`。Unnerving Mask 生物行动要求一次 Wisdom 豁免；受影响生物计时上的一轮持续整个当前回合，并在其结束时失效（不要写 `of: "source"`）：

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**以豁免取消。** `cancelSave: { save, dc }` 需要 `cancels`；持有者以其通常的豁免调整值掷骰。成功则取消，失败则让原来的行动结算，无论哪种都会消耗反应。`against.actions` 指定一到十二个数值块行动，不区分大小写匹配完整名称（每个最多 80 个字符）。Rock Catching 把接住岩石表示为取消整次攻击（包括其全部伤害），而不是只取消其钝击伤害。豁免 ID 是你的规则集中的 ID(这里是 `dex`；随附的 5e 示例中是 `dex_save`)：

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**接住多个坠落者。** `targetCount` 大于一的 `falls` 条目，会提供因同一次打击或效果而坠落、在射程内且位于其目标一方的符合条件的生物。菜单和调度器默认选择所有符合条件者直到数量上限，由近及远；玩家可以更改选择。之后的坠落是单独的事件。Feather Fall 使用与上文相同的 `fallsSafely` 状态：

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### 尚未支持

在此明确列出，因为规则集不应声称 Engine 会做尚未支持的事：

- **超出简易棋盘的内容**：没有飞越障碍、挤过狭处和坐骑。生物只会因自身的行走、传送以及推动它的东西（对抗、条目、生物行动或区域）而移动。没有人会拖着自己抓住的生物走。
- **对抗很简单。** 其掷骰不会打开窗口，但它引起的坠落可以被回应。
- **条目只能等待六个时刻**：`used`、`aimed`、`hit`、`harmed`、`falls` 和 `turn-start`(见上文“窗口”)。这是 Engine 为条目感知的时刻；另外两种窗口，即有人脱离和两回合之间的暂停，由战斗本身打开，并不是条目可以请求的时刻。没有豁免投骰或死亡时刻。
- **不会连锁。** 战斗保留一个窗口，而非窗口栈，因此窗口内发生的事情不会再开另一个窗口：反制不能再被反制，反应造成的效果不会打开后续时刻，窗口内进行的攻击命中时也不会暂停。窗口期间引起的可回应坠落会暂缓到窗口关闭，然后依次询问。
- **只有攻击检定才算命中。** 不经攻击检定就生效的东西（直接命中的飞镖、所有人都要豁免的范围效果）不会打开 `hit` 时刻。
- **伤害调整值属于攻击命中。** 回应可以在其持有者身上施加伤害调整值，或用 `resist-all` 让受到的伤害减半；伤害调整值从不改变只有豁免的效果。
- **没有退款。** 被取消行动的费用已经消耗。
- **状态能改变的内容是封闭列表。** 防御、攻击检定、豁免、对抗检定、速度、生命最大值、造成的伤害和受到的伤害（等级和物品效果也是如此）。伤害调整值只改变攻击命中；它们从不增加基于豁免的伤害或自动命中。
- **直接用数值编写的生物没有伤势轨道。** 即使规则集用轨道表示生命，这类生物仍然扣点数；给它 `sheet` 后，受到的打击才会先应用自身 `resist`、`vulnerable` 和 `immune`，再标记格子。
- **附加效果自行触发。** `on` 只有 `hit` 一个值，因此周期内第一次符合条件的命中就使用它，不存在询问是否消耗的时刻。
- **会被攻击改变的数字很简单。** 消耗型打击只掷这个数字，别无其他，因此任何武器都不会改变它，包括武器的 `floor`(结实的目标会吸收夺取型打击，其硬度会挡住消耗型打击，但除此之外没有东西能削减这两者)；无论跌得多深，崩溃都在固定回合数后解除；在窗口中进行的攻击（打击脱离的人、反应、招牌动作）都按第一种方式进行。
- **自创的对手不吸收伤害，也没有硬度。** Game Master 为一场战斗临时创造的生物受你的威胁尺度约束，而威胁尺度不涉及吸收或硬度，因此它两者都没有。

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
- `currencies` 移除钱币：`removeUnits` 指定单种钱币，`removeFamilies` 指定整个体系。体系中最小的钱币只能随整个体系一起移除，因此剩下的每个体系都仍能付款和找零。该层开启期间，没有人会收到、用来支付、选取或掉落被移除的钱币，钱袋那一行也不显示它。以它标出的价格，会按相同价值改用剩下的、能正好付清的最大钱币表示：Gravewatch 的 long night 层移除了 crown，因此标价 3 crowns 的守夜手枪要 15 shillings。整个体系都被移除的物品没有价格。

**层不能做什么。** 不能添加枚举值、字段、技能、池或休息，不能改变结算类型、触及实时状态或战斗数值，也不能增加模型调用。层所_添加_的值，对人物卡的其他读取者都会是未知值，因此只能移除值。超出这份列表的内容，应当修改规则集本身，或成为第二个规则集。

**冲突。** `conflicts` 指定不能同时开启的层。只在成对关系的一侧声明就够了。向导会禁用另一个开关；如果保存的选择不知为何包含两者，就丢弃声明**较晚**的那个，因此相同的两个选择总会得到相同规则。

**已经持有被移除值的人物卡会保留它。** 不会重写角色。编辑器只是停止提供该值，而已经拥有它的角色仍按原值显示。在新游戏中关闭该层后，该值又能选择。隐藏的目录条目也一样：只从选择器中排除，玩家已经选择的行仍留在人物卡上。层所移除、但已有人携带的钱币，仍留在其背包里。

**限制。** 每个规则集最多 12 个层，每层两段指引字符串合计最多 4000 字符。声明 `layers` 或基础 `gm.worldGuidance` 的打包规则集需要 Capability API 1.25，层会移除钱币的规则集需要 1.64。导入的规则集由读取它的 Engine 验证，因此不需要这项声明。

**其他人编写的层**(例如为不是自己编写的规则集提供独立文件的 Low Magic 层)会在以后添加。目前层随其所属规则集一起提供。

<a id="trying-your-ruleset"></a>

## 试用你的规则集

社区规则集使用与导入智能体相同的开关。打开 **Settings**(设置) > **Advanced**(高级) > **Danger Zone**(危险区域)，确认 **Allow custom Agent imports**(允许导入自定义智能体) 已开启。导入还需要 localhost 访问，或已配置的 **Admin Access**(管理员访问)。

1. 打开 **Agents**(智能体) 面板，选择 **Import agents**(导入智能体) 按钮，即面板顶部按钮行中的下载图标。
2. 选择 **Game Mode ruleset**(Game Mode 规则集)，再选择 JSON 文件，或以 `.ruleset.json` 结尾的规则集包文件（见[分享你的规则集](#sharing-your-ruleset)）。
3. 阅读审核信息，其中包含名称、版本、许可证、规则集覆盖范围，以及 Game Master 文本。选择 **Import**(导入)。

规则集会出现在面板的 **Rules**(规则) 区域，以及新游戏设置向导的 **Rules** 选项中。文件导入的规则集归为 `local/<your id>`，因此绝不会与官方规则集或别人的规则集混淆。

### 修改已导入的规则集

已经导入的版本永不重写。如果更改文件后仍以相同 `version` 再次导入，会被拒绝，并要求提高版本号。这是有意设计的：游戏绑定创建时的精确版本，因此进行中的战役不会突然使用不同的计算方式。

所以起草时的循环是：编辑、提高 `version`、导入、开始新游戏。旧版本会与新版本并列安装，直到你从 **Rules** 区域移除规则集。移除仍被游戏使用的规则集后，该游戏会提示规则集缺失，直到再次导入。

如果改变了人物卡结构(添加、删除或重命名内容)，也请提高 `sheet.version`。现有人物卡会宽容读取：新人物卡不认识的值会保留，缺少的值使用默认值。

### 把值移到新 ID：`sheet.migrations`

添加内容不需要任何额外操作。当新布局把某个值移到别处时（重命名的字段、变为每个职业一个等级的单一等级、变为每种骰子一个池的单一生命骰池），请在 `sheet.migrations`(Capability API 1.77) 中说明如何移动，让每个按旧布局创建的角色都保留其数值：在角色库中、在游戏中、在旧存档、分支和检查点中，以及在导入的角色卡中。

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- 每一项把已保存的人物卡从版本 `from` 迁移到 `from + 1`，并按顺序对每张保存于该版本或更早版本的人物卡运行。一旦发布就绝不要删除某一项：很久以前保存的人物卡仍然需要它。只做添加的版本不需要迁移项。
- `rename`(`ability`、`skill`、`save` 或 `field`)：值被复制到其新 ID。技能或豁免会带上其加值。重命名可以延续更早一项的重命名，或为之后的 `route` 转送的字段提供值；导入会沿着链条一直追踪到终点。
- `route`：一个字段的值转到另一个字段的文本所指名的字段。当某个分支的词语作为完整单词出现在 `by` 的文本中（只有字母才连成单词，因此“Fighter3”指的是 fighter）、不区分大小写，且恰好只有一个分支符合时，该分支生效。没有分支符合，或有多个分支符合（“Fighter 3 / Wizard 2”，一个数字不经询问无法拆分给两者），值就转到 `else`。`default` 代替从未保存过该值的人物卡。`by` 是人物卡拥有的字段，或更早布局中被重命名掉的字段。目标是没有默认值、或默认值为 0 或空的数字或文本字段：值会落到其中一个，其他每个都保留其默认值，因此任何其他默认值都会被读成一个没人给过的等级。之后的重命名移走的目标会被追踪到那里。
- `routeLive`(实时状态的 `pool` 或 `track`)：保存的值转到迁移后的人物卡所显示的那个 `cases`(最大值大于 0 的池，或人物卡没有隐藏的轨道)，否则转到 `else`。值所转到的轨道要么全是伤势轨道（它携带标记），要么全是普通轨道（它携带数字）。
- 每个构建步骤都是复制：旧值仍留在原处，因此旧版本的规则集仍能像以前一样读取人物卡。步骤从不覆盖目标中已有的值。
- 导入会拒绝版本等于或高于 `sheet.version` 的项、来自同一版本的两项、写入人物卡没有的 ID 的步骤、列出两次的分支，以及从人物卡仍拥有的 ID 读取的 `rename` 或 `routeLive`(被移走的 ID 永远不会再被使用，这正是这些步骤可以安全重复运行的原因)。
- 人物卡在每次被读取时迁移，新布局在下一次编辑时保存。实时状态没有自己的版本，因此 `routeLive` 在每次读取时都运行：旧键会被丢弃，其值只在新键尚不存在时才移动，因此之后花掉或通过休息恢复的值永远不会被覆盖。值去了哪里，由更新后的第一次写入决定：之后被修正的人物卡（手动移动的职业等级）不会让它再次移动。新版本到来时已经在进行的战斗仍会照旧结束。

<a id="sharing-your-ruleset"></a>

## 分享你的规则集

**作为文件。** 将 JSON 文件发给朋友，对方按相同方式导入即可。

**作为包文件。** 太大而无法放进一个文件、目录存于各自文件中的规则集，以一个名为 `<name>.ruleset.json` 的普通 JSON 文件流转。它包含包清单和规则集的各个文档，每个都以其精确字节的 base64 形式保存：

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

清单在 `contributions.assets.paths` 和 `files` 中列出 `ruleset.json` 和每个 `catalogs/<id>.json`，并附上各自的大小和 sha256。Pixelforge 等规则集编辑器可以生成这样的文件。**Import agents** → **Game Mode ruleset** 接受该文件，并显示与规则集文件相同的审核内容，包括每个目录及其条目数。其中没有任何内容是压缩的，因此它包含的内容绝不会超过其自身大小。它作为数据读取，从不作为包安装：如果它包含其他任何东西（其他键、其他任何文件、不是严格 base64 或不是 UTF-8 文本的文档），如果其清单超出规则集所需（任何代码、权限或其他贡献），如果某个文件不是清单所列的那个，如果某个 `$comment` 超过 2,000 个字符，或 `$schema` 指向 Engine 自身结构以外的任何东西，或者规则集或某个目录无法读取，它都会被拒绝并说明原因。它像规则集文件一样归为 `local/<its id>`，最大 24 MB，最多 12 个目录文件，每个 2 MB。一个版本就是其规则集与目录的整体，因此目录发生变化也需要提高 `version`。规则集包不接受 zip 格式。

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
