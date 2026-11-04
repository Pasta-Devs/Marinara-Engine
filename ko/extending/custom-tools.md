# 사용자 지정 도구와 기능 호출

사용자 지정 도구(함수라고도 합니다)를 쓰면 AI가 채팅 중에 작은 동작을 실행할 수 있습니다. 이 동작은 정해진 문구를 돌려주거나, 웹 주소를 호출하거나, 서버에서 짧은 스크립트를 실행할 수 있습니다. AI가 추측하는 대신 무언가를 찾아보거나 계산하게 하고 싶을 때 쓰세요.

기능 호출은 AI가 앱에 동작 실행을 요청하고 그 결과를 답변에 활용하는 방식입니다. Marinara에는 주사위 굴림, 로어북 검색, 게임 상태 갱신 같은 기본 제공 도구가 이미 들어 있습니다. 사용자 지정 도구는 그 도구들과 나란히 동작합니다. 사용자 지정 도구는 캐릭터 카드에 붙지 않습니다. 채팅에서 켜거나, 에이전트(채팅과 함께 돌아가는 보조 기능)에 붙여서 씁니다.

> **참고:** 도구를 쓰려면 도구를 지원하는 연결이 필요합니다. Claude와 Grok 구독 연결은 도구 정의를 무시하므로, **Chat Settings**(채팅 설정)에 안내가 표시되고 해당 연결의 도구 컨트롤이 비활성화됩니다. 텍스트 명령과 주사위 태그는 계속 작동합니다.

## 도구 만들기

시작하기 전에 상단 바에서 **Presets**(프리셋) 패널을 여세요. 도구는 이 패널의 **Functions**(기능) 섹션(렌치 아이콘)에 있습니다. 다른 기기에서 Marinara를 연다면 먼저 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)에 관리자 시크릿을 저장하세요. 이 값은 서버의 `ADMIN_SECRET`과 일치해야 합니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

처음이라면 **Static Result**(고정 응답)를 고르세요. 다른 준비가 필요 없습니다.

### 단계별로 도구 만들기

1. **Presets**를 열고 **Functions**를 찾으세요.
2. 더하기 아이콘인 **Create function**(함수 만들기)을 클릭하세요. 빈 도구 편집기가 열립니다.
3. `check_weather`처럼 소문자 snake_case로 이름을 입력하세요. AI가 호출할 때 쓰는 이름과 정확히 같습니다. 이름은 소문자로 시작하고, 그다음부터는 소문자, 숫자, 밑줄을 사용합니다.
4. **Description**(설명)을 채우세요. AI가 이 글을 읽고 언제 도구를 호출할지 판단하므로, AI에게 주는 지시처럼 쓰세요. 예: `Get the current weather for a city the user names.`
5. 도구에 필요한 파라미터를 추가하세요([파라미터 추가하기](#add-parameters) 참고).
6. **Execution Type**(실행 유형)을 고르세요. **Static Result**, **Webhook**(웹훅), **Script**(스크립트) 중 하나입니다.
7. 고른 유형의 입력란을 채우세요([실행 유형 고르기](#choose-an-execution-type) 참고).
8. **Save**(저장)를 클릭하세요. 버튼 근처에 초록색 **Saved**(저장됨) 표시가 잠깐 나타납니다.

이름과 설명의 규칙은 다음과 같습니다.

- 이름은 1자에서 100자까지, 설명은 1자에서 500자까지입니다.
- 두 도구가 같은 이름을 쓸 수 없고, `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search`, `update_about_me` 같은 기본 제공 이름도 쓸 수 없습니다. 이름이 겹치면 `"your_name" is a reserved built-in tool name.` 같은 메시지가 나옵니다.
- 저장하지 않은 변경 사항을 남긴 채 편집기를 벗어나면 **Keep editing**(계속 편집), **Discard**(변경 취소), **Save & close**(저장 & 닫기)를 고르는 배너가 나타납니다.

**Functions** 헤더에는 아이콘 버튼이 세 개 있습니다.

- **Create function**(더하기 아이콘)
- **Import functions from ZIP or JSON**(ZIP 또는 JSON에서 기능 가져오기)
- **Export functions to ZIP**(기능을 ZIP으로 내보내기). 도구가 없으면 회색으로 비활성화됩니다.

목록의 각 도구에는 다음이 표시됩니다.

- 이름, 유형, 파라미터 개수와 설명
- 켜기/끄기 스위치
- **Edit function**(함수 편집)과 **Delete Function**(함수 삭제)

손잡이를 끌어 목록 순서를 바꿀 수 있습니다. 순서는 표시용일 뿐입니다. 도구가 없으면 목록에 **No functions yet**(아직 기능이 없습니다)이 표시됩니다.

<a id="add-parameters"></a>

## 파라미터 추가하기

파라미터는 AI가 도구를 호출할 때 보내는 입력값입니다. 각 파라미터에는 이름, 유형, 필수 여부, 설명이 있습니다.

1. **Parameters**(파라미터) 그룹에서 **Add Parameter**(매개변수 추가)를 클릭하세요.
2. `city`처럼 이름을 입력하세요.
3. 유형을 고르세요. `string`, `number`, `boolean`, `array`, `object` 중 하나입니다.
4. AI가 이 값을 항상 보내야 한다면 **Required**(필수)를 켜세요.
5. `The city name to look up, such as Tokyo.`처럼 그 값이 무엇을 뜻하는지 AI에게 알려 주는 설명을 쓰세요.

**Add Parameter**로 줄을 더 추가하거나, 각 줄의 빼기 버튼으로 줄을 지울 수 있습니다. 이름이 비어 있는 줄은 저장할 때 사라집니다.

가져온 도구를 AI가 전혀 호출하지 않는 것 같다면 파라미터가 올바르지 않을 수 있습니다. 이때 앱은 알리지 않고 그 도구를 건너뜁니다. 파라미터를 지우고 직접 다시 추가하세요.

<a id="choose-an-execution-type"></a>

## 실행 유형 고르기

### Static Result

**Static Result** 도구는 매번 같은 문구를 돌려줍니다. 바깥 서비스가 필요 없습니다. 카드에는 **Returns a fixed string when called.**라고 적혀 있습니다.

입력란은 여러 줄을 넣을 수 있는 상자인 **Static Result** 하나뿐입니다. 비워 두면 도구는 `OK`를 돌려줍니다.

예: 파라미터가 없는 `store_hours`라는 도구에 다음 **Static Result**를 넣습니다.

```text
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

AI가 `store_hours`를 호출하면 그 문구를 도구 이름 및 자신이 보낸 인자와 함께 받고, 사용자에게 영업시간을 알려 줄 수 있습니다.

### Webhook

**Webhook** 도구는 호출 내용을 웹 주소로 보내고 그 서비스의 답을 AI에게 돌려줍니다. 웹훅은 데이터를 받아서 데이터를 돌려주는 주소입니다. 카드에는 **Sends a POST request to an external URL.**이라고 적혀 있습니다.

입력란은 **Webhook URL**(웹훅 URL) 하나뿐입니다. 앱은 POST 요청을 보냅니다. POST 요청은 웹 서비스에 데이터를 보내는 방식입니다. 본문은 구조화된 데이터를 담는 일반 텍스트 형식인 JSON이며, 모양은 다음과 같습니다.

```json
{ "tool": "your_tool_name", "arguments": { ... } }
```

**Include hidden chat context**(숨겨진 채팅 컨텍스트 포함)를 켜면 본문에 `context` 값도 들어갑니다. 서비스는 JSON이나 일반 텍스트로 답하고, 그 답이 AI에게 돌아갑니다.

예: 필수 string 파라미터 `city` 하나를 가진 `check_weather`라는 도구에 다음 **Webhook URL**을 넣습니다.

```text
https://api.example.com/weather
```

AI가 `city`를 Tokyo로 지정해 호출하면 서비스가 날씨를 찾아보고 답하며, AI는 그 답을 메시지에 활용합니다.

제한은 다음과 같습니다.

- 답의 크기는 512 KB로 제한됩니다.
- 호출마다 시간 제한이 있습니다. 기본값은 60초입니다(`CUSTOM_TOOL_TIMEOUT_MS`).
- 기본적으로 `https://` 주소만 허용됩니다. `localhost`나 가정용 네트워크 주소 같은 사설 주소와 로컬 주소는 서버 관리자가 허용하기 전까지 차단됩니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.
- 호출이 실패하거나 시간이 초과되면 AI가 오류 결과를 받고, 채팅은 계속 진행됩니다.

작동하지 않는 경우: 주소가 `https://`로 시작하고 접속 가능한지 확인하세요. 로컬 주소는 관리자가 허용하지 않으면 계속 차단됩니다. 느린 서비스는 60초 제한에 걸릴 수 있습니다.

### Script

**Script** 도구는 서버에서 짧은 JavaScript 코드를 실행하고 결과를 돌려줍니다. JavaScript는 널리 쓰이는 프로그래밍 언어입니다. 카드에는 **Runs a JavaScript expression server-side.**라고 적혀 있습니다.

스크립트 도구는 기본적으로 꺼져 있습니다. 서버에서 켜지 않았다면 **Script** 카드가 회색으로 비활성화되고 주황색 **Script disabled**(스크립트 비활성화됨) 표시가 나타납니다. 켜려면 서버 관리자가 서버의 `.env` 파일에 다음 줄을 넣고 Marinara를 다시 시작해야 합니다.

```text
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

입력란은 **Script Body**(스크립트 본문) 하나뿐입니다. 스크립트는 `args`(AI가 보낸 값)를 읽고, 결과를 반드시 `return`해야 합니다. `JSON`, `Math`, `Date`를 사용할 수 있습니다.

예: 필수 number 파라미터 `x`와 `y`를 가진 `add_numbers`라는 도구에 다음 **Script Body**를 넣습니다.

```js
const result = args.x + args.y;
return { sum: result };
```

AI가 `x`를 2로, `y`를 3으로 지정해 호출하면 도구는 합계 5를 돌려줍니다. 스크립트에서 오류가 나면 AI가 오류 결과를 받습니다.

스크립트는 서버에서 실제 코드를 샌드박스(코드가 할 수 있는 일을 제한하는 격리 공간) 안에서 실행합니다.

- 네트워크 접근과 파일 접근이 없습니다.
- 환경 변수나 서버 시크릿에 접근할 수 없습니다.
- 시간 제한이 있습니다. 기본값은 60초입니다.

샌드박스는 운영체제 수준의 완전한 격리가 아닙니다. 도구를 만들 수 있는 사람은 여전히 CPU나 메모리를 낭비하는 스크립트를 작성할 수 있습니다. 스크립트 도구는 믿을 수 있는 서버에서만 켜고, 다른 사람이 작성한 스크립트는 주의해서 다루세요.

작동하지 않는 경우: **Script** 카드가 회색으로 비활성화되어 있다면 관리자에게 `CUSTOM_TOOL_SCRIPT_ENABLED=true`를 설정하고 다시 시작해 달라고 요청하세요.

### 숨겨진 채팅 컨텍스트 포함하기

**Webhook** 도구와 **Script** 도구는 AI가 도구 입력값으로 보지 않는 추가 채팅 데이터를 받을 수 있습니다. 도구 편집기에서 **Include hidden chat context**를 켜세요(기본값은 꺼짐). 그러면 도구가 받는 `context` 값에 다음이 들어갈 수 있습니다.

- 채팅 모드
- 사용 중인 페르소나 이름과 캐릭터 이름
- 저장된 채팅 변수
- Game Mode(게임 모드)에서는 게임 상태

덕분에 AI가 그 데이터를 모두 넘기지 않아도 도구가 결과를 상황에 맞게 다듬을 수 있습니다.

## 채팅에서 도구 사용 켜기

도구를 만들었다고 해서 AI가 바로 쓰지는 않습니다. 채팅에서 도구 사용도 켜야 합니다.

1. 채팅을 열고 **Chat Settings**를 여세요.
2. **Function Calling**(기능 호출) 섹션(렌치 아이콘)을 여세요.
3. **Enable Tool Use**(도구 사용 활성화)를 켜세요. 설명에는 **Allow AI to call functions (dice rolls, game state, etc.)**라고 적혀 있습니다. 새 채팅에서는 기본적으로 꺼져 있습니다.
4. 작동하는지 확인하세요. `store_hours` 예제라면 "What are your store hours?"처럼 도구가 답할 수 있는 질문을 AI에게 하세요. 답변에 도구의 문구가 쓰여야 합니다.

**Enable Tool Use**를 켜고 그 아래에 아무것도 추가하지 않으면, 채팅은 지원하는 전역 활성화 도구를 모두 사용할 수 있습니다. 기본 제공 도구와, **Functions**에서 스위치를 켠 모든 사용자 지정 도구입니다. Game 채팅에서 `search_lorebook`을 쓰려면 **Let the GM search lore**(게임 마스터의 로어 검색 허용)도 필요합니다.

채팅에서 쓸 도구를 골라 제한하려면 다음과 같이 하세요.

1. **Add Functions**(함수 추가)를 클릭하세요. 도구 이름만 검색하는 검색 상자가 있는 선택 창이 열립니다.
2. 원하는 도구를 체크하세요. 목록에는 기본 제공 도구와 사용자 지정 도구가 섞여 있습니다.
3. **Add Selected**(선택 항목 추가)를 클릭하세요.

도구를 하나라도 추가하면 그 채팅에서는 추가한 도구만 작동합니다. 선택 창의 **New Custom Function**(새 사용자 지정 함수)은 도구 편집기로 바로 이동합니다.

Game 채팅은 도구 계획에 별도의 연결을 쓸 수 있습니다. 비용과 동작은 [선택적 도구 계획과 로어 검색](../game/getting-started.md#optional-tool-planning-and-lore-searches)을 참고하세요.

작동하지 않는 경우: **Enable Tool Use**가 켜져 있는지, 특정 도구를 추가했다면 그 도구가 채팅 목록에 있는지, **Functions**에서 도구의 스위치가 켜져 있는지 확인하세요. **Description**과 파라미터 설명을 더 분명하게 쓰면 AI가 언제 도구를 호출할지 판단하는 데 도움이 됩니다.

## 에이전트에 도구 붙이기

채팅 대신 에이전트에 도구를 줄 수도 있습니다.

1. **Agents**(에이전트) 패널을 열고 에이전트를 하나 여세요.
2. 에이전트의 **Tools / Function Calling**(도구 / 기능 호출) 그룹을 여세요.
3. 그 에이전트가 쓸 수 있는 도구를 켜세요.

그래도 채팅의 **Function Calling** 섹션에서 **Enable Tool Use**를 켜야 합니다. 에이전트 편집기 아래쪽에도 이 안내가 있습니다. 에이전트 전반은 [사용자 지정 에이전트 만들기](../agents/custom-agents.md)를 참고하세요.

## 도구 내보내기와 가져오기

- 도구 하나를 내보내려면 그 도구를 열고 **Export function**(함수 내보내기)을 클릭하세요. `.json` 파일로 저장됩니다.
- 도구 전체를 내보내려면 **Export functions to ZIP**을 클릭하세요.
- 가져오려면 **Import functions from ZIP or JSON**을 클릭하고 `.json` 또는 `.zip` 파일을 고르세요. 몇 개를 가져왔는지 메시지로 알려 줍니다.

가져온 웹훅 도구와 스크립트 도구는 파일이 둘 중 무엇을 요청하더라도 항상 꺼진 상태로, **Include hidden chat context**도 꺼진 채로 저장됩니다. 그런 다음 Marinara는 유형, 웹훅 주소, 파일이 요청한 권한을 보여 줍니다. 가져온 도구를 하나씩 열어 확인하고, 믿을 수 있을 때만 켜세요. Static 도구는 가져온 켜기/끄기 상태를 그대로 유지합니다.

가져오기는 기존 도구나 기본 제공 도구와 이름이 겹치는 도구를 건너뜁니다. 에이전트 패키지에는 사용자 지정 도구가 함께 담기지 않습니다. 도구는 따로 내보내 검토한 다음, 에이전트를 가져온 뒤 붙이세요.

## 관련 가이드

- [사용자 지정 에이전트 만들기](../agents/custom-agents.md)
- [Home Assistant 연동](../integrations/home-assistant.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
