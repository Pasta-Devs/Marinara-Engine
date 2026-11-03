# 설정 개요

이 가이드에서는 **Settings**(설정)의 어느 부분에 어떤 조작 항목이 있는지 안내하고, **General**(일반) 탭을 설정하는 방법과 설정이 기기 사이에서 동기화되는 방식을 설명합니다.

## Settings 패널과 탭 6개

상단 바의 톱니바퀴 아이콘으로 **Settings**를 여세요. 맨 위의 **Search settings**(설정 검색) 입력란에서 이름으로 설정을 찾을 수 있습니다. `delete`, `streaming`, `quotes` 같은 단어를 입력하면 Marinara가 해당 섹션으로 바로 이동합니다. 인터페이스 언어로 된 이름과 영어 이름 모두 검색됩니다.

패널에는 탭이 6개 있습니다. 탭마다 자체 섹션이 있습니다.

### 하고 싶은 일

| 하고 싶은 일 | 이동할 곳 |
| --- | --- |
| 언어 바꾸기 | **Settings → General → App Behavior → Language**(설정 → 일반 → 앱 동작 → 언어) |
| 글자 크게 하기 | **Settings → Appearance → App → Text & Scale**(설정 → 모양 → 앱 → 텍스트 및 배율) |
| 테마나 색상 바꾸기 | **Settings → Appearance → App → App Style**(설정 → 모양 → 앱 → 앱 스타일) |
| 알림 소리 정하기 | **Settings → General → Notifications**(설정 → 일반 → 알림) |
| 삭제 확인 끄기 | **Settings → General → App Behavior** |
| 퀵 리플라이 추가하기 | **Settings → General → Input & Editing**(설정 → 일반 → 입력 및 편집) |
| 백업 만들기 | **Settings → Advanced → Backup & Export**(설정 → 고급 → 백업 및 내보내기) |
| 내 데이터 삭제하기 | **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역) |
| Marinara 업데이트하기 | **Settings → Advanced → Updates**(설정 → 고급 → 업데이트) |

### 탭별 구성

**General**(이 가이드에서 설명합니다)

- **App Behavior**(앱 동작)와 **Search and Professor Mari settings**(검색 및 Mari 교수님 설정) 행
- **Notifications**
- **Responses**(응답)
- **Input & Editing**
- **Text Rules**(텍스트 규칙)
- **Game Playback**(게임 재생)

**Appearance**에는 버튼이 4개 있습니다. [모양 설정](../appearance/appearance-settings.md)을 참고하세요.

- **App**: **App Style**, **Text & Scale**, **Atmosphere**(분위기), **Backgrounds**(배경)
- **Conversation**(대화): **Conversation Display**(대화 표시), **Conversation Theme**(대화 테마)
- **Roleplay**(롤플레이): **Tracker Panel**(트래커 패널), **Roleplay Presentation**(롤플레이 표시 방식)
- **Game**(게임): **Game Presentation**(게임 연출)

**Generations**(생성)에는 **Overall Generations**(전체 생성), **Image Generation**(이미지 생성), **Video Generation**(동영상 생성), **Prompt Overrides**(프롬프트 재정의)가 있습니다. Illustrator 에이전트를 설치하기 전까지 이 탭에는 에이전트를 다운로드하라는 안내만 표시됩니다. [이미지 스타일 프로필](../media/style-profiles.md)과 [장면 동영상 생성](../media/scene-video.md)을 참고하세요.

**Addons**(애드온)에는 확장 수정 기록, **Personal Extensions**(개인 확장), **External Extensions**(외부 확장)(잠금을 푼 경우에만 표시), **Theme Library**(테마 라이브러리)가 있습니다. [개인 확장](../extending/personal-extensions.md)과 [사용자 지정 CSS 테마](../appearance/custom-css-themes.md)를 참고하세요.

**Imports**(가져오기)에는 **Profile & Marinara**(프로필 및 Marinara), **SillyTavern Import**(SillyTavern 가져오기), **Game Assets**(게임 에셋)가 있습니다. [Marinara 백업과 복원](../data/backup-and-restore.md)과 [SillyTavern에서 가져오기](../data/importing-from-sillytavern.md)를 참고하세요.

**Advanced**(고급)에는 다음 섹션이 이 순서로 있습니다. [Advanced 탭](#the-advanced-tab)을 참고하세요.

- **Multiplayer WIP**(멀티플레이어 WIP)
- **Access**(접근)
- **Admin Access**(관리자 접근)
- **Features**(기능)
- **Updates**
- **Support Diagnostics**(지원 진단 정보)
- **Request timeouts**(요청 제한 시간)
- **Parameters**(파라미터)
- **Message Tools**(메시지 도구)
- **Backup & Export**
- **Storage Optimization**(저장 공간 최적화)
- **Danger Zone**

## General 탭

**General** 탭의 각 섹션은 **Settings** → **General**에 있습니다.

| 섹션 | 제어하는 내용 |
| --- | --- |
| **App Behavior** | 언어, 삭제 안전 장치, 표시/숨김 스위치, **Search and Professor Mari settings** 행. [App Behavior](#app-behavior)를 참고하세요. |
| **Notifications** | 알림 소리, 브라우저 알림과 Android 알림. [Notifications](#notifications)를 참고하세요. |
| **Responses** | 스트리밍, 다듬기, **Messages per page**(한 번에 표시할 메시지 수). [메시지 보내기와 스트리밍](../chats/sending-and-streaming.md)을 참고하세요. |
| **Input & Editing** | **Send on Enter**(엔터 키로 전송), **Quick replies**(퀵 리플라이), 스와이프와 편집 단축키. [Input and Editing](#input-and-editing)을 참고하세요. |
| **Text Rules** | 채팅 글의 서식 방식. [Text Rules](#text-rules)를 참고하세요. |
| **Game Playback** | Game Mode의 읽기와 이동. [Game Mode: 시작하기](../game/getting-started.md)를 참고하세요. |

<a id="app-behavior"></a>

### App Behavior

| 설정 | 하는 일 |
| --- | --- |
| **Language** | 인터페이스 언어를 정합니다. 모델 프롬프트나 채팅 내용은 바꾸지 않습니다. 아직 번역되지 않은 글은 영어로 표시됩니다. 아랍어는 오른쪽에서 왼쪽으로 읽는 배치를 씁니다. 기본값: 영어. |
| **Documentation Language**(문서 언어) | 내장 가이드의 언어를 정합니다. 아래 내용을 참고하세요. 기본값: 영어. |
| **Confirm before deleting**(삭제 전 확인하기) | Marinara가 채팅, 캐릭터 등의 항목을 영구히 삭제하기 전에 확인합니다. 기본값: 켜짐. |
| **Hide chat Help button**(채팅 도움말 버튼 숨기기) | Conversation, Roleplay, Game 채팅에서 **Help**(도움말) 버튼을 숨깁니다. 기본값: 꺼짐. |
| **Show Android status bar**(Android 상태 표시줄 표시) | 시간, 배터리, 알림 아이콘을 Marinara 위에 계속 표시합니다. Android 앱에서만 작동합니다. 기본값: 꺼짐. |
| **Achievements**(업적) | 업적을 기록하고, 잠금 해제 알림과 홈 화면의 북마크 및 위젯을 표시합니다. [업적](../home/achievements.md)을 참고하세요. 기본값: 켜짐. |
| **Disable seasonal ME themes** | Marinara의 계절 테마를 끕니다. 기본값: 꺼짐. |
| **Music Player**(음악 플레이어) | 작은 Music Player를 표시합니다. **Agents**(에이전트) → **Agent Organizer**에서 받는 **Music DJ** 에이전트가 필요하며, 설치하기 전까지 흐리게 표시됩니다. [음악](../media/music.md)을 참고하세요. 기본값: 켜짐. |

**Search and Professor Mari settings**는 **App Behavior** 맨 아래에 있는 행입니다. **Open**(열기)을 선택하면 Search, 빠른 답변, Professor Mari의 설정 페이지로 이동합니다. [Professor Mari](../home/professor-mari.md)를 참고하세요.

인터페이스 언어는 아랍어, 중국어 간체, 영어, 프랑스어, 독일어, 힌디어, 일본어, 한국어, 폴란드어, 브라질 포르투갈어, 러시아어, 스페인어입니다. 번역을 개선하거나 언어를 추가하려면 [UI 지역화](../development/localization.md)를 참고하세요.

**Documentation Language**에서 영어는 내장되어 있습니다. 다른 언어를 고르고 **Download & Replace**(다운로드 및 교체)를 클릭하세요. Marinara가 그 언어 팩을 한 번 다운로드하고 이전 팩을 지우므로, 다운로드된 언어는 하나만 남습니다. 아직 번역되지 않은 가이드는 작은 `EN` 배지와 함께 영어로 열립니다. 가이드 검색은 현재 사용 중인 언어로 작동합니다. 고른 언어는 업데이트 후에도 유지되고, 번역이 바뀌면 업데이트 뒤에 팩을 새로 받습니다. 다운로드한 가이드가 사라지거나 손상되면 **Fix documentation**(문서 복구) 버튼이 나타납니다. 이 버튼은 팩을 다시 다운로드하고, 다운로드 위치에 접근할 수 없으면 가이드를 영어로 되돌립니다.

<a id="notifications"></a>

### Notifications

Marinara는 알림에 기본 내장 소리를 재생합니다. 직접 고른 소리를 쓰려면 다음 단계를 따르세요.

1. **Settings** → **General** → **Notifications**를 여세요.
2. **Custom sound**(사용자 지정 소리)를 업로드하세요. MP3, WAV, OGG, M4A, MP4, WebM 형식이며 10 MB까지 가능합니다.

이 소리는 이 서버에 연결된 모든 기기에서 재생됩니다. 미리 듣기, 교체, 제거를 할 수 있습니다. 파일을 읽을 수 없으면 Marinara는 기본 내장 소리를 재생합니다. 이 파일은 백업과 프로필 내보내기에 포함됩니다.

**Background Notifications**(백그라운드 알림)는 캐릭터가 스스로 보내는 Conversation 메시지를 알려 줍니다. **Generation Completion Notifications**(생성 완료 알림)는 Conversation, Roleplay, Game Mode에서 직접 시작한 응답을 알려 줍니다. 둘 다 Marinara를 열어 둔 채 다른 창을 보고 있을 때 작동합니다. 메시지 내용은 절대 표시하지 않습니다.

<a id="input-and-editing"></a>

### Input and Editing

**Settings** → **General** → **Input & Editing**의 설정은 다음과 같습니다.

| 설정 | 하는 일 |
| --- | --- |
| **Send on Enter** | Enter를 눌렀을 때 메시지를 보낼 모드를 고릅니다. |
| **Keep guidance after regenerating**(재생성 후 지침 유지) | 지침을 적용한 재생성 뒤에도 방향을 메시지 입력란에 남겨 둡니다. 기본값은 켜짐입니다. |
| **Add CYOA choices to the message box instead of sending them**(CYOA 선택지를 전송하지 않고 메시지 입력란에 추가) | 클릭한 선택지를 메시지 입력란에 넣어 먼저 고칠 수 있게 합니다. |
| **Quick replies** | 전송 버튼 옆에 초안 작업 버튼을 추가합니다. [지침 기반 생성과 Impersonate](../chats/guided-and-impersonate.md)를 참고하세요. |
| **Speech-to-text microphone**(음성-텍스트 변환 마이크) | 채팅 입력란에 마이크 버튼을 표시합니다. |
| **Intuitive swipe navigation**(직관적인 스와이프 탐색) | 화살표 키나 터치 스와이프로 스와이프(메시지 하나에 남겨 둔 여러 답변) 사이를 오갑니다. |
| **Reroll past the newest swipe**(최신 스와이프 이후 다시 생성) | 가장 새로운 스와이프에서 한 번 더 스와이프하면 새 응답을 만듭니다. |
| **Up Arrow edits last message**(위쪽 화살표로 마지막 메시지 편집) | 입력란이 비어 있을 때 Up Arrow를 누르면 마지막 메시지를 편집합니다. |
| **Double-click edits messages**(더블 클릭으로 메시지 편집) | Roleplay 메시지를 더블 클릭하면 편집합니다. |

**Responses** 섹션에는 **Enable streaming**(스트리밍 활성화), **Streaming speed**(스트리밍 속도), **Trim incomplete sentences from the response**(응답에서 완성되지 않은 문장 제거), **Add a new line before /continue text**(/continue 텍스트 앞에 새 줄 추가)(기본값은 켜짐), **Messages per page**가 있습니다. [메시지 보내기와 스트리밍](../chats/sending-and-streaming.md)을 참고하세요. 메시지 조작은 [메시지 조작](../chats/messages.md)을 참고하세요.

<a id="text-rules"></a>

### Text Rules

**Settings** → **General** → **Text Rules**의 이 규칙들은 채팅 글을 다루는 방식을 바꿉니다. **Bold dialogue in quotes**(따옴표 안의 대사를 굵게 표시)와 **Convert LaTeX symbols**(LaTeX 기호 변환)는 글이 보이는 모양만 바꾸므로 저장된 메시지는 그대로입니다. **Quote style**(따옴표 스타일)은 입력해서 저장하는 글의 따옴표를 다시 씁니다.

| 설정 | 하는 일 |
| --- | --- |
| **Bold dialogue in quotes** | 따옴표 안의 글을 굵게 표시합니다. 기본값은 켜짐입니다. |
| **Convert LaTeX symbols** | LaTeX 수식 명령을 기호로 표시합니다. 코드는 그대로 둡니다. 기본값은 켜짐입니다. |
| **Quote style** | **Straight**는 곧은 부호를 그대로 씁니다(기본값). **Typographic**은 곧은 부호를 굽은 따옴표와 아포스트로피로 바꿉니다. |
| **Load images from other websites in messages**(메시지에서 다른 웹사이트의 이미지 불러오기) | 다른 웹사이트에 있는 이미지를 제어합니다. 기본값은 꺼짐입니다. |

#### Bold dialogue in quotes

이 설정을 켜면 `"I missed you," she said.`에서 따옴표 안의 글이 굵게 표시됩니다. 대사 색상만 남기고 굵은 표시를 없애려면 끄세요.

#### Convert LaTeX symbols

일부 모델은 수식을 LaTeX 명령으로 씁니다. 이 설정을 켜면 `\rightarrow`, `\neq`, `\times`, `\alpha`가 `→`, `≠`, `×`, `α`로 표시됩니다.

#### Load images from other websites in messages

이 설정을 끄면 메시지, 인사말, 카드 미리보기에 있는 다른 웹사이트의 이미지 대신 그 웹사이트 이름과 **Load image**(이미지 불러오기) 버튼이 표시됩니다. 그래서 메시지가 스스로 다른 사이트에 접속하지 못합니다. **Load image**를 선택하면 그 이미지가 표시되며, Marinara는 이 선택을 모든 기기에서 기억합니다. 모든 이미지를 바로 표시하려면 이 설정을 켜세요. 갤러리 그림, 아바타, 스프라이트처럼 Marinara에 저장된 이미지는 항상 표시됩니다.

<a id="the-advanced-tab"></a>

## Advanced 탭

| 섹션 | 자세히 보기 |
| --- | --- |
| **Admin Access** | [원격 접근](../REMOTE_ACCESS.md) |
| **Features** | [기능 스위치](../configuration/features.md) |
| **Updates** | [Marinara Engine 업데이트](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Marinara 백업과 복원](../data/backup-and-restore.md) |
| **Danger Zone** | [데이터 지우기와 초기화](../data/clearing-data.md) |

<a id="message-tools"></a>

### Message Tools

이 스위치들은 **Settings** → **Advanced** → **Message Tools**에 있습니다. **Show context usage**(컨텍스트 사용량 표시)와 **Show "older messages not sent" note**("전송되지 않은 이전 메시지" 안내 표시)를 제외하면 모두 기본값이 꺼짐입니다.

| 스위치 | 하는 일 |
| --- | --- |
| **Show message timestamps**(타임스탬프 표시) | 메시지마다 날짜와 시간을 표시합니다. |
| **Show characters in Persona pickers**(페르소나 선택기에서 캐릭터 표시) | 페르소나 선택기에 캐릭터를 나열하므로, 캐릭터 중 하나로 플레이할 수 있습니다. |
| **Show model name on messages**(메시지에 모델 이름 표시) | 각 응답을 쓴 모델을 표시합니다. |
| **Show token usage on messages**(메시지에 토큰 사용량 표시) | 메시지별 프롬프트와 응답의 토큰 수를 표시합니다. |
| **Show context usage** | 마지막으로 측정한 요청에서 컨텍스트 창이 얼마나 찼는지를 연결 전환기와 Game 채팅 설정에 표시합니다. |
| **Show message numbers**(메시지 번호 표시) | 메시지마다 번호를 표시합니다. |
| **Show "older messages not sent" note** | 이전 메시지가 프롬프트에 다 들어가지 못했을 때 최신 응답 아래에 안내를 표시합니다. 잘리거나 비어 있는 응답에는 여전히 그 응답의 안내가 표시됩니다. |
| **Guide swipes/regens with chat input**(채팅 입력으로 스와이프/재생성 안내) | 재생성할 때 입력해 둔 초안을 지침으로 씁니다. |
| **Include reasoning in exports**(내보내기에 추론 포함) | 채팅 내보내기에 모델의 숨겨진 사고 과정을 넣습니다. |
| **Include private notes in exports**(내보내기에 비공개 메모 포함) | JSONL 및 텍스트 내보내기에 비공개 메시지 메모를 넣습니다. 채팅 기록을 공유할 때는 꺼 두세요. |
| **Debug mode**(디버그 모드) | 지원 요청에 쓸 수 있도록 모델 요청 내용을 서버 콘솔에 기록합니다. |

자세한 내용은 [메시지 조작](../chats/messages.md), [사용자 페르소나](../characters/personas.md), [한 채팅에 쓸 모델 고르기](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt](../chats/peek-prompt.md), [지침 기반 생성과 Impersonate](../chats/guided-and-impersonate.md), [채팅 내보내기와 가져오기](../chats/export-import.md), [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 설정이 기기 사이에서 동기화되는 방식

Marinara는 대부분의 설정을 서버에 저장합니다. 그래서 브라우저와 기기를 옮겨 다녀도 설정이 따라옵니다.

1. **Settings**에서 설정을 바꾸세요.
2. 약 1초 뒤에 Marinara가 그 설정을 서버에 저장합니다.
3. 같은 서버를 여는 다른 브라우저가 그 설정을 불러옵니다.

가장 나중에 바꾼 값이 이깁니다. 변경한 직후 두 번째 기기에서 Marinara를 열면, 그 기기의 이전 사본이 방금 바꾼 값을 덮어쓸 수 있습니다. 기기를 옮기기 전에 잠시 기다리세요.

동기화되지 않는 설정이 두 가지 있습니다. **Settings** → **Appearance** → **Text & Scale**에서 기기마다 다시 설정하세요.

- **Display Size**(디스플레이 사이즈): 인터페이스 글자 크기
- **Chat Font Size**(채팅 폰트 사이즈): 채팅 글자 크기

[모양 설정](../appearance/appearance-settings.md)을 참고하세요. 서버에 연결할 수 없으면 앱은 기기에 있는 설정으로 계속 동작하고, 다음에 설정을 바꿀 때 다시 저장을 시도합니다.

## 관련 가이드

- [모양 설정](../appearance/appearance-settings.md)
- [메시지 조작](../chats/messages.md)
- [Marinara가 데이터를 저장하는 위치](../data/where-data-is-stored.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
