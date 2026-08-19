# 개인 확장

Personal Extensions(개인 확장)는 Professor Mari가 만들어 주는 비공개 코드 초안입니다. **Settings**(설정) > **Addons**(애드온) > **Personal Extensions**를 여세요.

기본 안내 문구는 다음과 같습니다.

> Professor Mari에게 확장 만들기를 요청하세요. 직접 활성화하고 정확한 코드 해시를 승인하기 전에는 아무것도 실행되지 않습니다.

이 섹션에는 새 초안을 만드는 동작도, 가져오기 컨트롤도 없습니다. 초안을 만들거나 고치는 일은 Professor Mari에게 요청하세요. Professor Mari는 코드를 저장할 수 있을 뿐, 승인하거나 활성화할 수는 없습니다.

직접 패키지를 작성하고 가져오려면 [개인 확장 작성 안내서](writing-personal-extensions.md)를 이용하세요. 직접 만든 패키지는 별도로 권한을 확인하는 External Extensions 흐름을 사용합니다.

## 검토와 활성화

모든 초안은 비활성화 상태로 시작합니다. Marinara는 실행될 코드 그 자체를 SHA-256으로 지문화합니다. 초안을 열어 코드를 살펴보고, 화면에 표시된 해시를 대조한 다음, 그 버전을 그대로 받아들일 때만 **Review and Run**(검토 및 실행)을 선택하세요. 실행 코드를 조금이라도 수정하거나 이전 개정판을 되살리면 확장이 비활성화되고 승인을 처음부터 다시 받아야 합니다.

샌드박스는 권한을 줄여 줄 뿐, 아무 코드나 믿어도 되게 만들어 주지는 않습니다. 악성 확장은 감시 장치가 멈춰 세울 때까지 CPU를 낭비할 수 있고, 정해진 한도 안에서 자기 저장소를 가득 채울 수 있으며, 로그로 사람을 속일 수도 있습니다. 전체 페이지 확장은 그 격리를 의도적으로 포기합니다. 활성화하기 전에 코드를 반드시 검토하세요.

## 런타임 격리

Browser Extension은 불투명 출처(opaque origin) 샌드박스 iframe 안의 전용 Worker에서 실행됩니다. Marinara의 페이지, DOM, 쿠키, 브라우저 저장소, 출처 API, 네트워크에는 접근할 수 없습니다. 쓸 수 있는 기능은 전용 확장 저장소, 로깅, 관리형 타이머, 정리 콜백 등록, 제한된 창, 안전한 호스트 기여 슬롯, 그리고 현재 채팅과 캐릭터 ID의 읽기 전용 스냅샷뿐입니다. 현재 채팅의 캐릭터 카드나 선택된 페르소나에서 일부 필드를 받아 볼 수도 있지만, 해당 권한을 매니페스트에 선언하고 승인받은 경우에만 가능합니다.

확장은 `marinara.ui.registerContribution(...)`으로 상단 막대 동작, Extensions 메뉴 항목, 오른쪽에 고정되는 패널을 추가할 수 있습니다. 이런 화면 요소는 Marinara가 현재 테마와 정해진 컨트롤 묶음으로 그립니다. 제목, 텍스트, 서식이 고정된 출력, 버튼, 텍스트 입력란, 선택 목록, 토글, 슬라이더, 색상 컨트롤, 여백입니다. 확장이 넘기는 것은 내용과 상태뿐이며, HTML, CSS, URL, React 컴포넌트, 호스트 이벤트 핸들러는 넘길 수 없습니다.

이 UI 기능과 규칙은 출처와 상관없이 샌드박스에서 실행되는 모든 Browser Extension에 똑같이 적용됩니다. 가져온 서드파티 확장(External Extension)도 이 안전한 런타임을 씁니다. 패키지가 **Full page access**(페이지 전체 접근)를 명시적으로 요청하거나 아래에서 설명하는 샌드박스 이전 형식인 `marinara.extension`을 쓰는 경우만 예외입니다.

### Marinara가 그리는 패널 추가하기

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

간단한 동작에는 `kind: "button"`을, Extensions 메뉴 동작에는 `kind: "menu-item"`을 쓰세요. 버튼의 기본값은 `surface: "top-bar"`입니다. 대신 `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents`, `settings`를 대상으로 삼고 `position`을 `header`, `before-content`, `after-content`로 설정할 수 있습니다. `icon`에는 Marinara가 지원하는 kebab-case Lucide 아이콘 이름을 쓸 수 있습니다. 두 동작 모두 `onActivate`를 호출합니다. `panel`은 열릴 때 `onActivate`를 호출하며 버튼은 모든 패널 컨트롤의 현재 값과 함께 `onEvent`를 호출합니다. 핸들은 종류별 업데이트를 지원합니다. `button`은 `label`, `description`, `icon`, `surface`, `position`을, `menu-item`은 `label`, `description`, `icon`을, `panel`은 `label`, `description`, `icon`, `elements`를 받습니다. 모든 핸들은 `remove()`를 지원합니다. ID에는 영문자, 숫자, `.`, `_`, `-`를 넣을 수 있습니다.

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

복잡한 도구라면 이벤트가 발생한 뒤 패널 요소를 갱신하는 식으로 여러 단계짜리 화면을 만들 수 있습니다. 앱의 상태는 `marinara.storage`에 두세요. 마크업 안에 상태를 심지 마세요.

### 현재 채팅 컨텍스트 사용하기

Browser Extension API 버전 5는 Marinara에 지금 표시된 채팅의 불투명 식별자를 제공합니다.

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

`marinara.context.get()`은 구독하지 않고 같은 현재 스냅샷만 돌려줍니다. 활성화된 채팅이 없으면 `chatId`는 `null`이고 `characterIds`는 비어 있습니다. `characterId`는 캐릭터가 정확히 한 명 참여할 때만 채워집니다. 그룹 채팅에서는 참여자 전원이 `characterIds`로 나오고 `characterId`는 `null`로 남습니다. `personaId`는 `read_active_persona`가 승인된 경우에만 채워집니다.

채팅 ID와 캐릭터 ID는 항상 제공되므로, 확장이 자기 전용 저장소를 채팅별로 나눠 쓸 수 있습니다. 레코드의 필드를 받으려면 확장 매니페스트에 아래 선택 권한 중 하나 또는 둘 다가 필요합니다.

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters`는 현재 채팅에 참여 중인 카드 정보를 `characters`에 채웁니다.
- `read_active_persona`는 현재 채팅에서 선택된 페르소나 정보를 `persona`에 채웁니다.

권한이 없으면 값은 각각 `[]`와 `null`로 남습니다. Marinara는 요청된 권한을 모두 **Requested access**(요청된 접근 권한)에 보여 주고, 정확한 해시를 승인하는 창에서 다시 한번 보여 줍니다. 권한을 추가하거나 빼면 실행 코드의 해시가 달라져 확장이 비활성화되고 승인을 다시 받아야 합니다.

캐릭터 스냅샷에 들어가는 것은 `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe`, `conversationDisplayName`뿐입니다. 페르소나 스냅샷에 들어가는 것은 `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe`, `conversationDisplayName`뿐입니다. 텍스트는 샌드박스 경계를 넘기 전에 길이가 제한됩니다.

Marinara는 메시지, 제작자 노트, 시스템 프롬프트, 후행 지시문, 주석, 아바타 경로, 캐릭터나 페르소나 라이브러리 전체, 선언하지 않은 필드, 채팅 메타데이터, 데이터베이스 핸들, 네트워크 접근, 변경 작업을 절대 넘기지 않습니다. 컨텍스트 갱신도 승인된 코드 해시에 묶여 있으며, 현재 채팅이나 그 캐릭터 목록, 선택된 페르소나가 바뀔 때 전달됩니다.

### 구형 확장과 전체 페이지 확장

날씨 조절기, 프롬프트 편집기를 비롯한 묵직한 워크플로도 기여 기능으로 만들기에 알맞은 사례입니다. 이런 도구를 안전하게 옮길 때는 메뉴나 상단 막대의 실행 버튼에 단계별로 갱신되는 패널을 붙이면 됩니다. 다만 DOM 오버레이를 끼워 넣거나, Marinara의 CSS 선택자를 조회하거나, React 내부 구조를 훑거나, 동일 출처 `/api` 경로를 호출하는 기존 패키지는 그대로는 안전한 런타임으로 가져올 수 없습니다.

UI 기여는 화면을 제공할 뿐, 주변 권한까지 주지는 않습니다. 컨텍스트 API는 현재 채팅 ID와 캐릭터 ID를 항상 제공하고, 그 밖에는 위에 적힌 대로 선언된 현재 레코드 필드만 제공할 수 있습니다. 메시지, 프리셋, 로어북, 선언하지 않은 캐릭터나 페르소나 데이터, 장면 시각 효과가 필요한 기능이라면 Marinara가 따로 좁게 열어 주는 중개 기능이 있어야 합니다. 확장이 호스트 DOM 접근이나 제한 없는 네트워크 요청으로 그것을 흉내 내서는 안 됩니다.

External Extension이 정말로 호스트 DOM 접근에 의존한다면 다음과 같이 요청할 수 있습니다.

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**페이지 전체 접근은 샌드박스 기능이 아닙니다.** 승인된 JavaScript와 CSS가 Marinara의 페이지 안에서 그대로 실행됩니다. 이 코드는 현재 브라우저 세션에 보이는 것이라면 무엇이든 읽거나 바꿀 수 있고, 채팅과 카드를 들여다보고, 브라우저 저장소를 쓰고, 네트워크 요청을 보내고, 동일 출처의 Marinara API를 호출할 수 있습니다. 브라우저 콘솔에 코드를 붙여넣어 실행하는 것과 실질적으로 같은 권한입니다. Professor Mari가 만든 초안은 이 권한을 요청할 수 없습니다.

Marinara는 `capabilities` 필드가 없는 구형 `kind: "marinara.extension"` v1 형식을 샌드박스 이전 패키지로 인식하고, 가져오는 시점에 **Full page access**를 부여합니다. 덕분에 WeatherTweaker 같은 구형 패키지가 Worker 안에서 조용히 실패하지 않고 올바른 검토 절차를 밟게 됩니다. 이 형식을 쓰면서도 안전한 런타임을 원하는 최신 패키지라면 `"capabilities": []`를 넣어야 합니다.

External Extension의 두 단계 안전장치와 정확한 해시 승인은 이 경우에도 그대로 적용됩니다. 코드, CSS, 권한이 바뀌면 확장이 비활성화되고 승인을 다시 받아야 합니다. 비활성화하면 Marinara가 넣어 둔 스크립트와 스타일시트 노드를 제거하고, 호환 API로 만든 타이머를 취소하고, `marinara.onCleanup(...)`으로 등록한 콜백을 실행합니다. 다만 페이지 코드는 등록되지 않은 리스너, 타이머, 전역 변수, DOM 변경을 만들어 낼 수 있어서 정리는 최선을 다하는 수준입니다. 확장을 비활성화한 뒤에도 흔적이 남아 있으면 페이지를 새로 고치세요.

구형 `marinara.ui.showWindow(...)` API도 그대로 쓸 수 있으며, 불투명 출처 iframe 안에 임시 창을 띄웁니다. 컨트롤 묶음은 동일하고 `update(...)`와 `close()` 핸들을 돌려줍니다. 도구를 Marinara의 평소 내비게이션으로 열 수 있게 하려면 기여 기능 쪽을 쓰세요.

Server Extension은 macOS Seatbelt나 Linux Bubblewrap 안에서 권한이 제한된 별도의 Node 프로세스로 실행됩니다. Marinara 파일, 사용자 파일, 상속된 서버 비밀 정보, 네트워크, 자식 프로세스, 워커, 네이티브 애드온에는 접근할 수 없습니다. 지원되는 운영체제 샌드박스를 Marinara가 마련하지 못하면 Server Extension은 계속 비활성화 상태로 남습니다.

### 플랫폼 지원

Browser Extension은 브라우저 자체가 격리해 주므로 어디서나 동작합니다. Server Extension에는 지원되는 운영체제 샌드박스가 필요합니다. 샌드박스가 없는 환경에서는 비활성화 상태로 남아 켤 수 없습니다. Marinara는 샌드박스 없이 실행하는 방식으로 물러서지 않습니다.

| 플랫폼                     | 샌드박스 Browser Extension | 전체 페이지 External Extension | Server Extension                       |
| -------------------------- | -------------------------- | ------------------------------ | -------------------------------------- |
| macOS                      | ✅ 샌드박스 적용           | ⚠️ 명시적 신뢰 필요            | ✅ 샌드박스 적용(Seatbelt)             |
| Linux(Bubblewrap 있음)     | ✅ 샌드박스 적용           | ⚠️ 명시적 신뢰 필요            | ✅ 샌드박스 적용(Bubblewrap)           |
| Linux(`bwrap` 없음)        | ✅ 샌드박스 적용           | ⚠️ 명시적 신뢰 필요            | ⛔ 비활성화. `bwrap`을 설치하세요      |
| Windows                    | ✅ 샌드박스 적용           | ⚠️ 명시적 신뢰 필요            | ⛔ 비활성화. Browser Extension을 쓰세요 |
| Android                    | ✅ 샌드박스 적용           | ⚠️ 명시적 신뢰 필요            | ⛔ 비활성화. Browser Extension을 쓰세요 |

Windows와 Android에는 지원되는 운영체제 프로세스 샌드박스가 없어서 Server Extension을 설계상 쓸 수 없습니다. 대신 Browser Extension을 쓰거나, Server Extension이 꼭 필요하다면 Marinara 서버를 macOS나 Linux(`bwrap` 설치 필요)에서 실행하세요.

## 외부 확장

서드파티 가져오기는 기본적으로 잠겨 있고 화면에도 나오지 않습니다. 두 단계를 거쳐야 합니다.

1. Marinara를 실행하는 호스트의 `.env`에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정하세요.
2. **Settings** > **Advanced**(고급) > **Danger Zone**(위험 구역)을 열고, 데이터 삭제 컨트롤 아래까지 스크롤한 다음, 경고문을 읽고 **Allow third-party extension imports**(서드파티 확장 가져오기 허용)를 활성화하세요.

그제서야 **Settings** > **Addons**에 **External Extensions**(외부 확장)가 나타나고 파일과 폴더 가져오기 컨트롤을 쓸 수 있습니다. 지원 형식은 항상 아래와 같이 펼쳐져 표시됩니다.

- `.personal-extension.zip` 및 호환되는 `.zip` 패키지
- `.json` 매니페스트
- `.css`
- `.js`, `.mjs`, `.cjs`
- `.server.js`, `.server.mjs`, `.server.cjs`

가져오기만으로는 승인이 따라오지 않으며, 확장이 스스로 활성화할 수도 없습니다. 구형 레코드, 프로필로 가져온 레코드, 수동으로 저장한 레코드, 출처를 알 수 없는 레코드도 외부 확장으로 취급합니다. 이런 레코드는 숨겨진 채로 승인할 수 없고, 두 안전장치가 모두 열리기 전까지는 양쪽 런타임에서 제외됩니다.

정확한 해시를 승인하기 전에 **Requested access** 목록을 확인하세요. 대부분의 Browser Extension은 안전한 샌드박스 안에 그대로 두는 편이 좋습니다. **Full page access**가 표시된 패키지는 의도적으로 격리되지 않으므로, 코드를 직접 살펴보고 그 버전을 신뢰할 수 있을 때만 활성화하세요.

두 안전장치 중 하나라도 끄면 실행 중인 외부 서버 프로세스가 멈추고, 브라우저 워커와 전체 페이지 런타임 노드가 제거되며, 저장된 외부 레코드가 비활성화됩니다. 안전장치를 다시 열어도 확장이 자동으로 다시 실행되지는 않습니다. 전체 페이지 확장이 정리 대상으로 등록하지 않은 변경을 남겼다면 페이지를 새로 고치세요.

서드파티 확장에는 악성 코드나 위험한 코드가 들어 있을 수 있습니다. 다운로드, 가져오기, 활성화 전에 항상 모든 줄을 확인하세요. 진행에 따르는 책임은 전적으로 본인에게 있습니다.

## 내보내기, 개정판, 복구

확장의 내보내기 동작을 쓰면 옮겨 쓸 수 있는 패키지를 다운로드할 수 있습니다. 내보낸 패키지와 복원한 패키지는 비활성화 상태를 유지합니다. 개정판을 되살릴 때도 비활성화된 초안으로 돌아갑니다.

확장이 이상하게 동작하면 **Disable**(비활성화)를 선택하세요. 화면을 쓸 수 없는 상황이라면 Marinara를 종료하고 해당 `installed_extensions` 레코드의 `enabled` 값을 `"false"`로 바꾸세요. `approvedHash`는 절대 직접 손대지 마세요.

## 관련 가이드

- [개인 확장 작성하기](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
- [Marinara 백업과 복원](../data/backup-and-restore.md)
- [원격 접근](../REMOTE_ACCESS.md)
