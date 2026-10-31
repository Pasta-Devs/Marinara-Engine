# 规则集人物卡

本页是[编写 Game Mode 规则集](writing-rulesets.md)的一部分。规则集人物卡包含什么：属性、技能、字段和列表、实时状态、伤势轨道、惩罚、休息和游戏主持人（GM）文本，以及队伍人物卡和进度时钟。

## 人物卡

- `sections` 对编辑器内容分组。字段、派生值和列表用 `section` 指定自己所在的分区，属性、技能和豁免也可以这样做：编辑器、游戏内人物卡和 Game Master 的人物卡块都会在该标题下显示它们（未给它们指定分区的人物卡，显示方式与以前完全相同）。分区还可以带 `untrained` 规则（见下文）。
- `abilities` 是核心属性值。`skills` 和 `saves` 可各自指定使用的属性、`cap` 和 `untrained` 规则（见下文）。
- `fields` 是单值，类型有 `number`、`text`、`longtext`、`boolean`、`enum`(固定候选列表) 和 `dice`(如 `1d8` 的文本)。`text` 字段或列表列可以添加 `suggestions`(Capability API 1.796)：在下方以小标签提供最多 40 个词，每点一个就追加到已写的内容中，字段仍可自由输入，例如让游侠从生物类型中选择宿敌。这样的字段还可以用 `pick` 指定选择数量（Capability API 1.797），该值从人物卡读取，例如随职业等级增长的派生数量：编辑器显示“Choose N”（选择 N 个）和已选数量，选满 N 个后就不再提供更多小标签，但始终接受手动输入的内容。
- `derived` 从其他值计算，不可手动覆盖。一张人物卡最多可以有 800 个（Capability API 1.729；1.111 起为 400，1.88 起为 240，1.84 起为 120，之前为 60）；超过 240 个的包要声明 1.111，超过 400 个的包要声明 1.729。运算有 `sum`、`min`、`max`、`scale`(乘以一个固定数字并取整)、`multiply`(两到六个值相乘，例如 Constitution 调整值乘以等级；Capability API 1.82)、`stepTable`(按阈值查表，如等级对应熟练加值) 和 `enumTable`(为枚举字段或实时状态的每个值给出一个数字，见下文“实时状态”)。
- `lists` 是自定义列的表，如装备、法术或特性。一个列表最多 24 列；有列表超过 12 列的包要声明 Capability API 1.165。带 `pools` 的列表让每行成为有自身上限的资源，适用于有限使用次数的职业特性。数字列可以由掷骰填写：`"roll": { "count": 1, "sides": 8 }`，其中 `sides` 是一个数字、同一行的另一列（`{ "column": "die" }`，可以是数字列，或取值读作骰子的枚举列，如 `d8`），或人物卡上的一个值。人物卡编辑器会显示 Roll 按钮，用 Engine 自己的骰子掷出并写入总数，限制在该列的 `min` 和 `max` 之内（Capability API 1.85）。
- `live` 是游玩中变化的内容：`pools`(生命、法术位、Grit)、`tracks`(如力竭的刻度数值，或勾格子的伤势轨道)、`text`(如角色正专注什么的短备注)、`conditions` 和 `states`(从封闭集合中取一个值，如形态或姿态)。

凡是读取数字的地方都用值引用指定。它是恰好含一个键的对象，键为 `const`、`field`、`derived`、`abilityScore`、`abilityMod`、`abilityModFromField`、`skillMod`、`saveMod`、`listSum`、`livePool`、`liveTrack` 或 `itemStat`。例如，最大值来自派生值的池：`"max": { "derived": "grit_max" }`。

- `listSum` 把列表的某个数字列相加：`{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`。`onlyWhen` 可选，指定一个布尔列，只计入该列为真的行。空单元格按该列的默认值计算，被 `hideWhen` 隐藏的列表不加任何数。Ember Roads 就这样根据角色打包的装备算出 Burden，因此它永远不会像手动输入的数字那样与列表脱节。目录的缩放列不能读取列表合计，经由派生值也不行：列表里可能有缩放单元格，无论是自己的，还是反过来读取它的，重新计算将永远无法收敛。
- `livePool` 读取某个 `live.pools` 的剩余量（列表行的池不在其中）。`liveTrack` 读取某个 `live.tracks`，可选 `read`：`"value"` 是当前所处位置（默认）；`"filled"` 是高出 `min` 多少；`"remaining"` 是距离 `max` 还有多少；仅限伤势轨道的 `"penalty"` 是当前生效的惩罚。被隐藏的池或轨道读作 0。Gravewatch 的 “Harm still to take” 写作 `{ "liveTrack": "harm", "read": "remaining" }`。
- 实时读取使用掷出检定、战斗开始或写入 Game Master 人物卡块那一刻的实时状态。尚无实时状态时（人物卡编辑器、导入审核），读取游玩开始时的状态：池按其 `start` 为满或为空，轨道处于其 `default`，伤势轨道没有标记。
- 在实时状态存在之前就要算出的内容，都不能读取实时值：池或轨道的 `max`、熟练加值，以及目录的缩放列或缩放。经由读取实时值的派生值，或经由被实时值限制上限的技能，同样不行；导入会指出是哪个值这样做了。
- 这三项对打包规则集要求 Capability API 1.39。
- `itemStat` 读取角色持有的物品，例如所穿护甲的 guard，并受与实时读取相同的规则约束。见[人物卡上的物品](ruleset-items.md#items-on-the-sheet)。Capability API 1.52。

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

## 实时状态：形态、姿态、灯光

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

<a id="wound-tracks-health-that-is-a-track-not-a-number"></a>

## 伤势轨道：用轨道而非数字表示生命

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

### 编号格子代替命名等级

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

### 按格填充，以及拒绝标记的轨道

- `"fill": "indexed"` 把标记放在命令用 `box=` 指定的格子上（未指定时为第一格），或其上方下一个空格，标记一旦放下就不再移动。治疗清除最轻标记中位置最高的那一个。人物卡画面允许玩家点击任何空格。
- `"onFull": "refuse"` 在没有空格时拒绝新标记，而不是将最轻标记升级。整个命令都会被拒绝，因此只剩两个空格时，三个标记一个也不会落下。按编号填充的轨道总是拒绝；请在其旁边写上 `"onFull": "refuse"` 加以说明。

### 由列表增加的等级

在带命名等级的轨道上写 `"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }`，人物卡上的列表就能为每个角色单独延长它。每一行按顺序以其惩罚增加其计数的等级（最多 16），放在惩罚至少同样好的最后一级之后；惩罚相同时以该级命名，否则以惩罚命名。Gravewatch 的伤疤就是这样运作的。被人物卡隐藏的列表不增加任何等级；如果某行在其等级带有标记时被删除，放不下的标记会作为溢出保留：编辑人物卡不能抹消伤害。

`boxes`、`fill`、`onFull`、`extra` 以及休息步骤的 `kind`，对打包规则集要求 Capability API 1.40。

## 掷骰惩罚

`resolution.penaltyFrom` 指定伤势轨道，其惩罚应用于规则集掷出的每次检定。它需要声明而非推定，因此省略时与伤势轨道出现之前完全一样。

惩罚如何作用，由结算类型决定，与人物卡自身数字相同：

- `dice-pool` 是**从骰池减骰**，下限为自身 `pool.min`。`pool.min` 为 1 时，即使最底一档也掷一颗；`pool.min` 为 0 时则不掷骰直接失败。
- `dice-sum` 是**掷骰固定调整值**，合入属性和训练原本添加的数字。

指定的必须是伤势轨道。普通轨道没有可应用的惩罚，导入时会拒绝。结果说明用了哪个惩罚，让玩家理解为何少掷骰；Game Master 的人物卡块也显示档位及代价。

## 来自人物卡的调整值

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

## 休息

休息是恢复步骤和清除内容的列表。每步指定一个目标(`pool`、`poolGroup`、`listPools`、`track` 或 `state`)，并设置为某值(`"to": "max"`、`"to": "min"` 或数字)，或改变它(`"by": { "const": 1 }` 或 `"by": { "fractionOfMax": 0.5 }`)。指定伤势轨道的步骤只能治疗，因此其 `by` 为负数，见上文。指定实时状态的步骤只能设置它，取 `"default"` 或其某个值。带 `fractionOfMax` 的 `poolGroup` 步骤按各池自己的比例改变组内每个池；加上 `"shared": true`(Capability API 1.77) 则改为按整组的最大值计算这个比例，再按人物卡列出池的顺序分给组内各池，每个池最多补到其所缺的量。5e 的长休息恢复“角色总生命骰数的一半”，生命骰按骰子种类各存一个池，写作 `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`。

## Game Master 文本

- `checkGuidance` 替换内置的检定请求说明段落。请说明是什么系统、何时掷骰。Game Master 仅指定技能和难度，Engine 依据人物卡计算并掷骰，所以不要要求模型做算术。
- `sheetGuidance` 在提示词中介绍人物卡，用来说明重要资源及何时消耗。
- `worldGuidance` 可选，在生成世界时只读一次，让 GM 创造的背景符合规则，例如无火药、魔法稀有、死者行走。它从不进入回合提示词。
- `opposition` 指定由谁扮演战斗的另一方（Capability API 1.774）。`"game-master"` 把每个对手的回合交给游戏主持人（GM），由 GM 从 Engine 提供的选项中选择；若 GM 没有回答，则回退到 Engine 自己的选择器。它只适用于玩家已允许 GM 扮演首领的游戏，适用于所有战斗风格，包括没有 `combat` 块的规则集中的 Classic 或 Tactical 战斗。适合敌方按故事情境行动、而非按伤害总和行动的叙事系统：Fate、Blades in the Dark、Trophy、Lasers & Feelings。`"engine"` 或省略该键时，保留 Engine 的选择器，首领仍交给 GM；玩家要求时，有名字的对手和天才型对手也交给 GM。使用该键的规则集需要 Capability API 1.774。
- `sheetSummary` 选择 GM 对各角色可见的字段、派生值和列表行。Engine 始终显示属性调整值、受训练技能和豁免，以及实时数值。其余保持简短，因为每回合都会发送。摘要列表的 `nameColumn` 可以是文本列或枚举列（枚举显示其值的标签），`columns` 指定最多三个该行自身的其他列，打印在名称之后，因此人物卡块显示为 `Gear: Crowbar 1d6`，而不只有名称。布尔列为真时打印其标签。两者对打包规则集都要求 Capability API 1.37。
- 不必在 `sheetGuidance` 中教授人物卡命令。Engine 会使用文件声明的名称自行教授每条命令；规则集有伤势轨道时，它会加上用于标记轨道的 `op="damage"` 命令，并列出轨道的等级和伤害种类。规则集有实时状态时，它会加上 `op="state"` 命令，并列出每个状态可取的值。

## 完整的 GM 规则参考

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
