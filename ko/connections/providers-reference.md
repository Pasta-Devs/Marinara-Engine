# 지원하는 AI 제공자

이 페이지는 Marinara Engine이 연결할 수 있는 주요 서비스의 참고 자료입니다. 서비스마다 API 키를 받는 곳, 기본 주소, 특이점을 정리했습니다. 계정을 단계별로 추가하려면 먼저 [AI 제공자에 연결하기](connecting-to-a-provider.md)를 읽으세요.

서비스는 **Add account**(계정 추가) 창에서 그 서비스가 하는 일에 맞는 섹션 아래에서 고릅니다. 섹션은 **Chat**(채팅), **Images & video**(이미지 및 동영상), **Voice**(음성), **Decisions**(판단)입니다. 타일에는 아래에 적힌 이름이 표시됩니다. 주소는 Marinara가 요청을 보내는 웹 주소입니다. 계정 편집기에서는 **Address**(주소), 모델 편집기에서는 **Base URL**(기본 URL)이라고 부릅니다. 알려진 서비스라면 Marinara가 주소를 채워 줍니다. 프록시나 직접 실행하는 서버를 쓸 때만 바꾸세요.

모델은 자주 바뀌므로 이 페이지에는 목록을 싣지 않았습니다. 연결하면 선택 창에 모델 목록을 불러옵니다. 다시 불러오려면 선택 창에서 **Refresh model list**(모델 목록 새로고침)를 클릭하세요.

## 채팅 서비스

이 서비스들은 API 키를 사용합니다. 단, 구독형 서비스 3곳은 내 컴퓨터의 로그인을 사용합니다.

| 서비스 | 키를 받는 곳 |
| --- | --- |
| LinkAPI | `linkapi.ai` |
| OpenAI | `platform.openai.com/api-keys` |
| Anthropic | `console.anthropic.com/settings/keys` |
| Google Gemini | `aistudio.google.com/apikey` |
| Google Vertex AI | `cloud.google.com/vertex-ai/docs/authentication`(자격 증명 안내) |
| Mistral | `console.mistral.ai/api-keys` |
| Cohere | `dashboard.cohere.com/api-keys` |
| OpenRouter | `openrouter.ai/keys` |
| NanoGPT | `nano-gpt.com/api` |
| xAI / Grok | `console.x.ai` |
| Arli AI | `www.arliai.com/account` |
| Z.AI | `z.ai/manage-apikey/apikey-list` |
| DeepSeek | `platform.deepseek.com/api_keys` |
| OpenAI-compatible, Claude (Subscription), OpenAI (ChatGPT), Grok CLI (Subscription) | 키 페이지가 없습니다. 아래 참고 사항을 확인하세요. |

기본 주소는 다음과 같으며, Marinara가 대신 채워 줍니다.

- LinkAPI: `https://linkapi.ai/v1`(자체 키를 쓰는 OpenAI 호환 게이트웨이)
- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Google Vertex AI:
  `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`
- Mistral: `https://api.mistral.ai/v1`
- Cohere: `https://api.cohere.ai/compatibility/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- NanoGPT: `https://nano-gpt.com/api/v1`
- xAI / Grok: `https://api.x.ai/v1`
- Arli AI: `https://api.arliai.com/v1`
- Z.AI: `https://api.z.ai/api/paas/v4`
- DeepSeek: `https://api.deepseek.com/v1`
- OpenAI-compatible과 구독형 서비스: 없음. 주소를 직접 입력하거나, 주소가 필요하지 않습니다.

모든 키 페이지 주소는 `https://`로 시작합니다.

구독형 서비스 3곳에서는 **API key**(API 키)와 주소 입력란이 표시되지 않습니다. 임베딩도 제공하지 않습니다. 설치와 로그인 절차는 [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)에서 설명하며, 이 가이드는 플랜 사용량도 다룹니다.

중계 서비스는 키 하나로 여러 회사의 모델을 쓸 수 있는 서비스입니다. OpenRouter와 NanoGPT가 중계 서비스입니다. 게이트웨이는 직접 실행하거나 빌려 쓰는 프록시에 같은 개념을 적용한 것입니다.

## 서비스별 참고 사항

### OpenAI

**OpenAI**는 GPT 모델을 운영합니다. DALL-E 이미지를 만들려면 **OpenAI**를 추가하고 같은 계정에서 **Image**(이미지) 모델을 고르세요. 같은 키로 이미지를 만드는 다른 서비스도 마찬가지입니다.

### Anthropic

**Anthropic**은 Claude 모델을 운영합니다. 프롬프트 캐싱을 쓰면 서비스가 프롬프트의 앞부분을 재사용하므로 긴 채팅의 비용을 낮출 수 있습니다. 모델 편집기의 **Enable prompt caching**(프롬프트 캐싱 활성화)으로 켜세요. **Anthropic**은 임베딩을 제공하지 않습니다([임베딩](#embeddings) 참고).

### Google Gemini와 Google Vertex AI

**Google Gemini**는 Google AI Studio를 통해 Gemini 모델을 제공합니다. Google 계열 선택지 중 더 간단한 쪽입니다. Marinara는 Google 계열 두 선택지 모두에서 Google의 조정 가능한 안전 필터를 끕니다. 단, **Custom Parameters**(사용자 지정 매개변수)에서 직접 설정한 카테고리는 예외입니다. 아동 안전 같은 Google의 핵심 보호 장치는 계속 적용됩니다.

**Google Vertex AI**는 Google Cloud 프로젝트를 통해 Gemini를 제공하며, 설정할 것이 더 많습니다. 주소를 수정해 `YOUR_PROJECT_ID`를 내 프로젝트 ID로 바꾸세요. 리전이 `us-central1`이 아니라면 리전도 바꾸세요. **API key** 입력란에는 다음 중 아무것이나 넣을 수 있으며, 어떤 것을 붙여넣었는지는 Marinara가 판별합니다.

1. 서비스 계정 JSON 키(Google Cloud가 발급하는, 서비스 계정을 지정한 파일).
2. OAuth 접근 토큰. 예를 들어 `gcloud auth print-access-token`으로 얻은 토큰입니다.
3. Vertex API 키.

Google 문서를 따른 Marinara 코드의 주석에 따르면, **Gemini 4 Argon**과 **Gemini 4 Carbon**은 `us-central1` 같은 단일 리전이 아닌 `global`, `us`, `eu` 위치에서만 실행됩니다. 둘 중 하나를 사용하려면 주소를 `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`로 설정하세요. 다른 위치를 쓰면 Google이 오류를 돌려주고 Marinara가 그 오류를 표시합니다.

### Cohere

**Cohere**는 OpenAI 호환 엔드포인트를 사용합니다. 예전 Cohere v2 주소를 붙여넣으면 Marinara가 호환 엔드포인트로 바꿔 줍니다.

### OpenRouter

**OpenRouter**는 중계 서비스이며, 모델 편집기에 옵션 두 개가 추가됩니다.

- **Preferred provider**(선호 제공자)는 요청을 지정한 백엔드 한 곳으로만 보냅니다. 이름은 OpenRouter 모델 페이지에 표시된 것과 같아야 합니다. 비워 두면 자동으로 배분합니다.
- **Enable prompt caching**은 OpenRouter를 거쳐 쓰는 Claude 모델에 캐싱 힌트를 보냅니다. 다른 모델은 대부분 알아서 캐싱합니다.

### NanoGPT

**NanoGPT**는 내장 모델 목록이 없는 중계 서비스입니다. 연결하면 선택 창에 계정에서 쓸 수 있는 모델을 불러옵니다. 선택 창은 NanoGPT의 상세 카탈로그를 읽고, 구독에 포함된 모델을 표시합니다.

| 배지 | 의미 |
| --- | --- |
| 초록색 `1x` | 구독에 포함되며 일반 비율로 소비합니다. |
| `2x` 같은 더 큰 값 | 구독에 포함되지만, 입력 토큰 하나가 할당량에서 그 배수만큼의 토큰을 소비합니다. |
| **Paid**(유료) | 구독에 포함되지 않습니다. 사용료는 유료 잔액에서 청구됩니다. |
| 배지 없음 | NanoGPT에 해당 모델의 구독 정보가 없었습니다. |

#### 구독 사용량

NanoGPT 구독이 있다면 계정에서 현재 할당량을 확인할 수 있습니다.

1. 계정 행의 **⋯**을 클릭하고 **Edit account**(계정 편집)를 고른 다음 **Usage and balance**(사용량 및 잔액)를 여세요.
2. 외부 조회가 꺼져 있으면 **Turn on**(켜기)을 클릭하세요. 관리 키를 추가하려면 **Add a usage-only key**(사용량 전용 키 추가)를 클릭하고 키를 붙여넣은 다음 **Show usage**(사용량 표시)를 클릭하세요.
3. **Show the usage meter on the card**(카드에 사용량 미터 표시)를 켜고 저장하세요.

미터는 주간 및 일일 입력 토큰 할당량을, 남은 양과 각각 초기화되는 시점과 함께 표시합니다. 예를 들면 `42M remaining · resets in 4d`입니다. NanoGPT가 보고할 수 없는 할당량은 미사용이 아닌 알 수 없음으로 표시됩니다. 비활성 구독은 할당량이 가득 찬 것처럼 그리지 않고 비활성 상태임을 알립니다. 새로고침 버튼을 누르면 다시 읽어 옵니다.

사용량은 두 가지 인증 정보로 읽을 수 있습니다.

- **관리 키**(권장). `https://nano-gpt.com/settings#management-api-tokens`에서 사용량 조회 전용으로 만드세요. 할당량은 읽을 수 있지만 모델을 실행하거나 잔액을 쓸 수는 없습니다. Marinara는 이 키를 암호화해 저장하고 NanoGPT 관리 엔드포인트에만 보냅니다.
- **내 API 키**. 관리 키가 저장되어 있지 않을 때 사용합니다. 작동은 하지만, 이때는 잔액을 쓸 수 있는 키로 할당량을 읽게 됩니다.

같은 미터가 채팅 연결 선택기의 컨텍스트 막대 아래와 채팅의 **Connection**(연결) 설정에도 표시됩니다. 채팅의 모델이 미터를 켠 NanoGPT 모델일 때만 표시되며, **Shuffle**(셔플)에는 표시되지 않습니다.

### xAI / Grok

**xAI / Grok**은 Grok 모델을 운영합니다. Grok 4.6과 4.7은 500,000토큰 컨텍스트 창과 **Extra high**(매우 높음)까지의 추론을 제공합니다. **Web Search**(웹 검색)를 비롯한 채팅 도구를 지원하므로 검색 결과를 최종 답변에 활용할 수 있습니다.

### Arli AI

**Arli AI**는 내장 모델 목록이 없는 호스팅 채팅 서비스입니다. 연결하면 선택 창에 모델을 불러옵니다. Arli AI로 이미지를 만들려면 **Arli AI**를 추가하고 같은 계정에서 **Image** 모델을 고르세요.

### Z.AI

**Z.AI**는 자체 API로 GLM 모델(GLM 5.3, GLM 5.3 Flash와 이전 모델)을 제공합니다. GLM 5.2와 5.3 모델은 **Maximum**(최대) 추론 단계를 지원합니다. 기본 주소는 사용량에 따라 과금되는 엔드포인트입니다. Z.AI의 Coding Plan은 다른 엔드포인트를 사용하므로 Coding Plan 키는 여기서 작동하지 않을 수 있습니다.

### DeepSeek

**DeepSeek**는 `deepseek-flash`와 `deepseek-v4-pro`를 제공합니다. DeepSeek는 기본적으로 사고 기능을 사용합니다. **Reasoning Effort**(추론 강도)는 DeepSeek 자체 단계를 사용하며, **Off**(꺼짐)를 고르면 해당 요청에서 사고 기능을 끕니다. DeepSeek는 중간 단계 요청을 High로 처리합니다. 사고 내용은 평소와 같은 생각 과정 표시로 답변에 나타납니다.

일부 파라미터는 적용되지 않으므로 패널에 표시되지 않습니다. **Verbosity**(상세도), **Top K**, 페널티 설정은 지원이 종료되어 무시됩니다. **Temperature**(온도)와 **Top P**는 한 쌍입니다. DeepSeek는 한 번에 둘 중 하나만 사용하기 때문입니다. 사고 기능이 꺼져 있으면 **Temperature**가, 켜져 있으면 **Top P**가 표시됩니다.

DeepSeek에 연결할 때는 **OpenAI**에 DeepSeek의 주소를 지정하지 말고 전용 타일을 사용하세요. OpenAI 서비스는 OpenAI 모델을 전제로 하므로, DeepSeek 모델에서는 생성 설정 항목을 숨기고 지정한 설정을 거의 보내지 않습니다.

### OpenAI-compatible

**OpenAI-compatible**은 Ollama, LM Studio, KoboldCpp처럼 OpenAI 요청 형식을 받는 서버나 프록시를 연결합니다. **Add account** 창에서는 **OpenAI-compatible address**(OpenAI 호환 주소)로 표시됩니다. 로컬 서버는 대부분 키를 비워 두어도 됩니다. 주소는 직접 입력합니다. [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)를 참고하세요. Marinara가 직접 실행하는 소형 모델은 [내장 모델 설정](local-model.md)을 참고하세요.

## 이미지와 동영상

**Images & video** 아래의 타일은 저마다 주소가 다르고, 키가 필요한지도 타일마다 다릅니다. 타일은 Stability AI, Together AI, NovelAI, Venice.ai, Atlas Cloud, fal.ai, SpicyAPI, Pollinations, Stable Horde, Seedance 2.0과 로컬 서버인 ComfyUI, SD Web UI (AUTOMATIC1111 / Forge), SwarmUI, RunPod Serverless (ComfyUI), Draw Things, Block Entropy입니다. Draw Things, ComfyUI, SwarmUI, SD Web UI, RunPod에는 **Self-hosted**(자체 호스팅) 태그가 붙어 있습니다.

OpenAI, OpenRouter, xAI, NanoGPT, Arli AI, Z.AI, Google의 이미지 및 동영상 모델은 해당 서비스의 채팅 계정에서 가져옵니다. 채팅 계정을 추가한 다음 그 계정에서 **Image**나 **Video**(비디오) 모델을 고르세요.

[이미지 생성 제공자와 설정](../media/image-providers.md)과 [장면 동영상 생성](../media/scene-video.md)을 참고하세요.

## Decision

**Decisions** 아래의 타일은 **TypeSafe**(기본 주소 `https://api.typesafe.ai`), **Own decision server**(자체 판단 서버), **Built-in model (decisions)**(결정 사이드카, 실험적)입니다. OpenAI 채팅 형식을 쓰는 채팅 서비스도 판정을 할 수 있지만, 로그 확률(가능한 답마다 매기는 점수)을 반환하는 모델에서만 가능합니다. Decision 모델은 채팅에 관한 예/아니요 질문에 답합니다. [Decision 모델](decision-models.md)을 참고하세요.

## Audio

**Voice** 아래의 오디오 서비스는 캐릭터 목소리와 내레이션을 읽어 줍니다. **Audio source**(오디오 소스)를 고르세요.

| 소스 | 설명 |
| --- | --- |
| ElevenLabs | 캐릭터 목소리와 내레이션을 제공합니다. |
| OpenAI-compatible | OpenAI, 또는 OpenAI의 음성 형식을 그대로 따르는 서버입니다. |
| PocketTTS | 내 컴퓨터에서 직접 실행하는 무료 음성 서버입니다. |
| xAI Voice | xAI의 음성 서비스입니다. |

소스마다 기본 주소와 모델이 채워집니다. **Default voice**(기본 음성)는 캐릭터별 음성처럼 더 구체적인 설정이 없을 때 쓰는 음성입니다. **Request timeout (seconds)**(요청 제한 시간, 초)는 Marinara가 음성 대사 한 줄을 기다리는 시간입니다. 음성 서버가 느리다면 값을 올리세요.

Marinara가 기본으로 쓸 음성 계정을 고르려면 **Jobs**(작업) 상자에서 **Voice (Text to Speech)**(음성, TTS) 행을 클릭하세요. 그 계정으로 메시지를 소리 내어 읽으려면 **Text to Speech**(TTS) 카드에서 그 계정을 **Source**(연결 소스)로 고르세요. [Text to Speech(TTS) 설정](../media/tts-setup.md)과 [오디오 연결 사용하기](../media/tts-setup.md#use-an-audio-connection)를 참고하세요.

<a id="music--sound-effects"></a>

## Music & Sound Effects

이 계정 유형은 음성과 별개로 연주곡과 효과음을 만듭니다. **Add account** 창에는 이 유형의 타일이 없습니다. 이런 계정은 업그레이드(아래 참고)나 가져오기로 생깁니다. 계정은 **Edit model**(모델 편집)에서 편집하며, 여기서 서비스를 고르고 **Music generation**(음악 생성), **Sound-effect generation**(효과음 생성) 또는 둘 다 켭니다. Game 설정에서는 **Music & Sound Effects account**(음악 및 효과음 연결)에서 계정을 고르며, 기본 선택은 **Use the default Music & Sound Effects account**(기본 음악 및 효과음 연결 사용)입니다.

서비스는 다음과 같습니다.

- **ElevenLabs**: 기본 주소는 `https://api.elevenlabs.io`입니다. ElevenLabs 키가 필요합니다. 음악과 효과음의 모델 입력란이 따로 있습니다.
- **SunoAPI**: 기본 주소는 `https://apibox.erweima.ai`입니다. [sunoapi.org](https://sunoapi.org/)의 키가 필요하며, 음악을 켜면 공개 HTTPS **SunoAPI music callback URL**(SunoAPI 음악 콜백 URL)도 필요합니다. Suno 구독 로그인이 아닌 SunoAPI 자체 서비스입니다.
- **Custom compatible server**(사용자 지정 호환 서버): 내 서버의 주소입니다. 명시적인 음악 또는 효과음 엔드포인트 경로와 지원하는 요청 형식이 필요합니다. [호환 오디오 규약](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server)을 참고하세요.

참고 사항:

- Marinara가 완성된 트랙을 직접 확인하지만, SunoAPI에는 그래도 콜백 주소가 필요합니다. 주소는 직접 제공해야 합니다. Marinara가 만들어 주지 않습니다.
- 음악 스타일 프롬프트는 최대 1,000자, 효과음 프롬프트는 최대 500자입니다.
- 요청마다 제공자 요금이 발생할 수 있습니다. [음악 API](https://docs.sunoapi.org/suno-api/generate-music)와 [효과음 API](https://docs.sunoapi.org/suno-api/generate-sounds)를 참고하세요. SunoAPI 효과음은 아직 유료 계정으로 검증하지 않았습니다.

업그레이드하면 생성 기능이 켜진 각 Audio 계정에 별도의 Music & Sound Effects 계정이 추가됩니다. 예전에 따로 저장한 ElevenLabs Game 설정도 자체 계정을 만들 수 있으므로 계정이 여러 개 보일 수 있습니다. 음성 계정과 목소리 지정은 그대로이며, 저장된 Game 계정 ID도 바뀌지 않습니다. 생성은 해당하는 이전된 계정을 사용할 수 있고 그 계정에서 음악 또는 효과음 옵션이 켜져 있을 때만 작동합니다. 그렇지 않으면 적합한 다른 계정을 고르세요. 이전된 계정을 삭제해도 재시작할 때 다시 만들어지지 않습니다. 프로필에서 복원한 엔드포인트는 로컬에서 검토하고 저장하기 전까지 사용할 수 없습니다.

Game마다 오디오 생성을 켜거나, Roleplay의 명령 설정에서 **Sound effects**(효과음)를 켜서 `[sound: description]`을 사용하세요. Gacha Forge에는 별도의 오디오 생성 설정이 있습니다. 생성을 꺼도 기본 제공 Game 오디오는 계속 사용할 수 있습니다.

<a id="embeddings"></a>

## 임베딩

임베딩은 텍스트를 숫자 목록으로 바꿔 Marinara가 관련 텍스트를 찾을 수 있게 합니다. 로어북 시맨틱 검색과 Memory Recall(기억 회상)이 임베딩을 사용합니다. 채팅 서비스는 대부분 모델 편집기의 **Semantic search (embeddings)**(시맨틱 검색) 아래에서 임베딩 모델과 선택 사항인 **Embedding endpoint URL**(임베딩 엔드포인트 URL)을 설정할 수 있습니다.

**Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)**, **Grok CLI (Subscription)**은 임베딩을 만들 수 없습니다. 이런 서비스에서는 **Embedding provider**(임베딩 연결) 드롭다운으로 다른 계정을 빌려 쓰세요. OpenAI 호환 계정, **Google Gemini**, **Built-in model**(내장 모델) 등을 쓸 수 있습니다.

자체 임베딩 설정이 없는 모든 계정에 임베딩 소스 하나를 쓰려면 **Jobs** 상자에서 **Embeddings**(임베딩) 행을 클릭하세요. **Marinara's own search**(없음, 내장 로컬 모델)는 내장 임베딩 모델을 계속 사용합니다. 계정에 직접 설정한 임베딩 모델이나 **Embedding provider**가 여전히 우선합니다. 이 값을 바꾼 뒤에는 로어북과 기억을 다시 벡터화하세요. [로어북 시맨틱 검색](../lorebooks/semantic-search.md)을 참고하세요.

## 타임아웃

느린 모델은 채팅 답변과 에이전트 호출에 대한 서버의 타임아웃에 걸릴 수 있습니다. 관련 서버 설정은 [서버 설정 참고 문서](../CONFIGURATION.md)에 있습니다.

## 관련 가이드

- [AI 제공자에 연결하기](connecting-to-a-provider.md)
- [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)
- [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)
- [이미지 생성 제공자와 설정](../media/image-providers.md)
- [장면 동영상 생성](../media/scene-video.md)
- [Decision 모델](decision-models.md)
- [Text to Speech(TTS) 설정](../media/tts-setup.md)
