# iOS PWA 하단 안전 영역(개발자용)

이 개발자 가이드에서는 화면 아래쪽에 나타날 수 있는 색 띠를 설명합니다. Marinara Engine을 iPhone 홈 화면 앱으로 실행할 때 생기는 현상입니다. Marinara가 적용한 해결책, 그 해결책이 감수해야 하는 대가, 그리고 이후 변경으로 띠가 다시 나타났을 때 원인을 찾는 방법을 다룹니다.

PWA(Progressive Web App)는 홈 화면에 설치해서 네이티브 앱처럼 여는 웹사이트입니다. 이 문서는 기여자를 위한 코드 수준의 자료이며, 일반 사용자용 가이드가 아닙니다.

## 문제

홈 인디케이터가 있는 iPhone(Face ID 모델)에서는 화면 아래쪽이 홈 제스처를 위해 비워 두는 안전 영역입니다. iOS는 이 구역의 높이를 약 34px로 잡습니다. CSS 변수 `env(safe-area-inset-bottom)`의 값과 같습니다.

PWA 상태 표시줄 스타일이 `black-translucent`로 설정되면 iOS는 `position: fixed` 요소가 이 구역에 그려지는 것을 모두 막습니다. CSS로 우회할 방법은 없습니다. WebKit이 음수 bottom 오프셋, `calc(100dvh + env(safe-area-inset-bottom))`, 음수 높이 재정의를 모두 잘라냅니다.

그 결과 채팅 입력 상자 아래에 띠가 눈에 띄게 남습니다. 흔히 "chin"이라고 부르는 이 띠는 나머지 인터페이스와 다른 색으로 보입니다.

## 적용한 해결책

Marinara는 상태 표시줄 스타일을 `black-translucent` 대신 `black`으로 설정합니다. 해당 meta 태그는 `packages/client/index.html`에 있습니다.

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

viewport 태그는 `viewport-fit=cover`와 기본 키보드 동작을 그대로 유지합니다.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

`black` 모드에서는 iOS가 하단 구역을 잠그지 않습니다. 앱 셸은 뷰포트 높이를 재정의하지 않고 `fixed inset-0`을 쓰기 때문에 안전 영역까지 끝까지 그려집니다. `packages/client/src/components/layout/AppShell.tsx`에 있는 셸의 className은 다음과 같습니다.

```
mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden
```

viewport 태그에 `interactive-widget=resizes-content`를 추가하지 마세요. 모바일 PWA에서는 키보드가 올라오는 동안 채팅 셸 전체의 크기가 바뀌면서 메시지 스크롤이 잘릴 수 있습니다.

## 감수해야 하는 대가

투명한 상태 표시줄과 빈틈 없는 하단을 동시에 얻을 수는 없습니다. `black` 모드의 상태 표시줄은 어두운 단색 막대입니다. `black-translucent`는 위쪽이 투명해서 더 보기 좋지만, 대신 하단의 띠를 없앨 방법이 사라집니다. iOS 자체의 제약이라 우회할 수 없습니다.

<a id="landscape-the-cameras-side-insets"></a>

## 가로 방향: 카메라 쪽 여백

iPhone을 가로로 돌리면 카메라(노치 또는 Dynamic Island)가 왼쪽이나 오른쪽 가장자리에 놓입니다. `viewport-fit=cover`에서는 페이지가 그 아래까지 확장되며, iOS는 해당 공간을 `env(safe-area-inset-left)`와 `env(safe-area-inset-right)`로 알립니다. Dynamic Island 모델에서는 회전 방향에 관계없이 양쪽이 약 59px입니다. Marinara의 Android 앱(대상 SDK 34, 에지 투 에지 아님)은 카메라 컷아웃을 피해 배치되므로 두 여백이 모두 0입니다. 다른 Android 브라우저에서는 전체 화면이나 에지 투 에지 등에서 0이 아닌 값을 알릴 수 있으며, 같은 변수가 이를 처리합니다.

Marinara는 세로 방향의 상태 표시줄 띠와 같은 방식으로 이 공간을 피합니다.

- `packages/client/src/styles/globals.css`는 두 여백을 한 번 읽어 `:root`의 `--mari-safe-area-inset-left`와 `--mari-safe-area-inset-right`에 저장합니다. 나머지는 모두 이 변수를 읽고 `env()`를 직접 읽지 않습니다. `scripts/regressions/mobile-safe-area-inset.regression.ts`가 이 규칙을 검사합니다. 대화 상자, omnibar, 전체 화면 편집기와 TopBar 컨트롤은 카메라와 둥근 모서리에 대한 이 보호를 유지합니다.
- iPhone에서는 `AppShell.tsx`가 `window.orientation`(사용할 수 없으면 `screen.orientation.angle`)으로 카메라 쪽을 식별합니다. 90°에서는 왼쪽, −90°/270°에서는 오른쪽입니다. `<html>`의 `data-mari-camera-side` 속성으로 CSS가 반대쪽 **셸** 여백인 `--mari-shell-inset-left` 또는 `--mari-shell-inset-right`만 0으로 설정할 수 있습니다. 알 수 없는 회전, iPad와 Android에서는 시스템 여백을 유지합니다.
- 휴대폰 셸에서 `.mari-app`은 셸 변수로부터 `left`와 `right` 값을 가져옵니다. 카메라 위에는 세로 방향의 상태 표시줄 띠와 같은 색으로 body의 페이지 배경이 표시되며, 반대쪽 가장자리에는 대칭인 빈 여백이 생기지 않습니다.
- 셸 안의 고정 요소는 셸이 아니라 화면을 기준으로 배치되므로 스스로 해당 공간을 피합니다. `AppShell.tsx`의 휴대폰 시트와 배경은 셸 변수와 함께 `MOBILE_SHELL_PANEL_X_CLASS`를 사용합니다. 셸의 별 같은 장식은 `absolute`이므로 셸 안에 머뭅니다.

휴대폰 없이 확인하려면 874×402 터치 뷰포트를 열고 스타일시트의 `:root` 규칙에서 두 변수를 `59px`로 설정하세요(인라인 스타일은 카메라 쪽 선택자보다 우선합니다). Chromium에서는 DevTools Protocol 명령 `Emulation.setSafeAreaInsetsOverride`로 실제 여백을 에뮬레이션할 수도 있습니다. `e2e/phone-camera-side.e2e.ts`는 양쪽 회전 방향, 이전 및 새 방향 API, 알 수 없는 회전과 다른 기기를 검사합니다. e2e 테스트 "a phone turned sideways keeps the app out from under its camera"는 양쪽 여백을 유지하는 폴백을 검사합니다.

## 원인을 찾은 방법

각 레이어에 색을 입히고 앱을 다시 여는 방식으로 띠의 정체를 추적했습니다. 진단용 스타일은 `packages/client/dist/index.html`의 인라인 `<style>` 블록 안에 넣으세요. 이 파일은 서비스 워커가 캐시하지 않고 항상 새로 다운로드합니다. 캐시를 비우지 않아도 다음에 앱을 열면 변경이 반영됩니다.

```
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

결과는 이렇게 읽습니다.

- chin이 빨간색이면 html 캔버스가 그 자리를 칠하고 있다는 뜻입니다. `black-translucent` 모드에서는 어떤 fixed 요소로도 덮을 수 없습니다.
- chin이 파란색이면 앱 셸 상자가 화면 아래 끝까지 닿았다는 뜻입니다. 정상 상태입니다.
- chin이 초록색이면 입력 상자 자체가 화면 끝까지 채우고 있다는 뜻입니다.

## 업데이트 후 다시 문제가 생겼을 때

### 증상: 입력 상자 아래에 chin 띠가 다시 나타남

확인 1. `packages/client/index.html`의 `apple-mobile-web-app-status-bar-style`이 여전히 `black`인지 확인하세요. `black-translucent`로 되돌아갔다면 다시 `black`으로 바꾸세요.

확인 2. `packages/client/src/components/layout/AppShell.tsx`의 AppShell className이 여전히 `mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden`인지 확인하세요. `inset-0`을 `h-screen`, `h-dvh`, `max-h-screen`과 함께 쓰지 마세요. fixed 셸에 제약이 과하게 걸려서 모바일 키보드가 인터페이스를 밀어내게 됩니다.

확인 3. 위의 색 진단을 실행해서 어느 레이어가 chin을 칠하는지 확인하세요. 앱을 강제 종료한 다음 다시 여세요. `dist/index.html`은 미리 캐시되지 않으므로 캐시를 비울 필요는 없습니다.

- 다른 곳은 파란데 chin만 빨갛다면 셸 상자가 아래 끝까지 닿지 않은 것입니다. 상태 표시줄 스타일이 `black`인지 확인하세요.
- 셸이 파란데도 chin이 계속 빨갛다면 셸이 그 영역을 덮지 못하는 것입니다. `fixed inset-0`이 그대로인지 확인하세요.
- chin이 파랗다면 셸은 덮고 있지만 입력 상자가 아래까지 채우지 못하는 것입니다. 아래에 설명한 입력 래퍼의 패딩을 확인하세요.

### 증상: 입력 상자가 화면 가장자리에 딱 붙음

세 입력 컴포넌트는 자연스럽게 떠 있는 간격을 위해 바깥 래퍼에 `pb-0`이 아니라 `pb-3`이 있어야 합니다.

- `packages/client/src/components/chat/ChatInput.tsx`: 래퍼가 `mari-chat-input chat-input-container px-3 pb-3`입니다.
- `packages/client/src/components/chat/ConversationInput.tsx`: 래퍼가 `mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3`입니다.
- `packages/client/src/components/game/GameInput.tsx`: 래퍼가 `px-3 pt-2 pb-3`입니다.

## 다시 빌드하기

서버는 `packages/client/dist`에 빌드된 클라이언트를 제공하므로, 소스를 고쳤다면 다시 빌드해야 합니다.

```
pnpm build:client
```

그다음 기기에서 사이트 데이터를 지우고 PWA를 다시 여세요. 휴대폰에서 **Settings**(설정)를 연 다음 **Safari**, **Advanced**(고급), **Website Data** 순으로 들어가면 됩니다. 서비스 워커는 JS와 CSS를 콘텐츠 해시 기준으로 캐시하기 때문에, 해시가 바뀐 새 청크를 불러오려면 사이트 데이터를 지워야 합니다.

`dist/index.html`은 서비스 워커가 캐시하지 않고 항상 새로 다운로드합니다. 전체를 다시 빌드하지 않고 진단용 스타일을 빠르게 넣어 볼 때 쓰세요.

## 핵심 정리

- `black-translucent`는 상태 표시줄을 투명하게 만들지만 하단 안전 영역을 잠급니다. CSS로 우회할 방법은 없습니다.
- `black` 또는 `default`는 상태 표시줄을 단색으로 만들고, fixed 요소가 하단 안전 영역까지 닿게 해 줍니다.
- `env(safe-area-inset-bottom)`은 Face ID iPhone에서 약 34px입니다. 홈 인디케이터 위로 조작 가능한 콘텐츠를 띄워야 할 때 이 값을 여백으로 쓰세요.
- `black-translucent` 모드에서 `dvh`와 `lvh` 뷰포트 단위는 물리적 화면 높이가 아니라 안전한 콘텐츠 높이와 같습니다. 셸을 그 경계 너머로 늘리는 데 쓰지 마세요.
- `interactive-widget=resizes-content`는 키보드가 올라올 때 fixed 채팅 셸의 크기를 바꿀 수 있습니다. 기본 뷰포트 동작을 그대로 쓰세요.

## 관련 가이드

- [프런트엔드 아키텍처(개발자용)](frontend.md)
- [iOS / iPadOS PWA 가이드](../installation/ios-pwa.md)
