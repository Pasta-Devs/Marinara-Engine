# 规则集检定

本页是[编写 Game Mode 规则集](writing-rulesets.md)的一部分。规则集如何掷出检定或豁免：五种结算类型、结果档、以自己的方式掷骰的检定，以及能改变掷骰的资源消费或护符。

<a id="resolution-kinds"></a>

## 结算类型

`resolution.kind` 选择检定如何掷骰。每种类型都读取相同人物卡，共享三个键，因此切换时 `resolution` 以下的文件部分不用改变：

- `abilityModifier`：人物卡分值如何变成一个数字。`identity` 表示直接使用分值；`floorHalfMinusTen` 是 5e 规则；`stepTable` 允许用 `[[score, number], ...]` 列出自己的阈值。
- `proficiencyTiers`：技能或豁免的训练等级。未列出的技能使用第一档。每档增加 `flat`、熟练加值的 `multiplier` 倍或两者都有。如果系统有熟练加值，用 `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }` 指定来源。
- `proficiency`：可选，仅乘算档位需要。

结果数字的含义由类型决定：`dice-sum` 把它加到掷骰上，`dice-pool` 和 `dice-highest` 掷出相应数量的骰子。`symbol-pool` 把属性和训练分开，用来组建并升级叙事骰。

### `dice-sum`：将骰子求和

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

### `dice-pool`：掷骰并计数

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

### Game Master 可以在骰池检定中写什么

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

### `dice-highest`：掷骰并读取最高的一颗

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

### `roll-against`：掷出不超过（或不低于）人物卡数值的结果

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

### `symbol-pool`：掷叙事骰并读取符号

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
- `outcomes` 可以读取净成功数（`total`），或 `net successes - needed + 1`(`margin`)。结果档仍按通常方式决定成败；原本的大成功和大失败符号仍会被标记。`spend` 只能在 `pool.max` 之内购买额外的基础角色骰。它的战斗使用 `symbol-pool` 类型（Capability API 1.382，见[以符号骰进行的战斗](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool)）；不能搭配任何其他战斗类型。
- 检定之外，使用这个规则集的游戏也可以按名称掷骰：消息输入栏的自定义骰子输入框和 Game Master 的 `roll_dice` 工具都接受 `2 ability 1 proficiency vs 2 difficulty`(每颗骰子的 `id` 或 `label`，不区分大小写)，并像检定一样计数和抵消符号，但不使用人物卡、升级或难度梯度。无需设置任何键来启用。
- 记录保留 `resolution="sum"`，并带有 `symbols="2s 1a 1t"`、标识每颗骰子的 `thrown=`，以及保存其从 1 开始的骰面序号的 `rolls=`。编码后的 `symbolDetails` 保留标签、骰面符号以及大成功和大失败两种标记。`setback` 记录在共用挫折骰上限之后实际加入的独立挫折骰，`upgradeOwn` 记录实际应用的额外升级；被忽略或为零的增量不记录。骰子卡和摘要会写出净符号（包括空结果），而不是把骰面数字相加。覆盖可以改变这一类型的规则，但不能替换 `symbols` 或 `dice`。

### 范围之外的机制及原因

以下机制仍需要各自的结算类型：

- **对抗骰池**同时结算两个角色，而一次检定只有一个掷骰者。
- **带狂野骰的求和骰池**(如 OpenD6) 将骰子相加并特殊处理其中一颗。

该类型过去遗漏的另外两项现在都已建模，下方“消费资源改变掷骰”说明其方式。系统自身的规则，如“花一点换一次成功”或“花一点把失败的骰子再掷一次”，是 `resolution.spend`。情境需要时系统免费给予的重掷，是上文的 `resolution.reroll`。属于角色实际选取内容的重掷，则是目录条目的 `mechanics.check`，用该条目自己的成本购买。

## 结果档：不只是成功或失败

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

## 以自己的方式掷骰的检定

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

## 消费资源改变掷骰

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

## 改变掷骰的护符

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
