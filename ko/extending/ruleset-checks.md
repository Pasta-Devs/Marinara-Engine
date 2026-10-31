# 규칙 집합 판정

이 페이지는 [Game Mode 규칙 집합 작성하기](writing-rulesets.md)의 일부입니다. 규칙 집합의 판정 또는 내성 굴림 방식인 다섯 가지 판정 종류, 결과 구간, 자체 방식으로 굴리는 판정, 굴림을 바꾸는 자원 소비나 부적을 설명합니다.

<a id="resolution-kinds"></a>

## 판정 종류

`resolution.kind`가 판정 굴림을 선택합니다. 모든 종류는 같은 캐릭터 시트를 읽고 세 키를 공유하므로 바꿔도 `resolution` 아래 파일 부분은 달라지지 않습니다.

- `abilityModifier`: 시트 점수를 숫자로 바꾸는 방식입니다. `identity`는 점수 자체, `floorHalfMinusTen`은 5e 규칙, `stepTable`은 `[[score, number], ...]`로 직접 나열한 경계값입니다.
- `proficiencyTiers`: 기술이나 내성의 훈련 단계입니다. 목록에 없는 기술은 첫 단계를 사용합니다. 단계는 `flat`, 숙련 보너스의 `multiplier`배 또는 둘 다를 더합니다. 숙련 보너스가 있는 시스템은 `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`로 출처를 지정하세요.
- `proficiency`: 선택 사항이며 곱셈을 하는 단계에만 필요합니다.

계산한 숫자의 의미는 종류가 정합니다. `dice-sum`은 굴림에 더하고 `dice-pool`과 `dice-highest`는 그만큼의 주사위를 던집니다. `symbol-pool`은 서술형 주사위를 구성하고 승급하기 위해 능력치와 훈련을 따로 유지합니다.

### `dice-sum`: 주사위 합산

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

### `dice-pool`: 던져서 성공 개수 세기

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

### 풀 판정에서 Game Master가 쓸 수 있는 내용

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

### `dice-highest`: 주사위를 던져 가장 높은 눈 읽기

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

### `roll-against`: 시트 숫자 이하(또는 이상)로 굴리기

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

### `symbol-pool`: 서술형 주사위를 던져 기호 읽기

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
- `pool`: `larger-upgraded`(기본값)는 능력치와 등급 중 큰 쪽만큼 던지고, `upgrade`를 선언했으면 작은 쪽 숫자만큼 승급합니다. `sum`은 둘을 더하고 승급하지 않습니다. `max`의 기본값은 6이고 12를 넘을 수 없습니다. 능력치는 `abilityModifier`를 쓰므로 Genesys 특성에는 `identity`를 쓰세요. 등급은 기술이나 내성의 숙련 단계에서 오며, 순수 능력치 판정의 등급은 영입니다. `with=`는 다른 판정처럼 특성을 바꿉니다. 시트 보너스, 부상, 조정, 효과는 아래의 부호 있는 보너스로 증강 주사위나 차질 주사위를 더합니다.
- `difficulty`: `dc=`는 반대 주사위를 0부터 `max`(기본값 5, 상한 12)까지 셉니다. `difficulty=`는 대신 사다리 단계를 지정합니다. `upgrade="N"`은 반대 주사위 그만큼을 승급 주사위로 바꾸며, 실제로 던진 수로 제한합니다. 난이도를 넘어 주사위를 더하지는 않습니다.
- `boost`와 `setback`: 각각 `bonus="+N"`과 `bonus="-N"`으로 더하는 선택적 주사위이며, 각 `max`(기본값 3, 상한 6)까지입니다. 부호 있는 조정은 이 제한을 적용하기 전에 합칩니다. Capability API **1.150**은 `setback="N"`도 따로 받습니다. `bonus="2" setback="1"`은 양쪽을 모두 던집니다. 음수 보너스는 `setback`에 더해지며, 합친 차질 주사위 수는 `setback.max`로 제한합니다. 증강 주사위는 `boost.max` 안에 머뭅니다.
- `allowOwnUpgrade`: 선택 사항이며 없으면 false입니다. `true`이면 `upgradeOwn="N"`이 시트 승급과 구매한 주사위 다음에 캐릭터 주사위 N개를 더 `pool.upgrade`(선언 필수)로 승급합니다. 기존 주사위가 모두 승급되었으면 추가 승급마다 승급된 주사위 하나를 더하며, 여전히 `pool.max`로 제한합니다. `pool.build: "sum"`에서도 작동합니다. 이 키를 `false`로라도 선언하려면 capabilityApi **1.150**이 필요합니다. 속성 이름은 `zeroDice`처럼 카멜 표기를 씁니다. `upgradeOwn`은 굴리는 쪽에 작용하고 `upgrade`는 여전히 난이도 주사위에만 작용합니다. `setback`과 `upgradeOwn`은 모두 음이 아닌 정수를 받으며 기호 풀 밖에서는 무시합니다. `upgradeOwn`은 켜지 않으면 무시합니다.
- `success`: 상쇄 후 그 기호가 이만큼 필요하며 기본값은 하나입니다. 대성공과 대실패 표시는 이름 붙은 기호가 나타나면, 그것이 더한 성공이나 실패가 상쇄되더라도 붙습니다. 두 표시가 함께 나타날 수 있으며, 어느 쪽도 순 성공이 판정을 통과했는지를 바꾸지 않습니다.
- `outcomes`는 순 성공 수(`total`)나 `net successes - needed + 1`(`margin`)을 읽을 수 있습니다. 구간은 여전히 평소 방식으로 성공을 정하며, 원래의 대성공·대실패 기호는 표시된 채 남습니다. `spend`는 `pool.max` 안에서 기본 캐릭터 주사위만 더 삽니다. 전투는 `symbol-pool` 전투입니다(Capability API 1.382, [기호 주사위로 던지는 전투](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool) 참고). 다른 전투 유형을 함께 지정하면 거부합니다.
- 판정 밖에서도 이 규칙 집합을 쓰는 게임은 주사위를 이름으로 굴릴 수 있습니다. 메시지 입력 바의 사용자 지정 주사위 입력란과 Game Master의 `roll_dice` 도구는 `2 ability 1 proficiency vs 2 difficulty`를 읽고(각 주사위의 `id`나 `label`, 대소문자 구분 없음), 시트, 승급, 난이도 사다리 없이 판정과 같은 방식으로 기호를 세고 상쇄합니다. 이를 켜는 키는 없습니다.
- 기록은 `resolution="sum"`을 유지하며 `symbols="2s 1a 1t"`, 각 주사위를 식별하는 `thrown=`, 1부터 센 면 번호를 담는 `rolls=`를 가집니다. 인코딩된 `symbolDetails`는 라벨, 면의 기호, 대성공·대실패 표시 둘을 보존합니다. `setback`은 공유 차질 제한 뒤 실제로 더한 별도 차질 주사위를, `upgradeOwn`은 실제로 적용한 추가 승급을 기록하며, 무시했거나 영인 추가분은 생략합니다. 카드와 요약은 면 숫자를 더하지 않고 순 기호를 표시하며 빈 결과도 표시합니다. 재정의는 이 종류의 규칙을 바꿀 수 있지만 `symbols`나 `dice`를 대체할 수는 없습니다.

### 범위 밖의 기능과 그 이유

다음 메커니즘은 여전히 자체 판정 종류가 필요합니다.

- **대항 풀**은 두 캐릭터를 함께 해결하지만 판정의 굴림 주체는 한 명입니다.
- **와일드 주사위가 있는 합산 풀**(OpenD6 등)은 주사위를 더하고 하나를 특별 취급합니다.

이 종류가 예전에 제외하던 나머지 둘은 이제 구현되었으며 아래 자원 소비로 굴림 바꾸기에서 설명합니다. "한 점을 써 성공 하나 얻기"나 "한 점을 써 실패한 주사위 다시 던지기" 같은 시스템 자체 규칙은 `resolution.spend`입니다. 상황에 따라 시스템이 무료로 허용하는 재굴림은 위의 `resolution.reroll`입니다. 캐릭터가 선택한 것에 속하는 재굴림은 카탈로그 항목의 `mechanics.check`이며 해당 항목의 비용을 지불합니다.

## 결과 구간: 성공과 실패 그 이상

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

## 자체 방식으로 굴리는 판정

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

## 자원 소비로 굴림 바꾸기

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

## 굴림을 바꾸는 부적

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
