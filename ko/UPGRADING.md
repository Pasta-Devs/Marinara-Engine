# Marinara Engine 업데이트

이 가이드에서는 Marinara Engine을 최신 버전으로 업데이트하는 방법을 설명합니다. 설치 방식별 절차, 앱 안의 업데이트 기능, 업데이트가 실패했을 때의 대처법까지 함께 정리했습니다. 업데이트해도 채팅과 설정은 그대로 유지됩니다.

## 데이터 보존

Marinara Engine을 업데이트해도 데이터는 지워지지 않습니다. 채팅, 캐릭터, 페르소나, 로어북, 프리셋, 연결, 설정이 모두 그대로 남습니다.

Marinara는 서버를 실행하는 컴퓨터의 로컬 데이터 폴더에 데이터를 보관합니다. Docker와 Podman은 `marinara-data` 볼륨에 보관합니다. 업데이트는 앱 코드만 교체할 뿐, 이 데이터 폴더나 볼륨은 건드리지 않습니다.

기본 제공 에이전트, 지도, 통화, Conversation 게임이 함께 들어 있던 버전에서 업데이트하면, 처음 실행할 때 공식 카탈로그에서 그에 해당하는 선택 패키지를 다운로드합니다. 기존 채팅 선택, 에이전트 설정, 저장된 실행 데이터, 기록은 그대로 유지됩니다. 이 첫 실행 동안에는 서버를 온라인 상태로 두세요. 카탈로그에 연결하지 못하면 Marinara는 저장된 설정을 지우거나 비활성화하지 않고, 다음 실행 때 마이그레이션을 다시 시도합니다.

다운로드한 문서 언어(**Settings**(설정) → **General**(일반) → **Documentation Language**)를 쓰고 있다면, 업데이트 후 처음 실행할 때 해당 언어 팩에 바뀐 내용이 있는지도 확인해 자동으로 새로 받습니다. 다운로드 원본에 연결하지 못하면 Marinara는 설치된 팩을 그대로 두고(그 팩에 없는 가이드는 영어로 표시됩니다) 다음 실행 때 다시 시도합니다. 언어 선택이 업데이트 때문에 초기화되는 일은 없습니다.

데이터가 어디에 저장되는지, 사본은 어떻게 만드는지는 [Marinara 백업과 복원](data/backup-and-restore.md)에서 확인하세요.

## 먼저 백업하기

업데이트는 안전하지만, 백업은 값싼 보험입니다. 버전 차이가 큰 업데이트 전에는 하나 만들어 두세요.

1. **Settings**를 여세요.
2. **Advanced**(고급) 탭으로 이동하세요.
3. **Backup & Export**(백업 및 내보내기) 섹션을 찾으세요.
4. **Download Backup**(백업 다운로드)을 클릭하세요.
5. `.zip` 파일을 안전한 곳에 저장하세요.

작업하는 동안 버튼이 **Creating backup…**으로 바뀝니다. 완료되면 브라우저가 데이터를 담은 `.zip` 파일을 저장합니다.

백업과 복원의 전체 절차는 [Marinara 백업과 복원](data/backup-and-restore.md)에 있습니다.

## 플랫폼별 업데이트

Marinara를 설치한 방식에 맞는 항목을 고르세요. 아래에서 말하는 "git checkout"은 Git 도구로 설치한 사본을 뜻합니다. "clone"은 Git으로 다운로드해 만든 사본입니다.

### Windows

Windows 설치 프로그램이나 git checkout으로 설치했다면 런처가 알아서 업데이트합니다.

1. Marinara Engine을 종료하세요.
2. 시작 메뉴 바로 가기로 다시 열거나 `start.bat`을 실행하세요.

런처는 최신 코드를 받아 와 바뀐 부분을 다시 설치하고, 앱을 다시 빌드한 뒤 새 버전을 실행합니다. 설치 프로그램으로 설치한 경우와 직접 clone한 경우 모두 같습니다.

이번 한 번만 건너뛰려면 `start.bat --skip-update`를 실행하세요. 실행할 때마다 지금의 Engine 버전을 유지하려면 프로젝트의 `.env`에 `AUTO_UPDATE_ENABLED=false`를 설정하세요. 이 설정은 자동 Engine 업데이트만 끕니다. 수동 명령과 **Settings → Advanced → Check for Updates**는 그대로 쓸 수 있습니다.

Node.js 버전이 너무 낮다고 런처가 알리면 Node.js 24 LTS를 설치한 뒤 Marinara를 다시 실행하세요. LTS는 Long Term Support(장기 지원)의 줄임말로, Node.js가 권장하는 안정 버전입니다.

GitHub Releases 페이지에서 최신 설치 프로그램을 다운로드해 실행해도 됩니다. 이 방식도 같은 git 기반 경로를 쓰기 때문에 이후 업데이트는 계속 런처를 통해 이루어집니다.

### macOS와 Linux

Marinara Engine을 종료한 뒤 Marinara 폴더에서 런처를 실행하세요.

```bash
./start.sh
```

런처는 최신 코드를 받아 와 바뀐 의존성을 다시 설치하고, 다시 빌드한 뒤 새 버전을 실행합니다.

이번 한 번만 건너뛰려면 `./start.sh --skip-update`를 쓰고, 계속 끄고 싶다면 `.env`에 `AUTO_UPDATE_ENABLED=false`를 설정하세요. 수동 업데이트 명령과 앱 안의 업데이트 기능은 그대로 쓸 수 있습니다.

Node.js 버전이 너무 낮다고 나오면 Node.js 24 LTS를 설치한 뒤 런처를 다시 실행하세요.

### Docker 또는 Podman

컨테이너로 설치한 경우에는 런처가 아니라 새 이미지를 받아서 업데이트합니다. 아래 명령을 Compose 파일이 있는 폴더에서 실행하세요.

```bash
docker compose down && docker compose pull && docker compose up -d
```

Podman을 쓴다면 같은 명령을 `podman`으로 바꿔서 실행하세요.

```bash
podman compose down && podman compose pull && podman compose up -d
```

릴리스 이미지는 `ghcr.io/pasta-devs/marinara-engine:X.Y.Z`와 `:latest`로 배포되며, 이에 대응하는 `-lite` 태그도 함께 제공됩니다. 일부러 예전 릴리스에 머무를 생각이 아니라면 `:latest`나 가장 최신 버전 태그를 받으세요. `marinara-data` 볼륨에 있는 데이터는 이미지를 받아도 그대로입니다.

### Android (Termux)

Termux는 Android용 터미널이자 Linux 환경입니다. Termux 런처는 실행할 때마다 Marinara를 업데이트합니다.

1. Termux를 여세요.
2. 런처를 실행하세요.

```bash
cd Marinara-Engine
./start-termux.sh
```

런처는 코드를 업데이트하고, 필요하면 Node.js도 올린 뒤 다시 빌드해 로컬 서버를 실행합니다.

업데이트에 문제가 있어 지금 쓰던 사본을 유지해야 한다면, 업데이트 확인을 건너뛰세요.

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

계속 끄고 싶다면 프로젝트의 `.env`에 `AUTO_UPDATE_ENABLED=false`를 설정하세요. 이 설정은 런처가 관리하는 Engine 업데이트에만 영향을 줍니다. 수동 업데이트와 앱 안의 업데이트 기능은 그대로 쓸 수 있습니다.

Android 앱 아이콘(APK)을 쓴다면 [최신 APK를 다운로드](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)하고 다운로드한 파일을 열어 Android 래퍼 자체를 업데이트하세요. 그런 다음 Marinara Engine을 열고 **Install / Start Marinara**를 눌러 Termux 사본을 업데이트하고 시작하세요. 앱은 비공개 localhost 인증 정보를 자동으로 보존하고 교환하며 업데이트 중에 서명 정보나 이 비밀 값을 요구하지 않습니다.

### iPhone과 iPad

iPhone과 iPad는 Marinara 서버를 직접 실행하지 않습니다. 다른 기기에서 돌아가는 서버를 Safari로 열어서 쓰는 방식입니다. 홈 화면에 있는 것은 PWA(Progressive Web App)입니다. PWA는 홈 화면에 추가해 두면 앱처럼 열리는 웹사이트입니다.

1. 실제로 Marinara 서버를 실행하는 컴퓨터, Docker 호스트, Android 기기를 업데이트하세요. 위에서 그 기기에 해당하는 항목을 참고하세요.
2. iPhone이나 iPad에서 홈 화면 PWA나 Safari 탭을 새로 고치세요.

호스트를 업데이트했는데도 Safari에 예전 빌드가 계속 보이면, 캐시된 사본을 초기화하세요.

1. 홈 화면 아이콘을 삭제하세요.
2. Marinara 호스트의 Safari 웹사이트 데이터를 지우세요.
3. 홈 화면에 다시 추가하세요.

## 앱에서 업데이트 확인하고 적용하기

Marinara는 앱 안에서 GitHub에 새 버전이 있는지 확인할 수 있습니다. 설치 방식에 따라서는 브라우저에서 바로 업데이트를 적용할 수도 있습니다.

1. **Settings**를 여세요.
2. **Advanced** 탭으로 이동하세요.
3. **Updates**(업데이트) 섹션을 찾으세요.

### Release Channel

**Release Channel**(릴리스 채널) 드롭다운에서 어떤 빌드를 따라갈지 고릅니다. 선택지는 2가지입니다.

- **Latest Stable**: 태그가 붙은 `vX.Y.Z` 릴리스를 따라갑니다. 대부분은 이쪽을 고르면 됩니다.
- **Staging/UAT**: 출시 전 테스터용 빌드를 따라갑니다. 아직 미완성일 수 있으니, 쓰기 전에 데이터를 백업하세요.

**Staging/UAT**를 고르면 다음 경고가 표시됩니다: "Staging builds are pre-release tester builds. Back up your app data before applying them."

채널 변경은 의도적인 선택으로 취급합니다. 서버를 실행하는 컴퓨터의 브라우저에서 다른 채널을 고르면 업데이트 버튼이 **Switch to** 뒤에 채널 이름이 붙은 형태로 바뀌고, 앱 안의 일반 업데이트가 꺼져 있어도 동작합니다. 실행하는 동안에는 **Switching…**이 표시됩니다. 같은 채널 안에서 하는 일반 업데이트는 아래 Apply Update 항목에서 설명하는 설정이 여전히 필요하며, 원격 기기는 언제나 필요합니다.

### Check for Updates

**Check for Updates**(업데이트 확인)를 클릭하세요. 확인하는 동안 버튼에 **Checking…**이 표시됩니다.

버튼 아래에는 **Release**(릴리스) 버전과 **Build**(빌드) 커밋 코드가 나옵니다. 브랜치를 알 수 있을 때는 **Branch**(브랜치) 줄도 함께 표시됩니다.

- 최신 상태라면 초록색 체크 줄에 "You're on the latest ... target"과 버전이 함께 표시됩니다.
- 새 버전이 있으면 "vX.Y.Z available" 카드와 **Release notes**(릴리스 노트) 링크가 나타납니다.
- git으로 설치했고 단순히 코드가 뒤처져 있을 뿐이라면 카드에 "N commits behind"가 대신 표시됩니다. 커밋은 코드에 저장된 변경 하나를 뜻하므로, 이 숫자에는 아직 릴리스되지 않은 작업도 포함될 수 있습니다.

업데이트 확인 결과는 캐시에 저장됩니다. 릴리스 버전 확인은 약 15분 동안 유지됩니다. "commits behind" 숫자는 약 5분 동안 유지됩니다. 그래서 **Check for Updates**를 바로 다시 클릭하면 같은 숫자가 나올 수 있습니다.

### Apply Update

**Apply Update**(업데이트 적용) 버튼은 설치된 앱이 브라우저에서 스스로 업데이트할 수 있을 때만 나타납니다. 다음 2가지 조건을 모두 충족해야 합니다.

- git 기반 설치일 것(Docker와 패키지 설치는 이 방식으로 업데이트할 수 없습니다).
- 서버 관리자가 서버의 `.env` 파일에 `UPDATES_APPLY_ENABLED=true`를 설정했을 것. `.env` 파일에는 서버 설정이 들어 있습니다.

서버를 실행하는 컴퓨터에서 **Apply Update**를 클릭할 때는 이 정도면 충분합니다. 그 컴퓨터에서는 시크릿이 필요 없습니다.

다른 기기에서 적용하는 기능은 기본적으로 꺼져 있습니다. 다음 3가지 조건이 모두 필요합니다.

- 서버 관리자가 `.env`에 `UPDATES_ALLOW_REMOTE_APPLY=true`를 설정합니다.
- 서버 관리자가 `.env`에 `ADMIN_SECRET`(보호된 작업에 쓰는 비밀번호)을 설정합니다.
- 사용 중인 기기의 **Settings -> Advanced -> Admin Access**에 같은 시크릿을 저장합니다.

**Apply Update**를 클릭하면 버튼에 **Updating...**이 표시됩니다. 서버는 새 코드를 받아 의존성을 다시 설치하고, 다시 빌드한 뒤 종료합니다. 그다음 "Update applied successfully. Please relaunch the app to use the new version."라는 메시지가 나옵니다. Marinara를 다시 실행하면 끝입니다.

**Apply Update**를 쓸 수 없을 때는 그 이유와 대신 할 방법을 Marinara가 알려 줍니다.

- 컨테이너 설치에는 이미지 태그와, 호스트에서 실행할 `docker compose pull && docker compose up -d` 명령이 표시됩니다.
- 적용 기능이 꺼진 git 설치에는 복사해서 쓸 수 있는 수동 업데이트 명령이 표시됩니다.
- 그 밖의 설치에는 GitHub 릴리스로 이동하는 **Download**(다운로드) 링크가 표시됩니다.

확인 자체가 실패하면 "Could not check for updates. Try again later."라는 메시지가 나옵니다. 대개 네트워크나 GitHub 쪽 문제이므로 잠시 뒤에 다시 시도하세요.

## Refresh App 버튼

**Refresh App**(앱 새로고침) 버튼은 같은 **Updates** 섹션에 있습니다. 이 버튼은 서버를 업데이트하지 않습니다. 지금 쓰는 브라우저에서 앱만 새로 고칩니다.

**Refresh App**은 서비스 워커 등록을 해제하고 브라우저 캐시를 비운 다음 페이지를 다시 불러옵니다. 서비스 워커는 앱을 빠르게, 그리고 오프라인에서도 불러오려고 브라우저가 쓰는 작은 스크립트입니다. 저장된 채팅과 설정을 비롯한 로컬 데이터는 그대로 남습니다.

서버는 이미 새 버전으로 돌아가고 있는데 업데이트 뒤 앱이 예전 상태로 보이거나 화면이 비어 있을 때 **Refresh App**을 쓰세요. 멈춰 버린 웹 페이지를 고치는 기능입니다. 서버 코드는 바꾸지 않으므로 실제 업데이트를 대신하지는 못합니다.

실행하는 동안 버튼에 **Refreshing…**이 표시되고, 이어서 앱이 다시 열립니다.

## 이전 버전으로 다운그레이드하기

업그레이드는 항상 안전하지만 곧바로 이전으로 돌아갈 수 있는 것은 아닙니다. 새 Marinara 버전은 채팅 메시지를 더 새로운 디스크 형식으로 저장하며, 데이터 형식보다 오래된 버전은 이를 읽을 수 없습니다. 채팅 기록을 보호하기 위해 런처는 호환되지 않는 버전으로 가는 자동 업데이트를 건너뛰고 앱 내 업데이터는 적용을 거부합니다.

그래도 이전 버전이 필요하다면 명령 하나로 먼저 데이터를 예전 형식으로 되돌릴 수 있습니다. 단계는 [이전 버전으로 전환한 뒤 채팅에 메시지가 보이지 않을 때](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version)를 참고하세요.

## 업데이트가 실패했을 때

업데이트 문제는 대부분 오래된 Node.js 버전, 중간에 끊긴 다운로드, 오래된 브라우저 캐시 때문에 생깁니다.

- Node.js 버전이 너무 낮다고 런처가 알리면 Node.js 24 LTS를 설치하고 다시 실행하세요.
- 서버는 업데이트됐는데 앱이 깨져 보이면 위의 **Refresh App** 버튼을 눌러 보세요.
- git 설치가 깔끔하게 업데이트되지 않으면, 해당 설치 가이드에 나온 플랫폼별 수동 업데이트 명령을 실행하세요.

오류 메시지와 단계별 해결 방법은 [Marinara Engine 문제 해결](TROUBLESHOOTING.md)에서 확인하세요.

## 관련 가이드

- [Marinara 백업과 복원](data/backup-and-restore.md)
- [Marinara Engine 문제 해결](TROUBLESHOOTING.md)
- [Windows 설치 가이드](installation/windows.md)
- [macOS / Linux 설치 가이드](installation/macos-linux.md)
- [컨테이너로 실행하기(Docker / Podman)](installation/containers.md)
- [Android (Termux) 설치 가이드](installation/android-termux.md)
- [iOS / iPadOS PWA 가이드](installation/ios-pwa.md)
