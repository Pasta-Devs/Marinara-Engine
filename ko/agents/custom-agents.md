# 사용자 지정 에이전트 만들기

사용자 지정 에이전트는 직접 작성하는 도우미입니다. 지시 내용, 실행 시점, 바꿀 수 있는 대상을 모두 직접 정합니다. [다운로드 가능한 에이전트](built-in-agents.md) 중에 원하는 일을 하는 것이 없을 때 만드세요. 설치된 에이전트 중 비슷한 것이 있다면 **Agents**(에이전트) 패널에서 그 카드에 마우스를 올리고 **Copy agent**(에이전트 복사)를 클릭해 편집할 수 있는 사본을 만드세요.

시작하기 전에 [에이전트: 채팅을 도와주는 AI](agents-overview.md)를 읽어 보세요. 에이전트를 만들기만 해서는 실행되지 않습니다. 만든 뒤 채팅에 추가해야 합니다. 사용자 지정 에이전트는 모든 채팅 모드에서 동작합니다.

## 사용자 지정 에이전트 새로 만들기

1. **Agents** 패널을 여세요.
2. 위쪽에 있는 **New**(새로 만들기) 버튼(더하기 아이콘)을 클릭하세요. 전체 화면 에이전트 편집기가 열립니다.
3. 제목 입력란에 이름을 입력하세요. 예를 들면 `Weather Reporter`입니다.
4. **Description**(설명)과 **Author**(작성자)를 채우세요.
5. **Pipeline Phase**(파이프라인 단계)를 고르세요([Pipeline Phase](#pipeline-phase) 참고).
6. **Custom Agent Abilities**(커스텀 에이전트 능력)에서 필요한 능력을 켜세요.
7. 에이전트가 만들어 낼 결과에 맞는 **Result Type**(결과 유형)을 고르세요. 잘 모르겠다면 **Context Injection**을 고르세요. 능력도, 엄격한 출력 형식도 필요 없습니다.
8. **Prompt Template**(프롬프트 템플릿)에 에이전트 지시를 작성하세요.
9. 위쪽 막대에서 **Save**(저장)를 클릭하세요. 초록색 **Saved**(저장됨) 배지가 나타납니다.

이제 에이전트가 **Agents** 패널의 **Custom Agents**(커스텀 에이전트) 섹션에 나타납니다. 사용하려면 채팅을 열고 **Chat Settings**(채팅 설정)로 이동해 **Enable Agents**(에이전트 활성화)를 켠 다음 **Custom Agents**에서 에이전트를 추가하세요.

## Pipeline Phase

**Pipeline Phase**는 에이전트가 실행되는 시점을 정합니다.

- **Pre-Generation**: 답변 전에 실행됩니다. 컨텍스트를 더하거나 프롬프트를 바꿀 수 있습니다.
- **Parallel**: 답변과 동시에 실행됩니다. 완성된 답변은 볼 수 없습니다.
- **Post-Processing**: 답변 뒤에 실행됩니다. 답변을 읽을 수 있고, 일부 결과 유형에서는 답변을 고칠 수도 있습니다.

일부 결과 유형은 단계를 강제로 정합니다. **Text Rewrite**는 단계를 **Post-Processing**으로 바꿉니다. **Prompt Patch**와 **Character Activity**는 **Pre-Generation**으로 바꿉니다.

Post-Processing 에이전트에는 **Turn Data Access**(턴 데이터 접근) 섹션도 생깁니다. 여기에는 **Pre-generation injections**(생성 전 주입)와 **Parallel agent results**(병렬 에이전트 결과) 토글 2개가 있습니다. 이 토글을 켜면 같은 턴에 다른 에이전트가 만든 결과를 에이전트가 읽을 수 있습니다.

## Custom Agent Abilities

능력은 직접 켜야 쓸 수 있는 권한입니다. 토글을 켜기 전까지 각 능력은 차단됩니다.

- **Create lorebooks**: 로어 출력에 대상이 없으면 에이전트가 만든 로어북을 새로 생성합니다.
- **Edit lorebooks**: 로어북 항목을 쓰거나 로어북 갱신 결과를 반환합니다.
- **Edit messages**: 생성된 메시지 텍스트를 바꾸거나, 메시지에 이어 갈 선택지를 붙입니다.
- **Edit trackers**: 게임, 캐릭터, 페르소나, 사용자 지정 트래커의 상태를 갱신합니다.
- **Frontend styling**: 생성 중에 일시적인 시각 스타일을 적용합니다.
- **Change chat backgrounds**: 채팅 배경을 바꾸고 저장합니다.
- **Change character sprites**: 채팅에 표시되는 캐릭터와 페르소나의 표정을 바꿉니다.
- **Control media playback**: Spotify, YouTube, 로컬 음악을 제어합니다.
- **Control haptic devices**: 연결된 햅틱 기기에 정해진 범위 안의 명령을 보냅니다.
- **Edit About Me details**: 채팅별 About Me 텍스트를 바꿉니다. 공개 카드를 바꾸려면 여전히 승인이 필요합니다.
- **Image generation**: 이미지 생성기에 이미지 프롬프트를 보냅니다.
- **Vectors/embeddings**: 벡터 컨텍스트를 사용합니다. 벡터를 쓰면 Marinara가 의미로 텍스트를 검색할 수 있습니다.
- **Main prompt edits**: 메인 모델에 보내는 프롬프트를 고칩니다.
- **Create character cards**: 새 캐릭터 카드를 제안합니다. 직접 검토하고 수락한 뒤에만 저장됩니다.
- **Choose active chat characters**: 현재 Conversation(대화)이나 Roleplay(롤플레이) 답변에 쓸 캐릭터를 채팅에 추가된 캐릭터 중에서 고릅니다.

**Edit lorebooks**를 켜면 **Lorebook Writer**(로어북 작성) 섹션이 나타납니다. **Allow lorebook entry writes**(로어북 항목 쓰기 허용)를 켜고 **Target lorebook**(대상 로어북)에서 로어북 하나를 고르세요. 에이전트는 그 로어북에만 쓸 수 있습니다.

## Result Type

**Result Type**은 에이전트의 답을 Marinara가 어떻게 읽을지 정합니다. 대부분의 유형은 JSON을 기대합니다. JSON은 중괄호와 큰따옴표로 쓰는 텍스트 형식입니다. 필요한 능력을 켜기 전까지 유형은 흐리게 표시됩니다.

능력이 필요 없는 유형은 다음과 같습니다.

- **Context Injection**: 생성 전에 텍스트를 더하거나, 생성 후에 메모를 기록합니다. 가장 쉽게 시작할 수 있는 유형입니다.

**Edit messages**가 필요한 유형은 다음과 같습니다.

- **Text Rewrite**: 답변 뒤에 메시지 텍스트를 바꿉니다.
- **Interactive Choices**: 메시지에 이어 갈 선택지를 붙입니다.

**Edit trackers**가 필요한 유형은 다음과 같습니다.

- **Character Tracker**: 현재 등장한 캐릭터를 갱신합니다.
- **Persona Stats**: 페르소나의 능력치, 상태, 인벤토리를 갱신합니다.
- **Custom Tracker**: 사용자 지정 트래커 필드를 교체합니다.
- **Game State**: 세계 상태 형태의 게임 데이터를 갱신합니다.

그 밖의 유형에는 각각 필요한 능력이 따로 있습니다.

- **Lorebook Update** (Edit lorebooks): 로어북 항목을 만들거나 갱신합니다.
- **Image Prompt** (Image generation): 이미지 생성기에 장면을 그리도록 요청합니다.
- **Prompt Patch** (Main prompt edits): 프롬프트 섹션을 더하거나, 앞에 붙이거나, 교체합니다.
- **Frontend Style** (Frontend styling): 일시적인 스타일 효과를 적용합니다.
- **Background Change** (Change chat backgrounds): 사용할 수 있는 배경을 골라 저장합니다.
- **Sprite Change** (Change character sprites): 채팅에 표시되는 표정을 바꿉니다.
- **Spotify Control**, **YouTube Control**, **Local Music Control** (Control media playback): 재생을 제어합니다.
- **Haptic Command** (Control haptic devices): 햅틱 기기에 정해진 범위 안의 명령을 보냅니다.
- **About Me Update** (Edit About Me details): 채팅별 About Me 텍스트를 갱신하고 공개 수정안을 제안합니다.
- **Character Card Creation** (Create character cards): 직접 승인할 수 있도록 편집 가능한 캐릭터 카드 하나를 제안합니다.
- **Character Activity** (Choose active chat characters): 현재 답변에 쓸 캐릭터 카드를 고릅니다. 답변 전에 실행되며, 채팅에 추가된 캐릭터를 하나 이상 골라야 합니다.

### 이미지 에이전트의 채팅별 제어

**Image generation** 능력이 있는 에이전트에는 **Chat Settings → Agents → Custom Agents**에 제어 항목 2개가 더 생깁니다.

- **Image model**(이미지 연결): 이 채팅에서만 이 에이전트의 이미지 연결을 재정의합니다. 에이전트 자체 설정을 유지하려면 **Agent default**(에이전트 기본값)로 두세요. 채팅의 **Image Style**(이미지 스타일)도 사용자 지정 에이전트 이미지에 적용됩니다.
- **Camera button**: 활성화 키워드를 기다리지 않고 지금 바로 이미지를 만듭니다. 에이전트 템플릿이 프롬프트를 작성하지 않으면 이미지 대신 오류 토스트가 표시됩니다.

## Activation Keywords

기본적으로 에이전트는 평소 주기(얼마나 자주 실행되는지)대로 실행됩니다. **Activation Keywords**(활성화 키워드)를 쓰면 장면과 관련이 없을 때 에이전트를 건너뛰므로 토큰이 절약됩니다.

1. **Activation Keywords**에 키워드나 문구를 한 줄에 하나씩 입력하세요. 예를 들면 `tavern`이나 `secret door`입니다.
2. **Scan Depth**(깊이 스캔)에 검색할 최근 메시지 개수를 지정하세요. 기본값은 5이고 최대는 200입니다.

그러면 해당 메시지에 키워드가 나타날 때만 에이전트가 실행됩니다. 입력란을 비우면 필터가 꺼집니다. 주기와 활성화 질문은 계속 적용됩니다.

## 도구 연결하기

에이전트는 도구를 호출할 수 있습니다. 도구는 AI가 무언가를 가져오거나 바꾸기 위해 실행한 뒤 그 결과를 다시 읽는 함수입니다. 이 방식을 function calling이라고도 합니다.

1. 에이전트 편집기에서 **Tools / Function Calling**(도구 / 기능 호출)을 열고 원하는 도구를 하나씩 켜세요. 목록에는 기본 제공 도구와 직접 만든 도구가 있습니다. 도구를 만드는 방법은 [사용자 지정 도구](../extending/custom-tools.md)를 참고하세요.
2. **Chat Settings**에서 **Function Calling**(기능 호출)을 열고 **Enable Tool Use**(도구 사용 활성화)를 켜세요. 이 설정을 켜지 않으면 에이전트 도구는 꺼진 상태로 남습니다.

가져온 에이전트는 도구 접근 권한을 받지 않습니다. 가져온 에이전트를 검토한 뒤 사용할 도구를 직접 선택하세요.

에이전트는 한 번 실행할 때 도구 호출을 최대 16라운드까지 할 수 있으며(서버의 `MAX_TOOL_ROUNDS`가 더 낮으면 그보다 적습니다), 그 뒤에는 그때까지 얻은 내용으로 답합니다. 한 번에 도구 하나만 호출하는 모델은 호출할 때마다 한 라운드를 쓰므로, 항목을 많이 저장하는 에이전트는 한 응답에서 여러 번 호출해야 합니다. 로어북 백필 실행은 최대 64라운드까지 할 수 있습니다.

## Named prompt options

에이전트 하나에 프롬프트 변형을 여러 개 담아 둘 수 있으므로, 에이전트를 고치지 않고도 채팅마다 하나를 고를 수 있습니다.

1. **Prompt Template** 아래에서 **Named prompt options**(이름이 지정된 프롬프트 옵션)를 찾으세요.
2. **Add option**(옵션 추가)을 클릭하세요.
3. 옵션 이름과 짧은 설명을 입력한 다음 전체 프롬프트를 작성하세요.

누군가 이 에이전트를 채팅에 추가하면 **Prompt Mode**(프롬프트 모드) 드롭다운에 옵션이 나열됩니다. 옵션이 없으면 기본 프롬프트만 표시됩니다.

## 그 밖의 설정

- **Model override**(연결 재정의): 이 에이전트에 다른 모델을 씁니다. 예를 들어 더 저렴한 모델을 쓸 수 있습니다. 비워 두면 채팅의 모델을 씁니다. 에이전트는 해당 연결에 저장된 생성 파라미터를 전송합니다. [에이전트용 파라미터](../prompts/generation-parameters.md#parameters-for-agents)를 참고하세요.
- **Agent Budget**(에이전트 예산): **Context Size**(컨텍스트 크기)는 에이전트가 읽는 최근 메시지 개수입니다(기본값 5). **Max Output Tokens**(최대 출력 토큰)는 출력에 확보하는 여유입니다(기본값 4096, 128에서 32768까지).
- **Add as Prompt Section**(프롬프트 섹션으로 추가): 에이전트의 최신 출력을 프롬프트 프리셋에 배치할 수 있는 섹션으로 제공합니다.

`{{user}}`, `{{char}}` 같은 매크로는 **Prompt Template**에서 동작합니다. [매크로](../prompts/macros.md)를 참고하세요.

## 완성 예제

이 에이전트는 모든 답변을 영국식 영어로 다시 씁니다.

1. 이름을 `British English Editor`로 지정하세요.
2. **Custom Agent Abilities**에서 **Edit messages**를 켜세요.
3. **Result Type**에서 **Text Rewrite**를 고르세요. 단계가 **Post-Processing**으로 바뀝니다.
4. 다음 내용을 **Prompt Template**에 붙여 넣으세요.

   ```text
   You are a copy editor. Rewrite the latest reply into British English.
   Change spelling and vocabulary only. Do not change the meaning, tone, or events.
   Return JSON with an "editedText" field holding the full rewritten reply,
   and a "changes" array of short notes describing what you changed.
   ```

5. **Save**를 클릭하세요.
6. Roleplay 채팅을 열고 **Chat Settings**에서 **Enable Agents**를 켠 다음 **Custom Agents**에서 에이전트를 추가하세요.

답변이 끝날 때마다 에이전트가 다음과 같은 JSON을 반환합니다.

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara는 `editedText`를 답변에 갈아 끼웁니다. `changes`에 담긴 메모는 짧은 요약으로 표시됩니다.

## 에이전트 가져오기와 내보내기

에이전트 하나를 내보내려면 편집기 위쪽 막대에서 **Export agent**(에이전트 내보내기) 버튼(업로드 아이콘)을 클릭하세요. 파일에는 에이전트의 프롬프트와 설정이 들어 있으며, 사용자 지정 도구 정의는 절대 들어가지 않습니다. 여러 에이전트를 내보내려면 **Agents** 패널에서 **Select agents**(에이전트 선택)를 사용해 에이전트를 고른 다음 내보내세요.

외부 가져오기는 기본적으로 잠겨 있습니다.

1. **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)을 열고 **Allow custom Agent imports**(사용자 지정 에이전트 가져오기 허용)를 켜세요. `.env` 수정은 필요 없습니다.
2. **Agents** 패널에서 **Import agents**(에이전트 가져오기)를 클릭하고 에이전트 파일이나 폴더를 고르세요.
3. Marinara가 보여 주는 권한 목록을 검토하세요. 에이전트에 필요한 것만 승인하세요. 체크하지 않은 기능은 계속 차단됩니다.

이 잠금은 파일, 폴더, 사용자 지정 저장소에서 들어온 에이전트에만 적용됩니다. 직접 만든 에이전트와 **Agent Organizer**의 공식 에이전트는 평소대로 동작합니다. 가져온 파일마다 새로운 사용자 지정 식별자가 부여되므로 공식 에이전트를 대체할 수 없습니다.

안전을 위해 Marinara는 패키지에 딸려 온 함수를 무시하고, 도구 선택을 지우고, 임시 CSS를 정리하며, 가져온 에이전트가 메시지, 트래커, 로어북, 배경, 스프라이트, 미디어, 햅틱, About Me 데이터, 프롬프트, 이미지를 바꾸기 전에 승인된 기능인지 확인합니다. 믿을 수 있는 함수는 따로 가져와 검토한 뒤 직접 에이전트에 연결하세요. **Danger Zone** 토글을 끄면 가져온 에이전트는 실행되지 않습니다.

<a id="activation-questions"></a>

## 활성화 질문

활성화 질문은 최근 장면에 에이전트가 필요한지 묻습니다. 키워드가 놓치는 다른 표현도 잡아냅니다. 활성화 질문에는 **Decision model**(결정 모델)이 필요합니다. 예/아니요 질문에 답하는 작은 모델입니다. Connections 패널에서 고르세요. [Decision 모델](../connections/decision-models.md)을 참고하세요. **Decision model**이 기본값인 **None**(없음)으로 설정되어 있으면 질문 필드는 비활성 상태로 남고, 질문이 있는 에이전트도 질문이 없는 것처럼 실행됩니다.

1. 사용자 지정 에이전트를 여세요.
2. 최대 500자의 **Question**(질문)을 입력하세요. 여기에서도 `{{user}}`와 `{{char}}` 매크로를 쓸 수 있습니다.
3. **Run when probability is at least**(실행할 최소 확률)를 이 에이전트의 임계값으로 설정하세요. "예"일 확률이 이 값 이상이면 에이전트가 실행되므로, 값이 높을수록 더 자주 건너뜁니다. 편집기는 모델에 맞는 권장값을 보여 줍니다. 로컬 채팅 모델과 Decision 계정은 0.5, 내장 Open-Jev 모델은 0.1입니다. 모델을 바꾼 뒤에는 직접 쓰는 채팅으로 확인하세요. [임계값](../connections/decision-models.md#thresholds)을 참고하세요.
4. 선택 사항: **Bypass the question after this many messages without a successful run**(성공적인 실행 없이 이 수만큼 메시지가 지나면 질문 건너뛰기)을 설정하세요. 그만큼 메시지가 지나면 질문을 건너뛰므로, 계속 "아니요"라고 답하는 모델 때문에 에이전트가 영영 실행되지 않는 일을 막을 수 있습니다. 키워드와 주기는 계속 적용됩니다.

질문은 최신 메시지에 관한 진술로 작성하세요. 예를 들면 `The latest message moves the scene to a new place.`입니다. 작은 모델은 `Did the scene change?`보다 이 문장에 더 안정적으로 답했습니다. [판정문 작성하기](../prompts/conditional-prompts.md#writing-statements)를 참고하세요.

실행 방식은 다음과 같습니다.

- 키워드와 주기를 먼저 확인하므로, 건너뛴 에이전트는 판정 요청을 만들지 않습니다. 스캔 깊이가 같은 질문은 단계별로 묶어서 처리합니다.
- **Scan Depth**는 키워드와 질문이 함께 사용할 메시지를 정합니다.
- 생성 전 에이전트와 병렬 에이전트는 답변 전의 채팅을 사용합니다. 후처리 에이전트는 완성된 답변도 봅니다.
- 시간 초과, 사용할 수 없는 모델, 잘못된 답이 있으면 에이전트는 평소대로 실행됩니다. 시간 제한은 모델 유형과 모델이 먼저 추론해야 하는지에 따라 다릅니다. [시간 제한](../connections/decision-models.md#time-limits)을 참고하세요.
- 활성화 질문이나 판정문이 있는 에이전트를 가져오면 Decision 모델 가이드로 연결되는 알림이 표시됩니다. Decision 모델이 없으면 에이전트는 키워드와 **Trigger Cadence**(실행 주기)가 허용할 때마다 실행되고, 프롬프트 판정문은 아니요로 읽힙니다.

활성화 질문은 사용자 지정 에이전트에만 적용됩니다.

<a id="decision-statements-in-the-agents-prompt"></a>

## 에이전트 프롬프트의 판정문

활성화 질문은 에이전트를 실행할지 결정합니다. **Prompt Template**의 판정문은 실행 중인 에이전트에 무엇을 전달할지 결정합니다. 구문은 [조건부 프롬프트](../prompts/conditional-prompts.md#asking-the-decision-model)에 있습니다.

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

판정문을 쓰면 조용한 턴에 더 작은 프롬프트를 보낼 수 있습니다. 트래커는 위치가 바뀌었을 때만 위치를 갱신할 수 있습니다. 이미지 에이전트는 장면이 바뀌었을 때만 새 그림을 설명할 수 있습니다. 음악 에이전트는 분위기가 달라졌을 때만 곡을 바꿀 수 있습니다. 여러 지침 집합 중 하나를 고르려면 `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`, 그다음 `{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}`처럼 이어 가세요. [조건부 프롬프트](../prompts/conditional-prompts.md#asking-the-decision-model)를 참고하세요.

- 생성 전 에이전트와 병렬 에이전트는 답변 전의 채팅을 읽고 메인 프롬프트와 답을 공유합니다. 후처리 에이전트는 완성된 답변을 읽으며, 그 답변을 포함해 판정문을 다시 묻습니다.
- 에이전트를 다시 실행하면 같은 턴, 모델, 판정문에 대해 캐시에 남아 있는 성공한 답을 재사용합니다. [답 재사용](../prompts/conditional-prompts.md#answer-reuse)을 참고하세요.
- 에이전트 프롬프트의 `{{char}}` 매크로는 채팅의 모든 캐릭터를 가리킵니다. 따라서 그룹에서 `{{char}} is angry`는 "Kaelen, Alyssa is angry"가 됩니다. 캐릭터 이름을 쓰거나 "한 캐릭터"라고 쓰세요.
- 답이 없으면 판정문은 아니요로 읽힙니다. Decision 모델이 없는 사용자가 많으므로 `{{else}}` 분기도 합리적으로 작성하세요.

Marinara-Agents에서 설치한 에이전트도 같은 방식으로 프롬프트를 렌더링합니다.

## 관련 가이드

- [에이전트: 채팅을 도와주는 AI](agents-overview.md)
- [Decision 모델](../connections/decision-models.md)
- [다운로드 가능한 에이전트 레퍼런스](built-in-agents.md)
- [사용자 지정 도구](../extending/custom-tools.md)
- [매크로](../prompts/macros.md)
