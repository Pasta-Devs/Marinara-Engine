# 规则集角色构建器

本页是[编写 Game Mode 规则集](writing-rulesets.md)的一部分。引导式构建器：分步创建角色，从种族和职业到分值、熟练、法术和装备。

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

最多 32 个步骤，每个写作 `{ id, label, kind, ... }`；超过 16 个步骤的包要声明 Capability API 1.112，超过 24 个步骤的包还要声明 Capability API 1.768：

- `catalog`：行目录中的条目，以卡片形式显示，其 `summary` 位于 **Info**(信息) 之后。`min`(默认 1) 是该步骤要求选几个，`max`(默认 1) 是最多能选几个；`max` 为 1 时，新的选择会替换旧的。两者最高都可以到 60；任一超过 20 的包要声明 Capability API 1.110，任一超过 40 的包还要声明 Capability API 1.768（20 级法师的法术书容纳 44 个法术）。`field` 指定一个文本或枚举字段，所选的标签会写入其中（枚举字段取条目的 ID 或标签中属于其取值的那一个）。`filters` 固定目录筛选项的值，`within: { step, filter }` 只提供其 `filter` 指向更早那个步骤中所选条目的条目，就像亚种指定其种族；取消选择种族后，其亚种就不再计入。`upTo: { filter, value }`(Capability API 1.87) 只提供数字 `filter` 不超过 `value` 的条目，后者是按人物卡当前状态读取的值，例如不超过角色等级的特性（`{ "filter": "level", "value": { "derived": "level" } }`）；没有该筛选项的条目总会提供，人物卡之后低于其要求的选择不再计入，但会保留。改变所读取值的选择（设定等级的职业）会在同一次改动中结算，在 **All fields** 中改变的值也一样（在那里降低等级，会立即收回高于它的特性所给予的东西）。`countFrom`(Capability API 1.90) 是以同样方式从人物卡读取、同时代表 `min` 和 `max` 的值：该步骤要求选几个、最多能选几个，向下取整且不超过 `max`，例如某职业在角色当前等级已知的法术数（`{ "derived": "spells_known" }`）。超出的选择会保留，但在数量再次上升之前不计入。目录步骤还可以带 `stamp`(Capability API 1.108)，即写入它所添加的每一行的 1 到 4 个列值，例如在法师的法术步骤上写 `"stamp": { "class": "wizard" }`，在牧师的步骤上写 `"stamp": { "class": "cleric" }`。每个键都必须是该目录供给的每个列表中的列；值为字符串、数字或布尔值。印记取代目录的初始值。已有的行以及之后在 **All fields** 中的编辑仍属于玩家。从 Capability API 1.130 起，印记值也可以是一个对象，其 `fromWithin` 为 `"id"`、`"label"` 或父目录声明的筛选项 ID：它按选择顺序读取第一个匹配的父条目，在添加该行时写入一次字符串或数字；如果没有匹配的父条目，或其筛选项缺失或为数组，则该列不加印记。

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
- 目录条目可以指定一个 `exclusive` 组（Capability API 1.94）：构建器步骤每组只保留一个选择，因此选择一个会丢弃该步骤在同组中的另一个选择，只有最新的计入。代替属性值提升的专长与它共用一个组：`"exclusive": "fighter-asi-4"`。`"exclusiveDefault": true`(Capability API 1.772) 会让自动选取所有所提供条目的步骤选取该条目作为其组的选项，直到玩家选择另一个。
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

行步骤可以用 `countFrom`(Capability API 1.799) 指定所需行数，其值从人物卡读取：例如 5e 的生命值掷骰，从第 1 级之后每级一次。显示该步骤时，构建器会添加行，每行都按 **Add a row**(添加一行) 的方式创建，直到玩家自己的行数达到该数量，且从不超过 `max` 或列表的 `maxItems`；它从不移除行，在此处移除的行会保持移除，直到再次显示该步骤。对于正在被描述的角色，查看该步骤不会为其添加行。随后，该步骤会像对待 `min` 一样，等待凑齐该数量的完整行；两者都指定时取较大值，并显示相同的“N of M”计数。使用它的规则集需要 Capability API 1.799。

```json
{
  "id": "hit_point_rolls",
  "label": "Hit point rolls",
  "kind": "rows",
  "list": "hp_rolls",
  "required": ["die", "roll"],
  "countFrom": { "derived": "hp_rolls_due" }
}
```

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
