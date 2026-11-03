# Conversation 桌游

在 Conversation(对话模式) 聊天中，与角色玩 UNO、Chess(国际象棋)、Poker(扑克)、8-Ball Pool(美式八球)、Tic-Tac-Toe(井字棋) 和 Rock-Paper-Scissors(石头剪刀布)。Marinara 负责发牌或摆好棋盘，执行每一条规则，并让每个入座的角色以其角色的口吻讲述自己的走法。你游戏时，消息框上方会显示一块实时棋盘。

每款游戏都是可选包。从 **Agents → Agent Organizer**(智能体管理器) 安装你想要的游戏；如果目录提示重启，请重启 Marinara。未安装的游戏没有斜杠命令，不会出现在游戏选择器中，它的 **Commands** 开关也会保持隐藏。

适用于所有游戏的规则：

- 桌游只在 Conversation 模式中可用。在 Roleplay 聊天中，你会看到一条提示，说明游戏只能在 Conversation 聊天中进行。
- 每个聊天同一时间只能进行一局游戏。开始新游戏会替换当前游戏，即使已结束的游戏仍显示结束横幅也是如此。
- 聊天中至少需要一个角色，并且至少要让一个角色以机器人身份入座。机器人的走法使用与普通聊天回复相同的模型。无需额外的账号或 API 密钥。

## 开始一局游戏

**开始之前：** 安装游戏，并打开一个至少有一个角色的 Conversation 聊天。

1. 在消息框中输入游戏的斜杠命令（以 `/` 开头的简短指令），然后按 <kbd>Enter</kbd>。游戏的设置窗口会打开。
2. 选择选项（见下文每款游戏）。
3. 点击 **Deal**(发牌) 或 **Start game**(开始游戏)。

如果没有成功：当游戏未安装，或你不在 Conversation 聊天中时，该命令会缺失或不起作用。

| 游戏 | 命令 | 玩家 |
| --- | --- | --- |
| UNO | `/uno` | 你，加上 1 到 9 个角色 |
| Chess | `/chess` | 你和一个角色 |
| Poker | `/poker` | 你，加上 1 到 7 个角色 |
| 8-Ball Pool | `/8ball` 或 `/pool` | 你和一个角色 |
| Tic-Tac-Toe | `/tictactoe` 或 `/ttt` | 你和一个角色 |
| Rock-Paper-Scissors | `/rps` | 你和一个角色 |

其他开始游戏的方式：

- 输入 `/games`，从已安装的游戏中选择。
- 在普通消息中直接说出，例如 “let's play uno”、“start a game of chess” 或 “deal me into poker”。设置窗口会打开，你的消息仍会发送，因此角色可以回应你的邀请。只有当该游戏尚未在运行时，才会发生这种情况。
- 角色可以自行提议或接受一局游戏。它的回复会立即以默认规则开始游戏，不会打开设置窗口。如果它正忙或拒绝，它会以角色的口吻说明。
- 只有当该游戏的 **Commands** 开关开启时，角色才能这样做（参见[让角色自己发起游戏](#let-characters-start-games-on-their-own)）。

## UNO

设置窗口的标题为 **Start UNO**。

- **Players**(玩家)：勾选每个以机器人身份参与的角色。默认全部勾选。**You go first**（你先出）默认勾选。
- **Starting hand**(起始手牌)：每位玩家的牌数，范围为 1 到 10。默认为 **7**。
- **Penalize missed UNO**(惩罚漏喊 UNO)：默认勾选。若玩家在没有宣告 UNO 时被抓住，需摸 2 张牌，并启用 **Catch!**。
- **House rules**（自定规则），默认全部关闭：
  - **Stacking**(叠加)：把 +2/+4 叠加给下一位玩家，而不是摸牌。
  - **Draw to match**(摸到可出为止)：一直摸牌，直到摸到可以出的牌。
  - **7-0 rule**(7-0 规则)：出 7 时与选定的玩家交换手牌；出 0 时所有手牌轮转。
  - **Jump-in**(插队出牌)：不轮到你时，打出一张相同的牌。
  - **Force play**(强制出牌)：如果摸到的牌可以出，你必须出它。

在你至少选择一个角色之前，**Deal** 按钮一直处于禁用状态。它会显示玩家人数，例如你和两个角色时显示 **Deal (3p)**。

在牌桌上：

- 可以出的牌会抬起，其余的牌变暗。点击一张牌即可打出。
- 打出万能牌会弹出 “Pick a color:”。开启 **7-0 rule** 后，打出 7 会弹出 “Swap hands with:”。
- 按需显示按钮：**Draw**、**Pass**、**Call UNO!** 和 **Catch!**。
- 打出你的倒数第二张牌时，会替你宣告 UNO。
- 横幅显示 “{winner} wins!” 或 “Game over”。

## Chess

设置窗口的标题为 **Start Chess**。选择一个 **Opponent**(对手)（默认是第一个角色）。在群聊中，其他角色仍会继续聊天。**Your color**（你的颜色）可选 **White**、**Random**(默认) 或 **Black**。点击 **Start game**。

点击你的一枚棋子即可选中它。合法走法以圆点显示，吃子则以圆环显示。执黑时棋盘会翻转。兵走到底线时会弹出 “Promote to:”（Queen、Rook、Bishop、Knight）。横幅会宣布将杀、和棋及其原因，或 “Game over”；棋盘下方的一条提示栏会列出最近的走法。

## Poker

设置窗口的标题为 **Start Poker**。牌桌可以容纳 2 到 8 名玩家。

- **Players**(玩家)：勾选要入座的角色。选满七个后，其余的会变灰。
- **Dealer**(荷官)：**House dealer (silent)**(默认) 发牌，不做解说。也可以选择一个角色，由它报出牌型和摊牌。
- **Starting stack**(起始筹码)：每位玩家的筹码数，范围为 100 到 1,000,000。默认为 **1000**。
- **Small blind**(小盲注)：大盲注是小盲注的两倍。默认为 **10**。
- **Blinds double every**(盲注每隔多少手翻倍)：两次盲注升级之间的手数。默认为 **0**，表示从不升级。
- **Hand limit**(手数上限)：会话在打满这么多手后结束，筹码最多者获胜。默认为 **0**，表示一直打到只剩一名玩家有筹码。

轮到你时，操作栏会显示 **Fold**(弃牌)、**Check**(过牌)、**Call**(跟注) 和 **All in**(全下)。当你可以下注或加注时，下注框会增加 **Min**、**½ pot**、**Pot** 和 **All-in** 按钮。每手牌结束后，**Showdown**(摊牌) 面板会分配底池，**Next hand**(下一手) 会再次发牌。全局结束时，横幅会宣布赢家，并列出每个人的最终筹码数。

## 8-Ball Pool

设置窗口的标题为 **Start 8-Ball Pool**。

- **Opponent**(对手)：与你对战的角色。
- **Announcer**(解说员)：默认是 **Silent (no announcer)**（无解说），也可以选择一个角色，由它解说每一杆。
- **Match length**(比赛局数)：**Race to 1**、**Race to 3** 或 **Race to 5** 局（一局即一场完整的台球）。
- **Who breaks first**(谁先开球)：**You**、**Random** 或 **Them**。之后的每局轮流开球。

点击 **Start game**。轮到你时，从推荐的击球方式中选择一个，球会按物理模拟滚动。球台下方有一行文字描述上一杆。

## 井字棋和石头剪刀布

在 **Tic-Tac-Toe** 中，选择对手，以及你执 **X**、**O** 还是随机的标记。X 先走。轮到你时，点击一个空格。不合法的走法会被阻止，胜负和平局由 Marinara 自动判定。

在 **Rock-Paper-Scissors** 中，选择对手，以及三局两胜、五局三胜或七局四胜。每一轮选择 **Rock**（石头）、**Paper**（布）或 **Scissors**（剪刀）。双方都选定之前，选择保持隐藏；然后结果和比分才会更新。

## 提前结束游戏

每个棋盘都有一个 X 按钮。

- **UNO**：**End game**(结束游戏)。它会先询问 “End this game?”。
- **Chess**：**Resign**(认输)。它会先询问 “Resign and end this game?”。
- **Poker**：**End game**。它会先询问 “End this poker game?”。会话结束后，按钮会显示 **Close**(关闭)。
- **8-Ball Pool**：**End game**。它会先询问 “End this pool game?”。比赛结束后，按钮会显示 **Close**。
- **Tic-Tac-Toe** 和 **Rock-Paper-Scissors**：使用棋盘上的关闭或结束按钮来清除本局。

提前结束游戏会删除其状态，并且不记录任何赢家。

<a id="let-characters-start-games-on-their-own"></a>
## 让角色自己发起游戏

打开 **Chat Settings → Agents → Commands**，或在创建聊天时使用 **Automation**(自动化) 步骤。总开关 **Commands** 管控所有由角色执行的动作，包括桌游、自拍和通话。关闭它后，角色不会自行发起任何事项。

每款已安装的游戏都有自己的开关，除非你关闭，否则默认开启：**UNO**、**Chess**、**Poker**、**8-Ball Pool**、**Tic-Tac-Toe** 和 **Rock-Paper-Scissors**。参见[选择角色可以使用的命令](getting-started.md#choose-which-commands-a-character-can-use)。

这些开关只控制角色的行为。游戏的斜杠命令和 “let's play” 这类说法，即使该开关关闭也能使用。

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [斜杠命令速查](../chats/slash-commands.md)
