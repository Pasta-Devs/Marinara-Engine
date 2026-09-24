# 캐릭터 만들기와 편집

이 가이드에서는 Marinara Engine에서 캐릭터를 만드는 방법을 설명합니다. Character Editor(캐릭터 편집기)로 카드를 작성하고 저장하고 버전을 관리하는 방법도 함께 다룹니다. **Metadata**(메타데이터), **Card**(카드), **Advanced**(고급) 탭과 아바타, 저장된 버전 히스토리가 대상입니다.

## 캐릭터 카드란

캐릭터 카드는 AI 캐릭터를 정의하는 파일입니다. 그 캐릭터가 누구인지, 어떻게 말하는지, 어떤 모습인지, 채팅이 어떻게 시작되는지가 여기에 담깁니다. 이 내용은 Character Editor에서 작성합니다. 빈 카드부터 직접 만들 수도 있고, 다른 앱에서 가져오거나, 만든 카드를 내보내서 공유할 수도 있습니다.

작성한 글은 대부분 몇 개의 텍스트 필드에 들어갑니다. AI는 답변할 때마다 이 필드를 읽습니다. 그래서 명확하고 구체적으로 쓸수록 캐릭터가 일관되게 유지됩니다.

## 캐릭터 만들기

1. 사이드바에서 **Characters**(캐릭터) 패널을 여세요.
2. **New**(새로 만들기) 버튼(더하기 아이콘)을 클릭하세요. **Create Character**(캐릭터 만들기) 창이 열립니다.
3. 동그란 아바타 자리를 클릭해 그림을 업로드하세요. 이 단계는 선택입니다.
4. **Name \***(이름) 입력란에 이름을 입력하세요. 이름은 필수입니다.
5. **Create**(만들기)를 클릭하세요.

새 카드는 필드가 빈 상태로 저장됩니다. 이어서 전체 Character Editor가 열리므로 나머지를 채우면 됩니다. 이미 카드 파일이 있다면 **New** 대신 **Import**(가져오기)로 시작할 수도 있습니다. [캐릭터 카드 가져오기와 내보내기](import-export.md)를 참고하세요.

## Character Editor 한눈에 보기

Character Editor는 채팅 영역을 전체 화면 작업 공간으로 바꿉니다. 위쪽을 가로지르는 헤더에는 자주 쓰는 요소가 모여 있습니다.

왼쪽 위에는 **Back**(뒤로) 화살표, 아바타 타일, 이름 입력란, 제목 또는 코멘트 입력란이 있습니다. 코멘트 입력란은 `Modern AU version`처럼 짧은 꼬리표를 다는 자리입니다. 그 아래 작은 줄에는 제작자와 버전이 표시됩니다.

오른쪽 위에는 다음 버튼이 있습니다.

- **Save**(저장). 이 버튼은 무언가 바꾸기 전까지 꺼져 있습니다. 라벨은 현재 상태에 따라 **Uploading…**, **Embedding…**, **Saving…**으로 바뀝니다.
- **Favorite**(즐겨찾기) 별. 카드를 즐겨찾기로 표시합니다.
- **Export character**(캐릭터 내보내기).
- **Import character as persona**(캐릭터를 페르소나로 가져오기). 이 카드를 새 사용자 페르소나로 복사합니다.
- **Duplicate character**(캐릭터 복제).
- **Delete character**(캐릭터 삭제).

저장하지 않은 작업이 있는 상태로 나가려고 하면 `You have unsaved changes. Close without saving?` 배너가 뜹니다. 여기서 **Keep editing**(계속 편집), **Discard & close**(취소 & 닫기), **Save & close**(저장 & 닫기)를 고를 수 있습니다.

편집기는 탭으로 나뉩니다. 화면이 넓으면 탭이 왼쪽에 세로로 놓이고, 좁으면 위쪽에 가로로 스크롤되는 띠 형태가 됩니다. 탭은 순서대로 **Metadata**, **Card**, **Convo**(콘보), **Lorebook**(로어북), **Sprites**(스프라이트), **Gallery**(갤러리), **Colors**(색상), **Stats**(스탯), **Advanced**입니다.

이 가이드에서는 **Metadata**, **Card**, **Advanced** 탭과 아바타, 버전 히스토리를 설명합니다. 나머지 탭은 각각 별도 가이드가 있습니다.

- **Convo**: [Conversation Mode 프로필(Display Name, About Me, Behavior)](../conversation/profiles.md).
- **Lorebook**: [로어북을 캐릭터와 페르소나에 연결하기](../lorebooks/linking-to-characters.md).
- **Sprites**: [캐릭터 스프라이트](sprites.md).
- **Gallery**: [캐릭터와 페르소나 갤러리](galleries.md).
- **Colors**와 **Stats**: [캐릭터 색상과 RPG 스탯](colors-and-stats.md).

## Metadata 탭

**Metadata** 탭에는 카드의 신원과 정리에 필요한 정보가 들어갑니다. 카드를 분류하고 공유하고 추적하는 데 쓰이며, 대부분은 AI에 전달되지 않습니다.

- **Character ID**(캐릭터 ID). 읽기 전용 값이며 카드를 저장한 뒤에만 표시됩니다. **Copy**(복사)를 클릭하면 복사됩니다.
- **Name**(이름). 화면에 표시되는 이름입니다. 프롬프트에서 `{{char}}`로 쓰입니다.
- **Phonetic name**(발음 표기 이름). 음성 합성의 발음을 바로잡을 때만 쓰는 선택 항목입니다. 비워 두면 원래 이름을 그대로 씁니다.
- **Creator**(제작자). 카드를 만든 사람입니다. 공유할 때 제작자를 밝히는 데 씁니다.
- **Version**(버전). 직접 정하는 버전 번호입니다. 예를 들어 `1.0`처럼 씁니다.
- **Talkativeness**(수다스러움). 0에서 100퍼센트까지의 슬라이더입니다. 그룹 채팅에서 이 캐릭터가 얼마나 자주 말할지 정합니다. 기본값은 50퍼센트입니다.
- **Tags**(태그). 태그 추가 입력란에 태그를 입력하고 Enter를 누르거나 **Add**(추가)를 클릭하세요. 쉼표로 구분하면 여러 개를 한 번에 추가할 수 있습니다. 태그 하나는 옆의 X로 지우고, 전부 지울 때는 **Remove All**(전체 삭제)을 클릭하세요.
- **Creator Notes**(제작자 노트). AI에 절대 전달되지 않는 비공개 메모입니다. 라이브러리에서는 요약으로 표시됩니다.

**Version history**(버전 히스토리) 패널도 이 탭에 있습니다. 아래 저장과 버전 히스토리 절에서 설명합니다.

## Card 탭

**Card** 탭은 실제로 글을 쓰는 주 작업 공간입니다. AI가 캐릭터를 연기할 때 읽는 필드가 모여 있습니다. 위쪽의 바로 가기 링크로 원하는 구역으로 건너뛸 수 있고, 각 필드에는 실시간 글자 수 표시가 붙습니다.

- **Description**(설명). 캐릭터의 전반적인 정체성과 역할입니다. 모든 프롬프트에 전달됩니다.
- **Personality**(성격). 성격, 말버릇, 행동 양식을 짧게 정리합니다.
- **Backstory**(배경 이야기). 지나온 이력, 출신, 중요한 인간관계입니다.
- **Appearance**(모양). 외모, 옷차림, 시각적 특징입니다. Marinara는 이 글을 AI 아바타 프롬프트의 바탕으로도 씁니다.
- **Scenario**(시나리오). 이 캐릭터로 새 채팅을 시작할 때 쓰는 기본 상황입니다.

**Dialogue & Greetings**(대화 & 그리팅) 구역에서는 채팅이 어떻게 시작되고 캐릭터가 어떤 말투를 쓰는지 정합니다.

- **First Message**(첫 메시지). 새 채팅이 시작될 때 표시되는 첫 메시지입니다.
- **Alternate Greetings**(대체 인사말). 추가로 준비하는 인사말입니다. 채팅을 시작할 때 어느 것을 쓸지 고를 수 있습니다. 위아래 버튼으로 순서를 바꾸고, X로 하나를 지웁니다.
- **Example Dialogue**(예시 대화). 캐릭터의 말투를 알려 주는 대화 예시입니다. 예시를 나눌 때는 `<START>`를 쓰고, 자리 표시자로 `{{user}}`와 `{{char}}`를 씁니다.

첫 인사와 예시 메시지는 캐릭터의 Gallery 이미지도 표시할 수 있습니다. [캐릭터 갤러리 → 메시지와 첫 인사에서 갤러리 이미지 재사용](galleries.md#reuse-a-gallery-image-in-messages-and-greetings)을 참고하세요.

짧은 Example Dialogue 예시는 다음과 같습니다.

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

## 아바타 추가하기

아바타는 채팅과 라이브러리에서 캐릭터를 나타내는 그림입니다. 직접 업로드하거나, 화면에 잡히는 범위를 조정하거나, AI로 생성할 수 있습니다.

### 그림 업로드하기

1. 편집기 헤더의 아바타 타일을 클릭하세요.
2. 이미지 파일을 고르세요. 새 그림이 바로 반영됩니다.

캐릭터에 아바타가 생기면 **Metadata** 탭에 아바타 자르기 도구가 나타납니다. 파일을 다시 올리지 않고도 원 안에서 그림의 위치와 확대 비율을 조정할 수 있습니다. 이 도구에는 아바타를 지우는 기능도 있습니다.

### AI로 아바타 생성하기

AI 아바타 기능은 이미지 생성 연결이 하나 이상 설정되어 있을 때만 나타납니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

1. 아바타 타일 위에 마우스를 올리고 작은 지팡이 모양의 **Generate avatar**(아바타 생성) 버튼을 클릭하세요.
2. **Generate Character Avatar**(캐릭터 아바타 생성) 창이 열립니다.
3. **Image Generation Connection**(이미지 생성 연결)을 고르세요.
4. **Avatar Prompt**(아바타 프롬프트)를 확인하고 필요하면 고치세요. Appearance에 쓴 내용이 미리 채워집니다. Appearance가 비어 있으면 Description을, 그것도 비어 있으면 Personality를 씁니다.
5. 카드에 이미 아바타가 있으면 **Use current avatar as a reference**(현재 아바타를 참조로 사용)를 체크할 수 있습니다.
6. **Generate**(생성)를 클릭하세요. 다시 만들려면 **Regenerate**(재생성)를 클릭하세요.
7. 마음에 드는 결과가 나오면 **Use Avatar**(아바타 사용)를 클릭하세요.

그림 크기는 이미지 생성 설정의 **Portraits**(초상화) 이미지 크기 설정을 따르며, 기본값은 1024 x 1024입니다. **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)을 켜 두었다면 요청을 보내기 전마다 프롬프트를 확인하는 단계가 나타납니다.

## Advanced 탭

**Advanced** 탭에는 숙련자를 위한 프롬프트 제어 항목이 있습니다. 평범한 캐릭터라면 전부 비워 두어도 괜찮습니다.

여기서 캐릭터가 직접 지정하는 프롬프트 제어는 Conversation(대화), Roleplay(롤플레이), Game Mode(게임 모드)에서 모두 적용됩니다. Conversation이나 Game 프리셋을 고르면 둘러싼 프롬프트가 달라지지만, 캐릭터의 Post-History Instructions나 Depth Prompt가 꺼지지는 않습니다.

- **System Prompt**(시스템 프롬프트). 캐릭터별 지시문입니다. 상황에 따라 현재 프리셋의 캐릭터 블록, Conversation의 캐릭터 컨텍스트, Game의 캐릭터/GM 카드를 통해 들어갑니다. 채팅의 주 시스템 프롬프트를 대체하지는 않습니다.
- **Post-History Instructions**(대화 이후 지시사항). 프롬프트 끝부분, 생성 직전에 가깝게 놓이는 글입니다. "Stay in character"처럼 짧게 상기시키는 문구를 많이 씁니다.
- **Depth Prompt**(깊이 주입 프롬프트). 채팅 기록의 정해진 위치에 주입되는 글입니다. **Depth**(깊이)는 몇 개 메시지 앞에 넣을지 정합니다. depth 0은 가장 최근 메시지 바로 뒤이고, depth 4는 4개 메시지 앞입니다. 기본 깊이는 4입니다. **Role**(역할)은 이 글을 **System**(시스템), **User**(유저), **Assistant**(어시스턴트) 중 어느 역할로 넣을지 정합니다. 기본 역할은 System입니다.

이 탭의 **Regex Scripts**(정규식 스크립트) 구역에는 이 캐릭터에만 적용되는 찾아 바꾸기 스크립트가 들어갑니다. 공용 정규식 엔진을 그대로 씁니다. 작동 방식은 [정규식 스크립트](../extending/regex-scripts.md)에서 설명합니다.

## 저장과 버전 히스토리

헤더의 **Save**를 클릭하면 변경 내용이 저장됩니다. 이 버튼은 무언가 편집하기 전까지 꺼져 있다가 편집하면 켜집니다.

저장할 때마다 **Metadata** 탭의 **Version history**에 스냅샷이 추가될 수 있습니다. 처음으로 추가 편집을 하기 전에는 패널에 `Previous card states will appear here after the next edit.`이 표시됩니다. 저장된 스냅샷이 몇 개인지는 카운터로 확인할 수 있습니다.

저장된 버전과 현재 카드를 비교하려면 다음과 같이 하세요.

1. **Metadata** 탭을 여세요.
2. **Version history**에서 저장된 버전을 클릭하세요.
3. **Compare**(비교) 창이 열립니다. Name, Description, Personality, Scenario, First Message, Example Dialogue 같은 필드를 나란히 보여 주고, 달라진 필드를 표시해 줍니다.

이전 버전으로 되돌리려면 다음과 같이 하세요.

1. 원하는 버전의 **Compare** 창을 열거나, 목록에서 그 버전의 복원 아이콘을 클릭하세요.
2. **Restore this version**(이 버전 복원)을 클릭하고 확인하세요.

복원하면 현재 카드가 그 스냅샷으로 바뀝니다. 이때 새 기록 항목은 추가되지 않습니다. 저장된 스냅샷의 카드 버전 라벨만 고치고 싶다면 복원하지 말고 연필 아이콘을 쓰세요. 목록에서 저장된 스냅샷을 지울 수도 있으며, 하나를 지워도 현재 카드는 그대로입니다.

카드의 버전 관리를 처음부터 다시 시작하고 싶다면 **Version history** 헤더의 **Reset**(초기화)을 쓰세요. 확인하면 Marinara가 저장된 스냅샷을 전부 지우고 현재 카드 버전을 `0.0`으로 되돌립니다. 이 작업은 되돌릴 수 없습니다.

## 에이전트가 제안한 카드 수정 검토하기

Roleplay 채팅 중에는 선택 사항인 에이전트가 장면에서 벌어진 일을 바탕으로 카드 필드의 소소한 수정을 제안할 수 있습니다. 제안이 오면 **Review Character Card Updates**(캐릭터 카드 업데이트 검토) 창이 열리므로 결정권은 그대로 유지됩니다. 무엇을 반영할지는 직접 고릅니다.

제안된 수정마다 다음 중 하나를 고를 수 있습니다.

- **Approve**(승인). 수정을 반영합니다. 이때 버전 번호가 올라가고 버전 히스토리 항목도 추가됩니다.
- **Regenerate**. 에이전트에게 다시 제안하도록 요청합니다.
- **Reject**(거부). 제안을 버립니다.

제안이 만들어진 뒤에 원래 글이 바뀌었다면, 앱이 먼저 경고한 다음에야 강제로 반영할 수 있게 합니다. 이런 에이전트를 켜고 끄는 방법은 [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요.

## Professor Mari에 대하여

**Professor Mari**는 Marinara에 기본으로 들어 있는 어시스턴트 캐릭터입니다. 삭제할 수 없습니다. 삭제하려고 하면 앱이 막으면서 기본 캐릭터라고 알려 줍니다. 무슨 일을 하는지는 [Professor Mari, 앱 안의 어시스턴트](../home/professor-mari.md)를 참고하세요.

## 관련 가이드

- [사용자 페르소나: 만들기 및 편집](personas.md)
- [캐릭터 스프라이트](sprites.md)
- [캐릭터와 페르소나 갤러리](galleries.md)
- [캐릭터 카드 가져오기와 내보내기](import-export.md)
- [캐릭터 색상과 RPG 스탯](colors-and-stats.md)
- [Conversation Mode 프로필(Display Name, About Me, Behavior)](../conversation/profiles.md)
- [로어북을 캐릭터와 페르소나에 연결하기](../lorebooks/linking-to-characters.md)
