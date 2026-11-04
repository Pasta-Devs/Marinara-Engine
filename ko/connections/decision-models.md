# Decision 모델

Decision 모델은 "Does the latest message move the scene to a new place?"처럼 Marinara가 묻는 예/아니요 질문에 답하는 작은 모델입니다. 로어북, 사용자 지정 에이전트, 프롬프트, 그룹 채팅이 이 모델을 사용합니다. 이 기능은 선택 사항입니다. 설정하지 않아도 채팅은 그대로 작동하며, 각 기능은 [Marinara에서 사용하는 곳](#where-marinara-uses-it)에 설명한 대체 동작을 사용합니다.

답은 Marinara의 동작을 제어하며 채팅에 게시되는 일은 없습니다. 모델은 문장에 0부터 1까지의 점수를 매깁니다. Marinara는 이 숫자를 임계값과 비교해 예 또는 아니요로 처리합니다. "angry", "sad", "none of these"처럼 짧은 목록에서 답 하나를 고를 수도 있습니다.

권장 사항: 잘 모르겠다면 **None**(없음)으로 두세요. 판정을 쓰고 싶다면 이미 있을 수도 있는 내장 모델이나, 이미 실행 중인 서버의 채팅 모델을 사용하세요. 둘 다 추가 비용이 들지 않습니다.

## Decision 모델 선택하기

시작하기 전에 [선택 기준](#which-one-to-pick)을 참고하세요.

1. 상단 바에서 **Connections**(연결)를 클릭하고 **Jobs**(작업) 상자를 여세요.
2. **Behind the scenes**(무대 뒤) 아래의 **Decision**(판단) 행을 클릭하세요. 목록이 열립니다.
3. 모델을 고르세요. 목록에는 3개 그룹이 있습니다.
   - **None (decisions off)**(없음, 판단 끔)가 기본값입니다. 아무것도 묻지 않으며, 에이전트 편집기의 활성화 질문 필드는 비활성 상태로 남습니다.
   - **Built-in model**(내장 모델) 그룹에는 Marinara가 내 컴퓨터에서 실행하는 모델이 있습니다. **Built-in model**, **Built-in model (utility)**(내장 모델, 보조), **Built-in model (decisions)**(결정 사이드카, 실험적)입니다. 정보가 컴퓨터 밖으로 나가지 않습니다.
   - **Connections** 그룹에는 판정에 답할 수 있는 내 계정이 있습니다. 호스팅 서비스이거나, 이미 실행 중인 서버의 채팅 모델입니다.
4. 테스트하려면 행의 **Decision settings**(판단 설정) 톱니바퀴를 클릭한 다음 **Test**(테스트)를 클릭하세요. 이 버튼은 내장 모델 항목에 표시됩니다. TypeSafe나 OpenRouter 계정이라면 해당 모델의 **Edit model**(모델 편집)을 열고 **Test provider**(연결 테스트)를 클릭하세요. **Own decision server**(자체 판단 서버) 계정이라면 계정의 **⋯** 메뉴에 있는 **Test**를 사용하세요.

테스트에 성공하면 "예"일 확률과 답하는 데 걸린 시간이 표시됩니다. 내 컴퓨터의 모델이라면 로그 확률을 사용할 수 있었는지, 모델이 바로 답하는지도 알려 줍니다. 로그 확률은 모델이 쓸 수 있는 각 단어에 대한 확신도 수치입니다. 테스트는 내 채팅이 아닌 고정된 샘플을 보냅니다.

실패하면 메시지에 이유가 나옵니다. 흔한 원인은 키 거부, 서비스의 요청 제한, 내장 모델 미실행, 시간 제한 초과입니다. [문제 해결](#troubleshooting)을 참고하세요.

지금 답할 수 없는 항목도 목록에 회색으로 남으며 이유가 함께 표시됩니다. **None**을 고르면 활성화 질문이나 판정문을 삭제하지 않고 판정을 끕니다.

<a id="which-one-to-pick"></a>

### 선택 기준

- **내장 모델에서 이미 실행 중인 모델.** 추가 비용이 없습니다. 내장 모델을 쓰는 대부분의 사용자에게 가장 좋습니다.
- **내 서버의 채팅 모델**(Ollama, LM Studio, llama.cpp 또는 다른 OpenAI 호환 서버). 추가 비용이 없습니다. 모델이 Marinara 밖에서 실행될 때 적합하며, 모델을 두 번 로드하지 않아도 됩니다.
- **호스팅된 Decision 계정**(TypeSafe 또는 OpenRouter 키). 요청마다 과금되며 한 턴에 여러 번 요청할 수 있습니다. 휴대전화나 로컬 모델을 실행하지 않는 컴퓨터에 적합합니다.
- **Built-in decision model**(결정 사이드카). 별도의 디스크와 GPU 메모리를 사용합니다. Linux x86-64와 지원되는 NVIDIA GPU가 필요합니다. 채팅 모델 옆에 별도의 Decision 모델을 둘 때 쓰입니다.

이미 로컬 모델을 실행하고 있다면 먼저 그 모델을 써 보고, 자신의 채팅 턴으로 테스트하세요. 표현이 결과를 크게 좌우합니다. [판정문 작성하기](../prompts/conditional-prompts.md#writing-statements)를 참고하세요.

Jev와 Open-Jev는 다른 모델입니다. Jev는 TypeSafe의 호스팅 모델이며 직접 또는 OpenRouter를 통해 이용할 수 있습니다. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B)는 Qwen 기반으로 별도 공개된 모델이며 Marinara가 로컬에서 실행할 수 있습니다. Open-Jev 테스트는 호스팅된 Jev를 측정하지 않습니다.

Android(Termux)에서는 **Built-in decision model**을 실행할 수 없고, 휴대전화 프로세서에서 돌리는 작은 로컬 모델은 너무 느릴 수 있습니다. OpenRouter를 통한 Jev처럼 호스팅 계정이 실용적인 선택입니다. [Decision 연결 설정하기](#set-up-a-decision-connection)를 참고하세요.

프리셋, 카드, 에이전트는 "Decision 모델"을 기준으로 작성하고 "Jev 필수"로 만들지 마세요. 어떤 모델에서든 같은 문장 구문을 쓰지만 모델마다 답이 다를 수 있습니다. 사용자 지정 에이전트와 Agent Organizer 설치를 포함해 판정을 사용하는 콘텐츠를 가져오면 Marinara가 이 가이드로 연결되는 알림을 표시합니다. 전체 프로필 ZIP을 복원할 때는 이 알림이 표시되지 않습니다.

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

1. **Connections** 패널에서 그 모델의 **⋯**을 클릭하고 **Use this model for decisions**(이 모델을 결정에 사용)를 고르세요. **Add account**(계정 추가) 창이 판정 단계에서 열리며, 같은 주소, 모델, 키가 채워져 있습니다.
2. 모델을 고른 다음 **Test decision**(판단 테스트)을 클릭하세요. 테스트에 성공하면 서버가 로그 확률을 반환했는지, 모델이 먼저 생각해야 했는지 알려 줍니다. **Done**(완료)을 클릭하세요.
3. **Behind the scenes** 아래의 **Decision** 행을 클릭하고 새 모델을 고르세요.

직접 만들 수도 있습니다. 소스가 **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**(OpenAI 호환 채팅 모델, Ollama, LM Studio, llama.cpp)인 Decision 계정을 쓰고, 채팅 계정과 같은 주소(예: Ollama라면 `http://localhost:11434/v1`)와 서버가 쓰는 모델 이름을 입력하세요.

질문 방식은 내장 모델과 같습니다. 판정문마다 예/아니요 한 단어를 요청합니다. Marinara는 서버가 동시에 처리하는 요청 수를 알 수 없으므로 판정문을 하나씩 보냅니다. 계정의 **Thinking**은 항상 **Auto**입니다. 다른 컴퓨터에 있는 서버에는 `PROVIDER_LOCAL_URLS_ENABLED`가 필요합니다. [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)를 참고하세요.

<a id="set-up-a-decision-connection"></a>

## Decision 연결 설정하기

호스팅된 Decision 계정은 선택한 최근 메시지와 판정문을 서비스로 보내며 비용이 발생할 수 있습니다. Smart 응답 순서는 [캐릭터 명단](#what-the-model-sees)도 보냅니다.

1. 상단 바에서 **Connections**를 클릭한 다음 **Add**(추가)를 클릭하세요.
2. **Decisions**(판단) 아래에서 **TypeSafe**나 **Own decision server**를 클릭하세요. OpenRouter라면 **Chat**(채팅) 아래의 **OpenRouter**를 클릭해 연결한 다음, 모델의 **⋯** 메뉴에서 **Use this key for decisions**(이 키를 판단에 사용)를 사용하세요.
3. **API key**(API 키)를 입력하세요. **Own decision server**라면 **Server address**(서버 주소)를 입력하세요. **Connect**(연결)를 클릭하세요. 창이 닫히고 패널에 새 계정이 표시됩니다.
4. **Behind the scenes** 아래의 **Decision** 행을 클릭하고 새 모델을 고르세요.
5. 테스트하려면 패널에서 모델을 클릭해 **Edit model**을 연 다음 **Provider tests**(연결 테스트) 카드의 **Test provider**를 클릭하세요. **Own decision server** 모델에는 그곳에 **Test provider** 버튼이 없습니다. 대신 패널에서 계정의 **⋯** 메뉴를 열고 **Test**를 클릭하세요.

**Test provider**가 성공하면 확률, 답하는 데 걸린 시간, 계정의 시간 제한이 표시됩니다. **⋯** 메뉴에 있는 계정의 **Test**는 작동 여부와 걸린 시간만 알려 줍니다. 테스트는 최소 10초를 기다리며, 시간 제한이 그보다 길면 제한보다 5초 더 기다립니다. 답이 제한보다 오래 걸렸다면 결과에 그렇게 표시됩니다. 채팅에서는 그 답이 답 없음으로 처리됩니다.

실패했다면 [문제 해결](#troubleshooting)을 참고하세요.

Decision 편집기(Decision 모델의 **Edit model**)에는 다음 필드가 있습니다.

| 필드 | 하는 일 |
| --- | --- |
| **Decision source**(판단 소스) | **TypeSafe**, **OpenRouter**, **Custom System One endpoint**(사용자 지정 System One 엔드포인트) 또는 **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**입니다. 모델을 만들 때 고정됩니다. |
| **API key source**(API 키 소스) | **Enter a separate key (optional for local servers)**(별도의 키를 입력하세요, 로컬 서버는 선택 사항) 또는 다른 계정의 **Use key from …**(…의 키 사용)입니다. 연결된 키는 이후의 키 변경을 따라갑니다. 사용자 지정 System One 모델이나 OpenAI 호환 모델은 두 주소의 스킴, 호스트, 포트가 같을 때만 사용자 지정 채팅 계정의 키를 빌릴 수 있습니다. |
| **Recent-message token budget**(최근 메시지 토큰 예산) | 보낼 채팅의 추정 토큰 수입니다. 1부터 30,000까지입니다. 기본값은 TypeSafe와 OpenRouter가 30,000, 사용자 지정 서버가 3,500입니다. Marinara는 오래된 메시지부터 버린 다음 가장 최신 메시지의 앞부분을 잘라 냅니다. 거부되거나 예산을 넘긴 요청은 답 없음이 됩니다. |
| **Time limit (seconds)**(제한 시간, 초) | 채팅 중 판정문 하나마다 기다리는 시간입니다. 0.5부터 30까지입니다. 기본값은 1.5이며, OpenAI 호환 채팅 모델은 4입니다. [시간 제한](#time-limits)을 참고하세요. |

TypeSafe는 `https://api.typesafe.ai`로 요청을 보냅니다. **Base URL**(기본 URL)을 TypeSafe의 API를 실행하는 다른 서버로 바꿀 수 있으며, 이때 `/v1/systemone`은 빼고 입력합니다. 이 경우에도 TypeSafe 키가 필요하며 키는 그 서버로 전송됩니다. **Custom System One endpoint**는 Open-Jev나 [Strands decider](#run-strands-decider-yourself)처럼 직접 실행하는 System One 서버를 받습니다. 주소는 `/v1/systemone` 없이 입력하세요. Ollama 같은 채팅 모델 서버는 System One을 사용하지 않습니다. 이런 서버에는 **OpenAI-compatible chat model**을 사용하세요.

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

활성화 질문은 에이전트의 실행 여부를 정합니다. 프롬프트 안의 판정문은 실행 중인 에이전트에 무엇을 전달할지 정합니다. 예/아니요 조건에는 `{{#if decision:"..."}}`을, 여러 답 중 선택에는 `{{#if decision_choice:"..." == "..."}}`을 사용하세요.

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
- **TypeSafe, OpenRouter 또는 Custom System One 계정:** 0.5
- **Built-in decision model:** 모델 매니페스트의 권장값. Open-Jev 2B와 9B는 0.1

에이전트의 **Run when probability is at least**(실행할 최소 확률)가 이 값을 재정의합니다. 저장된 값이 다르면 편집기가 모델 권장값으로 되돌리기를 제안합니다. 모델을 바꿀 때마다 확인하세요. 프롬프트 판정문과 로어북 Decision 필드는 모델의 기본값을 사용하며, 에이전트의 임계값은 이들의 값을 바꾸지 않습니다.

Custom System One 계정 뒤에서 직접 호스팅하는 Open-Jev도 0.5를 사용합니다. Marinara가 임의의 사용자 지정 엔드포인트를 보정할 수 없기 때문입니다. 0.5 미만의 긍정 결과를 아니요로 읽는 등 내장 Open-Jev와 결과가 다를 수 있습니다.

<a id="time-limits"></a>

## 시간 제한

시간 안에 도착하지 않은 판정은 답 없음이 되며, 생성은 해당 기능의 대체 동작으로 계속됩니다([Marinara에서 사용하는 곳](#where-marinara-uses-it) 참고). 모든 제한은 판정문별로 적용됩니다. 판정문이 여러 개인 요청은 각 판정문에 제한 시간이 주어지며, 각 Choice 답도 판정문 하나로 셉니다. 로컬 모델은 한 번에 몇 개의 요청만 처리하므로 판정문은 차례를 기다리고, 판정문의 시간은 모델이 그 판정문을 처리하기 시작할 때부터 계산합니다.

- **TypeSafe, OpenRouter 또는 Custom System One 계정:** 1.5초 또는 설정한 **Time limit**
- **OpenAI 호환 채팅 모델 계정:** 4초 또는 설정한 **Time limit**. 먼저 생각해야 하는 모델은 최소 20초가 주어집니다.
- **내장 모델:** 4초. 먼저 생각해야 하는 모델은 20초가 주어집니다.
- **Built-in decision model:** 첫 판정문은 4초. 이후 판정문에는 모델의 측정 시간이 주어집니다. Open-Jev 2B는 0.35초, Open-Jev 9B는 0.8초입니다. 저장소에서 설치한 모델은 판정문마다 4초가 주어집니다.

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
- **서버에 해당 엔드포인트가 없음.** Decision 소스와 서버가 맞지 않습니다. Ollama, LM Studio 및 다른 채팅 모델 서버에는 **OpenAI-compatible chat model**이 필요합니다. **Custom System One endpoint**는 Open-Jev 같은 System One 서버 전용입니다.
- **답이 시간 제한을 넘기거나 판정이 가끔만 작동함.** 서비스가 때때로 **Time limit**보다 느립니다. 여러 번 테스트하고 가장 느린 답보다 제한을 높이세요.
- **활성화 질문이 있는 에이전트가 매 턴 실행됨.** Decision 모델이 설정되지 않았거나 답하지 않아, 에이전트가 질문이 없는 것처럼 실행됩니다. 테스트를 실행하세요.
- **프롬프트의 판정 분기가 나타나지 않음.** [판정 분기가 나타나지 않을 때](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears)를 참고하세요.
- **Smart 응답 순서가 여전히 평소의 AI 호출을 함.** 스위치가 꺼져 있거나, 그 턴에 Decision 모델이 답하지 않았습니다.
- **활성 캐릭터 자동화가 Character Tracker를 따라감.** 모델이 모든 캐릭터에 대해 답하지 않았거나, 먼저 생각하는 모델인데 **Also gate agents that run before the reply**가 꺼져 있거나, 출연진이 너무 많아 이름만으로도 모델 입력에 들어가지 않습니다.

생성 중 판정 점수와 출력을 보려면 Debug Mode를 켜거나 로그 레벨을 debug로 설정하세요. [로그 레벨](../CONFIGURATION.md#logging-levels)을 참고하세요. 답글을 생성하지 않고 직접 쓴 판정문을 테스트하려면 **Peek Prompt → Decision diagnostics → Test decisions**(프롬프트 미리보기 → 결정 진단 → 결정 테스트)를 여세요. 명시적 테스트는 선택한 모델을 호출하므로 호스팅 서비스에서는 비용이 발생할 수 있습니다. [Decision 문 테스트](../chats/peek-prompt.md#testing-decision-statements)를 참고하세요.

<a id="let-marinara-install-a-decision-model"></a>

## Marinara로 판정 모델 설치하기

**Built-in decision model**은 실험적인 판정 전용 모델로, Marinara가 다운로드해 채팅 모델 옆에서 별도의 로컬 프로세스로 실행합니다. 메모리 사용량은 채팅 모델의 사용량에 더해집니다. 이미 로컬 모델이 있다면 먼저 그 모델의 판정을 시험해 보세요.

Open-Jev 모델에는 Linux **x86-64**, 컴퓨트 기능 7.5 이상인 NVIDIA GPU(Turing, RTX 20 시리즈 이상), 드라이버 580 이상이 필요합니다. Linux ARM과 더 오래된 카드는 지원하지 않습니다. 모델을 실행할 수 없는 환경에서도 옵션은 계속 보이며, 이유를 알려 주고 **Set up a Decision provider instead**(대신 결정 연결 설정)를 제시합니다.

| 모델 | 모델 다운로드 | 런타임 포함 디스크 | GPU 메모리 |
| --- | --- | --- | --- |
| Open-Jev 2B | 약 4.6 GB | 약 10 GB | 약 4.8 GB (4.5 GiB) |
| Open-Jev 9B | 약 19.4 GB | 약 25.3 GB | 약 23.6 GB (22 GiB) |

카탈로그의 추정치입니다. 9B 모델은 24 GB GPU에서 여유가 거의 없습니다. 내 카드에 대한 설치 프로그램의 평가 결과를 확인하세요.

1. **Connections** 패널에서 **Add**를 클릭하고 **Decisions** 아래의 **Built-in model (decisions)**를 클릭하세요. **Built-in decision model**이라는 제목의 창이 열립니다. **Built-in model** 카드의 페이지에서도 열 수 있습니다.
2. 경고를 읽은 다음 **Use the built-in decision model**(결정 사이드카 활성화)을 켜세요. **Turn on the built-in decision model?**(결정 사이드카를 활성화하시겠습니까?)이라는 제목의 대화 상자에 내 컴퓨터에 대한 평가 결과가 표시됩니다. **Enable**(활성화)을 클릭하세요. 평가 결과가 경고라면 **Enable anyway**(그래도 활성화)를 클릭하세요.
3. **Available decision models**(사용 가능한 결정 모델) 아래에서 **Open-Jev 2B**나 **Open-Jev 9B**를 고르세요. **Download and install**(다운로드 및 설치)을 클릭하고 크기, 하드웨어 평가 결과, 라이선스를 확인하세요. 그 전에는 아무것도 다운로드되지 않습니다.
4. **Behind the scenes** 아래의 **Decision** 행을 클릭하고 **Built-in model (decisions)**를 고르세요.

창의 다른 컨트롤은 다음과 같습니다.

- **Install from a repository**(저장소에서 설치)에는 HuggingFace의 판정 모델을 `owner/model-name` 형식으로 입력합니다. **Check**(확인)를 클릭하세요. Marinara는 저장소 자체의 매니페스트를 읽고, 이 빌드에 포함된 런타임에 대응하는지 확인한 다음, 기본 가중치와 전체 크기를 보여 줍니다. 보증할 수 없는 저장소는 이유와 함께 거부합니다. 그다음 **Download and install this one**(이 모델 다운로드 및 설치)을 클릭하세요.
- **GPU**는 NVIDIA GPU가 여러 개인 컴퓨터에서 사용할 카드를 고릅니다. 바꾸면 모델이 멈췄다가 새 카드에서 다시 시작합니다.
- **Start this model when Marinara starts**(Marinara가 시작될 때 이 모델을 함께 시작합니다)는 선택 사항입니다. 끄면 에이전트가 처음 필요로 할 때 시작합니다.
- **Remove files**(파일 제거)는 모델과 런타임을 삭제합니다. 모델을 끄면 프로세스가 멈추고 파일은 유지됩니다.

모델이 시작한 뒤 첫 답은 느리므로 Marinara는 로드하는 동안 준비 질문을 하나 보냅니다. 이 질문이 실패해도 모델은 시작되며, 첫 실제 질문에서 지연이 생깁니다. 긴 채팅에서 판정문이 많은 턴은 더 오래 걸립니다. 긴 채팅에서 Open-Jev 2B는 판정문당 약 0.25초가 걸립니다.

<a id="run-strands-decider-yourself"></a>

### Strands decider 직접 실행하기

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19)는 System One을 지원하는 또 다른 공개 판정 모델(Apache-2.0)입니다. Marinara에서 설치할 수는 없지만, 직접 실행해 두는 동안 **Custom System One endpoint**로 사용할 수 있습니다.

1. Python 3.10 이상 환경에서 설치하고 서버를 시작하세요.

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   NVIDIA GPU나 Apple silicon이 있으면 사용하고, 없으면 프로세서에서 더 느리게 실행됩니다. 처음 시작할 때 모델과 약 4.6 GB의 기본 가중치를 다운로드하며, Python 패키지는 약 5.5 GB를 차지합니다. 서버에 비밀번호가 없으므로 `127.0.0.1`에서만 실행하세요.

2. **Server address**가 `http://127.0.0.1:8000`인 **Own decision server** 계정을 추가하세요. 모델 이름은 무엇이든 됩니다.
3. **Decision** 행에서 이 모델을 고른 다음 계정의 **⋯** 메뉴에 있는 **Test**로 테스트하세요. 시작 후 첫 답은 약 2초가 걸려 기본 시간 제한보다 길므로, 채팅 전에 한 번 테스트하세요.

확률이 보정되어 있으므로, 직접 호스팅하는 Open-Jev와 달리 기본 임계값 0.5가 적합합니다([임계값](#thresholds) 참고). 답이 표현에 좌우되므로 [판정문 작성하기](../prompts/conditional-prompts.md#writing-statements)를 따르세요.

## 관련 가이드

- [사용자 지정 에이전트 만들기](../agents/custom-agents.md)
- [조건부 프롬프트](../prompts/conditional-prompts.md)
- [그룹 채팅](../chats/group-chats.md)
- [내장 모델 설정](local-model.md)
- [AI 제공자에 연결하기](connecting-to-a-provider.md)
