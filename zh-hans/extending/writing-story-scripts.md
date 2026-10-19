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
  "cutscenes": []
}
```

ID 由 1 到 40 个小写字母、数字、`_` 或 `-` 组成，在各自的列表内不得重复。一个故事最多包含 64 个标志、64 条指示、128 个事件和 64 个过场。其中任何文本都不能包含换行、方括号或 `{{`，写入标签的名称（势力、背景）也不能包含双引号：故事里的任何内容都不能被当成 Game Master 的标签。

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

是非型目标在其标志为真时完成；数值型目标在达到 `goal` 时完成（未指定时为 1），写明 `goal` 时，日志会显示完成进度。带 `"hidden": true` 的目标会先在日志里隐藏，直到某个事件把它显示出来。

### 指示

指示是给 Game Master 的常设指令，只要其条件成立就一直有效：

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

### 条件

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`。`if` 列表中的所有条件都必须成立。是非型标志只能用 `=` 或 `!=` 比较。

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
| `fight` | 当一场战斗以 `outcome` 结束时：`victory`、`defeat` 或 `flee`。 |
| `broke` | 当一场战斗打坏了名为 `prop` 的物件时（Capability API 1.316），匹配时不区分大小写。只能指定画在世界某个战场上的物件。 |
| `flags` | 当其条件成立时。带 `repeat` 时，每次条件从不成立变为成立都会再次触发。 |
| `gm` | 仅在 Game Master 触发它时（该事件需要 `"gm": true`）。 |
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

故事不会发放物品、发起战斗、移动队伍或结束游戏：这些仍由 Game Master 和玩家掌控。需要时用 `tell` 请 Game Master 去做。

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

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

`beats` 过场由 Game Master 在当回合用自己的话逐个情节点叙述。`gm` 事件的情节点会随事件一起告知 Game Master，它会在标记该时刻的那条回复中叙述这些情节点。因此，`gm` 事件所用的 beats 场景，Game Master 从一开始就知道，即使某个 Engine 事件也会播放它。由于每回合都会告诉 Game Master 这些情节点，所有 `gm` 事件的情节点加起来不得超过 16,000 个字符。

### 开场消息

`intro`(Capability API 1.339) 设置游戏如何开场，与 GM 设置为任何游戏提供的选项相同：

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"` 让游戏的第一条消息与 `text` 完全一致；Game Master 不为它写任何内容，重新生成也会得到同样的文本。`"guided"` 只影响 Game Master 所写的开场，作为它仅在第一条回复中读取的指引。`text` 为 1 到 8000 个字符，可以包含换行（这是故事中唯一可以换行的文本），但绝不能包含 `{{`；guided 文本也不能包含方括号。带 `locked` 时，玩家会在 GM 设置中看到开场消息，但无法修改；不带时，开场消息只是填入设置中的对应字段，玩家可以修改或清空。第一条回复已经写好的游戏，或沿用了之前队伍的游戏，没有开场消息。

## 故事如何运行

每回合一次，在 Game Master 回复之前，Engine 会读取故事到目前为止已经做过的事，以及本回合带来的内容（一次行走、一次造访、一场战斗的结束），然后让事件发生。发生的内容会写在那条回复的开头：每个事件及其设置的值各记录为一个标签，原样展示的场景也写在那里。由于故事是从回复中读回的，切换备选回复或重新生成都会撤回该回复所做的事，而游戏中途修改故事也绝不会改写已经发生的事。故事会延续到游戏的下一个会话。

<a id="the-game-masters-tags"></a>

### Game Master 的标签

每回合，Game Master 都会获知故事的各项值（对玩家隐藏）和当前有效的指示。脚本的其余部分，它只会获知脚本交给它的那些：`gm` 事件（连同其 `note` 和需要随之叙述的 `beats`）和 `gm` 标志，以及其中哪些事件它现在不能标记（已完成，或被条件拦住）。它在回复中这样标记：

- `[story: event="<id>"]` 触发一个条件成立的 `gm` 事件（只触发一次，除非它会重复）。
- `[story: flag="<id>" value="<value>"]`，对数值型标志也可以用 `add="<number>"`，用于设置一个 `gm` 标志。

Engine 会就地响应每个标签，每个事件每回合最多一次，其他任何内容都会被拒绝并说明原因。在没有故事的游戏里，所有故事标签都会被拒绝。Game Master 触发的内容会立即生效（事件设置的标志、记录的事迹）；事件的场景和请求会在下一条回复的开头出现，但 `beats` 除外（Game Master 已被要求随该时刻一起叙述它们）。由于 Game Master 已经讲述了那个时刻本身，`gm` 事件的 `pages` 应写成该时刻之后发生的内容。

## 试用故事

用 `PUT /api/game/:chatId/story` 和 `{ "story": { ... } }` 把故事保存到一局游戏中：不符合的故事会被拒绝，并列出所有原因。游戏的 World(世界) 选项卡会列出故事已显示的目标，Game Master 的提示词每回合都会带上故事的各项值和指示。
