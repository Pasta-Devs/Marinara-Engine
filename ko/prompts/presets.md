# Preset Editor와 프롬프트 관리

프리셋은 프롬프트의 설계도를 저장해 둔 것입니다. 프롬프트는 Marinara가 답변마다 모델에 보내는 글입니다. 프리셋은 무엇을 어떤 순서로 넣을지 정합니다. 직접 작성한 지시, 캐릭터 카드, 페르소나, 채팅 기록, 로어북 항목 등이 여기에 들어갑니다. **Preset Editor**(프리셋 편집기)로 프리셋을 만든 다음 채팅에 지정하세요.

프리셋은 **Roleplay**(롤플레이) 채팅의 프롬프트를 구성합니다. **Conversation**(대화) 채팅과 **Game** 채팅은 대신 프롬프트 입력란 하나를 씁니다([Conversation 채팅과 Game 채팅](#conversation-and-game-chats) 참고). 프리셋에는 API 키가 필요하지 않지만, 프롬프트를 보내려면 정상 작동하는 계정이 있어야 합니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

## 채팅에 프리셋 지정하기

프리셋은 채팅이 사용해야 비로소 동작합니다. **Roleplay** 채팅에서는 아래 두 방법 중 하나를 쓰세요. 프리셋을 고르려면 채팅에 지정하세요. 직접 만들려면 [프리셋 만들기](#create-a-preset)를 참고하세요.

**Presets**(프리셋) 패널에서 지정하기:

1. 채팅을 여세요.
2. **Presets** 패널에서 프리셋 행을 찾으세요. 컴퓨터에서는 행 위에 마우스를 올리면 버튼이 나타납니다.
3. 체크 표시 모양의 **Assign to chat**(채팅에 할당) 버튼을 클릭하세요. 체크 표시는 프리셋이 사용 중이라는 뜻입니다. 다시 클릭하면 지정이 해제됩니다.

**Chat Settings**(채팅 설정)에서 지정하기:

1. 채팅을 연 다음 **Chat Settings**를 여세요.
2. **Prompt Preset**(프롬프트 프리셋)을 찾아 드롭다운에서 프리셋을 고르세요.

프리셋에 변수가 있으면 **Configure Preset Variables**(프리셋 변수 구성) 창이 열립니다. [프리셋 변수](preset-variables.md)를 참고하세요. 프리셋을 바꾸면 앞서 고른 변수 값은 지워집니다.

<a id="create-a-preset"></a>

## 프리셋 만들기

1. 사이드바에서 **Presets** 패널을 여세요.
2. **New**(플러스 아이콘)를 클릭하세요. **Create Preset**(프리셋 만들기) 창이 열립니다.
3. **Name**(이름)을 입력하세요. 필수 입력란입니다. 원하면 **Description**(설명)도 추가하세요.
4. **Create**(만들기)를 클릭하세요. 프리셋이 **Preset Editor**에서 열립니다.
5. **Sections**(섹션) 탭에서 프롬프트를 구성하세요.
6. 오른쪽 위의 **Save**(저장)를 클릭하세요.

편집기는 저절로 저장하지 않습니다. 바꿀 때마다 **Save**를 클릭하세요. 저장하지 않은 편집 내용이 있는 채로 나가면 **Keep editing**(계속 편집), **Discard**(변경 취소), **Save & close**(저장 & 닫기) 버튼이 있는 경고가 나타납니다.

프리셋을 내보내려면 위쪽 막대에서 툴팁이 **Export preset**(프리셋 내보내기)인 위쪽 화살표 아이콘을 클릭하세요. 저장하지 않은 편집 내용이 있으면 Marinara가 먼저 저장하라고 요청합니다. 프리셋을 삭제하려면 휴지통 아이콘을 클릭하세요.

## Presets 패널

프리셋은 **Prompts**(프롬프트) 섹션에 있습니다. 나머지 섹션은 **Regexes**(정규식)와 **Functions**(기능)입니다. 위쪽 버튼은 **New**, **Import**(가져오기), **Select**(선택)입니다. **Import**는 `.json` 파일을 불러오고, **Select**는 여러 프리셋을 한 번에 내보내거나 삭제할 때 씁니다.

- **Search presets**는 목록을 걸러 냅니다.
- 정렬 메뉴에서는 **Manual order**(수동 정렬), **A-Z**, **Z-A**, **Newest**, **Oldest** 중에서 고릅니다. **Manual order**에서는 행을 끌거나, 포커스가 있는 행에서 <kbd>Alt</kbd>+<kbd>Up</kbd> 또는 <kbd>Alt</kbd>+<kbd>Down</kbd>을 누르세요. 터치스크린에서는 행을 길게 눌러 집어 드세요.
- **New Folder**(새 폴더)로 프리셋을 폴더로 묶을 수 있습니다. 프리셋을 폴더 위로 끌어다 놓고, 폴더 이름은 더블 클릭하거나 두 번 탭해서 바꾸세요.

각 행에는 이름, 래핑 형식, 섹션 개수, 작성자가 표시됩니다. 별표로 지정한 기본 프리셋에는 **DEFAULT**(기본) 배지가 붙습니다. 행을 클릭하면 프리셋이 열립니다.

## Preset Editor의 탭

| 탭 | 담긴 내용 |
| --- | --- |
| **Overview**(개요) | 이름, 설명, 래핑 형식, 작성자. |
| **Sections** | 블록과 마커로 짜는 프롬프트 구조. |
| **Prompts** | Conversation 채팅과 Game 채팅의 모드 프롬프트. |
| **Parameters**(파라미터) | 시작 생성 설정. [생성 파라미터](generation-parameters.md)를 참고하세요. |
| **Regex**(정규식) | 이 프리셋에 연결된 정규식 스크립트와 **Scoped regex default**(범위 정규식 기본값). [정규식 스크립트](../extending/regex-scripts.md)를 참고하세요. |

### Overview 탭

- **Name**은 **Presets** 패널에 표시되는 제목입니다.
- **Description**은 짧은 요약입니다.
- **Wrap Format**(감싸기 형식)은 섹션을 어떤 형식으로 만들지 정합니다([래핑 형식](#wrap-formats) 참고).
- **Author**(작성자)는 선택 사항인 제작자 이름으로, 프리셋을 공유할 때 쓸모가 있습니다.

읽기 전용 카드 두 개에 **Sections**와 **Groups**(그룹) 개수가 표시됩니다.

### Prompts 탭

- **Conversation Mode**(대화 모드)는 이 프리셋의 Conversation 프롬프트를 넣는 텍스트 상자입니다. 비워 두면 내장 프롬프트를 씁니다.
- **Roleplay Mode**(롤플레이 모드)는 여기서 편집할 수 없습니다. Roleplay는 **Sections**에서 조립한 프롬프트를 씁니다.
- **Game Mode**(게임 모드)는 이 프리셋의 Game 프롬프트를 넣는 텍스트 상자입니다. 비워 두면 내장 프롬프트를 씁니다.

기본 제공 **Marinara's Universal Preset**(Marinara 범용 프리셋)은 프롬프트 텍스트는 제공하지만 생성 파라미터는 제공하지 않습니다. 예전에 저장된 샘플링, 추론, 서식, 토큰 설정은 무시되고, 대신 계정 설정, 채팅별 덮어쓰기, 앱 기본값이 적용됩니다. 사용자 지정하려면 수정 가능한 복사본을 만드세요.

## 섹션과 마커

프롬프트는 **Sections** 탭에서 만듭니다. 섹션은 위에서 아래 순서로 조립됩니다.

1. **Add Section**(섹션 추가)을 클릭하세요.
2. **Prompt Block**(프롬프트 블록)이나 마커를 고르세요.

**Prompt Block**은 직접 쓰는 글입니다. 시스템 지시, 어조 규칙처럼 모든 프롬프트에 넣고 싶은 것을 씁니다. 마커에는 자체 글이 없습니다. Marinara가 프롬프트를 보낼 때 채팅의 실제 내용으로 채웁니다.

| 마커 | 삽입되는 내용 |
| --- | --- |
| **Character Info** | 현재 캐릭터 카드의 세부 정보. |
| **Persona**(페르소나) | 현재 페르소나의 세부 정보. |
| **Chat History**(채팅 히스토리) | 채팅 메시지. |
| **Chat Summary**(채팅 요약) | 취합된 채팅 요약. |
| **Dialogue Examples** | 캐릭터의 예시 대화. |
| **Lorebook Marker (All)** | 활성 로어북 항목 전체. |
| **Lorebook Marker (Before)** | 앞에 들어가도록 설정한 로어북 항목. |
| **Lorebook Marker (After)** | 뒤에 들어가도록 설정한 로어북 항목. |

마커 행에는 **MARKER**(마커) 배지가 붙습니다. 대부분의 마커에는 직접 입력할 수 없습니다. 로어북 항목을 앞과 뒤로 나누려는 것이 아니라면 **Lorebook Marker (All)**을 쓰세요.

드물게 쓰는 마커가 세 가지 더 있습니다.

- **Current Scene Summary**(현재 장면 요약)와 **Recalled Scenes**(회상된 장면)는 Advanced Memory Recall이 만든 요약을 배치합니다. **Recalled Scenes** 마커가 없으면 요약은 채팅 기록 앞에 나타납니다. [Memory Recall과 채팅 요약](../agents/memory.md)을 참고하세요.
- **ID Macro Cards**(ID 매크로 카드)는 캐릭터의 카드 ID를 이중 중괄호 안에 입력해 프롬프트로 불러온 캐릭터 카드를 배치합니다. 이 마커가 없으면 기본 위치에 들어갑니다. [프롬프트 매크로](macros.md)를 참고하세요.

활성화된 **Dialogue Examples** 마커가 없으면, 비어 있지 않은 예시 대화가 프리셋의 래핑 형식에 맞춰 **Character Info**의 시나리오 뒤에 덧붙습니다. 위치를 직접 정하려면 이 마커를 추가하세요. Marinara가 예시 대화를 두 번 넣는 일은 없습니다.

채팅에 활성 로어북이 있는데 프리셋에 로어북 마커가 없으면 "Add a lorebook marker when this preset should receive active lorebook entries."라는 경고가 나타납니다. 항목이 모델에 전달되도록 로어북 마커를 추가하세요. [로어북 개요](../lorebooks/overview.md)를 참고하세요.

"inject as section"을 켠 사용자 지정 에이전트가 있으면 추가 메뉴에 **Agent Sections**(에이전트 섹션)가 나타납니다. 각 섹션은 해당 에이전트의 최신 출력을 넣으며, 그 앞뒤로 직접 지시를 덧붙일 수 있습니다.

### 섹션 편집하기

1. 섹션 이름이나 화살표를 클릭해 펼치세요.
2. **Name**이나 역할(**System**, **User**, **Assistant**)을 바꾸세요.
3. **Prompt Block**이라면 **Content**(내용)를 편집하세요. 내용에는 [매크로](macros.md)를 쓸 수 있습니다.
4. 오른쪽 위의 **Save**를 클릭하세요.

행의 컨트롤은 다음과 같습니다.

- **Duplicate**(복제)는 섹션을 복사합니다.
- 눈 아이콘은 섹션을 켜거나 끕니다.
- **Delete**(삭제)는 섹션을 지웁니다.
- 순서를 바꾸려면 손잡이를 끌거나, 위아래 화살표를 쓰거나, 터치스크린에서 길게 누르세요.

### 그룹

그룹은 여러 섹션을 컨테이너 하나로 묶습니다.

1. **Sections** 탭에서 **Groups**를 클릭한 다음 **New Group**(새 그룹)을 클릭하세요.
2. 그룹 이름을 클릭해 이름을 바꾸세요.
3. 섹션을 펼치고 **Group**(그룹) 드롭다운에서 그 그룹을 고르세요.

**XML**이면 그룹은 부모 태그 하나가 됩니다. **MARKDOWN**이면 제목 하나가 됩니다. 그룹을 삭제해도 안에 있던 섹션은 지워지지 않습니다. 그룹에서 빠질 뿐입니다.

### 위치와 깊이

각 섹션의 편집기에는 **Position**(위치)이 있습니다.

- **Ordered (in sequence)**(순서대로)는 섹션을 목록에 놓인 자리에 그대로 넣습니다. 보통은 이 방식을 씁니다.
- **Depth (from end of chat)**(깊이, 채팅 끝 기준)은 **Depth**(깊이) 숫자를 써서, 채팅 끝에서 지정한 메시지 수만큼 위쪽에 섹션을 넣습니다. 깊이가 0이면 마지막 메시지 뒤에 들어갑니다. 모델이 최신 메시지 가까이에서 봐야 하는 당부에 쓰세요.

<a id="wrap-formats"></a>

## 래핑 형식

**Overview** 탭의 **Wrap Format**은 각 섹션을 어떻게 감쌀지 정합니다.

| 형식 | 결과 |
| --- | --- |
| **XML** | 각 섹션이 태그 안에 들어갑니다. 그룹은 부모 태그가 됩니다. 기본값입니다. |
| **MARKDOWN** | 각 섹션에 제목이 붙습니다. 그룹은 한 단계 위의 제목이 됩니다. |
| **NONE** | 감싸지 않습니다. 내용이 쓴 그대로 전송됩니다. |

대부분의 모델에는 XML이 잘 맞습니다. 태그가 없을 때 모델이 더 잘 답하는 경우에만 다른 형식을 시도해 보세요.

**Prompt Block** 하나만 태그나 제목 없이 보내려면 그 블록을 펼치고 **Send without wrapper**(래퍼 없이 전송)를 켜세요. 그룹의 태그가 여전히 블록을 감쌀 수 있으므로, 아무것도 감싸지 않은 상태로 보내려면 블록을 그룹에서 빼세요. 마커는 항상 래퍼를 유지하며, 형식이 **NONE**이면 이 스위치는 표시되지 않습니다.

<a id="conversation-and-game-chats"></a>

## Conversation 채팅과 Game 채팅

이 채팅들은 Sections로 프롬프트를 조립하지 않습니다. 모드 프롬프트 하나를 씁니다. **Chat Settings**의 **Prompt Preset** 섹션에는 저장된 프리셋이 나열된 **Prompt source**(프롬프트 소스) 드롭다운이 있습니다. 처음에는 **Default conversation prompt**(기본 대화(콘보) 프롬프트) 또는 **Default game prompt**(기본 게임 프롬프트)로 시작하며, 프리셋이 하나도 없으면 **No presets available**(사용 가능한 프리셋 없음)이라고 표시됩니다. **Presets** 패널에서는 지정 버튼에 "Prompt presets are not available in conversation mode."가 표시됩니다.

드롭다운 아래의 배지는 프롬프트를 어디서 가져오는지 보여 줍니다.

| 배지 | 의미 |
| --- | --- |
| **Default** | 내장 프롬프트. |
| **Preset** | 고른 프리셋의 프롬프트. |
| **Style**(스타일) | 선택한 GM 프롬프트 스타일의 프롬프트. Game 채팅에만 있습니다. |
| **Custom** | 이 채팅에만 적용되는 채팅 전용 편집본. 다른 모든 것보다 우선합니다. |

텍스트 상자에는 사용 중인 프롬프트가 표시됩니다. 내용을 고치면 채팅 전용 사본이 만들어집니다. 입력한 글이 프리셋이나 기본값과 완전히 같으면 Marinara는 사용자 지정이 아닌 것으로 처리합니다. 사용자 지정 편집본이 있는 동안에는 툴팁이 **Reset to default prompt**(기본 프롬프트로 초기화)인 초기화 아이콘이 나타납니다.

Game 채팅에는 컨트롤이 두 개 더 있습니다. **GM prompt style**(GM 프롬프트 스타일)은 Game 프롬프트만 대체하며, 채팅 전용 편집본이 여전히 우선합니다. **Extra instructions**(추가 지침)는 Game 프롬프트에 글을 덧붙입니다. 길이는 2000자까지이며, "Write in the style of Terry Pratchett." 같은 지시를 넣을 수 있습니다.

<a id="decision-blocks-and-prompt-caching"></a>

## 판정 블록과 프롬프트 캐시

섹션에 `{{#if decision:"..."}}` 판정 블록을 넣으면, 채팅에 관한 문장이 참일 때만 그 부분을 보냅니다. [Decision 모델에 묻기](conditional-prompts.md#asking-the-decision-model)를 참고하세요.

자주 바뀌는 판정 블록은 기록 뒤 지침처럼 프롬프트 뒷부분에 두세요. 분기가 바뀌면 제공자가 그 지점부터 프롬프트를 재사용하지 못할 수 있으므로, 앞부분이 바뀌면 캐시 절감 효과를 대부분 잃습니다. 그보다 앞의 바뀌지 않은 부분은 여전히 재사용될 수 있습니다. 답이 거의 바뀌지 않을 때만 판정을 앞부분에 두세요. [프롬프트 캐시](conditional-prompts.md#prompt-caching)를 참고하세요.

비활성화된 섹션과 그룹의 문장은 절대 묻지 않으며, **Decision statements per turn**(턴당 판단문 수)에도 포함되지 않습니다.

## AI가 받은 내용 확인하기

**Peek Prompt**(프롬프트 미리보기)는 메시지에 대해 조립이 끝난 프롬프트 전체를 보여 줍니다. 이상한 답변의 원인을 찾는 가장 빠른 방법입니다. [Peek Prompt: AI가 받은 내용 확인하기](../chats/peek-prompt.md)를 참고하세요.

## 관련 가이드

- [프리셋 변수](preset-variables.md)
- [프롬프트 매크로](macros.md)
- [생성 파라미터](generation-parameters.md)
- [설정 프로필](../chats/settings-profiles.md)
- [채팅 설정 개요](../chats/chat-settings.md)
- [Peek Prompt: AI가 받은 내용 확인하기](../chats/peek-prompt.md)
