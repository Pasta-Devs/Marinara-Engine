# ルールセットのアイテム

このページは[Game Modeのルールセットを作成する](writing-rulesets.md)の一部です。パーティーが持ち運ぶものを説明します。カテゴリー、武器、鎧、弾薬、戦利品、お金、初期装備、市場を扱います。

鎧、武器、ポーション、装備品、弾薬、お金はアイテムです。任意の`items`ブロックはルールセットのすべてのアイテムを記述する語彙を宣言し、`holds: "items"`のカタログがアイテムそのものを列挙します。どちらもCapability API 1.49が必要です。機能ごとに必要なバージョンは次のとおりです。GMが作るアイテムを制御するブロックの`rarityCaps`と`propose`は1.51、キャラクターが持つアイテムを読む値(`itemStat`)は1.52、装備中や携行中のアイテムが判定に与える効果とブロックの`bonus`上限は1.53、アイテムが装備者に求める要件と変更する能力値は1.54、武器の`attack`は1.55、アイテムの戦闘中の効果は1.56、武器が撃つものと装填しておく数は1.57、武器のモード、オフハンド攻撃、下限、命中時の状態は1.58、戦闘でのアイテム使用の効果と保持するチャージは1.59、プールを回復する使用は1.60、休息で回復するチャージや使い切ると壊れるアイテムは1.61、先に判定を求める使用(`gate`)は1.62、戦利品表とクリーチャーの戦利品は1.63、硬貨を落とす戦利品の行や硬貨を除くレイヤーは1.64、市場、アイテムの`sold`の場所、`service`は1.65、市場の一日(財布、`buyBack`、売り手の`stock`、`limited`の数、場所を指定しない`sold`)は1.69、手に持った武器で発動する追加効果(`weapons`)は1.70、初期装備(`startingGear`)は1.78、危険なアイテム、偽物、不正直な売り手は1.79、市場の`unsold`(またはレイヤーの`items`)は1.813です。

## アイテムブロック

ブロックはファイルのトップレベルの`items`に置きます。以下はEmber Roadsのもので、少し短くしています。

```json
"items": {
  "categories": [
    { "id": "weapon", "label": "Weapon" },
    { "id": "armor", "label": "Armor" },
    { "id": "ammunition", "label": "Ammunition" }
  ],
  "rarities": [
    { "id": "common", "label": "Common" },
    { "id": "storied", "label": "Storied" }
  ],
  "tags": [
    { "id": "thrown", "label": "Thrown" },
    { "id": "ranged", "label": "Ranged" },
    { "id": "two_handed", "label": "Two-handed" },
    { "id": "arrow", "label": "Arrow" }
  ],
  "stats": [
    { "id": "bulk", "label": "Bulk", "type": "number", "min": 0, "max": 10, "default": 0 },
    { "id": "guard", "label": "Guard", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "damage", "label": "Damage", "type": "dice", "example": "1d6" },
    { "id": "swing", "label": "Rolls with", "type": "enum", "values": ["brawn", "wits", "heart"], "default": "brawn" },
    { "id": "reach", "label": "Reach", "type": "enum", "values": ["close", "near", "far"], "default": "close" }
  ],
  "slots": [
    { "id": "body", "label": "Body", "count": 1 },
    { "id": "hands", "label": "Hands", "count": 2 }
  ],
  "carry": { "stat": "bulk", "encumberedAbove": { "derived": "load" }, "limit": { "const": 12 } },
  "rarityCaps": [
    { "rarity": "common", "stats": { "guard": 1 }, "bonus": 1 },
    { "rarity": "storied", "stats": { "guard": 3 }, "bonus": 2 }
  ],
  "currencies": [
    {
      "id": "coin",
      "label": "Coin",
      "perWeight": 100,
      "units": [
        { "id": "bit", "label": "bits", "value": 1 },
        { "id": "mark", "label": "marks", "value": 10 },
        { "id": "sovereign", "label": "sovereigns", "value": 100 }
      ]
    },
    {
      "id": "salt",
      "label": "Salt",
      "perWeight": 10,
      "units": [
        { "id": "pinch", "label": "pinches", "value": 1 },
        { "id": "cake", "label": "cakes", "value": 20 }
      ]
    }
  ]
}
```

- `categories`: 一つ以上です(上限: 24個)。すべてのアイテムは鎧、武器、ポーションなど、厳密に一つのカテゴリーを持ちます。
- `rarities`: 任意です(上限: 12個)。最もありふれたものから最も希少なものの順に並べます。
- `tags`: 任意です(上限: 48個)。投擲用や銀製など、アイテムが持てる特性です。
- `stats`: 任意です(上限: 24個)。アイテムが持つ数値や語で、リストの列とまったく同じく`number`、`text`、`boolean`、`enum`、`dice`として宣言し、型に応じて範囲、値、デフォルトを指定します。`promptVisible`(デフォルトは`true`)は、Game Masterにアイテムと並べてそのステータスを見せるかです。アイテムの隠し場所など、プレイヤーだけが見るべきものには`false`を設定します。
- `slots`: 任意です(上限: 12個)。アイテムを身に着ける、または持つ部位と、キャラクターが持つその部位の数(1～20)です。
- `binding`: 任意です。同調や授与など、一人のキャラクターが同時にバインドできるアイテム数を制限するものです。`label`はその呼び名、`max`はキャラクターのシートから読む値で、`{ "abilityScore": "nerve" }`や派生値などです。バインドできるアイテム数は打撃のたびに変わるものではないため、ライブステートは読めません。
- `carry`: 任意です。`stat`はアイテムの重量となる数値ステータスを指定し、その`min`は非負(0以上)です。`encumberedAbove`は重量超過になるまでに運べる量、`limit`(任意)は運べる最大量です。どちらも`binding.max`と同じくシートから読みます。`carry`がなければ重量は意味を持たず、誰も重量超過になりません。`unit`(任意、上限: 12文字、Capability API 1.791)は、`"lb"`などの重量の単位です。インベントリーの荷重、初期装備の選択画面の重量、キットの選択肢の重量では、数値の後に表示されます。
- `currencies`: 任意で、一～十種類の硬貨からなる系統を最大六つ持てます。
  - 同じ系統の硬貨は、系統の最小硬貨を単位に数える`value`によって互いに両替できます。そのため最小硬貨の価値は、1です。同じ系統の二つの硬貨が同じ価値を持つことはありません。
  - 二つの系統は互いに両替できません。他国の硬貨や、舞台設定上の恩義などは独立した系統です。
  - アイテムのコストは硬貨だけを指定するため、硬貨のIDはすべての系統を通じて一意です。
  - 硬貨の`label`は、任意の枚数を表す名前です(`pennies`)。`one`(Capability API 1.89)はちょうど一枚を表す名前(`penny`)で、価格、財布、市場が一枚の硬貨を示す場所で使われます。これがなければ、`label`が一枚も表します。
  - `perWeight`(任意で、`carry`がある場合だけ)は、その系統の硬貨がいくつで運搬ステータス一単位の重さになるかです。
  - 硬貨はパーティーのお金で、ほかのアイテムと同じく袋に入れて持ち運びます(後述の「お金」を参照)。
- `rarityCaps`: 任意で、レアリティーごとに最大一つです。Game Masterが作るアイテムがそのレアリティーで与えられる上限です。`stats`で指定した各数値ステータスの最大値(そのステータス自身の範囲内で、整数のステータスなら整数)と、`bonus`(Capability API 1.53)、つまり装備中・携行中の修正値の一つが加えられる最大の固定ボーナスです。`bonus`のあるレアリティーでは、ダイスは数値に制限できないため、ダイスによるボーナスは省きます。ペナルティには上限を設けません。作られたアイテムはこれに制限されます。カタログに載せたアイテムは作者のもので、制限しません。
- `propose`: デフォルトは`true`です。`false`にすると、Game Masterはルールセットのアイテムを作れません。
- `native`: デフォルトは`true`です。`false`にすると、ルールセットのゲームでGame Mode自身の型なしアイテムをオフにします(**アイテムを読み取るもの**を参照)。Game Masterは引き続き、ルールセットの語彙でアイテムを作れます。
- `freeform`: プレイヤーが入力したアイテムの扱いです。`"plain"`(デフォルト)は現在と同じく、規則を持たないアイテムとして残します。`"refuse"`はルールセットのアイテムだけを許可します。
- `lootTables`(Capability API 1.63): 任意です(上限: 24個)。勝利した戦闘のクリーチャーとGame Masterの`[loot:]`が落とすものです(後述の「戦利品」を参照)。

## アイテムの項目

アイテムのカタログは`feeds`を宣言しません。

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

各項目は`rows`や`creature`の代わりに`item`を持ちます。

```json
{
  "id": "hunting-bow",
  "label": "Hunting bow",
  "summary": "Yew, waxed string, and a grip worn smooth by someone else's hand.",
  "item": {
    "category": "weapon",
    "rarity": "common",
    "tags": ["ranged", "two_handed"],
    "stats": { "bulk": 2, "damage": "1d8", "swing": "wits", "reach": "far" },
    "slots": { "hands": 2 },
    "cost": { "amount": 3, "unit": "sovereign" }
  }
}
```

- `id`、`label`、`summary`、`filters`はほかの項目と同じです。ラベルはアイテムの名前です。
- `category`は必須です。`rarity`と`tags`は任意で、3つともブロック自身のIDを指定します。アイテムがレアリティーを持てるのは、ブロックがレアリティーを宣言している場合だけです。
- `stats`: ブロックのステータスの値です。それぞれ、そのステータスが持てる値です。
- `slots`: アイテムが占める各スロットの数で、キャラクターが持つ数を超えません。
- `stack`: 1スタックの最大数で、1～999,999です。指定しなければ、Game Modeのスタックと同じ数まで入ります。`charges`を持つアイテムは1スタックに1つです。
- `cost`: 1種類の硬貨の整数の`amount`で、硬貨は`unit`のIDで指定します。選択画面に表示し、GMもアイテムと並べて見ます(後述の「お金」を参照)。
- `sold`(Capability API 1.65): `{ "place": "city" }`で、市場の場所のうちアイテムを売る最小の場所を指定し、ほかの規則より優先します。1.69では、その代わりに、またはそれに加えて、ある場所が1日に置いておく数も指定できます(`"limited": 2`または`"limited": "1d3"`)(後述の「市場」を参照)。
- `service`(Capability API 1.65): 宿泊、渡航、祝福などには`true`を指定します。アイテムと同じく購入しますが、持ち運びません。購入は支払うだけで、ほかに袋へ入れる処理はありません(追加しようとすると`service`として拒否されます)。選択画面もサービスを除外します。サービスは`cost`を持ち、持ち運びや使用に関するもの(`slots`、`stack`、`binds`、`worn`、`carried`、`requires`、`attack`、`use`、`charges`)は持ちません。
- `binds`: 装備中に効果を発揮するには、アイテムのバインドが必要です。`restriction`(任意)はバインドできる人を文章で示し、`cursed: true`は外れなくなるアイテムを示します。バインドするアイテムを持てるのは、`binding`のあるルールセットだけです。
- `worn`と`carried`(任意、Capability API 1.53): 装備中と、携行しているだけの間に、アイテムが持ち主の判定とセーヴに与える効果、(1.54)設定または上昇させる能力値、(1.56)戦闘中の効果です。[戦闘外の判定](#checks-outside-a-fight)と[戦闘中の鎧と装備効果](#armor-and-worn-effects-in-a-fight)を参照してください。
- `requires`(任意、Capability API 1.54): アイテムが装備者に求めるものと、満たさない間に適用されるものです。[戦闘外の判定](#checks-outside-a-fight)を参照してください。
- `attack`(任意、Capability API 1.55): 装備中に戦闘で武器としてアイテムが行うこと、(1.57)撃つものと装填しておく数、(1.58)ほかのモード、オフハンド攻撃、被害の下限、命中時に付与する状態です。[戦闘中の武器](#weapons-in-a-fight)、[弾薬と再装填](#ammunition-and-reloading)、[モード、2つ目の武器、下限、命中時の状態](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit)を参照してください。
- `toggle`(任意、Capability API 1.170): アイテムが持つスイッチで、`{ "label", "budget" }`です。戦闘はそれをその行動枠の選択肢として提示し(「Turn on Flame Tongue: Flames」)、インベントリーはラベル付きのボタンとして提示します。どちらの状態で残しても、戦闘の間もスタック上でその状態が保たれ、最初はオフです。スイッチを持つアイテムは、オンの間は1スタックに1個です。`when: "toggled"`を持つ武器の`plus`の条項は、オンの間だけ与えられます。5eのflame tongueは`"toggle": { "label": "Flames", "budget": "bonus" }`と`"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`です。
- `use`と`charges`(任意、Capability API 1.59): 戦闘中と戦闘外でアイテムを使用したときの効果、その使用が消費するチャージ、(1.60)回復するプールです。[戦闘中のアイテム使用](#using-items-in-a-fight)と[戦闘外のアイテム使用](#using-items-outside-a-fight)を参照してください。

アイテムは`mechanics`を持ちません。効果は`item`ブロックに書きます。

## アイテムを読み取るもの

上記はすべてルールセットのインポート時に検査し、アイテムのカタログはルールセットとともに配布されます。ゲームでは、Game Modeのインベントリーがそれを読み取ります。

- **アイテムは袋に入ります。** スタックはルールセットのアイテムの1つにでき、プレイヤーが何と呼んでもそのアイテムのままです。インベントリーの**From the ruleset**(ルールセットから)ボタンは、カタログが列挙するすべてのアイテムを並べた選択画面を、カタログの検索とフィルター付きで開きます。項目を隠すレイヤーは、そこでも隠します。
- **名前でアイテムを見つけます。** プレイヤーが入力した名前や、GMが`[inventory: action="add"]`に書いた名前が、大文字・小文字を問わずルールセットのアイテムの`label`なら、そのアイテムを追加します。2つのアイテムが同じラベルを持つ場合は、カタログで先に列挙したものが見つかります。
- **`stack`**は維持されます。追加、設定、統合、譲渡でそれを超えるとスタックを満たし、新しいスタックを始めます。
- **`freeform: "refuse"`**では、プレイヤーはルールセットのアイテムだけを扱えます。選択画面と、ルールセットのアイテムである名前です。
- **`native: false`**では、GMはルールセットのアイテムと自ら作るアイテムだけを扱えます。どちらでもない名前は拒否されます(`not-ruleset-item`)が、すでに持っているものは引き続き追加でき、GMへの指示にもそう書かれます。戦闘はインベントリーのアイテムが何をするかをモデルに尋ねなくなるため、戦うのはルールセットのアイテムだけです。ルールセットの戦闘では手に持った武器とアイテムの使用(後述の「戦闘中の武器」を参照)、ClassicやTacticalの戦闘では`use`を持つアイテム(後述の「ClassicとTacticalの戦闘でのアイテム」を参照)です。プレイヤーの入力は引き続き`freeform`に従い、パーティーが持っていたものはどちらの場合も新しいセッションに戻ります。
- **アイテムの情報**は選択したスタックに表示されます。ラベルによるカテゴリー、レアリティー、タグ、与えるステータス、要約、1スタックの最大数です。選択画面は`cost`も表示します。GMは手元にある各アイテムを、カテゴリー、レアリティー、タグ、`promptVisible`のままにしたステータスとともに見ます。`Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`のような形です。

- **`slots`**: スロットを占めるアイテムは、それを運ぶキャラクターのスロットに空きがある間、装備できます。大きなスタックのアイテムは、1つを別のスタックに分けて装備します。インベントリーはキャラクターごとに使用中のスロットを表示します。
- **`binding`**: `binds`を持つアイテムは、持ち主自身のシートから読む`binding.max`までバインドできます(シートのないキャラクターは空白のシートを読みます)。`cursed`のアイテムは一度バインドするとバインドされたままです。プレイヤーはバインド解除、取り外し、譲渡、削除ができず、呪いを解けるのはGMだけです。
- **`carry`**: アイテムの重量は`carry.stat`の値で(値のないアイテムは重さがありません)、キャラクターの荷重は袋の重さです。それを自分のシートから読む`encumberedAbove`や`limit`と比べます。プレイヤーや、`who=`のないGMがインベントリーの共有ビューに追加したアイテムは、重量超過にならずに運べる人へ渡ります(まずプレイヤー、次にパーティーの順)。全部を引き受けられる人がいなければ、各自の残りの余裕に応じて分けます。誰の`limit`も超えません。誰も運べないものは置いていき、GMに伝えます。1/4ポンドのような重さには、重量ステータスに`"integer": false`を指定します。
- **GMはルールセットの語彙でアイテムを作ります。** `propose: false`を設定しない限り、GMの`[inventory: action="add"]`は新しいアイテムを記述できます。出発点にするルールセットのアイテムを`like=`で指定し、続いて`category=`、`rarity=`、`tags=`、`stats=`(`id=value`の組)、`slots=`(`id=count`)、`binds=`(`yes`、`cursed`、`no`)、`worn=`と`carried=`(`;`で区切った変更。それぞれ、名前で指定したスキルやセーヴ、またはすべてを表す`checks`や`saves`に対する`+N`、`-N`、`advantage`、`disadvantage`、セーヴの`fails`、能力値名に対する上下の`+N`や`-N`、さらに戦闘があるルールセットでは、攻撃に対する`+N`、`-N`、有利、不利と、防御(またはルールセットでの呼び名)に対する`+N`や`-N`です。`worn="+1 Sneak; disadvantage on Sway checks"`、`carried="+1 Brawn"`、`worn="+1 Guard"`、または`none`と書きます)、`summary=`のいずれかを、それぞれIDかラベルで指定します。防御がすでに数えているアイテムのステータス(Ember RoadsのGuardは装備品の`guard`を合計します)は鎧が防御を上げる手段なので、そうしたステータスと並べた装備中の防御変更は省き、回答でもそう伝えます。小さなモデルは1つの+1に対して`guard=1`と`+1 Guard`の両方を書くためです。小さなモデルが代わりに書きがちなものも読み取ります。名前の後の数値(`Brawn +1`)、攻撃や防御の後の「bonus」(`+1 attack roll bonus`)、タグ、ステータス、スロットの空のリストを表す`none`、同名のステータスがない場合の`stats=`内の`worn=`、`carried=`、`summary=`です。Engineはブロックにあるものだけを残します。未知のカテゴリー、タグ、ステータス、スロット、スキル、セーヴは省き、ないレアリティーは最低のものになり、数値はステータスの範囲、次にそのレアリティーの`rarityCaps`に制限し、装備中や携行中のボーナスはそのレアリティーの`bonus`に制限します(`like`で引き継いだ部分も同様です)。ルールセットのアイテムの名前は、そのままそのアイテムになります。回答はGMに変更内容を伝え(GMに見せないステータスについては伝えません)、アイテムの詳細はすべての変更をプレイヤーに示します。ゲームはアイテムを保持するため、同じ名前はゲームの終わりまでそのアイテムを指し、誰かが持っている限り新しいセッションでも保持されます。
- GMは、ルールセットに`slots`があればインベントリーコマンドで`equip`と`unequip`を、`binding`があれば`bind`と`unbind`を使えます。GMに伝えるのは、ルールセットにあるものだけです。GMは各キャラクターの荷重、バインド済みのアイテムとスロット、装備中またはバインド済みのものを見ます。

- **装備中や携行中のアイテムの効果**は、選択したスタックと選択画面に表示され(「While worn: -1 on checks (Sneak)」)、GMもアイテムと並べて見ます(`worn: -1 on checks (Sneak)`)。戦闘外の判定がこれを適用します(後述の「戦闘外の判定」を参照)。
- **武器の効果**も同様に表示され(「Attack (Action): Brawn to hit, 1d6 + Brawn cut damage」)、手に持っている間、戦闘で提示されます(後述の「戦闘中の武器」を参照)。
- **アイテム使用の効果**も同様に、残りのチャージとともに表示されます(「Use (Action): heals 1d4 + 1, range 0 paces, used up」)。戦闘で提示され、インベントリーの**Use**(使用)ボタンとGMの`[inventory: action="use"]`でも使えます(後述の「戦闘中のアイテム使用」と「戦闘外のアイテム使用」を参照)。

ClassicやTacticalの戦闘では、`use`を持つ各アイテムが記述どおりに働き、持たないものは提示されません(後述の「ClassicとTacticalの戦闘でのアイテム」を参照)。`native`の設定にかかわらず、シートはアイテムを読めます(後述)。手に持った武器はルールセットの戦闘での攻撃となり、撃つものを袋から取り出します。装備中や携行中のアイテムの効果はルールセットの戦闘でも数えます(後述の「戦闘中の鎧と装備効果」を参照)。`use`を持つアイテムは、戦闘中も戦闘外も独自の規則で使用されます(後述の「戦闘中のアイテム使用」と「戦闘外のアイテム使用」を参照)。`currencies`はパーティーのお金です(後述の「お金」を参照)。

<a id="items-on-the-sheet"></a>

## シート上のアイテム

値参照は`itemStat`でキャラクターが持つアイテムを読めます(Capability API 1.52)。Ember Roadsは、旅人が装備している鎧のガード値をGuardに加えます。Guardは打撃が上回る必要がある値です。

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"`はキャラクターが身に着けているアイテムです。スロットを占めるアイテムは装備中、`binds`を持つものはバインド中、両方を持つものはその両方の間が対象です。どちらも持たないアイテムは身に着けている扱いになりません。`"carried"`は持っているそれ以外のもの、`"all"`は両方です。
- `pick`: `"sum"`は各アイテムの値に個数を掛けて合計し、`"max"`と`"min"`は単一の値の最大または最小を読み、`"count"`はアイテムを個数で数えます。
- `stat`はアイテムのステータスの1つを指定します。`sum`、`max`、`min`には`number`のステータスが必要です。`count`は省略してすべてのアイテムを数えるか、任意のステータスを指定してそれを与えるアイテムだけを数えられます。
- `slot`、`category`、`tag`(それぞれ任意)は、そのスロットを占める、そのカテゴリーの、そのタグを持つアイテムだけに絞ります。
- `default`(任意、省略時は0)は、アイテムが選ばれない場合や、どれもそのステータスを与えない場合に読む値です。

アイテムはプレイ中に変わるため、`itemStat`はライブ値の読み取りと同じ規則に従います。プールやトラックの`max`、習熟ボーナス、`binding.max`、`carry`の数値、カタログの連動列やスケーリングは、派生値を通じてもそれを読めません。それ以外で数値を読む場所なら読めます。派生値、判定の`adjust`、スキルの`cap`、戦闘の防御、吸収、イニシアチブです。

キャラクターのアイテムは自分の袋に入っているものです。プレイヤーのカード(チャットで演じている人物の名前を持つカード、なければ最初のカード)はプレイヤーの袋を、ほかのカードはそれぞれ自分の袋を読みます。普通のアイテムには読むステータスがないため、数えるのはルールセットのアイテムだけです。画面上のシート、判定、GMのシートブロック、開始時の戦闘は、いずれもその時点で各キャラクターが持っているものを読みます。ゲーム外のシートエディターやインポートの確認画面では誰も何も持っていないため、`itemStat`は`default`を読みます。

<a id="checks-outside-a-fight"></a>

## 戦闘外の判定

GMが戦闘外で求める判定やセーヴは、シート以外も読みます。キャラクター自身の有効な状態、到達した段階、装備中や携行中のアイテムの効果、満たしていない装備品の要件によるコストです。戦闘の状態と同じ語彙を使います(アイテムのキーと絞り込みはCapability API 1.53)。

アイテムは、身に着けている間(バインドが必要ならバインド中)に適用する`worn`と、携行しているだけの間に適用する`carried`で効果を示します。Ember RoadsのLeather coatは忍び歩くと軋み、Waystoneを持っていると隊商の人々に信用されます。

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

どちらも、状態のうち判定が読む部分を受け付けます。

- `effects`: `own-checks-advantage`、`own-checks-disadvantage`、`own-saves-advantage`、`own-saves-disadvantage`です。
- `modifiers`: 判定やセーヴへの変更(`to`)で、状態とまったく同じく`flat`、`dice`(と`minus`)、`mode`、独自の`skills`や`saves`を持ちます。
- `failsSaves`: 持ち主がロールせずに失敗するセーヴです。
- `skills`と`saves`: 効果と、独自の対象を指定しない修正値が対象とするスキルやセーヴです。
- `abilities`(Capability API 1.54): IDで指定する、変更する能力値です。それぞれ`{ "set": N }`(最低N。それより高い値はそのまま)か`{ "add": N }`(負の数値で下げます)です。シートの計算前に適用するため、その能力値を読むものはすべて変更後の値を読みます。画面上のシート、派生値、判定、GMのシートブロック、開始時の戦闘です。先に加算を適用し、次に最も高い`set`を適用し、能力値自身の`min`と`max`は守られます。プールやトラックの最大値と習熟ボーナスはシートだけから計算するため、アイテムはそれらを動かしません。

Ember RoadsのOx-hide gauntletsは、握力の弱い者に牛追いの握力を貸します。

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

戦闘でのアイテムの効果(防御、攻撃、速度、戦闘のほかの効果、防ぐ被害と状態)は[戦闘中の鎧と装備効果](#armor-and-worn-effects-in-a-fight)で説明します。戦闘外の判定が読むのは上記の部分だけです。1つのアイテムは、何スタック持っていても1回だけ適用します。

アイテムは`requires`で装備者に何かを求めることもできます。シート上の値(`value`。任意の値参照で、プレイ中のすべての値と同じように読みます)、その最低値(`atLeast`)、満たさない間に適用するもの(`otherwise`。同じ語彙ですが、求めるものが能力値を読むことがあるため、能力値は変更できません)です。最大4つです。GravewatchのGrave spadeは、非力な番人には重労働です。

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

要件は装備者のアイテムを反映した後の能力値を読むため、Sinewを3にする篭手があれば、Grave spadeの要件を満たします。

判定では次のように扱います。

- 対象となるすべての修正値が数値を加え、ダイスを振ります。合計方式の判定では固定値、プールではダイスです。能力値判定と、ルールセットが名前を付けられない判定は、何にも絞り込まれていないものだけを読み、セーヴはセーヴを対象とするものだけを読みます。
- GMの`mode=`も含め、すべての出所からの有利と不利は打ち消し合います。有利と不利がそれぞれ1つ以上あれば、判定は1回だけ振ります。偏るのは、そもそも2回振るルールセット(`resolution.advantage`)だけです。
- 状態やアイテムで失敗するセーヴは、ロールせずに失敗し、何も消費しません。
- 記録には変更の理由が残ります。数値は`effects="-1"`、変更したものは`from="Leather coat"`、ロールせずに失敗したセーヴは`automatic="true"`です。ダイスカードも同じ内容を示し、GMは次のターンにそれを読みます。GMにはEngineがこれらを適用することが伝えられるため、重ねて加えることはありません。

Gravewatchはプールで同じことを示します。バインドしたDawn bellはWardにダイスを1個加え、RattledはSootheとBarterから1個減らします。

## 状態、段階、アイテム、シートの行による種類別の防御

`combat.conditions[]`と`combat.levels[]`は、`resist`、`vulnerable`、`immune`(それぞれ1～30項目)と`conditionImmunities`(1～40個の状態ID)を与えられます。状態が続く間、または段階のしきい値に達している間に適用されます。新たに得た状態への完全耐性は、その状態がすでに有効なら終わらせ、再び付与されるのを防ぎます。完全耐性は抵抗より優先され、抵抗と脆弱は打ち消し合います。複数の抵抗でダメージが2回半減することはありません。

`resist`と`immune`はクリーチャーと同じ形式を使います。ダメージの語か、`{ "type": "bludgeoning",
"except": ["magical"] }`です。打撃に指定したタグのどれかがあれば、その項目を素通りします。`vulnerable`は普通のダメージの語のままです。同じ例外の形式は、アイテムの`worn`と`carried`の効果でも使えます。例外のタグを`items.tags`で宣言し、武器や呪文の性質に付けてください。たとえば、Stoneskinは次のような状態の対応付けです。

```json
{
  "condition": "stoneskin",
  "resist": [
    { "type": "bludgeoning", "except": ["magical"] },
    { "type": "piercing", "except": ["magical"] },
    { "type": "slashing", "except": ["magical"] }
  ]
}
```

Armor of invulnerabilityは、その`worn`の効果の中で同じ`resist`の配列を使います。Protection from Energyは`resist: ["fire"]`を、Braveのような特性は`conditionImmunities: ["frightened"]`を与えられます。段階はそのしきい値で`resist: ["poison"]`を与えられます。`combat.damageTypes`が語彙を宣言している場合、クリーチャーと同じく、不明な静的ダメージの語が報告されます。その宣言がなければ、ダメージの語は自由な文字列です。

祖先やカタログの特性には、`combat.sheetHides`が最大8つの出所を持ちます(空の配列も使えます)。それぞれシートのリスト、そのリストの1つのテキストか列挙型の列、4種類の1つを指定します。特性の行の`resistance`の列に`"poison"`を持つドワーフなら次のとおりです。

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

すべての行は、カンマ区切りの語を提供し、前後の空白を除いて大文字と小文字を区別せずに照合します。空の語は飛ばします。`"fire"`を持つ行を追加すると火への抵抗が加わり、削除するとその出所はなくなります。抵抗と完全耐性の語は、`"bludgeoning except magical silvered"`のように`except`を含められます。脆弱と状態への完全耐性は普通の語です。シートの文章中の宣言されていない不明なダメージの語は無視され、不明な状態IDも無視されます。状態への完全耐性の列挙型の列は、インポート時に状態IDだけを宣言する必要があります。シート、戦闘、GMの要約は、これらの防御とその例外を含みます。

<a id="weapons-in-a-fight"></a>

## 戦闘中の武器

アイテムは武器にできます(Capability API 1.55)。その`attack`は、combatブロックの[攻撃の行](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)と同じ形で、列の代わりに値を持ちます。[ルールセットの戦闘](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)は、アイテムを身に着けている間、つまり占める手に持ち、バインドが必要ならバインドしている間、それを攻撃として提示します。しまっているものや携行しているだけのものは何も提示せず、攻撃の行とクリーチャー自身のアクションは従来どおりに動作します。Ember RoadsのHand axeは次のとおりです。

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: 消費する行動枠で、`combat.economy.budgets`の1つです。
- `toHit`: 命中に加えるものです。`abilities`は1つ以上の能力値IDで、その最良のものを数えます(フィネス武器は2つ列挙します)。`skill`は、攻撃の行と同じく、スキル自身の能力値の代わりに攻撃の能力値を使って、そのスキルの判定が加える値を加えます。`proficiency`は持ち主のシート上の値で、0より大きければルールセットの習熟ボーナスを加えます(常に加えるなら`{ "const": 1 }`)。`bonus`は数値です。`sheetBonus`は持ち主のシートから読んでそのまま加える数値で、武器自体ではなく、持ち主がある種類のすべての武器にもたらすものを表します。5eのArcheryの戦闘スタイルは、射手なら2、それ以外なら0になる派生値`{ "derived": "archery" }`を各遠隔武器に与えます(Capability API 1.95。アイテムの情報は、シート上の名前でそれを示します)。`target`はプール方式の戦闘でのこの武器の攻撃のダイスごとの目標値です(GravewatchのGrave spadeは、プールの7ではなく6以上の目をすべて数えます)。指定できるのは`target`を動かせる`dice-pool`のルールセットだけで、合計方式の戦闘では`bonus`が同じことを表します。
- `damage`: 与える`dice`、ダメージの`abilities`のうち最良のものの加算、`bonus`、`type`です。合計方式の戦闘には`dice`が必要です。プール方式の戦闘では、命中はその成功数を与え、`dice`はプール自身のダイスをその数だけ加えます。`sheetBonus`(Capability API 1.97)は、`toHit`のものと同じく、持ち主のシートからダメージに加える数値で、`"oneHanded": true`なら、武器を片手で持っている間だけ数えます。両手で使う`versatile`の武器や、スロットを2つ使う武器は含みません。5eのDuelingは、1つの武器を持つ決闘者に2となる`{ "derived": "dueling" }`を与えます。`rerollUpTo`(Capability API 1.98)は持ち主のシート上の値で、武器自身のダメージダイス(クリティカルの追加のダイスも含みます)のうちそれ以下の目を1回振り直して新しい目を確定します。武器を両手で使っている間(手が空いている`versatile`の武器か、スロットを2つ使う武器)、かつ合計方式の戦闘でだけ働きます。5eのGreat Weapon Fightingは、そのスタイルを持つと2となる`{ "derived": "great_weapon_fighting" }`を与えます。
- `reach`と`range`(`normal`と、それを超えても届く`long`)は`combat.distance`の単位で、それが必要です。両方を持つ武器は、攻撃の行と同じく投擲武器です。近くでは振るい、その先では投げます。どちらもなければ1マスに届きます。
- `versatile`: 持ち主が身に着けているものの中で、占める各スロットに同じだけの空きがある間に代わりに与える`dice`です。片手で持ち、もう片方の手が空いている槍などです。
- `strikes`: 攻撃の行の`strikes`と同じく、1回の消費で得る打撃の回数で、持ち主のシートから読みます。これがない武器は、使い手が何回攻撃できても1回の消費で1打撃です。

これらの数値や語は、代わりにアイテム自身のステータスを読めます。`{ "stat": "damage" }`はアイテムの`damage`で、アイテムが何も与えないステータスは値を書かなかったのと同じです。`abilities`と`skill`は語が能力値IDやスキルIDである列挙ステータスを、`type`はテキストや列挙のステータスを読みます。そのため、GMが武器を`like=`にして作るアイテムも、自身のステータスで戦う武器になり、ほかのステータスと同じく`rarityCaps`に制限されます(書き込んだ値はそのままコピーします)。スロットもバインドもなしに作ったものは身に着けられないため、攻撃なしで作られます。小さなモデルは武器を記述しても`like=`を省きがちなので、出発点なしで武器のカテゴリーに作られたものは、そのカテゴリーの武器のうち名前が最も似たもの(どちらかの向きで共有する語。crossbowはbowに似ています)、なければ最初のものとして戦い、提案が省いた、その攻撃が読むステータスを引き継ぎます。回答もそう伝えます(「It fights as Hand axe does.」)。GMの提案フォームも、ある武器に似せて作った武器はそれと同じように戦うことを伝えます。

武器のタグは、その打撃が帯びるものです。クリーチャーの`resist`や`immune`の項目は、何がそれを通り抜けるかを指定できます。`{ "type": "tearing", "except": ["silver"] }`は、`silver`タグの武器からは全量を受け、それ以外からは抵抗します。GravewatchのGrave wightはそのように書かれ、Silver coffin nailが通ります。武器のアイテム以外による被害は、同じアイテムのタグで、帯びるものを`qualities`(Capability API 1.101)で示します。カタログの項目の`mechanics`(呪文)や、クリーチャーのアクションの`damage`(デーヴァのメイス)に付けます。5eの「魔法でない攻撃による殴打、刺突、斬撃への抵抗」は、`{ "type": "slashing", "except": ["magical"] }`とほかの2つの同様のものを並べ、魔法の武器のタグに`magical`を、呪文とSRDが魔法とするクリーチャーの攻撃に`"qualities": ["magical"]`を付けます。

武器の詳細とGMへの行には、その効果が示されます。`attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`で、Ember RoadsのBoar spearには`1d8 with a hand free`、GravewatchのGrave spadeには`at 6`が付きます。

<a id="ammunition-and-reloading"></a>

### 弾薬と再装填

武器は何かを撃つことができ、自身に装填数を保持できます(Capability API 1.57)。Ember RoadsのHunting bowは矢を撃ち、GravewatchのWatch pistolは番人の弾と火薬から装填した1発を保持します。

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: 武器が撃つもので、アイテムの`tags`の1つで指定します。攻撃ごとに、持ち主が持つ(身に着けているかどうかを問わない)そのタグのアイテムを`perAttack`個(指定がなければ1)、袋の最初の該当スタックから、次に次のスタックから取ります。十分に持っている間だけ武器を提示し、戦闘メニューに残数を表示します。パーティーが勝った戦闘の後、各自が撃ったものの`recover`(0から1)の割合が、元のスタックに戻ります。割合は戦闘全体で合計し、スタックごとに1回切り捨てるため、1つの矢筒から撃った5本の矢の半分は2本です。負けた戦闘や逃げた戦闘では何も戻りません。
- `clip`: 武器自身が保持する装填数です。`max`は保持できる数で、直接書くかアイテムの数値ステータスから読みます。`reload`は再装填で消費する行動枠です。攻撃は袋から取る代わりに装填分を消費し、武器は1回分を保持している間だけ提示されます。戦闘メニューの**Reload**(再装填)は`reload`を消費して装填します。`ammo`があれば袋から(袋の残りが少なければその分だけ)、なければ全量を装填します。数は武器のインベントリーのスタックに保持するため、ある戦闘で空になったピストルは次の戦闘でも空です。まだ誰も撃っていない武器は装填済みで、プレイヤーが同じ武器を複数まとめたスタックに入れたものも同様です。装填数は1つの武器のものだからです。装填した弾は戦闘後に回収しないため、`recover`は装填数を持たない武器用です。

戦闘で撃ったもの、装填したもの、回収したものは、パーティーの体力と同じく各段階でインベントリーに書き込み、Journal(記録)に使ったものが残ります。スタックがなくなった段階や、戦闘が当てにしていたより少ない段階は、戦闘が見つけられない消費アイテムと同じく拒否されます。戦闘ログはすべての射撃、再装填、回収を示し(「Hunting bow: 2 left to shoot.」、「Ada loads 1 into Watch pistol: 1 of 1 loaded.」)、アイテムの詳細とGMへの行は武器が撃つものと保持するものを示します。`ammunition Arrow (1 an attack, 50% picked up after a won fight)`と`holds 1, reload (Act)`です。

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

### モード、二つ目の武器、下限、命中時の状態

武器は、攻撃の別の方法、オフハンドの相棒、与える被害の下限、命中した相手に付与する状態を持てます(Capability API 1.58)。Ember RoadsのHunting bowは一斉射撃ができ、GravewatchのSilver coffin nailは両手に1本ずつ持てて、深く刺さった相手に印を付けます。

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: 攻撃の別の方法で、最大6つです。それぞれ`id`、`label`、変更する内容を持ちます。`ammo`はそのモードの1回の攻撃で撃つ数なので、武器は撃つための`ammo`か`clip`を持ちます。`toHit`は命中に加える値で、プール方式の戦闘ではダイス、合計方式では数値です。`target`は、プールの目標値を動かせる場合に、プール方式の戦闘のダイスごとの目標値をこの量だけ動かします(武器自身の目標値、なければプールの目標値から。`+1`は難しくなります)。`targets`は狙える相手の数で、それぞれ個別に攻撃判定をします。戦闘メニューは攻撃を選んだ後(スタイルがあればイニシアチブのスタイルの後)に方法を尋ね、それぞれの見込みを示し、持ち主が撃てる分のあるモードだけを提示します。Engineが操作するパーティーメンバーは1体を狙うすべてのモードを比較し、複数を狙うモードはプレイヤーに任せます。ウィンドウ内では、攻撃はそのまま行います。
- `offHand`: オフハンド(利き手でない手)用の武器です。combatブロックは、2回目の攻撃が消費する行動枠と、そのダメージが正の能力値を保つかを指定します。

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  その持ち主がこのターンに`offHand`の武器の1つで攻撃すると、身に着けているほかのそうした武器はそれぞれ、その行動枠で2回目の攻撃を提示し、メニューでは「Silver coffin nail, off hand」と表示されます。`ability`は`full`(デフォルト)か`penalty-only`です。後者は5eの二刀流と同じく、何かを差し引く場合だけダメージの能力値を加えます。オフハンド攻撃は、主攻撃が得る打撃の数にかかわらず1撃で、離れていく相手への打撃には使えません。`offHand`の武器には、combatブロックの`offHand`が必要です。`fullWhen`(Capability API 1.97)は戦う者のシート上の値で、0より大きければ、5eのTwo-Weapon Fightingのスタイルと同じく、`ability`にかかわらず、その者のオフハンドは能力値をすべて加えます。

- `floor`: 命中が与える最小値で、直接書くかアイテムの数値ステータスから読みます。プール方式の戦闘の吸収後の被害、または合計方式の戦闘のダメージを、抵抗で半減する前にこの値まで引き上げ、ログにもそう示します。費やす打撃は使い手の数値を振るため、引き上げません。
- `onHit`: 打撃が与えた被害が`atLeast`に達したとき、標的が受ける状態で、最大四つです。持続は標的自身のターンで`rounds`回、指定がなければ何かが解除するまでです。被害は吸収と抵抗の後に届いた量です。奪う打撃は被害ではなくイニシアチブを奪うため、状態を付与しません。
  エントリーは`save: { "save": <save id>, "difficulty": n }`も持てます。状態が付与されるときに標的が振り、成功すれば付与されません。`saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`も持て、持ち主が自身の各ターンの開始時か終了時、またはゼロを超えるダメージを受けたときにそのセーヴに成功するまで続きます(その場合`rounds`は持ちません)。どちらもその状態に対するセーヴと数え、武器が魔法なら魔法に対するセーヴとも数えます(Capability API 1.169)。5eの負傷の剣は`{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`です。
- `plus`: 各命中でのさらに最大三つの量で、それぞれ`{ "dice", "flat", "type", "save", "targetIs", "when" }`です。それぞれ独立して振り、種類を持ち、抵抗されます(Capability API 1.169)。`save`は独自の`difficulty`と`onSuccess`(`half`か`none`)を指定します。`targetIs`は、それらのクリーチャーの種類やタグの標的にだけ与えます(戦闘のページの[各キー](ruleset-combat.md#every-key)にある「クリーチャーの種類と標的の条件」を参照)。`when: "critical"`はクリティカルヒットのときだけ与えます。どの条項のダイスも、武器のものと同じくクリティカルヒットで倍になります。稲妻の投げ槍は`{ "dice": "4d6", "type": "lightning" }`、竜殺しの剣は`{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`、鋭利な剣は`{ "flat": 14, "type": "slashing", "when": "critical" }`です。予測は、条項が届く標的に対してだけそれを数え、クリティカル専用のものは決して数えません。`when: "toggled"`は、アイテムのスイッチがオンの間だけ与えます(Capability API 1.170。後述の`toggle`を参照)。

武器の詳細とGMへの行には、そのすべてが示されます。`modes Volley (2 shots, -2 to hit, up to 2 targets)`、`off hand (Quick)`、`at least 1 on a hit before resistance`、`+3d6 slashing against Dragon`、`Marked for 2 rounds when a hit deals 2 or more`です。

<a id="armor-and-worn-effects-in-a-fight"></a>

## 戦闘中の鎧と装備効果

装備中や携行中のアイテムの効果は、持ち主の状態や段階と並んで、戦闘も変えられます(Capability API 1.56)。どちらも、状態のうち戦闘が読む部分を受け付けます。

- `effects`: 段階が持てない5つ(`half-move-to-stand`、`ends-on-damage`、`cannot-target-source`、`cannot-target-source-side`、`cannot-approach-source`)以外の、状態の任意の効果です。誰かがアイテムを持ち主に付けたわけではなく、ひとりでに終わることもないためです。`own-attacks-advantage`、`attacks-against-disadvantage`、`resist-all`、`speed-zero`などです。
- `modifiers`: 状態とまったく同じく、判定とセーヴに加えて防御、攻撃、速度への変更(`to`)です。`dice-pool`の戦闘では、状態と同じく、攻撃への変更はダイスの固定数です。
- `resist`、`vulnerable`、`immune`: クリーチャーと同じく、持ち主が半分、2倍、ゼロだけ受ける被害の種類です(宣言している場合は`combat.damageTypes`と照合します)。`conditionImmunities`: 持ち主に決して付与されない独自の状態です。

GravewatchのWidow's ringは呪われていて、すべての攻撃でダイスを1個失わせます。バインドしたDawn bellは持ち主をRattledから守り、Ember RoadsのWaystoneは持っているだけで熱を防ぎます。

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

戦闘は判定と同じく各アイテムを1回だけ読み、スタックの名前で示します(ログのロールの横や防御に「Widow's ring」)。満たされない要件の`otherwise`も戦闘で数えるため、装備者に重すぎる鎧は速度を下げることがあります。アイテムの詳細とGMへの行には、そのすべてが示されます(「While worn: -1 on attacks」、「worn: +1 on checks (Ward), immune to Rattled」)。防御や吸収に単純に加算する鎧は、`itemStat`で読むアイテムのステータスです(「シート上のアイテム」を参照)。Ember RoadsのGuardが身に着けたコートを読むのと同じです。

**硬度。** イニシアチブを攻撃で動かす数値として扱う場合、`combat.pool.hardness`は戦闘員の硬度で、戦闘開始時にシートから(鎧の値は`itemStat`を通じて)読みます。クリーチャーは独自の`hardness`を指定します。ダイスがそれ未満の費やす打撃は、当たっても何も起こしません。使い手の数値は基準値に戻り、ログにもそう示され(「Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing.」)、メニューもその打撃に被害を見込みません。指定できるのは費やすスタイルを持つルールセットだけで、シートとして記述したクリーチャーはシートから取ります。

<a id="using-items-in-a-fight"></a>

## 戦闘中のアイテム使用

アイテムは戦闘中に使用できます(Capability API 1.59)。傷に当てる湿布、飲む強壮剤、鳴らす鐘などです。`use`は、カタログ項目の`mechanics`と同じ語彙で使用の効果を示します([戦闘が`mechanics`から読み取るもの](ruleset-combat.md#what-a-fight-reads-from-mechanics)を参照)。`kind`(`heal`、`attack`、`buff`、`debuff`)、`amount`、`damageType`、`plus`、`attackRoll`、`save`、`applies`、`temporary`、`range`、`area`、`targets`、`targetCount`、`friendlyFire`、Capability API 1.174からは`concentration`と`zone`と、消費する`budget`または`free`です。Ember RoadsのPoulticeと、GravewatchのWarming tonicとDawn bellは次のとおりです。

```json
"use": { "kind": "heal", "budget": "act", "range": 0, "targets": "ally", "amount": { "dice": "1d4", "flat": 1 }, "consumes": true }
```

```json
"use": { "kind": "heal", "budget": "quick", "targets": "self", "amount": { "flat": 1 }, "consumes": true }
```

```json
"stack": 1,
"use": {
  "kind": "debuff",
  "budget": "act",
  "targets": "enemy",
  "save": { "save": "steel", "onSuccess": "negates" },
  "saveDifficulty": 7,
  "applies": [{ "condition": "rattled", "duration": { "rounds": 2 } }],
  "charges": 1
},
"charges": { "max": 3 }
```

- 使用は戦闘メニューの**Items**(アイテム)の下にあり、スタックの名前にかかわらずアイテム名(「Poultice」)で表示します。スロットを占めるかバインドが必要なアイテムは、鐘のように身に着けている間(バインドが必要ならバインド中)に使い、それ以外は携行中に使います。
- 行動枠を消費するか`free`で、アイテム自身で支払います。`cost`、`perCostStep`、`check`、`concentration`、`reaction`、`scales`、`gives`、`standard`、`rider`はシートが持つカタログ項目用で、使用では拒否されます。
- `toHit`は、`attackRoll`を持つ使用で命中に加える値で、武器の`toHit`と同じように指定します(「戦闘中の武器」を参照)。能力値、スキル、ボーナス、プール方式の戦闘ではダイスごとの目標値です。指定しなければ、ロールに何も加えません。
- `saveDifficulty`: 使用が求めるセーヴ(自身のもの、付与する状態を終わらせるもの、`difficulty`のない節のもの)の対象値で、直接書くかアイテムの数値ステータスから読みます。シート上の項目はその数値をカタログの出所から読みますが、アイテムにはそれがないため自身で指定します。
- `consumes: true`は使用するたびにアイテムのスタックから1つ減らし、メニューに残数を表示します。最後の1つを使うとスタックもなくなります。
- `restore`(Capability API 1.60)は、効果が及んだ各シートのプールの一部を回復します。血液パックが血を戻すように、`{ "pool": "resolve", "amount": { "flat": 1 } }`と書き、`dice`と`flat`は`amount`と同じです。指定するのはライブプールの1つで、体力のプールは指定できません(体力は回復で戻ります)。`heal`や`buff`など、助ける使用に付けます。クリーチャーはプールを持たないため、何も受けません。ログにも示され(「Ada gets back 1 Resolve, and is on 3 of 4.」)、Engineが操作するパーティーメンバーは満タンのプールには使いません。GravewatchのWarming tonicは、回復と並んでResolveを1回復します。
- `charges`は、アイテム自身の`charges`をその数だけ消費します。`max`は保持できる数で、1から100です。直接書くかアイテムの数値ステータスから読みます(そのステータスが1未満のアイテムは拒否され、100を超えるものは100を保持します)。数はアイテムのインベントリーのスタックに保持するため、ある戦闘で2回鳴らした鐘は次の戦闘ではチャージが1つ残り、誰も鳴らしていない鐘は満タンです。チャージは1つのアイテムのものなので、チャージを持つアイテムの`stack`は1です。使用は使い切るかチャージを消費するかのどちらかで、両方はしません。アイテムのチャージは常にその使用で消費します。GravewatchのDawn bellのように、`charges`には2つのキーを追加できます(Capability API 1.61)。

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: チャージを戻す`rests`とその量です。`"max"`はアイテムを満タンにし、量(`{ "dice": "1d6", "flat": 1 }`)はその数だけ戻しますが、`max`を超えません。休息は、シートのRestボタンでもGMの`[sheet: op="rest"]`でも、そのキャラクターが持つ、その休息を指定するすべてのアイテムのチャージを戻します。シートと袋は一緒に書き込み、再生成した返信が再充填するのは1回だけです。休息後、シートには戻ったものが表示され(「Dawn bell 3/3 charges」)、GMはインベントリーで各アイテムの横に残りのチャージを見ます(「2 of 3 charges left」)。
  - `breaksOn`: 使用が最後のチャージを消費すると、Engineはd`die`を振り、`atMost`以下ならアイテムが壊れて袋からなくなります。戦闘中でも戦闘外でも同じです。戦闘ログにも(「Dawn bell breaks (a 1 on its die).」)、Useボタンの報告にも(「Its last charge spent, it breaks.」)示され、Journalは失ったものとして数えます。

- `gate`(Capability API 1.62)は、アイテムが働く前に使用者が通る判定です。読み手より高位の呪文の巻物が判定を求めるようなものです。`check`は振るものを指定します。`{ "skill": "ward" }`、`{ "ability": "wits" }`、またはシート上の値(`{ "value": { "derived": "spell_mod" } }`。5eの術者の呪文発動修正値のように、キャラクターごとに異なる数値用)です。`difficulty`は1から100で、直接書くかアイテムの数値ステータスから読みます(それを与えないアイテムはメニューから除外し、Useボタンもそれをはっきり示します)。`unless`は、使用者のシート上の値が`atLeast`以上なら判定を省きます。判定に失敗すると、アイテムを無駄に使い切ります(またはチャージを消費します)。戦闘中は、アイテムを消費する時点で、戦闘自身のダイス(プール方式の戦闘ではプールで、`difficulty`は必要な成功数)と、戦闘開始時に読んだシートの数値で判定を振り、使用者の状態と身に着けたアイテムがその判定に加えるものも、スキル自身のものを含めて数えます。ログにも示されます(「Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success.」)。GravewatchのPage of the vigil litanyは次のように指定します。

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

戦闘で使い切ったものと残ったチャージは、武器の射撃と同じく各段階でインベントリーに書き込み、Journalが使ったものを記録します。戦闘ログは各使用を示します(「Poultice: 1 of 2 left.」、「Dawn bell: 2 of 3 left.」)。Engineが操作するパーティーメンバーは負傷した相手にだけ回復を使い、離れていく相手への打撃にアイテムを使う者はいません。アイテムの詳細とGMへの行は使用の効果を示し(「Use (Action): heals 1d4 + 1, range 0 paces, used up」と`use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`)、詳細には残りのチャージも表示します。GMがルールセットのアイテムを`like=`にして作ったアイテムは、チャージも含めてそのアイテムと同じように使います。

## ClassicとTacticalの戦闘でのアイテム

独自に戦闘を解決しないルールセットは、Game Mode自身のClassicとTacticalの戦闘に任せます。そこでは戦闘開始時に、インベントリーのアイテムが何をするかをモデルに尋ねます。ルールセットのアイテムは推測しません。`use`を持つ各アイテムはEngine自身の数値で記述どおりに働き、GMの推測を求めるのはルールセットのものでないアイテムだけです(`native: false`なら何も求めません)。

- `heal`は回復し、`attack`は被害を与えます。量は`amount`の平均から求める、標的の最大体力に対する割合です。平均7(基本的な武器の`1d8+3`)は5分の1を少し超える程度で、20分の1を下回らず、最大で全部です。これは戦闘への橋渡しがカタログ項目の数値を読む尺度です。`damageType`は属性になります。
- `applies`の最初の状態を、その名前の状態異常として`rounds`の間(なければ2)付与します。`buff`や`debuff`はその状態異常だけで、Engine自身の状態異常と同じく防御を上げ下げします。
- `targets`は使う相手を示します。指定しなければ、回復と強化は味方へ、攻撃と弱体化は敵へ向かいます。
- `consumes: true`はスタックから1つ減らし、それがない使用ではアイテムはそのまま残ります。
- 命中判定、セーヴ、範囲、一時ポイント、プールの回復は、カタログ項目の`mechanics`と同じく、これらの戦闘には受け皿がありません。メニューのアイテムの説明には引き続き表示されます。
- スロットを占めるアイテムは身に着けている間だけ、バインドが必要なアイテムはバインド中だけ使えるのは、ルールセットの戦闘と同じです。使い切るものは身に着けているものから取り、袋の予備からは取りません。
- 使用が`charges`を消費するアイテムは、使用回数が残っている間提示され、Itemsメニューにその回数が表示されます。各使用はアイテムのスタック(プレイヤー自身のものから先)から消費し、最後に消費したときに`breaksOn`を振ります。壊れると袋からなくなり、Journalは失ったものとして数えます。
- 先に判定を求めるアイテム(`gate`)は、パーティーメンバーが使うとき、Useボタンと同じく、そのメンバーのシートと身に着けたものでサーバー上で判定を振り(自分のカードを持たない仲間は空白のシートで振り、プレイヤーのカードにフォールバックするのはプレイヤー自身のユニットだけです)、`unless`が成り立てば省きます。失敗すると、アイテム(またはチャージ)を消費して何も起こらず、ログにもそう示されます(「Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing.」)。
- `use`のないアイテムはこれらの戦闘で提示されず、`amount`のない回復も同様です。

Engineが各アイテムの効果を自ら計算するため、画面が送る内容がルールセットのアイテムの効果を決めることはありません。

<a id="loot"></a>

## 戦利品

勝利した戦闘は、すべてのGame Modeのゲームで1回だけ、パーティーの袋に戦利品を落とします。ルールセットがなければGame Mode自身の表から出て(難しいゲームほど多く、レアになります)、戦利品表を宣言せず`native`をオンのままにしたルールセットでも同様です。戦利品表を宣言したルールセットは代わりに独自のアイテムを落とし、`native: false`で表のないルールセットは何も落としません。

`items`ブロックの`lootTables`(Capability API 1.63)が表を列挙します。GravewatchのGrave goodsは次のとおりです。

```json
"lootTables": [
  {
    "id": "grave_goods",
    "label": "Grave goods",
    "rolls": "1d2",
    "entries": [
      { "item": "kit/shot-and-powder", "weight": 4, "count": "1d4" },
      { "item": "kit/warming-tonic", "weight": 3 },
      { "item": "kit/litany-page", "weight": 2 },
      { "filter": { "category": "arm" }, "weight": 1 },
      { "coins": "shilling", "weight": 2, "count": "1d6" }
    ]
  }
]
```

- `rolls`は表が選ぶ回数です。数値(0～20)かダイス(`"1d2"`)で、デフォルト: 1です。
- 各選択では、ほかの行に対する`weight`(デフォルト: 1)で一行を引きます。行は、`<catalog>/<entry>`としてアイテムの一つを指定するか、`rarity`、`category`、`tag`による`filter`(一致するすべてのアイテムから均等に選びます)か、(Capability API 1.64)IDで硬貨の一つを指定する`coins`です。`count`は落とす数で、数値かダイスで指定し、デフォルト: 1です。レイヤーが除いたアイテムや硬貨は何も落とさず、何も見つからないフィルターも同様です。
- ベスティアリのクリーチャーは、`loot`で持っている表を指定します([クリーチャー](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)を参照)。勝利したルールセットの戦闘は、倒した各クリーチャーの表を振ります。Engineがルールセットの規則で解決しない戦闘にはベスティアリのクリーチャーがいないため、何も落としません。
- 落としたものは追加と同じく共有ビューに入り、まずプレイヤーの袋を確認し、誰も運べないものは置いていきます。Game Masterが受け取る要約は、何が落ちたか、それがすでに袋に入っていることを伝え、Journalにも記録され、通知も表示されます。
- Game Masterは物語の中で`[loot: table="grave_goods" who="Ada"]`で表を振ります(`who=`は一人のキャラクターの袋に入れる場合)。インベントリーのタグと同じくターン開始時点から計るため、再生成した返信が落とすのは一回だけです。落とした各アイテムは追加として応答し、Game Masterへの指示に表が列挙されます。

## お金

`currencies`はパーティーのお金です。硬貨は袋の中のアイテムで、ほかと同じく硬貨ごとのスタックになり、`label`で呼びます。

- 系統の硬貨`perWeight`枚ごとに運搬ステータス1単位の重さがあり、持ち主の荷重に数え、入手時には運搬の規則で渡す人を決めます。`perWeight`のない系統は重さがありません。
- プレイヤーは選択画面の**Coins**(硬貨)リストから硬貨を追加し、ほかのスタックと同じく分割、譲渡、統合できます。
- インベントリーのスタックの上の行に、表示中の各系統の硬貨と、系統の最小硬貨での価値を表示します。GMは各袋の横にその価値を(`Coin worth 432 pennies`、空の財布なら`no coins`。プレイヤーの袋は何もなくても表示します)、アイテムの横に`cost`を(`costs 3 shillings`)見ます。
- GMは`[inventory: action="pay" amount="3 shillings" who="Ada"]`で支払い、`action="earn"`で受け取ります。`amount`は数と硬貨で、硬貨はIDかラベル、単数形でも複数形でも、大文字・小文字も問いません(`1 penny`、`12 pennies`)。支払いは1つの袋(`who=`がなければプレイヤーの袋)から、その硬貨の系統の中だけで行います。収まる最大の硬貨から使い、次に残りの不足額をまかなえる最小の硬貨を崩し、お釣りは系統の小さい硬貨で、大きいものから戻します。回答は支払ったものと戻ったものを示します。1 crownが入った財布から3 shillingsを払うと`Paid with crowns ×1; shillings ×2 back.`です。袋で払えない支払いは拒否され(`cannot-afford`)、ない硬貨(`unknown-coin`)や通貨のないルールセットでの支払い(`no-currencies`)も拒否されます。受け取りはその硬貨の追加で、`who`の袋に入るか、運搬の規則で分けます。Journalは使ったものと得たものを記録し、通知も表示されます。GMへの指示には硬貨が列挙され、硬貨のあるルールセットだけにあります。
- 購入は支払いの後の追加か、市場のあるルールセットでは`buy`(後述)です。店の画面はありません。

## 初期装備

`items.startingGear`(Capability API 1.78)は、キャラクターが開始時に袋に入れられる装備を列挙します。クラスのキット、背景のキット、天職のキットなどです。単独で与えられることはありません。インベントリーには**Starting gear**(初期装備)の行が表示され、プレイヤーは装備を1つと、その各選択の選択肢と、各リストのアイテムを選び、プレイヤーの袋かパーティーのメンバーの袋に入れます。キャラクターのシートが`fits`する装備が先に、次に`fits`のない装備(背景のものなど、どのキャラクターにも合うもの)が並びます。キャラクターのコンセプトはプレイヤーとGMが合意して決めるものなので、すべての装備が提示されます。

```json
"startingGear": [
  {
    "id": "fighter", "label": "Fighter", "group": "class",
    "fits": { "value": { "field": "level_fighter" }, "atLeast": 1 },
    "lines": [{ "item": "equipment/shield", "equip": true }],
    "choices": [
      {
        "label": "Armor",
        "options": [
          { "label": "Chain mail", "lines": [{ "item": "equipment/chain-mail", "equip": true }] },
          { "label": "Leather armor and a longbow", "lines": [
            { "item": "equipment/leather-armor", "equip": true },
            { "item": "equipment/longbow" }, { "item": "equipment/arrow", "count": 20 }
          ] }
        ]
      },
      { "label": "A martial weapon", "options": [
        { "label": "Pick one", "lines": [{ "oneOf": ["equipment/longsword", "equipment/battleaxe"] }] },
        { "label": "A greataxe", "lines": [{ "item": "equipment/greataxe" }] }
      ] }
    ]
  },
  { "id": "acolyte", "label": "Acolyte", "group": "background", "lines": [{ "coins": "gp", "count": 15 }, { "name": "Vestments" }] }
]
```

- 行は、ルールセットのアイテム(`item`)、硬貨(`coins`、単位ID)、固定のリストからプレイヤーが選ぶ1つのアイテム(`oneOf`、2～48個)、名前で書く普通のアイテム(`name`。`freeform`が普通のアイテムを許す場合で、ラベルの規則に従うため、角括弧、`{{`、改行は使えません)のいずれかです。`count`は1～999です。`equip: true`は、スロットが空いていれば受け取ると同時にアイテムを装備するため、鎧は最初から数えられます。
- `choices`は0～8個で、それぞれ独自の行を持つ2～6個の選択肢があります。
- `group`: キャラクターが各グループから1回受け取る装備です(クラスのものと背景のもの)。同じグループをもう一度受け取るかはプレイヤーがダイアログで選び、すでに袋にあるものに加わります。グループのない装備はそれ自体が1つのグループで、同じ名前のグループと同じになることはありません。
- `fits`は、携帯と同じく、ライブ状態なしでシートを読みます。一覧の順序を決めるだけです。
- 受け取りはすべてか無かです。持ち主にとって重すぎる装備は丸ごと拒否され、ダイアログは重さとまだ運べる量を示します。レイヤーがゲームから除いたアイテムは除外されて名前が示され、すべてのアイテムが除かれたリストも同様です。レイヤーが除いた硬貨は、同じ価値の残っている最大の硬貨で支払われ、ダイアログはそのように表示します。何も残らない装備は拒否されるため、何もないのに受け取り済みと記録されることはありません。サービスがリストから提示されることはありません。
- インポートは、すべてのアイテム(インラインのカタログ内のもの。独立したファイルのカタログは装備を受け取るときに検査します)、硬貨、普通のアイテム、`fits`の参照を検査し、サービスを拒否し、袋が一度に受け取れるより多くのスタックを必要とする数を拒否します。

## 市場

`items`ブロックの`market`(Capability API 1.65)は、すべての店がすべてを定価で売る代わりに、場所が何をいくらで売るかを示します。Gravewatchのものを少し短くすると次のとおりです。

```json
"market": {
  "prices": [
    { "id": "cheap", "label": "cheap", "times": 0.75 },
    { "id": "fair", "label": "fair", "times": 1, "default": true },
    { "id": "dear", "label": "dear", "times": 1.5 }
  ],
  "places": [
    { "id": "hamlet", "label": "hamlet" },
    { "id": "village", "label": "village" },
    { "id": "town", "label": "market town" },
    { "id": "city", "label": "city" }
  ],
  "sold": [
    { "filter": { "rarity": "rare" }, "place": "town" },
    { "filter": { "category": "arm" }, "place": "village" }
  ],
  "sellers": [
    { "id": "chandler", "label": "chandler", "sells": [{ "category": "coat" }, { "category": "tonic" }] },
    { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "place": "village" },
    {
      "id": "chapel",
      "label": "chapel of the Vigil",
      "sells": [{ "category": "page" }],
      "place": "town",
      "only": { "value": { "abilityScore": "nerve" }, "atLeast": 3, "label": "wardens of Nerve 3 or more" }
    }
  ]
}
```

- `prices`: 1～8の価格水準で、それぞれアイテムの`cost`への倍率(`times`、0より大きい値)で、1つが`default`です。価格は、系統の最小硬貨でのコストに水準を掛けて最小硬貨単位で丸めたもので(コストのあるものは1枚未満になりません)、コストを書いた硬貨でちょうど払えればその硬貨で、そうでなければレイヤーが残す硬貨のうちちょうど払える最大のもので示します。`dear`では8 shillingsのコートは12 shillingsで、50 gpの5eのポーションは50 gold piecesであり、5 platinumにはなりません。値切りや売り手の機嫌は水準を動かし、数値は動かしません。
- `places`: 1～12の場所の規模で、小さい順に独自の言葉で書きます。
- `sold`: フィルターが選ぶものを売る最小の場所の規則です。フィルターは`rarity`、`category`、`tag`のいずれかを指定し、指定したすべてを持つアイテムに一致します。アイテムに一致する最初の規則が決めます。アイテム自身の`sold`が規則より優先し、何も指定しないアイテムはどこでも売られます。
- `sellers`: 売り手の種類です。それぞれ`sells`(フィルターで、いずれかがアイテムを選びます)、売り手がいる最小の`place`(なければどこでも)、任意で売る相手を限る`only`を持ちます。売る相手の条件は、買い手のシート上の値(ライブ状態と持ち物を含む)が`atLeast`以上であることで、GMには`label`として伝えます。`sellers`がなければ、その場所の誰でも、その場所で売るものを売ります。
- `unsold`(Capability API 1.813): `sold`や`sells`でどこに置かれるかにかかわらず、どの売り手の商品にも並ばないもののフィルターです。売り手の`stock`の表では引き続き出ることがあるため、その在庫に出るものを買うのが唯一の購入方法で、売り手は引き続き買い取ります。レイヤーはこれに追加できます(魔法の少ない設定の`[{ "tag": "magical" }]`など。[レイヤー](ruleset-layers-and-translations.md)を参照)。
- `cost`のないアイテムは売り物ではなく、レイヤーが隠すアイテムや、レイヤーが硬貨を除いたアイテムも同様です。

**パーティーの居場所。** GMは`[place: name="Millbrook" size="market town"]`で場面の場所とその規模を示します。規模はIDかラベルで指定し、市場のない場所(道中、荒野)では規模を省きます。Engineは各タグにその場で応答し、ない規模は拒否します。最新の会話開始以降、プレイヤーが見るEngine自身の返信の中で最後に応答した場所が、別の場所が示されるまで有効な場所です。プレイヤーが入力した場所タグは数えません。再生成した返信は、置き換える告知より前にあったものだけを読みます。

**購入。** GMは`[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`で購入します。`level`(なければデフォルト)と`seller`(なければ、ここでそのアイテムを売る任意の売り手)は任意です。Engineは返信の終了時に有効な場所で価格を付け、支払いと同じくお釣りを含めて買い手の財布(`who=`がなければプレイヤーの財布)から代金を取り、アイテムを袋に入れます。サービスなら支払うだけです。両方が起きるか、どちらも起きないかです。回答は価格(`price="12 shillings"`)と、支払ったものと戻ったものを示し、通知も表示されます。購入は次の場合に拒否され、何も変わりません。場所が示されていない(`no-place`)、ない水準、アイテム、売り手(`unknown-level`、`unknown-item`)、価格がない(`not-for-sale`)、アイテムには場所が小さすぎる(`not-here`)、ここにそれを売る売り手がいない(`no-seller`)、買い手が売り手の`only`を満たさない(`not-to-you`)、財布で払えない(`cannot-afford`)、袋で運べない場合です。

**GMが見るもの。** 市場のある場所での場面の間、MARKETブロックが場所とその規模、価格水準、そこにいる各売り手と、デフォルトの水準で安い順に並べた売り物12個を示します。売り物はどれでも名前で購入できます。GMへの指示は`[place:]`と`buy`を教え、市場のあるルールセットだけにあります。

### 市場の一日

市場の一日(Capability API 1.69)は、場所の品揃えを変化させて売り切れさせ、パーティーが売り戻せるようにします。Gravewatchのものを少し短くすると次のとおりです。

```json
"places": [
  { "id": "hamlet", "label": "hamlet", "purse": { "amount": 10, "unit": "shilling" } },
  { "id": "town", "label": "market town", "purse": { "amount": 100, "unit": "shilling" } }
],
"buyBack": 0.5,
"sold": [{ "filter": { "rarity": "rare" }, "place": "town", "limited": "1d2" }],
"sellers": [
  { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "stock": { "table": "smiths_odd_lot" } }
]
```

- **一日。** ある場所での一日は、GMが別の場所を示すまで続きます。同じ場所で新しい日を始めるには、`day="new"`を付けてもう一度示します(`[place: name="Millbrook" size="market town" day="new"]`)。以下はすべて、プレイヤーが見るGMの返信から日ごとに計算するため、スワイプ、再生成した返信、分岐に保存するものは不要で、同じ日は常に同じ品揃えになります。
- **`limited`**は`sold`の規則かアイテム自身の`sold`に付け、ある場所がその日に置いておく数で、数値か、その日のために振るダイスです。規則は場所なしで上限を指定できます(どこでも売られ、一度に少数)。アイテムの場所は場所を指定する最初の規則から、上限は上限を指定する最初の規則から取ります。売り切れると、新しい日まで購入は拒否されます(`sold-out`)。
- **`stock`**は売り手に付け、戦利品表の1つです。1日に1回振り、その売り手が売り物に加えて在庫として持つものを決めます。振って出たもの(アイテムだけで、硬貨は出ません)は、`sells`や`sold`の指定にかかわらず、その売り手だけが出た数だけ売ります。売り手の`only`は引き続き適用されます。
- **`buyBack`**: 売り手がアイテムに支払う、デフォルト価格に対する割合(0より大きく1以下)です。その種類のものを売るここの売り手が買い取ります(売り手がいなければ誰でも)。`buyBack`がなければ、誰も買い取りません。
- **`purse`**は場所の規模に付け、その売り手たちが1日に合計で支払える最大額で、硬貨の1つで指定します。その硬貨の系統で支払う売却がそれに数えられ、財布がなければ無制限に買い取ります。
- **売却。** GMは`[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`で売ります。Engineは価格を付け、売るキャラクターの袋(`who=`がなければプレイヤーの袋。バインドした呪われたアイテムは不可)からアイテムを取り出し、硬貨を大きいものから入れるか、拒否して何も変えません。拒否するのは、場所が示されていない、ここで誰も買い取らない(`not-bought`)、価格がない(`not-for-sale`)、今日の財布を使い切った(`purse-spent`)、持っていない、袋が硬貨を運べない場合です。回答は売値(`price="4 shillings"`)を示し、Journalは売却として記録し、通知も表示されます。
- MARKETブロックには、各売り手の今日の在庫、上限のあるアイテムの残数、ここの売り手が支払う額と今日の財布の残りが加わります。GMへの指示は`sell`と`day="new"`を教えます。

### 正直な売り手と不正直な売り手

Capability API 1.79では、アイテムを危険なものや偽物にし、売り手を不正直にできます。

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- アイテムの**`risky`**: 正直な売り手が売る前に警告する内容です。MARKETブロックは、正直な売り手の商品の横に「(warn the buyer first: ...)」と示し、不正直な売り手は何も言いません。
- アイテムの**`passesFor`**は、それを別のアイテム(`<catalog>/<entry>`)の偽物にします。偽装先は同じカテゴリーで、同じスロットに着用する、実在する売却可能なアイテムで、偽物がバインドするならそれもバインドするものです。両方を読める場合はインポート時に、すべてのカタログファイルについてはインストール時に、さらに市場が提示するときにも検査されるため、対象が存在しないかレイヤーで隠された偽物が売られることはありません。呪われたアイテム(`binds.cursed`)や偽物が誰かの商品に並ぶことはなく、正直な売り手の在庫に入ることもありません。
- 売り手の**`honest: false`**: その`stock`の表で出た偽物は、偽装先のアイテムとしてその価格で提示され、MARKETブロックはその横にGMへ真実を示します。その売り手とそのアイテムを指定する購入では偽物を受け取り、売り手を指定しない購入では決して受け取りません。
- **袋の中の偽物**は、プレイヤーが見るあらゆる場所(袋、Journal、通知、戦闘)で偽装先のアイテムとして表示され、本当の正体を保ちます。GMのインベントリーブロックはそれに`[FAKE: really ...]`と印を付け、表示されている名前で呼び続けるよう求めます。
- **正体の発覚**: `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`、バインド(同調すると呪いが判明します)、使用(本当の効果が起き、規則で解決できない場合はGMが伝えます)、または正直な買い手への売却で発覚します。正直な買い手は本当の正体を告げ、その価値(自身の`cost`)を支払うか、価値がなければ拒否します。不正直な買い手は偽物を見かけどおりのものとして受け取ります。以後、それは本当のアイテムになります。
- **着用または携帯**: 偽物は、キャラクターのシート上で本当の効果(その`worn`や`carried`の効果とステータス)を持ちます。偽装先のアイテムなら示さない数値や判定への加算をシートが示すようになった後の最初のインベントリーの変更で発覚し、Journalと画面がその正体を示します。戦闘だけが読む違い(抵抗)では発覚せず、シートだけの変更でも、次のインベントリーの変更までは発覚しません。戦闘では、着用した偽の武器は引き続き偽装先の武器として攻撃します。
- シングルプレイヤーの信頼設定では、Peek PromptがGMの視点を、真実も含めて表示します。

<a id="spotting-fakes"></a>

### 偽物の見破り

Capability API 1.802では、キャラクターが判定を行うか、誰かが支払う前に気づくことで、偽物を偽物だと見破れます。Engineは、どの判定も名前からは認識しません。判定はルールセットが定義します。

```json
{
  "id": "potion-of-poison",
  "label": "Potion of Poison",
  "item": {
    "category": "potion",
    "passesFor": "magic_items/potion-of-healing",
    "tells": [
      {
        "check": { "value": { "derived": "poisoners_kit_check" } },
        "dc": 13,
        "carries": { "anyOf": ["gear/poisoners-kit"] },
        "says": "a faint bitterness under the sweetness"
      },
      { "check": { "skill": "arcana" }, "dc": 18, "says": "its magic does not feel like healing magic" }
    ],
    "foolsReveal": ["identify"]
  }
}
```

```json
"items": {
  "namesItAt": 5,
  "revealsFakes": [{ "id": "identify", "label": "Identify" }, { "id": "detect-poison", "label": "Detect Poison and Disease", "items": ["magic_items/potion-of-poison"] }],
  "market": { "sellers": [
    { "id": "fence", "label": "Fence", "honest": false, "sells": [{ "tag": "magical" }],
      "manner": { "check": { "skill": "insight" }, "dc": 13, "advantageIf": [{ "value": { "derived": "knows_trade" }, "atLeast": 1 }], "says": "their eyes slide away when you ask about it" } }
  ] }
}
```

- 偽物の**`tells`**(最大六つ): それぞれ、誰でも試みられる判定(`check`は、使用の`gate`と同じ指定方法で、スキル、能力値、またはシートから読み取る値を指定します)、その難易度`dc`、成功時に見て取れる内容(`says`)からなります。`needs`は、その判定を試みるためにシートが満たす必要のある要件です(`needsAny`なら、そのうちどれかを満たせば足ります)。`carries`は、道具判定に使うキットなど、判定するキャラクター自身の袋に必要なアイテムです。`advantageIf`のいずれかの行を満たせば有利で、`disadvantageIf`のいずれかを満たせば不利でダイスを振ります。
- 不正直な売り手の**`manner`**: アイテムではなく売り手についての判定で、構成要素は同じです。成功すると、売っているものに何かおかしい点があるとわかりますが、正体までは決してわかりません。
- **調べる**: `[inventory: action="inspect" item="Potion of Healing" who="Mira"]`はMiraの袋にあるアイテムを調べ、`seller="Fence"`は、誰かが買う前に、その場の売り手が今日提示している商品を調べます。偽物を見抜けるルールセットが提供するインベントリーの**Inspect**(調べる)ボタンは、「信用する前に、自分のPotion of Healingを注意深く調べます。」と伝え、Game Masterにタグを書かせます。Engineは、偽物の見分け方と不正直な売り手の様子について、そのキャラクターが行える最良の判定を、ルールセット自身のダイスで振ります。偽物に対して成功すると、疑わしいとわかります。応答には何を見て取ったかが示され、袋には「Miraは偽物だと考えています」と表示されますが、名前は引き続き偽装先のものです。見分け方の判定で難易度を`items.namesItAt`以上(5eの場合: 5)上回って成功すると、正体も判明し、以後は本当のアイテムになります。本物のアイテムでは、それに偽装する偽物の見分け方についてダイスを振るため、調べようとするだけでは何もわからず、成功すると本物に見えると伝えます。各キャラクターはアイテムごとに一度だけ試みられます(スタックは誰が試みたかを保持し、商品については市場のその日の間記憶します)。失敗すると、見分けられないと伝えます。正体がわかる手がかりのないアイテムや、そのキャラクターがまったく判定できないアイテムは`nothing-to-check`で拒否され、試行回数を消費しません。
- **購入前の気づき**: 不正直な売り手からの購入で偽物を受け取ることになる場合、パーティーの購入者以外の各メンバーが、アイテムと売り手について行える各判定を、ダイスを振らずに評価します。`items.passiveBase`(10がデフォルト)に自身の数値を加え、有利なら+5、不利なら-5です。最初に難易度を満たしたメンバーが気づきます。何も支払われず、購入への応答は`reason="held"`となり、誰が何に気づいたかが示されます。Game Masterには、その仲間がキャラクターとして購入者に警告する場面として描写し、その仲間の性格ならそうする場合を除き、売り手を面と向かって非難せず、購入者に決めさせるよう求めます。プレイヤーにはそれ以外のことは伝えません。その日に、その売り手からの同じ購入を再度要求すると、購入は実行されます。`items.warnBy: "roll"`は、代わりにそれらの判定でダイスを振ります。
- **偽物の看破**: `items.revealsFakes`は、キャラクターがアイテムにかけられる、偽物を見抜く方法(呪文、儀式)を列挙します。それぞれに`id`と`label`があり、一部の偽物だけを見抜く方法には、その偽物が持つ`tags`、または偽物そのものへの参照(`items`で、指定できるのは偽物だけです)を記述します。偽物を直接指定すれば、正体を明かすタグを付けずに済みます。「poison」のタグを付けた毒のポーションは、偽装先の回復ポーションと並べると正体がわかってしまいます。`[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]`は、その方法を一つ指定します。その方法で見抜ける偽物は正体が判明し、`foolsReveal`にその方法を列挙している偽物は偽装先のアイテムとして表示されます。その方法では見抜けない偽物や本物のアイテムでは何も判明しません(どんな偽物でも見抜ける方法なら「genuine」、それ以外は「unsure」)。試行回数は消費しません。発動にかかるコストは、他の呪文と同じくGame Masterが扱います。
- これらのいずれかを使うルールセットにはCapability API 1.802が必要です。偽物でないアイテムに偽物用の`tells`や`foolsReveal`を指定した場合、`carries`のアイテムや`revealsFakes`のアイテムがルールセットに存在しない場合(`items`では偽物であることも必要です)、および`revealsFakes`に列挙されていないIDを`foolsReveal`に指定した場合は、インストール時に拒否されます。

<a id="using-items-outside-a-fight"></a>

## 戦闘外のアイテム使用

同じ`use`は戦闘外でも使えます(`restore`はCapability API 1.60で、それ以外に新しい指定は不要です)。`use`を持つルールセットのアイテムに付くインベントリーの**Use**ボタンと、GMの`[inventory: action="use" item="Poultice" who="Juno"]`は、どちらもEngineのダイスで、アイテムを持つ人にその効果を適用します。

- 回復は体力を戻します。戦闘中の回復と同じく、体力のプールや通常の体力トラックではその量だけ回復し、負傷トラックでは印を1つ消します。`temporary`のポイントは体力のプールに付き、`restore`はそのプールを回復し、`applies`の各状態は何かが解除するまで付与します。
- 被害を与える使用や、相手側を狙う使用(`kind`が`attack`か`debuff`、または`targets`が`enemy`)は誰にも当たりません。戦闘外には盤面上に当てる相手がいないためです。アイテムは使用され、GMには語りのためにその効果が伝えられます。
- 戦闘とまったく同じく、スタックから1つ減らすかチャージを消費します。残りがないもの、スロットを占めるかバインドが必要で身に着けていないものは拒否され、何も変わりません。シートと袋は一緒に書き込みます。
- `gate`は判定と同じく最初に振ります。ルールセット自身のダイスとシートの数値に、使用者の負傷ペナルティと、状態や装備中・携行中のアイテムがその判定に与えるものを加えます。失敗すると無駄にアイテムを使い切り、結果の行にもそう示されます(「Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.」)。

起きたことは「Juno uses Poultice: heals 4 (Grit 6/11). 1 left.」のように1行で示されます。Useボタンはこれを「I use my Poultice.」の後の`[item_used]`ブロックでGMに送り、チャットではバッジとして表示されます。GM自身のタグにはこの行で応答し、ほかのタグと同じくターン開始時点から計るため、再生成した返信がアイテムを2回使うことはありません。`use`のないアイテムや、ルールセットのないゲームでは、従来どおり単に「I use my rope.」と書かれます。
