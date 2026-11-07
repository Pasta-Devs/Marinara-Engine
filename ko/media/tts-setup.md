# Text to Speech(TTS) 설정

음성 합성(TTS)은 채팅 메시지와 게임 서술을 소리 내어 읽어 줍니다. 이 가이드에서는 TTS를 켜고, 음성 서비스와 목소리를 고르고, 자동 재생을 설정하고, 메시지별 조작을 쓰는 방법을 설명합니다.

## 빠른 시작

1. TTS 카드를 열고(아래 단계 참고) **Use text to speech**(TTS 사용)를 켜세요.
2. **Source**(연결 소스)를 고르고 **API key**(API 키)에 키를 붙여넣으세요.
3. **Preview**(미리 듣기)를 클릭해 예시 음성을 들어 보세요.
4. 채팅에서 메시지 아래의 **Speak**(말하기)를 클릭하세요.

## 음성 합성 켜기

TTS 설정은 거의 전부 카드 하나에 모여 있습니다. TTS를 켜기만 해서는 아무것도 말하지 않습니다. TTS를 켜면 각 메시지의 **Speak** 버튼과 **Auto-play**(자동 재생) 항목이 나타납니다. 무엇을 언제 읽을지는 여전히 직접 고릅니다.

1. 상단 바에서 **Connections**(연결)를 클릭한 다음 **Add**(추가)를 클릭하세요. **Add account**(계정 추가) 창이 열립니다.
2. **Voice**(음성) 아래에서 **Text to speech**(TTS)를 고르세요. 카드가 열립니다. TTS가 이미 내 컴퓨터나 사설 네트워크에 있는 PocketTTS나 다른 음성 서버를 쓰고 있다면 같은 카드가 **On this device**(이 기기) 아래에도 있습니다.
3. **Use text to speech**를 켜세요. 꺼져 있는 동안에는 아무것도 소리 내어 읽지 않습니다.
4. **Source** 목록을 열고 서비스를 고르세요.

**Source**는 오디오를 만드는 서비스입니다.

- **OpenAI-compatible**: OpenAI, 또는 OpenAI의 TTS 형식을 그대로 따르는 서버입니다. 기본값입니다.
- **ElevenLabs**: ElevenLabs 음성 서비스입니다.
- **PocketTTS**: 내 컴퓨터에서 직접 실행하는 무료 음성 서버입니다.
- **xAI Voice**: xAI의 음성 서비스입니다.

Marinara는 Source마다 키, 주소, 모델, 목소리, 파라미터를 담은 프로필을 따로 저장합니다. Source를 바꾸면 그 Source에서 쓰던 설정이 되살아납니다. 아직 설정하지 않은 Source는 기본값에서 시작합니다.

요청은 Marinara 자체 서버를 거칩니다. API 키는 서버에 암호화되어 저장됩니다. 키를 저장하고 나면 입력란에는 가림 표시된 점이 나타나고, 실제 키는 브라우저로 다시 돌아오지 않습니다.

<a id="use-an-audio-connection"></a>

### 오디오 연결 사용하기

**Audio**(오디오) 계정을 이미 추가했다면([지원하는 AI 제공자](../connections/providers-reference.md#audio) 참고) 그 정보를 다시 입력할 필요가 없습니다. 그 계정은 **Source** 목록의 **Audio providers**(오디오 연결) 아래에 표시되며, 괄호 안에 소스 종류가 붙습니다.

1. **Source** 목록을 열고 계정을 고르세요.
2. 계정의 목소리와 아래의 나머지 설정을 고르세요.

그러면 Marinara는 그 계정의 주소, 키, 모델, **Request timeout (seconds)**(요청 제한 시간, 초)를 사용하므로 카드에서는 이 입력란들이 숨겨집니다. 키는 계정 안에 머물며, 카드로 복사되거나 브라우저로 보내지지 않습니다. 새 키처럼 계정에서 바꾼 내용은 바로 반영됩니다.

목소리, 속도, 그 밖의 음성 설정은 계정마다 따로 저장됩니다. 종류가 같은 두 계정도 이 설정을 공유하지 않습니다. 일반 Source 4가지의 설정은 그대로 남습니다. 카드의 스위치로는 여전히 일반 TTS를 켜고 끕니다.

고른 계정이 삭제되었거나 쓸 수 없으면 카드에 **Missing Audio provider**(누락된 오디오 연결)가 표시되고, 다른 Source를 고를 때까지 아무것도 읽지 않습니다. Marinara가 알아서 다른 Source로 바꾸는 일은 없습니다. 계정이 목소리 목록을 제공하면, 저장된 목소리 중 그 목록에 없는 것의 이름을 카드가 알려 줍니다.

## 주소, 키, 모델 설정하기

Audio 계정을 골랐다면 이 단계는 건너뛰세요. 계정이 이 값들을 제공합니다.

1. **Base URL**(기본 URL)을 확인하세요. Source마다 기본값이 채워집니다(아래 표). 프록시나 직접 운영하는 서버를 쓸 때만 바꾸세요.
2. **API key**에 키를 붙여넣으세요. 기존 키를 유지하려면 가림 표시된 점을 그대로 두세요. 키를 지우려면 입력란을 비우세요.
3. **Model**(모델)을 확인하세요. Source마다 기본값이 채워집니다. 서비스가 지원하는 다른 모델을 직접 입력할 수도 있습니다.

| Source | 기본 Base URL | 기본 모델 | 기본 목소리 |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | 없음, 직접 골라야 합니다 |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

**ElevenLabs**에서는 **Model** 목록이 내 계정에서 쓸 수 있는 음성 합성 모델을 불러옵니다. 일반 음성 합성 모델을 고르세요. 모델 ID에 `ttv`가 들어간 모델은 목소리 디자인용 모델이라 글을 읽지 못합니다. 이런 모델을 고르면 재생이 실패하고, 음성 합성 모델을 쓰라는 오류가 표시됩니다.

### PocketTTS

PocketTTS는 Marinara에 내장되어 있지 않습니다. [공식 PocketTTS 서버](https://github.com/kyutai-labs/pocket-tts)를 따로 설치하고 `uvx pocket-tts serve`로 시작하세요. Marinara가 대신 다운로드하거나 관리하지 않습니다. 공식 서버는 `http://localhost:8000`을 사용합니다. 호스트나 포트를 바꾸지 않았다면 **Base URL**을 그대로 두세요. Marinara는 공식 multipart `/tts` API를 감지합니다. [OpenAI 호환 PocketTTS 래퍼](https://github.com/teddybear082/pocket-tts-openai_streaming_server)용 사용자 지정 URL도 계속 작동합니다.

<a id="request-timeout"></a>

### 요청 타임아웃

Marinara는 읽을 대사 한 줄마다 최대 60초를 기다립니다. 내 컴퓨터, 특히 노트북에서 돌아가는 음성 서버는 긴 대사에 시간이 더 걸릴 수 있습니다. **Model** 아래의 **Request timeout (seconds)** 값을 늘리세요. 범위는 10초에서 3,600초입니다.

Audio 계정에는 편집기의 **Default voice**(기본 음성) 아래에 자체 **Request timeout (seconds)**가 있습니다. **Source**로 고른 계정을 포함해, Audio 계정을 통해 말하는 채팅은 그 한도를 사용합니다. 카드의 한도는 **Preview**를 포함해 카드 자체 설정으로 만드는 음성에 적용됩니다. 대사 한 줄이 너무 오래 걸리면 오류 메시지에 Marinara가 몇 초를 기다렸는지와 어떤 설정을 늘려야 하는지가 나옵니다.

## 목소리 고르기

**Voice option**(음성 소스)은 목소리를 배정하는 방식을 정합니다.

- **One voice for all**(모든 캐릭터에 하나의 음성 사용): 모든 화자가 같은 목소리를 씁니다. 기본값입니다.
- **Selected per character or persona**(캐릭터 개별 음성): 고른 캐릭터와 페르소나에게 각각 목소리를 줍니다.

### 모두에게 한 목소리

**Shared voice**(모든 캐릭터 음성)에서 목소리를 고르세요. 서비스의 실제 목소리 목록을 불러오려면 연결 정보를 입력하고 **Refresh voices from provider**(제공자에서 음성 새로고침) 버튼(원형 화살표 아이콘)을 클릭하세요. 이 버튼은 카드를 먼저 저장하므로 방금 입력한 키가 바로 쓰입니다. 연결하기 전에는 입력란이 비어 보이지 않도록 짧은 내장 목록이 표시됩니다. 서비스에서 오류가 나면 대체 목록을 새로고침에 성공한 것처럼 내놓지 않고 오류를 표시합니다.

공식 PocketTTS 서버에는 목소리 목록 엔드포인트가 없으므로 Marinara가 내장 목소리를 보여 주고, 목록 옆에 다른 내장 이름이나 지원되는 음성 URL을 적을 입력란을 둡니다. 호환 래퍼 서버는 자체 목록을 돌려줄 수 있고 사용자 지정 ID나 경로도 받습니다.

**ElevenLabs**에서는 목소리를 반드시 골라야 합니다. Marinara는 개인, 워크스페이스, 저장된 목소리, 기본 목소리를 포함한 계정 라이브러리 전체를 불러옵니다. 선택 창에는 검색란과 불러온 목소리 개수가 있습니다. 선택 창은 "Select an ElevenLabs voice"(ElevenLabs 음성 선택) 상태에서 시작하며, 실제 목소리를 고르기 전까지는 재생이 막힙니다.

### 캐릭터나 페르소나별로 지정

1. **Voice option**을 **Selected per character or persona**로 설정하세요.
2. **Character and persona voices**(캐릭터 음성)에서 **Add voice**(캐릭터 음성 추가)를 클릭하세요.
3. 왼쪽 목록에서 캐릭터나 페르소나를, 오른쪽 목록에서 목소리를 고르세요.
4. 캐릭터나 페르소나마다 같은 과정을 반복하세요.

캐릭터의 목소리는 **Character Editor**(캐릭터 편집기)의 **Voice** 탭에서도 정할 수 있습니다. 같은 행을 바꿉니다. 이 상자의 **Refresh**(새로고침)는 목소리 목록을 다시 불러옵니다. 캐릭터를 먼저 만들어 두세요. 캐릭터가 하나도 없으면 목소리를 배정하기 전에 캐릭터나 페르소나를 추가하라는 안내가 표시됩니다.

개인 목소리가 없는 캐릭터는 AU 사본의 원본처럼 이름이 일치하는 카드의 목소리를 씁니다. 그런 카드도 없으면 공용 목소리를 씁니다. [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)을 참고하세요.

### 내레이터 목소리

서술은 어느 한 캐릭터가 말하는 것이 아닌 글입니다. 장면 묘사나 게임 마스터의 대사가 여기에 해당합니다.

1. **Narrator voice**(나레이터 음성)에서 **Use separate narrator voice**(별도 나레이터 음성 사용)를 켜세요.
2. 목소리를 고르세요.

이 목소리는 Roleplay(롤플레이)와 Conversation(대화) 메시지에서 어떤 줄의 화자가 Narrator, GM, Game Master, System일 때, 그리고 화자 이름이 없는 Game Mode(게임 모드) 서술에 쓰입니다. ElevenLabs를 쓴다면 여기서 서술용 목소리를 고르세요. 비워 두면 전체 공용 목소리가 설정되어 있을 때만 서술이 그 목소리로 대체됩니다.

### 랜덤 NPC 목소리(Game Mode 전용)

이 기능은 Game Mode가 추적하는 비중이 작은 게임 캐릭터에게 남는 목소리를 나눠 줍니다. Roleplay나 Conversation에서는 아무 효과가 없습니다.

1. **Random NPC voices**(랜덤 NPC 음성)에서 **Use default voices for random NPCs**(랜덤 NPC에 기본 음성 사용)를 켜세요.
2. **Male NPC defaults**(남성 NPC 기본값)와 **Female NPC defaults**(여성 NPC 기본값)에서 쓸 목소리에 체크하세요.

개인 목소리가 없는 추적 대상 NPC(플레이어가 아닌 캐릭터)는 해당 묶음에서 일정하게 정해진 목소리를 받고, 세션 동안 그 목소리를 유지합니다. 목소리가 배정된 NPC는 그 목소리를 그대로 씁니다. 성별이 분명하지 않은 NPC는 두 묶음 모두에서 고릅니다. 앱이 남성이나 여성으로 표시된 목소리를 찾지 못하면 각 묶음은 전체 목록을 사용합니다.

## 오디오 형식과 속도

**Audio format**(오디오 포맷)은 **MP3**(기본값)나 **WAV**입니다. MP3를 만들지 못하는 로컬 서버라면 WAV를 쓰세요. ElevenLabs는 항상 MP3를 쓰므로 이 컨트롤이 숨겨집니다. xAI Voice에서는 컨트롤이 보이지만 아무 효과가 없습니다. xAI는 항상 MP3를 돌려주기 때문입니다.

**Speed** 슬라이더의 범위는 Source에 따라 다릅니다.

| Source | 범위 |
| --- | --- |
| OpenAI-compatible | 0.25배에서 4.0배 |
| PocketTTS | 호환 래퍼에서는 0.25에서 4.0. 공식 서버는 속도를 자체적으로 제어합니다. |
| ElevenLabs | 0.7배에서 1.2배 |
| xAI Voice | 0.7배에서 1.5배 |

저장된 속도가 범위를 벗어나면 허용되는 가장 가까운 값으로 맞춰집니다. ElevenLabs에는 컨트롤이 두 개 더 있습니다. **Language**(언어)는 언어를 강제로 지정하거나 **Auto detect** 상태로 둡니다. **Stability**(안정성)는 표현이 풍부한 쪽에서 일관된 쪽까지 조절합니다.

## 자동 재생

**Auto-play**의 각 토글은 한 종류의 새 메시지를 생성이 끝나는 대로 읽습니다. **Use text to speech**가 켜져 있어야 합니다. 토글은 모두 꺼진 상태로 시작합니다.

- **Roleplay messages**(롤플레이 메시지): 새 Roleplay 답변을 읽습니다.
- **Conversation messages**(대화 메시지): 새 Conversation 답변을 읽습니다.
- **Game narration**(게임 나레이션): 새 Game Mode 서술과 전투 줄을 읽습니다.
- **Progressive playback**(점진적 재생): 여러 줄짜리 답변 전체를 기다리지 않고 첫 줄부터 바로 재생합니다.
- **Only read dialogues**(대사만): 따옴표나 태그로 표시된 대사만 읽고 일반 서술은 건너뜁니다.

자동 재생은 가장 최근 답변이 완성될 때 그 답변에 한 번만 동작합니다. 채팅을 다시 열거나 스크롤해도 지난 메시지를 다시 읽지 않습니다.

Roleplay에서는 주 답변이 저장되는 즉시 음성 준비를 시작합니다. Prose Guardian처럼 켜 둔 에이전트가 답변을 다시 쓰면 Marinara는 최종 텍스트를 기다립니다.

### 텍스트 필터와 감정 지시

이 필터는 Game 서술과 Roleplay 화자 추출을 포함해 수동 재생과 자동 재생에 모두 적용됩니다. 코드 블록은 기본적으로 건너뜁니다. 나머지 두 필터는 꺼진 상태로 시작합니다.

- **Skip text inside HTML and custom tags**(HTML 및 사용자 지정 태그 안의 텍스트 건너뛰기): 숨겨진 `<simulation>...</simulation>` 블록처럼 태그로 둘러싼 텍스트를 제거합니다. 목소리를 고르는 데 쓰는 화자 태그는 남습니다.
- **Skip fenced code blocks**(코드 블록 건너뛰기).
- **Skip text inside square brackets**(대괄호 안의 텍스트 건너뛰기).

**Roleplay speaker extractor**(롤플레이 화자 추출기)를 켜면 **Enable emotion indicators**(감정 표시기 활성화)가 나타납니다. 이 옵션은 대사의 단어를 바꾸지 않고 목소리 지시를 더합니다. 감정 표시기를 켜면 **Skip text inside square brackets**가 켜져 있어도 대괄호 안의 텍스트가 음성 서비스로 갑니다. 여기에는 메모가 섞일 수 있습니다. 대괄호 안의 메모를 음성에서 빼려면 감정 표시기는 끄고 대괄호 건너뛰기는 켜 두세요. `[Low, steady voice, restrained urgency]` 같은 지시는 긴 대사를 나눌 때도 끊기지 않습니다. 앱이 아는 화자 표시와 장면 표시는 계속 제거됩니다. 각 지시를 어떻게 쓸지는 음성 모델이 정합니다. **Use text to speech**, **Game narration**, 감정 표시기가 모두 켜져 있으면 Game의 장면 대사, 파티 대사, 전투 대사에도 지시가 들어갈 수 있습니다.

## 메시지 하나 읽기

TTS를 켜면 각 캐릭터 메시지와 서술 메시지 아래 도구 모음에 **Speak** 버튼(마이크 아이콘)이 나타납니다.

- **Speak**를 클릭하면 메시지를 읽습니다. 음성을 받아 오는 동안 버튼이 로딩 상태로 표시됩니다.
- 재생 중에 다시 클릭하면 멈춥니다. 툴팁에는 **Stop speaking**(말하기 중지)이라고 표시됩니다.
- 이미지만 있는 메시지처럼 읽을 글이 없는 메시지에는 **No dialogue to speak**(말할 대사 없음)가 표시되고, 버튼은 비활성화된 채로 남습니다.

메시지를 읽는 동안에는 **Pause speaking**(말하기 일시 중지), **Resume speaking**(말하기 재개), **Restart speaking**(말하기 다시 시작) 버튼이 나타납니다. 스피커 아이콘 버튼을 누르면 0에서 100퍼센트(기본값 50) 범위의 **Line volume**(대사 음량) 슬라이더가 열립니다. 이 음량은 Game Mode 믹서, Conversation 통화 음량과 별개입니다.

작동하지 않는다면 [문제 해결](#troubleshooting)을 참고하세요.

## 캐시된 클립

Marinara는 같은 줄을 두 번 생성하지 않도록 생성한 오디오를 브라우저에 저장합니다. **Cached clips**(캐시된 클립) 패널에는 현재 개수와 전체 용량이 실시간으로 표시됩니다. **Export cached TTS clips**(캐시된 TTS 클립 내보내기) 버튼(다운로드 아이콘)을 클릭하면 캐시된 클립을 모두 별도의 오디오 파일로 저장합니다. 캐시는 가장 오래된 클립부터 알아서 정리합니다. 앱에는 캐시를 비우는 버튼이 없습니다. 비우려면 브라우저 데이터를 삭제하세요.

## 채팅 모드별 TTS

- **Roleplay**는 **Roleplay messages** 토글과 **Speak** 조작을 사용합니다. [Roleplay Mode: 시작하기](../roleplay/getting-started.md)를 참고하세요.
- **Conversation**은 **Conversation messages** 토글과 같은 조작을 사용합니다. 음성 통화는 [Conversation 음성 통화와 영상 통화](../conversation/calls.md)에서 다룹니다.
- **Game Mode**는 **Game narration** 토글을 사용합니다. Game Mode 믹서에는 **Master**(마스터), **Music**(음악), **Sound Effects**(효과음), **Ambient**(앰비언트) 옆에 **TTS**(음성 합성) 채널이 있습니다. 이 채널은 게임 음성의 음량을 정하며 100퍼센트에서 시작합니다. [게임 컨트롤](../game/getting-started.md#the-games-controls)을 참고하세요.

### Phonetic name(통화 중 발음)

목소리가 캐릭터나 페르소나 이름을 잘못 발음하면 **Phonetic name**(발음 표기 이름)을 추가하고 어떻게 들려야 하는지 적으세요. **Character Editor**에서는 **Voice** 탭에 있습니다. **Persona Editor**에서는 기본 정보 입력란과 함께 있습니다. 이 이름은 Conversation 음성 통화와 영상 통화에서만 쓰입니다. **Speak**, 자동 재생, Game Mode 서술은 이 이름을 무시합니다.

<a id="troubleshooting"></a>

## 문제 해결

- **아무것도 읽지 않을 때**: **Use text to speech**가 켜져 있는지 확인하세요. 그다음 해당하는 **Auto-play** 토글을 확인하거나 메시지의 **Speak**를 쓰세요.
- **카드에 Missing Audio provider가 표시될 때**: **Source**로 고른 계정이 삭제되었거나 쓸 수 없습니다. 다른 Source를 고르세요. [오디오 연결 사용하기](#use-an-audio-connection)를 참고하세요.
- **목록에 목소리가 없을 때**: TTS를 켜고 올바른 키를 넣은 상태로 카드를 저장한 다음 **Refresh voices from provider**를 클릭하세요. 공식 PocketTTS 서버는 Marinara의 내장 목록을 사용합니다. 호환 PocketTTS 래퍼라면 `<Base URL>/v1/voices`가 응답하는지 확인하세요.
- **ElevenLabs가 말하지 않을 때**: "Select an ElevenLabs voice" 플레이스홀더가 아니라 실제 목소리를 고르세요. **Model**이 ID에 `ttv`가 들어간 목소리 디자인 모델이 아니라 음성 합성 모델인지 확인하세요.
- **대사가 "No audio after 60 s"로 멈출 때**: 음성 서버에 시간이 더 필요합니다. 메시지가 알려 주는 곳에서 **Request timeout (seconds)**를 늘리세요. [요청 타임아웃](#request-timeout)을 참고하세요.
- **로컬 주소의 자체 호스팅 서버가 차단될 때**: `.env`에서 `TTS_LOCAL_URLS_ENABLED`를 켜세요. 이 설정을 켜면 Marinara가 OpenAI-compatible 방식이나 ElevenLabs 방식 서버의 로컬 주소나 사설 주소에 접근할 수 있습니다. PocketTTS에는 필요 없습니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.
- **빠르게 시험하기**: 카드의 **Preview**를 클릭해 현재 설정으로 짧은 예시를 들어 보세요.

## 참고: 음악, 효과음, Gacha Forge

이 절은 고급 설정을 위한 내용입니다.

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

### 호환 오디오 서버로 Game 음악과 효과음 생성하기

1. **Connections**에서 **Music & Sound Effects**(음악 및 효과음) 계정을 **Edit model**(모델 편집)로 열고 **Custom compatible server**(사용자 지정 호환 서버)를 고르세요. **Add account** 창에는 이 계정 유형의 타일이 없습니다. 이런 계정은 업그레이드나 가져오기로 생깁니다([계정 안내](../connections/providers-reference.md#music--sound-effects) 참고).
2. 음악이나 효과음 서버의 주소, 키, 모델을 입력하세요.
3. **Generation API format**(생성 API 형식)을 설정하고 서버가 제공하는 엔드포인트 경로를 입력하세요. 경로를 비워 두면 해당 기능은 사용할 수 없습니다.
4. **Music generation**(음악 생성), **Sound-effect generation**(효과음 생성), 또는 둘 다 켜세요.
5. Game 설정 과정이나 게임의 오디오 설정에서 이 계정을 선택하세요. 음성 계정은 TTS 카드에서 따로 선택해 두세요.

엔드포인트 경로는 계정의 Base URL 뒤에 붙습니다. `http://localhost:8002/v1`이라면 `chat/completions`를 써야 `/v1/chat/completions`에 닿습니다. 로컬 HTTP 엔드포인트는 다른 로컬 호환 오디오 요청과 마찬가지로 `.env`에 `TTS_LOCAL_URLS_ENABLED=true`가 필요합니다.

지원하는 API 형식은 두 가지입니다.

- **Prompt JSON → MP3 audio**는 `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }`를 보내고 MP3 바이트를 받습니다. Game 음악은 컨텍스트 트랙의 길이(기본 120초)를 사용합니다. 효과음은 5초를 요청합니다.
- **Chat Completions → inline audio (ACE-Step compatible)**은 `model`, 사용자 `messages` 항목 하나, `stream: false`, 그리고 `duration`, `instrumental: true`, `format: "mp3"`가 들어간 `audio_config`를 보냅니다. `choices[0].message.audio`의 인라인 MP3를 받으며, 이 값은 base64 데이터 URL을 담은 ACE-Step 오디오 URL 배열이나 base64 `data`가 있는 객체입니다. [ACE-Step 호환 API 규약](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md)을 참고하세요. 원격 결과 URL과 비동기 작업 API는 지원하지 않습니다.

서버가 실제로 구현한 기능만 켜세요. OpenAI 호환 음성 엔드포인트가 있다고 해서 음악이나 효과음을 지원한다는 뜻은 아닙니다. Infermatic 같은 서비스는 이 형식 중 하나를 제공하거나 어댑터를 갖춰야 합니다. Infermatic의 실제 음악 엔드포인트는 여기서 검증하지 않았습니다. ElevenLabs나 SunoAPI의 네이티브 생성에는 **Music & Sound Effects** 아래의 해당 소스를 쓰세요. [계정 안내](../connections/providers-reference.md#music--sound-effects)를 참고하세요.

생성된 컨텍스트 음악은 영역이나 조우 단계마다 한 번 작곡된 뒤 재사용됩니다. 반복되는 효과음은 오디오 캐시를 사용합니다. 생성 오류가 나도 캐시는 재시도할 수 있도록 남습니다.

<a id="gacha-forge-dialogue-and-audio"></a>

### Gacha Forge 대화와 오디오

Gacha Forge 1.11.0 이상은 TTS 카드에서 선택한 계정과 그 계정의 캐릭터별 목소리 지정을 사용합니다. - **Read character dialogue**(캐릭터 대사 읽기)를 켜면 목소리가 지정된 가져온 캐릭터의 대사를 읽습니다. 이 옵션은 새 월드의 **Lore**(배경 설정) 설정 단계에 있고, 기존 월드라면 Gacha Forge 자체의 월드 설정에 있습니다. 내레이션, 생각, Engine 캐릭터 ID가 없는 생성 유닛, 목소리가 없는 캐릭터는 소리를 내지 않습니다. 이름만으로 다른 캐릭터의 목소리를 빌려 쓰는 일은 없습니다.
- 월드의 TTS 스위치가 켜져 있으면 선택한 Audio 계정을 쓸 수 있습니다. 카드 자체의 소스 설정을 바로 쓸 때는 **Use text to speech**도 켜져 있어야 합니다.
- 기본 제공 Game 음악과 효과음에는 생성 계정이 필요 없습니다. 새 트랙을 작곡하려면 Gacha Forge에서 **Generate music and sound effects**(음악과 효과음 생성)를 켜고 **Audio connection**(오디오 연결)에서 Music & Sound Effects 계정을 고르세요. 이 항목은 생성을 켜면 나타납니다. 홈, 전투, 보스, 스토리 장면, 캐릭터 스토리 트랙은 처음 필요할 때 생성된 뒤 재사용됩니다. 이 요청은 내 서비스 계정을 사용합니다.
- 오른쪽 위 음소거 버튼은 음악, 대사, 효과음을 함께 끕니다. Gacha Forge의 화면 설정에는 이 세 가지의 개별 음량 조절(0 포함)과 자동 재생 대기 시간(기본값 **3초**, 텍스트 표시와 음성 대사가 끝난 뒤 시작)이 있습니다. 선택지는 여전히 플레이어를 기다립니다. 장면을 떠나면 음성 대사가 취소됩니다. 월드를 떠나면 그 월드의 오디오가 멈춥니다.

이 조작을 쓰려면 Engine과 함께 설치된 Gacha Forge 패키지도 업데이트하세요.

## 관련 가이드

- [Conversation 음성 통화와 영상 통화](../conversation/calls.md)
- 2D와 3D 아바타를 위한 [음성 합성과 립싱크](../agents/avatars.md#lip-sync-with-text-to-speech)
- [Roleplay Mode: 시작하기](../roleplay/getting-started.md)
- [Game Mode: 시작하기](../game/getting-started.md)
- [지원하는 AI 제공자](../connections/providers-reference.md)
- [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
