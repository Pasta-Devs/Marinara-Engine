# ルールセットのエントリーの仕組み

このページは[Game Modeのルールセットを作成する](writing-rulesets.md)の一部です。カタログのエントリーが数値の面で何をするかを説明します。判定、休息、戦闘が読み取る、エントリーの`mechanics`ブロックを扱います。

任意の`mechanics`ブロックで効果を数値化できます。`kind`(`attack`、`heal`、`buff`、`debuff`、`utility`、`rider`)、`range`、`area`、`targets`、`targetCount`、`friendlyFire`、`amount`(`2d6`などのダイスか固定値)、`amountAdd`(使用者のシートから読んで量に加える値です。たとえば`{ "field": "level_fighter" }`なら、1d10にファイターのレベルを加えるSecond Windになります。`amount`が必要で、ルールセット独自の戦闘でだけ読まれ(EngineのClassicとTacticalの戦闘は書かれた量をそのまま使います)、Capability API 1.83です)、`damageType`、`attackRoll`、`autoHit`、`save`(シートのセーヴと成功時の効果)、`applies`(対象への状態付与)、`temporary`(体力プールの一時ポイント)、`scales`(シートに応じて増える量)、`cost`(消費プール)、`perCostStep`、`targetsPerCostStep`、`budget`(消費する行動枠)、`concentration`、`reaction`、`plus`、`free`、`gives`、`standard`、`rider`、`check`があります。

敵を対象とする攻撃は、`summons`(Capability API 1.122)で、後のターンに攻撃するものを残せます。Spiritual Weaponなら、その攻撃の項目に`"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }`を加えます。発動時に最初の攻撃を行い、リアクションが終わると最初の標的の隣に武器を残します。発動を取り消した場合は何も残りません。後の攻撃は宣言した行動枠だけを消費し、ダメージのスケーリングには発動時の支払い段階を保ち、同じリアクションのウィンドウを開きます。距離はカタログの単位を使います。移動を省略すると0、リーチを省略すると1マスです。盤面では、武器は移動量とリーチの範囲内の敵を壁を無視して攻撃でき、その隣へ移動します。盤面がなければ、立っているどの敵にも届きます。ラウンドは持ち主のターンの終わりに減り、発動したターンは数えません。召喚物は0になるか、持ち主が倒されるか、項目の集中が終わると消えます。同じ項目を再び発動すると、その召喚物を置き換えます。

`area`を持つ項目は、`zone`(Capability API 1.172)で場に残せます。形は`{ "rounds", "anchor", "triggers", "atCast" }`です。術者のターンで`rounds`(1～1000)の間、召喚物と同じ数え方で存在し、それを保つ集中が終わるか術者が倒されると早く終わります。`anchor: "point"`(デフォルト)は発動したマスに留まります。`anchor: "caster"`は術者の周囲のバーストで、術者とともに移動するため、射程は0です。`triggers`は、項目自身の効果(amount、plus、save、applies)を1体のクリーチャーに再び与えるタイミングを指定します。`enter`(クリーチャーが中に入るか、術者が運ぶゾーンがクリーチャーに届く)、`turn-start`または`turn-end`(中でターンを開始または終了する)です。トリガーにかかわらず、クリーチャーが巻き込まれるのは1ターンに1回で、発動自体が巻き込んだ者はそのターンに巻き込まれたものと数えます。誰を巻き込むかは項目に従います。`friendlyFire: false`は術者の側を除き、回復や味方向けの項目は術者の側だけを対象にします。術者が運ぶゾーンが術者を巻き込むことはありません。`atCast: false`は出現時に何もしません。項目を再び発動すると、そのゾーンを置き換えます。盤面はそのマスに色を付け、戦闘は残りターン数とともに一覧に表示し、ログは巻き込むたびにそれを示します。盤面がなければ、発動時の対象を保持し、`turn-start`と`turn-end`がそれらを巻き込みます。

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

これがCloudkillです。Spirit Guardiansは`"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false`に`"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`を加えたものです。Moonbeamは`"triggers": ["enter", "turn-start"]`を持つ5フィートのバーストです。

一点に保たれたゾーンは移動し、地形を変えられます(Capability API 1.173)。`move: { "budget", "distance" }`で、術者は自分のターンにゾーンを動かせます。戦闘はその行動枠で「Move <zone>」を提示し、歩行と同じく盤面上で、中心から`distance`以内の任意のマスを選びます。`drift: { "distance" }`は、術者の各ターンの開始時に、術者から真っすぐ離れる方向へその距離だけゾーンを動かし、盤面の端で止まります。どちらの場合も、新たに覆われた者は`enter`のとおりに巻き込まれます。移動や漂流ができるのは一点に保たれたバーストだけです。`terrain: { "difficult": true }`は、巻き込む者にとって、ゾーンのすべてのマスへの移動コストを2倍にします(すでに移動困難な地形がさらに2倍になることはありません)。`terrain: { "perDistance": { "every", "amount", "damageType" } }`は、巻き込む者がゾーン内を`every`移動するごとに`amount`(項目自身と同じくダイスと固定値)を与えます。セーヴはなく、複数回の歩行にわたって数えます。ログは移動、漂流、被害をそれぞれ示します。

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

Cloudkillには`"drift": { "distance": 10 }`を加えます。Spike Growthは独自の量を持たない20フィートのバーストで、`"triggers": []`(地形だけが効果です)、`"atCast": false`、`"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`を持ちます。

ゾーンは巻き込んだ者にさらに効果を与えられます(Capability API 1.174)。`breaksConcentration: true`にすると、集中しているクリーチャーが巻き込まれたとき、項目の効果の前に、項目自身のセーヴ難易度に対してルールセットの集中セーヴを振らせ、失敗すると集中が切れます。項目には`save`が必要です。`damageCap`は、出現後に与えたダメージの合計がその量に達するとゾーンを終わらせます。巻き込みと地形の両方を数えます。Sleet Stormは`"save": { "save": "dex" }`、`"applies": [{ "condition": "prone", "duration": "instant" }]`、`"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`を持つ40フィートのバーストです。Guardian of Faithは`"friendlyFire": false`、`"amount": { "flat": 20 }`、`"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`を持つバーストです。

項目が付与した状態から脱出する際の難易度に、項目自身のセーヴ難易度を使えます(1.174)。`from.holding`がその状態である対抗判定と併せて、`applies`の項目に`"escapeDc": "save"`を加えます。WebとBlack Tentaclesは`{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }`で拘束し、拘束されたクリーチャーの脱出の対抗判定は、術者の呪文セーヴ難易度に対して振ります。セーヴ難易度を持たないものが付与した状態は、対抗判定のとおり、それを保持する者に対して脱出を判定します。

アイテムの`use`も、カタログの項目と同じく`concentration`と`zone`を持てます(1.174)。そのため、CloudkillやMoonbeamの呪文スクロールは持続する範囲を保ち、読み手の集中で維持されます。

動かしたゾーンは体当たりでき、その地形はより大きなコストを課せます(Capability API 1.175)。`move: { ..., "ram": true }`は、ゾーンを移動先へ向けて真っすぐ1マスずつ進めます。それまで覆っていなかった者に届いた最初のマスで止まり、トリガーにかかわらず体当たりされたものとしてその者を巻き込み、そのターンはもう動かせません。ゾーンに歩いて入ったクリーチャーは、トリガーのとおりにだけ巻き込まれます。Flaming Sphereは`"triggers": ["turn-end"]`と`"move": { "budget": "bonus", "distance": 30, "ram": true }`を持つ5フィートのバーストです。`terrain.costTimes`(2～10)は、ゾーンへの各歩を通常の歩のその倍数のコストにし、すでに移動困難な地形でもそれ以上はかかりません。Plant Growthは`"terrain": { "costTimes": 4 }`です。これは`difficult`の代わりになり、その指定は`costTimes: 2`にあたります。`terrain.halvesSpeed: true`は、移動困難な地形に加えて、ゾーン内の各歩のコストをさらに2倍にします。Spirit Guardiansは`"terrain": { "halvesSpeed": true }`です。

呪文がかける拘束は、呪文が定める方法でしか破れません(これも1.175)。`"from": { "holding": "restrained", "escapable": true }`を持つ振りほどく対抗判定は、`escapeDc`を指定する拘束に対してだけ提示されるため、同じ対抗判定でWebは破れても、石化は決して破れません。`applies[].escapeChecks`は、対抗判定自身の攻撃側の判定の代わりに、その拘束を破れる対抗判定の判定を指定します。Black Tentaclesは`"escapeDc": "save", "escapeChecks": ["might", "agility"]`で、Webは`"escapeChecks": ["might"]`で拘束します。`zone.whileHeld: { "condition", "amount", "damageType" }`は、術者によるその状態ですでに拘束されたままゾーン内でターンを開始した者に、セーヴなしで、ゾーン自身の効果の代わりにその量を与えます。Black Tentaclesの`"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }`がこれにあたります。

項目やアイテムの使用は治療できます(Capability API 1.176)。`ends: { "conditions": [...], "count"? }`は、指定した順に、最大`count`個まで、対象からそれらの状態を取り除きます。Lesser Restorationは`"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`です。`stabilizes: true`は瀕死の対象を安定させ、対象はそれ以上瀕死セーヴを振りません。`dying`の規則を持つcombatブロックが必要です。Spare the Dyingがこれにあたります。`revives: { "withinRounds", "health" }`は、その数のラウンド以内に死亡した者だけを対象にし、その量で復活させます。Revivifyは`"revives": { "withinRounds": 10, "health": { "flat": 1 } }`です。状態を取り除くか安定させるだけの項目は、それが助けになる相手に対してだけ提示されます。ほかに何もしない`utility`の種類の項目は、治療できる限り提示されます。

範囲はボックスにでき、持続する範囲は壁にもできます(Capability API 1.177)。`area.shape: "box"`は一辺`size`の正方形で、手前の角が狙ったマスにあり、作り手から離れる方向へ広がります。作り手と同じ列や行に並ぶ軸の方向では、代わりにそのマスを中心にします。`range`がなければ作り手に接して置かれます。Webは射程60の`"area": { "shape": "box", "size": 20 }`です。`area.shape: "wall"`は必ず場に残るため、`zone`が必要です。長さ`size`、厚さ`width`(なければ1マス)で、狙ったマスを通り、作り手からの線を横切る向きか、そこから選択の`toward`のマスへ向かう向きに伸びます。`"ring": <diameter>`を指定すると、選択が`"ring": true`のとき、術者は代わりに狙ったマスを囲むその直径の環として置けます。壁にトリガーは不要です。Wind Wallは出現時にだけ効果を与えます。壁は動かされず、漂流せず、作り手について行くこともありません。`zone.blocks: ["move", "sight"]`は、壁がある間、そのマスを歩行、視線、またはその両方に対して閉じます。壁が立ち上がる場所にいる者は、最も近い空いたマスに移されます(同じ近さなら選んだ側に移します)。Wall of Stoneは両方を、Wall of Forceは移動を、Wall of Fireは視線を遮ります。`zone.side: { "distance", "triggers" }`は、壁自身のマスに加えて、片側の`distance`以内のマスが独自の`triggers`のとおりに巻き込むようにします。どちらの側かは選択の`side`で示し、作り手に近い`near`(環なら内側)か、遠い`far`(外側)で、省略すると遠い側です。Wall of Fireは`"area": { "shape": "wall", "size": 60, "ring": 20 }`、`"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`です。

見えるかどうかが重要になります(Capability API 1.178)。`combat.senses`は目で見えない場所を見る感覚を列挙し、それぞれ`{ "id", "label", "sheet"?, "blind"? }`です。キャラクターの範囲は`sheet`でシートから読み(0なら持ちません)、クリーチャーはルールセットの距離で`"senses": { "darkvision": 60 }`のように独自の範囲を持ちます。`blind`の感覚(盲視、振動感知)は目がなくても働きます。このブロックには`combat.distance`が必要です。`obscures`を持つゾーンは、その中にあるものと、それを通して見るものすべてを、その`pierced`が列挙する感覚を範囲内に1つも持たない者から隠します。Fog Cloudは`"obscures": {}`、Darknessは`"obscures": { "pierced": ["blindsight", "truesight"] }`です。このようなゾーンにはトリガーが不要で、範囲を残すだけの`utility`の項目(Fog Cloud、Darkness、壁)もメニューに出て、術者が選んだ場所に置かれます。`unseen`を持つ`combat.conditions`の項目も、同じように持ち主を隠します。不可視は`"unseen": { "pierced": ["blindsight", "truesight"] }`です。これが何をするかは`combat.sight`で示します。`unseenAttacks: true`は、標的が攻撃者を見られないときに攻撃を有利にし、攻撃者が標的を見られないときに不利にします。`eyes`は視覚にあたる感覚を指定し(状態の`lacks`が指定するのと同じものです)、盲目状態のクリーチャーは`blind`の感覚でしか見られません。`seen: true`を持つ項目やクリーチャーのアクションは、「範囲内の見えるクリーチャー1体」という記述のとおり、作り手が見える標的しか選べません。バーストやボックスは`area.copies`(2～10)で一度に複数置けます。各コピーは別のコピーに接し、プレイヤーがそれぞれを配置します。Fire Stormは`"area": { "shape": "box", "size": 10, "copies": 10 }`です。複数置いたゾーンは発動した場所に留まります。

ゾーンは中にいる者に作用できます(Capability API 1.179)。`combat.components`は、何かを使うために必要なもの(5eの音声、動作、物質)を`{ "id", "label" }`で指定し、項目やクリーチャーのアクションは独自のものを`components`に列挙します。ゾーンの`inside`は、中にいる者に`conditions`を与え、留まる間は`immune`のダメージの種類を受けないようにします。ゾーンの`forbids: { "components": [...] }`は、状態の`forbids`が持ち主に対して行うのと同じく(猿ぐつわなど)、それらを必要とするものを中で使えなくします。Silenceは`"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`です。ゾーンの`wards: { "catalogs": [...], "maxLevel": N }`は、外からレベルN以下で使われた、それらのカタログに属するものを中の者に届かなくします。レベルは支払った段階で判断します。Globe of Invulnerabilityは`"wards": { "catalogs": ["spells"], "maxLevel": 5 }`です。行動枠を奪う状態(負の`flat`を持つ`budgets`)を持ち主自身のターン中に付与すると、そのターンの行動枠も奪います。そのため、ターン開始時にStinking Cloudのセーヴに失敗すると、そのターンのアクションを失います。

感覚と視認はさらに広がります(Capability API 1.180)。項目が付与する状態は、持ち主が行動したときに終わるようにできます。`"endsWhenHolder": { "attacks": true, "casts": ["spells"] }`は、持ち主が攻撃を行うか、指定したカタログの項目を使うと状態を取り除きます。`"casts": "spells"`を持つアイテムの使用(スクロール、ワンド)は、そのカタログからの発動と数えます。状態を終わらせた攻撃や呪文の時点ではまだ状態があるため、Invisibilityはその1回の攻撃に有利を与え、その後に消えます。場に残ったゾーンが自ら行うことは、術者の行動ではありません。`combat.conditions`の状態や、アイテムの`worn`または`carried`の効果は、ルールセットの距離で範囲を持つ感覚を与えられます(`"senses": { "darkvision": 60 }`)。効果がある間は、それと持ち主自身の範囲の長い方を使うため、Darkvisionの呪文、True Seeing(`{ "truesight": 120 }`)、goggles of nightが機能します。`"cancelsUnseen": true`を持つ状態は、Faerie Fireが不可視の者の輪郭を浮かび上がらせるように、どの状態が隠していても全員が持ち主を見られるようにします。視界を遮るゾーンや壁は引き続き隠します。

防護、セーヴ、モンスターの呪文発動、スクロールはさらに広がります(Capability API 1.181)。ゾーンの`wards`は、`"by": "base"`と書かない限り、呪文を支払った段階を比較します。それを書くと、Globe of Invulnerabilityのように、支払い方にかかわらず呪文自身のレベルを比較します。`"maxLevelPerCostStep": 1`は、防護自身の発動が基本より上の段階で支払われた1段階ごとに、防ぐレベルを1つ上げます。項目やクリーチャーのアクションの`save`は、ほかに何に対するセーヴと数えるかを`"against": { "damage": ["poison"] }`で示せます。そのため、毒に対する`against`を持つセーヴ修正値もそのセーヴに適用されます。振らずに成功する者も`"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }`(いずれか1つで十分です)で示せます。Stinking Cloudにはこれが必要です。クリーチャーの`spellcasting`は、各項目自身の`components`の代わりに、その呪文に必要なものを特性全体または呪文ごとに示せます。構成要素を必要としない生来の呪文発動には`[]`を指定するため、Silenceでも止まりません。アイテムの使用は、範囲を残すだけのとき(Fog Cloud、Darkness、Silence、Globe of Invulnerabilityのスクロール)、`"kind": "utility"`にできます。`area`と`zone`が必要です。

押し出し、風、ゴーグルについてです(Capability API 1.182)。項目の`"push": 15`は、命中しセーヴに成功しなかった者を、作り手から真っすぐ離れる方向へカタログの距離で15押し出し、固体や立っている者で止まります。ゾーンも巻き込んだ者を同じように押し出します。術者が保持するゾーン(`"anchor": "caster"`)は、バーストに加えてラインやコーンにもできるようになりました。発動した向きを指し、術者とともに移動します。`"turn": { "budget": "bonus" }`を指定すると、術者は自分のターンにその行動枠を消費して向きを変えられ、新たに覆った者を中に移動したものとして巻き込みます(5eのGust of Wind)。ゾーンの`terrain`に`"towardCaster": true`を指定すると、その移動困難な地形は、移動する者を術者に近づける歩にだけ適用されます。状態やアイテムが与える感覚は、範囲の代わりに`{ "add": 60 }`にでき、持ち主自身のその感覚の範囲に加えるか、その感覚がない者には60を与えます(5eのgoggles of night)。

後で起動するゾーンや燃え尽きるゾーンです(Capability API 1.183)。`"detonates"`を持つゾーンは、存在する間も発動時にも何もしません。集中が終わる、ラウンドが尽きる、再び発動されるといった理由で終わったときに、中にいる全員に項目自身の効果を1回与えます。`"grows": { "dice": "1d6" }`は、発動したターンも含めて術者の各ターンの終わりに、その分を量に加えるため、項目自身の量と同じダイスを振ります。`"touched": true`は、中心に移動した者に項目のセーヴを振らせ、失敗すると起動します(5eのDelayed Blast Fireball)。発動した場所に留まります。`"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }`を持つゾーンは、指定した種類のダメージがそのマスのどれか、または中の誰かに与えられると燃え上がります。術者のターンが再び来ると燃え尽きて呪文が終わり、それまでの間に中でターンを開始したほかの者に、セーヴなしでその量を与えます(5eのWeb)。

クリーチャーも押し出します(Capability API 1.184)。クリーチャーのアクションは、カタログの項目と同じく、ルールセット独自の距離で`"push": 60`を取ります。命中した者はクリーチャーから真っすぐ離れる方向へその距離だけ押し出されます。`save`がある場合は失敗したときだけです。そのため`"onSuccess": "none"`ではダメージは残り、成功で免れるのは押し出しと`applies`が付与するものだけです(ドラゴンタートルのTail)。アイテムの使用はラインに`width`を与えられます。Gust of Windのスクロールの60×10フィートがこれにあたります。

クリーチャーの種類がより重要になります(Capability API 1.185)。セーヴは`"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`を指定でき、その種類の標的は2回振って悪い方を採用します(Sunbeam)。項目の`"maxAgainst": { "types": ["plant"] }`は、その種類の標的に最大のダメージを与えます(Blight)。`targetTypes`は、能力値がその値以下の標的を表す`"abilityAtMost": { "int": 3 }`(能力値を書いていないクリーチャーは除外されません)と、`"notImmuneTo": ["charmed"]`(Sleep)も指定できます。状態の修正値は攻撃を2回振らせられます。`{ "to": "attacks", "mode": "disadvantage", "atSource": true }`は、状態を付与した者に対する持ち主自身の攻撃です(Chill Touch)。`{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }`は、その種類の攻撃者が持ち主に対して行う攻撃です(Protection from Evil and Good)。セーヴへの変更は`"against": { "from": { "types": ["dragon"] } }`にでき、その種類のクリーチャーが行ったことに対するあらゆるセーヴに一致します(Dragon Scale Mail)。

クリーチャーのアクションは一緒に再チャージできます(Capability API 1.186)。それぞれの`"recharge"`に同じ`"group"`と同じダイスを与えると、どちらかを使えば両方を消費し、クリーチャーのターン開始時の1回のロールで両方が戻ります(メタリック・ドラゴンの2種類のブレス)。打撃は`"charge"`を持てます。`{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }`は、このターンのクリーチャーの歩行が、命中させる相手へ向かって真っすぐ`atLeast`以上走って終わった場合に、その条項を加えます。各歩は相手に1マスずつ近づく必要があります。その後、標的はセーヴを行い、失敗すると(セーヴがなければ常に)押し出されて状態を受けます(ミノタウロスのCharge)。突撃は1体の標的への打撃に付随し、盤面上でだけ測ります。

アイテムの`attack`は、命中させる相手についてさらに指定できます(Capability API 1.187)。`"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]`は、その種類の標的に対して命中に加えます(mace of smiting)。`plus`の条項は、その種類の標的を除く`"not": { "types": ["construct", "undead"] }`、投げるか撃つ打撃でだけ数える`"blow": "ranged"`(dwarven thrower)、間合いの打撃でだけ数える`"melee"`、与えたダメージに等しい一時ヒットポイントを使い手に与える`"tempHp": true`(sword of life stealing)を指定できます。`onHit`の状態は`"targetIs"`(巨人を伏せ状態にするgiant slayer)と`"oncePerTurn": true`(sword of wounding)を指定できます。`"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]`は、命中によって`healthAtMost`以下になった標的を、セーヴがある場合は失敗したときに即死させ、その際にアイテムのチャージを消費します(nine lives stealer)。`"immuneTo": ["slashing"]`は、それに完全耐性を持つ標的を除きます(vorpal sword)。体力は打撃のダメージの後に読みます。

シートの`live.conditions`、休息の`clear.conditions`、`combat.conditions`に持たせられるエントリーは、640個までです(Capability API 1.552。1.269からは、320、1.188からは、160、それより前は、80)。`to: "attacks"`の修正値は`"ability": "str"`を指定でき、その能力値で行う攻撃だけを変えます(ゴールド・ドラゴンのWeakening Breath)。`to: "checks"`の修正値は`"abilities": ["str"]`を指定でき、そのいずれかの能力値で行う能力値判定だけを変えます。その能力値の対抗判定とスキル判定も含みます(バーバリアンのRage)。クリーチャーのステータスブロックのアクションは能力値を指定しないため、能力値で絞った攻撃の修正値は届きません。

`combat.conditions`の状態は持ち主を傷つけられます(Capability API 1.189)。`"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }`は、持ち主の各ターンの開始時(または`"turn-end"`)に、状態を付与した者からの被害として、状態を終わらせるセーヴより前にそれを与えます。`"stacks": 10`は、状態が続く間に最大その回数まで重ねて付与でき、その被害は重ねた数だけ与えます(sword of wounding)。状態を終わらせると、すべてが終わります。`"onePerSource": true`は、出所ごとに持ち主を1人に限ります。別の者に付与すると、同じ出所から状態を受けていた者からは外れます(oathbowのsworn enemy)。アイテムの攻撃の`against`項目は、`is`の代わりに、または並べて`"marked": "sworn"`を指定でき、使い手から付与されたその状態を持つ標的に一致します。`toHit`のほかに、`"mode": "advantage"`、`"ignoresCover": true`(完全遮蔽未満の遮蔽を無視します)、`"ignoresLongRange": true`も指定できます。`plus`の条項も`"marked": "sworn"`を指定できます(oathbowの3d6の刺突)。クリーチャーのステータスブロックのアクションは、攻撃に使う能力値として`"ability": "str"`を指定できるため、能力値で絞った攻撃やダメージへの変更が届きます。

アイテムの攻撃の`modes`項目は、武器のまったく別の使い方にもできます(Capability API 1.190)。`"range": { "normal": 120 }`はそのモードで届く距離で、ルールセット独自の距離で書きます。`"plus"`は、攻撃自身の条項と同じく、命中に条項を加えます。`"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }`は、使い手と標的の間に立つ全員(両者は除きます)が、攻撃のロールの前にセーヴを行う稲妻です。`"charges": 1`はアイテム自身のチャージをその数だけ消費するため、チャージがある間だけモードが提示されます(javelin of lightning。アイテムには`charges.max`を1、`stack`を1にします)。ラインには、それが通る盤面が必要です。

`"cannot-heal"`の効果を持つ戦闘の状態は、続く間、持ち主へのあらゆる回復を防ぎ、ログがそれを示します(Capability API 1.191)。5eのChill Touchです。戦闘の状態の`"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]`は、`from`に該当するクリーチャーが付与する場合だけ、それらの状態を受けないようにします。すでに付与されたものは残ります(Protection from Evil and Good)。呪文の`targetTypes.abilityAtLeast`は、`abilityAtMost`の上限に対する下限です。`{ "int": 5 }`はIntelligenceが4以下のクリーチャーを対象外にし(Hideous Laughter)、その能力値を書いていないクリーチャーは除外されません。セーヴ修正値の`against.actions`は、アクションをID、名前、共有の再チャージのグループで、大文字と小文字を区別せずに指定し、`against`が示すほかのすべてを絞り込みます。`{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }`はドラゴンのブレスかFrightful Presenceで、Wing Attackは決して含みません。それらのどれかが付与した状態を終わらせるための繰り返しのセーヴも数えます。

アイテムの攻撃はさらに多くの付加効果を持てます(Capability API 1.192)。`"ignoresResistance": true`は、攻撃自身のダメージの種類への標的の抵抗(すべてへの抵抗を含みます)を無視してダメージを通します。一方、別の種類の`plus`の条項は引き続き半減します(vorpal swordの斬撃)。完全耐性は引き続き有効です。`slay`項目の`"saved"`は、`applies`と同じ形で、slayのセーヴに成功した標的が代わりに受ける状態を列挙します。`[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]`は、mace of disruptionで、フィーンドが使い手の次のターンの終わりまで使い手を恐れる効果です。`"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }`は、使い手が`sworn`を付与したクリーチャーがまだ立っている間、使い手が行うほかのすべての武器攻撃をそのモードで振らせます。`"ranged": true`なら遠隔攻撃だけです(oathbow)。また盤面のない戦闘では、範囲のアクション(クリーチャーのものでも呪文でも)は、範囲内の各クリーチャーを巻き込むため、作り手以外のどちらの側の者にも向けられます。盤面と同じく、`friendlyFire: false`は相手側だけに限ります。

対抗判定は、互いに振り合う代わりに、固定の数値に対する判定にもできます(Capability API 1.193)。`defender`を省略して`"difficulty": 15`を指定すると、行動者は`attacker`の判定のうち最良のものを振り、その数値に達すれば勝ちます。`"targets"`は誰に対して行えるかを示し、`"enemy"`(デフォルト)、`"ally"`、行動者自身を含む`"any"`のいずれかです。`"targetHolds": "wounded"`はその状態を持つ標的にだけ提示し、`"targetDying": true`は瀕死でまだ安定していない者にだけ提示します。`onWin.stabilizes`は瀕死の標的を安定させます。そのため、sword of woundingの傷を終わらせるDC 15のWisdom (Medicine)判定は`{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`で、瀕死の者を救うDC 10の判定は`{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`です。プールの戦闘は成功を数えるため、`difficulty`を拒否します。アイテムの攻撃の`"healedOnlyByRest": true`は、奪ったヒットポイントを封じます。どの回復も、持ち主を最大値から封じた分を引いた値より上には戻せず、どの休息でもそれを回復して封印を解きます。戦闘の状態の`harms`も同じ`"healedOnlyByRest": true`を取れるため、剣が残す傷も奪った分を封じます。

サイズは複数のマスを占められます(Capability API 1.194)。`combat.sizes.order`の項目に`"cells"`の数を与えます(`{ "id": "large", "label": "Large", "cells": 2 }`)。そのサイズのクリーチャーは盤面上で一辺その数のマスを占め、自身のマスは左上のマスです。5eのLargeは2、Hugeは3、Gargantuanは4です。全体が収まる場所のうち、立つよう求められた位置に最も近い場所に置かれます。間合いと射程は占めるマスのうち最も近いマスとの間で測るため、剣はオーガの4マスのどれの隣からでも届きます。全体が収まる場所にしか歩けず、誰もその一部を通り抜けられません。範囲はそのマスのどれかが中にあれば巻き込みます。押し出しは全体を動かします。見え方と遮蔽は、占めるマスのうち最も開けたマスから判断します。`cells`のないサイズは、以前とまったく同じく1マスを占めます。

状態は持ち主を大きくも小さくもできます(Capability API 1.195)。`combat.conditions`の項目に`"size": { "steps": 1 }`を与えると、その間、持ち主は`combat.sizes.order`でその数だけ先のサイズになります。負の数なら後ろへ戻り、最初と最後を越えることはありません。5eのEnlargeは`1`、Reduceは`-1`です。間合い、範囲が巻き込むかどうか、サイズを問うあらゆるものは新しいサイズを読み、状態が終わると元のサイズに戻ります。盤面上で大きくなる者は、立っていたすべてのマスを覆い、ほかの誰もいない空いた場所に収まる範囲で新しいサイズを占めます。収まらなければ、収まる範囲で最大のサイズになります。そのため、廊下で大きくなったオーガは廊下が許す大きさまでしか大きくなりません。小さくなる者は左上のマスを保ちます。ログは誰が何に変わったかを示します。`combat.sizes`が必要です。武器のダイスには`damage`の修正値を、呪文の残りの効果にはStrengthの`checks`と`saves`のモードを組み合わせてください。

項目は、残りの体力で標的を選べます(Capability API 1.196)。`mechanics`の`"healthPool": { "dice": "5d8" }`は使用時に1回振り、残りの体力が最も少ない標的から順に分け与えます。各標的は、残りの体力がプールの残量以下である場合だけ影響を受け、その分を使い切ります。それ以外の標的はまったく影響を受けません。5eのSleepとColor Sprayがこのように働きます。`perCostStep`は上位の段階で発動したときにこれを増やします。`"healthAtMost": 150`は、体力がその値以下の標的にだけ影響します(Power Word Stun)。`"kills": true`は影響を与えた者を即死させるため、Power Word Killは`"healthAtMost": 100, "kills": true`です。どちらも、`targetTypes`が対象にできる者を決めた後で、標的の残りの体力を読みます。ログはプールのロール結果と、それが足りた相手を示します。

ダメージの修正値は、打撃自身のダイスを何倍もの回数振らせられます(Capability API 1.197)。状態に`{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }`を付けると、状態がある間、war pickの1d8 + 2は2d8 + 2のダメージになります。巨大化したデュエルガーの武器と同じです。固定値の部分はそのままで、クリティカルはほかのダイスと同じく追加のダイスも倍にし、メニューの平均値もそれを数えます。変わるのは打撃が与えるダメージだけです。`"self": true`を持つクリーチャーのアクションを自身のターンに行うと、リアクションですでにそうだったように、クリーチャー自身に効果が及ぶようになったため、その`applies`が付与されます。

ゾーンは、出現時とは別のダメージの種類をトリガー時に与えられます(Capability API 1.198)。自身の`damageType`が`"piercing"`である項目に`"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }`を付けると、5eのWall of Thornsのように、壁が周囲に出現した者には刺突を、後から中に入った者には斬撃を与えます。項目自身の`amount`と、それを与えるトリガー、側、体当たりのいずれかが必要で、ルールセットが`combat.damageTypes`を宣言している場合はその1つを指定します。

体力のプールは一部の標的を飛ばせます(Capability API 1.199)。`healthPool`と並べて`"healthPoolSkips": { "conditions": ["unconscious"] }`を指定すると、5eのSleepが気絶した者を無視するように、それらの状態のどれかを持つ者を除外し、その者にプールを消費しません。`"unseeing": true`は、Color Sprayが見えないクリーチャーを無視するように、項目の作り手を見られない者(盲目状態か、作り手への視線がない者)に同じことをします。`conditions`、`unseeing`、またはその両方を指定し、`healthPool`が必要です。

壁は、1つずつ攻撃されて壊れる区画に分けて立てられます(Capability API 1.200)。`"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }`は5eのWall of Iceです。10フィートの各パネルはAC 12、30ヒットポイントで、火から2倍のダメージを受けます(`resist`と`immune`も同じように働きます)。1体の敵か誰か1人を狙ってダメージを与える攻撃は、代わりに区画に向けられます。その選択肢は攻撃できるマスを`walls`として列挙し、選択はその1つを`wall`として指定します。攻撃はクリーチャーに対するのと同じく振られてダメージを与え、ログは区画が受けたダメージと残りを示します。0になった区画は壊れます。遮るのをやめ、そこに入った者(または`triggers`のとおり、そこでターンを開始または終了した者)は、1ターンに1回、その`amount`を受けます。項目自身の難易度に対して`save`でセーヴし、成功すれば半分です(`onSave: "none"`なら何も受けません)。区画には`blocks`を持つ壁が必要で、壊れた区画の`save`には項目自身の`save`が必要です。

項目はシートのライブのトラックを動かし、封じられた体力を戻せます(Capability API 1.201)。`"tracks": [{ "track": "exhaustion", "by": -1 }]`は、5eのGreater Restorationのように、命中した者の消耗を1段階取り除きます。セーヴを持つ項目(Sickening Radiance)の`"by": 1`は、失敗した者に1段階加えます。各トラックは独自の範囲に収まり、体力の最大値を半分にする段階は即座に効果を持ち、`defeats`の段階に達すると死亡します。`"unseals": true`は、休息でしか戻らない体力(`seals`の打撃が奪った分)を戻します。Greater Restorationがヒットポイント最大値の減少を終わらせるのと同じです。このように治療するだけの項目は、それが助けになる者にだけ提示されます。壁の区画の`broken`は独自の`perCostStep`を持て、発動が基本より上の段階で支払われた1段階ごとに1回加えます。Wall of Iceの極寒の空気は`{ "dice": "1d6" }`です。トラックは負傷トラックではなく普通のトラックで、`unseals`にはポイントで保持する体力が必要です。

項目が付与する状態は、同じ項目が付与する別の状態とともに終わるようにできます(Capability API 1.202)。5eのHypnotic Patternである`"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`では、魅了が終わるときは常に、無力状態も終わります。セーヴ、治療、術者の集中が切れること、味方に揺り起こされること、戦闘の終了のいずれでもです。一緒に終わるのは同じ使用で付与されたものだけで、ログは理由を示します。`endsWith`は同じ`applies`リスト(または`onEnd`、`charge`、`saved`のリスト)の別の状態を指定し、自身は指定できません。

クリーチャーのアクションは標的の体力の最大値を下げられます(Capability API 1.203)。レイスのLife Drainの`"reducesMax": { "save": "con_save", "difficulty": 14 }`は、打撃が命中したときに標的にそのセーヴを振らせます。失敗すると、受けたダメージは体力だけでなく最大値からも引かれ、休息までどの回復でも戻りません。`"lasting": true`(クレイ・ゴーレムのSlam)なら休息でも戻らず、`unseals`する項目(Greater Restoration)でしか戻りません。このように最大値が0まで下がった標的は死亡します。シートは、どの休息でも戻らない分を`sealed`の中のプールの`lasting`として保持します。ポイントで保持する体力が必要です。

治療は、すべての治療の代わりに、そのうち1つを行えます(Capability API 1.204)。`"cureOneOf": true`を指定すると、いくつかの状態を`ends`し、`tracks`を動かし、`unseals`する項目(5eのGreater Restoration: 魅了、石化、消耗1段階、ヒットポイント最大値)は、ちょうど1つを行います。武器のモードと同じく、それぞれを選択肢のモードとして提示します(状態、トラック、体力のプールを、そのラベルで示します)。何も選ばずに使うと、その順で、標的に該当するものがある最初のものを行います。選べる治療が少なくとも2つ必要です。

下げる最大値は、独自のセーヴを必要としないようにできます(Capability API 1.235)。`save`と`difficulty`を持たない`reducesMax`は、命中するすべての打撃のダメージ分だけ最大値を下げます(5eのヴァンパイアのBite)。`"onFailedSave": true`なら、標的が項目自身のセーヴに失敗したときだけです(5eのHarmは、セーヴを持つカタログの項目です。この場合、`reducesMax`は独自のセーヴを持ちません)。`damageType`はその種類のダメージだけを数え(Biteの死霊)、`"heals": true`は下げた分だけのヒットポイントを作り手に戻します。カタログのmechanicsも`reducesMax`を取れ、`leavesAtLeast`は項目のダメージで標的のヒットポイントがその値を下回らないようにします(Harmは1を残します)。クリーチャーのアクションやカタログのmechanicsの`targetHolds`は、向けられる相手を限ります。その`conditions`のどれかを持つ者か、アクションの作り手が付与した`fromSelf`のどれかを持つ者です(Biteでは、ヴァンパイアに掴まれているか、無力状態または拘束状態の者)。

状態は、持ち主に独自の使用を与えられます(Capability API 1.236)。戦闘の状態の`actions`は、持ち主がその状態にある間に使えるカタログの項目(`spells/break-enchantment`)を列挙します。メニューに出るのはその間だけで、シートからは各項目が消費する行動枠のほかに何も払わず、呪文と同じく持ち主自身の数値で振ります(呪文を発動するクリーチャーはその発動の数値を使います)。`"endsCondition": "<condition>"`を持つ項目は、使用すると使用者のその状態を終わらせ、それが使用者自身の集中で保たれている場合はその集中も終わらせます。5eのDispel Evil and Goodでは、Break EnchantmentとDismissalのどちらも呪文を終わらせます。`ends.from`(種類とタグの条件)は、それを満たすクリーチャーが付与したものだけを治します。Break Enchantmentは、セレスチャル、エレメンタル、フェイ、フィーンド、アンデッドによる魅了や恐怖を終わらせ、それ以外の者によるものは残します。`dismisses`は、命中してセーヴに成功しなかった者を、生きたまま戦闘から、盤面とターン順の外へ送ります。`true`なら永久に(Dismissal)、`{ "while": "<condition>" }`ならその状態にある間です。その状態は同じ項目が付与する必要があります(5eのBanishment)。その時間は術者のターンで進み、時間切れ、セーヴ、術者の集中のいずれかで終わると、元の場所か、収まる最も近い空いた場所に戻ります。`gone`(種類とタグの条件)を指定すると、それを満たし、状態の時間を最後まで受けた者は戻りません。

戦闘は、一部の者が不意を突かれた状態で始められます(Capability API 1.237)。誰が不意を突かれたかはシーンが示します。元になる遭遇が、パーティーか敵かを問わず、`"surprised": true`で印を付けます。その者は最初のターンに移動も行動もできず、メニューにはそのターンを終える選択肢しかありません。そのターンか最初のラウンドのどちらか早い方が終わるまで、リアクションも伝説的な使用も行いません。`"cannotBeSurprised": true`を持つ戦闘の状態は、持ち主が不意を突かれないようにします。5eのForesightです。`"ignoresSurpriseWith": "<catalog>/<entry>"`を持つカタログの項目は、持ち主が不意を突かれている間も使える使用を指定し、それを使うとその時点で不意打ちが終わるため、ターンの残りは持ち主のものになります。5eのFeral Instinctは、不意を突かれたバーバリアンが先に激怒することで通常どおり行動できるようにします。

カタログの項目は、戦闘の最初のラウンドに持ち主へ2回目のターンを与えられます(Capability API 1.238)。シートのリストで保持する項目の`"extraFirstTurn": { "initiative": -10 }`は、持ち主自身のイニシアチブにその数を加えた位置に2回目のターンを置き、その数以上の全員の後になります。2回とも完全なターンで、2ラウンド目からは通常どおり1ラウンドに1ターンです。2回目のターンの前に倒された持ち主は、単にそれを逃します。`"unlessSurprised": true`なら、不意を突かれて戦闘を始めた者には2回目のターンがありません。5eのThief's Reflexesです。

戦闘の状態は、与える行動枠で買えるものを間合いの攻撃に絞り、終了時に持ち主のトラックに印を残せます(Capability API 1.239)。`"grants": { "budget": "bonus", "attacks": true, "melee": true }`では、その行動枠で支払う1回の打撃は、間合いで打つ武器でしか行えません。投擲武器は投げずに振るうため、間合い内の相手にしか使えません。射程があって間合いのない武器は提示されません。`"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }`は、カタログの項目の`tracks`と同じく、状態がどのように終わっても、終了時に持ち主のライブのトラックを段階単位で動かします。`applies`と`tracks`は併用も単独使用もできます。カタログの項目の`"usesOf": "<row name>"`は、自身の使用回数の代わりに、その行の項目の使用回数(そのカウンター行)を消費します。これにより5eのFrenzyは、BerserkerのFrenzied Rageという項目になります。`"usesOf": "Rage"`を持ち、激怒と、それに`endsWith`する`frenzied`の状態を付与し、後者の状態がこの2つを両方持ちます。

イニシアチブは2回振って、良い方か悪い方を採用できます(Capability API 1.240)。`combat.initiative.checkAbility`はイニシアチブがその能力値で行う判定であることを示すため、その判定を2回振らせるものは、イニシアチブも2回振らせます。`own-checks-advantage`を持つ状態(5eのForesight)や、その能力値に絞った、または何も絞っていない`mode`付きの`checks`修正値(DexterityへのEnhance AbilityのCat's Grace)です。シートのリストで保持する`"initiativeMode": "advantage"`(または`"disadvantage"`)を持つカタログの項目は、何を保持していても、持ち主のイニシアチブを2回振らせます。5eのFeral Instinctです。有利と不利は、どのロールとも同じく打ち消し合います。ログのイニシアチブの項目は`mode`と、採用しなかった`dropped`のロールを持ちます。毎ラウンドイニシアチブを振る戦闘では、毎ラウンド2回振ります。対象は振るダイスだけで、プールのイニシアチブは2回振りません。

リアクションは、持ち主自身の攻撃の命中に応じられます(Capability API 1.241)。`"by": "self"`を持つ`"hit"`のリアクションは、攻撃者のロールが命中し、打撃を受けた全員が応じた後に攻撃者へ提示され、命中した相手に向けられます(`"at": "target"`と書きます)。`"weapon": true`は、あらゆる命中の瞬間を武器の打撃に絞ります。カタログに属さない攻撃か、クリーチャーの単一標的のアクションです。自分の命中へのリアクションは、それを選ぶことが攻撃の一部であるため、リアクションを止めるものでは止まりません。本当に行動枠を消費するのでない限り、`"free"`と印を付けてください。5eのStunning Strikeがその例で、`"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`、無料、気のコスト、Constitutionのセーヴ、モンクの次のターンの終わりまでの`stunned`です。`"addsToBlow": true`を持つ攻撃の項目の量は、単独で与えられる代わりにその打撃に加わります。打撃の命中時に振り、クリティカルで倍になり、その条項は届く標的にだけ適用されます。5eのDivine Smiteは2d8の光輝、`perCostStep`は1d8、フィーンドかアンデッドを`targetIs`とする1d8の光輝の条項、`"perCostStepsMax": 3`です。最後のものは、`perCostStep`や`targetsPerCostStep`を持つあらゆる項目で数える、上位コストの段階の最大数です。別のウィンドウの中で行う攻撃(機会攻撃)は命中で保留されないため、何も加わりません。

シートが保持するものは、攻撃の行を変え、打撃を与え、攻撃アクションを待てます(Capability API 1.242)。`attackRows`を持つ、シートのリストで保持するカタログの項目は、`when`の範囲が成り立つ間(着用している鎧が最大0など、シート上の値)、名前を列挙した行(大文字と小文字を区別せず照合します)を変えます。`abilities`は、行自身の能力値とこれらのうち最良のものを命中に使い、行のダメージが同じ能力値を加える場合はダメージにも使います。`die`(シートの値`from`から、段階の`table`を通して面数を得ます)は、その方が平均が高い場合に、行のダイスの代わりにその面数のダイスを1個振ります。`qualities`は、打撃が抵抗を越えて持つ性質に加えます。5eのMartial Artsは`{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`で、Ki-Empowered Strikesは`{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`です。保持する項目の`grantsStrike`は、状態の`grants.attacks`とまったく同じく、攻撃自身の行動枠を使い切った後に、持ち主が別の行動枠で1回の打撃を購入できるようにします。`names`はそれらの攻撃に、`melee`は間合いに、`afterAttack`は攻撃アクションを行ったターンに絞ります(`true`か、それらのいずれかで攻撃アクションを行った場合を表す`{ "names": [...] }`)。Martial Artsのボーナスの素手打撃は`{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`です。状態の`grants`も同じ`names`と`afterAttack`を取ります。`afterAttack`を持つ項目は攻撃アクションの後にだけ提示されます。Flurry of Blowsは、ボーナスの行動枠で気を1消費する`utility`の項目で、`afterAttack`を持ち、数0で宣言した行動枠を2つ`gives`し、その行動枠でUnarmed Strikeの`grantsStrike`を持ちます。攻撃アクションとは、攻撃リストやアイテムから、それ自身の行動枠かすでに購入した打撃で支払って行う攻撃で、付与で支払った攻撃は決して含みません。

機会攻撃は、ターン中の攻撃とまったく同じく、命中した時点で保留されます(Capability API 1.243)。その命中に応じる手段を持つ全員に尋ね、作り手には最後に、それに加えるもの(Divine Smite、Stunning Strike)を尋ねます。打撃が命中した後、すでに攻撃者が応じた歩行自身のウィンドウを再び尋ねます。途中で動けなくなった歩行者(朦朧状態や掴まれた状態のように`speed-zero`を持つ状態)は、打たれたマスより先へは進みません。リアクションである項目や、別の打撃に加わる項目が、機会攻撃そのものとして選ばれることはありません。

攻撃の規則は手に持つ武器にも届き、攻撃リストはすべてのシートに行を与えられます(Capability API 1.244)。`combat.attacks[].always`は、そのリストの列で書いた最大4行を列挙し、すべてのシートの戦闘が自身の行に加えてそれを持ちます。同じ名前のシートの行があれば、それが代わりに使われます。5eの素手打撃は`{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`です。`attackRows`の規則の`names`は、手に持つ武器の攻撃の名前にも一致するようになり、その`items`は手に持つ武器をタグで照合します。`tags`のすべてを持ち、`notTags`のどれも持たないものです(`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`。そのためdagger +1も該当します)。規則は`names`、`items`、またはその両方を指定します。同じ`names`、`tags`、`notTags`を持つ`wielding: { "only": {...} }`は、手に持つすべての武器がそのどれかであるか、何も持っていない間だけ規則を保ちます。「素手か、モンク武器だけを使っている」場合です。`grantsStrike`も同じ`wielding`と、`attackRows`の規則と同じような`when`を取るため、Martial Artsのボーナスの打撃は鎧を着ていると提示されません。

一度に複数回の使用、0に落とすセーヴ、指定した攻撃による命中、状態の終了時の被害についてです(Capability API 1.245)。項目の`usesSpent`は、1回の使用でその行(または`usesOf`の行)の使用回数をその数だけ消費し、それだけ残っている間だけ提示されます。Quivering Palmの気3がこれにあたります。`"hit"`のリアクションの`names`は、それらの攻撃による命中にだけ応じ、名前を大文字と小文字を区別せずに照合します。Quivering Palmは`{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }`で、長く続く`quivering`の状態を付与します。セーヴを持つ項目の`dropsOnFailedSave`は、量を与える代わりに、失敗した標的の体力を0に落とします(クリーチャーは脱落し、ルールセットに瀕死の規則があればキャラクターは瀕死になります)。成功した標的は、セーヴの`onSuccess`のとおりに量を受けます。振動を終わらせるのは、`targetHolds: { "fromSelf": ["quivering"] }`、10d10の死霊、`onSuccess: "none"`のConstitutionのセーヴ、`dropsOnFailedSave`を持つアクションです。状態の`onEnd.harm`(`dice`、`flat`、`type`、`unless`)は、状態の終了時に、付与した者からのダメージを持ち主に与えます。ただし、持ち主が`unless`の指定に該当する場合は与えません。Hurl Through Hellは`dismisses: { "while": "hurled" }`を持つ命中へのリアクションで、`hurled`は`{ "rounds": 1, "of": "source" }`の間続き、`hurled`の状態の`onEnd`は`{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`です。

`afterAttack`は、攻撃アクションで使った武器をタグでも照合します(Capability API 1.246)。`{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }`は、それらの名前の攻撃の後、または名前にかかわらず`tags`のすべてを持ち`notTags`のどれも持たない手持ちの武器での攻撃の後を表すため、dagger +1も該当します。項目でも、`grantsStrike`や状態の付与でも同じく、`names`、`items`、またはその両方を指定します。

無謀な打撃と残忍な打撃です(Capability API 1.247)。`beforeAttack`を持つ項目は、持ち主自身のターンで、まだそのターンに攻撃していない間だけ提示されます。Reckless Attackは、バーバリアン自身にかける無料の`buff`で、`beforeAttack`を持ち、`reckless`を`{ "rounds": 1 }`、`exposed`を`{ "rounds": 1, "at": "turn-start" }`の間付与します。攻撃への変更は、ダメージへの変更と同じく、`ability`とともに`attacks`(`weapon`、`spell`、`any`)と`blow`(`melee`、`ranged`)を取ります。`reckless`は`{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`で、`exposed`は`attacks-against-advantage`の効果を持ちます。ダメージへの変更の`criticalDice`は、クリティカルヒットのときだけ、打撃自身のダメージダイスをその数だけ、倍にせずに加えます。Brutal Criticalは、バーバリアンの派生値に対する段階で、`{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`を持ち、ダイス1個ごとに1段階です。

連打の命中への応答です(Capability API 1.248)。`hit`の瞬間の`budget`は、その行動枠から支払った打撃による命中に絞ります。Open Hand Techniqueは`{ "on": "hit", "by": "self", "budget": "flurry" }`に応じます。これはFlurry of Blowsが`gives`し、その`grantsStrike`が消費する行動枠です。リアクションの`oneOf`は、持ち主自身の命中への応答のグループに名前を付け、1回の命中でそのうち1つだけを行います。Open Hand Techniqueは`"oneOf": "open-hand"`を共有する3つの無料の項目です。1つはDexterityの`save`で`prone`を付与し、1つはStrengthの`save`と15の`push`を持ち、1つは`cannot-react`の効果を持つ状態を`{ "rounds": 1, "at": "turn-start" }`の間付与します。1つを行うと、その命中に対するほかの2つは消費されます。次の命中では再び3つすべてが提示されます。`oneOf`は、`by`が`self`で`also`のない`hit`の瞬間に付けます。

ロール後の救済です(Capability API 1.249)。`"rescue": true`を持つ`attacks`、`saves`、`checks`への変更は、ロールから外して保留されます。持ち主自身のロールが足りず、その最大値(固定部分と、すべてのダイスの最大の目)で差を埋められる場合だけ振って加え、それをもたらした状態を消費します。結果を変えられなかったロールでは保留されたままです。Bardic Inspirationは味方に付与する状態で、`{ "to": "saves", "dice": "1d6", "rescue": true }`と、`attacks`と`checks`への同じ変更を持ちます(ダイスの大きさごとに1つの状態で、ほかの段階と同じくバードのレベルで選びます)。Guidanceは`1d4`の`checks`、Resistanceは`1d4`の`saves`です。ナチュラルの失敗は救済されず、ダイスプールの戦闘では何も保留しません。項目の`rescue`は、その項目をメニューから外します。持ち主自身のその種類のロールが失敗したときに、使用回数とコストとともに消費されます。`{ "roll": "saves", "by": "reroll" }`はセーヴを振り直し、新しいロールが確定します(独自の使用回数を持つIndomitable、`usesOf`がKiのDiamond Soul)。`{ "roll": "attacks", "by": "success" }`は外れを命中に、`{ "roll": "checks", "by": "success" }`は失敗した判定を成功に変えます(Stroke of Luck)。保留した変更を先に試します。

Cutting Wordsと回避です(Capability API 1.250)。項目の`lowersRoll`は、`by`のない`hit`のリアクション(味方のために応じるには`for`と`within`を使います)で、ほかの者の攻撃が命中したときに使われます。その`dice`、またはMartial Artsと同じく値で大きさが決まる1個の`die`(`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`)をロールから引き、改めて防御と比べます。ナチュラルの命中は引き続き命中します。Cutting Wordsは`{ "on": "hit", "for": "ally", "within": 60 }`を持ち、バードのインスピレーションのカウンターを`usesOf`とする無料の`debuff`です。戦闘の状態や段階の`evasion`はセーヴを指定します。成功で半分を与えるものに対して、セーヴに成功すれば何も受けず、失敗すれば半分を受けます。Evasionは、ローグやモンクのレベルに対する段階で、`"evasion": ["dex_save"]`を持ちます。

Lay on Handsです(Capability API 1.251)。項目の`usesChosen`は、1回の使用で消費する使用回数を、1から残りの回数まで使用者が選べるようにし、その回数倍の量を回復します。選択肢は`amount: { max }`を持ち、選択は`amount`を送ります。省略すると、最初の標的を平均で完全に回復する分を消費します。`usesSpent`を持たない`heal`向けです。Lay on Handsは`"amount": { "flat": 1 }`の`heal`で、パラディンのレベルごとに5回のカウンターを`usesOf`とし、`usesChosen`と`"targetTypes": { "not": { "types": ["undead", "construct"] } }`を持ちます。

Font of Magicです(Capability API 1.252)。項目の`restore`は、`heal`か`buff`で、命中した者のプールを回復します。ライブのプールはIDで、リストの行のプールはその名前(`"Sorcery Points"`)で指定します。プールの系統に属する`cost`があれば、`perCostStep`は最も安い段階より上の1段階ごとにそれを増やすため、ソーサラーのスロットは、そのレベルに等しいSorcery Pointsになります。`slots_1`を消費し、`"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }`と`"perCostStep": { "flat": 1 }`を持つ、自分への`buff`です。`overMax`はプールの最大値を超えられるようにします。超えた分は別に保持され、休息でプールを最大値に戻すと消えます。ポイントから作るスロットはレベルごとに1つの項目で、ポイントを`usesOf`とし、`usesSpent`をその価格とし、`"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`を持ちます。使用者自身に、その者が持たないプールを回復する項目は、メニューに出ません。

Metamagicです(Capability API 1.253)。項目の`alters`は、その`catalogs`の項目の使い方を変えます。単独でメニューに出ることはなく、適合する各項目とともに提示され、その項目を使うときに選び、独自の使用回数で支払います(Sorcery Pointsを`usesOf`とし`usesSpent`を指定するか、呪文を支払う段階に応じた`usesSpentByLevel`で、最低1です)。リアクションのない`utility`です。別のものを`joins`しない限り、1回の使用につき1つだけです。変えるものは次のとおりで、それぞれ変える対象がある呪文にだけ適合します。`spares`(シート上の値で、巻き込んだ使用者とその味方のうちその数の者は、セーヴに自動的に成功します。Careful)、`range`(`{ "times": 2, "touch": 30 }`。Distant)、`rerolls`(平均未満のダメージダイスをその数だけ、低いものから振り直します。`joins`を持つEmpowered)、`lasts`(1分以上付与するものを、その倍数の時間続かせます。1日を超えることはありません。Extended)、`heightens`(最初の標的は最初のセーヴを不利で振ります。Heightened)、`budget`(`{ "from": "action", "to": "bonus" }`。Quickened)、`drops`(以後不要になる構成要素で、発動に誰も応じられません。Subtle)、`twins`(使用者だけを対象とするのでなく、上位スロットで何も得ない、単一標的の呪文に標的を1つ加えます。Twinned)です。今それらのいずれかがないと発動できない呪文(アクションを使った後のQuickened、Silenceの中のSubtle)は`alterNeeded`付きで提示され、選択はそれを含む必要があります。選択は、選択肢の`alters`のIDを`alters`として送り、ログは`altered`を示します。

選んだ時点のMetamagicです(Capability API 1.254)。`rerolls`は、呪文のすべてのダメージダイスの中で最も低いものを、合計でその数を超えないように振り直します。呪文自身のダイス、`plus`の各条項のダイス、クリティカルヒットなら追加のダイスも、残っている数だけ対象です。攻撃呪文は、命中した標的ごとにそれらを振ります。`spares`の変更が、使用者の側を免除する数より多く巻き込む場合は、使用者が誰を免除するか選びます。選択肢の`alters`の提示は`spares`(人数)を持ち、選択は`spares`として免除する使用者の側の者のIDを送ります(何も送らなければ誰も免除しません)。省略すると、最初に巻き込んだ者から免除します。この選択は、発動に応じるウィンドウの間も保たれます。誰も免除しない変更での`spares`、免除する数より多いID、重複したID、別の側の者のIDは`bad-alter`として拒否されます。

Heightenedの標的とAcid Arrowです(Capability API 1.255)。`heightens`の変更が複数の者を巻き込む場合は、使用者が最初のセーヴを不利で振る者を選びます。選択肢の`alters`の提示は`heightens: true`を持ち、選択は`heightens`として戦闘員1人のIDを送ります(呪文が誰かに向けられている場合は向けられた者の1人で、使用者自身は決して選べません)。省略すると、最初に巻き込んだ者です。`halfOnMiss: true`を持つ項目(`attackRoll`と`amount`が必要です)は、外れてもダメージ(条項のダメージも含みます)の半分を与えますが、命中時のほかの効果は与えません。`applies`の項目の`harmsPerCostStep`(`{ "dice": "1d4" }`)は、付与時の上位コストの1段階ごとに、状態の`harms`にその分を加えます。Acid Arrowの後続の酸は、2レベルを超えるスロット1レベルごとに1d4増えます。

持ち主自身の救済、使用者自身には使えない項目、1つずつの状態です(Capability API 1.256)。項目の`rescue`は`by: "twenty"`にもできます(`roll: "checks"`でのみ)。失敗した判定のd20を20として数え、それで成功する場合だけ消費します。Stroke of Luckが能力値判定に対して行うのと同じです。`by: "die"`は、与えられたものでは差を埋められず、持ち主自身のダイスなら埋められる場合に、そのダイスを加えます。`dice`(`"1d10"`、Dark One's Own Luck)か、シート上の値で大きさが決まる1個の`die`、`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`(Peerless Skill)です。与えられた状態を先に試します。`ally`や`any`のクリーチャーに向ける項目の`notSelf: true`は、使用者自身には使えないようにします。Bardic Inspirationです。戦闘の状態の`oneAtATime`はグループ(`"bardic"`)を指定します。クリーチャーがそのグループの状態を1つ持つ間は、同じものも含め、そのグループのほかの状態は付与されません。状態のイベントは`already`を示します。

より多くの種類のロールへの応答です(Capability API 1.257)。`lowersRoll`は`"also": ["checks", "damage"]`も列挙できます。命中した攻撃判定に加えて、ほかの者の能力値判定(掴みのような対抗判定、アイテムの関門、Counterspellの判定)やダメージロールが行われるときに、そのダイスを引きます。これは、項目の行動枠、使用回数、コストとともに、相手側でその項目がロールする者に届く最初の者によって自動的に消費されます。ただし、その最大値でロールを覆せる場合だけです。成功しそうな判定が失敗し得る場合や、持ち主の側の誰かを倒しそうなダメージが、その者を立ったままにし得る場合です。Cutting Wordsは、レベルで大きさが決まるダイスを持つ`{ "dice": "1d6", "also": ["checks", "damage"] }`で、`needs: ["hearing"]`と`targetTypes: { "notImmuneTo": ["charmed"] }`を持ちます。救済は`saves`を指定できます(`saves`の救済だけです)。その場合、それらのセーヴにだけ消費されます。`budget`があれば、その行動枠も1つ消費し、それがなければ消費されません。ring of evasionは、チャージを使用回数とする`{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }`です。アイテムの使用も、`attackRoll`と`amount`とともに`halfOnMiss`を持てます。Acid Arrowのスクロールがこれにあたります。

病気です(Capability API 1.258)。戦闘の状態の`kinds`(`["disease"]`)は、それがどの種類の状態かを示します。種類が状態自身のIDになることはありません。治療の`ends`は、状態の代わりに種類を指定できます。その種類のすべての状態が該当し、`count`は引き続きその数だけを取り除くため、Lesser Restorationの「病気1つ」は`{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`です。完全耐性(クリーチャーやアイテムの`conditionImmunities`、または状態や段階のもの)も種類を指定できます。Divine Healthは`"conditionImmunities": ["disease"]`を持つ状態です。`saveEnds`は回数を数えられます。`successes`(2～10)は状態を終わらせる成功の数で、`failures`(`{ "count": 3, "becomes": "blinding_sickness" }`)は、その数のセーヴに失敗すると、代わりに`becomes`を、時間制限もそれ以上のセーヴもなしで付与します。状態のイベントは`worsened`を示します。これがContagionです。各ターンの終わりにセーヴする`until-save`の状態で、どちらも3回です。時間制限のない状態は戦闘が終わっても解けないため、発症した病気は、何かが治すまで戦闘後も続きます。

着用アイテムの救済です(Capability API 1.259)。アイテムの`use`は、項目のmechanicsと同じく、`saves`と`budget`を含めて`rescue`を持てます。メニューには出ず、アイテムを着用していて(スロットを持つ場合)、その使用が消費する`charges`がある間だけ消費されます。消費するとチャージを1つ使います。ring of evasionは、`"charges": { "max": 3 }`と`"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }`を持つアイテムです。チャージはアイテムの`recharge`のとおりに戻ります。

戦闘の合間の病気です(Capability API 1.260)。戦闘の状態は`onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }`を持てます。状態がある間に持ち主がそれらの休息を取るたびに、休息が戻すものを戻した後、休息を取った場所でロールし、その分だけ体力の最大値が下がります。`lasting`がなければ次の休息で戻り、あれば封印を解くものでしか戻りません。`onRest.save: { "save": saveId, "difficulty": 15, "cures": true }`は、ルールセットの判定と同じく、シート自身の修正値で先に振ります。失敗した場合だけ最大値が下がり、`cures`があれば成功で状態が終わります(オーティューの病気)。下げる最大値があるのは、ポイントで保持する体力だけです。5eのMummy Rotは、`"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`を持つ時間制限のない状態です。終了まで、または変化先まで数えるセーヴ(1.258)は、戦闘が終わっても止まらなくなりました。逃走による終了も含めてどの戦闘でも、終了時に持ち主の残りのターンのセーヴをすべて振るため、Contagionはそれまでに治るか発症します。ダメージを受けたときだけ行うセーヴは、ダメージを待ちます。

病気の段階です(Capability API 1.261)。戦闘の状態は次のものを持てます。`onDamaged: { "applies": [...] }`は、持ち主がダメージを受けるたびに、`onEnd`と同じく時間制限付きで付与されます(Slimy Doomの、持ち主の次のターンの終わりまでの朦朧)。`expires: { "becomes": conditionId }`は、状態自身の時間が尽きたとき(戦闘の終了を含みます)に時間制限なしで変化する先で、ほかの方法で終わった場合は変化しません(アボレスのTentacleの病気は1分後に変化します)。`curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`を指定すると、それらのカタログからその段階以上で支払った治療でしか終わりません。`onRest.restoredWhenCured: true`(`lasting`と併用)は、状態がどのように外れても(状態自身のセーヴの成功を含みます)、その状態の休息が最大値から奪った分を戻します。`cannot-heal-nonmagical`の効果は、魔法による回復以外のすべての回復を防ぎます。戦闘中は性質が`"magical"`を示すアクション、戦闘外では`"magical": true`を持つ回復処理(`magical`のタグを持つポーションがその一例です)が魔法の回復で、休息は決して該当しません。拒否された回復は`cannot-heal`を示します。ステータスブロックのアクションは、カタログの項目と同じく、種類も含めて`ends`を持てます。ユニコーンのHealing Touchは`"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`です。複数の呪いから1つを選ぶように、術者が状態の中から選ぶ治療は`cureOneOf`(1.204)です。

クリーチャーのアクションの性質です(Capability API 1.262)。ステータスブロックのアクションは、カタログの項目と同じく、ルールセットが宣言するアイテムのタグである`qualities`を持てます。`["magical"]`はその回復を魔法の回復にし、`cannot-heal-nonmagical`もそれを通します。また、それに対するセーヴは魔法に対するセーヴになります。戦闘中のアイテムの使用も同じくアイテム自身のタグを持つため、`magical`のタグを持つポーションは、シート上と同じく戦闘中も魔法として回復します。

オーラです(Capability API 1.263)。戦闘の状態は最大4つの`auras`を持てます。それぞれ、持ち主から`distance`以内にいる`side`(`allies`、`enemies`、`all`)の者に`conditions`を広げ、`self: true`なら持ち主自身にも広げます(`enemies`では不可)。`when`は持ち主のシート上の値を`atLeast`か`atMost`で読むため、あるレベルでオーラを開けます。ダウンしている、倒された、または`cannot-act`の効果を持つ持ち主は何も広げません。オーラが広げるものは戦闘の進行に応じて付与され、両者が離れると外れ(ログは`aura`と`parted`を示します)、シートには決して書き込まれず、戦闘が終わると消えます。オーラが広げる状態は、独自のオーラを持てません。盤面がなければ、オーラはその側の全員に届きます。持ち主がすべての戦闘をその状態で始めるには、カタログの項目のmechanicsかステータスブロックに`keepsOn`を与えます。戦闘全体を通して保持する状態で、これもシートには書き込まれません。5eのAura of Protectionは、パラディンのCharismaをセーヴに加える状態を広げるオーラを持つ、保持し続ける`aura-of-protection`です。Holy Nimbusは敵へのオーラで、その状態は敵のターン開始時に被害を与えます。

強制された行動です(Capability API 1.264)。戦闘の状態は`behavior`を持て、持ち主がターンに何をするかを決めます。`only`は、ターンを終えること以外にそのターンでできることをすべて列挙します。`move`(歩行と起き上がり)、`escape`(拘束から振りほどく)、ルールセットが宣言する標準アクションです。空のリストではターンを終えることしかできません(Commandの停止)。`onlyWhenStuck`は、歩く場所がないときだけ許す標準アクションを指定します(Turn UndeadのDodge)。`moves: "away"`は、状態を付与した者から離れる方向にだけ歩き、1歩も近づかず、より遠くで終わります。`moves: "toward"`は近づく方向にだけ歩きます(Commandの接近、Sympathy)。`table`は持ち主の各ターンの開始時に振る`{dice, rows: [{atMost, does}]}`で、ロールがその値以下になる最初の行がターンを決めます。`wander`はd8で決めた方向へ移動速度いっぱいに歩いてターンを終え、`nothing`はターンを終え、`strike`はダイスで選んだ間合い内のクリーチャー(敵味方を問わず、誰もいなければ何もしません)への近接攻撃だけを許し、`normal`は、すべての行を上回るロールと同じく、ターンをそのままにします(Confusion、Mindfire)。ログはロールを`compelled`のイベントとして示し、それ以外の行動は`compelled`として拒否されます。状態を終わらせるセーヴは`at: "action"`にもでき、持ち主は自分のアクションを消費してそれを振ります(Irresistible Dance)。

オーラのさらなる機能です(Capability API 1.265)。オーラが状態を広げるか、被害を与えるか、セーヴを求める限り、オーラの`conditions`は任意になりました。`needs`は受け手が持つべき感覚を列挙し、持ち主も受け手も、`inside.conditions`がそれらの感覚を奪うゾーンの中にいてはいけません。Countercharmの`needs: ["hearing"]`はSilenceで止まります。`harms`の`{dice, flat, type}`は、持ち主自身の各ターンの開始時に、オーラが届く全員に持ち主が与えます(バロールのFire Aura)。`save`の`{save, difficulty, applies, seen?, immuneOnSuccess?}`は、オーラが届く全員が自身のターンの開始時に行います。失敗すると、持ち主からその難易度で`applies`が付与されます。`seen`は互いを見られる間だけ求め(バジリスクの凝視)、`immuneOnSuccess`は成功後、戦闘の残りの間その持ち主のオーラを受けないようにします(ピット・フィーンドのFear Aura)。セーヴ修正値の`against.casts`は、それらのカタログから発動されたもの(そのカタログから発動するアイテムの使用を含みます)に対するセーヴに絞り、さらにほかに指定したもので絞ります。フィーンドやアンデッドが発動した呪文に対するHoly Nimbusの有利は`against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`です。

強制された行動のさらなる機能です(Capability API 1.266)。`behavior`は`drops`の`{slots?, tags?, at, pickUp?}`を持てます。持ち主は、`slots`のどれかを占めるか`tags`のどれかを持つ着用アイテムと、`qualities`が`tags`のどれかを持つステータスブロックのアクションを落とします。状態の付与時(`at: "applied"`、Fearの「持っているものを落とす」)か、持ち主の各ターンの開始時(`at: "turn-start"`、Commandの「落とせ」)です。落ちたものは持ち主が立っていたマスにあります。そのアクションは持ち主のものでなくなり(`dropped`として拒否されます)、着用中に与えていたものを与えず、持ち主の防御へのその分の寄与も消えます(盾の2)。そのマスかその隣に立って、ターンに1回の無料の拾い上げで拾うか、状態が指定する場合は`pickUp`の行動枠で拾います。ログは`letFall`と`pickedUp`を示します。`onlyWhenStuck: "any"`は、状態が持ち主に歩くことを許す場所がない状態で始まるターンを、完全に持ち主自身のものにします(Fearの「移動できる場所がない場合を除く」)。`keepsOut`は、状態を付与した者からの距離です。その内側では持ち主はさらに離れる方向にしか歩けず、外側のどこかに届く間は外側でしか止まりません(Turn Undeadの「自分から30フィート以内の場所に自ら移動できない」)。状態を終わらせるセーヴは`unseen: true`にでき、持ち主が付与した者を見られない間だけ振ります(視線の外でのFearのセーヴ)。項目の`applies`は`destroysUpTo`の`[{tier, when?}]`を持てます。セーヴに失敗し、脅威段階が、使用者のシートで`when`が成り立つ最も高い`tier`以下のクリーチャーは、代わりに即座に破壊されます(Destroy Undeadは、クレリック5レベルでCR 1/2から、17レベルでCR 4まで)。キャラクターや段階のないクリーチャーは決して破壊されません。

あらゆる感覚による標的の選択、互いに近い標的、大きくなる範囲、追加の使用、手に持つものです(Capability API 1.267)。感覚を`needs`する項目やクリーチャーのアクションは`needsAny: true`を加えられます。そのいずれか1つを保つ標的は対象になり、すべてを欠く標的だけが拒否されます(Turn Undeadの「自分を見るか聞くことができる各アンデッド」)。`targetsWithin`は、選んだ標的のすべての組が収まるべき距離で、そうでなければ`targets-apart`として拒否されます(上位スロットのCommandの「互いに30フィート以内にいる」クリーチャー)。`area`は`sizePerCostStep`を持てます。コストを上げた1段階ごとにサイズが大きくなる距離です(Confusionの球体はスロット1レベルごとに5フィート大きくなります)。壁は決して大きくなりません。`use`を持つアイテムは`moreUses`の`[{label, use}]`を列挙できます。それぞれがアイテムと`label`の名前を持つ別のメニュー項目で、同じチャージを使い、アイテムとともに落とされます(複数の呪文を持つワンド)。クリーチャーは`held`の`[{label, tags, defense?}]`を列挙できます。自身のアクションではない手に持つもの(ステータスブロックに書かれた盾など)で、`drops`が`tags`のどれかを指定する状態は、タグの付いたアクションとともにそれらを落とさせ、拾うまでその`defense`はクリーチャー自身の防御から消えます。それぞれは落としたアイテムと同じく拾い上げます。

凝視と、届く相手によるオーラです(Capability API 1.268)。オーラは、項目と同じく読む`targetTypes`を持てます。その種類の者にだけ届きます(シー・ハッグのHorrific Appearanceは人型生物だけです)。`sourcesOf`は状態を指定し、持ち主にそれらのどれかを付与した者にだけ届きます(バーブド・デヴィルのBarbed Hideは、自分を掴んだ者に被害を与えます)。オーラの`save`は`failedBy`の`{atLeast, applies}`を持てます。その値以上の差で失敗すると、代わりにそれらを付与します(メデューサの凝視は、5以上の差で失敗すると即座に石化します)。`seen`のセーヴは`avert: true`を持てます。届く者は自分のターンに無償で持ち主から目をそらせます。再び見るまで(これも自分の自由な選択です)、そのセーヴを行わず持ち主を見られないため、持ち主への攻撃は見えない状態で行います。ログは`averted`を示し、ディレクターは、ほかに戦う相手が残っている間、自分のクリーチャーの目をそらせたままにします。状態を終わらせるセーヴは`seenLean`(`"advantage"`または`"disadvantage"`)を持てます。持ち主が状態を付与した者を見られる間はそのように振ります(シー・ハッグの繰り返しのセーヴは、ハッグが見えている間は不利です)。

スタッフは持ち主の数値で発動します(Capability API 1.269)。アイテムの`use`は、`saveDifficulty`の代わりに、`toHit.sheetBonus`と同じく値を読む`sheetDifficulty`で、持ち主のシートからセーヴ難易度を読めます(`{ "derived": "spell_save_dc" }`)。攻撃ボーナスは、能力値なしの`toHit.sheetBonus`(`{ "derived": "spell_attack" }`)で、すでに同じようにシートから読めます。`charges`を持つ使用は`chargeStep`の`{max, amount?, targets?}`を持てます。使用者は最大`max`個まで追加のチャージを消費でき、それぞれが上位コストの1段階として、上位スロットが`perCostStep`と`targetsPerCostStep`を加えるのと同じく`amount`と`targets`を加え、`sizePerCostStep`で範囲を大きくします(Staff of Powerの上位レベルの呪文、Staff of Strikingのチャージごとの1d6の力場)。メニューはそれらを`charges:<how many more>`という名前の支払いとして、アイテムにまだ残っている数だけ提示します。同じマイナーバージョンで、ルールセットが宣言できる状態は320に増え、オーラの`save`は`immuneWhenEnds: true`を持てます。失敗で付与されたものが、どのように終わっても(セーヴ、時間切れ、治療)、終わった後は、`immuneOnSuccess`がセーヴの成功後に防ぐのと同じく、戦闘の残りの間その持ち主のオーラを受けません(シー・ハッグの「成功するか、効果が終了した場合」)。

発動時に指定する種類です(Capability API 1.270)。`applies`を持つカタログの項目の`mechanics`は`kindChoice: true`を持てます。使用者は使用時に`combat.creatureTypes`の1つ(種類かタグ)を指定し、それは`kind-<id>`のモードとして提示され、付与したものはその種類を覚えます。付与したもののオーラで`chosenKind: true`を持つものは、その種類のクリーチャーにだけ届き、`orSeen: true`を持つものは、距離にかかわらず持ち主を見られる者にも届きます。そのため5eのAntipathyは、標的に状態を付与し、そのオーラ(`side: "all"`)は60フィート以内か視界内の選んだ種類を恐怖状態にし、恐怖状態の者は離れていきます(`moves: "away"`)。一方、Sympathyの魅了状態の者は近づいていきます。状態の`saveEnds`はルールセットの距離で`beyond`を持てます。そのセーヴは、持ち主が付与した者からその距離より遠くにいる間だけ振ります。`unseen`も併せると、視界の外にいる間だけです(Antipathyの「標的から60フィート以内にいない、または標的を見られない」)。

スタッフと指輪のさらなる機能です(Capability API 1.271)。アイテムの`use`は`label`を持て、`moreUses`の項目のラベルと同じく、アイテムの名前の横に表示されます(「Staff of Fire: Burning Hands」)。追加の使用は独自の`label`で名前が付きます。使用は、カタログの項目と同じく、持ち主のシートから読んで量に加える値である`amountAdd`を、戦闘中も戦闘外でも持てます(Staff of HealingのCure Woundsの`{ "abilityModFromField": "spellcasting_ability" }`)。`chargeStep`はルールセットの距離で`push`を持てます。追加のチャージごとに、使用自身の`push`に加えて、標的をその分だけ遠くへ押し出します(Ring of the Ramのチャージごとの5フィート)。アイテムの`charges.breaksOn`は`regains`の`{atLeast, amount}`を持てます。最後のチャージを使ったときにダイスが`atLeast`以上を示すと、アイテムは代わりに`amount`個のチャージを取り戻します(Staff of the Magiは20で1d12 + 1)。戦闘中、戦闘外、インベントリーがチャージを消費するときに働きます。決して壊れないアイテムなら、`atMost`は省略できます。

別のアイテムになるアイテムです(Capability API 1.272)。アイテムの`charges.breaksOn`は、`atMost`と並べて、ルールセットの別のアイテムを`<catalog>/<entry>`で示す`becomes`を持てます。壊れるはずの目が出ると、アイテムは代わりにそのアイテムになります(Staff of Strikingの魔法でないクォータースタッフや、+2だけを持つアイテムとして書いた、+2だけを保つStaff of Power)。戦闘中は、以後その使用がなくなって新しいアイテムとして打撃し、戦闘はそのスタックを、その名前でチャージなしのそのアイテムとして書き戻します。戦闘外とインベントリーがチャージを消費するときも、同じようにスタックが変わります。指定するアイテムは、どのカタログファイルにあっても、ルールセットの別のアイテムである必要があります。

命中時に消費するチャージです(Capability API 1.273)。武器の`attack.spends`は、その武器による打撃が命中した後に、持ち主がアイテムのチャージを消費する方法を最大4つ列挙します。それぞれ、`label`、消費する`charges`、打撃に加えるダイスと固定部分の`amount`、独自のダメージの`type`(指定しなければ武器のもの)を持ち、任意で`blow`(`melee`か`ranged`の打撃だけ)、`chargeStep`(追加で最大`max`個のチャージを使い、それぞれが`amount`を再び加えます。Staff of Strikingのチャージごとの1d6の力場、最大3つ)、`onHit`(命中した相手が受ける最大2つの状態で、それぞれ`rounds`、防ぐための`save`、または`saveEnds`を持ちます。Staff of WitheringのConstitutionのセーヴ)を持ちます。戦闘中は、その武器による持ち主自身の命中のときだけ、命中した相手が応じた後に、それぞれが持ち主へ提示されます。ダイスは打撃とともに振られてクリティカルで倍になり、アイテムの最後のチャージのダイスは使用と同じく振られます。アイテムはチャージを持ちます。

状態を付与した者から固定する数値です(Capability API 1.274)。項目が`applies`する状態は、付与時に付与者のシートから読む値参照である`value`を持てます(Heroismの`{ "abilityModFromField": "spellcasting_ability" }`)。戦闘の状態の`temporary`は、持ち主の各ターンの開始時か終了時(`at`)に一時ポイントを与えます。`dice`と`flat`に加え、`value: true`ならその値も加えます。`lostWhenEnds`があれば、状態の終了時に残りが消えます。ただし、持ち主がほかのものからそれより多くを得ている場合は消えません。オーラの`save.appliedDifficulty`は、持ち主にオーラの状態を付与したもののセーヴ難易度(付与時に固定)に対してセーヴを振ります(Antipathy/Sympathyの術者の呪文セーヴ難易度)。何も付与していないオーラには、その`difficulty`が引き続き使われます。`at: "damaged"`で状態を終わらせるセーヴは`bySource`を指定でき、状態を付与した者からの被害でだけ振ります(標的が持ち主を傷つけたときのSympathyのセーヴ)。状態の`behavior.keepsIn`は、付与した者からその距離以内に入った持ち主が、それ以上遠くへ歩けないようにします(Sympathyの「自ら離れることができない」)。また、アイテムの`use`は項目のmechanicsと同じく`kindChoice`を持てるため(1.270)、Antipathy/Sympathyのスクロールは使用時に種類を指定します。

終わらせるのではなく抑える状態です(Capability API 1.275)。`whileSourceInSight`と並べて、戦闘の状態の`orSourceWithin`(ルールセット独自の単位の距離)は、見えるかどうかにかかわらず、持ち主が付与した者のその距離以内にいる間、状態を保ちます。視界の外で距離の外なら抑えられますが、持ち主に付いたまま時間も進み、どちらかが成り立つとすぐに再び効果を持ちます(Antipathyの恐怖、60フィート以内か視界内)。戦闘の状態の`suppresses`は、その状態がある間に抑えるほかの状態を列挙します。それらの効果は止まりますが、付いたまま残り、その状態が終わると再び効果を持ちます(Calm Emotionsの魅了と恐怖、Mindless Rageの同様のもの)。

テレポートです(Capability API 1.276)。カタログの項目の`mechanics.teleport`、アイテムの`use.teleport`、クリーチャーのアクションの`teleport`は、使用者を`distance`(ルールセット独自の単位)以内の空いた場所へ即座に移動させます。間の歩はないため、離れるときに誰も打撃できず、着いた場所のゾーンは歩いて入ったときと同じく巻き込みます。盤面上でのみ働くため、`combat.distance`が必要です。盤面がなければ、テレポートするだけのアクションは提示されません。`seen`があれば、使用者が今見える場所だけです(壁、霧、目を奪う盲目は、その向こうのマスを一覧から除きます)。5eのMisty Stepは`{ "distance": 30, "seen": true }`です。`carries`(1～8)は、`carriesWithin`以内(省略時は接触)にいる、使用者以下の大きさの、使用者の側の自ら望むクリーチャーをその数だけ連れて行き、それぞれは余地がある限り使用者の近くに着きます。Dimension Doorは`{ "distance": 500, "carries": 1, "carriesWithin": 5 }`です。テレポートを持つクリーチャーのアクションは、クリーチャー自身に効果が及びます(ブリンク・ドッグのTeleport)。選択肢は行ける先のマスを`teleport.cells`として、一緒に行ける者を`teleport.carries`として列挙します。選択はマスを`at`として、同行者を`carries`として指定します。テレポートが範囲やリアクションになることはありません。

一度に6つの状態と、本当に見ることとしての視界です(Capability API 1.277)。`applies`は、カタログの項目のmechanics、アイテムの使用、クリーチャーのアクションで最大6項目を持てます(以前は4)。RageとFrenzyは、それぞれ4つに加えてMindless Rageの状態を加えます。また、`whileSourceInSight`(と、それに並べた`orSourceWithin`)は、オーラの`orSeen`と同じく、持ち主自身の視界を読むようになりました。盤面上の遮るもののない線は引き続き必要で、そのうえで持ち主は目か感覚で出所を見る必要があります。そのため、目を奪う盲目、視界を遮る霧、見通せる範囲を超えた暗闇、持ち主から見えない出所(不可視)は、壁と同じくどれもそれを断ちます。

Calm Emotionsです(Capability API 1.278)。セーヴは`alliesMayFail: true`を指定できます(カタログの項目、アイテムの使用、クリーチャーのアクションの`save`で)。使用者自身の側の標的はそれを受け入れて振らずに失敗し、ログがそれを示します。それ以外の者は通常どおり振ります。状態の`effects`は`cannot-target-source-side`を持てます。持ち主は、状態を付与した者にも、その側の誰にも何も向けません。ただし、その側が持ち主自身の側なら誰も除外しません。`endsWhen`は、`damaged`と`harmed-by-source-side`に加えて、さらに2つの終了条件を取り、最大4つすべてを指定できます。`attacked`は、誰かが持ち主に行う攻撃判定で、命中か外れかを問いません(ロールせずに命中するアクションは該当しません)。`ally-harmed-in-sight`は、持ち主が見ている、持ち主の側のほかの誰かへのダメージです(盤面上の遮るもののない線と、自身の目か感覚が必要です)。また、`endsWhenHarmedFrom`はカタログを列挙します。誰によるものでも、それらのいずれかから発動されたもの(スクロールの呪文や場に残ったゾーンを含みます)による持ち主への被害で状態が終わります。被害とは、`harmed-by-source-side`と同じく、ダメージか有害なアクションの標的になることで、まったく同じ状態を再び発動すると、終わらせずに更新します。これらはどれも、原因となった処理が終わるまで待ちます。また、持ち主自身の有効な状態が`suppresses`する状態は、その同じ状態が与える完全耐性ではもう終わらなくなりました。治るのではなく一時停止するため、恐怖への完全耐性を持つ激怒が始まったときにすでに付いていた恐怖は、激怒が終わると戻ります(5eのMindless Rage)。新しい恐怖は引き続き付与されません。

戦闘の外へのテレポート、見える同行者、煙です(Capability API 1.279)。`teleport`(カタログの項目、アイテムの使用、クリーチャーのアクションのもの)は、さらに3つのキーを取ります。`leaves: true`は、マスへ移動する代わりに、使用者を戦闘から完全に連れ出せます(ユニコーンの1マイル)。この場合、選択は`at`を指定せず(メニューには「Leave the fight」ボタンが表示されます)、使用者と同行者は生きたまま去ります(「Left the fight」と表示され、体力は保たれ、何も彼らを戻しません)。盤面がなければ、行き先は戦闘の外だけで、近くに誰が立っているかを測るものがないため、使用者の側に立っている誰でも同行できます。パーティーが戦闘から抜け、その一員がこの方法で去った場合は、逃走したことになります(結果は`fled`で、逃走と同じく戦闘を終えます)。この方法で去った敵は、打ち負かされたのでもまだ立っているのでもなく、逃げおおせたことになり、振り返りがそう示します。ディレクター自身のクリーチャーは、体力が4分の1以下になると、連れて行ける者を連れて去ります。`carriesSeen: true`(`carries`と併用)は、使用者が見える者だけを同行させます。ユニコーンの「見える自ら望むクリーチャー」です。`smoke`(`{}`か`{ "pierced": [senses] }`)は、使用者が離れたマスと着いたマスに雲を残し、着いた瞬間から使用者の次のターンの終わりまで、ゾーンの`obscures`と同じく視界を遮ります。Cape of the Mountebankの煙です。

打撃するテレポートです(Capability API 1.280)。クリーチャーのテレポートは、自身のアクションの1つを`strike`(その`id`)として指定できます。ブリンク・ドッグの「テレポートの前または後に、噛みつき攻撃を1回行える」です。テレポートすると、そのターンにそのアクションを1回無償で続けられ(メニューには「Free, part of the same action」と表示されます)、メニューは逆の順序も、テレポートの行動枠で「Bite, then Teleport」として提示し、その後にテレポートを1回無償で続けられます。どちらも3つ目には続きません。先に行う打撃は、自身のものに加えてテレポートの使用回数と再チャージも消費し、両方が残っている間だけ提示されます。打撃は同じクリーチャーの別の普通のアクションで、テレポート自体、連続行動、別のテレポート、リアクション、ポイントで購入するものは指定できません。打撃を指定できるのはクリーチャーのテレポートだけで、カタログの項目やアイテムの使用のテレポートでは拒否されます。距離を測らない戦闘ではテレポートはどこへも行かないため、何も組み合わせません。ディレクターもこれを使います。獲物まで歩くには遠すぎるクリーチャーは、同じターンにその隣へテレポートして噛みつきます。

吸収する打撃です(Capability API 1.281)。カタログの項目の`mechanics`やクリーチャーのアクションは`drain`を持てます。使用者は、抵抗を適用した後に打撃が各標的に与えたダメージに等しい体力を、端数を切り捨て、最大値を超えない範囲で回復し、標的の最大値からは何も引かれません(それには`reducesMax`を参照してください)。`share`(0より大きく1以下で、省略するとすべて)は回復する割合で、`damageType`はその種類のダメージだけを数えます。アボレスのPsychic Drainは`drain: {}`、Vampiric Touchは`drain: { "share": 0.5, "damageType": "necrotic" }`です。回復を止めるものは、これも止めます。吸収には戻すダメージが必要なため、`amount`のない項目、回復、`damage`のないクリーチャーのアクションでの吸収は拒否されます。

使用者を中心とするバーストです(Capability API 1.282)。`area`(カタログの項目かクリーチャーのアクションのもの)は`around: true`を指定できます。使用者を中心とする`size`のバーストで、決して狙いません。使用時に使用者から`size`以内にいる全員を巻き込み、`friendlyFire`がfalseでない限り敵味方を問いません(回復のものは使用者の側だけです)。使用者自身は決して巻き込みません。両者の間の壁はクリーチャーを守りますが、範囲が`throughWalls: true`も指定する場合は除きます。マミー・ロードのChannel Negative Energyの「障壁の向こうや角の先にいるものも含む」です。盤面のない戦闘では全員を巻き込みます。誰にも向けないため、ターン中と同じく、ターンの間に購入するシグネチャーアクションとしても働きます。使用者を中心とするのは単一のバーストだけで(`copies`は不可)、`throughWalls`は`around`とだけ併用でき、使用者の周囲の項目のバーストは即座に効果を与えるため、`zone`を残しません。Channel Negative Energyは、`signature: { "cost": 2 }`、`area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }`を持ち、`cannot-heal`の効果を持つ状態をマミー・ロードの次のターンの終わりまで`{ "rounds": 1, "of": "source" }`の間`applies`するクリーチャーのアクションです。ディレクターは、狙う形状を評価するのと同じく、巻き込む相手でこれを評価します。クリーチャーが自身の周囲に放ち、`zone`を残すバースト(クラーケンのInk Cloud)は、そのクリーチャーのターン中に使用しても、ターンの間に購入しても、クリーチャーから`size`以内のすべてのマスに配置され、`throughWalls`を指定していれば壁の向こうにも配置されます。それ以降、その場所でゾーンのトリガーが指定する者を巻き込みます。

伝説的な移動です(Capability API 1.283)。`signature`のコストを持つクリーチャーのアクションは、ほかに何もせず`move`だけを指定できます。作り手はターンの間に歩き、自身のターンの歩行と同じく盤面上のマスを選びます。その移動のためだけに貸し出される移動量を使うため、自身のターンの移動量には影響しません。`move: { "share": 0.5 }`は移動速度の割合(タラスクは「移動速度の半分まで移動する」)、`move: { "distance": 60 }`はルールセット独自の単位の距離、`move: {}`は移動速度のすべてです。`share`と`distance`の両方は指定できません。ほかの歩行と同じく、誰かの間合いを離れるときに打撃を受け、それを購入したウィンドウには、打撃が命中した後に再び尋ねます。`noOpportunity: true`は誰の機会攻撃も誘発しません(ヴァンパイアは「機会攻撃を誘発せずに移動速度まで移動する」)。`untouchable: true`は何にも傷つけられず拘束されない移動です(マミー・ロードのWhirlwind of Sand、`{ "distance": 60, "untouchable": true }`)。作り手を止めているものは先に放し、誰もそれを打撃せず、通過するゾーンや地形は何もしません。止められているクリーチャーや移動速度のないクリーチャーは、ほかの移動ではどこへも行けません。盤面がなければ何も提示されません。ディレクターはテレポートと同じくこれを購入します。ひどく傷ついたときに隣の敵から離れるためか、間合いに誰もいないときに敵に近づくためです。

伝説的な発動です(Capability API 1.284)。`signature`のコストを持つクリーチャーのアクションは、ほかに何もせず`casting`だけを指定できます。ターンの間に、作り手が自身のターンにアクションの`budget`で発動できる各呪文を、その`spellcasting`かシートの呪文から、「Cast a Spell: Fireball」のような名前で提示します。それぞれはクリーチャーのターンとまったく同じく狙い、支払い、解決し(標的、範囲のマス、いつもどおり消費するスロットや使用回数)、行動枠の代わりにポイントを消費するため、自身のターンはすべての行動枠を保ちます。`casting: { "cantripsOnly": true }`は初級呪文(どのプールからも支払わない呪文)だけを提示します。リッチのCantripは`signature: { "cost": 1 }`です。スフィンクスのCast a Spellは、`signature: { "cost": 3 }`を持つ`casting: {}`です。呪文が開くもの(Counterspell、それによる被害へのリアクション)はターン中と同じく応じられ、それを購入したウィンドウには、それらがすべて閉じた後に再び尋ねます。ディレクターは、ほかのシグネチャーアクションと同じく評価し、ポイントに見合う呪文のときに購入します。

アクションの後の移動と、1つの移動速度での移動です(Capability API 1.285)。何かをする(ダメージ、範囲、セーヴ、状態)シグネチャーアクションは、`move`も持てます。効果が先に適用され、その後、作り手はメニューが提示したマスのうち、アクションとともに選んだマスへ移動できます。何も選ばないことも選択で、効果の後に届かなくなったマスへは単に歩きません。`move`は`speed`(`walk`、`fly`、`swim`、`climb`、`burrow`)で移動方法を1つ指定することもできます。その場合、`share`はその移動速度だけから読み、その方法でだけ移動し、その移動速度を持たないクリーチャーはどこへも行けません。ドラゴンのWing Attackは、周囲のバースト(`area: { "shape": "burst", "size": 10, "around": true }`、そのセーヴと伏せ状態)に`move: { "share": 0.5, "speed": "fly" }`を加えたものです。「その後、ドラゴンは飛行速度の半分まで飛行できる」です。`move`は引き続き`teleport`、`sequence`、`reaction`、`charge`を持ちません。ディレクターは、敵の隣でひどく傷ついているときは打ち付けた後に飛び去り、間合いの外の敵には近づきます。

軽度の視界不良と風です(Capability API 1.286)。ゾーンの`obscures`やテレポートの`smoke`は`light: true`を指定できます。その場合は誰も隠さず、5eの薄暗い光やCape of the Mountebankの煙と同じく、それを通して、またはその中で見られる者を軽度に視界不良にするだけです(Engineはそのように見られる者を把握しており、HideとPerceptionがそれを読みます)。`dispersed: true`も指定できます。その場合、規則が`disperses: true`を示すゾーンは、すべてのアクションの後、両者が重なる場所でそれを、それを保つ集中とともに終わらせます。5eのFog Cloudは`obscures: { "dispersed": true }`、Gust of Windは`disperses: true`を持つゾーンです。Darknessはどちらも指定しないため、風はそれを残します。散らすだけのゾーンにトリガーは不要です。

Hide、Search、Detectです(Capability API 1.287)。`combat.hiding`は`hide`の標準アクションを実際に機能させます。`{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }`は`combat.checks`の2つと、任意で`passive`(10)、`lightly`(5)、音を立てる`combat.components`を指定します。Hideは戦闘自身のダイスで`stealth`を振ります。使用者は、自分をはっきり見ていない(壁の向こう、霧の中、不可視、または軽度の視界不良の中でしか見ていない)各敵のうち、Hideの合計がその受動Perception(`passive`に`perception`の判定を加え、軽度の視界不良の中でしか見ていない場合は`lightly`を引いたもの)に達する敵から隠れます。隠れている相手からは見えないため、その相手は何も向けられず、使用者はその相手を見えない者として攻撃し、`combat.sight.unseenAttacks`がその攻撃に有利を与えます。隠れた状態はターンをまたいで続き、次のときに終わります。使用者が攻撃する、対抗判定を行う、誰かを傷つける、セーヴを求める、`noisy`の構成要素を必要とするものを使うと、全員に対して終わります(音声の構成要素のない呪文や、霧を置くことでは隠れたままです)。また、どの処理の後でも、歩行のどのマスでも、使用者をはっきり見るようになった敵や、受動の値が合計を上回るようになった敵に対しては、その敵ごとに終わります。`search`の標準アクション(`combat.standard`に加えます。`combat.hiding`が必要です)は`perception`を振り、自分から隠れている者のうち、その合計に達する全員を見つけます。`search: true`を持つクリーチャーのアクションは同じことだけを行います。伝説的なDetectは`{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`です。クリーチャーは両方の判定を自身の`checks`から読みます。ディレクターは、すべての敵が自分から隠れているときにSearchを行い、誰か1人でも隠れているときはターンの間にDetectを使います。盤面がなければ、すでに隠す状態による場合を除いて誰も隠れられません。

Readyです(Capability API 1.288)。`combat.readying: { "budget": "reaction" }`はReadyアクションを実際に機能させます。使用者が今`standard`の行動枠で取れる各選択肢(攻撃、呪文、クリーチャーのアクション)と歩行について、メニューは2つの項目を提示します。敵が間合いに入ったとき(`comes`)と、敵が行動したとき(`acts`)のための待機です。1つを選ぶと標準の行動枠を消費し、使用者の次のターンの開始までその選択肢を保持します。敵の歩行がどの歩であれ、保持した選択肢をその敵に向けられる位置に来たとき(持ち主がそれを見ている場合)、または敵がそこで何かを終えたとき、ウィンドウが持ち主に尋ねます。持ち主は、`readied`という名前の選択肢を`budget`(5eのリアクション)で取るか、見送ってその歩行の間はもう尋ねられないかを選びます。保持した歩行は持ち主の移動速度いっぱいまで進み、その途中で間合いを離れると、ほかの歩行と同じく機会攻撃を誘発します。`"concentrates": true`(`combat.concentration`が必要です)なら、呪文は待機時に支払われ、集中で保持されます。発動時に再び支払うことはなく、集中を失うと呪文も失い、発動しなかった呪文は消費されたままです。それ以外の待機は、発動するまで何も支払いません。5eのものは`{ "budget": "reaction", "concentrates": true }`です。

ゆっくりとした拡散です(Capability API 1.289)。霧の`dispersed`は`true`の代わりに`{ "after": N }`にできます。その場合、届いた風は、最初に届いたターンから数えて、N回の完全なラウンドにわたって吹き続けた後にだけ霧を終わらせます。それまでに届かなくなった風(移動した、終わった、消えた)は、再び届いたときに数え直します。Gust of Windのような強い風で1ラウンド後に散る5eのStinking Cloudは`"obscures": { "dispersed": { "after": 1 } }`です。

隠れた者の捜索の評価です(Capability API 1.290)。スキルから読む戦闘の判定(`{ "skillMod": "stealth" }`)は、そのロールでそのスキルの判定と数えるようになったため、`skills`でそれに絞った変更がHide、Search、対抗判定に適用されます。重装鎧のStealthへの不利、Pass without Traceの+10、Eyes of the EagleのPerceptionへの有利などです。`combat.hiding.passiveMode`(5eでは5)は、有利のある受動Perceptionに加えられ、不利のある受動Perceptionから引かれます。これがなければ、受動の値はモードを読みません。変更`{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }`は、持ち主を見つけるための判定(敵の受動の値とSearchの両方)にそのモードを付けます。`mode`だけを取り、ほかは取りません。5eのCloak of Elvenkindです。Searchが、自分に対する振り方を変える者を見つけた場合は、その者のためだけに振り直し、ログはそのロールも示します。

クリーチャー独自の隠れ方と見方です(Capability API 1.291)。クリーチャーのアクションは許可にできます。`"standard": { "actions": ["disengage", "hide"] }`は、それらの標準アクション(`combat.standard`のもの)を、そのアクション自身の行動枠で取ることです。5eのゴブリンのNimble Escapeがボーナスアクションで行うのと同じです。`"while": "obscured"`なら、クリーチャーが霧や靄の中に立っているか、薄暗い光や暗闇の中で戦う戦闘でだけ有効です。シャドウのShadow Stealthです。クリーチャーの`checkModes`は、いくつかのスキルで自身の判定を2回振らせます。`{ "skills": ["perception"], "mode": "advantage", "sight": true }`は見えている間だけ(Keen Sight)、`"light": ["sunlight"]`があればその光の中でだけ(`"mode": "disadvantage"`を持つSunlight Sensitivity)、`"terrain": ["snow"]`があれば、指定した盤面のタイルや場所の種類でだけ有効です(Snow Camouflage。場所はタクティカル生成器のもので、雪、洞窟、山、水などです)。クリーチャーの`passive`は記載された受動Perceptionで、`hiding.passive`に判定を加えた値の代わりに使われます(`combat.hiding`が必要です)。戦闘の光はシーンの時刻から決まります。屋外の昼は日光、夜明けと夕暮れは薄暗い光、夜は暗闇で、屋内や、Engineが読める時刻が示されていない場合は日光ではない明るい光です。光が影響するのは、それを読むもの(これらのモードと`while: "obscured"`)だけです。`combat.sight.darkness`(1.294)がなければ、誰が誰を見られるかは変わりません。

隠れ方と隠れた者の見つけ方の、個々の手段です(Capability API 1.292)。カタログの項目の`mechanics.hiding`(`utility`を含むどの種類でも)とクリーチャーの`hiding`は、`combat.hiding`が実際に隠す場合に読まれる許可です。`"behindLarger": true`は、持ち主と見る者の間に、その間のすべての線上で立つ、少なくとも1サイズ大きい者の陰に持ち主が隠れられるようにします(ハーフリングのNaturally Stealthy。`combat.sizes`が必要です)。`"still": 10`は、隠れるときにStealthの合計にその値を加え、移動するかアクションを取ると再び引きます(レンジャーのHide in Plain Sight)。`"slow": "advantage"`は、このターンに移動速度の半分以下しか移動していない場合に、Hideを有利で振ります(シーフのSupreme Sneak)。`"aware": { "within": 10, "lostWith": ["deafened"] }`は、それらの状態のどれかを持たない限り、ルールセット独自の単位でその距離以内にいる者は誰も持ち主から隠れていないことを示します(ローグのBlindsense)。クリーチャーの`"starts": 15`は、受動Perceptionがその合計を上回らない者から、はっきり見えているかどうかにかかわらず、移動するまでその合計で、見通しのよい場所に隠れた状態で戦闘を始め、Hideアクションで再びその方法で隠れます(ゼラチナス・キューブのTransparent)。

クリーチャー自身の攻撃判定を2回振ります(Capability API 1.293)。クリーチャーの`attackModes`は、`checkModes`が有効になる場面で有効です。`{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }`は5eのSunlight Sensitivityで、見えていて、戦闘が日光の中で行われる間、攻撃が不利になります。各モードは`sight`、`light`、`terrain`で有効な場面を示します。モードはロールのほかの有利と不利すべてに加わるため、両者は引き続き打ち消し合います。

暗闇です(Capability API 1.294)。`combat.sight.darkness`があると、戦闘の光で目が見えなくなります。`{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`のように書きます。暗闇の中にいる者は見えず、薄暗い光の中にいる者ははっきり見えません。ただし、範囲内の`seeIn`の感覚は暗闇を薄暗い光として、薄暗い光を明るい光として見ます。範囲内の`blind`の感覚や`pierced`の感覚は、光にかかわらず見ます。暗闇を照らすものは次のとおりです。`carried`は、`seeIn`の感覚が届く場合を除き、シートで戦う全員が持つ光です(松明)。`light`は、状態(Lightの初級呪文)、アイテムの`worn`または`carried`の効果(ランタン)、クリーチャー(松明を持つ山賊、ファイアー・エレメンタル)に付けます。それぞれルールセット独自の距離で`{ "bright": N, "dim": N }`を指定し、その距離まで明るい光、さらに同じ距離まで薄暗い光になります。壁は光を遮り、倒された者は光を発しません。暗闇が有効な場合、光を読むものはすべて、誰かが立っている場所の光を読みます。誰が誰を見るか(見えない者への攻撃、隠れること、見えるクリーチャー)、視界不良の中に立つこと(`while: "obscured"`)、クリーチャーの`checkModes`と`attackModes`です。洞窟やダンジョンでの戦闘は、どの時刻でも暗闇の中で行われます。

明かりを消して再び灯すことです(Capability API 1.295)。`carried`の光を持つ者は、メニューにその切り替えを持ち、その`label`で名前が付きます(`"Torch"`。指定がなければ「Light」)。`budget`を指定していればそれを消費し、そうでなければ1ターンに1回無料です。消えた光は何も照らさないため、持ち主は暗闇で見えないままでいられます。再び灯すと見えるようになり、隠れていた場合は見つかります。`toggle`を持つアイテムは、覆い付きランタンと同じく、オンの間だけ効果の`light`を発します。

クリーチャーとアイテムによる光の切り替えです(Capability API 1.296)。`"sheds": { "bright": 10, "dim": 10 }`を持つクリーチャーのアクションは、以後使用者が発する光を設定し、`"sheds": "out"`はそれを消します。ほかには何もせず、誰にも向けません。マグミンのIgnited Illuminationはボーナスアクションでの2つのそのようなアクションで、ウィル・オ・ウィスプのVariable Illuminationは届く距離ごとに1つのアクションです。`"unlit": true`を持つクリーチャーは`light`を消した状態で戦闘を始め、灯すには自身のアクションの1つが必要です。アイテムの`toggle.offLight`は、オフの間に効果の光の代わりに発する光です。覆いを下ろした覆い付きランタンは`{ "bright": 0, "dim": 5 }`を発します。明るい光の届く距離がない光は、手に持っている場所でも薄暗い光だけを発します。

ゾーンからの光と、暗闇を終わらせる光、不可視の者を見せる光です(Capability API 1.297)。呪文のゾーンの`lights`(ほかの`light`と同じくフィートで書きます)は、ゾーン自身のマスにだけ光を発し、その中心から測ります。中心は、バーストを発動した地点か、術者が保持するゾーンなら術者です。そのため、ブルズアイ・ランタンは術者に固定した60フィートのコーンで、`"lights": { "bright": 60, "dim": 60 }`を持ち、後ろは何も照らしません。Dancing Lightsは`{ "bright": 0, "dim": 10 }`を持つ1つの動く地点のゾーンです。`"obscures": { "darkness": true }`を持つ視界を遮るゾーンは魔法の暗闇で、`"dispelsDark": { "upTo": 3 }`を持つゾーンは、どちらかが発動されたとき、そのマスが接するそのような暗闇のうち、スロットがそのレベル以下のものをすべて終わらせます。Daylightです。ゾーン、アイテムの効果、状態、クリーチャーに付けた`"reveals": true`の光は、その明るい光の中に立つ、状態によって見えなくなっている全員を見せます。lantern of revealingです。これらのどれにもCapability API 1.297が必要です。

状態で隠れる光と日光です(Capability API 1.298)。クリーチャーの`"lightOutWhile": ["invisible"]`は、それらの状態のどれかが付いている間、アクションが最後に何を設定したかにかかわらず自身の光を消し、状態が終わると元に戻します。ウィル・オ・ウィスプのInvisibilityは光も隠します。クリーチャー、アイテムの効果、状態、ゾーンに付けた`"sunlight": true`の光は、その明るい光を日光にします。判定や攻撃のモードの`"light": ["sunlight"]`が読むのはこれです。Sunlight Sensitivityに対するsun bladeがその例です。その日光は、すでに明るい盤面でも数えられます。

光に対する魔法の暗闇です(Capability API 1.299)。`"dispelsLight": { "upTo": 2 }`を持つ魔法の暗闇のゾーン(`"obscures": { "darkness": true }`)は、両者が接する場所で、どちらが先に来たかにかかわらず、そのレベル以下の呪文が作った光を消します。ゾーンの`lights`や、呪文が付与した状態の`light`で、後者は集中で保持されている場合はその集中とともに終わります(5eのFlame Bladeに対するDarkness)。戦闘の光にかかわらず、魔法の暗闇のマスを照らすのは魔法の光だけです。ゾーンや状態への呪文の光は常に魔法の光で、そのほかの光は`"magical": true`を示す場合に魔法の光です(sun bladeのもの)。暗闇の中の松明はそこでは何も照らしません。`"within": 60`を持つ`dispelsDark`は、その中心からその距離以内の暗闇だけを終わらせます。Daylightの明るい球体で、その外側の薄暗い光は含みません。これらのどれにもCapability API 1.299が必要です。

上位コストの増加を、一定の段階ごとにだけ行います(Capability API 1.300)。`"perCostStepsEvery": 2`は、上位コストの1段階ごとではなく2段階ごとに1回`perCostStep`を加えます。状態が与えるアクション(1.236)は、その状態を付与した呪文が支払われたコストに応じて、自身の`perCostStep`、`perCostStepsEvery`、`perCostStepsMax`で増えるようになりました。5eのFlame Bladeの打撃は`"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`を持つ`3d6`なので、4レベルのスロットで呼び出した刃は4d6で打ちます。`perCostStepsEvery`を使うにはCapability API 1.300が必要です。

誰かとともに運ばれるゾーンと、離して置くコピーです(Capability API 1.301)。ゾーンの`"carried": "any"`は、誰かが立っているマスに置いたバーストを、その者を中心として、その者の行く先々について行かせます。5eの、手に持つ物体にかけたDarknessやDaylightです。`"own"`なら、術者自身の持つ物体にしかかけられない呪文のために、術者が立っているマスだけを数えます。空いたマスに置くと、そこに留まります。運ばれるゾーンは一点の単一のバーストで、自ら動かされることはありません。範囲の`"copiesWithin": 20`は、`copies`を接して置く代わりに、各中心が別のコピーの中心から20フィート以内になるように置きます。術者が`move`できるコピーのゾーンは、すべてを同じように動かします。5eのDancing Lightsは、`"copies": 4, "copiesWithin": 20`と`"lights": { "bright": 0, "dim": 10 }`を持つ10フィートのバーストです。どちらにもCapability API 1.301が必要です。

別の項目を変える項目です(Capability API 1.302)。`"amends": [{ "entry": "spells/eldritch-blast", ... }]`を持つ、シートのリストで保持する項目は、持ち主がその項目を使うたびにそれを変え、複数の変更は重なります。`"damageAdd"`(`{ "abilityMod": "cha" }`のような値)は、命中ごとにそのダメージに加えます。Agonizing Blastです。`"range"`(ルールセットの距離)は、それが遠い場合に射程になります。Eldritch Spearの300フィートです。`"push"`は命中した者をその距離だけ真っすぐ押し出し、`"pushOptional": true`は「Eldritch Blast (no push)」としても提示します。Repelling Blastです。射程や押し出しには`combat.distance`が必要で、指定した項目が存在する必要があります。Capability API 1.302が必要です。

特定の光の中でだけの使用と、移動や行動で終わる状態です(Capability API 1.303)。`"usableIn": { "light": ["dark", "dim"] }`を持つ項目は、使用者がそれらの光の中に立っている間だけ提示されます。One with Shadowsです。状態の`endsWhenHolder`は、`attacks`と`casts`に加えて、`"moves": true`(持ち主が移動すると終わる)や`"acts": true`(持ち主がアクションを取るか、攻撃するか、発動すると終わる)も指定できます。じっとしているウォーロックを影が隠します。Capability API 1.303が必要です。

休息までクリーチャーごとに1回です(Capability API 1.304)。`"oncePerTarget": { "until": "long" }`(ルールセットが宣言する休息)を持つ項目は、間に何回戦闘があっても、使用者がその休息を取るまで、すでに使ったクリーチャーに対しては提示されません。Chains of Carceriです。誰に使ったかは使用者のライブのシートに名前で保持され、その休息だけがそれを消去します。範囲や使用者自身に向ける項目には使えません。Capability API 1.304が必要です。

シートとともに増える標的と、同じ標的への再選択です(Capability API 1.305)。`"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }`は、`scales`がダイスを加えるのと同じく、読む値の各段階でその数の標的を加えます。`"targetsRepeat": true`なら同じ標的を複数回選べ、各選択はそれぞれ独自のロールを持つ独立した攻撃で、項目を変更するすべてを持ちます。eldritch blastの光線で、それぞれにAgonizing Blastのダメージと、Repelling Blastの押し出しが付きます。戦闘の標的選択は、余地がある間クリックごとに光線を1本加え、戦闘員を操作するEngineは、残った光線を選んだ相手に向けます。どちらも、範囲や使用者自身に向ける項目には使えません。Capability API 1.305が必要です。

手に呼び出す武器です(Capability API 1.306)。`"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }`を持つ`"utility"`の項目は、それらの近接武器の1つを戦闘の残りの間、使用者の手に置きます。武器のモードと同じく使用時に選びます。`binds`は、一致する手持ちの各武器も提示し、選ぶとその武器がこれとして数えられます。`proficient`があれば習熟して使い、その打撃は`qualities`を持ちます。別の使用はそれを置き換え、結び付けた武器は元に戻ります。呼び出す項目への変更は武器にも届きます。変更の`"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }`は命中時に独自の種類のダメージを加え(Lifedrinker)、`"strikes": 2`は攻撃の行動枠1回の消費でその数の攻撃を購入できるようにします(Thirsting Blade)。戦闘員を操作するEngineは、最も強く打つ武器を1回手に置きます。Capability API 1.306が必要です。Pact of the Bladeです。

使用者自身が保つものです(Capability API 1.307)。クリーチャー自身のアクションは、カタログの項目と同じく`"concentration": true`を指定できます。付与したものはその集中が終わると終わり、ダメージは通常どおりその集中を試します。インプやクァシットのInvisibilityです。状態の`endsWhenHolder`は`"uses": ["scare", "spells/bolt"]`も指定できます。持ち主がそれらのどれかを使うと終わります。クリーチャー自身のアクションはIDで、カタログの項目は`<catalog>/<entry>`で指定します。クァシットの不可視は、Scareを使うと終わります。項目の`"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]`は、標的に何が起きても、使用時にそれらの状態を使用者自身に付与します。集中を持つ場合はその集中で保持され、発動したレベルで付与されます。Sunbeamの光の粒で、後の光線のために`light`と`"actions": ["spells/sunbeam-line"]`を持つ戦闘の状態です。常に不可視のクリーチャーには新しいものは何も要りません。`keepsOn: ["invisible"]`(1.263)が付けたままにします。Capability API 1.307が必要です。

1.303～1.306の残りです(Capability API 1.308)。スクロールやワンドの`use`は、使用者のシートから読む`targetsScale`と`targetsRepeat`を持てます。eldritch blastのスクロールは読み手の5レベルで光線が1本増え、ワンドのダーツはすべてを1体のクリーチャーに向けられます。Capability API 1.308が必要です。次の3つの変更には新しいキーは要りません。リアクションは行動です。`endsWhenHolder`が`"acts": true`を示す状態は、持ち主が取るどのリアクションでも終わります。One with Shadowsが「リアクション」で終わるのと同じです。`oncePerTarget`は同じ名前の2体のクリーチャーを区別します。一方のインプへのChains of Carceriはもう一方のインプを除外せず、後の戦闘のインプが除外されるのは、その名前がその1体のクリーチャーのものだった場合だけです。手に呼び出す武器(1.306)は、投擲できる近接武器(短剣やジャベリンのように、`reach`と`range`の両方を持つ攻撃)でもかまいません。戦闘のメニューからアクションなしで消せ、作り手が死ぬと消えます。戦闘で手から離れることはないため、作り手から5フィートより遠くに離れることはありません。

隠れるための条件、Feral Senses、不意打ち、結び付けの儀式です(Capability API 1.309)。`still`を持つ`hiding`は`"stillWhile": { "holds": "camouflaged", "wall": true }`を指定できます。ボーナスは、持ち主がその状態(1分のutility項目で事前に作るか、戦闘前に設定する迷彩)を持ち、`wall`があれば視線を遮るマスの隣に立っている間だけ数えます。これがHide in Plain Sightです。`"unseenStrikes": true`は、持ち主が見えない相手を攻撃するときの不利をなくします。Feral Sensesの前半です。後半には何も要りません。戦闘は、隠れていないすべてのクリーチャーの位置をすでに把握しているためです。`starts`を持つクリーチャーの`hiding`は`"surprises": true`を指定できます。ゼラチナス・キューブのTransparentと同じく、隠れた状態で戦闘を始めた相手は、不意を突かれた状態で戦闘を始めます。`binds`を持つ`conjures`は、`"boundIn"`でライブのテキストフィールドを指定できます。そこに書かれた手持ちの武器だけが結び付けられ、空の間は何も結び付けられません。そこに名前を書くことが、戦闘外の小休憩中に行う1時間の儀式にあたります。Capability API 1.309が必要です。

繰り返しと、距離で終わる状態です(Capability API 1.310)。集中する項目のmechanicsは`"repeats": { "budget": "action" }`を指定できます。使用者がそれに集中している間、その効果はその行動枠で再び提示され、シートからは何も消費せず、新しい集中を始めず、使用者に何も再付与せず、発動時に支払ったレベルとコスト段階で働きます。メニューには「Vampiric Touch again」と表示されます。`"notSaved": true`は、この発動に対するセーヴに成功したクリーチャーには決して提示しません(Eyebite)。`"sameTargets": true`は、発動時に狙った相手にだけ提示します(ボーナスアクションのHeat Metal)。`repeats`には`concentration`と既知の行動枠が必要です。`applies`は`"endsAway": { "beyond": 60, "unseen": true }`を指定できます。持ち主が付与した者からその距離より遠くに立ち、`unseen`があればその者を見られなくなると、状態が外れます。これがEyebiteの恐慌です。誰の歩行であれ歩行の各歩と、各ターンの終わりに確認します。Capability API 1.310が必要です。

1.307と1.309の残りです(Capability API 1.311)。アイテムの`use`は、項目のmechanicsと同じく`appliesSelf`を持てます。Sunbeamのスクロールは、光の粒と、それとともに後の光線を、読み手の手に残し、読んだときの集中で保持されます。クリーチャーのアクションは、`"dyingOnly": true`(体力が0でまだ生きているクリーチャーだけを選べます)、`"slaysOnFailedSave": true`(アクション自身のセーヴに失敗した標的は死亡します)、`"healsOnSlay": { "dice": "3d6" }`(死亡した1体ごとにクリーチャーがその分回復します)を指定できます。これがウィル・オ・ウィスプのConsume Lifeです。`slaysOnFailedSave`には`save`が、`healsOnSlay`には`slaysOnFailedSave`が必要です。`combat.conditions`の規則は`"endsWhenHolder": { "moves": true, "acts": true }`を指定できます。どのように付与されたものでも、持ち主が最初の一歩を踏み出すか(`moves`)、Hide以外の何か(リアクションを含みます)をすると(`acts`)、状態が持ち主とそのシートから外れます。これが、戦闘前にシートでチェックするHide in Plain Sightの迷彩です。Capability API 1.311が必要です。

命中の周囲の雷鳴です(Capability API 1.312)。武器のモードは`"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`を指定できます。そのモードで命中すると、命中した相手と、その相手から`within`以内に立つ全員が、セーヴするか`condition`を受けます。その距離に立っていれば、味方や使い手も含みます。`rounds`は対象自身のターンで数え、`of: "source"`なら使い手のターンで数えるため、`rounds: 1, of: "source"`は「次のターンの終わりまで」です。`of`には`rounds`が必要です。盤面がなければ、命中した相手だけがセーヴします。モードの`range`と`charges`と合わせると、これがチャージを使って投げるHammer of Thunderboltsです。そのGiant's Baneは、`when: "critical"`を持つ武器の`slay`です。Capability API 1.312が必要です。

Maze、Expeditious Retreat、発動の選択肢、上限付きの能力値の加算です(Capability API 1.313)。`while`を持つ`dismisses`は`"turns": true`を指定できます。クリーチャーは戦闘の外にいますが、引き続きターンを取り、そのターンには、自分を遠ざけている状態を終わらせるものか、ターンを終えることだけが提示されます。`applies`は`"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }`を持てます。持ち主は標準の行動枠を消費して、その数値に対する`combat.checks`のその判定を行い、状態を終わらせられます。`passes`に該当するクリーチャーはロールせずに成功します。これらを合わせると5eのMazeとそのミノタウロスになり、判定に成功すると元の場所に戻ります。項目のmechanicsは`"takes": ["dash"]`(または`disengage`、`dodge`)を指定でき、使用者は使用時にそれらの標準アクションを取ります。Expeditious Retreatは発動時にDashします。その後のボーナスアクションのDashは、その状態の`grants`によるものです。`repeats`は`group`を指定できます。1つのグループの項目は1回の発動の選択肢で、そのいずれかに集中している間は、そのすべてが再び提示されます。Eyebiteの睡眠、恐慌、不調と同じく、`notSaved`と発動のレベルは共有されます。アイテムの能力値の変更`{ "add": 4, "max": 30 }`は、すべての`set`が残す能力値に`max`まで上乗せし、すでにそれを上回る能力値を下げることはありません。`max`がなければ、加算は以前と同じく働きます。アイテムの`"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }`は、同じキャラクターが各グループのアイテムを1つずつ着用している間だけ結び付けられるようにし、そのアイテムが結び付ける場所で結び付け、そのどれかが外れるか、結び付けが解かれるか、袋から出ると、すぐに結び付けを解きます。`"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }`と合わせると、これがHammer of Thunderboltsです。Capability API 1.313が必要です。

Resilient Sphereです(Capability API 1.314)。`combat.conditions`の項目は`"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`を持てます。状態がある間、持ち主はほかの全員から隔離されます。ほかの誰も持ち主に何も向けられず、範囲やバーストは持ち主を素通りし、ゾーンやオーラも含め、ほかの誰からのものも持ち主を傷つけず、回復させず、状態を付与しません。持ち主のものもほかの誰にも届かず、移動するときに誰も持ち主を打撃せず、持ち主も誰も打撃しません。持ち主自身の移動量は0ですが、`rolls`があれば、その行動枠を消費して移動速度の`share`まで移動できます。`lifted`があれば、隣に立つ者がその行動枠を消費して持ち主を持ち上げられます。その後、持ち主は、運び手が下ろす(無料です)か状態が終わるまで、運び手が歩くところへついて行きます。`brokenBy`の項目は引き続き持ち主に向けられ、その効果の代わりに、状態とそれを保つ集中を終わらせます。球体へのDisintegrateです。項目のmechanicsは`combat.sizes`の1つである`"targetsUpTo": "large"`を指定でき、そのサイズ以下のクリーチャーにだけ向けられます。これがResilient Sphereの「Large以下」です。Capability API 1.314が必要です。

住処アクションです(Capability API 1.315)。クリーチャーのアクションは`"lair": true`を、クリーチャーは`"lairInitiative"`(省略時は20)を持てます。クリーチャーが住処で戦っている間(その敵へのGMの`"inLair": true`か、遭遇の`inLair`リスト)、戦闘のカウントが住処の数値を過ぎるときに、1ラウンドに1回住処アクションを行い、同値では負けます。その数値が間に入る2つのターンの間、全員がその数値以上ならラウンドの最後のターンの後、全員がそれ未満なら最初のターンの前です。同じ住処アクションを2ラウンド続けて行うことはできません。住処アクションは自身のターンと同じく狙って解決し、その`budget`はそのために貸し出されるため、クリーチャー自身のターンからは何も消費しません。クリーチャー自身のターンのメニューに出ることはなく、クリーチャーがダウンしているか行動できない間は行いません。住処アクションはリアクションでもポイントで購入するものでもなく、連続行動が指定することもありません。`lairInitiative`には少なくとも1つの住処アクションが必要です。5eのドラゴンはイニシアチブ・カウント20で住処アクションを行います。

小道具です(Capability API 1.316)。盤面上の戦闘には、壊せる小道具を置けます。遭遇の`board.props`か、描いたワールドの戦場の`props`です。それぞれ`label`、占める`cells`、`health`、`defense`(省略時は10)を持ち、任意で`resist`、`vulnerable`、`immune`のダメージの種類を持ちます。`blocks`は、小道具がある間、そのマスを歩行(`move`)、視線(`sight`)、またはその両方に対して閉じ、誰もその中で戦闘を始めません。`fragile`の小道具は、命中するどんなものでも壊れます。壁の区画を攻撃できる攻撃は、代わりに小道具を攻撃できます。小道具は選択肢の`walls`に列挙され、選択の`wall`がそのマスを指定します。範囲は届くすべての小道具を巻き込み、ほかの全員に対して振ったのと同じダメージを与えます。小道具は決してセーヴしません。0になった小道具は壊れ、もう何も閉じず、そのラベルが盤面の`broken`リスト、戦闘の要約、GMが読む振り返り(`Broken: Sluice Gate; Oil Jar`)に加えられます。物語の`broke`トリガーがそれで発動します。

Legendary Resistanceです(Capability API 1.317)。クリーチャーの`"legendaryResistance": 3`は、1回の戦闘で最初の3回の失敗したセーヴを成功に変えます。5eの「ドラゴンがセーヴィング・スローに失敗したとき、代わりに成功することを選べる(1日3回)」です。Engineは、状態が自動的に失敗させるセーヴも含め、どのセーヴでも常にそれを選びます。クリーチャーがダウンしている間は選びません。セーヴは振ったとおりに記録され、続いて代わりに成功したことと残り回数を示す行が記録されます。値は1～20の整数です。

アイテムの使用も`"targetsUpTo"`を持てます(Capability API 1.317)。項目のmechanicsが1.314から持てるのと同じです。Resilient Sphereのスクロールの`"targetsUpTo": "large"`は、そのサイズ以下のクリーチャーにだけ届きます。`combat.sizes`を読み、範囲ではなくクリーチャーに向ける使用向けです。

盤面のイベントと茂みです(Capability API 1.318)。戦闘の盤面は、ラウンドの経過とともに自ら変化できます。遭遇の`board.events`か、描いたワールドの戦場の`events`です。各イベントは`id`と任意の`label`を持ち、`at`で`"round-start"`か`"round-end"`に起こり、`from`のラウンドから(省略時はラウンド開始なら2、終了なら1)、`every`のラウンドごとに(1)、指定があれば`until`のラウンドまで起こります。`where`はそのマスを指定します。`cells`、`block`(`x`、`y`、`w`、`h`)、マス(`x`、`y`)を囲み、最初は`start`マス、以後は毎回さらに`step`マス広がる`ring`、同じ`start`と`step`で1つの端(`from`に`north`、`south`、`east`、`west`)から内側へ進む`sweep`、または茂みに隣接するすべての空いたマスである`{"spread": "growth"}`です。環や掃引は、最初も含め、深さ`step`マス(最低1)の最も新しい帯にだけ届くため、`start`が3の環は中央をそのままにします。`filled`は内側のすべてに届きます。`onlyOn`は、それらの地形のマスに限ります。`change`はそこで起こることを示し、次のうち少なくとも1つです。`terrain`、`height`(0～3)、`light`(`bright`、`dim`、`dark`、`sunlight`、`clear`)、`obscured`(`light`、`heavy`、`clear`)、`growth`(trueかfalse)、`season`(名前か、外すならnull)、`rotate`(正方形の`block`のみ。タイル、高さ、地面、完全にその中にある小道具、完全にその中に立つ者とともに、時計回りに1、2、3回の4分の1回転をします)、そして通常の行の代わりにログが示す行である`tell`です。誰も立てない場所(割れて水になった氷)に残った者は、最も近い空いたマスに移されます。盤面は最大32個のイベントを持てます。

運ばれることです(Capability API 1.329)。盤面のイベントの`change`は`push`も指定できます。`{"toward": "east", "squares": 3}`(端は`north`、`south`、`east`、`west`で、1～6マス)のように書きます。そのマスの地面に立つ者は、その方向へ1マスずつ運ばれます。盤面の外、壁や閉じた小道具の中、誰も立てない地面、ほかの者の中へは決して運ばれず、それで誰かに打撃されることもありません。その端に最も近い者から先に運ばれ、空中にいる者はそのままです。ログは誰を運んだかを示します。The Mill of Hoursの水路です。または同じ形の`drift`もあります。そのマスの視界を遮るもの(軽度でも重度でも)がその方向へ吹き流され、`block`の反対側から、ほかの`where`なら盤面の反対側から戻ってきます。マスのほかのものは動かず、軽度のものが吹き寄せられても重度のものはそのままです。The Leaffallの吹き寄せです。描いた戦場のイベントは両方を取れます。

茂みのあるマスは、入るコストが2倍で(ほかの移動困難な地形を超えません)、その中に立つ者を軽度に視界不良にします。茂みを切るダメージの種類(盤面の`growth.cutBy`が別に示さない限り斬撃)の打撃は、届く茂みのマスに向けられ、選択肢の`walls`に列挙されます。ロールなしでそのマスを切り開き、アクションを消費します。茂みを焼くダメージの種類(`growth.burnedBy`が別に示さない限り火)のダメージは、着弾したすべてのマス(範囲の届く全体か、命中した者のマス)の茂みを焼き払います。`"clears": "growth"`と`area`を持つ項目のmechanicsやアイテムの使用は、その範囲の茂みを取り除きます。剪定ばさみは`{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`です。遭遇の`board.ground`は、開始時にマスに茂み、光、視界不良、季節を描きます。ワールドの戦場は、茂みを`g`と`.`の`growth`の行として、季節をExperiencesと同じように描きます。

日陰、光の規則、チャイム、光を嫌う者です(Capability API 1.319)。`"shade": true`を持つ光は日陰を作ります。その`dim`が届く範囲は薄暗い光になり、そこでは、ほかの何が照らしていても、明るい光や日光も薄暗くなります。明るい光は持たず、`reveals`でも`sunlight`でもありません。日陰が魔法の暗闇の中に届くことはありません。ショーケースのLantern of Duskは、`{"light": {"bright": 0, "dim": 15, "shade": true}}`で持ち運ぶアイテムです。マス自身の光(1.318)と日陰は、そこで目が読むものでもあります。明るい盤面でも、暗いマスに立つクリーチャーは、暗闇で見える感覚でしか見えません。

戦闘の盤面は光の規則を持てます。遭遇の`board.lightRule`か、描いたワールドの戦場の`lightRule`です。各ラウンドの終わりに、その光(`in`。指定がなければ明るい光と日光で、明るい光は日光を含みます)の1つの中に完全に立っている全員は、そこでのラウンド終了を1回数え、`rounds`回目(指定がなければ1)ごとに、その`tracks`が`by`だけ動き、その`applies`の状態が付与されます。外に出ると、1マスの日陰に入るだけでも数え直しになります。`spares`は、決して影響しないクリーチャーの`types`と`tags`を指定します。シートが持つトラックを動かさず、戦闘が知る状態も付与しない規則は何もしないため、取り除かれます。Noonfieldは`{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`で、日なたに1分いると消耗が1段階増えます。

光の規則のセーヴです(Capability API 1.321)。光の規則の`save`(`save`、`difficulty`)は、影響を受けそうな各クリーチャーが振り、成功すれば今回は免れます。どちらの場合も数え直しになります。その`against`(戦闘が知る`conditions`、`damage`の種類)は、そのセーヴが何に対するものと数えるかを示すため、一致する`against`を持つセーヴ修正値が適用されます。`{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`で着用または携帯する麦わら帽子がその例です。トラックの項目の`upTo`は、規則がそれを動かす上限で、それを超えるはずの消耗はそこで止まり、上限に達するともう加わりません。書かれたとおりのNoonfieldは`{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`で、帽子が指定するための`noon_light`の状態をExperienceが加えます。

リアクションとしてのアイテムの使用です(Capability API 1.322)。アイテムの`use`(またはその`moreUses`の1つ)は、カタログの項目と同じ書き方で`reaction`を持て、その場合はその瞬間が開いたときだけ提示され、ほかの使用と同じく、`budget`(持ち主のリアクション)と、チャージかアイテム自体で支払います。Liesl's Coffinは、1日1回、持ち主から5フィート以内のクリーチャーが命中を受けたとき、その命中に対しても、持ち主の次のターンの開始までそのクリーチャーにAC+5を与えます。`"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}`を持つアイテムに`{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}`を付けます。The Straw Proxyは、所有者を狙った攻撃を失わせ、身代わりは燃え尽きます。`{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`です。アイテムの使用はその瞬間を指定します。`"reaction": true`は拒否されます。

Held Groundと刈り取りです(Capability API 1.323)。戦闘は、死が留め置かれる場所であるHeld Groundで行えます。物語の地域の規則が渡す、戦闘の`heldGround`(`label`、`condition`、`[{"track", "by"}]`の形の`marks`)です。そこでは、体力がなくなった者は、死亡やダウンの代わりに倒れ伏します。敵は戦闘から脱落し、キャラクターは安定した状態で横たわり、死亡のロールを振らず、傷を受けても失敗を受けず、通常どおり回復できます。倒れ伏した者はその`condition`(キャラクターはルールセット自身のダウン状態も)を受け、シートを持つ者はそれぞれ`marks`のトラックを動かします。ショーケースのOwingの印です。即死させるものも、代わりに倒れ伏させます。クリーチャーのアクションやアイテムの攻撃で`reaps`する打撃は、倒れ伏させた者を刈り取ります。その者はダウンしたままで、状態も印も受けず、刈り取られたキャラクターは死亡します。Reaping Hookは、`attack`に`"reaps": true`を持つ武器です。倒れ伏した戦闘員と刈り取られた戦闘員は`felled`と`reaped`を持ち、物語が後で倒れ伏した者を蘇らせるために使います。

Held Groundの解除です(Capability API 1.330)。物語は、年が変わるときのように、戦闘の途中でHeld Groundを解除できます。ディレクターの`releaseRulesetHeldGround(definition, state, release)`(その下では共有の`rulesetReleaseHeldGround`)です。以後、体力がなくなった者は、ほかの場所と同じく死亡するかダウンします。刈り取られていない倒れ伏した者は、敵もキャラクターも死亡します。ただし、`release.felled`が`"down"`なら、キャラクターは代わりにダウンし、ルールセット自身の規則で瀕死を始めます。`release.owing`(`{"track"?, "bonus"?}`。トラックは省略時、Held Groundで最初に印を付けるもの)があれば、各キャラクターのそのトラックの印が清算されます。印1つにつきルールセットの瀕死セーヴを1回、それぞれに`bonus`を加えて(パーティーのDebts Settled)、印が尽きるか結果が決まるまで、瀕死の規則のとおりにナチュラルの出目を扱って振ります。その後、印は消費されます。3回の失敗(失敗トラックの上限)で死亡します。ログは誰が死亡し、誰がダウンしたかと、各キャラクターのロールを示します。Held Groundでない戦闘はそのままです。

クリーチャーの範囲と地面です(Capability API 1.324)。`area`を持つクリーチャーのアクションは、カタログの項目のゾーンと同じ書き方(`rounds`、`triggers`、`obscures`、`terrain`など)の`zone`で、その範囲を場に残せます。The OwedのFreezing Fog、Scatter Flourの小麦粉の立方体、凍って移動困難な地形になる地面などです。`"untilLair": true`を持つゾーンは、`rounds`で先に終わっていなければ、作り手の住処のカウントが次に来たとき、その住処アクションを選ぶ前にも終わります。「次の住処アクションまで」です。クリーチャーのアクションは、代わりに`ground`で、範囲が覆う地面を永続的に変えることもできます。盤面のイベントの`change`と同じ書き方(`terrain`、0～3の`height`、`light`、`obscured`、`growth`、`season`、ログ用の`tell`)です。焚き火が消えかかる(`"light": "dark"`)、氷が割れる(`"terrain": "water"`)などです。誰も立てないマスに残った者は、最も近い空いたマスに移されます。どちらにもアクションの`area`が必要で、`ground`は何かを変える必要があります。どちらかを使うか、どこかで`untilLair`を使うルールセットにはCapability API 1.324が必要です。

戦闘に呼び込まれるクリーチャーです(Capability API 1.325)。クリーチャーのアクションは`"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }`を指定できます。使用時に、指定したベスティアリのクリーチャー(ルールセットのカタログか、戦闘に渡されたベスティアリの`"<catalogId>/<entryId>"`。`count`は`{"dice"}`、`{"flat"}`、またはその両方で、毎回最大8体)がその数だけ使用者の側で戦闘に加わります。戦闘が自身のクリーチャーを組み立てるのと同じく組み立てられ、1体ずつ名前が付きます(「Zombie 1」、「Zombie 2」)。`area`があれば狙った場所に置かれ、そこが埋まると余地がある限りその近くに置かれます。なければ呼び出し手の隣に置かれ、アクションは誰にも向けません。加わったクリーチャーは自身のイニシアチブを振り、順番に加わります。このラウンドのターンがすでに過ぎた位置なら、次のラウンドからです。`"initiative": "after"`なら、代わりに呼び出し手のターンのすぐ後にターンが来ます。住処アクションも呼び出せ(Shelves Lean)、そのカウントが間に入ったターンはそのまま続きます。戦闘開始時にどこにも見つからないクリーチャーは誰も呼び出さず、戦闘に加われるのは最大40体です。ログは誰が来たかを示します。`calls`を使うルールセットにはCapability API 1.325が必要です。

クリーチャーへ引き寄せられることです(Capability API 1.326)。クリーチャーのアクションは`"draws": { "spends": "reaction" }`を指定できます。命中した者(`save`があれば失敗した者だけ)は、その場でその行動枠を消費し、クリーチャーに最も近い、到達できるマスへ空いた道を通って、移動速度までクリーチャーに向かって歩きます。打撃は誘発しません。その行動枠が残っていない者や、それ以上近づけない者は何も消費せず、その場に留まります。The OwedのWhisper a Nameです。`spends`は行動の経済の行動枠の1つです。`draws`を使うルールセットにはCapability API 1.326が必要です。

住処のタイミングです(Capability API 1.327)。`"actedOnly": true`を持つクリーチャーのアクションは、このラウンドにすでにターンを始めた者(進行中の者を含みます)にだけ向けられます。戦闘の最初のターンの前、住処が全員より先に行動する間は、誰もまだ始めていません。これがHour Bellの「このラウンドにすでに行動したクリーチャー1体」です。状態の持続時間は、その`rounds`に`"untilLair": true`を加えられます。付与した者が次に自分の住処のカウントに来たとき、その住処アクションを選ぶ前にも外れます(Hour Bellの「次の住処アクションまで」)。`concentration`で保たれるクリーチャーのアクションは、自身の住処アクションの1つを`"brokenNextLair"`として指定できます。その集中が破られると(被害、ダウン、ゾーンの効果によるもので、持ち主が自ら終えたり別の集中を始めたりした場合は除きます)、前のラウンドに何を行ったかにかかわらず、その住処アクションが次に行うもので、提示される唯一のものになります。行った後は、再び自由に選べます。Father IvoのLitany of Keepingと、棚が傾くことがこれにあたります。これらのどれかを使うルールセットにはCapability API 1.327が必要です。

状態によって動くセーヴ難易度です(Capability API 1.328)。状態の変更`{ "to": "save-difficulty", "flat": -2 }`は、持ち主がそれを持つ間に求めるすべてのセーヴの難易度を動かします。アクション自身のセーヴと、それらのアクションが付与したものを終わらせるセーヴに与えられるセーヴ難易度です。`flat`の量だけを取り、ほかは取りません。判定の難易度、集中セーヴ(ダメージで決まります)、アクションが戦闘に呼び込むクリーチャーには決して影響しません。Miller of HoursのUn-ageは、呪文セーヴ難易度を2下げます。これを使うルールセットにはCapability API 1.328が必要です。

小道具と糧です(Capability API 1.331)。戦闘の状態は`"whileNearProp": {"prop": "Year-Wheel", "within": 10}`を指定できます。持ち主がそのラベルの立っている盤面の小道具から(ルールセット独自の)その距離以内に立っている間だけ有効で、ほかの場所や、その小道具が壊れた後は、終わらずに抑えられます。盤面のない戦闘では有効です。WheelのFavourです。クリーチャーのアクションのバーストの`area`は`"aroundProp": "Shelf"`を指定できます。どこを狙っても、そのラベルの立っている小道具から`size`以内のすべてのマスを、その向こう側も含めて覆います。Granaryの棚の列の周りのShelves Leanです。オーラは`"feeds": 15`を指定できます。オーラが届く者が倒れ伏すか、ダウンするか、殺されるたびに、持ち主はそのヒットポイントを回復します。オーラはこれだけを行うこともできます。The OwedのCollectorです。これらのどれかを使うルールセットにはCapability API 1.331が必要です。

再点火、落下、小道具のそばでの使用です(Capability API 1.332)。盤面の小道具(遭遇の`board.props`か、戦場に描いたもの)は`"relight": {"light": "bright", "squares": 2, "budget"?: "action"}`を指定できます。それから`squares`以内のどれかのマスが、戦闘の読む光でその光になっていない間、その隣に立つ者には、その行動枠(指定がなければ`action`)で「Light it again」が提示され、それらのすべてのマスにその光を付けます。Bonfire Guttersの後のThe Owedの焚き火です。クリーチャーのアクションの`ground`は、`terrain`とともに`"occupants": "stay"`を指定できます。地面が誰も立てないものに変わる場所に立つ者は、最も近い空いたマスに移される(デフォルトの`"shove"`)代わりに、そこに留まり、氷を割って水に落ちます。カタログの項目やアイテムの使用は`"usableNear": {"prop": "Year-Wheel", "within": 5}`を指定できます。使用者が、IDかラベルで指定した立っている小道具からその距離以内に立っている間だけ提示され、盤面のない戦闘では提示されません。Year-WheelでのFennickのHymnalです。1.332から、`whileNearProp`、`aroundProp`、`usableNear`はすべて同じ方法で小道具を指定します。ID(`"p1"`)か、大文字と小文字、先頭の「the」、英字と数字以外のすべてを無視して緩やかに読むラベルです。そのため`"Year-Wheel"`は「The Year-Wheel」というラベルの小道具を見つけます。`usableNear`や`occupants`を使うルールセットにはCapability API 1.332が必要です。

戦闘の盤面のアートです(Capability API 1.333)。戦闘の盤面は盤面パックから描けます。マスのグリッド(RPG Maker風の見た目なら48ピクセル)上のPNGシートで、固定のIDの下にタイルを持ち、Pixelforgeで作ってライブラリーに保存します(`POST /api/game-tile-packs/boards`)。`bt_plains`、`bt_forest`、`bt_mountain`、`bt_ruin`、`bt_water`、`bt_wall`が地形で、それぞれ最大8つのバリエーションをマスごとに選ぶか、マスより大きい1つの模様を盤面に敷きます。`bt_edge_water`と`bt_edge_wall`は、Pixelforgeの`edge_`ブロックと同じく4×4マスに並べた16個のピースからなるデュアルグリッドのブロックで、水と壁を隣の平地になじませます。`bt_height1`～`bt_height3`は、高くなった地面の縁です。`bo_dim`、`bo_dark`、`bo_sunlight`、`bo_fog_light`、`bo_fog_heavy`、`bo_growth`、`bo_ice`(冬のマス)、`bo_zone`、`bo_aim`、`bo_reach`は、現在の色付けの代わりにマスの上に描かれます。小道具のスプライトは、そのマスにまたがる`bp_<name>`(小道具の`"art": "bp_bonfire"`か、省略時は、先頭の「the」を除いたラベルの小文字の語を`_`でつないだもの。「The Year-Wheel」なら`bp_year_wheel`)で、壊れた後は`bp_<name>_broken`です。描いた戦場や遭遇の盤面は`"pack": "local/<id>"`でパックを指定できます。指定がなければ、環境に応じたライブラリーのパック(パックの`environment`)、次に組み込みの`board/<environment>`、次に現在の描き方で描かれ、小道具はライブラリーの小道具パック(`"environment": "props"`)、次に組み込みの`board/props`からも探します。パックにないタイルは現在の描き方で描かれます。カタログのゾーンは`"art": "bz_<name>"`を指定できます。覆うすべてのマスを盤面のパックのそのタイルで描き、なければ`bo_zone`で描きます。ゾーンの`art`を使うルールセットにはCapability API 1.333が必要です。

アイテムによるターンの追加です(Capability API 1.334)。アイテムの使用は、カタログの項目のmechanicsと同じく`"gives": [{"budget": "action", "count": 1}]`を指定できます(Action Surge)。使用すると、使用者にその分のターンを即座に与え、付与先で上限に収めるため、後のために取っておくものはありません。ボーナスアクションで食べるTime-Flour Loafは、今すぐアクションを1回増やします。これを使うルールセットにはCapability API 1.334が必要です。

休息で消費するダイスです(Capability API 1.335)。休息は`"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}`を指定できます。GMの`[sheet: op="rest" rest="short" dice="2"]`(またはパーティー全体に対するもの)は、休息が定めることを行う前に、まず`pool`からその数を消費し、各ダイス(`die`は任意の値か、「d8」と書いた列挙型フィールド)に`add`を加えて振り(ダイス1個あたり0未満にはなりません)、その分を魔法でない回復として`heals`に戻します。`extra`は、何かを消費した全員に対する追加のダイス1個です。`die`の面数が最も多いパーティーのメンバーが、各人のためにそれを振り、自分の`add`を加えます。5eのSong of Restと、`add`が読むアイテムのステータスとして各ダイスに+1するPell's Brown Teapotがこれにあたります。休息の`dice`を使うルールセットにはCapability API 1.335が必要です。

複数のプールにわたる休息のダイスです(Capability API 1.337)。休息の`"dice"`はリストにでき、プールごとに1項目で、それぞれ独自の`die`、`add`、`heals`、`extra`を持ちます。`[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`のように書くと、ファイター1/ウィザード1はd10とd6を消費します。`[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]`はそのプールからだけ消費します。`pool`がなければ、ダイスはダイスが残っている最初に列挙したプールから、次に次のプールから消費し、全体で足りなければ何も消費せずに拒否されます。追加のダイス(Song of Rest)は、それを持つ最初の項目のもので、消費全体で1回振り、最初のプールが消費したダイスの回復先を回復します。後のプールだけが支払う場合でも振られます。ゲーム中、休息のダイスは各キャラクターが携帯するものを読むため、`add`や追加ダイスの`add`の`itemStat`も数えられます。Pell's Teapotは`{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`です。ここにリストを持つルールセットにはCapability API 1.337が必要です。

アイコンです(Capability API 1.338)。カタログの項目とシートの状態は、`"icon": "ic_poison_cloud"`でアイコンを指定できます。ゲームのアイコンパック(種類が`icons`の盤面パック。packages/server/src/assets/board-packs/README.mdを参照)のタイルです。指定がなければ、Engineは派生した名前を探します。状態は`ic_cond_<id>`、アイテムは`ic_item_<entry id>`(GMが作ったアイテムなら`ic_item_<name>`)、そのほかのカタログの項目は`ic_<catalog id>_<entry id>`(`ic_spells_fireball`)で、ハイフンは`_`にします。どちらもなければ、現在の文字やテキストを表示します。アイコンを指定するルールセットにはCapability API 1.338が必要です。

戦闘画面でのルールセットの表示です(Capability API 1.375)。盤面上では、戦闘ペインは各行動枠を小さな丸い印で示します。色の付いた印の中に文字が入り、まだ消費できる枠は塗りつぶされます。行動枠は、`"short": "A"`(英字1～2文字)と、`rose`、`amber`、`violet`、`teal`、`sky`、`lime`、`orange`、`slate`のいずれかの`"tone"`で両方を指定できます。指定しなければ、印には行動枠のラベルの頭文字と、リスト内の位置に応じた色を使います。そのため、5eのAction、Bonus action、Reactionは、ローズ、アンバー、バイオレットのA、B、Rになります。残りは`combat.display`が定めます。`"defense": {"short": "AC"}`は、ターン順の防御列の見出しです(英字で最大6文字。指定しなければ、短いラベルはそのまま、長いラベルは頭文字にするため、「Armor Class」は「AC」になります)。`"hide": true`は、防御を1つの数値として列に表示する意味がないルールセットで、その列を省きます。`"pools": ["slots_1", "slots_2", "ki"]`は、現在のターンの下に点で表示するシートのプールを、その順番で列挙します(レベル別の呪文スロットや気など)。それぞれ`sheet.live.pools`が宣言するプールを1回だけ指定する必要があり、リストの行が作るプールは拒否されます。指定しなければ、パーティーのアクションが消費するプールを消費順に表示します。`short`、`tone`、`combat.display`を使うルールセットにはCapability API 1.375が必要です。

シート、メニュー、カードで使う独自の言葉です(Capability API 1.378)。次はすべて任意で、省略したところではEngine自身の表現を使います。

- プールは、単数と複数の呼び名を`"unit": "3rd-level slot"`と`"units": "3rd-level slots"`で指定できます。コストは「1 3rd-level slot」や「2 3rd-level slots」と表示され、呪文を高位のスロットで使う際は「Use 1 2nd-level slot」と表示されます。指定しなければ、コストはプールのラベルで数えます。選択肢自体と同じ名前のプールから支払うコスト(Action SurgeのボタンでのAction Surge)は、ボタンがすでにそれを示すため表示しません。
- リストは、プレイヤーへの表示方法を`"display": {"tab": "Spells", "by": {"column": "level", "labels": ["Cantrips", "1st level", "2nd level"]}, "mark": "prepared"}`で指定できます。`tab`は、シートで表示するタブの名前です。`by`は数値列によって行を分け、0以上の各値に見出しを付けます(0には`labels[0]`を使い、ラベルは、21個まで指定できます。最後のラベルより先の値は、シートでは数値を見出しにし、メニューではタブ名だけの下に表示します)。指定するのは数値列でなければなりません。`mark`はチェック印で表示する真偽値列を指定し、その型の列でなければなりません。Game Masterの`[sheet: op="prepare" name="..."]`は、シートにある行にチェックを付けます(`op="unprepare"`で外します)。ガイド付きビルダーで、そのエントリーをチェック付きで選べる場合は、行を追加します(`stamp`またはエントリー自身の行がその列にチェックを付ける`catalog`ステップで、選択数が、0より大きい場合です)。そのステップの選択数、または同じ列の`mark`ステップの選択数が許す数を超えてチェックを付けることはありません。戦闘がリストの行から与える能力は、戦闘メニューで種類自身の見出しに代わり、タブ名の下に同じ分け方で並びます(「Spells: Cantrips」、「Spells: 1st level」)。
- ライブのテキストフィールドは、プールと同じくフィールドによる`"hideWhen"`か、派生値による`{"derived": "knows_concentration", "equals": 0}`(`equals`、`notEquals`、`in`のいずれか)で隠せます。派生値で隠せるのはテキストフィールドだけです。シートが計算する値は、テキストフィールドを読まないためです。
- シートの状態は`"pickable": false`を指定できます。シートの「Add condition」の選択画面からは除外しますが、プレイ、コマンド、Game Masterは引き続き付与と解除を行えます。呪文やアイテム自身の状態のためのものです。
- 負傷トラックではないトラックは、`"showWhenSet": true`を指定できます。初期位置にある間はシートに表示せず、プレイやGame Masterが動かすと表示します。
- アイテムの切り替えは、二つの操作の名前を`"toggle": {"onLabel": "Lower the hood", "offLabel": "Raise the hood"}`で指定できます。メニューは「Turn on」とアイテム名の代わりに、この名前を表示します。
- アイテムの使用は、`"use": {"title": "Scatter ball bearings"}`で名前を指定できます。メニューではアイテム名の代わりにこの名前を表示し、その横の個数は引き続き表示します。
- 戦闘の修正値は、`"label": "advantage on saves against being charmed"`で効果を説明できます。カードは、残りの情報からEngineが組み立てる表現の代わりに、この説明を表示します。
- ボーナスを表す派生値は、`"signed": true`を指定できます。シートは符号付きで表示するため、呪文攻撃の「7」が「+7」になります。
- クリーチャーの特徴の文章は、1200文字まで書けます(以前は、400文字でした)。

これらのいずれか、または400文字を超えるクリーチャーの特性を使うルールセットには、Capability API 1.378が必要です。

集中が破られたときの住処アクションのリストです(Capability API 1.336)。`"brokenNextLair"`は1つの代わりに、自身の住処アクションをそれぞれ1回ずつ並べたリストにできます。`["shelves_lean_north", "shelves_lean_south"]`のように書きます。その集中が破られると、前のラウンドに何を行ったかにかかわらず、次の住処アクションはそのうちの1つでほかのものではなく、クリーチャーを操作する者がどれかを選びます。Engineが操作するクリーチャーは、最も多くの敵を巻き込むものを選び、同等のものの間ではほかと同じく評価します。行った後は、再び自由に選べます。ここにリストを持つルールセットにはCapability API 1.336が必要です。

変身です(Capability API 1.392)。カタログエントリーの`mechanics`(またはクリーチャーのアクション)は、誰かを変身させられるクリーチャーを`"forms"`で提示できます。`{"into": ["beasts/wolf", "beasts/giant-eagle"], "upTo"?: {"filter": "cr", "at"?: <value>, "targetLevel"?: <value>}, "without"?: [{"speed": "fly", "unless"?: <value>}]}`です。各形態は図鑑のエントリー(`"<catalogId>/<entryId>"`)で、アクションのモードのひとつ(`form-<catalogId>-<entryId>`)として提示され、その`applies`は`"shape"`を持つ戦闘の状態を指定しなければなりません。`upTo.at`は、各形態の数値の`filter`に対して、使用者のシートから読み取る数値で形態の上限を定めます(Wild ShapeのCRをドルイドのレベルで制限する場合です)。`upTo.targetLevel`は、代わりに効果を受ける者で上限を定めます。シート自身の値か、クリーチャー自身がそのフィルターに持つ数値です(Polymorphの「CRが標的のレベル以下」)。それを超える形態は拒否されます。`without`は、0を超える値を`unless`が示さない限り、その移動速度を持つ形態を除外します(8レベルになる前のドルイドは飛行できません)。クリーチャーにはシートがないため、そのアクションは`at`も`unless`も使いません。状態の`"shape": {"health"?: "form" | "own", "keepsSaves"?: [...], "keepsChecks"?: [...], "keeps"?: [...], "revert"?: "<budget>"}`は、その状態が続く間の処理を指定します。形態のアクション、防御、セーヴ、判定、移動速度と各移動方法の速度、感覚、サイズ、特徴が、持ち主自身のものに置き換わります。`keeps`は、維持する持ち主自身のアクションを指定します(アクションID、または`"<catalogId>/<entryId>"`かエントリーIDで指定するカタログエントリーです。獣の形態で呪文を発動するドルイドなどです)。`keepsSaves`と`keepsChecks`は、指定したものについて持ち主自身の数値を維持します。`"health": "form"`(デフォルト)では、形態はそのステータスブロックが示す体力を持ち、先に打撃を受け、0になると変身が終わって、残りの打撃が持ち主自身の体力に及びます。`"own"`は持ち主自身の体力を維持します(Change Shape)。`revert`は、その行動枠を使って元に戻る手段を提示します。持続時間、集中の中断、治療、元に戻る手段のどれで終わるかによらず、状態とともに変身も終わります。`forms`または状態の`shape`を持つルールセットにはCapability API 1.392が必要です。

標的の隣に立つ者と標的の負傷を読み取る攻撃です(Capability API 1.393)。クリーチャーの`attackModes`のエントリーは`"allyAdjacent": true`を指定でき、行動できる味方が標的の隣に立っている間だけ適用されます(盤面がない場合は、味方の場所は問いません)。5eのPack Tacticsは`{"mode": "advantage", "allyAdjacent": true}`です。`"targetHurt": true`は、体力が最大値未満の標的に対してだけ適用されます。Blood Frenzyです。エントリーに指定した条件はすべて満たす必要があります。追加効果の`when`には`"target-hurt"`を指定でき、打撃が加わる時点で体力が最大値未満の標的を表します(Colossus Slayer)。その`oncePer`は`"own-turn"`にできます。持ち主自身の各ターンに一度だけで、他の誰かのターン中に行う打撃には決して適用されません(Divine Strikeの「自分の各ターンに一度」です)。これらのいずれかを使うルールセットにはCapability API 1.393が必要です。

カタログエントリーやアイテムの使用によるクリーチャーの呼び出しです(Capability API 1.394)。その`mechanics`は、クリーチャーのアクションの`calls`(1.325)と同様に`"calls"`を指定して、使用者の側としてクリーチャーを戦闘に参加させられます。`{"creature": "creatures/wolf", "count": {"dice": "1d4"}}`、または`"options"`で指定します。後者は`{"creature", "count", "label"?}`を二つから八つ指定し、使用時に使用者が選びます。モード(`call-0`、`call-1`、...)として提示されます。5eのConjure Animalsは`[{"creature": "beasts/dire-wolf", "count": {"flat": 1}, "label": "One beast of CR 1"}, {"creature": "beasts/wolf", "count": {"flat": 2}, "label": "Two of CR 1/2"}]`です。該当するクリーチャーが見つからない選択肢は提示されません。クリーチャーは、エントリーの`area`が狙う場所か、範囲がなければ使用者の隣に配置され、それぞれのイニシアチブのダイスを振ります。`"initiative": "after"`を指定すると、呼び出し手の直後に行動します。`"rounds": 10`では、その数のラウンド後に呼び出し手のターンが回ってくると戦闘から去ります。エントリーに`concentration`があれば、それが終わると去ります。呼び出しを行う`utility`エントリーは、戦闘中に使用できます。カタログエントリーやアイテムの使用で`calls`を使うルールセットにはCapability API 1.394が必要です。

状態が与える移動方法です(Capability API 1.395)。戦闘の状態は`"speeds"`を指定できます。`fly`、`swim`、`climb`、`burrow`のいずれかについて、ルールセット自身の距離単位で`{"fly": 60}`(5eのFly)とするか、持ち主の歩行と同じ速さを表す`"walk"`を指定します(`{"fly": "walk"}`、Dragon Wings)。状態が続く間、持ち主はその方法でも移動でき、自身が元から持つ移動方法の方が速い場合は、その速さを維持します。ターンの途中で与えられた場合、新しい移動方法は歩行の残量から始まります。`"hover": true`は、移動できない間も浮いたままにします。`"levitates": true`(Levitate、アイテムの使用が与える状態としてのBoots of Levitation)は、与えた飛行の移動速度で上下にだけ移動させ、水平方向には決して移動させず、浮いたままにします。状態が終わると以前の方法で移動し、空中にいて飛行手段がなくなった者は、飛行中に伏せ状態にされた者と同様に落下します。これらのいずれかを使うルールセットにはCapability API 1.395が必要です。

再生です(Capability API 1.396)。クリーチャー、戦闘の状態、戦闘のレベルは`"regenerates"`を指定できます。持ち主自身の各ターンの開始時に回復する体力で、`flat`と`dice`に加え、持ち主自身のシートから読み取る値である`add`を指定します(クリーチャーでは決して使えません)。`stoppedBy`は、次のターンの開始時に再生の適用を抑える被害の種類を指定します。トロルは`{"flat": 10, "stoppedBy": ["acid", "fire"], "keepsUp": true}`です。`keepsUp`があると、持ち主は、0になっても戦闘から脱落せずダウンし、戦闘は続きます。0で自身のターンを開始し、何も回復しなかった場合にだけ戦闘から脱落します。`atMostHalf`は体力が半分以下の場合にだけ回復し、`notAtZero`は、0では決して回復しません。5eのSurvivorはチャンピオンのレベルに付ける`{"flat": 5, "add": {"abilityMod": "con"}, "atMostHalf": true, "notAtZero": true}`です。体力はポイント制でなければなりません。ログは、それぞれが回復した量か、再生が抑えられたことを示します。`regenerates`を使うルールセットにはCapability API 1.396が必要です。

1の体力で持ちこたえる仕組みです(Capability API 1.400)。クリーチャーの`"hangsOn"`(1.320: 戦闘ごとの`uses`、`extraTurn`、`label`)は、戦闘の状態や戦闘のレベルにも付けられるようになり、条件が追加されました。`save`は、持ち主にまずセーヴのダイスを振らせます。`{"save", "difficulty", "plusDamage", "raisedBy", "tally"}`を指定し、難易度には、`plusDamage`があればその打撃が与えたダメージを加え、それまでに成功した回数分の`raisedBy`を加えます。その回数は、この戦闘中の回数か、`tally`があればシートのプールから消費した量です。成功するたび、1を消費し、プールを補充する休息を行うと数え直します。`notFrom`は、決して持ちこたえられない被害の種類を指定し、`notCritical`はクリティカルヒットを拒否し、`dealtAtMost`は指定値を超えるダメージを与えた打撃を拒否します。`spends`は毎回、1を支払うシートのプールを指定し、空になると持ちこたえられなくなります。`uses`、`spends`、`save`のいずれかが必要で、クリーチャーには`spends`も`tally`も指定できません。Undead Fortitudeはゾンビの`{"save": {"save": "con_save", "difficulty": 5, "plusDamage": true}, "notFrom": ["radiant"], "notCritical": true, "label": "Undead Fortitude"}`です。イノシシのRelentlessは`{"uses": 1, "dealtAtMost": 7}`です。Relentless Enduranceは、ハーフオークのレベルに付ける`{"spends": "relentless_endurance"}`で、大休憩で補充する一ポイントのプールを使います。Relentless Rageは、激怒の状態の`{"save": {"save": "con_save", "difficulty": 10, "raisedBy": 5, "tally": "relentless_rage"}}`です。即死させる効果では決して持ちこたえられず、ダメージによらず、0になった場合は、単純な`uses`か`spends`によってのみ持ちこたえられます。体力はポイント制でなければなりません。これらを使うルールセットにはCapability API 1.400が必要です。

カタログから読み取る変身形態です(Capability API 1.401)。変身の`forms`は、`"into"`に加えて、またはその代わりに、`"from"`を指定できます。`{"catalog", "filters", "notFilters"}`は、その図鑑のカタログから、`filters`のすべてに一致し、`notFilters`のどれにも一致しない全エントリーを提示します。各条件はフィルターIDと値または値のリストです(いずれかの値に一致すればよく、大文字と小文字を区別しません。タグのようにフィルターの値自体がリストの場合は、そのいずれかに一致すれば該当します)。`into`に指定した形態を先に提示し、同じ形態を重複して提示しません。`upTo`と`without`は、従来どおり形態を制限します。5eのWild Shapeは`{"from": {"catalog": "creatures", "filters": {"type": "Beast"}}, "upTo": {"filter": "cr", "at": ...}, "without": [...]}`で、Shapechangeは`{"from": {"catalog": "creatures", "notFilters": {"type": ["Construct", "Undead"]}}, "upTo": ...}`です。形態は`into`で指定するか、カタログから`from`で読み取るか、その両方にします。`from`を使うルールセットにはCapability API 1.401が必要です。

カタログから読み取り、コストに応じて数を増やす呼び出しです(Capability API 1.402)。カタログエントリーやアイテムの使用の`calls`は、単一の`creature`の代わりに`"from"`(変身形態を読み取る場合と同様、`filters`と`notFilters`を持つカタログ)を指定でき、`upTo: {"filter", "at"}`で数値フィルターの値が`at`を超えるエントリーを除外します。一致するものはそれぞれ、使用時に使用者が選ぶモードになります。`options`の各選択肢でも同じ指定ができるため、Conjure Animalsは四つの選択肢になります。`{"from": {"catalog": "creatures", "filters": {"type": "Beast"}}, "upTo": {"filter": "cr", "at": 2}, "count": {"flat": 1}, "label": "One of CR 2"}`と、CR 1、1/2、1/4で個数がそれぞれ、2、4、8の区分です。そのため、`from`で読み取る`options`のリストは、選択肢をひとつだけ持つこともできます。`timesPerSteps`は、支払った上位のコストが指定した数のステップを上がるごとに、個数の倍率をさらに一つ増やします。Conjure AnimalsとConjure Woodland Beingsは`2`です(スロットが二レベル上なら二倍、四レベル上なら三倍、六レベル上なら四倍です)。クリーチャーの`attackModes`の規則は`"melee": true`も指定でき、近接攻撃にだけ適用されます(投擲武器が近接攻撃に数えられるのは、標的が間合い内に立っている間だけです)。Blood Frenzyは`{"mode": "advantage", "targetHurt": true, "melee": true}`です。これらのいずれかを使うルールセットにはCapability API 1.402が必要です。

包み込みと標的の条件でのサイズ指定です(Capability API 1.403)。クリーチャーのアクションは`"engulf": {"upToSize", "save": {"save", "difficulty"}, "ownMovement"?, "atMost"?}`を指定できます。そのアクション自体には`targets`、`area`、攻撃ロール、セーヴを指定しません。盤面上では、実行者が歩いて向かうマスを選びます。このために与えられる移動速度まで(または`ownMovement`があれば自身の歩行の残量で)移動し、途中で`upToSize`以下のサイズのクリーチャーが占める場所に入ります。止まると、場所に入られた各クリーチャーがそのセーヴのダイスを振ります。失敗すると、そのアクションの`damage`と`applies`を受けます。成功した場合や、すでに`atMost`だけ取り込んでいる場合は、最も近い空いているマスに配置されます。盤面がない場合は、ひとりのクリーチャーを狙います。`"inside": true`を持つ戦闘の状態は、付与された者を付与した者の体内に留めます。取り込まれた者は取り込んだ者とともに移動し、自力ではどこにも歩けず、取り込んだ者(および一緒に取り込まれた者)以外とは、どちらの方向にも何も届きません。そのような状態の最後のひとつが終わると(脱出判定、`endsWhenSourceDown`)、取り込んだ者の隣に配置されます。状態の`harms`は、`at`に`"source-turn-start"`か`"source-turn-end"`を指定できるようになりました(付与した者のターンの開始時か終了時です)。また、`"save": {"save", "difficulty"?}`を持たせると、持ち主は成功するたびに被害を免れます。難易度が指定されていなければ、その状態自身の難易度に対して振ります。したがって、ゼラチナス・キューブのEngulfは`{"engulf": {"upToSize": "large", "save": {"save": "dex", "difficulty": 12}}, "damage": {"dice": "3d6", "type": "acid"}, "applies": [{"condition": "engulfed"}]}`です。`engulfed`は拘束状態にし、`inside`を持ち、DC 12のStrength判定で終わり、`harms: {"at": "source-turn-start", "dice": "6d6", "type": "acid"}`を持ちます。シャンブリング・マウンドのEngulfは、被害に`"save": {"save": "con", "difficulty": 14}`を追加します。標的の条件(`targetIs`と、それを読み取るすべてのもの)は、指定した種別やタグに加え、`combat.sizes`の`upToSize`と`atLeastSize`も指定できます。Medium以下の標的だけを掴める噛みつきでは、`"targetIs": {"upToSize": "medium"}`でその状態を付与します。また、一回の呼び出しで、32までのクリーチャーを参加させられるようになりました(8だった上限から増えました)。そのため、Conjure Animalsの八頭の狼は、5レベルでは、16頭、7レベルでは、24頭になります。これらのいずれかを使うルールセットにはCapability API 1.403が必要です。

リスト行のプールから支払う、激怒中だけ持ちこたえる、より良い値を使う変身です(Capability API 1.404)。`hangsOn`の`spends`とそのセーヴの`tally`は、宣言済みプールをIDで指定するだけでなく、リスト行のプールを名前で指定することもできます。ハーフオークのRelentless Enduranceは、カウンターの行から支払う`{"spends": "Relentless Endurance"}`です(カタログエントリーが、プールを持つリストに書き込む行です。それ以外の名前は拒否されます)。`whileHolding`は、持ち主が指定した状態のいずれかを持つ間にだけ持ちこたえられるようにします。Relentless Rageは、その特性が付けたままにする状態で、`{"whileHolding": ["raging"], "save": {"save": "con_save", "difficulty": 10, "raisedBy": 5, "tally": "Relentless Rage"}}`です。戦闘の状態の`shape`には`"betterOf": true`を指定できます。持ち主のシートで習熟している各セーヴと対抗判定(判定では、その値が読み取るスキルで判断します)は、形態自身の値と、形態の能力修正値に持ち主の習熟を加えた値のうち、良い方を使います(専門化では、段階の指定どおり習熟を倍にします)。それ以外はすべて形態の値で、維持するよう指定したものは引き続き持ち主自身の値です(Wild Shape、Shapechange: Dex 16のドルイドがDexterityのセーヴに習熟していなければブラウン・ベアの+0を使い、Athleticsに習熟していればベアのStrengthに自身の習熟を加えた値か、それより高ければベアのボーナスを使います)。1.405より前は、すべてのセーヴと判定について良い方を使っていました。これらのいずれかを使うルールセットにはCapability API 1.404が必要です。

飲み込み、吐き戻し、這い出る処理です(Capability API 1.405)。戦闘の状態の`inside`は、`true`の代わりにオブジェクトにできます。`"room": {"of", "takes"?}`は、取り込む側がその状態を通じて同時に取り込める量です。中の各クリーチャーはひと枠、または`combat.sizes`のそのサイズに対して`takes`が指定する枠数を使い、収まらないクリーチャーは取り込まれません(ウォーター・エレメンタルのWhelmの「Largeのクリーチャーひとり、またはMedium以下を最大ふたり」は`{"of": 2, "takes": {"large": 2}}`です)。`"releasedWhen": {"dealt", "save": {"save", "difficulty"}, "prone"?}`は、取り込まれた者が中から取り込んだ者に`dealt`以上のダメージを与えたターンの終了時に、取り込んだ者がセーヴに成功しなければ、取り込まれた者を外に出します。ベヒアの「体内のクリーチャーから単一のターンに、30以上のダメージを受けると...DC 14のConstitutionセーヴ...伏せ状態になる」は`{"dealt": 30, "save": {"save": "con", "difficulty": 14}, "prone": true}`です。`"corpse": {"costs", "prone"?}`は、取り込んだ者が倒れて状態が終わっても(`endsWhenSourceDown`によります)、取り込まれた者をその体内に留めます。取り込まれた者は、移動の`costs`を使って這い出るまで体内に留まり(ルールセットの距離単位で指定し、「Climb out」という移動として提示されます)、這い出ると隣に配置され、指定があれば伏せ状態になります。パープル・ワームの「20フィートの移動を使い、伏せ状態で出る」が該当します。伏せ状態で外に出す処理には、戦闘の`half-move-to-stand`効果を持つ状態を使います。包み込みでも、`atMost`の代わりに同じ方法で`"room"`を指定できます。「一度に飲み込めるのはひとり」は、飲み込む噛みつき自身の`applies`に`heldAtMost`を付けます(1.320)。クリーチャーのアクションは`targetTypes`を持つことができ、カタログエントリーのものと同様に読み取るため、ベヒアのConstrictは`{"is": {"upToSize": "large"}}`だけを狙います。クリーチャーの連続行動は`"allHit": {"targetIs"?, "applies"?, "uses"?}`を持つことができます。その中のすべての攻撃が同じ標的に命中し、その標的が`targetIs`を満たすと、`applies`の状態を付与し、続いて`uses`で指定した自身のアクションをその標的に使用します(包み込みなら通常どおりセーヴを行わせ、それ以外のアクションはその標的に対して解決します)。シャンブリング・マウンドのMultiattackは、Slamを二回行い、`{"allHit": {"targetIs": {"upToSize": "medium"}, "applies": [{"condition": "grappled", "escapeDc": 14}], "uses": "engulf"}}`を持ちます。これらのいずれかを使うルールセットにはCapability API 1.405が必要です。

防御の下限です(Capability API 1.406)。修正値`{"to": "defense", "atLeast": …}`は、それが適用されている間、他のすべての変更後、遮蔽を加える前に、持ち主の防御がその値を下回らないようにします。命中時には、その下限によって防御が引き上げられた量を表示します。`atLeast`は、数値(Barkskin: `{"to": "defense", "atLeast": 16}`)、または持ち主のシートから読み取る値で、計算にはルールセット自身の派生値を使います。Mage Armorの「基本ACは、13 + Dexterity修正値になる」は`{"to": "defense", "atLeast": {"derived": "ac_mage_armor"}}`で、`ac_mage_armor`は、13、Dexterity修正値、装備した盾のボーナス、着用した鎧一着につき-100を合計します。下限は決して値を下げないため、プレイヤーが選ぶ場合と同様、二つのアーマー・クラスのうち良い方を使います。シートのないクリーチャーは、ステータスブロックの能力値から`const`か`abilityMod`を読み取ります。戦闘の状態、レベル、アイテムの効果に付けられ、単独で指定します。`flat`、`dice`、`times`、`mode`は併記できません。これを使うルールセットにはCapability API 1.406が必要です。

飲み込みの続きです(Capability API 1.407)。アクションが付与するもの(`applies`)は、`"targetHolds": {"conditions"?, "fromSelf"?}`を持つことができます。誰かが、または付与しようとしている者自身が付与した、指定の状態のいずれかをすでに持つ標的にだけ付与します。付与時に読み取るため、同じリストのそれより前にある状態も数えます。アクション自身の`targetHolds`とは異なり、アクションの残りの部分は引き続き誰にでも適用されます。クラーケンのBiteは命中した相手にダメージを与え、クラーケンが掴んでいる相手だけを飲み込みます(`{"condition": "swallowed", …, "targetHolds": {"fromSelf": ["grappled"]}}`)。`"endsOnTarget": [conditions]`は、付与すると、付与した者自身が標的に付けた指定の状態を解除します。飲み込んだ後に「掴みが終わる」パープル・ワームの飲み込みが該当します。`inside`を持つ状態の`"harmsPuller": {"dice"?, "flat"?, "type"?}`は、その状態の持ち主を引き出そうとするクリーチャーが、勝敗にかかわらず受ける被害です。この引き出しは、`"pulls": true`と、`inside`の状態を指定する`"targetHolds"`を持つ対抗判定です。別のクリーチャーの体内にいる者に対して提示され、そのクリーチャーの体を通して届き、距離はそのクリーチャーまでを測ります。防御側はおらず、その拘束が指定する脱出DC(`escapeDc`)、なければ対抗判定自身の`difficulty`に対してダイスを振ります。`onWin.ends`は拘束を解除し、取り込まれた者をそのクリーチャーの隣に出します。5eのゼラチナス・キューブでは`{"id": "pull_out", "label": "Pull out", "budget": "action", "pulls": true, "targets": "ally", "targetHolds": "engulfed", "attacker": {"checks": ["might"]}, "onWin": {"ends": [{"condition": "engulfed", "on": "target"}]}}`とし、キューブのEngulfが`"escapeDc": 12`と`"harmsPuller": {"dice": "3d6", "type": "acid"}`を付けた`engulfed`を付与します。ウォーター・エレメンタルのWhelmは`"escapeDc": 14`だけを指定します。別のクリーチャーの体内にいる者には、そのクリーチャーの位置で届きます。戦闘の状態は`"takesSourceHarm": {"share"}`を持つことができます。状態が続く間、付与した者が受けるダメージのその割合を持ち主が受け、付与した者が受けるのは端数を切り捨てた残りのダメージだけです。ラグ・オヴ・スマザリングのDamage Transferは、Smotherが付与する`smothered`状態の`{"share": 0.5}`で、`"endsWith": "grappled"`と`"heldAtMost": 1`(一度にひとりの標的)を付け、`"escapeDc": 13`を持つ`grappled`とともに付与します。状態の`harms`は、標的の各ターンの開始時に、10 (2d6 + 3)の殴打ダメージを与え、`restrained`と`blinded`も`"endsWith": "grappled"`を付けて付与します。これらのいずれかを使うルールセットにはCapability API 1.407が必要です。

特定の出目の振り直しです(Capability API 1.408)。戦闘の状態やレベルは`"rerollsFace": {"face", "rolls"?}`を持つことができます。持ち主自身の攻撃ロール、セーヴ、判定(戦闘処理がダイスを振る対抗判定、アイテムの使用条件の判定、能力値判定)で、戦闘自身の攻撃ダイスのいずれかに`face`が出るたびに、そのダイスを一度だけ振り直し、同じ出目が再び出ても、新しい出目を採用します。`rolls`は、`"attacks"`、`"saves"`、`"checks"`の一部に対象を絞ります。省略すると三つすべてが対象です。有利または不利では、その出目が出た各ダイスを振り直します。ログは、振り直したものと新しい出目を示します。5eのハーフリングのLuckyは、そのハーフリングのシートから読み取ると、1になる派生値のレベルに付ける`{"face": 1}`です。ダイスプールでダイスを振る戦闘には該当するダイスがないため、そこでは拒否されます。これを使うルールセットにはCapability API 1.408が必要です。

状態の付与元に複製される被害です(Capability API 1.409)。`"copiesHarmToSource": true`を持つ戦闘の状態は、付与した者に、持ち主が受けたものと同じダメージを与えます。ダメージ種別は同じで、持ち主自身の抵抗を適用した後の量を使い、さらに付与した者自身の抵抗で軽減します。5eのWarding Bondは、防御とセーヴへの+1、`resist-all`効果、`"copiesHarmToSource": true`、`"endsWhenSourceDown": true`を持つ`warded`状態と、`"endsAway": {"beyond": 60}`を持つ`applies`エントリーです。この方法か`takesSourceHarm`で渡されたダメージは、決してさらに渡されないため、二つの絆で同じダメージを相互に送り返すことはできません。これを使うルールセットにはCapability API 1.409が必要です。

上限の範囲内でのプールの回復です(Capability API 1.410)。カタログエントリーの`mechanics`は`"recovers": {"group", "upTo", "most"?}`を持つことができます。使用すると、使用者が選んだ、そのプールグループに属する消費済みプールを回復します。レベルの合計は`upTo`(使用者のシートから読み取る値)以下で、どのプールもレベルが`most`を超えないものに限ります。プールのレベルは自身の`level`で、なければグループ内の位置です。Game Masterは使用時に`[sheet: op="use" name="Arcane Recovery" recover="Level 1 Slot:2, Level 2 Slot:1"]`でプールを指定します。個数を書かないプールはひとつを意味し、プールはIDかラベルで指定できます。使用時には、カウンターの行も含め、エントリーのコストを引き続き支払います。プールがそのグループに属さない場合や`most`を超える場合、要求した数より消費済みの数が少ない場合、またはレベルの合計が`upTo`を超える場合は、使用全体を拒否します。5eのArcane Recoveryは`{"group": "slots", "upTo": {"derived": "arcane_recovery_levels"}, "most": 5}`で、派生値はウィザードのレベルの半分を切り上げたものです。Natural Recoveryも同じで、ドルイドのレベルを使います。これを使うルールセットにはCapability API 1.410が必要です。

シートに応じたテキストと、イニシアチブ時のプールの補充(Capability API 1.411)。行の`scaled`列は、`table`の代わりに`"texts"`を持つ場合、`text`列または`enum`列にできます。`[threshold, text]`のステップを指定し、各ステップのしきい値は前のものより大きくします。セルには、参照値が到達した最後のステップのテキストが入ります(どれにも到達しない場合は最初のものです)。列挙型のテキストはその値のいずれかでなければならず、行の初期テキストは引き続き`values`で指定します。5eのFont of Inspirationは、Bardic Inspirationのカウンターの`"scaled": {"recharge": {"from": {"field": "bard_level"}, "texts": [[1, "long"], [5, "short"]]}}`です。カタログのエントリーの`mechanics`は`"refillsAtInitiative": {"pool", "amount"?}`を持てます。戦闘でイニシアチブのダイスを振る際、そのエントリーを持つシートで、そのプール(IDで指定するライブのプール、または名前で指定するリスト行のプール)が空なら、`amount`分が回復します(省略時: 1)。最大値は超えず、ログに記録されます。5eのSuperior Inspirationは`{"pool": "Bardic Inspiration"}`です。どちらを使うルールセットにもCapability API 1.411が必要です。

敵が倒れたときの一時ポイント(Capability API 1.412)。戦闘の状態またはレベルは`"fellsGrant": {"temporary": <value>}`を持てます。反対側のクリーチャーが、0に下がり、最後にダメージを与えたのがその持ち主だった場合、持ち主はシートから読み取った値の一時ポイントを得ます(クリーチャーは`const`を読みます)。ほかの一時ポイントと同様に累積せず、大きいほうの緩衝分が残ります。戦闘の体力はポイントのプールでなければならず、負傷トラックにはできません。5eのDark One's Blessingは、フィーンドのウォーロックのレベルを表す派生値について、1に達したときのレベルで、`{"temporary": {"derived": "dark_ones_blessing"}}`を持ちます。この派生値はCharisma修正値 + ウォーロックのレベルで、1を下限とします。これを使うルールセットにはCapability API 1.412が必要です。

シートから読み取る値によるダメージ軽減と、落下の軽減(Capability API 1.413)。`damage`または`damage-taken`の修正値は`"add"`を持てます。これは持ち主のシートから読み取る値で(シートのないクリーチャーはブロックの`const`または`abilityMod`を読みます)、`dice`と`flat`に加算します。`"minus": true`ではダイスと値の両方を差し引き、打撃は、0を下回ることはありません。5eのDeflect Missilesは、遠隔の`hit`に対するリアクションで、攻撃一回だけ続く状態(`endsAfter: "attacked"`)を付与します。その内容は`{"to": "damage-taken", "blow": "ranged", "dice": "1d10", "add": {"derived": "deflect_missiles"}, "minus": true}`で、派生値はDexterity修正値 + モンクのレベルです。`"falls": true`を持つ`damage-taken`の修正値は、落下のダメージだけを軽減し、`attacks`、`blow`、`ability`、`fromSource`、`times`とは併用しません。修正値が落下を軽減した状態は、それによって消費されます。5eのSlow Fallは、`falls`に対するリアクションで、`{"to": "damage-taken", "falls": true, "add": {"derived": "slow_fall"}, "minus": true}`を持つ状態を付与し、その値はモンクのレベルの五倍です。どちらを使うルールセットにもCapability API 1.413が必要です。

カタログのフィルターによるエントリーの変更(Capability API 1.414)。変更は`"entry"`の代わりに`"catalogs"`を指定でき、持ち主が使うそれらのカタログの全エントリーを変更します。`"where": {"filter", "equals"}`で、宣言済みフィルターが指定の値を示すエントリーに絞れます(単語、数値、または単語のリストのいずれかで、大文字と小文字は区別しません)。これに加えて、さらに二種類の変更があります。`"damageOnce"`は持ち主のシートから読み取る値で、使用一回につき一回のダメージロールに加えます。全員が同じロールのダメージを受ける場合(範囲や必ず命中するダーツ)はすべての標的に、標的ごとに命中のダイスを振るエントリーでは最初の命中に加えます。5eのEmpowered Evocationは`{"catalogs": ["spells"], "where": {"filter": "school", "equals": "evocation"}, "damageOnce": {"abilityMod": "int"}}`です。`"halfOnSave": true`は、エントリーのダメージを`negates`するセーヴに成功した場合に、代わりにダメージの半分を残します。エントリーのほかの効果には影響しません。Potent Cantripでは、`where`で、0レベルのものを指定します。改変(`alters`)も同じ`"where"`を取り、それに合うエントリーだけに適用します。また、`spares`用のキーがさらに二つあります。`"sparesByLevel": true`は、エントリーが支払った段階のレベルと同数だけ、影響を免れる数を増やします。`"sparesWhole": true`では、セーヴ成功時に半分が残る場合も、影響を免れる者は何も受けません(ログには回避したと記録されます)。5eのSculpt Spellsは、コストのない`utility`で、`{"catalogs": ["spells"], "where": {"filter": "school", "equals": "evocation"}, "spares": {"const": 1}, "sparesByLevel": true, "sparesWhole": true}`を持ちます。選択時にはCareful Spellと同様に、影響を免れる者を`spares`に指定します。これらのいずれかを使うルールセットにはCapability API 1.414が必要です。

最大の出目を使うダメージと回復、および使用者に被害を与える改変(Capability API 1.415)。改変の`"maximizes": {"fromLevel"?, "upToLevel"?}`は、合致するエントリーのダメージで最大の出目を使い、すべてのダイス(条項や高い段階での支払いによるものも含みます)を最大の目にします。ダメージを与えるエントリーだけに合致し、支払った段階のレベルがその範囲内にあるものに限ります(範囲外の選択は`bad-alter`として拒否されます)。`"backlash": {"free", "dice", "grows"?, "type"?, "unblockable"?}`は、変更したものの発動後に使用者へ被害を与えます。ただし、そのエントリーが`usesOf`で消費するカウンターの最初の`free`回を超えた後です(そのカウンターが最後に回復してから数えます)。エントリーが支払った段階のレベルごとに`dice`を与え、被害を与える最初の使用を超えるたびに、レベルごとにさらに`grows`を加えます。`unblockable`は抵抗と完全耐性を無視します。5eのOverchannelは、大休憩で回復する「Overchannel uses」カウンターを消費する`utility`で、`{"catalogs": ["spells"], "where": <wizard spells>, "maximizes": {"fromLevel": 1, "upToLevel": 5}, "backlash": {"free": 1, "dice": "2d12", "grows": "1d12", "type": "necrotic", "unblockable": true}}`を持ちます。変更の`"maxHeal": true`は、変更するすべてのエントリーで最大の出目を使って回復します。Supreme Healingは`{"catalogs": ["spells"], "maxHeal": true}`です。これらのいずれかを使うルールセットにはCapability API 1.415が必要です。

飛び道具を受け止めて投げ返す(Capability API 1.416)。標的が持つ`"minus": true`付きの`damage-taken`修正値によって武器の打撃が完全に軽減されると(Deflect Missiles、1.413)、それで被害を受けた者全員の応答がなくなった時点で、受け止めた者に`"caught"`の瞬間が開かれます。リアクションの`"freeSlot"`は、提示するために持ち主に空きが一つ必要なアイテムスロットを指定します(着用中または持ったままのアイテムに占有されていてはいけません)。ステータスブロックから読み取るクリーチャーには常に空きがあります。`"throwsCaught": true`を持つエントリーは、量を持ち、命中のダイスを振る攻撃で、`on`が`"caught"`のときに使います。ダメージには受け止めた飛び道具のダイスと種別を使い、エントリー自身の固定部分は維持します。5eのDeflect Missilesの投げ返しは、`usesOf`で、1の気を消費する`free`の能力で、`{"kind": "attack", "attackRoll": true, "amount": {"dice": "1d4"}, "amountAdd": {"abilityMod": "dex"}, "range": 60, "throwsCaught": true, "reaction": {"on": "caught", "at": "chosen", "freeSlot": "hand"}}`を持ちます。これらのいずれかを使うルールセットにはCapability API 1.416が必要です。

特定の間の適用抑制、見えるものに対するセーヴ、有利の防止(Capability API 1.417)。戦闘の状態またはレベルは`"notWhile"`を持てます。状態をIDで、または状態がもたらすものを効果で指定します。持ち主がそのいずれかを持つ間は適用を抑えるため、`"cannot-act"`は、その効果をもたらす何かによる無力状態を表します。`"whenSeen": true`は、持ち主が見えるものに対するセーヴでのみ、そのセーヴ効果とセーヴ修正値を適用します(出所のないセーヴは見えるものとして扱います)。これらのいずれかを併記する必要があります。5eのDanger Senseは、レベル`{"derived": "barbarian_level", "at": 2, "effects": ["own-saves-advantage"], "saves": ["dex_save"], "whenSeen": true, "notWhile": ["blinded", "deafened", "cannot-act"]}`です。効果`"attacks-against-no-advantage"`は、持ち主が行動できる間、持ち主に対するすべての攻撃ロールについて、何によって得たものでも有利の付与を防ぎます。不利は引き続き適用します。5eのElusiveは、レベル`{"derived": "rogue_level", "at": 18, "effects": ["attacks-against-no-advantage"]}`です。これらのいずれかを使うルールセットにはCapability API 1.417が必要です。

判定の下限(Capability API 1.418)。戦闘の状態またはレベルは`"checkFloor": {"face"?, "total"?, "proficient"?, "abilities"?, "skills"?}`を持て、戦闘中にも戦闘外にも適用します。単一のダイスの出目が`face`未満なら`face`として扱い(素の出目も同様なので、1ではなくなります)、合計が、持ち主のシートから読み取る値`total`未満なら、その値として扱います。`proficient: true`は持ち主が習熟しているスキルの判定に、`abilities`と`skills`はそれらを使う判定に限定します。セーヴには一切影響しません。5eのReliable Talentは、レベル`{"derived": "<rogue level>", "at": 11, "checkFloor": {"face": 10, "proficient": true}}`で、Indomitable Mightは、レベル`{"derived": "<barbarian level>", "at": 18, "checkFloor": {"total": {"abilityScore": "str"}, "abilities": ["str"]}}`です。これを使うルールセットにはCapability API 1.418が必要です。

未習熟時に加えるシートの値(Capability API 1.419)。
スキル、セーヴ、またはセクションの`untrained`は`{"add": <value>}`にできます。
最初の段階の判定では、シートの現在の状態から計算したその値を加え、スキルの数値にも表示します。
能力値の`"checkAdd"`は、スキルを使わずその能力値だけで行う判定に加えます。
上限と同様、どちらもスキルやセーヴの修正値を読めません。読み取る派生値とそこに至るまでのどの派生値も、それらの修正値を読めません。
5eのJack of All Tradesは、派生値`jack`(習熟ボーナスの半分を切り捨てた値で、2レベルのバードから適用し、それ以外の場合は、0)を、すべてのスキルの`untrained`の`{"add": {"derived": "jack"}}`、すべての能力値の`checkAdd`、およびイニシアチブの派生値に使います。
Remarkable Athleteも同様ですが、Strength、Dexterity、Constitutionについて半分を切り上げ、両者の大きいほうを取ります。
どちらを使うルールセットにもCapability API 1.419が必要です。
同じマイナーバージョンで、`combat.levels`のエントリー数の上限も、20から、40に増えます。
20を超えるルールセットにも、1.419が必要です。

カタログエントリーの長距離射程と、投げ返しのダイス(Capability API 1.420)。カタログのエントリーの`mechanics.longRange`は、`range`を超えて届く距離で、同じ単位を使い、それより大きくします。`range`を超えると、アイテムやクリーチャーの長距離射程と同様、`combat.ranged`の指定に従って難しくなり、Distant型の改変は両方を延ばします。`throwsCaught`は`{"die": {"from": <value>, "table": [[level, sides], ...]}}`にできます。平均値が高くなる場合、受け止めた飛び道具を、その元のダイスの代わりにその面数のダイス一つで投げ返し、被害の種別は維持します。5eのDeflect Missilesの投げ返しは、`"range": 20, "longRange": 60`と`"throwsCaught": {"die": {"from": {"field": "level"}, "table": [[1, 4], [5, 6], [11, 8], [17, 10]]}}`で、飛び道具をモンク武器として扱います。どちらを使うルールセットにもCapability API 1.420が必要です。

変更で加える回復(Capability API 1.421)。変更の`"healAdd": {"add"?, "perLevel"?, "fromLevel"?}`は、変更するエントリーが回復するすべてのクリーチャーに、その分の回復を追加します。持ち主のシートから読み取る`add`に、エントリーが支払った段階のレベルごとに`perLevel`を加え、`fromLevel`未満で支払ったエントリーには何も加えません。`"healsSelf"`は同じ形式で、エントリーが持ち主以外の誰かを回復したとき、使用一回につき一回、持ち主自身を回復します。5eのDisciple of Lifeは`{"catalogs": ["spells"], "healAdd": {"add": {"const": 2}, "perLevel": 1, "fromLevel": 1}}`で、Blessed Healerは同じものの`healsSelf`版です。どちらを使うルールセットにもCapability API 1.421が必要です。

攻撃の終了と、打撃や転送で応答するリアクション(Capability API 1.422)。リアクションの`"on": "attacked"`の瞬間は、命中のダイスを振る攻撃が終わると、命中したかどうかにかかわらず開かれます。その攻撃が開いた`harmed`または`caught`の瞬間があれば、その後で、攻撃された者だけに尋ねます。`"missed": true`は持ち主への攻撃が外れた場合に、`"blow"`は近接または遠隔の攻撃に限定します。誰かが引き起こした瞬間には`"sourceIs"`を持たせられ、引き起こした者が満たす必要のある標的の条件(`types`、`tags`、`upToSize`、`atLeastSize`)を指定します。リアクションのエントリーの`"strikesWith": "melee"`は、その瞬間を引き起こした者に対して、機会攻撃と同じ方法で、持ち主自身の最良の近接武器の打撃で応答します。エントリー自体のダメージは与えません。`"redirects": true`は、`missed`である`attacked`の瞬間に`"at": "chosen"`とともに使い、外した者に、持ち主が選んだクリーチャーへ同じ攻撃をもう一度行わせます。攻撃を外した者自身は選べず、その攻撃の間合いまたは射程内のクリーチャーに限ります。5eのRetaliationは`{"on": "harmed", "within": 5}`と`strikesWith`、Giant Killerは`{"on": "attacked", "within": 5, "sourceIs": {"atLeastSize": "large"}}`と`strikesWith`、Stand Against the Tideは`{"on": "attacked", "missed": true, "blow": "melee", "at": "chosen"}`と`redirects`および`"targets": "any"`です。これらのいずれかを使うルールセットにはCapability API 1.422が必要です。

聖域(Capability API 1.423)。戦闘の状態の`"sanctuary": {"save", "difficulty"?, "from"?, "immuneOnSave"?}`は、持ち主に攻撃または有害なエントリーを向ける者に、まず`save`のダイスを振らせます(範囲は除き、持ち主自身には決して適用しません)。難易度は、その状態を付与したときのものを使い、それがなければ持ち主のシートから`difficulty`を読み取ります。失敗した場合、その攻撃やエントリーは、狙えるほかのクリーチャーのうち、すでにその標的に含まれず、聖域を持たない最も近い者に向かいます。該当する者がいなければ失われます。`from`は標的の条件を満たす攻撃者に限定し、`immuneOnSave`は、セーヴに成功した者をその戦闘の残りの間、影響から解放します。5eのSanctuaryは`{"save": "wis_save"}`を持つ状態で、呪文のセーヴ難易度とともに呪文によって付与され、`endsWhenHolder`の攻撃と発動で終了します。Tranquilityは同じ状態を大休憩時に付与し、`"difficulty"`はモンクの気のセーヴDCです。Nature's Sanctuaryは`{"save": "wis_save", "difficulty": <spell save DC>, "from": {"types": ["beast", "plant"]}, "immuneOnSave": true}`で、特性により付けたままにします。これを使うルールセットにはCapability API 1.423が必要です。

カタログのエントリーが付与したものの終了(Capability API 1.424)。カタログのエントリーの`"endsSpells": {"catalogs", "count"?, "upTo"?, "above"?}`は、効果を受けた各クリーチャーについて、それらのカタログのエントリーが付与した状態を、レベルの高い順に最大`count`個終了します。`upTo`以内のもの(`"paid"`ならエントリーが支払った段階のレベル、または数値)はそのまま終了し、それを超えるものは、使用者のシートから読み取る値`above.check`による判定で、`above.dc`にそのレベルを加えた難易度を満たした場合のみ終了します。`upTo`がなければ、どれもそのまま終了します。術者の集中で維持されているものは、その呪文全体を終了します。5eのDispel Magicは`{"catalogs": ["spells"], "upTo": "paid", "above": {"check": {"derived": "spellcasting_mod"}, "dc": 10}}`で、Cleansing Touchは`{"catalogs": ["spells"], "count": 1}`を持つ`utility`です。これを使うルールセットにはCapability API 1.424が必要です。

敵に届く発動と、聖域が防ぐもの(Capability API 1.425)。付与される状態の`endsWhenHolder`は、`casts`に加えて`"castsAtFoes": true`を取ります。その場合、それらのカタログからの発動が持ち主の敵に届いたときだけ終了します。敵を狙うものや、その範囲または被害が敵を巻き込むものが該当するため、Sanctuaryで防護されたクレリックは、味方にCure Woundsを発動しても防護を保ちます。戦闘の状態の`sanctuary`は`"against": {"attacks"?: true, "casts"?: [catalogs]}`を取り、すべての有害なエントリーではなく、攻撃と、それらのカタログから発動した有害なエントリーだけを止めます。5eのSanctuaryは`{"attacks": true, "casts": ["spells"]}`、Nature's Sanctuaryは`{"attacks": true}`です。どちらを使うルールセットにもCapability API 1.425が必要です。

状態を付与する休息(Capability API 1.426)。休息の`"puts": [{"condition", "when"?}]`は、その休息が終わると、`clear`の後で、`when`(`{"value", "atLeast"?, "atMost"?}`)を満たすシートに各ライブの状態を付与します。`clear.conditions`にも指定すれば、そのような休息のたびに新たに付与し直します。戦闘で取り除かれたものは、それまで外れたままです。戦闘の状態自体の`endsWhenHolder`にも、`"attacks": true`と`"casts": [catalogs]`、および上記の`"castsAtFoes": true`を指定できるようになりました。これにより、休息によるものも含め、どのように付与されたかにかかわらず状態を終了し、シートから取り除けます。5eのTranquilityは、大休憩の`{"condition": "tranquility", "when": {"value": {"derived": "monk_18"}, "atLeast": 1}}`で、その状態は、モンクのシートから難易度を読む`sanctuary`であり、`endsWhenHolder`は`{"attacks": true, "casts": ["spells"], "castsAtFoes": true}`です。どちらを使うルールセットにもCapability API 1.426が必要です。

一時ポイントを取り除く休息(Capability API 1.804)。休息の`"clear": {"temp": true}`は、休息が終わると、回復処理の後にすべてのプールの一時ポイントを取り除きます。これがなければ、休息は一時ポイントをそのまま残します。5eの大休憩は、一時ヒットポイントが大休憩まで持続するため、これを取り除きます。これを使うルールセットにはCapability API 1.804が必要です。

`endsSpells`が終了するものの選択と、持続する範囲の終了(Capability API 1.427)。`"chosen": true`では、レベルの高い順ではなく、使用者が、標的の持つそれらのカタログ由来の状態のうち、終了するものを最大`count`個選びます。5eのCleansing Touchは`{"catalogs": ["spells"], "count": 1, "chosen": true}`です。`"zones": true`では、クリーチャーの代わりに、それらのカタログのエントリーが残した、間合い内の持続する範囲を狙えます。同じ`upTo`と`above`の条件で、その範囲と、それを維持する集中を終了します。Wall of FireやCloudkillに対するDispel Magicが該当します。`endsSpells`は、カタログのエントリーと同様、アイテムの`use`と`moreUses`にも使えます。Dispel MagicのSpell Scrollは`{"catalogs": ["spells"], "upTo": 3, "above": {...}, "zones": true}`です。`chosen`または`zones`を使うルールセットにはCapability API 1.427が必要です。

範囲内への武器の打撃と、追加の打撃(Capability API 1.428)。`area`と`"strikesWith": "melee"`または`"ranged"`を持つ`utility`エントリーは、その範囲に入る反対側の各クリーチャーへ、使用者のその種類の最良の武器で打撃を行います(`"targets": "any"`ならどちらの側も対象です)。それぞれに別の攻撃ロールと一発の弾薬を使い、弾薬が尽きると止まります。遠隔のもので独自の`range`がない場合、武器が届く距離まで配置できます。5eのWhirlwind Attackは`{"kind": "utility", "strikesWith": "melee", "area": {"shape": "burst", "size": 5, "around": true}}`、Volleyは`{"kind": "utility", "strikesWith": "ranged", "area": {"shape": "burst", "size": 10}}`です。戦闘の状態またはレベルの`"strikesAgain": {"within"}`は、持ち主の各ターンに一回、一体のクリーチャーへの武器攻撃の後に、最初のクリーチャーから`within`以内かつ武器の間合い内にいる別のクリーチャーへ、同じ武器でコストなしの打撃を行わせます。Horde Breakerは`{"within": 5}`です。どちらを使うルールセットにもCapability API 1.428が必要です。

シート上の選択と、攻撃、判定、セーヴで使うシートの値(Capability API 1.429)。シートのテキストまたは列挙型のフィールドは、Engineが語句として読み取る選択を保持できます。カンマで区切り、大文字と小文字は区別しません。修正値の`"atTypesIn": [fields]`は、それらのフィールドのいずれかが種別またはタグをIDかラベルで指定しているクリーチャーに対してのみ、持ち主自身の攻撃またはダメージを変更します。戦闘の状態の`"resistIn": [fields]`は、それらが指定するダメージ種別に抵抗します。変更の`"damageTypeIn": field`は、エントリー自身または条項が、そのフィールドの指定する種別のダメージを与えるエントリーだけを変更します。修正値の`add`(持ち主のシートから読み取る値)は、ダメージに加えて`attacks`、`checks`、`saves`にも使えるようになり、`rescue`があればダイスと同様に適用を保留します。適用を保留する攻撃の変更は`"oncePer": "own-turn"`を指定でき、持ち主の各ターンに一回だけ数え、その状態とともに消費することはありません。また、`"orDamage": true`を指定でき、それを使わずに攻撃が命中した場合、その打撃のダメージに適用します。ダメージ修正値も`"oncePer": "own-turn"`を指定できます。判定の変更は`"proficient": true`を指定でき、戦闘中でも戦闘外でも、持ち主が習熟ボーナスの全量を加えるスキルでのみ適用します。5eのFoe Slayerは、付けたままにする状態で、`{"to": "attacks", "add": {"abilityMod": "wis"}, "rescue": true, "oncePer": "own-turn", "orDamage": true, "atTypesIn": ["favored_enemies"]}`を持ちます。Elemental Affinityは、変更`{"catalogs": ["spells"], "damageTypeIn": "draconic_damage_type", "damageOnce": {"abilityMod": "cha"}}`に加え、1魔力ポイントを消費する無償のユーティリティで、`"resistIn": ["draconic_damage_type"]`を持つ一時間の状態を付与します。Natural Explorerは、適用する(`contextual`)効果`{"modifiers": [{"to": "checks", "abilities": ["int", "wis"], "proficient": true, "add": {"derived": "proficiency_bonus"}}]}`で、得意な地形はGame Masterが読むテキストフィールドに記入します。これらのいずれかを使うルールセットにはCapability API 1.429が必要です。

命中させた攻撃者に対する防御と、機会攻撃だけへの適用(Capability API 1.430)。`"afterHitBy": true`を持つ`defense`の修正値は、そのターンにすでに攻撃で持ち主に命中させたクリーチャーに対してのみ適用します。5eのMultiattack Defenseは、`{"to": "defense", "flat": 4, "afterHitBy": true}`を持つ、付けたままにする状態またはレベルです。`"opportunity": true`を持つ`attacks-taken`の修正値は、持ち主が離れるときに持ち主に対して行われる機会攻撃だけに適用します。Escape the Hordeは`{"to": "attacks-taken", "mode": "disadvantage", "opportunity": true}`です。どちらを使うルールセットにもCapability API 1.430が必要です。

集中なしの維持と、セーヴ成功時だけの影響免除(Capability API 1.431)。エントリーの`"sustains": {"budget"}`は、そのエントリーがクリーチャーに付与した、数ラウンド続く状態がまだ付いている間、その行動枠で再び提示します。使うと、その時点で付与したかのようにラウンド数を数え直します。コストもセーヴもその他の処理もなく、まだその状態が付いているクリーチャーだけを対象にできます。`"oncePerTarget": {"until", "whenSaved": true}`は、セーヴに成功したクリーチャーだけを、その休息まで影響から免れさせます。5eのIntimidating Presenceは、30フィート以内の一体のクリーチャーにアクションで使う`debuff`で、8 + 習熟 + Charismaに対するWisdomのセーヴを行い、恐怖状態を`{"duration": {"rounds": 1, "of": "source"}, "endsAway": {"beyond": 60, "unseen": true}}`で付与します。さらに`"sustains": {"budget": "action"}`と`"oncePerTarget": {"until": "long", "whenSaved": true}`を持ちます。どちらを使うルールセットにもCapability API 1.431が必要です。

地表の進み方(Capability API 1.432)。戦闘の状態またはレベルは`"ignoresHardGround": true`を指定できます。盤面では、地面自体による移動困難(地形や植物)であれば、持ち主は通常の一歩のコストで進めますが、呪文が作る持続する範囲の移動困難は、引き続き全コストを数えます。一段上る場合は、引き続きさらに一歩分を要します。また、`"runsAcross": true`を指定できます。持ち主は徒歩でどの高さへも進め、登攀する者と同じく移動先の地面のコストを払い、水上は通常の一歩で渡れます。ただし、泳ぐか飛ぶことができなければ、水上は停止場所として決して提示されません。水上で歩行が中断された場合(途中で動きを止められた場合)、最も近い空いた地面に下ろされ、ログに記録されます。派生値から読み取るレベルは、その値に達している間だけ有効なので、防具による制限は派生値で表します。5eのLand's Strideは、特性の列を数える派生値に基づくレベルで(6レベルの大地のドルイドと、8レベルのレンジャー)、`ignoresHardGround`を持ちます。Entangleに対するセーヴの有利は、`against`が`{"actions": ["Entangle"]}`であるセーヴ修正値です。9レベルのUnarmored Movementは、「防具も盾もなし」に「9レベル以上のモンク」を掛ける派生値に基づくレベルで、`runsAcross`を持ちます。どちらを使うルールセットにもCapability API 1.432が必要です。

遠方または視界外(Capability API 1.433)。付与される状態の`"endsAway": {"beyond", "orUnseen": true}`は、持ち主が、付与した者から`beyond`より遠い場所にいるか、その者を見られない状態でターンを終えたとき、いずれの場合も状態を終了します。確認するのはその時点だけで、歩行の途中には確認しません。`"unseen": true`(1.310)は引き続き両方を必要とし、歩行の各ステップが終わるときと、各ターンが終わるときに確認します。一つのエントリーには、この二つのうち一方を指定します。5eのIntimidating Presenceは、`"endsAway": {"beyond": 60, "orUnseen": true}`で恐怖状態を付与します。「クリーチャーが、付与した者への視線が通らない場所、または付与した者から、60フィートより遠い場所でターンを終えると、この効果は終了します」。これを使うルールセットにはCapability API 1.433が必要です。

休息で指定する行と、シートから読み取る制限(Capability API 1.434)。休息の`listPools`に対する`restore`ステップは、一つの`row`を指定できます。リストの名前列で、大文字と小文字を区別せずに照合し、その行のプールだけを回復します。また、どの回復ステップも`"when": {"value", "atLeast", "atMost"}`を指定できます(片方の境界または両方)。シートから読み取る値がその範囲内にある間だけ回復します。5eのSorcerous Restorationは、小休憩のステップ`{"listPools": "counters", "row": "Sorcery Points", "by": {"const": 4}, "when": {"value": {"field": "level_sorcerer"}, "atLeast": 20}}`です。「小休憩を終えるたびに、消費した魔力ポイントが、4ポイント回復します」もので、最大値を超えることはありません。どちらを使うルールセットにもCapability API 1.434が必要です。

どの形態でも維持するアクションと、構成要素の免除(Capability API 1.435)。戦闘の状態またはレベルは`"shapeKeeps"`を指定できます。持ち主がどの形態になっても、形態自体の`keeps`が指定するものに加えて、持ち主自身のアクションのうち、ここで指定したものも維持します。記法は同じで、エントリー(`"<catalogId>/<entryId>"`)またはアクションIDで指定します。また、形態の`keeps`または`shapeKeeps`は、`"<catalogId>/*"`でカタログ全体を指定できます。さらに、`"waives"`は、持ち主が何かを使う際に不要になる構成要素(`combat.components`のもの)を指定します。そのため、構成要素を禁じるもの(Silenceや猿ぐつわ)は、それを使わずに使用するものを止めず、免除された構成要素によって隠れている者が露見することもありません。5eのBeast Spellsは、18レベルのドルイドで、1に達する派生値に基づくレベルで、`"shapeKeeps": ["spells/*"]`を持ちます(Wild Shapeの状態で、野獣には用意できない物質構成要素を禁じられます)。Archdruidは、20レベルのドルイドで有効になるレベルで、`"waives": ["verbal", "somatic"]`を持ちます。どちらかを使うか、`keeps`でカタログ全体を指定するルールセットにはCapability API 1.435が必要です。

何もしなかったターンでの終了(Capability API 1.436)。戦闘の状態の`"endsIdle": true`は、持ち主が前のターンを終えてから、敵への攻撃もダメージを受けることもなくターンを終えると、その状態を取り除きます。`{"unless": {"value", "atLeast", "atMost"}}`では、持ち主のシートから読み取る値がその範囲内にある間、付けたままにします。5eのRageは`"endsIdle": {"unless": {"value": {"field": "level_barbarian"}, "atLeast": 15}}`です。Persistent Rageを得るまでは、「…ターンが終わり、前のターン以降に敵対的なクリーチャーを攻撃しておらず、その間にダメージも受けていない場合、早期に終了します」。これを使うルールセットにはCapability API 1.436が必要です。

特定の行だけの維持や免除(Capability API 1.437)。状態またはレベルは、`shapeKeeps`または`waives`に加えて、`"rowsWhere": {"list", "column", "is": [...]}`を指定できます。その場合、それらは、そのシートのリストで、指定した列が`is`のいずれかを含む行から作られたアクションだけに及びます。大文字と小文字は区別せず、種族の特徴、アイテム、クリーチャー自体のアクションには決して及びません。5eのBeast SpellsとArchdruidは「自身のドルイド呪文」を対象にし、`"rowsWhere": {"list": "spells", "column": "class", "is": ["Druid"]}`を使います。そのため、18レベルのドルイド / 2レベルのウィザードのキャラクターは、野獣の形態ではウィザードの呪文を維持しません。これを使うルールセットにはCapability API 1.437が必要です。

発動と集中の禁止、およびダウンによる終了(Capability API 1.438)。戦闘の状態の`forbids`は`"casts": [catalogs]`を指定でき、その状態が続く間、それらのカタログから発動するものは何も提示されません(それらのカタログから発動するアイテムの使用も含みます)。また、`"concentration": true`を指定でき、集中を必要とするものは何も提示されず、付与された時点で持ち主が集中しているものはすべて終了します。これらに`components`を併記する必要はなくなりました。`endsWhenHolder`(状態自体、またはアクションが状態を付与する箇所)は`"downed": true`を指定できます。持ち主がダウンするか戦闘から脱落すると取り除かれます。5eのRageは、`"forbids": {"casts": ["spells"], "concentration": true}`と`"endsWhenHolder": {"downed": true}`です。1.438からはさらに、`rowsWhere`が読む列のセルを持たない行(ビルダーがカタログから追加した、クラスを持たない呪文)は、その列の`default`を持つとみなします。5eのクラス列はデフォルトが`"any"`なので、`"is": ["druid", "any"]`に一致します。これらを使うルールセットにはCapability API 1.438が必要です。

状態またはレベルによる特定種別の察知(Capability API 1.439)。`aware`(特徴の`hiding.aware`、または今回追加された、戦闘の状態やレベル自体の`aware`で、その状態やレベルが有効な間だけ有効です)は、`"of"`を指定できます。これは`combat.creatureTypes`の種別、タグ、サイズによる標的の条件で、`within`以内にいる、それらに該当するクリーチャーだけが、持ち主から隠れられなくなります。また、`"uncovered": true`を指定でき、その場合、持ち主までの線が完全遮蔽で遮られていない者だけに適用します。すでに隠れている者は、次のステップが終わると発見されます。5eのDivine Senseは、パラディンの次のターンの終了まで付与する状態で、`"aware": {"within": 60, "of": {"types": ["celestial", "fiend", "undead"]}, "uncovered": true}`を持ちます。Primeval Awarenessはスロットごとに一分続く状態で、`"aware": {"within": 5280, "of": {"types": [...]}}`を持ちます。これらを使うルールセットにはCapability API 1.439が必要です。

状態を得ることによる終了(Capability API 1.440)。`endsWhenHolder`(状態自体、またはアクションが状態を付与する箇所)は`"gains": [conditions]`を指定できます。持ち主がそれらのいずれかを持つと、どのように付与されたかにかかわらず取り除かれます。状態に自身を指定することはできません。5eのRageは「気絶状態にされた場合」に終了します。打撃による場合でも、ヒットポイントが、0を上回ったままSleepによる場合でも同様で、`"endsWhenHolder": {"downed": true, "gains": ["unconscious"]}`を使います。これを使うルールセットにはCapability API 1.440が必要です。

ダイスの結果次第で成功する使用(Capability API 1.441)。カタログのエントリーの仕組みは`"chance": {"sides", "atMost", "sure", "failUses"}`を指定できます。コストの支払い後、`sides`面のダイスを一つ振り、`atMost`(数値、または使用者のシートから読み取る値)以下の場合だけ成功します。`sure`(シートの値の範囲)が成り立つ間は、ダイスを振らずに成功します。失敗すると何も起こりません。`failUses`があれば、支払ったコストを回復し、代わりにそのシート行の使用回数を消費します。エントリーは、その行が支払える間だけ提示します。5eのDivine Interventionでは、休息で再充填しない専用のカウンター行と、大休憩で再充填する「Divine Plea」カウンターを同じエントリーに置きます。`"usesOf"`で専用の行を指定し、使用時にはその行だけを消費するようにして、`"chance": {"sides": 100, "atMost": {"field": "level"}, "sure": {"value": {"field": "level"}, "atLeast": 20}, "failUses": "Divine Plea"}`を持たせます。クリーチャーのアクションは`"chance": {"sides": 100, "atMost": 30}`を指定できます。30パーセントで成功するデーモンの召喚で、成否にかかわらず使用回数を消費します。ログには出目を記録します。これを使うルールセットにはCapability API 1.441が必要です。

終了する状態の選択(Capability API 1.442)。カタログのエントリーの`ends`は`"chosen": true`を指定できます。メニューは各標的について、持っている`conditions`を提示し、使用者が終了するものを最大`count`個選びます。呪文に対する`endsSpells.chosen`と同じです。何も選ばなければ、従来どおり、指定された順で、持っているものから終了します。5eのGreater Restorationは「以下の効果のうち一つ」を終了し、`"ends": {"conditions": ["charmed", "petrified", "cursed", ...], "count": 1, "chosen": true}`を使います。これを使うルールセットにはCapability API 1.442が必要です。

確率による失敗で消費するのは指定した行だけ(Capability API 1.443)。`failUses`は、`usesOf`と同様に、そのカウンター行だけを消費し、そのエントリーのほかの行は決して消費しません。そのため、Divine Intervention自体の行とDivine Pleaの行を同じエントリーに置けます。失敗すると、前者を残し、後者を消費します。両方を同じエントリーに置くルールセットは、Capability API 1.443を宣言してください。

存在だけの感知(Capability API 1.444)。戦闘の状態は`"presence": {"within": N, "of": {"types": [...]}}`を指定でき、`within`はルールセットの距離で表します。付与時と持ち主の各ターンの開始時に、指定した種別のどれがその間合い内にいるか、またはどれもいないことをログに記録します。どこにいるかや何体いるかは記録しません。隠れることには影響しません。5eのPrimeval Awarenessは`"presence": {"within": 5280, "of": {"types": ["aberration", "celestial", "dragon", "elemental", "fey", "fiend", "undead"]}}`で、得意な地形では、31680です。これを使うルールセットにはCapability API 1.444が必要です。

ゲーム内の日数による再充填(Capability API 1.445)。リストの`pools`は、`rechargeColumn`の値に対して`"rechargeDays": {"<recharge value>": N}`を指定できます。その再充填を持つ消費済みの行は、シートの`pass`コマンドが経過したと示す日数を数えます(`[sheet: who="Name" op="pass" days="N"]`で、Game Masterにも伝えられます)。Nに達すると再び満たされます。休息はその日数を変えません。5eのDivine Interventionは、カウンターの再充填列に`week`値を設け、`"rechargeDays": {"week": 7}`とし、専用の行を`week`にします。これを使うルールセットにはCapability API 1.445が必要です。

使用回数の集計(Capability API 1.801)。リストの`pools`は、真偽値または数値の列を`tallyColumn`として指定できます。その列が設定されている行(true、または、0より大きい値)は、消費するものではなく回数の集計になります。シートはそのプールを、再充填以降に使った回数として表示し(「Used 2 times」)、消費ボタンや回復ボタンは表示しません。Game Masterのシートブロックでも同様です。最大値は、数えられる上限にすぎません。消費すると使用一回を数えるため、持ちこたえる効果の`save.tally`(1.404)は従来どおりこれを指定します。5eのRelentless RageとOverchannelでは、カウンター行でその列を設定し、大休憩で集計を最初からやり直します。これを使うルールセットにはCapability API 1.801が必要です。

儀式(Capability API 1.807)。リストは、真偽値の列を`ritual`列として指定できます。その列にチェックが入っている行は、戦闘外で儀式として使用できます。Game Masterは、シートコマンド`use`に`ritual="yes"`を付けて要求します(`[sheet: who="Mira" op="use" name="Detect Magic" ritual="yes"]`で、プロンプト内でこの方法を伝えられます)。この方法で使う場合、`mechanics`内のコストも専用のカウンター行も含め、プールを一切支払いません。ただし、必要な価格付きの物質は引き続き必要で、引き続き消費します。その列にチェックがない行を儀式として使うと、`not-ritual`として拒否されます。発動時間が長くなることなど、儀式に必要なほかのことは物語に委ねます。5eの儀式呪文では、呪文リストに`"ritual": "ritual"`を、各儀式呪文の行に`"ritual": true`を指定します。これを使うルールセットにはCapability API 1.807が必要です。

儀式を発動できる者(Capability API 1.809)。`ritual`列のあるリストは、カタログのエントリー(`<catalog>/<entry>`)のリストである`ritualNeeds`を指定できます。その場合、どれかのリストに、それらのエントリーのいずれかに由来する行を持つシートだけが、行を儀式として使えます。それ以外は`not-ritual`として拒否されます。5eのRitual Castingでは、呪文リストの`"ritualNeeds"`に各クラスのRitual Casting特性を指定するため、儀式呪文を持つソーサラーはスロットを使う場合だけ発動できます。これを使うルールセットにはCapability API 1.809が必要です。

休息を取れる頻度(Capability API 1.810)。休息は、ゲームの時計の時間単位で`every`を指定できます。その場合、前回のその休息の開始からその時間が経過するまで、`rested-already`として拒否されます。5eの大休憩が、24時間に一回(`"every": 24`)であるのと同様です。`every`がない場合、または時計を管理しないゲームでは、ある種類の休息を拒否するのは、同じ返信内かその前の返信内で取った場合、またはそれ以降に時間が経過していない場合だけです。これを使うルールセットにはCapability API 1.810が必要です。

使用時に取り出すアイテム(Capability API 1.808)。アイテムのブロックは`"drawOnUse": { "categories": [...], "tags": [...] }`を指定できます(片方または両方で、そこで宣言したIDです)。そのカテゴリーのいずれかに属するか、そのタグのいずれかを持つ、スロットを占有するアイテムは、引き続き装備中だけスロットを占有し、空きがあるときだけ装備できます。手が二つなら、武器を二つ手に持つと三つ目を装備する余地はなく、両手用の弓はほかのものと同時には持てません。ただし、使用するために先に装備しておく必要は一切ありません。Use(使用)ボタン、Game Masterの`[inventory: action="use"]`、Engine自体の戦闘のアイテムメニュー、ルールセットの戦闘の攻撃は、いずれも携帯しているだけの状態で使用でき、使うと無償の持ち替えで装備します。そのスロットが埋まっている場合は、そこを占有する、同じく使用時に取り出すほかのアイテムを、最小数だけ先にしまいます。そのためにほかのものを外すことは決してなく、防具、盾、拘束された呪われたアイテムのいずれも外しません。それらを外さなければ空きを作れない場合、使用は`slots-full`として拒否され(Useボタンに妨げているものの名前が出ます)、戦闘では提示されません。この指定のないルールセットは変わらず、スロットを占有するアイテムは、着用中だけ使用できます。5eの武器は、振るか撃つまで鞘に収めるか肩に掛けておくものとして、`"drawOnUse": { "categories": ["weapon"] }`を指定し、`hands`スロットを、2とし、片手武器を`"slots": { "hands": 1 }`、両手武器を`"slots": { "hands": 2 }`にします。これを使うルールセットにはCapability API 1.808が必要です。

ルールセットの戦闘では、画面のIn hand(手に持っているもの)行に、ターン中の戦闘者が武器用のスロットに持っているものを表示します。また、ルールセットが`drawOnUse`を指定しているかどうかにかかわらず、自分のターンに、同じ規則で携帯中の武器や盾を手に持たせることができます。妨げる武器を最小数だけしまい、それ以外は決してしまいません(盾や防具が妨げる場合は、その名前を示して拒否します)。その後、手に持っているものから攻撃を読み直します。これには、そのターンに一回だけ無償で行える物体とのやり取り、つまり落ちているものをコストなしで拾うために使うもの(1.266)を消費するため、同じターンに二回目は拒否されます。バッグから弾薬を使って撃つ各武器の横では、どのスタックを先に使うかをその行で選べます。どちらも、戦闘中のほかのアイテム変更と同様にインベントリーへ書き戻し、どちらにもルールセット側の追加指定は要りません。

単独の回復操作が回復できるもの。Game Masterの`[sheet: op="restore"]`で、休息でしか回復しないプールを回復する操作は、そのキャラクターが、そのプールを回復する休息を取る返信内だけで適用します。これは、ルールセットの`rests`のいずれかが回復する、体力以外のプールを指します。ただし、いずれかの休息が固定の`by: {"const": N}`だけで回復するものは除き、そのようなポイントは物語でも与えられるものとみなします。それ以外の場合でも、シートに、そのプールのグループを`recovers`(1.410)で指定するエントリーがちょうど一つあれば、回復操作をそのエントリーの使用として扱います。ただし、そのエントリーに`atRest`(1.789)がある場合は、同じ返信内でその休息を取る必要があります。`recover`にプールと量を設定し、通常の使用と同様にカウンター行を支払います(消費済みなら拒否されます)。これらの条件を満たさなければ`rest-only`として拒否されます。アイテムの使用、休息、エントリー自体の使用は、従来どおりプールを回復します。

クリーチャーの選択式の呼び出しと、ラウンド数または呼び出し手に連動した持続(Capability API 1.446)。クリーチャーのアクションの`calls`は、一つの`creature`と`count`の代わりに、8個を上限として`options`を列挙できます。各要素は`{"creature": "<catalogId>/<entryId>", "count": ..., "label": ...}`です。また、カタログのエントリーの呼び出しと同様、カタログを`from`で指定して読み取ることもできます。使用者は使用時に一つを選び、アクションの`uses`は選択肢間で共有します。`"rounds": N`は、呼び出し手の次のターンから数えてNラウンドが経過すると帰します。`"endsWithCaller": true`は呼び出し手が戦闘から脱落するとすぐに帰し、`"cantCall": true`は、それら自身の呼び出しアクションを一切持たせずに呼び出します。5eのSummon Demonでは、ヴロックに`{"options": [{"creature": "creatures/dretch", "count": {"dice": "2d4"}, "label": "2d4 dretches"}, {"creature": "creatures/vrock", "count": {"flat": 1}, "label": "Another vrock"}], "rounds": 10, "endsWithCaller": true, "cantCall": true}`を指定し、`"uses": {"per": "day", "count": 1}`と、30パーセントの`chance`を持たせます。これを使うルールセットにはCapability API 1.446が必要です。

高いコストによる持続時間の延長(Capability API 1.447)。エントリーが`applies`で付与するものの、ラウンド数による`duration`には、`"perStep": N`を追加できます。Conjure Animalsの`timesPerSteps`と同じ数え方で、支払ったコストが高い段階に一つ上がるごとに、Nラウンドを追加します(生得的な発動では、基本レベルを超えるレベル数を数えます)。5eのPrimeval Awarenessの「消費する呪文スロットのレベルごとに、1分」は、1レベルのスロットをコストとして、`{"rounds": 10, "perStep": 10}`を使います。これを使うルールセットにはCapability API 1.447が必要です。

複数のうち一つの付与(Capability API 1.448)。エントリーの仕組みは、二つ以上の`applies`とともに`"appliesOneOf": true`を指定できます。使用者は、状態の名前をラベルとする武器のモードと同じように、使用時に一つを選び、何も選ばなければ最初のものを付与します。同じ方法で選択する`cureOneOf`、`kindChoice`、`forms`、`calls`、`conjures`とは併用しません。5eのPrimeval Awarenessでは、`"presence": {"within": 5280, ...}`を持つ状態と、六マイルの範囲を持つもう一つの状態「Primeval Awareness (favored terrain)」を用意し、レンジャーが得意な地形にいるときに後者を選びます。これを使うルールセットにはCapability API 1.448が必要です。

呼び出した者を帰す(Capability API 1.449)。クリーチャーのアクションの`calls`は`"dismissible": true`を指定できます。その場合、呼び出し手は、呼び出した者を全員帰すアクションを持ちます。これは呼び出しアクション自体の行動枠を使い、呼び出した者の誰かがまだいる間だけ提示されます。`cantCall`では、呼び出された者には、このアクションも、いかなる呼び出しアクションも与えません。5eのSummon Demonの「召喚者が死ぬか、アクションで帰すまで」に当たります。これを使うルールセットにはCapability API 1.449が必要です。

残りの体力による処理(Capability API 1.450)。エントリーの`applies`には`"targetHealthAtMost": N`を指定できます。適用時の体力がN以下の標的にのみ付与します。仕組みには`save`とともに`"killsAtMost": N`を指定できます。セーヴに失敗し、体力がN以下の者は、その者に対して行う他の処理すべてに代えて即死します。また、`dismisses`に添えた`"dismissesIs"`は、それに該当する者だけを退去させます。5eのDivine Wordでは、50以下で聴覚を失った状態、40以下で盲目状態、30以下で朦朧状態を付与し、`"killsAtMost": 20`と`"dismisses": true, "dismissesIs": {"types": ["celestial", "elemental", "fey", "fiend"]}`を指定します。これを使うルールセットにはCapability API 1.450が必要です。

グリフ(Capability API 1.451)。ゾーンの`detonates`には`"entered": true`を指定できます。術者以外の誰かがゾーンのいずれかのマスに歩いて入ると、その移動者自身のセーヴを行わずに即座に起爆します。起爆するのはこの場合だけで、時間切れでは起爆しません。`"by"`(標的の条件)を指定すると、それに該当する者だけが起爆させます。`"within": N`を指定すると、起爆時にはゾーンのマス内の者だけでなく、中心からルールセットの距離でN以内にいる全員に届きます。5eのGlyph of Warding(爆発のルーン)は、`rounds`を、1000とする小さなバーストに`{"entered": true, "within": 20}`を指定します。Symbolはシンボルごとにエントリーを作り、`"within": 60`とします。これを使うルールセットにはCapability API 1.451が必要です。

特定の者の侵入を防ぐ処理(Capability API 1.452)。ゾーンには`"keepsOut": {"is": <target test>}`を指定できます。一致する者は歩いて中に入れません(`"way": "out"`を指定すると、中に入った後は歩いて外に出られません)。`"attacksInto": "disadvantage"`を指定すると、その者が外から内部に立っている者を攻撃する場合、不利になります。`"cantGive"`には、その者が内部に立っている者に付与できない状態を列挙します。5eのMagic Circleは、選んだ種別を対象とする、10フィートの円筒で、`{"is": {"types": ["fiend"]}, "attacksInto": "disadvantage", "cantGive": ["charmed", "frightened"]}`とし、種別ごとにエントリーを作るか、`way: "out"`で閉じ込めます。Hallowの防護も同じ処理を、60フィートにわたって行います。これを使うルールセットにはCapability API 1.452が必要です。

起爆後も残るゾーン(Capability API 1.453)。`detonates`を持つゾーンには、起爆後の姿を`becomes`で指定できます。`"becomes": {"size": <radius>, "rounds": <n>, "triggers": [...], "lights"?: {"bright": .., "dim": ..}}`です。その後は、中心の周囲にルールセット独自の単位で指定サイズのバーストとして、そこで指定したラウンド数だけ残り、指定したトリガーでエントリー自身の効果を再び適用し、指定した光を放ちます。再起爆はせず、ラウンドが尽きると終了するだけです。5eのSymbolでは、起爆したグリフが、60フィートの球体を十分間薄暗い光で満たし、中に入るか内部でターンを終える者に作用します。`{"size": 60, "rounds": 100, "triggers": ["enter", "turn-end"], "lights": {"bright": 0, "dim": 60}}`です。これを使うルールセットにはCapability API 1.453が必要です。

呪文のグリフ(Capability API 1.454)。誰かが`entered`して起爆するゾーンには、`"stores": true`を指定できます。発動時に術者は、シートからコストを支払う自身のエントリーのうち、第一レベル以上で、グリフの支払った段階以下のものをモードとして選び、両方のコストを支払います。起爆すると、グリフ自身の効果に代えて、蓄えたエントリーを起爆させた者に発動します。範囲を持つエントリーなら、その者を中心とする範囲内の全員に発動します。この時点でコストはかからず、術者の集中を必要とするはずの効果も、持続時間いっぱい続きます。モードを選ばなければ、グリフ自身の効果を適用します。5eのGlyph of Wardingの、呪文のグリフまたは爆発のルーンです。これを使うルールセットにはCapability API 1.454が必要です。

隠されたゾーン(Capability API 1.455)。ゾーンには`"hidden": {"check": <check id>}`を指定できます。術者の敵には、そのうちの誰かが発見するまでゾーンが表示されません。この場合、標準アクションの`search`(したがって`combat.hiding`と、`combat.standard`内の`"search"`が必要です)では、その判定も一度行います。捜索者の敵の隠されたゾーンのうち、判定の合計がそのエントリーのセーヴ難易度以上となるものをすべて発見し、捜索者側の全員に見えるようにします。5eのGlyph of WardingとSymbolでは`{"check": "investigation"}`です。これを使うルールセットにはCapability API 1.455が必要です。

術者がいなくなった後も続くゾーン(Capability API 1.456)。ゾーンには`"outlasts": true`を指定できます。術者が戦闘から脱落するか戦闘を離れても、術者とともに終了せずに残り、各ラウンドの終了時に残りラウンドを減らし、通常どおりに起爆または作用します。集中によって維持されることはなく、術者を中心とする固定もされません。5eのGlyph of WardingとSymbolは、起爆または解呪されるまで続きます。これを使うルールセットにはCapability API 1.456が必要です。

誰にも被害を与えない状態と、地点からの逃走(Capability API 1.457)。状態効果の`"cannot-harm"`は、その持ち主による攻撃や、誰かに被害を与えるものの使用を防ぎます。攻撃、有害なエントリー、敵を標的とするあらゆる行為、掴みや突き飛ばし、ダメージを与える範囲、誰かが間合いから出る際の打撃は、いずれも行えません。状態の行動には`"from": "point"`を指定できます。この場合、`moves`と`keepsOut`は、付与した者からではなく、付与元の地点(ゾーンの中心または範囲の照準地点)から測定します。5eのSymbolでは、Hopelessnessは`"cannot-harm"`を持つ状態です。Fearは`{"moves": "away", "from": "point"}`を持つ恐怖状態で、グリフから逃走させます。いずれかを使うルールセットにはCapability API 1.457が必要です。

特定の者を内部に留める処理(Capability API 1.458)。`"way": "out"`を持つ`keepsOut`は、防護の向きが逆になります。その`attacksInto`と`cantGive`は、外部の者から内部の者を守るのではなく、内部に閉じ込めた者から外部に立っている者を守ります。5eのMagic Circleを反転した場合の「指定した種別のクリーチャーが円筒から出るのを防ぎ、外部の標的を守る」処理は、`{"is": {"types": ["fiend"]}, "way": "out", "attacksInto": "disadvantage", "cantGive": ["charmed", "frightened"]}`です。これを使うルールセットにはCapability API 1.458が必要です。

中に入った者の解放(Capability API 1.459)。`keepsOut`には、取り除く状態を`frees`として列挙できます。中に入った者は、それらの状態のうち、このゾーンが締め出す者によって付与されたものを失います。5eのHallowでは、`{"is": {"types": ["celestial", "elemental", "fey", "fiend", "undead"]}, "cantGive": ["charmed", "frightened", "possessed"], "frees": ["charmed", "frightened", "possessed"]}`です。これを使うルールセットにはCapability API 1.459が必要です。

ゾーン内部で効果を受ける者(Capability API 1.460)。ゾーンの`inside`には、その状態と完全耐性が誰に適用されるかを`"is": <target test>`で指定し、`"save": {"save": <save id>, "ignoresUntilLeaves": true}`を指定できます。適用対象者は、中に入るときと、内部で自身の各ターンが始まるときに、エントリー自身のセーヴ難易度に対してそのセーヴを行います。一度成功すると、外に出るまで内部での効果を無視します。5eのHallowでは、選んだ種別に対し、魅力セーヴを伴う追加効果を適用します。Courage、Energy ProtectionまたはVulnerability、Fear(`{"conditions": ["frightened"], "is": {...}, "save": {"save": "cha_save", "ignoresUntilLeaves": true}}`)です。これを使うルールセットにはCapability API 1.460が必要です。

複数ラウンドにわたる発動(Capability API 1.461)。エントリーの仕組みには`"castingRounds": <2 to 10>`を指定できます。使用するとコストを支払って発動を開始し、使用者はその発動に集中します(他に集中していたものは終了します)。続く自身の各ターンの開始時に、再び同じ行動枠を消費し、最後の消費時に当初の照準どおりに効果が適用されます。集中が途切れるか、行動できないか、消費できる行動枠が残っていなければ失敗し、支払ったコストは回復します。5eのSymbolなど、発動時間が一分の呪文では、`"castingRounds": 10`です。これを使うルールセットにはCapability API 1.461が必要です。

戦闘前の設置(Capability API 1.462)。
`zone`を持つエントリーはすべて、戦闘
開始時にすでに設置されている状態にで
きます。Game Masterが戦闘前に誰が何
を設置したかを指定すると(そのパーテ
ィーメンバーまたは敵に
`"standing": [{"entry": <name>, "at": "between" | "self", "stores": <name>}]`
を指定)、Engineはその者のシートから
コストを支払い、今発動したかのように
、その者と最も近い敵との間、またはそ
の者の立っている場所に設置します。集
中が必要なら、その者の集中で維持しま
す。隠されたゾーンは告知せずに設置し
ます。仕組みに`"beforeFight": true`
を指定したエントリーは、発動に戦闘の
長さを超える時間がかかるため、戦闘メ
ニューには表示されず、この方法でのみ
設置できます。5eのGlyph of Warding(
一時間)とHallow(一日)は
`"beforeFight": true`です。一分で発
動するSymbolは、どちらの方法も使えま
す。`beforeFight`を使うルールセット
にはCapability API 1.462が必要です。

ターンの浪費(Capability API 1.463)。状態の行動には`"wastes": {"save": <save id>, "budget": <budget id>}`を指定できます。持ち主の各ターンの開始時に、付与時の難易度に対してそのセーヴを行い、失敗すると、そのターンの指定行動枠が無駄になります。5eのBestow Curseの、ターンを浪費させる選択肢では、`{"save": "wis_save", "budget": "action"}`です。これを使うルールセットにはCapability API 1.463が必要です。

歩行と誘導(Capability API 1.464)。`moves`を持つ状態の行動には、`"walks": true`を指定できます。持ち主の各ターンの開始時に、逆方向への歩行を防ぐだけでなく、その方向へ可能な限り歩かせます。`from`には`"steered"`を指定できます。付与者が最後に誘導先とした地点から測定し、まだ誘導していなければ、どこからも測定しません。仕組みに`"steers": <condition id>`を指定したエントリー(照準用の`area`を伴います)は、使用者がその状態を付与した持ち主全員を、照準地点に向けて誘導し、他の処理は一切行いません。使用者からその状態を受けている者がいる間だけ提示されます。5eのCompulsionでは、呪文が`{"moves": "toward", "from": "steered", "walks": true}`を持つ状態を付与し、ボーナスアクションのエントリーが`"steers"`で誘導します。これらのいずれかを使うルールセットにはCapability API 1.464が必要です。

ゾーンを持たない効果の戦闘前の準備(
Capability API 1.465)。
`"beforeFight": true`は、ゾーンを持
つものに限らず、どのエントリーにも指
定できます。そのエントリーは戦闘メニ
ューには決して表示されません。そのよ
うなエントリーも、それ以外のエントリ
ーも、Game Masterの`standing`リスト
に`"on": [names]`を伴って含められま
す。戦闘開始時に、指定された者のうち
適用可能な者にその効果を適用し、使用
者のシートからコストを支払います(誰
も指定せず、エントリーが使用者または
味方用なら使用者に適用します)。5eの
Heroes' Feast、Foresight、
Antipathy/Sympathyを事前に発動する場
合です。アイテムの使用にも
`"beforeFight": true`を指定できます(
塗布に、10分かかる
Oil of Slipperinessなど)。`standing`
リストでは、メニューと同じ表記(
`"Oil of Slipperiness: Apply the Oil"`
)でも、その使用自体のラベルだけ(
`"Apply the Oil"`)でも指定できます。
準備すると、使用時と同様にアイテムを
消費します。ゾーンを持たないエントリ
ーに`beforeFight`を使うルールセット
にはCapability API 1.465が必要です。

シートへの保持(Capability API 1.798)。クリーチャーを`calls`する`beforeFight`エントリーを、戦闘外でシートコマンドの`use`によって使用すると(`as="Owl"`。`asTypes`でクリーチャー種別を選べる場合は、コンマの後に種別を付けて`as="Owl, Fey"`とします)、呼び出したものを使用者のシートに保持します。シートでは「With them」(同行者)の下に表示され、Game Masterもそこから読み取ります。戦闘中に死亡するか退去させられる、または戦闘外で退去させられるまで(シートコマンドの`dismiss`、またはシート自体の退去ボタン)、再びコストを支払うことなく、使用者が参加するすべての戦闘に加わります。エントリーを再使用すると置き換わります。5eのFind Familiarが該当します。専用のデータは不要で、1.798以降のEngineが、このようなエントリーすべてに対して処理します。

形態も同じ方法で保持します。`forms`を持ち、`self`を標的とするエントリーを、戦闘外で`use`と変身先の形態(`as="Wolf"`)を指定して使用すると、使用者をその形態のまま保持します。エントリーが提示する形態と照合し、戦闘で読み取るものと同じ上限と`without`を適用します。シートでは「In the shape of」(変身中の形態)の下に表示され、Game Masterもそこから読み取ります。次の戦闘はその形態で始まり、再びコストを支払う必要はありません。戦闘終了時にも維持している形態は、その形態の体力と、それを維持する状態とともに残り、その体力が次の戦闘に引き継がれます。戦闘中に倒されたか終了した形態は残りません。シートコマンドの`dismiss`にエントリー名または形態名を指定すると、戦闘外で終了できます。5eのWild Shapeが該当します。こちらも専用のデータは不要です。

内部で適用する種別の選択(Capability API 1.466)。ゾーンの`inside`には、`is`の代わりに`"chooses": "type"`を指定できます。発動時に術者が`combat.creatureTypes`のうち一つをモードとして選ぶと、内部での処理はその種別のクリーチャーにのみ作用します。何も選ばなければ全員に作用します。Game Masterの`standing`リストでは、`"kind": <type>`で選びます。5eのHallowにおける「特定の種類のクリーチャー」に対する追加効果です。これを使うルールセットにはCapability API 1.466が必要です。

瞬間移動を禁じる地面(Capability API 1.467)。ゾーンの`forbids`には、`components`の有無にかかわらず`"teleport": true`を指定できます。内部で効果を受ける者(`inside.is`または選んだ種別に該当し、内部でのセーヴに成功していない者)は、そのゾーンへの瞬間移動、そこからの瞬間移動、内部での瞬間移動のいずれも行えず、内部から瞬間移動して戦闘を離れることもできません。5eのHallowのExtradimensional Interferenceが、Misty Step、Dimension Door、Thunder Stepに対して行う処理です。これを使うルールセットにはCapability API 1.467が必要です。

標的ごとの光線(Capability API 1.468)。エントリーの`"rays": {"dice": "1d8", "rows": [...]}`は、届くクリーチャーごとに一度ダイスを振り、その出目に対応する行(出目が`atMost`以下となる最初の行)がその者に命中します。行はエントリーの`amount`をその行の`damageType`として与え、指定がなければダメージは与えません。また、エントリーの`applies`のうち、その行自身の`applies`で指定したものだけを付与します。`"again": 2`は、さらに二本の光線を命中させます。再びその行に当たった場合は振り直します。標的はそれぞれエントリーの`save`を一度行い、その者に命中する光線はすべて、そのセーヴの結果を読み取ります。成功ならダメージは半分になり、状態は付与しません。光線はそれぞれログに記録します。`save`とともに使い、`attackRoll`は使いません。5eのPrismatic Sprayでは、`{"atMost": 1, "label": "Red", "damageType": "fire"}`から`{"atMost": 5, "label": "Blue", "damageType": "cold"}`までと、`{"atMost": 6, "label": "Indigo", "applies": ["restrained"]}`、`{"atMost": 7, "label": "Violet", "applies": ["blinded"]}`、`{"atMost": 8, "label": "Special", "again": 2}`を指定します。これを使うルールセットにはCapability API 1.468が必要です。

選べる状態の追加(Capability API 1.469)。`"appliesOneOf": true`を持つエントリーには、最大で、12個の`applies`を含めることができ、使用時に一つを選びます。これがなければ、従来どおり最大で、6個です。5eのBestow Curseでは、一つのエントリーに九つの呪いを含めます。これを使うルールセットにはCapability API 1.469が必要です。

支払ったコストに応じた持続時間と集中(Capability API 1.470)。`applies`の持続時間の`"bySteps": [100, 4800]`は、エントリーのコストを一ステップ高く支払った場合、二ステップ高く支払った場合、という順に、代わりにそのラウンド数だけ持続させます。それを超えるすべてのステップには最後の値を使います(`perStep`とは併用しません)。エントリーの`"concentrationBelowStep": 2`は、指定数未満のステップだけ高く支払った場合にのみ`concentration`を維持します。それ以上なら誰も集中を維持する必要はなく、付与したものは持続時間いっぱい続きます。5eのBestow Curseでは、`{"rounds": 10, "bySteps": [100, 4800, 4800, 14400, 14400, 14400]}`に`"concentrationBelowStep": 2`を伴わせます。4レベルのスロットなら十分間、5レベルなら集中で維持せずに八時間続きます。これを使うルールセットにはCapability API 1.470が必要です。

攻撃ロールのないダメージへの変更(Capability API 1.471)。`damage`または`damage-taken`の変更は、攻撃の命中時にのみ適用します。`"alsoUnrolled": true`を指定すると、セーヴによるものや無条件に命中するものなど、攻撃ロールを伴わないダメージにも適用します。セーヴでエントリー自身のダメージが半分になっても、変更による追加分は減りません。5eのBestow Curseの「自身の攻撃と呪文は、標的に追加で、1d8の死霊ダメージを与える」は、`{"to": "damage-taken", "dice": "1d8", "damageType": "necrotic", "fromSource": true, "alsoUnrolled": true}`です。これを使うルールセットにはCapability API 1.471が必要です。

打撃のダメージ種別に応じた、一度で消費するダメージ変更(Capability API 1.792)。`"onTypes"`を持つ`damage`または`damage-taken`の変更(最大で、8種類のダメージ種別を指定し、大文字と小文字は区別しません)は、打撃自身のダメージまたはそのいずれかの条項が、指定した種別のどれかを与える場合にのみ適用します。`damageType`は引き続き、その変更自身が追加するダメージの種別を指定します。`"spentOnUse": true`を指定すると、その変更の元となる状態は、最初にダメージを追加した時点で消費されます。アイテム、レベル、またはシート自体から得た変更は消費されません。戦闘AIは、相手側が指定した種別のいずれかを与える場合にのみその変更を評価し、消費されるものは半分として評価します。5eの油の「油が乾く前に標的が火ダメージを受けた場合、燃える油によって追加で、5の火ダメージを受ける」は、`{"to": "damage-taken", "flat": 5, "damageType": "fire", "onTypes": ["fire"], "spentOnUse": true, "alsoUnrolled": true}`です。いずれかを使うルールセットにはCapability API 1.792が必要です。

歩かされる前の行動(Capability API 1.472)。状態の行動の`"walks": "after"`は、持ち主のターン開始時に歩かせる代わりに、ターン終了時に残りの移動を使って`moves`に従って歩かせるため、先に行動できます。誰かの間合いによって歩行の処理が未完了のままになった場合、その応答を待ってから、再びターンを終了します。5eのCompulsionの「移動前にアクションを行える」は、`{"moves": "toward", "from": "steered", "walks": "after"}`です。これを使うルールセットにはCapability API 1.472が必要です。

体力の最大値の引き上げ(Capability API 1.473)。`applies`エントリーの`"raisesMax": {"dice": "2d10", "flat": 5, "perStep": 5}`(ダイス、固定値、または両方)は、状態が続く間、持ち主の体力の最大値をその分だけ引き上げ、付与時に体力も同じだけ増やします。ダイスは一度振り、`perStep`は付与時に支払ったコストが一ステップ高いごとに、その値をさらに追加します。再び付与すると、新しい増加分が古い増加分を置き換えます。状態が終了すると最大値は元に戻り、それを超える体力も下がります。シートは増加分を状態とともにライブステートに保持するため、その状態が続く限り戦闘後も持続します。負傷トラックには引き上げる最大値がありません。5eのAidは、2レベルのコストに`{"flat": 5, "perStep": 5}`を指定します。Heroes' Feastは`{"dice": "2d10"}`です。これを使うルールセットにはCapability API 1.473が必要です。

他のエントリーの発動(Capability API 1.474)。エントリーの`"duplicates": {"catalog": "spells", "upTo": 8}`は、そのカタログの他のエントリーのうち、レベルが`upTo`以下(かつ、1以上)のものをすべて、持ち主の戦闘メニューに追加します。それぞれ両方の名前を組み合わせた名前(「Wish: Fireball」)の独立した選択肢となり、複製元のエントリーの数値と行動枠を使い、支払いも複製元のエントリーとまったく同じで、複製先自身の構成要素は一切必要ありません。複製元のエントリー自体は、どのメニューにも表示されません。`"only": [ids]`を指定すると、そのエントリーだけに限定します。5eのWishの「8レベル以下の他の任意の呪文を複製する」処理です。これを使うルールセットにはCapability API 1.474が必要です。

二つへの分裂(Capability API 1.475)。クリーチャーの`"splits": {"by": ["lightning", "slashing"], "atLeast": 10, "smallest": "medium"}`は、指定したダメージ種別のどれかの打撃を受けた後も立っていて、体力が`atLeast`以上残っていると分裂させます。同じクリーチャーの二体目が最も近い空きマスに現れ、そのターンは一体目の直後になり、それぞれの体力は一体目が持っていた体力の半分(端数切り捨て)になります。`combat.sizes`を持つ戦闘では、それぞれサイズが一つ小さくなり、すでに`smallest`より小さいものは分裂しません。二体目には、一体目の状態を一切引き継ぎません。5eのBlack PuddingとOchre Jellyが該当します。これを使うルールセットにはCapability API 1.475が必要です。

付与元に応じた付与の防止(Capability API 1.476)。`conditionImmunitiesFrom`のエントリーには、`from`の代わりに、またはそれとともに、`"catalogs": ["spells"]`を指定できます。指定したカタログのいずれかのエントリーがその状態を付与しようとする場合にのみ付与を防ぎ、すでに付与されているものは残ります。5eのFreedom of Movementでは、`{"conditions": ["paralyzed", "restrained"], "catalogs": ["spells"]}`により、魔法による麻痺状態と拘束状態を防ぎます。これを使うルールセットにはCapability API 1.476が必要です。

落下を和らげる、また
は状態の適用を抑える
アイテム(
Capability API 1.477
)。アイテムの`worn`
または`carried`効果
には、状態と同様に
`"fallsSafely": true`
を指定できます。持ち
主は落下ダメージを受
けず、落下で伏せ状態
にもなりません(5eの
Ring of Feather Falling
)。また、
`"suppresses": ["sewer_plague"]`
は、それらの状態を終
了するのではなく、持
ち主への適用を抑えま
す。効果は止まります
が時計は進み続け、ア
イテムを外すと再び適
用されます。5eの
Periapt of Healthは
、病気をここにも
`conditionImmunities`
にも列挙するため、す
でにかかっているもの
は適用を抑え、新たに
かかることは防ぎます
。これを使うルールセ
ットには
Capability API 1.477
が必要です。

特定の地形での適用の抑制(Capability API 1.478)。状態の`"whileOffTerrain": ["water"]`は、持ち主が指定した地形のいずれかのタイルに立っているか、盤面の環境がそのいずれかである間、状態を終了せずに適用を抑えます。効果は止まりますが時計は進み続け、その地形を離れると再び適用されます。盤面のない戦闘では適用されます。5eのアボレスの呪いは、水中以外での回復を防ぐもので、`"effects": ["cannot-heal"]`と`"whileOffTerrain": ["water"]`を持つ状態です。これを使うルールセットにはCapability API 1.478が必要です。

物体または範囲への発動(Capability API 1.479)。`calls`には`"initiative": "none"`を指定できます。呼び出したものはターンを行わず、どちらの側も戦闘に留めないため、それが存在しないものとして戦闘が終了します。また、`calls`と`applies`を持つエントリーには、`"appliesToCalled": true`を指定できます。照準を合わせた者や効果に巻き込まれた者に代えて、呼び出したものに効果を付与し、使用時に指定した種別(`kindChoice`)を記憶します。5eのAntipathy/Sympathyを物体または範囲に発動すると、その物体を表すクリーチャーを呼び出し(`"initiative": "none"`)、それに状態を付与します。その結果、`chosenKind`を持つその状態のオーラが、物体から指定された種別へ広がります。これを使うルールセットにはCapability API 1.479が必要です。

手に持たせた武器の落下(Capability API 1.480)。エントリーの`conjures`が作った武器は、結び付けた武器の場合と異なり、状態の`drops`がその武器の占めるスロットか持っているタグを指定すると、保持しているアイテムと同様に落ち(5eのFear)、同じ方法で拾えます。作り手は引き続き消すことができます。`conjures`に`"vanishes": {"beyond": 5, "rounds": 10}`を指定すると、作り手の各ターンの開始時に、その武器が作り手から`beyond`を超える距離(ルールセットの距離)に落ちている場合、その距離を超えたまま`rounds`回のターンが経過すると消滅します。5eの契約武器の「自身から、5フィートを超えて離れた状態が、1分以上続いた場合」です。従来どおり、再使用、消去、または作り手の死亡によっても終了します。`vanishes`を使うルールセットにはCapability API 1.480が必要です。

他者の目を通した
視認(
Capability API 1.481
)。戦闘状態の
`"lendsSenses": true`
は、その状態が続
く間、付与者が自
身の見ているもの
に加えて持ち主の
見ているものも見
えるようにします
。これは、誰が誰
を見ているかを読
み取るすべての処
理に適用します。
視認が必要な標的
、見えていない者
への攻撃、視認を
必要とするオーラ
などです。付与者
からは隠れていて
も、持ち主から隠
れていない者は、
それを通して見え
ます。5eで使い魔
の目を通して見る
場合は、使い魔を
呼び出す際にこの
指定を持つ状態を
使い魔に付与する
か(
`appliesToCalled`
、1.479)、ウォー
ロックのアクショ
ン(
Voice of the Chain Master
)で付与します。
Gaze of Two Minds
では、接触した同
意する人型生物に
付与します。その
間に術者自身の感
覚が失われる処理
は、エントリーの
`appliesSelf`(盲
目状態と聴覚を失
った状態)で指定
します。これを使
うルールセットに
は
Capability API 1.481
が必要です。

持続時間の延長(Capability API 1.482)。持続時間の`rounds`には、一日分にあたる、14400まで指定できるようになりました。5eのAidの、8時間は`{"rounds": 4800}`、Heroes' Feastの、24時間は`{"rounds": 14400}`です。また、持続時間の`bySteps`のどの要素にも`"until-dispelled"`を指定できます。その数以上のステップだけ高く支払うと、付与するものには時計がなく、何かが取り除くまで続きます。5eのBestow Curseは、3レベルのコストに`{"rounds": 10, "bySteps": [100, 4800, 4800, 14400, 14400, "until-dispelled"]}`を指定します。`rounds`に、1000を超える値を指定するか、`"until-dispelled"`のステップを持つルールセットにはCapability API 1.482が必要です。

術者のターンでのセーヴと、失敗による退去(Capability API 1.483)。`saveEnds`には`"at": "source-turn-start"`を指定できます。持ち主自身のターンではなく、付与者のターンの開始時にセーヴを行います。また、`failures`には、`becomes`の代わりに`"dismisses": true`を指定できます。指定回数失敗すると、持ち主は`dismisses`エントリーで退去させられる場合と同様に(1.236)、生きたまま、その戦闘から戻らずに離れ、その者が維持していたものはすべてその者とともに終了します。5eのPrismatic SprayのViolet光線は、`"saveEnds": {"save": "wis_save", "at": "source-turn-start", "failures": {"count": 1, "dismisses": true}}`によって盲目状態を付与します。術者の次のターンの開始時に成功すれば盲目状態が終了し、失敗すればクリーチャーは別の次元界へ送られます。光線の行には、他の`applies`と同様にこれを含めます。いずれかを使うルールセットにはCapability API 1.483が必要です。

状態の種類に対する適用の抑制(Capability API 1.484)。アイテム効果の`suppresses`には、状態だけでなく、状態の種類(状態がその`kinds`に列挙するもの)も指定できます。着用中は、その種類のすべての状態の適用を抑えます。5eのPeriapt of Healthは、`{"conditionImmunities": ["disease"], "suppresses": ["disease"]}`により、すべての病気の適用を抑え、新たにかかることも防ぎます。アイテムがここに種類を指定するルールセットにはCapability API 1.484が必要です。

解呪されるまでの持続(Capability API 1.485)。状態の`duration`には`"until-dispelled"`を指定できます。時計を一切持たず、何かが取り除くまで(治療、解呪、または指定した終了条件)、戦闘中もその後も付与されたままになります。`"instant"`と同じ処理を、字義どおりに表す指定です。5eのContinual Flameが該当します。これを使うルールセットにはCapability API 1.485が必要です。

移動の自由(
Capability API 1.486
)。状態の
`speedKeptFrom: { "catalogs": [...] }`
は、指定したカタログ
のエントリーが持ち主
に付与したものによっ
て、持ち主の移動速度
が低下するのを防ぎま
す。呪文が付与した減
速、半減、停止(「
speed-zero」)は歩行
に影響しませんが、網
や掴みによる同じ効果
は引き続き影響します
。
`slipsFree: { "conditions": [...], "cost": 5, "unlessCatalogs": [...] }`
は、持ち主のターンに
、指定した状態それぞ
れから判定なしで抜け
出す選択肢を提示しま
す。コストはルールセ
ット独自の距離で歩行
の`cost`分です(マス
単位に切り上げます。
歩行を測定しない戦闘
では何も行いません)
。`unlessCatalogs`の
エントリーが付与した
状態は残ります。状態
が終了すると、その状
態によって奪われてい
た歩行が戻るため、掴
まれて停止していた者
も抜け出して歩き続け
られます。Engineが操
作するクリーチャーは
、ターンの開始時に抜
け出します。アイテム
の`worn`、`carried`
、`otherwise`効果に
も、
`conditionImmunitiesFrom`
、`speedKeptFrom`、
`slipsFree`の三つす
べてを含められます。
Ring of Freedom of Movement
が該当します。5eの
Freedom of Movement
は、
`"conditionImmunitiesFrom": [{ "conditions": ["paralyzed", "restrained"], "catalogs": ["spells"] }]`
、
`"speedKeptFrom": { "catalogs": ["spells"] }`
、
`"slipsFree": { "conditions": ["grappled", "restrained"], "cost": 5, "unlessCatalogs": ["spells"] }`
です。いずれかを使う
ルールセットには
Capability API 1.486
が必要です。

使い魔(Capability API 1.487)。エント
リーの`targetTypes`には
`"calledBySelf": true`を指定できます
。使用者が戦闘に呼び出したクリーチャ
ーだけを対象とします。5eの
Voice of the Chain Masterや、その目
を通して見る場合の「自身の使い魔」で
す。呼び出しの`asTypes`には、呼び出
したクリーチャーが本来の種別の代わり
になる`combat.creatureTypes.types`の
IDを列挙します。使用時にモードのよう
に選び、呼び出し可能な各クリーチャー
に対して一つずつ選びます。
Find Familiarの
`["celestial", "fey", "fiend"]`が該
当します。呼び出しだけを行うエントリ
ーも、他のすべてのエントリーと同様に
、使用者に`appliesSelf`を付与するよ
うになりました。Find Familiarの絆で
す。戦闘前に準備する場合、複数の方法
で実行できるエントリーは、`mode`にそ
の方法をIDまたは名前で指定します(
Find Familiarが呼び出すフクロウなど)
。使用時にクリーチャー種別を指定する
エントリーは、`kind`に指定します(物
体へのAntipathy/Sympathyなど)。方法
の指定が必要なのに指定されていないも
のは省かれ、その旨が告知されます。
`calledBySelf`または`asTypes`を使う
ルールセットにはCapability API 1.487
が必要です。

呼び出したクリーチャーへの攻撃の譲渡(Capability API 1.488)。状態の`lendsStrikes: { "budget": "reaction" }`は、持ち主が攻撃アクションの攻撃一回を手放し、呼び出したクリーチャーに自身の攻撃のうち一つを行わせられるようにします。呼び出したクリーチャー自身の行動枠から指定の枠を支払い、そのクリーチャーが自身の状態によって他の方法では誰にも被害を与えられない間でも行えます。攻撃アクションの打撃が手元に残っているか、まだそのアクションを行える間、間合いに届く相手がいる各該当クリーチャーの各攻撃について提示します。その時点で選択すると、アクションを消費し、残りの打撃を手元に残します。5eのPact of the Chainでは、契約を読み取る`when`を伴う使い魔の絆の`appliesSelf`と、使い魔自身の「攻撃できない」を表す`cannot-harm`状態を使います。Engineが操作するクリーチャーは、自分の攻撃を手放しません。これを使うルールセットにはCapability API 1.488が必要です。

無償アクションと命中への応答(Capability API 1.489)。アイテムの`worn`、`carried`、`otherwise`効果には、状態と同様に`ignoresHardGround: true`を含められます。移動困難な地形でも、持ち主のコストは通常の地面と変わりません。5eのRing of Free Actionが該当します。状態の`whenHit: { "blow": "melee", "from": { "types": ["fiend", "undead"] }, "save": { "save": "con_save" }, "applies": [...] }`は、持ち主に命中する攻撃ごとに、誰の選択も消費もなく自動的に応答します。`blow`で指定した打撃(近接または遠隔)で、`from`に該当するクリーチャーからのものに限り、攻撃者はその`difficulty`、指定がなければ状態を付与したエントリーのセーヴ難易度に対して`save`を行います。失敗すると`applies`を受け、その状態と同じ集中によって維持されます。5eのHoly Auraは、呪文が終了するまで盲目状態にします。いずれかを使うルールセットにはCapability API 1.489が必要です。

層を持つ壁(Capability API 1.490)。ゾーンの`layers`は、一層ずつ通り抜ける壁または球体(`area`と`save`を持つエントリー)を作ります。移動して入る際に捕らえられた者(`triggers`)は、残っている各層に順番に遭遇します。それぞれの層は、`rays`の光線と同様に、その行の指定に従ってエントリー自身の効果を適用します。エントリーの量を行の`damageType`として与え(指定がなければダメージなし)、エントリーの`applies`のうち行が指定したものを付与し、エントリーのセーヴまたは行自身の`save`を層ごとに別々に行います。`spares`(`caster`または`allies`)に該当する者は、被害を受けずに通り抜けたり、近くに立ったりできます。層は、その手前のすべての層がなくなった後にのみ、`endedBy`の指定どおりに破壊できます。壁のいずれかのマスに対する一回の打撃(壁の区画と同様に、そのマスに攻撃を向けられます)、またはその層に届く一つの範囲によって、`types`に該当する`atLeast`以上の`damage`を与える方法、`entries`のいずれか(`<catalog>/<entry>`)を、`zones`を持つ`endsSpells`と同様にその層に向けるか、範囲がその層に届くようにする方法、または`wind`、つまり`disperses`するゾーンをその層に届かせる方法です。層を持つ壁に向けた`endsSpells`は、その壁に他の処理を一切行いません。最後の層がなくなるとゾーンが終了します。`flash: { "within": 20, "save": "con", "applies": [...], "triggers": ["appears", "enter", "turn-start"] }`は、指定距離内で壁を見ており、エントリー自身の難易度に対するセーヴに失敗した者に`applies`を付与します。壁が現れたとき、指定距離まで近づいたとき、またはその距離内でターンが始まるときに適用します。5eのPrismatic Wallは、視界を`blocks`する壁(または輪)で、`triggers: ["enter"]`、七つの行(赤は火で、25の冷気で終了、橙は酸で、風で終了、黄は電撃で、60の力場で終了、緑は毒で、Passwallで終了、青は冷気で、25の火で終了、藍は拘束状態で、Daylightで終了、紫は盲目状態で、Dispel Magicで終了)、および盲目状態にする耐久力セーヴの閃光を持ちます。

層の破壊と、オーラを介した応答(Capability API 1.491)。エントリーの`endsLayers: true`は、射程内に存在する層を持つ壁のうち、いずれかの層の`endedBy.entries`にそのエントリーが指定されているものを標的にできるようにします。Dispel Magicを持続する範囲に向けるのと同じ方法です(選択肢は`dispels`の下に壁を列挙し、選択ではそのうち一つを`dispel`として指定します)。その層の手前のすべての層がなくなっていれば、その層を破壊し、そうでなければ壁には何もしません。戦闘中に他に行う処理がないエントリーは、そのような壁が届く範囲内にある間だけ提示されます。5eのPasswallは、`{ "kind": "utility", "range": 30, "endsLayers": true }`により、緑の層に作用します。他者の`auras`を通して状態を受けているクリーチャー上の`whenHit`は、その状態を広げている状態の条件に従って応答するようになりました。オーラの持ち主にその状態を付与したエントリーのセーヴ難易度と、その状態の出所および集中を使います。そのため、届く範囲の味方それぞれに付与されたHoly Auraは、術者の集中が終わるまで攻撃者を盲目状態にします。

層が阻むものと、選択による除外(Capability API 1.492)。層を持つ壁の行には、`blocks`として`"ranged-nonmagical"`、`"ranged-magical"`、`"spells"`のいずれかを指定できます。その層が残っている間、壁のマスを線が通過する遠隔攻撃(非魔法、または魔法のもの。魔法とは呪文または性質に`magical`を持つエントリーです)や呪文は、その線が遮られている場合と同様に拒否されます。その層がなくなると、次に残っている層が判断します。5eのPrismatic Wallでは、赤に`["ranged-nonmagical"]`、橙に`["ranged-magical"]`、藍に`["spells"]`を指定します。層ごとに阻むものを選ばせるには、壁に`blocks: ["sight"]`ではなく`obscures: {}`を指定してください。視界を遮る壁は、それだけですでに、その壁を通るすべての照準を拒否するためです。`layers.spares`には、`{ "chosen": N }`も指定できるようになりました。術者は除外され、壁を発動する際には、選択肢が`designates`の下に選択可能なクリーチャーを列挙します(`count`と`ids`)。選択では、その数を上限として`designates`で指定します。指定したクリーチャーは壁が残る限り通り抜けることができ、閃光にも捕らえられません。閃光は壁自身による視界不良も見通すため、視界を不明瞭にする壁でも、それを見る者を盲目状態にします。

別のエントリーを表す行(Capability API 1.493)。カタログエントリーの行には、`standsFor`として、同じリストに供給するカタログが持つエントリーへの`<catalog>/<entry>`参照を指定できます。書き込む行は、`_catalog`の印と並んで、予約キーの`_standsFor`にその参照を持ちます。戦闘では、その行を、コストや仕組みを含め、参照先のエントリーそのものとして読み取ります。ただし、行は引き続き書き込んだエントリーに属します(そのエントリーを削除すると行も削除されます)。5eのPact of the Chainは`{ "list": "spells", "values": { "name": "Find Familiar", "level": 1, "prepared": true }, "standsFor": "spells/find-familiar" }`を書き込み、ティーフリングのInfernal Legacyも、Thaumaturgyの行を同じ方法で書き込みます。この指定がなければ、その行は特性自身のものとなり、特性には仕組みがないため、戦闘では決して提示されません。

層を破壊するアイテムの使用(Capability API 1.494)。アイテムの`use`には、呪文と同様に`endsLayers: true`を含めることができ、それだけを行うユーティリティ使用も認められます。アイテムは壁が指定するカタログのエントリーではないため、層の`endedBy.entries`と照合する`<catalog>/<entry>`参照を`endsLayersAs`で指定します。そのような壁が届く範囲内にある間だけ提示され、同じ方法で壁を標的にします。5eのPasswallの巻物では、`{ "kind": "utility", "budget": "action", "range": 30, "consumes": true, "endsLayers": true, "endsLayersAs": "spells/passwall" }`です。

クリーチャーと固体の地面の通り抜け(Capability API 1.495)。`combat.sizes.passing`は基本規則を設定します。`apart`は、敵の占める空間を歩いて通り抜けるために、移動者と敵のサイズが`order`で何ステップ離れている必要があるかです(5eでは、2)。`crowded`は、他のクリーチャーが占めるマスの地面の移動コストが何倍になるかです(5eでは、2。「他のクリーチャーの空間は移動困難な地形」です)。誰も他者の空間で止まることはできません。状態またはレベルは`passesCreatures`を与えられます。`"larger"`は、より大きいサイズの敵なら誰でも通り抜けられ(5eのHalfling Nimbleness)、`"any"`は誰でも通り抜けられます。状態の`passesObjects`は、持ち主が固体の地面を移動困難な地形として歩いて通り抜けたり、内部で止まったりできるようにします。内部で自身のターンを終えると、セーヴなしで`harm`(`dice`、`flat`、`damageType`)を受けます。ゴーストのIncorporeal Movementは`{ "passesCreatures": "any", "passesObjects": { "harm": { "dice": "1d10", "damageType": "force" } } }`で、ブロックの`keepsOn`によって付けたままにします。

騎乗戦闘(Capability API 1.496)。`combat.mounts`は、戦闘参加者が移動速度の半分を使い、隣にいる同じ側の同意するクリーチャーで、自身より少なくとも`larger`段階サイズが大きいもの(5eでは、1)に騎乗し、同じ方法でその隣に降りられるようにします。メニューには`move:mount:<id>`と`move:dismount`を提示します。騎乗者は乗騎の歩く先についていき、乗っている間は自身では一切歩行しません。`controlled.standard`(5eでは`["dash", "disengage", "dodge"]`)がある場合、シートのない乗騎は制御されます。そのターンは騎乗者の直後となり、移動と指定した標準アクションだけを行います。そのラウンドですでにターンを終えていれば、次のラウンドまで待ちます。ブロックに`mountIndependent: true`を指定したクリーチャーは、自身の意思で行動します。`fall`(`save`、`difficulty`、`applies`、`when`)は、乗騎が`when`内の状態を受けるか、押された場合の処理です。騎乗者はセーヴを行い、失敗すると`applies`を受けて落ち、成功すると足で立って降ります。騎乗者がその状態のいずれかを受けた場合も降りることになります。乗騎または騎乗者が倒れると、両者は離れます。5eでは、`{ "larger": 1, "controlled": { "standard": ["dash", "disengage", "dodge"] }, "fall": { "save": "dex_save", "difficulty": 10, "applies": "prone", "when": ["prone"] } }`です。

掴んだ者の引きずり(Capability API 1.497)。戦闘状態の`dragged`は、付与者が歩くときに持ち主を引きずります。歩行者が一歩進むごとに、持ち主は歩行者がいたマスに移ります。持ち主のサイズが少なくとも`unlessSmaller`段階小さい場合を除き、歩行者の移動速度は半分になり、一歩ごとのコストが倍になります。5eの掴まれた状態では、`"dragged": { "unlessSmaller": 2 }`です。

水中戦闘(Capability API 1.498)。`combat.underwater`は、`terrain`で盤面の水中のタイルを指定します。そのタイルに立つ者は、空中にいるか、水泳移動速度のない飛行者である場合を除き、水中にいるものとします。水泳移動速度を持つか、武器が`melee.unless`の指定に該当する場合を除き、その者の近接攻撃に`melee.mode`を適用します。`names`は攻撃のラベルの単語と、`qualities`はその性質と照合します。`ranged.pastNormal: "never"`は、水中にいる者による射撃、または水中にいる者への射撃が武器の通常射程を超えて届くのを防ぎます。その射程内の射撃には、`ranged.unless`で武器が指定されている場合を除き、`ranged.mode`を適用します。水中にいる者が受ける、`resist`内の種別のダメージは半分になります。`breath`は、水中での自身のターンを数えます。`holds`ターンの間息を止め(`rounds`に、能力値の修正値の各ポイントにつき`perMod.rounds`を加え、`atLeast`を下回ることはありません)、その後さらに`then`ターンの間持ちこたえ、その次のターン開始時に体力が、0になります。`exempt.conditions`内の状態を持つか、`exempt.tags`内のタグを持つ者は呼吸でき、水から出ると息は回復します。5eでは、`{ "terrain": ["water"], "melee": { "mode": "disadvantage", "unless": { "names": ["dagger", "javelin", "shortsword", "spear", "trident"] } }, "ranged": { "pastNormal": "never", "mode": "disadvantage", "unless": { "names": ["crossbow", "net", "javelin", "spear", "trident", "dart"] } }, "resist": ["fire"], "breath": { "holds": { "rounds": 10, "perMod": { "ability": "con", "rounds": 10 }, "atLeast": 5 }, "then": { "rounds": 0, "perMod": { "ability": "con", "rounds": 1 }, "atLeast": 1 }, "exempt": { "conditions": ["water_breathing"] } } }`です。

跳躍(Capability API 1.499)。
`combat.jumping`は、盤面上の
すべての戦闘参加者の移動メニ
ューに、`cells`のいずれかへ
向かう「Jump」(跳躍、
`move:jump`)を追加します。
`long`は走り幅跳びの距離、
`high`は走り高跳びで越えられ
る高さで、それぞれ能力値の
`score`または`modifier`(`of`
)に`plus`を加えた、ルールセ
ット独自の距離です。いずれも
、そのターンの跳躍直前に
`runUp`分の助走を歩いた場合
にのみ、その距離まで届きます
。助走なしでは、
`standing: "half"`によって半
分になります。跳躍は八方向の
いずれかへの直線で、二マス以
上を進み、地面にかかわらず各
マスで一マス分の移動を使いま
す。移動困難な地形、水、穴、
味方、そして走り高跳びで越え
られる高さ以下の地面を跳び越
えますが、壁や敵を通り抜ける
ことはありません。跳躍者が立
てる場所で、高低差が下方に一
段階以内の場所に着地します。
途中では歩行と同様に機会攻撃
を受け、持続する範囲は着地点
でのみ跳躍者に作用します。移
動困難な地形に着地した場合、
`difficulty`に対して
`hardLanding`判定を行い、失
敗すると`applies`の状態を受
けます。状態の`jumps`は、持
ち主がさらに遠くへ跳べるよう
にします。距離を`times`倍に
し(最大のものを適用)、助走の
ある跳躍には、`plus`で能力値
の修正値をさらに加えます。
`long: true`の場合、加算は走
り幅跳びにのみ適用します。騎
乗中、誰かの内部にいる、空中
にいる、誰かを引きずっている
、または移動方向を決める状態
を受けている者は、跳躍できま
せん。
`cannot-approach-source`を受
けている者は、その出所に近づ
く跳躍はできません。移動イベ
ントには`jumped: true`を含め
ます。5eでは、
`{ "long": { "ability": "str", "of": "score" }, "high": { "ability": "str", "of": "modifier", "plus": 3 }, "runUp": 10, "standing": "half", "hardLanding": { "check": "agility", "difficulty": 10, "applies": "prone" } }`
です。Jumpの呪文と
Boots of Striding and Springing
は
`{ "jumps": { "times": 3 } }`
、Step of the Windは
`{ "times": 2 }`、
Remarkable Athleteは
`{ "plus": { "ability": "str", "long": true } }`
、Second-Story Workは
`{ "plus": { "ability": "dex" } }`
です。

瀕死セーヴと、最大の出目を使う回復(Capability API 1.500)。`combat.dying.asSave: true`は瀕死ロールをセーヴにします。持ち主のセーヴ全般を変更し、特定のセーヴに限定されないものは、加算する数値(Bless、Aura of Protection)も、ダイスを二度振るかどうかも、瀕死ロールに適用されます。状態の`deathSaves: "advantage"`(または`"disadvantage"`)は、`asSave`の有無にかかわらず、持ち主の瀕死ロールをその有利または不利で振らせます。その場合、瀕死イベントには`mode`が入り、`asSave`があれば`bonuses`と`total`も入ります。出目そのもの(1、20のいずれか)は、引き続き採用したダイスから読み取ります。状態の`healedMax: true`は、アクション、復活、再生、相手を倒した際の回復のいずれであっても、持ち主が受けるすべての回復に、そのダイスで出せる最大値を使います。5eでは、`dying`に`"asSave": true`を指定し、Beacon of Hopeの状態を`{ "effects": ["own-saves-advantage"], "saves": ["wis_save"], "deathSaves": "advantage", "healedMax": true }`とします。

一時的に変化する武器(Capability API 1.501)。状態の`weapon`は、その状態が適用されている間、持ち主の武器による打撃を変更します。対象は、攻撃のラベルに`names`のいずれかが単語として含まれる打撃、または手に持つアイテムが`items`のいずれかに該当する打撃です(`names`、`tags`、`notTags`を`attackRows`と同じ方法で読み取ります)。どちらも指定しなければ、武器によるすべての打撃が対象です。`toHit`と`damage`は攻撃ロールとダメージロールに加算されます。`ability`(または、呪文発動能力値に使う、能力値IDを保持するシートのフィールドを指定する`abilityFrom`)は、攻撃本来の能力値の代わりに使う能力値です。その修正値は命中判定で元の修正値に置き換わり、ダメージに元の修正値を加えていた場合はダメージでも置き換わります。ステータスブロックから読み取るクリーチャーには、置き換えられる能力値がありません。`die`はダメージをその面数のダイス一個にし、`qualities`は抵抗の処理にも引き継がれます。メニューの予測とロールの両方がこれを読み取ります。5eでは、Magic Weaponは`{ "toHit": 1, "damage": 1, "qualities": ["magical"] }`(2、3はスロットに応じて別々の状態で指定)、Shillelaghは`{ "names": ["club", "quarterstaff"], "abilityFrom": "spellcasting_ability", "die": 8, "qualities": ["magical"] }`、Oil of Sharpnessは`{ "items": { "tags": ["slashing"] }, "toHit": 3, "damage": 3 }`、Sacred Weaponの「魔法の武器になる」は`{ "qualities": ["magical"] }`です。

状態を付与した者に対する有利(Capability API 1.502)。`mode`を持つ`attacks-taken`修正値には、`fromSource: true`を指定できます。状態を付与した者による攻撃だけが、その方法でダイスを振ります。`applies`には終了条件として`endsAfter: "attacked-by-source"`を指定できます。その出所が持ち主に対して次に行う攻撃ロールの後に状態が取り除かれ、ほかの者の攻撃では取り除かれません。5eのTrue Strikeは、状態`{ "modifiers": [{ "to": "attacks-taken", "mode": "advantage", "fromSource": true }] }`を、`{ "duration": { "rounds": 1 }, "endsAfter": "attacked-by-source" }`で標的に付与します。

スマイト(Capability API 1.503)。`applies`には終了条件として`endsAfter: "own-hit"`を指定できます。持ち主の次の武器攻撃が命中した後に状態が取り除かれ、外れた場合は残ります。そのため、スマイトの状態が加えるダメージ(`attacks: "weapon"`を持つ`damage`修正値)は、その命中にだけ適用されます。状態の`onHit`は、持ち主が攻撃ロールで命中させた相手に、打撃の処理が終わってから、持ち主を出所として、それぞれの`applies`を付与します。`weapon: true`を指定すると武器による打撃だけに、`blow`を指定すると近接または遠隔の打撃だけに限定されます。集中を維持する状態は、付与した状態にその集中を引き継ぎます。5eのBranding Smiteは`{ "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "2d6", "damageType": "radiant" }], "onHit": { "weapon": true, "applies": [{ "condition": "branded", "duration": { "rounds": 10 } }] } }`を`"endsAfter": "own-hit"`で付与し、`branded`は`{ "suppresses": ["invisible"] }`です。

元素の形態と、倒れた乗騎からの着地(Capability API 1.504)。状態の`stopsInFoes: true`は、持ち主が敵対するクリーチャーの占有空間に歩いて入り、そこに留まれるようにします。味方の占有空間は、引き続き通過しかできません。状態の`entering`は、持ち主が占有空間に入ったクリーチャーそれぞれに、各ターンの最初の一度だけ効果を与えます。セーヴなしの`harm`(`dice`、`flat`、`damageType`)と、持ち主を出所とする`applies`です。`combat.mounts.fall.landsWith`は行動枠を指定します。乗騎に`fall.when`の状態が付与された騎乗者は、その行動枠が残っていれば一回分を消費し、セーヴを振る代わりに、乗騎の隣に立ったまま着地します。押し落とされた場合は、引き続きセーヴを振ります。5eでは、Air FormとWater Formは`{ "stopsInFoes": true, "passesCreatures": "any" }`、Fire Formは`{ "stopsInFoes": true, "entering": { "harm": { "dice": "1d10", "damageType": "fire" }, "applies": [{ "condition": "on_fire", "duration": "until-dispelled" }] } }`で、着地には`"landsWith": "reaction"`を指定します。

幻の分身(Capability API 1.505)。状態の`duplicates`は、持ち主に向けられた攻撃を引き受ける分身を`count`体与えます。持ち主に対する各攻撃ロールの前に、`sides`面のダイス(指定がなければd20)を振ります。残っている分身の数を`left`として、出目が`thresholds[left - 1]`以上なら、代わりに分身に対して攻撃ロールを振ります。分身の防御は、`defense.flat`に持ち主の`defense.ability`の修正値を加えたものです。攻撃が命中した分身は破壊され、それ以外の効果は受けません。最後の分身がなくなると状態が終了します。持ち主が見えない攻撃者や、`pierced`のいずれかの感覚でその射程内にいる持ち主を感知する攻撃者は、決して惑わされません。`thresholds`には、残り一体から`count`体まで、それぞれの残数に対応するエントリーを指定します。5eのMirror Imageは`{ "count": 3, "thresholds": [11, 8, 6], "defense": { "flat": 10, "ability": "dex" }, "pierced": ["blindsight", "truesight"] }`を付与します(10ラウンド)。

姿を消す瞬き(Capability API 1.506)。状態の`blinks`は、持ち主の各ターンの終了時に`sides`面のダイス(指定がなければd20)を振ります。`atLeast`以上なら、持ち主は次のターンの開始時まで盤面から消えます。消えている間は誰も持ち主に届かず、何からも被害を受けませんが、維持しているもの(集中、ゾーン、召喚物)は継続し、不在を理由に戦闘に敗北することもありません。次のターンの開始時には、そのターンのほかの処理より先に、消えた場所、または自分のサイズが収まる最も近い空き場所に戻ります。5eのBlinkは`{ "condition": "blink", "blinks": { "atLeast": 11 } }`を付与します(10ラウンド)。

時間の停止(Capability API 1.507)。状態の`stopsTime`(`dice`、`flat`、または両方)は、その状態が付与されたターンの終了時にダイスを振り、持ち主にその数だけ連続したターンを与えます。各ターンは直前のターンのすぐ後に開始し、順番は進まず、新しいラウンドも始まらず、ターン間の行動機会もありません。ほかの者は行動できず、リアクションで応じることも、待機させた使用を行うこともできず、ほかの者の持続時間は減りません。持ち主がほかのクリーチャーに影響を及ぼすと、即座に終了します。そのクリーチャーへの攻撃、持ち主から受ける被害、持ち主が振らせるセーヴ、持ち主が付与する状態が該当します。それ以外の場合は最後のターンの後に終了します。終了したターンの残りは通常どおり進みます。5eのTime Stopは、術者に`{ "condition": "time_stop", "stopsTime": { "dice": "1d4", "flat": 1 } }`を付与します。

命中時に返す被害(Capability API 1.508)。状態の`whenHit`は、命中した打撃の処理が終わってから、持ち主に命中させた者にセーヴなしで`harms`(`dice`、`flat`、`damageType`)を与えられるようになりました。`within`は、ルールセットの距離でその範囲内にいる攻撃者だけに、この応答全体を限定します。`save`と`applies`は、それぞれ省略できるようになりました。`save`がなければ`applies`は判定なしで付与されます。`save`には`applies`が必要で、全体として`applies`、`harms`、またはその両方の効果を持ちます。5eのFire Shieldは`{ "whenHit": { "blow": "melee", "within": 5, "harms": { "dice": "2d8", "damageType": "fire" } } }`で、冷たい盾は`cold`です。エイザーのHeated Bodyは、ステータスブロックの`keepsOn`を通して、火ダメージ`1d10`を与えます。

攻撃の前に立ちはだかることと、一種類の攻撃に対する防御(Capability API 1.509)。エントリーの`takesAim: true`を、味方、または間合い`within`内の誰かを`for`とする`"aimed"`の瞬間に使うと、その瞬間の対象だった者に代わり、持ち主が狙われたものの標的になります。元の処理は取り消さず、それ自体では何も与えません。`"aimed"`の瞬間には`blow`(`"melee"`または`"ranged"`)を指定できるようになり、その種類の攻撃だけに応じます。`defense`修正値にも`blow`を指定でき、その種類の攻撃に対してだけ適用されます。5eのArrow-Catching Shieldは、装備中の修正値`{ "to": "defense", "flat": 2, "blow": "ranged" }`と、`{ "kind": "utility", "reaction": { "on": "aimed", "for": "ally", "within": 5, "blow": "ranged" }, "takesAim": true }`を使います。

クリティカルヒットの防止(Capability API 1.510)。状態またはアイテムの`worn`にある`criticals-against-normal`効果は、持ち主へのクリティカルヒットを通常の命中に変えます。ダイス本来の最大の出目、拡大されたクリティカル範囲、麻痺状態の持ち主に対する`attacks-from-adjacent-critical`のいずれでクリティカルになったかは問いません。5eのAdamantine Armorは`{ "worn": { "effects": ["criticals-against-normal"] } }`です。

ダメージダイスのない武器(Capability API 1.511)。アイテムの`attack.damage`では`dice`を省略できます。その打撃は`bonus`だけのダメージを与えるか、何も与えません。`onHit`には`atLeast: 0`を指定できるようになり、与えたダメージにかかわらず、どの命中でも付与されます。また、`checkEnds`(`check`、`difficulty`)も指定できます。持ち主が標準の行動枠を消費して状態を終了させるために行える、`combat.checks`の判定です。5eの吹き矢は`{ "damage": { "bonus": 1, "type": "piercing" } }`、ネットは`{ "damage": {}, "onHit": [{ "condition": "restrained", "atLeast": 0, "targetIs": { "upToSize": "large" }, "checkEnds": { "check": "might", "difficulty": 10 } }] }`です。

水中でのみ可能な呼吸(Capability API 1.512)。`combat.underwater.breath.waterOnly.tags`は、水中でしか呼吸できないクリーチャーのタグを指定します。ほかの者が水中で息を止めるのと同じ方法で、水の外で息を止めます(`holds`、次に`then`、最後に、0)。水中に戻ると息が回復します。`exempt`は、ほかの者と同じくこれらのクリーチャーも対象から除外します。5eでは、Water Breathingを持ちAmphibiousを持たないサメなどに、`{ "waterOnly": { "tags": ["water-breather"] } }`を指定します。

状態を付けたままにし、跳躍を伸ばすアイテム(Capability API 1.513)。アイテムの`worn`または`carried`効果には`keepsOn`を指定でき、その効果が適用されている間、戦闘中の持ち主にシートの状態(4個まで)を付与し続けます。シートには書き込みません。また、状態と同じ`jumps`(`times`、または能力修正値を加える`plus`)も指定できます。外すか落とすと、これらは失われます。5eのBoots of Striding and Springingは`{ "worn": { "jumps": { "times": 3 } } }`、Ioun Stone of Awarenessは`{ "worn": { "keepsOn": ["alert"] } }`で、`alert`は持ち主が不意を突かれるのを防ぐ状態です。

ダメージによる停止(Capability API 1.514)。`suppressedWhenHarmed: "until-own-turn-start"`を持つ戦闘の状態は、持ち主がダメージを受けた瞬間から、次のターンの開始時まで何の効果も与えません。状態は終了せず、時計も進み続けます。5eのCloak of Displacementは`keepsOn: ["displaced"]`で装備し、状態は`{ "condition": "displaced", "effects": ["attacks-against-disadvantage"], "suppressedWhenHarmed": "until-own-turn-start" }`です。

状態が変更する能力値(Capability API 1.515)。戦闘の状態の`abilities`は、アイテムと同じく能力値IDで、状態が適用されている間の持ち主の能力値を変更します。`set`は評価値を指定した数値以上に引き上げます(すでに高ければそのままです)。`add`はその上に加算します(`max`を超えません)。`to`は厳密にその数値に設定します。シート上で保持されている場合は、シートが計算するすべてのものが変更後の評価値を読み取ります。戦闘中に付与された場合は、戦闘参加者の攻撃、セーヴ、判定、防御をその値で再計算し、終了時にも再計算します。体力と移動速度はそのままです。シートのないステータスブロックでは、記載されている`abilities`を同じ方法で変更します。能力修正値を読み取る各セーヴと各対抗判定の判定値は、その修正値の変化と同じだけ変わり、終了時には記載どおりに戻ります。評価値が記載されていないステータスブロックはそのままです。5eのPotion of Hill Giant Strengthは`{ "condition": "hill_giant_strength", "effects": [], "abilities": { "str": { "set": 21 } } }`、Feeblemindは`"abilities": { "int": { "to": 1 }, "cha": { "to": 1 } }`です。

恒久的な能力値の上昇(Capability API 1.516)。アイテムの`use`には、能力値IDごとに`raises`を指定できます。`by`は評価値に、`max`はその最大値に、恒久的に加算されます。これは`targets`が`"self"`の`"buff"`で、戦闘外でのみ使用でき、戦闘中には提示されません。この上昇は、そのゲームのキャラクターのライブステートに保持されるため、シートが計算するすべてのものが上昇後の評価値を読み取ります。5eのManual of Gainful Exerciseは`{ "kind": "buff", "targets": "self", "budget": "action", "consumes": true, "raises": { "str": { "by": 2, "max": 2 } } }`です。

支払ったステップで選ぶ状態(Capability API 1.517)。`applies`のエントリーには`paidSteps`(`atLeast`、`atMost`、または両方)を指定できます。そのエントリーの最小コストよりも指定のステップ数だけ高く支払った場合にのみ付与されます。ステップ数は`perCostStep`と同じ方法で数えます(生得呪文も、本来のレベルより上のレベル数を同じように数えます)。5e: 2レベル呪文Magic Weaponは、`[{ "condition": "magic_weapon_1", "duration": { "rounds": 600 }, "paidSteps": { "atMost": 1 } }, { "condition": "magic_weapon_2", "duration": { "rounds": 600 }, "paidSteps": { "atLeast": 2, "atMost": 3 } }, { "condition": "magic_weapon_3", "duration": { "rounds": 600 }, "paidSteps": { "atLeast": 4 } }]`で、それぞれの状態に固有の`+1`、`+2`、`+3`があります。Branding Smiteの増加分(1d6)も同様に、スロットごとに状態を用意します。

ほかの者の状態の終了(Capability API 1.518)。`applies`のエントリーまたはアイテム攻撃の`onHit`にある`checkEnds`には、`by: "any"`を指定できます。持ち主の隣に立っている者(盤面のない戦闘では、どこにいる者でも)は、自分の標準の行動枠を消費して、持ち主のために自分の判定値で判定を振れます。持ち主自身も引き続き行えます。5eの錬金術師の火は`{ "condition": "on_fire", "atLeast": 0, "checkEnds": { "check": "agility", "difficulty": 10, "by": "any" } }`です。

独自の回数を数える追加の使用(Capability API 1.519)。アイテムは追加の使用(16個まで)を`moreUses`として持てます(1.519より前: 8個)。それぞれに`uses`を指定できます。内容は`max`(1～100)と、省略可能な`recharge`です(`rests`と`amount`を指定し、回復量は`charges.recharge`と同じく`"max"`またはダイスです)。このような使用は、戦闘内外でアイテムのチャージの代わりに独自の使用回数を一回分消費します(したがって、独自の`charges`コストは持ちません)。回数はアイテムのスタックに保持されます。インベントリーには、追加の使用ごとにボタンと残り回数が表示されます。5eのStaff of Thunder and Lightningでは、それぞれの特性を夜明けごとに一度使えるよう、`{ "label": "Thunderclap", "use": { ... }, "uses": { "max": 1, "recharge": { "rests": ["dawn"], "amount": "max" } } }`とします。Helm of Brilliance: 30個のダイヤモンドは、再充填なしの`"uses": { "max": 30 }`です。

持ち主に対する防護(Capability API 1.520)。戦闘の状態には、ゾーンと同じ`wards`を指定できます(`catalogs`、`maxLevel`、`by`です。発動するものがないため、`maxLevelPerCostStep`はありません)。そのレベル以下の、それらのカタログのエントリーは、持ち主自身によるものを除き、誰が使っても持ち主に届きません。持ち主を狙うと拒否され、範囲内では持ち主だけを避けます。クリーチャーには`keepsOn`で、アイテムの着用者には`worn.keepsOn`で付けたままにします。5eのラクシャサのLimited Magic Immunityは`{ "condition": "limited_magic_immunity", "effects": [], "wards": { "catalogs": ["spells"], "maxLevel": 6 } }`です。

魔法の適用を抑えるゾーン(Capability API 1.521)。ゾーンには`suppresses`を指定でき、`catalogs`、`tags`、または両方を指定します。内部に立つ者では、それらのカタログのエントリーによってのみ付与された状態は何の効果も与えません(終了はせず、時計は進み続けます)。その者が持つアイテムにそれらのタグのいずれかがあれば、装備中または携行中の効果はなくなり、使用は提示されません。そのアイテムによる攻撃は、内部から行う場合も内部の誰かに対して行う場合も、通常の武器として行います。アイテム固有の命中ボーナスとダメージボーナス、追加ダメージ、討伐効果、特性としてのそれらのタグは使いません。ゾーンの`forbids`には、状態と同じく`casts`も指定できるようになりました。それらのカタログのものは内部から一切発動できません。5eのAntimagic Fieldは`"zone": { "rounds": 600, "triggers": [], "suppresses": { "catalogs": ["spells"], "tags": ["magical"] }, "forbids": { "casts": ["spells"] }, "wards": { "catalogs": ["spells"], "maxLevel": 9 }, "inside": { "conditions": ["incapacitated"], "is": { "tags": ["antimagic-susceptible"] } } }`で、最後の部分はAntimagic Susceptibility用です。

呪文の吸収(Capability API 1.522)。戦闘の状態またはアイテムの`worn`には、`absorbs`を指定できます。内容は、防護と同じく`catalogs`、`maxLevel`、`by`です。そのレベル以下の、それらのカタログのエントリーを、敵が持ち主だけを標的として使った場合(範囲は対象になりません)、吸収されて持ち主に何の効果も与えません。使用者のコストは引き続き支払われます。装備中のアイテムでは、`charges`に`"spends"`(吸収するたびにそのレベル分のアイテムのチャージを消費し、足りなければ吸収しません)または`"gains"`(そのレベル分を最大値まで加算します)を指定でき、そのためアイテムは`charges`を持ちます。最初に状態を読み取り、次に装備中のアイテムを順番に読み取ります。反魔法のゾーンで適用を抑えられたアイテムは何も吸収しません。5eのRod of Absorptionは`"worn": { "absorbs": { "catalogs": ["spells"], "maxLevel": 9, "charges": "gains" } }`と`"charges": { "max": 50 }`を使い、蓄えたレベルはスロットを回復する`use`で消費します。Ioun Stone of Absorptionは`{ "catalogs": ["spells"], "maxLevel": 4, "charges": "spends" }`と`"charges": { "max": 20 }`です。

呪文の反射(Capability API 1.523)。修正値の`against`には`"alone": true`を指定できます。持ち主だけに向けられたものに対するセーヴでのみ適用され、範囲には適用されません。また、ほかに指定した条件も満たす必要があります。戦闘の状態またはアイテムの`worn`には、`turns`を指定できます。内容は、防護と同じく`catalogs`、`maxLevel`、`by`です。そのレベル以下の、それらのカタログのエントリーを、敵が持ち主だけを標的として使い、そのセーヴで持ち主がダイスの最大の目を出した場合、持ち主には何の効果も与えず、使用者へ反射されます。数値は同じまま、使用者だけが標的だったものとして処理し、コストは一度だけ支払います。反射されたものが再び反射されることはなく、反魔法のゾーンで適用を抑えられたアイテムは何も反射しません。プールを振る戦闘には最大の目がないため、反射は起きません。5eのRing of Spell Turningは`"worn": { "modifiers": [{ "to": "saves", "mode": "advantage", "against": { "casts": ["spells"], "alone": true } }], "turns": { "catalogs": ["spells"], "maxLevel": 7 } }`です。

後で発動するための呪文の保存(Capability API 1.524)。
アイテムまたはクリーチャーには、
`stores`を指定できます。
内容は`catalogs`、
`levels`(1～40)、
`count`(20以下)です。
戦闘中、
それらのカタログのエントリーで、
使用者がシートから読み取ってコストを支払うものは、
実行する代わりに保存できます。
保存先は、
保存機能のある自分のアイテム(装備中または携行中)、
隣の味方が持つそのようなアイテム、
またはエントリーを自ら保存できる隣の味方です。
その選択肢には、
`storesIn`の下に保存先が列挙されます(`holderId`、
持ち主のシート上の場所を表す`item`でクリーチャーの場合は指定なし、
`label`、
そして空いているレベル数を表す`room`)。
選択時には標的を指定せず、
その一つを`storesIn`で指定します。
発動と同じように支払い、
行動枠を消費し、
支払ったレベルで保存します。
そのレベルは本来のレベル以上で、
空き容量に収まる必要があります。
その時点では何の効果も与えません。
その後、
アイテムの着用者またはクリーチャー自身が、
コストなしで一度発動できます。
両方の名前を付けた選択肢(「Ring of Spell Storing: Cure Wounds」)として、
保存時のレベル、
保存した者のセーヴ難易度と攻撃値を使い、
構成要素は一切必要ありません。
ただし、
反魔法のゾーンでアイテムの適用が抑えられている間は発動できません。
アイテムの内容は戦闘後もスタックに保持され(`storedEntries`で、
各エントリーは`entry`、
`label`、
`level`、
`saveDifficulty`、
`toHit`を持ちます)、
インベントリーに表示され、
次の戦闘の開始時に読み取られます。
戦闘に渡すクリーチャーには、
同じリストを`stored`として指定できます。
戦闘前に設定する場合、
Game Masterの`standing`で`"into"`を指定できます。
術者のアイテム、
`on`が最初に指定する者のアイテム、
または名前で指定したそのクリーチャー自身が保存先です。
術者のシートから読み取って本来のレベルでコストを支払い、
保存します。
5eのRing of Spell Storingは`"stores": { "catalogs": ["spells"], "levels": 5 }`、
Ioun Stone of Reserveは`{ "catalogs": ["spells"], "levels": 3 }`、
シールド・ガーディアンのSpell Storingは`{ "catalogs": ["spells"], "levels": 4, "count": 1 }`です。
これを使うルールセットにはCapability API 1.524が必要です。

アイテムの使用禁止と、スロット別のより多くの状態(Capability API 1.525)。状態の`forbids`には`"items": { "tags": [...] }`を指定できます。適用中は、戦闘内外で、それらのタグのいずれかを持つアイテムは使えず、そこに保存したエントリーも発動できません。`tags`がなければ、すべてのアイテムが対象です。武器による打撃は引き続き行えます。5eのFeeblemindは`"forbids": { "casts": ["spells"], "items": { "tags": ["magical"] } }`です。また、各状態に`paidSteps`を指定すれば、エントリーは`appliesOneOf`なしで、12個までの状態を付与でき、支払ったステップに対応する状態だけが付与されます。5eのBranding Smiteでは、2～9レベルのスロットごとに、2d6～9d6までの状態を一つずつ用意します。どちらかを使うルールセットにはCapability API 1.525が必要です。

日数経過によるセーヴ(Capability API 1.526)。エントリーの`saveEnds`には、`"days": n`とともに`"at": "days"`を指定できます。戦闘中には振りませんが、付与した戦闘が終わると、持ち主のシートはセーヴと難易度を保持します。ゲーム内時間で`n`日が経過するたびに(シートの`pass`コマンド)、そのセーヴを振り直し、最初の成功で状態が終了します。`successes`も`failures`も数えません。5eのFeeblemindの「30日が終わるたびに、クリーチャーはセーヴを再び行える」は、`{ "save": "int_save", "at": "days", "days": 30 }`と`"duration": "until-save"`です。これを使うルールセットにはCapability API 1.526が必要です。

接触への応答(Capability API 1.527)。状態の`whenHit`には`"touches": true`を指定できます。命中に応じるのと同じように、持ち主を掴もうとする者、突き飛ばそうとする者、持ち主の掴みから逃れようとする者に、その試みの成否を問わず応じます。応じる相手は引き続き`from`で絞り込まれます。接触は間合い内で行われるため、`within`は関係ありません。`blow`なし、または`"blow": "melee"`と組み合わせます。5eのHeated Bodyの「エイザーに触れたクリーチャー、またはエイザーの近く(5フィート以内)で近接攻撃を命中させたクリーチャーは、5(1d10)の火ダメージを受ける」は、`{ "blow": "melee", "within": 5, "touches": true, "harms": { "dice": "1d10", "damageType": "fire" } }`です。これを使うルールセットにはCapability API 1.527が必要です。

ほかの状態が適用されている間の抑制(Capability API 1.528)。`heldOffWhile`を持つ戦闘の状態は、持ち主がその`conditions`のいずれかを保持している間、または持ち主の別の状態がその`effects`のいずれかを与えている間、何の効果も与えません。終了はせず、時計は進み続け、どちらにも当てはまらなくなると再び適用されます。この方法で自身の適用を抑えられている状態は、ほかの状態の適用を抑えません。5eのCloak of Displacementの「無力状態、拘束状態、またはその他の理由で移動できない間は適用を抑えられる」は、`{ "condition": "displaced", "effects": ["attacks-against-disadvantage"], "suppressedWhenHarmed": "until-own-turn-start", "heldOffWhile": { "conditions": ["restrained"], "effects": ["cannot-act", "speed-zero"] } }`です。これを使うルールセットにはCapability API 1.528が必要です。

水上の歩行(Capability API 1.529)。`"walksOnLiquid": true`を持つ戦闘の状態は、持ち主が水面を固い地面のように、一マスにつき通常の一歩で歩いて進入、横断し、そこに留まれるようにします。水面に立っている間は、水中にいることにはなりません。`runsAcross`と異なり、壁を登ることも、高さのある段差を越えることもできません。5eのWater Walk、および`keepsOn`で装備するRing of Water Walkingは、`{ "condition": "water_walking", "effects": [], "walksOnLiquid": true }`です。これを使うルールセットにはCapability API 1.529が必要です。

例外のある標的の条件(Capability API 1.530)。標的の条件(`targetIs`、`from`、`of`など)を記述できる場所では、独立した条件である`"except": { ... }`を指定できます。その例外の条件を満たす者は、この条件を決して満たしません。ほかに何も指定しなければ、それ以外の全員が満たします。5eのネットの「ネットは一定の形を持たないクリーチャーには効果がない」は、拘束状態を付与する`applies`に`"targetIs": { "except": { "tags": ["formless"] } }`を指定します。これを使うルールセットにはCapability API 1.530が必要です。

切断による解放(Capability API 1.531)。`cutFree: { defense, health, damageTypes? }`を持つ戦闘の状態は、それ自体を独立したものとして攻撃できます。持ち主自身、または敵味方を問わず、持ち主に攻撃が届く位置の誰かが行う、命中判定を振り`damageTypes`のいずれかのダメージを与える攻撃(省略時はどの種別でも)が、持ち主の代わりに状態に対して提示されます。`defense`に対してダイスを振り、それらの種別のダメージだけが状態を損耗させ、累計で`health`分に達すると持ち主の状態が終了します。残りは打撃から次の打撃へ引き継がれます。5eのネットの「ネット(AC 10)に、5の斬撃ダメージを与えることでも、クリーチャーを傷つけずに解放できる」は、`{ "condition": "netted", "effects": ["speed-zero"], "cutFree": { "defense": 10, "health": 5, "damageTypes": ["slashing"] } }`です。これを使うルールセットにはCapability API 1.531が必要です。

使用者を中心とするアイテムの使用(Capability API 1.532)。アイテムの`use`と各`moreUses`は、カタログのエントリーの範囲と同じく、バーストに`"around": true`(および`"throughWalls": true`)を指定できます。狙いを定めず、使用者からサイズ分の距離内にいる全員を巻き込み、使用者自身は巻き込みません。5eのStaff of Thunder and LightningのThunderclapは、耐久力セーヴと`"area": { "shape": "burst", "size": 60, "around": true }`です。これを使うルールセットにはCapability API 1.532が必要です。

呼び出されたクリーチャーの一時除外(Capability API 1.533)。ゾーンの`suppresses`には、`catalogs`とともに`"setsAsideCalled": true`を指定できます。それらのカタログのエントリーによって戦闘に呼び出されたクリーチャーは、ゾーンに覆われている間、一時的に除外されます。追放された者と同じように戦闘から外れ、ターンは回ってこず、誰からも狙われませんが、それを維持するもの(集中、ラウンド)は進み続けます。ゾーンが移動するか終了して、そのクリーチャーを覆わなくなると、元の場所に戻ります。5eのAntimagic Fieldの「召喚されたクリーチャーは消える」は、`"suppresses": { "catalogs": ["spells"], "tags": ["magical"], "setsAsideCalled": true }`です。これを使うルールセットにはCapability API 1.533が必要です。

独自の
使用回数を
持つ武器の
命中(Capability API 1.534)。
アイテムの
`attack.spends`のエントリーは、
`charges`の代わりに
`"uses": { "max": 1, "recharge": { "rests": ["long"], "amount": "max" } }`を指定できます。
追加の使用と同じく
スタックに保持される
独自の
使用回数を
一回分消費し、
`recharge`が指定する
休息で回復します。
`onHit`だけが効果である場合は、
`amount`を省略できます。
命中を受けた
者が振る
`save`(`{ "save": "con", "difficulty": 17 }`)に成功すると、
その量の
適用を防ぎます。
`drain`(`{ "share": 0.5 }`)は、
その量が
実際に
与えた分の
指定割合を、
使い手の体力として
回復します。
`onHit`のエントリーは、
`saveEnds`とともに
最長持続時間の
`rounds`を指定でき、
`"of": "source"`は使い手の
ターンで
ラウンドを
数えます。
5eのRod of Lordly MightのDrain Lifeは`{ "label": "Drain Life", "uses": { "max": 1, "recharge": { "rests": ["long"], "amount": "max" } }, "amount": { "dice": "4d6" }, "type": "necrotic", "save": { "save": "con_save", "difficulty": 17 }, "drain": { "share": 0.5 } }`です。
Paralyzeは、
量の指定なしで
`"onHit": [{ "condition": "paralyzed", "rounds": 10, "save": { "save": "str_save", "difficulty": 17 }, "saveEnds": { "save": "str_save", "difficulty": 17, "at": "turn-end" } }]`です。
Staff of Thunder and LightningのThunderは`"onHit": [{ "condition": "stunned", "rounds": 1, "of": "source", "save": { "save": "con_save", "difficulty": 17 } }]`です。
これを使う
ルールセットには
Capability API 1.534が必要です。

同時に行う使用(Capability API 1.535)。
アイテムの
`moreUses`の
一つに、
アイテムの
ほかの
使用の
ラベルを
`"alongside": ["Thunderclap"]`として
指定できます。
それを
使うと、
それらの
使用も
それぞれ、
使用者を
囲む
バーストに
巻き込まれた
者に対して
発生し、
それら自身は
何も
消費しません。
ほかの
使用と
同時に
行えるのは、
使用者を
中心とする
使用(`"area": { ..., "around": true }`)だけです。
そのため、
狙いを
二度
定めることはなく、
同時に
行われる
使用自身に、
さらに
同時に
行う
使用を
指定することは
できません。
5eのStaff of Thunder and LightningのThunder and Lightningは
`{ "label": "Thunder and Lightning", "use": { ...Lightning Strike's line... }, "uses": { "max": 1, "recharge": { "rests": ["long"], "amount": "max" } }, "alongside": ["Thunderclap"] }`で、
それ自身の
一日ごとの
使用回数を
消費し、
ほかの
どちらの
使用回数も
消費しません。
これを使う
ルールセットには
Capability API 1.535が必要です。

ダイスで決める回数(Capability API 1.536)。追加の使用の`uses`には、`max`とともに`"rolled": "1d10"`を指定できます。アイテムの各スタックはその回数を持ち、作成時に一度だけダイスを振り、それ以降は読み取るたびに同じ値を使います。`max`は決して超えません(この場合はダイスで出せる最大値です)。`recharge`があれば、そのスタック固有の回数まで回復します。5eのHelm of Brillianceは`{ "label": "Daylight (diamond)", "use": { ... }, "uses": { "max": 10, "rolled": "1d10" } }`で、ファイアーオパールは`"max": 30, "rolled": "3d10"`です。Necklace of Prayer Beadsのビーズは`"max": 6, "rolled": "1d4+2"`です。これを使うルールセットにはCapability API 1.536が必要です。

スロットに応じて強まる呼び出し(Capability API 1.537)。`calls`には`"perStep": 2`を指定でき、支払ったコストが一ステップ上がるごとに、その数だけクリーチャーが増えます(5eのAnimate Deadの「3レベルを超えるスロットレベルごとに、追加で二体のアンデッド・クリーチャー」)。`upTo`には`"perStep": 1`を指定でき、ステップごとに`at`がその数だけ上がります(Conjure Elementalの「5レベルを超えるスロットレベルごとに脅威度が上がる(1ずつ)」)。そのため、それを超えるクリーチャーも提示されますが、十分に高く支払わなければ拒否されます。各`options`には`"fromStep": 2`を指定でき、そのステップ数以上で支払った場合にのみ提示されます。また、独自の`perStep`も指定でき、`fromStep`を超えた分を数えます。5e: 6レベルからのCreate Undeadは`"options": [{ "creature": "creatures/ghoul", "count": { "flat": 3 }, "perStep": 1 }, { "creature": "creatures/ghast", "count": { "flat": 2 }, "fromStep": 2, "perStep": 1 }, { "creature": "creatures/wight", "count": { "flat": 2 }, "fromStep": 2, "perStep": 1 }, { "creature": "creatures/mummy", "count": { "flat": 2 }, "fromStep": 3 }]`です。これを使うルールセットにはCapability API 1.537が必要です。

寝返る呼び出されたクリーチャー(Capability API 1.538)。エントリーの`concentration`で維持する`calls`には、`"hostileOnBreak": true`を指定できます。その集中が破られた場合(被害、術者のダウン、または集中を終了させるゾーンによる場合)、クリーチャーは去らずに反対側へ寝返り、呼び出し手の指揮下から外れ、退去させることもできなくなります。術者が自ら集中をやめる、別の呪文を発動するなど、ほかの方法で終了した場合は、従来どおり去ります。`rounds`は引き続き経過して尽きます。5eのConjure Elementalは`"calls": { "from": { ... }, "count": { "flat": 1 }, "rounds": 600, "hostileOnBreak": true }`で、「術者とその仲間に対して敵対的になり、攻撃することがある」を表します。これを使うルールセットにはCapability API 1.538が必要です。

自ら打撃を行う召喚物(Capability API 1.539)。`summons`には、`budget`なしで`"strikesAtTurnStart": true`を指定できます。発動時には狙った場所に出現するだけで、召喚者の各ターンの開始時に、召喚物のいる場所から`reach`内にいる、召喚者に敵対する最も近いクリーチャーに対して、エントリーの攻撃を行います(近くに誰もいなければ何もしません)。指示することはできず、応答待ちにすることもありません。このような召喚物は、14400`rounds`まで残れます。5eのFaithful Houndは、術者の呪文攻撃値による噛みつき(4d8の刺突ダメージ)を攻撃として持つエントリーに、`"summons": { "rounds": 4800, "reach": 5, "strikesAtTurnStart": true }`を指定します。これを使うルールセットにはCapability API 1.539が必要です。

死亡時に爆発するクリーチャー(Capability API 1.540)。クリーチャーには`"onDeath"`を指定できます。これは`actions`と同じ方法で記述しますがメニューには表示されないアクションで、`area`は自身の`around`のバーストです。死亡時(単なるダウンではなく、戦闘から脱落した時)に、バーストに巻き込まれた者に対して処理し、セーヴ、ダメージ、`applies`は通常のアクションと同じで、応答待ちにすることはありません。5eのダスト・メフィットのDeath Burstは`"onDeath": { "id": "death-burst", "name": "Death Burst", "budget": "reaction", "area": { "shape": "burst", "size": 5, "around": true }, "save": { "save": "con_save", "difficulty": 10, "onSuccess": "negates" }, "applies": [{ "condition": "blinded", "duration": { "rounds": 1 } }] }`です。バロールのDeath Throesは、30フィート内に、20d6の火ダメージを与え、敏捷力セーヴ(難易度: 20)に成功すれば半分になります。`zone`を持つ場合は、代わりに倒れた場所にその範囲を残します。範囲のマスは、それまで占めていた各マスを囲むバーストです。ゾーンには`"anchor": "point"`と`"outlasts": true`が必要で、作成者がいなくなった後は、各ラウンドの終了時に残り時間が減ります。スモーク・メフィットの雲は`"zone": { "rounds": 10, "anchor": "point", "outlasts": true, "triggers": [], "obscures": {} }`です。これを使うルールセットにはCapability API 1.540が必要です。

代わりにクリーチャーを回復するダメージ(Capability API 1.541)。クリーチャーの`"healedBy"`は、ダメージ種別を列挙し、大文字と小文字を区別せずに照合します。そのいずれかの種別の打撃は何のダメージも与えず(完全耐性として記録)、与えるはずだったダメージと同じだけのヒットポイントを、最大値を超えずに回復します。5eのフレッシュ・ゴーレムのLightning Absorptionは`"healedBy": ["lightning"]`です。クレイ・ゴーレムの酸、アイアン・ゴーレムの火、シャンブリング・マウンドの電撃も同様です。これを使うルールセットにはCapability API 1.541が必要です。

被害によってクリーチャーに付与される状態(Capability API 1.542)。クリーチャーの`"whenHarmedBy"`には四つまでのルールを指定でき、それぞれがダメージ種別の`by`(大文字と小文字を区別せずに照合)と、その種別の打撃で少しでもダメージを受けたときに自身に付与する`applies`を持ちます。完全耐性のある打撃からは何も受けないため、何も付与されません。5eのフレッシュ・ゴーレムのAversion of Fireは`"whenHarmedBy": [{ "by": ["fire"], "applies": [{ "condition": "aversion-of-fire", "duration": { "rounds": 1 } }] }]`で、次の自分のターンの終了時まで攻撃と判定に不利を与える状態です。ウォーター・エレメンタルのFreezeでは、冷気によって移動速度を減らす状態(20フィート減少)を付与します。これを使うルールセットにはCapability API 1.542が必要です。

三つのキーで表すゴーレムのBerserk(Capability API 1.543)。クリーチャーの`"rollsAtTurnStart"`には四つまでのルールを指定できます。それぞれ、ターン開始時に、体力が`healthAtMost`以下で、まだその`applies`をすべて保持してはいない場合にダイスを振り、`dice`で`atLeast`以上が出ると、それらを自身に付与します。戦闘の状態の`"behavior": { "nearest": true }`は、持ち主の各ターンの開始時に、敵味方を問わず、見える中で最も近いほかのクリーチャーに持ち主を向かわせます。隣にいなければ歩いて隣まで移動させ、そのターンに攻撃できるのはそのクリーチャーだけになります(誰も見えなければ、そのターンは自由です)。戦闘の状態の`"endsAtFullHealth": true`は、持ち主の体力が最大まで回復すると状態を終了させます。5eのフレッシュ・ゴーレムは`"rollsAtTurnStart": [{ "healthAtMost": 40, "dice": "1d6", "atLeast": 6, "applies": [{ "condition": "berserk", "duration": "until-dispelled" }] }]`と、`{ "condition": "berserk", "effects": [], "behavior": { "nearest": true }, "endsAtFullHealth": true }`を使います。クレイ・ゴーレムも同じで、体力の境界は、60です。いずれかを使うルールセットにはCapability API 1.543が必要です。

不意を突かれた標的、またはまだ行動していない標的への打撃(Capability API 1.544)。戦闘の状態が`attacks`または`damage`に加える変更には、`"whenTarget": "surprised"`または`"not-yet-acted"`(この戦闘でまだターンを開始していない標的)を指定できます。`attacks`への変更には`"critical": true`も指定でき、条件に該当する場合、持ち主の命中をクリティカルにします。5eのAssassinateは`[{ "to": "attacks", "mode": "advantage", "whenTarget": "not-yet-acted" }, { "to": "attacks", "critical": true, "whenTarget": "surprised" }]`です。バグベアのSurprise Attackは、`keepsOn`で付けたままにする状態に`{ "to": "damage", "dice": "2d6", "whenTarget": "surprised" }`を指定します。クリーチャーの`attackModes`にも`whenTarget`を指定でき(ドッペルゲンガーのAmbusherで、不意を突いたクリーチャーに対して有利)、追加効果の`when`には`"target-surprised"`と`"target-not-yet-acted"`を指定できます。いずれかを使うルールセットにはCapability API 1.544が必要です。

ノールのRampage(Capability API 1.545)。クリーチャーの`"rampage": { "action": "bite", "budget": "bonus", "move": 0.5 }`は、自身のアクションの一つと、戦闘の行動枠の一つを指定します。自分のターンに近接攻撃でクリーチャーの体力を、0にし、その行動枠が残っていれば、その行動枠を消費し、移動速度の`move`分(指定がなければ半分)の追加移動を得て、そのターン中にもう一度、そのアクションを無償で行えます。これを使うルールセットにはCapability API 1.545が必要です。

突撃の後に続くもの(Capability API 1.546)。クリーチャーのアクションの`charge`には`"then": { "action": "bite", "budget": "bonus", "targetHolds": ["prone"] }`を指定できます。自分のターンに行った突撃の打撃の処理が終わり、命中させた相手が`targetHolds`のすべての状態を保持していれば、同じクリーチャーの指定したアクションをそのターン中にもう一度提示します。`budget`から支払い、その相手だけを標的にします。5eのライオンのPounceとエルクのChargeの追撃が該当します。これを使うルールセットにはCapability API 1.546が必要です。

特定の形状でのみ行えるアクション(Capability API 1.547)。クリーチャーのアクションの`"inShape"`は、そのアクションが提示される形状を列挙します。持ち主自身の形状には`"own"`、または形態のベスティアリーのエントリーを`"<catalogId>/<entryId>"`として指定します(`shape`の状態によって取った形状です)。ワーボアはChargeに`"inShape": ["creatures/boar", "creatures/hybrid-wereboar"]`を指定して保持し(形状の`keeps`によって形状が変わっても保持)、槍には`["own"]`を指定します。ミミックのAdhesiveは物体の形態で使います。これを使うルールセットにはCapability API 1.547が必要です。

自身の形態に変わって踏みとどまること(Capability API 1.548)。`hangsOn`には`"becomes": { "action": "change", "form": "creatures/vampire-mist" }`を指定できます。1の体力で踏みとどまると、持ち主は直ちに、自身のアクションの`forms`にあるその形態になります。アクションの`shape`を持つ状態で付与され、そのアクションを使った場合とまったく同じです。5eのヴァンパイアのMisty Escapeは`"hangsOn": { "uses": 1, "label": "Misty Escape", "becomes": { "action": "shapechanger", "form": "creatures/vampire-mist" } }`で、`health`が`"own"`の形状の状態を使います。これを使うルールセットにはCapability API 1.548が必要です。

毎ターン回復する行動枠(Capability API 1.549)。クリーチャーには`"refillsEveryTurn": ["reaction"]`を列挙できます(1～4個の行動経済の行動枠ID)。誰かのターンが終了するたびに、列挙した各行動枠は最大回数まで回復します。そのため、自分のターンを待たず、次の戦闘参加者のターンに再び消費できます。5eのマリリスのReactiveは`"refillsEveryTurn": ["reaction"]`です。戦闘の行動経済にある行動枠のIDでなければ拒否されます。これを使うルールセットにはCapability API 1.549が必要です。

失われ、再生する頭部(Capability API 1.550)。クリーチャーには`"heads": { "count": 5, "lostAt": 25, "grows": 2, "growthStoppedBy": ["fire"], "healsPerHead": 10, "opportunityReactions": true, "whileMany": ["many_heads"] }`を指定できます。開始時には`count`個の頭部を持ちます(2～20個)。一つのターン中に受けたダメージが`lostAt`に達すると頭部が一つ失われ、失われるのは各ターン一つまでです。頭部がなくなると死亡します。自分のターンの終了時に、前の自分のターン以降に失われた頭部一つにつき、`grows`個(2がデフォルト)の頭部が再生します。`max`を指定していればそれを超えず、再生した頭部一つにつき`healsPerHead`ヒットポイントを回復します。ただし、前の自分のターン以降に、`growthStoppedBy`の種別のダメージを受けていれば再生しません(種別は大文字と小文字を区別せずに照合します)。`opportunityReactions`がある場合、最初の一つ以外の各頭部は、機会攻撃専用の追加のリアクションを与えます。自身のリアクションより先に消費され、自分のターンの開始時に回復します。頭部が一つより多い間は`whileMany`が指定する状態を保持するため、セーヴ修正値(`"to": "saves", "mode": "advantage", "against": { "conditions": ["blinded", "charmed", "deafened", "frightened", "stunned", "unconscious"] }`)を持つ状態で、ヒュドラのセーヴに有利を与えられます。頭部が一つになるとそれらを失い、頭部が再生すると取り戻します。`sequence`のステップには`"perHead": true`を指定できます。クリーチャーが現在持つ頭部一つにつき`times`回打撃を行い、選択肢はその数の標的を要求します。5eのヒュドラのMultiattackは`"sequence": [{ "action": "bite", "perHead": true }]`です。`heads`のないクリーチャーの`perHead`ステップは拒否されます。いずれかを使うルールセットにはCapability API 1.550が必要です。

クリーチャーへの命中で腐食する武器(Capability API 1.551)。クリーチャーには`"corrodesWeapons": { "tags": ["metal"], "sparesMagical": true, "ammunition": true }`を指定できます。手に持つ武器のアイテムが`tags`のいずれかを持ち、そのクリーチャーに命中すると、ダメージを与えてから、ダメージロールが恒久的に`step`(1がデフォルト)だけ減ります。戦闘では即座に打撃の数値が下がり、ペナルティは武器のスタックに書き戻され(`corroded`で、一個だけのスタックに保持)、以降のすべての戦闘で再び読み取られます。ペナルティが`destroyedAt`(5がデフォルト)に達すると、武器は破壊されます。その打撃はメニューからなくなり、スタックからも失われ、Journalでは喪失として数えられます。`sparesMagical`は`magical`タグのある武器を対象から除外します。`ammunition`がある場合、`tags`のいずれかを持つ矢弾が命中すると、ダメージを与えた後に破壊されるため、その射撃で使った矢弾は戦闘後に一切回収できません。発射する武器自体は腐食しません。5eのラスト・モンスターのRust Metalは`{"tags": ["metal"], "sparesMagical": true, "ammunition": true}`、ブラック・プディングのCorrosive Formは`{"tags": ["metal", "wood"], "ammunition": true}`です。これを使うルールセットにはCapability API 1.551が必要です。

状態数の拡大(Capability API 1.552)。シートの`live.conditions`、休息の`clear.conditions`、`combat.conditions`では、320エントリーだった上限が、640エントリーに増えました。320を超えて宣言するルールセットにはCapability API 1.552が必要です。

持ち主自身が状態を付与した標的への攻撃と対抗判定(Capability API 1.553)。`to: "attacks"`または`to: "damage"`の修正値は`"targetHoldsFromSelf": ["grappled"]`を持てます。持ち主が付与したそれらの状態のいずれかを持つ標的に対する、持ち主自身の攻撃かダメージだけを変更します。5eのGrapplerの特技は、`{"to": "attacks", "mode": "advantage", "targetHoldsFromSelf": ["grappled"]}`を持つ状態かレベルです。クリーチャーの`attackModes`エントリーも同じキーを持てます。ミミックのGrapplerなら`{"mode": "advantage", "targetHoldsFromSelf": ["grappled"]}`です。`targetHolds`を持つ対抗判定は`"targetHeldBySelf": true`を持てます。実行者が付与したその状態を持つ標的に対してだけ提示されます。対抗判定の`onWin`は`"both": { "applies": ["restrained"], "whileTargetHolds": "grappled" }`を持てます。各状態は敗者と勝者の両方に付与され、標的が`whileTargetHolds`を持たなくなると、終了の原因(脱出、解除、出所のダウン)にかかわらず、ただちにそれぞれ終了します。Grapplerの特技の押さえ込みは`{"id": "pin", "label": "Pin", "budget": "action", "attacker": {"checks": ["might"]}, "defender": {"checks": ["might", "agility"]}, "targetHolds": "grappled", "targetHeldBySelf": true, "onWin": {"both": {"applies": ["restrained"], "whileTargetHolds": "grappled"}}}`です。いずれかを使うルールセットにはCapability API 1.553が必要です。

死体からの呼び出しと呼び出し数の上限(Capability API 1.554)。クリーチャーのアクションの`calls`は`"atCorpse": { "withinRounds": 10, "is": { "types": ["humanoid"] } }`を持てます。このアクションは、死亡してから`withinRounds`ラウンド以内で、`is`に該当し(`targetIs`と同じ読み方の標的の条件。省略時はどの種類でも可)、アクションの`reach`内にある一体のクリーチャーを標的とし、そのような死体が戦場にある間だけ提示されます。呼び出したクリーチャーは死体の占めていた場所に、呼び出し手の側で出現し、死体は消えます。その死体から再び呼び出すことはできません。`options`による呼び出しは死体からは行えません。`calls`は`"atMost": 7`も持てます。呼び出したクリーチャーがその数だけ立っている間はアクションが提示されません。5eのレイスのCreate Specterは`{"creature": "creatures/specter", "count": {"flat": 1}, "atCorpse": {"withinRounds": 10, "is": {"types": ["humanoid"]}}, "atMost": 7}`で、`reach`は、10フィートです。どちらかを使うルールセットにはCapability API 1.554が必要です。

遮蔽を与える壁、移動手段を限定する移動速度、特定の場所で付与を防ぐ再生、標的の条件における飛行、保有状態、代替条件(Capability API 1.555)。ゾーンの`"cover": "half"`または`"three-quarters"`は、標的への線がゾーンの残存マスのいずれかを横切る攻撃や効果に、少なくともその段階の遮蔽を適用します(破壊された区画のマスは数えません)。段階の扱いは`combat.cover`に従い、標的自身と攻撃者自身のマスは途中のマスになりません。5eのBlade Barrierは`"cover": "three-quarters"`です。戦闘の状態の`"onlySpeeds": true`は、その状態がある間、`speeds`だけを持ち主の移動手段にします。歩行と自身のほかの移動速度は、0になります。5eのGaseous Formは`{"speeds": {"fly": 10}, "hover": true, "onlySpeeds": true}`です。再生の`"notIn": { "light": ["sunlight"], "terrain": ["running-water"] }`は、持ち主がその場所でそれらの光のいずれかに照らされているか、`terrain`が指定する場所のタイルまたは盤面上でターンを開始した場合、そのターン開始時の再生の付与を防ぎます(クリーチャーの`checkModes`と同じ読み方です)。ヴァンパイアの「ヴァンパイアが日光の下や流水の中にいない場合」に相当します。標的の条件(`targetIs`、ゾーンの`keepsOut.is`、および標的の条件を読むほかのすべての箇所)は、`"flying": true`(飛行の移動速度があるものだけ)や`"holding": ["gaseous_form"]`(これらの戦闘の状態のいずれかを持つものだけ)も指定でき、それぞれほかの要求条件も満たす必要があります。また、`"anyOf": [ ... ]`で、二つから四つの標的の条件のうち少なくとも一つを満たすことも指定できます。5eのWind Wallが進入を防ぐのは`{"anyOf": [{"upToSize": "tiny", "flying": true}, {"holding": ["gaseous_form"]}]}`です。いずれかを使うルールセットにはCapability API 1.555が必要です。

ゲーム内時間の経過後に
回復するチャージと使用回数
(Capability API 1.556)。
アイテムの`charges.recharge`、
追加の使用方法の`uses.recharge`、
命中の`uses.recharge`は`"after": { "days": 2 }`または`"after": { "hours": { "dice": "1d12" } }`(または両方を加算したもの)を持てます。
回数を使い切ると、
ゲームの時計で
その時間が経過するのを
待ち、
その後`amount`だけ回復します(`"max"`なら全量)。
待機は回数を使い切った後で
時計が初めて進むときに始まり、
時間をダイスで決める場合もそのときに振ります。
待機はスタックに保持されます。
`after`がある場合は`rests`を空にでき、
どの休息でも回数が早く回復しなくなります。
両方がある場合はどちらでも回復し、
休息で回復した回数については待機が終わります。
時計はゲーム自身のものです。
時計が進むたびに(アクションの所要時間、
マップ上や世界を横断する歩行、
Game Masterの語りで経過する日数)、
バッグの待機時間に
計上されます。
5eのFigurines of Wondrous Powerは`{"rests": [], "amount": "max", "after": {"days": 2}}`(日数はそれぞれ固有)で、
Wings of Flyingは`{"rests": [], "amount": "max", "after": {"hours": {"dice": "1d12"}}}`です。
`after`を使うルールセットにはCapability API 1.556が必要です。

段階式のゾーン(Capability API 1.557)。ゾーンの`"stages"`(一つから十個、順序付き)は、発動したターンを最初のターンとして数え、術者のどのターン以降に何をするかを示します。`{ "from": 3, "label": "Lightning", "amount": { "dice": "10d6" }, "damageType": "lightning", "save": "dex_save", "onSave": "half", "count": 6 }`のように書きます。術者のターンの開始時に、そのターンの段階(その時点で`from`に到達している最後の段階)が、中にいる者に`amount`の量の`damageType`のダメージを与えます。エントリー自身の難易度で`save`のセーヴを行います(`onSave`は「half」、省略時は「none」)。`count`を指定した場合はその数だけに与え、術者の敵を優先し、ゾーンの中心に近い者を優先します。`amount`のない段階は誰にも打撃を与えません。段階が続く間、`difficult`はゾーンの地面を移動困難にし、`obscures`はゾーンを重度の視界不良にし、`noRanged`はゾーンの内外やゾーンを横切る遠隔武器によるすべての攻撃を止めます(呪文や範囲効果は武器ではありません)。エントリー自身の効果は最初のターンのもので、ゾーンの`triggers`(空でも可)のタイミングか、発動時に生じます。5eのStorm of Vengeanceは、発動時には雷鳴と聴覚喪失をもたらし、その後の段階は、2(酸の雨、1d6の酸)、3(稲妻、10d6の電撃を六本、Dexterityセーヴ成功で半減)、4(雹、2d6の殴打)、5(突風と氷雨、1d6の冷気、`difficult`、`obscures`、`noRanged`)から始まります。`stages`を使うルールセットにはCapability API 1.557が必要です。

呼び出し手を基に作るクリーチャーと指示による行動(Capability API 1.558)。カタログのエントリーやアイテムの使用の`calls`は`"fromCaller": { "health": true, "toHit": <value>, "adds": <value> }`を指定できます。呼び出す各クリーチャーは、呼び出し手の体力の最大値を自身の体力とし、各攻撃では`toHit`(呼び出し手のシートから、`amountAdd`と同じように読む値)をボーナスとしてダイスを振り、同じように読む`adds`を各ダメージ量に加えます。`"commandedWith": "bonus"`(戦闘の行動経済にある行動枠)がある場合は、呼び出し手の指示によってのみ行動します。出現した最初のターンは無償で、それ以降の各ターンでは呼び出し手がその行動枠から、1を消費するか、ターンが何もせず過ぎます(待機したことがログに表示されます)。`"initiative": "after"`がある場合、そのターンは呼び出し手の直後なので、自身のターンで行動枠を消費した呼び出し手には、指示用の行動枠が残りません。5eのArcane Handは`{"initiative": "after", "fromCaller": {"health": true, "toHit": <spell attack>, "adds": <spellcasting modifier>}, "commandedWith": "bonus"}`で大型の手を呼び出します。四種類の手は自身のアクションで、Clenched Fistの攻撃、Forceful Handの押す対抗判定、Grasping Handの掴む対抗判定と掴んでいる者への圧壊、Interposing Handの遮蔽として立ちはだかる行動です。どちらかを使うルールセットにはCapability API 1.558が必要です。

ダイスで決める表(Capability API 1.559)。
`"rolled": true`を持つカタログのエントリーやアイテムの使用の`calls`は、
使用時に`options`のどれが出るかをダイスで決め、
選択では決めません。
各選択肢はほかとの比較で`"weight"`(1から、
100まで。
指定しない場合: 1)に比例する確率を持ち、
一つの`creature`を指定します。
`"hostile": true`の選択肢は呼び出し手に敵対し、
反対側に加わるクリーチャーを呼び出します。
`"none": true`と`label`を持つものは誰も呼び出さず、
ラベルだけが伝えられます。
5eのBag of Tricksはそれぞれ一体の野獣を呼ぶ八つの選択肢からダイスで決めます。
Efreeti Bottleは`{"creature": "creatures/efreeti", "count": {"flat": 1}, "weight": 1, "hostile": true, "label": "It attacks you"}`、
使用者に仕える同じイフリートを`"weight": 8`で呼ぶもの、
`{"none": true, "weight": 1, "label": "It grants three wishes"}`からダイスで決めます。
2行から、
24行までの`useTable`もアイテムに指定できます。
各行は固有の`weight`、
`label`、
`use`を持ち、
アイテムの`use`が`"rollsTable": true`を指定するとこの表でダイスを振り、
自身の使用分だけを支払います(一体のクリーチャー、
または`targets`が指定する側を標的にする`utility`の使用です)。
出た行の効果は使用の標的に生じ、
範囲があればそこを中心とし、
標的が`self`なら使用者に生じます。
`use`のない行(草が生える、
蝶が現れるなど)は描写だけです。
5eのWand of Wonderは、
120フィート以内の一体を標的とする使用にチャージを消費し、
その表でSlow、
Faerie Fire、
使用者への朦朧、
Stinking Cloud、
サイの突撃、
Lightning Bolt、
Fireballなどからダイスで決めます。
ログには振ったダイスと出た結果が表示されます。
いずれかを使うルールセットにはCapability API 1.559が必要です。

物体へのダメージの倍増(Capability API 1.560)。`"doubleToObjects": true`を持つクリーチャーのステータスブロックは、クリーチャー以外のあらゆるものに通常の倍のダメージを与えます。対象は壁の区画、多層の壁の層、盤面の小道具で、物体が軽減する分や倍受ける分を適用した後に倍増します。5eの地のエレメンタルなど、「物体と建造物に倍のダメージを与える」クリーチャーのSiege Monsterに相当します。これを使うルールセットにはCapability API 1.560が必要です。

誰が誰の言葉を理解するか(Capability API 1.561)。`combat.languages`の`{"list": <list>, "column": <column>, "prefix": <text>}`は、キャラクターの言語をどこから読むかを指定します。そのシートのリストで、列が接頭辞で始まる各行が一つの言語を示し(接頭辞がある場合)、接頭辞の後の残りの部分を大文字と小文字を区別せずに読みます。5eでは`{"list": "proficiencies", "column": "name", "prefix": "Languages: "}`です。クリーチャーのステータスブロックは`"languages": ["Common", "Abyssal"]`で自身の言語を指定します。エントリーの`targetTypes`に`"understands": true`がある場合、使用者が理解する言語を理解できるクリーチャーにしか向けられず、巻き込めません。5eのSuggestion、Mass Suggestion、Commandのように、使用者の言葉を理解できないクリーチャーには何もしません。言語が記載されていない者(`combat.languages`のないシート、`languages`のないクリーチャー)は、この条件で除外されません。このような呪文が標的に何をさせるかは、状態自身の`behavior`(1.264)で指定します。Suggestionなら発動時の選択肢(1.313)に、歩き去る(`moves`)、動かずにいる(`only: []`)、手に持っているものを落とす(`drops`)、アクションを無駄にする(`wastes`)状態を用意します。いずれかを使うルールセットにはCapability API 1.561が必要です。

反抗に対する被害(Capability API 1.562)。戦闘の状態の`harms`は`"at": "attacks-source"`を指定でき、持ち主がその状態を付与した者に攻撃やダメージを与える何らかの行動をしたときに発生します。`"at": "attacks-source-side"`なら、その側の誰に対してでも発生します。`"once": true`がある場合は、その状態が続く間に一度だけダメージを与えます。5eのGeasで「私や仲間を傷つけるな」と命じる場合は`{"at": "attacks-source-side", "dice": "5d10", "type": "psychic", "once": true}`の状態です(一日に一度までで、戦闘は一日より短いためです)。どちらかを使うルールセットにはCapability API 1.562が必要です。

分配する回復(Capability API 1.563)。`"sharesHeal": true`を持つ`heal`エントリーは、`amount`(と`amountAdd`)を一度だけ振って一つの回復量を決め、選んだ順に標的へ分配します。各標的を最大値まで回復し、残りを次の標的に渡し、なくなるまで続けます。`"sharesHeal": "half"`がある場合は誰も最大値の半分を超えて回復せず、すでに半分以上の者は何も受け取りません。5eのPreserve Lifeは`{"kind": "heal", "amount": {"flat": 0}, "amountAdd": <five times cleric level>, "sharesHeal": "half", "targets": "ally", "targetCount": 6, "range": 30, "targetTypes": {"not": {"types": ["undead", "construct"]}}}`です。これを使うルールセットにはCapability API 1.563が必要です。

飛来するものと所持品によるリアクションの絞り込み(Capability API 1.564)。リアクションの`against`は`"qualities"`を指定できます。アクションの名前にかかわらず、それらのいずれかを持つものに応答します。ステータスブロックのアクションやそのダメージ、カタログのエントリー、アイテムに記載できます。5eのRock Catchingは`{"on": "aimed", "cancels": true, "cancelSave": {...}, "against": {"qualities": ["thrown_object"]}}`で応答し、各ジャイアントのRockやカタパルトの石にはダメージに`"qualities": ["thrown_object"]`を書き、「同様の物体」も含められます。ほかの者のために応答する瞬間(`for`)は`"forHolds": [<item tags>]`を指定できます。応答してもらう者が、それらのタグのいずれかを持つアイテムを、着用または携行して持っているときだけ開きます。シールド・ガーディアンのShieldは`{"on": "hit", "for": "ally", "within": 5, "at": "target", "forHolds": ["shield_guardian_amulet"]}`なので、その護符を着用する者だけを守ります。どちらかを使うルールセットにはCapability API 1.564が必要です。

カタログのエントリーでの対抗判定と使用者が選ぶ場所への標的の移動(Capability API 1.565)。エントリーの`mechanics.contest`は`{"attacker": [<check ids>], "defender": [<check ids>], "ties": "attacker" | "defender"}`です。命中判定やセーヴの代わりに(どちらも持ちません)、使用者は`attacker`のうち最良のもの、各標的は`defender`のうち最良のものでダイスを振ります。IDは`combat.checks`のもので、同点は特に指定しなければ防御側の勝ちです。勝った標的にだけ、そのエントリーが行うほかの効果が適用されます。`mechanics.movesTarget`は`{"distance": <ruleset distance>, "up": true}`です。一体のクリーチャーを狙うエントリーで、そのクリーチャーを使用者が選ぶマスに置きます。元の位置から`distance`以内、使用者からエントリーの`range`以内で、途中を歩かないため、誰もそのクリーチャーへの打撃を得ません。`up`があれば、その場所の地面からその距離分のレベルまで持ち上げられ、`levels x levelCells`を距離として数えます。持ち上げたものが上空に留まるのは`hover`を持つ状態が支えている間だけで、なければ上空のほかの者と同じように落下します。標的を選ぶと盤面で移動先を尋ねられ、プレイヤーはその場に残すこともできます。5eのTelekinesisは`{"kind": "debuff", "range": 60, "contest": {"attacker": ["spellcasting"], "defender": ["strength"]}, "movesTarget": {"distance": 30, "up": true}, "applies": [{"condition": "telekinesis_held", "duration": {"rounds": 1}}], "targetTypes": {"is": {"upToSize": "large"}}}`で、`combat.checks`のエントリーは`{"id": "spellcasting", "value": {"abilityModFromField": "spellcasting_ability"}}`と`{"id": "strength", "value": {"abilityMod": "str"}}`、`telekinesis_held`は拘束状態の効果に`hover`を加えたものです。ほかの集中呪文と同じく、`repeats`で毎ターン再び行います。どちらかを使うルールセットにはCapability API 1.565が必要です。

持ち主を持ち上げる状態(Capability API 1.566)。`combat.conditions`のエントリーは`"lifts": <ruleset distance>`を指定できます。その状態が続く間、持ち主は足元の地面からその距離だけ上に持ち上げられ、そこで浮遊します。距離は盤面のレベル数に丸めます(少なくとも一レベル)。状態が外れると、上空に留めるものが何もないほかの者と同じように落下します。持続する範囲の`inside.conditions`で付与すれば、範囲に巻き込まれた全員を持ち上げ、範囲がなくなると落とします。5eのReverse Gravityは`{"inside": {"conditions": ["reverse_gravity"], "save": {"save": "dex_save", "ignoresUntilLeaves": true}}}`のゾーンで、Dexterityセーヴは固定されたものに掴まることを表し、状態は`{"condition": "reverse_gravity", "effects": [], "lifts": 100}`です。これを使うルールセットにはCapability API 1.566が必要です。

状態を付与した者以外を見つけるための判定モード(Capability API 1.567)。`mode`を持つ状態の`"checks"`への修正値は`"exceptSource": true`を指定できます。隠れている者に対するSearchにだけ適用され、そこでも持ち主にその状態を付与した者以外の各人に対してのみ適用されます。持ち主が行うほかのあらゆる判定は変わりません。5eのEnthrallは`{"condition": "enthralled", "effects": [], "modifiers": [{"to": "checks", "skills": ["perception"], "mode": "disadvantage", "exceptSource": true}]}`で、呪文のセーヴによって付与します。これを使うルールセットにはCapability API 1.567が必要です。

クリーチャーの代わりに幻像を呼び出す(Capability API 1.568)。エントリーの`calls`は`"illusion": true`を指定できます。呼び出したものはすべて幻像です。それに向けたものや、範囲に巻き込むものはすべてすり抜けて何もせず、行った者の側は以後その正体を見破ります。その側には二度と標的として提示されませんが、反対側は引き続き騙されることがあります。呼び出し手自身の側は決して騙されません。5eのMisleadは自身を標的にするエントリーで、`applies`で術者を不可視にし、`calls`は`{"creature": "creatures/illusory-double", "count": {"flat": 1}, "initiative": "after", "commandedWith": "bonus", "illusion": true}`です。分身は術者の移動速度と無害なアクションを持つクリーチャーです。Project Imageも同じで、固有の射程と持続時間を使います。これを使うルールセットにはCapability API 1.568が必要です。

該当する瞬間に自動で発動する蓄積済みの呪文(Capability API 1.569)。`stores`(アイテムまたはクリーチャーのもの、1.524)は`"castsOn": {"on": "harmed" | "down", "at": "self" | "source"}`を指定できます。蓄積した最初のエントリーは、持ち主(アイテムの場合は着用者)がダメージを受けたとき(`harmed`)、または生きたまま体力がなくなったとき(`down`)に、持ち主自身(`self`、デフォルト)か、被害を与えた者(`source`)に、コストなしで自身の術者の数値を使って自動で発動します。一度だけ発動し、手動での発動は提示されません。5eのContingencyは`{"stores": {"catalogs": ["spells"], "levels": 5, "count": 1, "castsOn": {"on": "down"}}}`を持つ着用アイテム(象牙の小像)で、組み合わせる呪文を戦闘前に`standing`で蓄積します。シールド・ガーディアンのブロックは`{"catalogs": ["spells"], "levels": 4, "count": 1, "castsOn": {"on": "harmed", "at": "source"}}`を指定でき、自分を攻撃した者に発動する呪文を設定します。これを使うルールセットにはCapability API 1.569が必要です。

`absorbs`のルールは、`seen: true`で、取り込むものを発動した術者が持ち主から見えることも要求できます(Ioun Stone of Greater Absorptionの「見ることができるクリーチャーが発動したもの」)。また、`spends`で行動経済の行動枠を指定して、取り込みに持ち主が消費するその行動枠の量を、1にすることもできます(Rod of Absorptionのリアクション)。その行動枠が残っていないか術者が見えない場合、エントリーは通常どおり適用されます。`spends`は`combat.economy.budgets`のいずれかを指定する必要があります。どちらかを使うルールセットにはCapability API 1.570が必要です。

着用アイテムの`absorbs`は、`lifetime`で、アイテムの存続期間全体にわたる取り込み量も数えられます(Rod of Absorption: 50レベル)。量はインベントリーのスタックに`absorbedEver`として保持され、戦闘のたびに書き戻されます。取り込むと`lifetime`を超えてしまうエントリーは通常どおり適用され、チャージを消費しても取り込める余地は戻りません。アイテムの着用時の効果だけがこれを持てます。これを使うルールセットにはCapability API 1.571が必要です。

着用アイテムの`paysSlots`は、チャージで使用分を支払えるプールグループを指定します。一レベルにつき一チャージです(Rod of Absorptionの「ロッド内のエネルギーを呪文スロットに変換する」、`"slots"`)。そのグループの各使用は、自身のプールか、チャージ数が届くそれより上のプールについて、アイテムから支払う方法も`payWith`の`itemslot:<item>:<pool>`として提示されます。その方法で発動すると、プールの代わりにその数のチャージを消費します。アイテムには`charges`が必要で、そのグループに属するプールが存在する必要があります。これを使うルールセットにはCapability API 1.572が必要です。

アイテムの`charges`は`max`と並べて`"rolled"`のダイスを指定できます。各スタックの初期チャージは満タンではなく、そのダイスをスタックごとに一度だけ振った数になり、その後は読むたびに同じ値になります。範囲は、0から`max`までです(Rod of Absorptionの`{ "max": 50, "rolled": "1d10" }`)。戦闘、使用、休息によって回数が変わると、スタックは代わりにその回数を保持します。これを使うルールセットにはCapability API 1.573が必要です。

チャージの`then.action`は、チャージしたアクション自身を指定できます(軍馬のTrampling Chargeの「蹄でもう一度攻撃」)。`then.budget`を使い、同じ標的にもう一度提示され、その二度目の打撃にはチャージが伴いません。これを行うルールセットにはCapability API 1.574が必要です。

アイテムの`forms`は、持ち主がアイテムを別の形態に変えたり元に戻したりできるようにします。`label`は作られたときの形態の名前、`budget`は戦闘中の変形で消費する行動枠です。`into`は形態のリスト(最大: 8個)で、それぞれが`label`と別の`item`を持ちます。その形態ではそのアイテムの`attack`、`worn`の効果、`toggle`を引き継ぎ、それ以外は自身のもの(使用回数、チャージ、蓄積内容)を保ちます。5eのRod of Lordly Mightは`{ "label": "Mace", "budget": "bonus", "into": [{ "label": "Flame tongue", "item": "gear/flame_tongue_longsword" }, { "label": "Battering ram", "item": "gear/lordly_ram" }] }`です。戦闘ではほかの各形態への切り替えが、インベントリーではボタンが提示され、スタックは最後に選ばれた形態を保ちます。一スタックにつき一個で、どの形態も自身でさらに変形することはできません。これを使うルールセットにはCapability API 1.575が必要です。

アイテムの`stores`は、`found`で発見時の蓄積内容を指定できます。`levels`はスタックごとに一度振るダイス(Ring of Spell Storingの`"1d6-1"`)、`from`は自身のカタログのエントリー(最大: 40エントリー)で、それぞれが蓄積時の`level`と任意の`label`を持ちます。各スタックは、そのスタック用に抽選したリストの順序で、まだ収まる各エントリーを`count`まで蓄積します。インベントリーにはその内容が表示され、戦闘では発動できます。戦闘で蓄積や蓄積内容の発動を行うと、スタックは空になった場合も含め、残った内容を保持します。これを使うルールセットにはCapability API 1.576が必要です。

状態のルールは`controls: true`を指定できます。持ち主はその状態を与えたクリーチャーの側で戦い、状態が終了するか出所が倒れると元の側に戻ります。`holderDies`に`save`と`difficulty`(値の参照)がある場合、出所は支配しているクリーチャーが死亡したときにそのセーヴを行い、失敗すれば倒れます。Magic Jarの術者が、憑依している肉体を殺されると死亡するのと同じです。ログは支配の開始と解除を表示します。これを使うルールセットにはCapability API 1.577が必要です。

対抗判定は、最大四つの状態を指定する`actorHolds`を持てます。特技の`keepsOn`が与える状態のように、それらすべてを持つ戦闘参加者にのみ提示されます。Grapplerの特技の押さえ込みは、その特技を持つ者にだけ提示され、`targetHeldBySelf`があれば自身が掴んでいるクリーチャーに対してだけ提示されます。これを使うルールセットにはCapability API 1.578が必要です。

ゾーンの`inside.save`は`"onCast": true`を指定できます。ゾーンの発動時に中にいる者は、状態が付与される前にその場でセーヴを行い、成功すると、後から成功した者と同じく、外に出るまで内部での効果を無視します。5eのReverse Gravityでは、呪文の発動時にDexterityセーヴに成功したクリーチャーは、固定されたものに掴まり、持ち上げられません。これを使うルールセットにはCapability API 1.579が必要です。

ゾーンの段階は`"breaksConcentration": true`を指定できます。その段階が続く間、中でターンを開始し、集中している者は、エントリー自身のセーヴ難易度に対してルールセットの集中セーヴを振ります。セーヴ難易度がない場合は、10で、失敗すると集中を失います。`"disperses": true`がある場合、その段階が続く間はゾーンが風になります。到達した霧が`dispersed`を持つなら、`disperses`を持つゾーンが霧を終わらせるのと同じように終了します。5eのStorm of Vengeanceでの該当ラウンドは、5から、10までです。これを使うルールセットにはCapability API 1.580が必要です。

ゾーンは`"turnsShots": {}`を指定できます。嵐の段階の`noRanged`と同じように、そのマスに入る、出る、横切る、魔法でない武器による遠くからの攻撃(攻撃ロールがあり、範囲ではなく、呪文でもなく、`magical`の性質もないもの)は行えません。`spares`は、それでも通過する攻撃をラベルで指定します(最大: 12個)。5eのWind Wallなら、ジャイアントが投げる大岩に対して`{"turnsShots": {"spares": ["Rock"]}}`です。これを使うルールセットにはCapability API 1.581が必要です。

エントリーの`save`は`"advantageIfFought": true`を指定できます。戦闘中に使用者の側と敵対する側の標的、つまり使用者やその仲間が戦っている相手は、有利でそのセーヴを振ります。5eのCharm PersonとEnthrallに相当します。これを使うルールセットにはCapability API 1.582が必要です。

アイテムの`use`と、
各`moreUses`の`use`は、
カタログの
エントリーと
同じように、
`concentration`と
ともに
`repeats`を
指定できます。
使用者が
その効果への
集中を
続けている
間は、
`repeats.budget`で
再び
提示され、
使用した際に
支払った
コストの
段階で
実行されます。
アイテムから
再び
消費するものは
ありません。
5eの
Telekinesis、
Vampiric Touch、
Call Lightning、
Heat Metalの
巻物と、
Staff of the Magiの
Telekinesisに
相当します。
これを使う
ルールセットには
Capability API 1.583が
必要です。

`combat.conditions`のエントリーは`endsWhenSource`を指定できます。その状態を付与した者に、指定した`effects`のいずれかが生じるか、指定した`conditions`のいずれかが付いている場合、指定した`components`のいずれかを使用できなくなった場合(Silenceが`verbal`を阻む場合など)、または持ち主が指定した`holderLacks`の感覚のいずれかを欠いた場合に、その状態は外れます。感覚は、宣言済みの戦闘の感覚か、状態の`lacks`が指定するものです(5eの聴覚を失った状態が指定する`hearing`など)。5eのEnthrallは、術者が無力状態になるか発声できなくなると終了し、術者の声を聞ける者にだけ持続します。`{"effects": ["cannot-act"], "components": ["verbal"], "holderLacks": ["hearing"]}`です。これを使うルールセットにはCapability API 1.584が必要です。

`combat.conditions`のエントリーは、自身と同じものとして扱うほかの状態を最大四つ、`countsAs`で指定できます。そのいずれかへの完全耐性はこの状態の付与も防ぎ(`conditionImmunities`と`conditionImmunitiesFrom`)、いずれかを`suppresses`で抑えるものはこの状態の適用も抑えます。いずれかに対するセーヴはこの状態に対するセーヴでもあり(そのため、魅了状態に対するセーヴでの有利はこの状態にも適用されます)、いずれかを指定する`ends`はこの状態も終了させます。5eのEnthrallとGeasなら`"countsAs": ["charmed"]`です。これを使うルールセットにはCapability API 1.585が必要です。

クリーチャーのアクションは`"callerAdds": false`を指定できます。`fromCaller.adds`で呼び出したクリーチャーで、そのアクションのダメージに呼び出し手からの加算を行わなくなります。量(アクション自身のダメージダイスと同じ面数のダイス、固定量、または両方)を指定する`perCallerStep`がある場合、呼び出しの支払いが基本より上の段階になるごとに、その量だけ追加のダメージを与えます。5eのArcane HandのClenched Fistなら`{"damage": {"dice": "4d8", "type": "force"}, "callerAdds": false, "perCallerStep": {"dice": "2d8"}}`です。これを使うルールセットにはCapability API 1.586が必要です。

対抗判定は、`combat.sizes`のサイズを`advantageAtMostSize`で指定できます。実行者は、そのサイズ以下の標的に対して有利でダイスを振ります。`onWin`は`pushRead`を指定でき、実行者のシートから読む値を、ルールセットの距離で`push`に加えます。呼び出したクリーチャーに自身のシートがない場合は、呼び出し手のシートから読みます。5eのArcane HandのForceful Handは、手だけが行う対抗判定で(`actorHolds`にブロックの`keepsOn`が保持する状態を指定)、`"advantageAtMostSize": "medium"`と`{"onWin": {"push": 5, "pushRead": <five times the spellcasting modifier>}}`を持ちます。Grasping Handも同様の対抗判定で、手自身のStrengthで掴みます。これを使うルールセットにはCapability API 1.587が必要です。

戦闘の状態は`coverFor`(`{"tier": "half" | "three-quarters", "who"?: "source" | "caller"}`)を指定できます。付与した者が立っている間、持ち主から付与した者への攻撃、または`"who": "caller"`がある場合は付与した者を呼び出したクリーチャーへの攻撃に、少なくともその段階の遮蔽が適用されます。その者が持ち主の効果に対して行うセーヴも、`cover.saves`が指定するものなら同様です。5eのArcane HandのInterposing Handは、その前に立ちはだかる相手のクリーチャーに`{"tier": "half", "who": "caller"}`を持つ状態を付与します。`combat.cover`が必要です。これを使うルールセットにはCapability API 1.588が必要です。

`combat.languages`は`split`で最大四つの区切り文字列を指定できます。各行の接頭辞の後のテキストを、そのいずれかで分割して複数の言語にするため、5eの`[", ", " and "]`なら、種族の「Languages: Common and Dwarvish」という一行で二言語を指定します。シートに言語を指定する行がないキャラクターは、以後は言語が未記載として扱われ、`languages`のないステータスブロックと同じく、それを理由に誰かが除外されることはありません。`split`を使うルールセットにはCapability API 1.589が必要です。

着用アイテムの`paysSlots`は、持ち主がいくらか持つプール(シートの`max`が、0より大きいもの)についてのみ支払うようになりました。また、そのグループのプールを`paysSlotsMax`で指定でき、それを超えるものは提示されません。5eのRod of Absorptionの「自身の呪文スロット以下のレベルで、最大でも、5レベルまで」は`{"paysSlots": "slots", "paysSlotsMax": "slots_5"}`です。`paysSlotsMax`を使うルールセットにはCapability API 1.590が必要です。

`rolled`による呼び出しの選択肢は、`rounds`(呼び出し自身の指定に代わり、そのラウンド数で呼び出した者が去る)、`spendsItem`(その選択肢が出ると、ダイスを振った元のアイテムを永久に使い切り、以後その使用が提示されなくなる)、`pastLifetime`を指定できます。アイテムの使用による呼び出しでは、`keepsRoll`(最初のダイスの結果をアイテムに保持し、その後の使用では毎回同じ選択肢になる)、`lifetimeUses`(アイテムの存続期間中にその回数使用した後は、以後の各使用が唯一の`pastLifetime`の選択肢となり、ダイスを振らない)を指定できます。保持した結果、使用回数、使い切ったかどうかは戦闘後もアイテムに残ります。5eのEfreeti Bottleは`{"rolled": true, "keepsRoll": true, "lifetimeUses": 3, "options": [{"creature": "...", "weight": 1, "hostile": true, "rounds": 5, "spendsItem": true}, {"creature": "...", "weight": 8}, {"none": true, "weight": 1, "label": "Three wishes", "spendsItem": true}, {"none": true, "label": "It escapes", "pastLifetime": true, "spendsItem": true}]}`です。いずれかを使うルールセットにはCapability API 1.591が必要です。

カタログのエントリーやアイテムの使用の`save`は、1.268以降のオーラのセーヴと同じく、`failedBy`(`{"atLeast": 5, "applies": [...]}`)を指定できます。その値以上の差で失敗すると、エントリーの`applies`の代わりにそれらを付与します。5eのWand of Wonderなら、5以上の差で失敗すれば即座に石化し、それ以外の失敗では拘束状態になります。`{"applies": [{"condition": "restrained"}], "save": {"save": "con_save", "onSuccess": "negates", "failedBy": {"atLeast": 5, "applies": [{"condition": "petrified"}]}}}`です。これを使うルールセットにはCapability API 1.592が必要です。

カタログのエントリーやアイテムの使用の仕組みは`amountTimes`(2から、100)を指定して、`amount`のダイスの結果をその値で乗算できます。また、`"dividedAmong": "caught"`で、攻撃ロールやセーヴを行わず、その合計を`area`に巻き込まれたクリーチャー間で均等に分け、小数点以下を切り捨てられます。5eのWand of Wonderの宝石の「1d4 × 10個の宝石...宝石のダメージの合計を、直線内のすべてのクリーチャーに均等に分配する」は`{"area": {"shape": "line", "size": 30, "width": 5}, "amount": {"dice": "1d4"}, "amountTimes": 10, "dividedAmong": "caught", "damageType": "bludgeoning"}`です。どちらかを使うルールセットにはCapability API 1.593が必要です。

カタログのエントリーの仕組みは、距離を指定する`targetsWithinFirst`を持てます。最初の後に選ぶ各クリーチャーは、最初に選んだクリーチャーからその距離以内に立っている必要があります。対して`targetsWithin`はすべての組み合わせでその距離以内であることを求めます(エントリーは二つのうち片方を取ります)。5eのChain Lightningの「ほかに三体の標的、それぞれが最初の標的から、30フィート以内にいる必要がある」は`{"targetCount": 4, "targetsWithinFirst": 30}`で、最初に指定したクリーチャーが最初の標的です。最初の標的の両側への二つの跳躍で、両者が、50フィート離れていても許可されますが、最初の標的から、35フィート離れたものは遠すぎるとして拒否されます。これを使うルールセットにはCapability API 1.594が必要です。

ゾーンの`keepsOut`は`"reach": true`を指定できます。進入を防がれる者は、ゾーンを通して手を伸ばすこともできません。外にいるそのような者は、中に立っている者に対して最小の間合い(一マス)以下の近接攻撃を行えず、その者が中を移動するときにすれ違いざまの打撃を行うこともできません。遠くからの攻撃、間合いの長い武器、呪文は引き続き通過します。`"endsOnSweep": true`がある場合、術者の周囲にあるゾーン(`anchor: "caster"`)や持ち運ばれるゾーンは、中心にいる者の移動によって進入を防ぐ相手を覆うと、ただちに終了します(終了としてログに記録されます)。5eのAntilife Shellの「対象となるクリーチャーの通過や、通して手を伸ばす行為を防ぐ...対象となるクリーチャーが障壁を強制的に通過するように移動すると、呪文は終了する」は`{"area": {"shape": "burst", "size": 10}, "zone": {"anchor": "caster", "keepsOut": {"is": {"except": {"types": ["undead", "construct"]}}, "reach": true, "endsOnSweep": true}, ...}}`です。どちらかを使うルールセットにはCapability API 1.595が必要です。

戦闘の状態の`hangsOn`は`"ends": true`を指定できます。一度機能すると、それを持つ状態が終了します(クリーチャーやレベルに付けたものでは拒否されます)。`"outright": true`がある場合、ダメージを与えずに持ち主を即死させるものにも機能します。エントリーの`kills`、`killsAtMost`、死亡をもたらすセーヴの失敗、破壊する段階が該当します。それらは取り消され、何も適用されず、即死を免れたことがログに表示されます。1で踏みとどまる場合と同じく、使用として数え、プールを消費します。打撃を読まないため、`save`、`notFrom`、`notCritical`、`dealtAtMost`は伴いません。5eのDeath Wardの「標的がダメージを受けて初めて、0ヒットポイントになるとき、代わりに、1ヒットポイントになり、呪文は終了する。この呪文がまだ有効な間に、標的がダメージを与えず即座に殺す効果を受けた場合、代わりに標的に対するその効果を無効にし、呪文は終了する」は、状態の`{"hangsOn": {"uses": 1, "ends": true, "outright": true, "label": "Death Ward"}}`です。どちらかを使うルールセットにはCapability API 1.596が必要です。

対抗判定数の拡大(Capability API 1.597)。`combat.contests`は、12エントリーだった上限が、16エントリーに増えました。12を超えて宣言するルールセットにはCapability API 1.597が必要です。

対抗判定の`onWin`は`push`と並べて`"follows": true`を指定できます。勝者は押した相手とともに移動し、その相手が途中で最後に離れたマスに入って、隣に留まります。一マスより大きい者や、そのマスに入る余地がない者は、相手の隣にある空き場所のうち元の位置に最も近い場所に移動します。押された相手と同じく、この移動は打撃を誘発せず、入る余地がなければ元の位置に留まります。5eのArcane HandのForceful Handの「手は標的とともに移動し、その周囲、5フィート以内に留まる」は`{"onWin": {"push": 5, "pushRead": {...}, "follows": true}}`です。これを使うルールセットにはCapability API 1.598が必要です。

戦闘の状態の`endsWhenSource`は`"acts": true`を指定できます。付与した者が次のアクションを取ると外れます。移動、リアクション、ターンの終了以外のすべてが該当します。同じアクションを再び使うと、そのアクションが指定する場合は改めて付与されます。5eのArcane HandのInterposing Handの「手に別のコマンドを与えるまで」は`{"condition": "interposed", "endsWhenSource": {"acts": true}, "coverFor": {...}}`です。これを使うルールセットにはCapability API 1.599が必要です。

クリーチャーは`passableBy`(`{"ability": "str", "above": 26, "difficult": true}`)を指定できます。敵はその能力値の評価値が`above`を超える場合にだけ占有空間を通過でき、`difficult`があれば敵にとってその空間は移動困難となり、各マスのコストが倍になります。これがなければ、敵はサイズが許す場合にだけ通過できます。`"fillsSpace": false`は自身の占有空間を埋めていないことを示します。味方は中で停止でき、通過を許された敵も同様です。押されたもの、置かれたもの、誰かの隣へ移動したものも、そこで移動を終えられます。5eのArcane Handの「標的のStrengthの評価値が手のStrengthの評価値以下なら、標的は手の占有空間を通過できない。標的のStrengthの評価値の方が高ければ...その空間は標的にとって移動困難な地形となる...手は自身の占有空間を埋めない」は`{"passableBy": {"ability": "str", "above": 26, "difficult": true}, "fillsSpace": false}`です。どちらかを使うルールセットにはCapability API 1.600が必要です。

戦闘の状態の`behavior`は`only`と並べて`"actions": true`を指定できます。`only`ならほかのすべてとともに除外される、その状態自身の`actions`も引き続き提示されます。5eのWind Walkの「この形態でクリーチャーが取れるアクションはDashアクションか通常の形態に戻ることだけ」は`{"condition": "wind_walking", "actions": ["spells/wind-walk-revert"], "behavior": {"only": ["move", "dash"], "actions": true}}`です。`only`と、状態自身のアクションが必要です。1.601以降は、効果が`endsCondition`だけの`utility`エントリーもアクションとして提示されるので、戻るアクションを`{"kind": "utility", "targets": "self", "endsCondition": "wind_walking"}`にできます。これを使うルールセットにはCapability API 1.601が必要です。

カタログのエントリーやアイテムの使用の、壁の`area`は`ring`と並べて`"ringOnly": true`を指定できます。常にその輪として配置され、直線の壁にはなりません。また、ゾーンの`blocks`は、壁でもほかのゾーンでも`"spells"`を指定できます。そのマスに入る、出る、横切る呪文の発動を防ぎます。反対側の相手を狙う呪文は射線が通らないとして拒否され、範囲呪文は中に向けられず、その脇に向けたものは縁で止まります。武器は止めず、中から中の別の相手に向けて発動する呪文も止めません。呪文だけを遮断するゾーンはどのマスの歩行も視線も妨げず、トリガーも必要ありません。5eのForcecageは、檻なら`{"area": {"shape": "wall", "size": 80, "ring": 20, "ringOnly": true}, "zone": {"blocks": ["move"]}}`、箱なら`{"area": {"shape": "box", "size": 20}, "zone": {"blocks": ["spells"]}}`です。どちらかを使うルールセットにはCapability API 1.602が必要です。

ゾーンの`forbids.teleport`は、`true`の代わりに`{"save": "<save id>", "difficulty": "caster"}`を指定できます。その場合、中のクリーチャーが外へ瞬間移動するとき、まずそのゾーンを作ったエントリーの難易度に対して、そのセーヴを行います。成功すれば移動します。失敗すれば元の場所に留まり、そのことがログに表示され、使用分はそれでも消費します(一緒に運ぶはずだった者も誰も移動しません)。ほかの者に運ばれて外に出る各クリーチャーも、それぞれ自分でセーヴを行います。ゾーンの中での瞬間移動や中への瞬間移動は止めず、セーヴに成功した後なら瞬間移動で戦闘を離れることも止めません。輪として配置した壁は、囲んだすべてのマスを内部とするため、輪の中央も内部とみなします。5eのForcecageは`{"forbids": {"teleport": {"save": "cha_save", "difficulty": "caster"}}}`です。これを使うルールセットにはCapability API 1.603が必要です。

エントリーの`repeats`は`"afterTargetDown": true`を指定できます。前回の発動で狙った全員がダウンしたとき(0ヒットポイントか戦闘から離脱)にだけ、引き続きコストなしで反復が提示されます。実行すると、エントリーの`applies`がそれらのクリーチャーに付与した状態は外れ、新しい標的に付与され、次はその標的のダウンを待ちます。`applies`が必要で、`sameTargets`とは併用しません。5eのHunter's Markの「この呪文が終了する前に標的が、0ヒットポイントになった場合、以降の自身のターンでボーナスアクションを使い、新たなクリーチャーに印を付けられる」は`{"repeats": {"budget": "bonus", "afterTargetDown": true}}`です。これを使うルールセットにはCapability API 1.604が必要です。

戦闘の状態は`"heldOnlyIn": {"light": [...]}`で、`sunlight`、`bright`、`dim`、`dark`の任意のものを指定できます。持ち主がそれらの光のいずれかの中にいる間だけ持続し、光は`checkModes.light`と同じく立っている場所から読みます。それ以外の場所では適用を抑え、終了はせず、その光の中に戻ると再び持続します。5eのシャドウのSunlight Weaknessは、`own-attacks-disadvantage`、`own-checks-disadvantage`、`own-saves-disadvantage`を持つ付けたままにする状態で、`{"heldOnlyIn": {"light": ["sunlight"]}}`です。これを使うルールセットにはCapability API 1.605が必要です。

クリーチャーのアクションは、カタログのエントリーと同じく(1.247)、`"free": true`と`"beforeAttack": true`を指定できます。行動枠を消費せず、そのクリーチャー自身のターンで、まだそのターンに攻撃していないときだけ提示されます。Engineがクリーチャーを操作する場合は、近接武器攻撃の直前に、自身に適用される(`self`)無償の`beforeAttack`アクションを行い、攻撃の代わりにはしません。5eのバーサーカーやミノタウロスのRecklessは`{"id": "reckless", "name": "Reckless", "budget": "action", "free": true, "beforeAttack": true, "self": true, "applies": [{"condition": "reckless", "duration": {"rounds": 1}}, {"condition": "exposed", "duration": {"rounds": 1, "at": "turn-start"}}]}`です。どちらかを使うルールセットにはCapability API 1.606が必要です。

クリーチャーの`move`には`"toward": "seen-hostile"`を指定できます。移動の各ステップで、見えている敵対的なクリーチャーに近づく必要があり、何も見えていなければ移動しません。そのアクションが移動しか行わない場合、この移動には`signature`が不要です。その場合はクリーチャー自身のターンに、アクションの`budget`で行い、歩行と同じように盤面上で選び、そのターン自体の移動は残ります。5eのオークのAggressiveは`{"id": "aggressive", "name": "Aggressive", "budget": "bonus", "move": {"toward": "seen-hostile"}}`です。Engineが操作するクリーチャーは、伝説的な移動と同じようにこれを評価します。これを使うルールセットにはCapability API 1.607が必要です。

戦闘の状態や、エントリーの`applies`が付与するものの`endsWhenHolder`には、`"incapacitated": true`を指定できます。持ち主が`cannot-act`を持つものを保持すると、その状態が外れます。また、状態のオーラには`"seenByHolder": true`を指定できます。持ち主自身に加え、持ち主に見えている者だけに届きます。オーラの`targetTypes.understands`(1.561)は、持ち主自身の言語を読み取ります。5eのナイトのLeadershipは、自分に付与する十ラウンドの状態で、`{"condition": "leadership", "endsWhenHolder": {"incapacitated": true}, "auras": [{"distance": 30, "side": "allies", "self": true, "needs": ["hearing"], "seenByHolder": true, "targetTypes": {"understands": true}, "conditions": ["led"]}]}`です。どちらかを使うルールセットにはCapability API 1.608が必要です。

ゾーンの`obscures`には`"notForCaster": true`を指定できます。術者以外の全員の視界を遮り、術者は感覚がどうであっても見通せます。5eのStaff of Swarming InsectsのInsect Cloudは、術者に固定された、30フィート半径の範囲で、`{"zone": {"anchor": "caster", "obscures": {"dispersed": true, "notForCaster": true}}}`です。これを使うルールセットにはCapability API 1.609が必要です。

呼び出し(カタログのエントリー、アイテム、クリーチャーのアクションによるもの)には、`"leash": <distance>`を指定できます。呼び出された各クリーチャーは、呼び出し手との距離がその値を超えると去ります。クリーチャーのアクションの`calls.dismissible`は`{"budget": "<id>"}`にできます。呼び出し手はアクション自体の行動枠ではなく、指定した行動枠でそれらを退去させます。5eのトレントのAnimate Treesは、ボーナスアクションで、またはトレントから、120フィートを超えて離れると木々が去るもので、`{"calls": {"creature": "monsters/animated_tree", "count": {"flat": 2}, "endsWithCaller": true, "dismissible": {"budget": "bonus"}, "leash": 120, "rounds": 14400}}`です。どちらかを使うルールセットにはCapability API 1.610が必要です。

カタログのエントリーやアイテムの`calls`には、`"hostileUnless": {"derived": "<id>", "atLeast": N}`を指定できます。使用者の派生値がN以上でなければ、呼び出された者は反対側に加わり、使用者に敵対します。ダイスで決める呼び出しの`hostile`選択肢と同じです。5eの真鍮製のHorn of Valhallaは、すべての単純武器への習熟が必要で、`{"calls": {"creature": "monsters/berserker", "count": {"dice": "3d4"}, "rounds": 600, "hostileUnless": {"derived": "proficient_simple_weapons", "atLeast": 1}}}`です。これを使うルールセットにはCapability API 1.611が必要です。

アイテムの`calls`には`"spendsItemOnDeath": true`を指定できます。呼び出したクリーチャーが死亡すると、ダイスで決める選択肢の`spendsItem`と同様に、アイテムが永久に消費されます。また、アイテムの`recharge.after`(チャージ、または追加の使用方法の使用回数に対するもの)には、`"fromDeparture": true`を指定できます。待ち時間は、その使用で呼び出したクリーチャーが去ってから初めて始まります。戦闘の終了後に残った`rounds`は、戦闘の新しい`combat.roundSeconds`(ラウンドの長さを秒で表したもので、5eでは、6)を使い、ゲーム内時間として数えます。`fromDeparture`にはこの設定が必要です。5eのRing of Djinni Summoningは、日に一度使え、ジンとともに永久に失われるもので、`{"combat": {"roundSeconds": 6}}`と`{"charges": {"max": 1, "recharge": {"rests": [], "amount": "max", "after": {"hours": {"flat": 24}, "fromDeparture": true}}}, "use": {"calls": {"creature": "monsters/djinni", "count": {"flat": 1}, "rounds": 600, "spendsItemOnDeath": true}}}`です。この三つのいずれかを使うルールセットにはCapability API 1.612が必要です。

アイテムの`calls`には`"becomesItem": true`を指定できます。アイテム自体が呼び出すクリーチャーとなり、そのクリーチャーが立っている間は持ち主の手元を離れるため、その使用方法や打撃は一切提示されません(さらに別の個体を呼び出すこともありません)。また、カタログのエントリーやアイテムの`calls`には、クリーチャーのアクションと同じく`"dismissible": true`を指定できます。使用者には、それらを再び退去させるアクションが与えられます。エントリーや使用自体の行動枠で行い、`{"budget": "<id>"}`なら指定した行動枠で行います。5eのStaff of the Pythonは、独自のイニシアチブで行動するヘビとなり、ボーナスアクションで元に戻り、ヘビが死亡すると砕けるもので、`{"calls": {"creature": "monsters/giant_constrictor_snake", "count": {"flat": 1}, "becomesItem": true, "dismissible": {"budget": "bonus"}, "spendsItemOnDeath": true}}`です。倒れる前に元に戻したヘビは、ヒットポイントをすべて回復します。呼び出すたびに新しいクリーチャーになるためです。どちらかを使うルールセットにはCapability API 1.613が必要です。

クリーチャーのアクションの`calls`や、呼び出しの`options`の各選択肢には、`"onlyWhere"`を指定できます。呼び出し手が`"notLight"`に挙げたどの光の中にもいない場所でのみ提示されます(光は`regenerates.notIn`と同じように読み取ります)。さらに、`"outdoors": true`(または`"indoors": true`)なら、盤面の場所が屋外(または屋内)の場合にのみ提示されます。ダンジョン、洞窟、城、宇宙船、邸宅は屋内です。それ以外の場所と、場所を指定しない盤面は屋外です。また、クリーチャーのアクションの`calls`には`"arrivesIn": {"dice": "1d4"}`を指定できます。呼び出す際にダイスを振り、呼び出し手のターンがその回数だけ始まってから、呼び出された者が現れます。5eのヴァンパイアのChildren of the Nightは、`{"calls": {"options": [{"creature": "monsters/swarm_of_bats", "count": {"dice": "2d4"}, "onlyWhere": {"notLight": ["sunlight"]}}, {"creature": "monsters/swarm_of_rats", "count": {"dice": "2d4"}, "onlyWhere": {"notLight": ["sunlight"]}}, {"creature": "monsters/wolf", "count": {"dice": "3d6"}, "onlyWhere": {"notLight": ["sunlight"], "outdoors": true}}], "arrivesIn": {"dice": "1d4"}, "rounds": 600}}`です。どちらかを使うルールセットにはCapability API 1.614が必要です。

カタログのエントリーやアイテムの`calls`には、`"side": "none"`を指定できます。呼び出された者は誰にも操作されません。各ターンには、通行できる最短経路で呼び出し手に向かって歩くだけで、それらがいるだけでは、どの側も戦闘を続けられるとは扱われません。`"tamedWhile": "<condition>"`を指定すると、その状態を保持する個体は、保持している間、通常の呼び出されたクリーチャーと同様に呼び出し手の命令に従います。5eのPipes of the Sewersには三つの使用方法が必要です。最初は、1から、3チャージを消費するボーナスアクションで、チャージごとに一群を呼び出します。`{"charges": 1, "chargeStep": {"max": 2}, "calls": {"creature": "monsters/swarm_of_rats", "count": {"flat": 1}, "perStep": 1, "side": "none", "tamedWhile": "piped"}}`です。次は演奏で、30フィート以内にいる、自分が呼び出した一群(`targetTypes.calledBySelf`、1.487)に対抗判定(1.565)で勝つと、一ラウンドの間`piped`を付与します。`{"contest": {"attacker": ["cha"], "defender": ["wis"]}, "applies": [{"condition": "piped", "rounds": 1}]}`です。最後は、各ラウンドにアクションを使ってそれを続ける使用方法です(`sustains`、1.431)。`side`か`tamedWhile`を使うルールセットにはCapability API 1.615が必要です。

エントリーの`applies[].duration`には、`rounds`と並べて`"remainingOf": "<condition>"`を指定できます。この状態の持続時間は、標的に付いていた指定の状態が、時間切れになる前に最後に外れた時点で残していた時間を超えず、それ以降は毎ラウンド一ラウンドずつ差し引き、最大でも`rounds`です。残り時間があり、使用者がどちらの状態も保持していない間だけ、エントリーが提示されます。5eのWind Walkで、呪文の持続時間(8時間)の残りの間、雲に戻るのに一分かける場合は、`{"targets": "self", "castingRounds": 10, "applies": [{"condition": "wind_walking", "duration": {"rounds": 4800, "remainingOf": "wind_walking"}}]}`です。これを使うルールセットにはCapability API 1.616が必要です。

カタログのエントリーの仕組み、アイテムの`use`、追加の使用方法には、`"userHolds": ["<condition>", ...]`を指定できます。使用者が挙げられた状態のいずれかを保持する間だけ提示されます。また、戦闘の状態の`endsWhenSource`には`"lacks": ["<condition>", ...]`を指定できます。付与した者がそのどれも保持していなくなると、状態が外れます。5eのPipes of the Sewersでは、使用者に一ラウンドの`piping`を付与する「Play」(演奏)の使用方法、`"userHolds": ["piping"]`を持つ呼び出しと操る使用方法、そして操る使用方法の`piped`に`{"endsWhenSource": {"lacks": ["piping"]}}`を設定します。どちらかを使うルールセットにはCapability API 1.617が必要です。

エントリーやアイテムの使用の`contest`(1.565)には、`"onLose": {"applies": [{"condition": "<id>", "rounds": N}, ...]}`を指定できます。使用者が負けた相手の標的に、それらの状態を、それぞれ指定のラウンド数の間、使用者を出所として付与します。そのいずれかを指定した`targetTypes.not.holding`で、その後はその標的を除外できます。また、戦闘の状態の`endsWhenHolder`には`"cantHearSource": {"sense": "<sense>"}`を指定でき、必要に応じて`"beyond": <distance>`を加えられます。持ち主のターンが始まる際に、その感覚がない、付与した者から`beyond`を超えて離れている、または付与した者が去ったかダウンしていると、状態が外れます。その際、通常どおり`onEnd`が付与されます。5eのPipes of the Sewersでは、操る使用方法に`{"contest": {..., "onLose": {"applies": [{"condition": "pipes_spurned", "rounds": 14400}]}}, "targetTypes": {"not": {"holding": ["pipes_spurned"]}}}`を、`piped`に`{"endsWhenHolder": {"cantHearSource": {"sense": "hearing"}}, "onEnd": {"applies": [{"condition": "pipes_spurned", "duration": {"rounds": 14400}}]}}`を設定します。どちらかを使うルールセットにはCapability API 1.618が必要です。

アイテムが着用中(または携行中、あるいは着用者が要件を満たしていない間)に与える効果には、`"ignoredBy": {"entries": ["<catalog>/<entry>", ...]}`を指定できます。そのベスティアリのエントリーのいずれかから作られたクリーチャーは、着用者を決して狙わず、Engineも着用者に向けて行動させません。`"untilHarmed": true`なら、着用者が攻撃したり、被害を与えたり、対抗判定を挑んだり、セーヴを強いたりした個体は、その戦闘の残りの間、再び着用者を狙うようになります。5eのPipes of the Sewersを同調して着用する場合は、`{"worn": {"ignoredBy": {"entries": ["creatures/rat", "creatures/giant-rat", "creatures/swarm-of-rats"], "untilHarmed": true}}}`です。これを使うルールセットにはCapability API 1.619が必要です。

カタログのエントリーやアイテムの`calls`には、`"commandedWithin": <distance>`を指定できます。呼び出された各クリーチャーのターン開始時に、呼び出し手が立っており、アクションを行え(`cannot-act`を持つものを何も保持していない)、盤面上ではその個体から指定の距離以内にいる場合にのみ、命令できます。それ以外の場合、そのターンは自律的に行動し、プレイヤーが操作を引き受けていた場合もEngineが操作して、自分を守りながら呼び出し手の敵に向かいます。`commandedWith`がある場合、そのターンについて呼び出し手は何も支払いません。5eのStaff of the Pythonは、`{"calls": {"creature": "creatures/giant-constrictor-snake", "commandedWith": "bonus", "commandedWithin": 60}}`です。これを使うルールセットにはCapability API 1.620が必要です。

呼び出し(クリーチャーのアクション、カタログのエントリー、アイテムによるもの)には、`"within": {"distance": <distance>}`を指定でき、必要に応じて`"seen": true`を加えられます。呼び出された者は、呼び出し手からその距離以内にある空きマスに置かれます。`seen`があれば呼び出し手に見えるマスだけが対象となり、呼び出し手の敵に最も近いマスから優先します。盤面外では何も変わりません。5eのトレントのAnimate Treesは、`{"calls": {"creature": "creatures/animated-tree", "count": {"flat": 2}, "leash": 120, "within": {"distance": 60, "seen": true}}}`です。これを使うルールセットにはCapability API 1.621が必要です。

戦闘
の
状態
には
`"endable": {"budget": "<budget>"}`を
指定
できます。
持ち主
が
その
状態
を
保持
する
間、
状態の
ラベル
を
添えた
「End」
(終了)が
提示
されます。
エントリーの
`endsCondition`と
同様に、
指定の
行動枠
を
1
消費して
状態
を
外します
(その
状態
を
保つ
集中も、
ともに
終わります)。
5eの
Ring of Invisibilityは
`{"condition": "ring_invisible", "effects": [...], "endable": {"budget": "bonus"}}`で、
Potion of Gaseous Formや
Boots of Speedも
同様
です。
これ
を
使う
ルールセット
には
Capability API 1.622が
必要
です。

アイテムの`use`や追加の使用方法には、`"chargesPerRound": true`を指定できます。付与するものは、アイテムのチャージが続く間だけ持続します。最初のラウンドについては、通常どおり使用自体の`charges`を支払います。その後、状態が持続する各ラウンドでは、その状態の時計が一ラウンド減る際にさらに一チャージを消費し、最後のチャージを消費すると状態が外れます。(たとえば`endable`で)早く終えた場合、残りは次の使用に持ち越します。5eのBoots of Speedは、`"charges": 100`(10分をラウンドで表したもの)を持つアイテムで、使用方法は`{"kind": "buff", "targets": "self", "budget": "bonus", "charges": 1, "chargesPerRound": true, "applies": [{"condition": "boots_of_speed", "duration": {"rounds": 100}}]}`です。これを使うルールセットにはCapability API 1.623が必要です。

アイテムの`charges`には`"overuse": {"chance": <1-100>, "cumulative": true}`を指定できます。すべて消費した後も使用方法が提示され、残りがない状態で使うたびにd100を振ります。`chance`以下ならアイテムは破れて永久に失われ、その使用は何も行いません。`cumulative`があれば、最後にチャージが回復してからそのように使うたびに、確率が指定の値ずつ増えます(20、40、60の順です)。回数はスタックに記録され、休息や待ち時間によってチャージが回復すると数え直します。5eのWind Fanは、`{"max": 1, "recharge": {"rests": ["long"], "amount": "max"}, "overuse": {"chance": 20, "cumulative": true}}`です。これを使うルールセットにはCapability API 1.624が必要です。

ラウンド数による持続時間には`"times": "<dice>"`を指定できます。付与時にダイスを振り、その出目の倍数だけ`rounds`が続きます。5eのPotion of Growthの「1d4時間」は、`{"rounds": 600, "times": "1d4"}`です。ダイスの最大の出目に`rounds`を掛けた値は、一日(14400ラウンド)以下にする必要があります。これを使うルールセットにはCapability API 1.625が必要です。

`"caught"`の瞬間に使うエントリーやアイテムの使用には、`"keepsCaught": true`、または`{"otherwise": "<catalog>/<entry>"}`を指定できます。持ち主は、今受け止めた飛び道具を手元に残します。それが射手自身の弾薬なら、そのアイテムを保持し、射手は戦闘後に回収できなくなります。それ以外(クリーチャー自身の矢)なら`otherwise`のアイテムとなり、指定がなければ何も残りません。受け止めた者の袋に同じアイテムのスタックがあればそこに加わり、なければ他のスタックに並ぶ新しいスタックとなり、戦闘の他のアイテムとともに書き戻されます。それ自体ではダメージを与えません。`"free": true`なら、飛び道具のダメージをなくしたリアクションの一部であるため、リアクションを消費しません。5eのGloves of Missile Snaringは、`{"kind": "utility", "targets": "self", "free": true, "reaction": {"on": "caught", "freeSlot": "hand"}, "keepsCaught": {"otherwise": "gear/arrow"}}`です。これを使うルールセットにはCapability API 1.626が必要です。

エントリーやアイテムの使用が、使用者に付与した状態の持続中にその使用者自身を`dismisses`で退去させ、`"turns": true`を指定している場合、戦闘から退去しても使用者は自分のターンを続けます。その状態が`endable`なら、退去中のターンにも「End」(終了)が提示され、それを選ぶと退去した場所、または最も近い空き場所に戻ります。5eのRobe of Starsの「アクションを使ってアストラル界に入り…アクションを使って戻るまで」は、`{"kind": "buff", "targets": "self", "budget": "action", "applies": [{"condition": "astral", "duration": "until-dispelled"}], "dismisses": {"while": "astral", "turns": true}}`と、戦闘の状態`{"condition": "astral", "effects": [], "endable": {"budget": "action"}}`で表します。これを使うルールセットにはCapability API 1.627が必要です。

アイテムの`use`(または追加の使用方法)には、カタログのエントリーと同じく`needs`と`needsAny`を指定できます。それらの感覚を持つクリーチャーだけが影響を受けます。また、`area`を持つエントリーや使用方法にも`oncePerTarget`を付けられます。再び使えるようにする休息以降にすでに使用対象となった者は、その範囲で飛ばされます。`whenSaved`があれば、セーヴに成功した者だけを記録します。5eのPipes of Hauntingは、`{"kind": "debuff", "area": {"shape": "burst", "size": 30, "around": true}, "friendlyFire": false, "needs": ["hearing"], "save": {...}, "applies": [...], "oncePerTarget": {"until": "long", "whenSaved": true}}`です。音が聞こえる敵対的なクリーチャーだけが対象となり、セーヴに成功した者は大休憩まで完全耐性を持ちます。(`friendlyFire: false`だけですでに、使用者自身の側は影響を受けません。)どちらかを使うルールセットにはCapability API 1.628が必要です。

ダメージを与えるエントリーやアイテムの使用には、`amountAgainst: {"is": {...}, "amount": {"dice": "10d6"}}`を指定できます。`is`が指定するものに該当する標的は、エントリー自体の量の代わりに指定の量を受けます(`maxAgainst`もその標的を指定する場合は、最大の出目を使います)。`save.modes`(1.185)を使うと、その標的はセーヴも不利で振ります。5eのHorn of Blastingは、`{"kind": "attack", "amount": {"dice": "5d6"}, "damageType": "thunder", "save": {"save": "con_save", "onSuccess": "half", "modes": [{"is": {"tags": ["glass", "crystal"]}, "mode": "disadvantage"}]}, "amountAgainst": {"is": {"tags": ["glass", "crystal"]}, "amount": {"dice": "10d6"}}}`です。これを使うルールセットにはCapability API 1.629が必要です。

アイテムの`use`(または追加の使用方法)には、`backfires: {"chance": 20, "amount": {"dice": "10d6"}, "damageType": "fire", "destroys": true}`を指定できます。使用するたびにd100を振り、`chance`以下なら使用者に`amount`を与え、`destroys`があればアイテムは永久に失われます。`instead: true`の指定がなければ、使用自体の効果は発揮されます。この指定があれば、暴発だけが起こります。5eのHorn of Blastingはこの方法で爆発します。これを使うルールセットにはCapability API 1.630が必要です。

`area`と`save`を持つエントリーやアイテムの使用には、`pushesOutSaved: true`を指定できます。範囲に巻き込まれてセーヴに成功した者は、狙った場所(使用者を中心とするバーストなら使用者)からまっすぐ遠ざかる向きに押し出されます。占めるどのマスも範囲内に残らなくなるまで、通れる限り押し出します。5eのBead of Forceは、10フィートの球体で、セーヴに成功した者は「球体の中心から、内部にいなくなるまで押し出され」、失敗した者は中に閉じ込められます(`sealed`を持つ状態を`applies`で付与します)。閉じ込められたクリーチャーが移動速度の半分で球体を転がすことは、閉じ込める状態の`"sealed": {"rolls": {"budget": "action", "share": 0.5}}`(1.314)で表します。これを使うルールセットにはCapability API 1.631が必要です。

戦闘の状態の`onEnd`には、`when`を指定できます。終了後に残す効果が発生するために必要な終了の仕方を示すもので、`expired`、`save`、`damage`、`harmed`、`concentration`、`spent`、`cured`、`dispelled`、`contest`、`freed`、`slipped`、`endsWhenSource`(出所が`endsWhenSource`で指定するものを保持する、失う、またはそれに阻止される)、`cantHearSource`(`endsWhenHolder.cantHearSource`)です。それ以外の方法で終わると、何も残しません。5eのPipes of the Sewersでは、操られた群れの`piped`は、奏者が演奏をやめるか、奏者の音が聞こえなくなると終わりますが、一日の間操れなくなるのは後者だけです。`"onEnd": {"when": ["cantHearSource"], "applies": [{"condition": "pipes_spurned", "duration": {"rounds": 14400}}]}`とします。これを使うルールセットにはCapability API 1.632が必要です。

`targetTypes`には`uncontrolled: true`を指定できます。他のクリーチャーの操作下にないクリーチャーだけを選んだり、巻き込んだりできます。つまり、誰も戦闘に呼び出していない者、使用者自身が呼び出した者、または呼び出されたものの野生状態(`calls.wild`)にあるか呼び出し手に敵対した者です。5eのPipes of the Sewersは、「他のクリーチャーの操作下にないネズミの群れ」を操ります。`"targetTypes": {"is": {"tags": ["swarm"]}, "uncontrolled": true}`とすると、野生の群れか奏者自身の群れが対象となり、ヴァンパイアの群れは決して対象になりません。これを使うルールセットにはCapability API 1.633が必要です。

戦闘の状態の`actions`には、`{"entry": "spells/animal-friendship", "saveDifficulty": 13}`のようにエントリーを指定できます(`toHit`も指定できます)。持ち主自身の呪文発動の数値ではなく、指定した数値で使います。5eのPotion of Animal Friendshipは、飲んだ者が一時間の間、セーヴDC 13でAnimal Friendshipを回数制限なく発動できるもので、`{"condition": "animal_friend", "effects": [], "actions": [{"entry": "spells/animal-friendship", "saveDifficulty": 13}]}`です。これを使うルールセットにはCapability API 1.634が必要です。

戦闘の状態の`harms.save`には`drops`を指定できます。被害に使うものと同じサイズのダイスで、持ち主がセーヴに成功するたびに、その被害からそれらのダイスを恒久的に取り除き、残りがなくなると状態が終わります。5eのPotion of Poisonは、`"harms": {"at": "turn-start", "dice": "3d6", "type": "poison", "save": {"save": "con_save", "difficulty": 13, "drops": "1d6"}}`です。セーヴに失敗した場合は、3d6を受け、成功するたびにダイスが一つ減り、三回成功すると終わります。これを使うルールセットにはCapability API 1.635が必要です。

付与する状態の`checkEnds`には`spendsItem: true`を指定できます。判定に成功すると、その状態を付与した使用のアイテムも永久に消費します。また、`failedRetryAfter: n`も指定できます。失敗すると、`n`ラウンドの間、持ち主自身による再試行は提示されません。5eのIron Bands of Bindingは、`"checkEnds": {"check": "athletics", "difficulty": 20, "spendsItem": true, "failedRetryAfter": 14400}`です。捕らえた者を解放する合言葉には、追加の使用方法`{"kind": "buff", "budget": "bonus", "targetHolds": {"fromSelf": ["restrained"]}, "ends": {"conditions": ["restrained"]}}`を用意します。どちらかを使うルールセットにはCapability API 1.636が必要です。

`zone`は、14400ラウンドまで持続できます(`rounds`。従来は、1000)。Oil of Slipperinessの油が、8時間(4800)続く場合などです。`close: {"budget": "action", "lingers": 100}`を指定できます。術者は自分のターンにそれを閉じられ、ゾーンは終了するか、`lingers`があればそのラウンド数だけさらに残り、それ以上は広がりません。また、バーストには`spreads: {"by": 10, "every": 10, "upTo": 120}`を指定できます。術者のターンが`every`回経過するごとに`by`だけ広がり、半径`upTo`まで達します(距離はルールセットの単位です)。5eのEversmoking Bottleは、ある地点を中心とする、60フィートの濃煙のバーストで、`{"rounds": 14400, "anchor": "point", "triggers": [], "obscures": {...}, "close": {"budget": "action", "lingers": 100}, "spreads": {"by": 10, "every": 10, "upTo": 120}}`です。これらのいずれかを使うルールセットにはCapability API 1.637が必要です。

戦闘の状態には`onFirstSeen: {"applies": {...}}`を指定できます。持ち主が他のクリーチャーを初めて見ると状態が終わり、代わりに`applies`で指定したものが持ち主に付与され、そのクリーチャーが出所となります(同時に複数見えた場合は、最も近い個体です)。5eのPhilter of Loveは、飲むと`{"condition": "love_struck", "effects": [], "onFirstSeen": {"applies": {"condition": "charmed", "duration": {"rounds": 600}}}}`が、100ラウンドの間付与されます。これにより、飲んだ者は、10分以内に最初に見た者に、一時間の間魅了されます。これを使うルールセットにはCapability API 1.638が必要です。

アイテムの`worn`や`carried`の効果は、`"proficiencyBonus": 1`で持ち主の習熟ボーナスに加算できます(Capability API 1.639)。値の範囲は-6から、6です。0は不可、各アイテムにつき一度です。`resolution.proficiency.bonus`が派生値(5eの`proficiency_bonus`)を読み取る場合、その派生値に加算されるため、それを読み取るすべてのものにも反映されます。スキル、セーヴ、攻撃、呪文のセーヴDCが該当します。5eのIoun Stone of Masteryは`"worn": { "proficiencyBonus": 1 }`です。これを使うルールセットにはCapability API 1.639が必要です。

アイテムの使用は、Wishのように他のエントリーを発動できます(Capability API 1.640)。`"duplicates": { "catalog": "spells", "upTo": 8 }`を持つ`"utility"`の使用方法(さらに`only`で絞り込めます)は、そのカタログの最初のレベルから`upTo`までの各エントリーを、`<item>: <use>: <entry>`としてメニューに表示します。使用者がそれらをまったく修得していなくても使え、それぞれ、通常の使用と同じようにアイテムで支払い(`charges`、または`consumes`ならアイテム自体)、使用方法に独自の`saveDifficulty`と`toHit`が指定されていれば、それらで実行します。この使用はそれ以外のことを行いません。5eのRing of Three Wishesは、`"use": { "kind": "utility", "budget": "action", "label": "Wish", "charges": 1, "duplicates": { "catalog": "spells", "upTo": 8 } }`で、最後のチャージには`charges.breaksOn`を使います。これを使うルールセットにはCapability API 1.640が必要です。

重量で運ぶ乗騎です(Capability API 1.641)。`combat.mounts.weights`は騎乗者の重量を示します。`sheet`(シートから読み取る値で、身体と装備の派生値など、0より大きい値を示す場合に使います)、または、それ以外の場合は戦闘自体のサイズに従う`bySize`です。ステータスブロックに`"mountCarries": { "weight": 400, "slowedUpTo": 800 }`を指定したクリーチャーには、騎乗者を含む積載重量が`slowedUpTo`(省略時は`weight`)以下である間、どのサイズの騎乗者も乗れます。`weight`を超える重量を運ぶ間は、移動速度が半分になります。最初の騎乗者が通常の乗騎と同様に操縦し、残りの騎乗者はどこへでも一緒に運ばれます。操縦する騎乗者が降りると、次に乗っている者が引き継ぎます。5eのCarpet of Flyingは、絨毯のアイテムの使用で呼び出す(`calls`、`dismissible`)独立したクリーチャーで、サイズに応じた飛行の移動速度と`mountCarries`を持ちます。3×5フィートなら`{ "weight": 200, "slowedUpTo": 400 }`で、80フィート、最大サイズなら、6×9フィートで`{ "weight": 800, "slowedUpTo": 1600 }`で、30です。どちらかを使うルールセットにはCapability API 1.641が必要です。

クリーチャーの`spellcasting`には、レベルごとの呪文スロットである`slots`を指定できます(Capability API 1.642)。`{ "1": 4, "2": 3, "3": 2 }`のように書きます。その特徴の呪文で、`uses`がなく、レベルが、1以上(独自の`level`、なければエントリーのレベル)のものは、残っている同レベル以上のスロットのうち最も低いものを一つ消費します。該当するスロットがなくなると提示されません。メニューには、そのレベルの残りスロット数を表示します。`coven`があれば、盟約団の呪文は、その全員が共有するスロットを消費します。5eのハグの盟約団です。呪文には、特徴の数値に代えて独自の`saveDifficulty`と`toHit`を指定することもできます。ハグの生得呪文が盟約団とは異なるDCで発動される場合などです。どちらかを使うルールセットにはCapability API 1.642が必要です。

クリーチャーの`sequence`のステップは、実行回数をダイスで決められます(Capability API 1.643)。`times`の代わりに`"dice": { "count": 1, "sides": 4 }`を指定します。ヴァイオレット・ファンガスが行う、1d4回のRotting Touch攻撃などです。出目はログに記録され、連続行動はダイスの最大の出目と同じ数の標的に向けられます。それより少ない標的を指定した場合、出目で決まった打撃を、指定した標的に順番に繰り返し割り当てます。`ifHit`は、先行するステップを位置(0から数えます)で指定し、そのステップの攻撃がすべて同じクリーチャーに命中している必要があります。その場合、このステップはそのクリーチャーに対して行い、独自の標的を取りません。グリックの触手の後のくちばしなどです。`optional: true`なら、クリーチャーの行動を選ぶ側がそのステップを省けます。連続行動は、任意のステップを省く各組み合わせのモードで提示されます(省けるのは、3ステップまでで、全ステップを省くことはできません)。ギバリング・マウザーのBlinding Spittleなどです。これらのいずれかを使うルールセットにはCapability API 1.643が必要です。

戦闘の状態の`harms`は`"at": "defies"`にできます(Capability API 1.644)。状態の命令は、持ち主が実行できないことではなく、代償を払えば背ける命令になります。`forbids`、`behavior`、および`cannot-harm`と`cannot-approach-source`の効果は、何も阻止しません。本来阻止するものもメニューに提示され、背くことになる状態が示されます(歩行では、進んではいけないマスだけを示します)。実行すると、選択したことを終えた後に被害を与え、`once`があれば状態の持続中に一度だけ与えます。このような状態は、これらのキーや効果のいずれかによって、何かを命令する必要があります。5eのGeasの「指示に直接反する行動を取るたびに、5d10の精神ダメージを受けますが、一日につき一度までです」は、`{"at": "defies", "dice": "5d10", "type": "psychic", "once": true}`に、「呪文を発動するな」なら`forbids.casts`、「ここに留まれ」なら`behavior.keepsIn`を添えます。これを使うルールセットにはCapability API 1.644が必要です。

状態やゾーンの`wards`は、そのカタログの一部のエントリーだけについて、付与を防げます(Capability API 1.645)。`where`は、エントリーが宣言するフィルターを変更の`where`と同じように読み取り、該当するエントリーを指定します(5eのMind Blankは`{"catalogs": ["spells"], "maxLevel": 9, "where": {"filter": "school", "equals": "divination"}}`です)。`entries`は、指定したものだけを対象とし、それぞれ防護が指定するカタログの`<catalog>/<entry>`です(5eのWishの「単一の呪文に対する完全耐性」などです)。両方を指定でき、その場合、防護は両方の条件を満たすものだけについて付与を防ぎます。どちらかを使うルールセットにはCapability API 1.645が必要です。

5eのWishのための三つの要素です(Capability API 1.646)。戦闘の状態の`harms`は、`catalogs`とともに`"at": "casts"`を指定できます。持ち主は、それらのカタログのエントリーを発動するたびに被害を受け、`perLevel`があれば発動レベルごとに一回受け、`unblockable`があればあらゆる抵抗と完全耐性を無視します(「その呪文の各レベルにつき、1d10の死霊ダメージ。このダメージは、いかなる方法でも軽減したり防いだりできません」)。`applies`の行には、`chance`を指定できます。付与する相手ごとにd100を振り、その値以下なら付与します(「33パーセントの確率で二度とWishを発動できなくなります」)。また、状態の`forbids.entries`は、それぞれ`<catalog>/<entry>`を指定し、状態が続く間、それらのエントリーを阻止します。`"until-dispelled"`で付与すれば、Wishを失うことを表せます。これらのいずれかを使うルールセットにはCapability API 1.646が必要です。

`"stasis": true`を持つ戦闘の状態は、持ち主を時間の流れから切り離します(Capability API 1.647)。5eのSequesterと同じです。持ち主はターンを取らないため、瀕死セーヴを行わず、自分のターンで進行するものからは被害を受けず、その残り時間も減りません。他の者が付与し、その者のターンで進行するものも停止します。他のすべての状態は、残っていたラウンド数を保ち、そのいずれの被害やセーヴも発生しません。静止の状態自体は、その持続時間が出所のターンで進行する場合は引き続き出所のターンで残り時間を数え、`"endsWhen": ["damaged"]`や解呪など、指定どおりに終わります。呪文が与える不可視性には`unseen`を指定してください。これを使うルールセットにはCapability API 1.647が必要です。

戦闘の状態の`"languages"`は、シートやステータスブロックがどの言語を話すと記載していても、状態の持続中に持ち主が何を理解するかを示します(Capability API 1.648)。`"none"`なら何も理解せず、誰も持ち主の言葉を理解できません。5eのFeeblemindです。そのため、CommandやSuggestion(`targetTypes.understands`)は持ち主に届かず、持ち主から使うこともできません。`"all"`ならすべての言語を理解し、一つでも言語を知っている者は誰でも持ち主を理解できます。Tonguesです。二つの状態が食い違う場合は、`"none"`が優先されます。これを使うルールセットにはCapability API 1.648が必要です。

`combat.senses`の感覚には、`"seesTrue": true`を指定できます(Capability API 1.649)。その射程内かつ視界内にあるものの真の姿を見ます。誰かが呼び出した像(`calls.illusion`)は、それを真に見通す者には標的として決して提示されず、状態による幻の`duplicates`も、その者の攻撃を引き寄せません。5eのWitch Sightはそのような感覚で、ウォーロックがその妖術を持つ場合にシートから読み取る値は、30です。`{ "id": "witch_sight", "label": "Witch Sight", "sheet": { "derived": "witch_sight" }, "seesTrue": true }`です。変身する者の真の形態は、Game Masterが描写します。これを使うルールセットにはCapability API 1.649が必要です。

状態やアイテムの`fallsSafely`は、`true`の代わりに`{ "upTo": 20, "unless": ["incapacitated"] }`にできます(Capability API 1.650)。ルールセットの距離で`upTo`以下の高さから落ちた場合だけ、持ち主は被害を受けず、立ったままになります。`unless`のいずれかを保持する間は、どの落下にもこの効果は働きません。5eのCat's Graceの「無力状態でなければ、20フィート以下の落下からダメージを受けません」です。これを使うルールセットにはCapability API 1.650が必要です。

5eのDust of Sneezing and Chokingのための二つのキーです(Capability API 1.651)。`"suffocates": true`を持つ戦闘の状態は、持ち主がどこにいても呼吸を妨げます。`combat.underwater.breath`に従い、水中と同じく水の外でも息を止めた後に窒息します。ただし、その呼吸設定の`exempt`によって免除される場合は除きます。また、状態の`"savesUnless": ["unconscious"]`は、持ち主が挙げられた状態のいずれかを保持する間、その状態を終わらせるセーヴを振らせません(「意識がある限り、クリーチャーはセーヴを繰り返せます」)。どちらかを使うルールセットにはCapability API 1.651が必要です。

セーヴの`against`には、そのセーヴの対象が持つ性質である`qualities`を指定できます(Capability API 1.652)。CloudkillやStinking Cloudの`"against": { "qualities": ["gas"] }`などです。その場合、セーヴ修正値の`against.qualities`がそのセーヴに適用されます。`damage`が指定のダメージ種別に対するセーヴに適用されるのと同じです。Necklace of Adaptationの`{ "to": "saves", "mode": "advantage", "against": { "qualities": ["gas"] } }`などです。どちらかを使うルールセットにはCapability API 1.652が必要です。

アイテムの効果やシートのエントリーの`keepsOn`の行は、単なるIDの代わりに`{ "condition": id, "when": valueRef }`にできます(Capability API 1.653)。その状態は、持ち主のシートから読み取る`when`の値がゼロを超える間だけ、付けたままになります。Holy Avengerは、パラディンのレベルに応じて、17未満なら、10フィートのオーラを、それ以降は、30フィートのオーラを付けたままにします。それぞれの行の`when`は、該当するレベルでは、1となる派生値を読み取ります。Aura of Protectionも、18レベルで同じことを行います。これを使うルールセットにはCapability API 1.653が必要です。

戦闘の状態の`weapon.die`は、状態が`names`か`items`で指定する場合、固定ダメージの打撃にも適用されるようになりました(Capability API 1.654)。打撃は、記載された数値の代わりに指定のサイズのダイスを一つ振り、能力値の修正値は引き続き加えます。Alter SelfのNatural Weaponsは、`{ "names": ["unarmed"], "die": 6 }`によって、素手の打撃の「1にStrengthを加えた値」を「d6にStrengthを加えた値」にします。これに依存するルールセットはCapability API 1.654を宣言してください。古いEngineは固定値をそのままにします。

戦闘の状態の`whenSeen`は、`attacks-against-disadvantage`の適用範囲も制限するようになりました(Capability API 1.655)。持ち主に対する攻撃が不利になるのは、持ち主を見ることができる攻撃者からのものだけです。Robe of Scintillating Colorsのきらめく光の「自分を見ることができるクリーチャーは、自分に対する攻撃判定に不利を受けます」は、その効果と`"whenSeen": true`を持つ状態で表します。これを使うルールセットにはCapability API 1.655が必要です。

個数を指定して回復するプールです(Capability API 1.656)。`recovers`は、消費済みプールを合計で最大何個回復するかを示す`count`を持てます。カタログのエントリーでは引き続きGame Masterがプールを指定し、上限を超える個数を指定した使用は拒否されます。アイテムの`use`も`recovers`を持てます。これは`targets: "self"`の「バフ」で、`count`の指定が必須です。戦闘中でも戦闘外でも、使うと、そのグループの消費済みプールを、最も高いレベルのものから順に一つずつ自動で回復します。各プールは`most`以下で、すべてを合わせて`upTo`以内です。5eのPearl of Powerは、`{"group": "slots", "upTo": {"const": 3}, "most": 3, "count": 1}`で、3レベル以下の消費済みスロットを一つ回復します。これを使うルールセットにはCapability API 1.656が必要です。

独自の条項を持つ弾薬です(Capability API 1.657)。アイテムには`ammoRider`を、`{"plus": [...], "spentOnUse"?: true}`として持たせられます。これは、タグのいずれかによって武器の`ammo`から選ばれる弾薬で、その条項(武器の`plus`と同じ書き方で、それぞれ独自の`targetIs`、`not`、`save`、`when: "critical"`を持ちます)が、発射した打撃に追加されます。携行する各スタックは、アイテム名の付いた、その武器を撃つ独立した方法として提示されます。通常の撃ち方では、まず通常の弾薬を使い、その後にこの弾薬を使います。`spentOnUse`があれば、いずれかの条項が、それを無効化するセーヴを通り抜けて標的に届くと消費されます。戦闘に勝った後に回収されるはずの分は、持ち主がそのタグの通常の弾薬のスタックを携行していれば、代わりにその通常の弾薬として回収されます。`clip`を持つ武器は、先にあるものから装填するため、その射撃には追加効果が付きません。5eのArrow of Dragon Slayingは、矢のタグを付けたアイテムに`{"plus": [{"dice": "6d10", "type": "piercing", "save": {"save": "con_save", "difficulty": 17, "onSuccess": "half"}, "targetIs": {"types": ["dragon"]}}], "spentOnUse": true}`を設定します。これを使うルールセットにはCapability API 1.657が必要です。

持ち主に引き寄せられる攻撃です(Capability API 1.658)。戦闘の状態やアイテムの`worn`効果には、`drawsAim`を、`{"within", "blow"?, "weapon"?}`として持たせられます。持ち主から`within`以内(ルールセットの距離)にいる他の者への攻撃は、代わりに持ち主に向けられます。これはリアクションではありません。何も消費せず、誰にも選択を求めず、攻撃した者自身に引き寄せられることはありません。`blow`は間合い内で行う打撃(`"melee"`)か遠くからの打撃(`"ranged"`)に、`weapon`は武器の打撃に絞り込みます。複数の者が引き寄せる場合、標的に最も近い者が引き寄せます。範囲は引き寄せられず、盤面のない戦闘でも引き寄せは起こりません。5eのShield of Missile Attractionの呪いは、盾の`worn`に`{"within": 10, "blow": "ranged", "weapon": true}`を設定します。これを使うルールセットにはCapability API 1.658が必要です。

空気を封じたり
射撃を止めたりする
ゾーンです
(Capability API 1.659)。ゾーンには
`"sealsAir": true`を持たせられます。
ガス、
風、
霧は
その境界を
通過しません。
そのため、
`dispersed`である
視界を遮る
ゾーンや、
風(
`disperses`を持つもの、
または
それを行う
段階)は、
その中心と
同じ側にある
マスだけを
覆います。
外側の
Fog Cloudはその面で
止まり、
内側に
発動したものは
中に留まり、
外側の
Gust of Windは内側の霧に
決して届きません。
また、
ゾーンの
`blocks`には、
壁である
か
どうかに
かかわらず、
`"ranged"`を指定できます。
魔法かどうかに
かかわらず、
武器による
遠くからの
攻撃は、
中へ、
外へ、
あるいは
横断して
行えません
(呪文や範囲は
武器による
攻撃では
ありません)。
どちらも
ゾーンが
その地面に
与える効果なので、
トリガーは
不要です。
5eのCube of Forceは術者を
中心とする
バーストで、
最初の面は
`"sealsAir": true`、次の面は
`"blocks": ["ranged"]`です。これを使う
ルールセットには
Capability API 1.659が必要です。

満載を超えた乗騎の移動速度です(Capability API 1.660)。クリーチャーの`mountCarries`には、`slowedUpTo`と並べて、ルールセットの距離による`slowedSpeed`を持たせられます。`weight`を超える重量を運ぶ場合、移動速度が半分になる代わりに、指定の速度以下で移動します。5eのBroom of Flyingは、50フィートで飛行するクリーチャーに`{"weight": 200, "slowedUpTo": 400, "slowedSpeed": 30}`を設定します。これを使うルールセットにはCapability API 1.660が必要です。

一部のシートに提示する初期装備の選択肢です(Capability API 1.661)。初期装備の選択肢には、カタログのエントリーと同じようにシートから読み取る値である`offeredWhen`を持たせられます。その値がゼロを超える間だけ提示され、それ以外の場合に選ぼうとすると拒否されます。シートに提示できる選択肢がない選択では何も尋ねず、読み取るシートがなければ、すべての選択肢を提示します。5eのクレリックの「(a)メイス、または(b)ウォーハンマー(習熟している場合)」では、ウォーハンマーの選択肢に、軍用武器への習熟がある場合に、1になる派生値を読み取る`offeredWhen`を指定します。これを使うルールセットにはCapability API 1.661が必要です。

派生値を変える状態です(Capability API 1.662)。戦闘の状態には、派生値IDごとに`derivedChanges`を持たせられます。`{"times"?, "add"?}`で、12個までです。持ち主がその状態を保持する間は、シート上でも戦闘中でも、派生値の算出時にすべての`times`を掛け合わせ、その後すべての`add`を加えます。それ以降に算出するすべてのものは、変更後の値を読み取ります。5eのEnhance Ability(Bull's Strength)は、`{"carry_capacity": {"times": 2}}`です。これを使うルールセットにはCapability API 1.662が必要です。

日数で持続する状態です(Capability API 1.663)。`duration: "until-dispelled"`で付与する状態には、`lastsDays`を持たせられます。付与する際に、付与した者のシートから読み取る値です。戦闘中には時計を持ちません。戦闘が終わると、まだその状態を保持するシートは残り日数を保持し、シートの`pass`コマンドが日数を減らして、なくなると状態を外します。他の方法で外すと、日数も破棄されます。Quivering Palmは、`{"condition": "quivering", "duration": "until-dispelled", "lastsDays": {"field": "level"}}`です。他の持続時間で`lastsDays`を使うと拒否されます。これを使うルールセットにはCapability API 1.663が必要です。

アイテムの着用中に持続する状態です(Capability API 1.664)。アイテムの`use`が付与する状態には、スロットを使うかバインドするアイテムであれば、`whileItemWorn: true`を持たせられます。シートは、その状態を付けたままにするインベントリーのスタックを記憶します。そのアイテムを外す、バインドを解除する、または携行しなくなると、そのインベントリー変更とともに状態がシートから外れます。アイテムを外した状態で戦闘が始まっても、その状態は持ち込まれません。戦闘中に使用した場合は、戦闘内でもスタックを記憶し、戦闘の終了後もシートがそれを保持します。Armor of Invulnerabilityは、`{"condition": "invulnerable", "duration": {"rounds": 100}, "whileItemWorn": true}`です。カタログのエントリー自体の`applies`では使えません。これを使うルールセットにはCapability API 1.664が必要です。

あらゆる命令を無視する可能性がある、呼び出されたクリーチャーです(Capability API 1.665)。呼び出しの`disobeys`は`{"chance": 1-99, "when"?}`で、`when`は呼び出し手のシートから読み取る範囲条件(`value`、`atLeast`、`atMost`)です。呼び出す際、`when`を満たす間はd100を振り、`chance`以下なら、`side: "none"`と同じように誰の操作下にもなくなり、退去させようとしても去りません。ログには、あらゆる命令を無視すると表示されます。オブシディアン・スティードは、属性を`good`フィールドに記録するシートで`"disobeys": {"chance": 10, "when": {"value": {"field": "good"}, "atLeast": 1}}`とします。これを使うルールセットにはCapability API 1.665が必要です。

防護から除外する種類と、タグで決まる内側の対象です(Capability API 1.666)。戦闘前に設置するゾーン(1.462)には、`"spares": [<kind>, ...]`を指定できます。種類のIDや名前でクリーチャーの種類を指定し、`keepsOut`はそれらを締め出さなくなります。各種類は、もともと締め出すもののいずれかである必要があります。そうでなければ元のままとなり、戦闘でその旨が表示されます。`"tag": <tag>`も指定でき、その場合、内部での効果はそのタグを持つクリーチャーだけに働きます。フィーンドとアンデッドを対象にしつつ、フィーンドを除外するHallowは`{"entry": "Hallow", "spares": ["fiend"]}`です。神格の信徒への追加効果は、該当するクリーチャーにタグを付けて、`{"entry": "Hallow", "tag": "follower"}`とします。これらのためにルールセット自体を変える必要はありませんが、これらに依存するルールセットにはCapability API 1.666が必要です。

アイテムが携行者や使用者に求める要件です(Capability API 1.667)。アイテムの`binds.needs`は、携行者が満たす必要のあるシートの値の範囲(`value`、`atLeast`、`atMost`)を列挙します(4つまで)。要件を満たさない者が結び付けた場合、そのアイテムは着用されていないものとして扱われます。着用時の効果もステータスも数えられず、戦闘中も戦闘外もその使用は提示されません。アイテムの`userNeeds`は、そもそも使用するための同様の要件を列挙します。戦闘外では使用が拒否され、戦闘中は提示されません。シートから読み取る値`items.needsWaivedBy`がゼロを超える間は、両方の要件が免除されます。5eの「クレリックによる同調が必要」は`"binds": {"needs": [{"value": {"field": "cleric_level"}, "atLeast": 1}]}`、クレリックの呪文のスクロールは`"userNeeds": [{"value": {"field": "cleric_level"}, "atLeast": 1}]`、Use Magic Deviceは`"needsWaivedBy": {"derived": "use_magic_device"}`で、ローグのレベルが「13」になるとその派生値を「1」にします。このいずれかを使うルールセットにはCapability API 1.667が必要です。

標的が持っているものを奪う対抗判定です(Capability API 1.668)。カタログのエントリーの`contest`(1.565)は、`slots`や`tags`を持つ`takes`を指定できます。対抗判定で勝った標的が、それらのスロットのどれかで持つもの、またはそれらのタグのどれかを持つもののうち、最初のものが使用者の足元に落ちます。標的は、ほかの落としたものと同様に(1.266)、その場所からしか拾い直せません。ログは何を奪ったかを示します。5eのTelekinesisをクリーチャーが持っている物体に使う場合は`"contest": {"attacker": ["spellcasting"], "defender": ["strength"], "takes": {"slots": ["hand"]}}`です。これを使うルールセットにはCapability API 1.668が必要です。

判定で解除する罠です(Capability API 1.669)。ゾーンの`disarm`は、そのゾーンを、術者の敵が解除できる罠にします。`{"check": "thieves_tools", "difficulty": 15, "tripsOnFailBy": 5}`です。罠を見ていて(隠れた罠なら、自分の側が発見した後に限ります)、罠から一マス以内に立っている者には、`disarm`標準アクションで「Disarm <そのラベル>」(解除)が提示されます。`combat.standard`にはこのアクションを列挙する必要があります。`check`(`combat.checks`のいずれか)で、`difficulty`、省略時はエントリー自身のセーヴ難易度に対する判定を行います。成功すると、罠は作動せずに消えます。失敗の差が`tripsOnFailBy`以上なら作動し、進入が作動条件の場合(`detonates.entered`)は、解除を試みた者に対して作動します。`disarm`を指定する`standard`の付与によって、別の行動枠で支払えるようになります。5eのFast Handsがボーナスアクションで行うのと同じです。これを使うルールセットにはCapability API 1.669が必要です。

テレポート先への習熟度の表です(Capability API 1.670)。`leaves`を持つ`teleport`は、使用者が行き先をどれだけよく知っているかを表す`familiarity`を持てます。一行から八行で、各行に`id`、`label`、そして百に対する`mishap`(事故)、`similar`(似た地域)、`off`(目標外への到着)の確率を指定します(残りは目標どおりの到着です)。さらに、事故が各移動者に与えるダメージ`mishap`を指定します。`{"dice": "3d10", "type": "force"}`です。各行はモード`familiar-<id>`として提示され、戦闘を離れるにはそのいずれかを選ぶ必要があります。離れるときに、選んだ行に対してd100を振り、事故、似た地域、目標外の順に判定します。事故は使用者と同行者全員に被害を与え、再びダイスを振ります(最大二十回)。その後、立っているかダウンしているかを問わず、まだ生きている全員が離れます。ログは各回の出目と結果を示します。5eのTeleportでは、呪文の表どおりの行を書きます。恒久的な円: 0、非常によく知っている場所: 5、8、11、見たことがある程度の場所: 33、10、10、存在しない目的地: 50、50です。これを使うルールセットにはCapability API 1.670が必要です。

特定の地面では使えない登攀です(Capability API 1.671)。`speeds`に登攀を持つ戦闘の状態は、`climbNotOn`を指定できます。`terrain`はその登攀が使えないタイル(または盤面の場所)、`slippery: true`は持続する範囲によって滑りやすくなった地面です。滑りやすさはゾーンの`terrain`の`"slippery": true`で示します(5eのGrease)。盤面の場所を`terrain`が指定している場合、その盤面では状態が登攀をまったく与えません。持ち主自身の登攀や、別の状態が`climbNotOn`なしで与える登攀なら、引き続きどこでも登れます。5eのSlippers of Spider Climbingは、`"speeds": {"climb": "walk"}`と`"climbNotOn": {"slippery": true, "terrain": ["ice"]}`を持つ状態を付けたままにします。このいずれかを使うルールセットにはCapability API 1.671が必要です。

合計の上限を持つフィールドです(Capability API 1.672)。シートは`totals`を指定でき、`{"fields": [...], "max": N, "label"?: "..."}`を最大八つ持てます。それぞれ二つから二十四の数値フィールドを指定し、その値の合計は`max`を超えられません。シート全体のフォームは、ほかのフィールドの値だけ各フィールドの上限を下げます(ただし、そのフィールド自身の下限より下げることはありません)。Game Masterによる成長処理は、上限を超える値を拒否します。インポートしたシートや以前のシートなど、すでに超えているシートでは、値を変更せず、フィールドの上にその旨を表示します。ガイド付きビルダーのステップの`total`(1.107)は、引き続きそのステップだけを制限します。5eのクラスレベルは`{"fields": ["level_barbarian", "level_bard", ...], "max": 20, "label": "Class levels"}`です。これを使うルールセットにはCapability API 1.672が必要です。

クリーチャーのアクションに対するセーヴの大きな失敗です(Capability API 1.673)。クリーチャーのアクションの`save`は、カタログのエントリーと同じく`failedBy`を持てます(1.592)。`{"atLeast": 5, "applies": [...]}`は、標的の失敗の差がその値以上なら、アクションの`applies`に代えて、それらの状態を付与します。5eのマミーのDreadful Glareで、失敗の差が「5」以上なら恐怖状態と麻痺状態になる場合です。クリーチャーでもカタログのエントリーでも、`failedBy`は`atLeast`の代わりに`resultAtMost`を指定できます。失敗したセーヴの合計がその値以下の場合で、スプライトの矢では、セーヴの結果が「5」以下なら毒状態と気絶状態になります。このいずれかを使うルールセットにはCapability API 1.673が必要です。

各クリーチャーに一度だけ使うクリーチャーのアクションです(Capability API 1.674)。クリーチャーのアクションは`oncePerTarget`を指定できます。`{"whenSaved": true}`はセーヴに成功したクリーチャー、`{"whenEnds": true}`はそのアクションによる状態が終了したクリーチャーを対象外にし、両方ならどちらかに該当するもの、どちらもなければ使った全員を対象外にします。対象外になったクリーチャーは、その戦闘では二度と選ばれず、巻き込まれもしません。`"until": "<rest id>"`があれば、キャラクターはその休息を取るまでシートに記録を保持します。`"shared": "<id>"`は、アクションに同じIDを指定する全クリーチャーを同じ出所にします。なければ、各クリーチャー(名前で区別)とアクションがそれぞれ独自の出所になります。5eのドラゴンのFrightful Presenceは`{"whenSaved": true, "whenEnds": true, "until": "long"}`です。マミーのDreadful Glareは`"shared": "mummy-glare"`を加え、マミー・ロードは独自のものにします。これを使うルールセットにはCapability API 1.674が必要です。

引き寄せる者に向かっての引き寄せです(Capability API 1.675)。
クリーチャーのアクションやカタログのエントリーは、
ルールセット自身の単位による距離`pull`を指定できます。
命中した相手(セーヴがある場合はその失敗時)を、
互いの最も近いマスから一マスずつ、
使用者に向かってまっすぐ引き寄せます。
隣接した時点、
壁、
埋まったマス、
急な上り段差で止まります。
段差からの落下は、
押し出しと同じ処理です。
アクションは押し出すか引き寄せるかのどちらかで、
両方は行いません。
5eのバロールの鞭は`"pull": 25`にDC 20のStrengthセーヴ、
ローパーのReelは`"pull": 25`に`"targetHolds": {"fromSelf": ["grappled"]}`、
Thorn WhipとLightning Lureは`"pull": 10`です。
ログは「pulls ... in」(引き寄せる)と示します。
これを使うルールセットにはCapability API 1.675が必要です。

しがみつくクリーチャーです(Capability API 1.676)。戦闘の状態は`attaches`を指定できます。状態を付与した者はその持ち主にしがみつき、持ち主が歩いたり押し出されたりすると、最後に通過したマスへ一緒に運ばれ、機会攻撃を誘発しません。`"sourceAttacks": "none"`なら、しがみついている間は誰も攻撃できず(スタージ)、`"holder"`なら持ち主だけを攻撃できます(クローカー、ダークマントル)。`endsAfterHarm`は、状態の`harms`が与えた被害の合計がその値に達すると、しがみつきを解きます(スタージでは「10」、`harms`は`{"at": "source-turn-start", "dice": "1d4", "flat": 3}`)。歩いて離れたときの終了には付与の`endsAway`、誰でもアクションで終わらせるには`checkEnds`の`"by": "any"`、出所がダウンしたときの終了には`endsWhenSourceDown`を使います。クローカーのDamage Transferは`takesSourceHarm`の`{"share": 0.5}`です。付与のエントリーは`"withAdvantage": true`を指定でき、有利でダイスを振った攻撃からしか付与されないようにします。クローカーの頭への噛みつきで、掴んでいる状態を`endsWith`に指定する`blinded`です。このいずれかを使うルールセットにはCapability API 1.676が必要です。

クリーチャーの打撃が、ダウンさせた相手に行う処理です(Capability API 1.677)。クリーチャーのアクションは`onFell`を指定できます。その打撃が、まだダウンしていなかった者の体力をなくしたとき、`"stabilizes": true`は容体を安定させます(瀕死ルールが必要です)。`applies`は、クリーチャーを出所として状態を付与します。相手を立ったままにする打撃や、すでにダウンしている者への命中では、どちらも行いません。5eのジャイアント・スパイダーの噛みつきは`{"stabilizes": true, "applies": [{"condition": "poisoned", "duration": {"rounds": 600}}, {"condition": "paralyzed", "duration": "instant", "endsWith": "poisoned"}]}`です。回復は、ルールセットがそう定めない限り状態を終わらせないため、「ヒットポイントを取り戻した後も」に追加の設定は要りません。これを使うルールセットにはCapability API 1.677が必要です。

体力の低い者だけを即死させるクリーチャーと、セーヴ失敗時に体力をなくすアクションです(Capability API 1.678)。クリーチャーのアクションは、`slaysOnFailedSave`と併せて`slaysHealthAtMost`を指定できます。失敗時の体力がその値以下の標的だけが即死し、それ以外はセーヴに成功したものとして打撃を受けます(ソーラーのSlaying Longbowでは「190」)。クリーチャーのアクションは、カタログのエントリーと同じく`dropsOnFailedSave`を指定できます。失敗した標的は体力をなくし、ルールセットに瀕死があれば瀕死になり、成功した標的は何も受けません(シー・ハグのDeath Glareで、`"onSuccess": "negates"`を指定します)。アクション自身のセーヴと組み合わせ、`slaysOnFailedSave`とは併用しません。クリーチャーでこのいずれかを使うルールセットにはCapability API 1.678が必要です。

Flybyです(Capability API 1.679)。戦闘の状態は`"flyby": true`を指定できます。持ち主に飛行移動速度がある間は、飛んで離れるため、誰の間合いから離れても機会攻撃を誘発しません。クリーチャーに`keepsOn`で付けたままにすると、5eのアウル、ジャイアント・アウル、フライング・スネークのFlybyになります。飛行移動速度がなければ何もしません。これを使うルールセットにはCapability API 1.679が必要です。

スペースの共有です(Capability API 1.680)。戦闘の状態は`"sharesSpace": true`を指定できます。持ち主は、味方か敵かを問わず誰のスペースにも歩いて入り、そこで止まれます。また、誰でも持ち主のスペースに歩いて入り、止まれます。クリーチャーに`keepsOn`で付けたままにすると、「ほかのクリーチャーのスペースを占めることができ、その逆も同様」である、5eのスウォームになります。それ以外の者同士は、従来どおり互いのスペースに入れません。これを使うルールセットにはCapability API 1.680が必要です。

狭い場所への押し込みと、小さいサイズとしての移動です(Capability API 1.681)。`combat.sizes.squeezing`の`{"costs": 2, "condition": "squeezed"}`は、スペース全体が壁の間に収まらない者が、自分より一段小さいサイズとして通り抜けられるようにします。そのような各ステップのコストは`costs`倍になり、狭い場所で止まると、小さい方のスペースだけを占め、`condition`を持ちます(ルールセットに必要な効果を与えてください。5eでは、攻撃とDexterityセーヴへの不利、およびその者に対する攻撃への有利です)。スペース全体が収まる場所で止まると、再び全体を占め、状態は消えます。戦闘の状態は`"squeezesAs": "<size id>"`を指定できます。持ち主は、そのサイズが収まるあらゆる隙間を、通常のステップのコストで、状態を受けずに自由に通れます。5eのAmorphousやスウォームでは`"tiny"`です。このいずれかを使うルールセットにはCapability API 1.681が必要です。

近くの味方が見えている間だけ維持される状態です(Capability API 1.682)。戦闘の状態の`heldOnlyIn`は、`light`と併せて、またはその代わりに、ルールセット自身の単位による距離`allySeenWithin`を指定できます。持ち主がその距離内で立っている味方を見ている間だけ状態が維持され、それ以外では終了せずに適用が抑えられます。盤面外では、立っている味方がいれば十分です。5eのビアデッド・デヴィルのSteadfastは、`"conditionImmunities": ["frightened"]`と`"heldOnlyIn": {"allySeenWithin": 30}`を持つ、付けたままにする状態です。これを使うルールセットにはCapability API 1.682が必要です。

武器に塗った毒です(Capability API 1.683)。状態の`onHit`は、独自のダメージ`"damage": {"dice": "1d4", "flat": 0, "type": "poison"}`を与え、その前にセーヴ`"save": {"save": "con_save", "difficulty": 11, "onSuccess": "half"}`を求められます。成功するとダメージは半分になり(`"negates"`なら与えません)、その`applies`は付与されません。このため、`damage`がある場合、`applies`は任意になりました。`"failedBy": {"atLeast": 5, "applies": [...]}`は、セーヴの失敗の差がその値以上のとき、さらに状態を付与し(ドラウの毒による気絶)、`save`が必要です。`"damageTypes": ["slashing", "piercing"]`は、それらのダメージ種別の命中に限定するため、刃に塗った毒がクラブの攻撃に乗ることはありません。一度の命中で使い切る毒なら`endsAfter: "own-hit"`、より長く続く毒なら持続時間を使って、持ち主に塗布の状態を付けたままにしてください。

持ち主が回復すると終わる状態です(Capability API 1.684)。`endsWhen`は`healed`を取れ、戦闘中に持ち主のポイントを少なくとも一点回復する、あらゆる回復で終了します(カルトロップによる歩行速度の低下。「クリーチャーが少なくとも「1」ヒットポイントを取り戻すまで」です)。また、`healed-by-magic`は、魔法によるそのような回復でのみ終了します。`cannot-heal-nonmagical`と同じ読み方で、性質に`"magical"`を持つアクション、エントリー、アイテムの使用によるものです(Infernal Woundの「標的が魔法による回復を受けると塞がる」)。体力が満タンである場合や状態によって回復の適用が抑えられる場合など、何も回復しない回復は、どちらも終わらせません。`endsWhen`には、六つの終了条件すべてを指定できるようになりました。

誰か、または自分自身を戦闘の外へ送るクリーチャーのアクションです(Capability API 1.685)。ステータスブロックやカタログのクリーチャーのアクションは、カタログのエントリーと同じく`dismisses`を取れます。`true`または`{"while": conditionId, "gone"?, "turns"?}`で、`while`の状態はアクション自身の`applies`のいずれかです。`"self": true`と`"turns": true`があれば、クリーチャー自身が離れ、離れた先でもターンを取り続けます。そこで提示されるのは、戻るための手段である、状態の`endable`の「End」(終了)だけです。戻る場所は、離れた場所か最も近い空き場所です。ゴーストのEtherealnessは`{"id": "etherealness", "name": "Etherealness", "budget": "action", "self": true, "applies": [{"condition": "ethereal", "duration": "until-dispelled"}], "dismisses": {"while": "ethereal", "turns": true}}`に、戦闘の状態`{"condition": "ethereal", "effects": [], "endable": {"budget": "action"}}`を組み合わせます。フェイズ・スパイダーのEthereal Jauntも同じで、ボーナスアクションを使います。`"carries": {"count": 3, "within": 5, "condition": "ethereal"}`を`self`アクションに指定すると、その距離内で立っている味方を、近い順にその人数まで連れていきます。各同行者は、そのクリーチャーを出所とする`condition`を持つ間離れたままで、クリーチャーが戻ると一緒に戻ります(ナイトメアのEthereal Stride)。状態が`endable`である同行者は、単独で戻ることもできます。

戦闘の判定数の上限を増やす変更です(16個)(Capability API 1.686)。`combat.checks`は、従来の上限(12個)から新たな上限(16個)まで保持できるようになったため、5eの対抗判定に使うスキルをすべて持つルールセットでも、罠の解除が読み取る盗賊道具の判定を入れる余地があります。判定数が旧上限(12個)を超えるルールセットにはCapability API 1.686が必要です。

使うたびに別のことをするクリーチャーのアクションです(Capability API 1.687)。`"byUse": [actionId, ...]`は、同じクリーチャーのほかの通常アクションを二つから六つ列挙し、`uses`を持ち、それ自体は何もしないアクションに指定します(攻撃判定、ダメージ、回復、セーヴ、状態の付与、連続処理、`self`を持ちません)。初回の使用は最初に指定したアクション、次の使用は次のアクションを、向けられた相手に対して行い、末尾を過ぎた使用はすべて最後のアクションになります。回数は自身の`uses`で数えるため、クリーチャーのその日全体の使用にわたって回数が引き継がれます。指定したアクション自体は、メニューに出ません。アンドロスフィンクスのRoarの「大休憩を終えるまでに咆哮するたび、咆哮がより大きくなる」は`{"id": "roar", "name": "Roar", "budget": "action", "uses": {"per": "day", "count": 3}, "byUse": ["roar_1", "roar_2", "roar_3"]}`で、各咆哮を独自の範囲、セーヴ、状態を持つアクションにします。

Periapt of Wound Closureです(Capability API 1.688)。戦闘の状態の`"stabilizesWhenDying": true`は、持ち主が自分のターンを瀕死で開始した場合、瀕死のダイスを振る代わりに容体を安定させ、ログがその旨を示します。着用アイテムの`keepsOn`で付けたままにすると、ペリアプトの「自分のターン開始時に瀕死であれば、必ず容体が安定する」になります。休息の`dice`エントリーは`"times"`を指定できます。各ダイスの回復量を、`add`を含めて乗算する値の参照で、倍率は一倍未満にはなりません。`{"itemStat": {"stat": "hit_die_times", "from": "worn", "pick": "max", "default": 1}}`を使い、ペリアプトが`hit_die_times`に「2」を与えると、着用中は「それが回復するヒットポイントの数」が二倍になります。

慎重に歩けば安全に通れる地面と、歩行を止める地面です(Capability API 1.689)。持続する範囲の`terrain`は`"spareSlowWalkers": true`を指定できます。そのような範囲が存在する間、歩く者には「Move」(移動)と並んで「Move carefully」(慎重に移動)が提示されます。これを使うと、その地面に入る各ステップのコストは二倍になり(そこでの移動速度は半分)、範囲の`enter`トリガーはその者を通します。また、`"endsWalk": true`なら、`enter`トリガーに捉えられ、セーヴに失敗した歩く者(または行うセーヴがない場合)は、そのマスで止まり、そのターンの残りの移動を失います。5eのカルトロップは、`"triggers": ["enter"]`に`"terrain": {"spareSlowWalkers": true, "endsWalk": true}`、DC 15のDexterityセーヴ、刺突ダメージ: 1、そして回復時に終わる歩行速度の低下(1.684)です。ボール・ベアリングは`spareSlowWalkers`に伏せ状態のセーヴを組み合わせます。

テキストフィールドの語句から
読み取る数値です(Capability API 1.690)。
派生値
`{"op": "wordsTable", "from": {"field": "alignment"}, "table": {"good": 1, "evil": -1}, "default": 0}`は、
プレイヤーが書いたままの
フィールドを読み取ります。
各キーは
単語または語句で(1-40個、
40文字以内のキー)、
大文字と小文字を区別せず
単語全体で照合します。
フィールドに含まれる
キーのうち、
表の順序で
最初のキーが
数値を与え、
どれも含まない
フィールドは
`default`になります。
そのため、
「Lawful Good」: 1、
「Goodly」: 0と
読み取られます。
フィールドは
テキスト(または列挙型)です。
ほかの派生値と
同様に読み取れるため、
属性に応じた
状態、
判定、
クリーチャーのルールは
これを数値として
読み取れます。
5eのBook of Exalted DeedsやTalisman of Pure Goodが、
触れた悪の者に
被害を与える場合です。

指定した要件のどれか一つを求めるアイテムです(Capability API 1.691)。`binds.needs`と併せて`"needsAny": true`を指定すると、すべてではなく、要件のいずれかを満たせば結び付けの条件を満たします。5eの「クレリック、ドルイド、ウォーロックのいずれかによる同調が必要」で、各クラスのレベルにつき一つの要件を指定し、それぞれ`atLeast: 1`にします。`"userNeedsAny": true`は`userNeeds`に同じ処理をします。バード、クレリック、ウィザードのリストに載っている呪文のスクロールを、その三者の誰でも読める場合です。どちらも要件を指定できます(8個まで。1.691より前: 4個)。`items.needsWaivedBy`は、引き続きすべての要件を免除します。

対抗判定の`takes`を独自のモードにする指定です(Capability API 1.692)。`contest.takes`と併せて`"takesMode": {"label": "Object", "restLabel": "Creature"}`を指定すると、エントリーが二つのモードで提示され、武器のモードと同じく使用時に選びます。`label`のモードでは、勝つと`takes`が指定するものを奪い、ほかは何もしません(`applies`、`movesTarget`、ダメージはありません)。`restLabel`のモードと、モードを選ばない場合は、勝つとそれ以外をすべて行い、何も奪いません。`appliesOneOf`、`cureOneOf`、`kindChoice`、`forms`、`calls`、`conjures`とは併用しません。また、モードで発動したエントリーの繰り返し(`repeats`)は、発動時のモードでのみ提示され、実行されるようになりました(選ばなかった場合は最初のモード)。Telekinesisは掴んでいた物体やクリーチャーを掴み続け、Hexは能力値を維持します。

自分に付与するものに対して使用者もセーヴする使用です(Capability API 1.693)。`appliesSelf`と`save`と併せて`"appliesSelfSaves": true`を指定すると、使用者も同じ難易度でそのセーヴを行い、失敗した場合だけ`appliesSelf`が使用者に付与されます。5eのDust of Sneezing and Chokingでは、投げた者もほかの全員と同じく雲の中に立っています。アイテムの使用にConstitutionセーヴを指定し、窒息の状態を`applies`と`appliesSelf`の両方に入れます。

近くにいる誰もが判定で動かせる持続する範囲です(Capability API 1.694)。ゾーンの`move`は`"check": {"check": "arcana", "difficulty": 25, "within": 60, "distanceBy": {"abilityMod": "int", "times": 5, "atLeast": 5}, "failsToward": 10}`を持てます。この場合、誰も`move`だけでは動かせません。中心から`within`以内に立っている者なら、術者も含めて誰でも、`move.budget`を消費して「Control」(操作)を行い、`check`(`combat.checks`のいずれか)で`difficulty`に対する判定を行えます。成功すると、`distanceBy.times` × その者の`abilityMod`修正値まで(最低`atLeast`。`distanceBy`がなければ`move.distance`)の選んだマスへ移動し、その者の支配下になります。失敗すると、その者の方へ`failsToward`だけ移動します。最後に動かした別の者がまだ立っている間は、代わりにその者の判定との対抗判定になり、同値ならその者が勝ち、負けても何も動きません。誰かの上へ動かすと、その者が進入した場合と同じく捉えます。5eのSphere of Annihilationでは、DC 13のDexterityセーヴ失敗時の力場ダメージ(4d10)をゾーンの`enter`にし、作った者がいなくなっても残るように`outlasts`を付けます。

追加効果が対抗判定に依存するクリーチャーのアクションです(Capability API 1.695)。クリーチャーのアクションは`"contest": {"attacker": ["might"], "defender": ["might"]}`を持てます(`combat.checks`のIDで、`ties`が`"attacker"`でなければ同値は防御側の勝ちです)。命中した標的には、勝敗にかかわらずダメージが入り、クリーチャーの最良の判定が標的の判定に勝った場合だけ、状態の付与、押し出し、引き寄せを行います。成功時は何もしないセーヴと同じです。`save`とは決して併用しません。5eのメロウのHarpoonの「メロウとのStrengthの対抗判定に成功しなければ、メロウに向かって最大距離(20フィート)まで引き寄せられる」を、`pull: 20`と組み合わせます。

アクションが命中した相手に入り込むクリーチャーです(Capability API 1.696)。クリーチャーのアクションの`dismisses`は、`while`と併せて`"possesses": true`を指定できます。アクションの命中後、標的がそのクリーチャーを出所とする`while`を持っていれば、標的ではなくクリーチャー自身が戦闘を離れます。どのように終わったかを問わず、標的がそのクリーチャーを出所とする状態を持たなくなるとすぐに、標的の隣へ戻ります。`while`の戦闘の状態には`"controls": true`(1.577)を与え、状態が続く間は、クリーチャーが離れていても標的がクリーチャーの側で戦うようにしてください。また、`"endsWhenHolder": {"downed": true}`を与え、標的がダウンすると終わるようにしてください。ゴーストのPossessionは`{"id": "possession", "budget": "action", "reach": 5, "save": {"save": "cha_save", "difficulty": 13, "onSuccess": "negates"}, "applies": [{"condition": "possessed", "duration": "until-dispelled"}], "dismisses": {"while": "possessed", "possesses": true}}`です。Dispel Evil and GoodやBreak Enchantmentが`possessed`を終わらせた場合も、ゴーストが出てきます。`turns`、`gone`、`carries`とは併用せず、`self`アクションにも指定しません。ゴーストが任意にボーナスアクションで離れられるよう、状態に`"endable": {"budget": "bonus"}`(1.622)を与えてください。このアクションは、憑依された体のターンに行います。Dominate Person、Beast、Monsterには新しい指定は必要ありません。`"controls": true`を持つそれぞれの状態が、続く間、支配された者を術者の側にします。

ゾーンが捉えている者への、より多くの状態の付与の防止です(Capability API 1.697)。ゾーンの`keepsOut.cantGive`と`keepsOut.frees`は、それぞれ状態を指定できます(12個まで。1.697より前: 8個)。Magic CircleやHallowの「魅了状態、恐怖状態、憑依状態にならない」に、ルールセットがその語句に含めるほかの状態も併せられます。

追加効果が一部の標的にしか適用されないクリーチャーのアクションです(Capability API 1.698)。クリーチャーのアクションは、ほかと同じ標的の条件`"ridersIs"`を持てます(`types`、`tags`、`upToSize`、`atLeastSize`など)。状態の付与(`applies`)、押し出し(`push`)、引き寄せ(`pull`)、退去(`dismisses`)は、これに該当する標的にしか適用されず、`contest`(1.695)もそのような標的に対してしか行いません。ダメージは命中した誰にでも入ります。5eのメロウのHarpoonの「標的がHuge以下なら、メロウとのStrengthの対抗判定に成功しなければ、メロウに向かって最大距離(20フィート)まで引き寄せられる」は、`"contest": {"attacker": ["athletics"], "defender": ["athletics"]}, "pull": 20, "ridersIs": {"upToSize": "huge"}`です。同じ形で、特定のサイズのクリーチャーだけを掴んだり、飲み込んだりする場合も表せます。アクションには、この指定で絞り込む対象となる処理が必要です。

語句で書かれた
属性から
読み取る
タグです(Capability API 1.699)。
クリーチャーは
`"alignment": "lawful evil"`を
指定でき、
`combat.creatureTypes`は、
キャラクターの
テキストフィールドか
選択フィールドを
指定する
`"tagsFrom": "alignment"`を
持てます。
`creatureTypes.tags`のうち、
その語句に
ラベルかIDが
単語全体で
含まれるものを、
大文字と
小文字を
区別せず
読み取り、
`tags`で
直接
指定したものに
加えて、
その者の
タグに
します。
「non-」
または
「not」の後の
単語は
何も
指定しないため、
「any non-good alignment」
(善以外の
任意の属性)は
`good`に
なりません。
`lawful`、
`chaotic`、
`good`、
`evil`、
`neutral`などの
タグを
宣言すると、
すべての
標的の条件が、
ほかのタグと
同じく
属性を
読み取ります。
Talisman of Pure Goodの、
悪の者だけを
即死させる
亀裂は
`"targetTypes": {"is": {"tags": ["evil"]}}`です。
Holy Avengerや
Protection from Evil and Goodも
同じ方法で
絞り込めます。
「Any alignment」
(任意の属性)と
「unaligned」
(無属性)は
何も
指定しません。

一部の着用者だけに与えるアイテムのステータスです(Capability API 1.700)。アイテムは`statsIf`を持て、`{"needs": [...], "needsAny": true, "add": {"spell_attack_bonus": 2}}`を指定できます(4行まで)。着用中(結び付けが必要なものは結び付け中)、`binds.needs`(1.667)と同じ読み方で、着用者のシートが`needs`をすべて満たす行、または`needsAny`があればいずれかを満たす行のそれぞれについて、`add`をアイテム自身の数値`stats`に加えます(存在しない値: 0として数えます)。そのため、読み取るすべての`itemStat`がこれを数えます。5eのTalisman of Pure Goodは、善の者だけが同調でき(属性の`wordsTable`に対する`binds.needs`、1.690)、善のクレリックかパラディンの「呪文攻撃判定に+2」には`"statsIf": [{"needs": [{"value": {"track": "cleric_level"}, "atLeast": 1}, {"value": {"track": "paladin_level"}, "atLeast": 1}], "needsAny": true, "add": {"spell_attack_bonus": 2}}]`を使います。

手に取った者に被害を与えるアイテムです(Capability API 1.701)。アイテムは`touchHarms`を持て、`{"needs": [...], "needsAny": true, "dice": "8d6", "flat": 0, "type": "radiant"}`を指定できます(4行まで)。ゲームのインベントリーで誰かの手に渡るたび(袋に追加されたとき、渡されたとき、同じものをさらに獲得したとき)、`binds.needs`(1.667)と同じ読み方で、その者のシートが`needs`を満たす最初の行のダイスを振り、体力から差し引きます(負傷トラックでは最も軽い種類の印を一つ付けます)。`needs`のない行は誰にでも該当します。Journalはその旨を示します。5eのTalisman of Pure Goodでは、属性の`wordsTable`(1.690)で善を「1」、悪を「-1」と読み取り、`[{"needs": [{"value": {"derived": "goodness"}, "atMost": -1}], "dice": "8d6", "type": "radiant"}, {"needs": [{"value": {"derived": "goodness"}, "atMost": 0}], "dice": "6d6", "type": "radiant"}]`を使います。偽物は、その真の正体に従って被害を与えます(1.79)。何を体力とするかはルールセットで定めます。

自身の一マスだけを範囲にする指定です(Capability API 1.702)。カタログのエントリーやアイテムの使用のバーストの`area`は、`"oneCell": true`を指定できます。`size`がどれほど小さくても、通常のバーストは少なくとも周りのマスまで覆いますが、この指定では置いたマスだけを覆います。移動時(`zone.move`、1.173。判定による移動: 1.694)や漂流時も、一マスのままです。5eのSphere of Annihilationは、「2」フィートの球で、`"area": {"shape": "burst", "size": 2, "oneCell": true}`に`zone`を付けます。一地点に置く単独のバーストに限られ、`around`、`copies`、`sizePerCostStep`とは併用しません。

タリスマンが移動の判定を助けるゾーンです(Capability API 1.703)。ゾーンの`move.check`(1.694)は`"holding": {"tags": ["sphere_talisman"], "adds": {"derived": "proficiency_bonus"}, "advantage": true, "distanceBy": {"abilityMod": "int", "times": 10, "add": 10}}`を持てます。`tags`のいずれかを持つアイテムを保持する移動者(シートで着用していて落としていないもの、またはクリーチャーが持つもの)は、シートから読み取る`adds`を判定に加え、`advantage`で有利にダイスを振ります。また、すでにゾーンを支配している間(最後に動かした者である間)は、`distanceBy`まで動かせます。`add`に`times` × その者の能力修正値を加えた値で、最低`atLeast`です。各部分は任意ですが、少なくとも一つ必要です。5eのTalisman of the Sphereの「その判定では習熟ボーナスを二倍にする…それを基本距離(10フィート)に、Intelligence修正値を乗算した値(10倍)のフィート数を加えた距離まで浮遊させる」は、習熟ボーナスを`adds`にし、その`distanceBy`を指定します。

クリーチャーを決して妨げないアクションです(Capability API 1.704)。状態の`"unhinderedBy": ["Web"]`は、持ち主を決して妨げないアクションを、IDかラベルで指定します。それらのいずれかが残す持続する範囲は持ち主を捉えないため、その地面は持ち主にとって移動困難ではなく、打撃も状態の付与も行いません。また、それらのいずれかが持ち主に付与するもの(命中による拘束)は付与されず、ログでは完全耐性として示されます。5eのWeb Walkerをジャイアント・スパイダーに`keepsOn`で付けたままにすると、「蜘蛛の糸による移動の制限を無視する」を表せます。Webの呪文と、自身のWeb攻撃の両方です。

一部の遮蔽を無視する攻撃です(Capability API 1.705)。状態の`"coverIgnored": {"upTo": "half", "attacks": "spell"}`は、持ち主の攻撃が`upTo`までの遮蔽(`"half"`または`"three-quarters"`)を無視できるようにします。マス自身の地面が与える半分の遮蔽も含みます。`attacks`(`"weapon"`、`"spell"`、`"any"`)と`blow`(`"melee"`、`"ranged"`)は、一部の攻撃に絞り込みます。`upTo`を超える遮蔽はそのまま数え、完全遮蔽は常に数えます。5eのWand of the War Mageに`keepsOn`で付けたままにすると、「呪文攻撃を行うとき、半分の遮蔽を無視する」です。Sharpshooterは`{"upTo": "three-quarters", "attacks": "weapon", "blow": "ranged"}`、Spell Sniperは`{"upTo": "three-quarters", "attacks": "spell"}`です。

浮遊するアイテムです(Capability API 1.706)。アイテムの`toggle`は`"freesSlots": true`と`"rounds": 10`を持てます。オンの間は、それが使うスロットが空くため、一緒に持つ両用武器は`versatile`のダイスでダメージを与え、インベントリーでは、その手に別のものを持つ余地ができます。アイテム自身は、着用時の処理をすべて行い続けます。持ち主のターンが`rounds`回経過したときと、戦闘終了時に、自動でオフになります。戦闘中にオフにしたとき、収まる余地がなければ落ちます(ログでは落としたものとして示されます)。`freesSlots`を持つアイテムは、何らかの`slots`を使う必要があります。5eのAnimated Shieldは`{"label": "Animate", "budget": "bonus", "freesSlots": true, "rounds": 10}`で、「自分のスペースに浮遊し、使用者が構えているかのように守りつつ、両手を空けておく」です。

呼び出し手が命令し、その呼び出し手と同じように攻撃する、クリーチャーによる呼び出しです(Capability API 1.707)。クリーチャーのアクションの`calls`は、カタログのエントリーと同じく(1.558)、`"commandedWith": "bonus"`を持てます。呼び出された者は、呼び出し手の命令でのみ行動し、呼び出し手は最初を除く自分の各ターンに、その行動枠を「1」支払います。また、`"fromCaller": {"action": "greatsword"}`を指定すると、呼び出された者の攻撃は、呼び出し手自身の攻撃のうち、その攻撃の命中とダメージへのボーナスを使って行います。5eのソーラーのFlying Swordは`{"creature": "creatures/flying-sword", "count": {"flat": 1}, "commandedWith": "bonus", "fromCaller": {"action": "greatsword"}, "endsWithCaller": true}`です。

一部のクリーチャーが簡単に通れる地面と、被害を受ける地面です(Capability API 1.708)。状態の`"easyGround": ["snow", "Sleet Storm"]`は、指定したタイル上、指定した場所を持つ盤面全体、IDかラベルで指定したアクションが残す持続する範囲内で、移動困難な地面での持ち主のコストを通常のステップと同じにします。5eのホワイト・ドラゴンのIce Walkを`keepsOn`で付けたままにすると、「氷や雪から成る移動困難な地形は追加の移動を消費しない」です。雪の盤面とSleet Stormの氷が該当します。また、状態の`"harmedEntering": {"terrain": ["water"], "zones": ["Wall of Water"], "harm": {"flat": 1, "damageType": "cold"}}`は、それらのタイルか、それらのアクションの持続する範囲内の各マスに持ち主が歩いて入るたび、セーヴなしでその被害を与えます。`terrain`と`zones`の少なくとも一方が必要です。5eのファイアー・エレメンタルのWater Susceptibilityの「エレメンタルは、水中で一定の距離(5フィート)を移動するごとに…冷気ダメージ「1」を受ける」です。

大ダメージです(Capability API 1.709)。戦闘ブロックの`dying`は`"instantDeath": "overflow-at-least-max"`を持てます。通常なら瀕死になる者の体力を打撃が「0」にし、余ったダメージがその者のヒットポイント最大値以上なら、代わりに即死します。ダウン中に少なくともそれだけ大きな打撃を受けた場合も死亡します。一時ヒットポイントが先に吸収し、独自の体力を持つ形態がある場合は、それを超えて持ち越す分だけを数えます。もともと「0」で死ぬクリーチャーには影響しません。体力「1」で持ちこたえる効果は、即死を防ぐ場合だけ、これに対して機能します(`hangsOn.outright`、1.596)。Death Wardは機能し、Relentless Enduranceは機能しません。ログは大ダメージによって死亡したことを示します。Held Groundでは、通常どおり倒されます。

ボーナスアクションの呪文ルールです(Capability API 1.710)。戦闘ブロックは`"casting": {"afterBonusSpell": {"catalogs": ["spells"], "budget": "bonus", "only": {"level": 0, "budget": "action"}}}`を持てます。自分のターンに、それらのカタログのエントリーをボーナスの行動枠で一度発動すると、そのターンの残りに提示される同じカタログのエントリーは、`only.level`以下で、`only.budget`で発動するものだけになります。つまり、アクションで使う初級呪文です。また、いずれかを別の方法で、たとえばレベルのある呪文をアクションで発動した後は、そのターンにボーナスの行動枠で発動するものは提示されません。先に初級呪文をアクションで発動した場合は、ボーナスアクションの呪文を引き続き使えます。レベルとは、エントリーを支払った段階で、初級呪文では「0」です。スクロールのように、使用がそれらのカタログから発動するアイテムによる発動も数えます。Quickenedの呪文は、ボーナスの行動枠で発動したと数えます。ほかの者のターンでの発動は、リアクションでも待機していた呪文の解放でも、数えません。

標的が着用しているものです(Capability API 1.711)。あらゆる標的の条件(`targetIs`、`is`、`not`、`except`、`anyOf`)は、`"wears": {"tags": ["metal"]}`を持てます。それらのタグのどれかを持つアイテムを着用している者だけが該当します。シートで着用しているアイテム、クリーチャーなら自身の`"wears": ["armor", "metal"]`が指定するものです。5eのShocking Graspの金属鎧を着た標的に対する有利、Heat Metalの標的、ラスト・モンスターのAntennaeなどに使います。着用の指定だけでも完全な条件になり、種別やタグと併せる場合は、両方を満たす必要があります。

ダメージ時のセーヴへの有利や不利です(Capability API 1.712)。状態の`saveWhenDamaged`(1.125)は、持ち主がダメージを受けるたびに`saveEnds`のセーヴを繰り返しますが、`true`の代わりに`{"lean": "advantage"}`を指定できます。そのセーヴは有利(または不利)でダイスを振ります。`saveEnds.at`が指定する時点でのセーヴは、これまでどおり行います。5eのHideous Laughterでは、ターン終了時の`saveEnds`と、状態の`"saveWhenDamaged": {"lean": "advantage"}`を指定します。`seenLean`(1.268)もセーヴに有利や不利を与える場合、逆向きのものは打ち消し合います。

複数のフィールドから読み取るキャラクターのタグです(Capability API 1.713)。`combat.creatureTypes.tagsFrom`(1.699)は、テキストフィールドや選択フィールドのリスト`["race", "alignment"]`にできます。各フィールドを単独の場合と同じく読み取り、いずれかのフィールドにラベルかIDが単語全体で含まれるすべての`tags`エントリーを、それら全体のタグとして保持します。種族が「High Elf」であるシートは`elf`を持つため、`ridersIs {"except": {"tags": ["elf"]}}`(1.698)を持つグールのClawsは、エルフのクリーチャーと同じく、エルフのプレイヤーキャラクターにも追加効果を適用しません。

特定の地面でだけ維持される状態です(Capability API 1.714)。状態の`heldOnlyIn`(1.605)は、`"ground": ["water", "Running Water"]`を指定できます。持ち主が立っている場所が、指定した名前のいずれかに該当する盤面のタイル、盤面全体の場所(環境)、またはIDかラベルで指定したアクションが残す持続する範囲である間だけ、状態が維持されます。占めるマスのどれかが該当すればよく、それ以外の場所と盤面外では、終了せずに適用が抑えられます。5eのヴァンパイアでは、付けたままにする状態に`"heldOnlyIn": {"ground": [...]}`と、自身(`self: true`)に酸ダメージ「20」の`harms`を与えるオーラを指定します。盤面の水タイルは一種類なので、`water`を指定すると盤面のすべての水が流水として数えられます。静水を区別するルールセットでは、代わりに、川の流れやControl Waterなどのアクションが残す、流水の持続する範囲だけを指定します。`light`や`allySeenWithin`と併せる場合は、すべてを満たす必要があります。

誰かを掴んでいる間は使えないアクションです(Capability API 1.715)。クリーチャーのアクション、またはカタログのエントリーの仕組みは、`"unlessImposing": ["grappled"]`を持てます。使用者がこれらの状態をほかの誰にも付与していないか、付与した相手がもうそれを持っていない間だけ、提示されます。5eのアンケグでは、誰も掴んでいない間だけAcid Sprayを使えます。

クリーチャー自身の跳躍です(Capability API 1.716)。クリーチャーは、ルールセットの距離による`"jump": {"long": 30, "high": 15, "withoutRunUp": true}`を持てます。`combat.jumping`(1.499)が能力値から読み取る距離の代わりに、その距離を跳びます。助走があればその全距離、なければルールセットの`standing`に従いますが、`withoutRunUp`があれば助走なしでも全距離です。状態の`jumps`による乗算や加算は、引き続き適用されます。5eのブーレイのStanding Leapは、助走の有無を問わず幅「30」フィート、高さ「15」フィートです。

乗騎が着用する効果です(Capability API 1.717)。アイテムの`worn`効果は、`{"wornBy": "mount", "keepsOn": ["horseshoes_of_speed"]}`にできます。持ち主がそれを着用してクリーチャーに騎乗している間、付けたままにする状態(1.513。`when`の行は乗り手のシートから読み取ります)は、代わりに乗騎へ付与されます。騎乗の有無を問わず、その効果は持ち主には何も与えません。騎乗時や降りたときに読み直します。5eのHorseshoes of Speedでは馬の歩行移動速度を「30」フィート増やす状態、Horseshoes of a Zephyrでは`walksOnLiquid`を持つ状態を使います。`wornBy`がある効果は、`keepsOn`だけを持ち、それ以外を持ちません。

移動させられることへの踏ん張りです(Capability API 1.718)。状態は`"pushReducedBy": {"by": 10, "budget": "reaction"}`を持てます。持ち主が地上で意に反して移動させられるたび(押し出し、引き寄せ、範囲からの追い出し)、ルールセットの距離でその分だけ移動が減ります。行動枠の指定があれば、その行動枠が残っている間だけ、その行動枠を「1」支払って行います。空中では決して適用されません。ログはその旨を示します。5eのDwarven Plateは、そのような状態を`keepsOn`で付けたままにするアイテムです。

壁を通して見る感覚です(Capability API 1.719)。`combat.senses`の感覚は、`"throughWalls": true`を指定できます。その射程内では、見る者と見ているものの間の壁は、何も隠しません。暗闇、霧、不可視は、通常の視覚と同じく引き続き隠します。5eのRing of X-ray Visionは、指輪の着用中、30フィートのそのような感覚を与えます。`{ "id": "xray", "label": "X-ray Vision", "sheet": { "derived": "xray_vision" }, "throughWalls": true }`です。その他の制限(鉛、厚さ、二度目の使用による消耗)はGame Masterが扱います。これを使うルールセットにはCapability API 1.719が必要です。

手加減して気絶させる処理です(Capability API 1.720)。`combat.dying`は`"knockOut": {"blow": "melee", "condition": "unconscious"}`を持てます。すべてのキャラクターに、打撃を手加減する無料の切り替えが、ターンに一度与えられます(誤クリックを取り消せるよう、元に戻す切り替えも一度できます)。`label`のデフォルトは「Knock out」(手加減して気絶させる)です。オンの間、その者の近接攻撃が誰かの体力を「0」にすると、代わりに気絶させます。相手は戦闘から脱落し、気絶状態で容体が安定し、瀕死にも死亡にもなりません。このように倒した相手は生きたまま戦闘から脱落し、戦闘の要約では`knockedOut`と記録されます。キャラクターの場合も、瀕死の`condition`を持って容体が安定した状態で倒れています。それでも即死をもたらすもの(大ダメージ、殺す打撃)は、引き続き即死させます。5eのクリーチャーを気絶させるルールです。

発動によって作るアイテムです(Capability API 1.721)。カタログのエントリーの`mechanics`は、ルールセットのアイテムを指定する`"makesItems": {"item": "items/goodberry", "count": 10}`を持てます。戦闘中にキャラクターが発動すると、その個数のアイテムが手に置かれ、ほかの手持ちのアイテムと同様に、その場で使用できます(ベリー自身の`use`)。戦闘終了時には、残った分を、すでに持っている同じアイテムのスタックに加えて袋に書き込みます。5eのGoodberryでは、`targets`が`"self"`である`utility`エントリーにします。戦闘外では、Game Masterがインベントリーでアイテムを与え、その持続時間(Goodberryなら一日)も管理します。アイテム自身の`use`は、アイテムを作れません。

何ももたらさない休息です(Capability API 1.722)。`combat.conditions`の状態は、休息のIDによる`"blocksRests": ["long"]`、または`"all"`を指定できます。シートがその状態を持つ間、その休息はまったく何もしません(プール、トラック、ダイス、クリア、状態の処理のいずれもありません)。シートは「Long rest: no benefit while Cursed」と表示します。5eのラクシャサの呪いの「小休憩や大休憩を終えても恩恵を得られない」は、爪が付与する状態に`"all"`を指定し、呪いを取り除く効果が終わらせるまで持続させます。これを使うルールセットにはCapability API 1.722が必要です。

ダイスで跳ね返す効果です(Capability API 1.723)。`combat.conditions`の状態は、`"reflects": {"sides": 6, "backFrom": 6, "against": {"catalogs": ["spells"], "entries": ["spells/magic-missile"], "area": ["line"], "attackRoll": "ranged"}}`を持てます。それらのカタログのいずれかに属する敵のエントリーが持ち主に向けられ、`entries`のいずれかであるか、範囲が`area`の形状のいずれかであるか、遠隔攻撃判定(`attackRoll`)を行う場合、代わりにそのダイスを振ります。持ち主はその効果を受けず、出目が`backFrom`以上なら実行者へ跳ね返り、実行者は自分が標的であるかのようにその効果を受けます。範囲に巻き込まれるほかの全員は、通常どおり受けます。ログはどちらになったかを示します。5eのタラスクは、Reflective Carapaceのためにそのような状態を付けたままにします(`keepsOn`)。これを使うルールセットにはCapability API 1.723が必要です。

標的が選ぶセーヴです(Capability API 1.724)。クリーチャーのアクションやカタログのエントリーの`mechanics`のセーヴは、`"or": "dex_save"`を持てます。標的は`save`と`or`のうち、得意な方を行い、ログは行った方を示します。5eのブーレイのDeadly Leapは「StrengthまたはDexterityのセーヴ(標的が選択)」で、`{"save": "str_save", "or": "dex_save", ...}`です。これを使うルールセットにはCapability API 1.724が必要です。

ほかの者への飛び乗りです(Capability API 1.725)。
クリーチャーのアクションは`"leapsOnto": {"atLeast": 15, "noRoom": "prone"}`を持てます。
盤面では、
跳躍と同じようにマスを選択します。
`combat.jumping`と自身の`jump`で許される範囲で、
クリーチャー自身の移動を使って少なくとも`atLeast`の距離(ルールセットの距離単位)を跳び、
敵も含め、
ほかの誰かが一体以上いる空間に着地します。
`combat.jumping`が必要で、
範囲は持ちません。
着地された者はそれぞれアクションのセーヴを行います。
失敗すると通常どおりアクションのダメージと`applies`を受け、
成功すると`"onSuccess": "half"`なら半分のダメージを受けます。
その後、
それぞれ着地したクリーチャーの空間から押し出され、
その隣に置かれます。
セーヴに成功しても置ける場所がなければ、
現在地で`noRoom`の状態を受けます。
盤面がなければ、
そのアクションの通常の方法で標的を指定します。
5eのビュレットのDeadly Leapは`{"leapsOnto": {"atLeast": 15, "noRoom": "prone"}, "save": {"save": "str_save", "or": "dex_save", "difficulty": 16, "onSuccess": "half"}, "applies": [{"condition": "prone"}], ...}`
です。
これを使うルールセットにはCapability API 1.725が必要です。

特定の条件に当てはまる標的への攻撃です(Capability API 1.726)。
`to`が`"attacks"`または`"damage"`の修正値は、
`from`と同じ標的の条件である`"at"`を持てます。
その変更は、
その条件に当てはまる標的に対する持ち主自身の攻撃またはダメージだけに及びます。
5eのDemon Armorは`{"to": "attacks", "mode": "disadvantage", "at": {"tags": ["demon"]}}`
です。
これを使うルールセットにはCapability API 1.726が必要です。

クリーチャーのアクションの維持です(Capability API 1.727)。
クリーチャーのアクションは、
カタログのエントリーの`mechanics`と同じように(1.431)、
`"sustains": {"budget": "bonus"}`を持てます。
クリーチャーに付与したものが付いていれば、
以降の自身のターンにその行動枠を使って維持し、
付与したもののラウンド数を最初から数え直します。
セーヴも、
ほかの消費もありません。
このアクションは、
何ラウンドか続く状態を付与します。
5eのハーピーのLuring Songがこれにあたります。
これを使うルールセットにはCapability API 1.727が必要です。

クリーチャーのアクションで設置する壁です(Capability API 1.728)。
クリーチャーのアクションの`area`は、
カタログのエントリーと同じように(1.177)、
`"wall"`にできます。
長さが`size`、
厚さが`width`で、
`ring`があれば、
代わりにその直径の輪として設置でき、
`ringOnly`なら常に輪になります。
壁は必ずその場に残るため、
アクションは`zone`を持ちます。
このゾーンは`block`で遮ったり、
`sections`で区画に分かれたり(1.200)、
アクション自身のセーヴを使って壊れた区画の効果を及ぼしたりでき、
設置した場所に留まります。
5eのアイス・デヴィルのWall of Iceは、
長さ
30フィートまたは直径
20フィートのドームで、
各区画はAC 5、
体力
30を持ち、
火からより大きな被害を受け、
壊れた区画には極寒の空気が残ります。
これを使うルールセットにはCapability API 1.728が必要です。

派生値の上限拡大です(Capability API 1.729)。
シートに指定できる`derived`値は、
400から最大
800に増えました。
5eの鎧の訓練に必要な数が以前の上限を超えたためです。
400を超えて宣言するルールセットにはCapability API 1.729が必要です。

独自のレベルで発動するアイテムの使用と、
応答したものを止める使用です(Capability API 1.730)。
アイテムの`use`は、
スクロールの呪文のように、
発動時の`level`を指定できます。
エントリーが支払った段階を読むものはすべてこの値を読み、
リアクションの`"upTo": "paid"`もその一つです。
また、
`"utility"`の使用は、
カタログのエントリーのCounterspellと同じ`upTo`と`above`を持つ(1.116)、
`cancels`を指定した`reaction`だけにできます。
5eのCounterspellのスクロールである`{"kind": "utility", "budget": "reaction", "consumes": true, "level": 3, "reaction": {"on": "used", "cancels": true, "against": {"catalogs": ["spells"]}, "upTo": "paid", "above": {"check": {"abilityModFromField": "spellcasting_ability"}, "dc": 10}}}`
は、
3レベル以下の呪文を無条件に止め、
それより高い呪文は、
読む者が
10に呪文のレベルを加えた値に対する判定に成功すると止めます。
`"upTo": "paid"`を持つアイテムの使用は`level`を持ちます。
どちらかを使うルールセットにはCapability API 1.730が必要です。

値を列挙するビルダーのステップのフィルターです(Capability API 1.731)。
ガイド付きビルダーの`catalog`ステップの`filters`は、
フィルターに最大
12個の値のリストを指定でき、
そのいずれかに一致するエントリーが提示されます。
5eのバードのMagical Secretsで、
すべてのクラスの呪文または初級呪文を選べるようにするなら、
`{"kind": ["spell", "cantrip"]}`でカタログのほかの種類を除外します。
これを使うルールセットにはCapability API 1.731が必要です。

アイテムの残量がある間だけ働く効果です(Capability API 1.732)。
アイテムの`worn`または`carried`効果は、
`"whileLeft"`に最大
4行の`{"keys": [...], "charges": true}`または`{"keys": [...], "uses": "<a further use's label>"}`
を指定できます。
`keys`で指定した効果の部分は、
アイテムのチャージが残っている間、
または独自の使用回数を数える(1.519)その追加の使用に残り回数がある間だけ働きます。
シートではスタックが保持する残量を読み、
戦闘中は戦闘で消費した後の残量を読みます。
5eのHelm of Brillianceの`[{"keys": ["resist"], "uses": "Wall of Fire"}, {"keys": ["keepsOn"], "charges": true}]`
は、
ルビーが残っている間の火への抵抗と、
ダイヤモンドが残っている間のアンデッドを焼く光です。
これを使うルールセットにはCapability API 1.732が必要です。

呼び出し手とともに終了する、
エントリーまたはアイテムによる呼び出しです(Capability API 1.733)。
カタログのエントリーまたはアイテムの`calls`は、
クリーチャーの呼び出しと同じように(1.446)、
`"endsWithCaller": true`を指定できます。
呼び出された者は、
呼び出し手が戦闘から脱落するとすぐに去ります。
`"incapacitated"`なら、
呼び出し手がダウンするか、
`cannot-act`を持つ何かが付与されても、
すぐに去らせます。
5eのFeather Token (whip)の「無力状態になるか死亡すると消滅する」は、
`{"calls": {"creature": "monsters/feather_whip", "count": {"flat": 1}, "rounds": 600, "endsWithCaller": "incapacitated"}}`
です。
どちらかを使うルールセットにはCapability API 1.733が必要です。

理解されずに理解することです(Capability API 1.734)。
戦闘の状態の`languages`は`"understands"`にできます。
持ち主はあらゆる言語を理解するため、
標的が使用者を理解できることを必要とするアクション(`targetTypes.understands`)が持ち主にも届きますが、
これによって持ち主の言葉を理解できる者が増えることはありません。
`"all"`(1.648)はこれに優先し、
`"none"`は両方に優先します。
5eのComprehend Languagesと、
Helm of Comprehending Languagesによるその発動がこれにあたります。
これを使うルールセットにはCapability API 1.734が必要です。

騎乗されている間のオーラです(Capability API 1.735)。
状態のオーラは`"whileRidden": true`を指定できます。
誰かが持ち主に騎乗している間だけ広がり、
`side`は乗り手のものを読み取るため、
`"enemies"`は乗り手の敵です。
5eのgoat of terrorに`keepsOn`で付けたままにするオーラは、
`{"distance": 30, "side": "enemies", "whileRidden": true, "save": {"save": "wis_save", "difficulty": 15, "applies": [{"condition": "frightened", "duration": {"rounds": 10}}]}}`
です。
これを使うルールセットにはCapability API 1.735が必要です。

アクションで指揮する呼び出しです(Capability API 1.736)。
クリーチャーのアクションの`calls`は、
同じクリーチャーのアクションの一つを指定する`"commandedBy": {"action": "multiattack"}`を持てます。
呼び出されたクリーチャーは、
自身の前回のターン以降に呼び出し手がそのアクションを使っていた場合だけ自身のターンに行動し、
それ以外はターンを飛ばします。
クリーチャーの呼び出しでも`"endsWithCaller": "incapacitated"`を指定でき、
呼び出し手が無力状態になるか死亡すると、
呼び出されたクリーチャーを去らせます。
カタログの呼び出しでは
1.733から可能だったものです。
`commandedBy`は`commandedWith`と併用できません。
5eのチェイン・デヴィルのAnimate ChainsがMultiattackを通じてしか行動しないことは、
`{"calls": {"creature": "animated-chain", "count": 4, "initiative": "after", "commandedBy": {"action": "multiattack"}, "endsWithCaller": "incapacitated"}}`
で表します。
これを使うルールセットにはCapability API 1.736が必要です。

武器のボーナスを防御に移すことです(Capability API 1.737)。
アイテムの`attack`は`"bonusToDefense": {"upTo": 3}`を持てます。
使い手は、
そのターンにその武器で初めて攻撃する前に、
コストなしでボーナスの
1から`upTo`までを自身の防御に移せます。
各量が独立した切り替えになります(`label`が名前を指定し、
デフォルトではアイテム名です)。
そのターン、
その武器の攻撃は命中とダメージから同じ量を失い、
使い手の防御は次の自身のターン開始までその量を保ちます。
5eの+3武器であるDefenderは、
`{"attack": {..., "toHit": {..., "bonus": 3}, "damage": {..., "bonus": 3}, "bonusToDefense": {"upTo": 3, "label": "Defender"}}}`
です。
これを使うルールセットにはCapability API 1.737が必要です。

特定の標的に対するエントリーの攻撃です(Capability API 1.738)。
カタログのエントリーの`mechanics`またはアイテムの`use`は、
武器の`attack`と同じように(1.187)、
`against`を持てます。
最大
4個の`{"is", "marked", "toHit", "mode", "ignoresCover", "ignoresLongRange"}`で、
一致する標的への攻撃ロールを変更します。
5eのShocking Graspが金属を身に着けた標的に対して有利になることは、
`{"against": [{"is": {"wears": {"tags": ["metal"]}}, "mode": "advantage"}]}`で表しま
す(1.711の`wears`は、
金属の武器も含め、
シート上で着用しているものや手に持っているものすべてを読み取ります)。
これを使うルールセットにはCapability API 1.738が必要です。

呼び出しによって貸し与えられる武
器です(Capability API 1.739)。
`calls`を持つアイテムの`use`
(または`moreUses`の一
つ)は、
`"wieldsWhileCalled": {"items": ["gear/goat-horn-lance", "gear/goat-horn-longsword"], "takes": "action"}`
を持てます。
ルールセットの武器(`attack`
を持つアイテム)を最大
4個指定でき、
その使用で呼び出されたクリーチャ
ーが立っている間だけ使用者が使え
ます。
`takes`があれば、
各武器はまずその行動枠で手に取り
ます(「Take」の切り替え)。
取り外した元のクリーチャーが立っ
ている間、
その武器を使えます。
スロットを占めず、
インベントリーにも書き込まれませ
ん。
5eのFigurine of Wondrous Power
のgoat of terrorが
これにあたります。
この山羊には自身の攻撃がなく、
角は+1のランスと+2のロングソ
ードで、
一本取り外すのにアクションを使い、
元の姿に戻ると消えます。
これを使うルールセットにはCapability API 1.739
が必要です。

付与する者がすでに誰かに付与していなければ付与する状態です(Capability API 1.740)。
`applies`のエントリーは、
アクション自身のものと同じように(1.715)、
`"unlessImposing": ["grappled"]`を持てます。
付与する者が、
そのリストの状態を誰にも付与していない間だけ付与され、
同じリスト内でそれを`endsWith`に指定するものも、
同じ条件を満たさなければ付与されません。
5eのチェイン・デヴィルのChainの「デヴィルがすでにクリーチャーを掴んでいなければ、
掴まれた状態(脱出DC 14)になる」は、
拘束状態の`endsWith`に掴まれた状態を指定し、
`[{"condition": "grappled", "unlessImposing": ["grappled"], ...}, {"condition": "restrained", "endsWith": "grappled", ...}]`
で表します。
これを使うルールセットにはCapability API 1.740が必要です。

作り手が無力状態になると終了する範囲です(Capability API 1.741)。
カタログのエントリーまたはクリーチャーのアクションの`zone`は、
`"endsWithCaller": "incapacitated"`を指定できます。
ラウンド数が尽きた場合に加え、
作り手がダウンするか、
戦闘から脱落するか、
`cannot-act`を持つ何かが付与されると、
すぐに終了します。
`outlasts`とは併用できません。
5eのアイス・デヴィルのWall of Iceの「デヴィルが無力状態になるか死亡するまで」がこれにあたります。
これを使うルールセットにはCapability API 1.741が必要です。

使い切ると終了する呼び出しです(Capability API 1.742)。
カタログのエントリーまたはアイテムの使用の`calls`は、
`"endsWhenSpent": true`を指定できます。
呼び出された者は、
`uses`を数える自身のすべてのアクションに残り回数がなくなると去り、
アイテムに変わっていたなら(`becomesItem`、
1.613)、
そのアイテムは持ち主の手に戻ります。
5eのDancing Swordの「浮遊する剣が四回目の攻撃をした後」は、
浮遊する剣の攻撃に`"uses": {"per": "encounter", "count": 4}`を指定して表します。
これを使うルールセットにはCapability API 1.742が必要です。

感覚の上限拡大です(Capability API 1.743)。
`combat.senses`で指定できる感覚は、
8個から最大
12個になりました。
5eのRing of X-ray Visionが九番目の感覚です。
8個を超えるルールセットにはCapability API 1.743が必要です。

休息する前にアイテムを再び使うコストです(Capability API 1.744)。
アイテムの`use`は`againBeforeRest`を指定できます。
回数をリセットする`rests`、
`save`(`save`、
`difficulty`)、
セーヴに失敗すると使用者に起こることとして、
移動する`tracks`(それぞれ`track`と`by`)と付与する`conditions`の片方または両方を指定します。
それらの休息のいずれかを取った後の最初の使用にはコストがなく、
それ以降の使用は毎回セーヴを求めます。
回数は戦闘中も戦闘外もアイテムのスタックに保持され、
指定した休息によってリセットされます。
セーヴでダイスを振るのは、
判定がダイスの合計を使う場合だけです。
5eのRing of X-ray Visionは、
`{"rests": ["long"], "save": {"save": "con_save", "difficulty": 15}, "tracks": [{"track": "exhaustion", "by": 1}]}`
です。
これを使うルールセットにはCapability API 1.744が必要です。

アイテムの使用で作るアイテムです(Capability API 1.745)。
アイテムの`use`は、
カタログのエントリーの仕組みと同じように(1.721)、
`makesItems`(`item`、
`count`)を指定できます。
戦闘中に使うと、
その数のアイテムが使用者の手に入り、
ほかの手に持つアイテムと同じようにその場で使用でき、
戦闘終了時にインベントリーに書き込まれます。
戦闘外で使うと、
使ったアイテムと同じインベントリーに直接入ります。
Goodberryのスクロールは`{"item": "gear/goodberry", "count": 10}`です。
これを使うルールセットにはCapability API 1.745が必要です。

スタックごとにダイスで決める追加の使用の回数です(Capability API 1.746)。
アイテムは`moreUsesRolled`に`dice`と`weights`を指定できます。
`moreUses`の各使用はそれぞれ自身の`uses`を数え、
その順番で各使用に一つずつ重みを指定します。
各スタックは`dice`で決まる数の部品を持つように作られ、
各部品は重みの比率に応じた確率で追加の使用のいずれかに割り当てられます。
各追加の使用は、
割り当てられた部品の数だけ使用回数を持ちます(`max`を超えることはなく、
部品がなければ回数もなく、
その使用は提示されません)。
スタックのIDから一度だけダイスを振り、
どの読み取りでも同じ結果になります。
`uses.recharge`は、
その回数を回復します。
5eのNecklace of Prayer Beadsの、
六種類からなる
1d4 + 2個のビーズは`{"dice": "1d4+2", "weights": [6, 6, 4, 2, 1, 1]}`で、
各種類は`{"max": 6, "recharge": {"rests": ["long"], "amount": "max"}}`を持つ追加の使用です。
これを使うルールセットにはCapability API 1.746が必要です。

ほかの使用の回数を消費する追加の使用です(Capability API 1.747)。
アイテムの`moreUses`の一つは、
自身の`uses`を数えるほかの追加の使用のラベルを`usesOf`に指定し、
自身の`uses`を持たないようにできます。
その使用に残り回数がある間だけ提示され、
戦闘中も戦闘外も、
その回数を消費します。
`moreUsesRolled`では重みを
0にします。
5eのNecklace of Prayer Beadsのbead of curingなら、
`Cure Wounds`はビーズの`uses`を持ち、
`Lesser Restoration`は`"usesOf": "Cure Wounds"`を持ちます。
これを使うルールセットにはCapability API 1.747が必要です。

カタログから読み取っ
た候補の中からダイス
で決める呼び出しです
(Capability API 1.748)。
`from`を持つ呼
び出し(`calls`)
は、
`"rolled": true`
を指定できます。
使用時に、
読み取ったクリーチャ
ーのうち一体が等しい
確率で使用者のために
選ばれ、
使用者自身では選びま
せん。
`keepsRoll`
と`lifetimeUses`
は、
ダイスで決める`options`
と同じように働きます。
`rounds`がな
ければ、
退去させられるか戦闘
から脱落するまで留ま
ります。
5eのNecklace of Prayer Beads
のbead of summons
による、
神格が選ぶPlanar Ally
は、
`{"from": {"catalog": "creatures", "filters": {"type": ["celestial", "elemental", "fiend"]}}, "count": {"flat": 1}, "rolled": true}`
です。
これを使うルールセッ
トにはCapability API 1.748
が必要です。

追加の使用だけを持つアイテムです(Capability API 1.749)。
`moreUsesRolled`を持つアイテムは、
自身の`use`を持たないようにできます。
戦闘中も戦闘外も、
そのメニューには追加の使用だけが並び、
スタックのダイスの結果で回数がなくなった追加の使用は提示されません。
5eのNecklace of Prayer Beadsがこれにあたり、
すべてのビーズが追加の使用の一つです。
これを使うルールセットにはCapability API 1.749が必要です。

日数経過で行い、
成功回数を数えて被害を与えるセーヴと、
回復を妨げるダメージです(Capability API 1.750)。
`"at": "days"`を持つ`saveEnds`は、
`successes`(2から
10)を指定できます。
状態はその回数だけセーヴに成功して初めて終了し、
持ち主のシートで日をまたいで成功回数を数えます(失敗しても何もリセットしません)。
`harmsOnFail: { "dice", "flat", "type" }`も指定でき、
各日のセーヴに失敗するたびに持ち主の体力にその被害を与えます。
`keepsDamage: true`を指定した戦闘の状態は、
自身が与えたもの(`harms`と日ごとのセーヴによる被害)が、
その状態が続く間は回復しないようにします。
そのダメージは持ち主の体力の最大値を下げ、
どのように終了したかにかかわらず、
状態が終了するまでは回復や休息で取り戻せません。
戦闘中のステータスブロックの体力も同じように保持されます。
5eのPale tinctureは、
付与するものに`"saveEnds": { "save": "con_save", "at": "days", "days": 1, "successes": 7, "harmsOnFail": { "dice": "1d6", "type": "poison" } }`
を指定し、
状態に`keepsDamage`を指定します。
どちらかを使うルールセットにはCapability API 1.750が必要です。

真夜中まで続く状態と、
セーヴ成功で半減する終了時の被害です(Capability API 1.751)。
付与した状態の`lastsDays`は`"midnight"`にできます。
戦闘中は時計を持たず、
戦闘終了時にもシートに残っている場合(または戦闘外でアイテムの使用により付与した場合)、
シートで次に一日を`pass`すると終了します。
`onEnd.harm`は`save: { "save", "difficulty", "onSuccess": "half" }`を指定でき、
戦闘中も日数経過時も、
被害を受ける際に持ち主がダイスを振り、
成功すると半分になります。
戦闘外では、
`onEnd.when`が許すとおり、
日数が尽きたとき(`expired`)、
または日ごとのセーヴで状態が終了したとき(`save`)に、
終了時の被害を与えます。
治療で被害を与えることはなく、
`when: ["expired"]`なら戦闘中の治療でも被害を与えません。
5eのMidnight tearsは、
`"lastsDays": "midnight"`に`"onEnd": { "harm": { "dice": "9d6", "type": "poison", "save": { "save": "con_save", "difficulty": 17, "onSuccess": "half" } }, "when": ["expired"] }`
を組み合わせます。
どちらかを使うルールセットにはCapability API 1.751が必要です。

目的を指定して行う判定で
す(Capability API 1.752)。
`checks`の修正値
は`for: ["climb", "swim"]`
を指定できます。
変更するのはGame Master
のタグが`for="climb"`
または`for="swim"`
と指定した判定だけです(
大文字と小文字は区別しま
せん)。
同じスキルでもほかの目的
で振るものや、
そのような目的を持たない
戦闘自身の判定(掴みや突
き飛ばし)には適用しませ
ん。
Game Masterに
は、
ルールセットの状態とカタ
ログが指定するすべての目
的が伝えられ、
記録には`for=`が保
持されます。
5eのGloves of Swimming and Climbing
は、
着用中の効果として`{ "to": "checks", "skills": ["athletics"], "flat": 5, "for": ["climb", "swim"] }`
を指定します。
これを使うルールセットに
はCapability API 1.752
が必要です。

Forbiddanceの選択と、
内部への瞬間移動の禁止です(Capability API 1.753)。
ゾーンの`forbids.teleport`は`"into"`にできます。
ゾーンが誰に効果を及ぼすかにかかわらず、
誰もその内部へ瞬間移動できませんが、
内部での瞬間移動や外への瞬間移動は引き続き許され、
同行する者も内部には置かれません。
ゾーンを持つエントリー(またはアイテムの使用)は`"kindChoice": "many"`を指定できます。
使用者は発動時に、
`combat.creatureTypes`の種類とタグを一つ以上指定します。
`targetTypes.is`が候補を指定していれば、
その中から選びます(Forbiddanceでは五種類です)(選択肢は候補を`kindsOf`として列挙し、
選択は選んだものを`kinds`として指定します)。
ゾーンは`targetTypes`で指定した種類の代わりに、
選んだものだけを攻撃します。
何も指定しなければ、
`targetTypes`が指定する者を攻撃します。
ダメージを与えるエントリーは、
`"damageTypeChoice"`にルールセットのダメージ種別を二つから八つ指定できます。
それらはモード(`damage-<type>`)として提示され、
選んだ種別が、
エントリー自身とそのゾーンの打撃が与えるダメージ種別になります。
ほかのモードと同じように選ぶため、
モードとして行うほかの選択とは併用できず、
戦闘中に何も選ばず発動すると最初の種別のダメージを与えます。
戦闘前に準備する場合、
Game Masterの`standing`は種類を`"kinds": [names]`、
ダメージ種別を`"mode"`として指定します。
ダメージ種別を指定しなければ最初のものを使い、
そのことが伝えられます。
5eのForbiddanceは、
`"kindChoice": "many"`、
`"damageTypeChoice": ["radiant", "necrotic"]`、
`"targetTypes": { "is": { "types": ["celestial", "elemental", "fey", "fiend", "undead"] } }`
に、
`"forbids": { "teleport": "into" }`を持つゾーンを組み合わせます。
いずれかを使うルールセットにはCapability API 1.753が必要です。

最大
16個のアクションを持つクリーチャーです(Capability API 1.754)。
ベスティアリのクリーチャーと、
クリーチャーのシートのブロックが持てるアクションは、
以前の
12個から最大
16個になりました。
5eのヴァンパイアが、
自身の形態に加えて蝙蝠と霧の形態を持つ例がこれにあたります。
12個を超えるアクションを持つクリーチャーがいるルールセットにはCapability API 1.754が必要です。

立っている場所を調べる標的の条件です(Capability API 1.755)。
標的の条件(`targetIs`、
`targetTypes.is`または`not`、
および標的の条件を読み取るほかのすべての場所)は、
`insideZoneOf`または`outsideZoneOf`
を指定できます。
エントリーをID(`magic-circle`または`spells/magic-circle`)
または名前で、
最大
8個指定します。
`insideZoneOf`は、
誰が発動したかにかかわらず、
そのいずれかが残したゾーン内に立つ者だけに一致し、
`outsideZoneOf`はそのいずれのゾーン内にも立っ
ていない者だけに一致します。
どちらも`except`と`anyOf`の中にも指定できます。
戦闘外では、
誰もゾーン内に立っていません。
5eのMagic Jarで「protection from evil and good
またはmagic circleの呪文で防護されている」クリー
チャーに憑依できないことは、
`{"outsideZoneOf": ["magic-circle"], "except": {"holding": ["protected_from_evil"]}}`
で表します。
これを使うルールセットにはCapability API 1.755
が必要です。

Wishの負担です(Capability API 1.756)。
状態の`abilities`は、
ほかのすべての変更を適用した後で、
能力値が指定値より高い場合だけその値まで下げる`{"atMost": 3}`を指定できます(複数あれば最も低い値を使います)。
能力値を上げることはありません。
付与した状態の`lastsDays`は、
付与時に`{"dice": "2d4"}`でダイスを振って決められ、
`restingCounts`(2から
7)があれば、
持ち主が休息して過ごした日はそれぞれその日数分として数えます。
Game Masterの`[sheet: op="pass" days="N" resting="yes"]`で、
それらの日を休息して過ごしたと指定します。
5eのWishの負担の「筋力は、
すでに
3以下でなければ、
2d4日の間
3に下がります。
その期間中に休息し、
軽い活動より激しいことをせずに過ごした日は、
その日ごとに残りの回復期間が
2日短くなります」は、
`"abilities": {"str": {"atMost": 3}}`を持つ状態を、
`"duration": "until-dispelled", "lastsDays": {"dice": "2d4", "restingCounts": 2}`
で付与して表します。
どちらかを使うルールセットにはCapability API 1.756が必要です。

失った分をすべて回復することです(Capability API 1.757)。
`healsAll: true`を持つ`heal`は、
指定した`amount`にかかわらず(指定する必要もありません)、
各標的が失っている体力をすべて回復します。
回復量を分け合ったり(`sharesHeal`)、
使用回数に応じて回復したり(`usesChosen`)することはありません。
5eのWishの「見える範囲の最大二十体のクリーチャーのヒットポイントがすべて回復する」がこれにあたります。
これを使うルールセットにはCapability API 1.757が必要です。

発動時に選ぶ防護です(Capability API 1.758)。
`applies`を持つエントリーは、
`wardPick: true`を指定できます。
使用時に、
使用者は戦闘中の誰かが持つエントリーまたはクリーチャーのアクションを一つ選びます(掴みなど、
誰もが持つ対抗判定は含みません)。
付与する各状態は、
選んだその一つだけから持ち主を防護し、
持ち主自身以外の誰がどのレベルで使った場合にも働きます。
エントリーは`<catalog>/<entry>`で指定し、
エントリーを持たないクリーチャーのアクションは、
小文字の`action:<its name>`で指定します。
メニューはそれらを、
必ず一つだけ選ぶ選択として提示します(選択の`kinds`にIDを一つ指定します)。
クリーチャー自身が選ぶ場合は最初のものを取ります。
`until-dispelled`で付与した状態は、
何から防護するかを持ち主のシートに保持し、
その後の戦闘でも使います。
5eのWishの「見える範囲の最大十体のクリーチャーに、
単一の呪文またはほかの魔法効果に対する完全耐性を
8時間与える」(リッチの生命力吸収など)は、
`{"kind": "buff", "targets": "ally", "wardPick": true, "applies": [{"condition": "wished_ward", "duration": {"rounds": 4800}}]}`
です。
これを使うルールセットにはCapability API 1.758が必要です。

素材ごとに指定した厚さまでの透視
です(Capability API 1.759)。
感覚の`throughWalls`
は、
`true`の代わりに、
各素材を何インチまで見通せるかと
いう最大値を指定できます(素材は
1から
16種類、
それぞれ
1から
1200インチ)。
射線上の壁は素材ごとに厚さを合計
し、
指定していない素材は透視を遮りま
す。
発動によって作られた視界を遮る壁
は、
`material`に`{"of": "stone", "inches": 6}`
を指定できます。
盤面自身の壁(壁や山のタイル、
視界を遮る小道具、
間にある隆起した地面)は、
`combat.sight.boardWalls`
が指定する素材と厚さになり、
各マスがその厚さを持ちます。
たとえば`{"of": "stone", "inches": 60}`
です。
これを指定していない場合や、
発動によって作られた壁に素材が指
定されていない場合、
このような感覚ではそれらを見通せ
ません。
5eのRing of X-ray Vision
の「石は
1フィート、
一般的な金属は
1インチ、
木や土は最大
3フィートまで見通せます。
それより厚い物質は視界を遮り、
薄い鉛の板も同様です」は、
鉛を指定せずに`"throughWalls": {"stone": 12, "metal": 1, "wood": 36, "dirt": 36}`
で表します。
Wall of Stoneは`{"of": "stone", "inches": 6}`、
Wall of Ironは`{"of": "metal", "inches": 1}`
です。
いずれかを使うルールセットにはCapability API 1.759
が必要です。

作られたものが消えるまでの持続時間です(Capability API 1.760)。
`makesItems`は、
作るものがどれだけ`lasts`かを、
ゲーム内時間の分で指定できます(1から
5256000、
十年)。
指定例は`"lasts": [{"minutes": 60}]`です。
作られたものは独立したスタックになり、
ほかのスタックを補充せず、
補充されることもなく、
時間が尽きるとインベントリーから消え、
「Items vanished」の行が表示されます。
戦闘中は、
`combat.roundSeconds`(未指定なら
6秒)に従って作り手のターンで時間を数え、
戦闘終了時の残り時間はスタックに保持されます。
複数の`lasts`を指定し、
それぞれに`label`を持たせると、
使用者が使用時に一つ選びます。
発動時はそれぞれ独立した選択肢になり、
インベントリーから使うアイテムにはそれぞれのボタンが付きます。
5eのCreationは`"lasts": [{"label": "Vegetable matter", "minutes": 1440}, {"label": "Stone or crystal", "minutes": 720}, {"label": "Precious metals", "minutes": 60}, {"label": "Gems", "minutes": 10}, {"label": "Adamantine or mithral", "minutes": 1}]`
です。
ルールセットがあれば、
Game Masterも`[inventory: action="add" item="Rope" lasts="1 hour"]`でそのようなアイテムを追加で
きます(分、
時間、
日、
週を使えます)。
`lasts`を使うルールセットにはCapability API 1.760が必要です。

クリーチャーが戦闘でどれだけ考えるかです(Capability API 1.761)。
Engineは、
ほかの誰も操作しないすべてのクリーチャーを、
五つの思考のいずれかで操作します。
`mindless`は最も近い者に向かって攻撃し続け、
ターンの間には離れて歩く者への打撃以外は行わず、
決して後退しません。
`instinct`は本能に従って弱い者から攻撃し、
傷を負うと自身の安全を気にかけ、
計画を立てる性格を持ちません。
`cunning`は基本を理解しています。
`tactical`は戦況を考えて行動します。
`genius`は常に熟練者以上の最善の戦い方をします。
クリーチャーの思考は、
自身のステータスブロックの`mind`、
なければ種類のもの(`combat.creatureTypes.types[].mind`)、
それもなければ`combat.minds.ability`の評価値が達する段階(`tiers`を昇順に並べ、
それぞれ`{"atLeast": n, "mind": ...}`で指定します)で決まります。
伝説的アクションを行うか、
伝説的抵抗を持つ者は、
通常なら`tactical`となる場合に`genius`になります。
何も指定していなければ、
種類が`beast`のクリーチャーは本能で戦い、
`construct`または`ooze`は思考を持たず、
それ以外は従来どおりに行動します。
Game Masterは、
戦闘ごとに思考を指定することもできます。
5eでは、
`"minds": {"ability": "int", "tiers": [{"atLeast": 0, "mind": "mindless"}, {"atLeast": 3, "mind": "cunning"}, {"atLeast": 8, "mind": "tactical"}, {"atLeast": 15, "mind": "genius"}]}`
とし、
野獣を`instinct`、
人造と粘体を`mindless`にし、
ゾンビやスケルトンには独自の`"mind": "mindless"`を指定します。
これにより、
クラーケン(知力
22)は天才になります。
思考にかかわらず、
Engineは、
マスに立つことで生じる危険、
相手に狙われている傷ついた味方を守ること、
自分の側がすでに狙っている者を攻撃することも評価します。
慎重、
臆病、
忍耐強いクリーチャーや傷ついた動物は、
回避、
逃走(`disengage`の後に走る)、
隠れることを、
攻撃と比較して評価します。
`tactical`または`genius`の者は、
応答に必要なものを残します。
自身が持つリアクション(CounterspellやShield)の支払いにまだ使える最後のスロット、
使用回数、
プールの消費には慎重です。
次の自身のターンまでに歩いて近づいて打撃を加えられる相手がいなければ、
小さなダメージを与える攻撃よりも、
持続する支援(Shield of FaithやMage Armor)を自身または味方に付与することを優先します。
遠方から攻撃した後(射程を持ち、
自身の間合いを持たない打撃で、
弓や呪文は含み、
投げるダガーは含みません)、
途中で打撃を受けず、
相手がまだ射程内にいる最も安全なマスまで後退します。
少しでも思考するクリーチャーは、
まだ射撃できる相手に歩いて近づくことはせず、
撃った場所に留まります。
`mind`または`combat.minds`を使うルールセットにはCapability API 1.761が必要です。

戦意の喪失です(Capability API 1.762)。
`combat.morale`は、
Engineが操作するクリーチャーが戦意を保てるかを、
いつ、
どのように判定するかを指定します。
`on`の各項目は、
それが起きた後の自身のターン開始時に、
クリーチャーごとに一度判定します。
`first-fall`は自分の側の誰かが倒れた後、
`half-down`は自分の側の半数が倒れた後、
`leader-down`はステータスブロックに`"leader": true`を持つ自分の側のクリーチャーが倒れた後、
`hurt`は自身の体力が最大値に対する`hurtBelow`の割合(未指定なら半分)を下回った後です。
`check`は、
クリーチャーのステータスブロックの`morale`評価値に対してダイスを振り(`{"roll": "2d6", "score": 7}`で、
評価値がないクリーチャーには`score`を使います)、
出目が評価値を超えると戦意を失う方法か、
セーヴを行い(`{"save": "wis_save", "difficulty": 10}`)、
失敗すると戦意を失う方法のいずれかです。
判定するのはステータスブロックを持つクリーチャーだけで、
思考を持たない者、
召喚された者や呼び出された者、
`unlessImmune`が指定する状態に完全耐性を持つ者は判定しません。
戦意を失った者は逃げます。
隣の相手から離脱し(それ以外は早足移動し)、
最も近い盤面の端に向かって走り、
そこで自身の次のターンが始まると戦闘を離れます。
盤面がなければすぐに離れます。
戦闘の要約には、
逃げ切ったことが示されます。
思考が`surrenders`に含まれ、
相手が隣にいれば、
代わりに降伏し、
生きたまま戦闘から脱落し、
Game Masterにはパーティーの捕虜になったことが伝えられます。
Old-School Essentialsでは、
各クリーチャーの`morale`とともに`{"check": {"roll": "2d6"}, "on": ["first-fall", "half-down"]}`
を指定します。
5e(Dungeon Master's Guideの選択ルール)では、
`{"check": {"save": "wis_save", "difficulty": 10}, "on": ["leader-down", "hurt"], "surrenders": ["cunning", "tactical", "genius"], "unlessImmune": "frightened"}`
です。
狂乱やRötschreckのような、
状態によって強制される行動は、
その状態自身の`behavior`で指定します(`nearest`、
`walks`を伴う`moves: "away"`)。
`combat.morale`、
またはステータスブロックの`morale`や`leader`を使うルールセットにはCapability API 1.762が必要です。
Capability API 1.775以降では、
`on`に`surprised`と`helpless`も指定できます。
前者は不意を突かれた状態でターンを開始すると判定し、
後者は相手側に被害を与える方法がない状態で自身のターンを開始すると一度判定します(相手に向けられるメニューの項目が、
掴みや突き飛ばしなどの対抗判定しかない場合です)。
`"halfDownUnanswered": true`は、
相手側がまだ誰も失っていない間だけ`half-down`を数えます。
Dungeon Master's Guideの完全な指定は、
`{"check": {"save": "wis_save", "difficulty": 10}, "on": ["surprised", "hurt", "helpless", "leader-down", "half-down"], "halfDownUnanswered": true, "surrenders": ["cunning", "tactical", "genius"], "unlessImmune": "frightened"}`
です。
物語がその側のリーダーとして指定したクリーチャー(遭遇の`aiHints.leader`で、
どのベスティアリにも指定されていない山賊の首領など)も、
ステータスブロックの`leader`と同じように`leader-down`の対象になります。
`surprised`または`helpless`を指定するか、
`halfDownUnanswered`を使うルールセットにはCapability API 1.775が必要です。
`neverSurrender`は、
決して降伏しない`combat.creatureTypes`のクリーチャーの種類を指定します。
その種類の者は、
思考にかかわらず、
戦意を失うと必ず逃走します(5eでは`["undead", "fiend"]`)。
これを使うルールセットにはCapability API 1.785が必要です。

戦闘のポーズです(Capability API 1.786)。
`combat.poses`は、
何を祈りによって行うか、
何が持ち主を隠すかを指定します。
現在は戦闘画面の印に、
将来はイラストにも使うためのもので、
ルールがこれを読み取ることはありません。
`hidden`は、
持ち主を隠す、
現在付与されている状態を列挙します。
そのいずれかを持つか、
`combat.hiding`で隠れているパーティーメンバーにはHiddenの印が付き、
画面には忍び歩きをしていると伝えられます(相手側にはこの印を決して付けません)。
`divine`は、
祈りによって発動するものです。
誰が使うかにかかわらず、
シートの行の`column`に`values`のいずれかが入っている能力(大文字と小文字を区別せずに照合します)、
または`entries`(`catalog/entry`)のいずれかが該当します。
Channel Divinity、
退散、
Divine Intervention、
祈りと名付けられたものも、
祈りによって行います。
それらを使った戦闘参加者には、
次の自身のターン開始までPrayingの印が付き、
ログには「Corwin prays: Bless.」と表示されます。
5eでは、
`{ "hidden": ["invisible"], "divine": { "column": "class", "values": ["Cleric", "Paladin"] } }`
です。
`hidden`の各状態は、
ルールセットの状態のいずれかでなければなりません。
`combat.poses`を持つルールセットには
1.786が必要です。

5e特有の記述をさらに四つ表す設定です(Capability API 1.787)。
エントリーの`"fellsKill": true`(`damage`と併用します)は、
そのダメージで体力が
0になった者、
またはすでにその値だった者を即死させ、
瀕死のままにすることはありません。
1で持ちこたえた者(Death Ward)は生き残ります。
Disintegrateがこれにあたります。
クリーチャーのアクションの`"whileFlying": true`は、
クリーチャーが空中にいる間だけ提示され(盤面では地面を離れている場合、
盤面がなければ飛行中の場合、
または飛行しかできない場合)、
それを指定するシーケンスのステップも、
その間だけ実行されます。
ワイヴァーンの「飛行中は、
ほかの攻撃一回の代わりに爪を使える」は、
噛みつきと爪を使う二つ目のMultiattackに`whileFlying`を持たせて表します。
シーケンスの`"castsOne": true`は、
行動枠を再び消費せず、
そのクリーチャーの呪文発動の呪文のうち任意の一つを、
このターンに続けて発動できるようにします(使用回数とスロットは通常どおり消費し、
一つを発動するとほかは選べなくなります)。
グラブレズゥの「鋏で二回攻撃し、
呪文を一つ発動する」は、
鋏で二回攻撃する二つ目のMultiattackにこれを持たせて表します。
救済の`against`は、
`saves`の救済を、
宣言されたフィルターを読み取った値が`where`の指定と一致するエントリー(`{"filter": "school", "equals": "necromancy"}`)
に対するセーヴ、
または`fromTypes`(`combat.creatureTypes`のID)のいずれかの種類のクリーチャーが行うあらゆるものに対するセーヴに絞ります。
どちらか一方を満たせば十分です。
Scarab of Protectionは、
`{"where": {"filter": "school", "equals": "necromancy"}, "fromTypes": ["undead"]}`
です。
いずれかを使うルールセットには
1.787が必要です。

ビルダーのバッジ、
付与するエントリー、
戦闘外の回復、
アイテムの別名です(Capability API 1.788)。
`fields`のビルダーのステップの`unansweredAtDefault`は、
`default`のままであればバッジがまだ回答を待つフィールドを列挙します。
「まだ選択していない」をデフォルトが表す列挙型で、
5eの竜の祖先(`draconic_damage_type`、
デフォルトは`"none"`)がこれにあたります。
付与の`entries.add`は、
行を持つ別のカタログのエントリーを直接与えます。
`[{"catalog": "languages", "ids": ["common", "elvish"]}]`のように指定し、
その行は選択で得た行と同じように書き込まれ、
この方法で与えたエントリーを`entries.choose`が再び提示することはありません。
エルフの共通語とエルフ語や、
エルフの場合はエルフ語を除いて選ぶAcolyteの二つの言語がこれにあたります。
カタログは、
ビルダーのステップが読み取るものでなければなりません。
回復の`"outsideFight": true`(`"targets": "self"`と`amount`を併用します)は、
Game Masterがその回復を`[sheet: op="use"]`で使ったとき、
使用による消費に加え、
シート上の使用者も回復するようにします。
`amountAdd`を加えてダイスを振ります。
戦闘外でのSecond Windがこれにあたります。
アイテムのエントリーの`aliases`は、
そのアイテムを検索できる別名で、
名前からアイテムを探すあらゆる場所(店の購入タグ、
Game Masterのインベントリーのタグ)で、
全アイテムの本来の名前を調べた後に使われます。
Plate Armorなら`["Plate"]`です。
いずれかを使うルールセットには
1.788が必要です。

特性の`recovers`は、
`atRest`に休息を指定できます(Capability API 1.789)。
その休息が終わる際、
ゲーム内のシートがその特性の使用を提示します。
そのグループの消費済みプールが列挙され、
`upTo`以内に収まる最も高いものがあらかじめ選ばれています。
休息とともにその使用が行われ、
特性自身のカウンターを消費します。
5eのArcane RecoveryとNatural Recoveryは、
`"recovers": { "group": "slots", "upTo": { "derived": "arcane_recovery_levels" }, "most": 5, "atRest": "short" }`
です。
休息はルールセットが持つものの一つでなければならず、
アイテムの使用にこの指定は持たせられません。
これを使うルールセットには
1.789が必要です。

エントリーは、
`material`で価格のある物質を必要とするようにできます(Capability API 1.790)。
形式は`{ "label", "worth": { "amount", "unit" }, "items"?, "tags"?, "consumed"? }`で
す。
使用者は、
`items`(`"<catalog>/<entry>"`)のいずれか、
または`tags`のいずれかを持つアイテムを、
それぞれ自身の`cost`による価値の合計が`worth`になるだけ携帯していなければなりません。
焦点具や構成要素ポーチを含め、
ほかのものでは代用できず、
偽物が数えられることもありません。
シートから発動する場合、
戦闘中は十分な量を携帯している間だけ提示され、
戦闘外でGame Masterが`use`すると、
なければ`no-material: <label>`として拒否されます。
`"consumed": true`なら、
発動時に物質を消費します。
単独で足りるもののうち最も安いアイテムを一つ、
なければ最も高いものから、
十分な量を取るまでインベントリーから取り除きます。
5eのIdentifyは`"material": { "label": "a pearl worth at least 100 gp", "worth": { "amount": 100, "unit": "gp" }, "tags": ["pearl"] }`
です。
Revivifyは、
価値が
300 gpのダイヤモンドに`"consumed": true`を追加します。
単位はルールセットの通貨の一つでなければならず、
アイテムの使用にこの指定は持たせられず、
コストなしでそのエントリーを発動するアイテム、
クリーチャー、
ほかのエントリーはこの物質を必要としません。
これを使うルールセットには
1.790が必要です。

クリーチャーの戦い方です(Capability API 1.763)。
`behavior`は、
`mind`とは別に、
Engineが操作するクリーチャーの戦い方を指定します。
通常割り当てられるものを置き換える`temperament`(`reckless`、
`cautious`、
`opportunistic`、
`protective`、
`supportive`、
`disciplined`、
`cowardly`、
`patient`、
`methodical`、
`coordinated`、
`fanatical`(1.778)、
`arrogant`(1.780)、
`territorial`(1.781)、
`cruel`(1.782)、
`honourable`(1.783)、
`hungry`(1.784)のいずれか)と`role`(`bruiser`、
`bulwark`、
`skirmisher`、
`marksman`、
`spellcaster`、
`supporter`、
`controller`のいずれか)、
誰を優先して狙うかを指定する`targets`で、
`nearest`、
`weakest`、
`wounded`(体力が半分未満)、
`strongest`(最も危険)、
`casters`(呪文または保持中の呪文を持つ者)、
`healers`、
`attacker`(最後に自身に被害を与えた者)、
`concentrating`、
`leader`(ステータスブロックの`"leader": true`)から優先順に最大四つ、
`opens`で、
自身のアクションのIDまたはカタログのエントリー(`fireball`または`spells/fireball`)を最大四つ指定し、
最初の数ターンに、
その中で使用でき、
何らかの価値がある最初のものを一度使うこと、
`pack: true`で、
味方が隣に立っている者を狙うこと、
`ambush: true`で、
隠れられる場所に隠れ、
先に歩けばこのターン中に打撃を加えられる位置に相手が立つか、
自身が被害を受けるまで動かずに待ち、
その後は二度と待たないことを指定できます。
`behavior`は、
`combat`(すべてのクリーチャー)、
`combat.creatureTypes.types`のクリーチャーの種類、
クリーチャー自身のステータスブロックに置け、
各キーは前のものを上書きします。
Game Masterがその戦闘用に指定する性格は、
自身の性格に優先し、
思考を持たないクリーチャーにはこれらはいずれも適用されません。
5eでは、
狼は`{"targets": ["wounded"], "pack": true}`、
ゴブリンは`{"temperament": "cowardly", "targets": ["weakest"]}`、
若いドラゴンは`{"opens": ["fire_breath"]}`、
グールは`{"ambush": true}`、
メイジは`{"role": "controller", "targets": ["casters"]}`です。
このような`behavior`を使うルールセットにはCapability API 1.763が必要です。

各役割の行動です(戦闘AI A1)。
`bruiser`はただ戦います。
`bulwark`は味方を守ります。
相手を味方に近づけない行動を最も重視し、
相手に狙われている味方の隣で歩行を終えます。
`skirmisher`は、
とどめの打撃と自分の側の攻撃への加勢をより重視し、
すでに標的を攻撃している味方と標的を挟んだ向かい側から打撃を加えること(挟撃)を好みます。
近くで打撃を加えた後、
`skirmisher`(または`cautious`や`cowardly`のクリーチャー)は、
残りの歩行で再び離れます。
まだ行える離脱(ゴブリンのNimble Escape)があればそれを使い、
なければ打撃を誘発せずに到達できるマスだけに移動します。
`marksman`は、
立っている場所の危険をより気にかけます。
`spellcaster`は、
重要な場面のために最善の手を残し、
準備を整えることをより重視します。
`controller`は、
相手を動けなくすることを最も重視します。
`supporter`は支援をより重視し、
傷ついた者の近くに留まります。
`solo`(Capability API 1.776)は、
相手側全員と単独で戦います。
持つものを惜しまず使い、
打撃を受けることを気にしません。
データで`role`を指定していないクリーチャーは、
できることから役割を割り当てられます。
ターンの間に独自の行動を行える(`signaturePoints`)か、
伝説的抵抗を持つ者は`solo`、
ほかの者を回復する者は`supporter`、
術者は`controller`または`spellcaster`、
最も強い打撃が射撃なら`marksman`、
味方のためのリアクション(シールド・ガーディアンのShield)か、
打撃を受け流すもの(命中された際のリアクションで、
誰にも被害を与えず、
自身の`defense`を高める状態以外は何も付与しないもの。
5eのParryなど)を持つ者は`bulwark`、
無償の離脱か隠れ身(Nimble Escape)、
`flyby`を持つ付けたままの状態、
または味方より打撃が強くない一方で味方よりはるかに速い足を持つ者は`skirmisher`、
それ以外は`bruiser`です。
その役割を考慮して性格も割り当てられます。
役割に`solo`を指定するルールセットにはCapability API 1.776が必要です。

護衛です(Capability API 1.777)。
`behavior`は、
`guards`に、
`leader`(ステータスブロックの`"leader": true`、
または物語がその側のリーダーとして指定した者)、
`casters`(呪文を持つ者)、
`healers`(ほかの者を回復する者)から一つから三つを指定できます。
クリーチャーは、
指定した種類の、
まだ立っている最も近い味方から三マス以内に留まり、
その味方を狙っている者を優先して攻撃します。
保護を指示された仲間と同じです。
指定した種類の者が誰も残っていなければ、
通常どおり戦います。
継続的な命令なので、
思考を持たないクリーチャー(シールド・ガーディアン、
ゾンビ)も従い、
可能なら護衛対象を狙っている者に打撃を加えます。
5eでは、
貴族の護衛は`{"guards": ["leader"]}`、
狂信的なカルト信者の従者は`{"guards": ["casters"]}`です。
`guards`を使うルールセットにはCapability API 1.777が必要です。

リーダーです(戦闘AI A6、
Capabilityのマイナーバージョン指定なし)。
自分の側を率いるクリーチャー(ステータスブロックの`"leader": true`、
または物語が指定した者)は、
最初の二ラウンドに、
自分の側の複数の者を同時に助けるものを優先して使います(複数の標的または範囲を持つ味方向けの選択肢で、
鬨の声やBlessなどです。
または、
自分の側に届く`auras`を持つ状態を自身に付与するもの、
たとえば
5eのLeadershipです)。
その側は、
リーダーが最後に狙った者を優先して狙います。
また、
`combat.morale`を持つルールセットでは、
リーダーから六マス以内で戦闘から逃走中の同じ側の者はそれぞれ、
リーダーのターン開始時に立ち止まり、
次の自身のターンに再び気を強く持てるかを判定します。

狂信者(Capability API 1.778)。`behavior.temperament`が`fanatical`になることは偶然にはなく、クリーチャーのデータか物語で指定された場合だけです。どのような危険にさらされていても全力で攻撃し、自陣営のために踏みとどまり、`combat.morale`を判定することはなく、ClassicとTacticalの戦闘では士気の評価値を持ちません。`disciplined`のクリーチャー(マイナーバージョンの指定なし)は隊形を保ち、自陣営と同じ方向への移動を考慮し、リーダーが選んだ標的を攻撃し、自陣営で最初の者が倒れても(`first-fall`)動揺しません。5e: カルトの狂信者とその信者は`{"temperament": "fanatical"}`です。`fanatical`を指定するルールセットにはCapability API 1.778が必要です。

変わる性格(Capability API 1.779)。`behavior`には`shifts`を指定でき、`{"on": trigger, "to": temperament}`を一つから四つ、各トリガーを一度ずつ指定します。トリガーは`bloodied`(体力が半分未満)、`ally-down`(自陣営の誰かがダウンするか、いなくなる)、`leader-down`(自陣営のリーダーがダウンする)、`cornered`(体力が四分の一未満で、相手が隣にいて、逃げ場がない)です。自身の各ターンの開始時に、トリガーが発生している最初の指定に従って性格が変わります。これは戦闘ごとに一度だけで、その後は自身の`temperament`が適用されなくなります。Game Masterがその戦闘用に指定した`shifts`があれば、そちらを優先します。知性のないクリーチャーの性格は変わりません。5e: 傲慢なドラゴンは`{"temperament": "opportunistic", "shifts": [{"on": "bloodied", "to": "methodical"}]}`、追い詰められた山賊は`{"shifts": [{"on": "cornered", "to": "reckless"}]}`です。`shifts`を使うルールセットにはCapability API 1.779が必要です。

傲慢なクリーチャー(Capability API 1.780)。`behavior.temperament`が`arrogant`になることは偶然にはなく、クリーチャーのデータか物語で指定された場合だけです。ほとんど用心せず、下準備もせず、単独で相手陣営と戦っているときでさえ、コストの高い選択肢(呪文スロット、使用回数に制限のあるもの)を温存します。自身の`shifts`で別の指定がない限り、`bloodied`になるか、自陣営の誰かが倒れると(`ally-down`)、`methodical`に変わります。傲慢な(または以前は傲慢だった)クリーチャーが飛行でき、伝説的な存在(シグネチャーの技かLegendary Resistance(伝説的抵抗)を持つもの)であれば、体力が四分の一未満になると空に上がり、そこから戦い、誰かに歩いて近づくために降りてくることはありません。5e: 成体のレッド・ドラゴン、リッチ、ヴァンパイアは`{"temperament": "arrogant"}`です。性格または変化先の`to`として`arrogant`を指定するルールセットにはCapability API 1.780が必要です。

縄張りを守るクリーチャー(Capability API 1.781)。`behavior.temperament`が`territorial`になることは偶然にはなく、クリーチャーのデータか物語で指定された場合だけです。戦闘開始時に立っていた場所から`behavior.territory`マス以内(1～40、デフォルト: 6)にとどまり、その領域に入ってきた者を打撃や射撃で攻撃し、押し出されると歩いて戻ります。その領域を離れるのは、最後に自身を傷つけた者が領域の外にいて、遠くから攻撃してきた場合に、その者を追うときだけです。データで`territorial`を指定された知性のないクリーチャーも、ある場所を守るよう命じられたゴーレムと同じく、自分の領域を守ります。5e: 門を守るゴーレムは`{"temperament": "territorial", "territory": 3}`、木立のトレントは`{"temperament": "territorial"}`です。`territorial`(性格または変化先の`to`)か`territory`を指定するルールセットにはCapability API 1.781が必要です。

残酷なクリーチャー(Capability API 1.782)。`behavior.temperament`が`cruel`になることは偶然にはなく、クリーチャーのデータか物語で指定された場合だけです。とどめを刺せる者にはとどめを刺し、その前に押さえつけたり恐怖を与えたりすることを好みます。プレイヤーのゲームで「Let cruel opponents strike the fallen」(残酷な相手が倒れた者を攻撃できるようにする)がオンの場合(デフォルトはオフ)、すでにダウンしていて、まだ死亡していないキャラクターも攻撃できます。オフの場合は`opportunistic`と同じように行動し、Engineが操作するほかのすべての相手と同じく、倒れた者には手を出しません。5e: グール、ハグ、デヴィルは`{"temperament": "cruel"}`です。性格または変化先の`to`として`cruel`を指定するルールセットにはCapability API 1.782が必要です。

名誉を重んじるクリーチャー(Capability API 1.783)。`behavior.temperament`が`honourable`になることは偶然にはなく、クリーチャーのデータか物語で指定された場合だけです。自分と戦っている者(隣にいる者、または最後に自分を傷つけた者)をほかの誰よりも優先して相手にし、殺しを楽しむことはなく、戦闘から逃走中の者(`routed`)、ダウンしている者、降参した者を攻撃することはありません。まだ立っている相手がすべて名誉を重んじる性格である間、パーティーのメニューには**Surrender**(降参)が表示されます。これを選ぶと、パーティーが生け捕りにされる敗北として戦闘が終了し、そのことがGame Masterに伝えられます。5e: 騎士、メタリック・ドラゴン、セレスチャルは`{"temperament": "honourable"}`です。性格または変化先の`to`として`honourable`を指定するルールセットにはCapability API 1.783が必要です。

飢えたクリーチャー(Capability API 1.784)。`behavior.temperament`が`hungry`になることは偶然にはなく、クリーチャーのデータか物語で指定された場合だけで、動物もこの性格を持てます。獲物を一人選んで狙い続け、可能なら掴み、引きずる状態(`dragged`、1.497)によって捕らえると、次の攻撃の前にほかの全員から離れた場所へ引きずっていき、捕らえている間はほかの誰にも歩いて近づきません。5e: ジャイアント・クロコダイル、ローパー、グリックは`{"temperament": "hungry"}`で、掴みによる`grappled`が相手を引きずります。性格または変化先の`to`として`hungry`を指定するルールセットにはCapability API 1.784が必要です。

飛行できる者は間合いの外にとどまります(戦闘AI A7、Capabilityのマイナーバージョンの指定なし)。高低差のある盤面(`combat.elevation.levelHeight`)では、Engineが操作する、飛行できて射撃手段を持つクリーチャーは、そうしなければ飛行できない相手が近くにいる地上でターンを終えることになる場合、空に上がります。`bruiser`、`reckless`のクリーチャー、知性のないクリーチャーは対象外です。状態のオーラが持ち主の陣営に及ぼす効果も、間合い内の各味方に何を与えるかによって評価するため、自分に使うLeadershipにも発動する価値があります。

移動して入ったときだけ巻き込むゾーン(Capability API 1.764)。デフォルトでは、ゾーンの`enter`は新たに覆った者を巻き込みます。歩いて入ってくるクリーチャーと、術者とともに運ばれた、術者によって動かされた、またはその者に向けて向きを変えられたゾーンが覆うようになった者の両方です。ログには、ゾーンがその者に届いたと記録されます。`zone`に`"enterOnlyByMoving": true`を指定すると、後者を除外します。自分で歩くか、動かされるかしてゾーンに入ったクリーチャーだけが、`enter`に巻き込まれます。5eのSpirit Guardiansは`"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false, "enterOnlyByMoving": true }`で、Moonbeamもこれに該当します。これを使うルールセットにはCapability API 1.764が必要です。

ほかの状態も同時に付与する状態(Capability API 1.765)。`combat.conditions`のエントリーは、ルールセットのほかの状態を最大四つ、`alsoApplies`に指定できます。その状態が付与されるたびに、指定した状態もそれぞれ付与されます。ただし、持ち主がすでにその状態を持っているか、完全耐性がある場合は付与しません。持続時間は何も指定されていない状態と同じで、それぞれ固有の終了条件を満たすまで続きます。元の状態が解除されても、追加の状態は残ります。5eの気絶状態は`"alsoApplies": ["prone"]`です。倒れたクリーチャーは伏せ状態になり、回復しても、移動を消費して立ち上がるまで伏せ状態のままです。これを使うルールセットにはCapability API 1.765が必要です。

提示するものをすべて取得するビルダーのステップ(Capability API 1.766)。`"takesAll": true`を持つ`catalog`ステップは、選択を求めず、提示するすべてのエントリーを取得します。キャラクターのレベルによって得られるクラスの特性などです。提示する各`exclusive`グループでは、プレイヤーが一つを選び、最後の選択が数えられ、まだ選択していないグループがあるとステップはその選択を待ちます。`min`、`max`、`countFrom`はこのステップには意味を持たず、`pool`、`cost`、`quotas`、`distinctBy`、`quotaBelow`は持てません(`field`にはCapability API 1.773が必要です。後述します)。ステップの`upTo`は、`per`を使ってエントリーごとに読むこともできます。`{ "filter": "class_id", "prefix": "level_" }`は、エントリーを、`level_`とそのエントリー自身の`class_id`を合わせた名前のシートのフィールドまたは派生値(シートにある該当する値のうち最大のもの)までに制限し、どれも指定していないエントリーは`upTo.value`までに制限します。5eのクラスの特性は`{ "kind": "catalog", "catalog": "class_features", "takesAll": true, "upTo": { "filter": "level", "value": { "field": "level" }, "per": { "filter": "class_id", "prefix": "level_" } } }`です。4レベルのファイター / 1レベルのウィザードはSecond Wind、Action Surge、Arcane Recoveryを取得し、能力値上昇か特技を選びます。いずれかを使うルールセットにはCapability API 1.766が必要です。

行に印を付けるビルダーのステップ(Capability API 1.767)。`"kind": "mark"`のステップは、シートの`list`の一つにカタログがすでに書き込んだ行(プレイヤーが手入力した行は提示しません)のうち、`where`に一致する行を提示します(1～4列にそれぞれ値を指定するか、数値列なら`{ "atLeast": n }`を指定します)。プレイヤーが印を付けた各行では、真偽値の`column`にチェックが入ります。数は`max`か`countFrom`のどちらか一方だけで指定し、存在する行数を超える数を待つことはありません。印を外すときは、ビルダーが付けたチェックだけを消します。その後プレイヤーがシート上で変更したチェックは、プレイヤーのものとして残します。5eのウィザードでは、呪文書のステップの後に`{ "id": "prepared", "kind": "mark", "list": "spells", "column": "prepared", "where": { "level": { "atLeast": 1 } }, "countFrom": { "derived": "spells_prepared_wizard" } }`を置きます。これを使うルールセットにはCapability API 1.767が必要です。

より大きなビルダー(Capability API 1.768)。ガイド付きビルダーが持てるステップは、32個までです(従来: 24個)。`catalog`ステップの`min`と`max`も、60まで指定できます(従来: 40)。5eのウィザードには専用のSpellbook(呪文書)ステップがあり、20レベルのウィザードが書き込んだ呪文(最大: 44個)を扱い、その後に`mark`ステップが続きます。24個を超えるステップを持つルールセット、またはカタログのステップが求めるか取得するエントリーが、40個を超えるルールセットにはCapability API 1.768が必要です。

カタログのバリアント(Capability API 1.769)。カタログのエントリーは`variants`に、同じカタログのほかのエントリーのID(1～32個)を列挙でき、それぞれが`variantOf`でこのエントリーのIDを指定し返します。Chromatic Orbの酸、冷気、火、電撃、毒、雷鳴などで、それぞれが独自の`mechanics`を持ちます。ビルダーのステップとカタログの選択画面が提示するのは親だけで、バリアントを単独で選ぶことはありません。親のシートの行は、戦闘ではその各バリアントとして扱われ、すべてがバリアント自身の`label`でメニューに並び(Game Masterのコマンドにも提示され)、同じ行から同じスロットと数値で発動します。親自身が`mechanics`を持つ場合は、親もメニューに並びます。戦闘は、シートの行の出所となったすべてのエントリーのバリアントを保持します。クリーチャーの`spellcasting`の呪文が親を指定する場合も、同じくその各バリアントとして扱われ、すべてがその呪文自身の`uses`とスロットから発動します。この場合、バリアントが`mechanics`を持っていれば、親自身には不要です。バリアントはそれ自身のバリアントを持てず、親が列挙していないバリアントや、親の指定を返していないエントリーを指定する親は、インポート時に拒否されます。いずれかのキーを使うルールセットにはCapability API 1.769が必要です。

間にあるものだけによる遮蔽(Capability API 1.770)。デフォルトでは、遮蔽を与える地面(森林、廃墟)に立つ標的は、その地面だけでも攻撃に対して半遮蔽を得ます。`combat.cover.groundUnderTarget: false`はこれをなくし、遮蔽を攻撃者と標的の間にあるものだけにします。`creatures`の指定に従うクリーチャーと、そのほか両者の間にあるものです。5eの遮蔽は、足元にあるものではなく、間を遮るものによって決まります。省略するか`true`にすると、地面のルールを維持します。このキーを使うルールセットにはCapability API 1.770が必要です。

援助者の隣にいる相手に対するHelp(Capability API 1.771)。デフォルトでは、Helpは援助者がどこに立っているかに関係なく、援助された味方の次の攻撃に、誰に対してでも有利な効果を与えます。`combat.standardEffects.help: { "beside": true }`は、5eのHelpと同じ挙動にします。援助者の近く(5フィート以内)に相手がいる間だけ提示され、援助した時点で援助者の隣にいた相手への攻撃にだけ効果があり、そのような攻撃によってだけ消費されます。`standard`リストに`help`がある場合だけ指定してください。このキーを使うルールセットにはCapability API 1.771が必要です。

グループのデフォルト(Capability API 1.772)。提示するものをすべて取得するステップ(1.766)は、提示する各`exclusive`グループについて、プレイヤーがその中から一つ選ぶまで待ちます。`"exclusiveDefault": true`を持つカタログのエントリーは、プレイヤーがそのグループから何も選んでいない間、グループ内で取得するものとなるため、ステップは何も待たず、グループのほかのエントリーを選べば引き続きそれに置き換わります。5eの能力値上昇がこれにあたり、特技の選択ルールでは特技で置き換えられます。選択したものと同じく(1.100)、同じグループのほかのエントリーを判定するシートにデフォルトは含まれないため、特技が置き換える能力値上昇がその特技の前提条件を満たすことはありません。提示されるエントリーが一つだけのグループ(ほかのエントリーの`offeredWhen`の読み取り値: 0)も、このキーの有無にかかわらず、同じようにそのエントリーを取得します。これは`exclusive`グループを指定するエントリーだけが指定でき、カタログの各グループのデフォルトは一つです。このキーを使うルールセットにはCapability API 1.772が必要です。

提示するものをすべて取得するステップの取得内容をフィールドへ書き込む(Capability API 1.773)。`"takesAll": true`を持つ`catalog`ステップは、ほかのカタログのステップと同じく、`field`を指定できます。テキストフィールドには、各`exclusive`グループで選んだものも含め、取得したすべてのエントリーのラベルを「, 」で連結して書き込みます。列挙型フィールドには、その値の一つである、最初に取得したエントリーを書き込みます。ステップが取得するものが変わるたびに、ほかのステップのフィールドと同じルールで書き直します(空欄か、ビルダーが書き込んだ内容のままである間だけです)。5eのサブクラスは、その特性がクラスに伴って得られます。`{ "id": "subclass", "kind": "catalog", "catalog": "features", "takesAll": true, "filters": { "kind": "subclass" }, "within": { "step": "class", "filter": "class_id" }, "upTo": { ... }, "field": "subclass" }`は、3レベルのファイター / 2レベルのウィザードに「Champion, School of Evocation」と書き込みます。このようなステップに`field`を持つルールセットにはCapability API 1.773が必要です。

呪文や能力が誰かに付与するものをEngineが評価する方法です。ルールセット自身の`combat.conditions`を読みます。各効果にはターンの一部に相当する価値があり(`cannot-act`はターン全体、攻撃の不利は約三分の一)、持ち主を走らせたり、さまよわせたり、ターンを無駄にさせたりする`behavior`はより高く、ダメージで終了する状態はより低く評価します。すべて、持続時間、標的がd20のセーヴに失敗する確率、標的の危険度に応じて調整します。そのため、拘束する効果は最も強力な攻撃をする相手に付与し、すでにその状態を持つ者や完全耐性がある者には決して付与せず、使用者の陣営まで巻き込む爆発は、その被害を差し引いて評価します。別の維持する呪文を開始するときは、そのために手放す呪文も考慮し、呪文を維持している者を傷つけることは少し高く評価します。打ち消す応答(Counterspell)の価値は、それが止めるものの価値です。使用者の陣営に与えられるはずだった被害と状態、または相手側に与えられるはずだった回復が該当します。ここにあるものに、より新しいCapability APIは必要ありません。

シーケンスの間合い(Capability API 1.740のEngine以降で対応し、独自のマイナーバージョンの指定なし)。自身の`reach`も`range`も持たないシーケンス(クリーチャーのMultiattackなど)は、その構成要素のうち最も遠くまで届くものと同じところまで届き、それぞれの構成要素は、それ自身が届く標的に対してだけ実行されます。成体のドラゴンのMultiattackは、10フィート離れた敵に対して提示され、噛みつきはそこで行い、爪はそれが届く者にだけ使います。

パーティーメンバーのコピー(Capability API 1.726のEngine以降)。Game Masterの`[party_change: character="Lia's Simulacrum" change="add" copy_of="Lia" condition="simulacrum"]`は、元のメンバーのカードとシートのビルドを持つ新しいゲームキャラクターを、新しい名前で、新規の状態でパーティーに追加し、最初からルールセットの`condition`を持たせます。そのために何かを生成することはありません。5eのSimulacrumは、Game Master向けのテキストでそのタグを求めるエントリーと、体力の最大値を半分にする修正値`{"to": "health-max", "times": 0.5}`を持つ、持続する状態です。タグはGame Masterのものなので、独自のCapability APIの指定は必要ありません。Capability API 1.744のEngine以降では、`copy_of`に、代わりにルールセットのクリーチャー図鑑のクリーチャーを指定することもできます(ラベル、ID、`<catalog>/<entry>`で指定します)。野獣や見知らぬ者をコピーすると、そのクリーチャーを指定するカードとしてパーティーに加わり、シートもアイテムも持たず、パーティー側でそのクリーチャーとして戦います。その状態と体力は、シートのものと同じく、戦闘と戦闘の間もライブステートに保持されるため、半減する状態は有効なままで、体力が減ったコピーは減ったままです。

`"alerts": 15`を持つ状態や、着用または携帯するアイテムは、持ち主からその距離以内で隠れて移動する者の居場所を明かします。その者は誰からも隠れていない状態になり、持ち主が居場所を明かしたと記録されます。ショーケースのWind-Chimeは`{"alerts": 15}`で携帯するアイテムです。クリーチャーの`"stillIn": ["bright"]`は、そのマスのどれかがそれらの光の中にある間、移動できないようにします。そこではメニューに歩行がありません。ショーケースのLantern-Shyです。

大きくなるオーラ、上限のある拘束、引きはがすこと、しがみつくことです(Capability API 1.320)。オーラの`"grows": {"by": 10, "upTo": 40}`は、持ち主の各ターンの開始時に`by`だけ遠くまで届き、`distance`より大きい`upTo`を超えません。ログは今どこまで届くかを示します。その`harms`は`"on": "their-turn"`を指定でき、持ち主のターン開始時に一度に与える代わりに、オーラが届く各者のターン開始時に与えます。`"lingers": true`は、もう届かなくなった者に広げたものを、その者の次のターンの開始まで残し、それまでに再び届けばオーラが再び保持します。The OwedのFrost Debtは`{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`です。

アクションが付与するものは`"heldAtMost": 2`を持てます。出所がほかにその数の者をそれで拘束している間は、3人目には付与されません(付与されなかったと記録されます)。The OwedのGraspsです。状態の`shakeOff`に`"self": true`があれば、持ち主も判定なしで行動枠を消費してそれを終わらせられます。Seed Hopperは`{"budget": "action", "self": true}`で、拘束された者かその隣の味方が引きはがします。クリーチャーの`"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}`は、即死させるものに対してでなければ、1回の戦闘で`uses`回まで、0に落ちる代わりに1ヒットポイントで残ります。`extraTurn`があれば、それが起きたターンの直後に自身のターンを取り、そのターンが終わると順番は元どおりです。

選択画面はこのブロックを1行で表示します。そのほかの読み手は、ルールセットが選んだブロックで決まります。

- [`combat`ブロック](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)では、戦闘が戦闘効果を読みます。`range`、`area`、`friendlyFire`は位置のある戦場で作用します。`reaction`はターン中に実行するのではなく何かに応じる項目であることを示し、待つ瞬間を指定します([ウィンドウ](ruleset-combat.md#windows-holding-the-fight-open)を参照)。単に`true`とした項目は瞬間を指定せず、メニューにも出ません。`check`は上記のとおりスキル判定に適用します。
- [`battle`ブロック](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat)だけなら、戦闘は`kind`、`range`、`area`、`friendlyFire`、`amount`、`damageType`、`cost`を読みます。Marinara独自の戦闘が対応する部分だからです。

語彙は限定され、上記以外のキーや値は黙って無視せず拒否します。

`cost`は戦闘外でGMの`use`コマンドが支払うものでもあります。[`use`コマンド](ruleset-catalogs.md#the-use-command-letting-the-game-master-spend-a-price-you-wrote)を参照してください。
