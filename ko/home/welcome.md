# Marinara Engine 시작하기

Marinara Engine은 AI 캐릭터와 채팅하고 롤플레이하는 앱입니다. 내 컴퓨터에서 직접 실행됩니다. 이 가이드에서는 홈 화면과 첫 채팅까지의 단계를 설명합니다.

## 첫 채팅 시작하기

시작하기 전에: AI 서비스에서 받은 API 키(비밀번호 같은 비밀 코드)나, 아래에서 설명하는 **Built-in model**(내장 모델)이 필요합니다.

1. Marinara Engine을 설치하고 브라우저에서 여세요. [Marinara Engine 설치](../INSTALLATION.md)에서 사용 중인 플랫폼을 고르세요.
2. 계정을 추가하세요. 계정은 AI 서비스 하나에 쓰는 API 키 하나입니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.
3. 계정에서 쓸 모델을 고르세요. 방법은 같은 가이드에서 설명합니다.
4. 캐릭터를 만들거나 가져오세요. **Characters**(캐릭터) 패널을 열고 **New**(새로 만들기)를 클릭해 **Create Character**(캐릭터 만들기) 창을 열거나, **Import**(가져오기)를 클릭해 파일에서 카드를 불러오세요. [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)을 참고하세요.
5. 사이드바 버튼으로 채팅 사이드바를 여세요. 탭에는 **CONVO**(대화), **RP**(롤플), **GM**(게임)이라고 적혀 있습니다. 하나를 고른 다음 **+** 버튼을 클릭하세요. 이 버튼의 이름은 탭에 따라 **New Conversation**(새 대화), **New Roleplay**(새 롤플레이), **New Game**(새 게임)으로 바뀝니다.
6. 열리는 설정 창의 안내를 따른 다음 **Create Chat**(채팅 생성)을 클릭하세요.

결과: 새 채팅이 열리고 첫 메시지를 쓸 수 있습니다.

아직 계정이 없으면 계정 추가 창이 먼저 열리고, 마지막에 **Start chatting**(채팅 시작)이 나옵니다. **Set Up** 창에서 계정을 고르라고 하면 목록에서 하나를 고른 다음 **Create Chat**을 클릭하세요.

Marinara에는 온라인 AI가 들어 있지 않습니다. 대부분은 온라인 서비스에 연결합니다. API 키 없이 내 컴퓨터에서 실행되는 작은 모델인 **Built-in model**을 다운로드할 수도 있습니다. 가벼운 보조 작업에 적합하며, 주력 채팅용은 아닙니다. [내장 모델 설정](../connections/local-model.md)을 참고하세요.

Marinara를 처음 열면 짧은 안내 투어가 시작됩니다. [첫 실행 튜토리얼](tutorial.md)을 참고하세요. 단계 중간에 막히면 내장 어시스턴트인 Professor Mari에게 물어보세요. [Professor Mari, 앱 안의 어시스턴트](professor-mari.md)를 참고하세요.

## 홈 화면 한눈에 보기

홈 화면은 열려 있는 채팅이 없을 때 보입니다. 웹 브라우저처럼 생겼으며, 위쪽에 탭과 북마크가 있고 그 아래에 위젯이 있습니다.

- **탭.** **Home**(홈)은 메인 페이지입니다. **Professor**(교수님)는 Professor Mari를 엽니다. 설치한 에이전트 중 일부는 자체 탭을 추가합니다.
- **검색 바.** 컴퓨터에서는 탭 아래의 바를 클릭하거나 <kbd>Ctrl</kbd>+<kbd>K</kbd>(Mac에서는 <kbd>⌘</kbd>+<kbd>K</kbd>)를 눌러 채팅, 캐릭터, 설정 등을 찾을 수 있습니다. 휴대폰, 태블릿, 좁은 창에서는 이 바가 표시되지 않습니다.
- **북마크.** **Discord**, **Support**(지원), **Credits**(크레딧), **Documentation**(문서), **Tutorial**(튜토리얼), **FAQ**, **Achievements**(업적), **Widgets**(위젯)로 바로 가는 링크입니다. **Achievements**는 Achievements 설정이 켜져 있을 때만 보입니다. 북마크는 **Home** 탭에서만 표시됩니다. 휴대폰, 태블릿, 좁은 창에서는 탭 왼쪽의 북마크 버튼인 **Open bookmarks**(북마크 열기)를 탭하면 북마크를 목록으로 볼 수 있습니다.

가운데에는 로고, **Marinara Engine**이라는 글자, 버전 번호가 있습니다. 그 아래의 **Conversation**(대화), **Roleplay**(롤플레이), **Game**(게임) 버튼은 각각 해당 모드로 새 채팅을 시작합니다.

<a id="choose-a-chat-mode"></a>

## 채팅 모드 고르기

채팅을 시작할 때 모드를 고릅니다.

- **Conversation**: 메신저 앱처럼 생긴 단순한 AI 채팅입니다. [Conversation Mode: 시작하기](../conversation/getting-started.md)를 참고하세요.
- **Roleplay**: 캐릭터 한 명 이상이 나오는 이야기입니다. 앱이 장소와 시간 같은 장면 정보를 추적합니다. [Roleplay Mode: 시작하기](../roleplay/getting-started.md)를 참고하세요.
- **Game**: 1인용 게임입니다. AI가 이야기를 들려주는 게임 마스터 역할을 합니다. 동료 무리(파티), 주사위 굴림, 지도, 퀘스트가 함께합니다. [Game Mode: 시작하기](../game/getting-started.md)를 참고하세요.

<a id="home-widgets"></a>

## 홈 위젯

위젯은 보이거나 숨기고 옮길 수 있는 작은 카드입니다.

1. 북마크에서 **Widgets**를 클릭하세요. **Home Widgets**(홈 위젯) 창이 열립니다. 창에는 **Built-in**(기본 제공), **Agents**(에이전트), **Personal**(개인) 아래로 위젯이 나열됩니다.
2. 위젯 옆의 눈 모양 버튼을 클릭하면 위젯을 보이거나 숨길 수 있습니다. 다시 보이게 한 위젯은 홈의 첫 번째 빈자리로 갑니다.
3. 위젯을 옮기려면 오른쪽 위 모서리의 손잡이를 끄세요. 컴퓨터에서는 위젯 위에 마우스를 올리면 손잡이가 나타납니다.

위젯 배치는 이 브라우저에 저장됩니다. 개인 위젯에는 편집 버튼과 삭제 버튼도 있습니다. 창 맨 아래의 **Browser chrome**(브라우저 UI)에는 스위치가 하나 있습니다. **Show URL bar**(URL 표시줄 표시)는 컴퓨터에서 검색 바를 보이거나 숨깁니다.

Professor Mari에게 부탁하면 개인 위젯을 만들어 줍니다. 설치한 에이전트도 위젯을 추가할 수 있습니다.

## 참고: 기본 제공 위젯

| 위젯 | 하는 일 | 처음부터 표시 |
| --- | --- | --- |
| **Professor Mari** | **Ask Professor Mari**(Professor Mari에게 묻기)는 Professor Mari와의 채팅을 엽니다. | 예 |
| **Recent chats**(최근 채팅) | 최근 채팅입니다. 하나를 클릭하면 다시 열립니다. 비어 있으면 **Your chats will show here**(채팅이 여기에 표시됩니다)라고 표시됩니다. | 예 |
| **Learn the engine**(엔진 배우기) | **Documentation**, **Replay tutorial**(튜토리얼 다시 보기), **Read FAQ**(FAQ 보기)로 가는 링크입니다. | 예 |
| **What's New**(새 소식) | **See what's new**(새로운 기능 보기)와 **Read release notes**(릴리스 노트 보기)입니다. | 예 |
| **Community**(커뮤니티) | **Discord**, **Support**, **Credits**로 가는 링크입니다. | 예 |
| **Character Library**(캐릭터 라이브러리) | 날마다 새로 고른 내 캐릭터입니다. | 아니요 |
| **Discovery desk**(탐색 데스크) | 아직 설치하지 않은 에이전트입니다. **Browse agents**(에이전트 둘러보기)는 카탈로그를 엽니다. | 아니요 |
| **Character of the Day**(오늘의 캐릭터) | 라이브러리의 캐릭터 하나를 **Start a chat**(채팅 시작), **View character**(캐릭터 보기)와 함께 보여 줍니다. | 아니요 |
| **Clock & calendar**(시계 및 달력) | 오늘 날짜와 시간입니다. | 아니요 |
| **Achievements** | 최근 업적과 가장 가까운 다음 업적입니다. Achievements 설정이 켜져 있어야 합니다. | 아니요 |

## 도움받는 곳

- 홈 화면에서 Professor Mari에게 물어보세요.
- 빠른 답을 보려면 **FAQ** 북마크를 여세요.
- 앱 안의 가이드를 보려면 **Documentation** 북마크를 여세요.
- **Discord**를 클릭하면 커뮤니티로 연결되고, **Support**를 클릭하면 프로젝트를 후원할 수 있습니다.

무언가 고장 났다면 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 관련 가이드

- [Marinara Engine 설치](../INSTALLATION.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)
- [첫 실행 튜토리얼](tutorial.md)
- [Professor Mari, 앱 안의 어시스턴트](professor-mari.md)
