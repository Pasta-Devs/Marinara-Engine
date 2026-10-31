# 规则集条目机制

本页是[编写 Game Mode 规则集](writing-rulesets.md)的一部分。目录条目在数值上的作用：条目的 `mechanics` 块，由检定、休息和战斗读取。

条目可以带可选的 `mechanics` 块，用数值说明其效果：`kind`(`attack`、`heal`、`buff`、`debuff`、`utility`、`rider`)、`range`、`area`、`targets`、`targetCount`、`friendlyFire`、`amount`(`2d6` 等骰子表达式或固定数值)、`amountAdd`(从使用者人物卡读取并加到数量上的值，例如 `{ "field": "level_fighter" }`，表示 1d10 加战士等级的 Second Wind；它需要 `amount`，只在规则集自己的战斗中读取（Engine 的 Classic 和 Tactical 战斗按写下的数量使用），并需要 Capability API 1.83)、`damageType`、`attackRoll`、`autoHit`、`save`(人物卡中的一种豁免，以及成功后的效果)、`applies`(为接触到的对象施加的状态)、`temporary`(生命池的临时点数)、`scales`(随人物卡增长的数量)、`cost`(使用时消耗哪个池)、`perCostStep`、`targetsPerCostStep`、`budget`(消耗行动经济的哪部分)、`concentration`、`reaction`、`plus`、`free`、`gives`、`standard`、`rider` 和 `check`。

瞄准敌人的攻击可以用 `summons`(Capability API 1.122) 留下一样东西，在之后的回合继续打击。对于 Spiritual Weapon，在其攻击条目上写 `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }`。施法本身进行第一次攻击，并在反应结束后把武器留在第一个目标旁边；被取消的施法什么也不留下。之后的打击只消耗所声明的行动经济额度，保留施法时的支付等级用于伤害缩放，并打开相同的反应窗口。距离使用目录的单位；省略移动时为零，省略触及时为一格。在棋盘上，武器可以打击移动距离加触及范围之内的敌人，无视墙壁，并移到其旁边。没有棋盘时，任何站着的敌人都在触及范围内。轮数在持有者的回合结束时倒数，施法的那个回合不计。召唤物在归零、持有者被击败，或其条目的专注结束时结束。再次施放同一条目会替换它的召唤物。

带 `area` 的条目可以用 `zone`(Capability API 1.172) 留在场上：`{ "rounds", "anchor", "triggers", "atCast" }`。它持续其施法者的 `rounds`(1 到 1000) 个回合，计数方式与召唤物相同；维持它的专注结束或施法者被击败时，它会提前结束。`anchor: "point"`(默认) 保持在施放时的那些格子上；`anchor: "caster"` 是围绕施法者、随其移动的爆发，因此其射程为 0。`triggers` 指定它何时对一个生物再次产生条目本身的效果（amount、plus、save、applies）：`enter`(对方移入其中，或施法者携带的区域到达对方)、`turn-start` 或 `turn-end`(对方在其中开始或结束回合)。无论哪种触发，一个生物每回合只会被卷入一次，施法本身卷入的人在那个回合也算已被卷入。卷入谁取决于条目：`friendlyFire: false` 不卷入施法者一方，治疗或针对盟友的条目只卷入己方，施法者携带的区域从不卷入施法者本人。`atCast: false` 在出现时不做任何事。再次施放该条目会替换它的区域。棋盘会给其格子着色，战斗会列出它及其剩余回合数，日志会说明每次卷入。没有棋盘时，它保持施放时所卷入的对象，`turn-start` 和 `turn-end` 会卷入他们。

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

这就是 Cloudkill。Spirit Guardians 写作 `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false`，并带 `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`；Moonbeam 是带 `"triggers": ["enter", "turn-start"]` 的 5 英尺爆发。

固定在某一点的区域可以移动，也可以改变其地面（Capability API 1.173）。`move: { "budget", "distance" }` 让施法者在自己的回合移动它：战斗会为该额度提供“Move <zone>”，像行走一样在棋盘上选取，可以移到距其中心 `distance` 之内的任何格子。`drift: { "distance" }` 在施法者每个回合开始时，把它沿远离施法者的方向直线移动这么远，到棋盘边缘为止。无论哪种方式，它现在覆盖而之前未覆盖的人，都会按 `enter` 的规定被卷入。只有固定在某一点的爆发才能移动或漂移。`terrain: { "difficult": true }` 让被它卷入的人移入其每一格的费用加倍（本已崎岖的地面不会再加倍），`terrain: { "perDistance": { "every", "amount", "damageType" } }` 则让被它卷入的人在其中每移动 `every` 距离，就受到 `amount`(骰子和固定值，与条目自身的写法相同) 的伤害，不作豁免，跨多次行走累计。日志会说明每次移动、漂移和伤害。

```json
{
  "id": "moonbeam",
  "name": "Moonbeam",
  "mechanics": {
    "kind": "attack",
    "range": 120,
    "area": { "shape": "burst", "size": 5 },
    "amount": { "dice": "2d10" },
    "damageType": "radiant",
    "save": { "save": "con_save", "onSuccess": "half" },
    "concentration": true,
    "zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "move": { "budget": "action", "distance": 60 } }
  }
}
```

Cloudkill 加上 `"drift": { "distance": 10 }`。Spike Growth 是一个 20 英尺爆发，本身没有数量，带 `"triggers": []`(它只靠地面起作用)、`"atCast": false` 和 `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`。

区域还能对被卷入的人做更多事（Capability API 1.174）。`breaksConcentration: true` 让正在专注且被它卷入的生物，在条目效果之前，对抗条目自身的豁免难度进行规则集的专注豁免，失败就失去专注；该条目需要 `save`。`damageCap` 在区域出现后累计造成这么多伤害时结束它，卷入和地面造成的伤害都计入。Sleet Storm 是一个 40 英尺爆发，带 `"save": { "save": "dex" }`、`"applies": [{ "condition": "prone", "duration": "instant" }]` 和 `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`。Guardian of Faith 是一个爆发，带 `"friendlyFire": false`、`"amount": { "flat": 20 }` 和 `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`。

条目施加的状态以什么难度挣脱，可以是条目自身的豁免难度（1.174）：在 `applies` 项上写 `"escapeDc": "save"`，并配合一个 `from.holding` 为该状态的对抗。Web 和 Black Tentacles 用 `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }` 束缚目标，被束缚的生物进行挣脱对抗时，对抗的是施法者的法术豁免 DC。若施加它的东西没有豁免难度，就仍按对抗的规定、对抗施加者来挣脱。

物品的 `use` 也可以像目录条目一样带 `concentration` 和 `zone`(1.174)，因此 Cloudkill 或 Moonbeam 的法术卷轴会保留其持续范围，并由阅读者的专注维持。

被移动的区域可以冲撞，其地面的代价也可以更高（Capability API 1.175）。`move: { ..., "ram": true }` 让它一次一格、直线朝被移往的位置前进；在第一个碰到之前未覆盖之人的格子上，它会停下，把对方当作被冲撞一样卷入（无论其触发条件如何），并且该回合不能再被移动。走进它的生物只按其触发条件被卷入。Flaming Sphere 是一个 5 英尺爆发，带 `"triggers": ["turn-end"]` 和 `"move": { "budget": "bonus", "distance": 30, "ram": true }`。`terrain.costTimes`(2 到 10) 让踏入其中的每一步都花费相当于这么多普通步的费用，本已崎岖的地面也不会超过这个费用：Plant Growth 写作 `"terrain": { "costTimes": 4 }`。它取代 `difficult`，后者等于 `costTimes: 2`。`terrain.halvesSpeed: true` 让其中的每一步在任何崎岖地面之外再加倍：Spirit Guardians 写作 `"terrain": { "halvesSpeed": true }`。

法术施加的束缚只能按法术的规定挣脱（同样是 1.175）。带 `"from": { "holding": "restrained", "escapable": true }` 的挣脱对抗，只针对指定了 `escapeDc` 的束缚提供，因此同一个对抗可以挣脱蛛网，却永远挣脱不了石化。`applies[].escapeChecks` 指定可以挣脱该束缚的对抗检定，代替对抗自身的攻击方检定：Black Tentacles 用 `"escapeDc": "save", "escapeChecks": ["might", "agility"]` 束缚，Web 用 `"escapeChecks": ["might"]`。`zone.whileHeld: { "condition", "amount", "damageType" }` 对在其中开始回合、且已被施法者以该状态束缚的人造成其数量的伤害，不作豁免，并代替区域本身的效果：Black Tentacles 的 `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }`。

条目或物品的使用可以治愈（Capability API 1.176）。`ends: { "conditions": [...], "count"? }` 按列出的顺序移除目标身上的这些状态，最多 `count` 个：Lesser Restoration 写作 `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`。`stabilizes: true` 让濒死的目标稳定下来，不再进行濒死豁免，它需要带 `dying` 规则的战斗块：Spare the Dying。`revives: { "withinRounds", "health" }` 只能指向死亡不超过这么多轮的人，并让其以该数量的生命复活：Revivify 写作 `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`。只移除状态或只让目标稳定的条目，只针对它能帮到的人提供；`utility` 类型、别无其他作用的条目，只要能治愈就会提供。

范围可以是方形，持续的范围可以是墙（Capability API 1.177）。`area.shape: "box"` 是边长为 `size` 的正方形，其近角位于所瞄准的格子上，朝远离施放者的方向延伸；在与施放者对齐的轴上，则改为以该格为中心。没有 `range` 时，它紧贴施放者。Web 写作 `"area": { "shape": "box", "size": 20 }`，射程为 60。`area.shape: "wall"` 只能持续存在，因此需要 `zone`：它长 `size`、厚 `width`(没有时为一格)，穿过所瞄准的格子、横跨施放者到该格的连线，或从那里朝选择的 `toward` 格子延伸；`"ring": <diameter>` 让施法者在选择写明 `"ring": true` 时，改为把它布成围绕所瞄准格子、直径为这个值的环。墙不需要触发：Wind Wall 只在出现时产生效果。墙从不移动、漂移或跟随施放者。`zone.blocks: ["move", "sight"]` 在墙存在期间，对行走、视线或两者封闭其格子，墙升起处站着的人会被放到最近的空格上（距离相同时放在所选的一侧）：Wall of Stone 两者都阻挡，Wall of Force 阻挡移动，Wall of Fire 阻挡视线。`zone.side: { "distance", "triggers" }` 让墙一侧 `distance` 之内的格子按自己的 `triggers` 卷入，与墙本身的格子并列；选择的 `side` 说明是哪一侧：`near` 靠近施放者（环内），`far` 远离施放者（环外），省略时为远侧。Wall of Fire 写作 `"area": { "shape": "wall", "size": 60, "ring": 20 }`、`"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`。

视线很重要（Capability API 1.178）。`combat.senses` 列出能在眼睛看不见之处看见的感官，每个写作 `{ "id", "label", "sheet"?, "blind"? }`：角色的感知距离通过 `sheet` 从其人物卡读取（为零时没有），生物以 `"senses": { "darkvision": 60 }` 携带自己的感官，使用规则集的距离单位；`blind` 感官（盲视、震颤感知）不需要眼睛也能生效。此时该块需要 `combat.distance`。带 `obscures` 的区域会遮蔽其中的一切，以及透过它看到的一切，使其对在距离内不具备 `pierced` 所列任何感官的人不可见：Fog Cloud 写作 `"obscures": {}`，Darkness 写作 `"obscures": { "pierced": ["blindsight", "truesight"] }`。这种区域不需要触发；只留下一片持续范围、别无其他作用的 `utility` 条目（Fog Cloud、Darkness、墙）会出现在菜单上，放在施法者选择的任何位置。带 `unseen` 的 `combat.conditions` 项以同样方式隐藏其持有者：隐形写作 `"unseen": { "pierced": ["blindsight", "truesight"] }`。`combat.sight` 说明这有什么作用：`unseenAttacks: true` 在目标看不见攻击者时给攻击优势，在攻击者看不见目标时给攻击劣势；`eyes` 指定哪种感官是视觉（与状态的 `lacks` 指定感官的方式相同），因此目盲的生物只能靠 `blind` 感官看见。带 `seen: true` 的条目或生物行动只能选择施放者看得见的目标，正如“射程内一个你看得见的生物”这句规则所说。爆发或方形可以用 `area.copies`(2 到 10) 一次放下多份，每份都与另一份相接，由玩家逐一放置：Fire Storm 写作 `"area": { "shape": "box", "size": 10, "copies": 10 }`。放下多份的区域会留在施放的位置。

区域可以作用于站在其中的人（Capability API 1.179）。`combat.components` 指定使用某样东西可能需要什么，每个写作 `{ "id", "label" }`(5e 的言语、姿势、材料)，条目或生物行动在 `components` 中列出自己所需的成分。区域的 `inside` 对其中的人施加 `conditions`，并在他们停留期间使其免受 `immune` 中的伤害类型；其 `forbids: { "components": [...] }` 阻止在其中使用需要这些成分的任何东西，与状态的 `forbids` 对其持有者的作用相同（被堵住嘴）。Silence 写作 `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`。区域的 `wards: { "catalogs": [...], "maxLevel": N }` 让其中的人免受从外部以 N 级或更低等级使用的、来自这些目录的任何东西，按支付时的等级判断：Globe of Invulnerability 写作 `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`。拿走额度的状态（带负数 `flat` 的 `budgets`），如果在持有者自己的回合中施加，也会从当回合拿走，因此 Stinking Cloud 在回合开始时豁免失败，会让那个回合失去动作。

感官与视线还能更进一步（Capability API 1.180）。条目施加的状态可以在持有者行动时结束：`"endsWhenHolder": { "attacks": true, "casts": ["spells"] }` 在他们进行一次攻击，或使用了所列目录中的条目后移除它；写明 `"casts": "spells"` 的物品使用（卷轴、魔杖）算作从该目录施法。结束它的那次攻击或法术仍享有它，因此 Invisibility 让那一次攻击获得优势，之后才消失。持续区域自行产生的作用不算施法者行动。`combat.conditions` 中的状态，或物品的 `worn` 或 `carried` 效果，可以给予以规则集距离单位计的感官：`"senses": { "darkvision": 60 }`；生效期间，取它与持有者自身距离中较长的一个，因此 Darkvision 法术、True Seeing(`{ "truesight": 120 }`) 和 goggles of night 都能实现。带 `"cancelsUnseen": true` 的状态让所有人都能看见其持有者，无论什么状态在隐藏他们，就像 Faerie Fire 勾勒出隐形者的轮廓；遮蔽区域和墙仍会隐藏他们。

防护、豁免、怪物施法和卷轴更进一步（Capability API 1.181）。区域的 `wards` 比较法术支付时的等级，除非写明 `"by": "base"`，此时比较法术本身的等级，无论以何种等级支付，Globe of Invulnerability 就是这样。`"maxLevelPerCostStep": 1` 让防护自身施放时每高于基础等级支付一级，就多挡住一个等级。条目或生物行动的 `save` 可以说明它还算作针对什么：`"against": { "damage": ["poison"] }`，因此 `against` poison 的豁免调整值也适用于它；还可以说明谁无须掷骰即成功：`"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }`(满足任一项即可)，Stinking Cloud 就需要这样。生物的 `spellcasting` 可以为整个特性或逐个法术说明其法术需要什么，代替各条目自身的 `components`；不需要任何成分的天生施法写 `[]`，这样 Silence 就阻止不了它。物品的使用在唯一作用是留下一片持续范围时（Fog Cloud、Darkness、Silence 或 Globe of Invulnerability 的卷轴），可以写作 `"kind": "utility"`；它需要 `area` 和 `zone`。

推开、风和护目镜（Capability API 1.182）。条目的 `"push": 15` 把它落在其身上且未通过豁免的人，沿远离施放者的方向直线推开 15 个目录距离单位，碰到任何实体或站着的人时停下；区域以同样方式推开被它卷入的人。由施法者携带的区域（`"anchor": "caster"`）现在除了爆发，还可以是直线或锥形：它指向施放时的方向，随施法者移动，`"turn": { "budget": "bonus" }` 让施法者在自己的回合消耗该额度把它转向另一个方向，并把它现在覆盖的人当作移入其中一样卷入（5e 的 Gust of Wind）。区域的 `terrain` 带 `"towardCaster": true` 时，其崎岖地面只对让移动者更靠近施法者的那一步生效。状态或物品给予的感官可以写作 `{ "add": 60 }` 而不是距离，表示加到持有者该感官自身的距离上，或给没有该感官的人 60 的距离（5e 的 goggles of night）。

稍后引爆或燃烧殆尽的区域（Capability API 1.183）。带 `"detonates"` 的区域在存在期间和施放时都不做任何事：当它结束时，无论是因为专注结束、轮数耗尽，还是被再次施放，它都会对其中的每个人产生一次条目本身的效果。`"grows": { "dice": "1d6" }` 在施法者每个回合结束时（包括施放的那个回合）给它的数量加上这么多，因此它掷的骰子与条目本身的数量相同；`"touched": true` 让移到其中心上的人进行条目的豁免，失败时引爆它（5e 的 Delayed Blast Fireball）。它留在施放的位置。带 `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }` 的区域，在其中一种伤害类型落到它的任何格子或其中任何人身上时被点燃；施法者的回合再次到来时它燃烧殆尽，法术随之结束，在此期间，在其中开始回合的其他任何人都会受到其数量的伤害，不作豁免（5e 的 Web）。

生物也能推开（Capability API 1.184）。生物的行动像目录条目一样接受以规则集自身距离单位计的 `"push": 60`：它落在其身上的人会被沿远离生物的方向直线推开这么远；带 `save` 时，只在对方豁免失败时推开，因此 `"onSuccess": "none"` 保留伤害，只免除推开和 `applies` 施加的状态（dragon turtle 的 Tail）。物品的使用可以给直线设定 `width`，就像 Gust of Wind 卷轴的 60 乘 10 英尺。

生物是什么，作用更大了（Capability API 1.185）。豁免可以写 `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`，因此属于该类型的目标会掷两次取较差者（Sunbeam）；条目的 `"maxAgainst": { "types": ["plant"] }` 对属于该类型的目标造成最大伤害（Blight）。`targetTypes` 还可以写 `"abilityAtMost": { "int": 3 }`，表示分值不超过该值的目标（没有写分值的生物不会被排除），以及 `"notImmuneTo": ["charmed"]`(Sleep)。状态的调整值可以让攻击掷两次：`{ "to": "attacks", "mode": "disadvantage", "atSource": true }` 是持有者对施加者的攻击（Chill Touch），`{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }` 是属于该类型的攻击者对持有者发动的攻击（Protection from Evil and Good）。对豁免的改动可以写 `"against": { "from": { "types": ["dragon"] } }`，匹配针对该类生物所做之事的任何豁免（Dragon Scale Mail）。

生物的行动可以一起充能（Capability API 1.186）：给每个 `"recharge"` 相同的 `"group"` 和相同的骰子，使用任一个都会同时消耗两者，而在生物回合开始时掷一次就能让两者都恢复（metallic dragon 的两种吐息武器）。打击可以带 `"charge"`：`{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }` 会在生物本回合的行走以至少 `atLeast` 的直线冲刺结束、径直冲向被它击中的人（每一步都离对方近一格）时，加入其子项；然后目标进行豁免，失败时（没有豁免则总是）被推开并受到这些状态（minotaur 的 Charge）。冲锋依附于对一个目标的一次打击，并且只在棋盘上测量。

物品的 `attack` 可以对其命中对象说明更多（Capability API 1.187）。`"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]` 对属于该类型的目标增加命中加值（mace of smiting）。`plus` 子项可以写 `"not": { "types": ["construct", "undead"] }` 跳过属于该类型的目标，写 `"blow": "ranged"` 只在投掷或射击的打击上计入（dwarven thrower），或写 `"melee"` 只在触及范围内的打击上计入，写 `"tempHp": true` 则给予持用者等于其所造成伤害的临时生命值（sword of life stealing）。`onHit` 状态可以指定 `"targetIs"`(giant slayer 把巨人击倒) 和 `"oncePerTurn": true`(sword of wounding)。`"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]` 会直接杀死被这次命中打到 `healthAtMost` 或以下的目标（有豁免时须豁免失败），并在生效时消耗物品的充能（nine lives stealer）；`"immuneTo": ["slashing"]` 放过免疫该伤害的目标（vorpal sword）。生命在打击的伤害之后读取。

人物卡的 `live.conditions`、休息的 `clear.conditions` 以及 `combat.conditions` 最多容纳 640 项（Capability API 1.552；1.269 起为 320，1.188 起为 160，之前为 80）。`to: "attacks"` 的调整值可以指定 `"ability": "str"`，只改变以该属性进行的攻击（gold dragon 的 Weakening Breath）；`to: "checks"` 的调整值可以指定 `"abilities": ["str"]`，只改变以其中某个属性进行的属性检定，包括该属性的对抗检定和技能检定（barbarian 的 Rage）。生物数值块中的行动不指定属性，因此限定于属性的攻击调整值永远不会作用于它们。

`combat.conditions` 中的状态可以伤害其持有者（Capability API 1.189）：`"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }` 在其每个回合开始时（或 `"turn-end"`）造成该伤害，来源是施加者，在任何结束它的豁免之前结算。`"stacks": 10` 允许在它生效期间再次施加，最多叠加这么多次，每层各造成一次伤害（sword of wounding）；结束它会结束所有层。`"onePerSource": true` 让同一来源只在一个持有者身上保留它：施加到另一个人身上时，它会离开原先从同一来源获得它的人（oathbow 的 sworn enemy）。物品攻击的 `against` 项可以写 `"marked": "sworn"` 代替 `is` 或与之并列，匹配带有持用者所施加该状态的目标；除了 `toHit`，还可以写 `"mode": "advantage"`、`"ignoresCover": true`(未达到全掩护的掩护一律不算) 和 `"ignoresLongRange": true`；`plus` 子项也可以写 `"marked": "sworn"`(oathbow 的 3d6 穿刺伤害)。生物数值块中的行动可以指定 `"ability": "str"`，即其攻击所用的属性，这样限定于某个属性的攻击或伤害改动就能作用于它。

物品攻击的 `modes` 项可以是使用武器的一种完全不同的方式（Capability API 1.190）：`"range": { "normal": 120 }` 是该模式下能打多远，使用规则集自身的距离单位；`"plus"` 像攻击自身的子项一样给命中加上子项；`"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }` 是一道闪电，站在持用者与目标之间的每个人（两者本身除外）都要在攻击掷骰之前对它进行豁免；`"charges": 1` 消耗物品自身相应数量的充能，因此只有在还有充能时才提供该模式（javelin of lightning：物品上 `charges.max` 为 1，`stack` 为 1）。直线需要有棋盘才能穿过。

带 `"cannot-heal"` 效果的战斗状态在持续期间阻止对其持有者的一切治疗，日志也会说明（Capability API 1.191）：5e 的 Chill Touch。战斗状态上的 `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]` 只在符合 `from` 的生物施加这些状态时才挡住它们；已经生效的仍然保留（Protection from Evil and Good）。法术的 `targetTypes.abilityAtLeast` 是下限，`abilityAtMost` 则是上限：`{ "int": 5 }` 会跳过 Intelligence 4 或以下的生物（Hideous Laughter），没有写该分值的生物不会被排除。豁免调整值的 `against.actions` 按 ID、名称或共用的充能组指定行动，不区分大小写，并收窄 `against` 所说的其他一切：`{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }` 是龙的吐息或 Frightful Presence，从不是它的 Wing Attack，而结束其中之一所施加状态的重复豁免也算在内。

物品攻击可以携带更多附加效果（Capability API 1.192）。`"ignoresResistance": true` 让其伤害穿透目标对攻击自身伤害类型的抗性（包括对一切伤害的抗性），而其他类型的 `plus` 子项仍会减半（vorpal sword 的挥砍伤害）；免疫仍然有效。`slay` 项的 `"saved"` 以与 `applies` 相同的形式列出状态，通过斩杀豁免的目标改为受到这些状态：`[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]` 就是 mace of disruption 让邪魔在持用者下个回合结束前一直惧怕持用者。`"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }` 让持用者在其施加了 `sworn` 的生物仍站着时，所进行的其他每次武器攻击都以该模式掷骰，或加上 `"ranged": true` 时只对远程攻击生效（oathbow）。此外，在没有棋盘的战斗中，范围行动（生物的或法术的）可以指向任意一方的人，但绝不指向施放者自己，因为它会卷入其中的每个生物；`friendlyFire: false` 让它只作用于另一方，与在棋盘上一样。

对抗可以是对照固定数字的检定，而不是双方对掷（Capability API 1.193）。省略 `defender`，并给出 `"difficulty": 15`；行动者掷其 `attacker` 检定中最好的一个，达到该数字即获胜。`"targets"` 说明可以对谁进行：`"enemy"`(默认)、`"ally"` 或 `"any"`，包括行动者自己。`"targetHolds": "wounded"` 只在目标带有该状态时提供，`"targetDying": true` 只在目标濒死且尚未稳定时提供。`onWin.stabilizes` 让濒死的目标稳定下来。因此，结束 sword of wounding 所造成伤口的 DC 15 Wisdom (Medicine) 检定写作 `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`，救助濒死者的 DC 10 检定写作 `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`。骰池战斗计算成功数，因此拒绝 `difficulty`。物品攻击的 `"healedOnlyByRest": true` 会封存它夺走的生命值：任何治疗都不能让持有者超过其最大值减去被封存的部分，任何休息都会恢复它们并解除封存。战斗状态的 `harms` 也接受同样的 `"healedOnlyByRest": true`，因此这把剑留下的伤口也会封存它们夺走的生命。

一种体型可以占据多于一格（Capability API 1.194）。给 `combat.sizes.order` 中的某项加上 `"cells"` 数量，`{ "id": "large", "label": "Large", "cells": 2 }`，该体型的生物在棋盘上每边占据这么多格，其自身格子是左上角那一格：5e 的 Large 为 2，Huge 为 3，Gargantuan 为 4。它会被放在能完全容纳它、且离要求站立处最近的位置。触及和射程以它所占据的最近一格为起止点，因此剑可以从 ogre 四格中任何一格的旁边打到它；它只走能完全容纳它的地方，也没有人能穿过它的任何部分；范围只要包含它的任何一格就会卷入它；推开会移动它的整体；能否看见它、它有多少掩护，都以它最无遮挡的那一格为准。没有 `cells` 的体型占据一格，与以前完全相同。

状态可以让持有者变大或变小（Capability API 1.195）。给 `combat.conditions` 中的某项加上 `"size": { "steps": 1 }`，在它生效期间，持有者沿 `combat.sizes.order` 向后移动这么多个体型，负数则向前，但不会越过第一个或最后一个：5e 的 Enlarge 是 `1`，Reduce 是 `-1`。其触及、范围对其的卷入，以及任何询问其体型的内容都读取新体型，状态结束时他们恢复原来的体型。在棋盘上，变大的人会在其原先站立的每一格之上铺开新体型，前提是那里是空地、没有其他人；否则采用能放下的、比它小的最大体型，因此在走廊中被放大的 ogre 只会长到走廊允许的大小；变小的人保留其左上角那一格。日志会说明谁变了、变成什么。它需要 `combat.sizes`；请搭配用于武器骰的 `damage` 调整值，以及用于法术其余部分的 Strength `checks` 和 `saves` 模式。

条目可以按目标剩余的生命来选取目标（Capability API 1.196）。其 `mechanics` 中的 `"healthPool": { "dice": "5d8" }` 在使用时掷一次，从剩余生命最少的目标开始依次分配：只有生命不超过剩余数值的目标才会受影响，并随即用掉相应数值，其余目标则完全不受影响，5e 的 Sleep 和 Color Spray 就是这样运作的；以更高等级施放时，`perCostStep` 会增加它。`"healthAtMost": 150` 只影响生命不超过该值的目标，如 Power Word Stun；`"kills": true` 直接杀死它所影响的人，因此 Power Word Kill 写作 `"healthAtMost": 100, "kills": true`。两者都读取目标剩余的生命，在 `targetTypes` 说明它能作用于谁之后才判断。日志会说明生命池掷出多少，以及够影响谁。

伤害调整值可以把一次打击自己的骰子多掷几遍（Capability API 1.197）。状态上的 `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }` 让 war pick 的 1d8 + 2 在其生效期间造成 2d8 + 2，就像被放大的 duergar 的武器那样；其固定部分保持不变，重击会像对其余部分一样把额外的骰子翻倍，菜单的平均值也会计入它们。它只改变打击造成的伤害，不改变其他任何东西。带 `"self": true` 的生物行动在其自己的回合执行时，现在会作用于生物自身，与在反应中一样，因此其 `applies` 会生效。

区域在触发时可以造成与其出现时不同的伤害类型（Capability API 1.198）。在自身 `damageType` 为 `"piercing"` 的条目上写 `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }`，会对墙出现时被围住的人造成穿刺伤害，对之后移入其中的人造成挥砍伤害，就像 5e 的 Wall of Thorns。它需要条目自身的 `amount`，以及造成该伤害的触发、侧面或冲撞；在规则集声明了 `combat.damageTypes` 时，须指定其中之一。

生命池可以跳过部分目标（Capability API 1.199）。与 `healthPool` 并列的 `"healthPoolSkips": { "conditions": ["unconscious"] }` 不影响带有其中任一状态的人，也不为他们花费生命池，就像 5e 的 Sleep 无视昏迷者；`"unseeing": true` 对看不见条目施放者的人（目盲，或与施放者之间没有视线）做同样的事，就像 Color Spray 无视看不见的生物。它指定 `conditions`、`unseeing` 或两者，并需要 `healthPool`。

墙可以分段竖立，各段逐一被打击和破坏（Capability API 1.200）。`"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }` 就是 5e 的 Wall of Ice：每块 10 英尺的墙板有 AC 12 和 30 点生命值，受到火焰伤害时加倍（`resist` 和 `immune` 的作用方式相同）。瞄准一个敌人或任何人并造成伤害的攻击，可以改为指向一段墙：其选项以 `walls` 列出它可以打击的格子，选择则以 `wall` 指定其中之一。攻击照常掷骰并造成伤害，就像针对生物一样，日志会说明该段受到多少、还剩多少。降到 0 的段被破坏：它不再阻挡，进入其中（或按其 `triggers` 的规定，在那里开始或结束回合）的人会受到其 `amount`，每回合一次，并以其 `save` 对抗条目自身的难度豁免，成功则减半（`onSave: "none"` 则为零）。分段需要带 `blocks` 的墙，破碎段的 `save` 需要条目自身的 `save`。

条目可以移动人物卡的实时轨道，并归还被封存的生命（Capability API 1.201）。`"tracks": [{ "track": "exhaustion", "by": -1 }]` 让它作用到的人减少一级力竭，就像 5e 的 Greater Restoration；带豁免的条目上的 `"by": 1`(Sickening Radiance) 让豁免失败者增加一级。每条轨道都保持在其自身范围之内，让生命最大值减半的等级会立即生效，达到带 `defeats` 的等级即被杀死。`"unseals": true` 归还只有休息才能恢复的生命（`seals` 打击夺走的部分），就像 Greater Restoration 结束对生命值最大值的削减。只以这种方式治愈的条目，只针对它能帮到的人提供。墙段的 `broken` 可以带自己的 `perCostStep`，施法每高于基础等级支付一级就加上一次：Wall of Ice 的寒气，`{ "dice": "1d6" }`。这里的轨道是普通轨道，不是伤势轨道，`unseals` 需要以点数计的生命。

条目施加的状态可以随它施加的另一个状态一起结束（Capability API 1.202）。5e 的 Hypnotic Pattern 写作 `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`，其中失能状态会在魅惑结束时一起结束：豁免、治愈、施法者的专注被打断、盟友把他们摇醒，或战斗结束。只有同一次使用施加的那个状态会随之结束，日志会说明原因。`endsWith` 指定同一 `applies` 列表（或 `onEnd`、`charge` 或 `saved` 列表）中的另一个状态，绝不能是它自己。

生物的行动可以降低目标的生命最大值（Capability API 1.203）。wraith 的 Life Drain 上的 `"reducesMax": { "save": "con_save", "difficulty": 14 }` 让目标在打击落下时进行该豁免；失败时，它受到的伤害既从生命中扣除，也从最大值中扣除，在休息之前任何治疗都不能恢复。带 `"lasting": true`(clay golem 的 Slam) 时，连休息也不行，只有带 `unseals` 的条目（Greater Restoration）才可以。最大值以这种方式降到 0 的目标会死亡。人物卡把任何休息都恢复不了的部分保存在 `sealed` 中，作为其池的 `lasting`。它需要以点数计的生命。

治愈可以只执行其中一种，而不是全部（Capability API 1.204）。带 `"cureOneOf": true` 时，`ends` 某些状态、移动 `tracks` 并 `unseals` 的条目（5e 的 Greater Restoration：魅惑、石化、一级力竭，或生命值最大值）只执行恰好一种：每种都作为该选项的一种模式提供（状态、轨道或生命池，以其标签表示），与武器的模式相同；没有选择任何模式的使用，会按此顺序执行目标第一个有对应内容的那一种。它至少需要两种治愈可供选择。

降低的最大值可以不需要自己的豁免（Capability API 1.235）。不带 `save` 和 `difficulty` 的 `reducesMax`，每次打击命中都按其伤害降低最大值（5e 的 vampire Bite）；带 `"onFailedSave": true` 时，只在目标没有通过条目自身的豁免时才降低（5e 的 Harm，一个带豁免的目录条目；在那里 `reducesMax` 从不带自己的豁免）。`damageType` 只计算该类型的伤害（Bite 的黯蚀伤害），`"heals": true` 让施放者恢复与降低量相等的生命值。目录的 mechanics 也接受 `reducesMax`，`leavesAtLeast` 让条目的伤害不会使目标的生命值低于这个数（Harm 保留 1）。生物行动或目录 mechanics 上的 `targetHolds` 限制它能指向谁：带有其 `conditions` 之一的人，或带有由该行动施放者施加的其 `fromSelf` 之一的人（Bite：被 vampire 擒抱，或失能或被束缚）。

状态可以给其持有者带来自己的使用方式（Capability API 1.236）。战斗状态的 `actions` 列出持有者在带有该状态期间可以使用的目录条目（`spells/break-enchantment`）：它们只在那时出现在菜单上，除了各自消耗的额度外，不从人物卡支付任何东西，并以持有者自己的数字掷骰，与其法术相同（会施法的生物使用其施法数值）。带 `"endsCondition": "<condition>"` 的条目在使用后结束其使用者身上的该状态，当维持该状态的专注属于使用者自己时，也一并结束那份专注：5e 的 Dispel Evil and Good，其 Break Enchantment 和 Dismissal 都会结束该法术。`ends.from`(类型和标签测试) 只治愈通过该测试的生物所施加的东西：Break Enchantment 结束由天界生物、元素生物、精类、邪魔或不死生物施加的魅惑或恐惧，而保留由其他任何人施加的。`dismisses` 把它作用到且未通过豁免的人送出战斗，对方仍然活着，但离开棋盘和行动顺序：`true` 表示永久（Dismissal），`{ "while": "<condition>" }` 表示在他们带有该状态期间，该状态必须由同一条目施加（5e 的 Banishment）。此时其计时按施法者的回合进行，当它因时间耗尽、豁免或施法者专注结束而结束时，他们会回到原来的位置，或回到最近的能容纳他们的空位。带 `gone`(类型和标签测试) 时，通过测试、且状态持续满全部时间的人会一直离开。

战斗开始时，部分参与者可以措手不及（Capability API 1.237）。由场景说明是谁：生成战斗的遭遇战会把他们标记为 `"surprised": true`，队伍或敌人都可以。在他们的第一个回合，他们不能移动或行动，菜单中只有结束回合；在那个回合结束或第一轮结束之前（以先到者为准），他们不能进行反应，也不能使用传奇动作。带 `"cannotBeSurprised": true` 的战斗状态让其持有者永远不会措手不及：5e 的 Foresight。带 `"ignoresSurpriseWith": "<catalog>/<entry>"` 的目录条目指定一种持有者在措手不及时仍可进行的使用，进行它会当场结束措手不及，因此回合余下的部分归他们所有：5e 的 Feral Instinct，让措手不及的野蛮人先进入狂暴就能正常行动。

目录条目可以让持有者在战斗第一轮获得第二个回合（Capability API 1.238）。在人物卡列表持有的条目上写 `"extraFirstTurn": { "initiative": -10 }`，会把第二个回合放在持有者自身先攻加上该数字的位置，排在该数字及以上的所有人之后；两个回合都是完整的回合，从第二轮起他们照常每轮进行一个回合。在第二个回合到来之前被击倒的持有者会直接错过它。带 `"unlessSurprised": true` 时，战斗开始时措手不及的人没有第二个回合：5e 的 Thief's Reflexes。

战斗状态可以把其授予的额度能买到的东西收窄为触及范围内的挥击，并在结束时在持有者的轨道上留下印记（Capability API 1.239）。带 `"grants": { "budget": "bonus", "attacks": true, "melee": true }` 时，该额度支付的那一次打击只能用在触及范围内打击的武器进行，投掷武器也只能用于其触及范围内的人，因为它是被挥动而不是被投出；有射程而没有触及的武器不会提供。`"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }` 在状态结束时（无论以何种方式结束）按等级移动持有者的实时轨道，与目录条目上的 `tracks` 相同；`applies` 和 `tracks` 可以一起出现，也可以单独出现。目录条目的 `"usesOf": "<row name>"` 消耗该行条目（其计数器行）的使用次数，而不是自己的。于是 5e 的 Frenzy 就是 Berserker 的一个条目 Frenzied Rage，带 `"usesOf": "Rage"`，它施加狂暴，以及一个随狂暴结束（`endsWith`）的 `frenzied` 状态，后者同时带有上述两项。

先攻可以掷两次，保留较好或较差的结果（Capability API 1.240）。`combat.initiative.checkAbility` 说明先攻是用该属性进行的检定，因此凡是让这类检定掷两次的东西，也会让先攻掷两次：带 `own-checks-advantage` 的状态（5e 的 Foresight），或带 `mode`、收窄到该属性或不收窄的 `checks` 调整值（Enhance Ability 在 Dexterity 上的 Cat's Grace）。人物卡列表持有的、带 `"initiativeMode": "advantage"`(或 `"disadvantage"`) 的目录条目，无论持有者带有什么，都会让其先攻掷两次：5e 的 Feral Instinct。优势和劣势与任何掷骰一样相互抵消；日志的先攻条目带有 `mode` 和被舍弃的那次投掷 `dropped`。每轮都投先攻的战斗每轮都会掷两次。仅限投掷的骰子：骰池先攻不会掷两次。

反应可以回应其持有者自身攻击的命中（Capability API 1.241）：带 `"by": "self"` 的 `"hit"` 反应，在攻击者的掷骰命中、且被打击命中的每个人都已回应之后提供给攻击者，并指向被命中者（写 `"at": "target"`）。`"weapon": true` 把任何命中时刻收窄为武器的打击：不来自任何目录的攻击，或生物的单目标行动。对自己命中的反应不会被阻止反应的东西阻止，因为选择它是攻击的一部分；除非它确实消耗额度，否则请标为 `"free"`。5e 的 Stunning Strike 就是一例：`"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`，免费、消耗一点 ki、一次 Constitution 豁免，以及持续到武僧下个回合结束的 `stunned`。带 `"addsToBlow": true` 时，攻击条目的数量会加入那次打击，而不是单独造成：在打击落下时掷骰，随其重击翻倍，其子项只作用于它们能触及的目标。5e 的 Divine Smite 是 2d8 光耀伤害，`perCostStep` 1d8，一个对 fiend 或 undead 以 `targetIs` 生效的 1d8 光耀子项，以及 `"perCostStepsMax": 3`：对任何带 `perCostStep` 或 `targetsPerCostStep` 的条目，表示更高费用最多计入几级。在另一个窗口内进行的攻击（借机攻击）从不会因命中而暂停，因此不会给它加入任何东西。

人物卡持有的东西可以改变其攻击行、授予打击，并等待攻击动作（Capability API 1.242）。人物卡列表持有的、带 `attackRows` 的目录条目，在其 `when` 界限成立时（人物卡上的一个值，例如所穿护甲至多为 0），改变名称列在其中的行（不区分大小写匹配）：`abilities` 在命中上，以及在该行伤害加上同一属性时的伤害上，使用该行自身属性与这些属性中最好的一个；`die`(`from` 一个人物卡值，经过阶梯 `table`，得到面数) 在平均值更好时，掷一颗该面数的骰子代替该行的骰子；`qualities` 增加打击穿透抗性所携带的性质。5e 的 Martial Arts 写作 `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`，Ki-Empowered Strikes 写作 `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`。持有条目的 `grantsStrike` 让持有者在攻击自身的额度用完后，用另一种额度购买一次打击，与状态的 `grants.attacks` 完全相同：`names` 把它收窄到这些攻击，`melee` 收窄到触及范围，`afterAttack` 收窄到进行过攻击动作的回合（`true`，或写 `{ "names": [...] }` 表示用其中之一进行的攻击动作）。Martial Arts 的额外徒手打击写作 `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`。状态的 `grants` 接受同样的 `names` 和 `afterAttack`。带 `afterAttack` 的条目只在攻击动作之后提供：Flurry of Blows 是一个使用 bonus 额度的 `utility` 条目，消耗一点 ki，带 `afterAttack`，`gives` 一个声明数量为 0 的额度 2 次，并带有一个在该额度上进行 Unarmed Strike 的 `grantsStrike`。攻击动作是指从攻击列表或物品进行、支付其自身额度或使用已买到打击的任何攻击，绝不包括由授予支付的攻击。

借机攻击会在命中处暂停，与回合中的攻击完全相同（Capability API 1.243）：会询问对该命中有回应的每个人，施放者最后回答，以加上自己的东西（Divine Smite、Stunning Strike），而行走自身的窗口（其打击者已回答）在打击落下后才继续询问。途中被定住的行走者（带 `speed-zero` 的状态，例如震慑或被擒抱）不会走出被打中的那一格。属于反应或加到另一次打击上的条目，永远不会被选作借机攻击本身。

攻击规则会作用于手持武器，攻击列表也可以给每张人物卡一行（Capability API 1.244）。`combat.attacks[].always` 列出最多 4 行，按该列表的列书写，每张人物卡的战斗除了自己的行之外都会有它们；同名的人物卡行会取代它。5e 的徒手打击写作 `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`。`attackRows` 规则的 `names` 现在也能按手持武器的攻击所用名称匹配，其 `items` 按标签匹配手持武器：`tags` 全部具备且 `notTags` 一个都没有（`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`，因此 dagger +1 也算）；规则指定 `names`、`items` 或两者。`wielding: { "only": {...} }` 带同样的 `names`、`tags` 和 `notTags`，只在手持的每件武器都属于其中、或没有手持武器时才保留规则：“徒手或只持武僧武器”。`grantsStrike` 接受同样的 `wielding`，以及与 `attackRows` 规则相同的 `when`，因此穿着护甲时不会提供 Martial Arts 的额外打击。

一次多次使用、降到 0 的豁免、指定攻击的命中，以及状态结束时的伤害（Capability API 1.245）。条目的 `usesSpent` 在一次使用中消耗其所在行（或 `usesOf` 的行）这么多次使用次数，并且只在还剩这么多次时提供：Quivering Palm 的 3 点 ki。`"hit"` 反应的 `names` 只回应这些攻击的命中，按名称不区分大小写匹配：Quivering Palm 写作 `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }`，施加一个持续很久的 `quivering` 状态。带豁免的条目上的 `dropsOnFailedSave` 让豁免失败的目标生命降到 0，而不是造成其数量的伤害（生物出局；在规则集有濒死规则时，角色进入濒死）；通过豁免的目标按豁免的 `onSuccess` 受到其数量的伤害。结束振动是一个行动，带 `targetHolds: { "fromSelf": ["quivering"] }`、10d10 黯蚀伤害、`onSuccess: "none"` 的 Constitution 豁免以及 `dropsOnFailedSave`。状态的 `onEnd.harm`(`dice`、`flat`、`type`、`unless`) 在状态结束时对其持有者造成伤害，来源是施加者，除非持有者属于 `unless` 指定的类型：Hurl Through Hell 是一个命中反应，带 `dismisses: { "while": "hurled" }`，`hurled` 持续 `{ "rounds": 1, "of": "source" }`，而 `hurled` 状态的 `onEnd` 是 `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`。

`afterAttack` 也会按标签匹配进行攻击动作所用的武器（Capability API 1.246）：`{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }` 表示在用这些名称之一进行攻击之后，或用一件 `tags` 全部具备且 `notTags` 一个都没有的手持武器（不论它叫什么）进行攻击之后，因此 dagger +1 也算。它指定 `names`、`items` 或两者，在条目上、`grantsStrike` 上或状态授予上都一样。

鲁莽与凶残的打击（Capability API 1.247）。带 `beforeAttack` 的条目只在持有者自己的回合、且在该回合攻击之前提供：Reckless Attack 是野蛮人身上的一个免费 `buff`，带 `beforeAttack`，施加持续 `{ "rounds": 1 }` 的 `reckless` 和持续 `{ "rounds": 1, "at": "turn-start" }` 的 `exposed`。对攻击的改动像对伤害的改动一样接受 `attacks`(`weapon`、`spell` 或 `any`) 和 `blow`(`melee` 或 `ranged`)，以及 `ability`：`reckless` 写作 `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`，`exposed` 带 `attacks-against-advantage` 效果。伤害改动的 `criticalDice` 只在重击时加上这么多颗打击自身的伤害骰，且不翻倍：Brutal Critical 是野蛮人某个派生值上的等级，带 `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`，每颗骰子一个等级。

对连击命中的回应（Capability API 1.248）。`hit` 时刻的 `budget` 把它收窄为由该额度支付的打击所造成的命中：Open Hand Technique 回应 `{ "on": "hit", "by": "self", "budget": "flurry" }`，即 Flurry of Blows `gives` 并由其 `grantsStrike` 消耗的额度。反应的 `oneOf` 指定一组对持有者自身命中的回应，每次命中只能采用其中一个：Open Hand Technique 是三个共用 `"oneOf": "open-hand"` 的免费条目，一个带 Dexterity `save` 并施加 `prone`，一个带 Strength `save` 和 15 的 `push`，还有一个施加带 `cannot-react` 效果、持续 `{ "rounds": 1, "at": "turn-start" }` 的状态。采用其中一个会用掉这次命中的另外两个；下一次命中会再次提供全部三个。`oneOf` 写在 `by` `self`、不带 `also` 的 `hit` 时刻上。

掷骰之后的补救（Capability API 1.249）。带 `"rescue": true` 的 `attacks`、`saves` 或 `checks` 改动会在掷骰时先保留：只有当持有者自己的掷骰差一点、而它的最大值（固定部分加上每颗骰子的最高面）能补足差距时，才会掷出并加上它，它所来自的状态也随之用掉。无法扭转结果的掷骰会保留它。Bardic Inspiration 是施加给盟友的一个状态，带 `{ "to": "saves", "dice": "1d6", "rescue": true }`，`attacks` 和 `checks` 也一样（每种骰子大小一个状态，像其他档位一样按吟游诗人的等级选择）；Guidance 是带 `1d4` 的 `checks`，Resistance 是带 `1d4` 的 `saves`。自然未命中永远不会被补救，骰池战斗不保留任何东西。条目的 `rescue` 让它离开菜单：在持有者自己的同类掷骰失败时，它会连同使用次数和费用一起被用掉。`{ "roll": "saves", "by": "reroll" }` 重掷豁免，以新结果为准（Indomitable 用自己的使用次数；Diamond Soul 以 `usesOf` 使用 Ki）；`{ "roll": "attacks", "by": "success" }` 把未命中变为命中，`{ "roll": "checks", "by": "success" }` 把失败的检定变为成功（Stroke of Luck）。保留的改动会先尝试。

Cutting Words 与 Evasion(Capability API 1.250)。条目的 `lowersRoll` 在别人的攻击命中时、于不带 `by` 的 `hit` 反应上采用（用 `for` 和 `within` 为盟友回应）：其 `dice`，或像 Martial Arts 那样按某个值确定大小的一颗 `die`(`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`)，会从掷骰中扣除，然后再与防御比较一次；自然命中仍然命中。Cutting Words 是一个免费 `debuff`，带 `{ "on": "hit", "for": "ally", "within": 60 }`，并以 `usesOf` 使用吟游诗人的激励计数器。战斗状态或等级的 `evasion` 指定豁免：对抗成功时减半的效果，豁免成功则不受伤害，失败则只受一半。Evasion 是游荡者或武僧等级上的一个等级，带 `"evasion": ["dex_save"]`。

Lay on hands(Capability API 1.251)。条目的 `usesChosen` 让使用者选择一次使用消耗多少次使用次数，从一次到剩余的全部，并治疗相应倍数的数量。选项带有 `amount: { max }`，选择则发送 `amount`；省略时，消耗按平均值能把第一个目标完全治好的次数。它用于没有 `usesSpent` 的 `heal`。Lay on Hands 是 `"amount": { "flat": 1 }` 的 `heal`，以 `usesOf` 使用每圣武士等级五点的计数器，带 `usesChosen` 和 `"targetTypes": { "not": { "types": ["undead", "construct"] } }`。

Font of magic(Capability API 1.252)。条目的 `restore` 在 `heal` 或 `buff` 上为它作用到的人恢复某个池：实时池用 ID 指定，列表行的池用其名称指定（`"Sorcery Points"`）。当 `cost` 位于一个池组中时，`perCostStep` 会为高出最便宜一级的每一级增加它，因此术士的法术位会变成等于其等级的 Sorcery Points：一个消耗 `slots_1` 的自身 `buff`，带 `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }` 和 `"perCostStep": { "flat": 1 }`。`overMax` 允许它超过池的最大值；超出的部分单独保存，在休息把池恢复到最大值时消失。用点数制造的法术位是每个等级一个条目，以 `usesOf` 使用点数，`usesSpent` 为其价格，并带 `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`。为使用者自己恢复其并不拥有的池的条目，不会出现在其菜单上。

Metamagic(Capability API 1.253)。条目的 `alters` 改变其 `catalogs` 中条目的使用方式：它自己从不出现在菜单上，而是随每个适用的条目一起提供，在使用该条目时选择，并用自己的使用次数支付（以 `usesOf` 使用 Sorcery Points，配合 `usesSpent`，或按法术支付等级的 `usesSpentByLevel`，至少一点）。它是不带反应的 `utility`。每次使用只能有一个，除非它 `joins` 另一个。它能改变的内容如下，每种只适用于它确实有东西可改的法术：`spares`(人物卡上的一个值：它卷入的使用者及其盟友中，有这么多人直接通过其豁免：Careful)、`range`(`{ "times": 2, "touch": 30 }`：Distant)、`rerolls`(低于平均值的这么多颗伤害骰重新投掷，从最低的开始：Empowered，带 `joins`)、`lasts`(它施加的持续一分钟或更久的东西，持续时间变为这么多倍，但不超过一天：Extended)、`heightens`(其第一个目标的第一次豁免带劣势：Heightened)、`budget`(`{ "from": "action", "to": "bonus" }`：Quickened)、`drops`(此后不再需要的成分，并且没有人能回应它的施放：Subtle) 和 `twins`(为单目标、并非只能作用于使用者自身、且不因更高法术位获益的法术增加一个目标：Twinned)。眼下只能借助其中某一项才能施放的法术（动作用完后的 Quickened、Silence 中的 Subtle）会带 `alterNeeded` 提供，选择必须带上它。选择发送 `alters`，即选项 `alters` 中的 ID；日志写 `altered`。

选择时的 Metamagic(Capability API 1.254)。`rerolls` 在法术的所有伤害骰中重投最低的那些，总共不超过这么多颗：它自己的、`plus` 中每个子项的，以及重击时剩余数量范围内的额外骰子。攻击法术对它命中的每个目标分别掷这些骰子。当 `spares` 改动卷入的使用者一方人数多于它能放过的人数时，由使用者选择放过谁：选项的 `alters` 提供中带有 `spares`(数量)，选择则发送 `spares`，即使用者一方要放过的人的 ID(一个都不写就谁也不放过)。省略时，放过它最先卷入的人。这个选择在回应施法的窗口中保持有效。在不放过任何人的改动上写 `spares`、ID 多于它能放过的人数、同一 ID 写两次或写了另一方的 ID，都会以 `bad-alter` 拒绝。

Heightened 的目标与 Acid Arrow(Capability API 1.255)。当 `heightens` 改动卷入多于一人时，由使用者选择谁的第一次豁免带劣势：选项的 `alters` 提供中带有 `heightens: true`，选择则发送 `heightens`，即一个参战者的 ID(在它指向某些人时，必须是它所指向的人之一，并且绝不能是使用者自己)。省略时，取它最先卷入的人。带 `halfOnMiss: true` 的条目（必须有 `attackRoll` 和 `amount`）在未命中时仍造成一半伤害，其子项也一样，但不产生命中时的其他任何效果。`applies` 项的 `harmsPerCostStep`(`{ "dice": "1d4" }`) 让该状态的 `harms` 在其施加时每高出一级费用就多造成这么多：Acid Arrow 的后续酸蚀伤害，法术位每比 2 环高一级多 1d4。

持有者自己的补救、从不作用于使用者的条目，以及一次只能有一个的状态（Capability API 1.256）。条目的 `rescue` 也可以是 `by: "twenty"`(只能配合 `roll: "checks"`)：失败检定的 d20 视为 20，只在这样能让检定成功时才用掉，就像 Stroke of Luck 对属性检定所做的那样。`by: "die"` 在给予持有者的任何东西都无法补足差距、而这颗骰子可以时，加上一颗持有者自己的骰子：`dice`(`"1d10"`，Dark One's Own Luck)，或按人物卡上的值确定大小的一颗 `die`，`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`(Peerless Skill)。给予他们的状态会先尝试。指向 `ally` 或 `any` 生物的条目上的 `notSelf: true` 让它不能作用于使用者自己：Bardic Inspiration。战斗状态的 `oneAtATime` 指定一个组（`"bardic"`）：当一个生物带有该组的一个状态时，该组的其他状态（包括同一个状态）都不会生效；状态事件写 `already`。

回应更多种类的掷骰（Capability API 1.257）。`lowersRoll` 还可以列出 `"also": ["checks", "damage"]`：除了命中的攻击掷骰，它的骰子还会在别人的属性检定（擒抱之类的对抗、物品的 gate、Counterspell 的检定）或伤害掷骰进行时从中扣除。这种用法会自动用掉，连同条目的额度、使用次数和费用，由另一方中第一个其条目能触及掷骰者的人使用，并且只在其最大值能扭转掷骰时才用掉：本会成功、扣除后可能失败的检定，或本会让其持有者一方某人倒下、扣除后可能让其继续站着的伤害。Cutting Words 写作 `{ "dice": "1d6", "also": ["checks", "damage"] }`，其骰子大小按等级确定，带 `needs: ["hearing"]` 和 `targetTypes: { "notImmuneTo": ["charmed"] }`。补救可以指定 `saves`(只适用于 `saves` 的补救)：它只在这些豁免上用掉。带 `budget` 时，它还会消耗一份该额度，没有该额度时不会用掉：ring of evasion 写作 `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }`，以其充能作为使用次数。物品的使用也可以带 `halfOnMiss`，配合 `attackRoll` 和 `amount`：Acid Arrow 卷轴。

疾病（Capability API 1.258）。战斗状态的 `kinds`(`["disease"]`) 说明它是哪种状态。种类绝不能是状态自己的 ID。治愈的 `ends` 可以用种类代替状态：该种类的每个状态都计入，而其 `count` 仍只移除这么多个，因此 Lesser Restoration 的“一种疾病”写作 `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`。免疫（生物或物品的 `conditionImmunities`，或状态或等级的免疫）也可以指定种类：Divine Health 是一个带 `"conditionImmunities": ["disease"]` 的状态。`saveEnds` 可以计数：`successes`(2 到 10) 是结束它所需的成功次数，`failures`(`{ "count": 3, "becomes": "blinding_sickness" }`) 在这么多次豁免失败后，改为施加 `becomes`，不带计时，也不再豁免。状态事件写 `worsened`。这就是 Contagion：一个在每个回合结束时进行豁免的 `until-save` 状态，成败各三次。没有计时的状态在战斗结束时不会解除，因此已经发作的疾病会在战斗之后持续，直到有东西治愈它。

穿戴物品上的补救（Capability API 1.259）。物品的 `use` 可以像条目的 mechanics 一样带 `rescue`，包括 `saves` 和 `budget`。它从不出现在菜单上，只在物品处于穿戴状态（有槽位时）、且有其使用所消耗的 `charges` 时才会用掉。用掉它会消耗一点充能。ring of evasion 是一件带 `"charges": { "max": 3 }` 和 `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }` 的物品。其充能按物品的 `recharge` 恢复。

战斗之间的疾病（Capability API 1.260）。战斗状态可以带 `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }`：持有者在带有它时每进行一次这些休息，在休息恢复其应恢复的内容之后，生命的最大值就降低这么多，在休息时掷出。没有 `lasting` 时，下一次休息会恢复它；有它时，只有解除封存的东西才能恢复。`onRest.save: { "save": saveId, "difficulty": 15, "cures": true }` 会先掷，与规则集的检定一样，并使用人物卡自身的调整值：只有失败才降低最大值，带 `cures` 时成功会结束该状态（otyugh 的疾病）。只有以点数计的生命才有可降低的最大值。5e 的 Mummy Rot 是一个没有计时的状态，带 `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`。计数到结束或到转变的豁免（1.258）不再随战斗结束而停止：任何战斗结束时（包括逃跑），持有者剩余的回合豁免都会掷完，因此 Contagion 到那时要么被摆脱，要么已经发作。只在受伤时进行的豁免会等到受伤时。

疾病的阶段（Capability API 1.261）。战斗状态可以带 `onDamaged: { "applies": [...] }`，每次持有者受到伤害时施加给他们，计时方式与 `onEnd` 的相同（Slimy Doom 的震慑，持续到持有者下个回合结束）；`expires: { "becomes": conditionId }`，在其自身计时耗尽时（包括战斗结束）转变成的状态，不带计时，但以其他方式结束时不会转变（aboleth 的 Tentacle 疾病在一分钟之后）；以及 `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`，只有以该等级或更高等级支付的、来自这些目录的治愈才能结束它。`onRest.restoredWhenCured: true`(配合 `lasting`) 在该状态解除时（无论以何种方式，包括自身豁免成功），归还其休息从最大值中夺走的部分。`cannot-heal-nonmagical` 效果挡住除魔法治疗以外的一切治疗：战斗中是性质写有 `"magical"` 的行动，战斗外是带 `"magical": true` 的恢复操作（标记为 `magical` 的药水就是一例），休息永远不算；被拒绝的恢复会写 `cannot-heal`。数值块中的行动可以像目录条目一样带 `ends`，包括种类：unicorn 的 Healing Touch 写作 `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`。由施法者在其状态中选择的治愈（多个诅咒中的一个）使用 `cureOneOf`(1.204)。

生物行动上的性质（Capability API 1.262）。数值块中的行动可以像目录条目一样带 `qualities`，即规则集声明的物品标签：`["magical"]` 让它的治疗成为魔法治疗，可以穿过 `cannot-heal-nonmagical`，针对它的豁免也算作针对魔法的豁免。物品在战斗中的使用以同样方式带上物品自身的标签，因此标记为 `magical` 的药水在战斗中也像在人物卡上一样以魔法方式治疗。

光环（Capability API 1.263）。战斗状态可以带 `auras`，最多四个：每个都把其 `conditions` 散布给站在持有者 `distance` 之内的人，范围按 `side` 为 `allies`、`enemies` 或 `all`，加上 `self: true` 时也作用于持有者本人（不能与 `enemies` 同用）。`when` 用 `atLeast` 或 `atMost` 读取持有者人物卡上的一个值，因此光环可以在某个等级开启。倒下、被击败或带有 `cannot-act` 效果的持有者不散布任何东西。光环散布的东西随战斗推进而生效，在两者分开时移除（日志写 `aura` 和 `parted`），从不写入人物卡，并在战斗结束时消失；光环散布的状态本身不能再带光环。没有棋盘时，光环会触及其一方的每个人。要让持有者在每场战斗开始时就带有该状态，请给目录条目的 mechanics 或数值块加上 `keepsOn`：它在整场战斗中持有的状态，同样从不写入人物卡。5e 的 Aura of Protection 是一个保持的 `aura-of-protection`，其光环散布一个把圣武士的 Charisma 加到豁免上的状态；Holy Nimbus 是一个作用于敌人的光环，其状态在敌人回合开始时造成伤害。

强制行为（Capability API 1.264）。战斗状态可以带 `behavior`，决定持有者在其回合做什么。`only` 列出回合中除结束回合之外能做的所有事：`move`(行走和起身)、`escape`(挣脱束缚) 以及规则集声明的标准行动；空列表只留下结束回合（Command 的 halt）。`onlyWhenStuck` 指定只有在无处可走时才允许的标准行动（Turn Undead 的 Dodge）。`moves: "away"` 只能远离施加该状态的人行走，绝不靠近一步，结束时离得更远；`moves: "toward"` 只能靠近（Command 的 approach、Sympathy）。`table` 在持有者每个回合开始时掷一次，`{dice, rows: [{atMost, does}]}`，掷骰结果不超过的第一行决定这个回合：`wander` 朝 d8 选出的方向走完全部速度并结束回合，`nothing` 直接结束回合，`strike` 只允许对骰子选出的、在触及范围内的一个生物进行近战攻击（不论敌友；那里没人则什么也不做），而 `normal` 与高于每一行的掷骰一样，不干预这个回合（Confusion、Mindfire）。日志把这次掷骰显示为 `compelled` 事件，其他任何行动都会以 `compelled` 拒绝。结束状态的豁免也可以是 `at: "action"`：持有者花费其动作进行该豁免（Irresistible Dance）。

光环的更多用法（Capability API 1.265）。光环的 `conditions` 现在是可选的，只要它散布状态、造成伤害或要求豁免即可。`needs` 列出接收者必须具备的感官，持有者和接收者都不能站在 `inside.conditions` 会夺走这些感官的区域中：带 `needs: ["hearing"]` 的 Countercharm 会被 Silence 阻断。`harms` `{dice, flat, type}` 在持有者自己的每个回合开始时，由持有者对光环触及的每个人造成（balor 的 Fire Aura）。`save` `{save, difficulty, applies, seen?, immuneOnSuccess?}` 由光环触及的每个人在其自己的回合开始时进行：失败时以该难度施加来自持有者的 `applies`，`seen` 只在两者能互相看见时才要求豁免（basilisk 的凝视），`immuneOnSuccess` 在成功之后，让该持有者的光环在战斗余下时间内不再作用于他们（pit fiend 的 Fear Aura）。豁免调整值的 `against.casts` 把它收窄为针对从这些目录施放之物的豁免（包括从其中施法的物品使用），然后再按它指定的其他内容收窄：Holy Nimbus 对邪魔或不死生物所施法术的优势写作 `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`。

更多强制行为（Capability API 1.266）。`behavior` 可以带 `drops` `{slots?, tags?, at, pickUp?}`：持有者放下占用 `slots` 之一或带有 `tags` 之一的每件穿戴物品，以及 `qualities` 带有 `tags` 之一的每个数值块行动，时机是状态生效时（`at: "applied"`，Fear 的“丢下手中所持之物”），或持有者每个回合开始时（`at: "turn-start"`，Command 的“丢下”）。掉落的东西留在他们原本站立的格子上：它的行动都不再属于他们（以 `dropped` 拒绝），它不再给予穿戴时给予的任何东西，它在持有者防御中所占的部分也消失（盾牌的 2）。他们站在那一格或其旁边时可以捡起它，使用回合中的一次免费拾取，或在状态指定了 `pickUp` 额度时消耗该额度；日志显示 `letFall` 和 `pickedUp`。`onlyWhenStuck: "any"` 让开始时按状态允许的方式无处可走的回合，完全归持有者自己支配（Fear 的“除非无处可移动”）。`keepsOut` 是与施加该状态之人的距离：在这个距离之内，持有者只能往更远处走，并且只要距离之外的任何位置可以到达，就只会停在距离之外（Turn Undead 的“不能主动移动到距离你 30 英尺以内的空间”）。结束状态的豁免可以是 `unseen: true`，只在持有者看不见施加者时才进行（Fear 在视线之外的豁免）。条目的 `applies` 可以带 `destroysUpTo` `[{tier, when?}]`：豁免失败、且其威胁档位不高于使用者人物卡上 `when` 成立的最高 `tier` 的生物，会被直接摧毁（Destroy Undead，牧师 5 级时 CR 1/2，到 17 级时 CR 4）；角色或没有档位的生物永远不会。

按任一感官选取目标、彼此靠近的目标、增长的范围、更多使用方式以及持有物（Capability API 1.267）。`needs` 感官的条目或生物行动可以加上 `needsAny: true`：保有其中任意一种的目标即符合条件，只有全部缺少的目标才会被拒绝（Turn Undead 的“每个能看见或听见你的不死生物”）。`targetsWithin` 是所选目标两两之间必须在其之内的距离，否则以 `targets-apart` 拒绝（Command 在更高法术位时的多个生物须“彼此相距 30 英尺以内”）。`area` 可以带 `sizePerCostStep`，即其费用每提高一级，大小增长的距离（Confusion 的球体每高一环增长 5 英尺）；墙永不增长。带 `use` 的物品可以列出 `moreUses` `[{label, use}]`：每项都是另一个菜单条目，以物品名称和其 `label` 命名，使用相同的充能，并随物品一起掉落（多法术的魔杖）。生物可以列出 `held` `[{label, tags, defense?}]`，即它持有、但并非其自身行动的东西（数值块上印着的盾牌）：`drops` 指定了其 `tags` 之一的状态，会让它们连同带该标签的行动一起掉落，它们的 `defense` 会从生物自身的防御中消失，直到生物捡起它们，每样东西的捡起方式都与掉落的物品相同。

凝视，以及按触及对象区分的光环（Capability API 1.268）。光环可以带 `targetTypes`，读法与条目的相同：它只触及属于该类型的人（sea hag 的 Horrific Appearance，只对类人生物）。`sourcesOf` 指定状态：它只触及对其持有者施加过其中某个状态的人（barbed devil 的 Barbed Hide，伤害擒抱它的人）。光环的 `save` 可以带 `failedBy` `{atLeast, applies}`：失败幅度至少达到该值时，改为施加这些状态（medusa 的凝视，失败 5 或更多时直接石化）。`seen` 豁免可以带 `avert: true`：它触及的人可以在自己的回合免费将目光从其持有者身上移开；在他们再次看过去之前（这同样是他们自己的免费选择），他们跳过该豁免，也看不见持有者，因此他们对它的攻击视为在看不见的情况下进行；日志显示 `averted`，只要还有其他人在战斗，调度器就会让其生物保持移开目光。结束状态的豁免可以带 `seenLean`(`"advantage"` 或 `"disadvantage"`)：在持有者能看见施加者时，以此方式掷骰（sea hag 的重复豁免，她在视线内时带劣势）。

用持有者数值施法的法杖（Capability API 1.269）。物品的 `use` 可以用 `sheetDifficulty` 从持有者的人物卡读取其豁免难度，读取方式与 `toHit.sheetBonus` 读值相同（`{ "derived": "spell_save_dc" }`），代替 `saveDifficulty`；其攻击加值本来就以同样方式从人物卡读取，用 `toHit.sheetBonus`(`{ "derived": "spell_attack" }`) 且不带属性。带 `charges` 的使用可以带 `chargeStep` `{max, amount?, targets?}`：使用者最多可以多花 `max` 点充能，每点算作更高一级的费用，像更高法术位增加 `perCostStep` 和 `targetsPerCostStep` 一样增加 `amount` 和 `targets`，并用 `sizePerCostStep` 扩大范围（Staff of Power 以更高等级施放的法术、Staff of Striking 每点充能 1d6 力场伤害）。菜单以名为 `charges:<how many more>` 的支付方式提供它们，数量以物品剩余的充能为限。同一小版本把规则集可声明的状态数量提高到 320，光环的 `save` 还可以带 `immuneWhenEnds: true`：一旦失败所施加的东西结束（无论是豁免、计时还是治愈），该持有者的光环在战斗余下时间内不再作用于他们，就像 `immuneOnSuccess` 在豁免成功后让光环不再作用于他们一样（sea hag 的“豁免成功或效果对其结束”）。

施放时指定的种类（Capability API 1.270）。带 `applies` 的目录条目 `mechanics` 可以带 `kindChoice: true`：使用者在使用时指定 `combat.creatureTypes` 中的一项（类型或标签），以模式 `kind-<id>` 提供，它施加的东西会记住这个种类。它所施加之物的光环带 `chosenKind: true` 时，只触及该种类的生物；带 `orSeen: true` 时，还会触及能看见其持有者的人，无论距离多远。因此 5e 的 Antipathy 会在目标身上施加一个状态，其光环（`side: "all"`）让 60 英尺内或视线内的所选种类陷入恐惧，被恐惧者会远离（`moves: "away"`），而 Sympathy 的被魅惑者会靠近。状态的 `saveEnds` 可以带 `beyond`，以规则集的距离单位计：只有当持有者与施加者的距离超过该值时才进行豁免，加上 `unseen` 时还需不在其视线内（Antipathy 的“不在目标 60 英尺内，也看不见它”）。

法杖和戒指的更多作用（Capability API 1.271）。物品的 `use` 可以带 `label`，像 `moreUses` 项的标签一样显示在物品名称旁（“Staff of Fire: Burning Hands”）；其他用法以各自的 `label` 命名。使用可以带 `amountAdd`，即从持有者人物卡读取并加到其数量上的值，与目录条目的相同（Staff of Healing 的 Cure Wounds，`{ "abilityModFromField": "spellcasting_ability" }`），在战斗中和战斗外都有效。`chargeStep` 可以带 `push`，以规则集的距离单位计：每多花一点充能，就把目标再推远这么多，与使用自身的 `push` 叠加（Ring of the Ram 每点充能 5 英尺）。物品的 `charges.breaksOn` 可以带 `regains` `{atLeast, amount}`：在最后一点充能用掉、且其骰子显示 `atLeast` 或更高时，物品改为恢复 `amount` 点充能（Staff of the Magi 在掷出 20 时恢复 1d12 + 1），在战斗中、战斗外以及物品栏消耗充能时都适用；对永不损坏的物品，此时可以省略 `atMost`。

变成另一件物品的物品（Capability API 1.272）。物品的 `charges.breaksOn` 可以在 `atMost` 旁边带 `becomes`，即规则集中以 `<catalog>/<entry>` 指定的另一件物品：在会让它损坏的点数上，物品改为变成那件物品（Staff of Striking 变成非魔法的长棍，或 Staff of Power 变成只保留 +2 的物品，后者写成一件只带这一项的物品）。在战斗中，它的使用方式随之消失，此后以新物品的身份打击，战斗会把那一叠作为该物品写回，使用其名称且不带充能；在战斗外以及物品栏消耗充能时，那一叠也以同样方式改变。所指定的物品必须是规则集中的另一件物品，无论它在哪个目录文件中。

命中时消耗的充能（Capability API 1.273）。武器的 `attack.spends` 列出最多四种方式，让持有者在用它打出的一击命中后消耗物品的充能：每种都有 `label`、所需的 `charges`、加到这次打击上的骰子与固定部分 `amount` 及其伤害 `type`(未指定时为武器的类型)，以及可选的 `blow`(只限 `melee` 或 `ranged` 打击)、`chargeStep`(最多再花 `max` 点充能，每点再加一次其 `amount`：Staff of Striking 每点充能 1d6 力场伤害，最多三点) 和 `onHit`(被命中者受到的最多两个状态，每个带 `rounds`、能挡住它的 `save`，或 `saveEnds`：Staff of Withering 的 Constitution 豁免)。在战斗中，每种方式只在持有者用这把武器命中时提供给持有者，在被命中者回应之后提供；其骰子随打击一起掷出，并随其重击翻倍，物品的最后一点充能骰也像使用时一样掷出。该物品须持有充能。

按施加者确定的数字（Capability API 1.274）。条目 `applies` 的状态可以带 `value`，即在状态生效时从施加者人物卡读取的值引用（Heroism 的 `{ "abilityModFromField": "spellcasting_ability" }`）；战斗状态的 `temporary` 在持有者每个回合开始或结束时（`at`）给予其临时点数：`dice` 和 `flat`，带 `value: true` 时再加上该值；带 `lostWhenEnds` 时，状态结束时剩下的临时点数会随之消失，除非持有者从别处获得的临时点数比它给的更多。光环的 `save.appliedDifficulty` 让其豁免对抗把光环状态施加到其持有者身上的那个东西的豁免难度，在状态生效时确定（Antipathy/Sympathy 施法者的法术豁免 DC）；对没有被任何东西施加的光环，仍使用其 `difficulty`。`at: "damaged"` 时结束状态的豁免可以写 `bySource`：只在施加者造成伤害时才进行（Sympathy 在目标伤害其持有者时的豁免）。状态的 `behavior.keepsIn` 让持有者一旦进入与施加者相距该距离之内，就再也不能往更远处走（Sympathy 的“不能主动远离”）。此外，物品的 `use` 可以像条目的 mechanics 一样带 `kindChoice`(1.270)，因此 Antipathy/Sympathy 的卷轴会在使用时指定其种类。

被压制而非结束的状态（Capability API 1.275）。与 `whileSourceInSight` 并列，战斗状态的 `orSourceWithin`(以规则集自身单位计的距离) 让它在持有者离施加者这么近时持续生效，无论看不看得见：既不在视线内也不在距离内时，它被压制，仍留在持有者身上，计时照常运行，一旦其中任一条件成立就立即重新生效（Antipathy 的恐惧，在 60 英尺内或视线内）。战斗状态的 `suppresses` 列出它生效期间压制的其他状态：它们的作用停止，但仍留在身上，并在它结束后重新生效（Calm Emotions 的魅惑和恐惧、Mindless Rage 的同类状态）。

传送（Capability API 1.276）。目录条目的 `mechanics.teleport`、物品的 `use.teleport` 或生物行动的 `teleport`，会立即把使用者移到 `distance`(规则集自身单位) 之内的一个空位：中间没有任何一步，因此没有人能在其离开时打击，它落入的区域会像走进去一样卷入它。只在棋盘上有效，因此需要 `combat.distance`；没有棋盘时，只会传送的行动不会提供。带 `seen` 时，只能去使用者此刻看得见的位置（墙、雾，或夺走视力的目盲会把其后的格子排除在列表之外）：5e 的 Misty Step，`{ "distance": 30, "seen": true }`。`carries`(1 到 8) 从 `carriesWithin` 之内（省略时为接触距离）带上使用者一方这么多个自愿的、体型不大于使用者的生物，每个都落在尽可能靠近使用者的空位：Dimension Door，`{ "distance": 500, "carries": 1, "carriesWithin": 5 }`。带传送的生物行动作用于生物自身（blink dog 的 Teleport）。选项以 `teleport.cells` 列出它能去的格子，以 `teleport.carries` 列出可以同行的人；选择以 `at` 指定格子，以 `carries` 指定同行者。传送永远不是范围或反应。

一次六个状态，以及真正看得见的视线（Capability API 1.277）。目录条目的 mechanics、物品的使用和生物行动上的 `applies` 最多容纳 6 项（之前为 4）：Rage 和 Frenzy 都在各自的四项旁加上 Mindless Rage 的状态。`whileSourceInSight`(以及与之并列的 `orSourceWithin`) 现在读取持有者自身的视线，与光环的 `orSeen` 相同：棋盘上仍需要一条无遮挡的直线，在此之上，持有者还必须用眼睛或感官看见其来源，因此夺走视力的目盲、起遮蔽作用的雾、超出其视野的黑暗，或它看不见的来源（隐形），都会像墙一样打断它。

Calm Emotions(Capability API 1.278)。豁免可以写 `alliesMayFail: true`(在目录条目、物品使用或生物行动的 `save` 上)：使用者自己一方的目标会放它进来，不掷骰直接失败，日志也会说明，而其他人照常掷骰。状态的 `effects` 可以带 `cannot-target-source-side`：持有者不能把任何东西指向施加者或其一方的任何人，除非那一方就是持有者自己的一方（此时它不排除任何人）。`endsWhen` 在 `damaged` 和 `harmed-by-source-side` 之外再接受两种结束方式，最多四种全用：`attacked`，任何人对持有者进行的攻击掷骰，无论命中与否（不掷骰就命中的行动不算）；以及 `ally-harmed-in-sight`，持有者看见其一方的其他任何人受到伤害（棋盘上有无遮挡的直线，且有它自己的眼睛或感官）。`endsWhenHarmedFrom` 列出目录：任何人从其中某个目录施放的任何东西（包括卷轴的法术和持续区域）对持有者造成伤害，都会结束它；伤害是指受到伤害，或成为有害行动的目标，与 `harmed-by-source-side` 相同，而对其再次施加同一状态会刷新它，而不是结束它。这些都会等到引起它的那一步完成后才生效。此外，持有者自身生效中的状态所 `suppresses` 的状态，不再会因同一状态给予的免疫而结束：它是被暂停，而不是被治愈，因此在免疫恐惧的狂暴开始时已有的恐惧，会在狂暴结束时回来（5e 的 Mindless Rage），而新的恐惧仍然无法施加。

传送出战斗、可见的同行者与烟雾（Capability API 1.279）。`teleport`(在目录条目、物品使用或生物行动上) 再接受三个键。`leaves: true`：它可以把使用者完全带出战斗，就像 unicorn 的一英里传送，而不是送到某一格；此时选择不指定 `at`(菜单显示一个“Leave the fight”按钮)，使用者及其同行者都活着离开（显示为“Left the fight”，生命保持不变，且没有任何东西能把他们带回来）。没有棋盘时，离开是它唯一能去的地方，使用者一方任何站着的人都可以同行，因为没有东西能测量谁站得近。有成员以这种方式离开、自身已不在战斗中的队伍视为逃跑（结果为 `fled`，与逃跑一样结束战斗）；以这种方式离开的敌人既不算被击败，也不算仍站着，而是逃脱了，战后回顾也会这样说明。调度器自己的生物在生命降到四分之一或以下时离开，并尽量带上同行者。`carriesSeen: true`(配合 `carries`)：只有使用者看得见的人才能同行，即 unicorn 的“它看得见的自愿生物”。还有 `smoke`(`{}`，或 `{ "pierced": [senses] }`)：从落地那一刻起，直到使用者下个回合结束，在使用者离开的格子和落入的格子上都会出现一团烟云，像区域的 `obscures` 一样起遮蔽作用，即 Cape of the Mountebank 的烟雾。

带打击的传送（Capability API 1.280）。生物的传送可以用 `strike`(其 `id`) 指定它自己的一个行动：blink dog 的“传送之前或之后，这只狗可以进行一次啮咬攻击。”传送之后，该行动可以在本回合免费接着进行一次（菜单显示“Free, part of the same action”），菜单还会以相反顺序提供它，即在传送的额度上的“Bite, then Teleport”，之后传送可以免费接着进行一次。两者都不会再引出第三个。先进行的打击会连同自身一起消耗传送的使用次数和充能，并且只在两者都还有剩余时提供。打击是同一生物的另一个普通行动：不能是传送本身、序列、另一个传送、反应或用点数购买的东西。只有生物的传送才能指定它；目录条目或物品使用的会被拒绝。在不测量距离的战斗中，传送哪儿也去不了，因此不会配对任何东西。调度器也会使用它：离猎物太远、走不过去的生物会传送到其旁边，并在同一回合啮咬。

吸取的打击（Capability API 1.281）。目录条目的 `mechanics` 或生物的行动可以带 `drain`：使用者恢复的生命等于这次打击对每个目标造成的伤害（在抗性之后计算，向下取整，且不超过其最大值），目标的最大值不会因此减少（要减少最大值，请见 `reducesMax`）。`share`(大于 0，最多为 1，省略时为全部) 是恢复的比例，`damageType` 只计算该类型的伤害：aboleth 的 Psychic Drain 写作 `drain: {}`，Vampiric Touch 写作 `drain: { "share": 0.5, "damageType": "necrotic" }`。阻止治疗的东西也会阻止它。吸取需要有伤害才能归还，因此写在没有 `amount` 的条目上、治疗上或没有 `damage` 的生物行动上的吸取会被拒绝。

以使用者为中心的爆发（Capability API 1.282）。`area`(目录条目的或生物行动的) 可以写 `around: true`：一个以使用者为中心、大小为 `size` 的爆发，从不需要瞄准。使用时，使用者 `size` 之内的每个人都会被卷入，不分敌友，除非 `friendlyFire` 为 false(治疗性的只卷入使用者自己一方)，且从不卷入使用者本人。两者之间的墙会把生物挡在外面，除非范围还写有 `throughWalls: true`：mummy lord 的 Channel Negative Energy，“包括屏障之后和拐角处的生物”。在没有棋盘的战斗中，它会卷入所有人。它不指向任何人，因此既可以在回合中使用，也可以作为在回合之间购买的招牌行动使用。只有单个爆发才能以使用者为中心（不能有 `copies`），`throughWalls` 只能与 `around` 一起使用，条目以使用者为中心的爆发会立即生效，因此不会留下 `zone`。Channel Negative Energy 是一个生物行动，带 `signature: { "cost": 2 }`、`area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }`，并以 `applies` 施加一个带 `cannot-heal` 效果、持续 `{ "rounds": 1, "of": "source" }` 的状态，直到 mummy lord 下个回合结束。调度器会像评估瞄准的形状一样，按它卷入的人来评估这种爆发。生物以自身为中心且会留下 `zone` 的爆发（kraken 的 Ink Cloud），无论是在该生物的回合中使用，还是在回合之间购买，都会覆盖该生物 `size` 之内的每个格子；写有 `throughWalls` 时也覆盖墙后的格子，并从此卷入区域触发条件指定的、处于这些格子中的任何人。

传奇移动（Capability API 1.283）。带 `signature` 费用的生物行动可以写 `move`，且不做其他任何事：其施放者在回合之间行走，像在自己的回合行走一样在棋盘上选一格，使用的是仅为这次移动借出的额度，因此它自己回合的移动不受影响。`move: { "share": 0.5 }` 是其速度的一部分（tarrasque“移动至多其速度的一半”），`move: { "distance": 60 }` 是以规则集自身单位计的距离，`move: {}` 则是其全部速度；不能同时写 `share` 和 `distance`。它在离开某人的触及范围时会像任何行走一样遭到打击，打击落下后，购买它的那个窗口才继续询问。`noOpportunity: true` 不会引发任何人的借机攻击（vampire“移动至多其速度，且不会引发借机攻击”）。`untouchable: true` 是任何东西都无法伤害或束缚的移动（mummy lord 的 Whirlwind of Sand，`{ "distance": 60, "untouchable": true }`）：束缚其施放者的东西会先松开，没有人会打击它，它穿过的区域或地面也不会对它产生任何作用。被定住或没有速度的生物，用其他任何移动都无处可去。没有棋盘时不会提供任何移动。调度器像购买传送一样购买移动：在重伤时脱离身旁的敌人，或在没有敌人在触及范围内时接近一个。

传奇施法（Capability API 1.284）。带 `signature` 费用的生物行动可以写 `casting`，且不做其他任何事：在回合之间，它提供施放者在自己回合用该行动的 `budget` 能施放的每个法术，来自其 `spellcasting` 或其人物卡的法术，命名为“Cast a Spell: Fireball”等。每个法术的瞄准、支付和结算都与在生物回合中完全相同（目标、范围所用的格子、照常消耗法术位或使用次数），以点数代替额度支付，因此它自己的回合保留原有的全部额度。`casting: { "cantripsOnly": true }` 只提供戏法（不从任何池支付的法术）：lich 的 Cantrip，`signature: { "cost": 1 }`。sphinx 的 Cast a Spell 是 `casting: {}`，带 `signature: { "cost": 3 }`。法术引发的任何东西（Counterspell、对被它伤害的反应）都像在回合中一样被回应，购买它的那个窗口要等这些都结束后才继续询问。调度器会在法术值得这些点数时购买，就像评估其他任何招牌行动一样。

行动之后的移动，以及按某一种速度移动（Capability API 1.285）。做某件事（伤害、范围、豁免、状态）的招牌行动也可以带 `move`：它所做的事先生效，然后其施放者可以移动到菜单提供、随行动一起选定的格子；不选也是一种选择，而做完之后已经无法到达的格子就不会去走。`move` 还可以用 `speed`(`walk`、`fly`、`swim`、`climb` 或 `burrow`) 指定一种移动方式：其 `share` 只按该速度计算，只能以该方式移动，没有该速度的生物无处可去。龙的 Wing Attack 是围绕自身的爆发（`area: { "shape": "burst", "size": 10, "around": true }`，带其豁免和倒地），加上 `move: { "share": 0.5, "speed": "fly" }`：“之后龙可以飞行至多其飞行速度的一半。”`move` 仍不能带 `teleport`、`sequence`、`reaction` 或 `charge`。调度器会在重伤且身旁有敌人时，在扇击之后飞离，或飞去接近触及范围之外的敌人。

轻度遮蔽与风（Capability API 1.286）。区域的 `obscures` 或传送的 `smoke` 可以写 `light: true`：此时它不隐藏任何人，只让透过它或在其中被看到的人处于轻度遮蔽，就像 5e 的微光或 Cape of the Mountebank 的烟雾（Engine 知道谁是以这种方式被看到的；Hide 和 Perception 会读取这一点）。它还可以写 `dispersed: true`：此时规则写有 `disperses: true` 的区域会在每个行动之后，在两者交汇处结束它，连同维持它的专注一起。5e 的 Fog Cloud 写作 `obscures: { "dispersed": true }`，其 Gust of Wind 是一个带 `disperses: true` 的区域；Darkness 两者都不写，因此风不会影响它。只负责驱散的区域不需要触发。

躲藏、Search 与 Detect(Capability API 1.287)。`combat.hiding` 让 `hide` 标准行动真正生效：`{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }` 指定 `combat.checks` 中的两项，并可选指定 `passive`(10)、`lightly`(5) 以及会发出声响的 `combat.components`。Hide 用战斗自己的骰子掷 `stealth`；之后，对于每个没有清楚看见使用者（在墙后、在雾中、隐形，或只在轻度遮蔽下看见他们）、且被动 Perception 被该总数达到的对手，使用者都处于隐藏状态；被动 Perception 为 `passive` 加上其 `perception` 检定，在对手只在轻度遮蔽下看见他们时再减去 `lightly`。使用者对其隐藏的对手看不见使用者，因此不能把任何东西指向他们，他们攻击该对手时视为看不见的攻击者，`combat.sight.unseenAttacks` 给这次攻击优势。躲藏跨回合持续，并在以下情况结束：对所有人而言，一旦使用者攻击、进行对抗、伤害某人或要求豁免，或使用了需要 `noisy` 成分的任何东西（没有言语成分的法术，或放下一团雾，会让他们保持隐藏）；对每个对手而言，在任何一步之后以及行走的每一格上，只要该对手能清楚看见他们，或其被动值现在超过了该总数。`search` 标准行动（把它加入 `combat.standard`；它需要 `combat.hiding`）掷 `perception`，为搜索者找出所有对其隐藏、且总数被这次投掷达到的人。带 `search: true` 的生物行动做同样的事，且不做其他任何事：传奇 Detect 写作 `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`。生物从自己的 `checks` 读取这两项检定。当所有对手都对它隐藏时，调度器会搜索，只要有任何对手隐藏，它就会在回合之间使用 Detect。没有棋盘时，没有人能隐藏，除非已有状态在隐藏他们。

Ready(Capability API 1.288)。`combat.readying: { "budget": "reaction" }` 让 Ready 动作真正生效：对于使用者此刻能用其 `standard` 额度采取的每个选项（攻击、法术、生物行动）以及一次行走，菜单都提供两个条目，分别准备在对手进入触及范围时（`comes`）或在对手行动时（`acts`）触发。采用其中一个会消耗标准额度，并把该选项保留到使用者下个回合开始。当对手的行走在任何一步把它带到被保留的选项能指向它的位置（且持有者看得见它），或对手在那里完成其所做的任何事时，会有一个窗口询问持有者，持有者可以用 `budget`(5e 的反应) 采取名为 `readied` 的选项，或放过它，在那次行走中不会再被询问。被保留的行走最远可以走到持有者全部速度所及之处，途中离开触及范围会像任何行走一样引发借机攻击。带 `"concentrates": true`(需要 `combat.concentration`) 时，法术在准备时就已支付，并由专注维持：触发时不会再次支付，失去专注就失去它，从未触发的法术仍算已经花费。准备其他任何东西在触发之前都不支付。5e 的写法是 `{ "budget": "reaction", "concentrates": true }`。

缓慢驱散（Capability API 1.289）。雾的 `dispersed` 可以写 `{ "after": N }` 而不是 `true`：触及它的风只有在连续吹满 N 个完整轮次后才会结束它，从风第一次触及它的那个回合开始计。在此之前风停止触及它（被移走、结束或消失），之后再有风触及时会重新计数。5e 的 Stinking Cloud 会在 Gust of Wind 这样的强风吹过 1 轮后被驱散，写作 `"obscures": { "dispersed": { "after": 1 } }`。

搜寻隐藏者时的加减（Capability API 1.290）。从技能读取的战斗检定（`{ "skillMod": "stealth" }`）现在在掷骰时算作该技能的检定，因此以 `skills` 收窄到它的改动会作用于 Hide、Search 和对抗：重甲在 Stealth 上的劣势、Pass without Trace 的 +10、Eyes of the Eagle 在 Perception 上的优势。`combat.hiding.passiveMode`(5e 为 5) 在被动 Perception 有优势时加上，有劣势时减去；没有它时，被动值不读取任何模式。改动 `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }` 让寻找其持有者的检定带上该模式，包括对手的被动值和其 Search；它只接受 `mode`，不接受其他内容。5e 的 Cloak of Elvenkind 就是如此。当一次 Search 发现某人对其掷法有所改变时，它会单独为该人再掷一次，日志也会显示这次投掷。

生物自己的躲藏和观察方式（Capability API 1.291）。生物行动可以是一项许可，`"standard": { "actions": ["disengage", "hide"] }`：用该行动自己的额度采取这些标准行动（来自 `combat.standard`），就像 5e 的 goblin 用附赠动作进行 Nimble Escape。带 `"while": "obscured"` 时，它只在生物站在雾或霾中，或战斗在微光或黑暗中进行时才有效：shadow 的 Shadow Stealth。生物的 `checkModes` 让它某些技能的检定掷两次：`{ "skills": ["perception"], "mode": "advantage", "sight": true }` 只在它能看见时有效（Keen Sight），带 `"light": ["sunlight"]` 时只在该光照下有效（Sunlight Sensitivity，带 `"mode": "disadvantage"`），带 `"terrain": ["snow"]` 时只在它指定的棋盘地块或地点类型上有效（Snow Camouflage；地点使用战术生成器的类型：snow、cave、mountains、water 等）。生物的 `passive` 是其印在数值块上的被动 Perception，用来代替 `hiding.passive` 加其检定（需要 `combat.hiding`）。战斗所处的光照来自场景的时刻：白天户外为阳光，黎明和黄昏为微光，夜晚为黑暗，室内或时间信息中没有 Engine 能读取的内容时，为非阳光的明亮光照。光照只影响读取它的东西（这些模式，以及 `while: "obscured"`）。没有 `combat.sight.darkness`(1.294) 时，它不改变谁能看见谁。

某人自己的躲藏与发现隐藏者的方式（Capability API 1.292）。目录条目的 `mechanics.hiding`(任何类型，包括 `utility`) 和生物的 `hiding` 是许可，在 `combat.hiding` 真正生效的地方读取。`"behindLarger": true` 让持有者可以躲在体型至少大一级的人身后，前提是对方站在它与观察者之间的每条连线上（halfling 的 Naturally Stealthy；需要 `combat.sizes`）。`"still": 10` 在它躲藏时给其 Stealth 总数加上这么多，一旦它移动或采取行动就再减去（ranger 的 Hide in Plain Sight）。`"slow": "advantage"` 在它本回合移动不超过其速度一半时，让其 Hide 带优势（thief 的 Supreme Sneak）。`"aware": { "within": 10, "lostWith": ["deafened"] }` 表示在该距离（规则集自身单位）之内，没有人能对它隐藏，除非它带有这些状态之一（rogue 的 Blindsense）。生物的 `"starts": 15` 让它以该总数在众目睽睽之下隐藏着开始战斗，对被动 Perception 不超过该总数的人隐藏，无论他们是否清楚看见它，直到它移动为止，并可用 Hide 动作以同样方式再次隐藏（gelatinous cube 的 Transparent）。

生物自身的攻击掷骰掷两次（Capability API 1.293）。生物的 `attackModes` 在其 `checkModes` 会生效的地方生效：`{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }` 就是 5e 的 Sunlight Sensitivity，在它能看见且战斗在阳光下进行时，其攻击带劣势。每种模式都用 `sight`、`light` 或 `terrain` 说明在哪里生效。该模式与掷骰上的其他所有优势和劣势合并，因此两者仍会相互抵消。

黑暗（Capability API 1.294）。有 `combat.sight.darkness` 时，战斗所处的光照会让眼睛看不见：`{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`。处于黑暗中的人不可见，处于微光中的人不能被清楚看见，除非观察者有在其距离内的 `seeIn` 感官（它把黑暗视为微光，把微光视为明亮），或有在其距离内的 `blind` 感官或 `pierced` 之一（无论光照如何都能看见）。照亮黑暗的东西：`carried`，即每个以人物卡参战的人都携带的光源，除非有 `seeIn` 感官能看见他们（火把）；以及 `light`，可以写在状态上（Light 戏法）、物品的 `worn` 或 `carried` 效果上（提灯），或生物上（持火把的强盗、火元素）。每个都写作 `{ "bright": N, "dim": N }`，以规则集自身的距离单位计：这么远的明亮光照，再往外同样距离的微光。墙会挡住光线，被击倒的人不发光。在黑暗真正生效的地方，凡是读取光照的东西，都读取某人所站位置的光照：谁能看见谁（攻击看不见的人、躲藏、你看得见的生物）、处于遮蔽中（`while: "obscured"`），以及生物的 `checkModes` 和 `attackModes`。在洞穴或地下城中的战斗，无论什么时刻都在黑暗中进行。

熄灭光源与重新点亮（Capability API 1.295）。携带 `carried` 光源的人在菜单上有一个开关，以其 `label` 命名（`"Torch"`；没有标签时为“Light”）。在它指定了 `budget` 时消耗该额度，否则每回合可以免费使用一次。熄灭的光源不发光，因此其持有者可以在黑暗中不被看见；重新点亮后，他们会被看见，如果原本在躲藏也会被发现。带 `toggle` 的物品只在打开时才发出其效果的 `light`，就像带罩提灯那样。

由生物和物品开关的光源（Capability API 1.296）。带 `"sheds": { "bright": 10, "dim": 10 }` 的生物行动设定使用者从此以后发出的光，`"sheds": "out"` 则将其熄灭。它不做其他任何事，也不指向任何人：magmin 的 Ignited Illumination 是其附赠动作上的两个这样的行动，will-o'-wisp 的 Variable Illumination 则是每种照明距离各一个行动。带 `"unlit": true` 的生物开始战斗时其 `light` 是熄灭的，需要用它的某个行动才能点亮。物品的 `toggle.offLight` 是它关闭时发出的光，代替其效果的光：放下罩子的带罩提灯发出 `{ "bright": 0, "dim": 5 }`。没有明亮距离的光源只发出微光，即使在持有它的位置也是如此。

来自区域的光，以及终结黑暗或显出隐形者的光（Capability API 1.297）。法术区域的 `lights`(与任何 `light` 一样以英尺计) 只在区域自身的格子上发光，从其中心起算：爆发施放的那一点，或对于由施法者携带的区域则是施法者本人，因此 bullseye lantern 是一个固定在施法者身上的 60 英尺锥形，带 `"lights": { "bright": 60, "dim": 60 }`，不照亮其后方的任何东西。Dancing Lights 是一个可移动的点区域，带 `{ "bright": 0, "dim": 10 }`。带 `"obscures": { "darkness": true }` 的遮蔽区域是魔法黑暗，带 `"dispelsDark": { "upTo": 3 }` 的区域会在两者任一施放时，结束其格子触及的、法术位等级不超过该值的每一片这类黑暗：Daylight。带 `"reveals": true` 的光（在区域、物品效果、状态或生物上），会显出站在其明亮光照中、因状态而不可见的每个人：lantern of revealing。其中任何一项都需要 Capability API 1.297。

被状态隐藏的光，以及阳光（Capability API 1.298）。生物的 `"lightOutWhile": ["invisible"]` 在它带有其中任一状态时熄灭它自己的光，无论它的行动最后设定的是什么，并在状态结束时恢复：will-o'-wisp 的 Invisibility 也会隐藏它的光。带 `"sunlight": true` 的光（在生物、物品效果、状态或区域上）让其明亮光照成为阳光，检定或攻击模式中的 `"light": ["sunlight"]` 读取的就是它：sun blade 对抗 Sunlight Sensitivity。在本已明亮的棋盘上，它的阳光同样有效。

魔法黑暗对抗光（Capability API 1.299）。带 `"dispelsLight": { "upTo": 2 }` 的魔法黑暗区域（`"obscures": { "darkness": true }`），会熄灭该等级或更低等级法术所造成的光，无论两者在哪里交汇、谁先出现：区域的 `lights`，或由法术施加的状态的 `light`，后者在由法术专注维持时随该专注一起结束（5e 的 Darkness 作用于 Flame Blade）。无论战斗在何种光照下进行，只有魔法光能照亮魔法黑暗的格子：区域或状态上的法术光总是魔法光，其他光在写明 `"magical": true` 时才是（sun blade 的光）；黑暗之中的火把在那里照不亮任何东西。带 `"within": 60` 的 `dispelsDark` 只结束离其中心这么近的黑暗：Daylight 的明亮球体，而不是其外的微光部分。其中任何一项都需要 Capability API 1.299。

更高费用每隔几级才增加（Capability API 1.300）。`"perCostStepsEvery": 2` 让更高费用每两级才加一次 `perCostStep`，而不是每级都加。状态给予的行动（1.236）现在会按施加该状态的法术所支付的费用增长，使用其自身的 `perCostStep`、`perCostStepsEvery` 和 `perCostStepsMax`：5e 的 Flame Blade 打击是 `3d6`，带 `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`，因此用 4 环法术位召出的刀刃打击造成 4d6。使用 `perCostStepsEvery` 需要 Capability API 1.300。

随人携带的区域，以及彼此分开放置的副本（Capability API 1.301）。区域的 `"carried": "any"` 让放在某人所站格子上的爆发随其移动，以其为中心：5e 的 Darkness 或 Daylight 施放在其手持的物体上。写 `"own"` 时，只有施法者所站的格子才算，用于只能施放在施法者自己手持物体上的法术。放在空格上时，它留在原地。被携带的区域是位于一点的单个爆发，自身从不移动。范围的 `"copiesWithin": 20` 让其 `copies` 放置时每个中心都在另一个中心 20 英尺之内，而不是彼此相接；施法者可以 `move` 的多副本区域，会以同样方式移动所有副本：5e 的 Dancing Lights 是一个 10 英尺爆发，带 `"copies": 4, "copiesWithin": 20` 和 `"lights": { "bright": 0, "dim": 10 }`。两者都需要 Capability API 1.301。

改变其他条目的条目（Capability API 1.302）。人物卡列表持有的、带 `"amends": [{ "entry": "spells/eldritch-blast", ... }]` 的条目，会在持有者每次使用那个条目时改变它，多个修改可以叠加。`"damageAdd"`(一个值，如 `{ "abilityMod": "cha" }`) 在每次命中时加到其伤害上：Agonizing Blast。`"range"`(以规则集距离单位计) 在更远时作为其射程：Eldritch Spear 的 300 英尺。`"push"` 把被命中者沿直线推开这么远，`"pushOptional": true` 还会以“Eldritch Blast (no push)”的形式提供它：Repelling Blast。射程或推开需要 `combat.distance`，所指定的条目必须存在。需要 Capability API 1.302。

只在某些光照下可用的使用，以及因移动或行动而结束的状态（Capability API 1.303）。带 `"usableIn": { "light": ["dark", "dim"] }` 的条目只在使用者站在其中一种光照下时提供：One with Shadows。状态的 `endsWhenHolder` 除了 `attacks` 和 `casts`，还可以写 `"moves": true`(持有者移动时结束) 或 `"acts": true`(持有者采取动作、攻击或施法时结束)：阴影会隐藏保持不动的邪术师。需要 Capability API 1.303。

每个生物在休息前只限一次（Capability API 1.304）。带 `"oncePerTarget": { "until": "long" }`(规则集声明的一种休息) 的条目，在使用者进行该休息之前，不会再对已经用过的生物提供，无论中间隔了多少场战斗：Chains of Carceri。用在了谁身上，会按名称保存在使用者的实时人物卡上，只有那种休息才能清除。不能用于范围，也不能用于指向使用者自己的条目。需要 Capability API 1.304。

随人物卡增长的目标数，以及重复的同一目标（Capability API 1.305）。`"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }` 在其读取值的每一档增加这么多个目标，就像 `scales` 增加骰子一样。带 `"targetsRepeat": true` 时，同一目标可以被选择多次，每次选择都是一次独立的攻击、各自掷骰，并携带修改该条目的一切：eldritch blast 的光束，每道都带 Agonizing Blast 的伤害和 Repelling Blast 的推开。战斗的目标选择器在还有余量时每点击一次就加一道光束；Engine 扮演参战者时，会把剩余的光束都放在它所选的那个目标上。两者都不能用于范围，也不能用于指向使用者自己的条目。需要 Capability API 1.305。

放到手中的武器（Capability API 1.306）。带 `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }` 的 `"utility"` 条目，会把其中一把近战武器放到使用者手中，持续到战斗结束，在使用时像选择武器模式一样选取；`binds` 还会提供它匹配的每件手持武器，此后那件武器视为这一把。带 `proficient` 时以熟练使用它，其打击携带 `qualities`。再次使用会替换它，被绑定的武器会恢复原样。对召出条目的修改会作用于该武器：修改的 `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }` 在命中时加上其自身类型的伤害（Lifedrinker），`"strikes": 2` 让消耗一次攻击额度能买到这么多次攻击（Thirsting Blade）。Engine 扮演参战者时，会把打击力最强的武器放到手中一次。需要 Capability API 1.306：Pact of the Blade。

使用者自己持有的东西（Capability API 1.307）。生物自身的行动可以像目录条目一样写 `"concentration": true`：它施加的东西在该专注结束时结束，伤害也会照常检验它。imp 或 quasit 的 Invisibility 就是如此。状态的 `endsWhenHolder` 还可以写 `"uses": ["scare", "spells/bolt"]`：在持有者使用了其中之一时结束，生物自身的行动用 ID 指定，目录条目用 `<catalog>/<entry>` 指定。quasit 的隐形在它使用 Scare 时结束。条目的 `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]` 在使用时对其使用者施加这些状态，无论其目标发生什么，有专注时由专注维持，并采用施放时的等级：Sunbeam 的光点，一个带 `light` 和 `"actions": ["spells/sunbeam-line"]` 的战斗状态，用于之后的光束。始终隐形的生物不需要任何新东西：`keepsOn: ["invisible"]`(1.263) 会让它保持隐形。需要 Capability API 1.307。

1.303 到 1.306 遗留的部分（Capability API 1.308）。卷轴或魔杖的 `use` 可以带 `targetsScale` 和 `targetsRepeat`，从其使用者的人物卡读取：eldritch blast 卷轴在阅读者 5 级时多发一道光束，魔杖的飞弹可以全部射向同一个生物。需要 Capability API 1.308。另有三项改动不需要新键。反应也算行动：`endsWhenHolder` 写有 `"acts": true` 的状态，在持有者进行任何反应时也会结束，就像 One with Shadows 在“反应”时结束一样。`oncePerTarget` 能区分两个同名生物：对一只 imp 使用 Chains of Carceri 不影响另一只 imp，之后战斗中的 imp 只有在名称属于那同一个生物时才会被禁止。放到手中的武器（1.306）可以是可投掷的近战武器（同时具有 `reach` 和 `range` 的攻击，如 dagger 或 javelin）。它可以从战斗菜单中不花动作地解除，并在其召出者死亡时消失。它离召出者从不超过 5 英尺，因为战斗从不会让它离开召出者的手。

躲藏的条件、Feral Senses、突袭与绑定仪式（Capability API 1.309）。带 `still` 的 `hiding` 可以写 `"stillWhile": { "holds": "camouflaged", "wall": true }`：加值只在持有者带有该状态（事先完成的伪装，用一个 1 分钟的 utility 条目，或在战斗前设置）、并且（带 `wall` 时）站在阻挡视线的格子旁边时才计入。这就是 Hide in Plain Sight。`"unseenStrikes": true` 取消攻击持有者看不见之人的劣势，这是 Feral Senses 的前一半。后一半什么也不需要，因为战斗本来就知道每个未隐藏的生物在哪里。生物带 `starts` 的 `hiding` 可以写 `"surprises": true`：它开始时对其隐藏的人都会在战斗开始时措手不及，就像 gelatinous cube 的 Transparent。带 `binds` 的 `conjures` 可以在 `"boundIn"` 中指定一个实时文本字段：只有名称写在那里的手持武器才会被绑定，字段为空时则一件都不绑定。把名称写进去，就相当于在战斗之外、短休期间完成了长达一小时的仪式。需要 Capability API 1.309。

重复施放，以及因距离而结束的状态（Capability API 1.310）。专注条目的 mechanics 可以写 `"repeats": { "budget": "action" }`：在使用者专注于它期间，它的效果会在该额度上再次提供，不从人物卡支付任何东西，不开始新的专注，也不会再次对使用者施加任何东西，并采用施法时支付的等级和费用级别。菜单将其显示为“Vampiric Touch again”。`"notSaved": true` 永远不会对已经通过这次施法豁免的生物提供它（Eyebite），`"sameTargets": true` 只对施法所瞄准的对象提供它（Heat Metal，用附赠动作）。`repeats` 需要 `concentration` 和一个已知的额度。`applies` 可以写 `"endsAway": { "beyond": 60, "unseen": true }`：一旦持有者与施加者的距离超过该值，并且（带 `unseen` 时）看不见对方，状态就会移除。这就是 Eyebite 的惊慌。它在任何人行走的每一步，以及每个回合结束时都会检查。需要 Capability API 1.310。

1.307 和 1.309 遗留的部分（Capability API 1.311）。物品的 `use` 可以像条目的 mechanics 一样带 `appliesSelf`：Sunbeam 卷轴会把光点及随后的光束留在阅读者手中，由阅读时的专注维持。生物的行动可以写 `"dyingOnly": true`(只能选择生命为零但仍活着的生物)、`"slaysOnFailedSave": true`(没有通过该行动自身豁免的目标死亡) 和 `"healsOnSlay": { "dice": "3d6" }`(每有一个目标死亡，生物就恢复这么多)。这就是 will-o'-wisp 的 Consume Life。`slaysOnFailedSave` 需要 `save`，`healsOnSlay` 需要 `slaysOnFailedSave`。`combat.conditions` 中的规则可以写 `"endsWhenHolder": { "moves": true, "acts": true }`：无论状态是如何施加的，持有者在迈出第一步时（`moves`），或做除 Hide 以外的任何事时（包括反应，`acts`），状态都会从持有者身上以及其人物卡上移除。这就是 Hide in Plain Sight 的伪装，在战斗前于人物卡上勾选。需要 Capability API 1.311。

围绕命中的雷鸣（Capability API 1.312）。武器的模式可以写 `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`。以该模式命中时，被命中者以及站在其 `within` 之内的每个人都要豁免，否则受到 `condition`。这包括盟友和持用者，如果他们站得那么近的话。`rounds` 计算他们自己的回合，或在写 `of: "source"` 时计算持用者的回合，因此 `rounds: 1, of: "source"` 就是“直到你下个回合结束”。`of` 需要 `rounds`。没有棋盘时，只有被命中者豁免。配合该模式的 `range` 和 `charges`，这就是消耗一点充能投掷的 Hammer of Thunderbolts。其 Giant's Bane 是武器带 `when: "critical"` 的 `slay`。需要 Capability API 1.312。

Maze、Expeditious Retreat、一次施法的选项，以及有上限的属性增加（Capability API 1.313）。带 `while` 的 `dismisses` 可以写 `"turns": true`。该生物离开战斗，但仍进行自己的回合，在回合中只会提供能结束使其离开之状态的选项，或结束回合。`applies` 可以带 `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }`：持有者可以花费标准额度，以该 `combat.checks` 检定对抗该数字来结束它。符合 `passes` 的生物不掷骰即成功。两者合在一起就是 5e 的 Maze 及其对 minotaur 的例外，检定成功时生物回到原来的位置。条目的 mechanics 可以写 `"takes": ["dash"]`(或 `disengage`、`dodge`)，使用者在使用它时就采取这些标准行动：Expeditious Retreat 在施放时就进行 Dash。此后的附赠动作 Dash 来自其状态的 `grants`。`repeats` 可以指定一个 `group`：同一组的条目是一次施法的不同选项，只要其中任何一个处于专注中，组内每一个都会再次提供。`notSaved` 和施法等级是共用的，就像 Eyebite 的沉睡、惊慌和不适。物品的属性改动 `{ "add": 4, "max": 30 }` 叠加在所有 `set` 留下的分值之上，最多到 `max`，并且从不降低已经高于它的分值。没有 `max` 时，增加与以前相同。物品的 `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }` 只允许在同一个角色穿戴着每组中的一件物品（并在该物品需要绑定时已绑定）时绑定它，一旦其中任何一件被脱下、解除绑定或离开其背包，就立即解除绑定。配合 `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }`，这就是 Hammer of Thunderbolts。需要 Capability API 1.313。

Resilient Sphere(Capability API 1.314)。`combat.conditions` 项可以带 `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`。状态生效期间，持有者与其他所有人隔绝。其他人都不能把任何东西瞄准他们，范围或爆发会绕过他们，其他人的任何东西都不能伤害、治疗他们或对他们施加状态，包括区域和光环。他们自己的东西也触及不到其他任何人，没有人会在他们移动时打击他们，他们也不会打击任何人。他们自己的移动为零，但带 `rolls` 时，他们可以花费该额度移动至多其速度的 `share`。带 `lifted` 时，站在他们旁边的人可以花费该额度把他们举起来。之后持有者会随搬运者行走而移动，直到搬运者把他们放下（免费），或状态结束。`brokenBy` 中的条目仍可以瞄准持有者，它们不会产生原本的效果，而是结束该状态以及维持它的专注：Disintegrate 作用于球体。条目的 mechanics 可以写 `"targetsUpTo": "large"`(`combat.sizes` 之一)，此时它只能瞄准该体型或更小的生物。这就是 Resilient Sphere 的“Large 或更小体型”。需要 Capability API 1.314。

巢穴动作（Capability API 1.315）。生物行动可以带 `"lair": true`，生物则带 `"lairInitiative"`(省略时为 20)。当生物在其巢穴中战斗时（Game Master 对该敌人写 `"inLair": true`，或遭遇战的 `inLair` 列表），每轮在战斗的计数经过其巢穴数字时进行一次巢穴动作，平局时排在后面：在该数字所落入的两个回合之间；所有人都等于或高于该数字时，在本轮最后一个回合之后；所有人都低于该数字时，在第一个回合之前。它不能连续两轮进行同一个巢穴动作。巢穴动作的瞄准和结算与在其自己的回合中相同，为此借出其 `budget`，不消耗生物自己回合的任何东西。它从不出现在生物自己回合的菜单上，生物倒下或无法行动时也不会进行。巢穴动作既不是反应，也不用点数购买，序列也从不指定它，`lairInitiative` 至少需要一个巢穴动作。5e 的龙在先攻计数 20 时进行巢穴动作。

道具（Capability API 1.316）。棋盘上的战斗可以有立在棋盘上、可被破坏的道具：遭遇战的 `board.props`，或世界战场绘制的 `props`。每个道具有 `label`、占据的 `cells`、`health`、`defense`(省略时为 10)，以及可选的 `resist`、`vulnerable` 和 `immune` 伤害类型。`blocks` 在道具存在期间对行走（`move`）、视线（`sight`）或两者封闭其格子，任何人都不会在战斗开始时处于其中。`fragile` 道具会被击中它的任何东西破坏。能打击墙段的攻击可以改为打击道具：它列在选项的 `walls` 中，选择的 `wall` 指定其格子。范围会卷入它触及的每个道具，并造成与对其他人相同的伤害骰结果；道具从不豁免。降到 0 的道具被破坏：它不再封闭任何东西，其标签被加入棋盘的 `broken` 列表、战斗摘要以及 Game Master 读取的战后回顾（`Broken: Sluice Gate; Oil Jar`）。故事的 `broke` 触发器会因它触发。

Legendary Resistance(Capability API 1.317)。生物的 `"legendaryResistance": 3` 把它在一场战斗中的前三次豁免失败变为成功，即 5e 的“如果龙豁免失败，它可以选择改为成功”（3/Day）。Engine 总是选择这样做，适用于任何豁免，包括状态直接判定失败的豁免；但生物倒下时永远不会。豁免会按掷出的结果记录，随后一行说明它改为成功以及还剩几次。取 1 到 20 的整数。

物品的使用也可以带 `"targetsUpTo"`(Capability API 1.317)，与 1.314 起条目的 mechanics 相同：Resilient Sphere 卷轴的 `"targetsUpTo": "large"` 只能作用于该体型或更小的生物。它读取 `combat.sizes`，用于指向生物而非范围的使用。

棋盘事件与生长物（Capability API 1.318）。战斗的棋盘可以随着轮次推进自行变化：遭遇战的 `board.events`，或世界战场绘制的 `events`。每个事件有 `id`、可选的 `label`，并在 `"round-start"` 或 `"round-end"` 时（`at`）发生，从某一轮开始（`from`，省略时：轮开始为 2，轮结束为 1），每隔这么多轮（`every`，默认 1）发生一次，如有说明则直到某一轮（`until`）为止。`where` 指定其格子：`cells`、一个 `block`(`x`、`y`、`w`、`h`)、围绕某格（`x`、`y`）的 `ring`(第一次触及 `start` 格，之后每次再向外扩展 `step` 格)、从一条边向内推进的 `sweep`(`from` 为 `north`、`south`、`east` 或 `west`，使用同样的 `start` 和 `step`)，或 `{"spread": "growth"}`，即生长物旁边的每个空格。环形或推进只触及其最新的一圈，深 `step` 格（至少一格），第一次也是如此，因此 `start` 为 3 的环形不会触及其中心；`filled` 则触及内部的一切。`onlyOn` 把它限制在这些地形的格子上。`change` 说明那里发生什么，至少一项：`terrain`、`height`(0 到 3)、`light`(`bright`、`dim`、`dark`、`sunlight` 或 `clear`)、`obscured`(`light`、`heavy` 或 `clear`)、`growth`(true 或 false)、`season`(一个名称，或用 null 移除)、`rotate`(只能用于正方形 `block`，连同其中的地块、高度、地面、完全位于其中的道具以及完全站在其中的人，顺时针转 1、2 或 3 个四分之一圈)，以及 `tell`，即日志代替普通说明所写的那一行。留在没有人能站立之处的人（冰裂开变成水）会被放到最近的空格上。一块棋盘最多容纳 32 个事件。

被带走（Capability API 1.329）。棋盘事件的 `change` 还可以写 `push`，`{"toward": "east", "squares": 3}`(一条边，`north`、`south`、`east` 或 `west`，以及 1 到 6 格)：站在其格子地面上的人会被一次一格地带往那个方向，永远不会被带出棋盘、撞进墙或关闭的道具、带到没有人能站立的地面上，或撞到其他任何人，也没有人会因此打击他们；离那条边最近的人先移动，处于空中的人不受影响。日志会说明它带走了谁。Mill of Hours 的水渠就是这样。或者写 `drift`，形式相同：遮蔽其格子的东西（轻度或重度）会被吹往那个方向，并从其 `block` 的另一侧回来，若 `where` 是其他形式则从棋盘另一侧回来；格子上的其他东西都不移动，轻度遮蔽被吹到重度遮蔽的格子上时，那里仍保持重度遮蔽。Leaffall 的飘移就是这样。战场绘制的事件两者都接受。

格子上的生长物会让进入该格的费用加倍（不超过其他崎岖地面），并让站在其中的人处于轻度遮蔽。伤害类型能砍断生长物的打击（挥砍，除非棋盘的 `growth.cutBy` 另有规定），可以瞄准它能触及的生长物格子，列在选项的 `walls` 中：它不掷骰就清除该格，并消耗这次动作。能烧掉生长物的伤害类型（火焰，除非 `growth.burnedBy` 另有规定）会把它落到的每一格上的生长物烧掉，即范围的整个覆盖区域，或被命中者所在的格子。带 `"clears": "growth"` 和 `area` 的条目 mechanics 或物品使用，会清除该范围内的生长物：修枝剪，`{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`。遭遇战的 `board.ground` 在开始时就把生长物、光照、遮蔽和季节绘制到格子上；世界战场把生长物绘制为由 `g` 和 `.` 组成的 `growth` 行，季节则与 Experiences 中的绘制方式相同。

阴影、光照规则、风铃与畏光者（Capability API 1.319）。带 `"shade": true` 的光会投下阴影：在其 `dim` 所及范围内为微光，那里的明亮光照和阳光也都变为微光，无论还有什么照亮它们。它没有明亮光照，也既不是 `reveals` 也不是 `sunlight`。阴影永远不会伸入魔法黑暗。展示用例中的 Lantern of Dusk 是一件携带的物品，带 `{"light": {"bright": 0, "dim": 15, "shade": true}}`。格子自身的光照（1.318）和阴影也是眼睛在那里读取的光照：在明亮的棋盘上，站在黑暗格子里的生物不可见，除非用能在黑暗中视物的感官。

战斗的棋盘可以有一条光照规则：遭遇战的 `board.lightRule`，或世界战场绘制的 `lightRule`。每轮结束时，完全站在其某种光照中（`in`，未写明时为明亮光照和阳光；明亮光照包括阳光）的每个人，都在那里多计一次轮末，每到第 `rounds` 次（未写明时为 1），其 `tracks` 按 `by` 移动，其 `applies` 中的状态施加到他们身上。走出去，哪怕只是走进一格阴影，都会重新计数。`spares` 指定它永远不会影响的生物 `types` 和 `tags`。不移动人物卡上任何轨道、也不施加战斗已知的任何状态的规则不起作用，会被丢弃。Noonfield 写作 `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`：在阳光下每一分钟增加一级力竭。

光照规则的豁免（Capability API 1.321）。光照规则的 `save`(`save`、`difficulty`) 由它即将影响的每个生物进行，豁免成功则这次免于它；无论哪种情况，计数都会重新开始。其 `against`(战斗已知的 `conditions`、`damage` 类型) 是该豁免所针对的东西，因此 `against` 匹配的豁免调整值会生效：穿戴或携带的草帽带 `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`。轨道项的 `upTo` 是规则最多把它移到哪里，因此会超过它的力竭停在那里，达到之后就不再增加。Noonfield 完整写法：`{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`，并带有一个由 experience 加入、供草帽指定的 `noon_light` 状态。

作为反应的物品使用（Capability API 1.322）。物品的 `use`(或其 `moreUses` 之一) 可以带 `reaction`，写法与目录条目的相同，此时只在该时刻打开时提供，从 `budget`(持有者的反应) 支付，并像任何使用一样从其充能或物品本身支付。Liesl's Coffin 每天一次，在持有者 5 英尺内的生物被命中时，让对方的 AC 加 5，持续到持有者下个回合开始，对这次命中也有效：在带 `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}` 的物品上写 `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}`。Straw Proxy 让瞄准其主人的攻击落空，代价是替身被烧毁：`{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`。物品的使用必须指定其时刻：`"reaction": true` 会被拒绝。

Held Ground 与收割（Capability API 1.323）。战斗可以在 Held Ground 上进行，那是死亡被扣留的地方：战斗的 `heldGround`(`label`、一个 `condition`，以及写作 `[{"track", "by"}]` 的 `marks`)，由故事的区域规则交给它。在那里，生命降到零的人会被放倒，而不是死亡或倒下：对手退出战斗；角色躺下并保持稳定，从不进行死亡掷骰，受伤也不会累积失败，可以照常被治疗。被放倒的人受到其 `condition`(角色还会受到规则集自身表示倒下的状态)，每个有人物卡的人都会移动其 `marks` 轨道：展示用例中的 Owing 印记。原本会直接杀死的效果改为将其放倒。带 `reaps` 的打击（在生物行动或物品攻击上）会收割被它放倒的人：他们保持倒下，不受到状态也不留下印记，被收割的角色即死亡。Reaping Hook 是一件 `attack` 带 `"reaps": true` 的武器。被放倒和被收割的参战者分别带有 `felled` 和 `reaped`，供故事日后让被放倒者复起。

解除 Held Ground(Capability API 1.330)。故事可以在战斗中途解除 Held Ground，例如在年岁更替之时：调度器的 `releaseRulesetHeldGround(definition, state, release)`(其下是共享的 `rulesetReleaseHeldGround`)。从那时起，生命降到零的人会像在其他任何地方一样死亡或倒下。未被收割的被放倒者会死亡，对手和角色都一样，除非 `release.felled` 为 `"down"`，此时角色改为倒下，并按规则集自身的规则开始濒死。带 `release.owing`(`{"track"?, "bonus"?}`，省略轨道时为 Held Ground 第一条标记的轨道) 时，每个角色在该轨道上的印记都会到期：每个印记进行一次规则集的濒死豁免，每次加上 `bonus`(队伍的 Debts Settled)，一直掷到印记用完或计数已有结果，特殊点数按濒死规则处理；之后这些印记被消耗。三次失败（失败轨道的顶端）即死亡。日志会说明谁死了、谁倒下了，以及每个角色的掷骰。不在 Held Ground 上的战斗保持原样。

生物的范围与地面（Capability API 1.324）。带 `area` 的生物行动可以用 `zone` 让该范围持续存在，写法与目录条目的区域相同（`rounds`、`triggers`、`obscures`、`terrain` 等）：The Owed 的 Freezing Fog、Scatter Flour 的面粉立方体、冻结成崎岖地面的地面。带 `"untilLair": true` 的区域，如果其 `rounds` 尚未让它结束，还会在其施放者的巢穴计数下次到来时、选择那个巢穴动作之前结束：“直到下一次巢穴动作”。生物行动也可以改用 `ground` 永久改变其范围覆盖的地面，写法与棋盘事件的 `change` 相同（`terrain`、0 到 3 的 `height`、`light`、`obscured`、`growth`、`season`，以及供日志使用的 `tell`）：篝火摇曳将熄（`"light": "dark"`）、冰面裂开（`"terrain": "water"`）；留在没有人能站立的格子上的人会被移到最近的空格。两者都需要行动的 `area`，`ground` 必须改变某些东西。使用其中任何一项，或在任何地方使用 `untilLair` 的规则集，需要 Capability API 1.324。

召入战斗的生物（Capability API 1.325）。生物行动可以写 `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }`：使用时，这么多个指定的图鉴生物（来自规则集目录或交给该战斗的图鉴中的 `"<catalogId>/<entryId>"`；`count` 是 `{"dice"}`、`{"flat"}` 或两者，每次最多八个）加入战斗，站在使用者一方，按战斗构建其自身生物的方式构建，并逐一命名（“Zombie 1”、“Zombie 2”）。有 `area` 时，它们被放在瞄准的位置，满了之后尽量靠近那里；没有时，放在召唤者旁边，该行动不指向任何人。它们自己投先攻并在顺序中就位：本轮回合已经经过的位置，算作下一轮的位置。带 `"initiative": "after"` 时，它们的回合改为紧跟在召唤者之后。巢穴动作也可以召唤（Shelves Lean），其计数所处的那个回合照常继续。战斗开始时在任何地方都找不到的生物不会召唤任何人，一场战斗最多容纳 40 个参战者。日志会说明谁来了。使用 `calls` 的规则集需要 Capability API 1.325。

被拉向某个生物（Capability API 1.326）。生物行动可以写 `"draws": { "spends": "reaction" }`：它落在其身上的人（带 `save` 时，只有豁免失败的人）当场消耗该额度，朝该生物走至多其速度，沿畅通的路线走向他们能到达的、离它最近的格子，且不会引发打击。没有剩余该额度，或无法再靠近的人，不消耗任何东西，留在原地。The Owed 的 Whisper a Name。`spends` 是行动经济的某个额度。使用 `draws` 的规则集需要 Capability API 1.326。

巢穴时机（Capability API 1.327）。带 `"actedOnly": true` 的生物行动只能指向本轮已经开始其回合的人，包括正在进行回合的人；在战斗的第一个回合之前，巢穴先于所有人行动时，还没有人开始过回合。这就是 Hour Bell 的“本轮已经行动过的一个生物”。状态的持续时间可以在其 `rounds` 上加上 `"untilLair": true`：在施加者下次到达其巢穴计数时、选择那个巢穴动作之前，它也会移除（Hour Bell 的“直到下一次巢穴动作”）。由其 `concentration` 维持的生物行动可以指定 `"brokenNextLair"`，即它自己的一个巢穴动作：一旦该专注被打断（因伤害、倒下或区域的作用，而不是持有者自行结束或开始另一个专注），那个巢穴动作就是它接下来进行、也是唯一提供的巢穴动作，无论上一轮进行的是什么；进行之后，选择再次恢复自由。Father Ivo 的 Litany of Keeping 与书架倾倒就是这样。使用其中任何一项的规则集需要 Capability API 1.327。

被状态移动的豁免难度（Capability API 1.328）。状态的改动 `{ "to": "save-difficulty", "flat": -2 }` 在持有者带有它期间，移动持有者所要求的每一次豁免的难度：其行动自身的豁免，以及结束这些行动所施加之物的豁免难度。它只接受 `flat` 数量，不接受其他内容，并且从不影响检定的难度、专注豁免（由伤害决定），或行动召入战斗的生物。Miller of Hours 的 Un-age：法术豁免 DC 降低 2。使用它的规则集需要 Capability API 1.328。

道具与汲取（Capability API 1.331）。战斗状态可以写 `"whileNearProp": {"prop": "Year-Wheel", "within": 10}`：只有当持有者站在棋盘上带该标签、仍立着的道具的该距离（规则集自身单位）之内时，它才生效；在其他任何地方，或该道具被破坏后，它被压制而不是结束；没有棋盘的战斗中它保持生效。The Wheel's Favour 就是如此。生物行动的爆发 `area` 可以写 `"aroundProp": "Shelf"`：无论瞄准哪里，它都覆盖带该标签、仍立着的道具 `size` 之内的每一格，包括道具之后的格子。Granary 书架行周围的 Shelves Lean 就是如此。光环可以写 `"feeds": 15`：每当光环触及的人被放倒、倒下或被杀死时，其持有者就恢复这么多生命值，光环也可以只做这件事。The Owed 的 Collector 就是如此。使用其中任何一项的规则集需要 Capability API 1.331。

重新点亮、坠入，以及道具旁的使用（Capability API 1.332）。棋盘道具（遭遇战的 `board.props`，或战场上绘制的道具）可以写 `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}`：只要它 `squares` 格之内有任何一格按战斗的读取不处于该光照，站在它旁边的人就会以该额度（未写明时为 `action`）获得“Light it again”选项，把该光照施加到所有这些格子上。Bonfire Gutters 之后 The Owed 的篝火就是如此。生物行动的 `ground` 可以在其 `terrain` 旁写 `"occupants": "stay"`：站在地面变得无人能站之处的人会留在那里，穿过冰面掉进水里，而不是被移到最近的空格（默认的 `"shove"`）。目录条目或物品使用可以写 `"usableNear": {"prop": "Year-Wheel", "within": 5}`：只在使用者站在以 ID 或标签指定的、仍立着的道具的该距离之内时才提供，在没有棋盘的战斗中从不提供。在 Year-Wheel 旁的 Fennick's Hymnal 就是如此。从 1.332 起，`whileNearProp`、`aroundProp` 和 `usableNear` 都以相同方式指定道具：用其 ID(`"p1"`)，或宽松地读取其标签，忽略大小写、开头的“the”以及字母和数字以外的一切，因此 `"Year-Wheel"` 能找到标签为“The Year-Wheel”的道具。使用 `usableNear` 或 `occupants` 的规则集需要 Capability API 1.332。

战斗棋盘美术（Capability API 1.333）。战斗棋盘可以用棋盘包绘制：按格子网格排列的 PNG 图集（RPG Maker 风格为 48 像素），地块使用固定 ID，在 Pixelforge 中制作并保存在素材库中（`POST /api/game-tile-packs/boards`）。`bt_plains`、`bt_forest`、`bt_mountain`、`bt_ruin`、`bt_water` 和 `bt_wall` 是地形，每种最多八个变体，按格子逐一挑选，或使用一个比格子更大的图案铺满整个棋盘；`bt_edge_water` 和 `bt_edge_wall` 是由十六块组成的双网格块，四格乘四格，按 Pixelforge 的 `edge_` 块排列，用来把水和墙与旁边的平原融合；`bt_height1` 到 `bt_height3` 是抬高地面上的边缘。`bo_dim`、`bo_dark`、`bo_sunlight`、`bo_fog_light`、`bo_fog_heavy`、`bo_growth`、`bo_ice`(冬季的格子)、`bo_zone`、`bo_aim` 和 `bo_reach` 绘制在格子之上，代替现在的着色。道具的贴图是横跨其格子的 `bp_<name>`(道具上写 `"art": "bp_bonfire"`；省略时取其标签的小写单词，用 `_` 连接，并去掉开头的“the”，因此“The Year-Wheel”是 `bp_year_wheel`)，被破坏后则为 `bp_<name>_broken`。绘制的战场或遭遇战的棋盘可以用 `"pack": "local/<id>"` 指定其包；没有指定时，先用素材库中与其环境对应的包（包的 `environment`），再用内置的 `board/<environment>`，最后按现在的方式绘制；道具还会在素材库的道具包（`"environment": "props"`）中查找，然后是内置的 `board/props`。包中缺少的地块按现在的方式绘制。目录区域可以写 `"art": "bz_<name>"`：它覆盖的每一格都用棋盘包中的该地块绘制，否则用 `bo_zone`。使用区域 `art` 的规则集需要 Capability API 1.333。

物品提供的更多回合（Capability API 1.334）。物品的使用可以像目录条目的 mechanics 一样写 `"gives": [{"budget": "action", "count": 1}]`(Action Surge)：使用它会立即给使用者这么多额外的回合额度，并在加上时设定上限，因此不会留到以后。Time-Flour Loaf 用附赠动作吃下，立即多给一个动作。使用它的规则集需要 Capability API 1.334。

休息时花费的骰子（Capability API 1.335）。休息可以写 `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}`：此时 Game Master 的 `[sheet: op="rest" rest="short" dice="2"]`(或针对整个队伍的命令) 会先从 `pool` 花费这么多骰子，每颗骰子掷 `die`(任意值，或写作“d8”的枚举字段) 再加上 `add`，每颗不低于 0，然后在休息执行其规定的内容之前，把这么多作为非魔法治疗交给 `heals`。`extra` 是给每个花费了骰子的人的额外一颗骰子：`die` 读出面数最多的队伍成员为每个人掷它，并加上其自己的 `add`。5e 的 Song of Rest，以及 Pell's Brown Teapot 作为 `add` 读取的物品数值、为每颗骰子带来的 +1。使用休息 `dice` 的规则集需要 Capability API 1.335。

跨多个池的休息骰（Capability API 1.337）。休息的 `"dice"` 可以是一个列表，每个池一项，各自有 `die`、`add`、`heals` 和 `extra`：`[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`，因此 fighter 1 / wizard 1 会花费一颗 d10 和一颗 d6。`[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]` 只从该池花费；不带 `pool` 时，骰子来自列出的第一个还有骰子的池，然后是下一个，总数不够时会被拒绝，且什么也不花费。额外骰子（Song of Rest）取第一个带有它的项，整次花费只掷一次，治疗对象与首个花费骰子之池的治疗对象相同；即使只有后面的池支付，它也会出现。在游戏中，休息骰会读取每个角色携带的东西，因此 `add` 或额外骰子的 `add` 中的 `itemStat` 会计入：Pell's Teapot，`{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`。在这里使用列表的规则集需要 Capability API 1.337。

图标（Capability API 1.338）。目录条目和人物卡状态可以指定其图标，`"icon": "ic_poison_cloud"`：游戏图标包（类型为 `icons` 的棋盘包；见 packages/server/src/assets/board-packs/README.md）中的一个地块。没有指定时，Engine 会查找推导出的名称：状态为 `ic_cond_<id>`，物品为 `ic_item_<entry id>`(Game Master 自创的物品为 `ic_item_<name>`)，其他目录条目为 `ic_<catalog id>_<entry id>`(`ic_spells_fireball`)，连字符写作 `_`。两者都没有时，显示现在的字母或文字。指定了图标的规则集需要 Capability API 1.338。

战斗画面如何显示规则集（Capability API 1.375）。使用棋盘时，战斗面板用一个小圆点表示每种额度：彩色底上的字母，额度尚可花费时填满。额度可以同时指定这两项：`"short": "A"`(一到两个字母) 和 `"tone"`，后者为 `rose`、`amber`、`violet`、`teal`、`sky`、`lime`、`orange` 和 `slate` 之一；省略时，圆点采用额度标签的首字母，并按列表位置选色，因此 5e 的 Action、Bonus action 和 Reaction 分别显示为玫红的 A、琥珀色的 B 和紫色的 R。`combat.display` 规定其余显示方式：`"defense": {"short": "AC"}` 指定行动顺序中防御列的标题（最多六个字母；省略时，短标签原样保留，较长标签则取首字母缩写，因此“Armor Class”显示为“AC”）；`"hide": true` 则为防御无法用单一数字表示、不值得单列的规则集隐藏该列。`"pools": ["slots_1", "slots_2", "ki"]` 按顺序列出当前回合下方以圆点显示的人物卡资源池（按等级排列的法术位、气）。每项必须是 `sheet.live.pools` 声明的池，且只出现一次；由列表行创建的池会被拒绝。省略时，按队伍行动花费资源池的顺序显示它们。使用 `short`、`tone` 或 `combat.display` 的规则集需要 Capability API 1.375。

人物卡、菜单和卡片上的自定义措辞（Capability API 1.378）。以下每项均可选，省略时保留 Engine 自身的措辞：

- 资源池可以指定单个和多个资源的名称：`"unit": "3rd-level slot"` 和 `"units": "3rd-level slots"`，让费用显示为“1 3rd-level slot”或“2 3rd-level slots”，升环支付则显示为“Use 1 2nd-level slot”。省略时，费用按池的标签计数。若付费资源池与选项本身同名（Action Surge 按钮上的 Action Surge），就不显示费用，因为按钮已经写了它。
- 列表可以指定玩家看到的组织方式：`"display": {"tab": "Spells", "by": {"column": "level", "labels": ["Cantrips", "1st level", "2nd level"]}, "mark": "prepared"}`。`tab` 指定它所在的人物卡选项卡名称。`by` 按数字列分组，每个从 0 开始的值各有一个标题（`labels[0]` 对应 0，最多 21 个标签；超出最后标签的值，在人物卡上以数字为标题，在菜单上则只归入选项卡名称下），且必须指定数字列。`mark` 指定以勾选标记显示的是非列，且必须指定这样的列。游戏主持人（GM）的 `[sheet: op="prepare" name="..."]` 会勾选人物卡已有的行（`op="unprepare"` 清除勾选）；若引导式构建器允许人物卡选择该条目且勾选该列，也会添加该行（即某个 `catalog` 步骤的 `stamp` 或条目自身的行会勾选该列，且该步骤的数量大于 0）；它勾选的数量绝不会超过该步骤的数量或同一列上 `mark` 步骤所允许的数量。战斗从列表行提供的能力，在战斗菜单中归入选项卡名称下，并按同样方式分组（“Spells: Cantrips”、“Spells: 1st level”），代替该类型自身的标题。
- 实时文本字段可以像池一样按字段通过 `"hideWhen"` 隐藏，也可以按派生值隐藏：`{"derived": "knows_concentration", "equals": 0}`(使用 `equals`、`notEquals` 或 `in` 之一)。只有文本字段能按派生值隐藏，因为人物卡的任何计算都不读取文本字段。
- 人物卡状态可以写 `"pickable": false`：人物卡的“Add condition”选择器不列出它，但游玩、命令和 Game Master 仍可施加和移除它。适合某个法术或物品自身的状态。
- 非伤势轨道可以写 `"showWhenSet": true`：仍处于初始位置时不显示在人物卡上，游玩或 Game Master 改变它之后才显示。
- 物品开关可以为两种操作命名：`"toggle": {"onLabel": "Lower the hood", "offLabel": "Raise the hood"}`，菜单用它们代替“Turn on”和物品名称。
- 物品的使用可以为自己命名：`"use": {"title": "Scatter ball bearings"}`，菜单用它代替物品名称，旁边仍显示数量。
- 战斗调整值可以说明自己的效果：`"label": "advantage on saves against being charmed"`，卡片用它代替 Engine 根据其余内容组合的短语。
- 表示加值的派生值可以写 `"signed": true`，让人物卡带符号显示它：法术攻击显示为“+7”，而不是“7”。
- 生物特性的文本可以长达 1200 个字符，之前为 400 个。

使用以上任一项，或生物特性超过 400 个字符的规则集，需要 Capability API 1.378。

专注被打断时的巢穴动作列表（Capability API 1.336）。`"brokenNextLair"` 可以是它自己的巢穴动作的列表，每个只出现一次，而不只是一个：`["shelves_lean_north", "shelves_lean_south"]`。一旦该专注被打断，下一个巢穴动作就是其中之一，不会是别的，无论上一轮进行的是什么，由操控该生物的人选择哪一个。由 Engine 操控的生物会选择能卷入最多敌人的那一个；同样好的选项之间，按它评估其他任何东西的方式权衡。进行之后，选择再次恢复自由。在这里使用列表的规则集需要 Capability API 1.336。

变形（Capability API 1.392）。目录条目的 `mechanics`(或生物的行动) 可以提供 `"forms"`，指定它能将某人变成哪些生物：`{"into": ["beasts/wolf", "beasts/giant-eagle"], "upTo"?: {"filter": "cr", "at"?: <value>, "targetLevel"?: <value>}, "without"?: [{"speed": "fly", "unless"?: <value>}]}`。每种形态都是一个图鉴条目（`"<catalogId>/<entryId>"`），作为该行动的一种模式（`form-<catalogId>-<entryId>`）提供，而它通过 `applies` 施加的内容必须指定一个带 `"shape"` 的战斗状态。`upTo.at` 用从使用者人物卡读取的数字，对照每种形态的数字 `filter` 来限制可选形态（Wild Shape 按德鲁伊等级限制 CR）；`upTo.targetLevel` 则根据承受变形的对象来限制：读取其人物卡上的值，或该生物在该筛选项下自身的数字（Polymorph 的“CR 等于或低于目标等级”），高于此值的形态会被拒绝。`without` 排除具有该移动速度的形态，除非 `unless` 读出的值大于 0（德鲁伊等级达到 8 之前不能飞行）。生物没有人物卡，因此其行动既不使用 `at`，也不使用 `unless`。状态的 `"shape": {"health"?: "form" | "own", "keepsSaves"?: [...], "keepsChecks"?: [...], "keeps"?: [...], "revert"?: "<budget>"}` 指定它持续期间的效果：形态的行动、防御、豁免、检定、速度和各类移动速度、感官、大小及特性取代持有者自身的对应内容；`keeps` 指定要保留的持有者自身行动（行动 ID，或以 `"<catalogId>/<entryId>"` 或条目 ID 表示的目录条目：让德鲁伊在野兽形态下施法）；`keepsSaves` 和 `keepsChecks` 保留持有者自身在这些项目上的数值。使用 `"health": "form"`(默认值) 时，形态具有其数值块给出的生命值，先承受打击，降到 0 时变形结束，此次打击剩余的伤害继续由持有者自身承受；`"own"` 则保留持有者自身的生命值（Change Shape）。`revert` 提供花费该额度恢复原形的方式。变形随其状态结束而结束，无论是持续时间耗尽、专注中断、被解除，还是主动恢复原形。使用 `forms` 或状态 `shape` 的规则集需要 Capability API 1.392。

读取目标身旁有谁及其受伤程度的攻击（Capability API 1.393）。生物的 `attackModes` 条目可以写 `"allyAdjacent": true`，仅当它的一名能够行动的盟友站在目标身旁时生效（没有棋盘时，该盟友在任何地方都算）：5e 的 Pack Tactics，`{"mode": "advantage", "allyAdjacent": true}`。`"targetHurt": true` 仅在目标生命值低于最大值时生效：Blood Frenzy。条目指定的所有条件都必须满足。附加效果的 `when` 可以写 `"target-hurt"`，要求目标在打击到来时生命值低于最大值（Colossus Slayer）；其 `oncePer` 可以是 `"own-turn"`：在持有者自己的每个回合中限一次，绝不在其他任何人的回合中发动的打击上生效（Divine Strike 的“在你自己的每个回合中限一次”）。使用其中任何一项的规则集需要 Capability API 1.393。

由目录条目或物品使用召来的生物（Capability API 1.394）。其 `mechanics` 可以像生物行动的 `calls`(1.325) 一样写 `"calls"`，让生物以使用者一方的身份加入战斗：`{"creature": "creatures/wolf", "count": {"dice": "1d4"}}`；也可以写 `"options"`，列出两到八个 `{"creature", "count", "label"?}`，在使用时供使用者选择，作为其模式（`call-0`、`call-1`、...）提供：5e 的 Conjure Animals，`[{"creature": "beasts/dire-wolf", "count": {"flat": 1}, "label": "One beast of CR 1"}, {"creature": "beasts/wolf", "count": {"flat": 2}, "label": "Two of CR 1/2"}]`。任何地方都找不到对应生物的选项不会提供。它们被放在条目瞄准的 `area` 中；没有范围时，放在使用者身旁。它们各自掷先攻，或在带 `"initiative": "after"` 时紧接召唤者行动。带 `"rounds": 10` 时，经过这么多轮后，召唤者的回合再次到来时，它们离开战斗；若条目带 `concentration`，则在专注结束时离开。会召来生物的 `utility` 条目在战斗中使用。在目录条目或物品使用上使用 `calls` 的规则集需要 Capability API 1.394。

状态给予的移动方式（Capability API 1.395）。战斗状态可以写 `"speeds"`：`{"fly": 60}`(5e 的 Fly)，或用 `"walk"` 表示与持有者行走一样快（`{"fly": "walk"}`，Dragon Wings）；`fly`、`swim`、`climb` 和 `burrow` 都适用，距离采用规则集自己的单位。在状态持续期间，持有者也可以用这些方式移动，自身原有的更快移动方式仍然保留；在回合中途获得时，新方式以剩余的行走距离开始。`"hover": true` 让持有者在无法移动时仍能停留在空中。`"levitates": true`(Levitate，以及作为物品使用状态的 Boots of Levitation) 让持有者只能以所给予的飞行速度上下移动，不能水平移动，并能悬停。状态结束时，持有者恢复原来的移动方式，身处空中且不再能飞行的人会像被击至倒地的飞行者一样坠落。使用其中任何一项的规则集需要 Capability API 1.395。

再生（Capability API 1.396）。生物、战斗状态或战斗等级可以写 `"regenerates"`：持有者在自己的每个回合开始时恢复的生命值，由 `flat` 和 `dice` 给出，再加上 `add`，即从持有者自身人物卡读取的值（生物绝不使用）。`stoppedBy` 指定会阻止下个回合开始时再生的伤害种类：troll 写作 `{"flat": 10, "stoppedBy": ["acid", "fire"], "keepsUp": true}`。带 `keepsUp` 时，持有者在 0 时只是倒下而不退出战斗，战斗继续；只有在其回合开始时生命值为 0 且没有恢复任何生命值，才会退出战斗。`atMostHalf` 只在生命值为最大值的一半或更低时恢复，`notAtZero` 则绝不在 0 时恢复：5e 的 Survivor 是勇士的一个等级，带 `{"flat": 5, "add": {"abilityMod": "con"}, "atMostHalf": true, "notAtZero": true}`。生命值必须以点数表示。日志会说明各自恢复了多少，或再生已被阻止。使用 `regenerates` 的规则集需要 Capability API 1.396。

以 1 点生命值撑住（Capability API 1.400）。生物的 `"hangsOn"`(1.320：每场战斗 `uses` 次、`extraTurn`、`label`) 现在也可以放在战斗状态或战斗等级上，并增加了一些条件。`save` 让持有者先掷骰：`{"save", "difficulty", "plusDamage", "raisedBy", "tally"}`，以指定的难度为基础，带 `plusDamage` 时加上该次打击造成的伤害，再为此前每次成功加上 `raisedBy`。次数按本场战斗计；带 `tally` 时，则按人物卡上某个池已消耗的量计：每次成功消耗 1，休息补满该池后重新计数。`notFrom` 指定它绝不对抗的伤害种类，`notCritical` 排除重击，`dealtAtMost` 排除造成伤害更多的打击。`spends` 指定人物卡上的一个池，每次支付 1，池空时就不再生效。必须有 `uses`、`spends` 或 `save`，而生物既不接受 `spends`，也不接受 `tally`。Undead Fortitude 是 zombie 的 `{"save": {"save": "con_save", "difficulty": 5, "plusDamage": true}, "notFrom": ["radiant"], "notCritical": true, "label": "Undead Fortitude"}`；boar 的 Relentless 是 `{"uses": 1, "dealtAtMost": 7}`；Relentless Endurance 是半兽人的一个等级，带 `{"spends": "relentless_endurance"}`，消耗一个只有一点、由长休息补满的池；Relentless Rage 是狂暴状态的 `{"save": {"save": "con_save", "difficulty": 10, "raisedBy": 5, "tally": "relentless_rage"}}`。直接杀死的效果绝不能靠它撑住，而并非伤害造成的降到 0，只有单纯的 `uses` 或 `spends` 才能撑住。生命值必须以点数表示。使用这些内容的规则集需要 Capability API 1.400。

从目录读取变形形态（Capability API 1.401）。变形的 `forms` 可以在 `"into"` 之外再写 `"from"`，也可以只写后者：`{"catalog", "filters", "notFilters"}` 提供该图鉴目录中符合所有 `filters` 且不符合任何 `notFilters` 的每个条目；两者都以筛选项 ID 配上一个值或值列表（任一值匹配即可，不区分大小写；像标签这样本身以列表为值的筛选项，其自身的任一值匹配即可）。指定的 `into` 形态排在前面，同一形态不会重复提供。`upTo` 和 `without` 照常限制可选形态。5e 的 Wild Shape 写作 `{"from": {"catalog": "creatures", "filters": {"type": "Beast"}}, "upTo": {"filter": "cr", "at": ...}, "without": [...]}`，Shapechange 则写作 `{"from": {"catalog": "creatures", "notFilters": {"type": ["Construct", "Undead"]}}, "upTo": ...}`。形态可以在 `into` 中指定，通过 `from` 从目录读取，或两者并用。使用 `from` 的规则集需要 Capability API 1.401。

从目录读取并随费用缩放的召唤（Capability API 1.402）。目录条目或物品使用的 `calls` 可以用 `"from"`(带 `filters` 和 `notFilters` 的目录，读取方式与变形形态相同) 代替单个 `creature`，并以 `upTo: {"filter", "at"}` 排除数字筛选项读数高于 `at` 的条目：每个匹配项都是使用者在使用时选择的一种模式。`options` 中的每个选项也可以这样做，因此 Conjure Animals 有四个选项：`{"from": {"catalog": "creatures", "filters": {"type": "Beast"}}, "upTo": {"filter": "cr", "at": 2}, "count": {"flat": 1}, "label": "One of CR 2"}`，以及 CR 为 1、1/2 和 1/4 的档位，数量分别为 2、4 和 8；当 `options` 从 `from` 读取时，其列表可以只含一个选项。`timesPerSteps` 让支付的更高费用每增加这么多级，数量的倍数就再增加一：Conjure Animals 和 Conjure Woodland Beings 写作 `2`(法术位高两级时数量为两倍，高四级时为三倍，高六级时为四倍)。生物的 `attackModes` 规则也接受 `"melee": true`，仅对近战攻击生效（投掷武器只有在目标处于触及范围内时才算近战）：Blood Frenzy 写作 `{"mode": "advantage", "targetHurt": true, "melee": true}`。使用其中任何一项的规则集需要 Capability API 1.402。

包裹，以及目标测试中的大小（Capability API 1.403）。生物行动可以写 `"engulf": {"upToSize", "save": {"save", "difficulty"}, "ownMovement"?, "atMost"?}`，且不能有自己的 `targets`、`area`、攻击掷骰或豁免。在棋盘上，选择此行动时选择一个由发动者走去的格子，移动距离不超过此行动借给它的速度（带 `ownMovement` 时，则使用它自己剩余的行走距离）；沿途进入大小不超过 `upToSize` 的生物所在空间；停下后，每个被进入过空间的生物都进行该豁免。失败时，行动的 `damage` 和 `applies` 作用于它们；成功时，或发动者已容纳 `atMost` 个生物时，它们被放在最近的空格子上。没有棋盘时，它指向一个生物。带 `"inside": true` 的战斗状态让被施加者留在施加者体内：被困者随困住自己的生物移动，不能自行行走，除了困住它们的生物（以及一同被困的其他生物），其他任何东西都不能作用于它们，它们也不能对外产生任何作用。最后一个这样的状态结束时（脱困检定、`endsWhenSourceDown`），它们被放在困住自己的生物身旁。状态的 `harms` 现在可以在 `at` 中指定 `"source-turn-start"` 或 `"source-turn-end"`(即施加者的回合开始或结束时)，并带 `"save": {"save", "difficulty"?}`，持有者每次豁免成功都能免受该次伤害；未指定难度时，对抗状态自身的难度。因此 gelatinous cube 的 Engulf 写作 `{"engulf": {"upToSize": "large", "save": {"save": "dex", "difficulty": 12}}, "damage": {"dice": "3d6", "type": "acid"}, "applies": [{"condition": "engulfed"}]}`，其中 `engulfed` 带束缚和 `inside`，通过 DC 12 的 Strength 检定即可结束，并带 `harms: {"at": "source-turn-start", "dice": "6d6", "type": "acid"}`；shambling mound 的 Engulf 在伤害上再加 `"save": {"save": "con", "difficulty": 14}`。目标测试（`targetIs`，以及所有读取目标测试的内容）除了所指定的类型或标签，也接受来自 `combat.sizes` 的 `upToSize` 和 `atLeastSize`：只能擒抱中型或更小目标的啃咬，用 `"targetIs": {"upToSize": "medium"}` 施加擒抱。现在一次召唤还能带来最多 32 个生物（之前为 8），因此 Conjure Animals 召唤的八只狼在 5 级时变为 16 只，在 7 级时变为 24 只。使用其中任何一项的规则集需要 Capability API 1.403。

消耗列表行资源池、仅在狂暴期间撑住，以及数值择优的变形（Capability API 1.404）。`hangsOn` 的 `spends` 及其豁免的 `tally`，除了通过 ID 指定已声明的池，也可以通过名称指定列表行的池：半兽人的 Relentless Endurance 写作 `{"spends": "Relentless Endurance"}`，从其计数器行消耗（即某个目录条目写入带池列表的一行；任何其他名称都会被拒绝）。`whileHolding` 把撑住效果限制为只在持有者具有所列状态之一时生效：Relentless Rage 是一个由其特性保持生效的状态，带 `{"whileHolding": ["raging"], "save": {"save": "con_save", "difficulty": 10, "raisedBy": 5, "tally": "Relentless Rage"}}`。战斗状态的 `shape` 接受 `"betterOf": true`：对于持有者人物卡具有熟练的每项豁免和对抗检定（检定按其值读取的技能判断），取形态自身数值与形态的属性调整值加持有者熟练加值两者中的较高值（专精则按档位规定加倍）；其余全部使用形态的数值，指定保留的内容仍然使用持有者自己的数值（Wild Shape、Shapechange：Dex 为 16、没有 Dexterity 豁免熟练的德鲁伊使用 brown bear 的 +0；具有 Athletics 熟练时，则使用熊的 Strength 加上自己的熟练加值，若熊的加值更高就用熊的）。在 1.405 之前，每项豁免和检定都会取较高值。使用其中任何一项的规则集需要 Capability API 1.404。

吞咽、吐出与爬出（Capability API 1.405）。战斗状态的 `inside` 可以是对象，代替 `true`：`"room": {"of", "takes"?}` 指定一个生物通过该状态同时能容纳多少，每个体内生物占一个位置，或按 `takes` 中对应其在 `combat.sizes` 中大小的值占位（water elemental 的 Whelm，“一个大型生物，或最多两个中型或更小的生物”，写作 `{"of": 2, "takes": {"large": 2}}`）；放不下的生物不会被吞入。`"releasedWhen": {"dealt", "save": {"save", "difficulty"}, "prone"?}` 让被困者在任何一个回合中从体内对困住自己的生物造成至少 `dealt` 伤害后，于该回合结束时出来，除非困住它的生物豁免成功：behir 的“在单个回合内受到其体内一个生物造成的至少 30 点伤害……DC 14 的 Constitution 豁免……倒地”写作 `{"dealt": 30, "save": {"save": "con", "difficulty": 14}, "prone": true}`。`"corpse": {"costs", "prone"?}` 让被困者在困住自己的生物倒下、状态结束（带 `endsWhenSourceDown`）后仍留在其体内，直到花费 `costs` 的移动距离（采用规则集的距离单位，以“爬出来”操作提供）爬出，落在其身旁；写明倒地时就倒地：purple worm 的“使用 20 英尺移动距离，以倒地姿态出来”。以倒地姿态被释放时，使用战斗中带 `half-move-to-stand` 效果的状态。包裹也以相同方式接受 `"room"`，代替 `atMost`。“一次只能吞咽一个”则由吞咽啃咬自身的 `applies` 配合 `heldAtMost`(1.320) 表达。生物行动可以带 `targetTypes`，读取方式与目录条目相同，因此 behir 的 Constrict 只指向符合 `{"is": {"upToSize": "large"}}` 的目标。生物的连击序列可以带 `"allHit": {"targetIs"?, "applies"?, "uses"?}`：当其中的每次攻击都命中同一个目标，且该目标符合 `targetIs` 时，`applies` 中的状态就会施加到它身上，然后对它使用该生物自身由 `uses` 指定的行动（包裹照常要求它豁免，其他行动则对它结算）。shambling mound 的 Multiattack 是两次 Slam，带 `{"allHit": {"targetIs": {"upToSize": "medium"}, "applies": [{"condition": "grappled", "escapeDc": 14}], "uses": "engulf"}}`。使用其中任何一项的规则集需要 Capability API 1.405。

防御下限（Capability API 1.406）。调整值 `{"to": "defense", "atLeast": …}` 在生效期间防止持有者的防御低于该下限，在其他所有改动之后、掩护之前计算；命中记录会把该下限显示为它使防御提高的数值。`atLeast` 可以是数字（Barkskin：`{"to": "defense", "atLeast": 16}`），也可以是从持有者人物卡读取的值，由规则集自己的派生值完成计算：Mage Armor 的“基础 AC 变为 13 + 其 Dexterity 调整值”写作 `{"to": "defense", "atLeast": {"derived": "ac_mage_armor"}}`，其中 `ac_mage_armor` 将 13、Dexterity 调整值、所佩戴盾牌的加值，以及每穿一套护甲计入的 -100 相加。由于下限从不降低任何数值，会像玩家自行选择时一样，使用两个护甲等级中较高的一个。没有人物卡的生物从数值块的属性中读取 `const` 或 `abilityMod`。它可以单独放在战斗状态、等级或物品效果上：旁边不能有 `flat`、`dice`、`times` 或 `mode`。使用它的规则集需要 Capability API 1.406。

吞咽续篇（Capability API 1.407）。行动施加的内容（`applies`）可以带 `"targetHolds": {"conditions"?, "fromSelf"?}`：仅对已经具有所列状态之一的目标施加，状态可以来自任何人，也可以要求来自当前施加者；在施加时读取，因此同一列表中先施加的状态也算。与行动自身的 `targetHolds` 不同，行动的其余部分仍可作用于任何人：kraken 的 Bite 命中谁就伤害谁，只有被该 kraken 擒抱的目标才会被吞咽（`{"condition": "swallowed", …, "targetHolds": {"fromSelf": ["grappled"]}}`）。`"endsOnTarget": [conditions]` 在该状态施加后，移除目标身上由当前施加者施加的所列状态：purple worm 的吞咽，随后“擒抱结束”。带 `inside` 的状态上的 `"harmsPuller": {"dice"?, "flat"?, "type"?}`，指定试图把该状态持有者拉出来的生物会受到的伤害，无论成败。拉出操作是一个带 `"pulls": true`、并用 `"targetHolds"` 指定该 `inside` 状态的对抗：对身处另一生物体内的人提供该操作，能够穿过该生物的身体触及被困者，距离量到该生物，以该束缚指定的脱困 DC（其 `escapeDc`）为对抗难度；未指定时使用对抗自身的 `difficulty`，不设防守方。其 `onWin.ends` 移除束缚，让被困者出现在该生物身旁。5e 的 gelatinous cube 写作 `{"id": "pull_out", "label": "Pull out", "budget": "action", "pulls": true, "targets": "ally", "targetHolds": "engulfed", "attacker": {"checks": ["might"]}, "onWin": {"ends": [{"condition": "engulfed", "on": "target"}]}}`，cube 的 Engulf 施加 `engulfed` 时带 `"escapeDc": 12` 和 `"harmsPuller": {"dice": "3d6", "type": "acid"}`；water elemental 的 Whelm 只指定 `"escapeDc": 14`，不加其他内容。身处另一生物体内的任何人，都按该生物的位置判定是否能触及。战斗状态可以带 `"takesSourceHarm": {"share"}`：在持续期间，其持有者承受施加者所受伤害的该份额，施加者只承受余下的伤害，向下取整。rug of smothering 的 Damage Transfer 写作 `{"share": 0.5}`，放在其 Smother 施加的 `smothered` 状态上，该状态带 `"endsWith": "grappled"` 和 `"heldAtMost": 1`(一次一个目标)，同时施加带 `"escapeDc": 13` 的 `grappled`；该状态的 `harms` 在目标的每个回合开始时造成 10 (2d6 + 3) 钝击伤害，`restrained` 和 `blinded` 也都带 `"endsWith": "grappled"` 一同施加。使用其中任何一项的规则集需要 Capability API 1.407。

重掷指定点数（Capability API 1.408）。战斗状态或等级可以带 `"rerollsFace": {"face", "rolls"?}`：每当持有者自己的攻击掷骰、豁免或检定（战斗中掷出的对抗、物品使用门槛检定及属性检定），在战斗自身的某颗攻击骰上出现 `face` 时，该骰子就重掷一次并保留新的点数，即使又掷出相同点数也一样。`rolls` 将其限制在 `"attacks"`、`"saves"` 和 `"checks"` 中的某些类型；省略时三者都包括。有优势或劣势时，每颗掷出该点数的骰子都重掷。日志会说明重掷了什么，以及掷出了什么。5e 半身人的 Lucky 是 `{"face": 1}`，放在该半身人人物卡读数为 1 的派生值的一个等级上。掷骰池的战斗没有这样的骰子，因此会拒绝此项。使用它的规则集需要 Capability API 1.408。

向状态来源复制伤害（Capability API 1.409）。带 `"copiesHarmToSource": true` 的战斗状态，让施加者承受持有者所受的相同伤害，类型相同，数值先经过持有者自身的抗性减免，再由施加者自身的抗性减免。5e 的 Warding Bond 是一个 `warded` 状态，带对防御和豁免的 +1、`resist-all` 效果、`"copiesHarmToSource": true`、`"endsWhenSourceDown": true`，以及一个带 `"endsAway": {"beyond": 60}` 的 `applies` 条目。以这种方式或通过 `takesSourceHarm` 传递的伤害绝不会再次传递，因此两个连结不能来回传递同一份伤害。使用它的规则集需要 Capability API 1.409。

按额度归还资源池（Capability API 1.410）。目录条目的 `mechanics` 可以带 `"recovers": {"group", "upTo", "most"?}`：使用时，归还该池组中由使用者选定的池里已消耗的资源，其等级总和不得超过 `upTo`(从使用者人物卡读取的值)，任何一个的等级都不得高于 `most`。池的等级取自身的 `level`，否则取其在组内的位置。游戏主持人（GM）在使用时指定它们，`[sheet: op="use" name="Arcane Recovery" recover="Level 1 Slot:2, Level 2 Slot:1"]`；池不写数量时代表一个，可以按 ID 或标签指定。使用时仍要支付条目的费用，包括其计数器行；若池不属于该组或高于 `most`，已消耗数量少于要求归还的数量，或等级总和超过 `upTo`，则整次使用都会被拒绝。5e 的 Arcane Recovery 写作 `{"group": "slots", "upTo": {"derived": "arcane_recovery_levels"}, "most": 5}`，其中派生值为法师等级的一半，向上取整；Natural Recovery 相同，但改用德鲁伊等级。使用它的规则集需要 Capability API 1.410。

随人物卡变化的文本，以及在掷先攻时补充的资源池（Capability API 1.411）。行的 `scaled` 列在用 `"texts"` 代替 `table` 时，可以是 `text` 或 `enum` 列：各步骤写作 `[threshold, text]`，阈值依次严格递增，格子取参考值达到的最后一个步骤的文本（一个也未达到时取第一个）；枚举的文本必须属于其可选值，`values` 仍保存该行的初始文本。5e 的 Font of Inspiration 是 Bardic Inspiration 计数器上的 `"scaled": {"recharge": {"from": {"field": "bard_level"}, "texts": [[1, "long"], [5, "short"]]}}`。目录条目的 `mechanics` 可以带 `"refillsAtInitiative": {"pool", "amount"?}`：战斗掷先攻时，持有该条目且该资源池已耗尽的人物卡，会恢复 `amount`（省略时为 1），但不会超过最大值，日志也会说明；这里的资源池可以是按 ID 指定的实时资源池，也可以是按名称指定的列表行资源池。5e 的 Superior Inspiration 写作 `{"pool": "Bardic Inspiration"}`。使用其中任一功能的规则集需要 Capability API 1.411。

敌人倒下时获得临时点数（Capability API 1.412）。战斗状态或等级可以带 `"fellsGrant": {"temporary": <value>}`：另一方的生物降到 0，且该状态或等级的持有者是最后对其造成伤害的人时，持有者获得这么多临时点数，数值从其人物卡读取（生物读取 `const`）。与所有临时点数一样，它们从不叠加，只保留较大的缓冲量。战斗的生命值必须使用点数资源池，不能使用伤势轨道。5e 的 Dark One's Blessing 是在派生的邪魔契约邪术师等级达到 1 时生效的等级，带 `{"temporary": {"derived": "dark_ones_blessing"}}`，该派生值为魅力调整值 + 邪术师等级，至少为 1。使用此功能的规则集需要 Capability API 1.412。

用人物卡上的值减免伤害，以及减免坠落伤害（Capability API 1.413）。`damage` 或 `damage-taken` 的调整值可以带 `"add"`，其值从持有者的人物卡读取（没有人物卡的生物从数值块读取 `const` 或 `abilityMod`），与 `dice` 和 `flat` 一起相加；带 `"minus": true` 时，骰子和值都改为减去，且一次打击的伤害绝不会低于 0。5e 的 Deflect Missiles 是针对远程 `hit` 的反应，会施加一个持续一次攻击的状态（`endsAfter: "attacked"`），带 `{"to": "damage-taken", "blow": "ranged", "dice": "1d10", "add": {"derived": "deflect_missiles"}, "minus": true}`，派生值为敏捷调整值 + 武僧等级。带 `"falls": true` 的 `damage-taken` 调整值只减免坠落伤害，不影响其他伤害，且不能与 `attacks`、`blow`、`ability`、`fromSource` 和 `times` 同用；状态的调整值一旦减免了坠落伤害，该状态就会消耗掉。5e 的 Slow Fall 是针对 `falls` 的反应，会施加带 `{"to": "damage-taken", "falls": true, "add": {"derived": "slow_fall"}, "minus": true}` 的状态，数值为武僧等级的五倍。使用其中任一功能的规则集需要 Capability API 1.413。

按目录筛选项修改条目（Capability API 1.414）。修改可以用 `"catalogs"` 代替 `"entry"`，改变持有者使用的这些目录中的所有条目，而 `"where": {"filter", "equals"}` 将范围收窄到声明的筛选项值相符的条目（值为一个词、数字或词语列表中的一个，不区分大小写）。它还支持两种新的改动。`"damageOnce"` 从持有者的人物卡读取值，加到每次使用的一次伤害掷骰上：若所有目标承受同一次掷骰的结果（范围效果、直接命中的飞弹），则每个目标都承受这部分加值；若条目对每个目标分别掷骰，则加到第一次命中上。5e 的 Empowered Evocation 写作 `{"catalogs": ["spells"], "where": {"filter": "school", "equals": "evocation"}, "damageOnce": {"abilityMod": "int"}}`。`"halfOnSave": true` 使原本会 `negates` 条目伤害的豁免改为保留一半伤害，只改变伤害，不改变条目的其他效果：Potent Cantrip 的 `where` 限定等级为 0。变更（`alters`）接受相同的 `"where"`，只适用于这些条目，并为 `spares` 增加两个键：`"sparesByLevel": true` 额外豁免的目标数等于条目支付时的等级，`"sparesWhole": true` 表示在豁免成功仍承受一半伤害的情况下，被它豁免的目标完全不受影响（日志会说明其避开了效果）。5e 的 Sculpt Spells 是一个无费用的 `utility`，带 `{"catalogs": ["spells"], "where": {"filter": "school", "equals": "evocation"}, "spares": {"const": 1}, "sparesByLevel": true, "sparesWhole": true}`；与 Careful Spell 一样，选择通过 `spares` 指定豁免谁。使用其中任一功能的规则集需要 Capability API 1.414。

伤害和治疗取最大值，以及伤害使用者的变更（Capability API 1.415）。变更的 `"maximizes": {"fromLevel"?, "upToLevel"?}` 让适用条目的伤害取最大值，每个骰子（包括伤害段和更高支付等级带来的骰子）都取最大骰面；它只适用于造成伤害、且支付等级在这些界限内的条目（选择界限之外的条目会以 `bad-alter` 拒绝）。其 `"backlash": {"free", "dice", "grows"?, "type"?, "unblockable"?}` 会在变更后的内容施放完毕后伤害使用者，条件是条目通过 `usesOf` 消耗的计数器已超过前 `free` 次使用（从该计数器上次恢复后开始计数）：条目支付时的每个等级都带来 `dice`，每超过第一次造成伤害的使用一次，每个等级再增加 `grows`；`unblockable` 无视抗性和免疫。5e 的 Overchannel 是消耗“Overchannel 使用次数”计数器的 `utility`，该计数器在长休息时恢复，带 `{"catalogs": ["spells"], "where": <wizard spells>, "maximizes": {"fromLevel": 1, "upToLevel": 5}, "backlash": {"free": 1, "dice": "2d12", "grows": "1d12", "type": "necrotic", "unblockable": true}}`。修改的 `"maxHeal": true` 使其修改的每个条目都按最大值治疗：Supreme Healing，`{"catalogs": ["spells"], "maxHeal": true}`。使用其中任一功能的规则集需要 Capability API 1.415。

接住并掷回飞射物（Capability API 1.416）。当目标持有的带 `"minus": true` 的 `damage-taken` 调整值将一次武器打击的伤害减到零时（Deflect Missiles，1.413），等所有受到该打击伤害的人都没有反应需要处理后，会为接住它的人开启 `"caught"` 时刻。反应的 `"freeSlot"` 指定一个物品槽位，只有持有者至少有一个该槽位空闲（未被穿戴或仍持有的物品占据）时才提供该反应；使用数值块的生物始终视为满足。带 `"throwsCaught": true` 的条目是一个有伤害量、需要掷骰命中的攻击，在 `on` 为 `"caught"` 时使用：伤害采用接住的飞射物的骰子和类型，同时保留条目自身的固定部分。5e 的 Deflect Missiles 掷回是一个通过 `usesOf` 消耗 1 点气的 `free` 能力，写作 `{"kind": "attack", "attackRoll": true, "amount": {"dice": "1d4"}, "amountAdd": {"abilityMod": "dex"}, "range": 60, "throwsCaught": true, "reaction": {"on": "caught", "at": "chosen", "freeSlot": "hand"}}`。使用其中任一功能的规则集需要 Capability API 1.416。

在特定状态下压制、针对所见来源的豁免，以及阻止对手获得优势（Capability API 1.417）。战斗状态或等级可以带 `"notWhile"`，通过 ID 指定状态，或通过效果指定状态所做的事：持有者带有其中任一个时，它就被压制，因此 `"cannot-act"` 涵盖任何使持有者失能的状态。`"whenSeen": true` 让它的豁免效果和豁免调整值只在对抗持有者能看见的事物时生效（没有来源的豁免视为可见）；它必须与至少一种这样的效果或调整值并用。5e 的 Danger Sense 是等级 `{"derived": "barbarian_level", "at": 2, "effects": ["own-saves-advantage"], "saves": ["dex_save"], "whenSeen": true, "notWhile": ["blinded", "deafened", "cannot-act"]}`。效果 `"attacks-against-no-advantage"` 在持有者能够行动时，阻止针对持有者的每次攻击掷骰获得优势，无论优势来自哪里；劣势仍然生效。5e 的 Elusive 是等级 `{"derived": "rogue_level", "at": 18, "effects": ["attacks-against-no-advantage"]}`。使用其中任一功能的规则集需要 Capability API 1.417。

检定的下限（Capability API 1.418）。战斗状态或等级可以带 `"checkFloor": {"face"?, "total"?, "proficient"?, "abilities"?, "skills"?}`，在战斗内外都生效：单个骰子的骰面低于 `face` 时按 `face` 计算（天然骰面也如此，因此不再是 1），总值低于 `total`（从持有者人物卡读取的值）时按该值计算。`proficient: true` 将范围收窄到持有者受过训练的技能检定，`abilities` 和 `skills` 则限定为使用这些属性和技能的检定。它绝不影响豁免。5e 的 Reliable Talent 是等级 `{"derived": "<rogue level>", "at": 11, "checkFloor": {"face": 10, "proficient": true}}`，Indomitable Might 是等级 `{"derived": "<barbarian level>", "at": 18, "checkFloor": {"total": {"abilityScore": "str"}, "abilities": ["str"]}}`。使用此功能的规则集需要 Capability API 1.418。

从人物卡读取未受训练时的加值（Capability API 1.419）。技能、豁免或分区的 `untrained` 可以是 `{"add": <value>}`：第一档位的检定会加上从人物卡读取的该值，随人物卡一起计算，并显示在技能的数值中。属性的 `"checkAdd"` 加到仅使用该属性、不属于任何技能的检定上。与上限一样，两者都不能读取技能或豁免调整值，其读取的派生值以及通向该派生值的所有派生值也都不能读取。5e 的 Jack of All Trades 使用派生值 `jack`（从吟游诗人第 2 级起为熟练加值的一半，向下取整，否则为 0），将每项技能的 `untrained` 设为 `{"add": {"derived": "jack"}}`，每项属性的 `checkAdd` 也使用它，并将它加到先攻派生值中；Remarkable Athlete 同理，但对力量、敏捷和体质使用向上取整的一半，两者取较大值。使用其中任一功能的规则集需要 Capability API 1.419。同一次版本更新也把 `combat.levels` 的条目上限从 20 提高到 40；超过 20 个的规则集同样需要 1.419。

目录条目的长射程，以及掷回时的骰子（Capability API 1.420）。目录条目的 `mechanics.longRange` 表示超出 `range` 后仍能到达的距离，使用同一单位，且必须大于 `range`；超出该射程时，按 `combat.ranged` 的规定增加难度，与物品或生物的长射程相同，Distant 一类的变更会同时延长两者。`throwsCaught` 可以是 `{"die": {"from": <value>, "table": [[level, sides], ...]}}`：若这种骰子平均结果更好，掷回接住的飞射物时就用一颗该面数的骰子代替飞射物自己的骰子，保留其伤害类型。5e 的 Deflect Missiles 掷回使用 `"range": 20, "longRange": 60`，并带 `"throwsCaught": {"die": {"from": {"field": "level"}, "table": [[1, 4], [5, 6], [11, 8], [17, 10]]}}`，飞射物视为武僧武器。使用其中任一功能的规则集需要 Capability API 1.420。

修改额外提供的治疗（Capability API 1.421）。修改的 `"healAdd": {"add"?, "perLevel"?, "fromLevel"?}` 让其修改的条目对每个受治疗生物多治疗这么多：从持有者人物卡读取的 `add`，加上条目支付时每个等级对应的 `perLevel`；支付等级低于 `fromLevel` 的条目则没有额外治疗。其 `"healsSelf"` 使用同一格式，在条目治疗了持有者以外的人时，也治疗持有者自己，每次使用只触发一次。5e 的 Disciple of Life 写作 `{"catalogs": ["spells"], "healAdd": {"add": {"const": 2}, "perLevel": 1, "fromLevel": 1}}`；Blessed Healer 则将同一内容放在 `healsSelf` 中。使用其中任一功能的规则集需要 Capability API 1.421。

攻击结束时，以及还击或转移攻击的反应（Capability API 1.422）。需要掷骰命中的攻击结束后，无论命中与否，都会开启反应的 `"on": "attacked"` 时刻，只询问该攻击的目标；若该攻击先开启了 `harmed` 或 `caught` 时刻，则在这些时刻之后开启。`"missed": true` 将范围收窄为未命中持有者的攻击，`"blow"` 则限定为近战或远程攻击。有明确来源的任何时刻都可以带 `"sourceIs"`，这是造成该时刻的人必须通过的目标测试（`types`、`tags`、`upToSize`、`atLeastSize`）。反应条目的 `"strikesWith": "melee"` 会让持有者用自己最好的近战武器打击造成该时刻的人，方式与借机攻击相同；条目本身不造成伤害。其 `"redirects": true` 用于带 `missed` 且 `"at": "chosen"` 的 `attacked` 时刻，让未命中的人对持有者选定的生物再次作出同一攻击，该生物绝不能是持有者自己，且必须在该攻击的触及范围或射程内。5e 的 Retaliation 使用 `{"on": "harmed", "within": 5}` 和 `strikesWith`；Giant Killer 使用 `{"on": "attacked", "within": 5, "sourceIs": {"atLeastSize": "large"}}` 和 `strikesWith`；Stand Against the Tide 使用 `{"on": "attacked", "missed": true, "blow": "melee", "at": "chosen"}`、`redirects` 和 `"targets": "any"`。使用其中任一功能的规则集需要 Capability API 1.422。

庇护（Capability API 1.423）。战斗状态的 `"sanctuary": {"save", "difficulty"?, "from"?, "immuneOnSave"?}` 让任何将攻击或有害条目指向持有者的人先掷 `save`（范围效果除外，持有者自身也绝不受此限制）。难度采用施加该状态时的难度；没有时，则从持有者的人物卡读取 `difficulty`。失败时，攻击或条目转向最近的另一个合法目标生物，该生物必须不在其原有目标中，且没有庇护；若不存在这样的生物，攻击或条目就失效。`from` 将范围限定为通过目标测试的攻击者，`immuneOnSave` 则让豁免成功者在本场战斗余下时间免受此庇护限制。5e 的 Sanctuary 是带 `{"save": "wis_save"}` 的状态，由法术以其豁免难度施加，并通过 `endsWhenHolder` 在攻击和施法时结束；Tranquility 是长休息时施加的同一状态，`"difficulty"` 为武僧的气豁免 DC；Nature's Sanctuary 写作 `{"save": "wis_save", "difficulty": <spell save DC>, "from": {"types": ["beast", "plant"]}, "immuneOnSave": true}`，由特性使其持续生效。使用此功能的规则集需要 Capability API 1.423。

结束目录条目施加的状态（Capability API 1.424）。目录条目的 `"endsSpells": {"catalogs", "count"?, "upTo"?, "above"?}` 会在其作用到的每个生物身上，结束这些目录的条目施加的状态，从最高等级开始，最多结束 `count` 个。等级在 `upTo` 以内的直接结束（可以是 `"paid"`，即条目支付时的等级，也可以是数字）；超过它的则必须以 `above.check`（从使用者人物卡读取的值）对抗 `above.dc` 加上该状态等级作检定，成功才结束；没有 `upTo` 时，每个状态都需要如此检定。若状态由施法者的专注维持，则结束整个法术。5e 的 Dispel Magic 写作 `{"catalogs": ["spells"], "upTo": "paid", "above": {"check": {"derived": "spellcasting_mod"}, "dc": 10}}`；Cleansing Touch 是带 `{"catalogs": ["spells"], "count": 1}` 的 `utility`。使用此功能的规则集需要 Capability API 1.424。

作用到敌人的施法，以及庇护阻止的内容（Capability API 1.425）。已施加状态的 `endsWhenHolder` 可以在 `casts` 之外带 `"castsAtFoes": true`：这样，只有来自这些目录、且作用到持有者至少一个敌人的施法才会结束它，无论是直接指向敌人，还是范围或伤害波及敌人；因此，受 Sanctuary 保护的牧师对友方施放 Cure Wounds 时仍保留庇护。战斗状态的 `sanctuary` 可以带 `"against": {"attacks"?: true, "casts"?: [catalogs]}`，只阻止攻击和从这些目录施放的有害条目，而非所有有害条目：5e 的 Sanctuary 写作 `{"attacks": true, "casts": ["spells"]}`，Nature's Sanctuary 写作 `{"attacks": true}`。使用其中任一功能的规则集需要 Capability API 1.425。

施加状态的休息（Capability API 1.426）。休息的 `"puts": [{"condition", "when"?}]` 会在休息结束时、执行其 `clear` 之后，为符合 `when`（`{"value", "atLeast"?, "atMost"?}`）的人物卡施加各个实时状态。也在 `clear.conditions` 中指定该状态，就能让每次这样的休息都重新施加一个全新的状态；战斗中移除的状态会一直消失，直到这次休息。战斗状态自身的 `endsWhenHolder` 现在也可以写 `"attacks": true` 和 `"casts": [catalogs]`，并带上文所述的 `"castsAtFoes": true`，这样无论状态如何施加，包括由休息施加，都能结束它并从人物卡移除。5e 的 Tranquility 是长休息的 `{"condition": "tranquility", "when": {"value": {"derived": "monk_18"}, "atLeast": 1}}`，其状态为 `sanctuary`，难度从武僧人物卡读取，`endsWhenHolder` 为 `{"attacks": true, "casts": ["spells"], "castsAtFoes": true}`。使用其中任一功能的规则集需要 Capability API 1.426。

清除临时点数的休息（Capability API 1.804）。休息的 `"clear": {"temp": true}` 会在休息结束时，先执行恢复，再移除每个资源池的临时点数。没有此项时，休息不改变临时点数。5e 的长休息会清除它们，因为临时生命值只持续到长休息。使用此功能的规则集需要 Capability API 1.804。

选择 `endsSpells` 结束的内容，以及结束持续范围（Capability API 1.427）。带 `"chosen": true` 时，使用者选择结束目标身上来自这些目录的哪些状态，最多 `count` 个，而非从最高等级开始：5e 的 Cleansing Touch 写作 `{"catalogs": ["spells"], "count": 1, "chosen": true}`。带 `"zones": true` 时，它可以改为指向触及范围内由这些目录的条目留下的持续范围，而不是生物，并按相同的 `upTo` 和 `above` 条件结束它，同时结束维持它的专注：例如对 Wall of Fire 或 Cloudkill 使用 Dispel Magic。`endsSpells` 也适用于物品的 `use` 和 `moreUses`，与目录条目相同：Dispel Magic 的 Spell Scroll 写作 `{"catalogs": ["spells"], "upTo": 3, "above": {...}, "zones": true}`。使用 `chosen` 或 `zones` 的规则集需要 Capability API 1.427。

范围内的武器打击，以及再次打击（Capability API 1.428）。带 `area` 和 `"strikesWith": "melee"` 或 `"ranged"` 的 `utility` 条目，会用使用者最好的该类武器，打击范围内另一方的每个生物（带 `"targets": "any"` 时双方都包括），每个目标分别作攻击掷骰、消耗一发弹药，弹药耗尽时停止；远程条目若没有自身的 `range`，可将范围放置在武器射程内的任意距离。5e 的 Whirlwind Attack 写作 `{"kind": "utility", "strikesWith": "melee", "area": {"shape": "burst", "size": 5, "around": true}}`，Volley 写作 `{"kind": "utility", "strikesWith": "ranged", "area": {"shape": "burst", "size": 10}}`。战斗状态或等级的 `"strikesAgain": {"within"}` 让持有者在自己的每个回合中，可以在对一个生物作出武器攻击后，用同一武器免费打击另一个生物一次，该生物须在第一个生物的 `within` 距离内，且在武器触及范围内：Horde Breaker，`{"within": 5}`。使用其中任一功能的规则集需要 Capability API 1.428。

人物卡上的选择，以及从人物卡读取并用于攻击、检定和豁免的值（Capability API 1.429）。文本或枚举人物卡字段可以存放选择，Engine 按其中的词语读取，以逗号分隔，不区分大小写。调整值的 `"atTypesIn": [fields]` 只在生物的类型或标签（按 ID 或标签文本）被这些字段之一列出时，改变持有者自身对该生物的攻击或伤害。战斗状态的 `"resistIn": [fields]` 赋予对这些字段列出的伤害类型的抗性。修改的 `"damageTypeIn": field` 只改变造成该字段指定类型伤害的条目，无论是条目自身还是某个伤害段的伤害。调整值的 `add`（从持有者人物卡读取的值）现在除了伤害外，还可以用于 `attacks`、`checks` 和 `saves`，带 `rescue` 时与骰子一样暂缓使用。暂缓使用的攻击改动可以写 `"oncePer": "own-turn"`，在持有者自己的每个回合中计一次，绝不会随其状态一起消耗；还可以写 `"orDamage": true`，在不需要此改动也能命中时，将其加到该次打击的伤害上；伤害调整值也可以写 `"oncePer": "own-turn"`。检定改动可以写 `"proficient": true`，仅对持有者加上完整熟练加值的技能生效，战斗内外都适用。5e 的 Foe Slayer 是持续生效的状态，带 `{"to": "attacks", "add": {"abilityMod": "wis"}, "rescue": true, "oncePer": "own-turn", "orDamage": true, "atTypesIn": ["favored_enemies"]}`。Elemental Affinity 是修改 `{"catalogs": ["spells"], "damageTypeIn": "draconic_damage_type", "damageOnce": {"abilityMod": "cha"}}`，加上一个消耗 1 点术法点的自由功能行动，施加持续一小时、带 `"resistIn": ["draconic_damage_type"]` 的状态。Natural Explorer 是已施加的（`contextual`）效果 `{"modifiers": [{"to": "checks", "abilities": ["int", "wis"], "proficient": true, "add": {"derived": "proficiency_bonus"}}]}`，偏好地形写在文本字段中供游戏主持人（GM）读取。使用其中任一功能的规则集需要 Capability API 1.429。

针对已命中过的攻击者的防御，以及仅针对借机攻击（Capability API 1.430）。带 `"afterHitBy": true` 的 `defense` 调整值，只在对抗本回合已用攻击命中过持有者的生物时生效：5e 的 Multiattack Defense 是持续生效的状态或等级，带 `{"to": "defense", "flat": 4, "afterHitBy": true}`。带 `"opportunity": true` 的 `attacks-taken` 调整值，只对持有者移开时针对持有者作出的借机攻击生效：Escape the Horde 写作 `{"to": "attacks-taken", "mode": "disadvantage", "opportunity": true}`。使用其中任一功能的规则集需要 Capability API 1.430。

无需专注即可维持，以及仅在豁免成功后免受影响（Capability API 1.431）。条目的 `"sustains": {"budget"}` 会在它施加到生物身上、持续若干轮的状态仍在时，以该额度再次提供此条目：使用后，这些轮数重新开始计算，如同刚施加一样，没有费用、不作豁免，也不产生其他效果，并且只能指向仍带有该状态的生物。其 `"oncePerTarget": {"until", "whenSaved": true}` 仅让豁免成功的生物在指定休息之前免受影响。5e 的 Intimidating Presence 是以一个行动对 30 英尺内一个生物使用的 `debuff`，以感知豁免对抗 8 + 熟练 + 魅力，施加恐惧 `{"duration": {"rounds": 1, "of": "source"}, "endsAway": {"beyond": 60, "unseen": true}}`，并带 `"sustains": {"budget": "action"}` 和 `"oncePerTarget": {"until": "long", "whenSaved": true}`。使用其中任一功能的规则集需要 Capability API 1.431。

在地面上通行的方式（Capability API 1.432）。战斗状态或等级可以写 `"ignoresHardGround": true`：在棋盘上，地面自身造成的难行（其地形和植被）对持有者只消耗普通一步的费用，而法术制造的持续范围造成的难行，仍按完整费用计算。向上跨一级仍多消耗一步。还可以写 `"runsAcross": true`：持有者步行时可以跨越任意高度，像攀爬者一样支付踏入地面的费用，并以普通一步的费用越过水面，但除非会游泳或飞行，否则绝不会将水面作为可停留位置提供；在水面上被中途打断的行走（途中被定住）会将持有者放到最近的空地，日志也会说明。从派生值读取的等级，只有在该值达到要求时才生效，因此护甲限制要用派生值表达。5e 的 Land's Stride 是基于统计特性列的派生值的等级（第 6 级的大地结社德鲁伊和第 8 级的游侠），带 `ignoresHardGround`；其对抗 Entangle 时的豁免优势，则使用带 `against` `{"actions": ["Entangle"]}` 的豁免调整值。第 9 级的 Unarmored Movement 是基于派生值的等级，该值将“未穿护甲或持盾”与“武僧等级为 9 或以上”相乘，并带 `runsAcross`。使用其中任一功能的规则集需要 Capability API 1.432。

距离过远或看不见（Capability API 1.433）。已施加状态的 `"endsAway": {"beyond", "orUnseen": true}` 会在持有者结束回合时，若其与施加者的距离超过 `beyond`，或无法看见施加者，就结束状态，满足任一个即可；只在此时判断，绝不在行走途中判断。`"unseen": true`(1.310) 仍要求两者同时满足，在行走的每一步结束和每个回合结束时判断；一个条目只能指定这两者之一。5e 的 Intimidating Presence 施加恐惧，并带 `"endsAway": {"beyond": 60, "orUnseen": true}`：“若该生物结束回合时与你之间没有视线，或距你超过 60 英尺，此效果结束。”使用此功能的规则集需要 Capability API 1.433。

休息指定的行，以及从人物卡读取的限制条件（Capability API 1.434）。休息针对 `listPools` 的 `restore` 步骤可以指定一个 `row`，按列表的名称列匹配，不区分大小写，只恢复该行的资源池；任何恢复步骤还可以写 `"when": {"value", "atLeast", "atMost"}`（一个界限或两个都指定），从人物卡读取值，只有在值处于界限内时才归还。5e 的 Sorcerous Restoration 是短休步骤 `{"listPools": "counters", "row": "Sorcery Points", "by": {"const": 4}, "when": {"value": {"field": "level_sorcerer"}, "atLeast": 20}}`：“每次完成短休时，恢复 4 点已消耗的术法点”，绝不会超过最大值。使用其中任一功能的规则集需要 Capability API 1.434。

在任何形态中保留，以及免除成分要求（Capability API 1.435）。战斗状态或等级可以写 `"shapeKeeps"`：无论持有者采用何种形态，除了形态自身 `keeps` 指定的行动外，还会保留这些自身行动；写法与之相同，通过条目（`"<catalogId>/<entryId>"`）或行动 ID 指定；形态的 `keeps` 或 `shapeKeeps` 还可以用 `"<catalogId>/*"` 指定整个目录。还可以写 `"waives"`：指定持有者使用时不再需要的成分（来自 `combat.components`），因此禁止某成分的效果（Silence、堵嘴）不会阻止任何无需该成分的使用，躲藏时被免除的成分也不会让任何人暴露。5e 的 Beast Spells 是基于派生值的等级，该值在德鲁伊 18 级时达到 1，带 `"shapeKeeps": ["spells/*"]`（Wild Shape 的状态可以禁止材料成分，因为野兽无法提供）；Archdruid 是德鲁伊 20 级的等级，带 `"waives": ["verbal", "somatic"]`。使用其中任一功能，或在 `keeps` 中指定整个目录的规则集，需要 Capability API 1.435。

在无所作为的回合结束时移除（Capability API 1.436）。战斗状态的 `"endsIdle": true` 会在持有者结束回合时，若其自上次回合结束以来既未对敌人作出攻击，也未受到伤害，就移除该状态；`{"unless": {"value", "atLeast", "atMost"}}` 则在从持有者人物卡读取的值处于界限内时让状态继续生效。5e 的 Rage 写作 `"endsIdle": {"unless": {"value": {"field": "level_barbarian"}, "atLeast": 15}}`：在获得 Persistent Rage 之前，它会“提前结束，条件是……你的回合结束，且你自上个回合以来没有攻击过敌对生物，也没有在此期间受到伤害”。使用此功能的规则集需要 Capability API 1.436。

仅对部分行保留行动或免除成分要求（Capability API 1.437）。状态或等级可以在 `shapeKeeps` 或 `waives` 之外写 `"rowsWhere": {"list", "column", "is": [...]}`：它们便只作用于从该人物卡列表的行生成的行动，且该行的指定列必须包含 `is` 中的某个值，不区分大小写；绝不作用于种族特性、物品或生物自身的行动。5e 的 Beast Spells 和 Archdruid 涵盖“你的德鲁伊法术”：`"rowsWhere": {"list": "spells", "column": "class", "is": ["Druid"]}`，因此德鲁伊 18 / 法师 2 在野兽形态中不会保留任何法师法术。使用此功能的规则集需要 Capability API 1.437。

禁止施法或专注，以及倒下时结束（Capability API 1.438）。战斗状态的 `forbids` 可以写 `"casts": [catalogs]`，使状态生效期间不提供从这些目录施放的任何内容（包括施放其中条目的物品使用）；还可以写 `"concentration": true`，使所有需要专注的内容都不提供，并在状态施加时结束持有者正在维持的全部专注；不再要求同时指定 `components`。`endsWhenHolder`（在状态上，或行动施加状态的位置）可以写 `"downed": true`：持有者一旦倒下或退出战斗，状态就会移除。5e 的 Rage 使用 `"forbids": {"casts": ["spells"], "concentration": true}` 和 `"endsWhenHolder": {"downed": true}`。同样从 1.438 起，若行缺少 `rowsWhere` 读取的列所对应的格子（构建器从目录添加的法术，不带职业），就视为该列包含其 `default`，因此 5e 的职业列默认值为 `"any"`，可匹配 `"is": ["druid", "any"]`。使用这些功能的规则集需要 Capability API 1.438。

通过状态或等级察觉特定种类（Capability API 1.439）。`aware`（特性的 `hiding.aware`，或现在可以直接放在战斗状态或等级上的 `aware`，后者只在该状态或等级生效时有效）可以写 `"of"`，以 `combat.creatureTypes` 的类型、标签或大小作目标测试，使只有 `within` 距离内的这些生物无法向持有者躲藏；还可以写 `"uncovered": true`，仅限于与持有者之间的连线未被全掩护阻挡的生物。已经躲藏的生物会在下一步结束时被发现。5e 的 Divine Sense 是持续到圣武士下一回合结束的状态，带 `"aware": {"within": 60, "of": {"types": ["celestial", "fiend", "undead"]}, "uncovered": true}`；Primeval Awareness 则是每级法术位持续一分钟的状态，带 `"aware": {"within": 5280, "of": {"types": [...]}}`。使用这些功能的规则集需要 Capability API 1.439。

获得状态时结束（Capability API 1.440）。`endsWhenHolder`（在状态上，或行动施加状态的位置）可以写 `"gains": [conditions]`：持有者一旦带有其中任一个状态，它就会移除，无论那个状态如何施加；状态绝不能指定自己。5e 的 Rage 在“你陷入昏迷时”结束，无论是因打击，还是在生命值仍高于 0 时中了 Sleep：`"endsWhenHolder": {"downed": true, "gains": ["unconscious"]}`。使用此功能的规则集需要 Capability API 1.440。

需要掷骰才会生效的使用（Capability API 1.441）。目录条目的机制可以写 `"chance": {"sides", "atMost", "sure", "failUses"}`：支付费用后，掷一颗 `sides` 面骰，只有结果不高于 `atMost`（数字，或从使用者人物卡读取的值）时才生效。满足 `sure`（人物卡数值界限）时，无需掷骰即可生效。失败则什么也不做；带 `failUses` 时，归还支付的费用，改为消耗指定人物卡行的一次使用次数，并且只在该行能够支付时提供条目。5e 的 Divine Intervention：它自己的计数器行不在休息时恢复，同一条目还有一个在长休息时恢复的“Divine Plea”计数器，`"usesOf"` 指定自身的行，使一次使用只消耗这一行，并带 `"chance": {"sides": 100, "atMost": {"field": "level"}, "sure": {"value": {"field": "level"}, "atLeast": 20}, "failUses": "Divine Plea"}`。生物的行动可以写 `"chance": {"sides": 100, "atMost": 30}`：恶魔成功率为 30% 的召唤，无论成功与否都消耗使用次数。日志会说明掷骰结果。使用此功能的规则集需要 Capability API 1.441。

选择结束哪些状态（Capability API 1.442）。目录条目的 `ends` 可以写 `"chosen": true`：菜单会为每个目标列出其带有的 `conditions`，由使用者选择结束哪些，最多 `count` 个，与法术的 `endsSpells.chosen` 相同。未作选择时，与以前一样，结束目标带有的、在列表中最靠前的状态。5e 的 Greater Restoration 结束“以下效果之一”：`"ends": {"conditions": ["charmed", "petrified", "cursed", ...], "count": 1, "chosen": true}`。使用此功能的规则集需要 Capability API 1.442。

概率判定失败只消耗指定的行（Capability API 1.443）。`failUses` 与 `usesOf` 一样，只消耗指定的那一个计数器行，绝不消耗其条目的其他行，因此 Divine Intervention 自身的行和 Divine Plea 行可以放在同一条目上：失败会保留前者，消耗后者。将两者都放在同一条目上的规则集应声明 Capability API 1.443。

只感知是否存在（Capability API 1.444）。战斗状态可以写 `"presence": {"within": N, "of": {"types": [...]}}`，`within` 使用规则集的距离单位：在状态施加时，以及持有者的每个回合开始时，日志会说明该距离内存在哪些指定种类，或一个也没有，不说明它们的位置或数量。它不影响躲藏。5e 的 Primeval Awareness 写作 `"presence": {"within": 5280, "of": {"types": ["aberration", "celestial", "dragon", "elemental", "fey", "fiend", "undead"]}}`，在偏好地形中则为 31680。使用此功能的规则集需要 Capability API 1.444。

经过若干游戏日后恢复充能（Capability API 1.445）。列表的 `pools` 可以写 `"rechargeDays": {"<recharge value>": N}`，对应其 `rechargeColumn` 的值：带有该充能恢复值、且已消耗的行，会累计人物卡的 `pass` 命令所声明经过的天数（`[sheet: who="Name" op="pass" days="N"]`，会告知 GM），达到 N 时重新补满。休息不改变计数。5e 的 Divine Intervention：计数器的充能恢复列有一个 `week` 值，带 `"rechargeDays": {"week": 7}`，其自身行设为 `week`。使用此功能的规则集需要 Capability API 1.445。

计次（Capability API 1.801）。列表的 `pools` 可以指定一个 `tallyColumn`，它是是非列或数字列：设置了该列（为真，或大于 0）的行用于计次，而非消耗。人物卡将其资源池显示为自上次充能恢复以来已使用的次数（“已使用 2 次”），不提供消耗或恢复按钮，GM 的人物卡块也如此；其最大值只限制最多计到多少。消耗它就是计一次使用，因此维持不倒的 `save.tally`(1.404) 仍像以前一样指定它。5e 的 Relentless Rage 和 Overchannel：其计数器行设置该列，长休息重新开始计数。使用此功能的规则集需要 Capability API 1.801。

仪式（Capability API 1.807）。列表可以指定一个 `ritual` 列，它是是非列：勾选该列的行可以在战斗外以仪式使用，GM 在人物卡命令 `use` 上加 `ritual="yes"` 来请求（`[sheet: who="Mira" op="use" name="Detect Magic" ritual="yes"]`，提示词中会告知此用法）。以此方式使用时，不支付任何资源池费用，无论是 `mechanics` 中的费用，还是其自身的计数器行；需要的有价材料仍然必需，也仍会消耗。对未勾选该列的行作仪式使用，会以 `not-ritual` 拒绝。仪式的其他要求，如更长的施法时间，由叙事处理。5e 的仪式法术：法术列表写 `"ritual": "ritual"`，每个仪式法术的行写 `"ritual": true`。使用此功能的规则集需要 Capability API 1.807。

谁能施放仪式（Capability API 1.809）。带 `ritual` 列的列表可以写 `ritualNeeds`，它是目录条目的列表（`<catalog>/<entry>`）：此时，只有人物卡的任意列表中持有来自其中某个条目的行，才能将该行作为仪式使用，否则以 `not-ritual` 拒绝。5e 的 Ritual Casting：法术列表的 `"ritualNeeds"` 指定各职业的 Ritual Casting 特性，因此持有仪式法术的术士也只能消耗法术位施放。使用此功能的规则集需要 Capability API 1.809。

休息的频率限制（Capability API 1.810）。休息可以写 `every`，单位是游戏计时中的小时：自上一次该休息开始后，必须经过这么多小时，否则以 `rested-already` 拒绝，例如 5e 的长休息在 24 小时内只能进行一次（`"every": 24`）。没有 `every`，或游戏不计时时，只有在同一条或上一条回复中已经进行过该类休息，或此后时间没有流逝时，才会拒绝。使用此功能的规则集需要 Capability API 1.810。

使用时拿取的物品（Capability API 1.808）。物品块可以写 `"drawOnUse": { "categories": [...], "tags": [...] }`（两者之一或两者都写，使用它声明的 ID）。属于其中一种类别，或带有其中一个标签的物品，若占用槽位，仍然只在装备时占用，也只在槽位空闲时才能装备：有两只手时，手持两把武器就没有位置再装备第三把，双手弓也无法与其他物品同时拿在手中。但使用它之前无需先装备。Use(使用) 按钮、GM 的 `[inventory: action="use"]`、Engine 自身战斗的物品菜单，以及规则集战斗的攻击，都能使用仅携带而未装备的物品，并在使用时通过免费切换将其装备：所需槽位已满时，先收起占据这些槽位、同样属于使用时拿取的其他物品，收起的数量尽可能少。绝不会为此卸下任何其他物品，无论是护甲、盾牌还是绑定的诅咒物品：若只有卸下这些物品才能腾出位置，则使用会以 `slots-full` 拒绝（Use 按钮会指出被什么挡住），战斗中也不会提供该物品。未使用此功能的规则集保持原样：占用槽位的物品只有在穿戴时才能使用。5e 的武器在挥砍或射击之前都收在鞘中或挂在身上：写 `"drawOnUse": { "categories": ["weapon"] }`，配合数量为 2 的 `hands` 槽位，单手武器写 `"slots": { "hands": 1 }`，双手武器写 `"slots": { "hands": 2 }`。使用此功能的规则集需要 Capability API 1.808。

在规则集战斗中，界面的“手持物”行会显示当前回合战斗者在武器所占槽位中持有什么，并允许其在自己的回合按同一规则，将携带的武器或盾牌拿到手中，无论规则集是否设置了 `drawOnUse`：只收起挡住位置的武器，数量尽可能少，绝不收起其他东西（盾牌或护甲挡住时会拒绝，并指出是哪件），然后根据手持物重新读取其攻击。这会消耗该回合唯一一次免费的物品互动，也就是免费捡起掉落物品所用的那次互动（1.266），因此同一回合中的第二次会被拒绝。每件使用包内弹药射击的武器旁，这一行还可选择优先使用哪个物品叠。两种变更都会像战斗中的其他物品变更一样写回物品栏，都不需要规则集额外提供任何内容。

单独使用恢复命令能归还什么。GM 对只能通过休息恢复的资源池使用 `[sheet: op="restore"]` 时（指规则集的某个 `rests` 会恢复的非生命值资源池；但若休息仅通过固定的 `by: {"const": N}` 恢复它，则不在此列，因为这也视为叙事可发放的点数），只有在同一条回复中，该角色进行能恢复此资源池的休息时才生效。否则，若人物卡恰好持有一个条目，其 `recovers`(1.410) 指定该资源池的组，且该条目的 `atRest`(1.789)（若有）是角色在同一条回复中进行的休息，则将恢复视为对该条目的使用，`recover` 设为该资源池和数量，像任何使用一样支付其计数器行（已耗尽时拒绝）；不满足则以 `rest-only` 拒绝。物品使用、休息和条目自身的使用仍像以前一样归还资源池。

通过选项召唤生物，按轮数持续或随召唤者结束（Capability API 1.446）。生物行动的 `calls` 可以用最多 8 个 `options` 代替单个 `creature` 和 `count`，每项写作 `{"creature": "<catalogId>/<entryId>", "count": ..., "label": ...}`，或像目录条目的召唤一样从目录 `from` 读取；使用者在使用时选择一项，所有选项共用该行动的 `uses`。`"rounds": N` 会在 N 轮后将它们送走，从召唤者的下个回合开始计数；`"endsWithCaller": true` 会在召唤者退出战斗时立即将它们送走；`"cantCall": true` 则使被召唤者不带任何自己的召唤行动。5e 的 Summon Demon：vrock 的 `{"options": [{"creature": "creatures/dretch", "count": {"dice": "2d4"}, "label": "2d4 dretches"}, {"creature": "creatures/vrock", "count": {"flat": 1}, "label": "Another vrock"}], "rounds": 10, "endsWithCaller": true, "cantCall": true}`，配合 `"uses": {"per": "day", "count": 1}` 和成功率为 30% 的 `chance`。使用此功能的规则集需要 Capability API 1.446。

支付更高费用以延长持续时间（Capability API 1.447）。条目 `applies` 的内容上，以轮数计的 `duration` 可以增加 `"perStep": N`：支付的费用每提高一个步骤，便多持续 N 轮，步骤计数方式与 Conjure Animals 的 `timesPerSteps` 相同（天生施法按其等级超出基础等级的部分计数）。5e 的 Primeval Awareness，“消耗的法术位每级持续 1 分钟”：以 1 级法术位为费用，写 `{"rounds": 10, "perStep": 10}`。使用此功能的规则集需要 Capability API 1.447。

从多个状态中选择一个施加（Capability API 1.448）。条目的机制可以写 `"appliesOneOf": true`，同时带两个或更多 `applies`：使用者在使用时选择一个，方式与武器模式相同，以状态名称作为标签；未选择时施加第一个。它不能与 `cureOneOf`、`kindChoice`、`forms`、`calls` 和 `conjures` 同用，因为这些也以同样方式选择。5e 的 Primeval Awareness：一个状态带 `"presence": {"within": 5280, ...}`，另一个状态名为“Primeval Awareness（偏好地形）”，距离为六英里，游侠处于偏好地形时选择后者。使用此功能的规则集需要 Capability API 1.448。

遣散被召唤者（Capability API 1.449）。生物行动的 `calls` 可以写 `"dismissible": true`：召唤者随后获得一个行动，与召唤行动使用相同的额度，只在其召唤的生物中仍有生物在场时提供，用于将它们全部送走。带 `cantCall` 时，被召唤者既不会获得该行动，也不会获得任何召唤行动。5e 的 Summon Demon，“直到召唤者死亡，或用一个行动将其遣散”。使用此功能的规则集需要 Capability API 1.449。

按剩余生命值判定（Capability API 1.450）。条目的 `applies` 可以写 `"targetHealthAtMost": N`：只对效果生效时生命值不超过 N 的目标施加。其机制可以在带 `save` 时写 `"killsAtMost": N`：豁免失败且生命值不超过 N 的目标会直接死亡，取代该条目对其产生的其他所有效果。在 `dismisses` 旁写 `"dismissesIs"`，则只送走符合该条件的目标。5e 的 Divine Word：50 时耳聋，40 时目盲，30 时震慑，`"killsAtMost": 20`，以及 `"dismisses": true, "dismissesIs": {"types": ["celestial", "elemental", "fey", "fiend"]}`。使用此功能的规则集需要 Capability API 1.450。

符文（Capability API 1.451）。区域的 `detonates` 可以写 `"entered": true`：施法者以外的任何人一走进其中任一格子，区域就会引爆，移动者自身不进行豁免；只会以这种方式引爆，绝不会因持续时间耗尽而引爆；`"by"`(目标测试) 则限定哪些人能触发它。`"within": N` 使引爆时的效果触及以区域中心为圆心、N 距离内的所有人，而不只是在区域格子内的人，距离按规则集的单位计。5e 的 Glyph of Warding（爆炸符文）是在小型爆发范围上设置 `{"entered": true, "within": 20}`，`rounds` 为 1000；Symbol 则每种符文各用一个条目，设置 `"within": 60`。使用此功能的规则集需要 Capability API 1.451。

阻止特定生物进入（Capability API 1.452）。区域可以写 `"keepsOut": {"is": <target test>}`：符合条件的生物无法走进区域（带 `"way": "out"` 时，则是进入后无法走出）；带 `"attacksInto": "disadvantage"` 时，它们从区域外攻击站在区域内的任何人都具有劣势；`"cantGive"` 则列出它们无法对站在区域内的人施加的状态。5e 的 Magic Circle：针对所选种类的 10 英尺柱形范围，`{"is": {"types": ["fiend"]}, "attacksInto": "disadvantage", "cantGive": ["charmed", "frightened"]}`，每个种类各用一个条目，或用 `way: "out"` 将其困住；Hallow 的防护同理，范围为 60 英尺。使用此功能的规则集需要 Capability API 1.452。

触发后持续存在（Capability API 1.453）。会 `detonates` 的区域可以指定引爆后 `becomes` 的形态：`"becomes": {"size": <radius>, "rounds": <n>, "triggers": [...], "lights"?: {"bright": .., "dim": ..}}`。随后，它以自身中心为圆心、以该大小作为半径的爆发范围持续存在，大小按规则集自身单位计，持续自身指定的轮数，在这些触发条件下再次产生条目自身的效果，并发出指定光照；它绝不会再次引爆，轮数耗尽时只会结束。5e 的 Symbol：触发后，符文会让 60 英尺球形范围充满微光，持续十分钟，打击所有进入范围或在其中结束回合的人，`{"size": 60, "rounds": 100, "triggers": ["enter", "turn-end"], "lights": {"bright": 0, "dim": 60}}`。使用此功能的规则集需要 Capability API 1.453。

法术符文（Capability API 1.454）。因有人 `entered` 而引爆的区域可以写 `"stores": true`：施放时，施法者从自己的条目中选择一个作为模式，该条目从人物卡读取费用并支付，等级至少为一环，且不高于符文支付时的等级；施法者支付两者的费用。触发时，储存的条目会对触发者施放；如果条目带范围，则以触发者为中心，对范围内的所有人施放，取代符文自身的效果；此时不再支付费用，原本需要施法者维持专注的效果会持续完整的持续时间。未选择模式时，符文产生自身的效果。5e 的 Glyph of Warding，可选法术符文或爆炸符文。使用此功能的规则集需要 Capability API 1.454。

隐藏区域（Capability API 1.455）。区域可以写 `"hidden": {"check": <check id>}`：施法者的敌人在其中一人发现它之前都看不到它。此时，`search` 标准行动（因此需要 `combat.hiding`，并在 `combat.standard` 中列出 `"search"`）还会掷一次该检定；对于搜索者敌人的每个隐藏区域，只要检定总值达到其条目的豁免难度，就会为搜索者整方揭示它。5e 的 Glyph of Warding 和 Symbol：`{"check": "investigation"}`。使用此功能的规则集需要 Capability API 1.455。

施法者离场后仍然存在（Capability API 1.456）。区域可以写 `"outlasts": true`：施法者被击败或离开战斗时，区域继续存在，不会随施法者结束，在每轮结束时递减剩余轮数，并照常引爆或打击。它绝不会由专注维持，也不会以施法者为中心随其移动。5e 的 Glyph of Warding 和 Symbol，会持续到触发或被解除。使用此功能的规则集需要 Capability API 1.456。

无法伤害任何人，以及远离某个点（Capability API 1.457）。状态效果 `"cannot-harm"` 阻止持有者攻击任何人，或对任何人使用会伤害对方的东西：不能攻击，不能使用有害条目，不能瞄准敌人，不能擒抱或推撞，不能使用造成伤害的范围，也不能在有人离开其触及范围时打击。状态的行为可以写 `"from": "point"`：此时，其 `moves` 和 `keepsOut` 从施加状态的点（区域中心，或范围瞄准的位置）测量，而不是从施加者测量。5e 的 Symbol：绝望是带 `"cannot-harm"` 的状态；恐惧则是在恐惧状态上设置 `{"moves": "away", "from": "point"}`，使持有者逃离符文。使用其中任一功能的规则集需要 Capability API 1.457。

将特定生物困在里面（Capability API 1.458）。带 `"way": "out"` 的 `keepsOut` 会反向防护：此时其 `attacksInto` 和 `cantGive` 保护站在区域外的人，使其免受被困在区域内的生物影响，而不是保护里面的人免受外面的生物影响。5e 的反向 Magic Circle，“阻止指定类型的生物离开柱形范围，并保护范围外的目标”：`{"is": {"types": ["fiend"]}, "way": "out", "attacksInto": "disadvantage", "cantGive": ["charmed", "frightened"]}`。使用此功能的规则集需要 Capability API 1.458。

为进入者解除状态（Capability API 1.459）。`keepsOut` 可以用 `frees` 列出状态：任何人踏入区域时，都会失去这些状态中由该区域阻挡的生物所施加的状态。5e 的 Hallow：`{"is": {"types": ["celestial", "elemental", "fey", "fiend", "undead"]}, "cantGive": ["charmed", "frightened", "possessed"], "frees": ["charmed", "frightened", "possessed"]}`。使用此功能的规则集需要 Capability API 1.459。

区域内部效果的适用对象（Capability API 1.460）。区域的 `inside` 可以指定其状态和免疫对谁生效，写作 `"is": <target test>`，并带上 `"save": {"save": <save id>, "ignoresUntilLeaves": true}`：适用对象在进入区域时，以及在其中开始各自每个回合时，都要对抗条目自身的豁免难度进行该豁免；一旦成功，就会忽略其内部效果，直到离开区域。5e 的 Hallow，其针对所选种类的额外效果使用魅力豁免：勇气、能量防护或易伤、恐惧（`{"conditions": ["frightened"], "is": {...}, "save": {"save": "cha_save", "ignoresUntilLeaves": true}}`）。使用此功能的规则集需要 Capability API 1.460。

跨轮施法（Capability API 1.461）。条目的机制可以写 `"castingRounds": <2 to 10>`：使用时支付费用并开始施法，使用者专注于施法（结束此前维持专注的其他效果）。接下来每个自己的回合开始时，使用者都要再次为其花费相同的额度；最后一次花费完成时，条目按原先瞄准的方式生效。如果专注被打断，或使用者无法行动，或没有剩余额度可花费，施法就会失败，已支付的费用会归还。5e 中施法时间为一分钟的法术，例如 Symbol：`"castingRounds": 10`。使用此功能的规则集需要 Capability API 1.461。

战前布置（Capability API 1.462）。任何带 `zone` 的条目都可以在战斗开始时已布置好：游戏主持人（GM）说明谁在战前布置了什么（在该队员或敌人上设置 `"standing": [{"entry": <name>, "at": "between" | "self", "stores": <name>}]`），Engine 从其人物卡读取并支付费用，随后像刚施放一样将其放在施法者与最近敌人之间，或放在施法者所在位置，需要专注时由施法者维持。隐藏区域会悄然放置，不作说明。机制写有 `"beforeFight": true` 的条目，施放所需时间比整场战斗更长，因此绝不会出现在战斗菜单中，只能用这种方式预先布置。5e 的 Glyph of Warding（一小时）和 Hallow（一天）设置 `"beforeFight": true`；Symbol 的施法时间为一分钟，两种方式都可以。使用 `beforeFight` 的规则集需要 Capability API 1.462。

浪费回合（Capability API 1.463）。状态的行为可以写 `"wastes": {"save": <save id>, "budget": <budget id>}`：持有者每个回合开始时，都要对抗施加状态时确定的难度进行该豁免，失败则本回合的该额度被浪费。5e 的 Bestow Curse，其浪费回合选项：`{"save": "wis_save", "budget": "action"}`。使用此功能的规则集需要 Capability API 1.463。

行走与引导方向（Capability API 1.464）。带 `moves` 的状态行为可以写 `"walks": true`：持有者每个回合开始时，都会被迫沿该方向尽可能走远，而不只是被禁止朝相反方向行走。其 `from` 可以为 `"steered"`：从施加者最后一次指定的引导点测量，尚未指定时则没有测量起点。机制写有 `"steers": <condition id>` 的条目（带 `area`，供瞄准），会引导所有由该条目使用者施加了该状态的持有者朝瞄准点移动，不产生其他效果；只有还有人持有该使用者施加的该状态时，才会提供此条目。5e 的 Compulsion：法术施加带 `{"moves": "toward", "from": "steered", "walks": true}` 的状态，再用附赠动作条目通过 `"steers"` 引导它。使用其中任一功能的规则集需要 Capability API 1.464。

无区域的战前布置（Capability API 1.465）。`"beforeFight": true` 可以放在任何条目上，不限于带区域的条目：该条目绝不会出现在战斗菜单中。这种条目或任何其他条目都可以在 GM 的 `standing` 列表中带上 `"on": [names]`；战斗开始时，就会对指定对象中允许该条目作用的对象执行其效果（未指定任何对象，且条目用于使用者自身或盟友时，则作用于使用者），费用从使用者人物卡读取并支付。5e 中预先施放的 Heroes' Feast、Foresight 和 Antipathy/Sympathy。物品的使用也可以写 `"beforeFight": true`（Oil of Slipperiness，涂抹需要 10 分钟），`standing` 列表既可以按菜单中的名称指定它（`"Oil of Slipperiness: Apply the Oil"`），也可以只用其使用效果本身的标签（`"Apply the Oil"`）；预先布置会像正常使用一样消耗物品。在无区域条目上使用 `beforeFight` 的规则集需要 Capability API 1.465。

保留在人物卡上（Capability API 1.798）。在战斗外用人物卡命令 `use` 使用会 `calls` 生物的 `beforeFight` 条目（`as="Owl"`；若 `asTypes` 允许选择生物类型，则在逗号后加上类型：`as="Owl, Fey"`），会将召唤出的生物保留在使用者人物卡上。人物卡会在“With them”(随行者) 下显示它，GM 会在那里读到它；它会加入使用者参与的每场战斗，无需再次支付费用，直到它在战斗中被杀死或遣散，或在战斗外被遣散（用人物卡命令 `dismiss`，或人物卡自身的遣散按钮）。再次使用该条目会替换它。5e 的 Find Familiar。它无需额外数据：从 1.798 起，Engine 会对所有此类条目执行此行为。

形态也以同样方式保留。在战斗外用 `use` 使用带 `forms` 且瞄准 `self` 的条目，并指定要变成的形态（`as="Wolf"`），会让使用者保持该形态。形态会按条目提供的可选形态校验，采用战斗中读取的同一上限和 `without`。人物卡会在“In the shape of”(当前形态) 下显示它，GM 会在那里读到它。下一场战斗开始时，使用者仍处于该形态，无需再次支付费用。战斗结束时仍维持的形态会保留，连同该形态的生命值和维持它的状态，该生命值也会带入下一场战斗；在战斗中被击破或结束的形态则会消失。在战斗外，用人物卡命令 `dismiss` 加上条目或形态名称即可结束它。5e 的 Wild Shape。它同样无需额外数据。

区域内选定的种类（Capability API 1.466）。区域的 `inside` 可以用 `"chooses": "type"` 代替 `is`：施放时，施法者从 `combat.creatureTypes` 中选择一项作为模式，其内部效果只对该类型的生物生效；未选择时则对所有人生效。在 GM 的 `standing` 列表中，用 `"kind": <type>` 指定所选类型。5e 的 Hallow，其对“特定种类的生物”的额外效果。使用此功能的规则集需要 Capability API 1.466。

禁止传送的地面（Capability API 1.467）。区域的 `forbids` 可以写 `"teleport": true`（无论是否带 `components`）：其内部效果的适用对象（由 `inside.is` 或所选种类决定，且不包括通过内部效果豁免的对象）都无法传送进入、传送离开或在其中传送，也无法从区域内部通过传送离开战斗。5e 的 Hallow，异次元干扰效果：Misty Step、Dimension Door、Thunder Step。使用此功能的规则集需要 Capability API 1.467。

每个目标各自的射线（Capability API 1.468）。条目的 `"rays": {"dice": "1d8", "rows": [...]}` 会为每个触及的生物各掷一次骰子，掷骰结果对应的行（第一条 `atMost` 不小于该结果的行）决定击中该生物的射线。每行会以自身的 `damageType` 造成条目 `amount` 所指定的伤害，没有类型则不造成伤害；只施加条目 `applies` 中由该行自身 `applies` 指定的状态；`"again": 2` 会再射出两条射线，若掷骰再次落在该行，则重掷。每个目标只进行一次条目的 `save`，击中该目标的每条射线都读取这次豁免结果：成功则伤害减半，且不施加任何状态。每条射线都会记入日志。它与 `save` 搭配使用，不能带 `attackRoll`。5e 的 Prismatic Spray：从 `{"atMost": 1, "label": "Red", "damageType": "fire"}` 到 `{"atMost": 5, "label": "Blue", "damageType": "cold"}`，以及 `{"atMost": 6, "label": "Indigo", "applies": ["restrained"]}`、`{"atMost": 7, "label": "Violet", "applies": ["blinded"]}`、`{"atMost": 8, "label": "Special", "again": 2}`。使用此功能的规则集需要 Capability API 1.468。

更多可选状态（Capability API 1.469）。带 `"appliesOneOf": true` 的条目最多可以带 12 个 `applies`，使用时从中选一个；不带时，上限仍为 6 个。5e 的 Bestow Curse，将九种诅咒放在同一个条目中。使用此功能的规则集需要 Capability API 1.469。

按支付费用确定持续时间与专注要求（Capability API 1.470）。`applies` 持续时间中的 `"bySteps": [100, 4800]` 表示：条目支付的费用高一个步骤、两个步骤，以此类推时，改为持续对应的轮数；超过列表的步骤一律采用最后一项（不能与 `perStep` 搭配）。条目的 `"concentrationBelowStep": 2` 表示，只有支付的费用提高步骤数小于该数值时，才保留其 `concentration` 要求；从该步骤起及更高步骤，无人需要为其专注，施加的效果会持续完整的持续时间。5e 的 Bestow Curse：`{"rounds": 10, "bySteps": [100, 4800, 4800, 14400, 14400, 14400]}` 配合 `"concentrationBelowStep": 2`，使用 4 环法术位时持续十分钟，使用 5 环法术位时持续八小时且无需维持专注。使用此功能的规则集需要 Capability API 1.470。

无需攻击掷骰的伤害变更（Capability API 1.471）。`damage` 或 `damage-taken` 变更默认只在攻击命中时生效；带 `"alsoUnrolled": true` 时，也会对不需要攻击掷骰的伤害生效，包括通过豁免结算或直接生效的伤害；如果豁免会让条目自身的伤害减半，该变更增加的伤害仍保留全额。5e 的 Bestow Curse，“你的攻击和法术对目标额外造成 1d8 黯蚀伤害”：`{"to": "damage-taken", "dice": "1d8", "damageType": "necrotic", "fromSource": true, "alsoUnrolled": true}`。使用此功能的规则集需要 Capability API 1.471。

按打击的伤害类型变更伤害，且只消耗一次（Capability API 1.792）。带 `"onTypes"` 的 `damage` 或 `damage-taken` 变更（最多 8 种伤害类型，读取时不区分大小写），只对造成其中一种类型伤害的打击生效，无论该类型是打击自身的伤害类型，还是任一伤害段的类型；`damageType` 仍指定该变更自身增加的伤害类型。带 `"spentOnUse": true` 时，来源状态会在首次增加伤害时被消耗；由物品、等级或人物卡本身提供的变更绝不会被消耗。战斗 AI 只有在对方会造成其中一种类型的伤害时才将该变更计入评估，会被消耗的变更按一半计算。5e 的油，“如果目标在油干之前受到任何火焰伤害，燃烧的油会使目标额外受到 5 点火焰伤害”：`{"to": "damage-taken", "flat": 5, "damageType": "fire", "onTypes": ["fire"], "spentOnUse": true, "alsoUnrolled": true}`。使用其中任一功能的规则集需要 Capability API 1.792。

被迫行走前先行动（Capability API 1.472）。状态行为中的 `"walks": "after"` 会在持有者结束回合时，让其用剩余移动量按 `moves` 行走，取代回合开始时行走，因此持有者可以先行动；如果行走因某人的触及范围而暂停结算，就会等待相应反应，再次结束该回合。5e 的 Compulsion，“它可以先采取行动再移动”：`{"moves": "toward", "from": "steered", "walks": "after"}`。使用此功能的规则集需要 Capability API 1.472。

提高生命值最大值（Capability API 1.473）。`applies` 条目的 `"raisesMax": {"dice": "2d10", "flat": 5, "perStep": 5}`（骰子、固定值或两者兼用）会在状态持续生效期间提高持有者的生命值最大值，并在施加时使当前生命值增加相同的量：骰子只掷一次，施加时支付的费用每提高一个步骤，`perStep` 就额外增加该数值。再次施加时，新的提升会替换旧的；状态结束后，最大值回落，超出最大值的当前生命值也随之回落。人物卡会将这项提升与状态一起保留在实时状态中，因此只要状态持续，它就能延续到战斗之后。伤势轨道没有可提高的最大值。5e 的 Aid，在其 2 环费用上设置 `{"flat": 5, "perStep": 5}`；Heroes' Feast 则设置 `{"dice": "2d10"}`。使用此功能的规则集需要 Capability API 1.473。

施放其他条目（Capability API 1.474）。条目的 `"duplicates": {"catalog": "spells", "upTo": 8}` 会将该目录中等级不高于 `upTo`（且不低于 1）的每个其他条目放到持有者的战斗菜单中，每个条目各为一个选项，名称同时包含两者（“Wish: Fireball”），采用复制条目的数值和额度，完全按复制条目的方式支付费用，且无需被复制条目自身的任何成分。复制条目本身不会出现在任何菜单中。`"only": [ids]` 则将范围限定为指定条目。5e 的 Wish，“复制任何其他不高于 8 环的法术”。使用此功能的规则集需要 Capability API 1.474。

一分为二（Capability API 1.475）。生物的 `"splits": {"by": ["lightning", "slashing"], "atLeast": 10, "smallest": "medium"}` 会在受到所列伤害类型之一的打击后，若仍站着且剩余生命值至少为 `atLeast`，就分裂：另一个相同的生物出现在最近的空闲格子中，其回合紧接在原生物之后，两者各有原生物分裂前生命值的一半，向下取整。在带 `combat.sizes` 的战斗中，两者的大小各减小一级，已经小于 `smallest` 的生物不会分裂。新生物最初不带原生物的任何状态。5e 的 Black Pudding 和 Ochre Jelly。使用此功能的规则集需要 Capability API 1.475。

按施加来源阻止状态（Capability API 1.476）。`conditionImmunitiesFrom` 条目可以用 `"catalogs": ["spells"]` 代替 `from`，也可以与其并列：只有这些目录之一的条目要施加所列状态时，才会阻止施加，已经存在的状态会保留。5e 的 Freedom of Movement，`{"conditions": ["paralyzed", "restrained"], "catalogs": ["spells"]}`：阻止魔法造成的麻痹或束缚。使用此功能的规则集需要 Capability API 1.476。

缓和坠落或压制状态的物品
（Capability API 1.477）。
物品的 `worn` 或 `carried`
效果
可以像状态一样写 `"fallsSafely": true`：
持有者
不受坠落伤害，
也不会因坠落
而倒地（5e 的 Ring of Feather Falling）。`"suppresses": ["sewer_plague"]`
则压制持有者
身上的这些状态，
而非结束它们：
它们的作用停止，
计时继续，
物品卸下后
又会重新生效。5e 的 Periapt of Health
会在这里和 `conditionImmunities`
中都列出
其防护的疾病，
因此已经感染的疾病
会被压制，
也不会感染
新的疾病。
使用此功能
的规则集需要 Capability API 1.477。

在某些地形上压制状态（Capability API 1.478）。状态的 `"whileOffTerrain": ["water"]` 会在持有者站在所列地形之一的图块上，或棋盘环境属于其中之一时，压制该状态，而非结束它：作用停止，计时继续，一旦离开该地形就会重新生效。无棋盘的战斗中，该状态持续生效。5e 底栖魔鱼的诅咒会在水下以外的地方阻止治疗，可用带 `"effects": ["cannot-heal"]` 和 `"whileOffTerrain": ["water"]` 的状态表示。使用此功能的规则集需要 Capability API 1.478。

对物体或范围施放（Capability API 1.479）。`calls` 可以写 `"initiative": "none"`：召唤之物没有回合，也不会维持任何一方仍在场的判定，因此战斗会像它不存在一样结束。带 `calls` 和 `applies` 的条目还可以写 `"appliesToCalled": true`：施加的效果会作用于召唤之物，并记住使用时指定的种类（`kindChoice`），取代作用于瞄准或波及的对象。5e 对物体或范围施放的 Antipathy/Sympathy 会召唤一个代表该物体的生物（`"initiative": "none"`），并对其施加状态，于是状态带 `chosenKind` 的光环会从该物体向指定种类扩散。使用此功能的规则集需要 Capability API 1.479。

放到手中的武器掉落（Capability API 1.480）。条目 `conjures` 创造的武器（不包括其绑定的武器），现在会在状态的 `drops` 指定了武器占用的槽位或带有的标签时，像手持物品一样掉落（5e 的 Fear），也以同样方式拾起；创造者仍可以将其解消。在 `conjures` 上设置 `"vanishes": {"beyond": 5, "rounds": 10}` 后，如果武器落在距离创造者超过 `beyond` 的地方（按规则集的距离单位计），并在创造者每个回合开始时仍在该距离之外，连续达到 `rounds` 个这样的回合后就会消失：5e 的契约武器，“离你超过 5 英尺，持续 1 分钟或更久”。再次使用、解消或创造者死亡，仍会像之前一样使它结束。使用 `vanishes` 的规则集需要 Capability API 1.480。

借助他人的双眼看见
（Capability API 1.481）。
战斗状态的 `"lendsSenses": true`
让施加者
在状态持续
生效期间，
既能看见
自己所见，
也能看见
持有者所见，
适用于所有
读取
谁能看见谁
的判定：
必须
可见的目标、
对不可见者
的攻击、
需要视线
的光环。
如果某人
对施加者隐藏，
但对持有者
并未隐藏，
施加者就能
借此看见那人。5e
中借助
魔宠视角
看见的效果，
可在召唤
魔宠时
对其施加
带此字段的状态（`appliesToCalled`，1.479），
也可以通过
邪术师的行动
施加（Voice of the Chain Master）；Gaze of Two Minds
则将其
施加给
触碰的
自愿类人生物。
施法者
观看时
自身感官
失去的能力，
由条目的 `appliesSelf`
表示
（目盲和耳聋）。
使用此功能
的规则集
需要 Capability API 1.481。

更长的持续时间（Capability API 1.482）。持续时间的 `rounds` 现在最多可以为 14400，即一天：5e 的 Aid 持续 8 小时，写作 `{"rounds": 4800}`；Heroes' Feast 持续 24 小时，写作 `{"rounds": 14400}`。持续时间 `bySteps` 中的任一项也可以是 `"until-dispelled"`：支付的费用提高到该步骤或更高时，施加的效果不再计时，直到有东西将其移除才结束。5e 的 Bestow Curse 在其 3 环费用上设置 `{"rounds": 10, "bySteps": [100, 4800, 4800, 14400, 14400, "until-dispelled"]}`。`rounds` 超过 1000 或使用 `"until-dispelled"` 步骤的规则集需要 Capability API 1.482。

在施法者回合进行豁免，以及失败后被送走（Capability API 1.483）。`saveEnds` 可以写 `"at": "source-turn-start"`：在施加者的回合开始时进行豁免，而不是在持有者自己的回合进行。其 `failures` 可以用 `"dismisses": true` 代替 `becomes`：失败达到指定次数后，持有者会活着永久离开本场战斗，如同被 `dismisses` 条目送走（1.236），其维持的所有效果也随之结束。5e 的 Prismatic Spray 的紫色射线会造成目盲，`"saveEnds": {"save": "wis_save", "at": "source-turn-start", "failures": {"count": 1, "dismisses": true}}`：施法者下个回合开始时，豁免成功则结束目盲，失败则将生物送往另一个位面。射线行可以像携带任何 `applies` 一样携带它。使用其中任一功能的规则集需要 Capability API 1.483。

压制某一种类的状态（Capability API 1.484）。物品效果的 `suppresses` 除了可以指定状态，还可以指定状态种类（即状态在其 `kinds` 中列出的种类）：穿戴期间，该种类的所有状态都会被压制。5e 的 Periapt of Health 设置 `{"conditionImmunities": ["disease"], "suppresses": ["disease"]}`，压制所有疾病，也不会感染任何疾病。物品在此处指定种类的规则集需要 Capability API 1.484。

直到被解除（Capability API 1.485）。状态的 `duration` 可以为 `"until-dispelled"`：完全不计时，直到有东西将其移除（治疗、解除，或它指定的某种结束规则）才结束，战斗中与战斗后都一样。它的作用与 `"instant"` 相同，但名称更直观：5e 的 Continual Flame。使用此功能的规则集需要 Capability API 1.485。

行动自如
（Capability API 1.486）。
状态的 `speedKeptFrom: { "catalogs": [...] }`
会阻止
所列目录的条目
施加到持有者
身上的效果
降低其速度：
法术施加的
减速、减半或停止（“speed-zero”）
不会影响
其行走，
但来自网或擒抱
的相同效果
仍然有效。
其 `slipsFree: { "conditions": [...], "cost": 5, "unlessCatalogs": [...] }`
让持有者
可以在自己的回合中，
免检定挣脱
列出的每个状态，
花费按规则集
自身距离单位计的 `cost`
行走距离
（向上取整
到完整格子；
不计量行走的战斗中
不起作用）；
由 `unlessCatalogs`
中目录的条目
施加的状态
则仍会维持。
状态结束时，
原先被该状态
扣去的行走距离
会恢复，
因此被擒抱至
无法移动的生物
可以挣脱后
继续行走。
由 Engine
操控的生物
会在其回合
开始时挣脱。
物品的 `worn`、`carried` 或 `otherwise`
效果可以同时携带 `conditionImmunitiesFrom`、`speedKeptFrom` 和 `slipsFree`
这三项：
例如 Ring of Freedom of Movement。5e 的 Freedom of Movement
设置 `"conditionImmunitiesFrom": [{ "conditions": ["paralyzed", "restrained"], "catalogs": ["spells"] }]`、`"speedKeptFrom": { "catalogs": ["spells"] }` 和 `"slipsFree": { "conditions": ["grappled", "restrained"], "cost": 5, "unlessCatalogs": ["spells"] }`。
使用其中任一功能
的规则集需要 Capability API 1.486。

魔宠（Capability API 1.487）。
条目的 `targetTypes` 可以写 `"calledBySelf": true`：
只允许以使用者召唤进战斗的生物为目标，
对应 5e 的 Voice of the Chain Master 及借助魔宠双眼看见所用的“你的魔宠”。
召唤的 `asTypes` 列出 `combat.creatureTypes.types` 中的 ID，召唤出的生物会采用所选类型，替代自身原有类型；
使用时像模式一样选择，每个可召唤的生物各选一种：Find Familiar 的 `["celestial", "fey", "fiend"]`。
只有召唤功能的条目现在也会像所有其他条目一样，将 `appliesSelf` 施加到使用者身上：Find Familiar 的联结。
战前布置时，有多种执行方式的条目在 `mode` 中指定方式（用 ID 或名称：例如 Find Familiar 召唤的猫头鹰），使用时需要指定生物类型的条目则在 `kind` 中指定（对物体施放的 Antipathy/Sympathy）；
需要指定方式却未指定的条目会被略过，并作出说明。
使用 `calledBySelf` 或 `asTypes` 的规则集需要 Capability API 1.487。

将攻击交给召唤出的生物（Capability API 1.488）。状态的 `lendsStrikes: { "budget": "reaction" }` 让持有者可以放弃自己攻击行动中的一次攻击，改由自己召唤的一个生物发动一次自身的攻击，费用从该生物自身行动经济的指定额度中支付，即使它身上的状态原本禁止它伤害任何人，也可如此攻击。只要攻击行动还有一次打击待用，或该行动尚可采取，就会为每个此类生物中有目标可触及的每种攻击提供此选项；若是在尚未采取攻击行动时选择它，就会消耗该行动，并让该行动剩余的打击可供使用。5e 的 Pact of the Chain：魔宠联结的 `appliesSelf` 通过 `when` 读取契约，魔宠自身的“不能攻击”则作为 `cannot-harm` 状态。由 Engine 操控的生物会保留自己的攻击。使用此功能的规则集需要 Capability API 1.488。

自由行动与命中后的自动响应（Capability API 1.489）。物品的 `worn`、`carried` 或 `otherwise` 效果可以像状态一样携带 `ignoresHardGround: true`：持有者在困难地形上行走的费用与普通地面相同，例如 5e 的 Ring of Free Action。状态的 `whenHit: { "blow": "melee", "from": { "types": ["fiend", "undead"] }, "save": { "save": "con_save" }, "applies": [...] }` 会自动响应每次命中持有者的攻击，无需任何人选择，也不花费任何东西：只响应 `blow` 指定的打击（近战或远程），且来源生物必须符合 `from`；攻击者要按其 `difficulty` 进行 `save`，未设置难度时则采用施加该状态的条目的豁免难度，失败就受到 `applies`，由维持原状态的同一份专注维持。5e 的 Holy Aura，会造成持续到法术结束的目盲。使用其中任一功能的规则集需要 Capability API 1.489。

分层墙（Capability API 1.490）。区域的 `layers` 会构成需要逐层穿过的墙或球体（带 `area` 和 `save` 的条目）：移动进入而被波及的人（由其 `triggers` 决定），会依次遭遇每个仍存在的层，每层都按其行的说明产生条目自身的效果，如同 `rays` 的射线：以该行的 `damageType` 造成条目指定量的伤害（未指定类型则没有伤害），施加条目 `applies` 中该行指定的状态，并为每层分别进行条目的豁免，或该行自身的 `save`。`spares` 指定的对象（`caster` 或 `allies`）可以安全穿过并站在附近。只有前面的所有层都已消失，一层才会按其 `endedBy` 被摧毁：在墙的某个格子上，用一次打击（可以像瞄准墙的一段那样瞄准这些格子）或一个触及它的范围，造成至少为 `atLeast`、类型属于 `types` 的 `damage`；像带 `zones` 的 `endsSpells` 一样，将 `entries` 中的一个条目（`<catalog>/<entry>`）瞄准该层，或让其范围触及该层；或用 `wind`，即会 `disperses` 的区域触及该层。瞄准分层墙的 `endsSpells` 不会对墙产生其他效果。最后一层消失时，区域结束。`flash: { "within": 20, "save": "con", "applies": [...], "triggers": ["appears", "enter", "turn-start"] }` 会在墙出现时、有人移动到该距离内时，或有人在该距离内开始回合时，对其中能看见墙且未通过条目自身难度的豁免的人施加 `applies`。5e 的 Prismatic Wall 是带 `triggers: ["enter"]` 且用 `blocks` 阻挡视线的墙（或环），带七行（红色火焰由 25 点冷冻伤害结束，橙色强酸由风结束，黄色闪电由 60 点力场伤害结束，绿色毒素由 Passwall 结束，蓝色冷冻由 25 点火焰伤害结束，靛色束缚由 Daylight 结束，紫色目盲由 Dispel Magic 结束），并带有造成目盲的体质豁免闪光。

破坏一层，以及通过光环响应（Capability API 1.491）。条目的 `endsLayers: true` 让它可以瞄准射程内仍存在的分层墙，前提是墙的某一层在 `endedBy.entries` 中指定了该条目，如同 Dispel Magic 瞄准持续存在的范围（选项在 `dispels` 下列出墙，选择结果用 `dispel` 指定其中一面）：前面的所有层都消失后，它就会摧毁该层，否则不会改变墙。在战斗中没有其他作用的条目，只有此类墙位于其触及范围内时才会提供：5e 的 Passwall，`{ "kind": "utility", "range": 30, "endsLayers": true }`，作用于绿色层。生物通过另一个生物的 `auras` 获得状态时，该状态的 `whenHit` 现在按传播它的状态来响应：采用将该状态施加给光环持有者的条目的豁免难度，以及该状态的来源和专注，因此 Holy Aura 赋予触及范围内每个盟友的效果，会让攻击者目盲，直到施法者的专注结束。

每层阻挡的效果，以及选择不受影响的对象（Capability API 1.492）。分层墙的行可以指定 `blocks`，取 `"ranged-nonmagical"`、`"ranged-magical"` 和 `"spells"` 中的任意项：该层存在期间，远程攻击（非魔法，或魔法：法术，或特质带 `magical` 的条目）或法术，只要其连线穿过墙的某个格子，就会如同连线被阻挡一样遭到拒绝；该层消失后，则由下一个仍存在的层决定。5e 的 Prismatic Wall 为红色层设置 `["ranged-nonmagical"]`，橙色层设置 `["ranged-magical"]`，靛色层设置 `["spells"]`。要让各层决定阻挡什么，应给墙设置 `obscures: {}` 而不是 `blocks: ["sight"]`，因为阻挡视线的墙本来就会拒绝所有穿过它的瞄准。`layers.spares` 现在可以为 `{ "chosen": N }`：施法者不受影响；施放墙时，选项在 `designates` 下列出可选择的生物（`count` 和 `ids`），选择结果用 `designates` 指定至多该数量的生物；只要墙仍存在，这些生物就能安全穿过，也不会被闪光波及。闪光也能穿透墙自身的遮蔽，因此起遮蔽作用的墙仍会让看着它的人目盲。

代表另一条目的行（Capability API 1.493）。目录条目的行可以指定 `standsFor`，它是 `<catalog>/<entry>` 引用，指向向同一列表提供数据的某个目录中的条目：写入的行会在其 `_catalog` 标记旁的保留键 `_standsFor` 下携带该引用，战斗将该行视作它代表的条目，连同费用、机制等所有内容一起读取，而该行仍归写入它的条目所有（移除该条目也会移除该行）。5e 的 Pact of the Chain 写入 `{ "list": "spells", "values": { "name": "Find Familiar", "level": 1, "prepared": true }, "standsFor": "spells/find-familiar" }`，提夫林的 Infernal Legacy 也以同样方式写入其 Thaumaturgy 行。不带它时，这样的行属于特性自身，而该特性没有机制，因此绝不会在战斗中提供。

破坏一层的物品使用（Capability API 1.494）。物品的 `use` 可以像法术一样携带 `endsLayers: true`，也允许仅执行此操作的功能性使用。它通过 `endsLayersAs` 指定用于与某层的 `endedBy.entries` 匹配的 `<catalog>/<entry>` 引用，因为物品并非墙所指定目录中的条目。只有此类墙位于其触及范围内时才会提供该使用选项，并以同样方式瞄准墙。5e 的 Passwall 卷轴：`{ "kind": "utility", "budget": "action", "range": 30, "consumes": true, "endsLayers": true, "endsLayersAs": "spells/passwall" }`。

穿过生物与实体地面（Capability API 1.495）。`combat.sizes.passing` 设定核心规则：`apart` 表示敌人的大小在 `order` 中与移动者至少相差多少个步骤，才能走过其占据的空间（5e 为 2）；`crowded` 表示被其他生物占据的格子使地面变得难行，其行走费用是原来的多少倍（5e 为 2，“其他生物的空间属于困难地形”）。任何人都不能停在其他生物的空间中。状态或等级可以赋予 `passesCreatures`：`"larger"` 允许走过任何大小更大的敌人（5e 的 Halfling Nimbleness），`"any"` 允许走过任何人。状态的 `passesObjects` 让持有者可以将实体地面视为困难地形穿过，并停在其中；如果持有者在其中结束自己的回合，则会受到其 `harm`（`dice`、`flat`、`damageType`），无需豁免：幽灵的 Incorporeal Movement，`{ "passesCreatures": "any", "passesObjects": { "harm": { "dice": "1d10", "damageType": "force" } } }`，由其数值块的 `keepsOn` 维持生效。

骑乘战斗（Capability API 1.496）。`combat.mounts` 让参战者可以花费一半速度，骑上身旁同一方的自愿生物，该生物的大小至少比自己大 `larger` 级（5e 为 1），也可以用同样方式下到坐骑身旁。菜单提供 `move:mount:<id>` 和 `move:dismount`。骑手随坐骑行走，骑乘时不能自行行走。带 `controlled.standard` 时（5e 为 `["dash", "disengage", "dodge"]`），没有人物卡的坐骑受骑手控制：其回合紧接在骑手之后，只能移动和采取所列标准行动。本轮已经进行过回合的坐骑，要等到下一轮。数值块写有 `mountIndependent: true` 的生物会自主行动。`fall`（`save`、`difficulty`、`applies`、`when`）用于坐骑刚获得 `when` 中某个状态，或被推动时：骑手进行该豁免，失败则摔落并被施加 `applies`，成功则站着下地。骑手持有所列状态之一时也会脱离坐骑。坐骑倒下或骑手倒下，也会使双方分开。5e：`{ "larger": 1, "controlled": { "standard": ["dash", "disengage", "dodge"] }, "fall": { "save": "dex_save", "difficulty": 10, "applies": "prone", "when": ["prone"] } }`。

拖动被你控制住的生物（Capability API 1.497）。战斗状态的 `dragged` 会在施加者行走时拖着持有者一起移动：施加者每走一步，持有者就移进施加者刚离开的格子。施加者的速度因此减半，每步花费加倍，除非持有者的大小至少比施加者小 `unlessSmaller` 级。5e 的被擒抱状态：`"dragged": { "unlessSmaller": 2 }`。

水下战斗（Capability API 1.498）。`combat.underwater` 在 `terrain` 中指定棋盘上属于水下的图块。站在这些图块上的人都算处于水下，除非身处空中，或是没有游泳速度的飞行者。其近战攻击会应用 `melee.mode`，除非其具有游泳速度，或武器属于 `melee.unless` 指定的武器：`names` 与攻击标签中的单词匹配，`qualities` 则与其特质匹配。`ranged.pastNormal: "never"` 阻止由水下生物发起或瞄准水下生物的射击超出武器的正常射程；正常射程内的射击应用 `ranged.mode`，除非 `ranged.unless` 指定了该武器。水下生物受到 `resist` 所列类型的伤害时，伤害减半。`breath` 计算其自身在水下的回合数。它们可以屏息 `holds` 个回合（`rounds`，再加上属性调整值每点对应的 `perMod.rounds`，总数不低于 `atLeast`），之后还能再坚持 `then` 个回合，并在下一个回合开始时降至 0 生命值。持有 `exempt.conditions` 中状态，或携带 `exempt.tags` 中标签的生物可以呼吸，离开水中后呼吸能力恢复。5e：`{ "terrain": ["water"], "melee": { "mode": "disadvantage", "unless": { "names": ["dagger", "javelin", "shortsword", "spear", "trident"] } }, "ranged": { "pastNormal": "never", "mode": "disadvantage", "unless": { "names": ["crossbow", "net", "javelin", "spear", "trident", "dart"] } }, "resist": ["fire"], "breath": { "holds": { "rounds": 10, "perMod": { "ability": "con", "rounds": 10 }, "atLeast": 5 }, "then": { "rounds": 0, "perMod": { "ability": "con", "rounds": 1 }, "atLeast": 1 }, "exempt": { "conditions": ["water_breathing"] } } }`。

跳跃
（Capability API 1.499）。
`combat.jumping`
为棋盘上的
每个参战者
在移动菜单中
提供 Jump(跳跃)（`move:jump`），
跳至其 `cells`
中的一个格子。
`long`
表示跳远距离，`high`
表示跳高
能越过的高度，
两者各取
某个属性的 `score` 或 `modifier`（由 `of` 指定），
加上 `plus`，
按规则集自身的
距离单位计。
只有在本回合
跳跃前紧接着
行走了 `runUp`
的助跑距离时，
才能达到完整距离；
没有助跑时，`standing: "half"`
将其减半。
跳跃沿
八个方向之一
的直线进行，
至少两个格子；
无论地面如何，
每格都按
一个格子的移动量
计算：
可以越过
困难地形、水、坑洞、
友方和不高于
跳高能力的地面，
绝不能穿过
墙或敌人，
且必须落在
跳跃者可以
站立的地方，
最多低一级。
途中像行走一样
触发借机攻击，
持续存在的范围
则只会在落点
影响跳跃者。
落在困难地形上时，
跳跃者要对抗 `difficulty`
进行 `hardLanding`
检定，
失败则受到 `applies`
状态。
状态的 `jumps`
使持有者
跳得更远：
达到 `times` 倍
（取最大者）；
有助跑时，`plus`
再增加
某个属性的调整值，带 `long: true`
时只对跳远生效。
骑乘中、
在其他生物体内、
身处空中、
拖动其他生物，
或持有决定
其移动方向的状态时，
都不能跳跃；
持有 `cannot-approach-source` 时，
不能通过跳跃
靠近其来源。
移动事件带 `jumped: true`。
5e：`{ "long": { "ability": "str", "of": "score" }, "high": { "ability": "str", "of": "modifier", "plus": 3 }, "runUp": 10, "standing": "half", "hardLanding": { "check": "agility", "difficulty": 10, "applies": "prone" } }`；
Jump 法术和 Boots of Striding and Springing
使用 `{ "jumps": { "times": 3 } }`，Step of the Wind
使用 `{ "times": 2 }`，Remarkable Athlete
使用 `{ "plus": { "ability": "str", "long": true } }`，Second-Story Work
使用 `{ "plus": { "ability": "dex" } }`。

濒死豁免与治疗取最大值（Capability API 1.500）。`combat.dying.asSave: true` 会将濒死掷骰视为豁免：凡是改变持有者所有豁免、且不限于某种豁免的效果，也会改变这次掷骰，既包括加上的数值（Bless、Aura of Protection），也包括是否掷两次。状态的 `deathSaves: "advantage"`(或 `"disadvantage"`) 会让持有者的濒死掷骰采用相应方式，无论是否设置了 `asSave`；此时濒死事件会携带 `mode`，设置了 `asSave` 时还会携带 `bonuses` 和 `total`。天然 1 或 20 仍从保留的骰子读取。状态的 `healedMax: true` 会让持有者获得的每次治疗都取其骰子可能达到的最大值，无论治疗来自行动、复活、再生，还是击杀后治疗。5e：在 `dying` 上设置 `"asSave": true`，以及 Beacon of Hope 的状态 `{ "effects": ["own-saves-advantage"], "saves": ["wis_save"], "deathSaves": "advantage", "healedMax": true }`。

暂时改变武器（Capability API 1.501）。状态的 `weapon` 在生效期间会改变持有者的武器打击：攻击标签中有某个完整单词属于 `names` 的打击，或所持物品符合 `items` 的打击（`names`、`tags`、`notTags`，读取方式与 `attackRows` 相同）；两者都未指定时，则改变所有武器打击。`toHit` 和 `damage` 分别加到攻击掷骰和伤害掷骰上。`ability` 指定攻击改用的属性，取代攻击原本的属性（要使用施法属性，也可以用 `abilityFrom`，指定一个存放属性 ID 的人物卡字段）；命中计算中的原属性调整值会被替换，伤害原本加上该调整值时，伤害计算中也会替换；来自数值块的生物没有可供替换的属性。`die` 将伤害改为一颗具有指定面数的骰子，`qualities` 会传给抗性判定。菜单的预测和实际掷骰都会读取这些设置。5e：Magic Weapon `{ "toHit": 1, "damage": 1, "qualities": ["magical"] }`(随法术位变化的 2 和 3 分别写成独立状态)，Shillelagh `{ "names": ["club", "quarterstaff"], "abilityFrom": "spellcasting_ability", "die": 8, "qualities": ["magical"] }`，Oil of Sharpness `{ "items": { "tags": ["slashing"] }, "toHit": 3, "damage": 3 }`，以及 Sacred Weapon 的“变为魔法武器”`{ "qualities": ["magical"] }`。

仅施加者获得优势（Capability API 1.502）。带有 `mode` 的 `attacks-taken` 调整项可以设置 `fromSource: true`：只有施加该状态者的攻击才按这种方式掷骰。`applies` 可以用 `endsAfter: "attacked-by-source"` 指定结束规则：来源下次对持有者作出攻击掷骰后，状态就会移除；其他人的攻击不会使其移除。5e 的 True Strike 向目标施加状态 `{ "modifiers": [{ "to": "attacks-taken", "mode": "advantage", "fromSource": true }] }`，施加时使用 `{ "duration": { "rounds": 1 }, "endsAfter": "attacked-by-source" }`。

斩击法术（Capability API 1.503）。`applies` 可以用 `endsAfter: "own-hit"` 指定结束规则：持有者下次武器攻击命中后才移除，未命中则继续保留，因此斩击法术状态附加的伤害（带有 `attacks: "weapon"` 的 `damage` 调整项）只会落在这次命中上。状态的 `onHit` 会在打击结束后，以持有者为来源，向持有者通过攻击掷骰命中的对象施加其中每个 `applies`：设置 `weapon: true` 时只限武器打击，设置 `blow` 时只限近战或远程打击。维持专注的状态会将专注传递给它施加的状态。5e 的 Branding Smite：`{ "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "2d6", "damageType": "radiant" }], "onHit": { "weapon": true, "applies": [{ "condition": "branded", "duration": { "rounds": 10 } }] } }`，施加时使用 `"endsAfter": "own-hit"`，其中 `branded` 为 `{ "suppresses": ["invisible"] }`。

元素形态与坐骑倒下后的着地（Capability API 1.504）。状态的 `stopsInFoes: true` 允许持有者走入敌对生物占据的空间并停在那里；友方的空间仍只能穿过。状态的 `entering` 会在每个回合中，持有者首次进入某个生物的空间时，对该生物执行效果：无需豁免的 `harm`(`dice`、`flat`、`damageType`)，以及以持有者为来源的 `applies`。`combat.mounts.fall.landsWith` 指定一种额度：坐骑获得 `fall.when` 中的某个状态时，骑手若还剩该额度，就花费一点，并在坐骑旁边双脚着地，取代豁免掷骰。被推下坐骑时仍需豁免。5e：Air and Water Form `{ "stopsInFoes": true, "passesCreatures": "any" }`，Fire Form `{ "stopsInFoes": true, "entering": { "harm": { "dice": "1d10", "damageType": "fire" }, "applies": [{ "condition": "on_fire", "duration": "until-dispelled" }] } }`，以及 `"landsWith": "reaction"`。

幻象分身（Capability API 1.505）。状态的 `duplicates` 为持有者提供 `count` 个分身，吸引原本针对持有者的攻击。每次针对持有者作出攻击掷骰前，先掷一颗 `sides` 面骰（未指定时为 d20）；若结果不低于 `thresholds[left - 1]`，其中 `left` 为剩余分身数，这次攻击就改为对分身掷骰，其防御为 `defense.flat` 加上持有者的 `defense.ability` 调整值。攻击命中的分身会被摧毁，不承受该攻击的其他效果；最后一个分身被摧毁时，状态结束。看不见持有者的攻击者，或在某种感官的范围内通过 `pierced` 中的该感官感知到持有者的攻击者，绝不会受骗。`thresholds` 从剩余一个到 `count` 个，各有一项对应值。5e 的 Mirror Image：`{ "count": 3, "thresholds": [11, 8, 6], "defense": { "flat": 10, "ability": "dex" }, "pierced": ["blindsight", "truesight"] }`，施加后持续 10 轮。

闪现消失（Capability API 1.506）。状态的 `blinks` 会在持有者每个回合结束时掷一颗 `sides` 面骰（未指定时为 d20）；结果不低于 `atLeast` 时，持有者从棋盘上消失，直到其下个回合开始。消失期间，任何人都无法触及它，也没有任何效果能伤害它，但它维持的效果（专注、区域、召唤物）会继续，战斗也不会因它暂时离场而判负。下个回合开始时，在执行该回合的任何其他事项前，它会回到消失的位置，或最近一处能容纳其大小的空位。5e 的 Blink：`{ "condition": "blink", "blinks": { "atLeast": 11 } }`，施加后持续 10 轮。

停止时间（Capability API 1.507）。状态的 `stopsTime`(`dice`、`flat` 或两者) 为持有者提供相应数量的连续回合，在施加该状态的回合结束时掷骰确定数量。每个回合紧接上个回合开始，不推进顺序，不开始新的一轮，回合之间也没有时机窗口；其他人不能行动、用反应回应或执行预备的使用，其他人的持续时间也不倒数。一旦持有者影响到其他生物，效果立即结束：向其发动攻击、持有者对其造成伤害、持有者要求其作出豁免，或持有者向其施加状态；否则在最后一个回合后结束。效果结束所在回合的剩余部分照常继续。5e 的 Time Stop，向施法者自身施加：`{ "condition": "time_stop", "stopsTime": { "dice": "1d4", "flat": 1 } }`。

命中后的伤害反击（Capability API 1.508）。状态的 `whenHit` 现在可以在命中的打击结束后，通过 `harms` 对命中持有者的攻击者造成无需豁免的伤害（`dice`、`flat`、`damageType`）；`within` 则将整个回应限制为只针对该距离内的攻击者，距离采用规则集的单位。`save` 和 `applies` 现在各自都是可选的：没有 `save` 时，`applies` 会直接施加；设置 `save` 就必须有 `applies`，且整个回应必须执行某种效果，即 `applies`、`harms` 或两者。5e 的 Fire Shield：`{ "whenHit": { "blow": "melee", "within": 5, "harms": { "dice": "2d8", "damageType": "fire" } } }`，寒冷护盾则用 `cold`；azer 的 Heated Body 通过其数值块的 `keepsOn` 实现，造成 `1d10` 火焰伤害。

挡在攻击前与针对某类攻击的防御（Capability API 1.509）。条目的 `takesAim: true` 若在 `"aimed"` 时刻，针对 `for` 指定的盟友或 `within` 触及范围内的任何人使用，就会让持有者取代该时刻原本涉及的对象，成为被瞄准效果的目标；它不会取消任何效果，也不自行造成任何效果。`"aimed"` 时刻现在可以携带 `blow`(`"melee"` 或 `"ranged"`)，只回应该类攻击；`defense` 调整项也可以携带 `blow`，仅对该类攻击生效。5e 的 Arrow-Catching Shield：穿戴时生效的调整项 `{ "to": "defense", "flat": 2, "blow": "ranged" }`，以及 `{ "kind": "utility", "reaction": { "on": "aimed", "for": "ally", "within": 5, "blow": "ranged" }, "takesAim": true }`。

免受重击（Capability API 1.510）。状态或物品 `worn` 上的 `criticals-against-normal` 效果会将针对持有者的重击变为普通命中，无论重击来自何处：骰子天然掷出最大面、扩大的重击范围，或持有者麻痹时的 `attacks-from-adjacent-critical`。5e 的 Adamantine Armor：`{ "worn": { "effects": ["criticals-against-normal"] } }`。

没有伤害骰的武器（Capability API 1.511）。物品的 `attack.damage` 可以省略 `dice`：打击仅造成 `bonus` 伤害，或不造成伤害。其 `onHit` 现在可以设置 `atLeast: 0`，使任何命中都能施加状态，无论造成多少伤害；也可以设置 `checkEnds`(`check`、`difficulty`)，指定一种 `combat.checks` 检定，持有者可以花费标准额度作出该检定来结束状态。5e 的吹箭筒：`{ "damage": { "bonus": 1, "type": "piercing" } }`；捕网：`{ "damage": {}, "onHit": [{ "condition": "restrained", "atLeast": 0, "targetIs": { "upToSize": "large" }, "checkEnds": { "check": "might", "difficulty": 10 } }] }`。

只能在水中呼吸（Capability API 1.512）。`combat.underwater.breath.waterOnly.tags` 指定只能在水中呼吸的生物标签。它们离水后会像其他人在水下一样屏息（先 `holds`，再 `then`，然后到 0），回到水下则恢复呼吸。`exempt` 会像豁免其他生物一样豁免它们。5e 中，鲨鱼或其他具有 Water Breathing 而没有 Amphibious 的生物：`{ "waterOnly": { "tags": ["water-breather"] } }`。

持续施加状态与延长跳跃的物品（Capability API 1.513）。物品的 `worn` 或 `carried` 效果可以设置 `keepsOn`，指定最多 4 个人物卡中定义的状态；物品效果适用期间，这些状态会在战斗中持续施加给持有者，绝不写入人物卡。还可以设置 `jumps`，写法与状态上的相同（`times`，或用 `plus` 加上某个属性的调整值）。脱下或丢弃物品后，这些效果就会消失。5e 的 Boots of Striding and Springing：`{ "worn": { "jumps": { "times": 3 } } }`；Ioun Stone of Awareness：`{ "worn": { "keepsOn": ["alert"] } }`，其中 `alert` 是防止持有者受惊的状态。

受伤后暂停生效（Capability API 1.514）。带有 `suppressedWhenHarmed: "until-own-turn-start"` 的战斗状态，从持有者受到伤害的那一刻起，到其下个回合开始前都不产生效果。状态并未结束，计时照常继续。5e 的 Cloak of Displacement，穿戴时用 `keepsOn: ["displaced"]`：`{ "condition": "displaced", "effects": ["attacks-against-disadvantage"], "suppressedWhenHarmed": "until-own-turn-start" }`。

状态改变的属性（Capability API 1.515）。战斗状态的 `abilities` 会在状态生效期间，按属性 ID 改变持有者的属性，方式与物品相同：`set` 将分值提升到至少指定数值（原本更高则保留），`add` 在此基础上相加（不超过 `max`），`to` 则将其精确设为指定数值。状态保留在人物卡上时，人物卡的所有计算都会读取改变后的分值。在战斗中施加时，战斗者的攻击、豁免、检定和防御都会据此重新计算，状态结束时再次重算；生命值和速度保持原样。对于没有人物卡的数值块，其列出的 `abilities` 会以同样方式改变，每项读取属性调整值的豁免和对抗检定，都会随该调整值的变化而等量改变，状态结束时恢复数值块上列出的值；没有列出分值的数值块保持原样。5e 的 Potion of Hill Giant Strength：`{ "condition": "hill_giant_strength", "effects": [], "abilities": { "str": { "set": 21 } } }`；Feeblemind：`"abilities": { "int": { "to": 1 }, "cha": { "to": 1 } }`。

永久提升属性（Capability API 1.516）。物品的 `use` 可以按属性 ID 设置 `raises`：`by` 永久加到分值上，`max` 永久加到其上限上。这是一种 `targets` 为 `"self"` 的 `"buff"`，只能在战斗外使用；战斗中绝不会提供此选项。提升会保留在角色在该游戏中的实时状态里，因此人物卡的所有计算都会读取提升后的分值。5e 的 Manual of Gainful Exercise：`{ "kind": "buff", "targets": "self", "budget": "action", "consumes": true, "raises": { "str": { "by": 2, "max": 2 } } }`。

按支付步骤选择状态（Capability API 1.517）。`applies` 条目可以设置 `paidSteps`(`atLeast`、`atMost` 或两者)：只有所属条目支付的费用比最低费用高出相应步骤数时，才会施加该状态，步骤数按 `perCostStep` 的方式计算（天生法术高于自身等级的部分也按同样方式计算）。5e 的 Magic Weapon 是 2 级法术：`[{ "condition": "magic_weapon_1", "duration": { "rounds": 600 }, "paidSteps": { "atMost": 1 } }, { "condition": "magic_weapon_2", "duration": { "rounds": 600 }, "paidSteps": { "atLeast": 2, "atMost": 3 } }, { "condition": "magic_weapon_3", "duration": { "rounds": 600 }, "paidSteps": { "atLeast": 4 } }]`，各状态分别具有自己的 `+1`、`+2` 或 `+3`。Branding Smite 每次增加的 1d6 也采用同样方式，每个法术位对应一个状态。

结束他者的状态（Capability API 1.518）。`applies` 条目或物品攻击 `onHit` 上的 `checkEnds` 可以设置 `by: "any"`：站在持有者旁边的任何人（没有棋盘的战斗中则可在任意位置），都可以花费自己的标准额度，用自己的检定替持有者尝试结束状态；持有者仍然可以自行尝试。5e 的炼金火：`{ "condition": "on_fire", "atLeast": 0, "checkEnds": { "check": "agility", "difficulty": 10, "by": "any" } }`。

单独计次的额外用法（Capability API 1.519）。物品最多可以有 16 项 `moreUses`(1.519 之前为 8 项)，每项都可以设置 `uses`：`max`(1 到 100)，以及可选的 `recharge`(`rests` 和 `amount`，后者为 `"max"` 或骰子，写法与 `charges.recharge` 相同)。这类用法在战斗中和战斗外都会消耗自身的一次使用次数，取代物品的充能（因此不能再有自己的 `charges` 费用），次数保留在物品叠上。物品栏为每项额外用法显示一个按钮及其剩余次数。5e 的 Staff of Thunder and Lightning，每项属性每个黎明可用一次：`{ "label": "Thunderclap", "use": { ... }, "uses": { "max": 1, "recharge": { "rests": ["dawn"], "amount": "max" } } }`；Helm of Brilliance 的 30 颗钻石则为 `"uses": { "max": 30 }`，没有充能恢复。

持有者身上的防护（Capability API 1.520）。战斗状态可以像区域一样设置 `wards`(`catalogs`、`maxLevel`、`by`；没有 `maxLevelPerCostStep`，因为它不是施放出来的)：除持有者自身使用的条目外，这些目录中该等级及以下的条目绝不会影响持有者；瞄准持有者时会被拒绝，在范围内则会跳过持有者。用 `keepsOn` 可让其在生物身上持续生效，用物品的 `worn.keepsOn` 则可让其在穿戴者身上持续生效。5e 的 rakshasa 的 Limited Magic Immunity：`{ "condition": "limited_magic_immunity", "effects": [], "wards": { "catalogs": ["spells"], "maxLevel": 6 } }`。

压制魔法的区域（Capability API 1.521）。区域可以设置 `suppresses`：`catalogs`、`tags` 或两者。对站在区域内的任何人，只由这些目录中的条目施加的状态不产生效果（状态并未结束，计时照常继续）；其持有的物品只要带有任意一个指定标签，穿戴或携带时就不产生效果，不提供其用法，且其攻击（从区域内发动，或以区域内的人为目标）按普通武器处理，不计物品自身的命中加值、伤害加值、额外伤害、诛杀效果，也不将这些标签视为武器特质。区域的 `forbids` 现在还可以像状态一样设置 `casts`：这些目录中的任何条目都不能从区域内施放。5e 的 Antimagic Field：`"zone": { "rounds": 600, "triggers": [], "suppresses": { "catalogs": ["spells"], "tags": ["magical"] }, "forbids": { "casts": ["spells"] }, "wards": { "catalogs": ["spells"], "maxLevel": 9 }, "inside": { "conditions": ["incapacitated"], "is": { "tags": ["antimagic-susceptible"] } } }`，最后一项用于 Antimagic Susceptibility。

吸收法术（Capability API 1.522）。战斗状态或物品的 `worn` 可以设置 `absorbs`：`catalogs`、`maxLevel` 和 `by`(与防护相同)。敌人使用这些目录中该等级及以下的条目，且以持有者为唯一目标时（绝不能是范围效果），条目会被吸收，不对持有者产生效果；使用者仍需支付费用。穿戴物品上的 `charges` 可以设为 `"spends"`(每吸收一个条目，就消耗等于其等级的物品充能，充能不足则无法吸收)，或 `"gains"`(将其等级加到充能上，不超过充能上限)，因此物品需有 `charges`。先读取状态，再依次读取穿戴物品；被反魔法区域压制的物品不能吸收任何条目。5e 的 Rod of Absorption：`"worn": { "absorbs": { "catalogs": ["spells"], "maxLevel": 9, "charges": "gains" } }`，配合 `"charges": { "max": 50 }`，储存的等级通过恢复法术位的 `use` 消耗；Ioun Stone of Absorption 为 `{ "catalogs": ["spells"], "maxLevel": 4, "charges": "spends" }`，配合 `"charges": { "max": 20 }`。

反射法术（Capability API 1.523）。调整项的 `against` 可以设置 `"alone": true`：只有针对仅以持有者为目标的效果所作的豁免才计入，范围效果绝不计入，而且还必须满足它指定的其他所有条件。战斗状态或物品的 `worn` 可以设置 `turns`：`catalogs`、`maxLevel` 和 `by`(与防护相同)。敌人使用这些目录中该等级及以下的条目，且以持有者为唯一目标时，若持有者的豁免骰掷出最大面，条目就不会对持有者产生效果，而是以同样的数值反射给使用者，如同使用者才是唯一目标；费用只支付一次。已被反射的条目绝不会再次反射，被反魔法区域压制的物品也不能反射任何条目。掷资源池骰的战斗没有最大面，因此无法发生反射。5e 的 Ring of Spell Turning：`"worn": { "modifiers": [{ "to": "saves", "mode": "advantage", "against": { "casts": ["spells"], "alone": true } }], "turns": { "catalogs": ["spells"], "maxLevel": 7 } }`。

储存法术以供稍后施放（Capability API 1.524）。物品或生物可以设置 `stores`：`catalogs`、`levels`(1 到 40) 和 `count`(最多 20)。战斗中，使用者从人物卡支付费用的、属于这些目录之一的条目，可以改为储存而不执行，存入自身可储存该条目的物品（穿戴或携带），或身旁盟友持有的这类物品，或身旁本身能储存条目的盟友：条目的选项会在 `storesIn` 下列出可储存的位置（`holderId`，表示物品在持有者人物卡上位置的 `item`，生物则无此项，以及 `label` 和表示该处剩余可用等级的 `room`），选择时用 `storesIn` 指定其中一个，不指定目标。储存时如同施放一样支付费用并消耗额度，采用支付时的等级；该等级必须不低于初始等级，且不能超过剩余容量；此时不产生任何效果。之后，穿戴该物品者或该生物自身可以免费施放一次：选项以储存载体和条目共同命名（“Ring of Spell Storing: Cure Wounds”），采用储存时的等级，以及储存者的豁免难度和攻击数值，不需要任何施法成分；但反魔法区域压制该物品期间绝不能施放。物品储存的内容在战斗后保留在物品叠上（`storedEntries`，每项有 `entry`、`label`、`level`、`saveDifficulty` 和 `toHit`），显示在物品栏中，并在下场战斗开始时读取。传入战斗的生物可以携带相同的列表 `stored`。在战斗前设置时，游戏主持人（GM）的 `standing` 可以指定 `"into"`：施法者的物品、`on` 首先指定者的物品，或直接按名称指定该生物自身；随后从施法者人物卡按条目自身的等级支付费用并储存。5e 的上述戒指：`"stores": { "catalogs": ["spells"], "levels": 5 }`；Ioun Stone of Reserve：`{ "catalogs": ["spells"], "levels": 3 }`；shield guardian 的 Spell Storing：`{ "catalogs": ["spells"], "levels": 4, "count": 1 }`。使用此功能的规则集需要 Capability API 1.524。

禁用物品与更多按法术位选择的状态（Capability API 1.525）。状态的 `forbids` 可以设置 `"items": { "tags": [...] }`：状态生效期间，无论战斗中还是战斗外，都不能使用带有任意一个指定标签的物品，也不能施放储存在这类物品中的条目；没有 `tags` 时，则禁止使用所有物品。物品的武器打击仍可发动。5e 的 Feeblemind：`"forbids": { "casts": ["spells"], "items": { "tags": ["magical"] } }`。此外，如果每个状态都指定了自己的 `paidSteps`，条目就可以在不使用 `appliesOneOf` 的情况下施加最多 12 个状态，只有符合实际支付步骤的状态才会施加：如 5e 的 Branding Smite，从 2d6 到 9d6 的状态，每个从 2 级到 9 级的法术位各对应一个。使用其中任一功能的规则集都需要 Capability API 1.525。

随天数流逝作出的豁免（Capability API 1.526）。条目的 `saveEnds` 可以设置 `"at": "days"` 和 `"days": n`：战斗中绝不掷此豁免，但施加该状态的战斗结束后，持有者的人物卡会保留该豁免及其难度，此后游戏时间每过去 `n` 天（人物卡的 `pass` 命令），持有者就再作出一次豁免，首次成功时状态结束。它不累计 `successes` 或 `failures`。5e 的 Feeblemind，“每过 30 天，生物可以在当天结束时再次作出豁免”：`{ "save": "int_save", "at": "days", "days": 30 }`，配合 `"duration": "until-save"`。使用此功能的规则集需要 Capability API 1.526。

回应触碰（Capability API 1.527）。状态的 `whenHit` 可以设置 `"touches": true`：此时，凡是尝试擒抱或推撞持有者，或尝试挣脱持有者擒抱的生物，无论尝试是否成功，都会像命中持有者时一样遭到回应。`from` 仍会限制回应的对象，`within` 则不再起作用，因为触碰本就发生在触及范围内；此设置可以不带 `blow`，也可以搭配 `"blow": "melee"`。5e 的 Heated Body，“生物触碰 azer，或在距其 5 英尺内以近战攻击命中它时，受到 5 (1d10) 点火焰伤害”：`{ "blow": "melee", "within": 5, "touches": true, "harms": { "dice": "1d10", "damageType": "fire" } }`。使用此功能的规则集需要 Capability API 1.527。

其他状态生效时受到压制（Capability API 1.528）。带有 `heldOffWhile` 的战斗状态，在持有者具有其 `conditions` 中任一状态，或持有者身上的其他状态产生其 `effects` 中任一效果时，不产生效果。它并未结束，计时照常继续；两个条件都不再满足时，就会再次生效。自身以这种方式受到压制的状态，绝不会压制其他状态。5e 的 Cloak of Displacement，“当你失能、束缚或因其他原因无法移动时受到压制”：`{ "condition": "displaced", "effects": ["attacks-against-disadvantage"], "suppressedWhenHarmed": "until-own-turn-start", "heldOffWhile": { "conditions": ["restrained"], "effects": ["cannot-act", "speed-zero"] } }`。使用此功能的规则集需要 Capability API 1.528。

水上行走（Capability API 1.529）。带有 `"walksOnLiquid": true` 的战斗状态允许持有者像在坚实地面上一样走上水面、穿过水面并停在那里，每格按普通一步计算；站在水面上时，绝不会被视为在水下。与 `runsAcross` 不同，它不能用于攀墙，也不能迈上任何高度的台阶。5e 的 Water Walk，以及穿戴时用 `keepsOn` 生效的 Ring of Water Walking：`{ "condition": "water_walking", "effects": [], "walksOnLiquid": true }`。使用此功能的规则集需要 Capability API 1.529。

带例外的目标测试（Capability API 1.530）。任何写有目标测试（`targetIs`、`from`、`of` 等）的地方，都可以设置 `"except": { ... }`，其本身也是一个测试：通过该测试的对象，绝不会通过当前测试。如果除此之外没有其他条件，则所有其他对象都能通过。5e 的捕网，“捕网对无定形的生物无效”：其施加束缚的 `applies` 带有 `"targetIs": { "except": { "tags": ["formless"] } }`。使用此功能的规则集需要 Capability API 1.530。

砍断束缚（Capability API 1.531）。带有 `cutFree: { defense, health, damageTypes? }` 的战斗状态可以作为独立对象遭受打击：只要攻击需要掷骰命中，且造成 `damageTypes` 中某种类型的伤害（省略时为任意类型），由持有者自身发动，或由攻击能够触及持有者的任何人发动，无论敌友，都会提供改为攻击该状态的选项。攻击对抗 `defense` 掷骰；只有指定类型的伤害能削减该状态的生命值，累计达到 `health` 后，持有者身上的状态结束。剩余生命值会在连续打击之间保留。5e 的捕网，“对捕网（AC 10）造成 5 点挥砍伤害，也可以在不伤害生物的情况下使其挣脱”：`{ "condition": "netted", "effects": ["speed-zero"], "cutFree": { "defense": 10, "health": 5, "damageTypes": ["slashing"] } }`。使用此功能的规则集需要 Capability API 1.531。

以使用者为中心的物品使用（Capability API 1.532）。物品的 `use` 及每项 `moreUses` 都可以像目录条目的范围一样，为爆发设置 `"around": true`(以及 `"throughWalls": true`)：无需瞄准，影响距使用者不超过其大小范围内的所有人，但不包括使用者自身。5e 的 Staff of Thunder and Lightning 的 Thunderclap：`"area": { "shape": "burst", "size": 60, "around": true }`，配合其体质豁免。使用此功能的规则集需要 Capability API 1.532。

暂时移出召唤来的生物（Capability API 1.533）。区域的 `suppresses` 可以在 `catalogs` 旁设置 `"setsAsideCalled": true`：由这些目录之一的条目召唤进战斗的生物，在区域覆盖它期间会被暂时移出。它像被送走的生物一样离开战斗，不执行回合，也不会被任何人瞄准，但维持它的因素（专注、轮数）照常继续；区域移动或结束、不再覆盖它时，它就回到原先站立的位置。5e 的 Antimagic Field，“召唤的生物消失”：`"suppresses": { "catalogs": ["spells"], "tags": ["magical"], "setsAsideCalled": true }`。使用此功能的规则集需要 Capability API 1.533。

单独计次的武器命中效果（Capability API 1.534）。物品 `attack.spends` 中的条目可以用 `"uses": { "max": 1, "recharge": { "rests": ["long"], "amount": "max" } }` 取代 `charges`：它消耗自身的一次使用次数，像额外用法的次数一样保留在物品叠上，并在 `recharge` 指定的休息时恢复。如果它只执行 `onHit`，可以省略 `amount`。被命中者作出的 `save`(`{ "save": "con", "difficulty": 17 }`) 成功时会阻止其伤害量生效，`drain`(`{ "share": 0.5 }`) 则将该伤害量实际造成伤害的相应比例转为持用者恢复的生命值。`onHit` 条目可以在 `saveEnds` 旁设置 `rounds`，指定最长持续时间，`"of": "source"` 则按持用者的回合计算轮数。5e 的 Rod of Lordly Might 的 Drain Life：`{ "label": "Drain Life", "uses": { "max": 1, "recharge": { "rests": ["long"], "amount": "max" } }, "amount": { "dice": "4d6" }, "type": "necrotic", "save": { "save": "con_save", "difficulty": 17 }, "drain": { "share": 0.5 } }`；Paralyze：`"onHit": [{ "condition": "paralyzed", "rounds": 10, "save": { "save": "str_save", "difficulty": 17 }, "saveEnds": { "save": "str_save", "difficulty": 17, "at": "turn-end" } }]`，不带伤害量；前述法杖的 Thunder：`"onHit": [{ "condition": "stunned", "rounds": 1, "of": "source", "save": { "save": "con_save", "difficulty": 17 } }]`。使用此功能的规则集需要 Capability API 1.534。

同时执行的用法（Capability API 1.535）。物品的某项 `moreUses` 可以设置 `"alongside": ["Thunderclap"]`，列出该物品其他用法的标签：使用时，这些用法也会同时执行，影响各自以使用者为中心的爆发覆盖到的对象，不消耗它们自身的任何次数或资源。只有以使用者为中心的用法（`"area": { ..., "around": true }`）可以随其他用法同时执行，因此不会重复瞄准；而随其他用法执行的用法，自身不能再附带同时执行的用法。5e 的该法杖的 Thunder and Lightning：`{ "label": "Thunder and Lightning", "use": { ...Lightning Strike's line... }, "uses": { "max": 1, "recharge": { "rests": ["long"], "amount": "max" } }, "alongside": ["Thunderclap"] }`，它消耗自身的每日使用次数，不消耗另两种用法的次数。使用此功能的规则集需要 Capability API 1.535。

掷骰确定次数（Capability API 1.536）。额外用法的 `uses` 可以在 `max` 旁设置 `"rolled": "1d10"`：每个物品叠具有掷骰确定的次数，创建时只掷一次，之后每次读取都保持相同，绝不超过 `max`(此时它就是骰子可能掷出的最大值)。若有 `recharge`，恢复时会回到该物品叠自身的次数。5e 的 Helm of Brilliance：`{ "label": "Daylight (diamond)", "use": { ... }, "uses": { "max": 10, "rolled": "1d10" } }`，火蛋白石则用 `"max": 30, "rolled": "3d10"`；Necklace of Prayer Beads 的念珠用 `"max": 6, "rolled": "1d4+2"`。使用此功能的规则集需要 Capability API 1.536。

随法术位增强的召唤（Capability API 1.537）。`calls` 可以设置 `"perStep": 2`，每多支付一步费用，就多召唤相应数量的生物（5e 的 Animate Dead，“法术位每比 3 级高一级，就额外召唤两个亡灵生物”）；`upTo` 可以设置 `"perStep": 1`，使其 `at` 每步提高相应数值（Conjure Elemental，“法术位每比 5 级高一级，挑战等级就提高 1”），因此高于原上限的生物会显示为选项，但支付等级不足时仍会被拒绝。每项 `options` 可以设置 `"fromStep": 2`，只有支付了这么多步或更多时才提供选项；还可以设置自身的 `perStep`，从超出 `fromStep` 的部分开始计算。5e 的 Create Undead 从 6 级起：`"options": [{ "creature": "creatures/ghoul", "count": { "flat": 3 }, "perStep": 1 }, { "creature": "creatures/ghast", "count": { "flat": 2 }, "fromStep": 2, "perStep": 1 }, { "creature": "creatures/wight", "count": { "flat": 2 }, "fromStep": 2, "perStep": 1 }, { "creature": "creatures/mummy", "count": { "flat": 2 }, "fromStep": 3 }]`。使用此功能的规则集需要 Capability API 1.537。

转为敌对的召唤生物（Capability API 1.538）。由条目 `concentration` 维持的 `calls` 可以设置 `"hostileOnBreak": true`：专注被打断时（因伤害、施法者倒下，或结束专注的区域），这些生物不会离场，而是转到另一方，不再受召唤者指挥，也不能再被遣散；若专注以其他方式结束，如施法者主动放弃或施放另一个法术，它们仍会像以前一样离场。它们的 `rounds` 仍会耗尽。5e 的 Conjure Elemental：`"calls": { "from": { ... }, "count": { "flat": 1 }, "rounds": 600, "hostileOnBreak": true }`，“它会对你和同伴产生敌意，并可能发动攻击”。使用此功能的规则集需要 Capability API 1.538。

自行打击的召唤物（Capability API 1.539）。`summons` 可以设置 `"strikesAtTurnStart": true`，不带 `budget`：施放时只在瞄准的位置出现，之后在召唤者每个回合开始时，从自身所在位置向 `reach` 内距其最近、与召唤者敌对的生物发动条目的攻击（附近无人则不发动），从不需要指挥，也绝不等待回应。这类召唤物最多可以持续 14400 个 `rounds`。5e 的 Faithful Hound：`"summons": { "rounds": 4800, "reach": 5, "strikesAtTurnStart": true }`，所属条目的攻击是其 4d8 穿刺伤害的啮咬，使用施法者的法术攻击。使用此功能的规则集需要 Capability API 1.539。

死亡时爆发的生物（Capability API 1.540）。生物可以携带 `"onDeath"`，其写法与 `actions` 中的行动相同，但绝不出现在菜单上，其 `area` 是 `around` 自身的爆发：生物死亡时（离开战斗，而非仅仅倒下），对爆发覆盖到的所有对象结算，豁免、伤害和 `applies` 与任何其他行动相同，绝不等待回应。5e 的 dust mephit 的 Death Burst：`"onDeath": { "id": "death-burst", "name": "Death Burst", "budget": "reaction", "area": { "shape": "burst", "size": 5, "around": true }, "save": { "save": "con_save", "difficulty": 10, "onSuccess": "negates" }, "applies": [{ "condition": "blinded", "duration": { "rounds": 1 } }] }`；balor 的 Death Throes 则在 30 英尺内造成 20d6 火焰伤害，敏捷豁免难度为 20，成功则伤害减半。带有 `zone` 的行动则改为在生物倒下处留下该范围，区域的格子为围绕生物原本占据的每一格形成的爆发；区域必须设置 `"anchor": "point"` 和 `"outlasts": true`，这样即使创造者已离场，仍会在每轮结束时倒数。smoke mephit 的烟云：`"zone": { "rounds": 10, "anchor": "point", "outlasts": true, "triggers": [], "obscures": {} }`。使用此功能的规则集需要 Capability API 1.540。

伤害转为治疗生物（Capability API 1.541）。生物的 `"healedBy"` 列出伤害类型，匹配时不区分大小写：这些类型之一的打击不会造成伤害（日志记为免疫），反而恢复等于原本应造成伤害的生命值，不超过其最大值。5e 的 flesh golem 的 Lightning Absorption：`"healedBy": ["lightning"]`；clay golem 对应强酸，iron golem 对应火焰，shambling mound 对应闪电。使用此功能的规则集需要 Capability API 1.541。

伤害向生物施加的状态（Capability API 1.542）。生物的 `"whenHarmedBy"` 最多包含四条规则，每条指定 `by` 伤害类型（匹配时不区分大小写），以及受到这些类型之一的打击并承受非零伤害时，向自身施加的 `applies`；免疫的打击不造成伤害，因此不施加任何状态。5e 的 flesh golem 的 Aversion of Fire：`"whenHarmedBy": [{ "by": ["fire"], "applies": [{ "condition": "aversion-of-fire", "duration": { "rounds": 1 } }] }]`，该状态使其攻击和检定具有劣势，直到其下个回合结束；water elemental 的 Freeze 则由寒冷伤害施加一个使速度降低 20 英尺的状态。使用此功能的规则集需要 Capability API 1.542。

用三个键实现 golem 的 Berserk（Capability API 1.543）。生物的 `"rollsAtTurnStart"` 最多包含四条规则，每条都在其回合开始时掷骰，前提是生命值不超过 `healthAtMost`，且尚未具有该规则 `applies` 中的所有状态：`dice` 掷出 `atLeast` 或更高时，就向自身施加这些状态。战斗状态的 `"behavior": { "nearest": true }` 会在持有者每个回合开始时，让其冲向最近一个能看见的其他生物，无论敌友：若尚未在其旁边，就会走到其旁边，而且本回合只能攻击该生物（看不见任何人时，回合由持有者自由行动）。战斗状态的 `"endsAtFullHealth": true` 会在持有者被治疗至满生命值时结束状态。5e 的 flesh golem：`"rollsAtTurnStart": [{ "healthAtMost": 40, "dice": "1d6", "atLeast": 6, "applies": [{ "condition": "berserk", "duration": "until-dispelled" }] }]`，配合 `{ "condition": "berserk", "effects": [], "behavior": { "nearest": true }, "endsAtFullHealth": true }`；clay golem 的设置相同，但生命值门槛为 60。使用其中任一功能的规则集都需要 Capability API 1.543。

打击受惊或尚未行动的目标（Capability API 1.544）。战斗状态对 `attacks` 或 `damage` 的修改可以设置 `"whenTarget": "surprised"` 或 `"not-yet-acted"`(目标在本场战斗中尚未开始过回合)，对 `attacks` 的修改还可以设置 `"critical": true`，在适用时使持有者的命中变为重击。5e 的 Assassinate：`[{ "to": "attacks", "mode": "advantage", "whenTarget": "not-yet-acted" }, { "to": "attacks", "critical": true, "whenTarget": "surprised" }]`；bugbear 的 Surprise Attack，则在通过 `keepsOn` 持续生效的状态上设置 `{ "to": "damage", "dice": "2d6", "whenTarget": "surprised" }`。生物的 `attackModes` 也接受 `whenTarget`(doppelganger 的 Ambusher，对因它而受惊的生物具有优势)，附加效果的 `when` 则接受 `"target-surprised"` 和 `"target-not-yet-acted"`。使用其中任一功能的规则集都需要 Capability API 1.544。

gnoll 的 Rampage（Capability API 1.545）。生物的 `"rampage": { "action": "bite", "budget": "bonus", "move": 0.5 }` 指定其自身的一项行动和战斗中的一种额度：它在自身回合中以近战攻击使一个生物降至 0，且仍有该额度时，就消耗该额度，获得额外移动距离，为自身速度的 `move` 比例（未指定时为一半），并且该行动在本回合可额外免费使用一次。使用此功能的规则集需要 Capability API 1.545。

冲锋后的后续行动（Capability API 1.546）。生物行动的 `charge` 可以携带 `"then": { "action": "bite", "budget": "bonus", "targetHolds": ["prone"] }`：冲锋打击在发动者自身回合中完成后，若受到打击的对象具有 `targetHolds` 中的每个状态，本回合就会额外提供一次该生物自身的指定行动，从 `budget` 支付费用，且只能针对该对象。5e 的 lion 的 Pounce，以及 elk 的 Charge 后续行动。使用此功能的规则集需要 Capability API 1.546。

仅在指定形状下可用的行动（Capability API 1.547）。生物行动的 `"inShape"` 列出提供该行动的形状：`"own"` 表示持有者自身的形状，或以 `"<catalogId>/<entryId>"` 指定某个形态的生物图鉴条目（即 `shape` 状态赋予的形状）。wereboar 用 `"inShape": ["creatures/boar", "creatures/hybrid-wereboar"]` 保留其 Charge（通过形状的 `keeps` 在不同形状间保留），长矛则用 `["own"]`；mimic 的 Adhesive 则在物体形态下可用。使用此功能的规则集需要 Capability API 1.547。

以自身某种形态撑住（Capability API 1.548）。`hangsOn` 可以携带 `"becomes": { "action": "change", "form": "creatures/vampire-mist" }`：持有者在 1 点生命值撑住时，立即变为自身行动 `forms` 中的该形态，通过该行动中带有 `shape` 的状态施加，效果与使用该行动完全相同。5e 的 vampire 的 Misty Escape：`"hangsOn": { "uses": 1, "label": "Misty Escape", "becomes": { "action": "shapechanger", "form": "creatures/vampire-mist" } }`，配合一个 `health` 为 `"own"` 的形状状态。使用此功能的规则集需要 Capability API 1.548。

每个回合都会恢复的额度（Capability API 1.549）。生物可以列出 `"refillsEveryTurn": ["reaction"]`(1 到 4 个行动经济额度 ID)：任意战斗者的回合结束时，列出的每种额度都会补满，因此生物可以在下个战斗者的回合中再次花费，无需等待自己的回合。5e 的 marilith 的 Reactive：`"refillsEveryTurn": ["reaction"]`。不属于战斗行动经济额度的 ID 会被拒绝。使用此功能的规则集需要 Capability API 1.549。

死亡后再生的头颅（Capability API 1.550）。生物可以携带 `"heads": { "count": 5, "lostAt": 25, "grows": 2, "growthStoppedBy": ["fire"], "healsPerHead": 10, "opportunityReactions": true, "whileMany": ["many_heads"] }`。它最初具有 `count` 个头（2 到 20）。单个回合内承受的伤害每当达到 `lostAt`，就有一个头死亡，每回合最多一个；没有头剩下时，生物死亡。在自身回合结束时，自上个自身回合以来每有一个头死亡，就长出 `grows` 个头（默认为 2），指定了 `max` 时绝不超过该值，并且每长出一个头就恢复 `healsPerHead` 点生命值；但若自上个自身回合以来受到过 `growthStoppedBy` 中某种类型的伤害（匹配时不区分大小写），则不会再生或恢复。设置 `opportunityReactions` 时，除第一个头之外，每个头都会提供一次仅能用于借机攻击的额外反应，先于自身原有的反应消耗，并在自身回合开始时恢复。头数多于一个时，它具有 `whileMany` 指定的状态，因此带有豁免调整项（`"to": "saves", "mode": "advantage", "against": { "conditions": ["blinded", "charmed", "deafened", "frightened", "stunned", "unconscious"] }`）的状态可为 hydra 提供豁免优势；降至一个头时失去这些状态，头再生时则重新获得。`sequence` 步骤可以携带 `"perHead": true`：按生物当前每个头打击 `times` 次，选项会要求相应数量的目标。5e 的 hydra 的 Multiattack：`"sequence": [{ "action": "bite", "perHead": true }]`。没有 `heads` 的生物若设置了 `perHead` 步骤，会被拒绝。使用其中任一功能的规则集都需要 Capability API 1.550。

命中生物后腐蚀的武器（Capability API 1.551）。生物可以携带 `"corrodesWeapons": { "tags": ["metal"], "sparesMagical": true, "ammunition": true }`。所持武器的物品只要带有 `tags` 中的任意标签，命中该生物时就会先造成伤害，再永久使其伤害掷骰减去 `step`(默认为 1)：战斗立即降低其打击伤害，惩罚写回武器的物品叠（`corroded`，保留在数量为一的物品叠上），此后每场战斗都会重新读取。惩罚达到 `destroyedAt`(默认为 5) 时，武器被摧毁：其打击从菜单中移除，物品叠失去该武器，日志中记为损失。`sparesMagical` 会放过带有 `magical` 标签的武器。设置 `ammunition` 时，带有 `tags` 中任意标签的弹药在命中并造成伤害后被摧毁，因此战斗后无法回收这次射击消耗的任何弹药；发射武器自身不会腐蚀。5e 的 rust monster 的 Rust Metal 为 `{"tags": ["metal"], "sparesMagical": true, "ammunition": true}`，black pudding 的 Corrosive Form 则为 `{"tags": ["metal", "wood"], "ammunition": true}`。使用此功能的规则集需要 Capability API 1.551。

更多状态（Capability API 1.552）。人物卡的 `live.conditions`、休息的 `clear.conditions` 和 `combat.conditions` 的条目上限从 320 增至 640。声明超过 320 个条目的规则集需要 Capability API 1.552。

对持有者施加了状态的目标进行攻击和对抗（Capability API 1.553）。`to: "attacks"` 或 `to: "damage"` 调整值可以带 `"targetHoldsFromSelf": ["grappled"]`：它只改变持有者自身对某个目标的攻击或伤害，且该目标必须持有其中一种由持有者施加的状态。5e 的 Grappler 专长是带有 `{"to": "attacks", "mode": "advantage", "targetHoldsFromSelf": ["grappled"]}` 的状态或等级。生物的 `attackModes` 条目也可以带同一个键，如拟形怪的 Grappler：`{"mode": "advantage", "targetHoldsFromSelf": ["grappled"]}`。带 `targetHolds` 的对抗可以带 `"targetHeldBySelf": true`：只有目标持有行动者施加的该状态时，才提供此对抗。对抗的 `onWin` 可以带 `"both": { "applies": ["restrained"], "whileTargetHolds": "grappled" }`：每个状态都同时施加给败者和胜者；只要目标不再持有 `whileTargetHolds`，这些状态就立即结束，无论它因何结束（挣脱、放开或其来源倒下）。Grappler 专长的压制写作 `{"id": "pin", "label": "Pin", "budget": "action", "attacker": {"checks": ["might"]}, "defender": {"checks": ["might", "agility"]}, "targetHolds": "grappled", "targetHeldBySelf": true, "onWin": {"both": {"applies": ["restrained"], "whileTargetHolds": "grappled"}}}`。使用其中任一项的规则集需要 Capability API 1.553。

从尸体唤起召唤物，以及召唤数量上限（Capability API 1.554）。生物行动的 `calls` 可以带 `"atCorpse": { "withinRounds": 10, "is": { "types": ["humanoid"] } }`：该行动以一个死亡不超过 `withinRounds` 轮、符合 `is` 的生物为目标（目标测试，读取方式与 `targetIs` 相同；省略时不限种类），且尸体须在行动的 `reach` 内；只有战场上存在这样的尸体时才提供此行动。召唤的生物在尸体所占空间中出现，加入召唤者一方，尸体随之消失，无法再次从中唤起生物。带 `options` 的召唤不能从尸体唤起生物。`calls` 还可以带 `"atMost": 7`：只要该行动召唤的生物中仍站着的数量达到此值，就不提供此行动。5e 的缚灵的 Create Specter 写作 `{"creature": "creatures/specter", "count": {"flat": 1}, "atCorpse": {"withinRounds": 10, "is": {"types": ["humanoid"]}}, "atMost": 7}`，`reach` 为 10 英尺。使用其中任一项的规则集需要 Capability API 1.554。

提供掩护的墙、唯一可用的速度、在特定地点被阻止的再生，以及目标测试中的飞行者、持有状态和备选条件（Capability API 1.555）。区域的 `"cover": "half"` 或 `"three-quarters"` 让攻击或效果在通向目标的连线穿过区域某个完好格子时，至少按该档位的掩护处理（已破坏段的格子不计），档位按 `combat.cover` 判定；目标和攻击者自身的格子绝不算在两者之间。5e 的 Blade Barrier 使用 `"cover": "three-quarters"`。战斗状态的 `"onlySpeeds": true` 让其 `speeds` 成为状态持续期间持有者仅有的移动方式：其行走速度和自身其他速度均为 0。5e 的 Gaseous Form 写作 `{"speeds": {"fly": 10}, "hover": true, "onlySpeeds": true}`。再生的 `"notIn": { "light": ["sunlight"], "terrain": ["running-water"] }` 会在持有者开始回合时，若其站立位置处于其中一种光照下，或所在图块或棋盘的地点属于 `terrain` 所列类型，就阻止再生（读取方式与生物的 `checkModes` 相同）：对应吸血鬼的“如果吸血鬼不在阳光下或流水中”。目标测试（`targetIs`、区域的 `keepsOut.is` 及其他所有读取目标测试的位置）还可以写 `"flying": true`（仅限具有飞行速度者）和 `"holding": ["gaseous_form"]`（仅限持有其中一种战斗状态者），每项都须与它提出的其他条件同时满足；还可以写 `"anyOf": [ ... ]`，列出两到四个目标测试，至少须满足其中一个。5e 的 Wind Wall 阻止 `{"anyOf": [{"upToSize": "tiny", "flying": true}, {"holding": ["gaseous_form"]}]}` 进入。使用其中任一项的规则集需要 Capability API 1.555。

等待一段游戏时间后恢复的充能和使用次数（Capability API 1.556）。
物品的 `charges.recharge`、额外使用方式的 `uses.recharge` 和打击的 `uses.recharge` 可以带 `"after": { "days": 2 }` 或 `"after": { "hours": { "dice": "1d12" } }`（也可以同时带两者，
时间相加）：
次数耗尽后，
等待游戏计时经过这段时间，
再恢复其 `amount`（`"max"` 则全部恢复）。
等待从次数耗尽后计时首次推进时开始，
以骰子决定的小时数也在此时掷骰；
等待状态保存在物品叠上。
带 `after` 时，
`rests` 可以为空，
这样任何休息都不会提前恢复次数；
两者都有时，
任一方式都能恢复，
休息已归还次数后就不再等待。
这里使用游戏自身的计时：
每次时间推进（行动耗时、在地图或世界中行走、游戏主持人（GM）叙述中经过的天数），
背包中的等待都会计入这段时间。
5e 的 Figurines of Wondrous Power 写作 `{"rests": [], "amount": "max", "after": {"days": 2}}`（各自有各自的天数），
Wings of Flying 则写作 `{"rests": [], "amount": "max", "after": {"hours": {"dice": "1d12"}}}`。
使用 `after` 的规则集需要 Capability API 1.556。

分阶段的区域（Capability API 1.557）。区域的 `"stages"`（一到十个，按顺序排列）说明它从施法者的哪个回合开始产生何种效果，施放时所在的回合计为第一个：`{ "from": 3, "label": "Lightning", "amount": { "dice": "10d6" }, "damageType": "lightning", "save": "dex_save", "onSave": "half", "count": 6 }`。施法者的回合开始时，该回合所处的阶段（已达到其 `from` 的最后一个阶段）会对区域内的人造成 `amount` 数量的 `damageType` 伤害，以其 `save` 对抗条目自身难度作豁免（`onSave` 为“half”，省略则为“none”）；若指定了 `count`，则只影响这么多人，优先施法者的敌人，再优先离区域中心最近者。没有 `amount` 的阶段不会打击任何人。阶段持续期间，其 `difficult` 让区域地面难以通行，`obscures` 让区域成为重度遮蔽，`noRanged` 阻止所有使用远程武器向区域内、向区域外或穿过区域进行的攻击（法术或范围效果不算武器）。条目自身的效果用于第一个回合，在区域的 `triggers`（可以为空）触发时或在施放时产生。5e 的 Storm of Vengeance 在施放时造成雷鸣伤害和耳聋，之后的阶段从 2（酸雨，1d6 强酸）、3（闪电，六道各造成 10d6 伤害的闪电，敏捷豁免成功减半）、4（冰雹，2d6 钝击）和 5（阵风与冻雨，1d6 寒冷，`difficult`、`obscures`、`noRanged`）开始。使用 `stages` 的规则集需要 Capability API 1.557。

按召唤者构建、且只按命令行动的生物（Capability API 1.558）。目录条目或物品使用的 `calls` 可以写 `"fromCaller": { "health": true, "toHit": <value>, "adds": <value> }`：每个召唤生物都以召唤者的生命值最大值作为自身生命值；其每次攻击都以 `toHit`（从召唤者人物卡读取的值，读取方式与 `amountAdd` 相同）作为掷骰加值；而以相同方式读取的 `adds` 加到其每份伤害数值上。带 `"commandedWith": "bonus"`（战斗行动经济中的一种额度）时，它们只按召唤者的命令行动：第一个回合，即出现的回合，免费行动；之后每个回合，召唤者支付 1 点该额度，否则该回合跳过（日志会说明它在等待）。带 `"initiative": "after"` 时，该回合紧接在召唤者之后，因此召唤者若在自己的回合已花掉该额度，就没有剩余额度可供它使用。5e 的 Arcane Hand 以 `{"initiative": "after", "fromCaller": {"health": true, "toHit": <spell attack>, "adds": <spellcasting modifier>}, "commandedWith": "bonus"}` 召唤一只大型手，其四种手势是它自身的行动：Clenched Fist 攻击、Forceful Hand 的推开对抗、Grasping Hand 的擒抱对抗及对其擒抱者的挤压，以及挡在前方提供掩护的 Interposing Hand。使用其中任一项的规则集需要 Capability API 1.558。

掷骰表（Capability API 1.559）。目录条目或物品使用的 `calls` 带 `"rolled": true` 时，会在使用时掷骰决定其 `options` 中出现哪一项，绝不手选：每项相对于其他项的出现概率由其 `"weight"` 决定（1 到 100，未指定则为 1），并指定一个 `creature`。带 `"hostile": true` 的选项召唤的生物加入对方，敌对召唤它们的人；带 `"none": true` 和 `label` 的选项不召唤任何生物，只叙述其标签。5e 的 Bag of Tricks 从八个各含一只野兽的选项中掷骰；Efreeti Bottle 则在 `{"creature": "creatures/efreeti", "count": {"flat": 1}, "weight": 1, "hostile": true, "label": "It attacks you"}`、以 `"weight": 8` 为你服务的同一火巨灵，以及 `{"none": true, "weight": 1, "label": "It grants three wishes"}` 之间掷骰。物品还可以带有 2 到 24 行的 `useTable`，每行都有自己的 `weight`、`label` 和 `use`；其 `use` 写 `"rollsTable": true` 时（以任意一个生物或其 `targets` 指定的一方为目标的 `utility` 使用），就在此表上掷骰，只支付该使用本身的费用：掷出的那一行作用于此次使用指向的目标，有范围则以那里为中心，以 `self` 为目标则作用于使用者，而没有 `use` 的行（长草、蝴蝶）只作叙述。5e 的 Wand of Wonder 对 120 英尺内的一个生物使用时消耗一次充能，其表会从 Slow、Faerie Fire、对使用者的震慑、Stinking Cloud、犀牛冲锋、Lightning Bolt、Fireball 等结果中掷骰。日志会说明掷了什么、得到了什么。使用其中任一项的规则集需要 Capability API 1.559。

对物体造成双倍伤害（Capability API 1.560）。生物的数值块带 `"doubleToObjects": true` 时，对所有非生物目标造成的伤害都是原本的两倍：墙的各段、分层墙的各层和棋盘上的道具，先处理物体忽略的伤害或承受双倍的伤害，再加倍。5e 的 Siege Monster 就用于土元素及其他“对物体和建筑造成双倍伤害”的生物。使用它的规则集需要 Capability API 1.560。

谁能听懂谁（Capability API 1.561）。`combat.languages`，即 `{"list": <list>, "column": <column>, "prefix": <text>}`，说明从哪里读取角色的语言：人物卡该列表中，每行的指定列若以前缀开头（指定了前缀时），其前缀后的其余文本就表示一种语言，不区分大小写。5e 写作 `{"list": "proficiencies", "column": "name", "prefix": "Languages: "}`。生物的数值块以 `"languages": ["Common", "Abyssal"]` 指定自身语言。条目的 `targetTypes` 带 `"understands": true` 时，只能指向或卷入能听懂使用者所懂的一种语言的生物：5e 的 Suggestion、Mass Suggestion 和 Command 就对听不懂你的生物无效。语言未写明者（没有 `combat.languages` 的人物卡、没有 `languages` 的生物）绝不会因此被排除。这类法术让目标做什么，由状态自身的 `behavior` 决定（1.264）：Suggestion 的选项作为施法选择（1.313），其状态让目标走开（`moves`）、不动（`only: []`）、丢下手持物（`drops`）或浪费行动（`wastes`）。使用其中任一项的规则集需要 Capability API 1.561。

违抗造成的伤害（Capability API 1.562）。战斗状态的 `harms` 可以在 `"at": "attacks-source"` 时发生，即持有者对施加此状态者发动攻击或进行任何造成伤害的行为时；也可以在 `"at": "attacks-source-side"` 时发生，即针对施加者一方的任何人时。带 `"once": true` 则在该状态持续期间只造成一次伤害。5e 的 Geas 若命令“不要伤害我或我的朋友”，就是带 `{"at": "attacks-source-side", "dice": "5d10", "type": "psychic", "once": true}` 的状态（每天不超过一次，而一场战斗不到一天）。使用其中任一项的规则集需要 Capability API 1.562。

分配治疗量（Capability API 1.563）。带 `"sharesHeal": true` 的 `heal` 条目只治疗一份总量，其 `amount`（及 `amountAdd`）掷骰一次，按选定顺序分配给各目标：每个目标最多治疗到自身最大值，剩余量留给下一个，直到耗尽。带 `"sharesHeal": "half"` 时，任何人都不会被治疗到超过自身最大值的一半，已经达到该值者不会得到治疗。5e 的 Preserve Life 写作 `{"kind": "heal", "amount": {"flat": 0}, "amountAdd": <five times cleric level>, "sharesHeal": "half", "targets": "ally", "targetCount": 6, "range": 30, "targetTypes": {"not": {"types": ["undead", "construct"]}}}`。使用它的规则集需要 Capability API 1.563。

按投掷物和持有物收窄反应条件（Capability API 1.564）。反应的 `against` 可以指定 `"qualities"`：它会响应任何带有其中一种特质的内容，无论是在数值块的行动或其伤害、目录条目还是物品上，也无论行动叫什么。5e 的 Rock Catching 响应 `{"on": "aimed", "cancels": true, "cancelSave": {...}, "against": {"qualities": ["thrown_object"]}}`，每个巨人的 Rock 和投石机的石弹都在其伤害上写 `"qualities": ["thrown_object"]`，也包括规则所说的“类似物体”。为他人作出响应（`for`）的时刻可以写 `"forHolds": [<item tags>]`：只有被代为响应者穿戴或携带带有其中一个标签的物品时，才开放该响应。盾卫的 Shield 写作 `{"on": "hit", "for": "ally", "within": 5, "at": "target", "forHolds": ["shield_guardian_amulet"]}`，因此它只保护佩戴其护符者。使用其中任一项的规则集需要 Capability API 1.564。

目录条目上的对抗，以及移到使用者所选位置的目标（Capability API 1.565）。条目的 `mechanics.contest` 写作 `{"attacker": [<check ids>], "defender": [<check ids>], "ties": "attacker" | "defender"}`：它以对抗替代命中掷骰或豁免（两者都没有），使用者从 `attacker` 中选最佳检定掷骰，每个目标从 `defender` 中选最佳检定掷骰，这些都是 `combat.checks` 的 ID；除非另有指定，平局由防守者获胜。只有对抗获胜的目标才会承受条目的其他任何效果。`mechanics.movesTarget` 写作 `{"distance": <ruleset distance>, "up": true}`：在以一个生物为目标的条目上，将该生物直接放到使用者所选的格子上，该格与生物原位置的距离最多为 `distance`，且在使用者的条目 `range` 内；中间不经过任何一步，因此无人能趁机打击它。带 `up` 时，可以将它抬升至当地地面之上这么多层，`levels x levelCells` 计入距离。被抬升者只有在带 `hover` 的状态托住它时才会留在空中；没有这样的状态，就像其他悬空者一样坠落。选定目标后，棋盘会询问位置，玩家也可以让目标留在原处。5e 的 Telekinesis 写作 `{"kind": "debuff", "range": 60, "contest": {"attacker": ["spellcasting"], "defender": ["strength"]}, "movesTarget": {"distance": 30, "up": true}, "applies": [{"condition": "telekinesis_held", "duration": {"rounds": 1}}], "targetTypes": {"is": {"upToSize": "large"}}}`，搭配 `combat.checks` 条目 `{"id": "spellcasting", "value": {"abilityModFromField": "spellcasting_ability"}}` 和 `{"id": "strength", "value": {"abilityMod": "str"}}`，而 `telekinesis_held` 则是束缚状态的效果加上 `hover`；与其他专注法术一样，用 `repeats` 在每个回合再次使用。使用其中任一项的规则集需要 Capability API 1.565。

抬升持有者的状态（Capability API 1.566）。`combat.conditions` 条目可以写 `"lifts": <ruleset distance>`：状态持续期间，持有者位于脚下地面之上这么远的高度，按棋盘层高取整（至少一层），并悬浮在那里；状态移除时，若无其他效果将其托在空中，就像其他悬空者一样坠落。由持续范围的 `inside.conditions` 施加时，它会抬升范围卷入的每个人，并在范围消失时让他们坠落。5e 的 Reverse Gravity 是一个 `{"inside": {"conditions": ["reverse_gravity"], "save": {"save": "dex_save", "ignoresUntilLeaves": true}}}` 区域，其中敏捷豁免表示抓住某个固定物，搭配 `{"condition": "reverse_gravity", "effects": [], "lifts": 100}`。使用它的规则集需要 Capability API 1.566。

寻找状态施加者以外任何人的检定模式（Capability API 1.567）。状态对 `"checks"` 的调整值带 `mode` 时，可以写 `"exceptSource": true`：它只计入寻找隐藏者的搜寻检定，且仅对未向持有者施加此状态的各个隐藏者生效；持有者的其他所有检定都不受影响。5e 的 Enthrall 写作 `{"condition": "enthralled", "effects": [], "modifiers": [{"to": "checks", "skills": ["perception"], "mode": "disadvantage", "exceptSource": true}]}`，通过该法术的豁免施加。使用它的规则集需要 Capability API 1.567。

召唤影像而非生物（Capability API 1.568）。条目的 `calls` 可以写 `"illusion": true`：召唤出的任何东西都是影像。任何指向影像或以范围卷入影像的效果都会穿过它，对它毫无作用；从此，发起者一方就看穿了它，不会再获得以它为目标的选项，而另一方仍可能受骗。召唤者自己一方绝不会受骗。5e 的 Mislead 是一个以自身为目标的条目，其 `applies` 让施法者隐形，`calls` 则写作 `{"creature": "creatures/illusory-double", "count": {"flat": 1}, "initiative": "after", "commandedWith": "bonus", "illusion": true}`；替身是一个拥有施法者速度和无害行动的生物。Project Image 也相同，只是使用自身的射程和持续时间。使用它的规则集需要 Capability API 1.568。

储存内容在指定时刻自行施放（Capability API 1.569）。`stores`（物品或生物的，1.524）可以写 `"castsOn": {"on": "harmed" | "down", "at": "self" | "source"}`：当持有者（物品则指穿戴者）受到伤害（`harmed`）或生命值降至零但仍活着（`down`）时，储存的第一个条目会自行免费施放，以其自身施法者的数值，作用于持有者（`self`，默认值）或伤害持有者的人（`source`）。它只触发一次，绝不提供手动施放选项。5e 的 Contingency 是一个带 `{"stores": {"catalogs": ["spells"], "levels": 5, "count": 1, "castsOn": {"on": "down"}}}` 的穿戴物品（象牙雕像），配套法术在战斗前通过 `standing` 储存；盾卫的数值块可以写 `{"catalogs": ["spells"], "levels": 4, "count": 1, "castsOn": {"on": "harmed", "at": "source"}}`，表示设定为对打击它的人触发的法术。使用它的规则集需要 Capability API 1.569。

`absorbs` 规则还可以用 `seen: true` 要求持有者看得见被吸收内容的施法者（Ioun Stone of Greater Absorption 的“由你能看见的生物施放”），并用 `spends` 指定一种行动经济额度，要求吸收消耗持有者的 1 点该额度（Rod of Absorption 的反应）。若该额度不足，或看不见施法者，条目就照常生效。`spends` 必须指定 `combat.economy.budgets` 中的一项。使用其中任一项的规则集需要 Capability API 1.570。

穿戴物品的 `absorbs` 还可以用 `lifetime` 累计其整个存在期间吸收的总量（Rod of Absorption 的 50 个等级）。该计数以 `absorbedEver` 保存在物品栏的物品叠上，每场战斗后写回。会使总量超过 `lifetime` 的条目照常生效，消耗其充能绝不会重新腾出容量。只有物品的穿戴效果可以带此项。使用它的规则集需要 Capability API 1.571。

穿戴物品的 `paysSlots` 指定一个资源池组，物品的充能可以支付该组的使用费用，每次充能支付一个等级（Rod of Absorption 的“将权杖中的能量转化为法术位”，即 `"slots"`）。该组的每次使用都会额外提供从物品支付的选项，可以按其自身资源池或充能足够支付的任意更高资源池支付，`payWith` 写作 `itemslot:<item>:<pool>`；以这种方式施放会消耗相应数量的充能，替代资源池。物品需要 `charges`，且必须有某个资源池属于该组。使用它的规则集需要 Capability API 1.572。

物品的 `charges` 可以在 `max` 旁写 `"rolled"` 骰子：每个物品叠被发现时持有这么多充能，而非满充能；每叠只掷骰一次，此后每次读取都相同，数值从 0 到 `max`（Rod of Absorption 的 `{ "max": 50, "rolled": "1d10" }`）。一旦战斗、使用或休息改变了次数，物品叠就改为保留改变后的次数。使用它的规则集需要 Capability API 1.573。

冲锋的 `then.action` 可以指定发起冲锋的行动本身（战马的 Trampling Charge，“再用蹄子攻击一次”）：会再次提供以 `then.budget` 对同一目标使用该行动的选项，且第二次打击不带冲锋。这样做的规则集需要 Capability API 1.574。

物品的 `forms` 让持有者将它变为其他形态并变回：`label` 为它原本的形态命名，`budget` 是战斗中变形所消耗的额度，`into` 最多列出 8 种形态，每种都有 `label` 和另一个 `item`；处于该形态时，它采用那个物品的 `attack`、`worn` 效果和 `toggle`，同时保留自身其他所有内容（使用次数、充能和储存内容）。5e 的 Rod of Lordly Might：`{ "label": "Mace", "budget": "bonus", "into": [{ "label": "Flame tongue", "item": "gear/flame_tongue_longsword" }, { "label": "Battering ram", "item": "gear/lordly_ram" }] }`。战斗中会将其他每种形态作为切换选项提供，物品栏则显示为按钮，物品叠会保留最后所处的形态。每个物品叠只能有一个此类物品，且任何形态自身都不能再变形。使用它的规则集需要 Capability API 1.575。

物品的 `stores` 可以用 `found` 说明被发现时已储存什么：`levels` 为每个物品叠掷一次的骰子（Ring of Spell Storing 的 `"1d6-1"`），`from` 最多列出其自身目录的 40 个条目，每个都带有储存时的 `level` 和可选的 `label`。每个物品叠都会为此列表随机确定一个顺序，依次放入仍能容纳的各条目，最多到其 `count`。物品栏会显示储存内容，战斗中可以施放；一旦在战斗中存入或施放出其中内容，物品叠就保留剩余内容，即使已空也一样。使用它的规则集需要 Capability API 1.576。

状态规则可以写 `controls: true`：持有此状态者会加入施加此状态的生物一方战斗，状态结束或来源倒下时回到自己一方。带 `holderDies`、`save` 和 `difficulty`（值引用）时，受控生物死亡就会让来源进行该豁免，失败则来源也倒下，就像 Magic Jar 的施法者会随其占据的躯体被杀而死亡一样。日志会说明何时取得控制、何时解除控制。使用它的规则集需要 Capability API 1.577。

对抗可以写 `actorHolds`，最多列出四种状态：只有持有全部这些状态的参战者才会获得此对抗选项，例如专长的 `keepsOn` 给予的状态。Grappler 专长的压制只提供给拥有该专长者，带 `targetHeldBySelf` 时还只能用于自己擒抱的生物。使用它的规则集需要 Capability API 1.578。

区域的 `inside.save` 可以写 `"onCast": true`：区域施放时位于其中者会立即进行该豁免，先于状态的施加；成功者会忽略区域内部效果，直到离开，与之后豁免成功者相同。5e 的 Reverse Gravity：法术施放时通过敏捷豁免的生物会抓住某个固定物，绝不会被抬升。使用它的规则集需要 Capability API 1.579。

区域的阶段可以写 `"breaksConcentration": true`：在该阶段持续期间，任何在区域内开始回合且正在专注的人，都须以规则集的专注豁免对抗条目自身的豁免难度，若条目没有难度则用 10，失败就失去专注。带 `"disperses": true` 时，该阶段持续期间区域视为风：它所触及的带 `dispersed` 的雾会结束，与带 `disperses` 的区域将雾结束相同。5e 的 Storm of Vengeance，第 5 到 10 轮。使用它的规则集需要 Capability API 1.580。

区域可以写 `"turnsShots": {}`：任何使用非魔法武器的远程攻击（需要攻击掷骰、没有范围、不是法术、不带 `magical` 特质）都不能向其格子内、向外或穿过其格子发动，与风暴阶段的 `noRanged` 类似。其 `spares` 按标签指定仍能穿过的攻击，最多 12 项。5e 的 Wind Wall，`{"turnsShots": {"spares": ["Rock"]}}` 允许巨人投掷的巨石穿过。使用它的规则集需要 Capability API 1.581。

条目的 `save` 可以写 `"advantageIfFought": true`：战斗中处于使用者敌对一方、即使用者或其同伴正在与之作战的目标，进行此豁免时具有优势。5e 的 Charm Person 和 Enthrall。使用它的规则集需要 Capability API 1.582。

物品的 `use`，
以及其每个 `moreUses` 的 `use`，
都可以像
目录条目一样，
将 `repeats` 与 `concentration` 一起使用：
只要使用者
保持对它的专注，
就会再次提供按 `repeats.budget` 使用的选项，
按最初使用时的
费用等级结算，
不再消耗
物品的
任何资源。
5e 的 Telekinesis、Vampiric Touch、Call Lightning 和 Heat Metal 卷轴，
以及 Staff of the Magi 的 Telekinesis。
使用它的规则集
需要 Capability API 1.583。

`combat.conditions` 条目可以写 `endsWhenSource`：只要施加者产生其中一种 `effects` 或持有其中一种 `conditions`，或有东西阻止施加者使用其中一种 `components`（如 Silence 阻止 `verbal`），或持有者缺少其中一种 `holderLacks` 感官，此状态就移除。感官可以是已声明的战斗感官，也可以是某状态的 `lacks` 指定的感官，如 5e 的耳聋指定 `hearing`。5e 的 Enthrall 在施法者失能或无法说话时结束，且只对能听见施法者的人生效：`{"effects": ["cannot-act"], "components": ["verbal"], "holderLacks": ["hearing"]}`。使用它的规则集需要 Capability API 1.584。

`combat.conditions` 条目可以写 `countsAs`，最多列出它视同的四种其他状态：对其中一种的免疫会阻止它施加（`conditionImmunities` 和 `conditionImmunitiesFrom`），能 `suppresses` 其中一种的效果也会压制它，针对其中一种的豁免也算针对它的豁免（因此对抗魅惑的豁免优势也适用于它），指定其中一种的 `ends` 也会将它结束。5e 的 Enthrall 和 Geas，`"countsAs": ["charmed"]`。使用它的规则集需要 Capability API 1.585。

生物行动可以写 `"callerAdds": false`：对于以 `fromCaller.adds` 召唤的生物，该行动的伤害不会获得任何来自召唤者的加值。带 `perCallerStep` 时，其值为一个数量（与行动自身伤害骰同种的骰子、固定数值或两者），召唤支付的费用每高于基础一级，就多造成这么多伤害。5e 的 Arcane Hand 的 Clenched Fist，`{"damage": {"dice": "4d8", "type": "force"}, "callerAdds": false, "perCallerStep": {"dice": "2d8"}}`。使用它的规则集需要 Capability API 1.586。

对抗可以写 `advantageAtMostSize`，指定 `combat.sizes` 中的一种大小：行动者对不大于该大小的目标掷骰时具有优势。其 `onWin` 可以写 `pushRead`，从行动者的人物卡读取一个值；若是没有自身人物卡的召唤生物，则从召唤者的人物卡读取。该值以规则集的距离单位计，加到 `push` 上。5e 的 Arcane Hand 的 Forceful Hand 是只有该手能进行的对抗（`actorHolds` 指定其数值块的 `keepsOn` 持续施加的状态），带 `"advantageAtMostSize": "medium"` 和 `{"onWin": {"push": 5, "pushRead": <five times the spellcasting modifier>}}`；其 Grasping Hand 是另一种这样的对抗，用该手自身的力量进行擒抱。使用它的规则集需要 Capability API 1.587。

战斗状态可以写 `coverFor`（`{"tier": "half" | "three-quarters", "who"?: "source" | "caller"}`）：只要施加者仍站着，持有者对施加者的攻击，或带 `"who": "caller"` 时对召唤施加者的生物的攻击，都会遇到至少该档位的掩护；被攻击者针对持有者效果进行的、被 `cover.saves` 指定的豁免也享有同样的掩护。5e 的 Arcane Hand 的 Interposing Hand 对其挡在前面的生物施加带 `{"tier": "half", "who": "caller"}` 的状态。它需要 `combat.cover`。使用它的规则集需要 Capability API 1.588。

`combat.languages` 可以写 `split`，最多指定四个分隔符：每行前缀后的文本会按任一分隔符拆成多种语言，因此用 5e 的 `[", ", " and "]` 时，种族的一行“语言：通用语和矮人语”就表示两种语言。若角色人物卡上没有任何一行指定语言，现在会将其视为语言未写明，不会排除任何人，与不带 `languages` 的数值块相同。使用 `split` 的规则集需要 Capability API 1.589。

穿戴物品的 `paysSlots` 现在只为持有者拥有的资源池支付费用（人物卡上的 `max` 大于 0），还可以写 `paysSlotsMax`，指定该组中的一个资源池：不提供超出该资源池的选项。5e 的 Rod of Absorption，“等级等于或低于你自身的法术位，最高为 5 级”，写作 `{"paysSlots": "slots", "paysSlotsMax": "slots_5"}`。使用 `paysSlotsMax` 的规则集需要 Capability API 1.590。

`rolled` 召唤的选项可以写 `rounds`（召唤出的生物在这么多轮后离开，替代召唤自身的轮数）、`spendsItem`（该选项一旦出现，掷出它的物品就永久耗尽，不再提供其任何使用选项）或 `pastLifetime`。在物品使用上，召唤可以写 `keepsRoll`（首次掷骰的结果保存在物品上，以后每次使用都出现同一个选项）和 `lifetimeUses`（在物品整个存在期间使用达到这么多次后，以后每次使用都采用其唯一的 `pastLifetime` 选项，绝不掷骰）。保留的结果、已使用次数和是否耗尽，都会在战斗后留在物品上。5e 的 Efreeti Bottle：`{"rolled": true, "keepsRoll": true, "lifetimeUses": 3, "options": [{"creature": "...", "weight": 1, "hostile": true, "rounds": 5, "spendsItem": true}, {"creature": "...", "weight": 8}, {"none": true, "weight": 1, "label": "Three wishes", "spendsItem": true}, {"none": true, "label": "It escapes", "pastLifetime": true, "spendsItem": true}]}`。使用其中任一项的规则集需要 Capability API 1.591。

目录条目或物品使用的 `save` 可以写 `failedBy`（`{"atLeast": 5, "applies": [...]}`），与光环的豁免自 1.268 起支持的写法相同：失败差值至少达到该数值时，施加其中的状态，替代条目的 `applies`。5e 的 Wand of Wonder，失败差值为 5 或更多时直接石化，其他失败则束缚：`{"applies": [{"condition": "restrained"}], "save": {"save": "con_save", "onSuccess": "negates", "failedBy": {"atLeast": 5, "applies": [{"condition": "petrified"}]}}}`。使用它的规则集需要 Capability API 1.592。

目录条目或物品使用的机制可以写 `amountTimes`（2 到 100），将其 `amount` 的掷骰结果乘以该数值；也可以写 `"dividedAmong": "caught"`，将总量平均分给其 `area` 卷入的生物，向下取整，不作攻击掷骰或豁免。5e 的 Wand of Wonder 的宝石，“1d4 × 10 颗宝石……宝石的总伤害平均分给直线内的所有生物”：`{"area": {"shape": "line", "size": 30, "width": 5}, "amount": {"dice": "1d4"}, "amountTimes": 10, "dividedAmong": "caught", "damageType": "bludgeoning"}`。使用其中任一项的规则集需要 Capability API 1.593。

目录条目的机制可以写 `targetsWithinFirst`，指定一个距离：第一个之后选定的每个生物都必须站在距第一个所选生物不超过该距离的地方，而 `targetsWithin` 则要求每一对目标都满足该距离（条目只能使用两者之一）。5e 的 Chain Lightning，“另外三个目标，每个都必须在第一个目标的 30 英尺内”：`{"targetCount": 4, "targetsWithinFirst": 30}`，第一个指定的生物就是其第一个目标。允许两次跳跃分别位于第一个目标两侧、彼此相距 50 英尺；距第一个目标 35 英尺的目标会因站得太远而被拒绝。使用它的规则集需要 Capability API 1.594。

区域的 `keepsOut` 可以写 `"reach": true`：被它阻止进入者也不能穿过它触及内部。位于外部的此类生物不能用触及范围不超过最小触及范围（一格）的近战攻击打击内部的人，也不能在内部的人移动时趁其经过进行打击；远程攻击、触及范围更长的武器和法术仍可穿过。带 `"endsOnSweep": true` 时，围绕施法者（`anchor: "caster"`）或被携带的区域，只要它所围绕者移动，导致区域覆盖了被它阻止进入者，就立即结束（日志记录为已结束）。5e 的 Antilife Shell，“阻止受影响的生物穿过屏障或穿过它触及内部……如果你移动，导致受影响的生物被迫穿过屏障，法术就结束”：`{"area": {"shape": "burst", "size": 10}, "zone": {"anchor": "caster", "keepsOut": {"is": {"except": {"types": ["undead", "construct"]}}, "reach": true, "endsOnSweep": true}, ...}}`。使用其中任一项的规则集需要 Capability API 1.595。

战斗状态的 `hangsOn` 可以写 `"ends": true`：它一旦生效，所属状态就结束（不允许用于生物或等级）。带 `"outright": true` 时，它还会对本会不造成伤害而直接杀死持有者的效果生效：条目的 `kills`、`killsAtMost`、失败即致死的豁免，或造成摧毁的档位。该效果被撤销，任何部分都不生效，日志会说明持有者免于被直接杀死；与维持在 1 点生命值时一样，这也计为一次使用，并消耗资源池。它不读取打击，因此不带 `save`、`notFrom`、`notCritical` 和 `dealtAtMost`。5e 的 Death Ward，“目标第一次因受到伤害而本应降至 0 点生命值时，改为降至 1 点生命值，法术随之结束。如果法术仍在生效，目标遭受一个不造成伤害就会将其立即杀死的效果，则该效果对目标无效，法术随之结束”：状态上的 `{"hangsOn": {"uses": 1, "ends": true, "outright": true, "label": "Death Ward"}}`。使用其中任一项的规则集需要 Capability API 1.596。

更多对抗（Capability API 1.597）。`combat.contests` 的条目上限从 12 增至 16。声明超过 12 个条目的规则集需要 Capability API 1.597。

对抗的 `onWin` 可以在 `push` 旁写 `"follows": true`：胜者随被推开者一起移动，进入后者在途中最后离开的格子，以保持在其身旁；若胜者宽于一格，或那里容不下它，则移到对方身旁、离自己原位置最近的空地。与推开本身一样，这不会招致打击；若身旁没有空间，则留在原处。5e 的 Arcane Hand 的 Forceful Hand，“手随目标移动，以保持在其 5 英尺内”：`{"onWin": {"push": 5, "pushRead": {...}, "follows": true}}`。使用它的规则集需要 Capability API 1.598。

战斗状态的 `endsWhenSource` 可以写 `"acts": true`：一旦施加者再采取任何行动，除移动、反应或结束回合外，此状态就移除。再次使用同一行动时，会在该行动指定的目标上重新施加此状态。5e 的 Arcane Hand 的 Interposing Hand，“直到你给手下达不同的命令”：`{"condition": "interposed", "endsWhenSource": {"acts": true}, "coverFor": {...}}`。使用它的规则集需要 Capability API 1.599。

生物可以写 `passableBy`（`{"ability": "str", "above": 26, "difficult": true}`）：敌人只有在该属性分值高于 `above` 时才能穿过其空间；带 `difficult` 时，该空间对敌人难以通行，每格花费加倍。没有此项时，只有大小规则允许，敌人才能通过。`"fillsSpace": false` 表示它不占满自身空间的任何部分：友方可以在其中停留，被它允许通过的敌人也可以；被推开、放下或移到某人身旁的目标也可以停在那里。5e 的 Arcane Hand，“如果目标的力量分值小于或等于手的力量分值，就不能穿过手的空间。如果目标的力量分值更高……该空间对目标属于困难地形……手并不占满自身空间”：`{"passableBy": {"ability": "str", "above": 26, "difficult": true}, "fillsSpace": false}`。使用其中任一项的规则集需要 Capability API 1.600。

战斗状态的 `behavior` 可以在 `only` 旁写 `"actions": true`：该状态自身的 `actions` 也会保留为可用选项，而原本 `only` 会把它们与其他所有行动一起筛掉。5e 的 Wind Walk，“生物在此形态下只能采取疾走行动或恢复正常形态”：`{"condition": "wind_walking", "actions": ["spells/wind-walk-revert"], "behavior": {"only": ["move", "dash"], "actions": true}}`。它需要 `only` 和状态自身的行动。从 1.601 起，唯一效果为 `endsCondition` 的 `utility` 条目也会作为行动提供，因此恢复原形可以写作 `{"kind": "utility", "targets": "self", "endsCondition": "wind_walking"}`。使用它的规则集需要 Capability API 1.601。

墙的 `area`，无论属于目录条目还是物品使用，都可以在 `ring` 旁写 `"ringOnly": true`：它始终按该环形布置，绝不布置成直墙。另外，无论是墙还是其他区域，区域的 `blocks` 都可以指定 `"spells"`：不能向其格子内、向外或穿过其格子施放任何法术。以另一侧的人为目标的法术会因施法线路受阻而被拒绝，范围法术不能瞄准区域内部，瞄准其旁边的范围法术则在其边缘止步。武器不受阻挡，从内部对内部其他人施放的法术也不受阻挡。只阻挡法术的区域不会让任何格子无法行走或遮挡视线，也不需要触发条件。5e 的 Forcecage，笼形写作 `{"area": {"shape": "wall", "size": 80, "ring": 20, "ringOnly": true}, "zone": {"blocks": ["move"]}}`，箱形写作 `{"area": {"shape": "box", "size": 20}, "zone": {"blocks": ["spells"]}}`。使用其中任一项的规则集需要 Capability API 1.602。

区域的 `forbids.teleport` 可以用 `{"save": "<save id>", "difficulty": "caster"}` 代替 `true`：这样，内部生物传送出去前，必须先以该豁免对抗创建区域的条目的难度。成功则离开。失败则留在原处，日志会说明，且使用次数照样消耗（它本会带走的人也都不会离开）。与他人一起被带出区域的每个生物都各自进行豁免。在区域内传送或传送进区域不受阻止，通过豁免后通过传送离开战斗也不受阻止。布置成环形的墙包含其围住的所有格子，因此环中央也算内部。5e 的 Forcecage：`{"forbids": {"teleport": {"save": "cha_save", "difficulty": "caster"}}}`。使用它的规则集需要 Capability API 1.603。

条目的 `repeats` 可以写 `"afterTargetDown": true`：只有上次施放所指向的所有人都倒下后（生命值为 0 或已退出战斗），才会提供重复使用选项，仍不收取费用。使用后，该条目的 `applies` 施加在那些生物身上的状态会移除，并转移到新目标上，之后就改为等待这个新目标倒下。它需要 `applies`，且不能与 `sameTargets` 一起使用。5e 的 Hunter's Mark，“如果目标在法术结束前降至 0 点生命值，你可以在之后自己的某个回合用一个附赠动作标记新的生物”：`{"repeats": {"budget": "bonus", "afterTargetDown": true}}`。使用它的规则集需要 Capability API 1.604。

战斗状态可以写 `"heldOnlyIn": {"light": [...]}`，其中可使用 `sunlight`、`bright`、`dim` 和 `dark` 的任意组合：只有持有者站在其中一种光照下时，状态才生效，按其站立位置读取光照，方式与 `checkModes.light` 相同。在其他任何地方，状态都会被压制而非结束，回到该光照下就会再次生效。5e 的幽影的 Sunlight Weakness 是带 `own-attacks-disadvantage`、`own-checks-disadvantage` 和 `own-saves-disadvantage` 的持续生效状态：`{"heldOnlyIn": {"light": ["sunlight"]}}`。使用它的规则集需要 Capability API 1.605。

生物的行动可以像目录条目一样（1.247），写 `"free": true` 和 `"beforeAttack": true`：它不消耗额度，且仅在生物自己的回合、该回合尚未发动攻击时提供。Engine 操控该生物时，会在发动近战武器攻击前立即采取一个作用于自身（`self`）的免费 `beforeAttack` 行动，绝不会用它替代攻击。5e 的狂战士和牛头人的 Reckless：`{"id": "reckless", "name": "Reckless", "budget": "action", "free": true, "beforeAttack": true, "self": true, "applies": [{"condition": "reckless", "duration": {"rounds": 1}}, {"condition": "exposed", "duration": {"rounds": 1, "at": "turn-start"}}]}`。使用其中任一项的规则集需要 Capability API 1.606。

生物的 `move` 可以写 `"toward": "seen-hostile"`：移动的每一步都必须让该生物更靠近一个它能看见的敌对生物；如果看不见任何敌对生物，就不移动。如果行动除了移动以外什么也不做，这种移动就不需要 `signature`：生物在自己的回合内用该行动的 `budget` 执行，在棋盘上像行走一样选取位置，并保留该回合本身的移动。5e 兽人的 Aggressive：`{"id": "aggressive", "name": "Aggressive", "budget": "bonus", "move": {"toward": "seen-hostile"}}`。由 Engine 操控的生物会像评估传奇移动一样评估它。使用它的规则集需要 Capability API 1.607。

战斗状态或条目 `applies` 施加的状态上，`endsWhenHolder` 可以写 `"incapacitated": true`：持有者一旦带有任何含 `cannot-act` 的状态，该状态就会移除。状态的光环还可以写 `"seenByHolder": true`：除了持有者自身以外，它只作用于持有者能看见的对象。光环的 `targetTypes.understands`(1.561) 读取持有者自身的语言。5e 骑士的 Leadership 是对自身施加、持续十轮的状态：`{"condition": "leadership", "endsWhenHolder": {"incapacitated": true}, "auras": [{"distance": 30, "side": "allies", "self": true, "needs": ["hearing"], "seenByHolder": true, "targetTypes": {"understands": true}, "conditions": ["led"]}]}`。使用其中任一项的规则集需要 Capability API 1.608。

区域的 `obscures` 可以写 `"notForCaster": true`：它会遮蔽施法者以外所有人的视线；无论施法者具有什么感官，都能看穿它。5e 的 Staff of Swarming Insects 的 Insect Cloud，以施法者为锚点、半径为 30 英尺：`{"zone": {"anchor": "caster", "obscures": {"dispersed": true, "notForCaster": true}}}`。使用它的规则集需要 Capability API 1.609。

召唤（目录条目、物品或生物行动的召唤）可以写 `"leash": <distance>`：召唤者与被召唤生物的距离一旦超过此值，该生物就会离开。生物行动的 `calls.dismissible` 可以是 `{"budget": "<id>"}`，让召唤者用该额度遣散它们，而不是用该行动自身的额度。5e 树人的 Animate Trees，树木可以用附赠动作遣散，也会在树人离开超过 120 英尺时离开：`{"calls": {"creature": "monsters/animated_tree", "count": {"flat": 2}, "endsWithCaller": true, "dismissible": {"budget": "bonus"}, "leash": 120, "rounds": 14400}}`。使用其中任一项的规则集需要 Capability API 1.610。

目录条目或物品的 `calls` 可以写 `"hostileUnless": {"derived": "<id>", "atLeast": N}`：除非使用者的派生值至少为 N，否则召唤出的生物会加入另一方，与使用者为敌，与掷骰召唤的 `hostile` 选项相同。5e 黄铜制的 Horn of Valhalla 要求熟练使用所有简易武器：`{"calls": {"creature": "monsters/berserker", "count": {"dice": "3d4"}, "rounds": 600, "hostileUnless": {"derived": "proficient_simple_weapons", "atLeast": 1}}}`。使用它的规则集需要 Capability API 1.611。

物品的 `calls` 可以写 `"spendsItemOnDeath": true`：召唤出的生物一旦死亡，物品就会永久消耗，与掷骰选项的 `spendsItem` 相同。物品的 `recharge.after`（用于其充能或额外使用方式的使用次数）还可以写 `"fromDeparture": true`：只有该使用方式召唤出的生物离开后，等待时间才开始计算；战斗结束后剩余的 `rounds`，会用战斗新增的 `combat.roundSeconds`（一轮持续的秒数；5e 为 6）折算为游戏时间，`fromDeparture` 需要它。5e 的 Ring of Djinni Summoning 每天可用一次，并会随其巨灵永久消失：`{"combat": {"roundSeconds": 6}}` 和 `{"charges": {"max": 1, "recharge": {"rests": [], "amount": "max", "after": {"hours": {"flat": 24}, "fromDeparture": true}}}, "use": {"calls": {"creature": "monsters/djinni", "count": {"flat": 1}, "rounds": 600, "spendsItemOnDeath": true}}}`。使用这三项中任一项的规则集需要 Capability API 1.612。

物品的 `calls` 可以写 `"becomesItem": true`：物品本身就是召唤出的生物，只要该生物仍站着，物品就不在持有者手中，因此不会提供它的任何使用方式或打击（也不能再召唤另一个生物）。目录条目或物品的 `calls` 还可以像生物行动一样写 `"dismissible": true`：使用者会获得一个将它们遣散的行动，使用条目或使用方式本身的额度；也可以用 `{"budget": "<id>"}` 指定该额度。5e 的 Staff of the Python 变成一条使用自身先攻的蛇，可以用附赠动作变回，并会在蛇死亡时碎裂：`{"calls": {"creature": "monsters/giant_constrictor_snake", "count": {"flat": 1}, "becomesItem": true, "dismissible": {"budget": "bonus"}, "spendsItemOnDeath": true}}`。在倒下前变回的蛇会恢复全部生命值，因为每次召唤都是全新的生物。使用其中任一项的规则集需要 Capability API 1.613。

生物行动的 `calls`，或召唤的任意一个 `options`，可以写 `"onlyWhere"`：只有召唤者所站位置不处于 `"notLight"` 中任何一种光照下时才会提供（光照的读取方式与 `regenerates.notIn` 相同）；带 `"outdoors": true`（或 `"indoors": true`）时，还要求棋盘的地点在室外（或室内）。地下城、洞穴、城堡、宇宙飞船和宅邸都属于室内；其他所有地点，以及未指定地点的棋盘，都属于室外。生物行动的 `calls` 还可以写 `"arrivesIn": {"dice": "1d4"}`：召唤时掷骰，召唤者开始了相应数量的回合后，召唤出的生物才会出现。5e 吸血鬼的 Children of the Night：`{"calls": {"options": [{"creature": "monsters/swarm_of_bats", "count": {"dice": "2d4"}, "onlyWhere": {"notLight": ["sunlight"]}}, {"creature": "monsters/swarm_of_rats", "count": {"dice": "2d4"}, "onlyWhere": {"notLight": ["sunlight"]}}, {"creature": "monsters/wolf", "count": {"dice": "3d6"}, "onlyWhere": {"notLight": ["sunlight"], "outdoors": true}}], "arrivesIn": {"dice": "1d4"}, "rounds": 600}}`。使用其中任一项的规则集需要 Capability API 1.614。

目录条目或物品的 `calls` 可以写 `"side": "none"`：召唤出的生物不受任何人控制。它们每个回合只会沿最短的畅通路线向召唤者行走，也不会让任何一方因它们仍站着而继续战斗。带 `"tamedWhile": "<condition>"` 时，带有该状态的生物会在状态持续期间听从召唤者指挥，与其他被召唤生物相同。5e 的 Pipes of the Sewers 需要三种使用方式。第一种是消耗 1 到 3 点充能的附赠动作，每点充能召唤一个鼠群：`{"charges": 1, "chargeStep": {"max": 2}, "calls": {"creature": "monsters/swarm_of_rats", "count": {"flat": 1}, "perStep": 1, "side": "none", "tamedWhile": "piped"}}`。第二种是演奏，在对抗（1.565）中战胜它召唤出（`targetTypes.calledBySelf`，1.487）、位于 30 英尺内的一个鼠群，为其施加一轮的 `piped`：`{"contest": {"attacker": ["cha"], "defender": ["wis"]}, "applies": [{"condition": "piped", "rounds": 1}]}`。第三种是每轮用一个行动维持演奏（`sustains`，1.431）。使用 `side` 或 `tamedWhile` 的规则集需要 Capability API 1.615。

条目的 `applies[].duration` 可以在 `rounds` 旁写 `"remainingOf": "<condition>"`：该状态的持续时间，不会超过目标身上指定状态上次在到期前移除时的剩余时间；从那时起，每过一轮就扣除一轮，且最多为 `rounds`。只有还剩时间、并且使用者两种状态都没有时，才会提供该条目。5e 的 Wind Walk，用一分钟重新化为云雾，持续法术 8 小时中剩余的时间：`{"targets": "self", "castingRounds": 10, "applies": [{"condition": "wind_walking", "duration": {"rounds": 4800, "remainingOf": "wind_walking"}}]}`。使用它的规则集需要 Capability API 1.616。

目录条目的机制、物品的 `use` 或额外使用方式可以写 `"userHolds": ["<condition>", ...]`：只有使用者带有其中一种状态时才会提供。战斗状态的 `endsWhenSource` 还可以写 `"lacks": ["<condition>", ...]`：施加者不带其中任何状态时，该状态就会移除。5e 的 Pipes of the Sewers，一种名为“Play”的使用方式，为使用者施加一轮的 `piping`；召唤和操控带 `"userHolds": ["piping"]`，操控施加的 `piped` 则带 `{"endsWhenSource": {"lacks": ["piping"]}}`。使用其中任一项的规则集需要 Capability API 1.617。

条目或物品使用的 `contest`(1.565) 可以写 `"onLose": {"applies": [{"condition": "<id>", "rounds": N}, ...]}`：使用者在对抗中输给某个目标时，会给该目标施加这些状态，以使用者为来源，各自持续所写的轮数；之后，指定了其中一种状态的 `targetTypes.not.holding` 会排除该目标。战斗状态的 `endsWhenHolder` 还可以写 `"cantHearSource": {"sense": "<sense>"}`，并可加上 `"beyond": <distance>`：持有者开始回合时，如果缺少该感官、与施加者的距离超过 `beyond`，或者施加者已离开或倒下，该状态就会移除；其 `onEnd` 也会照常生效。5e 的 Pipes of the Sewers：操控的 `{"contest": {..., "onLose": {"applies": [{"condition": "pipes_spurned", "rounds": 14400}]}}, "targetTypes": {"not": {"holding": ["pipes_spurned"]}}}`，以及带 `{"endsWhenHolder": {"cantHearSource": {"sense": "hearing"}}, "onEnd": {"applies": [{"condition": "pipes_spurned", "duration": {"rounds": 14400}}]}}` 的 `piped`。使用其中任一项的规则集需要 Capability API 1.618。

物品在穿戴时（或携带时，或穿戴者未满足其要求时）的效果可以写 `"ignoredBy": {"entries": ["<catalog>/<entry>", ...]}`：由这些生物图鉴条目之一创建的生物，绝不会以穿戴者为目标，Engine 也不会操控它攻击穿戴者。带 `"untilHarmed": true` 时，如果穿戴者攻击它、伤害它、与它对抗或迫使它作豁免，它在这场战斗余下的时间里就会重新以穿戴者为目标。5e 的 Pipes of the Sewers，在同调后穿戴：`{"worn": {"ignoredBy": {"entries": ["creatures/rat", "creatures/giant-rat", "creatures/swarm-of-rats"], "untilHarmed": true}}}`。使用它的规则集需要 Capability API 1.619。

目录条目或物品的 `calls` 可以写 `"commandedWithin": <distance>`：每个被召唤生物开始回合时，只有召唤者仍站着、能够行动（不带任何含 `cannot-act` 的状态），并且在有棋盘时与它的距离不超过该值，才由召唤者指挥。否则该生物在该回合自行行动，由 Engine 操控，即使玩家已接管它也是如此；它会保护自己并攻击召唤者的敌人，而带 `commandedWith` 时，召唤者无需为该回合支付任何费用。5e 的 Staff of the Python：`{"calls": {"creature": "creatures/giant-constrictor-snake", "commandedWith": "bonus", "commandedWithin": 60}}`。使用它的规则集需要 Capability API 1.620。

召唤（生物行动、目录条目或物品的召唤）可以写 `"within": {"distance": <distance>}`，并可加上 `"seen": true`：召唤出的生物会放在与召唤者距离不超过该值的空格子上；带 `seen` 时只会放在召唤者能看见的格子上，并优先选取最靠近召唤者敌人的格子。没有棋盘时，不会改变任何行为。5e 树人的 Animate Trees：`{"calls": {"creature": "creatures/animated-tree", "count": {"flat": 2}, "leash": 120, "within": {"distance": 60, "seen": true}}}`。使用它的规则集需要 Capability API 1.621。

战斗状态
可以
写
`"endable": {"budget": "<budget>"}`：
只要
持有者
仍然
带有
该状态，
就会
向
持有者
提供
一个
“End”
选项，
并
在
该选项上
显示
该状态的
标签。
选择
它
会
花费
指定
额度
中的
1
次，
并
移除
该状态；
这与
条目的
`endsCondition`
作用
相同
（用于
维持
该状态的
专注
也会
随
状态
一起
结束）。
5e
的
Ring of Invisibility，
`{"condition": "ring_invisible", "effects": [...], "endable": {"budget": "bonus"}}`，
以及
Potion of Gaseous Form
和
Boots of Speed。
使用
它的
规则集
需要
Capability API 1.622。

物品的 `use` 或额外使用方式可以写 `"chargesPerRound": true`：它施加的状态会持续到物品充能耗尽。该使用方式仍像往常一样支付自身的 `charges`，用于第一轮；之后状态持续的每一轮，每当状态的计时扣除一轮，就再消耗一点充能，最后一点消耗时状态就会移除。如果提前结束（例如通过 `endable`），剩余充能会保留供下次使用。5e 的 Boots of Speed，物品带 `"charges": 100`（按轮计的 10 分钟），使用方式为 `{"kind": "buff", "targets": "self", "budget": "bonus", "charges": 1, "chargesPerRound": true, "applies": [{"condition": "boots_of_speed", "duration": {"rounds": 100}}]}`。使用它的规则集需要 Capability API 1.623。

物品的 `charges` 可以写 `"overuse": {"chance": <1-100>, "cumulative": true}`：充能全部耗尽后，仍会提供其使用方式，每次在没有充能时使用都会掷一次 d100。如果点数不高于 `chance`，物品就会碎裂并永久消失，且该次使用不产生效果；带 `cumulative` 时，自上次充能恢复以来，每次这样的使用都会让概率再增加相同数值（先是 20，然后是 40，再是 60）。次数记录在物品叠上，并在休息或等待恢复充能时重新计数。5e 的 Wind Fan，`{"max": 1, "recharge": {"rests": ["long"], "amount": "max"}, "overuse": {"chance": 20, "cumulative": true}}`。使用它的规则集需要 Capability API 1.624。

以轮计的持续时间可以写 `"times": "<dice>"`：施加时掷骰，持续时间为 `rounds` 乘以掷出的数值。5e 的 Potion of Growth，“1d4 小时”，写作 `{"rounds": 600, "times": "1d4"}`。骰子可能掷出的最大值乘以 `rounds`，不得超过一天（14400 轮）。使用它的规则集需要 Capability API 1.625。

在 `"caught"` 时刻执行的条目或物品使用，可以写 `"keepsCaught": true` 或 `{"otherwise": "<catalog>/<entry>"}`：持有者会留下刚刚接住的投射物。如果它是射击者自身携带的弹药之一，留下的就是该物品，射击者在战斗结束后不会再回收它；否则（如生物自身的箭），留下的是 `otherwise` 指定的物品，未指定则不留下任何东西。它会加入接住者包内同种物品的物品叠，或与其他物品并列成为新的一叠，并与战斗中的其他物品一起写回。它本身不造成任何伤害；带 `"free": true` 时不消耗反应，因为它属于将投射物伤害减至零的那个反应的一部分。5e 的 Gloves of Missile Snaring，`{"kind": "utility", "targets": "self", "free": true, "reaction": {"on": "caught", "freeSlot": "hand"}, "keepsCaught": {"otherwise": "gear/arrow"}}`。使用它的规则集需要 Capability API 1.626。

条目或物品使用若在其对使用者施加的状态持续期间 `dismisses` 使用者自身，带 `"turns": true` 时，会让使用者离开战斗但仍继续执行自己的回合；如果该状态带 `endable`，这些回合上就会提供其“End”选项，选择后会返回离开时的位置，或最近的空位。5e 的 Robe of Stars，“用一个行动进入星界……直到用一个行动返回”：`{"kind": "buff", "targets": "self", "budget": "action", "applies": [{"condition": "astral", "duration": "until-dispelled"}], "dismisses": {"while": "astral", "turns": true}}`，配合战斗状态 `{"condition": "astral", "effects": [], "endable": {"budget": "action"}}`。使用它的规则集需要 Capability API 1.627。

物品的 `use`（或额外使用方式）可以像目录条目一样写 `needs` 和 `needsAny`：只有具备这些感官的生物才会受到影响。`oncePerTarget` 还可以用于带 `area` 的条目或使用方式：自使它恢复可用的休息以来已经对其使用过的对象，会被该范围跳过；带 `whenSaved` 时，只会标记通过豁免的对象。5e 的 Pipes of Haunting，`{"kind": "debuff", "area": {"shape": "burst", "size": 30, "around": true}, "friendlyFire": false, "needs": ["hearing"], "save": {...}, "applies": [...], "oncePerTarget": {"until": "long", "whenSaved": true}}`：只影响听得到它的敌对生物，通过豁免的生物会免疫，直到一次长休息后。（`friendlyFire: false` 已经会跳过使用者自己的一方。）使用其中任一项的规则集需要 Capability API 1.628。

造成伤害的条目或物品使用可以写 `amountAgainst: {"is": {...}, "amount": {"dice": "10d6"}}`：符合 `is` 指定条件的目标受到该数值的伤害，替代条目自身的伤害量（若 `maxAgainst` 也指定了该目标，则取最大值，骰子不掷）。配合 `save.modes`(1.185)，还会让目标的豁免具有劣势。5e 的 Horn of Blasting，`{"kind": "attack", "amount": {"dice": "5d6"}, "damageType": "thunder", "save": {"save": "con_save", "onSuccess": "half", "modes": [{"is": {"tags": ["glass", "crystal"]}, "mode": "disadvantage"}]}, "amountAgainst": {"is": {"tags": ["glass", "crystal"]}, "amount": {"dice": "10d6"}}}`。使用它的规则集需要 Capability API 1.629。

物品的 `use`（或额外使用方式）可以写 `backfires: {"chance": 20, "amount": {"dice": "10d6"}, "damageType": "fire", "destroys": true}`：每次使用时掷一次 d100，若点数不高于 `chance`，就对使用者造成 `amount` 的伤害；带 `destroys` 时，物品还会永久消失。该次使用仍会生效，除非写了 `instead: true`，此时只发生反噬。5e 的 Horn of Blasting 就是这样爆炸的。使用它的规则集需要 Capability API 1.630。

带 `area` 和 `save` 的条目或物品使用可以写 `pushesOutSaved: true`：范围内通过豁免的对象，会沿直线远离瞄准的位置（若是围绕使用者的爆发，则远离使用者），直到其占据的所有格子都不在范围内；推离距离受路径是否畅通限制。5e 的 Bead of Force，一个 10 英尺的球体，通过豁免者“会被推离球心，直到不再位于球体内”，而失败者会被封在里面（通过 `applies` 施加带 `sealed` 的状态）。封在其中的生物以自身一半速度滚动球体，用封闭状态的 `"sealed": {"rolls": {"budget": "action", "share": 0.5}}`(1.314) 表示。使用它的规则集需要 Capability API 1.631。

战斗状态的 `onEnd` 可以写 `when`，指定只有以哪些方式结束，才会产生结束后留下的效果：`expired`、`save`、`damage`、`harmed`、`concentration`、`spent`、`cured`、`dispelled`、`contest`、`freed`、`slipped`、`endsWhenSource`（来源带有、缺少或受到 `endsWhenSource` 指定内容的阻止）或 `cantHearSource`(`endsWhenHolder.cantHearSource`)。以其他任何方式结束，都不会留下效果。5e 的 Pipes of the Sewers：被操控鼠群的 `piped` 会在吹奏者停止演奏或鼠群听不见吹奏者时结束，但只有后一种情况会使其在一天内无法再被操控，`"onEnd": {"when": ["cantHearSource"], "applies": [{"condition": "pipes_spurned", "duration": {"rounds": 14400}}]}`。使用它的规则集需要 Capability API 1.632。

`targetTypes` 可以写 `uncontrolled: true`：只有不受其他生物控制的生物，才能被选为目标或纳入效果，具体包括无人召唤入战斗的生物、使用者自身召唤的生物，以及被召唤但处于野性状态（`calls.wild`）或已与召唤者为敌的生物。5e 的 Pipes of the Sewers 操控“不受其他生物控制的一个鼠群”，`"targetTypes": {"is": {"tags": ["swarm"]}, "uncontrolled": true}`：可以是野生鼠群或吹奏者自己的鼠群，绝不能是吸血鬼的鼠群。使用它的规则集需要 Capability API 1.633。

战斗状态的 `actions` 可以用 `{"entry": "spells/animal-friendship", "saveDifficulty": 13}`（以及 `toHit`）指定条目，使用这些数值，而非持有者自身的施法数值。5e 的 Potion of Animal Friendship：饮用者可以在一小时内随意施放 animal friendship，豁免 DC 为 13，`{"condition": "animal_friend", "effects": [], "actions": [{"entry": "spells/animal-friendship", "saveDifficulty": 13}]}`。使用它的规则集需要 Capability API 1.634。

战斗状态的 `harms.save` 可以写 `drops`，指定要扣除的骰子，骰子大小与造成伤害所用的相同：持有者每通过一次豁免，就会从该状态的伤害中永久扣除这些骰子，骰子全部扣完时状态结束。5e 的 Potion of Poison，`"harms": {"at": "turn-start", "dice": "3d6", "type": "poison", "save": {"save": "con_save", "difficulty": 13, "drops": "1d6"}}`：豁免失败受到 3d6 伤害，每次成功后少一颗骰子，成功三次后结束。使用它的规则集需要 Capability API 1.635。

施加的状态的 `checkEnds` 可以写 `spendsItem: true`：检定成功时，还会永久消耗用来施加该状态的物品。还可以写 `failedRetryAfter: n`：失败后，在 `n` 轮内不会再提供持有者自身的重试。5e 的 Iron Bands of Binding，`"checkEnds": {"check": "athletics", "difficulty": 20, "spendsItem": true, "failedRetryAfter": 14400}`，配合额外使用方式 `{"kind": "buff", "budget": "bonus", "targetHolds": {"fromSelf": ["restrained"]}, "ends": {"conditions": ["restrained"]}}`，表示释放被囚禁者的命令词。使用其中任一项的规则集需要 Capability API 1.636。

`zone` 最长可以持续 14400 轮（`rounds`；此前为 1000），例如 Oil of Slipperiness 的油脂会持续 8 小时（4800）。它可以写 `close: {"budget": "action", "lingers": 100}`：施法者可以在自己的回合内关闭它，使其结束；带 `lingers` 时，则会再持续相应轮数，且不再扩散。爆发还可以写 `spreads: {"by": 10, "every": 10, "upTo": 120}`：施法者每过 `every` 个回合，它就扩大 `by`，直到半径达到 `upTo`（距离按规则集的单位计）。5e 的 Eversmoking Bottle，在一点产生 60 英尺的浓烟爆发，`{"rounds": 14400, "anchor": "point", "triggers": [], "obscures": {...}, "close": {"budget": "action", "lingers": 100}, "spreads": {"by": 10, "every": 10, "upTo": 120}}`。使用其中任一项的规则集需要 Capability API 1.637。

战斗状态可以写 `onFirstSeen: {"applies": {...}}`：持有者第一次看见另一个生物时，该状态就会结束，改为对持有者施加 `applies` 指定的状态，并以看见的那个生物为来源（同时看见多个生物时，取最近的）。5e 的 Philter of Love：饮用后，`{"condition": "love_struck", "effects": [], "onFirstSeen": {"applies": {"condition": "charmed", "duration": {"rounds": 600}}}}` 持续 100 轮，因此饮用者在接下来 10 分钟内最先看见的生物会魅惑饮用者，持续一小时。使用它的规则集需要 Capability API 1.638。

物品的 `worn` 或 `carried` 效果可以用 `"proficiencyBonus": 1` 增加持有者的熟练加值（Capability API 1.639），数值从 -6 到 6，不能为 0，每件物品只计算一次。如果 `resolution.proficiency.bonus` 读取一个派生值（5e 的 `proficiency_bonus`），该加值就会加到那个值上，因此读取它的一切也都会获得该加值：技能、豁免、攻击和法术豁免 DC。5e 的 Ioun Stone of Mastery 写作 `"worn": { "proficiencyBonus": 1 }`。使用它的规则集需要 Capability API 1.639。

物品使用可以像 Wish 一样施放其他条目（Capability API 1.640）：带 `"duplicates": { "catalog": "spells", "upTo": 8 }` 的 `"utility"` 使用方式（还可用 `only` 缩小范围），会把该目录中从第一等级到 `upTo` 的每个条目以 `<item>: <use>: <entry>` 的形式放到菜单上，即使使用者一个也不会；每个条目都像该使用方式一样用物品支付费用（消耗其 `charges`，或带 `consumes` 时消耗物品本身），并在该使用方式指定了自身的 `saveDifficulty` 和 `toHit` 时使用这些数值执行。这种使用方式不产生其他效果。5e 的 Ring of Three Wishes 写作 `"use": { "kind": "utility", "budget": "action", "label": "Wish", "charges": 1, "duplicates": { "catalog": "spells", "upTo": 8 } }`，最后一点充能用 `charges.breaksOn` 处理。使用它的规则集需要 Capability API 1.640。

按重量载运的坐骑（Capability API 1.641）。`combat.mounts.weights` 指定骑乘者的重量：`sheet`（从其人物卡读取的值，大于 0 时使用，例如身体与装备重量的派生值），否则按 `bySize`，使用战斗自身的大小分类。数值块写有 `"mountCarries": { "weight": 400, "slowedUpTo": 800 }` 的生物，只要包括骑乘者在内的总负重不超过 `slowedUpTo`（没有它时则为 `weight`），就能供任意大小的骑乘者骑乘；负重超过 `weight` 时，速度减半。第一位骑乘者像驾驭其他坐骑一样控制它；其余骑乘者随它一起移动，控制它的骑乘者下来后，其上的下一位接手。5e 的 Carpet of Flying 是独立的生物，由飞毯的物品使用召唤（`calls`、`dismissible`），拥有其大小对应的飞行速度和 `mountCarries`：3 英尺乘 5 英尺的飞毯为 `{ "weight": 200, "slowedUpTo": 400 }`，速度 80 英尺；最大到 6 英尺乘 9 英尺的飞毯为 `{ "weight": 800, "slowedUpTo": 1600 }`，速度 30。使用其中任一项的规则集需要 Capability API 1.641。

生物的 `spellcasting` 可以写 `slots`，按等级指定其法术位（Capability API 1.642）：`{ "1": 4, "2": 3, "3": 2 }`。该特性中没有 `uses`、且等级至少为 1 的法术（优先用自身的 `level`，否则用条目的等级），会消耗一个法术位，取剩余法术位中不低于该等级的最低等级；没有可用法术位时不再提供，菜单会显示该等级剩余的法术位。带 `coven` 时，女巫集会的法术消耗由集会所有成员共享的法术位：5e 的女巫集会。法术也可以指定自身的 `saveDifficulty` 和 `toHit`，取代该特性的数值，例如女巫天生法术的施法 DC 与集会法术不同。使用其中任一项的规则集需要 Capability API 1.642。

生物的 `sequence` 步骤可以掷骰决定执行次数（Capability API 1.643）：用 `"dice": { "count": 1, "sides": 4 }` 代替 `times`，例如紫蕈的 1d4 次 Rotting Touch 攻击；掷骰会记入日志，序列可瞄准的目标数上限为骰子可能掷出的最大值；给出的目标较少时，掷出的各次打击会轮流分配给这些目标。`ifHit` 按位置指定一个较早的步骤（从 0 开始计数），该步骤的所有攻击都必须命中同一个生物：随后本步骤会对那个生物执行，不接受自己的目标，例如格里克蠕虫在触须命中后用喙攻击。`optional: true` 允许生物的创建者省略该步骤：序列会为省略可选步骤的每种方式提供一种模式（最多省略 3 个步骤，且绝不能省略全部步骤），例如呓语之球的 Blinding Spittle。使用其中任一项的规则集需要 Capability API 1.643。

战斗状态的 `harms` 可以是 `"at": "defies"`(Capability API 1.644)：该状态的命令变成持有者可付出代价违背的命令，而非绝对无法执行的行为。它的 `forbids`、`behavior` 以及 `cannot-harm` 和 `cannot-approach-source` 效果都不再阻止行为；菜单会提供原本会被阻止的选项，并标出它们违背的状态（行走只标出不可前往的格子），执行后会在所选行为完成时造成伤害；带 `once` 时，状态持续期间只造成一次。这样的状态必须发出某种命令，即带有这些键或效果之一。5e 的 Geas，“每次采取直接违背你指示的行为时，受到 5d10 心灵伤害，但每天最多一次”：`{"at": "defies", "dice": "5d10", "type": "psychic", "once": true}`，配合表示“不得施放法术”的 `forbids.casts`，或表示“留在这里”的 `behavior.keepsIn`。使用它的规则集需要 Capability API 1.644。

状态或区域的 `wards` 可以只阻止其目录中的部分条目（Capability API 1.645）：`where` 指定条目，读取条目声明的筛选项，方式与修改的 `where` 相同（5e 的 Mind Blank，`{"catalogs": ["spells"], "maxLevel": 9, "where": {"filter": "school", "equals": "divination"}}`）；`entries` 则只指定这些条目，每项都是该防护指定目录中的一个 `<catalog>/<entry>`（5e 的 Wish，“免疫单个法术”）。两者可以同时指定，此时防护只会阻止同时符合两者的条目。使用其中任一项的规则集需要 Capability API 1.645。

用于 5e 的 Wish 的三项机制（Capability API 1.646）。战斗状态的 `harms` 可以写 `"at": "casts"` 并带 `catalogs`：持有者每次施放这些目录的条目时都会受到该伤害；带 `perLevel` 时，施放等级每有一级就受到一次；带 `unblockable` 时，会无视所有抗性和免疫（“该法术每有一级，就受到 1d10 黯蚀伤害。此伤害无法以任何方式减免或阻止”）。`applies` 的一项可以带 `chance`，对每个将被施加的对象各掷一次 d100，点数不高于该值才会施加（“有 33% 的概率再也无法施放 wish”）。状态的 `forbids.entries` 中，每项为 `<catalog>/<entry>`，在状态持续期间阻止这些条目：施加为 `"until-dispelled"`，即可表示失去 Wish。使用其中任一项的规则集需要 Capability API 1.646。

带 `"stasis": true` 的战斗状态让持有者脱离时间流动（Capability API 1.647），如 5e 的 Sequester。持有者不执行回合，因此不会作濒死豁免，按自身回合运行的内容也不会伤害它或倒计时。其他人施加在它身上、按那些人的回合运行的内容也会暂停：其他所有状态都保留原有的剩余轮数，也不会产生它们的任何伤害或豁免。时间停滞状态本身若按来源的回合计算持续时间，仍会在来源的回合倒计时，并按自身指定的方式结束，例如通过 `"endsWhen": ["damaged"]` 或驱散。加上 `unseen`，即可表示该法术赋予的隐形。使用它的规则集需要 Capability API 1.647。

战斗状态的 `"languages"` 指定持有者在状态持续期间理解的语言（Capability API 1.648），无论其人物卡或数值块写明它会说什么语言。`"none"` 表示什么语言都不理解，其他人也无法理解它：5e 的 Feeblemind，因此 Command 或 Suggestion（`targetTypes.understands`）既不能作用于它，也不能由它发出。`"all"` 表示理解所有语言，而且任何懂得一种语言的人都能理解它：Tongues。两种状态相互冲突时，`"none"` 优先。使用它的规则集需要 Capability API 1.648。

`combat.senses` 中的感官可以写 `"seesTrue": true`(Capability API 1.649)：在其射程内且视线可及的地方，能看见事物的真实面貌。别人召唤出的幻象（`calls.illusion`）绝不会作为目标提供给能看穿它的人，状态产生的幻影 `duplicates` 也不会吸引他们的任何攻击。5e 的 Witch Sight 就是这种感官，在邪术师拥有该魔能祈唤时从人物卡读取为 30：`{ "id": "witch_sight", "label": "Witch Sight", "sheet": { "derived": "witch_sight" }, "seesTrue": true }`。变形生物的真实形态由游戏主持人（GM）描述。使用它的规则集需要 Capability API 1.649。

状态或物品的 `fallsSafely` 可以用 `{ "upTo": 20, "unless": ["incapacitated"] }` 代替 `true`(Capability API 1.650)：只有高度不超过 `upTo` 的坠落才不会伤害持有者，并使其保持站立，距离按规则集的单位计；持有者带有 `unless` 中任一状态时，任何坠落都不享受此效果。5e 的 Cat's Grace：“如果没有失能，从 20 英尺或更低处坠落不会受到伤害”。使用它的规则集需要 Capability API 1.650。

用于 5e 的 Dust of Sneezing and Choking 的两个键（Capability API 1.651）。带 `"suffocates": true` 的战斗状态让持有者无论身处何地都无法呼吸：它会按 `combat.underwater.breath` 的规定先屏息，再窒息，在水外和水中都一样，除非该呼吸规则的 `exempt` 将其豁免。状态的 `"savesUnless": ["unconscious"]` 则会在持有者带有其中任一状态时，阻止其掷用于结束该状态的豁免（“只要仍然清醒，生物就可以重复作豁免”）。使用其中任一项的规则集需要 Capability API 1.651。

豁免的 `against` 可以指定 `qualities`(Capability API 1.652)，表示所抵御事物的性质：Cloudkill 和 Stinking Cloud 的 `"against": { "qualities": ["gas"] }`。豁免调整值的 `against.qualities` 随后就会作用于该豁免，如同其 `damage` 会作用于抵御相应伤害类型的豁免：Necklace of Adaptation 的 `{ "to": "saves", "mode": "advantage", "against": { "qualities": ["gas"] } }`。使用其中任一项的规则集需要 Capability API 1.652。

物品效果或人物卡条目的 `keepsOn` 中，每一项可以用 `{ "condition": id, "when": valueRef }` 代替单纯的 id(Capability API 1.653)：只有 `when` 从持有者人物卡读取的值大于零时，该状态才会持续生效。Holy Avenger 在圣武士等级低于 17 时维持其 10 英尺光环，从该等级起则维持其 30 英尺光环；两者各用一项，`when` 分别读取在相应等级时为 1 的派生值；Aura of Protection 在等级 18 时也采用同样做法。使用它的规则集需要 Capability API 1.653。

战斗状态的 `weapon.die` 现在也会作用于固定伤害的打击，前提是该状态通过 `names` 或 `items` 指定了该打击（Capability API 1.654）：打击会掷一颗该大小的骰子，替代标出的数值，仍然加上其属性调整值。Alter Self 的 Natural Weapons，`{ "names": ["unarmed"], "die": 6 }`，会把徒手打击的 1 加力量调整值变成 d6 加力量调整值。依赖它的规则集应声明 Capability API 1.654；旧版 Engine 会保留原来的固定数值。

战斗状态的 `whenSeen` 现在也会限定其 `attacks-against-disadvantage` 的作用范围（Capability API 1.655）：只有能看见持有者的攻击者，对持有者的攻击才具有劣势。Robe of Scintillating Colors 的闪烁光芒，“能看见你的生物对你的攻击掷骰具有劣势”，用带有该效果和 `"whenSeen": true` 的状态表示。使用它的规则集需要 Capability API 1.655。

按数量归还的资源池（Capability API 1.656）。`recovers` 可以带 `count`，表示总共最多归还多少个已消耗的资源池；在目录条目上仍由游戏主持人（GM）指定它们，指定数量过多的使用会被拒绝。物品的 `use` 也可以带 `recovers`，这是带 `targets: "self"` 的“buff”，必须写明 `count`：无论在战斗内还是战斗外使用，都会自行逐个归还该组中已消耗的最高等级资源池，每个等级不高于 `most`，且合计不超过 `upTo`。5e 的 Pearl of Power 写作 `{"group": "slots", "upTo": {"const": 3}, "most": 3, "count": 1}`，即一个已消耗的 3 级或更低等级的法术位。使用它的规则集需要 Capability API 1.656。

自带伤害段的弹药（Capability API 1.657）。物品可以带 `ammoRider`，`{"plus": [...], "spentOnUse"?: true}`：这种弹药由武器的 `ammo` 按其某个标签取用，其伤害段（写法与武器的 `plus` 相同，每段有自己的 `targetIs`、`not`、`save` 或 `when: "critical"`）会附加到发射它的那次打击上。携带的每叠这种弹药都会作为该武器的一种独立射击方式提供，以该物品命名；按普通方式射击时，先取用普通弹药，再取用这种弹药。带 `spentOnUse` 时，只要其中一个伤害段作用于目标、未被可抵消它的豁免挡下，该弹药就会消耗：战斗获胜后原本会回收的部分，如果持有者携带了该标签的普通弹药叠，就会改为按普通弹药回收。带 `clip` 的武器会装入排在最前的弹药，因此它的射击没有附加效果。5e 的 Arrow of Dragon Slaying，在带箭标签的物品上写 `{"plus": [{"dice": "6d10", "type": "piercing", "save": {"save": "con_save", "difficulty": 17, "onSuccess": "half"}, "targetIs": {"types": ["dragon"]}}], "spentOnUse": true}`。使用它的规则集需要 Capability API 1.657。

将攻击引向持有者（Capability API 1.658）。战斗状态或物品的 `worn` 效果可以带 `drawsAim`，`{"within", "blow"?, "weapon"?}`：针对持有者 `within` 距离内其他对象的攻击（按规则集的距离单位计），会改为攻击持有者。这不是反应：不消耗任何资源，也不会询问任何人，而且绝不会将攻击引向攻击者自身。`blow` 将其限定为触及范围内的打击（`"melee"`）或远处的打击（`"ranged"`），`weapon` 则限定为武器的打击。多个对象都能吸引攻击时，由最靠近原目标的对象吸引；范围效果不会被吸引，没有棋盘的战斗也不会发生吸引。5e 的 Shield of Missile Attraction 的诅咒，在盾牌的 `worn` 上写 `{"within": 10, "blow": "ranged", "weapon": true}`。使用它的规则集需要 Capability API 1.658。

隔绝空气或阻止射击的区域（Capability API 1.659）。
区域可以带 `"sealsAir": true`：
气体、风和雾无法穿过其边界，
因此带 `dispersed` 的遮蔽区域或风（带 `disperses`，
或某阶段带有它），
只能覆盖与自身中心位于边界同一侧的格子。
外部的 Fog Cloud 到边界就会停止，
在内部施放的则会留在内部，
外部的 Gust of Wind 也绝不会影响内部的雾。
区域的 `blocks` 还可以指定 `"ranged"`，
无论它是不是墙：
任何远处的武器攻击，
无论是否具有魔法，
都不能射入、射出或穿过该区域（法术或范围效果不算武器攻击）。
这两者都是区域对其所占地面的效果，
因此不需要触发条件。
5e 的 Cube of Force 是围绕施法者的爆发：
第一面为 `"sealsAir": true`，
第二面为 `"blocks": ["ranged"]`。
使用它的规则集需要 Capability API 1.659。

坐骑超过满载时的速度（Capability API 1.660）。生物的 `mountCarries` 可以在 `slowedUpTo` 旁带 `slowedSpeed`，按规则集的距离单位计：负重超过 `weight` 时，它的移动速度最多为该值，而非减半。5e 的 Broom of Flying，在一个飞行速度为 50 英尺的生物上写 `{"weight": 200, "slowedUpTo": 400, "slowedSpeed": 30}`。使用它的规则集需要 Capability API 1.660。

只向部分人物卡提供的起始装备选项（Capability API 1.661）。起始装备选择中的选项可以带 `offeredWhen`，像目录条目一样从人物卡读取一个值：只有该值大于零时才提供，否则选取它会被拒绝。如果某项选择的所有选项都不向该人物卡提供，就不会提问；如果没有可供读取的人物卡，则提供所有选项。5e 牧师的“(a) 硬头锤或 (b) 战锤（如果熟练）”，为战锤选项设置 `offeredWhen`，读取一个在熟练使用军用武器时为 1 的派生值。使用它的规则集需要 Capability API 1.661。

改变派生值的状态（Capability API 1.662）。战斗状态可以带 `derivedChanges`，按派生值 id 指定：`{"times"?, "add"?}`，最多 12 项。持有者带有该状态时，无论在人物卡上还是战斗中，计算派生值都会先乘以每个 `times`，再加上每个 `add`，之后的所有计算都会读取改变后的值。5e 的 Enhance Ability (Bull's Strength) 写作 `{"carry_capacity": {"times": 2}}`。使用它的规则集需要 Capability API 1.662。

持续若干天的状态（Capability API 1.663）。施加的状态若带 `duration: "until-dispelled"`，就可以带 `lastsDays`，在施加时从施加者人物卡读取该值。在战斗中，它不计时。战斗结束时，仍带有该状态的人物卡会保留剩余天数，人物卡的 `pass` 命令会扣除这些天数，全部扣完时移除状态。用其他方式移除状态时，天数也随之删除。Quivering Palm 写作 `{"condition": "quivering", "duration": "until-dispelled", "lastsDays": {"field": "level"}}`。`lastsDays` 与其他任何持续时间搭配都会被拒绝。使用它的规则集需要 Capability API 1.663。

穿戴物品期间持续的状态（Capability API 1.664）。物品的 `use` 施加的状态可以带 `whileItemWorn: true`，该物品必须占用槽位或进行绑定。人物卡会记住由哪一叠物品维持该状态。当该物品被脱下、解除绑定或不再携带时，状态会随这次物品栏变更从人物卡移除；开始战斗时若未穿戴该物品，也不会把状态带入战斗。在战斗中使用时，战斗也会记住该物品叠，并在战斗结束后将该关联保留到人物卡上。Armor of Invulnerability 写作 `{"condition": "invulnerable", "duration": {"rounds": 100}, "whileItemWorn": true}`。目录条目自身的 `applies` 不能使用它。使用它的规则集需要 Capability API 1.664。

可能不听从任何命令的被召唤生物（Capability API 1.665）。召唤的 `disobeys` 为 `{"chance": 1-99, "when"?}`，其中 `when` 是从召唤者人物卡读取的数值界限（`value`、`atLeast`、`atMost`）。召唤时，如果满足 `when`，就掷一次 d100；点数不高于 `chance` 时，它们不受任何人控制，与 `side: "none"` 相同，而且遣散也无法让它们离开。日志会说明它们不听从任何命令。黑曜石坐骑写作 `"disobeys": {"chance": 10, "when": {"value": {"field": "good"}, "atLeast": 1}}`，用于在 `good` 字段记录阵营的人物卡。使用它的规则集需要 Capability API 1.665。

防护排除的种类，以及由标签限定的内部效果（Capability API 1.666）。战斗前设置的区域（1.462）可以写 `"spares": [<kind>, ...]`，按 id 或名称指定其 `keepsOut` 不再阻挡的生物类型。每种类型都必须属于原本会被阻挡的类型，否则保留原来的设置，并在战斗中说明。还可以写 `"tag": <tag>`，使区域内部的效果只作用于带有该标签的生物。Hallow 原本针对邪魔和不死生物、但放过邪魔时，写作 `{"entry": "Hallow", "spares": ["fiend"]}`；它对某位神祇信徒的额外效果写作 `{"entry": "Hallow", "tag": "follower"}`，并为这些生物加上该标签。这些设置不需要改动规则集的任何内容，但依赖它们的规则集需要 Capability API 1.666。

物品对携带者或使用者的要求（Capability API 1.667）。物品的 `binds.needs` 列出携带者人物卡必须满足的最多 4 项数值界限（`value`、`atLeast`、`atMost`）。不满足要求的人与之绑定后，物品按未穿戴处理：穿戴效果和数值不计入，无论在战斗中还是战斗外，都不会提供其使用选项。物品的 `userNeeds` 用同样的方式列出使用它的基本要求：在战斗外拒绝使用，在战斗中不提供使用选项。`items.needsWaivedBy` 从人物卡读取一个值，该值大于零时免除这两类要求。5e 的“需要由牧师同调”写作 `"binds": {"needs": [{"value": {"field": "cleric_level"}, "atLeast": 1}]}`，牧师的法术卷轴写作 `"userNeeds": [{"value": {"field": "cleric_level"}, "atLeast": 1}]`，Use Magic Device 则写作 `"needsWaivedBy": {"derived": "use_magic_device"}`，该派生值从游荡者等级 13 起为 1。使用其中任何一项的规则集都需要 Capability API 1.667。

夺走目标所持物品的对抗（Capability API 1.668）。目录条目的 `contest`(1.565) 可以带 `takes`，其中包含 `slots` 和/或 `tags`。对抗胜过目标后，目标持有的、位于所列任一槽位或带有所列任一标签的第一件东西会落在使用者脚边：目标只能到那里重新捡起它，与任何掉落物相同（1.266）。日志会说明夺走了什么。5e 的 Telekinesis 对生物所持物件的作用写作 `"contest": {"attacker": ["spellcasting"], "defender": ["strength"], "takes": {"slots": ["hand"]}}`。使用它的规则集需要 Capability API 1.668。

通过检定拆除的陷阱（Capability API 1.669）。区域的 `disarm` 将其变为施法者的敌人可以拆除的陷阱：`{"check": "thieves_tools", "difficulty": 15, "tripsOnFailBy": 5}`。看见陷阱且站在距其一格之内的人，会通过 `disarm` 标准行动获得“拆除 <其标签>”选项；隐藏的陷阱只有在其一方发现后才能看见，`combat.standard` 必须列出该标准行动。他们掷 `check`(`combat.checks` 之一)，对抗 `difficulty`；省略难度时则使用条目自身的豁免难度。成功则陷阱消失，且不触发。失败差值达到或超过 `tripsOnFailBy` 时，陷阱触发；如果陷阱通过进入而触发（`detonates.entered`），就对尝试拆除的人触发。指定 `disarm` 的 `standard` 授予项允许用另一种额度支付，正如 5e 的 Fast Hands 允许用附赠动作。使用它的规则集需要 Capability API 1.669。

传送的熟悉程度表（Capability API 1.670）。带 `leaves` 的 `teleport` 可以带 `familiarity`，用一到八行表示使用者对目的地的熟悉程度，每行有 `id`、`label`，以及发生 `mishap`、抵达 `similar` 范围和落在目标之外（`off`）的百分比概率（其余概率为准确抵达）；另有 `mishap` 指定传送事故对每位旅行者造成的伤害：`{"dice": "3d10", "type": "force"}`。每行作为一种 `familiar-<id>` 模式提供，必须选一种才能离开战斗。离开时，按所选行掷 d100，先判定事故，再判定相似范围，最后判定偏离目标。事故会伤害使用者及其携带的所有人，然后重新掷骰（最多二十次）。随后，仍活着的人无论站着还是倒下，都会离开。日志会说明每次掷骰及其结果。5e 的 Teleport 按法术表格填写各行：永久法阵为 0，非常熟悉为 5、8 和 11，偶尔见过为 33、10 和 10，虚假目的地为 50 和 50。使用它的规则集需要 Capability API 1.670。

在某些地面上受限的攀爬（Capability API 1.671）。`speeds` 中包含攀爬速度的战斗状态可以带 `climbNotOn`：`terrain` 指定该攀爬能力无效的地块（或棋盘地点）；`slippery: true` 指定持续范围造成的湿滑地面，区域的 `terrain` 用 `"slippery": true` 标记这种地面（5e 的 Grease）。如果棋盘地点列在 `terrain` 中，该状态完全不提供攀爬能力。持有者自身的攀爬能力，或另一状态提供且不带 `climbNotOn` 的攀爬能力，仍可在任何地方使用。5e 的 Slippers of Spider Climbing 持续施加一个带 `"speeds": {"climb": "walk"}` 和 `"climbNotOn": {"slippery": true, "terrain": ["ice"]}` 的状态。使用其中任一项的规则集都需要 Capability API 1.671。

限制字段合计值的上限（Capability API 1.672）。人物卡可以带 `totals`，最多八项 `{"fields": [...], "max": N, "label"?: "..."}`，每项包含二到二十四个数值字段，其值的总和不得超过 `max`。完整人物卡表单会根据其他字段的现值降低每个字段的上限（但绝不低于该字段自身的下限），游戏主持人（GM）的成长操作会拒绝超过上限的值；对于已经超限的人物卡，无论是导入的还是以前已有的，都会在字段上方提示，但不改动字段。引导式构建器的步骤 `total`(1.107) 仍只约束其自身步骤。5e 的职业等级：`{"fields": ["level_barbarian", "level_bard", ...], "max": 20, "label": "Class levels"}`。使用它的规则集需要 Capability API 1.672。

生物豁免的大幅失败（Capability API 1.673）。生物行动的 `save` 可以像目录条目一样带 `failedBy`(1.592)：目标的失败差值达到或超过指定值时，`{"atLeast": 5, "applies": [...]}` 会施加其中的状态，代替行动的 `applies`，正如 5e 木乃伊的 Dreadful Glare，失败差值达到或超过 5 时施加恐惧和麻痹。无论在生物还是目录条目上，`failedBy` 都可以用 `resultAtMost` 代替 `atLeast`：豁免失败且总结果不高于该值时触发，正如 sprite 的箭，豁免结果不高于 5 时施加中毒和昏迷。使用其中任一项的规则集都需要 Capability API 1.673。

对每个生物只使用一次的生物行动（Capability API 1.674）。生物行动可以带 `oncePerTarget`：`{"whenSaved": true}` 放过通过豁免的生物，`{"whenEnds": true}` 放过该行动对其施加的状态已经结束的生物；同时带两项时，满足任一项就放过；两项都不带时，放过所有已对其使用过该行动的生物。被放过的生物在这场战斗中不会再被该行动选中或卷入；带 `"until": "<rest id>"` 时，角色会在人物卡上记住这一点，直到进行该休息。`"shared": "<id>"` 让行动指定相同 ID 的所有生物视为同一个来源；否则，每个生物（按名称区分）的每个行动都各自算一个来源。5e 龙的 Frightful Presence：`{"whenSaved": true, "whenEnds": true, "until": "long"}`；木乃伊的 Dreadful Glare 再加 `"shared": "mummy-glare"`，木乃伊领主的则使用自己的 ID。使用它的规则集需要 Capability API 1.674。

向拉拽者靠近的拉拽（Capability API 1.675）。生物行动或目录条目可以带 `pull`，距离采用规则集自身的单位：受其作用的人（有豁免时须豁免失败）会被直线拉向使用者，从双方最近的格子开始逐格移动，到达使用者身旁、墙壁、已占用的格子或陡升处时停止。从台阶跌落的处理与推开相同。一个行动只能推或拉，不能同时有两者。5e 的 balor 鞭击带 `"pull": 25` 和 DC 20 的力量豁免；roper 的 Reel 带 `"pull": 25` 和 `"targetHolds": {"fromSelf": ["grappled"]}`；Thorn Whip 和 Lightning Lure 带 `"pull": 10`。日志会说明“将……拉近”。使用它的规则集需要 Capability API 1.675。

附着不放的生物（Capability API 1.676）。战斗状态可以带 `attaches`：施加者会附着在持有者身上，在持有者行走或被推开时，被带到持有者刚经过的最后一个格子，且不引发借机攻击。`"sourceAttacks": "none"` 使施加者在附着期间不能攻击任何人（stirge）；`"holder"` 则使其只能攻击持有者（cloaker、darkmantle）。状态的 `harms` 累计造成的伤害达到 `endsAfterHarm` 时就会脱离（stirge 为 10，`harms` 为 `{"at": "source-turn-start", "dice": "1d4", "flat": 3}`）。走开可通过施加项的 `endsAway` 结束它，任何人花费行动可通过 `checkEnds` 的 `"by": "any"` 结束它，来源倒下则通过 `endsWhenSourceDown` 结束它；cloaker 的 Damage Transfer 写作 `takesSourceHarm` `{"share": 0.5}`。施加项可以带 `"withAdvantage": true`，使其只在攻击以优势掷骰时施加：cloaker 咬住头部时施加 `blinded`，并通过 `endsWith` 让该状态随其附着一起结束。使用其中任一项的规则集都需要 Capability API 1.676。

生物的打击对被其击倒者的作用（Capability API 1.677）。生物行动可以带 `onFell`：当它的打击使原本没有倒下的人生命值耗尽时，`"stabilizes": true` 让对方稳定下来（需要濒死规则），`applies` 则以该生物为来源，对其施加所列状态。使目标仍然站着的打击，或命中已经倒下的人的打击，都不产生这些效果。5e 巨型蜘蛛的啮咬：`{"stabilizes": true, "applies": [{"condition": "poisoned", "duration": {"rounds": 600}}, {"condition": "paralyzed", "duration": "instant", "endsWith": "poisoned"}]}`；除非规则集另有说明，治疗绝不会结束状态，因此“即使恢复生命值之后也一样”不需要额外设置。使用它的规则集需要 Capability API 1.677。

只杀死低生命值目标的生物行动，以及豁免失败时生命值耗尽（Capability API 1.678）。生物行动可以在 `slaysOnFailedSave` 旁带 `slaysHealthAtMost`：只有豁免失败时生命值不高于该值的目标才会被杀死，其他目标则按豁免成功承受该打击（solar 的 Slaying Longbow，190）。生物行动可以像目录条目一样带 `dropsOnFailedSave`：目标豁免失败时生命值耗尽，规则集有濒死规则时进入濒死；豁免成功则不受影响（sea hag 的 Death Glare，带 `"onSuccess": "negates"`）。它配合行动自身的豁免使用，不能与 `slaysOnFailedSave` 同用。在生物上使用其中任一项的规则集都需要 Capability API 1.678。

飞掠（Capability API 1.679）。战斗状态可以带 `"flyby": true`：只要持有者具有飞行速度，就能飞离任何人的触及范围，且不引发借机攻击。用 `keepsOn` 在生物身上持续施加该状态，就能表达 5e 猫头鹰、巨型猫头鹰和飞蛇的 Flyby；没有飞行速度时，它不起作用。使用它的规则集需要 Capability API 1.679。

共享空间（Capability API 1.680）。战斗状态可以带 `"sharesSpace": true`：持有者可以走入并停在任何人的空间中，无论敌友；任何人也都可以走入并停在持有者的空间中。用 `keepsOn` 在生物身上持续施加该状态，就能表达 5e 集群的“可以占据其他生物的空间，反之亦然”。其他人之间仍像以前一样不能互相占据空间。使用它的规则集需要 Capability API 1.680。

挤过狭缝，以及以更小体型移动（Capability API 1.681）。`combat.sizes.squeezing` `{"costs": 2, "condition": "squeezed"}` 允许完整占地空间无法容纳于墙壁之间的人，按比自身小一级的体型穿过：每步花费变为 `costs` 倍，在挤压状态下停下时，只占据较小的空间，并持有 `condition`（为该状态设置规则集所需的效果：5e 中，其攻击和敏捷豁免具有劣势，针对其的攻击具有优势）。在能容纳完整占地空间的地方停下后，就会再次占据完整空间，且该状态消失。战斗状态可以带 `"squeezesAs": "<size id>"`：持有者能自由穿过可容纳该体型的任何开口，只花费普通一步的费用，且不施加状态：5e 的 Amorphous 和集群使用 `"tiny"`。使用其中任一项的规则集都需要 Capability API 1.681。

只在看见附近盟友时生效的状态（Capability API 1.682）。战斗状态的 `heldOnlyIn` 可以在 `light` 旁边或代替它指定 `allySeenWithin`，距离采用规则集自身的单位：只有持有者看见该距离内有一名站着的盟友时，状态才生效，否则被压制，而不是结束。不在棋盘上时，任何站着的盟友都算。5e bearded devil 的 Steadfast 是持续生效的状态，带 `"conditionImmunities": ["frightened"]` 和 `"heldOnlyIn": {"allySeenWithin": 30}`。使用它的规则集需要 Capability API 1.682。

武器上的毒药（Capability API 1.683）：状态的 `onHit` 可以造成自身的伤害，`"damage": {"dice": "1d4", "flat": 0, "type": "poison"}`，并要求先作豁免，`"save": {"save": "con_save", "difficulty": 11, "onSuccess": "half"}`；成功则伤害减半（带 `"negates"` 则不造成伤害），也不施加其 `applies`，因此现在只要提供 `damage`，`applies` 就可以省略。`"failedBy": {"atLeast": 5, "applies": [...]}` 会在失败差值达到或超过该值时施加额外状态（卓尔毒药的昏迷），且必须带 `save`。`"damageTypes": ["slashing", "piercing"]` 将其限制为这些伤害类型的命中，因此涂在刀刃上的毒药绝不会附加在棍棒攻击上。用 `endsAfter: "own-hit"` 将涂层维持在持有者身上，表示一次命中即耗尽的剂量；更持久的涂层则使用持续时间。

持有者受到治疗时结束的状态（Capability API 1.684）：`endsWhen` 可使用 `healed`，在战斗中任何让持有者恢复至少一点生命值的治疗发生时结束（铁蒺藜造成的行走减速，“直到该生物恢复至少 1 点生命值”）；也可使用 `healed-by-magic`，只有魔法来源的此类治疗才会结束它：即性质中带 `"magical"` 的行动、条目或物品使用，读取方式与 `cannot-heal-nonmagical` 相同（Infernal Wound，“目标受到魔法治疗时伤口闭合”）。没有恢复任何生命值的治疗，无论是因为生命值已满还是被状态阻止，都不会结束这两种状态。`endsWhen` 现在最多可包含全部六种结束方式。

将他人或自身送出战斗的生物行动（Capability API 1.685）：数值块或目录生物的行动可以像目录条目一样使用 `dismisses`，其值为 `true` 或 `{"while": conditionId, "gone"?, "turns"?}`，其中 `while` 状态必须是行动自身 `applies` 中的一种。带 `"self": true` 和 `"turns": true` 时，生物自身离开战斗，在外仍有自己的回合，但只会获得返回的选项，即状态的 `endable`“End”(结束)，返回时出现在离开处或最近的空位。ghost 的 Etherealness：`{"id": "etherealness", "name": "Etherealness", "budget": "action", "self": true, "applies": [{"condition": "ethereal", "duration": "until-dispelled"}], "dismisses": {"while": "ethereal", "turns": true}}`，配合战斗状态 `{"condition": "ethereal", "effects": [], "endable": {"budget": "action"}}`；phase spider 的 Ethereal Jaunt 相同，只是改用附赠动作。`"carries": {"count": 3, "within": 5, "condition": "ethereal"}`（用于 `self` 行动）会按由近到远的顺序，带走该距离内至多指定数量、仍站着的盟友；每人都在持有该生物施加的 `condition` 期间离开，并在生物返回时一起返回（nightmare 的 Ethereal Stride）；状态带 `endable` 的乘客也可以自行返回。

最多 16 项战斗检定（Capability API 1.686）：`combat.checks` 现在可容纳 16 项，之前为 12 项，因此规则集即使包含 5e 的所有对抗技能，也还有空间放入拆除所读取的盗贼工具检定。超过 12 项的规则集需要 Capability API 1.686。

每次使用各有不同作用的生物行动（Capability API 1.687）：`"byUse": [actionId, ...]` 指定同一生物的二到六个其他普通行动，放在带 `uses` 且自身没有任何效果的行动上（不能有攻击掷骰、伤害、治疗、豁免、状态施加、序列或 `self`）。第一次使用时，对瞄准的目标执行所列的第一个行动，第二次执行第二个，超过列表末尾后始终执行最后一个；使用次数由其自身的 `uses` 计数，因此生物当天的使用次数会保留这一计数。被指定的行动本身绝不会出现在菜单上。androsphinx 的 Roar，“每次在完成长休息前再次咆哮，声音都会更响”：`{"id": "roar", "name": "Roar", "budget": "action", "uses": {"per": "day", "count": 3}, "byUse": ["roar_1", "roar_2", "roar_3"]}`，每次咆哮各自是一个行动，有自己的范围、豁免和状态。

Periapt of Wound Closure(Capability API 1.688)。战斗状态的 `"stabilizesWhenDying": true` 会在持有者自己的回合开始时，若其正处于濒死，就让其稳定下来，代替濒死掷骰，日志会说明；通过已穿戴物品的 `keepsOn` 持续施加，就能表达该护符的“在你的回合开始时，只要处于濒死，就会稳定下来”。休息的 `dice` 项可以带 `"times"`，用值引用将每颗骰子的治疗量乘以该值，包含其 `add`，倍率绝不低于一倍：`{"itemStat": {"stat": "hit_die_times", "from": "worn", "pick": "max", "default": 1}}`，配合护符提供的 `hit_die_times` 2，就能在穿戴期间使“恢复的生命值点数”翻倍。

谨慎行走即可安全通过的地面，以及阻止行走的地面（Capability API 1.689）。持续范围的 `terrain` 可以带 `"spareSlowWalkers": true`：只要存在这样一片范围，行走者就会在“移动”旁获得“谨慎移动”选项；选此项时，进入此类地面的每一步费用加倍（在其中速度减半），且范围的 `enter` 触发条件会放行。还可以带 `"endsWalk": true`：被其 `enter` 触发条件卷入且豁免失败时（或没有豁免可作时），行走者会停在该格，本回合不再有剩余移动力。5e 的铁蒺藜带 `"triggers": ["enter"]` 和 `"terrain": {"spareSlowWalkers": true, "endsWalk": true}`，配合 DC 15 的敏捷豁免、1 点穿刺伤害，以及治疗后结束的行走减速（1.684）；滚珠则使用 `spareSlowWalkers` 和倒地豁免。

从文本字
段的词语
读取数值（Capability API 1.690）。派生值 `{"op": "wordsTable", "from": {"field": "alignment"}, "table": {"good": 1, "evil": -1}, "default": 0}` 会按玩家
填写的文
本读取字
段：每个键都
是一个词
或短语（共 1 到 40 个，每个最多 40 个字符），按完整单
词匹配，不区分大
小写；按表中顺
序，字段匹配
到的第一
个键给出
数值，没有匹配
任何键则
读取 `default`。因此，“Lawful Good”读作 1，而“Goodly”读作 0。字段为文
本（或枚举）。读取方式
与任何派
生值相同，因此以阵
营为依据
的状态、检定或生
物规则都
能将其作
为数值读
取：例如 5e 的 Book of Exalted Deeds 或 Talisman of Pure Good 伤害触碰
它的邪恶
者。

只需满足所列任一要求的物品（Capability API 1.691）。在 `binds.needs` 旁带 `"needsAny": true`，会让绑定只需满足任一要求，而非全部要求：5e 的“需要由牧师、德鲁伊或邪术师同调”，按每个职业等级各列一项要求，每项为 `atLeast: 1`。`"userNeedsAny": true` 对 `userNeeds` 作同样处理：在吟游诗人、牧师和法师法术列表上的卷轴，三者均可阅读。这两类要求各自最多可列出 8 项（1.691 之前为 4 项）。`items.needsWaivedBy` 仍然免除全部要求。

将对抗的 `takes` 作为独立模式（Capability API 1.692）。在 `contest.takes` 旁带 `"takesMode": {"label": "Object", "restLabel": "Creature"}`，会以两种模式提供条目，像武器模式一样在使用时选择。在 `label` 模式下，对抗胜出只会夺走 `takes` 指定的东西，不产生其他效果（没有 `applies`、`movesTarget` 或伤害）；在 `restLabel` 模式下，以及未选择模式时，胜出会产生其余所有效果，但不夺走任何东西。它不能与 `appliesOneOf`、`cureOneOf`、`kindChoice`、`forms`、`calls` 和 `conjures` 同用。现在，任何以某种模式施放的条目，其重复使用（`repeats`）都只会以施放时的模式提供和执行（未选择模式时用第一种模式）：Telekinesis 会继续抓住原本控制的物件或生物，Hex 则保留原本选择的属性。

使用者对自身受到的状态作豁免（Capability API 1.693）。在 `appliesSelf` 和 `save` 旁带 `"appliesSelfSaves": true`，会让使用者也以同一难度作该豁免，且只有失败时才对其施加 `appliesSelf`。5e 的 Dust of Sneezing and Choking，投掷者与其他所有人一样身处云雾中：物品使用带体质豁免，并在 `applies` 和 `appliesSelf` 中都列出窒息状态。

附近任何人都能通过检定移动的持续范围（Capability API 1.694）。区域的 `move` 可以带 `"check": {"check": "arcana", "difficulty": 25, "within": 60, "distanceBy": {"abilityMod": "int", "times": 5, "atLeast": 5}, "failsToward": 10}`。此时，任何人都不能仅凭 `move` 移动它：站在距其中心 `within` 之内的任何人，包括施法者，都可以花费 `move.budget` 来“控制”它，掷 `check`(`combat.checks` 之一) 对抗 `difficulty`。成功时，区域会移到其选择的格子，距离最多为 `distanceBy.times` × 其 `abilityMod` 调整值（至少为 `atLeast`；没有 `distanceBy` 时使用 `move.distance`），并归其控制。失败时，区域会向其靠近 `failsToward`。如果最后移动它的是另一个仍站着的人，则改为与该人的检定对抗，平局归对方，落败则不移动。移到某人身上时，会像该人进入范围一样将其卷入。5e 的 Sphere of Annihilation，其区域的 `enter` 是 DC 13 敏捷豁免失败时受到 4d10 力场伤害，并带 `outlasts`，使其在制造者离开后仍然存在。

通过对抗才施加附加效果的生物行动（Capability API 1.695）。生物行动可以带 `"contest": {"attacker": ["might"], "defender": ["might"]}`（使用 `combat.checks` 的 ID，`ties` 默认为防御者胜，除非写明 `"attacker"`）：对行动命中的目标，无论对抗结果如何都会造成伤害，但只有生物的最佳检定胜过目标的最佳检定时，才会施加状态、推开或拉近，如同成功则完全无效的豁免一样。绝不能与 `save` 同用。5e merrow 的 Harpoon，“与 merrow 作力量对抗，否则被向 merrow 拉近至多 20 英尺”，带 `pull: 20`。

进入被其命中者体内的生物（Capability API 1.696）。生物行动的 `dismisses` 可以在 `while` 旁带 `"possesses": true`：行动生效后，若目标持有它施加的 `while` 状态，离开战斗的是生物自身，而不是目标；一旦目标不再持有该生物施加的此状态，无论以何种方式结束，生物都会回到目标身旁。为 `while` 指定带 `"controls": true`(1.577) 的战斗状态，使目标在持有状态期间为该生物的一方战斗，即使生物不在场也一样；再带 `"endsWhenHolder": {"downed": true}`，使状态在目标倒下时结束。ghost 的 Possession：`{"id": "possession", "budget": "action", "reach": 5, "save": {"save": "cha_save", "difficulty": 13, "onSuccess": "negates"}, "applies": [{"condition": "possessed", "duration": "until-dispelled"}], "dismisses": {"while": "possessed", "possesses": true}}`；Dispel Evil and Good 或 Break Enchantment 结束 `possessed` 时，也会让幽灵出来。绝不能与 `turns`、`gone` 或 `carries` 同用，也不能用于 `self` 行动。为状态设置 `"endable": {"budget": "bonus"}`(1.622)，就能让幽灵在身体的回合花费附赠动作，自愿离开。Dominate Person、Dominate Beast 和 Dominate Monster 不需要新设置：其带 `"controls": true` 的状态，在生效期间会让被支配者加入施法者的一方。

为区域内的人挡住更多状态（Capability API 1.697）。区域的 `keepsOut.cantGive` 和 `keepsOut.frees` 现在各自最多可指定 12 种状态（1.697 之前为 8 种）：Magic Circle 和 Hallow 的“不能被魅惑、恐惧或附身”，再加上规则集将这些表述涵盖的其他状态。

只对部分目标生效的生物行动附加效果（Capability API 1.698）。生物行动可以带 `"ridersIs"`，其目标测试与其他目标测试相同（`types`、`tags`、`upToSize`、`atLeastSize` 等）：施加状态（`applies`）、推开（`push`）、拉近（`pull`）或送走（`dismisses`）只会作用于符合测试的目标，且只与这样的目标进行 `contest`(1.695)；伤害则对任何被其命中的人照常生效。5e merrow 的 Harpoon，“如果目标体型为巨型或更小，就必须在与 merrow 的力量对抗中成功，否则被向 merrow 拉近至多 20 英尺”：`"contest": {"attacker": ["athletics"], "defender": ["athletics"]}, "pull": 20, "ridersIs": {"upToSize": "huge"}`。同样的结构也适用于只能控制特定体型生物的擒抱或吞咽。行动必须具有可供此测试收窄的效果。

从文
字阵
营读
取标
签（Capability API 1.699）。生物
可以
带 `"alignment": "lawful evil"`，`combat.creatureTypes` 则可
以带 `"tagsFrom": "alignment"`，指定
角色
的文
本或
选择
字段。对 `creatureTypes.tags` 中的
每个
标签，若文
本按
标签
或 ID 以完
整单
词、不区
分大
小写
匹配
到它，就将
其加
入标
签，保留 `tags` 中原
本指
定的
标签；跟在“non-”或“not”后面
的词
不指
定任
何标
签，因此“any non-good alignment”不会
产生 `good`。声明 `lawful`、`chaotic`、`good`、`evil` 和 `neutral` 等标
签后，所有
目标
测试
就能
像读
取任
何标
签一
样读
取阵
营：Talisman of Pure Good 只杀
死邪
恶者
的裂
隙，`"targetTypes": {"is": {"tags": ["evil"]}}`；Holy Avenger 或 Protection from Evil and Good 也可
以同
样收
窄目
标。“Any alignment”和“unaligned”不指
定任
何标
签。

只对部分穿戴者生效的物品数值（Capability API 1.700）。物品可以带 `statsIf`，最多 4 行 `{"needs": [...], "needsAny": true, "add": {"spell_attack_bonus": 2}}`：在穿戴期间（需要绑定时还须已绑定），每行按照 `binds.needs`(1.667) 的方式读取穿戴者人物卡；满足该行全部 `needs`，或带 `needsAny` 时满足任一要求，就将 `add` 加到物品自身的数值 `stats` 上（缺失项按 0 计），因此所有读取这些数值的 `itemStat` 都会计入。5e 的 Talisman of Pure Good：只允许善良者同调（`binds.needs` 读取阵营的 `wordsTable`，1.690），并用 `"statsIf": [{"needs": [{"value": {"track": "cleric_level"}, "atLeast": 1}, {"value": {"track": "paladin_level"}, "atLeast": 1}], "needsAny": true, "add": {"spell_attack_bonus": 2}}]` 表达善良牧师或圣武士获得的“法术攻击掷骰 +2”。

伤害拿起者的物品（Capability API 1.701）。物品可以带 `touchHarms`，最多 4 行 `{"needs": [...], "needsAny": true, "dice": "8d6", "flat": 0, "type": "radiant"}`：每当物品在游戏物品栏中进入某人手中（加入其背包、交给对方，或获得更多同种物品），就按照 `binds.needs`(1.667) 的方式读取其人物卡，取满足 `needs` 的第一行掷骰，并从其生命值中扣除（伤势轨道则增加一个最轻种类的印记），日志也会说明；没有 `needs` 的行对任何人都满足。5e 的 Talisman of Pure Good，使用阵营 `wordsTable`(1.690)，将善良读作 1、邪恶读作 -1：`[{"needs": [{"value": {"derived": "goodness"}, "atMost": -1}], "dice": "8d6", "type": "radiant"}, {"needs": [{"value": {"derived": "goodness"}, "atMost": 0}], "dice": "6d6", "type": "radiant"}]`。赝品按其真实身份造成伤害（1.79）。生命值是什么由规则集指定。

只占据自身格子的范围（Capability API 1.702）。目录条目或物品使用的爆发 `area` 可以带 `"oneCell": true`：无论 `size` 多小，都只覆盖放置点所在的格子；没有它时，爆发至少会覆盖周围的格子。移动（`zone.move`，1.173；通过检定，1.694）或漂移时，也始终只占一格。5e 的 Sphere of Annihilation，一个 2 英尺的球体：`"area": {"shape": "burst", "size": 2, "oneCell": true}`，配合其 `zone`。只适用于固定在某一点的单个爆发：不能带 `around`、`copies` 或 `sizePerCostStep`。

护符辅助检定来移动区域（Capability API 1.703）。区域的 `move.check`(1.694) 可以带 `"holding": {"tags": ["sphere_talisman"], "adds": {"derived": "proficiency_bonus"}, "advantage": true, "distanceBy": {"abilityMod": "int", "times": 10, "add": 10}}`。移动者持有带 `tags` 中任一标签的物品时（人物卡上已穿戴且未掉落的物品，或生物持有的东西），会将从其人物卡读取的 `adds` 加到检定上，以 `advantage` 掷骰；如果已经控制该区域（最后一次由其移动），还可以将其移动至多 `distanceBy` 的距离：`add` 加上 `times` × 其属性调整值，至少为 `atLeast`。每部分都可省略，但至少要有一部分。5e 的 Talisman of the Sphere，“此次检定的熟练加值翻倍……让它悬浮移动 10 英尺，再额外移动等于 10 × 你的智力调整值的英尺数”：`adds` 提供熟练加值，并使用上述 `distanceBy`。

绝不妨碍生物的行动（Capability API 1.704）。状态的 `"unhinderedBy": ["Web"]` 按 ID 或标签指定绝不会妨碍其持有者的行动：这些行动留下的持续范围不会卷入持有者，因此其中的地面对持有者不算崎岖地面，也不会打击持有者或对其施加任何状态；这些行动本会对其施加的状态（命中后的束缚）也不会生效，日志记为免疫。5e 的 Web Walker 用 `keepsOn` 在巨型蜘蛛身上持续生效：“忽略蛛网造成的移动限制”，既包括 Web 法术，也包括它自身的 Web 攻击。

忽略部分掩护的攻击（Capability API 1.705）。状态的 `"coverIgnored": {"upTo": "half", "attacks": "spell"}` 允许持有者的攻击忽略至多 `upTo` 的掩护（`"half"` 或 `"three-quarters"`），也包括格子自身地面提供的半身掩护。`attacks`（`"weapon"`、`"spell"` 或 `"any"`）和 `blow`（`"melee"` 或 `"ranged"`）将其收窄为部分攻击。超过 `upTo` 的掩护仍完整计入，全身掩护则始终计入。5e 的 Wand of the War Mage 由魔杖通过 `keepsOn` 维持此状态：“进行法术攻击时忽略半身掩护”。Sharpshooter 写作 `{"upTo": "three-quarters", "attacks": "weapon", "blow": "ranged"}`，Spell Sniper 写作 `{"upTo": "three-quarters", "attacks": "spell"}`。

悬浮的物品（Capability API 1.706）。物品的 `toggle` 可以带 `"freesSlots": true` 和 `"rounds": 10`。开启时，它占用的槽位被腾空，因此旁边的两用武器可以使用其 `versatile` 骰子造成伤害，物品栏也能在该手中容纳其他东西，而它仍保留穿戴时的一切作用。经过持有者的 `rounds` 个回合后，以及战斗结束时，它会自动关闭；在战斗中关闭时，如果没有空间容纳它，就会掉落（日志记为已掉落）。带 `freesSlots` 的物品必须占用一些 `slots`。5e 的 Animated Shield：`{"label": "Animate", "budget": "bonus", "freesSlots": true, "rounds": 10}`，“它悬浮在你的空间中，像你持用它时一样保护你，让双手空出来”。

听从命令、以召唤者的数值攻击的生物召唤物（Capability API 1.707）。生物行动的 `calls` 可以像目录条目一样（1.558）带 `"commandedWith": "bonus"`：召唤出的生物只按召唤者的命令行动，召唤者须在它们除首个回合以外的每个回合支付 1 点该额度。还可带 `"fromCaller": {"action": "greatsword"}`：它们的攻击使用召唤者自身指定攻击的命中加值和伤害。5e solar 的 Flying Sword：`{"creature": "creatures/flying-sword", "count": {"flat": 1}, "commandedWith": "bonus", "fromCaller": {"action": "greatsword"}, "endsWithCaller": true}`。

某些生物轻松通过或会受伤的地面（Capability API 1.708）。状态的 `"easyGround": ["snow", "Sleet Storm"]` 让持有者在指定地块上、指定地点的整个棋盘上，以及按 ID 或标签指定的行动留下的持续范围中，通过崎岖地面时只需普通一步的费用。5e 白龙的 Ice Walk 通过 `keepsOn` 持续生效：“冰雪构成的困难地形不会消耗额外移动力”，包括雪地棋盘和 Sleet Storm 的冰面。状态的 `"harmedEntering": {"terrain": ["water"], "zones": ["Wall of Water"], "harm": {"flat": 1, "damageType": "cold"}}` 会在持有者每走入上述地块或指定行动的持续范围内的一格时，对其造成该伤害，不作豁免；`terrain` 和 `zones` 至少要有一项。5e 火元素的 Water Susceptibility，“元素在水中每移动 5 英尺……受到 1 点寒冷伤害”。

巨量伤害（Capability API 1.709）。战斗块的 `dying` 可以带 `"instantDeath": "overflow-at-least-max"`：当打击使本应倒地濒死的人生命值降到 0，且溢出伤害至少等于其生命值最大值时，对方改为立即死亡；其倒下期间受到至少如此之大的打击，也会死亡。先由临时生命值吸收伤害；有独立生命值的形态，只计穿过该形态后剩余的伤害。本就在生命值为 0 时死亡的生物不受影响。保留在 1 点生命值的效果，只有在它能防止被直接杀死时才挡得住（`hangsOn.outright`，1.596）：Death Ward 能挡住，Relentless Endurance 不能。日志会说明对方死于巨量伤害。在 Held Ground 上，仍像往常一样被放倒。

附赠动作施法规则（Capability API 1.710）。战斗块可以带 `"casting": {"afterBonusSpell": {"catalogs": ["spells"], "budget": "bonus", "only": {"level": 0, "budget": "action"}}}`。在自己的回合，一旦用附赠额度施放了这些目录中的条目，该回合剩余时间就只会提供这些目录中以 `only.budget` 施放、等级至多为 `only.level` 的条目：即用行动施放的戏法。反过来，一旦以任何其他方式施放过其中的条目，例如用行动施放有等级的法术，该回合就不会再提供用附赠额度施放的条目。先用行动施放戏法，仍可施放附赠动作法术。等级指条目支付时的等级，戏法为 0。通过使用时会施放这些目录中条目的物品施法，例如卷轴，也计入。Quickened 法术算作用附赠额度施放。在他人的回合施法，无论是反应还是释放已预备的法术，都不计入。

目标穿戴的物品（Capability API 1.711）。任何目标测试（`targetIs`、`is`、`not`、`except`、`anyOf`）都可以带 `"wears": {"tags": ["metal"]}`：只有穿戴带这些标签之一的物品才通过；对角色，读取人物卡上穿戴的物品，对生物，则读取其自身的 `"wears": ["armor", "metal"]`。例如 5e 的 Shocking Grasp 对穿戴金属护甲的目标具有优势，Heat Metal 的目标，以及 rust monster 的 Antennae。单凭穿戴要求就构成完整测试，与类型或标签并列时则两者都须满足。

受伤时带优势或劣势的豁免（Capability API 1.712）。状态的 `saveWhenDamaged`(1.125) 会在持有者每次受到伤害时重复其 `saveEnds` 豁免，现在可用 `{"lean": "advantage"}` 代替 `true`：该豁免以优势（或劣势）掷骰。`saveEnds.at` 指定时刻的豁免仍按原样掷骰。5e 的 Hideous Laughter：`saveEnds` 在回合结束时掷骰，状态上带 `"saveWhenDamaged": {"lean": "advantage"}`。如果 `seenLean`(1.268) 也影响该豁免，相反的优势与劣势会相互抵消。

从多个字段读取角色标签（Capability API 1.713）。`combat.creatureTypes.tagsFrom`(1.699) 可以是文本或选择字段的列表，`["race", "alignment"]`：每个字段都按单个字段的方式读取，在任一字段中按标签或 ID 以完整单词匹配到的所有 `tags` 条目都会计入，所有字段的标签全部保留。种族写为“High Elf”的人物卡会带有 `elf`，因此 ghoul 的 Claws 带 `ridersIs {"except": {"tags": ["elf"]}}`(1.698) 时，会像跳过精灵生物一样跳过精灵玩家角色。

只在特定地面上生效的状态（Capability API 1.714）。状态的 `heldOnlyIn`(1.605) 可以指定 `"ground": ["water", "Running Water"]`：只有持有者站在这些名称指定的棋盘地块、整个棋盘地点（其环境），或按 ID 或标签指定的行动留下的持续范围中时，状态才生效，其占据的任一格满足即可；在其他地方，以及不在棋盘上时，状态被压制，而不是结束。5e 的吸血鬼：持续生效的状态带 `"heldOnlyIn": {"ground": [...]}`，并有对自身（`self: true`）造成 20 点强酸伤害的 `harms` 光环。棋盘只有一种水地块，因此指定 `water` 就会把棋盘上的所有水都算作流水；区分静水的规则集应改为只指定流水的持续范围，由河流的水流或 Control Water 等行动留下。与 `light` 或 `allySeenWithin` 并列时，每一项都必须满足。

控制着他人时不可用（Capability API 1.715）。生物行动或目录条目的机制可以带 `"unlessImposing": ["grappled"]`：只有使用者没有对仍持有这些状态的任何其他人施加其中任一状态时，才会提供该行动。5e 的 ankheg，其 Acid Spray 只在没有擒抱他人时可用。

生物自身的跳跃能力（Capability API 1.716）。生物可以带 `"jump": {"long": 30, "high": 15, "withoutRunUp": true}`，采用规则集的距离单位：以此跳跃距离代替 `combat.jumping`(1.499) 从其属性读取的距离；有助跑时可跳这么远，没有助跑时则按规则集的 `standing` 处理，除非 `withoutRunUp` 使其仍能跳完整距离。状态的 `jumps` 所作的倍乘或加值仍然生效。5e bulette 的 Standing Leap：无论是否助跑，都能跳远 30 英尺、跳高 15 英尺。

由坐骑穿戴（Capability API 1.717）。物品的 `worn` 效果可以写作 `{"wornBy": "mount", "keepsOn": ["horseshoes_of_speed"]}`：持有者穿戴它并骑乘生物时，它持续施加的状态（1.513，`when` 行从骑手的人物卡读取）改为作用于坐骑；无论持有者是否骑乘，都没有任何效果作用于持有者。上坐骑或下坐骑时重新读取。5e 的 Horseshoes of Speed 使用让马的行走速度增加 30 英尺的状态，Horseshoes of a Zephyr 则使用带 `walksOnLiquid` 的状态。带 `wornBy` 时，效果只能包含 `keepsOn`，不能有其他内容。

抵抗被迫移动（Capability API 1.718）。状态可以带 `"pushReducedBy": {"by": 10, "budget": "reaction"}`：每当持有者违背意愿沿地面移动时（被推开、拉近或挤出范围），移动距离就减少指定量，采用规则集的距离单位；指定额度时须支付 1 点该额度，且只有仍有该额度时才能生效。身处空中时绝不生效。日志会说明。5e 的 Dwarven Plate，是通过 `keepsOn` 持续施加此类状态的物品。

透过墙壁看见（Capability API 1.719）。`combat.senses` 中的感官可以带 `"throughWalls": true`：在其射程内，观察者与所见之物之间的墙壁不会遮挡任何东西。黑暗、雾和隐形仍像对视觉一样造成阻碍。5e 的 Ring of X-ray Vision 就是这种感官，穿戴戒指期间射程为 30 英尺：`{ "id": "xray", "label": "X-ray Vision", "sheet": { "derived": "xray_vision" }, "throughWalls": true }`。其他限制（铅、厚度、第二次使用的力竭）交由游戏主持人（GM）处理。使用它的规则集需要 Capability API 1.719。

击昏（Capability API 1.720）。`combat.dying` 可以带 `"knockOut": {"blow": "melee", "condition": "unconscious"}`：每个角色都会获得一个无需花费额度的开关，每回合可切换一次（也能再切回一次，以撤销误点），用来收力攻击（`label`，默认为“收力攻击，将目标击昏”）。开启时，其近战攻击将某人生命值降到 0，就会改为将其击昏：退出战斗、昏迷且稳定，绝不会濒死或被杀死。被这样击败的对手会活着退出战斗，战斗摘要将其标为 `knockedOut`；角色也会在濒死 `condition` 下稳定地躺着。仍会直接杀死的效果（巨量伤害、致死的打击）照常杀死。即 5e 击昏生物的规则。

施法制造的物品（Capability API 1.721）。目录条目的 `mechanics` 可以带 `"makesItems": {"item": "items/goodberry", "count": 10}`，指定规则集的一件物品：角色在战斗中施放时，会将指定数量的物品放到自己手中，在那里像使用任何持有物品一样使用它们（浆果自身的 `use`）；战斗结束时，剩余物品会写入其背包，与原本携带的同种物品叠放在一起。5e 的 Goodberry 写作 `utility` 条目，其 `targets` 为 `"self"`。战斗外，由游戏主持人（GM）通过物品栏给予物品，持续时间也由其记录（Goodberry 为一天）。物品自身的 `use` 不能制造物品。

完全无效的休息（Capability API 1.722）。`combat.conditions` 中的状态可以按休息 ID 指定 `"blocksRests": ["long"]`，或指定 `"all"`：人物卡持有该状态期间，对应休息完全无效（不影响资源池、轨道、骰子，不作清除，也不影响状态），人物卡会显示“长休息：诅咒期间无法获得收益”。5e rakshasa 的诅咒，“完成短休或长休息均无法获得任何收益”，在爪击施加的状态上写作 `"all"`，持续到被移除诅咒的效果结束。使用它的规则集需要 Capability API 1.722。

掷骰反射（Capability API 1.723）。`combat.conditions` 中的状态可以带 `"reflects": {"sides": 6, "backFrom": 6, "against": {"catalogs": ["spells"], "entries": ["spells/magic-missile"], "area": ["line"], "attackRoll": "ranged"}}`。敌人用这些目录之一的条目指向持有者时，如果条目属于 `entries` 之一、范围形状属于 `area` 之一，或进行远程攻击掷骰（`attackRoll`），就改为掷该骰子：持有者完全不受影响，结果达到或超过 `backFrom` 时，效果会被反射给施放者，施放者就像自己是其目标一样承受效果。范围卷入的所有其他人仍照常承受。日志会说明是哪种结果。5e 的 tarrasque 通过持续生效的此类状态（`keepsOn`）表达 Reflective Carapace。使用它的规则集需要 Capability API 1.723。

目标选择的豁免（Capability API 1.724）。生物行动或目录条目 `mechanics` 上的豁免可以带 `"or": "dex_save"`：目标会在 `save` 和 `or` 中选择自己更擅长的一项作豁免，日志会说明所作的豁免。5e bulette 的 Deadly Leap 要求“力量或敏捷豁免（由目标选择）”：`{"save": "str_save", "or": "dex_save", ...}`。使用它的规则集需要 Capability API 1.724。

跃到其他生物身上（Capability API 1.725）。
生物的行动可以带 `"leapsOnto": {"atLeast": 15, "noRoom": "prone"}`。
在棋盘上，
它和跳跃一样通过选择格子来选定：
生物使用自身的移动，
按 `combat.jumping` 和自身的 `jump` 所允许的方式，
跳跃至少 `atLeast` 的距离（以规则集的距离单位计），
落入一个或多个其他生物占据的空间，
也可以是敌人。
它需要 `combat.jumping`，
且不带范围。
它落到的每个生物都进行该行动的豁免：
失败时照常承受行动的伤害和 `applies`，
成功时若有 `"onSuccess": "half"` 则承受一半伤害。
随后将每个生物移到它空间之外、与它相邻的位置。
豁免成功却没有位置可安置的生物留在原地，
受到 `noRoom` 状态。
不在棋盘上时，
按该行动原本的方式瞄准。
5e 中 bulette 的 Deadly Leap：`{"leapsOnto": {"atLeast": 15, "noRoom": "prone"}, "save": {"save": "str_save", "or": "dex_save", "difficulty": 16, "onSuccess": "half"}, "applies": [{"condition": "prone"}], ...}`。
使用它的规则集需要 Capability API 1.725。

针对具备某种特征的目标的攻击（Capability API 1.726）。`to` 为 `"attacks"` 或 `"damage"` 的调整值可以带 `"at"`，
它与 `from` 一样是目标测试：
该改动只影响持有者自身对符合测试的目标所作的攻击或造成的伤害。
5e 的 Demon Armor：`{"to": "attacks", "mode": "disadvantage", "at": {"tags": ["demon"]}}`。
使用它的规则集需要 Capability API 1.726。

维持生物行动的效果（Capability API 1.727）。
生物的行动可以带 `"sustains": {"budget": "bonus"}`，
与目录条目的 `mechanics` 一样（1.431）：
它向生物施加的效果一旦生效，
便可在后续回合用该额度维持，
让所施加效果的轮数重新开始，
不作豁免，
也不消耗其他任何资源。
它施加的状态要持续若干轮。
5e 中 harpy 的 Luring Song。
使用它的规则集需要 Capability API 1.727。

生物行动布下的墙（Capability API 1.728）。
生物行动的 `area` 可以是 `"wall"`，
与目录条目一样（1.177）：
长度为 `size`，
厚度为 `width`，
带 `ring` 时还可以改为布成直径为该值的环，
带 `ringOnly` 时则始终为环。
墙只能持续留在原地，
因此行动带有 `zone`，
可以 `block`，
可以分成 `sections`(1.200)，
也可以让破碎的墙段发挥相应作用，
对抗该行动自身的豁免；
墙会留在布下的位置。
5e 中 ice devil 的 Wall of Ice：
长 30 英尺的墙或直径 20 英尺的穹顶，
墙段的 AC 为 5、生命值为 30，
火焰对其造成更多伤害，
破碎的墙段处留有严寒空气。
使用它的规则集需要 Capability API 1.728。

更多派生值（Capability API 1.729）。
人物卡的 `derived` 值上限从 400 提高到 800，
原先的上限已不够容纳 5e 的护甲训练。
声明超过 400 个派生值的规则集需要 Capability API 1.729。

以自身等级施放的物品使用，
以及阻止所回应效果的物品使用（Capability API 1.730）。
物品的 `use` 可以指定其施放的 `level`，
即卷轴所载法术的等级：
凡是读取条目支付时的等级的机制都会读取它，
包括反应的 `"upTo": "paid"`。
此外，`"utility"` 类型的使用可以仅包含一个会 `cancels` 的 `reaction`，
其 `upTo` 和 `above` 与目录条目的 Counterspell 相同（1.116）。
5e 的 Counterspell 卷轴：`{"kind": "utility", "budget": "reaction", "consumes": true, "level": 3, "reaction": {"on": "used", "cancels": true, "against": {"catalogs": ["spells"]}, "upTo": "paid", "above": {"check": {"abilityModFromField": "spellcasting_ability"}, "dc": 10}}}` 会直接阻止 3 级或更低等级的法术；
对更高等级的法术，
阅读卷轴者须通过对抗 10 加该法术等级的检定才能阻止。
带 `"upTo": "paid"` 的物品使用须有 `level`。
使用其中任一功能的规则集需要 Capability API 1.730。

列出多个值的构建步骤筛选项（Capability API 1.731）。
引导式构建器的 `catalog` 步骤可以在 `filters` 中为某个筛选项提供一个值列表，
最多 12 个；
匹配其中任一值的条目都会提供：
5e 中 bard 的 Magical Secrets，
可选任何职业的法术或戏法，`{"kind": ["spell", "cantrip"]}`，
同时排除目录中其他类型的条目。
使用它的规则集需要 Capability API 1.731。

物品只在尚有余量时发挥的作用（Capability API 1.732）。
物品的 `worn` 或 `carried` 效果可以指定 `"whileLeft"`，
最多 4 行 `{"keys": [...], "charges": true}` 或 `{"keys": [...], "uses": "<a further use's label>"}`：
效果中由 `keys` 指定的部分，
仅在物品还有充能，
或该项额外使用仍有次数时生效；
该项额外使用须自行计算使用次数（1.519）。
在人物卡上，
按物品叠保存的余量读取；
在战斗中，
按战斗消耗后的余量读取。
5e 的 Helm of Brilliance，`[{"keys": ["resist"], "uses": "Wall of Fire"}, {"keys": ["keepsOn"], "charges": true}]`：
还有红宝石时具有火焰抗性，
还有钻石时发出灼烧不死生物的光。
使用它的规则集需要 Capability API 1.732。

随召唤者退场而结束的条目或物品召唤（Capability API 1.733）。
目录条目或物品的 `calls` 可以指定 `"endsWithCaller": true`，
与生物的召唤一样（1.446）：
召唤者一旦退场，
它召唤的生物就离开。`"incapacitated"` 还会在召唤者倒下或持有任何带 `cannot-act` 的状态时，
立即让它们离开。
5e 的 Feather Token (whip)，
“当你失能或死亡时消失”：`{"calls": {"creature": "monsters/feather_whip", "count": {"flat": 1}, "rounds": 600, "endsWithCaller": "incapacitated"}}`。
使用其中任一功能的规则集需要 Capability API 1.733。

能理解别人却不让别人理解自己（Capability API 1.734）。
战斗状态的 `languages` 可以是 `"understands"`：
持有者能理解所有语言，
因此要求目标理解使用者的行动（`targetTypes.understands`）可以作用于它，
但这不会让任何其他生物更能理解它。`"all"`(1.648) 优先于它，`"none"` 则优先于这两者。
5e 的 Comprehend Languages，
以及 Helm of Comprehending Languages 对该法术的施放。
使用它的规则集需要 Capability API 1.734。

被骑乘时生效的光环（Capability API 1.735）。
状态的光环可以指定 `"whileRidden": true`：
只有在有人骑乘持有者时才扩散，
并按骑乘者所属的一方读取其 `side`，
因此 `"enemies"` 指骑乘者的敌人。
5e 的 goat of terror，
通过 `keepsOn` 持续生效：`{"distance": 30, "side": "enemies", "whileRidden": true, "save": {"save": "wis_save", "difficulty": 15, "applies": [{"condition": "frightened", "duration": {"rounds": 10}}]}}`。
使用它的规则集需要 Capability API 1.735。

由行动指挥的召唤（Capability API 1.736）。
生物行动的 `calls` 可以指定 `"commandedBy": {"action": "multiattack"}`，
指向同一生物的某个行动：
这样一来，
召唤出的生物只有在召唤者自它的上个回合以来使用过该行动时，
才会在自己的回合行动，
否则跳过。
生物召唤也可以指定 `"endsWithCaller": "incapacitated"`，
在召唤者失能或死亡时让召唤出的生物离开，
与自 1.733 起目录召唤可用的功能相同。`commandedBy` 不能与 `commandedWith` 同用。
5e 的 chain devil，
其 Animate Chains 只通过它的 Multiattack 行动：`{"calls": {"creature": "animated-chain", "count": 4, "initiative": "after", "commandedBy": {"action": "multiattack"}, "endsWithCaller": "incapacitated"}}`。
使用它的规则集需要 Capability API 1.736。

将武器加值转移到防御（Capability API 1.737）。
物品的 `attack` 可以带 `"bonusToDefense": {"upTo": 3}`：
持用者每回合首次用它攻击前，
可以免费将它的 1 至 `upTo` 点加值转移到自身防御上。
每个数值都有独立的开关（由 `label` 命名，
默认为物品名称）。
该回合中，
这件武器的攻击失去等量的命中和伤害加值，
而持用者的防御保留这些加值，
直到其下个回合开始。
5e 的 Defender，
一把 +3 武器：`{"attack": {..., "toHit": {..., "bonus": 3}, "damage": {..., "bonus": 3}, "bonusToDefense": {"upTo": 3, "label": "Defender"}}}`。
使用它的规则集需要 Capability API 1.737。

条目针对特定目标的攻击（Capability API 1.738）。
目录条目的 `mechanics` 或物品的 `use` 可以带 `against`，
与武器的 `attack` 一样（1.187）：
最多 4 项 `{"is", "marked", "toHit", "mode", "ignoresCover", "ignoresLongRange"}`，
改变它对匹配目标的攻击掷骰。
5e 的 Shocking Grasp，
对穿戴金属的目标具有优势（1.711 的 `wears` 会读取人物卡上穿戴或手持的任何东西，
包括金属武器）：`{"against": [{"is": {"wears": {"tags": ["metal"]}}, "mode": "advantage"}]}`。
使用它的规则集需要 Capability API 1.738。

召唤借出的武器（Capability API 1.739）。
带 `calls` 的物品 `use`(或其某个 `moreUses`)可以带 `"wieldsWhileCalled": {"items": ["gear/goat-horn-lance", "gear/goat-horn-longsword"], "takes": "action"}`：
最多列出规则集中的 4 把武器（带 `attack` 的物品），
使用者仅在该项使用召唤出的某个生物仍站着时持用这些武器。
带 `takes` 时，
每把武器都要先花该额度拿到手中（通过“Take”开关），
并在提供武器的生物仍站着期间归使用者持用。
它们不占任何槽位，
也绝不写入背包。
5e 的 Figurine of Wondrous Power，
goat of terror：
山羊自身没有攻击，
它的角分别是一把 +1 长枪和一把 +2 长剑，
取下一只角需要一个行动，
山羊变回原形时武器消失。
使用它的规则集需要 Capability API 1.739。

施加者未对任何生物维持指定状态时才能施加的状态（Capability API 1.740）。`applies` 中的条目可以带 `"unlessImposing": ["grappled"]`，
与行动自身的相同（1.715）：
只有当施加者没有对任何生物维持其中任一状态时，
它才会施加；
同一列表中通过 `endsWith` 与它关联的效果也同样受此限制。
5e 中 chain devil 的 Chain，
“如果魔鬼尚未擒抱生物，
则目标被擒抱（逃脱 DC 14）”，
其束缚通过 `endsWith` 随擒抱结束：`[{"condition": "grappled", "unlessImposing": ["grappled"], ...}, {"condition": "restrained", "endsWith": "grappled", ...}]`。
使用它的规则集需要 Capability API 1.740。

创造者失能时结束的范围（Capability API 1.741）。
目录条目或生物行动上的 `zone` 可以指定 `"endsWithCaller": "incapacitated"`：
除了在轮数耗尽时结束，
它还会在创造者倒下、退场或持有任何带 `cannot-act` 的状态时立即结束。
绝不能与 `outlasts` 同用。
5e 中 ice devil 的 Wall of Ice，
“直到魔鬼失能或死亡”。
使用它的规则集需要 Capability API 1.741。

次数耗尽后结束的召唤（Capability API 1.742）。
目录条目或物品使用的 `calls` 可以指定 `"endsWhenSpent": true`：
召唤出的生物所有自行计算 `uses` 的行动都耗尽次数后，
它们便离开，
而它们变成的物品（`becomesItem`，
1.613）回到持有者手中。
5e 的 Dancing Sword，
“悬浮之剑第四次攻击后”：
悬浮之剑的攻击带 `"uses": {"per": "encounter", "count": 4}`。
使用它的规则集需要 Capability API 1.742。

更多感官（Capability API 1.743）。`combat.senses` 的感官数量上限由 8 提高到 12：
5e 的 Ring of X-ray Vision 所需的是第九种。
超过 8 种感官的规则集需要 Capability API 1.743。

休息前再次使用物品的代价（Capability API 1.744）。
物品的 `use` 可以指定 `againBeforeRest`，
其中包含会清除计数的 `rests`、一次 `save`(`save`、`difficulty`)，
以及豁免失败对使用者造成的后果：
移动 `tracks`(每项指定 `track` 和 `by`)和施加 `conditions`，
可指定其中一种或两种。
自上述某次休息以来的首次使用没有额外代价；
之后每次使用都要求该豁免。
计数保存在物品叠上，
战斗内外都如此，
并由指定的休息清除。
只有在检定采用骰子总和的规则下才掷该豁免。
5e 的 Ring of X-ray Vision：`{"rests": ["long"], "save": {"save": "con_save", "difficulty": 15}, "tracks": [{"track": "exhaustion", "by": 1}]}`。
使用它的规则集需要 Capability API 1.744。

使用物品所制造的物品（Capability API 1.745）。
物品的 `use` 可以指定 `makesItems`(`item`、`count`)，
与目录条目的机制一样（1.721）：
在战斗中使用时，
相应数量的物品会放到使用者手中，
在战斗中和其他手持物品一样使用，
并在战斗结束时写入背包；
在战斗外使用时，
制造的物品直接进入背包，
与原物品放在一起。
Goodberry 卷轴，`{"item": "gear/goodberry", "count": 10}`。
使用它的规则集需要 Capability API 1.745。

为每个物品叠掷骰确定额外使用的次数（Capability API 1.746）。
物品可以指定 `moreUsesRolled`，
包含 `dice` 和 `weights`，
按其 `moreUses` 的顺序为每项额外使用提供一个权重，
且每项都自行计算 `uses`。
每个物品叠生成 `dice` 所掷数量的单件，
每件按各项权重占总权重的比例随机分配给一项额外使用；
每项额外使用的次数等于分配给它的单件数（绝不超过其 `max`；
没有分到单件就没有次数，
也绝不会提供）。
按物品叠的 id 掷骰一次，
之后每次读取都相同；
其 `uses.recharge` 也恢复这个数量。
5e 的 Necklace of Prayer Beads，
1d4 + 2 颗珠子，
共六种：`{"dice": "1d4+2", "weights": [6, 6, 4, 2, 1, 1]}`，
每种对应一项额外使用，
带 `{"max": 6, "recharge": {"rests": ["long"], "amount": "max"}}`。
使用它的规则集需要 Capability API 1.746。

消耗另一项次数的额外使用（Capability API 1.747）。
物品的某个 `moreUses` 可以用 `usesOf` 指定另一项自行计算 `uses` 的额外使用的标签，
且自身不带 `uses`：
只要被指定的那一项还有次数，
它就会提供，
并从那一项扣除次数，
战斗内外都如此。
带 `moreUsesRolled` 时，
它的权重为 0。
5e 的 Necklace of Prayer Beads，
一颗治疗珠：`Cure Wounds` 带该珠的 `uses`，
而 `Lesser Restoration` 带 `"usesOf": "Cure Wounds"`。
使用它的规则集需要 Capability API 1.747。

从目录读取的候选中随机确定的召唤（Capability API 1.748）。
带 `from` 的召唤（`calls`）可以指定 `"rolled": true`：
使用时，
从读取到的生物中等概率为使用者随机选定一个，
而非由使用者挑选；`keepsRoll` 和 `lifetimeUses` 的作用与随机确定的 `options` 相同。
没有 `rounds` 时，
它们会留到被遣散或退场为止。
5e 的 Necklace of Prayer Beads，
召唤珠的 Planar Ally，
由神祇选择：`{"from": {"catalog": "creatures", "filters": {"type": ["celestial", "elemental", "fiend"]}}, "count": {"flat": 1}, "rolled": true}`。
使用它的规则集需要 Capability API 1.748。

只有额外使用的物品（Capability API 1.749）。
带 `moreUsesRolled` 的物品可以没有自身的 `use`：
战斗内外，
它的菜单都只包含额外使用，
某个物品叠中随机结果为零次的额外使用绝不会提供。
5e 的 Necklace of Prayer Beads，
每颗珠子都对应一项额外使用。
使用它的规则集需要 Capability API 1.749。

随天数推移累计成功次数并造成伤害的豁免，
以及无法治疗的伤害（Capability API 1.750）。
带 `"at": "days"` 的 `saveEnds` 可以指定 `successes`(2 至 10)：
只有成功通过这么多次豁免后，
状态才结束，
次数在持有者的人物卡上跨天累计（失败不会重置任何计数）。
它还可以指定 `harmsOnFail: { "dice", "flat", "type" }`，
每天的豁免失败时对持有者的生命值造成该伤害。
指定 `keepsDamage: true` 的战斗状态会让自身造成的伤害（它的 `harms` 以及每日豁免造成的伤害）在状态持续期间无法治疗：
伤害会降低持有者的生命值最大值，
在状态结束之前，
无论任何治疗或休息都无法恢复；
状态以何种方式结束都可以。
在战斗中，
数值块的生命值也按相同方式处理。
5e 的 Pale tincture：
在其施加效果上写 `"saveEnds": { "save": "con_save", "at": "days", "days": 1, "successes": 7, "harmsOnFail": { "dice": "1d6", "type": "poison" } }`，
在其状态上写 `keepsDamage`。
使用其中任一功能的规则集需要 Capability API 1.750。

持续到午夜的状态，
以及豁免成功时减半的结束伤害（Capability API 1.751）。
所施加状态的 `lastsDays` 可以是 `"midnight"`：
在战斗中不计时；
若战斗结束时人物卡仍持有它（或在战斗外由物品使用施加），
它会在人物卡下次通过 `pass` 推进一天时结束。
它的 `onEnd.harm` 可以指定 `save: { "save", "difficulty", "onSuccess": "half" }`，
在造成伤害时由持有者掷骰，
成功则伤害减半，
战斗中和天数推移时都如此。
在战斗外，
结束伤害会在持续天数耗尽（`expired`）或每日豁免使其结束（`save`）时，
按 `onEnd.when` 允许的情况造成；
治愈绝不造成该伤害，`when: ["expired"]` 也会阻止战斗中的治愈造成该伤害。
5e 的 Midnight tears：`"lastsDays": "midnight"`，
配合 `"onEnd": { "harm": { "dice": "9d6", "type": "poison", "save": { "save": "con_save", "difficulty": 17, "onSuccess": "half" } }, "when": ["expired"] }`。
使用其中任一功能的规则集需要 Capability API 1.751。

为特定目的所作的检定（Capability API 1.752）。`checks` 调整值可以指定 `for: ["climb", "swim"]`：
只改变游戏主持人（GM）的标签以 `for="climb"` 或 `for="swim"` 标注的检定（不区分大小写），
绝不影响同一技能用于其他目的的掷骰，
也绝不影响战斗自身的检定（擒抱或推撞），
因为这些检定没有指定此类目的。
GM 会获知规则集的状态和目录中列出的每种目的，
记录也会保留 `for=`。
5e 的 Gloves of Swimming and Climbing：
穿戴时带 `{ "to": "checks", "skills": ["athletics"], "flat": 5, "for": ["climb", "swim"] }`。
使用它的规则集需要 Capability API 1.752。

Forbiddance 的选择及其对传送进入的禁止（Capability API 1.753）。
区域的 `forbids.teleport` 可以是 `"into"`：
无论区域本身作用于谁，
任何生物都不能传送进入，
但仍可在区域内部传送或传送出去，
任何被一同携带传送的生物也不能落在区域内。
带区域的条目（或物品使用）可以指定 `"kindChoice": "many"`：
使用者施放时，
从 `combat.creatureTypes` 的类型和标签中指定一种或多种；
若其 `targetTypes.is` 列出了类型和标签，
则只能从所列内容中选（Forbiddance 的五种）（选项以 `kindsOf` 列出它们，
选择则以 `kinds` 指定），
其区域只打击这些类型和标签，
取代 `targetTypes` 指定的类型；
若未指定任何类型和标签，
则打击 `targetTypes` 规定的目标。
造成伤害的条目可以指定 `"damageTypeChoice"`：
规则集中的两至八种伤害类型，
以模式（`damage-<type>`）提供，
所选类型决定条目本身和区域打击造成的伤害类型；
它与其他模式的选择方式相同，
因此不能同时选择其他作为模式提供的选项，
在战斗中施放而未作选择时则造成第一种类型的伤害。
若在战斗前设置，
GM 的 `standing` 用 `"kinds": [names]` 指定类型和标签，
用 `"mode"` 指定伤害类型；
未指定伤害类型时，
造成第一种类型的伤害，
并会说明。
5e 的 Forbiddance：`"kindChoice": "many"`、`"damageTypeChoice": ["radiant", "necrotic"]`、`"targetTypes": { "is": { "types": ["celestial", "elemental", "fey", "fiend", "undead"] } }`，
以及带 `"forbids": { "teleport": "into" }` 的区域。
使用其中任一功能的规则集需要 Capability API 1.753。

最多带 16 个行动的生物（Capability API 1.754）。
生物图鉴中的生物，
以及生物人物卡的数值块，
最多可以带 16 个行动，
原先为 12 个：
5e 的 vampire，
除了自身形态还有蝙蝠和雾气形态。
含有超过 12 个行动的生物的规则集需要 Capability API 1.754。

按所处位置判断的目标测试（Capability API 1.755）。
目标测试（`targetIs`、`targetTypes.is` 或 `not`，
以及其他读取目标测试的地方）可以指定 `insideZoneOf` 或 `outsideZoneOf`：
按 id(`magic-circle` 或 `spells/magic-circle`)或名称指定条目，
最多 8 个。`insideZoneOf` 只匹配站在其中任一条目留下的区域中的生物，
无论是谁施放的；`outsideZoneOf` 则只匹配不在这些区域中任何一个里的生物。
两者也都可用于 `except` 和 `anyOf`。
在战斗外，
没有生物算作站在区域中。
5e 的 Magic Jar，
不能附身于“受 protection from evil and good 或 magic circle 法术防护”的生物：`{"outsideZoneOf": ["magic-circle"], "except": {"holding": ["protected_from_evil"]}}`。
使用它的规则集需要 Capability API 1.755。

Wish 的负担（Capability API 1.756）。
状态的 `abilities` 可以在其他所有改动生效后，
仅当某个属性高于指定数值时将其降至该值，`{"atMost": 3}`(有多个时取最低值)；
它绝不会提高属性。
所施加状态的 `lastsDays` 可以在施加时掷骰确定，`{"dice": "2d4"}`，
带 `restingCounts`(2 至 7)时，
持有者休息的每一天都按该天数计算：
GM 的 `[sheet: op="pass" days="N" resting="yes"]` 表示这些天都用于休息。
5e 的 Wish 负担，
“如果你的力量尚未降到 3 或更低，
它会降至 3，
持续 2d4 天。
在此期间，
每休息一天且只做轻度活动，
剩余恢复时间就减少 2 天”：
状态带 `"abilities": {"str": {"atMost": 3}}`，
施加时带 `"duration": "until-dispelled", "lastsDays": {"dice": "2d4", "restingCounts": 2}`。
使用其中任一功能的规则集需要 Capability API 1.756。

恢复全部损失生命值的治疗（Capability API 1.757）。
带 `healsAll: true` 的 `heal` 会为每个目标恢复其全部损失的生命值，
不论指定的 `amount` 是多少（也无需指定）；
它不会分摊（`sharesHeal`），
也不会按使用次数分取（`usesChosen`）。
5e 的 Wish，
“你能看见的至多二十个生物恢复全部生命值”。
使用它的规则集需要 Capability API 1.757。

施放时选择的防护（Capability API 1.758）。
带 `applies` 的条目可以指定 `wardPick: true`：
使用时，
使用者从战斗中任意生物拥有的条目或生物行动中选一个（不包括人人都有的对抗，
例如擒抱），
它施加的每个状态都会让持有者免受该条目或行动的影响，
且只防护所选的那一个，
不限等级，
来源可以是除持有者自身之外的任何生物。
条目以 `<catalog>/<entry>` 指定，
没有对应条目的生物行动则以小写的 `action:<its name>` 指定。
菜单要求恰好选一个（选择的 `kinds`，
一个 id），
生物自行选择时取第一个。
以 `until-dispelled` 施加的状态会将其防护的对象保存在持有者的人物卡上，
供后续战斗使用。
5e 的 Wish，
“使你能看见的至多十个生物免疫某一个法术或其他魔法效果，
持续 8 小时”（例如 lich 的生命吸取）：`{"kind": "buff", "targets": "ally", "wardPick": true, "applies": [{"condition": "wished_ward", "duration": {"rounds": 4800}}]}`。
使用它的规则集需要 Capability API 1.758。

透视每种材料的厚度（Capability API 1.759）。
感官的 `throughWalls` 可以不用 `true`，
改为指定能透视每种材料的最大英寸数（1 至 16 种材料，
每种 1 至 1200 英寸）：
同一直线上的墙按材料累计厚度，
未列出的材料会阻挡该感官。
施放出来的阻挡视线的墙可以指定其 `material`，`{"of": "stone", "inches": 6}`。
棋盘本身的墙（墙或山脉地块、
阻挡视线的道具、
两点之间隆起的地面）采用 `combat.sight.boardWalls` 指定的材料和厚度，
每格都按该厚度计算，
例如 `{"of": "stone", "inches": 60}`；
未指定时，
以及施放的墙未指定材料时，
这种感官都无法透视。
5e 的 Ring of X-ray Vision，
“1 英尺厚的石头、1 英寸厚的普通金属，
或至多 3 英尺厚的木头或泥土。
更厚的物质会阻挡视线，
薄铅片也会”：`"throughWalls": {"stone": 12, "metal": 1, "wood": 36, "dirt": 36}`，
始终不列出铅；
Wall of Stone 用 `{"of": "stone", "inches": 6}`，
Wall of Iron 用 `{"of": "metal", "inches": 1}`。
使用其中任一功能的规则集需要 Capability API 1.759。

制造的物品持续一段时间后消失（Capability API 1.760）。`makesItems` 可以用 `lasts` 指定制造的物品持续多久，
以游戏时间的分钟数计（1 至 5256000，
即十年）：`"lasts": [{"minutes": 60}]`。
制造的物品单独形成一个物品叠，
绝不补充到其他物品叠，
也绝不接受补充；
时间耗尽时，
它从背包中消失，
并显示一行物品已消失的提示。
战斗中，
按创造者的回合和 `combat.roundSeconds`(未指定时为 6 秒)计时，
战斗结束时将剩余时间保存在物品叠上。
若有多个 `lasts`，
每个都带 `label`，
使用者在使用时选一个：
施法时每个都作为独立选择提供，
从背包使用物品时则每个都有对应按钮。
5e 的 Creation，`"lasts": [{"label": "Vegetable matter", "minutes": 1440}, {"label": "Stone or crystal", "minutes": 720}, {"label": "Precious metals", "minutes": 60}, {"label": "Gems", "minutes": 10}, {"label": "Adamantine or mithral", "minutes": 1}]`。
使用规则集时，
GM 也可以添加这类物品，`[inventory: action="add" item="Rope" lasts="1 hour"]`(分钟、小时、天或周)。
使用 `lasts` 的规则集需要 Capability API 1.760。

生物在战斗中思考多少（Capability API 1.761）。
Engine 用五种心智之一操控所有无人操控的生物：`mindless` 攻击最近的生物并持续纠缠，
回合之间除了打击走开的生物外不采取任何行动，
也绝不退让；`instinct` 按本性战斗，
优先攻击弱者，
受伤后顾及自身安危，
没有需要谋划的性格；`cunning` 懂得基本战法；`tactical` 善用战术；`genius` 发挥最优战术，
绝不低于老手水平。
生物的心智优先采用自身数值块的 `mind`，
其次是其类型的值（`combat.creatureTypes.types[].mind`），
再其次是其 `combat.minds.ability` 分值达到的档位（`tiers`，
按升序排列，
每项为 `{"atLeast": n, "mind": ...}`）；
能采取传奇动作或具有传奇抗性的生物，
若原本会是 `tactical`，
则改为 `genius`。
完全未指定时，`beast` 类型的生物按本能战斗，`construct` 或 `ooze` 为无心智，
其他生物按原有方式战斗。
GM 仍可为单场战斗指定心智。
5e：`"minds": {"ability": "int", "tiers": [{"atLeast": 0, "mind": "mindless"}, {"atLeast": 3, "mind": "cunning"}, {"atLeast": 8, "mind": "tactical"}, {"atLeast": 15, "mind": "genius"}]}`，
野兽为 `instinct`，
构装生物和泥形怪为 `mindless`，
zombie 或 skeleton 自身指定 `"mind": "mindless"`；
这样一来，
kraken(智力 22)就是天才。
无论心智如何，
Engine 也会权衡格子带来的危险、保护正受对手攻击的受伤友方，
以及攻击己方已经在攻击的目标；
谨慎、胆小或耐心的生物，
或受伤的动物，
会在攻击与闪避、脱身（先 `disengage`，
再逃跑）及躲藏之间权衡。`tactical` 或 `genius` 的生物会为回应保留资源：
它不会轻易花掉自己持有的反应（Counterspell、Shield）仍可用来支付的最后一个槽位、最后一次使用或最后一点资源池余量。
如果没有对手能在它下个回合前走近并打击它，
它会优先为自己或友方施加持续的助益（Shield of Faith、Mage Armor），
而不是作一次小伤害攻击。
远距离攻击后（有射程但自身没有触及范围的打击，
因此包括弓或法术，
但不包括投掷匕首），
它会退到仍有对手处于射程内的最安全格子，
途中避免受到打击；
任何具备思考能力的生物，
只要仍能射击目标，
就会留在射击的位置，
而不会走近迎敌。
使用 `mind` 或 `combat.minds` 的规则集需要 Capability API 1.761。

丧失斗志（Capability API 1.762）。`combat.morale` 指定 Engine 操控的生物何时、如何检定勇气。
对每个生物，`on` 中每项都在相应事件发生后、其回合开始时检定一次：`first-fall` 为己方任何生物倒下后，`half-down` 为己方半数倒下后，`leader-down` 为己方某个数值块带 `"leader": true` 的生物倒下后，`hurt` 为自身生命值低于最大值的 `hurtBelow` 比例时（未指定时为一半）。`check` 可以掷骰对抗生物数值块的 `morale` 分值（`{"roll": "2d6", "score": 7}`，
没有该分值的生物使用 `score`），
掷骰结果高于分值时崩溃；
也可以作豁免（`{"save": "wis_save", "difficulty": 10}`），
失败时崩溃。
只有具有数值块的生物才检定；
无心智的生物、召唤出的生物，
以及免疫 `unlessImmune` 指定状态的生物绝不检定。
崩溃的生物会逃跑：
它撤离身边的生物（否则疾跑），
向棋盘最近的边缘奔逃，
在那里开始下个回合时离开战斗；
没有棋盘时则立即离开。
战斗摘要会说明它逃脱了。
若其心智属于 `surrenders`，
且身边有对手，
则改为投降，
活着退出战斗，
并告知 GM 它成了队伍的俘虏。
Old-School Essentials：`{"check": {"roll": "2d6"}, "on": ["first-fall", "half-down"]}`，
配合每个生物的 `morale`。
5e(Dungeon Master's Guide 的变体规则)：`{"check": {"save": "wis_save", "difficulty": 10}, "on": ["leader-down", "hurt"], "surrenders": ["cunning", "tactical", "genius"], "unlessImmune": "frightened"}`。
由状态强制的行为，
例如狂暴或 Rötschreck，
应使用状态自身的 `behavior`(`nearest`、带 `walks` 的 `moves: "away"`)。
使用 `combat.morale` 或数值块的 `morale` 或 `leader` 的规则集需要 Capability API 1.762。
自 Capability API 1.775 起，`on` 还可以指定 `surprised`，
在生物回合开始时处于突袭状态的回合检定；
以及 `helpless`，
在生物开始一个无法伤害另一方的回合时检定一次（菜单中除了擒抱、推撞等对抗外，
没有任何能对准另一方的选项）；`"halfDownUnanswered": true` 使 `half-down` 仅在另一方尚未损失任何生物时才算数。
完整的 Dungeon Master's Guide 规则：`{"check": {"save": "wis_save", "difficulty": 10}, "on": ["surprised", "hurt", "helpless", "leader-down", "half-down"], "halfDownUnanswered": true, "surrenders": ["cunning", "tactical", "genius"], "unlessImmune": "frightened"}`。
故事指定为己方首领的生物（遭遇的 `aiHints.leader`，
例如生物图鉴中没有首领标记的强盗头目），
与数值块的 `leader` 一样计入 `leader-down`。
指定 `surprised` 或 `helpless`，
或使用 `halfDownUnanswered` 的规则集需要 Capability API 1.775。`neverSurrender` 指定 `combat.creatureTypes` 中绝不投降的生物类型：
这些类型的生物崩溃后总会逃跑，
无论其心智如何（5e：`["undead", "fiend"]`）。
使用它的规则集需要 Capability API 1.785。

战斗姿态（Capability API 1.786）。`combat.poses` 指定哪些行为通过祈祷完成，
以及哪些状态隐藏持有者，
当前用于战斗画面的标记，
之后用于美术表现；
规则本身绝不读取它。`hidden` 列出会隐藏持有者的实时状态：
持有其中任一状态，
或通过 `combat.hiding` 隐藏的队伍成员，
会标记为“已躲藏”，
并向画面传达潜行姿态（对手绝不会这样标记）。`divine` 指通过祈祷施放的能力：
人物卡中该能力所在行的 `column` 包含 `values` 之一（不区分大小写匹配），
或该能力属于 `entries` 之一（`catalog/entry`），
无论由谁使用；
名称表明其为 Channel Divinity、驱散、Divine Intervention 或祈祷的能力，
也都算作祈祷。
使用其中任一能力的参战者会标记为“正在祈祷”，
直到其下个回合开始，
日志会显示“Corwin 祈祷：
Bless。”
5e：`{ "hidden": ["invisible"], "divine": { "column": "class", "values": ["Cleric", "Paladin"] } }`。
每个 `hidden` 状态都必须是规则集中的状态。
带 `combat.poses` 的规则集需要 1.786。

再补充四种 5e 的原有规则表述（Capability API 1.787）。
条目的 `"fellsKill": true`(配合 `damage`)会直接杀死被其伤害降到 0，
或受伤害前就已为该值的目标，
绝不会让目标停留在濒死状态；
若目标以 1 点生命值撑住（Death Ward），
则仍存活：
Disintegrate。
生物行动的 `"whileFlying": true` 使该行动仅在生物位于空中时提供（在棋盘上离地、没有棋盘时正在飞行，
或只能飞行），
指定该行动的序列步骤也仅在此时执行：
wyvern 的“飞行时，
可以用爪击替换一次其他攻击”，
对应第二个 Multiattack，
由啮咬和爪击组成，
并带 `whileFlying`。
序列的 `"castsOne": true` 允许在本回合随后施放该生物施法能力中的任意一个法术，
无需再次消耗额度（仍消耗其使用次数和槽位；
一旦施放一个，
其他法术选项便消失）：
glabrezu 的“用钳子攻击两次并施放一个法术”，
对应第二个由两次钳击组成并带该字段的 Multiattack。
补救的 `against` 将针对 `saves` 的补救限于以下豁免：
对抗某个条目的豁免，
且该条目声明的筛选项读取结果符合 `where`(`{"filter": "school", "equals": "necromancy"}`)；
或对抗 `fromTypes` 之一（`combat.creatureTypes` 的 id）的生物所作任何事情的豁免，
满足任一条件即可：
Scarab of Protection，`{"where": {"filter": "school", "equals": "necromancy"}, "fromTypes": ["undead"]}`。
使用其中任一功能的规则集需要 1.787。

构建器徽标、直接授予的条目、战斗外的治疗和物品别名（Capability API 1.788）。`fields` 构建步骤的 `unansweredAtDefault` 列出仍保持 `default` 时，
其徽标仍视为待作答的字段：
例如默认值表示“尚未选择”的枚举，
5e 的龙族先祖（`draconic_damage_type`，
默认为 `"none"`）。
授予规则的 `entries.add` 直接给予另一个行目录中的条目，`[{"catalog": "languages", "ids": ["common", "elvish"]}]`，
这些行的写入方式与挑选所得的行相同，
且任何 `entries.choose` 都不会再次提供以此方式授予的条目：
例如精灵的 Common 和 Elvish，
以及 Acolyte 的两门语言，
对精灵会排除 Elvish。
该目录必须是某个构建步骤会读取的目录。
治疗的 `"outsideFight": true`(配合 `"targets": "self"` 和 `amount`)让 GM 通过 `[sheet: op="use"]` 使用它时，
在扣除该项使用消耗的资源之外，
也会在人物卡上治疗使用者，
掷骰时加上其 `amountAdd`：
战斗外的 Second Wind。
物品条目的 `aliases` 是用于查找它的其他名称，
在所有物品自身名称之后匹配，
适用于所有按名称查找物品的地方（商店的购买标签、GM 的物品栏标签）：
Plate Armor 的 `["Plate"]`。
使用其中任一功能的规则集需要 1.788。

特性的 `recovers` 可以在 `atRest` 中指定一种休息（Capability API 1.789）：
该休息结束时，
游戏内人物卡会提供使用该特性的选项，
列出其组中已消耗的资源池，
并预先选中 `upTo` 限制内能恢复的最高级资源池；
休息会一并执行该次使用，
消耗特性自身计数器的次数。
5e 的 Arcane Recovery 和 Natural Recovery，`"recovers": { "group": "slots", "upTo": { "derived": "arcane_recovery_levels" }, "most": 5, "atRest": "short" }`。
休息必须是规则集已有的休息，
物品使用不能带此字段。
使用它的规则集需要 1.789。

条目可以在 `material` 中要求有价格的材料（Capability API 1.790）：`{ "label", "worth": { "amount", "unit" }, "items"?, "tags"?, "consumed"? }`。
使用者必须携带属于 `items` 之一（`"<catalog>/<entry>"`）或带 `tags` 之一的物品，
按各自的 `cost` 计算，
总价值达到 `worth`；
其他任何东西都不能替代，
包括法器或施法材料包，
赝品也绝不算数。
从人物卡施放时，
战斗中只有在携带足够材料时才会提供该条目；
战斗外，
GM 的 `use` 若缺少材料，
会以 `no-material: <label>` 拒绝。
带 `"consumed": true` 时，
施放会消耗材料：
从背包中取走单件价值足够且最便宜的物品；
若没有单件足够，
则从最贵的开始取，
直到总价值足够。
5e 的 Identify 为 `"material": { "label": "a pearl worth at least 100 gp", "worth": { "amount": 100, "unit": "gp" }, "tags": ["pearl"] }`；
Revivify 要求价值 300 gp 的钻石，
并加上 `"consumed": true`。
单位必须是规则集的货币之一，
物品使用不能带此字段，
通过物品、生物或另一个条目免费施放该条目时也不需要材料。
使用它的规则集需要 1.790。

生物如何作战（Capability API 1.763）。`behavior` 在 `mind` 之外指定 Engine 操控的生物如何战斗：
其 `temperament`(`reckless`、`cautious`、`opportunistic`、`protective`、`supportive`、`disciplined`、`cowardly`、`patient`、`methodical`、`coordinated`、`fanatical`(1.778)、`arrogant`(1.780)、`territorial`(1.781)、`cruel`(1.782)、`honourable`(1.783) 或 `hungry`(1.784))和 `role`(`bruiser`、`bulwark`、`skirmisher`、`marksman`、`spellcaster`、`supporter` 或 `controller`)，
替代原本会分配的值；
优先攻击谁，`targets`，
最多四项，
按顺序从以下值中选择：`nearest`、`weakest`、`wounded`(生命值低于自身最大值的一半)、`strongest`(最危险者)、`casters`(拥有法术或持有法术的任何生物)、`healers`、`attacker`(最后伤害它的生物)、`concentrating` 和 `leader`(数值块带 `"leader": true`)；`opens`，
最多四个自身行动 id 或目录条目（`fireball` 或 `spells/fireball`），
在最初的回合中，
采用其中第一个能使用且有实际价值的选项，
仅一次；`pack: true`，
攻击友方身边的目标；
以及 `ambush: true`，
在能躲藏的地方躲藏并保持不动，
直到某个对手站到它本回合先行走就能打击的位置，
或它受到伤害，
此后绝不再等待。`behavior` 可以位于 `combat`(作用于每个生物)、`combat.creatureTypes.types` 中的生物类型，
以及生物自身的数值块上，
每个键都覆盖前一层的值。
GM 为单场战斗指定的性格优先于生物自身的性格，
无心智生物则不采用这些行为。
5e：
狼 `{"targets": ["wounded"], "pack": true}`，
goblin `{"temperament": "cowardly", "targets": ["weakest"]}`，
young dragon `{"opens": ["fire_breath"]}`，
ghoul `{"ambush": true}`，
mage `{"role": "controller", "targets": ["casters"]}`。
使用这类 `behavior` 的规则集需要 Capability API 1.763。

各战斗定位的行为（战斗 AI A1）。`bruiser` 直接战斗。`bulwark` 保护友方：
最看重能让对手远离友方的行动，
并在行走结束时停在正受对手攻击的友方身边。`skirmisher` 更看重终结打击和参与己方的攻击，
并喜欢与已经攻击目标的友方分处目标两侧作出打击（夹击）。
近距离打击后，`skirmisher`(或 `cautious`、`cowardly` 的生物)会用剩余的行走距离再次脱身：
若仍可采取 Disengage，
则借此脱身（goblin 的 Nimble Escape）；
否则只移到途中不会招致打击的格子。`marksman` 更在意自身所处的危险。`spellcaster` 把最强手段留到关键时刻，
更看重事先铺垫。`controller` 最看重控制住目标。`supporter` 更看重助益，
并待在伤者附近。`solo`(Capability API 1.776)独自对抗整个敌方：
它会花费自身资源，
并不在意挨打。
数据未指定 `role` 的生物会按其能力分配：
能在回合之间自行行动（`signaturePoints`）或具有传奇抗性的生物为 `solo`，
治疗其他生物的为 `supporter`，
施法者为 `controller` 或 `spellcaster`，
最强打击为远程攻击的为 `marksman`，
有保护友方的反应（Shield Guardian 的 Shield）或能挡开打击的生物为 `bulwark`(对被命中作出的反应，
不伤害任何生物，
只给自身施加提高 `defense` 的状态，
例如 5e 的 Parry)，
能免费使用 Disengage 或 Hide(Nimble Escape)、持有持续生效且带 `flyby` 的状态，
或速度远快于己方而打击并不比己方更强的生物为 `skirmisher`，
其余为 `bruiser`。
分配性格时也会考虑该战斗定位。
指定 `solo` 战斗定位的规则集需要 Capability API 1.776。

护卫（Capability API 1.777）。`behavior` 可以指定 `guards`，
从 `leader`(数值块带 `"leader": true`，
或故事标记为己方首领的生物)、`casters`(拥有法术的任何生物)和 `healers`(治疗其他生物的任何生物)中指定一至三项：
该生物会留在最近的、仍站着且属于这些类别的友方三格以内，
并优先攻击正攻击该友方的目标，
与接到保护命令的同伴一样；
若这些类别的友方已无一剩下，
它就按原本的方式战斗。
这是持续命令，
因此无心智生物（Shield Guardian、zombie）也会遵守，
能打击正攻击保护对象的生物时就会打击。
5e：
贵族的卫兵 `{"guards": ["leader"]}`，
cult fanatic 的追随者 `{"guards": ["casters"]}`。
使用 `guards` 的规则集需要 Capability API 1.777。

首领（战斗 AI A6，
无 Capability 次版本要求）。
领导己方的生物（数值块带 `"leader": true`，
或由故事标记）会在自身最初两轮优先采用同时帮助多个己方生物的手段（针对友方且目标数不止一个或带范围的选项：
战吼、Bless；
或给自身施加状态，
且该状态的 `auras` 能触及己方：
5e 的 Leadership），
己方会优先攻击它最后攻击的目标；
若规则集带 `combat.morale`，
己方正在逃离战斗且位于它六格以内的每个生物，
都会在自身回合开始时停止逃跑，
并在自己的下个回合再次检定勇气。

狂热者（Capability API 1.778）。`behavior.temperament` 为 `fanatical` 的性格从不随机分配，只能由生物数据或故事指定：无论身处何种危险，它都会全力攻击，维护己方，从不检定 `combat.morale`，在 Classic 和 Tactical 战斗中也没有士气分值。`disciplined` 生物（无次版本要求）会保持阵形，考虑跟随己方移动，执行首领选定的目标，且不会因己方第一个成员倒下（`first-fall`）而动摇。5e：邪教狂信徒及其邪教徒 `{"temperament": "fanatical"}`。指定 `fanatical` 的规则集需要 Capability API 1.778。

会转变的性格（Capability API 1.779）。`behavior` 可以声明 `shifts`，包含一到四个 `{"on": trigger, "to": temperament}`，每个触发条件只能出现一次：`bloodied`(生命值低于一半)、`ally-down`(己方一员倒下或离场)、`leader-down`(己方首领倒下) 或 `cornered`(生命值低于四分之一、身旁有对手且无路可逃)。在它每个回合开始时，首个已经发生的触发条件会使其性格转变，每场战斗只转变一次，此后它自己的 `temperament` 不再适用。游戏主持人（GM）为单场战斗指定的 `shifts` 优先于此设置。无心智生物从不转变。5e：傲慢的龙 `{"temperament": "opportunistic", "shifts": [{"on": "bloodied", "to": "methodical"}]}`，走投无路的强盗 `{"shifts": [{"on": "cornered", "to": "reckless"}]}`。使用 `shifts` 的规则集需要 Capability API 1.779。

傲慢的生物（Capability API 1.780）。`behavior.temperament` 为 `arrogant` 的性格从不随机分配，只能由生物数据或故事指定：它不太谨慎，不作铺垫，并保留需要消耗资源的选项（法术位、有限使用次数），即使独自对抗一方也是如此。除非其 `shifts` 另有规定，否则一旦满足 `bloodied` 或己方一员倒下（`ally-down`），它就会转为 `methodical`。傲慢（或曾经傲慢）、能飞行且具有传奇能力（招牌行动或传奇抗性）的生物，会在生命值低于四分之一时飞上天空并从空中作战，绝不落地走向任何人。5e：成年红龙、巫妖或吸血鬼 `{"temperament": "arrogant"}`。将 `arrogant` 指定为性格或转变的 `to` 的规则集需要 Capability API 1.780。

守卫领地的生物（Capability API 1.781）。`behavior.temperament` 为 `territorial` 的性格从不随机分配，只能由生物数据或故事指定：它会留在距战斗开始时所在位置 `behavior.territory` 格以内（1 到 40，未指定时为 6），打击或射击任何踏入这片地面的人，被推出去后则会走回去。它只会为追击最后伤害自己的人而离开，且对方须站在领地之外、从远处发动了打击。数据指定为 `territorial` 的无心智生物也会守住领地，就像奉命守卫某处的魔像。5e：守门的魔像 `{"temperament": "territorial", "territory": 3}`，树林中的树人 `{"temperament": "territorial"}`。指定 `territorial`（作为性格或转变的 `to`）或 `territory` 的规则集需要 Capability API 1.781。

残忍的生物（Capability API 1.782）。`behavior.temperament` 为 `cruel` 的性格从不随机分配，只能由生物数据或故事指定：它会尽可能杀死目标，而且喜欢先压制或恐吓目标。如果玩家在游戏中开启“允许残忍的对手攻击倒下的角色”（默认关闭），它也可以攻击已经倒下但尚未死亡的角色；关闭时，它会按 `opportunistic` 生物的方式行动，放过倒下者，与 Engine 操控的其他所有对手一样。5e：食尸鬼、鬼婆或魔鬼 `{"temperament": "cruel"}`。将 `cruel` 指定为性格或转变的 `to` 的规则集需要 Capability API 1.782。

讲求荣誉的生物（Capability API 1.783）。`behavior.temperament` 为 `honourable` 的性格从不随机分配，只能由生物数据或故事指定：它会优先对付正在与自己交战的人（在它身旁，或最后伤害它的人），不以杀戮为乐，绝不打击正在逃离战斗（`routed`）、已经倒下或已经投降的人。只要仍站着的对手全都讲求荣誉，队伍菜单就会提供 **Surrender**(投降)：战斗以队伍被生擒的败局结束，并将结果告知 GM。5e：骑士、金属龙或天界生物 `{"temperament": "honourable"}`。将 `honourable` 指定为性格或转变的 `to` 的规则集需要 Capability API 1.783。

饥饿的生物（Capability API 1.784）。`behavior.temperament` 为 `hungry` 的性格从不随机分配，只能由生物数据或故事指定，动物也可以具有这种性格：它会选定一个猎物并持续追击，能抓住就抓住；一旦通过可拖拽的状态（`dragged`，1.497）抓住目标，就会先将目标拖离所有其他人，再次发动打击，而且只要还抓着目标，就不会走向其他人。5e：巨鳄、蛰伏伪怪或格里克 `{"temperament": "hungry"}`，其擒抱的 `grappled` 状态带有拖拽效果。将 `hungry` 指定为性格或转变的 `to` 的规则集需要 Capability API 1.784。

飞行者保持在触及范围之外（战斗 AI A7，无 Capability 次版本要求）。在带高度层级的棋盘上（`combat.elevation.levelHeight`），如果 Engine 操控的生物能飞行且有可用于射击的手段，而它本会在附近有无法飞行的对手时于地面结束回合，就会飞起来。`bruiser`、`reckless` 生物和无心智生物除外。状态作用于持有者己方的光环，也会按其为触及范围内每个友方带来的收益估值，因此对自身施放 Leadership 也有施放价值。

只有移入才会卷入的区域（Capability API 1.764）。默认情况下，区域的 `enter` 会卷入它新覆盖的任何人：走入其中的生物，以及因区域随施法者移动、被施法者移动或转向自己而被覆盖的生物；日志会说明区域触及了它们。在 `zone` 上写 `"enterOnlyByMoving": true` 会排除后一种情况：只有自行走入或被移动到其中的生物，才会被 `enter` 卷入。5e 的 Spirit Guardians，`"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false, "enterOnlyByMoving": true }`，以及 Moonbeam。使用它的规则集需要 Capability API 1.764。

会一并施加其他状态的状态（Capability API 1.765）。`combat.conditions` 条目可以声明 `alsoApplies`，指定规则集的最多四种其他状态：每当它被施加时，也会施加其中的每种状态，除非持有者已经具有该状态或对其免疫；这些状态按未指定持续时间时的常规方式持续，直到各自的结束条件满足。原状态移除后，它们仍会保留。5e 的昏迷，`"alsoApplies": ["prone"]`：倒下的生物会倒地，治疗后仍然倒地，直到花费移动起身。使用它的规则集需要 Capability API 1.765。

自动选取所有所提供条目的构建步骤（Capability API 1.766）。带 `"takesAll": true` 的 `catalog` 步骤会直接选取它所提供的每个条目，无须询问：例如角色各等级给予的职业特性。它所提供的每个 `exclusive` 组由玩家各选一个，以最新选择为准；尚未作出选择的组会让步骤等待；`min`、`max` 和 `countFrom` 对它不起作用，而且它不能带 `pool`、`cost`、`quotas`、`distinctBy` 或 `quotaBelow`（`field` 需要下文的 1.773）。步骤的 `upTo` 也可以用 `per` 按每个条目读取：`{ "filter": "class_id", "prefix": "level_" }` 根据名称由 `level_` 与条目自身的 `class_id` 组成的人物卡字段或派生值来限制条目，取人物卡上这些值中的最高值；未指定任何此类 ID 的条目则按 `upTo.value` 限制。5e 的职业特性，`{ "kind": "catalog", "catalog": "class_features", "takesAll": true, "upTo": { "filter": "level", "value": { "field": "level" }, "per": { "filter": "class_id", "prefix": "level_" } } }`：战士 4 / 法师 1 会获得 Second Wind、Action Surge 和 Arcane Recovery，并选择属性值提升或一个专长。使用其中任一功能的规则集需要 Capability API 1.766。

标记行的构建步骤（Capability API 1.767）。`"kind": "mark"` 步骤会提供人物卡某个 `list` 上由目录写入、且符合其 `where` 的已有行（不提供玩家手动输入的行）；该筛选条件指定 1 到 4 列，每列为一个值，数字列也可写 `{ "atLeast": n }`；玩家标记的每一行，其布尔 `column` 都会被勾选。它通过 `max` 或 `countFrom` 指定数量，必须且只能提供其中一个，等待的数量从不超过现有行数。取消标记只会清除构建器作出的勾选；之后玩家在人物卡上改过的勾选仍由玩家保留。5e 的法师在法术书步骤之后，`{ "id": "prepared", "kind": "mark", "list": "spells", "column": "prepared", "where": { "level": { "atLeast": 1 } }, "countFrom": { "derived": "spells_prepared_wizard" } }`。使用它的规则集需要 Capability API 1.767。

更大的构建器（Capability API 1.768）。引导式构建器的步骤上限从 24 提高到 32，`catalog` 步骤的 `min` 和 `max` 上限从 40 提高到 60：5e 的法师有独立的 Spellbook(法术书) 步骤，最多可容纳 20 级法师抄录的 44 个法术，后面还有 `mark` 步骤。超过 24 个步骤，或目录步骤要求选择或最多接受超过 40 个条目的规则集，需要 Capability API 1.768。

目录变体（Capability API 1.769）。目录条目可以列出 `variants`，包含同一目录中其他条目的 1 到 32 个 ID，每个被列出的条目都须用 `variantOf` 回指本条目的 ID：例如 Chromatic Orb 的强酸、冷冻、火焰、闪电、毒素和雷鸣变体，各有自己的 `mechanics`。构建步骤和目录选择器只提供父条目；变体从不单独选择。人物卡上的父条目行在战斗中会成为其每个变体，每个变体都以自己的 `label` 出现在菜单中（也可供 GM 的命令使用），均从同一行施放，使用相同的法术位和数值；父条目自身具有 `mechanics` 时，也会出现在菜单中。战斗会保留人物卡各行来源条目的所有变体。生物的 `spellcasting` 法术若指定父条目，也同样会成为其每个变体，各自从该法术自身的 `uses` 和法术位施放；只要某个变体有 `mechanics`，此处父条目本身就不需要。变体不能再有自己的变体；导入时会拒绝父条目未列出的变体，也会拒绝指定了未回指自身的条目的父条目。使用其中任一键的规则集需要 Capability API 1.769。

只由中间障碍提供掩护（Capability API 1.770）。默认情况下，目标站在提供掩护的地面（森林、废墟）上时，仅凭脚下的地面就能获得对攻击的半掩护。`combat.cover.groundUnderTarget: false` 会取消这一点，让掩护只来自攻击者与目标之间的障碍：`creatures` 指定会提供掩护的生物，以及双方之间的其他障碍。5e 的掩护来自挡在中间的东西，而非脚下的地面。省略此键或设为 `true` 会保留地面规则。使用此键的规则集需要 Capability API 1.770。

对协助者身旁对手生效的协助（Capability API 1.771）。默认情况下，无论协助者站在哪里，协助都会让受助盟友下一次对任何人的攻击获得优势。`combat.standardEffects.help: { "beside": true }` 会将其改为 5e 的协助：只有协助者的 5 英尺内有对手时才提供，只对攻击协助发生时位于协助者身旁的对手生效，也只有这样的攻击才会消耗它。只有 `standard` 列表含有 `help` 时才能指定它。使用此键的规则集需要 Capability API 1.771。

组的默认选项（Capability API 1.772）。自动选取所有所提供条目的步骤（1.766）会等待玩家在其所提供的每个 `exclusive` 组中各选一个条目。带 `"exclusiveDefault": true` 的目录条目，会在玩家尚未从其组中选择任何条目时被选取，因此步骤无须等待；选择该组的另一个条目仍会替换它：例如 5e 的属性值提升，在可选专长规则下可以被专长替换。与手动选择一样（1.100），判断同组另一个条目是否符合条件时，人物卡不计入此默认条目，因此被专长替换的属性值提升绝不会满足该专长的先决条件。某个组若只提供一个条目（另一个条目的 `offeredWhen` 读作 0），无论有无此键，也会以同样方式选取该条目。只有指定了 `exclusive` 组的条目才能声明它，每个目录的每个组只能有一个默认条目。使用此键的规则集需要 Capability API 1.772。

将自动选取所有所提供条目的步骤所选取的内容写入字段（Capability API 1.773）。带 `"takesAll": true` 的 `catalog` 步骤可以像任何目录步骤一样指定 `field`：文本字段会获得它选取的每个条目的标签，包括每个 `exclusive` 组中选中的条目，以“, ”连接；枚举字段则获得所选取条目中第一个属于其取值的条目。每当步骤选取的内容改变时，都会按任何步骤的字段所遵循的相同规则重新写入（仅当字段为空或仍是构建器写入的内容时）。5e 的子职业，其特性随职业一起获得：`{ "id": "subclass", "kind": "catalog", "catalog": "features", "takesAll": true, "filters": { "kind": "subclass" }, "within": { "step": "class", "filter": "class_id" }, "upTo": { ... }, "field": "subclass" }` 会为战士 3 / 法师 2 写入“Champion, School of Evocation”。在此类步骤上带有 `field` 的规则集需要 Capability API 1.773。

Engine 如何衡量法术或能力施加在某人身上的效果。它读取规则集自身的 `combat.conditions`：每种效果都相当于一回合的一部分（`cannot-act` 为完整一回合，攻击劣势约为三分之一），让持有者逃跑、乱走或浪费回合的 `behavior` 价值更高，受伤害便结束的状态价值更低，再按持续时间、目标用 d20 掷骰豁免失败的概率及目标的危险程度调整。因此，定身会施加给打击最强的对手，绝不会施加给已具有该状态或对其免疫的对手；爆发若也会卷入施放者己方，则会把对己方的损害计入权衡。开始另一个需维持的法术时，会计入因此将放弃的那个法术；伤害正在维持法术的人也略有额外价值。会取消效果的回应（Counterspell）价值等于它所阻止的效果：会对其施放者己方造成的伤害和状态，或会给予另一方的治疗。这里的内容都不需要更新的 Capability API。

序列的触及范围（从 Capability API 1.740 对应的 Engine 起，无独立的次版本要求）。没有自身 `reach` 或 `range` 的序列，例如生物的 Multiattack，其触及范围等于各部分中最远的范围，每个部分只会对该部分自身能够触及的目标发动：成年龙的 Multiattack 可对 10 英尺外的敌人使用，啮咬能打到那里，而爪击只会攻击爪子能触及的目标。

队员的复制体（从 Capability API 1.726 对应的 Engine 起）。GM 的 `[party_change: character="Lia's Simulacrum" change="add" copy_of="Lia" condition="simulacrum"]` 会将一个使用新名字的游戏角色加入队伍，带有该队员的角色卡和人物卡构建结果，以全新状态开始，从一开始就具有规则集的 `condition`；不会为其生成任何内容。5e 的 Simulacrum：一个在供 GM 阅读的文字中要求使用该标签的条目，加上一个持续状态，其调整值将生命值最大值减半，`{"to": "health-max", "times": 0.5}`。它不需要独立的 Capability API：该标签属于 GM。从 Capability API 1.744 对应的 Engine 起，`copy_of` 也可以改为指定规则集图鉴中的生物（按标签、ID 或 `<catalog>/<entry>`）：复制的野兽或陌生生物会以写明该生物的角色卡加入队伍，没有人物卡和物品，并在队伍一方按该生物作战。与人物卡一样，它的状态和生命值会在战斗之间保留在其实时状态中，因此减半状态会持续生效，生命值已被打低的复制体也会保持低生命值。

带 `"alerts": 15` 的状态、穿戴或携带的物品，会暴露在其持有者该距离之内隐藏移动的人：他们不再对任何人隐藏，日志记录为被其持有者暴露。展示用例中的 Wind-Chime 是一件携带的物品，带 `{"alerts": 15}`。生物的 `"stillIn": ["bright"]` 让它在任何一格处于这些光照之一时无法移动：在那里，其菜单上没有行走。展示用例中的 Lantern-Shy 就是如此。

增长的光环、有上限的束缚、挣脱与死撑（Capability API 1.320）。光环的 `"grows": {"by": 10, "upTo": 40}` 在其持有者每个回合开始时再向外延伸 `by`，最多到 `upTo`，该值大于其 `distance`；日志会说明它现在触及多远。其 `harms` 可以写 `"on": "their-turn"`：在被它触及的每个人的回合开始时分别造成，而不是在持有者回合开始时一次性造成。`"lingers": true` 让它散布的东西在不再被它触及的人身上保留到其下个回合开始，如果在此之前光环又触及他们，就重新持有它。The Owed 的 Frost Debt 写作 `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`。

行动施加的东西可以带 `"heldAtMost": 2`：当其来源已经用它束缚着这么多个其他人时，它不会施加到第三个人身上（日志记为未生效），就像 The Owed 的 Grasps。状态的 `shakeOff` 带 `"self": true` 时，持有者也可以花费该额度、不进行检定来结束它：Seed Hopper，`{"budget": "action", "self": true}`，可由被束缚者或其身旁的盟友挣脱。生物的 `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}` 让它在本会降到 0 时改为保留 1 点生命值，每场战斗 `uses` 次，但对直接杀死的效果无效；带 `extraTurn` 时，它在发生这件事的回合之后立即进行一个自己的回合，该回合结束后顺序恢复原样。

选择器会用一行展示这个块。其余内容由谁读取，取决于规则集选择启用了哪个块：

- 带有 [`combat` 块](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)时，战斗读取其中的战斗效果。`range`、`area` 和 `friendlyFire` 在有位置的战场上生效；`reaction` 表示该条目用于回应某件事，而不是在回合内执行，并指定它所等待的时刻（见[窗口](ruleset-combat.md#windows-holding-the-fight-open)）；只写 `true` 的条目没有指定时刻，不会出现在任何菜单上。`check` 按前文所述应用于技能检定。
- 只有 [`battle` 块](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat)时，战斗读取 `kind`、`range`、`area`、`friendlyFire`、`amount`、`damageType` 和 `cost`，因为 Marinara 自身的战斗系统只能使用这些部分。

词汇范围是封闭的。上述列表之外的键或值会被拒绝，而不是静默忽略。

`cost` 也是 Game Master 在战斗外使用 `use` 命令时支付的费用，见[`use` 命令](ruleset-catalogs.md#the-use-command-letting-the-game-master-spend-a-price-you-wrote)。
