# 지침 기반 생성과 Impersonate

채팅의 흐름을 조종하는 두 가지 방법입니다. 지침 기반 생성은 화면에 메시지를 올리지 않고 다음 답변의 방향을 정해 줍니다. Impersonate(유저 사칭)는 내 답장을 모델이 대신 쓰게 합니다. Quick replies(퀵 리플라이) 메뉴는 두 기능을 **Send**(전송) 옆에 모아 둡니다.

## /guided로 답변 방향 잡기

지침은 캐릭터 밖에서 하는 말입니다. 답변의 방향을 잡아 줄 뿐, 채팅 메시지로는 표시되지 않습니다.

1. 메시지 입력란에 `/guided`와 원하는 방향을 입력하세요.
2. <kbd>Enter</kbd>를 누르거나 **Send**를 클릭하세요.

모델이 그 방향에 맞춰 다음 답변을 씁니다. 예를 들면 다음과 같습니다.

```text
/guided make him admit he is lying
```

`/guided` 대신 `/narrator`, `/narrate`, `/nar` 중 하나를 입력해도 됩니다. 그룹 채팅에서는 `respond as`, `reply as`, `respond for`로 한 캐릭터를 지목해 방향을 줄 수 있습니다.

```text
/guided respond as Alice make her admit she is lying
```

## 재생성에 지침 적용하기

메시지 입력란에 적어 둔 글을 한 번의 재생성에만 쓰는 지침으로 활용합니다.

1. **Settings → Advanced → Message Tools**(설정 → 고급 → 메시지 도구)를 열고 **Guide swipes/regens with chat input**(채팅 입력으로 스와이프/재생성 안내)을 켜세요. 기본값은 꺼짐입니다.
2. 채팅에서 메시지 입력란에 방향을 입력하되, 보내지는 마세요.
3. AI 메시지에서 **Regenerate**(재생성)를 클릭하세요. 입력란에 글이 있으면 버튼 라벨이 **Regenerate (guided)**로 표시됩니다.

적어 둔 방향은 재생성한 뒤에도 입력란에 남아 있으므로, 고쳐서 다시 재생성할 수 있습니다. 대신 입력란을 비우려면 **Settings → General → Input & Editing**(설정 → 일반 → 입력 및 편집)에서 **Keep guidance after regenerating**(재생성 후 지침 유지)을 끄세요.

작동하지 않는 경우: 버튼 라벨이 **Regenerate (guided)**여야 합니다. **Regenerate**라고만 표시되면 설정이 꺼져 있거나 입력란이 비어 있는 것입니다.

<a id="read-stored-guidance"></a>

## 저장된 지침 확인하기

Marinara는 답변의 방향을 잡은 지침을 저장해 둡니다.

1. AI 메시지에서 **Stored guidance**(저장된 지침) 아이콘(두루마리)을 클릭하세요.
2. **Stored guidance** 창에 그 방향이 표시됩니다.

창에는 방향이 어디에서 왔는지가 표시됩니다. **/guided**, **Guided regenerate**(유도 재생성), Game Mode(게임 모드) 설정 단계를 뜻하는 **Game start**(게임 시작) 중 하나입니다. `/guided`와 유도 재생성으로 준 방향에서는 **Copy /guided**(/guided 복사)가 바로 쓸 수 있는 `/guided` 명령어를 복사합니다. 이 명령어는 다른 채팅에 붙여 넣을 수 있습니다.

## Impersonate로 내 답장 쓰기

Impersonate는 내 다음 메시지를 모델이 페르소나의 말투로 대신 쓰게 합니다. 페르소나는 내가 연기하는 캐릭터이며, `{{user}}`로 표기됩니다. [사용자 페르소나](../characters/personas.md)를 참고하세요.

시작하기 전에: Impersonate는 Roleplay(롤플레이) 채팅에서만 작동합니다. Conversation(대화)에서는 "Impersonate is not available in Conversation mode."라는 메시지가 표시됩니다. Game에서도 쓸 수 없습니다.

1. 메시지 입력란에 `/impersonate`를 입력하세요. 원하면 뒤에 방향을 덧붙이세요.
2. <kbd>Enter</kbd>를 누르거나 **Send**를 클릭하세요.

모델이 페르소나로서 유저 메시지를 올립니다. 예를 들어 다음 명령은 날씨를 묻는 메시지를 씁니다.

```text
/impersonate ask about the weather
```

짧은 별칭은 `/imp`입니다. Impersonate가 쓴 메시지에도 **Regenerate**가 작동하므로 다른 버전을 받을 수 있습니다.

### Impersonate 설정

이 설정은 모든 채팅의 모든 `/impersonate`에 적용됩니다. Roleplay 채팅에서 **Chat Settings**(채팅 설정)를 열고 **Impersonate** 섹션을 찾으세요. 패널을 여는 방법은 [채팅 설정](chat-settings.md)을 참고하세요.

| 컨트롤 | 하는 일 |
| --- | --- |
| **Prompt Template**(프롬프트 템플릿) | Impersonate를 실행할 때마다 보내는 선택적 지침입니다. 비워 두면 채팅 자체의 프롬프트나 내장 기본값을 사용합니다. Marinara가 실제 텍스트로 바꿔 넣는 자리 표시자인 `{{user}}`, `{{persona_description}}`, `{{impersonate_direction}}`을 쓸 수 있습니다. 기본값을 읽으려면 **Built-in default**(내장된 기본값)를, 사본으로 시작하려면 **Copy built-in default to edit**(내장된 기본값을 복사하여 편집)를, 이름을 붙인 템플릿으로 보관하려면 **Save as**(다른 이름으로 저장)를, 템플릿을 지우려면 **Delete template**(템플릿 삭제)을 고르세요. |
| **Preset**(프리셋) | Impersonate 답변에만 쓰는 프롬프트 프리셋입니다. 기본값: **Use chat default**(채팅 기본값 사용). [Preset Editor와 프롬프트 관리](../prompts/presets.md)를 참고하세요. |
| **Connection**(연결) | Impersonate 답변에 쓸 모델로, 더 저렴하거나 빠른 모델을 지정할 수 있습니다. 기본값: **Use chat default**. **Random**(무작위)도 고를 수 있습니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요. |
| **Skip agents**(에이전트 생략) | Impersonate 중에는 에이전트(트래커, 로어북 라우터 같은 보조 기능)를 건너뜁니다. 그래서 Impersonate가 빠르고 세계 상태도 바뀌지 않습니다. 기본값은 꺼짐입니다. [에이전트](../agents/agents-overview.md)를 참고하세요. |
| **Use CYOA as direction**(CYOA를 지침으로 사용) | CYOA(choose your own adventure) 선택지를 클릭하면 그 내용을 올리지 않고 Impersonate 방향으로 씁니다. 기본값은 꺼짐입니다. **Settings → General → Input & Editing**에서 **Add CYOA choices to the message box instead of sending them**(CYOA 선택지를 전송하지 않고 메시지 입력란에 추가)이 켜져 있으면, 클릭해도 텍스트가 메시지 입력란에 추가되기만 하고 이 설정은 효과가 없습니다. |

### 한 채팅에만 프롬프트 지정하기

1. `/impersonate_prompt`와 큰따옴표로 감싼 프롬프트를 입력하세요.
2. <kbd>Enter</kbd>를 누르세요.

```text
/impersonate_prompt "You will now play as my OC:"
```

기본값으로 되돌리려면 `/impersonate_prompt reset`을 입력하세요. 별칭은 `/imp_prompt`입니다.

## Send 옆에 Quick replies 추가하기

Quick replies는 **Send** 대신 쓸 수 있는 원클릭 동작을 추가하므로, 슬래시 명령어를 입력할 필요가 없습니다.

1. **Settings → General → Input & Editing**을 여세요.
2. **Quick replies**를 켜세요. 기본값은 꺼짐입니다.
3. 펼쳐서 표시할 동작을 고르세요. 켜 두면 세 동작이 모두 기본으로 켜져 있습니다.

| 동작 | 하는 일 |
| --- | --- |
| **Post only**(단순 작성) | 입력한 메시지를 답변 없이 채팅에 올립니다. `/send <message>` 명령도 같은 일을 합니다. |
| **Guide reply**(지시 작성) | 입력한 글을 `/guided` 방향으로 보냅니다. |
| **Impersonate** | 입력한 글을 방향으로 삼아 페르소나 관점의 답변을 생성합니다. Conversation 채팅에서는 숨겨집니다. |

동작이 하나만 켜져 있으면 그 버튼이 **Send** 옆에 놓입니다. 둘 이상이면 메뉴를 여는 점 세 개 버튼(**Quick replies**) 하나로 묶입니다.
