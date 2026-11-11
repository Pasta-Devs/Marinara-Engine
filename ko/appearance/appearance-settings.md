# 모양 설정

이 가이드에서는 Marinara의 겉모습을 바꾸는 **Appearance**(모양) 탭을 설명합니다. 이 탭에서 색상, 글자 크기, 채팅 레이아웃, 채팅 모드별 메시지 스타일을 바꿉니다.

다른 내용을 찾고 있다면 아래 가이드를 참고하세요.

- 다른 폰트: [사용자 지정 폰트와 Google Fonts](fonts.md)
- 채팅 배경 이미지: [채팅 배경](chat-backgrounds.md)
- **Settings → Addons → Theme Library**(설정 → 애드온 → 테마 라이브러리)의 사용자 지정 테마: [사용자 지정 CSS 테마](custom-css-themes.md)
- 채팅에서 캐릭터 고유의 모습: [카드 CSS 테마 가이드](card-css-theming.md)

## 모양 설정 열기

1. **Settings**를 여세요.
2. **Appearance** 탭을 선택하세요.
3. 위쪽에서 **App**(앱), **Conversation**(대화), **Roleplay**(롤플레이), **Game**(게임) 중 버튼 하나를 고르세요.

이 버튼들은 설정을 채팅 모드별로 묶으며, 탭에는 고른 묶음만 표시됩니다.

| 버튼 | 섹션 |
| --- | --- |
| **App** | **App Style**(앱 스타일), **Text & Scale**(텍스트 및 배율), **Atmosphere**(분위기), **Backgrounds**(배경) |
| **Conversation** | **Conversation Display**(대화 표시), **Conversation Theme**(대화 테마) |
| **Roleplay** | **Tracker Panel**(트래커 패널), **Roleplay Presentation**(롤플레이 표시 방식) |
| **Game** | **Game Presentation**(게임 연출) |

처음부터 다시 시작하려면 **App Style** 맨 위의 **Reset Appearance**(외형 초기화)를 클릭하세요. 탭 전체가 Marinara 기본값으로 돌아가고, 현재 채팅의 배경이 지워지며, Theme Library에서 적용해 둔 테마도 꺼집니다.

## App 버튼

### 색상 구성과 비주얼 스타일

**App Style**의 **Color Scheme**(색상 구성) 드롭다운에는 **Dark**(어둡게)와 **Light**(라이트)가 있으며, 기본값은 **Dark**입니다. 고르는 즉시 앱이 바뀝니다. 어두운 화면용 기본값과 밝은 화면용 기본값이 따로 있는 색상은 직접 지정하기 전까지 이 설정을 따릅니다.

**Visual Style**(비주얼 스타일)에는 카드가 두 개 있습니다. **Default (Marinara)**는 글로우 효과가 있는 레트로 Y2K 스타일입니다. **SillyTavern**은 깔끔하고 미니멀한 스타일입니다. 이 설정은 겉모습만 바꾸며, SillyTavern에서 데이터를 가져오는 기능과는 아무 관계가 없습니다.

### 앱 배경과 강조 색상

**Accent Color**는 단색이나 그라데이션을 받습니다. 그라데이션은 두 가지 이상의 색이 부드럽게 섞이는 표현입니다. 기본값으로 되돌리려면 **Reset to default**(기본값으로 초기화)로 입력란을 비우세요.

| 설정 | 칠하는 곳 | 기본값 |
| --- | --- | --- |
| **Accent Color**(강조 색상) | 버튼, 활성 아이콘, 포커스 링, 하이라이트, 패널 외곽선, 채팅 주변의 컨트롤입니다. | **Marinara Gradient**(Marinara 그라디언트). 분홍, 주황, 청록이 섞인 그라데이션입니다 |

앱 기본 화면 틀의 배경을 바꾸려면 **App Style**의 **UI Editor**(UI 편집기)를 사용하세요.

1. **Choose what to change…**(변경할 대상 선택) 드롭다운을 열고 **Whole app**(앱 전체) 항목을 선택하세요.
2. **Background**(배경) 항목을 클릭하고 색이나 그라데이션을 선택하세요.
3. **Save**(저장)를 클릭하세요.

저장된 배경이 없으면 앱은 Dark에서 `#050312`, Light에서 `#faf8ff`를 사용합니다. 기본값으로 되돌리려면 **Whole app** 항목을 다시 열고 **Reset to default**를 클릭하세요.

`#050312` 같은 값은 색을 짧게 적는 방식인 16진수 색상 코드입니다.

스위치 두 개가 강조 색상의 동작을 바꿉니다. 한 번에 하나만 켤 수 있습니다.

- **Accent Pulse**(강조 효과)는 강조 색상에 애니메이션을 적용합니다. 단색은 밝아졌다 어두워지고, 그라데이션은 색 사이를 순환합니다. 기본값은 데스크톱에서 켜짐, 휴대폰에서 꺼짐입니다.
- **RGB Mode**(RGB 모드)는 강조 색상이 무지개 색을 따라 순환하게 합니다. 저장해 둔 **Accent Color**는 바뀌지 않습니다. 기본값은 꺼짐입니다.

기기에 모션 줄이기가 설정되어 있으면 두 애니메이션 모두 나타나지 않습니다.

### 그 밖의 App Style 컨트롤

- **Custom Mouse Pointer**(사용자 지정 마우스 포인터, 기본값 켜짐)는 Marinara의 강조 색상 커서를 사용합니다. 시스템 커서를 쓰거나 사용자 지정 테마에 커서를 맡기려면 끄세요.
- **Reduce Ambient Animations & Effects**(앰비언트 애니메이션 및 효과 줄이기)는 장식용 애니메이션, 주변 파티클, 회전하는 미리보기, 텍스트가 서서히 나타나는 효과를 멈춥니다. 기기에 모션 줄이기가 설정되어 있을 때도 Marinara가 같은 동작을 합니다.
- **Desktop sidebar width**(데스크톱 사이드바 너비)는 데스크톱에서 양쪽 사이드바의 너비를 정합니다. **Reset width**(너비 초기화)를 누르면 원래대로 돌아갑니다. 휴대폰은 기존 배치를 유지합니다.

### 채팅 위젯 스타일

**App Style** 아래쪽에서 이동 가능한 채팅 버튼, 창, 섹션에 쓸 스타일로 **Default**(기본값), **Dottore**, **Prof. Mari** 중 하나를 고르세요. 폰트, 모양, 세 가지 주요 색상은 따로 바꿀 수 있으며, 세 가지 **Apply preset**(프리셋 적용) 스위치를 켜면 그 스타일이 메시지, 입력란, 채팅 컨트롤에도 적용됩니다. **Button size (px)**(버튼 크기, px)는 **Display Size**(디스플레이 사이즈)를 바꾸지 않고 이동 가능한 채팅 버튼과 아이콘의 크기를 바꿉니다. 32에서 96 사이의 값을 입력하거나, 비워 두면 기본값을 씁니다. 모든 컨트롤은 [사용자 지정 CSS 테마](custom-css-themes.md#ready-made-chat-window-styles)를 참고하세요.

### 디스플레이 사이즈와 채팅 폰트 사이즈

**Text & Scale** 섹션에 있는 설정입니다.

- **Display Size**는 이 기기에서 앱 전체의 기준 글자 크기를 정합니다. 변경 사항은 즉시 적용됩니다. 다음 중 하나를 고르세요.

| 선택지 | 크기 |
| --- | --- |
| **Tiny**(매우 작음) | 12 px |
| **Small**(작음) | 14 px |
| **Medium**(중간) | 16 px |
| **Default** | 17 px |
| **Large**(큼) | 19 px |
| **Huge**(매우 큼) | 22 px |
| **Extra large**(매우 크게) | 26 px |
| **Extra extra large**(매우 매우 크게) | 30 px |
| **Maximum**(최대) | 34 px |

- **Chat Font Size**(채팅 폰트 사이즈)는 채팅 메시지 글자 크기를 정하는 슬라이더입니다. 범위는 12 px에서 72 px까지이고, 기본값은 16 px입니다.

**Font**(폰트) 드롭다운도 같은 섹션에 있습니다. [사용자 지정 폰트와 Google Fonts](fonts.md)를 참고하세요.

### 채팅 텍스트 색상과 윤곽선

역시 **Text & Scale** 섹션에 있는 설정입니다.

- **Chat Text Color**(채팅 글자색)는 메시지 본문의 기본 글자 색입니다. 기본값은 Dark에서 `#d4d4d4`, Light에서 `#1a1025`입니다.
- **Default Dialogue Color**(기본 대사 색상)는 캐릭터나 페르소나에 자체 Dialogue Highlight Color가 없을 때 따옴표 안의 대사에 쓰입니다. 카드에 지정된 색상이 우선합니다. **Apply preset colors**(프리셋 색상 적용)가 켜져 있는 동안에는 대사에 채팅 스타일의 글자 색상이 쓰입니다.
- **Chat Chrome Text Color**(채팅 UI 텍스트 색상)는 트래커 위젯, 폴더 라벨, 설정 설명문처럼 채팅 주변 컨트롤의 글자 색을 정합니다. 기본값은 **Chat Text Color**와 같습니다.
- **Text Outline / Stroke**(텍스트 윤곽선 / 스트로크)는 글자에 윤곽선을 넣어 복잡한 배경 위에서도 읽기 쉽게 합니다. 색상을 정하고 **Width**(굵기)를 0에서 5 px 사이로 지정하세요. 기본값은 0.5 px이고, 0으로 두면 윤곽선이 꺼집니다.

색상 입력란을 비우면 해당 색상 구성의 기본값으로 돌아갑니다.

### 분위기

**Dynamic weather effects (rain, snow, fog, etc.)**(동적 날씨 효과(비, 눈, 안개 등))는 기본값이 켜짐입니다. 이야기 속 날씨와 시간대에 맞춰 날씨 파티클을 보여 줍니다. 해당 채팅에서 **World State**(월드 트래커) 에이전트가 켜져 있을 때만 화면에 효과가 나타납니다. [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요.

### 배경

**Backgrounds** 섹션에는 **Chat Background**(채팅 배경화면) 선택기와 **Background Blur**(배경 흐림)가 있습니다. 컨트롤이 두 개 더 있습니다. **Conversation background image opacity**(대화 배경 이미지 불투명도)는 Conversation 모드에서 그라데이션이 보이는 상태로 채팅 배경이 얼마나 진하게 보일지 정합니다. **Chat List Backgrounds**(채팅 목록 배경)는 채팅 목록에서 각 채팅의 배경을 행 뒤에 은은한 배너로 보여 줍니다. **Active & Hovered**, **Every Row**, **Off** 중에서 고르세요. [채팅 배경](chat-backgrounds.md)을 참고하세요.

## Conversation 버튼

- **Conversation Display**에 있는 **Chat Layout**(채팅 레이아웃)은 Conversation 메시지의 표시 방식을 바꾸며, 실시간 미리보기를 보여 줍니다. **Linear**(기본값)는 채팅 형식의 행으로, **Bubbles**는 메신저 형식의 말풍선으로 표시합니다.
- **Avatar Shape**(아바타 모양)는 **Circular**(원형) 또는 **Square**(사각형)입니다. 아바타 크기는 그대로입니다.
- **Always display swipe menu**(항상 스와이프 메뉴 표시)는 첫 응답부터 스와이프 화살표와 카운터를 보여 줍니다. 재생성한 뒤에만 보이게 하려면 끄세요.
- **Conversation Theme**는 모든 Conversation 채팅 뒤에 깔리는 두 색상 그라데이션을 정합니다. **Dark** 탭과 **Light** 탭은 각자 그라데이션을 따로 가집니다. 채팅별 설정이 아니라 이 기기 전체에 적용되는 기본값입니다.

## Roleplay 버튼

**Tracker Panel**은 Roleplay 트래커 사이드 패널의 모양을 정합니다. [Roleplay HUD와 트래커](../roleplay/hud-and-trackers.md)를 참고하세요.

**Roleplay Presentation**은 Roleplay 메시지의 모양을 정합니다.

| 설정 | 하는 일 | 기본값 |
| --- | --- | --- |
| **Chat position**(채팅 위치) | 넓은 화면에서 메시지와 입력 상자가 놓일 위치입니다. **Left**(왼쪽), **Center**(가운데), **Right**(오른쪽) 중에서 고릅니다. 같은 쪽에 열린 사이드바나 Tracker Panel이 있으면 그만큼 옆으로 밀려납니다. 휴대폰에서는 화면 너비를 그대로 씁니다. | **Center** |
| **Visual Novel display**(비주얼 노벨 표시) | 완성된 문단을 한 번에 하나씩, 대화 초상화와 설정해 둔 스프라이트와 함께 보여 줍니다. 현재 Roleplay 채팅과, 저장된 스타일이 없는 채팅의 기본값이 함께 바뀝니다. | 꺼짐 |
| **Roleplay Messages Background Opacity**(롤플레이 메시지 배경 불투명도) | 0%에서 100%까지의 슬라이더입니다. 값을 낮추면 말풍선 너머로 배경이 비쳐 보입니다. | 90% |
| **Roleplay Avatars**(롤플레이 아바타) | 메시지 옆에 붙는 아바타 스타일입니다. **None**, **Small Circles**, **Small Rectangles**, **Glued Side Panel** 중에서 고릅니다. | **Small Circles** |
| **Scrollable Avatars**(스크롤 가능한 아바타) | 긴 메시지를 스크롤하는 동안에도 아바타가 계속 보이게 합니다. | 꺼짐 |
| **Message avatar scale**(메시지 아바타 크기) | 75%에서 250%까지의 슬라이더입니다. | 100% |
| **Default sprite scale**(기본 스프라이트 배율) | 50%에서 175%까지의 슬라이더입니다. 채팅별로 지정한 스프라이트 크기가 계속 우선합니다. | 100% |

이 섹션에는 **Custom chat width**(사용자 지정 채팅 너비), **Always display swipe menu**, **Reduced paint effects**(렌더링 효과 간소화), **Show Thinking In Messages**(메시지에 추론 표시), **Don't Collapse Thinking**(생각 접지 않기), **Narrator's Cycling Avatars**(내레이터 아바타 순환)도 있습니다. **Reduced paint effects**는 부담이 큰 투명 효과와 그림자를 단순하게 바꿔 화면 이동을 매끄럽게 유지합니다. **Visual Novel display**를 켜면 **Paragraph delay**(문단 지연 시간)를 정할 수 있는 **Auto-play VN paragraphs**(VN 문단 자동 재생), **Dialogue portrait scale**(대화 초상화 배율), **Full-body sprite scale**(전신 스프라이트 크기)도 나타납니다.

## Game 버튼

**Game Presentation**의 **Game VN Art**(게임 비주얼노벨 아트)에는 슬라이더가 두 개 있습니다. **Dialogue portrait scale**(75%에서 175%, 기본값 100%)과 **Full-body sprite scale**(75%에서 275%, 기본값 135%)입니다.

**Game Dialogue Display**(게임 대사 화면)는 대화 상자의 동작 방식을 정합니다.

- **Classic Dialogue Box**(기본값)는 현재 구간 하나만 보여 줍니다. 지난 대사는 **Logs**(로그) 버튼에 있습니다.
- **History Above Dialogue Box**는 이전 구간을 대화 상자 위쪽에 표시하며, 그 자리에서 세션 전체를 스크롤할 수 있습니다.

**Game text effects**(게임 텍스트 효과, 기본값 켜짐)는 극적인 단어, 모두 대문자로 쓴 강조, 괄호 속 방백, 텍스트 효과 태그에 애니메이션을 적용합니다. 평범한 텍스트로 보려면 끄세요.

## 이 기기에만 저장되는 설정

Appearance 설정 대부분은 다른 기기와 동기화됩니다. **Display Size**와 **Chat Font Size**는 동기화되지 않으며, 지금 쓰는 브라우저에 저장됩니다. 무엇이 동기화되는지는 [설정 개요](../settings/settings-overview.md)를 참고하세요.

## 관련 가이드

- [사용자 지정 폰트와 Google Fonts](fonts.md)
- [채팅 배경](chat-backgrounds.md)
- [사용자 지정 CSS 테마(Theme Library)](custom-css-themes.md)
- [카드 CSS 테마 가이드](card-css-theming.md)
- [설정 개요](../settings/settings-overview.md)
