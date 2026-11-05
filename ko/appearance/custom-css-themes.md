# 사용자 지정 CSS 테마(Theme Library)

사용자 지정 CSS 테마는 Marinara 전체를 다시 칠합니다. **Theme Library**(테마 라이브러리)에서 테마를 만들고, 가져오고, 내보내고, 바꿀 수 있습니다. 이 가이드에서는 테마에서 쓸 수 있는 CSS 변수와 클래스, 테마가 Card CSS와 함께 동작하는 방식도 설명합니다. CSS 없이 빠르게 바꾸려면 [바로 쓸 수 있는 채팅 창 스타일](#ready-made-chat-window-styles)을 참고하세요.

시작하기 전에: 휴대폰 같은 다른 기기에서 Marinara를 연다면, 테마를 만들고, 편집하고, 가져오고, 활성화하고, 제거하기 전에 서버에 관리자 시크릿이 있어야 합니다. 서버를 실행하는 컴퓨터에서는 시크릿이 필요 없습니다.

1. 서버의 `.env` 파일에 `ADMIN_SECRET`을 설정하세요.
2. 앱에서 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)를 열고 같은 값을 입력하세요.

[서버 설정 참고 문서](../CONFIGURATION.md)와 [원격 접근](../REMOTE_ACCESS.md) 가이드를 참고하세요. 다른 사람에게 받은 테마로 바꾸려면 [테마 활성화하기](#activating-a-theme)로 이동하세요.

## 사용자 지정 테마란

CSS는 Cascading Style Sheets의 줄임말로, 색, 테두리, 여백을 정하는 코드입니다. 테마는 페이지 배경, 강조색, 카드, 테두리, 글자 등을 바꿀 수 있는 CSS 덩어리입니다.

테마는 Marinara 서버의 **Theme Library**에 저장되므로 같은 서버에 접속하는 모든 기기와 동기화됩니다. 다른 모양 설정은 대부분 한 기기에만 남습니다. 한 번에 활성화할 수 있는 테마는 하나뿐이며, 테마는 원하는 만큼 보관할 수 있습니다.

## Theme Library 위치

1. **Settings**(설정)를 여세요.
2. **Addons**(애드온) 탭을 여세요.
3. **Theme Library** 섹션을 찾으세요.

## 테마 만들기

1. **Theme Library** 섹션에서 **Create Theme**(테마 만들기)를 클릭하세요.
2. 이름 입력란(플레이스홀더에 "Theme name..."이 표시됩니다)에 이름을 적으세요.
3. 큰 텍스트 상자에 CSS를 쓰거나 붙여넣으세요.
4. 입력하는 동안 변경 사항을 바로 보려면 **Preview**(미리보기)를 켠 채로 두세요. 실시간 미리보기를 멈추려면 끄세요.
5. **Save**(저장)를 클릭하세요.

새 테마는 자주 쓰는 변수가 주석 처리된 예시로 들어 있는 템플릿에서 시작합니다. 주석 기호를 지우고 원하는 값을 넣으세요. 완전히 새로운 테마는 저장하면 바로 활성화되며, 다음 메시지가 표시됩니다: Theme "My Theme" saved and activated.

나중에 테마를 고치려면 **Installed Themes**(등록된 테마)에서 테마를 찾아 코드 아이콘(툴팁 **Edit theme CSS**(테마 CSS 편집))을 클릭하고, 내용을 고친 뒤 **Save**를 클릭하세요. 편집해도 활성화된 테마는 바뀌지 않습니다.

## 테마 가져오기와 내보내기

테마를 가져오는 방법은 다음과 같습니다.

1. **Theme Library** 섹션에서 **Import File**(테마 가져오기)을 클릭하세요.
2. `.css` 또는 `.json` 파일을 고르세요.
3. 메시지를 확인하세요. 가져온 테마, 건너뛴 테마, 실패한 테마의 개수를 알려 줍니다.

`.css` 파일 하나는 테마 하나가 되며, 이름은 파일 이름을 따릅니다. `.json` 파일에는 테마를 하나 이상 담을 수 있습니다. Marinara에서 내보낸 파일은 그대로 가져오거나, 다음과 같은 간단한 파일을 직접 작성하세요.

```json
{ "name": "My Theme", "css": "..." }
```

가져온 테마는 저절로 활성화되지 않습니다. 서버에 이미 있는 테마와 이름과 CSS가 모두 같은 테마는 건너뜁니다.

테마를 내보내려면 **Installed Themes**에서 그 테마 줄의 업로드 아이콘(툴팁 **Export theme**(테마 내보내기))을 클릭하세요. Marinara가 다른 곳에서 가져올 수 있는 `.json` 파일을 다운로드합니다.

<a id="activating-a-theme"></a>

## 테마 활성화하기

**Installed Themes**에는 모든 테마가 표시되고, 맨 위에 **Default Theme**(기본 테마) 항목이 있습니다.

1. 테마 이름을 클릭하면 그 테마가 활성화됩니다. 활성화된 테마에는 체크 표시가 붙습니다.
2. **Default Theme**를 클릭하면 사용자 지정 테마가 꺼지고 기본 제공 모양으로 돌아갑니다.

**Settings → Appearance**(설정 → 모양)의 **App Style**(앱 스타일) 맨 위에 있는 **Reset Appearance**(외형 초기화)도 활성화된 테마를 끕니다.

테마를 삭제하려면 휴지통 아이콘(툴팁 **Remove theme**(테마 제거))을 클릭하고 **Delete Theme**(테마 삭제) 창에서 확인하세요. 테마의 CSS가 서버에서 영구적으로 삭제됩니다.

작동하지 않는 경우: 앱 모양이 이상하면 활성화된 테마와 채팅의 Card CSS를 모두 확인하세요. [테마와 Card CSS](#themes-and-card-css)를 참고하세요.

<a id="ready-made-chat-window-styles"></a>

## 바로 쓸 수 있는 채팅 창 스타일

시작하기 전에: 이 방법에는 CSS가 필요 없습니다.

1. **Settings → Appearance → App**(설정 → 모양 → 앱)을 여세요.
2. **App Style** 아래쪽에서 **Chat widget style**(채팅 위젯 스타일)을 찾으세요.
3. 스타일을 고르세요.

| 스타일 | 모습 |
| --- | --- |
| **Default**(기본값) | 원래 모습입니다. |
| **Dottore** | 얼음빛 파란색 계기판 프레임, 옅은 금속색 테두리, 잘린 모서리. |
| **Prof. Mari** | 금색 테두리의 이야기책 프레임, 보석 같은 파란색, 창 제목의 Primogem. 버튼 배경은 창 배경과 같습니다. |

각 스타일에는 고유한 글꼴이 있고, 라이트 모드와 다크 모드에서 모두 동작하며, 버튼, 창, 펼치는 섹션을 함께 꾸밉니다. 스타일을 고르면 **Font**(폰트), **Shape**(모양), 세 가지 색상이 모두 초기화됩니다. 창 위치는 그대로 유지됩니다.

다음 항목은 따로 바꿀 수 있습니다.

- **Font**와 **Shape**는 다른 값을 고르기 전까지 스타일을 따릅니다(**Preset font**(프리셋 폰트), **Preset shape**(프리셋 모양)).
- **Border & Buttons Color**(테두리 및 버튼 색상)는 윤곽선과 버튼 아이콘의 색을 바꿉니다. 아이콘은 그라데이션의 첫 색을 사용합니다.
- **Background Color**(배경 색상)는 버튼, 창, 펼치는 섹션, 편집 가능한 필드를 채웁니다.
- **Text Color**(텍스트 색상)는 위젯 글자의 색을 바꿉니다. 그라데이션은 제목과 라벨에 나타나고, 편집 가능한 필드는 첫 색을 사용합니다.

각 색상에는 단색을 고르는 색상 선택기와 그라데이션 옵션이 있습니다. 컨트롤 옆의 **Reset color**(색상 초기화)를 누르면 다시 스타일의 라이트 모드나 다크 모드 색상을 따릅니다. 장식 문양은 원래 색을 유지합니다.

### 채팅에 스타일 적용하기

색상 선택기 아래의 스위치 세 개로 스타일을 채팅까지 넓힐 수 있습니다. 각 스위치는 꺼진 상태로 시작하며 독립적으로 동작합니다. 스위치를 끄면 해당 부분이 원래 채팅 스타일로 돌아가고, 다른 스타일을 골라도 스위치 선택은 유지됩니다.

| 스위치 | 적용하는 내용 |
| --- | --- |
| **Apply preset font**(프리셋 폰트 적용) | 위젯 글꼴. 메시지, 입력란, 채팅 컨트롤에 적용됩니다. |
| **Apply preset shape**(프리셋 모양 적용) | 프레임 모양. Roleplay 메시지(클래식 및 비주얼 노벨), Game 대화 상자, 입력란, 컨트롤에 적용됩니다. Conversation 메시지는 원래 모양을 유지합니다. |
| **Apply preset colors**(프리셋 색상 적용) | 해당 영역의 테두리, 배경, 글자 색상. Conversation 메시지도 포함합니다. 사용자 지정 색상과 그라데이션도 적용됩니다. 따옴표 안의 대사는 각 캐릭터나 페르소나에 지정된 Dialogue Highlight Color를 그대로 유지합니다. 에이전트의 스타일 카드처럼 HTML로 된 메시지는 자체적으로 지정한 글자 색상을 유지합니다. |

기록 버튼인 **Load More**(더 불러오기)와 **Show older**(이전 보기)도 다른 채팅 컨트롤처럼 이 스위치를 따릅니다. Game Mode에서는 스위치가 부가 발언, HUD 위젯, 지도 패널, 캐릭터 시트, 로그, 인벤토리, 전투 패널과 팝업 창에도 적용됩니다. Professor Mari가 이 영역의 사용자 지정 테마를 만들어 줄 수도 있습니다.

사용자 지정 테마로 스타일을 덮어쓸 수도 있습니다. 아래의 창 및 드로어 변수는 스타일의 색상보다 우선합니다. 창 글꼴에는 `--mari-window-font-family`, 섹션 모서리에는 `--mari-drawer-radius`를 사용하고, 제목 장식을 숨기려면 `--mari-window-ornament: none`을 사용하세요. 스타일 장식을 모두 없애려면 먼저 **Default**를 고르세요.

<a id="themes-and-card-css"></a>

## 테마와 Card CSS

Marinara에는 사용자 지정 CSS를 넣는 방법이 두 가지 있으며, 둘 다 동시에 켜 둘 수 있습니다.

- 사용자 지정 테마는 앱 전체를 다시 칠합니다. Marinara의 핵심 변수를 덮어쓸 수 있고, `!important`와 `position: fixed`도 쓸 수 있습니다.
- Card CSS는 캐릭터나 페르소나 카드에 들어 있으며 채팅별로 켭니다. 더 엄격하게 걸러지므로 핵심 변수를 덮어쓸 수 없고, `!important`는 제거되며, `position: fixed`는 `position: absolute`로 바뀝니다. 앱 전체가 아니라 채팅 메시지의 모양을 바꿉니다. [카드 CSS 테마 가이드](card-css-theming.md)를 참고하세요.

## 크기와 이름 제한

테마 이름은 200자까지 쓸 수 있습니다. CSS는 UTF-8 바이트 기준으로 최대 256 KiB입니다. 이보다 큰 테마는 저장하거나 가져올 때 거부됩니다. 사용자 지정 테마의 CSS는 실행 전에 걸러지기도 하므로, 다른 웹사이트에서 파일을 불러오는 스타일은 동작하지 않습니다. 대신 이미지나 글꼴을 `data:` URI로 심으세요.

## CSS 변수 참조

테마 편집기에는 펼칠 수 있는 **CSS Variable Reference**(CSS 변수 참조) 항목이 있습니다. 이 항목을 클릭하면 덮어쓸 수 있는 가장 쓸모 있는 변수를 볼 수 있습니다. 테마는 `:root` 블록에서 이 변수들의 값을 정하는 방식으로 앱의 모양을 바꿉니다. 참조 목록에 나오는 변수는 다음과 같습니다.

| 변수 | 적용 대상 |
| --- | --- |
| `--background` | 페이지 배경 |
| `--foreground` | 본문 글자 |
| `--primary` | 강조색과 버튼 |
| `--primary-foreground` | primary 위에 올라가는 글자 |
| `--secondary` | 카드와 입력란 |
| `--card` | 카드 배경 |
| `--border` | 테두리 |
| `--muted-foreground` | 흐린 글자 |
| `--sidebar` | 사이드바 배경 |
| `--sidebar-border` | 사이드바 테두리 |
| `--marinara-shell-edge-border` | 화면 좌우 가장자리 |
| `--destructive` | 오류와 삭제 |
| `--popover` | 드롭다운 배경 |
| `--accent` | 마우스를 올렸을 때의 강조 |

테마는 이 목록뿐 아니라 Marinara가 쓰는 CSS 변수라면 무엇이든 정할 수 있습니다. 일부 효과에는 전용 변수가 있습니다. 예를 들어 `--marinara-theme-accent-pulse: enabled`는 강조색이 맥동하는 애니메이션을 요청합니다.

## 채팅 창과 드로어 꾸미기

컴퓨터에서 **Chat Settings**(채팅 설정)는 이동 가능한 창으로 열립니다. 펼치고 접는 섹션을 **드로어**라고 합니다. 드로어를 별도 창으로 꺼낸 뒤 작은 이동 버튼으로 최소화할 수 있습니다. 이 버튼을 **버블**이라고 합니다.

Game controls, Session, Volume, Game Assets, 연결된 채팅과 패키지 컨트롤 등 다른 채팅 도구도 이 창과 버튼을 사용합니다. 휴대폰에서는 대부분의 창이 화면 너비의 패널로 열립니다. Echo Chamber는 이동과 크기 조절이 가능한 작은 창으로 유지됩니다. Chat Settings에서 꺼낸 도구는 이동 가능한 점 세 개짜리 **Chat tools**(채팅 도구) 메뉴에 모이며, 트래커 버튼은 별도로 유지됩니다.

아래의 클래스, 데이터 속성, 변수로 이 요소를 함께 꾸밀 수 있습니다. 테마의 규칙은 `!important` 없이 기본값을 덮어씁니다.

### 클래스

| 요소 | 클래스 |
| --- | --- |
| 창 | `.mari-window` |
| 제목 표시줄 | `.mari-window__header` |
| 제목과 아이콘 | `.mari-window__title-row` |
| 제목 | `.mari-window__title` |
| 제목 표시줄 버튼(Reset View, 즐겨찾는 배치의 별, Tracker Panel, 고정, 잠금, 닫기, 되돌려 놓기) | `.mari-window__controls`(각 버튼은 `.mari-window__control`) |
| 창 내용 | `.mari-window__body` |
| 크기 조절 가장자리와 모서리 | `.mari-window__resize-handle` |
| 포인터나 포커스가 창 안에 있을 때 보이는 모서리 표시 | `.mari-window__resize-grip` |
| 드로어 | `.mari-drawer` |
| 드로어 헤더와 제목 | `.mari-drawer__header`, `.mari-drawer__title` |
| 드로어 아이콘, 개수 배지, **?** | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| 접힌 드로어의 미리보기(작은 트래커 위젯) | `.mari-drawer__summary` |
| 화살표 옆의 드로어 버튼과 별도 창 버튼 | `.mari-drawer__actions`, `.mari-drawer__popout` |
| 드로어 화살표와 내용 | `.mari-drawer__arrow`, `.mari-drawer__body` |
| 드로어를 밖으로 끌 때 포인터를 따라가는 미리보기 | `.mari-drawer-ghost` |
| 최소화한 창의 버튼(버블) | `.mari-window-bubble` |
| 아이콘 대신 버블에 표시되는 실시간 요약(World State의 배너) | `.mari-window-bubble__banner` |
| 끌고 있는 버블이 다른 버블과 나란히 맞춰질 때 보이는 선 | `.mari-window-snap-guide` |
| 에이전트 실행 중에 보이는 점(Chat Settings 버튼, Trackers 창) | `.mari-agents-running-dot` |

### 데이터 속성

- `data-window`는 창과 버블의 이름입니다. `chat-settings`, `trackers`, 컨트롤 창의 `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>`, `control:beholder:<package>`와, 밖으로 꺼낸 드로어의 `drawer:<window>:<drawer>`를 사용합니다. 예를 들어 `drawer:chat-settings:chat-name`입니다.
- `data-drawer`는 드로어의 이름이며 예를 들면 `chat-name`입니다. `roleplay-agents`나 `conversation-agents`처럼 채팅 모드로 시작하는 이름도 있습니다. 트래커는 `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom`, `agent-activity`를 사용합니다.
- `data-presentation`은 컴퓨터 창에서 `"window"`, 휴대폰 패널에서 `"sheet"`입니다.
- 창이 고정되거나 잠겨 있으면 `data-pinned`와 `data-locked`는 `"true"`입니다.
- `data-window-control`은 제목 표시줄 버튼의 이름으로 `"pin"`, `"lock"`, `"close"`, `"put-back"`을 사용합니다. 눌린 고정이나 잠금 버튼에는 `aria-pressed="true"`도 있습니다.
- `data-chat-settings-control`은 Chat Settings의 추가 제목 표시줄 버튼을 구분합니다. `"reset-view"`, `"favorite-layout"`, `"tracker-panel"`입니다. 현재 배치가 저장한 즐겨찾기와 같으면 별 아이콘이 채워지고 `aria-pressed="true"`가 됩니다.
- 각 크기 조절 손잡이의 `data-edge`는 `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"`, `"sw"`입니다.
- 열린 드로어의 `.mari-drawer__header` 안에 있는 토글 버튼에는 `aria-expanded="true"`가 있습니다.
- `data-drawer-control="pop-out"`은 드로어의 별도 창 버튼을 표시합니다.
- `data-outside="true"`는 놓았을 때 별도 창이 될 만큼 원래 창 밖으로 나온 드래그 미리보기를 표시합니다.
- `data-axis`는 세로로 뻗은 정렬 안내선에서 `"x"`, 가로로 뻗은 안내선에서 `"y"`입니다.
- 드로어가 별도 창에 표시되면 창과 그 안의 드로어에 모두 `data-detached`가 `"true"`로 설정됩니다. 꺼낸 드로어의 창 이름은 `data-window="drawer:<window>:<drawer>"`이며, 예를 들면 `data-window="drawer:chat-settings:chat-name"`입니다. `data-drawer-host`는 원래 들어 있던 창의 이름입니다.
- 드로어 제목을 끌고 있는 동안 드로어의 `data-dragging`은 `"true"`입니다. 꺼낸 드로어를 되돌릴 창 위에 올려 두면 그 창의 `data-drop-target`이 `"true"`가 됩니다.
- 버블에는 해당 창의 `data-window`와 `data-minimized="true"`가 있습니다. 예를 들면 `.mari-window-bubble[data-window="control:volume"]`입니다. 컨트롤 창의 이름은 `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>`, `control:beholder:<package>`입니다. 버블을 끌고 있는 동안 `data-dragging`은 `"true"`입니다. 최소화한 World State 트래커처럼 아이콘 대신 실시간 요약을 보여 주는 버블에는 `data-banner="true"`가 있으며, 요약 너비만큼 넓어집니다.
- 잠긴 버블에는 `data-locked="true"`가 있으며 Chat Settings 버튼도 마찬가지입니다. 창을 열 수는 있지만, 창의 잠금을 풀기 전까지 옮길 수 없습니다. `.mari-window-bubble[data-locked="true"]`로 이 버튼의 모양을 구분할 수 있습니다.
- 휴대폰에서는 창과 조금 더 큰 버블에 모두 `data-presentation="sheet"`가 있습니다. Tracker Panel의 버블은 `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`입니다.
- Chat Settings 버튼도 버블입니다. `.mari-window-bubble[data-chat-settings-button]`이며 Chat Settings가 열려 있으면 `data-open="true"`가 있습니다.
- 밖으로 꺼낸 섹션은 원래 창을 가리키는 `data-drawer-host`가 있는 버블로 최소화됩니다. 그 창의 **Put back**(되돌려 놓기) 버튼은 `[data-window-control="put-back"]`입니다.

### 변수

각 변수는 값을 지정하지 않으면 공통 채팅 UI 색상을 사용합니다. 바꾸고 싶은 변수만 테마에 넣으면 됩니다.

| 변수 | 바뀌는 요소 |
| --- | --- |
| `--mari-window-bg` | 창 배경 |
| `--mari-window-text` | 창 글자 |
| `--mari-window-border`, `--mari-window-border-width` | 창 테두리 |
| `--mari-window-radius` | 창 모서리의 둥글기 |
| `--mari-window-shadow` | 창 그림자 |
| `--mari-window-backdrop-filter` | 창 뒤의 흐림 효과 |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | 제목 표시줄 색상 |
| `--mari-window-header-padding` | 제목 표시줄 여백 |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | 즐겨찾는 배치의 별을 포함한 제목 표시줄 버튼 |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | 고정, 잠금, 채워진 별 등 눌린 제목 표시줄 버튼 |
| `--mari-window-control-radius`, `--mari-window-control-gap` | 버튼 둥글기와 간격 |
| `--mari-window-focus-ring` | 키보드 포커스 윤곽선과 드로어를 되돌릴 창의 윤곽선 |
| `--mari-window-resize-handle-size` | 크기 조절 가장자리의 너비 |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | 버블 크기, 둥글기, 그림자 |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | 버블 배경과 테두리 |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | 버블 아이콘 색상 |
| `--mari-window-snap-guide` | 정렬 안내선 색상 |
| `--mari-drawer-bg`, `--mari-drawer-border` | 드로어 배경과 구분선 |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | 드로어 헤더 색상 |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | 드로어 여백 |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | 드로어 헤더의 글자와 아이콘 |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | 드로어의 개수 배지 |

모든 창을 바꾸려면 `:root`에 변수를 지정하세요. 특정 창만 바꾸려면 해당 선택자에 지정하세요.

```css
:root {
  --mari-window-radius: 0.5rem;
  --mari-window-bubble-bg: #3b0764;
}

[data-window="chat-settings"] .mari-drawer[data-drawer="chat-name"] {
  --mari-drawer-border: transparent;
}
```

<a id="styling-messages-input-boxes-and-chat-controls"></a>

## 메시지, 입력란과 채팅 컨트롤 꾸미기

세 가지 **Apply preset** 스위치를 사용하면 사용자 지정 테마에서도 채팅의 나머지 영역에 위젯 디자인을 적용할 수 있습니다. 아래 변수로 각 부분을 덮어쓸 수 있습니다. 직접 CSS를 작성하고 싶지 않다면 Professor Mari에게 어울리는 채팅 테마를 요청하세요.

| 부분 | 클래스 |
| --- | --- |
| Roleplay와 Game 메시지 상자, Game 부가 발언, HUD 위젯, 지도 패널, 캐릭터 시트와 채팅 입력란 | `.mari-chat-style-surface` |
| Game 로그, 인벤토리, 전투 패널, 선택지와 팝업 창. 각 패널에는 `logs`, `inventory`, `combat-actions`처럼 그 이름을 담은 `data-game-section`도 있습니다 | `.mari-game-section.mari-chat-style-surface` |
| Journal(일지)처럼 창 안에 표시되는 Game 콘텐츠. 창의 색상을 따릅니다 | `.mari-game-section` |
| Conversation 메시지(글꼴과 색상만 적용) | `.mari-chat-style-conversation` |
| 상자 없는 Conversation 메시지 텍스트 | `.mari-chat-style-text` |
| Calls와 Conversation 그룹 컨트롤을 포함한 채팅 컨트롤 | `.mari-chat-style-control` |
| 기록 버튼: **Load More**, **Show older**, **Show newer**(최신 보기), **Latest**(최신), Game 로그의 **Older**, **All**(전체), **Show more older logs**. `.mari-chat-style-control`도 함께 붙습니다 | `.mari-chat-history-pager` |
| 에이전트의 스타일 카드처럼 HTML로 된 메시지. **Apply preset colors**를 켜도 그 안에서 지정한 글자 색상은 유지됩니다 | `.mari-html-content` |

| 변수 | 제어 대상 |
| --- | --- |
| `--mari-chat-font-family` | 해당 채팅 영역의 글꼴 |
| `--mari-chat-bg` | 상자 배경. 단색이나 그라데이션을 사용할 수 있습니다 |
| `--mari-chat-text` | 읽기 쉬운 단색 글자 색상 |
| `--mari-chat-border` | 상자 윤곽선. 단색이나 그라데이션을 사용할 수 있습니다 |
| `--mari-chat-border-color` | 단색 테두리 폴백 |
| `--mari-chat-radius` | Conversation 메시지를 제외한 상자의 모서리 둥글기 |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover` | 채팅 버튼 배경 |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | 채팅 버튼 아이콘 색상과 모서리 둥글기 |
| `--mari-chat-input-bg` | 편집 필드 안쪽 배경 |

예를 들어 **Apply preset font**와 **Apply preset colors**를 켠 상태에서는 다음과 같이 설정할 수 있습니다.

```css
:root {
  --mari-chat-font-family: Georgia, serif;
  --mari-chat-bg: #251e29;
  --mari-chat-text: #f4e8dc;
  --mari-chat-border: linear-gradient(100deg, #d6aa66, #dda0b2);
}
```

설정하지 않은 변수는 위젯 설정과 프리셋을 따릅니다. 내장 스타일을 통해 이 변수를 적용하려면 해당 스위치가 켜져 있어야 합니다. **Apply preset shape**가 켜져 있어도 Conversation 메시지는 원래 모양을 유지합니다. 사용자 지정 테마에서 클래스를 직접 지정할 수도 있습니다. 장식 때문에 영역을 잘라 내더라도 포커스 윤곽선, 메뉴와 메시지 내용은 잘리지 않게 하세요.

휴대폰에서 점 세 개 메뉴를 열면 둥근 버튼들이 펼쳐집니다. 여닫는 버튼은 `[data-chat-tools-menu-button]`, 펼쳐진 버튼 열은 `[data-chat-tools-menu]`이며, 각 목록 항목의 `data-chat-tools-menu-item`에는 해당 창 ID가 설정됩니다. 도구 버튼은 `.mari-window-bubble.mari-chat-tools-button`을 사용하며 `data-chat-tools-menu-tool`에도 같은 ID가 설정됩니다. 버튼 열에는 창 프레임이 없습니다. 버튼은 둥근 모양을 유지하면서 위젯 색상과 버튼 크기를 따르며, 채팅의 나머지 영역에 적용하는 세 스위치와는 독립적으로 동작합니다.

## 관련 가이드

- [카드 CSS 테마 가이드](card-css-theming.md)
- [모양 설정](appearance-settings.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)
