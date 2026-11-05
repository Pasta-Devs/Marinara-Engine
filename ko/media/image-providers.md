# 이미지 생성 제공자와 설정

이미지 생성은 장면 삽화, 셀카, 장면 배경, 그리고 자동으로 만들어지는 아바타와 초상화, 스프라이트에 쓰입니다. 이 가이드에서는 이미지 서비스를 추가하는 방법과 서비스마다 필요한 것을 설명합니다. 이미지 모델이 하나만 제대로 작동하면 앱의 모든 이미지 기능이 그 모델을 사용할 수 있습니다.

## 이미지 서비스 추가하기

API 키는 서비스가 발급하는 비밀 코드로, Marinara가 내 계정을 쓸 수 있게 해 줍니다. 각 서비스의 웹 주소는 Marinara가 채워 주므로 직접 입력할 일은 거의 없습니다.

1. 상단 바에서 **Connections**(연결)를 클릭한 다음 **Add**(추가)를 클릭하세요. **Add account**(계정 추가) 창이 열립니다.
2. 서비스를 찾으세요. 목록에 **Images & video**(이미지 및 동영상) 섹션이 있으며, **Search providers**(제공자 검색)를 쓰면 찾기 쉽습니다.
3. **API key**(API 키) 입력란에 키를 붙여넣으세요. 무료 서비스와 로컬 서비스는 키가 필요 없습니다. 직접 실행하는 서버라면 주소 입력란을 채우세요.
4. **Connect**(연결)를 클릭하세요. Marinara가 계정을 테스트합니다.
5. 목록에서 이미지 모델을 고르거나 모델 ID를 입력하세요. 이것이 내 이미지 모델입니다. 이 모델은 **Connections** 패널에서 계정 아래에 표시됩니다.
6. 이미지 모델을 열고 **Test image**(이미지 테스트)를 클릭하세요. Marinara가 작은 시험용 그림을 만듭니다.
7. 앱이 그림을 만들 때 이 모델을 쓰게 하려면 **Connections** 패널 위쪽 **Defaults**(기본값)에서 **Images**(이미지) 작업을 설정하세요.

계정에 이미지 모델을 하나 더 추가하려면 그 계정의 **⋯** 메뉴를 열고 **Add image model**(이미지 모델 추가)을 클릭하세요. 창 전체에 대한 설명은 [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

작동하지 않는 경우: 키나 주소가 틀리면 **Test image**가 실패합니다. 먼저 두 가지를 모두 확인하세요. **Test provider**(연결 테스트)는 Marinara가 서비스에 접속할 수 있는지만 확인합니다. **Test image**는 실제 그림을 만들며 크레딧을 쓸 수 있습니다.

## 채팅에서 그림 받기

이미지 모델을 **Images** 작업으로 설정했다면 채팅에서 그림을 요청할 수 있습니다.

1. Roleplay(롤플레이) 채팅에 Illustrator 에이전트를 추가하세요. [Illustrator 에이전트](illustrator-agent.md)를 참고하세요.
2. **Chat Settings**(채팅 설정)를 열고 **Gallery**(갤러리)를 펼친 다음 **Illustrate**(이미지 생성)를 클릭하세요.
3. **Generating...**(생성 중...)이 끝날 때까지 기다리세요. 그림이 Gallery에 나타납니다.

Roleplay 채팅에서는 `/illustrate` 명령어를 써도 됩니다. [슬래시 명령어](../chats/slash-commands.md)를 참고하세요.

## 서비스 고르기

각 서비스의 주소는 Marinara가 채워 줍니다. 클라우드 서비스는 계정이 필요하며, 대부분은 API 키도 필요합니다. 무료 서비스는 키가 필요 없습니다. 로컬 서비스는 이미지 생성 소프트웨어를 내 컴퓨터에서 직접 실행합니다.

**가장 쉬운 시작:** **Pollinations**를 고르세요. 무료이며 계정도 키도 필요 없습니다. 더 좋은 그림을 원하면 나중에 더 강력한 서비스를 고르세요.

| 서비스 | API 키 | 실행 위치 |
| --- | --- | --- |
| OpenAI (DALL-E) | 필요 | 클라우드 |
| ChatGPT (Codex login) | 불필요, `codex login` 사용 | 클라우드 |
| Stability AI | 필요 | 클라우드 |
| Together AI | 필요 | 클라우드 |
| Arli AI | 필요 | 클라우드 |
| NovelAI | 필요 | 클라우드 |
| OpenRouter Images | 필요 | 클라우드 |
| xAI / Grok Imagine | 필요 | 클라우드 |
| Venice.ai | 필요 | 클라우드 |
| Z.AI | 필요 | 클라우드 |
| Atlas Cloud | 필요 | 클라우드 |
| fal.ai | 필요 | 클라우드 |
| SpicyAPI | 필요 | 클라우드 |
| NanoGPT | 필요 | 클라우드 |
| Block Entropy | 필요 | 클라우드 |
| RunPod Serverless (ComfyUI) | 필요 | 클라우드 |
| Pollinations | 불필요 | 무료 클라우드 |
| Stable Horde | 선택 | 무료 클라우드 |
| SD Web UI (AUTOMATIC1111 / Forge) | 불필요 | 로컬 |
| ComfyUI | 불필요 | 로컬 |
| SwarmUI | 선택 | 로컬 |
| Draw Things | 불필요 | 로컬 |

설정이 간단한 서비스에 대한 참고 사항은 다음과 같습니다.

- **OpenAI (DALL-E)**: DALL-E와 GPT Image 모델을 제공합니다. 반복 재생되는 GIF를 만드는 모델은 GPT Image 2.6뿐입니다. [GPT Image 2.6](#gpt-image-26)을 참고하세요.
- **Stability AI**: Stable Diffusion과 Stable Image 모델을 제공합니다.
- **Together AI**: FLUX를 비롯한 공개 이미지 모델을 제공합니다.
- **OpenRouter Images**: OpenRouter의 채팅 인터페이스를 통해 이미지 모델에 접근하므로, 쓸 수 있는 모델은 계정마다 다릅니다.
- **xAI / Grok Imagine**: Grok Imagine을 사용합니다.
- **NanoGPT**: 여러 제공자를 모아 주는 중개 서비스이므로 NanoGPT의 모델 목록을 사용하세요.
- **Pollinations**: 이미지 생성을 가장 빠르게 시험해 볼 수 있는 방법입니다. 계정이 필요 없습니다.
- **Stable Horde**: 여러 사람이 컴퓨터 자원을 나눠 쓰는 네트워크입니다. 무료 키를 발급받으면 대기열 우선순위가 높아집니다.
- **SD Web UI**와 **Draw Things**: 소프트웨어를 프로그램 인터페이스가 켜진 상태로 실행하세요. Marinara는 Draw Things를 AUTOMATIC1111 서버처럼 다룹니다(이 앱은 macOS나 iOS에서 실행됩니다).
- **Block Entropy**: Marinara에는 전용 처리 방식이 없어서 OpenAI 호환 요청을 보냅니다. 호환 여부는 확인되지 않았습니다. 본격적으로 쓰기 전에 **Test image**로 시험해 보세요.

## 별도 설정이 필요한 서비스

### GPT Image 2.6

GPT Image 2.6은 **OpenAI (DALL-E)** 계정에서 실행됩니다. **GPT Image 2.6 Flare**는 더 빠른 모델입니다. **GPT Image 2.6 Sunburst**는 품질이 더 높고 여러 번 편집해도 더 안정적으로 유지됩니다. 두 모델 모두 GPT Image 2.5와 같은 크기와 투명 배경을 지원하며, **Image quality**(이미지 품질)는 **Max**(최대)까지 올릴 수 있습니다.

모델은 그림을 그리기 전에 그림마다 계획을 세웁니다. 계획을 덜 세우게 하려면 이미지 모델의 **Custom Parameters**(사용자 지정 매개변수)에 `{"complexity": "low"}`나 `{"complexity": "medium"}`을 추가하세요. 기본값은 `high`입니다. 복잡도가 높을수록 시간이 더 걸릴 수 있고, 편집할 때 요청한 것보다 더 많이 바뀔 수 있습니다.

GPT Image 2.6은 짧게 반복 재생되는 GIF도 만들 수 있습니다. Marinara는 기능이나 다운로드한 에이전트가 GIF를 제공하는 곳에서만 GIF를 요청합니다.

| 제한 | 값 |
| --- | --- |
| 계정 | API 키를 사용하는 **OpenAI (DALL-E)** |
| 모델 | GPT Image 2.6 Flare 또는 Sunburst |
| 프레임 | 2~12개, 기본값 9개 |
| 프레임 길이 | 20~2000 ms, 기본값 200 ms |
| 프레임 크기 | 약 0.66 MP: 정사각형 816x816, 세로형 608x1088 |
| 보내는 그림 | 없음. GIF는 프롬프트만으로 그립니다 |
| 투명 배경 | 지원하지 않음 |

OpenAI는 더 많은 프레임을 허용하지만 GIF 하나에 허용되는 픽셀 수는 공개하지 않으므로, Marinara는 작은 프레임 12개까지만 씁니다. **ChatGPT (Codex login)**, **OpenRouter Images**, **NanoGPT**, ToAPIs와 그 밖의 서비스는 GIF를 만들 수 없습니다. Marinara는 아무것도 보내기 전에 이런 요청을 거부하므로 비용이 전혀 들지 않습니다. **OpenAI-compatible**(OpenAI 호환) 계정에는 OpenAI와 같은 방식으로 요청을 보내 봅니다.

실패한 GIF를 정지 이미지로 대신하는 일은 없습니다. 서비스가 정지 이미지로 응답하면 요청은 실패합니다. **Images** 작업의 **If it fails**(실패하면) 모델은 GIF를 만들 수 있을 때만 시도합니다.

> **경고:** OpenAI는 GIF 가격을 공개하지 않습니다. GIF 하나에 그림 여러 장 값이 든다고 예상하세요. GIF 대신 돌아온 정지 이미지에도 비용이 청구됩니다.

### ChatGPT (Codex login)

이 서비스는 API 키 대신 ChatGPT 요금제를 사용하므로, 이미지를 만들 때 OpenAI API 크레딧이 들지 않습니다.

1. Marinara를 실행하는 컴퓨터에 Codex CLI를 설치하고 `codex login`을 한 번 실행하세요. ChatGPT 채팅 계정이 쓰는 것과 같은 로그인입니다. [Claude, ChatGPT, Grok 구독 연결](../connections/subscription-clis.md#openai-chatgpt)을 참고하세요.
2. 서비스를 고르세요. 입력할 키나 주소는 없습니다. Marinara는 Codex가 이미지 생성에 쓰는 모델인 `gpt-image-2`를 채웁니다.

**Test provider**는 Marinara가 Codex 로그인 정보를 읽을 수 있는지만 확인합니다. **Test image**는 실제 이미지를 만들며, ChatGPT 이미지 사용량 한도에서 차감됩니다. GPT Image 2.6 모델 ID를 써도 이 서비스는 GIF를 만들 수 없습니다. 참조 이미지가 있으면 Marinara는 최대 16장까지 담아 편집 요청을 보냅니다. ChatGPT가 다른 픽셀 크기로 이미지를 돌려줄 수 있으므로, Marinara는 원하는 화면비를 프롬프트에도 적어 보냅니다. 이 서비스는 공개 OpenAI API가 아니라 Codex가 쓰는 ChatGPT 이미지 엔드포인트를 사용하므로, OpenAI가 예고 없이 바꿀 수 있습니다.

### Arli AI

호스팅된 Stable Diffusion 모델을 실행합니다. 모델은 필수이므로 사용할 Arli AI 이미지 모델 이름을 입력하세요. SD Web UI와 같은 **Local Image Defaults**(로컬 이미지 기본값) 입력란을 씁니다([Local Image Defaults](#local-image-defaults-per-connection) 참고). 첫 번째 참조 이미지는 시작 그림으로 쓰입니다. 이 서비스는 이미지 전용입니다. Arli AI 채팅 모델은 [지원하는 AI 제공자](../connections/providers-reference.md#arli-ai)를 참고하세요.

### NovelAI

NovelAI는 애니메이션풍 그림에 특화되어 있습니다. V4, V4.5, V5 모델에서는 Marinara가 여러 캐릭터가 등장하는 스토리보드와 Illustrator 장면을 위해 위치 정보가 포함된 캐릭터별 프롬프트를 NovelAI가 자체 지원하는 형식으로 보냅니다. 정밀 참조 이미지는 V4.5 모델에서만 작동합니다.

### Venice.ai

Marinara는 Venice의 자체 이미지 엔드포인트를 사용하고, Venice의 선택 기능인 세이프 모드 흐림 처리를 끄며, 요청한 크기를 각 모델의 크기 형식에 맞춰 변환합니다. 그래도 Venice 자체의 정책이나 모델 제한 때문에 요청이 거부될 수 있습니다.

### Z.AI

일반 Z.AI API 키를 사용하세요. GLM Coding Plan 키와 `/api/coding/paas/v4` 주소는 이미지 생성에 쓸 수 없습니다. **GLM-Image**나 **CogView 4**를 고르세요. Marinara는 화면비를 모델이 지원하는 크기에 맞춰 변환하고, 임시 결과를 로컬 저장소로 내려받습니다. 텍스트-이미지 생성만 지원하며 참조 이미지는 보내지 않습니다.

### Atlas Cloud

Marinara는 Atlas Cloud의 최신 텍스트-이미지 및 이미지-이미지 모델 목록을 불러옵니다. 불러오지 못하면 기본 목록(Nano Banana, Gemini Flash Image, FLUX 1.1 Pro)을 표시합니다. 정확한 모델 ID는 언제든 직접 입력할 수 있습니다. 작업은 비동기로 실행되므로 Marinara는 작업을 시작한 뒤 이미지가 준비될 때까지 상태를 확인합니다. 참조 이미지는 image-to-image, 편집 또는 Kontext 기능을 지원한다고 표시된 모델 ID로 전송됩니다. Atlas 모델마다 입력 구조가 다르므로 다른 ID를 쓴다면 해당 모델의 Atlas Cloud 문서를 확인하세요.

### fal.ai

[fal.ai](https://fal.ai/dashboard/keys)에서 API 키를 만드세요. 기본 목록에는 `fal-ai/flux/schnell`과 `fal-ai/flux/dev`가 있습니다. 입력과 출력이 호환되는 다른 텍스트-이미지 엔드포인트 ID도 입력할 수 있습니다. **Test provider**는 설정만 확인합니다. **Test image**는 실제 요청을 보내므로 fal.ai 크레딧을 사용합니다.

Marinara는 프롬프트와 크기를 보내고, 처음 반환된 이미지를 다운로드합니다. 네거티브 프롬프트는 텍스트로 덧붙입니다. `seed`, `num_inference_steps`, `image_size` 같은 모델 옵션에는 **Custom Parameters**를 사용하세요. 동기식 텍스트-이미지 요청을 사용하며, 참조 이미지를 보내지 않고 중단된 작업을 재개하지도 않습니다. 모델의 [API 참조](https://fal.ai/models/fal-ai/flux/schnell/api)를 참고하세요.

### SpicyAPI

[SpicyAPI 콘솔](https://spicyapi.ai/console/keys)에서 키를 만들고 **SpicyAPI**를 고르세요. Marinara가 모델 `alibaba/z-image-spicy-pro/text-to-image`를 채웁니다. `bytedance/seedream-5.0-pro/text-to-image` 같은 다른 ID를 입력할 수도 있습니다. **Test provider**는 모델 목록을 읽으므로 비용이 들지 않습니다. **Test image**는 실제 이미지를 만들며 잔액을 사용합니다.

**SpicyAPI** 서비스를 고르세요. **OpenAI (DALL-E)**나 OpenAI 호환 계정에 SpicyAPI 주소를 넣어 쓰지 마세요. SpicyAPI의 OpenAI 방식 주소는 텍스트만 처리합니다.

모델마다 받는 설정이 다릅니다. Marinara는 모델이 어떤 설정을 받는지 SpicyAPI에 물어보고 그 설정만 보내며, 모델이 제공하는 형식(화면비, 너비와 높이, 고정 크기) 가운데 가장 가까운 것을 씁니다. 네거티브 프롬프트 항목이 없는 모델에는 네거티브 프롬프트를 프롬프트 끝에 덧붙입니다. `seed`, `resolution`, `loras` 같은 다른 옵션에는 **Custom Parameters**를 사용하세요.

이미지 하나가 작업 하나입니다. Marinara는 기다리다가 1분쯤 지나면 다시 확인하고, 그다음 결과를 다운로드합니다. 연결이 끊기면 새 작업에 비용을 들이는 대신 같은 작업을 이어받습니다. 편집 모델(ID 끝이 `/edit`인 모델)은 참조 이미지를 받습니다. SpicyAPI는 이미지당 1 MB, 요청당 2 MB까지 받으므로, Marinara는 더 큰 이미지를 줄이고 들어가지 않는 나머지 이미지는 뺍니다.

### SwarmUI

SwarmUI는 ComfyUI 작업을 자체 대기열로 나눠 처리할 수 있습니다. 계정이 없는 로컬 서버라면 키가 필요 없습니다. 서버에 계정이 필요하다면 **API key**에 Swarm Auth Token을 붙여넣으세요. 모델 목록에는 SwarmUI 서버에 있는 모델이 표시됩니다.

**ComfyUI workflow (optional)**(ComfyUI 워크플로, 선택 사항) 입력란은 비워 두어도 됩니다. 비워 두면 SwarmUI 자체 이미지 설정을 쓰고, 워크플로를 붙여넣을 수도 있습니다(아래 참고). 각 이미지를 SwarmUI의 출력 폴더에도 남기려면 **Local Image Defaults**에서 **Save images in SwarmUI**(SwarmUI에 이미지 저장)를 켜세요. 어느 쪽이든 Marinara는 자체 사본을 보관합니다.

### 네트워크 안의 로컬 서비스

`localhost`는 Marinara를 실행하는 컴퓨터를 가리킵니다. 그 컴퓨터에서 돌아가는 로컬 이미지 서버는 추가 설정 없이 작동합니다. 서버가 네트워크의 다른 컴퓨터에서 돌아간다면 서버 설정에서 로컬 네트워크 주소를 허용하세요. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

서비스가 이미지 데이터 대신 URL을 돌려주면, 공개 CDN URL은 Marinara가 평소의 외부 요청 검사를 거쳐 다운로드합니다. 사설 주소나 루프백 주소로 된 결과 URL은 설정된 이미지 서비스와 프로토콜, 호스트 이름, 포트가 정확히 일치할 때만 허용합니다. 그 출처에서 시작된 리디렉션은 다른 로컬 서비스로 넘어갈 수 없습니다. 로컬 프록시가 결과를 다른 사설 출처에 저장한다면, 그 파일을 이미지 API와 같은 출처로 제공하도록 하세요.

## ComfyUI 워크플로 JSON과 RunPod

**ComfyUI**, **SwarmUI**, **RunPod Serverless (ComfyUI)**에서는 **ComfyUI workflow (optional)** 또는 **(required)**(필수) 입력란이 나타납니다. ComfyUI 버전에 따라 **Save (API Format)**(API 형식으로 저장), **Export (API)**, **Export to API** 중 하나로 ComfyUI에서 내보낸 워크플로 JSON을 붙여넣으세요. 이 입력란은 ComfyUI와 SwarmUI에서는 선택 사항이고 RunPod에서는 필수입니다. RunPod에는 API 키로 쓸 RunPod API 토큰, **RunPod endpoint ID**(RunPod 엔드포인트 ID), 워크플로가 필요합니다.

Marinara가 값을 채워 넣을 자리마다 워크플로에 다음 문자열을 넣으세요.

- `%prompt%`와 `%negative_prompt%`는 프롬프트입니다.
- `%width%`, `%height%`, `%seed%`는 크기와 시드입니다.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%`, `%denoise%`는 생성 설정입니다.
- `%reference_image%`와 `%reference_image_01%`부터 `%reference_image_04%`까지는 참조 이미지 데이터입니다.
- `%reference_image_name%`과 `%reference_image_name_01%`부터 `%reference_image_name_04%`까지는 참조 이미지를 업로드하고 그 파일 이름을 로컬 ComfyUI의 LoadImage 노드에 채워 넣습니다.

`%prompt%`가 가장 중요합니다. 이 문자열이 없으면 편집기가 경고합니다. ComfyUI에서는 입력란을 비워 두면 내장된 기본 워크플로를 씁니다. SwarmUI에서는 SwarmUI 자체 설정을 씁니다. RunPod에는 기본 워크플로가 없으므로 워크플로가 반드시 필요합니다. 세 서비스 모두 base64 원본 참조 이미지를 최대 4장까지 받습니다. 파일 이름 업로드 방식의 플레이스홀더는 로컬 ComfyUI에서만 쓸 수 있습니다.

내보내기 전체 과정과 예시, 따옴표 규칙, 참조 이미지, 캐릭터별 워크플로, 네트워크 접근, 문제 해결은 [ComfyUI 워크플로 설정](comfyui.md)을 참고하세요.

<a id="local-image-defaults-per-connection"></a>

## 연결마다 적용되는 Local Image Defaults

**SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI**, **RunPod Serverless (ComfyUI)**의 이미지 모델에는 **Local image defaults**(로컬 이미지 기본값) 패널이 나타납니다. Draw Things와 Arli AI에는 SD Web UI의 입력란이 표시됩니다. SwarmUI와 RunPod에는 ComfyUI의 입력란이 표시됩니다. 이 설정은 이 모델로 이미지를 만들 때만 적용됩니다. **Reset**(초기화)은 내장된 값으로 되돌립니다.

모든 서비스에 **Seed**(시드) 입력란이 있습니다. -1이면 이미지마다 무작위로 생성합니다. 다른 숫자를 넣으면 매번 그 시드를 다시 씁니다. 나머지 입력란은 서비스마다 다릅니다.

| 서비스 | 입력란 | 기본값 |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2img denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

서비스마다 **Prompt prefix**(프롬프트 접두사)와 **Negative prefix**(네거티브 접두사) 입력란도 있습니다. 여기에 넣은 글은 이 모델에서 보내는 모든 프롬프트 앞에 붙습니다. AUTOMATIC1111 / Forge와 ComfyUI에는 **Clip skip**(클립 건너뛰기) 입력란이 있습니다. AUTOMATIC1111 / Forge에는 **Restore faces**(얼굴 복원) 토글이 추가로 있습니다. ComfyUI에는 참조 이미지가 없을 때 1x1 플레이스홀더를 업로드하는 토글이 추가로 있으며, 이 토글은 참조 플레이스홀더를 쓰는 사용자 지정 워크플로에서만 의미가 있습니다. NovelAI에는 **Guidance rescale**(가이던스 리스케일)과 **UC preset**(UC 프리셋)이 추가로 있습니다.

## 서비스마다 다른 참조 이미지 지원

참조 이미지는 프롬프트와 함께 보내는 기존 그림으로, 새 이미지가 캐릭터의 얼굴이나 그림체를 유지하게 해 줍니다.

| 서비스 | 참조 이미지 |
| --- | --- |
| OpenAI (DALL-E) | 최대 16장, GPT Image 모델에서만. GIF에는 보내지 않음 |
| ChatGPT (Codex login) | 최대 16장 |
| NovelAI | 최대 16장, V4.5 모델에서만 |
| xAI / Grok Imagine | 최대 3장 |
| NanoGPT | 최대 3장 |
| ComfyUI, RunPod Serverless (ComfyUI), SwarmUI | 최대 4장, 워크플로 플레이스홀더를 통해 |
| Stability AI, Arli AI, SD Web UI, Draw Things | 첫 번째 이미지만, image to image 방식으로 사용 |
| Atlas Cloud | 첫 번째 이미지, 호환되는 image-to-image, 편집 또는 Kontext 모델 ID에서 |
| SpicyAPI | 편집 모델에서만, 모델 한도까지, 한도에 맞게 줄임 |
| OpenRouter Images | 지원, 장수 제한 없음 |
| Venice.ai, Z.AI | 텍스트-이미지 생성에서는 지원하지 않음 |
| Together AI, Pollinations, Stable Horde, fal.ai | 지원하지 않음 |

NovelAI 정밀 참조는 `nai-diffusion-4-5-full` 같은 V4.5 모델에서만 작동합니다. NovelAI는 V5용 Precise Reference를 출시하지 않았습니다. 다른 모델에 참조를 요청하면 Marinara는 참조 없이 이미지를 생성하고 서버에 경고 로그를 남깁니다.

## 미디어 생성 요청을 순서대로 처리하기

**Queue media generation requests**(미디어 생성 요청 대기열 사용) 토글은 **Settings → Generations → Overall Generations**(설정 → 생성 → 전체 생성)에 있습니다. 기본값은 켜짐입니다.

켜져 있으면 Marinara는 이미지 작업은 이미지 계정마다, 동영상 작업은 동영상 계정마다 별도의 대기열에서 하나씩 순서대로 보냅니다. 같은 계정의 이미지와 동영상은 함께 실행될 수 있습니다. 이미지나 동영상을 요청하는 모든 기능에 적용되며, Illustrator, 트래커, 명령, Gallery, Game 에셋, Slurp 같은 다운로드한 에이전트가 모두 여기에 해당합니다. 주소와 API 키가 같은 모델 두 개는 대기열을 공유합니다. 서로 다른 계정은 여전히 동시에 실행됩니다. NovelAI는 작업 사이에 짧게 쉬기도 하며, NovelAI가 바쁘다고 응답하면 Marinara는 기다렸다가 두 번 더 시도합니다.

요청 2개를 동시에 받으면 거부하는 서비스라면 켠 채로 두세요. 사용 중인 서비스가 여러 요청을 동시에 처리할 수 있고 속도를 원할 때만 끄세요.

## 관련 가이드

- [ComfyUI 워크플로 설정](comfyui.md)
- [Illustrator 에이전트](illustrator-agent.md)
- [이미지 스타일 프로필](style-profiles.md)
- [장면 배경과 Gallery](scene-backgrounds.md)
- [셀카](../conversation/selfies.md)
- [지원하는 AI 제공자](../connections/providers-reference.md)
