# Conversation 음성 통화와 영상 통화

이 가이드에서는 Marinara Engine의 Conversation 통화를 설명합니다. 통화가 어떻게 동작하는지, 어떻게 설정하는지, 통화 중에 어떻게 이야기하는지, 자주 생기는 문제를 어떻게 해결하는지 알 수 있습니다.

통화는 Conversation 모드에만 있습니다. Roleplay와 Game 채팅에는 통화 화면이 없습니다.

Calls는 선택 설치하는 에이전트 패키지입니다. 아래 설정을 따라가기 전에 **Agents → Download Agents**(에이전트 → 에이전트 다운로드)에서 **Calls**를 설치하고, 카탈로그가 요청하면 Marinara를 재시작하세요.

## 통화란

통화를 시작하면 Discord와 비슷한 실시간 화면이 열리고, 그 안에서 캐릭터 한 명 또는 여러 명과 이야기합니다. 통화가 진행되는 동안 이 화면은 평소의 Conversation 채팅 위에 겹쳐서 표시됩니다.

통화 중에는 다음과 같이 동작합니다.

- **Text to Speech**(음성 합성, TTS) 음성이 제대로 설정된 캐릭터는 대사를 소리 내어 말합니다. TTS는 글을 소리로 바꿔 주는 기능입니다.
- 음성이 없는 캐릭터는 통화 채팅에 글로 답합니다.
- 대답은 마이크로 하거나 직접 입력해서 합니다.
- 원한다면 정지된 아바타 대신 AI가 생성한 캐릭터 동영상 클립이 반복 재생되게 할 수 있습니다.

통화는 상대방과 직접 연결되는 전화가 아닙니다. Marinara는 이 컴퓨터의 브라우저 마이크나 카메라로 입력을 녹음합니다. 그리고 그 입력을 해당 Conversation에 선택해 둔 모델로 보냅니다. 답변은 TTS 제공자를 통해 소리로 내보내고, 통화 데이터는 사용 중인 컴퓨터에 저장합니다.

통화가 끝나면 Marinara가 음성 통화의 짧은 요약을 평소의 Conversation에 남깁니다. 통화 전체 기록은 별도의 통화 저장소에 남고, 메시지 하나하나가 본 채팅으로 복사되지는 않습니다.

## 시작하기 전에

음성 통화가 제대로 동작하게 하려면 아래 항목을 순서대로 준비하세요. 선택 사항으로 표시한 단계는 건너뛰어도 됩니다.

1. 캐릭터가 한 명 이상 있는 Conversation 모드 채팅.
2. 그 채팅에 선택해 둔 일반 모델 연결. 통화 중에 캐릭터의 답변을 쓰는 모델입니다.
3. 그 채팅에서 켜 둔 **Audio/Video Calls**(아래 "채팅에서 통화 켜기" 절 참고).
4. 켜 둔 **Call Audio Pipeline**(통화 오디오 파이프라인). 글만 입력하거나 듣기만 하는 통화라도 이 설정이 있어야 통화를 시작할 수 있습니다. 마이크 입력도 이 설정으로 켜집니다.
5. 캐릭터가 말할 수 있도록 설정한 Text to Speech. 설정하지 않으면 모든 캐릭터가 글로만 참여합니다.
6. 선택 사항: 브라우저의 음성 인식이 불안정하다면 Calls를 설치한 뒤 **Connections**(연결)에서 다운로드하는 Local Whisper가 필요합니다(Firefox가 여기에 해당합니다). Local Whisper 대신 원하는 음성 인식 서버를 써도 됩니다.
7. 선택 사항: **Character Video Presence**(캐릭터 동영상 표시)를 쓰려면 동영상 연결과 미리 만들어 둔 클립이 필요합니다.
8. 선택 사항: 통화 중에 캐릭터가 셀카를 보내게 하려면 채팅의 **Selfie Connection**(셀카 연결)으로 지정한 이미지 연결이 필요합니다.

### Text to Speech 설정하기

Text to Speech는 어떤 캐릭터가 말할 수 있는지, 각 캐릭터가 어떤 음성을 쓰는지를 정합니다. 여러 기능이 함께 쓰는 설정이라 별도 가이드에서 다룹니다.

전체 절차는 [Text to Speech(TTS) 설정](../media/tts-setup.md)에서 확인하세요. 간단히 정리하면 **Connections**를 열고 **Text to Speech**로 이동한 다음, 아래 순서를 따릅니다.

1. Text to Speech를 켜세요.
2. 소스를 고르세요. **OpenAI-compatible**, **ElevenLabs**, **PocketTTS**, **xAI Voice** 중 하나입니다.
3. 그 소스의 제공자 키나 로컬 서버 주소를 입력하세요.
4. 모델과 음성을 고르세요.
5. **Voice Option**(음성 소스)을 **One voice for all characters** 또는 **Selected per character**로 설정하세요.
6. 저장한 뒤 미리 듣기 버튼으로 소리가 들리는지 확인하세요.

여러 명이 참여하는 통화에서는 캐릭터마다 음성을 따로 지정해 두면 누가 말하는지 훨씬 알아보기 쉽습니다. Marinara가 찾을 수 있는 음성이 없는 캐릭터는 그 통화에서 글로만 답합니다.

### 마이크 입력 모드 고르기

**Call Audio Pipeline**이 켜져 있으면 선택지가 4가지인 **Audio input mode**(음성 입력 모드) 드롭다운이 나타납니다. 브라우저와 제공자에 맞는 것을 고르세요.

- **Mic recording + Local Whisper**: 음소거를 해제한 동안 녹음하고, 조용한 구간은 넘기며, 말한 내용을 이 컴퓨터에서 글로 바꿉니다. 기본값이고 Firefox에 가장 잘 맞습니다.
- **Browser speech recognition**: 브라우저의 Web Speech 기능을 씁니다. Web Speech API는 말을 글로 바꿔 주는 브라우저 내장 기능입니다. 지원 여부는 브라우저마다 다르고, 지원하지 않으면 Marinara가 Local Whisper로 대신 처리합니다.
- **Manual system dictation**: 통화 입력란에 커서만 놓아 주어서 운영체제의 받아쓰기 기능이 그 자리에 입력하게 합니다. 이 모드에서는 Marinara가 직접 마이크를 녹음하지 않습니다.
- **Provider-native audio/video**: 모델이 미디어를 직접 받을 수 있을 때, 녹음한 음성이나 영상을 Conversation 모델로 그대로 보냅니다. 모델이 지원하지 않으면 Local Whisper나 브라우저 음성 인식을 쓰세요.

카메라 버튼과 화면 공유 버튼은 **Camera and screen input**(카메라 및 화면 입력)이 켜져 있을 때만 나타납니다. 두 버튼은 **Provider-native audio/video** 모드에서만 동작합니다. 다른 모드에서는 버튼이 보이기는 하지만 비활성 상태입니다.

### Local Whisper 다운로드

Local Whisper는 Marinara가 실행 중인 컴퓨터에서 말을 글로 바꿉니다. 마이크 음성은 변환을 위해 그 컴퓨터 밖으로 나가지 않습니다. 다만 변환된 글은 통화의 일부로 Conversation 모델에 전송됩니다.

Local Whisper는 Calls 패키지에 딸린 기능이며, Firefox처럼 음성 인식 지원이 약한 브라우저에서 가장 안정적인 마이크 입력 방식입니다. Calls를 설치한 뒤 **Connections**를 열고 **Local Model**을 연 다음, 카드를 펼쳐 **Local Speech Model**(로컬 음성 모델)을 찾으세요. Calls를 설치하지 않으면 이 항목은 보이지 않습니다. Local Model 카드 전반은 [Local Model 설정](../connections/local-model.md)에서 확인하세요.

1. 모델을 고르세요. 기본값은 **Whisper Tiny (Multilingual)**입니다. 다운로드 용량은 약 180 MB이고, 실행 중에는 메모리를 약 350 MB 씁니다. 휴대폰이나 오래된 컴퓨터에서는 이 모델부터 쓰는 것이 좋습니다.
2. 발음이 뭉개지는 상황에서 정확도를 높이려면 **Whisper Base (Multilingual)**을 고르세요. 다운로드 용량은 약 320 MB, 메모리 사용량은 약 650 MB입니다.
3. **Download Whisper**(Whisper 다운로드)를 클릭하세요.
4. 진행 막대가 끝날 때까지 기다리세요.

다운로드가 끝나면 모델을 지울 수 있도록 **Delete Local Whisper**(로컬 Whisper 삭제) 버튼(휴지통 아이콘)이 나타납니다.

Calls를 제거하면 다운로드한 Whisper 모델과 저장해 둔 선택 값도 함께 삭제됩니다. 모델이 쓰던 디스크 공간은 이때 회수됩니다. Calls를 다시 설치하면 다운로드 버튼이 돌아오지만, 모델을 다시 고르기 전까지 자동으로 다운로드하지는 않습니다.

<a id="use-your-own-speech-to-text-server"></a>

### 원하는 음성 인식 서버 사용하기

Local Whisper가 내 언어나 억양을 잘 알아듣지 못한다면, 녹음한 음성을 다른 음성 인식 모델로 보낼 수 있습니다. OpenAI 방식의 `/audio/transcriptions` 엔드포인트를 제공하는 서버라면 어디든 쓸 수 있습니다. Speaches, faster-whisper 서버, LocalAI, whisper.cpp 서버(`--inference-path /v1/audio/transcriptions`로 시작한 경우) 같은 자체 호스팅 서버와 OpenAI, Groq 같은 제공자가 여기에 해당합니다.

1. Calls를 설치한 다음 **Connections**를 열고 **Speech to Text**(음성 인식) 카드를 찾으세요. Calls를 설치하지 않으면 이 카드는 보이지 않습니다.
2. 카드를 펼치고 **Server URL**(서버 URL)을 입력하세요. 예를 들어 내 컴퓨터에서 실행하는 서버라면 `http://localhost:8000/v1`처럼 입력합니다.
3. 서버나 제공자가 키를 요구하면 **API key**(API 키)를 입력하세요. 키는 암호화되어 저장되고, 카드에는 가려진 형태로만 표시됩니다.
4. 서버가 사용하는 **Model**(모델) 이름을 입력하세요. 비워 두면 `whisper-1`을 보냅니다.
5. 선택 사항: `pl`이나 `de` 같은 **Language**(언어) 코드를 입력하세요. 모델에 언어를 알려 주면 대개 정확도가 올라갑니다. 비워 두면 서버가 언어를 자동으로 감지합니다.
6. **Test**(테스트)를 클릭하세요. Marinara가 1초 길이의 무음 클립을 보내고, 서버가 응답했는지 알려 줍니다.
7. 카드의 스위치를 켜세요.

스위치가 켜져 있는 동안에는 **Mic recording + Local Whisper**가 말한 내용을 Local Whisper 대신 이 서버로 보냅니다. 이때는 Local Whisper를 다운로드하지 않아도 됩니다. 스위치를 끄면 다시 Local Whisper를 사용합니다. 음성은 입력한 서버로 전송되므로 신뢰할 수 있는 서버를 쓰세요.

Marinara와 같은 컴퓨터에 있는 서버는 그대로 동작합니다. 집 네트워크의 다른 컴퓨터에 있는 서버는 서버 `.env` 파일에 `STT_LOCAL_URLS_ENABLED=true`를 설정하지 않으면 거부됩니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

이 기능을 지원하는 Calls 버전이 필요합니다. 스위치를 켠 뒤에도 통화가 계속 Local Whisper를 쓴다면 **Agents → Download Agents**에서 Calls를 업데이트하세요.

## 채팅에서 통화 켜기

통화는 새 Conversation을 만들 때 켤 수도 있고, 나중에 채팅 설정에서 켤 수도 있습니다.

새 Conversation이라면 설정 마법사를 먼저 끝낸 다음, 그 채팅의 설정을 열고 아래와 같은 순서를 따르세요. 선택 설치 패키지의 설정은 Calls를 설치한 뒤에만 표시됩니다.

이미 있는 Conversation이라면 다음과 같이 하세요.

1. 채팅을 여세요.
2. **Chat Settings**(채팅 설정)를 여세요.
3. **Agents**(에이전트) 섹션으로 이동하세요.
4. **Calls**를 여세요.
5. **Audio/Video Calls**를 켜세요. 그러면 채팅 이름 옆에 통화 버튼이 나타납니다.
6. **Call Audio Pipeline**을 켜세요. 마이크를 전혀 쓰지 않더라도 이 설정 없이는 통화를 시작할 수 없습니다.
7. **Audio input mode**를 고르세요.

**Audio/Video Calls**와 **Calls** 명령어는 서로 다른 설정입니다. **Audio/Video Calls**는 통화 버튼을 표시해서 캐릭터에게 전화를 걸 수 있게 합니다. **Calls** 명령어는 캐릭터가 먼저 전화를 걸어오게 합니다. **Calls**를 끄면 직접 통화를 시작하는 것은 그대로 되지만, 캐릭터가 먼저 전화를 걸어오지는 않습니다.

명령어를 제공하는 패키지를 설치하면 **Agents** 섹션에 전체 **Commands** 토글도 함께 나타납니다. 통화 중 숨은 명령어가 동작하려면 이 토글이 켜져 있어야 합니다. 꺼져 있어도 통화 자체는 시작할 수 있습니다.

### 설정과 기본값

통화 설정은 대부분 **Chat Settings** → **Agents** → **Calls**에 있습니다. 일부는 전역 설정입니다. 즉, 한 채팅에서 바꾸면 앱의 모든 Conversation 통화에 함께 적용됩니다.

| 설정 | 적용 범위 | 기본값 |
|---|---|---|
| **Audio/Video Calls** | 채팅별 | Off |
| **Calls**(명령어) | 채팅별 | On |
| **Generate voice cues in [tags]** | 채팅별 | On |
| **Call Audio Pipeline** | 전역 | Off |
| **Audio input mode** | 전역 | Mic recording + Local Whisper |
| **Camera and screen input** | 전역 | Off |
| **Character video presence** | 전역 | Off |
| **Automatic video clips generation** | 전역 | Off |
| **Custom clips** | 전역 | Off |

**Generate voice cues in [tags]**를 켜면 모델이 대사 안에 `[whispering]`, `[laughing]`, `[sighs]` 같은 짧은 대괄호 신호를 넣습니다. 이 신호는 TTS가 대사를 읽는 방식을 바꾸고, 반응 동영상 클립을 고르는 데도 쓰입니다. 기본값은 켜짐입니다. 대사를 있는 그대로 두려면 끄세요.

## 통화 시작, 수신, 종료

### 통화 시작하기

채팅에서 통화를 켜면 채팅 이름 옆에 전화기 버튼이 나타납니다. 진행 중인 통화가 없으면 툴팁에 **Start call**이, 이미 통화 중이면 **Open call**이 표시됩니다.

**Start call**을 클릭하세요. 전체 통화 화면이 곧바로 열립니다.

한 채팅에서 진행 중이거나 벨이 울리는 통화는 하나뿐입니다. 이미 통화가 진행 중일 때 통화를 시작하면 Marinara는 새 통화를 만들지 않고 기존 통화를 다시 엽니다.

### 캐릭터가 걸어오는 통화

**Calls** 명령어가 켜져 있으면 캐릭터가 먼저 전화를 걸어올 수 있습니다. 그 채팅을 보고 있을 때 전화가 오면 메시지 입력란 위에 **Incoming call** 배너가 나타납니다. 배너에는 **Decline call**(통화 거절) 버튼과 **Answer call**(통화 받기) 버튼이 있습니다.

Marinara의 다른 화면을 보고 있으면 캐릭터의 자율 메시지 알림과 비슷한 수신 알림이 뜹니다. 짧은 벨소리도 울립니다. Marinara가 대신 전화를 받는 일은 없으므로 **Answer call**을 직접 클릭해야 합니다.

통화에는 지금 응답할 수 있는 캐릭터만 참여합니다. 스케줄이나 상태 때문에 오프라인으로 표시된 캐릭터는 그 채팅에 속해 있어도 통화에 들어오지 않습니다.

### 통화 종료하기

통화는 빨간색 **End call** 버튼으로 언제든지 끊을 수 있습니다. 이 버튼은 통화 화면과 작게 줄인 팝아웃 창 양쪽에 있습니다. 캐릭터도 통화 중 명령어로 통화에서 나가거나 통화를 끝낼 수 있습니다.

통화가 끝나면 Marinara는 녹음을 멈추고 미디어를 안전하게 정리한 뒤, 평소의 Conversation에 카드를 하나 추가합니다.

## 통화 화면과 조작 버튼

통화 화면에는 참가자마다 타일이 하나씩 표시되며, 여기에는 페르소나와 참여 가능한 캐릭터가 모두 들어갑니다. 지금 말하고 있는 참가자는 강조해서 보여 줍니다.

통화 채팅에는 입력한 메시지와 글로만 답하는 캐릭터의 답변이 쌓입니다. 데스크톱에서는 옆쪽 패널에 있고, 모바일에서는 **Open call chat** 버튼 안에 숨어 있습니다. 채팅은 화면을 덮는 패널로 열리며, **Close call chat**으로 닫습니다. 소리로 나온 대사는 음성으로만 쓰이고, 따로 말풍선으로 다시 표시되지는 않습니다.

통화 입력 영역에는 **Message in call** 입력란과 **Send**(전송) 버튼이 있습니다. 이모지, GIF, 스티커 선택기와 연결을 빠르게 바꾸는 메뉴도 함께 있습니다. 통화 채팅에서 파일 첨부는 아직 지원하지 않습니다.

통화 화면 아래쪽 조작 막대에는 아이콘 버튼이 있습니다.

- 마이크: 음소거를 켜고 끕니다. 툴팁은 입력 모드에 따라 달라집니다. 예를 들면 **Unmute microphone with Local Whisper**입니다.
- **Turn camera on**과 **Turn camera off**: **Camera and screen input**이 켜진 **Provider-native audio/video** 모드에서만 활성화됩니다.
- **Share screen**과 **Stop sharing screen**: 카메라와 조건이 같습니다.
- **Character volume**: 음소거 버튼과 0에서 100까지의 볼륨 슬라이더가 있는 작은 창을 엽니다. 기본값은 100퍼센트이고, 설정한 값은 브라우저에 저장됩니다.
- **Soundboard**: **Upload**(업로드) 버튼이 함께 있는 소리 목록을 엽니다.
- **End call**: 빨간색 통화 종료 버튼입니다.

음소거 상태가 한동안 이어지면 "You are muted! Remember to unmute yourself first if you want to talk." 알림이 나타납니다.

통화 중에 Conversation을 벗어나면 통화가 작은 팝아웃 창으로 줄어듭니다. 이 창에는 채팅 이름, 통화 경과 시간, 빨간색 **End call** 버튼이 표시됩니다. 창 본체를 클릭하면 전체 통화 화면으로 돌아갑니다. 다른 패널을 둘러보는 동안에도 Marinara는 통화를 계속 유지합니다.

### 사운드보드

사운드보드는 통화 중에 재생할 수 있는 작은 소리 모음입니다. 기본으로 **Soft Chime**, **Tap**, **Sparkle**, **Pop** 4가지 소리가 들어 있습니다. 기본 제공 소리는 삭제할 수 없습니다.

**Upload** 버튼으로 직접 만든 소리를 올릴 수도 있습니다. 지원 형식은 mp3, wav, ogg, webm, m4a이고 파일당 최대 8 MB입니다. 직접 올린 소리에는 삭제 버튼이 있습니다. 캐릭터도 사운드보드 명령어로 소리를 재생할 수 있습니다.

## Character Video Presence와 통화 동영상 클립

**Character Video Presence**를 켜면 정지된 아바타 타일 대신 AI가 생성한 캐릭터 동영상 클립이 반복 재생됩니다. 기본값은 꺼짐입니다. 토글 이름은 **Character video presence**이고 **Chat Settings** → **Agents** → **Calls**에 있습니다.

통화 동영상 클립은 다음과 같이 준비합니다.

1. **Settings**(설정) → **Connections**에서 Video Generation 연결을 만드세요.
2. 연결 하나를 **Default for Videos**로 지정하거나, 생성할 때마다 동영상 연결을 직접 고르세요.
3. 캐릭터나 페르소나 편집기를 여세요.
4. **Sprites**(스프라이트) 탭을 열고 **Clips** 하위 탭으로 이동하세요.
5. **Generate Clips**(클립 생성)나 **Upload extra**(추가 업로드)로 필요한 클립을 추가하세요.

스프라이트와 편집기에 대한 자세한 내용은 [캐릭터 스프라이트(표정과 전신)](../characters/sprites.md)에서 확인하세요.

**Generate Clips** 버튼을 누르면 **Generate Call Clips**(통화 클립 생성) 창이 열립니다. 이 창에서 **Video Generation Connection**(비디오 생성 연결)을 고르고 **Use avatar as reference**(아바타를 참조로 사용)를 선택합니다. 그다음 기본 클립 중에서 만들 것을 고릅니다. **Clip name**(영상 이름)과 동작 설명을 적어 사용자 지정 클립을 하나 정의할 수도 있습니다.

기본 클립은 **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, **Sighing** 6가지입니다. 캐릭터가 말하는 동안 Marinara는 대사 안의 `[sighs]`, `[laughs]` 같은 음성 신호를 읽습니다. 그리고 어울리는 반응 클립을 고른 뒤, 캐릭터를 다시 Idle 상태로 되돌립니다.

**Character video presence**를 켜면 그 아래에 토글 2개가 더 나타납니다.

- **Automatic video clips generation**: 기본값은 꺼짐입니다. 켜면 클립이 필요한 통화 참가자에 한해 Marinara가 기본 클립 **Idle**과 **Talking** 2개만 자동으로 생성합니다. 반응 클립과 사용자 지정 클립은 자동으로 생성되지 않습니다. 이 클립들은 **Clips** 하위 탭에서 직접 만들어야 합니다.
- **Custom clips**: 기본값은 꺼짐입니다. 켜면 캐릭터가 통화 중에 아주 가끔 일회성 클립을 요청할 수 있고, 만들어진 사용자 지정 클립을 나중에 다시 재생할 수도 있습니다. 특별한 연출을 요청할 때 쓰는 기능이지 감정이나 대사마다 쓰는 기능은 아닙니다.

클립이 없어도 통화가 막히지는 않습니다. 클립이 준비될 때까지 캐릭터는 정지된 아바타로 표시됩니다. 클립을 잘라 두면 지정한 구간 안에서 반복 재생됩니다.

**Character video presence**를 끄면 **Automatic video clips generation**과 **Custom clips**도 함께 꺼집니다.

통화 동영상 클립은 **Gallery**(갤러리)의 **Videos**(동영상)와 다릅니다. Gallery의 Videos에는 Roleplay, Game, Conversation 채팅에서 만든 장면 동영상이 들어갑니다. **Clips** 하위 탭에는 여기서 설명한 반복 재생용 클립이 들어갑니다.

## 통화 중 숨은 명령어

캐릭터는 평소 Conversation 메시지에서 쓰던 대괄호 숨은 명령어를 통화 중에도 그대로 쓸 수 있습니다. 명령어마다 **Chat Settings → Agents**에 있는 해당 토글이 켜져 있어야 하고, 그 섹션의 전체 **Commands** 토글도 켜져 있어야 합니다. 이 명령어들은 조용히 실행되며, 소리로 읽히거나 본문에 그대로 표시되지 않습니다.

- **Selfies**(셀카): 캐릭터가 사진을 생성해서 통화 채팅에 보냅니다. 채팅에 **Selfie Connection**이 지정되어 있어야 합니다. [셀카](selfies.md)를 참고하세요.
- **Memories**: 캐릭터가 통화 내용을 바탕으로 다른 캐릭터에 대한 기억을 저장합니다.
- **Music**(음악): 음악 소스가 연결되어 있으면 캐릭터가 Music Player로 노래를 재생합니다.
- **Haptics**: 기기가 연결되어 있으면 캐릭터가 친밀한 장면에서 연결된 햅틱 기기를 작동합니다.
- **Reactions**: 캐릭터가 통화 채팅에 마지막으로 입력한 메시지에 이모지로 반응합니다.
- **Cross-Post**: 캐릭터가 지금 이야기하던 주제를 함께 쓰는 다른 Conversation 채팅으로 옮깁니다.
- **Schedule Updates**: 캐릭터가 자기 상태(온라인, 자리 비움, 방해 금지, 오프라인)와 활동을 한동안 스스로 바꾼 뒤 다시 스케줄로 돌아갑니다. [캐릭터 스케줄과 자율 메시지](schedules.md#characters-can-change-their-own-status)를 참고하세요.
- **Notes**(메모)와 **Influence**: 오래 남는 메모나 한 번만 작동하는 유도 문구를 저장합니다. 채팅에 연결된 채팅이 설정되어 있을 때만 나타납니다.
- **Soundboard**: 캐릭터가 통화 사운드보드의 소리 하나를 재생합니다.
- 나가기와 종료: 캐릭터가 혼자 통화에서 나가거나, 모두의 통화를 끝낼 수 있습니다.

일부 명령어는 통화 채팅에 작은 시스템 항목을 남깁니다. 예를 들어 셀카는 이미지와 함께 "sent a selfie" 항목을 표시하고, 사용자 지정 클립은 렌더링이 끝날 때까지 자리 표시자를 보여 줍니다.

## 통화 종료 요약

통화가 끝나면 Marinara가 평소의 Conversation 기록에 카드를 하나 추가합니다. 카드에는 통화 상태가 표시되며, 제목은 다음 중 하나입니다.

- **Call Started**
- **Incoming Call**
- **Call Ended**(통화 시간 함께 표시)
- **Call Declined**
- **Missed Call**

**Call Ended** 카드가 남은 뒤, 기록할 만한 내용이 있었다면 Marinara가 백그라운드에서 짧은 음성 통화 요약을 만듭니다. 그리고 그 요약을 모델이 읽을 수 있는 숨은 컨텍스트로 Conversation에 추가합니다. 덕분에 통화 전체를 눈에 보이는 채팅에 복사하지 않고도 모델이 오간 내용을 알 수 있습니다.

자세한 통화 기록은 별도의 통화 저장소에 남습니다. 평소 채팅으로 돌아오는 것은 짧은 요약뿐입니다.

## 문제 해결

### 통화 오디오가 켜져 있지 않다며 통화가 시작되지 않을 때

**Start call**을 클릭했을 때 "Conversation call audio is not enabled in Chat Settings"라고 나오면 **Call Audio Pipeline**을 켜세요. **Chat Settings** → **Agents** → **Calls**를 열어 켜면 됩니다. 이 설정은 글만 입력하는 통화를 포함해 모든 통화에 필요합니다. 전역 설정이라 한 채팅에서 켜면 모든 Conversation 통화에 적용됩니다.

### 캐릭터 목소리는 들리는데 내 말은 전달되지 않을 때

**Chat Settings** → **Agents** → **Calls**를 열어 **Call Audio Pipeline**이 켜져 있는지 확인하세요. 그다음 브라우저가 Marinara 페이지에 마이크 사용 권한을 허용했는지 확인하세요.

Firefox를 쓰고 있거나 브라우저 음성 인식이 동작하지 않으면 Calls를 설치하고 Local Whisper를 다운로드하세요. **Connections** → **Local Model** → **Local Speech Model** 순서로 열면 됩니다. 그다음 **Mic recording + Local Whisper**를 고르세요.

### Local Whisper를 쓸 수 없다고 표시될 때

Local Whisper는 사용 중인 플랫폼에 맞는 네이티브 ONNX 런타임이 있어야 동작합니다. ONNX는 로컬 음성 모델을 실행하는 엔진입니다. 다른 Node 빌드에 맞춰 설치된 상태라면, Marinara를 실행할 때 쓰는 Node 빌드로 의존성을 다시 설치한 뒤 재시작하세요.

Marinara의 "Lite" 빌드를 쓰고 있다면 그 빌드에서는 Local Whisper가 꺼져 있습니다. 앱에는 "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model."라고 표시됩니다. Local Whisper를 쓰려면 전체 설치본을 사용하세요.

### 브라우저 음성 인식이 아무 반응도 없을 때

브라우저 음성 인식은 브라우저의 지원 여부에 따라 달라집니다. Firefox는 Chromium이나 Safari 계열 브라우저와 같은 Web Speech 음성 인식을 제공하지 않습니다. 손을 쓰지 않고 말을 받아 적으려면 **Mic recording + Local Whisper**를, 운영체제의 받아쓰기로 입력하려면 **Manual system dictation**을 쓰세요.

### 캐릭터가 말하지 않고 글로만 답할 때

Text to Speech 설정과 음성 지정을 확인하세요. 캐릭터에게는 전체 공통 음성이나 캐릭터별 음성 중 하나가 있어야 하고, 그 음성을 TTS 제공자가 찾을 수 있어야 합니다. [Text to Speech(TTS) 설정](../media/tts-setup.md)을 참고하세요.

### 모델이 말을 잘못 알아들을 때

정확도를 높이려면 Whisper Tiny 대신 **Whisper Base (Multilingual)**을 써 보세요. 주변 소음과 음악도 줄이세요. 모델이 지원한다면 **Audio input mode**를 **Provider-native audio/video**로 바꿔 모델이 음성을 직접 듣게 하세요. Whisper가 잘 처리하지 못하는 언어라면 그 언어를 아는 모델로 [원하는 음성 인식 서버를 사용](#use-your-own-speech-to-text-server)하고, 그 서버의 **Language** 코드를 설정하세요.

### Speech to Text 테스트가 실패할 때

**Test** 버튼 아래의 메시지를 읽어 보세요. "Could not reach the speech-to-text server"는 주소가 틀렸거나 서버가 실행 중이 아니라는 뜻입니다. `STT_LOCAL_URLS_ENABLED`를 언급하는 메시지는 서버가 네트워크의 다른 컴퓨터에 있다는 뜻이므로, `.env`에서 이 변수를 `true`로 설정하세요. 401이나 404 같은 숫자는 서버가 보낸 것입니다. 401은 대개 API 키가 틀렸다는 뜻이고, 404는 주소나 모델 이름이 틀렸다는 뜻입니다.

### 카메라 버튼이나 화면 공유 버튼이 비활성 상태일 때

이 버튼들은 **Camera and screen input**이 켜진 **Provider-native audio/video** 모드에서만 동작합니다. **Audio input mode**를 바꾸고 **Camera and screen input**을 켠 다음 다시 시도하세요. 또한 모델이 실제로 카메라나 화면 입력을 처리할 수 있어야 이 버튼이 의미가 있습니다.

### 휴대폰에서 통화가 되지 않을 때

모바일에서는 **Open call chat** 버튼으로 통화 채팅을 열고 **Close call chat**으로 닫습니다. 캐릭터가 말하지 않으면 Text to Speech 설정을 확인하세요. 모바일의 마이크 문제에도 위에서 설명한 Local Whisper와 권한 확인 절차가 그대로 적용됩니다.

### 통화 도중에 캐릭터가 답을 멈췄을 때

캐릭터는 그 채팅에 선택해 둔 모델 연결이 정상일 때만 답합니다. 답이 멈추면 해당 연결을 확인한 뒤, 통화 채팅에서 메시지를 다시 보내 보세요.

## 관련 가이드

- [Text to Speech(TTS) 설정](../media/tts-setup.md)
- [Local Model 설정](../connections/local-model.md)
- [캐릭터 스프라이트(표정과 전신)](../characters/sprites.md)
- [Conversation Mode: 시작하기](getting-started.md)
