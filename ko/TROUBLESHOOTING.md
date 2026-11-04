# Marinara Engine 문제 해결

증상을 찾은 다음 해결 방법을 따라 하세요. 대부분의 문제는 런처(`start.bat`, `start.sh` 또는 `start-termux.sh`)로 Marinara를 다시 시작하면 해결됩니다.

## 가장 먼저 해 볼 것

1. 페이지를 강제로 새로 고치세요. Windows나 Linux에서는 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>, Mac에서는 <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>을 누르세요.
2. 서버 콘솔(Marinara를 실행하는 터미널 창)에 빨간색 오류 줄이 있는지 확인하세요. 대개 그 줄이 진짜 원인을 알려 줍니다.
3. 도움을 요청하려면 먼저 **Debug mode**(디버그 모드)를 켜세요. [도움 더 받기](#get-more-help)를 참고하세요.

<a id="my-character-does-not-reply"></a>

## 캐릭터가 답하지 않을 때

다음을 순서대로 확인하세요.

1. 토스트(화면 아래쪽에 표시되는 짧은 메시지)가 있는지 보세요. 대개 문제를 알려 줍니다. [연결과 생성 오류](#connection-and-generation-errors)를 참고하세요.
2. 채팅에 계정과 모델이 있는지 확인하세요. **Chat Settings**(채팅 설정)를 열고 연결을 확인하세요. 연결이 없다면 **Connections**(연결)에서 계정을 추가하세요. [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요.
3. API 키가 올바른지, 계정에 크레딧이 남아 있는지 확인하세요. 잘못된 키나 바닥난 잔액이 흔한 원인입니다.
4. 모델 이름을 확인하고, Ollama나 LM Studio 같은 로컬 서버라면 서버가 실행 중인지 확인하세요.
5. 메시지를 다시 보내거나 다른 모델을 고르세요.

아무것도 도움이 되지 않으면 **Debug mode**를 켜고 서버 콘솔을 읽어 보세요. [도움 더 받기](#get-more-help)를 참고하세요.

## 휴대폰이나 다른 기기에서 앱이 열리지 않을 때

휴대폰, 태블릿, 다른 컴퓨터에서 Marinara를 열 수 없나요?

대개 다음 세 가지 중 하나가 원인입니다.

- **주소.** 서버는 기본적으로 `127.0.0.1`(이 컴퓨터에서만 접근 가능)에서 요청을 기다립니다. 런처는 `HOST=0.0.0.0`을 설정합니다. `pnpm start`로 시작했다면 먼저 `.env`에 `HOST=0.0.0.0`을 설정하세요.
- **네트워크.** 두 기기가 같은 Wi-Fi 네트워크에 있어야 하고, 방화벽이 포트를 막아서는 안 됩니다. 기본 포트는 `7860`이며, `PORT`를 지정했다면 그 값입니다.
- **로그인.** 로그인을 설정하세요. 막힌 기기에서 서버 로그의 1회용 설정 코드와 새 사용자 이름, 비밀번호를 입력하세요. Docker에서는 `docker logs <container> 2>&1 | grep "setup code"`로 코드를 찾으세요. 또는 이미 로그인된 브라우저의 **Settings → Advanced → Access**(설정 → 고급 → 접근)에서 설정하세요. 헤드리스 서버에서는 `ssh -L 7860:127.0.0.1:7860 user@server`를 실행하고 `http://localhost:7860`을 연 다음 **Settings**를 쓰세요. [원격 접근](REMOTE_ACCESS.md#option-1-login-recommended)을 참고하세요.

다른 원인은 다음과 같습니다.

- **같은 컴퓨터의 프록시나 터널.** 같은 컴퓨터의 리버스 프록시나 터널을 거치면 로그인이 필요합니다. Tailscale을 통한 직접 통신은 기본적으로 신뢰합니다. Tailscale Serve나 Funnel, nginx 기본 HTTP/1.0 `proxy_pass`는 중계된 통신으로 간주되어 로그인이 필요합니다. 같은 호스트의 Docker 브리지 트래픽은 로그인, `IP_ALLOWLIST`, `TRUSTED_AUTH_PROXY` 중 아무것도 설정하지 않은 동안에만 신뢰합니다.
- **이 컴퓨터의 사용자 지정 이름.** `/etc/hosts`에서 `127.0.0.1`로 연결한 이름은 중계된 접속으로 간주됩니다. 대신 `localhost`, `127.0.0.1`, 컴퓨터의 호스트 이름 또는 `*.localhost` 이름을 사용하세요.
- **Too many wrong passwords.** 15분 기다린 다음 로그인하세요. 비밀번호를 잊었나요? Marinara를 실행하는 컴퓨터의 Marinara 폴더에서 `node scripts/reset-login.mjs`를 실행하세요. Docker에서는 `docker exec <container> node scripts/reset-login.mjs`를 실행하세요. 서버를 다시 시작해도 다시 시도할 수 있습니다.
- **Untrusted request host.** 공개 도메인이나 리버스 프록시 도메인이라면 `.env`의 `TRUSTED_HOSTS`에 정확한 호스트 이름을 추가하세요. 직접 IP 주소는 계속 허용됩니다.
- **위험한 작업 차단.** 그 기기에서 백업, 데이터 삭제, 업데이트 같은 위험한 작업이 막힌다면 서버가 실행 중인 컴퓨터에서 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)를 열고 **Make admin secret**(관리자 시크릿 만들기)을 클릭하거나, 서버 `.env`에 `ADMIN_SECRET`을 설정하세요. 다른 기기의 **Admin Access**에 시크릿을 입력하고 **Save**(저장)를 클릭하세요.

[원격 접근](REMOTE_ACCESS.md)과 [자주 묻는 질문](FAQ.md)을 참고하세요. 업데이트 후 접속이 막혔다면 [업데이트 후 접속이 막혔을 때](REMOTE_ACCESS.md#locked-out-after-updating)를 참고하세요.

## 저장이 차단되거나 설정이 유지되지 않을 때

저장이 된 것처럼 보이는데 다시 불러오면 원래대로 돌아갑니다. 교차 사이트 보호(CSRF)가 이 브라우저 주소를 신뢰하지 않아 저장을 막고 있는 것입니다. 저장이 조용히 실패한다는 빨간색 배너가 보이거나, **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected**, **Save blocked: origin not trusted** 중 하나가 제목인 토스트가 뜹니다.

루프백, 사설 네트워크 주소, Tailscale, Docker 브리지는 자동으로 신뢰합니다. 이 문제는 주로 공개 IP나 도메인 이름에서 생깁니다. `.env`의 `CSRF_TRUSTED_ORIGINS`에 주소를 쉼표로 구분해 추가하세요. 배너에는 그 줄을 채워 주는 **Copy**(복사) 버튼이 있습니다. 다시 시작할 필요는 없습니다.

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

<a id="connection-and-generation-errors"></a>

## 연결과 생성 오류

생성 오류는 화면 아래쪽에 토스트로 표시됩니다. 토스트는 원인을 알려 주며, 복사할 수 있을 만큼 오래 떠 있습니다.

| 메시지 또는 증상 | 해결 방법 |
| --- | --- |
| **No API connection configured for this chat** | 채팅에 계정이 없습니다. **Connections**에서 계정을 추가한 다음 채팅에 지정하세요. [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요. |
| 모델이 파라미터를 받지 않는 경우 | **Chat Settings → Advanced Parameters**(채팅 설정 → 고급 매개변수)를 열고 토스트에 나온 파라미터 옆의 스위치를 끄세요. |
| 모델이 파라미터가 필요하다고 하는 경우 | 그 파라미터의 스위치를 켜세요. |
| **This model's chat template needs user and assistant messages to take turns** | llama.cpp에서 실행하는 Mistral 기반 모델 같은 일부 로컬 모델은 메시지가 번갈아 와야 합니다. Marinara는 연달아 이어진 메시지를 합친 뒤 한 번 다시 시도합니다. 그래도 계속되면 **Chat Settings → Advanced Parameters**에서 **Post-Processing Messages**(메시지 후처리)를 **Single User Message**(단일 사용자 메시지)로 설정하거나, 덜 엄격한 채팅 템플릿으로 모델을 실행하세요. |
| **The AI returned an empty response. Try sending your message again.** | 다시 보내세요. 같은 문제가 반복되면 다른 모델이나 계정을 써 보세요. |
| **A generation is already in progress for this chat** | 답변이 아직 스트리밍 중입니다. 기다리거나 **Stop**(중지)을 클릭한 다음 다시 시도하세요. |
| **No connections are marked for the random pool** | 무작위 라우팅이 켜져 있지만 풀에 계정이 없습니다. 계정을 하나 추가하거나 무작위 라우팅을 끄세요. |
| 모든 메시지가 네트워크 오류로 실패하고, 컴퓨터가 프록시를 거쳐야만 인터넷에 접속할 수 있는 경우 | Marinara에 프록시를 알려 주세요. [아웃바운드 HTTP 프록시](CONFIGURATION.md#outbound-http-proxy)를 참고하세요. |

## 업데이트 후

업데이트 직후 생기는 문제를 먼저 쉬운 말로 정리하면 다음과 같습니다.

- 화면이 비어 있거나 예전 모습으로 보이는 경우: [화면이 비어 있거나 예전 모습으로 보일 때](#blank-stale-or-old-looking-screen)와 [업데이트 후 빈 페이지가 나타나거나 JavaScript가 HTML로 반환될 때](#blank-page-or-javascript-served-as-html-after-an-update)를 참고하세요.
- 채팅이나 프리셋이 사라진 것처럼 보이는 경우: [업데이트 후에 데이터가 사라진 것처럼 보일 때](#data-seems-missing-after-an-update)를 참고하세요. 데이터는 거의 언제나 디스크에 그대로 있습니다.
- 이전 버전으로 돌아간 뒤 채팅이 비어 보이는 경우: [이전 버전으로 전환한 뒤 채팅에 메시지가 보이지 않을 때](#chats-show-no-messages-after-switching-to-an-older-version)를 참고하세요.

<a id="blank-stale-or-old-looking-screen"></a>

### 화면이 비어 있거나 예전 모습으로 보일 때

서버는 돌아가는데 브라우저에 빈 페이지가 뜨거나, 업데이트한 뒤에도 앱이 예전 모습으로 보입니다. 브라우저가 웹 앱의 캐시된 사본을 붙들고 있기 때문입니다.

1. 강제로 새로 고치세요.
2. 그래도 해결되지 않으면 **Settings → Advanced → Updates**(설정 → 고급 → 업데이트)를 열고 **Refresh App**(앱 새로고침)을 클릭하세요.

**Refresh App**은 브라우저의 서비스 워커(앱을 캐시해 두는 백그라운드 스크립트)와 캐시를 지운 뒤 페이지를 다시 불러옵니다. 데이터를 바꾸거나 서버를 업데이트하지는 않습니다. 앱 자체를 업데이트하려면 [Marinara Engine 업데이트](UPGRADING.md)를 참고하세요.

<a id="blank-page-or-javascript-served-as-html-after-an-update"></a>

### 업데이트 후 빈 페이지가 나타나거나 JavaScript가 HTML로 반환될 때

`text/html` 유형과 함께 "Failed to load module script" 같은 오류가 나타나면 브라우저가 빌드에 없는 JavaScript 파일을 요청했다는 뜻입니다. 데이터를 삭제해도 해결되지 않습니다.

1. 서버를 멈추세요.
2. `start.bat`, `start.sh` 또는 `start-termux.sh`를 다시 실행하세요. 런처는 시작하기 전에 불완전한 클라이언트 파일을 다시 빌드합니다. 수동 설치라면 먼저 저장소 루트에서 `pnpm build`를 실행하세요.
3. 그래도 페이지가 비어 있다면 강제로 새로 고치거나 시크릿 창을 사용해 보세요.

그래도 실패하면 실패한 파일의 전체 URL, HTTP 상태, Content-Type, 응답 첫 줄을 런처 출력과 함께 알려 주세요.

<a id="data-seems-missing-after-an-update"></a>

### 업데이트 후에 데이터가 사라진 것처럼 보일 때

데이터 폴더를 지우지 마세요. Marinara는 실제로 쓰는 데이터를 데이터 폴더 안의 `storage` 폴더에 보관합니다. `packages/server/data/`와 `data/`에서 `storage`를 찾아보세요. 서버는 시작할 때 자신이 찾아낸 폴더 경로를 출력합니다.

<a id="chats-show-no-messages-after-switching-to-an-older-version"></a>

### 이전 버전으로 전환한 뒤 채팅에 메시지가 보이지 않을 때

새 Marinara 버전은 각 채팅의 레코드(메시지, 스와이프, 기억, 이미지)를 채팅별 파일에 저장하므로 긴 채팅을 더 빠르게 저장할 수 있습니다. 이전 버전은 이 구조를 읽지 못해 채팅이 빈 것처럼 보입니다. 데이터는 디스크에 그대로 있습니다.

Marinara는 명백한 다운그레이드를 막습니다. 런처는 호환되지 않는 버전으로 가는 자동 업데이트를 건너뛰고, 앱 내 업데이터는 이 문서를 안내하는 오류를 표시합니다.

업데이트한 뒤 이전 버전으로 돌아갔다면 업데이트 전에 만든 백업을 복원하세요. [이전 버전으로 다운그레이드하기](UPGRADING.md#downgrading-to-an-older-version)를 참고하세요. 기술적인 세부 사항은 아래와 같습니다.

현재 데이터는 저장 형식 10을 사용합니다. 형식 8, 9, 10은 이전 빌드가 안전하게 읽을 수 없는 3D 아바타 설정(MMD, 그다음 GLB와 FBX)과 연결 계정 링크를 추가합니다. 데이터가 형식 8 이상에 도달했다면 이전 빌드를 쓰기 위해 그 업그레이드 전에 만든 전체 백업을 복원하세요. 아래 명령은 이전 채팅 파일 구조만 변환합니다. 형식 번호를 직접 바꾸지 마세요. [이전 버전으로 다운그레이드하기](UPGRADING.md#downgrading-to-an-older-version)를 참고하세요.

형식 8 미만의 데이터라면 채팅 파일 구조를 변환하세요.

1. Marinara 서버를 중지하세요.
2. Marinara 폴더에서 다음을 실행하세요.

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. 이전 버전으로 전환하고 시작하세요.

이 명령은 채팅별 파일에서 단일 파일 구조를 다시 만듭니다. 아무것도 삭제하지 않습니다. 채팅별 파일은 `<table>.post-unshard-<timestamp>` 이름의 폴더에 남고, `.pre-shard` 원본이 있다면 그것도 남습니다. 다시 업그레이드하면 Marinara가 데이터를 다시 변환합니다.

Docker나 Podman에서는 데이터가 `marinara-data` 볼륨에 있습니다. 컨테이너를 중지하고 아래 명령을 실행한 다음 이전 이미지를 시작하세요.

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## 설치와 실행 문제

### Termux: CANNOT LINK EXECUTABLE "node" 오류

Termux가 `CANNOT LINK EXECUTABLE "node"`와 함께 `cannot locate symbol` 또는 `library ... not found`를 출력합니다. Termux의 나머지는 그대로 둔 채 Node.js만 업그레이드된 것입니다. 그러면 Android 앱이 **Could not verify that this Marinara Android build can safely read your stored data** 메시지를 표시하고 멈출 수 있습니다. 데이터가 원인이 아니며, APK를 다시 설치해도 해결되지 않습니다.

1. Termux에서 다음을 실행하세요.

   ```bash
   pkg upgrade -y
   ```

2. Android 앱에서 **Install / Start Marinara**(Marinara 설치/시작)를 탭하세요. 직접 설치했다면 `cd "$HOME/Marinara-Engine" && ./start-termux.sh`를 실행하세요.

업그레이드 중에 설정 파일을 유지할지 물으면 Enter를 눌러 현재 파일을 유지하세요. 현재 런처와 Android 앱은 이 업그레이드를 알아서 실행합니다.

### Termux: 클라이언트 빌드 중 JavaScript 힙 메모리 부족

Vite가 `Reached heap limit` 또는 `JavaScript heap out of memory`로 멈춥니다. 업데이트한 다음 `./start-termux.sh`를 다시 실행하세요. 클라이언트 빌드는 별도의 1536 MiB 힙을 쓰며, 기기 RAM의 절반을 넘지 않지만 1280 MiB 아래로는 내려가지 않습니다. 직접 설정한 `NODE_OPTIONS` 힙 제한이 우선하므로 예전 1024 MiB 설정은 지우세요. 다시 시도하기 전에 다른 앱을 닫으세요. RAM이 약 3 GB 미만인 휴대폰은 여전히 메모리가 부족할 수 있습니다. 빌드 실패를 고치려고 채팅이나 프로필을 삭제하지 마세요.

### 데스크톱: 클라이언트 타입 검사 중 JavaScript 힙 메모리 부족

빌드가 멈추고 `The client type-check needs about 2.5 GiB of Node.js heap`이라고 표시합니다. `NODE_OPTIONS`의 제한이 너무 작은 것이며, 빌드는 직접 설정한 제한을 그대로 따릅니다. `--max-old-space-size`를 2560 이상으로 올리세요. `NODE_OPTIONS`에 `--max-old-space-size-percentage`가 있다면 대신 그 값을 올리세요. 이 옵션이 다른 옵션보다 우선하기 때문입니다. 또는 두 옵션을 모두 지우세요. 그런 다음 런처를 다시 실행하세요. 데이터는 건드리지 않습니다.

### Termux: 멀티플레이어 게스트 파일 누락

시작할 때 `packages/client/dist/multiplayer/guest.js`가 없다고 나옵니다. Marinara를 업데이트하고 `./start-termux.sh`를 다시 실행하세요. 이 스크립트가 전체 클라이언트 빌드를 실행합니다. 멀티플레이어를 켤 필요는 없습니다.

### Termux: Marinara를 열면 서버가 멈추거나 Sharp를 불러올 수 없음

Sharp는 Marinara가 썸네일과 스프라이트에 쓰는 이미지 라이브러리입니다. Android에서는 WebAssembly 대체 구현으로 실행됩니다. Marinara를 업데이트하고 런처가 의존성을 다시 설치하게 하세요. 업데이트하기 전에 서버가 멈춘다면 Termux에서 직접 설치를 복구하세요.

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

채팅과 설정은 건드리지 않습니다. 그래도 Sharp를 불러올 수 없으면 Marinara는 이미지 처리를 끈 채 계속 실행됩니다. 기존 썸네일은 그대로 보이고, 새 썸네일은 원본 크기 이미지를 쓰며, 스프라이트 생성과 내장 배경 제거는 사용할 수 없습니다. Sharp를 다른 버전으로 바꾸지 마세요. 보고할 때 쓸 수 있도록 전체 오류 출력을 보관하세요.

<a id="browser-opens-before-startup-finishes"></a>

### 시작이 끝나기 전에 브라우저가 열리는 문제

업데이트하고 런처로 다시 시작하세요. 런처는 서버가 준비되었다고 알린 뒤에만 브라우저를 엽니다. 시작에 실패하면 탭이 열리지 않으므로 터미널 오류를 보관하세요. 앱을 직접 열려면 `AUTO_OPEN_BROWSER=false`를 설정하세요.

### Windows: pnpm 설치 중 EPERM 또는 corepack 서명 오류

pnpm은 Marinara가 코드를 설치할 때 쓰는 패키지 관리자입니다. `EPERM: operation not permitted`나 corepack 서명 오류가 나타나면 corepack이 Node 설치 폴더에 파일을 쓰지 못한 것입니다. 다음 중 하나를 시도한 다음 런처를 다시 실행하세요.

1. 터미널을 마우스 오른쪽 버튼으로 클릭하고 **Run as administrator**를 선택한 다음 런처를 실행하세요.
2. `npm install -g pnpm@12.15.0`으로 pnpm을 직접 설치하세요.
3. 관리자 권한 터미널에서 `npm install -g corepack`으로 corepack을 업데이트하세요.

### pnpm 버전 오류 또는 `'pnpm' is not recognized` 오류

Marinara는 pnpm 12.15.0을 사용합니다. 런처가 맞는 버전을 알아서 가져오므로, 예전에 전역으로 설치한 pnpm을 먼저 바꿀 필요는 없습니다. Marinara를 업데이트한 다음(런처가 업데이트하지 못하면 Marinara 폴더에서 `git pull`을 실행하세요) 런처를 다시 실행하세요. 그래도 실패하면 정확한 버전을 설치하고 런처를 다시 실행하세요.

```bash
npm install -g pnpm@12.15.0
```

### Linux: 설치 중 ERR_PNPM_ENAMETOOLONG

이전 설치가 긴 폴더 경로를 남겨 둔 상태입니다. Marinara 폴더에서 다음을 실행하세요.

```bash
rm -rf node_modules .pnpm .pnpm-store
```

그런 다음 `./start.sh`를 다시 실행하세요. 직접 설치했다면 `pnpm install`을 실행하세요.

### 설치 중 "Ignored build scripts: @google/genai" 알림이 나올 때

이 알림은 무해합니다. `pnpm approve-builds`는 Marinara가 추적하는 파일을 바꾸므로 실행하지 마세요. 업데이트 후에도 알림이 계속 나오면 Marinara 폴더의 `node_modules/.modules.yaml`을 삭제하고 런처를 다시 실행하세요.

### 설치 중 ERR_PNPM_TRUST_DOWNGRADE

거의 대부분 설치가 중간에 끝난 상태입니다. 런처를 다시 실행하세요. 직접 설치했다면 Marinara 폴더에서 다음을 실행하세요.

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## 내장 모델 문제

**Built-in model**(내장 모델)은 API 키 없이 내 컴퓨터에서 실행됩니다. 일부 오류 메시지에서는 사이드카라고 부릅니다. 설정 방법은 [내장 모델 설정](connections/local-model.md)을 참고하세요.

- **Sidecar runtime install is disabled.** 내 컴퓨터에서는 `.env`에 `SIDECAR_RUNTIME_INSTALL_ENABLED=true`를 설정하세요. 다른 기기에서는 먼저 **Settings → Advanced → Admin Access**에 관리자 시크릿을 저장하세요.
- **다른 기기(네트워크 주소나 Docker)에서 모델 다운로드나 설정이 실패함.** 이때도 관리자 시크릿이 필요할 수 있습니다. 내 컴퓨터에서는 필요 없습니다.
- **함께 제공되는 llama.cpp, MLX, uv 파일의 크기 또는 SHA-256 불일치.** Marinara가 사용하기 전에 그 파일을 거부한 것입니다. Marinara를 업데이트하거나 다시 설치한 뒤 재시도하세요. 파일의 압축을 풀거나 파일을 편집하거나 우회하지 마세요.

## 기억 기능과 요약

### Memory Recall이 아무것도 기억하지 못할 때

**Memory Recall**(기억 회상)은 이전 메시지를 검색해 가장 관련 있는 메시지를 프롬프트에 다시 넣습니다.

1. **Chat Settings → Memory Recall**(채팅 설정 → 기억 회상)을 열고 **Enable Memory Recall**(이전 기억 불러오기)이 켜져 있는지 확인하세요.
2. **Access memories for this chat**(이 채팅의 기억에 접근)을 여세요. **Memories for This Chat**(이 채팅의 기억)에서 각 조각의 상태를 확인하세요.
3. **Waiting for vector**는 기억을 아직 처리하는 중이라는 뜻입니다. 기다렸다가 다시 채팅하세요.
4. **Embedding unavailable**은 동작하는 임베딩 소스가 없다는 뜻입니다. 임베딩 계정을 설정하거나 내장 모델이 로드되게 두세요. 모든 채팅에 소스 하나를 쓰려면 **Connections**의 **Defaults**(기본값) 섹션에 있는 **Embeddings**(임베딩)에서 고르세요.

기억은 새 메시지가 5개 이상 쌓여야 만들어집니다. 회상은 새 메시지와 많이 비슷한 기억만 보여 주므로, 기억이 있어도 아무것도 나오지 않을 수 있습니다.

<a id="advanced-memory-says-scenes-need-attention"></a>

### Advanced Memory가 장면을 확인해야 한다고 알릴 때

**Chat Settings** 버튼에 깜박이지 않는 점이 계속 표시되거나 Advanced Memory가 문제를 찾았다는 알림이 나타나면, 일부 장면 기억이 불분명하거나 오래되었거나 빠져 있다는 뜻입니다.

1. **Chat Settings → Memory Recall**을 열거나 알림에서 **Fix**(수정)를 클릭하세요.
2. **Fix**를 클릭하세요. Helper model(보조 모델)로 고칠 수 있는 장면을 모두 고치며, 직접 편집한 요약은 절대 바꾸지 않습니다.
3. **need your review**(검토 필요) 아래의 각 장면 번호를 선택하고, **Access memories for this chat**에서 텍스트와 캐릭터를 확인한 다음 **Save correction**(수정사항 저장)을 클릭하세요.

**Fix**가 오류로 멈추면 Helper model의 계정을 확인한 다음 **Resume processing**(처리 재개)이나 **Fix**를 다시 클릭하세요. [기억 문제 해결하기](agents/memory.md#fixing-memory-problems)를 참고하세요.

### 요약이 생성되지 않을 때

요약을 만들려면 동작하는 텍스트 계정이 필요합니다.

- Roleplay: **Chat Settings → Chat Summary**(채팅 설정 → 채팅 요약)를 열고 계정이 지정되어 있는지 확인하세요. 오래된 채팅을 따라잡으려면 **Backfill Summary**(요약 백필)를 쓰세요.
- Conversation: **Automatic Summarization**(자동 요약)을 열고 **Backfill**(백필)로 실패한 날짜를 다시 시도하세요.
- 채팅에서 에이전트 쓰기 승인을 요구한다면 AI 요약은 내 검토를 기다립니다.
- 잘못된 API 키처럼 요약이 계속 실패하면 나중에 다시 시도합니다. 계정을 고친 다음 **Backfill**을 쓰세요.

## 다운로드 에이전트 문제

- **Agent Organizer에서 카탈로그를 사용할 수 없음.** 브라우저뿐 아니라 서버를 실행하는 컴퓨터도 HTTPS로 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 카탈로그에 접근할 수 있어야 합니다. 설치한 에이전트는 오프라인에서도 계속 동작합니다. 연결을 되살린 다음 **Refresh**(새로고침)나 **Try again**(재시도)을 클릭하세요.
- **설치한 지도나 통화가 보이지 않음.** Marinara를 완전히 종료했다가 다시 시작하세요. 이런 패키지는 다음 시작 전까지 **Restart required**(재시작 필요) 상태로 남습니다. Conversation 게임은 바로 활성화됩니다. 설치가 실패했다면 카탈로그를 새로 고치고 게임이 준비 상태로 표시되는지 확인하세요. 채팅의 **Commands**(명령어) 설정에 게임을 추가하는 것은 캐릭터가 스스로 게임을 시작하게 할 때만 필요하며, 수동 슬래시 명령어에는 필요하지 않습니다.
- **첫 패키지 마이그레이션이 끝나지 않음.** `data/capability-packages`나 채팅 데이터를 지우지 마세요. Marinara는 다음 시작 때 다시 시도하며, 채팅 선택은 저장된 채로 남습니다.
- **`data/capability-runtime-snapshots`나 `data/capability-packages/versions`가 커짐.** 정리할 필요는 없습니다. Marinara는 시작할 때 오래된 사본을 삭제하고 각 에이전트의 현재 버전과 이전 버전을 남깁니다.
- **패키지 다운로드가 거부됨.** 체크섬, 파일 목록, Marinara 버전 범위나 아카이브 경로가 공식 카탈로그와 일치하지 않는 것입니다. Marinara를 업데이트하고 카탈로그를 새로 고친 뒤 다시 시도하세요. 데이터 폴더에 아티팩트를 직접 풀어 넣지 마세요.
- **업데이트.** 에이전트 업데이트는 시작할 때 적용되지 않습니다. Marinara가 먼저 묻습니다. **Not now**(나중에)는 설치된 버전을 유지하며, **Update**(업데이트)는 **Agents → Agent Organizer**(에이전트 → Agent Organizer)에 남아 있습니다. 업데이트가 실패하면 설치된 버전이 그대로 남습니다. 시작 점검에 실패한 서버 런타임은 이전 버전으로 되돌아갑니다.

## Card Browser 문제

**Card Browser**(카드 브라우저)는 공개 캐릭터 사이트를 검색합니다. **Characters**(캐릭터) 패널이나 **Personas**(페르소나) 패널 위쪽의 **Download**(다운로드) 버튼으로 여세요.

- **JannyAI에 Cloudflare 차단이 표시됨.** 같은 브라우저에서 JannyAI 사이트를 한 번 방문해 확인 절차를 통과한 다음 다시 시도하세요.
- **다시 시작한 뒤 Pygmalion 로그인이 풀림.** 정상입니다. 이 로그인은 서버 메모리에만 있습니다. 로그인 창을 열고 토큰을 다시 붙여넣으세요.
- **CharacterTavern에서 결과 대신 안내가 표시됨.** 정상입니다. 새 웹사이트는 Marinara가 쓰던 연결을 더 이상 제공하지 않습니다. character-tavern.com에서 카드를 다운로드한 뒤 그 파일을 가져오세요.

## 미디어 생성 문제

### 복잡한 장면에서 스프라이트 배경 정리가 잘 되지 않을 때

생성한 스프라이트는 보통 자체 투명도를 쓰거나, Marinara가 제거하는 단색 배경을 씁니다. 사진으로 찍은 방, 세밀한 풍경, 짙은 그림자, 배경과 비슷한 색은 선택 사항인 AI 대체 방식이 필요할 수 있습니다.

```bash
pnpm backgroundremover:install
```

그런 다음 Marinara를 다시 시작하고 스프라이트 생성 창에서 **Reapply Cleanup**(정리 다시 적용)을 클릭하세요. Marinara는 내장 정리를 먼저 시도하고, 가장자리가 고르지 않아 보일 때만 AI 모델을 씁니다. 설치가 실패하면 다음을 확인하세요.

- Python 3.9에서 3.11까지의 버전이 설치되어 있는지 확인하세요. 더 최신 버전에서는 느린 네이티브 빌드를 거쳐야 할 수 있습니다.
- `pnpm backgroundremover:reinstall`을 실행하세요.
- 문제를 살펴보는 동안 AI 대체 방식을 건너뛰려면 `.env`에 `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin`을 설정하세요.

### Game Mode나 Roleplay 스토리보드가 나타나지 않을 때

스토리보드는 완성된 서술을 키프레임 이미지와 선택 사항인 클립으로 만들어 줍니다. [스토리보드 에이전트 가이드](game/storyboard.md)와 [Game Mode: 시작하기](game/getting-started.md)를 참고하세요.

- **Agents → Agent Organizer**에서 **Storyboard**(스토리보드)를 설치한 다음, 채팅에서 **Enable Agents**(에이전트 활성화)와 **Enable Storyboards**(스토리보드 활성화)를 켜세요.
- 키프레임에는 이미지 계정이 필요합니다. 클립에는 동영상 계정도 필요합니다.
- Game 자동 생성: **Chat Settings → Agents → Storyboards**(채팅 설정 → 에이전트 → 스토리보드)를 열고 **Automatic Storyboard Illustrations**(자동 스토리보드 일러스트)가 켜져 있는지 확인하세요. 클립을 원하면 **Automatic Storyboard Animations**(자동 스토리보드 애니메이션)를 켜세요.
- 장면 동영상 수동 생성: **Chat Settings → Gallery**(채팅 설정 → 갤러리)를 열고 이미지를 생성하거나 업로드한 다음 **Video**(비디오)나 **Animate**를 쓰세요. **Videos**(동영상) 탭을 확인하세요.
- Roleplay: 채팅에 **Storyboard** 에이전트를 추가하세요. **Still images**(정지 이미지)나 **Animations**(애니메이션)를 고르고 **Messages per episode**(에피소드당 어시스턴트 메시지 수)를 설정한 다음 이미지 계정을 고르세요. **Manual only**(수동 전용)는 **Chat Settings**의 **Gallery** 섹션에 있는 **Create storyboard**(스토리보드 만들기)에서 실행합니다.
- 모든 캐릭터를 한데 묶은 사용자 지정 프롬프트가 더 잘 맞는다면 **Use NovelAI Character Prompts**(NovelAI 캐릭터 프롬프트 사용)를 끄세요.
- 느린 서비스에서는 시간 초과가 날 수 있습니다. `.env`의 `IMAGE_GEN_TIMEOUT_MS`나 `VIDEO_GEN_TIMEOUT_MS` 값을 늘린 다음 Marinara를 다시 시작하세요.
- `Outbound response exceeded 31457280 bytes`: 기본적으로 30 MiB를 넘는 이미지 응답은 실패합니다. 워크플로와 참조 이미지를 담은 ComfyUI 파일은 이 크기에 이를 수 있습니다. `.env`의 `IMAGE_GEN_MAX_RESPONSE_BYTES` 값을 늘리고 다시 시작하거나, ComfyUI에서 메타데이터를 끄세요.

### Game Mode 세계 생성에서 JSON 오류가 날 때

모델이 잘못된 JSON(구조화된 텍스트)을 돌려주면 Marinara는 턴을 버리지 않고 **Repair JSON** 창을 엽니다.

1. 편집기에서 괄호, 쉼표, 필드를 고치세요. 텍스트가 제대로 해석되면 배너에 **JSON is valid.**라고 표시됩니다.
2. **Format**(형식 정리)을 클릭해 형태를 보기 좋게 정리하세요.
3. **Apply Repaired JSON**(수정한 JSON 적용)을 클릭하면 응답을 다시 생성하지 않고 그대로 사용합니다.

## 음성, 통화, TTS

- **통화 중에 캐릭터가 말하지 않음.** Text to Speech(음성 합성)가 설정되지 않은 것입니다. **Connections → Text to Speech**(연결 → TTS)를 열어 켜고, 소스를 고르고, 키를 입력하고, 음성을 고른 다음 저장하세요. 음성이 없는 캐릭터는 텍스트로만 표시됩니다.
- **음성이 "No audio after N s"와 함께 멈춤.** 음성 서버가 Marinara가 기다리는 시간보다 느린 것입니다. 노트북에서 돌리는 로컬 서버라면 흔한 일입니다. `N`은 현재 타임아웃 값입니다. **Connections → Text to Speech**에서, 또는 메시지에 나온 오디오 계정에서 **Request timeout (seconds)**(요청 제한 시간, 초)를 늘리세요. [요청 타임아웃](media/tts-setup.md#request-timeout)을 참고하세요.
- **마이크가 동작하지 않음.** **Agents → Agent Organizer**에서 **Calls**를 설치하세요. 그런 다음 **Connections → Speech to text**(연결 → 음성 인식)를 열고 **On this device**(이 기기) 아래에서 **Local speech model**(로컬 음성 모델)을 찾아 Whisper 모델을 고른 다음 **Download Whisper**(Whisper 다운로드)를 클릭하세요. Firefox는 브라우저 음성 인식이 없어서 이 과정이 필요합니다. Calls를 제거하면 Whisper 모델도 삭제됩니다. 직접 운영하는 서버를 쓸 수도 있습니다. [직접 운영하는 음성 인식 서버 사용하기](conversation/calls.md#use-your-own-speech-to-text-server)를 참고하세요.
- **Local Whisper is disabled in Lite mode.** lite 이미지로는 로컬 음성 모델을 실행할 수 없습니다. 일반 설치를 쓰세요.

### 원격이나 네트워크 설치 환경에서 Music DJ의 Spotify 로그인이 실패할 때

Music DJ 에이전트의 Spotify 모드는 OAuth를 씁니다. OAuth는 Spotify가 로그인을 처리한 뒤 콜백 주소(리디렉션 URI)로 되돌려 보내는 로그인 전달 방식입니다. Spotify는 `https://` 주소나 `http://127.0.0.1`만 받아들이며, 일반 네트워크 IP 주소는 거부합니다.

- localhost에서는 편집기에 `127.0.0.1` 콜백이 표시됩니다. 그 주소를 Spotify에 등록하세요.
- HTTPS에서는 편집기에 HTTPS 콜백이 표시됩니다. 그 주소를 등록하세요.
- HTTPS가 앞단에서 끝나고 호스트가 일치하지 않으면 `.env`의 `SPOTIFY_REDIRECT_URI`에 공개 콜백 주소를 설정하세요.
- 일반 HTTP 네트워크 설치에서는 팝업이 열리지 않지만, 주소 표시줄에는 유효한 코드가 있습니다. 전체 URL을 복사하고 Connect 버튼 아래의 **Browser couldn't reach the callback?**(브라우저에서 콜백에 연결하지 못했나요?)을 펼쳐 붙여넣으세요. 이 URL은 10분 동안 유효합니다.

가장 깔끔한 해결책은 Marinara를 HTTPS로 제공하는 것입니다.

## 저장소와 데이터

### Restart Server 후 서버가 돌아오지 않음

`start.bat`, `start-local.bat`, `start.sh`, `start-termux.sh` 또는 `pnpm start`로 Marinara를 시작하세요. 이 방식은 서버를 런처에 연결해 두고, 이전 프로세스가 끝나면 대체 프로세스를 시작합니다. 앱 내 재시작은 4초 후 남아 있는 연결을 닫고, 8초 후 강제로 종료합니다. 강제 종료는 대기 중인 쓰기 작업을 중단할 수 있습니다. 직접 `node`로 실행한 프로세스와 개발용 감시 프로세스는 교체되지 않으므로 직접 중지했다가 다시 시작하세요. Docker는 컨테이너 재시작 정책을 따릅니다. Windows에서는 런처 콘솔에서 <kbd>Ctrl</kbd>+<kbd>C</kbd>를 누르고 **Shutdown complete**가 표시될 때까지 기다린 다음 콘솔을 닫으세요.

첫 번째 서버가 실행 중일 때 같은 데이터 폴더로 두 번째 서버를 시작하지 마세요. 남아 있는 프로세스를 먼저 중지하세요.

### 시작할 때 다른 프로세스가 데이터 디렉터리를 사용 중일 수 있다고 나올 때

로컬 데이터 폴더에는 서버 하나만 쓸 수 있습니다. 시작할 때 폴더에 대해 **Another Marinara Engine process ... may be using**이 표시되면 다른 Marinara 프로세스를 종료하고 다시 시작하세요.

크래시가 났거나 Docker 볼륨을 옮긴 뒤에는 시작할 때 **The storage writer lease ... is incomplete or invalid**가 표시되거나, 더는 존재하지 않는 프로세스가 표시될 수 있습니다.

1. 그 데이터 폴더를 쓰는 모든 Marinara 프로세스와 컨테이너가 중지되었는지 확인하세요.
2. 오류에 나온 `.writer-lease` 폴더만 제거하세요.
3. Marinara를 다시 시작하세요. `storage` 폴더나 테이블 파일은 제거하지 마세요.

데이터 폴더가 로컬 드라이브에 있으면 Linux, Android, 컨테이너, Windows에서 크래시한 프로세스가 남긴 리스를 Marinara가 알아서 정리합니다. 수동 단계는 네트워크 저장소나 공유 저장소, 이동식 드라이브, (Windows에서) 크래시 후 이름을 바꾼 컴퓨터를 위한 대체 수단입니다.

### 백업이나 내보내기에서 403이 반환될 때

같은 컴퓨터의 세션은 관리자 시크릿 없이 백업할 수 있습니다. 다른 기기, 네트워크 주소, Docker, 같은 컴퓨터의 프록시나 터널에서 오는 요청에는 시크릿이 필요합니다. 서버가 실행 중인 컴퓨터의 **Settings → Advanced → Admin Access**에서 시크릿을 만들거나 서버에 `ADMIN_SECRET`을 설정한 다음, 다른 기기의 **Admin Access**에 같은 값을 저장하세요. 루프백에서도 시크릿을 요구하려면 `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`를 설정하세요. `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`이면 전달된 방문자도 로컬 면제를 받습니다. 공개 프록시나 터널을 쓴다면 이 보호를 켜 두세요.

### 가져오기에서 파일이 읽을 수 있는 ZIP 아카이브가 아니라고 나올 때

Marinara는 `.charx` 카드, `.marinara` 패키지, 에이전트 패키지, 사용자 지정 에이전트 저장소를 ZIP 아카이브로 읽습니다. 아카이브가 손상되었거나 내용이 파일 목록과 맞지 않으면 거부하고 **The file is not a readable ZIP archive** 또는 **Could not read .marinara package**를 표시합니다. 대개는 다운로드가 중간에 끊긴 것이 원인이므로 파일을 다시 다운로드하세요. 아카이브를 직접 만들었다면 시스템의 압축 기능, `zip`, 7-Zip으로 다시 만드세요.

**Package contains too many files**는 에이전트 패키지나 저장소에 파일이 8,192개보다 많다는 뜻입니다. **.marinara package has too many entries**는 `.marinara` 패키지에 항목이 8개보다 많다는 뜻입니다. 남는 파일을 지우고 다시 시도하세요.

### Conversation 스케줄이나 Noodle의 시간대가 잘못되었거나 `Etc/Unknown`이 표시될 때

Conversation 스케줄은 Conversation Chat Settings나 캐릭터의 스케줄 편집기에서 **Schedule timezone**(스케줄 시간대)을 고르세요. **Use device**(기기 설정 사용)로 초기화할 수 있습니다.

Noodle이나 다른 서버 작업은 `.env`에서 비어 있는 `TZ=` 줄을 지우고 Marinara를 다시 시작해 호스트의 시간대를 쓰게 하세요. 시간대를 직접 정하려면 `TZ=Europe/Warsaw` 같은 IANA 이름을 쓰세요.

## Android 문제

### Android 앱이 Connecting이나 Waiting for Server에서 멈출 때

Android 앱은 Termux를 감싼 작은 껍데기입니다. Termux는 실제 Marinara 서버를 실행하는 Android용 Linux 터미널 앱입니다.

1. **Install / Start Marinara**를 탭하세요.
2. Android가 Termux 설치를 물으면 안내를 승인하세요.
3. Android가 Termux에서 명령을 실행해도 되는지 물으면 허용하세요.
4. 런처가 서버를 시작할 때까지 기다린 다음 앱으로 돌아오세요.

앱이 비공개 localhost 인증 정보를 만들고 자동으로 로그인합니다. 비밀 값을 붙여넣을 일은 없습니다. `CSRF_TRUSTED_ORIGINS`에 `null`, `http://null`, APK의 비밀 값을 추가하지 마세요.

앱과 Termux가 같은 포트를 쓰는지도 확인하세요. 기본값은 `7860`입니다. 다른 포트로 앱을 빌드했다면 Termux의 `.env`에도 같은 `PORT`를 설정하세요.

<a id="android-localhost-opens-the-login-page-or-returns-401503"></a>

### Android localhost에서 로그인 페이지가 열리거나 401/503이 반환될 때

APK가 관리하는 Termux 설치는 설치마다 다른 비공개 비밀 값으로 localhost를 보호하며, 앱은 자동으로 로그인합니다. 앱 안에 로그인 페이지가 나타나면 [최신 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)를 설치하고 **Install / Start Marinara**를 다시 탭한 다음 Termux 작업이 끝나면 돌아오세요.

출처 `null`을 언급하는 오류는 오래된 APK와 서버 조합이라는 뜻입니다. `.env`를 수정해도 해결되지 않습니다. APK와 Marinara를 업데이트하세요.

같은 휴대폰의 브라우저로 열려면 Android 런처에서 **Open in browser**(브라우저에서 열기)를 탭한 다음 **Retry connection**(연결 다시 시도)을 탭하세요. 서버를 다시 시작했거나 세션이 만료된 뒤에도 이 방법으로 다시 여세요. 런처로 돌아가려면 **Settings → General → App Behavior → Open Android launcher (app or browser)**(설정 → 일반 → 앱 동작 → Android 런처 열기 (앱 또는 브라우저))를 쓰세요.

이전 APK는 `cat ~/.marinara-engine/android-secret`의 값으로 `/android-login`에서 로그인합니다. 브라우저 링크는 한 번만 쓸 수 있고 1분 뒤 만료되므로, 런처에서 새 링크를 여세요.

- **401:** 붙여넣은 비밀 값이나 챌린지가 거부되었습니다. `/android-login`을 다시 불러오고 현재 값을 붙여넣으세요.
- **503:** 서버가 잘못된 형식의 비밀 값을 받았습니다. `./start-termux.sh`로 다시 시작하세요. 런처가 비밀 파일이 잘못되었거나 비어 있다고 알리면 앱에서 **Install / Start Marinara**를 탭해 비밀 값을 다시 만들게 하세요.

로컬 `mari` 명령도 같은 파일을 자동으로 읽습니다. 비밀 값을 스크린샷이나 이슈 보고에 넣지 마세요.

### Android 업데이트가 종료 코드 134로 멈출 때

빌드 단계에서 Android의 메모리가 부족해진 것입니다. 런처를 다시 실행하세요.

```bash
./start-termux.sh
```

다시 멈추면 다른 앱을 닫고 Termux를 다시 연 다음 재시도하세요.

### Marinara 실행 중 Termux가 종료되거나 다시 시작될 때

서버가 실행되는 동안 런처는 wake lock을 요청하고 각 세션을 `~/.marinara-engine/logs/`에 저장합니다. 예기치 않게 다시 시작된 뒤에는 가장 최신 `server-*.log`를 보고서에 첨부하세요. 로그가 Marinara나 Node 오류 없이 끝난다면 Android나 휴대폰 제조사가 Termux를 종료했을 가능성이 큽니다.

Android 설정에서 Termux의 백그라운드 실행을 허용하고 배터리 최적화 대상에서 제외하세요. `termux-wake-lock`과 `termux-wake-unlock`은 표준 Termux에 들어 있습니다. 이 설정으로 모든 제조사별 프로세스 종료를 막을 수는 없습니다.

### Termux를 포그라운드로 불러올 때까지 Marinara가 응답하지 않을 때

채팅이 "채팅 여는 중..."에서 멈추고, 앱이 **Server unreachable**(서버에 연결할 수 없음)을 표시하고, Support Diagnostics(지원 진단 정보) 복사 내용의 서버 항목이 **Unreachable (request timed out)**(연결할 수 없음, 요청 시간 초과)으로 나오며, Termux를 여는 순간 모든 것이 정상으로 돌아옵니다. Android의 캐시된 앱 동결 기능이 Termux 프로세스를 정지시킨 것입니다. 휴대폰은 연결을 받아들이지만 동결된 서버는 응답하지 않습니다. wake lock으로는 이를 막을 수 없습니다. 세션 로그에는 오류 대신 동결된 시간만큼 타임스탬프가 비어 있습니다.

Termux를 배터리 최적화 대상에서 제외하고, 백그라운드 활동을 허용하고, 휴대폰이 지원한다면 최근 앱 화면에서 Termux를 고정하고, 알림이 계속 보이게 두세요. 그래도 동결이 이어진다면 Marinara를 쓰는 동안 Termux를 포그라운드에 두거나 화면을 켜 두세요.

### 의존성을 설치하다가 Android 저장 공간이 부족해질 때

업데이트 중 임시로 용량을 많이 차지하는 원인은 대개 여러 릴리스를 거쳤거나 재설치가 중간에 끊긴 뒤의 pnpm 의존성 저장소입니다. 현재 런처는 오래된 패키지를 정리하고, 앱 내 업데이트는 Android용 패키지만 설치합니다. 예전 런처가 이미 기기를 가득 채웠다면 공간을 확보한 다음 다시 시도하세요.

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

`data`, `storage`, `marinara-engine.db`에는 채팅과 설정이 들어 있을 수 있으므로 지우지 마세요. 그래도 멈춘다면 `Installing dependencies`부터 이어지는 줄을 모으고, 휴대폰의 남은 저장 공간과 메모리를 보고서에 함께 적으세요.

### Android에서 Stable과 Staging을 오갈 때 앱 내 업데이트가 실패할 때

채널을 바꾸면 의존성을 거의 전부 다시 설치해야 하는데, Termux 저장소에서는 이 작업이 느립니다. 앱 내 업데이터는 각 단계에 시간을 더 줍니다. 그래도 업데이트가 실패하면 오류에 실패한 단계와 그 출력의 마지막 부분이 나옵니다. 실제 의존성 문제나 잠금 파일 오류는 거기에 나타납니다. 오류 힌트에 나온 명령으로 Termux에서 직접 업데이트하거나, 먼저 공간을 확보할 수도 있습니다.

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Docker 문제

### 볼륨 마운트에서 컨테이너 권한이 거부될 때

- 업데이트 후 이름 있는 볼륨: `docker compose pull && docker compose up -d`를 실행하세요. 공식 이미지는 시작할 때 소유권을 바로잡습니다.
- 바인드 마운트: 호스트 폴더를 사용자 및 그룹 ID `1000`이 쓸 수 있게 하거나, 이름 있는 볼륨을 쓰세요.
- Fedora나 RHEL 같은 SELinux 시스템: 볼륨 마운트에 `:Z` 접미사를 붙이세요.

### Raspberry Pi 4에서 Lite 컨테이너가 크래시할 때

Raspberry Pi 4나 비슷한 ARM 기기에서 AI 요청을 보낼 때마다 lite 이미지가 다시 시작된다면 종료 코드를 확인하세요. 종료 코드 132나 SIGILL(CPU가 실행할 수 없는 명령을 만났다는 뜻)은 일부 ARM 칩에서 lite 이미지의 Node 빌드에 생기는 알려진 업스트림 문제를 가리킵니다. 그 기기에서는 일반 이미지를 쓰세요.

<a id="a-server-extension-says-no-supported-sandbox-is-available"></a>

### Server Extension이 지원되는 샌드박스가 없다고 할 때

Server Extension과 Professor Mari의 원시 셸 명령은 macOS Seatbelt나 Linux Bubblewrap이 있을 때만 실행됩니다. 네이티브 Linux 호스트에서는 `bwrap`을 설치하고 Marinara를 다시 시작하세요. 공식 Docker 이미지에는 Bubblewrap이 들어 있지만, 기본 컨테이너는 중첩 네임스페이스를 만들 수 없으므로 Marinara는 이 기능을 꺼 둡니다.

더 넓은 컨테이너 권한을 받아들인다면 다음 내용을 `docker-compose.yml` 옆에 `docker-compose.override.yml`로 저장한 다음 컨테이너를 다시 만드세요.

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

> **경고:** `SYS_ADMIN`을 추가하고 AppArmor 프로필 없이 root로 서버를 실행하는 것은 광범위한 권한 상승입니다. 이 메시지를 숨기려는 목적만으로 켜지 마세요.

Docker의 기본 seccomp 프로필은 추가한 기능에 맞춰 조정되므로, 현재 Docker에서는 `seccomp=unconfined`가 필요하지 않을 것입니다.

Windows, Android를 비롯해 지원되지 않는 호스트에서는 Server Extension 실행을 거부합니다. Browser Extension은 그대로 샌드박스에서 실행됩니다.

## 확장 기능 문제

### Addons에 External Extensions가 보이지 않을 때

이 섹션은 두 관문이 모두 열릴 때까지 숨겨져 있습니다.

1. 호스트의 `.env`에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정하세요.
2. 잠시 기다린 다음 **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)을 열고 데이터 삭제 항목 아래로 스크롤해 **Allow third-party extension imports**(서드파티 확장 가져오기 허용)를 켜세요.

스위치가 비활성화되어 있다면 호스트 플래그가 아직 false이거나 앱이 변경을 아직 감지하지 못한 것입니다. [서버 설정 참고 문서](CONFIGURATION.md)에서 설명하는, 실제로 사용 중인 `.env`를 편집했는지 확인하세요. Docker에서는 보통 `/app/data/.env`입니다.

관문 중 하나라도 닫혀 있으면 외부 확장 기록은 표시되지도 실행되지도 않습니다. 관문을 다시 열어도 다시 켜지지는 않습니다.

### 가져온 브라우저 확장이 나타나지만 동작하지 않을 때

**Settings → Addons → External Extensions**(설정 → 애드온 → 외부 확장)에서 확장을 열고 **Requested access**(요청된 접근 권한)를 확인하세요. 기능 선언이 없는 예전 `marinara.extension` v1 패키지는 **Full page access**(전체 페이지 접근)로 표시됩니다. 직접 확인하고 신뢰하는 정확한 해시만 승인하세요.

기능 목록이 비어 있는 상태로 다시 내보낸 패키지는 안전한 샌드박스 확장으로 취급되며, 페이지의 DOM이 필요한 코드는 동작하지 않습니다. 그 코드가 페이지 전체, 브라우저 저장소, 네트워크 API, 세션에 접근하게 된다는 점을 받아들일 때만 매니페스트에 `full_page_access`를 추가하세요.

전체 페이지 확장을 비활성화한 뒤 툴바 항목, 오버레이, 리스너가 남아 있다면 Marinara를 새로 고치세요. 페이지 코드는 Marinara가 추적하지 않는 부작용을 만들 수 있으므로 정리는 최선을 다하는 수준입니다.

<a id="multiplayer-connection-or-turn-problems"></a>

## 멀티플레이어 연결 또는 턴 문제

| 증상 | 해결 방법 |
| --- | --- |
| 컨트롤 사용 불가 | 올바른 Marinara의 `.env`에 `MULTIPLAYER_ENABLED=true`를 넣고 다시 시작한 다음 설정을 따로 켜세요. Android 네이티브 래퍼는 참여할 수 없습니다. |
| 호스트 연결 불가 | 별도로 접근 가능한 HTTPS 방 포트, 유효한 인증서 체인과 호스트 이름, 일치하는 초대 지문을 사용하세요. TLS 검사를 끄거나, 신뢰하는 출처에 `null`을 추가하거나, 일반 API를 공개하거나, 호스트가 제공한 클라이언트를 열지 마세요. |
| 승인 대기 | 호스트가 Players에서 승인해야 합니다. 승인 전에는 기록을 볼 수 없습니다. 초대가 만료되었다면 새 초대를 요청하세요. |
| 연결 끊김 | 내 Marinara를 계속 실행하세요. 세션이 살아 있는 동안 같은 호스트에 다시 연결되며, 보내지 않은 초안은 남아 있습니다. 다시 시작한 뒤에는 새로 참여하세요. 같은 페르소나 이름을 계속 쓰려면 먼저 호스트에게 이전 자리를 제거해 달라고 요청하세요. |
| Game 대기 | Players를 여세요. 연결이 끊긴 플레이어는 자동으로 넘어가지 않습니다. 호스트는 **Pass**, **Kick**, **Pause**를 선택할 수 있습니다. |
| 생성 중단 | 라운드를 다시 제출하지 마세요. 호스트는 저장된 서술과 상태를 확인한 다음 방을 재개하거나 중지해야 합니다. 멀티플레이어는 결과가 불분명한 요청을 다시 보내거나 세계 효과를 두 번 적용하지 않습니다. |
| 제한된 명령 또는 미디어 누락 | 방은 텍스트만 전달합니다. [호환성 표](development/multiplayer.md#command-and-feature-compatibility)를 참고하세요. 다른 참여자가 제공한 파일이나 확장 기능을 설치하지 마세요. |

연결 오류를 보고할 때 모드, 플랫폼, 표시된 오류, 승인 성공 여부를 포함하세요. 초대, 방 비밀번호, 세션 토큰, 비공개 기록, API 키는 게시하지 마세요.

## 로그인 뒤에서 Android Chrome의 PWA 설치가 실패할 때

HTTPS 주소를 쓰고 로그인한 다음, Marinara를 업데이트한 뒤 페이지를 새로 고치세요. 앱은 인증 정보를 포함해 매니페스트를 요청하므로 로그인을 켜 둔 채로 쓸 수 있습니다. 그래도 설치할 수 없다면 프록시가 `/manifest.json`을 로그인 페이지나 오류가 아닌 JSON으로 제공하는지 확인하세요.

<a id="get-more-help"></a>

## 도움 더 받기

1. **Settings → Advanced → Message Tools**(설정 → 고급 → 메시지 도구)를 열고 **Debug mode**를 켜세요. 프롬프트와 응답이 서버 콘솔에 기록됩니다.
2. 운영 체제, Node.js 버전, 콘솔의 오류 전문을 적어 두세요.
3. 무엇이든 공유하기 전에 API 키, 접근 토큰, 관리자 시크릿, 비공개 채팅 내용을 지우세요.

그런 다음 커뮤니티에 문의하세요.

- [열려 있는 이슈](https://github.com/Pasta-Devs/Marinara-Engine/issues)를 읽어 보세요.
- [Discord](https://discord.com/invite/KdAkTg94ME)에 참여하세요.
- 같은 GitHub 이슈에 위에서 모은 정보를 담아 버그 리포트를 등록하세요.

## 관련 가이드

- [자주 묻는 질문](FAQ.md)
- [서버 설정 참고 문서](CONFIGURATION.md)
- [원격 접근](REMOTE_ACCESS.md)
- [Marinara Engine 업데이트](UPGRADING.md)
- [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)
- [내장 모델 설정](connections/local-model.md)
- [Game Mode: 시작하기](game/getting-started.md)
- [설정 개요](settings/settings-overview.md)

<details>
<summary>메인테이너용: 고정된 로컬 런타임 업데이트</summary>

GitHub가 생성하는 소스 아카이브는 커밋 내용이 그대로여도 바이트 단위까지 똑같이 유지된다는 보장이 없습니다. 사용자 컴퓨터에서 나온 바이트를 그대로 받아들이거나 검증을 느슨하게 만들어 불일치를 "해결"하지 마세요. 런타임 입력을 다시 고정하는 작업은 검토를 거친 Engine 변경으로만 진행합니다.

1. 변하지 않는 업스트림 리비전이나 릴리스 자산을 고르고 업스트림 변경 사항을 검토하세요.
2. 아티팩트를 임시 디렉터리에 다운로드하고 정확한 바이트 수를 기록한 뒤 SHA-256 다이제스트를 직접 계산하세요.
3. `runtime-integrity-manifest.ts`의 리비전, URL, 크기, 다이제스트를 업데이트하세요. MLX는 Apple Silicon과 Python 3.12 환경에서 고정된 uv 버전으로 `.in` 파일에서 `packages/server/src/assets/mlx-runtime-requirements.lock`을 다시 생성하고, 의존성 변경을 하나하나 검토한 다음 `requirementsLockSha256`을 업데이트하세요.
4. `pnpm regression:runtime-integrity`와 `pnpm check`를 실행하고, 해당 플랫폼에서 실제로 런타임을 처음부터 설치해 보세요.
5. 검토를 마친 Engine 업데이트를 배포한 뒤에 사용자에게 재시도를 안내하세요. 체크섬을 수동으로 무시하는 수단은 제공하지 마세요.

</details>
