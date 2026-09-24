# 지침 기반 생성과 Impersonate

이 가이드에서는 Marinara Engine에서 채팅의 흐름을 조종하는 두 가지 방법을 설명합니다. 지침 기반 생성은 화면에 메시지를 남기지 않고 AI에 방향만 알려 줍니다. Impersonate(유저 사칭)는 AI가 대신 답장을 써 주는 기능입니다. 두 동작을 **Send**(전송) 버튼 옆에 모아 두는 **Quick replies**(퀵 리플라이) 메뉴도 함께 다룹니다.

## 지침 기반 생성

지침 기반 생성은 다음 답장을 어느 방향으로 끌고 갈지 AI에 알려 주는 기능입니다. 이때 적는 지침은 캐릭터 밖에서 하는 말입니다. 답장의 방향만 바꿀 뿐, 일반 채팅 메시지로는 표시되지 않습니다.

### /guided로 답장 방향 잡기

답장을 유도하는 기본 방법은 `/guided` 슬래시 명령어입니다.

1. 메시지 입력란에 `/guided`를 입력하고 이어서 원하는 방향을 적으세요.
2. Enter를 누르거나 **Send**를 클릭하세요.
3. 적어 준 방향에 맞춰 AI가 다음 답장을 생성합니다.

예를 들어 다음 지침은 다음 답장을 고백 쪽으로 밀어붙입니다.

```
/guided make him admit he is lying
```

이 명령어에는 짧은 별칭이 있습니다. `/guided` 대신 `/narrator`, `/narrate`, `/nar`을 입력해도 됩니다.

그룹 채팅에서는 특정 캐릭터를 지목해 방향을 줄 수 있습니다. `/guided respond for <character> <direction>` 형식으로 입력하세요. `<character>` 자리에는 캐릭터 이름을, `<direction>` 자리에는 지침을 적습니다. 예를 들면 다음과 같습니다.

```
/guided respond for Alice make her admit she is lying
```

### 지침을 적용한 재생성

답장을 재생성할 때도 방향을 줄 수 있습니다. 이때는 메시지 입력란에 적어 둔 글이 그대로 일회성 지침이 됩니다.

1. **Settings**(설정)를 열고 **Advanced**(고급), **Message Tools**(메시지 도구) 순서로 이동하세요.
2. **Guide swipes/regens with chat input**(채팅 입력으로 스와이프/재생성 안내) 설정을 켜세요. 이 설정은 기본값이 꺼짐입니다.
3. 채팅으로 돌아가 메시지 입력란에 방향을 적되, 전송하지는 마세요.
4. AI 메시지에서 **Regenerate**(재생성)를 클릭하세요.

이 설정이 켜져 있고 입력란에 글이 남아 있으면 **Regenerate** 버튼의 툴팁이 **Regenerate (guided)**로 바뀝니다. 적어 둔 글을 방향으로 삼아 AI가 답장의 새 버전을 만듭니다.

### 저장된 지침 확인하기

방향을 주고 만든 답장이면 Marinara가 그 방향을 저장해 두기 때문에 나중에 다시 볼 수 있습니다. 해당 메시지에 두루마리 아이콘으로 **Stored guidance**(저장된 지침) 동작이 나타납니다.

1. AI 메시지의 **Stored guidance** 아이콘을 클릭하세요.
2. **Stored guidance** 창이 열리고 그 답장을 만들어 낸 방향이 표시됩니다.

창에는 방향이 어디에서 왔는지도 함께 표시됩니다.

- **/guided**: `/guided` 명령어로 준 방향입니다.
- **Guided regenerate**: 지침을 적용한 **Regenerate** 클릭으로 준 방향입니다.
- **Game start**: Game Mode(게임 모드) 설정 단계에서 온 방향입니다.

`/guided`와 지침 적용 재생성으로 만든 방향에는 **Copy /guided**(/guided 복사) 버튼이 있습니다. 이 버튼을 누르면 바로 쓸 수 있는 `/guided` 명령어 형태로 방향이 복사되므로, 다른 채팅에 붙여넣어 같은 방향을 그대로 다시 쓸 수 있습니다.

## Impersonate

Impersonate는 페르소나의 말투로 AI가 다음 메시지를 대신 써 주는 기능입니다. 페르소나는 채팅에 `{{user}}`로 들어가는, 직접 연기하는 캐릭터입니다. 만드는 방법은 [사용자 페르소나](../characters/personas.md)를 참고하세요.

Impersonate는 Roleplay(롤플레이) 채팅에서만 동작합니다. Conversation(대화)이나 Game Mode(게임 모드) 채팅에서는 쓸 수 없습니다. Conversation 채팅에서 시도하면 "Impersonate is not available in Conversation mode."라는 메시지가 표시됩니다.

### /impersonate 사용하기

1. 메시지 입력란에 `/impersonate`를 입력하세요. 뒤에 원하는 방향을 덧붙여도 됩니다.
2. Enter를 누르거나 **Send**를 클릭하세요.
3. AI가 페르소나가 되어 유저 메시지를 쓰고 채팅에 올립니다.

예를 들어 다음과 같이 입력하면 날씨를 묻는 메시지를 AI가 대신 써 줍니다.

```
/impersonate ask about the weather
```

이 명령어에는 짧은 별칭이 있습니다. `/impersonate` 대신 `/imp`를 입력해도 됩니다.

Impersonate가 쓴 메시지는 다시 만들 수 있습니다. Impersonate로 만든 유저 메시지에도 **Regenerate** 동작이 작동하므로 다른 버전을 받아 볼 수 있습니다.

### Impersonate 설정

Impersonate에는 모든 채팅에서 실행하는 모든 `/impersonate`에 적용되는 설정 항목이 있습니다. 채팅별 설정에서 열 수 있습니다.

1. Roleplay 채팅의 **Chat Settings**(채팅 설정) 패널을 여세요.
2. **Impersonate**(유저 사칭) 섹션을 찾으세요.

이 섹션에는 다음 컨트롤이 있습니다.

- **Prompt Template**(프롬프트 템플릿): Impersonate를 실행할 때마다 모델에 함께 보내는 선택적 지침입니다. 비워 두면 채팅 자체의 프롬프트를 사용하고, 채팅에 프롬프트가 없으면 내장 기본값을 사용합니다. `{{user}}`, `{{persona_description}}`, `{{impersonate_direction}}` 매크로를 쓸 수 있습니다. 매크로는 Marinara가 전송 직전에 실제 텍스트로 바꿔 넣는 자리 표시자입니다. **Built-in default**(내장 기본값)를 클릭하면 기본 문구를 읽어 볼 수 있습니다. **Reset**(초기화) 버튼을 누르면 직접 작성한 템플릿이 지워지고 다시 빈 상태가 됩니다.
- **Preset**(프리셋): Impersonate 답장에만 특정 프롬프트 프리셋을 사용합니다. 프리셋은 프롬프트 설정을 저장해 둔 묶음입니다. [Preset Editor와 프롬프트 관리](../prompts/presets.md)를 참고하세요. 기본값은 **Use chat default**(채팅 기본값 사용)입니다. 프리셋은 Roleplay에서만 적용됩니다.
- **Connection**(연결): Impersonate 답장을 더 저렴하거나 빠른 모델처럼 특정 연결로 보냅니다. 연결은 AI 제공자에 접속하는 데 필요한 정보를 저장해 둔 것입니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요. 기본값은 **Use chat default**입니다. **Random**(무작위)도 선택할 수 있습니다.
- **Skip agents**(에이전트 생략): 켜면 Impersonate 도중에 Marinara가 에이전트 파이프라인(트래커, 로어북 라우터를 비롯한 보조 기능)을 건너뜁니다. 덕분에 Impersonate가 빨라지고 세계 상태도 바뀌지 않습니다. 기본값은 꺼짐입니다. [에이전트](../agents/agents-overview.md)를 참고하세요.
- **Use CYOA as direction**(CYOA를 지침으로 사용): 켜면 CYOA 선택지를 클릭했을 때 그 내용이 일반 메시지로 올라가지 않고 Impersonate 방향으로 쓰입니다. CYOA는 choose your own adventure의 약자로, 일부 채팅이 답장 뒤에 보여 주는 클릭 가능한 선택지 묶음입니다. 이 설정은 기본값이 꺼짐입니다.

### 채팅별 Impersonate 프롬프트 지정하기

슬래시 명령어를 쓰면 특정 채팅에만 적용되는 Impersonate 프롬프트를 지정할 수도 있습니다.

1. `/impersonate_prompt`를 입력하고 이어서 프롬프트를 큰따옴표로 감싸 적으세요.
2. Enter를 누르세요.

예를 들면 다음과 같습니다.

```
/impersonate_prompt "You will now play as my OC:"
```

채팅별 프롬프트를 지우고 기본값으로 되돌리려면 다음과 같이 입력하세요.

```
/impersonate_prompt reset
```

이 명령어에는 짧은 별칭 `/imp_prompt`가 있습니다.

## Quick replies 메뉴

**Quick replies** 메뉴는 일반 **Send** 버튼 옆에 전송 동작을 몇 가지 더 붙여 줍니다. 슬래시 명령어를 입력하지 않고도 지침 기반 생성과 Impersonate를 한 번의 클릭으로 쓸 수 있습니다.

어떤 동작을 표시할지는 설정에서 고릅니다.

1. **Settings**를 열고 **Advanced**, **Message Tools** 순서로 이동하세요.
2. **Quick replies**를 켜세요. 기본값은 꺼짐입니다.
3. 펼치면 표시할 동작을 고를 수 있습니다. 메뉴를 켜면 세 가지 동작이 모두 기본으로 켜져 있습니다.

세 가지 동작은 다음과 같습니다.

- **Post only**(단순 작성): AI 답장을 부르지 않고 입력한 메시지만 채팅에 올립니다. `/send <message>` 슬래시 명령으로도 실행할 수 있습니다.
- **Guide reply**(지시 작성): 입력한 글을 일반 메시지가 아니라 `/guided` 방향으로 보냅니다.
- **Impersonate**: 입력한 글을 방향으로 삼아 페르소나 관점의 답장을 생성합니다. Conversation 채팅에서는 Impersonate가 동작하지 않으므로 이 동작도 표시되지 않습니다.

동작이 하나만 켜져 있으면 그 버튼이 **Send** 옆에 바로 표시됩니다. 두 개 이상 켜면 작은 메뉴로 묶입니다. 점 세 개 버튼(**Quick replies**)을 클릭해 메뉴를 여세요.

## 관련 가이드

- [메시지 조작: 편집, 삭제, 스와이프, 재생성](messages.md)
- [Peek Prompt: AI가 받은 내용 확인하기](peek-prompt.md)
- [사용자 페르소나: 만들기 및 편집](../characters/personas.md)
- [Preset Editor와 프롬프트 관리](../prompts/presets.md)
