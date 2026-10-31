# 规则集战斗

本页是[编写 Game Mode 规则集](writing-rulesets.md)的一部分。规则集如何参与战斗：`battle` 块将人物卡提供给 Marinara 的战斗系统，`combat` 块则按规则集自身的规则结算整场战斗，使用其生物图鉴、棋盘、反应和对抗。

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

上面的 `battle` 块将人物卡数值借给战斗，计算方式仍属于 Marinara。可选的 `combat` 块则是另一回事：它说明如何用你的规则结算战斗。它为 Engine 所拥有的一种战斗类型提供参数，正如 `resolution` 为检定类型提供参数一样，其中每个名称都由你决定。共有三种类型：`attack-vs-defense` 把骰子相加后与一个数字比较；`dice-pool` 让战斗掷出 `dice-pool` 规则集自己的骰池并计算成功数（见下文“以骰池进行的战斗”）；`symbol-pool` 则让战斗掷出 `symbol-pool` 规则集的叙事骰，并消费剩余的符号（见下文“以符号骰进行的战斗”）。

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

<a id="every-key"></a>

### 各个键

- `kind`：`"attack-vs-defense"`(一方投骰对抗另一方的防御，命中则造成伤害)、`"dice-pool"`(见“以骰池进行的战斗”) 或 `"symbol-pool"`(见“以符号骰进行的战斗”)。下面每个键在各类型下含义相同，只是按该类型读取数字的方式来读。
- `health`：必填。战斗扣除的对象。可以是 `{ "pool": "grit" }`，表示向下扣减的实时池；若有临时缓冲，伤害先扣缓冲。也可以是 `{ "track": "harm" }`，表示需要标记的伤势轨道。伤势轨道必须同时指定 `damageKinds`。还可以用 `{ "track": "wounds" }` 指定从 `min` 向上填到 `max` 的普通轨道（没有 `levels` 或 `boxes`；Capability API 1.383）：伤害增加点数，治疗扣除点数；轨道达到 `max` 就退出战斗，与池降到零相同。Genesys 的 Wounds(伤势) 就是一例，以 Wound Threshold(伤势阈值) 为 `max`；如果系统规定超过阈值才倒下，就将 `max` 设为阈值加一。普通生命轨道从其 `default` 开始（不用 `startFrom`），不能从 `max` 开始，也不接受 `damageKinds`。人物卡计算出的 `max` 属于每个角色自己，与池的最大值一样。任何轨道都不提供临时点数。
- `defense`：必填的值引用。可以是玩家输入的字段，或由你计算的派生值。
- `initiative`：必填。开始时投一次的骰子，以及可选的调整值引用。同值时调整值较高者优先，再按战斗建立时的顺序排列。`"each": "round"` 在每个新轮次开始时让所有人重新投先攻，使用当时的调整值（因此读取伤势轨道的调整值在受伤后会更慢），该轮从新顺序中的第一位开始。Capability API 1.47。`dice-pool` 战斗可以改为以骰池投先攻：`pool`(值引用) 是骰子数量，其成功数加上 `plus` 就是先攻数字，此时旁边不能有 `dice` 或 `modifier`。`resource` 需要 `pool`，它会保留这个数字并允许攻击改变它（见下文“会被攻击改变的先攻”）。Capability API 1.48。
- `attackRoll`：在 `attack-vs-defense` 下必填，在 `dice-pool` 下会被拒绝，因为后者掷的是结算规则自己的骰池。指定骰子、是否投两次取其一(`advantage`)、单骰最大与最小点数的效果(`naturals.max`：`critical`、`hit` 或 `none`；`naturals.min`：`miss` 或 `none`)，以及重击对伤害的影响(`critical`：`double-dice` 再投一次伤害骰，`max-dice` 加一次最高骰面，`none` 则是普通命中)。特殊骰面和检定一样，需要单颗骰子。战斗内的豁免也投相同的骰子。`criticalFrom` 扩大重击点数：它是从攻击者人物卡读取的值，即算作重击的最低自然点数，例如对于人物卡写着 19 的 5e Champion，写 `{ "field": "critical_from" }`。它受骰子最高面的约束，低于 2 的值表示完全没有范围（只有最高面，就像该字段保持为 0 的角色），并且需要单颗骰子且 `naturals.max` 设为 `critical`。Capability API 1.81。
- `economy`：必填。`budgets` 是一个回合可持有的行动额度，包含 ID、标签、`per`(`turn` 在持有者自己的回合开始时补充，`round` 在新轮开始时补充)和 `count`。你首先声明的额度是主额度，标准行动消耗它。`movement` 是可选的值引用，表示按你自己的距离单位，一回合可以走多远。它由棋盘上的战斗读取(见“位置”)。
- `attacks`：可选。其行为武器的人物卡列表。`name` 是给行命名的文本列，`damage.dice` 是骰子列；`toHit.ability`、`toHit.proficiency`、`toHit.bonus`、`damage.ability`、`damage.bonus` 和 `damage.type` 各自指定同一列表中的列。`ability` 列是保存某个自定义属性 ID 的 `enum`，不属于属性 ID 的值不作任何加成。`proficiency` 列是 `boolean`，设为真时加入熟练加值。没有可读骰子的行不是攻击，所以同一列表中的绳索仍只是绳索。`toHit.skill` 指定保存某个技能 ID 的 `enum` 列：该行加上这项技能检定所加的值；如果行指定了自己的 `ability`，就用它代替技能的属性，与检定的 `with=` 替换方式完全相同（Capability API 1.47）。`abilityChoices` 将行的属性列中的某个值映射到两个或更多规则集中的属性 ID（Capability API 1.793）：读取该值的行会使用其中命中加值最高的属性攻击，并用同一属性计算伤害。它正是为了表达 SRD 5.1 的 Finesse 属性而设，写作 `{ "finesse": ["str", "dex"] }`，并将 `finesse` 列入该列的可选值。如果这个值本身就是一个属性、指定了人物卡没有的属性，或不在任何属性列的可选值中，就会被拒绝。`toHit.sheetBonus`(Capability API 1.800) 将从人物卡读取的数字加到命中上：`value` 是任意值引用，`when: { "column": ..., "equals": ... }` 则将其限制为仅作用于指定列等于该值的行。SRD 5.1 的 Archery 规定“使用远程武器所做的攻击掷骰获得 +2 加值”，它在 `reach` 为 0 的行上读取特性列的 `listSum`，因此投掷匕首不会获得此加值。`strikes` 是可选的值引用，说明消耗一次该列表额度能获得几次打击。手中没有剩余打击时选取一行，会消耗额度并将其余打击交到手中；只要手中还有，所有声明了 `strikes` 的行都不再消耗额度，因此换武器、换目标、在两次攻击间行走，都自然地由菜单支持。`strikesCappedBy` 指定一个布尔列，无论列表一次给出几次打击，该列都将自己所在的行限制为一次。这用于无论使用者攻击次数多少，每回合都只能发射一次的武器；它正是为了表达 SRD 5.1 的 Loading 属性而设。若列表本来就一次消耗只给一次打击，该设置毫无意义，会被拒绝。手中的打击属于参战者，不属于某个列表：如果角色的两个武器列表都声明 `strikes`，不论挥动哪一行，都消耗同一份剩余打击。它们在获得它们的回合结束时清除。未声明此项的列表一次消耗获得一次打击，与该功能出现前的所有战斗相同。

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
- `standardEffects`：可选，表达标准行动标记本身无法涵盖的部分。目前仅 `dodge` 有此项：`{ "dodge": { "saves": ["dex_save"] } }` 指定闪避期间哪些自定义豁免投两次取较好结果。只能指定人物卡已声明的豁免，并且 `standard` 列表必须含有 `dodge`。省略后闪避与原来完全相同：更难被命中，仅此而已。`{ "help": { "beside": true } }`(Capability API 1.771) 只在与对手相邻时提供协助，而且该协助仅对当时与协助者相邻的对手生效；`standard` 列表必须含有 `help`。
- `conditions`：可选。将你自己的状态 ID 映射到效果，使人物卡状态和战斗状态成为同一份记录，中毒角色战后仍然中毒。效果取自封闭列表：`own-attacks-advantage`、`own-attacks-disadvantage`、`attacks-against-advantage`、`attacks-against-disadvantage`、`attacks-against-adjacent-advantage`、`attacks-against-far-disadvantage`、`attacks-from-adjacent-critical`、`cannot-act`、`cannot-react`、`speed-zero`、`half-move-to-stand`、`ends-on-damage`、`own-saves-advantage`、`own-saves-disadvantage`、`own-checks-advantage`、`own-checks-disadvantage`、`resist-all`、`cannot-target-source`、`cannot-target-source-side`(1.278) 和 `cannot-approach-source`。`failsSaves` 指定在该状态下无须投骰便失败的豁免。需要距离或移动的六项(`attacks-against-adjacent-advantage`、`attacks-against-far-disadvantage`、`attacks-from-adjacent-critical`、`speed-zero`、`half-move-to-stand`、`cannot-approach-source`)由有棋盘的战斗读取，没有棋盘时不产生效果(见“位置”)。`cannot-react` 会将持有者排除在走动打开的响应窗口之外，因此从不会征询其回应。效果旁还有四个键：
  - `modifiers`：状态持续期间它改变的数字。见下文“状态改变的数字”。
  - `saves`：两种豁免效果，以及任何针对豁免的调整值，涉及哪些自定义豁免。省略时表示全部；两者都没有却指定它，会被拒绝。
  - `skills`：两种检定效果，以及任何未自行指定技能的检定调整值，涉及哪些自定义技能。省略时表示全部；两者都没有却指定它，会被拒绝。战斗中的对抗掷的是战斗自己的检定，而不是技能，因此收窄到技能的内容永远不会作用于对抗；战斗外针对这些技能的检定会读取它（见[战斗外的检定](ruleset-items.md#checks-outside-a-fight)）。Capability API 1.53。
  - `whileSourceInSight`：只有施加者在持有者视线内时才生效的部分。`true` 限制整个状态；写该状态自身效果的列表，则只限制所列效果，其余继续有效。这适合无论是否看得到来源，都阻止你走近的恐惧。指定状态并不具备的效果会被拒绝。没有棋盘就没有可打断的视线，因此两种写法都会让所有效果生效。
  - `endsWhenSourceDown`：施加者倒下的瞬间移除状态。
  - 感官（Capability API 1.127）：状态的 `lacks` 指定其持有者不具备的感官，目录条目的 `mechanics.needs` 或生物行动的 `needs` 指定目标必须具备、它才能对其生效的感官。对于 5e 的 Deafened，写 `"lacks": ["hearing"]`；对于 Command，在其 mechanics 中写 `"needs": ["hearing"]`。耳聋的目标不会出现在 Command 的目标菜单中。需要听觉的范围或多目标效果会完全跳过该目标：没有豁免、伤害或状态。Deafened 结束后，该目标再次合法。每个列表有一到四个互不相同的感官 ID，用规则集自己的词；Engine 不认识任何感官名称。
  - 只在人物卡允许时可用（Capability API 1.166）：目录条目的 `mechanics.usableWhen` 写作 `{ "value": <value reference>, "atLeast": n, "atMost": n }`(一个界限或两个)。在战斗中，只有当从持有者人物卡、实时状态和物品读取的值处于界限之内时，才会在其回合或反应窗口中提供该条目；每次绘制菜单时都会读取。5e 的 Protection 需要手持盾牌：`"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`。Rage 的“未穿重甲”与此相同，在重甲数量上写 `"atMost": 0`。写成数值块的生物没有人物卡，因此没有东西限制它。
  - 只在施加者人物卡允许时施加的状态（Capability API 1.167）：目录条目 mechanics 或物品使用上的 `applies` 项可以带 `"when"`，形式与 `usableWhen` 相同。它在状态即将生效时，从施加者的人物卡、实时状态和物品读取，超出界限的项会被跳过；其他项仍然施加。5e 的 Rage 在四项上限之内施加 `raging` 和三种伤害状态之一：`{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`，然后是带 `"atLeast": 9, "atMost": 15` 的 `raging_damage_3` 和带 `"atLeast": 16` 的 `raging_damage_4`。没有人物卡的施加者施加每一项。生物的数值块和状态的 `onEnd` 没有可读取的施加者人物卡，因此在那里 `when` 会被拒绝。需要 schemaVersion 2 和 capabilityApi 1.167 或更新版本。
  - 生物类型与目标测试（Capability API 1.168）：`combat.creatureTypes` 列出参战者可以是什么，`{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`
    。生物指定自己的 `type` 和 `tags`；角色的类型是文本或选择字段 `field` 的值（当它是其中一种类型时），否则为 `default`(5e 的角色是类人生物)。目标测试写作 `{ "types": [...], "tags": [...] }`，匹配任意一项即通过；没有类型也没有标签的参战者永远不匹配。它用于三处：伤害子项的 `targetIs` 只对匹配的目标造成该子项（dragon slayer：`"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`，圣水：`{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`）；`applies` 项的 `targetIs` 只对匹配的目标施加该状态；`mechanics.targetTypes: { "is": test, "not": test }` 说明谁能被选中或卷入（Animal Friendship：`{ "is": { "types": ["beast"] } }`；Sleep：`{ "not": { "types": ["undead"] } }`）。范围会跳过 `targetTypes` 排除的人。预测只对 `targetIs` 子项能触及的目标计入它；人物卡上的普通平均值不包含它。战斗面板和 Game Master 能看到每个参战者的类型和标签。需要 schemaVersion 2 和 capabilityApi 1.168 或更新版本。
  - 状态的结束方式（Capability API 1.125）：Charm Person 使用 `"endsWhen": ["harmed-by-source-side"]`。来自施加者或其一方任何人的大于零的伤害，或他们以攻击、豁免或有害状态指向其持有者，都会在该有害行动完全结算后结束它，即使攻击未命中或豁免成功也是如此。`"saveWhenDamaged": true` 在受伤时重复回合豁免：每次受到大于零的伤害，都会以保存的 DC 重复施加行动的 `saveEnds`；成功则结束它。没有保存的豁免或 DC 时，不会掷骰。Hypnotic Pattern 使用 `"endsWhen": ["damaged"]` 和 `"shakeOff": { "budget": "action" }`：任何大于零的伤害都会立即结束它，或者持有者一方的另一个参战者可以在自己的回合花费该额度来结束它。`shakeOff.reach` 以规则集的距离单位计，默认为一格；没有棋盘时不测量距离。行动经济必须声明该额度。`endsWhen` 有一到两个互不相同的项。这些键不改变来源倒下和专注的结束方式。对于只在受到大于零的伤害时进行、从不在回合开始或结束时进行的豁免，使用 `saveEnds.at: "damaged"`(Capability API 1.129)：Dominate Person 的 applies 是 `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`，每次打击以施加行动保存的 DC 掷一次，不需要 `saveWhenDamaged`。
  - 行动经济（Capability API 1.76），就像 Haste 和 Slow 改变它的那样：
    - `budgets`：`[{ "budget": "haste", "flat": 1 }]` 让持有者每回合多获得（或少获得）这么多的某种回合额度，但不会低于零。只有按 `per` 回合补充的额度才能这样改变。额度可以用 `"count": 0` 声明，表示只有状态才会填充它，画面只在有人拥有它时才显示。自创的对手从不花费它。
    - `grants`：`{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }`
     说明该额度可以花在什么上：所列的标准行动（来自规则集自己的 `standard` 列表，从不用于主额度，因为每个标准行动本来就在那里）、一次单次打击的武器攻击（无论一个动作原本会把多少次打击交到手中；对生物而言，是对一个目标的数值块攻击，从不是多重攻击），以及物品的使用：`true` 表示任何物品，`{ "tags": ["mundane"] }` 表示只限带有这些物品标签之一的物品（5e 的 Use an Object 是普通物品的使用，从不是魔法物品的启动）。它们只在通常会消耗的额度用完之后才提供，并且只在持有者自己的回合：授予永远不会为反应支付。
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
- `damageKinds`：`health` 指定伤势轨道时必填，指定池时则拒绝，因为只有标记能携带种类，点数池没有位置保存种类(见[伤势轨道](ruleset-sheets.md#wound-tracks-health-that-is-a-track-not-a-number))。它说明一次打击标为轨道的哪个 `kinds`，以及勾几格。`default` 用于一切未映射的情况，包括完全不带类型的打击；`byType` 将你的 `damageTypes` 映射到标记种类，键和类型本身一样不区分大小写，所以 `"Fire"` 和 `"fire"` 是同一个键，同时指定会被拒绝。`marks` 没有默认值，因为两种选择含义相反：`"per-point"` 表示伤害骰计算生命等级，三点打击勾三格，减轻一点也有价值；`"per-blow"` 表示打击要么命中要么未中，无论打得多重都只勾一格。带多个伤害子项的打击也只标一格，采用实际生效的最严重种类。请明确你的系统采用哪一种。`{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`。
- `pool`：在 `dice-pool` 下必填，在 `attack-vs-defense` 下会被拒绝。见“以骰池进行的战斗”。
- `spendLimits`：可选。在战斗中，一个参战者每 `turn` 或每 `round` 最多能从某个实时池消耗多少，无论哪种池都适用：`[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`。`max` 在战斗开始时读取一次。超出剩余限额的费用视为付不起，因此不会出现在菜单上，无论池中还有多少。每回合的限额在持有者自己的回合开始时重新计算，每轮的限额在新一轮开始时重新计算。以直接数值编写的对手不从人物卡支付任何东西，因此限额从不约束它；以人物卡编写的对手从自己的池中支付，与其他人一样受限额约束。Capability API 1.47。
- `threat`：可选，生物图鉴需要它。`tiers` 是选取敌人的尺度，包含 ID、标签、`health` 区间、`defense`、`toHit`、`damagePerRound` 区间和 `saveDifficulty`。你提供的每个生物都指定其中一档；没人预先编写的敌人则会拉回 Game Master 要求的档位，因此不会超出你的尺度。`damagePerRound` 区间按生物一轮内对一个目标造成的伤害读取，包含完整动作序列。档位可以带 `worth`，指定该档位的生物在遭遇战额度中计入多少价值（5e 按挑战等级确定的经验值）；`threat` 可以带 `budget`，指定面对某支队伍时，一场战斗可以容纳的价值（Capability API 1.803）：
  - `level`：相加后得到队员等级的数值字段（5e：每个职业一个字段）。
  - `steps`：难度阶梯，按从低到高的顺序排列，每项为 `{ "id", "label" }`。
  - `byLevel`：`[{ "level": 5, "worth": [500, 750, 1100] }]`，为达到该等级及以上的单个队员，在每个难度阶梯分别指定一个价值；等级按升序排列。
  - `crowd`：可选，`[{ "from": 2, "times": 1.5 }]`，指定对手数量达到相应数量时，其价值乘以多少；队伍人数少于 `smallParty` 时向上读一行，多于 `largeParty` 时向下读一行（5e 2014 的倍率）。SRD 5.2 的额度直接累加各项价值，采用该规则时省略此项。
  - `forGame`：可选，各游戏难度（`casual`、`normal`、`hard`、`brutal`）对应的难度阶梯。省略时依次对应各阶梯，超出最后一个阶梯的难度都使用最后一个阶梯。

  游戏主持人（GM）编写战斗前，会获知每个档位的价值和队伍的额度。它编出的战斗若价值超出额度，就会下调：将价值最高的自创对手降低一个档位，反复执行，直到符合额度；包含首领的战斗可以达到高一级难度阶梯的额度。生物图鉴中的生物和此前参战、这次再次出现的生物都按原有价值计入，故事中的战斗则由故事作者决定。战斗的调整说明会列出下调的内容。

### 针对状态、伤害或魔法的豁免

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
- `hardness`：在先攻是会被攻击改变的数字时，表示战斗者硬度的值引用。见[战斗中的护甲与穿戴效果](ruleset-items.md#armor-and-worn-effects-in-a-fight)。

每个目标的伤害都为该目标单独掷出，因为命中超出所需成功数所赢得的部分，以及目标吸收的部分，都只属于该目标。打击的第二个子项和附加效果各自是一个独立的、有自己种类的伤害骰池，不会从命中获得额外骰子。菜单会精确预测骰池：达到所需成功数的几率，以及第一个目标吸收之后伤害骰的价值。

Gravewatch 就是这样写的：它的守望者掷一个评级加一个专业技能，用 Sinew 吸收冲击伤，完全不吸收撕裂伤，每回合可以消耗一点 Resolve，并且每轮重新投先攻。

**逆序声明没有实现。** 有些系统要求所有人在任何人行动之前先声明行动，最慢的人先声明。在每个参战者轮到时才选一个行动的战斗中，先声明不会改变任何规则读取的内容，因此没有需要用键表达的东西。

<a id="a-fight-thrown-in-symbol-dice-symbol-pool"></a>

### 以符号骰进行的战斗：`symbol-pool`

`symbol-pool` 规则集读取符号而非数字，它的战斗也可以如此，因此 Engine 能运行整场战斗，无须询问 Game Master 一个优势符号换来了什么。`"kind": "symbol-pool"` 要求 `resolution.kind` 为 `"symbol-pool"`，并以符号检定已有的方式读取人物卡：

- 命中数字就是攻击者的骰子。在人物卡上，攻击行的数字由属性和技能等级共同决定：较大者为掷骰数量，较小者为其中升级的数量，与 `pool.build: "larger-upgraded"` 组建检定的方式相同。生物行动用 `toHit`(骰子数量) 和 `upgrades`(其中升级的数量) 表示，这需要池带有 `upgrade` 骰，且不能用 `sum` 组建。
- `defense` 是用来对抗攻击者骰子的难度骰数量。生物的 `defense` 是其自身的难度骰数量。掩护和状态对 `defense` 的调整值都会增加难度骰。
- 状态对攻击、豁免或检定的调整值，以及 `penaltyFrom` 指定的伤势惩罚，有利时是增益骰，不利时是挫折骰，因此都用 `flat` 数字：掷骰得出的调整值（`dice`）会被拒绝。偏向一方的掷骰（远射程、状态的劣势）多掷一颗挫折骰，偏向另一方时则多掷一颗增益骰。
- 净成功数达到 `success.needed` 就命中。豁免的数字是其骰子数量，难度是对抗它们的骰子数量；对抗掷出双方各自的骰子，净成功更多的一方获胜。先攻可以用骰池投掷（`initiative.pool`），净成功数就是其数字。
- 伤害与 `attack-vs-defense` 战斗一样求和。每个净成功为命中增加 `damage.perSuccess`(默认为一点) 伤害，可以计入所有成功（`"counts": "all"`），也可以只计超出命中所需的成功（`"beyond"`）；目标的吸收从整次打击中扣除，但不会扣到零以下。
- 没有大失败，也不会让伤害掷骰翻倍。重击由消费符号获得。

符号的作用由 `symbols` 块规定：

```json
"symbols": {
  "damage": { "perSuccess": 1, "counts": "all" },
  "soak": { "all": { "derived": "soak" } },
  "spends": [
    { "id": "boost", "label": "Boost an ally", "by": "attacker", "symbol": "a", "cost": 1, "boost": { "dice": 1, "on": "attacker-ally" } },
    { "id": "crit", "label": "Critical", "by": "attacker", "symbol": "a", "cost": 2, "when": "hit", "critical": true, "condition": { "id": "injured", "on": "target", "rounds": 3 } },
    { "id": "triumph", "label": "Triumphant blow", "by": "attacker", "symbol": "t", "cost": 1, "when": "hit", "critical": true, "damage": 2 },
    { "id": "strain", "label": "Overextend", "by": "target", "symbol": "h", "cost": 2, "track": { "id": "strain", "by": 1, "on": "attacker" } },
    { "id": "setback", "label": "Opening", "by": "target", "symbol": "h", "cost": 1, "setback": { "dice": 1, "on": "attacker" } },
    { "id": "despair", "label": "Weapon slips", "by": "target", "symbol": "d", "cost": 1, "condition": { "id": "disarmed", "on": "attacker" } }
  ]
}
```

- `soak`：目标从每次命中中减去多少，从其人物卡读取。`all` 是适用于任何伤害种类的值引用，`byKind` 则为生命轨道的每种伤害各给一个，对其种类优先于 `all`。生物用 `soak: { "all": 2 }` 给出自己的数字，这需要在此声明 `soak`。
- `spends`：最多 16 种可用攻击掷骰剩余符号购买的效果。花费 `cost` 个 `symbol` 购买一次，`max`(默认为一) 指定一次掷骰最多购买几次；施加 `condition` 或造成 `critical` 的消费只生效一次，因此其 `max` 保持为一，同一次掷骰中，任何两项消费都不能对同一个人施加同一个状态（或同一 `oneAtATime` 类别的两个状态）。若消费不会产生作用，就不购买：状态无法施加（被阻止，或已持有同类状态），或轨道没有足够空间向该方向移动完整一步（空间可能已被同一次掷骰中更早的消费用掉）。`by` 指定由哪一方选择：攻击者花费有利于自己的符号（优势、胜利），目标花费有利于目标的符号（威胁、绝望）。一种符号由一方花费，消费绝不使用成功符号，因为成功已经用于命中并增加伤害。
- `when`：只在 `hit` 时、只在 `miss` 时，或两者都可（`any`，默认）购买。`damage`(吸收之前加入命中的伤害) 和 `critical`(该次命中成为重击，因此带 `onCritical` 的子项生效，日志也会说明) 要求 `"when": "hit"` 和 `"by": "attacker"`。
- 消费可以产生以下任意效果：`condition` 对某人施加你的某个状态，持续 `rounds` 轮或直到某种东西结束它；`track` 将普通实时轨道改变 `by`(如紧张、压力)，绝不能是生命轨道；`boost` 和 `setback` 为受影响者在本场战斗的下一次掷骰增加相应数量的骰子，并由那次掷骰用掉。`on` 为 `attacker`、`target`、`attacker-ally` 或 `target-ally`；盟友指该阵营中下一个行动的人，没有符合条件的盟友时，就不购买该消费。
- `worth`：可选，AI 以伤害点数衡量的消费价值。省略时，Engine 按效果计算：伤害按点数，一个状态值两点，下一次掷骰的一颗骰子值略多于半点，轨道的一步值半点；这些效果作用于对方阵营，降低轨道或增加增益骰时也可作用于选择者自己的阵营。对选择者毫无价值的消费绝不会被购买。

Engine 为双方用已有符号购买价值最高的消费，对玩家和对手一视同仁，并在日志中逐项说明。玩家也可以自己选择：在战斗画面勾选 Choose my own symbol spends(自行选择符号消费) 后，若一次掷骰让玩家操控的队员有可购买的效果，战斗就会等待，玩家可以逐项选择消费、让 Engine 选择剩余部分，或不再消费。玩家的选择遵循与 Engine 相同的规则（费用、`max`、`when` 和实际能生效的内容），Engine 仍为其他所有人选择。规则集无须为此添加任何内容。没人花费的符号留在掷骰结果中，供 Game Master 叙述。菜单的预测计入掷骰的所有可能结果：命中几率，以及计入成功和消费、扣除吸收之后一次命中造成的伤害。AI 据此衡量每次攻击，并扣除对方消费会让自己付出的代价。

**仍由 Game Master 处理的内容。** 消费的费用属于规则集，而非每把武器，因此武器自身的重击评级要写成规则集共用的消费；重击自身的表仍由 Game Master 掷骰。豁免、检定或对抗上的优势不能用来购买任何东西：只有攻击掷骰的符号可以花费。战斗中升级难度骰的机制尚未实现。

### 最低伤害骰

骰池战斗即使面对强大的吸收也能保留骰子，就像 Exalted 的 **Overwhelming**：

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

这就是 `combat.damage.minimum`，一个从**攻击者**当前人物卡读取的值引用。静态吸收从一次命中的第一个伤害骰池中扣除骰子后，骰池会被提高到至少这个数。它是整数颗骰子，向下取整并限制在零到 `resolution.pool.max` 之间，而不是自动成功：每颗留下的骰子都可能失败。掷骰吸收仍在伤害掷骰之后扣除成功；它不减少骰池，因此最小值无法保护成功不被它扣除。抗性和免疫仍然适用。消耗先攻的打击无视最小值，就像它们无视武器伤害和吸收一样；夺取先攻的打击会使用它。

武器可以用 `item.attack.damage.minimum` 覆盖通用最小值。它接受针对持有者的同样的值引用，或用 `{ "stat": "overwhelming" }` 指定物品自身的某个数字数值。声明为零也会覆盖通用最小值。这与现有的武器 `floor` 不同，后者保证的是吸收之后的伤害量。额外的伤害子项和附加效果不会再获得一个最小值。战斗记录和日志会在骰子旁显示解析后的最小值。战斗键和武器键在包中都需要 **Capability API 1.146**，包括外部目录文件中的武器。

### 让人眩晕的命中

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

### 由目标决定伤势种类

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
- `resist`、`vulnerable`、`immune`：伤害类型，不区分大小写匹配；如果声明了 `combat.damageTypes`，还会据此验证。`resist` 或 `immune` 项还可以说明什么能穿透它，`{ "type": "tearing", "except": ["silver"] }`：来自带有其中某个物品标签的武器物品的打击按原样承受（Capability API 1.55，见[战斗中的武器](ruleset-items.md#weapons-in-a-fight)），`damage.qualities` 或目录条目 `mechanics.qualities` 指定了其中之一的行动也一样（Capability API 1.101）。`conditionImmunities` 指定你自己的状态，或你的 `combat.levels` 读取的轨道（Capability API 1.115）。
- `tier`：属于 `combat.threat` 的哪一档。
- `loot`(Capability API 1.63)：打赢战斗时为它掷的战利品表 ID(见[战利品](ruleset-items.md#loot))。
- `inventory`(Capability API 1.795)：战斗开始时它可能随身携带的物品，最多 16 行。每行指定你的一个物品（`item`，写作 `<catalog>/<entry>`）或一张战利品表（`table`），并带有 `chance`（按百分制，默认为 100）和 `count`（数字或骰子，默认为 1；若为表，就掷这么多次）。它会在战斗中使用能用的物品：带 `sheet` 的生物像队伍成员一样使用物品，普通数值块则使用其 `use` 会在使用时消耗物品、且不读取使用者任何内容的物品（药水、油）。它被击败时，剩余物品会和其 `loot` 一起掉落；逃跑的生物则会把物品带走。游戏主持人（GM）也可以改为给对手指定携带物品（遭遇战中的 `carrying`），以此替代这些行。
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

Engine 用于测试的 5e 草案副本 `docs/development/ruleset-5e-2014.example.json` 中有一份包含五个手写生物的生物图鉴，覆盖动作序列、充能恢复、带状态的豁免、抗性与免疫、有限使用次数、招牌点数，以及一个以人物卡编写的生物。完整的 SRD 生物图鉴是官方 [5e (SRD 5.1) 包](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014)中的 `catalogs/creatures.json`。

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

**游戏可以使用哪些样式。** `combat.styles` 按 ID 指定使用该规则集的游戏可用的战斗样式：`classic`、`tactical`，或客户端注册的样式（最多 8 种，每种一次，且至少包含 `classic` 和 `tactical` 之一）。省略时，与以前一样提供所有样式。规则需要棋盘（范围、触及、掩护、夹击）的规则集写 `"styles": ["tactical"]`：新游戏向导和游戏设置就只提供 Tactical，因此战斗始终带有位置。已经保存的游戏若使用未列出的样式，就改用列表中客户端能绘制的第一个样式（客户端没有注册列表中的自定义样式时，取列出的第一个内置样式）；创建游戏或在设置中切换样式时，都不能选择未列出的样式。已经开始的战斗保留开始时的样式。无论战斗导演是否开启，该列表都生效，因此它也会限制使用该规则集时 Marinara 自身的 Classic 和 Tactical 战斗。使用 `styles` 的规则集需要 Capability API 1.379。

```json
"combat": {
  "kind": "attack-vs-defense",
  "styles": ["tactical"],
  "distance": { "label": "feet", "perCell": 5 }
}
```

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

**在空中**（Capability API 1.354）。在任何棋盘上，飞行者是否处于空中都单独记录：不能行走或带 `hover` 的飞行者从空中开始；在地面上的飞行者可通过免费的 Take off(起飞) 操作、向上飞行，或迈出只有飞行才能迈出的一步（水面上，或飞行比行走便宜的地方）起飞，通过免费的 Land(降落) 操作（仅能行走的飞行者可用）降落；若没有悬停能力，被撞倒在地、被击倒或被限制到零速度时也会落地。Fly down(向下飞行) 到地面高度后，在降落之前仍处于空中。在空中时，其生物美术使用飞行美术。目前其他规则都不读取这一状态。

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
- **一回合与下一回合之间。** 回合结束后、下一回合开始前，会询问所有持有 `signaturePoints` 且能负担自身某个 `signature` 行动的敌人是否购买一次。除非 `combat.signatureAtTurnStart` 另有规定，否则这是唯一能购买的时刻：招牌行动不在任何人的回合菜单里，包括它自己的菜单。
- **敌人的回合开始**（Capability API 1.805）。设有 `"combat": {"signatureAtTurnStart": true}` 时，对手的回合开始后，等该回合开始所触发的效果（状态、豁免、反应）发生完毕、对手行动之前，也会询问所有持有 `signaturePoints` 的人：首领回应即将行动的英雄，就像通用战斗中的预判一样。巢穴动作保持自己的计数，不会在此时提供。省略此设置时，招牌行动只在回合之间购买，与 5e 的传奇动作一样。使用此设置的规则集需要 Capability API 1.805。
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

- **超出简易棋盘的内容**：不能飞越障碍。生物只会因自身的行走、坐骑的行走、传送、推动它的东西（对抗、条目、生物行动或区域），以及拖动它的人而移动。
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
