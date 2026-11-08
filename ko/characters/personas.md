# 페르소나

페르소나는 채팅에서 나를 나타내는 캐릭터 카드입니다. 내 이름, 내 설명, 그 밖의 선택 항목으로 이루어집니다. Marinara는 이 내용을 모든 프롬프트에 담아 보내므로 AI는 누구와 이야기하는지 알 수 있습니다. 페르소나는 여러 개 보관해 두고 채팅마다 하나를 고를 수 있습니다. 페르소나를 사용하는 방법은 [채팅에서 페르소나 선택하기](choosing-your-persona.md)를 참고하세요.

## 페르소나 만들기

1. 상단 탐색 막대에서 **Personas**(페르소나)를 클릭하세요. 보이지 않으면 먼저 **More**(더보기)를 여세요.
2. **New**(새로 만들기)를 클릭하세요. **Create Persona**(페르소나 만들기) 창이 열립니다.
3. **Name**(이름)에 이름을 입력하세요. 필수 항목은 이것 하나뿐입니다.
4. **Create**(만들기)를 클릭하세요.

페르소나는 설명이 빈 상태로 만들어지고 Persona Editor(페르소나 편집기)에서 열립니다.

5. **Card**(카드) 탭을 열고 **Description**(설명)에 내 이름, 외모, 행동 방식을 적으세요.
6. 헤더의 **Save**(저장)를 클릭하세요.

그런 다음 사용할 채팅에서 이 페르소나를 고르세요. [채팅에서 페르소나 선택하기](choosing-your-persona.md)를 참고하세요.

## 페르소나가 하는 일

Marinara는 모든 프롬프트에 페르소나를 담아 AI에 보냅니다. 페르소나를 보내지 않으려면 채팅에서 **None**(없음)을 고르세요. 페르소나가 없으면 AI는 나를 "User"라고 부릅니다.

`{{user}}` 매크로는 자리 표시자입니다. Marinara는 프롬프트를 보내기 전에 이 매크로를 페르소나의 이름으로 바꿉니다. 페르소나의 이름이 Alex라면 `{{user}}`는 Alex가 됩니다. [매크로](../prompts/macros.md)를 참고하세요.

## Personas 패널

**Personas** 패널은 내 페르소나 보관함입니다. 행을 클릭하면 그 페르소나가 Persona Editor에서 열립니다.

| 컨트롤 | 하는 일 |
| --- | --- |
| **Download**(다운로드) | [Card Browser](bot-browser.md)를 엽니다. 여기서 PlotLight의 페르소나도 찾을 수 있습니다. |
| **Open Library**(라이브러리 열기) | 전체 화면 Persona Library(페르소나 라이브러리)를 엽니다. Character Library와 같은 그리드와 미리보기를 씁니다. |
| **New** | 페르소나를 만듭니다. |
| **Import**(가져오기) | **Import Persona**(페르소나 가져오기) 창을 엽니다. |
| **Select**(선택) | 일괄 삭제와 내보내기를 위한 선택 모드를 켭니다. |
| 검색 상자 | 플레이스홀더는 **Search personas/tags**(페르소나/태그 검색)입니다. 이름, 설명, 코멘트, 태그에서 찾습니다. 태그 검색은 [검색](library-organization.md#search)을 참고하세요. |
| 정렬 드롭다운 | **Manual order**, **A-Z**, **Z-A**, **Newest**, **Oldest**, **Tokens**(프롬프트 크기 추정치). |
| **New Folder**(새 폴더) | 폴더를 만듭니다. |
| **Tags**(태그) | 필터링할 태그 목록을 펼칩니다. |

**Manual order**에서는 행을 끌거나, 포커스가 있는 행에서 <kbd>Alt</kbd>+<kbd>Up</kbd> 또는 <kbd>Alt</kbd>+<kbd>Down</kbd>을 누르세요. 터치스크린에서는 행을 길게 눌러 집어 드세요. 행에 마우스를 올리면 **Duplicate**(복제)와 **Delete**(삭제)가 나타납니다. 한 페이지에 다 담기지 않을 만큼 페르소나가 많으면 **Load more**(더 불러오기) 버튼이 나타납니다. 페르소나가 하나도 없으면 패널에 **No personas yet**(아직 페르소나가 없습니다)이라고 표시됩니다.

## Persona Editor

페르소나를 열면 채팅 영역이 전체 화면 Persona Editor로 바뀝니다. 헤더에는 다음이 있습니다.

- **Back**(뒤로) 화살표.
- 아바타 타일. 클릭하면 그림을 업로드합니다. 이미지 생성 연결을 설정해 두었다면 마법봉 버튼으로 그림을 생성할 수도 있습니다.
- 이름 입력란과 코멘트 입력란. 코멘트 입력란은 `Modern AU version` 같은 짧은 라벨용입니다.
- **Save**. 무언가를 바꾸기 전까지는 꺼져 있습니다.
- **Export persona**(페르소나 내보내기), **Add persona as character**(페르소나를 캐릭터로 추가), **Duplicate persona**(페르소나 복제), **Delete persona**(페르소나 삭제).

편집기를 나가면 먼저 변경 내용이 저장됩니다. 저장에 실패하면 초안을 유지한 채 편집기가 열린 상태로 남습니다.

탭은 순서대로 **Metadata**(메타데이터), **Card**, **Convo**(콘보), **Lorebook**(로어북), **Sprites**(스프라이트), **Gallery**(갤러리), **Colors**(색상), **Stats**(스탯)입니다. 각 탭을 누르면 긴 양식 하나에서 해당 구역으로 이동합니다.

Persona Editor는 [캐릭터 편집기](creating-and-editing-characters.md)와 같은 방식으로 동작합니다. 아래 내용은 다른 점을 다룹니다.

| 탭 | 페르소나에서 다른 점 |
| --- | --- |
| **Metadata** | 정체성과 보관함 정보. 이 표 아래 목록을 참고하세요. |
| **Card** | 아래 [Card 탭](#card-tab)을 참고하세요. |
| **Convo** | Conversation(대화) 모드에서만 쓰이는 필드. [Conversation Mode 프로필](../conversation/profiles.md)을 참고하세요. |
| **Lorebook** | 이 페르소나가 채팅에 있을 때 작동하는 로어북 항목을 연결합니다. [로어북 개요](../lorebooks/overview.md)를 참고하세요. |
| **Sprites** | Game과 Roleplay(롤플레이)에서 쓰는 서 있는 캐릭터 그림. **Facial Expressions**, **Full-body**, **Clips**와 **Upload Folder**(폴더 업로드)가 있습니다. [캐릭터 스프라이트](sprites.md)를 참고하세요. |
| **Gallery** | 참고 이미지와 동영상. **Upload Persona Images**(페르소나 이미지 업로드)와 **Upload Persona Videos**(페르소나 동영상 업로드)가 있습니다. [캐릭터와 페르소나 갤러리](galleries.md)를 참고하세요. |
| **Colors** | 이름, 대사, 메시지 말풍선 색상. [캐릭터 색상과 롤플레이 스탯](colors-and-stats.md)을 참고하세요. |
| **Stats** | 상태 막대와 RPG 속성. 아래 [Stats 탭](#stats-tab)을 참고하세요. |

**Metadata** 탭에는 다음이 표시됩니다.

- **Copy**(복사)가 있는 **Persona ID**(페르소나 ID).
- 아바타 자르기.
- **Name**과 **Creator**(제작자).
- **Phonetic name**(발음 표기 이름). 음성 합성이 내 이름을 읽을 때만 쓰입니다.
- **Title / Comment**(제목 / 설명). 짧은 라벨입니다.
- **Version**(버전). 기본값은 `1.0`이고 **Automatic versioning**(자동 버전 관리) 스위치가 있습니다.
- **Tags**.
- **Creator Notes**(제작자 노트). AI에는 절대 전송되지 않습니다.

<a id="card-tab"></a>

### Card 탭

**Card** 탭에는 AI에 나를 설명하는 필드가 들어 있습니다. 필드마다 예상 토큰 수가 실시간으로 표시됩니다.

| 필드 | 쓸 내용 | AI에 전송 |
| --- | --- | --- |
| **Summary**(요약) | 보관함과 미리보기에 표시하는 개요. | 아니요 |
| **Description** | 전반적인 정체성과 역할. | 모든 프롬프트 |
| **Personality**(성격) | 기질, 행동, 말버릇. | 예 |
| **Backstory**(배경 이야기) | 이력, 출신, 인간관계. | 예 |
| **Appearance**(모양) | 외모, 복장, 시각적 세부 사항. | 예 |
| **Scenario**(시나리오) | 롤플레이에서 나의 기본 상황. | 예 |
| **Example Dialogue**(예시 대화) | 대화 예시. `<START>`로 구분하세요. 내 페르소나에는 `{{user}}`, 상대 캐릭터에는 `{{char}}`를 쓰세요. | 예 |

**Appearance** 아래의 **Image Appearance Override**(이미지 외모 재정의)는 캐릭터에서와 똑같이 동작합니다. [Card 탭](creating-and-editing-characters.md#card-tab)을 참고하세요. 텍스트 상자에서는 매크로를 쓸 수 있습니다.

다음 기능은 캐릭터에서와 똑같이 동작하며, 대상이 페르소나라는 점만 다릅니다.

- 각 필드 위의 마법봉 버튼으로 필드를 대신 작성할 수 있습니다. [마법봉으로 카드 필드 생성](creating-and-editing-characters.md#write-a-card-field-with-the-wand)을 참고하세요.
- 각 필드 아래의 **Add Alternative Field**(대체 필드 추가)로 선택한 채팅에 다른 버전을 줄 수 있습니다. **Active in** 목록에는 이 페르소나를 쓰는 채팅만 표시되며, 채팅에서 다른 페르소나를 선택하면 할당이 일시 중지됩니다. [선택한 채팅에서 대체 필드 사용](creating-and-editing-characters.md#use-an-alternative-field-in-selected-chats)을 참고하세요.
- **Version history**(버전 히스토리)는 **Metadata** 탭에 있습니다. 처음 편집하기 전에는 `Previous persona states will appear here after the next edit.`이 표시됩니다. **Reset**(초기화)은 모든 스냅샷을 삭제하고 버전을 1.0으로 설정합니다. [버전 히스토리](creating-and-editing-characters.md#version-history)를 참고하세요.

<a id="stats-tab"></a>

### Stats 탭

**Stats** 탭에는 서로 다른 두 블록이 있습니다. 둘 다 채팅 중 화면에 표시되는 스탯 패널인 HUD에 반영됩니다.

- **Enable Persona Stats**(페르소나 능력치 활성화)는 허기와 기분 같은 욕구를 나타내는 미터인 상태 막대를 켭니다. 새로 켜면 Satiety, Energy, Hygiene, Mood가 각각 100 중 100으로 시작합니다. **Persona Stats**(페르소나 스탯) 에이전트가 이야기 전개에 따라 이 값을 조정합니다.
- **Enable Roleplay Stats**(롤플레이 스탯 활성화)는 Pools(HP와 MP 같은 막대)와 Attributes(힘 같은 숫자)를 켭니다. 둘 다 [캐릭터 색상과 롤플레이 스탯](colors-and-stats.md)에서 설명합니다. 새로 켜면 HP와 MP가 100 중 100으로, STR, DEX, CON, INT, WIS, CHA가 10으로 시작합니다. 이 값은 전투와 Game Mode(게임 모드)에서, 그리고 선택적 굴림에서 페르소나와 함께 전송됩니다. 에이전트는 이 값을 갱신하지 않습니다.

**Game Mode Icon**(Game Mode 아이콘) 블록은 Game Mode 전투에서 내 토큰에 표시할 그림을 정합니다. [Game Mode 아이콘](colors-and-stats.md#game-mode-icon)을 참고하세요. Game Mode 규칙 집합(테이블톱 방식 게임용 규칙 모음)이 설치되어 있으면 **Ruleset sheets**(룰셋 시트) 블록에 그 규칙 집합에서 쓸 내 시작 빌드가 들어갑니다. [규칙 집합 시트](colors-and-stats.md#ruleset-sheets)를 참고하세요. 여기서 정한 값은 새 채팅을 시작할 때의 기본값입니다.

## 페르소나 가져오기와 내보내기

가져오려면 **Personas** 패널에서 **Import**를 클릭하세요. **Import Persona** 창은 `.marinara` 파일과 `.json` 파일을 받으며, 여러 파일을 한꺼번에 가져올 수도 있습니다. Marinara 파일은 페르소나 정보 전체와 스프라이트, 갤러리 구성까지 복원합니다. 다른 도구에서 만든 일반 JSON 파일은 필드를 하나씩 대응시켜 새 페르소나로 만듭니다. 이름은 반드시 있어야 합니다. 파일마다 성공 또는 실패 표시가 나타납니다.

내보내려면 편집기에서 **Export persona**를 클릭하거나, 선택 모드에서 **Export**(내보내기)를 사용하세요. **Export Persona** 창에서는 두 가지 형식을 고를 수 있습니다.

| 형식 | 결과 |
| --- | --- |
| **Marinara Native** | Marinara 페르소나 정보, 스프라이트, 연결된 로어북을 모두 담습니다. Marinara를 설치한 환경끼리 페르소나를 옮길 때 쓰세요. |
| **Compatible JSON** | 다른 도구용으로 기본 페르소나 필드만 담습니다. |

일괄 내보내기를 하면 페르소나마다 파일이 하나씩 든 zip 파일 하나를 다운로드합니다.

## 페르소나 복제하기와 삭제하기

복제하려면 행에서 **Duplicate**를 클릭하거나 편집기에서 **Duplicate persona**를 클릭하세요. 복사본의 이름은 "{original name} (Copy)"이며, 카드 필드, 색상, 스탯, Convo 필드가 모두 유지됩니다. 어느 채팅의 페르소나도 바뀌지 않습니다.

삭제하려면 행에서 **Delete**를 클릭하거나 편집기에서 **Delete persona**를 클릭한 다음 확인하세요. 삭제는 되돌릴 수 없습니다. 여러 개를 삭제하려면 **Select**를 클릭하고 페르소나를 체크한 다음 선택 막대에서 **Delete**를 사용하세요. 삭제에 실패하면 해당 페르소나가 선택된 채로 남으므로 다시 시도할 수 있습니다.

## 페르소나를 캐릭터로 추가하기

편집기 헤더의 **Add persona as character**는 내 캐릭터에 새 카드를 만듭니다. 이름, 설명, 성격, 시나리오, 배경 이야기, 외모, 태그, 제작자, 버전, 아바타를 복사합니다. 페르소나는 그대로 남습니다. 새 카드를 편집하려면 [캐릭터 만들기와 편집](creating-and-editing-characters.md)을 참고하세요.

## 관련 가이드

- [채팅에서 페르소나 선택하기](choosing-your-persona.md)
- [캐릭터 색상과 롤플레이 스탯](colors-and-stats.md)
- [캐릭터 만들기와 편집](creating-and-editing-characters.md)
- [Conversation Mode 프로필](../conversation/profiles.md)
- [매크로](../prompts/macros.md)
