# Personal Extension 아키텍처

Personal Extension(개인 확장 기능)은 기본적으로 비활성화된 상태이며, 해시로 승인된 코드를 서로 격리된 두 가지 런타임에서 실행합니다. 기본 상태에서 쓸 수 있는 확장 종류는 Professor Mari가 만든 초안뿐입니다. 그 밖의 출처는 모두 External Extension(외부 확장 기능)이며, 서로 독립적인 관문 두 개를 열어야 동작합니다.

## 보안 불변 조건

다음 성질은 항상 유지되어야 합니다:

1. 새로 만들거나 가져오면 언제나 비활성화된 미승인 초안이 만들어집니다.
2. 승인하려면 현재 콘텐츠 해시(`sha256:`)가 정확히 일치해야 하고, 코드 실행에 대한 명시적 동의도 필요합니다. 페이지 전체 접근에는 별도의 명시적 동의가 한 번 더 필요합니다.
3. 실행 코드가 조금이라도 바뀌면 확장이 비활성화되고 `approvedHash`가 지워집니다.
4. 롤백하면 비활성화된 초안 상태로 되돌아갑니다.
5. 백업이나 프로필을 가져오면 승인 상태와 활성화 상태가 모두 해제됩니다.
6. Professor Mari는 초안을 만들고 수정할 수 있지만, 초안을 승인하거나 활성화하는 동작은 하나도 갖고 있지 않습니다.
7. `professor_mari`가 아닌 출처는 전부 외부로 취급합니다. `external`, `local`, `legacy`, `profile_import`은 물론이고, 알 수 없는 값이 `legacy`로 정규화된 경우도 포함합니다.
8. `ENABLE_EXTERNAL_EXTENSIONS=true`이면서 저장된 **Danger Zone**(위험 구역) 동의까지 켜져 있지 않으면, 외부 레코드는 관리 응답에도 런타임 응답에도 나타나지 않습니다.
9. 둘 중 어느 관문이든 닫히면 저장된 외부 레코드가 비활성화되고 실행 중인 서버 프로세스가 중지됩니다. 브라우저 런타임 폴링은 동작 중인 브라우저 워커를 제거합니다.
10. 샌드박스에서 실행되는 Browser 코드는 Marinara 문서 안에서 절대 실행되지 않습니다. 정확한 해시로 `full_page_access`를 승인받은 외부 Browser Extension(브라우저 확장)만 별도의 페이지 런타임을 쓸 수 있습니다. Server 코드는 Marinara 서버 프로세스 안에서 절대 실행되지 않습니다.
11. URL 설치 기능, 원격 카탈로그, 자동 업데이트 기능은 존재하지 않습니다.
12. 호스트 기여물은 검증을 거친 단순 디스크립터입니다. 확장의 마크업, 스타일, URL, 컴포넌트, 콜백은 Marinara의 React 트리 안으로 절대 넘어오지 않습니다.
13. 기여물의 등록, 활성화, 이벤트, 업데이트, 제거는 모두 활성화된 확장의 승인된 콘텐츠 해시에 정확히 묶여 있습니다.
14. 브라우저 컨텍스트 스냅샷은 기본적으로 현재 채팅 ID와 캐릭터 ID만 담습니다. 선택 권한인 `read_active_characters`와 `read_active_persona`를 쓰면 그 채팅에서 활성 상태인 레코드에 한해 허용 목록에 있는 필드가 제한된 범위로 추가됩니다. 메시지, 라이브러리 전체, 선언하지 않은 필드, 메타데이터, 앱 접근 권한은 어떤 경우에도 노출되지 않습니다.
15. 요청한 권한도 실행 코드 해시에 포함됩니다. 권한이 하나라도 바뀌면 확장이 비활성화되고, 정확한 해시로 다시 승인해야 합니다.
16. `full_page_access`는 외부 확장 전용이며, External Extension 관문 두 개를 모두 열어야 하고, Professor Mari 초안에는 절대 부여되지 않습니다. 이것은 명시적으로 신뢰를 부여하는 모드일 뿐, 샌드박스가 적용된다는 뜻이 아닙니다.

관문은 라우트와 런타임 서비스에서 강제합니다. 컨트롤을 화면에서 숨기는 것은 보안 경계가 아닙니다. 손으로 추가했든, 복원했든, 예전 형식이든, 정상 경로 밖에서 들어왔든, 외부 레코드는 관문 하나만 닫혀 있어도 보이지도 실행되지도 않아야 합니다.

## 저장 방식과 정책

`installed_extensions` 파일 테이블에는 메타데이터, 실행 코드, `contentHash`, `approvedHash`, 출처, 그리고 이전 실행 코드 리비전이 최대 10개까지 저장됩니다. 확장 전용 비공개 설정은 `extension-storage:` 접두사가 붙은 `app_settings` 키를 씁니다. **Danger Zone** 동의 값은 `external-extensions-enabled`에 저장합니다.

앱을 시작하면 `preparePersonalExtensionTrust`가 실행됩니다. 해시가 없는 예전 행은 지우지 않고 남기되 비활성 및 미승인 상태로 만듭니다. 저장된 해시가 실행 코드 필드와 더 이상 맞지 않는 행도 비활성화하고 해시를 다시 계산합니다.

`personal-extension-policy.service.ts`는 실행 중인 `.env` 관문과 저장된 사용자 동의를 함께 확인합니다. `personal-extension-storage.service.ts`는 Professor Mari가 만들지 않은 레코드를 전부 비활성화할 수 있습니다. `.env` 감시기는 약 2초 안에 정책을 다시 적용하고, 관문이 닫히면 서버 런타임에 코드 중지를 요청합니다.

## API

관리용 API는 `/api/personal-extensions` 아래에 있습니다:

- `GET /policy`는 두 관문의 상태와 서버 샌드박스 사용 가능 여부를 반환합니다.
- `PATCH /policy/external`은 **Danger Zone** 동의 값을 바꾸며, `.env` 관문이 열려 있지 않으면 `true`로 바꾸는 요청을 거부합니다.
- `GET /`은 Professor Mari 초안을 나열하고, 두 관문이 모두 열려 있을 때만 외부 초안도 함께 나열합니다.
- `POST /`는 External Extension을 가져오며, 두 관문이 모두 열려 있지 않으면 거부됩니다.
- `PATCH /:id`는 초안을 수정하거나 비활성화합니다.
- `POST /:id/approve`는 현재 해시를 그대로 승인하고 외부 관문 정책을 적용하며, 지원되는 OS 샌드박스가 없으면 Server 확장 승인을 거부합니다.
- `POST /:id/rollback`은 이전 리비전을 비활성 상태로 복원합니다.
- `DELETE /:id`는 확장과 비공개 설정을 함께 삭제합니다.

승인된 Browser 런타임 메타데이터는 `GET /runtime/client`에서 읽습니다. 샌드박스 코드는 `GET /:id/sandbox.html?hash=...`이 제공합니다. 전체 페이지 코드와 CSS는 `GET /:id/page-runtime.js?hash=...`과 `GET /:id/page-style.css?hash=...`이 제공합니다. 모든 엔드포인트는 해당 해시가 여전히 활성 상태이고 승인되어 있으며 정책상 허용되는지 정확히 확인합니다. 페이지 엔드포인트는 여기에 더해 출처가 외부여야 하고 `full_page_access` 권한도 있어야 합니다.

## 샌드박스 Browser 런타임

`PersonalExtensionInjector.tsx`는 `sandbox="allow-scripts"`만 지정하고 `allow-same-origin`은 빼둔 숨김 iframe을 만듭니다. 그래서 이 iframe은 불투명 출처(opaque origin)를 가지며, Marinara의 DOM, 쿠키, 저장소, 동일 출처 API에 접근할 수 없습니다.

샌드박스 응답은 일반 페이지 정책 대신 아주 좁은 CSP를 적용합니다. 기본 리소스, 연결, 폼, 오브젝트, 내비게이션 권한이 모두 없습니다. 확장의 CSS는 숨김 iframe 안에만 머무릅니다. JavaScript는 신뢰된 iframe 부트스트랩이 만든 전용 Worker에서 실행됩니다. 네트워크 전역 객체와 중첩 워커 전역 객체는 심층 방어 차원에서 제거합니다.

워커가 받는 것은 다음뿐입니다:

- 이름 공간이 붙은 로깅;
- 부모가 중개하는 확장 전용 비공개 저장소;
- 관리되는 타이머;
- 정리 작업 등록;
- `marinara.context`를 통해 얻는 읽기 전용 현재 채팅 ID와 캐릭터 ID;
- 별도로 승인된 기능 권한을 통해서만 얻는, 활성 캐릭터 카드와 선택된 페르소나의 제한된 필드;
- `marinara.ui.showWindow(...)`로 여는 제한된 iframe 창;
- `marinara.ui.registerContribution(...)`으로 등록하는 신뢰된 호스트 기여물 슬롯.

Browser Extension API 버전 5에는 `marinara.context.get()`과 `marinara.context.subscribe(listener)`가 추가되었습니다. 변경 불가능한 스냅샷의 형태는 다음과 같습니다:

```ts
{
  chatId: string | null;
  characterId: string | null;
  characterIds: readonly string[];
  personaId: string | null;
  characters: readonly PersonalExtensionCharacterSnapshot[];
  persona: PersonalExtensionPersonaSnapshot | null;
}
```

클라이언트는 `useChatStore`에서 스냅샷을 만들고, 현재 채팅이나 그 채팅의 캐릭터 목록, 선택된 페르소나가 바뀔 때마다 전달합니다. ID는 비어 있지 않은 문자열이며 최대 256자입니다. 캐릭터 목록은 중복을 제거하고 최대 256개까지만 담습니다. iframe은 부모가 보낸 컨텍스트 업데이트만, 그것도 `contentHash`가 해당 확장 리비전과 정확히 일치할 때만 받아들이고, 이어서 Worker가 페이로드를 다시 정규화하고 동결합니다. 확장은 시작할 때 호스트의 첫 스냅샷을 기다리며, 1초가 지나면 널 컨텍스트로 대체합니다. 브리지가 실패해도 Worker가 무한정 멈춰 있지 않도록 하기 위해서입니다.

`characterId`는 1대1 채팅에서 쓰기 편하도록 둔 값이라 그룹 채팅에서는 `null`입니다. 참여 중인 캐릭터 전체는 `characterIds`에 들어 있습니다. `personaId`는 `read_active_persona` 권한이 있을 때만 제공합니다. 활성 채팅이 없으면 `chatId`, `characterId`, `personaId`, `persona`가 `null`이고, `characterIds`와 `characters`는 비어 있습니다. 확장은 이 식별자들을 자기 비공개 저장소의 키로 안전하게 쓸 수 있습니다.

`read_active_characters`를 승인하면 `characters`에는 활성 캐릭터 카드의 `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe`, `conversationDisplayName`만 담깁니다. `read_active_persona`를 승인하면 `persona`에는 `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe`, `conversationDisplayName`만 담깁니다. 서버는 두 묶음을 모두 활성 채팅에서 직접 만들고, 필드별 한도와 전체 한도를 적용하며, 클라이언트가 보낸 레코드 ID를 범위의 근거로 삼지 않습니다.

기능 권한은 확장 페이로드에 선언하고, 리비전마다 함께 저장하며, **Settings**(설정)와 승인 창에 표시하고, 실행 코드 해시에도 포함합니다. 호스트는 먼저 ID만 담긴 스냅샷을 보내고, 승인된 확장별 브로커를 통해 내용을 채웁니다. Worker는 여기에 더해 스스로 한 번 더, 선언하지 않은 레코드를 버리고, `characterIds`에 없는 ID의 캐릭터 레코드를 거부하고, 페이로드 크기를 다시 제한한 뒤 결과를 동결합니다.

`marinara.ui.showWindow({ title, elements, onEvent, onClose })`는 `update({ title?, elements? })`와 `close()`를 가진 핸들을 반환합니다. 워커는 디스크립터만 보내고, 실제 요소는 신뢰된 iframe 부트스트랩이 DOM API와 `textContent`로 만듭니다(`innerHTML`은 쓰지 않습니다). 평소 숨겨 두는 샌드박스 iframe은 창이 열려 있는 동안에만 보이고, 창을 닫으면 다시 숨깁니다.

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, surface?, position?, elements?, onActivate?, onEvent? })`는 `update(patch)`와 `remove()`를 가진 동결된 핸들을 반환합니다. 다음과 같은 신뢰된 호스트 위치를 지원합니다.

- `button`: 기본적으로 상단 막대의 작은 동작 버튼이며, 또는 `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents`, `settings` 화면에 호스트가 렌더링하는 동작입니다.
- `menu-item`: **Extensions** 메뉴의 동작 항목;
- `panel`: Marinara의 신뢰된 **Extensions** 사이드 패널을 여는 항목.

사이드 패널 버튼은 `position: "header"`, `"before-content"`, `"after-content"`를 받습니다. 상단 막대 버튼은 `position`을 생략합니다. 아이콘은 Marinara의 Lucide 아이콘 카탈로그에 있는 제한된 kebab-case 이름을 사용하며, 지원하지 않는 이름은 퍼즐 아이콘으로 대체됩니다.

패널 요소는 제한된 창과 똑같은 선언형 어휘를 씁니다. `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color`, `spacer`입니다. 조작할 수 있는 컨트롤에는 고유한 ID가 필요합니다. 패널 버튼을 누르면 `{ contributionId, elementId, values }`가 `onEvent`로 전달되고, `values`에는 모든 컨트롤의 현재 문자열 값이 들어 있습니다. `onActivate`는 기여물을 열거나 실행할 때 확장 Worker 안에서 실행됩니다. 상태가 바뀐 뒤 라벨, 설명, 아이콘, 패널 요소를 바꾸려면 `handle.update(...)`를 호출하면 됩니다.

클라이언트는 각 디스크립터를 런타임 저장소에 넣기 전에 독립적으로 검증합니다. 기여물 종류, 화면, 위치, 컨트롤, ID, 선택지 목록, 아이콘 이름 구문, 텍스트 길이, 패널 전체 텍스트 양, 요소 개수, 확장당 기여물 개수를 검증하고 제한합니다. React는 확장 텍스트를 텍스트로 렌더링합니다. 확장이 제어하는 HTML, CSS, URL, React 컴포넌트, 호스트 콜백은 받지 않습니다. 워커가 중지되거나, 해시가 바뀌거나, 승인된 런타임 응답에서 사라지면 호스트가 모든 기여물을 제거합니다. 이벤트는 확장 ID와 콘텐츠 해시가 같은 워커에만 전달합니다.

DOM 조작 수단, Marinara API 호출, 부모 이벤트 접근, 임의의 네트워크 기능은 제공하지 않습니다. iframe은 메시지를 검증하고 전송 빈도를 제한합니다. 하트비트 감시기는 응답이 없거나 무한 루프에 빠진 워커를 종료합니다.

## 전체 페이지 호환 런타임

설정이 많은 도구나 여러 단계를 거치는 워크플로에도 기여물 프로토콜이 여전히 권장 방식입니다. 복잡한 확장이라면 패널 요소를 단계적으로 바꿔 가면서 자체 상태를 확장 전용 비공개 저장소에 보관할 수 있습니다.

호스트 선택자로 버튼을 끼워 넣거나, React 내부를 훑거나, 임의의 오버레이를 그리거나, 동일 출처 `/api` 경로를 호출하는 기존 예전 패키지는 안전 런타임에서 그대로 동작하지 않습니다. 되도록 기여물 디스크립터와 좁은 브로커 기능 권한을 쓰도록 옮기세요.

호환을 위해 호스트 페이지가 정말 필요하다면 External Extension이 `full_page_access`를 요청할 수 있습니다. `PersonalExtensionInjector.tsx`는 승인된 바로 그 리비전을 동일 출처 스크립트 요소로 불러오고, 필요하면 스타일시트도 함께 불러옵니다. 코드는 async 함수 안에서 실행되며, 식별 정보, 로깅, 비공개 저장소, 관리되는 타이머, 정리 작업 등록만 담은 작은 호환용 `marinara` 객체를 받습니다. 페이지의 주변 전역 객체는 그대로 쓸 수 있는데, 바로 그 권한을 요청한 결과이기 때문입니다.

페이지 로더는 코드를 실행하기 전에 `id`, 이름, 콘텐츠 해시를 런타임 메타데이터와 대조합니다. 서버는 스크립트나 스타일시트 요청이 올 때마다 정확한 해시, 활성화 상태, 외부 출처, 권한, 두 관문 정책을 따로 다시 확인합니다. 관문이 닫히면 레코드가 비활성화되고, 이어지는 런타임 폴링이 주입된 노드를 제거하면서 가능한 범위에서 정리를 수행합니다. 전체 신뢰 권한으로 실행된 페이지 코드가 이미 만들어 놓은 부수 효과까지 되돌릴 수는 없으므로, 화면에는 새로고침이 필요할 수 있다는 경고가 표시됩니다.

`kind: "marinara.extension"`이면서 `capabilities`를 명시하지 않은 예전 패키지를 가져오면 `full_page_access`가 부여됩니다. 요즘 내보내기는 빈 배열이라도 capabilities 필드를 항상 기록하므로, 안전한 패키지를 다시 가져와도 잘못 분류되지 않습니다.

## Server 런타임

Server 코드는 별도의 Node 프로세스에서 실행되며, 서버 프로세스 안으로 import하는 방식은 절대 쓰지 않습니다. Node의 권한 모델이 파일 시스템, 네트워크, 자식 프로세스, 워커, 네이티브 애드온, WASI, 인스펙터 기능을 모두 차단합니다. 자식 프로세스는 여기에 더해 다음 환경 안에서 실행됩니다:

- macOS Seatbelt; 또는
- PID, 네트워크, IPC, 마운트 네임스페이스를 각각 분리한 Linux Bubblewrap.

샌드박스에는 최소한의 환경 변수, 작은 V8 힙, 그리고 전용 임시 폴더 안에 있는 크기가 제한된 줄 단위 프로토콜 파일만 주어집니다. 앱 파일과 서버 비밀 값은 주어지지 않습니다. 쓸 수 있는 기능은 로깅, 확장 전용 비공개 저장소, 관리되는 타이머, 정리 작업 등록뿐입니다. 메시지 할당량과 별도의 하트비트 파일이 프로토콜 폭주와 무한 루프를 막습니다.

Node 권한과 `node:vm`은 심층 방어 계층일 뿐 보안 경계가 아닙니다. 별도의 OS 샌드박스는 반드시 있어야 합니다. Windows, Android, `bwrap`이 없는 Linux를 비롯해 지원되지 않는 플랫폼에서는 Server Extension(서버 확장)을 활성화할 수 없습니다.

## 검증

다음을 실행하세요:

```bash
pnpm check
pnpm regression:extensions-security
pnpm regression:professor-mari-shell-sandbox
pnpm smoke:ui
```

보안 회귀 테스트는 다음을 증명해야 합니다. 2단계 관문, 정확한 해시가 아닐 때의 무효화, 불투명 출처 워커 구조, 크기가 제한되고 해시에 묶인 컨텍스트 스냅샷, 호스트 기여물 검증과 정리, 외부 전용 전체 페이지 라우팅과 동의 절차, 예전 패키지 분류, 환경 변수 제거, 파일 시스템과 네트워크 차단, 비공개 저장소, 그리고 샌드박스를 쓸 수 없을 때 안전하게 실패하는 동작입니다.
