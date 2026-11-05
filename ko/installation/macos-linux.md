# macOS / Linux 설치 가이드

이 가이드에서는 Mac이나 Linux 컴퓨터에 Marinara Engine을 설치하고 `start.sh` 런처로 시작하는 방법을 설명합니다. 설치하고 나면 Marinara는 내 컴퓨터에서 실행됩니다.

## 시작하기 전에

도구 2가지가 필요합니다.

- **Node.js** 24, 25, 26 중 하나. Node.js가 Marinara를 실행합니다. 권장 버전은 LTS(Long Term Support, 장기 지원) 릴리스인 24입니다.
- **Git**. Git이 Marinara를 다운로드하고 업데이트를 가져옵니다.

pnpm(앱의 구성 요소를 설치하는 도구)은 설치하지 않아도 됩니다. 런처가 알맞은 버전을 준비합니다.

### macOS에 Node.js와 Git 설치하기

Homebrew가 있다면 명령 하나로 둘 다 설치됩니다.

```bash
brew install node git
```

Homebrew가 없다면 [nodejs.org](https://nodejs.org)에서 Node.js 설치 프로그램을 다운로드하세요. 그다음 Xcode 명령줄 도구로 Git을 설치하세요.

```bash
xcode-select --install
```

### Linux에 Node.js와 Git 설치하기

패키지 관리자를 사용하세요. Ubuntu나 Debian에서는 기본 Node.js가 24 버전보다 오래된 경우가 많으므로, 먼저 NodeSource 릴리스를 추가하세요.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs git
```

Fedora에서는 다음과 같습니다.

```bash
sudo dnf install -y nodejs git
```

Arch에서는 다음과 같습니다.

```bash
sudo pacman -S nodejs npm git
```

### 도구 확인하기

```bash
node -v
git --version
```

`node -v`는 `v24` 이상을 표시해야 합니다. 둘 중 하나라도 "command not found"가 나오면 그 도구가 제대로 설치되지 않은 것입니다.

## Marinara 설치하고 시작하기

1. 터미널(명령을 입력하는 창)을 여세요. Mac에서는 <kbd>Cmd</kbd>+<kbd>Space</kbd>를 누르고 Terminal(터미널)을 입력한 뒤 Enter를 누르세요. Linux에서는 터미널 앱을 여세요.
2. Marinara를 다운로드하세요.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. 새로 생긴 폴더로 이동하세요.

   ```bash
   cd Marinara-Engine
   ```

4. 런처(Marinara를 준비하고 시작하는 스크립트)로 Marinara를 시작하세요.

   ```bash
   ./start.sh
   ```

처음 실행할 때는 모든 것을 다운로드하고 빌드하므로 몇 분 걸립니다. 터미널에 진행 상황이 표시된 다음 `Press Ctrl+C to stop`이 나옵니다. 브라우저에서 `http://127.0.0.1:7860` 주소로 Marinara가 열립니다. 브라우저가 열리지 않으면 그 주소로 직접 이동하세요.

작동하지 않는 경우:

- `permission denied`: `chmod +x start.sh`를 실행한 뒤 `./start.sh`를 다시 실행하세요.
- `[ERROR] Node.js 24 LTS or newer is required`: Node.js가 너무 오래되었습니다. 더 새로운 버전을 설치한 뒤 `./start.sh`를 다시 실행하세요.

## Marinara 시작하고 중지하기

- **다시 시작:** Marinara 폴더에서 `./start.sh`를 실행하세요. Marinara가 이미 실행 중이라면 브라우저에서 다시 엽니다.
- **중지:** 터미널에서 <kbd>Ctrl</kbd>+<kbd>C</kbd>를 누르세요.

Git으로 다운로드한 폴더에서 `./start.sh`를 실행할 때마다 런처는 다음 작업을 합니다.

1. 새 버전이 있는지 확인하고, 있으면 업데이트합니다.
2. Node.js와 알맞은 pnpm 버전을 확인합니다.
3. 빠진 구성 요소를 설치하고, 코드가 바뀌었으면 앱을 다시 빌드합니다.
4. 서버를 시작하고 브라우저를 엽니다.

## 런처 설정 바꾸기

런처 설정은 Marinara 폴더의 `.env` 파일에 있습니다. `.env` 파일은 설정을 한 줄에 하나씩 적는 일반 텍스트 파일입니다. 런처가 브라우저를 열지 않게 하려면 다음 줄을 추가하세요.

```bash
AUTO_OPEN_BROWSER=false
```

`PORT`는 포트, 즉 주소에서 콜론 뒤에 오는 숫자를 정합니다(기본값은 7860). 런처는 로컬 네트워크의 다른 기기가 Marinara에 접속할 수 있게 하지만, Marinara는 로그인을 설정하기 전까지 그 기기들을 막습니다. [원격 접근](../REMOTE_ACCESS.md)을 참고하세요.

## Marinara 업데이트하기

`./start.sh`를 실행하면 먼저 Marinara를 업데이트합니다. 채팅, 캐릭터, 설정은 그대로 남습니다. 코드를 직접 수정했다면 런처가 수정 내용을 따로 보관해 두었다가 업데이트가 끝난 뒤 되돌려 놓습니다. 업데이트 건너뛰기, 앱 안의 **Apply Update**(업데이트 적용) 버튼, 수동 명령은 [Marinara Engine 업데이트](../UPGRADING.md#macos-and-linux)를 참고하세요.

## 런처 없이 직접 설치하기

대부분은 런처를 쓰는 편이 좋습니다. 각 단계를 직접 실행하려면 pnpm이 필요합니다. Node.js 24에는 pnpm을 켜 주는 도구인 Corepack이 들어 있지만, Node.js 25에는 없습니다.

1. Node.js 24에서는 pnpm을 켜세요.

   ```bash
   corepack enable pnpm
   ```

   Node.js 25나 26에서는 먼저 Corepack을 설치하세요.

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Marinara를 다운로드하세요.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. 그 폴더로 이동하세요.

   ```bash
   cd Marinara-Engine
   ```

4. 구성 요소를 설치하고, 앱을 빌드한 뒤 서버를 시작하세요.

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. `http://127.0.0.1:7860`을 여세요.

`pnpm start`로 실행하면 서버는 내 컴퓨터에서만 접속을 받습니다. 다른 기기도 접속할 수 있게 하려면 `.env`에 `HOST=0.0.0.0`을 추가하고 다시 시작하세요.

## 선택 사항: 배경 제거 도구

Marinara는 스프라이트(캐릭터 그림)를 생성할 때 투명한 배경을 요청하고, 단색 배경은 스스로 정리합니다. 복잡한 풍경이나 그림자가 있는 배경을 위한 보완 수단으로 선택 사항인 AI 배경 제거 도구를 설치할 수 있습니다. 이 도구는 Python venv(Python 패키지를 따로 담는 전용 폴더)를 만들고, 용량이 큰 파일인 PyTorch(머신러닝 라이브러리)와 U2Net 모델(이미지 속 피사체를 찾는 파일)을 다운로드합니다.

1. macOS에서는 Python 3.11이 가장 잘 동작합니다. 먼저 설치하세요. Python 3.9부터 3.11까지 동작합니다.

   ```bash
   brew install python@3.11
   ```

2. Marinara 폴더에서 다음 명령을 실행하세요.

   ```bash
   pnpm backgroundremover:install
   ```

다음에 실행할 때 런처가 이 도구를 설치하게 하려면 `.env`에 다음 줄을 추가하세요.

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## 문제가 생겼을 때

일부 Linux 시스템에서는 `ERR_PNPM_ENAMETOOLONG`(파일 경로가 너무 김)이 들어간 오류로 설치가 실패합니다. 설치가 덜 끝난 폴더를 지우고 런처를 다시 실행하세요.

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

더 많은 해결 방법은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 관련 가이드

- [Marinara Engine 설치](../INSTALLATION.md)
- [Marinara Engine 업데이트](../UPGRADING.md)
- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
