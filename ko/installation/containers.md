# 컨테이너로 실행하기(Docker / Podman)

이 가이드에서는 Docker나 Podman을 이용해 Marinara Engine을 컨테이너 안에서 실행하는 방법을 설명합니다. 컨테이너는 앱과 실행에 필요한 모든 것을 하나로 묶어 둔 꾸러미입니다. 컴퓨터에 Node.js나 다른 도구를 따로 설치하지 않아도 됩니다. 처음 써 보는데 일단 Marinara를 띄우고 싶다면 이 방법이 가장 간단합니다.

## 준비물

시작하기 전에 Marinara를 실행할 컴퓨터에 다음 중 하나를 설치하세요.

- Docker Desktop(Windows 또는 macOS) 또는 Docker Engine(Linux). Docker는 가장 널리 쓰이는 컨테이너 도구입니다.
- 또는 Podman. Podman은 Docker를 그대로 대체할 수 있는 도구입니다. 백그라운드 서비스 없이 동작하고 root 권한 없이도 잘 돌아갑니다.

아래에서 쓰는 몇 가지 용어입니다.

- **Image**(이미지): Marinara Engine이 담긴, 다운로드해 쓰는 읽기 전용 틀입니다. 이미지를 실행하면 컨테이너가 하나 만들어집니다.
- **Volume**(볼륨): 컨테이너 도구가 알아서 관리해 주는 저장 공간입니다. 컨테이너를 지우고 다시 만들어도 볼륨에 있는 데이터는 그대로 남습니다.
- **LAN**: 집이나 사무실의 Wi-Fi 또는 유선 네트워크, 즉 내 로컬 네트워크입니다.

공식 Marinara 이미지는 `ghcr.io/pasta-devs/marinara-engine`에 게시됩니다.

## 다운로드해서 실행하기

저장소의 최상위 폴더에는 바로 쓸 수 있는 `docker-compose.yml` 파일이 들어 있습니다. Compose가 이 파일을 읽어서 컨테이너를 대신 띄워 줍니다. Marinara를 실행하는 가장 권장하는 방법입니다.

1. 저장소를 다운로드하세요. 이미 Marinara Engine 저장소를 받아 두었다면 그 폴더에서 터미널을 여세요. 없다면 먼저 복제하세요.

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. 해당 폴더로 이동하세요.

```bash
cd Marinara-Engine
```

3. 컨테이너를 백그라운드에서 시작하세요.

```bash
docker compose up -d
```

`docker-compose.yml` 파일은 `ghcr.io/pasta-devs/marinara-engine:latest` 이미지를 사용하며, 이 명령을 처음 실행할 때 이미지를 다운로드합니다. 첫 다운로드는 몇 분 정도 걸릴 수 있습니다.

## 정상 동작 확인하기

1. 웹 브라우저를 여세요.
2. 다음 주소로 접속하세요.

```text
http://127.0.0.1:7860
```

Marinara Engine 홈 화면이 나타나면 컨테이너가 정상적으로 실행되고 있는 것입니다. 주소의 `127.0.0.1`은 "지금 이 컴퓨터"라는 뜻이고, `7860`은 Marinara가 기본으로 사용하는 포트입니다.

페이지가 열리지 않으면 아래 문제 해결 절을 참고하세요.

## 데이터가 저장되는 위치

채팅, 캐릭터, 업로드한 파일, 글꼴, 기본 배경 같은 데이터는 일반 파일 형태로 저장됩니다. Marinara는 파일 기반 저장 방식을 씁니다. 즉, 데이터가 데이터베이스 파일 하나에 들어가지 않고 보통의 파일로 남습니다. Compose는 이 파일들을 `marinara-data`라는 이름의 볼륨에 보관합니다.

Compose는 볼륨 이름 앞에 프로젝트 폴더 이름을 붙이기 때문에 실제 볼륨 이름은 `PROJECT_marinara-data` 형태가 됩니다. 사용 중인 컴퓨터에서 정확한 이름을 확인하려면 볼륨 목록을 출력하세요.

```bash
docker volume ls --filter name=marinara-data
```

그다음 목록에 나온 볼륨의 위치를 확인하세요.

```bash
docker volume inspect PROJECT_marinara-data
```

`PROJECT_marinara-data` 자리에는 앞 명령이 출력한 이름을 넣으세요.

컨테이너는 시작할 때마다 데이터 폴더를 준비합니다. 기본적으로 컨테이너는 root로 시작해서 앱이 쓸 수 있도록 폴더 소유권을 바로잡은 뒤, 안전을 위해 root가 아닌 사용자로 전환합니다. 이 보정은 이름 있는 볼륨은 물론 호스트에서 연결한 폴더에도 적용됩니다. 덕분에 예전 설치 환경도 소유권 명령을 직접 실행하지 않고 파일 기반 저장 방식으로 넘어올 수 있습니다.

또한 Marinara는 처음 시작할 때 볼륨 안의 `/app/data/.env` 위치에 빈 설정 파일을 만듭니다. 나중에 서버 설정을 추가하는 곳입니다. 이 파일은 볼륨 안에 있으므로 컨테이너를 다시 시작하거나 이미지를 업데이트해도 설정이 그대로 유지됩니다. 설정 전체 목록은 [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

## LAN에 Marinara 공개하기

기본 상태에서 Compose는 같은 컴퓨터에서만 Marinara에 접속할 수 있게 합니다. 안전을 위한 기본값입니다. 휴대폰이나 네트워크의 다른 컴퓨터에서도 Marinara를 열려면 두 가지를 해야 합니다. 포트 매핑을 바꾸고, 모르는 사람이 접속하지 못하도록 로그인을 켜는 것입니다.

다른 기기는 Marinara를 쓰기 전에 로그인해야 합니다. 로그인 없이 Marinara를 네트워크에 공개하지 마세요.

1. 텍스트 편집기로 `docker-compose.yml`을 여세요.

2. 포트 줄을 찾으세요. 다음과 같이 생겼습니다.

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. 다른 기기에서 접속할 수 있도록 `127.0.0.1:` 부분을 지우세요.

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. 같은 파일의 `environment:` 목록에 관리자 시크릿을 추가하세요. 값은 직접 정한 것으로 넣으세요.

```yaml
environment:
  - ADMIN_SECRET=another-long-random-value
```

5. 파일을 저장하고 컨테이너를 다시 시작하세요.

```bash
docker compose up -d
```

이제 `PORT`를 설정하지 않았다면 네트워크의 다른 기기에서 `http://YOUR_COMPUTER_IP:7860` 주소로 Marinara에 접속할 수 있습니다. `PORT`를 설정했다면 `7860` 대신 그 호스트 포트를 넣으세요. 그러면 로그인을 요구하는 페이지가 표시됩니다. 로그인을 설정하려면 `docker logs <container> 2>&1 | grep "setup code"`로 1회용 설정 코드를 찾으세요. 그 페이지에 코드와 새 사용자 이름, 비밀번호를 입력하세요. 나중에 로그인한 브라우저의 **Settings**(설정) → **Advanced**(고급) → **Access**에서 로그인을 바꿀 수 있습니다. 비밀번호를 잊었다면 `docker exec <container> node scripts/reset-login.mjs`를 실행하세요. 이 명령은 `BASIC_AUTH_USER`와 `BASIC_AUTH_PASS`로 만든 로그인은 바꾸지 않으므로, 그런 로그인은 compose 파일을 고치고 컨테이너를 다시 만드세요. compose 파일의 `environment:` 목록에 `BASIC_AUTH_USER`와 `BASIC_AUTH_PASS`를 넣어 로그인을 설정할 수도 있습니다.

Docker Desktop, OrbStack, rootless Docker에서는 내 브라우저를 포함한 모든 기기가 같은 주소에서 컨테이너에 접속합니다. 그래서 로그인을 설정하면 이 컴퓨터에서도 로그인을 요구하고, IP 허용 목록으로는 기기를 구분할 수 없습니다. `127.0.0.1:`을 지우기 전에 로그인을 설정하세요. 이런 런타임에서는 이 컴퓨터에서 `http://localhost:7860`으로 Marinara를 열고 **Settings**를 쓰거나, compose 파일에 `BASIC_AUTH_USER`와 `BASIC_AUTH_PASS`를 설정하세요. 로그인 없이 `127.0.0.1:`을 절대 지우지 마세요. 이런 런타임에서는 Marinara가 다른 기기와 이 컴퓨터를 구분할 수 없습니다. 특정 기기만 허용하는 방법과 관리자 시크릿의 역할은 [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)에서 확인하세요.

## 이미지 고르기: latest, staging, lite

Marinara는 여러 이미지 태그를 게시합니다. 용도에 맞는 것을 고르세요.

- `latest`는 권장하는 안정 릴리스입니다. `docker-compose.yml` 파일도 기본으로 이 태그를 씁니다.
- `X.Y.Z`는 `ghcr.io/pasta-devs/marinara-engine:2.0.6`처럼 버전을 고정한 태그입니다. 특정 릴리스에 고정하고 싶을 때 쓰세요.
- `staging`은 최신 개발 코드로 만든 불안정한 테스트 빌드입니다. 아직 릴리스되지 않은 변경을 시험해 볼 때만 쓰세요. 오류가 날 수 있고, 안내 없이 동작이 바뀔 수 있으며, 데이터를 안정 빌드로 되돌리지 못할 수도 있습니다.
- `lite`는 용량이 작은 이미지입니다. 다음 절에서 설명합니다.

`staging` 이미지를 실행할 때는 불안정한 빌드가 안정 빌드의 데이터를 건드리지 않도록 별도의 볼륨을 사용하세요.

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### lite 이미지

lite 이미지는 오프라인 기능 일부를 빼는 대신 다운로드 용량을 크게 줄인 경량 버전입니다. 컨테이너용으로 만들어진 최소 Linux 기반인 Wolfi 위에서 빌드합니다.

lite 이미지에서는 용량이 큰 로컬 파일이 필요한 기능이 빠져 있습니다.

| lite에서 빠진 기능 | 사용할 수 없게 되는 것 |
| --- | --- |
| 로컬 모델(Gemma, 내 컴퓨터에서 실행) | 내 하드웨어에서 AI 모델을 실행할 수 없습니다. |
| 로컬 임베딩 모델 | 기기 안에서 텍스트 임베딩을 만들 수 없습니다. |
| Memory Recall(의미 기반 검색) | 로컬 임베딩 모델에 의존하는 기능입니다. |
| 로컬 Whisper 음성 입력 | Conversation 통화의 음성-텍스트 변환을 쓸 수 없습니다. |
| 아바타 감정 판독기 | 2D Avatars와 3D Avatars가 작은 로컬 감정 모델 대신 단어 목록으로 표정을 고릅니다. |

나머지 기능은 모두 그대로입니다. 채팅, 롤플레이, Game Mode, 에이전트, 로어북, 캐릭터, 원격 AI 제공자 연결이 전부 동작합니다. lite 이미지에서 AI 기능을 쓰려면 OpenRouter, OpenAI, 직접 운영하는 모델 같은 외부 제공자에 연결해야 합니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

lite 태그는 `ghcr.io/pasta-devs/marinara-engine:lite`이며, 릴리스마다 `ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`처럼 버전을 고정한 lite 태그도 함께 나옵니다. 실행 방법은 다음과 같습니다.

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

일부 예전 lite 이미지는 Raspberry Pi 4를 비롯한 ARM 컴퓨터에서 비정상 종료될 수 있습니다. AI 제공자로 요청을 보내는 중에 프로세서의 잘못된 명령어 오류인 `SIGILL` 오류가 나타납니다. 이런 기기를 쓴다면 일반 `latest` 이미지를 대신 실행하세요. 최신 정보는 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)에서 확인하세요.

## 업데이트

컨테이너 이미지는 스스로 업데이트되지 않습니다. 새 이미지를 직접 다운로드하고 컨테이너를 다시 시작해야 합니다. 이전 상태 그대로 돌아갈 수 있도록 먼저 백업을 만들어 두세요. [Marinara 백업과 복원](../data/backup-and-restore.md)을 참고하세요.

Docker Compose에서는 다음 한 줄이면 됩니다.

```bash
docker compose pull && docker compose up -d
```

Podman Compose에서는 다음 한 줄이면 됩니다.

```bash
podman compose pull && podman compose up -d
```

앱 안에서 버전을 확인할 수도 있습니다. **Settings**(설정)를 열고 **Advanced**(고급) 탭으로 이동한 다음 **Updates**(업데이트) 항목을 찾으세요. **Check for Updates**(업데이트 확인)를 클릭하세요. 컨테이너로 설치한 경우 Marinara는 Docker에서 실행 중임을 인식해 릴리스 이미지 태그와 호스트에서 실행할 명령을 알려 줍니다. 브라우저 안에서는 업데이트를 적용할 수 없으므로, 위 명령은 호스트에서 직접 실행해야 합니다.

예전 릴리스로 돌아가려면 `docker-compose.yml`의 `image:` 줄에 그 버전 태그를 지정하세요. 예를 들면 `ghcr.io/pasta-devs/marinara-engine:2.5.0`입니다. 그런 다음 `docker compose up -d`를 실행하세요. 2.5.0으로 돌아가는 것은 가능하고 채팅도 정상적으로 열리지만, 2.5.0은 새 기능이 추가한 설정과 게임 데이터를 알지 못합니다. 2.5.0이 저장하는 채팅이나 연결에서는 그 데이터가 사라지며, 다시 업데이트해도 되돌아오지 않습니다. [2.5.0으로 되돌아가기](../UPGRADING.md#going-back-to-250)를 참고하세요.

## Podman

Podman은 Docker와 같은 이미지를 실행합니다. 위 명령의 `docker`를 `podman`으로 바꾸면 대부분 그대로 동작합니다.

Compose로 시작하려면 다음과 같이 실행하세요.

```bash
podman compose up -d
```

Compose 없이 컨테이너 하나만 실행하려면 다음과 같이 실행하세요.

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose` 명령을 쓰려면 `podman-compose` 도구가 필요합니다. 사용 중인 시스템에 맞는 명령으로 설치하세요.

Fedora에서는 다음과 같습니다.

```bash
sudo dnf install podman-compose
```

Debian 또는 Ubuntu에서는 다음과 같습니다.

```bash
sudo apt install podman-compose
```

pip를 쓸 때는 다음과 같습니다.

```bash
pip install podman-compose
```

## 이미지 직접 빌드하기

이미지를 다운로드하는 대신 소스에서 직접 빌드하고 싶다면 다음과 같이 실행하세요.

```bash
docker build -t marinara-engine .
```

그다음 직접 빌드한 이미지를 실행하세요.

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

lite 이미지를 소스에서 빌드하려면 Docker가 lite 빌드 파일을 쓰도록 지정하세요.

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## 문제 해결

**페이지가 열리지 않거나 포트가 이미 사용 중입니다.** 다른 프로그램이 `7860` 포트를 이미 쓰고 있을 수 있습니다. `ports:` 목록에서 포트 매핑을 `8080:7860`처럼 비어 있는 포트로 바꾸세요. 그다음 `docker compose up -d`로 다시 시작하고 `http://127.0.0.1:8080`을 여세요.

**Marinara가 파일을 쓰지 못하거나 권한 오류가 나타납니다.** 컨테이너는 시작할 때마다 데이터 폴더의 소유권을 바로잡습니다. 이름 있는 볼륨과 호스트에서 연결한 폴더 모두에 적용됩니다. 다만 일부 호스트 파일 시스템에서는 이 보정이 실패할 수 있고, `MARINARA_SKIP_DATA_CHOWN=true`로 설정하면 아예 건너뜁니다. 오류가 계속되면 기본값인 `marinara-data` 이름 볼륨을 쓰세요. 가장 안정적인 선택입니다.

**Raspberry Pi 4에서 lite 이미지가 비정상 종료됩니다.** 위의 lite 이미지 안내를 참고하세요. 해당 하드웨어에서는 일반 `latest` 이미지를 쓰세요.

더 자세한 도움말은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)에서 확인하세요.

## 관련 가이드

- [서버 설정 참고 문서](../CONFIGURATION.md)
- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
