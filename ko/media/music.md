# Music DJ: Spotify, YouTube, 로컬 음악

**Music DJ**는 장면에 어울리는 배경 음악을 재생합니다. 이 가이드에서는 Spotify, YouTube 또는 직접 가진 오디오 파일을 연결하고, 음악 플레이어를 쓰고, Game Mode(게임 모드)와 Conversation(대화)에서 음악을 쓰는 방법을 설명합니다.

## Music DJ란

**Music DJ**는 선택해서 설치하는 다운로드 가능한 에이전트입니다. 에이전트는 채팅 뒤에서 실행되는 도우미입니다. 답변이 나올 때마다 장면의 분위기를 읽고 어울리는 음악을 재생할 수 있습니다.

시작하기 전에 **Agents**(에이전트)를 열고 **Agent Organizer**를 선택해 **Music DJ**를 설치하세요. 설치 직후에는 꺼져 있습니다. 다른 에이전트처럼 채팅마다 켜세요. Roleplay(롤플레이) 채팅에서 동작하고, Game Mode에서는 별도 토글로([Game Mode의 Music DJ](#music-dj-in-game-mode)), Conversation에서는 **Music**(음악) 명령어로([Conversation의 Music 명령어](#the-conversation-music-command)) 동작합니다.

세 가지 소스에서 재생합니다.

| 소스 | 필요한 계정 | 비용 | 어울리는 경우 |
| --- | --- | --- | --- |
| **Spotify** | 본인 Spotify 계정, 재생하려면 Spotify Premium | 설정은 무료, 재생은 Premium 필요 | 실제 곡을 이름 그대로 내 기기에서 재생 |
| **YouTube** | 무료 Google API 키 | 무료 | 로그인도 Premium도 없이 재생 |
| **Custom** | 없음 | 무료 | 직접 가진 오디오 파일 |

현재 소스는 상단 바에 고정된 작은 **Music Player**(음악 플레이어)로 표시됩니다. 휴대폰이나 좁은 창에서는 끌어서 옮길 수 있는 작은 원형 플로팅 위젯이 됩니다.

Music DJ 설정은 한곳에서 공유합니다. 오른쪽 **Agents** 패널을 열고 **Music DJ**를 여세요. 미니 플레이어의 톱니바퀴 아이콘(툴팁 **Music DJ setup**(Music DJ 설정))을 클릭해도 됩니다.

### 음악 소스 고르기

**Music DJ** 편집기의 **Music Player** 항목에는 **Spotify**, **YouTube**, **Custom** 버튼 3개가 있습니다. 그 아래 줄에는 현재 동작 중인 소스가 표시됩니다. 예를 들면 "Visible player: Spotify. Saved provider: Spotify."입니다. 이 선택은 채팅별로 저장되지 않고 앱 전체에서 공유됩니다. **Custom**이 재생하는 폴더는 채팅이나 캐릭터마다 다르게 정할 수 있습니다. [채팅이나 캐릭터마다 다른 폴더 쓰기](#use-a-different-folder-for-a-chat-or-character)를 참고하세요.

## Spotify 설정

Spotify는 무료로 만드는 본인의 Spotify 개발자 앱을 사용합니다. 붙여 넣는 값은 **Spotify Client ID**(Spotify 클라이언트 ID) 하나뿐입니다. 클라이언트 시크릿은 없습니다.

1. **Music DJ** 편집기에서 **Spotify Connection**(Spotify 연결)을 찾으세요.
2. 앱에 표시된 링크로 **Spotify Developer Dashboard**를 여세요.
3. 새 앱을 만들고 "Web API"를 선택하세요.
4. 그 앱의 Redirect URIs에 앱 안 설정 상자의 3단계에서 Marinara가 보여 주는 리디렉션 주소를 그대로 추가하세요. 리디렉션 주소는 로그인한 뒤 Spotify가 사용자를 보내는 주소입니다.
5. **Client ID**(클라이언트 ID)를 복사해 **Spotify Client ID**에 붙여 넣으세요.
6. 에이전트를 저장한 다음 **Connect Spotify Account**(Spotify 계정 연결)를 클릭하세요.

Spotify 로그인과 권한 허용 창이 열립니다. 승인하면 짧은 성공 페이지가 표시된 뒤 창이 닫힙니다. Marinara에 초록색 **Connected to Spotify**(Spotify 연결됨) 배지가 표시됩니다. **Disconnect**(연결 해제)는 저장된 연결을 지웁니다.

> **참고:** 재생, 일시 정지, 건너뛰기, 볼륨 조절에는 Spotify Premium(유료 요금제)이 필요합니다. 무료 계정으로도 연결은 됩니다. 토큰은 자동으로 갱신됩니다.

작동하지 않는 경우: 다른 컴퓨터에서는 로그인 창이 실패할 수 있습니다(아래 참고). 그렇지 않다면 리디렉션 주소가 정확히 일치하는지 확인하세요.

### Spotify 기기

Spotify는 휴대폰, 데스크톱 Spotify 앱, 앱 안의 플레이어 같은 기기를 통해 재생합니다.

- 데스크톱에서는 미니 플레이어의 노트북 아이콘을 클릭하세요. 아이콘에는 **Enable Marinara player**(Marinara 플레이어 활성화) 또는 **Use Marinara player**(Marinara 플레이어 사용)라고 표시됩니다. 그러면 브라우저 탭이 "Marinara Engine"이라는 이름의 Spotify 기기가 됩니다. 탭에서 스트리밍하려면 Premium이 필요합니다.
- 모바일에서는 플레이어가 휴대폰 자체의 Spotify 기기를 우선하므로, 백그라운드 탭이 아니라 휴대폰에서 재생됩니다.
- 기기가 원격 볼륨 조절을 허용하지 않으면 슬라이더 대신 **Use device volume**(기기 음량 사용)이 표시됩니다. 기기 자체의 볼륨 버튼을 쓰세요.

### 다른 컴퓨터에서 쓰는 Spotify

Spotify는 보안 `https://` 리디렉션 주소나 루프백 주소 `http://127.0.0.1`(같은 컴퓨터)만 받아들입니다. Marinara가 다른 컴퓨터에서 일반 `http`로 실행되면 로그인 창이 실패할 수 있습니다. 해결 방법은 두 가지입니다.

- 연결하는 동안 **Connect Spotify Account** 아래의 "Browser couldn't reach the callback?"을 펼치세요. 실패한 창의 주소 전체를 복사해 상자에 붙여 넣고 **Complete connection**(연결 완료)을 클릭하세요.
- 또는 고정 리디렉션 주소를 환경 변수(서버가 시작할 때 읽는 설정)로 지정하세요.

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

[서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

### Spotify가 곡을 고를 곳 정하기(Roleplay)

Roleplay 채팅에서 Music DJ가 실행되면 카드에 **Spotify source**(Spotify 소스) 목록이 생깁니다.

- **Liked Songs**: 저장해 둔 트랙에서 먼저 고릅니다.
- **Playlist**(플레이리스트): 플레이리스트 하나 안에서만 고릅니다. 플레이리스트는 **Playlist** 목록에서 선택합니다.
- **Artist**(아티스트): 아티스트 한 명을 중심으로 검색합니다. 아티스트는 **Artist** 입력란에 입력합니다.
- **Any Spotify**: 어울릴 때 DJ가 Spotify 검색을 쓰도록 합니다.

## YouTube 설정

YouTube 모드에는 무료 YouTube Data API 키가 필요합니다. API 키는 Marinara가 사용자를 대신해 서비스를 이용할 수 있게 해 주는 비밀 코드입니다. YouTube 로그인이나 Premium은 필요 없습니다.

1. **Music DJ** 편집기에서 **YouTube Connection**(YouTube 연결)을 찾으세요.
2. 앱의 링크로 **Google Cloud Console**을 열고 프로젝트를 만들거나 고르세요.
3. **YouTube Data API v3**를 활성화하세요.
4. Credentials, Create credentials, API key 순서로 이동하세요.
5. 키를 **YouTube Data API Key**(YouTube Data API 키)에 붙여 넣으세요.
6. **Save Key**(키 저장)를 클릭하세요. 그러면 버튼이 **Update Key**(키 업데이트)로 바뀌고 초록색 "API key configured" 배지가 나타납니다. **Remove**(제거)는 키를 삭제합니다.

키는 제한 없이 두거나, API 기준으로 YouTube Data API v3로만 제한하세요. HTTP 리퍼러 기준으로는 제한하지 마세요. 검색은 서버에서 실행되므로 리퍼러 제한을 걸면 검색이 막힙니다. 앱에는 무료 쿼터(하루 약 100회 검색)가 개인용 DJ에는 충분하다고 나와 있습니다. 이 수치는 앱 문구에서 가져온 것이므로 바뀔 수 있습니다. 키는 서버에 암호화되어 보관됩니다.

## 직접 가진 음악 파일 쓰기

Custom 모드는 Marinara를 실행하는 컴퓨터의 오디오 파일을 재생합니다. 지원하는 형식은 `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac`, `.webm`입니다.

**Music DJ** 편집기에서 **Custom Music Library**(사용자 지정 음악 라이브러리)를 찾으세요. 여기에는 **Use Game Assets music folder**(게임 에셋 음악 폴더 사용) 스위치 하나가 있습니다.

- **On**: Custom 모드가 Game Assets(Game Mode용 Marinara 에셋 라이브러리)에 업로드한 오디오를 읽습니다. **Game Assets music folder**(게임 에셋 음악 폴더)에서 폴더를 고르세요. 라이브러리 전체는 `music`, 하위 폴더는 `music/combat`처럼 입력하세요. **Open Folder**(폴더 열기)는 서버 컴퓨터에서 그 폴더를 엽니다.
- **Off**: Custom 모드가 서버 기기의 폴더를 읽습니다. **Select Folder**(폴더 선택)로 서버 컴퓨터의 폴더 선택 창을 열거나, **Default music folder on this device**(이 기기의 기본 음악 폴더)에 경로를 붙여 넣으세요. 따로 폴더가 없는 채팅은 모두 이 폴더를 씁니다.

Game Assets 밖의 폴더에서 재생하려면 서버의 로컬 접근 권한이 필요합니다. 입력한 폴더 경로를 저장할 때도 폴더 선택 창과 같은 권한이 필요합니다. 로그인이나 관리자 시크릿 없이 다른 기기에서 쓰면 둘 다 막힐 수 있습니다. [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)을 참고하세요.

<a id="use-a-different-folder-for-a-chat-or-character"></a>

### 채팅이나 캐릭터마다 다른 폴더 쓰기

채팅이나 캐릭터마다 음악 폴더를 따로 둘 수 있으므로, 이야기마다 다른 사운드트랙을 재생할 수 있습니다. 캐릭터의 폴더는 그 캐릭터 혼자 있는 모든 채팅에서 재생됩니다.

1. 채팅을 열고 **Chat Settings**(채팅 설정)를 여세요.
2. **Music DJ** 설정에서 **Custom** 플레이어를 선택한 상태로 **Apply to**(적용 대상)를 열고 폴더를 저장할 위치를 고르세요.
3. **Choose Folder**(폴더 선택)를 클릭하거나 **Music folder on this device**(이 기기의 음악 폴더)에 경로를 붙여 넣으세요.

| Apply to | 폴더를 쓰는 채팅 |
| --- | --- |
| **This chat**(이 채팅) | 이 채팅만 씁니다. 분기는 같은 폴더로 시작하고, 나중에 바꿀 수 있습니다. |
| 캐릭터 이름 | 그 캐릭터 혼자 있는 모든 채팅이 씁니다. 캐릭터가 한 명인 채팅에서만 표시됩니다. |
| **All chats (default)**(모든 채팅, 기본값) | 따로 폴더가 없는 모든 채팅이 씁니다. **Music DJ** 편집기에서 정한 기본 폴더입니다. |

Music DJ는 처음 찾은 폴더를 씁니다. 이 채팅의 폴더, 캐릭터의 폴더, 기본 폴더 순서로 찾습니다. 그룹 채팅은 캐릭터의 폴더를 쓰지 않습니다. 채팅이나 캐릭터의 폴더는 기본 소스가 Game Assets여도 재생됩니다.

이 기기에 채팅 자체의 폴더가 없어 채팅이 Game Assets에서 재생하는 동안에는 **This chat**을 고르면 **Game Assets Music Folder**(게임 에셋 음악 폴더)도 표시됩니다. `music/combat`처럼 Game Assets의 하위 폴더를 입력하면 이 채팅에서만 그 폴더를 재생합니다. 비워 두면 기본값을 씁니다.

**In use:**(사용 중)에는 이 채팅이 재생하는 폴더와 그 폴더의 출처가 표시됩니다. 출처는 **This chat**, **From**과 캐릭터 이름, **Default**(기본값) 중 하나입니다.

- **Use default**(기본값 사용)는 이 채팅에 지정한 폴더를 해제합니다. 그러면 채팅은 캐릭터의 폴더를, 없으면 기본 폴더를 재생합니다.
- **Unlink from**(연결 해제)과 캐릭터 이름이 적힌 버튼은 모든 채팅에서 그 캐릭터의 폴더를 해제합니다.

채팅에 Music DJ를 추가할 때도 같은 **Apply to** 선택지가 나타납니다. 채팅 자체의 폴더는 채팅 내보내기, 설정 프로필, **Export Profile**(프로필 내보내기) 파일에 들어가지 않습니다. 에이전트를 내보낼 때는 기본 폴더와 캐릭터 폴더가 빠집니다. 각 경로는 이 서버의 파일을 가리키므로 다른 서버에서는 의미가 없습니다.

## 음악 플레이어 사용하기

**Music Player**는 데스크톱에서는 상단 바의 배지로, 모바일에서는 끌어서 옮길 수 있는 위젯으로 표시됩니다. 표시하거나 숨기려면 **Settings → General → App Behavior**(설정 → 일반 → 앱 동작)를 열고 **Music Player**를 켜거나 끄세요. 기본값은 켜짐입니다. 켜져 있는데 Music DJ가 설치되지 않았다면 플레이어에 **Download Music DJ Agent to configure**(설정하려면 Music DJ 에이전트를 다운로드하세요)가 표시되고 **Agent Organizer** 버튼이 나타납니다.

새 프로필에서는 소스가 **YouTube**로 시작합니다. 플레이어의 원형 소스 전환 버튼(툴팁 "Switch to ... player"), 편집기의 **Music Player** 버튼, 채팅의 **Music DJ** 설정에서 바꿀 수 있습니다.

플레이어에는 트랙의 커버나 썸네일, 제목, 아티스트나 채널이 표시됩니다. 조작 버튼은 소스에 따라 다릅니다.

- **Spotify**: 셔플, **Previous**(이전), 재생 또는 일시 정지, **Next**(다음), 반복, 음소거가 있는 볼륨, **DJ**, 노트북 모양의 **Marinara player** 버튼, **Music DJ setup** 톱니바퀴. Spotify가 연결되지 않았으면 플레이어에 "Spotify not connected"가 표시되고, 누르면 **Music DJ setup**이 열립니다.
- **YouTube**: 재생 또는 일시 정지, 작은 16:9 영상 패널을 여는 화살표, **Stop**(중지), 음소거가 있는 볼륨.
- **Custom**: 재생 또는 일시 정지와 볼륨.

## DJ Mari: AI 플레이리스트 제작

Spotify 미니 플레이어의 **DJ** 버튼("DJ Mari composes a playlist for you!")은 테마에 맞는 플레이리스트를 만듭니다. DJ Mari는 연결된 AI 모델에 요청해 페르소나, 가장 많이 쓴 캐릭터, 모든 채팅의 최근 내용을 바탕으로 플레이리스트를 만듭니다. 찾아낸 곡을 "DJ Mari"와 오늘 날짜를 이름으로 한 새 Spotify 플레이리스트에 담고 재생을 시작합니다.

두 가지가 필요합니다.

- **Music DJ** 에이전트에 지정한 모델. 없으면 "Configure a model connection on the Music DJ agent before using DJ Mari."가 표시됩니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.
- 조건에 맞는 Spotify 곡 25곡 이상. 최대 50곡까지 고릅니다. 25곡보다 적으면 Liked Songs를 더 추가하고 다시 시도하라고 요청합니다.

성공하면 "DJ Mari playlist is ready"와 함께 **Open playlist**(플레이리스트 열기) 버튼이 표시됩니다.

<a id="music-dj-in-game-mode"></a>

## Game Mode의 Music DJ

Game Mode에는 Game Assets에서 가져오는 자체 배경 음악이 있습니다. 대신 Music DJ를 쓰려면 Game 설정에서 **Music DJ** 토글을 켜세요("Use the Music DJ for this game instead of local music assets"). 기본값은 꺼짐입니다. 켜면 Roleplay와 같은 **Spotify**, **YouTube**, **Custom** 선택지와 항목을 쓸 수 있습니다.

Spotify를 쓰면 장면이 끝날 때마다 서버가 고른 소스에서 실제 후보 곡의 짧은 목록을 만들고, AI가 그중 한 곡을 고릅니다. 이렇게 하면 AI가 곡을 지어내지 않습니다. Game Mode는 한 번에 한 곡을 반복 재생합니다. 현재 장면의 곡을 새로 고르려면 **Game controls**(게임 컨트롤)를 열고 **Retry Music DJ**(Music DJ 재시도)를 선택하세요. [게임 컨트롤](../game/getting-started.md#the-games-controls)을 참고하세요.

<a id="the-conversation-music-command"></a>

## Conversation의 Music 명령어

Conversation에서는 Music DJ를 에이전트로 추가할 수 없습니다. 대신 캐릭터가 **Music** 명령어로 곡을 재생합니다.

1. 채팅의 **Commands**(명령어) 섹션을 열고 상위 **Commands** 토글을 켜세요.
2. **Music**을 켜세요("Let characters play songs through the active Music Player").

그러면 캐릭터가 Spotify용으로 곡 이름을 대거나 YouTube용으로 트랙을 설명할 때 Marinara가 현재 소스로 재생합니다. Music DJ를 어디에서도 켜지 않았어도 동작합니다. Spotify 연결이나 저장된 YouTube 키만 있으면 됩니다. Spotify가 연결되지 않았거나 재생 권한이 없으면 Spotify 곡 명령어는 아무 동작도 하지 않고 오류도 표시하지 않습니다.

## 문제 해결

- **미니 플레이어가 보이지 않음**: **Settings → General → App Behavior**에서 **Music Player**를 켜세요.
- **Spotify에서 아무것도 재생되지 않음**: 재생하려면 Spotify Premium과 동작 중인 Spotify 기기가 필요합니다. 기기에서 데스크톱 앱을 열거나, 데스크톱에서 **Enable Marinara player**를 클릭하세요.
- **다른 컴퓨터에서 Spotify 로그인 창이 실패함**: "Browser couldn't reach the callback?" 붙여 넣기 상자를 쓰거나, 서버에 `SPOTIFY_REDIRECT_URI`를 설정하세요.
- **YouTube 검색이 실패함**: 프로젝트에 **YouTube Data API v3**가 활성화되어 있고 키가 HTTP 리퍼러로 제한되지 않았는지 확인하세요. 하루 쿼터를 다 썼다면 다음 날 다시 시도하거나 다른 키를 쓰세요.
- **원격 접근에서 기기 폴더의 Custom 음악이 재생되지 않거나 입력한 폴더 경로가 저장되지 않음**: 둘 다 서버의 로컬 접근 권한이 필요합니다. [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)을 참고하세요.
- **채팅에서 잘못된 폴더가 재생됨**: 채팅의 **Music DJ** 설정에서 **In use:**를 확인하세요. **This chat**이 캐릭터의 폴더보다 우선하므로, 다시 캐릭터의 폴더를 따르게 하려면 **Use default**를 클릭하세요.
- **Conversation에서 캐릭터의 곡 명령어가 동작하지 않음**: Spotify를 연결하거나 YouTube 키를 저장하고, **Commands**와 **Music** 토글이 켜져 있는지 확인하세요.

## 관련 가이드

- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
- [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [게임 에셋](../game/game-assets.md)
- [Conversation Mode: 시작하기](../conversation/getting-started.md)
