# 프롬프트 매크로

이 가이드에서는 Marinara Engine의 프롬프트 매크로를 설명합니다. 매크로는 Marinara가 실제 값으로 바꿔 넣는 짧은 `{{tag}}` 표기입니다. 값은 프롬프트를 만드는 시점에 채워지며, 이름이나 오늘 날짜처럼 그때그때 달라지는 정보가 들어갑니다. 기본 제공 매크로 전부와 매크로를 입력할 수 있는 위치, 피해야 할 실수를 알 수 있습니다.

## 매크로란 무엇이고 어디에서 동작하는가

매크로는 `{{user}}`, `{{char}}`처럼 중괄호 두 개로 감싼 글자 그대로의 텍스트입니다. Marinara는 AI에 보낼 텍스트를 만들 때 이 표기를 찾아 각각을 현재 값으로 바꿉니다. 매크로를 켜고 끄는 스위치는 없습니다. 매크로를 지원하는 입력란이라면 언제나 값을 치환합니다.

기본 제공 매크로의 이름은 대소문자를 구분하지 않습니다. 그래서 `{{user}}`와 `{{USER}}` 둘 다 동작합니다.

앱 곳곳에서 매크로를 입력할 수 있습니다.

- **Character Editor**(캐릭터 편집기)의 캐릭터 필드: Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions, 그리고 **Depth Prompt**(깊이 주입 프롬프트).
- **Persona Editor**(페르소나 편집기)의 페르소나 필드(카드 필드가 같습니다).
- 로어북 항목의 Description 및 Content 필드.
- **Preset Editor**(프리셋 편집기)의 프롬프트 프리셋 섹션.
- 정규식 스크립트의 Find, Replace, Trim 필드.
- 에이전트 프롬프트 템플릿.
- 채팅 입력란. 메시지에 `{{roll:1d20}}`을 입력하면 메시지를 보내기 전에 값이 치환됩니다.

매크로 값 안에 다른 매크로가 들어 있어도 Marinara가 그 매크로까지 치환합니다.

## 시작하기 전에

따로 준비할 것은 없습니다. 기본 제공 매크로는 API 키도, 추가 연결도 없이 바로 동작합니다. API 키는 Marinara가 AI 제공자와 통신할 수 있게 해 주는 비밀 문자열이지만, 매크로는 Marinara 안에서 자체적으로 처리됩니다.

다만 매크로 기능 2가지는 앱의 다른 부분에 의존합니다.

- 프리셋 변수(`{{NAME}}` 포괄 표기)는 이를 정의한 프롬프트 프리셋이 있어야 합니다. [프리셋 변수](preset-variables.md)를 참고하세요.
- 에이전트 매크로 `{{agent::TYPE}}`는 해당 에이전트가 실행되어 출력을 만들어 낸 뒤에야 텍스트를 보여 줍니다.

## 정체성, 캐릭터, 페르소나 매크로

이 매크로들은 말하는 쪽과 대답하는 캐릭터의 이름 및 카드 필드를 끌어옵니다. user는 나 자신(또는 활성 페르소나)이고, character는 대답하는 봇입니다.

| 매크로 | 치환 결과 |
| --- | --- |
| `{{user}}` / `{{userName}}` | 현재 표시 이름(또는 페르소나 이름). 페르소나를 설정하지 않았으면 기본값은 `User`입니다. |
| `{{userNamePhonetic}}` | 페르소나의 Phonetic 이름. 비어 있으면 `{{user}}`입니다. |
| `{{char}}` / `{{charName}}` | 현재 캐릭터의 이름. 기본값은 `Character`입니다. |
| `{{<21-character-card-ID>}}` | 다른 캐릭터 카드의 이름을 넣는 자리 표시 구문. 꺾쇠괄호 부분을 그 카드의 21자 ID로 바꾸세요. |
| `{{persona-21-character-card-ID}}` | 다른 페르소나 이름을 참조하는 자리 표시 구문입니다. 카드 컨텍스트를 가져오려면 `persona-` 뒤를 해당 카드의 정확한 21자 ID로 바꾸세요. |
| `{{charNamePhonetic}}` | 캐릭터의 Phonetic 이름. 비어 있으면 `{{char}}`입니다. |
| `{{characters}}` | 채팅에 있는 모든 캐릭터를 쉼표로 이어 붙입니다. |
| `{{group}}` | 그룹 채팅에서 지금 응답 중인 캐릭터를 뺀 나머지 활성 캐릭터 전부. 페르소나는 이 캐릭터 명단에 포함되지 않습니다. |
| `{{persona}}` | 페르소나의 Description, Personality, Backstory, Appearance, Scenario를 줄바꿈으로 이어 붙입니다. |
| `{{personaDescription}}` | 페르소나의 Description 필드. |
| `{{personaPersonality}}` | 페르소나의 Personality 필드. |
| `{{personaBackstory}}` | 페르소나의 Backstory 필드. |
| `{{personaAppearance}}` | 페르소나의 Appearance 필드. |
| `{{personaScenario}}` | 페르소나의 Scenario 필드. |

다음 캐릭터 필드 매크로는 현재 캐릭터의 카드를 읽습니다.

| 매크로 | 캐릭터 카드 필드 |
| --- | --- |
| `{{description}}` | Description |
| `{{personality}}` | Personality |
| `{{backstory}}` | Backstory |
| `{{appearance}}` | Appearance |
| `{{scenario}}` | Scenario |
| `{{example}}` | Example Dialogue |
| `{{charSysInfo}}` | System Prompt |
| `{{charPostHistory}}` | Post-History Instructions |

캐릭터가 한 명인 채팅에서는 그 캐릭터를 기준으로 치환됩니다. 그룹 채팅에서는 기본적으로 첫 번째 캐릭터를 기준으로 치환됩니다. 캐릭터마다 같은 텍스트를 반복하려면 대괄호 그룹 블록 안에 넣으세요. 그룹 블록은 [조건부 프롬프트](conditional-prompts.md)에서 설명합니다.

`{{group}}`은 개별 그룹 생성 중에도 지금 응답하는 캐릭터를 따라갑니다. 예를 들어 Powers That Be, Maukie, Pantalone가 있는 Roleplay 그룹에서 Pantalone가 응답 중이라면 `{{group}}`은 `Powers That Be, Maukie`로 치환됩니다. 이름이 `{{user}}`와 우연히 같더라도 캐릭터 카드는 이 명단에 그대로 남습니다.

Phonetic 이름 필드는 2가지 역할을 합니다. 음성 합성이 이름을 어떻게 발음할지 정하고, `{{charNamePhonetic}}`과 `{{userNamePhonetic}}`에도 값을 공급합니다. 이 필드는 **Character Editor**와 **Persona Editor** 양쪽에 있습니다.

현재 채팅에 없는 캐릭터를 참조하려면 그 카드의 ID를 복사해 중괄호 두 개 안에 그대로 넣으세요. 예를 들면 `{{V1StGXR8_Z5jdHi6B-myT}}`입니다. Marinara는 이 매크로를 카드 이름으로 바꾸고, 참조한 카드의 캐릭터 컨텍스트를 시스템 프롬프트에 추가합니다. 참조한 카드의 첫 인사말과 예시 대화는 제외됩니다. 그 카드에 연결된 활성 로어북은 평소와 같이 키워드, **Constant**, 필터, 확률, 토큰 예산 규칙을 그대로 따릅니다.

현재 선택되지 않은 페르소나를 참조하려면 복사한 ID 앞에 `persona-`를 붙이세요. 예: `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara는 매크로를 페르소나 이름으로 바꾸고 Description, Personality, Appearance, Backstory, Scenario 필드를 ID Macro Cards에 추가합니다. 연결된 로어북은 평소의 활성화 규칙을 따릅니다.

## Conversation 모드 매크로

이 4가지 매크로는 Conversation Mode에서만 동작합니다. 다른 모드에서는 같은 카드나 프리셋 텍스트를 여러 모드에서 공유하더라도 항상 빈 값으로 치환됩니다.

| 매크로 | 치환 결과 |
| --- | --- |
| `{{convo_display}}` | 캐릭터의 **Convo Display Name**(Conversation 표시 이름). 비어 있으면 카드 이름입니다. |
| `{{char_about}}` | 캐릭터의 현재 **About Me**(채팅별 재정의가 있으면 그 값, 없으면 카드 기본값). |
| `{{persona_about}}` | 페르소나의 현재 About Me. |
| `{{convo_behavior}}` | 캐릭터의 **Convo Behavior**(Conversation 동작) 텍스트. 단, 삽입 설정이 이 매크로 위치에 넣도록 되어 있을 때만 나옵니다. |

이 필드들은 **Character Editor**와 **Persona Editor**의 **Convo** 탭에서 편집합니다. 전체 설정 방법은 [Conversation Mode 프로필(Display Name, About Me, Behavior)](../conversation/profiles.md)를 참고하세요.

## Conversation 배치 매크로

Conversation Mode는 여러 블록을 프롬프트에 자동으로 넣어 줍니다. 이 매크로들을 쓰면 프리셋에서 그 블록을 원하는 위치로 **옮길** 수 있습니다. 매크로를 사용하면 Marinara는 해당 블록을 매크로 자리에 렌더링하고 자동 삽입은 **건너뜁니다**. 그래서 내용이 중복되지 않습니다. 각 매크로에는 별칭이 하나 이상 있고, 모든 별칭은 동작이 같습니다.

| 매크로(및 별칭) | 삽입되는 내용 |
| --- | --- |
| `{{context}}`, `{{status}}` | 대화 컨텍스트 / 상태 블록. |
| `{{commands}}`, `{{commandList}}` | 사용 가능한 명령어 안내. |
| `{{reactRules}}`, `{{emojiReact}}` | 사용자 지정 이모지 **반응** 규칙. |
| `{{replyRules}}` | 사용자 지정 이모지 및 스티커 **답장** 규칙. |
| `{{memories}}`, `{{memoryRecall}}` | 기억 회상 블록. |
| `{{lorebook}}`, `{{lore}}` | 로어북 주입. |

이 매크로들은 Conversation Mode에서만 적용됩니다. 캐릭터가 한 명인 대화에서 `{{char_about}}` / `{{persona_about}}`(위 참고)로 참가자 소개를 직접 배치할 때도 방식은 같습니다. Marinara는 자동 참가자 "about me" 블록을 건너뛰므로 소개가 두 번 들어가지 않습니다. 그룹 대화에서는 자동 참가자 블록이 그대로 유지됩니다. 단수형 매크로는 참가자 한 명만 담당하므로 나머지 참가자의 소개를 가려서는 안 되기 때문입니다.

## 컨텍스트 매크로

다음 매크로들은 현재 채팅과 현재 요청의 정보를 나타냅니다.

| 매크로 | 치환 결과 |
| --- | --- |
| `{{input}}` | 프롬프트에서 사용할 수 있는 가장 최근 user 메시지. |
| `{{model}}` | 모델을 선택한 경우 현재 모델 이름. |
| `{{chatId}}` | 현재 채팅의 ID. |
| `{{lastGenerationType}}` | 이 답변을 생성하는 이유를 나타내는 라벨. |
| `{{idle_duration}}` | 마지막 채팅 활동 이후 지난 시간. `8 minutes`, `1 hour 5 minutes` 같은 텍스트입니다. |
| `{{gameStoryboardKeyframeCount}}` | Game Mode의 현재 **Keyframes per Turn**(턴당 키프레임 수) 목표값. 1에서 6까지이며 기본값은 `3`입니다. |
| `{{agent::TYPE}}` | 지정한 종류의 에이전트가 저장한 출력. |

`{{lastGenerationType}}`의 값은 단순한 라벨입니다. 앱에서 볼 수 있는 값의 예로는 `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan`, `retry_agents`가 있습니다. 이 목록은 늘어날 수 있으므로 고정된 집합이 아니라 예시로 봐 주세요.

`{{gameStoryboardKeyframeCount}}`는 기본 제공 **Storyboard Game Prompt**를 포함한 Game Mode의 GM 프롬프트에 전달됩니다. 이 값은 서술의 목표치일 뿐, 정확히 그만큼의 문단을 요구하는 것은 아닙니다. 해당 턴에 시각적으로 구분되는 순간이 충분하지 않으면 스토리보드 플래너는 그보다 적은 컷을 반환합니다.

`{{agent::TYPE}}` 매크로는 에이전트가 저장한 출력을 넣습니다. 에이전트는 장면 트래커 같은 항목을 뒤에서 채워 주는 보조 기능입니다. 가장 쉬운 추가 방법은 **Preset Editor**를 쓰는 것입니다. **Add Section**(섹션 추가)을 클릭하고 **Agent Sections**(에이전트 섹션) 그룹을 연 다음 에이전트를 고르세요. 그러면 Marinara가 알맞은 `{{agent::TYPE}}` 표기가 이미 들어 있는 섹션을 만들어 줍니다. 이 매크로는 가장 마지막에 치환되므로, 에이전트가 만든 텍스트가 프롬프트에 매크로를 더 끼워 넣을 수는 없습니다.

## 로어북 Outlet 매크로

`{{outlet::name}}`은 **Position**(위치)이 **Outlet**이고 **Outlet name**이 `name`과 정확히 일치하는 로어북 항목의 내용을 넣습니다. Outlet 이름은 대소문자를 구분합니다. 예를 들어 `{{outlet::character_rules}}`는 `Character_Rules`라는 이름의 Outlet과 일치하지 않습니다.

Outlet 항목도 평소와 같은 로어북 활성화 방식을 따릅니다. 키워드, Constant 모드, 확률, 필터, 타이밍, 항목 개수 제한, 토큰 예산이 이번 생성에서 그 항목을 활성화할지 결정합니다. Outlet 이름이 같은 활성 항목들은 **Order**(순서) 순서대로 줄바꿈으로 구분해 이어 붙입니다. 이 내용은 매크로 자리에만 들어가며, 일반 로어북 위치에 다시 추가되지는 않습니다.

Outlet 매크로는 Conversation, Roleplay, Game 모드의 프롬프트 섹션에서 쓸 수 있습니다. 프리셋의 로어북 표시자보다 앞에 두어도 동작하고, Outlet 항목만 쓴다면 프리셋에 로어북 표시자가 없어도 됩니다. 알 수 없거나 활성화되지 않은 Outlet은 빈 값으로 치환됩니다. Outlet 항목은 다른 Outlet 매크로를 펼치지 못하므로 중첩된 Outlet은 재귀하지 않습니다.

## 시간 매크로

모든 시간 매크로는 한 번의 치환에서 같은 시각 하나를 읽으므로 서로 값이 어긋나지 않습니다. 시간대는 브라우저에서 가져옵니다.

| 매크로 | 치환 결과 |
| --- | --- |
| `{{date}}` | 오늘 날짜. `YYYY-MM-DD` 형식입니다. |
| `{{time}}` | 현재 시각. 24시간제 `HH:MM` 형식입니다. |
| `{{datetime}}` / `{{isotime}}` | 시간대 오프셋이 포함된 전체 타임스탬프. 두 이름은 같은 뜻입니다. |
| `{{weekday}}` | `Monday` 같은 요일 이름. |
| `{{timezone}}` | `Europe/Warsaw` 같은 시간대 이름. |

## 무작위 및 주사위 매크로

이 매크로들은 프롬프트에 우연 요소를 더합니다. 숫자와 선택지에는 무작위 매크로(`{{random}}`)를, 주사위에는 굴림 매크로(`{{roll}}`)를 쓰세요.

| 매크로 | 동작 |
| --- | --- |
| `{{random}}` | 0에서 100까지의 무작위 정수. |
| `{{random:X:Y}}` | X와 Y 사이의 무작위 정수. 양 끝값을 포함합니다. |
| `{{random::A::B::C}}` | 선택지 하나를 무작위로 고른 뒤, 고른 선택지 안의 매크로만 치환합니다. |
| `{{random::A@2::B@0.5}}` | 가중치를 준 무작위 선택. 아래 가중치 규칙을 참고하세요. |
| `{{roll:XdY}}` | 주사위 굴림 합계. 예를 들어 `{{roll:2d6}}`은 6면체 주사위 2개를 굴려 더합니다. |

그대로 복사해 쓸 수 있는 간단한 무작위 선택 예시입니다.

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### 가중치를 준 선택

선택지 끝에 `@숫자`를 붙이면 뽑힐 가능성을 정할 수 있습니다. 이 숫자는 상대적인 가중치이고, 클수록 잘 뽑힙니다.

```text
{{random::Common event@1::Rare event@0.25}}
```

이 예시에서는 가중치 합계가 1.25이므로 확률은 다음과 같습니다.

| 선택지 | 가중치 | 확률 |
| --- | --- | --- |
| Common event | 1 | 80% |
| Rare event | 0.25 | 20% |

가중치 규칙입니다.

- 가중치를 적지 않으면 1로 봅니다.
- 0.5, 0.01처럼 소수 가중치도 쓸 수 있습니다.
- 가중치가 0이면 선택지는 남아 있지만 절대 뽑히지 않습니다.
- 모든 선택지의 가중치가 0이면 매크로는 빈 값으로 치환됩니다.
- 맨 끝의 `@숫자`만 가중치로 인식합니다. 이메일 주소처럼 다른 자리에 있는 `@`는 그대로 둡니다.

## 동적 변수

변수를 쓰면 프롬프트의 한 부분에 값을 저장해 두고 뒷부분에서 읽을 수 있습니다.

| 매크로 | 동작 |
| --- | --- |
| `{{setvar::name::value}}` | 값을 저장하고 텍스트에는 아무것도 남기지 않습니다. |
| `{{getvar::name}}` | 저장한 값을 읽습니다(설정한 적이 없으면 빈 값). |
| `{{addvar::name::value}}` | 두 값이 모두 숫자면 더하고, 아니면 텍스트를 뒤에 붙입니다. |
| `{{addnumvar::name::value}}` | 항상 숫자로 더하는 Marinara 확장입니다. 없거나 올바르지 않은 값은 0으로 처리하고 오버플로는 무시합니다. |
| `{{incvar::name}}` | 숫자 변수에 1을 더하고 새 값을 삽입합니다. |
| `{{decvar::name}}` | 숫자 변수에서 1을 빼고 새 값을 삽입합니다. |

변수는 한 번의 프롬프트 생성 안에서 왼쪽부터 오른쪽으로 치환되고 현재 채팅에 저장됩니다. 앞쪽에서 설정한 값, 예컨대 먼저 오는 로어북 항목에서 설정한 값은 같은 프롬프트의 뒤쪽에서 읽을 수 있습니다. SillyTavern의 로컬 변수처럼 이후 턴과 재시작 뒤에도 유지되지만 다른 채팅으로 퍼지지는 않습니다.

기본 제공 매크로가 아닌 `{{NAME}}`은 프리셋 변수로 보고 이름으로 찾습니다. 그 이름의 변수가 없으면 입력한 그대로 텍스트에 남습니다. 정의하는 방법은 [프리셋 변수](preset-variables.md)를 참고하세요.

## 서식 매크로

다음 매크로들은 주변 텍스트의 모양을 다듬습니다.

| 매크로 | 동작 |
| --- | --- |
| `{{newline}}` / `{{\n}}` | 줄바꿈을 넣습니다. |
| `{{trim}}` | 자기 자신을 없애고 그 자리 앞뒤의 공백을 정리합니다. |
| `{{trimStart}}` | 주변 텍스트 앞쪽의 공백을 정리합니다. |
| `{{trimEnd}}` | 주변 텍스트 뒤쪽의 공백을 정리합니다. |
| `{{uppercase}}...{{/uppercase}}` | 감싼 텍스트를 대문자로 바꿉니다. |
| `{{lowercase}}...{{/lowercase}}` | 감싼 텍스트를 소문자로 바꿉니다. |
| `{{noop}}` | 출력에서 사라집니다. 편집하는 동안 아무 영향 없는 자리 표시로 쓰기 좋습니다. |
| `{{// comment}}` | 출력에서 사라지는 작성자용 메모. |
| `{{banned "text"}}` | 출력에서 사라집니다. 무언가를 걸러 내거나 막지는 않습니다. |

## 중괄호 두 개를 그대로 보여 주기

매크로에는 이스케이프 문자가 없습니다. 중괄호 두 개를 텍스트에 그대로 남기고 싶다면 Marinara가 모르는 이름을 쓰세요. 알 수 없는 `{{name}}`은 같은 이름의 프리셋 변수가 없는 한 입력한 그대로 남습니다. AI에 절대 전달되지 않는 개인 메모가 필요하다면 `{{// like this}}`를 쓰세요.

## Macro reference와 /macros

매크로를 지원하는 입력란에는 모퉁이에 작은 버튼 2개가 있습니다.

- **Expand editor**(편집기 펼치기)는 그 입력란을 더 큰 편집 창으로 엽니다.
- **Macro reference**(매크로 참조)는 **Macro reference**라는 제목의 창을 엽니다. 기본 제공 매크로를 분류별로 정확한 구문과 함께 모두 보여 줍니다. 이 목록은 엔진이 쓰는 것과 같은 원본에서 생성되므로 항상 정확합니다.

채팅 입력란에 `/macros`를 입력할 수도 있습니다(짧은 형태인 `/macro`도 동작합니다). 전체 매크로 목록을 채팅에 바로 출력해 간단히 확인할 수 있습니다.

조건부 블록에서는 `||`(OR), `&&`(AND), 괄호로 비교식을 조합할 수 있습니다. 같음 비교를 나열할 때는 `{{#if character == "Maukie" || "Pantalone"}}` 같은 축약 형태도 쓸 수 있습니다. 연산 우선순위, 그룹 채팅 예시, 전체 연산자 목록은 [조건부 프롬프트](conditional-prompts.md)를 참고하세요.

## 자주 하는 실수

- `{{random::...}}` 블록 안에 변수를 쓰지 마세요. 무작위 선택지 안의 `{{setvar}}`는 선택이 이루어지기 전에 모든 선택지에서 실행됩니다. 뽑힌 선택지에서만 실행되는 것이 아닙니다.
- 로컬 변수를 전역 변수처럼 사용하지 마세요. `{{setvar}}` 값은 현재 채팅에만 유지되며 다른 채팅에는 각각 별도의 값이 있습니다.
- `{{prompt}}`는 매크로가 아닙니다. 메시지 전체가 `{{prompt}}`이면 Marinara는 메시지를 보내는 대신 **Peek Prompt**(프롬프트 미리보기) 뷰어를 엽니다. [Peek Prompt](../chats/peek-prompt.md)를 참고하세요.
- Custom Tools는 `{{macro}}` 텍스트를 쓰지 않습니다. 도구 입력란에 `{{roll:1d20}}`을 붙여넣고 치환되기를 기대하지 마세요.
- **Impersonate**(유저 사칭) 프롬프트 템플릿은 전체 매크로 목록이 아니라 몇 가지 자리 표시만 받습니다. 이름 체계도 달라서 카드에서 되던 매크로가 거기서는 안 될 수 있습니다.
- 매크로 출력이 아주 크거나 깊게 중첩되면 조용히 잘립니다. 오류도 표시되지 않으니 매크로가 펼쳐지는 양을 적당히 유지하세요.

## 관련 가이드

- [조건부 프롬프트](conditional-prompts.md)
- [프리셋 변수](preset-variables.md)
- [Preset Editor와 프롬프트 관리](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)
- [Conversation Mode 프로필(Display Name, About Me, Behavior)](../conversation/profiles.md)
