# macOS / Linux 설치 가이드

이 가이드에서는 macOS나 Linux에 Marinara Engine을 설치하고 실행하는 방법을 설명합니다. 꼭 필요한 도구 두 가지를 설치하고, 셸 런처로 앱을 켠 다음, 나중에 업데이트하는 방법까지 다룹니다. Marinara Engine(이하 Marinara)은 전부 내 컴퓨터 안에서 돌아갑니다.

## 준비물

시작하기 전에 무료 도구 두 가지가 설치되어 있어야 합니다.

- **Node.js**: Marinara를 실행하는 프로그램입니다. 24, 25, 26 버전 중 하나를 설치하세요(권장은 LTS 릴리스인 24 버전입니다).
- **Git**: Marinara를 다운로드하고 업데이트를 가져오는 도구입니다.

pnpm은 직접 설치하지 않아도 됩니다. pnpm은 Marinara가 구성 요소를 받아올 때 쓰는 패키지 관리자입니다. 셸 런처가 알맞은 pnpm 버전을 대신 설치합니다.

### macOS에 설치하기

Homebrew를 쓰는 방법이 가장 간단합니다. 아래 명령 하나로 두 도구가 모두 설치됩니다.

```bash
brew install node git
```

Homebrew를 쓰지 않는다면 https://nodejs.org 에서 Node.js 설치 프로그램을 다운로드하세요. 그다음 Xcode 명령줄 도구로 Git을 설치합니다.

```bash
xcode-select --install
```

### Linux에 설치하기

배포판의 패키지 관리자를 사용하세요. Ubuntu나 Debian에서는 기본 Node.js가 24 버전보다 낮은 경우가 많습니다. 먼저 최신 NodeSource 릴리스를 추가하세요.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
```

그다음 Node.js와 Git을 설치합니다.

```bash
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

두 도구가 제대로 준비됐는지 확인하세요. 아래 명령을 실행하세요.

```bash
node -v
```

`v24` 또는 그보다 높은 숫자가 나와야 합니다. 이어서 아래 명령을 실행하세요.

```bash
git --version
```

`git version 2.40` 정도이거나 그보다 높은 버전이 나와야 합니다. 둘 중 하나라도 "command not found"가 나오면 그 도구가 제대로 설치되지 않은 것입니다.

## 런처로 빠르게 시작하기

Marinara를 실행하는 방법으로는 `start.sh` 런처 스크립트를 권장합니다. 필요한 것을 모두 설치하고, 앱을 빌드하고, 브라우저에서 열어 줍니다.

1. Marinara를 다운로드하세요. 아래 명령을 실행하세요.

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. 새로 생긴 폴더로 이동하세요. 아래 명령을 실행하세요.

```bash
cd Marinara-Engine
```

3. 런처에 실행 권한을 주세요. 아래 명령을 실행하세요.

```bash
chmod +x start.sh
```

4. Marinara를 시작하세요. 아래 명령을 실행하세요.

```bash
./start.sh
```

처음 실행할 때는 모든 것을 다운로드하고 빌드하기 때문에 몇 분 걸립니다. 끝나면 브라우저에서 http://127.0.0.1:7860 주소로 Marinara가 열립니다. 7860은 기본 포트 번호이고, 포트는 앱이 컴퓨터에서 사용하는 출입구입니다.

브라우저가 저절로 열리지 않으면 직접 브라우저를 열고 같은 주소로 들어가세요.

### 런처가 매번 하는 일

Git으로 다운로드한 폴더에서 `./start.sh`를 실행할 때마다 런처는 다음 작업을 합니다.

1. 새 버전이 있는지 확인하고, 있으면 스스로 업데이트합니다.
2. Node.js와 알맞은 pnpm 버전이 준비됐는지 확인합니다.
3. 빠진 구성 요소를 설치합니다.
4. 코드가 바뀌었으면 앱을 다시 빌드합니다.
5. 데이터를 담을 로컬 저장소를 준비합니다.
6. 서버를 시작하고 브라우저에서 앱을 엽니다.

### 브라우저 자동 열기 끄기

기본적으로 런처가 브라우저를 대신 열어 줍니다. 이 동작을 멈추려면 Marinara 폴더에 `.env`라는 이름의 파일을 만들고 아래 줄을 추가하세요.

```bash
AUTO_OPEN_BROWSER=false
```

`.env` 파일은 설정을 한 줄에 하나씩 적어 두는 일반 텍스트 파일입니다. 간단한 `.env` 예시는 다음과 같습니다.

```bash
PORT=7860
AUTO_OPEN_BROWSER=true
```

`PORT`는 주소의 포트 번호를 정합니다(기본값은 7860). 또한 런처는 기본적으로 같은 LAN 안의 다른 기기가 서버에 접근할 수 있도록 열어 둡니다. LAN은 근거리 통신망, 즉 집이나 사무실 안의 네트워크입니다. 다만 비밀번호나 다른 접근 방식을 설정하기 전까지 Marinara가 그 기기들을 계속 차단합니다. 설정 방법은 [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md) 가이드에서 설명합니다.

## 수동으로 설치하기

대부분은 위의 런처를 쓰는 편이 좋습니다. 각 단계를 직접 실행하고 싶다면 아래 명령을 따르세요. 수동 설치에는 pnpm이 필요합니다. Node.js 24에는 Corepack이 들어 있지만 Node.js 25에는 없습니다.

1. Node.js 24에서는 Corepack으로 pnpm을 켜세요.

```bash
corepack enable pnpm
```

Node.js 25나 26에서는 별도로 배포되는 Corepack 패키지를 먼저 설치한 다음 pnpm을 켜세요.

```bash
npm install --global corepack
corepack enable pnpm
```

2. Marinara를 다운로드하세요. 아래 명령을 실행하세요.

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

3. 폴더로 이동하세요. 아래 명령을 실행하세요.

```bash
cd Marinara-Engine
```

4. 구성 요소를 설치하세요. 아래 명령을 실행하세요.

```bash
pnpm install --force
```

5. 앱을 빌드하세요. 아래 명령을 실행하세요.

```bash
pnpm build
```

6. 서버를 시작하세요. 아래 명령을 실행하세요.

```bash
pnpm start
```

이제 브라우저에서 http://127.0.0.1:7860 주소를 여세요. `pnpm start`로 실행하면 서버는 기본적으로 내 컴퓨터에서만 접속을 받습니다. 모든 처리는 로컬에서 이루어지고, 데이터 저장소는 처음 시작할 때 준비됩니다.

### Linux에서 설치가 실패할 때

일부 Linux 시스템은 아주 긴 파일 경로를 설치 도중에 거부합니다. `ERR_PNPM_ENAMETOOLONG`이 들어간 오류가 보이면 설치가 덜 끝난 폴더를 지우고 런처부터 다시 시작하세요. 아래 명령을 실행하세요.

```bash
rm -rf node_modules .pnpm .pnpm-store
```

그다음 아래 명령을 실행하세요.

```bash
./start.sh
```

## 선택 사항: 배경 제거 도구

Marinara는 캐릭터 스프라이트 이미지에서 배경을 지울 수 있습니다. 스프라이트는 Roleplay(롤플레이)와 Game Mode(게임 모드)에서 쓰는 캐릭터 그림입니다. 원본 투명 배경 처리와 기본 제공되는 적응형 매트 정리 기능은 이 도구를 받지 않아도 동작합니다. 복잡한 배경, 그림자처럼 단색이 아닌 배경 위에서 만든 스프라이트까지 처리해야 할 때만 추가 AI 배경 제거 도구를 설치하세요. 용량이 큰 파일을 다운로드합니다.

추가 도구는 Python 프로그램입니다. 설치하면 Python venv가 만들어집니다. venv는 가상 환경, 즉 Python 패키지를 따로 담아 두는 전용 폴더입니다. 머신러닝 라이브러리인 PyTorch도 함께 다운로드합니다. 마지막으로 이미지 속 피사체를 찾아내는 파일인 U2Net 모델을 다운로드합니다.

한 번만 설치하면 됩니다. Marinara 폴더에서 아래 명령을 실행하세요.

```bash
pnpm backgroundremover:install
```

macOS에서는 Python 3.11 버전이 가장 안정적입니다. Homebrew로 먼저 설치하세요.

```bash
brew install python@3.11
```

그다음 설치 명령을 다시 실행하세요.

```bash
pnpm backgroundremover:install
```

다음 실행 때 런처가 이 도구를 알아서 설치하게 하려면 `.env` 파일에 아래 줄을 추가하세요.

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## 업데이트

Git으로 다운로드한 폴더에서 `./start.sh`로 Marinara를 시작하면 런처가 새 버전이 있는지 확인합니다. 그리고 시작하기 전에 알아서 업데이트합니다. 채팅, 캐릭터, 설정은 그대로 남습니다.

한 번만 확인을 건너뛰려면 `./start.sh --skip-update`를 실행하세요. 실행할 때마다 설치된 Engine 버전을 그대로 유지하려면 `.env`에 `AUTO_UPDATE_ENABLED=false`를 추가하세요. 그래도 **Settings → Advanced → Updates**에서, 또는 Git 명령으로 직접 확인하고 업데이트할 수 있습니다.

앱 안에서 확인할 수도 있습니다. **Settings**(설정)를 열고 **Advanced**(고급) 탭으로 간 다음 **Updates**(업데이트) 항목을 찾으세요. **Check for Updates**(업데이트 확인)를 클릭하면 새 릴리스가 있는지 확인합니다. **Apply Update**(업데이트 적용) 버튼은 기본적으로 꺼져 있습니다. 켜려면 서버 옵션 몇 가지를 설정해야 합니다. 그다음 **Settings**, **Advanced**, **Admin Access**(관리자 접근)에서 관리자 시크릿을 저장하세요. 켜지 않겠다면 `./start.sh`로 다시 실행하기만 해도 업데이트됩니다.

먼저 백업하는 방법과 릴리스 채널을 바꾸는 방법을 포함한 전체 업데이트 절차는 아래에 링크한 업데이트 가이드를 참고하세요.

## 주요 용어

- **pnpm**: Marinara가 구성 요소를 다운로드하고 정리할 때 쓰는 패키지 관리자입니다.
- **Corepack**: Node.js에 들어 있는 도우미 도구로, pnpm을 켜 줍니다.
- **LAN**: 근거리 통신망, 즉 집이나 사무실 안의 사설 네트워크입니다.
- **.env**: Marinara 폴더에 두는 일반 텍스트 설정 파일이며, 설정을 한 줄에 하나씩 적습니다.
- **venv**: Python 가상 환경으로, Python 패키지를 따로 담아 두는 전용 폴더입니다.
- **PyTorch**: 선택 사항인 배경 제거 도구가 사용하는 머신러닝 라이브러리입니다.
- **U2Net**: 배경 제거 도구가 이미지 속 피사체를 찾을 때 쓰는 모델 파일입니다.

## 관련 가이드

- [Marinara Engine 설치](../INSTALLATION.md): 기기에 맞는 설치 방법을 고르세요.
- [Marinara Engine 업데이트](../UPGRADING.md): 모든 플랫폼의 전체 업데이트 및 백업 절차입니다.
- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md): 다른 기기에서 Marinara에 접근할 수 있도록 비밀번호를 설정합니다.
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md): 설치와 시작 과정에서 생기는 문제의 해결 방법입니다.
