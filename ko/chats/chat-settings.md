# 채팅 설정 개요

**Chat Settings**(채팅 설정)는 지금 열려 있는 채팅의 옵션을 모은 패널입니다. 모델, 캐릭터, 에이전트, 검색, 요약, 분기, 갤러리가 여기에 있습니다. 대부분의 설정은 그 채팅에만 적용됩니다.

## Chat Settings 열기

1. 채팅을 여세요.
2. **Chat Settings** 버튼(슬라이더 아이콘)을 탭하세요. 패널이 열립니다. 휴대폰에서는 **Help**(도움말, **?**)가 아이콘 안내를 보여 줍니다.
3. 섹션 제목을 탭하면 섹션이 열립니다. 제목을 다시 탭하면 접힙니다.

채팅을 만들면 Chat Settings가 자동으로 열립니다. 닫으려면 **X**를 탭하거나 슬라이더 버튼을 다시 탭하세요.

컴퓨터에서 슬라이더 버튼은 처음에 채팅 오른쪽 위에 있습니다. 오른쪽에 Tracker Panel(트래커 패널)이 표시되어 있으면 그 패널의 왼쪽에 있습니다. Tracker Panel은 에이전트(답변과 함께 실행되는 도우미)가 추적하는 내용, 예를 들어 장면 속 캐릭터를 보여 주는 Roleplay(롤플레이)의 사이드 패널입니다.

슬라이더 버튼은 편한 곳으로 끌어 옮길 수 있습니다. 끄는 동안 가까운 채팅 버튼과 나란히 맞춰집니다. 컴퓨터에서는 <kbd>Alt</kbd>를 누른 채 자유롭게 배치하세요. 채팅마다 위치를 기억합니다. 버튼의 작은 점은 에이전트가 작업 중이라는 뜻입니다. Advanced Memory Recall을 쓰는 Roleplay 채팅에서 반대쪽 모서리에 깜박이지 않는 점이 있으면 일부 장면 기억을 확인해야 한다는 뜻입니다. [기억 문제 해결하기](../agents/memory.md#fixing-memory-problems)를 참고하세요.

채팅을 처음 열면 버튼과 창을 배치하는 방법을 짧은 영상으로 보여 줍니다. **Got it**(확인)을 클릭하세요. 다른 채팅에서도, 새로고침한 뒤에도 다시 나타나지 않습니다. 한 채팅에서 배치 안내를 계속 숨기려면 안내 옆의 **X**(**Hide these tips for this chat**, 이 채팅에서 팁 숨기기)를 클릭하세요.

## 섹션 한눈에 보기

어떤 섹션이 보이는지는 채팅 모드에 따라 다릅니다. **Impersonate**(유저 사칭) 섹션은 [지침 기반 생성과 Impersonate](guided-and-impersonate.md)에서 설명합니다.

- 설정 프로필 막대: 채팅 설정 묶음을 적용하거나 저장합니다. [설정 프로필](settings-profiles.md)을 참고하세요. Conversation(대화)과 Roleplay에 있습니다.
- **Search messages**(메시지 검색): 단어를 입력하거나 `#` 뒤에 메시지 번호를 붙여 메시지를 찾습니다. **Bookmarks**(북마크) 탭과 **Trash**(휴지통) 탭에는 북마크한 메시지와 삭제한 메시지가 표시됩니다. Game에는 없습니다.
- **Chat Name**(채팅 제목): 채팅 목록에 표시되는 이름입니다. 클릭하면 이름을 바꿀 수 있습니다. 모델에는 절대 전송되지 않습니다.
- **Chat Branches**(채팅 분기): 분기를 전환하고, 이름을 바꾸고, 내보내고, 가져옵니다. [채팅 분기](branches.md)를 참고하세요.
- **Connection**(연결): 이 채팅에서 어떤 모델이 답할지 정합니다. 아래를 참고하세요.
- **Prompt Preset**(프롬프트 프리셋): 이 채팅에 쓰는 저장된 프롬프트 구조입니다.
- **Advanced Parameters**(고급 매개변수): temperature 같은 생성 설정을 이 채팅에서만 다르게 지정합니다. [생성 파라미터](../prompts/generation-parameters.md)를 참고하세요.
- **Persona**(페르소나): 내가 연기할 인물입니다. [채팅에서 페르소나 선택하기](../characters/choosing-your-persona.md)를 참고하세요. Conversation과 Roleplay에 있습니다.
- **Characters**(캐릭터): 채팅에 있는 캐릭터입니다. Conversation과 Roleplay에 있습니다.
- **Party**(파티): **Persona**와 **Characters**를 한곳에 모아 대신합니다. Game에 있습니다.
- **Group Chat**(그룹 채팅): 그룹에서 누가 말할지 정합니다. [그룹 채팅과 여럿이 나누는 대화](group-chats.md)를 참고하세요. 캐릭터가 둘 이상인 채팅에 있습니다.
- **Scoped Regex Scripts**(범위 지정 정규식 스크립트): 캐릭터에 속한 정규식 스크립트를 채팅별로 제어합니다. [정규식 스크립트](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting)를 참고하세요. 채팅의 캐릭터에게 범위 스크립트가 있을 때만 표시됩니다.
- **Chat Variables**(채팅 변수): `{{name}}`으로 다시 쓰는 이름 붙은 텍스트입니다. 아래를 참고하세요.
- **Connected Chats**(연결된 채팅): 채팅을 다른 채팅과 연결합니다. [Conversation을 Roleplay나 Game에 연결하기](connected-chats.md)를 참고하세요.
- **Lorebooks**(로어북): 세계 설정을 붙입니다. [로어북 개요](../lorebooks/overview.md)를 참고하세요.
- **Chat Summary**(채팅 요약): 요약을 검토하고 만듭니다. [Memory Recall과 채팅 요약](../agents/memory.md#chat-summary-roleplay)을 참고하세요. 요약이 적용되는 채팅에 있습니다.
- **Active Context**(활성 컨텍스트): 이 채팅에서 활성화된 로어북과 컨텍스트를 보여 줍니다. [토큰 예산과 재귀](../lorebooks/token-budgets.md#seeing-skipped-entries-in-active-context)를 참고하세요.
- **Agents**(에이전트): 도우미를 켭니다. [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요.
- **Agent activity**(에이전트 활동): 에이전트가 한 일을 보여 줍니다. 트래커를 다시 실행하고, 에이전트를 재시도하거나 중지하고, 트래커를 비울 수 있습니다. [에이전트 활동](../roleplay/getting-started.md#agent-activity)을 참고하세요. 에이전트나 Advanced Memory를 켠 Roleplay 채팅에 있습니다.
- **Author's Notes**(작가노트): 모델이 매 턴 읽는 노트입니다. [Author's Notes](../roleplay/getting-started.md#authors-notes)를 참고하세요. Roleplay에 있습니다.
- **Background**(배경): 채팅의 배경 그림입니다. Roleplay와 Game에 있습니다.
- **Gallery**(갤러리): 채팅의 이미지와 동영상입니다. [장면 배경과 Gallery](../media/scene-backgrounds.md)를 참고하세요.
- **Widgets**(위젯): 게임에 표시할 HUD 위젯을 정합니다. Game에 있습니다.
- **Impersonate**: `/impersonate` 명령어의 설정입니다. Roleplay에 있습니다.
- **Memory Recall**(기억 회상): 채팅의 앞부분을 기억합니다. [Memory Recall과 채팅 요약](../agents/memory.md)을 참고하세요. Lite 버전에는 없습니다.
- **Function Calling**(기능 호출): 이 채팅에서 모델이 도구(함수)를 쓸 수 있게 합니다.
- **Translation**(번역): 메시지를 자동으로 번역합니다. [메시지 번역](../integrations/message-translation.md)을 참고하세요.

Conversation 채팅에는 캐릭터가 먼저 메시지를 보내는 Autonomous Messaging, 캐릭터가 스스로 하는 행동인 Commands, 노트 섹션도 있습니다. 이 섹션들은 [Conversation Mode: 시작하기](../conversation/getting-started.md)에서 설명합니다.

## 채팅의 모델 고르기

**Connection** 섹션에서는 이 채팅에서 답할 모델을 고릅니다. 여기서 고른 모델은 이 채팅에만 적용됩니다.

1. **Chat Settings**를 열고 **Connection** 섹션을 여세요.
2. **Model**(모델) 필드를 탭하세요. 현재 모델이 표시됩니다.
3. 채팅이 **Main**(메인)을 따른다고 표시되는지 확인하세요. Main은 **Connections**(연결)에서 정한 기본 모델입니다.
4. 모델을 고르세요. 선택 창은 채팅 입력란의 모델 버튼과 같습니다. 현재 모델이 맨 위에 있고, 그 아래에 최근 모델과 별표한 모델이 계정별로 묶여 있습니다. 모델과 계정을 한꺼번에 검색하거나, **Browse**(찾아보기)로 한 계정의 카탈로그를 여세요.

**Follow Main**(메인 따르기)은 채팅에 따로 고른 모델을 지우므로, Main을 바꾸면 이 채팅도 함께 바뀝니다. **Shuffle**(셔플)은 풀에서 답변마다 다른 모델을 고릅니다. [Shuffle](../connections/organizing-connections.md#shuffle)을 참고하세요. 계정에 키가 필요하거나 계정이 꺼져 있으면, 그 계정의 모델을 고를 때 복구 작업으로 이어집니다. 계정을 추가하려면 [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

## 채팅 변수 사용하기

채팅 변수는 텍스트 한 조각에 붙인 이름입니다. 예를 들어 값이 `Mary`인 `char1`을 추가한 다음 메시지에 `{{char1}} walks in.`을 쓰면, 모델은 "Mary walks in."으로 읽습니다.

1. **Chat Settings**를 열고 **Chat Variables** 섹션을 여세요.
2. **Add variable**(변수 추가)을 탭한 다음 행의 **name**(이름)과 **value**(값)를 채우세요.
3. <kbd>Enter</kbd>를 누르거나 필드 밖을 클릭하면 저장됩니다. 휴지통 버튼은 변수를 삭제합니다.

이름에는 영문자, 숫자, 밑줄을 쓸 수 있고, 영문자나 밑줄로 시작해야 하며, 최대 64자입니다. 정확히 21자인 이름은 캐릭터 참조용으로 예약되어 있습니다. `char`나 `user`처럼 기본 제공 매크로에 속한 이름은 거부됩니다.

- 메시지에는 입력한 태그가 그대로 표시됩니다. 값은 모델만 봅니다. 나중에 값을 바꾸면 그 태그를 쓴 이전 턴도 모두 바뀝니다.
- 변수는 이 채팅에만 속하며, 앱을 다시 시작해도 유지됩니다.
- `{{setvar}}`가 쓰는 저장소와 같습니다. 같은 이름을 설정하는 프롬프트 섹션이나 로어북 항목은 직접 입력한 값을 덮어씁니다.

변수가 많으면 **Search and edit all in the State Editor**(상태 편집기에서 모두 검색하고 편집)를 클릭하세요. 모든 변수가 목록으로 열리며, 검색하고, 편집하고, 여러 개를 JSON으로 붙여 넣고, 저장하기 전에 변경 사항을 검토할 수 있습니다. [State Editor](../roleplay/hud-and-trackers.md#the-state-editor)를 참고하세요. 중괄호 두 개로 쓰는 다른 매크로는 [프롬프트 매크로](../prompts/macros.md)를 참고하세요.

<a id="settings-profiles"></a>

## 설정 프로필

설정 프로필은 다른 채팅에 적용할 수 있도록 채팅 설정을 묶어 저장한 것입니다. 프로필 막대는 패널 맨 위에 있으며 Game에는 표시되지 않습니다. 저장, 적용, 가져오기, 내보내기, 기본값 지정은 [설정 프로필](settings-profiles.md)에서 설명합니다.

## 창 이동, 고정, 잠금

컴퓨터에서 Chat Settings는 채팅 위에 떠 있으며, 내용은 창 크기에 맞춰 다시 배치됩니다. 창은 처음에는 버튼 아래에서 열리고, 저장한 위치가 있으면 그곳에서 열립니다.

- 이동: 제목 표시줄을 끌어 옮기세요. 제목 표시줄에 포커스를 맞추고 방향키를 써도 됩니다. <kbd>Shift</kbd>를 함께 누르면 더 크게 움직입니다.
- 크기 변경: 가장자리나 모서리를 끌어당기세요. 오른쪽 아래 손잡이에 포커스를 맞추고 방향키를 써도 됩니다.
- 고정: **Pin**(고정)을 클릭하세요. 고정한 창은 다른 곳을 클릭해도 열려 있고, 새로고침한 뒤에도 다시 열립니다. 고정하지 않은 창은 창 밖을 클릭하거나 <kbd>Esc</kbd>를 누르면 닫힙니다. 단, 입력 중이거나 열린 메뉴를 쓰는 중에는 닫히지 않습니다.
- 잠금: **Lock**(잠금)을 클릭하세요. 창을 옮기거나 크기를 바꿀 수 없고, 버튼도 제자리에 머뭅니다. 창을 여는 것은 여전히 가능합니다.
- 닫기: **X**를 클릭하세요.

창은 채팅 영역 안에 머뭅니다. 창이나 버튼을 메시지 입력란 옆에 둘 수는 있지만 입력란을 가리지는 않습니다. 휴대폰에서 Chat Settings는 화면 너비의 패널로 열리며 키보드 위 공간에 맞춰집니다.

## 도움말, 트래커, Reset View

제목 표시줄에는 다음 버튼이 있습니다.

- **Help**(**?**)는 채팅의 컨트롤을 설명하는 라벨을 보여 줍니다. 휴대폰에서는 먼저 Chat Settings를 닫습니다. 숨기려면 **Settings → General → App Behavior → Hide chat Help button**(설정 → 일반 → 앱 동작 → 채팅 도움말 버튼 숨기기)을 켜세요.
- **Reset View**(보기 초기화, 원형 화살표)는 확인을 받은 뒤 이 채팅의 처음 배치를 복원합니다. 꺼낸 섹션은 제자리로 돌아가고, 창 크기와 위치, 고정, 잠금이 초기화됩니다.
- **Favorite layout**(즐겨찾는 레이아웃, 별)은 이 배치를 새 채팅용으로 저장합니다. [새 채팅의 배치 고르기](#choosing-a-layout-for-new-chats)를 참고하세요.
- **Tracker Panel**(주사위 아이콘)은 에이전트나 Advanced Memory를 쓰는 Roleplay 채팅에서 패널을 켜고 끕니다. 컴퓨터에서는 채팅 옆에 열립니다. 휴대폰이나 태블릿에서는 이동 가능한 버튼으로 엽니다. **Settings → Appearance**(설정 → 모양)의 Tracker Panel 환경설정도 함께 바뀝니다.

Tracker Panel이 표시되지 않으면 컴퓨터의 트래커는 [Trackers 창](../roleplay/hud-and-trackers.md#the-trackers-window)을 씁니다. 메시지 옆 공간이 좁으면 처음에는 작은 **Trackers**(트래커) 버튼으로 시작합니다. Tracker Panel을 다시 표시하려면 주사위를 누르세요.

<a id="popping-a-section-out-into-its-own-window"></a>

## 섹션을 별도 창으로 꺼내기

섹션을 꺼내면 그 섹션만의 창이 생깁니다.

1. 섹션의 **Pop out**(꺼내기) 버튼(**?** 옆의 화살표가 있는 사각형)을 클릭하세요. 컴퓨터에서는 섹션 제목을 Chat Settings 밖으로 끌어내도 됩니다.
2. 새 창은 Chat Settings처럼 옮기고, 크기를 바꾸고, 고정하거나 잠글 수 있습니다. 처음에는 고정되지 않은 상태이므로 다른 곳을 클릭하면 버튼으로 줄어듭니다.
3. 되돌리려면 **Put back in Chat Settings**(채팅 설정에 되돌려 놓기, **X** 옆의 굽은 화살표)를 클릭하거나, 창을 Chat Settings 위로 끌어다 놓으세요.

**X**는 섹션을 아이콘이 있는 작은 버튼으로 줄입니다. 버튼을 원하는 곳으로 끌어 놓고 클릭하면 창이 다시 열립니다. 트래커도 같은 방식으로 Trackers 창에서 꺼낼 수 있으며, 되돌리는 버튼은 **Put back in Trackers**(트래커에 되돌려 놓기)입니다.

휴대폰에서 섹션을 꺼내면 Chat Settings가 닫히고, 그 섹션이 점 세 개짜리 **Chat tools**(채팅 도구) 메뉴에 추가됩니다. 점 세 개를 탭한 다음 섹션의 둥근 아이콘을 탭하세요. 되돌리려면 **Put back in Chat Settings**를 탭하세요.

<a id="the-phones-chat-tools-menu"></a>

## 휴대폰의 Chat tools 메뉴

이동 가능한 점 세 개 버튼에는 Chat Settings에서 꺼낸 도구가 모입니다. 탭하면 둥근 아이콘 버튼이 펼쳐지고, 도구를 탭하면 열립니다. 점 세 개를 다시 탭하면 접힙니다. 트래커 버튼, Game의 Map 버튼, Character Profiles는 별도로 유지됩니다.

점 세 개 버튼을 끌면 메뉴를 옮길 수 있습니다. 메뉴를 열고 맨 위의 잠금 버튼으로 위치를 고정하세요. 잠금이 풀려 있으면 도구를 위아래로 끌어 순서를 바꾸거나, 도구에 포커스를 맞추고 방향키를 쓰세요. 잠그면 이동과 순서 변경이 모두 막힙니다. 메뉴는 채팅 위젯 스타일을 따릅니다.

<a id="control-windows-and-their-buttons"></a>

## 컨트롤 창과 버튼

일부 도구는 작은 전용 창을 엽니다. Game의 **Game controls**(게임 컨트롤), **Session**(세션), **Volume**(음량), **Game Assets**(게임 에셋), **Connected chat**(연결된 채팅), 설치한 패키지의 컨트롤이 그렇습니다.

컴퓨터에서 이 버튼들은 처음에 채팅 오른쪽 위 근처에 있습니다. 버튼을 클릭하면 창이 열리고, 창을 닫으면 버튼이 돌아옵니다. 휴대폰에서는 **Chat tools** 메뉴에 있으며 화면 너비의 패널로 열립니다.

도구를 Chat Settings 안에 두려면 창을 열고 **Put back in Chat Settings**를 선택하세요. 다시 떼어 내려면 섹션의 꺼내기 버튼을 쓰세요. **Reset View**는 처음 배치를 복원합니다.

버튼을 끌면 옮길 수 있습니다. 끄는 동안 가까운 버튼과 나란히 맞춰집니다. <kbd>Alt</kbd>를 누른 채 자유롭게 배치하거나, 버튼에 포커스를 맞춘 상태에서 방향키를 쓰세요. Conversation의 **Calls**는 일반 버튼으로 남습니다. Game에서는 **Character Profiles**(캐릭터 프로필)와 휴대폰의 **Map**(지도) 버튼을 옮길 수 있으며, 잠그면 게임마다 그 위치가 유지됩니다.

## 채팅마다 저장되는 창 배치

각 채팅은 창 크기와 위치, 고정과 잠금, 꺼낸 섹션, 버튼 위치를 기억합니다. 휴대폰의 위치와 Chat tools의 순서 및 잠금은 컴퓨터의 위치와 따로 저장됩니다. [설정 프로필](settings-profiles.md)로 배치를 저장해 다른 채팅에서 쓸 수 있습니다.

<a id="choosing-a-layout-for-new-chats"></a>

## 새 채팅의 배치 고르기

**Reset View** 옆의 별을 누르면 현재 배치가 같은 모드의 새 채팅에서 처음 배치가 됩니다. Conversation, Roleplay, Game은 각각 즐겨찾는 배치를 따로 가집니다.

1. 창과 버튼을 배치하세요. 도구를 Chat Settings 안에 두거나 밖으로 꺼내세요.
2. 새 채팅에서도 배치 안내를 숨기려면 안내를 숨기세요.
3. 별을 클릭하세요. 현재 배치, 안내, Scoped Regex Scripts 방식이 저장한 즐겨찾는 배치와 같으면 별이 채워집니다.

즐겨찾는 배치에는 위치, 크기, 고정, 잠금, 꺼내거나 안에 넣은 도구, 배치 안내 선택, 채팅의 [Scoped Regex Scripts](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting) 방식이 저장됩니다. **Use preset default**(프리셋 기본값 사용)로 둔 채팅은 방식을 저장하지 않으므로, 새 채팅은 각자의 프롬프트 프리셋을 따릅니다. 캐릭터, 모델, AI 설정, 메시지는 해당 채팅에 남습니다.

즐겨찾는 배치를 바꾸려면 배치를 수정하고 별을 다시 클릭하세요. 사용을 중단하려면 채워진 별을 클릭하세요. 이 변경은 그 뒤에 만드는 채팅에만 영향을 줍니다.

자체 배치가 저장된 설정 프로필을 적용하면 그 배치가 즐겨찾는 배치보다 우선합니다. 저장된 배치가 없는 프로필은 즐겨찾는 배치를 그대로 둡니다. 그래도 프로필은 자체 배치 안내 설정과 Scoped Regex Scripts 방식을 적용합니다. [설정 프로필](settings-profiles.md#favorite-window-layouts)을 참고하세요.

이전 버전에서 업그레이드하면 예전 도구 버튼 배치에 세 모드 모두 이미 별이 붙어 있으며, 바꾸거나 지울 때까지 유지됩니다. 새로 설치하면 도구는 Chat Settings 안에 있고 즐겨찾는 배치는 없습니다.

## 채팅 창의 모양 바꾸기

**Settings → Appearance → App**(설정 → 모양 → 앱)을 열고 **App Style**(앱 스타일) 맨 아래의 **Chat widget style**(채팅 위젯 스타일)까지 스크롤하세요. **Default**(기본값)는 Marinara의 모양을 유지합니다. **Dottore**는 얼음빛 파란색, 옅은 금속색, 잘린 모서리를 씁니다. **Prof. Mari**는 보석 같은 파란색, 따뜻한 금색, 아치형 프레임을 씁니다. 두 스타일 모두 라이트 모드와 다크 모드를 따르며, 세 채팅 모드의 이동 가능한 버튼, 창, 섹션에 스타일을 입힙니다.

- 프리셋 아래의 **Font**(폰트), **Shape**(모양)와 세 가지 색상 선택기로 모양을 조합합니다. Marinara에 설치한 폰트도 폰트 목록에 나타납니다. 프리셋을 다시 고르면 폰트, 모양, 사용자 지정 색상이 초기화됩니다.
- **Button size (px)**(버튼 크기, px)는 이동 가능한 채팅 버튼의 크기를 32부터 96까지 정합니다. 필드를 비우면 기본값을 유지합니다.
- **Apply preset font**(프리셋 폰트 적용), **Apply preset shape**(프리셋 모양 적용), **Apply preset colors**(프리셋 색상 적용)는 이 스타일을 메시지, 입력란, 채팅 컨트롤까지 넓힙니다. 각 스위치는 따로 동작하며 모두 꺼진 상태로 시작합니다. Conversation 메시지는 폰트와 색상을 쓰지만 원래 모양은 유지합니다. **Apply preset colors**를 켜도 따옴표 안의 대사는 각 캐릭터나 페르소나의 Dialogue Highlight Color를 그대로 유지합니다.

이 선택은 창을 옮기지 않습니다. 앱 환경설정과 함께 저장되며 같은 서버에 연결된 브라우저와 동기화됩니다. [사용자 지정 CSS 테마](../appearance/custom-css-themes.md#ready-made-chat-window-styles)를 참고하세요.
