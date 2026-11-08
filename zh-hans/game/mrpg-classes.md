# Game Mode：MRPG 职业

所有新游戏都采用 **MRPG**(Marinara RPG) 职业，包括从 Experience 创建的游戏。每位队伍成员都有一个职业，会通过队伍打赢的战斗提升等级，并在成长过程中解锁新职业。本页是面向玩家的指南，介绍如何选择职业、各项属性的作用、等级与晋升机制，以及人物卡。

有两类游戏不采用 MRPG 职业：

- **Legacy 游戏。** 在 MRPG 职业推出前创建的游戏会保留 **Legacy** 人物卡，直到你选择迁移。见[把 Legacy 游戏迁移到 MRPG](#move-a-legacy-game-to-mrpg)。
- **规则集游戏。** 使用规则集游玩的游戏（例如 5e (SRD 5.1)）改用规则集自己的人物卡。见[使用规则集游玩](rulesets.md)。

MRPG 职业的战斗玩法见 [MRPG 游戏中的战斗](combat.md#battles-in-an-mrpg-game)。

<a id="how-it-works"></a>

## 基本机制

- 每个角色会在八棵**树**中训练两棵：由你选择的**主树**，以及由角色性格开启的**姐妹树**。
- 角色从主树的基础职业开始游戏，初始为 1 级。
- 打赢战斗会获得经验。角色的属性来自**当前职业**，并随该职业升级而提高。
- 职业等级达到 10 时可以晋升为进阶职业，达到 20 时可以晋升为大师职业。等级上限为 30。
- 战斗外，角色可以切换到任何已经解锁的职业，并携带最多 4 项从其他修习过的职业获得的技能。

<a id="the-eight-trees"></a>

## 八棵树

| 树 | 排位 | 战斗方式 | 以下性格会开启这棵姐妹树 |
| --- | --- | --- | --- |
| **Blade** | 前排 | 使用武器正面迎敌。 | Reckless |
| **Guard** | 前排 | 持盾替盟友承受攻击，并迫使敌人攻击自己。 | Protective、Honourable |
| **Scout** | 前排 | 抓住机会快速攻击、闪避和偷窃。 | Opportunistic、Cowardly |
| **Marksman** | 后排 | 根据目标切换弹药的弓箭手。 | Patient、Cautious |
| **Channeler** | 后排 | 操纵火、冰、雷、风、木、土、水和金的法师。 | Arrogant、Methodical |
| **Hexer** | 后排 | 施放诅咒，削弱敌人并吸取其 HP。 | Cruel |
| **Mender** | 后排 | 维持队伍战力并治愈各种伤病。 | Supportive |
| **Herald** | 后排 | 下达命令、吟唱战歌来强化队伍的战斗领袖。 | Coordinated、Disciplined |

混合多种树的队伍表现最好。近战攻击命中后排时只造成一半伤害，所以后排职业需要前排守住阵线（见[排位](combat.md#rows)）。

<a id="classes-in-each-tree"></a>

### 每棵树的职业

每棵树有七个职业。基础职业在职业等级 10 时晋升为两个进阶职业之一，每个进阶职业又会在职业等级 20 时晋升为对应的大师职业。最后一列的第三条路线只向 **Pure**(纯系) 角色开放：角色的性格指向自己的主树，因此没有姐妹树，只在这一棵树中训练。

| 树 | 基础职业 | 进阶（10）→ 大师（20） | 仅限 Pure |
| --- | --- | --- | --- |
| Blade | Blade | Duelist → Headsman；Bloodsworn → Cleaver | Weaponmaster → Paragon of Arms |
| Guard | Guard | Sentinel → Stonewall；Warden → Elder Warden | Aegis → Bulwark |
| Scout | Scout | Rogue → Phantom；Skirmisher → Harrier | Shade → Shroud |
| Marksman | Marksman | Sharpshooter → Farshot；Tracker → Huntsmaster | Artillerist → Siegebreaker |
| Channeler | Channeler | Elementalist → Stormcaller；Rune Scholar → Runelord | Astral Adept → Starweaver |
| Hexer | Hexer | Witch → Carrion Lord；Dreamcaller → Dreamweaver | Nullifier → Void Sovereign |
| Mender | Mender | Cleric → Saint；Apothecary → Panacean | Lifebinder → Lightbearer |
| Herald | Herald | Cantor → Maestro；Field Captain → Marshal | Standard-Bearer → Lodestar |

人物卡的 **Classes**(职业) 选项卡会介绍每个职业，并列出它的技能以及各项技能的习得职业等级。

<a id="choose-a-characters-trees"></a>

## 选择角色的树

**主树。** 在游戏开始前，从资料库角色卡或用户角色卡的 **Stats**(属性) 选项卡中，进入 **Game Mode**(游戏模式) 区块选择（见[卡片上的 MRPG 选择](../characters/colors-and-stats.md#mrpg-picks-on-a-card)）。保留 **Auto**(自动) 时，会根据角色的描述判断；进入游戏后还会参考其职业和能力。卡片中没有提到任何树的角色会从 Blade 开始。角色首次获得经验之前，也可以在游戏里通过人物卡的 **Classes** 选项卡，在 **Main tree**(主树) 下修改。

**强项与弱项属性。** 同一个卡片区块最多可以选择两项角色 **Strong in**(强项) 的属性，以及一项 **Weak in**(弱项) 的属性。每局游戏都会为每个角色重新掷出隐藏成长值，这些选择会影响掷出的倾向，但不会设置任何具体数值。

**姐妹树。** 游戏创建角色的游戏卡时，游戏主持人（GM）会根据其 Description(描述) 和个性判断性格，也就是角色会如何战斗。这个性格会开启上表中的姐妹树。如果想要特定的姐妹树，编写 Description 时就要考虑对应性格。人物卡会在姐妹树旁显示性格，例如“from Cautious”。之后的剧情可以改变角色性格，但姐妹树仍然是开始游戏时的那一棵。

如果角色的性格开启自己的主树，例如 Reckless 的 Blade，该角色就是 **Pure**：只在一棵树中训练，并会解锁该树的 Pure 专属路线。

<a id="what-the-stats-mean"></a>

## 各项属性的作用

| 属性 | 作用 |
| --- | --- |
| **HP** | 生命值。降到 0 的角色会倒下。战斗中的 HP 条大于这项属性，并随等级增长。 |
| **Strength** (Str) | 武器伤害，也会提高 Stamina。 |
| **Magic** (Mag) | 法术、法杖、魔杖和法器的伤害，以及治疗强度，也决定 MP。 |
| **Skill** (Skl) | 命中率和暴击。 |
| **Speed** (Spd) | 角色行动的频率和闪避能力，也会提高 Stamina。 |
| **Defense** (Def) | 减少武器及其他物理攻击造成的伤害。 |
| **Resistance** (Res) | 减少魔法伤害。 |
| **Luck** (Lck) | 略微提高命中率和闪避，并防范暴击。 |

技能消耗两种资源：

- **MP** 用于魔法。数值等于 8 加两倍 Magic，战斗期间不会恢复。
- **Stamina** (ST) 用于其他所有技能。数值等于 10 加 Strength，再加 Speed 的一半；每回合会恢复一部分，防御的回合恢复得更多。

战斗外的技能检定也使用这些属性。见[技能检定](#skill-checks)。

<a id="levels-and-experience"></a>

## 等级与经验

**经验。** 获胜会为队伍击败的每名敌人提供经验，包括投降或逃跑的敌人。一半经验由所有参战角色平分，另一半按各自的贡献分配，包括伤害、治疗和支援。低于角色等级的敌人提供较少经验，高于角色等级的敌人提供较多经验；低于队伍平均等级的角色还会多获得一半经验。战败或逃跑不提供经验。

**角色等级。** 每获得 100 点经验就提升 1 级，最高 30 级。战斗画面的结束面板 **What the party gained**(队伍所得) 会显示经验、每次升级以及提高的属性。

**职业等级。** 当前职业会获得同样的经验，用于提升自己的职业等级。职业等级低于角色等级一半时会获得双倍经验，让较晚开始修习的职业可以追上。角色属性来自当前职业及其职业等级：每提升一个职业等级，都会根据该职业的成长率和角色的隐藏资质，为每项属性掷一次成长，并保证每次至少提高两项属性。

因此，刚开始修习的职业只有 1 级的基础实力。可以承受较弱状态时，在战斗之间切换到新职业；需要已经积累的实力时，再切换回去。

**晋升。** 职业达到职业等级 10 时会解锁进阶职业，达到 20 时会解锁大师职业。结束面板会显示 **A promotion is open**。在 **Classes** 选项卡上使用 **Promote to**(晋升为) 和职业名称进行晋升。晋升后的职业从其上级职业的职业等级开始，获得一次性属性加值，并会用其来源职业的主动技能填满所有空闲的携带栏位。

成长率默认隐藏。开启 **Debug**(调试) 后，**Status**(状态) 选项卡会显示每项属性提高的确切概率。

<a id="switch-classes-and-carry-skills"></a>

## 切换职业与携带技能

职业要在战斗外通过 **Classes** 选项卡切换。选择一个职业，查看其技能和切换后会失去的内容，再选择 **Take up**(开始修习)（尚未训练的职业）或 **Switch to**(切换到)（曾经训练过的职业，恢复到之前达到的职业等级）。

角色只能使用当前职业的技能，以及最多 4 项从其他修习过的职业中**携带**的技能。在 **Skills**(技能) 选项卡的 **Carry from other classes**(从其他职业携带) 下选择。携带的技能使用角色自身的属性。有些技能属于整棵树，例如 Guard 的 Cover，这棵树的所有职业都会保留它们，不占栏位。如果切换职业会失去一直在使用的技能，人物卡会先提醒你，以便将它携带过去。

<a id="the-character-sheet"></a>

## 人物卡

从 **Character Profiles**(角色资料) 打开队伍成员的人物卡。人物卡有四个选项卡：

- **Status**：等级、经验、当前职业、计入装备后的属性，以及战斗开始时的 HP、MP 和 Stamina。**Row**(排位) 决定角色在 Turn-Based 战斗中站在前排还是后排；每个职业都有默认排位。
- **Classes**：两棵树及其中的每个职业，包括已经解锁的内容、各职业的要求和晋升路线。
- **Skills**：当前职业的技能和携带的技能，以及它们的消耗。
- **Gear**(装备)：一个 **Weapon**(武器)、一个 **Armour**(护甲) 和两个 **Accessory**(饰品) 栏位，可以装上队伍携带且职业能够使用的物品。每件装备都会在穿戴前显示属性。武器或护甲栏位为空时，会使用该职业对应等级的标准装备战斗。

武器决定攻击使用哪组属性：法杖、魔杖或法器以 Magic 对抗 Resistance，其他武器则以 Strength 对抗 Defense。

**驯服的同伴。** Tracker 可以在战斗中驯服虚弱的野兽。野兽会加入同伴列表，显示在 **Status** 选项卡上，最多 8 只。Tracker 或 Huntsmaster 职业处于当前状态时，出战同伴会提高自己最强的那项属性；等级越高、级别越精英的野兽，加值越大。兽栏已满时，要放走一只才能留下新同伴。同伴要在战斗外更换。

**Permadeath**(永久死亡)。开启 **Permadeath** 后（这是向导 **World**(世界) 步骤中的设置选项，默认关闭），队伍成员若在战斗中倒下，且战斗结束前没有获救，就会永远离队。关闭时，倒下的成员会在战斗后重新站起来。

<a id="skill-checks"></a>

## 技能检定

战斗外的检定使用角色的 MRPG 属性，也就是当前职业提供的属性。每项技能主要依赖一个属性，例如 Stealth 依赖 Speed，Persuasion 依赖 Luck。完整列表及各属性提供的加值见[骰子与技能检定](dice-and-skill-checks.md#how-the-result-is-decided)。

<a id="new-party-members-and-shared-games"></a>

## 新队伍成员与共享游戏

**游戏进行中加入的角色。** 游戏开始后才加入的同伴，会以 GM 为其指定的等级入队。大多数新成员等级较低，经验丰富的战士则可能接近队伍等级。GM 还可以让某些属性成长得更快，适合天赋尚未打磨、但能迅速追上队伍的角色；也可以提供更好的初始属性，适合已经具备实力的角色。若 GM 没有特别说明，新成员从 1 级开始。

**共享游戏中的访客。** 每位访客加入房间时都会构建自己的角色：名称、描述、供 GM 参考的**角色概念**，以及卡片拥有的同一组 **Game Mode** 选项（起始树、强项属性和弱项属性）。选择你的某个用户角色会用其中的内容填入这些项目。可以在概念里告诉 GM 角色是谁，以及希望这个角色如何进入故事。GM 会安排角色融入故事，并选择其姐妹树。

- **新游戏。** 所有人（房主和访客）都从 1 级开始。
- **进行中的游戏。** 和其他新成员一样，GM 还会设定访客的起始等级、成长率和属性。
- **回归的访客。** 访客离开时，其角色会连同等级、装备和驯服的野兽一起留在游戏里。玩家不在期间，该角色不会参战，不获得经验，也不会出现在场景中。访客回来后，会继续操控同一个角色，等级与离开时相同。

每位玩家的技能检定都会读取其自身角色的属性。

<a id="move-a-legacy-game-to-mrpg"></a>

## 把 Legacy 游戏迁移到 MRPG

Legacy 游戏可以一直保留 Legacy 人物卡。要迁移，打开 **Journal**(日志)，在 **All**(全部) 选项卡上找到 **MRPG classes**(MRPG 职业) 卡片，然后选择 **Upgrade**(升级)。

卡片会为每位队伍成员显示：

- **Class**(职业)。角色的起始树，会根据其资料库卡片上的选择填入；没有选择时，则根据 Legacy 职业填入。可以更改。
- **Sister tree**(姐妹树)。由角色性格开启的树。若角色还没有性格，升级时会根据其 Description 判断。
- **Gear**。角色携带的每件 Legacy 武器和护甲，以及它会转换成的 MRPG 装备。取消勾选即可保留原样。

用 **Upgrade the party**(升级队伍) 确认后：

- 每位队伍成员都从 10 级开始，也就是起始职业的最高等级；每一级的属性都像正常升级一样掷出。首次晋升会立即开放。
- 角色卡上的职业会变成其 MRPG 职业。Legacy 职业和能力会移入角色卡上的 **Before the upgrade**(升级前) 注释，让故事仍然知晓这些内容。Legacy 属性也会留在角色卡上，但检定和战斗不再使用它们。
- 每件接受转换的武器或护甲都会变为相应的 MRPG 装备，并保留原名；如果角色的职业能使用，就会穿戴或装备它。

> **警告：** 升级不可逆。迁移到 MRPG 职业后，游戏无法改回 Legacy 人物卡。

战斗期间不会提供升级选项，请先结束战斗。使用规则集游玩的游戏无法升级，它会保留规则集的人物卡。

<a id="related-guides"></a>

## 相关指南

- [Game Mode：战斗](combat.md)
- [Game Mode：队伍与 NPC](party-and-npcs.md)
- [Game Mode：骰子与技能检定](dice-and-skill-checks.md)
- [角色颜色与角色扮演属性](../characters/colors-and-stats.md)
