# 게임 에셋: 음악, 소리, 스프라이트, 배경

게임 에셋은 Game Mode(게임 모드)가 재생하고 화면에 보여 주는 미디어 파일로, 음악, 소리, 캐릭터 그림, 장면 배경이 여기에 속합니다. 이 가이드에서는 시작용 모음을 쓰는 방법, **Asset Browser**(에셋 브라우저)에서 직접 만든 파일을 업로드하는 방법, 게임이 쓸 수 있는 에셋을 제한하는 방법, 효과음과 음악을 생성하는 방법을 설명합니다.

Game Mode는 이 라이브러리를 스스로 읽습니다. 장면에 맞춰 음악, 환경음, 배경을 고르므로 플레이 도중 에셋을 직접 지정하지 않습니다.

| 카테고리 | 설명 |
| --- | --- |
| **Music**(음악) | 장면에 따라 바뀌는 배경 음악입니다. |
| **Ambient**(앰비언트) | 자연, 도시, 실내 소리처럼 계속 반복되는 환경음입니다. |
| **Sound Effects**(효과음, SFX) | 메뉴, 전투, 탐험에 쓰는 짧은 소리입니다. |
| **Sprites**(스프라이트) | 화면에 표시되는 캐릭터와 사물 그림입니다. |
| **Backgrounds**(배경) | 이야기 뒤에 표시되는 장면 이미지입니다. |

## 기본 제공되는 시작용 모음

Marinara는 서버를 처음 시작할 때 무료 시작용 라이브러리를 설치하고, 이후 시작할 때 기본 모음이 바뀌었으면 라이브러리를 새로 고칩니다. 시작용 모음에는 다음이 들어 있습니다.

- 서로 다른 장면 분위기에 쓰는 **Music** 트랙 5개.
- `nature`, `urban`, `interior` 폴더로 나뉜 **Ambient** 반복 음원.
- 메뉴, 전투, 탐험용 **Sound Effects**.

Asset Browser의 **Backgrounds**와 **Sprites** 폴더는 비어 있는 상태로 시작합니다. 캐릭터 스프라이트는 기본 제공되지 않으므로 직접 만드는 게임에 어울리는 그림을 추가하세요. 배경의 경우 Game Mode는 앱 자체의 배경 라이브러리도 사용합니다. 새로 설치하면 이 라이브러리에 시작용 이미지 13개와 단색 `Black.jpg`가 들어 있으며, 게임은 업로드 없이도 이 이미지를 쓸 수 있습니다. 그 폴더에 이미 이미지가 있었다면 `Black.jpg`만 복원됩니다. 생성된 장면 그림과 직접 업로드한 파일이 여기에 더해집니다.

기본 제공 오디오는 모두 CC0 라이선스(퍼블릭 도메인, 자유롭게 사용 가능)입니다. 파일별 출처는 에셋과 함께 디스크에 들어 있는 `CREDITS.md` 파일에 있습니다. 앱 안에서는 표시되지 않습니다.

기본 제공 파일과 폴더는 보호됩니다. **Asset Browser**에서 삭제하거나 옮길 수는 없지만, 이름을 바꾸거나 복사할 수는 있습니다.

## Asset Browser 열기

**Asset Browser**는 게임 에셋용 파일 관리 도구입니다. **Settings**(설정)에서 여는 방법은 다음과 같습니다.

1. **Settings**를 여세요.
2. **Imports**(가져오기) 탭으로 이동하세요.
3. **Game Assets**(게임 에셋)를 찾아 **Asset Browser**를 클릭하세요.

게임에서 열 수도 있습니다.

1. Game Mode 채팅을 여세요.
2. 채팅 오른쪽 위 근처의 **Game Assets** 버튼(폴더 아이콘)을 클릭하거나 탭하세요. 컴퓨터와 휴대폰 모두에서 이 버튼을 다른 곳으로 끌어 옮길 수 있습니다.

이 버튼은 Game Mode 채팅에만 나타납니다. 버튼은 **Asset Browser**가 들어 있는 **Game Assets**를 엽니다. 컴퓨터에서는 이동할 수 있는 창으로, 휴대폰에서는 화면 너비의 패널로 열립니다. **Put back in Chat Settings**(채팅 설정으로 되돌리기)로 버튼을 옮겼다면 대신 Chat Settings의 **Game Assets** 섹션을 여세요.

툴바에는 **Game Assets**에서 시작하는 경로 표시, **Grid view**(격자 보기)와 **List view**(목록 보기) 전환, **Upload**(업로드), **New**(새로 만들기), **Rescan**(다시 스캔), **Open in system folder**(시스템 폴더에서 열기), **Search in folder** 입력란이 있습니다. 화면이 넓으면 왼쪽 폴더 트리로 카테고리 사이를 바로 오갈 수 있습니다.

## 직접 만든 에셋 업로드하기

Marinara는 모든 업로드를 [파일 형식과 크기](#file-types-and-sizes)의 규칙으로 검사합니다. 두 방법 중 어느 쪽을 써도 됩니다.

### Asset Browser에서 업로드하기

1. **Asset Browser**를 여세요.
2. 다섯 카테고리 폴더 중 하나, 또는 그 안의 하위 폴더를 여세요.
3. **Upload**를 클릭해 파일을 고르거나, 파일 영역으로 파일을 끌어다 놓으세요.

카테고리 폴더 안에 있어야 합니다. 최상위에 파일을 놓으면 앱이 먼저 카테고리 폴더를 열라고 안내합니다.

### Settings에서 업로드하기

1. **Settings**를 열고 **Imports** 탭으로 이동하세요.
2. **Game Assets**의 **Type**(타입)에서 카테고리를 고르세요. **Music**, **Ambient**, **Sound Effects**, **Sprites**, **Backgrounds** 중 하나입니다.
3. **Folder**(폴더)에서 저장 위치를 지정하거나 기본값을 그대로 두세요.
4. **Choose Files**(파일 선택)를 클릭하고 파일을 고르세요.
5. **Upload to Server**(서버 업로드)를 클릭하세요.

업로드되지 않았다면 오류 메시지에 그 카테고리에서 허용하는 파일 형식이 표시됩니다. 음악이라면 폴더 경로를 확인하세요([음악 폴더 규칙](#the-music-folder-rule) 참고).

**Folder**의 기본값은 다음과 같습니다.

| 타입 | 기본 폴더 |
| --- | --- |
| **Music** | `exploration/fantasy/calm` |
| **Ambient** | `nature` |
| **Sound Effects** | `exploration` |
| **Sprites** | `generic-fantasy` |
| **Backgrounds** | `custom` |

<a id="file-types-and-sizes"></a>

### 파일 형식과 크기

| 카테고리 | 허용 파일 형식 |
| --- | --- |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM |
| Sprites | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds | PNG, JPG, JPEG, GIF, WebP, AVIF |

오디오와 이미지 파일은 각각 50 MB까지, 텍스트 파일은 10 MB까지 올릴 수 있습니다.

<a id="the-music-folder-rule"></a>

### 음악 폴더 규칙

모든 음악 트랙은 `state/genre/intensity` 형태의 3단계 경로에 있어야 합니다. 예를 들면 `exploration/fantasy/calm`입니다. 경로가 맞지 않으면 업로드가 실패합니다. Game Mode는 이 구조를 보고 각 트랙을 언제 재생할지 판단합니다.

- State: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`, 또는 `wuxia` 같은 세계관의 계열(아래 참고).
- Intensity: `calm`, `tense`, `intense`.

앰비언트, 효과음, 스프라이트, 배경 폴더에는 이런 규칙이 없습니다. 하위 폴더 이름은 자유롭게 지으세요.

## 에셋 정리하기

컴퓨터에서 파일이나 폴더를 오른쪽 클릭하거나 "..." 메뉴를 열면 사용할 수 있는 작업이 나옵니다.

| 파일 작업 | 하는 일 |
| --- | --- |
| **Rename**(이름 바꾸기) | 그 폴더에 이미 같은 이름이 있으면 실패합니다. |
| **Move**(이동), **Copy**(복사) | 폴더 선택기로 파일을 다른 폴더에 보냅니다. |
| **Delete**(삭제), **Download**(다운로드) | 파일을 삭제하거나 기기에 저장합니다. |

| 폴더 작업 | 하는 일 |
| --- | --- |
| **Create subfolder**(하위 폴더 만들기) | 그 안에 새 폴더를 만듭니다. |
| **Open in system folder** | 컴퓨터의 파일 관리자에서 그 폴더를 보여 줍니다. |
| **Delete folder**(폴더 삭제) | 안에 파일이 있으면 먼저 **Delete everything inside**(내부 항목 모두 삭제)를 체크하세요. |

툴바의 **New**는 현재 폴더에 **New folder**(새 폴더), **New text file**(새 텍스트 파일), **New markdown file**(새 Markdown 파일)을 만듭니다. 여러 파일을 한 번에 처리하려면 각 파일의 체크박스를 선택하세요. 선택한 개수를 보여 주는 막대에 **Select all**(모두 선택), **Move**, **Copy**, **Delete**가 나타납니다. 항목이 많은 폴더는 **Load more**(더 불러오기) 버튼으로 나눠서 불러옵니다.

폴더마다 짧은 메모를 달 수 있습니다. 설명 문구나 **Add description...** 안내를 클릭해 작성하세요. 다섯 카테고리 폴더의 설명은 고정되어 있습니다.

### 앱 밖에서 바꾼 뒤 다시 스캔하기

Marinara는 Game Mode가 에셋을 빠르게 찾을 수 있도록 내부 에셋 목록을 관리합니다. 앱으로 업로드하면 이 목록이 자동으로 갱신됩니다. 앱을 거치지 않고 컴퓨터의 게임 에셋 폴더에 파일을 복사했다면 **Rescan**을 클릭해 폴더를 다시 읽으세요. **Rescan**은 **Asset Browser** 툴바와 **Settings**의 **Game Assets**에 있습니다.

### 컴퓨터에서 폴더 열기

**Open in system folder**는 서버를 실행하는 컴퓨터에서 앱을 쓸 때만 작동합니다. 휴대폰, 태블릿, 다른 컴퓨터에서는 Marinara를 호스팅하는 기기에서만 시스템 폴더를 열 수 있다고 앱이 알려 줍니다.

## 게임이 쓸 수 있는 에셋 고르기

Game Mode 채팅이 에셋 폴더 중 일부만 쓰게 할 수 있습니다. 예를 들어 호러 게임에서 밝은 음악을 빼고 싶을 때 씁니다.

1. 설정 중에는 **Features** 단계에서 **Adjust Game Assets for this Game**(이 게임의 게임 에셋 조정)을 펼치세요. 이미 만든 게임이라면 그 게임의 **Game Assets** 창을 여세요.
2. **Game assets**를 클릭하세요. 표시가 **Selecting**(선택 중)으로 바뀝니다.
3. 각 폴더에 있는 작은 상태 컨트롤로 그 폴더를 포함하거나 제외하세요.

막대에는 "All folders included"(모든 폴더 포함됨) 또는 제외된 폴더 수가 표시됩니다. **Reset to all**(전체로 초기화)은 모든 폴더를 다시 포함합니다. 이 선택은 그 채팅에만 저장됩니다. Game Mode가 고를 수 있는 폴더만 바뀔 뿐, 파일을 삭제하거나 숨기지는 않습니다.

<a id="a-settings-own-art-and-music"></a>

### 세계관 고유의 아트와 음악

세계관 키트로 시작한 게임에는 아트 계열이 있습니다. 아트 계열은 키트의 용어를 바꿀 때 **Art and music**(아트와 음악) 아래에 표시되며, `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` 중 하나이거나 키트가 직접 정한 계열입니다. 게임은 자기 계열 이름이 붙은 폴더와 어떤 계열 이름도 붙지 않은 모든 폴더를 사용하고, 다른 계열의 폴더는 제외합니다. 그래서 사이버펑크 게임에서 판타지 전투 음악이 나오거나 마법의 숲이 보이는 일은 없습니다. 자기 계열이나 공유 폴더에 맞는 것이 없으면 다른 계열의 트랙을 트는 대신 아무것도 재생하지 않습니다. 세계관 키트가 없는 게임은 모든 폴더를 사용합니다.

- **Music**: 세계관의 트랙은 `music/<state>/<family>/<intensity>`에 넣으세요. 예를 들면 `combat/wuxia/intense`입니다. 이 트랙은 공유 트랙보다 먼저 재생됩니다.
- **Backgrounds**: `backgrounds/<family>`. 세계관 키트가 있는 게임에서 생성한 배경도 이곳에 저장됩니다.
- **Combat sounds**(전투 효과음): `sword-swing`처럼 기본 제공 효과음과 이름이 같은 소리를 `sfx/combat/<family>`에 넣으면 그 계열의 게임에서 기본 소리를 대신합니다. 기본 제공 전투 효과음은 판타지용이므로, 다른 계열의 전투는 그 계열의 소리를 추가하기 전까지 조용합니다.

기본 제공 시작용 배경은 공유 배경으로 취급됩니다. 단, 판타지 배경(`ancient_library`, `castle_cliff`, `enchanted_forest`)과 현대 배경 `city_night`는 예외입니다. 아트 계열이 생기기 전에 저장한 세계관 키트도 계속 작동합니다. 시작용 키트로 만든 키트는 그 시작용 키트의 계열을 쓰고, 그 밖의 키트는 **Art and music**에서 계열을 고르기 전까지 모든 폴더를 사용합니다. 위에서 설명한 선택 막대에는 열려 있는 게임의 계열이 표시됩니다.

<a id="generated-sound-effects-and-music"></a>

## 효과음과 음악 생성

Game Mode는 **Music & Sound Effects**(음악 및 효과음) 계정으로 효과음과 음악을 생성할 수 있습니다. ElevenLabs, SunoAPI, 또는 사용자 지정 호환 서버를 고르세요. 새 소리나 트랙을 만들 때마다 그 서비스 계정을 사용합니다. 기본 제공 오디오는 생성 없이도 계속 쓸 수 있습니다.

**시작하기 전에:** **Music & Sound Effects** 계정이 필요합니다. **Add account**(계정 추가) 창에는 이 계정용 타일이 없습니다. 이런 계정은 업그레이드나 가져오기로 생기며, 가져오기는 **Connections**(연결)의 **Import a backup**(백업 가져오기)으로 합니다. [제공자 설정과 제한](../connections/providers-reference.md#music--sound-effects)을 참고하세요.

1. **Connections**에서 **Edit model**(모델 편집)로 계정의 모델을 여세요.
2. 서비스를 고르고 키를 입력한 다음 음악 모델과 효과음 모델을 선택하세요. SunoAPI 음악에는 공개 HTTPS 콜백 URL도 필요합니다. 사용자 지정 서버에는 엔드포인트 경로가 필요합니다.
3. **Sound-effect generation**(효과음 생성), **Music generation**(음악 생성), 또는 둘 다 켜세요.
4. 계정을 저장하세요. [제공자 설정과 제한](../connections/providers-reference.md#music--sound-effects)을 참고하세요.

그다음 게임을 만들 때 켜세요.

1. 설정 마법사의 **Features** 단계에서 **Game Audio**(게임 오디오) 카드를 찾으세요.
2. 계정 선택에서 내 계정을 고르거나 **Use the default Music & Sound Effects account**(기본 음악 및 효과음 연결 사용)를 그대로 두세요.
3. **Sound effects**(효과음)와 **Music**을 켠 채로 두거나, 원하지 않는 쪽을 끄세요.

각 스위치를 쓰려면 선택한 계정에서 해당 기능이 켜져 있어야 합니다. 음성 전용 Audio 계정은 생성에 쓰이지 않습니다.

플레이 중에는 다음과 같이 작동합니다.

- **Sound effects.** GM 턴이 끝나면 Marinara가 서비스에 장면에 어울리는 짧은 소리를 요청합니다.
- **Music.** Marinara는 파티가 방문하는 장소마다, 그리고 보스 전투 같은 전투 종류마다 2분 정도 길이의 연주곡을 하나씩 작곡합니다. 각 트랙은 한 번만 만들고 이후에는 다시 씁니다. 새 장소의 트랙은 다음 장면 전환 때 시작되므로 장면 도중에 음악이 갑자기 끼어들지 않습니다. 전투 트랙은 준비되자마자 서서히 커지며 재생됩니다.

생성된 소리와 트랙은 게임 에셋과 함께 저장되므로 같은 소리를 두 번 만들지 않습니다. **Music DJ**가 게임에서 음악을 재생하면 Game Mode는 음악을 생성하지 않습니다.

## Music DJ용 사용자 지정 음악 폴더

**Music DJ**는 게임 중에 음악을 틀 수 있는 보조 에이전트입니다. Custom 모드에서는 직접 고른 폴더의 트랙을 재생합니다. 채팅에서 **Music DJ**를 활성화하면 설정에 **Apply to**(적용 대상)가 표시됩니다. 여기서 폴더를 이 채팅, 채팅에 하나뿐인 캐릭터, 모든 채팅 중 어디에 저장할지 정합니다. **In use:**(사용 중)에는 채팅에서 재생하는 폴더가 표시됩니다. **All chats (default)**(모든 채팅, 기본값)에서는 **Game Assets** 소스에 `music`이나 `music/combat`처럼 게임 에셋 안의 경로를 지정합니다. 채팅이나 캐릭터에 따로 폴더를 지정하려면 [채팅이나 캐릭터마다 다른 폴더 쓰기](../media/music.md#use-a-different-folder-for-a-chat-or-character)를 참고하세요.

**Music DJ** 전체 편집기에는 **Custom Music Library**(사용자 지정 음악 라이브러리) 섹션이 있습니다. **Use Game Assets music folder**(게임 에셋 음악 폴더 사용)로 두 방식 중 하나를 고릅니다.

- 켜짐: **Game Assets music folder**(게임 에셋 음악 폴더) 입력란이 게임 에셋 안의 폴더를 읽습니다. **Open Folder**(폴더 열기)는 서버 컴퓨터에서 그 폴더를 엽니다.
- 꺼짐: **Default music folder on this device**(이 기기의 기본 음악 폴더)는 서버를 실행하는 컴퓨터의 어느 폴더에서든 음악을 재생합니다. **Select Folder**(폴더 선택)를 클릭하거나 경로를 붙여넣으세요.

앱 밖의 폴더를 고르려면 관리자 권한이 필요합니다. 서버와 같은 컴퓨터에서는 추가 설정 없이 바로 됩니다. 다른 기기에서나 원격 접근으로 쓸 때는 먼저 관리자 접근을 설정하세요. [원격 접근](../REMOTE_ACCESS.md)을 참고하세요. 음악 플레이어의 나머지 내용은 [Music DJ](../media/music.md)를 참고하세요.

## 관련 가이드

- [Music DJ: Spotify, YouTube, 로컬 음악](../media/music.md)
- [지원하는 AI 제공자](../connections/providers-reference.md)
- [Game Mode: 시작하기](getting-started.md)
- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)
