# 다운로드 가능한 에이전트 레퍼런스

이 가이드에서는 **Agents → Agent Organizer**(에이전트 → Agent Organizer)에 있는 Marinara의 공식 자체 제작 에이전트를 그룹별로 소개합니다. 새로 설치한 상태에는 에이전트가 들어 있지 않습니다. 에이전트의 소스와 카탈로그는 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)에 공개되어 있습니다. 항목마다 에이전트가 하는 일, 실행 시점, 사용 가능한 곳, 주요 설정을 적어 두었습니다. 에이전트를 설치하고 켜는 방법은 [에이전트: 채팅을 도와주는 AI](agents-overview.md)를 먼저 읽어 보세요. **staging only**(staging 전용)로 표시된 항목은 Engine staging 사용자가 쓸 수 있으며, 안정 버전 사용자에게는 패키지가 안정 버전으로 올라간 뒤 표시됩니다.

## 이 문서를 읽는 법

**Agent Organizer**에서 에이전트를 설치한 다음, 원하는 채팅마다 추가하세요. 에이전트는 캐릭터 카드 단위가 아니라 채팅 단위로 설정합니다. 설치, 업데이트, 채팅별 설정, 비용은 [에이전트: 채팅을 도와주는 AI](agents-overview.md)에서 다룹니다.

항목마다 같은 요약 정보를 보여 줍니다.

- **단계** 또는 **연동 방식**: 파이프라인 에이전트가 언제 실행되는지입니다. **Pre-Generation**(생성 전)은 답변 전에 실행되며 프롬프트에 텍스트를 추가할 수 있습니다. **Parallel**(병렬)은 답변과 동시에 실행되므로 완성된 텍스트를 보지 못합니다. **Post-Processing**(후처리)은 답변 뒤에 실행되어 답변을 읽을 수 있습니다. 일부는 답변을 고쳐 쓰기도 합니다. World Maps, Calls, Conversation 게임 같은 기능 패키지는 실행 단계 대신 해당 채팅 화면에 바로 연결됩니다. Apps는 전용 **Home**(홈) 탭에서 열립니다.
- **사용 가능한 곳**: 그 에이전트를 추가할 수 있는 채팅 모드입니다. 대부분의 에이전트는 Roleplay에서 동작합니다.
- **주요 설정**: 가장 자주 바꾸게 되는 설정으로, **Chat Settings**(채팅 설정)의 에이전트 카드에 있습니다.

실행 간격을 두면 에이전트가 메시지마다 실행되지 않고 사용자와 어시스턴트 메시지 몇 개마다 한 번씩 실행됩니다. 최대 100까지 설정할 수 있습니다.

Roleplay에서는 Illustrator의 실행 간격을 채팅마다 **Chat Settings**의 Illustrator 카드에서 설정합니다. 에이전트 설정에 지정한 값은 자체 값이 없는 채팅에 적용되는 기본값입니다. Illustrator는 **0**도 허용합니다. 0이면 자동으로 실행되지 않으며, Gallery 작업에서는 계속 쓸 수 있습니다.

## Apps

Apps는 **Home**에 전용 탭이 있습니다. 채팅에 추가하지 않고 따로 열어서 사용합니다. 설치하고 나면 모두 다시 시작하라고 안내합니다.

### Noodle

선택 사항인 로컬 Noodle 공개 타임라인을 전용 **Home** 탭에 추가합니다. 채팅 에이전트 파이프라인에서는 실행되지 않습니다.

- **연동 방식**: 로컬 경로, 생성 및 미디어 흐름, 백그라운드 스케줄러를 갖춘 기능 패키지입니다.
- **사용 가능한 곳**: Home. 필요하면 Conversation, Roleplay, Game 채팅의 컨텍스트를 가져올 수 있습니다.
- **주요 설정**: **Agents → Agent Organizer**에서 설치하고 안내가 나오면 다시 시작하세요. Noodle 안에서 초대 계정, 텍스트와 이미지 연결, 타임라인 새로고침, 무작위 사용자, 채팅 내용 이어받기를 설정합니다.
- **데이터**: 제거하면 재시작 후 탭이 사라지고 스케줄러가 멈춥니다. Noodle 데이터는 나중에 다시 설치할 때를 위해 남아 있습니다.
- **전체 가이드**: [Noodle: 앱 안의 소셜 타임라인](noodle.md).

### Slurp

캐릭터를 위한 비공개 소셜 앱입니다. 캐릭터와 페르소나를 크리에이터로 만들어 공개 사진이나 잠긴 사진을 올리면, 가상의 관객이 팔로우하고, 구독하고, 구매하고, 댓글과 메시지를 보냅니다. 기본 설정은 성인 콘텐츠에 맞춰져 있습니다. 모두 가상의 놀이입니다. 가격은 허구이며 실제 결제는 일어나지 않습니다.

- **연동 방식**: **Home**의 전용 **Slurp** 탭에서 열리는 앱입니다.
- **사용 가능한 곳**: Home.
- **주요 설정**: 설치하고 안내가 나오면 다시 시작한 다음 **Home → Slurp**을 여세요. 채팅의 캐릭터가 최근 Slurp 게시물과 메시지를 기억하게 하려면 그 채팅의 **Chat Settings**에서 **Connected Chats**(연결된 채팅) 아래에 있는 **Include Slurp activity**(Slurp 활동 포함)를 켜세요. Slurp 설정에서도 해당 채팅 모드의 이어받기가 켜져 있어야 합니다. **Slurp Settings → Autopurge**는 공간을 아끼기 위해 오래된 Slurp 미디어를 지웁니다. 기본값은 꺼짐입니다.
- **이전 이름**: 이전 카탈로그에서는 **Slurp Remastered**라는 이름으로, 지원이 끝나 더 이상 업데이트되지 않는 **Slurp Legacy** 옆에 표시됩니다.
- **전체 가이드**: [Slurp 패키지 가이드](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/slurp2/README.md).

### Gacha Forge

내가 설명한 세계로 만들어지는 가챠 게임입니다. 뽑기를 돌릴 배너, 모델이 쓰고 그리는 등장인물, 비주얼 노벨 내레이터가 들려주는 스토리 챕터, 그리고 전투, 장비, 이벤트가 있습니다. 로어북으로 세계를 채울 수도 있지만 직접 쓴 시나리오만으로도 충분합니다.

- **연동 방식**: **Home**의 전용 **Gacha Forge** 탭에서 열리는 앱입니다.
- **사용 가능한 곳**: Home.
- **주요 설정**: 설치하고 안내가 나오면 다시 시작한 다음 **Home → Gacha Forge**를 여세요. 제거하면 재시작 후 탭이 사라집니다.
- **전체 가이드**: [Gacha Forge 패키지 가이드](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/gacha-forge/README.md).

### Modern Life Sim

인생 시뮬레이션입니다. 시간이 흐르는 작은 마을에서 살아가며 일자리를 지키고, 청구서를 내고, 기력과 허기를 챙겨야 합니다. 주변 사람들은 내 캐릭터 카드에서 나오며, 중요한 장면은 비주얼 노벨 내레이터가 들려줍니다.

- **연동 방식**: **Home**의 전용 **Life Sim** 탭에서 열리는 앱입니다.
- **사용 가능한 곳**: Home.
- **제공 범위**: **Staging only**(staging 전용). Engine **2.4.4+**(4.0.0 미만)가 필요합니다. 알파 버전입니다. 업데이트가 이전 저장 데이터에 필요한 부분을 바꾸면 그 저장 데이터를 열 때 Life Sim이 알려 줍니다. 새 인생을 시작하거나 위험을 감수하고 계속할 수 있습니다.
- **주요 설정**: 설치하고 안내가 나오면 다시 시작한 다음 **Home → Life Sim**을 여세요. 텍스트 연결이 필요합니다. 이미지 연결은 선택 사항이며, 없으면 장소에 일러스트 카드가 표시됩니다. 선택형 모듈은 인생마다 직접 켜기 전까지 꺼져 있습니다. **Adult** 모듈은 성인인지 확인해 달라고 요청합니다.
- **전체 가이드**: [Modern Life Sim 패키지 가이드](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/modern-life-sim/README.md).

### Story Writer

모델과 함께 쓰는 책입니다. 사이드바에서 이야기, 등장인물, 로어북을 설정하고 접착 메모에 작가 지침을 남기면, 요청할 때 모델이 다음 장을 씁니다. 텍스트의 어느 곳이든 클릭해 수정하거나 첫 장을 직접 쓸 수 있습니다.

- **연동 방식**: **Home**의 전용 **Story Writer** 탭에서 열리는 앱입니다.
- **사용 가능한 곳**: Home.
- **제공 범위**: **v2.5.1**보다 새로운 Marinara Engine(다음 릴리스 또는 현재 staging 빌드)이 필요합니다.
- **주요 설정**: 설치하고 안내가 나오면 다시 시작한 다음, **Home → Story Writer**를 열고 사이드바에서 텍스트 연결을 고르세요. 이야기는 Marinara 서버에 저장됩니다. 새 이야기를 시작하고, 이전 이야기로 돌아가고, Markdown이나 일반 텍스트로 다운로드할 수 있습니다.
- **전체 가이드**: [Story Writer 패키지 가이드](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/story-writer/README.md).

## Writer 에이전트

Writer 에이전트는 이야기나 문장을 다듬습니다. 답변 전에 방향을 잡아 주거나 답변 뒤에 답변을 손봅니다.

### Prose Guardian

의미는 그대로 두면서 금지어와 반복 표현을 없애도록 최신 답변을 고쳐 씁니다. 모델이 같은 표현을 되풀이하거나 특정 단어를 남발할 때 쓰면 좋습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Banned Words**(기본값 `ozone`), **Prefer In Writing**(작문 시 선호), **Remove From Writing**(작문에서 제외) 입력란. **Hold Message Until Rewrite**(리라이트까지 메시지 보류)는 기본으로 켜져 있으며, 정리가 끝날 때까지 답변을 숨깁니다. 끄면 다듬기 전 답변이 먼저 보였다가 나중에 교체됩니다.

### Continuity Checker

캐릭터가 동시에 두 곳에 있거나 시간 흐름이 어긋나는 것처럼 최신 답변의 구체적인 논리 오류를 바로잡습니다. 문제를 찾으면 체크리스트를 보여 주므로 어떤 수정을 적용할지 고를 수 있습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Hold Message Until Rewrite** 토글.

### Card Evolution Auditor

플레이 중에 캐릭터가 어떻게 변해 가는지 지켜보고 그 캐릭터 카드에 반영할 수정안을 제안합니다. 자동으로 고치는 일은 없습니다. 제안은 모두 **Review Character Card Updates**(캐릭터 카드 업데이트 검토) 창으로 열리며, 거기서 승인하거나 거절합니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: 기본적으로 사용자와 어시스턴트 메시지 8개마다 한 번 실행됩니다. [에이전트 승인과 Agent Suite](approvals-and-agent-suite.md)를 참고하세요.

### Narrative Director

요청하면 이야기에 한 번짜리 자극을 넣어 줍니다. 이 에이전트가 Roleplay 채팅에서 활성화되어 있으면 **Push Story**(스토리 전개) 버튼이 나타납니다. 버튼을 누르면 다음 답변이 준비되어, 줄거리를 진전시키거나 뜻밖의 사건을 더합니다.

- **단계**: Pre-Generation.
- **사용 가능한 곳**: Roleplay 전용.
- **주요 설정**: **Story Push Mode**(**Natural**은 진행 중인 이야기를 밀고 나가고, **Random Event**는 그럴듯한 돌발 사건을 더합니다). **Secret Plot**(비밀 플롯)이라는 숨은 장기 전개를 따로 둘 수도 있습니다. [Narrative Director와 Secret Plot](../roleplay/narrative-director.md)을 참고하세요.

### Knowledge Retrieval

답변 전에 지정한 로어북과 업로드한 파일을 훑습니다. 중요한 부분을 요약해 프롬프트에 덧붙입니다. 로어북은 세계의 배경 설정을 모아 둔 것입니다. 가벼운 검색이라 별도의 데이터베이스가 필요 없습니다.

- **단계**: Pre-Generation.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Use chat-active lorebooks**(채팅 활성 로어북 사용), **Fixed Source Lorebooks**(고정 소스 로어북) 선택기, 파일 업로드. 역할이 겹치므로 Knowledge Router와 함께 실행하지 마세요. [지식 소스](knowledge-sources.md)를 참고하세요.

### Knowledge Router

Knowledge Retrieval보다 비용이 적게 드는 대안입니다. 로어북 항목의 짧은 설명을 읽고 들어맞는 항목을 글자 그대로 덧붙입니다. 항목에 설명이 잘 적혀 있을 때 가장 잘 동작합니다.

- **단계**: Pre-Generation.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Use chat-active lorebooks**와 **Fixed Source Lorebooks** 선택기. 소스 항목 중 설명이 있는 비율은 커버리지 배지로 표시됩니다. [지식 소스](knowledge-sources.md)를 참고하세요.

## Tracker 에이전트

Tracker 에이전트는 장면, 캐릭터, 내 스탯을 계속 기록합니다. **Add as Prompt Section**(프롬프트 섹션으로 추가)은 에이전트의 최신 출력을 프롬프트에 넣어 모델이 앞뒤 내용을 일관되게 유지하게 합니다. Expression Engine과 Background를 제외한 모든 트래커에서 기본으로 켜져 있습니다.

### World State

날짜, 시간, 날씨, 장소, 그 자리에 있는 캐릭터를 기록합니다. 덕분에 장면이 흔들리지 않고, 모델이 이야기의 시간과 장소를 잊지 않습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐).

### Expression Engine

최신 답변에서 감정을 읽어 캐릭터에 어울리는 스프라이트나 표정을 고릅니다. 스프라이트는 장면에 표시되는 캐릭터 이미지입니다. 분위기에 따라 바뀌는 캐릭터 입상 일러스트를 쓰고 싶을 때 활용하세요.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Sprite Source**(**Expressions**, **Full-body**, 또는 둘 다), **Expression Avatars**(감정 아바타) 토글, **Sprite Owners**(스프라이트 소유자) 선택기, 크기와 불투명도 슬라이더. [캐릭터 스프라이트](../characters/sprites.md)를 참고하세요.

### Quest Tracker

퀘스트 목표, 달성 여부, 보상을 관리합니다. 해야 할 일 목록이 눈에 보이는 모험물 스타일 플레이에 어울립니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐).

### Background

업로드해 둔 배경 중에서 현재 장면에 가장 잘 맞는 배경을 고릅니다. 이미지를 생성하지는 않습니다. 장면 배경을 생성하려면 Illustrator를 쓰세요.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: 일반적인 에이전트 연결과 컨텍스트 설정. 배경 라이브러리에 이미 있는 이미지 중에서만 고릅니다.

### Character Tracker

그 자리에 있는 캐릭터와 함께 기분, 행동, 외모, 옷차림, 속마음, HP 같은 캐릭터별 스탯을 기록합니다. 초상화가 없는 새 캐릭터의 초상화를 만들 수도 있습니다.

등장인물이 여럿인 시나리오 카드처럼 여러 사람을 설명하는 카드는 인물별로 추적할 수 있습니다. 카드 본문에서 각 인물을 `[CHARACTER: Name]` 제목이나 `Name:` 필드로 표시하세요. 각 구성원은 자신의 이름, 기분, 옷차림, 속마음, 초상화를 따로 유지합니다. 카드의 초상화를 함께 쓰지 않습니다. 카드 이름으로 된 이전 항목은 트래커가 이를 대체할 개별 구성원을 보고할 때까지 남습니다. 수동으로 추가한 캐릭터는 수동으로 정한 식별 정보를 유지합니다.

장면을 떠났던 캐릭터가 다시 등장하면 트래커는 마지막으로 저장된 스탯과 사용자 지정 필드를 다시 씁니다. 카드에 연결된 캐릭터는 설정된 RPG 자원과 속성도 받습니다. Merged Roleplay 그룹에서는 현재 등장한 캐릭터를 바탕으로 다음 답변에서 어느 캐릭터 카드를 활성으로 둘지도 정할 수 있습니다. [활성 캐릭터 자동화](../chats/group-chats.md#automate-active-characters-merged-only)를 참고하세요.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐), 그리고 전용 이미지 연결 선택기가 있는 선택 사항인 **Auto-Generate NPC Avatars**(NPC 아바타 자동 생성) 설정. **Include the outfit in portraits**(초상화에 복장 포함)는 기본으로 켜져 있습니다. 외형만으로 초상화를 그리려면 끄세요.

### Beholder

각 캐릭터의 옷을 신체 부위별로 추적하고, 들고 있는 물건, 상처, 없어진 신체 부위, 명시적으로 드러난 부위, 인간이 아닌 종족도 기록합니다. 최근 검증된 스냅샷은 Roleplay **Chat Settings**의 Beholder 서랍에 표시됩니다. 이 스냅샷은 Beholder의 다음 추적 호출과 다음 메인 답변에 전달됩니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay 전용.
- **주요 설정**: **Chat Settings → Agents → Tracker Agents**(채팅 설정 → 에이전트 → 추적 에이전트)에서 추가한 다음, **Configure Beholder**(Beholder 설정)를 열어 연결, 모델, 프롬프트, 컨텍스트, 출력 제한을 고르세요. **Add as Prompt Section**은 기본으로 켜져 있습니다.
- **프롬프트 템플릿**: Beholder 연결 뒤에 있는 모델에 맞는 템플릿을 고르세요. Marinara는 모델을 감지할 수 없으므로 직접 골라야 합니다. 잘못 골라도 치명적이지는 않지만 결과가 나빠집니다.
  - **SOTA model — one prompt**(고성능 모델용 단일 프롬프트, 기본값): 추적하는 모든 필드를 한 번의 호출로 처리합니다. 강력한 범용 모델을 쓰세요.
  - **Beholder local model — five passes**(Beholder 로컬 모델용 5회 처리): 내 컴퓨터에서 실행하는, 목적에 맞게 훈련된 [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF) 추출기(예: koboldcpp나 llama.cpp 뒤의 `Beholder-Q8_0.gguf`)용으로, 추적 영역마다 하나씩 좁은 호출 5개를 사용합니다. 이 모델은 한 번에 한 영역씩 답하므로 단일 프롬프트 템플릿으로는 일부 상태만 반환합니다. 오프라인에서 무료로 실행됩니다.
- **출처**: AGPL-3.0-only 라이선스의 [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME)를 바탕으로 만들었습니다. 공식 패키지는 이전 확장 기능의 DOM, 폴링, 로컬 저장소 런타임을 불러오지 않습니다.

### Persona Stats

포만도, 기력, 청결도처럼 내 캐릭터의 상태 바를 기록하며, 직접 추가한 상태 바도 함께 관리합니다. 생존물이나 생활 시뮬레이션 스타일 플레이에 어울립니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐). [캐릭터 색상과 스탯](../characters/colors-and-stats.md)을 참고하세요.

### Custom Tracker

화폐, 카운터, 플래그처럼 직접 정의한 필드를 기록합니다. 기본 제공 트래커로는 이야기에 필요한 것을 담아내지 못할 때 쓰세요.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐).

### Inventory Tracker

돈, 장착 장비, 소지품을 세 가지 구조화된 목록으로 추적합니다. 같은 이름은 합치고, 잠근 행은 이후 트래커 실행에서도 바뀌지 않습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐). HUD와 Tracker Panel에서 모든 이름과 수량을 편집하고 잠글 수 있습니다.

### Quartermaster

활성 페르소나의 인벤토리, 장비 슬롯, 아이템 수량, 보관 위치, 저장한 의상을 관리합니다. 답변 뒤에 이야기를 읽고 아이템 변경 사항을 적용합니다. 플로팅 패널과 Tracker Panel에서 같은 인벤토리를 직접 편집할 수 있습니다. 아이템과 의상 이미지는 선택 사항입니다.

- **단계**: Post-Processing이며, 이후 답변에 인벤토리 컨텍스트를 제공합니다.
- **사용 가능한 곳**: Roleplay. 파티원이나 NPC가 아닌 활성 페르소나를 추적합니다.
- **제공 범위**: Engine **2.4.6+**가 필요합니다.
- **설정 방법**: 설치하고 안내가 나오면 다시 시작하세요. 각 Roleplay 채팅의 **Chat Settings → Agents**에서 에이전트를 켜고, **Tracker Agents**에 Quartermaster를 추가한 다음 모델 연결을 고르세요. Tracker Panel 위의 실행 버튼으로 플로팅 패널을 여세요.
- **주요 기능**: 아이템 장착과 보관, 의상 저장, 인벤토리 복원이나 최근 트래커 변경 되돌리기, 채팅 설정 내보내기와 가져오기. 이미지 생성은 전용 이미지 연결을 사용합니다. 외모 매크로나 아바타 교체를 켜기 전에 [Quartermaster 패키지 가이드](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md)를 확인하세요.

### Relationship Tracker

Roleplay 그룹 채팅에 있는 캐릭터 카드 사이의 관계와, 각 캐릭터가 활성 페르소나를 어떻게 보는지를 편집 가능한 관계망으로 관리합니다. 관계는 긍정적, 중립적, 부정적, 복잡한 관계 중 하나입니다. 수동 잠금은 내가 편집한 내용을 자동 변경으로부터 보호합니다.

- **단계**: Post-Processing이며, 이후 답변에 관계 컨텍스트를 제공합니다.
- **사용 가능한 곳**: Roleplay 그룹 채팅.
- **제공 범위**: Engine **2.4.4+**(4.0.0 미만)가 필요합니다.
- **설정 방법**: 설치하고 안내가 나오면 다시 시작하세요. 각 Roleplay 채팅의 **Chat Settings → Agents**에서 에이전트를 켜고, **Tracker Agents**에 추가한 다음 모델 연결을 고르세요. 관계망은 Tracker Panel에 표시됩니다. 그곳에서 **All relationships**(모든 관계) 또는 **Scene-only relationships**(현재 장면의 관계만)를 한 번 선택해 채팅을 시작하세요.
- **주요 기능**: 프롬프트 컨텍스트용 **All relationships** 또는 **Scene-only relationships**, 최근 메시지를 분석하는 **Update from History**(기록에서 업데이트), 수동 편집과 잠금, **Resume automatic updates**(자동 업데이트 재개). **Context Size**(컨텍스트 크기, 기본 5개 메시지), **Presence lookback**(등장 여부 확인 범위, 기본 15), 기록 분석의 메시지 수는 각각 별도 설정입니다. [Relationship Tracker 패키지 가이드](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/relationship-tracker/README.md)를 참고하세요.

### Memory Nag

Roleplay 채팅마다 짧고 편집 가능한 기억 보관함을 유지합니다. 채팅을 묶음 단위로 읽고, 현재와 과거 참여자별로 기억을 정리하며, 해결된 기억은 복원할 수 있는 Resolved 목록으로 옮깁니다. 정확한 표현이 중요할 때는 짧은 대사 한 줄을 기억에 그대로 담을 수 있습니다.

답변이 끝날 때마다 단어 일치 방식으로 가장 관련 있는 활성 기억만 트래커에 넘깁니다. 트래커는 장면에 상기가 필요한지 판단하고, 넘겨받은 기억 중에서만 고를 수 있습니다. 회상 중에는 새 기억을 만들 수 없습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay 전용.
- **주요 설정**: **Vault scan connection**(기본값: Agent 연결), **Messages per batch**(20), **Maximum memories created per character**(10), **Maximum memories considered per character**(5), **Maximum memories injected**(3). 첫 백필에는 **Scan chat**을 쓰고, 기억을 검색, 추가, 편집, 해결, 복원, 삭제하려면 **Open vault**를 쓰세요.
- **프롬프트 배치**: 프리셋 마커가 없으면 선택된 상기 내용은 다음 답변의 `<context><memory_nags>…</memory_nags></context>` 안에 들어갑니다. 직접 배치하려면 Memory Nag Agent 섹션을 추가하세요.
- **데이터**: 보관함은 채팅 하나에 속하며, 패키지를 끄거나 제거해도 남아 있습니다. 기억 삭제는 영구적이며 항상 먼저 확인을 요청합니다.

### World Maps

중첩된 장소와 공간 연결을 이야기에 더합니다. 지역, 구역, 방, 연결 통로를 직접 만들고 장소 사이를 이동하며, 현재 위치가 생성에 공간 컨텍스트를 더합니다. Game Mode에서는 세계 지도 화면도 쓸 수 있습니다.

- **연동 방식**: 생성 단계 에이전트 대신 지도 UI와 채팅 컨텍스트를 제공하는 기능 패키지입니다.
- **사용 가능한 곳**: Roleplay, Game.
- **주요 설정**: Roleplay 채팅에서는 **Chat Settings → Agents**에서 켜고, 게임에서는 만들 때 고른 뒤 그 게임의 설정에서 관리하세요. 설치하거나 제거하면 재시작해야 합니다.
- **전체 가이드**: [World Maps: 설정, 제작, 이동](hierarchical-maps.md).

## Misc 에이전트

Misc 에이전트는 이미지, 음악, 관객 반응, 카드 업데이트 같은 부가 요소를 더합니다.

### Echo Chamber

장면에 반응하는 실시간 관객을 흉내 내어 채팅 영역에 떠 있는 **Echo**(에코) 위젯에 보여 줍니다. 30초마다 새 반응이 하나씩 공개됩니다.

- **단계**: Parallel.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad**, **Harbingers** 같은 스타일을 고르세요. 위젯에는 **Re-run Echo Chamber**(에코 챔버 다시 실행)와 **Clear messages**(메시지 지우기)가 있습니다.

### Long-Term Memory

채팅 요약, 캐릭터 기록, 로어북에서 오래 남길 기억을 뽑아 패키지 전용 보관함에 넣어 두고, 메인 답변 전에 관련 컨텍스트를 불러옵니다. 보관함 열람, 소스 가져오기, 대기 중인 초안 검토, 프리셋 마커 배치를 지원합니다.

- **연동 방식**: 생성 전 컨텍스트와 기억 관리 UI를 갖춘 기능 패키지입니다.
- **사용 가능한 곳**: Conversation, Roleplay, Game.
- **주요 설정**: 회상 토큰 예산(128-16,384), 최대 회상 청크 수(1-100), 점수 임계값, 최근 메시지 컨텍스트(1-20), 회상 방식, 검색 가중치, 해결된 기억 포함 여부, 회상 서문, 추출 설정, 소스 한도, 프롬프트 템플릿, AI 키워드 추출, Game 모드 추출.
- **데이터**: 보관함, 초안, 설정을 내보내거나 교체하려면 Memory Settings의 백업 기능을 쓰세요. **Delete all data**는 기억, 초안, 활동 기록, 색인을 영구히 지우지만 설정은 남깁니다. 제거해도 보관함은 남아 있어 나중에 다시 설치할 때 쓸 수 있습니다. 설치, 업데이트, 제거 후에는 재시작해야 합니다.
- **호환성**: Engine `2.3.5` 이상 `4.0.0` 미만. 권한: `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, `ui`.

### Illustrator

이미지와 동영상을 만듭니다. 중요한 장면의 시각 프롬프트를 써서 내 이미지 또는 동영상 서비스로 보냅니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: Illustrator는 기본적으로 사용자와 어시스턴트 메시지 5개마다 한 번 실행됩니다. Roleplay 채팅마다 카드의 **Image Run Interval**(이미지 실행 간격)로 이 값을 바꿀 수 있습니다. **Illustrator makes**가 **Pictures and clips** 또는 **Clips only**이면 자동 클립은 **Video Run Interval**(동영상 실행 간격)을 사용합니다. 자동 클립을 끄려면 **Video Run Interval**을 **0**으로 설정하세요. 설정에는 **Prompt Model**, **Image Style**, **Attach Card Appearance**, **Send Avatar References**가 있습니다. 전체 설정 방법은 [Illustrator 에이전트](../media/illustrator-agent.md)에서 설명합니다.

### Lorebook Keeper

채팅에서 중요한 사실을 골라 로어북 항목을 만들고 갱신합니다. 플레이를 이어 갈수록 세계 설정 메모가 함께 불어납니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay. Game Mode에서는 세션 종료 시점에 실행되는 변형인 **Game Session Keeper**가 같은 일을 합니다.
- **주요 설정**: 기본적으로 사용자와 어시스턴트 메시지 8개마다 한 번 실행됩니다. 항목을 넣을 곳은 **Target Lorebook**(적용할 로어북)으로 정하며, 자동 선택 옵션도 있습니다. 고급 프롬프트는 쓰기 가능한 로어북 이름이나 `world`, `npc`, `scene`, `player` 같은 별칭을 반환할 수 있습니다. 별칭 대상이 없으면 새로 만들어 채팅에 연결합니다. 대상을 정하지 않으면 단일 로어북 동작이 그대로 유지됩니다.

### Combat

전투를 관리합니다. 선공 순서, HP, 턴 순서를 다룹니다. 활성화하면 메시지 입력란 위에 **Encounter**(전투) 버튼이 나타납니다.

- **단계**: Parallel.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: 턴 판정을 위한 주사위 굴림 도구가 들어 있습니다.

### Immersive HTML

이야기를 건드리지 않으면서 꾸며진 쪽지나 화면 같은 세계관 속 시각 요소를 최신 답변에 더합니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay 전용.
- **주요 설정**: **Hold Message Until Rewrite** 토글.

### Music DJ

장면의 분위기를 읽고 어울리는 음악을 재생합니다. Spotify, YouTube, 로컬 오디오 파일을 쓸 수 있습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay, Game.
- **주요 설정**: 제공자는 **Music Player**(음악 플레이어) 설정에서 고르며, 제공자마다 설정이 따로 필요합니다. Spotify, YouTube, 로컬 음악의 전체 절차는 [Music DJ](../media/music.md)에서 설명합니다.

### Haptic Feedback

이야기를 읽고 Intiface Central을 통해 연결된 성인용 토이를 실시간으로 제어합니다. 이 에이전트를 켜기 전에 Intiface Central이 실행 중이고 토이가 연결되어 있어야 합니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Conversation, Roleplay, Game.
- **주요 설정**: **Touch Sensitivity**(터치 감도) 선택(**Subtle**, **Standard**, **Intense**)과 **Intiface URL** 입력란. 감도는 사용할 수 있는 `0.0-1.0` 강도 범위를 제한하지 않으면서 에이전트의 선택을 안내합니다. 전체 설정 방법은 [Haptic Feedback 설정](../integrations/haptic-feedback.md)에서 설명합니다.

### CYOA Choices

답변마다 클릭할 수 있는 "What will you do?" 선택 버튼을 붙여 CYOA 같은 느낌을 냅니다. 버튼 하나하나에 한 번의 클릭으로 보낼 수 있는 행동이 통째로 담겨 있습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: 선택지를 고쳐 쓰는 **Edit**(편집)와 새로 만드는 **Re-roll**(리롤). 클릭한 선택지를 메시지 입력란에 넣으려면 **Settings → General → Input & Editing**(설정 → 일반 → 입력 및 편집)에서 **Add CYOA choices to the message box instead of sending them**(CYOA 선택지를 전송하지 않고 메시지 입력란에 추가)을 켜세요.

### Storyboard

완료된 Roleplay 대화와 Game 서술을 바탕으로 정지 이미지 또는 애니메이션 스토리보드를 계획합니다. 계획과 제공자별 형식 변환을 따로 처리하므로 키프레임과 동영상 전반에서 이야기 순서, 캐릭터 정체성, 선택한 스타일이 유지됩니다.

- **연동 방식**: 에이전트 패키지입니다. Game과 Roleplay는 Engine의 Storyboard 연동을 통해 이 패키지의 프롬프트 템플릿과 설정을 씁니다.
- **사용 가능한 곳**: Roleplay, Game.
- **주요 설정**: 정지 이미지 플래너 또는 애니메이션 플래너, 이미지 연결과 동영상 연결, 키프레임 수, 길이, 표시 방식, 캐릭터 참조 처리 방식, Roleplay 에피소드 템플릿과 스타일 템플릿, Game 삽화 템플릿과 동영상 템플릿.
- **호환성**: Engine `2.3.5` 이상 `3.0.0` 미만. 권한: `agent-runtime`, `chat-read`, `prompt-context`, `storage`, `ui`. 재시작은 필요하지 않습니다.
- **전체 가이드**: [스토리보드 에이전트 가이드](../game/storyboard.md).

### 2D Avatars

캐릭터와 페르소나를 눈을 깜박이고 말하며 답변마다 표정이 바뀌는 움직이는 2D 아바타로 보여 줍니다. 아바타는 PNGTuber 스타일 스프라이트(눈 깜박임 그림과 말하는 그림이 딸린 표정 스프라이트)이거나 메시 아바타 파일(`.mavatar`)입니다.

- **연동 방식**: 에이전트 패키지입니다. Engine이 아바타를 그립니다. 채팅하는 동안 AI 연결에 추가 요청을 보내지 않습니다.
- **사용 가능한 곳**: Roleplay, Game. 캐릭터와 페르소나에 쓸 수 있습니다.
- **제공 범위**: 모든 설치에서 **Agent Organizer**에 있습니다. Marinara Engine 2.5.1 이상이 필요합니다.
- **주요 설정**: **Agents**의 에이전트 페이지에서 아바타를 하나씩 설정합니다. 이 에이전트에는 스프라이트로 눈 깜박임 그림과 말하는 그림, 메시 아바타를 만드는 프롬프트도 들어 있습니다.
- **호환성**: Engine `2.5.0` 이상 `4.0.0` 미만, Capability API 1.73. 권한: `agent-runtime`, `chat-read`, `storage`, `ui`. 재시작은 필요하지 않습니다.
- **전체 가이드**: [2D와 3D 아바타](avatars.md).

### 3D Avatars

캐릭터와 페르소나를 눈을 깜박이고 말하며 답변마다 표정이 바뀌는 움직이는 3D 모델로 보여 줍니다. VRM 모델(`.vrm`, 0.x와 1.0 버전), MMD PMX 모델, 본이 이름으로 연결되는 리깅된 GLB와 FBX 모델을 지원합니다. VRM 모델에는 선택 사항으로 대기 애니메이션(`.vrma`)을 더할 수 있습니다.

- **연동 방식**: 에이전트 패키지입니다. Engine이 아바타를 그립니다. 채팅하는 동안 AI 연결에 추가 요청을 보내지 않습니다.
- **사용 가능한 곳**: Roleplay, Game. 캐릭터와 페르소나에 쓸 수 있습니다.
- **제공 범위**: 모든 설치에서 **Agent Organizer**에 있습니다. Marinara Engine 2.5.1 이상이 필요합니다.
- **주요 설정**: **Agents**의 에이전트 페이지에서 아바타를 하나씩 설정합니다.
- **호환성**: 2D Avatars와 같습니다.
- **전체 가이드**: [2D와 3D 아바타](avatars.md).

### Calls

Conversation 캐릭터와 실시간 음성 통화와 영상 통화를 할 수 있게 합니다. 직접 거는 통화, 걸려 오는 통화, 통화 전용 기록, 음성 합성, 마이크 입력, 캐릭터 동영상 클립을 지원합니다.

- **연동 방식**: 툴바, 채팅, Chat Settings 조작 요소를 갖춘 Conversation 기능 패키지입니다.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: **Chat Settings → Agents → Calls**를 열어 통화를 켜고 음성, 마이크, 벨소리, 영상 동작을 정하세요. [Conversation 음성 통화와 영상 통화](../conversation/calls.md)를 참고하세요. 설치하거나 제거하면 재시작해야 합니다.

### UNO

규칙이 강제되는 UNO 테이블을 열어 Conversation 캐릭터들과 함께 즐길 수 있게 합니다. 하우스 룰이 있으며 2명에서 10명까지 참여할 수 있습니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/uno`로 시작한 뒤 참가자와 하우스 룰을 고르세요. 설치하거나 제거하면 재시작해야 합니다.

### Chess

1대1 Chess 판을 더합니다. 합법 수 검사, 체크와 체크메이트 판정, 잡은 말 표시, 캐릭터를 유지한 상대 턴을 지원합니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/chess`로 시작한 뒤 상대와 내 진영을 고르세요. 설치하거나 제거하면 재시작해야 합니다.

### Poker

2명에서 8명까지 앉는 Texas Hold'em 테이블을 더합니다. 블라인드, 베팅 라운드, 사이드 팟, 쇼다운, 캐릭터를 유지한 상대를 지원합니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/poker`로 시작한 뒤 참가자, 시작 칩, 블라인드를 정하세요. 설치하거나 제거하면 재시작해야 합니다.

### 8-Ball Pool

솔리드와 스트라이프로 나뉜 1대1 당구대를 더합니다. 조준과 샷 세기, 파울, 볼 인 핸드, 캐릭터를 유지한 상대의 샷을 지원합니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/8ball`로 시작한 뒤 상대를 고르세요. 설치하거나 제거하면 재시작해야 합니다.

### Tic-Tac-Toe

1대1 Tic-Tac-Toe 판을 더합니다. 기호를 직접 고르거나 무작위로 정할 수 있고, 턴 처리와 승부와 무승부 판정을 지원합니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/tictactoe`(별칭 `/ttt`)로 시작한 뒤 상대와 기호를 고르세요. 설치하거나 제거하면 재시작해야 합니다.

### Rock-Paper-Scissors

1대1 승부를 더합니다. 공개하기 전까지 양쪽의 선택은 서로 보이지 않습니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/rps`로 시작한 뒤 상대와 3판 2선승, 5판 3선승, 7판 4선승 중 하나를 고르세요. 설치하거나 제거하면 재시작해야 합니다.

## 관련 가이드

- [에이전트: 채팅을 도와주는 AI](agents-overview.md)
- [Illustrator 에이전트](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Haptic Feedback 설정](../integrations/haptic-feedback.md)
- [지식 소스](knowledge-sources.md)
- [Narrative Director와 Secret Plot](../roleplay/narrative-director.md)
- [Conversation 음성 통화와 영상 통화](../conversation/calls.md)
- [Conversation 테이블 게임](../conversation/table-games.md)
