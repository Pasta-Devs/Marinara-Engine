# 规则集目录

本页是[编写 Game Mode 规则集](writing-rulesets.md)的一部分。人物卡编辑器在选择器中提供的现成条目：目录头部、条目、规则集维护的值、人物卡命令和使用命令。

逐行输入法术列表、装备表或整页职业特性很费力。目录是随规则集提供的具名现成条目集合。人物卡编辑器在目录供给的每个列表提供选择器，选中一个就填好对应行。

目录可选，规则集最多十二个。Engine 不知道它们各自关于什么；每个 ID、列、筛选条件和词语都来自文件。

## 头部

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
- `holds`：取 `"rows"`(默认，也是本次发布前全部目录的形式)、`"creatures"` 或 `"items"`。生物目录是战斗读取的图鉴，物品目录则列出队伍携带的东西。两者都不写人物卡、不声明 `feeds`，也从不出现在选择器。见下方[生物](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)和[物品](ruleset-items.md)。
- `feeds`：该目录条目可写入的一到八个人物卡列表。行目录必填，生物目录和物品目录禁止。条目不能写入未列出的列表，也不能写入列无法容纳的值。
- `filters`：可选，最多八个，说明选择器可按什么缩小范围。筛选项为 `number`、`text` 或 `tags`(多个词)。`startFrom` 指定选择器打开时使用的人物卡字段，所以 Calling 为 Tinker 的角色先看到 Tinker 条目。
- `units`：可选，说明条目 `mechanics` 块中的射程或区域尺寸在系统中代表什么。

## 条目

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

## 一个条目，多个列表

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

## 规则集持续更新的值

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

## 选中的行是副本

每个选中行复制到人物卡时，会增加 `_catalog` 键，保存 `<catalog id>/<entry id>`。列 ID 始终以字母开头，因此该键绝不会是你自定义的列。

副本属于角色。玩家之后可编辑任何部分，未安装规则集时人物卡仍可用，发布新版也绝不会重写任何人的角色。选择器读取此标记以显示人物卡已有内容，下方 Refresh 也读取它。

## 从规则集刷新

选中行保留标记，因此人物卡编辑器能在新文本与现有行不同时提醒玩家。列表下方简短说明有多少行更新，**Review**(检查) 按钮逐项并列显示人物卡和规则集内容，每行有勾选项。玩家点击 **Update selected**(更新所选) 前不会写入，而且只写入勾选行中不同的列。其余内容全部保留，包括标记。

比较范围有意保持狭窄：

- 只比较 `text`、`longtext`、`dice` 和 `enum` 列的现有值。已有的 `number` 和 `boolean` 值属于玩家，包括 0 和 false 在内都会保留。对于行中尚不存在的列，可以提议加入符合类型的值，包括数字和开关。随人物卡缩放的列不参与比较，因为它已经跟随人物卡变化。
- 只涉及条目设置的列。条目未填写的列始终不会改动，无论人物卡中存了什么。
- 列本身会拒绝的值，例如已不再提供的 `enum` 选项或超过 `maxLength` 的文本，会跳过，不会写入。
- 在该列表中携带同一标记的各行之间，按位置将人物卡行匹配到它源自的条目行。只要人物卡中这些行的数量仍等于条目写入的数量，这种匹配就成立。否则，只有条目向该列表写入单行时才能匹配。如果玩家删除了双行条目中的一行，就保留该条目不动，不去猜测。
- 如果行所属的条目已不在目录中，该行会静默保留原状。

因此，修改条目措辞或名称可以触达已经选择它的角色，前提是玩家接受。改变数字的含义则不能、也不会这样传播：行归玩家所有之后，那一列也就属于玩家。

## 人物卡命令：永久成长

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

<a id="the-use-command-letting-the-game-master-spend-a-price-you-wrote"></a>

## `use` 命令：让 Game Master 支付你写下的费用

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

## 内联或独立文件

小目录内联放在 `ruleset.json` 头部的 `entries` 中。长目录存于独立文件，头部改用 `asset` 指向它。每个目录必须且只能选其中一种。

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

路径始终是 `catalogs/<the catalog's id>.json`。文件本身如下：

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

独立目录文件随包提供：通过官方目录发布的包，或你自己导入的规则集包文件（见[分享你的规则集](writing-rulesets.md#sharing-your-ruleset)）。包在 `contributions.assets.paths` 中将该文件与 `ruleset.json` 一同列出，并且需要 Capability API 1.21。生物目录无论内联还是独立文件，都需要 Capability API 1.27，物品目录需要 1.49。**以单个文件导入或通过 GitHub 仓库分享的规则集，必须内联携带目录**，所以目录也得装进整个规则集文件 512 KB 的限制内。这大约能容纳数百个短条目。

限制为每个规则集 12 个目录、无论哪种方式每个目录 2000 个条目、每个目录文件 2 MB。`ruleset.json` 超过 256 KB、或有目录文件超过 1 MB 的包，需要 Capability API 1.340，正是它提高了这两项限制。
