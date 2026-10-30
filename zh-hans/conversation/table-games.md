# Conversation 桌游

本指南介绍 Conversation(对话模式) 里可以和聊天中的角色对玩的 6 个可选桌游包：**UNO**、**Chess**(国际象棋)、**Poker**(扑克)、**8-Ball Pool**(美式八球)、**Tic-Tac-Toe**(井字棋) 和 **Rock-Paper-Scissors**(石头剪刀布)。内容包括怎么开一局、每个设置项分别是什么意思，也会讲每种棋盘怎么玩，以及怎么让角色自己发起游戏。

## 桌游是什么

桌游就是直接在 Conversation 模式聊天里跑起来的小型桌面游戏。Marinara Engine 负责发牌或摆好棋盘，全部规则也由它来执行。每个上桌的角色都会用自己的口吻讲述自己的行动。游戏进行时，消息框上方会显示一块实时棋盘。

想玩哪个游戏，就去 **Agents → Agent Organizer(智能体管理器)** 里安装。装好立刻能用，不用重启 Marinara。没安装的游戏不会出现在游戏选择器里，斜杠命令用不了，对应的角色命令设置也不会显示出来。

有两点要注意：

- 桌游只能在 Conversation 模式里玩，Roleplay(角色扮演) 和 Game Mode(游戏模式) 的聊天里开不了。在 Roleplay 聊天里输入游戏命令，会看到类似“UNO can only be played in conversation chats.”的提示。
- 每个聊天同一时间只能有一局游戏。开新局会顶掉这个聊天里已有的游戏，哪怕那一局早已结束、只剩结算横幅挂在那里。

聊天里还必须至少有一个角色，而且至少要让其中一个角色上桌，才能发牌或开局。角色的落子和台词走的连接，和平时的聊天回复完全一样，不需要额外的账号或 API 密钥。**API key**(API 密钥) 就是让 Marinara 能和 AI 服务商通信的一串秘密字符。

## 开一局游戏

开局有 3 种方式，都只在至少有一个角色的 Conversation 模式聊天里有效。

### 输入斜杠命令

**斜杠命令**是在消息框里输入的一条简短指令，以正斜杠开头。输入下面任意一条并按 Enter，就会打开对应游戏的设置窗口：

- **/uno** 用这个聊天里的角色开一局 UNO。
- **/chess** 和这个聊天里的一个角色下一盘一对一的国际象棋。
- **/poker** 用这个聊天里的角色开一局德州扑克。
- **/8ball**(或 **/pool**) 和这个聊天里的一个角色打一场一对一的美式八球。
- **/tictactoe**(或 **/ttt**) 和这个聊天里的一个角色下一局一对一的井字棋。
- **/rps** 和这个聊天里的一个角色打一场一对一的石头剪刀布。

### 在聊天里直接说

也可以在普通消息里随口一提。像“let's play uno”、“start a game of chess”或“deal me into poker”这样的消息，会自动打开对应游戏的设置窗口。消息本身照常发出去，所以角色可以在同一条回复里回应你的邀约。只有该游戏还没在这个聊天里进行时，才会这样触发。

### 让角色邀请你

角色可以自己提出玩一局，也可以答应你的邀请。角色当下愿意玩的时候，它的回复会直接按这个聊天的默认规则开局，不弹设置窗口。角色正忙或者不想玩，就会用自己的口吻直接说出来。

要走这条路径，聊天的 **Commands**(命令) 设置必须开着，对应游戏自己的开关也要开着。见下文“让角色自己发起游戏”。

## UNO

### 设置 UNO

设置窗口的标题是 **Start UNO**。

在 **Players**(玩家) 部分勾选想让哪些角色上桌。聊天里的角色默认全部勾选。**You go first** 复选框默认勾选，让你先手。聊天里没有角色时，这一区显示“Add at least one character to this chat to play.”

**House rules**(自定规则) 部分是可选规则，默认全部关闭，想开哪条开哪条：

| 规则 | 作用 |
|---|---|
| **Stacking** | 把 +2/+4 叠给下一位玩家，不用自己摸牌。 |
| **Draw to match** | 一直摸牌，直到摸到一张能出的牌。 |
| **7-0 rule** | 出 7 时和选定的玩家交换手牌，出 0 时所有人的手牌轮转。 |
| **Jump-in** | 手里有一模一样的牌时可以抢出，不必等到自己的回合。 |
| **Force play** | 摸到的牌只要能出，就必须出。 |

规则下方的 **Starting hand**(起手牌数) 决定每位玩家的起手张数，默认 **7**，可选 1 到 10 之间的任意值。**Penalize missed UNO** 复选框默认勾选。开启时，只剩一张牌却没喊 UNO 的玩家被抓到要摸 2 张牌，“Catch!”机制同时生效；关闭时没有任何惩罚。

点击 **Cancel** 关闭窗口，点击 **Deal** 开局。Deal 按钮上会显示总座位数，比如你加两个角色就是 **Deal (3p)**。至少选中一个角色之前，这个按钮一直是禁用的。UNO 一桌总共可坐 2 到 10 位玩家。

### 玩 UNO 的牌桌

牌桌出现在消息框上方，标题是 **UNO**。上面显示当前颜色，以及一个方向箭头，出 Reverse 时箭头会反向。摸牌堆张数以“Draw pile: N”显示，累积了罚摸时旁边会多一个“+N”角标。轮到你时，回合行显示“Your turn”，否则显示当前角色的名字。

座位按出牌顺序排列。你的座位标着“(you)”，下一个行动的座位标着“next”，手牌只剩一张的座位会显示“UNO?”对手只剩一张牌却没喊 UNO 时，会出现一个 **Catch!** 按钮，让你当场抓他。这个按钮只在 **Penalize missed UNO** 规则开启时才有。

你的手牌是一张张可点击的卡片。能出的牌会抬起并高亮，其余的变暗。点击万能牌会打开“Pick a color:”选色器。开启 **7-0 rule** 后，点击 7 会打开“Swap hands with:”选人器。需要时还会冒出额外按钮，比如 **Draw**、**Pass**，以及必须报牌时高亮的 **Call UNO!**。出倒数第二张牌时会顺带替你喊出 UNO，所以那一瞬间没有角色能抓到你。

一局结束时，横幅显示“{winner} wins!”；分不出明确赢家时显示“Game over”。

## Chess

### 设置 Chess

设置窗口的标题是 **Start Chess**。国际象棋永远是一对一，正好两个座位。

在 **Opponent**(对手) 部分用单选按钮挑一个角色，默认选中第一个角色。就算在群聊里，也只有一个角色作为对手入座，其他角色照常聊天。

在 **Your color**(执子颜色) 部分选择 **White**、**Random** 或 **Black**，默认是 **Random**。旁边有一句说明“White moves first.”

点击 **Cancel** 关闭窗口，点击 **Start game** 开局。

### 玩 Chess 的棋盘

棋盘标题是 **Chess**，8x8 格，棋子是手绘风格。每一方的信息条显示自己吃掉的对方棋子，以及“+N”的子力领先。轮到你时回合行显示“Your turn”，轮到角色时显示角色的名字。你被将军时，回合行还会加上一句警示。

点击自己的棋子选中它。合法着法会在空格上显示一个圆点，在能吃子的格子上显示一个圆环。上一步棋和将军状态都会高亮，棋盘边缘标着行列坐标。执黑时棋盘会翻转，让你这一方坐在下方。兵走到底线会打开“Promote to:”选择器，可选 Queen、Rook、Bishop 和 Knight。

对局结束时，横幅会宣布将杀获胜的一方、和棋及其原因（比如逼和或五十步规则），或者显示“Game over”。棋盘下方还有一条简短的着法历史，用标准记谱法列出最近几步。

## Poker

### 设置 Poker

设置窗口的标题是 **Start Poker**。牌桌可坐 2 到 8 位玩家，也就是你加上最多 7 个角色。

在 **Players** 部分勾选要入座的角色。勾满 7 个之后，其余的会变灰。旁边有一句说明“8 seats max (you + up to 7 characters).”

**Dealer**(荷官) 部分是一个下拉菜单，默认是 **House dealer (silent)**，只发牌不解说。也可以改选任意一个角色，用自己的口吻报出牌型、翻牌和摊牌。两种方式发牌都同样公平，而且荷官不必是入座的玩家。

**Stakes**(筹码设置) 部分有 4 个数字输入框：

| 设置项 | 默认值 | 说明 |
|---|---|---|
| **Starting stack** | **1000** | 每位玩家的起始筹码（100 到 1,000,000）。 |
| **Small blind** | **10** | 大盲注永远是它的两倍。 |
| **Blinds double every** | **0** | 每隔多少手加一次盲注，0 表示永不加。 |
| **Hand limit** | **0** | 0 表示一直打到只剩一位玩家还有筹码。 |

设置了 **Hand limit** 之后，打满这么多手牌就结束整场会话，筹码最多的玩家获胜。

点击 **Cancel** 关闭窗口，点击 **Deal** 开局。Deal 按钮上会显示座位数，比如 **Deal (4p)**。

### 玩 Poker 的牌桌

牌桌顶部显示当前手数、街和盲注，以及底池总额。回合行显示“Your turn”或当前角色的名字。座位上方是 5 个公共牌位。

每个座位显示玩家名字，你的座位带“(you)”，庄家位有“D”角标，盲注位有“SB”或“BB”。座位上还会显示筹码数和状态，比如当前下注额、“folded”、“all in”或“busted”。你自己的两张底牌放大显示在“Your hand”下方。凑成牌型之后，旁边会用大白话标出来，比如“Full house, kings over nines”。

轮到你时，操作栏提供 **Fold**、**Check**、**Call** 和高亮的 **All in**。能下注或加注时，会出现一个下注框，带 **Min**、**½ pot**、**Pot**、**All-in** 快捷按钮和一个提交按钮。

每手牌结束时，**Showdown** 面板会亮牌并分配底池，**Next hand** 按钮开始下一手。整场会话结束时，横幅会公布本场赢家，并列出每个座位的最终筹码数。

## 8-Ball Pool

### 设置 8-Ball Pool

设置窗口的标题是 **Start 8-Ball Pool**。台球是一对一，对手只有一个角色。

- **Opponent**：选择和你对局的角色。
- **Announcer**(解说)：可选，默认是 **Silent (no announcer)**。选一个角色，用自己的口吻解说每一杆。
- **Match length**(赛制)：**Race to 1**、**Race to 3** 或 **Race to 5**，也就是拿下整场比赛需要赢几盘。一盘就是一整局台球。
- **Who breaks first**(谁先开球)：**You**、**Random** 或 **Them**。旁边有一句说明“Later racks alternate the break.”

点击 **Start game** 开局。摆球期间按钮显示“Racking up...”

### 玩 8-Ball Pool 的球台

界面是一张俯视视角的台球桌，每颗球的位置都是真实的。轮到你时，回合行显示“Your turn”；轮到角色时，显示角色的名字加上“is thinking...”击球的方式是从推荐的几种打法里挑一种，然后球会按物理模拟在台面上滚动。球台下方有一行文字描述上一杆，两盘之间则显示“Rack over.”

## Tic-Tac-Toe

井字棋是一对一。设置里选择对手，以及你执 **X**、**O** 还是随机一方。X 先手。轮到你时点击一个空格。Marinara 会拦下不合法的走法，用角色的口吻向它要下一步，并自动判定胜负和平局。

## Rock-Paper-Scissors

石头剪刀布是一对一。设置里选择对手，以及三局两胜、五局三胜还是七局四胜。每一轮选 **Rock**、**Paper** 或 **Scissors**。双方都出手之前，对手的选择一直隐藏，之后 Marinara 揭晓结果并更新比分。

## 提前结束一局

每块棋盘都有一个提前结束游戏的按钮，图标是一个 X。

- UNO 牌桌上的按钮叫 **End game**，会先问“End this game?”
- Chess 棋盘上的按钮叫 **Resign**，会先问“Resign and end this game?”
- Poker 牌桌上，手牌进行中按钮叫 **End game**，会先问“End this poker game?”整场会话打完之后，它变成 **Close**，点击不再需要确认。
- 8-Ball Pool 球台上的按钮叫 **End game**，会先问“End this pool game?”整场比赛打完之后，它变成 **Close**，点击不再需要确认。
- Tic-Tac-Toe 和 Rock-Paper-Scissors 用棋盘上的关闭或结束控件清掉当前这一局。

结束一局会删除它的状态。这样提前结束，不会记录任何胜负。

## 让角色自己发起游戏

角色能不能主动提出或答应玩一局，由 **Chat Settings → Agents**(聊天设置 → 智能体) 里的 **Commands** 控件决定。新建聊天的设置向导里，**Automation**(自动化) 那一步也能设置。

总开关 **Commands** 默认开启，管着所有由角色发起的命令，包括桌游、自拍、记忆和通话。关掉它，角色就不会再自己发起任何东西。

Commands 下面，每个已安装的游戏都有自己的开关，6 个默认全部开启：

- **UNO**：“Let characters start a game of UNO at the table when you agree to play.”
- **Chess**：“Let characters accept a one-on-one chess challenge at the table.”
- **Poker**：“Let characters sit down for a game of Texas Hold'em poker at the table.”
- **8-Ball Pool**：“Let characters rack up a game of 8-ball pool at the table.”
- **Tic-Tac-Toe**：“Let characters accept a one-on-one tic-tac-toe challenge at the table.”
- **Rock-Paper-Scissors**：“Let characters accept a one-on-one rock-paper-scissors match at the table.”

这些开关只管由角色发起的这条路径。已安装游戏的斜杠命令和“let's play”这类聊天说法，即使角色开关关着也照常有效。

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [斜杠命令速查](../chats/slash-commands.md)
