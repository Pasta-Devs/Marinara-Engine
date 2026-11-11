# Roleplay Mode: 시작하기

Roleplay(롤플레이)는 이야기를 위한 채팅 모드입니다. 메시지 뒤에 무대(배경과 캐릭터 스프라이트)를 두고, 이야기의 세부 정보를 보여 주는 HUD(heads-up display)를 더합니다. 에이전트는 답변과 나란히 실행되는 보조 기능입니다. 예를 들어 날씨를 기록하거나 스프라이트를 고르는 에이전트가 있습니다.

이야기 장면에는 Roleplay를 고르세요. 평범한 메시지 채팅에는 [Conversation](../conversation/getting-started.md)을, 파티와 전투, 주사위가 있는 짜임새 있는 게임에는 [Game Mode](../game/getting-started.md)를 고르세요. Roleplay는 이미지 생성 없이 텍스트 전용 채팅으로도 작동합니다. 스프라이트 자리는 비어 있고, 배경은 단색으로 표시되며, HUD는 그대로 이야기를 기록합니다.

## 롤플레이 시작하기

시작하기 전에: 앱 오른쪽의 **Connections**(연결) 패널에서 계정을 추가하세요. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

1. 채팅 사이드바에서 **RP** 탭을 클릭하세요.
2. 사이드바 위쪽의 **+** 버튼을 클릭하세요. 툴팁은 **New Roleplay**(새 롤플레이)입니다.

채팅이 열리면서 **Chat Settings**(채팅 설정)와 5단계 설정 마법사가 나타납니다. 필수 항목은 계정뿐입니다. 모든 항목은 나중에 바꿀 수 있습니다.

1. **Name & Connection**(이름과 연결). 롤플레이 이름을 정하고(선택 사항) 답변을 담당할 연결을 고르세요.
2. **Pick a Preset**(프리셋 선택). 프리셋은 프롬프트 구조와 생성 값을 정합니다. 대부분의 채팅에는 기본값으로 충분합니다.
3. **Persona & Characters**(페르소나와 캐릭터). 내 페르소나와 장면에 등장할 캐릭터를 고르세요. 이 단계의 **Create your persona**(내 페르소나 만들기) 버튼은 몇 가지 질문으로 페르소나를 만들어 줍니다. [대화형 온보딩](../characters/interactive-onboarding.md)을 참고하세요.
4. **Attach Lorebooks**(로어북 연결). 로어북은 키워드가 나올 때 AI가 읽는 세계 설정 묶음입니다. 선택 사항입니다.
5. **Enable Agents**(에이전트 활성화). 이 채팅에서 실행할 에이전트를 고르세요. 나중에 **Chat Settings → Agents**(채팅 설정 → 에이전트)에서 바꿀 수 있습니다.

마법사를 마치면 메시지 입력란이 있는 채팅이 보입니다. 첫 메시지를 입력해 보내세요.

## 무대: 배경, 스프라이트, HUD

- **Background**(배경): 메시지 뒤에 깔리는 장면 전체 이미지로, 바뀔 때 부드럽게 전환됩니다. **Background** 에이전트가 매 턴 하나를 고르게 하거나, 채팅마다 하나로 고정할 수 있습니다. [Roleplay 배경](backgrounds.md)을 참고하세요.
- **Sprites**(스프라이트): 무대에 표시되는 캐릭터 그림입니다. 스프라이트가 켜진 캐릭터는 모두 나타날 수 있습니다. 캐릭터 카드에 스프라이트 라이브러리가 있어야 하며, 없으면 그 자리는 비어 있습니다. [캐릭터 스프라이트](../characters/sprites.md)를 참고하세요.
- **HUD**: 트래커(날짜, 시간, 날씨, 위치, 등장 캐릭터, 인벤토리, 퀘스트, 능력치)입니다. **Chat Settings → Agents**에서 켜세요. [Roleplay HUD와 트래커](hud-and-trackers.md)를 참고하세요.

### 스프라이트 표시 설정

**Chat Settings**(채팅 안의 슬라이더 버튼)를 열고 **Agents**로 이동한 다음 **Expression Engine** 카드를 찾으세요. 스프라이트 표정을 고르는 에이전트입니다. 이 설정은 스프라이트가 켜진 캐릭터가 하나 이상 있을 때 나타납니다.

| 설정 | 하는 일 |
| --- | --- |
| **Sprite Source**(스프라이트 소스) | **Expressions**, **Full-body** 또는 둘 다 고르세요. 하나는 켜 두어야 합니다. |
| **Expression Size**(표정 크기), **Full-body Size**(전신 크기) | 각 종류의 스프라이트 크기를 정합니다. |
| **Expression Opacity**(표정 불투명도), **Full-body Opacity**(전신 불투명도) | 각 종류가 얼마나 비쳐 보일지 정합니다. |
| **Default Side**(기본 위치) | **Left**(왼쪽) 또는 **Right**(오른쪽): 새 스프라이트가 처음 놓일 쪽입니다. |
| **Expression Avatars**(감정 아바타) | 켜면 메시지 아바타가 캐릭터의 현재 표정 스프라이트를 사용합니다. |

크기와 불투명도 슬라이더 4개는 지금 쓰는 브라우저에만 저장됩니다. 다른 기기로 동기화되지 않습니다.

스프라이트를 직접 옮기려면 다음과 같이 하세요.

1. 장면에 있는 **Arrange**(배치) 버튼을 클릭하세요. 버튼이 **Done**(완료)으로 바뀝니다.
2. 스프라이트를 끌어 옮긴 다음 그 위의 작은 체크 표시를 클릭해 확정하세요.
3. 끝나면 **Done**을 클릭하세요. **Reset**(초기화)은 직접 지정한 배치를 모두 지웁니다.

입력으로 표정을 지정하려면 장면 전체에는 `/emote happy`를, 캐릭터 한 명에게는 `/emote "Aria" angry`를 보내세요. `/emote`만 보내면 각 캐릭터의 표정 목록이 나옵니다.

작동하지 않는 경우: 스프라이트가 보이려면 캐릭터에 스프라이트 라이브러리가 업로드되어 있어야 합니다. 없으면 표정 에이전트는 실행되어도 보여 줄 것이 없습니다.

## 채팅 도구

채팅 도구(검색, 분기, 요약, 활성 컨텍스트, Agent activity, Author's Notes, 갤러리)는 **Chat Settings**의 섹션입니다. 채팅 안의 슬라이더 버튼으로 여세요. 각 도구가 하는 일은 [채팅 설정](../chats/chat-settings.md)을, 섹션을 별도 창으로 꺼내는 방법은 [섹션을 별도 창으로 꺼내기](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)를 참고하세요.

<a id="authors-notes"></a>

### Author's Notes

**Author's Notes**(작가노트)는 AI가 답변할 때마다 읽는 노트입니다. 말투 규칙이나 숨겨 둔 사실처럼 계속 유지할 지침에 쓰세요.

1. **Chat Settings**를 열고 **Agents** 아래의 **Author's Notes**를 펼치세요.
2. 노트를 입력하세요. 예: "분위기는 어둡고 긴장감 있게 유지할 것."
3. 잘 모르겠다면 **Injection Depth**(주입 깊이)는 그대로 두세요. 채팅에서 노트가 놓일 위치를 정하는 값입니다. 0은 가장 최근 메시지 뒤이고, 4는 끝에서 네 메시지 앞입니다.

노트가 길다면 컴퓨터에서 상자의 아래쪽 모서리를 끌어 늘리세요. Author's Notes는 Game Mode와 Conversation Mode에서도 똑같이 작동합니다.

<a id="agent-activity"></a>

## 에이전트 활동

**Agent activity**(에이전트 활동)는 채팅의 에이전트가 한 일을 보여 줍니다. 채팅에서 에이전트나 Advanced Memory를 사용하면 나타납니다. **Chat Settings**의 **Agents** 바로 아래에 전용 섹션이 있고, Tracker Panel 아래쪽과 컴퓨터의 Trackers 창 아래쪽에도 있습니다.

- **Activity**(활동) 탭: 에이전트가 저장한 출력으로, 생각 풍선이라고 부릅니다. 하나씩 닫거나 **Clear all**(전체 지우기)을 사용하세요. 사용자 지정 에이전트의 출력도 여기에 나타납니다.
- 에이전트가 작업하는 동안에는 아이콘이 스피너로 바뀝니다. 에이전트가 실패하면 열어 볼 때까지 아이콘에 점이 표시됩니다.
- 실패한 에이전트는 재시도 버튼과 함께 나열됩니다. 실행 중인 에이전트를 중지하고, 트래커를 다시 실행하고, **Clear Trackers**(트래커 비우기)를 사용할 수도 있습니다.
- **Injections** 탭: **Debug mode**(디버그 모드)가 켜져 있을 때만 나타납니다(**Settings → Advanced**(설정 → 고급)). 직전 답변 전에 작가형 에이전트가 저장한 프롬프트 조각이 표시됩니다. 작가형 에이전트에는 문체 규칙에 맞춰 답변을 다시 쓰는 **Prose Guardian**과 이야기 흐름을 이끄는 **Narrative Director**가 있습니다. 조각은 보고, 고치고, 다시 실행할 수 있습니다. 고친 내용은 같은 답변을 재생성할 때 쓰이는 내용만 바꾸므로, 재생성 결과가 같은 조건으로 반복됩니다. 화면에 있는 답변은 바뀌지 않습니다.

모든 에이전트는 [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요. 이야기를 이끄는 에이전트는 [Narrative Director와 Secret Plot](narrative-director.md)을 참고하세요.

## 전투와 장면

- Roleplay에는 가벼운 전투 계층이 있습니다. Combat 에이전트를 추가한 다음 채팅 입력란 위의 **Encounter**(전투)를 클릭하세요. [전투 인카운터(Roleplay)](combat-encounters.md)를 참고하세요.
- 장면은 회상이나 다른 장소를 다루는 곁가지입니다. [장면: Roleplay 분기하기](scenes.md)를 참고하세요.
- 이야기 흐름을 이끌려면 [Narrative Director와 Secret Plot](narrative-director.md)을 참고하세요.
- 주사위 판정과 캐릭터 시트가 있는 탁상용 규칙으로 플레이하려면 [Roleplay: 규칙 집합으로 플레이하기](rulesets.md)를 참고하세요.

## 모델 고르기

캐릭터의 문장은 채팅 연결이 씁니다. 더 강력한 모델을 쓰면 긴 장면에서도 캐릭터의 말투가 흔들리지 않습니다. 에이전트 연결은 상태를 읽거나 표정을 고르는 것 같은 작고 정형화된 작업을 처리하는데, 작은 모델은 이런 작업을 틀릴 수 있습니다. 채팅은 강력한 모델로, 에이전트는 빠르고 저렴한 모델로 돌리는 경우가 많습니다. HUD 값이나 스프라이트가 계속 어긋난다면 에이전트를 더 강력한 모델로 옮기세요. 샘플러 설정은 [생성 파라미터](../prompts/generation-parameters.md)를 참고하세요.

## 명령

선택 기능입니다. 명령은 캐릭터가 스스로 할 수 있는 동작으로, 답변 안에 `[illustrate: ...]`처럼 대괄호로 감싼 짧은 텍스트로 적습니다. Marinara는 대괄호를 읽어 동작을 실행하고, 메시지에서 대괄호를 숨깁니다.

### 명령 켜기

1. **Chat Settings → Agents**를 열고 **Commands**(명령어)를 펼치세요.
2. 맨 위의 **Commands** 스위치를 켜세요. 안에 있는 명령은 모두 꺼진 상태로 시작합니다.
3. 원하는 명령을 켜세요. 회색으로 표시된 명령에는 아직 필요한 것이 표시됩니다.

- **Illustrations**(일러스트), **Video clips**(동영상 클립): 이 채팅에 Illustrator 에이전트를 추가하세요.
- **Combat**(전투): 이 채팅에 Combat 에이전트를 추가하세요.
- **Soundtrack**(사운드트랙): Music DJ 에이전트를 추가하고 에이전트를 켜세요.
- **Personal Notes**(개인 메모), **Reminders**(미리 알림), **Whisper**(귓속말): 일대일 채팅이나 **Individual**(개별) 생성을 쓰는 그룹 채팅을 사용하세요.
- **Sound Cues**(사운드 큐): 효과음이 켜진 Music & Sound Effects(음악 및 효과음) 연결을 고르세요.
- **Documents**(문서), **HTML Artifacts**(HTML 아티팩트), **Rolls**(주사위 굴리기), **Direct Messages**(DM), **Interruptions**(끼어들기): 따로 필요한 것이 없습니다.

**Rolls**, **Combat**, **Documents**, **Whisper**는 누가 쓸 수 있는지도 묻습니다. **All**(모두) 캐릭터 또는 **Narrator**(내레이터)만 고를 수 있습니다. 내레이터는 **Narrator character**(내레이터 캐릭터)에서 고른 캐릭터입니다. 내레이터는 내레이터 전용 명령을 쓸 수 있고, 모두의 메모와 미리 알림, 귓속말을 읽을 수 있습니다.

작동하지 않는 경우: 회색으로 표시된 명령은 필요한 에이전트나 채팅 유형이 빠져 있는 것입니다. 스위치 아래의 문구를 읽어 보세요.

### 일러스트

시작하기 전에: 채팅에 Illustrator 에이전트를 추가하고 **Illustrations**를 켜세요.

이제 캐릭터가 `[illustrate: subject="..." characters="..."]`로 이미지를 요청할 수 있습니다. 이미지는 채팅의 Illustrator 설정을 사용하며 메시지 아래에 나타납니다.

**Render in-line**(본문 안에 표시)을 켜면 각 이미지가 메시지 안, 캐릭터가 명령을 적은 위치에 표시됩니다. 이미지를 선택하면 프롬프트를 볼 수 있고, **X**로 제거할 수 있습니다. 이 설정은 새 이미지에만 적용됩니다. Illustrator 에이전트가 스스로 만드는 이미지와 비주얼 노벨 레이아웃은 바뀌지 않습니다.

`/illustrate`로 직접 일러스트를 만들 수도 있습니다. Roleplay에서는 Illustrator 에이전트가 필요합니다.

<a id="artifacts-on-demand"></a>

### 요청형 아티팩트

**HTML Artifacts**를 켜면 내레이터가 이야기 속 물건 하나를 만들 수 있습니다. 마법서 한 페이지, 표지판, 편지에 그린 스케치, 터미널 출력 화면 같은 것입니다. 명령은 `[html: prompt="..."]`입니다. 에이전트가 필요하지 않습니다. `/html <what you want>`로 직접 요청할 수도 있습니다.

아티팩트는 답변이 끝난 뒤 내레이터가 명령을 넣은 위치에 나타납니다. 비주얼 노벨 레이아웃에서는 표시만 보입니다. 답변 하나에 아티팩트를 최대 3개까지 만들 수 있으며, 하나하나가 별도의 모델 요청입니다. 요청은 **Immersive HTML** 에이전트에 연결이 있으면 그 연결을, 없으면 기본 에이전트 연결을, 그것도 없으면 채팅의 연결을 씁니다. 동시에 몇 개를 실행할지는 그 연결의 **Parallel requests** 설정(계정 편집기에 있음)이 정합니다. 단순히 꾸민 페이지라면 기본 제공 **Documents** 종류가 무료이고 바로 나옵니다.

내레이터는 아티팩트의 HTML을 보지 않습니다. 이후 턴에서는 짧은 일반 텍스트 버전을 봅니다. 아티팩트에서 읽을 수 있는 텍스트와 생김새를 설명하는 한 줄입니다. 메시지 아래의 "used html command" 표시를 열면 그 텍스트를 읽거나 고칠 수 있고, 아티팩트를 삭제할 수도 있습니다. 삭제하면 내레이터의 기억에서도 사라집니다. 실행이 실패하면 표시에 그 이유가 나옵니다.

<a id="whispers-and-secrets"></a>

### 귓속말과 비밀

**Whisper**를 켜면 답변 안에 사적인 말, 비밀, 환영을 넣을 수 있습니다. 명령은 `[whisper: character="name" text="the secret"]`입니다. 채팅의 캐릭터나 내 페르소나 중 정확히 한 명을 지정하세요. 그 캐릭터와 내레이터만 프롬프트로 텍스트를 받습니다. 알 수 없거나 모호한 이름은 무시되므로 비밀이 새지 않습니다.

- **Reveal a secret**(비밀 드러내기)은 귓속말을 화면에 보여 줍니다. 내가 보는 화면만 바뀌고 캐릭터가 아는 내용은 바뀌지 않습니다. 내 페르소나에게 보낸 귓속말은 바로 보입니다.
- **Edit whisper**(귓속말 편집)로 텍스트를 고친 다음 **Save**(저장)를 누르세요. 귓속말을 삭제하려면 텍스트를 지우고 **Save**를 누르세요. **Cancel**(취소)을 누르면 그대로 남습니다.
- 내 메시지에 귓속말을 적어 캐릭터 한 명에게 귓속말을 보낼 수 있습니다. 캐릭터나 내레이터의 메시지를 편집할 때도 같은 대괄호 명령을 쓸 수 있습니다. 텍스트는 여러 줄로 써도 되고, `text=""I love you.""`처럼 따옴표를 그대로 넣을 수도 있습니다.
- 귓속말만 담긴 메시지는 귓속말을 받지 않는 캐릭터에게 숨겨집니다.
- **Hide from AI**(AI에게서 숨기기)로 메시지를 일부 캐릭터에게 숨기면, 귓속말 수신자는 귓속말은 그대로 받지만 메시지의 나머지 부분은 받지 않습니다.

에이전트도 귓속말을 읽을 수 있습니다.

- 귓속말을 읽는 에이전트는 Echo Chamber, 트래커, Lorebook Keeper, Long-Term Memory입니다. 그룹 채팅에서는 **Smart**(스마트) 응답 순서도 귓속말을 읽으므로, 귓속말 때문에 그 캐릭터가 다음에 답하게 될 수 있습니다.
- 각 귓속말에는 비공개 표시가 붙고 수신자 이름이 적힙니다. 그래도 로어북 항목이나 트래커 메모처럼 에이전트가 귓속말을 바탕으로 쓴 내용은 다른 캐릭터에게 전달될 수 있습니다.
- 호스팅한 멀티플레이어 방에서는 에이전트와 **Smart** 응답 순서가 귓속말을 받지 않습니다.
- Relationship Tracker와 Memory Nag는 채팅을 직접 읽으며 아직 귓속말을 보지 못합니다.

<a id="your-private-notes"></a>

### 나의 비공개 메모

**Personal Notes**를 켠 다음 내 메시지에 `[notes: content="your private note"]`를 적으세요. 이 메모는 내레이터만 받으며, 다른 캐릭터나 공용 에이전트에게는 전달되지 않습니다. 메시지의 명령 세부 정보에서 편집하거나 삭제하세요. 캐릭터가 비활성화되거나 그룹에서 제거되면 내레이터는 그 캐릭터의 메모를 더 이상 받지 않습니다. 캐릭터를 다시 켜면 메모가 돌아옵니다.

메시지 하나에 메모를 남길 수도 있습니다.

1. 메시지 아래에서 **Bookmark, pin or note**(북마크, 핀 또는 메모)를 선택하세요.
2. **Private note**(비공개 메모)를 작성하세요. 기본적으로 메모는 비공개로 유지되며 모델에 전송되지 않습니다.
3. 모델과 공유하려면 **Show the note to the narrator character**(내레이터 캐릭터에게 메모 보여 주기)를 켜고 캐릭터를 고르세요. 그 캐릭터만 해당 메시지 옆에 붙은 메모를 받습니다. 공유하려면 일대일 채팅이나 **Individual** 그룹 생성이 필요합니다.

**Remove note**(메모 삭제)는 공유도 중단합니다.

<a id="video-clips"></a>

### 동영상 클립

시작하기 전에: 채팅에 Illustrator 에이전트를 추가하고 Illustrator의 **Scene Videos**(장면 비디오)에서 동영상 연결을 고르세요.

**Video clips**를 켜면 캐릭터가 `[video: subject="the moment" motion="what moves and how the camera moves" characters="names"]`로 중요한 순간의 짧은 클립을 요청할 수 있습니다. 모델은 동작이 중요한 순간에는 `[illustrate]`보다 이 명령을 우선하도록 지시받습니다. 클립은 Illustrator의 **First frame**(첫 프레임)이 정한 그림(새 Illustrator 그림, 캐릭터의 아바타나 스프라이트, 또는 없음)에서 시작합니다. 클립은 준비되면 답변 안에서 재생됩니다. 클립은 **Video Run Interval**(동영상 실행 간격)이 허용할 때만 제공되며, **Videos per reply**(응답당 동영상 수)에 포함됩니다.

### 캐릭터 끼어들기

**Interruptions**를 켜면 끼어들기가 어울리는 상황에서 캐릭터가 최신 메시지를 중간에 끊을 수 있습니다. 명령은 `[interrupt: part="a verbatim phrase of at least three words"]`입니다. Marinara는 답변 바로 앞 메시지에서 그 구절을 찾아 구절까지의 텍스트를 남기고, 끝을 대시로 마무리합니다. 대사는 닫는 따옴표를 유지합니다. 구절이 없거나 두 곳과 일치하면 메시지는 그대로 남습니다.

원본을 되돌리려면 답변의 명령 정보를 열고 **Restore original message**(원본 메시지 복원)를 선택하세요. 재생성하면 먼저 원본 전체를 복원하므로 새 답변이 다시 선택할 수 있습니다. 기존 스와이프를 고르면, 복원하지 않은 한 그 스와이프의 끼어들기가 적용됩니다. 나중에 직접 편집한 내용은 유지됩니다.

## Echo Chamber

**Echo Chamber**는 장면에 반응하는 실시간 관객을 더하는 선택형 에이전트입니다. 일정 시간마다 새 반응을 올리는 스트리밍 채팅과 비슷합니다. **Chat Settings → Agents**의 **Echo Chamber** 카드에서 켜세요.

- 컴퓨터에서는 제목 표시줄을 끌어 옮기고 가장자리를 끌어 크기를 바꾸세요. 계속 열어 두려면 고정하세요. **X**를 누르면 이동 가능한 버튼으로 닫힙니다.
- 휴대폰에서는 메시지 위의 작은 창으로 시작합니다. 제목 표시줄을 끌어 옮기거나, 가장자리나 모서리를 끌어 크기를 바꾸세요. 고정하면 다른 곳을 탭해도 열려 있고, 잠그면 실수로 움직이지 않습니다.
- **Settings → Appearance → App**(설정 → 모양 → 앱)의 **Chat widget style**(채팅 위젯 스타일)을 따릅니다. 채팅마다 배치를 기억합니다.

## CYOA 선택지

CYOA는 Choose Your Own Adventure의 약자입니다. CYOA Choices 에이전트는 기본적으로 꺼져 있으며 Roleplay에서만 작동합니다. 켜면 답변 뒤에 클릭할 수 있는 선택지 버튼이 붙고, 선택지를 클릭하면 그 내용이 다음 메시지로 전송됩니다. 선택지를 합치거나 먼저 고치려면 **Settings → General → Input & Editing**(설정 → 일반 → 입력 및 편집)에서 **Add CYOA choices to the message box instead of sending them**(CYOA 선택지를 전송하지 않고 메시지 입력란에 추가)을 켜세요. 그러면 선택지를 클릭했을 때 그 텍스트가 메시지 입력란에 추가됩니다.

## 문제 해결

| 증상 | 해결 방법 |
| --- | --- |
| HUD 값이 틀립니다. | 직접 고친 다음 잠가서 다음 실행이 건드리지 않게 하세요. [Roleplay HUD와 트래커](hud-and-trackers.md)를 참고하세요. 값이 계속 어긋나면 더 강력한 에이전트 모델을 쓰세요. |
| 스프라이트가 바뀌지 않습니다. | 캐릭터에 스프라이트 라이브러리가 있는지 확인하세요. `/emote`를 쓸 수도 있습니다. |
| 배경이 전혀 바뀌지 않습니다. | **Background** 에이전트는 내 라이브러리에서 고르므로 배경을 더 추가하세요. [Roleplay 배경](backgrounds.md)을 참고하세요. |
| 재생성한 답변이 계속 엉뚱한 방향으로 갑니다. | **Debug mode**를 켜고 **Agent activity → Injections**를 연 다음, 재생성하기 전에 저장된 조각을 고치거나 다시 실행하세요. |

더 자세한 도움말은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 관련 가이드

- [Roleplay 배경](backgrounds.md)
- [Roleplay HUD와 트래커](hud-and-trackers.md)
- [전투 인카운터(Roleplay)](combat-encounters.md)
- [Narrative Director와 Secret Plot](narrative-director.md)
- [Roleplay: 규칙 집합으로 플레이하기](rulesets.md)
- [장면: Roleplay 분기하기](scenes.md)
- [캐릭터 스프라이트](../characters/sprites.md)
- [Conversation을 Roleplay나 Game에 연결하기](../chats/connected-chats.md)
- [매크로](../prompts/macros.md)
