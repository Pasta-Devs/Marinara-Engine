# 규칙 집합 아이템

이 페이지는 [Game Mode 규칙 집합 작성하기](writing-rulesets.md)의 일부입니다. 파티가 지니는 물건과 관련하여 분류, 무기, 방어구, 탄약, 전리품, 돈, 시작 장비와 시장을 설명합니다.

방어구, 무기, 물약, 장비, 탄약, 돈은 모두 아이템입니다. 선택적 `items` 블록은 규칙 집합의 모든 아이템을 작성하는 어휘를 선언하고, `holds: "items"`인 카탈로그는 아이템 자체를 나열합니다. 둘 다 Capability API 1.49가 필요합니다. 그 밖에 필요한 버전은 다음과 같습니다. Game Master가 창작하는 아이템을 다루는 블록의 `rarityCaps`와 `propose`는 1.51, 캐릭터가 지닌 아이템을 읽는 값(`itemStat`)은 1.52, 착용하거나 소지한 동안 아이템이 판정에 주는 효과와 블록의 `bonus` 상한은 1.53, 아이템이 착용자에게 요구하는 조건과 아이템이 바꾸는 능력치는 1.54, 무기의 `attack`은 1.55, 전투에서 아이템이 하는 일은 1.56, 무기가 쏘는 것과 장전해 두는 것은 1.57, 무기의 모드, 보조 손 공격, 피해 하한, 명중 시 상태는 1.58, 전투에서 아이템을 사용할 때의 효과와 아이템이 담는 충전은 1.59, 풀을 회복하는 사용은 1.60, 휴식으로 되찾는 충전이나 다 쓰면 부서지는 아이템은 1.61, 먼저 판정을 요구하는 사용(`gate`)은 1.62, 전리품 표와 생물의 전리품은 1.63, 동전을 떨어뜨리는 전리품 줄이나 동전을 제외하는 레이어는 1.64, 시장, 아이템의 `sold` 장소, `service`는 1.65, 장날(자금, `buyBack`, 판매자의 `stock`, `limited` 수량, 장소를 지정하지 않은 `sold`)은 1.69, 손에 든 무기에서 발동하는 부가 효과(`weapons`)는 1.70, 시작 장비(`startingGear`)는 1.78, 위험한 아이템, 가짜, 부정직한 판매자는 1.79입니다.

## 아이템 블록

블록은 파일 최상위의 `items`에 둡니다. 다음은 Ember Roads의 블록을 조금 줄인 것입니다.

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

- `categories`: 하나에서 24개입니다. 모든 아이템은 방어구, 무기, 물약처럼 정확히 하나의 분류를 가집니다.
- `rarities`: 선택 사항이며 최대 12개입니다. 가장 흔한 것부터 가장 희귀한 것 순으로 나열하세요.
- `tags`: 선택 사항이며 최대 48개입니다. 투척용이나 은도금처럼 아이템이 가질 수 있는 속성입니다.
- `stats`: 선택 사항이며 최대 24개입니다. 아이템이 지니는 숫자와 단어로, 목록 열과 똑같이 `number`, `text`, `boolean`, `enum`, `dice` 중 하나로 선언하며 타입에 따라 범위, 값, 기본값을 가집니다. `promptVisible`(기본값 `true`)은 아이템 옆에 이 스탯을 Game Master에게 보여 줄지 정합니다. 아이템을 숨긴 위치처럼 플레이어만 봐야 하는 것은 `false`로 설정하세요.
- `slots`: 선택 사항이며 최대 12개입니다. 아이템을 착용하거나 드는 위치와, 캐릭터가 그 슬롯을 몇 개 가지는지(1~20)입니다.
- `binding`: 선택 사항. 조율, 서임 등 한 캐릭터가 동시에 귀속할 수 있는 아이템 수를 제한하는 모든 것입니다. `label`은 그 이름이고, `max`는 `{ "abilityScore": "nerve" }`나 파생 값처럼 캐릭터 시트에서 읽는 값입니다. 캐릭터가 귀속할 수 있는 아이템 수는 타격마다 바뀌지 않으므로 실시간 상태는 읽을 수 없습니다.
- `carry`: 선택 사항. `stat`은 아이템의 무게인 숫자 스탯을 지정하며 그 `min`은 0 이상입니다. `encumberedAbove`는 캐릭터가 과적되기 전까지 소지할 수 있는 양이고, `limit`(선택 사항)은 소지할 수 있는 최대량입니다. 둘 다 `binding.max`처럼 시트에서 읽습니다. `carry`가 없으면 무게는 의미가 없고 아무도 과적되지 않습니다. `unit`(선택 사항, 최대 12글자, Capability API 1.791)은 `"lb"`처럼 무게를 세는 단위입니다. 인벤토리의 적재량, 시작 장비 선택기의 무게, 키트 선택지의 무게에서 숫자 뒤에 표시합니다.
- `currencies`: 선택 사항이며 최대 여섯 계열, 계열마다 동전 한 종에서 열 종입니다.
  - 한 계열의 동전은 그 계열에서 가장 작은 동전을 단위로 센 `value`에 따라 서로 바꿉니다. 따라서 가장 작은 동전의 값은 1이며, 한 계열에 같은 값의 동전이 둘 있을 수 없습니다.
  - 서로 다른 계열은 교환되지 않습니다. 다른 나라의 동전이나 설정 속 호의는 별도 계열입니다.
  - 아이템의 비용은 동전만 지정하므로 동전 ID는 모든 계열에서 고유해야 합니다.
  - 동전의 `label`은 개수와 관계없이 쓰는 이름(`pennies`)이고, `one`(Capability API 1.89)은 정확히 하나일 때의 이름(`penny`)으로, 가격, 지갑, 시장이 동전 하나를 말하는 모든 곳에서 씁니다. 없으면 `label`이 하나일 때도 쓰입니다.
  - `perWeight`(선택 사항이며 `carry`와 함께만 사용)는 그 계열의 동전 몇 개가 소지 스탯 한 단위의 무게인지입니다.
  - 동전은 파티의 돈이며 다른 아이템처럼 가방에 넣어 다닙니다(아래 돈 참고).
- `rarityCaps`: 선택 사항이며 희귀도마다 최대 하나입니다. Game Master가 창작한 아이템이 그 희귀도에서 줄 수 있는 최대치입니다. `stats`에 지정한 각 숫자 스탯의 최댓값(그 스탯 자체 범위 안이며 정수 스탯에는 정수)과, 착용하거나 소지할 때의 수정치 하나가 더할 수 있는 최대 고정 보너스인 `bonus`(Capability API 1.53)입니다. `bonus`가 있는 희귀도에서는 주사위를 숫자로 제한할 수 없으므로 주사위 보너스를 제외하며, 페널티는 제한하지 않습니다. 창작한 아이템은 이 상한을 따르며, 카탈로그가 나열한 아이템은 작성자의 것이므로 제한하지 않습니다.
- `propose`: 기본값은 `true`입니다. `false`는 Game Master가 이 규칙 집합의 아이템을 창작하지 못하게 합니다.
- `native`: 기본값은 `true`입니다. `false`는 이 규칙 집합의 게임에서 Game Mode 자체의 타입 없는 아이템을 끕니다(**아이템을 읽는 곳** 참고). Game Master는 여전히 규칙 집합의 어휘로 아이템을 창작할 수 있습니다.
- `freeform`: 플레이어가 직접 입력한 아이템을 어떻게 처리할지입니다. `"plain"`(기본값)은 지금처럼 규칙 없는 아이템으로 유지합니다. `"refuse"`는 규칙 집합의 아이템만 허용합니다.
- `lootTables`(Capability API 1.63): 선택 사항이며 최대 24개입니다. 이긴 전투의 생물과 Game Master의 `[loot:]`가 떨어뜨리는 것입니다(아래 전리품 참고).

## 개별 아이템

아이템 카탈로그는 `feeds`를 선언하지 않습니다.

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

각 항목은 `rows`나 `creature` 대신 `item`을 가집니다.

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

- `id`, `label`, `summary`, `filters`는 다른 항목과 같습니다. 라벨이 아이템 이름입니다.
- `category`는 필수입니다. `rarity`와 `tags`는 선택 사항이며 셋 모두 블록 자체의 ID를 지정합니다. 블록이 희귀도를 선언했을 때만 아이템이 희귀도를 가질 수 있습니다.
- `stats`: 블록 스탯의 값입니다. 각 값은 해당 스탯이 담을 수 있는 값이어야 합니다.
- `slots`: 아이템이 차지하는 슬롯별 개수로, 캐릭터가 가진 수를 넘을 수 없습니다.
- `stack`: 한 묶음의 최대 개수로 1부터 999,999까지입니다. 없으면 Game Mode의 일반 묶음만큼 담습니다. `charges`를 담는 아이템은 한 묶음에 하나입니다.
- `cost`: 동전 하나의 정수 `amount`이며 동전은 `unit` ID로 지정합니다. 선택기에 표시되고 Game Master도 아이템 옆에서 봅니다(아래 돈 참고).
- `sold`(Capability API 1.65): `{ "place": "city" }`처럼 이 아이템을 파는 가장 작은 시장 장소이며, 다르게 정하는 모든 규칙보다 우선합니다. 1.69부터는 그 대신 또는 그와 함께 한 장소가 하루에 보유하는 수량(`"limited": 2` 또는 `"limited": "1d3"`)을 지정할 수 있습니다(아래 시장 참고).
- `service`(Capability API 1.65): 숙박, 통행, 축복 등에 `true`로 지정합니다. 아이템처럼 사지만 지니지는 않습니다. 구매는 지불만 하며 다른 어떤 방법으로도 가방에 넣을 수 없고(추가하면 `service`로 거부), 선택기에서도 제외합니다. 서비스는 `cost`를 가지며 소지나 사용에 관한 것(`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`)은 가지지 않습니다.
- `binds`: 아이템이 착용 중 효과를 내려면 먼저 귀속해야 합니다. `restriction`(선택 사항)은 누가 귀속할 수 있는지 문장으로 설명하며, `cursed: true`는 놓아주지 않는 아이템을 표시합니다. `binding`이 있는 규칙 집합만 귀속 아이템을 가질 수 있습니다.
- `worn`과 `carried`(선택 사항, Capability API 1.53): 착용한 동안, 그리고 소지만 한 동안 아이템이 보유자의 판정과 내성에 주는 효과, (1.54) 설정하거나 올리는 능력치, (1.56) 전투에서 하는 일입니다. [전투 밖 판정](#checks-outside-a-fight)과 [전투 중 방어구와 착용 효과](#armor-and-worn-effects-in-a-fight)를 참고하세요.
- `requires`(선택 사항, Capability API 1.54): 아이템이 착용자에게 요구하는 조건과, 조건에 미치지 못하는 동안 적용되는 것입니다. [전투 밖 판정](#checks-outside-a-fight)을 참고하세요.
- `attack`(선택 사항, Capability API 1.55): 착용한 동안 전투에서 무기로서 아이템이 하는 일, (1.57) 쏘는 것과 장전해 두는 것, (1.58) 다른 모드, 보조 손 공격, 피해 하한, 명중 시 거는 상태입니다. [전투 중 무기](#weapons-in-a-fight), [탄약과 재장전](#ammunition-and-reloading), [모드, 두 번째 무기, 하한, 명중 시 상태](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit)를 참고하세요.
- `toggle`(선택 사항, Capability API 1.170): 아이템이 지니는 스위치로 `{ "label", "budget" }`입니다. 전투는 그 예산의 선택지로 제공하고("Turn on Flame Tongue: Flames"), 인벤토리는 라벨이 붙은 버튼으로 제공하며, 둔 상태 그대로 전투 사이에도 묶음에 유지됩니다. 처음에는 꺼져 있습니다. 스위치가 있는 아이템은 켜진 동안 한 묶음에 하나입니다. `when: "toggled"`인 무기의 `plus` 절은 켜진 동안에만 피해를 줍니다. 5e의 flame tongue은 `"toggle": { "label": "Flames", "budget": "bonus" }`와 `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`입니다.
- `use`와 `charges`(선택 사항, Capability API 1.59): 전투 안팎에서 아이템을 사용할 때의 효과와 그 사용이 소모할 충전, (1.60) 회복하는 풀입니다. [전투 중 아이템 사용](#using-items-in-a-fight)과 [전투 밖 아이템 사용](#using-items-outside-a-fight)을 참고하세요.

아이템은 `mechanics`를 가지지 않습니다. 하는 일은 `item` 블록에 작성합니다.

## 아이템을 읽는 곳

위의 모든 내용은 규칙 집합을 가져올 때 검사하며, 아이템 카탈로그도 함께 배포됩니다. 게임에서는 Game Mode의 인벤토리가 이를 읽습니다.

- **아이템이 가방에 들어갑니다.** 묶음은 규칙 집합의 아이템일 수 있으며, 플레이어가 무엇이라고 부르든 그 아이템으로 남습니다. 인벤토리의 **From the ruleset**(룰셋에서 가져옴) 버튼은 카탈로그가 나열한 모든 아이템의 선택기를 카탈로그의 검색과 필터와 함께 열며, 레이어가 숨긴 항목은 여기서도 숨겨집니다.
- **이름으로 아이템을 찾습니다.** 플레이어가 입력한 이름이나 Game Master가 `[inventory: action="add"]`에 쓴 이름이 대소문자와 관계없이 아이템의 `label`과 같으면 그 아이템을 추가합니다. 두 아이템이 같은 라벨을 쓰면 카탈로그에 먼저 나열된 아이템을 찾습니다.
- **`stack`** 상한을 지킵니다. 추가, 설정, 합치기, 건네기로 상한을 넘으면 묶음을 채우고 새 묶음을 시작합니다.
- **`freeform: "refuse"`**는 플레이어에게 규칙 집합의 아이템만 남깁니다. 선택기와, 규칙 집합 아이템에 해당하는 이름입니다.
- **`native: false`**는 Game Master에게 규칙 집합의 아이템과 Game Master가 창작한 아이템만 남깁니다. 둘 다 아닌 이름은 거부하지만(`not-ruleset-item`) 이미 지닌 것을 더 추가할 수는 있으며, 지시문에도 그렇게 안내합니다. 전투는 더 이상 인벤토리 아이템이 하는 일을 모델에게 묻지 않으므로 규칙 집합의 아이템만 싸움에 쓰입니다. 규칙 집합 전투에서는 손에 든 무기와 아이템의 사용(아래 전투 중 무기 참고), Classic이나 Tactical 전투에서는 `use`가 있는 아이템(아래 Classic 및 Tactical 전투의 아이템 참고)입니다. 플레이어가 입력한 것은 여전히 `freeform`을 따르며, 파티가 지니던 것은 어느 경우든 새 세션에서 돌아옵니다.
- **아이템의 정체**를 선택한 묶음에 표시합니다. 분류, 희귀도, 태그를 라벨로, 아이템이 주는 스탯, 요약, 한 묶음의 최대 개수입니다. 선택기는 `cost`도 표시합니다. Game Master는 보유한 각 아이템을 분류, 희귀도, 태그, `promptVisible`로 남긴 스탯과 함께 봅니다. `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`처럼 나옵니다.

- **`slots`**: 슬롯을 차지하는 아이템은 그 슬롯이 비어 있는 동안 소지한 사람이 장착할 수 있으며, 큰 묶음에서는 아이템 하나를 별도 묶음으로 떼어 착용합니다. 인벤토리는 캐릭터마다 사용 중인 슬롯을 표시합니다.
- **`binding`**: `binds`인 아이템은 소지자 자신의 시트에서 읽은 `binding.max`까지 귀속할 수 있습니다(시트가 없는 캐릭터는 빈 시트를 읽습니다). `cursed` 아이템은 한번 귀속하면 계속 귀속됩니다. 플레이어는 귀속을 풀거나, 벗거나, 건네거나, 제거할 수 없으며 저주를 끝낼 수 있는 것은 Game Master뿐입니다.
- **`carry`**: 아이템의 무게는 `carry.stat` 값이며(값이 없는 아이템은 무게가 없음), 캐릭터의 적재량은 가방의 무게로 자신의 시트에서 읽은 `encumberedAbove`와 `limit`에 비교합니다. 인벤토리의 공유 보기에 추가한 아이템은, 플레이어가 추가했든 Game Master가 `who=` 없이 추가했든, 과적되지 않고 소지할 수 있는 사람(플레이어 먼저, 그다음 파티 순서)에게 가며, 아무도 전부 받을 수 없으면 각자 남은 여유에 따라 나눕니다. 누구의 `limit`도 넘지 않습니다. 아무도 소지할 수 없는 것은 남겨 두고 Game Master에게 알립니다. 4분의 1파운드 같은 무게에는 무게 스탯에 `"integer": false`를 주세요.
- **Game Master는 규칙 집합의 어휘로 아이템을 창작합니다.** `propose: false`로 설정하지 않으면 `[inventory: action="add"]`로 새 아이템을 설명할 수 있습니다. 시작점이 될 아이템을 `like=`로 지정하고, 그다음 `category=`, `rarity=`, `tags=`, `stats=`(`id=value` 쌍), `slots=`(`id=count`), `binds=`(`yes`, `cursed`, `no`), `worn=`과 `carried=`, `summary=`를 원하는 만큼 쓰며 각 부분은 ID나 라벨로 지정합니다. 착용·소지 변경은 `;`로 구분하며 각 변경은 `+N`, `-N`, `advantage`, `disadvantage` 또는 내성에 대한 `fails`이며 이름으로 지정한 기술이나 내성, 또는 전체에 대한 `checks`나 `saves`에 적용합니다. 능력치 이름에 `+N`이나 `-N`을 붙여 올리거나 내리고, 전투가 있으면 공격에 `+N`, `-N`, 이점, 불리점을, 방어나 작성자가 정한 방어의 이름에 `+N`이나 `-N`을 줄 수 있습니다. 예를 들어 `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"`, `none`입니다. 방어가 이미 세는 아이템 스탯(Ember Roads의 Guard는 착용한 것의 `guard`를 합산)이 방어구가 방어를 올리는 방법이므로, 그런 스탯과 함께 쓴 방어에 대한 착용 변경은 제외하고 응답에서 알립니다. 작은 모델은 +1 하나를 위해 `guard=1`과 `+1 Guard`를 함께 쓰기 때문입니다. 작은 모델이 대신 쓰기 쉬운 표현도 읽습니다. 이름 뒤의 숫자(`Brawn +1`), 공격이나 방어 뒤의 "bonus"(`+1 attack roll bonus`), 빈 태그·스탯·슬롯 목록에 대한 `none`, 그 이름의 스탯이 없을 때 `stats=` 안에 쓴 `worn=`, `carried=`, `summary=`입니다. Engine은 블록에 있는 것만 유지합니다. 알 수 없는 분류, 태그, 스탯, 슬롯, 기술, 내성은 제외하고, 없는 희귀도는 가장 낮은 희귀도가 되며, 숫자는 스탯의 범위로, 그다음 그 희귀도의 `rarityCaps`로 제한하고, 착용·소지 보너스는 희귀도의 `bonus`로 제한하며(`like`로 가져온 부분도 포함), 규칙 집합 아이템의 이름은 그냥 그 아이템입니다. 응답은 Game Master에게 무엇을 바꿨는지 알려 주고(보여 주지 않는 스탯은 언급하지 않음), 아이템 세부 정보는 플레이어에게 모든 변경을 보여 줍니다. 게임은 이 아이템을 보관하므로 같은 이름은 게임이 끝날 때까지 그 아이템이며, 누군가 지니고 있는 한 새 세션에서도 유지됩니다.
- `slots`가 있으면 Game Master는 인벤토리 명령으로 아이템을 `equip`하고 `unequip`할 수 있으며, `binding`이 있으면 `bind`하고 `unbind`할 수 있습니다. 규칙 집합에 있는 명령만 안내받습니다. 각 캐릭터의 적재량, 귀속 아이템, 슬롯, 그리고 무엇을 착용하거나 귀속했는지 봅니다.

- **착용하거나 소지한 동안 아이템이 하는 일**을 선택한 묶음과 선택기에 표시하며("While worn: -1 on checks (Sneak)"), Game Master도 아이템 옆에서 봅니다(`worn: -1 on checks (Sneak)`). 전투 밖 판정이 이를 적용합니다(아래 전투 밖 판정 참고).
- **무기가 하는 일**도 같은 방식으로 표시하며("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), 전투는 손에 든 동안 이를 제공합니다(아래 전투 중 무기 참고).
- **아이템 사용의 효과**도 같은 방식으로 남은 충전과 함께 표시합니다("Use (Action): heals 1d4 + 1, range 0 paces, used up"). 전투가 이를 제공하며, 인벤토리의 **Use**(사용) 버튼과 Game Master의 `[inventory: action="use"]`도 마찬가지입니다(아래 전투 중 아이템 사용과 전투 밖 아이템 사용 참고).

Classic이나 Tactical 전투에서는 `use`가 있는 각 아이템이 거기 적힌 일을 하고, 없는 아이템은 제공하지 않습니다(아래 Classic 및 Tactical 전투의 아이템 참고). `native` 설정과 관계없이 시트는 아이템을 읽을 수 있고(아래 참고), 손에 든 무기는 규칙 집합 전투에서 가방에서 꺼낸 것을 쏘는 공격이 되며, 착용하거나 소지한 동안 아이템이 하는 일은 그 전투에서도 적용되고(아래 전투 중 방어구와 착용 효과 참고), `use`가 있는 아이템은 전투 안팎에서 자체 규칙대로 사용되며(아래 전투 중 아이템 사용과 전투 밖 아이템 사용 참고), `currencies`는 파티의 돈입니다(아래 돈 참고).

<a id="items-on-the-sheet"></a>

## 시트의 아이템

값 참조는 `itemStat`(Capability API 1.52)으로 캐릭터가 지닌 아이템을 읽을 수 있습니다. Ember Roads는 여행자가 착용한 방어구의 guard 값을 Guard에 더하며, 이것이 타격이 넘어야 하는 값입니다.

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"`은 캐릭터가 걸친 아이템입니다. 슬롯을 차지하는 아이템은 장착한 동안, `binds`인 아이템은 귀속한 동안, 둘 다인 아이템은 두 조건을 모두 만족하는 동안입니다. 둘 다 아닌 아이템은 착용 상태가 되지 않습니다. `"carried"`는 그 밖에 지닌 것이고 `"all"`은 둘 다입니다.
- `pick`: `"sum"`은 각 아이템의 값에 개수를 곱해 더하고, `"max"`와 `"min"`은 가장 높거나 낮은 단일 값을 읽으며, `"count"`는 개수 기준으로 아이템을 셉니다.
- `stat`은 아이템 스탯 하나를 지정합니다. `sum`, `max`, `min`에는 `number` 스탯이 필요합니다. `count`는 이를 생략해 모든 아이템을 세거나, 아무 스탯이나 지정해 그 스탯을 주는 아이템만 셀 수 있습니다.
- `slot`, `category`, `tag`(각각 선택 사항)는 그 슬롯을 차지하거나, 그 분류이거나, 그 태그를 가진 아이템만 남깁니다.
- `default`(선택 사항이며 생략하면 0)는 고른 아이템이 없거나 어느 것도 그 스탯을 주지 않을 때 읽는 값입니다.

아이템은 플레이 중 바뀌므로 `itemStat`은 실시간 읽기와 같은 규칙을 따릅니다. 풀이나 트랙의 `max`, 숙련 보너스, `binding.max`, `carry` 숫자, 카탈로그의 연동 열이나 증가량은 파생 값을 거치더라도 이를 읽을 수 없습니다. 그 밖에 숫자를 읽는 곳에서는 모두 읽을 수 있습니다. 파생 값, 판정의 `adjust`, 기술의 `cap`, 전투의 방어, 흡수, 우선권입니다.

캐릭터의 아이템은 자신의 가방에 있는 것입니다. 플레이어 카드(채팅에서 플레이어가 맡은 카드, 없으면 첫 카드)는 플레이어의 가방을 읽고, 다른 카드는 각자의 가방을 읽습니다. 일반 아이템에는 읽을 스탯이 없으므로 규칙 집합의 아이템만 셉니다. 화면의 시트, 판정, Game Master의 시트 블록, 시작되는 전투는 모두 그 시점에 각 캐릭터가 지닌 것을 읽습니다. 게임 밖, 즉 시트 편집기나 가져오기 검토에서는 아무도 아무것도 지니지 않으므로 `itemStat`은 `default`를 읽습니다.

<a id="checks-outside-a-fight"></a>

## 전투 밖 판정

전투 밖에서 Game Master가 요청한 판정이나 내성은 시트 외에도 캐릭터 자신의 활성 상태, 도달한 단계, 착용하거나 소지한 아이템의 효과, 착용한 아이템의 요구 조건에 미치지 못하는 동안의 비용을 읽습니다. 전투의 상태가 쓰는 것과 같은 어휘입니다(아이템 키와 범위 지정은 Capability API 1.53).

아이템은 착용한 동안(귀속하는 아이템이면 귀속한 동안도) 적용되는 `worn`과 소지만 한 동안 적용되는 `carried`로 하는 일을 정합니다. Ember Roads의 가죽 외투는 살금살금 걸을 때 삐걱거리고, 이정석은 카라반 사람들이 신뢰하게 만듭니다.

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

각각 판정이 읽는 상태의 부분을 받습니다.

- `effects`: `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage`, `own-saves-disadvantage`입니다.
- `modifiers`: 상태와 똑같이 판정이나 내성에 대한(`to`) 변경이며 `flat`, `dice`(와 `minus`), `mode`, 자체 `skills`나 `saves`를 가집니다.
- `failsSaves`: 보유자가 굴리지 않고 실패하는 내성입니다.
- `skills`와 `saves`: 효과와, 자체 지정이 없는 수정치가 어느 기술이나 내성에 관한 것인지입니다.
- `abilities`(Capability API 1.54): ID로 지정해 바꾸는 능력치이며 각각 `{ "set": N }`(최소 N이며 더 높은 점수는 유지) 또는 `{ "add": N }`(음수는 낮춤)입니다. 시트를 계산하기 전에 적용하므로 그 능력치를 읽는 모든 것, 즉 화면의 시트, 파생 값, 판정, Game Master의 시트 블록, 시작되는 전투가 바뀐 값을 읽습니다. 더하기를 먼저 적용하고 그다음 가장 높은 `set`을 적용하며, 능력치 자체의 `min`과 `max`가 유지됩니다. 풀이나 트랙의 최댓값과 숙련 보너스는 시트만으로 계산하므로 아이템이 바꾸지 않습니다.

Ember Roads의 소가죽 건틀릿은 약한 악력을 소몰이꾼의 악력으로 끌어올립니다.

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

전투에서 아이템이 하는 일(방어, 공격, 속도, 전투의 다른 효과, 막아 주는 피해와 상태)은 [전투 중 방어구와 착용 효과](#armor-and-worn-effects-in-a-fight)에서 설명합니다. 전투 밖 판정은 위의 부분만 읽습니다. 한 아이템은 누가 그 묶음을 몇 개 지니든 한 번만 적용합니다.

아이템은 `requires`로 착용자에게 조건을 요구할 수도 있습니다. 착용자 시트의 값(`value`, 모든 값 참조이며 플레이 중 다른 값과 같은 방식으로 읽음), 최솟값(`atLeast`), 미치지 못하는 동안 적용되는 것(`otherwise`, 같은 어휘이지만 요구 조건이 능력치를 읽을 수 있으므로 능력치는 바꿀 수 없음)입니다. 최대 네 개입니다. Gravewatch의 무덤 삽은 약한 파수꾼에게 힘든 일입니다.

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

요구 조건은 착용자의 아이템이 바꾼 뒤의 능력치를 읽으므로 Sinew를 3으로 설정하는 건틀릿이 있으면 삽의 조건을 충족합니다.

판정에서는 다음과 같습니다.

- 그 판정에 관한 모든 수정치가 숫자를 더하고 주사위를 굴립니다. 합산 판정에서는 고정 숫자, 풀에서는 주사위입니다. 능력치 판정과 규칙 집합이 이름을 지정할 수 없는 판정은 범위를 좁히지 않은 것만 읽고, 내성은 내성에 관한 것만 읽습니다.
- Game Master의 `mode=`를 포함해 모든 출처의 이점과 불리점은 상쇄됩니다. 각각 하나라도 있으면 판정을 한 번만 굴립니다. 애초에 두 번 굴리는 규칙 집합(`resolution.advantage`)만 한쪽으로 기웁니다.
- 상태나 아이템이 실패시키는 내성은 굴리지 않고 실패하며 아무것도 소모하지 않습니다.
- 기록에는 무엇이 판정을 바꿨는지 나옵니다. 숫자는 `effects="-1"`, 바꾼 것은 `from="Leather coat"`, 굴리지 않고 실패한 내성은 `automatic="true"`입니다. 주사위 카드도 같은 내용을 보여 주고 Game Master는 다음 턴에 이를 읽습니다. Engine이 이를 적용한다고 안내받으므로 다시 더하지 않습니다.

Gravewatch는 풀에서 같은 것을 보여 줍니다. 귀속한 Dawn bell은 Ward에 주사위 하나를 더하고, Rattled는 Soothe와 Barter에서 하나를 뺍니다.

## 상태, 단계, 아이템, 시트 행이 주는 유형별 방어

`combat.conditions[]`와 `combat.levels[]`는 `resist`, `vulnerable`, `immune`(각각 1~30개)과 `conditionImmunities`(상태 ID 1~40개)를 줄 수 있습니다. 상태가 유지되거나 단계의 경계에 도달한 동안 적용됩니다. 새로 얻은 상태 면역은 이미 걸린 그 상태를 끝내고 다시 걸리지 않게 합니다. 면역은 저항보다 우선하며, 저항과 취약은 상쇄됩니다. 저항이 여러 개여도 피해를 두 번 절반으로 하지 않습니다.

`resist`와 `immune`은 생물과 같은 형태를 씁니다. 피해 단어나 `{ "type": "bludgeoning",
"except": ["magical"] }`입니다. 타격에 지정한 태그 중 하나라도 있으면 그 항목을 우회합니다. `vulnerable`은 일반 피해 단어로 남습니다. 같은 예외 형태가 아이템의 `worn`과 `carried` 효과에서도 작동합니다. 예외 태그는 `items.tags`에 선언하고 무기나 주문의 성질에 넣으세요. 예를 들어 Stoneskin은 다음과 같은 상태 대응입니다.

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

Armor of invulnerability는 `worn` 효과 안에서 같은 `resist` 배열을 씁니다. Protection from Energy는 `resist: ["fire"]`를, Brave 같은 특성은 `conditionImmunities: ["frightened"]`를 줄 수 있습니다. 단계는 경계에서 `resist: ["poison"]`을 줄 수 있습니다. `combat.damageTypes`가 어휘를 선언하면 생물과 마찬가지로 알 수 없는 정적 피해 단어를 보고하며, 그 선언이 없으면 피해 단어는 자유 텍스트입니다.

혈통이나 카탈로그 특성에 대해 `combat.sheetHides`는 출처를 최대 여덟 개 담습니다(빈 배열 허용). 각각 시트 목록 하나, 그 목록의 텍스트나 열거형 열 하나, 네 종류 중 하나를 지정합니다. 특성 행의 `resistance` 열에 `"poison"`이 있는 드워프라면 다음과 같습니다.

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

모든 행은 쉼표로 구분한 단어를 내며, 앞뒤 공백을 지우고 대소문자 구분 없이 비교합니다. 빈 단어는 건너뜁니다. `"fire"`가 있는 행을 추가하면 화염 저항이 더해지고, 지우면 그 출처가 사라집니다. 저항과 면역 단어는 `"bludgeoning except magical silvered"`처럼 `except`를 포함할 수 있습니다. 취약과 상태 면역은 일반 단어입니다. 시트 텍스트의 알 수 없는 선언된 피해 단어는 알 수 없는 상태 ID처럼 무시하며, 상태 면역용 열거형 열은 가져올 때 상태 ID만 선언해야 합니다. 시트, 전투, Game Master 요약에 이 방어와 그 예외가 포함됩니다.

<a id="weapons-in-a-fight"></a>

## 전투 중 무기

아이템은 무기일 수 있습니다(Capability API 1.55). `attack`은 전투 블록의 [공격 행](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)과 같은 형태이며 열 대신 값을 쓰고, [규칙 집합 전투](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)는 아이템을 착용한 동안, 즉 필요한 손에 들고 귀속하는 아이템이면 귀속한 동안 이를 공격으로 제공합니다. 집어넣었거나 소지만 한 아이템은 아무것도 제공하지 않으며, 공격 행과 생물 자체의 행동은 이전과 똑같이 작동합니다. Ember Roads의 손도끼는 다음과 같습니다.

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: 소모하는 예산으로 `combat.economy.budgets` 중 하나입니다.
- `toHit`: 명중에 더하는 값입니다. `abilities`는 능력치 ID 하나 이상이며 그중 가장 좋은 것을 셉니다(기교 무기는 둘을 나열합니다). `skill`은 공격 행과 마찬가지로 기술 자체의 능력치 대신 공격의 능력치를 사용해 그 기술 판정이 더하는 값을 더합니다. `proficiency`는 보유자 시트의 값이며 0보다 크면 규칙 집합의 숙련 보너스를 더합니다(항상 더하려면 `{ "const": 1 }`). `bonus`는 숫자입니다. `sheetBonus`는 보유자 시트에서 읽어 그대로 더하는 숫자로, 무기 자체가 아니라 보유자가 그 종류의 모든 무기에 가져오는 것입니다. 5e의 Archery 전투 방식은 각 원거리 무기에 `{ "derived": "archery" }`를 주며, 이 파생 값은 궁수에게는 2이고 그 밖의 누구에게나 0입니다(Capability API 1.95. 아이템 정보에는 시트에서 쓰는 이름으로 표시됩니다). `target`은 이 무기 공격에 대한 풀 전투의 주사위별 목표이며(Gravewatch의 삽은 풀의 7 대신 6부터 모든 주사위를 셈), `target`을 옮길 수 있는 `dice-pool` 규칙 집합만 지정할 수 있습니다. 합산 전투에서는 `bonus`가 같은 역할을 합니다.
- `damage`: 주는 `dice`, 피해 `abilities` 중 가장 좋은 것, `bonus`, `type`입니다. 합산 전투에는 `dice`가 필요합니다. 풀 전투에서는 명중이 성공 수만큼 피해를 주고 `dice`는 풀 자체 주사위를 그만큼 더합니다. `sheetBonus`(Capability API 1.97)는 `toHit`처럼 피해에 더하는 보유자 시트의 숫자이며, `"oneHanded": true`이면 무기를 한 손에 들었을 때만 셉니다. 양손으로 휘두르는 `versatile` 무기나 한 슬롯을 두 개 차지하는 무기는 해당하지 않습니다. 5e의 Dueling은 무기 하나를 든 결투가에게 2인 `{ "derived": "dueling" }`을 줍니다. `rerollUpTo`(Capability API 1.98)는 보유자 시트의 값입니다. 그 이하인 무기 자체 피해 주사위는 치명타의 추가 주사위를 포함해 한 번 다시 던지고 새 눈을 확정하며, 무기를 양손으로 휘두를 때(손이 비어 있는 `versatile` 무기, 또는 한 슬롯을 두 개 차지하는 무기)와 합산 전투에서만 적용합니다. 5e의 Great Weapon Fighting은 그 전투 방식을 가진 캐릭터에게 2인 `{ "derived": "great_weapon_fighting" }`을 줍니다.
- `reach`와 `range`(`normal`, 그리고 그 너머까지 닿는 `long`)는 `combat.distance` 단위이며 이 설정이 필요합니다. 둘 다 있는 무기는 공격 행과 마찬가지로 투척 무기입니다. 가까이서는 휘두르고 그 너머로는 던집니다. 둘 다 없으면 한 칸에 닿습니다.
- `versatile`: 보유자가 착용한 것 사이에서 무기가 차지하는 각 슬롯에 같은 만큼의 여유가 더 있는 동안 대신 주는 `dice`입니다. 다른 손이 빈 채로 한 손에 든 창이 예입니다.
- `strikes`: 공격 행의 `strikes`와 마찬가지로 한 번 소모로 얻는 타격 횟수이며 보유자 시트에서 읽습니다. 없는 무기는 사용자가 공격을 몇 번 할 수 있든 소모 한 번에 타격 한 번입니다.

이 숫자나 단어는 아이템 자체의 스탯을 읽을 수도 있습니다. `{ "stat": "damage" }`는 아이템의 `damage`이며, 아이템이 아무 값도 주지 않는 스탯은 값을 쓰지 않은 것과 같습니다. `abilities`와 `skill`은 단어가 능력치나 기술 ID인 열거형 스탯을, `type`은 텍스트나 열거형 스탯을 읽습니다. 따라서 Game Master가 무기를 `like=`로 지정해 창작한 아이템도 자체 스탯으로 싸우는 무기이며, 다른 스탯처럼 `rarityCaps`로 제한합니다(직접 쓴 값은 그대로 복사합니다). 슬롯도 귀속도 없이 창작한 아이템은 착용할 수 없으므로 공격 없이 만듭니다. 작은 모델은 무기를 설명하면서 `like=`를 빠뜨리기 쉬우므로, 시작점 없이 무기 분류로 창작한 아이템은 그 분류의 무기 중 이름이 가장 비슷한 것(어느 쪽으로든 단어 하나를 공유하면 비슷하다고 보므로 crossbow는 bow와 비슷함), 없으면 첫 번째 무기처럼 싸우며, 제안에서 빠진 공격용 스탯을 가져오고 응답에서 알립니다("It fights as Hand axe does."). Game Master의 제안 양식도 어떤 무기와 비슷하게 만든 무기는 그 무기처럼 싸운다고 알려 줍니다.

무기의 태그는 그 타격이 지니는 속성입니다. 생물의 `resist`나 `immune` 항목은 무엇이 통하는지 지정할 수 있습니다. `{ "type": "tearing", "except": ["silver"] }`는 `silver` 태그가 붙은 무기의 피해는 그대로 받고 그 밖의 것은 저항합니다. Gravewatch의 무덤 망령이 이렇게 작성되어 있어 은 관못이 통합니다. 무기 아이템이 아닌 피해는 같은 아이템 태그로 `qualities`(Capability API 1.101)에 지니는 것을 지정합니다. 카탈로그 항목의 `mechanics`(주문)와 생물 행동의 `damage`(데바의 메이스)에 둡니다. 5e의 "비마법 공격의 타격, 관통, 참격 피해에 대한 저항"은 다른 둘에 대한 같은 항목과 함께 `{ "type": "slashing", "except": ["magical"] }`로 쓰며, 마법 무기의 태그에 `magical`을, 주문과 SRD가 마법적이라고 하는 생물 공격에 `"qualities": ["magical"]`을 넣습니다.

무기 세부 정보와 Game Master의 줄은 무기가 하는 일을 알려 줍니다. `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`이며, Ember Roads의 멧돼지 창에는 `1d8 with a hand free`가, Gravewatch의 삽에는 `at 6`이 붙습니다.

<a id="ammunition-and-reloading"></a>

### 탄약과 재장전

무기는 무언가를 쏠 수 있고 자체 장전 수를 유지할 수도 있습니다(Capability API 1.57). Ember Roads의 사냥용 활은 화살을 쏘고, Gravewatch의 경비 권총은 파수꾼의 탄환과 화약으로 장전한 탄 한 발을 담습니다.

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: 무기가 쏘는 것을 아이템 `tags` 중 하나로 지정합니다. 공격마다 보유자가 지닌(착용 여부와 무관) 그 태그의 아이템을 `perAttack`개(지정하지 않으면 1)씩 가방의 첫 번째 묶음부터, 그다음 묶음 순으로 가져옵니다. 충분히 지니고 있을 때만 무기를 제공하며 전투 메뉴에 남은 수를 표시합니다. 파티가 이긴 전투가 끝나면 각자 쏜 것의 `recover`(0~1) 비율이 원래 묶음으로 돌아옵니다. 비율은 전투 전체에서 합산한 뒤 묶음마다 한 번 내림하므로, 화살통 하나에서 쏜 화살 다섯 개의 절반은 두 개입니다. 지거나 도망친 전투는 아무것도 돌려주지 않습니다.
- `clip`: 무기 자체가 유지하는 장전 수입니다. `max`는 담는 양으로 직접 쓰거나 아이템의 숫자 스탯에서 읽으며, `reload`는 재장전에 쓰는 예산입니다. 공격은 가방에서 가져오는 대신 장전된 것을 소모하며, 한 번 공격할 만큼 장전되어 있을 때만 무기를 제공합니다. 전투 메뉴의 **Reload**(재장전) 선택지는 `reload`를 소모해 장전합니다. `ammo`가 있으면 가방에서(가방에 그보다 적게 남았으면 남은 만큼), 없으면 가득 채웁니다. 장전 수는 무기의 인벤토리 묶음에 저장하므로 한 전투에서 비운 권총은 다음 전투에서도 비어 있습니다. 아직 아무도 쏘지 않은 무기는 장전된 상태이며, 플레이어가 같은 무기 여러 개의 묶음에 합친 무기도 마찬가지입니다. 장전 수는 무기 하나의 것이기 때문입니다. 장전된 탄은 전투 후 회수하지 않으므로 `recover`는 장전 수가 없는 무기용입니다.

전투가 쏘고, 장전하고, 회수한 것은 파티의 체력처럼 각 단계마다 인벤토리에 기록되며, 일지에 사용한 것이 나옵니다. 묶음이 사라졌거나 전투가 예상한 것보다 적게 담긴 단계는 전투가 찾지 못하는 소모 아이템과 마찬가지로 거부합니다. 전투 로그는 모든 사격, 재장전, 회수를 기록하고("Hunting bow: 2 left to shoot.", "Ada loads 1 into Watch pistol: 1 of 1 loaded."), 아이템 세부 정보와 Game Master의 줄은 무기가 쏘는 것과 담는 것을 알려 줍니다. `ammunition Arrow (1 an attack, 50% picked up after a won fight)`와 `holds 1, reload (Act)`입니다.

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

### 모드, 두 번째 무기, 하한, 명중 시 상태

무기는 공격하는 다른 모드, 보조 손의 짝, 최소 피해, 명중한 대상에 거는 상태를 가질 수 있습니다(Capability API 1.58). Ember Roads의 사냥용 활은 일제 사격을 할 수 있고, Gravewatch의 은 관못은 양손에 하나씩 들 수 있으며 깊이 박힌 대상에게 표식을 남깁니다.

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: 공격하는 다른 모드 최대 여섯 개이며 각각 `id`, `label`, 바꾸는 내용을 가집니다. `ammo`는 그 모드의 공격 한 번이 쏘는 수이므로 무기에 쏠 `ammo`나 `clip`이 있어야 합니다. `toHit`은 명중에 더하는 값으로 풀 전투에서는 주사위, 합산 전투에서는 숫자입니다. `target`은 풀의 목표를 옮길 수 있을 때 풀 전투의 주사위별 목표(무기 자체 목표, 없으면 풀의 목표)를 이만큼 옮깁니다(`+1`은 더 어려움). `targets`는 겨눌 수 있는 대상 수이며 대상마다 공격 굴림을 따로 합니다. 전투 메뉴는 공격을 고른 뒤(우선권 방식이 있으면 그 방식 다음에) 각 모드의 예상 결과와 함께 어떤 모드를 쓸지 한 번 묻고, 보유자가 쏠 탄이 충분한 모드만 제공합니다. Engine이 조종하는 파티원은 한 대상을 겨누는 모든 모드를 평가하고, 여러 대상을 겨누는 모드는 플레이어에게 맡깁니다. 창 안에서 하는 공격은 기본 모드 그대로 합니다.
- `offHand`: 보조 손용 무기입니다. 전투 블록이 두 번째 공격이 소모할 예산과 그 피해에 양수 능력치를 유지할지 정합니다.

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  이번 턴에 `offHand`로 표시된 무기 하나로 공격했다면, 착용 중인 다른 그런 무기는 각각 그 예산으로 두 번째 공격을 제공하며 메뉴에는 "Silver coffin nail, off hand"로 표시됩니다. `ability`는 `full`(기본값) 또는 `penalty-only`이며, 후자는 5e의 쌍수 전투처럼 피해 능력치가 값을 깎을 때만 더합니다. 보조 손 공격은 주 공격이 몇 번의 타격을 얻든 한 번의 타격이며, 걸어 나가는 상대에 대한 타격으로는 쓰이지 않습니다. `offHand`로 표시된 무기에는 전투 블록의 `offHand`가 필요합니다. `fullWhen`(Capability API 1.97)은 전투원 시트의 값입니다. 0보다 크면 `ability`가 무엇이든 그 전투원의 보조 손은 능력치 전체를 유지합니다. 5e의 Two-Weapon Fighting 전투 방식이 그렇습니다.

- `floor`: 명중이 주는 최소 피해로 직접 쓰거나 아이템의 숫자 스탯에서 읽습니다. 풀 전투의 흡수 후 피해나 합산 전투의 피해를 저항으로 절반이 되기 전에 이 값까지 올리며 로그에 알립니다. 소비 타격은 공격자의 수치를 던지므로 올리지 않습니다.
- `onHit`: 타격이 준 피해가 `atLeast`에 도달하면 대상이 받는 상태 최대 네 개이며, 대상 자신의 턴으로 `rounds`만큼, 없으면 무언가 해제할 때까지 유지합니다. 피해는 흡수와 저항 뒤 실제로 들어간 양입니다. 빼앗는 타격은 피해 대신 우선권을 빼앗으므로 상태를 걸지 않습니다.
  항목은 `save: { "save": <save id>, "difficulty": n }`도 가질 수 있으며, 상태가 걸리려 할 때 대상이 굴려 성공하면 막습니다. `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`는 보유자가 각 턴의 시작이나 끝, 또는 영보다 큰 피해를 받을 때 그 내성에 성공할 때까지 상태를 유지하게 합니다(이때는 `rounds`가 없음). 둘 다 그 상태에 대한 내성으로 세며, 무기가 마법이면 마법에 대한 내성으로도 셉니다(Capability API 1.169). 5e의 sword of wounding은 `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`입니다.
- `plus`: 명중마다 더하는 최대 세 개의 추가 양으로, 각각 `{ "dice", "flat", "type", "save", "targetIs", "when" }`이며 따로 굴리고, 자체 유형을 가지며, 따로 저항받습니다(Capability API 1.169). `save`는 자체 `difficulty`와 `onSuccess`(`half` 또는 `none`)를 지정합니다. `targetIs`는 그 생물 유형이나 태그의 대상에게만 줍니다(전투 페이지의 [모든 키](ruleset-combat.md#every-key)에 있는 '생물 유형과 대상 검사' 참고). `when: "critical"`은 치명타에서만 줍니다. 모든 절의 주사위는 무기의 주사위처럼 치명타에서 두 배가 됩니다. javelin of lightning은 `{ "dice": "4d6", "type": "lightning" }`, dragon slayer는 `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`, sword of sharpness는 `{ "flat": 14, "type": "slashing", "when": "critical" }`입니다. 예측은 절이 닿는 대상에 대해서만 세며 치명타 전용 절은 세지 않습니다. `when: "toggled"`는 아이템의 스위치가 켜진 동안에만 줍니다(Capability API 1.170, 아래 `toggle` 참고).

무기 세부 정보와 Game Master의 줄이 이를 모두 알려 줍니다. `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon`, `Marked for 2 rounds when a hit deals 2 or more`입니다.

<a id="armor-and-worn-effects-in-a-fight"></a>

## 전투 중 방어구와 착용 효과

착용하거나 소지한 동안 아이템이 하는 일은 보유자의 상태, 단계와 함께 전투도 바꿀 수 있습니다(Capability API 1.56). 각각 전투가 읽는 상태의 부분을 받습니다.

- `effects`: 단계가 가질 수 없는 다섯 가지(`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`)를 뺀 모든 상태 효과입니다. 아이템은 누가 보유자에게 건 것이 아니고 저절로 끝나지도 않기 때문입니다. `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` 등입니다.
- `modifiers`: 상태와 똑같이 판정과 내성뿐 아니라 방어, 공격, 속도에 대한(`to`) 변경입니다. `dice-pool` 전투에서 공격에 대한 변경은 상태와 마찬가지로 고정 주사위 수입니다.
- `resist`, `vulnerable`, `immune`: 생물과 마찬가지로 보유자가 절반, 두 배, 또는 전혀 받지 않는 피해 종류입니다(`combat.damageTypes`를 선언했다면 그 목록으로 검증). `conditionImmunities`: 보유자에게 절대 걸리지 않는 자체 상태입니다.

Gravewatch의 저주받은 과부의 반지는 모든 공격에서 주사위 하나를 잃게 하고, 귀속한 Dawn bell은 보유자가 동요하지 않게 하며, 소지한 Ember Roads 이정석은 열기를 막아 줍니다.

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

전투는 판정과 마찬가지로 각 아이템을 묶음 이름으로 한 번 읽습니다(로그의 굴림 옆과 방어에 "Widow's ring"). 충족하지 못한 요구 조건의 `otherwise`도 전투에서 적용되므로 착용자에게 너무 무거운 방어구는 속도를 깎을 수 있습니다. 아이템 세부 정보와 Game Master의 줄이 이를 모두 알려 줍니다("While worn: -1 on attacks", "worn: +1 on checks (Ward), immune to Rattled"). 방어나 흡수에 단순히 더하는 방어구는 `itemStat`으로 읽는 아이템 스탯이며(시트의 아이템 참고), Ember Roads의 Guard가 착용한 외투를 읽는 방식입니다.

**경도.** 우선권이 공격으로 움직이는 수치일 때 `combat.pool.hardness`는 전투원의 경도로, 전투가 시작될 때 시트에서 읽습니다(`itemStat`으로 방어구의 경도를 읽음). 생물은 자체 `hardness`를 줍니다. 주사위가 경도보다 낮은 소비 타격은 명중해도 아무 효과가 없습니다. 공격자의 수치는 그래도 기준값으로 돌아가고, 로그에 알리며("Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing."), 메뉴도 피해를 예상하지 않습니다. 소비 방식이 있는 규칙 집합만 가질 수 있으며, 시트로 작성한 생물은 시트에서 가져옵니다.

<a id="using-items-in-a-fight"></a>

## 전투 중 아이템 사용

아이템은 전투에서 사용할 수 있습니다(Capability API 1.59). 상처에 대는 습포, 삼키는 강장제, 울리는 종 등입니다. `use`는 카탈로그 항목의 `mechanics`와 같은 어휘로 사용 효과를 정합니다([전투가 `mechanics`에서 읽는 것](ruleset-combat.md#what-a-fight-reads-from-mechanics) 참고). `kind`(`heal`, `attack`, `buff`, `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire`, 그리고 Capability API 1.174부터 `concentration`과 `zone`이며, 여기에 소모하는 `budget` 또는 `free`를 함께 씁니다. Ember Roads의 습포, Gravewatch의 데우는 강장제와 새벽 종은 다음과 같습니다.

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

- 사용은 전투 메뉴의 **Items**(아이템) 아래에 묶음 이름과 관계없이 아이템 이름("Poultice")으로 나옵니다. 슬롯을 차지하거나 귀속하는 아이템은 종처럼 착용한 동안(귀속하는 아이템이면 귀속한 동안도) 사용하고, 그 밖의 아이템은 소지한 동안 사용합니다.
- 예산을 소모하거나 `free`이며 아이템 자체로 지불합니다. `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard`, `rider`는 시트가 보유한 카탈로그 항목용이므로 사용에서는 거부합니다.
- `attackRoll`이 있는 사용의 `toHit`은 무기의 `toHit`과 같은 방식으로 명중에 더하는 값입니다(전투 중 무기 참고). 능력치, 기술, 보너스, 풀 전투에서는 주사위별 목표입니다. 없으면 굴림에 아무것도 더하지 않습니다.
- `saveDifficulty`: 사용이 요구하는 내성(자체 내성, 부여한 상태를 끝내는 내성, `difficulty`가 없는 절의 내성)을 굴릴 때의 목표 숫자로, 직접 쓰거나 아이템의 숫자 스탯에서 읽습니다. 시트의 항목은 카탈로그 출처에서 이 숫자를 읽지만 아이템에는 출처가 없으므로 직접 지정합니다.
- `consumes: true`는 사용할 때마다 아이템 묶음에서 하나를 빼며 메뉴에 남은 수를 표시합니다. 마지막 하나를 쓰면 묶음이 사라집니다.
- `restore`(Capability API 1.60)는 혈액 주머니가 피를 돌려주듯, 효과가 닿은 각 시트의 풀을 일부 돌려줍니다. `{ "pool": "resolve", "amount": { "flat": 1 } }`처럼 쓰며 `amount`와 같이 `dice`와 `flat`을 씁니다. 실시간 풀 하나를 지정하며 체력 풀은 지정할 수 없고(체력은 회복으로 돌아옴), `heal`이나 `buff`처럼 돕는 사용에만 둡니다. 생물에게는 풀이 없으므로 받지 않습니다. 로그에 기록되며("Ada gets back 1 Resolve, and is on 3 of 4."), Engine이 조종하는 파티원은 가득 찬 풀에는 쓰지 않습니다. Gravewatch의 데우는 강장제는 회복과 함께 Resolve 1점을 돌려줍니다.
- `charges`는 아이템 자체 `charges`를 그만큼 소모합니다. 그 `max`는 담는 양으로 1부터 100까지이며 직접 쓰거나 아이템의 숫자 스탯에서 읽습니다(그 스탯을 1 미만으로 주는 아이템은 거부하고, 100을 넘으면 100을 담습니다). 충전 수는 아이템의 인벤토리 묶음에 저장하므로 한 전투에서 두 번 울린 종은 다음 전투에서 충전이 하나 남고, 아무도 울리지 않은 종은 가득 찬 상태입니다. 충전은 아이템 하나의 것이므로 충전을 담는 아이템의 `stack`은 1입니다. 사용은 소진되거나 충전을 쓰며 둘 다 하지는 않고, 아이템의 충전은 항상 그 사용이 소모합니다. Gravewatch의 새벽 종처럼 `charges`에는 키 두 개를 더 넣을 수 있습니다(Capability API 1.61).

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: 어느 `rests`가 충전을 돌려주는지, 얼마나 돌려주는지입니다. `"max"`는 가득 채우고, 양(`{ "dice": "1d6", "flat": 1 }`)은 그만큼 돌려주되 `max`를 넘지 않습니다. 휴식은 시트의 Rest 버튼으로 하든 Game Master의 `[sheet: op="rest"]`로 하든, 그 캐릭터가 지닌 아이템 중 그 휴식을 지정한 모든 아이템의 충전을 돌려줍니다. 시트와 가방은 함께 기록하며, 재생성한 답변은 한 번만 재충전합니다. 시트는 휴식 후 돌아온 것을 알려 주고("Dawn bell 3/3 charges"), Game Master는 인벤토리에서 각 아이템 옆에 남은 충전을 봅니다("2 of 3 charges left").
  - `breaksOn`: 사용이 마지막 충전을 소모하면 Engine이 d`die`를 굴리고, `atMost` 이하이면 전투 안팎에서 아이템이 부서져 가방에서 사라집니다. 전투 로그("Dawn bell breaks (a 1 on its die).")와 Use 버튼의 보고("Its last charge spent, it breaks.")에 나오며, 일지는 잃은 것으로 셉니다.

- `gate`(Capability API 1.62)는 아이템이 작동하기 전에 사용자가 통과해야 하는 판정입니다. 읽는 사람의 수준보다 높은 주문의 두루마리가 판정을 요구하는 것과 같습니다. `check`는 굴릴 것을 지정합니다. `{ "skill": "ward" }`, `{ "ability": "wits" }`, 또는 시트 값(`{ "value": { "derived": "spell_mod" } }`, 5e 시전자의 주문 시전 수정치처럼 캐릭터마다 다른 숫자용)입니다. `difficulty`는 1부터 100까지이며 직접 쓰거나 아이템의 숫자 스탯에서 읽습니다(값을 주지 않는 아이템은 메뉴에서 제외하고 Use 버튼이 이를 분명히 알립니다). `unless`는 사용자 시트의 값이 `atLeast` 이상이면 판정을 건너뜁니다. 판정에 실패하면 아무 효과 없이 아이템을 소진합니다(또는 충전을 소모합니다). 전투에서는 아이템을 소모할 때 전투 자체 주사위로 판정을 굴리며(풀 전투에서는 풀이고 `difficulty`가 필요한 성공 수), 전투 시작 시 읽은 시트 숫자를 쓰고, 기술 자체를 포함해 사용자의 상태와 착용 아이템이 그 판정에 더하는 것도 셉니다. 로그에 기록됩니다("Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success."). Gravewatch의 철야 기도문 한 장에 이것이 있습니다.

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

전투가 소진한 것과 남긴 충전은 무기의 사격처럼 각 단계마다 인벤토리에 기록되며, 일지에 사용한 것이 나옵니다. 전투 로그는 각 사용을 기록합니다("Poultice: 1 of 2 left.", "Dawn bell: 2 of 3 left."). Engine이 조종하는 파티원은 다친 사람에게만 회복을 쓰며, 걸어 나가는 상대를 치는 데 아이템을 쓰는 사람은 없습니다. 아이템 세부 정보와 Game Master의 줄은 사용 효과를 알려 줍니다. "Use (Action): heals 1d4 + 1, range 0 paces, used up"과 `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`이며, 세부 정보에는 남은 충전도 나옵니다. Game Master가 규칙 집합의 아이템을 `like=`로 지정해 창작한 아이템은 충전을 포함해 그 아이템과 같은 방식으로 사용합니다.

## Classic 및 Tactical 전투의 아이템

자체 전투를 해결하지 않는 규칙 집합은 Game Mode 자체의 Classic과 Tactical 전투에 맡기며, 여기서는 전투가 시작될 때 모델에게 인벤토리 아이템이 하는 일을 묻습니다. 규칙 집합의 아이템은 추측하지 않습니다. `use`가 있는 각 아이템은 Engine 자체 수치로 거기 적힌 일을 하며, Game Master의 추측은 규칙 집합의 것이 아닌 아이템에만 묻습니다(`native: false`이면 아무것도 묻지 않습니다).

- `heal`은 회복하고 `attack`은 피해를 주며, `amount`의 평균에 따라 대상 최대 체력의 일정 비율만큼입니다. 기본 무기의 `1d8+3`인 평균 7은 5분의 1을 조금 넘으며, 20분의 1보다 작지 않고 최대 전부입니다. 전투 연결이 카탈로그 항목의 숫자를 읽는 척도와 같습니다. `damageType`은 속성입니다.
- `applies`의 첫 상태는 자체 이름의 상태로 `rounds`만큼(없으면 2) 걸리며, `buff`나 `debuff`는 그 상태만이고 Engine 자체 상태처럼 방어를 올리거나 내립니다.
- `targets`는 누구에게 사용하는지입니다. 없으면 회복이나 강화는 아군에게, 공격이나 약화는 적에게 갑니다.
- `consumes: true`는 묶음에서 하나를 빼고, 없으면 아이템은 그대로 남습니다.
- 명중 굴림, 내성, 범위, 임시 점수, 회복하는 풀은 카탈로그 항목의 `mechanics`와 마찬가지로 이 전투에서 쓸 곳이 없습니다. 메뉴의 아이템 설명에는 여전히 나옵니다.
- 규칙 집합 전투와 마찬가지로 슬롯을 차지하는 아이템은 착용한 동안만, 귀속하는 아이템은 귀속한 동안만 사용합니다. 소진되는 아이템은 착용한 것에서 가져가며 가방의 여분에서 가져가지 않습니다.
- `charges`를 쓰는 아이템은 사용이 남아 있는 동안 제공하며 Items 메뉴가 사용 횟수를 셉니다. 사용할 때마다 아이템 묶음에서, 플레이어 자신의 것부터 소모하며, 마지막 충전을 쓰면 `breaksOn`을 굴립니다. 부서지면 가방에서 사라지고 일지는 잃은 것으로 셉니다.
- 먼저 판정을 요구하는 아이템(`gate`)은 파티원이 사용할 때 서버에서 그 파티원의 시트와 착용한 것으로 판정을 굴리며(자체 카드가 없는 동료는 빈 시트로 굴리고, 플레이어 자신의 유닛만 플레이어 카드를 대신 씀), Use 버튼과 같은 방식이고 `unless`가 충족되면 건너뜁니다. 실패하면 아이템(또는 충전)을 소모하고 아무 효과도 없으며 로그에 기록됩니다. "Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing."
- `use`가 없는 아이템은 이 전투에서 제공하지 않으며, `amount`가 없는 회복도 마찬가지입니다.

Engine이 각 아이템의 효과를 직접 계산하므로, 화면이 보내는 내용이 아이템의 효과를 결정하지 않습니다.

<a id="loot"></a>

## 전리품

이긴 전투는 모든 Game Mode 게임에서 한 번, 파티의 가방에 전리품을 떨어뜨립니다. 규칙 집합이 없으면 Game Mode 자체 표에서 나오며(어려운 게임일수록 더 많고 희귀함), 전리품 표를 선언하지 않고 `native`를 켜 둔 규칙 집합도 마찬가지입니다. 전리품 표를 선언한 규칙 집합은 대신 자체 아이템을 떨어뜨리고, `native: false`이며 표가 없는 규칙 집합은 아무것도 떨어뜨리지 않습니다.

Gravewatch의 부장품처럼 `items` 블록의 `lootTables`(Capability API 1.63)가 표를 나열합니다.

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

- `rolls`는 표가 몇 번 뽑는지입니다. 0부터 20까지의 숫자나 주사위(`"1d2"`)이며 기본값은 1입니다.
- 각 뽑기는 다른 줄과 비교한 `weight`(기본값 1)에 따라 한 줄을 뽑습니다. 줄은 아이템 하나를 `<catalog>/<entry>`로 지정하거나, `rarity`, `category`, `tag`로 거르는 `filter`(일치하는 모든 아이템 중 고르게 고름), 또는 (Capability API 1.64) 동전 ID로 지정하는 `coins`입니다. `count`는 떨어지는 수로 숫자나 주사위이며 기본값은 1입니다. 레이어가 제외한 아이템이나 동전은 아무것도 떨어뜨리지 않으며, 찾는 것이 없는 필터도 마찬가지입니다.
- 도감 생물은 `loot`로 지닌 표를 지정합니다([생물](ruleset-combat.md#creatures-a-bestiary-a-fight-reads) 참고). 이긴 규칙 집합 전투는 쓰러뜨린 각 생물의 표를 굴리며, 규칙 집합의 규칙으로 해결하지 않는 전투에는 도감 생물이 없으므로 아무것도 떨어뜨리지 않습니다.
- 떨어진 것은 추가와 마찬가지로 공유 보기로 들어가 플레이어의 가방부터 받으며, 아무도 소지할 수 없는 것은 남겨 둡니다. Game Master가 받는 요약에는 떨어진 것과 이미 가방에 들어갔다는 사실이 나오고, 일지에도 기록되며 알림이 표시됩니다.
- Game Master는 이야기 중에 `[loot: table="grave_goods" who="Ada"]`로 표를 굴리며(`who=`는 한 캐릭터의 가방), 인벤토리 태그와 마찬가지로 턴이 시작된 시점을 기준으로 하므로 재생성한 답변은 한 번만 떨어뜨립니다. 떨어진 각 아이템은 추가처럼 응답하며, 지시문에 전리품 표를 나열합니다.

## 돈

`currencies`는 파티의 돈입니다. 동전은 가방 속 아이템이며 다른 것처럼 동전마다 묶음이 있고 `label`로 이름을 붙입니다.

- 그 계열의 동전 `perWeight`개마다 소지 스탯 한 단위의 무게가 나가며, 보유자의 적재량에 포함되고 들어올 때 소지 규칙에 따라 배치합니다. `perWeight`가 없는 계열은 무게가 없습니다.
- 플레이어는 선택기의 **Coins**(동전) 목록에서 동전을 추가하며, 다른 묶음처럼 나누고, 건네고, 합칩니다.
- 인벤토리 묶음 위의 한 줄에 보기 안의 각 계열 동전과 그 가치를 계열의 가장 작은 동전 단위로 표시합니다. Game Master는 각 가방 옆에 그 가치를(`Coin worth 432 pennies`, 빈 지갑은 `no coins`이며 플레이어의 가방은 비어 있어도 나열), 아이템 옆에 `cost`를(`costs 3 shillings`) 봅니다.
- Game Master는 `[inventory: action="pay" amount="3 shillings" who="Ada"]`로 지불하고 `action="earn"`으로 받습니다. `amount`는 개수와 동전이며 동전은 ID나 라벨로, 단수든 복수든, 대소문자와 관계없이 씁니다(`1 penny`, `12 pennies`). 지불은 한 가방(`who=`가 없으면 플레이어의 가방)에서 그 동전의 계열 안에서만 합니다. 맞는 가장 큰 동전부터 내고, 그다음 아직 남은 금액을 감당하는 가장 작은 동전을 깨며, 거스름돈은 그 계열의 더 작은 동전으로 큰 것부터 돌려받습니다. 응답은 지불한 것과 돌려받은 것을 알려 줍니다. 크라운 하나가 든 지갑에서 3실링을 내면 `Paid with crowns ×1; shillings ×2 back.`입니다. 가방으로 감당할 수 없는 지불은 거부하며(`cannot-afford`), 없는 동전(`unknown-coin`)과 화폐가 없는 규칙 집합의 모든 지불(`no-currencies`)도 거부합니다. 받기는 그 동전의 추가이며 `who`의 가방에 넣거나 소지 규칙에 따라 나눕니다. 일지는 쓴 것과 번 것을 나열하고 알림이 표시됩니다. 지시문에는 동전을 나열하며, 동전이 있는 규칙 집합에만 이 지시문이 있습니다.
- 구매는 지불 후 추가이거나, 시장이 있는 규칙 집합에서는 `buy`입니다(아래 참고). 상점 화면은 없습니다.

## 시작 장비

`items.startingGear`(Capability API 1.78)는 캐릭터가 시작할 때 가방에 받을 수 있는 장비를 나열합니다. 클래스의 꾸러미, 배경의 꾸러미, 소명의 꾸러미 등입니다. 저절로 주어지지는 않습니다. 인벤토리에 **Starting gear**(시작 장비) 줄이 표시되며, 플레이어는 장비 하나, 각 선택의 선택지, 각 목록의 아이템을 고른 뒤 플레이어의 가방이나 파티원의 가방에 받습니다. 캐릭터 시트가 `fits`하는 장비가 먼저, 그다음 `fits`가 없는 장비(배경의 것처럼 아무 캐릭터용)가 나열됩니다. 캐릭터의 콘셉트는 플레이어와 Game Master가 합의할 일이므로 모든 장비가 제공됩니다.

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

- 줄은 규칙 집합의 아이템(`item`), 동전(`coins`, 단위 ID), 고정 목록에서 플레이어가 고르는 아이템 하나(`oneOf`, 아이템 2~48개), 또는 이름으로 지정한 일반 아이템(`name`. `freeform`이 일반 아이템을 허용할 때이며, 라벨 규칙을 따르므로 대괄호, `{{`, 줄바꿈 불가) 중 하나입니다. `count`는 1~999이며, `equip: true`는 슬롯이 비어 있으면 받을 때 아이템을 착용하므로 방어구가 처음부터 적용됩니다.
- `choices`는 0~8개이며 각각 자체 줄을 가진 선택지 2~6개를 가집니다.
- `group`: 캐릭터가 그룹마다 한 번 받는 장비입니다(클래스의 것과 배경의 것). 같은 그룹을 다시 받는 것은 플레이어가 대화 상자에서 하는 선택이며, 이미 가방에 있는 것에 더해집니다. 그룹이 없는 장비는 자체 그룹이며, 같은 이름의 그룹과는 결코 같지 않습니다.
- `fits`는 소지와 마찬가지로 실시간 상태 없이 시트를 읽습니다. 목록 순서만 정합니다.
- 받기는 전부 아니면 전무입니다. 보유자에게 너무 무거운 장비는 통째로 거부하며, 대화 상자가 무게와 아직 소지할 수 있는 양을 알려 줍니다. 레이어가 게임에서 제외한 아이템은 빼고 이름을 알리며, 아이템이 모두 제외된 목록도 마찬가지입니다. 레이어가 제외한 동전은 같은 가치의 남은 가장 큰 동전으로 지급하며 대화 상자도 그렇게 보여 줍니다. 남는 것이 없는 장비는 거부하므로 아무것도 없이 받은 것으로 표시되지 않습니다. 서비스는 목록에서 제공하지 않습니다.
- 가져오기는 모든 아이템(인라인 카탈로그의 것. 별도 파일의 카탈로그는 장비를 받을 때 검사), 동전, 일반 아이템, `fits` 참조를 검사하며, 서비스를 거부하고, 가방이 한 번에 받는 것보다 많은 묶음이 필요한 개수를 거부합니다.

## 시장

`items` 블록의 `market`(Capability API 1.65)은 모든 상점이 모든 것을 정가에 파는 대신 어떤 장소가 무엇을 얼마에 파는지 정합니다. 다음은 Gravewatch의 시장을 조금 줄인 것입니다.

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

- `prices`: 가격 단계 1~8개이며 각각 아이템 `cost`에 곱하는 배수(`times`, 0보다 큼)이고 하나가 `default`입니다. 가격은 계열의 가장 작은 동전 단위 비용에 단계를 곱해 그 단위로 반올림한 값이며(비용이 있는 것은 동전 하나 아래로 내려가지 않음), 비용을 적은 동전으로 정확히 지불할 수 있으면 그 동전으로, 아니면 레이어가 남긴 동전 중 정확히 지불할 수 있는 가장 큰 동전으로 표시합니다. `dear`에서 8실링짜리 외투는 12실링이고, 50 gp짜리 5e 물약은 금화 50개이며 백금화 5개가 되지 않습니다. 흥정이나 판매자의 기분은 숫자가 아니라 단계를 옮깁니다.
- `places`: 장소 크기 1~12개를 작은 것부터 작성자의 표현으로 씁니다.
- `sold`: 필터가 고른 것을 파는 가장 작은 장소에 대한 규칙입니다. 필터는 `rarity`, `category`, `tag` 중 무엇이든 지정하며 지정한 것을 모두 가진 아이템과 일치합니다. 아이템과 일치하는 첫 규칙이 결정합니다. 아이템 자체의 `sold`가 규칙보다 우선하며, 아무 규칙도 지정하지 않은 아이템은 어디서나 팝니다.
- `sellers`: 판매자 종류이며 각각 파는 것(`sells`, 하나라도 일치하면 아이템을 고르는 필터들), 판매자가 있는 가장 작은 `place`(없으면 어디나), 선택적으로 판매 대상을 제한하는 `only`를 가집니다. 판매 대상은 구매자 시트의 값(실시간 상태와 소지품 포함)이 `atLeast` 이상인 사람이며 Game Master에게는 `label`로 알려 줍니다. `sellers`가 없으면 장소의 누구든 그 장소가 파는 것을 팝니다.
- `cost`가 없는 아이템은 팔지 않으며, 레이어가 숨긴 아이템이나 레이어가 동전을 제외한 아이템도 마찬가지입니다.

**파티가 있는 곳.** Game Master는 `[place: name="Millbrook" size="market town"]`으로 장면이 어느 장소에 있으며 크기가 어떤지 알리고(크기는 ID나 라벨), 시장이 없는 곳(길, 황야)에서는 크기를 생략합니다. Engine은 각 태그에 그 자리에서 응답하며 없는 크기는 거부합니다. 최신 대화 시작부터 플레이어가 보는 Engine 자체 답변에서 마지막으로 응답한 장소가, 다른 장소를 말할 때까지 유효한 장소입니다. 플레이어가 입력한 장소 태그는 세지 않습니다. 재생성한 답변은 그것이 대체하는 답변보다 앞선 내용만 읽습니다.

**구매.** Game Master는 `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`로 구매하며, `level`(없으면 기본값)과 `seller`(없으면 여기서 그 아이템을 파는 아무 판매자)는 선택 사항입니다. Engine은 답변이 끝날 때 유효한 장소에서 가격을 매기고, 지불과 마찬가지로 구매자의 지갑(`who=`가 없으면 플레이어의 지갑)에서 거스름돈과 함께 가격을 빼고, 아이템을 가방에 넣거나 서비스이면 지불만 합니다. 둘 다 일어나거나 둘 다 일어나지 않습니다. 응답은 비용(`price="12 shillings"`)과 지불하고 돌려받은 것을 알려 주며 알림이 표시됩니다. 장소를 말하지 않았거나(`no-place`), 없는 단계·아이템·판매자이거나(`unknown-level`, `unknown-item`), 가격이 없거나(`not-for-sale`), 장소가 그 아이템에 비해 작거나(`not-here`), 여기서 그것을 파는 판매자가 없거나(`no-seller`), 구매자가 판매자의 `only`를 충족하지 못하거나(`not-to-you`), 지갑으로 감당할 수 없거나(`cannot-afford`), 가방이 소지할 수 없으면 구매를 거부하고 아무것도 바꾸지 않습니다.

**Game Master가 보는 것.** 장면이 시장이 있는 장소에 있는 동안 MARKET 블록이 장소와 크기, 가격 단계, 그곳의 각 판매자와 기본 단계에서 파는 것 열두 개를 싼 것부터 알려 줍니다. 판매자가 파는 것은 무엇이든 이름으로 살 수 있습니다. 지시문은 `[place:]`와 `buy`를 가르치며, 시장이 있는 규칙 집합에만 있습니다.

### 장날

장날(Capability API 1.69)은 장소의 진열대를 바꾸고 품절되게 하며, 파티가 되팔 수 있게 합니다. 다음은 Gravewatch의 설정을 조금 줄인 것입니다.

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

- **하루.** 한 장소의 하루는 Game Master가 다른 장소를 말할 때까지 이어집니다. 같은 장소를 `day="new"`와 함께 다시 말하면 새 날이 시작됩니다(`[place: name="Millbrook" size="market town" day="new"]`). 아래 모든 것은 플레이어가 보는 Game Master의 답변에서 날마다 계산하므로 스와이프, 재생성한 답변, 분기에 저장할 것이 없으며 같은 날은 항상 같은 진열대를 굴립니다.
- **`limited`**: `sold` 규칙이나 아이템 자체 `sold`에 두며, 한 장소가 하루에 보유하는 수량으로 숫자이거나 그날 굴리는 주사위입니다. 규칙은 장소 없이 제한만 지정할 수 있습니다(어디서나 팔지만 몇 개씩). 아이템의 장소는 장소를 지정한 첫 규칙에서, 제한은 제한을 지정한 첫 규칙에서 옵니다. 다 팔리면 새 날까지 구매를 거부합니다(`sold-out`).
- **`stock`**: 판매자에 두며, 판매하는 것 외에 그 판매자가 재고로 가진 것을 정하려고 하루에 한 번 굴리는 전리품 표 하나입니다. 굴린 것(아이템만이며 동전은 제외)은 `sells`나 `sold`와 관계없이 그 판매자만, 굴린 수만큼 팝니다. 판매자의 `only`는 여전히 적용됩니다.
- **`buyBack`**: 판매자가 아이템을 사들일 때 지불하는 기본 가격의 비율(0 초과, 최대 1)입니다. 여기서 그런 종류를 파는 판매자가 사들입니다(판매자가 없으면 누구나). `buyBack`이 없으면 아무도 되사지 않습니다.
- **`purse`**: 장소 크기에 두며, 그곳 판매자들이 하루에 지급하는 최대 총액을 동전 하나로 정합니다. 그 동전 계열로 지급하는 판매가 이 자금에서 차감되며, 자금이 없으면 한도 없이 사들입니다.
- **판매.** Game Master는 `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`로 판매합니다. Engine은 가격을 매기고 파는 사람의 가방(`who=`가 없으면 플레이어의 가방이며 귀속된 저주 아이템은 제외)에서 아이템을 꺼내 동전을 큰 것부터 넣거나, 거부하고 아무것도 바꾸지 않습니다. 장소를 말하지 않았거나, 여기서 아무도 그것을 사지 않거나(`not-bought`), 가격이 없거나(`not-for-sale`), 오늘의 자금이 소진되었거나(`purse-spent`), 지닌 것이 없거나, 가방이 동전을 소지할 수 없는 경우입니다. 응답은 판매 금액(`price="4 shillings"`)을 알려 주고, 일지는 판매로 기록하며 알림이 표시됩니다.
- MARKET 블록에는 각 판매자의 오늘 재고, 수량 제한 아이템의 남은 수, 이곳 판매자가 사들이는 것과 오늘 자금의 남은 양이 더해지며, 지시문은 `sell`과 `day="new"`를 가르칩니다.

### 정직한 판매자와 부정직한 판매자

Capability API 1.79부터 아이템은 위험하거나 가짜일 수 있고, 판매자는 부정직할 수 있습니다.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- 아이템의 **`risky`**: 정직한 판매자가 팔기 전에 경고하는 내용입니다. MARKET 블록은 정직한 판매자의 물건 옆에 "(warn the buyer first: ...)"와 함께 이를 나열하며, 부정직한 판매자는 아무 말도 하지 않습니다.
- 아이템의 **`passesFor`**는 그것을 다른 아이템(`<catalog>/<entry>`)의 가짜로 만듭니다. 대상은 같은 분류이고, 같은 슬롯에 착용하며, 가짜가 귀속하면 귀속하는, 실제로 팔 수 있는 아이템이어야 합니다. 둘 다 읽을 수 있으면 가져올 때, 모든 카탈로그 파일에 대해 설치할 때, 시장이 제공할 때 다시 검사하므로, 대상이 없거나 레이어에 숨겨진 가짜는 결코 팔리지 않습니다. 저주받은 아이템(`binds.cursed`)이나 가짜는 누구의 판매 물건에도 들지 않으며, 정직한 판매자의 재고에도 들지 않습니다.
- 판매자의 **`honest: false`**: 그 `stock` 표가 굴린 가짜는 그것이 흉내 내는 아이템으로 그 가격에 제공되며, MARKET 블록은 그 옆에 Game Master에게 진실을 보여 줍니다. 그 판매자와 그 아이템을 지정한 구매는 가짜를 받으며, 판매자를 지정하지 않은 구매는 결코 받지 않습니다.
- **가방 속 가짜**는 플레이어가 보는 모든 곳(가방, 일지, 알림, 전투)에서 흉내 내는 아이템으로 보이며, 진짜 정체를 유지합니다. Game Master의 인벤토리 블록은 이를 `[FAKE: really ...]`로 표시하고 보이는 이름으로 계속 부르라고 요청합니다.
- **들통나기**: `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, 귀속(조율하면 저주가 드러남), 사용(진짜 효과가 일어나며, 규칙이 계산하는 것이 없으면 Game Master가 알려 줌), 또는 정직한 구매자에게 판매(진짜 정체를 말하고 그 가치, 즉 자체 `cost`만큼 지불하거나, 없으면 거부)입니다. 부정직한 구매자는 가짜를 보이는 대로 받습니다. 그때부터는 진짜 아이템입니다.
- **착용하거나 소지할 때**: 가짜는 캐릭터 시트에서 진짜로 하는 일(`worn`이나 `carried` 효과와 스탯)을 합니다. 흉내 내는 아이템이라면 보이지 않을 숫자나 판정 보너스를 시트가 보여 주게 된 첫 인벤토리 변경 뒤에 들통나며, 일지와 화면이 그 정체를 알려 줍니다. 전투만 읽는 차이(저항)는 들통나게 하지 않으며, 시트만 바뀐 것도 다음 인벤토리 변경 전까지는 그렇습니다. 전투에서 착용한 가짜 무기는 여전히 흉내 내는 무기로 공격합니다.
- 단일 플레이어 신뢰 모드에서 Peek Prompt는 진실을 포함한 Game Master의 시야를 보여 줍니다.

<a id="spotting-fakes"></a>

### 가짜 알아보기

Capability API 1.802는 캐릭터가 직접 하는 판정이나 누군가 비용을 지불하기 전에 알아차리는 것으로 가짜의 실체를 파악할 수 있게 합니다. Engine은 어떤 판정도 이름으로 알지 못하며, 규칙 집합이 판정을 작성합니다.

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

- 가짜의 **`tells`**(최대 여섯 개): 각 항목은 누구나 할 수 있는 판정(`check`는 사용의 `gate`에서 지정하는 것과 같은 기술, 능력치 또는 시트의 값), 난이도 `dc`, 성공하면 알아내는 내용(`says`)입니다. `needs`는 판정 자체를 하려면 시트가 충족해야 하는 요건이며(`needsAny`를 쓰면 그중 하나만 충족하면 됨), `carries`는 판정자가 자신의 가방에 가지고 있어야 하는 아이템입니다. 도구 판정에 쓰는 도구 세트 등이 이에 해당합니다. `advantageIf`의 항목 중 하나라도 충족하면 이점으로, `disadvantageIf`의 항목 중 하나라도 충족하면 불리점으로 굴립니다.
- 부정직한 판매자의 **`manner`**: 아이템 대신 판매자를 대상으로 하는 판정으로, 구성 요소는 같습니다. 성공하면 판매하는 물건에 뭔가 이상한 점이 있다는 사실만 알려 주며, 무엇이 이상한지는 결코 알려 주지 않습니다.
- **조사하기**: `[inventory: action="inspect" item="Potion of Healing" who="Mira"]`는 Mira의 가방에 있는 아이템을 살펴보며, `seller="Fence"`는 누군가 구매하기 전에 이곳의 판매자가 오늘 내놓은 물건을 살펴봅니다. 가짜를 알아볼 수 있는 규칙 집합에서 제공하는 인벤토리의 **Inspect**(조사) 버튼은 Game Master가 태그를 작성하도록 "내 Potion of Healing을 믿고 사용하기 전에 주의 깊게 살펴봅니다."라고 말합니다. Engine은 규칙 집합 자체의 주사위로 가짜의 단서와 부정직한 판매자의 태도에 대해 그 캐릭터가 할 수 있는 가장 유리한 판정을 굴립니다. 가짜에 대한 판정에 성공하면 의심스러운 물건으로 봅니다. 응답에는 무엇을 보았는지 나오고, 가방에는 여전히 흉내 내는 아이템의 이름으로 표시되면서 "Mira는 가짜라고 생각함"이 나옵니다. 단서에 대한 판정에서 난이도를 `items.namesItAt` 이상(5e에서는 5) 웃돌아 성공하면 정체도 밝혀지며, 그때부터는 진짜 아이템이 됩니다. 진짜 아이템은 그것을 흉내 내는 가짜의 단서를 굴리므로, 조사 요청 자체로는 아무것도 드러나지 않으며 성공하면 진품으로 보인다고 알려 줍니다. 각 캐릭터는 아이템마다 한 번씩 시도합니다(묶음은 누가 시도했는지 유지하고, 판매 물건은 해당 장날 동안 기억함). 실패하면 구별할 수 없다고 알려 줍니다. 정체를 드러낼 단서가 전혀 없는 아이템이나 캐릭터가 어떤 판정도 할 수 없는 아이템은 `nothing-to-check`로 거부하며, 시도 횟수는 소모하지 않습니다.
- **구매 전 알아차리기**: 부정직한 판매자에게서 가짜를 받게 되는 구매라면, 일행의 다른 모든 구성원이 그 아이템과 판매자에 대해 할 수 있는 판정을 각각 주사위 없이 계산합니다. `items.passiveBase`(기본값 10)에 자신의 수치를 더하고, 이점이 있으면 5를 더하며 불리점이 있으면 5를 뺍니다. 처음으로 난이도를 충족한 구성원이 알아차립니다. 아무것도 지불하지 않으며, 구매에 대한 응답은 `reason="held"`와 함께 누가 무엇을 알아차렸는지 알려 줍니다. Game Master에게는 그 동료가 캐릭터로서 구매자에게 경고하는 장면을 연기하되, 그 동료의 성격상 그럴 법한 경우가 아니라면 판매자 면전에서 비난하지 말고, 구매자가 결정하도록 하라고 요청합니다. 플레이어에게는 그 밖의 어떤 내용도 알려 주지 않습니다. 그날 그 판매자에게 같은 구매를 다시 요청하면 구매가 진행됩니다. `items.warnBy: "roll"`은 대신 해당 판정들을 굴립니다.
- **가짜 간파하기**: `items.revealsFakes`는 캐릭터가 아이템에 시전하여 가짜를 간파할 수 있는 수단(주문, 의식)을 나열합니다. 각 수단에는 `id`와 `label`이 있으며, 일부 가짜만 간파하는 수단에는 그 가짜가 가진 `tags` 또는 참조로 지정한 가짜 자체(`items`, 가짜만 지정할 수 있음)가 있습니다. 가짜를 직접 지정하면 정체를 드러내는 태그를 붙이지 않아도 됩니다. 독 물약에 "독" 태그를 붙이면 그것이 흉내 내는 회복 물약 옆에서 정체가 드러나게 됩니다. `[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]`는 수단 하나를 지정합니다. 그 수단이 판별할 수 있는 가짜는 정체가 밝혀지고, `foolsReveal`에 그 수단을 나열한 가짜는 흉내 내는 아이템으로 보이며, 그 수단이 판별할 수 없는 가짜나 진짜 아이템은 아무것도 드러내지 않습니다(모든 가짜를 판별하는 수단이면 "진품", 그 밖에는 "불확실"). 시도 횟수는 소모하지 않습니다. 시전에 드는 비용은 어떤 주문이든 마찬가지로 Game Master가 처리합니다.
- 이 중 어느 하나라도 사용하는 규칙 집합은 Capability API 1.802가 필요합니다. 가짜가 아닌 아이템에 가짜의 `tells`나 `foolsReveal`을 지정한 경우, `carries`의 아이템이나 `revealsFakes`의 아이템이 규칙 집합에 속하지 않는 경우(`items`에는 가짜여야 함), `revealsFakes`에 나열되지 않은 ID를 `foolsReveal`에 지정한 경우에는 설치 시 거부합니다.

<a id="using-items-outside-a-fight"></a>

## 전투 밖 아이템 사용

같은 `use`가 전투 밖에서도 작동합니다(`restore`는 Capability API 1.60이며 나머지는 새로 필요한 것이 없습니다). `use`가 있는 아이템의 인벤토리 **Use** 버튼과 Game Master의 `[inventory: action="use" item="Poultice" who="Juno"]`는 모두 Engine의 주사위로 아이템을 지닌 사람에게 아이템의 효과를 적용합니다.

- 회복은 체력을 돌려줍니다. 전투의 회복과 마찬가지로 체력 풀에는 그 양을 더하고 일반 체력 트랙에서는 그 양을 빼며, 부상 트랙에서는 표시 하나를 지웁니다. `temporary` 점수는 체력 풀에 쌓이고, `restore`는 해당 풀을 돌려주며, `applies`의 각 상태는 무언가 해제할 때까지 걸립니다.
- 피해를 주거나 상대편을 겨누는 사용(`kind`가 `attack`이나 `debuff`, 또는 `targets`가 `enemy`)은 아무에게도 닿지 않습니다. 전투 밖에는 칠 대상이 보드에 없기 때문입니다. 아이템은 여전히 사용되며 Game Master는 서술하도록 그 효과를 안내받습니다.
- 전투와 똑같이 묶음에서 하나를 빼거나 충전을 소모하며, 남은 것이 없거나, 슬롯을 차지하거나 귀속하는데 착용하지 않은 아이템은 거부하고 아무것도 바꾸지 않습니다. 시트와 가방은 함께 기록합니다.
- `gate`는 판정처럼 먼저 굴립니다. 규칙 집합 자체 주사위와 시트 숫자, 사용자의 부상 페널티, 상태와 착용·소지 아이템이 그 판정에 주는 효과를 씁니다. 실패하면 아무 효과 없이 아이템을 소진하며 그 줄에 알립니다("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

결과는 한 줄로 알립니다. "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." Use 버튼은 "I use my Poultice." 뒤에 `[item_used]` 블록으로 이를 Game Master에게 보내며, 채팅은 이를 배지로 표시합니다. Game Master 자신의 태그도 이것으로 응답하며, 다른 태그처럼 턴이 시작된 시점을 기준으로 하므로 재생성한 답변이 아이템을 두 번 쓰지 않습니다. `use`가 없는 아이템이나 규칙 집합이 없는 게임에서는 여전히 단순히 "I use my rope."라고 말합니다.
