# 카드 CSS 테마 가이드

Card CSS는 캐릭터 카드나 페르소나 카드에 채팅 안에서 보이는 고유한 모양을 입힙니다. 카드의 **Creator Notes**(제작자 노트)에 CSS를 넣으면 Marinara가 그 캐릭터의 메시지에 적용합니다. 스타일을 입힐 수 있는 곳은 채팅뿐이며, 앱의 나머지 부분은 절대 바뀌지 않습니다. 이 가이드는 카드 제작자를 위한 것입니다.

## 시작하기 전에

이 가이드에서 쓰는 용어입니다.

- **CSS**는 색, 글꼴, 테두리, 여백을 지정합니다.
- **Card CSS**(카드 CSS)는 카드에 넣어 둔 CSS입니다. 그 카드의 메시지에 테마를 입힙니다.
- **Card Theming**(카드 테마)은 채팅마다 Card CSS를 켜는 컨트롤입니다. **Chat Settings → Characters**(채팅 설정 → 캐릭터)에 있습니다(Game에서는 **Party**(파티)).
- **선택자**는 CSS 규칙에서 스타일을 적용할 요소를 고르는 부분입니다. 두 선택자 사이의 공백은 "안쪽"을 뜻하므로 `.a .b`는 `.a` 안에 있는 `.b`에 적용됩니다.
- **레이아웃**은 메시지를 배치하는 방식입니다. Conversation(대화)에는 줄 단위로 배치하는 **Linear**와 말풍선 형태의 **Bubbles**가 있습니다.

## 빠르게 시작하기

2단계에서 붙여넣을 시작용 블록입니다.

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

먼저 카드에 CSS를 넣고, 그다음 채팅에서 켭니다.

1. Character Editor(캐릭터 편집기)에서 캐릭터를 열고 **Creator Notes**를 찾으세요. 페르소나는 Persona Editor(페르소나 편집기)에 같은 필드가 있습니다.
2. **Creator Notes**에 시작용 블록을 붙여넣고 카드를 저장하세요.
3. 그 캐릭터와의 채팅을 여세요.
4. **Chat Settings**를 연 다음 **Characters**로 이동하세요(Game에서는 **Party**).
5. **Card Theming**에서 **Exclusive**(단독)나 **Chat**(채팅)을 고르세요. 처음에는 **Disabled**(비활성화됨) 상태입니다.

캐릭터의 메시지가 곧바로 바뀝니다.

작동하지 않는 경우: **Disabled**, **Exclusive**, **Chat** 버튼은 채팅에 참여 중인 캐릭터의 **Creator Notes**에 CSS가 있을 때만 나타납니다. 페르소나의 CSS만으로는 버튼이 나타나지 않으므로, 페르소나의 테마를 쓰려면 채팅에 `<style>` 블록이 있는 캐릭터도 하나 있어야 합니다. `<style>` 블록이 저장됐는지 확인하세요. Roleplay(롤플레이) 채팅에서 **Color Character Names in Text**(본문의 캐릭터 이름에 색상 적용)는 **Characters**의 **Add Character**(캐릭터 추가) 아래에 있습니다.

어느 레이아웃에서든 이름이 분홍빛으로 빛나고 본문이 연분홍이 됩니다. 말풍선 규칙은 보라색 그라데이션과 분홍 테두리를 더합니다. `.mari-message-bubble`은 **Bubbles** 레이아웃과 롤플레이에만 있으므로, 기본 Conversation 레이아웃인 **Linear**에서는 말풍선 규칙이 아무 효과도 내지 않습니다.

놓칠 수 없는 테스트를 하려면 이 규칙을 쓰세요. 모든 모드와 레이아웃에 있는 메시지 본문을 대상으로 하며, 본문 배경을 선명한 분홍으로 바꿉니다.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Card Theming의 동작 방식

**Creator Notes**에 CSS가 있는 캐릭터가 활성 상태이면 Marinara는 모든 `<style>` 블록을 읽고, 위험한 부분을 제거하고([스타일을 적용할 수 없는 것](#what-you-cannot-style) 참고), CSS가 채팅에만 닿도록 범위를 한정한 뒤, 그 선택자가 앱 자체의 메시지 스타일보다 우선하도록 주입합니다.

적용 방식은 **Chat Settings → Characters**(Game에서는 **Party**)에서 채팅별로 고릅니다.

| 모드 | 동작 |
| --- | --- |
| **Disabled**(기본값) | Card CSS가 꺼져 있습니다. |
| **Exclusive** | 각 캐릭터의 CSS가 그 캐릭터 자신의 메시지에만 적용됩니다. |
| **Chat** | 모든 카드 CSS가 UI 요소를 포함한 채팅 영역 전체에 적용됩니다. |

캐릭터마다 다른 모양을 주는 그룹 채팅에는 **Exclusive**를 쓰세요. 배경처럼 채팅 화면 전체에 테마를 입히는 1:1 카드에는 **Chat**을 쓰세요.

## 범위 규칙

Marinara는 CSS가 채팅에만 닿도록 다시 씁니다.

- **Chat** 모드에서는 모든 규칙이 채팅 영역 아래로 한정됩니다. `[data-card-css]`는 채팅 영역을 뜻합니다.
- **Exclusive** 모드에서는 모든 규칙이 그 캐릭터의 각 메시지 요소 아래로 한정됩니다. `[data-card-css]`는 이 캐릭터의 메시지를 뜻합니다.

그러므로 메시지 요소 자체에는 `[data-card-css]`를 쓰고, `.mari-message-bubble`, `.mari-message-content`, `.mari-message-name`처럼 그 안에 있는 요소에는 일반 클래스 선택자를 쓰세요. 같은 요소에 붙은 클래스는 하위 요소로 일치하지 않습니다. `[data-card-css] .mari-message-...` 형태로 만들면 카드가 두 모드 모두에서 동작합니다.

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

**Exclusive** 범위에서 `[data-card-css]`는 캐릭터 자신의 메시지이며, 이 요소는 `.mari-message-assistant`이기도 합니다. 내가 보낸 행까지 꾸미려면 **Chat** 범위를 쓰세요. 그 범위에서는 `[data-card-css] .mari-message-user`와 `.mari-message-assistant`로 양쪽을 각각 지정합니다.

## @chat-mode로 특정 모드 지정하기

한 화면만 겨냥하려면 규칙을 `@chat-mode roleplay`, `@chat-mode conversation`, `@chat-mode game`으로 감싸세요. 어느 블록에도 속하지 않은 CSS는 모든 곳에 적용됩니다. 표준 `@media` 쿼리도 이 블록 안에서 동작합니다.

```html
<style>
  /* Applies in all modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

Game mode(게임 모드)는 기본적인 수준까지 지원합니다. **Chat** 모드에서는 카드 CSS가 게임 화면 전체에 닿으므로 `[data-card-css]`가 게임 영역에 테마를 입힙니다. Game은 자체 레이아웃을 쓰고 메시지 말풍선이 없으므로 영역 배경처럼 넓게 겨냥하세요. 게임 서술을 캐릭터별로(**Exclusive**) 꾸미는 기능은 아직 제공하지 않습니다.

## 스타일을 적용할 수 있는 것

Roleplay와 Conversation은 같은 뼈대를 씁니다. 아래의 `mari-*` 클래스와 `data-*` 속성만 쓰세요. 다른 클래스는 버전마다 바뀝니다.

| 선택자 | 대상 |
| --- | --- |
| `[data-card-css]` | 메시지 행 전체(범위 요소). 가장자리 강조선에 적합합니다. **Chat** 모드에서는 채팅 영역입니다. |
| `[data-card-css] .mari-message-bubble` | 눈에 보이는 말풍선. 배경, 테두리, 모서리, 그림자. **Bubbles**와 롤플레이에 있습니다. |
| `[data-card-css] .mari-message-content` | **Bubbles**에서는 말풍선 요소 자체. **Linear**에서는 메시지 본문만. |
| `[data-card-css] .mari-message-name` | 캐릭터의 표시 이름. |
| `[data-card-css] .mari-message-meta` | 이름과 시각이 들어가는 머리 행. |
| `[data-card-css] .mari-message-timestamp` | 시각 표시. |
| `[data-card-css] .mari-message-avatar` | 아바타 열. |
| `[data-card-css] .mari-message-narrator` | 내레이터 메시지(롤플레이). |
| `[data-card-css] .mari-message-user` | 사용자 메시지. 캐릭터 메시지에는 `.mari-message-assistant`를 쓰세요. |
| `[data-card-css] p`, `[data-card-css] span` | 본문 안의 문단과 인라인 span. |
| `[data-grouped]` | 같은 캐릭터가 이어서 보낸 메시지. Conversation 전용입니다. 묶음의 첫 메시지에는 `[data-card-css]:not([data-grouped])`를 쓰세요. |

레이아웃을 바꾸려면 **Settings → Appearance → Conversation**(설정 → 모양 → 대화)을 열고 **Conversation Display**(대화 표시), **Chat Layout**(채팅 레이아웃) 순으로 이동하세요. **Linear**에는 말풍선이 없으므로 `.mari-message-content`(본문)와 `[data-card-css]`(행)에 스타일을 주세요.

말풍선을 꾸민 예입니다.

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

Conversation의 **Linear** 레이아웃에서는 캐릭터가 글을 쓰는 동안 "(name) is typing..." 행이 표시됩니다.

| 선택자 | 대상 |
| --- | --- |
| `[data-card-css] .mari-typing-text` | 라벨. |
| `[data-card-css] .mari-typing-dots span` | 움직이는 점. |
| `[data-card-css] .mari-typing-indicator` | 행. 이름을 `data-typing-name`으로 담고 있습니다. |

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

아바타는 기본적으로 원형입니다. 예시는 클릭할 수 있는 아바타 버튼을 대상으로 합니다. 클릭할 수 없는 아바타에는 `.mari-message-avatar > div`를 쓰세요. 롤플레이에서는 버튼이 빛 효과용 `div` 안에 한 겹 더 들어가 있습니다. 직접 지정한 고리만 보이게 하려면 그 겹을 없애세요.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### About Me 프로필 팝아웃(Conversation 전용)

Conversation 모드에서 아바타를 클릭하면 "about me"가 담긴 프로필 팝아웃이 열립니다. 캐릭터 카드와 페르소나 모두 자기 팝아웃에 테마를 입힐 수 있습니다. 이 팝아웃은 롤플레이와 게임에는 없으므로, 다른 모드용 CSS도 함께 넣는다면 이 규칙들을 `@chat-mode conversation`으로 감싸세요.

팝아웃 카드가 범위 요소입니다. `[data-card-css].mari-about-me-popout`(공백 없음, 같은 요소)으로 카드를 지정하고, 그 안의 요소는 하위 선택자로 지정하세요. **Chat** 모드에서는 `.mari-about-me-name`을 바로 써도 됩니다.

| 선택자 | 대상 |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | 팝아웃 카드. 배경, 테두리, 모양. |
| `[data-card-css] .mari-about-me-banner` | 위쪽 띠(기본값은 이름 색). |
| `[data-card-css] .mari-about-me-avatar` | 확대된 아바타를 감싸는 요소. 원형에는 `... > div`를 쓰세요. |
| `[data-card-css] .mari-about-me-status` | 접속 상태 점(캐릭터 전용). |
| `[data-card-css] .mari-about-me-name` | 표시 이름 제목. |
| `[data-card-css] .mari-about-me-handle` | 보조 @이름 줄. Convo 표시 이름이 다를 때 나타납니다. |
| `[data-card-css] .mari-about-me-presence` | 상태나 활동 줄(캐릭터 전용). |
| `[data-card-css] .mari-about-me-box` | About Me 내용 상자. |
| `[data-card-css] .mari-about-me-label` | "ABOUT ME" 문구. |
| `[data-card-css] .mari-about-me-badge` | Default 또는 Chat-specific 알약 모양 표시. |
| `[data-card-css] .mari-about-me-text` | about me 본문. |

```css
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
  }
}
```

<a id="what-you-cannot-style"></a>

## 스타일을 적용할 수 없는 것

보안을 위해 아래 항목은 검사 과정에서 제거됩니다.

| 차단 대상 | 이유 |
| --- | --- |
| `url(https://...)` | 추적과 데이터 유출을 막기 위해 네트워크 요청을 허용하지 않습니다. 인라인 이미지와 글꼴을 위한 `url(data:...)`만 허용합니다. |
| 외부 URL을 쓰는 `@font-face` | `data:` 글꼴 소스만 남습니다. 앱 글꼴을 덮어쓰지 못하도록 글꼴 패밀리 이름이 바뀝니다. |
| `@import` | 외부 스타일시트를 불러올 수 없습니다. |
| `:has()` 선택자 | 채팅 바깥의 요소를 살펴볼 수 없습니다. |
| 중첩 규칙과 `~` 또는 `+`로 시작하는 선택자 | 카드 CSS가 범위 밖에 닿지 못하도록 버려집니다. 일반 선택자로 작성하세요. |
| `content:` 안의 HTML | 장식용 텍스트는 쓸 수 있지만 `<`와 `>`는 제거되고 길이는 200자로 제한됩니다. `attr()`과 `counter()`는 허용됩니다. |
| `position: fixed` | `position: absolute`로 바뀌므로 전체 화면을 덮을 수 없습니다. |
| `!important` | 제거됩니다. 카드 CSS가 앱 스타일을 강제로 덮어쓸 수 없습니다. |
| 앱 테마 토큰 | `--primary`, `--background` 같은 토큰은 제거됩니다. 카드 CSS로 앱 UI의 색을 바꿀 수 없습니다. |

채팅 안에서는 색, 배경, 테두리, 글꼴에 대해 카드 CSS가 앱 자체의 메시지 스타일보다 우선합니다. 검사 과정에서 제거되는 항목, 채팅 바깥의 모든 것, 앱이 인라인이나 `!important`로 적용하는 스타일은 이길 수 없습니다. **Settings**에서 지정하는 전체 채팅 글자 색과 크기가 그런 예입니다.

사용자 지정 글꼴은 base64 `data:` URI로 넣거나 시스템 글꼴 목록을 쓰세요.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## 팁

1. 말풍선에는 `[data-card-css]`가 아니라 `.mari-message-bubble`로 스타일을 주세요. 행은 폭 전체를 차지하므로 행에 배경을 넣어도 거의 보이지 않습니다.
2. 밝은 테마와 어두운 테마 양쪽에 자연스럽게 어울리도록 `rgba()` 색을 쓰세요.
3. 애니메이션은 은은하게 유지하세요. 사양이 낮은 기기를 생각하면 무거운 `animation`보다 `transition`이 낫습니다. `box-shadow`가 아니라 `opacity`에 애니메이션을 주세요. `box-shadow`는 프레임마다 다시 그려집니다.
4. 휴대전화용으로는 `@media (max-width: 768px)`를 쓰세요.
5. 유틸리티 클래스에 의존하지 마세요. 문서에 실린 `mari-*` 훅만 안정적입니다.

## 예시 모음: Eldritch Grimoire

이 예시는 모든 모드에서 주요 훅을 사용합니다. 빛나는 이름, 테마에 맞춘 세리프 본문, 고리를 두른 아바타, 모서리에 룬을 넣고 움직이는 롤플레이 말풍선, Conversation 말풍선, 으스스한 입력 중 표시, 게임 화면이 들어 있습니다. **Creator Notes**에 붙여넣은 다음 **Chat Settings → Characters**(Game에서는 **Party**)에서 Card Theming 모드를 고르세요. 게임 화면에는 **Chat**으로 설정하세요. 색, `content` 글리프, 글꼴을 바꿔서 나만의 카드로 만들어 보세요.

```html
<style>
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* All modes */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
  }
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  @chat-mode roleplay {
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* breathing inner glow: animate a full-bleed overlay's opacity, which is cheap */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
    }
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
    }
  }

  @chat-mode conversation {
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
    }
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
    }
  }

  /* Game: in Chat scope, [data-card-css] is the whole game surface */
  @chat-mode game {
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

## AI 어시스턴트로 Card CSS 만들기

CSS를 직접 쓰지 않으려면 AI 어시스턴트에게 이 프롬프트를 주세요. 표시된 자리에 캐릭터 콘셉트를 채워 넣으세요.

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
