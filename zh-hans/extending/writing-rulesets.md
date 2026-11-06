# 编写 Game Mode 规则集

规则集告诉 Game Mode 一套桌面系统如何运作：检定掷什么骰子、人物卡上有什么、消耗哪些资源，以及休息恢复什么。编写规则集，就能把你自己的系统带进 Game Mode 并分享出去。若要用别人制作的规则集游玩，见[使用规则集游玩](../game/rulesets.md)。

规则集是一个 JSON 文件。它是数据而不是代码，所以其中没有任何内容会运行，导入它也不会损害你的电脑。导入别人的文件之前，先读一读其中的 Game Master 文本，因为每场使用该规则集的游戏都会把这段文本发送给模型。

## 开始编写规则集

1. 复制与你的系统掷骰方式相符的示例文件：
   - [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) 是一个有三项属性的小型 2d6 系统。它说明格式中没有任何内容预设 d20 或六项属性。
   - [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) 是一个有三个评级和六项专业技能的小型十面骰池系统。
   - 官方 [5e (SRD 5.1) 包](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014)，一个完整规模的例子。Agent Organizer(智能体管理器) 安装的就是其中的 `ruleset.json` 和 `catalogs/`。
2. 把 `id` 改成你自己的。ID 由小写字母、数字和单个连字符组成，例如 `ember-roads`。
3. 用记事本或 VS Code 等文本编辑器打开你的副本，并以 `.json` 结尾保存。先改 `name`，再改 `sheet` 里的属性名称，然后改 `rests` 和 `gm` 文本。[文件组成](#parts-of-the-file)列出了每个键，[参考页面](#reference-pages)链接到讲解这些键的页面。
4. 导入它（见[试用你的规则集](#try-your-ruleset)）。导入会在保存任何内容之前检查整个文件，并逐行报告问题。
5. 创建新游戏（见 [Game Mode：入门](../game/getting-started.md)），在 **Rules**(规则) 下选中你的规则集，然后进行几次检定。

如果没有成功，见[故障排查](#troubleshooting)。

要在输入时获得编辑器的辅助，在文件最外层花括号内的第一行加上下面这行。它为编辑器指定 JSON Schema：

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

Schema 能发现拼错的键名和错误的类型，但无法检查名称是否指向真实存在的东西，例如技能所引用的属性。这一点由导入来检查。你可以在任何对象里加一行 `"$comment": "..."`，给自己留个备注。Engine 会忽略它。

## 规则集能做什么、不能做什么

规则集填写的是 Engine 已知机制中的空项。Engine 有五种结算检定的方式，你的文件用 `resolution.kind` 选择其中一种：

- **`dice-sum`**：掷骰，加上人物卡上的数值，达到或超过难度。适用于 d20 系统、2d6 加属性的系统以及许多其他系统。
- **`dice-pool`**：掷出与角色数值相同数量的骰子，数出达到目标的骰子。适用于评级代表一把骰子而不是加值的系统。
- **`dice-highest`**：掷一个骰池并读取其中最高的一颗，或把最高的几颗相加。适用于 Blades in the Dark 和 Trophy Dark。
- **`roll-against`**：掷出不超过（或不低于）人物卡数值的结果。适用于百分制技能和 GURPS 检定。
- **`symbol-pool`**：组建并升级叙事骰，再抵消对立的符号。适用于 Genesys 检定，Capability API 1.382 起也适用于其战斗。

五种类型都在[结算类型](ruleset-checks.md#resolution-kinds)中完整说明。

不符合这些形式的机制（例如对抗骰池）无法写进规则集文件。它需要在 Engine 内新增一种结算类型，也就是一项带测试的代码贡献。如果你的系统需要这样的机制，就在 Engine 仓库提出功能请求，用几个演算完整的掷骰例子描述该机制。这些掷骰例子会成为测试。

Game Mode 用 Marinara 自身的战斗或你的规则集的规则来结算战斗。可选的 `battle` 块把你人物卡上的数值提供给 Marinara 的战斗，见[战斗桥接](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat)。可选的 `combat` 块则定义规则集如何自行结算战斗，见[独立规则战斗](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)。游戏的 Combat Preference 选择 Turn-Based 呈现，或者在规则集定义了距离时选择 Tactical 战场。规则集可以用 `combat.styles` 限定其游戏可用哪些样式（见[游戏可以使用哪些样式](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)）。

<a id="parts-of-the-file"></a>

## 文件组成

| 键 | 内容 |
| --- | --- |
| `schemaVersion` | 始终为 `1`。 |
| `id`, `version` | Engine 使用的规则集名称，以及每次发布修改时都要递增的整数。 |
| `name` | 玩家在设置向导中看到的名称。 |
| `edition` | 可选，用一行说明这是哪个版本或草案。 |
| `license` | 可选，SPDX ID 和来源要求的署名文本。 |
| `coverage` | 规则集负责处理的内容，以及设置向导中显示的一行摘要。 |
| `resolution` | 如何掷检定或豁免。 |
| `sheet` | 人物卡上的所有内容。 |
| `rests` | 每种休息恢复和清除什么。 |
| `gm` | 给 Game Master 模型的文本，以及它能看到每个角色的哪些人物卡数值。 |
| `catalogs` | 可选，人物卡编辑器提供的现成条目，免得玩家手动输入长列表。 |
| `items` | 可选，书写物品所用的词汇：类别、稀有度、数值、槽位和货币。 |
| `battle` | 可选，战斗可以从人物卡读取什么，以及结束后写回什么。 |
| `combat` | 可选，如何按你自己的规则结算战斗，以及战斗界面随后呈现什么。 |
| `layers` | 可选，玩家创建游戏时开启的规则集变体。 |

文件最大 512 KB(Capability API 1.340 之前为 256 KB)。会进入提示词的文本（名称、标签、Game Master 文本）不能包含换行、方括号或双花括号。

人物卡内的 ID(属性、技能、字段、池等)由小写字母、数字和下划线组成，以字母开头，例如 `grit_max`。

<a id="reference-pages"></a>

## 参考页面

本页介绍如何开始编写、试用和分享规则集。其他页面各讲一个主题：

- [规则集检定](ruleset-checks.md)：五种结算类型、结果档、以自己的方式掷骰的检定，以及能改变掷骰的资源消费或护符。
- [规则集人物卡](ruleset-sheets.md)：属性、技能、字段和列表、实时状态、伤势轨道、惩罚、休息、Game Master 文本、队伍人物卡和进度时钟。
- [规则集目录](ruleset-catalogs.md)：人物卡编辑器在选择器中提供的现成条目。
- [规则集条目机制](ruleset-mechanics.md)：目录条目的 `mechanics` 块，由检定、休息和战斗读取。
- [规则集角色构建器](ruleset-character-builder.md)：分步创建角色，从种族和职业到分值、熟练、法术和装备。
- [规则集物品](ruleset-items.md)：类别、武器、护甲、弹药、战利品、金钱、初始装备和市场。
- [规则集战斗](ruleset-combat.md)：`battle` 块和 `combat` 块，以及生物图鉴、棋盘、反应和对抗。
- [规则集的层、翻译与迁移](ruleset-layers-and-translations.md)：玩家为单局游戏开启的变体、翻译，以及人物卡变更时把值移到新 ID。

<a id="try-your-ruleset"></a>

## 试用你的规则集

开始之前，先在 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域) 下开启 **Allow custom Agent imports**(允许导入自定义智能体)。导入的规则集与导入的智能体使用同一个安全开关，所以在你开启之前它一直是关闭的。导入还需要 localhost 访问或管理员密钥（**Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问)）。

1. 打开 **Agents**(智能体) 面板，选择 **Import agents**(导入智能体) 按钮（面板顶部按钮行中的下载图标）。
2. 选择 **Game Mode ruleset**(Game Mode 规则集)，再选择你的 JSON 文件，或以 `.ruleset.json` 结尾的规则集包文件（见[分享你的规则集](#sharing-your-ruleset)）。
3. 阅读审核信息。其中显示名称、版本、许可证、规则集覆盖的内容和 Game Master 文本。选择 **Import**(导入)。

你的规则集会出现在面板的 **Rules** 区域，以及新游戏设置向导的 **Rules** 选项中。从文件导入的规则集归为 `local/<your id>`，因此绝不会与官方规则集或别人的规则集混淆。

### 修改已导入的规则集

已导入的版本永远不会被重写。如果你以相同的 `version` 导入修改过的文件，导入会被拒绝，并要求你提高版本号。游戏绑定在它创建时的确切版本上，所以进行中的战役绝不会改变计算方式。

起草期间的循环是：编辑、提高 `version`、导入、开始新游戏。旧版本会与新版本并列安装，直到你从 **Rules** 区域移除该规则集。移除仍被某个游戏使用的规则集后，该游戏会提示规则集缺失，直到你再次导入。

如果你改变了人物卡的结构（添加、删除或重命名内容），也要提高 `sheet.version`。现有人物卡会被宽容地读取：新人物卡不认识的值会保留，缺少的值使用默认值。

<a id="sharing-your-ruleset"></a>

## 分享你的规则集

有五种分享方式。

### 作为文件

把 JSON 文件发给朋友，对方按你的方式导入即可。

### 作为包文件

放不进一个文件、目录各自存放在单独文件里的规则集，以一个名为 `<name>.ruleset.json` 的普通 JSON 文件流转。它包含包清单和规则集的各个文档，每个文档都存储为 base64(一种把文件写成纯文本的方式)：

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

清单在 `contributions.assets.paths` 和 `files` 中列出 `ruleset.json` 和每个 `catalogs/<id>.json`，并附上各自的大小和 sha256(文件的指纹)。Pixelforge 等规则集编辑器可以生成这样的文件。**Import agents** → **Game Mode ruleset** 接受该文件，并显示与规则集文件相同的审核内容，还会列出每个目录及其条目数。

该文件作为数据读取，从不作为包安装。其中没有任何内容经过压缩，所以它包含的内容绝不会超过其自身大小。限制如下：

- 它像规则集文件一样归为 `local/<its id>`。
- 它最大 132 MB，最多 12 个目录文件，每个 2 MB，以及 40 份译文，每份 8 MB(见下文)。
- 一个版本就是其规则集与目录的整体，所以目录有改动也需要提高 `version`。
- 规则集包不接受 zip 格式。

出现以下情况时，它会被拒绝并说明原因：

- 包含其他键或任何其他文件，或者有文档不是严格的 base64 或不是 UTF-8 文本
- 其清单要求的超出规则集所需（任何代码、权限或其他贡献）
- 某个文件不是清单所列的那个
- 某个 `$comment` 超过 2,000 个字符，或者 `$schema` 指向 Engine 自己的 Schema 以外的任何东西
- 规则集或某个目录无法读取

### 通过官方智能体目录

发布在目录中的规则集是完全采用上述格式的规则集包文件 `<id>.ruleset.json`，绝不是包 zip 文件。其清单声明 Capability API 1.374 或更新版本，因此旧版 Engine 永远不会收到它。Engine 用与你导入的包文件相同的读取器和检查来读取它，要求它符合目录列出的清单，并像其他目录包一样安装它。目录规则集的产物若是 zip，会在下载任何内容之前被拒绝；已安装的规则集继续正常工作。

### 通过 GitHub 仓库

如果你把作品保存在公开的 GitHub 仓库里，就把每个规则集放在仓库顶层的 `rulesets` 文件夹中，每个规则集一个文件：

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

用户只需添加一次你的仓库，审核其中的内容，之后同步即可获取新版本。自定义仓库列表是一项高级功能。运行服务器的人用 `ENABLE_CUSTOM_AGENT_REPOS=true` 开启它，然后打开 **Agents → Agent Organizer → Custom Sources**(智能体 → 智能体管理器 → 自定义来源)。来自仓库的规则集归在仓库所有者名下，例如 `alice/ember-roads`，所以两位作者都能发布名为 `v20` 的规则集而不会冲突。

有两项限制。仓库的 `rulesets` 中最多直接存放 32 个 JSON 文件，超过就会拒绝该仓库。名为 `local` 的账号不能发布规则集，因为 `local/` 保留给从文件导入的规则集。

### 进入官方目录

游玩广泛、授权清晰的系统，可以通过 **Agent Organizer** 提供给所有人。要提议加入一个系统，就向 [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 仓库提交拉取请求。布局可以参考该仓库里的 `ruleset-5e-2014` 包。

## 授权许可

只发布你有权分享的规则文本。许多系统会以开放许可证发布一份参考文档，你可以复制的就是这份文档。把许可证 ID(SPDX ID，即 `CC-BY-4.0` 这样简短的标准名称) 和许可证要求的署名文本放进 `license`。不要从未采用开放许可的规则书复制文本。规则集主要需要的是名称和数值。Game Master 文本请用你自己的话来写。

<a id="troubleshooting"></a>

## 故障排查

- **导入提示某个名称不存在。** 文件中某处引用了未声明的 ID，例如技能引用了你已删除的属性。消息会给出该行的路径。
- **导入提示某个版本已安装，但内容不同。** 提高 `version` 后重新导入。
- **设置向导中没有我的规则集。** 检查 **Allow custom Agent imports** 是否已开启。它关闭时，导入的规则集不会出现在新游戏中，已经使用它的游戏则继续正常工作。
- **游戏提示规则集缺失。** 游戏创建时所用的确切版本没有安装。请重新导入该版本的文件。
