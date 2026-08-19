# 서버 설정 참고 문서

이 가이드에서는 환경 변수로 Marinara Engine의 서버 수준 설정을 바꾸는 방법을 설명합니다. 환경 변수는 서버가 읽어 들이는 일반 텍스트 파일에 적어 두는 설정값입니다. 대부분은 이 페이지를 볼 일이 없습니다. 전체 변수 목록은 문서 아래쪽에 있습니다.

## 어떨 때 Marinara를 설정하나요?

Marinara Engine은 설정하지 않아도 바로 동작합니다. 이 페이지가 필요한 경우는 몇 가지뿐이고, 대부분은 서버를 여러 기기에서 함께 쓸 때입니다.

다음과 같은 일을 하려면 설정을 바꿉니다.

- 같은 네트워크의 다른 기기가 서버에 접근하도록 허용하기(접근 제어).
- 여러 사람이 쓰는 서버를 비밀번호나 IP 허용 목록으로 보호하기.
- 데이터를 저장할 디스크 위치 바꾸기.
- 문제를 진단하려고 로그를 더 자세히 남기기.
- 느린 이미지, 동영상, 임베딩 작업에 시간을 더 주기(타임아웃).
- 백업이나 업데이트처럼 권한이 필요한 동작을 원격 기기에서 쓰도록 열어 주기.

AI 제공자 키, 캐릭터, 채팅 옵션 등 나머지는 거의 다 여기가 아니라 앱 안에서 설정합니다. AI 제공자를 추가하려면 [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요.

선택 설치용 공식 에이전트도 앱 안에서 관리합니다. **Agents → Download Agents**(에이전트 → 에이전트 다운로드)를 열어 설치하거나 제거하세요. Marinara는 Engine의 메이저 버전에 맞는 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 카탈로그 계열을 자동으로 선택합니다.

패키지의 수명 주기와 저장 위치는 다음과 같습니다.

- **업데이트:** Marinara는 이미 설치된 공식 패키지에 호환되는 업데이트가 있는지 확인하고, 새 버전을 다운로드하기 전에 매번 묻습니다. **No**를 선택하면 현재 버전을 그대로 두고, Download Agents의 수동 **Update** 동작은 계속 쓸 수 있습니다. 새로 설치한 직후에는 패키지를 고르기 전까지 비어 있습니다.
- **플랫폼:** 데스크톱, Docker, Termux로 돌리는 Android 설치 모두 동작이 같습니다. iOS를 비롯한 브라우저 클라이언트는 접속한 Marinara 호스트 서버에 설치된 패키지를 그대로 사용합니다.
- **유지:** 패키지는 `DATA_DIR/capability-packages` 아래에 저장됩니다. Docker 볼륨, 사용자 지정 데이터 폴더, 백업, 일반적인 업데이트에서 모두 보존됩니다.
- **오프라인 대응:** GitHub로 나가는 HTTPS 연결이 안 되거나, 업데이트를 거절했거나, 업데이트 검증에 실패해도 이미 설치된 패키지는 설치된 버전 그대로 계속 동작합니다.

### 사용자 지정 에이전트 가져오기

외부 에이전트 파일, 폴더, 사용자 지정 저장소는 기본적으로 잠겨 있습니다. 허용하려면 **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)을 열고 **Allow custom Agent imports**(사용자 지정 에이전트 가져오기 허용)를 켜세요. External Extensions와 달리 이 관문은 사용자가 직접 여는 것이라 환경 변수가 필요 없습니다. 켜기 전까지 가져오기 컨트롤은 회색으로 비활성 상태입니다.

가져올 때마다 해당 에이전트가 요구하는 기능을 저장 전에 먼저 보여 줍니다. 권한은 반드시 명시적으로 승인해야 하고, 함께 들어 있는 함수와 도구 선택은 가져오지 않으며, 생성된 CSS는 정제하고, 실행 결과 동작은 승인된 기능 범위와 대조해 검사합니다. 관문을 다시 끄면 외부에서 가져온 에이전트는 실행이 멈춥니다. Marinara 안에서 만든 사용자 지정 에이전트와 **Download Agents**로 설치한 공식 패키지는 이 관문과 무관하게 계속 실행됩니다.

### 사용자 지정 에이전트 저장소

사용자 지정 저장소는 프롬프트와 도구 선택이 검증되지 않은 서드파티 콘텐츠라서 기본적으로 비활성 상태입니다. `ENABLE_CUSTOM_AGENT_REPOS=true`를 설정하고, Danger Zone에서 **Allow custom Agent imports**를 켠 다음, **Agents → Download Agents → Custom Sources**(에이전트 → 에이전트 다운로드 → 사용자 지정 소스)를 열어 공개 GitHub 저장소를 미리 볼 수 있습니다. 소스를 추가할 때도, 이후 콘텐츠 변경을 적용할 때도 매번 명시적인 확인이 필요합니다. 동기화는 수동입니다. Marinara는 저장소를 복제하지도, 백그라운드에서 주기적으로 확인하지도 않습니다.

저장소 최상위에는 다운로드용 에이전트 패키지와 같은 에이전트 정의 형식을 쓰는 `agents.json` 배열이 있어야 합니다. 최소 구성은 다음과 같습니다.

```json
[
  {
    "id": "continuity-helper",
    "name": "Continuity Helper",
    "description": "Checks recent turns for contradictions.",
    "phase": "post_processing",
    "enabledByDefault": false,
    "category": "writer",
    "defaultPromptTemplate": "Check {{messages}} for continuity errors."
  }
]
```

Marinara는 GitHub 저장소 최상위 URL만 받아들이며, 미리보기를 띄우기 전에 크기가 제한된 압축 파일과 모든 에이전트 정의를 검증합니다. 동기화할 때는 원격의 프롬프트, 설정, 도구 값이 미리보기에 표시된 저장소 관리 값을 덮어씁니다. 연결과 이미지 선택은 로컬 값 그대로 남습니다. 원본에서 에이전트가 사라지면 Marinara는 그 에이전트를 일반 로컬 사용자 지정 에이전트로 남기고 저장소 연결만 끊습니다. 소스를 삭제할 때도 마찬가지로 로컬에 남깁니다.

### 외부 확장(External Extensions)

External Extension을 가져오려면 서로 독립된 두 가지 동의가 필요합니다. `.env`에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정한 다음, **Settings → Advanced → Danger Zone**을 열어 데이터 삭제 컨트롤 아래까지 스크롤하고, 경고문을 읽은 뒤 **Allow third-party extension imports**(서드파티 확장 가져오기 허용)를 켜세요. 두 가지가 모두 충족되어야 **Settings → Addons**(설정 → 애드온) 아래에 **External Extensions**(외부 확장) 항목이 나타납니다.

환경 변수는 서버 운영자의 허가이고, Danger Zone 토글은 사용자의 명시적인 수락입니다. 해당 항목, 가져오기 경로, 승인 경로, 두 가지 런타임 로더가 모두 이 결합된 정책을 적용합니다. 둘 중 하나만 닫아도 외부 기록은 비활성화되고 실행 중이던 외부 코드도 멈춥니다. 수동으로 저장한 기록, 예전 기록, 프로필로 가져온 기록, 출처를 알 수 없는 확장 기록은 모두 외부로 간주하므로, 확장 관련 폴더에 파일을 넣어 두는 방식으로는 이 관문을 우회할 수 없습니다.

Professor Mari가 만든 초안은 이 플래그 없이도 쓸 수 있습니다. 다만 비활성 상태로 만들어지고, 정확한 코드 해시에 대한 승인은 여전히 필요합니다.

기본값은 샌드박스로 격리된 Browser Extension입니다. 예전 서드파티 패키지 중 일부는 Marinara의 DOM에 의존해서 **Full page access**(페이지 전체 접근)로 표시됩니다. 이 방식은 승인된 코드를 Marinara 페이지 안에서 그대로 실행하므로 페이지 콘텐츠, 브라우저 저장소, 네트워크 API, 현재 동일 출처 세션에 접근할 수 있습니다. 두 관문이 모두 열린 External Extensions에서만 쓸 수 있고, 별도의 경고 확인도 거쳐야 합니다. 확장이 화면이나 동작에 흔적을 남긴다면 그 확장을 비활성화하고 페이지를 새로 고치세요.

## .env 파일의 위치

설정은 `.env`라는 파일에 들어 있습니다. 한 줄에 설정 하나씩 `KEY=value` 형태로 적는 일반 텍스트 파일입니다. `#`으로 시작하는 줄은 주석이라 서버가 무시합니다.

`.env` 파일은 셸 스크립트가 아니라 데이터입니다. Marinara는 값 안에 들어 있는 `$`, `$(...)` 같은 명령 치환, 그 밖의 셸 문법을 실행하지 않습니다. macOS/Linux 런처와 Termux 런처도 서버 시작 전에 필요한 몇 가지 설정에 같은 비실행 규칙을 적용합니다. 런처 환경에 이미 값이 들어 있으면 `.env`의 같은 항목보다 그 값이 우선합니다.

Marinara는 처음 시작할 때 빈 `.env`를 만들어 주므로 직접 만들 필요는 없습니다.

- 일반 설치에서는 `.env` 파일이 프로젝트 최상위 폴더에 있습니다.
- 공식 Docker 또는 Podman 이미지에서는 데이터와 같은 저장 볼륨 안의 `/app/data/.env`에 있습니다.

같은 폴더의 `.env.example` 파일에는 모든 설정과 기본값이 적혀 있습니다. 설정을 바꾸려면 `.env.example`에서 해당 줄을 `.env`로 복사한 뒤 `=` 뒤의 값을 고치세요.

포트를 바꾸고 비밀번호를 켜는 `.env` 예시는 다음과 같습니다.

```
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

서버는 어떤 방식으로 시작하든 `.env`를 스스로 읽습니다. `pnpm start`로 직접 실행할 때도 마찬가지입니다. 셸 런처(`start.bat`, `start.sh`, `start-termux.sh`)는 여기에 두 가지를 더합니다. 다른 기기가 서버에 접근할 수 있도록 `HOST=0.0.0.0`을 설정하고, 브라우저를 대신 열어 줍니다. `pnpm start`만 실행하면 `HOST`를 직접 설정하지 않는 한 서버는 이 컴퓨터에서만 접근할 수 있습니다.

## 재시작과 즉시 반영

Marinara는 실행 중에도 `.env` 파일을 지켜봅니다. 변경 사항을 저장하면 대부분의 설정이 약 2초 안에 재시작 없이 적용됩니다. 서버는 변경을 적용할 때마다 `[env-watcher]`로 시작하는 로그 줄을 남깁니다.

반면 저수준 설정 몇 가지는 서버가 시작될 때 값이 고정됩니다. 이들을 바꾸려면 완전히 재시작해야 합니다. 해당 설정은 다음과 같습니다.

- `PORT`, `HOST`
- `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`
- `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_UPDATE_ENABLED`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- 이미지, 동영상, 스프라이트, ComfyUI의 타임아웃 및 폴링 설정(`IMAGE_GEN_TIMEOUT_MS`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT`, 그리고 네 가지 `*_VIDEO_POLL_INTERVAL_MS` 설정)

이 중 하나가 바뀌면 로그에 재시작이 필요하다는 경고가 남습니다. `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, `CSRF_TRUSTED_ORIGINS` 같은 접근 제어 설정과 비밀 값은 재시작이 필요 없습니다.

## 접근 제어

접근 제어는 실행 중인 서버에 누가 접근할 수 있는지를 정합니다. 이 절은 빠른 참고용입니다. 예제와 함께 단계별로 따라가려면 [원격 접근: Basic Auth와 IP 허용 목록](REMOTE_ACCESS.md)을 읽어 보세요.

아래에서 쓰는 용어를 먼저 정리합니다.

- 루프백은 서버가 실행 중인 바로 그 컴퓨터를 뜻합니다. `127.0.0.1` 또는 `localhost`로 접근합니다.
- CIDR 범위는 `192.168.1.0/24`처럼 IP 주소 묶음 전체를 짧게 적는 방식입니다. CIDR은 Classless Inter-Domain Routing의 줄임말입니다.
- RFC 1918 범위는 가정과 사무실 네트워크 안에서 쓰는 표준 사설 주소 대역으로, `10.x.x.x`와 `192.168.x.x` 등이 여기에 해당합니다.

기본 상태에서 비밀번호를 설정하지 않으면 서버는 신뢰할 수 있는 출처에서 오는 연결만 받습니다. 루프백, `IP_ALLOWLIST`에 적힌 주소, Tailscale, 그리고 같은 호스트의 Docker 브리지/게이트웨이 트래픽이 여기에 해당합니다. 평소 쓰는 가정용 네트워크를 포함한 나머지 요청은 아래 방법 중 하나를 고르기 전까지 `403 Forbidden`을 받습니다.

주요 접근 제어 설정은 다음과 같습니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `BASIC_AUTH_USER` | 비어 있음 | 비밀번호 창에 쓸 사용자 이름. `BASIC_AUTH_PASS`와 함께 설정하면 로그인을 요구합니다. |
| `BASIC_AUTH_PASS` | 비어 있음 | 로그인 창의 비밀번호. 둘 중 하나라도 비워 두면 로그인이 꺼집니다. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | 브라우저 비밀번호 창에 표시되는 문구. |
| `IP_ALLOWLIST` | 비어 있음 | 항상 허용할 IP나 CIDR 범위를 쉼표로 구분해 적습니다. 루프백은 언제나 허용됩니다. |
| `IP_ALLOWLIST_ENABLED` | `true` | `false`로 두면 목록은 남기고 적용만 잠시 멈춥니다. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | 로그인을 설정하지 않았을 때 사설 네트워크에서 비밀번호 없이 접근하도록 되돌립니다. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | 공개 인터넷을 포함한 모든 주소에서 비밀번호 없이 접근하도록 허용합니다. 권장하지 않습니다. |
| `TRUSTED_PRIVATE_NETWORKS` | 내장 기본값 | 기본 사설 네트워크 범위를 대체합니다. 계속 쓰고 싶은 기본값은 직접 포함해야 합니다. |
| `BYPASS_AUTH_TAILSCALE` | 자동 | 비워 두면 직접 연결된 Tailscale 소켓의 양 끝이 모두 tailnet 주소를 쓸 때만 신뢰합니다. 예전처럼 `100.64.0.0/10` 전체를 우회하려면 `true`, 일반 접근 제어를 요구하려면 `false`로 설정하세요. |
| `BYPASS_AUTH_DOCKER` | 자동 | 비워 두면 감지된 컨테이너 인터페이스와 그 인터페이스의 정확한 게이트웨이만 신뢰합니다. 예전 구성이나 사용자 지정 네트워크와 호환하려면 `true`, 일반 접근 제어를 요구하려면 `false`로 설정하세요. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | 프록시를 거쳐 들어온 Docker 트래픽에도 일반 로그인과 허용 목록 검사를 적용합니다. 상위의 모든 클라이언트를 신뢰할 수 있을 때만 `false`로 두세요. |
| `TRUSTED_HOSTS` | 비어 있음 | Marinara가 응답해도 되는 공개 호스트명이나 리버스 프록시 호스트명을 추가합니다. 직접 IP, localhost, `.local`, `.home.arpa`, 점이 없는 LAN 이름은 자동으로 동작합니다. |
| `SSL_CERT` | 비어 있음 | TLS 인증서 파일 경로. `SSL_KEY`와 함께 설정하면 HTTPS를 직접 제공합니다. |
| `SSL_KEY` | 비어 있음 | TLS 개인 키 파일 경로. |
| `CSRF_TRUSTED_ORIGINS` | 비어 있음 | 변경 사항 저장을 허용할 브라우저 출처를 추가합니다. 공개 도메인이나 특이한 포트를 쓸 때 사용합니다. 리터럴 `null`은 무시되며 Android APK에 사용하면 안 됩니다. 자체 인증 로그인 경로는 불투명한 출처를 전역으로 신뢰하지 않아도 작동합니다. |

Basic Auth는 HTTP Basic Authentication의 줄임말로, 사용자 이름과 비밀번호를 묻는 간단한 방식입니다. 이때 자격 증명은 암호화되지 않고 인코딩만 되므로, 서버를 공개 인터넷에 노출한다면 반드시 HTTPS와 함께 쓰세요. HTTPS는 HTTP를 암호화한 안전한 버전입니다. 직접 켜려면 `SSL_CERT`와 `SSL_KEY`를 모두 설정하거나, Marinara 앞에 리버스 프록시를 두세요.

다른 기기가 서버에 접근하려면 우선 서버가 접근 가능한 인터페이스에 바인딩되어야 합니다. `HOST=0.0.0.0`을 설정하세요. 셸 런처는 이 작업을 대신 해 주지만, `pnpm start`는 루프백에만 바인딩합니다.

휴대폰, 태블릿, Tailscale 피어, 다른 컴퓨터는 `TRUSTED_HOSTS`에 추가하지 않아도 서버의 IP 주소로 계속 연결할 수 있습니다. Marinara를 공개 호스트명이나 리버스 프록시 호스트명으로 공개한다면 그 이름을 정확히 적어 주세요. 예를 들면 `TRUSTED_HOSTS=chat.example.com`입니다. `CSRF_TRUSTED_ORIGINS`나 `CORS_ORIGINS`에 이미 있는 이름도 호환을 위해 함께 허용됩니다. 이 Host 검사는 외부 웹사이트의 DNS 이름이 Marinara의 루프백 주소로 다시 연결되는 것을 막아 줍니다.

## 저장 위치

저장 위치 설정은 로컬 데이터가 어디에 놓일지를 정합니다. 여기서 데이터란 채팅, 캐릭터, 아바타, 생성된 미디어를 말합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | 모든 사용자 데이터의 최상위 폴더. Docker 이미지는 `/app/data`로 설정합니다. |
| `FILE_STORAGE_DIR` | `DATA_DIR` 안의 `storage` 폴더 | 파일 저장 폴더를 따로 지정합니다. |
| `ENCRYPTION_KEY` | 비어 있음 | 저장된 API 키를 암호화하는 데 쓰는 키. 아래 명령으로 만들 수 있습니다. |

Marinara는 데이터를 일반 JSON 파일로 보관합니다. 그래서 백업을 복사하거나 내용을 확인하기가 쉽습니다.

암호화 키를 만들려면 다음 명령을 실행하고 결과를 `ENCRYPTION_KEY`에 붙여넣으세요.

```
openssl rand -hex 32
```

각 데이터 폴더에 무엇이 들어 있는지 알아보려면 [Marinara가 데이터를 저장하는 위치](data/where-data-is-stored.md)를 참고하세요.

## 로그 레벨

로그 설정은 서버가 콘솔에 얼마나 자세한 내용을 출력할지 정합니다. 핵심 설정은 `LOG_LEVEL`입니다. 선택한 레벨보다 아래 단계는 표시하지 않습니다.

| 레벨 | 표시 내용 |
| --- | --- |
| `error` | 복구할 수 없는 심각한 실패만 표시합니다. |
| `warn` | 오류와 치명적이지 않은 경고까지 표시합니다. 기본값입니다. |
| `info` | 경고에 더해 시작 로그와 요청별 로그를 표시합니다. |
| `debug` | 프롬프트 전문과 모델의 응답까지 전부 표시합니다. 출력이 매우 많습니다. |

권장 설정은 다음과 같습니다.

- 평소에는 기본값 `warn`을 그대로 두세요. 조용하고 실제 문제만 보여 줍니다.
- 콘솔을 가득 채우지 않으면서 요청과 주요 동작을 확인하고 싶다면 `info`를 쓰세요.
- 모델에 보낸 프롬프트와 응답을 정확히 봐야 한다면 `debug`를 쓰세요. 출력이 많이 나옵니다.

일상적인 요청 로그 없이 프롬프트와 연결 정보만 보려면 레벨 대신 프리셋을 설정하세요.

```
LOG_PRESET=prompt-connections
```

이 프리셋은 `debug`와 같은 수준의 프롬프트와 모델 정보를 보여 주면서 `GET /api/chats`처럼 반복되는 요청 줄은 감춥니다. 현재 레벨은 그대로 두고 이런 일상적인 요청 줄만 없애려면 다음을 설정하고 재시작하세요.

```
LOG_DISABLE_REQUEST_LOGGING=true
```

브라우저 로그는 별개이며 `LOG_LEVEL`의 영향을 받지 않습니다.

## 타임아웃 설정

타임아웃은 서버가 느린 작업을 포기하기 전까지 기다리는 최대 시간입니다. 이미지 생성이나 동영상 생성 같은 미디어 작업은 오래 걸릴 수 있어서 기본 타임아웃이 넉넉하게 잡혀 있습니다. 이름에 따로 표시된 경우를 빼면 모든 타임아웃 값의 단위는 밀리초입니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000`(5분) | 일반적인 Conversation, Roleplay, Game 생성에서 제공자 헤더와 첫 토큰까지의 시간, 그리고 청크 사이의 대기 시간에 적용됩니다. 자체 타임아웃이 없는 백그라운드 생성(Noodle 타임라인 새로고침, Noodler 답장)의 첫 바이트 대기 시간에도 쓰입니다. 유효 범위는 `10000`-`3600000`입니다. 에이전트, 미디어, 임베딩, 도구 타임아웃은 이 값과 무관합니다. |
| `AGENT_CALL_TIMEOUT_MS` | `300000`(5분) | 에이전트 LLM 호출 한 번(트래커, HTML 재구성기를 비롯한 에이전트)에 허용하는 전체 시간 상한이며, 응답이 스트리밍 중일 때도 적용됩니다. 에이전트 한 번 처리에 5분 넘게 걸리는 느린 로컬 모델이라면 값을 올리세요. 유효 범위는 `10000`-`3600000`입니다. Illustrator는 내장된 30분 한도를 최소한으로 유지합니다. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000`(45초) | 현재 Game 장면을 동적 이미지 프롬프트로 바꾸는 모델 호출의 전체 시간 상한입니다. 느린 로컬 모델이라면 값을 올리세요. 유효 범위는 `10000`-`3600000`입니다. |
| `EMBEDDING_TIMEOUT_MS` | `300000`(5분) | 임베딩 요청 한 번에 허용하는 시간입니다. 느린 로컬 임베딩 서버에서는 값을 올리면 도움이 됩니다. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000`(30분) | 이미지 생성 요청 한 번에 허용하는 시간입니다. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000`(30분) | 로컬 ComfyUI 동영상 워크플로를 포함해 장면 동영상 생성 요청 한 번에 허용하는 시간입니다. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160`(160 MiB) | 서버가 받아들이는 장면 동영상 다운로드의 최대 크기입니다. |
| `COMFYUI_GEN_TIMEOUT` | `2400`(40분, 단위는 초) | 대기열에 들어간 ComfyUI 이미지 워크플로 한 번에 허용하는 시간입니다. |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` 값을 따름 | AI 스프라이트 생성 작업 한 번에 허용하는 시간입니다. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000`(1분) | 사용자 지정 도구 호출 한 번에 허용하는 시간입니다. |
| `MAX_TOOL_ROUNDS` | `100` | 모델이 최종 답변을 내놓기 전까지 허용하는 도구 호출 횟수의 상한입니다. |

이미지, 동영상, 스프라이트, ComfyUI 타임아웃은 서버 시작 시점에 고정되므로 바꾸려면 재시작해야 합니다. 채팅 생성, 에이전트, Game 동적 이미지 프롬프트, 임베딩, 사용자 지정 도구 타임아웃은 다음 요청이나 다음 에이전트 실행부터 재시작 없이 적용됩니다. 검증 대상인 채팅, 에이전트, Game 동적 이미지 프롬프트 타임아웃에 잘못된 값, 0, 음수, 범위를 벗어난 값을 넣으면 경고를 남기고 문서에 적힌 기본값을 안전하게 사용합니다. 크거나 고품질인 작업이 도중에 실패한다면 미디어 타임아웃을 올려 보세요. 동영상 작업을 더 알아보려면 [장면 동영상](media/scene-video.md)을 참고하세요.

## 관리자 권한 API(ADMIN_SECRET)

일부 동작은 되돌릴 수 없거나 위험이 커서 일반 접근 검사에 더해 관리자 시크릿을 하나 더 요구합니다. 백업, 데이터 삭제, 업데이트 적용, 테마 설치 등이 여기에 해당합니다.

서버에서 `ADMIN_SECRET`에 길고 무작위한 값을 설정하세요.

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

서버가 실행 중인 컴퓨터(루프백)에서는 이런 동작이 대개 관리자 시크릿 없이도 됩니다. 다른 기기에서 실행할 때는 앱이 시크릿을 보내야 합니다. 앱의 **Settings**(설정), **Advanced**(고급), **Admin Access**(관리자 접근)로 들어가 같은 값을 붙여넣으세요. 그다음부터는 앱이 알아서 보냅니다.

관련된 권한 설정은 다음과 같습니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `ADMIN_SECRET` | 비어 있음 | 원격 기기에서 권한이 필요한 동작을 하려면 있어야 하는 공유 시크릿입니다. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | `true`로 두면 로컬 컴퓨터에서도 시크릿을 요구합니다. |
| `UPDATES_APPLY_ENABLED` | `false` | 브라우저에서 같은 채널의 일반 업데이트를 적용하도록 허용합니다. 서버 컴퓨터의 브라우저에서 직접 릴리스 채널을 바꾸는 경우에는 이 플래그가 없어도 동작합니다. Git 기반 설치에서만 쓸 수 있습니다. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | 유효한 시크릿이 있으면 원격 기기에서도 업데이트를 적용할 수 있게 합니다. |
| `HAPTICS_ALLOW_REMOTE` | `false` | 유효한 시크릿이 있으면 원격 기기에서도 햅틱 기기 동작을 실행할 수 있게 합니다. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | 사용자 지정 스크립트 도구를 활성화합니다. 신뢰할 수 없거나 가져온 도구라면 꺼 두세요. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Agents Manager에서 GitHub 에이전트 저장소를 수동으로 미리 보고 동기화할 수 있게 합니다. 서드파티 에이전트는 검증되지 않았으므로 가져오기와 업데이트 전에 명시적인 확인이 필요합니다. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | 서드파티 확장 가져오기를 여는 두 관문 중 첫 번째입니다. 사용자도 Settings → Advanced → Danger Zone에서 직접 동의해야 합니다. |
| `IMPORT_ALLOWED_ROOTS` | 비어 있음 | 선택 토큰 없이도 일괄 가져오기가 읽을 수 있는 파일 시스템 폴더입니다. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456`(256 MiB) | 서버가 만들어 내는 단일 JSON 프로필 내보내기의 최대 크기입니다. |

서버에 `ADMIN_SECRET`이 설정되어 있지 않으면 로컬 컴퓨터를 제외한 모든 기기에서 권한이 필요한 동작이 실패합니다. 이때 오류 메시지는 시크릿을 설정한 뒤 **Admin Access**에 붙여넣으라고 안내합니다.

## 로컬 주소 허용 설정

기본 상태에서는 제공자, 이미지 서비스, 웹훅으로 나가는 요청이 사설 주소나 로컬 주소에 닿지 못하게 막습니다. 이는 요청을 속여 내부 주소로 보내는 SSRF(서버 측 요청 위조) 계열 공격을 차단하기 위해서입니다. 로컬 모델 서버가 계속 동작하도록 루프백 제공자 주소는 허용된 상태로 둡니다.

사설 네트워크의 다른 컴퓨터에서 직접 운영하는 서비스에 연결할 때만, 꼭 필요한 스위치 하나만 켜세요.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | AI 제공자 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. Android에서는 기본적으로 켜져 있습니다. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | 이미지 제공자 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. 다만 사설 주소에서 생성된 이미지 결과 URL은 설정된 제공자의 출처와 정확히 일치해야 합니다. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | 음성 합성 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | DeepLX 번역 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | 사용자 지정 도구 웹훅이 사설 주소나 LAN 주소에 접근하도록 허용합니다. |

로컬 모델이나 직접 운영하는 모델에 연결하려면 [로컬 모델 또는 자체 호스팅 모델 연결하기](connections/local-self-hosted.md)를 참고하세요.

## 전체 환경 변수 목록

이 절에는 남은 설정을 용도별로 묶어 정리했습니다. 접근 제어, 저장 위치, 로그, 타임아웃, 권한이 필요한 동작, 로컬 주소 허용 설정은 위의 표에 이미 나와 있습니다.

### 서버와 시작

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `7860` | 서버가 대기하는 포트입니다. Android, Docker, Termux에서 같은 값을 쓰세요. |
| `HOST` | `127.0.0.1`(셸 런처에서는 `0.0.0.0`) | 바인딩할 네트워크 인터페이스입니다. LAN에서 접근하려면 `0.0.0.0`을 쓰세요. |
| `MARINARA_ANDROID_SECRET` | 비어 있음 | APK가 관리하는 Termux 설치의 내부 로컬 인증 비밀 값입니다. 설치 프로그램에 입력하는 값이 아닙니다. Android 래퍼가 생성하고 전달하며 Termux 런처가 자동으로 내보냅니다. APK 사용자에게 입력을 요청하거나 일반 데스크톱 설치 또는 수동 Termux 설치에서 설정하지 마세요. 설정할 때는 정확히 64자의 16진수여야 합니다. 비어 있지 않은 잘못된 값은 인증을 약화하는 대신 기기 내부 요청을 HTTP 503으로 실패시킵니다. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Termux 런처와 로컬 `mari` CLI가 쓰는 비공개 비밀 파일 경로입니다. APK와 런처가 이 파일을 자동으로 관리하며 일반 APK 사용자는 읽거나 복사할 필요가 없습니다. |
| `AUTO_OPEN_BROWSER` | `true` | 셸 런처가 앱 URL을 대신 열지 여부입니다. 열지 않으려면 `false`로 설정하세요. APK가 관리하는 설정은 이미 인증된 Android 앱이 연결되도록 해당 실행에서 브라우저 자동 열기를 끕니다. |
| `AUTO_UPDATE_ENABLED` | `true` | Git 기반 Windows, macOS/Linux, Termux 런처가 시작 전에 Engine 업데이트를 받아 적용할지 여부입니다. 계속 받지 않으려면 `false`로 설정하세요. 다음 실행부터 적용됩니다. 이렇게 해도 런처는 새로 공개된 릴리스가 있는지 읽기 전용으로 확인해 다운로드 안내를 출력하며, 수동 확인, 앱 내 적용, 패키지 업데이트, 모델 업데이트는 그대로 쓸 수 있습니다. 이번 한 번만 두 가지 런처 확인을 모두 건너뛰려면 `--skip-update`를 쓰세요. |
| `MARINARA_ENV_FILE` | 프로젝트 최상위의 `.env` | `.env` 파일 경로를 다른 곳으로 지정하는 선택 설정입니다. 서버를 시작하기 전에 설정하세요. |
| `TZ` | 시스템 기본값 | 서버 측 작업에 쓰는 호스트 대체 시간대입니다. Conversation 스케줄은 스케줄 컨트롤에서 전역 시간대를 저장해 두었다면 그 값을 씁니다. 호스트 시간대를 그대로 쓰려면 `TZ`를 설정하지 마세요. `TZ=`처럼 비워 둔 경우도 설정하지 않은 것으로 봅니다. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 교차 출처 요청을 보낼 수 있는 브라우저 출처입니다. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | 예전 방식의 플래그입니다. 현재 빌드에는 기본 제공 키가 없어서 아무것도 만들지 않습니다. 연결은 앱에서 직접 추가하세요. |

`AUTO_CREATE_DEFAULT_CONNECTION`은 예전 설치 환경을 위해 남아 있을 뿐입니다. 새 빌드에는 기본 제공 시작용 연결이 더 이상 들어 있지 않으므로 켜 두어도 아무 일도 일어나지 않습니다. 채팅을 시작하려면 [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 보고 연결을 추가하세요.

Conversation 스케줄 컨트롤은 브라우저나 앱 기기가 알려 준 시간대를 기본값으로 씁니다. **Schedule timezone**(스케줄 시간대)은 Conversation을 설정할 때, Conversation의 Chat Settings에서, 또는 캐릭터 스케줄 편집기에서 바꿀 수 있습니다. 선택한 IANA 시간대는 모든 Conversation 채팅이 함께 쓰는 하나의 전역 설정이며, 같은 서버에 연결된 다른 Marinara 클라이언트에도 동기화됩니다.

### 미디어와 스프라이트 도구

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `FFMPEG_PATH` | 비어 있음 | `ffmpeg` 프로그램의 경로입니다. 애니메이션 표정 GIF를 만들 때 씁니다. 설정하지 않으면 PATH에 있는 `ffmpeg`를 사용합니다. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000`(3분) | 애니메이션 표정 클립 하나를 변환하는 데 허용하는 시간입니다. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | 스프라이트 정리 엔진입니다. `auto`는 선택 설치용 AI 방식으로 넘어가기 전에 적응형 매트 정리를 먼저 시도하고, `builtin`은 매트 방식만 쓰며, `backgroundremover`는 AI 도구를 강제합니다. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | `true`로 두면 시작할 때 선택 설치용 AI 배경 제거 도구를 설치합니다. |
| `BACKGROUNDREMOVER_COMMAND` | 비어 있음 | 시스템에 설치된 `backgroundremover` 프로그램의 경로입니다. |
| `BACKGROUNDREMOVER_PYTHON` | 비어 있음 | `backgroundremover`가 설치된 Python 프로그램의 경로입니다. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000`(10분) | AI 배경 제거 호출 한 번에 허용하는 시간입니다. |

### 장면 동영상 제공자

장면 동영상 제공자는 환경 변수가 아니라 앱 안에서 연결로 설정합니다. 아래 설정은 내부 작업을 세밀하게 조정할 때만 씁니다. 모든 값의 단위는 밀리초입니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | 서버가 Google Veo 작업 상태를 확인하는 주기입니다. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | 서버가 xAI Imagine 작업 상태를 확인하는 주기입니다. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | 서버가 OpenRouter 동영상 작업 상태를 확인하는 주기입니다. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | 서버가 Seedance 작업 상태를 확인하는 주기입니다. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | 비어 있음 | 이 서버의 공개 HTTPS 주소입니다. 제공자가 참조 이미지를 URL로 가져와야 할 때 씁니다. |

### 연동과 기타

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DOCS_I18N_BASE_URL` | 공식 `docs-i18n` 브랜치 | 번역된 문서 팩을 다운로드하는 곳입니다(Settings → General → Documentation Language). 공개된 `https://` 호스트여야 하며, 포크나 미러는 자체적으로 관리하는 `docs-i18n` 브랜치를 가리키게 할 수 있습니다. |
| `GIPHY_API_KEY` | 비어 있음 | Conversation 모드에서 GIF를 검색할 때 쓰는 Giphy 키입니다. 설정하지 않으면 검색이 꺼집니다. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Intiface 햅틱 앱의 기본 주소입니다. |
| `SPOTIFY_REDIRECT_URI` | 요청에서 자동 판별 | Spotify 로그인 콜백 URL을 직접 지정합니다. TLS를 상위에서 처리할 때 설정하세요. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Professor Mari가 잘라 내기 전까지 읽는 위키 페이지 콘텐츠의 최대 크기입니다. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Professor Mari의 위키 요청 한 번에 허용하는 시간입니다. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Professor Mari가 읽어 온 위키 내용을 캐시에 보관하는 시간입니다. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false`(Windows 런처는 `true`로 설정) | 루프백에서 관리자 헤더 없이 로컬 모델 런타임을 설치할 수 있게 합니다. |
| `SSL_CERT` | 비어 있음 | TLS 인증서 경로입니다. 위의 접근 제어를 참고하세요. |
| `SSL_KEY` | 비어 있음 | TLS 개인 키 경로입니다. 위의 접근 제어를 참고하세요. |

Giphy 키와 관련해 한 가지 유의할 점은, `GIPHY_API_KEY`를 설정하고 재시작하기 전까지 GIF 검색을 쓸 수 없다는 것입니다. 내장 로컬 모델은 [Local Model 설정](connections/local-model.md)을 참고하세요.

## 관련 가이드

- [원격 접근: Basic Auth와 IP 허용 목록](REMOTE_ACCESS.md)
- [Marinara가 데이터를 저장하는 위치](data/where-data-is-stored.md)
- [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)
- [장면 동영상](media/scene-video.md)
- [Marinara Engine 문제 해결](TROUBLESHOOTING.md)
