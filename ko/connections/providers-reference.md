# 지원하는 AI 제공자

이 가이드에서는 Marinara Engine이 연결할 수 있는 AI 제공자를 모두 소개합니다. 제공자마다 API 키를 받는 곳, 기본 Base URL, 알아 두면 좋은 특이점을 정리했습니다. API 키는 제공자가 발급하는 비밀번호 같은 비밀 문자열이며, 이 키가 있어야 Marinara가 해당 AI 서비스와 통신할 수 있습니다.

연결을 추가하는 일반적인 절차는 [AI 제공자에 연결하기](connecting-to-a-provider.md)에서 먼저 확인하세요. 이 페이지는 특정 제공자의 세부 사항이 궁금할 때 찾아보는 참고 자료입니다.

## 이 페이지를 읽는 법

제공자는 **Connections**(연결) 패널에서 연결을 만들 때 고릅니다. **Create Connection**(연결 만들기) 창의 **Provider**(제공자) 버튼에는 아래에 적힌 이름이 그대로 표시됩니다.

이 페이지의 제공자는 대부분 AI를 대신 실행해 주는 클라우드 서비스입니다. 제공자에 계정을 만들고 API 키를 복사한 다음 **API Key**(API 키) 입력란에 붙여넣으면 됩니다. 구독형 제공자 3곳은 키 대신 로컬 도구 로그인을 사용하며, 해당 항목에 그 내용을 적어 두었습니다.

다음 두 용어는 이 페이지에 자주 나옵니다.

- Base URL: Marinara가 요청을 보내는 웹 주소입니다. 대부분의 제공자는 이 값을 자동으로 채워 줍니다. 로컬 서버나 사용자 지정 서버를 쓸 때만 직접 바꿉니다.
- Model: 제공자를 고른 뒤 선택하는 구체적인 AI 모델입니다. 쓸 수 있는 모델은 자주 바뀌기 때문에 이 페이지에는 목록을 싣지 않았습니다. 현재 목록은 연결 편집기의 **Model**(모델) 드롭다운이나 **Fetch Models from API**(API에서 모델 가져오기) 버튼으로 확인하세요.

## OpenAI

- 키를 받는 곳: `https://platform.openai.com/api-keys`
- 기본 Base URL: `https://api.openai.com/v1`

**OpenAI**는 GPT 모델 제품군을 운영합니다. 키를 붙여넣은 뒤 드롭다운에서 모델을 고르거나 **Fetch Models from API**를 클릭해 현재 목록을 불러오세요. 이 연결은 채팅 모델 전용입니다. DALL-E 이미지를 만들려면 **Image Generation**(이미지 생성) 제공자와 그 안의 **OpenAI (DALL-E)** 서비스를 사용하세요.

## Anthropic

- 키를 받는 곳: `https://console.anthropic.com/settings/keys`
- 기본 Base URL: `https://api.anthropic.com/v1`

**Anthropic**은 Claude 모델을 운영합니다. 프롬프트 캐싱을 지원해서 긴 채팅의 비용을 낮출 수 있습니다. 연결 편집기의 **Enable prompt caching**(프롬프트 캐싱 활성화) 토글로 켜세요.

**Anthropic**은 임베딩을 제공하지 않습니다. 임베딩은 글을 숫자 목록으로 바꿔서 Marinara가 로어북과 기억을 검색할 수 있게 해 주는 기술입니다. 이런 기능을 쓰려면 임베딩용 연결을 따로 지정하세요(아래 임베딩 섹션 참고).

## Google Gemini

- 키를 받는 곳: `https://aistudio.google.com/apikey`
- 기본 Base URL: `https://generativelanguage.googleapis.com/v1beta`

**Google Gemini**는 Google AI Studio를 통해 Gemini 모델을 제공합니다. Google 계열 두 가지 선택지 중 설정이 더 간단한 쪽입니다.

## Google Vertex AI

- 자격 증명 문서: `https://cloud.google.com/vertex-ai/docs/authentication`
- 기본 Base URL: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI**는 Google Cloud 프로젝트를 통해 Gemini 모델을 제공합니다. **Google Gemini**보다 설정할 것이 많습니다. **Base URL**(기본 URL)을 직접 수정해서 `YOUR_PROJECT_ID`를 실제 프로젝트 ID로 바꿔야 합니다. 리전이 `us-central1`이 아니라면 리전도 함께 바꾸세요.

**API Key** 입력란에는 다음 세 가지 자격 증명 중 아무것이나 넣을 수 있고, 어떤 것을 붙여넣었는지는 Marinara가 알아서 판별합니다.

1. 서비스 계정 JSON 키.
2. OAuth 접근 토큰. 예를 들어 `gcloud auth print-access-token`으로 얻은 토큰입니다.
3. Vertex API 키.

## Mistral

- 키를 받는 곳: `https://console.mistral.ai/api-keys`
- 기본 Base URL: `https://api.mistral.ai/v1`

**Mistral**은 Mistral 모델 제품군을 운영합니다. API 키 외에 따로 설정할 것은 없습니다.

## Cohere

- 키를 받는 곳: `https://dashboard.cohere.com/api-keys`
- 기본 Base URL: `https://api.cohere.ai/compatibility/v1`

**Cohere**는 기본적으로 OpenAI 호환 엔드포인트를 사용합니다. 예전 Cohere v2 주소를 붙여넣어도 Marinara가 호환 엔드포인트로 바꿔 줍니다. 요청은 그대로 정상 작동합니다.

## OpenRouter

- 키를 받는 곳: `https://openrouter.ai/keys`
- 기본 Base URL: `https://openrouter.ai/api/v1`

**OpenRouter**는 여러 서비스를 한데 모아 주는 중계 서비스입니다. 키 하나로 여러 회사의 모델을 쓸 수 있습니다. 연결 편집기에 옵션 두 개가 추가됩니다.

- **Preferred Provider**(선호 제공자): **OpenRouter**가 지정한 백엔드 한 곳으로만 요청을 보내도록 하는 텍스트 입력란입니다. 이름은 OpenRouter 모델 페이지에 표시된 것과 정확히 같아야 합니다. 비워 두면 자동으로 배분합니다.
- **Enable prompt caching**: **OpenRouter**를 거쳐 쓰는 Claude 모델에 캐싱 힌트를 보냅니다. **OpenRouter**의 다른 모델은 대부분 알아서 캐싱하므로 이 옵션이 필요 없습니다.

## NanoGPT

- 키를 받는 곳: `https://nano-gpt.com/api`
- 기본 Base URL: `https://nano-gpt.com/api/v1`

**NanoGPT**도 여러 서비스를 한데 모아 주는 중계 서비스입니다. 내장 모델 목록이 없어서 **Model** 드롭다운이 비어 있는 상태로 시작합니다. 키를 붙여넣은 뒤 **Fetch Models from API**를 클릭하면 계정에서 쓸 수 있는 모델을 불러옵니다.

## xAI / Grok

- 키를 받는 곳: `https://console.x.ai`
- 기본 Base URL: `https://api.x.ai/v1`

**xAI / Grok**은 Grok 모델을 운영합니다. **Create Connection** 창에서 이 제공자를 고르면 Marinara가 모델을 Grok 4.5로 미리 채웁니다. 모델은 나중에 바꿀 수 있습니다.

## Z.AI

- 키를 받는 곳: `https://z.ai/manage-apikey/apikey-list`
- 기본 Base URL: `https://api.z.ai/api/paas/v4`

**Z.AI**는 자체 API로 GLM 모델(GLM 5.3, GLM 5.3 Flash와 이전 모델)을 제공합니다. **Model** 드롭다운에는 현재 GLM 모델이 표시되며, **Fetch Models from API**로 계정에서 목록을 새로 불러올 수 있습니다. GLM 5.3 모델은 항상 추론을 수행합니다. 프리셋의 **Reasoning Effort**(추론 강도)는 Z.AI가 지원하는 세 단계인 **Low**(낮음), **High**(높음), **Maximum**(최대)에 맞게 변환됩니다. 설정하지 않으면 Z.AI의 기본값인 **Maximum**을 사용합니다. 기본 Base URL은 사용량에 따라 과금되는 엔드포인트입니다. Z.AI의 Coding Plan은 별도의 엔드포인트를 사용하며, 이용 정책에 따라 지정된 목록의 도구에만 허용됩니다. 따라서 Coding Plan 키가 여기서 작동할 것으로 기대해서는 안 됩니다.

## Claude (Subscription)

- API 키: 없음. 키 대신 로컬 도구에 로그인합니다.

**Claude (Subscription)**은 Claude Code 도구를 통해 Anthropic Pro 또는 Max 요금제를 사용합니다. 이 도구는 Marinara 서버를 실행하는 컴퓨터에서 돌아가며, 로그인은 한 번만 하면 됩니다. 이 제공자에서는 **API Key**와 **Base URL** 입력란이 표시되지 않습니다. 임베딩은 제공하지 않습니다(아래 임베딩 섹션 참고).

설치와 로그인 절차는 [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)에서 설명합니다.

## OpenAI (ChatGPT)

- API 키: 없음. 키 대신 로컬 도구에 로그인합니다.

**OpenAI (ChatGPT)**는 Codex 도구를 통해 ChatGPT 계정을 사용합니다. 이 도구는 Marinara 서버를 실행하는 컴퓨터에서 돌아가며, 로그인은 한 번만 하면 됩니다. 이 제공자에서는 **API Key**와 **Base URL** 입력란이 표시되지 않습니다. 임베딩은 제공하지 않습니다(아래 임베딩 섹션 참고).

설치와 로그인 절차는 [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)에서 설명합니다.

## Grok CLI (Subscription)

- API 키: 없음. 키 대신 로컬 도구에 로그인합니다.

**Grok CLI (Subscription)**은 Grok CLI 도구를 통해 SuperGrok 또는 X Premium+ 계정을 사용합니다. 이 도구는 Marinara 서버를 실행하는 컴퓨터에서 돌아가며, 로그인은 한 번만 하면 됩니다. 이 제공자에서는 **API Key**와 **Base URL** 입력란이 표시되지 않습니다. 임베딩은 제공하지 않습니다(아래 임베딩 섹션 참고).

설치와 로그인 절차는 [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)에서 설명합니다.

## Custom (OAI-Compatible)

- 기본 Base URL: 없음. 직접 입력해야 합니다.

Ollama, LM Studio, KoboldCpp처럼 로컬이나 자체 호스팅으로 운영하는 모델 서버에 연결하려면 **Custom (OAI-Compatible)**을 고르세요. OpenAI 채팅 형식을 그대로 쓰는 호스팅 프록시에도 쓸 수 있습니다. 로컬 서버는 대부분 **API Key**를 비워 두어도 됩니다. **Base URL**에는 서버 주소를 입력합니다.

단계별 설정 방법과 **Treat as local/custom endpoint**(로컬/사용자 지정 엔드포인트로 취급) 토글은 [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)에서 설명합니다. Marinara에 내장된 소형 모델은 [Local Model 설정](local-model.md)을 참고하세요.

## Image Generation

**Image Generation**은 조금 특별한 제공자입니다. 이 제공자를 고른 다음에는 실제로 이미지를 만들 백엔드인 **Service**(서비스)도 함께 골라야 합니다. 서비스마다 기본 Base URL이 다르고, API 키가 필요한지도 서비스별로 다릅니다. **OpenAI (DALL-E)**, **Stability AI**, **NovelAI**, **Z.AI** 같은 유료 클라우드 API가 있고, **Pollinations**와 **Stable Horde** 같은 무료 선택지도 있습니다. **ComfyUI**나 **SD Web UI (AUTOMATIC1111 / Forge)** 같은 로컬 서버도 쓸 수 있습니다.

이미지 서비스 전체 목록과 설정 방법, 생성 옵션은 [이미지 생성 제공자와 설정](../media/image-providers.md)에서 다룹니다.

## Video Generation

**Video Generation**(동영상 생성)도 특별한 제공자로, 전용 **Video Service**(동영상 서비스) 선택 항목이 있습니다. Game Mode는 이 기능으로 짧은 MP4 장면 동영상을 만듭니다. 서비스는 **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **Seedance 2.0**이며, 모두 API 키가 필요합니다.

동영상 서비스별 설정 방법과 제한은 [장면 동영상 생성](../media/scene-video.md)에서 다룹니다.

## 임베딩

임베딩은 로어북 시맨틱 검색과 **Memory Recall**(기억 회상) 기능을 뒷받침합니다. 글을 숫자 목록으로 바꿔서 Marinara가 관련 항목을 찾을 수 있게 해 줍니다. 채팅 제공자는 대부분 연결 편집기에서 **Embedding Model**(임베딩 모델)을 지정할 수 있고, **Embedding Endpoint URL**(임베딩 엔드포인트 URL)도 선택적으로 설정할 수 있습니다.

일부 제공자는 임베딩을 만들지 못합니다. **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)**, **Grok CLI (Subscription)**은 임베딩을 제공하지 않습니다. 이럴 때는 **Embedding Connection**(임베딩 연결) 드롭다운으로 다른 연결을 빌려 쓰세요. OpenAI 호환 연결이나 **Google Gemini**, 내장 **Local Model**을 쓰면 됩니다.

## 관련 가이드

- [AI 제공자에 연결하기](connecting-to-a-provider.md)
- [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)
- [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)
- [이미지 생성 제공자와 설정](../media/image-providers.md)
- [장면 동영상 생성](../media/scene-video.md)
