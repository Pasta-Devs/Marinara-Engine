# Card Browser: 캐릭터 찾아서 가져오기

**Card Browser**(카드 브라우저)는 공개 사이트에서 캐릭터 카드를 찾아 Marinara 안에서 바로 라이브러리로 가져옵니다. 그래서 파일을 직접 다운로드하고 업로드할 필요가 없습니다. 예전 버전에서는 **Bot Browser** 또는 **Browser**라고 불렀습니다.

캐릭터 카드는 캐릭터 한 명의 이름, 성격, 인사말을 비롯한 정보를 담은 파일입니다. 기본 설정에서는 둘러보고 가져오는 데 계정도 API 키도 필요하지 않습니다.

## Card Browser 열기

1. 상단 바에서 **Characters**(캐릭터) 또는 **Personas**(페르소나)를 클릭하세요. 보이지 않으면 먼저 **More**(더보기)를 여세요.
2. 위쪽의 **Download**(다운로드) 버튼을 클릭하세요. 툴팁에는 **Download character cards**(캐릭터 카드 다운로드)라고 표시됩니다.

Card Browser는 콘텐츠 영역 전체를 채우며, 제목은 **Browse character cards online**(온라인에서 캐릭터 카드 살펴보기)입니다. 나가려면 왼쪽 위의 뒤로 화살표를 클릭하세요.

닫았다가 다시 열어도 마지막 검색어, 필터, 선택한 캐릭터가 그대로 남아 있습니다. 앱을 새로 고치면 초기화됩니다.

## 소스 고르기

헤더의 소스 버튼을 클릭하세요. 메뉴에는 **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern**, **DataCat**, **PlotLight**, **PlotLight Personas**가 이 순서로 들어 있습니다. 처음에는 **ChubAI**가 선택되어 있습니다. 소스를 바꾸면 검색어, 태그, 필터가 지워집니다. 성인 콘텐츠 설정과 로그인은 소스마다 따로 유지됩니다.

| 소스 | 성인 콘텐츠(NSFW) |
| --- | --- |
| **ChubAI** | **NSFW** 체크박스가 작동합니다. 기본값은 꺼짐입니다. |
| **JannyAI** | **NSFW** 체크박스가 작동합니다. 기본값은 꺼짐입니다. |
| **Pygmalion** | [로그인](#log-in-to-pygmalion)하기 전까지 비활성화되어 있습니다. 로그인하면 Pygmalion 계정 설정을 따릅니다. |
| **Wyvern** | 항상 비활성화되어 있습니다. 대신 **🔞 Popular NSFW** 정렬을 고르세요. |
| **DataCat** | 모든 카드에 성인 태그가 붙어 있어 체크박스가 켜진 상태로 고정됩니다. |
| **PlotLight**와 **PlotLight Personas** | 항상 비활성화되어 있습니다. PlotLight가 자체 규칙을 적용합니다. 성인 태그가 붙은 결과에는 **NSFW** 배지가 붙습니다. |

어디서 시작할지 모르겠다면 첫 번째 소스인 **ChubAI**를 쓰세요. 소스마다 기본 정렬 순서가 다르며, 정렬 드롭다운에서 바꿀 수 있습니다.

성인 카드는 썸네일에 작고 빨간 **NSFW** 배지가 붙습니다. 메뉴에는 **ChubAI**로 적혀 있지만, 카드의 외부 링크는 사이트 자체의 이름을 따서 **View on Chub**으로 표시됩니다.

### DataCat

**DataCat**을 처음 고르면 **DataCat is NSFW only**(DataCat는 NSFW 전용입니다)라는 제목의 창이 나타납니다. 둘러보려면 **Continue to DataCat**(DataCat로 계속)을, 돌아가려면 **Don't continue to DataCat**(DataCat로 계속하지 않기)을 클릭하세요. **Fresh** 정렬은 태그 필터와 검색어가 모두 없을 때만 최신 결과를 보여 줍니다.

### CharacterTavern

CharacterTavern이 사이트를 개편하면서 Marinara가 쓰던 연결을 더 이상 제공하지 않습니다. CharacterTavern을 고르면 결과 대신 안내가 표시됩니다. CharacterTavern이 API 접근을 제공하면 둘러보기 기능이 돌아올 수 있습니다. 그때까지는 다음과 같이 카드를 직접 가져오세요.

1. 안내에서 **Open CharacterTavern**(CharacterTavern 열기)을 클릭하세요. 새 탭에서 사이트가 열립니다.
2. character-tavern.com에서 카드 파일을 다운로드하세요.
3. 안내에서 **Import Character**(캐릭터 가져오기)를 클릭하고 파일을 고르세요. [캐릭터 카드 가져오기와 내보내기](import-export.md)를 참고하세요.

이미 CharacterTavern에서 가져온 캐릭터는 라이브러리에 그대로 남아 있습니다.

### PlotLight

PlotLight는 공개 캐릭터와 페르소나를 공유합니다. **PlotLight**는 캐릭터 카드를 보여 줍니다. **PlotLight Personas**는 채팅에서 나를 대신하는 캐릭터인 페르소나를 보여 줍니다. PlotLight 계정은 필요 없습니다. 상세 화면에는 원본 페이지로 가는 **View on PlotLight** 링크가 있습니다.

Marinara는 PlotLight가 제공하는 파일을 다운로드합니다. 캐릭터 카드는 보통 PNG로 오며, 그 안에 초상화와 제작자가 허용한 로어북이 들어 있습니다. 페르소나는 텍스트 파일로 오고, 그림은 Marinara가 따로 복사합니다. 어느 쪽이든 캐릭터로도, 페르소나로도 가져올 수 있습니다.

PlotLight는 앱이 요청을 보낼 수 있는 빈도를 제한합니다. 너무 빠르게 요청하면 Marinara가 기다려야 할 초와 함께 **PlotLight is busy**라고 알려 주고, 그만큼 기다립니다. 검색과 가져오기에는 제한이 따로 적용됩니다.

제작자가 허용하지 않은 경우처럼 다운로드할 수 없는 카드도 있습니다. 그러면 Marinara가 **PlotLight doesn't offer this for download.**라고 표시합니다. 그 카드는 가져오거나 상세 정보를 볼 수 없지만, 그림, 제작자, **View on PlotLight** 링크는 남습니다.

## 검색, 정렬, 페이지

**Search characters**(캐릭터 검색...)에 입력하세요. <kbd>Enter</kbd>를 누를 필요는 없습니다. 입력을 멈추고 잠깐 지나면 Marinara가 검색하고, 입력란을 비우거나 필터를 바꿔도 다시 검색합니다. 소스마다 정렬 드롭다운이 따로 있습니다. 검색을 다시 실행하려면 **Refresh**(새로고침) 버튼(원형 화살표)을 클릭하세요.

결과 아래에는 **Previous**(이전)와 **Next**(다음)가 있고, **Page 2** 같은 페이지 표시가 함께 나옵니다. 소스가 전체 개수를 알려 주지 못하면 현재 페이지만 표시됩니다. **PlotLight**는 전체 개수를 알려 주지 않으므로 헤더에 **Browsing PlotLight**가 표시됩니다. PlotLight 페이지에는 카드가 적거나 하나도 없어도 뒤에 페이지가 더 있을 수 있습니다. **Next**가 켜진 채로 남으므로 계속 넘겨 볼 수 있습니다.

## 태그로 필터링하기

1. 툴바에서 **Tags**(태그)를 클릭하세요.
2. **Search tags**(태그 검색...)에 입력해 목록을 좁히세요.
3. 태그를 포함하려면 옆의 초록색 체크를, 제외하려면 빨간색 빼기를 클릭하세요. 하나의 태그를 포함과 제외에 동시에 넣을 수는 없습니다.
4. 칩을 클릭해 그 태그를 해제하거나, **Clear**(지우기)를 클릭해 모두 해제하세요.

대부분의 소스에서 목록은 최근 검색 결과에 있던 캐릭터를 바탕으로 만들어집니다. 첫 검색 전에는 패널에 **Tags will appear after searching**(검색하면 태그가 표시됩니다)이라고 표시됩니다. 원하는 태그가 목록에 없으면 이름을 입력하세요. 버튼이 두 개 나타나며, 하나는 필터로 추가하고 다른 하나는 차단합니다. **DataCat**은 가장 인기 있는 태그를 바로 불러오며, 다른 태그도 입력할 수 있습니다. **PlotLight**에서는 Marinara가 입력한 태그를 PlotLight 자체 목록에서 찾으며, PlotLight에 없는 태그는 아무것과도 일치하지 않습니다.

## 추가 필터

대부분의 소스에는 적용 중인 필터 수를 세는 배지가 달린 **Filters**(필터) 버튼이 있습니다. **DataCat**과 **PlotLight**에서는 보이지 않습니다. 패널에는 다음 항목이 들어갈 수 있습니다.

- **Lorebook**, **Alt Greetings** 같은 콘텐츠 체크박스. 그 기능을 가진 캐릭터만 남깁니다. 로어북은 캐릭터가 함께 지니는 추가 배경 정보입니다.
- **ChubAI**와 **Pygmalion**의 **Sort Direction**(정렬). **Descending**(내림차순) 또는 **Ascending**(오름차순)입니다.
- 결과를 크기로 제한하는 **Min Tokens**(최소 토큰)와 **Max Output Tokens**(최대 출력 토큰) 입력란. 비워 두면 소스의 기본값을 씁니다.
- **JannyAI**의 **Show Low Quality** 토글. 꺼져 있으며, 이 상태에서는 JannyAI가 저품질로 표시한 카드가 숨겨집니다.

**Wyvern**에서는 **Lorebook**과 **Alt Greetings** 체크박스, 토큰 입력란이 표시되지만 결과는 바뀌지 않습니다. 대신 정렬 드롭다운과 태그를 쓰세요.

## 캐릭터 살펴보기

결과를 클릭하면 상세 화면이 열립니다. **Back to results**(뒤로 돌아가기)를 클릭하면 목록으로 돌아갑니다.

상세 화면에는 아바타, 이름, 제작자, 짧은 소개 문구, 최대 20개의 태그 칩, 원본 페이지로 가는 **View on** 링크가 표시됩니다. 그 아래에는 소스가 제공하는 경우 **Creator's Notes**, **Personality**, **Scenario**, **First Message**, **Alternate Greetings** 같은 제목 아래에 전체 상세 정보가 표시됩니다. 카드에 로어북이 들어 있으면 호박색 **Has embedded lorebook**(로어북이 내장되어 있음) 배지가 표시됩니다. 소스가 상세 정보를 돌려주지 않으면, 기본 정보만으로도 가져올 수 있다는 안내가 표시됩니다.

## 캐릭터 가져오기

시작하기 전에: 캐릭터와 채팅하려면 작동하는 텍스트 연결이 필요합니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

1. 캐릭터의 상세 화면을 여세요.
2. 아바타 옆에서 **Imported tags**(가져온 태그) 옵션을 고르세요. 기본값은 **All tags**입니다. [가져오기 옵션](import-export.md#import-options)을 참고하세요.
3. **Import**(가져오기)를 클릭하세요. **Import Card**(카드 가져오기) 창이 열리고 **Where should this card live?**(이 카드를 어디에 저장할까요?)라고 묻습니다.
4. 필요하면 **Split description into fields**(설명을 필드별로 분할)를 체크하세요. [가져오기 옵션](import-export.md#import-options)을 참고하세요.
5. **Characters**에 추가하려면 **Import as Character**(캐릭터로 가져오기)를, **Personas**에 추가하려면 **Import as Persona**(페르소나로 가져오기)를 클릭하세요.
6. 카드에 내장 로어북이 있으면 **Embedded lorebook found**(내장 로어북을 찾음) 패널에 항목 수가 표시됩니다. 독립 로어북도 만들려면 **Import Lorebook**(로어북 가져오기)을, 카드 안에만 두려면 **No Import**(가져오지 않음)를 클릭하세요. **Back**(뒤로)을 누르면 5단계로 돌아갑니다.
7. 버튼에 **Importing...**(가져오는 중...)이 표시되는 동안 기다리세요. `Imported "Name" successfully!`라는 메시지가 표시됩니다.
8. **Characters**(또는 **Personas**)를 열어 가져온 캐릭터를 찾으세요.

작동하지 않는 경우: 토스트의 오류 메시지를 읽으세요. **JannyAI**에서는 Cloudflare 차단이 가장 흔한 원인입니다(아래 문제 해결 참고).

### PNG로 다운로드하기

상세 화면에서 **Download as PNG**(PNG 다운로드)를 클릭하면 라이브러리에 추가하지 않고 카드를 표준 PNG 캐릭터 카드로 기기에 저장합니다. 처리하는 동안 버튼에 **Building PNG...**(PNG 생성 중...)가 표시됩니다. 모든 소스에서 작동하며, 파일 이름은 `Some_Character.png`처럼 캐릭터 이름을 따릅니다. PNG 카드는 캐릭터 데이터를 안에 담은 이미지입니다. 공유하거나 다른 앱으로 가져올 수 있습니다.

## 문제 해결

| 문제 | 해결 방법 |
| --- | --- |
| **JannyAI** 검색이나 상세 정보가 Cloudflare(자동 요청을 막는 보안 검사)를 언급하는 오류로 실패하거나, 카드의 전체 정의가 차단됩니다. | 같은 브라우저에서 jannyai.com에 한 번 접속해 확인 절차를 통과하세요. 그런 다음 다시 검색하세요. 그래도 카드가 차단되면 JannyAI에서 카드를 열어 PNG를 다운로드한 뒤 그 파일을 가져오세요. |
| Pygmalion 로그인이 작동하지 않게 되었습니다. | 서버를 다시 시작하면 로그인이 지워집니다. 새 토큰으로 다시 로그인하세요. |
| **CharacterTavern**에 안내만 표시됩니다. | 정상입니다. [CharacterTavern](#charactertavern)을 참고하세요. |
| **PlotLight is busy.** | 메시지에 나온 초만큼 기다린 뒤 다시 시도하세요. |
| **PlotLight doesn't offer this for download.** | 제작자가 다운로드를 허용하지 않았거나 카드가 더 이상 공개 상태가 아닐 수 있습니다. **View on PlotLight**로 확인하세요. |
| 검색이 실패하거나 소스가 작동하지 않습니다. | 공개 사이트는 언제든 바뀌거나 접근을 막을 수 있습니다. 나중에 다시 시도하거나, 사이트에서 카드를 다운로드해 일반 가져오기를 사용하세요. [캐릭터 카드 가져오기와 내보내기](import-export.md)를 참고하세요. |

<a id="log-in-to-pygmalion"></a>

## Pygmalion에 로그인하기

Pygmalion은 성인 콘텐츠를 로그인 뒤에 숨겨 둡니다. 공개 캐릭터를 보는 데는 로그인이 필요 없습니다. Marinara는 비밀번호를 묻지 않습니다. 내 계정에서 복사한 값을 붙여넣으면 됩니다.

1. 툴바에서 **Log In**(로그인)을 클릭하세요. **Pygmalion Authentication**(Pygmalion 인증) 창이 열립니다.
2. 브라우저에서 pygmalion.chat에 접속해 로그인하세요.
3. 브라우저의 개발자 도구를 여세요. 개발자 도구는 브라우저에 기본으로 들어 있는 고급 사용자용 패널입니다. 대부분의 컴퓨터 브라우저에서는 <kbd>F12</kbd>를 누르면 열립니다. 휴대폰 브라우저에는 보통 없으므로 이 단계는 컴퓨터에서 하세요.
4. **Application** 탭을 연 다음 **Local Storage**를 여세요.
5. `authn`이라는 이름의 항목을 찾아 그 값을 복사하세요.
6. Marinara의 **Auth Token**(인증 토큰)에 붙여넣으세요. 붙여넣은 값은 입력란에서 가려집니다.
7. **Save & Connect**(저장 & 접속)를 클릭하세요. NSFW 콘텐츠가 활성화되었다는 메시지가 표시됩니다.

창에는 이 단계를 다시 안내하는 도움말 영역과 pygmalion.chat으로 가는 **Website**(웹사이트) 링크가 있습니다.

Marinara는 먼저 Pygmalion에 토큰을 확인합니다. Pygmalion이 거부하면 아무것도 저장되지 않으며, 그 이유를 알려 주는 메시지가 표시됩니다. 나중에 Pygmalion이 토큰을 더 이상 받아들이지 않으면 Marinara가 로그아웃 처리한 뒤 다시 로그인하라고 안내합니다.

로그인 정보는 서버 메모리에만 보관됩니다. 파일로 저장되지 않으므로 Marinara 서버를 다시 시작하면 로그아웃됩니다. 직접 로그아웃하려면 창을 다시 열고 **Log Out**(로그아웃)을 클릭하세요. 완전히 로그아웃하려면 pygmalion.chat에서도 로그아웃하세요.

## 관련 가이드

- [캐릭터 카드 가져오기와 내보내기](import-export.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [문제 해결](../TROUBLESHOOTING.md)
