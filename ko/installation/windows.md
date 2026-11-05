# Windows 설치 가이드

이 가이드에서는 설치 프로그램(가장 단계가 적은 방법)이나 소스로 Windows PC에 Marinara Engine을 설치하는 방법을 설명합니다. 설치하고 나면 Marinara는 내 PC에서 실행됩니다.

## 시작하기 전에

Windows 10 또는 Windows 11(64비트), 몇 기가바이트의 여유 디스크 공간, 설치하는 동안 사용할 인터넷 연결이 필요합니다. 설치 프로그램은 약 2.5GB의 여유 공간을 권장합니다.

도구 2가지도 필요합니다.

- **Node.js** 24, 25, 26 중 하나. Node.js가 앱을 실행합니다. 권장 버전은 LTS(Long Term Support, 장기 지원) 릴리스인 24입니다.
- **Git**. Git이 코드를 다운로드하고, Marinara가 스스로 업데이트할 수 있게 해 줍니다.

설치 프로그램을 쓴다면 두 도구를 따로 설치하지 않아도 됩니다. 설치 프로그램이 둘 다 받아 줍니다. 소스에서 설치한다면 직접 설치해야 합니다. pnpm(앱의 구성 요소를 설치하는 도구)은 설치하지 않아도 됩니다. 설치 프로그램과 `start.bat`이 알아서 준비합니다.

## Windows 설치 프로그램으로 설치하기

1. [Marinara Engine 릴리스 페이지](https://github.com/Pasta-Devs/Marinara-Engine/releases)를 여세요.
2. 최신 Windows 설치 프로그램을 다운로드하세요. 파일 이름은 `Marinara-Engine-Installer-` 뒤에 버전이 붙은 형태입니다.
3. 설치 프로그램을 실행하세요. Windows에 "Windows protected your PC"(Windows의 PC 보호)가 표시되면 **More info**(추가 정보)를 고른 뒤 **Run anyway**(실행)를 고르세요. 단, 릴리스 페이지에서 받은 파일에만 이렇게 하세요.
4. 화면의 안내를 따르세요. Node.js나 Git이 없으면 설치 프로그램이 설치하도록 두세요.
5. 설치 폴더를 고르거나 기본값(`%LOCALAPPDATA%\Marinara-Engine`)을 그대로 쓰세요.
6. 설치 프로그램이 앱을 다운로드하고 빌드하는 동안 기다리세요. 진행 목록에 각 단계가 표시됩니다. 몇 분 정도 걸립니다.
7. 설치가 완료되었다고 표시되면 바탕 화면의 **Marinara Engine** 바로 가기를 두 번 클릭하세요.

콘솔 창(검은색 텍스트 창)이 열리고 진행 상황이 표시됩니다. 그다음 브라우저가 Marinara를 엽니다. 열리지 않으면 `http://127.0.0.1:7860`으로 이동하세요.

설치 프로그램은 최신 안정 릴리스를 Git 사본으로 설치하므로, Marinara는 실행할 때마다 스스로 업데이트할 수 있습니다.

> **팁:** 설치 프로그램이 Node.js와 Git을 다운로드하기 때문에 일부 백신 프로그램이 설치 프로그램을 위험 항목으로 표시합니다. 위의 릴리스 페이지에서 받은 설치 프로그램만 실행하세요.

## Marinara 시작하고 중지하기

- **시작:** 바탕 화면 바로 가기나 시작 메뉴 항목을 두 번 클릭하세요. 소스로 설치했다면 Marinara 폴더에서 `start.bat`을 실행하세요.
- **중지:** 바로 가기를 실행하면 콘솔 창이 열립니다. 그 창에서 <kbd>Ctrl</kbd>+<kbd>C</kbd>를 누르세요.

Marinara가 이미 실행 중이라면 바로 가기는 브라우저에서 Marinara를 다시 엽니다.

## 소스에서 설치하기

명령을 직접 실행하고 싶거나 staging(테스터용) 버전을 쓰고 싶다면 이 방법을 사용하세요.

1. [Node.js](https://nodejs.org/en/download)와 [Git for Windows](https://git-scm.com/download/win)를 설치하세요.
2. 새 Command Prompt 창(명령을 입력하는 텍스트 창)을 여세요.
3. 두 도구를 확인하세요. `node -v`는 버전 24, 25, 26 중 하나를 표시해야 합니다.

   ```bat
   node -v
   git --version
   ```

   명령을 찾을 수 없다고 나오면 Command Prompt를 닫았다가 다시 열거나, 빠진 도구를 다시 설치하세요.

4. 코드를 다운로드하세요.

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. 그 폴더로 이동하세요.

   ```bat
   cd Marinara-Engine
   ```

6. 선택 사항: 처음 실행하기 전에 staging 버전으로 전환하세요. 안정 버전을 쓰려면 이 단계를 건너뛰세요. staging을 쓰기 전에는 데이터를 백업하세요.

   ```bat
   git checkout staging
   ```

   그러면 런처가 업데이트할 때도 staging을 유지합니다.

7. 런처(Marinara를 준비하고 시작하는 스크립트)를 실행하세요.

   ```bat
   start.bat
   ```

처음 실행할 때는 모든 것을 설치하고 빌드하므로 몇 분 걸립니다. 콘솔 창에 진행 상황이 표시됩니다. 준비가 끝나면 브라우저가 Marinara를 엽니다. 나중에 다시 시작하려면 같은 폴더에서 `start.bat`을 실행하세요.

작동하지 않는 경우: `[ERROR] Node.js 24 LTS or newer is required`는 Node.js가 너무 오래되었다는 뜻입니다. [nodejs.org](https://nodejs.org)에서 Node.js 24 이상을 설치한 뒤 `start.bat`을 다시 실행하세요.

### 런처 없이 직접 설치하기

이 방법에는 `pnpm` 명령이 필요합니다. 다음 명령은 `Marinara-Engine` 폴더 안에서 실행하세요.

1. pnpm을 한 번 설치하세요.

   ```bat
   npm install -g pnpm
   ```

2. 의존성(앱에 필요한 구성 요소)을 설치하고, 앱을 빌드한 뒤 서버를 시작하세요.

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. `http://127.0.0.1:7860`을 여세요.

`pnpm start`로 실행하면 이 PC에서만 Marinara에 접속할 수 있습니다. 다른 기기도 접속할 수 있게 하려면 `Marinara-Engine` 폴더에 `.env`라는 파일을 만들고, 다음 줄을 추가한 뒤 서버를 다시 시작하세요.

```env
HOST=0.0.0.0
```

## 다른 기기에서 Marinara 열기

설치 프로그램과 그 바로 가기, `start.bat`은 네트워크의 다른 기기가 Marinara에 접속할 수 있게 하지만, Marinara는 로그인을 설정하기 전까지 그 기기들을 막습니다. 설정 단계는 [원격 접근](../REMOTE_ACCESS.md)과 [자주 묻는 질문](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)을 참고하세요.

## Marinara 업데이트하기

바로 가기나 `start.bat`으로 Marinara를 시작할 때마다 런처가 업데이트를 확인해 설치하고, 다시 빌드한 뒤 시작합니다. 채팅, 캐릭터, 설정은 그대로 남습니다. 코드를 직접 수정했다면 런처가 수정 내용을 따로 보관해 두었다가 업데이트가 끝난 뒤 되돌려 놓습니다. 그럴 수 없으면 지금 버전을 그대로 유지하고 안내 메시지를 출력합니다. 앱 안의 **Apply Update**(업데이트 적용) 버튼, 업데이트 건너뛰기, 수동 명령은 [Marinara Engine 업데이트](../UPGRADING.md#windows)를 참고하세요.

## 데이터 찾기와 제거하기

데이터는 Marinara 폴더 안의 `packages\server\data` 폴더에 있습니다. 제거하려면 시작 메뉴 항목 **Uninstall Marinara Engine**을 여세요. 제거 프로그램이 데이터도 삭제할지 묻습니다. 나중에 다시 설치할 때 쓰도록 데이터를 남기려면 **No**를 고르세요. [Marinara 백업과 복원](../data/backup-and-restore.md)을 참고하세요.

## 선택 사항: AI 스프라이트 배경 제거

Marinara는 스프라이트를 생성할 때 투명한 배경을 요청하고, 단색 배경은 스스로 정리합니다. 배경이 복잡한 풍경일 때를 위한 보완 수단으로 선택 도구인 `backgroundremover`를 설치할 수 있습니다. 이 도구는 용량이 큰 머신러닝 파일을 다운로드하므로 기본적으로 꺼져 있습니다.

1. [python.org](https://www.python.org/downloads/windows/)에서 Python 3.11을 설치하세요. Python 3.9부터 3.11까지 동작합니다.
2. `Marinara-Engine` 폴더에서 다음 명령을 실행하세요.

   ```bat
   pnpm backgroundremover:install
   ```

이 명령은 데이터 폴더 아래에 전용 Python 폴더(venv)를 만듭니다. Marinara는 이 폴더를 자동으로 사용합니다.

다음에 실행할 때 `start.bat`이 이 도구를 설치하게 하려면 `.env` 파일에 다음 줄을 추가하세요.

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## 문제가 생겼을 때

Node.js 버전이 24, 25, 26 중 하나인지, Git이 설치되어 있는지 확인하세요. 더 많은 해결 방법은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 관련 가이드

- [Marinara Engine 설치](../INSTALLATION.md)
- [Marinara Engine 업데이트](../UPGRADING.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
- [자주 묻는 질문](../FAQ.md)
