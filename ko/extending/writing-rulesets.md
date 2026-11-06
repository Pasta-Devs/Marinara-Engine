# Game Mode 규칙 집합 작성하기

규칙 집합은 탁상 게임 시스템의 작동 방식을 Game Mode에 알려 줍니다. 판정에 굴리는 주사위, 캐릭터 시트의 항목, 소비하는 자원, 휴식으로 되찾는 것을 정합니다. 규칙 집합을 직접 작성해 내 시스템을 Game Mode로 가져오고 공유하세요. 다른 사람이 만든 규칙 집합으로 플레이하려면 [규칙 집합으로 플레이하기](../game/rulesets.md)를 참고하세요.

규칙 집합은 JSON 파일 하나입니다. 코드가 아닌 데이터이므로 그 안의 어떤 것도 실행되지 않으며, 가져와도 컴퓨터에 해를 끼칠 수 없습니다. 다른 사람의 파일을 가져오기 전에 Game Master 텍스트를 읽으세요. 그 텍스트는 해당 규칙 집합을 쓰는 모든 게임에서 모델로 전송되기 때문입니다.

## 규칙 집합 시작하기

1. 시스템의 굴림 방식에 맞는 예제 파일을 복사하세요.
   - [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json)은 능력치 세 개를 가진 작은 2d6 시스템입니다. 형식이 d20이나 여섯 능력치를 전제하지 않음을 보여 줍니다.
   - [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json)은 평점 셋과 전문 기술 여섯을 가진 작은 십면 주사위 풀입니다.
   - 공식 [5e (SRD 5.1) 패키지](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014)는 전체 규모의 예제입니다. Agent Organizer가 설치하는 것은 이 패키지의 `ruleset.json`과 `catalogs/`입니다.
2. `id`를 고유한 값으로 바꾸세요. ID는 `ember-roads`처럼 소문자, 숫자, 단일 하이픈으로 씁니다.
3. 복사본을 Notepad나 VS Code 같은 텍스트 편집기로 열고 `.json` 확장자로 저장하세요. 먼저 `name`을 바꾸고, 다음으로 `sheet`의 능력치 이름을, 그다음 `rests`와 `gm` 텍스트를 바꾸세요. [파일 구성](#parts-of-the-file)에 각 키가 나와 있고, [참고 페이지](#reference-pages)에서 각 키를 설명하는 페이지로 이동할 수 있습니다.
4. 가져오세요([규칙 집합 시험하기](#try-your-ruleset) 참고). 가져오기는 무엇이든 저장하기 전에 파일 전체를 검사하고 잘못된 부분을 줄별로 알려 줍니다.
5. 새 게임을 만들고([Game Mode: 시작하기](../game/getting-started.md) 참고) **Rules**(규칙)에서 내 규칙 집합을 고른 다음 판정을 몇 번 해 보세요.

잘 되지 않으면 [문제 해결](#troubleshooting)을 참고하세요.

입력하는 동안 편집기의 도움을 받으려면 파일의 바깥 중괄호 안 첫 줄에 다음을 추가하세요. 편집기에 JSON Schema를 알려 주는 줄입니다.

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

스키마는 잘못 쓴 키와 잘못된 타입을 잡아냅니다. 기술이 지정한 능력치처럼 이름이 실제로 있는 대상을 가리키는지는 검사하지 못합니다. 그 검사는 가져오기가 합니다. 어느 객체에나 `"$comment": "..."` 줄을 넣어 메모를 남길 수 있습니다. Engine은 이 줄을 무시합니다.

## 규칙 집합이 할 수 있는 것과 없는 것

규칙 집합은 Engine이 이미 아는 메커니즘의 빈칸을 채웁니다. Engine은 판정을 해결하는 다섯 방식을 알고 있으며, 파일은 `resolution.kind`로 그중 하나를 고릅니다.

- **`dice-sum`**: 주사위를 굴려 시트 숫자를 더하고 난이도 이상을 얻습니다. d20 시스템, 2d6에 능력치를 더하는 시스템 등 여러 방식이 해당합니다.
- **`dice-pool`**: 캐릭터 수치만큼 주사위를 던져 목표에 도달한 개수를 셉니다. 평점이 보너스가 아니라 주사위 개수인 시스템을 다룹니다.
- **`dice-highest`**: 풀을 던져 가장 높은 주사위를 읽거나, 높은 주사위 몇 개를 더합니다. Blades in the Dark와 Trophy Dark가 해당합니다.
- **`roll-against`**: 시트 숫자 이하(또는 이상)로 굴립니다. 백분율 기술과 GURPS 판정이 해당합니다.
- **`symbol-pool`**: 서술형 주사위를 구성하고 승급한 뒤 반대 기호를 상쇄합니다. Genesys 판정이 해당하며, Capability API 1.382부터는 전투도 해당합니다.

다섯 가지 모두 [판정 종류](ruleset-checks.md#resolution-kinds)에서 자세히 설명합니다.

대항 풀처럼 이 형태들에 맞지 않는 메커니즘은 규칙 집합 파일로 쓸 수 없습니다. 그런 메커니즘에는 Engine 안의 새 판정 종류가 필요하며, 이는 테스트를 갖춘 코드 기여입니다. 시스템에 그런 메커니즘이 필요하면 Engine 저장소에 기능 요청을 열고, 계산 과정을 보여 주는 굴림 몇 개로 메커니즘을 설명하세요. 그 굴림이 테스트가 됩니다.

Game Mode는 Marinara 자체 전투나 규칙 집합의 규칙 중 하나로 싸움을 해결합니다. 선택적 `battle` 블록은 캐릭터 시트의 숫자를 Marinara 전투에 빌려줍니다. [전투 연결](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat)을 참고하세요. 선택적 `combat` 블록은 규칙 집합이 싸움 자체를 해결하는 방식을 정합니다. [자체 규칙 전투](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)를 참고하세요. 게임의 Combat Preference는 Turn-Based 표시를 고르거나, 규칙 집합이 거리를 정의하면 Tactical 전장을 고릅니다. 규칙 집합은 `combat.styles`로 게임에서 사용할 수 있는 방식을 제한할 수 있습니다([게임에서 사용할 수 있는 스타일](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) 참고).

<a id="parts-of-the-file"></a>

## 파일 구성

| 키 | 내용 |
| --- | --- |
| `schemaVersion` | 항상 `1`입니다. |
| `id`, `version` | Engine이 쓰는 규칙 집합 이름과, 변경을 게시할 때마다 올리는 정수입니다. |
| `name` | 설정 마법사에서 플레이어에게 보이는 이름입니다. |
| `edition` | 선택 사항. 판이나 초안을 설명하는 한 줄입니다. |
| `license` | 선택 사항. SPDX ID와 원본이 요구하는 저작자 표시 텍스트입니다. |
| `coverage` | 규칙 집합의 지원 범위와 설정 마법사에 표시할 한 줄 요약입니다. |
| `resolution` | 판정이나 내성을 굴리는 방식입니다. |
| `sheet` | 캐릭터 시트의 모든 내용입니다. |
| `rests` | 휴식 종류별로 회복하고 지우는 내용입니다. |
| `gm` | Game Master 모델이 받는 텍스트와, 모델이 캐릭터별로 보는 시트 값입니다. |
| `catalogs` | 선택 사항. 플레이어가 긴 목록을 손으로 쓰지 않도록 시트 편집기가 제공하는 기성 항목입니다. |
| `items` | 선택 사항. 아이템을 작성하는 어휘인 분류, 희귀도, 스탯, 슬롯, 화폐입니다. |
| `battle` | 선택 사항. 전투가 시트에서 읽는 내용과, 전투 후 시트에 다시 쓰는 내용입니다. |
| `combat` | 선택 사항. 자체 규칙으로 싸움을 해결하는 방법과, 그때 전투 화면이 진행할 내용입니다. |
| `layers` | 선택 사항. 게임을 만들 때 플레이어가 켜는 규칙 집합 변형입니다. |

파일 크기는 최대 512 KB입니다(Capability API 1.340 이전에는 256 KB). 프롬프트에 들어가는 텍스트(이름, 라벨, Game Master 텍스트)에는 줄바꿈, 대괄호, 이중 중괄호를 넣을 수 없습니다.

시트 안의 ID(능력치, 기술, 필드, 풀 등)는 `grit_max`처럼 문자로 시작하며 소문자, 숫자, 밑줄을 사용합니다.

<a id="reference-pages"></a>

## 참고 페이지

이 페이지에서는 규칙 집합을 시작하고, 시험하고, 공유하는 방법을 다룹니다. 다른 페이지는 각각 한 주제를 다룹니다.

- [규칙 집합 판정](ruleset-checks.md): 다섯 가지 판정 종류, 결과 구간, 자체 방식으로 굴리는 판정, 굴림을 바꾸는 자원 소비나 부적.
- [규칙 집합 시트](ruleset-sheets.md): 능력치, 기술, 필드와 목록, 실시간 상태, 부상 트랙, 페널티, 휴식, Game Master 텍스트, 파티 시트와 진행 시계.
- [규칙 집합 카탈로그](ruleset-catalogs.md): 시트 편집기가 선택기에서 제공하는 기성 항목.
- [규칙 집합 항목 메커니즘](ruleset-mechanics.md): 판정, 휴식과 전투가 읽는 카탈로그 항목의 `mechanics` 블록.
- [규칙 집합 캐릭터 빌더](ruleset-character-builder.md): 종족과 클래스부터 점수, 숙련, 주문과 장비까지 단계별로 캐릭터 만들기.
- [규칙 집합 아이템](ruleset-items.md): 분류, 무기, 방어구, 탄약, 전리품, 돈, 시작 장비와 시장.
- [규칙 집합 전투](ruleset-combat.md): `battle` 블록과 `combat` 블록, 그리고 도감, 보드, 반응과 겨루기.
- [규칙 집합 레이어, 번역과 마이그레이션](ruleset-layers-and-translations.md): 플레이어가 한 게임에 켜는 변형, 번역, 시트가 바뀔 때 값을 새 ID로 옮기기.

<a id="try-your-ruleset"></a>

## 규칙 집합 시험하기

시작하기 전에 **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)에서 **Allow custom Agent imports**(사용자 지정 에이전트 가져오기 허용)를 켜세요. 가져온 규칙 집합은 가져온 에이전트와 같은 안전 스위치를 쓰므로, 직접 켜기 전까지는 꺼져 있습니다. 가져오기에는 localhost 접근 또는 관리자 시크릿(**Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근))도 필요합니다.

1. **Agents**(에이전트) 패널을 열고 **Import agents**(에이전트 가져오기) 버튼(패널 위쪽 버튼 줄의 다운로드 아이콘)을 고르세요.
2. **Game Mode ruleset**(Game Mode 규칙 집합)을 선택하고 JSON 파일, 또는 `.ruleset.json`으로 끝나는 규칙 집합 패키지 파일을 고르세요([규칙 집합 공유하기](#sharing-your-ruleset) 참고).
3. 검토 내용을 읽으세요. 이름, 버전, 라이선스, 규칙 집합의 지원 범위와 Game Master 텍스트가 표시됩니다. **Import**(가져오기)를 선택하세요.

규칙 집합은 패널의 **Rules** 구역과 새 게임 설정 마법사의 **Rules** 선택지에 나타납니다. 파일에서 가져온 규칙 집합은 `local/<your id>`로 분류되므로 공식 규칙 집합이나 다른 사람의 규칙 집합과 혼동되지 않습니다.

### 이미 가져온 규칙 집합 변경하기

가져온 버전은 다시 쓰이지 않습니다. 바뀐 파일을 같은 `version`으로 가져오면 가져오기가 거부되고 번호를 올리라는 안내가 나옵니다. 게임은 만들어질 때의 정확한 버전에 묶이므로, 진행 중인 캠페인의 계산 방식은 바뀌지 않습니다.

초안을 작성하는 동안에는 편집, `version` 올리기, 가져오기, 새 게임 시작을 반복합니다. **Rules** 구역에서 규칙 집합을 제거하기 전까지 이전 버전은 새 버전 옆에 계속 설치되어 있습니다. 게임이 아직 사용하는 규칙 집합을 제거하면, 다시 가져올 때까지 그 게임에 규칙 집합이 없다고 표시됩니다.

시트의 모양을 바꿨다면(항목 추가, 제거, 이름 변경) `sheet.version`도 올리세요. 기존 시트는 관대하게 읽습니다. 새 시트가 모르는 값은 보존하고, 없는 값은 기본값을 사용합니다.

<a id="sharing-your-ruleset"></a>

## 규칙 집합 공유하기

공유하는 방법은 다섯 가지입니다.

### 파일로

JSON 파일을 친구에게 보내세요. 친구도 내가 했던 것과 같은 방식으로 가져오면 됩니다.

### 패키지 파일로

카탈로그를 별도 파일에 둔, 파일 하나에 담기에는 너무 큰 규칙 집합은 `<name>.ruleset.json`이라는 일반 JSON 파일 하나로 전달합니다. 이 파일은 패키지 매니페스트와 규칙 집합의 문서들을 담으며, 각 문서는 base64(파일을 일반 텍스트로 적는 방법)로 저장됩니다.

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

매니페스트는 `ruleset.json`과 각 `catalogs/<id>.json`을 `contributions.assets.paths`와 `files`에 나열하며, 각각의 크기와 sha256(파일의 지문)을 함께 적습니다. Pixelforge 같은 규칙 집합 편집기가 이 파일을 만듭니다. **Import agents** → **Game Mode ruleset**은 이 파일을 받아 규칙 집합 파일과 같은 검토를 보여 주며, 각 카탈로그와 그 항목 수도 함께 표시합니다.

이 파일은 데이터로 읽힐 뿐 패키지로 설치되지 않습니다. 압축된 내용이 없으므로 자체 크기보다 많은 것을 담지 않습니다. 제한은 다음과 같습니다.

- 규칙 집합 파일처럼 `local/<its id>`로 분류됩니다.
- 최대 132 MB이며, 카탈로그 파일은 각 2 MB씩 최대 12개, 번역은 각 8 MB씩 최대 40개입니다(아래 참고).
- 버전은 규칙 집합과 카탈로그를 합친 것이므로, 카탈로그를 바꿔도 더 높은 `version`이 필요합니다.
- 규칙 집합 패키지는 zip으로 받지 않습니다.

다음 경우에는 이유와 함께 거부됩니다.

- 다른 키나 다른 파일, 또는 엄격한 base64가 아니거나 UTF-8 텍스트가 아닌 문서를 담은 경우
- 매니페스트가 규칙 집합에 필요한 것 이상(코드, 권한, 다른 기여)을 요청하는 경우
- 파일이 매니페스트에 나열된 파일과 다른 경우
- `$comment`가 2,000자보다 길거나, `$schema`가 Engine 자체 스키마가 아닌 것을 지정하는 경우
- 규칙 집합이나 카탈로그를 읽을 수 없는 경우

### 공식 에이전트 카탈로그를 통해

카탈로그에 게시된 규칙 집합은 정확히 이 형태의 규칙 집합 패키지 파일인 `<id>.ruleset.json`이며, 패키지 zip인 경우는 없습니다. 매니페스트는 Capability API 1.374 이상을 선언하므로 이전 Engine에는 제공되지 않습니다. Engine은 직접 가져오는 패키지 파일과 같은 읽기 처리와 검사로 이를 읽고, 카탈로그에 기재된 매니페스트와 대조한 뒤 다른 카탈로그 패키지처럼 설치합니다. 배포 파일이 zip인 카탈로그 규칙 집합은 다운로드하기 전에 거부되며, 이미 설치한 규칙 집합은 계속 작동합니다.

### GitHub 저장소에서

공개 GitHub 저장소에 작업을 보관한다면, 저장소 최상위의 `rulesets` 폴더에 규칙 집합마다 파일 하나씩 넣으세요.

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

사용자는 저장소를 한 번 추가하고 내용을 검토한 뒤, 나중에 동기화하여 새 버전을 받습니다. 사용자 지정 저장소 목록은 고급 기능입니다. 서버 운영자가 `ENABLE_CUSTOM_AGENT_REPOS=true`로 켠 다음 **Agents → Agent Organizer → Custom Sources**(에이전트 → Agent Organizer → 사용자 지정 소스)를 엽니다. 저장소의 규칙 집합은 `alice/ember-roads`처럼 저장소 소유자 이름 아래 분류되므로, 두 작성자가 모두 `v20`이라는 규칙 집합을 게시해도 충돌하지 않습니다.

제한은 두 가지입니다. 저장소의 `rulesets` 바로 안에는 JSON 파일을 최대 32개까지 둘 수 있으며, 그보다 많은 저장소는 거부됩니다. `local/`은 파일에서 가져온 규칙 집합용으로 예약되어 있으므로 `local`이라는 계정은 규칙 집합을 게시할 수 없습니다.

### 공식 카탈로그로

널리 플레이되고 라이선스가 명확한 시스템은 **Agent Organizer**를 통해 모두에게 제공할 수 있습니다. 제안하려면 [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 저장소에 풀 리퀘스트를 여세요. 배치는 그곳의 `ruleset-5e-2014` 패키지를 참고하세요.

## 라이선스

공유할 권리가 있는 규칙 텍스트만 게시하세요. 많은 시스템이 공개 라이선스로 참조 문서를 게시하며, 복사해도 되는 것은 그 문서입니다. 라이선스 ID(SPDX ID, 즉 `CC-BY-4.0` 같은 짧은 표준 이름)와 라이선스가 요구하는 저작자 표시 텍스트를 `license` 아래에 넣으세요. 공개 라이선스가 아닌 규칙서의 텍스트는 복사하지 마세요. 규칙 집합에 주로 필요한 것은 이름과 숫자입니다. Game Master 텍스트는 직접 쓴 말로 작성하세요.

<a id="troubleshooting"></a>

## 문제 해결

- **가져올 때 이름이 없다고 나옵니다.** 파일 안의 무언가가 선언되지 않은 ID를 가리킵니다. 삭제한 능력치를 기술이 지정하는 경우 등입니다. 메시지에 해당 줄의 경로가 나옵니다.
- **가져올 때 다른 내용의 버전이 이미 설치되어 있다고 나옵니다.** `version`을 올리고 다시 가져오세요.
- **설정 마법사에 내 규칙 집합이 없습니다.** **Allow custom Agent imports**가 켜져 있는지 확인하세요. 꺼져 있는 동안 가져온 규칙 집합은 새 게임에서 제외되며, 이미 사용하는 게임은 계속 작동합니다.
- **게임에 규칙 집합이 없다고 나옵니다.** 게임을 만들 때의 정확한 버전이 설치되어 있지 않습니다. 그 버전의 파일을 다시 가져오세요.
