# 规则集的层、翻译与迁移

本页是[编写 Game Mode 规则集](writing-rulesets.md)的一部分，介绍玩家为单局游戏开启的变体、规则集文本的翻译，以及人物卡变更时如何把值移到新 ID。

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
- `items` 改变东西在哪里出售、掉落什么，绝不改变有哪些东西。`market.removeSellers` 从市场中移除卖家（始终至少保留一个：没有卖家的市场允许任何人出售一切，因此会清空卖家的移除不会执行，即使是两个层共同导致的）。`market.unsold` 从每个卖家的商品中移除物品，使用与市场自身相同的筛选（追加到市场的 `unsold`）。`lootTables` 按 ID，用形状相同的表替换已有的战利品表，因此每个引用该表的生物、威胁等级和卖家的 `stock` 都会掷替换后的表；若多个启用层都替换同一张表，最后一个优先。不出售的物品仍然是物品：可以携带、使用、在战利品中找到，也可以由 Game Master 发放，卖家的 `stock` 表仍可能掷出它。

```json
"items": {
  "market": { "removeSellers": ["magic_dealer", "scribe"], "unsold": [{ "tag": "magical" }] },
  "lootTables": [{ "id": "treasure_low", "label": "Pocket treasure", "entries": [{ "coins": "sp", "weight": 1, "count": "4d6" }] }]
}
```

**层不能做什么。** 不能添加枚举值、字段、技能、池或休息，不能添加卖家或战利品表，不能改变结算类型、触及实时状态或战斗数值，也不能增加模型调用。层所_添加_的值，对人物卡的其他读取者都会是未知值，因此只能移除值。超出这份列表的内容，应当修改规则集本身，或成为第二个规则集。

**冲突。** `conflicts` 指定不能同时开启的层。只在成对关系的一侧声明就够了。向导会禁用另一个开关；如果保存的选择不知为何包含两者，就丢弃声明**较晚**的那个，因此相同的两个选择总会得到相同规则。

**已经持有被移除值的人物卡会保留它。** 不会重写角色。编辑器只是停止提供该值，而已经拥有它的角色仍按原值显示。在新游戏中关闭该层后，该值又能选择。隐藏的目录条目也一样：只从选择器中排除，玩家已经选择的行仍留在人物卡上。层所移除、但已有人携带的钱币，仍留在其背包里。

**限制。** 每个规则集最多 12 个层，每层两段指引字符串合计最多 4000 字符。声明 `layers` 或基础 `gm.worldGuidance` 的打包规则集需要 Capability API 1.25，层会移除钱币的规则集需要 1.64，层会更改其 `items` 的规则集需要 1.813。导入的规则集由读取它的 Engine 验证，因此不需要这项声明。

**其他人编写的层**(例如为不是自己编写的规则集提供独立文件的 Low Magic 层)会在以后添加。目前层随其所属规则集一起提供。

## 翻译

**译文**（Capability API 1.811）。规则集以其他语言显示的字符串，每种语言对应一份译文，像 Engine 自身的语言包一样，以语言代码命名（`ru`、`pt-BR`、`zh-Hans`）。在官方智能体目录中，每份译文都是一个语言包，与规则集文件并列（见下文）。分享的规则集包文件也可以改为把译文放在内部，每种语言一个文件，与 `ruleset.json` 并列：`locales/<language>.json`，像其他文件一样列入清单。无论采用哪种方式，每份译文都是带有 `ruleset` 部分的包本地化目录：每个键都是规则集或其目录中的一个显示字符串，必须与英文逐字一致，值则是该字符串在文件所用语言中的译文。

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

`_meta.locale` 必须是文件名指定的语言，文件只包含 `$schema`、`_meta`、`package` 和 `ruleset`，不能有其他内容，所有值都是文本。字符串留空表示尚未翻译，会显示英文；没有 `ruleset` 部分的文件（包自身的英文介绍，`locales/en.json`）不会翻译任何内容。译文只用于显示：规则、人物卡命令以及告知游戏主持人（GM）的所有内容仍读取英文。战斗界面（名称、状态、行动、法术、日志和行动顺序）中的每个字符串，如果规则集译文中有对应翻译，就以玩家的语言显示，先查找该语言自身的文件，再查找其基础语言的文件（`pt-BR` 的基础语言是 `pt`），否则显示英文；“Goblin 2”使用“Goblin”的译文并附上其数字。带有译文的包文件需要 Capability API 1.811。导入时只保留 Engine 当前设置的语言（或其基础语言）的译文，其余丢弃；要以另一种语言阅读规则集，先切换 Engine 的语言，再次导入文件，新译文会替换原先保留的译文。译文不属于版本的一部分，因此用修正后的译文再次导入相同版本，也会替换原译文；导入不带译文的同版本文件则保留已有译文。

目录中的规则集绝不能在其文件内部携带 `locales/<language>.json`（携带此文件的规则集会在下载前被拒绝）。其译文以语言包形式提供（Capability API 1.811）：每种语言一个 JSON 文件，命名为 `<id>-<version>.<language>.json`，与 `<id>-<version>.ruleset.json` 并列发布，内容与 `locales/<language>.json` 完全相同（`_meta.locale` 为文件名指定的语言，并带有 `ruleset` 部分）。目录条目将这些语言包与其 `artifact` 并列列出：

```json
"locales": {
  "ru": {
    "url": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/ember-roads-1.0.0.ru.json",
    "sha256": "<64 hex>",
    "bytes": 812345,
    "name": "Угольные дороги",
    "description": "<the store card's description in Russian>"
  }
}
```

每个语言包都是一个与产物 URL 格式相同的 https URL，以其版本和语言命名，并带有其 sha256 和大小（最多 8 MB）；一个规则集最多列出 40 个语言包，绝不能列出 `en`（规则集本身就是英文），其清单须声明 Capability API 1.811。`name` 和 `description` 是该语言的商店卡片名称和描述，因此无需获取语言包，卡片就能以 Engine 的语言显示。安装时先获取规则集文件，再只获取 Engine 当前设置的语言（或其基础语言）的语言包，检查其大小、校验和及语言，并将其与已安装版本一起保留。Engine 的语言改变时（以及每次在 Engine 中打开页面时），每个已安装且在目录中列有新语言对应语言包的规则集都会获取该语言包，并移除旧语言的语言包。无法获取语言包时（离线、未列出语言包，或获取的文件不是目录所列文件），规则集显示英文；下次安装或切换语言时会重试。更新时会保留上一版本以供回滚，但不保留其语言包：回滚后，下次切换语言时，如果目录仍列有该版本的语言包，就会再次获取。

## 把值移到新 ID：`sheet.migrations`

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
- `setColumn`(Capability API 1.794)：`{ "setColumn": { "list": "attacks", "where": { "name": ["Dagger", "Rapier"], "ability": ["str", "dex"] }, "column": "ability", "to": "finesse" } }` 会设置列表中所有符合条件的行的某一列：`where` 指定的每列都必须含有该列所列值之一（文本匹配忽略大小写和首尾空格；数字必须完全相等）。用它来修正规则集尚未完善时创建的行，例如尚不支持武器属性选择时创建的攻击行。列表及其指定的每一列都必须存在于人物卡上。
- 其他每个构建步骤都是复制：旧值仍留在原处，因此旧版本的规则集仍能像以前一样读取人物卡，步骤也从不覆盖目标中已有的值。`setColumn` 是唯一会覆盖的步骤。
- 导入会拒绝版本等于或高于 `sheet.version` 的项、来自同一版本的两项、写入人物卡没有的 ID 的步骤、列出两次的分支，以及从人物卡仍拥有的 ID 读取的 `rename` 或 `routeLive`(被移走的 ID 永远不会再被使用，这正是这些步骤可以安全重复运行的原因)。
- 人物卡在每次被读取时迁移，新布局在下一次编辑时保存。实时状态没有自己的版本，因此 `routeLive` 在每次读取时都运行：旧键会被丢弃，其值只在新键尚不存在时才移动，因此之后花掉或通过休息恢复的值永远不会被覆盖。值去了哪里，由更新后的第一次写入决定：之后被修正的人物卡（手动移动的职业等级）不会让它再次移动。新版本到来时已经在进行的战斗仍会照旧结束。
