# 编写 Game Mode 规则集

规则集告诉 Game Mode 桌面系统如何运作：检定掷什么骰子、人物卡有哪些内容、消耗哪些资源，以及休息恢复什么。本指南面向希望自行编写并分享规则集的人。若要游玩别人制作的规则集，请先阅读[使用规则集游玩](../game/rulesets.md)。

规则集是一个 JSON 文件，是数据而非代码，其中没有任何内容会运行，因此导入不会在你的电脑上执行任何操作。导入他人的文件前，值得仔细阅读的部分是 Game Master 文本，因为每场使用该规则集的游戏都会将它发送给模型。

## 先读这里：规则集能做什么、不能做什么

规则集只能填写 Engine 已理解机制中的空项。当前 Engine 有五种检定结算方式，文件通过 `resolution.kind` 选择：

- **`dice-sum`**：掷骰，加上人物卡数值，达到或超过难度。适用于 d20、2d6 加属性等许多系统。
- **`dice-pool`**：掷出角色数值对应数量的骰子，数出达到目标的骰子。适用于评级代表一把骰子而非加值的系统。

- **`dice-highest`**：掷一个骰池并读取其中最高的一颗，或把最高的几颗相加。适用于 Blades in the Dark 和 Trophy Dark。
- **`roll-against`**：掷出不超过（或不低于）人物卡数值的结果。适用于百分制技能和 GURPS 检定。
- **`symbol-pool`**：组建并升级叙事骰，再抵消对立的符号。适用于 Genesys 检定，Capability API 1.382 起也适用于其战斗。

五种类型都在[结算类型](ruleset-checks.md#resolution-kinds)中完整说明。

不符合这些形式的机制无法写进规则集文件，对抗骰池就是一例。每种这样的机制都需要 Engine 内新增结算类型，也就是带测试的代码贡献，而非 JSON 文件。若系统需要，请在 Engine 仓库提出功能请求，用几个演算完整的掷骰例子说明机制。这些例子会成为测试。

Game Mode 可用 Marinara 自身战斗或规则集规则结算战斗。可选的 `battle` 块将人物卡数值提供给 Marinara 战斗，见[战斗桥接](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat)。可选的 `combat` 块则定义规则集如何自行结算，见[独立规则战斗](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)。Engine 目前已能执行这些规则。游戏的 Combat Preference 选择 Classic 呈现，或在规则集定义距离时选择 Tactical 战场。规则集可以用 `combat.styles` 限定其游戏可用的战斗样式（见[游戏可以使用哪些样式](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)）。

## 快速开始

1. 复制符合系统掷骰方式的示例文件。[`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) 是三个属性的小型 2d6 系统，用来说明格式不预设 d20 或六项属性。[`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) 是三个评级、六项专业技能的小型十面骰池。完整规模的例子见官方 [5e (SRD 5.1) 包](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014)：Agent Organizer(智能体管理器) 安装的就是其中的 `ruleset.json` 和 `catalogs/`。
2. 将 `id` 改为自己的值。ID 使用小写字母、数字和单个连字符，例如 `ember-roads`。
3. 编辑人物卡、休息和 Game Master 文本。
4. 导入，参见[试用规则集](#trying-your-ruleset)。导入会在保存前检查整个文件，逐行说明问题。
5. 创建新游戏，在 **Rules**(规则) 中选中规则集，实际进行几次检定。

要获得输入辅助，请在文件最外层花括号内的第一行添加以下内容，为编辑器指定 JSON Schema：

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

模式会在输入时发现键名拼写和类型错误，但无法检查名称是否指向真实存在的对象，例如技能引用的属性。这由导入完成。

你可以在文件的任何对象中添加 `"$comment": "..."` 一行作为备注。Engine 会忽略它。

## 文件组成

| 键 | 内容 |
| --- | --- |
| `schemaVersion` | 始终为 `1`。 |
| `id`, `version` | Engine 使用的规则集名称，以及每次发布修改时递增的整数。 |
| `name` | 玩家在设置向导中看到的名称。 |
| `edition` | 可选，用一行说明版本或草案。 |
| `license` | 可选，SPDX ID 和来源要求的署名文本。 |
| `coverage` | 规则集覆盖范围，以及设置向导展示的一行摘要。 |
| `resolution` | 如何掷检定或豁免。 |
| `sheet` | 人物卡中的所有内容。 |
| `rests` | 各种休息恢复和清除什么。 |
| `gm` | 给 Game Master 模型的文本，以及它能看到的各角色人物卡数值。 |
| `catalogs` | 可选，人物卡编辑器提供的现成条目，省去手动输入长列表。 |
| `items` | 可选，书写物品所用的词汇：类别、稀有度、数值、槽位和货币。 |
| `battle` | 可选，战斗可从人物卡读取什么，以及结束后写回什么。 |
| `combat` | 可选，如何按自身规则结算战斗，以及战斗界面执行什么。 |
| `layers` | 可选，玩家创建游戏时启用的规则集变体。 |

文件最大 512 KB(Capability API 1.340 之前为 256 KB)。会进入提示词的文本(名称、标签、Game Master 文本)不能包含换行、方括号或双花括号。

人物卡内的 ID(属性、技能、字段、池等)以字母开头，使用小写字母、数字和下划线，例如 `grit_max`。

## 本指南的页面

本页介绍什么是规则集、如何开始编写，以及如何试用和分享。指南的其余部分按主题分为以下页面：

- [规则集检定](ruleset-checks.md)：规则集如何掷出检定或豁免：五种结算类型、结果档、以自己的方式掷骰的检定，以及能改变掷骰的资源消费或护符
- [规则集人物卡](ruleset-sheets.md)：规则集人物卡包含什么：属性、技能、字段和列表、实时状态、伤势轨道、惩罚、休息和游戏主持人（GM）文本，以及队伍人物卡和进度时钟
- [规则集目录](ruleset-catalogs.md)：人物卡编辑器在选择器中提供的现成条目：目录头部、条目、规则集维护的值、人物卡命令和使用命令
- [规则集条目机制](ruleset-mechanics.md)：目录条目在数值上的作用：条目的 `mechanics` 块，由检定、休息和战斗读取
- [规则集角色构建器](ruleset-character-builder.md)：引导式构建器：分步创建角色，从种族和职业到分值、熟练、法术和装备
- [规则集物品](ruleset-items.md)：队伍携带什么：类别、武器、护甲、弹药、战利品、金钱、初始装备和市场
- [规则集战斗](ruleset-combat.md)：规则集如何参与战斗：`battle` 块将人物卡提供给 Marinara 的战斗系统，`combat` 块则按规则集自身的规则结算整场战斗，使用其生物图鉴、棋盘、反应和对抗
- [规则集层、翻译和迁移](ruleset-layers-and-translations.md)：玩家可为单局游戏启用的变体、规则集文本的翻译，以及人物卡变动时将值迁移到新 ID

<a id="trying-your-ruleset"></a>

## 试用你的规则集

社区规则集使用与导入智能体相同的开关。打开 **Settings**(设置) > **Advanced**(高级) > **Danger Zone**(危险区域)，确认 **Allow custom Agent imports**(允许导入自定义智能体) 已开启。导入还需要 localhost 访问，或已配置的 **Admin Access**(管理员访问)。

1. 打开 **Agents**(智能体) 面板，选择 **Import agents**(导入智能体) 按钮，即面板顶部按钮行中的下载图标。
2. 选择 **Game Mode ruleset**(Game Mode 规则集)，再选择 JSON 文件，或以 `.ruleset.json` 结尾的规则集包文件（见[分享你的规则集](#sharing-your-ruleset)）。
3. 阅读审核信息，其中包含名称、版本、许可证、规则集覆盖范围，以及 Game Master 文本。选择 **Import**(导入)。

规则集会出现在面板的 **Rules**(规则) 区域，以及新游戏设置向导的 **Rules** 选项中。文件导入的规则集归为 `local/<your id>`，因此绝不会与官方规则集或别人的规则集混淆。

### 修改已导入的规则集

已经导入的版本永不重写。如果更改文件后仍以相同 `version` 再次导入，会被拒绝，并要求提高版本号。这是有意设计的：游戏绑定创建时的精确版本，因此进行中的战役不会突然使用不同的计算方式。

所以起草时的循环是：编辑、提高 `version`、导入、开始新游戏。旧版本会与新版本并列安装，直到你从 **Rules** 区域移除规则集。移除仍被游戏使用的规则集后，该游戏会提示规则集缺失，直到再次导入。

如果改变了人物卡结构(添加、删除或重命名内容)，也请提高 `sheet.version`。现有人物卡会宽容读取：新人物卡不认识的值会保留，缺少的值使用默认值。

<a id="sharing-your-ruleset"></a>

## 分享你的规则集

**作为文件。** 将 JSON 文件发给朋友，对方按相同方式导入即可。

**作为包文件。** 太大而无法放进一个文件、目录存于各自文件中的规则集，以一个名为 `<name>.ruleset.json` 的普通 JSON 文件流转。它包含包清单和规则集的各个文档，每个都以其精确字节的 base64 形式保存：

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

清单在 `contributions.assets.paths` 和 `files` 中列出 `ruleset.json` 和每个 `catalogs/<id>.json`，并附上各自的大小和 sha256。Pixelforge 等规则集编辑器可以生成这样的文件。**Import agents** → **Game Mode ruleset** 接受该文件，并显示与规则集文件相同的审核内容，包括每个目录及其条目数。其中没有任何内容是压缩的，因此它包含的内容绝不会超过其自身大小。它作为数据读取，从不作为包安装：如果它包含其他任何东西（其他键、其他任何文件、不是严格 base64 或不是 UTF-8 文本的文档），如果其清单超出规则集所需（任何代码、权限或其他贡献），如果某个文件不是清单所列的那个，如果某个 `$comment` 超过 2,000 个字符，或 `$schema` 指向 Engine 自身结构以外的任何东西，或者规则集或某个目录无法读取，它都会被拒绝并说明原因。它像规则集文件一样归为 `local/<its id>`，最大 132 MB，最多 12 个目录文件，每个 2 MB，以及 40 份译文，每份 8 MB（见下文）。一个版本就是其规则集与目录的整体，因此目录发生变化也需要提高 `version`。规则集包不接受 zip 格式。

**通过官方智能体目录。** 发布在目录中的规则集必须是完全采用上述格式的规则集包文件 `<id>.ruleset.json`，绝不能是包 zip 文件（Capability API 1.374）。其清单声明 Capability API 1.374 或更新版本，因此旧版 Engine 不会看到它。Engine 使用与导入包文件相同的读取器和检查来读取它，核对它是否符合目录列出的清单，并像其他目录包一样安装。目录规则集的下载文件若为 zip，会在任何下载开始前被拒绝；已安装的规则集继续工作。

**通过 GitHub 仓库。** 如果将作品保存在公开 GitHub 仓库，请把每个规则集放在仓库顶层的 `rulesets` 文件夹中，每个规则集一个文件：

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

用户通过自定义智能体仓库列表添加你的仓库一次，审核内容后，便可在以后同步获取新版本。自定义仓库列表是高级功能，需要服务器运营者使用 `ENABLE_CUSTOM_AGENT_REPOS=true` 开启。仓库中的规则集归到仓库所有者名下，例如 `alice/ember-roads`，所以两个作者都能发布名为 `v20` 的规则集而不冲突。

有两项限制。仓库的 `rulesets` 目录下最多直接存放 32 个 JSON 文件，超过则拒绝该仓库。名为 `local` 的账号不能发布规则集，因为 `local/` 保留给从文件导入的规则集。

**进入官方目录。** 广泛游玩且授权明确的系统，可以通过 **Agent Organizer** (智能体管理器) 提供给所有人。这需要向 [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 仓库提交拉取请求。布局请参考其中的 `ruleset-5e-2014` 包。

## 授权许可

只发布你有权分享的规则文本。许多系统会按开放许可证发布参考文档，你可以复制的是该文档。将许可证 ID 及许可证要求的署名文本放入 `license`。不要从非开放授权的规则书复制文本。规则集主要需要名称和数值，Game Master 文本应使用你自己的措辞。

## 故障排查

- **导入提示某个名称不存在。** 文件中某处引用了未声明的 ID，例如技能引用已删除的属性。消息会给出该位置的路径。
- **导入提示同一版本已安装但内容不同。** 提高 `version` 后重新导入。
- **设置向导中没有我的规则集。** 检查 **Allow custom Agent imports** 是否开启。关闭时，导入的规则集不会提供给新游戏；已经使用它的游戏仍继续工作。
- **游戏提示规则集缺失。** 没有安装游戏创建时所用的精确版本。请重新导入该版本文件。
