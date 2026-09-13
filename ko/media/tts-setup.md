# Text to Speech(TTS) 설정

이 가이드에서는 Marinara Engine에서 Text to Speech(음성 합성)를 설정해 메시지와 게임 서술을 소리 내어 읽게 하는 방법을 설명합니다. Text to Speech(TTS)는 채팅에 적힌 글을 음성으로 바꿔 줍니다. 음성 제공자 고르기, 목소리 선택, 자동 재생, 메시지별 재생 조작을 차례로 다룹니다.

## TTS 설정이 있는 곳

TTS 설정은 거의 전부 한곳에 모여 있습니다. **Connections**(연결) 패널을 열고 **Text to Speech**(음성 합성) 카드를 찾으세요. 이 카드는 기본적으로 접혀 있으므로 헤더를 클릭해 펼치세요.

TTS 요청은 앱이 자체 서버를 거쳐 보냅니다. 제공자 API 키는 Marinara Engine이 서버에 암호화해서 저장합니다. 키를 저장하고 나면 입력란에는 실제 키 대신 점이 늘어선 가림 표시가 나타납니다. 실제 키는 브라우저로 다시 돌아오지 않습니다.

TTS를 켜기만 해서는 아무것도 말하지 않습니다. 각 메시지의 **Speak**(말하기) 버튼과 **Auto-play**(자동 재생) 항목이 나타날 뿐입니다. 무엇을 언제 읽을지는 직접 고릅니다.

같은 재생 설정에서 **Skip text inside HTML and custom tags**(HTML 및 사용자 정의 태그 안의 텍스트 건너뛰기), **Skip fenced code blocks**(구분자로 둘러싼 코드 블록 건너뛰기), **Skip text inside square brackets**(대괄호 안의 텍스트 건너뛰기)도 설정할 수 있습니다. 코드 블록은 기본적으로 건너뛰며, 나머지 두 필터는 처음에는 꺼져 있습니다. 태그 필터는 숨겨진 `<simulation>...</simulation>` 블록처럼 태그 안의 텍스트를 제거하지만, 음성 선택에 사용하는 화자 태그는 유지합니다. 이 필터는 수동 및 자동 재생에 모두 적용되며, Game 서술과 Roleplay 화자 추출에도 적용됩니다.

## 1단계: TTS 켜고 Source 고르기

1. **Connections** 패널을 열고 **Text to Speech** 카드를 펼치세요.
2. 카드 헤더의 스위치를 클릭해 TTS를 켜세요. 스위치에 마우스를 올리면 툴팁이 보입니다. 꺼져 있을 때는 **Enable TTS**(TTS 활성화), 켜져 있을 때는 **Disable TTS**(TTS 비활성화)입니다.
3. **Source**(연결 소스) 드롭다운을 열고 제공자를 고르세요.

**Source**는 실제로 음성을 만들어 주는 서비스입니다. 선택지는 4가지입니다.

- **OpenAI-compatible**: OpenAI, 또는 OpenAI의 TTS 형식을 그대로 따르는 서버입니다.
- **ElevenLabs**: ElevenLabs 음성 서비스입니다.
- **PocketTTS**: 직접 컴퓨터에서 돌리는 무료 음성 서버입니다.
- **xAI Voice**: xAI의 음성 서비스입니다.

기본 Source는 **OpenAI-compatible**입니다. Marinara는 Source마다 별도의 프로필을 저장하며, 암호화된 API 키, 엔드포인트, 모델, 목소리, 제공자 파라미터가 모두 여기에 들어갑니다. Source를 바꾸면 그 Source에서 쓰던 설정이 그대로 되살아납니다. 아직 설정한 적 없는 Source는 기본값에서 시작합니다.

## 2단계: Base URL, API Key, Model 입력하기

Source마다 웹 주소가 필요하고, 대부분은 API 키도 필요합니다. API 키는 제공자가 발급하는 비밀 문자열로, 그 요청이 본인의 것임을 증명합니다.

1. **Base URL**(기본 URL) 입력란을 확인하세요. Source마다 적절한 기본값이 들어가 있으며 아래 표와 같습니다. 프록시나 직접 띄운 서버를 쓸 때만 바꾸세요.
2. 제공자에게 받은 키를 **API Key**(API 키) 입력란에 붙여넣으세요. 기존 키를 그대로 두려면 가림 표시된 점을 건드리지 마세요. 저장된 키를 지우려면 입력란을 비우세요.
3. **Model**(모델) 입력란을 확인하세요. Source마다 기본 모델이 들어가 있습니다. 제공자가 지원하는 다른 모델 이름을 직접 입력해도 됩니다.

Source별 기본값은 다음과 같습니다.

| Source            | 기본 Base URL             | 기본 Model             | 앱이 미리 넣어 두는 기본 목소리 |
| ----------------- | ------------------------- | ---------------------- | ------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                           |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | 없음(직접 골라야 합니다)        |
| PocketTTS         | http://localhost:49112    | pocket-tts             | alba                            |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                             |

**ElevenLabs**를 쓰면 **Model** 입력란이 해당 연결로 쓸 수 있는 음성 합성용 모델을 불러오고, 목록을 열 때마다 전체 목록을 보여 줍니다. 일반 음성 합성 모델을 고르세요. 모델 ID에 `ttv`가 들어간 것은 목소리 디자인용 모델이라 글을 소리 내어 읽지 못합니다. 실수로 이런 모델을 고르면 재생이 실패하면서 음성 합성 모델을 쓰라는 오류가 표시됩니다.

### PocketTTS는 별도 프로그램입니다

PocketTTS는 Marinara Engine에 내장된 기능이 아닙니다. Marinara의 어댑터는 [PocketTTS OpenAI-compatible server](https://github.com/teddybear082/pocket-tts-openai_streaming_server)를 사용하며, 이 서버가 Marinara에 필요한 음성 합성 엔드포인트와 목소리 목록 엔드포인트를 모두 제공합니다. 해당 서버의 안내를 따라 직접 설치하고 실행하세요. Marinara가 대신 다운로드하거나 관리해 주지는 않습니다.

이 호환 서버는 기본적으로 `http://localhost:49112`를 사용합니다. 서버 포트를 바꾸지 않았다면 **Base URL**을 그 값 그대로 두세요. 이미 사용자 지정 PocketTTS 주소를 넣어 두었다면 그대로 유지됩니다.

## 3단계: 목소리 고르기(Voice Option)

**Voice Option**(음성 소스) 설정은 목소리를 배정하는 방식을 정합니다.

- **One voice for all characters**: 모든 화자가 같은 목소리를 씁니다. 기본값입니다.
- **Selected per character**: 원하는 캐릭터에게 각각 다른 목소리를 줍니다.

### 모든 캐릭터에 한 목소리

**All Characters Voice**(모든 캐릭터 음성) 입력란에서 목소리를 고르세요. PocketTTS는 서버가 돌려준 목소리를 드롭다운에 표시하고, 그 옆에 사용자 지정 목소리 ID, URL, 경로를 적을 수 있는 입력란을 함께 둡니다.

제공자에서 실제 목소리 목록을 불러오려면 연결 정보를 입력한 뒤 **Refresh voices**(음성 새로고침) 버튼(원형 화살표 아이콘)을 클릭하세요. 재생을 켜기 전에도 할 수 있습니다. 새로고침을 하면 현재 카드를 먼저 저장하므로 방금 입력한 API 키가 곧바로 적용됩니다. 연결하기 전에는 입력란이 비어 보이지 않도록 앱이 짧은 내장 대체 목록을 보여 줍니다. 제공자 쪽에서 오류가 나면 그 대체 목록을 성공한 것처럼 조용히 내보내지 않고 오류를 표시합니다.

**ElevenLabs**를 쓸 때는 목소리를 반드시 골라야 합니다. Marinara는 계정 라이브러리를 페이지 단위로 불러오며 개인, 워크스페이스, 저장된 목소리, 기본 목소리를 모두 포함합니다. 선택 창에는 검색란이 있고, 라이브러리가 패널보다 길면 스크롤 막대가 항상 보입니다. 목소리를 몇 개 불러왔는지도 함께 알려 줍니다. 선택 창은 "Select an ElevenLabs voice" 상태에서 시작하며, 실제 목소리를 고르기 전까지는 재생이 막힙니다.

### 캐릭터별로 지정

1. **Voice Option**을 **Selected per character**로 설정하세요.
2. **Character**(캐릭터) 열과 **Voice**(음성) 열로 이루어진 **Character Voices**(캐릭터 음성) 표가 나타납니다.
3. **Add character voice**(캐릭터 음성 추가)를 클릭해 행을 추가하세요.
4. 왼쪽 드롭다운에서 캐릭터를, 오른쪽 드롭다운에서 목소리를 고르세요.
5. 목소리를 따로 주고 싶은 캐릭터마다 같은 과정을 반복하세요.

Character Voices 상자의 **Refresh**(새로고침) 버튼은 한 목소리 모드로 되돌아가지 않고도 같은 제공자 라이브러리를 다시 불러옵니다. 캐릭터를 먼저 만들어 두어야 합니다. 아직 캐릭터가 하나도 없으면 목소리를 배정하기 전에 Characters 탭에서 캐릭터를 추가하라는 안내가 뜹니다. 개인 목소리가 없는 캐릭터는 전체 공용 목소리를 씁니다. [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)을 참고하세요.

## Narrator Voice

서술은 특정 캐릭터가 말하는 것이 아닌 글입니다. 장면 묘사나 게임 마스터(GM)의 대사가 여기에 해당합니다. 서술에는 별도의 목소리를 줄 수 있습니다.

1. **Narrator Voice**(나레이터 음성) 상자에서 **Use separate narrator voice**(별도 나레이터 음성 사용)를 켜세요.
2. 나타나는 선택 창에서 목소리를 고르세요.

앱은 어떤 줄의 화자가 Narrator, GM, Game Master, System일 때 이 목소리를 씁니다. Roleplay(롤플레이)와 Conversation(대화) 메시지에서 동작하며, 화자 이름이 없는 Game Mode(게임 모드) 서술 줄에도 적용됩니다. ElevenLabs를 쓴다면 여기서 서술용 목소리를 골라 두세요. 비워 두면 전체 공용 목소리가 설정되어 있을 때만 서술이 그 목소리로 대체됩니다.

## Random NPC Voices(Game Mode 전용)

이 기능은 비중이 작은 게임 캐릭터에게 남는 목소리를 나눠 줍니다. Game Mode에서만, 그리고 Game Mode가 추적하는 NPC(플레이어가 아닌 캐릭터)에만 동작합니다. Roleplay나 Conversation에서는 아무 영향이 없습니다.

1. **Random NPC Voices**(랜덤 NPC 음성) 상자에서 **Use default voices for random NPCs**(랜덤 NPC에 기본 음성 사용)를 켜세요.
2. **Male NPC defaults**(남성 NPC 기본값)와 **Female NPC defaults**(여성 NPC 기본값), 두 개의 체크박스 표가 나타납니다.
3. 각 묶음에서 쓸 목소리에 체크하세요.

개인 목소리가 없는 추적 대상 NPC는 해당 묶음에서 일정하게 정해진 목소리를 받습니다. 같은 NPC는 한 세션 동안 같은 목소리를 유지합니다. 캐릭터 목소리가 배정된 NPC는 언제나 그 목소리를 그대로 씁니다. 앱이 남성, 여성으로 표시된 목소리를 구분하지 못하면 각 묶음은 전체 목소리 목록을 사용합니다.

## Audio Format과 Speed

**Audio Format**(오디오 포맷) 설정에서는 **MP3**(기본값)와 **WAV** 중 하나를 고릅니다. MP3를 만들지 못하는 로컬 서버나 직접 띄운 서버라면 WAV를 쓰세요. 두 가지 유의할 점이 있습니다.

- ElevenLabs에서는 **Audio Format** 컨트롤이 숨겨집니다. 항상 MP3를 쓰기 때문입니다.
- xAI Voice에서는 컨트롤이 보이지만 아무 효과가 없습니다. xAI Voice는 항상 MP3를 돌려줍니다.

**Speed**(속도) 슬라이더는 말하는 속도를 조절합니다. 조절 가능한 범위는 Source에 따라 다릅니다.

- OpenAI-compatible과 PocketTTS: 보통 속도의 0.25배에서 4.0배까지.
- ElevenLabs: 0.7배에서 1.2배까지.
- xAI Voice: 0.7배에서 1.5배까지.

저장된 속도가 현재 Source의 범위를 벗어나면 앱이 말할 때 허용 범위 안의 가장 가까운 값으로 맞춥니다.

**ElevenLabs**에서만 컨트롤 두 개가 더 나타납니다. **Language**(언어)로 말하는 언어를 지정하거나 **Auto detect** 상태로 둘 수 있습니다. **Stability**는 표현이 풍부한 쪽과 일관된 쪽 사이를 조절합니다.

## Auto-play: 메시지 자동으로 읽기

**Auto-play** 제목 아래의 토글은 각각 한 종류의 새 메시지를 생성이 끝나는 대로 읽게 합니다. 모두 **Enable TTS**가 먼저 켜져 있어야 합니다. 토글은 전부 꺼진 상태로 시작합니다.

- **Roleplay messages**(롤플레이 메시지): 새로 온 Roleplay 답변을 읽습니다.
- **Conversation messages**(대화 메시지): 새로 온 Conversation Mode 답변을 읽습니다.
- **Game narration**(게임 나레이션): 새로 온 Game Mode 서술과 전투 줄을 읽습니다.
- **Progressive playback**(점진적 재생): 답변이 여러 줄일 때 전체가 끝나기를 기다리지 않고 첫 줄부터 바로 재생합니다.
- **Only read dialogues**(대사만): 따옴표나 태그로 표시된 대사만 읽고 일반 서술은 건너뜁니다.

자동 재생은 가장 최근 답변이 완성되는 순간 한 번만 동작합니다. 채팅을 다시 열거나 위로 올려 봐도 지난 메시지를 다시 읽지는 않습니다.

## 메시지 하나만 읽기

TTS를 켜면 캐릭터 메시지와 서술 메시지 아래 도구 모음에 **Speak** 버튼(마이크 아이콘)이 나타납니다. 이 버튼은 필요할 때 그 메시지 하나만 읽어 줍니다.

- **Speak**를 클릭하면 메시지를 읽습니다. 음성을 받아 오는 동안에는 버튼이 로딩 상태로 표시됩니다.
- 재생 중에 다시 클릭하면 멈춥니다. 재생 중에는 툴팁이 **Stop speaking**(말하기 중지)으로 바뀝니다.
- 읽을 글이 없는 메시지(예를 들어 이미지만 있는 메시지)에는 **No dialogue to speak**가 표시되고 버튼이 비활성화됩니다.

메시지를 읽는 동안에는 버튼 두 개가 더 나타납니다. **Pause speaking**(말하기 일시 중지)과 **Resume speaking**(말하기 재개)으로 재생을 멈췄다가 이어서 재생할 수 있고, **Restart speaking**(말하기 다시 시작)은 처음부터 다시 읽습니다.

스피커 아이콘 버튼을 누르면 **Line volume**(대사 음량) 슬라이더가 열리며 범위는 0에서 100퍼센트, 기본값은 50입니다. 이 음량은 별도로 저장되는 설정입니다. Game Mode 믹서, Conversation 통화 음량과는 따로 동작하므로 하나를 바꿔도 나머지는 바뀌지 않습니다.

## 캐시된 클립

앱은 생성한 음성을 브라우저에 저장해 같은 줄을 두 번 만들지 않게 합니다. **Cached clips**(캐시된 클립) 패널에서 현재 개수와 전체 용량을 실시간으로 확인할 수 있습니다.

**Export cached TTS clips**(캐시된 TTS 클립 내보내기) 버튼(다운로드 아이콘)을 클릭하면 저장된 음성을 각각 별도의 오디오 파일로 기기에 다운로드합니다. 오래된 것부터 알아서 정리되며, 앱 안에는 직접 비우는 버튼이 없습니다. 전부 지우고 싶다면 브라우저 데이터를 삭제하세요.

## 채팅 모드별 TTS

같은 TTS 설정이 모든 모드에 그대로 적용되고, 모드마다 몇 가지가 더 붙습니다.

- Roleplay는 **Roleplay messages** 자동 재생 토글과 메시지별 **Speak** 조작을 사용합니다. [Roleplay Mode: 시작하기](../roleplay/getting-started.md)를 참고하세요.
- Conversation Mode는 **Conversation messages** 토글과 같은 **Speak** 조작을 사용합니다. 음성 통화는 더 큰 기능이며 [Conversation 음성 통화와 영상 통화](../conversation/calls.md)에서 다룹니다.
- Game Mode는 **Game narration** 토글을 사용합니다. Game Mode에는 자체 오디오 믹서도 있어 **Master**, **Music**(음악), **Sound Effects**, **Ambient** 옆에 **TTS** 채널이 있습니다. 이 채널은 게임 음성 전체의 음량을 정하며 100퍼센트에서 시작합니다. [Game Mode: 시작하기](../game/getting-started.md)를 참고하세요.

## Phonetic name(통화 중 발음)

캐릭터나 페르소나 이름의 철자 때문에 목소리가 발음을 틀리게 읽는다면 **Phonetic name**(발음 표기 이름)을 지정할 수 있습니다. **Character Editor**에서는 캐릭터의 **Name** 입력란 옆에 있고, **Persona Editor**에서는 다른 기본 정보 입력란과 함께 있습니다. 이름이 어떻게 들려야 하는지 적으세요.

이 설정은 Conversation 음성 통화와 영상 통화에서만 쓰입니다. 메시지별 **Speak** 버튼, 채팅 자동 재생, Game Mode 서술은 이 필드를 읽지 않습니다.

## 문제 해결

- 아무 소리도 나지 않을 때: 먼저 **Enable TTS** 스위치가 켜져 있는지 확인하세요. 그다음 해당 모드의 **Auto-play** 토글을 확인하거나 메시지별 **Speak** 버튼을 쓰세요. **Speak** 버튼과 자동 재생 항목은 TTS를 켠 뒤에만 나타납니다.
- 드롭다운에 목소리가 없을 때: TTS를 켜고 올바른 API 키를 넣은 상태로 카드를 저장한 다음 **Refresh voices**를 클릭하세요. PocketTTS라면 호환 서버에서 `<Base URL>/v1/voices`가 응답하는지도 확인하세요.
- ElevenLabs가 말하지 않을 때: "Select an ElevenLabs voice" 자리표시자가 아니라 실제 목소리를 골랐는지 확인하세요. **Model**이 ID에 `ttv`가 들어간 목소리 디자인 모델이 아니라 음성 합성 모델인지도 확인하세요.
- 로컬 주소의 자체 TTS 서버가 차단될 때: 서버 설정 `TTS_LOCAL_URLS_ENABLED`를 켜세요. 이 설정을 켜면 앱이 OpenAI-compatible 방식이나 ElevenLabs 방식 서버의 로컬 주소, 사설 주소에 접근할 수 있습니다. PocketTTS에는 이 설정이 필요 없습니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.
- 설정을 빠르게 시험해 보려면: 카드의 **Preview**(미리 듣기) 버튼을 클릭해 현재 설정으로 짧은 예시 문장을 재생해 보세요.

## 관련 가이드

- [Conversation 음성 통화와 영상 통화](../conversation/calls.md)
- [Roleplay Mode: 시작하기](../roleplay/getting-started.md)
- [Game Mode: 시작하기](../game/getting-started.md)
- [지원하는 AI 제공자](../connections/providers-reference.md)
- [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
