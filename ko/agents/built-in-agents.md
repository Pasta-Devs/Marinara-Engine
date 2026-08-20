# 다운로드 가능한 에이전트 레퍼런스

이 가이드에서는 **Agents → Download Agents**(에이전트 → 에이전트 다운로드)에서 받을 수 있는 공식 패키지 36개를 카테고리별로 소개합니다. 에이전트는 갓 설치한 Marinara Engine에 들어 있지 않습니다. 패키지 소스, 매니페스트, 아티팩트, 기계가 읽을 수 있는 카탈로그는 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)에 공개되어 있습니다. 각 에이전트가 무슨 일을 하고, 언제 실행되거나 어디에 연동되며, 어떤 채팅 모드에서 쓸 수 있고, 주요 설정이 무엇인지 정리했습니다. 설치와 활성화 방법은 [에이전트: 채팅을 도와주는 AI](agents-overview.md)를 먼저 읽어 보세요.

## 이 문서를 읽는 법

에이전트는 메인 채팅 답변과 나란히 자동으로 실행되는 작은 AI 기능입니다. 먼저 카탈로그에서 설치한 다음, 캐릭터 카드 단위가 아니라 채팅 단위로 켜고 설정합니다. 다운로드, 업데이트, 제거, 채팅별 설정, 비용 주의 사항은 [에이전트: 채팅을 도와주는 AI](agents-overview.md)에서 다룹니다.

아래 각 에이전트마다 세 가지 정보를 정리했습니다.

- **단계 또는 연동 방식**: 일반 파이프라인 에이전트가 언제 실행되는지입니다. **Pre-Generation**(생성 전)은 답변 생성 전에 실행되며 프롬프트에 텍스트를 추가할 수 있습니다. **Parallel**(병렬)은 답변 생성과 동시에 실행되므로 완성된 텍스트를 보지 못합니다. **Post-Processing**(후처리)은 답변이 완성된 뒤에 실행되어 그 내용을 읽을 수 있습니다(일부는 고쳐 쓰기까지 합니다). Maps, Calls, Conversation 게임 같은 기능 패키지는 실행 단계 대신 해당 화면에 직접 연동됩니다.
- **사용 가능한 곳**: 그 에이전트를 추가할 수 있는 채팅 모드입니다. 대부분은 **Roleplay** 채팅에서 동작합니다. 다른 모드에서 쓰는 것도 몇 가지 있으며, 항목마다 밝혀 두었습니다.
- **주요 설정**: 가장 많이 손대게 되는 설정입니다. 에이전트를 추가할 때 지정하거나, 나중에 **Chat Settings**(채팅 설정)의 에이전트 설정 카드에서 바꿀 수 있습니다.

Marinara는 **Agents**(에이전트) 패널에서 에이전트를 **Writer Agents**(작가 에이전트), **Tracker Agents**(추적 에이전트), **Misc Agents**(기타 에이전트) 세 가지로 묶어 보여 줍니다. 이 문서도 같은 분류를 따릅니다.

실행 간격을 두면 에이전트가 메시지마다 실행되지 않고 사용자와 어시스턴트 메시지 몇 개마다 한 번씩 실행됩니다. 실행 간격은 에이전트 설정에서 최대 100까지 바꿀 수 있습니다.

## Writer 에이전트

Writer 에이전트는 이야기나 문장을 다듬습니다. 답변 생성 전에 방향을 잡아 주거나, 생성된 답변을 뒤에서 손봅니다.

### Prose Guardian

의미는 그대로 두면서 금지어와 반복 표현을 없애도록 최신 답변을 고쳐 씁니다. 모델이 같은 표현을 되풀이하거나 특정 단어를 남발할 때 쓰면 좋습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Banned Words**(기본값은 `ozone`), **Prefer In Writing**(작문 시 선호), **Remove From Writing**(작문에서 제외) 입력란. **Hold Message Until Rewrite**(재작성 완료까지 메시지 보류) 토글(기본 켜짐)을 켜 두면 정리가 끝날 때까지 답변을 숨깁니다. 끄면 다듬기 전 답변이 먼저 보였다가 나중에 교체됩니다.

### Continuity Checker

캐릭터가 동시에 두 곳에 있거나 시간 흐름이 어긋나는 것처럼 최신 답변에서 눈에 띄는 논리 오류를 바로잡습니다. 문제를 찾으면 체크리스트로 보여 주므로 어떤 수정을 적용할지 골라서 정할 수 있습니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Hold Message Until Rewrite** 토글.

### Card Evolution Auditor

플레이 중에 캐릭터가 어떻게 변해 가는지 지켜보고 그 캐릭터 카드에 반영할 수정안을 제안합니다. 자동으로 고치는 일은 없습니다. 제안은 모두 **Review Character Card Updates**(캐릭터 카드 업데이트 검토) 창으로 열리며, 거기서 승인하거나 거절합니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: 기본적으로 사용자와 어시스턴트 메시지 8개마다 한 번 실행됩니다. [에이전트 승인과 Agent Suite](approvals-and-agent-suite.md)를 참고하세요.

### Narrative Director

요청했을 때만 이야기에 한 번짜리 자극을 넣어 줍니다. 이 에이전트가 Roleplay 채팅에서 활성화되어 있으면 메시지 입력란 위에 **Push Story**(스토리 전개) 버튼이 나타납니다. 버튼을 누르면 다음 답변이 준비되어, 줄거리를 진전시키거나 뜻밖의 사건을 끌어들입니다.

- **단계**: Pre-Generation.
- **사용 가능한 곳**: Roleplay 전용.
- **주요 설정**: **Story Push Mode**(**Natural**은 진행 중인 이야기를 밀고 나가고, **Random Event**는 그럴듯한 돌발 사건을 더합니다). **Secret Plot**이라는 숨은 장기 전개를 따로 품고 있게 할 수도 있습니다. 자세한 사용법은 [Narrative Director와 Secret Plot](../roleplay/narrative-director.md)에서 설명합니다.

### Knowledge Retrieval

답변 생성 전에 지정한 로어북(과 업로드한 파일)을 훑습니다. 중요한 대목을 요약해 프롬프트에 덧붙입니다. 로어북은 세계와 캐릭터의 배경 설정을 모아 둔 것입니다. 가벼운 검색 방식이라 별도의 데이터베이스가 필요 없습니다.

- **단계**: Pre-Generation.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Use chat-active lorebooks**(채팅 활성 로어북 사용) 토글, **Fixed Source Lorebooks**(고정 소스 로어북) 선택기, 지원 형식 파일 업로드. 역할이 겹치므로 이 에이전트와 Knowledge Router를 함께 돌리지 마세요. 설정 방법은 [지식 소스](knowledge-sources.md)를 참고하세요.

### Knowledge Router

Knowledge Retrieval보다 비용이 적게 드는 대안입니다. 요약하는 대신 로어북 항목의 짧은 설명만 읽습니다. 그런 다음 들어맞는 항목을 글자 그대로 덧붙입니다. 항목마다 설명을 잘 적어 두었을 때 가장 잘 동작합니다.

- **단계**: Pre-Generation.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Use chat-active lorebooks** 토글과 **Fixed Source Lorebooks** 선택기. 소스 항목 중 설명이 적힌 비율은 커버리지 배지로 표시됩니다. 설정 방법은 [지식 소스](knowledge-sources.md)를 참고하세요.

## Tracker 에이전트

Tracker 에이전트는 장면, 캐릭터, 스탯의 현재 상태를 계속 기록합니다. 최신 기록을 프롬프트에 한 섹션으로 넣으면 모델이 앞뒤 내용을 일관되게 유지합니다. World State, Quest Tracker, Character Tracker, Persona Stats, Custom Tracker, Inventory Tracker, Beholder는 **Add as Prompt Section**이 기본으로 켜져 있습니다. Expression Engine과 Background만 예외입니다.

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

업로드해 둔 배경 중에서 현재 장면에 가장 잘 맞는 배경 이미지를 고릅니다. 이미지를 생성하지는 않습니다. 장면 배경을 자동으로 만들고 싶다면 Illustrator를 쓰세요.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: 일반적인 에이전트 연결과 컨텍스트 설정. 배경 선택에는 이미 배경 라이브러리에 있는 이미지만 쓰입니다.

### Character Tracker

그 자리에 있는 캐릭터와 함께 기분, 행동, 외모, 옷차림, 속마음, HP 같은 캐릭터별 스탯을 기록합니다. 초상화가 없는 새 캐릭터의 이미지를 만들어 줄 수도 있습니다.

자주 등장하는 캐릭터가 장면을 떠났다가 돌아오면, Character Tracker가 마지막으로 저장한 스탯과 사용자 지정 필드를 다시 불러와 흐름을 이어 줍니다. 카드가 있는 캐릭터는 카드에 설정된 RPG 수치와 능력치까지 근거로 받고, 카드의 아바타와 잘라 낸 영역을 항상 그대로 유지합니다. 초상화 자동 생성은 대응하는 캐릭터 카드가 없는 NPC로만 한정됩니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐), 그리고 선택 사항인 **Auto-Generate NPC Avatars**(NPC 아바타 자동 생성) 설정(전용 이미지 연결 선택기가 따로 있습니다).

### Beholder

각 캐릭터의 현재 의상을 신체 부위별로 추적하고, 들고 있는 물건, 상처, 없어진 신체 부위, 명시적으로 드러난 부위, 인간이 아닌 종족도 기록합니다. 최근 검증된 스냅샷은 Beholder의 Roleplay Chat Settings 서랍에 표시되며, 다음 Beholder 추적 호출과 다음 Roleplay 기본 응답 모두에 전달됩니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay 전용.
- **주요 설정**: **Chat Settings → Agents → Tracker Agents**에서 추가하거나 제거하세요. 같은 위치에서 **Configure Beholder**를 열어 연결, 모델, 프롬프트, 컨텍스트, 출력 제한을 선택할 수 있습니다. **Add as Prompt Section**은 기본으로 켜져 있습니다.
- **권장 모델**: 전체 상태를 안정적으로 추적하려면 OpenAI GPT-5.5+, Claude Opus 4.8+, Kimi K3+ 같은 SOTA 모델을 사용하세요.
- **출처**: AGPL-3.0-only 라이선스의 [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME)를 Engine의 네이티브 Agent 런타임에 맞게 적용했습니다. 공식 패키지는 기존 확장 기능의 DOM, 폴링 또는 로컬 저장소 런타임을 불러오지 않습니다.

### Persona Stats

포만도, 기력, 청결도처럼 내 캐릭터의 상태 바를 기록하며, 직접 추가한 상태 바도 함께 관리합니다. 생존물이나 생활 시뮬레이션 스타일 플레이에 어울립니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐). [캐릭터 색상과 RPG 스탯](../characters/colors-and-stats.md)을 참고하세요.

### Custom Tracker

화폐, 카운터, 플래그처럼 직접 정의한 필드를 기록합니다. 기본 제공 트래커로는 이야기에 필요한 것을 담아내지 못할 때 쓰세요.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **Add as Prompt Section**(기본 켜짐).

### Inventory Tracker

돈, 장착 장비, 소지품을 세 가지 구조화 목록으로 추적합니다. Persona Stats 인벤토리를 재사용하거나 데이터를 Custom Tracker 문자열로 압축하지 않습니다. 같은 이름은 합치고, 수량이 하나인 항목은 간결하게 표시하며, 잠근 행은 이후 추적 작업에서도 바뀌지 않습니다.

- **단계**: Post-Processing(후처리).
- **작동 모드**: Roleplay.
- **주요 설정**: **Add as Prompt Section**은 기본으로 켜져 있습니다. HUD와 Tracker Panel에서 모든 이름과 수량을 편집하고 잠글 수 있습니다.

### World Maps

여러 겹으로 중첩된 장소와 그 공간 관계를 이야기에 더하고 계속 유지합니다. 지역, 구역, 방, 연결 통로를 직접 만들고, 장소 사이를 이동하고, 현재 위치를 생성의 공간 정보로 활용할 수 있습니다. Game Mode에서도 이 패키지의 세계 지도 화면을 쓸 수 있습니다.

- **연동 방식**: 기능 패키지입니다. 일반적인 생성 단계 에이전트로 실행되는 대신 지도 UI와 채팅 실행 시점의 컨텍스트를 제공합니다.
- **사용 가능한 곳**: Roleplay, Game.
- **주요 설정**: Roleplay 채팅에서는 **Chat Settings → Agents**에서 활성화하고, Game에서는 생성할 때 선택한 뒤 해당 게임 설정에서 관리합니다. 설치하거나 제거하면 Marinara를 재시작해야 합니다.
- **전체 가이드**: [World Maps: 설정, 제작, 이동](hierarchical-maps.md).

## Misc 에이전트

Misc 에이전트는 이미지, 음악, 관객 반응, 카드 업데이트 같은 부가 요소를 더합니다.

### Echo Chamber

장면에 반응하는 실시간 관객을 흉내 내어 채팅 영역에 떠 있는 **Echo** 위젯으로 보여 줍니다. 30초마다 새 반응이 하나씩 공개됩니다.

- **단계**: Parallel.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad**, **Harbingers** 같은 이름 붙은 스타일 중에서 하나를 고릅니다. 위젯 안에는 **Re-run Echo Chamber**(에코 챔버 다시 실행)와 **Clear messages**(메시지 지우기) 조작 버튼이 있습니다.

### Noodle

Noodle 공개 타임라인과 크리에이터 및 팬 역할극 피드인 NoodleR로 이루어진 선택형 로컬 소셜 세상을 추가합니다. 일반 채팅 에이전트 파이프라인에서 실행되지 않고 전용 Home 탭에서 열립니다.

- **통합 방식**: 기능 패키지로, Home 탭과 로컬 경로, 생성 및 미디어 흐름, 백그라운드 스케줄러를 제공합니다.
- **작동 위치**: Home. 필요하면 Conversation, Roleplay, Game 채팅의 맥락을 가져올 수 있습니다.
- **주요 설정**: **Agents → Download Agents**에서 설치하고 안내가 나오면 Marinara Engine을 다시 시작하세요. Noodle 안에서 초대 계정, 텍스트 및 이미지 연결, 타임라인 새로 고침, NoodleR Creator 프로필, 시뮬레이션 게시물 접근, 독자 활동을 설정할 수 있습니다.
- **데이터 수명 주기**: 제거하면 Home 탭이 사라지고 다시 시작한 뒤 패키지 경로와 스케줄러가 멈추지만, 기존 Noodle 및 NoodleR 데이터는 나중에 다시 설치할 수 있도록 보존됩니다.
- **전체 안내서**: [Noodle: 앱 안의 소셜 타임라인](../noodle/overview.md).

### Long-Term Memory

채팅 요약, 캐릭터 기록, 로어북에서 오래 남길 기억을 뽑아 패키지 전용 보관함에 넣어 두고, 메인 답변 전에 관련 컨텍스트를 다시 불러옵니다. 범위를 좁힌 보관함 열람, 소스 가져오기, 대기 중인 초안 검토, 불러온 컨텍스트의 프리셋 마커 배치를 지원합니다.

- **연동 방식**: 기능 패키지입니다. 일반적인 후처리 트래커로 실행되는 대신 생성 전 컨텍스트와 기억 관리 UI를 제공합니다.
- **사용 가능한 곳**: Conversation, Roleplay, Game.
- **주요 설정**: 활성화 여부, 회상 토큰 예산(128-16,384), 최대 회상 청크 수(1-100), 점수 임계값, 최근 메시지 컨텍스트(1-20), 회상 방식과 의미, 어휘, 그래프, 키워드 가중치, 해결된 기억 포함 여부, 회상 서문, 추출 추론과 상세도, 생성 한도, 소스 한도, 프롬프트 템플릿, AI 키워드 추출, Game 모드 추출.
- **데이터 관리**: 보관함, 초안, 설정을 내보내거나 교체할 때는 Memory Settings의 백업 기능을 쓰세요. 데이터 전체 삭제는 기억, 초안, 활동 기록, 파생 색인을 영구히 지우고 설정만 남깁니다. 패키지를 제거해도 Long-Term Memory 보관함은 남아 있어 나중에 다시 설치할 때 그대로 쓸 수 있습니다. 설치, 업데이트, 제거 시에는 Marinara를 재시작해야 합니다.
- **호환성**: Engine `2.3.5` 이상 `4.0.0` 미만. 이 패키지는 `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, `ui` 권한을 씁니다.

### Illustrator

이미지 생성과 동영상 생성을 담당합니다. 중요한 장면의 시각 프롬프트를 쓴 다음 설정해 둔 미디어 제공자에 보냅니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: 기본적으로 사용자와 어시스턴트 메시지 5개마다 한 번 실행됩니다. 설정에는 **Prompt Model**(프롬프트 모델), **Image Style**(이미지 스타일), **Attach Card Appearance**(카드 외형 첨부), **Send Avatar References**(아바타 참조 전송)가 있습니다. 전체 설정 방법은 [Illustrator 에이전트](../media/illustrator-agent.md)에서 설명합니다.

### Lorebook Keeper

채팅에서 중요한 사실을 골라 로어북 항목을 만들고 갱신합니다. 플레이를 이어 갈수록 세계 설정 메모가 함께 불어납니다.

- **단계**: Post-Processing.
- **사용 가능한 곳**: Roleplay. Game Mode에서는 세션 종료 시점에 같은 일을 하는 **Game Session Keeper** 변형이 쓰입니다.
- **주요 설정**: 기본적으로 사용자와 어시스턴트 메시지 8개마다 한 번 실행됩니다. 항목을 어디에 넣을지는 **Target Lorebook**(대상 로어북) 선택기로 정하며, 자동 선택 옵션도 있습니다. 고급 프롬프트 설정에서는 쓰기 가능한 로어북의 정확한 이름이나 `world`, `npc`, `scene`, `player` 같은 설정된 별칭을 반환할 수 있습니다. 별칭 대상이 없으면 자동으로 만들고 현재 채팅에 연결합니다. 대상을 생략하면 기존의 단일 로어북 동작을 유지합니다.

### Combat

선공 순서, HP, 턴 순서를 비롯한 전투를 관리합니다. 활성화하면 메시지 입력란 위에 **Encounter**(인카운터) 버튼이 나타납니다.

- **단계**: Parallel.
- **사용 가능한 곳**: Roleplay.
- **주요 설정**: 턴 판정을 위한 주사위 굴림 도구가 함께 들어 있습니다.

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
- **주요 설정**: 선택지를 고쳐 쓰는 **Edit**(편집)와 새로 만드는 **Re-roll**(리롤).

### Storyboard

완료된 Roleplay 대화와 Game 서술을 바탕으로 정지 이미지 또는 애니메이션 스토리보드를 구성합니다. 계획 단계와 제공자별 형식 변환이 나뉘어 있어서, 만들어진 키프레임과 동영상 전반에서 원본의 시간 순서, 캐릭터의 정체성, 선택한 시각 스타일이 그대로 유지됩니다.

- **연동 방식**: 에이전트 패키지입니다. Game과 Roleplay는 Engine의 Storyboard 호스트 연동을 통해 설치된 패키지의 프롬프트 템플릿과 설정을 씁니다.
- **사용 가능한 곳**: Roleplay, Game.
- **주요 설정**: 정지 이미지 플래너와 애니메이션 플래너 선택, 이미지 연결과 동영상 연결, 키프레임 수, 길이, 표시 방식, 캐릭터 참조 처리 방식, Roleplay 에피소드 템플릿과 스타일 템플릿, Game 삽화 템플릿과 동영상 템플릿.
- **호환성**: Engine `2.3.5` 이상 `3.0.0` 미만. 이 패키지는 `agent-runtime`, `chat-read`, `prompt-context`, `storage`, `ui` 권한을 쓰며 재시작은 필요하지 않습니다.
- **전체 가이드**: [스토리보드 에이전트 가이드](../game/storyboard.md).

### Calls

Conversation 캐릭터와 실시간 음성 통화, 영상 통화를 할 수 있게 합니다. 직접 거는 통화와 걸려 오는 통화, 통화 전용 기록, 음성 합성, 마이크 입력, 캐릭터 동영상 클립을 지원합니다.

- **연동 방식**: Conversation 기능 패키지입니다. 일반적인 생성 단계 에이전트로 실행되는 대신 툴바, 채팅 화면, **Chat Settings** 조작 요소를 더합니다.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: **Chat Settings → Agents → Calls**를 열어 통화를 켜고 음성, 마이크, 벨소리, 영상 동작을 정합니다. [Conversation 음성 통화와 영상 통화](../conversation/calls.md)를 참고하세요. 설치하거나 제거하면 Marinara를 재시작해야 합니다.

### UNO

규칙이 강제되는 UNO 테이블을 열어 Conversation 캐릭터들과 함께 즐길 수 있게 합니다. 하우스 룰을 설정할 수 있고 총 2명에서 10명까지 참여할 수 있습니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/uno`로 시작하며, 설정 단계에서 참가자와 하우스 룰을 정합니다. 설치하거나 제거하면 Marinara를 재시작해야 합니다.

### Chess

1대1 Chess 판을 더합니다. 합법 수 강제, 체크와 체크메이트 판정, 잡은 말 표시, 캐릭터를 유지한 상대 턴을 지원합니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/chess`로 시작한 뒤 상대와 내가 잡을 진영을 고릅니다. 설치하거나 제거하면 Marinara를 재시작해야 합니다.

### Poker

총 2명에서 8명까지 앉는 Texas Hold'em 테이블을 더합니다. 블라인드, 베팅 라운드, 사이드 팟, 쇼다운 판정, 캐릭터를 유지한 상대를 지원합니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/poker`로 시작한 뒤 참가자, 시작 칩, 블라인드 금액을 정합니다. 설치하거나 제거하면 Marinara를 재시작해야 합니다.

### 8-Ball Pool

솔리드와 스트라이프로 나뉜 1대1 당구대를 더합니다. 조준과 샷 세기, 파울, 볼 인 핸드, 캐릭터를 유지한 상대의 샷을 지원합니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/8ball`로 시작한 뒤 상대를 고릅니다. 설치하거나 제거하면 Marinara를 재시작해야 합니다.

### Tic-Tac-Toe

1대1 Tic-Tac-Toe 판을 더합니다. 기호를 직접 고르거나 무작위로 정할 수 있고, 턴 처리와 승부와 무승부 판정을 지원합니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/tictactoe`(별칭 `/ttt`)로 시작한 뒤 상대와 기호를 고릅니다. 설치하거나 제거하면 Marinara를 재시작해야 합니다.

### Rock-Paper-Scissors

1대1 Rock-Paper-Scissors 승부를 더합니다. 공개하기 전까지 양쪽의 선택은 서로 보이지 않습니다.

- **연동 방식**: Conversation 게임 패키지.
- **사용 가능한 곳**: Conversation.
- **주요 설정**: 게임 선택기에서 시작하거나 `/rps`로 시작한 뒤 상대와 3판 2선승, 5판 3선승, 7판 4선승 중 하나를 고릅니다. 설치하거나 제거하면 Marinara를 재시작해야 합니다.

## 관련 가이드

- [에이전트: 채팅을 도와주는 AI](agents-overview.md)
- [Illustrator 에이전트](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Haptic Feedback 설정](../integrations/haptic-feedback.md)
- [지식 소스](knowledge-sources.md)
- [Narrative Director와 Secret Plot](../roleplay/narrative-director.md)
- [Conversation 음성 통화와 영상 통화](../conversation/calls.md)
- [Conversation 테이블 게임](../conversation/table-games.md)
