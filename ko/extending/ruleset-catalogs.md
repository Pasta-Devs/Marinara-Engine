# 규칙 집합 카탈로그

이 페이지는 [Game Mode 규칙 집합 작성하기](writing-rulesets.md)의 일부입니다. 시트 편집기가 선택기에서 제공하는 기성 항목과 관련하여 카탈로그 헤더, 항목, 규칙 집합이 유지하는 값, 시트 명령과 use 명령을 설명합니다.

주문 목록, 장비 표, 클래스 특성 한 페이지를 행마다 입력하기는 힘듭니다. 카탈로그는 규칙 집합에 포함하는 이름 붙은 기성 항목 모음입니다. 시트 편집기는 카탈로그가 공급하는 각 목록에 선택기를 제공하며 하나를 고르면 행을 채웁니다.

카탈로그는 선택 사항으로 최대 열두 개입니다. Engine은 각 카탈로그의 주제를 알지 못하며 ID, 열, 필터, 용어가 모두 파일에서 옵니다.

## 헤더

헤더는 파일 최상위의 `gm` 옆 `catalogs`에 둡니다.

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id`와 `label`: ID는 시트 ID 규칙을 따르며 라벨은 선택기의 이름입니다.
- `holds`: `"rows"`(기본값이며 이 릴리스 전 모든 카탈로그의 형태), `"creatures"`, `"items"` 중 하나입니다. 생물 카탈로그는 전투가 읽는 도감이고, 아이템 카탈로그는 파티가 지니는 물건을 나열합니다. 둘 다 시트에 쓰지 않고 `feeds`를 선언하지 않으며 선택기에 나오지 않습니다. 아래 [생물](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)과 [아이템](ruleset-items.md)을 참고하세요.
- `feeds`: 카탈로그 항목이 쓸 수 있는 시트 목록 한 개에서 여덟 개까지입니다. 행 카탈로그에는 필수이고 생물이나 아이템 카탈로그에는 금지됩니다. 여기 없는 목록이나 목록 열이 담지 못하는 값은 쓸 수 없습니다.
- `filters`: 선택 사항으로 최대 여덟 개이며 선택기에서 목록을 좁히는 기준입니다. `number`, `text`, `tags`(여러 단어)가 있습니다. `startFrom`은 선택기가 처음 사용할 시트 필드로, Calling이 Tinker인 캐릭터는 Tinker 항목을 먼저 봅니다.
- `units`: 선택 사항. 항목의 `mechanics` 블록에 있는 사거리나 범위 크기가 시스템에서 무엇을 뜻하는지입니다.

## 항목

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id`: 소문자, 숫자, 단일 하이픈을 사용하며 카탈로그 안에서 고유합니다.
- `label`과 `summary`: 선택기에 표시하는 내용입니다. 요약은 선택 사항인 한 줄로 최대 300자입니다.
- `filters`: 헤더가 선언한 필터 값입니다. `number`는 숫자, `text`는 문자열 하나, `tags`는 문자열 목록을 받습니다.
- `rows`: 선택할 때 쓰는 1~6개 행입니다. `list`는 카탈로그의 `feeds` 중 하나이며 `values`의 키는 해당 목록 열 ID입니다.
- `creature`: 생물을 `holds`하는 카탈로그에서 행 대신 상대를 정의합니다. 항목은 `rows`와 `creature` 중 정확히 하나만 가지며 생물은 자체 행동에 효과를 쓰므로 `mechanics`를 가지지 않습니다.

모든 값은 대상 목록 열과 대조하므로 잘못 쓴 열 이름이나 범위 밖 숫자는 원래 항목과 함께 보고합니다. 규칙 집합 파일 안의 항목은 로드 시 검사하며 가져온 파일이면 가져오기 시점입니다. 패키지의 별도 카탈로그 파일은 선택기가 처음 요청할 때 검사하고, 잘못된 파일은 항목 대신 이유를 표시합니다.

## 한 항목, 여러 목록

사용 횟수가 제한된 특성은 시트의 두 행입니다. 특성 자체와 횟수를 추적하는 카운터입니다. 그래도 선택은 한 번입니다.

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

## 규칙 집합이 최신으로 유지하는 값

선택한 행의 숫자는 플레이어 소유입니다. 다만 능력치와 같은 사용 횟수나 레벨에 따라 늘어나는 클래스 자원처럼 캐릭터를 따르는 최댓값은 예외로 둘 만합니다. 행은 `scaled` 맵에 자체 숫자 열을 최대 네 개 지정하며 시트 편집기가 셀을 올바르게 유지합니다.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- 키는 목록의 `number` 열 중 하나입니다.
- `from`은 다른 곳과 같은 닫힌 어휘의 일반 값 참조입니다. 복잡한 계산은 시트의 `derived` 값으로 선언하고 `from`이 가리킵니다(`"from": { "derived": "lay_on_hands_max" }`). 새 산술은 추가하지 않습니다.
- `table`은 선택 사항으로 참조 값을 단계 표에서 찾게 합니다. 레벨에서 숫자를 얻는 방식이며 `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`처럼 씁니다.
- `values`에는 여전히 해당 열의 일반 숫자가 필요하며 빠뜨리면 거부합니다. 시트를 모를 때의 값이자 해당 참조가 없는 시트가 유지할 값입니다.
- `scaled` 행은 항목이 그 목록에 쓰는 유일한 행이어야 합니다. 그래야 시트의 표시된 행이 항상 한 명세와 일치합니다. 또는 (Capability API 1.92) 항목이 그 목록에 쓰는 모든 행이 목록의 이름 열(풀의 `nameColumn`, 없으면 첫 텍스트 열)에 자체 이름을 가져야 합니다. 그러면 시트의 행은 그 이름으로 명세와 연결되므로, 특성 하나가 각자 따로 늘어나는 사용 횟수 두 개를 줄 수 있습니다. 플레이어가 이름을 바꾼 행은 그대로 둡니다.

값은 편집할 때 계산하고 읽을 때는 계산하지 않아 저장된 행이 항상 적힌 그대로의 숫자입니다. 해당 열의 `min`, `max`로 제한하고 정수 열은 내림합니다. 위 예에서 Heart 3은 세 번, Heart 0 이하는 0번입니다. 행은 시트에 사용 횟수 0으로 남으며 최댓값 0인 카운터는 풀이 아니므로 플레이 중 쓸 것이 없습니다.

패키지 규칙 집합의 연동 열은 Capability API 1.23입니다. 가져온 커뮤니티 규칙 집합은 읽는 Engine이 검증하므로 별도 선언이 필요 없습니다.

## 선택한 행은 복사본

선택한 각 행은 시트에 복사하며 추가 키 `_catalog`에 `<catalog id>/<entry id>`를 넣습니다. 열 ID는 항상 문자로 시작하므로 이 키는 직접 정의한 열과 겹치지 않습니다.

복사본은 캐릭터 소유입니다. 플레이어는 나중에 무엇이든 편집할 수 있고 규칙 집합이 없어도 시트는 작동하며 새 버전을 게시해도 누구의 캐릭터도 다시 쓰지 않습니다. 선택기는 이 표시로 이미 가진 것을 보여 주며 아래 Refresh도 이를 읽습니다.

## 규칙 집합에서 새로 고침

선택한 행이 표시를 보존하므로 시트 편집기는 새 텍스트가 저장된 행과 다를 때 알려 줄 수 있습니다. 목록 아래에 새 텍스트가 있는 행 수를 표시하고 **Review**(검토) 버튼은 시트 내용과 규칙 집합 내용을 나란히 보여 주며 행마다 체크를 제공합니다. **Update selected**(선택 항목 업데이트)를 누르기 전에는 쓰지 않으며 체크한 행에서 다른 열만 씁니다. 표시를 포함해 나머지는 보존됩니다.

비교 범위는 의도적으로 좁습니다.

- 기존 값은 `text`, `longtext`, `dice`, `enum` 열에서만 비교합니다. 기존 `number`와 `boolean` 값은 플레이어의 것이므로 0과 false를 포함해 보존합니다. 행에 아직 없는 열에는 숫자나 스위치를 포함해 해당 자료형의 값을 제안할 수 있습니다. 시트에 따라 값이 달라지는 열은 이미 시트를 따르므로 제외합니다.
- 항목이 설정하는 열만 비교합니다. 항목에서 생략한 열은 시트에 어떤 값이 있든 건드리지 않습니다.
- 더 이상 제공하지 않는 `enum` 값이나 `maxLength`를 넘긴 텍스트처럼 열 자체가 거부할 값은 쓰지 않고 건너뜁니다.
- 행은 해당 목록에서 같은 표시가 있는 행들 사이의 위치로 원래 항목의 행과 연결합니다. 시트에 남은 행의 수가 항목이 쓰는 수와 같을 때 유효합니다. 그렇지 않으면 항목이 그 목록에 행 하나만 쓸 때에만 연결할 수 있습니다. 두 행짜리 항목에서 플레이어가 하나를 삭제했다면 추측하지 않고 해당 항목을 그대로 둡니다.
- 카탈로그에서 원래 항목이 사라진 행은 별도 알림 없이 그대로 둡니다.

따라서 항목의 설명이나 이름을 바꾸면, 이미 선택한 캐릭터에게도 플레이어가 수락하는 경우 반영할 수 있습니다. 숫자의 의미를 바꾸는 것은 반영할 수 없으며 반영하지 않습니다. 행이 플레이어의 것이 된 순간부터 그 열도 플레이어의 것입니다.

## 시트 명령: 영구 성장

규칙 집합은 `sheet.advancement`로 영구 빌드의 변경을 허용할 수 있습니다.

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

시트가 number 또는 text(`text`나 `longtext`)로 선언한 필드 ID만 최대 24개 넣으세요. 불리언은 각각 모든 능력치, 기술, 내성을 허용하며, 생략하거나 false이면 허용하지 않습니다. 빈 허용 집합, 알 수 없는 필드, 지원하지 않는 필드 타입, 알 수 없는 키는 가져올 때 거부합니다. `text`는 최대 400자의 프롬프트 안전 지침이며 선택 사항입니다. `advancement`가 없으면 기존 명령은 이전처럼 작동하고 모든 `advance` 요청은 거부합니다.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

대상을 정확히 하나 지정하세요. 필드와 능력치는 `by`나 `to` 중 정확히 하나를 받으며, 텍스트는 `to`만 받습니다. 이름과 단계는 대소문자 구분 없이 ID나 라벨과 비교합니다. 기술과 내성은 `resolution.proficiencyTiers`에 선언한 모든 단계를 받습니다. 숫자 필드는 `integer`, `min`, `max`를, 능력치는 정수 경계를, 텍스트는 `maxLength`를 지킵니다. 잘못된 값은 조용히 제한하지 않고 경계를 알려 주는 `bad-amount` 이유와 함께 거부합니다. 꺼진 성장, 허용하지 않은 대상, 알 수 없는 이름, 알 수 없는 단계도 거부합니다. 다시 쓴 태그에는 `result`와 `now`의 새 값이 담깁니다. 플레이어에게는 `who`를 생략하고, 모호하지 않은 모든 파티 카드에는 `who="party"`를 쓰세요. 일부만 거부되면 어느 카드가 성장하지 못했는지 이름을 알려 줍니다.

Engine은 플레이어 편집과 같은 메타데이터 저장소를 통해 게임 카드에 빌드를 저장하며, 시트 버전을 유지하고 새 빌드로 파생 값을 다시 계산합니다. 라이브러리 카드는 바뀌지 않습니다. 실시간 명령과 마찬가지로 다른 스와이프나 재생성한 답변은 나가는 답변의 변경 이전 상태에서 시작합니다. 각 답변은 성장이 없는 답변을 포함해 끝난 시점의 빌드를 기록합니다. 스와이프를 선택하면 그 스냅샷을 복원하고, 최신 답변을 삭제하면 이전 스냅샷이 드러납니다. 오래된 답변을 삭제해도 그 뒤 답변이 제거될 때까지는 나중 스냅샷이 유효합니다. 이어 쓰기는 같은 답변의 스냅샷을 갱신합니다. 실행 취소는 기록된 결과와 여전히 일치하는 값만 바꾸므로, 나중의 플레이어 편집은 보존되고 관련 없는 편집이 XP 보상의 실행 취소를 막지 않습니다.

<a id="the-use-command-letting-the-game-master-spend-a-price-you-wrote"></a>

## `use` 명령: Game Master가 작성한 비용을 지불하게 하기

Game Master는 서술하면서 `[sheet: ...]` 명령으로 각 시트를 갱신합니다. 명령은 `spend`, `restore`(`heal`도 같은 뜻), `damage`, `temp`, `track`, `condition`, `note`, `rest`입니다. 카탈로그를 제공하는 규칙 집합에는 명령 하나가 더 있습니다.

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"`는 `op="use"`와, `spell=`은 `name=`과 같은 뜻입니다. 따라서 형식이 "주문"이라는 말을 따로 알 필요 없이 Game Master가 자연스럽게 선택한 표현으로 작동합니다.

이름은 해당 캐릭터의 시트에서 규칙 집합의 카탈로그에서 온 행을 대상으로 대소문자 구분 없이 찾습니다. 행은 Game Master에게 보여 준 이름(그 목록의 `sheetSummary` 이름 열, 그다음 목록의 `pools.nameColumn`, 그다음 첫 텍스트 열)과 원래 항목의 `label`에 모두 응답합니다. 따라서 플레이어가 행 이름을 바꿔도 계속 찾을 수 있습니다. 해당하는 행이 없는 이름과 서로 다른 두 항목에 해당하는 이름은 모두 거부합니다.

소모하는 것은 다음과 같습니다.

- 항목의 `mechanics.cost`에 있는 모든 비용 항목입니다. 실시간 풀을 지정하면 그 풀에서 지불합니다. 풀 그룹을 지정하면 선언 순서대로 그 그룹에서 비용을 감당할 수 있는 첫 풀에서 지불합니다. 그룹이 항상 단계별 사다리는 아니므로 더 높은 풀로 자동 승급하지 않습니다.
- 여기에 같은 항목이 작성한 모든 목록 행 풀에서 하나씩 더 소모합니다. 특성의 사용 횟수를 추적하는 카운터가 그 예입니다. 위의 `Last Ember` 항목에서는 두 번째 행입니다. 최대치가 0인 카운터에는 사용할 횟수가 없으므로 무료로 통과시키지 않고 명령을 거부합니다.

`pool=`은 상위 단계 사용입니다. 동일한 단일 비용을 같은 그룹의 다른 풀에서 지불합니다. 비용 항목이 정확히 하나이고 지정한 풀이 그 항목과 같은 그룹에 속하거나 그 항목을 대신 지불할 수 있을 때만 허용합니다. 그 밖의 경우에는 뜻을 바꾸어 해석하지 않고 거부합니다.

**다른 그룹을 지불하는 풀**(Capability API 1.171). 실시간 풀의 `pays`는 자신의 레벨(`level`, 또는 자기 그룹 안의 위치)로 비용을 대신 지불할 수 있는 다른 그룹을 최대 넷 지정하며, 자기보다 높은 레벨의 비용은 지불하지 않습니다. 5e의 계약 슬롯은 멀티클래스 워락처럼 주문 슬롯으로 비용을 매긴 주문을 지불합니다.

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

전투는 그런 풀을 주문 자체 그룹의 더 높은 풀 옆에 제시하며, 그 풀로 지불하면 풀의 레벨이 주문보다 높은 단계만큼 주문이 커집니다. 3레벨 계약 슬롯은 3레벨 슬롯처럼 Magic Missile을 지불합니다. 자체 풀이 빈 사용도 더 높은 풀이나 대신 지불하는 풀로만 지불하는 방식으로 여전히 제시되므로, 1레벨 슬롯을 다 쓰면 1레벨 주문을 2레벨 슬롯으로 시전합니다. 항목 `mechanics`의 `targetsPerCostStep`(1.171, 1~10)은 비용을 올린 단계마다 대상을 그만큼 더하며 최대 20입니다. Hold Person은 `"targetCount": 1,
"targetsPerCostStep": 1`입니다.

전부 지불하거나 전부 취소합니다. 어느 한 부분이라도 지불할 수 없으면 명령 전체를 거부하고 아무것도 바꾸지 않으며 플레이어에게 알립니다. 소마법이나 지속 특성처럼 비용이 전혀 없는 항목은 허용되며 아무것도 바꾸지 않습니다.

## 인라인 또는 별도 파일

작은 카탈로그는 `ruleset.json`의 헤더에 있는 `entries`에 인라인으로 넣습니다. 긴 카탈로그는 별도 파일에 두고 헤더의 `asset`으로 지정합니다. 카탈로그는 둘 중 정확히 하나만 가집니다.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

경로는 항상 `catalogs/<the catalog's id>.json`입니다. 파일 자체는 다음과 같습니다.

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

별도 카탈로그 파일은 패키지에 들어갑니다. 공식 카탈로그를 통해 배포하는 패키지이거나, 직접 가져오는 규칙 집합 패키지 파일입니다([규칙 집합 공유하기](writing-rulesets.md#sharing-your-ruleset) 참고). 패키지가 `contributions.assets.paths`에서 `ruleset.json`과 함께 파일을 나열해야 하며 Capability API 1.21이 필요합니다. 생물 카탈로그는 인라인이든 별도 파일이든 Capability API 1.27이 필요하고, 아이템 카탈로그는 1.49가 필요합니다. **단일 파일로 가져오거나 GitHub 저장소로 공유하는 규칙 집합은 카탈로그를 인라인으로 포함합니다.** 따라서 카탈로그도 전체 규칙 집합 파일의 512 KB 제한 안에 들어가야 합니다. 짧은 항목 수백 개 정도를 넣을 수 있는 크기입니다.

제한은 규칙 집합당 카탈로그 12개, 어느 방식이든 카탈로그당 항목 2000개, 카탈로그 파일 하나당 2 MB입니다. `ruleset.json`이 256 KB를 넘거나 카탈로그 파일이 1 MB를 넘는 패키지는 두 제한을 올린 Capability API 1.340이 필요합니다.
