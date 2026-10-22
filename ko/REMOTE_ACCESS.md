# 원격 접근: 로그인과 IP 허용 목록

이 가이드에서는 휴대폰, 노트북, Docker 컨테이너처럼 다른 기기에서 Marinara Engine에 접근하는 방법을 설명합니다. 주된 선택지는 로그인입니다. IP 허용 목록, 로그인 프록시, HTTPS, Admin Access(관리자 접근), "save blocked" CSRF 메시지도 함께 다룹니다. 여기 나오는 설정은 거의 전부 앱이 아니라 서버의 `.env` 파일에 있습니다.

이 가이드에서 반복해서 쓰는 용어를 먼저 정리합니다.

- `.env` 파일: Marinara Engine 폴더 안, `package.json` 옆에 있는 일반 텍스트 설정 파일입니다.
- 루프백: 서버를 실제로 실행하고 있는 컴퓨터입니다. 주소는 `127.0.0.1` 또는 `localhost`입니다.
- 원격 접근: 서버를 실행하는 컴퓨터가 아닌 다른 기기에서 Marinara를 여는 것입니다.

## Marinara가 기본적으로 차단하는 것

Marinara는 데이터를 보호하기 위해, 로그인을 설정하기 전까지 새로 설치한 상태에서 다른 기기의 접속을 거부합니다. 기본적으로 신뢰하는 클라이언트는 3가지뿐입니다.

1. 루프백(`127.0.0.1` 또는 `::1`), 즉 서버를 실행하는 컴퓨터 자신입니다. 같은 컴퓨터의 리버스 프록시나 터널이 전달한 방문자는 여기에 포함되지 않습니다. [같은 컴퓨터의 리버스 프록시와 터널](#reverse-proxies-and-tunnels-on-the-same-computer)을 참고하세요.
2. tailnet 안의 Tailscale 기기입니다. Tailscale은 사설 네트워크 도구이고, 주소는 `100.64.0.0/10` 범위를 씁니다.
3. 같은 호스트의 Docker 클라이언트입니다. Marinara는 흔히 쓰는 `172.16.0.0/12` 브리지 범위와 컨테이너의 기본 게이트웨이 주소를 정확히 알아보며, 여기에는 Docker Desktop과 사용자 지정 주소 풀도 포함됩니다.

그 밖의 기기는 로그인을 설정하기 전까지 모두 차단됩니다. 같은 Wi-Fi에 연결된 휴대폰이나 공용 인터넷의 클라이언트도 마찬가지입니다. 차단된 기기에서 브라우저로 Marinara를 열면 어두운 색의 안내 페이지가 나타납니다. 제목은 **This Marinara Engine install needs a login before remote devices can connect.**입니다. 이 페이지에는 서버 로그에 나오는 1회용 설정 코드를 입력하는 양식이 있어, 그 기기에서 바로 로그인을 설정할 수 있습니다.

아무것도 하지 않고 비밀번호도 설정하지 않으면 Marinara는 위 3가지 신뢰 대상에만 열려 있는 상태로 남습니다. 이것이 안전한 기본값입니다.

## .env 파일의 위치

접근 관련 설정은 모두 프로젝트 루트의 `.env` 파일, 즉 `package.json` 옆에 있는 파일에 들어 있습니다. 아직 없다면 예시 파일을 복사하세요.

```bash
cp .env.example .env
```

`.env`는 아무 텍스트 편집기로나 열면 됩니다. Basic Auth, IP 허용 목록, 관리자 시크릿, CSRF 출처를 비롯한 대부분의 접근 설정은 재시작 없이 몇 초 안에 적용됩니다. 다만 `PORT`, `HOST`, HTTPS 인증서 경로처럼 저수준 설정 몇 가지는 여전히 재시작이 필요합니다.

다른 기기에서 403이 아니라 시간 초과가 나면서 서버에 아예 닿지 못할 때가 있습니다. 서버가 로컬 컴퓨터에서만 요청을 받고 있는 상태일 수 있습니다. 모든 네트워크 인터페이스에서 요청을 받도록 설정하세요.

```env
HOST=0.0.0.0
```

셸 런처(`start.bat`, `start.sh`)는 `HOST=0.0.0.0`을 알아서 설정합니다. `pnpm start`를 직접 실행할 때는 설정되지 않습니다.

Marinara를 시작하는 방법별 기본 바인드 주소는 다음과 같습니다.

| 시작 방법 | `HOST` 기본값 |
| --- | --- |
| `pnpm start`, `start-local.bat` | `127.0.0.1` |
| `start.sh`, `start.bat`, Windows 설치 프로그램, `start-termux.sh` | `0.0.0.0` |
| Docker 이미지 | 컨테이너 안에서 `0.0.0.0` |
| `docker-compose.yml` | 포트를 `127.0.0.1`에만 공개합니다 |

## 어떤 선택지를 골라야 할까요

위에서부터 차례로 읽고, 처음으로 해당하는 항목에서 멈추세요.

1. Tailscale로만 접속하거나, 같은 호스트의 Docker 컨테이너에서만 접속합니다. 따로 할 일이 없습니다. 이미 동작합니다.
2. 집 Wi-Fi에 연결된 휴대폰, 태블릿, 노트북에서 Marinara에 접근하려고 합니다. 로그인을 설정하세요(아래 선택지 1).
3. Marinara를 공용 인터넷에 공개합니다. 로그인을 설정하고 HTTPS를 쓰세요.
4. tinyauth, Authelia, Authentik 같은 로그인 프록시가 네트워크에 있고, 이미 모든 방문자에게 로그인을 요구합니다. [로그인 프록시(forward auth)](#login-proxies-forward-auth)를 읽어 보세요.

로그인이 가장 유연합니다. 어떤 IP에서도 쓸 수 있고, 기기마다 따로 설정할 필요가 없으며, 각 브라우저가 로그인된 상태로 유지됩니다.

<a id="option-1-login-recommended"></a>

## 선택지 1: 로그인(권장)

로그인은 원격 기기마다 필요한 사용자 이름과 비밀번호입니다. 설정 방법은 3가지입니다.

- **설정에서.** 이미 로그인된 브라우저나 Marinara를 실행하는 컴퓨터(`http://localhost:7860`을 여세요)에서 **Settings**(설정) → **Advanced**(고급) → **Access**로 이동하세요. **Remote login**에서 사용자 이름과 비밀번호를 설정하세요. 로그인이 없는 동안 Marinara가 거부한 기기(예: Docker 호스트의 브라우저)는 같은 곳에서 서버 로그의 설정 코드를 입력할 수 있습니다.
- **설정 코드로, 어느 기기에서든.** 로그인이 없고 서버가 루프백 밖에서 요청을 받는 동안 Marinara는 로그에 1회용 설정 코드를 출력합니다. 로그 줄은 `[login] One-time setup code:`로 시작합니다. Marinara를 실행하는 터미널에서 찾으세요. Docker에서는 `docker logs <container> 2>&1 | grep "setup code"`를 실행하세요. 로그인이 없는 동안에는 거부 경고가 이 코드를 반복해서 출력합니다. 그다음 아무 기기에서 Marinara를 여세요. 그 기기를 막는 페이지에 설정 코드, 사용자 이름, 비밀번호를 입력하는 양식이 있습니다. 코드는 `XXXX-XXXX-XXXX-XXXX` 형태입니다. 대문자, 공백, 대시는 구분하지 않습니다. 코드는 한 번만 쓸 수 있으며, 재시작이나 초기화를 하면 새 코드가 출력됩니다. Docker에서는 이 페이지가 데이터 폴더(`/app/data/.env`)의 `.env`나 compose 파일의 `environment:` 목록에서 로그인을 설정하는 방법도 보여 줍니다(그다음 `docker compose up -d`를 실행하세요). 호스트에 브라우저가 없는 Docker, NAS 설치에는 이 방법을 쓰세요. Marinara는 로그인이 없다는 배너를 로컬 방문자와 로그인된 세션에 화면 아래 카드로 표시합니다.
- **`.env`에서.** 두 줄을 추가하세요.

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

`.env`의 로그인은 앱에서 설정한 로그인보다 우선하며, 바꾸는 것도 `.env`에서만 가능합니다. `.env`를 저장하세요. 재시작 없이 몇 초 안에 적용됩니다.

다른 곳에서 쓰지 않는 강한 비밀번호를 고르세요. 앱은 10자 이상을 요구합니다. 무작위로 만들 수도 있습니다.

```bash
openssl rand -base64 24
```

그다음 원격 기기에서 아래 단계를 따르세요.

1. 브라우저에서 서버 주소로 Marinara를 여세요. 예를 들면 `http://192.168.1.50:7860`입니다.
2. 로그인 페이지에서 사용자 이름과 비밀번호로 로그인하세요.
3. 앱이 열립니다. 브라우저는 로그아웃할 때까지 최대 1년간 로그인된 상태로 유지됩니다. 스크립트와 API 클라이언트는 요청마다 사용자 이름과 비밀번호를 함께 보냅니다(Basic Auth).

비밀번호를 입력하지 않고 다른 기기에 로그인하려면 페어링 코드를 쓰세요. 이미 로그인된 기기에서 **Settings** → **Advanced** → **Access**를 열고 **Add a device**를 선택하세요. 그다음 새 기기의 로그인 페이지에 그 코드를 입력하세요. 코드는 몇 분 동안, 한 번만 쓸 수 있습니다. 만료된 코드는 별도 메시지가 표시되며, 새로 만들면 됩니다. **Signed-in devices**에서는 각 기기와 로그인 방식, 처음 로그인한 날짜를 볼 수 있습니다. 지금 쓰는 기기를 포함해 어느 기기든 로그아웃시킬 수 있습니다. 비밀번호를 바꾸거나 지울 수도 있습니다. 이때 Marinara를 실행하는 컴퓨터에서 작업하거나 `ADMIN_SECRET`을 설정한 경우가 아니라면 Marinara가 현재 비밀번호를 묻습니다.

비밀번호를 잊었다면 Marinara를 실행하는 컴퓨터에서 `pnpm reset-login`을 실행하세요. Docker에서는 `docker exec <container> node scripts/reset-login.mjs`를 실행하세요. 앱에서 설정한 로그인을 제거하고 모든 브라우저를 로그아웃합니다. 서버가 루프백 밖에서 요청을 받는다면 새 설정 코드도 출력합니다. 그 명령이 동작하지 않을 때만 데이터 폴더에서 `.remote-login.json`과 `.remote-sessions.json`을 삭제하세요. 기본 `/app/data`에서는 `docker exec <container> rm -f /app/data/.remote-login.json /app/data/.remote-sessions.json`을 실행하세요. `DATA_DIR`을 바꿨다면 그 폴더를 쓰세요. `.env`의 로그인은 `.env`에서 바꾸세요.

**브라우저가 없는 헤드리스 서버인가요?** 헤드리스 서버의 네이티브 설치는 루프백에서만 요청을 받으며 설정 코드를 출력하지 않습니다. 내 컴퓨터에서 `ssh -L 7860:127.0.0.1:7860 user@server`를 실행하세요. 그다음 `http://localhost:7860`을 열고 **Settings**를 쓰세요.

15분 안에 서로 다른 잘못된 비밀번호나 코드를 10번 입력하면, Marinara는 15분이 지날 때까지 그 주소의 로그인을 **429 Too Many Requests**로 거부합니다. 그 전에 올바른 비밀번호를 입력하면 횟수가 초기화됩니다. 호스트의 리버스 프록시나 터널이 전달한 방문자는 횟수를 하나로 함께 세며, 그중 한 명이 로그인해도 횟수는 초기화되지 않습니다. 서버를 재시작해도 초기화됩니다. 전에 로그인한 적이 있는 브라우저는 올바른 비밀번호로 계속 들어올 수 있으므로, 다른 사람이 잘못된 비밀번호를 입력해도 이미 쓰고 있는 기기에서 잠기는 일은 없습니다. 로그인 페이지에 기다려야 하는 시간이 분 단위로 표시됩니다. 비밀번호를 잊었다면 로그인 페이지에 **Forgot the password?** 안내가 있습니다.

브라우저 입력창에는 기본적으로 **Marinara Engine**이 표시됩니다. 이 문구는 `BASIC_AUTH_REALM`으로 바꿀 수 있습니다.

Basic Auth를 켜 두어도 비밀번호를 건너뛰는 클라이언트가 있습니다.

- 루프백(`127.0.0.1`, `::1`)입니다. 그래서 서버를 돌리는 컴퓨터 자체에서는 비밀번호가 전혀 필요 없습니다. 그 컴퓨터의 리버스 프록시나 터널이 전달한 방문자에게는 여전히 비밀번호가 필요합니다.
- `IP_ALLOWLIST`에 들어 있는 주소입니다. 주의하세요. 허용 목록을 설정하면 목록에 없는 주소는 전부 차단됩니다(선택지 2 참고).
- 직접 들어오는 Tailscale 트래픽(`100.64.0.0/10`)입니다. 우회를 끄지 않는 한 그렇습니다.
- Docker 브리지/게이트웨이 트래픽입니다. 로그인, IP 허용 목록 또는 `TRUSTED_AUTH_PROXY`가 설정되어 있지 않은 동안에만 그렇습니다([Tailscale과 Docker 우회](#tailscale-and-docker-bypass) 참고).
- `/api/health` 주소입니다. 가동 상태 모니터가 계속 동작하도록 하기 위해서입니다. 앱을 열 수 없는 방문자에게는 `{"status": "ok"}`만 알려 주며, 버전, 시스템, 모델 정보는 이 컴퓨터와 신뢰하는 네트워크, 로그인한 브라우저에만 공개됩니다.

중요: Basic Auth는 비밀번호를 인코딩할 뿐 암호화하지는 않습니다. 암호화되지 않은 통신을 들여다보는 사람은 비밀번호를 그대로 읽을 수 있습니다. Marinara를 공용 인터넷에 공개한다면 Basic Auth와 HTTPS를 함께 쓰세요(아래 참고).

## 선택지 2: IP 허용 목록

IP 허용 목록은 지정한 주소를 비밀번호 없이 통과시킵니다. 기기의 IP 주소가 잘 바뀌지 않을 때 잘 맞습니다. 주소나 범위를 쉼표로 구분해 적으세요.

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

예시의 `/24`는 CIDR 표기법입니다. CIDR은 주소 범위 전체를 한 항목으로 짧게 적는 방식입니다. 예를 들어 `192.168.1.0/24`는 `192.168.1.0`에서 `192.168.1.255`까지 모든 주소를 포함합니다. `203.0.113.42`처럼 슬래시 없이 주소만 적으면 그 기기 하나에만 해당합니다.

IP 허용 목록의 동작 방식입니다.

- 목록에 없는 주소는 **403 Forbidden**으로 거부됩니다.
- 루프백은 항상 허용되므로, 로컬 접근까지 막혀 스스로 갇히는 일은 없습니다. 같은 컴퓨터의 리버스 프록시나 터널이 전달한 방문자는 루프백이 아니므로 허용 목록이 차단합니다. 프록시 뒤에서는 Basic Auth를 쓰세요.
- Docker Desktop, OrbStack, rootless Docker에서는 모든 기기가 같은 게이트웨이 주소에서 컨테이너에 접근하므로 허용 목록으로 기기를 구분할 수 없습니다. 이런 환경에서는 Basic Auth를 쓰세요.
- 직접 들어오는 Tailscale 트래픽도 목록을 건너뜁니다. 우회를 끄지 않는 한 그렇습니다. Docker 브리지/게이트웨이 트래픽은 로그인, 허용 목록 또는 유효한 `TRUSTED_AUTH_PROXY`가 설정되어 있지 않은 동안에만 목록을 건너뜁니다([Tailscale과 Docker 우회](#tailscale-and-docker-bypass) 참고).
- 잘못된 항목은 무시하고 로그에 남깁니다. 서버가 멈추지는 않습니다.
- Basic Auth를 켜도 허용 목록은 그대로 엄격하게 동작합니다. 목록에 있는 주소는 비밀번호 입력을 건너뜁니다. 나머지 주소는 여전히 **403 Forbidden**으로 차단되며 로그인 입력창조차 뜨지 않습니다.

목록에 있는 기기는 비밀번호를 건너뛰고 나머지는 로그인해서 들어오는 혼합 구성은 만들 수 없습니다. 다른 기기도 비밀번호로 로그인하게 하려면 `IP_ALLOWLIST`를 비워 두고 Basic Auth만 쓰세요.

목록을 지우지 않고 잠시 적용만 꺼 둘 수도 있습니다. 새로운 IP에서 문제를 확인할 때 편리합니다. 활성화 플래그를 false로 설정하세요.

```env
IP_ALLOWLIST_ENABLED=false
```

## 사설 네트워크 우회(참고)

신뢰하는 사설 네트워크에서 차단을 푸는 플래그가 몇 가지 있습니다. 특수한 구성을 위한 것입니다. 로그인이 더 나은 선택입니다. 플래그와 위험은 [접근 제어](CONFIGURATION.md#access-control)를 참고하세요.

<a id="tailscale-and-docker-bypass"></a>

## Tailscale과 Docker 우회

기본적으로 Marinara는 내 Tailscale 네트워크에서 직접 연결하는 기기를 신뢰합니다. Docker 컨테이너 자신의 호스트도 신뢰합니다. 로그인, IP 허용 목록 또는 `TRUSTED_AUTH_PROXY`를 설정하면 Docker 자동 신뢰가 중단되므로, 그때부터는 모든 기기가 로그인하거나 허용 목록에 있어야 합니다. 이를 바꾸는 플래그는 [접근 제어](CONFIGURATION.md#access-control)를 참고하세요.

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## 같은 컴퓨터의 리버스 프록시와 터널

nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve 또는 Funnel, ngrok처럼 Marinara를 실행하는 컴퓨터에 있는 리버스 프록시나 터널은 루프백에서 Marinara에 연결합니다. Marinara는 프록시가 추가하는 전달 헤더를 보고 이를 알아봅니다. 이런 헤더에는 `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, Tailscale 신원 헤더, `Via`가 있습니다. Marinara는 HTTP/1.0으로 들어오는 요청도 알아봅니다. 브라우저는 HTTP/1.0을 쓰지 않지만 기본 nginx `proxy_pass`는 쓰기 때문입니다. Marinara는 프록시가 헤더를 추가하지 않더라도, Host가 도메인이나 LAN 주소처럼 다른 컴퓨터를 가리키는 요청을 인식합니다. 그러면 Marinara는 각 요청을 실제 그대로 원격 방문자로 취급합니다.

- 로그인이 적용됩니다([선택지 1](#option-1-login-recommended) 참고). 로그인이 없으면 방문자에게 설정 페이지가 표시됩니다. 이 컴퓨터의 **Settings**나 `.env`에서 로그인을 설정하세요.
- 프록시가 실제 주소를 가리므로 `IP_ALLOWLIST`는 전달된 방문자를 차단합니다.
- 권한이 필요한 동작에는 관리자 시크릿이 필요하고, 루프백 전용 기능은 계속 쓸 수 없습니다.

그 컴퓨터에서 `http://127.0.0.1:7860`이나 `http://localhost:7860`으로 연 내 브라우저는 계속 비밀번호 없이 쓸 수 있습니다.

Caddy, Traefik, Cloudflare Tunnel, Tailscale, ngrok은 기본적으로 전달 헤더를 추가합니다. nginx에서는 `location` 블록에 다음 줄을 두는 것을 계속 권장합니다.

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

`socat`이나 `ssh -R`처럼 연결을 그대로 전달하는 도구는 헤더를 추가하지 않으므로 그 트래픽이 로컬처럼 보입니다. 이런 도구로 Marinara를 공개하지 마세요.

프록시가 전달하기 전에 이미 모든 방문자에게 로그인을 요구한다면 [로그인 프록시(forward auth)](#login-proxies-forward-auth)를 참고하세요.

<a id="login-proxies-forward-auth"></a>

## 로그인 프록시(forward auth)

[tinyauth](https://tinyauth.app), [Authelia](https://www.authelia.com), [Authentik](https://goauthentik.io), oauth2-proxy 같은 forward-auth 프록시는 요청을 전달하기 전에 모든 방문자에게 로그인을 요구합니다. 이런 프록시가 Marinara에 닿는 유일한 경로라면 Marinara의 두 번째 로그인은 건너뛸 수 있습니다. 그런 프록시가 없다면 설정하지 마세요.

`.env`에 프록시의 주소를 넣으세요.

```env
TRUSTED_AUTH_PROXY=192.168.1.5
```

그러면 Marinara는 그 주소에서 연결이 들어오는 모든 요청을 들여보냅니다. Marinara는 자체 로그인을 묻지 않으며 설정 코드도 출력하지 않습니다. Marinara는 연결 자체의 주소를 확인합니다. 이 판단에서 `X-Forwarded-For` 같은 전달 헤더는 무시합니다. 프록시가 들여보낼 사람을 정하므로 프록시의 요청은 `IP_ALLOWLIST`도 통과합니다. 이 요청은 로컬로 취급하지 않으므로, 권한이 필요한 동작에는 여전히 관리자 시크릿이 필요합니다. 설정이 켜져 있는 동안 **Settings** → **Advanced** → **Access**에 **Trusted login proxy: Set**이 표시됩니다.

설정하기 전에 확인하세요.

- **프록시는 모든 경로에서 로그인을 요구해야 합니다.** `/api/`, WebSocket 연결, 정적 파일도 포함됩니다. 프록시가 로그인 없이 통과시키는 경로는 누구에게나 열려 있습니다.
- **Marinara에 프록시를 우회해 닿을 수 없어야 합니다.** 프록시만 닿을 수 있는 주소에 Marinara를 바인드하거나 방화벽으로 Marinara의 포트를 막으세요. Docker에서는 프록시와 Marinara를 같은 Docker 네트워크에 두고, 프록시에 고정 주소를 주고, Marinara의 포트를 공개하지 마세요. 프록시가 Docker 호스트에서 실행된다면 포트를 루프백에만 공개하세요(`127.0.0.1:7860:7860`). Docker Desktop과 OrbStack은 공개된 포트에 접속하는 모든 LAN 클라이언트를 프록시와 같은 주소인 Docker 게이트웨이 주소로 보여 줍니다. 다른 기기가 Marinara에 직접 연결할 수 있으면 프록시의 로그인을 건너뜁니다.
- **프록시 자신의 주소만 적으세요.** 범위는 사설 주소 공간 안에 있어야 하며, Marinara는 다른 범위를 무시합니다. 범위 안의 모든 기기가 로그인을 건너뛰게 되므로 범위마다 경고를 로그에 남깁니다.
- **다른 프록시와 마찬가지로 공개 이름을 추가하세요.** 호스트 이름은 `TRUSTED_HOSTS`에, 출처는 `CSRF_TRUSTED_ORIGINS`에 넣으세요([저장이 차단되는 이유(CSRF)](#why-is-my-save-blocked-csrf) 참고).

`TRUSTED_AUTH_PROXY`를 설정하면 Marinara는 Docker 자동 신뢰도 중단합니다. 프록시가 아닌 방문자가 직접 들어오면 Marinara 로그인이나 IP 허용 목록이 필요합니다. 그러면 Marinara는 "아직 로그인이 없음" 배너도 표시합니다.

프록시가 Marinara와 같은 컴퓨터에서 실행된다면 `TRUSTED_AUTH_PROXY=127.0.0.1`을 쓰고 프록시가 `localhost:7860`이 아니라 `127.0.0.1:7860`을 가리키게 하세요. `localhost`로 연결하는 프록시는 `127.0.0.1`과 일치하지 않는 `::1`로 연결할 수 있습니다. 그러면 그 컴퓨터의 다른 모든 프록시나 터널도 신뢰하게 되므로, 로그인 프록시가 유일한 프록시일 때만 쓰세요. 이것이 프록시를 거친 방문자에게 로컬 컴퓨터의 접근 권한을 주지는 않습니다.

`192.168.1.20:7860`에서 실행 중인 Marinara를 위한 Caddy 예시입니다.

```caddy
marinara.example.com {
  forward_auth tinyauth:3000 {
    uri /api/auth/caddy
  }
  reverse_proxy 192.168.1.20:7860
}
```

Authelia는 `forward_auth authelia:9091`에 `uri /api/authz/forward-auth`를 쓰세요. Authentik은 프록시 뒤에서 자체 로그인 페이지도 제공합니다. Caddy가 순서를 지키고 outpost 경로가 forward auth 자체를 거치지 않도록, 해당 줄을 `route` 블록에 넣으세요.

```caddy
marinara.example.com {
  route {
    reverse_proxy /outpost.goauthentik.io/* authentik-server:9000
    forward_auth authentik-server:9000 {
      uri /outpost.goauthentik.io/auth/caddy
    }
    reverse_proxy 192.168.1.20:7860
  }
}
```

Traefik과 nginx는 해당 프록시의 forward-auth 가이드를 따르세요. Marinara에는 프록시의 주소 외에 필요한 것이 없습니다.

## HTTPS로 서비스하기

HTTPS는 TLS로 통신을 암호화합니다. TLS는 평범한 `http` 주소를 안전한 `https` 주소로 만들어 주는 암호화 기술입니다. 완전히 신뢰할 수 있는 사설 네트워크 바깥에서 접근할 수 있는 설치본에는 항상 HTTPS를 쓰세요. Basic Auth를 함께 쓸 때는 특히 그렇습니다.

적용 방법은 2가지입니다.

1. 내장 TLS입니다. 인증서 파일과 개인 키 파일의 위치를 서버에 알려 주세요.

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. 리버스 프록시입니다. nginx, Caddy, Traefik, Cloudflare Tunnel 뒤에 Marinara를 둡니다. 프록시가 HTTPS를 처리하고, 같은 컴퓨터 안에서 일반 HTTP로 Marinara에 전달합니다. 먼저 [같은 컴퓨터의 리버스 프록시와 터널](#reverse-proxies-and-tunnels-on-the-same-computer)을 읽어 보세요.

`SSL_CERT`와 `SSL_KEY`를 설정하려면 먼저 인증서와 키가 있어야 합니다. 로컬에서 쓸 때는 `mkcert`, 공개 도메인에는 `certbot` 같은 도구로 만들 수 있습니다. 파일이 없거나 읽을 수 없으면 서버가 시작하다가 멈추고, 어떤 경로를 찾아봤는지 정확히 알려 줍니다.

## Admin Access와 권한이 필요한 작업

특히 민감한 작업이 있습니다. 데이터 삭제, 백업 생성과 다운로드, 프로필 가져오기와 내보내기, 테마 설치, Local Model 런타임 설치가 그렇습니다. 이런 작업에는 위에서 고른 접근 방식과 별개로, 관리자 시크릿이라고 부르는 공유 비밀 문자열이 따로 필요합니다.

루프백 컴퓨터에서는 관리자 시크릿 없이도 대체로 동작합니다. 원격 기기에서는 시크릿을 설정해야 합니다. 아래 단계를 따르세요.

1. `.env`에 길고 무작위한 값을 넣고 저장하세요. 재시작 없이 몇 초 안에 적용됩니다.

```env
ADMIN_SECRET=some-long-random-string
```

2. 원격 기기에서 Marinara를 열고 **Settings**(설정)에서 **Advanced**(고급) 탭을 연 다음 **Admin Access**(관리자 접근) 항목으로 이동하세요.
3. 같은 값을 입력란(플레이스홀더에 **ADMIN_SECRET**이 표시됩니다)에 붙여넣고 **Save**(저장)를 클릭하세요.
4. **Admin secret saved for this browser** 메시지가 표시됩니다.

관리자 시크릿에 대해 알아 둘 점입니다.

- 값은 그 브라우저 하나에만 저장됩니다. 기기 사이에 동기화되지 않습니다. 권한이 필요한 작업을 하려는 브라우저마다 따로 붙여넣어야 합니다.
- 입력란을 비운 채 **Save**를 클릭하면 값이 지워지고 **Admin secret cleared**가 표시됩니다.
- 서버 운영자가 `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`로 설정하면 루프백 컴퓨터에서도 시크릿이 필요합니다.
- 이것은 Basic Auth와 별개입니다. 둘을 함께 쓸 수 있습니다. Basic Auth는 앱 전체를 막고, 관리자 시크릿은 위험한 작업을 막습니다.

원격 기기에서 권한이 필요한 작업이 실패하면 Marinara는 해결 방법 2가지를 담은 오류 메시지를 표시합니다. 하나는 localhost로 앱을 여는 것이고, 다른 하나는 서버의 `.env`에 `ADMIN_SECRET`을 설정한 뒤 같은 값을 **Settings** > **Advanced** > **Admin Access**에 붙여넣는 것입니다.

<a id="why-is-my-save-blocked-csrf"></a>

## 저장이 차단되는 이유(CSRF)

CSRF는 cross-site request forgery, 즉 사이트 간 요청 위조를 뜻합니다. 함께 열어 둔 다른 웹사이트가 허락 없이 몰래 Marinara의 내용을 바꾸지 못하게 막는 보호 장치입니다. 자동으로 동작하며, 켜는 설정은 따로 없습니다.

가끔은 직접 하는 저장까지 CSRF에 막힙니다. 서버가 아직 신뢰하지 않는 공개 도메인 이름이나 낯선 포트로 Marinara에 접근할 때 주로 생깁니다. 이때는 2가지 신호가 나타납니다.

- 앱 위쪽에 빨간 띠가 나타나 이 출처는 신뢰되지 않으므로 **Saves will silently fail**이라고 알려 줍니다. 이 띠에는 추가해야 할 `.env` 줄이 그대로 표시되고 **Copy**(복사) 버튼이 있습니다.
- 저장이 실제로 거부되면 작은 알림 창이 뜹니다. 제목은 **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected**, **Save blocked: origin not trusted** 중 하나입니다.

해결하려면 `.env`의 신뢰 목록에 사용 중인 주소를 추가하세요.

```env
CSRF_TRUSTED_ORIGINS=https://chat.example.com,http://203.0.113.10:7831
```

공개 도메인이나 리버스 프록시 도메인을 쓸 때는 호스트 이름도 함께 허용하세요.

```env
TRUSTED_HOSTS=chat.example.com
```

직접 접속하는 LAN, Tailscale, IPv4, IPv6 주소에는 `TRUSTED_HOSTS`가 필요 없습니다. 로컬의 `.local`/`.home.arpa` 이름과 점이 없는 단일 컴퓨터 이름은 자동으로 허용됩니다. `CSRF_TRUSTED_ORIGINS`에 이미 적어 둔 호스트 이름도 그대로 허용됩니다.

루프백, 일반적인 LAN 주소, Tailscale(`100.64.0.0/10`), Docker 브리지(`172.16.0.0/12`) 출처는 자동으로 신뢰합니다. 목록에 적어야 하는 것은 공인 IP 주소와 도메인 이름뿐입니다. 변경은 재시작 없이 몇 초 안에 적용됩니다.

## 로컬 제공자가 차단될 때

직접 쓰는 컴퓨터에서 돌아가는 로컬 AI 제공자에 Marinara를 연결한다고 해 보겠습니다. "private, loopback, metadata, or reserved IP range"를 언급하는 메시지와 함께 요청이 거부될 수 있습니다. 이것은 SSRF 보호라는 또 다른 안전 장치입니다. SSRF는 server-side request forgery, 즉 서버 측 요청 위조를 뜻합니다. 허용하기 전까지 서버가 사설 주소로 요청을 보내지 못하게 막습니다. 오류 메시지에는 `PROVIDER_LOCAL_URLS_ENABLED`처럼 설정해야 할 `.env` 변수 이름이 정확히 적혀 있습니다. 전체 목록은 [서버 설정 참고 문서](CONFIGURATION.md)를 참고하세요.

## 휴대폰이나 태블릿에서 접근하기

같은 네트워크의 휴대폰이나 태블릿에서 Marinara를 열려면 다음과 같이 하세요.

1. `.env`에 `HOST=0.0.0.0`을 넣어 서버가 모든 인터페이스에서 요청을 받는지 확인하세요.
2. 로그인을 설정하세요(위 선택지 1). 휴대폰에서는 서버 로그의 설정 코드를 써서, 막힌 페이지에서 바로 설정할 수 있습니다.
3. 서버 컴퓨터의 로컬 IP 주소를 확인하세요(예: `192.168.1.50`).
4. 휴대폰 브라우저에서 `http://192.168.1.50:7860`을 여세요. 기본 포트는 `7860`입니다.
5. 사용자 이름과 비밀번호로 로그인하세요.

페이지가 아예 열리지 않으면 서버에 닿지 못하는 상태일 수 있습니다. `HOST=0.0.0.0`과 `PORT` 값을 확인하세요. 대신 403이 나온다면 서버에는 닿았지만 아직 허용되지 않은 것입니다. 위에서 고른 방식을 다시 확인하세요.

<a id="locked-out-after-updating"></a>

## 업데이트 후 접속이 막혔을 때

새 버전은 리버스 프록시, 터널, Tailscale Serve, Tailscale Funnel을 거쳐 들어오는 접속에 로그인을 요구합니다. 이전 버전은 이런 접속을 비밀번호 없이 들여보냈습니다. 이제 로그인 페이지, 설정 페이지 또는 **403**이 보인다면 이 때문입니다.

**업그레이드 안내:** Tailscale Serve나 같은 컴퓨터의 다른 프록시를 쓰면서 비밀번호를 설정한 적이 없다면, 업데이트 후 다른 기기가 접속할 수 없게 됩니다. 같은 컴퓨터의 프록시는 보통 루프백에서만 요청을 받는 서버에 접속하므로 서버가 설정 코드를 출력하지 않습니다. 대신 Marinara를 실행하는 컴퓨터에서 로그인을 설정하세요.

다시 들어가려면:

1. Marinara를 실행하는 컴퓨터에서 `http://localhost:7860`(또는 직접 정한 `PORT`)으로 Marinara를 엽니다. 로컬 사용에는 비밀번호가 필요 없습니다. 헤드리스 서버에서는 먼저 내 컴퓨터에서 `ssh -L 7860:127.0.0.1:7860 user@server`를 실행한 다음 거기서 `http://localhost:7860`을 엽니다. Docker에서는 로그인과 `IP_ALLOWLIST`가 모두 설정되지 않은 동안에만 이 방법이 동작합니다. 그렇지 않으면 서버 로그의 설정 코드(`docker logs <container> 2>&1 | grep "setup code"`)를 막힌 페이지나 **Settings** → **Advanced** → **Access**에 입력하거나, 아직 로그인된 브라우저를 쓰세요.
2. **Settings** → **Advanced** → **Access**로 이동해 **Remote login**에서 사용자 이름과 비밀번호를 설정합니다. 또는 그 컴퓨터에서 `.env` 파일을 열고 `BASIC_AUTH_USER`와 `BASIC_AUTH_PASS`를 설정합니다. `IP_ALLOWLIST`가 설정되어 있다면 다른 기기의 주소를 추가하거나 설정을 지우세요. 목록에 없는 기기는 로그인해도 **403**을 받습니다.
3. 다른 기기에서 그 사용자 이름과 비밀번호로 로그인합니다.

## 검색 엔진

Marinara는 검색 엔진에 페이지를 색인하지 말아 달라고 요청합니다(`X-Robots-Tag: noindex, nofollow`). 이것으로 설치본이 보호되지는 않으며, 이미 색인된 페이지가 제거되지도 않습니다. 설치본을 비공개로 유지하려면 위의 접근 제어를 사용하세요.

## 관련 가이드

- `.env` 설정의 전체 목록과 예외 상황은 [서버 설정 참고 문서](CONFIGURATION.md)를 참고하세요.
- 접속 오류, 모바일 접근 등은 [Marinara Engine 문제 해결](TROUBLESHOOTING.md)을 참고하세요.
- 다른 기기에서 Marinara에 접근하는 과정을 간단히 훑어보려면 [자주 묻는 질문](FAQ.md)을 참고하세요.
