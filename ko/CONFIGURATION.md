# 서버 설정 참고 문서

이 가이드에서는 환경 변수로 바꿀 수 있는 서버 설정을 안내합니다. 환경 변수는 서버가 `.env`라는 일반 텍스트 파일에서 읽어 들이는 설정값입니다. Marinara는 아무것도 설정하지 않아도 동작합니다. 대부분은 다른 기기의 접속을 허용하거나, 여러 사람이 쓰는 서버를 보호하거나, 데이터 폴더를 옮기거나, 로그를 더 자세히 남기거나, 느린 작업에 시간을 더 줄 때만 설정이 필요합니다.

AI 계정, 캐릭터, 채팅 옵션은 앱 안에서 설정합니다. AI 계정을 추가하려면 [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요.

<a id="edit-the-env-file"></a>

## .env 파일 편집하기

Marinara는 처음 시작할 때 빈 `.env`를 만듭니다. 각 줄은 `KEY=value` 형식입니다. `#`으로 시작하는 줄은 주석입니다.

| 설치 방식 | `.env` 위치 |
| --- | --- |
| 일반 설치 | 프로젝트 최상위 폴더 |
| 공식 Docker 또는 Podman 이미지 | 데이터와 같은 볼륨 안의 `/app/data/.env` |

1. 같은 폴더의 `.env.example`을 여세요. 모든 설정과 기본값이 적혀 있습니다.
2. 원하는 줄을 `.env`로 복사하세요.
3. `=` 뒤의 값을 바꾸고 파일을 저장하세요.

```text
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

`.env`는 셸 스크립트가 아니라 데이터입니다. Marinara는 값 안의 `$`, `$(...)` 같은 셸 문법을 실행하지 않습니다. 런처 환경에 이미 설정된 값은 `.env`의 같은 항목보다 우선합니다.

서버는 어떤 방식으로 시작하든 `.env`를 읽습니다. 런처(`start.bat`, `start.sh`, `start-termux.sh`)는 여기에 더해 다른 기기가 접속할 수 있도록 `HOST=0.0.0.0`을 설정하고, 서버가 준비되면 브라우저를 엽니다. `AUTO_OPEN_BROWSER=false`로 설정하면 브라우저를 열지 않습니다. `pnpm start`만 실행하면 `HOST`를 설정하지 않는 한 서버는 이 컴퓨터에서 오는 연결만 받습니다.

<a id="restart-or-hot-reload"></a>

## 재시작과 즉시 반영

Marinara는 실행 중에 `.env`를 지켜봅니다. 대부분의 설정은 재시작 없이 거의 바로 적용됩니다. 변경할 때마다 로그에 `[env-watcher]` 줄이 남습니다. 감시를 시작할 수 없으면 서버는 30초마다 파일을 확인하고 로그에 그 사실을 남깁니다.

다른 컴퓨터에서 편집하거나 컨테이너 바인드 마운트 안의 파일을 편집할 때처럼 편집 내용이 반영되지 않으면 `MARINARA_ENV_WATCH=poll`을 설정하세요. 감시를 끄려면 `MARINARA_ENV_WATCH=0`을 설정하세요. 둘 다 고급 옵션입니다.

다음 설정은 시작할 때만 읽습니다. 하나라도 바꾸면 재시작해야 하며, 로그에 경고가 남습니다.

- `PORT`, `HOST`, `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`, `ENCRYPTION_KEY`, `MARINARA_EAGER_STORAGE`
- `MARINARA_ENV_FILE`, `MARINARA_ENV_WATCH`, `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`, `LOG_FORMAT`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`와 `SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- 이미지, 동영상, 스프라이트, ComfyUI의 타임아웃과 폴링 설정: `IMAGE_GEN_TIMEOUT_MS`, `IMAGE_GEN_MAX_RESPONSE_BYTES`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT`, 그리고 네 가지 `*_VIDEO_POLL_INTERVAL_MS` 설정

`AUTO_UPDATE_ENABLED`는 서버가 시작되기 전에 런처가 읽으므로, 바꾸면 다음 실행부터 적용되고 로그에 경고가 남지 않습니다.

접근 제어 설정과 시크릿(`BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, `CSRF_TRUSTED_ORIGINS`)은 재시작이 필요 없습니다.

<a id="access-control"></a>

## 접근 제어

접근 제어는 실행 중인 서버에 누가 접근할 수 있는지를 정합니다. 단계별 방법과 예시는 [원격 접근: 로그인과 IP 허용 목록](REMOTE_ACCESS.md)을 참고하세요.

로그인은 `.env` 없이도 설정할 수 있습니다. 이미 로그인된 브라우저에서 **Settings → Advanced → Access**(설정 → 고급 → 접근)를 사용하거나, 서버 로그의 1회용 설정 코드를 사용하세요. 서버는 로그인이 설정되지 않았고 루프백 밖에서 오는 요청을 받는 동안에만 그 코드를 출력합니다. 로그인은 `DATA_DIR/.remote-login.json`에 저장됩니다. Marinara 폴더에서 `node scripts/reset-login.mjs`를 실행하면 이 로그인을 지우고 모든 브라우저를 로그아웃합니다. `.env`의 로그인이 우선합니다. 로그인을 바꾸거나 지우려면 현재 비밀번호가 필요합니다. 로그인 프록시는 [로그인 프록시(forward auth)](REMOTE_ACCESS.md#login-proxies-forward-auth)를 참고하세요.

아래에서 쓰는 용어는 다음과 같습니다.

- **루프백**: 서버가 실행 중인 컴퓨터입니다. 주소는 `127.0.0.1` 또는 `localhost`입니다.
- **CIDR 범위**: `192.168.1.0/24`처럼 IP 주소 묶음을 짧게 적는 방식입니다.
- **Basic Auth**: 요청마다 함께 보내는 사용자 이름과 비밀번호입니다. 스크립트와 API 클라이언트가 이 방식을 쓰고, 브라우저는 `/login` 페이지를 사용합니다. 암호화가 아니라 인코딩만 되므로 공개 서버에서는 HTTPS를 쓰세요.

로그인을 설정하지 않으면 서버는 신뢰할 수 있는 출처의 연결만 받습니다. 루프백, `IP_ALLOWLIST`에 있는 주소, Tailscale, 같은 호스트의 Docker 브리지 트래픽이 여기에 해당합니다. 가정용 네트워크를 포함한 나머지는 모두 `403 Forbidden`을 받습니다. 다른 기기가 접속하려면 우선 서버가 접근 가능한 주소에 바인딩되어야 합니다. `HOST=0.0.0.0`을 설정하세요.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `BASIC_AUTH_USER` | 비어 있음 | 로그인 사용자 이름입니다. `BASIC_AUTH_PASS`와 함께 설정하세요. |
| `BASIC_AUTH_PASS` | 비어 있음 | 로그인 비밀번호입니다. 둘 중 하나라도 비워 두면 로그인이 꺼집니다. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Basic Auth 인증 요청에 담기는 realm 이름입니다. |
| `IP_ALLOWLIST` | 비어 있음 | 항상 허용할 IP나 CIDR 범위를 쉼표로 구분해 적습니다. 직접 들어오는 루프백 연결은 항상 허용됩니다. 같은 컴퓨터의 리버스 프록시는 그렇지 않습니다. |
| `IP_ALLOWLIST_ENABLED` | `true` | `false`로 두면 목록은 남기고 적용만 멈춥니다. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | 로그인을 설정하지 않았을 때 사설 네트워크에서 비밀번호 없이 접근하도록 허용합니다. 인터넷 서비스 사업자가 고객끼리 공유하는 `100.64.0.0/10`은 제외됩니다. 신뢰할 수 있을 때만 `TRUSTED_PRIVATE_NETWORKS`에 추가하세요. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | 인터넷을 포함한 모든 주소에서 비밀번호 없이 접근하도록 허용합니다. 권장하지 않습니다. |
| `TRUSTED_PRIVATE_NETWORKS` | 내장 범위 | 기본 사설 범위를 대체합니다. 계속 쓰려는 기본값은 직접 포함하세요. |
| `BYPASS_AUTH_TAILSCALE` | 자동 | 비워 두면 기기가 이 컴퓨터의 Tailscale 주소로 직접 연결할 때만 로그인을 건너뜁니다. Tailscale Serve, Funnel 또는 다른 프록시를 거치면 여전히 로그인이 필요합니다. `true`이면 예전 방식대로 `100.64.0.0/10` 전체를 우회합니다. `false`이면 일반 접근 제어를 적용합니다. |
| `BYPASS_AUTH_DOCKER` | 자동 | 비워 두면 감지된 컨테이너 인터페이스와 그 게이트웨이만 신뢰하며, 그것도 로그인, `IP_ALLOWLIST`, `TRUSTED_AUTH_PROXY`가 하나도 설정되지 않은 동안에만 신뢰합니다. `true`는 예전 구성이나 사용자 지정 네트워크용입니다. `false`이면 일반 접근 제어를 적용합니다. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | 프록시가 전달하는 Docker 트래픽에 로그인이나 허용 목록 검사를 요구합니다. 프록시 자체가 모든 방문자를 로그인시킬 때만 `false`로 설정하세요. |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | 같은 컴퓨터의 프록시나 터널이 전달하는 요청을 원격으로 취급합니다. nginx의 기본 `proxy_pass` 같은 HTTP/1.0 요청도 포함됩니다. 프록시 자체가 모든 방문자를 로그인시킬 때만 `false`로 설정하세요. |
| `TRUSTED_AUTH_PROXY` | 비어 있음 | 모든 방문자를 로그인시키는 forward-auth 프록시(tinyauth, Authelia, Authentik, oauth2-proxy)의 IP나 CIDR입니다. 이 프록시의 요청은 로그인과 `IP_ALLOWLIST`를 건너뜁니다. 프록시가 모든 경로를 보호해야 하며, 프록시를 우회해 Marinara에 닿을 수 없어야 합니다. |
| `TRUSTED_HOSTS` | 비어 있음 | `chat.example.com`처럼 Marinara가 응답할 공개 호스트명이나 프록시 호스트명을 추가합니다. 직접 IP, `localhost`, `.local`, `.home.arpa`, 점이 없는 LAN 이름은 이 설정 없이도 동작합니다. `CSRF_TRUSTED_ORIGINS`나 `CORS_ORIGINS`에 있는 이름도 허용됩니다. |
| `SSL_CERT` | 비어 있음 | TLS 인증서 경로입니다. `SSL_KEY`와 함께 설정하면 HTTPS를 직접 제공합니다. |
| `SSL_KEY` | 비어 있음 | TLS 개인 키 경로입니다. |
| `CSRF_TRUSTED_ORIGINS` | 비어 있음 | 변경 사항 저장을 허용할 브라우저 출처를 추가합니다. 공개 도메인이나 특이한 포트를 쓸 때 사용합니다. 리터럴 `null`은 Android APK의 경우를 포함해 무시됩니다. |

> **경고:** `0.0.0.0/0` 같은 넓은 공개 `IP_ALLOWLIST` 범위는 인터넷 클라이언트를 로그인 없이 들여보낼 수 있습니다. 신뢰하는 주소만 적으세요.

## 저장 위치

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | 모든 사용자 데이터의 최상위 폴더입니다. Docker 이미지는 `/app/data`로 설정합니다. |
| `FILE_STORAGE_DIR` | `DATA_DIR` 안의 `storage` | 파일 저장 폴더를 따로 지정합니다. |
| `ENCRYPTION_KEY` | 비어 있음 | 저장된 API 키를 암호화하는 키입니다. |
| `MARINARA_MAX_RESIDENT_CHATS` | `0`(제한 없음), SteamOS와 Termux에서는 `8` | 한 번에 메모리에 유지하는 채팅 수의 상한입니다. 상한을 넘으면 저장할 때마다, 저장하지 않은 변경이 없는 채팅 중 가장 오래전에 사용한 것을 메모리에서 내립니다. 디스크에서는 지우지 않습니다. 잘못된 텍스트는 플랫폼 기본값으로 돌아갑니다. `2`보다 작은 양수는 `2`가 됩니다. `0`이면 메모리에서 내리지 않습니다. |
| `MARINARA_EAGER_STORAGE` | 꺼짐 | `1`로 설정하면 2.4.5 이전처럼 시작할 때 모든 채팅을 읽어 들입니다. 프로필이 크면 메모리를 훨씬 많이 씁니다. 재시작이 필요합니다. |

암호화 키를 만들어 `ENCRYPTION_KEY`에 붙여넣으세요.

```bash
openssl rand -hex 32
```

Marinara는 데이터를 일반 JSON 파일로 보관하므로 백업을 복사하고 읽을 수 있습니다. 각 폴더에 무엇이 들어 있는지는 [Marinara가 데이터를 저장하는 위치](data/where-data-is-stored.md)를 참고하세요.

<a id="logging-levels"></a>

## 로그 레벨

`LOG_LEVEL`은 서버가 얼마나 자세히 출력할지 정합니다. 선택한 레벨보다 아래 단계는 표시하지 않습니다.

| 레벨 | 표시 내용 |
| --- | --- |
| `error` | 심각한 실패만 표시합니다. |
| `warn` | 오류와 경고를 표시합니다. 기본값입니다. |
| `info` | 시작 로그와 요청별 로그를 더합니다. |
| `debug` | 프롬프트 전문과 모델 응답을 포함해 전부 표시합니다. 출력이 매우 많습니다. |

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `LOG_LEVEL` | `warn` | 위의 레벨입니다. |
| `LOG_PRESET` | `default` | `prompt-connections`는 `debug`와 같은 수준의 프롬프트와 모델 정보를 보여 주면서 `GET /api/chats` 같은 일상적인 요청 줄은 숨깁니다. |
| `LOG_DISABLE_REQUEST_LOGGING` | `false` | `true`로 두면 레벨은 그대로 두고 일상적인 요청 줄을 숨깁니다. 재시작이 필요합니다. |
| `LOG_FORMAT` | 자동 | `pretty`는 어디서나 읽기 쉬운 줄로 출력합니다. 예를 들어 `docker logs`에서 **Debug mode**(디버그 모드) 프롬프트를 읽을 때 씁니다. `json`은 한 줄에 JSON 객체 하나씩 출력합니다. 재시작이 필요합니다. |

터미널에서는 서버가 읽기 쉬운 줄로 출력합니다. Docker 로그처럼 그 밖의 곳에서는 프로덕션 서버가 JSON 줄로 출력합니다. Termux 런처는 읽기 쉬운 줄을 요청합니다. 브라우저 로그는 별개이며 `LOG_LEVEL`로 제어하지 않습니다.

## 타임아웃 설정

타임아웃은 서버가 느린 작업을 기다리는 최대 시간입니다. **Settings → Advanced → Request timeouts**(설정 → 고급 → 요청 제한 시간)를 열면 텍스트, 에이전트, Game 이미지 프롬프트, 이미지, 동영상, ComfyUI, 임베딩의 제한 시간을 초 단위로 바꿀 수 있습니다. 제한 시간을 늘리면 느린 로컬 백엔드에 도움이 됩니다. 서비스가 정한 제한은 넘어설 수 없습니다. 저장하려면 서버 관리 권한이 필요합니다.

이 설정은 모든 프로필에 적용되며 활성 `.env` 옆에 `.env.timeouts.json`(또는 `<custom-env-path>.timeouts.json`)으로 저장됩니다. `.env`를 고치지 않고도 해당 변수보다 우선 적용됩니다. 텍스트, 에이전트, Game 이미지 프롬프트, 임베딩 변경은 새 요청부터 적용됩니다. 미디어 변경과 설치된 에이전트 패키지는 재시작해야 적용됩니다. 변수로 돌아가려면 그 파일을 삭제하고 재시작하세요.

이름에 따로 표시된 경우를 빼면 값의 단위는 밀리초입니다. 검증 대상인 채팅, 에이전트, Game 이미지 프롬프트 타임아웃에 잘못된 값, 0, 음수, 범위를 벗어난 값을 넣으면 경고를 남기고 기본값을 사용합니다. 동영상 작업은 [장면 동영상](media/scene-video.md)을 참고하세요.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000`(5분) | Conversation, Roleplay, Game 응답에서 첫 토큰까지의 시간과 청크 사이의 간격입니다. 자체 타임아웃이 없는 백그라운드 작업(Professor Mari, Noodle 새로고침, Slurp 답장)의 시간 예산으로도 쓰입니다. 범위는 `10000`-`3600000`입니다. 에이전트, 미디어, 임베딩, 도구 타임아웃은 바꾸지 않습니다. |
| `AGENT_CALL_TIMEOUT_MS` | `300000`(5분) | 다운로드한 에이전트를 포함해 에이전트 모델 호출 한 번이 시작되기 전이나 실행 중에 허용하는 최장 무응답 시간입니다. 데이터가 들어오면 다시 시작됩니다. 범위는 `10000`-`3600000`입니다. Illustrator에는 내장된 30분 유휴 시간이 최소한 보장됩니다. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000`(45초) | Game 장면을 이미지 프롬프트로 바꾸는 모델 호출의 전체 시간 상한입니다. 범위는 `10000`-`3600000`입니다. |
| `EMBEDDING_TIMEOUT_MS` | `300000`(5분) | 임베딩 요청 한 번에 허용하는 시간입니다. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000`(30분) | 이미지 생성 요청 한 번에 허용하는 시간입니다. |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280`(30 MiB) | 받아들이는 이미지 응답의 최대 크기입니다. 로컬 ComfyUI가 큰 메타데이터를 넣을 때 값을 올리세요. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000`(30분) | ComfyUI 동영상 워크플로를 포함해 장면 동영상 요청 한 번에 허용하는 시간입니다. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160`(160 MiB) | 받아들이는 장면 동영상 다운로드의 최대 크기입니다. |
| `COMFYUI_GEN_TIMEOUT` | `2400`(40분, 단위는 초) | 대기열에 들어간 ComfyUI 이미지 워크플로 한 번에 허용하는 시간입니다. |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` 값을 따름 | AI 스프라이트 작업 한 번에 허용하는 시간입니다. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000`(1분) | 사용자 지정 도구 호출 한 번에 허용하는 시간입니다. |
| `MAX_TOOL_ROUNDS` | `100` | 모델이 답해야 하기 전까지 허용하는 도구 호출 라운드의 최대 수입니다. Game 턴은 최대 4회, 에이전트는 16회, 로어북 백필은 64회까지이며, 이 값이 더 낮으면 이 값을 따릅니다. |

## 관리자 권한 API(ADMIN_SECRET)

백업, 데이터 삭제, 업데이트 적용, 테마 설치처럼 되돌릴 수 없거나 위험한 동작에는 일반 접근 검사에 더해 시크릿이 하나 더 필요합니다. 서버가 실행 중인 컴퓨터의 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)에서 만들거나([Admin Access](REMOTE_ACCESS.md#admin-access-and-privileged-actions) 참고), 서버에 길고 무작위한 값을 설정하세요.

```text
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

서버가 실행 중인 컴퓨터에서는 이런 동작이 대개 시크릿 없이 됩니다. 그 컴퓨터의 프록시나 터널이 전달한 요청은 `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`가 아닌 한 원격으로 간주합니다. 다른 기기에서 직접 보내는 요청에는 시크릿이 필요합니다. **Settings → Advanced → Admin Access**에 같은 값을 붙여넣으면 앱이 대신 보냅니다. `.env`의 `ADMIN_SECRET`은 앱에서 만든 시크릿보다 우선합니다. 관리자 시크릿이 없으면 서버 컴퓨터를 제외한 모든 기기에서 권한이 필요한 동작이 실패하며, 오류 메시지가 시크릿을 설정하라고 안내합니다. 설치된 에이전트는 로그인한 모든 기기에서 동작하지만, 에이전트를 설치, 업데이트, 제거하려면 시크릿이 필요합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `ADMIN_SECRET` | 비어 있음 | 원격 기기에서 권한이 필요한 동작을 할 때 쓰는 시크릿입니다. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | `true`로 두면 서버 컴퓨터에서도 시크릿을 요구합니다. |
| `UPDATES_APPLY_ENABLED` | `false` | **Apply Update**(업데이트 적용)로 브라우저에서 같은 채널의 업데이트를 적용할 수 있게 합니다. 서버 컴퓨터의 브라우저에서 릴리스 채널을 바꾸는 경우에는 이 설정이 없어도 동작합니다. Git 설치에서만 쓸 수 있습니다. |
| `UPDATES_APPLY_DISABLED` | 설정하지 않음 | 채널 전환을 포함해 서버 측 업데이트 적용을 모두 거부합니다. `UPDATES_APPLY_ENABLED`보다 우선합니다. 개발용 런처와 e2e 런처가 이 값을 설정합니다. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | 유효한 시크릿이 있으면 원격 기기에서도 업데이트를 적용할 수 있게 합니다. |
| `HAPTICS_ALLOW_REMOTE` | `false` | 유효한 시크릿이 있으면 원격 기기에서도 햅틱 동작을 실행할 수 있게 합니다. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | 사용자 지정 스크립트 도구를 켭니다. 신뢰할 수 없거나 가져온 도구라면 꺼 두세요. |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | OS 샌드박스(macOS Seatbelt 또는 Linux Bubblewrap, 있으면 사용)가 없는 호스트에서도 Professor Mari의 데이터베이스 변환 스크립트를 실행할 수 있게 합니다. 스크립트를 검토하지 않았다면 꺼 두세요. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Agent Organizer에서 GitHub 에이전트 저장소를 수동으로 미리 보고 동기화할 수 있게 합니다. [사용자 지정 에이전트 저장소](#custom-agent-repositories)를 참고하세요. |
| `MARINARA_OVERWORLD_GAMES` | `false` | 플레이어가 Overworld 게임(세계관 키트와 생성된 세계)을 만들고 예전 게임을 Overworld 게임으로 바꿀 수 있게 합니다. 꺼져 있으면 마법사는 VN 게임만 제공합니다. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | 서드파티 확장 가져오기를 여는 두 관문 중 첫 번째입니다. [외부 확장](#external-extensions)을 참고하세요. |
| `IMPORT_ALLOWED_ROOTS` | 비어 있음 | 선택기 토큰 없이 일괄 가져오기가 읽을 수 있는 폴더입니다. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456`(256 MiB) | 서버가 만드는 단일 JSON 프로필 내보내기의 최대 크기입니다. |

## 로컬 주소 허용 설정

기본적으로 AI 서비스, 이미지 서비스, 웹훅으로 나가는 요청은 사설 주소나 로컬 주소를 거부합니다. 이는 요청을 속여 내부 주소에 닿게 하는 SSRF(서버 측 요청 위조)를 막기 위해서입니다. 루프백의 모델 서버는 계속 동작합니다. 사설 네트워크의 다른 컴퓨터에서 직접 운영하는 서비스에 연결할 때 필요한 스위치만 켜세요.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | AI 서비스 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. Android에서는 기본적으로 켜져 있습니다. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | 이미지 서비스 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. 사설 주소의 결과 URL은 여전히 서비스의 출처와 정확히 일치해야 합니다. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | 음성 합성 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. |
| `STT_LOCAL_URLS_ENABLED` | `false` | Speech to text(음성 인식) 서버 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. 같은 컴퓨터에 있는 서버는 이 설정 없이도 동작합니다. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | DeepLX 번역 URL이 사설 주소나 LAN 주소에 접근하도록 허용합니다. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | 사용자 지정 도구 웹훅이 사설 주소나 LAN 주소에 접근하도록 허용합니다. |

로컬 모델이나 직접 운영하는 모델에 연결하려면 [로컬 모델 또는 자체 호스팅 모델 연결하기](connections/local-self-hosted.md)를 참고하세요.

<a id="feature-switches"></a>

## 기능 스위치

실패한 제공자 호출 재시도나 로어북 그룹 선택 고정 같은 선택적 서버 동작은 **Settings → Advanced → Features**(설정 → 고급 → 기능)에 있습니다. 모두 기본적으로 꺼져 있습니다. 몇몇은 변수가 있어서, 설정하면 스위치보다 우선합니다. [기능 스위치](configuration/features.md)를 참고하세요.

<a id="marinara-notices"></a>

## Marinara 공지

공지는 메인테이너가 보내는 짧은 경고입니다. 보안 문제나 사용 중인 버전에 필요한 수동 단계 등을 알립니다. 공지는 배너로 표시됩니다.

- 시작할 때, 그리고 그 후 매시간 서버가 Marinara Engine 저장소의 `notices` 브랜치에서 작은 파일 `notices.json` 하나를 내려받습니다. 서버는 사용 중인 버전을 지정한 공지만 보관합니다. 브라우저는 페이지를 불러올 때 한 번, 그 후 매시간 자신의 서버에 공지를 요청합니다.
- 다운로드가 실패하면 서버는 이미 가진 공지를 유지하며, 시작이 지연되지 않습니다.
- 이 요청은 사용자, 채팅, 설정에 관한 데이터를 전혀 보내지 않습니다. `notices` 브랜치는 메인테이너만 변경할 수 있으며, 모든 변경은 리뷰를 거칩니다.
- 공지는 크기 제한이 있는 일반 텍스트입니다. 링크는 `https://github.com/Pasta-Devs/`를 가리킬 때만 유지됩니다. 공지는 아무것도 설치, 실행, 변경할 수 없습니다.
- 공지는 사용자 본인만 볼 수 있습니다. 서버 컴퓨터에서, `IP_ALLOWLIST`에 있는 주소에서, 또는 로그인한 뒤에 볼 수 있습니다. 다른 방문자에게는 빈 목록이 돌아갑니다.

공지를 끄려면 `MARINARA_NOTICES_ENABLED=false`로 설정하세요.

> **경고:** 공지를 끄면 Marinara가 보안 수정이나 필수 단계를 알려 줄 수 없습니다. [GitHub 릴리스](https://github.com/Pasta-Devs/Marinara-Engine/releases)를 직접 확인하세요.

포크는 `MARINARA_NOTICES_URL`이 자신의 파일을 가리키게 할 수 있습니다.

공지 서버를 찾을 때, 그리고 [아웃바운드 프록시](#outbound-http-proxy)가 켜져 있으면 그 프록시를 찾을 때도 Marinara는 hosts 파일을 읽고 DNS 서버에 직접 조회합니다. `.local` 이름이나 도메인 없는 짧은 이름(`localhost` 제외)처럼 내 로컬 네트워크에서만 통하는 이름은 동작하지 않습니다. Termux에서는 `$PREFIX/etc/resolv.conf`에 적힌 DNS 서버를 씁니다. 이 파일을 수정하지 않았다면 Google의 `8.8.8.8`과 `8.8.4.4`입니다.

<a id="optional-multiplayer"></a>

## 선택적 멀티플레이어

멀티플레이어는 기본적으로 꺼져 있습니다. 멀티플레이어를 켜면 Conversation, Roleplay, Game의 비공개 방을 함께 쓸 수 있으며 참여 인원에 고정 상한이 없습니다. 각 게스트는 신뢰할 수 있는 자신의 Marinara를 사용합니다. 게스트에게는 AI 계정이 필요 없습니다. 호스트가 AI 계정을 제공하며 공유 내용을 읽고 보관할 수 있습니다. 두 관문 중 하나라도 꺼져 있는 동안 Marinara는 백그라운드 세션, 인증서, 상대 확인을 하지 않습니다.

1. 참여하는 각 Marinara의 `.env`에 `MULTIPLAYER_ENABLED=true`를 설정하고 재시작하세요. 정확히 `true`인 값만 동작하며, 즉시 반영으로는 적용되지 않습니다.
2. **Settings → Advanced → Multiplayer**(설정 → 고급 → 멀티플레이어)를 열고 경고를 읽은 뒤 설정을 켜세요. 이것만으로 수신 대기를 시작하거나 방에 참여하지는 않습니다.
3. 호스팅하려면 모드 선택이나 설정 흐름에서 **Create shared session**(공유 세션 만들기) 또는 **Play together**(함께 플레이)를 사용하세요. 설정, 표시 이름, 공유할 페르소나 텍스트를 검토하세요. 기존 채팅은 설정 선택만 공유하며, 채팅 기록, 메모, 기억은 절대 공유하지 않습니다.
4. 호스트에서는 방 호스트명에 유효하고 게스트가 신뢰하는 인증서로 `SSL_CERT`와 `SSL_KEY`를 설정하세요. `https://room.example.org:7861`처럼 별도의 HTTPS 방 주소와 포트를 고르세요. 호스팅 동작이 그 포트를 엽니다. 방화벽이나 공유기에서는 방 포트만 연결하세요. 일반 Marinara API는 노출하지 마세요. 포트 전달, 릴레이, 인증서 우회는 자동으로 설정되지 않습니다.
5. 관리자 자격 증명과 다른 12자 이상의 방 비밀번호를 정하세요. 만료되는 초대와 비밀번호는 신뢰하는 사람에게 따로 보내세요. 게스트는 호스트명 지문, 방 이름, 페르소나 텍스트를 확인한 뒤 입장을 요청합니다. 호스트가 **Players**(플레이어)에서 각 요청을 승인하기 전에는 기록이 전송되지 않습니다.

제한과 동작은 다음과 같습니다.

- TLS는 비밀번호를 보내기 전에 인증서 체인과 호스트명, 초대에 담긴 인증서 지문을 확인합니다. 자체 서명 인증서는 조용히 허용하지 않습니다. 인증서를 갱신하면 새 초대가 필요합니다.
- 초대는 30분 후 만료됩니다. 승인된 세션은 최대 12시간 유지됩니다. 교체하거나 취소하면 사용하지 않은 초대가 무효가 됩니다. **Kick**은 승인된 게스트를 내보냅니다.
- 호스트는 자동 또는 수동 답변, **Pause**(일시 정지)/**Resume**(재개), **Stop**(중지)을 제어합니다. 기본 허용량은 호스팅 세션당 조정된 생성 턴 100회입니다. 그룹 턴이나 Game 설정은 모델을 여러 번 호출할 수 있습니다. 이는 턴 제한이지 가격 예상치가 아닙니다.
- Game에서는 **Start Game**(게임 시작) 전에 파티를 검토하세요. 필수 플레이어마다 행동을 제출하거나 패스하며, 모두 준비되면 GM이 라운드를 처리합니다. 연결이 끊긴 플레이어는 돌아오거나 호스트가 패스 또는 제거할 때까지 필수로 남습니다. 일시 정지되거나 중단된 라운드는 유료 요청이나 이미 확정된 세계 효과를 스스로 반복하지 않습니다.
- **Stop**, **Leave**(나가기), 설정 끄기, 서버 재시작은 라이브 세션을 끝냅니다. 재시작해도 저절로 호스팅하거나 참여하지는 않습니다.
- 사용자 지정 도구, 패키지 도구, 위험한 명령은 방에서 계속 사용할 수 없습니다. 게스트는 스케줄러를 실행하지 않으며, 받은 텍스트로 로컬 명령을 실행하지도 않습니다. Conversation 스케줄은 호스트의 스케줄러를 사용합니다.
- 새 플레이어와 페르소나 변경은 다음 라운드부터 적용됩니다.
- 방은 크기가 제한된 텍스트만 주고받습니다. 파일, 미디어, 확장, 패키지 전송은 없습니다. Android 네이티브 래퍼는 참여할 수 없습니다.

> **경고:** 신뢰하는 사람에게만 연결하고, 자신의 Marinara 클라이언트를 사용하세요. 호스트가 제공하는 클라이언트, 확장, 파일은 절대 설치하지 마세요. 호스트는 공유한 내용을 읽을 수 있고, 공유한 내용은 호스트의 AI 서비스로 전송될 수 있습니다. 직접 연결하면 네트워크 주소가 드러납니다. 비밀번호, API 키, 개인정보는 공유하지 마세요. 이상하다 싶으면 즉시 나가세요.

정확한 제한과 테스트한 플랫폼은 [호환성 및 검증 기록](development/multiplayer.md)을 참고하세요. 문제가 생기면 [문제 해결](TROUBLESHOOTING.md#multiplayer-connection-or-turn-problems)을 참고하세요.

## 에이전트와 확장

선택 설치용 공식 에이전트는 앱의 **Agents → Agent Organizer**(에이전트 → Agent Organizer)에서 설치합니다. Marinara는 자신의 메이저 버전에 맞는 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 카탈로그를 고릅니다.

- **업데이트:** Marinara는 설치된 패키지의 새 버전을 다운로드하기 전에 묻습니다. **Not now**(나중에)를 선택하면 현재 버전이 유지되고 Agent Organizer에 **Update**(업데이트)가 남습니다. 새로 설치한 상태에는 패키지가 없습니다.
- **패키지 위치:** `DATA_DIR/capability-packages`입니다. Docker 볼륨, 사용자 지정 데이터 폴더, 백업, 일반적인 업그레이드에서 모두 보존됩니다. 데스크톱, Docker, Termux 모두 같습니다. iOS를 비롯한 브라우저는 호스트 서버에 설치된 패키지를 사용합니다.
- **디스크 사용량:** Marinara는 각 패키지의 현재 버전과 직전 버전을 보관하고, 그보다 오래된 버전과 `DATA_DIR/capability-runtime-snapshots` 안의 임시 사본은 삭제합니다. 패키지 데이터는 절대 삭제하지 않습니다.
- **오프라인:** GitHub에 연결할 수 없거나, 업데이트를 거절했거나, 검증에 실패해도 설치된 패키지는 설치된 버전 그대로 계속 동작합니다.

### 사용자 지정 에이전트 가져오기

외부 에이전트 파일, 폴더, 저장소는 잠겨 있습니다. 허용하려면 **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)에서 **Allow custom Agent imports**(사용자 지정 에이전트 가져오기 허용)를 켜세요. 환경 변수는 필요 없습니다. 켜기 전까지 가져오기 컨트롤은 회색으로 표시됩니다.

가져올 때마다 에이전트가 요청하는 기능을 먼저 보여 줍니다. 권한은 명시적으로 승인해야 합니다. 함께 들어 있는 함수와 도구 선택은 가져오지 않고, 생성된 CSS는 정제하며, 결과 동작은 승인된 기능과 대조해 검사합니다. 관문을 끄면 가져온 에이전트는 멈춥니다. Marinara에서 만든 에이전트와 공식 패키지는 영향을 받지 않습니다.

<a id="custom-agent-repositories"></a>

### 사용자 지정 에이전트 저장소

저장소는 프롬프트와 도구가 검증되지 않았기 때문에 기본적으로 꺼져 있습니다. `ENABLE_CUSTOM_AGENT_REPOS=true`를 설정하고 **Allow custom Agent imports**를 켠 다음, **Agents → Agent Organizer → Custom Sources**(에이전트 → Agent Organizer → 사용자 지정 소스)를 열어 공개 GitHub 저장소를 미리 보세요. 소스를 추가할 때와 이후 변경을 적용할 때 모두 확인이 필요합니다. 동기화는 수동이며, Marinara는 백그라운드에서 저장소를 복제하거나 주기적으로 확인하지 않습니다. GitHub 저장소 루트 URL만 받습니다.

저장소는 에이전트, Game Mode 규칙 집합 또는 둘 다를 게시합니다. 루트에는 다음을 둡니다.

- `agents.json`은 다운로드 가능한 에이전트 형식의 배열입니다.

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

- `rulesets`에는 `.json` 파일 하나에 규칙 집합 하나씩, 512 KB 이하 파일을 최대 32개까지 둡니다. 그 바로 안에 있는 파일만 읽습니다. 미리보기에는 각 규칙 집합의 이름, 버전, 지원 범위가 표시됩니다. 규칙 집합의 Game Master 텍스트는 그 규칙 집합을 쓰는 모든 게임에서 모델로 전송되므로 신뢰하는 사람의 것만 설치하세요.

가져온 규칙 집합에는 `alice/my-5e`처럼 저장소 소유자의 이름이 붙으므로 공식 이름을 가져갈 수 없습니다. 모든 버전이 보존되며, 게임은 시작할 때의 바로 그 버전으로 진행됩니다. 같은 버전이 다른 내용으로 들어오면 Marinara는 설치된 쪽을 유지하고, 제작자에게 버전 번호를 올려 달라고 요청하라고 안내합니다. Marinara가 읽을 수 없는 파일은 이유와 함께 목록에 표시되고 건너뜁니다.

동기화하면 원격의 프롬프트, 설정, 도구 값이 미리보기에 표시된 저장소 관리 값을 대체합니다. 계정과 아트워크 선택은 로컬에 그대로 남습니다. 원본에서 에이전트가 사라지면 그 에이전트는 일반 로컬 에이전트로 남고 저장소 링크만 잃습니다. 소스를 제거할 때도 같으며, 그 소스의 규칙 집합은 설치된 채로 남습니다.

사용자 지정 에이전트는 Context Sources(컨텍스트 소스)에서 **Previous output**(이전 출력)을 켜서 자신의 마지막 성공 출력을 읽을 수도 있습니다. **JSON context output**(JSON 컨텍스트 출력)을 쓰면 `{"text":"main prompt content","agent-context":"private continuation context"}`를 반환하세요. 기본 프롬프트에는 `text`만 들어갑니다. **Hide output as spoilers**(출력을 스포일러로 숨기기)는 저장된 출력을 접어 둡니다. 재생성할 때는 교체되는 턴을 제외하며, 삭제된 메시지나 비활성 스와이프는 컨텍스트를 제공할 수 없습니다.

<a id="external-extensions"></a>

### 외부 확장(External Extensions)

서드파티 확장을 가져오려면 두 가지 동의가 필요합니다. 환경 변수는 서버 운영자의 허가이고, Danger Zone 스위치는 사용자의 수락입니다.

1. `.env`에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정하세요.
2. **Settings → Advanced → Danger Zone**을 열고 데이터 삭제 컨트롤 아래로 스크롤한 다음, 경고를 읽고 **Allow third-party extension imports**(서드파티 확장 가져오기 허용)를 켜세요.

그러면 **Settings → Addons**(설정 → 애드온) 아래에 **External Extensions**(외부 확장) 항목이 나타납니다. 둘 중 하나라도 닫으면 외부 기록이 비활성화되고 그 코드가 멈춥니다. 수동으로 저장한 기록, 예전 기록, 프로필로 가져온 기록, 출처를 알 수 없는 기록은 모두 외부로 간주하므로, 폴더에 파일을 넣는 방식으로는 관문을 우회할 수 없습니다. Professor Mari가 만든 초안에는 어느 관문도 필요 없습니다. 초안은 비활성 상태로 시작하며, 정확한 코드 해시를 승인해야 합니다.

기본값은 샌드박스로 격리된 Browser Extension입니다. 일부 예전 패키지는 Marinara 페이지가 필요해서 **Full page access**(전체 페이지 접근)로 표시됩니다. 이 방식은 승인된 코드를 Marinara 페이지 안에서 실행하므로 페이지 콘텐츠, 브라우저 저장소, 네트워크 API, 현재 세션에 접근할 수 있습니다. 두 관문이 모두 열린 External Extensions에서만 쓸 수 있으며, 별도의 경고 확인이 필요합니다. 비활성화한 뒤에는 페이지를 새로 고치세요.

## 전체 환경 변수 목록

접근 제어, 저장 위치, 로그, 타임아웃, 권한이 필요한 동작, 로컬 주소 허용 설정은 위의 표에 있습니다. 나머지는 여기에 정리했습니다.

### 서버와 시작

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `7860` | 서버가 대기하는 포트입니다. Android, Docker, Termux에서 같은 값을 쓰세요. |
| `HOST` | `127.0.0.1`(런처와 Docker 이미지에서는 `0.0.0.0`) | 바인딩할 네트워크 인터페이스입니다. LAN에서 접근하려면 `0.0.0.0`을 쓰세요. 기본 Compose 파일은 Docker 포트를 `127.0.0.1`에만 게시합니다. |
| `MARINARA_ANDROID_SECRET` | 비어 있음 | APK가 관리하는 Termux 설치의 내부 시크릿입니다. Android 앱이 만들고 Termux 런처가 내보냅니다. 사용자에게 설정을 요청하지 마세요. 정확히 64자의 16진수여야 합니다. 비어 있지 않은 잘못된 값은 기기 내부 요청을 HTTP 503으로 실패시킵니다. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Termux 런처와 로컬 `mari` 명령이 쓰는 시크릿 파일입니다. APK와 런처가 관리합니다. |
| `AUTO_OPEN_BROWSER` | `true` | 런처가 앱 URL을 열지 정합니다. `false`로 설정하면 열지 않습니다. APK가 관리하는 설치에서는 APK가 이 값을 끕니다. |
| `AUTO_UPDATE_ENABLED` | `true` | Git 기반 런처가 시작 전에 업데이트를 받아 적용할지 정합니다. `false`로 설정하면 다음 실행부터 받지 않습니다. 이때도 런처는 새 릴리스가 있는지 읽기 전용으로 확인하고 안내를 출력합니다. `--skip-update`를 쓰면 이번 한 번만 두 확인을 모두 건너뜁니다. |
| `MARINARA_NOTICES_ENABLED` | `true` | 서버가 메인테이너 공지를 가져올지 정합니다. [Marinara 공지](#marinara-notices)를 참고하세요. |
| `MARINARA_NOTICES_URL` | `notices` 브랜치의 `notices.json` | 포크와 미러를 위한 공지 파일 재정의입니다. 같은 방식으로 검증되며, `https://github.com/Pasta-Devs/` 밖을 가리키는 링크는 제거됩니다. 이 URL의 호스트는 hosts 파일이나 DNS에 있어야 합니다. [Marinara 공지](#marinara-notices)를 참고하세요. |
| `MARINARA_ENV_FILE` | 프로젝트 최상위의 `.env` | `.env` 파일 경로를 재정의합니다. 시작하기 전에 설정하세요. |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | 서버 전체에서 동시에 보내는 이미지나 동영상 요청 수의 상한입니다. 로컬 ComfyUI나 SwarmUI의 VRAM이 부족하면 1-2로 낮추세요. `0`은 상한을 없앱니다. 잘못된 값은 경고를 남기고 무시합니다. 일괄 작업은 마지막 자리를 차지하지 않습니다. **Settings → Generations → Overall Generations**(설정 → 생성 → 전체 생성)에 있는 **Queue media generation requests**(미디어 생성 요청 대기열 사용) 위에 추가로 적용됩니다. 이 설정은 기본적으로 켜져 있으며 계정마다 이미지와 동영상 작업을 대기열에 넣습니다. |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000`(10분) | 요청이 빈 자리를 기다리다 실패하기까지의 시간입니다. `0`이면 무한정 기다립니다. |
| `MARINARA_SHARED_GPU_HOSTS` | 비어 있음 | 로컬 모델과 로컬 이미지/동영상 백엔드가 GPU 하나를 공유할 때(llama-swap 등) 쓰는 쉼표로 구분한 `host:port` 목록입니다. 목록에 있는 호스트로 가는 텍스트 요청과 미디어 요청은 번갈아 처리되므로, 이미지가 채팅 응답 뒤에서 끝없이 기다리지 않습니다. 이미지나 클립이 기다리는 시간은 최대 `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`입니다. 임베딩은 대기시키지 않습니다. 재시작 없이 새 요청에 적용됩니다. |
| `MARINARA_ENV_WATCH` | `1` | `.env`를 감시하는 방식입니다. 기본값은 변경 이벤트(약 250 ms 디바운스)를 쓰고 30초 간격 확인을 대체 수단으로 둡니다. `poll`은 항상 30초 간격으로 확인합니다. `0`은 감시를 끕니다. [재시작과 즉시 반영](#restart-or-hot-reload)을 참고하세요. |
| `TZ` | 시스템 기본값 | 서버 작업에 쓰는 호스트 대체 시간대입니다(예: `Europe/Warsaw`). 호스트 시간대를 쓰려면 설정하지 않거나 비워 두세요. 스케줄에는 저장된 Conversation **Schedule timezone**(스케줄 시간대)이 우선합니다. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 교차 출처 요청을 보낼 수 있는 브라우저 출처입니다. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | 예전 방식의 플래그입니다. 현재 빌드에는 기본 제공 키가 없어서 아무것도 만들지 않습니다. 앱에서 직접 계정을 추가하세요. |

**Schedule timezone**의 기본값은 기기의 시간대입니다. Conversation을 설정할 때, Conversation의 Chat Settings(채팅 설정)에서, 또는 캐릭터 스케줄 편집기에서 바꿀 수 있습니다. 모든 Conversation 채팅이 함께 쓰는 하나의 전역 설정이며, 같은 서버의 다른 클라이언트에도 동기화됩니다.

### 미디어와 스프라이트 도구

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `FFMPEG_PATH` | 비어 있음 | 애니메이션 표정 GIF를 만들 때 쓰는 `ffmpeg`의 경로입니다. 설정하지 않으면 PATH에 있는 `ffmpeg`을 사용합니다. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000`(3분) | 애니메이션 표정 클립 하나를 변환하는 데 허용하는 시간입니다. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | `auto`는 내장 정리를 먼저 시도한 다음 선택 설치용 AI 도구를 씁니다. `builtin`은 내장 정리만 씁니다. `backgroundremover`는 AI 도구를 강제합니다. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | `true`로 두면 시작할 때 선택 설치용 AI 배경 제거 도구를 설치합니다. |
| `BACKGROUNDREMOVER_COMMAND` | 비어 있음 | 시스템에 설치된 `backgroundremover` 프로그램의 경로입니다. |
| `BACKGROUNDREMOVER_PYTHON` | 비어 있음 | `backgroundremover`가 설치된 Python의 경로입니다. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000`(10분) | AI 배경 제거 호출 한 번에 허용하는 시간입니다. |

### 장면 동영상 제공자

동영상 계정은 앱에서 설정합니다. 아래 설정은 작업을 조정할 때만 씁니다. 값의 단위는 밀리초입니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | 서버가 Google Veo 작업을 확인하는 주기입니다. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | xAI Imagine 작업을 확인하는 주기입니다. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | OpenRouter 동영상 작업을 확인하는 주기입니다. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | Seedance 작업을 확인하는 주기입니다. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | 비어 있음 | 이 서버의 공개 HTTPS 주소입니다. 참조 이미지를 URL로 가져와야 하는 서비스에 씁니다. |

<a id="lorebooks"></a>

### 로어북

두 설정 모두 기본적으로 꺼져 있으며 `.env`를 바꾸면 다음 생성부터 적용됩니다. `LOREBOOK_STABLE_GROUP_WINNERS`를 설정하면 **Settings → Advanced → Features**의 **Stable lorebook picks**(안정적인 로어북 선택) 스위치보다 우선합니다. 설정하지 않으면 스위치가 결정합니다. [기능 스위치](configuration/features.md)를 참고하세요.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | 후보가 그대로인 동안 채팅마다 같은 포함 그룹 승자를 유지하며, 생성할 때마다 다시 추첨하지 않습니다. 제공자 프롬프트 캐시를 위해 프롬프트 앞부분을 안정적으로 유지합니다. |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | 활성화된 항목의 전체 텍스트를 최신 어시스턴트 또는 내레이터 메시지에만 저장합니다. 이전 메시지는 항목 ID, 키, 점수만 보관합니다. 큰 로어북을 쓰는 채팅의 크기가 훨씬 작아집니다. 새 메시지를 삭제하면 다시 최신이 된 메시지에 대해 Active Context와 에이전트 재시도가 항목의 현재 텍스트를 보여 줍니다. |

`scripts/compact-lorebook-scans.mjs`는 예전 채팅에도 같은 규칙을 적용합니다. 먼저 서버를 중지하세요. `--apply`를 넘기지 않으면 시험 실행만 하며, 쓰기 전에 두 메시지 테이블을 모두 백업합니다.

<a id="robustness"></a>

### 안정성

모두 기본적으로 꺼져 있어 기존 동작을 유지합니다. `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`, `SHUTDOWN_FORCE_EXIT_ON_REPEAT`는 재시작이 필요합니다. 나머지는 `.env`를 바꾸면 적용됩니다. `PROVIDER_RETRY_TRANSIENT_ERRORS`를 설정하면 **Settings → Advanced → Features**의 **Retry failed provider calls**(실패한 프로바이더 호출 재시도) 스위치보다 우선합니다. 설정하지 않으면 스위치가 결정합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | 거부되거나 도달할 수 없는 연결, 또는 502나 503을 텍스트가 하나도 도착하기 전에만, 최대 5초씩 기다리며 최대 두 번 재시도합니다. 504나 끊긴 연결은 재시도하지 않습니다. 계정에 폴백이 있으면 쓰지 않으며, 폴백을 바로 시도합니다. 실패가 느린 호스트는 오류 표시가 약 20초 늦어질 수 있습니다. |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | 채팅 파일이나 `manifest.json`의 내용이 이 서버가 마지막으로 쓴 내용과 같고 디스크의 파일도 바뀌지 않았다면, 저장할 때 다시 쓰지 않습니다. 방금 `.bak`에서 복구한 파일은 항상 다시 씁니다. |
| `STORAGE_YIELDING_SERIALIZE` | `false` | 큰 채팅 파일의 저장 준비를 짧은 조각으로 나눠, 매우 긴 채팅을 저장할 때 다른 요청이 멈추지 않게 합니다. 기록되는 바이트는 같습니다. |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | Windows 전용입니다. 저장소 잠금이 시작할 때마다 하는 부팅 시간 검사(약 1.5~2초의 PowerShell)를 다음 재부팅까지 `DATA_DIR`의 `.writer-boot-id.json`에 기억합니다. |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | Windows 전용입니다. <kbd>Ctrl</kbd>+<kbd>Break</kbd>와 콘솔 닫기로도 서버를 정상 종료하고 대기 중인 저장을 기록합니다. 콘솔을 닫을 때는 Windows가 허용하는 약 5초에 맞춰 더 짧은 기한을 씁니다. |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | 처음 누른 지 1.5초가 지난 뒤 <kbd>Ctrl</kbd>+<kbd>C</kbd>나 <kbd>Ctrl</kbd>+<kbd>Break</kbd>를 다시 누르면 서버가 즉시 종료됩니다. 아직 기록하지 않은 저장을 잃을 수 있습니다. 이 설정이 없으면 반복 입력을 무시하고 8초 종료 제한을 적용합니다. |
| `SHUTDOWN_EARLY_FLUSH` | `false` | 중지 신호가 오면 연결이 아직 닫히는 중에도 대기 중인 저장을 쓰기 시작합니다. Advanced Settings의 재시작에는 쓰지 않습니다. |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | 중지 신호가 저장소를 닫기 전에 백그라운드 런타임(패키지, 확장, 내장 모델)을 기다리는 시간입니다. `0`은 모두 기다립니다. 최대 `2500`이므로 저장소는 8초 제한 안에 닫힙니다. Advanced Settings의 재시작은 여전히 모두 기다립니다. |

### 연동과 기타

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | **Claude (Subscription)** 계정이 이 컴퓨터에 설치된 Claude Code를 쓸지 정합니다. 설치된 버전이 Marinara에 포함된 사본과 같거나 더 새로울 때 사용합니다. Android에는 포함된 사본이 없으므로 이 값을 켜 두어야 합니다. `false`로 설정하면 항상 포함된 사본을 씁니다. 5분 안에 적용됩니다. |
| `DOCS_I18N_BASE_URL` | 공식 `docs-i18n` 브랜치 | 문서와 UI 언어 팩을 내려받는 위치입니다. UI 팩은 그 안의 `ui/` 하위 트리를 씁니다. 공개 `https://` 호스트여야 합니다. |
| `GIPHY_API_KEY` | 비어 있음 | Conversation 모드에서 GIF를 검색할 때 쓰는 Giphy 키입니다. 설정하고 재시작하기 전까지 검색이 꺼져 있습니다. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Intiface 햅틱 앱의 기본 주소입니다. |
| `SPOTIFY_REDIRECT_URI` | 요청에서 자동 판별 | Spotify 로그인 콜백을 재정의합니다. TLS를 상위에서 처리할 때 설정하세요. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Professor Mari가 잘라 내기 전까지 읽는 위키 페이지 콘텐츠의 최대 크기입니다. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Professor Mari의 위키 요청 한 번에 허용하는 시간입니다. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Professor Mari가 읽어 온 위키 내용을 캐시에 보관하는 시간입니다. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false`(Windows 런처는 `true`로 설정) | 루프백에서 관리자 헤더 없이 **Built-in model**(내장 모델) 런타임을 설치할 수 있게 합니다. |

**Built-in model**은 [내장 모델 설정](connections/local-model.md)을 참고하세요.

<a id="outbound-http-proxy"></a>

### 아웃바운드 HTTP 프록시

일부 네트워크는 v2rayN을 TUN 모드 없이 쓰는 경우처럼 HTTP 프록시를 거쳐야만 인터넷에 접속할 수 있습니다. Marinara는 AI 서비스, 이미지 서비스, 임베딩 서버, 에이전트 카탈로그로 보내는 요청을 이 프록시로 보낼 수 있습니다. 아래 값을 Marinara를 시작하는 환경이나 `.env`에 설정한 다음 재시작하세요.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | 설정하지 않음 | `1`로 설정하면 프록시를 켭니다. 이 값이 없으면 Marinara는 Node.js와 마찬가지로 프록시 설정을 무시합니다. |
| `HTTP_PROXY` | 비어 있음 | `http://127.0.0.1:10809` 같은 프록시 주소입니다. `HTTPS_PROXY`를 설정하지 않으면 모든 요청에 씁니다. |
| `HTTPS_PROXY` | 비어 있음 | `HTTP_PROXY`와 다를 때 `https://` 주소에 쓰는 프록시입니다. |
| `NO_PROXY` | 비어 있음 | 프록시를 거치지 않을 호스트를 쉼표로 구분해 적습니다. 네트워크에 있는 모델 서버를 추가하세요. `localhost`, `127.0.0.1`, `::1`은 항상 프록시를 거치지 않습니다. |

## 관련 가이드

- [기능 스위치](configuration/features.md)
- [원격 접근: 로그인과 IP 허용 목록](REMOTE_ACCESS.md)
- [Marinara가 데이터를 저장하는 위치](data/where-data-is-stored.md)
- [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)
- [장면 동영상](media/scene-video.md)
- [Marinara Engine 문제 해결](TROUBLESHOOTING.md)
