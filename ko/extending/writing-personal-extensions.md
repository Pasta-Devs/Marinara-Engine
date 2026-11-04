# Personal Extensions 작성

이 가이드에서는 Browser Extension이나 Server Extension을 작성하고, 패키지로 만들고, 가져오는 방법을 설명합니다. JavaScript를 작성할 수 있는 사용자를 위한 가이드입니다. 확장 기능을 검토하고 실행하는 방법은 [개인 확장](personal-extensions.md)을 참고하세요.

직접 작성하고 가져온 코드는 **External Extension**(외부 확장)으로 취급됩니다. 처음에는 비활성화되어 있으며, 코드를 검사하고 정확한 SHA-256 해시를 승인하기 전에는 실행할 수 없습니다.

## 시작 전 준비

External Extensions는 [서드파티 가져오기 허용](personal-extensions.md#allow-third-party-imports)에 나오는 두 안전 단계를 모두 열 때까지 숨겨져 있습니다. 두 단계는 `.env`의 `ENABLE_EXTERNAL_EXTENSIONS=true`와 **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)의 **Allow third-party extension imports**(서드파티 확장 가져오기 허용)입니다.

확장 기능을 가져오고 관리하려면 localhost 접근이나 관리자 시크릿도 필요합니다. 휴대전화, LAN 주소 또는 원격 브라우저에서 사용한다면 서버에 `ADMIN_SECRET`을 설정하고 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)에 같은 값을 입력하세요.

작업을 수행할 수 있는 런타임 중 권한이 가장 적은 것을 선택하세요.

| 런타임 | 용도 | 중요 경계 |
| --- | --- | --- |
| Sandboxed Browser Extension | 비공개 상태, 활성 채팅 컨텍스트, 버튼, 메뉴 동작, Marinara가 렌더링하는 패널 | Marinara DOM, 쿠키, 브라우저 저장소, 네트워크 또는 임의 HTML에 접근할 수 없음 |
| Server Extension | 관리형 타이머와 비공개 확장 기능 저장소가 필요한 백그라운드 로직 | 별도의 OS 샌드박스. Marinara 파일, 시크릿, 네트워크, 자식 프로세스 또는 네이티브 모듈에 접근할 수 없음 |
| Full-page External Extension | Marinara 페이지 또는 동일 출처 API가 필요한 레거시 코드 | 샌드박스 없음. 완전히 신뢰하는 바로 그 코드에만 사용 |

Browser Extensions는 지원되는 모든 플랫폼에서 작동합니다. Server Extensions에는 macOS Seatbelt 또는 Linux Bubblewrap이 필요합니다. Server Extension을 선택하기 전에 [플랫폼 표](personal-extensions.md#platform-support)를 확인하세요.

## Browser Extension 빠른 시작

다음 구조로 폴더를 만드세요.

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

다음 `manifest.json`을 사용하세요.

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

다음 `extension.js`를 사용하세요.

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

버튼으로 열리는 제한된 iframe 창의 스타일에는 다음 `extension.css`를 사용하세요.

```css
[data-ext-root] {
  font-size: 16px;
}
```

이제 확장 기능을 가져와 실행하세요.

1. **Settings → Addons → External Extensions**(설정 → 애드온 → 외부 확장)를 여세요.
2. **Import Extension Folder**(확장 폴더 가져오기)를 선택해 `Hello Panel`을 지정하거나, 폴더를 ZIP으로 압축한 뒤 **Import Extension File**(확장 파일 가져오기)로 가져오세요.
3. 비활성화된 초안을 열어 매니페스트와 JavaScript를 검사하세요.
4. **Review and Run**(검토 및 실행)을 선택하고 표시된 정확한 해시를 승인하세요.
5. Extensions 메뉴를 열고 **Hello Panel**을 선택하세요.

같은 실행 가능 예제는 저장소의 `docs/examples/personal-extensions/browser-minimal/`에 있습니다.

## Browser API 레퍼런스

샌드박스에서 실행되는 Browser Extensions에는 `marinara`라는 동결된 전역 객체 하나가 제공됩니다.

| API | 목적 |
| --- | --- |
| `runtime`, `version` | 런타임 이름(`client`)과 현재 Browser API 버전 |
| `extensionId`, `extensionName`, `capabilities` | 이 확장 기능 리비전의 ID와 승인된 기능 |
| `log.debug/info/warn/error(...)` | 브라우저 콘솔에 태그가 붙은 항목 기록 |
| `storage.get()` | 이 확장 기능의 비공개 JSON 객체 읽기 |
| `storage.patch(object)` | 비공개 저장소에 값을 병합하고 새 객체 반환 |
| `storage.delete()` | 비공개 저장소 비우기 |
| `context.get()` | 현재 활성 채팅 스냅샷 읽기 |
| `context.subscribe(listener)` | 컨텍스트 변경 수신. 구독 해제 함수 반환 |
| `ui.registerContribution(options)` | 안전한 버튼, Extensions 메뉴 항목 또는 Marinara가 렌더링하는 패널 추가 |
| `ui.showWindow(options)` | 제한된 iframe 창 열기 |
| `dice.registerFormat(options)` | `/roll`에 표기법 추가. 지정한 주사위는 Marinara가 굴림 |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | 확장 기능이 멈출 때 제거되는 관리형 타이머 |
| `onCleanup(callback)` | 추가 정리 로직 등록 |

일반 UI에는 [Marinara가 렌더링하는 패널](#add-a-marinara-rendered-panel)을, 채팅을 인식하는 동작에는 [활성 채팅 컨텍스트](#use-active-chat-context)를, 사용자 지정 `/roll` 표기법에는 [주사위 형식](#add-a-dice-format)을 사용하세요. 확장 기능 상태는 브라우저 저장소가 아니라 `marinara.storage`에 저장해야 합니다.

`showWindow({ title, elements, onEvent, onClose })`는 `update({ title?, elements? })`와 `close()`가 있는 핸들을 반환합니다. 패키지 CSS는 이 샌드박스 iframe 창에 스타일을 적용합니다. 호스트가 렌더링하는 기여에는 항상 Marinara의 테마와 컨트롤이 사용됩니다.

안전한 Browser 런타임에는 DOM 또는 네트워크 API가 없습니다. 이 경계를 우회하지 마세요. 유용한 기능이 없다면 기본적으로 전체 페이지 접근으로 전환하지 말고 범위가 좁은 호스트 기능을 요청하세요.

### 컨텍스트 기능

선택적 레코드 접근을 `config.capabilities`에 선언하세요.

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters`는 활성 채팅의 캐릭터 카드에서 범위가 제한된 필드를 채웁니다.
- `read_active_persona`는 선택한 페르소나에서 범위가 제한된 필드를 채웁니다.
- `full_page_access`는 샌드박스가 없는 호환 런타임을 선택하며 External Extensions에서만 사용할 수 있습니다.

기능을 변경하면 실행 코드 해시가 바뀌고 확장 기능이 비활성화되며 새 검토가 필요합니다.

<a id="what-a-browser-extension-can-do"></a>

### Browser Extension으로 할 수 있는 일

Browser Extension은 불투명 출처(opaque origin) 샌드박스 iframe 안의 전용 Worker에서 실행됩니다. Marinara의 페이지, DOM, 쿠키, 브라우저 저장소, 출처 API, 네트워크에는 접근할 수 없습니다. 쓸 수 있는 기능은 비공개 확장 기능 저장소, 로깅, 관리형 타이머, 정리 등록, 제한된 창, 안전한 호스트 기여 슬롯, 그리고 활성 채팅과 캐릭터 ID의 읽기 전용 스냅샷입니다. 활성 채팅의 캐릭터 카드나 선택한 페르소나에서 일부 필드를 받을 수도 있지만, 해당 권한을 선언하고 승인받은 경우에만 가능합니다.

확장 기능은 `marinara.ui.registerContribution(...)`으로 상단 바나 사이드 패널 동작, Extensions 메뉴 항목, 오른쪽에 계속 표시되는 패널을 추가할 수 있습니다. Marinara는 이 화면 요소를 현재 테마와 정해진 컨트롤 묶음으로 렌더링합니다. 그 컨트롤은 제목, 텍스트, 서식이 고정된 출력, 버튼, 텍스트 입력란, 선택 목록, 토글, 슬라이더, 색상 컨트롤, 여백입니다. 확장 기능이 제공하는 것은 콘텐츠와 상태뿐이며, HTML, CSS, URL, React 컴포넌트, 호스트 이벤트 핸들러는 제공하지 않습니다.

이 UI 기능과 규칙은 출처와 관계없이 샌드박스에서 실행되는 모든 Browser Extension에 똑같이 적용됩니다. 가져온 서드파티(External) Extension도 이 안전한 런타임을 사용합니다. 패키지가 **Full page access**(전체 페이지 접근)를 명시적으로 요청하거나 아래에서 설명하는 샌드박스 이전 `marinara.extension` 형식을 사용하는 경우만 예외입니다.

### 텍스트 토큰 수 추정

Browser, Full page access, Server 방식의 Personal Extensions(개인 확장)는 Marinara에 내장된 텍스트 토큰 수 추정 함수를 사용할 수 있습니다.

```js
const tokens = marinara.estimateTextTokens(text);
```

시그니처는 `estimateTextTokens(text: string): number`이며, `@marinara-engine/shared`에서 내보내는 `PersonalExtensionTokenApi` 타입에도 정의되어 있습니다. 이 호출은 동기식이고 추가 기능이 필요하지 않으며, 토크나이저로 센 정확한 값이 아니라 특정 모델에 종속되지 않는 Marinara의 토큰 수 추정값을 반환합니다. 이전 Engine에서는 호출하기 전에 `typeof marinara.estimateTextTokens === "function"`을 확인하세요.

<a id="add-a-marinara-rendered-panel"></a>

### Marinara가 렌더링하는 패널 추가하기

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

간단한 동작에는 `kind: "button"`을, Extensions 메뉴 동작에는 `kind: "menu-item"`을 사용하세요. 같은 확장 기능 리비전에 있는 기존 기여를 실행하는 Command Center 항목에는 `kind: "command"`를 사용하세요. 명령에는 `targetContributionId`가 필요하며 `onActivate`나 `onEvent`를 쓸 수 없습니다.

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

호스트는 대상의 확장 기능 ID와 콘텐츠 해시가 같을 때만 명령의 대상을 찾습니다. 대상이 없거나, 다른 확장 기능에 속하거나, 오래된 리비전이면 안전하게 실패합니다. 버튼의 기본값은 `surface: "top-bar"`입니다. 대신 `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents`, `settings`를 대상으로 삼고 `position`을 `header`, `before-content`, `after-content`로 설정할 수 있습니다. `icon`에는 Marinara가 지원하는 kebab-case Lucide 아이콘 이름을 쓸 수 있습니다. 두 동작 종류 모두 `onActivate`를 호출합니다. `panel`은 열릴 때 `onActivate`를 호출하며, 패널의 버튼은 모든 패널 컨트롤의 현재 값과 함께 `onEvent`를 호출합니다. 반환된 핸들은 종류별 업데이트를 지원합니다. `button`은 `label`, `description`, `icon`, `surface`, `position`을, `menu-item`은 `label`, `description`, `icon`을, `panel`은 `label`, `description`, `icon`, `elements`를 받습니다. 모든 핸들은 `remove()`를 지원합니다. ID에는 영문자, 숫자, `.`, `_`, `-`를 넣을 수 있습니다.

다음 예시는 Presets 패널 내용 위에 네이티브 동작을 배치합니다.

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

복잡한 도구는 이벤트가 발생한 뒤 패널 요소를 갱신해 여러 단계로 된 화면을 만들 수 있습니다. 애플리케이션 상태는 `marinara.storage`에 두세요. 마크업 안에 상태를 담지 마세요.

<a id="use-active-chat-context"></a>

### 활성 채팅 컨텍스트 사용하기

Browser Extension API 버전 5는 Marinara에 현재 표시된 채팅의 불투명 식별자를 제공합니다.

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()`은 구독하지 않고 같은 현재 스냅샷을 반환합니다. 활성 채팅이 없으면 `chatId`는 `null`이고 `characterIds`는 비어 있습니다. `characterId`는 캐릭터가 정확히 한 명 참여할 때만 채워집니다. 그룹 채팅에서는 모든 참여자가 `characterIds`로 제공되고 `characterId`는 `null`로 남습니다. `personaId`는 `read_active_persona`가 승인된 경우에만 채워집니다.

채팅 ID와 캐릭터 ID는 항상 제공되므로, 확장 기능이 자기 비공개 저장소를 ID별로 나눠 쓸 수 있습니다. 레코드 필드를 받으려면 확장 기능 매니페스트에 다음 선택적 권한 중 하나 또는 둘 다가 필요합니다.

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters`는 활성 채팅에 참여하는 카드 정보로 `characters`를 채웁니다.
- `read_active_persona`는 활성 채팅에서 선택한 페르소나 정보로 `persona`를 채웁니다.

권한이 없으면 해당 값은 `[]` 또는 `null`로 남습니다. Marinara는 요청된 모든 권한을 **Requested access**(요청된 접근 권한)에 표시하고, 정확한 해시를 승인하는 대화 상자에서 다시 표시합니다. 권한을 추가하거나 제거하면 실행 코드 해시가 바뀌고 확장 기능이 비활성화되며 승인을 새로 받아야 합니다.

캐릭터 스냅샷에는 `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe`, `conversationDisplayName`만 들어갑니다. 페르소나 스냅샷에는 `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe`, `conversationDisplayName`만 들어갑니다. 텍스트는 샌드박스 브리지를 넘기 전에 길이가 제한됩니다.

Marinara는 메시지, 제작자 노트, 시스템 프롬프트, 후행 지시문, 주석, 아바타 경로, 캐릭터나 페르소나 라이브러리 전체, 선언하지 않은 필드, 채팅 메타데이터, 데이터베이스 핸들, 네트워크 접근, 변경 작업을 절대 넘기지 않습니다. 컨텍스트 업데이트는 승인된 코드 해시에 묶여 있으며, 활성 채팅이나 그 채팅의 캐릭터 목록, 선택된 페르소나가 바뀔 때 전달됩니다.

<a id="add-a-dice-format"></a>

### 주사위 형식 추가하기

Browser Extension API 버전 6에서는 확장 기능이 서사 주사위 풀 같은 자체 표기법을 `/roll`에 추가할 수 있습니다. 확장 기능이 표기법을 읽고 굴릴 주사위를 지정하면, Marinara가 자체 보안 주사위 굴림 기능으로 굴리고 나온 눈을 돌려줍니다. 확장 기능은 굴림의 의미를 정할 수 있지만, 나온 눈을 정할 수는 없습니다.

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

이제 `/roll 2 boost 1 setback`은 주사위 눈, 합계, 확장 기능의 텍스트를 형식 이름과 함께 게시합니다. `2d6`이나 `4d6kh3` 같은 일반 표기법은 항상 기존 방식으로 굴리며 확장 기능으로 전달되지 않습니다. 그 밖의 표기법은 등록된 형식에 차례로 전달되며, `parse`가 처음으로 주사위를 반환하는 형식으로 굴립니다.

- `parse(notation)`은 `null`이나 `{ dice: [sides, ...] }`를 반환합니다. 주사위는 1~100개이며 각각 2~1000면입니다. 객체의 다른 값은 샌드박스 안에 남아 `plan`으로 `read`에 다시 전달됩니다.
- `read(...)`는 `{ total, text?, kept? }`를 반환합니다. 유한한 숫자, 최대 200자의 일반 텍스트, 그리고 선택적으로 계산에 넣은 주사위의 위치를 오름차순으로 담습니다. `/roll`은 나머지 주사위에 취소선을 긋습니다.
- 확장 기능마다 형식 4개를 등록할 수 있습니다. 표기법은 최대 100자입니다. `parse`와 `read`는 비동기 함수여도 되지만 각각 2초 안에 응답해야 합니다.
- 텍스트는 일반 텍스트로 표시됩니다. 링크, 이미지, 서식, HTML은 이스케이프 처리됩니다.

주사위 형식은 브라우저의 `/roll`에 적용됩니다. Game Master의 `roll_dice` 도구와 다른 서버 측 굴림은 내장 표기법과 규칙 집합의 주사위를 계속 사용합니다. 이전 Engine에서는 호출하기 전에 `typeof marinara.dice?.registerFormat === "function"`을 확인하세요.

### 레거시 확장 기능과 전체 페이지 확장 기능

날씨 조절기, 프롬프트 편집기를 비롯한 묵직한 워크플로도 기여 기능으로 만들기에 알맞은 사례입니다. 이런 도구를 안전하게 옮길 때는 메뉴나 상단 바의 실행 버튼에 단계별로 갱신되는 패널을 붙이면 됩니다. 다만 DOM 오버레이를 끼워 넣거나, Marinara의 CSS 선택자를 조회하거나, React 내부 구조를 훑거나, 동일 출처 `/api` 경로를 호출하는 기존 패키지는 그대로는 안전한 런타임으로 가져올 수 없습니다.

UI 기여는 화면을 제공할 뿐, 주변 권한까지 주지는 않습니다. 컨텍스트 API는 활성 채팅 ID와 캐릭터 ID를 항상 제공하고, 그 밖에는 위에 적힌 대로 선언된 활성 레코드 필드만 제공할 수 있습니다. 메시지, 프리셋, 로어북, 선언하지 않은 캐릭터나 페르소나 데이터, 장면 시각 효과가 필요한 기능에는 Marinara가 따로 좁게 열어 주는 중개 기능이 여전히 필요합니다. 확장 기능이 호스트 DOM 접근이나 제한 없는 네트워크 요청으로 그것을 흉내 내서는 안 됩니다.

External Extension이 호스트 DOM 접근에 의존한다면 다음과 같이 요청할 수 있습니다.

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**전체 페이지 접근은 샌드박스 기능이 아닙니다.** 승인된 JavaScript와 CSS가 Marinara의 페이지 안에서 실행됩니다. 이 코드는 현재 브라우저 세션에 보이는 것이라면 무엇이든 읽거나 바꿀 수 있고, 채팅과 카드를 들여다보고, 브라우저 저장소를 쓰고, 네트워크 요청을 보내고, 동일 출처의 Marinara API를 호출할 수 있습니다. 브라우저 콘솔에 붙여넣은 코드와 실질적으로 같은 페이지 권한을 가집니다. Professor Mari가 만든 초안은 이 권한을 요청할 수 없습니다.

전체 페이지 확장 기능은 네트워크 요청에 `marinara.fetch(...)`를 사용해야 합니다. 시그니처와 결과는 `window.fetch`와 같으며, **Settings > Addons > External Extensions**에서 해당 확장 기능의 세션 내 요청 수, 응답에 보고된 전송 바이트 수, 최근 요청 빈도, 높은 트래픽이 지속될 때의 경고를 표시할 수 있게 해 줍니다. 전체 페이지 접근 코드는 신뢰하는 페이지 코드이므로 `window.fetch` 직접 호출도 계속 쓸 수 있지만, 그 요청은 확장 기능에 귀속시킬 수 없습니다.

Marinara는 명시적인 `capabilities` 필드가 없는 구형 `kind: "marinara.extension"` v1 봉투를 샌드박스 이전 패키지로 인식하고, 가져오는 시점에 **Full page access**를 부여합니다. 덕분에 WeatherTweaker 같은 레거시 패키지가 Worker 안에서 조용히 실패하지 않고 올바른 검토 절차를 밟게 됩니다. 이 봉투를 쓰면서도 안전한 런타임을 원하는 최신 패키지라면 `"capabilities": []`를 넣어야 합니다.

External Extension의 두 관문과 정확한 해시 승인은 이 경우에도 그대로 적용됩니다. 코드, CSS, 권한이 바뀌면 확장 기능이 비활성화되고 승인을 새로 받아야 합니다. 비활성화하면 Marinara가 넣어 둔 스크립트와 스타일시트 노드를 제거하고, 호환 API로 만든 타이머를 취소하고, `marinara.onCleanup(...)`으로 등록한 콜백을 실행합니다. 다만 페이지 코드는 등록되지 않은 리스너, 타이머, 전역 변수, DOM 변경을 만들 수 있어서 정리는 최선을 다하는 수준입니다. 확장 기능을 비활성화한 뒤에도 무언가 남아 있으면 페이지를 새로 고치세요.

구형 `marinara.ui.showWindow(...)` API도 계속 쓸 수 있으며, 불투명 출처 iframe 안에 임시 창을 띄웁니다. 같은 고정 컨트롤을 사용하고 `update(...)`와 `close()` 핸들을 반환합니다. 도구를 Marinara의 평소 내비게이션으로 열 수 있어야 한다면 기여 쪽을 사용하세요.

## Server Extension 빠른 시작

다음 폴더를 만드세요.

```text
Server Counter/
  manifest.json
  server-extension.js
```

다음 `manifest.json`을 사용하세요.

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

다음 `server-extension.js`를 사용하세요.

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

같은 실행 가능 패키지는 `docs/examples/personal-extensions/server-minimal/`에 있습니다.

서버 코드에는 `marinara.runtime`, `marinara.version`, 확장 기능 ID, `log`, `storage`, 관리형 타이머, `onCleanup`이 제공됩니다. 파일 시스템, 프로세스, 네트워크, 모듈 로딩 또는 Marinara 데이터베이스에는 접근할 수 없습니다.

호스트가 Seatbelt 또는 Bubblewrap을 구성할 수 없으면 Server Extensions는 비활성화된 상태로 유지됩니다. 이는 확장 기능 오류가 아니라 플랫폼 제한입니다.

## 패키지 및 매니페스트 레퍼런스

| 필드 | 참고 |
| --- | --- |
| `kind` | `marinara.personal-extension` 또는 `marinara.personal-server-extension` |
| 최상위 `version` | 패키지 봉투 버전. 현재 `1` |
| `config.name` | 필수 표시 이름. 1~200자 |
| `config.version` | `1.2.0` 같은 선택적 확장 기능 버전. 점으로 구분된 숫자 버전은 다운그레이드 경고 지원 |
| `config.description` | 선택적 설명. 최대 2,000자 |
| `config.runtime` | `client` 또는 `server`. 기본값은 `client` |
| `config.capabilities` | 요청한 Browser 기능. Server Extensions는 빈 목록을 사용해야 함 |
| `config.jsPath` / `config.serverJsPath` | 매니페스트 기준 JavaScript 파일 경로 또는 경로의 순서 있는 배열 |
| `config.cssPath` | 선택적 CSS 파일 경로 또는 순서 있는 배열. 안전한 런타임 CSS는 샌드박스 iframe 안에 유지 |
| `config.js`, `config.serverJs`, `config.css` | 별도 파일이 필요하지 않을 때 사용하는 인라인 대안 |

일반 JavaScript를 사용하세요. Marinara는 TypeScript를 컴파일하거나 확장 기능 의존성을 설치하지 않습니다. 필요한 경우 가져오기 전에 의존성을 JavaScript에 번들로 포함하세요.

개별 `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs`, `.css` 파일도 직접 가져올 수 있습니다. ID, 런타임, 버전, 기능, 파일 순서를 명시적으로 기록하므로 매니페스트 사용을 권장합니다.

### 유효성 검사 제한

| 콘텐츠 | 현재 경계 |
| --- | --- |
| 이름 / 버전 / 설명 | 200자 / 64자 / 2,000자 |
| Browser 또는 Server JS | 필드별 소스 제한 없음. 바깥쪽 파일, 아카이브 또는 요청 경계는 계속 적용 |
| CSS | 256 KiB |
| 가져온 ZIP | 압축 상태 32 MiB, 텍스트 항목당 2 MiB, 추출된 전체 텍스트 16 MiB |
| 비공개 저장소 | 확장 기능당 직렬화된 JSON 1,000,000바이트 |

ZIP, 요청, 샌드박스 메시지, 저장소 제한은 각각 다른 전송 또는 런타임 경계를 보호합니다. 실행 가능한 소스 코드 정책이 아닙니다.

## 업데이트 및 복구 수명 주기

- 새로 가져온 항목은 항상 비활성화 및 미승인 상태로 시작합니다.
- 코드, CSS, 런타임 또는 기능을 편집하면 승인이 해제되고 확장 기능이 비활성화됩니다.
- 같은 이름을 다시 가져오면 확인 후 기존 레코드가 업데이트됩니다. 바이트 단위로 동일한 항목을 다시 가져오면 현재 해시와 승인이 유지됩니다. 실행 가능한 콘텐츠가 바뀌면 승인이 해제됩니다. 숫자 버전이 다운그레이드를 나타내면 Marinara가 경고합니다.
- **Export**(내보내기)는 현재 매니페스트와 소스 파일을 이식 가능한 패키지로 내보냅니다. 승인은 내보내지지 않습니다.
- 리비전 복원, 프로필 가져오기 또는 백업 복원 후에는 다시 검토할 때까지 확장 기능이 비활성화됩니다.
- **Disable**(비활성화)은 런타임과 등록된 정리를 중지합니다. 전체 페이지 코드가 등록되지 않은 부작용을 만들었다면 페이지를 새로 고쳐야 할 수 있습니다.
- **Delete**(삭제)는 설치된 레코드를 삭제합니다. 나중에 소스가 필요할 수 있다면 먼저 내보내세요.

## 디버깅

| 증상 | 확인 사항 |
| --- | --- |
| 외부 가져오기 컨트롤이 보이지 않음 | 위에서 설명한 External Extension 관문 두 개를 모두 열기 |
| 관리 화면에서 localhost 또는 Admin Access가 필요하다고 표시됨 | `ADMIN_SECRET`을 구성해 **Admin Access**에 저장하기 |
| 가져오기가 확장 기능을 찾지 못함 | `manifest.json`과 상대 경로 확인. Server에는 JS가 필요하고 Browser에는 CSS 또는 JS가 필요함 |
| 편집 후 확장 기능이 비활성화됨 | 예상된 동작. 새 정확한 해시를 검사하고 승인하기 |
| Browser 코드에서 `document`, `window`, `fetch` 또는 로컬 저장소를 사용할 수 없음 | 안전한 샌드박스에서는 예상된 동작. 문서화된 브로커 API 사용하기 |
| Server Extension을 사용할 수 없음 | macOS Seatbelt 또는 Bubblewrap이 있는 Linux를 사용하거나 Browser Extension으로 전환하기 |
| Browser Extension에서 예외 발생 | 브라우저 개발자 도구 열기. `marinara.log`와 시작 오류에는 확장 기능 이름이 태그로 표시됨 |
| Server Extension에서 예외 발생 | **Settings → Addons**에서 상태와 Marinara 서버 로그 확인하기 |

CSS, 비공개 저장소, 가져오기 아카이브, 런타임 메시지는 서로 다른 안전 제한을 유지합니다. Marinara는 실행 실패로 표시하는 대신 패키지를 거부한 경계를 보고해야 합니다.

## 관련 가이드

- [개인 확장](personal-extensions.md)
- [서버 설정](../CONFIGURATION.md)
- [문제 해결](../TROUBLESHOOTING.md)
- [Personal Extension 아키텍처](../development/personal-extensions.md)
