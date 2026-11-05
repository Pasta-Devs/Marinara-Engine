# 正则脚本

正则脚本是一条查找替换规则，会自动改写聊天里的文字。用它可以清理 AI 的回复、重塑你自己的消息，或者改动模型收到的文字。不会写代码也能用。

Regex 是“regular expression”（正则表达式）的缩写，指一种按规则找出相符文字的搜索模式。模式只需设置一次，之后每条命中的消息都会自动套用。

示例：有些模型会用星号把动作包起来。

```text
*She smiles* Hello there.
```

原样复制这个模式：`\*([^*]+)\*`。把替换内容设为 `$1`，星号就会去掉，中间的文字保留下来：

```text
She smiles Hello there.
```

`$1` 表示“第一对圆括号捕获到的文字”。其他常见用途包括删掉圆括号里的出戏说明、屏蔽某个词，以及修正某个角色的排版怪癖。

## 新建正则脚本

你的全局脚本放在 **Presets**(预设) 面板的 **Regexes**(正则) 区块里。用顶栏的 **Presets** 按钮打开它。

### 新建正则脚本的步骤

1. 打开 **Presets**，找到 **Regexes**。
2. 点击 **Create regex**(新建正则)。完整的编辑器会打开。
3. 在顶部填一个名称。新脚本的名称是“New Regex Script”。
4. 在 **Find Pattern (Regex)**(查找模式) 中输入 `\*([^*]+)\*`(见[编辑器字段](#editor-fields))。
5. 在 **Replace With**(替换为) 中输入 `$1`。
6. 在 **Apply To**(应用于) 中保持选中 **AI Output**(AI 输出)。默认的 **Only Display**(仅显示) 应用模式是稳妥的选择（见[选择脚本在哪里生效](#choose-where-a-script-runs)）。
7. 把 `*She smiles* Hello there.` 粘贴到 **Live Test**(实时测试) 中。**Result:** 处应显示 `She smiles Hello there.`
8. 点击 **Save**(保存)。绿色的 **Saved** 提示会短暂出现。
9. 在聊天中检查：AI 回复里有星号包住的文字时，星号不再显示。

如果没有成功：**Find Pattern (Regex)** 下方的红色报错会阻止保存。说明模式无效或不安全；见[安全与性能](#safety-and-performance)。

### 管理你的脚本

**Regexes** 列表中的每一行显示脚本名称、一个 **AI** 或 **User** 标签、写成 `/pattern/flags` 形式的模式、一个启停开关（即时生效）、**Edit regex**(编辑正则)（铅笔图标）和 **Delete regex**(删除正则)（垃圾桶图标）。没有任何脚本时，列表显示“No regexes yet”。拖动行的把手可以调整执行顺序。

区块标题栏有三个图标按钮：**Create regex**、**Import regexes from JSON**(从 JSON 导入正则) 和 **Export regexes to JSON**(导出正则为 JSON)（把你所有的全局脚本保存到一个文件里）。绑定到单个角色的脚本单独存放；见[把脚本限定给一个角色](#limit-a-script-to-one-character)。

<a id="editor-fields"></a>

## 编辑器字段

### Find Pattern (Regex)

搜索模式。只写模式本身，开头和结尾都不要加斜杠。占位文字给出了一个示例：`\*([^*]+)\*`。

### Replace With

用来替换每一处命中的文字。留空就会删掉命中的内容。用 `$1`、`$2` 等复用捕获到的文字。在捕获记号前面可以使用以下大小写转换：

| 写法 | 结果 |
| --- | --- |
| `\u$1` | 把捕获内容的首字母变成大写 |
| `\U$1\E` | 把整段捕获内容变成大写 |
| `\l$1` | 把捕获内容的首字母变成小写 |
| `\L$1\E` | 把整段捕获内容变成小写 |

字面意义上的反斜杠文本，比如 `C:\Users` 这样的 Windows 路径，会按原样保留。

### Regex Flags

一组开关按钮，用来改变模式的匹配方式。新脚本开始时开启 `g` 和 `i`。

| 标志 | 含义 |
| --- | --- |
| `g` | 全局：替换每一处命中，而不只是第一处 |
| `i` | 不区分大小写 |
| `m` | 多行：`^` 和 `$` 在换行处匹配 |
| `s` | dotAll：`.` 也匹配换行符 |
| `u`, `y`, `d` | Unicode、粘连和匹配位置，用于特殊情况 |

### Trim Strings

一份可选的纯文本列表，替换完成后会把这些文字删掉。点击 **Add trim string**(添加裁剪字符串) 增加一行，点击 **X** 按钮删除一行。有些固定的文字直接打出来比用模式匹配更省事，这时就用它。

### Live Test

粘贴示例文本，结果会显示在 **Result:** 下方。Live Test 只检查查找、替换和裁剪的逻辑。生效环节、启停状态、角色范围和深度要在真实聊天中才会评估。模式、替换内容和裁剪字符串里都可以使用 `{{user}}` 和 `{{char}}` 这类宏。在 Live Test 中它们使用示例值。见[宏](../prompts/macros.md)。

<a id="choose-where-a-script-runs"></a>

## 选择脚本在哪里生效

### Apply To

**Apply To** 决定脚本盯着聊天的哪一侧。至少要保留一个选项。两个都可以选。

- **AI Output**：在 AI 回复显示之前对其生效。
- **User Input**(用户输入)：在你的消息发送之前对其生效。

### Apply Mode

**Apply Mode**(应用模式) 位于 **Advanced Options**(高级选项) 中。它决定改写改变的是什么。新脚本开始时是 **Only Display**。

- **Only Display**：改变你在聊天里看到的内容。保存的消息和模型之后的上下文保持不变。整理回复的外观时最稳妥。
- **Only Prompt**(仅提示词)：改变模型收到的内容，提示词预览里显示的也是这一份。显示内容和保存的消息保持不变。用它去掉模型老是照抄的某样东西。
- **Both**(两者)：显示内容和提示词文字都会改变。

对于你自己的消息，设为 **Only Display** 或 **Both** 的 **User Input** 脚本会在消息发送前的一刻改写它。改变的是保存和发送出去的消息，而不只是它的外观。发出的消息没有只改显示的模式。

### Execution Order 和 Depth Range

两者都在 **Advanced Options** 中。

- **Execution Order**(执行顺序) 是一个数字。数字小的先运行，当多条脚本可能命中同一段文字时，这一点很重要。新脚本开始时为 0，保存时应用会分配下一个空闲编号。你也可以在 **Regexes** 列表中拖动行。
- **Depth Range**(深度范围) 用 **Min**(最小) 和 **Max**(最大) 限定脚本往前作用多远。最新的消息是深度 0，它之前的一条是深度 1，依此类推。两者都留空就在任意深度运行。**Min** 大于 **Max** 时无法保存。

### 群聊

这适用于在 **Individual**(单独回复) 群聊模式的 **Roleplay**(角色扮演) 聊天中选择 **Only Prompt** 和 **Both** 的情况。

- 生效环节以接收提示词的角色为准。
- 你的消息和其他角色的消息算作 **User Input**。
- 正在回复的角色自己的回复算作 **AI Output**，包括同一轮群聊中较早的回复。
- 角色限制仍然决定谁会收到改写后的提示词。被排除在隐藏想法脚本之外的旁白，会保留原本的想法。

<a id="limit-a-script-to-one-character"></a>

## 把脚本限定给一个角色

脚本可以属于特定角色，而不是到处都运行。有两种做法。

- 在编辑器中，开启 **Apply To** 卡片里的 **Specific Characters**(指定角色)，并选择一个或多个角色。开关关闭时，脚本显示“Applies to all characters”。开关开启时，至少要选一个角色。
- 在角色上：打开角色，切到 **Advanced**(高级) 选项卡，找到 **Regex Scripts**(正则脚本) 卡片。它只列出该角色的脚本，并有自己的 **Create regex**、导入和导出按钮。先保存角色，否则卡片会提示暂时无法添加脚本。

从这张卡片打开完整编辑器会离开 Character Editor(角色编辑器)。如果角色有未保存的改动，应用会先提醒你。

<a id="the-per-chat-scoped-regex-scripts-setting"></a>

### 按聊天生效的 Scoped Regex Scripts 设置

角色限定脚本不会自动在每个聊天里运行。由一项按聊天的设置来控制它们。打开 **Chat Settings**(聊天设置)。只有当聊天中至少有一个角色带限定脚本时，**Scoped Regex Scripts**(限定正则脚本) 区块才会出现。

| 模式 | 效果 |
| --- | --- |
| **Disabled**(禁用)（默认） | 限定脚本关闭，只运行全局脚本。 |
| **Exclusive**(独占) | 每条限定脚本只改变它所属角色的消息。 |
| **Chat**(全聊天) | 每条限定脚本改变聊天中的每一条消息。 |

**Use preset default**(使用预设默认值) 沿用提示词预设的 **Scoped regex default**(限定正则默认模式)。选择一个模式，就会在这个聊天里覆盖它。要让新聊天一开始就使用某个模式，用以下任一方法：

- 把它设为预设的默认值。
- 把它保存进你的[默认设置方案](../chats/settings-profiles.md#choosing-the-default-profile)。
- 选好它，然后点击 **Reset View**(重置视图) 旁边的收藏布局星标（见[为新聊天选择布局](../chats/chat-settings.md#choosing-a-layout-for-new-chats)）。

模式下方，面板会列出每个角色的限定脚本，每条都有一个开关。这个开关属于脚本本身，所以会在所有聊天里改变这条脚本。模式控制的是显示侧的脚本。提示词脚本始终跟随正在生成回复的那个角色。

## 导入和替换脚本

### 从 SillyTavern 导入

Marinara 能读取打包在 SillyTavern 角色卡里的正则脚本。导入角色卡时，**Imported regex scripts**(已导入的正则脚本) 区块会提供两个选择：

- **Character only**(仅该角色)（默认）：脚本保持限定给该角色。
- **Global**(全局)：脚本加入 **Presets**，在每个聊天里运行。

单个角色的导入对话框和批量的 **Import from SillyTavern Folder**(从 SillyTavern 文件夹导入) 流程都会出现这个选择。模式为空或未通过安全检查的脚本会被跳过。要导入纯 JSON 格式的脚本文件，使用 **Regexes** 中的 **Import regexes from JSON**。见[从 SillyTavern 导入](../data/importing-from-sillytavern.md)。

### 替换正则脚本包

1. 在 **Presets → Regexes**(预设 → 正则) 中，选择 **Select regex scripts**(选择正则脚本)。
2. 勾选旧脚本包的条目，或选择 **Select all regex scripts**(选择全部正则脚本)。
3. 使用操作栏中的 **Export**(导出) 或 **Delete**(删除)。删除只会确认一次，且无法撤销。
4. 导入更新后的脚本包。

删除失败的脚本会保持选中，方便重试。未选中的脚本保留不动。预设关联仍可在正则编辑器中使用。

<a id="safety-and-performance"></a>

## 安全与性能

每条模式在保存或运行之前都会先经过检查。可能运行很慢、把应用卡住的模式会被拦下并显示这条消息，改好之前无法保存：

```text
Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns.
```

看到这条消息时，把模式改得更短、更简单。避开以下写法：

- 长度超过 1000 个字符的模式。
- 一个可重复的分组套在另一个可重复的分组里，例如 `(a+)+`。
- 两个宽泛通配写法连在一起，例如 `.*.*` 或 `\s*\w*`。宽泛通配写法指 `.*`、`\s*` 或 `\w+` 这类能匹配任意长度文字的记号。
- 同一条模式中任意位置出现三个或更多宽泛通配写法，即使中间夹着别的文字也算。

单个重复，比如 `a+` 或 `(a+)`，或者一个宽泛通配写法，比如单独一个 `.*`，都没有问题。

即使是安全的模式，在长消息上每次替换也有时间上限。如果某条脚本在一条消息上耗时太久，应用只会在这条消息上跳过该脚本。脚本保持开启，下一条消息还会再试。新模式先在 **Live Test** 中用简短的示例文本测试一遍。

## 相关指南

- [宏](../prompts/macros.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
- [从 SillyTavern 导入](../data/importing-from-sillytavern.md)
