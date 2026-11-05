# Marinara Engine 업데이트

이 가이드에서는 Marinara Engine을 새 버전으로 업데이트하는 방법, 앱에서 업데이트를 확인하는 방법, 문제가 생겼을 때 이전 버전으로 되돌아가는 방법을 설명합니다. 업데이트해도 채팅과 설정은 그대로 유지됩니다.

## 내게 맞는 업데이트 방법은 무엇인가요?

| 설치 방식 | 업데이트 방법 |
| --- | --- |
| Windows 설치 프로그램 또는 `start.bat` | Marinara를 닫았다가 다시 여세요. [Windows](#windows)를 참고하세요. |
| macOS 또는 Linux | `./start.sh`를 다시 실행하세요. [macOS와 Linux](#macos-and-linux)를 참고하세요. |
| Docker 또는 Podman | 새 이미지를 받고 다시 시작하세요. [Docker 또는 Podman](#docker-or-podman)을 참고하세요. |
| Android 앱 | APK를 업데이트한 뒤 **Install / Start Marinara**(Marinara 설치/시작)를 누르세요. [Android (Termux)](#android-termux)를 참고하세요. |
| iPhone 또는 iPad | 서버 기기를 업데이트하세요. [iPhone과 iPad](#iphone-and-ipad)를 참고하세요. |

<a id="back-up-first"></a>

## 먼저 백업하기

버전 차이가 큰 업데이트 전에는 백업을 만들어 두세요. 이전 버전으로 되돌아갈 가능성이 있다면 반드시 만들어 두세요.

1. **Settings**(설정)를 여세요.
2. **Advanced**(고급) 탭으로 이동하세요.
3. **Backup & Export**(백업 및 내보내기) 섹션을 찾으세요.
4. **Download Backup**(백업 다운로드)을 클릭하세요.
5. `.zip` 파일을 안전한 곳에 저장하세요.

작업하는 동안 버튼에 **Creating backup…**(백업 만드는 중…)이 표시됩니다. 완료되면 브라우저가 데이터를 담은 `.zip` 파일을 저장합니다. 복원 방법은 [Marinara 백업과 복원](data/backup-and-restore.md)을 참고하세요.

## 플랫폼별 업데이트

Marinara를 설치한 방식에 맞는 항목을 고르세요. git 사본은 Git 도구로 설치한 사본으로, Windows 설치 프로그램과 `git clone`으로 만든 사본이 모두 여기에 해당합니다.

### Windows

Marinara를 시작하면 런처가 업데이트합니다.

1. Marinara Engine을 종료하세요.
2. 바탕 화면이나 시작 메뉴 바로 가기로 다시 열거나 `start.bat`을 실행하세요.

런처는 최신 코드를 받아 와 바뀐 부분을 다시 설치하고, 다시 빌드한 뒤 새 버전을 실행합니다. 코드를 직접 수정했다면 수정 내용을 따로 보관해 두었다가 업데이트가 끝난 뒤 되돌려 놓습니다. 그럴 수 없으면 지금 버전을 그대로 유지하고 안내 메시지를 출력합니다. 업데이트하기 전에는 데이터를 복사해 두며, 데이터보다 오래된 버전으로 가게 되는 업데이트는 건너뜁니다([이전 버전으로 다운그레이드하기](#downgrading-to-an-older-version) 참고).

이번 한 번만 업데이트를 건너뛰려면 `start.bat --skip-update`를 실행하세요. 실행할 때마다 지금 설치된 버전을 유지하려면 프로젝트의 `.env`에 `AUTO_UPDATE_ENABLED=false`를 설정하세요. 이 설정은 자동 업데이트만 끕니다. 수동 명령과 **Settings → Advanced → Check for Updates**(설정 → 고급 → 업데이트 확인)는 그대로 쓸 수 있습니다.

Node.js 버전이 너무 낮다고 런처가 알리면 Node.js 24 LTS(Long Term Support, 권장되는 안정 릴리스)를 설치한 뒤 Marinara를 다시 시작하세요. GitHub Releases 페이지에서 최신 설치 프로그램을 다운로드해 실행해도 됩니다.

<a id="macos-and-linux"></a>

### macOS와 Linux

1. Marinara Engine을 종료하세요.
2. Marinara 폴더에서 런처를 실행하세요.

```bash
./start.sh
```

런처는 최신 코드를 받아 와 바뀐 의존성을 다시 설치하고, 다시 빌드한 뒤 새 버전을 실행합니다. 이번 한 번만 건너뛰려면 `./start.sh --skip-update`를 쓰고, 자동 업데이트를 끄려면 `.env`에 `AUTO_UPDATE_ENABLED=false`를 설정하세요. Node.js 버전이 너무 낮다면 Node.js 24 LTS를 설치한 뒤 런처를 다시 실행하세요.

<a id="docker-or-podman"></a>

### Docker 또는 Podman

컨테이너는 런처가 아니라 새 이미지를 받아서 업데이트합니다. 백업을 만든 뒤, Compose 파일이 있는 폴더에서 다음 명령을 실행하세요.

```bash
docker compose pull && docker compose up -d
```

Podman에서는 대신 `podman compose`를 쓰세요. 릴리스 이미지는 `ghcr.io/pasta-devs/marinara-engine:X.Y.Z`와 `:latest`이며, 이에 대응하는 `-lite` 태그도 있습니다. 이미지를 받아도 `marinara-data` 볼륨에 있는 데이터는 건드리지 않습니다. [컨테이너로 실행하기](installation/containers.md)를 참고하세요.

### Android (Termux)

Termux는 Marinara를 위해 작은 Linux 시스템을 실행하는 Android 앱입니다. Termux 런처는 실행할 때마다 Marinara를 업데이트합니다.

1. Termux를 여세요.
2. 런처를 실행하세요.

```bash
cd Marinara-Engine
./start-termux.sh
```

런처는 코드를 업데이트하고, 필요하면 Node.js도 업그레이드한 뒤 다시 빌드해 서버를 실행합니다. 업데이트 때문에 문제가 생겨 지금 사본을 유지하고 싶다면 `--skip-update`를 붙이세요. 자동 업데이트를 끄려면 프로젝트의 `.env`에 `AUTO_UPDATE_ENABLED=false`를 설정하세요.

Android 앱(APK)을 쓴다면 [최신 APK를 다운로드](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)한 뒤 파일을 열어 Android가 앱을 업데이트하게 하세요. 그런 다음 Marinara Engine을 열고 **Install / Start Marinara**를 눌러 Termux 사본을 업데이트하고 시작하세요. 업데이트할 때 서명 정보나 시크릿을 요구하는 일은 없습니다.

<a id="iphone-and-ipad"></a>

### iPhone과 iPad

이 기기들은 서버를 실행하지 않습니다. 홈 화면 아이콘은 PWA로, 홈 화면에 저장해 두면 앱처럼 열리는 웹사이트입니다.

1. Marinara 서버를 실행하는 컴퓨터, 컨테이너 호스트, Android 기기를 업데이트하세요. 위에서 그 기기에 해당하는 항목을 참고하세요.
2. 홈 화면 앱이나 Safari 탭을 다시 불러오세요.

Safari에 예전 빌드가 계속 보이면 PWA를 다시 설치하세요. [PWA 지우고 다시 설치하기](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa)를 참고하세요.

<a id="manual-update-git-copy-no-launcher"></a>

### 수동 업데이트(git 사본, 런처 없음)

런처 대신 `pnpm start`로 git 사본을 실행한다면 이 방법을 쓰세요. 다음 명령은 Marinara 폴더에서 실행하세요.

1. 최신 안정 코드를 받아 오세요.

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. 받아 온 코드로 이동하세요.

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. 의존성을 다시 설치하고, 다시 빌드한 뒤 시작하세요.

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

staging(테스터용) 버전을 쓰려면 1단계와 2단계 대신 다음 두 명령을 실행하세요.

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **경고:** Staging 빌드는 출시 전 테스터용 빌드입니다. 사용하기 전에 데이터를 백업하세요.

## 앱에서 업데이트하기

Marinara는 GitHub에 새 버전이 있는지 확인할 수 있습니다. 일부 설치 방식에서는 브라우저에서 바로 업데이트를 적용할 수도 있습니다.

1. **Settings**를 여세요.
2. **Advanced** 탭으로 이동하세요.
3. **Updates**(업데이트) 섹션을 찾으세요.

### 릴리스 채널 고르기

**Release Channel**(릴리스 채널)에서 어떤 빌드를 따라갈지 정합니다.

- **Latest Stable:** 태그가 붙은 `vX.Y.Z` 릴리스입니다. 보통은 이쪽을 고르면 됩니다.
- **Staging/UAT:** 출시 전 테스터용 빌드로, 아직 미완성일 수 있습니다. 이 채널을 고르면 "Staging builds are pre-release tester builds. Back up your app data before applying them."라는 경고가 표시됩니다.

서버를 실행하는 컴퓨터의 브라우저에서 다른 채널을 고르면 업데이트 버튼이 **Switch to** 뒤에 채널 이름이 붙은 형태로 바뀝니다. 이 버튼은 앱 안의 일반 업데이트가 꺼져 있어도 동작하며, 실행하는 동안 **Switching…**(전환 중…)이 표시됩니다. 원격 기기는 아래 **Apply Update**(업데이트 적용) 조건을 충족해야만 이 작업을 할 수 있습니다.

### Check for Updates

**Check for Updates**를 클릭하세요. 확인하는 동안 버튼에 **Checking…**이 표시됩니다. 버튼 아래에는 **Release**(릴리스) 버전과 **Build**(빌드) 커밋 코드가 나오고, 알 수 있을 때는 **Branch**(브랜치)도 표시됩니다.

- 최신 상태라면 초록색 줄에 "You're on the latest"와 함께 버전이 표시됩니다.
- 새 릴리스가 있으면 "vX.Y.Z available" 카드와 **Release notes**(릴리스 노트) 링크가 나타납니다.
- git 사본이 뒤처져 있으면 카드에 "N commits behind"가 표시됩니다. 커밋은 코드에 저장된 변경 하나를 뜻하므로, 이 숫자에는 아직 릴리스되지 않은 작업도 포함될 수 있습니다.

릴리스 확인 결과는 약 15분, 커밋 수는 약 5분 동안 캐시되므로, 바로 다시 클릭하면 같은 숫자가 나올 수 있습니다.

확인에 실패하면 "Could not check for updates. Try again later."라는 메시지가 나옵니다. 대개 네트워크나 GitHub 쪽 문제입니다.

### Apply Update

**Apply Update**는 브라우저에서 git 사본을 업데이트합니다. 다음 조건이 모두 충족될 때만 나타납니다.

- 설치 방식이 git 사본입니다. 컨테이너와 그 밖의 설치 방식은 이렇게 적용할 수 없습니다.
- 브랜치가 `main`, `master`, `staging` 중 하나이거나, 분리된(detached) 체크아웃입니다. 그 밖의 브랜치에 있는 사본은 개발용 체크아웃으로 간주되어 Marinara가 거부합니다.
- 서버 운영자가 서버의 `.env` 파일에 `UPDATES_APPLY_ENABLED=true`를 설정했습니다.
- `UPDATES_APPLY_DISABLED`가 설정되어 있지 않습니다. 이 값은 채널 전환을 포함한 모든 적용을 막으며, 개발자용 런처가 설정합니다.

서버를 실행하는 컴퓨터에서 적용할 때는 관리자 시크릿이 필요 없습니다. `http://127.0.0.1:7860`이나 `http://localhost:7860`으로 Marinara를 여세요.

다음 두 설정은 이 동작을 바꿉니다.

- 리버스 프록시나 터널이 제공하는 주소는 다른 기기로 간주합니다. `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`를 설정하면 이렇게 전달된 방문자도 로컬로 취급되며, 로컬의 관리자 시크릿 면제도 적용됩니다. 공개 프록시나 터널을 쓴다면 이 설정을 켜 두세요.
- `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`를 설정하면 로컬 요청에도 시크릿이 필요합니다.

다른 기기에서 적용하는 기능은 기본적으로 꺼져 있습니다. 다음 3가지가 모두 필요합니다.

- 서버 `.env`의 `UPDATES_ALLOW_REMOTE_APPLY=true`.
- 서버 `.env`에 설정한 `ADMIN_SECRET`. 위험한 작업에 쓰는 두 번째 비밀번호입니다.
- 사용 중인 기기의 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)에 저장한 같은 시크릿.

**Apply Update**를 클릭하세요. 서버가 코드를 받아 와 다시 설치하고, 다시 빌드한 뒤 종료하는 동안 버튼에 **Updating…**(업데이트 중…)이 표시됩니다. 그다음 "Update applied successfully. Please relaunch the app to use the new version."라는 메시지가 나옵니다. Marinara를 다시 시작하면 끝납니다.

작동하지 않는 경우: **Apply Update**가 보이지 않으면 Marinara가 그 이유를 알려 줍니다.

- 컨테이너 설치에는 이미지 태그와, 호스트에서 실행할 `docker compose pull && docker compose up -d` 명령이 표시됩니다.
- 적용 기능이 꺼진 git 사본에는 복사해서 쓸 수 있는 수동 명령이 표시됩니다.
- 그 밖의 설치에는 GitHub 릴리스로 연결되는 **Download**(다운로드) 링크가 표시됩니다.

## 브라우저에서 앱 새로 고치기

**Refresh App**(앱 새로고침)은 같은 **Updates** 섹션에 있습니다. 이 버튼은 서버를 업데이트하지 않습니다. 서비스 워커(앱을 빠르게 불러오려고 브라우저가 쓰는 작은 스크립트)를 제거하고 브라우저 캐시를 비운 다음 페이지를 다시 불러옵니다. 채팅과 설정은 그대로 남습니다.

서버는 이미 업데이트됐는데 앱이 예전 모습으로 보이거나 화면이 비어 있을 때 쓰세요. 작업하는 동안 버튼에 **Refreshing…**(새로고침 중…)이 표시됩니다.

## 데이터와 선택적 다운로드

업데이트는 앱 코드만 교체하며, 데이터 폴더나 `marinara-data` 볼륨은 건드리지 않습니다. 채팅, 캐릭터, 페르소나, 로어북, 프리셋, 연결, 설정은 모두 그대로 남습니다. 데이터가 어디에 있는지는 [Marinara 백업과 복원](data/backup-and-restore.md)에서 확인하세요.

- **선택 패키지.** 공식 에이전트, 지도, 통화, Conversation 게임이 함께 들어 있던 버전에서 업데이트하면, 처음 실행할 때 그에 해당하는 선택 패키지를 다운로드합니다. 선택 항목, 설정, 기록은 그대로 유지됩니다. 이 첫 실행 동안에는 서버를 온라인 상태로 두세요. 다운로드 원본에 연결하지 못하면 Marinara는 아무것도 지우지 않고 다음 실행 때 다시 시도합니다.
- **가이드 언어.** **Settings → General → Documentation Language**(설정 → 일반 → 문서 언어)에서 다운로드한 문서 언어를 쓰고 있다면, 업데이트 후 처음 실행할 때 그 언어 팩을 새로 받습니다. 다운로드 원본에 연결하지 못하면 Marinara는 설치된 팩을 그대로 두고, 팩에 없는 가이드는 영어로 표시하며, 다음 실행 때 다시 시도합니다.
- **인터페이스 언어.** UI 언어 팩은 별도로 직접 다운로드합니다. 번역이 포함되어 있던 버전에서 처음 업데이트하면 인터페이스가 영어로 돌아갑니다. **Settings → General → Language**(설정 → 일반 → 언어)에서 언어를 다시 고르세요. 이후 업데이트는 다운로드한 팩을 유지합니다. 새 번역을 받으려면 **Refresh language pack**(언어 팩 새로고침)을 사용하세요. 번역이 없는 부분은 영어로 표시됩니다.

## 2.5.0에서 업데이트하기

위의 절차는 그대로입니다. 다만 몇 가지 변경은 다른 기기나 다른 사람이 쓰는 서버에 영향을 줍니다. 해당된다면 아래 세부 내용을 펼쳐 보세요.

<details>
<summary>공유 서버의 변경 사항</summary>

- **같은 컴퓨터의 리버스 프록시나 터널.** nginx, Caddy, Cloudflare Tunnel, Tailscale Serve, ngrok이 Marinara로 전달하는 방문자는 이제 원격으로 간주됩니다. 로그인이 없으면 방문자에게 설정 페이지가 표시되고, 백업을 비롯한 보호된 작업에는 관리자 시크릿이 필요합니다. [같은 컴퓨터의 리버스 프록시와 터널](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer)을 참고하세요.
- **Tailscale 로그인 우회.** 이 컴퓨터의 Tailscale 주소로 직접 접속하면 여전히 로그인을 건너뜁니다. `100.64.0.0/10`에서 오는 그 밖의 접속은 더 이상 로그인을 건너뛰지 않으며, Tailscale Serve와 Funnel 방문자는 로그인해야 합니다. [Tailscale과 Docker 우회](REMOTE_ACCESS.md#tailscale-and-docker-bypass)를 참고하세요.
- **비밀번호나 허용 목록을 쓰는 Docker.** 로그인(앱 로그인 또는 Basic Auth)을 설정하면 이제 호스트 컴퓨터의 브라우저도 로그인을 요구받습니다. `TRUSTED_AUTH_PROXY`를 설정해도 마찬가지이며, 연결하는 쪽이 그 프록시이면 예외입니다. `IP_ALLOWLIST`만 설정했다면 컨테이너의 게이트웨이를 목록에 넣지 않는 한 호스트 브라우저가 거부되므로, 로그인을 쓰세요. [Tailscale과 Docker 우회](REMOTE_ACCESS.md#tailscale-and-docker-bypass)를 참고하세요.
- **다른 설치로 옮긴 채팅과 프로필.** 채팅 기록, 설정 프로필, 전체 프로필은 더 이상 **Discord Mirror**(Discord 미러), **DeepLX URL**, **DeepL API Key**(DeepL API 키), **Intiface URL**을 다른 설치로 가져가지 않습니다. 옮긴 곳에서 다시 입력하세요. 내 프로필과 같은 설치에서 복원한 전체 프로필에는 그대로 남습니다.
- **업데이트 후 접속이 막혔나요?** [업데이트 후 접속이 막혔을 때](REMOTE_ACCESS.md#locked-out-after-updating)를 참고하세요.

</details>

<a id="downgrading-to-an-older-version"></a>

## 이전 버전으로 다운그레이드하기

이전 버전으로 돌아가는 것이 항상 가능한 것은 아닙니다. 새 버전은 더 새로운 저장 형식으로 데이터를 저장하며, 빌드는 자신이 아는 것보다 새로운 형식의 데이터를 거부합니다. 현재 빌드는 저장 형식 10을 사용합니다. 형식 8, 9, 10에서는 각각 MMD 아바타, 연결 계정 링크, GLB/FBX 아바타가 추가되었습니다. 그보다 오래된 형식만 아는 빌드는 이 형식으로 저장된 데이터를 열 수 없습니다.

런처는 호환되지 않는 버전으로 가는 자동 업데이트를 건너뛰고, 앱 내 업데이터는 그런 업데이트의 적용을 거부합니다. 이전 빌드로 돌아가려면 Marinara를 중지하고 업데이트하기 전에 만든 전체 백업을 복원하세요. 아래의 채팅 파일 변환 명령은 MMD 아바타 설정을 변환할 수 없습니다. 형식 번호를 직접 바꾸지 마세요.

데이터가 저장 형식 8보다 오래되었다면 명령 하나로 채팅 파일을 예전 구조로 되돌릴 수 있습니다. [이전 버전으로 전환한 뒤 채팅에 메시지가 보이지 않을 때](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version)를 참고하세요.

<a id="going-back-to-250"></a>

### 2.5.0으로 되돌아가기

2.5.0 버전은 저장 형식 8 이상으로 업그레이드한 데이터를 열 수 없습니다. 업그레이드 전에 만든 백업을 사용하세요.

2.5.0이 열 수 있는 이전 데이터라도, 2.5.0은 새 기능이 추가한 데이터를 알지 못합니다. 일부 연결 설정, 채팅 이미지를 재생성할 때 쓰는 세부 정보, 게임 체크포인트와 규칙 집합 시계와 장면 동영상의 일부가 여기에 해당합니다. 2.5.0이 채팅이나 연결을 저장하면, 예를 들어 메시지를 보내거나 게임 턴을 진행하거나 이미지를 만들거나 연결을 바꾸면, 그 채팅이나 연결 전체에서 이 새 데이터를 버립니다. 다시 업데이트해도 되돌아오지 않습니다.

이전 상태 그대로 돌아가려면 업데이트하기 전에 백업을 만드세요. [먼저 백업하기](#back-up-first)를 참고하세요.

## 업데이트가 실패했을 때

업데이트 실패는 대부분 오래된 Node.js, 중간에 끊긴 다운로드, 오래된 브라우저 캐시 때문에 생깁니다.

- Node.js 버전이 너무 낮다고 런처가 알리면 Node.js 24 LTS를 설치하고 다시 시작하세요.
- 서버가 업데이트된 뒤 앱이 깨져 보이면 **Refresh App**을 클릭하세요.
- git 사본이 깔끔하게 업데이트되지 않으면 [수동 업데이트](#manual-update-git-copy-no-launcher) 명령을 쓰세요.

오류 메시지와 해결 방법은 [Marinara Engine 문제 해결](TROUBLESHOOTING.md)을 참고하세요.

## 관련 가이드

- [Marinara 백업과 복원](data/backup-and-restore.md)
- [Marinara Engine 문제 해결](TROUBLESHOOTING.md)
- [Windows 설치 가이드](installation/windows.md)
- [macOS / Linux 설치 가이드](installation/macos-linux.md)
- [컨테이너로 실행하기(Docker / Podman)](installation/containers.md)
- [Android (Termux) 설치 가이드](installation/android-termux.md)
- [iOS / iPadOS PWA 가이드](installation/ios-pwa.md)
