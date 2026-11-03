# Conversation 음성 통화와 영상 통화

이 가이드에서는 통화를 설명합니다. 통화는 음성 채팅 앱처럼 마이크나 타이핑으로 캐릭터 한 명 이상과 이야기하는 실시간 화면입니다. 통화하는 동안 일반 Conversation 채팅 위에 겹쳐 표시됩니다. 통화는 Conversation Mode에서만 쓸 수 있습니다.

Calls는 선택 사항인 패키지입니다. **Agents**(에이전트) → **Agent Organizer**에서 **Calls**를 설치하세요. 카탈로그가 다시 시작하라고 하면 Marinara를 중지했다가 평소에 시작하던 방식으로 다시 시작하세요([설치](../INSTALLATION.md) 참고).

통화 중에는 Text to Speech(TTS, 글을 음성으로 바꾸는 기능) 음성이 제대로 설정된 캐릭터가 소리 내어 말합니다. 음성이 없는 캐릭터는 통화 채팅에 입력한 메시지로 답합니다. 정지된 아바타 대신 캐릭터의 AI 생성 반복 영상 클립을 표시할 수도 있습니다.

Marinara는 브라우저에서 마이크나 카메라를 녹음합니다. 입력 모드(아래 참고)에 따라 내 음성은 내 컴퓨터에서 텍스트로 바뀌거나, 채팅에 고른 모델로 전송됩니다. 응답은 TTS 서비스로 소리 내어 읽습니다. 통화가 끝나면 짧은 요약이 Conversation에 돌아옵니다. 전체 기록은 별도의 통화 저장소에 남습니다.

## 필요한 것

- 설치된 **Calls**.
- 캐릭터가 한 명 이상 있는 Conversation 채팅과 응답을 쓰는 모델의 계정.
- 채팅 설정에서 켠 **Audio/Video Calls**와 **Call Audio Pipeline**.
- 선택 사항: 캐릭터가 말하게 하려면 Text to Speech 계정. 없으면 캐릭터는 텍스트로 답합니다.
- 선택 사항: 기본 마이크 모드는 Local Whisper를 한 번 다운로드해야 합니다([Local Whisper 다운로드](#download-local-whisper) 참고). 대신 통화 채팅에 입력해도 됩니다.

## 첫 통화 설정하기

**시작하기 전에:** 캐릭터가 한 명 이상 있는 Conversation 채팅과 응답을 쓰는 모델의 계정이 필요합니다([AI 제공자에 연결하기](../connections/connecting-to-a-provider.md) 참고).

1. 선택 사항: Text to Speech를 설정하세요([Text to Speech 설정](#set-up-text-to-speech) 참고). 설정하지 않으면 모든 캐릭터가 텍스트로만 참여합니다.
2. 채팅을 연 다음 **Chat Settings**(채팅 설정) → **Agents** → **Calls**를 여세요.
3. **Audio/Video Calls**를 켜세요. 대화 이름 옆에 통화 버튼이 나타납니다.
4. **Call Audio Pipeline**을 켜세요. 입력만 하거나 듣기만 하더라도 이 설정이 없으면 통화를 시작할 수 없습니다. 마이크도 이 설정이 켭니다.
5. **Audio input mode**를 고르세요(아래 참고).
6. **Start call**을 클릭하세요.

작동하지 않는 경우: "Conversation call audio is not enabled in Chat Settings"가 보이면 **Call Audio Pipeline**이 꺼져 있는 것입니다. 이 설정은 전역 설정이므로 한 채팅에서 켜면 모든 Conversation 통화에서 켜집니다.

새 채팅이라면 먼저 설정 마법사를 마친 다음 그 채팅의 **Chat Settings**를 여세요. Calls 설정은 Calls가 설치되어 있을 때만 표시됩니다.

비슷해 보이지만 하는 일이 다른 스위치가 두 가지 있습니다.

- **Audio/Video Calls**는 통화 버튼을 표시하므로 캐릭터에게 전화를 걸 수 있습니다.
- **Calls** 명령은 캐릭터가 먼저 전화를 걸 수 있게 합니다. 이 명령이 꺼져 있어도 직접 통화를 시작할 수 있습니다.

같은 섹션의 마스터 **Commands**(명령어) 스위치는 통화 중 명령을 쓰려면 켜져 있어야 합니다. 통화 자체는 꺼져 있어도 시작할 수 있습니다.

<a id="set-up-text-to-speech"></a>

### Text to Speech 설정하기

Text to Speech는 어떤 캐릭터가 어떤 음성으로 말할 수 있는지 정합니다. 전체 안내는 [Text to Speech(TTS) 설정](../media/tts-setup.md)을 읽으세요. 간단히 말하면 **Connections**(연결)를 열고 **Add account**를 클릭한 다음 **Text to speech**를 고르세요. **On this device** 아래에 이미 있으면 그곳에서 여세요. 그다음 이렇게 하세요.

1. Text to Speech를 켜세요.
2. 소스를 고르세요. **OpenAI-compatible**, **ElevenLabs**, **PocketTTS**, **xAI Voice** 중 하나입니다.
3. 그 소스의 API 키나 로컬 서버 주소를 입력하세요.
4. 모델과 음성을 고르세요.
5. **Voice option**(음성 소스)을 **One voice for all**(모든 캐릭터에 하나의 음성 사용)이나 **Selected per character or persona**(캐릭터 개별 음성)로 정하세요. 캐릭터별 음성을 쓰면 그룹 통화에서 누가 말하는지 따라가기 쉽습니다.
6. 저장한 다음 미리듣기 버튼으로 소리가 나는지 확인하세요.

Marinara가 찾을 수 있는 음성이 없는 캐릭터는 이번 통화에서 텍스트로만 참여합니다.

### Audio input mode 고르기

**Call Audio Pipeline**이 켜져 있으면 **Audio input mode** 목록이 나타납니다. 잘 모르겠다면 기본값을 그대로 두세요.

| 모드 | 하는 일 |
| --- | --- |
| **Mic recording + Local Whisper**(기본값) | 음소거를 해제한 동안 녹음하고, 무음은 무시하며, 내 음성을 내 컴퓨터에서 텍스트로 바꿉니다. Firefox에 가장 적합합니다. |
| **Browser speech recognition** | 브라우저에 내장된 음성 도구를 씁니다. 지원 여부는 브라우저마다 다릅니다. 지원하지 않으면 Marinara가 Local Whisper로 대신합니다. |
| **Manual system dictation** | 통화 텍스트 상자에 커서만 두어 운영 체제의 받아쓰기로 입력할 수 있게 합니다. Marinara는 녹음하지 않습니다. |
| **Provider-native audio/video** | 모델이 미디어를 받는다면 녹음한 오디오나 영상을 모델에 바로 보냅니다. |

카메라와 화면 버튼은 **Camera and screen input**이 켜져 있어야 하며 **Provider-native audio/video** 모드에서만 작동합니다. 다른 모드에서는 버튼이 보이지만 비활성화됩니다.

## 통화 시작, 받기, 끝내기

**통화 시작하기.** 통화를 켜면 대화 이름 옆에 전화기 버튼이 있습니다. 툴팁은 **Start call**이고, 통화가 진행 중이면 **Open call**입니다. 클릭하면 통화 화면이 열립니다. 채팅 하나에서 활성 상태이거나 울리는 통화는 하나뿐입니다. 다른 통화를 시작하면 현재 통화가 다시 열립니다.

**통화 받기.** **Calls** 명령이 켜져 있으면 캐릭터가 전화를 걸 수 있습니다. 그 채팅에서는 메시지 입력란 위에 **Decline call**(통화 거절)과 **Answer call**(통화 받기)이 있는 **Incoming call** 배너가 나타납니다. Marinara의 다른 곳에서는 수신 전화 알림과 짧은 벨소리가 나옵니다. Marinara가 대신 받는 일은 절대 없습니다. 참여할 수 있는 캐릭터만 들어옵니다. 스케줄이나 상태가 오프라인인 캐릭터는 들어오지 않습니다.

**통화 끝내기.** 통화 화면이나 최소화된 팝아웃의 빨간 **End call** 버튼을 클릭하세요. 캐릭터가 통화 중 명령으로 나가거나 통화를 끝낼 수도 있습니다. 그러면 Marinara가 녹음을 멈추고 Conversation에 카드를 추가합니다.

## 통화 화면

무대에는 참가자마다 타일이 하나씩 표시됩니다. 내 페르소나와 참여할 수 있는 각 캐릭터이며, 말하는 사람이 강조됩니다. 통화 채팅에는 입력한 메시지와 텍스트로만 한 응답이 들어갑니다. 소리 내어 말한 대사는 여기에 반복해서 나오지 않습니다. 데스크톱에서는 옆 패널입니다. 휴대폰에서는 **Open call chat**으로 서랍이 열리고 **Close call chat**으로 닫힙니다.

통화 입력란에는 **Message in call** 상자, **Send**(전송), 이모지, GIF, 스티커 선택기, 빠른 모델 전환기가 있습니다. 통화 채팅에서는 파일 첨부를 지원하지 않습니다.

| 컨트롤 | 하는 일 |
| --- | --- |
| 마이크 | 음소거하거나 음소거를 해제합니다. 툴팁은 모드에 따라 바뀌며, 예를 들어 **Unmute microphone with Local Whisper**입니다. |
| **Turn camera on** / **Turn camera off** | **Camera and screen input**이 켜진 Provider-native audio/video 모드에서만 쓸 수 있습니다. |
| **Share screen** / **Stop sharing screen** | 카메라와 같은 규칙입니다. |
| **Character volume** | 음소거 버튼과 0에서 100까지의 슬라이더입니다. 기본값은 100이며 브라우저에 저장됩니다. |
| **Soundboard** | **Upload** 컨트롤이 있는 소리 목록입니다. |
| **End call** | 빨간 끊기 버튼입니다. |

한동안 음소거 상태로 있으면 "You are muted! Remember to unmute yourself first if you want to talk."가 표시됩니다.

통화 중에 Conversation을 벗어나면 채팅 이름, 경과 시간, **End call**이 있는 떠 있는 팝아웃으로 줄어듭니다. 팝아웃을 클릭하면 돌아옵니다. 다른 곳을 둘러보는 동안에도 통화는 계속됩니다.

### Soundboard

사운드보드에는 지울 수 없는 기본 소리가 4개 있습니다. **Soft Chime**, **Tap**, **Sparkle**, **Pop**입니다. **Upload**를 클릭하면 내 소리를 추가할 수 있습니다(mp3, wav, ogg, webm, m4a, 각각 8 MB까지). 직접 올린 소리는 지울 수 있습니다. 캐릭터는 사운드보드 명령으로 소리를 재생할 수 있습니다.

## Character Video Presence

이 부분은 선택 사항이며 고급 기능입니다. **Character video presence**는 정지된 아바타 타일을 캐릭터의 AI 생성 반복 클립으로 바꿉니다. 기본값은 꺼짐입니다. 이 스위치는 **Chat Settings** → **Agents** → **Calls**에 있습니다.

**시작하기 전에:** **Connections**에서 Video Generation 계정을 추가하고, 하나를 **Default for Videos**로 지정하거나 매번 고르세요.

1. 캐릭터 편집기나 페르소나 편집기를 여세요.
2. **Sprites**(스프라이트) 탭을 연 다음 **Clips** 하위 탭을 여세요.
3. **Generate Clips**(클립 생성)를 클릭하세요. 직접 만든 클립을 추가하려면 **Upload extra**(추가 업로드)를 클릭하세요.
4. **Generate Call Clips**(통화 클립 생성) 창에서 **Video Generation Connection**을 고르고 **Use avatar as reference**(아바타를 참조로 사용)를 선택하세요.
5. 만들 표준 클립을 고르세요. **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, **Sighing**입니다. **Clip name**(영상 이름)과 동작 설명으로 사용자 지정 클립 하나를 직접 정의할 수도 있습니다.

소리 내어 말하는 차례에 Marinara는 `[sighs]` 같은 대사 속 음성 신호를 읽고, 어울리는 반응 클립을 고른 다음 Idle로 돌아갑니다. 클립이 없어도 통화는 막히지 않으며, 그 캐릭터는 정지된 아바타로 표시됩니다. 잘라 낸 클립은 잘라 낸 범위 안에서 반복됩니다. [캐릭터 스프라이트(표정과 전신)](../characters/sprites.md)를 참고하세요.

**Character video presence**를 켜면 스위치가 두 개 더 나타납니다.

- **Automatic video clips generation**(기본값은 꺼짐)은 필요한 참가자에게 **Idle**과 **Talking**만 만듭니다. 반응 클립과 사용자 지정 클립은 자동으로 만들지 않습니다.
- **Custom clips**(기본값은 꺼짐)는 캐릭터가 실시간 통화에서 일회성 클립을 드물게 요청하고, 준비된 사용자 지정 클립을 다시 재생하게 합니다. 모든 기분이 아니라 특별한 요청을 위한 기능입니다.

**Character video presence**를 끄면 이 둘도 함께 꺼집니다. 여기의 클립은 재사용하는 반복 영상이며, 장면 영상을 담는 갤러리 **Videos**와는 다릅니다.

## 음성 인식 설정(고급)

**Mic recording + Local Whisper** 모드를 쓰거나 직접 운영하는 음성 인식 서버를 쓰려는 경우에만 필요합니다.

<a id="download-local-whisper"></a>

### Local Whisper 다운로드

Local Whisper는 Marinara를 실행하는 컴퓨터에서 내 음성을 텍스트로 바꾸므로, 변환을 위해 마이크 오디오가 그 컴퓨터를 떠나지 않습니다. 변환된 텍스트는 통화의 일부로 여전히 내 모델에 전송됩니다. 음성 인식 지원이 약한 Firefox 같은 브라우저에서 가장 안정적인 마이크 방식입니다.

**시작하기 전에:** Calls를 설치하세요. 설치하지 않으면 이 섹션이 숨겨집니다.

1. **Connections**를 열고 **On this device** 아래에서 **Speech to text**를 찾으세요. 목록에 없으면 **Add account**를 클릭하고 **Speech to text**를 고르세요.
2. 그 페이지에서 **Local speech model**을 찾으세요.
3. 모델을 고르세요.
   - **Whisper Tiny (Multilingual)**: 다운로드 약 180 MB, 메모리 350 MB. 휴대폰과 오래된 컴퓨터에 가장 적합합니다.
   - **Whisper Base (Multilingual)**: 다운로드 약 320 MB, 메모리 650 MB. 알아듣기 힘든 음성에 더 낫습니다.
4. **Download Whisper**를 클릭하고 진행 막대가 끝날 때까지 기다리세요.
5. Calls를 쓰기 전에 Marinara를 완전히 다시 시작하세요.

휴지통 아이콘 **Delete Local Whisper**는 모델을 지웁니다. Calls를 제거하면 다운로드한 Whisper 모델도 함께 지워집니다. 다시 설치해도 직접 고르기 전에는 모델을 다시 다운로드하지 않습니다.

작동하지 않는 경우: Marinara Lite 빌드에서는 "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model."가 표시됩니다. "native ONNX runtime"에 관한 메시지가 보이면 내 플랫폼용 음성 엔진이 없는 것입니다. Marinara를 실행하는 것과 같은 Node 빌드로 의존성을 다시 설치한 다음 다시 시작하세요.

<a id="use-your-own-speech-to-text-server"></a>

### 직접 운영하는 음성 인식 서버 사용하기

Local Whisper가 내 언어나 억양을 잘 알아듣지 못하면 음성을 다른 음성 인식 서버로 보내세요. OpenAI 음성 인식 형식(`/audio/transcriptions` 주소)을 받는 서버라면 직접 운영하든 OpenAI나 Groq 같은 서비스를 쓰든 상관없이 작동합니다.

1. **Connections**를 열고 **On this device** 아래의 **Speech to text**를 여세요. 목록에 없으면 **Add account**를 클릭하고 **Speech to text**를 고르세요. Calls를 설치하지 않으면 숨겨져 있습니다.
2. **Server URL**(서버 URL)을 입력하세요. 예를 들면 `http://localhost:8000/v1`입니다.
3. 서버가 요구하면 **API key**(API 키)를 입력하세요. 암호화해서 저장하며 가려진 채로 표시됩니다.
4. 서버가 쓰는 **Model**(모델) 이름을 입력하세요. 비워 두면 `whisper-1`을 보냅니다.
5. 선택 사항: `pl`이나 `de` 같은 **Language**(언어) 코드를 입력하세요. 비워 두면 서버가 감지합니다.
6. **Test**(테스트)를 클릭하세요. Marinara가 1초짜리 무음 클립을 보냅니다. "The server answered." 또는 "The test failed."가 표시됩니다.
7. **Use your own speech-to-text server**(직접 운영하는 음성 인식 서버 사용)를 켜세요.

이 설정이 켜져 있는 동안 **Mic recording + Local Whisper**는 내 음성을 이 서버로 보내며, Local Whisper를 다운로드할 필요가 없습니다. 내 오디오가 그 서버로 가므로 믿을 수 있는 서버를 쓰세요.

같은 컴퓨터에 있는 서버는 그대로 작동합니다. 네트워크의 다른 컴퓨터에 있는 서버는 `.env`에 `STT_LOCAL_URLS_ENABLED=true`를 설정하지 않으면 거부됩니다([서버 설정 참고 문서](../CONFIGURATION.md) 참고).

작동하지 않는 경우: **Test** 아래의 메시지를 읽으세요. "Could not reach the speech-to-text server"는 주소가 잘못되었거나 서버가 꺼져 있다는 뜻입니다. `STT_LOCAL_URLS_ENABLED`가 들어 있는 메시지는 서버가 다른 컴퓨터에 있다는 뜻입니다. 숫자는 내 서버가 보낸 것입니다. 401은 보통 API 키가 틀렸다는 뜻이고, 404는 주소나 모델 이름이 틀렸다는 뜻입니다. 통화가 계속 Local Whisper를 쓴다면 **Agents** → **Agent Organizer**에서 Calls를 업데이트하세요.

## 설정과 기본값

**채팅별** 설정은 채팅 하나에 적용됩니다. **전역** 설정은 모든 Conversation 통화에 적용됩니다.

| 설정 | 범위 | 기본값 |
| --- | --- | --- |
| **Audio/Video Calls** | 채팅별 | 꺼짐 |
| **Calls**(명령) | 채팅별 | 켜짐 |
| **Generate voice cues in [tags]** | 채팅별 | 켜짐 |
| **Call Audio Pipeline** | 전역 | 꺼짐 |
| **Audio input mode** | 전역 | Mic recording + Local Whisper |
| **Camera and screen input** | 전역 | 꺼짐 |
| **Character video presence** | 전역 | 꺼짐 |
| **Automatic video clips generation** | 전역 | 꺼짐 |
| **Custom clips** | 전역 | 꺼짐 |

한 채팅에서 바꾼 전역 설정은 모든 Conversation 통화에서 바뀝니다. **Generate voice cues in [tags]**는 모델에게 소리 내어 말하는 대사 안에 `[whispering]`, `[laughing]`, `[sighs]` 같은 짧은 신호를 넣게 합니다. 이 신호는 TTS가 대사를 읽는 방식을 바꾸고 반응 클립을 고르는 데 도움이 됩니다. 대사를 꾸밈없이 두려면 끄세요.

## 통화 중 명령

캐릭터는 통화에서도 일반 메시지와 같은 숨은 명령을 씁니다. 명령마다 **Chat Settings** → **Agents** → **Commands**에서 해당 스위치가 켜져 있어야 하고, 마스터 **Commands** 스위치도 켜져 있어야 합니다. [캐릭터가 쓸 수 있는 Commands 고르기](getting-started.md#choose-which-commands-a-character-can-use)를 참고하세요. 명령은 조용히 실행되며 소리 내어 읽지 않습니다.

통화에서만 쓰는 명령이 둘 더 있습니다. **Soundboard**(캐릭터가 사운드보드 소리를 재생)와 나가기 또는 끝내기(캐릭터가 통화에서 나가거나 모두를 위해 통화를 끝냄)입니다. **Notes**와 **Influence**는 채팅에 연결된 채팅이 있을 때만 나타납니다([Conversation을 Roleplay나 Game에 연결하기](../chats/connected-chats.md) 참고). 셀카에는 **Selfie model**(셀카 연결)이 필요합니다([셀카](selfies.md) 참고). 일부 명령은 이미지가 있는 "sent a selfie" 같은 작은 항목을 통화 채팅에 추가합니다.

## 통화 종료 요약

통화가 끝나면 Conversation에 카드가 나타납니다. 제목은 **Call Started**, **Incoming Call**, **Call Ended**(통화 시간 포함), **Call Declined**, **Missed Call** 중 하나입니다. **Call Ended** 뒤에 의미 있는 일이 있었다면 Marinara가 백그라운드에서 짧은 요약을 쓰고, 모델이 읽을 수 있는 숨은 컨텍스트로 추가합니다. 덕분에 통화 내용을 보이는 채팅에 복사하지 않고도 모델이 통화를 알 수 있습니다.

## 문제 해결

| 증상 | 해결 방법 |
| --- | --- |
| 캐릭터가 내 말을 듣지 못합니다 | **Call Audio Pipeline**이 켜져 있는지, 브라우저가 Marinara 페이지의 마이크를 허용하는지 확인하세요. Firefox이거나 브라우저 음성 인식이 작동하지 않으면 Local Whisper를 다운로드해 **Mic recording + Local Whisper**를 쓰세요. |
| 브라우저 음성 옵션이 아무 일도 하지 않습니다 | Firefox에는 Chromium과 Safari 브라우저에 있는 Web Speech 인식이 없습니다. **Mic recording + Local Whisper**나 **Manual system dictation**을 쓰세요. |
| 캐릭터가 말하지 않고 글자로 입력합니다 | Text to Speech 설정과 음성 지정을 확인하세요. [Text to Speech(TTS) 설정](../media/tts-setup.md)을 참고하세요. |
| 모델이 내 말을 잘못 이해합니다 | **Whisper Base (Multilingual)**을 써 보거나, 잡음을 줄이거나, 모델이 지원한다면 **Provider-native audio/video**를 쓰세요. Whisper가 잘 처리하지 못하는 언어라면 [직접 운영하는 음성 인식 서버를 사용](#use-your-own-speech-to-text-server)하고 그 서버의 **Language**를 설정하세요. |
| 카메라나 화면 버튼이 비활성화되어 있습니다 | **Provider-native audio/video** 모드를 쓰고 **Camera and screen input**을 켜세요. 모델도 카메라나 화면 입력을 받아야 합니다. |
| 캐릭터가 통화 도중 응답을 멈춥니다 | 채팅의 모델 계정을 확인한 다음 통화 채팅에서 메시지를 다시 보내세요. |
| 휴대폰에서 통화가 작동하지 않습니다 | 통화 채팅은 **Open call chat**으로 열립니다. 음성은 TTS가 설정되어 있는지 확인하세요. 마이크는 같은 Local Whisper 및 권한 단계가 적용됩니다. |

## 관련 가이드

- [Text to Speech(TTS) 설정](../media/tts-setup.md)
- [내장 모델 설정](../connections/local-model.md)
- [캐릭터 스프라이트(표정과 전신)](../characters/sprites.md)
- [Conversation Mode: 시작하기](getting-started.md)
