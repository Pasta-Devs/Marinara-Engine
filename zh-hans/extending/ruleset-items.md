# 规则集物品

本页是[编写 Game Mode 规则集](writing-rulesets.md)的一部分。队伍携带什么：类别、武器、护甲、弹药、战利品、金钱、初始装备和市场。

护甲、武器、药水、装备、弹药和钱都是物品。可选的 `items` 块声明规则集中每件物品所用的词汇，`holds: "items"` 的目录则列出物品本身。两者都需要 Capability API 1.49；该块中管理 Game Master 自创物品的 `rarityCaps` 和 `propose` 需要 1.51；读取角色所持物品的值（`itemStat`）需要 1.52；物品在穿戴或携带时对检定的作用，以及该块的 `bonus` 上限，需要 1.53；物品对穿戴者的要求及其改变的属性需要 1.54；武器的 `attack` 需要 1.55；物品在战斗中的作用需要 1.56；武器射出什么、装填多少需要 1.57；武器的模式、副手攻击、下限和命中时施加的状态需要 1.58；在战斗中使用物品的效果及其储存的充能需要 1.59；恢复池的使用需要 1.60；休息时恢复充能，或用尽时会损坏的物品需要 1.61；先要求检定的使用（`gate`）需要 1.62；战利品表和生物的战利品需要 1.63；掉落钱币的战利品项，或移除钱币的层需要 1.64；市场、物品的 `sold` 地点和 `service` 需要 1.65；集市日（钱袋、`buyBack`、卖家的 `stock`、`limited` 数量，或不指定地点的 `sold`）需要 1.69；在手持武器上触发的附加效果（`weapons`）需要 1.70；初始装备（`startingGear`）需要 1.78；有风险的物品、赝品或不诚实的卖家需要 1.79。

## 物品块

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

- `categories`：一到 24 个。每件物品恰好属于一个类别，如护甲、武器或药水。
- `rarities`：可选，最多 12 个。按从最常见到最稀有的顺序列出。
- `tags`：可选，最多 48 个。物品可能具有的特性，如可投掷或镀银。
- `stats`：可选，最多 24 个。物品携带的数字和词语，声明方式与列表列完全相同：`number`、`text`、`boolean`、`enum` 或 `dice`，类型支持时还带范围、取值和默认值。`promptVisible`(默认 `true`) 决定 Game Master 是否会在物品旁看到该数值。只应让玩家看到的内容，例如物品藏在哪里，请设为 `false`。
- `slots`：可选，最多 12 个。物品穿戴或手持的位置，以及角色有多少个该槽位，1 到 20。
- `binding`：可选。同调、灌注，或其他任何限制一个角色同时能绑定多少件物品的机制。`label` 是它的名称，`max` 是从角色人物卡读取的值，如 `{ "abilityScore": "nerve" }` 或派生值。它不能读取实时状态，因为角色能绑定多少物品不会随每次打击而改变。
- `carry`：可选。`stat` 指定作为物品重量的数字数值，其 `min` 须为 0 或以上。`encumberedAbove` 是角色在超重之前能携带多少，`limit`(可选) 是最多能携带多少。两者都像 `binding.max` 一样从人物卡读取。没有 `carry` 时，重量没有意义，也没有人会超重。`unit`(可选，最多 12 个字母，Capability API 1.791) 指定重量的计量单位，例如 `"lb"`：物品栏的负重、初始装备选择器中的重量以及装备套组选项的重量，都会在数字后显示它。
- `currencies`：可选，最多六个货币体系，每个体系一到十种钱币。
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

## 一件物品

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

## 什么会读取物品

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

## 人物卡上的物品

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

## 战斗外的检定

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

## 来自状态、等级、物品和人物卡行的分类防御

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

## 战斗中的武器

物品可以是武器（Capability API 1.55）。它的 `attack` 与战斗块的[攻击行](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)形状相同，只是用值代替列；物品穿戴时，[规则集战斗](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)会把它作为攻击提供：拿在它所占用的手中，需要绑定的还须已绑定。收起或仅携带的武器不提供任何东西，攻击行和生物自身的行动与以前完全一样。Ember Roads 的手斧：

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

### 弹药与装填

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

### 模式、第二把武器、下限和命中时的状态

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

- `floor`：一次命中至少造成的伤害，可以直接写下，或从物品的某个数字数值读取。
  骰池战斗中吸收后的伤害，或求和战斗的伤害，会在抗性减半之前提高到这个值，日志也会说明。
  消耗型打击掷出的是攻击者自身的数字，从不提高。
- `onHit`：打击造成的伤害达到 `atLeast` 时，目标会受到的最多四种状态，持续其自身的 `rounds` 个回合；
  没有它时，持续到被某种东西移除。
  伤害指吸收和抗性之后实际作用于目标的部分；
  夺取型打击夺取的是先攻而不是造成伤害，因此不会施加状态。
  每一项还可以带 `save: { "save": <save id>, "difficulty": n }`，目标在状态即将施加时进行该豁免，
  成功则不受该状态；
  以及 `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`，让状态持续到持有者在每个回合开始或结束时、
  或在受到大于零的伤害时通过该豁免为止（此时它没有 `rounds`）。
  两者都算作针对该状态的豁免，武器为魔法武器时还算作针对魔法的豁免（Capability API 1.169）。
  5e 的 sword of wounding：`{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`。
- `plus`：每次命中额外最多三项数值，每项写作 `{ "dice", "flat", "type", "save", "targetIs", "when" }`，各自掷骰、各有类型、各自受抗性影响（Capability API 1.169）。
  `save` 指定其自身的 `difficulty` 和 `onSuccess`(`half` 或 `none`)。
  `targetIs` 只对属于这些生物类型或标签的目标造成它（见战斗页面[每个键](ruleset-combat.md#every-key)下的“生物类型与目标测试”）。
  `when: "critical"` 只在重击时造成它；
  任何子项的骰子在重击时
  都像武器的骰子一样翻倍。
  javelin of lightning 写作 `{ "dice": "4d6", "type": "lightning" }`；
  dragon slayer 写作 `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`；
  sword of sharpness 写作 `{ "flat": 14, "type": "slashing", "when": "critical" }`。
  预测只对子项能触及的目标计入它，且从不计入只在重击时生效的子项。
  `when: "toggled"` 只在物品的开关打开时造成它（Capability API 1.170，见下文 `toggle`）。

武器详情和 Game Master 看到的那一行会说明全部内容：`modes Volley (2 shots, -2 to hit, up to 2 targets)`、`off hand (Quick)`、`at least 1 on a hit before resistance`、`+3d6 slashing against Dragon` 和 `Marked for 2 rounds when a hit deals 2 or more`。

<a id="armor-and-worn-effects-in-a-fight"></a>

## 战斗中的护甲与穿戴效果

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

## 在战斗中使用物品

物品可以在战斗中使用（Capability API 1.59）：按在伤口上的药膏、吞下的补剂、敲响的铃铛。它的 `use` 用目录条目 `mechanics` 的词汇说明使用效果（见[战斗会从 `mechanics` 读取什么](ruleset-combat.md#what-a-fight-reads-from-mechanics)）：`kind`(`heal`、`attack`、`buff` 或 `debuff`)、`amount`、`damageType`、`plus`、`attackRoll`、`save`、`applies`、`temporary`、`range`、`area`、`targets`、`targetCount`、`friendlyFire`，以及从 Capability API 1.174 起的 `concentration` 和 `zone`，再加上它消耗的 `budget`，或 `free`。Ember Roads 的药膏，以及 Gravewatch 的暖身补剂和 Dawn bell：

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

## Classic 与 Tactical 战斗中的物品

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

<a id="loot"></a>

## 战利品

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
- 生物图鉴中的生物用 `loot` 指定它携带的表（见[生物](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)）。打赢的规则集战斗会为每个被击败的生物掷其表；Engine 不按你的规则结算的战斗没有图鉴生物，因此什么也不掉落。
- 掉落的东西像添加一样进入共享视图，先问玩家的背包，没有人能携带的东西会被留下。Game Master 收到的战后摘要会说明掉落了什么、已经放进背包，冒险日志也会记录，并显示通知。
- Game Master 在故事中用 `[loot: table="grave_goods" who="Ada"]` 掷表（`who=` 指定某个角色的背包），与其物品栏标签一样以回合开始时为基准，因此重新生成的回复只掉落一次。每件掉落的物品都按添加来答复，它的指令会列出你的表。

## 金钱

你的 `currencies` 就是队伍的钱。钱币是背包里的物品，每种钱币和其他物品一样成一叠，以其 `label` 命名：

- 其体系中每 `perWeight` 枚钱币重一个携带数值单位，计入持有者的负重，进入时按携带规则分配。没有 `perWeight` 的体系没有重量。
- 玩家从选择器的 **Coins**(钱币) 列表中添加钱币，并像任何一叠物品一样拆分、给予和合并它们。
- 物品栏各叠物品上方有一行，显示视图中每个体系的钱币，以及它们折合该体系最小钱币的价值。Game Master 会在每个背包旁看到这一价值（`Coin worth 432 pennies`，空钱袋则为 `no coins`，玩家的背包即使是空的也会列出），并在物品旁看到物品的 `cost`(`costs 3 shillings`)。
- Game Master 用 `[inventory: action="pay" amount="3 shillings" who="Ada"]` 付款，用 `action="earn"` 收款。`amount` 是数量加钱币，钱币用 ID 或标签指定，单数复数均可，不区分大小写（`1 penny`、`12 pennies`）。付款从一个背包中支出（不带 `who=` 时为玩家的背包），且只使用该钱币自己的体系：先付能用上的最大面额钱币，再把剩下的、足以付清余款的最小钱币破开，找零以该体系较小的钱币返还，面额从大到小。答复会说明付了什么、找回什么：从只有一枚 crown 的钱袋中付 3 shillings，就是 `Paid with crowns ×1; shillings ×2 back.`。背包付不起的付款会被拒绝（`cannot-afford`），你没有的钱币（`unknown-coin`），以及在没有货币的规则集中的任何付款（`no-currencies`）也一样。收款就是添加该钱币，放进 `who` 的背包，或按携带规则分配。冒险日志会列出支出和收入，并显示通知。它的指令会列出你的钱币，只有带钱币的规则集才有这些指令。
- 购买就是先付款再添加；在有市场的规则集中，则是 `buy`(见下文)。没有商店画面。

## 初始装备

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

## 市场

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

### 集市日

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

### 诚实与不诚实的卖家

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

<a id="spotting-fakes"></a>

### 识破赝品

Capability API 1.802 让角色能通过自己进行的检定，或在任何人付款之前察觉，识破赝品的真面目。Engine 不认识任何检定名称：检定由规则集编写。

```json
{
  "id": "potion-of-poison",
  "label": "Potion of Poison",
  "item": {
    "category": "potion",
    "passesFor": "magic_items/potion-of-healing",
    "tells": [
      {
        "check": { "value": { "derived": "poisoners_kit_check" } },
        "dc": 13,
        "carries": { "anyOf": ["gear/poisoners-kit"] },
        "says": "a faint bitterness under the sweetness"
      },
      { "check": { "skill": "arcana" }, "dc": 18, "says": "its magic does not feel like healing magic" }
    ],
    "foolsReveal": ["identify"]
  }
}
```

```json
"items": {
  "namesItAt": 5,
  "revealsFakes": [{ "id": "identify", "label": "Identify" }, { "id": "detect-poison", "label": "Detect Poison and Disease", "items": ["magic_items/potion-of-poison"] }],
  "market": { "sellers": [
    { "id": "fence", "label": "Fence", "honest": false, "sells": [{ "tag": "magical" }],
      "manner": { "check": { "skill": "insight" }, "dc": 13, "advantageIf": [{ "value": { "derived": "knows_trade" }, "atLeast": 1 }], "says": "their eyes slide away when you ask about it" } }
  ] }
}
```

- 赝品上的 **`tells`**（最多六项）：每项包含任何人都可以做的一项检定（`check` 是技能、属性或从人物卡读取的值，指定方式与使用的 `gate` 相同）、难度 `dc`，以及成功时看到的情况（`says`）。`needs` 指定人物卡必须满足哪些要求才能尝试该检定（使用 `needsAny` 时，满足其中任意一项即可），`carries` 指定检定者自己的背包里必须有的物品，例如工具检定所用的工具包。满足 `advantageIf` 中任意一条，就以优势掷骰；满足 `disadvantageIf` 中任意一条，就以劣势掷骰。
- 不诚实卖家上的 **`manner`**：针对卖家而非物品的检定，组成部分与上面相同。成功只会说明卖家出售的东西有些不对劲，绝不会说出它到底是什么。
- **检查**：`[inventory: action="inspect" item="Potion of Healing" who="Mira"]` 检查 Mira 背包里的一件物品；加上 `seller="Fence"` 则检查此地某个卖家当天展示的商品，可以在任何人购买之前检查。若规则集中的赝品可以被发现，物品栏就会提供 **Inspect**(检查) 按钮，发出“在决定是否信任这瓶 Potion of Healing 之前，我先仔细检查一下。”，供游戏主持人（GM）写出标签。Engine 使用规则集自己的骰子，从赝品的破绽检定和不诚实卖家的言行检定中，选择角色能做的最佳检定来掷骰。对赝品检定成功，会发现它可疑：回复会说明看到了什么，背包会显示“Mira 认为这是假货”，但物品仍以它所冒充的物品命名。如果破绽检定的成功幅度达到 `items.namesItAt` 或更高（5e 中为 5），还会说出它的真实身份，此后它就以真实物品的身份出现。真品会掷那些冒充它的赝品所用的破绽检定，因此发起检查本身不会泄露信息，成功时会说它看起来是真品。每个角色对每件物品只能尝试一次（物品叠会记录谁已尝试；商品的记录则保留整个集市日）；失败时会说无法判断。如果物品没有任何可识破的破绽，或角色完全无法对它做任何检定，会以 `nothing-to-check` 拒绝，且不消耗尝试次数。
- **购买前察觉**：如果一次购买会从不诚实卖家处买到赝品，队伍中的其他每位成员都会计算自己能对物品和卖家做的每项检定，但不掷骰：取 `items.passiveBase`（默认为 10）加上自己的检定数值，有优势再加 5，有劣势则减 5。第一个达到某项难度的角色就会察觉：不支付任何费用，购买回复会带上 `reason="held"`，并说明谁察觉到了什么。系统会要求 GM 将其演绎为这位同伴以角色身份提醒买家，除非这位同伴的性格会如此，否则不要当面指责卖家，并让买家自行决定。不会向玩家透露其他任何信息。当天再次向该卖家提出同样的购买请求，就会正常成交。`items.warnBy: "roll"` 则改为掷这些检定。
- **识破赝品**：`items.revealsFakes` 列出角色可以对物品施用的识破赝品的方式（法术、仪式），每项包含 `id`、`label`；如果只能识破部分赝品，还需指定这些赝品带有的 `tags`，或通过引用直接指定赝品本身（`items`，只能是赝品）。直接指定赝品可以避免在它们身上加上泄露身份的标签：一瓶带有“poison”标签的毒药药水，与它所冒充的治疗药水并列时，就会暴露。`[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]` 指定其中一种方式：如果它能识破某件赝品，就会说出其真实身份；如果某件赝品的 `foolsReveal` 列出了这种方式，就会显示为它所冒充的物品；对于它无法识破的赝品或真品，则不会显出任何信息（如果这种方式能识破所有赝品，则显示“真品”，否则显示“无法确定”）。这不消耗尝试次数；施用它需要付出什么代价，与任何法术一样，都由 GM 处理。
- 使用上述任何功能的规则集都需要 Capability API 1.802。以下情况会在安装时被拒绝：在非赝品上设置赝品的 `tells` 或 `foolsReveal`；`carries` 或 `revealsFakes` 指定了不属于该规则集的物品（对于 `items`，还必须是赝品）；以及 `foolsReveal` 中的 ID 未在 `revealsFakes` 中列出。

<a id="using-items-outside-a-fight"></a>

## 在战斗外使用物品

同一个 `use` 在战斗外也有效（`restore` 需要 Capability API 1.60；其余不需要新的声明）。对带 `use` 的物品，物品栏的 **Use** 按钮和 Game Master 的 `[inventory: action="use" item="Poultice" who="Juno"]` 都会用 Engine 的骰子，对携带者产生该物品的效果：

- 治疗恢复生命：在生命池或普通生命轨道上恢复其数量，在伤势轨道上清除一个标记，与战斗中的治疗相同。`temporary` 点数加到生命池上，`restore` 恢复其池，它 `applies` 的每个状态都会施加，直到被某种东西移除。
- 造成伤害或瞄准对方阵营的使用（`kind` 为 `attack` 或 `debuff`，或 `targets` 为 `enemy`）不会作用于任何人：战斗外棋盘上没有可以打的人。物品仍会被使用，Game Master 会被告知它的作用，以便叙述。
- 它与战斗中完全一样，从那一叠中减去一件或消耗其充能；已经用完的物品，或占用槽位、需要绑定却未穿戴的物品，会被拒绝且不作任何更改。人物卡和背包会一起写入。
- `gate` 像检定一样先掷：使用规则集自己的骰子和人物卡的数字，以及使用者的伤势惩罚、其状态和穿戴或携带物品对该检定的作用。失败时物品白白用掉，那一行会说明（“Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.”）。

发生的事用一行说明：“Juno uses Poultice: heals 4 (Grit 6/11). 1 left.” Use 按钮会在 “I use my Poultice.” 之后，用 `[item_used]` 块把它发送给 Game Master，聊天会将其显示为徽章；Game Master 自己的标签也以它答复，与其他标签一样以回合开始时为基准，因此重新生成的回复绝不会把一件物品用两次。没有 `use` 的物品，或在没有规则集的游戏中，仍然只是简单地说：“I use my rope.”
