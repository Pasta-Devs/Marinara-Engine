# Game Mode 규칙 집합 작성하기

규칙 집합은 탁상 게임 시스템의 작동 방식을 Game Mode에 알려 줍니다. 판정에 쓰는 주사위, 캐릭터 시트의 항목, 소비할 자원과 휴식이 회복하는 것을 정합니다. 이 가이드는 직접 규칙 집합을 만들어 공유하려는 분을 위한 것입니다. 다른 사람이 만든 규칙 집합으로 플레이하려면 [규칙 선택](../game/getting-started.md#choosing-rules)부터 읽으세요.

규칙 집합은 JSON 파일 하나이며 코드가 아닌 데이터입니다. 그 안의 내용은 실행되지 않으므로 가져와도 컴퓨터에서 무엇을 실행하지는 않습니다. 다른 사람의 파일을 가져오기 전에 주의 깊게 읽을 부분은 Game Master 텍스트입니다. 그 규칙 집합을 쓰는 모든 게임에서 모델로 보내기 때문입니다.

## 먼저 읽기: 규칙 집합이 할 수 있는 것과 없는 것

규칙 집합은 Engine이 이미 아는 메커니즘의 빈칸만 채울 수 있습니다. 현재 Engine에는 판정을 해결하는 다섯 방식이 있으며 파일의 `resolution.kind`로 고릅니다.

- **`dice-sum`**: 주사위를 굴려 시트 숫자를 더하고 난이도 이상을 얻습니다. d20 시스템, 2d6에 능력치를 더하는 시스템 등 여러 방식이 해당합니다.
- **`dice-pool`**: 캐릭터 수치만큼 주사위를 던져 목표에 도달한 개수를 셉니다. 평점이 보너스가 아니라 주사위 개수인 시스템을 다룹니다.

- **`dice-highest`**: 풀을 던져 가장 높은 주사위를 읽거나, 높은 주사위 몇 개를 더합니다. Blades in the Dark와 Trophy Dark가 해당합니다.
- **`roll-against`**: 시트 숫자 이하(또는 이상)로 굴립니다. 백분율 기술과 GURPS 판정이 해당합니다.
- **`symbol-pool`**: 서술형 주사위를 구성하고 승급한 뒤 반대 기호를 상쇄합니다. Genesys 판정이 해당합니다.

다섯 가지 모두 [판정 종류](#resolution-kinds)에서 자세히 설명합니다.

이 형태들에 맞지 않는 메커니즘은 규칙 집합 파일로 쓸 수 없습니다. 대항 풀이 한 예입니다. 각 방식은 Engine 안에 새 판정 종류가 필요하며 JSON이 아닌 테스트를 갖춘 코드 기여입니다. 필요하면 Engine 저장소에 기능 요청을 열고 계산 과정을 보여 주는 몇 가지 굴림으로 설명하세요. 그 예가 테스트가 됩니다.

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
| `items` | 선택 사항. 아이템을 작성하는 어휘인 분류, 희귀도, 스탯, 슬롯, 화폐입니다. |
| `battle` | 선택 사항. 전투가 시트에서 읽는 내용과 이후 돌려쓰는 내용입니다. |
| `combat` | 선택 사항. 자체 규칙으로 전투를 해결하는 방법과 전투 화면이 실행할 내용입니다. |
| `layers` | 선택 사항. 게임을 만들 때 플레이어가 켜는 규칙 집합 변형입니다. |

파일 크기는 최대 512 KB입니다(Capability API 1.340 이전에는 256 KB). 프롬프트에 들어가는 텍스트(이름, 라벨, Game Master 텍스트)에는 줄바꿈, 대괄호, 이중 중괄호를 넣을 수 없습니다.

시트 안의 ID(능력치, 기술, 필드, 풀 등)는 `grit_max`처럼 문자로 시작하며 소문자, 숫자, 밑줄을 사용합니다.

<a id="resolution-kinds"></a>

### 판정 종류

`resolution.kind`가 판정 굴림을 선택합니다. 모든 종류는 같은 캐릭터 시트를 읽고 세 키를 공유하므로 바꿔도 `resolution` 아래 파일 부분은 달라지지 않습니다.

- `abilityModifier`: 시트 점수를 숫자로 바꾸는 방식입니다. `identity`는 점수 자체, `floorHalfMinusTen`은 5e 규칙, `stepTable`은 `[[score, number], ...]`로 직접 나열한 경계값입니다.
- `proficiencyTiers`: 기술이나 내성의 훈련 단계입니다. 목록에 없는 기술은 첫 단계를 사용합니다. 단계는 `flat`, 숙련 보너스의 `multiplier`배 또는 둘 다를 더합니다. 숙련 보너스가 있는 시스템은 `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`로 출처를 지정하세요.
- `proficiency`: 선택 사항이며 곱셈을 하는 단계에만 필요합니다.

계산한 숫자의 의미는 종류가 정합니다. `dice-sum`은 굴림에 더하고 `dice-pool`과 `dice-highest`는 그만큼의 주사위를 던집니다. `symbol-pool`은 서술형 주사위를 구성하고 승급하기 위해 능력치와 훈련을 따로 유지합니다.

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
- `dice.faces`: 눈이 자기 숫자 그대로가 아닐 때 각 눈의 값이며 가장 낮은 눈부터 씁니다(Capability API 1.136). Fate의 Fudge 주사위 네 개는 `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`입니다. 카드는 −, 빈칸, +를 표시하고 합산하며, 확률은 Fate와 정확히 같습니다. 눈마다 값을 하나씩 주세요.
- `openEnded`: 계속 이어 굴리는 단일 주사위입니다(1.136). `high` 이상의 눈은 다시 굴려 더하고, 새 주사위가 `high` 이상을 보이는 동안 계속합니다. `low` 이하의 눈은 다시 굴려 빼며, 그 굴림도 같은 방식으로 `high`에서 이어집니다. Rolemaster의 열린 백분율 굴림은 d100 하나에 `{ "high": 96, "low": 5 }`입니다. 한 굴림은 주사위를 최대 20개 던집니다. 자연 눈과 결과 구간의 이동은 첫 주사위를 읽습니다.
- `unmodified`: 첫 주사위가 그 눈을 보일 때 기록이 표시하는 단일 주사위의 눈입니다(1.136). 따라서 "수정되지 않은 66"을 따로 다루는 표를 적용할 수 있습니다(`[66, 100]`). 기록에는 `unmodified="66"`이 남고 카드에도 표시되며, Game Master는 규칙이 이에 대해 정한 것을 적용하라는 안내를 받습니다.
- `difficultyLadder`: Game Master에게 제시하는 난이도 선택지입니다. `dc`는 총합이 도달해야 하는 숫자입니다. Game Master는 숫자를 쓰는 대신 `difficulty="Hard"`처럼 단계 이름을 지정할 수 있으며, Engine이 그 단계에서 숫자를 읽습니다.

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

- `die`: 풀의 주사위 하나의 면수로 2~100입니다.
- `pool`: 폭발 전 시트 숫자를 제한할 범위입니다. `min`이 0이면 빈 풀은 아예 굴리지 않고 실패하며 `max`는 최대 100입니다. `abilityPlusAbility: true`는 능력치 판정이 `with=`로 두 번째 능력치를 지정해 둘 다 던지게 합니다. 속성 둘을 함께 굴리는 시스템을 위한 것이며, 이 설정이 없으면 능력치 판정의 `with=`는 아무 의미가 없습니다.
- `target`: 성공으로 세려면 도달해야 하는 눈입니다. `min`을 `max`보다 낮게 쓰면 Game Master가 판정마다 `threshold=`로 바꿀 수 있습니다. 셋을 같게 쓰면 고정합니다.
- `double`: 선택 사항. `from` 이상의 눈은 두 번으로 셉니다.
- `explode`: 선택 사항. `from` 이상이면 한 개를 추가로 굴리며 추가 주사위도 다시 폭발할 수 있습니다. 추가 주사위는 원래 풀에 더해 최대 `pool.max`개이므로 한 판정의 총량은 `pool.max`의 두 배이며 낮은 `from`도 무한히 굴리지 못합니다.
- 둘 다 `min`을 가질 수 있습니다. 태그의 `explode="N"`이나 `double="N"`, 또는 캐릭터가 사용한 항목으로 판정이 규칙의 눈을 내릴 수 있는 가장 낮은 값입니다. `min`이 있으면 `from`을 생략할 수 있으며, 그러면 규칙은 이를 요청한 판정에서만 발동합니다. 기술 하나에서 10이 나오면 다시 굴리게 하는 전문 분야는 `"explode": { "min": 10 }`입니다. `from`은 `min`보다 낮을 수 없습니다.
- `cancel`: 선택 사항. `upTo` 이하의 눈은 성공 하나를 빼며 성공 수는 0 아래로 내려가지 않습니다.
- `botch`: 선택 사항. 성공한 주사위가 **하나도 없고** `upTo` 이하의 눈이 나오면 대실패입니다. 한 성공이 상쇄된 풀은 일반 실패이며 대실패가 아닙니다. `"rule": "halfOrMore"`는 다르게 판단합니다. 처음 던진 주사위(폭발로 추가된 주사위 제외)의 절반 이상이 `upTo` 이하일 때, 성공한 주사위가 없으면 대실패이고 그 밖에는 결과를 그대로 두되 `complication="true"`로 표시하여 결과와 함께 무언가 잘못되었음을 나타냅니다. 기본값은 `"noSuccesses"`입니다.
- `exceptional`: 선택 사항. 성공한 판정에서 순 성공 수가 이 값 이상이면 대성공입니다.
- `situationalDice`: 선택 사항. 묘기, 부상, 어두운 조명 등에 대해 Game Master가 `bonus=`로 한 판정에서 더하거나 뺄 수 있는 주사위 범위입니다.
- `reroll`: 선택 사항. 아무도 비용을 내지 않고 시스템이 허용하는 재굴림으로 최대 여섯 개이며, 각각 Game Master가 판정에서 `reroll=`로 지정하는 `id`를 가집니다. `upTo` 이하의 눈을 다시 던집니다. `"once"`는 새 눈이 무엇이든 그대로 확정하고, `"until"`은 더 높은 눈이 나올 때까지 계속합니다. 모든 눈을 다시 던지면 끝나지 않으므로 `upTo`는 1부터 주사위 면 수보다 하나 작은 값까지이며, `until`도 한 판정에서 백 번 다시 던진 뒤에는 멈춥니다. 판정이 지정하지 않으면 아무것도 다시 던지지 않습니다. 한 판정은 재굴림을 하나만 합니다. 자원 소비나 캐릭터가 사용한 항목도 재굴림을 샀다면 더 많은 눈에 닿는 쪽을 던지고, 닿는 눈이 같으면 `once`보다 `until`을 택합니다.
- `difficultyLadder`: `successes`는 필요한 성공 수입니다. 단계에 `target`도 지정할 수 있지만 목표를 조정할 수 있고 해당 범위 안일 때만 가능합니다. 그 단계의 판정은 이 목표로 성공을 셉니다. Game Master가 `difficulty=`로 단계를 지정하거나, 정확히 한 단계만 요구하는 `dc=`를 쓴 경우입니다. 여러 단계가 같은 성공 수를 요구하면 `dc=`만으로는 어느 단계인지 알 수 없어 목표가 기본값으로 남으므로 단계 이름을 지정하세요.

- `target.from`: 선택 사항. 각 캐릭터의 목표를 시트에서 읽습니다. 캐릭터가 한 번 고르는 Lasers & Feelings의 Number가 예입니다(능력치, 필드, 파생 값 등 모든 값 참조). `min`..`max` 범위로 제한하며, 숫자가 캐릭터 자신의 것이므로 `threshold=`로는 옮기지 않습니다. 캐릭터가 사용한 항목이 산 목표는 여전히 목표를 옮깁니다. 기록의 `threshold=`가 실제로 쓴 값을 알려 줍니다.
- `stances`: 선택 사항. 최대 여섯 개이며 각각 `id`, `label`, `count`(`"below"` 또는 `"above"`), 다루는 `skills`를 가집니다. 이 기술 중 하나의 판정은 목표 이상인 주사위 대신 목표 **미만** 또는 **초과**인 주사위를 셉니다. Lasers & Feelings는 미만을 세는 Lasers 태세와 초과를 세는 Feelings 태세로 이루어지며, 각 기술은 둘 중 하나에 속합니다. 기술은 태세 하나에만 속할 수 있습니다. 태세는 "이상"을 기준으로 읽는 `explode`, `double`, `cancel`, `botch`를 적용하지 않습니다.
- `exact`: 선택 사항. 목표와 정확히 같은 눈을 보인 주사위입니다. `label`이 그 이름을 정하고(`"LASER FEELINGS"`), `text`는 테이블에서 어떤 일을 하는지 설명할 수 있으며, `counts`가 `false`가 아니면 성공 하나로 셉니다. 기록에는 그런 주사위의 개수인 `exact="N"`이 남고 주사위 카드가 결과 옆에 이를 표시하므로, Game Master는 그것으로 얻는 통찰을 플레이어에게 줄 수 있습니다.

`cancel`과 `botch`의 눈은 최저 목표보다 낮아야 하며 모든 규칙의 눈은 실제 그 주사위에 존재해야 합니다. 발동할 수 없는 규칙은 플레이 중 발견하게 하지 않고 가져올 때 거부합니다.

패키지 형태의 풀 규칙 집합은 Capability API 1.24입니다. `explode`나 `double`의 `min`, `pool.abilityPlusAbility`, `botch.rule`은 1.37이고 `reroll`은 1.38이며, `target.from`, `stances`, `exact`는 1.137입니다. 가져온 커뮤니티 규칙 집합은 읽는 Engine이 검증하므로 별도 선언이 필요 없습니다.

#### 풀 판정에서 Game Master가 쓸 수 있는 내용

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc`는 목표 숫자가 아니라 필요한 **성공 수**입니다. 1부터 한 굴림이 셀 수 있는 최대치까지 가능합니다. 풀 최댓값을 기준으로 폭발이 가능하면 두 배, 눈을 두 번 세면 다시 두 배입니다.
- `threshold=`는 주사위별 목표를 바꾸며 `target.min`이 `target.max`보다 작을 때만 제공됩니다.
- `bonus=`는 주사위를 더하거나 빼며 `situationalDice`를 선언했을 때만 제공됩니다.
- `with=`는 기술이나 내성의 본래 능력치 대신 다른 능력치를 씁니다. 두 종류 모두 지원하므로 5e의 "Strength (Intimidation)"도 같은 속성으로 표현합니다. 능력치 판정에서는 `pool.abilityPlusAbility`가 켜져 있을 때 대신 두 번째 능력치를 더합니다.
- `difficulty=`는 `dc=` 대신 사다리 단계를 지정하며 두 종류 모두에서 쓸 수 있습니다. 그 단계의 성공 수(합산에서는 난이도)와, 풀에서는 그 단계의 목표도 씁니다. 함께 쓴 `dc=`는 여전히 숫자에서 우선하고, 목표에서는 `threshold=`가 우선합니다. 어느 단계에도 해당하지 않거나 두 단계가 함께 쓰는 이름은 무시합니다.
- `explode=`와 `double=`는 이 판정에서 해당 규칙의 눈을 옮기며, 규칙에 `min`이 있을 때만 제공됩니다.
- `reroll=`은 이 판정에 쓸 `reroll` 항목 하나를 지정하며, 하나라도 선언했을 때만 제공됩니다. 어느 항목에도 해당하지 않는 이름은 무시합니다.

모두 파일 선언 범위로 제한합니다. 범위 밖 값은 가장 가까운 끝값으로 조정하고, 규칙 집합에 없는 능력치는 판정을 거부하지 않고 무시합니다. 저장 기록에는 실제 사용한 값이 나옵니다. 난이도와 목표는 숫자로, 보너스 주사위는 제한 후의 값으로 나오며, `with=`는 능력치를 실제 바꾸거나 더했을 때만, 눈은 판정이 옮겼을 때만, `reroll=`은 지정한 재굴림이 실제로 쓰였고 무언가를 다시 던졌을 때만 남습니다. `halfOrMore` 대실패 규칙으로 결과와 함께 무언가 잘못되었으면 `complication="true"`가 남습니다. Engine이 항상 직접 굴립니다. 모델이 쓴 풀 결과는 교체하고, 이 종류에는 이점이 없어 `mode="advantage"`를 무시하며, 플레이어가 턴 전에 굴린 주사위도 적용하지 않습니다.

#### `dice-highest`: 주사위를 던져 가장 높은 눈 읽기

Blades in the Dark와 Trophy Dark는 d6 몇 개를 던져 가장 높은 것 하나만 읽습니다. Capability API 1.138.

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

- 시트 숫자는 풀과 마찬가지로 주사위 개수이며 `pool`로 제한합니다(최대 20). 부상, `adjust`, 상태, 아이템이 주사위를 더하거나 뺍니다.
- `keep`: 선택 사항이며 1~3, 기본값은 1입니다. 가장 높은 주사위 몇 개를 더할지입니다. 1은 Blades, 2는 Trophy Dark의 전투입니다.
- `zeroDice`: 주사위가 없는 캐릭터가 하는 일입니다. `"lowest-of-two"`(기본값)는 두 개를 던져 낮은 것을 쓰며 대성공이 될 수 없습니다. `"fail"`은 굴리지 않고 실패합니다.
- `critical`: 선택 사항. 최고 눈(또는 `face` 이상)을 보인 주사위가 `count`개이면 대성공입니다. Blades의 6 두 개가 이것입니다.
- `dark`: 선택 사항이며 Trophy Dark의 어둠 주사위입니다. `label`, `max`(1~10), `text`를 가집니다. Game Master는 `dark="N"`으로 한 판정에 이를 더합니다. `outcome`의 기본값은 `"all"`이며 다른 주사위와 함께 읽습니다. `"outcome": "light"`(Capability API **1.149**)이면 밝은 주사위만 유지할 주사위, 합계, 결과 구간, 대성공을 정합니다. 밝은 주사위가 없으면 밝은 쪽에 `zeroDice`를 적용합니다. 밝은 주사위 두 개를 던져 낮은 것을 쓰거나, 어둠 주사위는 그대로 던지면서 실패합니다. 어둠 주사위는 항상 던지고 마지막에 기록합니다. `darkHighest="true"`는 어둠 주사위 하나가 모든 밝은 주사위보다 확실히 높았다는 뜻입니다(대신 던진 밝은 주사위 포함. 밝은 주사위를 하나도 던지지 않았으면 어떤 어둠 주사위든 이깁니다). 그 대가(Ruin)는 Game Master가 적용합니다. `"all"`을 포함해 `dark.outcome`을 선언하려면 capabilityApi 1.149가 필요합니다.
- `situationalDice`: 선택 사항. Game Master가 `bonus=`로 더하거나 뺄 수 있는 주사위입니다(도움, 밀어붙이기).
- `spend`는 주사위만 살 수 있습니다.
- `difficultyLadder`: 유지한 주사위가 도달해야 하는 숫자인 `dc`를 가진 단계입니다. 판정의 `dc=`가 그 숫자이며 1부터 `keep`에 주사위 면 수를 곱한 값까지입니다.
- `outcomes`는 유지한 주사위에서 `by: "total"`로 읽으며, `on: "critical-success"` 구간이 대성공을 받습니다.

기록은 합산 형태(`resolution="sum"`, `modifier="0"`, 유지한 주사위를 합계로)를 유지하고 `highest="1"`을 더하며, 해당하면 `zeroDice="true"`와 `dark="N"`도 더합니다. 어둠 주사위는 `rolls`의 마지막에 있습니다. 밝은 주사위만 보는 결과는 `darkOutcome="light"`도 기록하므로 다시 불러온 뒤에도 카드는 유지한 밝은 주사위만 강조합니다. 이 종류의 규칙 집합에는 자체 전투가 없으므로 함께 쓴 `combat`은 거부합니다.

#### `roll-against`: 시트 숫자 이하(또는 이상)로 굴리기

Call of Cthulhu, GURPS, 고전 도적의 백분율 기술은 주사위에 더하는 대신 시트의 숫자를 상대로 굴립니다. Capability API 1.139.

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

- 판정의 시트 숫자가 목표입니다. 기술의 백분율은 시트의 기술별 보너스(`bonusRange`는 100까지)이며 능력치나 단계 보너스는 없습니다. GURPS 기술은 속성에 그 보너스를 더한 값입니다.
- `dice`: 굴려서 더하는 것으로 기본값은 1d100입니다(GURPS는 3d6, 내성 굴림은 1d20).
- `against`: `"at-most"`(기본값)는 목표 이하일 때, `"at-least"`는 목표 이상일 때 성공합니다.
- `difficultyLadder`: 각 단계의 `dc`가 목표를 옮기며, `divide`(2~10)는 먼저 시트 숫자를 나눕니다. Game Master는 `difficulty=`로 단계를 지정하고, 태그의 `dc=`는 -100부터 100까지 숫자를 옮깁니다. 기록의 `dc`는 굴림을 비교한 숫자이며 기록에 `against="at-most"`가 남습니다.
- `criticalSuccess`와 `criticalFailure`: 각각 규칙 최대 여섯 개입니다. 규칙은 눈(`from`, `to`, 어느 쪽이든 열어 둘 수 있음)을 지정하거나, 실패의 경우 실패하는 쪽으로 그만큼 이상 벗어난 굴림인 `pastTarget`을 지정합니다. `whenTarget`(`atLeast`, `below`)은 규칙을 일부 목표로 제한합니다. GURPS의 5는 목표가 15 이상일 때만 대성공입니다. 대성공은 항상 성공하고 대실패는 항상 실패합니다.
- `tens`: 선택 사항이며 d100 하나에서만 씁니다. `bonus="+N"`은 십의 자리 주사위를 N개 더 던져 가장 좋은 굴림을, `bonus="-N"`은 가장 나쁜 굴림을 쓰며 `max`까지입니다.
- `outcomes`는 `at-most` 굴림에서 `by: "fraction"`으로 읽을 수 있습니다. 각 구간의 `atLeast`가 목표를 나누며, 그 몫 이하의 굴림이 그 구간에 들어갑니다. `margin`(목표보다 얼마나 낮은지)과 `total` 기준도 작동합니다.

#### `symbol-pool`: 서술형 주사위를 던져 기호 읽기

Genesys는 특성과 기술 등급으로 풀을 만든 뒤 반대 주사위를 더합니다. 눈에는 숫자 대신 성공, 우위, 승리, 실패, 위협, 절망이 있습니다. Capability API 1.141.

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

- `symbols`: 이름 붙은 기호 2~10개입니다. `counts`는 상쇄 전에 다른 기호 하나를 더합니다. 승리는 성공 하나를 더하고 승리로 남습니다. 이때 지정하는 기호는 자체 `counts`가 없어야 하며, 연쇄와 자기 참조는 거부합니다. `cancels`는 두 기호를 하나 대 하나로 짝짓고 각 기호의 짝은 최대 하나입니다. 반대쪽 선언은 선택 사항입니다. `text`는 Game Master에게 기호를 설명합니다.
- `dice`: 이름 붙은 주사위 2~8개이며 각각 면 2~20개를 가집니다. 면은 기호 ID 최대 세 개의 배열이며 `[]`는 빈 면이고 반복한 ID는 두 번 셉니다. 모든 참조는 존재해야 합니다.
- `pool`: `larger-upgraded`(기본값)는 능력치와 등급 중 큰 쪽만큼 던지고, `upgrade`를 선언했으면 작은 쪽 숫자만큼 승급합니다. `sum`은 둘을 더하고 승급하지 않습니다. `max`의 기본값은 6이고 12를 넘을 수 없습니다. 능력치는 `abilityModifier`를 쓰므로 Genesys 특성에는 `identity`를 쓰세요. 등급은 기술이나 내성의 숙련 단계에서 오며, 순수 능력치 판정의 등급은 0입니다. `with=`는 다른 판정처럼 특성을 바꿉니다. 시트 보너스, 부상, 조정, 효과는 아래의 부호 있는 보너스로 증강 주사위나 차질 주사위를 더합니다.
- `difficulty`: `dc=`는 반대 주사위를 0부터 `max`(기본값 5, 상한 12)까지 셉니다. `difficulty=`는 대신 사다리 단계를 지정합니다. `upgrade="N"`은 반대 주사위 그만큼을 승급 주사위로 바꾸며, 실제로 던진 수로 제한합니다. 난이도를 넘어 주사위를 더하지는 않습니다.
- `boost`와 `setback`: 각각 `bonus="+N"`과 `bonus="-N"`으로 더하는 선택적 주사위이며, 각 `max`(기본값 3, 상한 6)까지입니다. 부호 있는 조정은 이 제한을 적용하기 전에 합칩니다. Capability API **1.150**은 `setback="N"`도 따로 받습니다. `bonus="2" setback="1"`은 양쪽을 모두 던집니다. 음수 보너스는 `setback`에 더해지며, 합친 차질 주사위 수는 `setback.max`로 제한합니다. 증강 주사위는 `boost.max` 안에 머뭅니다.
- `allowOwnUpgrade`: 선택 사항이며 없으면 false입니다. `true`이면 `upgradeOwn="N"`이 시트 승급과 구매한 주사위 다음에 캐릭터 주사위 N개를 더 `pool.upgrade`(선언 필수)로 승급합니다. 기존 주사위가 모두 승급되었으면 추가 승급마다 승급된 주사위 하나를 더하며, 여전히 `pool.max`로 제한합니다. `pool.build: "sum"`에서도 작동합니다. 이 키를 `false`로라도 선언하려면 capabilityApi **1.150**이 필요합니다. 속성 이름은 `zeroDice`처럼 카멜 표기를 씁니다. `upgradeOwn`은 굴리는 쪽에 작용하고 `upgrade`는 여전히 난이도 주사위에만 작용합니다. `setback`과 `upgradeOwn`은 모두 음이 아닌 정수를 받으며 기호 풀 밖에서는 무시합니다. `upgradeOwn`은 켜지 않으면 무시합니다.
- `success`: 상쇄 후 그 기호가 이만큼 필요하며 기본값은 하나입니다. 대성공과 대실패 표시는 이름 붙은 기호가 나타나면, 그것이 더한 성공이나 실패가 상쇄되더라도 붙습니다. 두 표시가 함께 나타날 수 있으며, 어느 쪽도 순 성공이 판정을 통과했는지를 바꾸지 않습니다.
- `outcomes`는 순 성공 수(`total`)나 `net successes - needed + 1`(`margin`)을 읽을 수 있습니다. 구간은 여전히 평소 방식으로 성공을 정하며, 원래의 대성공·대실패 기호는 표시된 채 남습니다. `spend`는 `pool.max` 안에서 기본 캐릭터 주사위만 더 삽니다. `dice-highest`와 마찬가지로 전투는 제외합니다.
- 기록은 `resolution="sum"`을 유지하며 `symbols="2s 1a 1t"`, 각 주사위를 식별하는 `thrown=`, 1부터 센 면 번호를 담는 `rolls=`를 가집니다. 인코딩된 `symbolDetails`는 라벨, 면의 기호, 대성공·대실패 표시 둘을 보존합니다. `setback`은 공유 차질 제한 뒤 실제로 더한 별도 차질 주사위를, `upgradeOwn`은 실제로 적용한 추가 승급을 기록하며, 무시했거나 0인 추가분은 생략합니다. 카드와 요약은 면 숫자를 더하지 않고 순 기호를 표시하며 빈 결과도 표시합니다. 재정의는 이 종류의 규칙을 바꿀 수 있지만 `symbols`나 `dice`를 대체할 수는 없습니다.

#### 범위 밖의 기능과 그 이유

다음 메커니즘은 여전히 자체 판정 종류가 필요합니다.

- **대항 풀**은 두 캐릭터를 함께 해결하지만 판정의 굴림 주체는 한 명입니다.
- **와일드 주사위가 있는 합산 풀**(OpenD6 등)은 주사위를 더하고 하나를 특별 취급합니다.

이 종류가 예전에 제외하던 나머지 둘은 이제 구현되었으며 아래 자원 소비로 굴림 바꾸기에서 설명합니다. "한 점을 써 성공 하나 얻기"나 "한 점을 써 실패한 주사위 다시 던지기" 같은 시스템 자체 규칙은 `resolution.spend`입니다. 상황에 따라 시스템이 무료로 허용하는 재굴림은 위의 `resolution.reroll`입니다. 캐릭터가 선택한 것에 속하는 재굴림은 카탈로그 항목의 `mechanics.check`이며 해당 항목의 비용을 지불합니다.

### 결과 구간: 성공과 실패 그 이상

많은 시스템은 판정을 단순한 성공이나 실패가 아니라 여러 결과 중 하나로 읽습니다. Pathfinder의 네 가지 성공 등급, 대가를 치르고 성공하는 "간신히", Call of Cthulhu의 어려운 성공과 극단적 성공, Fate의 "멋진 성공" 등입니다. `resolution.outcomes`가 이 구간에 이름을 붙이며, Engine은 판정마다 어느 구간에 들어갔는지 알려 줍니다(Capability API 1.135). 모든 판정 종류에서 작동합니다.

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

- `by`: 구간을 무엇으로 읽는지입니다. `"margin"`(기본값)은 결과가 판정에 필요한 값을 얼마나 넘었는지입니다. 합산 합계에서 난이도를 뺀 값이나 풀의 순 성공에서 필요한 성공을 뺀 값입니다. `"total"`은 결과 자체이며, 난이도와 관계없이 합산 합계나 순 성공 수입니다.
- `tiers`: 구간 2~8개이며 **가장 좋은 것부터** 씁니다. `atLeast`는 그 구간에 들어가는 가장 낮은 숫자입니다. 각 구간의 값은 앞 구간보다 낮아야 하며, 마지막 구간은 그 아래 모든 것을 받으므로 값이 없습니다. `success`는 그 구간이 성공인지 정하고, `critical`은 그 구간을 해당 종류의 치명적 결과로 표시합니다(`success`가 true이면 대성공, 아니면 대실패). 적어도 한 구간은 성공이고 한 구간은 실패여야 합니다. `text`는 선택 사항인 최대 200자의 한 줄로, 테이블에서 구간이 무슨 뜻인지 Game Master에게 알려 줍니다("You do it, but the Game Master adds a complication").
- `on`: `"critical-success"`나 `"critical-failure"`는 숫자와 관계없이 대성공이나 대실패가 들어가는 구간으로 만들며, 그 밖의 것은 그 구간에 들어가지 않습니다. 이런 구간에는 `atLeast`가 없고, 대성공 구간은 성공이며 대실패 구간은 실패이고, 각각 최대 하나입니다. Blades in the Dark의 "6 두 개"는 6 하나에 대한 구간 위에 놓인 대성공 구간입니다. 숫자로 읽는 나머지 구간은 서로 사이에서 위 규칙을 따릅니다.
- `naturals: "shift"`: 단일 주사위의 최고 눈은 결과를 한 구간 좋게, 최저 눈은 한 구간 나쁘게 옮기며 양 끝을 넘지 않습니다. 주사위 하나가 필요하며 `resolution.naturals`를 대체하므로 함께 그 둘을 모두 `none`으로 설정하세요.

결과는 구간이 정합니다. 성공과 대성공·대실패는 단순 비교가 아니라 구간에서 나옵니다. 합산 규칙 집합의 `naturals`가 어떤 눈을 자동 성공이나 실패로 만들면, 그 눈은 해당 대성공이나 대실패에 지정된 구간, 없으면 가장 좋거나 가장 나쁜 구간에 들어가며 대성공이나 대실패로 남습니다. 풀의 대실패도 맨 아래에서 같은 일을 하며, 구간이 이미 대성공을 정하므로 구간이 있는 풀은 `exceptional`을 적용하지 않습니다.

난이도가 고정된 시스템은 `by: "total"`로 읽는 풀로 결과를 표현합니다. Lasers & Feelings의 "성공 1개: 간신히 해냄, 2개: 잘 해냄, 3개: 대성공"은 성공 3, 2, 1에 해당하는 세 구간과 그 아래의 실패입니다.

기록은 `outcome="Critical success"`로 구간 이름을 남기고, 주사위 카드는 일반 단어 대신 이를 표시하며, Game Master는 구간과 그 `text`를 배우고 구간에 맞게 서술하라는 안내를 받습니다. 구간을 선언한 패키지 규칙 집합은 Capability API 1.135가 필요합니다.

### 자체 방식으로 굴리는 판정

어떤 게임은 대부분의 판정을 한 방식으로, 일부는 다른 방식으로 굴립니다. 고전 게임은 능력치 점수 이하로 d20을 굴리지만 도적 기술은 d100으로, Open Doors는 d6으로 굴립니다. `resolution.overrides`는 그런 판정과 대신 쓸 해결 방식 키를 지정합니다. Capability API 1.140.

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- 각 재정의는 `skills`, `saves`, `abilities`(셋 중 하나 이상), `label`, Game Master를 위한 선택적 `text`를 지정합니다.
- `set`은 규칙 집합 자체 종류의 해결 방식 키를 담으며, 그 판정에서 규칙 집합의 키를 대체합니다. `null`은 키를 없앱니다. 선호 능력치에서 1이 상쇄하지 않는 exwod 규칙은 `"cancel": null`입니다. 종류, 시트 계산(`abilityModifier`, `proficiency`, `proficiencyTiers`, `penaltyFrom`, `spend`, `adjust`), `difficultyLadder`는 바꿀 수 없습니다. 기호 풀은 `symbols`와 `dice`도 고정합니다. 재정의가 만드는 해결 방식은 규칙 집합 자체의 것처럼 검사하므로, 지정한 눈은 그 주사위에 있어야 합니다.
- `when`: 선택 사항. 굴리는 사람 시트의 값이며, 0이 아닐 때만 재정의를 적용합니다. 선호 능력치를 위한 0 또는 1의 숫자 필드가 예입니다. 없으면 항상 적용합니다.
- 판정을 지정하고 `when`이 충족되는 첫 재정의를 씁니다. 한 판정은 `when` 없는 재정의 중 최대 하나에만 나타날 수 있습니다.

### 자원 소비로 굴림 바꾸기

일부 시스템은 의지 한 점으로 자동 성공을 얻듯, 앞으로 할 굴림에 비용을 낼 수 있습니다. `resolution.spend`는 캐릭터가 구입한 특성이 아니라 시스템의 상시 규칙으로 이를 선언합니다.

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool`은 `live.pools` 중 하나입니다. 시작할 때 비어 있는 풀은 플레이 시작 시 쓸 것이 없으므로 사용할 수 없습니다.
- `amount`는 한 번의 구매 비용입니다. `successes`, `dice`, `reroll`이 얻는 것이며 적어도 하나를 구매해야 합니다. 구매한 성공은 누구도 굴린 것이 아니므로 주사위 집계와 상쇄가 끝난 뒤 더합니다. 주사위는 풀 범위 안에서 풀과 함께 던집니다. `reroll`은 `{ "upTo": 6, "mode": "once" }` 형태로 `resolution.reroll`과 같은 방식으로 읽으며, 판정에서 몇 번 구매하든 한 번만 삽니다. 두 번 다시 던진 주사위도 재굴림 하나이기 때문입니다.
- `perCheck`는 한 판정의 구매 횟수입니다. 최대 `amount * perCheck`점어치를 사며, 이 상한은 가득 찬 풀로 실패 불가능한 굴림을 사지 못하게 합니다. 1부터 10까지의 숫자, 파생 값이 읽는 것과 같은 형태의 시트 값(`{ "abilityScore": "nerve" }`, `{ "derived": "focus" }`), 또는 판정의 주사위 수만큼인 `"pool"`입니다. 여기서 주사위 수는 부상, 보너스 주사위, 수정치를 적용하기 전 그 판정의 시트 숫자입니다. 시트 값은 굴리는 사람 기준으로 읽어 내림하고 0에서 100 사이로 제한하며, 상한이 0인 캐릭터는 아무것도 사지 않고 아무것도 지불하지 않습니다.
- `dice-pool` 규칙 집합은 성공, 주사위, 재굴림을 살 수 있습니다. `dice-highest`와 `symbol-pool`은 주사위만 삽니다. 다른 종류는 `spend`를 선언할 수 없습니다.
- 항목은 최대 네 개이며, 두 항목이 같은 풀을 지정하면 판정이 어느 쪽인지 구분할 수 없으므로 금지됩니다.
- `reroll`을 사는 자원 소비, 숫자가 아닌 `perCheck`, 세 개 이상의 항목은 패키지 규칙 집합에서 Capability API 1.38입니다.

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
- `explode`와 `double`은 해당 굴림에서 그 규칙의 눈을 옮기며, 규칙에 `min`이 있을 때 그 범위 안에서만 가능합니다. `"check": { "explode": 8 }`은 8이 나오면 다시 굴리게 하는 항목입니다. `threshold`와 마찬가지로 Game Master가 태그에 쓴 값보다 우선합니다. Capability API 1.37.
- 이 중 하나 이상이 필요하며, 없으면 아무 효과도 없어 거부됩니다.
- 이 모든 것을 지원하는 것은 `dice-pool`뿐이므로 `mechanics.check`가 있는 `dice-sum`은 가져올 때 거부됩니다.

**비용은 항목 자체의 `cost`입니다.** 다른 항목 사용과 같은 처리로 풀과 해당 항목이 만든 모든 카운터의 한 번 사용량을 지불합니다. `perCostStep`은 항목이 확장됨을 뜻합니다. 선언하면 가격을 지불한 횟수만큼 구매하며, 없으면 얼마를 제시했든 한 번만 구매합니다.

**Game Master는 판정에 이름을 적습니다.** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`입니다. 위와 같이 장부 처리가 실행되기 전에 주사위를 굴리므로 별도 시트 명령이 아닙니다.

**전부 아니면 전무입니다.** 풀이 부족하면 구매하지 않고 차감도 없으며 원래 굴림 그대로입니다. 정수 횟수의 구매에 맞지 않는 점수도 아무것도 사지 않습니다. `perCheck` 초과 요청은 거부하지 않고 상한으로 줄여 그만큼만 지불합니다. 이를 모두 Engine이 계산합니다. Game Master는 플레이어가 쓴다고 말한 것을 이름으로 지정하고 주사위는 건드리지 않습니다. 기록에는 실제 지불액, 적용 항목, 굴리지 않고 얻은 성공 수와 다시 던진 주사위 수가 나옵니다. 선택하지 않은 부적이나 Engine이 카탈로그를 읽지 못하는 부적은 믿고 적용하지 않고 아무 효과도 내지 않습니다.

### 시트

- `sections`는 편집기 항목을 묶습니다. 필드, 파생 값, 목록은 `section`으로 자신이 속한 구역을 지정하며 능력치, 기술, 내성도 지정할 수 있습니다. 그러면 편집기, 게임 시트, Game Master의 시트 블록이 이를 그 제목 아래에 표시합니다(구역을 지정하지 않은 시트는 이전과 똑같이 표시합니다). 구역에는 `untrained` 규칙(아래 참고)도 넣을 수 있습니다.
- `abilities`는 핵심 능력치입니다. `skills`와 `saves`는 각각 굴림에 쓸 능력치, `cap`, `untrained` 규칙(아래 참고)을 지정할 수 있습니다.
- `fields`는 단일 값입니다. 타입은 `number`, `text`, `longtext`, `boolean`, `enum`(고정 선택지), `dice`(`1d8` 같은 텍스트)입니다.
- `derived`는 다른 값에서 계산하며 직접 덮어쓸 수 없습니다. 시트는 최대 400개를 가질 수 있으며(Capability API 1.111. 1.88부터 240개, 1.84부터 120개, 그 전에는 60개), 240개를 넘는 패키지는 1.111을 선언합니다. 연산은 `sum`, `min`, `max`, `scale`(고정 수로 곱하고 반올림), `multiply`(Constitution 수정치 곱하기 레벨처럼 값 2~6개를 서로 곱함. Capability API 1.82), `stepTable`(레벨에서 숙련 보너스를 찾듯 경계값 표로 조회), `enumTable`(열거형 필드나 실시간 상태의 각 값에 대응하는 숫자. 아래 실시간 상태 참고)입니다.
- `lists`는 장비, 주문, 특성 같은 자체 열을 가진 표입니다. 목록은 열을 최대 24개 가지며, 열이 12개를 넘는 목록이 있는 패키지는 Capability API 1.165를 선언합니다. `pools`가 있는 목록은 사용 횟수가 제한된 클래스 특성 등을 위해 각 행을 자체 최대값이 있는 자원으로 만듭니다. 숫자 열은 굴림으로 채울 수 있습니다. `"roll": { "count": 1, "sides": 8 }`처럼 쓰며 `sides`는 숫자, 같은 행의 다른 열(`{ "column": "die" }`, 숫자 열이나 `d8`처럼 값이 주사위로 읽히는 열거형), 또는 시트 값입니다. 시트 편집기는 Engine 자체 주사위를 던져 합계를 쓰는 Roll 버튼을 표시하며, 합계는 열의 `min`과 `max`로 제한합니다(Capability API 1.85).
- `live`는 플레이 중 바뀌는 내용입니다. `pools`(체력, 주문 슬롯, Grit), `tracks`(탈진 같은 범위 값 또는 칸에 표시하는 부상 트랙), `text`(집중 중인 대상 같은 짧은 메모), `conditions`, `states`(형태나 자세처럼 닫힌 집합 중 하나의 값)입니다.

숫자를 읽는 것은 값 참조로 지정합니다. 정확히 하나의 키를 가진 객체이며 키는 `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack`, `itemStat`입니다. 예를 들어 최대값이 파생 값인 풀은 `"max": { "derived": "grit_max" }`입니다.

- `listSum`은 목록의 숫자 열 하나를 합산합니다. `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`처럼 씁니다. `onlyWhen`은 선택 사항이며 불리언 열을 지정하고, 그 열이 설정된 행만 셉니다. 빈 칸은 해당 열의 기본값으로 세고, `hideWhen`이 숨긴 목록은 아무것도 더하지 않습니다. Ember Roads는 캐릭터가 챙긴 장비에서 이렇게 Burden을 계산하므로 직접 입력한 숫자처럼 목록과 어긋나는 일이 없습니다. 카탈로그의 연동 열은 파생 값을 거치더라도 목록 합계를 읽을 수 없습니다. 목록에는 자체 연동 칸이나 그 합계를 다시 읽는 연동 칸이 있을 수 있어 재계산이 끝나지 않기 때문입니다.
- `livePool`은 `live.pools` 중 하나에 남은 양을 읽습니다(목록 행의 풀은 해당하지 않습니다). `liveTrack`은 `live.tracks` 중 하나를 읽으며 선택적 `read`를 가집니다. `"value"`는 현재 위치(기본값), `"filled"`는 `min`보다 얼마나 위인지, `"remaining"`은 `max`보다 얼마나 아래인지이며, 부상 트랙에서만 쓸 수 있는 `"penalty"`는 적용 중인 페널티입니다. 숨겨진 풀이나 트랙은 0으로 읽습니다. Gravewatch의 "Harm still to take"는 `{ "liveTrack": "harm", "read": "remaining" }`입니다.
- 실시간 읽기는 판정을 굴릴 때, 전투가 시작될 때, Game Master의 시트 블록을 작성할 때의 실시간 상태를 읽습니다. 아직 실시간 상태가 없으면(시트 편집기, 가져오기 검토) 플레이가 시작될 때의 상태를 읽습니다. 풀은 `start`에 따라 가득 차거나 비어 있고, 트랙은 `default`에 있으며, 부상 트랙은 비어 있습니다.
- 실시간 상태가 생기기 전에 계산하는 값은 실시간 값을 읽을 수 없습니다. 풀이나 트랙의 `max`, 숙련 보너스, 카탈로그의 연동 열이나 증가량이 해당합니다. 실시간 값을 읽는 파생 값이나 실시간 값이 상한을 정하는 기술을 거쳐도 마찬가지이며, 가져오기가 그런 값을 지목합니다.
- 이 세 가지는 패키지 규칙 집합에서 Capability API 1.39입니다.
- `itemStat`은 착용한 방어구의 방어 수치처럼 캐릭터가 지닌 아이템을 읽으며 실시간 읽기와 같은 규칙을 따릅니다. [시트의 아이템](#items-on-the-sheet)을 참고하세요. Capability API 1.52.

**훈련하지 않은 판정.** 캐릭터가 훈련하지 않은(단계가 첫 단계인) 기술이나 내성은 규칙 집합이 달리 정하지 않으면 평소처럼 굴립니다. 기술이나 내성, 또는 그것이 속한 구역에 `untrained`를 두어 정하며 기술이나 내성 자체의 규칙이 우선합니다.

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"`: 평소대로입니다(기본값).
- `{ "by": -3 }`: -20부터 20까지의 값을 판정 숫자에 더합니다. 풀에서는 주사위, 합산에서는 고정 수치입니다. 시트가 표시하고 모든 판정이 굴리는 숫자의 일부이며 `cap`보다 먼저 적용됩니다.
- `"harder"`: 한 단계 어려워집니다. 풀에서는 주사위별 목표가 1 오르므로(목표 범위 안에서) 목표를 옮길 수 있는 풀 규칙 집합이 필요합니다. 그 밖의 경우에는 굴림을 바꿀 수 없으므로 가져올 때 거부합니다.
- `"refuse"`: 판정을 아예 굴리지 않습니다. Engine은 Game Master의 요청을 `reason="untrained"`와 함께 되돌려 쓰며 이것으로 처리가 끝납니다. 나중에 굴리는 일도 없고, Game Master는 캐릭터가 시도할 수 없었다는 안내를 받으며 서술도 그렇게 합니다. 기술 판정 엔드포인트는 이런 판정에 400(`skill_check_untrained`)으로 응답하며, 이 판정에 따른 분기는 어느 쪽도 남기지 않습니다. 시트 편집기는 이 기술에 숫자를 표시하지 않습니다.
- 시트가 없는 캐릭터는 읽을 훈련이 없으므로 미훈련 규칙이 적용되지 않습니다.
- Game Master의 리마인더는 미훈련 규칙을 구역별 또는 기술별로 나열하므로 Game Master는 캐릭터가 할 수 있는 판정을 요청합니다.

능력치, 기술, 내성의 구역 지정과 모든 위치의 `untrained`는 패키지 규칙 집합에서 Capability API 1.41입니다.

기술이나 내성은 `cap`을 가질 수 있습니다. 그 판정이 도달할 수 있는 최댓값을 정하는 값 참조로, 넘어설 수 없는 평점이나 판정을 억누르는 트랙입니다. Gravewatch는 Soothe를 파수꾼에게 남은 Resolve로 제한합니다(`"cap": { "livePool": "resolve" }`). 시트가 표시하고 모든 판정이 굴리는 숫자는 제한된 숫자이며, `with=` 교체는 제한 전 숫자로 계산한 뒤 다시 제한합니다. 상한은 기술이나 내성 수정치를 읽을 수 없으며, 상한이 읽는 파생 값과 그보다 앞에 선언된 파생 값도 마찬가지입니다. 따라서 시트는 여전히 위에서 아래로 한 번에 계산됩니다. Capability API 1.39.

`hideWhen`은 다른 필드의 값에 따라 필드, 파생 값, 목록, 풀, 일반 트랙을 숨기며 방식은 세 가지 중 정확히 하나입니다. 값 하나와 같을 때(`equals`), 값 하나와 다를 때(`notEquals`, 필드가 다른 값을 가질 때마다 숨기며 "이런 캐릭터에게만"을 표현하는 방법입니다), 값 목록에 있을 때(`in`)입니다. 지정한 모든 값은 필드가 가질 수 있는 값이어야 하며 그렇지 않으면 규칙이 일치할 수 없습니다. 값은 하나씩 검사하며, `notEquals`와 `in`에서는 숫자 필드의 범위와 텍스트 필드의 길이도 포함합니다. 규칙은 시트 편집기가 표시하는 값을 읽습니다. 설정하지 않은 필드는 빈 시트의 시작 값이고, 규칙 집합이 더 이상 제공하지 않는 열거형 값은 필드의 기본값입니다. 5e 파일은 `equals`로 주문을 쓰지 않는 캐릭터에게 주문 슬롯을 숨깁니다. Gravewatch는 `"hideWhen": { "field": "watch", "notEquals": "night" }`로 야간 경계를 서지 않는 모든 파수꾼의 시트에서 등불 기름을 숨깁니다. 레이어는 이 규칙들이 비교하는 값을 제외할 수 없습니다. 부상 트랙은 시트 표시와 관계없이 굴림과 전투가 읽으므로 숨길 수 없습니다. `notEquals`와 `in`은 Capability API 1.39입니다.

일반 트랙의 `max`는 숫자 대신 값 참조일 수 있으므로 캐릭터의 평점이 트랙 길이를 정할 수 있습니다(`"max": { "field": "willpower_rating" }`). `min`과 `default`는 숫자로 유지합니다. 이름 붙은 단계가 있는 부상 트랙의 `max`는 단계 수와 같고, 번호 칸으로 된 트랙은 자체 `max`만큼 깁니다(아래 번호 칸 참고). `alwaysShow: true`는 매 턴 중요한 평점을 위해 트랙이 기본값이어도 Game Master의 시트 블록에 출력합니다. 없으면 기본값인 트랙은 생략합니다. 0인 죽음 내성 세 개는 아무 정보도 주지 않기 때문입니다. 이 세 가지는 패키지 규칙 집합에서 Capability API 1.37입니다.

### 실시간 상태: 형태, 자세, 불빛

열거형 필드는 캐릭터를 만들 때 고른 뒤 그대로이고, 상태 이상은 켜거나 끄는 것뿐입니다. **실시간 상태**는 플레이 중 바뀌는 닫힌 집합 중 하나의 값입니다. 변신하는 캐릭터의 형태, 전투 자세, 등불의 밝기 등입니다.

```json
"live": {
  "states": [
    {
      "id": "stance",
      "label": "Stance",
      "values": ["guarded", "steady", "reckless"],
      "valueLabels": { "guarded": "Guarded", "steady": "Steady", "reckless": "Reckless" },
      "default": "steady"
    }
  ]
}
```

- `values`는 2~40개이며 각각 `valueLabels` 항목이나 값 자체로 표시합니다. 모든 라벨과 같은 규칙(한 줄, 대괄호 없음, 매크로 중괄호 없음)을 따르며, 시트 명령이 따옴표로 감싸므로 큰따옴표를 넣을 수 없습니다. 상태는 최대 열두 개입니다.
- `default`는 모든 시트의 시작 값이며 생략하면 첫 값입니다. 기본값에서 바뀐 상태만 저장하며, 상태가 더 이상 제공하지 않는 저장 값은 기본값으로 읽습니다.
- `hideWhen`은 풀과 마찬가지로 필드 값에 따라 시트에서 상태를 제외합니다. 표시하지 않고, 명령으로 설정할 수 없으며, 표(아래 참고)는 값이 전혀 없는 것으로 읽습니다.
- Game Master는 `[sheet: who="Name" op="state" state="Stance" value="Reckless"]`로 설정하며, 상태는 ID나 라벨로, 값은 값 자체나 라벨로 지정합니다. 시트에 없는 상태나 값은 거부합니다(`unknown-state`, `unknown-value`). Engine은 규칙 집합에 상태가 있을 때만 명령을 가르치고 모든 값을 나열하며, 모든 시트 블록은 기본값을 포함해 각 상태의 값을 알려 줍니다. "인간 형태" 같은 사실은 서술에 매 턴 필요하기 때문입니다.
- 게임의 시트 화면은 상태마다 선택기를 표시합니다.
- 휴식은 상태를 지정한 회복 단계로 상태를 되돌립니다. `{ "state": "stance", "to": "default" }`처럼 쓰거나 `"to"`에 값 하나를 지정합니다.

**따라오는 숫자.** `"op": "enumTable"`인 파생 값은 열거형 필드나 실시간 상태의 각 값에 대응하는 숫자를 줍니다.

```json
{
  "id": "stance_brawn",
  "label": "Stance on Brawn",
  "op": "enumTable",
  "from": { "liveState": "stance" },
  "table": { "guarded": -1, "reckless": 2 },
  "default": 0
}
```

- `from`은 `field`(열거형 필드)나 `liveState` 중 정확히 하나를 지정합니다. `table`의 모든 행은 그 대상이 가질 수 있는 값이며 1~40개입니다. 표에 없는 값과 시트가 숨긴 상태는 `default`로 읽습니다(생략하면 0).
- 필드는 캐릭터를 만들 때 고정되므로 필드를 키로 하는 표는 최댓값에 쓸 수 있습니다. Gravewatch는 새벽 경계를 서는 파수꾼에게 Resolve를 하나 더 줍니다. 실시간 상태는 플레이 중 바뀌므로 이를 키로 하는 표는 `liveTrack`처럼 실시간 읽기입니다. 실시간 상태가 생기기 전에 계산하는 값은 직접이든 다른 파생 값을 거쳐서든 이를 읽을 수 없습니다. 키가 `state`가 아니라 `liveState`인 이유입니다. 실시간 상태를 읽는 키에는 모두 `live`가 붙으므로 작성자와 가져오기 모두 최댓값이 무엇을 쓸 수 없는지 구분할 수 있습니다.
- 숫자를 주사위에 반영하려면 `resolution.adjust`가 이를 가리키게 하세요(시트의 수정치 참고). Ember Roads는 Stance를 모든 Brawn 굴림에 더하고, Gravewatch는 닫히거나 꺼진 등불만큼 모든 Nerve 굴림에서 뺍니다.
- 레이어는 표에 행이 있는 필드에서 값을 제외할 수 있습니다. 레이어가 켜져 있는 동안 그 행은 읽히지 않을 뿐입니다.

실시간 상태, `enumTable`, `state`를 지정한 휴식 단계는 패키지 규칙 집합에서 Capability API 1.42입니다.

### 부상 트랙: 숫자 대신 트랙인 체력

체력을 세지 않는 시스템도 많습니다. 점점 나빠지는 칸의 열을 만들고 다칠 때 표시합니다. `live.tracks` 항목에 `kinds`와 함께 이름 붙은 `levels` 또는 번호가 붙은 `boxes`(아래 참고)를 주면 범위 숫자가 아닌 이런 형태가 됩니다.

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
- 둘은 함께 있어야 합니다. `levels`나 `boxes` 없는 `kinds`는 표시할 곳이 없어 거부하고, `kinds` 없는 `levels`나 `boxes`는 표시에 종류가 필요하므로 거부합니다. 트랙은 `levels`와 `boxes` 중 하나만 가지며 둘 다 가질 수는 없습니다.
- **두 용어를 구분하세요.** `kinds`는 표시가 될 수 있는 종류를 규칙 집합이 정의한 것입니다. 표시는 플레이 중 그 종류 하나가 트랙에 놓인 것입니다. 정의는 종류를, 시트는 표시를 가집니다.
- 부상 트랙은 표시 없이 시작하므로 `min`은 0입니다. 이름 붙은 단계가 있는 트랙은 단계 수만큼 길어 `max`가 `levels.length`이며, 다르게 선언하면 조용히 수정하지 않고 거부하므로 서로 다른 길이 둘을 파일에 두지 않습니다. 칸으로 된 트랙은 자체 `max`만큼 길며, 이 값은 시트가 계산하는 값일 수 있습니다(아래 번호 칸 참고).

모호하게 이해하면 잘못된 트랙이 되므로 **정확한 규칙**을 설명합니다.

- 표시는 **가장 심한 것부터** 정렬합니다. 일곱 단계 트랙은 최대 일곱 표시를 담습니다.
- 표시는 끝에 붙이지 않고 기존 표시 사이에 **심각도 순서로 배치**합니다. 그 심각도가 차지할 수 있는 가장 높은 단계를 차지하고 가벼운 표시를 아래로 밉니다.
- 적용 페널티는 표시들의 합이 아니라 **표시된 가장 아래 단계**의 값입니다. 위 트랙의 표시 셋은 `0 + -1 + -3`이 아니라 `-3`입니다.
- `amount`는 한 종류의 표시 개수이며 **하나씩 적용**합니다. 도중에 가득 찬 트랙도 처음부터 가득 찬 것과 같은 규칙을 따릅니다.
- **가득 찬** 트랙에 표시하면 새 표시를 더하지 않고 **가장 가벼운 표시를 한 단계 올립니다**. 새 표시 종류와 무관하게 자체 종류 순서에서 한 단계입니다.
- 최고 심각도를 넘게 될 표시는 최고에 머물며 들어가지 못한 것은 **초과분**으로 셉니다. 초과분도 저장하여 새로고침으로 이미 받은 피해를 잊지 않습니다.
- **회복은 같은 명령에 음수를 씁니다.** 표시보다 초과분을 먼저 지웁니다. 트랙의 종류 하나를 지정한 회복은 그 종류의 표시만 지우므로, "타격성은 낫고 치명성은 남는다"는 음수 양과 함께 `kind="bashing"`을 씁니다. 트랙에 있는 종류를 지정하지 않은 회복은 가벼운 표시부터 지웁니다.

**플레이 중 표시하기.** Game Master는 `[sheet: op="damage" track="harm" kind="knock" amount="1"]`를 쓰고 음수 `amount`로 회복합니다. 칸 단위로 채우는 트랙에서는 타격이 들어갈 칸을 `box="3"`으로 덧붙입니다. 대신 `pool=`을 지정하는 기존 `damage`는 그대로입니다. 숫자만으로 새 표시 종류를 알 수 없어 부상 트랙에는 일반 `track` 명령을 거부합니다. 시스템이 기대하는 대로 플레이어도 시트에서 직접 표시하고 지울 수 있습니다.

**전투도 표시할 수 있습니다.** `combat.health`를 풀 대신 트랙에 지정하면 명중 타격이 `combat.damageKinds.marks`가 정한 칸 수에 해당 블록이 피해 타입을 대응시킨 종류의 표시를 남깁니다. 트랙이 가득 차면 캐릭터가 쓰러지며 죽음 규칙이 이를 읽습니다. 칸 단위로 채우는 트랙에서는 `per-point` 피해가 들어갈 칸을 지정하고 `per-blow`는 첫 칸을 겨누며, 어느 칸도 받을 수 없는 타격은 캐릭터를 쓰러뜨립니다. 이런 트랙을 쓰는 시스템에서 전투 불능이 뜻하는 바가 그것입니다. 회복은 종류와 관계없이 가장 가벼운 표시 하나를 지웁니다. 임시 점수를 둘 버퍼가 없으므로 임시 점수는 거부합니다. Engine은 트랙을 남은 단계 수로 읽으므로 전투의 다른 부분, 쓰러짐, 소생, 로그와 요약은 그대로입니다.

**휴식도 부상 트랙을 회복할 수 있습니다.** `"to"`로 트랙을 지정한 회복 단계는 초과분을 포함해 지정한 표시 수까지 줄입니다. 음수 `"by"`로 지정한 단계는 초과분부터 그 개수만큼 지우므로 `"by": { "const": -2 }`는 두 개를 지웁니다. `kind`도 지정한 단계는 그 종류의 표시만 지웁니다. Gravewatch의 "Catch your breath"는 `{ "track": "harm", "kind": "knock", "to": "min" }`이며 타박은 고치고 찢긴 상처는 남깁니다. 휴식은 피해를 표시하지 않으므로 표시를 더하게 되는 단계는 아무것도 하지 않습니다. 양수 `"by"`도 마찬가지이며 아무 알림 없이 건너뛰므로 빼기 기호를 꼭 쓰세요.

#### 이름 붙은 단계 대신 번호 칸

캐릭터가 강인한 만큼 트랙이 길어야 한다면 `levels` 대신 `boxes`를 주세요. 칸 수는 자체 `max`와 같으며, 이 값은 시트가 계산하는 값일 수 있고(실시간 상태를 읽는 값은 불가) 최대 64입니다.

```json
{
  "id": "strain",
  "label": "Strain",
  "min": 0,
  "max": { "derived": "strain_boxes" },
  "boxes": {
    "penalty": {
      "by": "remaining",
      "table": [
        [0, -1],
        [1, 0]
      ]
    }
  },
  "kinds": [{ "id": "strain", "label": "S", "severity": 0 }],
  "fill": "indexed",
  "onFull": "refuse"
}
```

- 적용 페널티는 `filled` 또는 `remaining` 칸 수를 기준으로 `table`(파생 값과 같은 단계 표이며 페널티는 0 이하)에서 읽습니다. 그 숫자가 무엇이든 읽으므로 표시가 하나도 없어도 비용이 있을 수 있습니다. 어느 칸에 표시했는지와는 무관합니다.
- 칸에는 번호가 붙습니다. 시트는 "Box 3"으로 표시하고, Game Master의 시트 블록은 단계 이름 대신 전체 칸 중 몇 칸이 표시되었는지 알려 줍니다.

#### 칸 지정 채우기와 거부하는 트랙

- `"fill": "indexed"`는 명령이 `box=`로 지정한 칸(지정하지 않으면 첫 칸)이나 그 위의 다음 빈칸에 표시하며, 한번 놓인 표시는 옮기지 않습니다. 회복은 가장 가벼운 표시 중 가장 높은 칸의 것을 지웁니다. 시트 화면에서 플레이어는 비어 있는 어느 칸이든 클릭할 수 있습니다.
- `"onFull": "refuse"`는 빈칸이 없을 때 가장 가벼운 표시를 올리는 대신 표시를 거부합니다. 명령 전체를 거부하므로 빈칸이 둘일 때 표시 셋은 하나도 들어가지 않습니다. 칸 지정 트랙은 항상 거부하므로 함께 `"onFull": "refuse"`를 명시하세요.

#### 목록이 더하는 단계

이름 붙은 단계가 있는 트랙에 `"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }`를 주면 시트의 목록이 캐릭터마다 트랙을 늘릴 수 있습니다. 각 행은 순서대로 자기 개수만큼의 단계(최대 16)를 자기 페널티로 더하며, 페널티가 그와 같거나 더 나은 마지막 단계 뒤에 놓입니다. 페널티가 같으면 그 단계 이름을, 다르면 페널티를 이름으로 씁니다. Gravewatch의 흉터가 이렇게 작동합니다. 시트가 숨긴 목록은 아무것도 더하지 않으며, 단계에 표시가 있는 상태에서 행을 삭제하면 더 이상 들어가지 않는 표시는 초과분으로 보존합니다. 시트를 편집한다고 피해가 없어지지는 않습니다.

`boxes`, `fill`, `onFull`, `extra`, 휴식 단계의 `kind`는 패키지 규칙 집합에서 Capability API 1.40입니다.

### 굴림 페널티

`resolution.penaltyFrom`은 이 규칙 집합의 모든 판정에 페널티를 적용할 부상 트랙을 지정합니다. 추정하지 않고 선언하므로 생략한 규칙 집합은 부상 트랙 도입 전과 같은 방식으로 굴립니다.

페널티의 작용은 시트 숫자와 마찬가지로 판정 종류가 정합니다.

- `dice-pool`은 **풀에서 주사위를 빼고** 자체 `pool.min`을 하한으로 합니다. `pool.min`이 1이면 맨 아래 단계도 한 개를 던지며, `pool.min`이 0이면 아무것도 던지지 않고 실패합니다.
- `dice-sum`은 **굴림의 고정 수정치**이며 능력치와 훈련이 더하는 숫자에 합칩니다.

지정한 트랙은 부상 트랙이어야 합니다. 일반 트랙에는 적용할 페널티가 없어 가져올 때 거부합니다. 결과는 적용 페널티를 알려 주사위가 줄어든 이유를 보여 주며 Game Master의 시트 블록도 단계와 비용을 표시합니다.

### 시트의 수정치

시트의 일부 숫자는 관련된 모든 굴림에 따라붙습니다. 무거운 짐은 모든 등반에, 방어구 페널티는 모든 은신에, 축복은 모든 것에 붙습니다. `resolution.adjust`가 이를 선언하며 두 종류 모두에서 쓸 수 있습니다.

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value`는 파생 값이 읽는 것과 같은 형태의 시트 값이며 실시간 상태도 포함합니다. 음수는 뺍니다. Ember Roads는 캐릭터가 챙긴 장비의 부피를 Burden으로 합산하고, 단계 표가 그 3마다 각 Brawn 굴림에서 1을 뺍니다. 형태나 자세가 주사위에 반영되는 방법은 실시간 상태를 키로 하는 표입니다(실시간 상태 참고).
- `abilities`는 선택 사항입니다. 지정하면 그 능력치 중 하나로 굴리는 판정에만 적용됩니다. 능력치 자체, 그 능력치를 쓰는 기술이나 내성, `with=`로 그 능력치와 함께 굴린 기술, 그 능력치를 포함한 능력치 쌍입니다. 생략하면 모든 판정에 적용됩니다.
- 부상 페널티와 같은 위치에 적용합니다. 풀에서는 같은 `pool.min` 하한 아래에서 주사위로, 합산에서는 기록이 합산하는 수정치 안의 고정 숫자로 적용합니다. 항목은 최대 여덟 개이며 판정마다 합산합니다.
- 규칙 집합 전투는 전투가 시작될 때 시트로 만드는 모든 굴림에 이를 더합니다. 능력치나 기술로 굴리는 공격, 내성, 능력치·기술·내성에서 읽는 겨루기 판정과 우선권은 그 능력치의 항목을 받고, 그 밖에 굴리는 것은 모든 굴림에 적용되는 항목만 받습니다.
- 시트가 없는 캐릭터는 수정치를 받지 않는 것과 마찬가지로 이것도 받지 않습니다.

결과는 시트가 더한 값을 알려 주므로(기록의 `adjust="-2"`와 주사위 카드의 한 줄) 플레이어가 굴림 결과의 이유를 알 수 있습니다. 패키지 규칙 집합에서 Capability API 1.38입니다.

### 휴식

휴식은 회복 단계와 지울 것의 목록입니다. 각 단계는 대상 하나(`pool`, `poolGroup`, `listPools`, `track`, `state`)를 지정하고 값을 설정하거나(`"to": "max"`, `"to": "min"`, 숫자) 변경합니다(`"by": { "const": 1 }`, `"by": { "fractionOfMax": 0.5 }`). 부상 트랙 단계는 회복만 할 수 있으므로 `by`가 음수이며 위에서 설명합니다. 실시간 상태 단계는 `"default"`나 그 값 중 하나로 설정만 합니다. `fractionOfMax`가 있는 `poolGroup` 단계는 그룹의 각 풀을 각자의 비율만큼 바꿉니다. `"shared": true`(Capability API 1.77)를 더하면 대신 그룹 전체의 최대치로 비율을 계산하고, 시트가 나열한 순서대로 그룹의 풀에 각자 부족한 만큼까지 나눠 줍니다. 주사위 종류마다 풀 하나에 담는 히트 다이스의 "캐릭터 총수의 절반"을 회복하는 5e의 긴 휴식은 `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`입니다.

### Game Master 텍스트

- `checkGuidance`는 Game Master에게 판정 요청 방법을 알려 주는 내장 문단을 대체합니다. 어떤 시스템이며 언제 굴릴지 쓰세요. Game Master는 기술과 난이도만 지정하며 Engine이 시트로 계산하고 굴리므로 모델에게 계산을 요구하지 마세요.
- `sheetGuidance`는 프롬프트에서 시트를 소개합니다. 중요한 자원과 소비 시점을 설명하세요.
- `worldGuidance`는 선택 사항이며 세계 생성 시 한 번만 읽습니다. 화약 없음, 희귀한 마법, 걸어 다니는 망자 등 GM이 만드는 세계관을 규칙에 맞춥니다. 턴에는 들어가지 않습니다.
- `sheetSummary`는 캐릭터마다 GM에게 보일 필드, 파생 값, 목록 행을 고릅니다. Engine은 능력치 수정치, 훈련된 기술과 내성, 실시간 값을 항상 표시합니다. 매 턴 보내므로 나머지는 짧게 유지하세요. 요약 목록의 `nameColumn`은 텍스트 열이나 열거형 열일 수 있으며(열거형은 값의 라벨을 표시), `columns`는 이름 뒤에 출력할 행 자체의 열을 최대 세 개 더 지정합니다. 따라서 블록에 이름만 나오지 않고 `Gear: Crowbar 1d6`처럼 나옵니다. 불리언 열은 설정되어 있으면 라벨을 출력합니다. 둘 다 패키지 규칙 집합에서 Capability API 1.37입니다.
- `sheetGuidance`에서 시트 명령을 가르칠 필요는 없습니다. Engine이 파일이 선언한 이름으로 모든 명령을 직접 가르치며, 규칙 집합에 부상 트랙이 있으면 표시용 `op="damage"` 명령을 추가하고 그 단계와 피해 종류를 나열합니다. 실시간 상태가 있으면 `op="state"` 명령을 추가하고 각 상태가 가질 수 있는 값을 나열합니다.

### 전체 GM 규칙 참고 자료(Capability API 1.145)

선택적 **최상위** `gmReference`는 Game Master를 위한 규칙 집합의 전체 규칙 참고 자료를 최대 16,000자까지 담습니다. 확장된 재정 규칙은 여기에 두고, 짧은 판정·자원 지시는 `gm.checkGuidance`와 `gm.sheetGuidance`에 두세요. 이 필드들과 `gm.worldGuidance`에는 여전히 1,500자 제한이 있으며, 레이어 지침도 기존 제한을 유지합니다.

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

참고 자료는 안정적인 시스템 프롬프트의 **Game Master rules reference** 아래에 요청마다 한 번 나타납니다. 턴별 리마인더에는 복사하지 않습니다. 다른 프롬프트 안전 텍스트처럼 제어 문자, 대괄호, 매크로 중괄호(`{{`와 `}}`) 없이 한 줄이어야 합니다. 평소의 대화 기록·답변 예산 조정 뒤에도 요청이 컨텍스트 제한을 넘으면, 핵심 지시를 자르기 전에 잘렸다는 표시와 함께 참고 자료를 줄입니다. 기존 프롬프트를 유지하려면 설정하지 마세요. 이를 쓰는 패키지는 매니페스트에 `schemaVersion: 2`와 `capabilityApi: { "major": 1, "minor": 145 }` 이상을 선언해야 합니다.

## 파티와 장면의 진행 시계(`clocks`)

Capability API **1.143**은 선택적 최상위 `clocks` 객체를 추가합니다. 생략하면 시계 명령은 꺼진 상태로 남습니다. 객체는 엄격하여 다음 세 키만 받습니다.

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes`는 2~12 사이의 서로 다른 정수 칸 수를 1~6개 허용하며 기본값은 `[4, 6, 8]`입니다. `max`는 한 번에 유지하는 시계의 최대 수로 1~12이며 기본값은 8입니다. 선택적 `text`는 GM이 언제 시계를 만들고 칸을 채울지 설명하는 최대 400자의 프롬프트 안전 한 줄입니다. 빈 객체는 기본값으로 켭니다.

시계는 캐릭터가 아니라 파티와 장면에 속합니다. GM 리마인더는 매 턴 시계의 이름과 채운 정도를 나열하고 다음 명령을 가르칩니다.

- `[clock: name="Alarm raised" size="6"]`는 빈 시계를 만듭니다. 허용되지 않은 크기, 이미 있는 이름(대소문자 구분 없음), `max` 도달 시에는 생성을 거부합니다.
- `[clock: name="Alarm raised" tick="2"]`는 칸을 더 채웁니다. 음수는 칸을 비우며, 채운 양은 `0..size` 범위로 제한합니다. 가득 찬 시계는 완료된 것으로, 계속 표시되며 지울 때까지 `max`에 포함됩니다. 음수로 칸을 비우면 다시 열 수 있습니다.
- `[clock: name="Alarm raised" clear]`는 지정한 시계를 없앱니다.

이름은 큰따옴표, 대괄호, 제어 문자, 매크로 중괄호가 없는 1~100자의 한 줄입니다. 각 태그는 정확히 하나의 동작을 요청합니다. 명령은 답변 순서대로 적용하므로 한 답변에서 시계를 만들고 칸을 채울 수 있습니다. Engine은 각 태그를 `result="ok" now="4/6"`(또는 `now="cleared"`)이나 `result="refused" reason="..."`로 다시 씁니다. 모델이 쓴 결과 속성은 버립니다. 알 수 없는 시계와 잘못된 요청은 거부하며, 답변 하나에 명령은 최대 40개까지 적용합니다.

Game Mode는 파티 상태 옆에 칸으로 나뉜 원, 이름, 채운 정도를 표시합니다. 태그는 저장된 답변에 영수증으로 남고 서술에서는 숨겨집니다. 시계는 각 게임 상태 스냅샷에 `rulesetClocks`로 저장되며, 데이터가 없으면 시계가 없는 것입니다. 재생성은 이전 스냅샷에서, 이어 쓰기는 현재 스냅샷에서 시작하며, 스와이프나 메시지를 선택하거나 제거하면 그 스냅샷의 나머지와 함께 시계도 복원합니다.

## 파티 시트: 크루, 우주선, 공유 Story Points

Capability API **1.144**는 `sheet` 옆에 선택적 최상위 `party`를 추가합니다. 게임마다 공유 시트 하나를 담으며, Blades의 크루, Lasers & Feelings의 우주선, Genesys의 Story Points 등이 해당합니다.

```json
"party": {
  "label": "Crew",
  "fields": [
    { "id": "heat", "label": "Heat", "type": "number", "min": 0, "max": 9, "default": 0 },
    { "id": "vault", "label": "Vault capacity", "type": "number", "min": 0, "max": 16, "default": 8 },
    { "id": "upgrades", "label": "Upgrades", "type": "text", "maxLength": 400 }
  ],
  "pools": [{ "id": "coin", "label": "Coin", "max": { "field": "vault" }, "start": "empty" }],
  "advancement": { "fields": ["heat", "vault", "upgrades"], "text": "Record heat after a score." },
  "text": "Coin belongs to the crew."
}
```

`fields`는 `sheet.fields`와 같은 필드 스키마를 쓰고, `pools`는 `start`, `group`, `hideWhen`, `allowTemp`를 포함해 `sheet.live.pools`와 같은 스키마를 씁니다. 필드나 풀이 하나 이상 필요하며 ID는 파티 시트 안에서 고유해야 합니다. 캐릭터와 파티의 ID는 겹쳐도 됩니다. 이 마이너 버전에서 파티 시트에는 구역, 목록, 능력치, 파생 값, 캐릭터 시트 마이그레이션이 없습니다. 풀의 `max`는 상수나 파티의 숫자 필드를 읽습니다. 캐릭터 공식은 파티 값을 읽을 수 없고, 파티 공식은 캐릭터 값을 읽을 수 없습니다. `hideWhen`도 파티 필드만 지정합니다.

`advancement.fields`는 GM이 영구히 바꿀 수 있는 number, text, longtext 필드를 지정합니다. `advancement.text`와 `text`는 각각 최대 400자의 프롬프트 안전 한 줄을 받습니다. 선택적 `summary`는 `gm.sheetSummary`를 재사용합니다. `fields`는 파티 필드를 고르며 `derived`와 `lists`는 비어 있어야 합니다. 요약이 없으면 보이는 파티 필드를 모두 표시합니다. 풀은 항상 나타납니다.

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"`는 공유 시트를 고르며 `who`는 생략합니다. 기존 `who="party"`는 여전히 모든 **캐릭터**에 적용되며 공유 시트는 바꾸지 않습니다. 이 마이너 버전은 파티 시트에서 `spend`, `restore`, 필드 `advance`를 허용합니다. 알 수 없는 시트, 지원하지 않는 동작, 부족한 풀, 선언하지 않은 성장, 잘못된 값은 거부하고 Engine의 결과로 다시 씁니다. 파티 풀은 캐릭터 풀과 같은 현재값/최대값 계산과 기본값을 따릅니다.

GM은 매 턴 캐릭터 시트 블록 옆에서 파티 라벨, 필드, 풀을 받습니다. Game Mode는 캐릭터 초상화 옆에 같은 시트 표시를 쓰는, 접을 수 있는 읽기 전용 파티 시트를 제공합니다. 영구 값은 채팅 메타데이터(`gamePartySheet`)에 `gameCharacterCards`와 나란히 한 번만 저장되며 성장 영수증을 공유합니다. 실시간 풀은 `rulesetLive`의 예약된 `$party` 항목을 쓰며, 정규화된 캐릭터 이름은 이와 겹칠 수 없습니다. 재생성은 답변 이전 상태에서 시작하며, 스와이프 선택이나 삭제는 기존 기록을 통해 영구 값과 실시간 값을 모두 복원합니다. `party`가 없는 규칙 집합은 기존 동작을 유지합니다.

**공유 파티 생성(Capability API 1.163).** 파티 시트는 `lists`(최대 12개이며 캐릭터 시트의 목록처럼 작성), 자체 안내형 `builder`, `fromMembers`를 가질 수 있습니다. 이는 파티의 캐릭터에서 읽는 파티 숫자 필드 최대 8개이며, 각각 `{ "field", "count": true }`(캐릭터 수) 또는 `{ "field", "sum": "<character number field>" }`(Totem 점처럼 캐릭터들의 값을 합한 것)입니다. 구성원 필드는 공유 시트를 읽을 때마다 그 시점의 캐릭터로 계산하므로 캐릭터가 합류하거나 떠나면 즉시 바뀝니다. 목록이 있으면 파티 `summary.lists`가 이를 지정할 수 있습니다.

빌더는 캐릭터의 빌더와 똑같이 작성하며(풀, 단계, 가격이 붙은 행, 소비 제안, 프로필), 파티 자체 필드와 목록을 기준으로 같은 규칙을 따릅니다. 카탈로그 단계와 행 복사 단계는 파티 목록에 공급하는 규칙 집합의 카탈로그를 읽을 수 있습니다. Game Mode에서는 어느 플레이어든 공유 시트의 Edit를 열 수 있으며, 여기서 안내형 설정을 제공하고 파티 전체를 위해 저장합니다. 각 저장은 그것을 연 시점의 리비전을 지정합니다(채팅 메타데이터의 `gamePartySheetRevision`이며 모든 저장과 이야기 자체의 변경이 올림). 다른 사람의 저장이 반영되기 전에 연 저장은 거부하고 더 새로운 시트를 보여 주며, 플레이어의 초안은 열린 채로 남으므로 다시 저장해 교체할지는 플레이어가 고릅니다.

```json
"party": {
  "label": "The Crew",
  "fields": [
    { "id": "tier", "label": "Tier", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "size", "label": "Crew size", "type": "number", "min": 0, "max": 12, "default": 0 }
  ],
  "lists": [{ "id": "upgrades", "label": "Upgrades", "columns": [{ "id": "name", "label": "Name", "type": "text" }] }],
  "builder": { "steps": [{ "id": "upgrades", "label": "Upgrades", "kind": "rows", "list": "upgrades" }] },
  "fromMembers": [{ "field": "size", "count": true }]
}
```

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
- `holds`: `"rows"`(기본값이며 이 릴리스 전 모든 카탈로그의 형태), `"creatures"`, `"items"` 중 하나입니다. 생물 카탈로그는 전투가 읽는 도감이고, 아이템 카탈로그는 파티가 지니는 물건을 나열합니다. 둘 다 시트에 쓰지 않고 `feeds`를 선언하지 않으며 선택기에 나오지 않습니다. 아래 [생물](#creatures-a-bestiary-a-fight-reads)과 [아이템](#items-what-a-party-carries)을 참고하세요.
- `feeds`: 카탈로그 항목이 쓸 수 있는 시트 목록 1~8개입니다. 행 카탈로그에는 필수이고 생물이나 아이템 카탈로그에는 금지됩니다. 여기 없는 목록이나 목록 열이 담지 못하는 값은 쓸 수 없습니다.
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
- `scaled` 행은 항목이 그 목록에 쓰는 유일한 행이어야 합니다. 그래야 시트의 표시된 행이 항상 한 명세와 일치합니다. 또는 (Capability API 1.92) 항목이 그 목록에 쓰는 모든 행이 목록의 이름 열(풀의 `nameColumn`, 없으면 첫 텍스트 열)에 자체 이름을 가져야 합니다. 그러면 시트의 행은 그 이름으로 명세와 연결되므로, 특성 하나가 각자 따로 늘어나는 사용 횟수 두 개를 줄 수 있습니다. 플레이어가 이름을 바꾼 행은 그대로 둡니다.

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

항목에는 수치상의 효과를 설명하는 선택적 `mechanics` 블록을 넣을 수 있습니다. 지원 항목은 `kind`(`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount`(`2d6` 같은 주사위 또는 고정 수치), `amountAdd`(사용자의 시트에서 읽어 양에 더하는 값. 1d10에 파이터 레벨을 더하는 Second Wind라면 `{ "field": "level_fighter" }`입니다. `amount`가 필요하고 규칙 집합 자체 전투에서만 읽으며(Engine의 Classic과 Tactical 전투는 적힌 양 그대로 씀), Capability API 1.83입니다), `damageType`, `attackRoll`, `autoHit`, `save`(시트의 내성 판정 하나와 성공 시 효과), `applies`(대상에게 부여하는 상태), `temporary`(체력 풀의 임시 점수), `scales`(시트에 따라 증가하는 양), `cost`(사용할 때 소모하는 풀), `perCostStep`, `targetsPerCostStep`, `budget`(소모하는 행동 체계의 부분), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider`, `check`입니다.

적을 겨누는 공격은 `summons`(Capability API 1.122)로 이후 턴에 공격할 무언가를 남길 수 있습니다. Spiritual Weapon이라면 공격 항목에 `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }`를 넣으세요. 시전이 첫 공격을 하고, 반응이 끝나면 첫 대상 옆에 무기를 남깁니다. 취소된 시전은 아무것도 남기지 않습니다. 이후 타격은 선언한 행동 체계 예산만 쓰고, 피해 증가에는 시전의 지불 단계를 유지하며, 같은 반응 창을 엽니다. 거리는 카탈로그 단위를 씁니다. 이동을 생략하면 0, 근접 거리를 생략하면 한 칸입니다. 보드에서는 벽을 무시하고 이동 거리에 근접 거리를 더한 범위 안의 적을 공격할 수 있으며 그 옆으로 움직입니다. 보드가 없으면 서 있는 모든 적이 닿는 거리에 있습니다. 라운드는 시전한 턴을 빼고 보유자의 턴이 끝날 때마다 줄어듭니다. 소환물은 0이 되거나, 보유자가 패배하거나, 항목의 집중이 끝나면 사라집니다. 같은 항목을 다시 시전하면 그 소환물을 교체합니다.

`area`가 있는 항목은 `zone`(Capability API 1.172)으로 머물 수 있습니다. 형태는 `{ "rounds", "anchor", "triggers", "atCast" }`입니다. 시전자의 턴으로 `rounds`(1~1000)만큼 유지되며 소환물처럼 세고, 그것을 유지하는 집중이 끝나거나 시전자가 패배하면 더 일찍 끝납니다. `anchor: "point"`(기본값)는 시전한 칸에 머뭅니다. `anchor: "caster"`는 시전자를 따라다니는 시전자 주위의 폭발이므로 사거리가 0입니다. `triggers`는 생물 하나에게 항목 자체의 효과(amount, plus, save, applies)를 다시 일으키는 때를 지정합니다. `enter`(영역 안으로 들어오거나 시전자가 들고 다니는 영역이 그들에게 닿을 때), `turn-start` 또는 `turn-end`(영역 안에서 턴을 시작하거나 끝낼 때)입니다. 생물은 계기와 관계없이 턴마다 한 번만 걸리며, 시전 자체가 휘말리게 한 대상은 그 턴에 걸린 것으로 셉니다. 누구를 휘말리게 하는지는 항목을 따릅니다. `friendlyFire: false`는 시전자 편을 제외하고, 회복이나 아군 항목은 시전자 편에만 적용하며, 시전자가 들고 다니는 영역은 시전자를 휘말리게 하지 않습니다. `atCast: false`는 나타날 때 아무 일도 하지 않습니다. 항목을 다시 시전하면 그 영역을 교체합니다. 보드는 영역 칸에 색을 입히고, 전투는 남은 턴과 함께 영역을 나열하며, 로그는 걸릴 때마다 알립니다. 보드 밖에서는 시전 대상을 붙잡아 두고 `turn-start`와 `turn-end`가 그들을 휘말리게 합니다.

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

Cloudkill이 이렇습니다. Spirit Guardians는 `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false`와 `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`이며, Moonbeam은 `"triggers": ["enter", "turn-start"]`가 있는 5피트 폭발입니다.

한 지점에 머무는 영역은 움직이고 지면을 바꿀 수 있습니다(Capability API 1.173). `move: { "budget", "distance" }`는 시전자가 자기 턴에 영역을 옮기게 합니다. 전투는 그 예산으로 "Move <zone>"을 제공하며, 걷기처럼 보드에서 중심으로부터 `distance` 이내의 아무 칸이나 고릅니다. `drift: { "distance" }`는 시전자의 턴이 시작될 때마다 영역을 시전자에게서 곧장 멀어지는 방향으로 그만큼 옮기며 보드 가장자리에서 멈춥니다. 어느 쪽이든 이전에는 덮지 않았다가 이제 덮게 된 대상은 `enter`가 정한 대로 휘말립니다. 한 지점에 머무는 폭발만 움직이거나 떠다닙니다. `terrain: { "difficult": true }`는 영역이 휘말리게 하는 대상에게 영역의 모든 칸에 들어가는 비용을 두 배로 만들며(이미 험한 땅은 다시 두 배가 되지 않음), `terrain: { "perDistance": { "every", "amount", "damageType" } }`는 휘말린 대상이 영역 안에서 `every`만큼 움직일 때마다 내성 없이 `amount`(항목 자체와 같이 주사위와 고정 수치)를 주며, 여러 번의 걷기에 걸쳐 셉니다. 로그는 이동, 표류, 피해를 각각 알립니다.

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

Cloudkill은 `"drift": { "distance": 10 }`을 더합니다. Spike Growth는 자체 양이 없는 20피트 폭발로, `"triggers": []`(지면이 하는 일이 전부), `"atCast": false`, `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`입니다.

영역은 휘말린 대상에게 더 많은 일을 할 수 있습니다(Capability API 1.174). `breaksConcentration: true`는 집중 중에 휘말린 생물이 항목의 효과보다 먼저, 항목 자체의 내성 난이도에 대해 규칙 집합의 집중 내성을 굴리게 하고 실패하면 집중을 잃게 합니다. 항목에 `save`가 필요합니다. `damageCap`은 영역이 나타난 뒤 걸린 대상과 지면을 합쳐 총 그만큼의 피해를 주면 영역을 끝냅니다. Sleet Storm은 `"save": { "save": "dex" }`, `"applies": [{ "condition": "prone", "duration": "instant" }]`, `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`가 있는 40피트 폭발입니다. Guardian of Faith는 `"friendlyFire": false`, `"amount": { "flat": 20 }`, `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`가 있는 폭발입니다.

항목이 부여한 상태에서 벗어날 때의 기준은 항목 자체의 내성 난이도일 수 있습니다(1.174). `from.holding`이 그 상태인 겨루기와 함께 `applies` 항목에 `"escapeDc": "save"`를 쓰세요. Web과 Black Tentacles는 `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }`로 포박하며, 포박된 생물의 벗어나기 겨루기는 시전자의 주문 내성 DC를 상대로 굴립니다. 내성 난이도가 없는 것이 부여한 상태는 겨루기가 정한 대로 붙잡고 있는 쪽을 상대로 벗어납니다.

아이템의 `use`도 카탈로그 항목처럼 `concentration`과 `zone`(1.174)을 가질 수 있습니다. 따라서 Cloudkill이나 Moonbeam 주문 두루마리도 지속 범위를 유지하며 읽는 사람의 집중으로 유지됩니다.

옮긴 영역은 들이받을 수 있고, 그 지면은 비용이 더 들 수 있습니다(Capability API 1.175). `move: { ..., "ram": true }`는 영역을 옮긴 목적지를 향해 한 칸씩 곧장 보냅니다. 이전에 덮지 않았던 누군가에게 처음 닿은 칸에서 멈추고, 계기와 관계없이 들이받힌 것처럼 그 대상을 휘말리게 하며, 그 턴에는 다시 옮길 수 없습니다. 걸어 들어온 생물은 계기가 정한 대로만 휘말립니다. Flaming Sphere는 `"triggers": ["turn-end"]`와 `"move": { "budget": "bonus", "distance": 30, "ram": true }`가 있는 5피트 폭발입니다. `terrain.costTimes`(2~10)는 영역 안으로 들어가는 모든 걸음을 일반 걸음 그만큼의 비용으로 만들며, 이미 험한 땅도 그 이상 들지 않습니다. Plant Growth는 `"terrain": { "costTimes": 4 }`입니다. 이것은 `costTimes: 2`에 해당하는 `difficult`를 대체합니다. `terrain.halvesSpeed: true`는 험한 땅 비용에 더해 안에서의 모든 걸음 비용을 다시 두 배로 만듭니다. Spirit Guardians는 `"terrain": { "halvesSpeed": true }`입니다.

주문이 건 속박은 주문이 정한 방식으로만 풀 수 있습니다(역시 1.175). `"from": { "holding": "restrained", "escapable": true }`가 있는 벗어나기 겨루기는 `escapeDc`를 지정한 속박에만 제공되므로, 같은 겨루기로 거미줄은 끊어도 석화는 풀 수 없습니다. `applies[].escapeChecks`는 겨루기 자체의 공격자 판정 대신 그 속박을 풀 수 있는 겨루기 판정을 지정합니다. Black Tentacles는 `"escapeDc": "save", "escapeChecks": ["might", "agility"]`로, Web은 `"escapeChecks": ["might"]`로 포박합니다. `zone.whileHeld: { "condition", "amount", "damageType" }`는 시전자가 건 그 상태에 이미 붙잡힌 채로 영역 안에서 턴을 시작하는 대상에게, 영역 자체 효과 대신 내성 없이 그 양을 줍니다. Black Tentacles의 `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }`가 예입니다.

항목이나 아이템 사용은 치료할 수 있습니다(Capability API 1.176). `ends: { "conditions": [...], "count"? }`는 지정한 순서대로 대상에게서 그 상태들을 최대 `count`개 해제합니다. Lesser Restoration은 `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`입니다. `stabilizes: true`는 죽어 가는 대상을 안정시켜 더 이상 죽음 내성을 굴리지 않게 하며, `dying` 규칙이 있는 전투 블록이 필요합니다. Spare the Dying이 예입니다. `revives: { "withinRounds", "health" }`는 그 라운드 수 이내에 죽은 사람만 겨누며 그 양으로 되살립니다. Revivify는 `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`입니다. 상태를 끝내거나 안정시키기만 하는 항목은 도움이 될 사람에게만 제공되며, 그 밖에 할 일이 없는 `utility` 종류 항목은 치료하는 한 제공됩니다.

범위는 상자가 될 수 있고, 지속 범위는 벽이 될 수 있습니다(Capability API 1.177). `area.shape: "box"`는 한 변이 `size`인 정사각형으로, 가까운 모서리가 겨눈 칸에 놓이고 만든 이에게서 멀어지는 쪽으로 뻗습니다. 만든 이와 나란한 축에서는 대신 그 칸을 중심으로 합니다. `range`가 없으면 만든 이에게 붙어 놓입니다. Web은 사거리 60에 `"area": { "shape": "box", "size": 20 }`입니다. `area.shape: "wall"`은 항상 머무르므로 `zone`이 필요합니다. 길이는 `size`, 두께는 `width`(없으면 한 칸)이며, 겨눈 칸을 지나 만든 이로부터의 선을 가로지르게 놓이거나, 거기서 선택의 `toward` 칸 방향으로 놓입니다. `"ring": <diameter>`는 선택이 `"ring": true`라고 할 때 시전자가 대신 겨눈 칸 주위에 그 지름의 고리로 놓게 합니다. 벽에는 계기가 필요 없습니다. Wind Wall은 나타날 때만 효과를 냅니다. 벽은 옮기거나, 떠다니거나, 만든 이를 따라가지 않습니다. `zone.blocks: ["move", "sight"]`는 벽이 서 있는 동안 그 칸을 걷기, 보기, 또는 둘 다에 대해 막으며, 벽이 세워지는 곳에 선 대상은 가장 가까운 빈칸(같은 거리면 선택한 쪽)으로 옮깁니다. Wall of Stone은 둘 다, Wall of Force는 이동을, Wall of Fire는 시야를 막습니다. `zone.side: { "distance", "triggers" }`는 벽 자체 칸 외에 한쪽 면에서 `distance` 이내의 칸이 자체 `triggers`대로 휘말리게 합니다. 선택의 `side`가 어느 쪽인지 정하며, `near`는 만든 이 쪽(고리면 안쪽), `far`는 반대쪽(고리면 바깥쪽)이고 생략하면 far입니다. Wall of Fire는 `"area": { "shape": "wall", "size": 60, "ring": 20 }`, `"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`입니다.

보는 것이 중요합니다(Capability API 1.178). `combat.senses`는 눈이 볼 수 없는 곳을 보는 감각을 나열하며 각각 `{ "id", "label", "sheet"?, "blind"? }`입니다. 캐릭터의 범위는 `sheet`로 시트에서 읽고(0이면 없음), 생물은 규칙 집합의 거리 단위로 `"senses": { "darkvision": 60 }`처럼 자체 감각을 지니며, `blind` 감각(맹안시, 진동감지)은 눈 없이 작동합니다. 이때 블록에 `combat.distance`가 필요합니다. `obscures`가 있는 영역은 `pierced`에 나열한 감각 중 어느 것도 범위 안에 갖지 않은 이에게서 영역 안의 모든 것과 영역 너머로 보이는 모든 것을 가립니다. Fog Cloud는 `"obscures": {}`, Darkness는 `"obscures": { "pierced": ["blindsight", "truesight"] }`입니다. 이런 영역에는 계기가 필요 없으며, 범위를 세워 두는 것 외에 아무것도 하지 않는 `utility` 항목(Fog Cloud, Darkness, 벽)도 메뉴에 나오고 시전자가 고른 곳에 놓입니다. `unseen`이 있는 `combat.conditions` 항목은 같은 방식으로 보유자를 가립니다. 투명은 `"unseen": { "pierced": ["blindsight", "truesight"] }`입니다. `combat.sight`가 이것이 하는 일을 정합니다. `unseenAttacks: true`는 표적이 공격자를 볼 수 없으면 공격에 이점을, 공격자가 표적을 볼 수 없으면 불리점을 주며, `eyes`는 시각에 해당하는 감각을 지정합니다(상태의 `lacks`가 감각을 지정하듯). 따라서 실명한 생물은 `blind` 감각으로만 봅니다. `seen: true`인 항목이나 생물 행동은 "사거리 내에서 볼 수 있는 생물"이라는 문구처럼 사용자가 볼 수 있는 대상만 고를 수 있습니다. 폭발이나 상자는 `area.copies`(2~10)로 한 번에 여러 개 놓을 수 있으며, 각 사본은 다른 사본과 맞닿고 플레이어가 하나씩 배치합니다. Fire Storm은 `"area": { "shape": "box", "size": 10, "copies": 10 }`입니다. 여러 개 놓은 영역은 시전한 곳에 머뭅니다.

영역은 그 안에 선 대상에게 작용할 수 있습니다(Capability API 1.179). `combat.components`는 무언가를 사용할 때 필요할 수 있는 것을 지정하며 각각 `{ "id", "label" }`입니다(5e의 음성, 동작, 물질). 항목이나 생물 행동은 자체 구성 요소를 `components`에 나열합니다. 영역의 `inside`는 안에 있는 대상에게 `conditions`를 걸고, 머무는 동안 `immune`의 피해 유형을 막아 줍니다. `forbids: { "components": [...] }`는 상태의 `forbids`가 보유자에게 하듯(재갈) 그 구성 요소가 필요한 것을 안에서 쓰지 못하게 합니다. Silence는 `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`입니다. 영역의 `wards: { "catalogs": [...], "maxLevel": N }`은 바깥에서 그 카탈로그의 것을 N레벨 이하로 사용하면 안에 있는 대상을 보호하며, 지불한 레벨로 판단합니다. Globe of Invulnerability는 `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`입니다. 예산을 빼앗는 상태(음수 `flat`의 `budgets`)를 보유자 자신의 턴 중에 걸면 그 턴에서도 빼앗으므로, 턴 시작 시 Stinking Cloud 내성에 실패하면 그 턴의 행동을 잃습니다.

감각과 보기는 더 나아갑니다(Capability API 1.180). 항목이 부여한 상태는 보유자가 행동할 때 끝날 수 있습니다. `"endsWhenHolder": { "attacks": true, "casts": ["spells"] }`는 보유자가 공격하거나 지정한 카탈로그의 항목을 사용하면 상태를 해제하며, `"casts": "spells"`라고 적은 아이템 사용(두루마리, 완드)은 그 카탈로그에서 시전한 것으로 셉니다. 상태를 끝낸 공격이나 주문은 여전히 그 상태를 가진 채 이루어지므로, Invisibility는 그 한 번의 공격에 이점을 주고 이후 사라집니다. 서 있는 영역이 스스로 하는 일은 시전자의 행동이 아닙니다. `combat.conditions`의 상태나 아이템의 `worn` 또는 `carried` 효과는 규칙 집합의 거리 단위로 범위가 있는 감각을 줄 수 있습니다(`"senses": { "darkvision": 60 }`). 그 범위와 보유자 자체 범위 중 긴 쪽이 상태가 유지되는 동안 적용되므로 Darkvision 주문, True Seeing(`{ "truesight": 120 }`), 밤의 고글이 작동합니다. `"cancelsUnseen": true`인 상태는 Faerie Fire가 투명한 대상의 윤곽을 드러내듯, 어떤 상태가 보유자를 가리든 모두가 보유자를 볼 수 있게 합니다. 가리는 영역과 벽은 여전히 가립니다.

보호막, 내성, 괴물의 주문 시전, 두루마리가 더 나아갑니다(Capability API 1.181). 영역의 `wards`는 주문을 지불한 레벨을 비교하지만, `"by": "base"`라고 하면 Globe of Invulnerability처럼 어떻게 지불했든 주문 자체의 레벨을 비교합니다. `"maxLevelPerCostStep": 1`은 보호막 자체 시전이 기본보다 높게 지불한 단계마다 한 레벨 더 막습니다. 항목이나 생물 행동의 `save`는 그 밖에 무엇에 대한 내성으로 셀지 정할 수 있으며(`"against": { "damage": ["poison"] }`이면 독에 `against`하는 내성 수정치가 적용됨), 누가 굴리지 않고 성공하는지도 정할 수 있습니다. Stinking Cloud에 필요한 `"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }`가 그 예이며 하나만 해당해도 됩니다. 생물의 `spellcasting`은 각 항목 자체의 `components` 대신 주문에 필요한 것을 특성 전체나 주문별로 정할 수 있으며, 아무것도 필요 없는 선천적 주문 시전에는 `[]`를 써서 Silence가 막지 못하게 합니다. 아이템 사용이 범위를 세워 두는 일만 하면(Fog Cloud, Darkness, Silence, Globe of Invulnerability 두루마리) `"kind": "utility"`일 수 있으며, `area`와 `zone`이 필요합니다.

밀치기, 바람, 고글(Capability API 1.182). 항목의 `"push": 15`는 맞고 내성에 성공하지 못한 대상을 만든 이에게서 곧장 카탈로그 거리 단위로 15만큼 밀어내며, 단단한 장애물이나 서 있는 누군가 앞에서 멈춥니다. 영역도 휘말린 대상을 같은 방식으로 밉니다. 시전자가 지니는 영역(`"anchor": "caster"`)은 이제 폭발뿐 아니라 직선이나 원뿔일 수도 있습니다. 시전한 방향을 가리키며 시전자를 따라가고, `"turn": { "budget": "bonus" }`는 시전자가 자기 턴에 그 예산을 써서 다른 방향을 향하게 하며, 이제 덮게 된 대상은 영역 안으로 들어온 것처럼 휘말립니다(5e의 Gust of Wind). `"towardCaster": true`가 있는 영역의 `terrain`은 이동자를 시전자에게 가깝게 하는 걸음에만 험한 땅으로 셉니다. 상태나 아이템이 주는 감각은 범위 대신 `{ "add": 60 }`일 수 있으며, 보유자 자체의 그 감각 범위에 더하거나 감각이 없는 이에게 60을 줍니다(5e의 밤의 고글).

나중에 터지거나 불타 사라지는 영역(Capability API 1.183). `"detonates"`가 있는 영역은 서 있는 동안이나 시전될 때 아무것도 하지 않습니다. 집중이 끝나거나, 라운드가 다하거나, 다시 시전되어 끝날 때 안에 있는 모두에게 항목 자체의 효과를 한 번 일으킵니다. `"grows": { "dice": "1d6" }`는 시전한 턴을 포함해 시전자의 턴이 끝날 때마다 양에 그만큼 더하므로, 항목 자체 양과 같은 주사위를 굴립니다. `"touched": true`는 중심으로 들어온 대상이 항목의 내성을 굴리게 하고, 실패하면 터뜨립니다(5e의 Delayed Blast Fireball). 이 영역은 시전한 곳에 머뭅니다. `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }`가 있는 영역은 그 유형 중 하나의 피해가 영역의 어느 칸이나 안에 있는 누군가에게 들어가면 불이 붙습니다. 시전자의 턴이 다시 돌아오면 불타 사라지며 주문이 끝나고, 그사이 영역 안에서 턴을 시작하는 다른 모두에게 내성 없이 그 양을 줍니다(5e의 Web).

생물도 밉니다(Capability API 1.184). 생물의 행동은 카탈로그 항목처럼 규칙 집합 자체 거리 단위로 `"push": 60`을 가질 수 있습니다. 맞은 대상은 생물에게서 곧장 그만큼 밀려나며, `save`가 있으면 실패할 때만 밀립니다. 따라서 `"onSuccess": "none"`은 피해를 유지하고 밀치기와 `applies`가 거는 상태만 면하게 합니다(드래곤 거북의 Tail). 아이템 사용은 길이 60피트, 너비 10피트인 Gust of Wind 두루마리처럼 직선에 `width`를 줄 수 있습니다.

생물의 정체가 더 중요해집니다(Capability API 1.185). 내성은 `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`라고 할 수 있으며, 그런 대상은 두 번 굴려 나쁜 쪽을 씁니다(Sunbeam). 항목의 `"maxAgainst": { "types": ["plant"] }`는 그런 대상에게 피해를 최대치로 줍니다(Blight). `targetTypes`는 점수가 그 이하인 대상을 위한 `"abilityAtMost": { "int": 3 }`(점수 없이 작성한 생물은 제외되지 않음)와 `"notImmuneTo": ["charmed"]`(Sleep)도 가질 수 있습니다. 상태의 수정치는 공격을 두 번 굴리게 할 수 있습니다. `{ "to": "attacks", "mode": "disadvantage", "atSource": true }`는 상태를 건 상대에 대한 보유자 자신의 공격이고(Chill Touch), `{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }`는 그런 공격자가 보유자에게 하는 공격입니다(Protection from Evil and Good). 내성에 대한 변경은 `"against": { "from": { "types": ["dragon"] } }`일 수 있으며, 그 종류의 생물이 한 일에 대한 모든 내성과 일치합니다(Dragon Scale Mail).

생물의 행동은 함께 재충전될 수 있습니다(Capability API 1.186). 각 `"recharge"`에 같은 `"group"`과 같은 주사위를 주면, 하나를 쓰면 둘 다 소모되고 생물의 턴 시작 시 굴림 한 번으로 둘 다 돌아옵니다(금속 드래곤의 두 브레스 무기). 타격은 `"charge"`를 가질 수 있습니다. `{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }`는 이번 턴 생물의 걷기가 명중 대상을 향해 매 걸음 한 칸씩 가까워지며 `atLeast` 이상 곧장 달린 것으로 끝났을 때 절을 더합니다. 그다음 대상은 내성을 굴리고, 실패하면(내성이 없으면 항상) 밀려나며 상태를 받습니다(미노타우로스의 Charge). 돌진은 한 대상에 대한 타격에 붙으며 보드에서만 잽니다.

아이템의 `attack`은 명중하는 대상에 대해 더 많은 것을 정할 수 있습니다(Capability API 1.187). `"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]`는 그런 대상에 대한 명중에 더합니다(mace of smiting). `plus` 절은 `"not": { "types": ["construct", "undead"] }`로 그런 대상을 건너뛰고, `"blow": "ranged"`로 던지거나 쏜 타격에서만(dwarven thrower), `"melee"`로 근접 거리 안의 타격에서만 셀 수 있으며, `"tempHp": true`로 준 피해만큼 사용자에게 임시 체력을 줍니다(sword of life stealing). `onHit` 상태는 `"targetIs"`(거인을 넘어뜨리는 giant slayer)와 `"oncePerTurn": true`(sword of wounding)를 지정할 수 있습니다. `"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]`는 명중 후 체력이 `healthAtMost` 이하로 남은 대상을, 내성이 있으면 내성 실패 시 즉사시키며, 그럴 때 아이템의 충전을 소모합니다(nine lives stealer). `"immuneTo": ["slashing"]`은 그 피해에 면역인 대상을 면하게 합니다(vorpal sword). 체력은 타격의 피해 뒤에 읽습니다.

시트의 `live.conditions`, 휴식의 `clear.conditions`, `combat.conditions`는 항목을 최대 320개 담습니다(Capability API 1.269. 1.188부터 160개, 그 전에는 80개). `to: "attacks"` 수정치는 `"ability": "str"`을 지정해 그 능력치로 하는 공격만 바꿀 수 있고(금색 드래곤의 Weakening Breath), `to: "checks"` 수정치는 `"abilities": ["str"]`을 지정해 그 능력치로 하는 능력치 판정만 바꿀 수 있으며, 그 능력치의 대항 판정과 기술 판정도 포함합니다(바바리안의 Rage). 생물의 능력치 블록 행동은 능력치를 지정하지 않으므로 능력치로 좁힌 공격 수정치는 닿지 않습니다.

`combat.conditions`의 상태는 보유자를 해칠 수 있습니다(Capability API 1.189). `"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }`는 상태를 건 상대로부터, 보유자의 각 턴이 시작될 때(또는 `"turn-end"`) 상태를 끝내는 내성보다 먼저 그 피해를 줍니다. `"stacks": 10`은 상태가 유지되는 동안 그 횟수까지 다시 걸 수 있게 하며, 피해는 겹친 수마다 한 번씩 줍니다(sword of wounding). 상태를 끝내면 모두 끝납니다. `"onePerSource": true`는 출처당 보유자를 하나로 유지합니다. 다른 누군가에게 걸면 같은 출처에서 받은 이전 보유자에게서는 사라집니다(oathbow의 맹세한 적). 아이템 공격의 `against` 항목은 `is` 대신 또는 함께 `"marked": "sworn"`을 지정해 사용자가 건 그 상태를 지닌 대상과 일치시킬 수 있고, `toHit` 외에 `"mode": "advantage"`, `"ignoresCover": true`(완전 엄폐가 아닌 엄폐는 무시), `"ignoresLongRange": true`도 쓸 수 있습니다. `plus` 절도 `"marked": "sworn"`을 쓸 수 있습니다(oathbow의 3d6 관통). 생물의 능력치 블록 행동은 공격에 쓰는 능력치인 `"ability": "str"`을 지정할 수 있으므로, 능력치로 좁힌 공격이나 피해 변경이 닿습니다.

아이템 공격의 `modes` 항목은 무기를 완전히 다른 방식으로 쓰는 것일 수 있습니다(Capability API 1.190). `"range": { "normal": 120 }`은 그 모드에서 닿는 거리로 규칙 집합 자체 거리 단위입니다. `"plus"`는 공격 자체의 절처럼 명중에 절을 더합니다. `"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }`은 공격을 굴리기 전에 사용자와 대상 사이에 선 모두(두 사람 자신은 제외)가 내성을 굴리는 번개 줄기입니다. `"charges": 1`은 아이템 자체 충전을 그만큼 소모하므로, 충전이 있는 동안만 그 모드를 제공합니다(javelin of lightning: 아이템에 `charges.max` 1과 `stack` 1). 직선은 가로지를 보드가 필요합니다.

효과 `"cannot-heal"`을 가진 전투 상태는 유지되는 동안 보유자에게 들어오는 모든 회복을 막고 로그에 알립니다(Capability API 1.191). 5e의 Chill Touch입니다. 전투 상태의 `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]`는 `from`에 해당하는 생물이 걸 때만 그 상태들을 막습니다. 이미 걸린 것은 남습니다(Protection from Evil and Good). 주문의 `targetTypes.abilityAtLeast`는 상한인 `abilityAtMost`에 대응하는 하한입니다. `{ "int": 5 }`는 Intelligence 4 이하의 생물을 건너뛰며(Hideous Laughter), 해당 점수 없이 작성한 생물은 제외되지 않습니다. 내성 수정치의 `against.actions`는 행동을 ID, 이름, 공유 재충전 그룹으로 대소문자 구분 없이 지정하며, `against`의 나머지 조건을 모두 좁힙니다. `{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }`는 드래곤의 브레스나 Frightful Presence이고 Wing Attack은 해당하지 않으며, 그중 하나가 건 상태를 끝내려 반복하는 내성도 포함됩니다.

아이템 공격은 더 많은 부가 효과를 가질 수 있습니다(Capability API 1.192). `"ignoresResistance": true`는 모든 피해에 대한 저항을 포함해 공격 자체 피해 유형에 대한 대상의 저항을 피해가 통과하게 하며, 다른 유형의 `plus` 절은 여전히 절반이 됩니다(vorpal sword의 참격). 면역은 여전히 유지됩니다. `slay` 항목의 `"saved"`는 slay의 내성에 성공한 대상이 대신 받는 상태를 `applies`와 같은 형태로 나열합니다. `[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]`는 mace of disruption이 악마를 사용자의 다음 턴이 끝날 때까지 사용자를 두려워하게 만드는 것입니다. `"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }`는 사용자가 `sworn`을 건 생물이 아직 서 있는 동안 사용자의 다른 모든 무기 공격을 그 모드로 굴리게 하며, `"ranged": true`이면 원거리 공격만 해당합니다(oathbow). 그리고 보드가 없는 전투에서는 범위 행동(생물이나 주문)을 양쪽 편 누구에게나 겨눌 수 있습니다(만든 이 자신은 제외). 범위 안의 각 생물을 휘말리게 하기 때문입니다. `friendlyFire: false`는 보드에서와 마찬가지로 상대편으로 한정합니다.

겨루기는 맞굴림 대신 고정 숫자에 대한 판정일 수 있습니다(Capability API 1.193). `defender`를 생략하고 `"difficulty": 15`를 주세요. 행동자는 `attacker` 판정 중 가장 좋은 것을 굴리고 그 숫자 이상이면 이깁니다. `"targets"`는 누구에게 할 수 있는지 정합니다. `"enemy"`(기본값), `"ally"`, 또는 행동자 자신을 포함한 `"any"`입니다. `"targetHolds": "wounded"`는 그 상태를 가진 대상에게만, `"targetDying": true`는 죽어 가며 아직 안정되지 않은 대상에게만 제공합니다. `onWin.stabilizes`는 죽어 가는 대상을 안정시킵니다. 따라서 sword of wounding의 상처를 끝내는 DC 15 Wisdom (Medicine) 판정은 `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`이고, 죽어 가는 사람을 구하는 DC 10 판정은 `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`입니다. 풀 전투는 성공을 세므로 `difficulty`를 거부합니다. 아이템 공격의 `"healedOnlyByRest": true`는 빼앗은 체력을 봉인합니다. 어떤 회복도 보유자를 최대치에서 봉인된 양을 뺀 값 이상으로 올리지 못하며, 어떤 휴식이든 이를 회복하고 봉인을 지웁니다. 전투 상태의 `harms`도 같은 `"healedOnlyByRest": true`를 받으므로, 검이 남긴 상처가 빼앗는 것도 봉인됩니다.

크기는 한 칸보다 많이 차지할 수 있습니다(Capability API 1.194). `combat.sizes.order`의 항목에 `"cells"` 수를 주면(`{ "id": "large", "label": "Large", "cells": 2 }`), 그 크기의 생물은 보드에서 한 변에 그만큼의 칸을 차지하며 자신의 칸은 왼쪽 위 칸입니다. 5e의 Large는 2, Huge는 3, Gargantuan은 4입니다. 서도록 요청한 곳에서 가장 가까운, 몸 전체가 들어가는 곳에 놓입니다. 근접 거리와 사거리는 차지한 칸 중 가장 가까운 칸에서 재므로 검은 오거의 네 칸 중 어느 칸 옆에서든 닿습니다. 몸 전체가 들어가는 곳으로만 걷고 아무도 그 몸을 지나 걸을 수 없습니다. 범위는 칸 하나라도 안에 있으면 휘말리게 하고, 밀치기는 몸 전체를 옮기며, 시야와 엄폐는 차지한 칸 중 가장 잘 트인 칸을 기준으로 합니다. `cells`가 없는 크기는 이전과 똑같이 한 칸을 차지합니다.

상태는 보유자를 크거나 작게 만들 수 있습니다(Capability API 1.195). `combat.conditions`의 항목에 `"size": { "steps": 1 }`을 주면, 상태가 유지되는 동안 보유자는 `combat.sizes.order`에서 그만큼 뒤의 크기가 되고 음수면 앞으로 돌아가며, 처음이나 끝을 넘지 않습니다. 5e의 Enlarge는 `1`, Reduce는 `-1`입니다. 근접 거리, 그들을 휘말리게 하는 범위, 크기를 묻는 모든 것이 새 크기를 읽으며, 상태가 끝나면 원래 크기로 돌아옵니다. 보드에서 커지는 사람은 서 있던 모든 칸 위로, 다른 누구와도 겹치지 않는 빈 땅에 들어가는 만큼 새 크기를 채우며, 들어가지 않으면 들어가는 가장 큰 크기가 됩니다. 따라서 복도에서 커진 오거는 복도가 허락하는 만큼만 커집니다. 작아지는 사람은 왼쪽 위 칸을 유지합니다. 로그는 누가 무엇으로 바뀌었는지 알려 줍니다. `combat.sizes`가 필요합니다. 무기 주사위에는 `damage` 수정치를, 주문의 나머지에는 Strength `checks`와 `saves` 모드를 함께 쓰세요.

항목은 남은 체력으로 대상을 고를 수 있습니다(Capability API 1.196). `mechanics`의 `"healthPool": { "dice": "5d8" }`은 사용할 때 한 번 굴리고, 남은 체력이 가장 적은 대상부터 위로 나눠 줍니다. 각 대상은 체력이 남은 양 이하일 때만 영향을 받으며 그만큼을 소모하고, 나머지는 전혀 건드리지 않습니다. 5e의 Sleep과 Color Spray가 이렇게 작동합니다. `perCostStep`은 더 높게 시전하면 여기에 더합니다. `"healthAtMost": 150`은 체력이 그 이하인 대상에게만 영향을 주며(Power Word Stun), `"kills": true`는 영향을 받은 대상을 즉사시키므로 Power Word Kill은 `"healthAtMost": 100, "kills": true`입니다. 둘 다 `targetTypes`가 누구를 대상으로 할 수 있는지 정한 뒤 대상의 남은 체력을 읽습니다. 로그는 풀의 굴림 결과와 그것이 누구에게 충분했는지 알려 줍니다.

피해 수정치는 타격 자체의 주사위를 더 여러 번 던질 수 있습니다(Capability API 1.197). 상태에 `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }`를 두면 상태가 유지되는 동안 war pick의 1d8 + 2가 2d8 + 2를 줍니다. 커진 duergar의 무기가 이렇습니다. 고정 부분은 그대로이고, 치명타는 나머지처럼 추가 주사위도 두 배로 하며, 메뉴의 평균도 이를 셉니다. 타격이 주는 피해만 바꾸고 그 밖에는 아무것도 바꾸지 않습니다. 자신의 턴에 한 `"self": true` 생물 행동도 이제 반응에서 이미 그랬듯 생물 자신에게 적용되므로 그 `applies`가 걸립니다.

영역은 나타날 때와 다른 피해 유형을 계기에서 줄 수 있습니다(Capability API 1.198). 자체 `damageType`이 `"piercing"`인 항목에 `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }`를 두면, 벽이 나타날 때 둘러싸인 대상에게는 관통 피해를, 나중에 들어오는 대상에게는 참격 피해를 줍니다. 5e의 Wall of Thorns가 이렇습니다. 항목 자체의 `amount`와 피해를 줄 계기, 면, 들이받기가 필요하며, 규칙 집합이 `combat.damageTypes`를 선언했다면 그중 하나를 지정합니다.

체력 풀은 일부 대상을 건너뛸 수 있습니다(Capability API 1.199). `healthPool` 옆의 `"healthPoolSkips": { "conditions": ["unconscious"] }`는 그 상태 중 하나를 가진 대상을 건드리지 않고 풀도 쓰지 않습니다. 5e의 Sleep이 의식을 잃은 대상을 무시하는 방식입니다. `"unseeing": true`는 항목의 사용자를 볼 수 없는 대상(실명했거나 시선이 닿지 않음)에게 같은 일을 하며, Color Spray가 볼 수 없는 생물을 무시하는 방식입니다. `conditions`, `unseeing` 또는 둘 다를 지정하며 `healthPool`이 필요합니다.

벽은 하나씩 공격받고 부서지는 구획으로 세울 수 있습니다(Capability API 1.200). `"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }`는 5e의 Wall of Ice입니다. 10피트 판마다 AC 12, 체력 30이며 화염 피해를 두 배로 받습니다(`resist`와 `immune`도 같은 방식). 적 하나나 누구든 겨누며 피해를 주는 공격은 대신 구획을 겨눌 수 있습니다. 선택지는 공격할 수 있는 칸을 `walls`로 나열하고, 선택은 그중 하나를 `wall`로 지정합니다. 공격은 생물에 대한 것처럼 굴리고 피해를 주며, 로그는 구획이 받은 피해와 남은 체력을 알려 줍니다. 0이 된 구획은 부서집니다. 더 이상 막지 않으며, 들어오는(또는 `triggers`에 따라 그곳에서 턴을 시작하거나 끝내는) 대상은 턴마다 한 번 그 `amount`를 받고, 항목 자체 난이도에 대해 `save`로 내성을 굴려 성공하면 절반을 받습니다(`onSave: "none"`이면 받지 않음). 구획에는 `blocks`가 있는 벽이 필요하며, 부서진 구획의 `save`에는 항목 자체 `save`가 필요합니다.

항목은 시트의 실시간 트랙을 옮기고 봉인된 체력을 돌려줄 수 있습니다(Capability API 1.201). `"tracks": [{ "track": "exhaustion", "by": -1 }]`는 5e의 Greater Restoration처럼 맞은 대상의 탈진 단계를 하나 내리며, 내성이 있는 항목(Sickening Radiance)의 `"by": 1`은 실패한 대상에게 하나를 더합니다. 각 트랙은 자체 경계로 제한하며, 체력 최대치를 절반으로 만드는 단계는 즉시 적용되고 `defeats`인 단계에 도달하면 죽습니다. `"unseals": true`는 휴식만 돌려줄 체력(`seals` 타격이 빼앗은 것)을 돌려주며, Greater Restoration이 최대 체력 감소를 끝내는 방식입니다. 이렇게 치료만 하는 항목은 도움이 될 사람에게만 제공됩니다. 벽 구획의 `broken`은 자체 `perCostStep`을 가질 수 있으며, 시전이 기본보다 높게 지불한 단계마다 한 번 더합니다. Wall of Ice의 냉기는 `{ "dice": "1d6" }`입니다. 트랙은 부상 트랙이 아닌 일반 트랙이며, `unseals`에는 점수로 관리하는 체력이 필요합니다.

항목이 거는 상태는 그 항목이 거는 다른 상태와 함께 끝날 수 있습니다(Capability API 1.202). 5e의 Hypnotic Pattern인 `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`에서 무력화는 매혹이 끝날 때마다 함께 끝납니다. 내성, 치료, 시전자의 집중 깨짐, 아군이 흔들어 깨우기, 전투 종료가 그 예입니다. 같은 사용으로 건 상태만 함께 끝나며 로그에 이유가 나옵니다. `endsWith`는 같은 `applies` 목록(또는 `onEnd`, `charge`, `saved` 목록)의 다른 상태를 지정하며 자기 자신은 지정할 수 없습니다.

생물의 행동은 대상의 체력 최대치를 낮출 수 있습니다(Capability API 1.203). 레이스의 Life Drain에 `"reducesMax": { "save": "con_save", "difficulty": 14 }`를 두면 타격이 들어갈 때 대상이 그 내성을 굴립니다. 실패하면 받은 피해만큼 체력뿐 아니라 최대치도 줄며, 휴식 전에는 어떤 회복으로도 돌아오지 않습니다. `"lasting": true`(클레이 골렘의 Slam)이면 휴식으로도 돌아오지 않고 `unseals`하는 항목(Greater Restoration)만 돌려줍니다. 이렇게 최대치가 0이 된 대상은 죽습니다. 시트는 어떤 휴식도 돌려주지 않는 양을 `sealed` 안에 풀의 `lasting`으로 보관합니다. 점수로 관리하는 체력이 필요합니다.

치료는 모든 치료가 아니라 그중 하나만 할 수 있습니다(Capability API 1.204). `"cureOneOf": true`이면 상태를 `ends`하고, `tracks`를 옮기고, `unseals`하는 항목(5e의 Greater Restoration: 매혹, 석화, 탈진 한 단계, 최대 체력)은 정확히 하나만 합니다. 각각은 무기의 모드처럼 선택지의 모드로 제공되며(상태, 트랙, 체력 풀을 라벨로 표시), 아무것도 고르지 않은 사용은 대상에게 해당하는 것이 있는 첫 번째 치료를 그 순서대로 찾아 합니다. 고를 치료가 두 개 이상 필요합니다.

낮아진 최대치에는 자체 내성이 필요 없을 수 있습니다(Capability API 1.235). `save`와 `difficulty`가 없는 `reducesMax`는 들어간 모든 타격의 피해만큼 최대치를 낮추며(5e 뱀파이어의 Bite), `"onFailedSave": true`이면 대상이 항목 자체의 내성에 실패했을 때만 낮춥니다(내성이 있는 카탈로그 항목인 5e의 Harm. 이 경우 `reducesMax`에는 자체 내성이 없습니다). `damageType`은 그 유형의 피해만 세고(Bite의 사령 피해), `"heals": true`는 낮춘 만큼의 체력을 사용자에게 돌려줍니다. 카탈로그 mechanics도 `reducesMax`를 받으며, `leavesAtLeast`는 항목의 피해가 대상의 체력을 그 값 아래로 내리지 못하게 합니다(Harm은 1을 남김). 생물 행동이나 카탈로그 mechanics의 `targetHolds`는 겨눌 수 있는 대상을 제한합니다. `conditions` 중 하나를 가진 대상, 또는 행동의 사용자가 건 `fromSelf` 중 하나를 가진 대상입니다(Bite: 뱀파이어에게 붙잡혔거나, 무력화되었거나 포박된 대상).

상태는 보유자에게 자체 사용을 줄 수 있습니다(Capability API 1.236). 전투 상태의 `actions`는 보유자가 상태를 가진 동안 사용할 수 있는 카탈로그 항목(`spells/break-enchantment`)을 나열합니다. 이 항목들은 그때만 메뉴에 나오고, 각각 소모하는 예산 외에는 시트에서 아무것도 들지 않으며, 보유자의 주문처럼 보유자 자신의 수치로 굴립니다(시전하는 생물은 자신의 시전 수치를 씀). `"endsCondition": "<condition>"`이 있는 항목은 사용하면 사용자에게서 그 상태를 끝내고, 그것을 유지하는 집중이 사용자 자신의 것이면 그 집중도 끝냅니다. 5e의 Dispel Evil and Good에서 Break Enchantment와 Dismissal이 각각 주문을 끝내는 방식입니다. `ends.from`(유형과 태그 검사)은 그 검사를 통과하는 생물이 건 것만 치료합니다. Break Enchantment는 천상체, 원소, 요정, 악마, 언데드가 건 매혹이나 공포를 끝내고 다른 누군가가 건 것은 남깁니다. `dismisses`는 맞고 내성에 성공하지 못한 대상을 살아 있는 채로 전투 밖으로, 즉 보드와 턴 순서에서 내보냅니다. 영구히 내보내려면 `true`(Dismissal), 그 상태를 가진 동안만이라면 `{ "while": "<condition>" }`이며, 이 상태는 같은 항목이 걸어야 합니다(5e의 Banishment). 이때 상태의 시계는 시전자의 턴으로 흐르며, 시간이 다하거나, 내성에 성공하거나, 시전자의 집중이 끝나 상태가 끝나면 원래 자리나 몸이 들어가는 가장 가까운 빈 곳으로 돌아옵니다. `gone`(유형과 태그 검사)이 있으면, 그 검사를 통과하고 상태의 전체 시간을 다 보낸 대상은 돌아오지 않습니다.

전투는 일부 참가자가 방심한 채로 시작할 수 있습니다(Capability API 1.237). 누가 그런지는 장면이 정합니다. 전투를 가져온 조우가 파티든 적이든 `"surprised": true`로 표시합니다. 그들은 첫 턴에 움직이거나 행동할 수 없으며 메뉴에는 턴 종료만 있습니다. 그 턴이 끝나거나 첫 라운드가 끝날 때 중 먼저 오는 때까지 반응도 전설 사용도 하지 않습니다. `"cannotBeSurprised": true`인 전투 상태는 보유자가 절대 기습당하지 않게 합니다. 5e의 Foresight입니다. `"ignoresSurpriseWith": "<catalog>/<entry>"`가 있는 카탈로그 항목은 보유자가 기습당한 동안에도 쓸 수 있는 사용을 지정하며, 그것을 쓰면 그 자리에서 기습이 끝나 나머지 턴을 자기 것으로 씁니다. 먼저 분노하여 기습당한 바바리안이 정상적으로 행동하게 하는 5e의 Feral Instinct입니다.

카탈로그 항목은 보유자에게 전투 첫 라운드에 두 번째 턴을 줄 수 있습니다(Capability API 1.238). 시트 목록에 있는 항목의 `"extraFirstTurn": { "initiative": -10 }`은 보유자 자신의 우선권에 그 숫자를 더한 위치, 즉 그 숫자 이상인 모두의 뒤에 두 번째 턴을 둡니다. 두 턴 모두 온전한 턴이며, 두 번째 라운드부터는 평소처럼 라운드마다 한 턴을 합니다. 두 번째 턴이 오기 전에 쓰러진 보유자는 그냥 그 턴을 놓칩니다. `"unlessSurprised": true`이면 기습당한 채로 전투를 시작한 사람에게는 두 번째 턴이 없습니다. 5e의 Thief's Reflexes입니다.

전투 상태는 자신이 주는 예산으로 살 수 있는 것을 근접 거리 안의 휘두르기로 좁히고, 끝날 때 보유자의 트랙에 표시를 남길 수 있습니다(Capability API 1.239). `"grants": { "budget": "bonus", "attacks": true, "melee": true }`이면 그 예산으로 지불하는 타격 한 번은 근접 거리에서 치는 무기로만 하며, 투척 무기는 던지지 않고 휘두르므로 근접 거리 안의 대상에게만 씁니다. 사거리만 있고 근접 거리가 없는 무기는 제공되지 않습니다. `"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }`는 카탈로그 항목의 `tracks`처럼, 상태가 어떻게 끝나든 끝날 때 보유자의 실시간 트랙을 단계만큼 옮깁니다. `applies`와 `tracks`는 함께 쓰거나 따로 쓸 수 있습니다. 카탈로그 항목의 `"usesOf": "<row name>"`은 자체 사용 횟수 대신 그 행의 항목(카운터 행)의 사용 횟수를 씁니다. 그러면 5e의 Frenzy는 Berserker의 항목인 Frenzied Rage가 됩니다. `"usesOf": "Rage"`이며, 분노와, 그것을 `endsWith`하며 위 두 가지를 모두 가진 `frenzied` 상태를 겁니다.

우선권은 두 번 던져 좋은 쪽이나 나쁜 쪽을 쓸 수 있습니다(Capability API 1.240). `combat.initiative.checkAbility`는 우선권이 그 능력치로 하는 판정이라고 정하므로, 그런 판정을 두 번 굴리게 하는 모든 것이 우선권도 두 번 굴립니다. `own-checks-advantage`가 있는 상태(5e의 Foresight)나, 그 능력치로 좁혔거나 아무것으로도 좁히지 않은 `mode`가 있는 `checks` 수정치(Dexterity에 대한 Enhance Ability의 Cat's Grace)입니다. 시트 목록에 있는 카탈로그 항목의 `"initiativeMode": "advantage"`(또는 `"disadvantage"`)는 보유자가 무엇을 가졌든 우선권을 두 번 던집니다. 5e의 Feral Instinct입니다. 이점과 불리점은 다른 굴림처럼 상쇄됩니다. 로그의 우선권 항목에는 `mode`와 버린 던지기(`dropped`)가 남습니다. 매 라운드 우선권을 던지는 전투는 매 라운드 두 번 던집니다. 던지는 주사위에만 적용하며 풀 우선권은 두 번 던지지 않습니다.

반응은 보유자 자신의 공격이 명중한 것에 응답할 수 있습니다(Capability API 1.241). `"by": "self"`가 있는 `"hit"` 반응은 공격자의 굴림이 명중하고 타격을 받은 모두가 응답한 다음 공격자에게 제공되며, 명중당한 대상을 겨눕니다(`"at": "target"`을 쓰세요). `"weapon": true`는 모든 명중 순간을 무기 타격, 즉 카탈로그에서 오지 않은 공격이나 생물의 단일 대상 행동으로 좁힙니다. 자신의 명중에 대한 반응은 이를 고르는 것이 공격의 일부이므로 반응을 막는 것에 막히지 않습니다. 실제로 예산을 쓰지 않는 한 `"free"`로 표시하세요. 5e의 Stunning Strike가 그 예입니다. `"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`, 무료, 기 비용, Constitution 내성, 몽크의 다음 턴이 끝날 때까지 `stunned`입니다. `"addsToBlow": true`이면 공격 항목의 양을 따로 주지 않고 그 타격에 합칩니다. 타격이 들어갈 때 굴리고, 그 치명타로 두 배가 되며, 절은 닿는 대상에게만 적용합니다. 5e의 Divine Smite는 2d8 광휘, `perCostStep` 1d8, `targetIs`가 악마나 언데드인 1d8 광휘 절, `"perCostStepsMax": 3`입니다. 마지막 키는 `perCostStep`이나 `targetsPerCostStep`이 있는 모든 항목에서 셈에 넣는 높은 비용 단계의 최대치입니다. 다른 창 안에서 한 공격(기회 공격)은 명중 시 보류되지 않으므로 아무것도 더해지지 않습니다.

시트가 가진 것은 공격 행을 바꾸고, 타격을 주고, 공격 행동을 기다릴 수 있습니다(Capability API 1.242). 시트 목록에 있으며 `attackRows`가 있는 카탈로그 항목은 `when` 조건(방어구 착용 0 이하처럼 시트에서 읽는 값)이 충족되는 동안 이름을 나열한 행(대소문자 구분 없이 비교)을 바꿉니다. `abilities`는 행 자체 능력치와 이것들 중 가장 좋은 것을 명중에 쓰고, 행의 피해가 같은 능력치를 더하면 피해에도 씁니다. `die`(시트 값 `from`을 단계 `table`을 거쳐 면 수로 바꿈)는 평균이 더 좋을 때 행의 주사위 대신 그 크기의 주사위 하나를 굴립니다. `qualities`는 타격이 저항을 통과하게 하는 성질에 더해집니다. 5e의 Martial Arts는 `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`이고, Ki-Empowered Strikes는 `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`입니다. 보유한 항목의 `grantsStrike`는 상태의 `grants.attacks`와 똑같이, 공격 자체 예산을 다 쓴 뒤 다른 예산으로 타격 한 번을 사게 합니다. `names`는 그 공격으로, `melee`는 근접 거리로, `afterAttack`은 공격 행동을 한 턴으로 좁힙니다(`true`, 또는 그중 하나로 한 공격 행동이면 `{ "names": [...] }`). Martial Arts의 보너스 비무장 타격은 `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`입니다. 상태의 `grants`도 같은 `names`와 `afterAttack`을 받습니다. `afterAttack`이 있는 항목은 공격 행동 뒤에만 제공됩니다. Flurry of Blows는 보너스 예산의 `utility` 항목으로, 기 하나를 쓰고 `afterAttack`이 있으며, count 0으로 선언한 예산 2를 `gives`하고, 그 예산에 대한 Unarmed Strike의 `grantsStrike`를 가집니다. 공격 행동은 공격 목록이나 아이템에서 자체 예산이나 이미 산 타격으로 지불한 모든 공격이며, 부여로 지불한 공격은 해당하지 않습니다.

기회 공격은 턴 중의 공격과 똑같이 명중한 곳에서 보류됩니다(Capability API 1.243). 그 명중에 대한 응답을 가진 모두에게 묻고, 공격자에게는 더할 것(Divine Smite, Stunning Strike)을 마지막에 묻습니다. 공격자가 이미 응답한 걷기 자체의 창은 타격이 들어간 뒤 이어서 묻습니다. 도중에 묶인 걷는 사람(stunned나 grappled처럼 `speed-zero`가 있는 상태)은 공격받은 칸에서 더 나아가지 못합니다. 반응이거나 다른 타격에 더해지는 항목은 기회 공격 자체로 선택되지 않습니다.

공격 규칙은 손에 든 무기에도 닿고, 공격 목록은 모든 시트에 행을 줄 수 있습니다(Capability API 1.244). `combat.attacks[].always`는 그 목록의 열로 작성한 행을 최대 4개 나열하며, 모든 시트의 전투는 자체 행과 함께 이 행들을 가집니다. 같은 이름의 시트 행이 있으면 그것을 대신 씁니다. 5e의 비무장 타격은 `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`입니다. `attackRows` 규칙의 `names`는 이제 손에 든 무기도 그 공격이 쓰는 이름으로 일치시키며, `items`는 손에 든 무기를 태그로 일치시킵니다. `tags`를 모두 갖고 `notTags`는 하나도 갖지 않아야 합니다(`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`이면 dagger +1도 해당). 규칙은 `names`, `items` 또는 둘 다를 지정합니다. 같은 `names`, `tags`, `notTags`를 가진 `wielding: { "only": {...} }`는 손에 든 모든 무기가 그중 하나이거나 아무것도 들지 않은 동안만 규칙을 유지합니다. "비무장이거나 몽크 무기만 든 경우"입니다. `grantsStrike`도 같은 `wielding`과 `attackRows` 규칙 같은 `when`을 받으므로, Martial Arts의 보너스 타격은 방어구를 입으면 제공되지 않습니다.

한 번에 여러 사용, 0으로 떨어뜨리는 내성, 이름을 지정한 공격의 명중, 상태가 끝날 때의 피해(Capability API 1.245). 항목의 `usesSpent`는 한 번 사용에 행의 사용 횟수(또는 `usesOf`의 것)를 그만큼 쓰며, 그만큼 남아 있을 때만 제공됩니다. Quivering Palm의 기 3입니다. `"hit"` 반응의 `names`는 그 공격의 명중에만 응답하며 이름을 대소문자 구분 없이 비교합니다. Quivering Palm은 오래 지속되는 `quivering` 상태를 거는 `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }`입니다. 내성이 있는 항목의 `dropsOnFailedSave`는 실패한 대상에게 양을 주는 대신 체력을 0으로 떨어뜨립니다(생물은 탈락하고, 캐릭터는 규칙 집합에 죽음 규칙이 있으면 죽어 갑니다). 성공한 대상은 내성의 `onSuccess`대로 양을 받습니다. 진동을 끝내는 것은 `targetHolds: { "fromSelf": ["quivering"] }`, 10d10 사령, `onSuccess: "none"`인 Constitution 내성, `dropsOnFailedSave`가 있는 행동입니다. 상태의 `onEnd.harm`(`dice`, `flat`, `type`, `unless`)은 상태가 끝날 때 상태를 건 상대로부터 보유자에게 피해를 주며, 보유자가 `unless`에 해당하면 주지 않습니다. Hurl Through Hell은 `dismisses: { "while": "hurled" }`와 `{ "rounds": 1, "of": "source" }` 동안 유지되는 `hurled`가 있는 명중 반응이며, `hurled` 상태의 `onEnd`는 `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`입니다.

`afterAttack`은 공격 행동에 쓴 무기를 태그로도 일치시킵니다(Capability API 1.246). `{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }`는 그 이름 중 하나로 한 공격, 또는 이름과 관계없이 `tags`를 모두 갖고 `notTags`는 하나도 갖지 않은 손에 든 무기로 한 공격 뒤를 뜻하므로 dagger +1도 해당합니다. 항목, `grantsStrike`, 상태의 부여 어디서든 `names`, `items` 또는 둘 다를 지정합니다.

무모한 타격과 잔혹한 타격(Capability API 1.247). `beforeAttack`이 있는 항목은 보유자 자신의 턴에서 그 턴에 공격하기 전에만 제공됩니다. Reckless Attack은 바바리안에게 거는 무료 `buff`로, `beforeAttack`이 있고 `reckless`를 `{ "rounds": 1 }` 동안, `exposed`를 `{ "rounds": 1, "at": "turn-start" }` 동안 겁니다. 공격에 대한 변경은 피해에 대한 변경처럼 `attacks`(`weapon`, `spell`, `any`)와 `blow`(`melee`, `ranged`)를 `ability`와 함께 받습니다. `reckless`는 `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`이고, `exposed`는 `attacks-against-advantage` 효과를 가집니다. 피해 변경의 `criticalDice`는 치명타에서만 타격 자체의 피해 주사위를 그만큼 더하며 두 배로 하지 않습니다. Brutal Critical은 바바리안의 파생 값에 대한 단계로 `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`를 가지며, 주사위 하나마다 한 단계입니다.

연타의 명중에 대한 응답(Capability API 1.248). `hit` 순간의 `budget`은 그 예산으로 지불한 타격의 명중으로 좁힙니다. Open Hand Technique은 Flurry of Blows가 `gives`하고 그 `grantsStrike`가 쓰는 예산에 대한 `{ "on": "hit", "by": "self", "budget": "flurry" }`에 응답합니다. 반응의 `oneOf`는 보유자 자신의 명중에 대한 응답 그룹을 지정하며, 명중마다 그중 하나만 씁니다. Open Hand Technique은 `"oneOf": "open-hand"`를 공유하는 무료 항목 세 개입니다. Dexterity `save`로 `prone`을 거는 것, Strength `save`와 `push` 15가 있는 것, `cannot-react` 효과가 있는 상태를 `{ "rounds": 1, "at": "turn-start" }` 동안 거는 것입니다. 하나를 쓰면 그 명중에서는 나머지 둘도 소모되고, 다음 명중은 셋을 다시 제공합니다. `oneOf`는 `also`가 없고 `by`가 `self`인 `hit` 순간에 둡니다.

굴림 뒤의 구조(Capability API 1.249). `"rescue": true`인 `attacks`, `saves`, `checks` 변경은 굴림에서 보류됩니다. 보유자 자신의 굴림이 모자라고 그 최대치(고정 부분과 모든 주사위의 최고 눈)로 차이를 메울 수 있을 때만 굴려 더하며, 그것을 준 상태는 소모됩니다. 뒤집을 수 없는 굴림에서는 이를 유지합니다. Bardic Inspiration은 아군에게 거는 상태로 `{ "to": "saves", "dice": "1d6", "rescue": true }`와 `attacks`, `checks`에 대한 같은 변경을 가집니다(주사위 크기마다 상태 하나이며, 다른 구간처럼 바드의 레벨로 고름). Guidance는 `1d4`의 `checks`, Resistance는 `1d4`의 `saves`입니다. 자연 빗나감은 구조하지 않으며, 주사위 풀 전투는 아무것도 보류하지 않습니다. 항목의 `rescue`는 그 항목을 메뉴에서 뺍니다. 보유자 자신의 그 종류 굴림이 실패했을 때 사용 횟수와 비용과 함께 소모됩니다. `{ "roll": "saves", "by": "reroll" }`는 내성을 다시 굴리고 새 굴림을 확정합니다(자체 사용 횟수가 있는 Indomitable, `usesOf` Ki가 있는 Diamond Soul). `{ "roll": "attacks", "by": "success" }`는 빗나감을 명중으로, `{ "roll": "checks", "by": "success" }`는 실패한 판정을 성공으로 바꿉니다(Stroke of Luck). 보류된 변경을 먼저 시도합니다.

Cutting Words와 Evasion(Capability API 1.250). 항목의 `lowersRoll`은 다른 누군가의 공격이 명중할 때, `by`가 없는 `hit` 반응에서 사용합니다(아군을 위해 응답하려면 `for`와 `within`). 그 `dice`, 또는 Martial Arts처럼 값으로 크기를 정한 `die` 하나(`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`)를 굴림에서 빼고, 굴림을 방어와 다시 비교합니다. 자연 명중은 여전히 명중합니다. Cutting Words는 `{ "on": "hit", "for": "ally", "within": 60 }`과 바드의 영감 카운터에 대한 `usesOf`가 있는 무료 `debuff`입니다. 전투 상태나 단계의 `evasion`은 내성을 지정합니다. 성공 시 절반을 주는 것에 대해, 성공한 내성은 아무것도 받지 않고 실패한 내성은 절반을 받습니다. Evasion은 로그나 몽크의 레벨에 대한 `"evasion": ["dex_save"]` 단계입니다.

Lay on Hands(Capability API 1.251). 항목의 `usesChosen`은 사용자가 한 번 사용에 쓸 사용 횟수를 하나부터 남은 만큼까지 고르게 하며, 그 횟수만큼 양을 곱해 회복합니다. 선택지는 `amount: { max }`를 담고 선택은 `amount`를 보냅니다. 생략하면 첫 대상을 평균적으로 완전히 회복시키는 만큼 씁니다. `usesSpent`가 없는 `heal`용입니다. Lay on Hands는 `"amount": { "flat": 1 }`인 `heal`로, 팔라딘 레벨당 다섯인 카운터에 대한 `usesOf`, `usesChosen`, `"targetTypes": { "not": { "types": ["undead", "construct"] } }`를 가집니다.

Font of Magic(Capability API 1.252). 항목의 `restore`는 `heal`이나 `buff`에서 맞은 대상의 풀에 돌려줍니다. 실시간 풀은 ID로, 목록 행의 풀은 이름(`"Sorcery Points"`)으로 지정합니다. 풀 계열의 `cost`가 있으면 `perCostStep`이 가장 싼 것보다 높은 단계마다 더하므로, 소서러의 슬롯은 그 레벨만큼의 Sorcery Points가 됩니다. `slots_1`을 비용으로 하고 `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }`와 `"perCostStep": { "flat": 1 }`이 있는 자기 대상 `buff`입니다. `overMax`는 풀의 최대치를 넘게 하며, 넘은 양은 따로 보관하다가 휴식이 풀을 최대치로 되돌릴 때 사라집니다. 점수로 만드는 슬롯은 레벨마다 항목 하나이며, `usesSpent`를 가격으로 하는 점수에 대한 `usesOf`와 `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`를 가집니다. 사용자에게 없는 풀을 사용자 자신에게 돌려주는 항목은 메뉴에 나오지 않습니다.

Metamagic(Capability API 1.253). 항목의 `alters`는 그 `catalogs`의 항목을 사용하는 방식을 바꿉니다. 자체 메뉴에는 나오지 않고 들어맞는 각 항목과 함께 제공되며, 그 항목을 사용할 때 고르고 자체 사용 횟수로 지불합니다(`usesSpent`가 있는 Sorcery Points에 대한 `usesOf`, 또는 주문을 지불한 레벨에 대한 `usesSpentByLevel`이며 최소 하나). 반응이 없는 `utility`입니다. 다른 것과 `joins`하지 않는 한 사용마다 하나뿐입니다. 바꾸는 것은 다음과 같으며, 각각 바꿀 것이 있는 주문에만 들어맞습니다. `spares`(시트 값. 휘말린 사용자와 아군 중 그 수만큼이 내성에 자동 성공: Careful), `range`(`{ "times": 2, "touch": 30 }`: Distant), `rerolls`(평균 미만인 피해 주사위를 가장 낮은 것부터 그 수만큼 다시 던짐: Empowered, `joins` 포함), `lasts`(1분 이상 거는 것이 그 배수만큼 오래 지속되며 하루를 넘지 않음: Extended), `heightens`(첫 대상이 첫 내성을 불리점으로 굴림: Heightened), `budget`(`{ "from": "action", "to": "bonus" }`: Quickened), `drops`(이후 필요 없어지는 구성 요소이며, 시전에 아무도 응답할 수 없음: Subtle), `twins`(사용자 자신만을 대상으로 하지 않고 더 높은 슬롯에서 얻는 것이 없는 단일 대상 주문의 대상 하나 추가: Twinned)입니다. 지금 그중 하나로만 시전할 수 있는 주문(행동을 쓴 뒤의 Quickened, Silence 안의 Subtle)은 `alterNeeded`와 함께 제공되며 선택에 그것이 있어야 합니다. 선택은 선택지의 `alters`에 있는 ID인 `alters`를 보내고, 로그에는 `altered`가 남습니다.

고르는 대로 적용하는 Metamagic(Capability API 1.254). `rerolls`는 주문의 모든 피해 주사위 중 가장 낮은 것을 다시 던지되 전체에서 그 수를 넘지 않습니다. 자체 주사위, `plus`의 모든 절의 주사위, 치명타라면 남은 수만큼의 추가 주사위입니다. 공격 주문은 명중한 각 대상마다 굴립니다. `spares` 변경이 아끼는 수보다 많은 사용자 편을 휘말리게 하면 사용자가 누구를 아낄지 고릅니다. 선택지의 `alters` 제안은 `spares`(몇 명)를 담고, 선택은 아낄 사용자 편의 ID인 `spares`를 보냅니다(아무것도 없으면 아무도 아끼지 않음). 생략하면 처음 휘말린 대상들을 아낍니다. 이 선택은 시전에 응답하는 창을 거쳐도 유지됩니다. 누군가를 아끼는 변경이 없는 `spares`, 아끼는 수보다 많은 ID, 두 번 쓴 ID, 다른 편의 ID는 `bad-alter`로 거부합니다.

Heightened의 대상과 Acid Arrow(Capability API 1.255). `heightens` 변경이 둘 이상을 휘말리게 하면 사용자가 누가 첫 내성을 불리점으로 굴릴지 고릅니다. 선택지의 `alters` 제안은 `heightens: true`를 담고, 선택은 전투원 한 명의 ID인 `heightens`를 보냅니다(일부를 겨누면 겨눈 대상 중 하나이며, 사용자 자신은 안 됨). 생략하면 처음 휘말린 대상입니다. `halfOnMiss: true`인 항목(`attackRoll`과 `amount`가 있어야 함)은 빗나가도 절의 피해를 포함해 피해의 절반을 주며, 명중 시 하는 다른 일은 하지 않습니다. `applies` 항목의 `harmsPerCostStep`(`{ "dice": "1d4" }`)은 상태를 건 비용이 높은 단계마다 상태의 `harms`에 그만큼 더합니다. 2레벨보다 높은 슬롯 레벨마다 1d4가 더해지는 Acid Arrow의 나중 산 피해가 그 예입니다.

보유자 자신의 구조, 사용자에게 쓰지 않는 항목, 한 번에 하나인 상태(Capability API 1.256). 항목의 `rescue`는 `by: "twenty"`일 수도 있습니다(`roll: "checks"`에만). 실패한 판정의 d20을 20으로 세며, 그렇게 해서 성공할 때만 소모합니다. Stroke of Luck이 능력치 판정에 하는 방식입니다. `by: "die"`는 받은 어떤 것으로도 차이를 메울 수 없고 그 주사위로는 메울 수 있을 때 보유자 자신의 주사위를 더합니다. `dice`(`"1d10"`, Dark One's Own Luck) 또는 시트 값으로 크기를 정한 `die` 하나 `{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`(Peerless Skill)입니다. 받은 상태를 먼저 시도합니다. `ally`나 `any` 생물을 겨누는 항목의 `notSelf: true`는 사용자 자신에게 쓰지 못하게 합니다. Bardic Inspiration이 그 예입니다. 전투 상태의 `oneAtATime`은 그룹(`"bardic"`)을 지정합니다. 생물이 그 그룹의 상태 하나를 가진 동안에는 같은 상태를 포함해 그 그룹의 다른 상태가 걸리지 않으며, 상태 이벤트에 `already`가 남습니다.

더 많은 종류의 굴림에 대한 응답(Capability API 1.257). `lowersRoll`은 `"also": ["checks", "damage"]`도 나열할 수 있습니다. 명중한 공격 굴림 외에, 다른 누군가의 능력치 판정(붙잡기 같은 겨루기, 아이템 사용 전 판정, Counterspell의 판정)이나 피해 굴림에서도 굴리는 순간 주사위를 뺍니다. 이는 항목의 예산, 사용 횟수, 비용과 함께 저절로 소모되며, 굴리는 사람에게 항목이 닿는 반대편의 첫 사람이 쓰고, 그 최대치가 굴림을 뒤집을 수 있을 때만 씁니다. 성공할 판정이 실패로 바뀔 수 있거나, 보유자 편 한 명을 쓰러뜨릴 피해가 그를 서 있게 할 수 있을 때입니다. Cutting Words는 레벨로 크기를 정한 주사위, `needs: ["hearing"]`, `targetTypes: { "notImmuneTo": ["charmed"] }`가 있는 `{ "dice": "1d6", "also": ["checks", "damage"] }`입니다. 구조는 `saves`를 지정할 수 있으며(`saves`에 대한 구조에만), 그러면 그 내성에서만 소모됩니다. `budget`이 있으면 그 예산 하나도 쓰며, 예산이 없으면 소모되지 않습니다. ring of evasion은 충전을 사용 횟수로 하는 `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }`입니다. 아이템 사용도 `attackRoll`, `amount`와 함께 `halfOnMiss`를 가질 수 있습니다. Acid Arrow 두루마리가 그 예입니다.

질병(Capability API 1.258). 전투 상태의 `kinds`(`["disease"]`)는 그 상태가 어떤 종류인지 정합니다. 종류는 상태 자체 ID가 될 수 없습니다. 치료의 `ends`는 상태 대신 종류를 지정할 수 있습니다. 그 종류의 모든 상태가 해당하며 `count`는 여전히 그 수만큼만 해제하므로, Lesser Restoration의 "질병 하나"는 `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`입니다. 면역(생물이나 아이템의 `conditionImmunities`, 또는 상태나 단계의 면역)도 종류를 지정할 수 있습니다. Divine Health는 `"conditionImmunities": ["disease"]`가 있는 상태입니다. `saveEnds`는 횟수를 셀 수 있습니다. `successes`(2~10)는 상태를 끝내는 성공 수이고, `failures`(`{ "count": 3, "becomes": "blinding_sickness" }`)는 그만큼 내성에 실패하면 대신 `becomes`를 시계와 추가 내성 없이 겁니다. 상태 이벤트에 `worsened`가 남습니다. Contagion이 이렇습니다. 매 턴 끝에 내성을 굴리는 `until-save` 상태로, 어느 쪽이든 세 번입니다. 시계가 없는 상태는 전투가 끝나도 해제되지 않으므로, 자리 잡은 질병은 무언가 치료할 때까지 전투보다 오래 남습니다.

착용 아이템의 구조(Capability API 1.259). 아이템의 `use`는 항목의 mechanics처럼 `saves`와 `budget`을 포함한 `rescue`를 가질 수 있습니다. 메뉴에는 나오지 않으며, 아이템을 착용하고(슬롯이 있는 경우) 그 사용이 소모하는 `charges`가 있는 동안에만 소모됩니다. 소모하면 그 충전 하나를 씁니다. ring of evasion은 `"charges": { "max": 3 }`과 `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }`가 있는 아이템입니다. 충전은 아이템의 `recharge`대로 돌아옵니다.

전투 사이의 질병(Capability API 1.260). 전투 상태는 `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }`를 가질 수 있습니다. 상태가 걸린 동안 보유자가 그 휴식 중 하나를 할 때마다, 휴식이 돌려줄 것을 돌려준 뒤 휴식하는 곳에서 굴린 만큼 체력 최대치가 떨어집니다. `lasting`이 없으면 다음 휴식이 이를 돌려주고, 있으면 봉인을 푸는 것만 돌려줍니다. `onRest.save: { "save": saveId, "difficulty": 15, "cures": true }`는 먼저, 규칙 집합의 판정처럼 시트 자체 수정치로 굴립니다. 실패할 때만 최대치를 낮추며, `cures`가 있으면 성공 시 상태를 끝냅니다(오튜그의 질병). 점수로 관리하는 체력에만 낮출 최대치가 있습니다. 5e의 Mummy Rot은 `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`가 있는 시계 없는 상태입니다. 끝나거나 다른 상태가 될 때까지 세는 내성(1.258)은 이제 전투가 끝나도 멈추지 않습니다. 도망친 전투를 포함해 어떤 전투가 끝나든 보유자의 남은 턴 내성을 모두 굴리므로, Contagion은 그때까지 떨쳐 내거나 자리 잡습니다. 피해를 받을 때만 하는 내성은 피해를 기다립니다.

질병 단계(Capability API 1.261). 전투 상태는 `onDamaged: { "applies": [...] }`를 가질 수 있으며, 보유자가 피해를 받을 때마다 `onEnd`처럼 시계와 함께 겁니다(보유자의 다음 턴이 끝날 때까지 기절시키는 Slimy Doom). `expires: { "becomes": conditionId }`는 자체 시계가 다하면(전투 종료 포함) 시계 없이 그것으로 바뀌지만, 다른 방법으로 끝나면 바뀌지 않습니다(1분 뒤의 아볼레스 Tentacle 질병). `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`은 그 카탈로그에서 그 레벨 이상으로 지불한 치료만 상태를 끝내게 합니다. `onRest.restoredWhenCured: true`(`lasting`과 함께)는 상태가 자체 내성 성공을 포함해 어떻게 해제되든, 해제될 때 그 상태의 휴식이 최대치에서 빼앗은 것을 돌려줍니다. `cannot-heal-nonmagical` 효과는 마법적 회복을 뺀 모든 회복을 막습니다. 전투에서는 성질에 `"magical"`이 있는 행동, 전투 밖에서는 `"magical": true`인 회복 동작(`magical` 태그가 붙은 물약이 해당)이 마법적 회복이며, 휴식은 결코 해당하지 않습니다. 거부된 회복에는 `cannot-heal`이 나옵니다. 능력치 블록 행동은 카탈로그 항목처럼 종류를 포함한 `ends`를 가질 수 있습니다. 유니콘의 Healing Touch는 `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`입니다. 여러 저주 중 하나를 푸는 것처럼 시전자가 상태 중에서 고르는 치료는 `cureOneOf`(1.204)입니다.

생물 행동의 성질(Capability API 1.262). 능력치 블록 행동은 카탈로그 항목처럼 규칙 집합이 선언한 아이템 태그인 `qualities`를 가질 수 있습니다. `["magical"]`이면 그 회복이 마법적 회복이 되어 `cannot-heal-nonmagical`을 통과하고, 그에 대한 내성은 마법에 대한 내성이 됩니다. 전투 중 아이템 사용도 같은 방식으로 아이템 자체 태그를 가지므로, `magical` 태그가 붙은 물약은 시트에서처럼 전투에서도 마법으로 회복합니다.

오라(Capability API 1.263). 전투 상태는 `auras`를 최대 네 개 가질 수 있습니다. 각 오라는 보유자로부터 `distance` 이내에 선 `side`(`allies`, `enemies`, `all`)의 대상에게 `conditions`를 퍼뜨리며, `self: true`이면 보유자에게도 퍼뜨립니다(`enemies`와는 함께 쓸 수 없음). `when`은 보유자의 시트 값 하나를 `atLeast`나 `atMost`로 읽으므로 오라가 특정 레벨부터 열리게 할 수 있습니다. 쓰러졌거나, 패배했거나, `cannot-act` 효과가 있는 보유자는 아무것도 퍼뜨리지 않습니다. 오라가 퍼뜨린 것은 전투가 진행되며 걸리고 둘이 떨어지면 해제되며(로그에 `aura`와 `parted`), 시트에 기록되지 않고, 전투가 끝나면 사라집니다. 오라가 퍼뜨린 상태는 자체 오라를 가질 수 없습니다. 보드가 없으면 오라는 그 편의 모두에게 닿습니다. 보유자가 모든 전투를 그 상태로 시작하게 하려면 카탈로그 항목의 mechanics나 능력치 블록에 `keepsOn`을 주세요. 전투 내내 보유하는 상태이며 역시 시트에 기록되지 않습니다. 5e의 Aura of Protection은 팔라딘의 Charisma를 내성에 더하는 상태를 퍼뜨리는 오라를 가진, 계속 유지되는 `aura-of-protection`입니다. Holy Nimbus는 적에게 퍼지는 오라로, 그 상태가 그들의 턴 시작 시 피해를 줍니다.

강제된 행동(Capability API 1.264). 전투 상태는 보유자가 자기 턴에 무엇을 할지 정하는 `behavior`를 가질 수 있습니다. `only`는 턴 종료 외에 턴에 할 수 있는 모든 것을 나열합니다. `move`(걷기와 일어서기), `escape`(속박에서 벗어나기), 규칙 집합이 선언한 표준 행동입니다. 빈 목록이면 턴 종료만 남습니다(Command의 정지). `onlyWhenStuck`은 걸어갈 곳이 없을 때만 허용하는 표준 행동을 지정합니다(Turn Undead의 Dodge). `moves: "away"`는 상태를 건 상대에게서 멀어지는 쪽으로만 걸으며 한 걸음도 가까워지지 않고 더 먼 곳에서 끝납니다. `moves: "toward"`는 가까워지는 쪽으로만 걷습니다(Command의 접근, Sympathy). `table`은 보유자의 각 턴이 시작될 때 굴리는 `{dice, rows: [{atMost, does}]}`이며, 굴림이 그 값 이하인 첫 행이 턴을 정합니다. `wander`는 d8로 고른 한 방향으로 속도 전부를 걷고 턴을 끝내며, `nothing`은 턴을 끝내고, `strike`는 주사위가 고른 근접 거리 안의 생물(아군이든 적이든, 아무도 없으면 아무것도 안 함)에 대한 근접 공격만 허용하며, `normal`은 모든 행보다 높은 굴림처럼 턴을 그대로 둡니다(Confusion, Mindfire). 로그는 굴림을 `compelled` 이벤트로 보여 주며, 그 밖의 것은 `compelled`로 거부합니다. 상태를 끝내는 내성은 `at: "action"`일 수도 있습니다. 보유자가 행동을 써서 굴립니다(Irresistible Dance).

오라의 추가 기능(Capability API 1.265). 오라의 `conditions`는 이제 상태를 퍼뜨리거나, 피해를 주거나, 내성을 요구하는 한 선택 사항입니다. `needs`는 받는 쪽이 가져야 하는 감각을 나열하며, 보유자도 받는 쪽도 `inside.conditions`가 그 감각을 빼앗는 영역 안에 서 있으면 안 됩니다. `needs: ["hearing"]`인 Countercharm은 Silence에서 멈춥니다. `harms` `{dice, flat, type}`는 보유자 자신의 각 턴이 시작될 때 보유자가 오라가 닿는 모두에게 줍니다(발로르의 Fire Aura). `save` `{save, difficulty, applies, seen?, immuneOnSuccess?}`는 오라가 닿는 모두가 자기 턴이 시작될 때 굴립니다. 실패하면 그 난이도로 보유자가 건 `applies`를 받고, `seen`은 둘이 서로 볼 수 있을 때만 묻으며(바실리스크의 응시), `immuneOnSuccess`는 성공한 뒤 남은 전투 동안 그 보유자의 오라를 막습니다(핏 핀드의 Fear Aura). 내성 수정치의 `against.casts`는 그 카탈로그에서 시전한 것에 대한 내성으로 좁히며, 그 카탈로그에서 시전하는 아이템 사용도 포함하고, 그다음 지정한 다른 조건으로 좁힙니다. 악마나 언데드가 시전한 주문에 대한 Holy Nimbus의 이점은 `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`입니다.

강제된 행동의 추가 기능(Capability API 1.266). `behavior`는 `drops` `{slots?, tags?, at, pickUp?}`를 가질 수 있습니다. 보유자는 `slots` 중 하나를 차지하거나 `tags` 중 하나를 지닌 착용 아이템과, `qualities`에 `tags` 중 하나가 있는 능력치 블록 행동을 떨어뜨립니다. 상태가 걸릴 때(`at: "applied"`, Fear의 "들고 있는 것을 떨어뜨림") 또는 보유자의 각 턴이 시작될 때(`at: "turn-start"`, Command의 "떨어뜨려라")입니다. 떨어진 것은 서 있던 칸에 놓입니다. 그 행동은 더 이상 그들의 것이 아니며(`dropped`로 거부), 착용 중 주던 것을 주지 않고, 보유자 방어에서 차지하던 몫도 사라집니다(방패의 2). 그 칸이나 옆에 서서 턴에 한 번 있는 무료 줍기로, 또는 상태가 지정했다면 `pickUp` 예산으로 줍습니다. 로그에는 `letFall`과 `pickedUp`이 나옵니다. `onlyWhenStuck: "any"`는 상태가 허용하는 곳 어디로도 걸을 수 없는 채로 시작한 턴을 온전히 보유자의 것으로 만듭니다(Fear의 "움직일 곳이 없으면 예외"). `keepsOut`은 상태를 건 상대로부터의 거리입니다. 그 안에서는 더 멀어지는 쪽으로만 걷고, 바깥 어디든 닿을 수 있는 동안에는 바깥에서만 멈춥니다(Turn Undead의 "시전자로부터 30피트 이내의 공간으로 자발적으로 이동할 수 없음"). 상태를 끝내는 내성은 `unseen: true`일 수 있으며, 보유자가 상태를 건 상대를 볼 수 없을 때만 굴립니다(시선 밖에서의 Fear 내성). 항목의 `applies`는 `destroysUpTo` `[{tier, when?}]`를 가질 수 있습니다. 내성에 실패하고 위협 단계가 사용자 시트에서 `when`이 충족되는 가장 높은 `tier` 이하인 생물은 대신 즉시 파괴됩니다(Destroy Undead, 클레릭 5레벨의 CR 1/2부터 17레벨의 CR 4까지). 캐릭터나 단계가 없는 생물은 파괴되지 않습니다.

아무 감각으로든 겨누기, 서로 가까운 대상, 커지는 범위, 더 많은 사용, 들고 있는 것(Capability API 1.267). 감각을 `needs`하는 항목이나 생물 행동은 `needsAny: true`를 더할 수 있습니다. 그중 하나라도 가진 대상은 해당하며, 모두 없는 대상만 거부합니다(Turn Undead의 "시전자를 보거나 들을 수 있는 각 언데드"). `targetsWithin`은 고른 대상의 모든 쌍이 그 안에 서 있어야 하는 거리이며, 그렇지 않으면 `targets-apart`로 거부합니다(더 높은 슬롯으로 시전한 Command의 대상은 "서로 30피트 이내"). `area`는 `sizePerCostStep`을 가질 수 있으며, 비용을 올린 단계마다 크기가 그만큼 커집니다(슬롯 레벨마다 5피트씩 커지는 Confusion의 구체). 벽은 커지지 않습니다. `use`가 있는 아이템은 `moreUses` `[{label, use}]`를 나열할 수 있습니다. 각각은 아이템과 그 `label`로 이름 붙은 또 다른 메뉴 항목이며, 같은 충전을 쓰고 아이템과 함께 떨어집니다(여러 주문을 담은 완드). 생물은 자체 행동이 아닌 들고 있는 것(능력치 블록에 적힌 방패)을 `held` `[{label, tags, defense?}]`로 나열할 수 있습니다. `drops`가 그 `tags` 중 하나를 지정한 상태는 태그가 붙은 행동과 함께 그것들을 떨어뜨리고, 그 `defense`는 생물이 주울 때까지 방어에서 빠지며, 각각 떨어진 아이템처럼 줍습니다.

응시, 그리고 누구에게 닿는지에 따른 오라(Capability API 1.268). 오라는 항목처럼 읽는 `targetTypes`를 가질 수 있으며, 그런 대상에게만 닿습니다(인간형에게만 닿는 씨 해그의 Horrific Appearance). `sourcesOf`는 상태를 지정하며, 보유자에게 그중 하나를 건 사람에게만 닿습니다(자신을 붙잡은 자를 해치는 바브드 데빌의 Barbed Hide). 오라의 `save`는 `failedBy` `{atLeast, applies}`를 가질 수 있습니다. 그만큼 이상 차이로 실패하면 대신 그것을 겁니다(5 이상 차이로 실패하면 즉시 석화되는 메두사의 응시). `seen` 내성은 `avert: true`를 가질 수 있습니다. 오라가 닿는 사람은 자기 턴에 무료로 보유자에게서 눈을 돌릴 수 있습니다. 다시 볼 때까지(이것도 자유로운 선택) 그 내성을 건너뛰지만 보유자를 볼 수 없으므로 보유자에 대한 공격은 보이지 않는 채로 합니다. 로그에는 `averted`가 나오며, 디렉터는 다른 누군가 싸울 상대가 남아 있는 동안 자기 생물들의 눈을 돌린 채로 둡니다. 상태를 끝내는 내성은 `seenLean`(`"advantage"` 또는 `"disadvantage"`)을 가질 수 있으며, 보유자가 상태를 건 상대를 볼 수 있는 동안 그렇게 굴립니다(씨 해그가 보이는 동안 불리점으로 굴리는 반복 내성).

보유자의 수치로 시전하는 지팡이(Capability API 1.269). 아이템의 `use`는 `saveDifficulty` 대신 `sheetDifficulty`로 내성 난이도를 보유자 시트에서 읽을 수 있습니다. `toHit.sheetBonus`가 읽는 것과 같은 값(`{ "derived": "spell_save_dc" }`)입니다. 공격 보너스는 이미 같은 방식으로, 능력치 없이 `toHit.sheetBonus`(`{ "derived": "spell_attack" }`)로 시트에서 읽습니다. `charges`가 있는 사용은 `chargeStep` `{max, amount?, targets?}`를 가질 수 있습니다. 사용자는 최대 `max`개의 충전을 더 쓸 수 있으며, 하나하나가 높은 비용의 한 단계로서 높은 슬롯이 `perCostStep`과 `targetsPerCostStep`을 더하듯 `amount`와 `targets`를 더하고 `sizePerCostStep`으로 범위를 키웁니다(더 높은 레벨로 시전하는 Staff of Power의 주문, 충전 하나당 1d6 역장 피해인 Staff of Striking). 메뉴는 이를 `charges:<how many more>`라는 지불 방식으로 제공하며, 아이템에 남은 수만큼만 제공합니다. 같은 마이너 버전은 규칙 집합이 선언할 수 있는 상태를 320개로 늘리며, 오라의 `save`는 `immuneWhenEnds: true`를 가질 수 있습니다. 실패로 건 것이 내성, 시계, 치료 등 어떻게든 끝나면, `immuneOnSuccess`가 내성 성공 뒤 막아 주듯 남은 전투 동안 그 보유자의 오라를 막습니다(씨 해그의 "성공하거나 효과가 끝나면").

시전할 때 정하는 종류(Capability API 1.270). `applies`가 있는 카탈로그 항목의 `mechanics`는 `kindChoice: true`를 가질 수 있습니다. 사용자는 사용할 때 `combat.creatureTypes` 중 하나(유형이나 태그)를 정하며, 이는 `kind-<id>` 모드로 제공되고, 건 상태는 그 종류를 기억합니다. 건 상태의 오라에 `chosenKind: true`가 있으면 그 종류의 생물에게만 닿고, `orSeen: true`가 있으면 거리와 관계없이 보유자를 볼 수 있는 사람에게도 닿습니다. 따라서 5e의 Antipathy는 대상에게 상태를 걸며, 그 오라는 `side: "all"`로 60피트 이내나 시야 안의 선택한 종류를 겁에 질리게 하고, 겁에 질린 이들은 멀어지며(`moves: "away"`) Sympathy로 매혹된 이들은 다가갑니다. 상태의 `saveEnds`는 규칙 집합 거리 단위의 `beyond`를 가질 수 있습니다. 보유자가 상태를 건 상대로부터 그보다 멀리 서 있는 동안만 내성을 굴리며, `unseen`이 있으면 상대의 시야 밖이기도 해야 합니다(Antipathy의 "대상에서 60피트 이내가 아니거나 대상을 볼 수 없음").

지팡이와 반지가 하는 일의 추가 기능(Capability API 1.271). 아이템의 `use`는 `label`을 가질 수 있으며, `moreUses` 항목의 라벨처럼 아이템 이름 옆에 표시됩니다("Staff of Fire: Burning Hands"). 추가 사용은 자체 `label`로 이름 붙습니다. 사용은 카탈로그 항목처럼 보유자 시트에서 읽어 양에 더하는 값인 `amountAdd`를 가질 수 있으며(Staff of Healing의 Cure Wounds, `{ "abilityModFromField": "spellcasting_ability" }`), 전투 안팎에서 적용됩니다. `chargeStep`은 규칙 집합 거리 단위의 `push`를 가질 수 있습니다. 충전을 하나 더 쓸 때마다 사용 자체의 `push`에 더해 대상을 그만큼 더 멀리 밀어냅니다(충전 하나당 5피트인 Ring of the Ram). 아이템의 `charges.breaksOn`은 `regains` `{atLeast, amount}`를 가질 수 있습니다. 마지막 충전을 썼을 때 주사위가 `atLeast` 이상이면 아이템은 대신 `amount`만큼 충전을 되찾으며(20이 나오면 1d12 + 1인 Staff of the Magi), 전투 안팎과 인벤토리가 충전을 쓸 때 모두 적용됩니다. 이때 부서지지 않는 아이템은 `atMost`를 생략할 수 있습니다.

다른 것이 되는 아이템(Capability API 1.272). 아이템의 `charges.breaksOn`은 `atMost` 옆에 규칙 집합의 다른 아이템을 `<catalog>/<entry>`로 지정한 `becomes`를 가질 수 있습니다. 아이템을 부서뜨릴 눈이 나오면 대신 그 아이템이 됩니다(Staff of Striking의 비마법 쿼터스태프, 또는 +2만 적은 아이템으로 바뀌어 +2만 남기는 Staff of Power). 전투에서는 사용이 사라지고 그때부터 새 아이템으로 공격하며, 전투는 묶음을 그 아이템의 이름으로 충전 없이 기록합니다. 전투 밖과 인벤토리가 충전을 쓸 때도 묶음이 같은 방식으로 바뀝니다. 지정한 아이템은 어느 카탈로그 파일에 있든 규칙 집합의 다른 아이템이어야 합니다.

명중 시 쓰는 충전(Capability API 1.273). 무기의 `attack.spends`는 그 무기로 한 타격이 명중한 뒤 보유자가 아이템의 충전을 쓸 수 있는 방식을 최대 네 개 나열합니다. 각각 `label`, 비용인 `charges`, 자체 피해 `type`(지정하지 않으면 무기의 유형)으로 타격에 더하는 주사위와 고정 부분의 `amount`를 가지며, 선택적으로 `blow`(`melee`나 `ranged` 타격만), `chargeStep`(`max`개의 충전을 더 쓰며 각각 `amount`를 다시 더함. 충전 하나당 1d6 역장 피해를 최대 세 번 더하는 Staff of Striking), `onHit`(명중당한 대상이 받는 상태 최대 둘. 각각 `rounds`, 막아 주는 `save`, 또는 `saveEnds`를 가짐. Staff of Withering의 Constitution 내성)를 가집니다. 전투에서는 그 무기로 한 보유자 자신의 명중에서만, 명중당한 대상이 응답한 뒤 각각을 제공합니다. 주사위는 타격과 함께 굴리고 그 치명타로 두 배가 되며, 아이템의 마지막 충전 주사위는 사용처럼 굴립니다. 아이템은 충전을 담아야 합니다.

상태를 건 사람에게서 고정한 수치(Capability API 1.274). 항목이 `applies`하는 상태는 `value`를 가질 수 있습니다. 상태가 걸릴 때 상태를 거는 사람의 시트에서 읽는 값 참조입니다(Heroism의 `{ "abilityModFromField": "spellcasting_ability" }`). 전투 상태의 `temporary`는 보유자의 각 턴이 시작되거나 끝날 때(`at`) 임시 점수를 줍니다. `dice`와 `flat`에, `value: true`이면 그 값을 더하며, `lostWhenEnds`가 있으면 상태가 끝날 때 남은 임시 점수가 사라집니다. 단, 보유자가 다른 데서 받은 임시 점수가 상태가 준 것보다 많으면 사라지지 않습니다. 오라의 `save.appliedDifficulty`는 오라의 상태를 보유자에게 건 것의 내성 난이도, 즉 걸릴 때 고정된 값에 대해 내성을 굴립니다(Antipathy/Sympathy 시전자의 주문 내성 DC). 아무도 걸지 않은 오라에는 `difficulty`가 그대로 적용됩니다. `at: "damaged"`로 상태를 끝내는 내성은 `bySource`라고 할 수 있으며, 상태를 건 사람에게서 받은 피해에서만 굴립니다(대상이 보유자를 해칠 때의 Sympathy 내성). 상태의 `behavior.keepsIn`은 보유자가 상태를 건 사람으로부터 그 거리 안에 한번 들어오면 더 멀리 걷지 못하게 합니다(Sympathy의 "자발적으로 멀어질 수 없음"). 그리고 아이템의 `use`도 항목의 mechanics처럼 `kindChoice`(1.270)를 가질 수 있으므로, Antipathy/Sympathy 두루마리도 사용할 때 종류를 정합니다.

끝나지 않고 보류되는 상태(Capability API 1.275). `whileSourceInSight` 옆에서 전투 상태의 `orSourceWithin`(규칙 집합 자체 단위의 거리)은 보유자가 상태를 건 사람에게 그만큼 가까이 있는 동안 보이든 안 보이든 상태를 유지합니다. 시야 밖이고 거리 밖이면 상태는 보류되며, 시계가 흐르는 채로 보유자에게 남아 있다가 둘 중 하나가 참이 되는 순간 다시 유지됩니다(60피트 이내나 시야 안에서의 Antipathy 공포). 전투 상태의 `suppresses`는 자신이 유지되는 동안 보류하는 다른 상태를 나열합니다. 그 상태들이 하는 일은 멈추지만 걸린 채로 남고, 이 상태가 끝나면 다시 유지됩니다(Calm Emotions의 매혹과 공포, Mindless Rage).

순간이동(Capability API 1.276). 카탈로그 항목의 `mechanics.teleport`, 아이템의 `use.teleport`, 생물 행동의 `teleport`는 사용자를 `distance`(규칙 집합 자체 단위) 이내의 빈 곳으로 즉시 옮깁니다. 사이의 걸음이 없으므로 떠날 때 아무도 타격하지 못하며, 도착한 영역은 걸어 들어온 것처럼 사용자를 휘말리게 합니다. 보드에서만 작동하므로 `combat.distance`가 필요하며, 보드 밖에서는 순간이동만 하는 행동은 제공되지 않습니다. `seen`이 있으면 사용자가 지금 볼 수 있는 곳만 됩니다(벽, 안개, 눈을 빼앗는 실명은 그 뒤의 칸을 목록에서 뺍니다). 5e의 Misty Step은 `{ "distance": 30, "seen": true }`입니다. `carries`(1~8)는 사용자보다 크지 않은 사용자 편의 자발적인 생물을 `carriesWithin`(생략하면 접촉) 이내에서 그 수만큼 데려가며, 각자 자리가 있는 한 사용자에게 가장 가까이 도착합니다. Dimension Door는 `{ "distance": 500, "carries": 1, "carriesWithin": 5 }`입니다. 순간이동이 있는 생물 행동은 생물 자신에게 적용됩니다(블링크 독의 Teleport). 선택지는 갈 수 있는 칸을 `teleport.cells`로, 함께 갈 수 있는 사람을 `teleport.carries`로 나열하며, 선택은 칸을 `at`으로, 일행을 `carries`로 지정합니다. 순간이동은 범위나 반응이 될 수 없습니다.

한 번에 여섯 상태, 그리고 실제로 보는 시야(Capability API 1.277). 카탈로그 항목의 mechanics, 아이템 사용, 생물 행동에서 `applies`는 항목을 최대 6개 담습니다(이전에는 4개). Rage와 Frenzy는 각자의 네 개 옆에 Mindless Rage의 상태를 더합니다. 그리고 `whileSourceInSight`(옆에 `orSourceWithin`이 있는 경우 포함)는 이제 오라의 `orSeen`처럼 보유자 자신의 시야를 읽습니다. 보드에서 트인 선이 여전히 필요하며, 거기에 더해 보유자가 눈이나 감각으로 출처를 보아야 합니다. 따라서 눈을 빼앗는 실명, 가리는 안개, 볼 수 있는 범위 너머의 어둠, 보유자에게 보이지 않는 출처(투명)는 모두 벽처럼 이를 끊습니다.

Calm Emotions(Capability API 1.278). 내성은 `alliesMayFail: true`라고 할 수 있습니다(카탈로그 항목, 아이템 사용, 생물 행동의 `save`). 사용자 자신의 편인 대상은 효과를 받아들여 굴리지 않고 실패하며 로그에 알리고, 다른 사람은 평소처럼 굴립니다. 상태의 `effects`는 `cannot-target-source-side`를 가질 수 있습니다. 보유자는 상태를 건 사람이나 그 편의 누구에게도 아무것도 겨누지 못합니다. 단, 그 편이 보유자 자신의 편이면 아무도 막지 않습니다. `endsWhen`은 `damaged`와 `harmed-by-source-side` 외에 두 가지 끝을 더 받아 최대 넷까지 가집니다. `attacked`는 명중이든 빗나감이든 누군가 보유자에게 한 공격 굴림이며(굴림 없이 명중하는 행동은 해당하지 않음), `ally-harmed-in-sight`는 보유자가 보는(보드에서 트인 선과 보유자 자신의 눈이나 감각) 보유자 편 다른 누군가에 대한 피해입니다. 그리고 `endsWhenHarmedFrom`은 카탈로그를 나열합니다. 누구든 그 카탈로그 중 하나에서 시전한 것(두루마리의 주문과 서 있는 영역 포함)이 보유자를 해치면 상태가 끝납니다. 해치는 것은 `harmed-by-source-side`와 같이 피해이거나 해로운 행동의 대상이 되는 것이며, 같은 상태를 다시 시전하면 끝나지 않고 갱신됩니다. 이들은 각각 그것을 일으킨 단계가 끝날 때까지 기다립니다. 그리고 보유자 자신의 활성 상태가 `suppresses`하는 상태는 더 이상 그 상태가 주는 면역으로 끝나지 않습니다. 치료가 아니라 보류이므로, 공포 면역인 분노가 시작될 때 이미 걸려 있던 공포는 분노가 끝나면 돌아오고(5e의 Mindless Rage), 새 공포는 여전히 걸리지 않습니다.

전투 밖으로의 순간이동, 보이는 동승자, 연기(Capability API 1.279). `teleport`(카탈로그 항목, 아이템 사용, 생물 행동)는 키 세 개를 더 받습니다. `leaves: true`는 칸 대신 사용자를 전투 밖으로 아예 데려갈 수 있습니다(유니콘의 1마일). 이때 선택은 `at`을 지정하지 않으며(메뉴에 "Leave the fight" 버튼 표시), 사용자와 함께 가는 사람은 살아서 사라집니다("Left the fight"로 표시하며 체력은 유지되고 아무것도 그들을 되돌리지 않음). 보드 밖에서는 떠나는 것이 유일한 목적지이며, 누가 가까이 있는지 재는 것이 없으므로 사용자 편에 서 있는 누구든 함께 갈 수 있습니다. 전투에서 빠졌고 그중 누군가 이렇게 떠난 파티는 도망친 것입니다(결과는 `fled`이며 도망처럼 전투를 끝냄). 이렇게 사라진 적은 패배한 것도 서 있는 것도 아닌 달아난 것이며 요약에 그렇게 나옵니다. 디렉터 자신의 생물은 체력이 4분의 1 이하가 되면 데려갈 수 있는 이를 데리고 떠납니다. `carriesSeen: true`(`carries`와 함께)는 사용자가 볼 수 있는 이만 함께 가게 합니다. 유니콘의 "볼 수 있는 자발적인 생물"입니다. 그리고 `smoke`(`{}` 또는 `{ "pierced": [senses] }`)는 도착하는 순간부터 사용자의 다음 턴이 끝날 때까지 사용자가 떠난 칸과 도착한 칸에 구름을 세워 영역의 `obscures`처럼 가립니다. Cape of the Mountebank의 연기입니다.

공격하는 순간이동(Capability API 1.280). 생물의 순간이동은 자신의 행동 하나를 `strike`(그 `id`)로 지정할 수 있습니다. 블링크 독의 "순간이동 전이나 후에 물기 공격 한 번 가능"입니다. 그러면 순간이동 뒤 이번 턴에 그 행동을 한 번 무료로 이어서 할 수 있으며(메뉴에 "Free, part of the same action"), 메뉴는 반대 순서도 순간이동의 예산으로 "Bite, then Teleport"로 제공하고, 그 뒤에 순간이동을 한 번 무료로 이어서 합니다. 어느 쪽도 세 번째로 이어지지 않습니다. 먼저 한 공격은 자체 사용 횟수와 재충전과 함께 순간이동의 것도 쓰며, 둘 다 남아 있을 때만 제공됩니다. 공격은 같은 생물의 또 다른 일반 행동이어야 합니다. 순간이동 자체, 연속 행동, 다른 순간이동, 반응, 점수로 사는 것은 안 됩니다. 생물의 순간이동만 지정할 수 있으며, 카탈로그 항목이나 아이템 사용의 순간이동은 거부합니다. 거리를 재지 않는 전투에서는 순간이동이 어디로도 가지 않으므로 짝을 짓지 않습니다. 디렉터도 이를 씁니다. 먹잇감까지 걸어가기에 너무 먼 생물은 같은 턴에 그 옆으로 순간이동해 물어뜯습니다.

빨아들이는 타격(Capability API 1.281). 카탈로그 항목의 `mechanics`나 생물 행동은 `drain`을 가질 수 있습니다. 사용자는 저항을 적용한 뒤 타격이 각 대상에게 준 피해만큼 체력을 되찾으며, 내림하고 최대치를 넘지 않으며, 대상의 최대치는 줄지 않습니다(그것은 `reducesMax` 참고). `share`(0 초과, 최대 1, 생략하면 전부)는 그중 얼마나 돌아오는지이고, `damageType`은 그 유형의 피해만 셉니다. 아볼레스의 Psychic Drain은 `drain: {}`, Vampiric Touch는 `drain: { "share": 0.5, "damageType": "necrotic" }`입니다. 회복을 막는 것은 이것도 막습니다. 빨아들이기에는 돌려줄 피해가 필요하므로 `amount`가 없는 항목, 회복, `damage`가 없는 생물 행동에 둔 것은 거부합니다.

사용자를 중심으로 한 폭발(Capability API 1.282). `area`(카탈로그 항목이나 생물 행동)는 `around: true`라고 할 수 있습니다. 사용자를 중심으로 한 크기 `size`의 폭발이며 겨누지 않습니다. 사용할 때 사용자로부터 `size` 이내의 모두가 휘말리며, `friendlyFire`가 false가 아니면 아군과 적 모두이고(회복하는 것은 사용자 편만), 사용자 자신은 결코 휘말리지 않습니다. 둘 사이의 벽은 생물을 막지만, 범위가 `throughWalls: true`라고 하면 막지 않습니다. 미라 군주의 Channel Negative Energy, "장벽 뒤나 모퉁이 너머의 생물도 포함"입니다. 보드가 없는 전투에서는 모두를 휘말리게 합니다. 아무도 겨누지 않으므로 턴에서처럼 턴 사이에 사는 고유 행동으로도 작동합니다. 사용자를 중심으로 하는 것은 단일 폭발뿐이며(`copies` 없음), `throughWalls`는 `around`와만 쓰고, 사용자 주위의 항목 폭발은 즉시 적용되므로 `zone`을 남기지 않습니다. Channel Negative Energy는 `signature: { "cost": 2 }`, `area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }`, 그리고 미라 군주의 다음 턴이 끝날 때까지 `{ "rounds": 1, "of": "source" }` 동안 `cannot-heal` 효과가 있는 상태를 `applies`하는 생물 행동입니다. 디렉터는 겨누는 형태를 평가하듯 누구를 휘말리게 하는지로 이를 평가합니다.

전설 이동(Capability API 1.283). `signature` 비용이 있는 생물 행동은 `move`만 하고 다른 일은 하지 않을 수 있습니다. 사용자는 턴 사이에 걸으며, 자기 턴의 걷기처럼 보드에서 칸을 고르고, 그 이동만을 위해 빌려준 허용량을 쓰므로 자기 턴의 이동량은 그대로입니다. `move: { "share": 0.5 }`는 속도의 비율이고("속도의 절반까지 이동"하는 타라스크), `move: { "distance": 60 }`은 규칙 집합 자체 단위의 거리, `move: {}`는 속도 전부입니다. `share`와 `distance`를 함께 쓸 수는 없습니다. 다른 걷기처럼 누군가의 근접 거리를 떠날 때 공격받으며, 구매한 창은 그 타격이 들어간 뒤 이어서 묻습니다. `noOpportunity: true`는 아무에게도 기회 공격을 유발하지 않습니다("기회 공격을 유발하지 않고 속도만큼 이동"하는 뱀파이어). `untouchable: true`는 아무것도 해치거나 붙잡을 수 없는 이동입니다(미라 군주의 Whirlwind of Sand, `{ "distance": 60, "untouchable": true }`). 사용자를 붙잡고 있던 것은 먼저 놓아주고, 아무도 공격하지 않으며, 지나가는 영역이나 지면도 아무 일도 하지 않습니다. 묶였거나 속도가 없는 생물은 다른 이동으로는 갈 곳이 없습니다. 보드 밖에서는 아무것도 제공되지 않습니다. 디렉터는 순간이동을 사듯 이를 삽니다. 크게 다쳤을 때 옆의 적에게서 벗어나거나, 닿는 적이 없을 때 다가가기 위해서입니다.

전설 시전(Capability API 1.284). `signature` 비용이 있는 생물 행동은 `casting`만 하고 다른 일은 하지 않을 수 있습니다. 턴 사이에 사용자가 자기 턴에 행동의 `budget`으로 시전할 수 있는 각 주문을 `spellcasting`이나 시트의 주문에서 "Cast a Spell: Fireball" 같은 이름으로 제공합니다. 각각은 생물의 턴과 똑같이 겨누고, 지불하고, 해결하며(대상, 범위의 칸, 늘 그렇듯 소모하는 슬롯이나 사용 횟수), 예산 대신 점수를 쓰므로 자기 턴에는 모든 예산이 그대로 남습니다. `casting: { "cantripsOnly": true }`는 소마법(어떤 풀에서도 지불하지 않는 주문)만 제공합니다. 리치의 Cantrip, `signature: { "cost": 1 }`입니다. 스핑크스의 Cast a Spell은 `signature: { "cost": 3 }`인 `casting: {}`입니다. 주문이 여는 것(Counterspell, 그 주문에 다치는 데 대한 반응)은 턴에서처럼 응답하며, 구매한 창은 그것이 모두 닫힌 뒤 이어서 묻습니다. 디렉터는 다른 고유 행동을 평가하듯 주문이 점수만큼 가치 있을 때 이를 삽니다.

행동 뒤의 이동, 그리고 한 가지 속도로 하는 이동(Capability API 1.285). 무언가 하는(피해, 범위, 내성, 상태) 고유 행동도 `move`를 가질 수 있습니다. 하는 일이 먼저 적용되고, 그다음 사용자가 행동과 함께 고른, 메뉴가 제시한 칸으로 이동할 수 있습니다. 고르지 않는 것도 선택이며, 한 일 뒤에 더 이상 닿을 수 없게 된 칸으로는 걷지 않을 뿐입니다. `move`는 `speed`로 이동 방식 하나(`walk`, `fly`, `swim`, `climb`, `burrow`)를 지정할 수도 있습니다. 그러면 `share`는 그 속도만으로 읽고, 그 방식으로만 이동하며, 그 속도가 없는 생물은 갈 곳이 없습니다. 드래곤의 Wing Attack은 자기 주위의 폭발(`area: { "shape": "burst", "size": 10, "around": true }`, 내성, 넘어짐)에 `move: { "share": 0.5, "speed": "fly" }`를 더한 것입니다. "그 뒤 드래곤은 비행 속도의 절반까지 날 수 있음" `move`에는 여전히 `teleport`, `sequence`, `reaction`, `charge`를 넣을 수 없습니다. 디렉터는 적 옆에서 크게 다쳤으면 날갯짓 뒤 날아가고, 닿지 않는 적에게는 다가갑니다.

가벼운 가림과 바람(Capability API 1.286). 영역의 `obscures`나 순간이동의 `smoke`는 `light: true`라고 할 수 있습니다. 그러면 아무도 숨기지 않고, 5e의 어둑한 빛이나 Cape of the Mountebank의 연기처럼 그 너머로 보이거나 그 안에 있는 대상을 가볍게 가리기만 합니다(Engine은 누가 그렇게 보이는지 알며, Hide와 Perception이 이를 읽습니다). `dispersed: true`라고 할 수도 있습니다. 그러면 규칙이 `disperses: true`인 영역이 둘이 만나는 곳마다, 모든 행동 뒤에, 그것을 유지하는 집중과 함께 이를 끝냅니다. 5e의 Fog Cloud는 `obscures: { "dispersed": true }`, Gust of Wind는 `disperses: true`인 영역입니다. Darkness는 어느 쪽도 아니므로 바람이 그대로 둡니다. 흩어 놓기만 하는 영역에는 계기가 필요 없습니다.

숨기, Search, Detect(Capability API 1.287). `combat.hiding`은 `hide` 표준 행동을 실제로 작동하게 합니다. `{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }`는 `combat.checks` 중 두 가지를 지정하고, 선택적으로 `passive`(10), `lightly`(5), 소리를 내는 `combat.components`를 지정합니다. Hide는 전투 자체 주사위로 `stealth`를 던집니다. 그러면 사용자는 자신을 똑똑히 보지 못하는(벽 뒤, 안개 속, 투명, 또는 가볍게 가려진 채로만 봄) 상대 중 수동 Perception이 합계 이하인 각 상대에게서 숨습니다. 수동 Perception은 `passive`에 `perception` 판정을 더한 값이며, 가볍게 가려진 채로만 보면 `lightly`만큼 뺍니다. 숨은 대상을 상대는 보지 못하므로 아무것도 겨눌 수 없고, 숨은 사람은 보이지 않는 사람으로서 공격하며, `combat.sight.unseenAttacks`가 그 공격에 이점을 줍니다. 숨기는 턴을 넘어 지속되며 다음과 같이 끝납니다. 사용자가 공격하거나, 겨루기를 하거나, 누군가를 해치거나, 내성을 요구하거나, `noisy` 구성 요소가 필요한 것을 사용하면 모두에게서 끝납니다(음성 구성 요소가 없는 주문이나 안개를 놓는 것은 숨은 상태를 유지합니다). 그리고 똑똑히 보게 되었거나 수동 Perception이 이제 합계를 넘는 각 상대에게서는, 매 단계 뒤와 걷기의 모든 칸에서 끝납니다. `search` 표준 행동(`combat.standard`에 추가. `combat.hiding` 필요)은 `perception`을 던져, 수색자에게서 숨은 사람 중 그 합계가 도달한 모두를 찾아냅니다. `search: true`인 생물 행동은 다른 일 없이 같은 일을 합니다. 전설 Detect는 `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`입니다. 생물은 두 판정을 자체 `checks`에서 읽습니다. 디렉터는 모든 상대가 숨었으면 수색하고, 하나라도 숨었으면 턴 사이에 Detect를 씁니다. 보드 밖에서는 이미 숨겨 주는 상태가 아니면 아무도 숨을 수 없습니다.

Ready(Capability API 1.288). `combat.readying: { "budget": "reaction" }`은 Ready 행동을 실제로 작동하게 합니다. 사용자가 지금 `standard` 예산으로 할 수 있는 각 선택지(공격, 주문, 생물 행동)와 걷기마다 메뉴는 두 항목을 제공합니다. 상대가 닿는 거리에 들어올 때(`comes`)와 상대가 행동할 때(`acts`)를 위해 준비하는 것입니다. 하나를 고르면 표준 예산을 쓰고 사용자의 다음 턴 시작까지 그 선택지를 보류합니다. 상대의 걷기가 어느 걸음에서든 보류한 선택지가 상대를 겨눌 수 있는 곳으로 오거나(보유자가 볼 수 있어야 함), 상대가 그곳에서 무언가를 마치면 창이 보유자에게 묻습니다. 보유자는 `budget`(5e의 반응)으로 `readied`라는 선택지를 쓰거나 보내 주며, 그 걷기에서는 다시 묻지 않습니다. 보류한 걷기는 보유자의 속도 전부가 닿는 만큼 가며, 걷는 중 근접 거리를 떠나면 다른 걷기처럼 기회 공격을 받습니다. `"concentrates": true`(`combat.concentration` 필요)이면 주문은 준비할 때 지불하고 집중으로 유지합니다. 발동할 때 다시 지불하지 않으며, 집중을 잃으면 함께 잃고, 발동하지 않은 주문은 소모된 채로 남습니다. 그 밖의 것을 준비하면 발동할 때까지 아무것도 지불하지 않습니다. 5e는 `{ "budget": "reaction", "concentrates": true }`입니다.

느린 흩어짐(Capability API 1.289). 안개의 `dispersed`는 `true` 대신 `{ "after": N }`일 수 있습니다. 그러면 닿은 바람은 처음 닿은 턴부터 세어 N 라운드 내내 연속으로 불어야만 안개를 끝냅니다. 그 전에 바람이 옮겨지거나, 끝나거나, 사라져 닿지 않게 되면, 다시 닿을 때 처음부터 셉니다. Gust of Wind 같은 강풍이 1라운드 뒤 흩어 놓는 5e의 Stinking Cloud는 `"obscures": { "dispersed": { "after": 1 } }`입니다.

숨은 대상 찾기를 정교하게(Capability API 1.290). 기술에서 읽는 전투 판정(`{ "skillMod": "stealth" }`)은 이제 던질 때 그 기술의 판정으로 세므로, `skills`로 그 기술에 좁힌 변경이 Hide, Search, 겨루기에 적용됩니다. 중갑의 Stealth 불리점, Pass without Trace의 +10, Eyes of the Eagle의 Perception 이점이 그 예입니다. `combat.hiding.passiveMode`(5e는 5)는 이점이 있는 수동 Perception에 더하고 불리점이 있는 것에서 뺍니다. 없으면 수동 값은 모드를 읽지 않습니다. 변경 `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }`는 보유자를 찾으려는 판정, 즉 상대의 수동 값과 Search 모두에 그 모드를 겁니다. `mode`만 받습니다. 5e의 Cloak of Elvenkind입니다. Search에서 어떤 대상 때문에 던지는 방식이 바뀌면 그 대상에 대해서만 따로 다시 던지며, 로그에 그 던지기도 나옵니다.

생물 자신의 숨기와 살피기 방식(Capability API 1.291). 생물 행동은 허용일 수 있습니다. `"standard": { "actions": ["disengage", "hide"] }`는 그 행동 자체 예산으로 하는 표준 행동(`combat.standard`에서)이며, 보너스 행동으로 하는 5e 고블린의 Nimble Escape가 그 예입니다. `"while": "obscured"`이면 생물이 안개나 연무 안에 서 있거나, 어둑한 빛이나 어둠 속에서 싸우는 전투에서만 유지됩니다. 섀도우의 Shadow Stealth입니다. 생물의 `checkModes`는 일부 기술로 하는 자체 판정을 두 번 굴립니다. `{ "skills": ["perception"], "mode": "advantage", "sight": true }`는 볼 수 있는 동안에만(Keen Sight), `"light": ["sunlight"]`이면 그 빛에서만(`"mode": "disadvantage"`인 Sunlight Sensitivity), `"terrain": ["snow"]`이면 지정한 보드 타일이나 장소 종류에서만 적용됩니다(Snow Camouflage. 장소는 Tactical 생성기의 것으로 snow, cave, mountains, water 등). 생물의 `passive`는 능력치 블록에 적힌 수동 Perception이며, `hiding.passive`에 판정을 더한 값 대신 씁니다(`combat.hiding` 필요). 전투의 빛은 장면의 시간대에서 옵니다. 낮의 야외는 햇빛, 새벽과 해 질 녘은 어둑한 빛, 밤은 어둠이며, 실내나 Engine이 읽을 수 있는 시간이 없을 때는 햇빛이 아닌 밝은 빛입니다. 빛은 이를 읽는 것(이 모드들과 `while: "obscured"`)에만 영향을 줍니다. `combat.sight.darkness`(1.294)가 없으면 누가 누구를 볼 수 있는지는 바뀌지 않습니다.

각자의 숨기와 숨은 대상 찾기 방식(Capability API 1.292). 카탈로그 항목의 `mechanics.hiding`(`utility`를 포함한 모든 종류)과 생물의 `hiding`은 `combat.hiding`이 실제로 숨기는 곳에서 읽는 허용입니다. `"behindLarger": true`는 보유자가 자신과 보는 사람 사이의 모든 선 위에 선, 최소 한 단계 큰 누군가의 뒤에 숨게 합니다(하플링의 Naturally Stealthy. `combat.sizes` 필요). `"still": 10`은 숨을 때 Stealth 합계에 그만큼 더하며, 움직이거나 행동하면 다시 뺍니다(레인저의 Hide in Plain Sight). `"slow": "advantage"`는 이번 턴에 속도의 절반 이하만 움직였을 때 Hide를 이점으로 굴립니다(도둑의 Supreme Sneak). `"aware": { "within": 10, "lostWith": ["deafened"] }`는 규칙 집합 자체 단위로 그 거리 안의 누구도 보유자에게서 숨지 못한다는 뜻이며, 보유자가 그 상태 중 하나를 가지면 예외입니다(로그의 Blindsense). 생물의 `"starts": 15`는 수동 Perception이 그 값을 넘지 못하는 이들에게서, 똑똑히 보든 안 보든 그 합계로 눈앞에서 숨은 채 전투를 시작하게 하며, 움직일 때까지 유지되고 Hide 행동으로 다시 그렇게 숨습니다(젤라틴 큐브의 Transparent).

두 번 굴리는 생물 자신의 공격 굴림(Capability API 1.293). 생물의 `attackModes`는 `checkModes`가 유지될 곳에서 유지됩니다. `{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }`는 5e의 Sunlight Sensitivity로, 볼 수 있고 햇빛 속에서 싸우는 동안 공격에 불리점을 받습니다. 각 모드는 `sight`, `light`, `terrain`으로 어디서 유지되는지 정합니다. 모드는 굴림의 다른 모든 이점, 불리점과 함께 세므로 둘은 여전히 상쇄됩니다.

어둠(Capability API 1.294). `combat.sight.darkness`가 있으면 전투의 빛이 눈으로 보는 것을 막습니다. `{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`. 어둠 속의 누구도 보이지 않고 어둑한 빛 속의 누구도 똑똑히 보이지 않습니다. 단, 범위 안의 `seeIn` 감각은 어둠을 어둑한 빛으로, 어둑한 빛을 밝은 빛으로 보고, 범위 안의 `blind` 감각이나 `pierced` 감각은 빛과 관계없이 봅니다. 어둠을 밝히는 것은 다음과 같습니다. `carried`는 `seeIn` 감각으로 볼 수 있는 사람을 빼고 시트로 싸우는 모두가 지니는 빛입니다(횃불). `light`는 상태(Light 소마법), 아이템의 `worn` 또는 `carried` 효과(랜턴), 생물(횃불을 든 산적, 불의 정령)에도 둘 수 있습니다. 각각 규칙 집합 자체 거리 단위의 `{ "bright": N, "dim": N }`이며, 그 거리만큼 밝은 빛, 다시 그만큼 어둑한 빛입니다. 벽은 빛을 막고, 쓰러진 사람은 빛을 내지 않습니다. 어둠이 실제로 작동하면 빛을 읽는 모든 것이 각자 선 곳의 빛을 읽습니다. 누가 누구를 보는지(보이지 않는 대상에 대한 공격, 숨기, 볼 수 있는 생물), 가려진 채 서 있는지(`while: "obscured"`), 생물의 `checkModes`와 `attackModes`입니다. 동굴이나 던전의 전투는 시간과 관계없이 어둠 속에서 싸웁니다.

빛을 끄고 다시 켜기(Capability API 1.295). `carried` 빛을 지닌 사람의 메뉴에는 그 `label`(`"Torch"`, 없으면 "Light")로 이름 붙은 스위치가 있습니다. `budget`을 지정했으면 그 예산이 들고, 아니면 턴에 한 번 무료입니다. 꺼진 빛은 아무것도 비추지 않으므로 보유자는 어둠 속에서 보이지 않을 수 있습니다. 다시 켜면 보이며, 숨어 있었다면 발견됩니다. `toggle`이 있는 아이템은 덮개 달린 랜턴처럼 켜진 동안에만 효과의 `light`를 냅니다.

생물과 아이템이 켜고 끄는 빛(Capability API 1.296). `"sheds": { "bright": 10, "dim": 10 }`이 있는 생물 행동은 그때부터 사용자가 내는 빛을 정하고, `"sheds": "out"`은 빛을 끕니다. 다른 일은 하지 않고 아무도 겨누지 않습니다. 매그민의 Ignited Illumination은 보너스 행동으로 하는 그런 행동 두 개이며, 윌오위스프의 Variable Illumination은 범위마다 행동 하나입니다. `"unlit": true`인 생물은 `light`가 꺼진 채 전투를 시작하며, 켜려면 행동 하나가 필요합니다. 아이템의 `toggle.offLight`는 꺼진 동안 효과의 빛 대신 내는 빛입니다. 덮개를 내린 덮개 달린 랜턴은 `{ "bright": 0, "dim": 5 }`를 냅니다. 밝은 범위가 없는 빛은 들고 있는 곳에서도 어둑한 빛만 냅니다.

영역의 빛, 그리고 어둠을 끝내거나 투명한 것을 드러내는 빛(Capability API 1.297). 주문 영역의 `lights`(다른 `light`처럼 피트)는 영역 자체 칸에만 빛을 내며 중심에서 잽니다. 중심은 폭발을 시전한 지점, 또는 시전자가 지니는 영역이면 시전자입니다. 따라서 불스아이 랜턴은 시전자에게 고정되고 `"lights": { "bright": 60, "dim": 60 }`이 있는 60피트 원뿔이며 뒤쪽은 밝히지 않습니다. Dancing Lights는 `{ "bright": 0, "dim": 10 }`인 움직이는 지점 영역 하나입니다. `"obscures": { "darkness": true }`인 가리는 영역은 마법적 어둠이며, `"dispelsDark": { "upTo": 3 }`인 영역은 둘 중 하나가 시전될 때 그 칸이 만나는, 슬롯이 그 레벨 이하인 그런 어둠을 모두 끝냅니다. Daylight가 그 예입니다. 영역, 아이템 효과, 상태, 생물에 있는 `"reveals": true` 빛은 그 밝은 빛 안에 선, 상태 때문에 보이지 않는 모두를 드러냅니다. lantern of revealing이 그 예입니다. 이들은 모두 Capability API 1.297이 필요합니다.

상태에 가려진 빛과 햇빛(Capability API 1.298). 생물의 `"lightOutWhile": ["invisible"]`은 그 상태 중 하나가 걸린 동안, 행동이 마지막으로 정한 것과 관계없이 자체 빛을 끄고 상태가 끝나면 되돌립니다. 윌오위스프의 Invisibility는 빛도 숨깁니다. 생물, 아이템 효과, 상태, 영역의 `"sunlight": true` 빛은 그 밝은 빛을 햇빛으로 만들며, 판정이나 공격 모드의 `"light": ["sunlight"]`가 읽는 것이 이것입니다. Sunlight Sensitivity에 맞서는 sun blade가 그 예입니다. 그 햇빛은 이미 밝은 보드 위에서도 셈에 들어갑니다.

빛에 맞서는 마법적 어둠(Capability API 1.299). `"dispelsLight": { "upTo": 2 }`가 있는 마법적 어둠 영역(`"obscures": { "darkness": true }`)은 둘이 만나는 곳마다, 무엇이 먼저 왔든 그 레벨 이하의 주문이 만든 빛을 끕니다. 영역의 `lights`, 또는 주문이 건 상태의 `light`이며, 후자는 주문의 집중이 유지하는 경우 그 집중과 함께 끝납니다(Flame Blade에 대한 5e의 Darkness). 전투가 어떤 빛에서 벌어지든 마법적 어둠의 칸은 마법적 빛만 밝힙니다. 영역이나 상태에 있는 주문의 빛은 항상 마법적이며, 다른 빛은 `"magical": true`라고 할 때 마법적입니다(sun blade의 빛). 어둠 안의 횃불은 그곳을 밝히지 않습니다. `"within": 60`인 `dispelsDark`는 중심에서 그만큼 가까운 어둠만 끝냅니다. Daylight의 밝은 구체가 그렇고, 그 너머의 어둑한 빛은 해당하지 않습니다. 이들은 모두 Capability API 1.299가 필요합니다.

몇 단계마다 한 번씩만 더해지는 높은 비용의 추가분(Capability API 1.300). `"perCostStepsEvery": 2`는 높은 비용의 단계마다가 아니라 두 단계마다 한 번 `perCostStep`을 더합니다. 상태가 주는 행동(1.236)은 이제 그 상태를 건 주문을 지불한 비용에 따라 자체 `perCostStep`, `perCostStepsEvery`, `perCostStepsMax`로 커집니다. 5e의 Flame Blade 타격은 `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`가 있는 `3d6`이므로, 4레벨 슬롯으로 불러낸 칼날은 4d6으로 공격합니다. `perCostStepsEvery`를 쓰려면 Capability API 1.300이 필요합니다.

누군가와 함께 다니는 영역, 그리고 떨어뜨려 놓는 사본(Capability API 1.301). 영역의 `"carried": "any"`는 누군가 선 칸에 놓은 폭발이 그 사람을 중심으로 그 사람을 따라다니게 합니다. 들고 있는 물체에 건 5e의 Darkness나 Daylight입니다. `"own"`이면 시전자가 선 칸만 해당하며, 시전자 자신이 든 물체에만 시전할 수 있는 주문용입니다. 빈 칸에 놓으면 그곳에 머뭅니다. 지니고 다니는 영역은 한 지점의 단일 폭발이며 스스로 옮겨지지 않습니다. 범위의 `"copiesWithin": 20`은 `copies`를 서로 맞닿게 하지 않고 각 중심이 다른 사본의 중심에서 20피트 이내가 되도록 놓으며, 시전자가 `move`할 수 있는 사본 영역은 모두 같은 방식으로 옮겨집니다. 5e의 Dancing Lights는 `"copies": 4, "copiesWithin": 20`과 `"lights": { "bright": 0, "dim": 10 }`이 있는 10피트 폭발입니다. 어느 쪽이든 Capability API 1.301이 필요합니다.

다른 항목을 바꾸는 항목(Capability API 1.302). 시트 목록에 있으며 `"amends": [{ "entry": "spells/eldritch-blast", ... }]`가 있는 항목은 보유자가 그 항목을 쓸 때마다 그것을 바꾸며, 여러 개가 중첩됩니다. `"damageAdd"`(`{ "abilityMod": "cha" }` 같은 값)는 명중마다 피해에 더해집니다(Agonizing Blast). `"range"`(규칙 집합 거리 단위)는 더 멀 때 사거리가 됩니다(Eldritch Spear의 300피트). `"push"`는 명중한 대상을 곧장 그만큼 밀어내며, `"pushOptional": true`는 "Eldritch Blast (no push)"로도 제공합니다(Repelling Blast). 사거리나 밀치기에는 `combat.distance`가 필요하며, 지정한 항목은 존재해야 합니다. Capability API 1.302가 필요합니다.

일부 빛에서만 하는 사용, 그리고 움직이거나 행동하면 끝나는 상태(Capability API 1.303). `"usableIn": { "light": ["dark", "dim"] }`이 있는 항목은 사용자가 그 빛 중 하나에 서 있는 동안만 제공됩니다. One with Shadows가 그 예입니다. 상태의 `endsWhenHolder`는 `attacks`와 `casts` 외에 `"moves": true`(보유자가 움직이면 끝남)나 `"acts": true`(보유자가 행동하거나, 공격하거나, 시전하면 끝남)라고 할 수도 있습니다. 그림자는 가만히 있는 워락을 숨깁니다. Capability API 1.303이 필요합니다.

휴식까지 생물당 한 번(Capability API 1.304). `"oncePerTarget": { "until": "long" }`(규칙 집합이 선언한 휴식)이 있는 항목은 사용자가 그 휴식을 할 때까지, 사이에 전투가 몇 번 있든 이미 사용한 생물에게는 제공되지 않습니다. Chains of Carceri가 그 예입니다. 누구에게 사용했는지는 사용자의 실시간 시트에 이름으로 보관하며, 그 휴식만 이를 지웁니다. 범위나 사용자를 겨누는 항목에는 쓸 수 없습니다. Capability API 1.304가 필요합니다.

시트에 따라 늘어나는 대상, 그리고 같은 대상을 다시 고르기(Capability API 1.305). `"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }`는 `scales`가 주사위를 더하듯 읽는 값의 각 단계에서 대상을 그만큼 더합니다. `"targetsRepeat": true`이면 같은 대상을 여러 번 고를 수 있으며, 각 선택은 자체 굴림을 가진 별도 공격이고 항목을 바꾸는 모든 것을 지닙니다. eldritch blast의 광선이 그 예이며, 각 광선에 Agonizing Blast의 피해와 Repelling Blast의 밀치기가 붙습니다. 전투의 대상 선택기는 여유가 있는 동안 클릭마다 광선 하나를 더하며, 전투원을 조종하는 Engine은 남은 광선을 고른 대상에게 몰아줍니다. 둘 다 범위나 사용자를 겨누는 항목에는 쓸 수 없습니다. Capability API 1.305가 필요합니다.

손에 쥐어 주는 무기(Capability API 1.306). `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }`가 있는 `"utility"` 항목은 무기의 모드처럼 사용할 때 고른 근접 무기 하나를 남은 전투 동안 사용자의 손에 쥐어 줍니다. `binds`는 일치하는 각 손에 든 무기도 제공하며, 고르면 그 무기가 이 무기로 셈해집니다. `proficient`이면 숙련으로 사용하고, 그 타격은 `qualities`를 지닙니다. 다시 사용하면 교체되며, 귀속된 무기는 원래대로 돌아갑니다. 불러내는 항목을 바꾸는 수정 항목은 그 무기에도 닿습니다. 수정 항목의 `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }`은 명중 시 자체 유형의 피해를 더하고(Lifedrinker), `"strikes": 2`는 공격 예산 한 번으로 그만큼의 공격을 사게 합니다(Thirsting Blade). 전투원을 조종하는 Engine은 가장 세게 치는 무기를 한 번 손에 쥡니다. Capability API 1.306이 필요합니다. Pact of the Blade가 그 예입니다.

사용자 자신이 유지하는 것(Capability API 1.307). 생물 자체 행동은 카탈로그 항목처럼 `"concentration": true`라고 할 수 있습니다. 그 행동이 건 것은 그 집중이 끝날 때 끝나며, 피해는 평소처럼 집중을 시험합니다. 임프나 쿼짓의 Invisibility가 그 예입니다. 상태의 `endsWhenHolder`는 `"uses": ["scare", "spells/bolt"]`라고 할 수도 있습니다. 보유자가 그중 하나(생물 자체 행동은 ID로, 카탈로그 항목은 `<catalog>/<entry>`로)를 쓰면 끝납니다. 쿼짓의 투명은 Scare를 쓰면 끝납니다. 항목의 `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]`는 대상에게 무슨 일이 일어나든 사용할 때 사용자 자신에게 그 상태를 걸며, 집중이 있으면 그 집중으로, 시전한 레벨로 유지합니다. Sunbeam의 빛 알갱이이며, `light`와 이후 광선을 위한 `"actions": ["spells/sunbeam-line"]`이 있는 전투 상태입니다. 항상 투명한 생물에는 새것이 필요 없습니다. `keepsOn: ["invisible"]`(1.263)이 상태를 유지해 줍니다. Capability API 1.307이 필요합니다.

1.303부터 1.306까지 남은 것(Capability API 1.308). 두루마리나 완드의 `use`는 사용자 시트에서 읽는 `targetsScale`과 `targetsRepeat`을 가질 수 있습니다. eldritch blast 두루마리는 읽는 사람이 5레벨이면 광선을 하나 더 쏘고, 완드의 다트는 모두 한 생물에게 갈 수 있습니다. Capability API 1.308이 필요합니다. 세 가지 변경에는 새 키가 필요 없습니다. 반응도 행동입니다. `endsWhenHolder`가 `"acts": true`인 상태는 One with Shadows가 "반응"에 끝나듯 보유자가 하는 모든 반응에도 끝납니다. `oncePerTarget`은 이름이 같은 두 생물을 구분합니다. 한 임프에게 쓴 Chains of Carceri는 다른 임프를 막지 않으며, 나중 전투의 임프는 그 이름이 바로 그 한 생물의 것이었을 때만 막힙니다. 손에 쥐어 주는 무기(1.306)는 투척 근접 무기(단검이나 투창처럼 `reach`와 `range`가 모두 있는 공격)일 수 있습니다. 전투 메뉴에서 행동 없이 해제하며, 만든 이가 죽으면 사라집니다. 전투는 그것을 만든 이의 손에서 빼지 않으므로 만든 이에게서 5피트 넘게 떨어지지 않습니다.

숨기의 조건, Feral Senses, 기습, 귀속 의식(Capability API 1.309). `still`이 있는 `hiding`은 `"stillWhile": { "holds": "camouflaged", "wall": true }`라고 할 수 있습니다. 보너스는 보유자가 그 상태(1분짜리 utility 항목으로 미리 만들거나 전투 전에 설정한 위장)를 가진 동안, 그리고 `wall`이 있으면 시야를 막는 칸 옆에 서 있는 동안만 셉니다. Hide in Plain Sight가 그 예입니다. `"unseenStrikes": true`는 보유자가 볼 수 없는 누군가를 공격할 때의 불리점을 없애며, Feral Senses의 앞 절반입니다. 뒤 절반에는 아무것도 필요 없습니다. 전투는 숨지 않은 모든 생물의 위치를 이미 알기 때문입니다. `starts`가 있는 생물의 `hiding`은 `"surprises": true`라고 할 수 있습니다. 젤라틴 큐브의 Transparent처럼, 생물이 숨은 채 시작한 상대는 기습당한 채 전투를 시작합니다. `binds`가 있는 `conjures`는 `"boundIn"`에 실시간 텍스트 필드를 지정할 수 있습니다. 거기 적힌 손에 든 무기만 귀속되며, 비어 있으면 아무것도 귀속되지 않습니다. 거기 이름을 적는 것이 전투 밖, 짧은 휴식 중에 하는 한 시간짜리 의식입니다. Capability API 1.309가 필요합니다.

반복, 그리고 거리가 멀어지면 끝나는 상태(Capability API 1.310). 집중 항목의 mechanics는 `"repeats": { "budget": "action" }`라고 할 수 있습니다. 사용자가 그것에 집중하는 동안 그 효과를 그 예산으로 다시 제공하며, 시트에서 아무것도 들지 않고, 새 집중을 시작하지 않고, 사용자에게 아무것도 다시 걸지 않으며, 시전을 지불한 레벨과 비용 단계로 합니다. 메뉴에는 "Vampiric Touch again"으로 나옵니다. `"notSaved": true`는 이 시전에 대한 내성에 성공한 생물에게는 제공하지 않으며(Eyebite), `"sameTargets": true`는 시전이 겨눈 대상에게만 제공합니다(보너스 행동의 Heat Metal). `repeats`에는 `concentration`과 알려진 예산이 필요합니다. `applies`는 `"endsAway": { "beyond": 60, "unseen": true }`라고 할 수 있습니다. 보유자가 상태를 건 사람에게서 그보다 멀리 서고, `unseen`이 있으면 그 사람을 볼 수도 없게 되면 상태가 해제됩니다. Eyebite의 공황이 그 예입니다. 누구의 걷기든 그 모든 걸음과 모든 턴이 끝날 때 확인합니다. Capability API 1.310이 필요합니다.

1.307과 1.309에서 남은 것(Capability API 1.311). 아이템의 `use`는 항목의 mechanics처럼 `appliesSelf`를 가질 수 있습니다. Sunbeam 두루마리는 빛 알갱이와 함께 이후 광선을 읽는 사람의 손에 남기며, 읽기의 집중으로 유지합니다. 생물 행동은 `"dyingOnly": true`(체력이 없지만 아직 살아 있는 생물만 고를 수 있음), `"slaysOnFailedSave": true`(행동 자체 내성에 실패한 대상은 죽음), `"healsOnSlay": { "dice": "3d6" }`(죽은 대상마다 생물이 그만큼 회복)이라고 할 수 있습니다. 윌오위스프의 Consume Life가 그 예입니다. `slaysOnFailedSave`에는 `save`가, `healsOnSlay`에는 `slaysOnFailedSave`가 필요합니다. `combat.conditions`의 규칙은 `"endsWhenHolder": { "moves": true, "acts": true }`라고 할 수 있습니다. 어떻게 걸렸든 보유자의 첫 걸음(`moves`)이나 Hide를 뺀 모든 행동(반응 포함, `acts`)에 상태가 보유자와 그 시트에서 해제됩니다. 전투 전에 시트에 체크해 두는 Hide in Plain Sight의 위장이 그 예입니다. Capability API 1.311이 필요합니다.

명중 주위의 천둥(Capability API 1.312). 무기의 모드는 `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`라고 할 수 있습니다. 그 모드로 명중하면 맞은 대상과 그로부터 `within` 이내에 선 모두가 내성을 굴리거나 `condition`을 받습니다. 그만큼 가까이 선 아군과 사용자도 포함됩니다. `rounds`는 그들 자신의 턴으로 세며, `of: "source"`이면 사용자의 턴으로 세므로 `rounds: 1, of: "source"`는 "사용자의 다음 턴이 끝날 때까지"입니다. `of`에는 `rounds`가 필요합니다. 보드 밖에서는 맞은 대상만 내성을 굴립니다. 모드의 `range`, `charges`와 함께 쓰면 충전 하나로 던지는 Hammer of Thunderbolts가 됩니다. 그 Giant's Bane은 `when: "critical"`인 무기의 `slay`입니다. Capability API 1.312가 필요합니다.

Maze, Expeditious Retreat, 한 시전의 선택지, 상한이 있는 능력치 더하기(Capability API 1.313). `while`이 있는 `dismisses`는 `"turns": true`라고 할 수 있습니다. 생물은 전투 밖에 있지만 여전히 턴을 가지며, 그 턴에는 자신을 떨어뜨려 놓는 상태를 끝내는 것이나 턴 종료만 제공됩니다. `applies`는 `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }`를 가질 수 있습니다. 보유자는 표준 예산을 써서 그 숫자를 상대로 그 `combat.checks` 판정을 해 상태를 끝낼 수 있습니다. `passes`에 해당하는 생물은 굴리지 않고 성공합니다. 이 둘을 합치면 5e의 Maze와 그 미노타우로스가 되며, 판정에 성공하면 원래 자리로 돌아옵니다. 항목의 mechanics는 `"takes": ["dash"]`(또는 `disengage`, `dodge`)라고 할 수 있으며, 사용자는 사용할 때 그 표준 행동을 합니다. Expeditious Retreat는 시전할 때 Dash합니다. 그 뒤의 보너스 행동 Dash는 그 상태의 `grants`에서 옵니다. `repeats`는 `group`을 지정할 수 있습니다. 한 그룹의 항목은 한 시전의 선택지이며, 그중 하나에 집중하는 동안 모두가 다시 제공됩니다. Eyebite의 잠듦, 공황, 구역질처럼 `notSaved`와 시전 레벨은 공유됩니다. 아이템의 능력치 변경 `{ "add": 4, "max": 30 }`은 모든 `set`이 남긴 점수 위에 `max`까지 더해지며, 이미 그보다 높은 점수를 낮추지 않습니다. `max`가 없으면 더하기는 이전과 같습니다. 아이템의 `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }`는 같은 캐릭터가 각 그룹의 아이템 하나를 착용한 동안(그 아이템이 귀속하는 것이면 귀속한 상태로)만 귀속할 수 있게 하며, 그중 하나를 벗거나, 귀속을 풀거나, 가방에서 사라지면 즉시 귀속을 풉니다. `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }`와 함께 쓰면 Hammer of Thunderbolts가 됩니다. Capability API 1.313이 필요합니다.

Resilient Sphere(Capability API 1.314). `combat.conditions` 항목은 `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`를 가질 수 있습니다. 상태가 유지되는 동안 보유자는 다른 모두에게서 차단됩니다. 다른 누구도 보유자에게 무엇도 겨눌 수 없고, 범위나 폭발은 보유자를 지나치며, 영역과 오라를 포함해 다른 누구에게서 온 것도 보유자를 해치거나, 회복하거나, 상태를 걸지 못합니다. 보유자의 것도 다른 누구에게 닿지 않으며, 보유자가 움직일 때 아무도 공격하지 않고 보유자도 아무도 공격하지 않습니다. 보유자 자신의 이동량은 0이지만, `rolls`가 있으면 그 예산을 써서 속도의 `share`까지 굴러갈 수 있습니다. `lifted`가 있으면 바로 옆에 선 누군가가 그 예산을 써서 보유자를 들어 올릴 수 있습니다. 그 뒤 보유자는 드는 사람이 무료로 내려놓거나 상태가 끝날 때까지 드는 사람이 걷는 대로 따라갑니다. `brokenBy`의 항목은 여전히 보유자를 겨눌 수 있으며, 원래 하는 일 대신 상태와 그것을 유지하는 집중을 끝냅니다. 구체에 대한 Disintegrate가 그 예입니다. 항목의 mechanics는 `combat.sizes` 중 하나인 `"targetsUpTo": "large"`라고 할 수 있으며, 그러면 그 크기 이하의 생물만 겨눕니다. Resilient Sphere의 "Large 크기 이하"입니다. Capability API 1.314가 필요합니다.

본거지 행동(Capability API 1.315). 생물 행동은 `"lair": true`를, 생물은 `"lairInitiative"`(생략하면 20)를 가질 수 있습니다. 생물이 자기 본거지에서 싸우는 동안(그 적에 대한 Game Master의 `"inLair": true`, 또는 조우의 `inLair` 목록), 전투의 순서가 본거지의 숫자를 지날 때 라운드마다 본거지 행동 하나를 하며 동률에서는 뒤로 갑니다. 그 숫자가 사이에 오는 두 턴 사이, 모두가 그 숫자 이상이면 라운드의 마지막 턴 뒤, 모두가 그 숫자 미만이면 맨 첫 턴 전입니다. 같은 본거지 행동을 두 라운드 연속으로 할 수는 없습니다. 본거지 행동은 그것을 위해 빌려준 `budget`으로 자기 턴처럼 겨누고 해결하며, 생물 자신의 턴에서는 아무것도 쓰지 않습니다. 생물 자신의 턴 메뉴에는 나오지 않으며, 생물이 쓰러졌거나 행동할 수 없는 동안에는 하지 않습니다. 본거지 행동은 반응도 아니고 점수로 사는 것도 아니며, 연속 행동이 이를 지정할 수 없고, `lairInitiative`에는 본거지 행동이 하나 이상 필요합니다. 5e의 드래곤은 우선권 20에서 본거지 행동을 합니다.

소품(Capability API 1.316). 보드 위의 전투에는 부술 수 있는 소품이 서 있을 수 있습니다. 조우의 `board.props`, 또는 월드 전장에 칠해 둔 `props`입니다. 각각 `label`, 차지하는 `cells`, `health`, `defense`(생략하면 10), 선택적 `resist`, `vulnerable`, `immune` 피해 유형을 가집니다. `blocks`는 서 있는 동안 그 칸을 걷기(`move`), 보기(`sight`), 또는 둘 다에 대해 막으며, 아무도 그 안에서 전투를 시작하지 않습니다. `fragile` 소품은 명중하는 모든 것에 부서집니다. 벽 구획을 칠 수 있는 공격은 대신 소품을 칠 수 있습니다. 선택지의 `walls`에 나열되며 선택의 `wall`이 그 칸을 지정합니다. 범위는 닿는 모든 소품을 휘말리게 하고 다른 모두에게 굴린 것과 같은 피해를 줍니다. 소품은 내성을 굴리지 않습니다. 0이 된 소품은 부서집니다. 더 이상 아무것도 막지 않으며, 라벨이 보드의 `broken` 목록, 전투 요약, Game Master가 읽는 요약에 더해집니다(`Broken: Sluice Gate; Oil Jar`). 이야기의 `broke` 계기가 이에 대해 발동합니다.

Legendary Resistance(Capability API 1.317). 생물의 `"legendaryResistance": 3`은 전투에서 처음 세 번 실패한 내성을 성공으로 바꿉니다. 5e의 "드래곤이 내성에 실패하면 대신 성공을 선택할 수 있음"(하루 3회)입니다. Engine은 상태가 자동으로 실패시키는 내성을 포함해 어떤 내성에서든 항상 그렇게 선택하며, 생물이 쓰러진 동안에는 하지 않습니다. 내성은 굴린 대로 기록되고, 그 뒤에 대신 성공했다는 줄과 남은 횟수가 나옵니다. 1부터 20까지의 정수입니다.

아이템 사용도 1.314부터 항목의 mechanics가 그렇듯 `"targetsUpTo"`를 가질 수 있습니다(Capability API 1.317). Resilient Sphere 두루마리의 `"targetsUpTo": "large"`는 그 크기 이하의 생물에게만 닿습니다. `combat.sizes`를 읽으며, 범위가 아닌 생물을 겨누는 사용에 씁니다.

보드 이벤트와 수풀(Capability API 1.318). 전투의 보드는 라운드가 지나며 스스로 바뀔 수 있습니다. 조우의 `board.events`, 또는 월드 전장에 칠해 둔 `events`입니다. 각 이벤트는 `id`와 선택적 `label`을 가지며, `"round-start"` 또는 `"round-end"`의 `at`에, `from` 라운드부터(생략하면 라운드 시작은 2, 끝은 1), `every` 라운드마다(1), `until`이 있으면 그 라운드까지 일어납니다. `where`는 칸을 지정합니다. `cells`, `block`(`x`, `y`, `w`, `h`), 처음에는 `start`칸, 그 뒤 매번 `step`칸씩 더 닿는 한 칸(`x`, `y`) 주위의 `ring`, 같은 `start`와 `step`으로 한쪽 가장자리(`from` `north`, `south`, `east`, `west`)에서 들어오는 `sweep`, 또는 수풀 옆의 모든 빈칸인 `{"spread": "growth"}`입니다. 고리나 쓸기는 처음에도 가장 새로운 띠, 즉 `step`칸 깊이(최소 한 칸)에만 닿으므로 `start`가 3인 고리는 가운데를 그대로 둡니다. `filled`는 안쪽 전체에 닿습니다. `onlyOn`은 그 지형의 칸으로 한정합니다. `change`는 그곳에서 일어나는 일을 정하며 다음 중 하나 이상입니다. `terrain`, `height`(0~3), `light`(`bright`, `dim`, `dark`, `sunlight`, `clear`), `obscured`(`light`, `heavy`, `clear`), `growth`(true 또는 false), `season`(이름, 또는 없애려면 null), `rotate`(정사각형 `block`만. 타일, 높이, 지면, 완전히 안에 있는 소품과 사람과 함께 시계 방향으로 90도씩 1, 2, 3번 회전), 그리고 로그가 일반 줄 대신 말하는 줄인 `tell`입니다. 아무도 설 수 없는 곳(깨져 물이 된 얼음)에 남은 사람은 가장 가까운 빈칸으로 옮깁니다. 보드는 이벤트를 최대 32개 담습니다.

실려 가기(Capability API 1.329). 보드 이벤트의 `change`는 `push`, `{"toward": "east", "squares": 3}`(가장자리 `north`, `south`, `east`, `west` 중 하나와 1~6칸)라고도 할 수 있습니다. 그 칸의 땅에 선 사람은 그 방향으로 한 칸씩 실려 가며, 보드 밖, 벽이나 닫힌 소품 안, 아무도 설 수 없는 땅, 다른 누군가가 있는 곳으로는 가지 않고, 이 때문에 아무도 그들을 공격하지 않습니다. 그 가장자리에 가장 가까운 사람이 먼저 가며, 공중에 있는 사람은 그대로 둡니다. 로그는 누가 실려 갔는지 알려 줍니다. Mill of Hours의 물방아 수로가 그 예입니다. 또는 같은 형태의 `drift`도 있습니다. 그 칸을 가리는 것(가벼운 가림이든 짙은 가림이든)이 그 방향으로 날려 가고, `block`의 반대쪽, 다른 `where`면 보드의 반대쪽으로 다시 들어옵니다. 칸의 다른 것은 움직이지 않으며, 가벼운 가림이 날려 와도 짙은 가림은 그 자리에 남습니다. Leaffall의 표류가 그 예입니다. 전장에 칠해 둔 이벤트는 둘 다 받습니다.

수풀이 있는 칸은 들어가는 비용이 두 배이며(다른 험한 땅보다 더 들지는 않음) 그 안에 선 사람을 가볍게 가립니다. 피해 유형이 수풀을 베는 타격(보드의 `growth.cutBy`가 달리 정하지 않으면 참격)은 닿는 수풀 칸을 겨눌 수 있으며 선택지의 `walls`에 나열됩니다. 굴림 없이 그 칸을 치우고 행동을 씁니다. 수풀을 태우는 유형의 피해(`growth.burnedBy`가 달리 정하지 않으면 화염)는 떨어지는 모든 칸, 즉 범위 전체나 명중한 사람의 칸에서 수풀을 태워 없앱니다. `"clears": "growth"`와 `area`가 있는 항목의 mechanics나 아이템 사용은 그 범위에서 수풀을 치웁니다. 전지가위는 `{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`입니다. 조우의 `board.ground`는 처음부터 칸에 수풀, 빛, 가림, 계절을 칠하며, 월드 전장은 수풀을 `g`와 `.`로 이루어진 `growth` 행으로, 계절을 Experience와 같은 방식으로 칠합니다.

그늘, 빛 규칙, 종소리, 빛을 꺼리는 것(Capability API 1.319). `"shade": true`인 빛은 그늘을 드리웁니다. `dim`이 닿는 곳까지 어둑한 빛이며, 그곳의 밝은 빛과 햇빛도 무엇이 비추든 어둑해집니다. 밝은 빛이 없으며 `reveals`도 `sunlight`도 아닙니다. 그늘은 마법적 어둠 안으로는 닿지 않습니다. 쇼케이스의 Lantern of Dusk는 `{"light": {"bright": 0, "dim": 15, "shade": true}}`로 지니는 아이템입니다. 칸 자체의 빛(1.318)과 그늘은 눈이 그곳에서 읽는 것이기도 합니다. 밝은 보드에서도 어두운 칸에 선 생물은 어둠 속을 보는 감각이 아니면 보이지 않습니다.

전투의 보드에는 빛 규칙이 있을 수 있습니다. 조우의 `board.lightRule`, 또는 월드 전장에 칠해 둔 `lightRule`입니다. 각 라운드가 끝날 때 그 빛(`in`. 지정하지 않으면 밝은 빛과 햇빛이며, 밝은 빛에는 햇빛이 포함됨) 중 하나 안에 완전히 선 모두는 그곳에서 라운드 끝을 하나 더 세며, `rounds`번째(지정하지 않으면 1)마다 그들의 `tracks`가 `by`만큼 움직이고 `applies` 상태가 걸립니다. 한 칸의 그늘로라도 벗어나면 다시 처음부터 셉니다. `spares`는 결코 건드리지 않는 생물의 `types`와 `tags`를 지정합니다. 시트에 있는 트랙을 움직이지 않고 전투가 아는 상태도 걸지 않는 규칙은 아무것도 하지 않으므로 버립니다. Noonfield는 `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`입니다. 햇볕 아래 1분마다 탈진 한 단계입니다.

빛 규칙 내성(Capability API 1.321). 빛 규칙의 `save`(`save`, `difficulty`)는 규칙이 막 건드리려는 각 생물이 굴리며, 성공하면 이번에는 벗어납니다. 어느 쪽이든 셈은 다시 시작합니다. 그 `against`(전투가 아는 `conditions`, `damage` 유형)는 내성이 무엇에 대한 것으로 셀지 정하므로, 일치하는 `against`를 가진 내성 수정치가 적용됩니다. `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`로 착용하거나 지닌 밀짚모자가 그 예입니다. 트랙 항목의 `upTo`는 규칙이 트랙을 옮기는 한계이므로, 이를 넘을 탈진은 거기서 멈추고 도달한 뒤에는 더하지 않습니다. 작성된 Noonfield는 `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`이며, 모자가 지정하도록 Experience가 `noon_light` 상태를 더합니다.

반응으로 하는 아이템 사용(Capability API 1.322). 아이템의 `use`(또는 그 `moreUses` 중 하나)는 카탈로그 항목처럼 `reaction`을 가질 수 있으며, 그러면 그 순간이 열릴 때만 제공되고, 다른 사용처럼 `budget`(보유자의 반응)과 충전이나 아이템 자체로 지불합니다. Liesl's Coffin은 하루에 한 번, 보유자로부터 5피트 이내의 생물이 명중당할 때 보유자의 다음 턴 시작까지 그 생물에게 AC +5를 주며 그 명중에도 적용됩니다. `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}`가 있는 아이템의 `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}`입니다. Straw Proxy는 주인을 겨눈 공격을 무산시키고 대신 타 버립니다. `{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`입니다. 아이템 사용은 그 순간을 지정해야 하며 `"reaction": true`는 거부합니다.

Held Ground와 거두기(Capability API 1.323). 전투는 죽음이 붙잡힌 곳인 Held Ground에서 벌어질 수 있습니다. 이야기의 지역 규칙이 전투에 넘겨주는 전투의 `heldGround`(`label`, `condition`, `[{"track", "by"}]` 형태의 `marks`)입니다. 그곳에서는 체력이 0이 된 사람이 죽거나 쓰러지는 대신 붙들립니다. 상대는 전투에서 빠지고, 캐릭터는 안정된 채 누워 죽음 굴림을 하지 않고 다쳐도 실패를 받지 않으며, 평소처럼 회복받을 수 있습니다. 붙들린 이들은 그 `condition`(캐릭터는 규칙 집합 자체의 쓰러짐 상태도)을 받고, 시트가 있는 각자는 `marks` 트랙을 움직입니다. 쇼케이스의 Owing 표시입니다. 즉사시킬 것도 대신 붙들리게 합니다. 생물 행동이나 아이템 공격의 `reaps` 타격은 붙들리게 한 대상을 거둡니다. 그들은 쓰러진 채 남고 상태도 표시도 받지 않으며, 거둔 캐릭터는 죽습니다. Reaping Hook은 `attack`에 `"reaps": true`가 있는 무기입니다. 붙들린 전투원과 거둔 전투원은 `felled`와 `reaped`를 지니며, 이야기가 나중에 붙들린 이를 일으킬 수 있습니다.

Held Ground의 해제(Capability API 1.330). 이야기는 해가 바뀔 때 전투 도중 Held Ground를 해제할 수 있습니다. 디렉터의 `releaseRulesetHeldGround(definition, state, release)`(그 아래의 공유 `rulesetReleaseHeldGround`)입니다. 그때부터 체력이 0이 된 사람은 다른 곳처럼 죽거나 쓰러집니다. 거두지 않은 붙들린 이들은 상대든 캐릭터든 죽습니다. 단, `release.felled`가 `"down"`이면 캐릭터는 대신 쓰러지고 규칙 집합 자체 규칙에 따라 죽어 가기 시작합니다. `release.owing`(`{"track"?, "bonus"?}`. 트랙을 생략하면 Held Ground가 표시하는 첫 트랙)이 있으면 각 캐릭터의 그 트랙 표시가 청산됩니다. 표시 하나마다 규칙 집합의 죽음 내성 하나를 굴리며, 각각에 `bonus`(파티의 Debts Settled)를 더하고, 표시가 다하거나 결과가 정해질 때까지 죽음 규칙의 자연 눈 규칙대로 굴립니다. 그 뒤 표시는 소모됩니다. 실패 세 번(실패 트랙의 최대치)은 죽음입니다. 로그는 누가 죽고 누가 쓰러졌는지, 그리고 각 캐릭터의 굴림을 알려 줍니다. Held Ground가 아닌 전투는 그대로 둡니다.

생물의 범위와 지면(Capability API 1.324). `area`가 있는 생물 행동은 카탈로그 항목의 영역처럼 작성한 `zone`(`rounds`, `triggers`, `obscures`, `terrain` 등)으로 그 범위를 세워 둘 수 있습니다. The Owed의 Freezing Fog, Scatter Flour의 밀가루 정육면체, 얼어붙어 험한 땅이 되는 지면이 그 예입니다. `"untilLair": true`인 영역은 `rounds`가 먼저 끝내지 않았다면, 만든 이의 본거지 순서가 다음에 돌아올 때 그 본거지 행동을 고르기 전에도 끝납니다. "다음 본거지 행동까지"입니다. 생물 행동은 대신 `ground`로 범위가 덮는 지면을 영구히 바꿀 수 있으며, 보드 이벤트의 `change`처럼 씁니다(`terrain`, `height` 0~3, `light`, `obscured`, `growth`, `season`, 로그용 `tell`). 모닥불이 사그라들고(`"light": "dark"`), 얼음이 깨집니다(`"terrain": "water"`). 아무도 설 수 없는 칸에 남은 사람은 가장 가까운 빈칸으로 옮깁니다. 둘 다 행동의 `area`가 필요하며, `ground`는 무언가를 바꿔야 합니다. 둘 중 하나를 쓰거나 어디서든 `untilLair`를 쓰는 규칙 집합은 Capability API 1.324가 필요합니다.

전투로 불려 오는 생물(Capability API 1.325). 생물 행동은 `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }`라고 할 수 있습니다. 사용하면 지정한 도감 생물(규칙 집합의 카탈로그나 전투에 넘겨준 도감의 `"<catalogId>/<entryId>"`. `count`는 `{"dice"}`, `{"flat"}` 또는 둘 다이며 한 번에 최대 여덟)이 그만큼 사용자 편으로 전투에 합류하며, 전투가 자체 생물을 만들 듯 만들어지고 하나씩 이름이 붙습니다("Zombie 1", "Zombie 2"). `area`가 있으면 겨눈 곳에, 가득 차면 자리가 있는 가장 가까운 곳에 놓이며, 없으면 부른 이 옆에 놓이고 행동은 아무도 겨누지 않습니다. 그들은 자체 우선권을 던져 순서에 자리를 잡습니다. 이번 라운드의 턴이 이미 지나간 자리라면 다음 라운드의 자리입니다. `"initiative": "after"`이면 대신 부른 이의 턴 바로 뒤에 턴이 옵니다. 본거지 행동도 부를 수 있으며(Shelves Lean), 그 순서가 사이에 끼어든 턴은 그대로 이어집니다. 전투가 시작될 때 어디서도 찾을 수 없는 생물은 아무도 부르지 않으며, 전투는 최대 40명까지 담습니다. 로그는 누가 왔는지 알려 줍니다. `calls`를 쓰는 규칙 집합은 Capability API 1.325가 필요합니다.

생물에게 끌려가기(Capability API 1.326). 생물 행동은 `"draws": { "spends": "reaction" }`이라고 할 수 있습니다. 맞은 대상(`save`가 있으면 실패한 대상만)은 그 자리에서 그 예산을 써서, 생물에게 가장 가까운 닿을 수 있는 칸까지 트인 길로 속도만큼 생물을 향해 걸으며 공격을 유발하지 않습니다. 그 예산이 남지 않았거나 더 가까이 갈 수 없는 사람은 아무것도 쓰지 않고 그대로 있습니다. The Owed의 Whisper a Name이 그 예입니다. `spends`는 행동 체계의 예산 중 하나입니다. `draws`를 쓰는 규칙 집합은 Capability API 1.326이 필요합니다.

본거지 타이밍(Capability API 1.327). `"actedOnly": true`인 생물 행동은 진행 중인 턴을 포함해 이번 라운드에 이미 턴을 시작한 사람만 겨눌 수 있습니다. 전투의 맨 첫 턴 전, 본거지가 모두보다 먼저 행동하는 동안에는 아무도 해당하지 않습니다. Hour Bell의 "이번 라운드에 이미 행동한 생물 하나"입니다. 상태의 지속 시간은 `rounds`에 `"untilLair": true`를 더할 수 있습니다. 상태를 건 사람의 본거지 순서가 다음에 돌아올 때, 그 본거지 행동을 고르기 전에도 해제됩니다(Hour Bell의 "다음 본거지 행동까지"). `concentration`으로 유지하는 생물 행동은 자신의 본거지 행동 하나를 `"brokenNextLair"`로 지정할 수 있습니다. 그 집중이 깨지면(피해, 쓰러짐, 영역이 하는 일로. 보유자가 직접 끝내거나 다른 것을 시작한 경우는 제외), 지난 라운드에 무엇을 했든 그 본거지 행동이 다음 본거지 행동이자 유일하게 제공되는 것이 됩니다. 한 번 하면 다시 자유롭게 고릅니다. Father Ivo의 Litany of Keeping과 기우는 선반이 그 예입니다. 이 중 하나라도 쓰는 규칙 집합은 Capability API 1.327이 필요합니다.

상태가 옮기는 내성 난이도(Capability API 1.328). 상태의 변경 `{ "to": "save-difficulty", "flat": -2 }`는 보유자가 상태를 가진 동안 요구하는 모든 내성의 난이도를 옮깁니다. 보유자 행동 자체의 내성과, 그 행동이 건 것을 끝내는 내성에 주어진 내성 난이도입니다. `flat` 양만 받으며, 판정 난이도, 집중 내성(피해로 정해짐), 행동이 전투로 부르는 생물에는 닿지 않습니다. Miller of Hours의 Un-age는 주문 내성 DC를 2 낮춥니다. 이를 쓰는 규칙 집합은 Capability API 1.328이 필요합니다.

소품과 먹이(Capability API 1.331). 전투 상태는 `"whileNearProp": {"prop": "Year-Wheel", "within": 10}`이라고 할 수 있습니다. 보유자가 그 라벨을 가진 보드의 서 있는 소품으로부터 그 거리(규칙 집합 자체 단위) 안에 서 있는 동안만 유지되며, 그 밖의 곳이나 소품이 부서진 뒤에는 끝나지 않고 보류됩니다. 보드가 없는 전투에서는 유지됩니다. Wheel's Favour가 그 예입니다. 생물 행동의 폭발 `area`는 `"aroundProp": "Shelf"`라고 할 수 있습니다. 어디를 겨누든 그 라벨을 가진 서 있는 소품으로부터 `size` 이내의 모든 칸을 소품 뒤까지 덮습니다. Granary의 선반 줄 주위의 Shelves Lean이 그 예입니다. 오라는 `"feeds": 15`라고 할 수 있습니다. 오라가 닿는 누군가가 붙들리거나, 쓰러지거나, 죽을 때마다 보유자가 그만큼 체력을 회복하며, 오라는 이 일만 할 수도 있습니다. The Owed의 Collector가 그 예입니다. 이 중 하나라도 쓰는 규칙 집합은 Capability API 1.331이 필요합니다.

다시 불붙이기, 빠지기, 소품 옆에서의 사용(Capability API 1.332). 보드의 소품(조우의 `board.props`, 또는 전장에 칠한 소품)은 `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}`이라고 할 수 있습니다. 그로부터 `squares` 이내의 어느 칸이라도 전투가 읽기에 그 빛이 아닌 동안, 옆에 선 누군가에게 그 예산(지정하지 않으면 `action`)으로 "Light it again"이 제공되며, 그 모든 칸에 그 빛을 놓습니다. Bonfire Gutters 뒤의 The Owed 모닥불이 그 예입니다. 생물 행동의 `ground`는 `terrain`과 함께 `"occupants": "stay"`라고 할 수 있습니다. 지면이 아무도 설 수 없는 것으로 바뀌는 곳에 선 사람은 가장 가까운 빈칸으로 옮기지 않고(`"shove"`, 기본값) 얼음을 깨고 물에 빠진 채 그 자리에 남습니다. 카탈로그 항목이나 아이템 사용은 `"usableNear": {"prop": "Year-Wheel", "within": 5}`라고 할 수 있습니다. ID나 라벨로 지정한 서 있는 소품으로부터 그 거리 안에 사용자가 서 있는 동안만 제공되며, 보드가 없는 전투에서는 제공되지 않습니다. Year-Wheel 앞의 Fennick's Hymnal이 그 예입니다. 1.332부터 `whileNearProp`, `aroundProp`, `usableNear`는 모두 같은 방식으로 소품을 지정합니다. ID(`"p1"`), 또는 대소문자, 앞의 "the", 글자와 숫자가 아닌 모든 것을 무시하고 느슨하게 읽은 라벨로 지정하므로, `"Year-Wheel"`은 "The Year-Wheel"이라는 라벨의 소품을 찾습니다. `usableNear`나 `occupants`를 쓰는 규칙 집합은 Capability API 1.332가 필요합니다.

전투 보드 아트(Capability API 1.333). 전투의 보드는 보드 팩으로 그릴 수 있습니다. 고정 ID 아래 타일을 칸 격자(RPG Maker 느낌이라면 48픽셀)로 배열한 PNG 시트이며, Pixelforge로 만들어 라이브러리에 보관합니다(`POST /api/game-tile-packs/boards`). `bt_plains`, `bt_forest`, `bt_mountain`, `bt_ruin`, `bt_water`, `bt_wall`은 지형이며, 각각 최대 여덟 변형을 칸마다 고르거나 칸보다 큰 패턴 하나를 보드 위에 깝니다. `bt_edge_water`와 `bt_edge_wall`은 Pixelforge의 `edge_` 블록처럼 배치한 4×4칸, 16조각의 이중 격자 블록으로, 물과 벽을 옆의 평지와 어우러지게 합니다. `bt_height1`부터 `bt_height3`는 높아진 땅의 테두리입니다. `bo_dim`, `bo_dark`, `bo_sunlight`, `bo_fog_light`, `bo_fog_heavy`, `bo_growth`, `bo_ice`(겨울의 칸), `bo_zone`, `bo_aim`, `bo_reach`는 지금의 색조 대신 칸 위에 그립니다. 소품의 스프라이트는 소품의 칸에 걸쳐 그리는 `bp_<name>`이며(소품에 `"art": "bp_bonfire"`를 쓰거나, 생략하면 앞의 "the"를 뺀 라벨을 소문자 단어로 바꿔 `_`로 이은 것이므로 "The Year-Wheel"은 `bp_year_wheel`), 부서지면 `bp_<name>_broken`입니다. 칠한 전장이나 조우의 보드는 `"pack": "local/<id>"`로 팩을 지정할 수 있습니다. 없으면 환경에 맞는 라이브러리 팩(팩의 `environment`), 그다음 내장 `board/<environment>`로 그리고, 그것도 없으면 지금처럼 그리며, 소품은 라이브러리의 소품 팩(`"environment": "props"`), 그다음 내장 `board/props`에서도 찾습니다. 팩에 없는 타일은 지금처럼 그립니다. 카탈로그 영역은 `"art": "bz_<name>"`이라고 할 수 있습니다. 영역이 덮는 모든 칸을 보드 팩의 그 타일로, 없으면 `bo_zone`으로 그립니다. 영역 `art`를 쓰는 규칙 집합은 Capability API 1.333이 필요합니다.

아이템으로 얻는 더 많은 턴(Capability API 1.334). 아이템 사용은 카탈로그 항목의 mechanics처럼 `"gives": [{"budget": "action", "count": 1}]`라고 할 수 있습니다(Action Surge). 사용하면 사용자에게 즉시 그만큼 턴을 더 주며, 더한 곳에서 상한을 두므로 나중을 위해 모아 둘 수 없습니다. 보너스 행동으로 먹는 Time-Flour Loaf는 지금 행동 하나를 더 줍니다. 이를 쓰는 규칙 집합은 Capability API 1.334가 필요합니다.

휴식에 쓰는 주사위(Capability API 1.335). 휴식은 `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}`라고 할 수 있습니다. 그러면 Game Master의 `[sheet: op="rest" rest="short" dice="2"]`(또는 파티 전체에 대한 것)가 휴식이 정한 일을 하기 전에 먼저 `pool`에서 그만큼 쓰고, 각 주사위(`die`는 아무 값이나 "d8"처럼 쓴 열거형 필드)에 `add`를 더해 굴리며(주사위마다 0 아래로 내려가지 않음), 그만큼을 마법이 아닌 회복으로 `heals`에 돌려줍니다. `extra`는 하나라도 쓴 모두를 위한 주사위 하나입니다. `die`가 가장 많은 면을 읽는 파티원이 각자를 위해 자기 `add`를 더해 굴립니다. 5e의 Song of Rest, 그리고 `add`가 읽는 아이템 스탯으로 각 주사위에 +1을 주는 Pell's Brown Teapot이 그 예입니다. 휴식 `dice`를 쓰는 규칙 집합은 Capability API 1.335가 필요합니다.

여러 풀에 걸친 휴식 주사위(Capability API 1.337). 휴식의 `"dice"`는 풀마다 항목 하나씩인 목록일 수 있으며, 각각 자체 `die`, `add`, `heals`, `extra`를 가집니다. `[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`이므로 파이터 1 / 위저드 1은 d10과 d6을 씁니다. `[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]`는 그 풀에서만 쓰며, `pool`이 없으면 나열한 풀 중 주사위가 있는 첫 풀부터, 그다음 풀 순으로 쓰고, 전체가 모자라면 아무것도 쓰지 않고 거부합니다. 추가 주사위(Song of Rest)는 그것이 있는 첫 항목의 것이며 전체 소비에 대해 한 번 굴리고, 첫 풀이 회복하는 대상을 회복합니다. 나중 풀만 지불해도 나옵니다. 게임에서 휴식 주사위는 각 캐릭터가 지닌 것을 읽으므로 `add`나 추가 주사위의 `add`에 있는 `itemStat`이 적용됩니다. Pell's Teapot, `{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`이 그 예입니다. 여기에 목록을 쓰는 규칙 집합은 Capability API 1.337이 필요합니다.

아이콘(Capability API 1.338). 카탈로그 항목과 시트 상태는 `"icon": "ic_poison_cloud"`로 아이콘을 지정할 수 있습니다. 게임 아이콘 팩(종류가 `icons`인 보드 팩. packages/server/src/assets/board-packs/README.md 참고)의 타일입니다. 없으면 Engine은 파생된 이름을 찾습니다. 상태는 `ic_cond_<id>`, 아이템은 `ic_item_<entry id>`(Game Master가 창작한 아이템은 `ic_item_<name>`), 다른 카탈로그 항목은 `ic_<catalog id>_<entry id>`(`ic_spells_fireball`)이며 하이픈은 `_`로 씁니다. 둘 다 없으면 지금의 글자나 텍스트를 표시합니다. 아이콘을 지정하는 규칙 집합은 Capability API 1.338이 필요합니다.

깨진 집중을 위한 본거지 행동 목록(Capability API 1.336). `"brokenNextLair"`는 하나 대신, 자신의 본거지 행동을 각각 한 번씩 담은 목록일 수 있습니다(`["shelves_lean_north", "shelves_lean_south"]`). 그 집중이 깨지면 지난 라운드에 무엇을 했든 다음 본거지 행동은 그중 하나이며 다른 것은 안 되고, 생물을 조종하는 쪽이 고릅니다. Engine이 조종하는 생물은 적을 가장 많이 휘말리게 할 것을 고르며, 같으면 다른 것을 평가하듯 평가합니다. 한 번 하면 다시 자유롭게 고릅니다. 여기에 목록을 쓰는 규칙 집합은 Capability API 1.336이 필요합니다.

`"alerts": 15`가 있는 상태나 착용·소지 아이템은 보유자로부터 그 거리 안에서 숨은 채 움직이는 사람을 드러냅니다. 그들은 아무에게서도 숨지 못하며, 보유자가 드러낸 것으로 기록됩니다. 쇼케이스의 Wind-Chime은 `{"alerts": 15}`로 지니는 아이템입니다. 생물의 `"stillIn": ["bright"]`는 칸 하나라도 그 빛 중 하나에 있는 동안 생물이 움직이지 못하게 합니다. 그곳에서는 메뉴에 걷기가 없습니다. 쇼케이스의 Lantern-Shy가 그 예입니다.

커지는 오라, 최대치가 있는 속박, 뜯어내기, 버티기(Capability API 1.320). 오라의 `"grows": {"by": 10, "upTo": 40}`는 보유자의 각 턴이 시작될 때 `by`만큼 더 멀리 닿으며, `distance`보다 큰 `upTo`를 넘지 않습니다. 로그는 이제 얼마나 멀리 닿는지 알려 줍니다. `harms`는 `"on": "their-turn"`이라고 할 수 있습니다. 보유자의 턴 시작에 한꺼번에 주는 대신 닿는 각자의 턴이 시작될 때 줍니다. `"lingers": true`는 더 이상 닿지 않는 대상에게 퍼뜨린 것을 그들의 다음 턴 시작까지 남기며, 그 전에 다시 닿으면 오라가 다시 유지합니다. The Owed의 Frost Debt는 `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`입니다.

행동이 거는 것은 `"heldAtMost": 2`를 가질 수 있습니다. 그 출처가 그것과 함께 그만큼의 다른 대상을 붙잡고 있는 동안에는 세 번째에게 걸리지 않습니다(걸리지 않았다고 기록). The Owed의 Grasps가 그 예입니다. `"self": true`가 있는 상태의 `shakeOff`는 보유자도 판정 없이 예산을 써서 상태를 끝내게 합니다. Seed Hopper, `{"budget": "action", "self": true}`는 붙잡힌 사람이나 옆의 아군이 뜯어냅니다. 생물의 `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}`는 전투당 `uses`번, 체력이 0으로 떨어지는 대신 1로 남지만 즉사시키는 것에는 해당하지 않습니다. `extraTurn`이 있으면 그 일이 일어난 턴 바로 뒤에 자체 턴을 하며, 그 턴이 끝나면 순서는 원래대로 돌아갑니다.

선택기는 이 블록을 한 줄로 표시합니다. 나머지를 읽는 주체는 규칙 집합이 어떤 블록을 선택했는지에 따라 다릅니다.

- [`combat` 블록](#combat-a-fight-your-own-rules-resolve)이 있으면 전투가 전투 효과를 읽습니다. `range`, `area`, `friendlyFire`는 위치가 있는 전장에서 적용됩니다. `reaction`은 턴에 실행하는 것이 아니라 무언가에 대응하는 항목임을 표시하고 기다리는 순간을 지정합니다([창](#windows-holding-the-fight-open) 참고). 그냥 `true`로 표시한 항목은 순간을 지정하지 않으므로 어느 메뉴에도 나오지 않습니다. `check`는 위에서 설명한 대로 기술 판정에 적용됩니다.
- [`battle` 블록](#battles-lending-the-sheet-to-marinaras-combat)만 있으면 전투는 `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType`, `cost`를 읽습니다. Marinara 자체 전투에서 활용할 수 있는 부분이 이것들이기 때문입니다.

어휘는 고정되어 있습니다. 위 목록에 없는 키나 값은 조용히 무시하지 않고 거부합니다.

`cost`는 전투 밖에서 Game Master의 `use` 명령이 지불하는 비용이기도 합니다. 다음 절에서 설명합니다.

### 시트 명령: 영구 성장(Capability API 1.142)

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

### 인라인 또는 별도 파일

작은 카탈로그는 `ruleset.json`의 헤더에 있는 `entries`에 인라인으로 넣습니다. 긴 카탈로그는 별도 파일에 두고 헤더의 `asset`으로 지정합니다. 카탈로그는 둘 중 정확히 하나만 가집니다.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

경로는 항상 `catalogs/<the catalog's id>.json`입니다. 파일 자체는 다음과 같습니다.

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

별도 카탈로그 파일은 패키지에 들어갑니다. 공식 카탈로그를 통해 배포하는 패키지이거나, 직접 가져오는 규칙 집합 패키지 파일입니다([규칙 집합 공유하기](#sharing-your-ruleset) 참고). 패키지가 `contributions.assets.paths`에서 `ruleset.json`과 함께 파일을 나열해야 하며 Capability API 1.21이 필요합니다. 생물 카탈로그는 인라인이든 별도 파일이든 Capability API 1.27이 필요하고, 아이템 카탈로그는 1.49가 필요합니다. **단일 파일로 가져오거나 GitHub 저장소로 공유하는 규칙 집합은 카탈로그를 인라인으로 포함합니다.** 따라서 카탈로그도 전체 규칙 집합 파일의 512 KB 제한 안에 들어가야 합니다. 짧은 항목 수백 개 정도를 넣을 수 있는 크기입니다.

제한은 규칙 집합당 카탈로그 12개, 어느 방식이든 카탈로그당 항목 2000개, 카탈로그 파일 하나당 2 MB입니다. `ruleset.json`이 256 KB를 넘거나 카탈로그 파일이 1 MB를 넘는 패키지는 두 제한을 올린 Capability API 1.340이 필요합니다.

### 안내형 빌더: 단계별로 캐릭터 만들기

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

단계는 최대 24개이며 각각 `{ id, label, kind, ... }`입니다. 16개를 넘는 패키지는 Capability API 1.112를 선언합니다.

- `catalog`: 행 카탈로그의 항목으로, **Info**(정보) 뒤에 `summary`가 있는 카드로 표시됩니다. `min`(기본값 1)은 단계가 요구하는 수이고 `max`(기본값 1)는 받는 최대 수이며, `max`가 1이면 새 선택이 이전 것을 대체합니다. 둘 다 최대 40까지 가능하며, 둘 중 하나가 20을 넘는 패키지는 Capability API 1.110을 선언합니다. `field`는 고른 라벨을 쓸 텍스트나 열거형 필드를 지정합니다(열거형 필드는 항목의 ID나 라벨 중 자기 값에 해당하는 것을 받음). `filters`는 카탈로그 필터 값을 고정하며, `within: { step, filter }`는 하위 종족이 종족을 지정하듯 `filter`가 그 앞 단계에서 고른 항목을 지정하는 항목만 제공합니다. 종족 선택을 취소하면 그 하위 종족은 셈에서 빠집니다. `upTo: { filter, value }`(Capability API 1.87)는 숫자 `filter`가 `value` 이하인 항목만 제공하며, 그 값은 현재 시트에서 읽습니다. 캐릭터 레벨까지의 특성(`{ "filter": "level", "value": { "derived": "level" } }`)이 그 예입니다. 필터가 없는 항목은 항상 제공되며, 시트가 그 아래로 내려간 선택은 셈에서 빠지지만 보존합니다. 읽는 값을 바꾸는 선택(레벨을 정하는 클래스)은 같은 변경 안에서 정리되며, **All fields**에서 바꾼 값도 마찬가지입니다(거기서 레벨을 낮추면 그보다 높은 특성이 준 것을 즉시 되돌림). `countFrom`(Capability API 1.90)은 같은 방식으로 시트에서 읽는 값으로 `min`과 `max`를 모두 대신합니다. 단계가 요구하는 항목 수이자 받는 최대 수이며, 내림하고 `max`를 넘지 않습니다. 캐릭터 레벨에서 클래스가 아는 주문 수(`{ "derived": "spells_known" }`)가 그 예입니다. 그 수를 넘는 선택은 보존하지만 수가 다시 오를 때까지 셈에서 빠집니다.
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
- 카탈로그 항목은 `exclusive` 그룹을 지정할 수 있습니다(Capability API 1.94). 빌더 단계는 그룹마다 선택 하나만 유지하므로, 하나를 고르면 그 단계의 같은 그룹 다른 선택이 빠지고 가장 최근 것만 셉니다. 능력치 향상 대신 고르는 재주는 그것과 그룹을 공유합니다. `"exclusive": "fighter-asi-4"`.
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

<a id="items-what-a-party-carries"></a>

## 아이템: 파티가 지니는 것

방어구, 무기, 물약, 장비, 탄약, 돈은 모두 아이템입니다. 선택적 `items` 블록은 규칙 집합의 모든 아이템을 작성하는 어휘를 선언하고, `holds: "items"`인 카탈로그는 아이템 자체를 나열합니다. 둘 다 Capability API 1.49가 필요합니다. 그 밖에 필요한 버전은 다음과 같습니다. Game Master가 창작하는 아이템을 다루는 블록의 `rarityCaps`와 `propose`는 1.51, 캐릭터가 지닌 아이템을 읽는 값(`itemStat`)은 1.52, 착용하거나 소지한 동안 아이템이 판정에 주는 효과와 블록의 `bonus` 상한은 1.53, 아이템이 착용자에게 요구하는 조건과 아이템이 바꾸는 능력치는 1.54, 무기의 `attack`은 1.55, 전투에서 아이템이 하는 일은 1.56, 무기가 쏘는 것과 장전해 두는 것은 1.57, 무기의 모드, 보조 손 공격, 피해 하한, 명중 시 상태는 1.58, 전투에서 아이템을 사용할 때의 효과와 아이템이 담는 충전은 1.59, 풀을 회복하는 사용은 1.60, 휴식으로 되찾는 충전이나 다 쓰면 부서지는 아이템은 1.61, 먼저 판정을 요구하는 사용(`gate`)은 1.62, 전리품 표와 생물의 전리품은 1.63, 동전을 떨어뜨리는 전리품 줄이나 동전을 제외하는 레이어는 1.64, 시장, 아이템의 `sold` 장소, `service`는 1.65, 장날(자금, `buyBack`, 판매자의 `stock`, `limited` 수량, 장소를 지정하지 않은 `sold`)은 1.69, 손에 든 무기에서 발동하는 부가 효과(`weapons`)는 1.70, 시작 장비(`startingGear`)는 1.78, 위험한 아이템, 가짜, 부정직한 판매자는 1.79입니다.

### 아이템 블록

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

- `categories`: 1~24개입니다. 모든 아이템은 방어구, 무기, 물약처럼 정확히 하나의 분류를 가집니다.
- `rarities`: 선택 사항이며 최대 12개입니다. 가장 흔한 것부터 가장 희귀한 것 순으로 나열하세요.
- `tags`: 선택 사항이며 최대 48개입니다. 투척용이나 은도금처럼 아이템이 가질 수 있는 속성입니다.
- `stats`: 선택 사항이며 최대 24개입니다. 아이템이 지니는 숫자와 단어로, 목록 열과 똑같이 `number`, `text`, `boolean`, `enum`, `dice` 중 하나로 선언하며 타입에 따라 범위, 값, 기본값을 가집니다. `promptVisible`(기본값 `true`)은 아이템 옆에 이 스탯을 Game Master에게 보여 줄지 정합니다. 아이템을 숨긴 위치처럼 플레이어만 봐야 하는 것은 `false`로 설정하세요.
- `slots`: 선택 사항이며 최대 12개입니다. 아이템을 착용하거나 드는 위치와, 캐릭터가 그 슬롯을 몇 개 가지는지(1~20)입니다.
- `binding`: 선택 사항. 조율, 서임 등 한 캐릭터가 동시에 귀속할 수 있는 아이템 수를 제한하는 모든 것입니다. `label`은 그 이름이고, `max`는 `{ "abilityScore": "nerve" }`나 파생 값처럼 캐릭터 시트에서 읽는 값입니다. 캐릭터가 귀속할 수 있는 아이템 수는 타격마다 바뀌지 않으므로 실시간 상태는 읽을 수 없습니다.
- `carry`: 선택 사항. `stat`은 아이템의 무게인 숫자 스탯을 지정하며 그 `min`은 0 이상입니다. `encumberedAbove`는 캐릭터가 과적되기 전까지 소지할 수 있는 양이고, `limit`(선택 사항)은 소지할 수 있는 최대량입니다. 둘 다 `binding.max`처럼 시트에서 읽습니다. `carry`가 없으면 무게는 의미가 없고 아무도 과적되지 않습니다.
- `currencies`: 선택 사항이며 최대 여섯 계열, 계열마다 동전 1~10종입니다.
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

### 개별 아이템

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

### 아이템을 읽는 곳

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

### 시트의 아이템

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

### 전투 밖 판정

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

### 상태, 단계, 아이템, 시트 행이 주는 유형별 방어(Capability API 1.132)

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

### 전투 중 무기

아이템은 무기일 수 있습니다(Capability API 1.55). `attack`은 전투 블록의 [공격 행](#combat-a-fight-your-own-rules-resolve)과 같은 형태이며 열 대신 값을 쓰고, [규칙 집합 전투](#combat-a-fight-your-own-rules-resolve)는 아이템을 착용한 동안, 즉 필요한 손에 들고 귀속하는 아이템이면 귀속한 동안 이를 공격으로 제공합니다. 집어넣었거나 소지만 한 아이템은 아무것도 제공하지 않으며, 공격 행과 생물 자체의 행동은 이전과 똑같이 작동합니다. Ember Roads의 손도끼는 다음과 같습니다.

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

#### 탄약과 재장전

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

#### 모드, 두 번째 무기, 하한, 명중 시 상태

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
  항목은 `save: { "save": <save id>, "difficulty": n }`도 가질 수 있으며, 상태가 걸리려 할 때 대상이 굴려 성공하면 막습니다. `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`는 보유자가 각 턴의 시작이나 끝, 또는 0보다 큰 피해를 받을 때 그 내성에 성공할 때까지 상태를 유지하게 합니다(이때는 `rounds`가 없음). 둘 다 그 상태에 대한 내성으로 세며, 무기가 마법이면 마법에 대한 내성으로도 셉니다(Capability API 1.169). 5e의 sword of wounding은 `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`입니다.
- `plus`: 명중마다 더하는 최대 세 개의 추가 양으로, 각각 `{ "dice", "flat", "type", "save", "targetIs", "when" }`이며 따로 굴리고, 자체 유형을 가지며, 따로 저항받습니다(Capability API 1.169). `save`는 자체 `difficulty`와 `onSuccess`(`half` 또는 `none`)를 지정합니다. `targetIs`는 그 생물 유형이나 태그의 대상에게만 줍니다('생물 유형과 대상 검사' 참고). `when: "critical"`은 치명타에서만 줍니다. 모든 절의 주사위는 무기의 주사위처럼 치명타에서 두 배가 됩니다. javelin of lightning은 `{ "dice": "4d6", "type": "lightning" }`, dragon slayer는 `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`, sword of sharpness는 `{ "flat": 14, "type": "slashing", "when": "critical" }`입니다. 예측은 절이 닿는 대상에 대해서만 세며 치명타 전용 절은 세지 않습니다. `when: "toggled"`는 아이템의 스위치가 켜진 동안에만 줍니다(Capability API 1.170, 아래 `toggle` 참고).

무기 세부 정보와 Game Master의 줄이 이를 모두 알려 줍니다. `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon`, `Marked for 2 rounds when a hit deals 2 or more`입니다.

<a id="armor-and-worn-effects-in-a-fight"></a>

### 전투 중 방어구와 착용 효과

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

### 전투 중 아이템 사용

아이템은 전투에서 사용할 수 있습니다(Capability API 1.59). 상처에 대는 습포, 삼키는 강장제, 울리는 종 등입니다. `use`는 카탈로그 항목의 `mechanics`와 같은 어휘로 사용 효과를 정합니다([전투가 `mechanics`에서 읽는 것](#what-a-fight-reads-from-mechanics) 참고). `kind`(`heal`, `attack`, `buff`, `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire`, 그리고 Capability API 1.174부터 `concentration`과 `zone`이며, 여기에 소모하는 `budget` 또는 `free`를 함께 씁니다. Ember Roads의 습포, Gravewatch의 데우는 강장제와 새벽 종은 다음과 같습니다.

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

### Classic 및 Tactical 전투의 아이템

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

### 전리품

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
- 도감 생물은 `loot`로 지닌 표를 지정합니다(아래 생물 참고). 이긴 규칙 집합 전투는 쓰러뜨린 각 생물의 표를 굴리며, 규칙 집합의 규칙으로 해결하지 않는 전투에는 도감 생물이 없으므로 아무것도 떨어뜨리지 않습니다.
- 떨어진 것은 추가와 마찬가지로 공유 보기로 들어가 플레이어의 가방부터 받으며, 아무도 소지할 수 없는 것은 남겨 둡니다. Game Master가 받는 요약에는 떨어진 것과 이미 가방에 들어갔다는 사실이 나오고, 일지에도 기록되며 알림이 표시됩니다.
- Game Master는 이야기 중에 `[loot: table="grave_goods" who="Ada"]`로 표를 굴리며(`who=`는 한 캐릭터의 가방), 인벤토리 태그와 마찬가지로 턴이 시작된 시점을 기준으로 하므로 재생성한 답변은 한 번만 떨어뜨립니다. 떨어진 각 아이템은 추가처럼 응답하며, 지시문에 전리품 표를 나열합니다.

### 돈

`currencies`는 파티의 돈입니다. 동전은 가방 속 아이템이며 다른 것처럼 동전마다 묶음이 있고 `label`로 이름을 붙입니다.

- 그 계열의 동전 `perWeight`개마다 소지 스탯 한 단위의 무게가 나가며, 보유자의 적재량에 포함되고 들어올 때 소지 규칙에 따라 배치합니다. `perWeight`가 없는 계열은 무게가 없습니다.
- 플레이어는 선택기의 **Coins**(동전) 목록에서 동전을 추가하며, 다른 묶음처럼 나누고, 건네고, 합칩니다.
- 인벤토리 묶음 위의 한 줄에 보기 안의 각 계열 동전과 그 가치를 계열의 가장 작은 동전 단위로 표시합니다. Game Master는 각 가방 옆에 그 가치를(`Coin worth 432 pennies`, 빈 지갑은 `no coins`이며 플레이어의 가방은 비어 있어도 나열), 아이템 옆에 `cost`를(`costs 3 shillings`) 봅니다.
- Game Master는 `[inventory: action="pay" amount="3 shillings" who="Ada"]`로 지불하고 `action="earn"`으로 받습니다. `amount`는 개수와 동전이며 동전은 ID나 라벨로, 단수든 복수든, 대소문자와 관계없이 씁니다(`1 penny`, `12 pennies`). 지불은 한 가방(`who=`가 없으면 플레이어의 가방)에서 그 동전의 계열 안에서만 합니다. 맞는 가장 큰 동전부터 내고, 그다음 아직 남은 금액을 감당하는 가장 작은 동전을 깨며, 거스름돈은 그 계열의 더 작은 동전으로 큰 것부터 돌려받습니다. 응답은 지불한 것과 돌려받은 것을 알려 줍니다. 크라운 하나가 든 지갑에서 3실링을 내면 `Paid with crowns ×1; shillings ×2 back.`입니다. 가방으로 감당할 수 없는 지불은 거부하며(`cannot-afford`), 없는 동전(`unknown-coin`)과 화폐가 없는 규칙 집합의 모든 지불(`no-currencies`)도 거부합니다. 받기는 그 동전의 추가이며 `who`의 가방에 넣거나 소지 규칙에 따라 나눕니다. 일지는 쓴 것과 번 것을 나열하고 알림이 표시됩니다. 지시문에는 동전을 나열하며, 동전이 있는 규칙 집합에만 이 지시문이 있습니다.
- 구매는 지불 후 추가이거나, 시장이 있는 규칙 집합에서는 `buy`입니다(아래 참고). 상점 화면은 없습니다.

### 시작 장비

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

### 시장

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

#### 장날

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

#### 정직한 판매자와 부정직한 판매자

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

<a id="using-items-outside-a-fight"></a>

### 전투 밖 아이템 사용

같은 `use`가 전투 밖에서도 작동합니다(`restore`는 Capability API 1.60이며 나머지는 새로 필요한 것이 없습니다). `use`가 있는 아이템의 인벤토리 **Use** 버튼과 Game Master의 `[inventory: action="use" item="Poultice" who="Juno"]`는 모두 Engine의 주사위로 아이템을 지닌 사람에게 아이템의 효과를 적용합니다.

- 회복은 체력을 돌려줍니다. 전투의 회복과 마찬가지로 체력 풀에는 그 양을 더하고, 부상 트랙에서는 표시 하나를 지웁니다. `temporary` 점수는 체력 풀에 쌓이고, `restore`는 해당 풀을 돌려주며, `applies`의 각 상태는 무언가 해제할 때까지 걸립니다.
- 피해를 주거나 상대편을 겨누는 사용(`kind`가 `attack`이나 `debuff`, 또는 `targets`가 `enemy`)은 아무에게도 닿지 않습니다. 전투 밖에는 칠 대상이 보드에 없기 때문입니다. 아이템은 여전히 사용되며 Game Master는 서술하도록 그 효과를 안내받습니다.
- 전투와 똑같이 묶음에서 하나를 빼거나 충전을 소모하며, 남은 것이 없거나, 슬롯을 차지하거나 귀속하는데 착용하지 않은 아이템은 거부하고 아무것도 바꾸지 않습니다. 시트와 가방은 함께 기록합니다.
- `gate`는 판정처럼 먼저 굴립니다. 규칙 집합 자체 주사위와 시트 숫자, 사용자의 부상 페널티, 상태와 착용·소지 아이템이 그 판정에 주는 효과를 씁니다. 실패하면 아무 효과 없이 아이템을 소진하며 그 줄에 알립니다("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

결과는 한 줄로 알립니다. "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." Use 버튼은 "I use my Poultice." 뒤에 `[item_used]` 블록으로 이를 Game Master에게 보내며, 채팅은 이를 배지로 표시합니다. Game Master 자신의 태그도 이것으로 응답하며, 다른 태그처럼 턴이 시작된 시점을 기준으로 하므로 재생성한 답변이 아이템을 두 번 쓰지 않습니다. `use`가 없는 아이템이나 규칙 집합이 없는 게임에서는 여전히 단순히 "I use my rope."라고 말합니다.

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

위의 `battle` 블록은 계산을 Marinara에 맡긴 채 전투에 시트 수치를 빌려줍니다. 선택적 `combat` 블록은 다릅니다. 자체 규칙이 전투를 어떻게 해결하는지 정합니다. `resolution`이 판정 유형에 매개변수를 주듯 Engine이 소유한 전투 유형에 매개변수를 주며, 그 안의 모든 이름은 작성자가 정합니다. 유형은 두 가지입니다. 주사위를 더해 숫자와 비교하는 `attack-vs-defense`와, 전투가 `dice-pool` 규칙 집합 자체의 풀을 던져 성공을 세는 `dice-pool`입니다(아래 풀로 던지는 전투 참고).

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

- `kind`: `"attack-vs-defense"`(한쪽이 상대의 방어를 상대로 주사위를 굴리며 명중하면 피해를 줌) 또는 `"dice-pool"`(풀로 던지는 전투 참고)입니다. 아래 모든 키는 두 유형에서 같은 뜻이며, 그 유형이 숫자를 읽는 방식으로 읽습니다.
- `health`: 필수입니다. 전투가 깎는 대상입니다. `{ "pool": "grit" }`는 수치를 줄이는 실시간 풀이며, 임시 완충치가 있으면 피해가 그것부터 소모합니다. 또는 `{ "track": "harm" }`처럼 표시를 하는 부상 트랙입니다. 트랙은 `damageKinds`를 함께 지정해야 하며 임시 점수를 주지 않습니다.
- `defense`: 필수 값 참조입니다. 플레이어가 입력하는 필드 또는 작성자가 계산하는 파생 값입니다.
- `initiative`: 필수입니다. 시작할 때 한 번 굴리는 주사위와 선택적 수정치 참조입니다. 동률이면 수정치가 더 높은 쪽, 그다음은 전투를 설정한 순서가 앞섭니다. `"each": "round"`는 새 라운드가 시작될 때마다 그때의 수정치로 모두의 우선권을 다시 던지며(따라서 부상 트랙을 읽는 수정치는 다치면 느려짐), 라운드는 새 순서의 첫 번째부터 시작합니다. Capability API 1.47. `dice-pool` 전투는 대신 풀로 던질 수 있습니다. `pool`(값 참조)은 주사위 수이며 그 성공 수에 `plus`를 더한 것이 우선권 수치이고, `dice`나 `modifier`를 함께 쓰지 않습니다. `pool`이 필요한 `resource`는 그 수치를 유지하며 공격이 이를 움직이게 합니다(아래 "공격이 움직이는 우선권" 참고). Capability API 1.48.
- `attackRoll`: `attack-vs-defense`에서는 필수이고, 해결 방식 자체의 풀을 던지는 `dice-pool`에서는 거부합니다. 주사위, 두 번 굴려 하나를 고르는지(`advantage`), 단일 주사위의 최대·최소 눈이 하는 일(`naturals.max`: `critical`, `hit`, `none`; `naturals.min`: `miss`, `none`), 치명타가 피해에 하는 일(`critical`: `double-dice`는 피해 주사위를 다시 굴림, `max-dice`는 최고 눈을 한 번 더함, `none`은 일반 명중)을 정합니다. 특별한 눈에는 판정과 마찬가지로 주사위 하나가 필요합니다. 전투 안의 내성 굴림도 같은 주사위를 굴립니다. `criticalFrom`은 치명타 눈을 넓힙니다. 공격자 시트에서 읽는 값으로, 치명타로 세는 가장 낮은 자연 눈입니다. 시트에 19라고 적힌 5e Champion이라면 `{ "field": "critical_from" }`입니다. 주사위의 최고 눈으로 제한하며, 2 미만은 범위가 전혀 없다는 뜻이고(필드를 0으로 둔 캐릭터처럼 최고 눈만), 단일 주사위와 `critical`로 설정한 `naturals.max`가 필요합니다. Capability API 1.81.
- `economy`: 필수입니다. `budgets`는 한 턴에 가질 수 있는 행동 예산으로 ID, 라벨, `per`(`turn`은 보유자 자신의 턴 시작 시, `round`는 새 라운드 시작 시 보충), `count`를 갖습니다. 처음 선언한 예산이 주 예산이며 표준 행동이 이를 소모합니다. `movement`는 선택적 값 참조로, 자체 거리 단위로 한 턴에 걸을 수 있는 거리입니다. 보드 위 전투에서 읽습니다('위치' 참고).
- `attacks`: 선택 사항입니다. 행이 무기가 되는 시트 목록입니다. `name`은 행 이름을 정하는 텍스트 열, `damage.dice`는 주사위 열이며, `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus`, `damage.type`은 각각 같은 목록의 열을 지정합니다. `ability` 열은 자체 능력치 ID 중 하나를 담는 `enum`이며 그 밖의 값은 아무것도 더하지 않습니다. `proficiency` 열은 `boolean`이며 참일 때 숙련 보너스를 더합니다. 읽을 수 있는 주사위가 없는 행은 공격이 아니므로 같은 목록의 밧줄은 그냥 밧줄입니다. `toHit.skill`은 기술 ID 하나를 담는 `enum` 열을 지정합니다. 행은 그 기술 판정이 더하는 값을 더하며, 행 자체의 `ability`가 능력치를 지정하면 판정의 `with=`가 바꾸는 것과 똑같이 기술의 능력치 대신 그것을 씁니다(Capability API 1.47). `strikes`는 이 목록의 예산을 한 번 쓸 때 얻는 타격 횟수를 정하는 선택적 값 참조입니다. 보유한 타격이 없을 때 행을 선택하면 예산을 쓰고 남은 타격을 손에 넣습니다. 하나라도 보유하는 동안 `strikes`를 선언한 모든 행은 예산을 전혀 쓰지 않으므로, 다른 무기와 표적을 고르고 사이에 걷는 행동이 메뉴에서 자연스럽게 가능합니다. `strikesCappedBy`는 목록이 몇 번의 타격을 주든 해당 행 자체를 한 번으로 제한하는 불리언 열입니다. 사용자 횟수와 관계없이 턴당 한 번 발사하는 무기를 위한 것으로, SRD 5.1의 Loading 속성을 표현하려고 마련했습니다. 어차피 한 번 지불해 한 번만 타격하는 목록에서는 의미가 없어 거부합니다. 보유한 타격은 한 목록이 아닌 전투원의 것입니다. 두 무기 목록이 모두 `strikes`를 선언한 캐릭터는 어느 행으로 공격하든 같은 보유분을 소모합니다. 얻은 턴이 끝나면 지웁니다. 별도 선언이 없는 목록은 한 번 지불해 한 번 타격하며, 이 기능 이전의 모든 전투와 같습니다.

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
  Capability API 1.108부터 `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }`은 행의 클래스에 따라 참조를 고릅니다. 클레릭 3 / 위저드 2는 클레릭의 공격을 숙련과 Wisdom으로, DC를 8에 그 공격을 더한 값으로 파생하고, 위저드의 것은 대신 Intelligence로 파생할 수 있습니다. 열은 원본 목록에 있어야 하며 `values`는 항목 1~20개를 가집니다. 각 항목은 두 참조 중 하나를 대체할 수 있으며, 생략한 참조, 열 값이 없는 경우, 나열되지 않은 값은 원본 자체의 참조를 유지합니다. 전투, 시트의 행 요약, Game Master의 요약은 같은 행별 숫자를 읽습니다. `stamp`와 `byColumn`은 모두 schemaVersion 2와 capabilityApi 1.108 이상이 필요합니다.
- `standard`: 선택 사항이며 고정 목록 `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`에서 고릅니다. `dodge`(회피자에 대한 공격을 두 번 굴려 나쁜 결과 유지)와 `help`(도움받은 아군의 다음 공격을 두 번 굴려 좋은 결과 유지)는 항상 해결합니다. `dash`(같은 이동 허용량을 한 번 더 얻음)와 `disengage`(이번 턴에 걸어서 벗어나도 아무도 공격하지 못함)는 보드에서는 해결하고 보드 밖에서는 기록합니다. `hide`와 `ready`는 허용하지만 아직 아무 효과가 없습니다.
- `standardEffects`: 선택 사항으로 표준 행동의 플래그가 담지 못하는 부분입니다. 현재는 `dodge`에만 있습니다. `{ "dodge": { "saves": ["dex_save"] } }`는 회피가 지속되는 동안 어떤 내성을 두 번 굴려 좋은 결과를 쓸지 정합니다. 시트가 선언한 내성만 지정하고, `standard` 목록에 `dodge`가 있을 때만 사용하세요. 생략하면 회피는 기존과 정확히 같습니다. 맞기 어려워질 뿐 다른 효과는 없습니다.
- `conditions`: 선택 사항입니다. 자체 상태 ID를 효과에 대응시켜 시트와 전투의 상태가 하나의 기록이 되게 합니다. 중독된 캐릭터는 전투 후에도 중독 상태입니다. 효과는 고정 목록입니다. `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side`(1.278), `cannot-approach-source`입니다. `failsSaves`는 굴리지 않고 실패하는 내성을 지정합니다. 거리나 이동이 필요한 여섯 가지(`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`)는 보드가 있는 전투에서 읽으며 없는 전투에서는 의미가 없습니다('위치' 참고). `cannot-react` 보유자는 걷기로 열리는 응답 창에서 제외되므로 응답을 요청받지 않습니다. 효과 옆에는 키 네 개가 더 있습니다.
  - `modifiers`: 상태가 유지되는 동안 바꾸는 숫자입니다. 아래 상태가 바꾸는 숫자를 참고하세요.
  - `saves`: 두 내성 효과와 내성에 대한 모든 수정치가 적용되는 자체 내성입니다. 생략하면 전부 적용되며, 둘 다 없이 지정하면 거부합니다.
  - `skills`: 두 판정 효과와, 자체 기술을 지정하지 않은 판정 수정치가 적용되는 자체 기술입니다. 생략하면 전부 적용되며, 둘 다 없이 지정하면 거부합니다. 전투의 겨루기는 기술이 아니라 전투 자체 판정을 굴리므로 기술로 범위를 좁힌 것은 겨루기에 닿지 않습니다. 그 기술에 대한 전투 밖 판정은 이를 읽습니다(아래 전투 밖 판정 참고). Capability API 1.53.
  - `whileSourceInSight`: 부여한 상대가 보유자의 시야 안에 있을 때만 적용되는 부분입니다. `true`는 상태 전체를 제한합니다. 그 상태의 자체 효과 목록을 쓰면 해당 효과만 제한하고 나머지는 유지합니다. 상대가 보이든 안 보이든 더 가까이 걷지 못하게 하는 공포에 필요한 방식입니다. 상태가 갖지 않은 효과를 지정하면 거부합니다. 보드가 없으면 시선을 끊을 수 없으므로 어느 방식이든 모든 효과가 적용됩니다.
  - `endsWhenSourceDown`: 부여한 상대가 쓰러지는 순간 해제됩니다.
  - 감각(Capability API 1.127): 상태의 `lacks`는 보유자에게 없는 감각을 지정하고, 카탈로그 항목의 `mechanics.needs`나 생물 행동의 `needs`는 효과가 작용하려면 대상이 가져야 하는 감각을 지정합니다. 5e의 Deafened에는 `"lacks": ["hearing"]`을, Command에는 mechanics에 `"needs": ["hearing"]`을 쓰세요. 귀가 먼 대상은 Command의 대상 메뉴에서 빠집니다. 청각이 필요한 범위나 다중 대상 효과는 그 대상을 완전히 건너뛰며, 내성도 피해도 상태도 없습니다. Deafened가 끝나면 그 대상은 다시 유효합니다. 각 목록은 규칙 집합 자체의 표현으로 쓴 서로 다른 감각 ID 1~4개를 가지며, Engine은 감각 이름을 알지 못합니다.
  - 시트가 허용하는 동안만 사용(Capability API 1.166): 카탈로그 항목의 `mechanics.usableWhen`은 `{ "value": <value reference>, "atLeast": n, "atMost": n }`입니다(경계 하나 또는 둘 다). 전투에서 항목은 보유자의 시트, 실시간 상태, 아이템에서 읽은 값이 경계 안에 있는 동안만 보유자의 턴이나 반응 창에서 제공되며, 메뉴를 그릴 때마다 읽습니다. 5e의 Protection은 손에 방패가 필요합니다. `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. Rage의 "중갑 없음"은 중갑 개수에 `"atMost": 0`을 쓴 같은 형태입니다. 능력치 블록으로 작성한 생물은 시트가 없으므로 아무것도 막지 않습니다.
  - 부여자의 시트가 허용하는 동안만 거는 상태(Capability API 1.167): 카탈로그 항목의 mechanics나 아이템 사용의 `applies` 항목은 `usableWhen`과 같은 형태의 `"when"`을 가질 수 있습니다. 상태가 걸리는 순간 거는 사람의 시트, 실시간 상태, 아이템에서 읽으며, 경계 밖의 항목은 건너뛰고 나머지는 그대로 적용합니다. 5e의 Rage는 네 항목 제한 안에서 `raging`과 세 가지 피해 상태 중 하나를 겁니다. `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, 그다음 `"atLeast": 9, "atMost": 15`인 `raging_damage_3`, `"atLeast": 16`인 `raging_damage_4`입니다. 시트가 없는 부여자는 모든 항목을 적용합니다. 생물의 능력치 블록과 상태의 `onEnd`에는 읽을 부여자 시트가 없으므로 그곳의 `when`은 거부합니다. schemaVersion 2와 capabilityApi 1.167 이상이 필요합니다.
  - 생물 유형과 대상 검사(Capability API 1.168): `combat.creatureTypes`는 전투원이 될 수 있는 것을 나열합니다. `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`. 생물은 자체 `type`과 `tags`를 지정합니다. 캐릭터의 유형은 텍스트나 선택 필드 `field`의 값이 유형 중 하나이면 그 값이고, 아니면 `default`입니다(5e 캐릭터는 인간형). 대상 검사는 `{ "types": [...], "tags": [...] }`이며 하나라도 일치하면 통과합니다. 유형도 태그도 없는 전투원은 일치하지 않습니다. 검사는 세 곳에 둡니다. 피해 절의 `targetIs`는 일치하는 대상에게만 그 절을 줍니다(dragon slayer: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, 성수: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`). `applies` 항목의 `targetIs`는 일치하는 대상에게만 그 상태를 겁니다. `mechanics.targetTypes: { "is": test, "not": test }`는 누구를 고르거나 휘말리게 할 수 있는지 자체를 정합니다(Animal Friendship: `{ "is": { "types": ["beast"] } }`, Sleep: `{ "not": { "types": ["undead"] } }`). 범위는 `targetTypes`가 제외한 대상을 지나칩니다. 예측은 `targetIs` 절을 닿을 대상에 대해서만 세며, 시트의 단순 평균은 이를 제외합니다. 전투 패널과 Game Master는 각 전투원의 유형과 태그를 봅니다. schemaVersion 2와 capabilityApi 1.168 이상이 필요합니다.
  - 상태의 끝(Capability API 1.125): Charm Person은 `"endsWhen": ["harmed-by-source-side"]`를 씁니다. 상태를 건 사람이나 그 편의 누군가가 준 0보다 큰 피해, 또는 그들이 공격, 내성, 해로운 상태로 보유자를 겨누는 것은, 공격이 빗나가거나 내성이 성공하더라도 그 해로운 행동이 완전히 해결된 뒤 상태를 끝냅니다. `"saveWhenDamaged": true`는 피해를 받을 때 턴 내성을 반복합니다. 0보다 큰 피해마다 거는 행동의 `saveEnds`를 저장된 DC로 반복하며, 성공하면 끝납니다. 저장된 내성이나 DC가 없으면 아무것도 굴리지 않습니다. Hypnotic Pattern은 `"endsWhen": ["damaged"]`와 `"shakeOff": { "budget": "action" }`를 씁니다. 0보다 큰 피해는 즉시 상태를 끝내며, 보유자 편의 다른 전투원이 자기 턴에 그 예산을 써서 끝낼 수도 있습니다. `shakeOff.reach`는 규칙 집합 거리 단위이며 기본값은 한 칸입니다. 보드가 없으면 거리를 재지 않습니다. 행동 체계가 그 예산을 선언해야 합니다. `endsWhen`은 서로 다른 항목 하나 또는 둘을 가집니다. 이 키들은 출처 쓰러짐과 집중으로 인한 끝을 바꾸지 않습니다. 턴 시작이나 끝이 아니라 0보다 큰 피해에서만 하는 내성에는 `saveEnds.at: "damaged"`를 쓰세요(Capability API 1.129). Dominate Person의 applies는 `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`이며, `saveWhenDamaged` 없이 거는 행동의 저장된 DC로 타격마다 한 번 굴립니다.
  - Haste와 Slow가 바꾸는 행동 체계(Capability API 1.76):
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]`는 보유자에게 매 턴 턴 예산을 그만큼 더(또는 덜) 주며, 0 아래로는 내려가지 않습니다. `per` 턴마다 보충되는 예산만 이렇게 바꿀 수 있습니다. 예산은 상태만 채우는 것을 위해 `"count": 0`으로 선언할 수 있으며, 화면은 누군가 그 예산을 가진 동안만 이를 보여 줍니다. 창작한 상대는 이를 쓰지 않습니다.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }`는 그 예산을 쓸 수 있는 곳을 정합니다. 지정한 표준 행동(규칙 집합 자체 `standard` 목록에서. 모든 표준 행동이 이미 있는 첫 예산에는 쓸 수 없음), 단일 타격의 무기 공격 하나(행동이 원래 손에 줄 타격과 관계없이. 생물은 한 대상에 대한 능력치 블록 공격이며 다중 공격은 안 됨), 아이템 사용입니다. 아이템 사용은 아무 아이템이면 `true`, 그 아이템 태그 중 하나가 있는 아이템만이면 `{ "tags": ["mundane"] }`입니다(5e의 Use an Object는 평범한 아이템의 사용이며 마법 아이템 발동은 아님). 이들은 보통 쓰는 예산이 다 떨어진 뒤, 보유자 자신의 턴에만 제공됩니다. 부여는 반응을 지불하지 않습니다.
    - `exclusive`: `["action", "bonus"]`처럼 한 턴에 하나만 쓰는 두 예산입니다. 하나를 쓰면 다른 하나가 비워집니다.
    - `attacksPerTurn`: 행동이 무엇을 주든 보유자가 자기 턴에 하는 공격 횟수입니다(명중 굴림을 하는 행동, 연속 행동의 각 공격 부분, 붙잡기처럼 타격을 대신하는 겨루기). 다른 사람의 턴에 하는 반응은 제한하지도 세지도 않습니다.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`는 상태가 완전히 끝날 때(시간이 다하거나, 내성이나 피해가 끝내거나, 집중이 깨질 때) 남기는 것이며, 다시 걸릴 때는 남기지 않습니다. `rounds` 동안 유지됩니다(`"until-save"`나 `"instant"`는 안 됨). 보유자 자신의 턴 도중에 남으면 라운드는 다음 턴부터 시작하므로, 1라운드는 다음 턴 전체입니다.
  - 전투가 어떻게 끝나든, 전투가 시계, `endsAfter`, 집중으로 건 모든 상태는 아무것도 남기지 않고 시트에서 해제되며 집중도 끝납니다. 시계가 없는 상태(낙하로 인한 넘어짐)는 남습니다.

  `own-saves-advantage`와 그 반대는 공격과 마찬가지로 내성을 두 번 굴려 하나를 유지하며 서로 상쇄합니다. `own-checks-advantage`와 그 반대는 전투가 능력치 판정을 하는 곳인 겨루기의 보유자 쪽과, 전투 밖에서 보유자가 하는 판정에 같은 일을 합니다. `resist-all`은 표적 자체의 내성이 무엇이든 추가로 모든 종류의 피해를 절반으로 줄이고, 취약성과도 같은 방식으로 상쇄합니다. `cannot-target-source`는 상태를 부여한 상대에게 무엇이든 겨누지 못하게 합니다(`cannot-target-source-side`, 1.278: 그 편의 누구에게도 겨누지 못하게 하며, 그 편이 보유자 자신의 편이면 예외). `cannot-approach-source`는 이동 경로를 포함해 현재 칸보다 그 상대에게 가까이 걷지 못하게 합니다. 같은 거리의 칸으로 돌아가는 길은 여전히 제시하지만, 상대에게 가까워졌다 반대쪽으로 나오는 길은 제시하지 않습니다.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **상태가 바꾸는 피해(Capability API 1.133).** `damage`는 보유자가 주는 피해를, `damage-taken`은 보유자가 받는 피해를 바꿉니다. 둘 다 `flat`, `dice`(와 `minus`), 또는 `times: 0.5 | 2`를 받습니다. 더하기는 명중에 피해 절이 여러 개여도 공격 명중마다 한 번 일어나며, 치명타는 규칙 집합이 다른 주사위를 두 배로 하듯 더한 주사위도 두 배로 합니다. 내성과 자동 명중은 아무것도 받지 않습니다. `times`는 더하기 뒤, 저항 전에 명중 전체를 바꾸며, 절 전체에 걸쳐 합계를 한 번 내림합니다. 더한 양은 자체 `damageType`, 생략하면 명중의 유형으로 저항을 받습니다. 같은 유형의 더하기는 저항 전에 그 양에 합쳐집니다.

  `attacks`는 `weapon`, `spell`, `any`(기본값) 중 하나입니다. 공격 목록 행과 장착한 아이템 공격은 무기이며, 단일 대상 능력치 블록 공격 굴림도 무기입니다. 카탈로그 능력(생물의 주문 시전 포함)과 아이템 사용은 주문/기타 공격입니다. `blow: "melee" | "ranged"`는 1.118을 따르므로 근접 거리 안의 투척 무기는 근접입니다. `ability`는 공격 굴림에 실제로 고른 능력치를 지정합니다. 행의 능력치, 또는 아이템이 제공하는 가장 좋은 능력치 중 첫 번째(기교 포함)입니다. 단순한 능력치 블록 행동에는 능력치가 없어 능력치 제한과 일치하지 않습니다. 이 키들과 `damageType`은 다른 수정치 대상에서는 거부합니다. `fromSource: true`는 `damage-taken`에만 씁니다. 명중이 추적되는 상태를 건 사람에게서 와야 합니다. 추적되지 않는 상태, 단계, 아이템에는 거는 출처가 없으므로 일치할 수 없습니다.

  5e라면 시트에 이 상태 ID들을 선언한 뒤 `combat.conditions`에 다음 항목을 넣으세요.

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor와 Rage는 시전자에게, Ray of Enfeeblement와 Hunter's Mark는 대상에게 걸립니다. Hex는 `attacks: "any"`와 `damageType: "necrotic"`이 있는 표식의 `damage-taken` 항목을 씁니다. 단계와 아이템의 `worn`, `carried`, 요구 조건 `otherwise` 효과도 이 수정치를 공유합니다. 공격 메뉴는 보유자 자신의 더하기와 배수만 세며, 대상의 표식은 그곳에서 약속하지 않습니다. 시트와 프롬프트 요약은 보유자 자신의 피해 수정치를 설명하고, 전투 보기는 들어오는 것도 설명합니다. 어느 대상이든 쓰는 패키지는 아이템이 별도 카탈로그 파일에 있는 경우를 포함해 schemaVersion 2와 capabilityApi 1.133 이상이 필요합니다.

  **상태가 바꾸는 숫자.** `modifiers`의 각 항목은 바꾸는 대상(`to`)과 그 양을 지정합니다.
  - `defense`: 보유자를 상대로 한 공격이 도달해야 하는 숫자입니다. 고정 숫자만 가능합니다.
  - `attacks`, `saves`, `checks`: 보유자 자신의 공격 굴림, 내성, 겨루기 판정입니다. 고정 숫자이거나 굴림마다 굴리는 `dice`(`"1d4"`)이며, `minus: true`는 주사위를 더하는 대신 뺍니다.
  - `speed`: 보유자가 걷는 거리로 자체 거리 단위(`flat`)이거나, 절반이나 두 배를 뜻하는 `times` 0.5 또는 2이며 모든 고정 변경 뒤에 적용합니다. `speed-zero`와 마찬가지로 보드에서만 읽습니다.
  - `health-max`: `times` 0.5만 쓰면 보유자의 체력 최대치를 절반으로 하며, 내림하고 1 아래로 내려가지 않습니다(Capability API 1.115). 칸으로 된 체력 트랙에는 절반으로 할 최대치가 없습니다. 절반이 된 최대치를 넘는 체력은 전투가 시작될 때 잃으며, 회복도 그 이상으로 올리지 못합니다.

  `checks`에 대한 수정치는 자체 `skills`를, `saves`에 대한 수정치는 자체 `saves`를 지정할 수 있으며, 상태의 지정 대신 범위를 좁힙니다. 둘 다 `mode: "advantage"`나 `"disadvantage"`로 두 번 굴릴 수 있으며, 숫자가 함께 있든 없든 같은 이름의 효과와 함께 세고 같은 방식으로 상쇄합니다. 따라서 한 상태가 Sneak은 어렵게, Climb은 쉽게 동시에 만들 수 있습니다. 이 세 키는 Capability API 1.53이 필요합니다.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  고정 숫자는 자체 부호를 가지며 0은 거부합니다. 모든 수정치는 로그에서 바꾼 굴림 옆에 상태 이름과 함께 표시되고("12 + 5 + 3 (Blessed) = 20"), 메뉴의 명중 확률과 승리 확률도 이를 셉니다. 상태끼리는 중첩되며, 같은 상태가 두 번 있어도 하나의 상태입니다.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`: 선택 사항입니다. 트랙이 충분히 높은 동안 상태로 세는 실시간 트랙의 단계로, 탈진처럼 단계별로 악화되는 상태를 표현하는 방법입니다. 각 항목은 일반 `track`(부상 트랙이 아님), 시작하는 단계 `at`, 하는 일을 상태와 같은 `effects`, `modifiers`, `failsSaves`, `saves`, `skills`로 지정합니다. 트랙이 도달한 모든 단계가 적용되므로 트랙이 오를수록 누적됩니다. 단계에는 출처가 없고 읽는 값이 내려갈 때만 끝나므로 `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`는 거부합니다. 시트가 있는 전투원만 트랙을 가집니다. 로그는 단계를 트랙과 숫자로 표시합니다("- 1 (Heat 3)").

  단계는 `track` 대신 캐릭터의 실시간 상태와 아이템으로 계산한 `derived` 값을 읽을 수 있으므로(Capability API 1.54) 아무도 직접 표시할 필요가 없습니다. Ember Roads는 부피 10 이상을 지닌 사람을 느리게 합니다.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  캐릭터마다 다른 경계값("Strength의 다섯 배 초과")은 이를 빼는 파생 값으로 표현합니다. `scale` -1로 뺄 부분을 구하고, 둘의 `sum`을 단계가 읽습니다.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true`는 아무도 움직이기 전, 전투가 시작될 때 보유자를 전투에서 완전히 탈락시킵니다(Capability API 1.115). 이것과 절반이 된 최대치로 잃는 체력은 전투가 시작될 때 한 번 정리하며, 다른 모든 단계는 바꾸는 숫자를 읽을 때마다 읽습니다.

  상대도 트랙을 가집니다(Capability API 1.115). 시트가 없는 상대는 트랙 ID로 받은 `tracks`에서 시작합니다. Game Master가 제안하는 생물은 이를 지정할 수 있고(`"tracks": { "exhaustion": 2 }`), 전투에 넣는 도감 상대도 마찬가지입니다. 생물의 `conditionImmunities`는 단계가 읽는 트랙을 지정할 수 있으며, 그러면 시트 유무와 관계없이 그 트랙의 어떤 단계도 그 생물에 닿지 않습니다. 탈진에 면역인 5e의 언데드와 구조물이 그 예입니다.

  수정치, 단계, 판정 효과는 Capability API 1.45가 필요합니다.

- `checks`와 `contests`: 선택 사항입니다. 겨루기가 읽는 것과, 전투에서 누구나 시작할 수 있는 겨루기(붙잡기, 밀치기, 벗어나기)입니다. 아래 겨루기를 참고하세요. Capability API 1.43.
- `concentration`: 선택 사항입니다. 유지 중인 것을 기록하는 실시간 `text` 필드, 피해가 강제하는 `save`, 난이도의 최솟값인 `floor`, 그보다 클 때 난이도를 정하는 받은 피해의 비율 `fromDamage`를 지정합니다. 집중하는 두 번째 능력을 시작하면 첫 번째가 끝납니다. 내성에 실패해도 끝나며 그 집중이 유지하던 상태도 함께 해제됩니다.
- `dying`: 선택 사항이며 `kind: "saves"`입니다. 굴림을 세는 두 트랙(필요 횟수는 각 트랙 자체의 최대치), `dice`, `succeedAt`, 최대·최소 눈의 효과(`naturals.max`: `revive-1` 또는 `success`; `naturals.min`: `one-failure` 또는 `two-failures`), 쓰러진 동안 피해의 비용(`damageWhileDown`, `criticalWhileDown`), 쓰러진 캐릭터의 `condition`을 정합니다. 이 블록이 없으면 0인 캐릭터는 그냥 쓰러지며 회복하면 돌아옵니다.
- `damageTypes`: 선택 사항입니다. 자체 시스템의 피해 유형으로 대소문자 구분 없이 비교합니다.
- `damageKinds`: `health`가 부상 트랙을 지정하면 필수이고, 풀을 지정하면 거부합니다. 표시만 종류를 담을 수 있고 점수 풀에는 종류를 보관할 자리가 없기 때문입니다(위의 '부상 트랙' 참고). 타격이 트랙의 어떤 `kinds`로 표시되고 몇 칸을 채울지 정합니다. `default`는 유형 자체가 없는 타격을 포함해 대응되지 않은 모든 피해가 되는 종류입니다. `byType`은 자체 `damageTypes`를 종류에 대응시키며, 키는 유형과 마찬가지로 대소문자를 구분하지 않습니다. 따라서 `"Fire"`와 `"fire"`는 같은 키이며 둘 다 지정하면 거부합니다. `marks`는 두 답의 의미가 반대이므로 기본값이 없습니다. `"per-point"`는 피해 굴림이 체력 단계를 세므로 3점 타격은 세 칸을 채우고 1점 완화도 의미가 있습니다. `"per-blow"`는 타격이 맞거나 빗나가는 방식으로, 얼마나 세게 맞든 한 칸을 채웁니다. 피해 절이 여러 개인 타격도 실제로 적용된 가장 심한 종류로 한 칸만 표시합니다. 시스템에 맞는 방식을 명시하세요. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: `dice-pool`에서는 필수이고 `attack-vs-defense`에서는 거부합니다. 풀로 던지는 전투를 참고하세요.
- `spendLimits`: 선택 사항입니다. 전투에서 전투원 한 명이 실시간 풀을 `turn`이나 `round`마다 얼마나 쓸 수 있는지이며 풀의 종류와 관계없이 적용합니다. `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max`는 전투가 시작될 때 한 번 읽습니다. 남은 한도를 넘는 비용은 풀에 얼마가 있든 감당할 수 없으므로 메뉴에서 제외합니다. 턴당 한도는 보유자 자신의 턴 시작 시, 라운드당 한도는 라운드 시작 시 다시 시작합니다. 직접 수치로 쓴 상대는 시트에서 아무것도 지불하지 않으므로 한도에 묶이지 않고, 시트로 작성한 상대는 자체 풀에서 지불하므로 다른 누구와 마찬가지로 한도를 따릅니다. Capability API 1.47.
- `threat`: 선택 사항이며 생물 도감에는 필요합니다. `tiers`는 상대를 고르는 척도로 ID, 라벨, `health` 범위, `defense`, `toHit`, `damagePerRound` 범위, `saveDifficulty`를 갖습니다. 제공하는 모든 생물은 이 단계 중 하나를 지정합니다. 아무도 작성하지 않은 상대는 Game Master가 요청한 단계로 맞추므로 척도를 벗어나지 않습니다. `damagePerRound` 범위는 전체 연속 행동을 포함해 생물이 한 라운드에 표적 한 명에게 하는 피해로 읽습니다.

### 상태, 피해, 마법에 대한 내성(Capability API 1.134)

`to: "saves"`인 수정치는 `against`를 가질 수 있습니다. `conditions`(시트 상태 ID), `damage`(피해 유형), `magic: true` 중 하나 이상이 필요합니다. 하나만 일치해도 됩니다. `saves`는 여전히 AND 조건으로 어느 내성인지 좁힙니다. 이렇게 이점을 좁히려면 `effects`가 아니라 수정치의 `mode: "advantage"`를 쓰세요. 이 수정치는 상태, 도달한 트랙 단계나 파생 단계, 아이템 효과에서 작동합니다. 종족 특성이라면 시트의 종족 선택에서 값을 파생하고, 그 값이 1일 때 도달하는 단계에 수정치를 붙이세요. 수정치 예시는 다음과 같습니다.

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave는 `conditions: ["frightened"]`를 씁니다. Magic Resistance는 생물의 시트 파생 단계나 트랙 단계에서 `saves` 없이 `magic: true`를 씁니다. 행동의 `applies`는 내성이 상태를 막아도 셈에 들며, 그 피해는 모든 `plus` 절을 포함합니다. 피해 이름은 대소문자 구분 없이 비교합니다. 마법은 1.101의 `"magical"` 성질을 뜻합니다. 카탈로그 `mechanics.qualities`(피해가 없어도), 생물 행동의 `damage.qualities`, 무기 아이템의 태그입니다. 주문은 그 성질을 지녀야 하며, 이름이나 카탈로그만으로 마법이 되지 않습니다. `saveWhenDamaged`와 `saveEnds.at: "damaged"`를 포함해 상태를 끝내는 내성은 그 상태에 대한 내성일 뿐입니다. 집중 내성과 죽음 내성은 아무것에 대한 것도 아닙니다. 전투 밖에서 Game Master의 내성 요청에는 구조화된 출처나 상태가 없으므로 `against`는 그 요청과 일치하지 않습니다. 시트, 아이템 세부 정보, 전투 세부 정보, Game Master 시트 요약이 이 제한을 보여 줍니다. schemaVersion 2와 capabilityApi 1.134 이상이 필요합니다.

### 풀로 던지는 전투: `dice-pool`

`dice-pool` 규칙 집합은 주사위를 더하지 않고 성공을 세며, 그 전투도 그렇게 할 수 있습니다. `"kind": "dice-pool"`에는 `resolution.kind`가 `"dice-pool"`이어야 하며, 풀 판정이 이미 하는 방식으로 시트를 읽습니다. **굴림이 더하는 모든 숫자는 주사위 개수이고, 굴림이 상대하는 모든 숫자는 성공 수입니다.** 따라서 이름을 바꿀 것이 없습니다.

- 명중 숫자(공격 행, 능력 목록의 `toHit`, 생물 행동의 명중 숫자)는 공격이 던지는 풀입니다. 주사위, 주사위가 도달해야 하는 목표, 눈을 두 번 세거나 폭발하거나 상쇄하거나 대실패하는 기준은 `resolution`의 것입니다. `resolution.penaltyFrom`이 지정한 부상 트랙은 판정에서처럼 풀에서 페널티를 뺍니다.
- `defense`는 공격에 필요한 성공 수이며 1보다 작아지지 않습니다. 상태의 `defense` 수정치와 엄폐(`cover.bonus` 또는 `cover.threeQuarters`)가 여기에 더해집니다.
- 필요한 수를 넘는 성공마다 피해 주사위 하나를 더합니다. 대실패는 무엇을 셌든 빗나갑니다. 치명타는 없습니다. 강한 명중은 추가 주사위만큼의 가치가 있습니다.
- 내성의 숫자는 풀이고 난이도는 필요한 성공 수입니다. 겨루기는 양쪽의 판정을 풀로 던지며 성공이 더 많은 쪽이 이깁니다.
- 상태의 공격, 내성, 판정 수정치는 더하거나 빼는 주사위이므로 `flat` 숫자입니다. 굴리는 수정치(`dice`)는 거부합니다.
- 피해는 자체 주사위입니다. 양의 `dice`(생물이나 항목의 것)가 개수를 정하며 자체 주사위여야 하고, `flat` 부분은 던지지 않는 자동 성공입니다. 공격 행의 피해 주사위 열은 개수로 읽고, `damage.ability`는 그 능력치 평점만큼 주사위를 더하며, `damage.bonus`는 자동 성공을 더합니다. `perCostStep`과 `scales`는 늘 그랬듯 주사위를 더합니다. 회복과 임시 점수는 양이며 이전처럼 합산합니다.
- 우선권은 합산(`initiative.dice`와 `modifier`)이거나, 요청하면 풀(`initiative.pool`, 아래 참고)이며, 죽음 규칙은 자체 주사위를 유지합니다.

풀 전투가 그 밖에 굴리는 것은 `pool` 블록입니다.

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`: 한쪽으로 기우는 굴림을 두 번 던져 성공이 더 많은 쪽을 유지할지입니다(대실패는 대실패하지 않은 어떤 던지기보다 적은 것으로 셈). 없으면 상태가 무엇이라 하든 전투는 한 번 던집니다.
- `damageTarget`: 피해 주사위와 흡수 주사위를 던질 때의 주사위별 목표입니다. 생략하면 해결 방식의 기본 목표입니다. 이 주사위는 목표 이상인 눈을 한 번씩만 세며 그 밖에는 아무것도 하지 않습니다. 두 번 세기, 폭발, 상쇄, 대실패가 없습니다.
- `soak`: 대상이 명중 피해에서 피해 종류별로 빼는 것입니다. `all`은 모든 종류에 대한 값 참조이고, `byKind`는 체력 트랙의 종류마다 하나이며 그 종류에서는 `all`보다 우선합니다. 둘 다 지정하지 않은 종류는 흡수하지 않습니다. `"roll": true`이면 대상이 그만큼의 주사위를 피해 목표에 대해 던지고 성공마다 하나를 뺍니다. `"roll": false`이면 피해 주사위를 던지기 전에 그 수를 빼므로 자동 성공에는 닿지 않습니다. 던지는 흡수는 자동 성공도 다른 것처럼 뺍니다. 0 아래로 내려가지 않으며, 아무것도 세지 않은 타격을 흡수하려고 던지지는 않습니다. 생물은 자체 수치를 `soak: { "all": 1, "byKind": { "knock": 3 } }`로 주며, 이를 위해서는 블록의 `soak`가 흡수 방식을 정해야 합니다. 저항, 취약, 면역, `resist-all`은 흡수 뒤 남은 것에 적용합니다.
- `hardness`: 우선권이 공격으로 움직이는 수치일 때 전투원의 경도에 대한 값 참조입니다. [전투 중 방어구와 착용 효과](#armor-and-worn-effects-in-a-fight)를 참고하세요.

모든 대상의 피해는 그 대상마다 던집니다. 명중이 필요한 성공을 넘어 얻은 것과 대상이 흡수하는 것은 대상마다 다르기 때문입니다. 타격의 두 번째 절과 부가 효과는 각자 자체 종류의 별도 피해 풀이며 명중으로 인한 추가 주사위가 없습니다. 메뉴는 풀을 정확히 예측합니다. 필요한 성공에 도달할 확률과, 첫 대상이 흡수한 뒤 피해 주사위의 가치입니다.

Gravewatch가 이렇게 작성되어 있습니다. 파수꾼은 평점과 전문 기술을 던지고, 타박은 Sinew로 흡수하지만 찢긴 상처는 전혀 흡수하지 않으며, 턴마다 Resolve 1점을 쓸 수 있고, 라운드마다 우선권을 다시 던집니다.

**역순 선언은 구현하지 않습니다.** 일부 시스템은 누구든 행동하기 전에 가장 느린 사람부터 모두 행동을 선언합니다. 각 전투원이 자기 턴이 오면 행동 하나를 고르는 전투에서는 먼저 선언해도 어떤 규칙이 읽는 것도 바뀌지 않으므로 키로 표현할 것이 없습니다.

### 최소 피해 주사위(Capability API 1.146)

풀 전투는 Exalted의 **Overwhelming**처럼 강한 흡수에 맞서서도 주사위를 남길 수 있습니다.

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

이것은 `combat.damage.minimum`이며, **공격자**의 현재 시트에서 읽는 값 참조입니다. 정적 흡수가 명중의 첫 피해 풀에서 주사위를 뺀 뒤, 풀을 최소 이 수까지 올립니다. 자동 성공이 아니라 온전한 주사위이며, 내림하고 0과 `resolution.pool.max` 사이로 제한하므로 남은 주사위도 모두 실패할 수 있습니다. 굴리는 흡수는 여전히 피해 던지기 뒤 성공을 뺍니다. 주사위 풀을 줄이지 않으므로 최솟값이 그로부터 성공을 지켜 주지는 않습니다. 저항과 면역은 여전히 적용됩니다. 우선권을 소비하는 타격은 무기 피해와 흡수를 무시하듯 최솟값도 무시하며, 우선권을 빼앗는 타격은 이를 씁니다.

무기는 `item.attack.damage.minimum`으로 공통 최솟값을 덮어쓸 수 있습니다. 보유자에 대한 같은 값 참조나, 아이템 자체 숫자 스탯 하나를 가리키는 `{ "stat": "overwhelming" }`를 받습니다. 0을 선언해도 공통 최솟값을 덮어씁니다. 이것은 흡수 뒤 일정 피해를 보장하는 기존 무기 `floor`와 다릅니다. 추가 피해 절과 부가 효과는 또 다른 최솟값을 받지 않습니다. 전투 기록과 로그는 주사위 옆에 정해진 최솟값을 보여 줍니다. 전투 키와 무기 키 모두 외부 카탈로그 파일의 무기를 포함해 패키지에서 **Capability API 1.146**이 필요합니다.

### 멍하게 만드는 명중(Capability API 1.147)

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze`는 풀 전투용입니다. `over`는 명중 직전 **대상**의 현재 시트를 읽습니다. 한 명중이 흡수, 내성, 저항 뒤 그 숫자보다 **엄격히 많은** 피해를 줘야 합니다. 그 피해 절들은 함께 세며, 서로 다른 명중은 멍함을 향해 누적되지 않습니다. 타격마다 표시하는 트랙에서는 피해를 준 명중을 한 단계로 셉니다. 체력 대신 우선권을 빼앗는 타격은 멍하게 할 수 없습니다. `measure`는 현재 `"damage"`만 가능합니다.

대상은 정확히 다음 턴 하나를 건너뜁니다. 그 턴 전의 추가 멍함 명중은 건너뛰기를 더 쌓지 않습니다. 건너뛴 턴에도 상태 시계와 라운드 변경, 우선권 재굴림을 포함한 다른 턴 관리는 진행됩니다. 전투를 저장하고 다시 불러와도 대기 중인 건너뛰기는 유지됩니다. `condition`이 있으면 선언된 시트 상태를 지정합니다. 전투는 건너뛴 턴이 지나가거나 전투가 끝날 때까지 이를 표시합니다. 이미 있는 상태는 그대로 두며, 상태 면역은 표시를 막지만 건너뛰기는 막지 않습니다. `text`는 선택 사항인 서술이며 또 다른 효과가 아닙니다. 로그와 Game Master의 전투 컨텍스트에 명중과 건너뛰기가 기록됩니다. 이 키는 **Capability API 1.147**이 필요합니다.

### 대상이 고르는 부상 종류(Capability API 1.148)

기존 `combat.damageKinds` 대응에 `remap`을 더하고 `default`, `byType`, `marks`는 유지하세요.

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

풀 전투는 먼저 일반 대응으로 공격의 종류를 고른 뒤, 각 remap의 `when`을 **대상**에서 읽습니다. 0이 아닌 숫자면 규칙이 켜집니다. `from`과 `to`는 둘 다 체력 부상 트랙의 종류여야 합니다. 일치하는 첫 규칙이 이기며 remap은 연쇄하지 않습니다. 최대 12개까지 줄 수 있습니다. `tags`가 있으면 그중 하나 이상이 공격과 일치해야 합니다. 무기는 이미 `item.tags`를, 카탈로그 mechanics와 생물 피해는 이미 `qualities`를 지닙니다. 이 이름들은 `items.tags`에서 옵니다. `tags`가 없으면 그 종류의 모든 공격이 일치할 수 있습니다. 새 공격 태그 필드는 필요 없습니다.

결과 종류가 **흡수**와 부상 표시를 모두 정합니다. 따라서 화기의 치명성 명중은 뱀파이어에게는 타격성이 되어 타격성 흡수를 쓰며, 같은 화기가 다른 누군가에게 하거나 칼날이 그 뱀파이어에게 하면 일반 종류를 유지합니다. 공격의 원래 피해 _유형_은 저항과 면역에서 바뀌지 않습니다. 각 피해 절은 자체 종류와 공격의 태그를 씁니다. 전투 기록과 로그는 원래 종류와 다시 대응한 종류를 보여 주며, 피해 예측도 같은 규칙을 읽습니다. 시트가 없는 단순 생물은 상수 참조는 충족할 수 있지만 이 규칙에 시트 값을 줄 수는 없으므로, 그러려면 생물 시트를 주세요. 새 `remap` 키만 **Capability API 1.148**이 필요하며, 이전 피해 종류 대응은 기존 호환성을 유지합니다.

### 공격이 움직이는 우선권

일부 풀 시스템은 우선권을 전투 내내 수치로 유지하고 공격이 이를 움직이게 합니다. 한 공격 방식은 대상에게서 우선권을 빼앗고, 다른 방식은 공격자 자신의 우선권을 피해로 소비하며, 정해진 선까지 떨어진 사람은 붕괴합니다. `dice-pool` 전투는 이를 표현할 수 있습니다(Capability API 1.48).

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **시작.** 전투가 시작될 때 모두 `pool`개의 주사위를 던지며 성공 수에 `plus`를 더한 것이 각자의 수치입니다. 따라서 `resource`에는 `pool`이 필요합니다. 합산 주사위는 순서일 뿐 주사위 개수가 아니기 때문입니다. 풀 전투가 더하는 모든 숫자는 주사위이므로 생물의 `initiativeModifier`는 그 풀입니다. 수치는 유지되며 다시 던지지 않고(`resource`와 함께 쓴 `each`는 거부), 각 라운드가 시작될 때 그때의 수치로 순서를 정렬합니다.
- **방식.** 모든 공격(공격 행, 명중 굴림을 하고 피해를 주는 능력이나 카탈로그 항목, 그런 생물의 행동, 다른 행동으로 이루어진 행동)은 방식마다 한 번씩 제공되며, 플레이어는 대상보다 방식을 먼저 고릅니다. 최대 네 개이며 각각 빼앗거나 소비하고, 하나 이상은 빼앗는 방식이어야 합니다. 방식을 지정하지 않은 선택은 첫 방식으로 하며, 그 공격이 제공되지 않는 방식을 지정한 선택은 거부합니다. 공격은 끝날 때까지 선택한 방식을 유지하며, 명중 전에 응답이 공격자의 수치를 바꿔도 마찬가지입니다.
- **빼앗는 방식.** 명중하면 피해를 평소처럼 던지며(명중으로 인한 추가 주사위, 무기 주사위, 종류별 흡수, 자동 성공), 센 값만큼 대상의 체력 대신 수치를 뺍니다. 공격자는 그 전부에 `gain`을 더해 얻습니다.
- **소비하는 방식.** 공격자의 수치가 붕괴선(`crash`가 없으면 0)보다 높은 동안만 제공되며, 수치는 한 타격에 소비하므로 다른 행동으로 이루어진 행동에는 제공되지 않습니다. 명중하면 공격한 시점의 공격자 수치를 피해 목표에 대한 주사위로 던지며 그 밖에는 아무것도 없습니다. 무기 주사위, 명중 추가 주사위, 자동 성공, 흡수가 모두 없습니다. 공격 자체의 피해 종류로 체력에 표시합니다. 공격이 끝나면 어디든 명중한 수치는 `base`로 돌아가고, 아무 데도 명중하지 못한 수치는 공격 당시 수치에서 `onMiss`가 정한 만큼 잃습니다(단계 표: `[at least, lose]` 쌍을 오름차순으로 쓰며 첫 단계 아래는 잃지 않음).
- **붕괴.** 수치가 `crash.at` 이하로 떨어지면 붕괴합니다. `condition`(자체 상태 중 하나이며 선택 사항)이 걸리고, 그렇게 만든 사람은 `bonus`를 얻습니다. 빗나가서 자기 자신을 붕괴시킨 경우에는 아무도 보너스를 얻지 않습니다. 붕괴한 전투원은 소비할 수 없습니다. 붕괴는 수치가 다시 선 위로 오를 때, 자신의 턴 `recoverAfter`번 뒤(그 턴이 시작될 때 수치가 `base`로 돌아감), 그리고 어떻게 끝나든 전투가 끝날 때 상태와 함께 해제됩니다. 시작 던지기가 선 이하인 사람은 붕괴한 채로 전투를 시작합니다. `base`는 `crash.at`보다 높아야 합니다. 그렇지 않으면 돌아가는 순간 다시 붕괴합니다.

메뉴는 방식마다 자체 예측을 보여 줍니다. 명중 확률과, 빼앗는 방식이 빼앗을 양 또는 소비하는 방식이 줄 피해입니다. 상태 패널은 모두의 수치를 보여 주고, 로그는 모든 변화와 이유를 알려 줍니다. "Ada gains 5 initiative for crashing Rats, and is on 14." Engine의 선택기는 빼앗는 타격을 한 턴 앞까지 평가합니다. 빼앗은 뒤 소비하는 것과, 지금 소비한 뒤 기준값에서 다시 소비하는 것을 비교합니다.

<a id="what-a-fight-reads-from-mechanics"></a>

### 전투가 `mechanics`에서 읽는 것

`kind`는 `amount`가 피해인지 회복인지 결정합니다. `reaction` 표시는 메뉴에서 제외되며, `utility` 항목도 턴 자체가 가질 수 있는 것을 바꾸지 않으면 제외됩니다(아래 참고). `attackRoll`은 목록의 `toHit`로 표적의 방어에 대한 굴림을 하게 하며 `autoHit`는 이를 완전히 건너뜁니다. `save`는 목록의 `saveDifficulty`에 대해 표적 자체의 내성을 굴리고, `onSuccess`는 성공 시 절반을 받는지 아무것도 받지 않는지 정합니다. `targetCount`는 겨눌 수 있는 표적 수입니다. 공격 굴림이 없는 능력(모두가 내성을 굴리는 범위, 그냥 명중하는 것)은 모두에 대해 주사위를 한 번만 굴립니다. 표적마다 명중 굴림을 하는 능력은 명중마다 피해 주사위를 다시 굴립니다. `applies`는 영향을 받은 대상에게 상태를 부여합니다. 각 상태는 `duration`으로 `instant`(자체 시계 없이 무언가 해제할 때까지 유지), `until-save`(`saveEnds`를 함께 지정해야 함), `{ "rounds": n }` 중 하나를 가지며, 선택적 `saveEnds`로 내성과 이를 `turn-end` 또는 `turn-start` 중 언제 반복하는지 지정합니다. 라운드는 보유자 자신의 턴이 끝날 때마다 줄어듭니다. `{ "rounds": 1, "at": "turn-start" }`는 턴이 시작될 때마다 세며, "다음 자신의 턴 시작까지"를 표현하는 방법입니다. `"of": "source"`(Capability API 1.119)는 대신 상태를 건 사람의 턴을 그 사람의 다음 턴부터 세며, 다른 사람에 대해 "상태를 건 사람의 다음 턴이 끝날 때까지"를 표현하는 방법입니다. Guiding Bolt의 `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }`는 시전자의 다음 턴이 끝나기 전 대상에 대한 다음 공격 굴림에 이점을 줍니다. 출처가 전투를 떠나면 라운드는 보유자 자신의 턴으로 셉니다. 전투 상태의 `delays`(Capability API 1.120)는 보유자가 쓰는 것을 미룹니다. 그 `catalogs` 중 하나에서 온 행동을 그 `budget`으로 지불하면 `chance.sides`면 주사위를 굴리고, `chance.atLeast` 이상이면 아직 일어나지 않습니다. 보유자의 다음 턴이 시작될 때 같은 예산으로 완료되어 응답까지 포함해 원래대로 진행되며, 행동할 수 없거나 그 예산이 없으면 사라집니다. 어느 쪽이든 비용은 소모된 채입니다. 5e의 Slow는 `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`입니다. `endsAfter`는 시계와 관계없이 첫 `own-attack`(보유자의 다음 공격 굴림), `attacked`(보유자를 상대로 한 다음 공격 굴림), `own-save`(보유자의 다음 내성) 뒤에 상태를 해제합니다. 따라서 `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }`는 "다음 턴이 끝나기 전 다음 공격에서"입니다. 공격 하나 동안 유지되는 상태는 피해를 포함해 그 공격 전체 동안 유지되며, 같은 타격이 새로 건 상태는 남습니다. 둘 다 Capability API 1.45가 필요합니다. `temporary`는 체력 풀에 임시 점수를 주며 중첩하지 않고 큰 완충치만 남깁니다. `scales`는 읽은 값에 대해 표가 제공하는 추가 주사위만큼 양을 늘립니다. `cost`는 시트 자체의 `use` 명령으로 지불하며, `budget`은 소모하는 행동 체계의 부분을 덮어씁니다.

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
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
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

`sources`는 적용할 공격 목록을, `requires`는 그 행에서 참으로 평가되는 열 하나를 지정합니다. 특정 무기에서만 발동하는 부가 효과도 Engine이 무기를 이해할 필요 없이 어느 무기인지 말할 수 있습니다. 둘 다 지정하지 않으면 보유자가 명중시킨 모든 타격이 대상입니다. 가방에서 꺼내 든 무기는 행이 아니므로 `weapons`(Capability API 1.70)가 발동할 아이템 태그도 지정합니다. `"weapons": { "tags": ["finesse",
"ranged"] }`는 두 태그 중 하나를 가진 손에 든 무기의 명중에서 보조 손 타격을 포함해 발동합니다. `weapons`만 지정하면 어느 행에서도 발동하지 않고, 행만 지정하면 손에 든 무기에서 발동하지 않습니다. `when`은 하나라도 충족하면 됩니다. `advantage`는 공격 굴림이 최종적으로 어느 쪽으로 유리했는지이며, `ally-adjacent`는 서 있고 행동할 수 있는 공격자의 아군으로, 보드에서는 표적의 한 칸 이내, 보드 밖에서는 어디에 있어도 됩니다. `ally-adjacent-no-disadvantage`(Capability API 1.126)는 이점과 불리점이 상쇄된 뒤 최종 굴림이 불리점이 아니어야 한다는 조건도 요구하며, 위 예시는 Sneak Attack에 이를 씁니다. `oncePer`는 `turn`(존재하는 모든 턴이 시작할 때 갱신하므로 다른 사람이 행동할 때 한 타격에도 붙일 수 있음) 또는 `round`입니다. `amount`는 항목 자체의 `scales`에 따라 늘고, `type`은 피해 종류이며 기본값은 타격 자체의 종류입니다.

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

아래 수치는 생물을 직접 수치로 작성하는 방식입니다. 규칙 집합 자체 용어로 `sheet`를 작성하면 `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak`, `hardness`는 대신 그 시트에서 가져옵니다(아래 '규칙 집합 자체 용어로 작성한 생물' 참고).

- `health`: 숫자 또는 전투 생성 시 한 번 굴리는 `{ "dice": "3d6", "flat": 2 }`입니다. 예측은 평균을 읽으므로 메뉴가 아직 아무도 굴리지 않은 주사위 결과를 약속하지 않습니다.
- `defense`, `initiativeModifier`, `speed`: 각각 공격 굴림의 목표, 우선권에 더하는 값(우선권을 풀로 던지는 경우 던지는 주사위 수), 자체 거리 단위로 한 턴에 걷는 거리입니다.
- `abilities`와 `saves`: 시트가 선언한 능력치 ID와 내성 ID를 키로 씁니다. 지정하지 않은 내성은 0으로 읽습니다.
- `checks`: 겨루기에서 더하는 값으로 `combat.checks`의 ID를 키로 씁니다. 지정하지 않은 것은 0으로 읽습니다. Capability API 1.43.
- `soak`: `dice-pool` 전투에서만 쓰며 흡수하는 양입니다. `all`은 모든 피해, `byKind`는 체력 트랙의 종류별 값입니다. Capability API 1.47.
- `hardness`: 우선권이 공격으로 움직이는 수치일 때, 주사위가 이보다 낮은 소비 타격은 아무 효과가 없습니다. Capability API 1.56.
- `speeds`와 `hover`: 걷기 외의 이동 방식입니다('위치' 아래 '다른 이동 방식' 참고). Capability API 1.113.
- `shield: true`: 손이 차 있으므로 행동의 `twoHanded` 대안이 성립하지 않습니다. Capability API 1.102.
- `size`: ID로 지정한 `combat.sizes` 중 하나이며, 겨루기의 `maxSizeAbove`가 읽습니다('크기와 벗어나기 DC' 참고). Capability API 1.103.
- `type`과 `tags`: ID로 지정한 `combat.creatureTypes.types` 중 하나와 그 `tags` 최대 여덟 개이며, 대상 검사가 읽습니다('생물 유형과 대상 검사' 참고). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: 피해 유형으로, 대소문자 구분 없이 비교하고 `combat.damageTypes`를 선언했다면 그 목록으로 검증합니다. `resist`나 `immune` 항목은 무엇이 통하는지도 지정할 수 있습니다. `{ "type": "tearing", "except": ["silver"] }`이면 그 아이템 태그 중 하나를 가진 무기 아이템의 타격은 그대로 받습니다(Capability API 1.55, [전투 중 무기](#weapons-in-a-fight) 참고). `damage.qualities`가 그 태그를 지정한 행동이나 `mechanics.qualities`가 지정한 카탈로그 항목도 마찬가지입니다(Capability API 1.101). `conditionImmunities`는 자체 상태나 `combat.levels`가 읽는 트랙을 지정합니다(Capability API 1.115).
- `tier`: `combat.threat`의 어느 단계에 속하는지입니다.
- `loot`(Capability API 1.63): 이긴 전투가 이 생물에 대해 굴리는 전리품 표의 ID입니다(위의 전리품 참고).
- `traits`: Game Master에게 보여 주는 짧은 이름과 설명의 쌍입니다. 자동 해결하지 않으므로 숫자가 들어가는 내용은 행동에 넣어야 합니다.
- `signaturePoints`: 자신의 턴 시작에 돌려받는 점수로, `signature` 행동에 사용합니다.
- `riders`: 최대 네 개입니다. 카탈로그 항목의 `rider`와 같은 것을 블록에 작성합니다. 각 항목은 `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }` 형태이며, 선택적 `type`과 이 블록 자체의 어느 행동에서 발동할지 지정하는 선택적 `actions`를 가질 수 있습니다. 블록의 부가 효과는 시트 목록을 읽지 않으므로 `sources`와 `requires`는 갖지 않습니다. 시트로 작성한 생물은 캐릭터와 똑같이 목록이 지닌 부가 효과를 얻습니다.
- `actions`: 최대 열두 개이며 각자 고유 `id`가 있습니다. 행동은 손으로 쓴 능력치 블록의 내용(`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`)과 생물만 갖는 네 가지를 더 담습니다. `reach`는 타격이 닿는 거리, `range`는 투척 또는 사격 거리, `area`는 적용 형태이며 모두 자체 거리 단위를 씁니다. `range`는 단순 숫자 또는 불이익을 받고 더 멀리 닿는 경우 `{ "normal": 30, "long": 120 }`일 수 있습니다. `area`는 `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }`입니다('위치' 참고).
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. 다 쓰면 행동이 메뉴에서 사라집니다.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. 전투 시작 시 사용 가능하고, 사용하면 소모되며, 생물 자신의 턴 시작에 굴려 `from` 이상이면 다시 돌아옵니다. 어느 결과든 주사위를 로그에 남깁니다.
  - `damage.alternatives`(Capability API 1.102): 첫 양 대신 주는 양 최대 네 개이며, 각각 `{ "when": ..., "dice": "1d10", "flat": 3 }`이고 처음으로 성립하는 것이 이깁니다. 유형, 절, 성질은 행동 자체의 것을 유지합니다. `"when": "twoHanded"`는 생물이 `"shield": true`를 가지지 않는 한 성립하며, 5e의 "양손으로 사용하면 참격 피해 8 (1d10 + 3)"입니다. `"when": { "selfHealthAtMost": 0.5 }`는 체력이 최대치의 그 비율 이하인 동안 성립하며, 무리의 "무리의 체력이 절반 이하이면 관통 피해 5 (2d4)"입니다. 메뉴의 예측과 타격 모두 현재 상태 그대로 읽습니다.
  - `sequence`: 같은 블록의 다른 행동들을 순서대로 나열하며 각자 표적이 있습니다. **한 행동으로 두 번 공격하는 생물은 이렇게 작성합니다.** 예산 한 번으로 전체 연속 행동을 지불합니다. 연속 행동 자체는 별도 내용을 갖지 않으며 다른 연속 행동을 지정할 수 없습니다.
  - `signature`: `{ "cost": n }`. 예산 대신 생물 자체 점수로 지불하며 다른 사람이 행동할 때만 사용할 수 있습니다. 전투는 한 턴과 다음 턴 사이의 창에서 제시합니다('창' 참고).
  - `reaction`: 카탈로그 항목의 `mechanics.reaction`과 같은 객체입니다('창' 참고). 이 행동은 어느 턴의 메뉴에도 없고 대신 지정한 순간에 제공됩니다. 반응은 고유 행동을 겸할 수 없으며 연속 행동이 반응을 만들 수도 없습니다.
  - `self: true`: 다른 누군가가 아니라 생물 자신에게 적용되므로 `targetCount`나 `area`를 갖지 않습니다. 둘 다 Capability API 1.46이 필요합니다. Parry는 둘 다 해당하며, 방어에 2를 더하는 `parrying` 상태를 씁니다.

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```
- 내성에는 행동 자체의 난이도가 필요합니다. 행동이 강제하는 내성은 `save.difficulty`, 행동 자체 내성이 없는 경우 내성으로 끝나는 상태는 `saveDifficulty`입니다. 시트가 있는 생물도 블록 행동은 직접 수치로 작성하므로 그 수치는 행동에 둡니다. 절 자체의 내성은 `difficulty`를 생략하고 같은 수치로 돌아갈 수 있습니다.
- `damage.plus`는 카탈로그 항목의 `plus`와 같은 절 목록이며 정확히 같은 방식으로 읽습니다. `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }`는 열기를 독립적인 양으로 담은 물기이며, 열기는 따로 저항하고 따로 두 배가 됩니다.

생물 행동은 `heal`(주사위, 고정 양 또는 둘 다)로 체력을 돌려줄 수 있으며, 대상의 최대치까지입니다. `targets: "ally"`는 자신을 포함한 자기 편에, `targets: "any"`는 어느 편에든 닿습니다. `targets`가 없으면 이전처럼 상대편에 닿습니다. 이 키들은 Capability API 1.121이 필요합니다. 회복에는 `damage`, `toHit`, `save`, `area`가 없고, `targets`는 `self`나 `sequence`와 함께 쓸 수 없으며, 연속 행동은 어느 키도 가지지 않습니다. 데바의 Healing Touch는 다음과 같습니다.

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

생물의 `spellcasting`(Capability API 1.123)은 슬롯이나 점수를 쓰지 않고 카탈로그 주문을 시전합니다. 그 `saveDifficulty`와 `toHit`가 주문의 숫자를 주며, `sheet`가 있는 생물은 이를 생략하고 시트의 주문 시전 숫자를 쓸 수 있습니다. 단순 생물은 주문에 필요한 모든 숫자를 줘야 합니다. 각 `entry`는 `mechanics`가 있는 기존 카탈로그 항목을 지정합니다. `uses`를 생략하면 자유롭게 쓸 수 있으며, `level`은 `perCostStep` 증가를 위한 시전 레벨이고 생략하면 항목의 기본 레벨입니다. 예산, 대상, 집중, 반응, 범위, 소환은 여전히 항목이 줍니다. 드라이어드의 목록은 다음처럼 쓸 수 있습니다. 이 주문 ID들은 예시이며 `spells` 카탈로그에서 제공해야 합니다.

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

마녀 집회라면 `spells` 옆에 `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }`을, 공유하는 각 주문에 `"coven": true`를 더하세요. 그 주문들은 시전자 편에 서 있는 전투원 중 적어도 셋이 그 집회 ID를 지니고, 각자 단순 칸 거리로 시전자로부터 규칙 집합 거리 단위 30 이내에 있는 동안만 제공됩니다. 보드가 없으면 서 있는 모든 구성원을 셉니다. 각 주문의 사용 횟수는 집회 ID와 항목을 키로 하는, 그 집회 전체가 공유하는 풀 하나입니다. 집회 블록에는 집회 주문이, 집회 주문에는 블록이 필요하며, 중복 항목은 거부합니다. Game Master가 제안한 생물은 제한 처리 시 `spellcasting`을 잃습니다. 위협 척도로는 주문 목록을 제한할 수 없기 때문입니다.

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
- **각 수치의 출처는 하나입니다.** 시트가 있는 생물은 `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`를 따로 제공하지 않습니다. 제공하면 Engine이 파일을 거부합니다. 목록이 하는 일을 정하므로 자체 `actions`가 없어도 됩니다. 시트가 없는 생물은 여전히 처음 세 항목과 행동 하나 이상을 제공합니다.
- **작성자가 만든 데이터로서 검증합니다.** 모든 ID는 시트가 선언한 것이어야 합니다. 기술과 내성은 제공한 숙련 단계 중 하나로 설정하며, 필드, 점수, 보너스, 열은 선언된 값(범위 안의 정수, 선택 값 중 하나 등)을 담고, 목록은 허용 행 수를 넘을 수 없습니다. 생물이 소모한 것은 전투가 보관하므로 `live` 부분은 없습니다.
- **행은 카탈로그에서 가져올 수 있습니다.** `_catalog: "<catalog>/<entry>"`는 캐릭터 시트처럼 행을 고른 항목을 지정하며, 전투가 그 행의 비용과 효과를 읽는 곳도 그 항목입니다. 카탈로그는 해당 목록에 공급하는 것이어야 합니다. 인라인 카탈로그라면 항목이 그 안에 있어야 합니다. 별도 파일이라면 파일에 없는 항목을 지정한 행은 생물에게 아무것도 주지 않을 뿐입니다. 생물 도감의 시트가 지정하는 카탈로그는 도감과 함께 전투용으로 불러옵니다.
- **시트 밖에 쓴 내용도 적용됩니다.** `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune`, `conditionImmunities`입니다.
- **자체 풀에서 지불합니다.** 풀은 가득 찬 상태로 시작하고, 목록이 주는 행동에 소모합니다. Engine과 Game Master 중 누가 결정하든, 파티원과 똑같이 더 크게 지불하는 방법(더 높은 슬롯에서 주문 시전)도 제시됩니다. 경비병의 Hold the Line은 Luck을 소모합니다.
- **부상 트랙을 쓰면 체력은 그 트랙입니다.** 타격은 `resist`, `vulnerable`, `immune`를 먼저 반영한 뒤 `damageKinds`에 따라 생물 자체 트랙에 표시합니다. 따라서 어떤 피해에 면역인 생물은 그 피해로 표시를 받지 않습니다.
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

- 체력을 읽는 단 하나의 필드를 통해 단계 범위에 맞춥니다. 풀의 최대치가 그 필드이거나 정확히 필드 하나가 든 `sum`입니다(5e의 최대 체력, Ember Roads의 Toughness). 단일 필드가 없는 체력 공식은 작성된 그대로 두고 로그에 알립니다. 부상 트랙의 길이는 작성자의 것이므로 바꾸지 않습니다.
- 생물을 만든 뒤 방어, 명중, 내성 난이도를 단계 자체보다 2 높게 제한하며, 지불 가능한 가장 큰 비용까지 계산한 최강 라운드가 단계의 `damagePerRound`에 들어올 때까지 피해를 줄입니다. 큰 지불로 얻는 추가 효과부터, 그다음 주사위, 고정 부분, 타격 하나, 마지막으로 주사위 면 수를 줄입니다.

직접 작성한 생물 도감은 제한하지 않습니다. 작성자의 데이터이므로 Engine이 그대로 받아들입니다.

### 위치: 보드 위 전투

블록이 보드 한 칸의 거리를 정하기 전까지 전투는 머릿속 장면으로 진행됩니다. `distance`를 선언하면 격자에서 싸울 수 있으며, 이동, 근접 거리, 사거리, 범위, 시선, 엄폐, 걸어 나가는 상대를 치는 행동이 의미를 갖기 시작합니다. 모두 작성자가 쓴 숫자이며 Engine은 보드만 제공합니다.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
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

**다른 이동 방식**(Capability API 1.113). 생물의 `speeds`는 걷기 외의 이동을 자체 단위로 줍니다. `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }`이며, `"hover": true`는 비행자가 떠 있기 위해 움직일 필요가 없다는 뜻입니다(`fly` 속도가 필요). 파티원의 것은 같은 키를 쓰는 값 참조인 `economy.movementModes`로 시트에서 읽으며, 종족의 수영 속도나 주문의 비행 속도가 그 예입니다. 0은 그 방식으로 움직이지 않는다는 뜻입니다. `speed`와 `economy.movement`는 걷기로 남습니다. 보드에서는 다음과 같습니다.

- 허용량은 가장 빠른 이동 방식이며, 움직인 모든 칸이 모든 방식에서 동시에 빠집니다. 따라서 걷기 30, 비행 60인 생물은 10을 걷고 40을 날 수 있지만 30을 넘게 걸을 수는 없습니다.
- 비행자는 물과 높이에 관계없는 단차를 포함해 단단하지 않은 어디로든 한 칸에 걸음을 옮깁니다.
- 수영자는 물을 한 칸에 건너며, 땅에서는 걷습니다.
- 등반자는 밟는 지면의 비용으로 높이에 관계없는 단차를 오릅니다.
- 굴착자의 속도는 Game Master를 위해 기록하며 걷기처럼 움직입니다. 보드에는 굴을 팔 땅이 없기 때문입니다.

각 걸음은 충분히 남은 방식 중 가장 싼 방식으로 합니다. 보드가 없는 전투는 이를 전혀 읽지 않으며, 걷기만 하는 사람은 이전과 똑같이 움직입니다.

**비행 고도**(Capability API 1.114). 규칙 집합이 `combat.elevation.levelHeight`와 `combat.distance.perCell`을 주는 보드에서는 비행자에게 그 자리에서 Fly up과 Fly down이 제공되며, 각각 한 단계만큼의 비행을 씁니다(5피트 칸에서 5피트 단계는 한 칸). 아래 지면에서 최대 20단계까지 오를 수 있습니다. 떠 있는 동안에는 다음과 같습니다.

- 날기만 하며, 단단하지 않은 것 위로 걸음마다 한 칸씩 납니다.
- 다른 누군가와의 거리는 평면 거리와 둘 사이의 높이 중 큰 값이므로, 근접 거리 5피트인 검은 30피트 위의 드래곤에 닿지 못하고 드래곤의 물기도 기사에게 닿지 못합니다.
- 더 낮은 누구에 대해서든 언덕이 주는 것처럼 고지대를 차지합니다.
- 너무 높아 닿지 못하는 누군가의 근접 거리를 떠나도 공격을 유발하지 않습니다.
- 쓰러지거나, 넘어지거나, 속도가 0으로 묶이면 `hover`가 없는 한 `falling`에 따라 아래 지면으로 떨어집니다.

자신과 같거나 더 높은 지면 위로 날아가면 착지합니다. 지상의 비행자가 절벽 위로 날아오르는 것과 같습니다. 새 키는 없습니다. 1.114 이전의 Engine은 비행자를 지면에 두므로, 고도에 의존하는 패키지는 1.114를 선언합니다.

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

항목의 `mechanics.area`나 생물 행동의 `area`에 있는 직선은 `size`와 같은 단위의 `width`를 가질 수 있으며, 최소 한 칸으로 칸 단위 반올림합니다(Capability API 1.128). 예를 들어 너비 10피트인 60피트 직선은 `{ "shape": "line", "size": 60, "width": 10 }`입니다. 생략하면 한 칸이며, 칸 너비가 짝수면 추가 열은 시전자의 왼쪽에 놓입니다.

**시선과 엄폐.** 둘 사이를 잇는 직선상의 칸을 봅니다. 그 위의 벽이나 산이 사격을 막고 범위가 그 너머로 퍼지는 것도 멈추며, 해당 표적은 메뉴에 나오지 않습니다. 물 너머는 보입니다. 사격은 강을 건너고, 직선 범위도 그 위로 계속 이어집니다. Engine 자체 전투도 같은 시야 검사를 씁니다.

엄폐는 공격자가 선 곳에서, DMG의 선택 격자 규칙의 모서리 선으로 읽습니다. 공격자의 가장 좋은 모서리에서 대상 칸의 각 모서리로 선을 하나씩 긋습니다. 벽이나 산을 지나는 선이 셋이나 넷이면 4분의 3 엄폐이고, 하나라도 그런 것을 지나거나 엄폐 가치가 있는 지형(숲, 폐허)을 지나면 절반 엄폐입니다. 낮은 지형만으로는 절반을 넘지 않습니다. 공격자가 전혀 볼 수 없는 대상은 완전 엄폐이며 메뉴에 나오지 않습니다. 공격에 대해서는 엄폐 가치가 있는 지형에 선 대상이 늘 그랬듯 최소 절반 엄폐를 가집니다. 내성에는 대상과 효과 사이에 있는 것만 도움이 됩니다.

- `cover.bonus`는 절반 엄폐가 공격 굴림이 대항하는 방어에 더하는 값이며, 로그에 알립니다.
- `cover.threeQuarters`(Capability API 1.74)는 4분의 3 엄폐가 더하는 값입니다. 없으면 `bonus`가 둘 다에 쓰입니다.
- `cover.saves`(1.74)는 엄폐가 돕는 내성도 지정합니다. 행동 자체의 내성(상태를 끝내거나 집중을 유지하는 내성은 제외)에 대해, 폭발은 떨어진 지점에서, 그 밖의 것은 만든 이로부터 잽니다. 이것도 로그에 알립니다.
- `cover.creatures`(1.74)는 아군이든 적이든 사이에 선 누구나 절반 엄폐로 만듭니다.
- 대상이 엄폐의 이득을 얻지 못한다고 문구에 적힌 내성(5e의 Sacred Flame)은 항목의 `mechanics.save`, 생물 행동의 `save`, 아이템 사용의 `save`에 `"ignoresCover": true`(1.74)를 씁니다.

**고도.** 보드는 최대 세 단계까지 높이를 가질 수 있으며, 위치가 있는 모든 전투는 규칙 집합과 관계없이 높이에 따라 걷고 봅니다. 한 단계 오르는 데는 한 칸이 더 들고, 내려가는 데는 비용이 없으며, 두 단계 이상의 단차는 아무도 걷지 못하는 절벽이고(아무도 밀려 올라가지 않음), 양 끝보다 높은 지면은 시야를 막습니다. 더 높은 곳에서 아래로 쏠 때는 사이의 낮은 엄폐가 아무것도 가리지 않습니다. 규칙 집합은 `elevation`으로 시스템이 더하는 것을 정합니다(Capability API 1.75, `distance` 필요).

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight`는 규칙 집합 자체 거리 단위로 한 단계의 높이입니다.
- `highGround`는 더 높은 곳에서 아래로 공격할 때 공격 굴림에 주는 것입니다. `"advantage"`, 또는 공격 굴림이 대항하는 방어에서 빼는 `{ "bonus": n }`입니다. 생략하면 아무것도 주지 않습니다.
- `rangeBonus`는 더 높은 곳에서 사격이 몇 칸 더 멀리 닿는지입니다.
- `falling`은 낙하가 하는 일입니다. 두 단계 이상의 단차에서 밀려 떨어진 사람은 아래에 떨어져, 낙하 높이(단계 수 × `levelHeight`)의 `per`마다 `dice`를 최대 `max`개까지 `type` 피해로 받고, `prone` 상태가 있으면 그 뒤 그 상태를 받습니다. 주사위는 시스템이 피해를 던지는 방식으로 던집니다. 합산하거나, `dice-pool`에서는 성공으로 세고 흡수를 뺍니다. 낙하는 다른 타격과 같으므로 누군가를 쓰러뜨리거나 집중을 깰 수 있습니다. 로그는 얼마나 떨어졌는지 알려 줍니다. `falling`이 없으면 낙하는 기록만 되고 아무 일도 하지 않습니다.

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

전투 화면은 작성자의 용어로 진행합니다. 메뉴는 자체 공격과 능력, 겨루기, 나열한 표준 행동이며 각 항목이 자체 예산과 풀에서 무엇을 쓰는지 알려 줍니다. 턴 순서, 라운드, 이름을 정한 모든 상태와 남은 라운드, 임시 점수, 집중, 빈사 규칙의 두 횟수를 모두 보여 줍니다. 로그는 자체 용어로 실제 계산을 출력합니다. "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." 허용된 모든 행동은 발생 즉시 시트에 쓰므로 전투 중 다시 불러와도 정확하며, Game Master에게는 나중에 이 수치를 다시 바꾸지 말라고 알립니다.

위치가 있는 전투는 초상화 무대 대신 보드에 그립니다. 플레이어의 사용 방법은 '위치'를 참고하세요. 보드, 메뉴, 로그의 모든 거리는 자체 단위로 표시합니다. "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### 겨루기: 붙잡기, 밀치기, 벗어나기

어떤 동작은 방어를 상대로 한 공격이 아니라 겨루기입니다. 양쪽이 굴려 더 잘한 쪽이 뜻을 이룹니다. 누군가를 붙잡기, 넘어뜨리거나 밀어내기, 벗어나기는 모두 같은 형태이므로 규칙 집합은 각각을 데이터로 표현합니다.

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`**는 겨루기가 읽는 숫자이며, 각각 시트의 값으로 방어나 내성처럼 전투가 시작될 때 한 번 읽습니다. 직접 수치로 쓴 생물은 자체 값을 주고(`"checks": { "brawn": 2 }`), 시트가 있는 생물은 시트에서 읽습니다. 최대 열두 개입니다.
- **굴림.** 양쪽이 `attackRoll.dice`를 던지고 여기서 쓸 수 있는 판정(`attacker.checks`, `defender.checks`) 중 가장 좋은 것을 더합니다. 합계가 높은 쪽이 이기며, `ties`가 `"attacker"`가 아니면 동률은 방어자가 이깁니다. 로그는 양쪽을 모두 보여 줍니다. "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins."
- **이기면** `onWin`이 정한 일을 하며, 하나 이상이어야 합니다.
  - `applies`는 승자를 출처로 하여 패자에게 상태를 겁니다. 따라서 `endsWhenSourceDown`으로 표시한 상태는 붙잡고 있는 쪽이 쓰러지면 끝납니다. `rounds`는 시계를 주며, 없으면 무언가 끝낼 때까지 유지합니다.
  - `ends`는 행동자나 대상에게서 상태를 해제합니다.
  - `push`는 패자를 승자로부터 곧장 멀리, 자체 거리 단위로 그만큼 옮기며 단단한 장애물, 서 있는 누군가, 보드 가장자리, 비집고 지나갈 수 없는 좁은 모서리 앞에서 멈춥니다. 강제 이동이므로 패자의 이동량을 쓰지 않고 아무도 이를 치지 않습니다. 보드가 없는 전투에서는 아무도 움직이지 않습니다.
    지면 아무 일도 없습니다. 붙잡기 실패가 바로 그것입니다.
- **`from: { "holding": "held" }`**는 행동자에게 그 상태를 건 사람만 겨루기의 대상으로 삼고, 그 상태가 유지되는 동안에만 메뉴에 올립니다. 벗어나기를 표현하는 방법입니다.
- **`reach`**는 자체 거리 단위로 닿는 거리이며, 생략하면 옆 칸입니다. `reach`와 `push`에는 `combat.distance`가 필요합니다.
- **`strike: true`**는 행동이 여러 번의 타격을 얻을 때 공격처럼 타격 하나를 대신할 수 있게 합니다. 먼저 하면 예산을 쓰고 나머지 타격을 손에 남기며, 타격을 보유한 상태에서 하면 그중 하나를 씁니다. 5e 참조 규칙은 붙잡기와 밀치기를 이렇게 합니다.
- **메뉴에서** 겨루기는 자체 그룹을 가지며 승리 확률을 표시합니다. Engine이 조종하는 상대는 다른 것처럼 평가하되 신중하게 합니다. 붙잡기나 밀치기는 무언가를 준비하는 것이고, 벗어나기는 붙잡혀 있을 때만 가장 가치가 큽니다. 상대를 조종하는 Game Master는 같은 메뉴에서 고릅니다.
- Game Master가 창작한 상대의 판정은 명중 확률과 마찬가지로 그 단계에 맞춰 제한합니다.

겨루기는 패키지 규칙 집합에서 Capability API 1.43입니다.

<a id="windows-holding-the-fight-open"></a>

### 창: 전투를 보류하기

어떤 순간은 현재 행동자가 아닌 다른 사람의 차례입니다. Engine은 대신 결정하지 않고 그 사람을 위해 전투를 보류합니다. 이 멈춤이 창입니다.

창을 여는 상황은 일곱 가지이며, 둘은 이미 선언한 내용에서 나옵니다.

- **누군가 벗어납니다.** 공격할 수 있는 적의 근접 거리를 떠나는 걷기는 그 한 걸음에서 멈추고 적에게 묻습니다. 위의 '걸어 나가는 상대에 대한 타격'을 참고하세요.
- **한 턴과 다음 턴 사이.** 턴이 끝나면 다음 턴이 시작하기 전에 `signaturePoints`를 갖고 자체 `signature` 행동 하나를 감당할 수 있는 모든 상대에게 구매할지 묻습니다. 살 수 있는 순간은 이때뿐입니다. 고유 행동은 자신을 포함해 누구의 턴 메뉴에도 없습니다.
- **누군가 무언가를 사용합니다.** 해결 전에, 그 순간을 기다리는 항목을 보유한 반대편 모두에게 누구를 겨누든 묻습니다. 단, 그 항목이 사용자에게 닿아야 합니다. 표준 행동과 겨루기는 이 순간을 열지 않습니다.
- **무언가 누군가를 겨눕니다.** 해결 전에, 표적이 된 반대편 중 그 순간을 기다리는 항목을 보유한 모두에게 묻습니다. 아군이 회복시켜 주는 것은 대응할 위협이 아니므로 아군 행동은 창을 열지 않습니다.
- **공격 굴림이 누군가에게 명중합니다.** 피해 전에, 명중당한 사람이 그 순간을 기다리는 항목을 보유하고 있으면 묻습니다. 그 사람이 취한 것은 이번 공격에 적용됩니다. 아래 명중 직후의 순간을 참고하세요.
- **무언가 누군가를 다치게 했습니다.** 해결 후, 누가 했든 피해받은 사람 중 그 순간을 기다리는 항목을 가진 모두에게 묻습니다. 다쳤다는 것은 자신에게 일어난 사실입니다. 그래도 가해자에게 되돌려 겨누는 항목을 아군에게 겨눌 수는 없습니다.
- **누군가 떨어집니다.** 피해와 넘어짐 전에, 떨어지는 사람에게 닿고 그 편을 허용하는 반응을 보유한 사람에게 묻습니다(Capability API 1.124).

- **누군가 턴을 시작합니다.** 행동하기 전에, 그 사람이 항목의 대상 편이고 항목이 그 사람에게 닿으면 묻습니다(Capability API 1.131).

마지막 여섯 가지는 카탈로그 항목이나 생물 자체 행동이 기다리는 순간을 지정해 요청하는 것입니다. 한 행동이 `used`와 `aimed`를 모두 열면 사용에 대해 먼저 묻고, 아무도 취소하지 않으면 다음으로 겨눠진 사람들에게 묻고, 둘 다 답한 뒤 해결합니다. 명중은 각 굴림이 명중할 때마다, 다침은 행동 전체가 끝난 뒤 묻습니다.

어떤 계기로 열렸든 창은 다음과 같이 동작합니다.

- **열려 있는 동안 다른 것은 움직이지 않습니다.** 현재 턴의 행동자도, 턴 종료도, 다른 창도 진행하지 않습니다. 전투는 기다립니다. 낙하는 그것을 일으킨 행동 단계가 끝나는 동안 착지를 보류하며, 이후의 낙하는 그 뒤에 묻습니다.
- **턴 순서로 한 명씩 묻고, 각자 한 번만 묻습니다.** 넘기기는 언제나 유효한 답이며 비용이 없습니다. 질문 대상에게 할 수 있는 것이 없으면 묻는 대신 건너뜁니다.
- **멈춘 곳에서 정확히 재개합니다.** 걷기는 남은 칸을 마저 이동하며 실제로 지난 모든 칸의 비용을 지불합니다.
- **조종하는 사람이 답합니다.** 자신의 파티원 창은 직접 답하며 메뉴에 선택지와 Pass가 나란히 있습니다. 상대는 조종자가 답하고, Game Master가 맡은 보스는 Game Master를 통해 질문받으며 기회를 흘려보내는 것도 답으로 제공됩니다.
- **전투와 함께 저장합니다.** 걷는 중 닫힌 게임은 같은 사람에게 질문이 남고 같은 칸을 더 걸어야 하는 상태로 돌아옵니다.

처음 두 가지에는 추가 선언이 필요 없습니다. `opportunity.budget`이 있는 규칙 집합은 하나를, `signaturePoints`가 있는 생물 도감은 다른 하나를 얻습니다. 둘 다 없는 규칙 집합은 보지 못합니다.

**항목이 기다릴 순간 지정하기.** `mechanics.reaction`을 `true` 대신 객체로 작성하세요.

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on`은 `used`, `aimed`, `hit`, `harmed`, `falls`, `turn-start` 중 하나이며, 항목을 그 창의 메뉴에 올립니다. Engine이 지켜보는 순간은 이 여섯뿐입니다. 여전히 `"reaction": true`만 쓰는 항목은 턴에 실행하지 않는다는 뜻만 전합니다. 어디에 제공할지 알기에는 부족하므로 어느 메뉴에도 나오지 않습니다.
- `at`은 `source`(기본값), `target`, `chosen` 중 하나입니다. `source`는 그 순간을 일으킨 이에게 실행 내용을 겨누고 표적을 채워 넣으므로 누구에게도 선택을 묻지 않습니다. `chosen`은 항목 자체의 표적 설정을 유지하고 묻습니다. `target`은 그 순간이 다루는 생물을 겨눕니다. `falls` 응답은 고른 낙하자들에게 적용됩니다.
- `cancels`는 창이 보류하던 일이 아예 일어나지 않게 합니다. 이미 일어난 순간은 취소할 수 없고 명중은 이미 굴린 것이므로 `used`나 `aimed` 항목만 지정할 수 있습니다.
- `against`는 항목이 응답하는 대상을 특정 카탈로그에서 사용한 것으로 좁힙니다. `"against": { "catalogs": ["spells"] }`는 주문에만 응답합니다. 뒤에 항목이 없는 행동(목록의 무기, 생물 자체 행동)은 어느 카탈로그에서도 오지 않으므로 카탈로그를 지정한 항목에 대해서는 순간을 열지 않습니다. `against`를 생략하면 무엇에든 응답합니다.

`budget`도 지정하세요. 없으면 목록의 기본값을 씁니다. 반응은 거의 항상 자체 예산을 소모하며, 이것이 한 턴에 여러 번 사용하는 것을 막습니다.

**비용은 누구에게든 묻기 전에 이미 지불합니다.** 취소된 행동은 발생만 중단되며 구매했던 사실까지 없어지지는 않습니다. 예산과 풀은 이미 소모되었습니다. 시스템이 이를 환급하더라도 아직 표현할 수 없습니다.

대응 수단은 다음과 같이 작성하며, 보드에서는 자체 `range` 안에 있는 사람에게만 응답합니다.

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**지불한 만큼만 닿는 대응 수단**(Capability API 1.116). 취소하는 `used` 반응의 `"upTo": "paid"`는 응답 자체보다 높지 않게 지불한 것만 멈추며, `"above": { "check": <value>, "dc": 10 }`은 그래도 더 높은 것을 멈추는 판정으로, `dc`에 그 레벨을 더한 값을 상대로 합니다. 슬롯 레벨 이하의 주문을 멈추고 그보다 높으면 10 + 주문 레벨에 대한 주문 시전 능력치 판정을 요구하며 다른 주문처럼 상위 시전하는 5e의 Counterspell은 다음과 같습니다.

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

지불한 것의 레벨은 그것이 나온 풀의 레벨입니다. 풀이 레벨을 지정하면 풀 자체의 `level`(보유자 시트에서 읽는 값. 워락의 슬롯 레벨로 시전하는 5e의 계약 슬롯), 아니면 그룹 안의 위치이며 첫 풀이 1입니다. 비용이 없었거나 그룹이 없는 풀에서 나온 것은 레벨 0이므로 그런 대응 수단은 모두 이를 멈춥니다. 판정은 판정에 대한 응답자의 상태를 적용한 전투 자체 주사위입니다. `dice-pool` 전투에는 도달할 DC가 없으므로 `above`를 거부합니다. 시트가 없는 생물은 판정을 `{ "const": n }`으로 씁니다. 응답이 자신보다 높은 것에 닿을 때마다 로그에 레벨과 굴림이 나오며, 멈추면 평소의 줄이 이어집니다. `above`가 없으면 더 높은 것은 그냥 멈추지 않으며, 응답의 비용은 여전히 소모됩니다.

**명중 직후의 순간.** `hit`에 대한 항목으로 Shield, Parry, Uncanny Dodge를 표현합니다. 공격은 굴림 뒤 보류되고, 피해를 주기 전에 명중당한 사람에게 묻습니다. 그 사람이 취한 것은 그 공격에 적용됩니다. 굴림을 다시 하지 않고 현재 방어에 대해 다시 확인하므로 방어를 더하는 상태는 명중을 빗나감으로 바꿀 수 있으며, 항상 명중하는 자연 눈은 여전히 명중합니다. 응답으로 건, 공격 하나 동안 유지되는 상태(`endsAfter: "attacked"`)는 피해를 포함해 이번 공격에 적용되고 그 공격으로 소모됩니다. "그 공격의 피해 절반"을 표현하는 방법이 이것으로, 공격 하나에 대한 `resist-all`입니다.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

공격은 보류된 곳에서 정확히 재개합니다. 나머지 대상과, 다른 행동으로 이루어진 생물 행동이면 나머지 부분입니다. 그런 응답을 가진 사람에게 명중하는 각 굴림은 차례로 보류되며, 창이 열린 동안 저장한 전투도 같은 방식으로 돌아옵니다. 창 안에서 한 공격(걸어 나가는 상대에 대한 타격, 고유 행동, 응답)은 보류되지 않습니다. 창 안에서 열린 것은 다른 창을 열지 않기 때문입니다. 로그는 창이 열릴 때 굴림과 그 굴림이 상대한 값을 보여 주고, 응답이 방어를 바꿨다면 이제 빗나가는지도 보여 줍니다. Engine이 조종하는 상대는 명중을 빗나감으로 바꿀 때만 방어 수단을 씁니다.

순간을 지정하는 패키지는 Capability API 1.33, `used`나 `against`를 쓰는 패키지는 1.44가 필요합니다. `hit`을 기다리는 패키지는 1.46이 필요합니다.

**주문 하나를 이름으로 응답하기**(Capability API 1.117). `against`는 `catalogs` 옆에 `<catalog>/<entry>` 형태의 `entries`를 지정할 수 있으며, 둘 중 하나라도 일치하면 순간이 열립니다. `also`는 같은 응답을 최대 세 개의 다른 순간에 각자 자체 `against`와 함께 받습니다. 상태의 `noDamageFrom`은 상태가 유지되는 동안 피해 종류와 관계없이 그 항목들의 피해를 보유자에게서 완전히 막습니다. 5e의 Shield는 공격이 명중할 때와 Magic Missile이 시전자를 겨눌 때 쓰며, 그 아래에서 Magic Missile은 아무 효과가 없습니다.

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

첫 순간만 취소할 수 있으므로 취소하는 반응에는 `also`가 없습니다. 항목이 지정한 카탈로그는 규칙 집합에 있는 것이어야 합니다. 그 안에 없는 항목은 그냥 순간을 열지 않습니다. 이렇게 막은 타격은 로그에 대상이 면역인 타격으로 나옵니다.

**일부 타격에만 응답하기**(Capability API 1.118). `hit` 순간은 `"blow": "melee"`나 `"blow": "ranged"`라고 할 수 있습니다. 대상이 무기의 근접 거리 안에 서 있는 동안 타격은 근접이므로, 멀리서 던진 단검은 원거리이고 대상 옆에서 쓴 같은 단검은 근접입니다. 근접 거리만 있고 사거리가 없는 무기는 항상 근접이며, 사거리만 있고 근접 거리가 없는 무기는 항상 원거리입니다. 보드가 없는 전투에서는 근접 거리가 있는 무기를 손에 들고 휘두르는 것으로 봅니다. `falls`를 뺀 모든 순간의 `"seesSource": true`는 보유자가 그것을 일으킨 사람을 보는 동안만 순간을 엽니다. 보드에서 둘 사이에 시선이 있다는 뜻이며(보드가 없으면 모두가 모두를 봄), Hide 표준 행동을 한 사람은 그 효과가 다음 턴 시작에 사라질 때까지 결코 보이지 않습니다. 5e의 Parry는 둘 다입니다.

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

두 키는 `also`의 순간에도 쓸 수 있으며, `blow`는 `hit` 순간에만 씁니다.

**낙하 받아 내기**(Capability API 1.124). `also`를 포함해 `falls`에 대한 반응은 낙하가 피해를 주거나 넘어뜨리기 전에, 턱에서 떨어지는 생물이나 지면으로 떨어지게 된 비행자에 응답합니다. 사거리와 대상 편은 낙하자를 기준으로 검사하며, 응답은 그 생물에게 적용됩니다. Feather Fall이라면 항목에 다음 mechanics를 주고 시트의 실시간 상태에 `feather_falling`을 선언하세요.

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

그 `combat.conditions` 항목은 `{ "condition": "feather_falling", "fallsSafely": true }`입니다. 이 상태는 유지되는 동안 낙하 피해와 낙하가 걸 넘어짐 상태를 막지만, 낙하를 일으킨 상태를 없애지는 않습니다. 시전자 자신의 낙하에만 응답하려면 `targets: "self"`를 쓰세요. 낙하에는 원본 항목이 없으므로 그 반응은 `cancels`, `blow`, `seesSource`, `against`를 가질 수 없습니다. 단일 대상 항목은 각 낙하마다 따로 묻습니다. 이것은 착지를 해결할 뿐 느려진 하강을 추적하지는 않습니다.

**다른 생물을 위해 응답하기**(Capability API 1.131). `for`의 기본값은 `self`입니다. `ally`는 보유자를 빼고, `any`는 보유자를 포함합니다. 둘 다 카탈로그 거리 단위로 필요한 `within` 안에 있는 대상 편의 보유자에게 묻으며, `aimed`나 `hit`에서만 묻습니다. 이 키들은 각 `also` 순간에서도 작동합니다. `seesSource`는 여전히 공격자를 볼 것을 요구합니다. Protection은 공격 주사위를 굴리기 전에 출처에 `own-attacks-disadvantage`를 겁니다. 그 `this-action` 지속 시간은 행동이 해결되거나 취소되면 끝납니다. 명시적인 출처 사거리가 없으면 곁에 있는 이의 응답은 그 출처에 닿으며, `within`은 보호받는 생물까지의 거리를 잽니다. 시트에 `protected_attack`을 선언하고 그 전투 상태에 그 효과를 주세요.

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**응답을 대상에게 걸기.** `at: "target"`은 공격받은 생물에게 적용되며, `source`는 여전히 공격자입니다. Shield Guardian은 아뮬렛 착용자를 5 이내의 아군으로 표현하며, `parrying`은 방어 `+2`를 줍니다. 보류된 명중은 응답 뒤 그 아군의 방어를 다시 확인합니다.

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**턴 시작 시.** `on: "turn-start"`는 항목의 대상 편 생물이 그 사거리 안에서 턴을 시작할 때, 그 생물이 행동하기 전에 묻습니다. 그 생물이 `source`입니다. 해로운 항목은 반대편에, 도움이 되는 항목은 자기 편에 응답합니다. `cancels`, `blow`, `against`, `upTo`를 가질 수 없습니다. Unnerving Mask 생물 행동은 Wisdom 내성을 요구합니다. 영향을 받은 생물의 시계로 1라운드는 이번 턴 내내 유지되고 턴이 끝날 때 만료됩니다(`of: "source"`는 생략).

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**내성으로 취소하기.** `cancelSave: { save, dc }`에는 `cancels`가 필요하며, 보유자는 평소의 내성 수정치로 굴립니다. 성공하면 취소하고, 실패하면 원래 행동이 해결되며, 어느 쪽이든 반응을 씁니다. `against.actions`는 능력치 블록 행동 1~12개를 지정하며, 전체 이름을 대소문자 구분 없이 비교합니다(각각 최대 80자). Rock Catching은 타격 피해만이 아니라 모든 피해를 포함해 공격 전체를 취소하는 것으로 바위 받기를 표현합니다. 내성 ID는 규칙 집합의 것입니다(여기서는 `dex`, 함께 제공되는 5e 예제에서는 `dex_save`).

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**여러 낙하자 받아 내기.** `targetCount`가 1보다 큰 `falls` 항목은 한 타격이나 효과로 떨어지는, 사거리 안과 대상 편에 있는 자격 있는 생물들을 제공합니다. 메뉴와 디렉터는 기본적으로 가장 가까운 것부터 개수까지 자격 있는 모두를 고르며, 플레이어는 선택을 바꿀 수 있습니다. 나중의 낙하는 별도 사건입니다. Feather Fall은 위와 같은 `fallsSafely` 상태를 씁니다.

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### 아직 지원하지 않는 것

규칙 집합이 Engine이 하지 못하는 일을 주장하지 않도록 명확히 적습니다.

- **단순한 보드를 넘어서는 것:** 장애물 위 비행, 좁은 틈 통과, 탈것이 없습니다. 생물은 자신의 걷기, 순간이동, 그리고 밀어내는 것(겨루기, 항목, 생물 행동, 영역)으로만 움직입니다. 붙잡은 생물을 끌고 다닐 수 없습니다.
- **겨루기는 단순합니다.** 겨루기 굴림은 창을 열지 않지만, 겨루기가 일으킨 낙하에는 응답할 수 있습니다.
- **항목이 기다릴 수 있는 순간은 `used`, `aimed`, `hit`, `harmed`, `falls`, `turn-start` 여섯 가지뿐입니다**(위 '창' 참고). Engine이 항목을 위해 감지하는 순간입니다. 다른 두 창, 즉 누군가 벗어나는 순간과 두 턴 사이의 멈춤은 전투 자체가 열며 항목이 요청할 순간이 아닙니다. 내성을 굴릴 때나 죽음을 위한 순간은 없습니다.
- **연쇄하지 않습니다.** 전투는 창을 스택이 아닌 하나만 유지하므로 창 안에서 생긴 것은 다른 창을 열지 않습니다. 대응 자체에 다시 대응할 수 없고, 반응이 가하는 효과도 추가 순간을 열지 않으며, 창 안에서 한 공격은 명중해도 보류되지 않습니다. 창 도중에 일어난 응답 가능한 낙하는 창이 닫힐 때까지 보류되었다가 차례로 묻습니다.
- **공격 굴림만 명중입니다.** 굴림 없이 닿는 것(그냥 명중하는 다트, 모두가 내성을 굴리는 범위)은 `hit` 순간을 열지 않습니다.
- **피해 수정치는 공격 명중에 속합니다.** 응답은 보유자에게 피해 수정치를 걸거나 `resist-all`로 들어오는 피해를 절반으로 만들 수 있습니다. 피해 수정치는 내성만 있는 효과를 바꾸지 않습니다.
- **아무것도 환급하지 않습니다.** 취소된 행동의 비용은 소모된 상태입니다.
- **상태가 바꾸는 것은 고정 목록입니다.** 방어, 공격 굴림, 내성, 겨루기 판정, 속도, 체력 최대치, 주는 피해, 받는 피해입니다(단계와 아이템 효과도 마찬가지). 피해 수정치는 공격 명중만 바꾸며, 내성 기반 피해나 자동 명중에는 더하지 않습니다.
- **직접 수치로 쓴 생물은 부상 트랙이 없습니다.** 체력이 트랙인 규칙 집합에서도 그런 생물은 점수를 잃습니다. `sheet`를 주면 받는 타격이 자체 `resist`, `vulnerable`, `immune`로 먼저 완화된 뒤 칸에 표시됩니다.
- **부가 효과는 자동 발동합니다.** `on`의 값은 `hit` 하나이므로 기간의 첫 조건 충족 명중이 효과를 사용합니다. 소모할지 질문받는 순간은 없습니다.
- **공격이 움직이는 수치는 단순합니다.** 소비 타격은 수치만 던지고 그 밖에는 아무것도 던지지 않으므로, `floor`를 포함해 어떤 무기도 이를 바꾸지 않습니다(튼튼한 대상은 빼앗는 타격을 흡수하고 경도는 소비 타격을 막지만, 그 밖에 어느 쪽을 줄이는 것은 없습니다). 붕괴는 얼마나 깊었든 정해진 턴 수 뒤에 해제되며, 창 안에서 한 공격(벗어나는 상대에 대한 타격, 반응, 고유 동작)은 첫 방식으로 합니다.
- **창작한 상대는 흡수하지 않고 경도도 없습니다.** Game Master가 한 전투를 위해 만든 생물은 위협 척도에 맞춰 제한되는데, 위협 척도는 흡수나 경도를 정하지 않으므로 둘 다 없습니다.

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
- `currencies`는 동전을 제외합니다. `removeUnits`는 개별 동전을, `removeFamilies`는 계열 전체를 지정합니다. 계열의 가장 작은 동전은 계열과 함께만 제외할 수 있으므로 남은 모든 계열은 여전히 지불하고 거스름돈을 줄 수 있습니다. 레이어가 켜져 있는 동안 아무도 제외된 동전을 벌거나, 지불하거나, 고르거나, 떨어뜨리지 않으며 지갑 줄에도 나오지 않습니다. 그 동전으로 적힌 가격은 같은 가치로 정확히 지불할 수 있는 남은 동전 중 가장 큰 것으로 표시합니다. Gravewatch의 The long night 레이어는 크라운을 제외하므로 3크라운짜리 경비 권총은 15실링입니다. 계열 전체가 사라진 아이템은 가격이 없습니다.

**레이어가 할 수 없는 것.** 열거형 값, 필드, 기술, 풀, 휴식을 추가하거나, 해결 유형을 바꾸거나, 실시간 상태나 전투 수치를 건드리거나, 모델 호출을 추가할 수 없습니다. 레이어가 _추가한_ 값은 시트를 읽는 다른 모든 쪽에 알 수 없는 값이 되므로 값은 제외만 합니다. 이 목록을 넘는 것은 규칙 집합 자체의 변경이거나 두 번째 규칙 집합입니다.

**충돌.** `conflicts`는 함께 켤 수 없는 레이어를 지정합니다. 쌍의 한쪽에만 지정하면 충분합니다. 마법사는 상대 토글을 비활성화합니다. 저장된 선택에 어떻게든 둘 다 있으면 **나중에** 선언된 쪽을 버리므로, 같은 두 선택은 항상 같은 규칙을 만듭니다.

**제외된 값을 이미 가진 시트는 그대로 보존합니다.** 캐릭터를 다시 쓰는 일은 없습니다. 편집기가 값을 더는 제공하지 않을 뿐, 이미 가진 캐릭터는 원래 값을 표시합니다. 새 게임에서 레이어를 끄면 다시 제공됩니다. 숨겨진 카탈로그 항목도 같습니다. 선택기에서만 제외되며, 플레이어가 이미 고른 행은 시트에 남습니다. 레이어가 제외한 동전을 누군가 이미 지니고 있다면 그 동전은 가방에 남습니다.

**제한.** 규칙 집합당 레이어 12개이며, 레이어마다 두 문자열을 합해 지침 4000자까지입니다. `layers` 또는 기본 `gm.worldGuidance`를 선언한 패키지 규칙 집합은 Capability API 1.25가 필요하고, 레이어가 동전을 제외하는 규칙 집합은 1.64가 필요합니다. 가져온 규칙 집합은 읽는 Engine이 검증하므로 이 선언이 필요 없습니다.

**다른 사람이 작성한 레이어**(직접 쓰지 않은 규칙 집합의 Low Magic 레이어를 별도 파일로 배포하는 것)는 나중에 추가할 기능입니다. 현재 레이어는 자신이 속한 규칙 집합 안에 포함되어 배포됩니다.

<a id="trying-your-ruleset"></a>

## 규칙 집합 시험하기

커뮤니티 규칙 집합은 가져온 에이전트와 같은 스위치를 씁니다. **Settings**(설정) > **Advanced**(고급) > **Danger Zone**(위험 구역)을 열고 **Allow custom Agent imports**(사용자 지정 에이전트 가져오기 허용)가 켜졌는지 확인하세요. 가져오기에는 localhost 접근 또는 설정된 **Admin Access**(관리자 접근)도 필요합니다.

1. **Agents**(에이전트) 패널을 열고 **Import agents**(에이전트 가져오기) 버튼(패널 위쪽 버튼 줄의 다운로드 아이콘)을 고르세요.
2. **Game Mode ruleset**(Game Mode 규칙 집합)을 선택하고 JSON 파일, 또는 `.ruleset.json`으로 끝나는 규칙 집합 패키지 파일을 고르세요([규칙 집합 공유하기](#sharing-your-ruleset) 참고).
3. 검토 내용을 읽으세요. 이름, 버전, 라이선스, 지원 범위, Game Master 텍스트가 표시됩니다. **Import**(가져오기)를 선택하세요.

규칙 집합은 패널의 **Rules**(규칙) 구역과 새 게임 설정 마법사의 **Rules** 선택지에 나타납니다. 파일에서 가져온 규칙 집합은 `local/<your id>`로 분류하므로 공식 규칙 집합이나 다른 사람의 것과 혼동할 수 없습니다.

### 이미 가져온 규칙 집합 변경하기

가져온 버전은 다시 쓰지 않습니다. 파일을 바꾸고 같은 `version`으로 다시 가져오면 거부하고 번호를 올리라고 요청합니다. 의도된 동작입니다. 게임은 생성 당시의 정확한 버전에 묶이므로 진행 중인 캠페인이 갑자기 다른 계산 방식으로 바뀌지 않습니다.

따라서 초안 작성 중에는 편집, `version` 올리기, 가져오기, 새 게임 시작을 반복합니다. **Rules** 구역에서 규칙 집합을 제거하기 전까지 이전 버전은 새 버전 옆에 계속 설치되어 있습니다. 게임이 아직 사용하는 규칙 집합을 제거하면 다시 가져올 때까지 해당 게임에 규칙 집합이 없다고 표시됩니다.

시트의 모양을 바꿨다면(항목 추가, 제거, 이름 변경) `sheet.version`도 올리세요. 기존 시트는 관대하게 읽습니다. 새 시트가 모르는 값은 보존하고, 없는 값은 기본값을 사용합니다.

### 값을 새 ID로 옮기기: `sheet.migrations`

추가에는 더 필요한 것이 없습니다. 새 레이아웃이 값을 다른 곳으로 옮길 때(이름이 바뀐 필드, 클래스별 레벨이 된 레벨 하나, 주사위별 풀이 된 히트 다이스 풀 하나) `sheet.migrations`(Capability API 1.77)에 방법을 적으세요. 그러면 이전 레이아웃으로 만든 모든 캐릭터가 라이브러리, 게임, 이전 저장, 분기와 체크포인트, 가져온 카드에서 숫자를 유지합니다.

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- 각 항목은 저장된 시트를 버전 `from`에서 `from + 1`로 옮기며, 그 버전 이하로 저장된 모든 시트에 대해 순서대로 실행합니다. 한 번 배포한 항목은 절대 지우지 마세요. 오래전에 저장된 시트에는 여전히 필요합니다. 추가만 하는 버전에는 항목이 필요 없습니다.
- `rename`(`ability`, `skill`, `save`, `field`): 값을 새 ID로 복사합니다. 기술이나 내성은 보너스도 함께 가져갑니다. rename은 앞 항목의 rename을 이어 가거나, 나중의 `route`가 보낼 필드에 값을 줄 수 있으며, 가져오기는 그 연결을 끝까지 따라갑니다.
- `route`: 한 필드의 값이 다른 필드의 텍스트가 지정하는 필드로 갑니다. 케이스의 단어가 대소문자 구분 없이 `by`의 텍스트에 온전한 단어로 나타나고(글자만 단어를 이루므로 "Fighter3"은 fighter를 지정함) 정확히 한 케이스만 그럴 때 그 케이스가 이깁니다. 하나도 없거나 여럿이면("Fighter 3 / Wizard 2"처럼 묻지 않고는 숫자 하나를 나눌 수 없음) `else`로 갑니다. `default`는 그 값을 저장한 적이 없는 시트를 대신합니다. `by`는 시트에 있는 필드이거나 이전 레이아웃이 이름을 바꿔 옮긴 필드입니다. 대상은 기본값이 없거나 기본값이 0 또는 빈 값인 숫자나 텍스트 필드입니다. 값은 그중 하나에 들어가고 나머지는 모두 기본값을 유지하므로, 다른 기본값은 아무도 준 적 없는 레벨로 읽힐 것이기 때문입니다. 나중의 rename이 옮기는 대상은 그곳까지 따라갑니다.
- `routeLive`(실시간 상태의 `pool` 또는 `track`): 저장된 값은 마이그레이션한 시트가 보여 주는 `cases` 중 하나(최대치가 0보다 큰 풀, 시트가 숨기지 않는 트랙)로, 없으면 `else`로 갑니다. 값이 가는 트랙은 모두 부상 트랙(표시를 옮김)이거나 모두 일반 트랙(숫자를 옮김)이어야 합니다.
- 빌드 값을 옮기는 모든 단계는 복사합니다. 이전 값은 그 자리에 남으므로 규칙 집합의 이전 버전도 시트를 이전처럼 읽습니다. 단계는 대상에 이미 있는 값을 덮어쓰지 않습니다.
- 가져오기는 `sheet.version` 이상인 항목, 같은 버전에서 출발하는 두 항목, 시트에 없는 ID에 쓰는 단계, 두 번 나열한 케이스, 시트에 아직 있는 ID에서 읽는 `rename`이나 `routeLive`를 거부합니다(옮겨진 ID는 다시 쓰이지 않으며, 그래서 이 단계들은 다시 실행해도 안전합니다).
- 시트는 읽을 때마다 마이그레이션하며 새 레이아웃은 다음 편집 때 저장합니다. 실시간 상태에는 자체 버전이 없으므로 `routeLive`는 읽을 때마다 실행됩니다. 이전 키는 버리고, 새 키가 아직 없는 동안에만 값을 옮기므로 그 뒤 쓰거나 휴식으로 바뀐 값은 덮어쓰지 않습니다. 값이 간 곳은 업데이트 뒤 첫 쓰기로 정해지므로, 나중에 고친 시트(직접 옮긴 클래스 레벨)에서는 다시 옮기지 않습니다. 새 버전이 도착할 때 이미 진행 중인 전투는 이전처럼 끝까지 진행됩니다.

<a id="sharing-your-ruleset"></a>

## 규칙 집합 공유하기

**파일로.** JSON 파일을 친구에게 보내세요. 같은 방식으로 가져오면 됩니다.

**패키지 파일로.** 카탈로그를 별도 파일에 둔, 파일 하나에 담기에는 너무 큰 규칙 집합은 `<name>.ruleset.json`이라는 단순 JSON 파일 하나로 전달합니다. 패키지 매니페스트와 규칙 집합의 문서들을 담으며, 각 문서는 정확한 바이트를 base64로 담습니다.

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

매니페스트는 `ruleset.json`과 각 `catalogs/<id>.json`을 `contributions.assets.paths`와 `files`에 각각의 크기, sha256과 함께 나열합니다. Pixelforge 같은 규칙 집합 편집기가 이를 만듭니다. **Import agents** → **Game Mode ruleset**은 이 파일을 받아 규칙 집합 파일과 같은 검토를 보여 주며, 각 카탈로그와 그 항목 수도 표시합니다. 압축된 것이 없으므로 자체 크기 이상을 담지 않습니다. 데이터로 읽을 뿐 패키지로 설치하지 않습니다. 다른 것(다른 키, 다른 파일, 엄격한 base64나 UTF-8 텍스트가 아닌 문서)을 담거나, 매니페스트가 규칙 집합 이상의 것(코드, 권한, 다른 기여)을 담거나, 파일이 매니페스트가 나열한 것과 다르거나, `$comment`가 2,000자보다 길거나 `$schema`가 Engine 자체 스키마가 아닌 것을 지정하거나, 규칙 집합이나 카탈로그를 읽을 수 없으면 이유와 함께 거부합니다. 규칙 집합 파일처럼 `local/<its id>`로 분류하며, 최대 24 MB이고 카탈로그 파일은 각 2 MB씩 최대 12개입니다. 버전은 규칙 집합과 카탈로그를 합친 것이므로 카탈로그를 바꿔도 더 높은 `version`이 필요합니다. 규칙 집합 패키지는 zip으로 받지 않습니다.

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
