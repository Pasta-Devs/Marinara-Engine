# ルールセットの判定

このページは[Game Modeのルールセットを作成する](writing-rulesets.md)の一部です。ルールセットで判定やセーヴのダイスを振る方法を説明します。五つの判定方式、結果帯、独自の方法で振る判定、ロールを変える消費やチャームを扱います。

<a id="resolution-kinds"></a>

## 判定方式

`resolution.kind`は判定の振り方を選びます。どの方式も同じキャラクターシートを読み、3つのキーを共有するので、切り替えても`resolution`より後のファイル構成は変わりません。

- `abilityModifier`: シートの能力値を数値へ変える方法です。`identity`はそのまま使い、`floorHalfMinusTen`は5eの規則、`stepTable`は`[[score, number], ...]`で独自のしきい値を列挙します。
- `proficiencyTiers`: スキルやセーヴの習熟段階です。未掲載のスキルは先頭の段階になります。`flat`、習熟ボーナスの`multiplier`倍、または両方を加えます。習熟ボーナスがあるシステムでは、`"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`で出所を指定します。
- `proficiency`: 任意で、乗算する段階があるときだけ必要です。

得られた数値の意味は方式が決めます。`dice-sum`はロールへ加算し、`dice-pool`と`dice-highest`はその個数のダイスを振ります。`symbol-pool`は能力値と習熟を分けたまま使い、ナラティブダイスを組み立てて格上げします。

### `dice-sum`: ダイスを合計する

```json
"resolution": {
  "kind": "dice-sum",
  "dice": { "count": 2, "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained" },
    { "id": "trained", "label": "Trained", "flat": 1 }
  ],
  "advantage": false,
  "difficultyLadder": [
    { "label": "Easy", "dc": 6 },
    { "label": "Hard", "dc": 10 }
  ]
}
```

- `dice`: 個数と面数です。合計を難易度と比較します。
- `advantage`: Game Masterが2回振って片方を採用するよう要求できるかです。
- `naturals`: 単一ダイスの最大・最小出目が判定とセーヴに及ぼす効果です。`none`、`both`、`max-only`、`min-only`から選びます。単なる計算だけなら省略します。ダイス1個が条件なので、2d6方式では`none`が必要です。
- `dice.faces`: 各面の値が出目そのものでない場合に、各面の値を最小の面から順に示します(Capability API 1.136)。Fateの4個のファッジダイスは`{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`です。カードには−、空白、+が表示されて合計され、確率はFateとまったく同じです。面ごとに1つの値を指定してください。
- `openEnded`: 振り足しが続く単一のダイスです(1.136)。`high`以上の面が出たらもう一度振って加え、新しいダイスが`high`以上を示す間は繰り返します。`low`以下の面が出たらもう一度振って差し引き、その振り直しも同じく`high`で連鎖します。Rolemasterのオープンエンドのパーセンタイルロールは、1個のd100で`{ "high": 96, "low": 5 }`です。1回のロールで振るダイスは最大20個です。ナチュラルの出目と、それによる結果帯の移動は、最初のダイスで読みます。
- `unmodified`: 最初のダイスがその面を示したときに記録が印を付ける、単一ダイスの面です(1.136)。これにより、「修正なしの66」を別扱いする表を適用できます。例は`[66, 100]`です。記録には`unmodified="66"`と記され、カードにも表示され、GMにはそれについて規則が定めることを適用するよう伝えます。
- `difficultyLadder`: Game Masterへ提示する難易度の候補です。`dc`は合計が到達すべき数値です。GMは数値を書く代わりに`difficulty="Hard"`のように段階名を指定でき、Engineはその段階から数値を読み取ります。

### `dice-pool`: ダイスを振って成功を数える

シートの数値は追加ボーナスではなく**プールの大きさ**です。評価値3と専門技能2なら5個振ります。仕組みはそれだけです。新しいシート用語もエディターもなく、評価値がダイスの個数を表すシステムも、ほかと同じ`abilities`、`skills`、`proficiencyTiers`で書けます。

```json
"resolution": {
  "kind": "dice-pool",
  "die": { "sides": 10 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "rating_0", "label": "Untried" },
    { "id": "rating_1", "label": "Shown once", "flat": 1 }
  ],
  "pool": { "min": 1, "max": 15, "abilityPlusAbility": true },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10, "min": 8 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "reroll": [{ "id": "careful", "upTo": 6, "mode": "once" }],
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: プールのダイス1個の面数で、2～100です。
- `pool`: 爆発が起きる前にシート値を収める範囲です。`min`が0なら空のプールは一度も振らずに失敗し、`max`は最大100です。`abilityPlusAbility: true`にすると、能力値判定で`with=`により2つ目の能力値を指定し、両方を振れます。2つの能力値を合わせて振るシステム向けです。これがなければ、能力値判定での`with=`は何も意味しません。
- `target`: 成功と数えるために必要な出目です。`min`を`max`より小さくすると、GMが判定ごとに`threshold=`で動かせます。3つを同じ値にすると固定です。
- `double`: 任意です。`from`以上の出目を2成功と数えます。
- `explode`: 任意です。`from`以上ならダイスを1個追加し、そのダイスも爆発できます。追加分は元のプールに加えて最大`pool.max`個なので、1判定の総数は最大`pool.max`の2倍です。`from`が小さくても無限に振りません。
- どちらも`min`を持てます。タグの`explode="N"`や`double="N"`、またはキャラクターが使った項目によって、判定がその規則を引き下げられる最小の出目です。`min`があれば`from`を省略でき、その場合は要求した判定でだけ規則が発動します。1つのスキルで10の目を振り足す専門技能なら`"explode": { "min": 10 }`です。`from`は`min`未満にできません。
- `cancel`: 任意です。`upTo`以下の出目は成功を1つ減らします。成功数は0未満になりません。
- `botch`: 任意です。成功したダイスが**1つもなく**、`upTo`以下が出た場合はクリティカル失敗です。1成功が相殺されたプールは通常の失敗で、クリティカル失敗ではありません。`"rule": "halfOrMore"`は別の読み方をします。最初に振ったダイス(爆発分は数えません)の半数以上が`upTo`以下なら、成功したダイスがない場合はクリティカル失敗です。それ以外の場合は結果をそのまま残し、`complication="true"`の印を付けます。結果に伴って何かがうまくいかなかったことを表します。デフォルトは`"noSuccesses"`です。
- `exceptional`: 任意です。成功した判定の正味成功数がこの値以上ならクリティカル成功です。
- `situationalDice`: 任意です。離れ業、負傷、暗さなどについて、GMが`bonus=`で1判定のダイスを増減できる範囲です。
- `reroll`: 任意です。誰も支払わずにシステムが認める振り直しで、最大6個です。それぞれ`id`を持ち、GMは判定で`reroll=`によって指定します。`upTo`以下の目を振り直します。`"once"`なら新しい目が何であれ確定し、`"until"`ならそれより大きい目が出るまで振ります。すべての目を振り直すと終わらないため、`upTo`は1から、ダイスの面数より1小さい値までです。`until`も1判定で100回振り直すと止まります。判定で指定しない限り何も振り直しません。1判定で行う振り直しは1つです。消費やキャラクターが使った項目でも振り直しを購入した場合は、より多くの目に届く方を振り、届く範囲が同じなら`once`より`until`を優先します。
- `difficultyLadder`: `successes`は必要成功数です。段階ごとに`target`も指定できますが、目標が調整可能で、その範囲内の場合だけです。その目標値は、その段階での判定が数える基準です。GMが`difficulty=`で段階を指定した場合か、ちょうど1つの段階が必要とする`dc=`を書いた場合です。複数の段階が同じ成功数を必要とする場合、`dc=`だけではどれを意図したか分からないため、目標値はデフォルトのままです。段階名を指定してください。

- `target.from`: 任意です。各キャラクターの目標値をシートから読みます。Lasers & FeelingsのNumberのように、キャラクターが一度だけ選ぶ値です(能力値、フィールド、派生値など、どの値参照でも指定できます)。`min`..`max`の範囲に収められ、数値はキャラクター自身のものなので`threshold=`では動きません。ただし、キャラクターが使った項目で購入した目標値の変更は引き続き効きます。記録の`threshold=`は実際に使った値を示します。
- `stances`: 任意です。最大6個で、それぞれ`id`、`label`、`count`(`"below"`または`"above"`)、対象とする`skills`を持ちます。そのスキルの判定では、目標値以上ではなく、目標値**未満**、または目標値を**超える**ダイスを数えます。Lasers & Feelingsは、未満を数えるLasersの構えと、超えるものを数えるFeelingsの構えで、各スキルはどちらか一方に属します。1つのスキルが属せる構えは1つだけです。`explode`、`double`、`cancel`、`botch`は「目標値以上」を前提に読むため、構えの判定では使われません。
- `exact`: 任意です。ちょうど目標値を示すダイスです。`label`で名前を付け(`"LASER FEELINGS"`)、`text`で卓上での効果を説明でき、`counts`が`false`でない限り1成功と数えます。記録には該当するダイスの数を示す`exact="N"`が入り、ダイスカードは結果の横にそれを表示するため、GMはそれで得られる洞察をプレイヤーに与えられます。

`cancel`と`botch`の出目は最低目標より低くなければならず、すべての規則の出目はそのダイスに実在する必要があります。絶対に発動しない規則はプレイ中に発覚させず、インポート時に拒否します。

パッケージ形式のプールルールセットはCapability API 1.24です。`explode`や`double`の`min`、`pool.abilityPlusAbility`、`botch.rule`は1.37、`reroll`は1.38、`target.from`、`stances`、`exact`は1.137です。コミュニティのインポートは読み取るEngine自身が検証するため、別の指定は不要です。

### プール判定でGame Masterが書けるもの

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc`は目標値ではなく、必要な**成功数**です。1から、1ロールで数えられる最大数まで指定できます。プールの最大数を基準に、爆発可能なら2倍、出目を2成功と数えるならさらに2倍です。
- `threshold=`は各ダイスの目標を動かし、`target.min`が`target.max`未満の場合だけ提供されます。
- `bonus=`はダイスを増減し、`situationalDice`を宣言した場合だけ提供されます。
- `with=`は本来とは別の能力値でスキルやセーヴを振ります。両方式に対応するため、5eでも同じ属性で"Strength (Intimidation)"を実現できます。`pool.abilityPlusAbility`がオンなら、能力値判定では代わりに2つ目の能力値を加えます。
- `difficulty=`は`dc=`の代わりに難易度表の段階を指定し、両方式で使えます。その段階の成功数(合計方式なら難易度)と、プール方式なら目標値を使います。並べて書いた`dc=`は引き続き数値で優先し、`threshold=`は目標値で優先します。どの段階にも該当しない名前や、2つの段階が共有する名前は無視します。
- `explode=`と`double=`はこの判定でそれらの規則の目を動かし、規則が`min`を持つ場合だけ提供されます。
- `reroll=`はこの判定で`reroll`項目の1つを指定し、何か宣言した場合だけ提供されます。どれにも該当しない名前は無視します。

すべてファイルの宣言範囲に制限されます。範囲外の値は最寄りの端へ丸め、ルールセットにない能力値は判定自体を拒否せず無視します。保存記録には実際に使った値が表示されます。難易度と目標値は数値で、追加ダイスは制限後の値で記録します。`with=`は実際に能力値を入れ替えたか加えた場合だけ、目は判定が動かした場合だけ、`reroll=`は指定した振り直しが実際に使われて何かを振り直した場合だけ記録し、`complication="true"`は`halfOrMore`の大失敗で結果に伴う問題が生じた場合に記録します。Engineは必ず自分でダイスを振ります。モデルが書いたプール結果は置き換え、この方式に有利はないため`mode="advantage"`を無視し、プレイヤーがターン前に振ったダイスも使いません。

### `dice-highest`: ダイスを振って最大の出目を読む

Blades in the DarkとTrophy Darkは、数個のd6を振って最大の1個だけを読みます。Capability API 1.138です。

```json
"resolution": {
  "kind": "dice-highest",
  "die": { "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "rating_0", "label": "0" }, { "id": "rating_1", "label": "1", "flat": 1 }],
  "pool": { "min": 0, "max": 6 },
  "zeroDice": "lowest-of-two",
  "critical": { "count": 2 },
  "situationalDice": { "min": -1, "max": 2 },
  "difficultyLadder": [{ "label": "Partial", "dc": 4 }, { "label": "Full", "dc": 6 }],
  "outcomes": {
    "by": "total",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "full", "label": "Full success", "atLeast": 6, "success": true },
      { "id": "partial", "label": "Partial success", "atLeast": 4, "success": true, "text": "You do it, with a consequence." },
      { "id": "bad", "label": "Bad outcome" }
    ]
  }
}
```

- シートの数値は、プールと同じくダイスの個数で、`pool`の範囲(最大20)に収めます。負傷、`adjust`、状態、アイテムがダイスを増減します。
- `keep`: 任意で、1～3、デフォルトは1です。上位いくつのダイスを合計するかを示します。1がBlades、2がTrophy Darkの戦闘です。
- `zeroDice`: ダイスを持たないキャラクターの扱いです。`"lowest-of-two"`(デフォルト)は2個振って低い方を採用し、クリティカルには決してなりません。`"fail"`はロールせずに失敗します。
- `critical`: 任意です。最大の面(または`face`以上)を示すダイスが`count`個あればクリティカル成功です。Bladesの2個の6がこれにあたります。
- `dark`: 任意で、Trophy Darkのダークダイスです。`label`、`max`(1～10)、`text`を持ちます。GMは`dark="N"`で1つの判定に加えます。`outcome`はデフォルトで`"all"`で、ほかのダイスと一緒に読みます。`"outcome": "light"`(Capability API **1.149**)では、採用するダイス、合計、結果帯、クリティカルを決めるのはライトダイスだけです。ライトダイスがなければ、ライト側に`zeroDice`を適用します。ライトダイスを2個振って低い方を採用するか、ダークダイスは振ったうえで失敗します。ダークダイスは常に振られ、最後に記録されます。`darkHighest="true"`は、ダークダイスがすべてのライトダイスを厳密に上回ったことを示します(代替のライトダイスも含みます。ライトダイスを1個も振らなかった場合は、どのダークダイスでも上回ります)。その代償(Ruin)を適用するのはGMです。`dark.outcome`を宣言するには、`"all"`であってもcapabilityApi 1.149が必要です。
- `situationalDice`: 任意で、GMが`bonus=`で増減できるダイスです(援護、無理押しなど)。
- `spend`で購入できるのはダイスだけです。
- `difficultyLadder`: `dc`を持つ段階で、その数値は採用したダイスが到達すべきものです。判定の`dc=`はその数値で、1から、ダイスの面数の`keep`倍までです。
- `outcomes`は採用したダイスから`by: "total"`で読み、`on: "critical-success"`の結果帯がクリティカルを受け止めます。

記録は合計方式の形を保ち(`resolution="sum"`、`modifier="0"`、採用したダイスが合計です)、`highest="1"`を加えます。該当する場合は`zeroDice="true"`と`dark="N"`も加え、ダークダイスは`rolls`の最後に並びます。ライトのみの結果では`darkOutcome="light"`も記録するため、再読み込みの後もカードは採用したライトダイスだけを強調します。この方式のルールセットには独自の戦闘がないため、併せて`combat`を指定すると拒否されます。

### `roll-against`: シートの数値以下(または以上)を振る

Call of Cthulhu、GURPS、オールドスクールの盗賊の技能率は、ダイスに加算する代わりにシート上の数値に対して振ります。Capability API 1.139です。

```json
"resolution": {
  "kind": "roll-against",
  "dice": { "count": 1, "sides": 100 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "base", "label": "Base" }],
  "against": "at-most",
  "criticalSuccess": [{ "from": 1, "to": 1 }],
  "criticalFailure": [{ "from": 100, "to": 100 }, { "from": 96, "whenTarget": { "below": 50 } }],
  "tens": { "max": 2 },
  "difficultyLadder": [
    { "label": "Regular", "dc": 0 },
    { "label": "Hard", "dc": 0, "divide": 2 },
    { "label": "Extreme", "dc": 0, "divide": 5 }
  ],
  "outcomes": {
    "by": "fraction",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "extreme", "label": "Extreme success", "atLeast": 5, "success": true },
      { "id": "hard", "label": "Hard success", "atLeast": 2, "success": true },
      { "id": "regular", "label": "Regular success", "atLeast": 1, "success": true },
      { "id": "fail", "label": "Failure" },
      { "id": "fumble", "label": "Fumble", "on": "critical-failure" }
    ]
  }
}
```

- 判定でのシートの数値が目標値です。スキルのパーセンテージはシートのスキルごとのボーナスで(`bonusRange`は100まで)、能力値も段階のボーナスも加えません。GURPSのスキルは、その能力値にそのボーナスを加えた値です。
- `dice`: 振って合計するダイスで、デフォルトは1d100です(GURPSは3d6、セーヴィングスローは1d20)。
- `against`: `"at-most"`(デフォルト)は目標値以下で成功し、`"at-least"`は目標値以上で成功します。
- `difficultyLadder`: 各段階の`dc`は目標値を動かし、`divide`(2～10)は先にシートの数値を割ります。GMは`difficulty=`で段階を指定します。タグの`dc=`は数値を-100～100の範囲で動かします。記録の`dc`はロールを比べた数値で、記録には`against="at-most"`と記されます。
- `criticalSuccess`と`criticalFailure`: それぞれ最大6個の規則です。規則は面(`from`、`to`で、どちらも省略できます)を指定するか、失敗については`pastTarget`、つまり失敗側にその分以上離れたロールを指定します。`whenTarget`(`atLeast`、`below`)は規則を一部の目標値に限ります。GURPSの5は、目標値が15以上のときだけクリティカル成功です。クリティカル成功は常に成功し、クリティカル失敗は常に失敗します。
- `tens`: 任意で、単一のd100でのみ使えます。`bonus="+N"`は10の位のダイスをN個多く振って最良のロールを採用し、`bonus="-N"`は最悪のロールを採用します。追加できるのは最大`max`個です。
- `outcomes`は`at-most`のロールで`by: "fraction"`を読めます。各結果帯の`atLeast`は目標値を割る数で、その割合以下のロールがその結果帯に入ります。`margin`(目標値をどれだけ下回ったか)と`total`の尺度も使えます。

### `symbol-pool`: ナラティブダイスを振ってシンボルを読む

Genesysは特徴値とスキルランクからプールを組み、対立するダイスを加えます。面には数値の代わりに成功、アドバンテージ、トライアンフ、失敗、脅威、絶望が描かれています。Capability API 1.141です。

```json
"resolution": {
  "kind": "symbol-pool",
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained", "flat": 0 },
    { "id": "rank_one", "label": "Rank 1", "flat": 1 }
  ],
  "symbols": [
    { "id": "s", "label": "Success" },
    { "id": "f", "label": "Failure", "cancels": "s" },
    { "id": "a", "label": "Advantage" },
    { "id": "h", "label": "Threat", "cancels": "a" },
    { "id": "t", "label": "Triumph", "counts": "s" },
    { "id": "d", "label": "Despair", "counts": "f" }
  ],
  "dice": [
    { "id": "ability", "label": "Ability", "faces": [[], ["s"], ["s"], ["s", "s"], ["a"], ["a"], ["s", "a"], ["a", "a"]] },
    { "id": "proficiency", "label": "Proficiency", "faces": [[], ["s"], ["s"], ["s", "s"], ["s", "s"], ["a"], ["s", "a"], ["s", "a"], ["s", "a"], ["a", "a"], ["a", "a"], ["t"]] },
    { "id": "difficulty", "label": "Difficulty", "faces": [[], ["f"], ["f", "f"], ["h"], ["h"], ["h"], ["h", "h"], ["f", "h"]] },
    { "id": "challenge", "label": "Challenge", "faces": [[], ["f"], ["f"], ["f", "f"], ["f", "f"], ["h"], ["h"], ["f", "h"], ["f", "h"], ["h", "h"], ["h", "h"], ["d"]] },
    { "id": "boost", "label": "Boost", "faces": [[], [], ["s"], ["s", "a"], ["a", "a"], ["a"]] },
    { "id": "setback", "label": "Setback", "faces": [[], [], ["f"], ["f"], ["h"], ["h"]] }
  ],
  "success": { "symbol": "s", "needed": 1 },
  "pool": { "die": "ability", "upgrade": "proficiency", "max": 6 },
  "difficulty": { "die": "difficulty", "upgrade": "challenge", "max": 5 },
  "boost": { "die": "boost", "max": 3 },
  "setback": { "die": "setback", "max": 3 },
  "criticalSuccess": "t",
  "criticalFailure": "d",
  "difficultyLadder": [{ "label": "Easy", "dc": 1 }, { "label": "Average", "dc": 2 }, { "label": "Hard", "dc": 3 }]
}
```

- `symbols`: 2～10個の名前付きシンボルです。`counts`は相殺の前に別のシンボルを一つ加えます。トライアンフは成功を一つ加え、トライアンフとしても残ります。これが指定するのは、自身の`counts`を持たないシンボルです。連鎖や自己参照は拒否されます。`cancels`は二つのシンボルを一対一で相殺する組にし、各シンボルの相手は最大一つです。逆方向の宣言は任意です。`text`はシンボルをGame Masterに説明します。
- `dice`: 2～8個の名前付きダイスで、面の数は各ダイスとも、2～20です。面は最大三つのシンボルIDの配列です。`[]`は空白で、同じIDを繰り返すと二つと数えます。参照はすべて実在する必要があります。
- `pool`: `larger-upgraded`(デフォルト)は能力値とランクの大きい方の個数を振り、`upgrade`を宣言していれば小さい方の数だけ格上げします。`sum`は両者を合計し、何も格上げしません。`max`は、6がデフォルトで、12を超えられません。能力値には`abilityModifier`を使うため、Genesysの特徴値には`identity`を使ってください。ランクはスキルやセーヴの習熟段階から得ます。素の能力値判定のランクはゼロです。`with=`はほかの判定と同じく特徴値を入れ替えます。シートのボーナス、負傷、調整、効果は、後述の符号付きボーナスを通じてブーストダイスやセットバックダイスを加えます。
- `difficulty`: `dc=`は対立するダイスの個数で、0から`max`(デフォルト: 5、上限: 12)までです。`difficulty=`は代わりに難易度表の段階を指定します。`upgrade="N"`はその個数の対立ダイスを格上げダイスに置き換え、実際に振る個数までに制限されます。難易度を超えてダイスを加えることはありません。
- `boost`と`setback`: 任意で、それぞれ`bonus="+N"`と`bonus="-N"`で加えるダイスです。上限は各`max`(デフォルト: 3、上限: 6)です。符号付きの調整は、この上限を適用する前に合算します。Capability API **1.150**では`setback="N"`も独立して受け付けます。`bonus="2" setback="1"`は両方のダイスを振ります。負のボーナスは`setback`に加算され、合計したセットバックの個数は`setback.max`の範囲に収まります。ブーストダイスは引き続き`boost.max`の範囲です。
- `allowOwnUpgrade`: 任意で、指定しなければfalseです。`true`にすると、`upgradeOwn="N"`は、シートによる格上げと購入したダイスの後で、キャラクターのダイスをさらにN個`pool.upgrade`(宣言が必要です)に格上げします。既存のダイスがすべて格上げ済みなら、追加の格上げごとに格上げしたダイスを一個加え、これも`pool.max`の範囲です。`pool.build: "sum"`でも機能します。このキーを宣言するには、`false`であってもcapabilityApi **1.150**が必要です。属性名は`zeroDice`と同じくキャメルケースです。`upgradeOwn`は振る側に影響し、`upgrade`は引き続き難易度ダイスだけに影響します。`setback`と`upgradeOwn`はどちらも非負の整数を取り、シンボルプール以外では無視されます。`upgradeOwn`は有効にしない限り無視されます。
- `success`: 相殺後に、そのシンボルがこの個数だけ必要です。デフォルトは一つです。クリティカル成功とクリティカル失敗は、指定したシンボルが一つでも出れば、それが加えた成功や失敗が相殺されても印を付けます。両方の印が同時に付くこともあり、どちらも正味の成功数が判定に通ったかどうかは変えません。
- `outcomes`は正味の成功数(`total`)か、`net successes - needed + 1`(`margin`)を読めます。結果帯は通常どおり成功を決め、元のクリティカルのシンボルは印が付いたまま残ります。`spend`で購入できるのは、`pool.max`の範囲内で追加するキャラクターの基本ダイスだけです。戦闘は`symbol-pool`方式です(Capability API 1.382。[シンボルダイスで振る戦闘](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool)を参照)。これ以外の戦闘方式を併記すると拒否されます。
- 判定以外でも、このルールセットを使うゲームではダイスを名前で指定して振れます。メッセージ入力バーの独自のダイスロールの欄とGame Masterの`roll_dice`ツールは、`2 ability 1 proficiency vs 2 difficulty`を読み取ります(各ダイスの`id`または`label`で、大文字と小文字は区別しません)。判定と同じようにシンボルを数えて相殺しますが、シート、格上げ、難易度表は使いません。有効にするキーは不要です。
- 記録は`resolution="sum"`を保ち、`symbols="2s 1a 1t"`、各ダイスを識別する`thrown=`、1から数えた面の番号を持つ`rolls=`を加えます。エンコードした`symbolDetails`は、ラベル、面のシンボル、両方のクリティカルの印を保持します。`setback`は共通のセットバック上限を適用した後に実際に加えた独立のセットバックダイスを、`upgradeOwn`は実際に適用した追加の格上げを記録します。無視された追加やゼロの追加は省きます。カードと要約は、面の数値を合計するのではなく、正味のシンボルを示します(空の結果も含みます)。オーバーライドでこの方式の規則を変えられますが、`symbols`や`dice`は置き換えられません。

### 対象外の仕組みとその理由

次の仕組みには、今も独自の判定方式が必要です。

- **対抗プール**は2人を同時に解決しますが、判定のロール者は1人です。
- **ワイルドダイスを含む合計プール**(OpenD6など)はダイスを加算し、1個を特別扱いします。

この方式が以前扱えなかった残り2つは、現在実装されています。下の「消費でロールを変える」で説明します。「1ポイントで1成功を得る」や「1ポイントで失敗したダイスを振り直す」といったシステム自体の規則は`resolution.spend`です。状況に応じてシステムが無料で認める振り直しは、上記の`resolution.reroll`です。キャラクターが取得したものに属する振り直しはカタログ項目の`mechanics.check`で、その項目自身のコストを支払います。

## 結果帯: 成功か失敗か以上のもの

多くのシステムは、判定を単なる成否ではなく、いくつかの結果の1つとして読みます。Pathfinderの4段階の成功度、代償を伴って成功する「ぎりぎり」、Call of Cthulhuのハード成功とイクストリーム成功、Fateの「スタイリッシュな成功」などです。`resolution.outcomes`はそれらの結果帯に名前を付け、Engineは判定ごとにどの結果帯に入ったかを示します(Capability API 1.135)。どの判定方式でも使えます。

```json
"outcomes": {
  "by": "margin",
  "naturals": "shift",
  "tiers": [
    { "id": "critical_success", "label": "Critical success", "atLeast": 10, "success": true, "critical": true },
    { "id": "success", "label": "Success", "atLeast": 0, "success": true },
    { "id": "failure", "label": "Failure", "atLeast": -9 },
    { "id": "critical_failure", "label": "Critical failure", "critical": true }
  ]
}
```

- `by`: 結果帯を何から読むかです。`"margin"`(デフォルト)は、結果が判定に必要な値をどれだけ超えたかです。合計方式なら合計から難易度を引いた値、プールなら正味の成功数から必要成功数を引いた値です。`"total"`は結果そのもので、難易度にかかわらず、合計方式なら合計、プールなら正味の成功数です。
- `tiers`: 2～8個の結果帯を、**良い順に**並べます。`atLeast`はその結果帯に入る最小の数値で、各結果帯の値は前の結果帯より小さくします。最後の結果帯はそれより下をすべて受け止めるため、この値を持ちません。`success`は結果帯が成功かどうかを示し、`critical`はその種類のクリティカルとして印を付けます(`success`がtrueならクリティカル成功、そうでなければクリティカル失敗です)。少なくとも1つの結果帯が成功し、少なくとも1つが失敗する必要があります。`text`は任意の1行で、最大200文字です。その結果帯が卓上で何を意味するかをGMに伝えます(「You do it, but the Game Master adds a complication」など)。
- `on`: `"critical-success"`または`"critical-failure"`を指定すると、数値にかかわらずクリティカルが入る結果帯になり、ほかには何も入りません。`atLeast`は持たず、クリティカル成功の結果帯は成功、クリティカル失敗の結果帯は失敗で、それぞれ最大1つです。Blades in the Darkの「6が2個」は、6が1個の結果帯より上にある、クリティカル成功の結果帯です。数値から読むそれ以外の結果帯は、互いの間で上記の規則に従います。
- `naturals: "shift"`: 単一ダイスの最大の面は結果を1段階良い結果帯へ、最小の面は1段階悪い結果帯へ動かします。両端を越えることはありません。ダイスは1個である必要があり、`resolution.naturals`の代わりになるため、併用時はそちらを`none`にしてください。

結果を決めるのは結果帯です。成功と2種類のクリティカルは結果帯から決まり、単純な比較からは決まりません。合計方式のルールセットの`naturals`がある面を自動成功や自動失敗にする場合、その面はそのクリティカルの結果帯に入り、なければ最良または最悪の結果帯に入って、クリティカルのままです。プールのクリティカル失敗も下端で同じように働きます。結果帯を持つプールは`exceptional`を使いません。クリティカル成功が何かは結果帯がすでに示しているためです。

難易度が固定のシステムは、`by: "total"`で読むプールで結果を表せます。Lasers & Feelingsの「1成功: かろうじて成功、2: うまくいく、3: クリティカル成功」は、3、2、1成功の3つの結果帯と、その下の失敗です。

記録は`outcome="Critical success"`で結果帯を示し、ダイスカードは単なる成否の語の代わりにそれを表示します。GMは結果帯とその`text`を教わり、結果帯に沿って描写するよう指示されます。結果帯を宣言するパッケージ形式のルールセットにはCapability API 1.135が必要です。

## 独自の方法で振る判定

ほとんどの判定はある方法で、いくつかは別の方法で振るゲームがあります。オールドスクールのゲームでは能力値以下をd20で振りますが、盗賊の技能はd100、Open Doorsはd6で振ります。`resolution.overrides`はそれらの判定と、代わりに使う判定のキーを指定します。Capability API 1.140です。

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- 各オーバーライドは`skills`、`saves`、`abilities`(3つのうち1つ以上)、`label`、GM向けの任意の`text`を指定します。
- `set`はルールセット自身の方式の判定キーを持ち、それらの判定ではルールセットのキーを置き換えます。`null`はキーを取り除きます。exwodで、得意とする能力値では1が成功を相殺しない規則は`"cancel": null`です。方式、シートの計算(`abilityModifier`、`proficiency`、`proficiencyTiers`、`penaltyFrom`、`spend`、`adjust`)、`difficultyLadder`は変えられません。シンボルプールは`symbols`と`dice`も固定します。オーバーライドが作る判定方式はルールセット自身のものと同じく検査されるため、指定する面はそのダイスに実在する必要があります。
- `when`: 任意です。振る者のシート上の値で、0でない場合だけオーバーライドを適用します。得意な能力値を示す0か1の数値フィールドなどです。なければ常に適用します。
- 判定を指定し、`when`が成り立つ最初のオーバーライドを使います。1つの判定を含められる、`when`のないオーバーライドは最大1つです。

## 消費でロールを変える

意志を1ポイント使って自動成功を得るなど、これから振るロールに支払えるシステムがあります。`resolution.spend`はキャラクターが購入した特性ではなく、システムの常設規則としてこれを宣言します。

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool`は`live.pools`の1つです。開始時に空のプールは、プレイ開始時に消費できないため使えません。
- `amount`は1回の購入コストです。得られるものは`successes`、`dice`、`reroll`で、少なくともどれか1つを購入する必要があります。購入した成功は振って得たものではないため、ダイスの集計と相殺のあとに加えます。ダイスはプール自身の範囲内で、プールと一緒に振ります。`reroll`は`{ "upTo": 6, "mode": "once" }`の形で、`resolution.reroll`と同じように読みます。判定で何回購入しても、振り直しを購入するのは1回です。同じダイスを2回振り直しても、振り直しは1つです。
- `perCheck`は1判定の購入回数です。最大で`amount * perCheck`ポイント相当を買えます。この上限により、満タンのプールで必ず成功するロールを買うことを防ぎます。1から10の数値、派生値が読むのと同じ形式のシート上の値(`{ "abilityScore": "nerve" }`、`{ "derived": "focus" }`)、または`"pool"`(判定のダイス数と同じ回数。負傷、追加ダイス、修正値を適用する前の、その判定のシート上の数値です)を指定できます。シート上の値は振る人について読み、切り捨てて0から100に収めます。上限が0になったキャラクターは何も買わず、何も支払いません。
- `dice-pool`ルールセットは成功、ダイス、振り直しを購入できます。`dice-highest`と`symbol-pool`はダイスだけを購入します。ほかの方式は`spend`を宣言できません。
- 項目は最大4つで、2つの項目が同じプールを指定することはできません。判定からどちらを指すのか区別できないためです。
- `reroll`を購入する消費、数値でない`perCheck`、3つ以上の項目は、パッケージ形式のルールセットではCapability API 1.38です。

**判定自体に指定します。** GMは別の`[sheet:]`コマンドではなく、`[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`と書きます。シートコマンドの適用前にダイスを振るため、別コマンドでは変更に間に合いません。1つの解決処理で、ロールとそれを変える支払いを行います。

## ロールを変えるチャーム

`resolution.spend`はシステムの規則です。キャラクターが実際に取得した項目も、カタログ項目の`mechanics.check`で判定を変えられます。

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll`は`upTo`以下を振り直します。`once`は各ダイスを1回だけ置き換えて新しい目を確定し、`until`は振り直しを続けます。プール全体を永久に振り続けないよう、`upTo`は最大出目未満の実在する目が必要です。ファイルの内容にかかわらず、Engineは1判定の振り直し数を制限します。
- `dice`はプールを振る前にダイスを加え、`successes`は集計後に成功を加え、`threshold`は`target`の許可範囲内でその1ロールの目標を設定します。
- `explode`と`double`はその1ロールでそれらの規則の目を動かします。規則が`min`を持つ場合だけ、その範囲内で使えます。`"check": { "explode": 8 }`は8の目を振り足す項目です。`threshold`と同じく、GMがタグに書いた値より優先します。Capability API 1.37です。
- これらのうち最低1つが必要です。なければ効果を宣言していないため拒否されます。
- 対応できるのは`dice-pool`だけです。`mechanics.check`を持つ`dice-sum`はインポート時に拒否されます。

**支払うのは項目自身の`cost`です。** ほかの項目の使用と同じ仕組みで、プールと、その項目が書いた全カウンターの使用回数1回分を支払います。`perCostStep`は効果が拡大することを指定します。宣言した項目は支払った価格の回数分購入し、宣言しない項目は提示額にかかわらず1回だけ購入します。

**GMは判定で項目名を指定します。** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`です。上と同じく、帳簿処理より先にダイスを振るため、別のシートコマンドにはしません。

**すべて支払うか、何も行わないかです。** プールが不足すれば購入は起こらず何も引かず、元どおりのロールになります。購入回数の整数倍でないポイントでも何も買えません。`perCheck`を超える要求は拒否せず上限へ制限し、その分だけ支払います。すべてEngineが計算し、GMはプレイヤーが宣言した消費を指定するだけでダイスを操作しません。記録には実際の支払額、適用項目、振らずに得た成功数、振り直したダイス数が残ります。未取得のチャームや、Engineがカタログを読めないチャームは、信用して適用せず何もしません。
