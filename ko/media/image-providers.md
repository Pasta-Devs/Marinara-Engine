# 이미지 생성 제공자와 설정

이 가이드에서는 이미지 생성 서비스를 Marinara Engine에 연결하는 방법을 설명합니다. 각 서비스마다 무엇이 필요한지도 함께 다룹니다. 이미지 생성은 장면 삽화, 셀카, 장면 배경, 그리고 자동으로 만들어지는 아바타와 초상화, 스프라이트에 쓰입니다.

이미지 생성은 특별한 형태의 연결로 설정합니다. 이미지 연결이 하나만 제대로 작동하면 앱의 모든 이미지 기능이 그 연결을 사용할 수 있습니다.

## 이미지 생성 연결 추가하기

**API Key**(API 키)는 제공자가 발급하는 비밀번호 같은 비밀 문자열이며, 이 키가 있어야 Marinara가 계정을 사용할 수 있습니다. **Base URL**(기본 URL)은 서비스의 프로그램 인터페이스 웹 주소입니다. 서비스를 고르면 Marinara가 알맞은 Base URL을 자동으로 채웁니다.

이미지 연결은 다음 순서로 추가합니다.

1. **Connections**(연결) 패널을 여세요.
2. **New**(새로 만들기) 버튼을 클릭해 **Create Connection**(연결 만들기) 창을 여세요.
3. 이름을 입력한 다음 **Image Generation**(이미지 생성) 제공자를 고르세요.
4. 연결 편집기의 격자에서 **Service**(서비스)를 하나 고르세요.
5. 그 서비스에 API 키가 필요하면 **API Key** 입력란에 붙여넣으세요. 무료 서비스와 로컬 서비스는 필요하지 않습니다.
6. 목록에서 **Model**(모델)을 고르거나 모델 ID를 직접 입력하세요. 일부 서비스는 **Fetch Models from API**로 현재 목록을 불러올 수 있습니다.
7. **Save**(저장)를 클릭하세요.
8. **Test Image**(이미지 테스트)를 클릭해 정상 작동하는지 확인하세요. Marinara가 작은 시험용 이미지를 생성합니다.

**Test Image**에서 그림이 나오면 연결이 준비된 것입니다. 실패하면 API 키와 Base URL을 확인하세요.

## 서비스 고르기

서비스는 크게 3가지로 나뉩니다. 클라우드 서비스는 계정이 필요하며, 대부분은 API 키도 필요합니다. 무료 서비스는 키가 필요 없습니다. 로컬 서비스는 이미지 생성 소프트웨어를 내 컴퓨터에서 직접 실행합니다.

아래 표에서 각 서비스를 한눈에 볼 수 있습니다. 세부 사항과 주의점은 이어지는 서비스별 항목에서 설명합니다.

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

## OpenAI (DALL-E)

기본 Base URL이 `https://api.openai.com/v1`인 클라우드 서비스입니다. OpenAI 계정에서 발급한 API 키가 필요합니다. DALL-E와 GPT Image 모델을 제공합니다. GPT Image 모델은 참조 이미지를 최대 16장까지 받으며, DALL-E 모델은 받지 않습니다.

## ChatGPT (Codex login)

API 키 대신 ChatGPT 요금제를 사용하는 클라우드 서비스입니다. 그래서 이미지를 만들 때 OpenAI API 크레딧이 들지 않습니다. Marinara 서버를 실행하는 컴퓨터에 Codex CLI를 설치하고 `codex login`을 한 번 실행하세요. **OpenAI (ChatGPT)** 채팅 연결이 쓰는 것과 같은 로그인이며, 절차는 [Claude, ChatGPT, Grok 구독 연결](../connections/subscription-clis.md#openai-chatgpt)에서 설명합니다. 입력할 API 키나 Base URL은 없습니다. Marinara는 Codex 자체가 이미지 생성에 쓰는 모델인 `gpt-image-2`를 자동으로 채웁니다.

**Test Connection**(연결 테스트)은 Marinara가 Codex 로그인 정보를 읽을 수 있는지만 확인합니다. **Test Image**는 실제 이미지를 만들며, ChatGPT 이미지 사용량 한도에서 차감됩니다. 참조 이미지가 있으면 Marinara는 최대 16장까지 담아 이미지 편집 요청을 보냅니다. ChatGPT가 요청한 것과 다른 픽셀 크기로 이미지를 돌려줄 수 있으므로, Marinara는 원하는 화면비를 프롬프트에도 적어 보냅니다.

이 서비스는 공개 OpenAI API가 아니라 Codex가 쓰는 ChatGPT 이미지 엔드포인트와 통신하므로, OpenAI가 예고 없이 바꿀 수 있습니다.

## Stability AI

기본 Base URL이 `https://api.stability.ai/v2beta`인 클라우드 서비스입니다. Stability AI API 키가 필요합니다. Stable Diffusion과 Stable Image 모델을 제공합니다.

## Together AI

기본 Base URL이 `https://api.together.xyz/v1`인 클라우드 서비스입니다. Together AI API 키가 필요합니다. FLUX를 비롯한 공개 이미지 모델을 제공합니다.

## Arli AI

기본 Base URL이 `https://api.arliai.com/v1`인 클라우드 서비스입니다. Arli AI API 키가 필요합니다. 호스팅된 Stable Diffusion 모델을 실행합니다. **Model**은 필수이므로 사용할 Arli AI 이미지 모델 이름을 입력하세요. **SD Web UI (AUTOMATIC1111 / Forge)**와 같은 **Local Image Defaults**(로컬 이미지 기본값) 입력란을 쓰며, 자세한 내용은 아래에서 설명합니다. 참조 이미지를 보내면 Marinara는 첫 번째 이미지를 시작 그림으로 씁니다(image to image).

여기의 **Arli AI** 서비스는 이미지 전용입니다. Arli AI 채팅 모델을 쓰려면 대신 **Arli AI** 채팅 제공자를 사용하세요. [지원하는 AI 제공자](../connections/providers-reference.md#arli-ai)를 참고하세요.

## NovelAI

기본 Base URL이 `https://image.novelai.net`인 클라우드 서비스입니다. NovelAI API 키가 필요합니다. 애니메이션풍 그림에 특화되어 있습니다. V4, V4.5, V5 모델에서는 여러 캐릭터가 등장하는 스토리보드와 Illustrator 장면을 위해 위치 정보가 포함된 캐릭터별 프롬프트를 NovelAI가 자체 지원하는 형식으로 보냅니다. 정밀 참조 이미지처럼 비교적 새로운 기능은 V4.5 모델에서만 작동합니다.

## OpenRouter Images

기본 Base URL이 `https://openrouter.ai/api/v1`인 클라우드 서비스입니다. OpenRouter API 키가 필요합니다. OpenRouter의 채팅 인터페이스를 통해 이미지 모델에 접근하므로, 실제로 쓸 수 있는 모델은 계정마다 다릅니다.

## xAI / Grok Imagine

기본 Base URL이 `https://api.x.ai/v1`인 클라우드 서비스입니다. xAI API 키가 필요합니다. 이미지 생성에 Grok Imagine을 사용합니다.

## Venice.ai

기본 Base URL이 `https://api.venice.ai/api/v1`인 클라우드 서비스입니다. Venice API 키가 필요합니다. **Fetch Models from API**를 사용하면 계정에서 쓸 수 있는 이미지 모델을 불러옵니다. Marinara는 Venice의 자체 이미지 엔드포인트를 사용하고, Venice의 선택 기능인 세이프 모드 흐림 처리를 끄며, 요청한 크기를 각 모델의 픽셀 방식이나 화면비 방식, 해상도 등급 방식에 맞춰 자동으로 변환합니다. 그래도 제공자 쪽 정책이나 모델 제한 때문에 요청이 거부될 수 있습니다.

## Z.AI

기본 Base URL이 `https://api.z.ai/api/paas/v4`인 클라우드 서비스입니다. 일반 Z.AI API 키가 필요합니다. GLM Coding Plan 키와 `/api/coding/paas/v4` 엔드포인트는 이미지 생성에 쓸 수 없습니다. **Fetch Models from API**로 **GLM-Image**나 **CogView 4**를 고르세요. Marinara는 요청한 화면비를 고른 모델이 지원하는 크기에 맞춰 변환하고, 요청을 Z.AI의 자체 이미지 엔드포인트로 보낸 뒤, 임시 결과 URL에 있는 이미지를 로컬 저장소로 내려받습니다. 이 첫 버전은 텍스트-이미지 생성만 지원하며 참조 이미지는 보내지 않습니다.

## Atlas Cloud

기본 Base URL이 `https://api.atlascloud.ai/api/v1`인 클라우드 서비스입니다. Atlas Cloud API 키가 필요합니다. **Fetch Models**(모델 가져오기)는 Atlas Cloud의 최신 텍스트-이미지 및 이미지-이미지 모델 목록을 불러옵니다. 목록에 접근할 수 없으면 Marinara는 Nano Banana, Gemini Flash Image, FLUX 1.1 Pro로 구성된 작은 기본 목록을 대신 표시합니다. Atlas Cloud 이미지 모델의 정확한 ID를 직접 입력할 수도 있습니다. 작업은 비동기로 실행됩니다. Marinara는 생성을 시작한 뒤 이미지가 준비될 때까지 Atlas Cloud에 상태를 확인합니다. 일반적인 텍스트-이미지 설정은 자동으로 매핑되며, 참조 이미지는 ID에 image-to-image, 편집 또는 Kontext 기능이 표시된 모델로 전송됩니다. 모델마다 입력 구조가 다를 수 있으므로 다른 ID를 사용한다면 해당 모델의 Atlas Cloud 문서를 확인하세요.

## fal.ai

기본 **Base URL**이 `https://fal.run`인 클라우드 서비스입니다. [fal.ai](https://fal.ai/dashboard/keys)에서 API 키를 만들고 이미지 서비스 목록에서 **fal.ai**를 선택하세요. 초기 **Model** 목록에는 `fal-ai/flux/schnell`과 `fal-ai/flux/dev`가 있습니다. 입력 및 출력 스키마가 호환되는 다른 텍스트 이미지 생성 엔드포인트 ID도 입력할 수 있습니다. **Test Connection**(연결 테스트)은 설정만 확인합니다. **Test Image**는 실제 생성 요청을 보내므로 fal.ai 크레딧을 사용합니다.

Marinara는 프롬프트와 요청한 크기를 전송하고, 처음 반환된 이미지를 기존 이미지 처리 흐름으로 다운로드합니다. 네거티브 프롬프트는 텍스트 지시로 덧붙입니다. `seed`, `num_inference_steps`, `image_size` 같은 모델별 옵션에는 **Custom Parameters**(사용자 지정 매개변수)를 사용하세요. 이 연동은 동기식 텍스트 이미지 생성 요청을 사용하며, 참조 이미지를 보내거나 중단된 작업을 재개하지 않습니다. 지원하는 입력은 선택한 모델이나 사용자 지정 엔드포인트의 API 페이지에서 확인하세요. 예를 들어 [flux/schnell API 참조](https://fal.ai/models/fal-ai/flux/schnell/api)를 볼 수 있습니다.

## SpicyAPI

기본 **Base URL**이 `https://api.spicyapi.ai/api/v1`인 클라우드 서비스입니다. [SpicyAPI 콘솔](https://spicyapi.ai/console/keys)에서 API 키를 만들고 이미지 서비스 목록에서 **SpicyAPI**를 선택하세요. Marinara가 모델 `alibaba/z-image-spicy-pro/text-to-image`를 채웁니다. **Fetch Models from API**를 클릭하면 SpicyAPI의 텍스트-이미지 모델과 편집 모델을 모두 불러오며, `bytedance/seedream-5.0-pro/text-to-image` 같은 모델 ID를 직접 입력할 수도 있습니다. **Test Connection**은 모델 목록을 읽어 키를 확인하므로 비용이 들지 않습니다. **Test Image**는 실제 이미지를 만들며 SpicyAPI 잔액을 사용합니다.

**SpicyAPI** 서비스를 고르세요. SpicyAPI 주소로 **OpenAI (DALL-E)**나 **Custom (OAI-Compatible)** 연결을 쓰지 마세요. SpicyAPI의 OpenAI 방식 주소는 텍스트만 처리하므로 이런 연결로는 이미지를 만들 수 없습니다.

SpicyAPI 모델은 저마다 받는 설정이 다릅니다. Marinara는 선택한 모델이 어떤 설정을 받는지 SpicyAPI에 물어보고 그 설정만 보냅니다. 화면비, 너비와 높이, 고정 크기처럼 모델이 제공하는 형식 가운데 가장 가까운 것을 고릅니다. 모델에 네거티브 프롬프트 항목이 없으면 네거티브 프롬프트를 프롬프트 끝에 텍스트로 덧붙입니다. `seed`, `resolution`, `loras` 같은 다른 모델 옵션에는 **Custom Parameters**를 사용하세요.

SpicyAPI는 이미지마다 작업 하나로 실행합니다. Marinara는 작업이 끝나기를 기다리고, 1분 정도 넘게 걸리면 다시 확인한 뒤 결과를 다운로드합니다. 연결이 끊기면 Marinara는 새 작업에 비용을 들이는 대신 같은 작업을 이어받습니다. 편집 모델(ID 끝이 `/edit`인 모델)은 참조 이미지를 받습니다. SpicyAPI는 참조 이미지를 장당 1 MB, 요청당 2 MB까지 받으므로, Marinara는 더 큰 이미지를 줄이고 들어가지 않는 나머지 이미지는 뺍니다.

## NanoGPT

기본 Base URL이 `https://nano-gpt.com/api/v1`인 클라우드 서비스입니다. NanoGPT API 키가 필요합니다. NanoGPT는 여러 제공자를 모아 주는 중개 서비스이므로, **Fetch Models from API**로 모델 목록을 불러오세요.

## Block Entropy

기본 Base URL이 `https://api.blockentropy.ai`인 클라우드 서비스입니다. API 키가 필요합니다. Marinara에는 Block Entropy 전용 처리 방식이 없어서 요청을 OpenAI 호환 형식으로 보냅니다. 실제 호환 여부는 확인되지 않았으니, 본격적으로 쓰기 전에 **Test Image**로 시험해 보세요.

## RunPod Serverless (ComfyUI)

기본 Base URL이 `https://api.runpod.ai/v2`인 클라우드 서비스입니다. RunPod의 서버리스 엔드포인트에서 ComfyUI 워크플로를 실행합니다. 3가지가 필요합니다. **API Key** 입력란에 넣을 RunPod API 키, **RunPod Endpoint ID**(RunPod 엔드포인트 ID), 그리고 **ComfyUI Workflow** JSON입니다. 아래 ComfyUI 워크플로 항목을 참고하세요.

## Pollinations

기본 Base URL이 `https://image.pollinations.ai`인 무료 클라우드 서비스입니다. 계정도 API 키도 필요 없습니다. 이미지 생성을 가장 빠르게 시험해 볼 수 있는 방법입니다.

## Stable Horde

기본 Base URL이 `https://stablehorde.net/api/v2`인 무료 클라우드 서비스입니다. 여러 사람이 컴퓨터 자원을 나눠 쓰는 네트워크입니다. API 키는 선택 사항입니다. 무료 키를 발급받으면 대기열에서 우선순위가 높아집니다.

## SD Web UI (AUTOMATIC1111 / Forge)

기본 Base URL이 `http://localhost:7860`인 로컬 서비스입니다. 내 컴퓨터에서 실행 중인 Stable Diffusion Web UI와 통신합니다. 이때 그 소프트웨어를 프로그램 인터페이스가 켜진 상태로 실행해야 합니다. API 키는 필요 없습니다.

## ComfyUI

기본 Base URL이 `http://127.0.0.1:8188`인 로컬 서비스입니다. 내 컴퓨터에서 실행 중인 ComfyUI 서버와 통신합니다. 아래에서 설명하는 사용자 지정 워크플로를 지원합니다. API 키는 필요 없습니다.

## SwarmUI

기본 Base URL이 `http://127.0.0.1:7801`인 로컬 서비스입니다. SwarmUI 서버와 통신하며, SwarmUI는 ComfyUI 작업을 자체 대기열로 나눠 처리할 수 있습니다. 계정이 없는 로컬 서버라면 API 키가 필요 없습니다. SwarmUI 서버에 계정이 필요하다면 **API Key**에 Swarm Auth Token을 붙여넣으세요. **Fetch Models from API**를 사용하면 SwarmUI 서버에 있는 모델 목록을 볼 수 있습니다.

SwarmUI에서는 **ComfyUI Workflow** 입력란이 선택 사항입니다. 비워 두면 SwarmUI 자체 이미지 설정을 쓰고, 아래에서 설명하는 워크플로를 붙여넣을 수도 있습니다. 각 이미지를 SwarmUI의 출력 폴더에도 남기려면 **Local Image Defaults**에서 **Save images in SwarmUI**(SwarmUI에 이미지 저장)를 켜세요. 어느 쪽이든 Marinara는 자체 사본을 보관합니다.

## Draw Things

기본 Base URL이 `http://localhost:7860`인 로컬 서비스입니다. macOS나 iOS의 Draw Things 앱과 통신합니다. Marinara는 이 서비스를 AUTOMATIC1111 서버처럼 다룹니다. API 키는 필요 없습니다.

## 네트워크 안의 로컬 서비스

`localhost`(루프백이라고도 합니다)는 Marinara를 실행 중인 바로 그 컴퓨터를 가리킵니다. 같은 컴퓨터에서 돌아가는 로컬 이미지 서버는 추가 설정 없이 그대로 작동합니다.

이미지 서버가 집 네트워크의 다른 컴퓨터에서 돌아간다면 서버 설정에서 로컬 네트워크 주소를 허용해야 합니다. 방법은 [서버 설정 참고 문서](../CONFIGURATION.md)에서 확인하세요.

제공자가 이미지 데이터 대신 URL을 돌려줄 때도 있습니다. 공개 CDN URL이라면 Marinara가 평소의 외부 요청 안전 검사를 거쳐 다운로드합니다. 사설 주소나 루프백 주소로 된 결과 URL은 설정된 이미지 제공자와 프로토콜, 호스트 이름, 포트가 정확히 일치할 때만 허용합니다. 그 사설 출처에서 시작된 리디렉션이 다른 로컬 서비스로 넘어가는 것도 막습니다. 로컬 프록시가 결과 파일을 다른 사설 출처에 저장한다면, 이미지 API와 같은 출처로 그 파일을 제공하도록 프록시를 설정하세요.

## ComfyUI 워크플로 JSON과 RunPod

**ComfyUI**, **SwarmUI**, **RunPod Serverless (ComfyUI)**를 고르면 **ComfyUI Workflow** 입력란이 나타납니다. ComfyUI에서 **Save (API Format)**(API 형식으로 저장), **Export (API)**, **Export to API** 중 하나로 내보낸 워크플로 JSON을 붙여넣으세요. 어느 항목이 있는지는 프런트엔드 버전에 따라 다릅니다. 이 입력란은 **ComfyUI**와 **SwarmUI**에서는 Optional, **RunPod Serverless (ComfyUI)**에서는 Required로 표시됩니다.

Marinara는 플레이스홀더를 이용해 워크플로를 채웁니다. 값이 들어가야 할 자리에 아래 문자열을 넣어 두세요.

- `%prompt%`와 `%negative_prompt%`는 프롬프트입니다.
- `%width%`, `%height%`, `%seed%`는 이미지 크기와 시드입니다.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%`, `%denoise%`는 생성 설정입니다.
- `%reference_image%`와 `%reference_image_01%`부터 `%reference_image_04%`까지는 참조 이미지 데이터를 주입합니다.
- `%reference_image_name%`과 `%reference_image_name_01%`부터 `%reference_image_name_04%`까지는 참조 이미지를 업로드한 뒤 그 파일 이름을 주입해 로컬 ComfyUI의 LoadImage 노드에서 쓰게 합니다.

가장 중요한 플레이스홀더는 `%prompt%`입니다. 이 플레이스홀더가 없으면 편집기가 경고합니다. **ComfyUI**에서는 입력란을 비워 두면 내장된 기본 워크플로를 씁니다. **SwarmUI**에서는 비워 두면 SwarmUI 자체 이미지 설정을 씁니다. **RunPod Serverless (ComfyUI)**에서는 엔드포인트에 기본 워크플로가 없으므로 워크플로를 반드시 넣어야 합니다. 세 서비스 모두 base64 원본 참조 이미지를 최대 4장까지 받으며, 파일 이름 업로드 방식의 플레이스홀더는 로컬 ComfyUI에서만 쓸 수 있습니다.

내보내기 전체 과정과 JSON 예시, 플레이스홀더 따옴표 규칙, 참조 이미지 설정, 캐릭터별 워크플로, LAN 접근, 문제 해결은 [ComfyUI 워크플로 설정](comfyui.md)에서 설명합니다.

## 연결마다 적용되는 Local Image Defaults

서비스가 **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI**, **RunPod Serverless (ComfyUI)** 중 하나이면 그 연결에 **Local Image Defaults**(로컬 이미지 기본값) 패널이 나타납니다. **Draw Things**와 **Arli AI**의 패널에는 **SD Web UI (AUTOMATIC1111 / Forge)**와 같은 입력란과 기본값이 표시됩니다. **SwarmUI**와 **RunPod Serverless (ComfyUI)**의 패널에는 **ComfyUI**와 같은 입력란과 기본값이 표시됩니다. 이 설정은 해당 연결로 이미지를 생성할 때만 적용됩니다. **Reset**(초기화) 버튼을 누르면 처음 값으로 되돌아갑니다.

이 서비스에는 모두 **Seed**(시드) 입력란이 있습니다. 값이 -1이면 이미지마다 무작위로 생성합니다. 다른 숫자를 넣으면 매번 똑같은 시드를 그대로 다시 씁니다.

나머지 입력란은 서비스마다 다릅니다.

| 서비스 | 입력란 | 기본값 |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG Scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2Img Denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG Scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt Guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise Schedule | karras |

서비스마다 **Prompt Prefix**(프롬프트 접두사)와 **Negative Prefix**(네거티브 접두사) 입력란도 있습니다. 여기에 넣은 글은 이 연결에서 보내는 모든 프롬프트 앞에 붙습니다. AUTOMATIC1111 / Forge와 ComfyUI에는 둘 다 **Clip Skip**(클립 건너뛰기) 입력란이 있습니다. AUTOMATIC1111 / Forge에는 **Restore faces**(얼굴 복원) 토글이 추가로 있습니다. ComfyUI에는 **Upload a 1x1 placeholder when no reference image is provided**라는 토글이 추가로 있습니다. 이 토글은 참조 이미지 플레이스홀더를 쓰는 사용자 지정 워크플로에서만 의미가 있습니다. NovelAI에는 **Guidance Rescale**(가이던스 리스케일)과 **UC Preset**(UC 프리셋) 입력란이 추가로 있습니다.

## 제공자마다 다른 참조 이미지 지원

**참조 이미지**는 프롬프트와 함께 보내는 기존 그림입니다. 새로 만드는 이미지가 캐릭터의 얼굴이나 그림체를 유지하는 데 도움이 됩니다. 몇 장까지 받는지는 제공자마다 다릅니다.

| 제공자 | 참조 이미지 |
| --- | --- |
| OpenAI (DALL-E) | 최대 16장, GPT Image 모델에서만 |
| ChatGPT (Codex login) | 최대 16장 |
| NovelAI | 최대 16장, V4.5 모델에서만 |
| xAI / Grok Imagine | 최대 3장 |
| Venice.ai | 텍스트-이미지 생성에서는 지원하지 않음 |
| Z.AI | 지금의 텍스트-이미지 연동에서는 지원하지 않음 |
| Atlas Cloud | image-to-image, edit, Kontext를 지원하는 모델 ID에서 첫 번째 이미지만 |
| SpicyAPI | 편집 모델에서만, 모델 한도까지. 더 큰 이미지는 한도에 맞게 줄임 |
| NanoGPT | 최대 3장 |
| Stability AI | 첫 번째 이미지만, image to image 방식으로 사용 |
| Arli AI | 첫 번째 이미지만, image to image 방식으로 사용 |
| SD Web UI (AUTOMATIC1111 / Forge) 및 Draw Things | 첫 번째 이미지만, image to image 방식으로 사용 |
| OpenRouter Images | 지원, 장수 제한 없음 |
| ComfyUI 및 RunPod Serverless (ComfyUI) | 최대 4장, 워크플로 플레이스홀더를 통해 |
| SwarmUI | 최대 4장 |
| Together AI, Pollinations, Stable Horde, fal.ai | 지원하지 않음 |

NovelAI의 정밀 참조 이미지는 `nai-diffusion-4-5-full` 같은 V4.5 모델에서만 작동합니다. NovelAI는 아직 V5용 Precise Reference를 출시하지 않았습니다. 다른 모델에 참조 이미지를 요청하면 Marinara는 참조 이미지 없이 이미지를 생성하고 서버 로그에 경고를 남깁니다.

## 미디어 생성 요청을 순서대로 처리하기

**Queue media generation requests**(미디어 생성 요청 대기열 사용) 토글은 **Settings**(설정) → **Generations**(생성) → **Overall Generations**(전체 생성)에 있습니다. 기본값은 켜짐입니다.

켜져 있으면 Marinara는 이미지 작업은 이미지 제공자 계정마다, 동영상 작업은 동영상 제공자 계정마다 별도의 대기열에서 하나씩 순서대로 보냅니다. 같은 계정의 이미지와 동영상은 함께 실행될 수 있습니다. 어떤 기능이 요청하든 마찬가지이며, Illustrator, 트래커, 명령, Gallery, Game 에셋, Slurp 같은 다운로드한 에이전트가 모두 여기에 해당합니다. 주소와 API 키가 같은 연결 두 개는 해당 대기열을 공유합니다. 서로 다른 계정과 제공자는 여전히 동시에 작업합니다. NovelAI는 작업 사이에 짧게 쉬기도 합니다. NovelAI가 바쁘다고 응답하면 Marinara는 이미지를 실패로 처리하지 않고 기다렸다가 두 번 다시 시도합니다.

요청 2개를 동시에 받으면 거부하는 서비스라면 켠 채로 두세요. 사용 중인 서비스가 여러 요청을 동시에 처리할 수 있고 결과를 더 빨리 받고 싶을 때만 끄세요.

## 관련 가이드

- [ComfyUI 워크플로 설정](comfyui.md) 문서에서 로컬과 RunPod용 사용자 지정 워크플로 JSON을 단계별로 설명합니다.
- [Illustrator 에이전트](illustrator-agent.md) 문서에서 장면 삽화를 자동으로 만드는 설정을 다룹니다.
- [이미지 스타일 프로필](style-profiles.md) 문서에서 생성되는 모든 이미지의 분위기를 정하는 방법을 다룹니다.
- [장면 배경과 Gallery](scene-backgrounds.md) 문서에서 자동으로 만들어지는 장면 배경을 다룹니다.
- [셀카](../conversation/selfies.md) 문서에서 Conversation(대화) 모드의 캐릭터 셀카 명령어를 다룹니다.
- [지원하는 AI 제공자](../connections/providers-reference.md) 문서에서 채팅, 이미지, 동영상 제공자를 모두 정리해 두었습니다.
