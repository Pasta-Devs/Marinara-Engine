# 규칙 집합 전투

이 페이지는 [Game Mode 규칙 집합 작성하기](writing-rulesets.md)의 일부입니다. 규칙 집합의 전투 참여 방식을 설명합니다. Marinara 전투에 시트를 제공하는 `battle` 블록과, 도감, 보드, 반응과 겨루기를 갖추고 규칙 집합 자체 규칙으로 전투 전체를 해결하는 `combat` 블록입니다.

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

위의 `battle` 블록은 계산을 Marinara에 맡긴 채 전투에 시트 수치를 빌려줍니다. 선택적 `combat` 블록은 다릅니다. 자체 규칙이 전투를 어떻게 해결하는지 정합니다. `resolution`이 판정 유형에 매개변수를 주듯 Engine이 소유한 전투 유형에 매개변수를 주며, 그 안의 모든 이름은 작성자가 정합니다. 유형은 세 가지입니다. 주사위를 더해 숫자와 비교하는 `attack-vs-defense`, 전투가 `dice-pool` 규칙 집합 자체의 풀을 던져 성공을 세는 `dice-pool`(아래 풀로 던지는 전투 참고), 전투가 `symbol-pool` 규칙 집합의 서술형 주사위를 던져 남은 기호를 소비하는 `symbol-pool`입니다(아래 기호 주사위로 던지는 전투 참고).

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

<a id="every-key"></a>

### 모든 키

- `kind`: `"attack-vs-defense"`(한쪽이 상대의 방어를 상대로 주사위를 굴리며 명중하면 피해를 줌), `"dice-pool"`(풀로 던지는 전투 참고) 또는 `"symbol-pool"`(기호 주사위로 던지는 전투 참고)입니다. 아래 모든 키는 각 유형에서 같은 뜻이며, 그 유형이 숫자를 읽는 방식으로 읽습니다.
- `health`: 필수입니다. 전투가 깎는 대상입니다. `{ "pool": "grit" }`는 수치를 줄이는 실시간 풀이며, 임시 완충치가 있으면 피해가 그것부터 소모합니다. 또는 `{ "track": "harm" }`처럼 표시를 하는 부상 트랙입니다. 부상 트랙은 `damageKinds`를 함께 지정해야 합니다. 또는 `{ "track": "wounds" }`로 `min`부터 `max`까지 채워지는 일반 트랙(`levels`나 `boxes` 없음)을 지정합니다(Capability API 1.383). 피해는 점수를 더하고 회복은 빼며, `max`에 도달한 트랙은 풀이 0일 때처럼 전투에서 이탈합니다. Genesys의 Wounds가 그 예로, Wound Threshold를 `max`로 씁니다. 경계값을 넘어야 쓰러지는 시스템은 `max`를 그보다 하나 크게 정합니다. 일반 체력 트랙은 `startFrom`이 아닌 `default`에서 시작하며, `max`에서 시작할 수 없고 `damageKinds`를 받지 않습니다. 시트가 계산하는 `max`는 풀의 최댓값처럼 캐릭터마다 다릅니다. 어떤 트랙도 임시 점수를 주지 않습니다.
- `defense`: 필수 값 참조입니다. 플레이어가 입력하는 필드 또는 작성자가 계산하는 파생 값입니다.
- `initiative`: 필수입니다. 시작할 때 한 번 굴리는 주사위와 선택적 수정치 참조입니다. 동률이면 수정치가 더 높은 쪽, 그다음은 전투를 설정한 순서가 앞섭니다. `"each": "round"`는 새 라운드가 시작될 때마다 그때의 수정치로 모두의 우선권을 다시 던지며(따라서 부상 트랙을 읽는 수정치는 다치면 느려짐), 라운드는 새 순서의 첫 번째부터 시작합니다. Capability API 1.47. `dice-pool` 전투는 대신 풀로 던질 수 있습니다. `pool`(값 참조)은 주사위 수이며 그 성공 수에 `plus`를 더한 것이 우선권 수치이고, `dice`나 `modifier`를 함께 쓰지 않습니다. `pool`이 필요한 `resource`는 그 수치를 유지하며 공격이 이를 움직이게 합니다(아래 "공격이 움직이는 우선권" 참고). Capability API 1.48.
- `attackRoll`: `attack-vs-defense`에서는 필수이고, 해결 방식 자체의 풀을 던지는 `dice-pool`에서는 거부합니다. 주사위, 두 번 굴려 하나를 고르는지(`advantage`), 단일 주사위의 최대·최소 눈이 하는 일(`naturals.max`: `critical`, `hit`, `none`; `naturals.min`: `miss`, `none`), 치명타가 피해에 하는 일(`critical`: `double-dice`는 피해 주사위를 다시 굴림, `max-dice`는 최고 눈을 한 번 더함, `none`은 일반 명중)을 정합니다. 특별한 눈에는 판정과 마찬가지로 주사위 하나가 필요합니다. 전투 안의 내성 굴림도 같은 주사위를 굴립니다. `criticalFrom`은 치명타 눈을 넓힙니다. 공격자 시트에서 읽는 값으로, 치명타로 세는 가장 낮은 자연 눈입니다. 시트에 19라고 적힌 5e Champion이라면 `{ "field": "critical_from" }`입니다. 주사위의 최고 눈으로 제한하며, 2 미만은 범위가 전혀 없다는 뜻이고(필드를 0으로 둔 캐릭터처럼 최고 눈만), 단일 주사위와 `critical`로 설정한 `naturals.max`가 필요합니다. Capability API 1.81.
- `economy`: 필수입니다. `budgets`는 한 턴에 가질 수 있는 행동 예산으로 ID, 라벨, `per`(`turn`은 보유자 자신의 턴 시작 시, `round`는 새 라운드 시작 시 보충), `count`를 갖습니다. 처음 선언한 예산이 주 예산이며 표준 행동이 이를 소모합니다. `movement`는 선택적 값 참조로, 자체 거리 단위로 한 턴에 걸을 수 있는 거리입니다. 보드 위 전투에서 읽습니다('위치' 참고).
- `attacks`: 선택 사항입니다. 행이 무기가 되는 시트 목록입니다. `name`은 행 이름을 정하는 텍스트 열, `damage.dice`는 주사위 열이며, `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus`, `damage.type`은 각각 같은 목록의 열을 지정합니다. `ability` 열은 자체 능력치 ID 중 하나를 담는 `enum`이며 그 밖의 값은 아무것도 더하지 않습니다. `proficiency` 열은 `boolean`이며 참일 때 숙련 보너스를 더합니다. 읽을 수 있는 주사위가 없는 행은 공격이 아니므로 같은 목록의 밧줄은 그냥 밧줄입니다. `toHit.skill`은 기술 ID 하나를 담는 `enum` 열을 지정합니다. 행은 그 기술 판정이 더하는 값을 더하며, 행 자체의 `ability`가 능력치를 지정하면 판정의 `with=`가 바꾸는 것과 똑같이 기술의 능력치 대신 그것을 씁니다(Capability API 1.47). `abilityChoices`는 행의 능력치 열에 있는 값을 자체 능력치 ID 둘 이상에 대응시킵니다(Capability API 1.793). 이를 읽는 행은 명중에 가장 많이 더하는 능력치로 공격하고, 같은 능력치로 피해를 줍니다. SRD 5.1의 Finesse를 표현하려고 마련한 것으로, 열의 값에 `finesse`를 포함하고 `{ "finesse": ["str", "dex"] }`로 작성합니다. 그 값 자체가 능력치이거나, 시트에 없는 능력치를 지정하거나, 능력치 열에서 제공하는 값이 아니면 거부합니다. `toHit.sheetBonus`(Capability API 1.800)는 시트에서 읽은 숫자를 명중에 더합니다. `value`는 어떤 값 참조든 가능하며, `when: { "column": ..., "equals": ... }`는 해당 열에 그 값이 있는 행에만 적용하도록 제한합니다. SRD 5.1의 Archery는 "원거리 무기로 하는 공격 굴림에 +2 보너스"를 주며, `reach` 값0인 행에서 특성 열의 `listSum`을 읽으므로 투척하는 단검에는 보너스가 없습니다. `strikes`는 이 목록의 예산을 한 번 쓸 때 얻는 타격 횟수를 정하는 선택적 값 참조입니다. 보유한 타격이 없을 때 행을 선택하면 예산을 쓰고 남은 타격을 손에 넣습니다. 하나라도 보유하는 동안 `strikes`를 선언한 모든 행은 예산을 전혀 쓰지 않으므로, 다른 무기와 표적을 고르고 사이에 걷는 행동이 메뉴에서 자연스럽게 가능합니다. `strikesCappedBy`는 목록이 몇 번의 타격을 주든 해당 행 자체를 한 번으로 제한하는 불리언 열입니다. 사용자 횟수와 관계없이 턴당 한 번 발사하는 무기를 위한 것으로, SRD 5.1의 Loading 속성을 표현하려고 마련했습니다. 어차피 한 번 지불해 한 번만 타격하는 목록에서는 의미가 없어 거부합니다. 보유한 타격은 한 목록이 아닌 전투원의 것입니다. 두 무기 목록이 모두 `strikes`를 선언한 캐릭터는 어느 행으로 공격하든 같은 보유분을 소모합니다. 얻은 턴이 끝나면 지웁니다. 별도 선언이 없는 목록은 한 번 지불해 한 번 타격하며, 이 기능 이전의 모든 전투와 같습니다.

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
- `standardEffects`: 선택 사항으로 표준 행동의 플래그가 담지 못하는 부분입니다. 현재는 `dodge`에만 있습니다. `{ "dodge": { "saves": ["dex_save"] } }`는 회피가 지속되는 동안 어떤 내성을 두 번 굴려 좋은 결과를 쓸지 정합니다. 시트가 선언한 내성만 지정하고, `standard` 목록에 `dodge`가 있을 때만 사용하세요. 생략하면 회피는 기존과 정확히 같습니다. 맞기 어려워질 뿐 다른 효과는 없습니다. `{ "help": { "beside": true } }`(Capability API 1.771)는 상대 옆에 있을 때만 돕기를 제공하며, 그 도움은 도움을 준 전투원 옆에 있던 상대에게만 적용됩니다. `standard` 목록에 `help`가 있어야 합니다.
- `conditions`: 선택 사항입니다. 자체 상태 ID를 효과에 대응시켜 시트와 전투의 상태가 하나의 기록이 되게 합니다. 중독된 캐릭터는 전투 후에도 중독 상태입니다. 효과는 고정 목록입니다. `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side`(1.278), `cannot-approach-source`입니다. `failsSaves`는 굴리지 않고 실패하는 내성을 지정합니다. 거리나 이동이 필요한 여섯 가지(`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`)는 보드가 있는 전투에서 읽으며 없는 전투에서는 의미가 없습니다('위치' 참고). `cannot-react` 보유자는 걷기로 열리는 응답 창에서 제외되므로 응답을 요청받지 않습니다. 효과 옆에는 키 네 개가 더 있습니다.
  - `modifiers`: 상태가 유지되는 동안 바꾸는 숫자입니다. 아래 상태가 바꾸는 숫자를 참고하세요.
  - `saves`: 두 내성 효과와 내성에 대한 모든 수정치가 적용되는 자체 내성입니다. 생략하면 전부 적용되며, 둘 다 없이 지정하면 거부합니다.
  - `skills`: 두 판정 효과와, 자체 기술을 지정하지 않은 판정 수정치가 적용되는 자체 기술입니다. 생략하면 전부 적용되며, 둘 다 없이 지정하면 거부합니다. 전투의 겨루기는 기술이 아니라 전투 자체 판정을 굴리므로 기술로 범위를 좁힌 것은 겨루기에 닿지 않습니다. 그 기술에 대한 전투 밖 판정은 이를 읽습니다([전투 밖 판정](ruleset-items.md#checks-outside-a-fight) 참고). Capability API 1.53.
  - `whileSourceInSight`: 부여한 상대가 보유자의 시야 안에 있을 때만 적용되는 부분입니다. `true`는 상태 전체를 제한합니다. 그 상태의 자체 효과 목록을 쓰면 해당 효과만 제한하고 나머지는 유지합니다. 상대가 보이든 안 보이든 더 가까이 걷지 못하게 하는 공포에 필요한 방식입니다. 상태가 갖지 않은 효과를 지정하면 거부합니다. 보드가 없으면 시선을 끊을 수 없으므로 어느 방식이든 모든 효과가 적용됩니다.
  - `endsWhenSourceDown`: 부여한 상대가 쓰러지는 순간 해제됩니다.
  - 감각(Capability API 1.127): 상태의 `lacks`는 보유자에게 없는 감각을 지정하고, 카탈로그 항목의 `mechanics.needs`나 생물 행동의 `needs`는 효과가 작용하려면 대상이 가져야 하는 감각을 지정합니다. 5e의 Deafened에는 `"lacks": ["hearing"]`을, Command에는 mechanics에 `"needs": ["hearing"]`을 쓰세요. 귀가 먼 대상은 Command의 대상 메뉴에서 빠집니다. 청각이 필요한 범위나 다중 대상 효과는 그 대상을 완전히 건너뛰며, 내성도 피해도 상태도 없습니다. Deafened가 끝나면 그 대상은 다시 유효합니다. 각 목록은 규칙 집합 자체의 표현으로 쓴 서로 다른 감각 ID를 하나에서 네 개까지 가지며, Engine은 감각 이름을 알지 못합니다.
  - 시트가 허용하는 동안만 사용(Capability API 1.166): 카탈로그 항목의 `mechanics.usableWhen`은 `{ "value": <value reference>, "atLeast": n, "atMost": n }`입니다(경계 하나 또는 둘 다). 전투에서 항목은 보유자의 시트, 실시간 상태, 아이템에서 읽은 값이 경계 안에 있는 동안만 보유자의 턴이나 반응 창에서 제공되며, 메뉴를 그릴 때마다 읽습니다. 5e의 Protection은 손에 방패가 필요합니다. `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. Rage의 "중갑 없음"은 중갑 개수에 `"atMost": 0`을 쓴 같은 형태입니다. 능력치 블록으로 작성한 생물은 시트가 없으므로 아무것도 막지 않습니다.
  - 부여자의 시트가 허용하는 동안만 거는 상태(Capability API 1.167): 카탈로그 항목의 mechanics나 아이템 사용의 `applies` 항목은 `usableWhen`과 같은 형태의 `"when"`을 가질 수 있습니다. 상태가 걸리는 순간 거는 사람의 시트, 실시간 상태, 아이템에서 읽으며, 경계 밖의 항목은 건너뛰고 나머지는 그대로 적용합니다. 5e의 Rage는 네 항목 제한 안에서 `raging`과 세 가지 피해 상태 중 하나를 겁니다. `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, 그다음 `"atLeast": 9, "atMost": 15`인 `raging_damage_3`, `"atLeast": 16`인 `raging_damage_4`입니다. 시트가 없는 부여자는 모든 항목을 적용합니다. 생물의 능력치 블록과 상태의 `onEnd`에는 읽을 부여자 시트가 없으므로 그곳의 `when`은 거부합니다. schemaVersion 2와 capabilityApi 1.167 이상이 필요합니다.
  - 생물 유형과 대상 검사(Capability API 1.168): `combat.creatureTypes`는 전투원이 될 수 있는 것을 나열합니다. `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`.
    생물은 자체 `type`과 `tags`를 지정합니다. 캐릭터의 유형은 텍스트나 선택 필드 `field`의 값이 유형 중 하나이면 그 값이고, 아니면 `default`입니다(5e 캐릭터는 인간형). 대상 검사는 `{ "types": [...], "tags": [...] }`이며 하나라도 일치하면 통과합니다. 유형도 태그도 없는 전투원은 일치하지 않습니다. 검사는 세 곳에 둡니다. 피해 절의 `targetIs`는 일치하는 대상에게만 그 절을 줍니다(dragon slayer: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, 성수: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`). `applies` 항목의 `targetIs`는 일치하는 대상에게만 그 상태를 겁니다. `mechanics.targetTypes: { "is": test, "not": test }`는 누구를 고르거나 휘말리게 할 수 있는지 자체를 정합니다(Animal Friendship: `{ "is": { "types": ["beast"] } }`, Sleep: `{ "not": { "types": ["undead"] } }`). 범위는 `targetTypes`가 제외한 대상을 지나칩니다. 예측은 `targetIs` 절을 닿을 대상에 대해서만 세며, 시트의 단순 평균은 이를 제외합니다. 전투 패널과 Game Master는 각 전투원의 유형과 태그를 봅니다. schemaVersion 2와 capabilityApi 1.168 이상이 필요합니다.
  - 상태의 끝(Capability API 1.125): Charm Person은 `"endsWhen": ["harmed-by-source-side"]`를 씁니다. 상태를 건 사람이나 그 편의 누군가가 준 영보다 큰 피해, 또는 그들이 공격, 내성, 해로운 상태로 보유자를 겨누는 것은, 공격이 빗나가거나 내성이 성공하더라도 그 해로운 행동이 완전히 해결된 뒤 상태를 끝냅니다. `"saveWhenDamaged": true`는 피해를 받을 때 턴 내성을 반복합니다. 영보다 큰 피해마다 거는 행동의 `saveEnds`를 저장된 DC로 반복하며, 성공하면 끝납니다. 저장된 내성이나 DC가 없으면 아무것도 굴리지 않습니다. Hypnotic Pattern은 `"endsWhen": ["damaged"]`와 `"shakeOff": { "budget": "action" }`를 씁니다. 영보다 큰 피해는 즉시 상태를 끝내며, 보유자 편의 다른 전투원이 자기 턴에 그 예산을 써서 끝낼 수도 있습니다. `shakeOff.reach`는 규칙 집합 거리 단위이며 기본값은 한 칸입니다. 보드가 없으면 거리를 재지 않습니다. 행동 체계가 그 예산을 선언해야 합니다. `endsWhen`은 서로 다른 항목 하나 또는 둘을 가집니다. 이 키들은 출처 쓰러짐과 집중으로 인한 끝을 바꾸지 않습니다. 턴 시작이나 끝이 아니라 영보다 큰 피해에서만 하는 내성에는 `saveEnds.at: "damaged"`를 쓰세요(Capability API 1.129). Dominate Person의 applies는 `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`이며, `saveWhenDamaged` 없이 거는 행동의 저장된 DC로 타격마다 한 번 굴립니다.
  - Haste와 Slow가 바꾸는 행동 체계(Capability API 1.76):
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]`는 보유자에게 매 턴 턴 예산을 그만큼 더(또는 덜) 주며, 영 아래로는 내려가지 않습니다. `per` 턴마다 보충되는 예산만 이렇게 바꿀 수 있습니다. 예산은 상태만 채우는 것을 위해 `"count": 0`으로 선언할 수 있으며, 화면은 누군가 그 예산을 가진 동안만 이를 보여 줍니다. 창작한 상대는 이를 쓰지 않습니다.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }`는
      그 예산을 쓸 수 있는 곳을 정합니다. 지정한 표준 행동(규칙 집합 자체 `standard` 목록에서. 모든 표준 행동이 이미 있는 첫 예산에는 쓸 수 없음), 단일 타격의 무기 공격 하나(행동이 원래 손에 줄 타격과 관계없이. 생물은 한 대상에 대한 능력치 블록 공격이며 다중 공격은 안 됨), 아이템 사용입니다. 아이템 사용은 아무 아이템이면 `true`, 그 아이템 태그 중 하나가 있는 아이템만이면 `{ "tags": ["mundane"] }`입니다(5e의 Use an Object는 평범한 아이템의 사용이며 마법 아이템 발동은 아님). 이들은 보통 쓰는 예산이 다 떨어진 뒤, 보유자 자신의 턴에만 제공됩니다. 부여는 반응을 지불하지 않습니다.
    - `exclusive`: `["action", "bonus"]`처럼 한 턴에 하나만 쓰는 두 예산입니다. 하나를 쓰면 다른 하나가 비워집니다.
    - `attacksPerTurn`: 행동이 무엇을 주든 보유자가 자기 턴에 하는 공격 횟수입니다(명중 굴림을 하는 행동, 연속 행동의 각 공격 부분, 붙잡기처럼 타격을 대신하는 겨루기). 다른 사람의 턴에 하는 반응은 제한하지도 세지도 않습니다.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`는 상태가 완전히 끝날 때(시간이 다하거나, 내성이나 피해가 끝내거나, 집중이 깨질 때) 남기는 것이며, 다시 걸릴 때는 남기지 않습니다. `rounds` 동안 유지됩니다(`"until-save"`나 `"instant"`는 안 됨). 보유자 자신의 턴 도중에 남으면 라운드는 다음 턴부터 시작하므로, 한 라운드는 다음 턴 전체입니다.
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
- `dying`: 선택 사항이며 `kind: "saves"`입니다. 굴림을 세는 두 트랙(필요 횟수는 각 트랙 자체의 최대치), `dice`, `succeedAt`, 최대·최소 눈의 효과(`naturals.max`: `revive-1` 또는 `success`; `naturals.min`: `one-failure` 또는 `two-failures`), 쓰러진 동안 피해의 비용(`damageWhileDown`, `criticalWhileDown`), 쓰러진 캐릭터의 `condition`을 정합니다. 이 블록이 없으면 영인 캐릭터는 그냥 쓰러지며 회복하면 돌아옵니다.
- `damageTypes`: 선택 사항입니다. 자체 시스템의 피해 유형으로 대소문자 구분 없이 비교합니다.
- `damageKinds`: `health`가 부상 트랙을 지정하면 필수이고, 풀을 지정하면 거부합니다. 표시만 종류를 담을 수 있고 점수 풀에는 종류를 보관할 자리가 없기 때문입니다([부상 트랙](ruleset-sheets.md#wound-tracks-health-that-is-a-track-not-a-number) 참고). 타격이 트랙의 어떤 `kinds`로 표시되고 몇 칸을 채울지 정합니다. `default`는 유형 자체가 없는 타격을 포함해 대응되지 않은 모든 피해가 되는 종류입니다. `byType`은 자체 `damageTypes`를 종류에 대응시키며, 키는 유형과 마찬가지로 대소문자를 구분하지 않습니다. 따라서 `"Fire"`와 `"fire"`는 같은 키이며 둘 다 지정하면 거부합니다. `marks`는 두 답의 의미가 반대이므로 기본값이 없습니다. `"per-point"`는 피해 굴림이 체력 단계를 세므로 세 점 타격은 세 칸을 채우고 한 점 완화도 의미가 있습니다. `"per-blow"`는 타격이 맞거나 빗나가는 방식으로, 얼마나 세게 맞든 한 칸을 채웁니다. 피해 절이 여러 개인 타격도 실제로 적용된 가장 심한 종류로 한 칸만 표시합니다. 시스템에 맞는 방식을 명시하세요. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: `dice-pool`에서는 필수이고 `attack-vs-defense`에서는 거부합니다. 풀로 던지는 전투를 참고하세요.
- `spendLimits`: 선택 사항입니다. 전투에서 전투원 한 명이 실시간 풀을 `turn`이나 `round`마다 얼마나 쓸 수 있는지이며 풀의 종류와 관계없이 적용합니다. `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max`는 전투가 시작될 때 한 번 읽습니다. 남은 한도를 넘는 비용은 풀에 얼마가 있든 감당할 수 없으므로 메뉴에서 제외합니다. 턴당 한도는 보유자 자신의 턴 시작 시, 라운드당 한도는 라운드 시작 시 다시 시작합니다. 직접 수치로 쓴 상대는 시트에서 아무것도 지불하지 않으므로 한도에 묶이지 않고, 시트로 작성한 상대는 자체 풀에서 지불하므로 다른 누구와 마찬가지로 한도를 따릅니다. Capability API 1.47.
- `threat`: 선택 사항이며 생물 도감에는 필요합니다. `tiers`는 상대를 고르는 척도로 ID, 라벨, `health` 범위, `defense`, `toHit`, `damagePerRound` 범위, `saveDifficulty`를 갖습니다. 제공하는 모든 생물은 이 단계 중 하나를 지정합니다. 아무도 작성하지 않은 상대는 Game Master가 요청한 단계로 맞추므로 척도를 벗어나지 않습니다. `damagePerRound` 범위는 전체 연속 행동을 포함해 생물이 한 라운드에 표적 한 명에게 하는 피해로 읽습니다.
  등급에는 그 등급의 생물을 조우 예산에서 얼마로 계산하는지 나타내는 `worth`(5e에서는 도전 등급별 경험치)를, `threat`에는 맞서는 파티에 대해 전투에 허용되는 예산인 `budget`을 둘 수 있습니다(Capability API 1.803):
  - `level`: 합계가 파티원의 레벨이 되는 숫자 필드입니다(5e: 클래스마다 하나).
  - `steps`: 낮은 순서로 나열한 난이도 단계이며, 각 단계는 `{ "id", "label" }`입니다.
  - `byLevel`: `[{ "level": 5, "worth": [500, 750, 1100] }]`로, 해당 레벨 이상인 파티원 한 명에 대해 단계별 가치를 하나씩 지정하며 레벨은 오름차순입니다.
  - `crowd`: 선택 사항이며, `[{ "from": 2, "times": 1.5 }]`는 상대 수가 그만큼 되었을 때 상대들의 가치에 곱하는 배수입니다. 파티 인원이 `smallParty`보다 적으면 한 행 위를, `largeParty`보다 많으면 한 행 아래를 읽습니다(5e 2014의 배수). 가치를 그대로 더하는 SRD 5.2의 예산에는 생략하세요.
  - `forGame`: 선택 사항이며, 각 게임 난이도(`casual`, `normal`, `hard`, `brutal`)가 사용하는 단계입니다. 지정하지 않으면 순서대로 단계를 사용하며, 마지막 단계를 넘는 난이도는 모두 마지막 단계를 사용합니다.

  Game Master에게는 전투를 작성하기 전에 각 등급의 가치와 파티의 예산을 알려 줍니다. Game Master가 지어낸 전투의 가치가 예산보다 크면 낮춥니다. 창작한 상대 중 가치가 가장 높은 상대의 등급을 한 단계 낮추는 과정을 예산에 맞을 때까지 반복합니다. 보스가 포함된 전투는 다음 난이도 단계까지 허용됩니다. 생물 도감의 생물과 이전 전투에서 다시 등장한 생물은 그대로 계산하며, 스토리의 전투는 그 작성자가 정합니다. 무엇을 낮췄는지는 전투의 조정 내역에 표시합니다.

### 상태, 피해, 마법에 대한 내성

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
- `soak`: 대상이 명중 피해에서 피해 종류별로 빼는 것입니다. `all`은 모든 종류에 대한 값 참조이고, `byKind`는 체력 트랙의 종류마다 하나이며 그 종류에서는 `all`보다 우선합니다. 둘 다 지정하지 않은 종류는 흡수하지 않습니다. `"roll": true`이면 대상이 그만큼의 주사위를 피해 목표에 대해 던지고 성공마다 하나를 뺍니다. `"roll": false`이면 피해 주사위를 던지기 전에 그 수를 빼므로 자동 성공에는 닿지 않습니다. 던지는 흡수는 자동 성공도 다른 것처럼 뺍니다. 영 아래로 내려가지 않으며, 아무것도 세지 않은 타격을 흡수하려고 던지지는 않습니다. 생물은 자체 수치를 `soak: { "all": 1, "byKind": { "knock": 3 } }`로 주며, 이를 위해서는 블록의 `soak`가 흡수 방식을 정해야 합니다. 저항, 취약, 면역, `resist-all`은 흡수 뒤 남은 것에 적용합니다.
- `hardness`: 우선권이 공격으로 움직이는 수치일 때 전투원의 경도에 대한 값 참조입니다. [전투 중 방어구와 착용 효과](ruleset-items.md#armor-and-worn-effects-in-a-fight)를 참고하세요.

모든 대상의 피해는 그 대상마다 던집니다. 명중이 필요한 성공을 넘어 얻은 것과 대상이 흡수하는 것은 대상마다 다르기 때문입니다. 타격의 두 번째 절과 부가 효과는 각자 자체 종류의 별도 피해 풀이며 명중으로 인한 추가 주사위가 없습니다. 메뉴는 풀을 정확히 예측합니다. 필요한 성공에 도달할 확률과, 첫 대상이 흡수한 뒤 피해 주사위의 가치입니다.

Gravewatch가 이렇게 작성되어 있습니다. 파수꾼은 평점과 전문 기술을 던지고, 타박은 Sinew로 흡수하지만 찢긴 상처는 전혀 흡수하지 않으며, 턴마다 Resolve 1점을 쓸 수 있고, 라운드마다 우선권을 다시 던집니다.

**역순 선언은 구현하지 않습니다.** 일부 시스템은 누구든 행동하기 전에 가장 느린 사람부터 모두 행동을 선언합니다. 각 전투원이 자기 턴이 오면 행동 하나를 고르는 전투에서는 먼저 선언해도 어떤 규칙이 읽는 것도 바뀌지 않으므로 키로 표현할 것이 없습니다.

<a id="a-fight-thrown-in-symbol-dice-symbol-pool"></a>

### 기호 주사위로 던지는 전투: `symbol-pool`

`symbol-pool` 규칙 집합은 숫자 대신 기호를 읽으며 전투도 그렇게 할 수 있으므로, Engine은 이점으로 무엇을 샀는지 Game Master에게 묻지 않고 전투 전체를 진행합니다. `"kind": "symbol-pool"`에는 `"symbol-pool"`인 `resolution.kind`가 필요하며, 기존 기호 판정과 같은 방식으로 시트를 읽습니다.

- 명중 수치는 공격자의 주사위입니다. 시트에서는 공격 행의 숫자가 능력치와 기술 등급을 함께 나타냅니다. `pool.build: "larger-upgraded"`가 판정을 구성하듯 큰 쪽이 던질 주사위 수이고 작은 쪽이 승급할 주사위 수입니다. 생물 행동은 이를 `toHit`(주사위 수)와 `upgrades`(승급할 개수)로 나타내며, `sum`으로 구성하지 않고 `upgrade` 주사위가 있는 풀이 필요합니다.
- `defense`는 공격자의 주사위에 대항해 던지는 난이도 주사위 수입니다. 생물의 `defense`는 그 생물 자체의 개수입니다. 엄폐와 상태의 `defense` 수정치는 난이도 주사위를 더합니다.
- 공격, 내성, 판정에 대한 상태 수정치와 `penaltyFrom`이 지정하는 부상 페널티는 유리하면 증강 주사위, 불리하면 차질 주사위이므로 `flat` 숫자입니다. 굴리는 수정치(`dice`)는 거부합니다. 한쪽으로 기운 굴림(장거리, 상태에 따른 불리점)은 차질 주사위를 하나 더 던지며, 반대로 기울면 증강 주사위를 하나 더 던집니다.
- 순 성공 수가 `success.needed`에 도달하면 타격이 명중합니다. 내성 수치는 그 내성의 주사위이며 난이도는 대항하는 주사위입니다. 겨루기는 각 편의 주사위를 던져 순 성공이 많은 쪽이 이깁니다. 우선권도 풀로 던질 수 있으며(`initiative.pool`), 순 성공 수가 우선권 수치입니다.
- 피해는 `attack-vs-defense` 전투처럼 합산합니다. 순 성공마다 `damage.perSuccess`(1)를 명중 피해에 더합니다. 모든 성공(`"counts": "all"`) 또는 명중에 필요한 수를 넘은 성공만(`"beyond"`) 세며, 타격 전체에서 대상의 흡수를 빼되 0 아래로 내려가지 않습니다.
- 대실패는 없고 피해 굴림을 두 배로 만들지도 않습니다. 치명타는 기호 소비로 삽니다.

기호가 하는 일은 `symbols` 블록이 정합니다.

```json
"symbols": {
  "damage": { "perSuccess": 1, "counts": "all" },
  "soak": { "all": { "derived": "soak" } },
  "spends": [
    { "id": "boost", "label": "Boost an ally", "by": "attacker", "symbol": "a", "cost": 1, "boost": { "dice": 1, "on": "attacker-ally" } },
    { "id": "crit", "label": "Critical", "by": "attacker", "symbol": "a", "cost": 2, "when": "hit", "critical": true, "condition": { "id": "injured", "on": "target", "rounds": 3 } },
    { "id": "triumph", "label": "Triumphant blow", "by": "attacker", "symbol": "t", "cost": 1, "when": "hit", "critical": true, "damage": 2 },
    { "id": "strain", "label": "Overextend", "by": "target", "symbol": "h", "cost": 2, "track": { "id": "strain", "by": 1, "on": "attacker" } },
    { "id": "setback", "label": "Opening", "by": "target", "symbol": "h", "cost": 1, "setback": { "dice": 1, "on": "attacker" } },
    { "id": "despair", "label": "Weapon slips", "by": "target", "symbol": "d", "cost": 1, "condition": { "id": "disarmed", "on": "attacker" } }
  ]
}
```

- `soak`: 시트에서 읽어 대상이 명중마다 빼는 양입니다. `all`은 모든 피해 종류의 값 참조이고 `byKind`는 체력 트랙의 각 종류별 값으로 해당 종류에서는 `all`보다 우선합니다. 생물은 자체 값을 `soak: { "all": 2 }`로 주며, 이 `soak`이 선언되어 있어야 합니다.
- `spends`: 공격 굴림에 남은 기호로 사는 효과 최대 16개입니다. `symbol`의 `cost`만큼으로 한 번 사며, `max`(1)는 한 굴림에서 살 수 있는 횟수입니다. `condition`이나 `critical`을 주는 소비는 한 번 적용되므로 `max`는 1로 유지합니다. 두 소비가 같은 굴림에서 같은 대상에게 같은 상태(또는 같은 `oneAtATime` 종류의 상태 둘)를 부여할 수 없습니다. 아무 효과도 없을 소비는 사지 않습니다. 상태가 부여되지 못하거나(차단되거나 같은 종류를 이미 보유), 트랙이 그 방향으로 한 단계 온전히 옮겨질 여지가 없는 경우입니다(같은 굴림의 앞선 소비가 여지를 썼을 수 있음). `by`는 어느 편이 선택할지입니다. 공격자는 자신에게 유리한 기호(이점, 승리)를, 대상은 대상에게 유리한 기호(위협, 절망)를 소비합니다. 특정 기호는 한 편이 소비하며, 이미 명중과 피해 증가에 쓰인 성공 기호로는 절대 사지 않습니다.
- `when`: `hit`일 때만, `miss`일 때만 또는 어느 쪽이든(`any`, 기본값) 삽니다. `damage`(흡수 전 명중에 더하는 피해)와 `critical`(그 명중이 치명타가 되어 `onCritical`인 절이 적용되고 로그에 알림)에는 `"when": "hit"`와 `"by": "attacker"`가 필요합니다.
- 소비의 효과는 다음 중 어느 것이든 가능합니다. `condition`은 `rounds` 동안 또는 무언가 끝낼 때까지 대상에게 자체 상태 하나를 부여합니다. `track`은 일반 실시간 트랙을 `by`만큼 옮기며(피로, 스트레스) 체력 트랙은 옮기지 않습니다. `boost`와 `setback`은 적용받는 대상이 이 전투에서 다음에 하는 굴림에 그만큼 주사위를 더하며, 그 굴림이 소모합니다. `on`은 `attacker`, `target`, `attacker-ally`, `target-ally`입니다. 아군은 그 편에서 다음에 턴을 맞는 대상이며, 해당할 아군이 없으면 사지 않습니다.
- `worth`: 선택 사항이며 AI가 소비의 가치를 피해 점수로 평가하는 값입니다. 없으면 Engine이 효과로 계산합니다. 피해는 그 점수, 상태는 2, 다음 굴림의 주사위는 0.5보다 조금 큰 값, 트랙 한 단계는 0.5입니다. 상대 편에 대한 효과를 기준으로 하되, 트랙을 낮추거나 증강 주사위를 더하면 선택자 편에 대한 효과로 평가합니다. 선택자에게 가치가 없는 소비는 절대 사지 않습니다.

Engine은 플레이어와 상대 모두 각 편이 가진 기호로 가장 가치 있는 소비를 사고 각각 로그에 알립니다. 플레이어는 직접 고를 수도 있습니다. 전투 화면의 "Choose my own symbol spends"를 선택하면, 조종하는 파티원에게 굴림 뒤 살 수 있는 것이 남았을 때 소비를 하나씩 고르거나, 나머지를 Engine의 선택에 맡기거나, 더 소비하지 않기로 할 때까지 기다립니다. 선택에는 Engine과 같은 규칙(비용, `max`, `when`, 실제 적용 가능 여부)이 적용되며, 다른 모두의 소비는 여전히 Engine이 고릅니다. 규칙 집합에서 이를 위해 할 일은 없습니다. 아무도 소비하지 않은 기호는 굴림에 남아 Game Master가 서술합니다. 메뉴의 예측은 굴림의 모든 가능한 결과를 셉니다. 명중 확률과, 명중했을 때 성공과 소비를 반영하고 흡수를 뺀 피해입니다. AI는 이를 기준으로 각 공격을 평가하며 상대 편의 소비로 치를 비용은 뺍니다.

**Game Master가 맡는 부분.** 소비 비용은 각 무기가 아닌 규칙 집합의 것이므로, 자체 치명타 등급이 있는 무기는 규칙 집합이 공유하는 소비로 작성합니다. 치명타 자체 표는 Game Master가 굴립니다. 내성, 판정, 겨루기의 이점으로는 아무것도 사지 않습니다. 공격 굴림만 소비합니다. 전투에서 난이도 주사위를 승급하는 기능은 구현되지 않았습니다.

### 최소 피해 주사위

풀 전투는 Exalted의 **Overwhelming**처럼 강한 흡수에 맞서서도 주사위를 남길 수 있습니다.

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

이것은 `combat.damage.minimum`이며, **공격자**의 현재 시트에서 읽는 값 참조입니다. 정적 흡수가 명중의 첫 피해 풀에서 주사위를 뺀 뒤, 풀을 최소 이 수까지 올립니다. 자동 성공이 아니라 온전한 주사위이며, 내림하고 0과 `resolution.pool.max` 사이로 제한하므로 남은 주사위도 모두 실패할 수 있습니다. 굴리는 흡수는 여전히 피해 던지기 뒤 성공을 뺍니다. 주사위 풀을 줄이지 않으므로 최솟값이 그로부터 성공을 지켜 주지는 않습니다. 저항과 면역은 여전히 적용됩니다. 우선권을 소비하는 타격은 무기 피해와 흡수를 무시하듯 최솟값도 무시하며, 우선권을 빼앗는 타격은 이를 씁니다.

무기는 `item.attack.damage.minimum`으로 공통 최솟값을 덮어쓸 수 있습니다. 보유자에 대한 같은 값 참조나, 아이템 자체 숫자 스탯 하나를 가리키는 `{ "stat": "overwhelming" }`를 받습니다. 0을 선언해도 공통 최솟값을 덮어씁니다. 이것은 흡수 뒤 일정 피해를 보장하는 기존 무기 `floor`와 다릅니다. 추가 피해 절과 부가 효과는 또 다른 최솟값을 받지 않습니다. 전투 기록과 로그는 주사위 옆에 정해진 최솟값을 보여 줍니다. 전투 키와 무기 키 모두 외부 카탈로그 파일의 무기를 포함해 패키지에서 **Capability API 1.146**이 필요합니다.

### 멍하게 만드는 명중

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

### 대상이 고르는 부상 종류

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
- `abilities`와 `saves`: 시트가 선언한 능력치 ID와 내성 ID를 키로 씁니다. 지정하지 않은 내성은 영으로 읽습니다.
- `checks`: 겨루기에서 더하는 값으로 `combat.checks`의 ID를 키로 씁니다. 지정하지 않은 것은 영으로 읽습니다. Capability API 1.43.
- `soak`: `dice-pool` 전투에서만 쓰며 흡수하는 양입니다. `all`은 모든 피해, `byKind`는 체력 트랙의 종류별 값입니다. Capability API 1.47.
- `hardness`: 우선권이 공격으로 움직이는 수치일 때, 주사위가 이보다 낮은 소비 타격은 아무 효과가 없습니다. Capability API 1.56.
- `speeds`와 `hover`: 걷기 외의 이동 방식입니다('위치' 아래 '다른 이동 방식' 참고). Capability API 1.113.
- `shield: true`: 손이 차 있으므로 행동의 `twoHanded` 대안이 성립하지 않습니다. Capability API 1.102.
- `size`: ID로 지정한 `combat.sizes` 중 하나이며, 겨루기의 `maxSizeAbove`가 읽습니다('크기와 벗어나기 DC' 참고). Capability API 1.103.
- `type`과 `tags`: ID로 지정한 `combat.creatureTypes.types` 중 하나와 그 `tags` 최대 여덟 개이며, 대상 검사가 읽습니다('생물 유형과 대상 검사' 참고). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: 피해 유형으로, 대소문자 구분 없이 비교하고 `combat.damageTypes`를 선언했다면 그 목록으로 검증합니다. `resist`나 `immune` 항목은 무엇이 통하는지도 지정할 수 있습니다. `{ "type": "tearing", "except": ["silver"] }`이면 그 아이템 태그 중 하나를 가진 무기 아이템의 타격은 그대로 받습니다(Capability API 1.55, [전투 중 무기](ruleset-items.md#weapons-in-a-fight) 참고). `damage.qualities`가 그 태그를 지정한 행동이나 `mechanics.qualities`가 지정한 카탈로그 항목도 마찬가지입니다(Capability API 1.101). `conditionImmunities`는 자체 상태나 `combat.levels`가 읽는 트랙을 지정합니다(Capability API 1.115).
- `tier`: `combat.threat`의 어느 단계에 속하는지입니다.
- `loot`(Capability API 1.63): 이긴 전투가 이 생물에 대해 굴리는 전리품 표의 ID입니다([전리품](ruleset-items.md#loot) 참고).
- `inventory`(Capability API 1.795): 전투 시작 시 소지할 수 있는 것으로, 최대 16줄입니다. 각 줄은 아이템 하나(`item`, `<catalog>/<entry>` 형식) 또는 전리품 표 하나(`table`)를 지정하며, `chance`(백분율, 기본값 100)와 `count`(숫자 또는 주사위, 기본값 1이며 표는 그 횟수만큼 굴림)를 가집니다. 전투에서는 사용할 수 있는 것을 사용합니다. `sheet`가 있는 생물은 파티원과 똑같이 아이템을 사용하며, 일반 능력치 블록은 사용 시 소모되고 `use`가 사용자의 어떤 정보도 읽지 않는 아이템(물약, 기름)을 사용합니다. 쓰러뜨리면 남은 소지품은 `loot`와 함께 떨어지며, 도망치면 가지고 갑니다. Game Master는 대신 상대에게 별도의 소지품을 줄 수 있으며(조우의 `carrying`), 이 경우 위의 줄들을 대체합니다.
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

Engine의 5e 초안 테스트 사본인 `docs/development/ruleset-5e-2014.example.json`에는 손으로 작성한 생물 다섯으로 구성된 생물 도감이 있습니다. 연속 행동, 재충전, 상태가 붙은 내성, 저항과 면역, 사용 횟수 제한, 고유 점수, 시트로 작성한 생물 하나를 다룹니다. 전체 SRD 생물 도감은 공식 [5e (SRD 5.1) 패키지](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014)의 `catalogs/creatures.json`입니다.

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

**게임에서 사용할 수 있는 스타일.** `combat.styles`는 규칙 집합을 쓰는 게임이 사용할 전투 스타일을 ID로 지정합니다. `classic`, `tactical` 또는 클라이언트가 등록한 스타일이며, 최대 8개를 각각 한 번씩 나열하고 `classic`과 `tactical` 중 하나 이상이 있어야 합니다. 생략하면 기존처럼 모든 스타일을 제공합니다. 규칙상 보드가 필요한 규칙 집합(범위, 근접 거리, 엄폐, 협공)은 `"styles": ["tactical"]`이라고 씁니다. 그러면 New Game 마법사와 게임 설정은 Tactical만 제공하므로 전투에 항상 위치가 있습니다. 목록에 없는 스타일로 이미 저장한 게임은 목록에서 클라이언트가 그릴 수 있는 첫 스타일로 플레이합니다(등록 스타일을 지원하지 않는 클라이언트에서는 나열한 첫 내장 스타일). 제외한 스타일로 게임을 만들거나 설정에서 전환할 수 없습니다. 이미 진행 중인 전투는 시작할 때의 스타일을 유지합니다. 목록은 전투 디렉터를 켰는지와 관계없이 적용되므로 규칙 집합을 쓰는 Marinara 자체의 Classic과 Tactical 전투도 제한합니다. `styles`를 사용하는 규칙 집합은 Capability API 1.379가 필요합니다.

```json
"combat": {
  "kind": "attack-vs-defense",
  "styles": ["tactical"],
  "distance": { "label": "feet", "perCell": 5 }
}
```

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

**공중 상태**(Capability API 1.354). 어떤 보드에서든 비행자가 공중에 있는지는 별도로 관리합니다. 걷기 속도가 없거나 `hover`가 있으면 공중에서 시작합니다. 지상에서는 무료 Take off 동작, 위로 날기, 또는 비행만 가능한 걸음(물 위나 걷기보다 날기가 저렴한 곳)으로 이륙합니다. 무료 Land 동작(걷기 속도가 있는 경우만)으로 착륙하거나, 부양하지 않는 한 넘어지거나 쓰러지거나 속도가 0이 되면 내려옵니다. 지면까지 아래로 날아도 착륙할 때까지 지면 높이의 공중에 머뭅니다. 공중에 있는 동안 생물 그림은 비행 그림을 사용합니다. 다른 규칙은 아직 이 상태를 읽지 않습니다.

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
- **한 턴과 다음 턴 사이.** 턴이 끝나면 다음 턴이 시작하기 전에 `signaturePoints`를 갖고 자체 `signature` 행동 하나를 감당할 수 있는 모든 상대에게 구매할지 묻습니다. `combat.signatureAtTurnStart`가 달리 정하지 않는 한 살 수 있는 순간은 이때뿐입니다. 고유 행동은 자신을 포함해 누구의 턴 메뉴에도 없습니다.
- **적의 턴이 시작됩니다**(Capability API 1.805). `"combat": {"signatureAtTurnStart": true}`이면 상대의 턴이 시작될 때도 `signaturePoints`를 보유한 모두에게 묻습니다. 턴 시작이 일으키는 일(상태, 내성, 반응)이 모두 일어난 뒤이자 상대가 행동하기 전입니다. 일반 전투의 대비처럼, 막 행동하려는 영웅에게 보스가 응답하는 방식입니다. 본거지 행동은 자체 순서 수치를 따르며 여기에서는 제공하지 않습니다. 생략하면 5e의 전설 행동처럼 고유 행동은 턴 사이에서만 구매합니다. 이를 사용하는 규칙 집합에는 Capability API 1.805가 필요합니다.
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

- **단순한 보드를 넘어서는 것:** 장애물 위 비행이 없습니다. 생물은 자신의 걷기, 탈것의 걷기, 순간이동, 밀어내는 것(겨루기, 항목, 생물 행동, 영역), 그리고 끌고 가는 사람에 의해서만 움직입니다.
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
