# Personal Extensions 작성

Marinara Engine 확장 기능을 직접 작성하는 사용자를 위한 가이드입니다. 확장 기능 설치, 검토, 안전한 실행 방법은 먼저 [Personal Extensions](personal-extensions.md)를 확인하세요.

직접 작성하고 가져온 코드는 **External Extension**(외부 확장 기능)으로 취급됩니다. 처음에는 비활성화되어 있으며, 코드를 검사하고 정확한 SHA-256 해시를 승인하기 전에는 실행할 수 없습니다.

## 시작 전 준비

External Extensions는 다음 두 안전 게이트를 모두 열 때까지 숨겨집니다.

1. Marinara 호스트의 `.env` 파일에서 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정하세요.
2. **Settings** > **Advanced** > **Danger Zone**을 열고 **Allow third-party extension imports**를 활성화하세요.

확장 기능을 가져오고 관리하려면 localhost 접근 또는 설정된 **Admin Access**도 필요합니다. 휴대전화, LAN 주소 또는 원격 브라우저에서 Marinara를 사용한다면 서버에서 `ADMIN_SECRET`을 설정하고 **Settings** > **Advanced** > **Admin Access**에 같은 값을 입력하세요.

작업을 수행할 수 있는 런타임 중 권한이 가장 적은 것을 선택하세요.

| 런타임 | 용도 | 중요 경계 |
| --- | --- | --- |
| Sandboxed Browser Extension | 비공개 상태, 활성 채팅 컨텍스트, 버튼, 메뉴 동작, Marinara가 렌더링하는 패널 | Marinara DOM, 쿠키, 브라우저 저장소, 네트워크 또는 임의 HTML에 접근할 수 없음 |
| Server Extension | 관리형 타이머와 비공개 확장 기능 저장소가 필요한 백그라운드 로직 | 별도의 OS 샌드박스. Marinara 파일, 비밀 값, 네트워크, 자식 프로세스 또는 네이티브 모듈에 접근할 수 없음 |
| Full-page External Extension | Marinara 페이지 또는 동일 출처 API가 꼭 필요한 레거시 코드 | 샌드박스 없음. 내용을 정확히 검사했고 완전히 신뢰하는 코드에만 사용 |

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

1. **Settings** > **Addons** > **External Extensions**를 여세요.
2. **Import Folder**를 선택해 `Hello Panel`을 지정하거나, 폴더를 ZIP으로 압축해 가져오세요.
3. 비활성화된 초안을 열어 매니페스트와 JavaScript를 검사하세요.
4. **Review and Run**을 선택하고 표시된 정확한 해시를 승인하세요.
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
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | 확장 기능이 멈출 때 제거되는 관리형 타이머 |
| `onCleanup(callback)` | 추가 정리 로직 등록 |

일반 UI에는 [Marinara가 렌더링하는 패널](personal-extensions.md#add-a-marinara-rendered-panel)을 사용하고, 채팅을 인식하는 동작에는 [활성 채팅 컨텍스트](personal-extensions.md#use-active-chat-context)를 사용하세요. 확장 기능 상태는 브라우저 저장소가 아니라 `marinara.storage`에 저장해야 합니다.

`showWindow({ title, elements, onEvent, onClose })`는 `update({ title?, elements? })`와 `close()`가 있는 핸들을 반환합니다. 패키지 CSS는 샌드박스 iframe 창에 스타일을 적용합니다. 호스트가 렌더링하는 기여 요소에는 항상 Marinara의 테마와 컨트롤이 사용됩니다.

안전한 Browser 런타임에는 DOM 또는 네트워크 API가 없습니다. 이 경계를 우회하지 마세요. 유용한 기능이 없다면 기본적으로 전체 페이지 접근으로 전환하지 말고 범위가 좁은 호스트 기능을 요청하세요.

### 컨텍스트 기능

선택적 레코드 접근을 `config.capabilities`에 선언하세요.

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters`는 활성 채팅의 Character 카드에서 범위가 제한된 필드를 채웁니다.
- `read_active_persona`는 선택한 Persona에서 범위가 제한된 필드를 채웁니다.
- `full_page_access`는 샌드박스가 없는 호환 런타임을 선택하며 External Extensions에서만 사용할 수 있습니다.

기능을 변경하면 실행 파일 해시가 바뀌고 확장 기능이 비활성화되며 새 검토가 필요합니다.

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
| top-level `version` | 패키지 봉투 버전. 현재 `1` |
| `config.name` | 필수 표시 이름. 1-200자 |
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
- **Export**는 현재 매니페스트와 소스 파일을 이식 가능한 패키지로 내보냅니다. 승인은 내보내지지 않습니다.
- 리비전 복원, 프로필 가져오기 또는 백업 복원 후에는 다시 검토할 때까지 확장 기능이 비활성화됩니다.
- **Disable**은 런타임과 등록된 정리를 중지합니다. 전체 페이지 코드가 등록되지 않은 부작용을 만들었다면 페이지 새로 고침이 필요할 수 있습니다.
- **Delete**는 설치된 레코드를 삭제합니다. 나중에 소스가 필요할 수 있다면 먼저 내보내세요.

## 디버깅

| 증상 | 확인 사항 |
| --- | --- |
| 외부 가져오기 컨트롤이 보이지 않음 | 위에서 설명한 External Extension 게이트 두 개를 모두 열기 |
| 관리 화면에서 localhost 또는 Admin Access가 필요하다고 표시됨 | `ADMIN_SECRET`을 구성해 **Admin Access**에 저장하기 |
| 가져오기가 확장 기능을 찾지 못함 | `manifest.json`과 상대 경로 확인. Server에는 JS가 필요하고 Browser에는 CSS 또는 JS가 필요함 |
| 편집 후 확장 기능이 비활성화됨 | 예상된 동작. 새 정확한 해시를 검사하고 승인하기 |
| Browser 코드에서 `document`, `window`, `fetch` 또는 로컬 저장소를 사용할 수 없음 | 안전한 샌드박스에서는 예상된 동작. 문서화된 브로커 API 사용하기 |
| Server Extension을 사용할 수 없음 | macOS Seatbelt 또는 Bubblewrap이 있는 Linux를 사용하거나 Browser Extension으로 전환하기 |
| Browser Extension에서 예외 발생 | 브라우저 개발자 도구 열기. `marinara.log`와 시작 오류에는 확장 기능 이름이 태그로 표시됨 |
| Server Extension에서 예외 발생 | **Settings** > **Addons**에서 상태와 Marinara 서버 로그 확인하기 |

CSS, 비공개 저장소, 가져오기 아카이브, 런타임 메시지는 서로 다른 안전 제한을 유지합니다. Marinara는 실행 실패로 표시하는 대신 패키지를 거부한 경계를 보고해야 합니다.

## 관련 가이드

- [Personal Extensions](personal-extensions.md)
- [서버 구성](../CONFIGURATION.md)
- [문제 해결](../TROUBLESHOOTING.md)
- [Personal Extension 아키텍처](../development/personal-extensions.md)
