# Decision 모델

이 가이드에서는 **Decision model**(판정 모델)이 무엇인지, 이용하는 3가지 방법, 각각의 설정 방법과 Marinara에서 쓰이는 곳을 설명합니다. 이 기능은 선택 사항입니다. 설정하지 않아도 채팅은 생성되지만 각 기능은 아래에 설명한 대체 동작을 사용합니다.

## Decision 모델의 역할

Decision 모델은 한 종류의 질문에 답합니다. 채팅의 최근 메시지와 "The latest message moves the scene to a new place" 같은 문장을 받아 그 문장이 참일 가능성을 0부터 1까지의 숫자로 반환합니다. Marinara는 이 숫자를 임계값과 비교해 예 또는 아니요로 처리합니다. "angry", "sad", "none of these"처럼 짧은 목록에서 답 하나를 고를 수도 있습니다.

답은 Marinara의 동작을 제어하며 채팅 답글로 게시되지 않습니다. 판정 전용 모델은 문장을 직접 평가합니다. 로컬 채팅 모델에는 보통 예/아니요 토큰 하나를 요청하지만, 먼저 추론해야 하는 모델도 있습니다. 판정은 전체 답글보다 빠를 수 있지만 문장이 많거나 추론 모델을 쓰면 대기 시간이 눈에 띄게 늘 수 있습니다.

<a id="where-marinara-uses-it"></a>

## Marinara에서 사용하는 곳

- **[활성화 질문](../agents/custom-agents.md#activation-questions)**은 사용자 지정 에이전트가 자기 단계에서 작업을 시작하기 전에 실행 여부를 결정합니다. 답이 없으면 질문이 실행을 막지 않습니다. 키워드와 **Trigger Cadence**(실행 주기)는 계속 적용됩니다.
- **[프롬프트 판정문](../prompts/conditional-prompts.md#asking-the-decision-model)**은 채팅이나 에이전트 프롬프트를 준비할 때 텍스트를 선택합니다. 답이 없으면 아니요로 처리하므로 단순 판정 블록은 `{{else}}` 분기가 있으면 그 분기를 사용합니다.
- **[로어북 Decision 필드](../lorebooks/entries.md#decision-activation)**는 채팅의 로어북 스캔 중 Require나 Trigger를 확인합니다. 답이 없으면 Require는 새 항목을 통과시키지 못하고 Trigger는 활성화 경로를 추가하지 않습니다. 기존 Sticky 유지와 Trigger 항목의 일반 활성화 경로는 계속 적용됩니다.
- **[Smart 응답 순서](../chats/group-chats.md#response-order-individual-only)**는 켜져 있을 때 그룹 채팅의 다음 발언자를 평가합니다. 답이 없으면 Smart 순서가 원래의 AI 호출을 사용합니다.
- **[Advanced Memory Recall](../agents/memory.md#optional-decision-model)**은 Roleplay의 장면 경계와 기억 선택에 별도로 선택한 로컬 모델이나 판단 연결을 사용할 수 있습니다. 해당 채팅의 Advanced Memory 설정에서 **Use Decision model**을 켜세요. 요약은 보조 모델이 작성합니다. 판단에 실패하면 일반 회상이나 장면 검사를 사용합니다.

활성화 질문은 에이전트의 실행 여부를 제어하고, 프롬프트 안의 판정문은 실행 중인 에이전트에 전달할 내용을 제어합니다. 예/아니요 프롬프트 조건에는 `{{#if decision:"..."}}`을, 여러 답 중 선택에는 `{{#if decision_choice:"..." == "..."}}`을 사용하세요.

<a id="what-the-model-sees"></a>

## 모델에 전달되는 정보

활성화 질문과 프롬프트/로어북 판정문은 문장과 채팅에 저장된 최근 메시지를 모델에 전달합니다. 조립된 프롬프트의 나머지 부분인 프리셋, 캐릭터 카드, 페르소나 설명, 로어북 항목(Constant 포함), 요약, 에이전트 출력은 전달하지 않습니다. **@ Depth**에 배치한 프리셋이나 로어북 항목처럼 메시지 사이에 삽입한 텍스트도 제외합니다. 이런 정보에 의존하는 문장에는 필요한 사실 자체를 포함해야 합니다.

**Smart 응답 순서는 캐릭터 명단도 보냅니다.** 각 후보의 이름과, 있으면 상태, 활동, 발언 빈도를 포함하며 성격을 최대 300자까지 보냅니다. 성격이 비어 있으면 설명을 사용합니다. 호스팅된 Decision 제공자는 최근 메시지와 이 명단을 함께 받습니다.

- 프롬프트와 로어북 항목의 판정문, Smart 응답 순서는 최근 메시지 5개를 읽습니다. 이 수는 고정입니다.
- 활성화 질문은 에이전트의 **Scan Depth**(스캔 깊이)를 사용하며 기본값은 5입니다.
- 각 메시지에는 발언자의 이름을 붙입니다. AI에 숨긴 메시지는 제외합니다.
- 후처리 에이전트의 활성화 질문이나 프롬프트 판정문처럼 답글 뒤에 확인하는 항목은 방금 작성한 답글도 읽습니다.
- 문장의 매크로를 먼저 치환하므로 `{{char}}`은 캐릭터 이름으로 전달됩니다.
- 메시지가 모델 예산에 들어가지 않으면 오래된 메시지부터 제외합니다. 호스팅 예산은 [Decision 연결 설정하기](#set-up-a-decision-connection)를 참고하세요.

**Advanced Memory는 채팅별 전용 Decision 모델을 사용합니다.** 장면 검사는 관련 기록 범위를 읽습니다. 회상은 캐릭터 접근 권한을 확인한 뒤 최근 대화와 후보로 추린 보관 요약을 최대 24개까지 전송하고, 이어서 모델이 고른 장면의 원본 메시지를 전송합니다. **Maximum recalled scenes**(최대 회상 장면 수)가 더 크면 그 값까지 요약을 보냅니다. 회상에는 최근 5개 메시지 규칙을 적용하지 않습니다. 호스팅 제공자는 이 텍스트를 여러 제한된 묶음으로 받을 수 있습니다. 회상 단계마다 10초가 지나면 일반 회상으로 전환합니다. [선택 사항인 Decision 모델](../agents/memory.md#optional-decision-model)을 참고하세요.

## Decision 모델 선택하기

**Connections**(연결)를 열고 **Connection defaults**(연결 기본값)의 **Decision model**에서 선택하세요. 목록에는 3개 그룹이 있습니다.

- **None**(없음)이 기본값입니다. 아무것도 묻지 않고 에이전트 편집기의 활성화 질문 필드도 비활성 상태로 남습니다.
- **Local models**(로컬 모델): 이미 실행 중인 **Primary local model**(주 로컬 모델)이나 **Utility local model**(보조 로컬 모델)입니다. 추가 다운로드가 없고 정보가 컴퓨터 밖으로 나가지 않습니다. **Decision sidecar**(판정 사이드카)를 설치했다면 여기도 표시됩니다.
- **Connections**: 생성한 Decision 연결입니다. 호스팅 서비스, 직접 실행하는 System One 서버 또는 Ollama나 LM Studio처럼 이미 실행 중인 서버의 채팅 모델을 사용할 수 있습니다.

현재 답할 수 없는 항목도 이유와 함께 회색으로 남으므로 무엇을 고쳐야 하는지 확인할 수 있습니다. 선택 후 **Test**(테스트)를 클릭하세요. 테스트는 채팅이 아닌 고정 샘플을 보냅니다.

### 선택 기준

이미 로컬 모델을 실행한다면 먼저 사용해 보세요. Roleplay 장면 하나를 대상으로 한 작은 표현 테스트에서 Gemma 4 E4B는 권장 문장 32개 중 32개에, Open-Jev 2B와 9B는 각각 31개에 정답을 냈습니다. 이는 표현이 중요한 이유를 보여 주는 예이며 일반적인 정확도 순위가 아닙니다. 자신의 채팅에서 대표적인 턴으로 시험하세요. [판정문 작성하기](../prompts/conditional-prompts.md#writing-statements)를 참고하세요.

**Jev와 Open-Jev는 다른 모델입니다.** Jev는 TypeSafe의 호스팅 모델이며 직접 또는 OpenRouter를 통해 이용합니다. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B)는 Qwen 기반으로 별도 공개된 모델이며 Marinara가 로컬에서 실행할 수 있습니다. Open-Jev 표현 테스트는 호스팅된 Jev의 정확도를 측정하지 않습니다.

| 선택지 | 비용 | 필요한 것 | 적합한 대상 |
| --- | --- | --- | --- |
| 이미 실행하는 모델 | 추가 비용 없음 | **Local Model**(로컬 모델)의 모델 | 로컬 모델을 사용하는 대부분의 사용자 |
| 자체 서버의 채팅 모델 | 추가 비용 없음 | 이미 실행 중인 Ollama, LM Studio, llama.cpp 또는 OpenAI 호환 서버 | Marinara 외부에서 실행하는 모델을 중복 로드하지 않으려는 경우 |
| 호스팅된 Decision 연결 | 요청별 과금. 한 턴에 여러 번 요청할 수 있음 | API 키(TypeSafe 또는 OpenRouter) | 휴대전화와 로컬 모델을 실행하지 않는 PC |
| 설치형 판정 모델 | 별도 디스크와 GPU 메모리. [모델 크기](#let-marinara-install-a-decision-model) 참고 | Linux x86-64와 지원되는 NVIDIA GPU | 채팅 모델 옆에서 별도 판정 모델 실행 |

**Android (Termux)에서는** NVIDIA GPU가 있는 PC가 필요하므로 설치형 판정 모델을 실행할 수 없습니다. 휴대전화 프로세서에서 실행하는 작은 로컬 모델도 시간 제한을 넘길 수 있습니다. 휴대전화에서는 OpenRouter의 Jev 같은 호스팅된 Decision 연결이 실용적입니다. [Decision 연결 설정하기](#set-up-a-decision-connection)를 참고하세요.

프리셋, 카드, 에이전트는 "Decision 모델"을 기준으로 작성하고 "Jev 필수"로 만들지 마세요. 사용자가 어떤 모델을 골라도 같은 문장 구문을 사용하지만 답은 달라질 수 있습니다.

판정을 사용하는 콘텐츠를 가져오면 Marinara가 이 가이드 링크가 있는 알림을 표시합니다. 사용자 지정 에이전트와 Agent 카탈로그 설치도 포함합니다. Decision 모델을 선택하지 않았다면 알림에 대체 동작이 설명됩니다. 프롬프트 판정문은 아니요로 처리되고, 로어북 항목은 판정으로 활성화될 수 없으며, 에이전트 활성화 질문은 키워드와 **Trigger Cadence**가 허용할 때 실행을 통과시킵니다. Decision 모델 없이 매 턴 실행되면 안 되는 에이전트에는 주기도 설정하세요. 전체 프로필 ZIP 복원에서는 이 가져오기 알림을 표시하지 않습니다.

<a id="use-a-model-you-already-run"></a>

## 이미 실행하는 모델 사용하기

**Local Model**에 로컬 모델이 있으면 연결을 만들거나 요청 비용을 지불하지 않고 판정에 사용할 수 있습니다.

1. **Connections**에서 **Connection defaults**를 열고 **Decision model**을 **Primary local model**로 설정하거나, 보조 모델이 있으면 **Utility local model**로 설정하세요.
2. **Test**를 클릭하세요. 성공하면 확률과 요청 시간에 더해 로컬 모델에만 해당하는 2가지, 로그 확률을 사용할 수 있었는지와 모델이 바로 답하는지를 보여 줍니다.

Marinara는 예/아니요 질문 하나를 보내 토큰 하나를 생성하게 하고 그 토큰의 확률로 답을 읽습니다. 답글은 작성하지 않으므로 요청이 짧습니다. 여러 답 중 선택은 선택지마다 예/아니요 질문 하나로 처리합니다. 최근 메시지가 얼마나 들어갈지는 해당 슬롯 자체의 컨텍스트 크기로 계산합니다.

**추론.** 대부분의 모델은 한 단어로 답합니다. 무엇을 요청하든 먼저 추론하는 모델도 있습니다. 드롭다운 아래의 **Thinking**(추론) 설정으로 제어합니다.

- **Auto**(자동, 기본값)는 빠른 한 단어 방식을 시도하고 두 번 연속 답하지 못하면 해당 모델이 먼저 추론하도록 전환하고 알려 줍니다.
- **Off**(꺼짐)는 항상 한 단어 방식을 사용합니다. 이 방식으로 답하지 못하는 모델은 답 없음이 됩니다.
- **Allowed**(허용)는 모델에 추론을 건너뛰라고 요청하지 않습니다.

먼저 추론하는 모델에는 수초가 걸리므로 기본적으로 후처리 에이전트처럼 답글이 화면에 나온 뒤의 작업에만 답합니다. 답글 전에는 답 없음이 되지만 **Also gate agents that run before the reply**(답글 전에 실행되는 에이전트도 판정)을 켜면 모든 답글이 판정을 기다립니다.

**수치 해석.** 일반 채팅 모델의 예/아니요 확률은 임계값에 사용할 수 있지만 판정 전용 모델처럼 확률을 보정하도록 훈련하지 않았습니다. 로그 확률을 반환하지 않는 런타임은 단순히 1 또는 0으로 답합니다. 기본값을 그대로 믿기보다 자신의 채팅으로 임계값을 조정하세요.

<a id="on-a-server-you-already-run"></a>

### 이미 실행 중인 서버에서 사용하기

채팅 모델이 Ollama, LM Studio, llama.cpp 또는 다른 OpenAI 호환 서버에서 이미 실행 중이라면 Marinara에서 두 번째 사본을 로드하지 않고도 Decision에 응답할 수 있습니다.

1. 해당 서버의 **Custom** 연결을 열고 **Use this model for decisions**(이 모델을 결정에 사용)를 클릭하세요. 같은 기본 URL, 모델, 키를 사용하는 **OpenAI-compatible chat model**(OpenAI 호환 채팅 모델) 소스의 Decision 연결이 생성됩니다. 직접 생성해도 됩니다. Decision 연결에서 이 소스를 선택하고 채팅 연결과 같은 기본 URL(Ollama의 경우 예: `http://localhost:11434/v1`)과 서버가 제공하는 모델 이름을 입력하세요.
2. **Decision model**에서 선택한 뒤 **Test**를 클릭하세요. 서버가 로그 확률을 반환했는지, 모델이 먼저 추론해야 했는지도 결과에 표시됩니다.

로컬 모델처럼 문마다 예/아니요 한 단어를 요청하고 그 확률에서 답을 읽습니다. 서버가 동시에 처리하는 요청 수를 알 수 없으므로 문은 하나씩 전송됩니다. 연결의 **Thinking**은 항상 **Auto**입니다. 먼저 추론해야 하는 모델은 두 번 응답에 실패하면 추론 방식으로 전환하고, **Also gate agents that run before the reply**를 켜지 않는 한 이후에는 답변 후 조건만 평가합니다. 네트워크의 다른 컴퓨터에 있는 서버도 다른 로컬 제공자처럼 `PROVIDER_LOCAL_URLS_ENABLED`가 필요합니다. [로컬 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)를 참고하세요.

<a id="set-up-a-decision-connection"></a>

## Decision 연결 설정하기

1. **Connections**에서 제공자를 **Decision**으로 지정해 연결을 만드세요.
2. **TypeSafe**, **OpenRouter**, **Custom System One endpoint**(사용자 지정 System One 엔드포인트) 또는 **OpenAI-compatible chat model**을 선택하세요. 호스팅 소스에는 API 키가 필요합니다. TypeSafe는 `https://api.typesafe.ai`로 요청을 보냅니다. TypeSafe의 API를 실행하는 다른 서버를 사용하려면 **Base URL**(기본 URL)을 `/v1/systemone` 없는 해당 서버 주소로 바꾸세요. 이 경우에도 TypeSafe 키가 필요하며 이 키는 해당 서버로 전송됩니다. 로컬 네트워크의 다른 컴퓨터에 있는 서버는 다른 로컬 제공자처럼 `PROVIDER_LOCAL_URLS_ENABLED`가 필요합니다. Android에서는 기본적으로 켜져 있습니다. Custom은 Open-Jev나 [Strands decider](#run-strands-decider-yourself)를 포함한 기존 System One 서버를 지원합니다. `/v1/systemone` 없는 기본 URL과 지원하는 모델 이름을 입력하세요. Ollama나 LM Studio 같은 채팅 모델 서버는 System One을 사용하지 않습니다. [이미 실행 중인 서버에서 사용하기](#on-a-server-you-already-run)에 따라 **OpenAI-compatible chat model**을 선택하세요.
3. OpenRouter는 **API key source**(API 키 소스)에서 저장된 연결을 선택하거나 별도 키를 입력하세요. 편집기의 **Use this key for decisions**(이 키를 결정에 사용)도 이용할 수 있습니다. 이 옵션으로 OpenRouter를 통해 Jev를 설정합니다. 연결된 키는 이후 변경을 자동으로 반영합니다. Custom System One 및 OpenAI-compatible chat model 연결은 두 URL의 출처(스킴, 호스트, 포트)가 같을 때만 사용자 지정 채팅 연결의 키를 빌릴 수 있습니다.
4. 저장하고 **Decision model**에서 선택한 뒤 **Test**를 클릭하세요. 성공하면 확률, 응답 시간과 연결의 시간 제한을 보여 줍니다. Test는 최소 10초를 기다리고 제한이 더 길면 그보다 5초 더 기다리므로 느린 답도 실제 시간으로 보고합니다. 제한을 넘겼다면 결과에 표시합니다. 채팅에서는 그 답을 답 없음으로 처리합니다.

Decision 기본값은 채팅, 에이전트, 이미지, 동영상, 오디오 기본값과 별개입니다. **None**을 선택하면 활성화 질문이나 판정문을 삭제하지 않고 판정을 끕니다.

호스팅 판정은 선택한 최근 메시지와 문장을 지정 제공자에게 보내며 비용이 발생할 수 있습니다. Smart 응답 순서는 [캐릭터 명단](#what-the-model-sees)도 포함합니다. **Recent-message token budget**(최근 메시지 토큰 예산)의 기본값은 호스팅 서비스에서 추정 토큰 30,000개, 사용자 지정 서버에서 3,500개입니다. 서버의 컨텍스트 한도가 작으면 줄이세요. Marinara는 오래된 메시지를 먼저 버린 뒤 가장 최신 메시지의 앞부분을 줄입니다. 토큰 추정치는 서버 토크나이저와 다를 수 있으며 거부되거나 예산을 넘긴 요청은 답 없음이 됩니다.

**Time limit (seconds)**(시간 제한, 초)는 채팅 중 Decision 연결이 각 문의 응답을 기다리는 시간입니다. 범위는 0.5~30초이고 기본값은 1.5초, **OpenAI-compatible chat model** 연결은 4초입니다. 한 요청에 여러 문이 있으면 각 문에 이 시간이 주어집니다. 늦은 응답은 응답 없음으로 처리됩니다. 호스팅 제공자가 가끔 1.5초를 넘기면 Decision이 무작위로 실패하는 것처럼 보일 수 있습니다. **Test**를 여러 번 실행하고 가장 느린 응답보다 제한을 높이세요. 다만 프리셋의 Decision이나 답변 전에 실행되는 에이전트의 활성화 질문처럼 답변 전 평가되는 문은 각각 이 시간만큼 답변을 지연시킬 수 있습니다.

연결한 키의 원본 연결을 삭제하면 경고가 나오고 Decision 연결에 다시 연결해야 합니다. 독립 연결 파일을 가져온 경우도 키나 링크를 복원해야 합니다. 파일에는 API 키나 빌린 연결 ID가 들어 있지 않습니다.

<a id="run-strands-decider-yourself"></a>

### Strands decider 직접 실행하기

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19)는 System One을 지원하는 또 다른 공개 Decision 모델(Apache-2.0)입니다. Marinara에서 설치할 수는 없지만, 직접 실행한 상태로 유지하면 **Custom System One endpoint**로 사용할 수 있습니다.

1. Python 3.10 이상 환경에서 설치하고 서버를 시작하세요.

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   NVIDIA GPU나 Apple silicon이 있으면 사용하고, 없으면 프로세서에서 더 느리게 실행됩니다. 처음 시작할 때 모델과 약 4.6 GB의 기본 가중치를 다운로드하며, Python 패키지는 약 5.5 GB를 차지합니다. 서버에 비밀번호가 없으므로 `127.0.0.1`에서만 실행하세요.
2. 소스가 **Custom System One endpoint**이고 기본 URL이 `http://127.0.0.1:8000`인 Decision 연결을 만드세요. 모델 이름은 무엇이든 사용할 수 있습니다.
3. **Decision model**에서 이 연결을 선택하고 **Test**를 클릭하세요. 시작 후 첫 응답은 약 2초로 기본 **Time limit**보다 오래 걸리므로, 채팅 전에 한 번 테스트하세요.

확률이 보정되어 있으므로 자체 호스팅 Open-Jev와 달리 사용자 지정 연결의 기본 임계값 0.5가 적합합니다([임계값](#thresholds) 참고). RTX 5090에서 80개 문장을 사용한 소규모 Roleplay 테스트에서는 Open-Jev 2B의 74개에 비해 73개를 맞혔고, GPU 메모리를 약 5.1 GB(4.7 GiB) 사용했습니다. 문장 1~8개에 0.04~0.1초가 걸렸으며, Open-Jev 2B는 0.1~0.14초가 걸렸습니다. 긴 채팅에서는 둘 다 약 0.3초가 걸렸습니다. 답변이 문구에 더 크게 좌우되므로 [문장 작성하기](../prompts/conditional-prompts.md#writing-statements)를 따르고 자신의 채팅 턴으로 테스트하세요.

이 모델과 Decision sidecar 사이를 전환하려면 **Decision model**에서 둘 중 하나를 선택하세요. 두 설정은 모두 유지됩니다.

<a id="let-marinara-install-a-decision-model"></a>

## Marinara로 판정 모델 설치하기

Marinara가 판정 전용 모델을 다운로드하고 실행하게 할 수도 있습니다. 로컬 채팅 모델의 실행 여부와 관계없이 별도 로컬 프로세스로 동작합니다. 메모리 사용량은 채팅 모델 사용량에 더해집니다. 이미 로컬 모델이 있다면 새 모델을 받기 전에 기존 모델의 판정을 시험하세요.

내장 Open-Jev 모델에는 Linux **x86-64**, 컴퓨트 기능 7.5 이상 NVIDIA GPU(Turing, RTX 20 시리즈 이상), 드라이버 580 이상이 필요합니다. 이 패키지는 Linux ARM 기기와 Pascal 이하 카드를 지원하지 않습니다. 실행할 수 없는 환경에서도 옵션은 계속 보이며 이유와 함께 Decision 연결을 대신 설정하는 방법을 제시합니다.

| 내장 모델 | 모델 다운로드 | 런타임 포함 디스크 | GPU 메모리 |
| --- | --- | --- | --- |
| Open-Jev 2B | 약 4.6 GB | 약 10 GB | 약 4.8 GB (4.5 GiB) |
| Open-Jev 9B | 약 19.4 GB | 약 25.3 GB | 약 23.6 GB (22 GiB) |

고정된 모델 버전과 측정한 작업량을 바탕으로 한 카탈로그 추정치입니다. GPU 사용량과 속도는 작업에 따라 달라집니다. 9B 모델은 24 GB GPU에서 여유가 거의 없습니다. 선택한 카드와 다른 실행 중인 모델에 대한 설치 프로그램의 판정을 확인하세요.

1. **Connections**에서 **Local Model**을 펼치고 **Decision sidecar (experimental)**(판정 사이드카, 실험적)을 고르세요.
2. 경고를 읽고 **Enable decision sidecar**(판정 사이드카 활성화)를 켜세요. 확인하면 기기 판정이 표시되며 경고 판정일 때 버튼은 **Enable anyway**(그래도 활성화)로 표시됩니다.
3. 모델을 고르고 크기, 하드웨어 판정과 라이선스를 확인하세요. 이 단계 전에는 다운로드하지 않습니다. **Open-Jev 2B**는 **Open-Jev 9B**보다 메모리를 훨씬 적게 사용하지만 어느 모델도 채팅에서 정답을 보장하지 않습니다.
4. **Decision model**에서 **Decision sidecar**를 고르세요.

**속도.** 모델 시작 후 첫 응답은 느리므로 Marinara는 로드 중 준비 질문을 하나 보냅니다. 성공하면 **Test**와 첫 턴에서 정상 속도가 나옵니다. 실패해도 모델은 시작되며 지연은 첫 질문에서 발생합니다. 문마다 최근 채팅을 다시 읽으므로 긴 채팅에서 문이 많은 턴은 더 오래 걸립니다. 긴 채팅에서 Open-Jev 2B는 문당 약 0.25초가 걸립니다.

판정 모델의 HuggingFace 저장소를 붙여 넣을 수도 있습니다. Marinara는 해당 저장소의 매니페스트를 읽고 아티팩트 유형이 이 빌드에 포함된 런타임에 대응하는지 검사한 뒤, 설치를 제안하기 전에 받을 기본 가중치와 총크기를 보여 줍니다. 확인할 수 없는 저장소는 무작정 설치하지 않고 이유와 함께 거부합니다.

NVIDIA GPU가 여러 개면 **GPU** 메뉴에서 모델을 올릴 카드를 고릅니다. 판정은 그 카드 기준이며 카드를 바꾸면 모델이 멈췄다가 새 카드에서 다시 시작합니다.

사이드카를 끄면 프로세스를 멈추고 파일은 유지합니다. **Remove files**(파일 삭제)는 모델과 런타임을 삭제하며 사이드카가 꺼져 있어도 사용할 수 있습니다.

<a id="thresholds"></a>

## 임계값

모델 간 확률을 직접 비교할 수는 없습니다. 같은 긍정 사례가 한 모델에서 0.99, 다른 모델에서 0.2로 나올 수 있습니다. Marinara의 기본 임계값은 연결 방식에 따라 다릅니다.

| 선택한 백엔드 | 기본 예/아니요 임계값 |
| --- | --- |
| Primary 또는 Utility 로컬 채팅 모델, 또는 OpenAI 호환 채팅 모델 연결 | 0.5 |
| TypeSafe, OpenRouter 또는 Custom System One Decision 연결 | 0.5 |
| 관리형 Decision sidecar | 모델 매니페스트 권장값. 내장 Open-Jev 2B와 9B는 0.1 |

에이전트의 **Run when probability is at least**(실행할 최소 확률)로 이 기본값을 재정의할 수 있습니다. 저장값이 다르면 편집기가 백엔드 권장값 복원을 제안합니다. 모델을 바꿀 때마다 확인하세요.

프롬프트 판정문과 로어북 Decision 필드는 백엔드 기본값을 사용합니다. 에이전트 임계값을 바꿔도 이 값들은 바뀌지 않습니다. **Custom System One 연결 뒤에서 직접 호스팅하는 Open-Jev도 0.5를 사용합니다.** Marinara는 임의의 사용자 지정 엔드포인트를 자동으로 식별하고 보정할 수 없습니다. 따라서 0.5 미만의 긍정 결과를 아니요로 읽는 등 관리형 Open-Jev 사이드카와 결과가 다를 수 있습니다.

<a id="time-limits"></a>

## 시간 제한

시간 안에 도착하지 않은 판정은 답 없음이 됩니다. 생성은 [각 기능의 대체 동작](#where-marinara-uses-it)으로 계속하므로 프롬프트 분기나 필수 로어북 항목이 빠질 수 있습니다.

모든 시간 제한은 문별로 적용됩니다. 여러 문을 한 번에 묻는 요청은 각 문에 제한 시간이 주어지며, 각 Choice 답변도 하나의 문으로 셉니다. 로컬 모델은 소수의 요청만 동시에 처리하므로 문은 차례를 기다리고 모델이 처리를 시작할 때부터 시간을 계산합니다.

- TypeSafe, OpenRouter 또는 Custom System One Decision 연결은 **Time limit**을 바꾸지 않는 한 문당 **1.5초**입니다. [Decision 연결 설정하기](#set-up-a-decision-connection)를 참고하세요.
- OpenAI 호환 채팅 모델 연결은 **Time limit**을 바꾸지 않는 한 문당 **4초**입니다. 먼저 추론해야 하는 모델에는 최소 20초가 주어집니다.
- 로컬 모델은 문당 **4초**입니다.
- Decision 사이드카의 첫 문은 **4초**입니다. 이후 각 문에는 모델의 측정 시간이 주어집니다. Open-Jev 2B는 0.35초, Open-Jev 9B는 0.8초입니다. 저장소 주소를 붙여넣어 설치한 모델은 각 문에 4초가 주어집니다.
- 먼저 추론해야 하는 로컬 모델은 문당 **20초**입니다.

생성을 취소하면 판정 요청도 중단합니다.

## Decision model의 다른 설정

- **Also use it to pick who speaks in Smart response order.**(Smart 응답 순서의 발언자 선택에도 사용)는 기본적으로 꺼져 있습니다. [그룹 채팅](../chats/group-chats.md#response-order-individual-only)을 참고하세요.
- **Decision statements per turn.**(턴당 판정문 수)는 프롬프트와 로어북 판정문 계획을 제한하며 기본값 32, 최대 255입니다. 허용량은 여러 단계에 적용되며 한 턴의 모든 Decision 요청이나 지출에 대한 단일 한도가 아닙니다. 에이전트 활성화 질문과 Smart 응답 순서는 별개입니다. 범위, 일괄 처리와 우선순위 규칙은 [제한과 비용](../prompts/conditional-prompts.md#limits-and-cost)을 참고하세요.
- **Also gate agents that run before the reply**와 **Thinking**은 **Primary local model**과 **Utility local model**에 표시됩니다. Decision 사이드카는 추론하지 않으므로 두 옵션 모두 없습니다. [이미 실행하는 모델 사용하기](#use-a-model-you-already-run)를 참고하세요.

## 정확도: 오답에 대비하기

어떤 모델도 틀릴 수 있습니다. 앞의 작은 표현 테스트에서 Open-Jev 2B의 올바른 "예" 답 중 일부는 임계값을 간신히 넘었습니다. 누락되거나 잘못된 답에 대비하세요.

- 판정은 세부 조정에 사용하고 채팅에 필수인 내용에는 사용하지 마세요. 판정 누락은 답글의 맞춤 정도를 조금 줄일 뿐 동작을 깨뜨리면 안 됩니다.
- 동의, 콘텐츠 경고나 안전 지침을 판정 조건으로 제한하지 마세요.
- 활성화 질문만으로 실행하는 에이전트에는 **Bypass the question after this many messages**(지정 메시지 수 후 질문 건너뛰기)를 설정해 계속되는 "아니요" 때문에 영원히 실행되지 않는 일을 막으세요.

구체적인 표현 예시와 자신의 채팅에서 시험하는 방법은 [판정문 작성하기](../prompts/conditional-prompts.md#writing-statements)를 참고하세요.

## 문제 해결

- **Test 실패.** 메시지에 이유가 나옵니다. 키 거부, 제공자 속도 제한, 로컬 모델 중지, 판정 모델 미설치, 예/아니요 응답 실패 또는 시간 초과 등입니다.
- **Test에서 서버에 해당 엔드포인트가 없다고 나옵니다.** Decision 소스와 서버가 맞지 않습니다. Ollama, LM Studio 및 다른 채팅 모델 서버에는 **OpenAI-compatible chat model**이 필요합니다. **Custom System One endpoint**는 Open-Jev 같은 System One 서버 전용입니다.
- **Test가 시간 제한 초과를 보고하거나 판정이 일부 턴에서만 동작함.** 제공자가 적어도 일부 요청에서 연결의 **Time limit**보다 느리게 답합니다. 여러 번 시험하고 가장 느린 답보다 제한을 높이세요.
- **활성화 질문이 있는 에이전트가 매 턴 실행됨.** Decision 모델이 설정되지 않았거나 답하지 않아 질문이 없는 것처럼 실행됩니다. **Test**를 확인하세요.
- **프롬프트 판정 분기가 나타나지 않음.** [판정 분기가 나타나지 않을 때](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears)를 참고하세요.
- **Smart 응답 순서가 원래 AI 호출을 계속 사용함.** 스위치가 꺼져 있거나 해당 턴에 Decision 모델이 답하지 않았습니다.
- **생성 중 Decision 점수와 출력을 보려면** Debug Mode를 켜거나 로그 수준을 debug로 설정하세요. 프롬프트 결정 로그에는 임계값, 결과, 응답이 재사용되거나 시간 규칙에 의해 유지되었는지가 포함됩니다. [로그 수준](../CONFIGURATION.md#logging-levels)을 참고하세요.
- **답변을 생성하지 않고 직접 작성한 문을 테스트하려면** **Peek Prompt → Decision diagnostics → Test decisions**(Peek Prompt → Decision 진단 → Decision 테스트)를 여세요. 입력 미리보기는 모델을 호출하지 않습니다. 명시적 테스트는 선택한 모델을 호출하며 호스팅 비용이 발생할 수 있습니다. [Decision 문 테스트하기](../chats/peek-prompt.md#testing-decision-statements)를 참고하세요.

## 관련 가이드

- [사용자 지정 에이전트 만들기](../agents/custom-agents.md)
- [조건부 프롬프트](../prompts/conditional-prompts.md)
- [그룹 채팅](../chats/group-chats.md)
- [로컬 모델 설정](local-model.md)
- [AI 제공자 연결하기](connecting-to-a-provider.md)
