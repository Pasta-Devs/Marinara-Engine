# 카드 CSS 테마 가이드

이 가이드에서는 캐릭터와 페르소나를 만드는 사람이 카드마다 고유한 채팅 화면 모양을 입히는 방법을 설명합니다. 카드의 **Creator Notes**(제작자 노트)에 CSS를 넣어 두면 Marinara Engine이 그 CSS를 안전하게 처리해서 해당 캐릭터의 메시지에 적용합니다. 적용 범위는 언제나 채팅뿐이며, 앱의 나머지 부분은 건드리지 않습니다.

## 시작하기 전에

이 가이드 전체에서 쓰는 용어를 먼저 정리합니다.

- **CSS**는 웹 페이지의 색, 글꼴, 테두리, 여백을 지정하는 언어입니다.
- **Card CSS**(카드 CSS)는 캐릭터 카드나 페르소나 카드에 넣어 두는 CSS입니다. 그 카드의 메시지에 테마를 입힙니다.
- **Card Theming**(카드 테마)은 채팅에서 Card CSS를 켜는 화면 속 컨트롤입니다.
- **선택자**는 CSS 규칙에서 어떤 요소에 스타일을 적용할지 고르는 부분입니다.
- **하위 선택자**는 공백으로 "안쪽"을 나타냅니다. `.a .b`는 `.a` 안에 있는 `.b`에 적용됩니다.
- **캐스케이드**는 한 요소에 여러 규칙이 겹칠 때 어느 규칙이 이길지 정하는 CSS의 체계입니다.
- **레이아웃**은 메시지를 화면에 배치하는 방식입니다. Marinara에는 줄 단위로 배치하는 **Linear** 레이아웃과 말풍선 형태의 **Bubbles** 레이아웃이 있습니다.

## 빠르게 시작하기

카드에 테마를 입히려면 두 곳을 손봐야 합니다. 먼저 카드에 CSS를 넣고, 그다음 채팅에서 켭니다.

1. Character Editor(캐릭터 편집기)에서 캐릭터를 열고 **Creator Notes** 입력란을 찾으세요. 페르소나도 Persona Editor(페르소나 편집기)에 같은 입력란이 있습니다.
2. **Creator Notes**에 `<style>` 블록을 붙여넣고 카드를 저장하세요.
3. 그 캐릭터와의 채팅을 여세요.
4. **Chat Settings**(채팅 설정)를 열고 **Card Theming** 섹션으로 이동하세요.
5. **Exclusive**나 **Chat**을 고르세요. 처음에는 **Disabled** 상태입니다.

곧바로 캐릭터의 메시지가 달라집니다. **Card Theming**의 모드 버튼(Disabled, Exclusive, Chat)은 그 채팅에 참여 중인 캐릭터의 **Creator Notes**에 CSS가 들어 있을 때만 나타납니다. Roleplay 채팅에서는 **Color Character Names in Text**(본문의 캐릭터 이름에 색상 적용) 스위치도 포함하므로 섹션 자체는 항상 표시됩니다. 페르소나 쪽 CSS만으로는 버튼이 나타나지 않습니다. 채팅에 있는 캐릭터 중 최소 하나가 자기 `<style>` 블록을 가지고 있어야 합니다. 버튼이 보이지 않으면 `<style>` 블록이 제대로 저장됐는지 확인하세요.

**Creator Notes**에 붙여넣어 볼 수 있는 시작용 블록입니다.

```html
<style>
  /* the visible message bubble (Bubbles layout, and roleplay) */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #2a1240, #3a1030);
    border: 1px solid #ff66cc;
    border-radius: 14px;
  }
  /* the name and the text (works in every message style) */
  [data-card-css] .mari-message-name {
    color: #ff8fd4;
    text-shadow: 0 0 8px rgba(255, 102, 204, 0.6);
  }
  [data-card-css] .mari-message-content {
    color: #ffd6f0;
  }
</style>
```

이렇게 하면 캐릭터 이름이 분홍빛으로 빛나고 본문 글자가 연분홍이 됩니다. 어느 레이아웃에서든 적용됩니다. 말풍선 규칙은 보라색 그라데이션과 분홍 테두리를 더합니다. 한 가지 주의할 점이 있습니다. `.mari-message-bubble`은 **Bubbles** 레이아웃과 롤플레이에만 존재합니다. Conversation(대화)의 기본 레이아웃은 **Linear**이고 여기에는 말풍선 요소가 없어서, 말풍선 규칙이 아무 효과도 내지 않습니다. 차이는 아래 "**Bubbles**와 **Linear** 비교"에서 설명합니다.

**동작 확인:** 확실하게 확인하고 싶다면 아래 규칙을 쓰세요. 모든 모드와 레이아웃에 존재하는 메시지 본문을 대상으로 합니다. 본문 배경이 즉시 선명한 분홍으로 바뀝니다.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Card Theming의 동작 방식

**Creator Notes**에 CSS가 들어 있는 캐릭터가 채팅에 참여하면 Marinara는 네 가지 일을 합니다.

1. **Creator Notes**에서 `<style>` 블록을 모두 읽습니다.
2. CSS를 검사해서 위험한 부분을 걷어냅니다. 아래 "스타일을 적용할 수 없는 것" 섹션을 참고하세요.
3. CSS의 적용 범위를 채팅 안으로 한정합니다.
4. 범위가 한정된 선택자가 앱 자체의 메시지 스타일보다 우선하도록 CSS를 주입합니다.

적용 방식은 **Chat Settings**의 **Card Theming**에서 채팅별로 고릅니다. 모드는 세 가지입니다.

| 모드 | 동작 |
| --- | --- |
| **Disabled**(기본값) | Card CSS가 꺼져 있어서 캐릭터 스타일이 적용되지 않습니다. |
| **Exclusive** | 각 캐릭터의 CSS가 그 캐릭터 자신의 메시지에만 적용됩니다. |
| **Chat** | 모든 카드 CSS가 UI 요소를 포함한 채팅 영역 전체에 적용됩니다. |

캐릭터마다 다른 모양을 주고 싶은 그룹 채팅에는 **Exclusive**를 쓰세요. 카드 하나로 채팅 화면 전체에 테마를 입히고 싶은 1:1 채팅에는 **Chat**을 쓰세요.

## 꼭 알아야 할 범위 규칙 하나

Marinara는 CSS의 적용 범위가 채팅을 벗어나지 않도록 선택자를 다시 씁니다. 다시 쓰는 방식은 모드에 따라 다릅니다.

- **Chat** 모드는 모든 규칙을 채팅 영역 아래로 한정합니다. `.mari-message-bubble`은 그 영역 안에 있으므로 평소대로 적용됩니다.
- **Exclusive** 모드는 모든 규칙을 해당 캐릭터의 메시지 요소 아래로 한정합니다. 그 요소에는 `data-card-css`가 붙어 있습니다. 같은 요소에 붙은 클래스는 하위 요소로 취급되지 않아 적용되지 않습니다. 그 안쪽에 있는 것만 적용됩니다.

그래서 어디서나 통하는 규칙은 이렇습니다. 메시지 요소 자체에 스타일을 줄 때는 `[data-card-css]`를 쓰고, 그 안쪽 요소에는 `.mari-message-bubble`, `.mari-message-content`, `.mari-message-name` 같은 일반 클래스 선택자를 쓰세요.

`[data-card-css]`는 **Exclusive** 모드에서 "이 캐릭터의 메시지"를, **Chat** 모드에서 "채팅 영역"을 뜻합니다. 어느 쪽에서도 동작합니다. 공백을 둔 안쪽 요소 선택자도 두 모드에서 똑같이 동작합니다.

```css
[data-card-css] {
  /* the message row itself, good for a left accent border */
  border-left: 3px solid #ff66cc;
}
[data-card-css] .mari-message-bubble {
  /* the visible bubble inside it */
  border-radius: 14px;
}
```

## @chat-mode로 특정 모드 지정하기

특정 화면만 겨냥하려면 규칙을 `@chat-mode` 블록으로 감싸세요. 블록 밖의 CSS는 모든 곳에 적용됩니다.

```html
<style>
  /* Applies in ALL modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  /* Only in Roleplay mode */
  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  /* Only in Conversation mode */
  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

표준 `@media` 쿼리는 `@chat-mode` 블록 안에서도 그대로 동작합니다. 화면 크기에 맞춘 레이아웃에 활용하세요.

**Game mode**(게임 모드)는 기본적인 수준까지 지원합니다. **Chat** 모드에서는 카드 CSS가 게임 화면 전체에 닿습니다. 즉, `[data-card-css]`가 게임 영역에 테마를 입히고 `@chat-mode game`이 그 영역을 겨냥합니다. Game은 자체 레이아웃을 씁니다. 위에서 소개한 말풍선 훅은 여기에 없으므로 영역 배경처럼 넓은 범위를 대상으로 삼으세요. 게임 서술을 캐릭터별로(Exclusive) 꾸미는 기능은 아직 제공하지 않습니다.

## 스타일을 적용할 수 있는 것

채팅의 구조는 Roleplay(롤플레이)와 Conversation에서 같은 뼈대를 씁니다. 카드 CSS로 지정할 수 있는 요소는 다음과 같습니다. 내부 유틸리티 클래스는 안정적인 훅이 아닙니다. 버전마다 바뀌므로 아래의 `mari-*` 클래스와 `data-*` 속성만 쓰세요.

| 선택자 | 대상 |
| --- | --- |
| `[data-card-css]` | 메시지 행 전체(범위 요소). 왼쪽이나 가장자리 강조선에 적합하며, **Chat** 모드에서는 채팅 영역입니다. |
| `[data-card-css] .mari-message-bubble` | 눈에 보이는 말풍선. 배경, 테두리, 모서리, 그림자. **Bubbles** 레이아웃과 롤플레이에 존재합니다. |
| `[data-card-css] .mari-message-content` | **Bubbles**에서는 배경, 테두리, 모서리를 포함한 말풍선 요소 자체. **Linear**에서는 메시지 본문만. |
| `[data-card-css] .mari-message-name` | 캐릭터의 표시 이름. |
| `[data-card-css] .mari-message-meta` | 이름과 시각이 들어가는 머리 행. |
| `[data-card-css] .mari-message-timestamp` | 시각 표시. |
| `[data-card-css] .mari-message-avatar` | 아바타 열. |
| `[data-card-css] .mari-message-narrator` | 내레이터 메시지(롤플레이). |
| `[data-card-css] .mari-message-user` | 사용자 메시지. 캐릭터 메시지에는 `.mari-message-assistant`를 쓰세요. |
| `[data-card-css] p`, `... span` | 본문 안의 문단과 인라인 span. |
| `[data-grouped]` | 같은 캐릭터가 이어서 보낸 메시지. Conversation 모드에만 있고 롤플레이 행에는 절대 붙지 않습니다. 묶음의 첫 메시지에는 `[data-card-css]:not([data-grouped])`를 쓰세요. |

**Bubbles와 Linear 비교.** `.mari-message-bubble`이 대상으로 삼는 것은 **Bubbles** 레이아웃입니다. **Linear** 레이아웃에는 말풍선 요소가 없으므로 대신 `.mari-message-content`(본문)와 `[data-card-css]`(행)에 스타일을 주세요. 레이아웃은 **Settings**(설정)에서 **Appearance**(모양), **Conversation Display**(대화 표시) 섹션, **Chat Layout**(채팅 레이아웃) 순으로 들어가 바꿉니다. 롤플레이에는 항상 말풍선이 있습니다.

Conversation이나 롤플레이의 말풍선을 꾸민 예입니다.

```css
[data-card-css] .mari-message-bubble {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
[data-card-css] .mari-message-name {
  color: #6495ed;
  text-shadow: 0 0 8px rgba(100, 149, 237, 0.5);
}
[data-card-css] .mari-message-content {
  font-family: Georgia, serif;
}
```

### 입력 중 표시

캐릭터가 답변을 쓰는 동안 Conversation의 **Linear** 레이아웃에는 "(name) is typing..." 행이 표시됩니다. 이 행에도 스타일을 줄 수 있습니다.

| 선택자 | 대상 |
| --- | --- |
| `[data-card-css] .mari-typing-text` | "(name) is typing..." 문구. |
| `[data-card-css] .mari-typing-dots span` | 움직이는 점. |
| `[data-card-css] .mari-typing-indicator` | 행 자체. `data-typing-name`으로 이름도 함께 담고 있습니다. |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### 아바타

아바타는 기본적으로 원형입니다. CSS만으로 모양을 바꾸고 테두리 고리를 두를 수 있습니다. 아래 예시는 클릭할 수 있는 아바타 버튼을 대상으로 합니다. 아바타를 클릭할 수 없게 그리는 화면이라면 그 레이아웃에서는 같은 방식을 `.mari-message-avatar > div` 쪽에 적용하세요. 롤플레이에서는 버튼이 빛 효과용 `div` 안에 한 겹 더 들어가 있습니다. 직접 지정한 고리만 보이게 하려면 그 겹을 없애세요.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
/* roleplay only: drop the app glow wrapper so just your ring shows */
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### About Me 프로필 팝아웃(Conversation 전용)

Conversation 모드에서 아바타를 클릭하면 캐릭터나 페르소나의 "about me"가 담긴 프로필 팝아웃이 열립니다. 같은 `[data-card-css]` 범위로 여기에도 테마를 입힐 수 있습니다. 이 팝아웃은 Conversation 모드에만 있습니다. 롤플레이와 게임에는 없습니다. 롤플레이나 게임용 CSS도 함께 넣는다면 이 규칙들을 `@chat-mode conversation`으로 감싸세요. 캐릭터 카드와 페르소나 모두 자기 **Creator Notes**에서 자기 팝아웃을 꾸밀 수 있습니다.

페르소나에는 한 가지 주의할 점이 있습니다. **Card Theming**의 모드 버튼은 채팅에 참여 중인 캐릭터의 **Creator Notes**에 CSS가 있을 때만 나타납니다. 페르소나 쪽 CSS만으로는 버튼이 나타나지 않습니다. 따라서 페르소나의 팝아웃 테마를 적용하려면 채팅에 있는 캐릭터 중 최소 하나도 `<style>` 블록을 가지고 있어야 합니다.

| 선택자 | 대상 |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | 팝아웃 카드 자체(범위 요소). 배경, 테두리, 모양. |
| `[data-card-css] .mari-about-me-banner` | 위쪽 띠(기본값은 이름 색). |
| `[data-card-css] .mari-about-me-avatar` | 확대된 아바타를 감싸는 요소. 원형 부분에는 `... > div`를 쓰세요. |
| `[data-card-css] .mari-about-me-status` | 접속 상태 점(캐릭터 전용). |
| `[data-card-css] .mari-about-me-name` | 표시 이름 제목. |
| `[data-card-css] .mari-about-me-handle` | 보조 @이름 줄(Convo 표시 이름이 다를 때 나타납니다). |
| `[data-card-css] .mari-about-me-presence` | 상태나 활동 줄(캐릭터 전용). |
| `[data-card-css] .mari-about-me-box` | About Me 내용 상자. |
| `[data-card-css] .mari-about-me-label` | "ABOUT ME" 문구. |
| `[data-card-css] .mari-about-me-badge` | Default 또는 Chat-specific 알약 모양 표시. |
| `[data-card-css] .mari-about-me-text` | 화면에 그려진 about me 본문. |

팝아웃 카드가 곧 범위 요소입니다. `[data-card-css].mari-about-me-popout`처럼 공백 없이 같은 요소로 지정하세요. 그 안의 요소는 `[data-card-css] .mari-about-me-name`처럼 하위 선택자로 지정합니다. **Chat** 모드에서는 영역 전체가 범위이므로 `.mari-about-me-name`을 바로 써도 됩니다.

"about me" 팝아웃을 꾸민 예입니다. 캐릭터나 페르소나의 **Creator Notes**에 붙여넣은 다음 **Chat Settings**에서 **Card Theming**을 켜세요. 페르소나에 붙여넣는다면 위의 주의 사항을 기억하세요. 채팅에 있는 캐릭터에도 **Creator Notes**에 CSS가 있어야 하며, 없으면 모드 버튼이 계속 숨겨져 있습니다.

```html
<style>
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-avatar > div {
    border-radius: 0.9rem; /* squircle avatar */
    box-shadow: 0 0 0 2px #b478ff;
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
    text-shadow: 0 0 10px rgba(180, 120, 255, 0.6);
  }
  [data-card-css] .mari-about-me-box {
    background: rgba(180, 120, 255, 0.08);
    border: 1px solid rgba(180, 120, 255, 0.25);
    border-radius: 0.75rem;
  }
  [data-card-css] .mari-about-me-label {
    color: #b478ff;
    letter-spacing: 0.12em;
  }
  [data-card-css] .mari-about-me-text {
    font-family: Georgia, serif;
    color: #f2e9ff;
  }
}
</style>
```

## 스타일을 적용할 수 없는 것

보안을 위해 아래 항목은 검사 과정에서 제거됩니다.

| 차단 대상 | 이유 |
| --- | --- |
| `url(https://...)` | 추적과 데이터 유출을 막기 위해 네트워크 요청을 허용하지 않습니다. 인라인 이미지와 글꼴을 위한 `url(data:...)`만 허용합니다. |
| 외부 URL을 쓰는 `@font-face` | `data:` 글꼴 소스만 남습니다. 앱 글꼴을 덮어쓰지 못하도록 font-family 이름은 자동으로 바뀝니다. |
| `@import` | 외부 스타일시트를 불러올 수 없습니다. |
| `:has()` 선택자 | 채팅 바깥의 요소를 살펴볼 수 없습니다. |
| 중첩 규칙과 `~` 또는 `+`로 시작하는 선택자 | 카드 CSS가 범위 밖에 닿지 못하도록 버려집니다. 일반 선택자로 작성하세요. |
| `content:` 안의 HTML | 장식용 텍스트는 쓸 수 있지만 `<`와 `>`는 제거되고 길이는 200자로 제한됩니다. `attr()`과 `counter()`는 허용됩니다. |
| `position: fixed` | `position: absolute`로 바뀌므로 전체 화면을 덮을 수 없습니다. |
| `!important` | 제거됩니다. 카드 CSS가 앱 스타일을 강제로 덮어쓸 수 없습니다. |
| 앱 테마 토큰 | `--primary`, `--background` 같은 토큰은 제거됩니다. 카드 CSS로 앱 UI의 색을 바꿀 수 없습니다. |

카드 CSS는 앱 자체의 메시지 스타일보다 우선순위가 높은 범위 한정 선택자로 주입됩니다. 채팅 안에서는 색, 배경, 테두리, 글꼴 지정에서 카드 CSS가 이깁니다. 이기지 못하는 것은 검사 과정에서 제거되는 항목, 채팅 바깥의 모든 것, 그리고 앱이 인라인이나 `!important`로 적용하는 스타일뿐입니다. **Settings**에서 지정하는 전체 채팅 글자 색과 크기가 그런 예입니다.

**사용자 지정 글꼴.** base64 `data:` URI로 글꼴을 넣거나, 시스템 글꼴 또는 웹 안전 글꼴 목록을 쓰세요.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive와 Chat 비교: 범위 고르기

- **Exclusive**에서는 `[data-card-css]`가 그 캐릭터의 메시지를 뜻합니다. 그룹 채팅과 캐릭터별 개성 표현에 가장 좋습니다. 메시지 안쪽 요소를 대상으로 하는 CSS는 **Chat** 모드와 똑같이 동작합니다.
- **Chat**에서는 `[data-card-css]`가 채팅 영역 전체를 뜻합니다. 말풍선만이 아니라 배경이나 분위기까지 꾸미고 싶은 1:1 카드에 가장 좋습니다.

`[data-card-css] .mari-message-...` 형태의 선택자로 만들면 두 모드 모두에서 카드가 제대로 동작합니다.

## 팁

1. 말풍선에는 `[data-card-css]`가 아니라 `.mari-message-bubble`로 스타일을 주세요. 앞의 것은 폭 전체를 차지하는 행이라 배경을 넣어도 거의 보이지 않습니다.
2. 밝은 테마와 어두운 테마 양쪽에 자연스럽게 어울리도록 `rgba()` 색을 쓰세요.
3. 애니메이션은 은은하게 유지하세요. 사양이 낮은 기기를 생각하면 무거운 `animation`보다 `transition`이 낫습니다.
4. 휴대전화용으로는 `@media (max-width: 768px)`를 쓰세요.
5. 유틸리티 클래스에 의존하지 마세요. 문서에 실린 `mari-*` 훅만 안정적입니다.

## 예시 모음: Eldritch Grimoire

일부러 화려하게 만든 카드입니다. 문서에 나온 모든 훅을 모든 모드에서 사용합니다. 다음을 보여 줍니다.

- 룬 문자처럼 빛나는 대문자 이름과 테마에 맞춘 세리프 본문
- 모양을 바꾸고 고리를 두른 아바타, 작은 대문자로 표시한 시각
- 메시지 행 가장자리의 문양
- 모서리에 룬을 넣고 움직이는 롤플레이 말풍선, 그리고 꾸민 내레이션
- Conversation 말풍선과 으스스한 입력 중 표시
- 아바타 클릭으로 열리는 프로필 팝아웃 전체
- 게임 화면

전체를 **Creator Notes**에 붙여넣은 다음 **Chat Settings**에서 **Card Theming**을 켜세요. Roleplay와 Conversation의 메시지, Conversation의 팝아웃, Game의 화면에 테마가 적용됩니다(게임에서는 모드를 **Chat**으로 설정하세요). 각 모드에 실제로 존재하는 훅만 적용되도록 `@chat-mode`로 구역을 나눠 두었습니다. 모든 내용은 검사를 통과합니다.

```html
<style>
  /* shared keyframe. Animate OPACITY, never box-shadow: box-shadow is a "paint"
     property, so animating it repaints and re-blurs the whole element every frame
     (which pins weak GPUs). Animating a layer's opacity is GPU-composited and cheap. */
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* EVERYWHERE (all modes). */
  /* These descendant hooks only match where message rows exist, so they are inert
     in Game and safe to leave unwrapped. */

  /* the character name, glowing crimson rune-caps */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.82rem;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  /* header row and timestamp */
  [data-card-css] .mari-message-meta {
    align-items: baseline;
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  /* reshape, ring, and saturate the clickable avatar. For a non-clickable avatar,
     target .mari-message-avatar > div for that layout. */
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
    filter: saturate(1.2) contrast(1.05);
  }
  /* glowing serif message text */
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    text-shadow: 0 0 2px rgba(168, 85, 247, 0.4);
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  /* ROLEPLAY */
  @chat-mode roleplay {
    /* the row itself, an arcane left edge. (data-grouped does not exist in
       roleplay, so there is no first-of-run trick here.) */
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    /* roleplay wraps the avatar button in its own glow layer. Flatten it
       so only the eldritch ring above hugs the picture. */
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    /* the visible bubble and a corner sigil */
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      /* a steady outer halo. An element's own box-shadow is not clipped by its own
         overflow: hidden, so this bloom shows even though message content is clipped.
         (No inset here: the pulsing inset glow lives on the ::after, so a static inset
         would stack with it and over-brighten the inner glow.) */
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* the breathing inner glow. Animate a full-bleed overlay's OPACITY (cheap, GPU
       composited) instead of the bubble's box-shadow (expensive: a full repaint every
       frame). overflow: hidden clips a child's OUTER shadow, so the pulse rides the inset
       glow while the halo above stays steady. pointer-events keeps it click-through. */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
      will-change: opacity;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
      text-shadow: 0 0 6px rgba(220, 38, 120, 0.9);
    }
    /* narration */
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
      opacity: 0.9;
    }
  }

  /* CONVERSATION */
  @chat-mode conversation {
    /* an arcane left edge on the first message of a run. [data-grouped] marks
       continuations from the same character, and it exists only in
       Conversation mode. */
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css][data-grouped] {
      border-left: 2px solid transparent;
    }
    /* the Bubbles-layout bubble. In the Linear layout there is no bubble, so
       the EVERYWHERE row hooks above carry the theme instead. */
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    /* "(name) is typing..." (Linear layout) */
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
      letter-spacing: 0.05em;
      text-shadow: 0 0 8px rgba(255, 92, 138, 0.6);
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
      box-shadow: 0 0 6px rgba(255, 92, 138, 0.85);
    }

    /* the avatar-click profile popout. The popout card is the scope element,
       so target it with no space, and its children as descendants. */
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-avatar > div {
      border-radius: 0.9rem;
      box-shadow: 0 0 0 2px #dc2678, 0 0 14px rgba(168, 85, 247, 0.5);
    }
    [data-card-css] .mari-about-me-status {
      box-shadow: 0 0 8px rgba(255, 92, 138, 0.9);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
      text-shadow: 0 0 10px rgba(220, 38, 120, 0.6);
    }
    [data-card-css] .mari-about-me-handle {
      color: rgba(201, 168, 255, 0.8);
    }
    [data-card-css] .mari-about-me-presence {
      color: rgba(201, 168, 255, 0.7);
    }
    [data-card-css] .mari-about-me-box {
      background: rgba(168, 85, 247, 0.08);
      border: 1px solid rgba(220, 38, 120, 0.3);
      border-radius: 0.75rem;
    }
    [data-card-css] .mari-about-me-label {
      color: #dc2678;
      letter-spacing: 0.14em;
    }
    [data-card-css] .mari-about-me-badge {
      background: rgba(220, 38, 120, 0.18);
      color: #ffd7ef;
    }
    [data-card-css] .mari-about-me-text {
      color: #f3d7ff;
      font-family: "Iowan Old Style", Georgia, serif;
    }
  }

  /* GAME (set the mode to Chat) */
  @chat-mode game {
    /* Game has its own layout with no message bubbles. In Chat scope,
       [data-card-css] is the whole game surface, so theme the area broadly. */
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

**사용자 행과 캐릭터 행 비교.** **Exclusive** 범위에서 `[data-card-css]`는 캐릭터 자신의 메시지이며, 이 요소는 `.mari-message-assistant`이기도 합니다. 내가 보낸 행까지 꾸미려면 **Chat** 범위를 쓰세요. 이때 `[data-card-css]`는 영역 전체이고, `[data-card-css] .mari-message-user`와 `.mari-message-assistant`로 양쪽을 각각 지정합니다.

색, `content` 글리프, 글꼴을 바꿔서 나만의 카드로 만들어 보세요.

## AI 어시스턴트로 Card CSS 만들기

CSS를 직접 쓰고 싶지 않다면 AI 어시스턴트에게 아래 프롬프트를 주세요. 표시된 자리에 캐릭터 콘셉트를 채워 넣으면 됩니다.

```text
I'm creating a character card for Marinara Engine (an AI chat app). The card has a
"Creator Notes" field where I can embed <style> blocks. Write CSS that themes the
character's messages.

Character concept: [describe the aesthetic]

Technical constraints:
- Use [data-card-css] for the message row (works in both Exclusive and Chat modes);
  use normal class selectors for things inside it.
- [data-card-css] .mari-message-bubble = the visible bubble (background / border /
  corners / shadow); [data-card-css] .mari-message-content = the text;
  [data-card-css] .mari-message-name = the display name;
  [data-card-css] .mari-message-avatar button = the clickable avatar
  (non-clickable fallback: .mari-message-avatar > div; in roleplay the button sits
  under an extra glow-wrapper div).
- Style the typing indicator via [data-card-css] .mari-typing-text and
  [data-card-css] .mari-typing-dots span.
- Conversation only: the avatar-click "about me" popout is themable via
  [data-card-css].mari-about-me-popout (the card), the banner via
  .mari-about-me-banner, the avatar via .mari-about-me-avatar > div, the name via
  .mari-about-me-name, the box via .mari-about-me-box, and the body via
  .mari-about-me-text. Wrap these in @chat-mode conversation { ... }.
- Wrap roleplay-only CSS in @chat-mode roleplay { ... }, conversation-only in
  @chat-mode conversation { ... }; CSS outside applies everywhere.
- Blocked: url(https://...), @import, :has(), !important, app theme tokens
  (--primary, etc.). position: fixed becomes absolute. Use url(data:...) and
  rgba() colors.
- [data-grouped] marks continuation messages, in Conversation mode ONLY
  (roleplay rows never carry it); there, use
  [data-card-css]:not([data-grouped]) for first-in-group.

Output a single <style> block I can paste into Creator Notes.
```

## 관련 가이드

- [모양 설정](appearance-settings.md)
- [사용자 지정 CSS 테마(Theme Library)](custom-css-themes.md)
- [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)
