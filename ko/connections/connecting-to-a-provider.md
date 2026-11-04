# AI 제공자에 연결하기

채팅을 하려면 Marinara Engine에 AI 모델이 있어야 합니다. AI 서비스의 계정을 추가하고, 그 API 키를 붙여넣고, 모델을 고르면 됩니다. API 키는 서비스가 발급하는 비밀 문자열로, Marinara가 그 서비스의 내 계정을 쓸 수 있게 해 줍니다. 비밀번호처럼 다루세요. 키 없이 내 컴퓨터에서 돌아가는 작은 모델인 [내장 모델](local-model.md)을 쓸 수도 있습니다.

## 계정 추가하기

시작하기 전에 쓰려는 서비스에서 API 키를 받으세요. **Add account**(계정 추가) 창에는 서비스마다 **Where do I find my key?**(키는 어디서 찾나요?) 링크가 있습니다. 많이 쓰는 서비스에서 이 링크가 여는 페이지는 다음과 같습니다.

- OpenRouter(무료 모델 있음): `openrouter.ai/keys`
- NanoGPT: `nano-gpt.com/api`
- OpenAI: `platform.openai.com/api-keys`
- Anthropic: `console.anthropic.com/settings/keys`
- Google Gemini: `aistudio.google.com/apikey`

대부분의 서비스는 키를 쓰기 전에 가입을 요구하며, 크레딧 충전까지 요구하는 곳도 있습니다. 다른 서비스는 [지원하는 AI 제공자](providers-reference.md)를 참고하세요. 키 없이 내 컴퓨터에서 모델을 쓰려면 [내장 모델 설정](local-model.md)을 참고하세요.

1. 상단 바에서 **Connections**(연결)를 클릭하세요. 오른쪽에 패널이 열립니다. 아직 계정이 없으면 패널에 **Where do your models come from?**(모델을 어디서 가져오나요?)라는 질문과 몇 가지 서비스가 표시됩니다. **Built-in model**(내장 모델)이 아닌 서비스를 클릭하세요. **Add account** 창이 키 단계에서 열립니다. 4단계로 가세요.
2. **Add**(추가)를 클릭하세요. **Add account** 창이 열립니다.
3. 원하는 서비스를 클릭하세요. **Search providers**(제공자 검색)라는 라벨이 붙은 상자에 입력하면 찾을 수 있습니다. 목록에는 **Chat**(채팅), **Images & video**(이미지 및 동영상), **Voice**(음성), **Decisions**(판단) 섹션이 있습니다. 일반 채팅 모델은 **Chat** 아래에서 찾으세요.
4. **API key**(API 키)를 클릭하고 키를 붙여넣으세요. 눈 모양 버튼을 클릭해 키를 빠짐없이 붙여넣었는지 확인하세요.
5. **Connect**(연결)를 클릭하세요. Marinara가 키를 테스트합니다. 키가 작동하면 **Connected**(연결됨)와 함께 찾은 모델 수가 표시됩니다.
6. 다음 단계는 Main 모델이 이미 있는지에 따라 다릅니다. Main은 채팅 답변을 쓰는 작업입니다.
   - **아직 Main 모델이 없거나, 새 채팅에서 Add를 열었을 때:** 창에 그 서비스의 모델이 표시됩니다. **Recommended**(권장) 모델이 맨 위에 있습니다. 모델을 클릭해 추가하거나 **Search or enter model ID…**(검색 또는 모델 ID 입력…)에 이름을 입력하세요. 무엇을 고를지 모르겠다면 **Recommended** 모델을 고르세요. 나중에 바꿀 수 있습니다. **Make … my Main model**(내 메인 모델로 설정)은 체크된 상태로 두세요. 이 항목은 Main 모델이 없을 때만 표시됩니다. 새 채팅에서 Add를 열었고 이미 Main 모델이 있다면 대신 **Set … as Main**(메인으로 설정) 버튼이 표시됩니다. 그다음 **Done**(완료)을 클릭하거나, 새 채팅에서 열었다면 **Start chatting**(채팅 시작)을 클릭하세요.
   - **이미 Main 모델이 있을 때:** 창이 닫히고, 계정이 추가되었다는 메시지가 모델 수와 함께 표시됩니다. 모델을 더 추가하려면 계정의 **⋯**을 클릭하고 **Add model**(모델 추가)을 고르세요.

패널에 내 계정이 표시됩니다. 5단계의 **Connected**가 이미 키가 작동한다는 뜻입니다. 새 모델이 Main 모델이라면 채팅을 시작해 메시지를 보내 보세요. 답변이 오면 모두 정상입니다. 이미 Main 모델이 있었다면 새 채팅은 계속 그 모델을 씁니다. 새 계정을 쓰려면 계정에 모델을 추가한 다음(**⋯** → **Add model**), 그 모델을 채팅이나 작업에 지정하세요([작업별 모델 고르기](#choosing-the-model-for-each-job) 참고).

작동하지 않는 경우:

- **The key was not accepted. Check that you copied all of it.**(키가 거부되었습니다. 키를 빠짐없이 복사했는지 확인하세요.) 키를 다시 붙여넣고 **Try again**(다시 시도)을 클릭하세요. 키는 고른 서비스에서 발급한 것이어야 합니다.
- **The service is busy, or your credit is used up.**(서비스가 바쁘거나 크레딧을 모두 썼습니다.) 서비스 웹사이트에서 크레딧을 충전하거나, 잠시 기다린 다음 다시 시도하세요.
- **Marinara could not reach**라는 메시지가 나옵니다. Marinara가 서비스에 접속하지 못했다는 뜻입니다. 인터넷 연결을 확인한 다음 **Try again**을 클릭하세요.

### 선택 사항인 계정 필드

키 단계에는 다음 필드도 표시됩니다. 필요할 때만 입력하고, 그 외에는 비워 두세요.

- **Name (optional)**(이름, 선택 사항): 패널에 표시되는 이름입니다. 비워 두면 서비스 이름을 씁니다. 같은 서비스의 두 번째 계정에는 `OpenAI · …a1b2`처럼 키의 마지막 4자가 붙습니다.
- **Address**(주소): Marinara가 요청을 보내는 곳입니다. 비워 두면 Marinara가 서비스 자체 주소를 씁니다. 프록시, 게이트웨이, 직접 운영하는 서버를 쓸 때만 입력하세요. 내 컴퓨터에서 로그인하는 서비스에는 이 필드가 표시되지 않습니다.
- **Requests per minute**(분당 요청 수): 이 계정에서 Marinara의 요청 속도를 늦춥니다. 비워 두면 제한이 없습니다. 1~600 사이의 값을 쓸 수 있습니다.
- **Parallel jobs**(병렬 작업 수): 동시에 실행되는 요청 수입니다. 비워 두면 제한이 없습니다. 1~16 사이의 값을 쓸 수 있습니다. **Edit account**(계정 편집)에서는 같은 설정이 **Parallel requests**(병렬 요청 수)라는 이름으로 표시됩니다.

키 대신 내 컴퓨터의 로그인을 쓰는 서비스도 있습니다. 이런 서비스에는 **Sign in**(로그인) 태그가 붙고 키 입력란이 없습니다. [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)을 참고하세요. 내 컴퓨터의 서버라면 [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)를 참고하세요. 테스트가 실패하면 **Continue anyway**(그래도 계속)가 나타납니다. 이 버튼은 테스트를 통과하지 않은 채로 계정을 저장합니다.

### 계정 없이 채팅 시작하기

모델이 없는 상태에서 채팅을 시작하면 Marinara가 먼저 **Add account** 창을 엽니다. **Connect** 후에 모델을 클릭한 다음 **Start chatting**을 클릭하세요.

## Connections 패널

계정은 **Connections** 패널에서 관리합니다. 위에서 아래로 다음 항목이 표시됩니다.

- 입력하는 대로 목록을 걸러 주는 검색 상자. 라벨은 **Search models and accounts**(모델 및 계정 검색)입니다.
- **Add**는 **Add account** 창을 엽니다. **More actions**(추가 작업, 점 3개)에는 **Import account**(연결 가져오기), **Export all accounts**(모든 계정 내보내기), 접기, 묶기가 있습니다. 패널이 넓으면 정렬 드롭다운이 검색 상자 옆에 있습니다. 패널이 좁으면 정렬은 **More actions** 안에 있습니다.
- **Jobs**(작업) 상자. 어떤 모델이 어떤 작업을 맡는지 보여 줍니다.
- **Built-in model** 카드. [내장 모델 설정](local-model.md)을 참고하세요.
- 내 계정 목록. 계정마다 저장한 모델이 그 아래에 있습니다. [연결 정리하기](organizing-connections.md)를 참고하세요.

**계정**은 서비스 하나에 대해 저장한 키, 로그인 또는 주소 하나입니다. 같은 서비스의 키를 2개 쓴다면 계정도 2개입니다. **모델**은 계정에서 저장해 둔 AI 모델 하나입니다. 저장한 모델마다 자기 설정이 따로 있습니다.

<a id="choosing-the-model-for-each-job"></a>

## 작업별 모델 고르기

작업은 모델이 나 대신 하는 일입니다. **Jobs** 상자에는 작업이 4개 그룹으로 나뉘어 표시됩니다.

| 그룹 | 작업 |
| --- | --- |
| **Chat** | **Main**(메인)은 채팅의 답변을 씁니다. **Agents**(에이전트)는 보조 에이전트를 실행합니다. **Impersonate**(유저 사칭)는 나 대신 글을 씁니다. |
| **Omnibar** | **Professor Mari**와 **Quick answers**(빠른 답변). |
| **Pictures & sound**(그림 및 사운드) | **Images**(이미지), **Video**(비디오), **Voice (Text to Speech)**(음성, TTS), 그리고 사용할 수 있을 때는 **Dictation (Speech to Text)**(받아쓰기, 음성 인식). |
| **Behind the scenes**(무대 뒤) | **Decision**(판단), **Embeddings**(임베딩), **Image reading**(이미지 읽기). |

각 행에는 그 작업을 맡은 모델이 표시됩니다. 모델이 없으면 **Follows Main**(메인 따름)이나 **Off**(꺼짐)처럼 모델 없이 그 작업이 어떻게 동작하는지 표시됩니다. 모델이 꼭 필요한 작업에는 **Choose a model**(모델 선택)이 표시됩니다. **Jobs**를 클릭하면 상자가 접힙니다.

작업의 모델을 바꾸려면 그 행을 클릭하세요. 세 행을 빼면 그 작업의 **Model for**(용도별 모델) 창이 열립니다. **Decision**과 **Embeddings**는 각자의 컨트롤을 엽니다([Decision 모델](decision-models.md)과 [지원하는 AI 제공자](providers-reference.md#embeddings) 참고). **Dictation (Speech to Text)**는 음성 설정을 엽니다.

**Model for** 창에서는 다음과 같이 하세요.

1. 목록을 보세요.
2. 모델을 클릭하세요. 목록에서 그 모델이 **Now**(현재) 아래에 표시되고, 이어서 **Starred**(별표) 모델이, 그다음에 저장한 모델이 계정별로 표시됩니다. 계정 아래의 **All models**(모든 모델)는 그 계정의 전체 목록을 엽니다. **Search all models or paste a model ID**(모든 모델 검색 또는 모델 ID 붙여넣기)에 입력하면 모든 계정을 한 번에 검색합니다. 먼저 모델을 저장할 필요는 없습니다.

창 위쪽의 **If it fails**(실패하면)는 첫 번째 모델이 실패했을 때 대신 답할 두 번째 모델을 고릅니다. 아래쪽의 **Add account**는 계정 추가 창을 엽니다.

### 기능에 모델이 필요할 때

특정 종류의 모델 없이는 작동하지 않는 기능에는 **Needs an image model**(이미지 모델 필요) 라벨이 표시됩니다(동영상, 오디오, 판단, 채팅 모델도 마찬가지입니다). 이 라벨은 **Agents** 패널의 에이전트 카드, **Chat Settings**(채팅 설정), 에이전트 편집기, 이미지 창과 동영상 창에 나타납니다. 옆의 **Set up**(설정)을 클릭한 다음 모델을 고르거나 **Add account**를 클릭하세요. 작업에 모델이 정해지면 라벨이 사라집니다.

## 계정 테스트하기

**Connect**가 이미 키를 테스트합니다. 나중에 다시 테스트하려면 패널에서 계정의 **⋯** 메뉴를 열고 **Test**(테스트)를 클릭하세요. 계정 편집기(**Edit account**)에는 **Test account**(계정 테스트)가 있어서, 저장하기 전에 입력한 그대로의 키와 주소를 확인합니다.

<a id="choosing-a-model-for-one-chat"></a>

## 한 채팅에 쓸 모델 고르기

새 채팅은 **Main** 모델을 씁니다. 한 채팅에만 다른 모델을 쓰려면 채팅 입력란의 모델 버튼(현재 모델 이름이 붙은 링크 아이콘)을 클릭하거나, **Chat Settings → Connection**(채팅 설정 → 연결)의 **Model**(모델) 필드를 쓰세요. 둘 다 **Model for this chat**(이 채팅의 모델)을 엽니다.

- **Now**에는 채팅이 쓰는 모델이 표시됩니다. **This chat only**(이 채팅만)는 채팅에 따로 고른 모델이 있다는 뜻입니다. **follows Main**(메인 따름)은 Main을 쓴다는 뜻입니다.
- **Recent**(최근)와 **Starred**에는 내 모델이 계정별로 표시됩니다.
- **Search models or paste an ID…**(모델 검색 또는 ID 붙여넣기…)는 모든 계정을 검색합니다. **Browse**(찾아보기)는 한 계정의 전체 목록을 엽니다.
- **Follow Main**(메인 따르기)은 채팅에 따로 고른 모델을 지웁니다. **Shuffle**(셔플)은 매번 다른 모델을 고릅니다.

여기서 고른 모델은 그 채팅에만 적용됩니다. 고른 뒤에 나오는 메시지에는 **Make it my Main model**(내 메인 모델로 설정)과 **Undo**(되돌리기)가 있습니다. Game Mode(게임 모드)에서는 이 필드의 라벨이 **Game Master model**(GM / 파티 모델)입니다.

## 자주 나는 오류

테스트나 메시지 전송이 실패하면 다음부터 확인하세요.

- 키가 틀렸거나 만료된 경우. 계정의 **⋯**을 클릭하고 **Replace key**(키 교체)를 고른 다음 키를 다시 붙여넣으세요. 키가 없는 계정에는 **Needs key**(키 필요)가 표시됩니다.
- 계정이 꺼져 있는 경우. **Off**가 표시됩니다. 그 계정의 **⋯** 메뉴에서 **Turn on**(켜기)을 클릭하세요.
- 다른 서비스의 키를 넣은 경우. 서비스마다 자기 키가 따로 필요합니다.
- **Address**가 차단된 경우. 비워 두면 서비스 자체 주소를 씁니다.

더 많은 해결 방법은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 관련 가이드

- [연결 정리하기](organizing-connections.md)
- [지원하는 AI 제공자](providers-reference.md)
- [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)
- [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)
