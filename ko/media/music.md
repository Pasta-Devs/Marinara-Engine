# Music DJ: Spotify, YouTube, 로컬 음악

이 가이드에서는 **Music DJ**로 Marinara Engine에서 배경 음악을 재생하는 방법을 설명합니다. Spotify, YouTube, 직접 준비한 로컬 음악 파일을 연결하는 방법을 알 수 있습니다. 음악 플레이어, **DJ Mari** 플레이리스트 제작 기능, Game Mode 음악이 어떻게 동작하는지도 함께 다룹니다.

## Music DJ란

**Music DJ**는 원할 때 다운로드해 쓰는 에이전트입니다. 에이전트는 채팅 뒤에서 자동으로 실행되는 작은 AI 기능입니다. 설정하기 전에 **Agents**(에이전트)를 열고 **Download Agents**(에이전트 다운로드)를 선택해 **Music DJ**를 설치하세요. Music DJ는 답변이 나올 때마다 장면의 분위기를 읽고 어울리는 배경 음악을 재생할 수 있습니다.

**Music DJ**는 세 가지 소스에서 음악을 재생할 수 있습니다.

- **Spotify**: 실제로 쓰는 Spotify 계정과 기기에서 재생을 제어합니다.
- **YouTube**: YouTube를 검색해 그 결과를 앱 안의 작은 플레이어로 재생합니다. 로그인은 필요 없습니다.
- **Custom**: Marinara를 실행하는 컴퓨터의 폴더에서 직접 준비한 오디오 파일을 재생합니다.

지금 동작 중인 소스는 앱 상단 바에 작은 **Music Player**(음악 플레이어) 배지로 고정 표시됩니다. 휴대폰이나 좁은 창에서는 끌어서 옮길 수 있는 작은 원형 위젯으로 바뀝니다.

**Music DJ**는 설치 직후에는 꺼져 있습니다. 다른 에이전트와 마찬가지로 채팅마다 켜서 씁니다. **Roleplay**(롤플레이) 채팅에서 쓸 수 있고, **Game** 모드에서는 별도 토글로 켭니다(아래 Game Mode의 Music DJ 참고). **Conversation**(대화) 모드에서는 대신 **Music**(음악) 명령어를 씁니다(아래 Conversation 모드의 Music 명령어 참고).

**Music DJ** 설정은 한곳에서 공유합니다. 오른쪽 **Agents** 패널을 열고 **Music DJ**를 여세요. 미니 플레이어의 톱니바퀴 아이콘을 클릭해도 됩니다. 툴팁에는 **Music DJ setup**이라고 표시됩니다.

### 음악 소스 고르기

**Music DJ** 편집기의 **Music Player** 항목에는 **Spotify**, **YouTube**, **Custom** 세 개의 버튼이 있습니다. 도움말에는 "Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface."라고 적혀 있습니다.

버튼 아래에는 지금 어떤 소스가 동작 중인지 알려 주는 줄이 있습니다. 예를 들면 "Visible player: Spotify. Saved provider: Spotify."처럼 표시됩니다. 이 소스 선택은 앱 전체에서 공유되며 채팅별로 저장되지 않습니다.

고르는 기준은 다음과 같습니다.

| 소스 | 필요한 계정 | 비용 | 어울리는 경우 |
|---|---|---|---|
| **Spotify** | 본인 Spotify 계정, 재생하려면 Spotify Premium | 설정은 무료, 재생은 Premium 필요 | 실제 곡을 이름 그대로 내 기기에서 재생 |
| **YouTube** | 무료 Google API 키 | 무료 | 로그인도 Premium도 없이 재생 |
| **Custom** | 없음 | 무료 | 직접 가진 로컬 오디오 파일 재생 |

## Spotify 설정

Spotify는 무료로 만드는 Spotify 개발자 앱을 사용합니다. 붙여넣을 값은 **Spotify Client ID**(Spotify 클라이언트 ID) 하나뿐이고, 클라이언트 시크릿은 입력하지 않습니다.

**Music DJ** 편집기를 열고 **Spotify Connection**(Spotify 연결) 항목을 찾으세요. 그다음 아래 단계를 따르세요.

1. 앱에 표시된 링크로 **Spotify Developer Dashboard**를 여세요.
2. 새 앱을 만들고 "Web API"를 선택하세요.
3. 그 앱의 Redirect URIs에, 앱 안내 상자의 3단계에서 Marinara가 알려 주는 리디렉션 주소를 그대로 추가하세요. 리디렉션 주소는 로그인을 마친 뒤 Spotify가 되돌려 보내는 웹 주소입니다.
4. Spotify 앱에서 **Client ID**(클라이언트 ID)를 복사해 **Spotify Client ID** 입력란에 붙여넣으세요.
5. 에이전트를 저장한 다음 **Connect Spotify Account**(Spotify 계정 연결)를 클릭하세요.

Spotify 로그인과 권한 허용 창이 열립니다. 승인하면 창에 "Spotify Connected!" 페이지가 잠깐 표시되고 닫힙니다. Marinara 화면으로 돌아오면 초록색 **Connected to Spotify** 배지가 보입니다. **Disconnect**(연결 해제) 버튼을 누르면 저장된 연결이 지워집니다.

앱에는 이런 안내가 있습니다. "Requires Spotify Premium. Tokens refresh automatically, no need to reconnect." 무료 Spotify 계정으로도 연결은 되지만 재생, 일시 정지, 건너뛰기, 볼륨 조절에는 Spotify Premium이 필요합니다. Premium은 Spotify의 유료 요금제입니다.

### Spotify 기기 참고 사항

Spotify는 휴대폰, 데스크톱 Spotify 앱, 앱 안의 플레이어 같은 기기를 통해 재생합니다.

데스크톱에서는 브라우저 탭 자체를 Spotify 기기로 만들 수 있습니다. 미니 플레이어의 노트북 아이콘을 클릭하세요. 툴팁에는 **Enable Marinara player**(Marinara 플레이어 활성화) 또는 **Use Marinara player**라고 표시됩니다. 이렇게 하면 "Marinara Engine"이라는 이름의 Spotify 기기가 등록되어 음악이 탭으로 재생됩니다. 앱 안에서 재생할 때도 Spotify Premium이 필요합니다.

모바일에서는 플레이어가 휴대폰 자체의 Spotify 기기를 우선합니다. 그래서 재생을 누르면 뒤에 있는 브라우저 탭이 아니라 휴대폰에서 음악이 나옵니다.

Spotify 기기가 원격 볼륨 조절을 허용하지 않으면 볼륨 슬라이더 대신 **Use device volume**(기기 음량 사용) 버튼이 나타납니다. 이때는 기기의 볼륨 버튼을 쓰세요.

### 다른 컴퓨터에서 쓰는 Spotify

Spotify는 보안 연결인 `https://` 리디렉션 주소나 루프백 주소 `http://127.0.0.1`만 받아들입니다. 루프백은 같은 컴퓨터를 뜻합니다. Marinara를 다른 컴퓨터에서 일반 `http`로 실행하면 로그인 창이 열리지 않을 수 있습니다.

이럴 때 쓸 수 있는 방법이 두 가지 있습니다.

- 연결하는 동안 **Connect Spotify Account** 버튼 아래의 "Browser couldn't reach the callback?" 부분을 펼치세요. 실패한 창의 주소 전체를 복사해 상자에 붙여넣고 **Complete connection**을 클릭하세요.
- 또는 서버의 환경 변수로 리디렉션 주소를 고정하세요. 환경 변수는 서버가 시작할 때 읽는 설정입니다.

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

환경 변수를 설정하는 방법은 [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

## YouTube 설정

YouTube 모드에는 무료 YouTube Data API 키가 필요합니다. API 키는 Marinara가 대신 서비스를 이용할 수 있게 해 주는 비밀 문자열입니다. YouTube 계정 로그인이나 Premium은 필요 없습니다.

**Music DJ** 편집기를 열고 **YouTube Connection**(YouTube 연결) 항목을 찾으세요. 그다음 아래 단계를 따르세요.

1. 앱에 표시된 링크로 **Google Cloud Console**을 열고 프로젝트를 새로 만들거나 기존 프로젝트를 고르세요.
2. **YouTube Data API v3**를 활성화하세요.
3. Credentials로 이동한 다음 Create credentials, API key 순서로 선택하세요.
4. 키를 **YouTube Data API Key**(YouTube Data API 키) 입력란에 붙여넣으세요.
5. **Save Key**(키 저장)를 클릭하세요. 저장되면 버튼이 **Update Key**(키 업데이트)로 바뀌고 초록색 "API key configured" 배지가 나타납니다. **Remove**(제거) 링크를 누르면 키가 삭제됩니다.

키에는 제한을 걸지 않거나, API 기준으로만 제한하고 YouTube Data API v3를 선택하세요. HTTP 리퍼러 기준으로는 제한하지 마세요. 검색은 서버에서 실행되기 때문에 리퍼러 제한을 걸면 막힙니다.

앱에는 이런 안내가 있습니다. "The free quota (~100 searches/day) is plenty for a personal DJ." 쿼터는 하루 사용 한도를 뜻합니다. 이 수치는 앱 자체 문구에서 가져온 것이라 시간이 지나면 달라질 수 있습니다. 키는 서버에 남고, Marinara Engine이 암호화해서 저장합니다.

## Custom(로컬) 음악

Custom 모드는 Marinara 서버가 실행되는 컴퓨터의 오디오 파일을 재생합니다. 지원하는 파일 형식은 `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac`, `.webm`입니다.

**Music DJ** 편집기를 열고 **Custom Music Library**(사용자 지정 음악 라이브러리) 항목을 찾으세요. 여기에는 스위치가 하나 있습니다. **Use Game Assets music folder**(게임 에셋 음악 폴더 사용)입니다.

- 스위치 켜기: Custom 모드가 Game Assets에 업로드한 오디오를 읽습니다. Game Assets는 Game Mode(게임 모드)를 위해 Marinara에 기본으로 들어 있는 에셋 라이브러리입니다. **Game Assets music folder**(게임 에셋 음악 폴더) 입력란에서 폴더를 고르세요. 음악 라이브러리 전체를 쓰려면 `music`을, 하위 폴더를 쓰려면 `music/combat`처럼 입력하세요. **Open Folder**(폴더 열기) 버튼을 누르면 서버 컴퓨터에서 그 폴더가 열립니다.
- 스위치 끄기: Custom 모드가 서버 기기의 폴더를 읽습니다. **Select Folder**(폴더 선택)를 눌러 서버 컴퓨터의 폴더 선택 창을 열거나, **Music folder on this device**(이 기기의 음악 폴더) 입력란에 경로를 붙여넣으세요.

Roleplay와 Game 채팅 설정에는 같은 소스가 선택된 상태로 표시됩니다. 서버 기기의 폴더를 골랐다면, 채팅의 Music DJ 설정에는 Game Assets 경로를 묻는 대신 저장된 경로와 **Choose Folder** 버튼이 표시됩니다.

Game Assets 밖의 폴더에서 재생하려면 서버에 로컬 접근 권한이 필요합니다. 비밀번호나 관리자 시크릿 없이 다른 기기에서 Marinara를 쓰면 이 기능만 막힐 수 있습니다. [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)을 참고하세요.

## 음악 플레이어 사용하기

**Music Player**는 데스크톱에서는 상단 바의 작은 배지로, 모바일에서는 끌어서 옮길 수 있는 떠 있는 위젯으로 나타납니다. 설정에서 숨기거나 표시할 수 있습니다.

**Settings**(설정)를 열고 **General**(일반) 탭에서 **App Behavior**(앱 동작) 섹션을 찾으세요. **Music Player** 토글을 켜거나 끄면 됩니다. 도움말에는 "Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings."라고 적혀 있습니다. 이 토글은 항상 쓸 수 있고 기본값은 켜짐입니다. Music DJ를 설치하지 않은 상태에서 켜면 데스크톱과 모바일 플레이어 자리에 **Download Music DJ Agent to configure**라는 문구와 **Download Agents** 버튼이 표시됩니다.

새로 만든 프로필에서는 표시되는 소스가 **YouTube**로 시작합니다. 소스는 세 가지 방법으로 바꿀 수 있습니다.

- 플레이어의 작은 원형 소스 전환 버튼을 쓰세요. 툴팁에는 "Switch to ... player"라고 표시됩니다.
- **Music DJ** 편집기의 **Music Player** 버튼을 쓰세요.
- 채팅의 **Music DJ** 설정을 쓰세요.

플레이어에는 현재 트랙의 커버 이미지나 썸네일, 제목, 아티스트나 채널 이름이 표시됩니다. 조작 버튼은 소스에 따라 다릅니다.

- Spotify: 셔플, **Previous**(이전), 재생 및 일시 정지, **Next**(다음), 반복, 음소거가 있는 볼륨 슬라이더, **DJ** 버튼, 노트북 모양의 **Marinara player** 버튼, **Music DJ setup** 톱니바퀴.
- YouTube: 재생 및 일시 정지, 작은 16:9 영상 패널을 여는 펼침 화살표, **Stop**(중지) 버튼, 음소거가 있는 볼륨 슬라이더.
- Custom: 로컬 파일을 재생하는 재생 및 일시 정지와 볼륨.

Spotify가 아직 연결되지 않았다면 플레이어에 "Spotify not connected"라고 표시되고, 이를 누르면 **Music DJ setup**이 열립니다.

### 채팅별 Spotify 소스

**Music DJ**가 **Roleplay** 채팅에서 동작할 때는 설정 카드에 **Spotify source**(Spotify 소스) 드롭다운이 나타나고 선택지는 네 가지입니다.

- **Liked Songs**: 저장해 둔 트랙에서 먼저 고릅니다.
- **Playlist**: Spotify 플레이리스트 하나 안에서만 고릅니다. **Playlist** 드롭다운에 플레이리스트 목록이 나옵니다.
- **Artist**: 지정한 아티스트 위주로만 검색합니다. **Artist** 입력란이 나타납니다.
- **Any Spotify**: 어울리는 상황에서 DJ가 Spotify 검색을 쓰도록 합니다.

## DJ Mari: AI 플레이리스트 제작

Spotify 미니 플레이어의 **DJ** 버튼을 누르면 테마에 맞는 플레이리스트를 만들어 줍니다. 툴팁에는 "DJ Mari composes a playlist for you!"라고 표시됩니다.

**DJ Mari**는 연결된 AI 모델에 요청해 페르소나, 가장 많이 쓴 캐릭터, 모든 채팅의 최근 내용을 바탕으로 플레이리스트를 만듭니다. 그다음 찾아낸 곡을 "DJ Mari"와 오늘 날짜를 붙인 이름의 새 Spotify 플레이리스트에 담고 재생을 시작합니다.

**DJ Mari**에는 두 가지가 필요합니다.

- **Music DJ** 에이전트에 지정한 모델 연결. 지정하지 않으면 "Configure a model connection on the Music DJ agent before using DJ Mari."라는 문구가 나타납니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.
- 조건에 맞는 Spotify 곡이 충분해야 합니다. 최소 25곡이 필요하고 최대 50곡까지 고릅니다. 25곡을 채우지 못하면 Liked Songs를 더 추가한 뒤 다시 시도하라고 안내합니다.

성공하면 "DJ Mari playlist is ready" 메시지와 **Open playlist**(플레이리스트 열기) 버튼이 나타납니다.

## Game Mode의 Music DJ

Game Mode에는 Game Assets에서 가져오는 자체 배경 음악이 있습니다. 대신 **Music DJ**를 쓰려면 Game 설정에서 **Music DJ** 토글을 켜세요. 설명에는 "Use the Music DJ for this game instead of local music assets."라고 적혀 있습니다. 이 토글의 기본값은 꺼짐입니다.

토글을 켜면 Roleplay와 똑같이 **Spotify**, **YouTube**, **Custom** 중에서 고를 수 있고 소스별 항목도 동일합니다.

Game Mode에서는 Spotify가 조금 다르게 동작합니다. 장면이 끝날 때마다 서버가 고른 소스에서 실제 후보 곡의 짧은 목록을 만듭니다. AI는 그 목록에서 한 곡을 고릅니다. 이렇게 하면 AI가 존재하지 않는 곡을 지어내지 않습니다. Game Mode는 한 번에 한 곡을 반복 재생합니다.

**Game controls**(게임 컨트롤)를 열고 **Retry Music DJ**(Music DJ 재시도)를 선택하면 현재 장면의 곡을 새로 고릅니다. 컴퓨터와 휴대폰에서 모두 쓸 수 있습니다. [게임 컨트롤](../game/getting-started.md#the-games-controls)을 참고하세요.

## Conversation 모드의 Music 명령어

**Conversation** 모드에서는 **Music DJ**를 에이전트로 추가할 수 없습니다. 대신 캐릭터가 **Music** 명령어로 곡을 재생할 수 있습니다.

채팅의 **Commands**(명령어) 섹션을 여세요. 먼저 상위 **Commands** 토글을 켠 다음 **Music** 토글을 켜세요. 설명에는 "Let characters play songs through the active Music Player."라고 적혀 있습니다.

이제 캐릭터가 Spotify용으로 곡 이름을 말하거나 YouTube용으로 트랙을 설명하면 Marinara가 현재 소스로 재생합니다. **Music DJ**를 어디에서도 활성화하지 않은 상태에서도 동작합니다. Spotify 연결이나 저장된 YouTube 키만 있으면 됩니다.

Spotify가 연결되지 않았거나 재생 권한이 없으면 Spotify 곡 명령어는 아무 동작도 하지 않고 오류도 표시하지 않습니다. 곡이 재생되지 않는다면 소스부터 설정하세요.

## 문제 해결

- 미니 플레이어가 보이지 않습니다. **Settings**의 **General** 탭, **App Behavior** 섹션에서 **Music Player**를 켜세요.
- Spotify에서 아무 소리도 나지 않습니다. 재생 제어에는 Spotify Premium과 동작 중인 Spotify 기기가 필요합니다. 기기에서 데스크톱 앱을 열거나, 데스크톱에서 **Enable Marinara player**를 클릭하세요.
- 다른 컴퓨터에서 Spotify 로그인 창이 열리지 않습니다. "Browser couldn't reach the callback?" 붙여넣기 상자를 쓰거나, 서버에 `SPOTIFY_REDIRECT_URI`를 설정하세요.
- YouTube 검색이 실패합니다. 프로젝트에서 **YouTube Data API v3**가 활성화되어 있는지, 키가 HTTP 리퍼러로 제한되어 있지 않은지 확인하세요. 하루 쿼터를 다 썼다면 다음 날 다시 시도하거나 다른 키를 쓰세요.
- 원격 접근 상태에서 기기 폴더의 Custom 음악이 재생되지 않습니다. 그 폴더를 쓰려면 서버의 로컬 접근 권한이 필요합니다. [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)을 참고하세요.
- Conversation 모드에서 캐릭터의 곡 명령어가 동작하지 않습니다. Spotify를 연결하거나 YouTube 키를 저장하고, **Commands**와 **Music** 토글이 켜져 있는지 확인하세요.

## 관련 가이드

- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
- [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [게임 에셋](../game/game-assets.md)
- [Conversation Mode: 시작하기](../conversation/getting-started.md)
