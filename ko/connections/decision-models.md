# Decision 모델

Decision 모델은 "최신 메시지에서 장면이 새 장소로 이동하나요?"나 "Kaelen의 기분은 화남, 슬픔, 차분함 중 무엇인가요?"처럼 Marinara가 묻는 채팅에 관한 짧은 질문에 답하는 작은 모델입니다. 일부 모델은 채팅의 이미지와 클립도 볼 수 있습니다. 로어북, 사용자 지정 에이전트, 프롬프트, 그룹 채팅과 Illustrator가 이 모델을 사용합니다. 이 기능은 선택 사항입니다. 설정하지 않아도 채팅은 그대로 작동하며, 각 기능은 [Marinara에서 사용하는 곳](#where-marinara-uses-it)에 설명한 대체 동작을 사용합니다.

답은 Marinara의 동작을 제어하며 채팅에 게시되는 일은 없습니다. 질문 유형과 예시는 [판단 모델이 답할 수 있는 질문](#what-a-decision-model-can-answer)을 참고하세요.

권장 사항: 잘 모르겠다면 **None**(없음)으로 두세요. 판정을 쓰고 싶다면 이미 있을 수도 있는 내장 모델이나, 이미 실행 중인 서버의 채팅 모델을 사용하세요. 둘 다 추가 비용이 들지 않습니다.

## 판단 모델이 답할 수 있는 질문

모든 답은 모델이 얼마나 확신하는지를 나타내는 0부터 1까지의 숫자로 돌아옵니다. Marinara는 이 숫자를 각 기능에 필요한 답으로 바꿉니다.

### 예 또는 아니요

모델은 판정문을 읽고 참일 가능성을 답합니다. Marinara는 이를 [임계값](#thresholds)과 비교해 그 이상이면 예로 처리합니다. 가장 흔한 유형으로, 활성화 질문, 로어북 **Decision**(결정) 필드, `{{#if decision:"..."}}`, Illustrator의 확인 기능에서 사용합니다.

| 판정문 | 바꿀 수 있는 동작 |
| --- | --- |
| `In the latest message, the characters move to a different location` | 위치가 바뀐 턴에만 트래커가 위치를 갱신합니다. |
| `In the latest message, a dragon is physically present` | 드래곤에 관한 로어북 항목이 프롬프트에 들어갑니다. |
| `{{user}} asked a question that {{char}} has not answered yet` | 프롬프트의 한 줄이 모델에 그 질문에 답하도록 상기시킵니다. |
| `The latest message describes a fight` | 이 턴에만 전투 에이전트가 실행됩니다. |

### 여러 답 중 하나

모델은 직접 작성한 짧은 목록에서 가장 잘 맞는 답을 고릅니다. Marinara가 모든 선택지에 대해 묻고 점수가 가장 높은 것을 남기므로 여러 개가 아닌 하나의 답을 얻습니다. `{{#if decision_choice:"..." == "..."}}`를 사용하세요.

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen speaks in short, clipped sentences.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and avoids eye contact.
{{else if decision_choice:"Kaelen's mood in the latest message" == "calm"}}
Kaelen speaks normally.
{{/if}}
```

장면 유형(`combat`, `dialogue`, `exploration`, `rest`), 시간대(`morning`, `afternoon`, `evening`, `night`), 집 안에서 장면이 펼쳐지는 방 같은 목록도 잘 작동합니다. 선택지는 서로 명확히 구분하고, 어느 것도 맞지 않을 수 있다면 `none of these` 같은 항목을 추가하세요. 에이전트도 같은 방식으로 여러 지침 집합 중 하나를 고르며, Illustrator는 날씨 유형을 고릅니다.

### 점수

일부 기능은 예 또는 아니요 대신 숫자 자체를 사용합니다. [Smart 응답 순서](../chats/group-chats.md#response-order-individual-only)는 각 캐릭터가 다음에 말할 가능성을 점수로 매겨 가장 높은 캐릭터를 고릅니다. [Advanced Memory](../agents/memory.md#optional-decision-model)는 과거 장면마다 관련성을 점수로 매깁니다. Peek Prompt의 **Test decisions**(결정 테스트)는 모든 판정문의 점수를 보여 주므로 임계값을 고르는 데 도움이 됩니다. [판정문 테스트하기](../chats/peek-prompt.md#testing-decision-statements)를 참고하세요.

### 이미지와 클립

이미지를 읽는 내장 판단 모델은 `The picture shows the character at the beach`처럼 채팅의 이미지에 대해서도 같은 유형의 질문에 답할 수 있습니다. Liquid d1, Valen, Winnow는 이미지를 읽으며, Valen 정식 릴리스는 짧은 클립도 읽습니다. 다른 모델과 모든 호스팅 또는 서버 계정은 텍스트만 읽으며, 이미지를 보내지 않습니다.

이미지마다 답하는 시간이 늘어나므로, 요청하지 않으면 이미지를 보내지 않습니다.

- 판정문에 `pictures:1`(최대 3) 또는 `clips:1`을 추가하세요. 최신 메시지 2개 중 하나에 이미지가 있을 때만 물으려면 `media_within:2`를 추가하세요. [이미지와 클립](../prompts/conditional-prompts.md#pictures-and-clips)을 참고하세요.
- 로어북 항목에서는 **Decision** 필드 아래의 **Show the decision model**(결정 모델에 보여줄 항목)을 설정하세요. [Decision 활성화](../lorebooks/entries.md#decision-activation)를 참고하세요.
- 사용자 지정 에이전트의 활성화 질문에서는 **Show the decision model**을 설정하세요. [활성화 질문](../agents/custom-agents.md#activation-questions)을 참고하세요.
- Marinara 자체 이미지 기능은 [이미지를 확인하는 기능](#features-that-look-at-pictures)을 참고하세요.

### 모델 페이지의 정보

각 내장 판단 모델의 페이지에는 두 줄이 표시됩니다.

- **Answers**(답변)는 모델이 답하도록 만들어진 유형을 나열합니다. **Yes/no**(예/아니요), **Weighted choice**(가중치 선택), **Score on a scale**(척도에 따른 점수), 일부 모델의 **Boxes on a picture**(이미지의 영역 상자, 이미지에서 무언가가 있는 위치)입니다. Marinara는 예/아니요와 선택 질문을 묻고 그 점수를 읽습니다. 아직 영역 상자를 요청하지 않으므로, 이 항목은 모델의 특성을 설명할 뿐입니다.
- **Reads**(입력)는 **Text**(텍스트), **Pictures**(이미지), **Video**(동영상)를 나열합니다. 모델의 다른 릴리스에서만 읽을 수 있는 유형은 "정식 릴리스에서는 동영상 지원"처럼 나머지 유형 뒤에 표시됩니다.

## Decision 모델 선택하기

시작하기 전에 [선택 기준](#which-one-to-pick)을 참고하세요.

1. 상단 바에서 **Connections**(연결)를 클릭하고 **Jobs**(작업) 상자를 여세요.
2. **Behind the scenes**(무대 뒤) 아래의 **Decision**(판단) 행을 클릭하세요. 목록이 열립니다.
3. 모델을 고르세요. 목록에는 3개 그룹이 있습니다.
   - **None (decisions off)**(없음, 판단 끔)가 기본값입니다. 아무것도 묻지 않으며, 에이전트 편집기의 활성화 질문 필드는 비활성 상태로 남습니다.
   - **Built-in model**(내장 모델) 그룹에는 Marinara가 내 컴퓨터에서 실행하는 모델이 있습니다. **Built-in model**, **Built-in model (utility)**(내장 모델, 보조), **Built-in model (decisions)**(결정 사이드카, 실험적)입니다. 정보가 컴퓨터 밖으로 나가지 않습니다.
   - **Connections** 그룹에는 판정에 답할 수 있는 내 계정이 있습니다. 호스팅 서비스이거나, 이미 실행 중인 서버의 채팅 모델입니다.

   왼쪽에서 계정을 클릭하면 해당 계정의 모델을 살펴볼 수 있습니다. NanoGPT, OpenRouter 또는 Google Gemini 계정에서는 위쪽의 **Decision models**(판단 모델)에 전용 판단 모델이 먼저 표시되고, 아래쪽의 **Chat models**(채팅 모델)에 채팅 모델이 표시됩니다. Google Gemini의 채팅 모델은 판단에 답할 수 없어 판단 모델만 표시됩니다. 이전에 고른 판단 모델은 **Starred**(즐겨찾기) 위에 표시되며, 모델 이름 아래에 계정 이름이 나옵니다.
4. 테스트하려면 행의 **Decision settings**(판단 설정) 톱니바퀴를 클릭한 다음 **Test**(테스트)를 클릭하세요. 이 버튼은 내장 모델 항목에 표시됩니다. TypeSafe, OpenRouter, NanoGPT 또는 Google Gemini 판단 모델은 **Edit model**(모델 편집)을 열고 **Test provider**(연결 테스트)를 클릭하세요. **Own decision server**(자체 판단 서버) 계정은 계정의 **⋯** 메뉴에서 **Test**를 사용하세요.

테스트에 성공하면 "예"일 확률과 답하는 데 걸린 시간이 표시됩니다. 내 컴퓨터의 모델이라면 로그 확률을 사용할 수 있었는지, 모델이 바로 답하는지도 알려 줍니다. 로그 확률은 모델이 쓸 수 있는 각 단어에 대한 확신도 수치입니다. 테스트는 내 채팅이 아닌 고정된 샘플을 보냅니다.

실패하면 메시지에 이유가 나옵니다. 흔한 원인은 키 거부, 서비스의 요청 제한, 내장 모델 미실행, 시간 제한 초과입니다. [문제 해결](#troubleshooting)을 참고하세요.

지금 답할 수 없는 항목도 목록에 회색으로 남으며 이유가 함께 표시됩니다. **None**을 고르면 활성화 질문이나 판정문을 삭제하지 않고 판정을 끕니다.

<a id="which-one-to-pick"></a>

### 선택 기준

- **내장 모델에서 이미 실행 중인 모델.** 추가 비용이 없습니다. 내장 모델을 쓰는 대부분의 사용자에게 가장 좋습니다.
- **내 서버의 채팅 모델**(Ollama, LM Studio, llama.cpp 또는 다른 OpenAI 호환 서버). 추가 비용이 없습니다. 모델이 Marinara 밖에서 실행될 때 적합하며, 모델을 두 번 로드하지 않아도 됩니다.
- **호스팅된 판단 모델**(TypeSafe, OpenRouter, NanoGPT 또는 Google Gemini). 요청마다 과금되며 한 턴에 여러 번 요청할 수 있습니다. NanoGPT 구독에는 일부 판단 모델이 포함되며, OpenRouter는 무료 모델도 제공합니다. 휴대폰이나 로컬 모델을 실행하지 않는 컴퓨터에 적합합니다.
- **Built-in decision model**(결정 사이드카). Marinara가 다운로드해 채팅 모델과 함께 실행하는 판단 전용 모델이며, 자체 디스크 공간과 메모리를 사용합니다. 대부분 거의 모든 컴퓨터에서 실행되며, 일부는 프로세서만으로도 실행됩니다. 이미지와 클립을 볼 수 있는 유일한 선택지입니다. [Marinara로 판정 모델 설치하기](#let-marinara-install-a-decision-model)를 참고하세요.

이미 로컬 모델을 실행하고 있다면 먼저 그 모델을 써 보고, 자신의 채팅 턴으로 테스트하세요. 표현이 결과를 크게 좌우합니다. [판정문 작성하기](../prompts/conditional-prompts.md#writing-statements)를 참고하세요.

Jev와 Open-Jev는 다른 모델입니다. Jev는 TypeSafe의 호스팅 모델이며 직접 또는 OpenRouter를 통해 이용할 수 있습니다. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B)는 Qwen 기반으로 별도 공개된 모델이며 Marinara가 로컬에서 실행할 수 있습니다. Open-Jev 테스트는 호스팅된 Jev를 측정하지 않습니다.

Android(Termux)에서는 **Built-in decision model**로 JevK5와 Liquid d1만 제공하며, 휴대전화 프로세서에서는 너무 느릴 수 있습니다. OpenRouter를 통한 Jev처럼 호스팅 계정이 실용적인 선택입니다. [Decision 계정 설정하기](#set-up-a-decision-account)를 참고하세요.

프리셋, 카드, 에이전트는 "Decision 모델"을 기준으로 작성하고 "Jev 필수"로 만들지 마세요. 이미지를 요청하는 판정문도 텍스트만 읽는 모델에서 작동하며, 텍스트만 전달됩니다. 어떤 모델에서든 같은 문장 구문을 쓰지만 모델마다 답이 다를 수 있습니다. 사용자 지정 에이전트와 Agent Organizer 설치를 포함해 판정을 사용하는 콘텐츠를 가져오면 Marinara가 이 가이드로 연결되는 알림을 표시합니다. 전체 프로필 ZIP을 복원할 때는 이 알림이 표시되지 않습니다.

## 내장 모델 사용하기

내장 모델을 다운로드해 두었다면 계정도 비용도 없이 판정에 사용할 수 있습니다. [내장 모델 설정](local-model.md)을 참고하세요.

1. **Jobs** 상자의 **Behind the scenes** 아래에 있는 **Decision** 행을 클릭하세요.
2. **Built-in model**을 고르세요. **Built-in model (utility)**가 있다면 그쪽을 골라도 됩니다.
3. **Decision settings** 톱니바퀴를 클릭한 다음 **Test**를 클릭하세요.

Marinara는 모델에 예/아니요 질문 하나를 보내 토큰 하나를 쓰게 하고, 그 토큰의 확률에서 답을 읽습니다. 답글은 작성하지 않으므로 요청이 짧습니다. 여러 답 중 하나를 고르는 질문은 답마다 예/아니요 질문 하나로 묻습니다.

**Thinking**(생각 중) 설정은 모델이 한 단어로 답하지 못할 때의 동작을 정합니다. 항상 먼저 추론하는 모델도 있습니다.

| Thinking | 동작 |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)**(자동, 한 단어 답변을 시도하고, 모델이 답하지 못하면 생각 허용) | 기본값입니다. 한 단어 답이 두 번 연속 실패하면 모델이 먼저 생각하도록 허용하고 Marinara가 알려 줍니다. |
| **Off (always answer in one word)**(끔, 항상 한 단어로 답변) | 한 단어로 답하지 못하는 모델은 답을 내지 않습니다. |
| **Allowed (let the model think first)**(허용, 모델이 먼저 생각하도록 허용) | 모델에 추론을 건너뛰라고 요청하지 않습니다. |

먼저 생각하는 모델은 몇 초가 걸리므로, 기본적으로 후처리 에이전트처럼 답글이 화면에 나온 뒤에 실행되는 확인에만 답합니다. 답글 전에 실행되는 에이전트도 판정하게 하려면 **Also gate agents that run before the reply**(답글 전에 실행되는 에이전트도 판정)를 켜세요. 그러면 모든 답글이 이 모델을 기다립니다.

일반 채팅 모델의 예/아니요 확률도 임계값에 쓸 수 있지만, 판정 전용 모델처럼 보정되도록 훈련되지는 않았습니다. 로그 확률을 반환하지 않는 런타임은 단순히 1 또는 0으로 답합니다. 자신의 채팅으로 임계값을 조정하세요.

<a id="on-a-server-you-already-run"></a>

### 이미 실행 중인 서버에서 사용하기

채팅 모델이 Ollama, LM Studio, llama.cpp 또는 다른 OpenAI 호환 서버에서 실행 중이라면, Marinara가 두 번째 사본을 로드하지 않고도 그 모델이 판정에 답할 수 있습니다.

1. **Jobs** 상자의 **Behind the scenes** 아래에서 **Decision** 행을 클릭하세요. 선택 창에는 채팅 모델을 포함한 모든 계정의 모델이 표시됩니다. 또는 모델의 **⋯**을 클릭하고 **Use for…** → **Decision**을 고르세요.
2. **Decision** 행의 톱니바퀴를 클릭한 다음 **Test**를 클릭하세요. 테스트에 성공하면 서버가 로그 확률을 반환했는지, 모델이 먼저 생각해야 했는지 알려 줍니다. **Done**(완료)을 클릭하세요.
직접 만들 수도 있습니다. 소스가 **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**(OpenAI 호환 채팅 모델, Ollama, LM Studio, llama.cpp)인 Decision 계정을 쓰고, 채팅 계정과 같은 주소(예: Ollama라면 `http://localhost:11434/v1`)와 서버가 쓰는 모델 이름을 입력하세요.

질문 방식은 내장 모델과 같습니다. 판정문마다 예/아니요 한 단어를 요청합니다. Marinara는 서버가 동시에 처리하는 요청 수를 알 수 없으므로 판정문을 하나씩 보냅니다. 계정의 **Thinking**은 항상 **Auto**입니다. 다른 컴퓨터에 있는 서버에는 `PROVIDER_LOCAL_URLS_ENABLED`가 필요합니다. [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)를 참고하세요.

<a id="set-up-a-decision-connection"></a>

## Decision 연결 설정하기

호스팅된 Decision 계정은 선택한 최근 메시지와 판정문을 서비스로 보내며 비용이 발생할 수 있습니다. Smart 응답 순서는 [캐릭터 명단](#what-the-model-sees)도 보냅니다.

1. 상단 바에서 **Connections**를 클릭한 다음 **Add**(추가)를 클릭하세요.
2. 유형 버튼에서 **Decision**(판단)을 클릭한 다음 **TypeSafe** 또는 **Own decision server**를 클릭하세요. NanoGPT는 [NanoGPT로 연결하기](#through-nanogpt)를, OpenRouter나 Google Gemini는 [OpenRouter 또는 Google Gemini로 연결하기](#through-openrouter-or-google-gemini)를 참고하세요.
3. **API key**(API 키)를 입력하세요. **Own decision server**라면 **Server address**(서버 주소)를 입력하세요. **Connect**(연결)를 클릭하세요. 창이 닫히고 패널에 새 계정이 표시됩니다.
4. **Behind the scenes** 아래의 **Decision** 행을 클릭하고 새 모델을 고르세요.
5. 테스트하려면 패널에서 모델을 클릭해 **Edit model**을 연 다음 **Provider tests**(연결 테스트) 카드의 **Test provider**를 클릭하세요. **Own decision server** 모델에는 그곳에 **Test provider** 버튼이 없습니다. 대신 패널에서 계정의 **⋯** 메뉴를 열고 **Test**를 클릭하세요.

**Test provider**가 성공하면 확률, 답하는 데 걸린 시간, 계정의 시간 제한이 표시됩니다. **⋯** 메뉴에 있는 계정의 **Test**는 작동 여부와 걸린 시간만 알려 줍니다. 테스트는 최소 10초를 기다리며, 시간 제한이 그보다 길면 제한보다 5초 더 기다립니다. 답이 제한보다 오래 걸렸다면 결과에 그렇게 표시됩니다. 채팅에서는 그 답이 답 없음으로 처리됩니다.

실패했다면 [문제 해결](#troubleshooting)을 참고하세요.

Decision 편집기(Decision 모델의 **Edit model**)에는 다음 필드가 있습니다.

| 필드 | 하는 일 |
| --- | --- |
| **Decision source**(판단 소스) | **TypeSafe**, **OpenRouter**, **NanoGPT**, **Google Gemini**, **Custom System One endpoint**(사용자 지정 System One 엔드포인트) 또는 **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**입니다. 모델을 만들 때 고정됩니다. |
| **API key source**(API 키 소스) | **Enter a separate key (optional for local servers)**(별도의 키를 입력하세요, 로컬 서버는 선택 사항) 또는 다른 계정의 **Use key from …**(…의 키 사용)입니다. 연결된 키는 이후의 키 변경을 따라갑니다. 사용자 지정 System One 모델이나 OpenAI 호환 모델은 두 주소의 스킴, 호스트, 포트가 같을 때만 사용자 지정 채팅 계정의 키를 빌릴 수 있습니다. |
| **Recent-message token budget**(최근 메시지 토큰 예산) | 보낼 채팅의 추정 토큰 수입니다. 1부터 30,000까지입니다. 기본값은 TypeSafe, OpenRouter, NanoGPT, Google Gemini가 30,000, 사용자 지정 서버가 3,500입니다. NanoGPT, OpenRouter 또는 Google Gemini 계정의 판단 모델 입력 한도가 이보다 작으면 그 한도의 4분의 3을 사용합니다. Marinara는 오래된 메시지부터 버린 다음 가장 최신 메시지의 앞부분을 잘라 냅니다. 거부되거나 예산을 넘긴 요청은 답 없음이 됩니다. |
| **Time limit (seconds)**(제한 시간, 초) | 채팅 중 판정문 하나마다 기다리는 시간입니다. 0.5부터 30까지입니다. 기본값은 1.5이며, NanoGPT와 OpenAI 호환 채팅 모델은 4입니다. [시간 제한](#time-limits)을 참고하세요. |
| **Custom Request Headers**(사용자 지정 요청 헤더) | 각 판단 요청에 추가할 헤더를 JSON 객체로 지정합니다. 예를 들어 `{"x-billing-mode": "paygo"}`를 쓸 수 있습니다. 키는 넣을 수 없으며 인증 헤더는 거부됩니다. |

TypeSafe는 `https://api.typesafe.ai`로 요청을 보냅니다. **Base URL**(기본 URL)을 TypeSafe의 API를 실행하는 다른 서버로 바꿀 수 있으며, 이때 `/v1/systemone`은 빼고 입력합니다. 이 경우에도 TypeSafe 키가 필요하며 키는 그 서버로 전송됩니다. **Custom System One endpoint**는 Open-Jev나 [Strands decider](#run-strands-decider-yourself)처럼 직접 실행하는 System One 서버를 받습니다. 주소는 `/v1/systemone` 없이 입력하세요. Ollama 같은 채팅 모델 서버는 System One을 사용하지 않습니다. 이런 서버에는 **OpenAI-compatible chat model**을 사용하세요.

<a id="through-nanogpt"></a>
### NanoGPT로 연결하기

NanoGPT에는 Jev Latest와 같은 자체 판단 모델이 있습니다. Marinara는 NanoGPT 키로 Decisions API에 요청을 보냅니다. 일부 모델은 NanoGPT 구독에 포함되며, 나머지 모델은 잔액에서 요금이 차감됩니다.

1. 평소처럼 NanoGPT를 연결하세요. **Add**의 **Decision** 유형에도 NanoGPT가 표시됩니다.
2. **Found in NanoGPT — use it for:**(NanoGPT에서 찾은 항목의 용도)에서 **Decision**을 체크하세요. Marinara는 구독에 포함된 판단 모델을 고르며 Jev Latest를 우선합니다.
3. 다른 모델을 고르려면 NanoGPT 계정의 **⋯**, **Add model**(모델 추가), **Decision** 탭 순으로 클릭하세요. 판단 모델만 나열됩니다. 구독에 포함된 모델에는 **Plan**(요금제) 표시가 붙습니다. 모델을 고른 뒤 **Test decision**(판단 테스트)을 클릭하세요.

판단 모델은 채팅할 수 없으므로 채팅 모델 목록에 표시되지 않습니다.

기본적으로 NanoGPT가 요청에 구독을 적용할지 잔액을 쓸지 정합니다. 항상 잔액을 쓰려면 판단 모델의 **Edit model**을 열고 **Custom Request Headers**에 `{"x-billing-mode": "paygo"}`를 입력하세요.

<a id="through-openrouter-or-google-gemini"></a>
### OpenRouter 또는 Google Gemini로 연결하기

OpenRouter와 Google Gemini 계정에도 자체 판단 모델이 있습니다. Marinara는 해당 계정 키를 사용해 서비스의 판단 API에 요청합니다. OpenRouter에는 모델이 많고, 이름이 `:free`로 끝나는 모델은 무료입니다. Google Gemini에는 **Gemini Decision 1** 하나가 있습니다.

1. 평소처럼 OpenRouter 또는 Google Gemini를 연결하세요.
2. **Jobs** 상자의 **Behind the scenes** 아래에서 **Decision** 행을 클릭한 다음 왼쪽의 계정을 클릭하세요. **Decision models**에서 모델을 고르세요.
3. 테스트하려면 모델의 **Edit model**을 열고 **Test provider**를 클릭하세요.

OpenRouter 계정에서는 로그 확률을 반환하는 채팅 모델이 아래의 **Chat models**에 표시되며, 이 모델도 사용할 수 있습니다. Google Gemini 계정에는 판단 모델만 있습니다.

이 버전 전에 추가한 계정은 판단 모델이 나오기 전에 모델 목록을 저장했기 때문에 처음에는 **Decision models**가 보이지 않을 수 있습니다. 선택 창에서 새로 고침 버튼을 누르세요. Marinara도 저장된 모델 목록을 하루에 한 번 새로 고칩니다.

**Add**에서 추가한 별도의 **OpenRouter** 판단 계정도 계속 작동합니다. 해당 계정 키로 같은 API에 요청합니다.

일부 호스팅 서비스는 가끔 1.5초보다 느리게 답하며, 그러면 판정이 무작위로 고장 난 것처럼 보입니다. 여러 번 테스트하고 가장 느린 답보다 제한을 높게 설정하세요. 프리셋의 판정이나 답글 전에 실행되는 에이전트의 활성화 질문처럼 답글 전에 묻는 판정문은 각각 최대 그 시간만큼 답글을 지연시킬 수 있습니다.

판정에 키를 쓰는 계정을 삭제하면 경고가 표시됩니다. 그러면 Decision 계정을 다시 연결해야 하며, 그 전까지 판정은 답을 내지 않습니다. 가져온 연결 파일에는 API 키나 빌린 계정 링크가 들어 있지 않으므로 직접 복원하세요.

<a id="where-marinara-uses-it"></a>

## Marinara에서 사용하는 곳

- [활성화 질문](../agents/custom-agents.md#activation-questions)은 사용자 지정 에이전트의 실행 여부를 정합니다. 답이 없으면 질문이 실행을 막지 않습니다. 키워드와 **Trigger Cadence**(실행 주기)는 계속 적용됩니다.
- [프롬프트 판정문](../prompts/conditional-prompts.md#asking-the-decision-model)은 채팅이나 에이전트 프롬프트를 만들 때 텍스트를 고릅니다. 답이 없으면 판정을 아니요로 읽으므로, 판정 블록은 `{{else}}` 분기가 있으면 그 분기를 사용합니다.
- [로어북 Decision 필드](../lorebooks/entries.md#decision-activation)는 로어북 스캔 중 Require나 Trigger를 확인합니다. 답이 없으면 Require는 새 항목을 통과시키지 못하고 Trigger는 경로를 추가하지 않습니다. Sticky 유지와 일반 Trigger 경로는 계속 적용됩니다.
- [Smart 응답 순서](../chats/group-chats.md#response-order-individual-only)는 켜져 있으면 그룹 채팅에서 다음에 누가 말할지 점수를 매깁니다. 답이 없으면 Smart 순서가 평소의 AI 호출을 합니다.
- [활성 캐릭터 자동화](../chats/group-chats.md#automate-active-characters-merged-only)는 **Decision model**(결정 모델)로 설정되어 있으면 Merged Roleplay 그룹에서 답글마다 그 전에 장면에 누가 있는지 묻습니다. 답이 없는 경우, 어떤 캐릭터도 답을 받지 못하면 Character Tracker의 마지막 장면을 쓰거나 목록을 그대로 둡니다.
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model)은 Roleplay의 장면 경계와 기억 선택에 자체 Decision 모델을 쓸 수 있습니다. 해당 채팅의 Advanced Memory 설정에서 **Use Decision model**을 켜세요. 답이 없으면 실패한 판정은 일반 회상이나 장면 검사로 대체됩니다. 요약은 계속 보조 모델이 작성합니다.

- [이미지를 확인하는 기능](#features-that-look-at-pictures)은 켜져 있으면 새 이미지를 확인하고, 반복을 건너뛰고, 배경을 재사용하고, 스프라이트 얼굴에 표시합니다. 이미지를 읽는 판단 모델이 필요합니다.

활성화 질문은 에이전트의 실행 여부를 정합니다. 프롬프트 안의 판정문은 실행 중인 에이전트에 무엇을 전달할지 정합니다. 예/아니요 조건에는 `{{#if decision:"..."}}`을, 여러 답 중 선택에는 `{{#if decision_choice:"..." == "..."}}`을 사용하세요.

### 이미지를 확인하는 기능

이 기능에는 이미지를 읽는 내장 판단 모델(Liquid d1, Valen 또는 Winnow)이 필요합니다. 모두 직접 켜기 전까지 꺼져 있습니다. 이런 모델이 없으면 비활성화되고 ⓘ에 이유가 표시됩니다. 이전에 켜 둔 기능은 계속 끌 수 있습니다.

| 기능 | 위치 | 동작 |
| --- | --- | --- |
| **Picture check**(이미지 확인) | **Chat Settings → Agents → Illustrator**(채팅 설정 → 에이전트 → Illustrator) | Illustrator의 새 그림과 셀카를 하나씩 보고 요청한 내용이 담겼는지 확인합니다. 셀카는 캐릭터의 아바타와도 비교합니다. **Make another if it doesn't match**(일치하지 않으면 다시 생성)는 일치하지 않으면 한 번 더 그립니다. **Always make two, keep the better**(항상 2개를 만들고 더 나은 이미지 유지)는 두 개를 그려 더 잘 맞는 것을 남깁니다. 그림을 하나 더 만들 때마다 이미지 생성 비용이 추가됩니다. |
| **Also check**(추가 확인 사항) | **Picture check** 아래 | `Kaelen has short red hair`처럼 직접 정한 확인 사항을 한 줄에 하나씩, 최대 6개 입력합니다. `not: The picture has writing or a watermark`처럼 그림에 나오면 안 되는 내용은 줄 앞에 `not:`를 붙이세요. |
| **Skip a picture the newest one already shows**(최신 이미지에 이미 나온 내용은 생성 건너뛰기) | Illustrator 카드 | 그리기 전에 채팅의 최신 이미지와 그리려는 내용을 비교해 같은 장면을 다시 보여 주게 된다면 건너뜁니다. 직접 요청한 그림은 항상 만듭니다. |
| **Reuse a library background that looks like the place**(장소와 비슷한 라이브러리 배경 재사용) | Illustrator 카드 | 라이브러리에 새 장소의 이름으로 된 배경이 없으면 같은 단어가 들어간 배경을 최대 4개까지 보고, 일치하는 배경이 있으면 새로 그리는 대신 표시합니다. [판단 모델로 이미지 확인하기](../media/illustrator-agent.md#check-pictures-with-a-decision-model)를 참고하세요. |
| **Flag faces that don't match their expression**(지정한 표정과 다른 얼굴 표시) | **Generate Sprites**(스프라이트 생성) 창, 표정만 해당 | 각 얼굴을 그린 뒤 확인하고 지정한 표정과 다를 수 있는 얼굴에 표시하므로, 선택을 해제하거나 다시 그릴 수 있습니다. [AI로 스프라이트 생성하기](../characters/sprites.md#generate-sprites-with-ai)를 참고하세요. |

모델이 꺼져 있거나 느리거나 실패해서 확인을 실행할 수 없으면 통과로 처리합니다. 그림은 만들어진 그대로 유지됩니다.

<a id="what-the-model-sees"></a>

## 모델에 전달되는 정보

활성화 질문과 프롬프트 및 로어북 판정문의 경우, 모델은 판정문과 채팅에 저장된 최근 메시지를 받습니다. 프리셋, 캐릭터 카드, 페르소나, 로어북 항목(Constant 항목 포함), 요약, 에이전트 출력은 받지 않습니다. **@ Depth**로 설정한 항목처럼 메시지 사이에 배치한 텍스트도 제외됩니다. 이런 정보에 의존하는 판정문에는 그 사실 자체를 적어야 합니다.

- 프롬프트와 로어북 판정문, Smart 응답 순서, 활성 캐릭터 자동화는 최근 메시지 5개를 읽습니다. 이 수는 고정입니다.
- 활성화 질문은 에이전트의 **Scan Depth**(깊이 스캔)만큼 읽으며 기본값은 5입니다.
- 각 메시지에는 발언자의 이름이 붙습니다. AI에 숨긴 메시지는 제외됩니다.
- 후처리 에이전트의 질문처럼 답글 뒤에 실행되는 확인은 작성된 답글도 봅니다.
- 판정문의 매크로를 먼저 채우므로 `{{char}}`은 캐릭터 이름으로 전달됩니다.
- 메시지가 모델의 예산에 들어가지 않으면 오래된 메시지부터 제외됩니다.

**Smart 응답 순서**는 명단도 보냅니다. 각 후보의 이름과, 알려져 있으면 상태, 활동, 발언 빈도를 보내고, 성격을 최대 300자까지 보냅니다. 성격이 비어 있으면 설명을 보냅니다.

**활성 캐릭터 자동화**도 명단을 보냅니다. 각 캐릭터의 이름과 설명을 최대 300자까지 보내며, 설명이 비어 있으면 성격을 보냅니다. 출연진이 많아 들어가지 않으면 100자로 줄이거나 이름만 보냅니다. 여기에 Character Tracker가 마지막으로 본 이름도 함께 보냅니다. 이름만으로도 메시지를 넣을 공간이 너무 부족하면 모델에 묻지 않고 Character Tracker가 대신합니다. Merged 그룹의 답글은 답글 하나가 모든 캐릭터의 목소리를 내므로 "the narrator"라는 라벨이 붙습니다.

호스팅된 판정 서비스는 메시지와 함께 이 명단도 받습니다.

**Advanced Memory**는 채팅별 전용 Decision 모델을 쓰며 최근 5개 규칙을 따르지 않습니다. 장면 검사는 관련 기록 범위를 읽습니다. 회상은 최근 대화 텍스트와 후보로 추린 보관 요약을 최대 24개까지 보냅니다. **Maximum recalled scenes**(최대 회상 장면 수)가 더 크면 더 많이 보냅니다. 그다음 캐릭터 접근 권한을 확인한 뒤 모델이 고른 장면의 원본 메시지를 보냅니다. 호스팅 서비스는 이 텍스트를 받으며, 때로는 여러 묶음으로 나누어 받습니다. 회상 단계마다 보통 모델 속도에 맞춰 10~25초가 주어집니다. 두 단계가 답글 하나당 40초를 함께 쓰므로 한 단계에 10초보다 짧은 시간이 주어질 수 있습니다. 시간 안에 답을 받지 못한 기억은 일반 회상으로 대체됩니다. [선택 사항인 Decision 모델](../agents/memory.md#optional-decision-model)을 참고하세요.

<a id="thresholds"></a>

## 임계값

확률은 모델 간에 비교할 수 없습니다. 같은 예가 한 모델에서는 0.99, 다른 모델에서는 0.2가 될 수 있습니다. 기본 예/아니요 임계값은 모델에 따라 다릅니다.

- **내장 모델 또는 OpenAI 호환 채팅 모델 계정:** 0.5
- **TypeSafe, OpenRouter, NanoGPT, Google Gemini 또는 Custom System One 계정:** 0.5
- **Built-in decision model:** 가능한 경우 롤플레이 턴에서 측정한 모델 자체 권장값입니다. JevK5, Liquid d1, Valen-Decision 1.5 4B는 0.3, Valen 정식 릴리스와 Winnow는 0.5(아직 측정하지 않음), Open-Jev 2B와 9B는 0.1

에이전트의 **Run when probability is at least**(실행할 최소 확률)가 이 값을 재정의합니다. 저장된 값이 다르면 편집기가 모델 권장값으로 되돌리기를 제안합니다. 모델을 바꿀 때마다 확인하세요. 프롬프트 판정문과 로어북 Decision 필드는 모델의 기본값을 사용하며, 에이전트의 임계값은 이들의 값을 바꾸지 않습니다.

Custom System One 계정 뒤에서 직접 호스팅하는 Open-Jev도 0.5를 사용합니다. Marinara가 임의의 사용자 지정 엔드포인트를 보정할 수 없기 때문입니다. 0.5 미만의 긍정 결과를 아니요로 읽는 등 내장 Open-Jev와 결과가 다를 수 있습니다.

<a id="time-limits"></a>

## 시간 제한

시간 안에 도착하지 않은 판정은 답 없음이 되며, 생성은 해당 기능의 대체 동작으로 계속됩니다([Marinara에서 사용하는 곳](#where-marinara-uses-it) 참고). 모든 제한은 판정문별로 적용됩니다. 판정문이 여러 개인 요청은 각 판정문에 제한 시간이 주어지며, 각 Choice 답도 판정문 하나로 셉니다. 로컬 모델은 한 번에 몇 개의 요청만 처리하므로 판정문은 차례를 기다리고, 판정문의 시간은 모델이 그 판정문을 처리하기 시작할 때부터 계산합니다.

- **TypeSafe, OpenRouter, Google Gemini 또는 Custom System One 계정:** 1.5초 또는 설정한 **Time limit**. 측정 결과 OpenRouter와 Google Gemini의 응답 시간은 0.2초에서 0.5초였습니다.
- **NanoGPT 판단 모델:** 4초 또는 설정한 **Time limit**. 측정 결과 응답 시간은 0.4초에서 2.5초였습니다.
- **OpenAI 호환 채팅 모델 계정:** 4초 또는 설정한 **Time limit**. 먼저 생각해야 하는 모델은 최소 20초가 주어집니다.
- **내장 모델:** 4초. 먼저 생각해야 하는 모델은 20초가 주어집니다.
- **Built-in decision model:** Open-Jev는 첫 판정문에 4초가 주어지고, 이후 판정문에는 측정 시간이 주어집니다. 2B는 0.35초, 9B는 0.8초입니다. 다른 모델은 시작할 때마다 읽기 속도를 측정하고 그에 따라 제한을 정하므로, 느린 프로세서에는 시간이 더 주어집니다. 판정문에서 요청한 이미지나 클립마다 시간이 추가됩니다. 모델을 한 번 시작하기 전까지는 판정문마다 4초, 이미지마다 30초, 클립마다 60초가 주어집니다.

생성을 취소하면 판정 요청도 멈춥니다.

## 기타 설정

다음 설정은 **Decision settings** 톱니바퀴 안에 있습니다.

- **Also use it to pick who speaks in Smart response order**(스마트 응답 순서에서 발언자를 정하는 데도 사용)는 기본적으로 꺼져 있습니다. [그룹 채팅](../chats/group-chats.md#response-order-individual-only)을 참고하세요.
- **Decision statements per turn**(턴당 판단문 수)은 프롬프트와 로어북 판정문 계획을 제한합니다. 기본값은 32, 최대 255입니다. 이 허용량은 여러 단계에 적용되며 한 턴의 모든 요청이나 지출에 대한 단일 한도가 아닙니다. 에이전트 활성화 질문과 Smart 응답 순서는 별개입니다. [제한과 비용](../prompts/conditional-prompts.md#limits-and-cost)을 참고하세요.
- **Also gate agents that run before the reply**와 **Thinking**은 생각할 수 있는 내장 모델 항목에 표시됩니다. **Built-in decision model**은 추론하지 않으므로 둘 다 없습니다.

## 오답에 대비하기

어떤 모델이든 틀린 답을 낼 수 있으며, 올바른 "예" 답도 임계값에 아슬아슬하게 걸칠 수 있습니다.

- 판정은 답글을 세부 조정하는 데 쓰고, 채팅에 꼭 필요한 일에는 절대 쓰지 마세요. 판정을 놓치면 답글이 덜 맞춤화될 뿐 망가지면 안 됩니다.
- 동의, 콘텐츠 경고, 안전 지침을 판정 조건에 걸지 마세요.
- 활성화 질문으로만 실행되는 에이전트에는 **Bypass the question after this many messages**(지정 메시지 수 후 질문 건너뛰기)를 설정해, 계속 아니요로 답하는 모델 때문에 에이전트가 영원히 실행되지 않는 일을 막으세요.

<a id="troubleshooting"></a>

## 문제 해결

- **테스트 실패.** 메시지에 이유가 나옵니다. 키 거부, 서비스의 요청 제한, 내장 모델 미실행, Decision 모델 미설치, 예/아니요로 답하지 않음, 시간 초과 중 하나입니다.
- **선택 창에 계정의 Decision models가 표시되지 않습니다.** 저장된 모델 목록이 판단 모델보다 오래되었습니다. 선택 창에서 계정 이름 옆의 새로 고침 버튼을 누르세요.
- **서버에 해당 엔드포인트가 없음.** Decision 소스와 서버가 맞지 않습니다. Ollama, LM Studio 및 다른 채팅 모델 서버에는 **OpenAI-compatible chat model**이 필요합니다. **Custom System One endpoint**는 Open-Jev 같은 System One 서버 전용입니다.
- **답이 시간 제한을 넘기거나 판정이 가끔만 작동함.** 서비스가 때때로 **Time limit**보다 느립니다. 여러 번 테스트하고 가장 느린 답보다 제한을 높이세요.
- **활성화 질문이 있는 에이전트가 매 턴 실행됨.** Decision 모델이 설정되지 않았거나 답하지 않아, 에이전트가 질문이 없는 것처럼 실행됩니다. 테스트를 실행하세요.
- **프롬프트의 판정 분기가 나타나지 않음.** [판정 분기가 나타나지 않을 때](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears)를 참고하세요.
- **Smart 응답 순서가 여전히 평소의 AI 호출을 함.** 스위치가 꺼져 있거나, 그 턴에 Decision 모델이 답하지 않았습니다.
- **이미지 설정이 비활성화되고 ⓘ가 표시됩니다.** 선택한 판단 모델이 텍스트만 읽거나 판단 모델이 설정되지 않았습니다. **Built-in decision model**로 Liquid d1, Valen 또는 Winnow를 고르세요. [내장 판단 모델 선택 기준](#which-built-in-decision-model)을 참고하세요.
- **`pictures:`가 있는 판정문이 아니요로 읽힙니다.** `media_within:`을 썼다면 최신 메시지 안에 이미지가 없었던 것입니다. 그 외에는 이미지 때문에 답하는 시간이 제한을 넘은 것입니다. 모델 페이지의 **On this computer**(이 컴퓨터에서) 줄에 이미지 하나를 처리하는 데 걸리는 시간이 표시됩니다.
- **모델이 이 기기에서 실행할 수 없다고 합니다.** 목록 아래의 이유에 프로세서 기능, 그래픽 카드 세대, 라이브러리 등 부족한 항목이 표시됩니다. 다른 모델을 고르세요. Liquid d1과 JevK5는 거의 모든 컴퓨터에서 실행됩니다.
- **활성 캐릭터 자동화가 Character Tracker를 따라감.** 모델이 모든 캐릭터에 대해 답하지 않았거나, 먼저 생각하는 모델인데 **Also gate agents that run before the reply**가 꺼져 있거나, 출연진이 너무 많아 이름만으로도 모델 입력에 들어가지 않습니다.

생성 중 판정 점수와 출력을 보려면 Debug Mode를 켜거나 로그 레벨을 debug로 설정하세요. [로그 레벨](../CONFIGURATION.md#logging-levels)을 참고하세요. 답글을 생성하지 않고 직접 쓴 판정문을 테스트하려면 **Peek Prompt → Decision diagnostics → Test decisions**(프롬프트 미리보기 → 결정 진단 → 결정 테스트)를 여세요. 명시적 테스트는 선택한 모델을 호출하므로 호스팅 서비스에서는 비용이 발생할 수 있습니다. [Decision 문 테스트](../chats/peek-prompt.md#testing-decision-statements)를 참고하세요.

<a id="let-marinara-install-a-decision-model"></a>

## Marinara로 판정 모델 설치하기

**Built-in decision model**은 판단 전용 모델로, Marinara가 다운로드해 내 컴퓨터에서 채팅 모델과 함께 실행합니다. 정보가 컴퓨터 밖으로 나가지 않습니다. 메모리 사용량은 채팅 모델의 사용량에 더해집니다. 이미 로컬 모델을 실행하고 있다면 먼저 그 모델의 판정을 시험해 보세요.

### 내장 판단 모델 선택 기준

| 모델 | 다운로드 | 읽는 입력 | 언어 | 실행 환경 |
| --- | --- | --- | --- | --- |
| **JevK5 4B** | 약 2.7 GB | 텍스트 | 영어 | 거의 모든 컴퓨터. NVIDIA, AMD, Intel 또는 Apple 그래픽이나 프로세서만으로 실행됩니다. 내장 모델과 같은 런타임을 사용합니다. |
| **JevK5 2B** | 약 2 GB | 텍스트 | 영어 | 4B와 같습니다. 프로세서나 작은 그래픽 카드에서 더 빠르지만 정확도는 조금 낮습니다. |
| **Liquid d1 3B** | 약 2.3 GB | 텍스트, 이미지 | 일본어, 중국어, 한국어, 독일어, 스페인어, 러시아어를 포함한 16개 | 거의 모든 컴퓨터. 영어가 아닌 채팅에 적합합니다. 개인과 연 매출 1,000만 달러 미만 기업은 무료입니다. |
| **Valen-Decision 1.5 4B** | 약 5.8 GB | 텍스트, 이미지 | 8개 확인됨 | 64비트 Intel 또는 AMD 프로세서의 Linux에서 프로세서만 사용합니다. |
| **Valen-Decision 1.5 2B (full release)** | 약 6.4 GB | 텍스트, 이미지, 클립 | 명시되지 않음 | Windows, Apple silicon의 macOS, Linux에서 프로세서로 실행됩니다. 메모리가 약 6 GB 필요합니다. |
| **Valen-Decision 1.5 4B (full release)** | 약 11.8 GB | 텍스트, 이미지, 클립 | 8개 확인됨 | 2B와 같습니다. 메모리가 약 12 GB 필요하며, 더 느리지만 정확도가 높습니다. |
| **Winnow E4B** | 약 9 GB | 텍스트, 이미지 | 명시되지 않음 | NVIDIA RTX 50 시리즈 카드, CUDA 13 라이브러리, AVX-512를 지원하는 프로세서(예: AMD Ryzen 7000 또는 9000, 현재 Intel 노트북·데스크톱 칩은 미지원)가 있는 Linux만 지원합니다. 그래픽 메모리가 약 11 GB 필요합니다. |
| **Open-Jev 2B** | 약 4.6 GB | 텍스트 | 영어 | RTX 20 시리즈 이상의 NVIDIA 카드와 드라이버 580 이상이 있는 Linux. 그래픽 메모리 약 4.8 GB와 디스크 약 10 GB를 사용합니다. |
| **Open-Jev 9B** | 약 19.4 GB | 텍스트 | 영어 | 2B와 같습니다. 그래픽 메모리를 약 23.6 GB 사용하므로 24 GB 카드에서는 다른 것을 함께 올릴 공간이 없습니다. |

8개 언어의 롤플레이 턴 20개에서 JevK5 4B, Liquid d1, Valen-Decision 1.5 4B는 20개 모두 정확하게 답했습니다. 잘 모르겠다면 Liquid d1을, 클립을 읽게 하려면 Valen 정식 릴리스를 고르세요.

다운로드 전에 Marinara가 컴퓨터에서 모델을 실행할 수 있는지 확인합니다. 운영 체제, 프로세서 기능, 그래픽 카드와 라이브러리, 여유 메모리를 확인합니다. 실행할 수 없는 모델도 목록에 남으며 **(cannot run here)**(이 기기에서 실행 불가) 표시와 이유가 나옵니다.

### 모델 설치하기

1. 상단 바에서 **Connections**를 클릭하세요. **On this device** 아래의 **Built-in model (decisions)**를 클릭하세요. **Connections** 패널에서 **Add**를 클릭하고 **Decisions** 아래의 **Built-in model (decisions)**를 클릭해도 됩니다.
2. **Model**(모델) 목록에서 모델을 고르세요. 그 아래에 설명, **Answers**와 **Reads**([모델 페이지의 정보](#what-a-model-page-lists) 참고), 언어와 라이선스가 표시됩니다.
3. 모델 이름과 크기가 표시된 **Download**(다운로드)를 클릭하세요. 크기, 하드웨어 평가 결과, 라이선스를 확인하세요. 그 전에는 아무것도 다운로드되지 않습니다.
4. **Use for Decision**(판단에 사용)을 클릭하거나, **Jobs** 상자의 **Behind the scenes** 아래에서 **Decision** 행을 클릭하고 **Built-in model (decisions)**를 고르세요.

모델을 한 번 실행하면 페이지의 **On this computer**에도 처리 시간이 표시됩니다. 채팅 몇 턴, 이미지 하나, 그리고 클립을 읽는 모델이라면 클립 하나를 처리하는 시간입니다. 내 컴퓨터에서 측정한 시간이므로 판정문에서 이미지를 요청할 때 얼마나 느려지는지 알 수 있습니다.

전환하려면 목록에서 다른 모델을 고르세요. 전에 다운로드한 모델에는 **(downloaded)**(다운로드됨)가 표시되며, **Use this model**(이 모델 사용)을 누르면 다시 다운로드하지 않고 전환합니다.

페이지의 다른 컨트롤은 다음과 같습니다.

- **Turn off**(끄기)는 모델을 멈추고 파일은 유지합니다. **Turn on**(켜기)은 다시 시작합니다.
- **Runs on**은 NVIDIA 카드가 여러 개인 컴퓨터에서 사용할 카드를 고릅니다. 바꾸면 모델이 멈췄다가 새 카드에서 다시 시작합니다.
- **Starts**(시작 시점)는 기본적으로 **When an agent first needs it**(에이전트가 처음 필요로 할 때)이며, **With Marinara**(Marinara와 함께)로 설정할 수도 있습니다.
- **Install from a repository**(저장소에서 설치)에는 Hugging Face의 판단 모델을 `owner/model-name` 형식으로 입력합니다. Open-Jev 체크포인트, 판단 모델임을 명시한 GGUF, Valen GGUF 패키지를 사용할 수 있습니다. GGUF의 크기 하나를 고르려면 이름 뒤에 `:Q8_0`을 붙이세요. **Check**(확인)를 클릭하세요. Marinara는 파일의 자체 설명을 읽고 크기와 라이선스를 표시합니다. 보증할 수 없는 저장소는 이유와 함께 거부합니다. 그다음 **Download and install this one**(이 모델 다운로드 및 설치)을 클릭하세요.
- **Remove files**(파일 제거)는 모델과 런타임을 삭제합니다.
- **Reinstall**(다시 설치)은 설치된 모델의 파일이나 런타임이 없거나 오래되어 모델을 시작할 수 없을 때 나타납니다. 주로 업데이트 뒤에 이런 상황이 생깁니다. 모델에는 **Needs reinstall**(다시 설치 필요)이 표시됩니다. 다시 설치할 때 이미 다운로드되어 손상되지 않은 파일은 그대로 두므로, 보통 런타임만 다시 다운로드합니다.

모델이 시작한 뒤 첫 답은 느리므로 Marinara는 로드하는 동안 준비 질문을 하나 보냅니다. 이 질문이 실패해도 모델은 시작되며, 첫 실제 질문에서 지연이 생깁니다. 시작 직후 모델이 멈추면 프로세서에 필요한 기능이 없다는 식으로 페이지에 이유가 표시됩니다.

<a id="run-strands-decider-yourself"></a>

### Strands decider 직접 실행하기

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19)는 System One을 지원하는 또 다른 공개 판정 모델(Apache-2.0)입니다. Marinara에서 설치할 수는 없지만, 직접 실행해 두는 동안 **Custom System One endpoint**로 사용할 수 있습니다.

1. Python 3.10 이상 환경에서 설치하고 서버를 시작하세요.

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   NVIDIA GPU나 Apple silicon이 있으면 사용하고, 없으면 프로세서에서 더 느리게 실행됩니다. 처음 시작할 때 모델과 약 4.6 GB의 기본 가중치를 다운로드하며, Python 패키지는 약 5.5 GB를 차지합니다. 서버에 비밀번호가 없으므로 `127.0.0.1`에서만 실행하세요.

2. **Server address**가 `http://127.0.0.1:8000`인 **Own decision server** 계정을 추가하세요. 모델 이름은 아무것이나 써도 됩니다.
3. **Decision** 행에서 이 모델을 고른 다음 계정의 **⋯** 메뉴에 있는 **Test**로 테스트하세요. 시작 후 첫 답은 약 2초가 걸려 기본 시간 제한보다 길므로, 채팅 전에 한 번 테스트하세요.

확률이 보정되어 있으므로, 직접 호스팅하는 Open-Jev와 달리 기본 임계값 0.5가 적합합니다([임계값](#thresholds) 참고). 답이 표현에 좌우되므로 [판정문 작성하기](../prompts/conditional-prompts.md#writing-statements)를 따르세요.

## 관련 가이드

- [사용자 지정 에이전트 만들기](../agents/custom-agents.md)
- [조건부 프롬프트](../prompts/conditional-prompts.md)
- [그룹 채팅](../chats/group-chats.md)
- [내장 모델 설정](local-model.md)
- [AI 제공자에 연결하기](connecting-to-a-provider.md)
