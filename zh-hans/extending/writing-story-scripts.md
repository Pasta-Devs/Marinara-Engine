# 编写 Game Mode 故事脚本

故事脚本让创作者可以掌控一局 Game Mode(游戏模式) 游戏如何展开：队伍到达某地时播放的场景、条件满足后请 Game Master(游戏主持人) 去做的事、玩家在冒险日志里跟进的目标，以及 Game Master 自己可以标记的时刻。本指南面向自己编写故事脚本的人。要游玩带故事的世界，请先阅读[创建世界](../game/getting-started.md#making-a-world)。

故事脚本是数据，不是代码，其中没有任何内容会运行。Engine 会对照它所属的世界检查它，逐回合播放，并拒绝任何不符合的内容。

## 故事存放在哪里

一个故事属于一个世界。它会指名那个世界的地点和人物，因此只有搭配它所针对的世界（种子、简述和手动编辑）才有意义。

- 在**世界文件**（`.world.json`）中，作为与 `world` 并列的顶层 `story`。不认识故事的 Engine 仍然能读取其中的世界。
- 在 Experience 的**地图包**中：每个世界文件都可以携带自己的故事，新游戏会连同地图一起采用它。见[可选智能体包](../development/optional-agent-packages.md)。
- 在保存在库中、不属于任何游戏的世界里：`GET`、`PUT` 和 `DELETE /api/game-worlds/:id/story`，用法与游戏的相同。从这个世界开始的新游戏会带上这个故事。
- 在已经开始的游戏里：`GET`、`PUT` 和 `DELETE /api/game/:chatId/story` 分别读取、保存和删除故事。保存时会对照游戏的世界检查，手动编辑也包括在内；会拿走故事所指名内容的手动编辑会被拒绝。

在新游戏的设置中，只要世界的种子和简述保持不变，从文件或地图包读入的故事就会保留。

## 结构

```json
{
  "storyVersion": 1,
  "flags": [],
  "directions": [],
  "events": [],
  "cutscenes": [],
  "fights": [],
  "endings": [],
  "knowledge": []
}
```

ID 由 1 到 40 个小写字母、数字、`_` 或 `-` 组成，在各自的列表内不得重复。一个故事最多包含 256 个标志（Capability API 1.353 之前为 64 个）、64 条指示、256 个事件（1.349 之前为 128 个）、64 个过场、32 场战斗、16 个结局和 600 条知识条目。其中任何文本都不能包含换行、方括号或 `{{`，写入标签的名称（势力、背景）也不能包含双引号：故事里的任何内容都不能被当成 Game Master 的标签。

### 标志

标志是故事保存的一个值：`"bool"`(真或假) 或 `"number"`。

```json
{ "id": "trust", "kind": "number", "initial": 0, "gm": true, "note": "How far the town trusts the party" }
```

- `gm: true` 让 Game Master 可以设置它（见 [Game Master 的标签](#the-game-masters-tags)）；`note` 告诉 Game Master 这个标志的含义。
- 标志对玩家隐藏。加上 `quest` 后，标志会在冒险日志中成为一个**任务目标**：

```json
{
  "id": "favours",
  "kind": "number",
  "initial": 0,
  "quest": { "title": "Favours", "text": "Do the town three favours", "goal": 3 }
}
```

数值型标志可以设定 `min` 和 `max`(Capability API 1.358)：每次 `set` 和 `add` 都会将值限制在此范围内，Game Master 自己的标签也一样。因此，无论多少事件给认可度加分，都能让它保持在 -10 到 10 之间。`initial` 必须在此范围内。

```json
{ "id": "approval", "kind": "number", "initial": 0, "min": -10, "max": 10, "gm": true }
```

是非型目标在其标志为真时完成；数值型目标在达到 `goal` 时完成（未指定时为 1），写明 `goal` 时，日志会显示完成进度。带 `"hidden": true` 的目标会先在日志里隐藏，直到某个事件把它显示出来。

#### 进度钟

数值型标志可以成为玩家看着逐渐填满的**进度钟**（Capability API 1.342）：一个分为 2 到 12 格的圆，每一点填一格，在游戏的 HUD 和 World 选项卡中显示，附带标题和填满时会发生的事。

```json
{
  "id": "reeve",
  "kind": "number",
  "initial": 0,
  "gm": true,
  "clock": { "title": "The Reeve's patience", "segments": 6, "full": "The Reeve sends his men." }
}
```

和普通数值型标志一样，可以设置它、增加它的值，并在条件中检查它。Game Master 每回合都会获知进度钟；进度钟填满时，还会收到一次应当引发什么的指示（由事件填满时立即告知；由它自己的标签填满时，在下一回合告知）。带 `"hidden": true` 的进度钟会隐藏，直到某个事件用 `show` 显示它。

### 指示

指示是给 Game Master 的常设指令，只要其条件成立就一直有效：

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

<a id="conditions"></a>

### 条件

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`。`if` 列表中的所有条件都必须成立。是非型标志只能用 `=` 或 `!=` 比较。

`{ "party": "<person id>", "is": "in" | "out" }` 检查世界中的某个人物现在是否随队旅行，例如故事招募的同伴（Capability API 1.349）。

`{ "partySize": { "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <1 to 32> } }` 检查队伍人数：玩家角色和所有随队旅行的同伴，不计永不参战的同伴（Capability API 1.360）。只有 Engine 知道队伍人数时，这个条件才可能成立。

`{ "any": [<condition>, <condition>, ...] }` 在其 2 到 8 个条件中任一个成立时成立（Capability API 1.358）：用一个列表表达“或”，无需写两个事件。

```json
"if": [{ "any": [{ "flag": "won_granary", "is": "=", "value": true }, { "party": "p11-3", "is": "in" }] }]
```

### 知识

人物对自己、彼此和设定的了解与说法，随故事推进而变化（Capability API 1.348）。在满足以下条件的回合，每条条目都会告知 Game Master，作为那个人物在话题相关时可以说出的内容：

- 条目的条件成立，
- 条目的 `person` 在场景中：最新回复或玩家消息提到了其名字，或其正在随队旅行，
- 如果条目有 `keys`，那里也必须出现其中一个。未指定人物的条目必须有关键词，仅靠关键词引入。

每回合最多告知 12 条。从 1.361 起，条目会排序：场景点名的人物优先，其次是由场景用词引入、未指定人物的条目，最后是仅仅随队旅行的同伴；各组内部按人物轮流分配，因此健谈的同伴不会挤掉其他人。无论场景多拥挤，随队旅行的同伴始终能分到 12 条中的两条，同样轮流分配。

```json
"knowledge": [
  { "id": "hob-self", "person": "p3-4", "text": "Hob was a miller's boy before the year stopped." },
  { "id": "hob-mill", "person": "p3-4", "if": [{ "flag": "act", "is": ">=", "value": 2 }],
    "text": "Since the second act, Hob is afraid of the mill." },
  { "id": "hob-bells", "person": "p3-4", "keys": ["bells"], "text": "Hob thinks the bells are a lie." },
  { "id": "wheel", "keys": ["mill", "millwheel"], "text": "The mill's wheel has not turned in a hundred autumns." }
]
```

一个脚本最多包含 600 条条目。每回合最多按脚本顺序告知 12 条，所以把最重要的放在前面。

### 事件

事件是会发生的事：当它的触发器触发且条件成立时，就执行它的动作。

```json
{
  "id": "gates",
  "when": { "on": "arrive", "place": "p11" },
  "if": [{ "flag": "banished", "is": "=", "value": false }],
  "do": [{ "cutscene": "gates" }, { "set": "arrived", "value": true }, { "show": "key" }]
}
```

事件只发生一次，除非带有 `"repeat": true`(`start`、`turn` 和 `day` 会忽略它)。一回合最多发生 32 个事件，每个最多一次，按脚本列出的顺序发生。

**触发器**（`when.on`），全部依据游戏已记录的内容判断：

| 触发器 | 触发时机 |
| --- | --- |
| `start` | 游戏的第一条回复时。 |
| `turn` | 在整局游戏中（跨会话累计）Game Master 的第 `turn` 条回复时或之后。 |
| `day` | 一旦世界的日期（随 Game Master 叙述的时间流逝和行走而推进）达到或超过 `day`。 |
| `arrive` | 当队伍位于 `place`(地点 ID) 或其内部的某个地点，并且是通过以下方式到达时：在那里开始游戏、在大地图上行走、在城镇里造访，或 Game Master 指名该地点。带 `repeat` 时，每次从别处回来都会再次触发。 |
| `meet` | 一旦某条回复写出了 `person`(人物 ID，例如 `p11-3`；手动添加的人物则是 `p11-e1` 这样的 ID) 的全名。带 `repeat` 时，每条写出其全名的回复都会再次触发。只读取本次会话的回复来查找名字。 |
| `deed` | 一旦世界记录了队伍的一项事迹，其类型为 `deed`，如果给出了 `place`，还须发生在该地点。带 `repeat` 时，每条记录了此类事迹的回复都会再次触发。 |
| `fight` | 当一场战斗以 `outcome` 结束时：`victory`、`defeat` 或 `flee`。带 `fight`(脚本中的一场战斗，1.358) 时，仅在指定战斗如此结束时触发：这场战斗由 Game Master 的最新回复通过故事的 `fight` 动作或它自己触发的事件发起。 |
| `leave` | 当队伍离开 `place`(地点 ID) 及其内部所有地点时（1.358）：通过最新回复或本回合中的行走、造访、Game Master 指名的地点或故事的 `move`。带 `repeat` 时，每次离开都会再次触发。 |
| `broke` | 当一场战斗打坏了名为 `prop` 的物件时（Capability API 1.316），匹配时不区分大小写。只能指定画在世界某个战场上的物件。 |
| `flags` | 当其条件成立时。带 `repeat` 时，每次条件从不成立变为成立都会再次触发。 |
| `gm` | 仅在 Game Master 触发它时（该事件需要 `"gm": true`）。 |
| `rest` | 在队伍休息过的回复之后：Game Master 的回复已执行一个 `[sheet: op="rest"]`，休息类型为 `rest` 指定的规则集休息（ID 或标签，例如 `long`），或任意休息（1.349）。 |
| `travel` | 在队伍从一地出发前往另一地的回合触发；指定时，出发地须在 `from` 内，目的地须在 `to` 内（1.349）。 |
| `idle` | 连续 `turns` 条回复无事发生之后：没有故事事件、没有行走，也没有战斗（1.349）。 |
| `step` | 当一次行走经过 `place` 中的格子 `x`、`y`(从左上角起，从 0 开始计数) 时。这个地点可以是聚落的城镇（造访时从门到门的路径），也可以是手动制作的地点地图（在地图上行走）。该格子必须是队伍能走上去的：在城镇里，须是从广场能到达的地面，且不是空闲地块，因为故事可能在空闲地块上建造；在地图上，须是从入口能到达的地面。生成的地图没有可指定的格子。带 `repeat` 时，每个行走经过该格子的回合都会再次触发。 |

会让 step 事件的格子失效的手动编辑（在上面放建筑、把地图上的地面砌成墙）在保存时会被拒绝，并指出是哪个事件。

如果一个重复的 `meet` 事件自己的场景就写出了那个人物的名字，或者一个重复的 `deed` 事件自己就做出了它所等待的事迹，它就会每回合触发自己，因此 Engine 会拒绝它。

**动作**（`do`）：

| 动作 | 作用 |
| --- | --- |
| `{ "set": "<flag>", "value": <value> }` | 设置一个标志。 |
| `{ "add": "<flag>", "amount": <number> }` | 给数值型标志加上一个数。 |
| `{ "tell": "<text>" }` | 在本回合向 Game Master 提出一次请求。 |
| `{ "cutscene": "<id>" }` | 播放一个过场。 |
| `{ "show": "<flag>" }` | 在日志中显示一个隐藏的任务目标。 |
| `{ "world": { "deed": "<kind>", "group": "...", "with": "...", "place": "<place id>", "who": "..." } }` | 在世界中记录一项事迹，处理方式与 Game Master 自己记录的事迹相同。 |
| `{ "give": { "item": "<catalog/entry or a name>", "count": 1, "who": "...", "summary": "..." } }` | 给予物品（1.343）：按 ID 指定游戏规则集中的物品，或按名称指定其他物品（用 `summary` 说明是什么），放入玩家的背包或 `who` 指定的队员背包。处理方式与 Game Master 自己给予物品相同，因此遵循物品栏规则。游戏规则集不提供的 ID 会被拒绝，原因写在回复中。 |
| `{ "fight": "<fight id>" }` | 发起脚本中的一场战斗（1.343）。Game Master 会被告知要引入这场战斗，随后战斗中的对手由故事指定。 |
| `{ "move": "<place id>" }` | 像行走一样，把队伍放到世界中的某个地点（1.343）；由此触发的 `arrive` 事件会在同一回合发生。 |
| `{ "ending": "<ending id>" }` | 以脚本中的一个结局结束游戏（1.343）：播放场景，Game Master 以尾声收束，向玩家展示结局并提供结束会话的选项。之后故事中不再发生任何事。 |
| `{ "music": "<track id>" }` or `{ "music": null }` | 用 Experience 的一首曲目覆盖地点的音乐（1.345），直到另一次切换；`null` 则交还给地点音乐。曲目必须在地图包的 `music` 中。 |
| `{ "recruit": "<person id>" }` | 让 Experience 的一个同伴加入队伍（1.347），采用其对应游戏规则集的人物卡。Game Master 会被告知要展示其加入。 |
| `{ "dismiss": "<person id>" }` | 让同伴离开队伍（1.347）。 |
| `{ "season": { "place": "<place id>", "to": "winter" } }` | 无论日期如何，将一个地点及其内部所有地点固定在某个季节（1.351）；未指定 `place` 时作用于整个世界。`"to": null` 让其恢复为脚本自身的 `seasons` 或日期对应的季节。 |
| `{ "sheet": { "condition": "<id>", "state": "on" }` or `{ "sheet": { "track": "<id>", "by": 1, "upTo": 3 } }` | 给每个队员加上人物卡状态或移除它（`"off"`），或推进每个队员人物卡上的一条轨道，到 `upTo` 停止（1.368）：例如 Rime Edge 中休息也无法治愈的寒冷，通过战斗状态带有 `cannot-heal-nonmagical` 的状态实现。Engine 自己触发时，随其写出的回复一起应用；Game Master 触发时，在标记后的下一回合应用。 |

任意动作都可以带自己的 `if`(Capability API 1.358)：事件执行到该动作时，只有条件成立才会执行，此前的动作已经生效，因此一个事件就能分支。

```json
"do": [
  { "add": "approval", "amount": 2 },
  { "tell": "Hob warms to the party.", "if": [{ "flag": "approval", "is": ">=", "value": 5 }] },
  { "tell": "Hob keeps his distance.", "if": [{ "flag": "approval", "is": "<", "value": 5 }] }
]
```

实际执行的动作会随触发记录下来，因此 `gm` 事件的场景和请求在下一回合到达时，保持 Game Master 标记该事件时实际执行的内容。

每项故事功能都需要相应的 Capability API 次版本：

- 进度钟需要 1.342；
- 战斗、结局以及 `give`、`fight`、`move` 和 `ending` 动作需要 1.343；
- 音乐切换需要 1.345；
- 招募或遣散同伴需要 1.347；
- 知识需要 1.348；
- `rest`、`travel` 和 `idle` 事件、`priority`、`party` 条件或超过 128 个事件需要 1.349；
- `seasons` 和 `season` 动作需要 1.351；
- 超过 64 个标志需要 1.353；
- 战斗的 `variants` 需要 1.356；
- `any` 条件、指定战斗的 `fight` 事件、`leave` 事件、标志的 `min` 或 `max`，以及动作或页面上的 `if` 需要 1.358；
- `partySize` 条件、面向超过 6 人的队伍或无人数上限的变体，或超过 6 个变体，需要 1.360；
- 对内部一切生效的 `over` 型 `season` 动作需要 1.361；
- `exposures` 需要 1.362；
- 战斗生物的 `adjust` 需要 1.363；
- 暴露效果的 `save` 或轨道的 `upTo` 需要 1.364；
- 暴露效果的 `sparedByShade` 需要 1.365；
- `heldGround` 需要 1.366；
- `sheet` 动作需要 1.368；
- Held Ground的 `release` 需要 1.369；
- 给予物品时列出备选项需要 1.370（从 1.370 起，单独的裸条目 ID 会从包含它的任意目录给予；旧版 Engine 会将其视为名称）；
- 战斗生物通过 `adjust` 调整 `calls` 或 `levels` 需要 1.371。

同伴是包的人物文件中被标记为同伴的人物（见[可选智能体包](../development/optional-agent-packages.md)中地图包的人物部分）。

同一回合可能发生的 `rest`、`travel` 和 `idle` 事件中，只会发生一个：`priority` 最高的那个（-100 到 100 的整数，省略时为 0；相同时取脚本中最靠前的）。这样，同伴的篝火闲谈、两名同伴在路上的争执，或同伴趁安静时来找玩家，就不会堆在一起。带 `party` 条件时，只有这些同伴随队旅行时才会出现这样的场景。从 1.349 起，一个脚本可以有 256 个事件（此前为 128 个）。

### 暴露效果

身处某个地点随着时间推移会对队伍产生什么影响（Capability API 1.362），例如在战斗之外消磨旅人的正午光照原野，其作用类似战斗中棋盘的光照规则：

```json
"exposures": [
  { "id": "noonfield", "place": "e9", "label": "Noonfield's light", "hours": 1,
    "tracks": [{ "track": "exhaustion", "by": 1 }], "applies": ["sunstruck"],
    "if": [{ "flag": "darkness_carried", "is": "=", "value": false }],
    "tell": "The light presses on them; darkness would be a mercy." }
]
```

按游戏时钟计时：队伍第一次在 `if` 成立时身处 `place`(或其内部) 的回合开始计时，此后每回合计算在此经过了多少个 `hours`。每经过一个间隔，Engine 就给每个队员按 `by` 推进 `tracks`，并施加 `applies` 中的状态；Engine 自己的人物卡命令随回复中的命令一起应用，并用 `tell` 告知 Game Master。离开地点或 `if` 不再成立就会结束计时；下次重新开始。它会在回复中记录一次（`[story: exposure=...]`）。

轨道可以设定上限（Capability API 1.364）：`{ "track": "exhaustion", "by": 1, "upTo": 3 }` 不会将其推到 3 以上，也不会改变已经超过上限的轨道。暴露效果可以要求豁免，而非影响所有人（1.364），写法与战斗棋盘的光照规则 `save`(1.321) 相同：

```json
"save": { "save": "con_save", "difficulty": 12, "against": { "conditions": ["noon_light"] } }
```

每次效果发作时，Engine 都按每个队员自己的人物卡掷该豁免，只有失败者才会受到轨道和状态影响，每人各有自己的人物卡命令。`against` 是豁免针对的东西，因此限定于它的豁免调整值在战斗之外也和战斗中一样生效：叠加层中的草帽若带有 `{ "to": "saves", "mode": "advantage", "against": { "conditions": ["noon_light"] } }`，就会给予佩戴者优势。Game Master 会获知谁豁免成功、谁失败，以及各自的总值。

带 `"sparedByShade": true`(Capability API 1.365) 时，任一队员携带并点亮的阴影光源都能阻止暴露效果，如同 `if` 不成立：即穿戴或携带的 `light` 带有 `"shade": true` 的物品（展示用例中的 Lantern of Dusk）；有开关的物品则只在开启时生效。点亮它会结束暴露效果；熄灭则重新开始计时。

### Held Ground

死亡被扣留的地方（Capability API 1.366），如展示用例中的山谷：

```json
"heldGround": [
  { "id": "valley", "place": "p0", "label": "The Held Autumn", "condition": "felled",
    "marks": [{ "track": "owing", "by": 1 }],
    "if": [{ "flag": "year_turned", "is": "=", "value": false }],
    "tell": "Nobody here has died in forty years." }
]
```

队伍在 `place`(或其内部；省略时为整个世界) 且 `if` 成立期间，在那里开始的规则集战斗会在 Held Ground 上进行（1.323）：生命降至零的人改为被放倒，退出战斗，保持稳定且不会濒死，之后还会重新站起，除非被带收割效果的东西放倒。`condition` 会施加到被放倒者身上，每个被放倒角色的 `marks` 轨道也会推进（一个 Owing 印记）。取第一条条件成立的条目。故事会记录队伍进入和离开这里（`[story: held=...]`），每次都用 `tell` 告知 Game Master；生效期间每回合都会提醒 Game Master 这意味着什么。

Held Ground 可以解除（Capability API 1.369），例如展示用例中的年岁更替。`release` 说明届时要偿还什么：

```json
"release": { "felled": "die", "owing": { "track": "owing", "bonus": { "flag": "hymn_bonus" } } }
```

`felled` 决定躺着的被放倒者会怎样：死亡（`"die"`，默认值），或倒下并按规则集自身的规则开始濒死（`"down"`）。`owing` 让每个队员按 `track` 上的每个印记，各掷一次规则集的濒死豁免（未指定轨道时，取 Held Ground 标记的第一条轨道），每次加上 `bonus`(一个数，或在解除时读取的数值型标志)，直到印记耗尽或计数已有结果；印记会被消耗，三次失败即死亡。在仍位于其上的规则集战斗中，它会在使其解除的那一步立即解除：使用物品消耗了其 `if` 读取的故事数值（1.359），或打坏物件触发了 `broke` 事件（1.316），以及由此引发的 flags 事件。被放倒者和 Owing 会在该轮按战斗自身的解除规则（1.330）结算。战斗之外，记录解除的故事回合会按每个队员自己的人物卡掷其 Owing，并告知 Game Master 谁生谁死；留在那里尚未结束的战斗会在下一步解除。战斗已结算的解除结果绝不会再掷一次。

<a id="seasons"></a>

### 季节

世界的季节按日历变化，每季 90 天。故事可以无视日期，把地点固定在某个季节（Capability API 1.351）：困在秋天的山谷、停留在冬天的山丘。

```json
"seasons": [{ "place": "p3", "season": "autumn" }, { "season": "summer" }]
```

每项固定一个地点及其内部所有地点；不带 `place` 的项固定整个世界。取最近一层被固定的地点：秋季区域内一个被固定为冬季的村庄就是冬季。`season` 动作可在游玩时改变或解除固定。带 `over`、覆盖内部一切的固定（1.361）是例外：它优先于那里的所有季节，包括脚本自身的季节和其他固定（最外层的此类固定优先），因此 `{ "season": { "to": "spring", "over": true } }` 会让整个世界同时转入春季。队伍所在地点季节被固定时，Game Master 会获知季节及其固定状态；天气按该季节生成；大地图按每格最近地点的季节绘制（使用地块包的 `<id>@<season>` 地块），城镇则按自己的季节绘制。

世界的手绘战场也可以绘制季节：每行地块对应一行 `seasons`，每格一个字母或 `.`，并用 `seasonKeys` 指定字母含义（`{ "a": "autumn", "w": "winter" }`）。留为 `.` 的地块采用战斗所在地点的季节。战斗开始时地块采用这些季节，每轮的地图事件可以改变它们，例如扩散的冰霜环或横扫而过的春季线。

### 战斗

由故事设定的战斗：与谁战斗，以及世界有为它绘制的棋盘时在哪里战斗。

```json
{
  "id": "granary",
  "name": "The Granary",
  "creatures": [
    { "creature": "creatures/scarecrow", "count": 3 },
    { "creature": "The Owed", "name": "The Owed" }
  ],
  "battlefield": "b2",
  "note": "The jars break when hit."
}
```

每个生物都来自游戏规则集的生物图鉴，按 ID(`catalog/entry`) 或名称指定，数量为 `count`(有多个时会编号)，指定 `name` 时在战斗中使用该名称。`battlefield` 是世界中的手绘棋盘（`b<n>`），无论战斗从哪里开始都用它；未指定时，和其他战斗一样在开始地点作战。`note` 告诉 Game Master 战斗如何发生。游戏规则集不含的 ID 会被拒绝：这些生物不会加入战斗，拒绝原因会被记录。若一个也没剩下，战斗仍按故事设置在其战场上开始，但敌人由 Game Master 选择。

可以为不同规模的队伍设定战斗（Capability API 1.356）。队伍包括玩家角色和所有随队旅行的同伴，不计标记为 `noncombatant` 的同伴（1.360）。

```json
"variants": [
  { "party": { "min": 3, "max": 4 }, "creatures": [{ "creature": "creatures/scarecrow", "count": 4 }] },
  { "party": 5, "creatures": [{ "creature": "creatures/scarecrow", "count": 5 }], "battlefield": "b3",
    "note": "The Owed wakes in the loft." }
]
```

采用 `party` 包含当前队伍人数的变体，使用该变体的生物，以及它指定的 `battlefield` 和 `note`(未指定时沿用战斗本身的值)。没有变体涵盖的队伍采用战斗原本的设置。任何人数都不能同时被两个变体涵盖。

战斗或变体中的生物条目可以用 `adjust` 为该战斗调整生物（Capability API 1.363），让首领随队伍变化而无需另写一个生物：`"adjust": { "legendaryResistance": 2, "maxHp": 40 }` 赋予它相应的 Legendary Resistance(传奇抗性，0 表示移除) 和生命值（用固定数值替代数值块中的生命值，包括骰子公式）。这些调整会随生物一起告知 Game Master。调整中的 `calls` 改变生物行动召来谁（Capability API 1.371）：`[{ "action": "shelves_lean", "creature": "creatures/wraith" }]`，按行动 ID 或名称指定一个召来生物的行动（1.325）。`levels` 从某个队伍等级起改变这些值，每层覆盖前一层：`"levels": [{ "from": 8, "calls": [{ "action": "shelves_lean", "creature":
"creatures/wraith" }] }]`。队伍等级是其成员达到的最高等级，从 Experience 同伴人物卡为游戏规则集指定的等级字段读取；没有该字段时，不读取 `levels`。`party` 可指定最多 32 人；不带 `max` 的范围（`{ "min": 7 }`，Capability API 1.360）涵盖从 `min` 起的所有队伍，无论多大。战斗开始时和回顾之后，Game Master 都会获知战斗是为多少人的队伍设定的。

### 结局

```json
{ "id": "kept", "title": "The Year Kept", "cutscene": "bells", "epilogue": "The valley stays held." }
```

`cutscene` 是脚本中的一个场景，在结局开始时播放；`epilogue` 是 Game Master 用来收束游戏的尾声，也是展示结局时玩家读到的内容。

### 过场

过场要么按原文原样展示给玩家，要么交给 Game Master 叙述。

```json
{
  "id": "gates",
  "kind": "pages",
  "background": "backgrounds:generated:town-gates",
  "pages": [
    { "text": "The gates creak open." },
    { "speaker": "p11-3", "expression": "happy", "text": "Welcome, travellers." },
    { "speaker": "player", "text": "We come in peace." }
  ]
}
```

`pages` 过场在 Game Master 回复之前播放，出现在旁白中，一次一页：没有说话人的页是旁白，有说话人的页是那个人物的台词，显示其在世界中的名字（`player` 则显示玩家的名字），并使用 Game Master 自己列表中的某个 `expression`(表情)。`background` 可以是游戏已有的背景，也可以写 `backgrounds:generated:<words>`，在开启图像生成时生成一张。Game Master 会被告知这个场景已经展示过，并从那里接着讲下去。

页面可以带 `if`(Capability API 1.358)：只有播放场景时条件成立才会展示，因此营地场景可以仅在各同伴随队旅行时给他们一句台词。

```json
{ "speaker": "p11-3", "text": "Another night.", "if": [{ "party": "p11-3", "is": "in" }] }
```

所有页面都被条件拦住的场景不会展示任何内容。

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

`beats` 过场由 Game Master 在当回合用自己的话逐个情节点叙述。`gm` 事件的情节点会随事件一起告知 Game Master，它会在标记该时刻的那条回复中叙述这些情节点。因此，`gm` 事件所用的 beats 场景，Game Master 从一开始就知道，即使某个 Engine 事件也会播放它。由于每回合都会告诉 Game Master 这些情节点，所有 `gm` 事件的情节点加起来不得超过 16,000 个字符。

<a id="the-intro-message"></a>

### 开场消息

`intro`(Capability API 1.339) 设置游戏如何开场，与 GM 设置为任何游戏提供的选项相同：

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"` 让游戏的第一条消息与 `text` 完全一致；Game Master 不为它写任何内容，重新生成也会得到同样的文本。`"guided"` 只影响 Game Master 所写的开场，作为它仅在第一条回复中读取的指引。`text` 为 1 到 8000 个字符，可以包含换行（这是故事中唯一可以换行的文本），但绝不能包含 `{{`；guided 文本也不能包含方括号。带 `locked` 时，玩家会在 GM 设置中看到开场消息，但无法修改；不带时，开场消息只是填入设置中的对应字段，玩家可以修改或清空。第一条回复已经写好的游戏，或沿用了之前队伍的游戏，没有开场消息。Experience 也可以在其他 GM 设置值旁指定开场消息（`contributions.gameSurface.setup.defaults.intro`，1.372）；优先读取这一项。

## 故事如何运行

每回合一次，在 Game Master 回复之前，Engine 会读取故事到目前为止已经做过的事，以及本回合带来的内容（一次行走、一次造访、一场战斗的结束），然后让事件发生。发生的内容会写在那条回复的开头：每个事件及其设置的值各记录为一个标签，原样展示的场景也写在那里。由于故事是从回复中读回的，切换备选回复或重新生成都会撤回该回复所做的事，而游戏中途修改故事也绝不会改写已经发生的事。故事会延续到游戏的下一个会话。

<a id="the-game-masters-tags"></a>

### Game Master 的标签

每回合，Game Master 都会获知故事的各项值（对玩家隐藏）和当前有效的指示。脚本的其余部分，它只会获知脚本交给它的那些：`gm` 事件（连同其 `note` 和需要随之叙述的 `beats`）和 `gm` 标志，以及其中哪些事件它现在不能标记（已完成，或被条件拦住）。它在回复中这样标记：

- `[story: event="<id>"]` 触发一个条件成立的 `gm` 事件（只触发一次，除非它会重复）。
- `[story: flag="<id>" value="<value>"]`，对数值型标志也可以用 `add="<number>"`，用于设置一个 `gm` 标志。

`gm` 事件给予的物品、发起的战斗和移动会随标签一起写入回复；其结局场景和尾声会在下一条回复的开头出现。

Engine 会就地响应每个标签，每个事件每回合最多一次，其他任何内容都会被拒绝并说明原因。在没有故事的游戏里，所有故事标签都会被拒绝。Game Master 触发的内容会立即生效（事件设置的标志、记录的事迹）；事件的场景和请求会在下一条回复的开头出现，但 `beats` 除外（Game Master 已被要求随该时刻一起叙述它们）。由于 Game Master 已经讲述了那个时刻本身，`gm` 事件的 `pages` 应写成该时刻之后发生的内容。

## 试用故事

用 `PUT /api/game/:chatId/story` 和 `{ "story": { ... } }` 把故事保存到一局游戏中：不符合的故事会被拒绝，并列出所有原因。游戏的 World(世界) 选项卡会列出故事已显示的目标和进度钟，Game Master 的提示词每回合都会带上故事的各项值和指示。
