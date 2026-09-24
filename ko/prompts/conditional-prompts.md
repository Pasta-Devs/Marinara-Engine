# 조건부 프롬프트({{#if}})

이 가이드에서는 Marinara Engine의 `{{#if}}` 블록을 쓰는 방법을 설명합니다. 조건 블록을 쓰면 정해 둔 규칙에 값이 맞을 때만 특정 프롬프트 문구를 넣을 수 있습니다. 조건 블록은 매크로 기능의 일부라서 매크로가 동작하는 곳이면 어디서든 쓸 수 있습니다. 캐릭터 카드, 페르소나, 로어북 항목, 프롬프트 프리셋 모두 해당합니다.

## 조건부 프롬프트가 하는 일

매크로는 `{{double-brace}}`로 감싼 자리 표시자이고, Marinara Engine이 프롬프트를 만들 때 실제 값으로 바꿔 넣습니다. 조건 블록은 여기서 한 걸음 더 나아갑니다. 값을 확인한 다음 문구 하나만 남기고 나머지는 버립니다.

조건, 조건이 참일 때 쓸 문구, 그리고 필요하다면 거짓일 때 쓸 문구를 적습니다. Marinara는 프롬프트를 만들 때마다 조건을 다시 읽습니다. 즉, 같은 카드나 프리셋이라도 캐릭터, 페르소나, 채팅에 따라 다르게 동작합니다.

자주 쓰는 방법 하나는 공용 프리셋 하나 안에 캐릭터별 지시를 담아 두는 것입니다. 또 하나는 내용이 있는 필드만 넣어서 빈 라벨이 모델에 전달되지 않게 하는 것입니다.

## 기본 문법

조건 블록은 `{{#if condition}}`으로 시작해서 `{{/if}}`로 끝납니다. 그 사이의 내용이 조건이 참일 때 쓰이는 문구입니다.

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

거짓일 때를 위해 `{{else}}` 분기를 넣을 수 있습니다.

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

`{{else if}}`로 조건을 더 이어 붙일 수도 있습니다. Marinara는 위에서 아래로 각 분기를 차례로 확인합니다. 조건이 참인 첫 번째 분기만 남기고 그 안의 매크로를 처리한 뒤, 나머지 분기는 모두 버립니다. 참인 조건이 하나도 없고 `{{else}}`도 없으면 블록 전체가 빈 내용이 됩니다.

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

블록은 위 예시처럼 여러 줄로 써도 되고 한 줄로 써도 됩니다. 큰 조건 블록의 한 분기 안에 다른 조건 블록을 넣는 것도 가능합니다.

## 사용할 수 있는 연산자

조건은 보통 왼쪽 값, 연산자, 오른쪽 값으로 이루어집니다. `char == "Alice"`가 그런 예입니다. 아래 표에 쓸 수 있는 연산자를 모두 정리했습니다. 각 연산자는 코드 서식으로 표시했습니다.

| 연산자 | 뜻 |
| --- | --- |
| `==`, `=`, `is` | 같습니다. |
| `!=`, `is not` | 같지 않습니다. |
| `>` | 더 큽니다(숫자만). |
| `<` | 더 작습니다(숫자만). |
| `>=` | 크거나 같습니다(숫자만). |
| `<=` | 작거나 같습니다(숫자만). |
| `contains`, `includes` | 왼쪽 값이 오른쪽 값을 문자열로 포함합니다. |
| `not contains`, `not includes` | 왼쪽 값이 오른쪽 값을 포함하지 않습니다. |

비교 방식은 다음 규칙을 따릅니다.

1. `==`, `=`, `is`, `!=`, `is not`은 양쪽이 모두 숫자처럼 보이면 숫자로 비교합니다. 그래서 `5`와 `5.0`은 같습니다. 그렇지 않으면 대소문자를 무시하고 문자열로 비교합니다. 그래서 `Mari`와 `mari`는 같습니다.
2. `>`, `<`, `>=`, `<=`는 양쪽이 모두 숫자여야 합니다. 한쪽이라도 숫자가 아니면 조건은 거짓입니다.
3. `contains`, `includes`, `not contains`, `not includes`는 대소문자를 구분하지 않습니다. 그래서 `contains "dr"`은 `Dr Smith`라는 문자열에 맞습니다.

## OR와 AND로 조건 묶기

둘 중 하나만 맞아도 될 때는 `||`를, 모든 조건이 맞아야 할 때는 `&&`를 씁니다.

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

`&&`가 `||`보다 먼저 처리됩니다. 순서를 직접 정하고 싶을 때는 괄호를 넣으세요.

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

같은 값에 대해 여러 선택지를 비교할 때는 `||` 뒤에서 반복되는 왼쪽 값을 생략해도 됩니다.

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

이 줄임 표기는 `character == "Maukie" || character == "Pantalone"`과 같은 뜻입니다. 등호 연산자 `==`, `=`, `is`에만 적용됩니다. `&&`의 양쪽에는 조건을 온전히 다 쓰세요. 값 하나가 서로 다른 선택지 둘과 동시에 같아지는 경우는 거의 없기 때문입니다.

### truthy 검사(연산자 없음)

연산자 없이 값만 적으면 Marinara는 truthy 검사를 합니다. 이 값에 실제 내용이 들어 있는지만 따지는 간단한 확인입니다.

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

truthy 검사는 값이 비어 있지 않고 `false`, `0`, `no`, `off`, `null`, `undefined` 중 어느 것도 아닐 때 참이 됩니다. 이 단어 비교는 대소문자를 구분하지 않습니다. 어떤 필드가 채워져 있을 때만 문구를 넣고 싶다면 truthy 검사를 쓰세요.

### 비교할 수 있는 대상

조건의 왼쪽이나 오른쪽에는 다음을 쓸 수 있습니다.

1. 필드나 신원 키워드. `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, `model` 등이 있습니다. 같은 이름의 매크로와 똑같은 값을 읽습니다. `group`은 지금 답하는 캐릭터를 뺀 나머지 활성 캐릭터를 나열합니다.
2. 따옴표로 감싼 리터럴. `"Alice"`가 그런 예입니다.
3. 프리셋 변수 이름. `length`가 그런 예입니다. 프리셋 변수는 프롬프트 프리셋에서 직접 이름을 붙여 정의한 값입니다. [프리셋 변수](preset-variables.md)를 참고하세요.
4. `var:name` 또는 `var.name` 형태로 명시한 변수 조회.
5. 다른 매크로. 먼저 값을 구한 다음 비교합니다.
6. `decision:"..."` 또는 `decision_choice:"..."`로 작성하는 Decision 모델 질문입니다. [Decision 모델에 묻기](#asking-the-decision-model)를 참고하세요.

키워드가 아닌 낱말을 따옴표 없이 적으면 Marinara는 그것을 변수 이름으로 봅니다. 그런 이름의 변수가 없으면 그 낱말 자체를 문자열로 씁니다. 리터럴 값에 따옴표를 붙이면 이런 혼동이 없으니, 헷갈릴 때는 따옴표를 쓰세요.

## 따옴표 규칙

정해진 문구와 비교할 때는 따옴표로 감싸세요. 그래야 Marinara가 키워드나 변수가 아니라 있는 그대로의 리터럴로 처리합니다.

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

곧은 큰따옴표와 곧은 작은따옴표 모두 쓸 수 있습니다. Marinara는 굽은(활자용) 따옴표도 받아 주지만, 곧은 따옴표가 가장 안전하고 앱 안의 모든 예시와도 일치합니다. 따옴표 안에서는 백슬래시로 따옴표를 이스케이프할 수 있고, 줄바꿈은 `\n`으로 적을 수 있습니다.

`"Dr Smith"`처럼 공백이 들어간 리터럴에는 반드시 따옴표를 붙이세요. 따옴표 없이 여러 낱말을 적으면 통째로 변수 이름 하나로 읽히는데, 의도한 결과인 경우는 거의 없습니다.

## 캐릭터가 여럿일 때 쓰는 그룹 블록

캐릭터가 둘 이상인 그룹 채팅에서는 그룹 블록이 같은 문구를 캐릭터 수만큼 반복합니다. 덕분에 블록 하나만 써도 장면에 있는 모든 캐릭터를 설명할 수 있습니다.

그룹 블록은 `[` 하나만 있는 줄로 시작하고, 그 아래에 문구를 적은 뒤, `]` 하나만 있는 줄로 끝냅니다. 블록 안에는 `{{char}}`나 `{{description}}` 같은 캐릭터 매크로가 있거나, `{{#if char == "Alice"}}`처럼 캐릭터를 따지는 조건이 있어야 합니다. 그러면 Marinara가 캐릭터마다 블록을 한 번씩 반복하면서 캐릭터 매크로를 차례로 그 캐릭터의 값으로 채웁니다.

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Alice와 Bob이 있는 그룹 채팅이라면 이 블록은 두 번 실행됩니다. 첫 번째에는 Alice의 이름이 들어가고 Alice에 맞는 분기가 선택됩니다. 두 번째에는 Bob의 이름이 들어가고 Bob에 맞는 분기가 선택됩니다. 그룹 블록 바깥에서는 캐릭터 매크로가 현재 캐릭터 또는 주 캐릭터 하나에만 대응합니다.

그룹 블록은 캐릭터가 둘 이상인 채팅에서만 펼쳐집니다. 캐릭터가 하나뿐인 채팅에서는 `[`와 `]` 줄이 그냥 글자 그대로 남습니다.

## 적용 예시(적용 전과 후)

모델이 실제로 받는 결과까지 보여 주는 예시 3가지입니다.

공용 프리셋 안에서 캐릭터별로 말투를 다르게 하기.

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

캐릭터 이름이 `Dottore`이면 모델은 `Speak in a cold, clinical tone.`을 받습니다. 그 밖의 캐릭터에게는 `Speak warmly and casually.`가 전달됩니다.

내용이 채워져 있을 때만 필드 넣기.

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

캐릭터에 **Backstory**(배경 이야기)가 있으면 모델은 그 배경 이야기가 들어간 줄을 받습니다. **Backstory** 입력란이 비어 있으면 블록 전체가 빈 내용이 되므로 빈 라벨은 전달되지 않습니다.

이름 일부만 맞춰서 판단하기.

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

페르소나 이름에 `Dr`이 들어 있으면 모델은 Doctor라고 부르라는 지시를 받습니다. 들어 있지 않으면 블록은 빈 내용이 됩니다.

<a id="asking-the-decision-model"></a>

## Decision 모델에 묻기

조건은 채팅에서 일어나는 일을 **Decision model**(판정 모델)에 물을 수도 있습니다. Connections 패널의 **Decision model**에서 선택한 모델, 즉 이미 실행 중인 로컬 모델, 호스팅된 Decision 연결 또는 설치한 판정 모델을 사용합니다. 최근 메시지와 작성한 문장을 읽고 그 문장이 참인지 답합니다. 채팅에는 아무것도 작성하지 않습니다. [Decision 모델](../connections/decision-models.md)에서 개념과 선택 방법을 설명합니다.

이 방식으로 프리셋, 카드, 로어북 항목, 에이전트 프롬프트는 매 턴 "X가 일어나면 Y를 하라"고 보내지 않고 해당하는 턴에만 지침을 보낼 수 있습니다. 항목의 텍스트를 줄이는 대신 로어북 항목 전체의 활성화를 결정하려면 항목의 [Decision](../lorebooks/entries.md#decision-activation) 필드를 사용하세요. 활용 예시는 다음과 같습니다.

- **장면 전환.** 장면이 실제로 이동한 경우에만 새 장소나 시간 건너뛰기를 묘사합니다.
- **장면 종류.** 전투, 친밀함, 긴장감의 진행 규칙을 해당 장면이 진행될 때만 불러옵니다.
- **질문에 먼저 답하기.** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **카드의 기분.** 캐릭터 카드에 "당황할 때"나 "화났을 때"의 행동을 넣고 최근 메시지에 그 상태가 나타날 때만 포함할 수 있습니다.
- **진행 속도 제어.** 천천히 관계를 발전시키는 프리셋은 관계가 눈에 띄게 진전할 때까지 고조 지침을 보류할 수 있습니다.
- **그룹 장면.** 그룹 블록의 `{{#if decision:"{{char}} is addressed in the latest message"}}`는 말을 건넨 대상 캐릭터의 섹션에만 직접 답하도록 지시합니다.

### 예 또는 아니요: `decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Decision 모델이 문장이 참이라고 하면 조건이 참입니다. `{{else}}`, `{{else if}}`, `&&`, `||`, 괄호, 중첩, 그룹 블록 등 이 가이드의 모든 기능과 함께 사용할 수 있습니다.

```
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

문장 안의 매크로를 먼저 치환하므로 `{{user}}`과 `{{char}}`을 사용할 수 있습니다. 그룹 블록에서 `{{char}}`을 지칭하는 문장은 캐릭터마다 한 번씩 묻습니다.

### 여러 답 중 하나: `decision_choice:`

`decision_choice:`는 Decision 모델에 옵션 하나를 고르게 합니다. 옵션은 프롬프트 어디에서든 이 조건과 비교하는 값입니다.

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

여기서는 "angry", "sad", "none of these" 중 하나를 고릅니다. 축약형도 가능합니다. `decision_choice:"The weather in the latest message" == "rain" || "snow"`는 두 옵션을 모두 제시합니다. 문장은 "Kaelen's mood in the latest message" 같은 주제로 쓰고 옵션은 짧은 답으로 작성하세요.

<a id="sticky-and-cooldown"></a>

### Sticky와 Cooldown

매 턴 묻는 대신 몇 턴 동안 답을 유지할 수 있습니다. 문장 뒤에 `sticky:`와 `cooldown:`을 쓰세요.

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** 예라고 답하면 이후 N턴 동안 다시 묻지 않고 예를 유지하므로 조건에 연결된 내용이 프롬프트에 남습니다.
- **cooldown:N.** sticky가 끝나면 시작하고 sticky가 없으면 예 직후에 시작합니다. N턴 동안 문장은 아니요로 읽으며 묻지 않습니다. 그 뒤 다시 묻습니다.
- 턴은 Decision 모델이 읽는 새 메시지 하나입니다. 같은 메시지의 재생성이나 스와이프는 같은 턴이므로 답글을 다시 뽑아도 타이머가 줄지 않습니다.
- sticky나 cooldown이 문장을 유지하는 동안은 묻지 않고 **Decision statements per turn**(턴당 판정문 수)에도 포함하지 않으므로 다른 문장에 슬롯을 남깁니다.
- `decision_choice:`에서 sticky는 선택한 옵션을 유지하고 cooldown은 모든 비교를 아니요로 읽습니다. 해당 옵션 없음이면 아무것도 시작하지 않습니다.
- 여러 곳에 작성한 같은 문장은 어디서든 지정된 가장 긴 sticky와 cooldown을 사용합니다.
- Peek Prompt는 유지 중인 답을 보여 주며 타이머를 진행시키지 않습니다.

함께 사용하면 장면 전환, 한 번의 알림, 몇 턴 유지할 기분 등 한 번 들어온 뒤 쉬어야 하는 내용에 적합합니다. **Decision** 필드로 활성화하는 로어북 항목에는 항목 자체의 **Sticky**와 **Cooldown**을 사용하세요. sticky 항목은 다시 묻지 않고 유지되며 cooldown 항목에는 묻지 않습니다.

<a id="checking-every-few-turns"></a>

### 몇 턴마다 확인하기

일부 문장은 매 턴 물을 필요가 없습니다. 뒤에 `every:`를 써서 N턴마다 한 번만 물을 수 있습니다.

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- 처음 도달한 턴에 묻고 3턴 후에 다시 묻는 식으로 계속합니다.
- 숫자를 바꾸면 즉시 적용됩니다. 다음 확인은 마지막으로 물은 턴부터 셉니다.
- 확인 사이에는 아니요로 읽고 묻지 않으며 **Decision statements per turn**에 포함하지 않습니다.
- 턴은 sticky와 cooldown과 같은 방식으로 세므로 재생성이나 스와이프는 일정을 진행시키지 않습니다. 답 재사용 여부는 [답 캐시 규칙](#answer-reuse)을 따릅니다.
- sticky와 cooldown은 여전히 답을 유지합니다. `every:`는 이들이 유지하지 않는 문장을 언제 물을지만 정합니다.
- 여러 곳에 작성한 같은 문장은 지정된 가장 작은 `every:`를 사용합니다.

<a id="priority"></a>

### 우선순위

프롬프트 계획의 문장이 **Decision statements per turn** 허용량보다 많으면 `priority:`가 어떤 문장을 물을지 정합니다. 허용량은 [여러 단계](#statement-allowance)에 적용됩니다.

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- `priority:high` 문장을 먼저, `priority:low` 문장을 마지막에 묻습니다. 우선순위가 없으면 중간입니다.
- 같은 우선순위에서는 프롬프트에 나타나는 순서대로 정합니다.
- 한도를 넘으면 가장 낮은 우선순위부터 제외합니다. 제외된 문장은 아니요로 읽고 Peek Prompt에 나열합니다.
- 여러 곳에 작성한 같은 문장은 지정된 가장 높은 우선순위를 사용합니다.
- 프롬프트 자체의 문장(프리셋, 카드, 페르소나, 작가 노트)을 먼저 계획합니다. 로어북 본문의 문장은 스캔이 활성 항목을 파악한 뒤 남은 슬롯으로 계획하므로 우선순위와 관계없이 프롬프트 문장의 슬롯을 빼앗지 않습니다.

모든 수식자를 어떤 순서로든 조합할 수 있습니다. `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### 답 없음은 아니요

Decision 모델 미설정, 시간 내 응답 실패, 처리 실패 등 답이 없으면 판정 조건은 **false**입니다. `decision_choice:`에서는 모든 비교가 false입니다. 따라서 Decision 모델이 없는 사용자에게는 `{{else}}` 분기나 아무것도 없는 결과가 전달됩니다.

이를 전제로 설계하세요.

- 판정은 **지침을 추가하거나 줄이는 데** 사용하고 이야기에 필수인 내용을 담지 마세요. 분기 누락은 답글의 맞춤 정도를 조금 줄일 뿐 동작을 깨면 안 됩니다.
- 모든 판정 블록에 합리적인 기본값을 주세요. 아무것도 넣지 않거나 어떤 턴에도 괜찮은 `{{else}}`를 사용하세요.
- 한 오답이 여러 다른 판정을 바꾸도록 연결하지 마세요.
- 동의, 콘텐츠 경고, 안전 지침을 판정 조건으로 제한하지 마세요. 항상 포함하세요.

모든 모델은 틀릴 수 있습니다. "Jev 필수"가 아니라 "Decision 모델"을 기준으로 작성하세요. 로컬 채팅 모델도 이런 문장에 답할 수 있습니다. 구문은 같지만 모델마다 답과 정확도가 다를 수 있습니다.

<a id="writing-statements"></a>

### 판정문 작성하기

다음은 로컬 채팅 모델과 Open-Jev 2B, 9B의 테스트에서 얻은 원칙입니다.

- 보고서의 한 줄처럼 **참이나 거짓인 사실을 진술하세요**. 질문("Did the scene change?")이나 지침("If the scene changed, describe it")으로 쓰지 마세요. 로컬 채팅 모델은 지침에 매번 아니요로 답해 블록이 한 번도 실행되지 않았습니다.
- 현재 턴을 뜻하면 **"in the latest message"라고 쓰세요**. 모델은 여러 메시지를 읽으며 "Mira asks questions"에는 이전 메시지의 질문 때문에 예라고 답했습니다.
- **누구에 관한 내용인지 명시하세요.** "He is angry"는 다른 캐릭터로 해석됐습니다.
- 모델이 해석해야 하는 분위기 표현("The scene is intense")이나 숨은 의도("Mira is lying") 대신 행동이나 발언 등 **텍스트에 드러난 내용을 설명하세요**.
- 짧게 쓰세요. 단순한 "and"나 부정문은 테스트에서 문제없었으므로 자연스러운 쪽으로 작성하세요.

표현을 시험하는 방법입니다.

1. **Decision model**에서 모델을 고르고 **Test**(테스트)를 클릭하세요. 고정 샘플로 연결을 확인하며 자신의 문장이나 현재 채팅은 시험하지 않습니다.
2. 프롬프트에 문장을 추가하고 참이어야 할 경우와 거짓이어야 할 경우를 포함한 대표적인 채팅 메시지를 보내세요.
3. **Peek Prompt**로 전송한 분기를 확인하세요. 문장의 확률과 예/아니요 결과가 필요하면 [디버그 로그](../CONFIGURATION.md#logging-levels)를 켜세요.
4. 표현을 조정하고 다시 시험하세요. 성공한 답은 [재사용](#answer-reuse)될 수 있으므로 새 사례는 새 메시지나 바꾼 문장으로 시험하세요. 새 Peek Prompt 미리보기를 열어도 모델에 묻지 않습니다.

테스트 결과에 관해 설명합니다. 각 표현은 예가 정답인 2턴과 아니요가 정답인 2턴, 총 4개의 라벨된 Roleplay 턴에서 Open-Jev 2B, Open-Jev 9B, Gemma 4 E4B 로컬 모델로 시험했습니다. 한 장면의 작은 표본이며 일반 정확도 벤치마크나 호스팅 Jev 테스트가 아닙니다. 표는 해당 표본의 관찰을 기록하며 다른 모델이나 채팅에서도 같은 결과를 보장하지 않습니다.

| 권장 표현 | 피할 표현 | 피할 표현에서 나타난 결과 |
| --- | --- | --- |
| The latest message moves the scene to a new place. | Did the scene change? | 질문형은 Open-Jev 2B의 아니요 턴 점수를 임계값 위로 올렸습니다. 로컬 모델에는 영향이 없었습니다. |
| In the latest message, a character draws a weapon or attacks someone. | The scene is intense. | 세 모델 모두 격한 언쟁을 "intense"로 봤습니다. 모호한 단어를 쓰면 의미는 작성자가 아니라 모델이 정합니다. |
| In the latest message, Mira asks Kaelen a direct question. | Mira asks questions. | Mira의 최신 메시지에는 질문이 없어도 이전 메시지가 질문했으므로 로컬 모델과 Open-Jev 9B는 예라고 답했습니다. |
| Kaelen is angry in the latest message. | He is angry. | 로컬 모델은 "he"를 화난 술집 주인으로 읽었습니다. |
| In the latest message, Mira says something that contradicts what she said earlier. | Mira is lying. | 모순을 안정적으로 거짓말로 판정한 모델은 없었습니다. |
| The latest message moves the scene to a new place. | If the scene changed, describe the new location in two sentences. | 로컬 모델이 지침에 매번 아니요로 답해 블록이 실행되지 않았습니다. |
| Someone is injured in the latest message. | A fight starts and someone is injured and the city guards arrive. | 올바르게 처리했습니다. 그래도 나누면 재사용과 디버깅이 더 쉽습니다. |
| In the latest message, the characters stay in the same place. | The characters did not leave the room. | 차이가 없었습니다. 자연스러운 쪽으로 작성하세요. |

권장 표현은 32개 중 Open-Jev 2B에서 31개, Open-Jev 9B에서 31개, 로컬 모델에서 32개 정답을 받았습니다. 피할 표현은 각각 26개, 25개, 24개였습니다. 이 작은 표본은 표현 선택을 설명합니다. 자신에게 맞는 모델은 자신의 사례로 판단하세요.

<a id="limits-and-cost"></a>

### 제한과 비용

<a id="statement-allowance"></a>

#### 판정문 허용량

**Decision model** 아래의 **Decision statements per turn**은 기본값 32입니다. 이름과 달리 모든 Decision 요청이나 지출에 적용되는 단일 한도가 아닙니다. Marinara는 단계별로 적용합니다.

1. 주 채팅 프롬프트 문장을 허용량 안에서 계획합니다. 로어북 판정은 그 계획에서 남은 몫을 사용합니다.
2. 답글 전 또는 답글과 병렬로 실행하는 에이전트에는 주 프롬프트 문장과 에이전트 프롬프트 문장을 합쳐 설정한 허용량으로 다시 계획합니다. 이 단계는 앞선 로어북 사용량을 빼지 않으므로 총량이 설정값을 넘을 수 있습니다.
3. 후처리 에이전트는 답글 뒤에 별도 허용량을 받습니다. 그 문장은 완성된 답글을 읽습니다.

에이전트 **활성화 질문**과 **Smart 응답 순서**는 이 설정과 별개입니다.

현재 단계가 사용할 수 있는 문장만 계획에 들어갑니다. 활성 프리셋 섹션과 그룹, 선택한 변수 옵션, 활성화된 로어북 항목의 내용입니다. 고정 조건은 문장을 제외할 수 있습니다. `{{#if char == "Dottore" && decision:"..."}}`는 캐릭터가 Mira일 때 묻지 않습니다. 변수는 프롬프트 작성 중 바뀔 수 있으므로 변수 조건만으로 미리 제외하지 않습니다.

[sticky, cooldown](#sticky-and-cooldown)이나 [`every:`](#checking-every-few-turns)가 유지하는 문장은 슬롯을 쓰지 않습니다. [우선순위](#priority)가 프롬프트 계획에 들어갈 문장을 고릅니다. 로어북 활성화는 항목을 검토하면서 남은 허용량을 사용합니다. 빠진 문장은 아니요로 읽고 Peek Prompt에 나열합니다.

#### 요청과 시간

호스팅된 Decision 연결은 한 턴에 여러 유료 요청을 만들 수 있습니다. 문장을 일괄 처리할 수 있지만 로어북 활성화, 새 활성 항목 내용, 재귀 일치, 에이전트 단계에 추가 묶음이 필요할 수 있습니다. 활성화 질문은 Scan Depth와 단계별로 묶고 Smart 순서는 자체 요청을 만듭니다. 문장 허용량은 요청 수나 금액 한도가 아닙니다.

로컬 채팅 모델은 호스팅 비용 대신 처리 시간이 추가됩니다. `decision_choice:`는 옵션마다 예/아니요 질문 하나로 답하므로 한 선택에 여러 생성이 필요할 수 있습니다.

각 요청에는 [시간 제한](../connections/decision-models.md#time-limits)이 있습니다. Decision 연결은 기본 1.5초이며 로컬은 백엔드 예산을 따릅니다. 여러 요청이 쌓이면 더 오래 기다릴 수 있습니다. 먼저 추론해야 하는 로컬 모델은 **Also gate agents that run before the reply**(답글 전에 실행되는 에이전트도 판정)를 켜지 않으면 답글 전 판정을 보류합니다.

<a id="answer-reuse"></a>

#### 답 재사용

성공한 답은 보통 같은 턴과 Decision 모델에서 재사용하므로 재생성할 때 추가 요청 없이 같은 분기를 보내는 경우가 많습니다. 캐시는 실행 중인 서버에 있으며 최대 200개의 턴 키를 보관합니다. 재시작이나 캐시 제거로 다시 요청할 수 있습니다. 최신 메시지의 추가나 편집, 다른 모델, 바뀐 문장이나 선택지 집합도 새 답이 필요할 수 있습니다.

없거나 실패한 답은 성공한 아니요 답으로 캐시하지 않습니다. 같은 턴을 재시도하면 다시 묻고 다른 분기를 고를 수 있습니다. Sticky/cooldown 타이밍은 답 캐시와 별개입니다.

에이전트 프롬프트 문장도 같은 재사용 규칙을 따릅니다. 생성 전/병렬 에이전트는 답글 전 턴을 읽고 후처리 에이전트는 완성된 답글을 읽으므로 스와이프가 바뀌면 새 답이 필요할 수 있습니다. 수동 재실행은 해당 입력의 성공한 답이 캐시에 있으면 재사용합니다. [에이전트 프롬프트의 판정문](../agents/custom-agents.md#decision-statements-in-the-agents-prompt)을 참고하세요.

<a id="prompt-caching"></a>

#### 프롬프트 캐시

제공자의 **프롬프트 캐시**는 Marinara의 Decision 답 캐시와 별개입니다. 채팅 모델에 보내는 프롬프트의 변하지 않은 접두부를 재사용할 수 있습니다. 판정 분기가 바뀌면 그 지점 이후를 재사용하지 못할 수 있지만 더 앞의 변하지 않은 접두부는 여전히 대상이 될 수 있습니다. 정확한 재사용 범위와 과금은 제공자, 캐시 경계, 최소 길이와 수명에 따라 다릅니다.

**변하는 판정 블록은 프롬프트 뒤에 놓으세요.** 기록 뒤 지침이나 얕은 깊이의 작가 노트가 예입니다. 앞부분의 변경은 캐시 절감 대부분을 잃게 할 수 있습니다. 답이 거의 바뀌지 않고 지침이 앞에 있어야 할 때만 앞부분에 두세요. 프리셋 변수 옵션도 같습니다. 텍스트는 `{{name}}`이 있는 곳에 들어갑니다.

직접 Anthropic 연결에서 **Enable prompt caching**(프롬프트 캐시 활성화)을 켜면 Marinara는 시스템 프롬프트 끝과 최신 메시지에서 **Cache depth**(캐시 깊이)개 전의 메시지(기본 5개)에 표시합니다. 기록 전 변경은 시스템 경계와 뒤쪽 기록을 무효화할 수 있지만 더 앞의 일치하는 접두부는 재사용할 수 있습니다. 표시된 기록 경계 이후의 변경은 캐시 접두부를 보존할 수 있습니다. 두 경계 사이의 변경은 시스템 접두부를 유지하면서 일부 기록 캐시를 잃을 수 있습니다. 캐시 읽기와 쓰기는 가격이 다릅니다.

최소 캐시 길이와 지원 경계는 모델마다 다르고 바뀔 수 있습니다. 자세한 내용과 과금 규칙은 제공자의 최신 [Anthropic 프롬프트 캐시 가이드](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)나 [OpenAI 프롬프트 캐시 가이드](https://developers.openai.com/api/docs/guides/prompt-caching)를 확인하세요.

<a id="when-a-decision-branch-never-appears"></a>

### 판정 분기가 나타나지 않을 때

판정 분기가 전혀 나타나지 않는다는 보고가 있으면 가능성 높은 원인은 다음 순서입니다.

1. **Decision 모델 미설정.** 모든 턴의 모든 판정 조건이 false입니다. 편집기는 판정을 사용하는 필드 아래에 경고를 표시합니다.
2. **Decision 모델이 답하지 않음.** 잘못된 키, 크레딧 부족, 속도 제한이 있는 호스팅 연결, 중지됐거나 예산보다 느린 로컬 모델, 시작하지 못한 설치형 모델 등이 원인입니다.
3. **추론 모델이어서** 답글 전 판정을 보류합니다.
4. **해당 계획 단계의 문장이 너무 많아** 허용량을 넘었습니다.
5. **답은 하지만 임계값 미만임.** 보통 표현이나 예상보다 해당 턴을 낮게 평가하는 모델이 원인입니다.

어떤 Decision 모델을 선택했고 **Test**가 무엇을 보고하는지 사용자에게 확인하세요. **Peek Prompt**는 실제 보낸 분기를 보여 줍니다. 새 미리보기를 만들 때는 아직 답이 없는 문장을 나열하며 거기서는 아니요로 읽습니다. 로그 수준이 debug이면 각 문장, 답, 예로 읽혔는지를 기록합니다. [로그 수준](../CONFIGURATION.md#logging-levels)을 참고하세요.

프리셋 자체를 고쳐야 하는 경우는 드뭅니다. 그런 경우에는 보통 표현이나 프롬프트에 필수인 내용을 담은 분기가 문제입니다.

## 관련 가이드

- [Decision 모델](../connections/decision-models.md)
- [프롬프트 매크로](macros.md)
- [프리셋 변수](preset-variables.md)
- [그룹 채팅과 여럿이 나누는 대화](../chats/group-chats.md)
