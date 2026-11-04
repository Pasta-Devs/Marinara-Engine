# 컨테이너로 실행하기(Docker / Podman)

이 가이드에서는 Docker나 Podman을 이용해 Marinara Engine을 컨테이너 안에서 실행하는 방법을 설명합니다. 컨테이너는 앱과 실행에 필요한 모든 것을 하나로 묶어 둔 꾸러미이므로 Node.js를 설치하지 않아도 됩니다. 가장 적은 설정으로 Marinara를 실행하고 싶다면 여기서 시작하세요.

## 시작하기 전에

Marinara를 실행할 컴퓨터에 다음 중 하나를 설치하세요.

- Docker Desktop(Windows 또는 macOS) 또는 Docker Engine(Linux).
- Podman. Docker를 대체하는 도구로, 백그라운드 서비스가 필요 없고 root 권한 없이도 동작합니다.

아래에서 쓰는 용어입니다.

- **Image**(이미지): 다운로드해 쓰는 Marinara의 읽기 전용 사본입니다. 이미지를 실행하면 컨테이너가 만들어집니다.
- **Volume**(볼륨): 컨테이너 도구가 관리하는 저장 공간입니다. 컨테이너를 지우고 다시 만들어도 데이터가 그대로 남습니다.

공식 이미지는 `ghcr.io/pasta-devs/marinara-engine`에 있습니다.

<a id="start-marinara"></a>

## Marinara 시작하기

프로젝트에는 바로 쓸 수 있는 `docker-compose.yml` 파일이 들어 있습니다. Compose는 이 파일을 읽어 컨테이너를 시작하는 Docker의 구성 요소입니다. 이 방법을 권장합니다.

1. 터미널(명령을 입력하는 창)을 여세요. 이미 Marinara 체크아웃이 있다면 그 폴더에서 터미널을 열고 다음 두 단계를 건너뛰세요.
2. 프로젝트 파일을 다운로드하세요.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. 새로 생긴 폴더로 이동하세요.

   ```bash
   cd Marinara-Engine
   ```

4. 컨테이너를 백그라운드에서 시작하세요.

   ```bash
   docker compose up -d
   ```

   처음 실행할 때는 `ghcr.io/pasta-devs/marinara-engine:latest` 이미지를 다운로드하므로 몇 분 정도 걸릴 수 있습니다. 완료되면 터미널에 컨테이너가 `Started`로 표시됩니다.

5. 브라우저에서 `http://127.0.0.1:7860`을 여세요. Marinara 홈 화면이 나타납니다.

작동하지 않는 경우: 다른 프로그램이 `7860` 포트를 쓰고 있을 수 있습니다. `8080`처럼 비어 있는 포트를 고르세요. `docker-compose.yml`과 같은 폴더에 `.env`라는 파일을 만들어 `PORT=8080` 줄을 넣은 뒤, `docker compose up -d`를 다시 실행하세요. Compose는 매번 이 파일을 읽으므로 이후 업데이트에서도 새 포트가 유지됩니다. 그다음 `http://127.0.0.1:8080`을 여세요. 다른 해결 방법은 [문제 해결](#troubleshooting)에 있습니다.

## Marinara 중지하기

같은 폴더에서 다음 명령을 실행하세요. 컨테이너를 중지하고 제거합니다. 데이터는 볼륨에 그대로 남습니다.

```bash
docker compose down
```

Podman에서는 `podman compose down`을 쓰세요.

## 데이터가 저장되는 위치

Marinara는 채팅, 캐릭터, 업로드한 파일, 글꼴, 기본 배경을 `marinara-data`라는 Compose 볼륨에 일반 파일로 저장합니다. Compose는 앞에 프로젝트 폴더 이름을 붙이므로 실제 이름은 `PROJECT_marinara-data` 형태가 됩니다. 정확한 이름과 위치를 확인하려면 다음 명령을 실행하세요.

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

`PROJECT_marinara-data`는 첫 번째 명령이 출력한 이름으로 바꾸세요.

또한 Marinara는 처음 시작할 때 볼륨 안의 `/app/data/.env`에 빈 설정 파일을 만듭니다. 서버 설정은 여기에 추가하세요. 다시 시작하거나 이미지를 업데이트해도 설정이 유지됩니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

컨테이너는 시작할 때마다 앱이 쓸 수 있도록 데이터 폴더의 소유권을 바로잡습니다. root로 시작해 소유권을 바로잡은 뒤, root가 아닌 사용자로 전환합니다. 이 동작은 볼륨에도, 내 컴퓨터에서 마운트한 폴더에도 적용됩니다.

<a id="open-marinara-from-another-device"></a>

## 다른 기기에서 Marinara 열기

기본적으로 Compose는 이 컴퓨터에서만 Marinara에 접속할 수 있게 합니다. 휴대폰이나 다른 컴퓨터에서 열려면 포트를 모든 인터페이스에 공개하되, 그 전에 로그인을 설정하세요. 로그인 없이 Marinara를 네트워크에 공개하지 마세요.

Docker Desktop, OrbStack, rootless Docker(root 없이 실행하는 Docker)에서는 모든 기기가 하나의 게이트웨이 주소로 보입니다. 로그인이 없으면 모든 인터페이스에 공개한 포트로 누구나 들어올 수 있습니다. 로그인을 설정하면 이 컴퓨터에서도 로그인을 요구합니다. [Tailscale과 Docker 우회](../REMOTE_ACCESS.md#tailscale-and-docker-bypass)를 참고하세요.

1. Marinara 폴더에 있는 `docker-compose.yml`을 텍스트 편집기로 여세요.
2. `ports:` 목록에서 `127.0.0.1:`을 지우세요.

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. `environment:` 목록에 관리자 시크릿을 추가하세요. 직접 정한 길고 무작위한 값을 쓰세요.

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. 같은 목록에 로그인을 추가하세요. 직접 정한 사용자 이름과 길고 무작위한 비밀번호를 쓰세요.

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. 파일을 저장하고 컨테이너를 다시 시작하세요.

   ```bash
   docker compose up -d
   ```

6. 다른 기기에서 `http://YOUR_COMPUTER_IP:7860`을 여세요. `PORT`를 설정했다면 그 포트를 쓰세요. 페이지에서 로그인을 요구합니다.

`BASIC_AUTH_USER`와 `BASIC_AUTH_PASS`를 넣지 않으면 페이지가 대신 1회용 설정 코드를 요구합니다. 로그에서 코드를 찾은 뒤, 새 사용자 이름과 비밀번호와 함께 페이지에 입력하세요.

```bash
docker logs <container> 2>&1 | grep "setup code"
```

앱 로그인은 나중에 로그인한 브라우저의 **Settings → Advanced → Access**(설정 → 고급 → 접근)에서 바꿀 수 있습니다. 비밀번호를 잊었다면 `docker exec <container> node scripts/reset-login.mjs`를 실행하세요. 이 명령은 `BASIC_AUTH_USER`와 `BASIC_AUTH_PASS`로 만든 로그인은 바꾸지 않습니다. 그런 로그인은 compose 파일에서 고친 뒤 컨테이너를 다시 만드세요.

Docker Desktop, OrbStack, rootless Docker에서는 이 컴퓨터에서 `http://localhost:7860`으로 Marinara를 열어 **Settings**에서 로그인을 설정하세요. 이런 환경에서는 IP 허용 목록으로 기기를 구분할 수 없으므로 로그인을 쓰세요. 접근을 제한하는 다른 방법과 관리자 시크릿의 역할은 [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)을 참고하세요.

## Marinara 업데이트하기

컨테이너는 스스로 업데이트되지 않습니다. 먼저 백업을 만든 뒤([Marinara 백업과 복원](../data/backup-and-restore.md) 참고), 새 이미지를 받고 다시 시작하세요. `docker-compose.yml`이 있는 폴더에서 다음 명령을 실행하세요.

```bash
docker compose pull && docker compose up -d
```

Podman에서는 대신 `podman compose`를 쓰세요. 앱에서는 **Settings → Advanced → Updates → Check for Updates**(설정 → 고급 → 업데이트 → 업데이트 확인)에 이미지 태그와 이 명령이 표시됩니다. 컨테이너에서는 앱이 직접 업데이트를 적용할 수 없습니다.

예전 릴리스로 돌아가려면 `docker-compose.yml`의 `image:` 줄에 그 태그를 지정한 뒤 `docker compose up -d`를 실행하세요. 그 전에 [이전 버전으로 다운그레이드하기](../UPGRADING.md#downgrading-to-an-older-version)를 먼저 읽어 보세요. 이전 빌드는 새 빌드가 저장한 데이터를 열 수 없습니다.

## 이미지 태그 고르기

| 태그 | 설명 |
| --- | --- |
| `latest` | 안정 릴리스입니다. `docker-compose.yml`이 이 태그를 씁니다. |
| `X.Y.Z` | `ghcr.io/pasta-devs/marinara-engine:2.5.1`처럼 고정된 버전 하나입니다. |
| `staging` | 아직 릴리스되지 않은 코드로 만든 불안정한 테스트 빌드입니다. 오류가 날 수 있고, 데이터를 안정 빌드로 되돌리지 못할 수도 있습니다. |
| `lite` | 용량이 작은 이미지입니다. 아래를 참고하세요. |
| `X.Y.Z-lite` | lite 이미지의 고정 버전입니다. |

`staging`을 실행한다면 안정 빌드의 데이터를 바꾸지 못하도록 별도의 볼륨을 쓰세요.

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### lite 이미지

lite 이미지는 컨테이너용 최소 Linux 기반인 Wolfi 위에서 빌드한, 다운로드 용량이 작은 이미지입니다. 용량이 큰 로컬 파일이 필요한 기능은 빠져 있습니다.

| lite에서 빠진 기능 | 사용할 수 없게 되는 것 |
| --- | --- |
| 내장 모델 | 내 하드웨어에서 AI 모델을 실행할 수 없습니다. |
| 로컬 임베딩 모델 | 기기 안에서 텍스트 임베딩을 만들 수 없습니다. |
| Memory Recall(시맨틱 검색) | 로컬 임베딩 모델에 의존하는 기능입니다. |
| 로컬 Whisper 음성 입력 | Conversation 통화에서 음성-텍스트 변환을 쓸 수 없습니다. |
| 아바타 감정 판독기 | 2D Avatars와 3D Avatars가 작은 로컬 감정 모델 대신 단어 목록으로 표정을 고릅니다. |

나머지 기능은 모두 동작합니다. 채팅, 롤플레이, Game Mode, 에이전트, 로어북, 캐릭터, 원격 AI 서비스를 쓸 수 있습니다. AI 기능을 쓰려면 외부 서비스의 계정을 추가해야 합니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

일부 예전 lite 이미지는 Raspberry Pi 4를 비롯한 비슷한 ARM 컴퓨터에서 AI 요청을 보내는 중에 `SIGILL` 오류(잘못된 명령어 오류)를 내며 비정상 종료됩니다. 이런 기기에서는 일반 `latest` 이미지를 쓰세요. 최신 정보는 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)에서 확인하세요.

## Podman

Podman은 같은 이미지를 실행합니다. 대부분의 명령에서 `docker`를 `podman`으로 바꾸면 됩니다.

```bash
podman compose up -d
```

Compose 없이 컨테이너 하나만 실행하려면 다음과 같이 하세요.

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose`를 쓰려면 `podman-compose` 도우미가 필요합니다. 다음 중 하나로 설치하세요.

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

첫 번째 줄은 Fedora용, 두 번째 줄은 Debian 또는 Ubuntu용이며, 세 번째 줄은 pip가 있는 곳이면 어디서든 쓸 수 있습니다.

## 이미지 직접 빌드하기

다운로드하는 대신 소스에서 빌드하려면 다음과 같이 하세요.

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

lite 이미지를 빌드하려면 lite 빌드 파일을 쓰세요.

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

<a id="troubleshooting"></a>

## 문제 해결

**페이지가 열리지 않거나 포트가 이미 사용 중입니다.** [Marinara 시작하기](#start-marinara)의 포트 해결 방법을 참고하세요.

**Marinara가 파일을 쓰지 못하거나 권한 오류가 나타납니다.** 컨테이너는 시작할 때마다 폴더 소유권을 바로잡습니다. 일부 호스트 파일 시스템에서는 이 보정이 실패할 수 있고, `MARINARA_SKIP_DATA_CHOWN=true`를 설정하면 건너뜁니다. 오류가 계속되면 기본 `marinara-data` 볼륨을 쓰세요. 가장 안정적입니다.

**Raspberry Pi 4에서 lite 이미지가 비정상 종료됩니다.** 일반 `latest` 이미지를 쓰세요.

더 자세한 도움말은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)에서 확인하세요.

## 관련 가이드

- [서버 설정 참고 문서](../CONFIGURATION.md)
- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
