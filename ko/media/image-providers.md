# 이미지 생성 제공자와 설정

이 가이드에서는 이미지 생성 서비스를 Marinara Engine에 연결하는 방법을 설명합니다. 17가지 서비스마다 무엇이 필요한지도 함께 다룹니다. 이미지 생성은 장면 삽화, 셀카, 장면 배경, 그리고 자동으로 만들어지는 아바타와 초상화, 스프라이트에 쓰입니다.

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

17가지 서비스는 크게 3가지로 나뉩니다. 클라우드 서비스는 계정과 API 키가 필요합니다. 무료 서비스는 키가 필요 없습니다. 로컬 서비스는 이미지 생성 소프트웨어를 내 컴퓨터에서 직접 실행합니다.

아래 표에서 각 서비스를 한눈에 볼 수 있습니다. 세부 사항과 주의점은 이어지는 서비스별 항목에서 설명합니다.

| 서비스 | API 키 | 실행 위치 |
| --- | --- | --- |
| OpenAI (DALL-E) | 필요 | 클라우드 |
| Stability AI | 필요 | 클라우드 |
| Together AI | 필요 | 클라우드 |
| NovelAI | 필요 | 클라우드 |
| OpenRouter Images | 필요 | 클라우드 |
| xAI / Grok Imagine | 필요 | 클라우드 |
| Venice.ai | 필요 | 클라우드 |
| Z.AI | 필요 | 클라우드 |
| Atlas Cloud | 필요 | 클라우드 |
| NanoGPT | 필요 | 클라우드 |
| Block Entropy | 필요 | 클라우드 |
| RunPod Serverless (ComfyUI) | 필요 | 클라우드 |
| Pollinations | 불필요 | 무료 클라우드 |
| Stable Horde | 선택 | 무료 클라우드 |
| SD Web UI (AUTOMATIC1111 / Forge) | 불필요 | 로컬 |
| ComfyUI | 불필요 | 로컬 |
| Draw Things | 불필요 | 로컬 |

## OpenAI (DALL-E)

기본 Base URL이 `https://api.openai.com/v1`인 클라우드 서비스입니다. OpenAI 계정에서 발급한 API 키가 필요합니다. DALL-E와 GPT Image 모델을 제공합니다. 참조 이미지는 최대 16장까지 받습니다.

## Stability AI

기본 Base URL이 `https://api.stability.ai/v2beta`인 클라우드 서비스입니다. Stability AI API 키가 필요합니다. Stable Diffusion과 Stable Image 모델을 제공합니다.

## Together AI

기본 Base URL이 `https://api.together.xyz/v1`인 클라우드 서비스입니다. Together AI API 키가 필요합니다. FLUX를 비롯한 공개 이미지 모델을 제공합니다.

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

기본 Base URL이 `https://api.atlascloud.ai/api/v1`인 클라우드 서비스입니다. Atlas Cloud API 키가 필요합니다. Marinara는 Nano Banana, Gemini Flash Image, FLUX 1.1 Pro를 담은 간단한 기본 목록을 제공하며, 다른 Atlas Cloud 이미지 모델 ID를 정확히 입력해서 쓸 수도 있습니다. 작업은 비동기로 처리되므로, Marinara가 생성을 시작한 뒤 이미지가 완성될 때까지 Atlas Cloud에 상태를 계속 확인합니다. 일반적인 텍스트-이미지 설정은 자동으로 연결됩니다. 참조 이미지는 image-to-image, edit, Kontext 동작을 지원한다고 표시된 모델 ID에만 보냅니다. Atlas의 모델 스키마는 모델마다 다를 수 있으니, 다른 모델 ID를 쓸 때는 그 모델의 Atlas Cloud 문서를 확인하세요.

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

## Draw Things

기본 Base URL이 `http://localhost:7860`인 로컬 서비스입니다. macOS나 iOS의 Draw Things 앱과 통신합니다. Marinara는 이 서비스를 AUTOMATIC1111 서버처럼 다룹니다. API 키는 필요 없습니다.

## 네트워크 안의 로컬 서비스

`localhost`(루프백이라고도 합니다)는 Marinara를 실행 중인 바로 그 컴퓨터를 가리킵니다. 같은 컴퓨터에서 돌아가는 로컬 이미지 서버는 추가 설정 없이 그대로 작동합니다.

이미지 서버가 집 네트워크의 다른 컴퓨터에서 돌아간다면 서버 설정에서 로컬 네트워크 주소를 허용해야 합니다. 방법은 [서버 설정 참고 문서](../CONFIGURATION.md)에서 확인하세요.

제공자가 이미지 데이터 대신 URL을 돌려줄 때도 있습니다. 공개 CDN URL이라면 Marinara가 평소의 외부 요청 안전 검사를 거쳐 다운로드합니다. 사설 주소나 루프백 주소로 된 결과 URL은 설정된 이미지 제공자와 프로토콜, 호스트 이름, 포트가 정확히 일치할 때만 허용합니다. 그 사설 출처에서 시작된 리디렉션이 다른 로컬 서비스로 넘어가는 것도 막습니다. 로컬 프록시가 결과 파일을 다른 사설 출처에 저장한다면, 이미지 API와 같은 출처로 그 파일을 제공하도록 프록시를 설정하세요.

## ComfyUI 워크플로 JSON과 RunPod

**ComfyUI**와 **RunPod Serverless (ComfyUI)**를 고르면 **ComfyUI Workflow** 입력란이 나타납니다. ComfyUI에서 **Save (API Format)**(API 형식으로 저장), **Export (API)**, **Export to API** 중 하나로 내보낸 워크플로 JSON을 붙여넣으세요. 어느 항목이 있는지는 프런트엔드 버전에 따라 다릅니다. 이 입력란은 **ComfyUI**에서는 Optional, **RunPod Serverless (ComfyUI)**에서는 Required로 표시됩니다.

Marinara는 플레이스홀더를 이용해 워크플로를 채웁니다. 값이 들어가야 할 자리에 아래 문자열을 넣어 두세요.

- `%prompt%`와 `%negative_prompt%`는 프롬프트입니다.
- `%width%`, `%height%`, `%seed%`는 이미지 크기와 시드입니다.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%`, `%denoise%`는 생성 설정입니다.
- `%reference_image%`와 `%reference_image_01%`부터 `%reference_image_04%`까지는 참조 이미지 데이터를 주입합니다.
- `%reference_image_name%`과 `%reference_image_name_01%`부터 `%reference_image_name_04%`까지는 참조 이미지를 업로드한 뒤 그 파일 이름을 주입해 로컬 ComfyUI의 LoadImage 노드에서 쓰게 합니다.

가장 중요한 플레이스홀더는 `%prompt%`입니다. 이 플레이스홀더가 없으면 편집기가 경고합니다. **ComfyUI**에서는 입력란을 비워 두면 내장된 기본 워크플로를 씁니다. **RunPod Serverless (ComfyUI)**에서는 엔드포인트에 기본 워크플로가 없으므로 워크플로를 반드시 넣어야 합니다. 두 서비스 모두 base64 원본 참조 이미지를 최대 4장까지 받으며, 파일 이름 업로드 방식의 플레이스홀더는 로컬 ComfyUI에서만 쓸 수 있습니다.

내보내기 전체 과정과 JSON 예시, 플레이스홀더 따옴표 규칙, 참조 이미지 설정, 캐릭터별 워크플로, LAN 접근, 문제 해결은 [ComfyUI 워크플로 설정](comfyui.md)에서 설명합니다.

## 연결마다 적용되는 Local Image Defaults

서비스가 **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things** 중 하나이면 그 연결에 **Local Image Defaults**(로컬 이미지 기본값) 패널이 나타납니다. **Draw Things**의 패널에는 **SD Web UI (AUTOMATIC1111 / Forge)**와 같은 입력란과 기본값이 표시됩니다. 이 설정은 해당 연결로 이미지를 생성할 때만 적용됩니다. **Reset**(초기화) 버튼을 누르면 처음 값으로 되돌아갑니다.

이 4가지 서비스에는 모두 **Seed**(시드) 입력란이 있습니다. 값이 -1이면 이미지마다 무작위로 생성합니다. 다른 숫자를 넣으면 매번 똑같은 시드를 그대로 다시 씁니다.

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
| OpenAI (DALL-E) | 최대 16장 |
| NovelAI | 최대 16장, V4.5 모델에서만 |
| xAI / Grok Imagine | 최대 3장 |
| Venice.ai | 텍스트-이미지 생성에서는 지원하지 않음 |
| Z.AI | 지금의 텍스트-이미지 연동에서는 지원하지 않음 |
| Atlas Cloud | image-to-image, edit, Kontext를 지원하는 모델 ID에서 첫 번째 이미지만 |
| NanoGPT | 최대 3장 |
| Stability AI | 첫 번째 이미지만, image to image 방식으로 사용 |
| OpenRouter Images | 지원, 장수 제한 없음 |
| ComfyUI 및 RunPod Serverless (ComfyUI) | 최대 4장, 워크플로 플레이스홀더를 통해 |
| Together AI, Pollinations, Stable Horde | 지원하지 않음 |

NovelAI의 정밀 참조 이미지는 `nai-diffusion-4-5-full` 같은 V4.5 모델에서만 작동합니다. NovelAI는 아직 V5용 Precise Reference를 출시하지 않았습니다. 다른 모델에 참조 이미지를 요청하면 Marinara는 참조 이미지 없이 이미지를 생성하고 서버 로그에 경고를 남깁니다.

## 이미지 생성 요청을 순서대로 처리하기

**Queue image generation requests**(이미지 생성 요청 대기열 처리) 토글은 **Settings**(설정) → **Generations**(생성) → **Image Generation**에 있습니다. 기본값은 켜짐입니다.

켜져 있으면 Marinara가 이미지 작업을 하나씩 순서대로 보냅니다. 요청 2개를 동시에 받으면 거부하는 서비스라면 켠 채로 두세요. 사용 중인 서비스가 여러 요청을 동시에 처리할 수 있고 결과를 더 빨리 받고 싶을 때만 끄세요.

## 관련 가이드

- [ComfyUI 워크플로 설정](comfyui.md) 문서에서 로컬과 RunPod용 사용자 지정 워크플로 JSON을 단계별로 설명합니다.
- [Illustrator 에이전트](illustrator-agent.md) 문서에서 장면 삽화를 자동으로 만드는 설정을 다룹니다.
- [이미지 스타일 프로필](style-profiles.md) 문서에서 생성되는 모든 이미지의 분위기를 정하는 방법을 다룹니다.
- [장면 배경과 Gallery](scene-backgrounds.md) 문서에서 자동으로 만들어지는 장면 배경을 다룹니다.
- [셀카](../conversation/selfies.md) 문서에서 Conversation(대화) 모드의 캐릭터 셀카 명령어를 다룹니다.
- [지원하는 AI 제공자](../connections/providers-reference.md) 문서에서 채팅, 이미지, 동영상 제공자를 모두 정리해 두었습니다.
