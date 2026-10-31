# 규칙 집합 캐릭터 빌더

이 페이지는 [Game Mode 규칙 집합 작성하기](writing-rulesets.md)의 일부입니다. 종족과 클래스부터 점수, 숙련, 주문과 장비까지 단계별로 캐릭터를 만드는 안내형 빌더를 설명합니다.

시트는 `sheet.builder`를 선언할 수 있습니다(Capability API 1.86). 그러면 캐릭터·페르소나 편집기와 게임의 **Edit sheet**(시트 편집)에 있는 시트 편집기가 전체 양식(**All fields**(모든 필드)) 옆의 **Guided**(안내형) 보기로 열립니다. 위쪽에 단계가 나열되며 각 단계에는 아직 기다리는 선택 수를 세는 배지가 있고, **Back**(뒤로)과 **Next**(다음)는 결코 막지 않으며(플레이어는 선택을 나중으로 미룰 수 있음), 그 옆에 현재 캐릭터가 표시됩니다. 단계가 쓴 것, 점수, `gm.sheetSummary`가 지정한 값(방어도, 숙련 보너스), 훈련된 내성과 기술입니다.

```json
"builder": {
  "tier": "proficient",
  "steps": [
    { "id": "race", "label": "Race", "kind": "catalog", "catalog": "races", "field": "race" },
    { "id": "subrace", "label": "Subrace", "kind": "catalog", "catalog": "races", "min": 0,
      "within": { "step": "race", "filter": "parent" } },
    { "id": "class", "label": "Class", "kind": "catalog", "catalog": "classes", "field": "class" },
    { "id": "level", "label": "Level", "kind": "fields", "fields": ["level", "background"] },
    { "id": "scores", "label": "Ability Scores", "kind": "abilities", "methods": {
      "pointBuy": { "budget": 27, "costs": [[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]] },
      "standardArray": [15, 14, 13, 12, 10, 8],
      "roll": { "count": 4, "sides": 6, "keep": 3 },
      "manual": true } },
    { "id": "skills", "label": "Proficiencies", "kind": "trained" },
    { "id": "gear", "label": "Equipment", "kind": "startingGear" }
  ]
}
```

단계는 최대 32개이며 각각 `{ id, label, kind, ... }`입니다. 16개를 넘는 패키지는 Capability API 1.112를, 24개를 넘는 패키지는 Capability API 1.768을 선언합니다.

- `catalog`: 행 카탈로그의 항목으로, **Info**(정보) 뒤에 `summary`가 있는 카드로 표시됩니다. `min`(기본값 1)은 단계가 요구하는 수이고 `max`(기본값 1)는 받는 최대 수이며, `max`가 1이면 새 선택이 이전 것을 대체합니다. 둘 다 최대 60까지 가능하며, 둘 중 하나가 20을 넘는 패키지는 Capability API 1.110을, 둘 중 하나가 40을 넘는 패키지는 Capability API 1.768을 선언합니다(20레벨 위저드의 주문책에는 주문 44개가 있음). `field`는 고른 라벨을 쓸 텍스트나 열거형 필드를 지정합니다(열거형 필드는 항목의 ID나 라벨 중 자기 값에 해당하는 것을 받음). `filters`는 카탈로그 필터 값을 고정하며, `within: { step, filter }`는 하위 종족이 종족을 지정하듯 `filter`가 그 앞 단계에서 고른 항목을 지정하는 항목만 제공합니다. 종족 선택을 취소하면 그 하위 종족은 셈에서 빠집니다. `upTo: { filter, value }`(Capability API 1.87)는 숫자 `filter`가 `value` 이하인 항목만 제공하며, 그 값은 현재 시트에서 읽습니다. 캐릭터 레벨까지의 특성(`{ "filter": "level", "value": { "derived": "level" } }`)이 그 예입니다. 필터가 없는 항목은 항상 제공되며, 시트가 그 아래로 내려간 선택은 셈에서 빠지지만 보존합니다. 읽는 값을 바꾸는 선택(레벨을 정하는 클래스)은 같은 변경 안에서 정리되며, **All fields**에서 바꾼 값도 마찬가지입니다(거기서 레벨을 낮추면 그보다 높은 특성이 준 것을 즉시 되돌림). `countFrom`(Capability API 1.90)은 같은 방식으로 시트에서 읽는 값으로 `min`과 `max`를 모두 대신합니다. 단계가 요구하는 항목 수이자 받는 최대 수이며, 내림하고 `max`를 넘지 않습니다. 캐릭터 레벨에서 클래스가 아는 주문 수(`{ "derived": "spells_known" }`)가 그 예입니다. 그 수를 넘는 선택은 보존하지만 수가 다시 오를 때까지 셈에서 빠집니다.
  카탈로그 단계는 `stamp`(Capability API 1.108)도 가질 수 있습니다. 추가하는 모든 행에 쓰는 열 값 1~4개로, 위저드 주문 단계의 `"stamp": { "class": "wizard" }`, 클레릭 주문 단계의 `"stamp": { "class": "cleric" }` 등입니다. 각 키는 카탈로그가 공급하는 모든 목록의 열이어야 하며 값은 문자열, 숫자, 불리언입니다. 스탬프는 카탈로그의 초기값을 대체합니다. 기존 행과 이후 **All fields**에서의 편집은 플레이어의 것으로 남습니다. Capability API 1.130부터 스탬프 값은 대신 `fromWithin`이 `"id"`, `"label"` 또는 상위 카탈로그가 선언한 필터 ID인 객체일 수 있습니다. 선택 순서대로 일치하는 첫 상위 항목을 읽어 행을 추가할 때 문자열이나 숫자를 한 번 쓰며, 일치하는 상위 항목이 없거나 그 필터가 없거나 배열이면 그 열에 스탬프를 남기지 않습니다.

  ```json
  {
    "id": "spells",
    "label": "Spells",
    "kind": "catalog",
    "catalog": "spells",
    "within": { "step": "class", "filter": "class_ids" },
    "stamp": { "class": { "fromWithin": "label" } }
  }
  ```

- `fields`: 이름 붙은 필드의 짧은 양식입니다. 배지는 `optional`에 나열한 것(나중 레벨에 고르는 하위 클래스)을 빼고 아직 빈 필드를 셉니다. `shownWhen: { "field_id": { "field": "level" } }`(Capability API 1.107)은 단계의 이름 붙은 필드를 값 참조가 현재 시트에서 0보다 크게 읽히는 동안만 표시하고 셉니다. 숨겨진 필드는 값을 유지합니다. `total: { "fields": ["level_bard", "level_other"], "max": 20 }`(1.107)는 단계의 숫자 필드 둘 이상을 합계 최대치(1~1000 정수)로 제한하며, 각 입력의 최댓값을 다른 필드의 현재 값만큼 낮추되 자체 최솟값 아래로는 내리지 않고, 합계가 한도를 넘으면 배지에 하나를 더합니다. **Next**는 여전히 작동합니다.
- `abilities`: 점수(`abilities`, 생략하면 전부)이며 `methods` 중 아무것으로나 설정합니다. `pointBuy`(모든 점수를 최고까지 사는 비용 이하의 `budget`, 그리고 모든 점수가 시작하는 가장 낮은 점수부터 하나씩 올리는 각 점수의 비용. 직접 입력한 점수는 표에서 가장 가까운 점수부터 시작), `standardArray`(점수마다 값 하나), `roll`(Engine 자체 주사위로 `sides`면 주사위 `count`개를 던져 높은 `keep`개를 쓰며, 점수마다 한 번 굴린 뒤 배열처럼 나눔), `manual`입니다. `manual: true`는 기존 점수 경계를 유지하고, `manual: { min, max }`(Capability API 1.110)는 부여 전에 입력한 기본 점수를 그 정수 경계로 제한하며(min은 -100 이상, max는 1000 이하, min은 max 이하), 각 능력치 자체 경계가 여전히 합계를 제한합니다. `default`(1.87)는 빌더가 빈 시트에서 시작하는 캐릭터가 처음 쓰는 방식입니다(나중에 규칙 집합의 기본값이 바뀌어도 유지). 따라서 예를 들어 초보자는 다른 방식을 고를 때까지 포인트 구매를 봅니다. 설명으로 만든 캐릭터는 이를 받지 않으며, 설명 뒤 플레이어가 방식을 고를 때까지 점수가 그대로입니다. **Manual entry**(직접 입력)는 경계 안에서 입력하는 편집으로 남고, **All fields**는 항상 있습니다. 선택이 더하는 것은 위에 얹히며, 단계는 기본, 보너스, 합계, 수정치를 보여 줍니다. abilities 단계는 최대 하나입니다.
- `allocate`(Capability API 1.152): 우선순위 배분이나 그룹 예산으로 단계별로 점을 나눕니다. 아래에서 설명합니다.
- `trained`: 선택이 제공하는 기술과 내성 선택, 그리고 단계 자체의 `choose: [{ "what": "skills", "count": 2, "from": [...] }]`(`from`을 생략하면 아무것이나)입니다.
- `startingGear`: 규칙 집합의 시작 장비를 나열합니다. 장비는 늘 그렇듯 게임에서 인벤토리로 받습니다.
- `choices`(Capability API 1.91): `catalog`는 행 카탈로그를 지정하며, 이 단계에서 선택이 그 카탈로그에서 부여하는 항목(아래 `grants.entries`)을 고릅니다. 원하는 언어 하나가 그 예입니다.

시작 장비 단계는 `"strict": true`(Capability API 1.109)를 가질 수 있습니다. 기본값인 규칙 준수 모드에서는 실시간 상태 없이 현재 시트에서 `fits`가 참으로 읽히는 장비와 `fits`가 없는 장비만 제공하며, Other gear 목록은 없습니다. 5e라면 Wizard 꾸러미에 `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }`을, 다른 각 클래스 꾸러미에 해당 클래스 레벨 필드를 넣고, Acolyte 꾸러미에는 `fits`를 넣지 않아 모두에게 맞게 하세요. 자유 편집 모드는 모든 꾸러미를 다시 제공합니다. 인벤토리 선택기는 클래스를 바꾸거나 자유 편집을 떠난 뒤 더 이상 맞지 않는 선택을 지우고 이유를 알려 주며, 장비를 받기 전에도 맞는지 확인합니다. 맞는 장비가 없으면 단계는 빈 상태를 표시하며 Next는 열린 채로 남습니다. `strict`가 없는 단계는 계속 모든 꾸러미를 제공합니다. 모드는 화면마다 따로이며, 저장된 빌드에 기록하거나 서버로 보내지 않습니다.

선택이 주는 것은 그 항목의 `grants`이며, 빌더만 읽습니다.

```json
{
  "id": "half-elf",
  "label": "Half-Elf",
  "grants": {
    "abilities": { "add": { "cha": 2 }, "choose": [{ "count": 2, "amount": 1, "except": ["cha"] }] },
    "trained": { "skills": [], "saves": [], "choose": [{ "what": "skills", "count": 2 }] },
    "sets": { "speed": 30 }
  }
}
```

- `abilities.add`는 점수에 더합니다. `abilities.choose`는 플레이어가 점수 `count`개(같은 점수를 두 번 고르거나 `except`의 점수를 고를 수 없음)를 골라 각각 `amount`를 받게 합니다. `"repeat": true`(Capability API 1.93)이면 한 점수를 여러 번 고를 수 있고 매번 `amount`를 받으므로, `{ "count": 2, "amount": 1, "repeat": true }`는 한 점수에 +2 또는 두 점수에 +1인 능력치 향상입니다. 단계는 하나를 되돌릴 수 있도록 점수 옆에 빼기를 표시합니다. 어느 쪽이든 점수는 `max`를 넘지 않습니다. `upTo`(Capability API 1.96)는 다른 모든 부여가 더한 뒤 선택 자체가 점수를 올릴 수 있는 한도를 정합니다. `{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }`은 "능력치 점수를 20 넘게 올릴 수 없는" SRD의 향상이며, 단계는 그 값에 도달한 점수를 비활성화합니다. 선택은 abilities 단계에, 그 단계가 없으면 항목을 고른 곳에 표시됩니다.
- `trained`는 기술과 내성을 훈련하고 선택을 제공하며, 첫 trained 단계나 항목을 고른 곳에 표시됩니다. 부여의 `tier`, 없으면 빌더의 `tier`, 없으면 시트가 기술이나 내성에 제공하는 미훈련 위의 첫 단계로 훈련합니다. 선택은 선택들이 이미 직접 또는 앞선 선택을 통해 그 단계 이상으로 훈련한 것을 제공하지 않습니다(Capability API 1.104). SRD가 요구하듯, Insight를 훈련하는 배경은 클래스의 기술 선택을 나머지에서 고르게 합니다. 그렇게 되기 전에 저장된 선택은 셈에서 빠지므로 단계가 다른 것을 요구하며, 제공할 것이 없는 선택은 표시하지 않습니다. 선택은 `"held": "<tier>"`라고 할 수 있습니다(Capability API 1.105). 선택들이 그 단계 이상으로 훈련한 것, 또는 자기 단계보다 낮은 선택이 그 단계로 보유한 것만 제공합니다. 숙련된 기술 두 개를 고르는 5e의 Expertise가 `{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`입니다. `held`는 선택이 훈련하는 단계보다 낮아야 합니다.
- `sets`는 필드 값을 씁니다. 클래스의 히트 다이스, 주문 시전 능력치 등입니다.
- 카탈로그 항목은 빌더 단계가 언제 그것을 제공할지 정할 수 있습니다. `offeredWhen`(Capability API 1.99)은 현재 시트에서 읽는 값이며, 0보다 크게 읽히는 동안만 항목을 제공합니다. 5e가 멀티클래스 선행 조건을 충족할 때만 두 번째 클래스를 제공하는 방식입니다(클래스마다 파생 값 하나). 나중에 0으로 읽히는 선택은 `upTo`의 선택처럼 셈에서 빠지되 보존합니다. 자기 선택이 `offeredWhen`이 읽는 값(올리는 점수, 설정하는 필드, 훈련하는 기술, 쓰는 목록을 직접 또는 파생 값을 통해)을 바꾸는 항목은 거부합니다. 스스로를 제공하고, 스스로를 되돌리고, 다시 제공하게 되기 때문입니다. `exclusive` 그룹이 있는 항목은 단계가 그 그룹에 저장한 모든 선택을 뺀 시트에서 읽습니다(Capability API 1.100). 그것을 고르면 그 선택들이 빠지기 때문입니다. 능력치 향상 대신 고르며 Strength 13을 조건으로 하는 재주는 그 향상이 준 Strength로는 제공되지 않습니다. 항목이 부여하는 선택(`grants.entries.choose`)도 같은 방식으로 선택지를 `offeredWhen`으로 제한합니다(Capability API 1.106). **All fields**의 카탈로그 선택기는 늘 그렇듯 모든 항목을 제공합니다.
- 카탈로그 항목은 `exclusive` 그룹을 지정할 수 있습니다(Capability API 1.94). 빌더 단계는 그룹마다 선택 하나만 유지하므로, 하나를 고르면 그 단계의 같은 그룹 다른 선택이 빠지고 가장 최근 것만 셉니다. 능력치 향상 대신 고르는 재주는 그것과 그룹을 공유합니다. `"exclusive": "fighter-asi-4"`. `"exclusiveDefault": true`(Capability API 1.772)는 제공하는 항목을 모두 받는 단계가 플레이어가 다른 항목을 고를 때까지 그 그룹에서 이 항목을 받게 합니다.
- `entries`(Capability API 1.91)는 다른 행 카탈로그의 항목을 고르게 합니다. `{ "choose": [{ "catalog": "languages", "count": 1 }] }`이며 선택은 최대 여섯입니다. `filters`는 그 카탈로그의 필터 값을 고정하고, `ids`는 제공할 항목만 나열합니다(`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`). 그 카탈로그에 대한 빌더의 `choices` 단계에서 고르며(그런 단계가 없는 카탈로그를 지정한 부여는 거부), 행을 쓰는 항목만 제공되고 그 행이 시트에 들어가며, 한 부여에서 고른 항목은 다른 부여에 제공되지 않습니다. 고른 항목 자체의 부여는 적용하지 않습니다.
- 선택은 항목의 `rows`도 한 번 씁니다. 항목은 `rows` 없이 `grants`만 가질 수도 있으며(특성이 다른 카탈로그에서 오는 클래스), 항목이 모두 부여만 하는 카탈로그는 `feeds`가 필요 없습니다. 카탈로그 선택기는 그런 항목을 제공하지 않습니다.

선택을 취소하면 그 선택이 준 것만 되돌립니다. 증가(점수 경계가 허용한 만큼), 훈련, 필드 값, 행입니다. 시트에 이미 있던 플레이어 자신의 것(직접 훈련한 기술, 카탈로그 선택기로 추가한 행)은 플레이어의 것으로 남고, **All fields**에서 한 편집은 그 값에 대한 빌더 자체의 답이 바뀔 때까지 남습니다. 한 카탈로그에서 두 단계에 고른 항목은 한 번만 부여하며, 게임의 레이어가 숨긴 항목도 준 것은 여전히 셉니다. 선택이 `sets`하는 필드는 아직 비어 있거나 빌더가 이미 그 값을 맡고 있을 때만 쓰므로, 직접 입력한 레벨은 덮어쓰지 않습니다. 빌더가 맡은 값을 플레이어가 그 fields 단계에서 바꾸면 빌더의 것으로 남으며, 나중 선택이 더 이상 그 값을 요구하지 않으면 사라집니다. 플레이어의 선택은 시트 옆에 보관하므로 단계를 나중에 다시 열 수 있습니다.

**단계별 평점 배분(Capability API 1.152).** `allocate` 단계는 자체 예산과 생성 상한으로 1점당 점 하나를 삽니다. 단일 `abilities` 단계의 방식이나 저장된 답은 바꾸지 않습니다. 속성, Virtue, 나중의 무료 점수(freebie)에는 별도 단계를 쓰세요.

```json
{
  "id": "attributes",
  "label": "Attributes",
  "kind": "allocate",
  "priorities": [7, 5, 3],
  "annotations": true,
  "groups": [
    {
      "id": "physical",
      "label": "Physical",
      "targets": [{ "ability": "strength" }, { "ability": "dexterity" }, { "ability": "stamina" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "social",
      "label": "Social",
      "targets": [{ "ability": "charisma" }, { "ability": "manipulation" }, { "ability": "appearance" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "mental",
      "label": "Mental",
      "targets": [{ "ability": "perception" }, { "ability": "intelligence" }, { "ability": "wits" }],
      "base": 1,
      "min": 1,
      "max": 5
    }
  ]
}
```

그룹은 1~12개이며 각각 안정적인 `id`, `label`, 대상 1~120개를 가집니다. 대상은 단계 전체에서 서로 달라야 합니다. 대상은 기존 `{ ability }`, 숫자 `{ field }`, `{ skill }`, `{ save }`, `{ bonus }` 중 정확히 하나를 지정합니다. 보너스는 기존 기술이나 내성에 대한 숫자 `build.bonuses` 항목입니다. 그룹은 정확히 한 가지 예산 방식을 씁니다. `priorities`가 그룹마다 음이 아닌 정수 배분 하나씩을 가지거나(중복 허용), **모든** 그룹이 `budget: Ref`를 선언합니다. 우선순위 칸은 명시적으로 배정하며, 이미 찬 칸을 배정하면 그룹이 서로 바뀝니다. 배열 순서는 1순위, 2순위, 3순위, 그다음 번호 붙은 우선순위를 뜻하므로, 이 이름이 크기 순서를 따르게 하려면 큰 배분을 앞에 두세요. 예산은 최대 1,200,000점입니다.

`base`는 선택 사항이고 `min`과 `max`는 필수입니다. 각각 정수나 `{ "derived": "archetype_floor" }` 같은 실시간이 아닌 `Ref`를 받습니다. 평점은 0부터 10,000까지의 정수로 정해져야 하며 대상의 저장 경계나 단계 맵에 맞아야 합니다. 첫 base는 비어 있는 대상의 기본값을 대체하되 기존 방식의 점수와 부여는 유지하며, 나중 base는 앞 단계에 대한 하한입니다. base가 없으면 그 단계는 기존 평점에서 시작합니다. min과 max가 같으면 생성 점수가 고정됩니다. `base: 0, min: 0, max: 0`은 고정된 Appearance를 표현합니다. 최솟값이 점을 자동으로 사지는 않습니다. 예산과 경계는 기존 파생 연산자를 쓸 수 있지만, 이 단계나 이후 단계가 바꾸는 대상은 파생 값을 거치더라도 읽을 수 없습니다. 무료 부여의 조건도 자신이 바꿀 수 있는 배분 그룹(다른 단계의 연결된 그룹 포함)의 평점을 읽을 수 없습니다. 공식 가격은 지원하지 않으며, 지불하는 증가는 모두 1점입니다. 정해지지 않거나 잘못된 출처는 **not configured**(설정되지 않음)로 표시합니다.

기술과 내성 대상에는 대상마다 따로 `sheet.builder.ratingTiers`가 필요합니다.

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

배열 인덱스가 숫자 평점입니다. 맵은 규칙 집합의 미훈련 단계에서 시작해 증가하는, 제공된 기존 단계 ID 1~12개를 가지며, 단계 보너스에서 추론하지 않습니다. 대상마다 다른 맵을 쓸 수 있습니다. 생성 상한이 다른 대상은 별도 그룹에 두세요.

카탈로그 `grants.ratings`는 **모든** 유료 단계보다 먼저 무료 점을 줍니다.

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

각 부여는 양수 `add`나 음이 아닌 `set` 중 하나만 가지며 둘 다 가질 수 없습니다. 모든 `set` 부여는 하한입니다. 가장 높은 것이 이기고, 그다음 모든 더하기가 중첩되며 대상의 저장 한도에서 멈춥니다. 따라서 무료 등급 더하기 두 개는 유료 예산을 쓰지 않고 2등급에 도달합니다. 기존 훈련과 필드·능력치 부여가 이 평점 부여보다 먼저 합쳐집니다. 항목 선택은 여전히 행만 쓰며, 고른 항목의 부여를 재귀적으로 적용하지 않습니다.

UI는 기본/이전, 무료, 구매, 합계 평점과 생성 범위, 남은 예산을 보여 줍니다. 더하기 버튼은 상한에 도달했거나, 예산이 없거나, 잘못된 구매나 수동 덮어쓰기에 조치가 필요한 동안 비활성화됩니다. 덜 쓴 것, 불가능한 최솟값, 덮어쓰기에는 배지가 붙으며, Back과 Next는 계속 쓸 수 있습니다. 우선순위를 다시 배정해도 그룹에 저장된 증가는 유지됩니다. 초과 지출한 그룹은 그룹 전체가 비활성화되고, 대상의 상한을 넘는 구매는 그 대상에 대해 비활성화됩니다. 그 답을 줄이거나 지워서 고치거나, 이전 배분을 되돌려 다시 활성화하세요. 이후 단계는 앞 단계의 생성 상한을 넘을 수 있습니다. **All fields**는 여전히 자유 편집이며, 덮어쓴 값은 생성 규칙으로 제한하지 않고 명시적으로 보여 줍니다.

저장된 `builder.allocations[stepId]`는 그룹 ID별 우선순위 칸 인덱스, 유료 `bought` 증가, 안정적인 `kind/id` 대상 키(예: `ability/strength`)별 선택적 `notes`를 담습니다. `annotations: true`는 혈통 설명이나 전문 분야를 위해 대상마다 최대 1,000자를 제공하며, 빌더는 그 텍스트를 판단하지 않습니다. 적용된 증가는 단계별로 따로 소유합니다. 다시 열어도 부여를 다시 주거나 자원을 다시 채우지 않으며, 기존 시트를 설명하면 설명이 끝날 때를 포함해 시트를 다시 쓰지 않고 선택만 기록합니다. 선택을 취소하면 수동 차이는 보존하면서 무료 평점과 유료 단계를 다시 계산합니다.

**공유 예산과 가격이 붙은 구매(Capability API 1.153).** `sheet.builder.pools`에 생성 풀을 최대 12개 선언하세요. 여러 `spend` 단계가 한 풀을 쓸 수 있으며, 풀을 나누면 직업 점수와 개인 관심 점수를 따로 유지합니다. 예산은 실시간이 아닌 값 참조이며 기존 `sum`, `scale`, `multiply`, `min`, `max`, `stepTable`, `enumTable`, `listSum` 계산을 포함합니다. 정해진 값은 유한해야 하며 0~100,000이어야 합니다. 출처가 없으면 "not configured"입니다.

```json
{
  "pools": [
    { "id": "occupation", "label": "Occupation", "budget": { "derived": "occupation_points" }, "creditLimit": 0 },
    { "id": "interest", "label": "Personal interest", "budget": { "derived": "interest_points" } }
  ],
  "steps": [
    {
      "id": "occupation_skills",
      "label": "Occupation skills",
      "kind": "spend",
      "pool": "occupation",
      "offers": [
        {
          "id": "accounting",
          "label": "Accounting",
          "target": { "field": "accounting_value" },
          "cost": { "flat": 1 },
          "min": 5,
          "max": 99
        }
      ]
    }
  ]
}
```

각 단계는 안정적인 `id`와 `label`을 가진 제안을 최대 120개 가집니다. 대상은 배분 단계와 같은 규칙으로 `ability`, 숫자 `field`, 맵이 있는 `skill`/`save`, `bonus` 중 정확히 하나를 씁니다. 목록 행 구매는 행 식별 기능(F4)을 위해 예약되어 있으며, 이 API는 배열 위치로 행을 식별하지 않습니다. 경계는 대상의 저장 경계에 맞아야 합니다. 시작 평점과 무료 부여는 보존하며 다시 청구하지 않습니다. 무료 점 둘과 유료 점 다섯이 있는 Background는 일곱입니다.

비용은 다음 중 정확히 하나입니다.

- `{ "flat": 1 }`: 평점 증가 하나당 1점입니다.
- `{ "perRank": 5 }`: 다음 등급의 다섯 배이므로 2를 3으로 올리면 15가 듭니다.
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }`: 증가하는 평점에서의 누적 가격입니다.
  다음 구매는 인접한 평점으로 옮기며 그 차이만큼 듭니다(여기서는 5, 그다음 7). 소수 평점에는 정수가 아닌 숫자 필드가 필요하며, 표는 제안의 두 경계를 모두 포함합니다.

선택적 `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]`는 항목을 최대 12개 담습니다. 처음으로 양수인 조건이 이깁니다. 조건은 구매 전의 시트를 읽으며, 일치하는 것이 없으면 기본 가격을 씁니다. 예산과 조건은 파생 값을 거치더라도 구매한 대상을 읽거나 이후 선택에 의존할 수 없습니다. 무료 부여와 배분 단계는 가격이 붙은 구매보다 먼저 적용합니다.

명시적으로 선언한 크레딧을 빼면 가격은 양수입니다. 평점이 오르는 결점에는 `"credit": true, "cost": { "flat": -1 }`을 쓰세요. 선언한 기준값에서 줄이는 것에는 `"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }`을 쓰세요. 구매 한 번이 10을 9로 낮추고 1점 크레딧을 기록합니다. 시작 값은 기준값과 같아야 합니다. 크레딧 대상은 빌더 전체에서 제안을 하나만 가지므로 구매와 크레딧이 순환하지 않습니다.

풀의 크레딧은 기본적으로 0입니다. `creditLimit`를 최대 총 크레딧으로 설정하고, 선택적으로 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`를 최대 12개 더하세요. 필터는 제안의 `tags: ["flaw"]`를 지정하므로 결점 크레딧과 불리한 특성 크레딧에 각각 상한을 둘 수 있습니다. 상한은 양수 지출과 관계없이 총 크레딧을 셉니다. 서로 다른 별난 특성의 개수는 여전히 선택·행 제약으로 다룹니다.

**세는 행과 일치하는 행(Capability API 1.205).** `listSum`은 `where:
{ "column", "equals" }`로 셀이 값과 같은 행만 읽을 수 있고(빈 셀은 열의 기본값으로 읽음), `column` 대신 `count: true`를 써서 열을 더하는 대신 행을 셀 수 있습니다. Genesys의 재능 피라미드는 파생 개수 두 개와 생성 규칙으로 표현합니다.

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

그리고 `value`가 `tier2`를 읽고 `max`가 1단계 개수에서 하나를 뺀 값을 읽는 규칙을 둡니다.

**행마다 계산하는 행 가격(Capability API 1.206).** rows 단계의 객체 `cost`는 `column`을 `times`만큼 곱하고 `add`를 더할 수 있으므로, `{ "column": "tier", "times": 5 }`는 Genesys 재능을 단계당 5 XP로 매깁니다. `add`만 있으면 객체로 쓴 고정 가격입니다. `overrides`(최대 4개)는 접두어와 행 자체 셀로 지정한 파생 값이 시트에서 0보다 크게 읽힐 때 대신 쓰는 가격을 줍니다. `{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }`는 `affinity_<its Ability>`가 0보다 크면 Exalted Charm을 4 Bonus Points로 매깁니다. 열거형 셀은 가질 수 있는 모든 값에 대한 파생 값이 있어야 합니다.

**가격이 없는 제안(Capability API 1.207).** spend 제안의 `cost`(또는 overrides의 것)는 원본이 가격을 제공하지 않은 동안 `{ "unpriced": true }`일 수 있습니다. 제안은 메모와 함께 표시되고, 풀에서 아무것도 차지하지 않으며, 구매되지 않습니다. 나중에 가격이 없어진 가격으로 저장된 구매는 비활성화되며 고칠 수 있도록 보존합니다.

**더 많은 필드(Capability API 1.208).** 시트는 필드를 최대 240개 선언할 수 있으며, 1.208 이전에는 상한이 160입니다. Rolemaster의 기술 등급, 범주 등급, 잠재치, 합계에 이 여유가 필요합니다.

**능력치에 쓰는 굴림(Capability API 1.209).** `roll` 단계의 굴림은 `field` 대신 `ability`를 지정할 수 있습니다(둘 중 정확히 하나). 결과는 능력치 자체 경계로 제한합니다. `gain`이 있으면 점수를 상대로 판정을 굴려 그보다 높은 결과만 증가분을 더하며, 빌더는 이를 증가로 보관합니다. 점수를 다시 굴리거나 사도 향상이 위에 유지됩니다. `gain`이 없으면 결과는 직접 입력한 점수처럼 쓰이며, 그 점수에 대한 빌더 자체의 답이 바뀔 때까지 유지됩니다. 계산되는 능력치는 굴릴 수 없으며, 각 능력치는 단계당 최대 한 번 굴립니다.

**계산되는 목록 열(Capability API 1.210).** 숫자 열은 `sum`을 지정할 수 있습니다. 같은 행의 다른 숫자 열 최대 여섯 개를 더하며(빈 셀은 열의 기본값으로 읽음), 열의 `min`과 `max`로 제한합니다. 셀은 읽기 전용으로 표시되고, 저장된 시트를 읽을 때마다 채워지며, 합계, 행 판정 등 모든 곳에서 입력한 셀처럼 읽힙니다. 계산되는 열은 굴리지 않으며 다른 계산되는 열을 더하지 않습니다. CoC 전문 분야의 평점은 `"sum": ["base", "occupation", "interest"]`입니다.

**부분 점수 증가(Capability API 1.211).** 부여의 `abilities.choose`는 `partialFrom`을 지정할 수 있습니다. 선택이 올 때 점수가 이미 그 기준 이상이면 부분 증가를 받으며, 부분 증가 둘이 `amount`를 한 번 줍니다. 선택은 모든 온전한 증가 뒤, 빌더가 하는 순서대로 셉니다. 따라서 Pathfinder 2e의 나중 강화는 `"amount": 1, "partialFrom": 4`입니다. +4 수정치가 +5가 되려면 강화 두 번이 필요합니다. `upTo`와 함께 쓸 수 있습니다.

**태세 안의 행 판정(Capability API 1.212).** 목록의 `checks[]` 항목은 주사위 풀의 `resolution.stances` 중 하나인 `stance`를 지정할 수 있습니다. 그러면 모든 행의 판정이 태세가 나열한 기술처럼 그 태세 안에 있습니다. Stewpot의 추구는 STILLNESS 방식으로 주사위를 셉니다. Game Master의 리마인더는 그 태세의 기술과 함께 행 이름을 알려 줍니다.

**능력치 전문 분야(Capability API 1.213).** 목록의 `contextual`은 `"abilities": true`를 설정할 수 있습니다. 그러면 `skill` 셀이 기술뿐 아니라 능력치(ID, 라벨, 약칭)도 지정할 수 있으며, 그 행은 그 능력치로 굴리는 모든 판정에 적용됩니다. 순수 능력치 판정, 그 능력치를 자체 능력치로 쓰는 기술, `with=`로 그 능력치로 바꾼 기술입니다. World of Darkness의 속성 전문 분야 "Strength: lifting"은 기술 셀이 "Strength"인 "lifting"이라는 행입니다.

**꺼진 상쇄(Capability API 1.214).** 상황별 `check`(목록의 `contextual`이나 항목의 `mechanics.contextual`)는 `"cancel": false`를 설정할 수 있습니다. 적용되는 굴림에서 `resolution.cancel.upTo` 이하의 눈은 성공을 빼지 않지만, 대실패는 여전히 이를 읽습니다. 규칙 집합에 끌 `resolution.cancel`이 있어야 합니다.

**지니지 않고 열리는 아이템(Capability API 1.215).** 카탈로그 항목의 `grants.itemAccess`는 규칙 집합의 아이템(`<catalog>/<entry>`, 서비스 제외)을 최대 48개 나열합니다. 안내형 빌더에서 그 항목을 고르면 캐릭터에게 그 아이템이 열립니다. 시트와 Game Master의 시트 블록은 그것을 지니지 않은 것으로 나열하며 가방에는 아무것도 들어가지 않습니다. Blades 캐릭터가 작전 시작 시 짐을 선언하듯, 그 아이템을 가져갈 때 Game Master가 인벤토리에 하나를 더합니다.

**생성 시 행의 점(Capability API 1.216).** `allocate` 그룹은 `rows`, 즉 `{list, column}` 쌍을 최대 넷 지정할 수 있습니다. 목록 행들에 걸친 그 숫자 열의 점이 대상과 함께 그룹 예산에 포함됩니다. 행은 목록에서 편집하며, 행 점이 예산보다 많은 그룹은 플레이어를 기다립니다. rows 단계의 비용 overrides는 고정 `cost` 대신 비용 열의 단위당 비율인 `times`를 줄 수 있습니다. Exalted의 Craft 행은 "dots"를 28 Ability 점에 포함하고 "bought" 점을 `times: 2`로 매기되 `affinity_<ability>`가 설정된 곳에서는 `times: 1`로 덮어쓰며, 계산되는 평점 열(1.210)이 둘을 더합니다.

**가장 좋은 평점(Capability API 1.217).** 상황별 `check`는 `"best": true`를 설정할 수 있습니다. 적용되는 기술 판정은 캐릭터의 가장 좋은 기술 평점이 요청한 것보다 높으면 그것으로 굴립니다. `dice-highest` 규칙 집합은 이것만 하는 상황별 판정을 쓸 수 있으며, 그 밖의 모든 판정 효과에는 여전히 주사위 풀이 필요합니다. Blades의 Rook's Gambit은 `"check": {"best": true}`가 있는 특수 능력 행이며 이름으로 적용합니다.

**트랙에 표시하는 비용(Capability API 1.218).** 상황별 `cost` 항목은 `{"pool", "amount"}` 외에 `{"track": "<id>", "by": N}`일 수도 있습니다. 행이나 항목을 적용하면 그 일반 실시간 트랙을 경계가 허용하는 만큼 N 올립니다(부상 트랙은 이 방식으로 표시하지 않음). 목록의 `contextual`도 `cost`를 가질 수 있습니다. Blades의 Rook's Gambit은 `"check": {"best": true}`와 `"cost": [{"track": "stress", "by": 2}]`가 있는 행입니다. `apply=`로 적용하는 이름은 둥근 아포스트로피와 따옴표를 곧은 것과 똑같이 읽습니다.

**빌려 온 카탈로그(Capability API 1.220).** 카탈로그는 자체 카탈로그를 담는 대신 설치된 다른 규칙 집합의 카탈로그를 빌릴 수 있습니다. `{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`입니다. 빌려주는 쪽은 그 ID로 찾으며(단독이거나 커뮤니티 네임스페이스 아래), 그 항목은 빌리는 규칙 집합을 기준으로 읽으므로 빌리는 쪽이 선언하지 않은 것(상태, 위협 단계, 감각)을 지정한 항목은 제외하고 기록하며 나머지는 들어옵니다. `from` 옆의 `entries`는 빌린 항목에 더해지거나 같은 ID의 항목을 대체합니다. 이들은 규칙 집합을 읽을 때 검사하므로, 헤더가 그 항목들이 가진 `filters`를 지정합니다(필터가 없는 헤더는 빌려주는 쪽의 필터를 씀). 시트로 작성한 빌린 생물은 빌려주는 쪽의 ID를 씁니다. `from.sheet`는 그것을 빌리는 쪽에서 어떻게 읽을지 정합니다. `fields`는 필드를 다른 ID로(또는 제외하려면 `null`로) 대응시키고, `values`는 필드의 값을 대응시키며, `tiers`는 숙련 단계(생물의 것과 항목이 부여하거나 요구하는 것)를 대응시킵니다. `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`처럼 씁니다. 아이템을 포함한 모든 빌린 항목은 두 가지를 더 받을 수 있습니다. `refs`는 빌려주는 쪽의 파생 값을 빌리는 쪽의 값 하나로 읽고(`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`), `slots`는 아이템의 슬롯을 빌리는 쪽의 이름으로 둡니다(`"slots": { "body": "armor" }`). 카탈로그는 자기 규칙 집합이나, 자신도 빌려 온 카탈로그에서 빌릴 수 없습니다. 빌린 생물의 아트는 빌려주는 쪽의 것으로 일치시킵니다(생물 팩의 `5e-2014/creatures/<id>`). 생물의 주문처럼 빌린 카탈로그 안을 가리키는 참조는 규칙 집합이 아닌 카탈로그를 읽을 때 검사합니다.

**더 긴 성장 목록(Capability API 1.219).** `sheet.advancement.fields`는 필드를 최대 64개(이전에는 24개) 받으므로, 모든 주문 레벨의 슬롯과 숙련 목록처럼 레벨이 오를 때 많은 필드를 올리는 게임에서도 GM이 모두 올리게 할 수 있습니다. 24개를 넘는 목록은 1.219가 필요합니다.

**양방향, 소유, 교환 구매(Capability API 1.164).** `"direction": "both"`는 한 제안이 시작점에서 평점을 올리고 내리게 합니다(선언한 `baseline`은 시트와 같아야 함). 한 단계 올릴 때마다 곡선의 가격이 들고, 시작점 아래로 한 단계 내릴 때마다 그만큼을 크레딧으로 돌려받으며, 풀의 `creditLimit`와 상한으로 제한합니다. 장부는 한 방향으로만 흐르므로, 산 평점을 내리면 마지막 구매를 지불한 가격으로 되돌리고, 내린 평점을 올리면 크레딧을 갚습니다. 샀다가 내리는 것으로 크레딧이 생기지는 않습니다. 이런 대상은 빌더 전체에서 제안이 하나입니다. GURPS ST는 `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14,
"cost": { "flat": 10 } }`이며, 표 비용은 Basic Speed 같은 소수 단계에 가격을 매깁니다. `"direction": "increase"`와 `"decrease"`는 단방향 제안을 명시합니다(`"decrease"`는 위의 기준값과 크레딧이 있는 감소).

`"effect": "ownership"`은 제안을 `baseline`(또는 `min`)부터 위로 자체 사다리에서 가격을 매기며, 시트는 자체 값과 산 단계 중 높은 쪽을 유지합니다. 1점짜리 GURPS 친숙도는 기본값이 이미 더 좋아도 지불하고 나열되며, 환불해도 시트에는 아무 손해가 없습니다.

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }`는 제안을 닫힌 생성 교환으로 만듭니다. 구매할 때마다 `from`을 `units`만큼 내리고 대상을 `gain`(기본값 1)만큼 올리며, `from`을 `floor` 아래로 내리거나 대상을 `max` 위로 올리지 않습니다. 풀에서 아무것도 들지 않으므로 `cost`를 생략합니다. 교환한 점은 다시 교환하지 않습니다. 교환으로 올린 평점은 다른 교환이 내리지 않고, 교환으로 내린 평점은 다른 교환이 올리지 않습니다. 클래스가 할 수 없는 교환(`when`)은 같은 평점을 반대로 지정할 수 있습니다. 환불하면 두 평점을 모두 되돌립니다. OSE의 주요 능력치 교환은 내리는 점수마다 제안 하나입니다.

```json
{
  "id": "wis_to_int",
  "label": "Lower Wisdom to raise Intelligence",
  "target": { "ability": "int" },
  "exchange": { "from": { "ability": "wis" }, "units": 2, "floor": 9 },
  "min": 3,
  "max": 18
}
```

빌더는 부호 있는 유료 변화량과 원래 가격을 안정적인 단계/제안 ID 아래에 저장하며, 제안당 구매 줄은 최대 1,000개입니다. 환불은 가장 최근 줄을 지우고 그 기여와 기록된 가격을 정확히 되돌리며, 크레딧 제거도 포함합니다. 무료 평점은 환불하지 않습니다. 실시간 XP, 인벤토리, 화폐, 파티 자원은 쓰지 않습니다.

경력, 무료 부여, 예산 출처를 바꿔도 장부는 유지됩니다. 잘못된 구매는 비활성화되며, 풀은 원래 지출, 초과 지출 시 음수인 남은 점수, 제안된 새 가격을 보여 줍니다. 공유 대상은 다른 풀의 의존 구매도 보류합니다. **Reprice saved purchases**(저장된 구매 가격 다시 매기기)는 풀에 대해 규칙에 맞는 새 가격을 명시적으로 받아들입니다. 그렇지 않으면 줄을 환불해 고치세요. 어떤 구매도 조용히 지우거나 팔지 않습니다. 쓰지 않은 점수는 참고용입니다. Back과 Next는 계속 쓸 수 있고, **All fields**는 스키마 경계 안에서 보이는 수동 덮어쓰기를 보존합니다. 기존 캐릭터를 설명하거나 저장된 선택을 다시 열어도 점을 다시 주지 않습니다.

**이름 붙은 행(Capability API 1.154).** `rows` 단계는 플레이어가 빌드하는 동안 시트 목록 하나에 자기 행을 추가, 편집, 제거하게 합니다. 고용인, 인맥, 의식과 그 재료, 또는 카탈로그가 나열하지 않는 그 밖의 무엇이든 해당합니다.

```json
{
  "id": "retainers",
  "label": "Retainers",
  "kind": "rows",
  "list": "retainers",
  "columns": ["name", "role", "loyalty"],
  "required": ["name"],
  "min": 1,
  "max": 4,
  "defaults": { "role": "Hireling" }
}
```

`columns`는 단계가 편집하는 목록 열의 부분 집합입니다(생략하면 전부). `required`는 행이 셈에 들려면 채워야 하는 열을 지정합니다. 배지는 `min`(0~20)에 모자라는 온전한 행 수와, 필수 셀이 빈 모든 행을 셉니다. 따라서 반쯤 쓴 재료는 해결되지 않은 채 남습니다. `max`는 **Add a row**(행 추가)를 막으며 목록의 `maxItems`를 넘지 않습니다. 새 행은 열 자체의 기본값에서, 그다음 `defaults`에서 시작하며, 이 값은 각 열에 맞아야 합니다.

단계는 각 행이 있는 자리에서 목록을 편집하므로, 같은 이름의 고용인 둘은 두 행으로 남고 하나를 지워도 다른 하나는 남습니다. 카탈로그 선택이 쓴 행은 "Added by a pick" 메모와 함께 읽기 전용으로 표시되며 선택과 함께 생기고 사라집니다. **All fields**는 이전처럼 모든 행을 편집합니다.

행 단계는 시트에서 읽는 값인 `countFrom`(Capability API 1.799)으로 원하는 행 수를 지정할 수 있습니다. 5e의 체력 굴리기처럼 1레벨 이후 레벨마다 하나씩 필요한 경우입니다. 단계를 표시할 때 빌더는 플레이어 자신의 행이 그 수에 도달할 때까지 **Add a row**로 만드는 것과 같은 행을 추가하며, `max`나 목록의 `maxItems`를 넘지 않습니다. 행을 없애지 않으며, 그곳에서 제거한 행은 단계를 다시 표시할 때까지 제거된 채로 남습니다. 캐릭터를 설명할 때는 단계를 읽는 것만으로 행이 추가되지 않습니다. 그런 다음 단계는 `min`과 마찬가지로 그 수만큼 온전한 행이 채워지기를 기다리며, 둘 다 지정하면 더 큰 수를 쓰고, 같은 "N of M" 개수 표시를 보여 줍니다. 이를 쓰는 규칙 집합은 Capability API 1.799가 필요합니다.

```json
{
  "id": "hit_point_rolls",
  "label": "Hit point rolls",
  "kind": "rows",
  "list": "hp_rolls",
  "required": ["die", "roll"],
  "countFrom": { "derived": "hp_rolls_due" }
}
```

**조건부 제안, 시트에서 읽는 경계, 생성 규칙(Capability API 1.155).** spend 제안은 다음도 가질 수 있습니다.

- `when: Ref`: 구매 전 시트에서 0보다 크게 읽히는 동안만 제공됩니다. 직업 자체의 기술이나 부족이 가질 수 있는 Background가 그 예입니다. 한 번도 사지 않은 제안은 풀을 그대로 두며, 캐릭터가 더 이상 가질 수 없는 제안에 저장된 구매는 고칠 수 있도록 비활성 상태로 남습니다.
- `minFrom: Ref`와 `maxFrom: Ref`: 시트에서 읽는 하한과 상한이며 `min`과 `max` 안으로 제한합니다. Credit Rating은 직업의 범위를 따르고, Dodge는 DEX에서 멈춥니다. 하한보다 낮은 평점은 한 번의 구매로 하한까지 올립니다.
- `allowedRatings: number[]`: 구매가 끝날 수 있는 유일한 평점들로, 1, 3, 5점으로 파는 Merit가 그 예입니다. 각 구매는 곡선의 가격으로 다음 허용 평점까지 곧장 갑니다.

예산과 overrides처럼 이들도 구매한 대상을 읽을 수 없습니다. `onDuplicate: "replace"`인 훈련 선택은 시트의 모든 기술 대신 중복을 대체할 수 있는 기술(또는 내성)인 `replacementFrom`을 지정할 수 있으며, 이는 표시, 저장, 적용 모두에 적용됩니다.

`sheet.builder.constraints`는 생성 규칙을 최대 40개 담습니다. 각 규칙은 자신을 배지에 표시할 `step`, 실패하는 동안 그곳에 표시할 `label`, 선택적 `when: Ref`, 그리고 다음 중 정확히 하나를 지정합니다.

- `value: Ref`와 `min` 및/또는 `max`(각각 숫자나 Ref).
- `rows: { list, filter?, sum? }`와 `min` 및/또는 `max`: `filter`(`{ column, equals?, below?, above? }`)가 남긴 행에 대한 목록 행 수, 또는 숫자 열 `sum`의 합계입니다.
- `distinct: { list, column }`: 두 행이 채워진 값을 공유하지 않습니다(대소문자와 공백 무시).
- `approved: fieldId`: Storyteller의 승인처럼 켜져 있어야 하는 불리언 필드입니다.

```json
{
  "constraints": [
    {
      "id": "disadvantage_cap",
      "label": "Disadvantages give at most 50 points.",
      "step": "traits",
      "rows": { "list": "traits", "filter": { "column": "cost", "below": 0 }, "sum": "cost" },
      "min": -50
    }
  ]
}
```

실패한 규칙은 Back, Next, **All fields**를 결코 막지 않습니다.

**계산되는 점수와 한 굴림에 적용하는 효과(Capability API 1.156).** 능력치는 `value: Ref[]`(1~8개)를 가질 수 있습니다. 점수는 그것들의 합이며 `min`과 `max`로 제한하고 읽기 전용으로 표시합니다. Blades의 속성은 표시한 행동 점의 합이고, GURPS Perception은 `[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`이며, 그것으로 굴리는 기술은 산 것을 따릅니다. 파생 값, 상한, 기술은 계산되는 점수를 읽을 수 있지만, 계산되는 점수끼리는 파생 값을 거치더라도 서로 읽을 수 없습니다. 빌더는 이를 설정하지 않으며, 그에 대해 저장된 것은 무시합니다.

목록은 `contextual`을 선언해 Game Master가 행 이름을 지정할 때 그 행이 굴림에 적용되게 할 수 있습니다.

```json
{
  "id": "stunts",
  "label": "Stunts",
  "maxItems": 10,
  "columns": [
    { "id": "name", "label": "Name", "type": "text", "maxLength": 80 },
    { "id": "skill", "label": "Skill", "type": "text", "maxLength": 40 },
    { "id": "bonus", "label": "Bonus", "type": "number", "min": -5, "max": 5, "default": 2 }
  ],
  "contextual": { "name": "name", "skill": "skill", "bonus": "bonus" }
}
```

`name`은 Game Master가 행을 지정할 때 쓰는 열입니다. `skill`(선택 사항)은 행이 적용되는 기술을 ID나 라벨로 담으며, 빈 셀은 모든 판정에 적용됩니다. `bonus`(숫자 열)와 `dice`(주사위 열)는 판정에 더하며, 풀 규칙 집합에서는 주사위로 더합니다. `to: "saves"`는 대신 내성에 행을 적용합니다. 풀 규칙 집합에서 `check: { dice?, successes?, double?, explode? }`는 적용되는 모든 행에 풀에 대한 같은 효과를 줍니다. 10이 폭발하는 전문 분야가 그 예입니다.

카탈로그 항목은 `effects`(`own-checks-advantage`와 다른 판정·내성 효과), `checks`나 `saves`에 대한 `modifiers`, 범위를 좁히는 `skills`와 `saves`, 풀 `check` 효과, 적용되는 굴림에서 한 번 지불하는 `cost: [{ "pool": "...", "amount": 1 }]`를 담은 `mechanics.contextual`을 가질 수 있습니다. Game Master는 판정에 `apply="Strong Back; Quick Eye"`(최대 네 이름)를 씁니다. 그 판정에 적용되는 이름만 판정을 바꿉니다. 다른 기술의 행, 두 행이 공유하는 이름, 풀로 감당할 수 없는 비용은 아무것도 바꾸지 않습니다. 행을 가진 것만으로는 굴림이 바뀌지 않습니다. 기록은 적용된 것을 `from`에 나열합니다.

**굴리거나 시트에서 읽는 시작 동전(Capability API 1.157).** 시작 장비의 동전 줄은 `count` 대신 `roll`(`"2d6"` 같은 주사위)이나 `countFrom`(보유자 시트에서 읽는 Ref)을 가질 수 있으며 둘 다 가질 수는 없고, `times`(1~10000)는 어느 쪽이든 곱합니다.

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

선택기는 주사위를 보여 줍니다("5d4 gold, rolled when taken"). 굴림은 그룹이나 보유자가 꾸러미를 받을 때 한 번 일어나므로, 선택기를 다시 열어도 다시 굴릴 수 없습니다. `countFrom`은 Credit Rating 필드처럼 보유자 자신의 시트를 읽습니다. 시트가 없는 보유자는 거부하며, 양이 0이면 아무것도 더하지 않습니다. 아이템 줄은 고정 `count`를 유지합니다.

**한 번만 설정하는 시작 값(Capability API 1.158).** `kind: "initialize"`인 빌더 단계는 플레이어가 확인할 때 시작 값을 쓰며, 스스로 다시 쓰지 않습니다.

```json
{
  "id": "start",
  "label": "Starting values",
  "kind": "initialize",
  "writes": [
    { "field": "san_start", "value": { "abilityScore": "pow" } },
    { "field": "xp", "remaining": "creation" }
  ]
}
```

각 쓰기는 시트 필드 하나와, `value`(고정 값, 또는 숫자 필드에는 Ref) 또는 빌더 풀에 남은 미사용 양인 `remaining` 중 하나를 지정합니다. 단계는 각 필드의 현재 값과 설정될 값을 보여 주며, 배지는 플레이어가 설정할 때까지 기다립니다. 쓴 값은 빌더와 함께 저장되므로 빌더를 다시 열거나, 캐릭터를 가져오거나, 나중에 POW를 바꿔도 다시 쓰지 않습니다. 그 뒤 시트가 바뀌었으면 단계는 다시 설정할 때 무엇을 대체할지 보여 주며, 플레이어의 **Set again**(다시 설정)만이 실제로 다시 설정합니다. 이미 그대로인 상태로 설명되는 캐릭터에는 쓰지 않습니다.

실시간 풀은 `startFrom: Ref`를 선언해 가득 차거나 빈 상태 대신 시트에서 읽은 값으로 시작할 수 있으며, 그 값은 0과 최대치 사이로 제한합니다. 일반 트랙은 `default` 대신 `startFrom`을 선언할 수 있습니다. initialize 단계가 쓴 필드를 가리키면 SAN은 설정 당시의 POW에서 시작하고 플레이가 남긴 곳에 머뭅니다. 저장된 실시간 값은 항상 풀의 시작값보다 우선합니다.

**가격이 붙은 선택과 행(Capability API 1.159).** 카탈로그 단계나 rows 단계는 빌더 `pool`과 `cost`를 지정할 수 있으므로, 플레이어가 고르거나 쓰는 것을 spend 단계와 같은 풀에서 지불합니다. 카탈로그 단계의 비용은 숫자이거나 항목 자체의 숫자 필터인 `{ "filter": "tier" }`입니다. rows 단계의 비용은 숫자이거나 각 행에서 읽는 `{ "column": "cost" }`입니다. 음수 가격은 풀의 `creditLimit`로 제한하는 크레딧이므로 결점이 특성의 자금이 됩니다. rows 단계는 그 목록에 공급하는 행 카탈로그인 `from`도 지정할 수 있습니다. 플레이어는 항목의 행 사본을 원하는 만큼 추가하며, 각 사본은 따로 가격이 매겨지고 따로 제거되는 플레이어 자신의 행입니다.

```json
{
  "id": "charms",
  "label": "Charms",
  "kind": "rows",
  "list": "charms",
  "pool": "bonus",
  "cost": { "column": "cost" },
  "from": "charm_book"
}
```

풀로 지불할 수 없는 선택은 제공되지 않습니다. 가격이 붙은 선택과 행은 먼저 지불되며 플레이어 대신 팔리지 않습니다. 결점을 없애 풀이 초과 지출되면 플레이어가 고칠 때까지 spend 단계의 구매가 적용되지 않으며, 가격이 붙은 각 단계의 배지가 고칠 것을 셉니다. 열이 넘을 수 없는 합계(Rite 레벨)는 `rows.sum`과 `max`가 있는 생성 규칙(1.155)으로 표현합니다.

**생성 프로필과 앞선 단계 기준 읽기(Capability API 1.160).** `sheet.builder.profiles`(최대 16개)는 캐릭터 유형, 경력, 꾸러미가 자체 단계와 예산을 가져오게 합니다.

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

`when`이 0보다 크게 읽히는 첫 프로필이 캐릭터의 프로필이며, 빌더가 어느 것인지 알려 줍니다. 어느 프로필이든 나열한 단계는 그것을 나열한 프로필이 캐릭터의 것일 때만 표시됩니다. 숨겨진 동안 답은 보존되며 아무것도 부여하지 않습니다. 프로필의 `budgets`는 그 풀 자체의 예산을 대체하므로 유형을 바꾸면 다른 유형의 예산은 남지 않습니다. 더 이상 감당되지 않는 구매는 플레이어가 고칠 때까지 적용되지 않습니다.

카탈로그 단계나 initialize 단계는 `reads: { "before": "step_id" }`를 선언할 수 있습니다. 그러면 항목의 `offeredWhen`과 `upTo`(또는 initialize 단계의 값)는 그 단계 이전의 단계들이 만든 시트를 읽습니다. 이후 단계가 고르고, 부여하고, 산 것은 모두 되돌리고, 플레이어가 입력한 것은 유지합니다. 멀티클래스 단계는 이번 레벨의 향상 전 능력치 점수를 읽고, Humanity 스냅샷은 플레이어가 단계 사이를 어떻게 오갔든 무료 점수 전의 Virtue를 읽습니다.

**그 자체로 판정인 행(Capability API 1.161).** 목록은 `checks`를 최대 네 개 선언할 수 있으므로, 플레이어가 쓰는 각 행이 Game Master가 이름으로 요청할 수 있는 판정이 됩니다.

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name`은 행을 부르는 텍스트 열이고 `rating`은 그 평점인 숫자 열입니다. `ability`(선택 사항)는 기술의 능력치처럼 더해집니다. Science (Physics)와 Science (Biology)는 두 행이자 두 판정이며 각자 평점을 가집니다. 한 목록의 판정 둘은 평점 하나를 공유하는 두 태세이며, 각각 Game Master가 행 이름 뒤에 붙이는 `label`을 가집니다. "Fire stew (bold)"와 "Fire stew (careful)"이 그 예입니다. 시트 자체의 기술, 내성, 능력치를 먼저 일치시킵니다. 두 행이 공유하는 이름은 하나의 이름을 바꿀 때까지 판정이 아니며, 삭제한 행의 판정은 함께 사라집니다. Game Master의 시트 블록은 모든 행 판정을 숫자와 함께 나열하며, `with=`는 기술에서처럼 작동합니다. 평점 열로 가격을 매긴 rows 단계(1.159)는 생성 풀에서 평점을 삽니다.

**주사위와 함께 보관하는 생성 굴림(Capability API 1.162).** 생성 주사위는 `{ "count", "sides", "keep"?, "add"?, "multiplier"? }`입니다. 가장 높은 `keep`개의 눈에 `add`를 더하고 `multiplier`를 곱하므로, CoC의 `(2d6+6) x 5`는 `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`입니다.

abilities 단계의 `methods.rolls`는 모든 점수를 순서대로, 각자 그룹의 주사위로 굴리며, 굴림을 다른 점수로 옮기지 않습니다(방식 `"rolls"`).

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

`kind: "roll"`인 단계는 `rolls`를 최대 12개 나열하며, 각각 숫자 `field`에 씁니다. Luck, 체력, 시작 자금 등입니다. `best`(2 또는 3)는 그만큼 굴려 가장 좋은 것을 쓰고, `floor`(숫자나 Ref)는 결과의 최솟값입니다. 체력 1이나 스탯 아래로 내려가지 않는 잠재치가 그 예입니다. `gain`은 대신 향상 판정으로 만들며, 필드를 상대로 굴려 굴림이 그보다 높을 때만 `gain`을 더합니다. CoC의 EDU 향상이 그렇습니다. 모든 굴림은 눈과 함께 보관하고 눈과 함께 표시합니다. 이미 한 굴림은 그대로이며, 빌더를 다시 열어도 다시 굴리지 않고, `retry: true`인 단계만 다시 굴리기를 제공합니다. 설명되는 캐릭터에는 굴리지 않습니다.

**세는 선택과 생성 제약(Capability API 1.151).** 모든 단계는 `when: Ref`(실시간이 아닌 시트 값이 0보다 큰 동안만 표시하고 적용)와 `requiredWhen: Ref`(0보다 큰 동안만 배지에서 끝나지 않은 선택을 셈)를 가질 수 있습니다. 숨겨진 단계는 저장된 답을 유지합니다. 선택이 끝나지 않았거나 잘못되어도 Next와 Back은 계속 쓸 수 있으며, All fields는 여전히 자유 편집입니다.

카탈로그 단계는 `quotas`를 최대 12개 선언할 수 있으며, 각각 카탈로그의 타입이 있는 필터 하나를 씁니다.

```json
{
  "id": "ratings",
  "label": "Skill ratings",
  "kind": "catalog",
  "catalog": "ratings",
  "min": 10,
  "max": 10,
  "distinctBy": "skill",
  "quotas": [
    { "filter": "rating", "value": 4, "min": 1, "max": 1 },
    { "filter": "rating", "value": 3, "min": 2, "max": 2 },
    { "filter": "rating", "value": 2, "min": 3, "max": 3 },
    { "filter": "rating", "value": 1, "min": 4, "max": 4 }
  ]
}
```

카탈로그가 각 기술을 각 평점으로 제공하면 이것이 Fate식 피라미드입니다. 항목은 명시적인 숙련 단계 ID로 훈련 부여를 선언하며, 숫자 필터 값으로 단계 대응을 만들어 내지 않습니다. 할당량은 `0 <= min <= max <=` 단계의 최대치입니다. 최솟값은 배지에 영향을 주고, 최댓값은 일치하는 추가 선택을 비활성화합니다. `distinctBy`는 기존 필터를 지정합니다. 선택은 그 값(태그 필터면 어떤 태그든)을 공유할 수 없으며, 그 필터가 없는 항목은 셈에 들 수 없습니다. 그렇지 않으면 항목 ID로 구분합니다. `quotaBelow: { "filter": "tier" }`는 1보다 큰 양의 정수 단계에 대해 단계 n−1의 활성 선택이 단계 n보다 엄격히 많기를 요구합니다. 단계 1이 바탕입니다. 받쳐 주는 선택을 지우면 초과된 높은 선택이 비활성화되며, 그 부여는 되돌리되 고칠 수 있도록 답은 유지합니다.

`abilities.choose`, `trained.choose`, trained 단계의 `choose`, `entries.choose` 칸은 다음을 받습니다.

- `id`: 안정적인 시트 ID입니다. 새 칸은 이를 써야 하며, 그러면 저장된 답이 순서 변경 뒤에도 유지됩니다. ID가 없는 이전 칸은 위치 키를 유지합니다. ID는 원본 단계가 제공하는 모든 선택에서 고유합니다.
- `countFrom: Ref`와 명시적 `max`(1~20, 능력치는 최대 6). `countFrom`이 없으면 `count`가 고정 개수로 남습니다. 동적 개수는 내림하고 0과 `max` 사이로 제한합니다. 실행 가능한 식이 아니라 기존 파생 연산자를 읽습니다.
- `excludeChoices: ["background/restricted"]`: 같은 종류의 앞선 선택 ID로, `source_step/choice_id`로 씁니다. 대체를 포함해 앞선 선택의 활성 답을 제외합니다. 참조는 정의나 같은 카탈로그 파일 안에서 확인할 수 있어야 합니다. 따라서 인라인의 앞선 부여 선택이나 명시적 trained 단계는 나중 카탈로그 파일에 쓸 수 있지만, 다른 외부 카탈로그 파일을 가리키는 참조는 거부합니다. 한 단계의 대안 항목들에 걸친 선택 ID도 고유해야 합니다.

능력치 선택은 시트의 능력치와 `except`와 교집합을 취하는 `from`도 받습니다. 서로 다른 PF2e 강화라면 `restricted` 선택이 `["str", "dex"]`를 제공하고, 그다음 `background/restricted`를 제외하는 `free_boost` 선택을 둘 수 있습니다. 항목 선택은 카탈로그 단계와 같은 `quotas`, `distinctBy`, `quotaBelow`를 받으며 `max`나 `count`로 제한합니다. 여전히 고른 항목 자체의 부여는 적용하지 않고 행을 씁니다.

훈련 선택은 `tier`(미훈련보다 높은 제공 단계이며 부여나 빌더의 단계보다 우선), `only: "any" | "trained" | "untrained"`, `onDuplicate: "replace"`도 받습니다. 자격은 수동 훈련과 앞선 활성 부여를 읽으며 빌더 자신의 이전 쓰기는 제외합니다. 그런 출처가 이미 훈련한 기술을 고르면 같은 종류의 미훈련 기술 중에서 고르는 별도 대체 칸이 열리며 원래 답은 유지합니다. 대체는 선택의 제외와 단계를 따릅니다. 저장 키는 원래 칸의 키에 `/replacement`를 붙인 것입니다. Human의 경력 외 등급은 앞선 경력 선택을 제외하고 `only: "untrained"`를 쓸 수 있습니다. 경력을 바꾸면 나중의 잘못된 답은 유지됩니다.

조건과 새 칸 개수는 앞선 단계가 바꾼 값만 읽을 수 있으므로, 스스로를 활성화하거나 순환하는 부여를 막습니다. 칸 개수는 나중 외부 카탈로그 파일이 바꿀 수 있는 시트 값을 읽을 수 없습니다. 원본 단계를 앞으로 옮기거나 그 카탈로그를 인라인으로 유지하세요. 조건은 기존 파생 `enumTable`을 써서 하위 종족 단계를 한 혈통에만 필수로 만들 수 있습니다. `requiredWhen`은 배지에만 영향을 주며 유효한 비실시간 값은 무엇이든 읽을 수 있습니다. 새로 제약된 선택은 자격 있는 콘텐츠가 없으면 "not configured" 설명과 함께 해결되지 않은 채 남습니다. 필요한 개수를 가능한 콘텐츠에 맞춰 조용히 낮추지 않습니다. 수동 시트 편집과 설명된 캐릭터는 빌더의 기존 소유 규칙을 따릅니다.

빌더 없이 만든 캐릭터(비어 있지 않고 아직 빌더 선택이 없는 시트)는 **described**(설명됨) 상태로 열립니다. 플레이어가 **Done: let picks change the sheet**(완료: 선택이 시트를 바꾸게 하기)를 고를 때까지 선택은 캐릭터가 이미 어떤지를 기록하며(종족의 증가는 이미 점수에 반영된 것으로 봄) 시트에서 아무것도 바꾸지 않습니다. 그때부터 선택을 바꾸면 설명된 선택이 준 것을 되돌립니다.

`tier`가 없으면 훈련은 시트가 제공하는 미훈련 위의 첫 단계로 갑니다. 절반 단계를 제공하는 시트(5e의 기술처럼)는 `"tier": "proficient"`를 설정합니다.
