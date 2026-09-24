# Game Mode 규칙 집합 작성하기

규칙 집합은 탁상 게임 시스템의 작동 방식을 Game Mode에 알려 줍니다. 판정에 쓰는 주사위, 캐릭터 시트의 항목, 소비할 자원과 휴식이 회복하는 것을 정합니다. 이 가이드는 직접 규칙 집합을 만들어 공유하려는 분을 위한 것입니다. 다른 사람이 만든 규칙 집합으로 플레이하려면 [규칙 선택](../game/getting-started.md#choosing-rules)부터 읽으세요.

규칙 집합은 JSON 파일 하나이며 코드가 아닌 데이터입니다. 그 안의 내용은 실행되지 않으므로 가져와도 컴퓨터에서 무엇을 실행하지는 않습니다. 다른 사람의 파일을 가져오기 전에 주의 깊게 읽을 부분은 Game Master 텍스트입니다. 그 규칙 집합을 쓰는 모든 게임에서 모델로 보내기 때문입니다.

## 먼저 읽기: 규칙 집합이 할 수 있는 것과 없는 것

규칙 집합은 Engine이 이미 아는 메커니즘의 빈칸만 채울 수 있습니다. 현재 Engine에는 판정을 해결하는 두 방식이 있으며 파일의 `resolution.kind`로 고릅니다.

- **`dice-sum`**: 주사위를 굴려 시트 숫자를 더하고 난이도 이상을 얻습니다. d20 시스템, 2d6에 능력치를 더하는 시스템 등 여러 방식이 해당합니다.
- **`dice-pool`**: 캐릭터 수치만큼 주사위를 던져 목표에 도달한 개수를 셉니다. 평점이 보너스가 아니라 주사위 개수인 시스템을 다룹니다.

둘 다 [판정 종류](#resolution-kinds)에서 자세히 설명합니다.

어느 형태에도 맞지 않는 메커니즘은 규칙 집합 파일로 쓸 수 없습니다. 풀에서 가장 높은 주사위 고르기, 백분율 이하 굴림, 기호 주사위, 대항 풀 등이 예입니다. 각 방식은 Engine 안에 새 판정 종류가 필요하며 JSON이 아닌 테스트를 갖춘 코드 기여입니다. 필요하면 Engine 저장소에 기능 요청을 열고 계산 과정을 보여 주는 몇 가지 굴림으로 설명하세요. 그 예가 테스트가 됩니다.

Game Mode는 Marinara 자체 전투나 규칙 집합의 규칙으로 싸움을 해결할 수 있습니다. 선택적 `battle` 블록은 캐릭터 시트 숫자를 Marinara 전투에 제공합니다. [전투 연결](#battles-lending-the-sheet-to-marinaras-combat)을 참고하세요. 선택적 `combat` 블록은 규칙 집합 자체의 전투 해결 방식을 정합니다. [자체 규칙 전투](#combat-a-fight-your-own-rules-resolve)를 참고하세요. Engine은 현재 이 규칙으로 전투를 진행합니다. 게임의 Combat Preference는 Classic 표시 또는 규칙 집합이 거리를 정의할 경우 Tactical 전장을 선택합니다.

## 빠른 시작

1. 시스템의 굴림 방식에 맞는 예제 파일을 복사하세요. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json)은 능력치 세 개를 가진 작은 2d6 시스템으로, 형식이 d20이나 여섯 능력치를 전제하지 않음을 보여 줍니다. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json)은 평점 셋과 전문 기술 여섯을 가진 작은 10면 주사위 풀입니다. 전체 규모의 예제는 [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json)의 5e (SRD 5.1)를 참고하세요.
2. `id`를 고유한 값으로 바꾸세요. `ember-roads`처럼 소문자, 숫자, 단일 하이픈을 사용합니다.
3. 시트, 휴식, Game Master 텍스트를 편집하세요.
4. 가져오세요([규칙 집합 시험하기](#trying-your-ruleset) 참고). 저장 전에 파일 전체를 검사하고 잘못된 부분을 줄별로 알려 줍니다.
5. 새 게임을 만들고 **Rules**(규칙)에서 해당 규칙 집합을 골라 판정을 몇 번 해 보세요.

입력 중 도움을 받으려면 파일의 바깥 중괄호 안 첫 줄에 다음을 추가하여 편집기에 JSON Schema를 알려 주세요.

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

스키마는 입력 중 잘못 쓴 키와 타입을 잡습니다. 기술이 지정한 능력치처럼 파일의 이름이 실제 존재하는 대상을 가리키는지는 검사하지 못합니다. 그것은 가져오기에서 검사합니다.

파일의 모든 객체에 `"$comment": "..."` 줄을 넣어 메모를 남길 수 있습니다. Engine은 이를 무시합니다.

## 파일 구성

| 키 | 내용 |
| --- | --- |
| `schemaVersion` | 항상 `1`입니다. |
| `id`, `version` | Engine이 쓰는 규칙 집합 이름과, 변경을 게시할 때마다 올리는 정수입니다. |
| `name` | 설정 마법사에서 플레이어에게 보이는 이름입니다. |
| `edition` | 선택 사항. 판이나 초안을 설명하는 한 줄입니다. |
| `license` | 선택 사항. SPDX ID와 원본이 요구하는 저작자 표시입니다. |
| `coverage` | 규칙 집합의 지원 범위와 설정 마법사에 표시할 한 줄 요약입니다. |
| `resolution` | 판정이나 내성을 굴리는 방식입니다. |
| `sheet` | 캐릭터 시트의 모든 내용입니다. |
| `rests` | 휴식 종류별로 회복하고 지우는 내용입니다. |
| `gm` | Game Master 모델이 받는 텍스트와 캐릭터별로 읽는 시트 값입니다. |
| `catalogs` | 선택 사항. 긴 목록을 손으로 쓰지 않도록 시트 편집기가 제공하는 기성 항목입니다. |
| `battle` | 선택 사항. 전투가 시트에서 읽는 내용과 이후 돌려쓰는 내용입니다. |
| `combat` | 선택 사항. 자체 규칙으로 전투를 해결하는 방법과 전투 화면이 실행할 내용입니다. |
| `layers` | 선택 사항. 게임을 만들 때 플레이어가 켜는 규칙 집합 변형입니다. |

파일 크기는 최대 256 KB입니다. 프롬프트에 들어가는 텍스트(이름, 라벨, Game Master 텍스트)에는 줄바꿈, 대괄호, 이중 중괄호를 넣을 수 없습니다.

시트 안의 ID(능력치, 기술, 필드, 풀 등)는 `grit_max`처럼 문자로 시작하며 소문자, 숫자, 밑줄을 사용합니다.

<a id="resolution-kinds"></a>

### 판정 종류

`resolution.kind`가 판정 굴림을 선택합니다. 두 종류는 같은 캐릭터 시트와 세 키를 공유하므로 바꿔도 `resolution` 아래 파일 부분은 달라지지 않습니다.

- `abilityModifier`: 시트 점수를 숫자로 바꾸는 방식입니다. `identity`는 점수 자체, `floorHalfMinusTen`은 5e 규칙, `stepTable`은 `[[score, number], ...]`로 직접 나열한 경계값입니다.
- `proficiencyTiers`: 기술이나 내성의 훈련 단계입니다. 목록에 없는 기술은 첫 단계를 사용합니다. 단계는 `flat`, 숙련 보너스의 `multiplier`배 또는 둘 다를 더합니다. 숙련 보너스가 있는 시스템은 `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`로 출처를 지정하세요.
- `proficiency`: 선택 사항이며 곱셈을 하는 단계에만 필요합니다.

계산한 숫자의 의미는 종류가 정합니다. `dice-sum`은 굴림에 더하고 `dice-pool`은 그만큼의 주사위를 던집니다.

#### `dice-sum`: 주사위 합산

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

- `dice`: 주사위 개수와 면수입니다. 총합을 난이도와 비교합니다.
- `advantage`: Game Master가 두 번 굴려 한 결과를 고르도록 요청할 수 있는지입니다.
- `naturals`: 단일 주사위의 최고·최저 눈이 판정과 내성에 주는 효과로 `none`, `both`, `max-only`, `min-only`입니다. 단순 계산만 할 경우 생략하세요. 한 주사위여야 하므로 2d6 시스템은 `none`을 써야 합니다.
- `difficultyLadder`: Game Master에게 제시하는 난이도 선택지입니다. `dc`는 총합이 도달해야 하는 숫자입니다.

#### `dice-pool`: 던져서 성공 개수 세기

시트 숫자는 추가 보너스가 아니라 **풀의 크기**입니다. 평점 3과 전문 기술 2라면 다섯 개를 던집니다. 원리는 그것뿐입니다. 새 시트 어휘나 편집기 없이, 평점이 주사위 개수인 시스템도 다른 시스템과 같은 `abilities`, `skills`, `proficiencyTiers`로 작성합니다.

```json
"resolution": {
  "kind": "dice-pool",
  "die": { "sides": 10 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "rating_0", "label": "Untried" },
    { "id": "rating_1", "label": "Shown once", "flat": 1 }
  ],
  "pool": { "min": 1, "max": 15 },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: 풀의 주사위 하나의 면수로 2~100입니다.
- `pool`: 폭발 전 시트 숫자를 제한할 범위입니다. `min`이 0이면 빈 풀은 아예 굴리지 않고 실패하며 `max`는 최대 100입니다.
- `target`: 성공으로 세려면 도달해야 하는 눈입니다. `min`을 `max`보다 낮게 쓰면 Game Master가 판정마다 `threshold=`로 바꿀 수 있습니다. 셋을 같게 쓰면 고정합니다.
- `double`: 선택 사항. `from` 이상의 눈은 두 번으로 셉니다.
- `explode`: 선택 사항. `from` 이상이면 한 개를 추가로 굴리며 추가 주사위도 다시 폭발할 수 있습니다. 추가 주사위는 원래 풀에 더해 최대 `pool.max`개이므로 한 판정의 총량은 `pool.max`의 두 배이며 낮은 `from`도 무한히 굴리지 못합니다.
- `cancel`: 선택 사항. `upTo` 이하의 눈은 성공 하나를 빼며 성공 수는 0 아래로 내려가지 않습니다.
- `botch`: 선택 사항. 성공한 주사위가 **하나도 없고** `upTo` 이하의 눈이 나오면 대실패입니다. 한 성공이 상쇄된 풀은 일반 실패이며 대실패가 아닙니다.
- `exceptional`: 선택 사항. 성공한 판정에서 순 성공 수가 이 값 이상이면 대성공입니다.
- `situationalDice`: 선택 사항. 묘기, 부상, 어두운 조명 등에 대해 Game Master가 `bonus=`로 한 판정에서 더하거나 뺄 수 있는 주사위 범위입니다.
- `difficultyLadder`: `successes`는 필요한 성공 수입니다. 단계에 `target`도 지정할 수 있지만 목표를 조정할 수 있고 해당 범위 안일 때만 가능합니다.

`cancel`과 `botch`의 눈은 최저 목표보다 낮아야 하며 모든 규칙의 눈은 실제 그 주사위에 존재해야 합니다. 발동할 수 없는 규칙은 플레이 중 발견하게 하지 않고 가져올 때 거부합니다.

패키지 형태의 풀 규칙 집합은 Capability API 1.24입니다. 가져온 커뮤니티 규칙 집합은 읽는 Engine이 검증하므로 별도 선언이 필요 없습니다.

#### 풀 판정에서 Game Master가 쓸 수 있는 내용

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
```

- `dc`는 목표 숫자가 아니라 필요한 **성공 수**입니다. 1부터 한 굴림이 셀 수 있는 최대치까지 가능합니다. 풀 최댓값을 기준으로 폭발이 가능하면 두 배, 눈을 두 번 세면 다시 두 배입니다.
- `threshold=`는 주사위별 목표를 바꾸며 `target.min`이 `target.max`보다 작을 때만 제공됩니다.
- `bonus=`는 주사위를 더하거나 빼며 `situationalDice`를 선언했을 때만 제공됩니다.
- `with=`는 기술이나 내성의 본래 능력치 대신 다른 능력치를 씁니다. 두 종류 모두 지원하므로 5e의 "Strength (Intimidation)"도 같은 속성으로 표현합니다.

모두 파일 선언 범위로 제한합니다. 범위 밖 값은 가장 가까운 끝값으로 조정하고, 규칙 집합에 없는 능력치는 판정을 거부하지 않고 무시합니다. 저장 기록에는 제한 후의 목표와 보너스 주사위 등 실제 사용한 값이 나오며, `with=`는 능력치를 실제 바꿨을 때만 남습니다. Engine이 항상 직접 굴립니다. 모델이 쓴 풀 결과는 교체하고, 이 종류에는 이점이 없어 `mode="advantage"`를 무시하며, 플레이어가 턴 전에 굴린 주사위도 적용하지 않습니다.

#### 범위 밖의 기능과 그 이유

다음은 목표에 도달한 주사위를 세는 방식으로 표현할 수 없어 각각 자체 판정 종류가 필요합니다.

- **가장 높은 주사위 선택**(Blades in the Dark 등)은 현재 판정 결과에 없는 부분 성공 단계가 필요합니다.
- **능력치와 비교하는 태세 풀**(Lasers and Feelings 등)은 판정마다 초과 또는 미만을 정하는 다른 비교입니다.
- **기호 주사위**(Genesys 등)는 숫자를 만들지 않습니다.
- **대항 풀**은 두 캐릭터를 함께 해결하지만 판정의 굴림 주체는 한 명입니다.
- **목표 이하 굴림과 열린 범위 백분율**은 비교 방향이 반대입니다.
- **와일드 주사위가 있는 합산 풀**(OpenD6 등)은 주사위를 더하고 하나를 특별 취급합니다.

이 종류가 예전에 제외하던 나머지 둘은 이제 구현되었으며 아래 자원 소비로 굴림 바꾸기에서 설명합니다. 시스템 자체의 "한 점을 써 성공 하나 얻기"는 `resolution.spend`로 성공이나 주사위를 사며 재굴림은 사지 않습니다. 재굴림은 캐릭터가 선택한 것에 속하므로 카탈로그 항목의 `mechanics.check`이며 해당 항목의 비용을 지불합니다.

### 자원 소비로 굴림 바꾸기

일부 시스템은 의지 한 점으로 자동 성공을 얻듯, 앞으로 할 굴림에 비용을 낼 수 있습니다. `resolution.spend`는 캐릭터가 구입한 특성이 아니라 시스템의 상시 규칙으로 이를 선언합니다.

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool`은 `live.pools` 중 하나입니다. 시작할 때 비어 있는 풀은 플레이 시작 시 쓸 것이 없으므로 사용할 수 없습니다.
- `amount`는 한 번의 구매 비용입니다. `successes`와 `dice`가 얻는 것이며 적어도 하나를 구매해야 합니다. 구매한 성공은 누구도 굴린 것이 아니므로 주사위 집계와 상쇄가 끝난 뒤 더합니다. 주사위는 풀 범위 안에서 풀과 함께 던집니다.
- `perCheck`는 한 판정의 구매 횟수입니다. 최대 `amount * perCheck`점어치를 사며, 이 상한은 가득 찬 풀로 실패 불가능한 굴림을 사지 못하게 합니다.
- `dice-pool`만 가질 수 있습니다. 합산 굴림에는 더할 성공이나 주사위를 추가할 풀이 없으므로 `spend`를 선언한 `dice-sum`은 가져올 때 거부됩니다.
- 두 항목이 같은 풀을 지정하면 판정이 어느 쪽인지 구분할 수 없으므로 금지됩니다.

**판정 자체에 씁니다.** Game Master는 별도의 `[sheet:]` 대신 `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`를 씁니다. 시트 명령 적용 전에 주사위를 굴려 별도 명령으로는 바꿀 것이 없기 때문입니다. 하나의 해결 과정이 굴림과 이를 바꾸는 비용 지불을 함께 합니다.

### 굴림을 바꾸는 부적

`resolution.spend`는 시스템 규칙입니다. 캐릭터가 실제 선택한 항목도 카탈로그의 `mechanics.check`로 판정을 바꿀 수 있습니다.

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll`은 `upTo` 이하의 주사위를 다시 던집니다. `once`는 각각 한 번만 바꾸고 새 눈을 확정하며 `until`은 계속합니다. 풀 전체를 영원히 다시 던지지 않도록 `upTo`는 최고 눈보다 낮은 실제 눈이어야 하며, 파일 선언과 무관하게 Engine은 판정당 재굴림 수를 제한합니다.
- `dice`는 풀을 던지기 전에 주사위를, `successes`는 집계 뒤 성공을 더합니다. `threshold`는 `target` 허용 범위 안에서 해당 굴림의 주사위별 목표를 정합니다.
- 넷 중 하나 이상이 필요하며, 없으면 아무 효과도 없어 거부됩니다.
- 이 모든 것을 지원하는 것은 `dice-pool`뿐이므로 `mechanics.check`가 있는 `dice-sum`은 가져올 때 거부됩니다.

**비용은 항목 자체의 `cost`입니다.** 다른 항목 사용과 같은 처리로 풀과 해당 항목이 만든 모든 카운터의 한 번 사용량을 지불합니다. `perCostStep`은 항목이 확장됨을 뜻합니다. 선언하면 가격을 지불한 횟수만큼 구매하며, 없으면 얼마를 제시했든 한 번만 구매합니다.

**Game Master는 판정에 이름을 적습니다.** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`입니다. 위와 같이 장부 처리가 실행되기 전에 주사위를 굴리므로 별도 시트 명령이 아닙니다.

**전부 아니면 전무입니다.** 풀이 부족하면 구매하지 않고 차감도 없으며 원래 굴림 그대로입니다. 정수 횟수의 구매에 맞지 않는 점수도 아무것도 사지 않습니다. `perCheck` 초과 요청은 거부하지 않고 상한으로 줄여 그만큼만 지불합니다. 이를 모두 Engine이 계산합니다. Game Master는 플레이어가 쓴다고 말한 것을 이름으로 지정하고 주사위는 건드리지 않습니다. 기록에는 실제 지불액, 적용 항목, 굴리지 않고 얻은 성공 수와 다시 던진 주사위 수가 나옵니다. 선택하지 않은 부적이나 Engine이 카탈로그를 읽지 못하는 부적은 믿고 적용하지 않고 아무 효과도 내지 않습니다.

### 시트

- `sections`는 편집기 항목을 묶습니다.
- `abilities`는 핵심 능력치입니다. `skills`와 `saves`는 각각 굴림에 쓸 능력치를 지정할 수 있습니다.
- `fields`는 단일 값입니다. 타입은 `number`, `text`, `longtext`, `boolean`, `enum`(고정 선택지), `dice`(`1d8` 같은 텍스트)입니다.
- `derived`는 다른 값에서 계산하며 직접 덮어쓸 수 없습니다. 연산은 `sum`, `min`, `max`, `scale`(곱하고 반올림), `stepTable`(레벨에서 숙련 보너스를 찾듯 경계값 표로 조회)입니다.
- `lists`는 장비, 주문, 특성 같은 자체 열을 가진 표입니다. `pools`가 있는 목록은 사용 횟수가 제한된 클래스 특성 등을 위해 각 행을 자체 최대값이 있는 자원으로 만듭니다.
- `live`는 플레이 중 바뀌는 내용입니다. `pools`(체력, 주문 슬롯, Grit), `tracks`(탈진 같은 범위 값 또는 칸에 표시하는 부상 트랙), `text`(집중 중인 대상 같은 짧은 메모), `conditions`입니다.

숫자를 읽는 것은 값 참조로 지정합니다. 정확히 하나의 키를 가진 객체이며 키는 `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`입니다. 예를 들어 최대값이 파생 값인 풀은 `"max": { "derived": "grit_max" }`입니다.

`hideWhen`은 다른 필드가 지정한 값일 때 필드, 목록, 풀을 숨깁니다. 5e 파일은 주문을 쓰지 않는 캐릭터에게 주문 슬롯을 숨길 때 사용합니다.

### 부상 트랙: 숫자 대신 트랙인 체력

체력을 세지 않는 시스템도 많습니다. 점점 나빠지는 칸의 열을 만들고 다칠 때 표시합니다. `live.tracks` 항목에 `levels`와 `kinds`를 주면 범위 숫자가 아닌 이런 형태가 됩니다.

**시스템에 필요한 형태는 무엇인가요?** 풀은 받은 피해량을, 트랙은 각 피해의 양과 종류를 기록합니다. 타격성, 치명성, 악화성 부상을 구분하며 악화성은 천천히 낫거나 흡수하지 못하거나 결국 죽음에 이르게 하는 등 타격 후에도 종류가 중요하면, 굴림 뒤에도 이를 보관해야 합니다. 종류를 보관하는 것은 표시뿐입니다. 점수 풀은 피해를 빼면 작은 숫자가 될 뿐 시트가 어느 점수가 어떤 종류였는지 기억하지 못합니다. 그래서 체력이 풀인 규칙 집합의 `combat.damageKinds`는 조용히 무시하지 않고 거부합니다. 풀에도 `damageTypes`를 두고 상대가 저항하거나 면역일 수 있습니다. 이는 이후 상처 종류가 아니라 타격의 얼마가 실제 들어가는지에 관한 문제이기 때문입니다.

```json
{
  "id": "harm",
  "label": "Harm",
  "min": 0,
  "max": 4,
  "levels": [
    { "label": "Scuffed", "penalty": 0 },
    { "label": "Winded", "penalty": -1 },
    { "label": "Bleeding", "penalty": -3 },
    { "label": "Down", "penalty": -99 }
  ],
  "kinds": [
    { "id": "knock", "label": "K", "severity": 0 },
    { "id": "tear", "label": "T", "severity": 1 }
  ]
}
```

- `levels`는 좋은 상태부터 나쁜 상태까지 1~16단계입니다. 각각 `label`과 0 이하의 정수 `penalty`를 가집니다. 큰 음수로 행동 불능을 표현하므로 `-99`도 괜찮습니다.
- `kinds`는 트랙이 받을 피해 1~6종류이며 각각 `id`, 칸에 쓸 짧은 `label`, `severity`를 가집니다. 심각도는 서로 달라야 하며 숫자는 순서 외 의미가 없어 간격은 자유입니다.
- 둘은 함께 있어야 합니다. `levels` 없는 `kinds`는 표시할 곳이 없어 거부하고, `kinds` 없는 `levels`는 표시에 종류가 필요하므로 거부합니다.
- **두 용어를 구분하세요.** `kinds`는 표시가 될 수 있는 종류를 규칙 집합이 정의한 것입니다. 표시는 플레이 중 그 종류 하나가 트랙에 놓인 것입니다. 정의는 종류를, 시트는 표시를 가집니다.
- 트랙 길이는 단계 수이므로 `min`은 0, `max`는 `levels.length`입니다. 다르게 선언하면 조용히 수정하지 않고 거부하여 서로 다른 길이 둘을 파일에 두지 않습니다.

모호하게 이해하면 잘못된 트랙이 되므로 **정확한 규칙**을 설명합니다.

- 표시는 **가장 심한 것부터** 정렬합니다. 일곱 단계 트랙은 최대 일곱 표시를 담습니다.
- 표시는 끝에 붙이지 않고 기존 표시 사이에 **심각도 순서로 배치**합니다. 그 심각도가 차지할 수 있는 가장 높은 단계를 차지하고 가벼운 표시를 아래로 밉니다.
- 적용 페널티는 표시들의 합이 아니라 **표시된 가장 아래 단계**의 값입니다. 위 트랙의 표시 셋은 `0 + -1 + -3`이 아니라 `-3`입니다.
- `amount`는 한 종류의 표시 개수이며 **하나씩 적용**합니다. 도중에 가득 찬 트랙도 처음부터 가득 찬 것과 같은 규칙을 따릅니다.
- **가득 찬** 트랙에 표시하면 새 표시를 더하지 않고 **가장 가벼운 표시를 한 단계 올립니다**. 새 표시 종류와 무관하게 자체 종류 순서에서 한 단계입니다.
- 최고 심각도를 넘게 될 표시는 최고에 머물며 들어가지 못한 것은 **초과분**으로 셉니다. 초과분도 저장하여 새로고침으로 이미 받은 피해를 잊지 않습니다.
- **회복은 같은 명령에 음수를 씁니다.** 가벼운 표시부터 지우며, 표시보다 초과분을 먼저 지웁니다.

**플레이 중 표시하기.** Game Master는 `[sheet: op="damage" track="harm" kind="knock" amount="1"]`를 쓰고 음수 `amount`로 회복합니다. 대신 `pool=`을 지정하는 기존 `damage`는 그대로입니다. 숫자만으로 새 표시 종류를 알 수 없어 부상 트랙에는 일반 `track` 명령을 거부합니다. 시스템이 기대하는 대로 플레이어도 시트에서 직접 표시하고 지울 수 있습니다.

**전투도 표시할 수 있습니다.** `combat.health`를 풀 대신 트랙에 지정하면 명중 타격이 `combat.damageKinds.marks`가 정한 칸 수에 해당 블록이 피해 타입을 대응시킨 종류의 표시를 남깁니다. 트랙이 가득 차면 캐릭터가 쓰러지며 죽음 규칙이 이를 읽습니다. 회복은 표시 하나를 지웁니다. 임시 점수를 둘 버퍼가 없으므로 임시 점수는 거부합니다. Engine은 트랙을 남은 단계 수로 읽으므로 전투의 다른 부분, 쓰러짐, 소생, 로그와 요약은 그대로입니다.

**휴식도 부상 트랙을 회복할 수 있습니다.** `"to"`로 트랙을 지정한 회복 단계는 초과분을 포함해 지정한 표시 수까지 줄입니다. `"by"`는 초과분부터 지정한 개수를 지웁니다. 휴식은 표시할 종류를 지정하지 않으므로 표시를 더하게 되는 단계는 아무것도 하지 않습니다.

### 굴림 페널티

`resolution.penaltyFrom`은 이 규칙 집합의 모든 판정에 페널티를 적용할 부상 트랙을 지정합니다. 추정하지 않고 선언하므로 생략한 규칙 집합은 부상 트랙 도입 전과 같은 방식으로 굴립니다.

페널티의 작용은 시트 숫자와 마찬가지로 판정 종류가 정합니다.

- `dice-pool`은 **풀에서 주사위를 빼고** 자체 `pool.min`을 하한으로 합니다. `pool.min`이 1이면 맨 아래 단계도 한 개를 던지며, `pool.min`이 0이면 아무것도 던지지 않고 실패합니다.
- `dice-sum`은 **굴림의 고정 수정치**이며 능력치와 훈련이 더하는 숫자에 합칩니다.

지정한 트랙은 부상 트랙이어야 합니다. 일반 트랙에는 적용할 페널티가 없어 가져올 때 거부합니다. 결과는 적용 페널티를 알려 주사위가 줄어든 이유를 보여 주며 Game Master의 시트 블록도 단계와 비용을 표시합니다.

### 휴식

휴식은 회복 단계와 지울 것의 목록입니다. 각 단계는 대상 하나(`pool`, `poolGroup`, `listPools`, `track`)를 지정하고 값을 설정하거나(`"to": "max"`, `"to": "min"`, 숫자) 변경합니다(`"by": { "const": 1 }`, `"by": { "fractionOfMax": 0.5 }`). 부상 트랙 단계는 회복만 할 수 있으며 위에서 설명합니다.

### Game Master 텍스트

- `checkGuidance`는 Game Master에게 판정 요청 방법을 알려 주는 내장 문단을 대체합니다. 어떤 시스템이며 언제 굴릴지 쓰세요. Game Master는 기술과 난이도만 지정하며 Engine이 시트로 계산하고 굴리므로 모델에게 계산을 요구하지 마세요.
- `sheetGuidance`는 프롬프트에서 시트를 소개합니다. 중요한 자원과 소비 시점을 설명하세요.
- `worldGuidance`는 선택 사항이며 세계 생성 시 한 번만 읽습니다. 화약 없음, 희귀한 마법, 걸어 다니는 망자 등 GM이 만드는 세계관을 규칙에 맞춥니다. 턴에는 들어가지 않습니다.
- `sheetSummary`는 캐릭터마다 GM에게 보일 필드, 파생 값, 목록 행을 고릅니다. Engine은 능력치 수정치, 훈련된 기술과 내성, 실시간 값을 항상 표시합니다. 매 턴 보내므로 나머지는 짧게 유지하세요.

## 카탈로그: 시트 목록의 기성 항목

주문 목록, 장비 표, 클래스 특성 한 페이지를 행마다 입력하기는 힘듭니다. 카탈로그는 규칙 집합에 포함하는 이름 붙은 기성 항목 모음입니다. 시트 편집기는 카탈로그가 공급하는 각 목록에 선택기를 제공하며 하나를 고르면 행을 채웁니다.

카탈로그는 선택 사항으로 최대 열두 개입니다. Engine은 각 카탈로그의 주제를 알지 못하며 ID, 열, 필터, 용어가 모두 파일에서 옵니다.

### 헤더

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
- `holds`: `"rows"`(기본값이며 이 릴리스 전 모든 카탈로그의 형태) 또는 `"creatures"`입니다. 생물 카탈로그는 전투용 도감이며 시트에 쓰지 않고 `feeds`를 선언하지 않으며 선택기에 나오지 않습니다. 아래 [생물](#creatures-a-bestiary-a-fight-reads)을 참고하세요.
- `feeds`: 카탈로그 항목이 쓸 수 있는 시트 목록 1~8개입니다. 행 카탈로그에는 필수이고 생물 카탈로그에는 금지됩니다. 여기 없는 목록이나 목록 열이 담지 못하는 값은 쓸 수 없습니다.
- `filters`: 선택 사항으로 최대 여덟 개이며 선택기에서 목록을 좁히는 기준입니다. `number`, `text`, `tags`(여러 단어)가 있습니다. `startFrom`은 선택기가 처음 사용할 시트 필드로, Calling이 Tinker인 캐릭터는 Tinker 항목을 먼저 봅니다.
- `units`: 선택 사항. 항목의 `mechanics` 블록에 있는 사거리나 범위 크기가 시스템에서 무엇을 뜻하는지입니다.

### 항목

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

### 한 항목, 여러 목록

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

### 규칙 집합이 최신으로 유지하는 값

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
- `scaled` 행은 항목이 그 목록에 쓰는 유일한 행이어야 합니다. 그래야 시트의 표시된 행이 항상 한 명세와 일치합니다.

값은 편집할 때 계산하고 읽을 때는 계산하지 않아 저장된 행이 항상 적힌 그대로의 숫자입니다. 해당 열의 `min`, `max`로 제한하고 정수 열은 내림합니다. 위 예에서 Heart 3은 세 번, Heart 0 이하는 0번입니다. 행은 시트에 사용 횟수 0으로 남으며 최댓값 0인 카운터는 풀이 아니므로 플레이 중 쓸 것이 없습니다.

패키지 규칙 집합의 연동 열은 Capability API 1.23입니다. 가져온 커뮤니티 규칙 집합은 읽는 Engine이 검증하므로 별도 선언이 필요 없습니다.

### 선택한 행은 복사본

선택한 각 행은 시트에 복사하며 추가 키 `_catalog`에 `<catalog id>/<entry id>`를 넣습니다. 열 ID는 항상 문자로 시작하므로 이 키는 직접 정의한 열과 겹치지 않습니다.

복사본은 캐릭터 소유입니다. 플레이어는 나중에 무엇이든 편집할 수 있고 규칙 집합이 없어도 시트는 작동하며 새 버전을 게시해도 누구의 캐릭터도 다시 쓰지 않습니다. 선택기는 이 표시로 이미 가진 것을 보여 주며 아래 Refresh도 이를 읽습니다.

### 규칙 집합에서 새로 고침

선택한 행이 표시를 보존하므로 시트 편집기는 새 텍스트가 저장된 행과 다를 때 알려 줄 수 있습니다. 목록 아래에 새 텍스트가 있는 행 수를 표시하고 **Review**(검토) 버튼은 시트 내용과 규칙 집합 내용을 나란히 보여 주며 행마다 체크를 제공합니다. **Update selected**(선택 항목 업데이트)를 누르기 전에는 쓰지 않으며 체크한 행에서 다른 열만 씁니다. 표시를 포함해 나머지는 보존됩니다.

비교 범위는 의도적으로 좁습니다.

- 기존 값은 `text`, `longtext`, `dice`, `enum` 열에서만 비교합니다. 기존 `number`와 `boolean` 값은 플레이어의 것이므로 0과 false를 포함해 보존합니다. 행에 아직 없는 열에는 숫자나 스위치를 포함해 해당 자료형의 값을 제안할 수 있습니다. 시트에 따라 값이 달라지는 열은 이미 시트를 따르므로 제외합니다.
- 항목이 설정하는 열만 비교합니다. 항목에서 생략한 열은 시트에 어떤 값이 있든 건드리지 않습니다.
- 더 이상 제공하지 않는 `enum` 값이나 `maxLength`를 넘긴 텍스트처럼 열 자체가 거부할 값은 쓰지 않고 건너뜁니다.
- 행은 해당 목록에서 같은 표시가 있는 행들 사이의 위치로 원래 항목의 행과 연결합니다. 시트에 남은 행의 수가 항목이 쓰는 수와 같을 때 유효합니다. 그렇지 않으면 항목이 그 목록에 행 하나만 쓸 때에만 연결할 수 있습니다. 두 행짜리 항목에서 플레이어가 하나를 삭제했다면 추측하지 않고 해당 항목을 그대로 둡니다.
- 카탈로그에서 원래 항목이 사라진 행은 별도 알림 없이 그대로 둡니다.

따라서 항목의 설명이나 이름을 바꾸면, 이미 선택한 캐릭터에게도 플레이어가 수락하는 경우 반영할 수 있습니다. 숫자의 의미를 바꾸는 것은 반영할 수 없으며 반영하지 않습니다. 행이 플레이어의 것이 된 순간부터 그 열도 플레이어의 것입니다.

### `mechanics`: 항목이 수치로 하는 일

항목에는 수치상의 효과를 설명하는 선택적 `mechanics` 블록을 넣을 수 있습니다. 지원 항목은 `kind`(`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount`(`2d6` 같은 주사위 또는 고정 수치), `damageType`, `attackRoll`, `autoHit`, `save`(시트의 내성 판정 하나와 성공 시 효과), `applies`(대상에게 부여하는 상태), `temporary`(체력 풀의 임시 점수), `scales`(시트에 따라 증가하는 양), `cost`(사용할 때 소모하는 풀), `perCostStep`, `budget`(소모하는 행동 체계의 부분), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider`, `check`입니다.

선택기는 이 블록을 한 줄로 표시합니다. 나머지를 읽는 주체는 규칙 집합이 어떤 블록을 선택했는지에 따라 다릅니다.

- [`combat` 블록](#combat-a-fight-your-own-rules-resolve)이 있으면 전투가 전투 효과를 읽습니다. `range`, `area`, `friendlyFire`는 위치가 있는 전장에서 적용됩니다. `reaction`은 무언가에 대응하는 항목을 표시하며, 기다리는 계기를 지정할 수 있을 때까지 이렇게 표시된 항목은 어느 메뉴에도 나오지 않습니다. `check`는 위에서 설명한 대로 기술 판정에 적용됩니다.
- [`battle` 블록](#battles-lending-the-sheet-to-marinaras-combat)만 있으면 전투는 `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType`, `cost`를 읽습니다. Marinara 자체 전투에서 활용할 수 있는 부분이 이것들이기 때문입니다.

어휘는 고정되어 있습니다. 위 목록에 없는 키나 값은 조용히 무시하지 않고 거부합니다.

`cost`는 전투 밖에서 Game Master의 `use` 명령이 지불하는 비용이기도 합니다. 다음 절에서 설명합니다.

### `use` 명령: Game Master가 작성한 비용을 지불하게 하기

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

`pool=`은 상위 단계 사용입니다. 동일한 단일 비용을 같은 그룹의 다른 풀에서 지불합니다. 비용 항목이 정확히 하나이고 지정한 풀이 그 항목과 같은 그룹에 속할 때만 허용합니다. 그 밖의 경우에는 뜻을 바꾸어 해석하지 않고 거부합니다.

전부 지불하거나 전부 취소합니다. 어느 한 부분이라도 지불할 수 없으면 명령 전체를 거부하고 아무것도 바꾸지 않으며 플레이어에게 알립니다. 소마법이나 지속 특성처럼 비용이 전혀 없는 항목은 허용되며 아무것도 바꾸지 않습니다.

### 인라인 또는 별도 파일

작은 카탈로그는 `ruleset.json`의 헤더에 있는 `entries`에 인라인으로 넣습니다. 긴 카탈로그는 별도 파일에 두고 헤더의 `asset`으로 지정합니다. 카탈로그는 둘 중 정확히 하나만 가집니다.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

경로는 항상 `catalogs/<the catalog's id>.json`입니다. 파일 자체는 다음과 같습니다.

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

별도 카탈로그 파일은 공식 카탈로그를 통해 배포하는 패키지용입니다. 패키지가 `contributions.assets.paths`에서 `ruleset.json`과 함께 파일을 나열해야 하며 Capability API 1.21이 필요합니다. 생물 카탈로그는 인라인이든 별도 파일이든 Capability API 1.27이 필요합니다. **단일 파일로 가져오거나 GitHub 저장소로 공유하는 규칙 집합은 카탈로그를 인라인으로 포함합니다.** 따라서 카탈로그도 전체 규칙 집합 파일의 256 KB 제한 안에 들어가야 합니다. 짧은 항목 수백 개 정도를 넣을 수 있는 크기입니다.

제한은 규칙 집합당 카탈로그 12개, 어느 방식이든 카탈로그당 항목 2000개, 카탈로그 파일 하나당 1 MB입니다.

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## 전투: Marinara 전투에 시트 빌려주기

기본적으로 전투는 시트를 전혀 모릅니다. 늘 하던 방식대로 전투원을 만들며, 캐릭터가 전투를 마쳐도 시트의 체력이 그대로일 수 있습니다.

선택적 `battle` 블록은 한 방향으로만 이를 바꿉니다. 전투에 시트의 수치를 빌려주고 전투 결과를 다시 기록합니다. **전투가 작성한 규칙을 따르게 만드는 것은 아닙니다.** 주사위 계산과 누가 누구를 얼마나 때리는지는 여전히 Marinara의 규칙입니다. 따라서 체력은 자체 수치 그대로가 아니라 최대치에 대한 비율로 가져옵니다. 시트에서 체력이 절반인 캐릭터는 Marinara가 만든 체력 막대의 절반으로 전투를 시작합니다. 체력 풀의 9점이 한 방에 12 피해를 입는 전투에 그대로 들어가는 일은 없습니다.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`: 필수입니다. 전투에서 캐릭터의 체력으로 쓰는 실시간 풀입니다. 행이 풀인 목록이 아니라 `sheet.live.pools`의 풀 중 하나여야 합니다.
- `energy`: 선택 사항입니다. 전투가 소모할 수 있는 실시간 풀로 MP 막대가 됩니다. 전투에서 체력을 연료로 소모할 수 없으므로 `health`와 다른 풀이어야 합니다.
- `slots`: 선택 사항입니다. 전투가 한 번에 하나씩 소모하는 실시간 풀로, 각각 1부터 9까지의 `level`을 갖습니다. 예: `[{ "pool": "slots_1", "level": 1 }]`. 각 레벨과 풀은 한 번씩만 사용합니다.
- `skills`: 선택 사항이며 최대 8개입니다. 행이 캐릭터의 전투 기술이 되는 시트 목록입니다. 카탈로그에서 온 행만 해당하며, 그 행의 원본 항목에 `mechanics` 블록이 있을 때만 적용됩니다. 손으로 입력한 행에는 수치상의 의미가 없습니다. `onlyWhen`은 준비한 주문처럼 행에서 참으로 설정해야 하는 불리언 열을 지정합니다. `alwaysWhen`은 준비하지 않고도 시전하는 주문처럼 예외적으로 행을 통과시키는 열과 값을 지정합니다. `onlyWhen`의 예외이므로 함께 지정하지 않으면 거부합니다.

### 가져오는 것과 되돌려 쓰는 것

**가져오기:** 게임에 시트가 있는 각 파티원의 체력 풀이 최대치에서 차지하는 비율로 Marinara 자체 체력 막대의 시작 위치를 정합니다. 에너지 풀은 MP, 각 슬롯 풀은 해당 레벨의 슬롯, 표시된 행은 기술이 됩니다. 최대 체력, 공격력, 방어력, 속도, 레벨은 Marinara 자체 수치를 유지합니다. 체력 풀이 0인 캐릭터는 시트가 그렇게 정했으므로 쓰러진 상태로 전투를 시작합니다. 0보다 큰 캐릭터는 최소 체력 1로 시작하므로 작은 비율을 반올림하다 쓰러뜨리는 일은 없습니다.

**되돌려 쓰기:** 전투가 끝나면 전투원이 마지막으로 가진 체력 막대의 비율을 체력 풀 자체의 척도로 읽어 되돌리고, 전투 시작 시점과의 차이를 피해나 회복으로 적용합니다. 에너지와 슬롯은 비율이 아닌 개수이므로 그대로 기록합니다. 모든 변경에는 시트 자체 버튼과 같은 규칙이 적용됩니다. 시트가 거부한 변경은 강제로 적용하지 않고 건너뛴 뒤 알립니다. 전투원의 체력이 움직이지 않은 전투에서는 체력 변경을 전혀 쓰지 않으므로, 두 번의 변환 자체가 시트를 바꿀 수는 없습니다.

**어느 쪽도 아님:** 공격 굴림, 내성 굴림, 집중, 더 높은 비용이 추가하는 효과입니다. 이런 정보는 언젠가 실제 전투 시스템이 읽을 수 있도록 `mechanics` 블록에 들어 있습니다. 이 연결 기능은 적용하지 않으며, 규칙 집합도 적용한다고 주장해서는 안 됩니다.

중단된 전투는 아무것도 되돌려 쓰지 않습니다. 전투가 시작된 메시지를 삭제하거나 전투가 끝까지 진행되지 않으면 시트는 정확히 이전 그대로입니다. 전투가 일어나지 않은 셈입니다.

### 항목이 기술이 되는 방식

카탈로그 항목의 `mechanics` 블록은 다음과 같이 읽습니다.

- `kind`는 기술 유형이 됩니다. `utility` 항목과 `reaction`으로 표시한 항목은 Marinara 전투에서 처리할 자리가 없어 제외합니다.
- `amount`는 타격의 위력을 정하되, 피해 수치 대신 전투원 자체 공격력에 대한 배율로 사용합니다. 더 큰 주사위가 더 약하게 맞는 일은 없으며, 배율은 생성된 기술이 이미 쓰는 범위 안에 머뭅니다.
- `range`와 `area.size`를 카탈로그의 `units.distance.perCell`로 나누어 격자 칸으로 바꾸며, 내림으로 0이 되는 일은 없습니다. 폭발은 반경, 원뿔은 그 절반, 직선은 한 칸이 됩니다. 범위가 있는 것은 그 안의 모든 적을 대상으로 하며 `friendlyFire`도 지킵니다.
- `damageType`은 기술의 속성이 됩니다. `targets`는 가져오지 않습니다. Marinara 전투가 기술 유형에 따라 회복, 강화, 공격을 누구에게 겨눌 수 있는지 결정합니다.
- 에너지 풀의 `cost`는 MP 비용이 되며 여러 에너지 비용은 합산합니다. 슬롯 정확히 하나의 `cost`는 해당 레벨 슬롯 하나를 소모합니다. Marinara 전투는 한 종류의 에너지 수치 또는 슬롯 하나만 청구하고 둘을 함께 청구하지 않습니다. 따라서 슬롯 두 개, 서로 다른 두 레벨의 슬롯, 또는 슬롯과 에너지를 함께 쓰는 항목은 전투에서 제외합니다. 체력이나 클래스 자원 같은 다른 풀의 비용도 제외합니다. 그렇지 않으면 Engine이 무료로 내주게 되기 때문입니다.
- `buff`와 `debuff`는 Marinara 자체 강화와 약화가 됩니다. 시트의 상태 해제처럼 항목 설명이 그 밖에 약속하는 효과는 전투에서 적용되지 않습니다. 전투 밖에서만 의미가 있는 효과의 항목에는 `mechanics`를 넣지 마세요.

`coverage.combat`는 별개이며 의미도 그대로입니다. 전투가 실제로 해당 시스템의 규칙을 따를 때만 설정하세요.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## 전투: 자체 규칙으로 해결하는 싸움

위의 `battle` 블록은 계산을 Marinara에 맡긴 채 전투에 시트 수치를 빌려줍니다. 선택적 `combat` 블록은 다릅니다. 자체 규칙이 전투를 어떻게 해결하는지 정합니다. `resolution`이 판정 유형에 매개변수를 주듯 Engine이 소유한 전투 유형에 매개변수를 주며, 그 안의 모든 이름은 작성자가 정합니다. 현재 유형은 하나입니다.

**규칙 집합이 `combat`를 선언한 게임은 그 블록에 따라 싸웁니다.** 파티 수치는 각자의 시트에서 읽고, 상대는 자체 생물 도감이나 위협 척도에서 가져오며, 매 턴을 자체 주사위로 해결합니다. 캐릭터가 소모하거나 잃는 모든 것은 발생하는 즉시 시트에 기록하므로 전투 도중 탭을 닫아도 잃지 않습니다. 전투 화면도 작성자의 용어로 진행합니다. 자체 공격과 능력이 메뉴가 되고, 자체 행동 예산과 상태를 사용하며, 로그에는 실제 계산이 나옵니다. 아직 하지 못하는 것은 '아직 지원하지 않는 것'에 나열되어 있습니다.

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

이것이 Ember Roads 블록 전체이며, Ember Roads 게임은 이 블록으로 싸웁니다. 5e 초안은 d20 시스템에 같은 키를 사용합니다.

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

### 모든 키

- `kind`: `"attack-vs-defense"`. 한쪽이 상대의 방어를 상대로 주사위를 굴리며, 명중하면 피해를 줍니다.
- `health`: 필수입니다. 전투가 깎는 대상입니다. `{ "pool": "grit" }`는 수치를 줄이는 실시간 풀이며, 임시 완충치가 있으면 피해가 그것부터 소모합니다. 또는 `{ "track": "harm" }`처럼 표시를 하는 상처 트랙입니다. 트랙은 `damageKinds`를 함께 지정해야 하며 임시 점수를 주지 않습니다.
- `defense`: 필수 값 참조입니다. 플레이어가 입력하는 필드 또는 작성자가 계산하는 파생 값입니다.
- `initiative`: 필수입니다. 시작할 때 한 번 굴리는 주사위와 선택적 수정치 참조입니다. 동률이면 수정치가 더 높은 쪽, 그다음은 전투를 설정한 순서가 앞섭니다.
- `attackRoll`: 필수입니다. 주사위, 두 번 굴려 하나를 고르는지(`advantage`), 단일 주사위의 최대·최소 눈이 하는 일(`naturals.max`: `critical`, `hit`, `none`; `naturals.min`: `miss`, `none`), 치명타가 피해에 하는 일(`critical`: `double-dice`는 피해 주사위를 다시 굴림, `max-dice`는 최고 눈을 한 번 더함, `none`은 일반 명중)을 정합니다. 특별한 눈에는 판정과 마찬가지로 주사위 하나가 필요합니다. 전투 안의 내성 굴림도 같은 주사위를 굴립니다.
- `economy`: 필수입니다. `budgets`는 한 턴에 가질 수 있는 행동 예산으로 ID, 라벨, `per`(`turn`은 보유자 자신의 턴 시작 시, `round`는 새 라운드 시작 시 보충), `count`를 갖습니다. 처음 선언한 예산이 주 예산이며 표준 행동이 이를 소모합니다. `movement`는 선택적 값 참조로, 자체 거리 단위로 한 턴에 걸을 수 있는 거리입니다. 보드 위 전투에서 읽습니다('위치' 참고).
- `attacks`: 선택 사항입니다. 행이 무기가 되는 시트 목록입니다. `name`은 행 이름을 정하는 텍스트 열, `damage.dice`는 주사위 열이며, `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus`, `damage.type`은 각각 같은 목록의 열을 지정합니다. `ability` 열은 자체 능력치 ID 중 하나를 담는 `enum`이며 그 밖의 값은 아무것도 더하지 않습니다. `proficiency` 열은 `boolean`이며 참일 때 숙련 보너스를 더합니다. 읽을 수 있는 주사위가 없는 행은 공격이 아니므로 같은 목록의 밧줄은 그냥 밧줄입니다. `strikes`는 이 목록의 예산을 한 번 쓸 때 얻는 타격 횟수를 정하는 선택적 값 참조입니다. 보유한 타격이 없을 때 행을 선택하면 예산을 쓰고 남은 타격을 손에 넣습니다. 하나라도 보유하는 동안 `strikes`를 선언한 모든 행은 예산을 전혀 쓰지 않으므로, 다른 무기와 표적을 고르고 사이에 걷는 행동이 메뉴에서 자연스럽게 가능합니다. `strikesCappedBy`는 목록이 몇 번의 타격을 주든 해당 행 자체를 한 번으로 제한하는 불리언 열입니다. 사용자 횟수와 관계없이 턴당 한 번 발사하는 무기를 위한 것으로, SRD 5.1의 Loading 속성을 표현하려고 마련했습니다. 어차피 한 번 지불해 한 번만 타격하는 목록에서는 의미가 없어 거부합니다. 보유한 타격은 한 목록이 아닌 전투원의 것입니다. 두 무기 목록이 모두 `strikes`를 선언한 캐릭터는 어느 행으로 공격하든 같은 보유분을 소모합니다. 얻은 턴이 끝나면 지웁니다. 별도 선언이 없는 목록은 한 번 지불해 한 번 타격하며, 이 기능 이전의 모든 전투와 같습니다.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: 선택 사항입니다. 카탈로그 표시가 있는 행이 능력이 되는 시트 목록으로, `battle.skills`와 똑같이 `onlyWhen`, `alwaysWhen`으로 거릅니다. 각 능력의 효과는 원본 항목의 `mechanics`입니다. 블록은 기본으로 쓰는 `budget`, 명중 굴림을 하는 항목에 더하는 `toHit`, 항목의 내성 굴림 목표인 `saveDifficulty`를 정합니다. 항목 자체의 내성이든 부여한 상태를 끝내는 내성이든, 들어갈 목록에 `saveDifficulty`가 없으면 내성을 요구하는 항목을 거부합니다. 목표가 없는 내성은 항상 성공하기 때문입니다.
- `standard`: 선택 사항이며 고정 목록 `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`에서 고릅니다. `dodge`(회피자에 대한 공격을 두 번 굴려 나쁜 결과 유지)와 `help`(도움받은 아군의 다음 공격을 두 번 굴려 좋은 결과 유지)는 항상 해결합니다. `dash`(같은 이동 허용량을 한 번 더 얻음)와 `disengage`(이번 턴에 걸어서 벗어나도 아무도 공격하지 못함)는 보드에서는 해결하고 보드 밖에서는 기록합니다. `hide`와 `ready`는 허용하지만 아직 아무 효과가 없습니다.
- `standardEffects`: 선택 사항으로 표준 행동의 플래그가 담지 못하는 부분입니다. 현재는 `dodge`에만 있습니다. `{ "dodge": { "saves": ["dex_save"] } }`는 회피가 지속되는 동안 어떤 내성을 두 번 굴려 좋은 결과를 쓸지 정합니다. 시트가 선언한 내성만 지정하고, `standard` 목록에 `dodge`가 있을 때만 사용하세요. 생략하면 회피는 기존과 정확히 같습니다. 맞기 어려워질 뿐 다른 효과는 없습니다.
- `conditions`: 선택 사항입니다. 자체 상태 ID를 효과에 대응시켜 시트와 전투의 상태가 하나의 기록이 되게 합니다. 중독된 캐릭터는 전투 후에도 중독 상태입니다. 효과는 고정 목록입니다. `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-approach-source`입니다. `failsSaves`는 굴리지 않고 실패하는 내성을 지정합니다. 거리나 이동이 필요한 여섯 가지(`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`)는 보드가 있는 전투에서 읽으며 없는 전투에서는 의미가 없습니다('위치' 참고). `cannot-react` 보유자는 걷기로 열리는 응답 창에서 제외되므로 응답을 요청받지 않습니다. 효과 옆에는 키 세 개가 더 있습니다.
  - `saves`: 두 내성 효과가 적용되는 자체 내성입니다. 생략하면 전부 적용되며, 두 효과 중 하나도 없이 지정하면 거부합니다.
  - `whileSourceInSight`: 부여한 상대가 보유자의 시야 안에 있을 때만 적용되는 부분입니다. `true`는 상태 전체를 제한합니다. 그 상태의 자체 효과 목록을 쓰면 해당 효과만 제한하고 나머지는 유지합니다. 상대가 보이든 안 보이든 더 가까이 걷지 못하게 하는 공포에 필요한 방식입니다. 상태가 갖지 않은 효과를 지정하면 거부합니다. 보드가 없으면 시선을 끊을 수 없으므로 어느 방식이든 모든 효과가 적용됩니다.
  - `endsWhenSourceDown`: 부여한 상대가 쓰러지는 순간 해제됩니다.

`own-saves-advantage`와 그 반대는 공격과 마찬가지로 내성을 두 번 굴려 하나를 유지하며 서로 상쇄합니다. `resist-all`은 표적 자체의 내성이 무엇이든 추가로 모든 종류의 피해를 절반으로 줄이고, 취약성과도 같은 방식으로 상쇄합니다. `cannot-target-source`는 상태를 부여한 상대에게 무엇이든 겨누지 못하게 합니다. `cannot-approach-source`는 이동 경로를 포함해 현재 칸보다 그 상대에게 가까이 걷지 못하게 합니다. 같은 거리의 칸으로 돌아가는 길은 여전히 제시하지만, 상대에게 가까워졌다 반대쪽으로 나오는 길은 제시하지 않습니다.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

- `concentration`: 선택 사항입니다. 유지 중인 것을 기록하는 실시간 `text` 필드, 피해가 강제하는 `save`, 난이도의 최솟값인 `floor`, 그보다 클 때 난이도를 정하는 받은 피해의 비율 `fromDamage`를 지정합니다. 집중하는 두 번째 능력을 시작하면 첫 번째가 끝납니다. 내성에 실패해도 끝나며 그 집중이 유지하던 상태도 함께 해제됩니다.
- `dying`: 선택 사항이며 `kind: "saves"`입니다. 굴림을 세는 두 트랙(필요 횟수는 각 트랙 자체의 최대치), `dice`, `succeedAt`, 최대·최소 눈의 효과(`naturals.max`: `revive-1` 또는 `success`; `naturals.min`: `one-failure` 또는 `two-failures`), 쓰러진 동안 피해의 비용(`damageWhileDown`, `criticalWhileDown`), 쓰러진 캐릭터의 `condition`을 정합니다. 이 블록이 없으면 0인 캐릭터는 그냥 쓰러지며 회복하면 돌아옵니다.
- `damageTypes`: 선택 사항입니다. 자체 시스템의 피해 유형으로 대소문자 구분 없이 비교합니다.
- `damageKinds`: `health`가 상처 트랙을 지정하면 필수이고, 풀을 지정하면 거부합니다. 표시만 종류를 담을 수 있고 점수 풀에는 종류를 보관할 자리가 없기 때문입니다(위의 '상처 트랙' 참고). 타격이 트랙의 어떤 `kinds`로 표시되고 몇 칸을 채울지 정합니다. `default`는 유형 자체가 없는 타격을 포함해 대응되지 않은 모든 피해가 되는 종류입니다. `byType`은 자체 `damageTypes`를 종류에 대응시키며, 키는 유형과 마찬가지로 대소문자를 구분하지 않습니다. 따라서 `"Fire"`와 `"fire"`는 같은 키이며 둘 다 지정하면 거부합니다. `marks`는 두 답의 의미가 반대이므로 기본값이 없습니다. `"per-point"`는 피해 굴림이 체력 단계를 세므로 3점 타격은 세 칸을 채우고 1점 완화도 의미가 있습니다. `"per-blow"`는 타격이 맞거나 빗나가는 방식으로, 얼마나 세게 맞든 한 칸을 채웁니다. 피해 절이 여러 개인 타격도 실제로 적용된 가장 심한 종류로 한 칸만 표시합니다. 시스템에 맞는 방식을 명시하세요. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `threat`: 선택 사항이며 생물 도감에는 필요합니다. `tiers`는 상대를 고르는 척도로 ID, 라벨, `health` 범위, `defense`, `toHit`, `damagePerRound` 범위, `saveDifficulty`를 갖습니다. 제공하는 모든 생물은 이 단계 중 하나를 지정합니다. 아무도 작성하지 않은 상대는 Game Master가 요청한 단계로 맞추므로 척도를 벗어나지 않습니다. `damagePerRound` 범위는 전체 연속 행동을 포함해 생물이 한 라운드에 표적 한 명에게 하는 피해로 읽습니다.

### 전투가 `mechanics`에서 읽는 것

`kind`는 `amount`가 피해인지 회복인지 결정합니다. `reaction` 표시는 메뉴에서 제외되며, `utility` 항목도 턴 자체가 가질 수 있는 것을 바꾸지 않으면 제외됩니다(아래 참고). `attackRoll`은 목록의 `toHit`로 표적의 방어에 대한 굴림을 하게 하며 `autoHit`는 이를 완전히 건너뜁니다. `save`는 목록의 `saveDifficulty`에 대해 표적 자체의 내성을 굴리고, `onSuccess`는 성공 시 절반을 받는지 아무것도 받지 않는지 정합니다. `targetCount`는 겨눌 수 있는 표적 수입니다. 공격 굴림이 없는 능력(모두가 내성을 굴리는 범위, 그냥 명중하는 것)은 모두에 대해 주사위를 한 번만 굴립니다. 표적마다 명중 굴림을 하는 능력은 명중마다 피해 주사위를 다시 굴립니다. `applies`는 영향을 받은 대상에게 상태를 부여합니다. 각 상태는 `duration`으로 `instant`(자체 시계 없이 무언가 해제할 때까지 유지), `until-save`(`saveEnds`를 함께 지정해야 함), `{ "rounds": n }` 중 하나를 가지며, 선택적 `saveEnds`로 내성과 이를 `turn-end` 또는 `turn-start` 중 언제 반복하는지 지정합니다. `temporary`는 체력 풀에 임시 점수를 주며 중첩하지 않고 큰 완충치만 남깁니다. `scales`는 읽은 값에 대해 표가 제공하는 추가 주사위만큼 양을 늘립니다. `cost`는 시트 자체의 `use` 명령으로 지불하며, `budget`은 소모하는 행동 체계의 부분을 덮어씁니다.

`plus`는 같은 타격에서 `amount` 옆에 최대 세 개의 수치를 더합니다. 각각 따로 굴리고 유형을 가집니다("and 2d6 fire"). 절은 `{ "dice": "2d6", "flat": 1, "type": "fire" }` 형태이며, 자체 `save`로 `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`를 가질 수도 있습니다. 행동이 이미 무엇을 요구했든 표적이 이 내성을 굴립니다. 성공 시 `none`은 해당 절을 없애고 `half`는 절반만 남기며, 어느 쪽이든 타격의 나머지는 건드리지 않습니다. `difficulty`가 없으면 행동 자체 내성의 수치로, 그다음 목록의 `saveDifficulty`로 돌아갑니다. 치명타는 첫 수치와 같은 규칙으로 모든 절의 주사위를 두 배로 합니다. `type`이 없는 절은 타격 자체의 피해 유형입니다. 타격 전체는 여전히 합산 피해로 집중을 한 번 확인하고, 쓰러짐도 한 번 확인합니다. 절은 붙을 `amount`가 필요하며 `heal`에는 붙지 않습니다.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

세 키가 항목이 턴 자체의 행동 체계에 하는 일을 정합니다. 하나라도 선언한 `utility` 항목은 제외하지 않고 제시합니다.

- `free`: 예산을 전혀 소모하지 않습니다. 지정한 `cost`는 여전히 지불하며, `budget`을 함께 지정할 수 없습니다.
- `gives`: `[{ "budget": "action", "count": 1 }]`, 최대 네 개입니다. 사용하는 순간 해당 예산에 더합니다. 더한 뒤의 상한은 턴의 원래 양에 선물한 양을 더한 값이므로 다음 턴을 위해 모아 둘 수 없습니다.
- `standard`: `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. 보유자는 해당 예산으로 그 표준 행동을 할 수 있습니다. 일반 행동 옆에 `standard:<id>@<budget>`으로 제시됩니다. 허용만 제공하는 항목 자체는 메뉴에 나오지 않습니다. 허용은 누가 실행하는 행동이 아니기 때문입니다.

새로운 `kind: "rider"` 항목은 지속 효과입니다. 아무도 실행하지 않고 메뉴에도 없으며, 각 기간에서 처음 조건을 만족하는 명중에 피해 절 하나를 자동으로 더합니다. `rider`만 가지고 그 밖의 실행할 내용은 갖지 않습니다.

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources`는 적용할 공격 목록을, `requires`는 그 행에서 참으로 평가되는 열 하나를 지정합니다. 특정 무기에서만 발동하는 부가 효과도 Engine이 무기를 이해할 필요 없이 어느 무기인지 말할 수 있습니다. 둘 다 지정하지 않으면 보유자가 명중시킨 모든 타격이 대상입니다. `when`은 하나라도 충족하면 됩니다. `advantage`는 공격 굴림이 최종적으로 어느 쪽으로 유리했는지이며, `ally-adjacent`는 서 있고 행동할 수 있는 공격자의 아군으로, 보드에서는 표적의 한 칸 이내, 보드 밖에서는 어디에 있어도 됩니다. `oncePer`는 `turn`(존재하는 모든 턴이 시작할 때 갱신하므로 다른 사람이 행동할 때 한 타격에도 붙일 수 있음) 또는 `round`입니다. `amount`는 항목 자체의 `scales`에 따라 늘고, `type`은 피해 종류이며 기본값은 타격 자체의 종류입니다.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### 생물: 전투가 읽는 생물 도감

`"holds": "creatures"`를 선언한 카탈로그는 시트 행 대신 상대를 담습니다. 어떤 목록에도 공급하지 않고 시트 편집기의 선택기에도 나오지 않으며, 모든 수치는 `combat` 블록이 이미 선언한 키로 작성합니다. 생물은 자체 단계 중 하나에 분류되므로 `combat` 블록과 `threat` 척도가 필요합니다.

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

아래 수치는 생물을 직접 수치로 작성하는 방식입니다. 규칙 집합 자체 용어로 `sheet`를 작성하면 `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`는 대신 그 시트에서 가져옵니다(아래 '규칙 집합 자체 용어로 작성한 생물' 참고).

- `health`: 숫자 또는 전투 생성 시 한 번 굴리는 `{ "dice": "3d6", "flat": 2 }`입니다. 예측은 평균을 읽으므로 메뉴가 아직 아무도 굴리지 않은 주사위 결과를 약속하지 않습니다.
- `defense`, `initiativeModifier`, `speed`: 각각 공격 굴림의 목표, 우선권에 더하는 값, 자체 거리 단위로 한 턴에 걷는 거리입니다.
- `abilities`와 `saves`: 시트가 선언한 능력치 ID와 내성 ID를 키로 씁니다. 지정하지 않은 내성은 0으로 읽습니다.
- `resist`, `vulnerable`, `immune`: 피해 유형으로, 대소문자 구분 없이 비교하고 `combat.damageTypes`를 선언했다면 그 목록으로 검증합니다. `conditionImmunities`는 자체 상태를 지정합니다.
- `tier`: `combat.threat`의 어느 단계에 속하는지입니다.
- `traits`: Game Master에게 보여 주는 짧은 이름과 설명의 쌍입니다. 자동 해결하지 않으므로 숫자가 들어가는 내용은 행동에 넣어야 합니다.
- `signaturePoints`: 자신의 턴 시작에 돌려받는 점수로, `signature` 행동에 사용합니다.
- `riders`: 최대 네 개입니다. 카탈로그 항목의 `rider`와 같은 것을 블록에 작성합니다. 각 항목은 `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }` 형태이며, 선택적 `type`과 이 블록 자체의 어느 행동에서 발동할지 지정하는 선택적 `actions`를 가질 수 있습니다. 블록의 부가 효과는 시트 목록을 읽지 않으므로 `sources`와 `requires`는 갖지 않습니다. 시트로 작성한 생물은 캐릭터와 똑같이 목록이 지닌 부가 효과를 얻습니다.
- `actions`: 최대 열두 개이며 각자 고유 `id`가 있습니다. 행동은 손으로 쓴 능력치 블록의 내용(`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`)과 생물만 갖는 네 가지를 더 담습니다. `reach`는 타격이 닿는 거리, `range`는 투척 또는 사격 거리, `area`는 적용 형태이며 모두 자체 거리 단위를 씁니다. `range`는 단순 숫자 또는 불이익을 받고 더 멀리 닿는 경우 `{ "normal": 30, "long": 120 }`일 수 있습니다. `area`는 `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }`입니다('위치' 참고).
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. 다 쓰면 행동이 메뉴에서 사라집니다.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. 전투 시작 시 사용 가능하고, 사용하면 소모되며, 생물 자신의 턴 시작에 굴려 `from` 이상이면 다시 돌아옵니다. 어느 결과든 주사위를 로그에 남깁니다.
  - `sequence`: 같은 블록의 다른 행동들을 순서대로 나열하며 각자 표적이 있습니다. **한 행동으로 두 번 공격하는 생물은 이렇게 작성합니다.** 예산 한 번으로 전체 연속 행동을 지불합니다. 연속 행동 자체는 별도 내용을 갖지 않으며 다른 연속 행동을 지정할 수 없습니다.
  - `signature`: `{ "cost": n }`. 예산 대신 생물 자체 점수로 지불하며 다른 사람이 행동할 때만 사용할 수 있습니다. 전투는 한 턴과 다음 턴 사이의 창에서 제시합니다('창' 참고).
- 내성에는 행동 자체의 난이도가 필요합니다. 행동이 강제하는 내성은 `save.difficulty`, 행동 자체 내성이 없는 경우 내성으로 끝나는 상태는 `saveDifficulty`입니다. 시트가 있는 생물도 블록 행동은 직접 수치로 작성하므로 그 수치는 행동에 둡니다. 절 자체의 내성은 `difficulty`를 생략하고 같은 수치로 돌아갈 수 있습니다.
- `damage.plus`는 카탈로그 항목의 `plus`와 같은 절 목록이며 정확히 같은 방식으로 읽습니다. `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }`는 열기를 독립적인 양으로 담은 물기이며, 열기는 따로 저항하고 따로 두 배가 됩니다.

5e 초안 자체의 생물 도감은 `docs/development/ruleset-5e-2014.example.json`에 손으로 작성한 생물 다섯입니다. 연속 행동, 재충전, 상태가 붙은 내성, 저항과 면역, 사용 횟수 제한, 고유 점수, 시트로 작성한 생물 하나를 다룹니다.

#### 규칙 집합 자체 용어로 작성한 생물

생물을 직접 수치로만 작성할 필요는 없습니다. 캐릭터 시트와 정확히 같은 모양의 `sheet`를 대신 주면, 전투는 파티원과 같은 방식으로 생물을 만듭니다. 체력, 방어, 내성, 우선권, 속도, 목록의 모든 공격과 능력은 자체 시트 공식이 정하는 값입니다. 상대가 캐릭터와 같은 능력치, 기술, 목록을 쓰는 규칙 집합은 그것들이 무엇이든 이렇게 표현합니다. Ember Roads의 Toll Warden은 다음과 같습니다.

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **모든 부분은 선택 사항입니다.** `abilities`, `skills`, `saves`, `bonuses`, `fields`, `lists`를 시트가 선언한 ID로 지정합니다. 생략한 것은 빈 캐릭터에서처럼 시트 자체 기본값을 읽습니다. 경비병의 Grit이 9인 것은 `grit_max`가 4, Toughness, Brawn을 더하기 때문이며 Guard가 7인 것도 같은 방식입니다.
- **각 수치의 출처는 하나입니다.** 시트가 있는 생물은 `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`를 따로 제공하지 않습니다. 제공하면 Engine이 파일을 거부합니다. 목록이 하는 일을 정하므로 자체 `actions`가 없어도 됩니다. 시트가 없는 생물은 여전히 처음 세 항목과 행동 하나 이상을 제공합니다.
- **작성자가 만든 데이터로서 검증합니다.** 모든 ID는 시트가 선언한 것이어야 합니다. 기술과 내성은 제공한 숙련 단계 중 하나로 설정하며, 필드, 점수, 보너스, 열은 선언된 값(범위 안의 정수, 선택 값 중 하나 등)을 담고, 목록은 허용 행 수를 넘을 수 없습니다. 생물이 소모한 것은 전투가 보관하므로 `live` 부분은 없습니다.
- **행은 카탈로그에서 가져올 수 있습니다.** `_catalog: "<catalog>/<entry>"`는 캐릭터 시트처럼 행을 고른 항목을 지정하며, 전투가 그 행의 비용과 효과를 읽는 곳도 그 항목입니다. 카탈로그는 해당 목록에 공급하는 것이어야 합니다. 인라인 카탈로그라면 항목이 그 안에 있어야 합니다. 별도 파일이라면 파일에 없는 항목을 지정한 행은 생물에게 아무것도 주지 않을 뿐입니다. 생물 도감의 시트가 지정하는 카탈로그는 도감과 함께 전투용으로 불러옵니다.
- **시트 밖에 쓴 내용도 적용됩니다.** `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune`, `conditionImmunities`입니다.
- **자체 풀에서 지불합니다.** 풀은 가득 찬 상태로 시작하고, 목록이 주는 행동에 소모합니다. Engine과 Game Master 중 누가 결정하든, 파티원과 똑같이 더 크게 지불하는 방법(더 높은 슬롯에서 주문 시전)도 제시됩니다. 경비병의 Hold the Line은 Luck을 소모합니다.
- **상처 트랙을 쓰면 체력은 그 트랙입니다.** 타격은 `resist`, `vulnerable`, `immune`를 먼저 반영한 뒤 `damageKinds`에 따라 생물 자체 트랙에 표시합니다. 따라서 어떤 피해에 면역인 생물은 그 피해로 표시를 받지 않습니다.
- **여전히 상대입니다.** 0이면 죽어 가는 대신 탈락하며 죽음에 대한 굴림은 하지 않습니다. 화면에는 상대가 늘 보여 주던 정보만 표시하고 시트는 보여 주지 않습니다. 같은 이름의 캐릭터가 있어도 소모한 것을 어디에도 되돌려 쓰지 않습니다.
- **계산 결과 체력이 전혀 없는 시트**는 아무도 해칠 수 없는 존재로 전투에 넣지 않고 제외하며 시작 로그에 이유를 씁니다.
- 레이어가 열거형 필드에서 어떤 값을 제외해도 이를 사용하는 생물을 잃지 않습니다. 레이어가 켜져 있는 동안 그 필드는 캐릭터와 똑같이 기본값으로 읽으며, 그 때문에 생물을 거부하지 않습니다.
- Game Master도 생물을 만들 수 있으며, 그 단계에 맞춰 제한합니다('아무도 작성하지 않은 상대' 참고).
- 이를 제공하는 패키지는 Capability API 1.34를 선언합니다.

5e 초안의 Toll Sergeant는 d20 시트에서 같은 것을 구현합니다. Armor Class, 체력, 내성, 행동당 두 번의 공격은 전부 자체 필드와 공격 목록에서 옵니다.

#### 아무도 작성하지 않은 상대

Game Master가 상대를 창작하면 Engine은 무엇이든 굴리기 전에 제안을 `threat` 척도에 맞춥니다. 체력은 단계 범위 안으로, 방어와 명중 보너스와 내성 난이도는 단계 자체 값보다 최대 2 높게 제한합니다. 가장 강한 라운드(가장 강한 연속 행동 또는 단일 행동을 한 표적 기준으로 측정)가 단계의 `damagePerRound` 안에 들어올 때까지 피해를 줄입니다. 주사위 개수, 고정 부분, 연속 행동의 타격 하나, 마지막으로 주사위 면 수 순서로 줄이며 어떤 것도 0까지 줄이지 않습니다. 규칙 집합에 없는 이름은 버립니다. 알 수 없는 피해 유형, 상태, 내성과 처음 여섯 개를 넘은 행동이 대상입니다. 선언하지 않은 단계는 척도 최하단으로 돌아갑니다. 모든 변경은 평이한 문장으로 반환하므로 로그가 한 일을 설명할 수 있습니다.

창작한 상대도 도감 생물과 똑같이 `sheet`로 작성할 수 있습니다. 창작한 마법사가 슬롯과 주문을 얻는 방법입니다. Game Master에게 시트 ID와 각각 담을 수 있는 값, 전투가 읽는 목록, 카탈로그가 그 목록에 제공하는 이름을 보여 주므로 주문은 설명하지 않고 이름으로 지정합니다. 대소문자와 관계없이 카탈로그 항목을 지목한 행은 그 항목이 되고, Game Master가 지정한 값(주문의 준비 상태 등)을 위에 덧씁니다. 모델이 썼으므로 시트를 관대하게 읽습니다. 규칙 집합에 없는 이름은 버리고, 값은 필드나 열에 맞추며, 시트 옆에 따로 쓴 수치는 쓰지 않습니다.

보스가 아닌 창작 생물은 규칙 집합이 열어 준 것만 사용할 수 있습니다. `startFrom`이 있는 카탈로그 필터는 항목을 분류하는 시트 필드(5e 패키지의 주문 목록에서는 `class`)를 지정합니다. 창작 생물은 그 필드의 자체 값과 필터가 일치하는 항목만 보유하며, 선택기가 해당 값으로 열릴 때와 같은 방식으로 비교합니다. 따라서 Sorcerer가 전체 주문 목록을 갖는 일은 없고, 클래스를 지정하지 않으면 클래스별 카탈로그에서 아무것도 얻지 못합니다. 아직 선택하지 않은 것은 Game Master에게 다시 묻지 않고 채웁니다. 선택해야만 행이 유효한 각 목록(전투 능력 원본의 `onlyWhen`)에서, 열려 있고 자체 풀로 지불할 수 있는 항목 중 각 보유 풀에 해당하는 항목을 소수까지 보충하고 자유롭게 사용할 항목도 채웁니다. 유능한 생물일수록 더 많이 얻습니다. 무엇을 얻는지는 전투에서도 쓰는 기질과 역량에 기웁니다. 보호적이거나 지원적인 생물은 아군을 버티게 하는 것, 무모한 생물은 피해, 체계적이거나 인내심 있는 생물은 적을 억제하는 것을 고릅니다. 유능할수록 반응, 대응 수단, 턴을 바꾸는 다른 효과를 지닐 가능성이 높습니다. 추첨은 전투 자체 시드를 쓰므로 같은 전투는 항상 같은 방식으로 채워집니다. Game Master가 이런 목록에서 이름으로 지정한 행은 선택된 것으로 간주합니다.

보스는 예외일 수 있으므로 Game Master가 전부 작성합니다. 아무것도 빼지 않고 아무것도 채우지 않습니다.

그다음 둘 다 단계에 맞춰 제한합니다.

- 체력을 읽는 단 하나의 필드를 통해 단계 범위에 맞춥니다. 풀의 최대치가 그 필드이거나 정확히 필드 하나가 든 `sum`입니다(5e의 최대 체력, Ember Roads의 Toughness). 단일 필드가 없는 체력 공식은 작성된 그대로 두고 로그에 알립니다. 상처 트랙의 길이는 작성자의 것이므로 바꾸지 않습니다.
- 생물을 만든 뒤 방어, 명중, 내성 난이도를 단계 자체보다 2 높게 제한하며, 지불 가능한 가장 큰 비용까지 계산한 최강 라운드가 단계의 `damagePerRound`에 들어올 때까지 피해를 줄입니다. 큰 지불로 얻는 추가 효과부터, 그다음 주사위, 고정 부분, 타격 하나, 마지막으로 주사위 면 수를 줄입니다.

직접 작성한 생물 도감은 제한하지 않습니다. 작성자의 데이터이므로 Engine이 그대로 받아들입니다.

### 위치: 보드 위 전투

블록이 보드 한 칸의 거리를 정하기 전까지 전투는 머릿속 장면으로 진행됩니다. `distance`를 선언하면 격자에서 싸울 수 있으며, 이동, 근접 거리, 사거리, 범위, 시선, 엄폐, 걸어 나가는 상대를 치는 행동이 의미를 갖기 시작합니다. 모두 작성자가 쓴 숫자이며 Engine은 보드만 제공합니다.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2 },
"opportunity": { "budget": "reaction" }
```

Ember Roads는 그중 한 줄만 선언합니다. 나머지는 필수가 아니라는 점을 보여 줍니다.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**칸.** `distance.perCell`은 한 칸이 자체 단위로 얼마인지이며, `label`은 그 단위의 이름입니다. 블록 세계의 모든 거리, 즉 `economy.movement`, 생물의 `speed`, 무기의 `reach`와 `range`, 생물 행동의 `reach`와 `range`가 이 단위를 씁니다. 자체 `units.distance`를 선언한 카탈로그는 자체 `perCell`로 `mechanics.range`와 `area.size`를 변환하며, 선언하지 않은 카탈로그는 이 설정을 씁니다. 0보다 큰 거리는 가장 가까운 칸으로 반올림하되 0으로 만들지 않으므로 숫자를 준 것은 최소 한 칸에 닿습니다. 0은 짧은 거리가 아니라 자체 의미를 유지합니다. `mechanics.range`의 0은 자신 또는 접촉이며, 다른 이에게 접촉하면 옆 칸에 닿습니다. 무기 행의 `reach` 또는 `range` 열이 0이면 해당 종류의 거리가 없는 행입니다.

**보드 위 전투 여부.** 두 조건을 모두 만족해야 합니다. 블록이 `distance`를 선언하고 플레이어의 게임이 Tactical 전투 스타일로 설정되어 있어야 합니다. Classic 스타일이거나 규칙 집합에 `distance`가 없으면 전투는 예전처럼 머릿속 장면으로 진행됩니다. 누구든 누구에게든 겨눌 수 있으며 아래 내용은 전혀 읽지 않습니다.

**플레이어가 보는 것.** Tactical 스타일 자체 지형으로 보드를 그립니다. 각 칸은 포인터나 방향키로 접근하는 버튼이며, 어떤 곳인지, 누가 있는지, 진행 중인 선택에서 어떤 의미인지 설명합니다. 걷기는 메뉴가 제시한 칸을 밝히고, 각 칸에 자체 단위로 비용을 표시하며 경로를 그립니다. 누군가 그 경로를 공격할 칸은 호박색으로 표시하고 보드 아래에 상대 이름을 적습니다. 표적이 필요한 선택지는 보드와 목록에서 동시에 선택 가능한 상대를 밝힙니다. `area`가 있는 선택지는 칸을 겨누며, 포인터 아래 칸은 아군을 포함해 누구를 휘말리게 할지 보여 줍니다. 남은 이동량도 자체 단위로 예산 옆에 표시합니다. 화면이 측정하는 것은 없습니다. 모든 칸, 비용, 경로, 표적, 조준 위치는 서버에서 보냅니다.

**이동.** 한 턴의 허용량은 파티원이면 `economy.movement`, 생물이면 자체 `speed`를 `perCell`로 나눈 뒤 내림한 값입니다. 움직일 수 있는 한 최소 한 칸입니다. 보유자 자신의 턴 시작에 보충되며 행동 전, 사이, 후에 쓸 수 있습니다. 걷고, 치고, 다시 걸을 수 있습니다. 한 칸에 들어가는 비용은 1이고 험한 땅에서는 더 듭니다. 이 기능이 대상으로 하는 테이블탑 격자 방식에 맞춰 여덟 방향의 비용은 모두 같습니다. 아군은 지나갈 수 있지만 누구의 칸에도 멈출 수 없습니다. 상대는 벽이며, 단단한 장애물 칸에는 들어갈 수 없고 두 장애물 칸 사이의 모서리를 가로지를 수도 없습니다.

**근접 거리와 사거리.** 무기 행은 `combat.attacks[].reach`와 `.range`에서 가져옵니다. 각각 같은 목록의 열이거나 모든 행에 적용하는 같은 수치입니다.

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

행에서 열이 0이면 해당 종류의 거리가 없다는 뜻입니다. 일반 검이 투척 도끼와 같은 목록에 있을 수 있는 방식입니다. 근접 거리가 전혀 없는 행은 한 칸에 닿습니다. 생물 행동은 자체 `reach`나 `range`를 쓰고, 카탈로그 능력은 `mechanics.range`를 씁니다(0은 자신 또는 접촉이며, 다른 이에게 겨누면 한 칸입니다).

둘 다 있는 행은 투척 무기입니다. 근접 거리 안에서는 휘두르기, 바깥에서는 사격입니다. 따라서 아래 사격 규칙은 손에 들고 휘두를 때 적용되지 않으며, 활과 달리 지나가는 상대를 때리는 데도 쓸 수 있습니다.

생물 행동에는 자체 단위로 적용되는 `area`도 넣을 수 있습니다. `{ "shape": "cone",
"size": 15 }`처럼 쓰고, `"friendlyFire": false`로 아군을 제외합니다. 이로써 브레스가 표적 수가 아닌 보드의 실제 원뿔이 됩니다. 연속 행동 자체에는 형태가 없고 그 안에서 지정한 행동이 각자의 형태를 가집니다. 보드가 없는 전투는 형태를 무시하고 `targetCount`를 쓰므로, 생물 항목이 둘 다 갖고 어느 쪽에서도 정확하게 표현할 수 있습니다.

**형태를 얼마나 멀리 보낼 수 있는가.** `range`가 정합니다. 100피트 던지는 구체라면 사거리가 있습니다. 사거리가 없으면 폭발은 놓은 곳, 즉 행동자 자신의 칸에서 터집니다. 원뿔이나 직선은 그려지는 길이 안의 어디든 겨눌 수 있습니다. 그 경우 칸은 방향만 나타내기 때문입니다. 이는 생물뿐 아니라 카탈로그 항목의 `mechanics.area`에도 적용됩니다.

`ranged`는 보통의 `normal` 거리보다 멀리 쏘거나 옆 칸에 적이 있을 때 사격의 불이익을 정합니다. 각각 `"disadvantage"` 또는 `"normal"`이며, 블록을 생략하면 둘 다 불이익이 없습니다. 휘두르기는 사격이 아니므로 두 규칙 모두 적용되지 않으며, 자체 근접 거리 안에서 쓰는 투척 무기도 같습니다.

**범위.** 항목의 `mechanics.area`는 보드의 실제 형태가 되어 누군가가 아닌 칸을 겨눕니다. `targetCount`는 관계없고, 형태가 닿는 수를 정합니다. 항목이 `"friendlyFire": false`를 지정하지 않으면 그 칸에 선 아군과 적 모두가 영향을 받습니다.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

폭발은 겨눈 칸에서 크기 이내인 모든 칸입니다. 원뿔은 행동자에서 그 칸 방향으로 뻗으며 각 단계의 폭은 그 거리와 같습니다. 직선도 같은 방향으로 뻗고 너비는 한 칸입니다. 셋 모두 단단한 장애물에서 멈춥니다.

**시선과 엄폐.** 둘 사이를 잇는 직선상의 칸을 봅니다. 그 위의 단단한 장애물이 사격을 막고 범위가 그 너머로 퍼지는 것도 멈추며, 해당 표적은 메뉴에 나오지 않습니다. 엄폐 가치가 있는 지형은 공격 굴림이 대항하는 방어에 `cover.bonus`를 더하고 로그에도 알립니다. 4분의 3 엄폐, 완전 엄폐, 고도는 없습니다.

**걸어 나가는 상대에 대한 타격.** `opportunity.budget`을 선언하면, 전투원이 서 있고 행동할 수 있으며 그 예산과 근접 공격 수단을 가진 적의 근접 거리를 벗어날 때, 걷기가 현재 위치에서 멈추고 그 적에게 공격할지 묻습니다. 공격하면 예산을 쓰고 자신의 턴에 같은 공격을 할 때와 똑같이 해결합니다. 보내 주면 비용이 없습니다. 어느 쪽이든 걷기는 멈춘 곳에서 재개하며 실제로 지난 칸마다 비용을 지불합니다. 타격으로 이동자가 쓰러지면 그 자리에서 걷기가 끝납니다. 같은 근접 거리를 경로가 몇 번 벗어나든 전체 걷기마다 각 적에게 기회는 한 번입니다. `disengage`는 남은 턴 동안 이를 막으며, `opportunity`를 선언하지 않은 규칙 집합에는 이 모든 것이 없습니다.

이 질문은 창이며 전투 전체를 붙잡습니다. 질문받은 모두가 답할 때까지 다른 것은 움직이지 않습니다. 파티원의 창은 플레이어가 답하고, 타격 옆에 Pass가 있습니다. 나머지는 해당 인물을 조종하는 쪽이 답하며, Game Master가 맡은 보스는 Game Master 자체 판단으로 답합니다. 아래 '창'을 참고하세요.

**상대가 보드를 쓰는 방식.** 아무도 조종하지 않는 상대는 도달 가능한 모든 칸에서 쓸 수 있는 모든 선택지를 평가하고, 걷는 중 맞을 타격마다 점수를 뺍니다. 현재 위치에서 이미 최선을 다할 수 있으면 움직이지 않는 쪽을 선호합니다. 닿는 것이 없으면 거리를 좁히며, `standard` 목록에 `dash`가 있으면 먼저 질주합니다.

**표시될 수 있는 거부 이유.** `out-of-reach`(닿는 거리보다 멂), `no-line-of-sight`(사이에 단단한 장애물이 있음), `unreachable`(걷기 비용을 감당할 수 없거나 멈출 수 없는 칸), `bad-cell`(형태를 겨눌 수 없는 곳에 조준함)입니다.

### 서버에서 전투가 블록을 사용하는 방식

규칙 집합이 `combat`를 선언한 게임은 Engine이 늘 쓰던 같은 저장 전투에서 해당 블록으로 전투를 해결합니다.

- **참가자.** Game Master가 누가 싸우는지 정하고, Engine은 각 파티원의 자체 시트에서 수치를 읽습니다. 해당 규칙 집합의 시트가 없는 파티원은 작성하지 않은 수치를 주는 대신 이름을 명시해 거부합니다.
- **상대 수치의 출처**는 다음 순서입니다. Game Master가 생물 도감에서 지목한 생물, 상대 자체 이름과 라벨이 일치하는 생물, Game Master가 이 전투용으로 제안하고 제한 처리를 통해 위협 척도에 맞춘 능력치 블록, 마지막으로 단계 자체 수치로 만든 단순한 생물입니다. 모든 대체 선택과 제한은 평이한 말로 기록하므로 전투가 한 일을 설명할 수 있습니다. 도감 항목도 제안도 위협 척도도 없는 규칙 집합은 상대를 지어내지 않고 전투를 거부합니다.
- **시트가 기록입니다.** 허용된 행동마다 체력, 풀, 상태, 집중, 빈사 규칙의 횟수를 시트 자체 규칙으로 기록합니다. 따라서 전투 중 다시 불러와도 전투가 남긴 상태를 정확히 보여 주며, 서로 어긋날 수 있는 전투 종료 집계는 없습니다.
- **메뉴만이 합법성을 정합니다.** 플레이어든 상대든 행동하는 모두가 블록이 만든 같은 메뉴에서 ID를 고릅니다. Engine이 조종하는 상대는 Engine 자체 전술로 선택하며, Game Master가 조종하는 상대에게는 같은 메뉴에서 ID 하나를 고르라고 요청합니다. 자체 수치는 보여 주되 주사위 결과는 알려 주지 않습니다.
- **자체 주사위.** 전투는 자체 시드와 커서를 갖고 있으므로 디스크에서 다시 읽어도 원래 굴렸을 주사위로 계속합니다.

### 화면 표시

전투 화면은 작성자의 용어로 진행합니다. 메뉴는 자체 공격과 능력, 나열한 표준 행동이며 각 항목이 자체 예산과 풀에서 무엇을 쓰는지 알려 줍니다. 턴 순서, 라운드, 이름을 정한 모든 상태와 남은 라운드, 임시 점수, 집중, 빈사 규칙의 두 횟수를 모두 보여 줍니다. 로그는 자체 용어로 실제 계산을 출력합니다. "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." 허용된 모든 행동은 발생 즉시 시트에 쓰므로 전투 중 다시 불러와도 정확하며, Game Master에게는 나중에 이 수치를 다시 바꾸지 말라고 알립니다.

위치가 있는 전투는 초상화 무대 대신 보드에 그립니다. 플레이어의 사용 방법은 '위치'를 참고하세요. 보드, 메뉴, 로그의 모든 거리는 자체 단위로 표시합니다. "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### 창: 전투를 보류하기

어떤 순간은 현재 행동자가 아닌 다른 사람의 차례입니다. Engine은 대신 결정하지 않고 그 사람을 위해 전투를 보류합니다. 이 멈춤이 창입니다.

창을 여는 상황은 네 가지이며, 둘은 이미 선언한 내용에서 나옵니다.

- **누군가 벗어납니다.** 공격할 수 있는 적의 근접 거리를 떠나는 걷기는 그 한 걸음에서 멈추고 적에게 묻습니다. 위의 '걸어 나가는 상대에 대한 타격'을 참고하세요.
- **한 턴과 다음 턴 사이.** 턴이 끝나면 다음 턴이 시작하기 전에 `signaturePoints`를 갖고 자체 `signature` 행동 하나를 감당할 수 있는 모든 상대에게 구매할지 묻습니다. 살 수 있는 순간은 이때뿐입니다. 고유 행동은 자신을 포함해 누구의 턴 메뉴에도 없습니다.
- **무언가 누군가를 겨눕니다.** 해결 전에, 표적이 된 반대편 중 그 순간을 기다리는 항목을 보유한 모두에게 묻습니다. 아군이 회복시켜 주는 것은 대응할 위협이 아니므로 아군 행동은 창을 열지 않습니다.
- **무언가 누군가를 다치게 했습니다.** 해결 후, 누가 했든 피해받은 사람 중 그 순간을 기다리는 항목을 가진 모두에게 묻습니다. 다쳤다는 것은 자신에게 일어난 사실입니다. 그래도 가해자에게 되돌려 겨누는 항목을 아군에게 겨눌 수는 없습니다.

마지막 두 가지는 카탈로그 항목이 기다리는 순간을 지정해 요청하는 것입니다.

어떤 계기로 열렸든 창은 다음과 같이 동작합니다.

- **열려 있는 동안 다른 것은 움직이지 않습니다.** 현재 턴의 행동자도, 턴 종료도, 다른 창도 진행하지 않습니다. 전투는 기다립니다.
- **턴 순서로 한 명씩 묻고, 각자 한 번만 묻습니다.** 넘기기는 언제나 유효한 답이며 비용이 없습니다. 질문 대상에게 할 수 있는 것이 없으면 묻는 대신 건너뜁니다.
- **멈춘 곳에서 정확히 재개합니다.** 걷기는 남은 칸을 마저 이동하며 실제로 지난 모든 칸의 비용을 지불합니다.
- **조종하는 사람이 답합니다.** 자신의 파티원 창은 직접 답하며 메뉴에 선택지와 Pass가 나란히 있습니다. 상대는 조종자가 답하고, Game Master가 맡은 보스는 Game Master를 통해 질문받으며 기회를 흘려보내는 것도 답으로 제공됩니다.
- **전투와 함께 저장합니다.** 걷는 중 닫힌 게임은 같은 사람에게 질문이 남고 같은 칸을 더 걸어야 하는 상태로 돌아옵니다.

처음 두 가지에는 추가 선언이 필요 없습니다. `opportunity.budget`이 있는 규칙 집합은 하나를, `signaturePoints`가 있는 생물 도감은 다른 하나를 얻습니다. 둘 다 없는 규칙 집합은 보지 못합니다.

**항목이 기다릴 순간 지정하기.** `mechanics.reaction`을 `true` 대신 객체로 작성하세요.

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on`은 `aimed` 또는 `harmed`이며, 항목을 그 창의 메뉴에 올립니다. Engine이 지켜보는 순간은 이 둘뿐입니다. 여전히 `"reaction": true`만 쓰는 항목은 턴에 실행하지 않는다는 뜻만 전합니다. 어디에 제공할지 알기에는 부족하므로 어느 메뉴에도 나오지 않습니다.
- `at`은 `source`(기본값) 또는 `chosen`입니다. `source`는 그 순간을 일으킨 이에게 실행 내용을 겨누고 표적을 채워 넣으므로 누구에게도 선택을 묻지 않습니다. `chosen`은 항목 자체의 표적 설정을 유지하고 묻습니다.
- `cancels`는 창이 보류하던 일이 아예 일어나지 않게 합니다. 이미 일어난 순간은 취소할 수 없으므로 `aimed` 항목만 지정할 수 있습니다.

`budget`도 지정하세요. 없으면 목록의 기본값을 씁니다. 반응은 거의 항상 자체 예산을 소모하며, 이것이 한 턴에 여러 번 사용하는 것을 막습니다.

**비용은 누구에게든 묻기 전에 이미 지불합니다.** 취소된 행동은 발생만 중단되며 구매했던 사실까지 없어지지는 않습니다. 예산과 풀은 이미 소모되었습니다. 시스템이 이를 환급하더라도 아직 표현할 수 없습니다.

순간을 지정하는 패키지는 Capability API 1.33이 필요합니다.

### 아직 지원하지 않는 것

규칙 집합이 Engine이 하지 못하는 일을 주장하지 않도록 명확히 적습니다.

- **단순한 보드를 넘어서는 것:** 4분의 3 엄폐, 완전 엄폐, 고도, 장애물 위 비행, 좁은 틈 통과, 탈것, 붙잡기나 밀치기로 인한 이동, 숨기, 기습이 없으며 누구를 어디로 밀어내는 효과도 없습니다.
- **항목이 기다릴 수 있는 순간은 `aimed`와 `harmed` 두 가지뿐입니다**(위 '창' 참고). Engine이 항목을 위해 감지하는 순간입니다. 다른 두 창, 즉 누군가 벗어나는 순간과 두 턴 사이의 멈춤은 전투 자체가 열며 항목이 요청할 순간이 아닙니다. 내성을 굴릴 때, 주문 시전 자체, 죽음, 턴 시작, 무언가 떨어지는 상황을 위한 순간은 없습니다.
- **연쇄하지 않습니다.** 전투는 창을 스택이 아닌 하나만 유지하므로 창 안에서 생긴 것은 다른 창을 열지 않습니다. 대응 자체에 다시 대응할 수 없고, 반응이 가하는 효과도 추가 순간을 열지 않습니다.
- **반응은 무언가를 멈추거나 실행하며, 그 수치를 바꿀 수는 없습니다.** 상태는 수정치가 아닌 고정 목록의 이름이므로 '다음 자신의 턴까지 맞기 어려워짐'을 표현할 방법이 없습니다. 이는 반응이 아닌 상태의 한계입니다.
- **아무것도 환급하지 않습니다.** 취소된 행동의 비용은 소모된 상태입니다.
- 상태는 고정 효과 목록이 표현할 수 있는 것만 합니다. 능력치 판정에 불리점을 주는 상태나 탈진처럼 단계별로 악화되는 상태는 현재 시트의 단순 기록입니다.
- **직접 수치로 쓴 생물은 상처 트랙이 없습니다.** 체력이 트랙인 규칙 집합에서도 그런 생물은 점수를 잃습니다. `sheet`를 주면 받는 타격이 자체 `resist`, `vulnerable`, `immune`로 먼저 완화된 뒤 칸에 표시됩니다.
- **부가 효과는 자동 발동합니다.** `on`의 값은 `hit` 하나이므로 기간의 첫 조건 충족 명중이 효과를 사용합니다. 소모할지 질문받는 순간은 없습니다.

## 레이어: 자체 규칙 집합의 변형

레이어는 Low magic, Hard winter, 더 가혹한 난이도처럼 플레이어가 게임을 만들 때 켜는 규칙 집합의 이름 붙은 변형입니다. 규칙 집합 파일의 선택적 `layers` 배열 안에 있으므로 함께 이동하며, 사용한 게임에서 사라질 수 없습니다. 마법사는 규칙 집합 아래 토글로 보여 주며, 선택은 규칙 집합 자체와 똑같이 그 게임의 수명 동안 고정됩니다.

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**레이어가 할 수 있는 것.** 목록은 고정되어 있으며 모든 효과는 무언가를 좁히거나 텍스트를 더합니다.

- `gm.guidance`는 작성자 자체 텍스트와 앞선 레이어 뒤에 `gm.checkGuidance`로 덧붙입니다. `gm.worldGuidance`도 같은 방식으로 `gm.worldGuidance`에 덧붙입니다.
- `fields`는 **enum** 필드에서 값을 제외합니다. `removeValues`는 필드가 이미 가진 값을 지정하며 최소 하나는 남아야 합니다. 필드의 `default`도 제외 대상이면 레이어가 살아남는 `default`를 대신 지정합니다.
- `difficultyLadder`는 자체 해결 유형과 같은 형태의 다른 사다리로 바꿉니다. `dice-sum`은 `{label, dc}`, `dice-pool`은 `{label, successes, target?}`입니다. 원래 사다리와 정확히 같은 검증을 받습니다. 여러 활성 레이어가 선언하면 마지막 것이 우선합니다.
- `catalogs`는 시트 편집기의 선택기에서 항목을 숨깁니다. 각 규칙은 해당 카탈로그가 선언한 `filters` 하나와 비교 하나를 지정합니다. `number` 필터는 `above` 또는 `below`, `text`나 `tags` 필터는 `equals` 또는 `notIn`입니다. 그 필터를 아예 설정하지 않은 항목은 숨기지 않습니다.

**레이어가 할 수 없는 것.** 열거형 값, 필드, 기술, 풀, 휴식을 추가하거나, 해결 유형을 바꾸거나, 실시간 상태나 전투 수치를 건드리거나, 모델 호출을 추가할 수 없습니다. 레이어가 _추가한_ 값은 시트를 읽는 다른 모든 쪽에 알 수 없는 값이 되므로 값은 제외만 합니다. 이 목록을 넘는 것은 규칙 집합 자체의 변경이거나 두 번째 규칙 집합입니다.

**충돌.** `conflicts`는 함께 켤 수 없는 레이어를 지정합니다. 쌍의 한쪽에만 지정하면 충분합니다. 마법사는 상대 토글을 비활성화합니다. 저장된 선택에 어떻게든 둘 다 있으면 **나중에** 선언된 쪽을 버리므로, 같은 두 선택은 항상 같은 규칙을 만듭니다.

**제외된 값을 이미 가진 시트는 그대로 보존합니다.** 캐릭터를 다시 쓰는 일은 없습니다. 편집기가 값을 더는 제공하지 않을 뿐, 이미 가진 캐릭터는 원래 값을 표시합니다. 새 게임에서 레이어를 끄면 다시 제공됩니다. 숨겨진 카탈로그 항목도 같습니다. 선택기에서만 제외되며, 플레이어가 이미 고른 행은 시트에 남습니다.

**제한.** 규칙 집합당 레이어 12개이며, 레이어마다 두 문자열을 합해 지침 4000자까지입니다. `layers` 또는 기본 `gm.worldGuidance`를 선언한 패키지 규칙 집합은 Capability API 1.25가 필요합니다. 가져온 규칙 집합은 읽는 Engine이 검증하므로 이 선언이 필요 없습니다.

**다른 사람이 작성한 레이어**(직접 쓰지 않은 규칙 집합의 Low Magic 레이어를 별도 파일로 배포하는 것)는 나중에 추가할 기능입니다. 현재 레이어는 자신이 속한 규칙 집합 안에 포함되어 배포됩니다.

<a id="trying-your-ruleset"></a>

## 규칙 집합 시험하기

커뮤니티 규칙 집합은 가져온 에이전트와 같은 스위치를 씁니다. **Settings**(설정) > **Advanced**(고급) > **Danger Zone**(위험 구역)을 열고 **Allow custom Agent imports**(사용자 지정 에이전트 가져오기 허용)가 켜졌는지 확인하세요. 가져오기에는 localhost 접근 또는 설정된 **Admin Access**(관리자 접근)도 필요합니다.

1. **Agents**(에이전트) 패널을 열고 **Import agents**(에이전트 가져오기) 버튼(패널 위쪽 버튼 줄의 다운로드 아이콘)을 고르세요.
2. **Game Mode ruleset**(Game Mode 규칙 집합)을 선택하고 JSON 파일을 고르세요.
3. 검토 내용을 읽으세요. 이름, 버전, 라이선스, 지원 범위, Game Master 텍스트가 표시됩니다. **Import**(가져오기)를 선택하세요.

규칙 집합은 패널의 **Rules**(규칙) 구역과 새 게임 설정 마법사의 **Rules** 선택지에 나타납니다. 파일에서 가져온 규칙 집합은 `local/<your id>`로 분류하므로 공식 규칙 집합이나 다른 사람의 것과 혼동할 수 없습니다.

### 이미 가져온 규칙 집합 변경하기

가져온 버전은 다시 쓰지 않습니다. 파일을 바꾸고 같은 `version`으로 다시 가져오면 거부하고 번호를 올리라고 요청합니다. 의도된 동작입니다. 게임은 생성 당시의 정확한 버전에 묶이므로 진행 중인 캠페인이 갑자기 다른 계산 방식으로 바뀌지 않습니다.

따라서 초안 작성 중에는 편집, `version` 올리기, 가져오기, 새 게임 시작을 반복합니다. **Rules** 구역에서 규칙 집합을 제거하기 전까지 이전 버전은 새 버전 옆에 계속 설치되어 있습니다. 게임이 아직 사용하는 규칙 집합을 제거하면 다시 가져올 때까지 해당 게임에 규칙 집합이 없다고 표시됩니다.

시트의 모양을 바꿨다면(항목 추가, 제거, 이름 변경) `sheet.version`도 올리세요. 기존 시트는 관대하게 읽습니다. 새 시트가 모르는 값은 보존하고, 없는 값은 기본값을 사용합니다.

## 규칙 집합 공유하기

**파일로.** JSON 파일을 친구에게 보내세요. 같은 방식으로 가져오면 됩니다.

**GitHub 저장소에서.** 공개 GitHub 저장소에서 작업을 보관한다면, 저장소 최상위의 `rulesets` 폴더에 규칙 집합마다 파일 하나씩 넣으세요.

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

사용자는 사용자 지정 에이전트 저장소 목록에서 저장소를 한 번 추가하고 내용을 검토한 뒤, 나중에 동기화하여 새 버전을 받을 수 있습니다. 사용자 지정 저장소 목록은 고급 기능이며 서버 운영자가 `ENABLE_CUSTOM_AGENT_REPOS=true`로 켜야 합니다. 저장소의 규칙 집합은 `alice/ember-roads`처럼 저장소 소유자 이름 아래 분류되므로 두 작성자가 모두 `v20`이라는 규칙 집합을 내도 충돌하지 않습니다.

제한은 두 가지입니다. 저장소의 `rulesets` 바로 아래 JSON 파일은 최대 32개이며, 더 많으면 저장소를 거부합니다. `local/`은 파일에서 가져온 규칙 집합용으로 예약되어 있으므로 `local`이라는 계정은 규칙 집합을 배포할 수 없습니다.

**공식 카탈로그로.** 널리 플레이하며 라이선스가 명확한 시스템은 **Download Agents**(에이전트 다운로드)를 통해 모두에게 제공할 수 있습니다. [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 저장소에 풀 리퀘스트를 보내면 됩니다. 배치는 그곳의 `ruleset-5e-2014` 패키지를 참고하세요.

## 라이선스

공유할 권리가 있는 규칙 텍스트만 배포하세요. 많은 시스템이 공개 라이선스로 참조 문서를 배포하며, 복사할 수 있는 것은 그 문서입니다. 라이선스 ID와 해당 라이선스가 요구하는 저작자 표시 텍스트를 `license` 아래에 넣으세요. 공개 라이선스가 아닌 규칙서의 텍스트를 복사하지 마세요. 규칙 집합에는 주로 이름과 숫자가 필요하며, Game Master 텍스트는 직접 쓴 말이어야 합니다.

## 문제 해결

- **가져올 때 이름이 없다고 합니다.** 파일 안의 무언가가 선언하지 않은 ID를 가리킵니다. 삭제한 능력치를 기술이 지정하는 경우 등이 해당합니다. 메시지가 해당 위치의 경로를 알려 줍니다.
- **다른 내용의 같은 버전이 이미 설치되어 있다고 합니다.** `version`을 올리고 다시 가져오세요.
- **설정 마법사에 규칙 집합이 없습니다.** **Allow custom Agent imports**가 켜졌는지 확인하세요. 꺼져 있으면 가져온 규칙 집합은 새 게임에서 제외됩니다. 이미 사용하는 게임은 계속 작동합니다.
- **게임에 규칙 집합이 없다고 합니다.** 게임 생성 당시의 정확한 버전이 설치되지 않았습니다. 그 버전의 파일을 다시 가져오세요.
