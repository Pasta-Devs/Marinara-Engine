# 모양 설정

이 가이드에서는 Marinara Engine의 **Settings -> Appearance**(설정 -> 모양) 탭을 섹션별로 살펴봅니다. 색상, 글자 크기, 채팅 레이아웃, 모드별 메시지 스타일, 그리고 전체를 기본값으로 되돌리는 방법을 다룹니다.

폰트, 배경, 사용자 지정 CSS 테마는 각각 별도의 가이드가 있습니다. 이 문서에서는 해당 내용이 나오는 자리마다 링크를 걸어 두었습니다.

## 모양 설정 열기

1. **Settings**(설정)를 여세요.
2. **Appearance**(모양) 탭을 선택하세요.

이 탭은 아래로 스크롤하며 살펴보는 여러 섹션으로 나뉩니다. **App Style**(앱 스타일), **Text & Scale**(텍스트 및 배율), **Conversation Display**(대화 표시), **Tracker Panel**(트래커 패널), **Roleplay Messages**(롤플레이 메시지), **Game Presentation**(게임 연출), **Atmosphere**(분위기), **Conversation Theme**(대화 테마), **Backgrounds**(배경) 섹션이 있습니다.

## 색상 구성(Dark 또는 Light)

**Color Scheme**(색상 구성) 드롭다운은 **App Style** 섹션에 있습니다. 선택지는 두 가지입니다.

- **Dark**(기본값). 어두운 방에서 눈이 덜 피로합니다.
- **Light**.

아래에 나오는 색상 중 몇 가지는 어두운 화면용 기본값과 밝은 화면용 기본값을 따로 가지고 있습니다. 색상을 직접 지정하기 전까지는 현재 Color Scheme을 자동으로 따릅니다.

## 비주얼 스타일

**Visual Style**(비주얼 스타일)은 앱 전체의 인상을 정합니다. 카드 두 개 중에서 고르세요.

- **Default (Marinara)**(기본값). 글로우 효과가 있는 레트로 Y2K 스타일입니다.
- **SillyTavern**. 원본 SillyTavern에서 영감을 받은 깔끔하고 미니멀한 스타일입니다.

겉모습만 바꾸는 설정입니다. 별도의 도구인 SillyTavern에서 데이터를 가져오는 기능과는 아무 관계가 없습니다.

## 배경색과 강조 색상

이 두 컨트롤은 **App Style** 섹션에 있습니다. 둘 다 단색과 그라데이션을 모두 받습니다. 그라데이션은 두 가지 이상의 색이 부드럽게 섞이는 표현입니다.

- **Background Color**(배경색)는 모든 요소 뒤에 깔리는 앱 바탕을 칠합니다. 기본값은 Dark 모드에서 `#050312`, Light 모드에서 `#faf8ff`입니다.
- **Accent Color**(강조 색상)는 버튼, 활성 아이콘, 포커스 링, 하이라이트, 패널 외곽선의 색을 정합니다. 기본값은 두 색상 구성 모두 `#d4acfb`입니다.

`#d4acfb` 같은 값은 색을 짧게 적는 방식인 16진수 색상 코드입니다. 색상 구성 기본값으로 되돌리려면 **Reset to default**(기본값으로 초기화)로 입력란을 비우세요.

토글 두 개가 Accent Color의 동작을 바꿉니다.

- **Accent Pulse**(강조 효과, 기본값 꺼짐)는 Accent Color에 은은한 애니메이션을 적용합니다. 단색은 밝아졌다 어두워지고, 그라데이션은 색 사이를 순환합니다.
- **RGB Mode**(RGB 모드, 기본값 꺼짐)는 켜져 있는 동안 강조 색상이 무지개 색을 따라 계속 바뀝니다. 저장해 둔 Accent Color 자체는 바뀌지 않습니다.

두 기능은 동시에 쓸 수 없습니다. **RGB Mode**를 켜면 **Accent Pulse**가 꺼지고, **Accent Pulse**를 켜면 **RGB Mode**가 꺼집니다. Accent Pulse는 Appearance 탭이 열려 있는 동안 실시간으로 미리 보입니다. 기기에 모션 줄이기가 설정되어 있으면 두 애니메이션 모두 나타나지 않습니다.

## 채팅 위젯 스타일

**App Style** 섹션 아래쪽에서 이동 가능한 채팅 버튼, 창, 섹션에 쓸 스타일로 **Default**(기본값), **Dottore**, **Prof. Mari** 중 하나를 고르세요. 글꼴, 프레임 모양, 세 가지 주요 색상은 따로 바꿀 수 있습니다. 색상 선택기는 그라데이션도 지원합니다.

**Button size (px)**(버튼 크기, px)는 Display Size를 바꾸지 않고 이동 가능한 채팅 버튼과 아이콘의 크기를 바꿉니다. 32부터 96픽셀 사이의 값을 입력하세요. 필드를 비우거나 초기화 버튼을 누르면 현재 기본값을 유지합니다. 크기는 모양 환경설정에 저장되며 다른 프리셋을 선택해도 그대로 유지됩니다.

색상 선택기 아래의 **Apply preset font**(프리셋 글꼴 적용), **Apply preset shape**(프리셋 모양 적용), **Apply preset colors**(프리셋 색상 적용)를 켜면 채팅의 나머지 영역도 같은 스타일로 맞출 수 있습니다. 세 스위치는 꺼진 상태로 시작하며 각각 독립적으로 동작합니다. 메시지, 입력란과 채팅 컨트롤에 적용됩니다. Game Mode에서는 HUD 위젯, 지도 패널, 부가 발언, 캐릭터 시트, 로그, 인벤토리, 전투 패널과 팝업 창에도 적용됩니다. Conversation 메시지는 선택한 글꼴과 색상을 사용하지만 원래 모양은 유지합니다. 사용자 지정 글꼴, 모양, 색상 선택도 함께 적용됩니다. **Apply preset colors**를 켜도 따옴표 안의 대사는 각 캐릭터나 페르소나에 지정된 Dialogue Highlight Color를 그대로 사용합니다. 예시와 사용자 지정 테마는 [사용자 지정 CSS 테마](custom-css-themes.md#ready-made-chat-window-styles)를 참고하세요.

## 사용자 지정 마우스 포인터

**Custom Mouse Pointer**(사용자 지정 마우스 포인터, 기본값 켜짐)는 앱 전체에서 Marinara의 강조 색상 커서를 사용합니다. 시스템 기본 커서를 쓰거나 사용자 지정 CSS 테마에 커서를 맡기려면 끄세요.

## 디스플레이 사이즈와 채팅 폰트 사이즈

이 두 컨트롤은 **Text & Scale** 섹션에 있습니다.

- **Display Size**(디스플레이 사이즈)는 이 기기에서 앱 전체의 기준 글자 크기를 정합니다. 선택지는 **Tiny**, **Small**, **Medium**, **Default**(17px), **Large**, **Huge**입니다.
- **Chat Font Size**(채팅 폰트 사이즈)는 채팅 메시지 글자 크기를 정하는 슬라이더입니다. 범위는 12px에서 48px까지이고, 기본값은 16px입니다.

**Font**(폰트) 드롭다운도 같은 섹션에 있습니다. 폰트를 직접 추가하거나 Google Fonts에서 다운로드하는 방법은 [사용자 지정 폰트와 Google Fonts](fonts.md)를 참고하세요.

## 채팅 텍스트 색상과 윤곽선

역시 **Text & Scale** 섹션에 있는 네 가지 컨트롤이 배경 위에서 채팅 텍스트가 어떻게 읽히는지를 조절합니다.

- **Chat Text Color**(채팅 글자색)는 채팅 메시지 본문 색을 정합니다. 기본값은 Dark 모드에서 `#d4d4d4`, Light 모드에서 `#1a1025`입니다.
- **Default Dialogue Color**(기본 대사 색상)는 캐릭터 카드나 페르소나 카드에 Dialogue Highlight Color가 지정되어 있지 않을 때 따옴표 안의 대사에 쓰입니다. 카드에 지정된 색상이 우선합니다. **Apply preset colors**가 켜져 있는 동안에는 이런 대사에 이 색상 대신 채팅 스타일의 글자 색상이 쓰입니다.
- **Chat Chrome Text Color**(채팅 UI 텍스트 색상)는 트래커 위젯, 폴더 라벨, 설정 설명문 같은 일반 텍스트의 색을 정합니다. 기본값은 **Chat Text Color**와 같습니다.
- **Text Outline / Stroke**(텍스트 윤곽선 / 스트로크)는 채팅 텍스트에 윤곽선을 넣어 복잡한 배경 위에서도 글자가 읽히게 합니다. 윤곽선 색상과 **Width**(굵기)를 0px에서 5px 사이로 지정하세요. 기본 굵기는 0.5px입니다. 굵기를 0으로 두면 윤곽선이 꺼집니다.

각 색상은 직접 지정하기 전까지 Color Scheme 기본값을 따릅니다. 색상 입력란을 비우면 빈 값이 되는 것이 아니라 해당 색상 구성의 기본값으로 돌아갑니다.

## 채팅 레이아웃(대화 표시)

**Conversation Display** 섹션에는 컨트롤이 하나 있습니다. **Chat Layout**(채팅 레이아웃)은 Conversation(대화) 모드 메시지의 표시 방식을 바꿉니다. 고르는 즉시 미리보기가 갱신됩니다.

- **Linear**(기본값). 채팅 형식의 행으로 표시합니다.
- **Bubbles**. 메신저 형식의 말풍선으로 표시합니다.

## 트래커 패널

**Tracker Panel** 섹션은 Roleplay(롤플레이)의 트래커 사이드 패널 모양을 정합니다. 이 패널은 별도의 기능이라 전용 가이드가 있습니다. [Roleplay HUD와 트래커](../roleplay/hud-and-trackers.md)를 참고하세요.

## Roleplay 메시지 모양

**Roleplay Messages** 섹션은 Roleplay 채팅의 메시지 모양을 정합니다.

- **Chat position**(채팅 위치)은 넓은 화면에서 메시지와 입력 상자가 놓일 위치를 정합니다. 선택지는 **Left**, **Center**(기본값), **Right** 세 가지입니다. 메시지와 입력 상자는 함께 움직이며, 같은 쪽에 사이드바나 Tracker Panel이 열려 있으면 채팅이 그 아래에 가려지지 않도록 옆으로 비켜납니다. 휴대폰이나 폭이 좁은 창에서는 채팅이 화면 너비를 그대로 쓰고, Game Mode는 대화 상자를 계속 가운데에 둡니다.
- **Roleplay Messages Background Opacity**(롤플레이 메시지 배경 불투명도)는 0%에서 100%까지의 슬라이더입니다. 기본값은 90%입니다. 값을 낮추면 말풍선 너머로 배경이 비쳐 보입니다.
- **Roleplay Avatars**(롤플레이 아바타)는 메시지 옆에 붙는 아바타 스타일을 정합니다. 선택지는 **None**, **Small Circles**(기본값), **Small Rectangles**, **Glued Side Panel** 네 가지입니다.
- **Scrollable Avatars**(스크롤 가능한 아바타, 기본값 꺼짐)를 켜면 긴 메시지를 스크롤하는 동안에도 아바타가 계속 보입니다.
- **Message avatar scale**(메시지 아바타 크기)은 75%에서 250%까지의 슬라이더입니다. 기본값은 100%입니다.
- **Default sprite scale**(기본 스프라이트 배율)은 50%에서 175%까지의 슬라이더입니다. 기본값은 100%입니다. 채팅별로 지정한 스프라이트 크기는 이 기본값보다 계속 우선합니다.

## 게임 연출

**Game Presentation** 섹션은 Game Mode(게임 모드)의 아트 크기를 조절합니다. Game Mode는 대화용 초상화와 전신 스프라이트를 함께 보여 줄 수 있는데, 아래 두 슬라이더가 각각의 크기를 정합니다.

- **Dialogue portrait scale**(대화 초상화 배율)은 75%에서 175%까지의 슬라이더입니다. 기본값은 100%입니다.
- **Full-body sprite scale**(전신 스프라이트 크기)은 75%에서 275%까지의 슬라이더입니다. 기본값은 135%입니다.

**Game Dialogue Display**(게임 대사 화면)는 대화 상자의 동작 방식을 정합니다.

- **Classic VN**(기본값). 대화 상자에 현재 구간 하나만 표시합니다. 지난 대사는 **Logs**(로그) 버튼에 모입니다.
- **History Above VN**. 이전 구간을 대화 상자 위쪽에 표시하며, 그 자리에서 세션 전체를 스크롤할 수 있습니다.

## 분위기 날씨 효과

**Atmosphere** 섹션에는 토글이 하나 있습니다. **Dynamic weather effects (rain, snow, fog, etc.)**(동적 날씨 효과(비, 눈, 안개 등))는 기본값이 켜짐이며, 이야기 속 날씨와 시간대에 맞춰 애니메이션 날씨 파티클을 보여 줍니다.

이 토글은 해당 채팅에서 **World State**(월드 트래커) 에이전트를 켰을 때만 효과가 나타납니다. 이야기에서 날씨를 읽어 오는 것이 이 에이전트이기 때문입니다. 에이전트가 꺼져 있으면 토글을 켜도 화면에 아무 변화가 없습니다. [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요.

## 대화 테마

**Conversation Theme** 섹션은 모든 Conversation 모드 채팅에 쓰이는 두 색상 그라데이션 배경을 정합니다. **Dark** 탭과 **Light** 탭이 따로 있어 색상 구성마다 그라데이션을 따로 둘 수 있습니다. 채팅별 설정이 아니라 이 기기의 Conversation 채팅 전체에 적용되는 기본값입니다.

## 배경

**Backgrounds** 섹션에서는 채팅 배경 이미지를 가져와 고르고 **Background Blur**(배경 흐림)를 지정할 수 있습니다. 자체 라이브러리를 갖춘 독립된 기능이라 전용 가이드가 있습니다. [채팅 배경](chat-backgrounds.md)을 참고하세요.

## 모양 초기화

**Reset Appearance**(외형 초기화) 버튼은 **App Style** 섹션 맨 위에 있습니다. 이 버튼을 누르면 **Appearance** 탭 전체가 Marinara 기본값으로 돌아갑니다. 색상, 글자 크기, 레이아웃, 아바타와 스프라이트 배율, 그라데이션이 모두 포함됩니다.

초기화하면 현재 채팅의 배경도 지워지고, Theme Library에서 적용해 둔 사용자 지정 테마도 꺼집니다. 스타일이 뒤죽박죽이 되어 처음부터 다시 잡고 싶을 때 쓰세요.

## 이 기기에만 저장되는 설정

Appearance 설정 대부분은 다른 기기와 동기화됩니다. 예외는 두 가지, **Display Size**와 **Chat Font Size**입니다. 이 둘은 지금 쓰는 브라우저에 저장되며 동기화되지 않습니다.

어떤 설정이 기기 간에 동기화되고 어떤 설정이 기기에만 남는지는 [설정 개요](../settings/settings-overview.md)에서 전체를 확인할 수 있습니다.

## 관련 가이드

- [사용자 지정 폰트와 Google Fonts](fonts.md)
- [채팅 배경](chat-backgrounds.md)
- [사용자 지정 CSS 테마(Theme Library)](custom-css-themes.md)
- [카드 CSS 테마 가이드](card-css-theming.md)
- [설정 개요](../settings/settings-overview.md)
