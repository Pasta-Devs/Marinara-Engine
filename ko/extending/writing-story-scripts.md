# Game Mode 스토리 스크립트 작성하기

스토리 스크립트를 사용하면 제작자가 Game Mode 게임이 펼쳐지는 방식을 이끌 수 있습니다. 파티가 어딘가에 도착하면 재생되는 장면, 조건이 충족되면 Game Master에게 요청하는 일, 플레이어가 일지에서 따라가는 목표, Game Master가 직접 표시할 수 있는 순간을 정합니다. 이 가이드는 스토리 스크립트를 직접 작성하려는 분을 위한 것입니다. 스토리가 있는 월드로 플레이하려면 [월드 만들기](../game/getting-started.md#making-a-world)부터 읽으세요.

스토리 스크립트는 코드가 아닌 데이터입니다. 그 안의 어떤 것도 실행되지 않습니다. Engine은 스크립트를 대상 월드와 대조해 검사하고, 턴마다 진행하며, 맞지 않는 것은 모두 거부합니다.

## 스토리를 두는 곳

스토리는 월드 하나에 속합니다. 스토리는 그 월드의 장소와 인물을 지칭하므로, 작성 대상인 월드(그 월드의 시드, 개요, 직접 편집한 내용)와 함께일 때만 의미가 있습니다.

- **월드 파일**(`.world.json`): `world` 옆의 최상위 `story`로 들어갑니다. 스토리를 모르는 Engine도 월드는 그대로 읽습니다.
- Experience의 **지도 팩**: 각 월드 파일에 스토리를 담을 수 있으며, 새 게임은 지도와 함께 스토리를 가져갑니다. [선택 설치 에이전트 패키지](../development/optional-agent-packages.md)를 참고하세요.
- 게임 밖에서 라이브러리에 보관한 월드: 게임과 마찬가지로 `GET`, `PUT`, `DELETE /api/game-worlds/:id/story`를 사용합니다. 그 월드로 시작한 새 게임은 스토리도 함께 가져갑니다.
- 시작된 게임: `GET`, `PUT`, `DELETE /api/game/:chatId/story`로 스토리를 읽고 저장하고 제거합니다. 저장할 때는 직접 편집한 내용을 포함한 게임의 월드와 대조해 검사하며, 스토리가 지칭하는 대상을 없애는 직접 편집은 거부됩니다.

새 게임 설정에서는 파일이나 지도 팩에서 읽은 스토리가 월드의 시드와 개요가 그대로인 동안에만 유지됩니다.

## 구조

```json
{
  "storyVersion": 1,
  "flags": [],
  "directions": [],
  "events": [],
  "cutscenes": [],
  "fights": [],
  "endings": [],
  "knowledge": []
}
```

ID는 소문자, 숫자, `_`, `-`로 이루어진 1~40자이며 각 목록 안에서 고유해야 합니다. 스토리에는 플래그 최대 256개(Capability API 1.353 이전에는 64개), 지시 최대 64개, 이벤트 최대 256개(1.349 이전에는 128개), 컷신 최대 64개, 전투 최대 32개, 엔딩 최대 16개, 지식 항목 최대 600개를 넣을 수 있습니다. 스토리의 어떤 텍스트에도 줄바꿈, 대괄호, `{{`를 넣을 수 없으며, 태그에 들어가는 이름(세력, 배경)에는 큰따옴표를 넣을 수 없습니다. 스토리가 하는 어떤 말도 Game Master의 태그로 오인될 수 없도록 하기 위해서입니다.

### 플래그

플래그는 스토리가 보관하는 값으로, `"bool"`(참 또는 거짓)이나 `"number"`입니다.

```json
{ "id": "trust", "kind": "number", "initial": 0, "gm": true, "note": "How far the town trusts the party" }
```

- `gm: true`이면 Game Master가 플래그를 설정할 수 있습니다([Game Master의 태그](#the-game-masters-tags) 참고). `note`는 플래그의 의미를 Game Master에게 알려 줍니다.
- 플래그는 플레이어에게 보이지 않습니다. `quest`를 지정하면 플래그가 일지의 **퀘스트 목표**가 됩니다.

```json
{
  "id": "favours",
  "kind": "number",
  "initial": 0,
  "quest": { "title": "Favours", "text": "Do the town three favours", "goal": 3 }
}
```

숫자 플래그에는 `min`과 `max`를 지정할 수 있습니다(Capability API 1.358). 모든 `set`과 `add`는 Game Master 자체 태그를 포함해 값을 그 범위 안에 유지하므로, 이벤트가 아무리 더해도 호감도는 -10에서 10 사이를 유지합니다. `initial`도 그 범위 안에 있어야 합니다.

```json
{ "id": "approval", "kind": "number", "initial": 0, "min": -10, "max": 10, "gm": true }
```

예/아니요 목표는 플래그가 참이 되면 완료됩니다. 숫자 목표는 `goal`(지정하지 않으면 1)에 도달하면 완료되며, `goal`을 적어 두면 일지에 진행 정도가 표시됩니다. `"hidden": true`인 목표는 이벤트가 보여 줄 때까지 일지에 표시되지 않습니다.

#### 클록

숫자 플래그는 플레이어가 차오르는 모습을 지켜보는 **클록**이 될 수 있습니다(Capability API 1.342). 2~12칸으로 나뉜 원에서 점수마다 한 칸이 채워지며, 게임의 HUD와 World 탭에 제목 및 가득 차면 일어날 일과 함께 표시됩니다.

```json
{
  "id": "reeve",
  "kind": "number",
  "initial": 0,
  "gm": true,
  "clock": { "title": "The Reeve's patience", "segments": 6, "full": "The Reeve sends his men." }
}
```

다른 숫자 플래그처럼 값을 설정하고 더하고 조건에서 검사하세요. Game Master는 매 턴 클록을 전달받으며, 클록이 가득 차면 일으킬 일을 한 번 전달받습니다(이벤트가 채웠을 때, 또는 자체 태그가 채운 다음 턴). `"hidden": true`인 클록은 이벤트가 `show`로 표시할 때까지 숨겨집니다.

### 지시

지시는 Game Master에게 주는 상시 지침으로, 조건이 유지되는 동안 효력이 있습니다.

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

<a id="conditions"></a>

### 조건

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }` 형식입니다. `if` 목록의 조건은 모두 충족되어야 합니다. 예/아니요 플래그는 `=`나 `!=`로만 비교합니다.

`{ "party": "<person id>", "is": "in" | "out" }`은 스토리가 영입한 동료처럼 월드의 인물이 현재 파티와 함께 이동하는지 확인합니다(Capability API 1.349).

`{ "partySize": { "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <1 to 32> } }`는 파티 인원을 확인합니다. 플레이어 캐릭터와 함께 이동하는 모든 동료를 세되 전투에 참여하지 않는 동료는 제외합니다(Capability API 1.360). Engine이 파티 규모를 알 때만 조건이 충족됩니다.

`{ "any": [<condition>, <condition>, ...] }`는 2~8개 조건 중 하나라도 충족되면 참입니다(Capability API 1.358). 이벤트 두 개 대신 목록 하나에 양자택일 조건을 넣습니다.

```json
"if": [{ "any": [{ "flag": "won_granary", "is": "=", "value": true }, { "party": "p11-3", "is": "in" }] }]
```

### 지식

인물이 자신과 서로, 배경 설정에 대해 알고 말하는 내용으로, 스토리 진행에 따라 바뀝니다(Capability API 1.348). 각 항목은 다음 조건에 맞는 턴에, 화제가 나오면 해당 인물이 말할 수 있는 내용으로 Game Master에게 전달됩니다.

- 항목의 조건이 충족됩니다.
- 항목의 `person`이 장면에 있습니다. 최신 응답이나 플레이어 메시지에서 언급되거나 파티와 함께 이동하는 경우입니다.
- `keys`가 있으면 그중 하나도 그곳에서 언급되어야 합니다. 인물이 없는 항목에는 키가 필요하며, 키만으로 전달 여부를 정합니다.

한 턴에 최대 12개를 전달합니다. 1.361부터는 우선순위를 매깁니다. 장면에 언급된 인물이 먼저이고, 그다음은 장면 속 단어가 불러온 인물 없는 항목, 마지막은 함께 이동하기만 하는 동료입니다. 각 분류 안에서는 인물별로 나누어 전달하므로 말이 많은 동료 하나가 나머지를 밀어내지 않습니다. 장면이 아무리 붐벼도 이동 중인 동료에게는 12개 중 두 개를 항상 배정하고 같은 방식으로 나눕니다.

```json
"knowledge": [
  { "id": "hob-self", "person": "p3-4", "text": "Hob was a miller's boy before the year stopped." },
  { "id": "hob-mill", "person": "p3-4", "if": [{ "flag": "act", "is": ">=", "value": 2 }],
    "text": "Since the second act, Hob is afraid of the mill." },
  { "id": "hob-bells", "person": "p3-4", "keys": ["bells"], "text": "Hob thinks the bells are a lie." },
  { "id": "wheel", "keys": ["mill", "millwheel"], "text": "The mill's wheel has not turned in a hundred autumns." }
]
```

스크립트에는 최대 600개 항목을 넣을 수 있습니다. 한 턴에 최대 12개를 스크립트 순서로 전달하므로 가장 중요한 것을 먼저 두세요.

### 이벤트

이벤트는 일어나는 일입니다. 트리거가 발동하고 조건이 충족되면 이벤트의 동작을 실행합니다.

```json
{
  "id": "gates",
  "when": { "on": "arrive", "place": "p11" },
  "if": [{ "flag": "banished", "is": "=", "value": false }],
  "do": [{ "cutscene": "gates" }, { "set": "arrived", "value": true }, { "show": "key" }]
}
```

이벤트는 `"repeat": true`가 없으면 한 번만 일어납니다(`start`, `turn`, `day`는 이 값을 무시합니다). 한 턴에 최대 32개 이벤트가 각각 최대 한 번씩, 스크립트에 나열된 순서대로 일어납니다.

**트리거**(`when.on`)는 모두 게임이 기록한 내용을 읽습니다.

| 트리거 | 발동 시점 |
| --- | --- |
| `start` | 게임의 첫 응답에서 발동합니다. |
| `turn` | 세션을 가리지 않고 게임 전체에서 Game Master의 `turn`번째 응답 또는 그 이후에 발동합니다. |
| `day` | 월드의 날짜(Game Master가 서술하는 시간 경과와 이동으로 흐름)가 `day` 이상이 되면 발동합니다. |
| `arrive` | 파티가 `place`(장소 ID)나 그 안의 장소에 있을 때 발동합니다. 그곳에서 시작했거나, 오버월드를 걸어서 왔거나, 마을에서 방문했거나, Game Master가 그 장소를 지정해서 온 경우입니다. `repeat`가 있으면 다른 곳에 갔다가 돌아올 때마다 다시 발동합니다. |
| `meet` | 응답이 `person`(`p11-3` 같은 인물 ID, 직접 추가한 인물이라면 `p11-e1`)의 전체 이름을 언급하면 발동합니다. `repeat`가 있으면 그 인물을 언급하는 응답마다 다시 발동합니다. 이름은 현재 세션의 응답에서만 찾습니다. |
| `deed` | 월드가 `deed` 종류의 파티 행적을 기록하면 발동합니다. `place`를 지정하면 그 장소에서의 행적이어야 합니다. `repeat`가 있으면 행적을 기록하는 응답마다 다시 발동합니다. |
| `fight` | 전투가 `outcome`(`victory`, `defeat`, `flee` 중 하나)으로 끝나면 발동합니다. `fight`(스크립트의 전투 중 하나, 1.358)를 지정하면 해당 전투가 그 결과로 끝났을 때만 발동합니다. 이는 Game Master의 최신 응답이 스토리의 `fight` 동작이나 자체 발동으로 시작한 전투입니다. |
| `leave` | 파티가 `place`(장소 ID)와 그 안의 모든 장소를 벗어나면 발동합니다(1.358). 최신 응답이나 이번 턴의 이동, 방문, Game Master가 지정한 장소, 스토리의 `move`로 벗어나는 경우입니다. `repeat`가 있으면 떠날 때마다 다시 발동합니다. |
| `broke` | 전투에서 `prop`이라는 이름의 소품이 부서지면 발동합니다(Capability API 1.316). 이름은 대소문자를 구분하지 않고 비교합니다. 월드의 전장 중 하나에 칠해 둔 소품만 지정할 수 있습니다. |
| `flags` | 조건이 충족되면 발동합니다. `repeat`가 있으면 조건이 거짓이었다가 참이 될 때마다 다시 발동합니다. |
| `gm` | Game Master가 발동시킬 때만 발동합니다(이벤트에 `"gm": true`가 필요합니다). |
| `rest` | 파티가 휴식한 응답 뒤에 발동합니다. Game Master의 응답에서 처리한 `[sheet: op="rest"]`이며, `rest`가 지칭하는 규칙 집합의 휴식(ID나 `long` 같은 레이블)이거나 아무 휴식입니다(1.349). |
| `travel` | 파티가 한 장소에서 다른 장소로 출발하는 턴에 발동합니다. `from`과 `to`가 있으면 각각 그 안에서 출발하고 그 안으로 향해야 합니다(1.349). |
| `idle` | 아무 일 없이 응답이 `turns`번 연속 이어지면 발동합니다. 스토리 이벤트, 이동, 전투가 없어야 합니다(1.349). |
| `step` | 이동 경로가 `place`의 `x`, `y` 칸(왼쪽 위부터 0으로 시작)을 지나가면 발동합니다. 그 장소는 정착지의 마을(방문할 때 문에서 문까지 가는 경로)이거나 직접 만든 장소 지도(그 지도 위를 걷는 경로)입니다. 칸은 파티가 걸어 들어갈 수 있는 곳이어야 합니다. 마을에서는 광장에서 닿는 땅이어야 하며, 스토리가 건물을 지을 수 있는 빈 부지는 안 됩니다. 지도에서는 입구에서 닿는 바닥이어야 합니다. 생성된 지도에는 지정할 칸이 없습니다. `repeat`가 있으면 이동 경로가 그 칸을 지나는 턴마다 다시 발동합니다. |

step 이벤트의 칸을 없애는 직접 편집(그 칸에 건물을 놓거나 지도의 바닥을 벽으로 막는 것)은 저장할 때 해당 이벤트를 밝히며 거부됩니다.

자기 장면에서 그 인물을 언급하는 반복 `meet` 이벤트나, 기다리는 행적을 스스로 수행하는 반복 `deed` 이벤트는 매 턴 스스로를 다시 발동시키므로 Engine이 거부합니다.

**동작**(`do`):

| 동작 | 하는 일 |
| --- | --- |
| `{ "set": "<flag>", "value": <value> }` | 플래그를 설정합니다. |
| `{ "add": "<flag>", "amount": <number> }` | 숫자 플래그에 더합니다. |
| `{ "tell": "<text>" }` | 이번 턴에 한 번, Game Master에게 무언가를 요청합니다. |
| `{ "cutscene": "<id>" }` | 컷신을 재생합니다. |
| `{ "show": "<flag>" }` | 숨겨진 퀘스트 목표를 일지에 표시합니다. |
| `{ "world": { "deed": "<kind>", "group": "...", "with": "...", "place": "<place id>", "who": "..." } }` | 월드에 행적을 기록하며, Game Master가 직접 기록한 행적과 똑같이 처리됩니다. |
| `{ "give": { "item": "<catalog/entry or a name>", "count": 1, "who": "...", "summary": "..." } }` | 아이템을 줍니다(1.343). 게임의 규칙 집합 아이템은 ID로, 그 밖의 아이템은 이름으로 지정하고 `summary`에 무엇인지 적습니다. 플레이어의 가방이나 `who`가 지칭하는 파티원에게 들어갑니다. Game Master가 주는 것과 똑같이 처리되므로 인벤토리 규칙이 적용됩니다. 게임의 규칙 집합에 없는 ID는 거부하고 응답에 이유를 적습니다. |
| `{ "fight": "<fight id>" }` | 스크립트의 전투 중 하나를 시작합니다(1.343). Game Master는 전투로 이야기를 이끌라는 지시를 받으며, 이어지는 전투에는 스토리가 정한 상대가 등장합니다. |
| `{ "move": "<place id>" }` | 이동한 것처럼 파티를 월드의 장소에 놓습니다(1.343). 이로 인해 생기는 `arrive` 이벤트는 같은 턴에 일어납니다. |
| `{ "ending": "<ending id>" }` | 스크립트의 엔딩 중 하나로 게임을 끝냅니다(1.343). 장면을 재생하고 Game Master가 에필로그로 마무리하며, 플레이어에게 엔딩을 보여 주고 세션 종료를 제안합니다. 그 뒤로 스토리에서는 아무 일도 일어나지 않습니다. |
| `{ "music": "<track id>" }` 또는 `{ "music": null }` | Experience의 트랙 하나를 장소의 음악 대신 재생합니다(1.345). 다른 음악을 지정하거나 `null`로 장소의 음악에 돌려줄 때까지 유지됩니다. 트랙은 지도 팩의 `music` 중 하나여야 합니다. |
| `{ "recruit": "<person id>" }` | Experience의 동료 하나를 게임의 규칙 집합용 시트와 함께 파티로 영입합니다(1.347). Game Master는 합류하는 모습을 보여 주라는 지시를 받습니다. |
| `{ "dismiss": "<person id>" }` | 동료를 파티에서 내보냅니다(1.347). |
| `{ "season": { "place": "<place id>", "to": "winter" } }` | 날짜와 무관하게 장소와 그 안의 모든 장소를 특정 계절로 고정합니다(1.351). `place`가 없으면 월드 전체입니다. `"to": null`이면 스크립트 자체의 `seasons`나 날짜에 따른 계절로 되돌립니다. |
| `{ "sheet": { "condition": "<id>", "state": "on" }` 또는 `{ "sheet": { "track": "<id>", "by": 1, "upTo": 3 } }` | 파티원마다 시트 상태를 부여하거나 제거하고(`"off"`), 각자의 시트 트랙을 `upTo`에서 멈추도록 조정합니다(1.368). 예를 들어 Rime Edge의 어떤 휴식으로도 낫지 않는 추위는 전투 상태에 `cannot-heal-nonmagical`이 있는 상태로 구현합니다. Engine이 발동시킨 동작은 작성하는 응답과 함께, Game Master가 발동시킨 동작은 표시한 다음 턴에 적용합니다. |

모든 동작에 자체 `if`를 넣을 수 있습니다(Capability API 1.358). 이벤트가 그 동작에 도달할 때, 앞선 동작이 완료된 상태에서 조건이 충족되어야 실행하므로 이벤트 하나 안에서 분기할 수 있습니다.

```json
"do": [
  { "add": "approval", "amount": 2 },
  { "tell": "Hob warms to the party.", "if": [{ "flag": "approval", "is": ">=", "value": 5 }] },
  { "tell": "Hob keeps his distance.", "if": [{ "flag": "approval", "is": "<", "value": 5 }] }
]
```

실행한 동작을 발동 기록과 함께 남기므로 `gm` 이벤트의 장면과 요청 사항은 Game Master가 표시할 때 실행된 그대로 다음 턴에 전달됩니다.

각 스토리 기능에는 다음 Capability API 마이너 버전이 필요합니다.

- 클록에는 1.342가 필요합니다.
- 전투, 엔딩, `give`, `fight`, `move`, `ending` 동작에는 1.343이 필요합니다.
- 음악 지정에는 1.345가 필요합니다.
- 동료 영입이나 내보내기에는 1.347이 필요합니다.
- 지식에는 1.348이 필요합니다.
- `rest`, `travel`, `idle` 이벤트, `priority`, `party` 조건, 또는 128개를 넘는 이벤트에는 1.349가 필요합니다.
- `seasons`와 `season` 동작에는 1.351이 필요합니다.
- 64개를 넘는 플래그에는 1.353이 필요합니다.
- 전투 `variants`에는 1.356이 필요합니다.
- `any` 조건, 전투를 지정한 `fight` 이벤트, `leave` 이벤트, 플래그의 `min`이나 `max`, 동작이나 페이지의 `if`에는 1.358이 필요합니다.
- `partySize` 조건, 6명을 넘거나 상한이 없는 파티용 변형, 6개를 넘는 변형에는 1.360이 필요합니다.
- 내부의 모든 장소에 `over`로 적용하는 `season` 동작에는 1.361이 필요합니다.
- `exposures`에는 1.362가 필요합니다.
- `adjust`로 조정하는 전투 생물에는 1.363이 필요합니다.
- 노출의 `save`나 트랙의 `upTo`에는 1.364가 필요합니다.
- 노출의 `sparedByShade`에는 1.365가 필요합니다.
- `heldGround`에는 1.366이 필요합니다.
- `sheet` 동작에는 1.368이 필요합니다.
- Held Ground의 `release`에는 1.369가 필요합니다.
- 대안 목록을 주려면 1.370이 필요합니다(1.370부터 해당 항목이 있는 카탈로그에서 주는 단독 항목 ID는 이전 Engine에서는 이름으로 취급됩니다).
- 전투 생물의 `calls`나 `levels`를 `adjust`로 조정하려면 1.371이 필요합니다.

동료는 팩의 인물 파일에서 동료로 표시한 인물입니다([선택 설치 에이전트 패키지](../development/optional-agent-packages.md)의 지도 팩 인물 참고).

한 턴에 일어날 수 있는 `rest`, `travel`, `idle` 이벤트 중에서는 `priority`가 가장 높은 하나만 일어납니다(-100~100의 정수, 생략하면 0이며 동률이면 스크립트에서 먼저 나오는 것). 따라서 동료의 모닥불 대화, 길 위에서 동료 둘이 다투는 장면, 조용한 시간에 동료가 플레이어를 찾아오는 장면이 겹치지 않습니다. `party` 조건이 있으면 해당 동료가 파티와 함께 이동하는 동안에만 장면이 일어납니다. 1.349부터 스크립트에는 이벤트를 256개까지 넣을 수 있습니다(이전에는 128개).

### 노출

장소에 머무는 동안 시간이 지나며 파티가 받는 영향입니다(Capability API 1.362). 예를 들어 한낮의 빛이 가득한 들판은 전투 보드의 빛 규칙이 전투 안에서 하듯 전투 밖에서도 여행자를 지치게 합니다.

```json
"exposures": [
  { "id": "noonfield", "place": "e9", "label": "Noonfield's light", "hours": 1,
    "tracks": [{ "track": "exhaustion", "by": 1 }], "applies": ["sunstruck"],
    "if": [{ "flag": "darkness_carried", "is": "=", "value": false }],
    "tell": "The light presses on them; darkness would be a mercy." }
]
```

게임 시계를 따릅니다. `if`가 충족된 채 파티가 `place`나 그 안에 있는 첫 턴에 시작하며, 이후 턴마다 그곳에서 `hours`가 몇 번 지났는지 셉니다. 그때마다 Engine은 각 파티원의 `tracks`를 `by`만큼 움직이고 `applies` 상태를 부여합니다. Engine 자체 시트 명령을 응답의 명령과 함께 적용하고 `tell`로 Game Master에게 알립니다. 장소를 떠나거나 `if`가 더 이상 충족되지 않으면 끝나며, 다음번에는 새로 시작합니다. 응답에 한 번 기록됩니다(`[story: exposure=...]`).

트랙에는 상한을 둘 수 있습니다(Capability API 1.364). `{ "track": "exhaustion", "by": 1, "upTo": 3 }`은 3을 넘기지 않으며 이미 그보다 큰 값도 움직이지 않습니다. 노출은 모두에게 영향을 주는 대신 내성 굴림을 요구할 수 있습니다(1.364). 전투 보드의 빛 규칙 `save`와 같은 형식입니다(1.321).

```json
"save": { "save": "con_save", "difficulty": 12, "against": { "conditions": ["noon_light"] } }
```

노출이 영향을 줄 때마다 Engine은 각 파티원의 시트로 해당 내성을 굴리고, 실패한 인물에게만 개별 시트 명령으로 트랙과 상태를 적용합니다. `against`는 내성의 대상을 나타내므로 그 대상에 한정된 내성 수정치는 전투 안과 마찬가지로 밖에서도 적용됩니다. 오버레이의 밀짚모자에 `{ "to": "saves", "mode": "advantage", "against": { "conditions": ["noon_light"] } }`가 있으면 착용자에게 이점을 줍니다. Game Master는 누가 성공하고 실패했는지 합계와 함께 전달받습니다.

`"sparedByShade": true`이면(Capability API 1.365), 파티원 중 누군가 켜서 들고 있는 그늘이 `if`가 충족되지 않을 때처럼 노출을 막습니다. 착용하거나 들고 있는 아이템의 `light`에 `"shade": true`가 있어야 합니다(시연용 Lantern of Dusk). 스위치가 있는 아이템은 켜져 있을 때만 적용됩니다. 켜면 노출이 끝나고 끄면 새로 시작합니다.

### Held Ground

시연용 계곡처럼 죽음이 유예되는 곳입니다(Capability API 1.366).

```json
"heldGround": [
  { "id": "valley", "place": "p0", "label": "The Held Autumn", "condition": "felled",
    "marks": [{ "track": "owing", "by": 1 }],
    "if": [{ "flag": "year_turned", "is": "=", "value": false }],
    "tell": "Nobody here has died in forty years." }
]
```

파티가 `place`나 그 안에 있고(장소가 없으면 월드 전체) `if`가 충족되는 동안, 그곳에서 시작한 규칙 집합 전투는 Held Ground에서 진행됩니다(1.323). 체력이 소진된 인물은 대신 쓰러져 전투에서 빠지며, 안정된 상태로 죽어 가지 않고, 수확하는 무언가에 쓰러진 경우가 아니면 나중에 다시 일어납니다. 쓰러진 인물에게 `condition`이 붙고 각 인물의 `marks` 트랙이 움직입니다(Owing의 표식). 조건을 충족하는 첫 항목이 적용됩니다. 스토리는 파티가 그곳에 들어오고 떠나는 것을 기록하고(`[story: held=...]`) 매번 `tell`로 Game Master에게 알립니다. 유지되는 매 턴 Game Master에게 그 의미를 상기시킵니다.

Held Ground는 유예를 끝낼 수 있습니다(Capability API 1.369). 시연에서는 해가 바뀌는 순간입니다. `release`는 그때 무엇을 치러야 하는지 정합니다.

```json
"release": { "felled": "die", "owing": { "track": "owing", "bonus": { "flag": "hymn_bonus" } } }
```

`felled`는 쓰러져 있는 인물의 운명을 정합니다. 죽거나(`"die"`, 기본값), 규칙 집합 자체 규칙에 따라 쓰러져 죽어 가기 시작합니다(`"down"`). `owing`은 각 파티원이 `track`의 표식마다 규칙 집합의 죽음 내성을 하나씩 굴리게 합니다(트랙을 지정하지 않으면 Held Ground에서 처음 표시한 트랙). 매 굴림에 `bonus`를 더하고(숫자 또는 유예가 끝날 때 읽는 숫자 플래그), 표식이 소진되거나 결과가 결정될 때까지 계속합니다. 표식은 소비되며 세 번 실패하면 죽습니다. 아직 그곳에서 진행 중인 규칙 집합 전투에서는 유예를 끝내는 바로 그 단계에 해제됩니다. `if`가 읽는 스토리 숫자를 소비하는 아이템 사용(1.359), `broke` 이벤트가 반응하는 소품 파괴(1.316), 그리고 이것들이 일으키는 플래그 이벤트입니다. 쓰러진 인물과 Owing의 대가는 전투 자체의 해제 처리(1.330)에 따라 그 라운드에 치릅니다. 전투 밖에서는 해제를 기록하는 스토리 턴이 각 파티원의 시트로 Owing을 굴리고 누가 살고 죽었는지 Game Master에게 알립니다. 그곳에서 미완료로 남은 전투는 다음 단계에서 유예를 끝냅니다. 전투에서 이미 처리한 해제는 두 번 굴리지 않습니다.

<a id="seasons"></a>

### 계절

월드의 계절은 달력을 따라 각각 90일씩 이어집니다. 스토리는 날짜와 무관하게 장소를 특정 계절로 고정할 수 있습니다(Capability API 1.351). 가을에 갇힌 계곡이나 겨울로 고정된 언덕 같은 곳입니다.

```json
"seasons": [{ "place": "p3", "season": "autumn" }, { "season": "summer" }]
```

각 항목은 장소와 그 안의 모든 장소를 고정하고, `place`가 없으면 월드 전체를 고정합니다. 가장 가까운 고정 장소가 결정합니다. 가을로 고정된 지역 안에 겨울로 고정된 마을이 있으면 마을은 겨울입니다. `season` 동작은 플레이 중 고정을 바꾸거나 해제합니다. 내부 전체에 `over`로 적용한 고정(1.361)은 예외로, 스크립트 자체 계절과 다른 모든 고정보다 우선합니다(그런 고정 중 가장 바깥쪽이 먼저). 따라서 `{ "season": { "to": "spring", "over": true } }`는 월드 전체를 한꺼번에 바꿉니다. 파티가 있는 곳의 계절이 고정되어 있으면 Game Master는 계절과 고정 사실을 전달받고, 그에 맞는 날씨를 생성합니다. 오버월드는 각 칸을 가장 가까운 장소의 계절로 그리며(타일 팩의 `<id>@<season>` 타일), 마을은 자체 계절로 그립니다.

월드에 직접 그린 전장에도 계절을 칠할 수 있습니다. 타일 행마다 `seasons` 행을 두고 타일마다 문자 하나나 `.`을 쓰며, `seasonKeys`에서 문자가 가리키는 계절을 정합니다(`{ "a": "autumn", "w": "winter" }`). `.`으로 남긴 타일은 전투 장소의 계절을 따릅니다. 전투 타일은 그 계절로 시작하며, 라운드의 지도 이벤트가 서리의 고리가 퍼지거나 봄의 선이 휩쓸고 지나가듯 바꿀 수 있습니다.

### 전투

스토리가 정하는 전투입니다. 누구와 싸울지, 월드에 전용 보드를 그려 놓았다면 어디서 싸울지를 정합니다.

```json
{
  "id": "granary",
  "name": "The Granary",
  "creatures": [
    { "creature": "creatures/scarecrow", "count": 3 },
    { "creature": "The Owed", "name": "The Owed" }
  ],
  "battlefield": "b2",
  "note": "The jars break when hit."
}
```

각 생물은 게임의 규칙 집합 생물 도감에 있는 생물이며 ID(`catalog/entry`)나 이름으로 지정하고 `count`만큼 등장합니다(여럿이면 번호를 붙임). `name`이 있으면 전투에서 그 이름을 씁니다. `battlefield`는 월드에 직접 그린 보드(`b<n>`)이며, 전투가 어디서 시작하든 그 보드에서 싸웁니다. 없으면 다른 전투처럼 시작한 곳에서 싸웁니다. `note`는 전투가 어떻게 벌어지는지 Game Master에게 알려 줍니다. 게임의 규칙 집합에 없는 ID는 거부하여 해당 생물을 전투에서 제외하고 거부를 기록합니다. 그 결과 생물이 하나도 없어도 스토리가 정한 전장에서 전투는 시작하지만 적은 Game Master가 고릅니다.

다른 파티 규모에 맞춘 전투를 설정할 수 있습니다(Capability API 1.356). 파티는 플레이어 캐릭터와 함께 이동하는 모든 동료이며 `noncombatant`로 표시한 동료는 제외합니다(1.360).

```json
"variants": [
  { "party": { "min": 3, "max": 4 }, "creatures": [{ "creature": "creatures/scarecrow", "count": 4 }] },
  { "party": 5, "creatures": [{ "creature": "creatures/scarecrow", "count": 5 }], "battlefield": "b3",
    "note": "The Owed wakes in the loft." }
]
```

`party`가 파티 규모에 맞는 변형의 생물로 싸웁니다. 변형에 `battlefield`와 `note`가 있으면 그것을 쓰고, 없으면 원래 전투의 것을 씁니다. 맞는 변형이 없으면 작성된 원래 전투를 진행합니다. 두 변형이 같은 규모를 포함할 수는 없습니다.

전투나 변형의 생물 항목은 해당 전투용으로 생물을 `adjust`할 수 있습니다(Capability API 1.363). 별도 생물을 만들지 않고 보스를 파티에 맞출 수 있습니다. `"adjust": { "legendaryResistance": 2, "maxHp": 40 }`은 해당 전설 저항을 부여하고(0이면 제거) 체력을 지정합니다(주사위를 포함한 능력치 블록의 체력 대신 고정 숫자 사용). Game Master에게 생물과 함께 알립니다. 조정의 `calls`는 생물의 행동이 누구를 부르는지 바꿉니다(Capability API 1.371). `[{ "action": "shelves_lean", "creature": "creatures/wraith" }]`처럼 호출 행동(1.325)의 ID나 이름으로 지정합니다. `levels`는 특정 파티 레벨부터 이 값들을 바꾸며, 앞선 설정 위에 차례로 적용됩니다. `"levels": [{ "from": 8, "calls": [{ "action": "shelves_lean", "creature":
"creatures/wraith" }] }]`처럼 씁니다. 파티 레벨은 파티원 중 가장 높은 레벨이며, Experience의 동료 시트가 게임의 규칙 집합에 대해 지정한 레벨 필드에서 읽습니다. 그런 필드가 없으면 `levels`를 읽지 않습니다. `party`는 최대 32명까지 지정합니다. `max`가 없는 범위(`{ "min": 7 }`, Capability API 1.360)는 아무리 커도 `min` 이상의 모든 파티를 포함합니다. 전투 시작 시와 회고 뒤에 Game Master에게 전투가 어느 파티 규모용으로 설정되었는지 알립니다.

### 엔딩

```json
{ "id": "kept", "title": "The Year Kept", "cutscene": "bells", "epilogue": "The valley stays held." }
```

`cutscene`은 스크립트의 장면 중 하나이며 엔딩이 시작될 때 재생됩니다. `epilogue`는 Game Master가 게임을 마무리하는 내용이자 엔딩을 보여 줄 때 플레이어가 읽는 내용입니다.

### 컷신

컷신은 작성한 그대로 플레이어에게 보여 주거나, Game Master에게 전달해 서술하게 합니다.

```json
{
  "id": "gates",
  "kind": "pages",
  "background": "backgrounds:generated:town-gates",
  "pages": [
    { "text": "The gates creak open." },
    { "speaker": "p11-3", "expression": "happy", "text": "Welcome, travellers." },
    { "speaker": "player", "text": "We come in peace." }
  ]
}
```

`pages` 컷신은 Game Master의 응답 전에 내레이션 안에서 한 페이지씩 재생됩니다. 화자가 없는 페이지는 내레이션이고, 화자가 있는 페이지는 그 인물의 대사입니다. 대사는 월드 속 그 인물의 이름(`player`라면 플레이어의 이름)으로 표시되며, `expression`은 Game Master 자체 목록에서 고릅니다. `background`는 게임에 있는 배경이거나, 이미지 생성이 켜져 있을 때 배경을 만들게 하는 `backgrounds:generated:<words>`입니다. Game Master는 장면이 표시되었다는 사실을 전달받고 거기서부터 이야기를 이어 갑니다.

페이지에는 `if`를 넣을 수 있습니다(Capability API 1.358). 장면을 재생할 때 조건이 충족되는 동안에만 표시하므로 야영 장면에서 파티와 함께 이동하는 동료에게만 대사를 줄 수 있습니다.

```json
{ "speaker": "p11-3", "text": "Another night.", "if": [{ "party": "p11-3", "is": "in" }] }
```

모든 페이지가 보류된 장면은 아무것도 표시하지 않습니다.

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

`beats` 컷신은 그 턴에 Game Master가 비트별로 자신의 말로 서술합니다. `gm` 이벤트의 비트는 이벤트와 함께 Game Master에게 전달되며, Game Master는 그 순간을 표시하는 응답에서 비트를 서술합니다. 따라서 `gm` 이벤트가 사용하는 비트 장면은 Engine 이벤트가 같은 장면을 재생하더라도 처음부터 Game Master가 알고 있습니다. 비트는 매 턴 전달되므로 모든 `gm` 이벤트의 비트를 합쳐 16,000자로 제한합니다.

<a id="the-intro-message"></a>

### 도입 메시지

`intro`(Capability API 1.339)는 게임을 시작하는 방식을 정합니다. GM 설정이 모든 게임에 제공하는 것과 같은 선택입니다.

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"`는 게임의 첫 메시지를 정확히 `text`로 만듭니다. Game Master는 이 메시지를 쓰지 않으며, 재생성해도 같은 텍스트가 나옵니다. `"guided"`는 Game Master가 쓰는 도입부의 방향만 잡아 주며, Game Master는 이를 첫 응답에서만 지침으로 읽습니다. `text`는 1~8000자이며 줄바꿈을 넣을 수 있지만(스토리에서 줄바꿈을 넣을 수 있는 유일한 텍스트입니다) `{{`는 넣을 수 없습니다. guided 텍스트에는 대괄호도 넣을 수 없습니다. `locked`가 있으면 플레이어는 GM 설정에서 도입 메시지를 보지만 바꿀 수 없습니다. 없으면 도입 메시지는 설정 필드를 채우기만 하며, 플레이어가 바꾸거나 지울 수 있습니다. 첫 응답이 이미 작성된 게임이나 파티를 이어받는 게임에는 도입 메시지가 없습니다. Experience는 다른 GM 설정 값 옆에도 도입 메시지를 지정할 수 있으며(`contributions.gameSurface.setup.defaults.intro`, 1.372), 그 값을 먼저 읽습니다.

## 스토리 진행 방식

매 턴 한 번, Game Master가 응답하기 전에 Engine은 스토리가 지금까지 한 일과 이번 턴에 생긴 일(이동, 방문, 전투 종료)을 읽고 이벤트를 일으킵니다. 일어난 일은 그 응답의 시작 부분에 기록됩니다. 각 이벤트와 그 이벤트가 설정한 값을 기록하는 태그, 그리고 작성된 그대로 표시한 장면입니다. 스토리는 응답에서 다시 읽어 들이므로 스와이프나 재생성을 하면 그 응답이 한 일이 취소되고, 게임 도중 스토리를 바꿔도 이미 일어난 일은 다시 쓰이지 않습니다. 스토리는 게임의 다음 세션으로 이어집니다.

<a id="the-game-masters-tags"></a>

### Game Master의 태그

매 턴 Game Master는 스토리의 값(플레이어에게는 숨겨짐)과 효력이 있는 지시를 전달받습니다. 나머지 스크립트 중에서는 스크립트가 Game Master에게 맡긴 것만 전달받습니다. `gm` 이벤트(그 `note`와 함께 서술할 `beats`)와 `gm` 플래그, 그리고 그 이벤트 중 지금 표시할 수 없는 것(이미 완료되었거나 조건 때문에 보류된 것)입니다. Game Master는 응답에서 다음과 같이 표시합니다.

- `[story: event="<id>"]`는 조건이 충족된 `gm` 이벤트를 발동시킵니다(반복 이벤트가 아니면 한 번만).
- `[story: flag="<id>" value="<value>"]`는 `gm` 플래그를 설정합니다. 숫자 플래그에는 `add="<number>"`를 쓸 수도 있습니다.

`gm` 이벤트의 선물, 전투, 이동은 태그와 함께 응답에 들어갑니다. 엔딩 장면과 에필로그는 다음 응답의 시작 부분에 나옵니다.

Engine은 각 태그에 그 자리에서 응답하며(이벤트는 한 턴에 최대 한 번), 그 밖의 것은 이유와 함께 거부합니다. 스토리가 없는 게임에서는 모든 스토리 태그가 거부됩니다. Game Master가 발동시킨 것은 즉시 반영됩니다(플래그, 행적). 장면과 요청 사항은 다음 응답의 시작 부분에 나오며, `beats`만은 예외입니다(그 순간과 함께 서술하도록 요청받았기 때문입니다). Game Master가 그 순간 자체는 이미 서술했으므로 `gm` 이벤트의 `pages`는 그 순간 다음에 이어지는 내용으로 작성하세요.

## 스토리 시험하기

`PUT /api/game/:chatId/story`와 `{ "story": { ... } }`로 게임에 스토리를 저장하세요. 맞지 않는 스토리는 모든 이유와 함께 거부됩니다. 게임의 World(월드) 탭에는 스토리가 보여 준 목표와 클록이 나열되고, Game Master의 프롬프트에는 매 턴 스토리의 값과 지시가 담깁니다.
