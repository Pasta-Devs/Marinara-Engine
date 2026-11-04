# 조건부 프롬프트({{#if}})

`{{#if}}` 블록은 조건이 참일 때만 일부 프롬프트 문구를 넣습니다. 공용 프리셋 하나에 캐릭터, 페르소나, 채팅마다 다른 지시를 담거나, 비어 있는 필드를 빼는 데 쓰세요. 조건 블록은 매크로 기능의 일부이므로 [매크로](macros.md)가 동작하는 곳이면 어디서든 동작합니다. 캐릭터 카드, 페르소나, 로어북 항목, 프리셋이 모두 해당합니다.

Marinara는 프롬프트를 만들 때마다 조건을 확인해 맞는 문구를 남기고 나머지는 버립니다. 고급 기능이며, 대부분의 채팅에는 필요하지 않습니다.

## 기본 문법

블록은 `{{#if condition}}`으로 시작해서 `{{/if}}`로 끝납니다. 거짓일 때를 위해 `{{else}}`를 넣고, 조건을 더 이어 붙이려면 `{{else if}}`를 쓰세요. Marinara는 위에서 아래로 각 분기를 확인하고 참인 첫 번째 분기를 남깁니다. 참인 분기가 하나도 없고 `{{else}}`도 없으면 블록은 빈 내용이 됩니다.

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

블록은 한 줄로 써도 되고 여러 줄로 써도 되며, 블록 안에 다른 블록을 넣을 수도 있습니다.

## 연산자

조건은 보통 `char == "Alice"`처럼 왼쪽 값, 연산자, 오른쪽 값으로 이루어집니다.

| 연산자 | 뜻 |
| --- | --- |
| `==`, `=`, `is` | 같습니다. |
| `!=`, `is not` | 같지 않습니다. |
| `>`, `<`, `>=`, `<=` | 더 큼, 더 작음, 크거나 같음, 작거나 같음입니다(숫자만). |
| `contains`, `includes` | 왼쪽 값이 오른쪽 값을 문자열로 포함합니다. |
| `not contains`, `not includes` | 왼쪽 값이 오른쪽 값을 포함하지 않습니다. |

비교 규칙은 다음과 같습니다.

1. 동등 연산자에서는 양쪽이 모두 숫자처럼 보이면 Marinara가 숫자로 비교하므로 `5`와 `5.0`은 같습니다. 그렇지 않으면 대소문자를 무시하고 문자열로 비교하므로 `Mari`와 `mari`는 같습니다.
2. `>`, `<`, `>=`, `<=`는 양쪽이 모두 숫자여야 합니다. 그렇지 않으면 조건은 거짓입니다.
3. `contains`와 `includes`는 대소문자를 무시하므로 `contains "dr"`은 `Dr Smith`에 맞습니다.

### 조건 묶기

OR에는 `||`를, AND에는 `&&`를 쓰세요. `&&`가 `||`보다 먼저 처리됩니다. 순서를 정하려면 괄호를 쓰세요.

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

한 값에 대해 같음 선택지를 여러 개 비교할 때는 반복되는 왼쪽 값을 생략할 수 있습니다. `character == "Maukie" || "Pantalone"`처럼 씁니다. 이 표기는 `==`, `=`, `is`에서 동작합니다. `&&`의 양쪽에는 조건을 온전히 쓰세요.

### truthy 검사

연산자가 없는 조건은 값에 실제 내용이 있을 때 참입니다. 값이 비어 있거나, 대소문자와 관계없이 `false`, `0`, `no`, `off`, `null`, `undefined` 중 하나이면 거짓입니다.

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### 비교할 수 있는 대상

조건의 양쪽에는 다음을 쓸 수 있습니다.

1. 필드나 신원 키워드. `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, `model`, `reasoning` 등이 있습니다. 같은 이름의 매크로와 같은 값을 읽습니다. `group`은 지금 답하는 캐릭터를 뺀 나머지 활성 캐릭터를 나열합니다.
2. `"Alice"` 같은 따옴표로 감싼 리터럴.
3. `length` 같은 프리셋 변수 이름. [프리셋 변수](preset-variables.md)를 참고하세요.
4. `var:name` 또는 `var.name`으로 쓰는 명시적 변수 조회.
5. 다른 매크로. 먼저 값을 구합니다.
6. Decision 모델에 하는 질문. `decision:"..."` 또는 `decision_choice:"..."`로 씁니다. [Decision 모델에 묻기](#asking-the-decision-model)를 참고하세요.

키워드가 아닌 낱말을 따옴표 없이 쓰면 변수 이름으로 처리합니다. 그런 이름의 변수가 없으면 일반 텍스트로 씁니다. 혼동을 피하려면 리터럴 값에 따옴표를 붙이세요.

### 따옴표 규칙

정해진 문구는 곧은 큰따옴표나 곧은 작은따옴표로 감싸세요. 따옴표 안에서는 백슬래시로 따옴표를 이스케이프하고, 줄바꿈은 `\n`으로 적으세요. `"Dr Smith"`처럼 공백이 들어간 리터럴에는 반드시 따옴표를 붙이세요. 따옴표 없이 여러 낱말을 적으면 변수 이름 하나로 읽힙니다.

## 캐릭터가 여럿일 때 쓰는 그룹 블록

캐릭터가 둘 이상인 그룹 채팅에서는 그룹 블록이 문구를 캐릭터마다 한 번씩 반복합니다. `[` 하나만 있는 줄, 문구, `]` 하나만 있는 줄 순서로 쓰세요. 블록 안에는 `{{char}}`나 `{{description}}` 같은 캐릭터 매크로나, 캐릭터를 따지는 조건이 있어야 합니다.

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Alice와 Bob이 있으면 블록은 캐릭터마다 한 번씩, 두 번 실행됩니다. 그룹 블록 바깥에서는 캐릭터 매크로가 현재 캐릭터나 주 캐릭터에만 대응합니다. 캐릭터가 하나인 채팅에서는 `[`와 `]` 줄이 일반 텍스트로 남습니다.

## 예시

캐릭터마다 말투를 다르게 하는 예시입니다.

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

필드가 채워져 있을 때만 넣는 예시입니다. **Backstory**(배경 이야기)가 비어 있으면 블록이 빈 내용이 되므로 빈 라벨이 전달되지 않습니다.

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

한 모델 계열에만 주는 지시입니다. `model`은 `claude-opus-5-5` 같은 모델 ID이므로 `contains`는 모든 Opus 버전과 일치하고 `==`는 정확히 한 모델과만 일치합니다.

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

추론 여부에 따라 달라지는 계획 지시입니다. 추론이 어떤 수준으로든 켜져 있으면 모델은 첫 번째 줄을 받습니다. 추론이 꺼져 있으면 `{{reasoning}}`은 `off`이고 거짓으로 읽힙니다. 특정 수준에서만 동작하게 하려면 `{{#if reasoning == "max"}}`처럼 비교하세요.

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

<a id="asking-the-decision-model"></a>

## Decision 모델에 묻기

조건은 채팅에서 무슨 일이 일어나고 있는지 Decision 모델에 물을 수 있습니다. Decision 모델은 최근 메시지 몇 개와 직접 작성한 문장을 읽고 그 문장이 참인지 답하는 작은 모델입니다. 채팅에는 아무것도 쓰지 않습니다. 덕분에 프리셋, 카드, 로어북 항목, 에이전트 프롬프트가 해당하는 턴에만 지시를 보낼 수 있습니다.

시작하기 전에: **Connections**(연결) 패널의 **Decision model**(결정 모델)에서 Decision 모델을 고르세요. 개념과 선택 방법은 [Decision 모델](../connections/decision-models.md)을 참고하세요. 로어북 항목 전체의 활성화 여부를 정하려면 대신 항목의 [Decision](../lorebooks/entries.md#decision-activation) 필드를 사용하세요.

활용 예로는 장면이 이동했을 때만 새 장소 묘사하기, 전투 중에만 전투 진행 규칙 불러오기, 천천히 진전되는 프리셋에서 관계 고조 보류하기, 그룹 블록에서 말을 건넨 캐릭터만 직접 답하게 하기가 있습니다.

### 예 또는 아니요: `decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Decision 모델이 문장이 참이라고 답하면 조건이 참입니다. `{{else}}`, `&&`, `||`, 괄호, 중첩, 그룹 블록과 함께 쓸 수 있습니다. 문장 안의 매크로를 먼저 채우므로 `{{user}}`와 `{{char}}`를 쓸 수 있습니다. 그룹 블록에서 `{{char}}`를 가리키는 문장은 캐릭터마다 한 번씩 묻습니다.

### 여러 답 중 하나: `decision_choice:`

`decision_choice:`는 모델에 옵션 하나를 고르게 합니다. 옵션은 이 조건과 비교하는 값입니다.

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

모델은 "angry", "sad", "none of these" 중에서 고릅니다. 문장은 주제로, 옵션은 짧은 답으로 작성하세요. 축약형 `== "rain" || "snow"`는 두 옵션을 모두 제시합니다.

옵션이 이야기에서 무엇을 뜻하는지 알려 주려면 옵션 뒤에 콜론으로 구분해 기준을 덧붙이고, 두 부분을 같은 종류의 따옴표로 감싸세요. `== "angry":"Kaelen raises his voice, makes threats or breaks something"`처럼 씁니다. 모델의 답은 여전히 "angry"입니다. 한 옵션에 여러 곳에서 서로 다른 기준을 주면 처음 것을 사용합니다.

<a id="sticky-and-cooldown"></a>

### Sticky와 Cooldown

매 턴 묻는 대신 몇 턴 동안 답을 유지하려면 문장 뒤에 `sticky:`와 `cooldown:`을 붙이세요.

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N`: 예라고 답한 뒤 그 문장은 N턴 동안 묻지 않아도 예로 유지됩니다.
- `cooldown:N`: sticky가 끝날 때 또는 예 직후에 시작합니다. N턴 동안 문장은 아니요로 읽히고 묻지 않습니다.
- 턴은 Decision 모델이 읽는 새 메시지 하나입니다. 같은 메시지의 재생성이나 스와이프는 같은 턴이므로 다시 뽑아도 타이머가 줄지 않습니다.
- 유지 중인 문장은 묻지 않으며 **Decision statements per turn**(턴당 판단문 수)에 포함되지 않습니다.
- `decision_choice:`에서 sticky는 선택한 옵션을 유지하고 cooldown은 모든 비교를 아니요로 읽습니다.
- 여러 곳에 쓴 같은 문장은 가장 긴 sticky와 cooldown을 사용합니다.
- Peek Prompt는 유지 중인 답을 보여 주며 타이머를 진행시키지 않습니다.

**Decision**(결정) 필드로 활성화하는 로어북 항목에는 대신 항목 자체의 **Sticky**(유지)와 **Cooldown**(쿨다운)을 사용하세요.

<a id="until-and-while"></a>

### Until과 While

어떤 상황이 이어지는 동안 블록을 켜 두려면 두 번째 문장과 함께 `until:`이나 `while:`을 붙이세요.

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- 예라고 답하면 블록이 켜진 상태로 유지됩니다. 첫 번째 문장은 묻지 않습니다. 대신 매 턴 `until` 문장을 묻고, 그 문장이 참인 턴에 블록이 꺼집니다.
- `while:`은 반대로 동작합니다. 블록은 그 문장이 참인 동안 켜져 있고, 거짓이 되면 꺼집니다.
- 둘 중 하나만 쓰세요. 둘 다 쓰면 먼저 쓴 것만 적용됩니다.
- 블록이 꺼지면 평소처럼 cooldown이 시작됩니다. 어떤 턴에 답이 없으면 블록은 켜진 상태로 유지됩니다.
- `until`이나 `while` 문장은 **Decision statements per turn**에 포함됩니다. 블록이 켜져 있는 동안 첫 번째 문장은 포함되지 않습니다.
- 이 기능은 `decision:`에서 동작하며 `decision_choice:`에서는 동작하지 않습니다.

**sticky**와 함께 쓸 때는 두 번째 문장 뒤에 `:and`(또는 `:restrict`)나 `:or`(또는 `:extend`)를 붙여 둘이 어떻게 결합할지 정하세요.

| 작성 형태 | 예라고 답한 뒤 블록이 켜져 있는 기간 |
| --- | --- |
| `until:"..." sticky:5` 또는 `until:"...":and sticky:5` | 최대 5턴 더 켜져 있으며, until 문장이 참이면 그보다 일찍 꺼집니다. |
| `until:"...":or sticky:5` | 최소 5턴 더 켜져 있고, 그 뒤에는 until 문장이 참이 될 때까지 켜져 있습니다. |
| `while:"..." sticky:5` 또는 `while:"...":or sticky:5` | 최소 5턴 더 켜져 있고, 그 뒤에는 while 문장이 참인 동안 켜져 있습니다. |
| `while:"...":and sticky:5` | 최대 5턴 더 켜져 있으며, while 문장이 거짓이면 그보다 일찍 꺼집니다. |

<a id="checking-every-few-turns"></a>

### 몇 턴마다 확인하기

N턴마다 한 번만 문장을 물으려면 `every:N`을 붙이세요.

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- 처음 도달한 턴에 묻고, 3턴 뒤에 다시 묻는 식으로 이어집니다. 확인 사이에는 아니요로 읽히고, 묻지 않으며, **Decision statements per turn**에 포함되지 않습니다.
- 재생성이나 스와이프는 일정을 진행시키지 않습니다.
- sticky와 cooldown은 여전히 답을 유지합니다. `every:`는 유지되지 않는 문장을 언제 물을지만 정합니다.
- 여러 곳에 쓴 같은 문장은 가장 작은 `every:`를 사용합니다.

<a id="priority"></a>

### 우선순위

프롬프트 계획의 문장이 **Decision statements per turn** 허용량보다 많으면 `priority:high`나 `priority:low`가 어떤 문장을 물을지 정합니다. 우선순위를 지정하지 않으면 중간입니다.

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- high 문장을 먼저, low 문장을 마지막에 묻습니다. 같은 우선순위 안에서는 프롬프트에 나오는 순서로 정합니다.
- 한도를 넘은 문장은 가장 낮은 우선순위부터 아니요로 읽히며, Peek Prompt에 나열됩니다.
- 여러 곳에 쓴 같은 문장은 가장 높은 우선순위를 사용합니다.
- 프롬프트 자체의 문장(프리셋, 카드, 페르소나, 작가 노트)을 먼저 계획합니다. 로어북 문장은 우선순위와 관계없이 남은 슬롯을 사용합니다.

모든 수식자를 어떤 순서로든 조합할 수 있습니다. `decision:"..." priority:high sticky:3 cooldown:5 every:2`처럼 씁니다.

### 답 없음은 아니요

답이 없으면 판정 조건은 언제나 거짓입니다. Decision 모델이 설정되지 않았거나, 시간 안에 답하지 못했거나, 실패한 경우입니다. `decision_choice:`에서는 모든 비교가 거짓입니다. 이를 전제로 설계하세요.

- 판정은 지침을 추가하거나 줄이는 데 쓰고, 이야기에 꼭 필요한 내용을 담는 데는 절대 쓰지 마세요.
- 모든 판정 블록에 기본값을 주세요. 아무것도 넣지 않거나, 어떤 턴에도 괜찮은 `{{else}}`를 쓰세요.
- 오답 하나가 다른 여러 판정을 바꾸도록 판정을 연결하지 마세요.
- 동의, 콘텐츠 경고, 안전 지침을 판정 조건에 걸지 마세요.

어떤 모델이든 틀리게 답할 수 있습니다. 특정 제품 하나가 아니라 "Decision 모델"을 기준으로 작성하세요.

<a id="writing-statements"></a>

### 판정문 작성하기

- 보고서의 한 줄처럼 참이나 거짓인 사실을 진술하세요. 질문("Did the scene change?")이나 지시("If the scene changed, describe it")로 쓰지 마세요. 작은 모델은 지시에 아니요로 답하는 경우가 많아 블록이 실행되지 않습니다.
- 이번 턴을 뜻한다면 "in the latest message"라고 쓰세요. 모델은 메시지를 여러 개 읽으므로 이전 메시지 때문에 예라고 답할 수 있습니다.
- 누구에 관한 내용인지 명시하세요. "He is angry"는 엉뚱한 캐릭터로 읽힐 수 있습니다.
- 행동이나 대사처럼 텍스트에 드러난 것을 설명하세요. 분위기를 나타내는 말("The scene is intense")이나 숨은 의도("Mira is lying")는 피하세요.
- 짧게 쓰세요. 재사용하거나 디버깅하고 싶다면 긴 문장을 여러 부분으로 나누세요.

표현을 시험하는 방법은 다음과 같습니다.

1. **Decision model**에서 모델을 고르고 **Test**(테스트)를 클릭하세요. 고정 샘플로 연결을 확인할 뿐이며 직접 쓴 문장은 시험하지 않습니다.
2. 프롬프트에 문장을 추가하고, 문장이 참이어야 하는 메시지와 거짓이어야 하는 메시지를 보내세요.
3. **Peek Prompt**(프롬프트 미리보기)로 어떤 분기가 전송됐는지 확인하세요. **Decision diagnostics**(결정 진단)를 연 다음 **Test decisions**(결정 테스트)를 선택하면 답글을 생성하지 않고 새 답을 받을 수 있습니다. 호스팅 테스트에는 비용이 들 수 있습니다. [Decision 문 테스트](../chats/peek-prompt.md#testing-decision-statements)를 참고하세요.
4. 문구를 고친 뒤 다시 테스트하세요. 실제 생성에서 나온 답을 보려면 Debug Mode나 [디버그 로그](../CONFIGURATION.md#logging-levels)를 켜세요.

<a id="limits-and-cost"></a>

### 제한과 비용

<a id="statement-allowance"></a>

#### 판정문 허용량

**Decision model** 아래의 **Decision statements per turn**은 기본값이 32입니다. 모든 Decision 요청이나 지출에 적용되는 단일 한도가 아닙니다. Marinara는 이 값을 단계별로 적용합니다.

1. 주 채팅 프롬프트의 문장을 허용량 안에서 계획합니다. 로어북 판정은 남은 몫을 사용합니다.
2. 답글 전이나 답글과 함께 실행되는 에이전트는 주 프롬프트와 합친 계획을 받으며, 허용량을 다시 사용합니다. 이 단계는 로어북 사용량을 빼지 않으므로 총량이 설정값을 넘을 수 있습니다.
3. 후처리 에이전트는 답글 뒤에 별도의 허용량을 받습니다.

에이전트 활성화 질문과 Smart 응답 순서는 이 설정과 별개입니다.

각 단계의 계획에는 그 단계가 사용할 수 있는 문장만 들어갑니다. 활성화된 프리셋 섹션과 그룹, 선택한 변수 옵션, 활성화된 로어북 항목의 내용입니다. 고정 조건은 문장을 제외할 수 있습니다. 예를 들어 캐릭터가 Mira일 때 `{{#if char == "Dottore" && decision:"..."}}`의 문장은 제외됩니다. 변수 조건은 제외하지 않습니다. 프롬프트를 만드는 동안 변수가 바뀔 수 있기 때문입니다. sticky, cooldown, `every:`가 유지하는 문장은 슬롯을 쓰지 않습니다. 빠진 문장은 아니요로 읽힙니다.

#### 요청과 시간

호스팅된 Decision 계정에서는 한 턴에 유료 요청이 여러 번 발생할 수 있습니다. 문장을 묶어 보낼 수 있지만, 로어북 활성화, 새로 활성화된 항목의 내용, 재귀 일치, 에이전트 단계에는 묶음이 더 필요할 수 있습니다. 로컬 채팅 모델은 요금 대신 처리 시간이 늘어나며, `decision_choice:`에는 옵션마다 예/아니요 질문 하나로 답합니다.

요청마다 시간 제한이 있습니다. 기본값은 호스팅된 Decision 계정이 1.5초, OpenAI 호환 채팅 모델 계정이나 로컬 모델이 4초입니다. [시간 제한](../connections/decision-models.md#time-limits)을 참고하세요. 로컬 추론 모델은 **Also gate agents that run before the reply**(답글 전에 실행되는 에이전트도 판정)를 켜지 않으면 답글 전에는 판정을 보류합니다.

<a id="answer-reuse"></a>

#### 답 재사용

Marinara는 보통 같은 턴과 같은 Decision 모델에 대해 성공한 답을 재사용하므로, 재생성하면 새 요청 없이 같은 분기를 보내는 경우가 많습니다. 캐시는 실행 중인 서버에 있으며 최대 200턴을 보관합니다. 재시작, 캐시 제거, 최신 메시지의 추가나 편집, 다른 모델, 바뀐 문장이나 옵션 집합이 있으면 새 답이 필요할 수 있습니다.

없거나 실패한 답은 캐시하지 않으므로, 다시 시도하면 다시 묻고 다른 분기를 고를 수 있습니다. 에이전트 프롬프트의 문장도 같은 규칙을 따릅니다. 에이전트를 수동으로 다시 실행하면 해당 입력에 대해 아직 캐시에 있는 답을 재사용합니다. [에이전트 프롬프트의 판정문](../agents/custom-agents.md#decision-statements-in-the-agents-prompt)을 참고하세요.

<a id="prompt-caching"></a>

#### 프롬프트 캐시

제공자의 프롬프트 캐시는 Marinara의 답 캐시와 별개입니다. 채팅 모델에 보내는 프롬프트에서 바뀌지 않은 앞부분을 재사용할 수 있습니다. 판정 분기가 바뀌면 그 지점부터는 재사용되지 않을 수 있지만, 그보다 앞의 바뀌지 않은 부분은 여전히 대상이 될 수 있습니다. 과금은 제공자에 따라 다릅니다.

자주 바뀌는 판정 블록은 기록 뒤 지침이나 얕은 깊이의 작가 노트처럼 프롬프트 뒤쪽에 두세요. 답이 거의 바뀌지 않는 판정만 앞쪽에 두세요. 프리셋 변수 옵션도 같습니다. 그 텍스트는 `{{name}}`이 있는 곳에 들어가기 때문입니다.

직접 연결한 Anthropic 계정에서 **Enable prompt caching**(프롬프트 캐싱 활성화)을 켜면 Marinara는 시스템 프롬프트의 끝과, 최신 메시지에서 **Cache depth**(캐시 깊이)만큼 거슬러 올라간 채팅 메시지(기본 5개)에 표시를 합니다. 기록보다 앞에서 바뀐 내용은 시스템 경계와 그 뒤의 기록을 무효화할 수 있습니다. 표시된 기록 경계 뒤의 변경은 캐시된 부분을 유지할 수 있습니다. 최소 캐시 길이는 모델마다 다릅니다. 제공자의 최신 [Anthropic 프롬프트 캐시 가이드](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)나 [OpenAI 프롬프트 캐시 가이드](https://developers.openai.com/api/docs/guides/prompt-caching)를 참고하세요.

<a id="when-a-decision-branch-never-appears"></a>

### 판정 분기가 나타나지 않을 때

가능성이 높은 원인은 다음 순서입니다.

1. Decision 모델이 설정되지 않았습니다. 모든 판정 조건이 거짓입니다. 편집기는 판정을 사용하는 필드 아래에 경고를 표시합니다.
2. Decision 모델이 답하지 않습니다. 호스팅 계정의 잘못된 키, 크레딧 부족, 요청 제한, 중지됐거나 너무 느린 로컬 모델, 시작하지 못한 설치형 판정 모델 등이 원인입니다.
3. 답글 전에는 판정을 보류하는 추론 모델입니다.
4. 계획 단계의 문장이 너무 많아 허용량을 넘었습니다.
5. 답은 하지만 임계값에 미치지 못합니다. 보통 표현이 원인입니다.

**Test**가 무엇을 보고하는지 확인하고, **Peek Prompt**로 전송된 분기를 보세요. Peek Prompt는 아직 답이 없는 문장을 나열하며, 이런 문장은 아니요로 읽힙니다. 로그 레벨이 debug이면 각 문장, 그 답, 예로 읽혔는지가 기록됩니다. [로그 레벨](../CONFIGURATION.md#logging-levels)을 참고하세요. 프리셋 자체를 고쳐야 하는 경우는 드뭅니다. 보통 표현이나, 프롬프트에 꼭 필요한 내용을 담은 분기가 문제입니다.

## 관련 가이드

- [Decision 모델](../connections/decision-models.md)
- [프롬프트 매크로](macros.md)
- [프리셋 변수](preset-variables.md)
- [그룹 채팅과 여럿이 나누는 대화](../chats/group-chats.md)
