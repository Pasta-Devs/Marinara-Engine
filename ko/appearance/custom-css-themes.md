# 사용자 지정 CSS 테마(Theme Library)

이 가이드에서는 사용자 지정 CSS 테마로 Marinara Engine의 전체 모양을 바꾸는 방법을 설명합니다. 테마를 만들고 가져오고 내보내고 적용하는 방법을 알 수 있습니다. 바꿀 수 있는 CSS 변수와 테마가 Card CSS와 어떻게 함께 동작하는지도 함께 다룹니다.

## 바로 쓸 수 있는 채팅 창 스타일

CSS 없이 모양을 빠르게 바꾸려면 **Settings → Appearance → App**(설정 → 모양 → 앱)을 열고 **App Style** 아래쪽의 **Chat widget style**(채팅 위젯 스타일)을 찾으세요. **Dottore**는 시안색 계기판 같은 프레임과 잘린 모서리를 사용합니다. **Mari**는 분홍색과 금색 프레임을 사용하고 창 제목에 Primogem을 표시합니다. 버튼 배경은 창 배경과 같습니다. 각 프리셋은 고유한 글꼴이 있으며 라이트 모드와 다크 모드에 맞춰 버튼, 창, 펼치는 섹션을 함께 꾸밉니다.

**Font**(글꼴)와 **Shape**(모양)로 각각을 바꿀 수 있습니다. **Preset font**와 **Preset shape**는 선택한 스타일의 글꼴과 모양을 사용합니다.

그 아래에는 색상 컨트롤이 세 개 있습니다. 각각 단색 선택기와 그라데이션 옵션을 제공합니다.

- **Border & Buttons Color**(테두리와 버튼 색상)는 윤곽선과 버튼 아이콘의 색을 바꿉니다. 아이콘은 그라데이션의 첫 색을 사용합니다.
- **Background Color**(배경 색상)는 버튼, 창, 펼치는 섹션과 편집 가능한 필드의 배경을 채웁니다.
- **Text Color**(텍스트 색상)는 위젯의 글자 색을 바꿉니다. 그라데이션은 제목과 라벨에 적용되고, 편집 필드의 글자는 첫 색을 사용합니다.

이 색상 설정은 장식 문양의 원래 색을 바꾸지 않습니다.

색상 옆의 **Reset color**(색상 초기화)를 누르면 다시 프리셋의 라이트 모드나 다크 모드 색상을 따릅니다. 프리셋을 선택하면 **Font**, **Shape**, 세 가지 색상이 모두 초기화됩니다. **Default**는 기본 모양으로 돌아갑니다. 배치한 창 위치는 그대로 유지됩니다.

사용자 지정 CSS 테마로도 이 프리셋을 덮어쓸 수 있습니다. 아래의 공개 창 및 드로어 변수는 프리셋 색상보다 우선합니다. 창 글꼴에는 `--mari-window-font-family`, 섹션 모서리에는 `--mari-drawer-radius`를 사용하세요. 제목 장식을 숨기려면 `--mari-window-ornament: none`을 사용하세요. 프리셋 장식을 전부 없애려면 먼저 **Default**를 선택하세요.

## 사용자 지정 테마란

사용자 지정 테마는 Marinara를 다시 칠하는 CSS 덩어리입니다. CSS는 Cascading Style Sheets의 줄임말로, 앱 전체의 색, 테두리, 여백을 정하는 코드입니다. 테마로 페이지 배경, 강조색, 카드, 테두리, 글자 등을 바꿀 수 있습니다.

사용자 지정 테마는 **Theme Library**(테마 라이브러리)에 들어 있습니다. Marinara 서버에 저장되기 때문에 같은 서버에 접속하는 모든 기기와 브라우저에 그대로 반영됩니다. 한 기기에만 남는 다른 모양 설정과는 다른 점입니다. 기기별로 적용되는 설정은 [모양 설정](appearance-settings.md) 가이드를 참고하세요.

한 번에 활성화할 수 있는 사용자 지정 테마는 하나뿐입니다. 라이브러리에는 원하는 만큼 테마를 넣어 두고 그때그때 바꿔 쓸 수 있습니다.

## Theme Library 위치

1. **Settings**(설정)를 여세요.
2. **Addons**(애드온) 탭을 여세요.
3. **Theme Library** 섹션을 찾으세요.

이 섹션의 제목은 **Theme Library**이고, 설명은 "Create, import, activate, edit, export, or remove custom CSS themes."입니다.

## 테마 만들기

1. **Theme Library** 섹션에서 **Create Theme**(테마 만들기)를 클릭하세요.
2. **Theme name**(테마 이름) 입력란에 이름을 적으세요.
3. 큰 텍스트 상자에 CSS를 쓰거나 붙여넣으세요.
4. 입력하는 동안 앱에서 바로 결과를 보려면 **Preview**(미리보기)를 켠 채로 두세요. 실시간 미리보기를 멈추려면 **Preview**를 끄세요.
5. **Save**(저장)를 클릭하세요.

새 테마는 템플릿에서 시작합니다. 템플릿에는 자주 쓰는 변수가 주석 처리된 예시로 들어 있으므로, 주석 기호를 지우고 원하는 값을 넣으면 됩니다. 완전히 새로운 테마를 저장하면 Marinara가 곧바로 그 테마를 적용합니다. 이때 테마 이름이 담긴 확인 메시지도 함께 표시합니다. 예: Theme "My Theme" saved and activated.

나중에 테마를 고치려면 **Installed Themes**(등록된 테마) 목록에서 해당 테마를 찾으세요. 코드 아이콘(툴팁은 **Edit theme CSS**(테마 CSS 편집))을 클릭해 내용을 고치고 **Save**를 클릭하면 됩니다. 저장된 테마를 편집하면 그 테마의 내용만 바뀌고, 어떤 테마가 활성화되어 있는지는 달라지지 않습니다.

## 테마 가져오기와 내보내기

테마는 파일로 주고받을 수 있습니다. 서버 사이에서 테마를 옮기거나 친구에게 건넬 때 편리합니다.

테마를 가져오는 방법은 다음과 같습니다.

1. **Theme Library** 섹션에서 **Import File**(테마 가져오기)을 클릭하세요.
2. `.css` 파일이나 `.json` 파일을 고르세요.
3. 토스트 메시지를 확인하세요. 가져온 테마, 건너뛴 테마, 실패한 테마의 개수를 알려 줍니다.

`.css` 파일 하나는 테마 하나가 되고, 이름은 파일 이름을 따릅니다. `.json` 파일에는 테마를 하나 이상 담을 수 있으며 두 가지 형태가 있습니다.

첫 번째는 Marinara에서 내보낸 파일입니다. 내보낼 때 Marinara가 덧붙이는 추가 필드가 각 테마를 감싸고 있습니다. 내용을 읽거나 고칠 필요는 없습니다. 파일을 그대로 가져오세요.

두 번째는 직접 쓰는 간단한 파일입니다. 테마가 하나라면 이 정도면 충분합니다.

```
{ "name": "My Theme", "css": "..." }
```

가져온 테마는 서버에 반영되지만 저절로 활성화되지는 않습니다. 이름과 CSS가 모두 같은 테마가 서버에 이미 있으면 중복해서 추가하지 않고 건너뜁니다.

테마를 내보내려면 **Installed Themes** 목록에서 해당 테마를 찾아 업로드 아이콘(툴팁은 **Export theme**(테마 내보내기))을 클릭하세요. Marinara가 `.json` 파일을 다운로드해 주며, 이 파일은 다른 곳에서 가져올 수 있습니다.

## 테마 활성화하기

**Installed Themes** 목록에는 모든 테마가 표시되고, 맨 위에 **Default Theme**(기본 테마) 항목이 있습니다.

1. 테마 이름을 클릭하면 그 테마가 활성화됩니다. 활성화된 테마에는 체크 표시가 붙습니다.
2. **Default Theme**를 클릭하면 사용자 지정 테마가 꺼지고 Marinara 기본 모양으로 돌아갑니다.

**Reset Appearance**(외형 초기화) 버튼은 **Settings -> Appearance**의 **App Style**(앱 스타일) 섹션 맨 위에 있습니다. 이 버튼을 누르면 활성화된 사용자 지정 테마도 함께 꺼집니다.

테마를 완전히 지우려면 해당 줄의 휴지통 아이콘(툴팁은 **Remove theme**(테마 제거))을 클릭한 다음 **Delete Theme**(테마 삭제) 창에서 확인하세요. 이렇게 하면 테마의 CSS가 서버에서 영구적으로 삭제됩니다.

## CSS 변수 참조

테마 편집기에는 펼칠 수 있는 **CSS Variable Reference**(CSS 변수 참조) 항목이 있습니다. 이 항목을 클릭하면 가장 쓸모 있는 변수 목록을 볼 수 있습니다. 테마는 `:root` 블록에서 이 변수들의 값을 정하는 방식으로 앱의 모양을 바꿉니다. 참조 목록에 나오는 변수는 다음과 같습니다.

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

이 목록에만 묶일 필요는 없습니다. 테마에서는 Marinara가 쓰는 CSS 변수라면 무엇이든 정할 수 있고, 다른 사용자 지정 스타일도 추가할 수 있습니다.

일부 시각 효과에는 전용 변수가 있습니다. 예를 들어 `--marinara-theme-accent-pulse: enabled`로 설정하면 강조색이 맥동하는 애니메이션을 쓸 수 있습니다.

사용자 지정 테마의 CSS는 안전을 위해 실행 전에 한 번 걸러집니다. 다른 웹사이트에서 파일을 불러오는 스타일은 동작하지 않습니다. 테마 안에서 이미지나 글꼴을 쓰려면 웹 링크 대신 `data:` URI로 파일을 심으세요. `data:` URI는 파일 내용을 CSS 안에 직접 담는 방식입니다.

## 채팅 창과 드로어 꾸미기

컴퓨터에서 **Chat Settings**(채팅 설정)는 이동 가능한 창으로 열립니다. 펼치고 접는 섹션을 **드로어**라고 합니다. 드로어를 별도 창으로 꺼낸 뒤 작은 이동 버튼으로 최소화할 수 있습니다. 이 버튼을 **버블**이라고 합니다.

Game controls, Session, Volume, Game Assets, 연결된 채팅, 패키지 컨트롤도 같은 창과 버튼을 사용합니다. 휴대폰에서는 창이 화면 너비의 패널로 열리며 Tracker Panel에도 전용 이동 버튼이 있습니다.

아래의 클래스, 데이터 속성, 변수로 이 요소를 함께 꾸밀 수 있습니다. 테마의 규칙은 `!important` 없이 기본값을 덮어씁니다.

### 클래스

| 요소 | 클래스 |
| --- | --- |
| 창 | `.mari-window` |
| 제목 표시줄 | `.mari-window__header` |
| 제목과 아이콘 | `.mari-window__title-row` |
| 제목 | `.mari-window__title` |
| 제목 표시줄 버튼(Reset View, 즐겨찾는 배치의 별, Tracker Panel, 최소화, 고정, 잠금, 닫기, 되돌리기) | `.mari-window__controls`(각 버튼은 `.mari-window__control`) |
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
| 끌고 있는 버블이 다른 버블과 나란히 맞춰질 때 보이는 선 | `.mari-window-snap-guide` |
| 에이전트 실행 중에 보이는 점(Chat Settings 버튼, Trackers 창) | `.mari-agents-running-dot` |

### 데이터 속성

- `data-window`는 창과 버블의 이름입니다. `chat-settings`, `trackers`, 컨트롤 창의 `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>`, `control:beholder:<package>`와, 밖으로 꺼낸 드로어의 `drawer:<window>:<drawer>`를 사용합니다. 예를 들어 `drawer:chat-settings:chat-name`입니다.
- `data-drawer`는 드로어의 이름이며 예를 들면 `chat-name`입니다. `roleplay-agents`나 `conversation-agents`처럼 채팅 모드로 시작하는 이름도 있습니다. 트래커는 `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom`, `agent-activity`를 사용합니다.
- `data-presentation`은 컴퓨터 창에서 `"window"`, 휴대폰 패널에서 `"sheet"`입니다.
- 창이 고정되거나 잠겨 있으면 `data-pinned`와 `data-locked`는 `"true"`입니다.
- `data-window-control`은 제목 표시줄 버튼의 이름으로 `"minimize"`, `"pin"`, `"lock"`, `"close"`, `"put-back"`을 사용합니다. 눌린 고정이나 잠금 버튼에는 `aria-pressed="true"`도 있습니다.
- `data-chat-settings-control`은 Chat Settings의 추가 제목 표시줄 버튼을 구분합니다. `"reset-view"`, `"favorite-layout"`, `"tracker-panel"`입니다. 현재 배치가 저장한 즐겨찾기와 같으면 별 아이콘이 채워지고 `aria-pressed="true"`가 됩니다.
- 각 크기 조절 손잡이의 `data-edge`는 `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"`, `"sw"`입니다.
- 열린 드로어의 `.mari-drawer__header` 안에 있는 토글 버튼에는 `aria-expanded="true"`가 있습니다.
- `data-drawer-control="pop-out"`은 드로어의 별도 창 버튼을 표시합니다.
- `data-outside="true"`는 놓았을 때 별도 창이 될 만큼 원래 창 밖으로 나온 드래그 미리보기를 표시합니다.
- `data-axis`는 세로로 뻗은 정렬 안내선에서 `"x"`, 가로로 뻗은 안내선에서 `"y"`입니다.
- 드로어가 별도 창에 표시되면 창과 그 안의 드로어에 모두 `data-detached`가 `"true"`로 설정됩니다. 꺼낸 드로어의 창 이름은 `data-window="drawer:<window>:<drawer>"`이며, 예를 들면 `data-window="drawer:chat-settings:chat-name"`입니다. `data-drawer-host`는 원래 들어 있던 창의 이름입니다.
- 드로어 제목을 끌고 있는 동안 드로어의 `data-dragging`은 `"true"`입니다. 꺼낸 드로어를 되돌릴 창 위에 올려 두면 그 창의 `data-drop-target`이 `"true"`가 됩니다.
- 버블에는 해당 창의 `data-window`와 `data-minimized="true"`가 있습니다. 예를 들면 `.mari-window-bubble[data-window="control:volume"]`입니다. 컨트롤 창의 이름은 `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>`, `control:beholder:<package>`입니다. 버블을 끌고 있는 동안 `data-dragging`은 `"true"`입니다.
- 잠긴 버블에는 `data-locked="true"`가 있으며 Chat Settings 버튼도 마찬가지입니다. 창을 열 수는 있지만, 창의 잠금을 풀기 전까지 옮길 수 없습니다. `.mari-window-bubble[data-locked="true"]`로 이 버튼의 모양을 구분할 수 있습니다.
- 휴대폰에서는 창과 조금 더 큰 버블에 모두 `data-presentation="sheet"`가 있습니다. Tracker Panel의 버블은 `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`입니다.
- Chat Settings 버튼도 버블입니다. `.mari-window-bubble[data-chat-settings-button]`이며 Chat Settings가 열려 있으면 `data-open="true"`가 있습니다.
- 밖으로 꺼낸 섹션은 원래 창을 가리키는 `data-drawer-host`가 있는 버블로 최소화됩니다. 그 창의 **Put back** 버튼은 `[data-window-control="put-back"]`입니다.

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

## 크기와 이름 제한

테마 이름은 200자까지 쓸 수 있습니다. CSS 본문은 최대 256 KiB이며, 글자 수가 아니라 UTF-8 바이트 기준입니다. 이보다 큰 테마는 저장하거나 가져올 때 거부됩니다.

## 원격 설치 환경의 Admin Access

테마를 만들고, 편집하고, 가져오고, 활성화하고, 삭제하는 동작은 보호된 작업입니다. 이 점은 네트워크를 통해 Marinara에 접속할 때만 문제가 됩니다.

서버가 돌아가는 컴퓨터에서 루프백(localhost라고도 합니다)으로 Marinara를 열면 이런 동작이 그냥 됩니다. 휴대전화나 네트워크상의 다른 컴퓨터처럼 별도 기기에서 열 때는 서버에 관리자용 비밀 값이 먼저 필요합니다.

네트워크를 통해 테마를 관리하려면 다음과 같이 설정하세요.

1. 서버의 `.env` 파일에 `ADMIN_SECRET`을 설정하세요.
2. 앱에서 **Settings -> Advanced -> Admin Access**를 열고 같은 값을 입력하세요.

이 설정이 없으면 네트워크를 통한 테마 변경은 실패합니다. 전체 설정 방법은 [서버 설정 참고 문서](../CONFIGURATION.md)와 [원격 접근](../REMOTE_ACCESS.md) 가이드를 참고하세요.

## 테마와 Card CSS의 관계

Marinara에서 사용자 지정 CSS를 넣는 방법은 두 가지입니다. 서로 다른 기능이고, 둘 다 동시에 켜 둘 수 있습니다.

사용자 지정 테마는 앱 전체를 다시 칠합니다. Marinara의 핵심 변수를 덮어쓸 수 있고 `!important`와 `position: fixed`도 쓸 수 있습니다. 테마는 원래 그러라고 있는 기능입니다.

Card CSS는 다릅니다. 캐릭터나 페르소나 제작자가 카드 안에 CSS를 넣어 두면 채팅별로 켤 수 있습니다. Card CSS는 더 엄격하게 걸러집니다. 앱의 핵심 변수는 덮어쓸 수 없고, `!important`는 제거되며, `position: fixed`는 `position: absolute`로 바뀝니다. 앱 전체가 아니라 채팅 메시지의 모양만 바꿉니다. 자세한 내용은 [카드 CSS 테마 가이드](card-css-theming.md)를 참고하세요.

앱 모양이 이상하다면 활성화된 테마와 Card CSS를 둘 다 확인해 볼 만합니다. 어느 쪽이든 원인일 수 있습니다.

## 관련 가이드

- [카드 CSS 테마 가이드](card-css-theming.md)
- [모양 설정](appearance-settings.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
- [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)
