# 내장 모델 설정

**Built-in model**(내장 모델)은 Marinara가 다운로드해 내 컴퓨터에서 직접 실행하는 작은 AI 모델입니다. API 키도 온라인 계정도 필요 없으며, 아무것도 컴퓨터 밖으로 나가지 않습니다.

작은 모델이라서 뒤에서 돌아가는 보조 작업에 알맞습니다. 트래커 에이전트(이야기의 세부 사항을 추적하는 보조 에이전트), Game Mode(게임 모드)의 장면 효과, 로어북 임베딩, 판정이 여기에 해당합니다. 좋은 롤플레이나 Professor Mari의 편집을 맡기기에는 너무 약합니다. 그런 작업에는 더 강력한 계정을 쓰세요. [AI 제공자에 연결하기](connecting-to-a-provider.md)를 참고하세요.

**Built-in model** 카드가 보이지 않는다면 "Lite" 설치본을 쓰고 있는 것입니다. Lite 설치본은 로컬 런타임을 뺀 경량 빌드입니다.

## 내장 모델 다운로드하기

시작하기 전에 모델을 담을 디스크 여유 공간과 메모리(RAM)가 충분한지 확인하세요. 필요한 크기는 아래 표에 있습니다.

1. 상단 바에서 **Connections**(연결)를 클릭하세요.
2. **Jobs**(작업) 상자 아래에서 **Built-in model** 카드를 찾으세요. 카드에는 **Not downloaded**(다운로드되지 않음)가 표시됩니다.
3. 카드를 클릭하거나 카드의 **Download**(다운로드) 버튼을 클릭하세요. **Built-in model**이라는 제목의 창이 열립니다.
4. **Which model?**(어떤 모델을 쓸까요?) 아래에서 모델을 고르세요. **Gemma 4 E2B — Q8 (Best Quality)**에는 **Recommended**(권장) 표시가 붙어 있습니다. 컴퓨터의 메모리가 적다면 **Q4_K_M**을 고르세요. 이 모델은 RAM이 5.4 GB 대신 약 3.4 GB만 필요합니다.
5. 아래쪽의 **Download** 버튼을 클릭하세요. 버튼에는 **Download 5.0 GB**(5.0 GB 다운로드)처럼 모델 크기가 표시됩니다.
6. 기다리세요. 창에는 **Install runtime**(런타임 설치), **Download model**(모델 다운로드), **Start and test**(시작 및 테스트)의 세 단계가 표시됩니다. 런타임은 모델을 실행하는 프로그램입니다. 런타임이 없으면 Marinara가 먼저 설치합니다.
7. 창에 초록색 점과 함께 모델 이름이 표시되면 **Test**(테스트)를 클릭하세요. **Local test message**(로컬 테스트 메시지)라는 제목의 상자에 **Succeeded**(성공)가 표시되고, 답변에 걸린 시간도 함께 나옵니다.
8. **Done**(완료)을 클릭하세요.

이제 카드에 **Ready**(준비됨)가 표시되고, 모델 크기와 그 모델이 맡은 작업도 함께 나옵니다.

작동하지 않는 경우:

- **Sidecar runtime install is disabled**라는 오류 메시지가 나옵니다. 런타임 설치는 보호된 작업입니다. [런타임 설치 허용하기](#allow-runtime-installs)를 참고하세요.
- **Local runtime failed to start**(로컬 런타임을 시작하지 못함). [문제 해결](#troubleshooting)을 참고하세요.
- **Download failed**(다운로드 실패). 창에 오류가 표시됩니다. 인터넷 연결과 디스크 여유 공간을 확인한 다음 다운로드 버튼을 다시 클릭하세요.

**Connections** 패널의 **Add**(추가)를 클릭하고 **Add account**(계정 추가) 창의 **Built-in model** 항목에서도 이 창을 열 수 있습니다.

### 엄선된 프리셋

창에는 Google의 작은 모델인 Gemma 4 E2B의 미리 준비된 프리셋 2가지가 있습니다. Apple Silicon 컴퓨터에서는 GGUF 파일 대신 MLX 버전이 제공됩니다. GGUF와 MLX는 로컬 모델에 쓰이는 두 가지 파일 형식입니다. 아래 크기는 창에 표시되는 값입니다(단위는 GB이며, 1 GB는 1024 × 1024 × 1024바이트입니다).

| 프리셋 | 다운로드 | 실행 중 RAM |
| --- | --- | --- |
| Q8 (Best Quality) | 5.0 GB | 5.4 GB |
| Q4_K_M (Smaller, Faster) | 3.0 GB | 3.4 GB |

Apple Silicon에서는 대신 MLX 프리셋 2가지가 표시됩니다.

| 프리셋 | 다운로드 | 실행 중 RAM |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5.5 GB | 7.0 GB |
| 4-bit MLX (Smaller, Faster) | 3.4 GB | 4.5 GB |

Marinara는 디스크에 내장 모델을 한 번에 하나만 보관합니다. 다른 모델을 고르면 기존 모델이 새 모델로 바뀝니다. 나중에 바꾸려면 카드를 열고 **Built-in model** 창에서 **Change model**(모델 변경)을 클릭하세요. 카드의 페이지에서는 **Model**(모델) 옆의 버튼으로 프리셋을 바꿀 수 있으며, 바꾸기 전에 다운로드 크기를 확인하라고 묻습니다.

### 직접 고른 모델 사용하기

**Your own model**(내 모델)에서는 Hugging Face(공개 모델 공유 사이트)의 GGUF 모델이나 Marinara를 실행하는 컴퓨터에 있는 파일을 사용할 수 있습니다.

1. **Your own model**을 클릭한 다음 **Hugging Face** 탭이나 **File on the server**(서버의 파일) 탭을 고르세요.
2. **Hugging Face**에서는 저장소 이름을 `owner/repo` 형식으로 입력한 다음 **Find files**(파일 찾기)를 클릭하세요. 목록에서 파일을 하나 고르세요.
3. **File on the server**에서는 `.gguf` 파일의 전체 경로를 입력하세요. Marinara는 파일을 복사하지 않고 원래 있는 자리에서 그대로 사용합니다.
4. 아래쪽의 버튼을 클릭하세요. **Download**를 클릭하거나, 서버의 파일이라면 **Use this file**(이 파일 사용)을 클릭하세요.

Apple Silicon에서는 **Find files**가 **Validate repo**(레포 확인)로 표시되며, 저장소가 MLX 네이티브여야 합니다. 서버의 GGUF 파일은 Apple Silicon에서도 쓸 수 있으며, MLX 대신 llama.cpp로 실행됩니다.

## 보조 작업에 내장 모델 사용하기

다운로드가 끝나면 **Built-in model** 카드를 여세요. 카드의 페이지에는 상태, 메모리 사용량, **Used by**(사용처)가 표시되며, 다음 컨트롤이 있습니다.

| 컨트롤 | 역할 |
| --- | --- |
| **Use for tracker agents (roleplay)**(트래커 에이전트에 사용, 롤플레이) | 트래커 에이전트를 위해 모델을 계속 실행해 둡니다. 기본값은 꺼짐입니다. |
| **Use for game scene analysis**(게임 장면 분석에 사용) | 배경, 음악, 날씨 같은 Game Mode 장면 효과를 위해 모델을 계속 실행해 둡니다. 기본값은 켜짐입니다. |
| **Use the built-in model for all tracker agents**(모든 트래커 에이전트에 내장 모델 사용) | 기본 제공 트래커 에이전트가 모두 이 모델을 쓰도록 지정합니다. 에이전트를 켜 주지는 않습니다. |
| **Change in Defaults**(기본값에서 변경) | 다른 작업도 맡길 수 있는 **Jobs** 상자를 엽니다. |

두 스위치가 모두 꺼져 있으면 모델은 저절로 시작되지 않습니다. 둘 중 하나를 켜거나, 채팅이나 작업이 모델을 쓸 때 시작됩니다. 에이전트를 켜는 방법은 [Memory Recall과 채팅 요약](../agents/memory.md)을 참고하세요.

Game Mode 설정에서는 **Scene effects model**(장면 효과 연결)로 내장 모델을 쓸 수 있습니다. [Game Mode: 시작하기](../game/getting-started.md)를 참고하세요.

### 로어북 임베딩

임베딩은 로어북이 의미로 검색할 수 있게 해 주는 숫자입니다. 임베딩에 내장 모델을 쓰려면 로어북의 벡터화 모델로 **Built-in model (on this device)**(내장 모델, 이 기기에서)를 고르세요. 먼저 **Use for tracker agents (roleplay)**나 **Use for game scene analysis**를 켜 두세요. 그렇지 않으면 요청이 실패합니다. 이 경로에는 GGUF 런타임이 필요하므로 Apple Silicon의 MLX에서는 작동하지 않습니다. [로어북 시맨틱 검색](../lorebooks/semantic-search.md)을 참고하세요.

### Decision 모델

내장 모델을 Decision 모델로 고를 수도 있습니다. [Decision 모델](decision-models.md)을 참고하세요.

### 채팅 모델

내장 모델과 채팅하려면 다음과 같이 하세요.

1. 채팅을 열고 채팅 입력란의 모델 버튼(링크 아이콘)을 클릭하세요.
2. **Model for this chat**(이 채팅의 모델)에서 **Built-in model (on this device)**를 고르세요. 목록 맨 아래에 있으며, 모델을 다운로드한 뒤에 나타납니다.
3. 메시지를 보내세요. 모델이 작아서 답변이 느리거나 짧거나 품질이 낮을 수 있다는 경고가 표시됩니다.

## 런타임 설정

런타임 설정을 열려면 카드의 페이지에서 **Runtime settings**(런타임 설정)를 클릭하거나, **Built-in model** 창에서 **Settings**(설정)를 클릭하세요. 설정은 4개 그룹으로 나뉩니다. 드롭다운과 스위치는 바꾸는 즉시 저장됩니다. 숫자 입력란은 **Apply settings**(설정 적용)를 클릭하면 저장됩니다. **Physical batch size**(물리적 일괄 처리 크기)와 **Custom GPU layers**(사용자 지정 GPU 레이어)에는 각각 전용 **Apply**(적용) 버튼이 있습니다.

**Speed**(속도)

| 설정 | 기본값 | 역할 |
| --- | --- | --- |
| **Runtime target**(런타임 대상) | Auto detect | Marinara가 어떤 그래픽 카드 계열에 맞춰 설치할지 정합니다. |
| **GPU offload**(GPU 오프로딩) | Auto offload | 그래픽 카드로 넘길 작업량을 정합니다. **Auto offload**(자동 오프로딩), **CPU only**(CPU만 사용), **Custom GPU layers**(1~1024) 중에서 고르세요. |

**Memory**(메모리)

| 설정 | 기본값 | 역할 |
| --- | --- | --- |
| **Context window**(컨텍스트 창) | 8192 | 모델이 한 번에 읽는 글의 양이며, 단위는 토큰입니다. 512 이상입니다. |
| **KV cache type**(KV 캐시 유형) | f16 | 모델이 읽은 내용을 저장하는 방식입니다. f16, q8_0, q4_0 중에서 고르세요. 뒤의 두 가지는 메모리를 덜 쓰며 Flash Attention 지원이 필요합니다. |

**Replies**(답변)

| 설정 | 기본값 | 역할 |
| --- | --- | --- |
| **Max response tokens**(최대 응답 토큰) | 4096 | 모델이 쓸 수 있는 가장 긴 답변의 길이입니다. 64 이상입니다. |
| **Temperature**(온도) | 0.3 | 답변이 얼마나 무작위로 나올지 정합니다. 0~2입니다. |
| **Top P** | 0.95 | 단어 선택 범위를 제한합니다. 0보다 크고 1 이하입니다. |
| **Top K** | 64 | 단어 선택 범위를 제한합니다. 0~500입니다. |

**Expert**(전문가)

| 설정 | 기본값 | 역할 |
| --- | --- | --- |
| **Native tool calls**(네이티브 도구 호출) | 켜짐 | 모델이 도구를 쓸 수 있게 합니다. Professor Mari와 사용자 지정 에이전트를 쓰려면 켜 두어야 합니다. |
| **Max parallel agent jobs**(최대 병렬 에이전트 작업 수) | 2 | 동시에 실행할 작업 수입니다. 1~16입니다. |
| **Pooling type**(풀링 타입) | None | 로어북 검색을 위해 모델이 글을 숫자로 바꾸는 방식입니다. 로어북 임베딩에는 **Mean**(평균)을 고르세요. |
| **Physical batch size** | 512 | 로어북 임베딩 배치 하나에 들어가는 글의 양입니다. 128~32768입니다. 긴 항목이 실패하면 값을 올리세요. Gemma는 1024에서 잘 작동하는 경우가 많습니다. |

일부 설정은 시스템에 따라 다릅니다.

- Windows와 Linux(x64)의 **Runtime target**에는 Auto detect, NVIDIA GPU, AMD GPU, Intel GPU, Vulkan GPU, CPU only, System llama-server가 있습니다. 다른 시스템에서는 선택지가 더 적습니다.
- Apple Silicon에서는 MLX가 가속기를 알아서 고릅니다. **Runtime target**, **GPU offload**, **KV cache type**, **Native tool calls**, **Pooling type**, **Physical batch size**는 표시되지 않습니다.
- **Max response tokens**는 Game Mode의 장면 분석을 제한하지 않습니다. 장면 분석에는 별도의 상한이 있습니다.
- **Expert**의 **Diagnostics**(진단)에는 런타임 빌드, 감지된 그래픽 카드, 마지막 실행 명령이 표시됩니다.

<a id="allow-runtime-installs"></a>

### 런타임 설치 허용하기

런타임 설치와 재설치는 보호된 작업입니다. Windows 원클릭 설치본에서는 자동으로 허용됩니다. macOS, Linux, Docker에서는 다음 중 하나를 한 다음 다시 시도하세요.

- **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)에 관리자 시크릿을 입력하세요. 관리자 시크릿은 위험한 작업에 쓰는 두 번째 비밀번호입니다. 서버가 실행 중인 컴퓨터의 **Admin Access**에서 만들거나, 서버의 `.env` 파일에 `ADMIN_SECRET`으로 설정합니다. [Admin Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions)를 참고하세요.
- 서버의 `.env` 파일에 `SIDECAR_RUNTIME_INSTALL_ENABLED=true`를 추가한 다음 Marinara를 다시 시작하세요. `.env` 파일은 Marinara 폴더에 있는 텍스트 파일입니다. [.env 파일 편집하기](../CONFIGURATION.md#edit-the-env-file)를 참고하세요.

Marinara는 현재 릴리스에 승인된 llama.cpp, MLX, uv 버전만 다운로드하며, 무엇이든 실행하기 전에 각 파일의 크기와 SHA-256 체크섬을 확인합니다.

## 로컬 음성 모델

**Local speech model**(로컬 음성 모델)은 Conversation(대화) 통화에서 내 목소리를 내 컴퓨터 안에서 직접 텍스트로 바꿉니다. 말을 텍스트로 바꾸는 음성 인식 모델인 Whisper 모델입니다. **Calls** 에이전트 패키지가 필요하며, 이 패키지는 **Agents → Agent Organizer**(에이전트 → Agent Organizer)에서 설치합니다.

1. **Connections** 패널을 열고 **On this device**(이 기기) 아래의 **Speech to text**(음성 인식) 항목을 클릭하세요.
2. **Local speech model** 아래의 드롭다운에서 모델을 고르세요.
3. **Download Whisper**(Whisper 다운로드)를 클릭하세요.
4. **Ready**가 표시될 때까지 기다리세요. Calls를 쓰기 전에 Marinara를 완전히 다시 시작하세요.

| 모델 | 다운로드 | 실행 중 RAM |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | 약 180 MB | 약 350 MB |
| Whisper Base (Multilingual) | 약 320 MB | 약 650 MB |

휴대전화나 오래된 컴퓨터라면 Tiny부터 써 보는 것이 가장 좋습니다. Base는 알아듣기 어려운 말을 더 정확하게 옮기지만 시작이 느립니다. 다운로드한 모델을 지우려면 휴지통 버튼인 **Delete Local Whisper**(로컬 Whisper 삭제)를 클릭하세요. Calls를 제거해도 모델이 지워집니다.

오디오는 내 컴퓨터를 떠나지 않습니다. 채팅 모델로 가는 것은 텍스트뿐입니다. 통화에서 쓰려면 통화의 오디오 입력을 Local Whisper로 설정하세요. [Conversation 음성 통화와 영상 통화](../conversation/calls.md)를 참고하세요. 대신 **Speech to text** 서버를 켜면 통화가 음성을 그 서버로 보냅니다. [직접 운영하는 음성 인식 서버 사용하기](../conversation/calls.md#use-your-own-speech-to-text-server)를 참고하세요.

<a id="troubleshooting"></a>

## 문제 해결

| 증상 | 해결 방법 |
| --- | --- |
| **Sidecar runtime install is disabled**라는 오류 메시지가 나옵니다. | [런타임 설치 허용하기](#allow-runtime-installs)를 참고하세요. |
| **Local runtime failed to start.** 창에 오류와 로그 파일 경로가 표시됩니다. 카드에는 **Local runtime unavailable**(로컬 런타임을 사용할 수 없음)이 표시됩니다. | **Retry startup**(시작 재시도)을 클릭하세요. 그래도 안 되면 **Reinstall runtime**(런타임 다시 설치)을 클릭하거나 다른 **Runtime target**을 고르세요. **Continue without local AI**(로컬 AI 없이 계속)는 보조 스위치를 끄고, 모델 없이도 Marinara를 계속 쓸 수 있게 합니다. |
| 런타임 다운로드에서 크기나 SHA-256이 맞지 않는다고 나옵니다. | Marinara가 파일을 폐기했습니다. Marinara를 업데이트한 다음 다시 시도하세요. 그래도 실패하면 파일을 직접 열지 마세요. 런타임 대상과 오류 내용을 알려 주세요. |
| 로어북 검색에서 로컬 모델이 활성화되지 않았다고 나옵니다. | **Use for tracker agents (roleplay)**나 **Use for game scene analysis**를 켠 다음 다시 벡터화하세요. |
| Game Mode 배너에 **Local scene helper failed to start**(로컬 장면 도우미를 시작하지 못했습니다)라고 나옵니다. | 배너의 **Open Local AI Model**(로컬 AI 모델 열기)을 클릭해 다시 시도하거나, 모델을 바꾸거나, 로컬 장면 분석을 끄세요. |

더 자세한 도움말은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 관련 가이드

- [AI 제공자에 연결하기](connecting-to-a-provider.md)
- [Decision 모델](decision-models.md)
- [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)
- [Memory Recall과 채팅 요약](../agents/memory.md)
- [Conversation 음성 통화와 영상 통화](../conversation/calls.md)
- [Game Mode: 시작하기](../game/getting-started.md)
- [로어북 시맨틱 검색](../lorebooks/semantic-search.md)
