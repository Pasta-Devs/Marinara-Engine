# AI 제공자에 연결하기

이 가이드에서는 캐릭터가 답변할 수 있도록 Marinara Engine을 AI 제공자에 연결하는 방법을 설명합니다. 계정을 추가하고, 그 키를 붙여넣고, 채팅에 답할 모델을 고르는 순서입니다.

## 계정과 모델

**계정**은 AI 제공자 하나에 쓰는 키, 로그인 또는 주소 하나입니다. 계정에는 제공자, 키, 주소, 그리고 그 계정의 한도가 저장됩니다. 같은 제공자의 키를 2개 쓴다면 계정도 2개입니다.

**모델**은 계정에서 저장해 둔 AI 모델 하나입니다. 예를 들면 GPT나 Claude입니다. 저장한 모델마다 자기 설정이 따로 있습니다. 모델은 **Connections**(연결) 패널에서 자기 계정 아래에 놓입니다.

API 키는 AI 제공자가 발급하는 비밀 문자열입니다. 비밀번호와 같은 역할을 합니다. Marinara는 키를 Marinara가 실행되는 컴퓨터에 저장하며, 내보낼 때 키는 절대 함께 나가지 않습니다.

Marinara Engine은 미리 만들어 둔 계정이나 무료 체험용 키를 제공하지 않습니다. 채팅을 시작하려면 먼저 계정을 하나 이상 추가해야 합니다. 유일한 예외는 **On your computer**(내 컴퓨터) 아래의 **Built-in model**(내장 모델)입니다. 이 모델은 계정 없이 내 컴퓨터에서 실행됩니다([Local Model 설정](local-model.md) 참고).

## Connections 패널

계정은 앱 오른쪽의 **Connections** 패널에서 관리합니다. 위에서 아래로 다음 항목이 표시됩니다.

- **Search models and accounts**(모델 및 계정 검색). 입력하는 대로 목록을 걸러 줍니다.
- **Add**(추가)는 **Add account**(계정 추가) 창을 엽니다. **More actions**(추가 작업, 점 3개)에는 **Import account**(연결 가져오기), **Export all accounts**(모든 계정 내보내기), 접기, 묶기가 있습니다. 패널이 넓으면 정렬 드롭다운이 **Search models and accounts** 옆에 있습니다. 패널이 좁으면 정렬은 **More actions** 안에 있습니다.
- **Jobs**(작업) 상자. 어떤 모델이 어떤 작업을 맡는지 보여 줍니다. 예를 들어 채팅 답변은 **Main**(메인), 그림은 **Images**(이미지)입니다. [작업별 모델 고르기](#choosing-the-model-for-each-job)를 참고하세요.
- 내 계정 목록. 계정마다 저장한 모델이 그 아래에 있습니다. [연결 정리하기](organizing-connections.md)를 참고하세요.

## 계정 추가하기

1. **Connections** 패널에서 **Add**를 클릭하세요. **Add account** 창에는 제공자가 **Popular**(인기), **Subscriptions**(구독), **On your computer**, **All providers**(모든 제공자) 아래에 나뉘어 표시됩니다. **Search providers**(제공자 검색)에 입력해 찾을 수도 있습니다.
2. **OpenAI**, **Anthropic**, **OpenRouter** 같은 제공자를 클릭하세요.
3. 키를 **API key**(API 키)에 붙여넣으세요. **Where do I find my key?**(키는 어디서 찾나요?)를 누르면 제공자의 키 발급 페이지가 열립니다. 눈 모양 버튼으로 키를 보이거나 숨길 수 있습니다. **More options**(추가 옵션)에는 선택 항목인 **Name**(이름), **Address**(주소), **Requests per minute**(분당 요청 수), **Parallel jobs**(병렬 작업 수)가 있습니다.
4. **Connect**(연결)를 클릭하세요. Marinara가 키를 테스트합니다. 실패하면 창에 이유와 **Try again**(다시 시도)이 표시됩니다. 내 컴퓨터의 서버라면 **Continue anyway**(그래도 계속)도 나타납니다.
5. Main 모델이 없는 상태에서 첫 계정을 추가하거나, 채팅을 시작하는 도중에 계정을 추가하면 창이 모델 선택으로 넘어갑니다. 모델을 고르세요. **Make … my Main**(내 메인으로 설정)이 표시되면, 이것으로 그 모델을 Main으로 설정할 수 있습니다. 마치려면 **Done**(완료)을 클릭하고, 새 채팅에서 시작했다면 **Start chatting**(채팅 시작)을 클릭하세요. 이미 Main이 있고 패널에서 계정을 추가했다면, Connect 후 창이 닫히고 패널에 새 계정이 표시됩니다. 이미지, 동영상, 음성 서비스는 각자의 설정 컨트롤을 쓰고, 내장 모델은 로컬 설정 화면을 씁니다.

작업별 모델은 나중에 **Jobs** 상자에서 바꿀 수 있습니다.

**Name**을 비워 두면 Marinara가 제공자 이름을 따서 계정 이름을 붙입니다. 같은 제공자의 두 번째 계정에 이름을 입력하지 않으면 키의 마지막 4자가 붙습니다. 예를 들면 `OpenAI · …a1b2`입니다. 직접 입력한 이름은 바뀌지 않습니다.

**Address**는 대개 건드릴 필요가 없습니다. 알려진 제공자라면 Marinara가 알아서 채웁니다. 프록시나 내 컴퓨터의 서버를 쓸 때만 바꾸세요.

키 대신 내 컴퓨터의 로그인을 쓰는 제공자도 있습니다. 이런 제공자는 **Subscriptions** 아래에 있고 키 입력란이 없습니다. [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)을 참고하세요. 내 컴퓨터에서 돌아가는 모델에 연결하려면 [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)를 참고하세요. 지원하는 제공자 전체와 각 키를 받는 곳은 [지원하는 AI 제공자](providers-reference.md)에서 확인하세요.

### 계정 없이 채팅 시작하기

모델이 하나도 없는 상태에서 채팅을 시작하면 Marinara가 먼저 **Add account** 창을 엽니다. **Connect** 후에는 그 제공자의 모델이 표시됩니다. 하나를 클릭한 다음 **Start chatting**을 클릭하세요. 창 아래쪽에서 그 모델을 **Main** 모델로 설정할 수도 있습니다.

<a id="choosing-the-model-for-each-job"></a>

## 작업별 모델 고르기

**Jobs** 상자에는 모델이 맡을 수 있는 모든 작업이 4개 그룹으로 나뉘어 표시됩니다.

- **Chat**(채팅): **Main**은 채팅의 답변을 씁니다. **Agents**(에이전트)는 보조 에이전트를 실행합니다. **Impersonate**(유저 사칭)는 나 대신 글을 씁니다.
- **Omnibar**: **Professor Mari**와 **Quick answers**(빠른 답변).
- **Pictures & sound**(그림 및 사운드): **Images**, **Video**(비디오), **Voice (Text to Speech)**(음성, TTS).
- **Behind the scenes**(무대 뒤): **Decision**(판단), **Embeddings**(임베딩), **Image reading**(이미지 읽기).

각 행에는 그 작업을 맡은 모델과 제공자가 표시됩니다. 모델이 없으면 **Follows Main**(메인 따름)이나 **Off**(꺼짐)처럼 그 작업이 대신 어떻게 동작하는지 표시됩니다. 모델이 꼭 필요한 작업에는 **Choose a model**(모델 선택)이 표시됩니다.

행을 클릭하면 그 작업의 **Model for**(용도별 모델) 창이 열립니다. **Now**(현재) 아래에 그 작업을 맡은 모델이, 이어서 **Starred**(별표) 모델이, 그다음에 저장한 모델이 계정별로 표시됩니다. 계정 아래의 **All models**(모든 모델)는 그 계정의 전체 카탈로그를 엽니다. **Search all models or paste a model ID**(모든 모델 검색 또는 모델 ID 붙여넣기)에 입력하면 모든 카탈로그를 한 번에 검색합니다. 아무 모델이나 클릭하면 그 모델이 작업을 맡습니다. 먼저 저장할 필요는 없습니다. 창 위쪽의 **If it fails**(실패하면)는 첫 번째 모델이 실패했을 때 대신 답할 두 번째 모델을 고릅니다. 아래쪽의 **Add account**는 계정 추가 창을 엽니다.

**Jobs**를 클릭하면 상자가 머리글만 남기고 접힙니다.

### 기능에 모델이 필요할 때

특정 종류의 모델 없이는 작동하지 않는 에이전트나 기능에는 **Needs an image model**(이미지 모델 필요) 라벨이 붙습니다(동영상, 오디오, 판단, 채팅 모델도 마찬가지입니다). 이 라벨은 **Agents** 패널의 에이전트 카드, **Chat Settings**(채팅 설정), 에이전트 편집기, 이미지 창과 동영상 창에 표시됩니다. 옆의 **Set up**(설정)을 클릭하면 그 작업의 **Model for** 창이 열리고, 여기서 모델을 고르거나 **Add account**를 클릭할 수 있습니다. 작업에 모델이 정해지면 라벨이 사라집니다. 이미지 모델이 설정되지 않아 답변이 실패하면, 메시지의 **Set up**이 **Connections** 패널을 엽니다.

## 계정 테스트하기

**Connect**가 이미 키를 테스트합니다. 나중에 다시 테스트하려면 패널에서 계정의 **⋯** 메뉴를 열고 **Test**(테스트)를 클릭하세요. 계정 편집기(**Edit account**(계정 편집))에는 **Test account**(계정 테스트)가 있어서, 저장하기 전에 입력한 그대로의 키와 주소를 확인합니다.

<a id="choosing-a-model-for-one-chat"></a>

## 한 채팅에 쓸 모델 고르기

새 채팅은 **Main** 모델을 씁니다. 한 채팅에만 다른 모델을 쓰려면 채팅 입력란의 **Connections** 메뉴나 **Chat Settings → Connection**(채팅 설정 → 연결)의 **Model**(모델) 필드를 여세요. 둘 다 **Model for this chat**(이 채팅의 모델)을 엽니다.

- **Now**에는 채팅이 쓰는 모델이 표시됩니다. **This chat only**(이 채팅만)는 채팅에 따로 고른 모델이 있다는 뜻이고, **follows Main**(메인 따름)은 Main을 쓴다는 뜻입니다.
- **Recent**(최근)와 **Starred**에는 내 모델이 계정별로 표시됩니다.
- **Search models or paste an ID…**(모델 검색 또는 ID 붙여넣기…)는 모든 카탈로그를 검색합니다. **Browse**(찾아보기)는 한 계정의 전체 목록을 엽니다.
- **Follow Main**(메인 따르기)은 채팅에 따로 고른 모델을 지웁니다. **Shuffle**(셔플)은 매번 다른 모델을 고릅니다.

여기서 고른 모델은 그 채팅에만 적용됩니다. 고른 뒤에 나오는 메시지에는 **Make it my Main model**(내 메인 모델로 설정)과 **Undo**(되돌리기)가 있습니다. Game Mode(게임 모드)에서는 이 필드의 라벨이 **GM / Party Model**입니다.

## 자주 나는 오류

테스트나 메시지 전송이 실패하면 다음부터 확인하세요.

- 키가 틀렸거나 만료된 경우. 계정의 **⋯** 메뉴를 열고 **Replace key**(키 교체)를 클릭한 다음 키를 다시 붙여넣으세요. 키가 없는 계정에는 **Needs key**(키 필요)가 표시됩니다.
- 계정이 꺼져 있는 경우. **Off**가 표시됩니다. 그 계정의 **⋯** 메뉴에서 **Turn on**(켜기)을 클릭하세요.
- 다른 제공자의 키를 넣은 경우. 제공자마다 자기 키가 따로 필요합니다.
- **Address**가 차단되었거나 접속되지 않는 경우. 프록시나 내 컴퓨터의 서버를 쓰는 것이 아니라면 비워 두고 제공자 자체 주소를 쓰세요.

더 많은 해결 방법은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 관련 가이드

- [연결 정리하기](organizing-connections.md)
- [지원하는 AI 제공자](providers-reference.md)
- [Claude, ChatGPT, Grok 구독 연결](subscription-clis.md)
- [로컬 모델 또는 자체 호스팅 모델 연결하기](local-self-hosted.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
