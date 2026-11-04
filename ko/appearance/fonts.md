# 사용자 지정 폰트와 Google Fonts

이 가이드에서는 Marinara가 앱 전체에서 쓰는 폰트를 바꾸는 방법을 설명합니다. 기본 내장 폰트를 고르거나, 폰트 파일을 직접 추가하거나, Google Fonts에서 이름으로 폰트를 다운로드할 수 있습니다.

## 앱 폰트 고르기

1. **Settings**(설정)를 열고 **Appearance**(모양) 탭을 클릭한 다음 **App**(앱) 버튼을 클릭하세요.
2. **Text & Scale**(텍스트 및 배율) 섹션을 찾으세요.
3. **Font**(폰트) 드롭다운을 열고 폰트를 고르세요.

새 폰트를 가장 쉽게 추가하는 방법은 [Google Fonts](#downloading-from-google-fonts)입니다. 기본값은 **Default (Inter)**이며, 화면에서 읽기 좋도록 고른 깔끔한 폰트입니다. 직접 추가한 폰트는 같은 드롭다운에서 그 아래에 나타납니다.

선택한 폰트는 기기 사이에 동기화됩니다. 같은 Marinara 서버에 연결된 모든 브라우저가 그 폰트로 바뀝니다. [설정 개요](../settings/settings-overview.md)를 참고하세요.

채팅 위젯에는 **Chat widget style**(채팅 위젯 스타일) 아래에 별도의 **Font** 선택이 있습니다. 그곳에서 **Apply preset font**(프리셋 폰트 적용)를 켜면 메시지, 입력란과 채팅 컨트롤에도 그 폰트를 사용합니다. [바로 쓸 수 있는 채팅 창 스타일](custom-css-themes.md#ready-made-chat-window-styles)을 참고하세요.

## 폰트 직접 추가하기

시작하기 전에: 폰트는 서버의 폴더에 넣습니다. 서버는 Marinara를 실행하는 컴퓨터입니다. Marinara를 내 컴퓨터에서 실행한다면 그 컴퓨터가 서버이고, 데이터 폴더는 Marinara가 데이터를 보관하는 곳입니다.

1. **Font** 드롭다운 옆의 **Open Fonts Folder**(폰트 폴더 열기)를 클릭하면 서버에서 `data/fonts/` 폴더가 열립니다. 또는 Marinara 데이터 폴더 안의 `data/fonts/` 폴더를 직접 찾으세요.
2. 폰트 파일을 그 폴더에 복사하세요.
3. **Settings → Appearance → App → Text & Scale**(설정 → 모양 → 앱 → 텍스트 및 배율)로 이동하세요.
4. **Font** 드롭다운을 여세요. 추가한 폰트가 목록에 있습니다.
5. 그 폰트를 선택하세요. 앱의 글자가 바로 바뀝니다.

Marinara는 `.ttf`, `.otf`, `.woff`, `.woff2` 파일을 읽고 다른 형식은 무시합니다. 표시 이름은 파일 이름으로 만들기 때문에 `OpenSans-Bold.ttf`는 "Open Sans"로 표시됩니다. 목록을 깔끔하게 유지하려면 파일 이름을 알아보기 쉽게 지으세요.

같은 서버에 연결하는 모든 기기가 `data/fonts/`의 폰트를 쓸 수 있습니다.

작동하지 않는 경우: 파일 형식을 확인하고, 파일이 지금 보고 있는 기기가 아니라 서버의 `data/fonts/`에 있는지 확인하세요.

<a id="downloading-from-google-fonts"></a>

## Google Fonts에서 다운로드하기

이 기능을 쓰려면 서버가 인터넷에 연결되어 있어야 합니다.

1. **Settings → Appearance → App → Text & Scale**로 이동하세요.
2. **Google Fonts** 입력란에 폰트 이름을 정확히 입력하세요. 예를 들면 `Fira Code`나 `Lora`입니다.
3. **Add**(추가)를 클릭하세요.
4. 다운로드가 끝날 때까지 기다리세요. 그러면 폰트가 **Font** 드롭다운에 나타납니다.

입력란 옆의 **Browse fonts at fonts.google.com →**(fonts.google.com에서 글꼴 찾아보기 →) 링크를 누르면 Google Fonts 사이트가 열리므로 거기서 이름을 찾아볼 수 있습니다. 이름에는 영문자, 숫자, 공백만 쓸 수 있습니다. 같은 폰트를 다시 다운로드하면 기존 사본을 교체합니다.

작동하지 않으면 오류 메시지를 읽어 보세요.

- Marinara가 Google Fonts에 접속하지 못하면 인터넷 연결을 확인하세요.
- 폰트를 찾을 수 없다는 메시지가 나오면 철자를 확인하고, Google Fonts 사이트에서 그 폰트에 Regular(400) 스타일이 있는지 확인하세요. Marinara는 그 굵기만 다운로드합니다.

## Open Fonts Folder

**Font** 드롭다운 옆의 **Open Fonts Folder** 버튼은 지금 쓰고 있는 기기가 아니라 서버 컴퓨터의 파일 탐색기에서 `data/fonts/` 폴더를 엽니다. Marinara를 내 컴퓨터에서 실행한다면 이 버튼이 폴더를 열어 줍니다. 휴대폰이나 다른 컴퓨터에서는 서버의 `data/fonts/` 폴더에 폰트 파일을 직접 복사하세요.

기본 폰트가 선택되어 있는 동안에는 프리셋 편집기의 프롬프트 입력란과 캐릭터의 Example Dialogue가 고정폭 폰트를 씁니다. 다른 폰트를 고르면 이 입력란에도 그 폰트가 적용됩니다. 에이전트의 프롬프트 템플릿 같은 다른 프롬프트 입력란은 계속 고정폭 폰트를 씁니다.

## 관련 가이드

- [모양 설정](appearance-settings.md)
