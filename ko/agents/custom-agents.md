# 사용자 지정 에이전트 만들기

이 가이드에서는 Marinara Engine에서 에이전트를 직접 만드는 방법을 설명합니다. 에이전트는 채팅과 나란히 자동으로 실행되는 작은 AI 기능입니다. 실행 단계, 능력, 출력 형식, 활성화 키워드, 도구, 프롬프트를 어떻게 정하는지 완성된 예제 하나와 함께 알아봅니다.

에이전트가 처음이라면 [에이전트: 채팅을 도와주는 AI](agents-overview.md)에서 기본 개념을 먼저 익힌 뒤 돌아오세요.

## 사용자 지정 에이전트가 필요한 때

Marinara Engine은 다운로드해서 쓸 수 있는 공식 에이전트를 여럿 제공합니다. 직접 만들기 전에 [다운로드 가능한 에이전트 레퍼런스](built-in-agents.md)와 공개 패키지 저장소 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)를 확인하세요. 원하던 동작을 이미 하는 에이전트가 목록에 있을 수 있고, 공식 매니페스트는 그대로 참고할 수 있는 패키지 예제이기도 합니다.

기본 제공 에이전트로 해결되지 않는 일이 있을 때 사용자 지정 에이전트를 만듭니다. 다음과 같은 경우입니다.

- 직접 쓴 지시와 말투를 가진 에이전트가 필요할 때.
- 모든 프롬프트에 특정 메모를 주입하고 싶을 때.
- 답변마다 정해진 문체로 다시 쓰고 싶을 때.
- 직접 만든 도구를 에이전트가 호출하게 하고 싶을 때.

설치된 공식 에이전트 중에 비슷한 것이 있다면 새로 만들지 말고 복사하세요. **Agents**(에이전트) 패널에서 해당 카드에 마우스를 올린 뒤 **Copy agent**(에이전트 복사)를 클릭하면 편집할 수 있는 사용자 지정 사본이 생깁니다.

## 시작하기 전에

만들기에 앞서 두 가지를 알아 두어야 합니다.

1. 에이전트는 캐릭터가 아니라 채팅 단위로 설정합니다. 라이브러리에서 만들기만 해서는 실행되지 않습니다. 채팅에 추가한 다음 **Chat Settings**(채팅 설정)에서 **Enable Agents**(에이전트 활성화)를 켜야 합니다.
2. 사용자 지정 에이전트는 Roleplay(롤플레이), Game Mode(게임 모드), Conversation(대화) 등 모든 채팅 모드에서 동작합니다. 공식 패키지는 지원하는 모드에서만 나타나지만, 직접 만든 에이전트는 어디서나 쓸 수 있습니다.

## 사용자 지정 에이전트 만들기

처음부터 새 에이전트를 만드는 순서는 다음과 같습니다.

1. **Agents** 패널을 여세요.
2. 위쪽에 있는 **New**(새로 만들기) 버튼(더하기 아이콘)을 클릭하세요.
3. 전체 화면 에이전트 편집기가 열리고 빈 사용자 지정 에이전트가 준비됩니다.
4. 맨 위 제목 입력란에 이름을 입력하세요. 예를 들면 `Weather Reporter`입니다.
5. 나중에 무슨 역할인지 알아볼 수 있도록 **Description**(설명)과 **Author**(작성자) 입력란을 채우세요.
6. **Pipeline Phase**(파이프라인 단계)를 고르세요. 자세한 내용은 아래에 있습니다.
7. **Custom Agent Abilities**(커스텀 에이전트 능력)에서 필요한 능력을 켜세요.
8. 에이전트가 만들어 낼 결과에 맞는 **Result Type**(결과 유형)을 고르세요.
9. **Prompt Template**(프롬프트 템플릿)에 에이전트 지시를 작성하세요.
10. 위쪽 막대에서 **Save**(저장)를 클릭하세요. 초록색 **Saved** 배지가 나타납니다.

이제 새 에이전트가 **Agents** 패널의 **Custom Agents**(커스텀 에이전트) 섹션에 나타납니다. 실제로 쓰려면 채팅을 열고 **Chat Settings**로 이동해 **Enable Agents**를 켠 다음, 그곳의 **Custom Agents** 섹션에서 만든 에이전트를 추가하세요.

## Pipeline Phase

**Pipeline Phase**는 에이전트가 언제 실행될지 정합니다. 버튼 3개 중 하나를 고르세요.

- **Pre-Generation**: AI가 답변하기 전에 실행됩니다. 컨텍스트를 더하거나 프롬프트를 바꿀 수 있습니다.
- **Parallel**: 답변과 동시에 실행됩니다. 완성된 답변은 볼 수 없습니다.
- **Post-Processing**: 답변이 끝난 뒤에 실행됩니다. 답변을 읽을 수 있고, 일부 결과 유형에서는 답변을 고칠 수도 있습니다.

결과 유형에 따라 단계가 자동으로 정해지기도 합니다. **Text Rewrite**를 고르면 단계가 **Post-Processing**으로 바뀌고, **Prompt Patch**를 고르면 **Pre-Generation**으로 바뀝니다. 그 일은 해당 단계에서만 의미가 있기 때문입니다.

Post-Processing으로 설정한 사용자 지정 에이전트에는 **Turn Data Access**(턴 데이터 접근) 섹션도 생깁니다. 여기에는 선택 토글 2개가 있습니다. **Pre-generation injections**(생성 전 주입)와 **Parallel agent results**(병렬 에이전트 결과)입니다. 이 토글을 켜면 같은 턴에 다른 에이전트가 만들어 낸 결과를 읽을 수 있습니다. 꺼 두면 에이전트가 다른 결과와 분리된 채로 동작합니다.

## Custom Agent Abilities

**Custom Agent Abilities**는 직접 켜야만 쓸 수 있는 능력입니다. 토글을 켜기 전까지 해당 능력은 차단됩니다. 덕분에 사용자 지정 에이전트는 기본적으로 안전합니다. 쓸 수 있는 능력은 다음과 같습니다.

| 능력 | 에이전트가 할 수 있는 일 |
|---|---|
| **Create lorebooks** | 로어 출력에 대상이 지정되어 있지 않을 때 에이전트가 새 로어북을 만듭니다. |
| **Edit lorebooks** | 로어북 항목을 쓰거나 로어북 갱신 결과를 만듭니다. |
| **Edit messages** | 생성된 메시지 텍스트를 다시 쓴 텍스트로 바꾸거나, 메시지에 이어 갈 선택지를 붙입니다. |
| **Edit trackers** | 게임, 캐릭터, 페르소나, 사용자 지정 트래커의 상태를 갱신합니다. |
| **Frontend styling** | 생성 중에 일시적인 시각 효과를 적용합니다. |
| **Change chat backgrounds** | 채팅에 선택된 배경을 바꾸고 그대로 유지합니다. |
| **Change character sprites** | 채팅에 표시되는 캐릭터와 페르소나의 표정을 바꿉니다. |
| **Control media playback** | Spotify, YouTube, 로컬 음악 재생을 제어합니다. |
| **Control haptic devices** | 연결된 햅틱 기기에 정해진 범위 안의 명령을 보냅니다. |
| **Edit About Me details** | 채팅별 About Me 텍스트를 바꿉니다. 공개 카드를 바꾸려면 별도 승인이 필요합니다. |
| **Image generation** | 이미지 프롬프트로 이미지 생성을 실행합니다. |
| **Vectors/embeddings** | 벡터나 임베딩 컨텍스트를 사용합니다. 벡터는 글자가 아니라 의미로 텍스트를 찾는 방식입니다. |
| **Main prompt edits** | 메인 AI 모델에 보내는 프롬프트를 고칩니다. |

로어북은 AI가 장면에 끌어다 쓸 수 있는 배경 설정을 모아 둔 것입니다. 트래커는 능력치, 기분, 위치 같은 정보를 실시간으로 담아 두는 패널입니다.

**Edit lorebooks**를 켜면 **Lorebook Writer**(로어북 작성) 섹션이 나타납니다. **Allow lorebook entry writes**(로어북 항목 쓰기 허용)를 켜고 **Target lorebook**(대상 로어북) 드롭다운에서 로어북 하나를 고르세요. 에이전트는 그 로어북에만 쓸 수 있습니다.

## Result Type

**Result Type**은 에이전트의 출력을 Marinara가 어떻게 읽을지 정합니다. 대부분의 결과 유형에서는 에이전트가 JSON을 반환해야 합니다. JSON은 중괄호와 큰따옴표로 쓰는 간단한 텍스트 형식입니다. 결과 유형마다 위 표에 있는 능력 중 하나가 필요합니다.

| Result Type | 하는 일 | 필요한 능력 |
|---|---|---|
| **Context Injection** | 생성 전에 텍스트를 더하거나, 생성 후에 메모를 남깁니다. | 없음 |
| **Text Rewrite** | 답변이 끝난 뒤 실행되어 메시지 텍스트를 바꿉니다. | Edit messages |
| **Lorebook Update** | 로어북 항목을 만들거나 갱신합니다. | Edit lorebooks |
| **Character Tracker** | 캐릭터 트래커(현재 등장 중인 캐릭터)를 갱신합니다. | Edit trackers |
| **Persona Stats** | 페르소나의 능력치, 상태, 인벤토리를 갱신합니다. | Edit trackers |
| **Custom Tracker** | 직접 만든 사용자 지정 트래커 필드를 교체합니다. | Edit trackers |
| **Game State** | 세계 상태에 해당하는 게임 데이터를 갱신합니다. | Edit trackers |
| **Image Prompt** | 이미지 생성 기능에 장면을 그리도록 요청합니다. | Image generation |
| **Prompt Patch** | 프롬프트 섹션을 더하거나, 앞에 붙이거나, 교체합니다. | Main prompt edits |
| **Frontend Style** | 일시적인 스타일 효과를 적용합니다. | Frontend styling |
| **Background Change** | 사용할 수 있는 채팅 배경을 골라 그대로 유지합니다. | Change chat backgrounds |
| **Sprite Change** | 채팅에 표시되는 캐릭터와 페르소나의 표정을 바꿉니다. | Change character sprites |
| **Spotify Control** | Spotify 재생을 제어합니다. | Control media playback |
| **YouTube Control** | YouTube 재생을 제어합니다. | Control media playback |
| **Local Music Control** | 컴퓨터에 있는 음악의 재생을 제어합니다. | Control media playback |
| **Haptic Command** | 연결된 햅틱 기기에 정해진 범위 안의 명령을 보냅니다. | Control haptic devices |
| **About Me Update** | 채팅별 About Me 텍스트를 갱신하고 공개 수정안을 제안합니다. | Edit About Me details |
| **Interactive Choices** | 생성된 메시지에 이어 갈 선택지를 붙입니다. | Edit messages |

처음 시작하기에 가장 편한 것은 **Context Injection**입니다. 능력 토글도 필요 없고 출력 형식 제약도 없습니다. 프롬프트에 짧은 메모를 더하거나 요약을 남기기만 하면 될 때 쓰세요.

결과 유형이 흐리게 표시된다면 아직 해당 능력을 켜지 않은 것입니다. **Custom Agent Abilities**에서 짝이 되는 토글을 켜면 그 결과 유형을 클릭할 수 있게 됩니다.

### 이미지 에이전트의 채팅별 제어

**Image generation** 능력이 있는 에이전트는 모든 사용자 지정 에이전트에 있는 프롬프트 템플릿 선택 항목과 함께 **Chat Settings → Agents → Custom Agents** 카드에 두 가지 제어 항목이 더 나타납니다.

- **Image Connection** — 이 채팅에서만 에이전트가 사용할 이미지 연결을 재정의합니다. 에이전트 자체 설정의 연결을 유지하려면 **Agent default**로 두세요. 채팅별 **Image Style**도 사용자 지정 에이전트 이미지에 적용되므로 에이전트를 복제하지 않고 채팅마다 다른 방식으로 렌더링할 수 있습니다.
- **Camera button** — 활성화 키워드를 기다리지 않고 지금 바로 해당 에이전트로 이미지를 생성합니다. 프롬프트는 여전히 에이전트가 작성하며, 템플릿이 프롬프트를 만들지 않으면 이미지 대신 오류 토스트가 표시됩니다.

## Activation Keywords

사용자 지정 에이전트는 기본적으로 정해진 주기마다 실행됩니다. **Activation Keywords**(활성화 키워드)를 쓰면 장면과 관련이 없을 때 에이전트를 건너뛸 수 있습니다. 그만큼 토큰과 비용이 절약됩니다. 토큰은 AI가 글을 세는 단위로, 글을 잘게 나눈 조각입니다.

설정 방법은 다음과 같습니다.

1. **Activation Keywords** 섹션에 키워드나 문구를 한 줄에 하나씩 입력하세요. 예를 들면 다음과 같습니다.

```
tavern
secret door
moonlit ritual
```

2. **Scan Depth**(스캔 깊이)에 검색할 최근 메시지 개수를 지정하세요. 기본값은 5이고 최대는 200입니다.
3. 이제 지정한 개수의 최근 메시지에 키워드가 하나라도 나타날 때만 에이전트가 실행됩니다.

키워드 입력란을 비워 두면 에이전트가 정해진 주기마다 매번 실행됩니다.

## 도구 연결하기(Function Calling)

에이전트는 도구를 호출할 수 있습니다. 도구는 AI가 무언가를 가져오거나 바꾸기 위해 실행한 뒤 그 결과를 다시 읽는 함수입니다. 이 방식을 function calling이라고 부릅니다.

도구를 연결하려면 **Tools / Function Calling**(도구 / 기능 호출) 섹션을 열고 도구를 하나씩 켜거나 끄세요. 목록에는 기본 제공 도구와 직접 만든 사용자 지정 도구가 모두 들어 있습니다. 도구를 직접 만드는 방법은 [사용자 지정 도구](../extending/custom-tools.md)에서 설명합니다.

도구는 채팅 자체가 허용할 때만 동작합니다. **Chat Settings**에서 **Function Calling**(기능 호출) 섹션을 열고 **Enable Tool Use**(도구 사용 활성화)를 켜세요. 이 채팅 설정을 켜지 않으면 여기서 도구를 켜 두어도 에이전트의 도구는 꺼진 상태로 남습니다.

가져온 에이전트 파일에는 도구 접근 권한이 함께 넘어오지 않습니다. 에이전트를 가져온 뒤에는 프롬프트와 설정을 확인하고, 사용할 도구를 직접 선택하세요.

## Named prompt options

에이전트 하나에 프롬프트를 여러 벌 담아 둘 수 있습니다. 이것이 **Named prompt options**(이름 붙인 프롬프트 옵션) 기능입니다. 에이전트 전체를 고치지 않고도 채팅마다 원하는 프롬프트를 고를 수 있습니다.

프롬프트를 추가하는 순서는 다음과 같습니다.

1. **Prompt Template** 아래에서 **Named prompt options**를 찾으세요.
2. **Add option**(옵션 추가)을 클릭하세요.
3. 옵션 이름과 짧은 설명을 입력하세요.
4. 그 옵션에서 쓸 프롬프트 본문 전체를 작성하세요.

누군가 이 에이전트를 채팅에 추가하면 지정해 둔 옵션이 **Prompt Mode**(프롬프트 모드) 드롭다운에 나타납니다. 옵션을 하나도 만들지 않으면 채팅 메뉴에는 기본 프롬프트만 표시됩니다.

## 그 밖에 조정할 수 있는 설정

사용자 지정 에이전트는 기본 제공 에이전트와 몇 가지 설정을 공유합니다.

- **Connection Override**(연결 재정의): 이 에이전트만 다른 AI 연결로 실행합니다. 예를 들어 뒤에서 도는 작업에는 더 저렴한 모델을 쓸 수 있습니다. 비워 두면 채팅의 연결을 그대로 씁니다.
- **Agent Budget**(에이전트 예산): **Context Size**(컨텍스트 크기)로 에이전트가 읽을 최근 메시지 개수를 정합니다(기본값 5). **Max Output Tokens**(최대 출력 토큰)로 출력에 확보할 여유를 정합니다(기본값 4096, 128에서 32768까지).
- **Add as Prompt Section**(프롬프트 섹션으로 추가): 이 설정을 켜면 에이전트의 최신 출력을 프롬프트 프리셋에 주입할 수 있는 섹션으로 쓸 수 있습니다.

`{{user}}`, `{{char}}` 같은 매크로는 **Prompt Template** 안에서 그대로 동작합니다. 전체 목록은 [매크로](../prompts/macros.md)에서 확인하세요.

## 완성 예제

모든 답변을 영국식 영어로 다시 쓰는 사용자 지정 에이전트를 처음부터 만들어 봅니다.

편집기에서의 설정입니다.

1. 이름을 `British English Editor`로 지정하세요.
2. **Custom Agent Abilities**에서 **Edit messages**를 켜세요.
3. **Result Type**에서 **Text Rewrite**를 고르세요. 단계는 저절로 **Post-Processing**으로 바뀝니다.
4. 아래 내용을 **Prompt Template**에 붙여넣으세요.

```
You are a copy editor. Rewrite the latest reply into British English.
Change spelling and vocabulary only. Do not change the meaning, tone, or events.
Return JSON with an "editedText" field holding the full rewritten reply,
and a "changes" array of short notes describing what you changed.
```

5. **Save**를 클릭하세요.
6. Roleplay 채팅을 열고 **Chat Settings**로 이동해 **Enable Agents**를 켠 다음, **Custom Agents** 섹션에서 `British English Editor`를 추가하세요.

이제 답변이 끝날 때마다 에이전트가 다음과 같은 JSON을 반환합니다.

```
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara는 `editedText`를 읽어 답변에 그대로 갈아 끼웁니다. 화면에는 영국식 영어로 바뀐 메시지가 표시됩니다. `changes`에 담긴 메모는 에이전트가 무엇을 고쳤는지 알려 주는 짧은 요약으로 나타납니다.

## 에이전트 가져오기와 내보내기

만든 사용자 지정 에이전트는 파일로 공유할 수 있습니다.

편집기에서 내보내려면 위쪽 막대의 **Export agent**(에이전트 내보내기) 버튼(업로드 아이콘)을 클릭하세요. 에이전트의 프롬프트와 설정이 패키지로 저장됩니다. 에이전트 패키지에는 사용자 지정 도구 정의가 절대 들어가지 않습니다.

여러 에이전트를 한 번에 내보내려면 **Agents** 패널에서 **Select agents**(에이전트 선택)로 원하는 에이전트를 고른 뒤 한꺼번에 내보내세요.

외부 에이전트 가져오기는 기본적으로 잠겨 있습니다. 먼저 **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)을 열고 **Allow custom Agent imports**(사용자 지정 에이전트 가져오기 허용)를 활성화하세요. 이 토글을 켜는 데 `.env` 수정은 필요 없습니다. 이 설정은 파일, 폴더, 사용자 지정 저장소로 들어오는 에이전트에만 적용됩니다. Marinara에서 직접 만든 에이전트와 **Download Agents**(에이전트 다운로드)로 설치한 공식 에이전트는 평소대로 쓸 수 있습니다.

가져오려면 **Agents** 패널을 열고 파일 하나는 **Import agents**(에이전트 가져오기), 폴더 전체는 **Import agent folder**(에이전트 폴더 가져오기)를 클릭하세요. 저장하기 전에 Marinara가 권한 검토 화면을 보여 줍니다. 그 에이전트에 꼭 필요한 기능만 승인하세요. 체크하지 않은 기능은 계속 차단됩니다. 파일로 가져온 에이전트는 매번 새로운 사용자 지정 식별자를 받으므로, 내부 유형이 같은 공식 에이전트를 덮어쓸 수 없습니다.

안전을 위해 Marinara는 패키지에 딸려 온 함수를 무시하고, 가져온 설정에서 도구 선택을 지우고, 임시 CSS를 적용하기 전에 정리하며, 가져온 에이전트가 메시지, 트래커, 로어북, 배경, 스프라이트, 미디어, 햅틱, About Me 데이터, 프롬프트, 생성된 이미지를 바꾸기 전에 승인된 기능인지 확인합니다. 믿을 수 있는 함수는 **Function Calls**에서 따로 가져와 내용을 검토한 뒤, 직접 에이전트에 연결하세요. Danger Zone 토글을 다시 끄면 외부에서 가져온 에이전트는 실행되지 않습니다. 직접 만든 에이전트와 공식 에이전트는 영향을 받지 않습니다.

## 관련 가이드

- [에이전트: 채팅을 도와주는 AI](agents-overview.md)
- [다운로드 가능한 에이전트 레퍼런스](built-in-agents.md)
- [사용자 지정 도구](../extending/custom-tools.md)
- [매크로](../prompts/macros.md)
