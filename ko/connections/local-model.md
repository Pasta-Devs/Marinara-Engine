# Local Model 설정

이 가이드에서는 Marinara Engine이 직접 다운로드해 컴퓨터에서 실행하는 소형 AI 모델, **Local Model**(로컬 모델)을 설명합니다. API 키도, 온라인 계정도 필요 없습니다. 설정 방법과 **Runtime Settings**(런타임 설정), 그리고 트래커 에이전트나 Game Mode의 장면 효과, 오프라인 통화 받아쓰기 같은 보조 기능에 Local Model이 어떻게 쓰이는지 함께 다룹니다.

## Local Model이란

**Local Model**은 컴퓨터 안에서만 돌아가는 작은 언어 모델(Gemma)입니다. API 키는 Marinara가 온라인 AI 서비스와 통신할 때 쓰는 비밀번호 같은 비밀 문자열입니다. Local Model은 아무것도 밖으로 내보내지 않으므로 API 키가 필요 없습니다.

Local Model은 의도적으로 작게 만들어졌습니다. 주 채팅이나 롤플레이용이 아니라 뒤에서 돌아가는 보조 작업용입니다. Marinara는 다음 용도로 사용합니다.

- Roleplay 모드의 트래커 에이전트.
- Game Mode의 장면 효과(배경, 음악, 날씨 등).
- 시맨틱 검색을 위한 로어북 임베딩.
- 별도의 음성 모델을 통한 Conversation 통화의 마이크 받아쓰기.
- Decision 모델로 선택하면 활성화 질문과 판정문에 답합니다. [Decision 모델](decision-models.md)을 참고하세요.


설정 창에서는 이 기능을 **Local AI Model**이라고 부릅니다. 연결 드롭다운에서는 **Local Model (sidecar)**로 표시됩니다. 모두 같은 기능입니다.

주 채팅, 롤플레이, 게임 마스터(GM) 서술, Professor Mari의 문장 다듬기에는 Local Model을 쓰지 마세요. 그런 작업을 감당하기에는 너무 작습니다. 이런 용도에는 더 강력한 연결을 쓰세요. [AI 제공자에 연결하기](connecting-to-a-provider.md) 문서를 참고하세요.

## Local Model 카드 열기

Local Model은 **Connections**(연결) 패널에 있습니다.

1. **Connections** 패널을 여세요.
2. **Local Model**이라는 제목의 카드를 찾으세요.
3. 카드를 클릭하거나, 카드의 톱니바퀴 버튼(**Open local model settings**)을 클릭하세요.

톱니바퀴 버튼을 누르면 **Local AI Model** 설정 창이 열립니다. 아직 다운로드한 모델이 없으면 카드에 **Download now** 버튼과 **Choose model options** 버튼도 함께 나타납니다. 둘 다 같은 설정 창을 엽니다.

설정 창 안에는 **Local Model is for helpers, not main roleplay**라는 제목의 경고 상자가 있습니다. 이 모델이 보조 작업 전용이라는 점을 다시 알려 주는 안내입니다.

## 하드웨어와 운영체제 지원

Local Model은 런타임(모델을 실행하는 프로그램)과 모델 파일을 함께 다운로드합니다. 두 가지를 모두 담을 만큼 디스크 여유 공간과 메모리(RAM)가 있어야 합니다.

지원 범위는 운영체제에 따라 다릅니다.

- **Windows (64-bit) 및 Linux (64-bit)**: **Runtime Target** 선택기가 모두 제공되므로 그래픽 카드(GPU) 계열을 고르거나 프로세서(CPU)만으로 실행할 수 있습니다.
- **Windows on ARM 및 Linux on ARM**: 선택지가 줄어들며 대부분 CPU 기반입니다.
- **macOS on Apple Silicon**: Apple 칩에 맞춰 조정된 MLX 런타임을 사용합니다. 직접 지정하는 모델은 단일 파일이 아니라 HuggingFace 저장소입니다.
- **macOS on Intel 및 Android**: 사실상 CPU 전용입니다.

"Lite" 설치본에서는 Local Model을 쓸 수 없습니다. Lite 설치본은 용량을 줄이려고 로컬 런타임을 빼고 만든 경량 빌드입니다. Lite 설치본에서는 Local Model 카드가 아예 나타나지 않습니다.

## 처음 설정하기

런타임을 먼저 설치한 다음 모델을 고릅니다.

1. **Local AI Model** 설정 창을 여세요.
2. **Install Runtime**을 클릭하세요. Apple Silicon에서는 이 버튼이 **Install MLX Runtime**으로 표시됩니다.
3. 런타임 설치가 끝날 때까지 기다리세요. 진행 막대가 다운로드 상황을 보여 줍니다.
4. 아래 **모델 다운로드하기** 항목을 참고해 모델을 고르세요.
5. 모델 다운로드가 끝날 때까지 기다리세요.
6. 상태가 **Ready**로 바뀌면 **Done**을 클릭하세요.

지금 끝까지 진행할 상황이 아니라면 **Skip for Now**를 클릭하세요. 모델이 하나라도 있으면 이 버튼은 **Close**로 바뀝니다.

런타임 설치와 재설치는 보호된 작업입니다. Windows 원클릭 설치본에서는 자동으로 켜져 있습니다. macOS, Linux, Docker에서는 직접 허용해야 할 수 있습니다. 아래 **문제 해결** 항목을 참고하세요.

Marinara는 현재 Engine 릴리스에 승인된 llama.cpp, MLX, uv 버전만 다운로드합니다. 압축을 풀거나 실행하기 전에 파일 크기와 SHA-256 체크섬이 정확히 일치하는지 검증합니다. MLX의 Python 의존성 목록도 버전이 고정되어 있고 해시 검증을 거치며, 검토를 마친 mlx-lm 소스를 추가 패키지 없이 설치합니다. 그래서 런타임 버전이 올라갈 때도 상위 프로젝트의 "latest" 빌드를 조용히 따라가지 않고, 검토를 거친 Marinara 업데이트를 통해서만 바뀝니다.

## 모델 다운로드하기

설정 창에서는 모델을 구하는 방법을 두 가지로 제공합니다.

### 엄선된 프리셋

**Curated Gemma 4 Presets**에서는 미리 준비된 두 가지 중 하나를 고릅니다. Apple 이외의 하드웨어에서는 GGUF 형식을 사용합니다.

| 프리셋 | 다운로드 크기 | 실행 중 RAM |
| --- | --- | --- |
| Q8 (Best Quality) | 약 5.4 GB | 약 5.8 GB |
| Q4_K_M (Smaller, Faster) | 약 3.2 GB | 약 3.6 GB |

Q8에는 **Recommended** 표시가 붙습니다. 품질이 가장 좋습니다. Q4_K_M은 더 작고 빠르며 메모리도 덜 씁니다.

Apple Silicon에서는 이 자리에 MLX 프리셋이 대신 표시됩니다. 8-bit MLX 프리셋은 다운로드 약 5.9 GB, RAM 약 7.5 GB가 필요합니다. 4-bit MLX 프리셋은 다운로드 약 3.6 GB, RAM 약 4.8 GB가 필요합니다.

프리셋을 다운로드하는 방법은 다음과 같습니다.

1. 원하는 프리셋을 선택하세요.
2. **Use Curated Preset**을 클릭하세요. 이미 모델이 있으면 이 버튼은 **Switch to Curated Preset**으로 표시됩니다.

### 직접 고른 모델 사용하기

**Use Your Own Model From HuggingFace**에서는 공개 모델 공유 사이트인 HuggingFace의 모델을 직접 지정할 수 있습니다.

1. 입력란에 저장소 이름을 입력하세요. 형식은 `owner/repo`입니다.
2. **List Models**를 클릭하세요. Apple Silicon에서는 이 버튼이 **Validate Repo**로 표시됩니다.
3. Apple 이외의 하드웨어에서는 드롭다운에서 파일을 하나 고른 다음 **Download Selected GGUF**를 클릭하세요.
4. Apple Silicon에서는 저장소 검증이 끝난 뒤 **Use Validated MLX Repo**를 클릭하세요.

Marinara는 Local Model 파일을 디스크에 한 번에 하나만 보관합니다. 새 모델을 다운로드하면 기존 모델을 먼저 지웁니다. 주 Local Model에는 별도의 삭제 버튼이 없습니다. 지우려면 다른 모델을 다운로드해 덮어쓰세요.

## Runtime Settings 참고

모델의 동작을 조정하려면 설정 창 안의 **Runtime Settings** 섹션을 여세요. 입력란마다 저장 방식이 다릅니다.

- 드롭다운과 **Native Tool Calls** 스위치는 바꾸는 즉시 저장됩니다.
- **Context Window**, **Max Response Tokens**, **Temperature**, **Top P**, **Top K**는 **Apply Settings**를 클릭해야 적용됩니다.
- **Physical Batch Size**에는 전용 **Apply** 버튼이 있습니다. **GPU Offload**를 **Custom GPU layers**로 설정했을 때 나타나는 레이어 수 입력란도 마찬가지입니다.

| 설정 | 기본값 | 역할 |
| --- | --- | --- |
| Runtime Target | Auto detect | Marinara가 어떤 GPU 계열에 맞춰 설치할지 |
| GPU Offload | Auto offload | 얼마나 많은 작업을 GPU로 넘길지 |
| Native Tool Calls | On | 모델이 도구와 기능 호출을 쓸 수 있게 합니다 |
| Pooling Type | None | 로어북 검색용 임베딩 계산 방식 |
| Physical Batch Size | 512 | 로어북 임베딩 요청의 배치 크기 |
| Context Window | 8192 | 모델이 한 번에 읽을 수 있는 글의 양 |
| Max Response Tokens | 4096 | 모델이 쓸 수 있는 답변의 최대 길이 |
| Temperature | 0.3 | 답변이 얼마나 무작위로 나올지 |
| Top P | 0.95 | 단어 선택 범위를 제한하는 샘플링 값 |
| Top K | 64 | 단어 선택 범위를 제한하는 샘플링 값 |

헷갈리기 쉬운 항목을 정리하면 다음과 같습니다.

- **Runtime Target**과 **GPU Offload**는 GGUF 런타임에서만 나타납니다. Apple Silicon에서는 MLX가 알아서 가속기를 고릅니다.
- **Pooling Type**과 **Physical Batch Size**도 GGUF 런타임에서만, **Embedding Endpoint** 제목 아래에 나타납니다. 이 두 값은 로어북 임베딩에만 영향을 줍니다. 일반 채팅 답변은 달라지지 않습니다.
- **Pooling Type**의 기본값은 **None**입니다. Local Model을 로어북 임베딩에 쓸 때는 **Mean**으로 바꾸세요.
- **Physical Batch Size**는 임베딩 엔드포인트가 한 번에 처리할 글의 양을 정합니다. 긴 로어북 항목이 벡터화에 실패하면 값을 올리세요. 앱은 Gemma에 1024를 권합니다.
- 도구를 쓰려면 **Native Tool Calls**가 켜져 있어야 합니다. 경고문에는 Professor Mari와 사용자 지정 에이전트가 도구를 실행하려면 이 설정이 필요하다고 적혀 있습니다. 이 항목은 MLX 런타임에서는 제공되지 않습니다.
- **Max Response Tokens**는 일반 채팅과 에이전트 답변의 길이를 제한합니다. Game Mode의 장면 분석에는 별도의 내부 상한이 있어 이 값의 영향을 받지 않습니다.

## Send Test Message

런타임이 제대로 동작하는지 확인하려면 **Send Test Message**를 사용하세요. 이 버튼은 Runtime 섹션에 있습니다. 모델을 다운로드하고 런타임을 설치하기 전까지는 비활성화되어 있습니다.

1. **Send Test Message**를 클릭하세요.
2. 결과 상자가 나타날 때까지 기다리세요.
3. 성공하면 왕복 시간과 함께 **Local Test Message Succeeded** 상자가 나타납니다.
4. 실패하면 오류 내용과 함께 **Local Test Message Failed** 상자가 나타납니다.

이 테스트는 고정된 프롬프트를 사용합니다. Temperature와 토큰 설정을 무시하므로 모델이 응답하는지만 깔끔하게 확인할 수 있습니다.

## 보조 작업에 Local Model 사용하기

모델을 다운로드하고 나면 Local Model 카드에 스위치 두 개가 나타납니다.

- **Use for tracker agents (roleplay)**. 기본값은 꺼짐입니다.
- **Use for game scene analysis**. 기본값은 켜짐입니다.

이 두 스위치가 Marinara가 Local Model을 백그라운드에서 계속 띄워 둘지를 결정합니다. 둘 다 꺼져 있으면 런타임은 저절로 시작되지 않습니다. 하나라도 켜면 Marinara가 로컬 서버를 자동으로 시작합니다. 켠 직후 처음 시작할 때는 시간이 조금 걸릴 수 있습니다.

카드에는 **Use local model for all tracker agents** 버튼도 있습니다. 클릭 한 번으로 기본 제공 트래커 에이전트를 전부 Local Model로 돌립니다. 아래 줄에는 몇 개의 트래커 에이전트가 로컬 모델을 쓰는지가 "3/7 built-in tracker agents currently point at the local model."처럼 표시됩니다. 이 버튼은 에이전트가 쓰는 모델만 바꿉니다. 에이전트를 켜 주지는 않습니다. 에이전트를 켜는 방법은 [Memory Recall과 채팅 요약](../agents/memory.md) 문서와 사용 중인 모드의 가이드를 참고하세요.

Game Mode에서는 장면 관련 작업도 Local Model로 넘길 수 있습니다. Game 설정의 **Scene Effects Connection** 드롭다운에서 **Local Model (Gemma)**를 고르면 됩니다. 이 항목을 고르면 **Use for game scene analysis** 스위치가 켜집니다. [Game Mode: 시작하기](../game/getting-started.md) 문서를 참고하세요.

### 로어북 임베딩에 Local Model 사용하기

로어북 시맨틱 검색에도 Local Model을 쓸 수 있습니다. 로어북의 벡터화 설정에서 연결로 **Local Model (sidecar)**를 고르세요. 이 기능을 쓰려면 **Use for tracker agents (roleplay)**나 **Use for game scene analysis**가 먼저 켜져 있어야 합니다. 둘 다 꺼져 있으면 트래커나 게임 장면 분석용으로 로컬 모델을 활성화해야 한다는 메시지와 함께 요청이 실패합니다. 이 경로는 GGUF 런타임을 사용하므로 Apple Silicon의 MLX에서는 쓸 수 없습니다. [로어북 시맨틱 검색](../lorebooks/semantic-search.md) 문서를 참고하세요.

## 채팅 연결로 Local Model 사용하기

모델을 다운로드하고 나면 대부분의 연결 선택 목록 맨 아래에 Local Model이 나타납니다. **Local Model (sidecar)**로 표시되며, 모델 이름을 알 수 있을 때는 **Local Model** 뒤 괄호 안에 이름이 함께 표시됩니다.

일반 채팅에 이 항목을 고르면 경고가 나타납니다. Local Model이 아주 작고 보조 작업용이라는 내용입니다. 주 채팅과 롤플레이 답변이 느리거나 짧거나 품질이 떨어질 수 있다는 경고도 함께 나옵니다. 이 항목은 실제로 저장된 연결이 아니므로 연결 기본값을 저장할 수 없습니다.

채팅에서 이 항목을 고르면 보조 스위치가 둘 다 꺼져 있어도 필요할 때 로컬 서버가 시작됩니다. Game Mode의 주 모델 드롭다운에는 나타나지 않습니다. Game Mode는 오직 **Scene Effects Connection**을 통해서만 Local Model을 사용합니다.

## 통화용 Local Speech Model

**Local Speech Model**은 오프라인 마이크 받아쓰기를 위해 Calls에서 선택적으로 다운로드하는 모델입니다. 목소리를 컴퓨터 안에서 직접 받아쓰도록 설정했을 때 Conversation 통화에 쓰입니다. 말한 내용을 글로 바꿔 주는 음성-텍스트 변환 모델인 Whisper 모델입니다.

먼저 **Agents > Download Agents**에서 **Calls**를 설치하세요. 그러면 Connections의 **Local Model** 카드에 있는 **Local Speech Model** 항목에서 Whisper를 관리할 수 있습니다. Calls를 설치하지 않았다면 이 제목과 다운로드 컨트롤은 나타나지 않습니다.

선택지는 두 가지입니다.

- **Whisper Tiny (Multilingual)**: 다운로드 약 180 MB, RAM 약 350 MB. 휴대전화나 오래된 컴퓨터라면 이쪽부터 써 보는 편이 좋습니다.
- **Whisper Base (Multilingual)**: 다운로드 약 320 MB, RAM 약 650 MB. 알아듣기 어려운 말도 더 정확하게 옮기지만 시작이 느립니다.

설정 방법은 다음과 같습니다.

1. **Local Model** 카드를 열어 펼치세요.
2. **Local Speech Model** 아래 드롭다운에서 모델을 고르세요.
3. **Download Whisper**를 클릭하세요.
4. **Ready**로 표시되면 설정이 끝난 것입니다.

선택한 모델만 지우려면 휴지통 버튼(**Delete Local Whisper**)을 클릭하세요. Calls를 제거하면 다운로드한 Whisper 모델과 저장된 선택 상태가 전부 자동으로 지워지면서 디스크 공간을 되찾습니다. 나중에 Calls를 다시 설치하면 Local Speech Model 컨트롤이 다시 나타나고 Whisper도 다시 다운로드할 수 있습니다.

녹음된 음성은 컴퓨터 밖으로 나가지 않습니다. 밖으로 전송되는 것은 받아쓴 텍스트뿐이며, 그것도 지정한 채팅 연결로만 갑니다. 통화에서 사용하려면 통화 오디오 입력 방식을 Local Whisper 옵션으로 설정하세요. [Conversation 음성 통화와 영상 통화](../conversation/calls.md) 문서를 참고하세요.

## 문제 해결

**"Sidecar runtime install is disabled."** 런타임 설치와 재설치는 보호된 작업입니다. Windows 원클릭 설치본에서는 자동으로 켜집니다. macOS, Linux, Docker에서는 두 가지 방법이 있습니다. 서버의 `.env` 파일에 `SIDECAR_RUNTIME_INSTALL_ENABLED=true`를 설정하세요. 예를 들면 다음과 같습니다.

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

또는 **Settings -> Advanced -> Admin Access**에서 Admin Access 비밀 문자열을 한 번 입력한 다음 다시 시도하세요. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

**런타임이 시작되지 않습니다.** 설정 창에 **Local runtime failed to start**라는 제목의 상자가 오류 내용과 로그 파일 경로와 함께 나타납니다. **Retry Startup**을 클릭하세요. 그래도 안 되면 **Reinstall Runtime**을 클릭하거나 다른 **Runtime Target**을 시도해 보세요. **Continue Without Local AI**를 클릭하면 Local Model 없이 Marinara를 계속 쓸 수 있습니다. Connections 카드에는 같은 문제가 **Local runtime unavailable**로 표시됩니다.

**런타임 다운로드에서 크기나 SHA-256이 맞지 않는다고 나옵니다.** Marinara가 압축을 풀기 전에 다운로드를 폐기한 것입니다. 승인된 런타임 목록과 다운로드가 일치하도록 Marinara를 먼저 업데이트한 다음 다시 시도하세요. 같은 릴리스에서 계속 실패한다면 압축 파일을 직접 풀거나 실행하지 말고 런타임 대상과 오류 내용을 관리자에게 알려 주세요.

**로어북 검색에서 로컬 모델이 활성화되지 않았다고 나옵니다.** Local Model 카드에서 **Use for tracker agents (roleplay)**나 **Use for game scene analysis**를 켠 다음 벡터화를 다시 시도하세요.

**Game Mode 배너에 "Local scene helper failed to start."라고 나옵니다.** 배너의 **Open Local AI Model**을 클릭해 다시 시도하거나, 모델을 바꾸거나, 로컬 장면 분석을 끄세요.

더 자세한 도움말은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md) 문서를 참고하세요.

## 관련 가이드

- [AI 제공자에 연결하기](connecting-to-a-provider.md)
- [Decision 모델](decision-models.md)
- [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)
- [Memory Recall과 채팅 요약](../agents/memory.md)
- [Conversation 음성 통화와 영상 통화](../conversation/calls.md)
- [Game Mode: 시작하기](../game/getting-started.md)
- [로어북 시맨틱 검색](../lorebooks/semantic-search.md)
