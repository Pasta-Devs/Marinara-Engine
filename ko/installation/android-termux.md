# Android (Termux) 설치 가이드

이 가이드에서는 Android 휴대폰이나 태블릿에서 Marinara Engine을 실행하는 방법을 설명합니다. Marinara는 휴대폰에 작은 Linux 시스템을 만들어 주는 무료 앱인 Termux 안에서 실행됩니다. Marinara Android 앱으로 설정할 수도 있고(가장 쉬운 방법), Termux에서 직접 설정할 수도 있습니다.

## Termux와 F-Droid란

Marinara는 Android 네이티브 앱이 아니라 Linux 서버라서 실행하려면 Termux가 필요합니다. F-Droid는 무료 오픈 소스 앱 스토어입니다. Android 앱의 설정 과정은 안정적인 Termux F-Droid 빌드를 다운로드합니다. Termux에는 실험적인 Google Play 빌드도 있습니다. 이미 설치되어 있다면 Marinara가 그 빌드를 받아들이지만, 이 가이드에서는 F-Droid를 권장합니다.

[F-Droid의 Termux](https://f-droid.org/en/packages/com.termux/)에서 Termux를 설치하세요. 서명이 일치해야 하므로 Termux나 플러그인 앱을 서로 다른 출처에서 섞어 설치하지 마세요. [Termux 공식 설치 안내](https://github.com/termux/termux-app#installation)를 참고하세요.

## Android 앱으로 설치하기

Marinara Engine Android 앱은 Termux를 설정한 다음, 로컬 서버가 실행되면 Marinara를 엽니다. 그 과정에서 Android가 몇 가지 시스템 확인 창을 승인하라고 요청합니다.

1. [최신 Android APK 다운로드](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)를 누르세요. APK는 Android 앱 설치 파일입니다.
2. APK를 설치한 다음 앱을 여세요.
3. **Install / Start Marinara**(Marinara 설치/시작)를 누르세요.
4. Termux가 설치되어 있지 않다면 이 앱의 앱 설치 허용을 포함해 Android의 설치 확인 창을 승인하세요. 그래야 앱이 F-Droid에서 Termux를 설치할 수 있습니다.
5. Android가 물어보면 **Run commands in Termux environment**(Termux 환경에서 명령 실행) 권한을 허용하세요.
6. Termux가 설정을 막으면 앱이 `allow-external-apps` 명령을 복사하고 Termux를 엽니다. Termux 화면을 길게 누르고 **Paste**(붙여넣기)를 누른 다음 Enter를 누르세요. 그런 다음 앱으로 돌아가 **Install / Start Marinara**를 다시 누르세요.
7. Termux가 의존성(앱에 필요한 구성 요소)을 설치하고 Marinara를 빌드할 때까지 기다리세요. Termux에 텍스트가 계속 스크롤되며 표시됩니다. 첫 빌드는 몇 분 걸립니다.
8. Termux 작업이 끝나면 Marinara Engine 앱으로 돌아오세요. 서버가 준비되면 앱이 알아서 연결하고 로그인하며, Marinara 홈 화면이 나타납니다.

대신 브라우저를 쓰려면 앱의 런처에서 **Open in browser**(브라우저에서 열기)를 선택하세요. 앱이 이 선택을 기억하며, 브라우저에서도 자동으로 로그인합니다.

작동하지 않는 경우: 설정을 막은 확인 창을 해결한 뒤 **Install / Start Marinara**를 다시 누르세요. 앱이 localhost를 열지 못하면 APK를 업데이트하고 **Install / Start Marinara**를 누르세요. [Android localhost 로그인 도움말](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503)을 참고하세요.

앱에는 서명 키, 비밀번호, `CSRF_TRUSTED_ORIGINS` 변경이 필요하지 않습니다. 앱이 자체 비공개 localhost 인증 정보를 만듭니다. `CSRF_TRUSTED_ORIGINS`에 `null`을 추가하지 마세요.

## Termux에서 직접 설치하기

앱을 쓰고 싶지 않다면 이 방법을 쓰세요. Termux를 연 다음 화면을 길게 누르고 **Paste**를 눌러 다음 명령을 붙여넣으세요(명령 전체를 복사하세요).

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

이 명령은 다음 순서로 작업합니다.

1. Termux 패키지를 모두 업그레이드합니다. 새 Node.js는 예전 Termux 라이브러리로는 시작할 수 없으므로 Termux 전체를 업그레이드해야 합니다. 설정 파일을 유지할지 물으면 Enter를 눌러 현재 파일을 유지하세요.
2. Git과 Node.js를 설치합니다. Marinara는 Node.js 24, 25, 26을 지원합니다.
3. Marinara가 아직 없다면 다운로드합니다.
4. 런처(`start-termux.sh`)를 실행 가능하게 만들고 실행합니다.

런처는 의존성을 설치하고 기기에서 Marinara를 빌드한 뒤 로컬 서버를 시작합니다. Node.js 버전이 너무 낮으면 Node.js도 업그레이드합니다. 첫 실행은 느리고, Termux에 텍스트가 계속 스크롤되며 표시됩니다. 이후 실행은 더 빠릅니다.

서버가 실행 중이라고 표시되면 Android 브라우저에서 다음 주소를 여세요.

```text
http://127.0.0.1:7860
```

`PORT`를 다른 값으로 설정했다면 그 번호를 쓰세요. 앱 같은 아이콘을 만들려면 브라우저 메뉴에서 페이지를 홈 화면에 추가하는 항목을 쓰세요. 항목 이름은 브라우저마다 다릅니다.

## Marinara 시작하고 중지하기

앱을 쓴다면 앱을 열고, 서버가 멈춰 있으면 **Install / Start Marinara**를 누르세요. 앱과 브라우저를 전환하려면 런처에서 **Open in browser**를 쓴 다음 **Retry connection**(연결 다시 시도)을 누르세요. 앱 안에서는 **Settings → General → App Behavior → Open Android launcher (app or browser)**(설정 → 일반 → 앱 동작 → Android 런처 열기 (앱 또는 브라우저))로 런처에 돌아갈 수 있습니다.

직접 설치했다면 Termux를 열고 다음을 실행하세요.

```bash
cd Marinara-Engine
./start-termux.sh
```

서버를 중지하려면 Termux에서 <kbd>Ctrl</kbd>+<kbd>C</kbd>를 누르세요.

## Marinara 업데이트하기

`./start-termux.sh`를 실행할 때마다 런처는 GitHub에서 새 버전을 확인하고, 시작하기 전에 업데이트합니다. 업데이트 없이 시작하려면 `--skip-update`를 붙이세요. 다른 옵션과 APK 업데이트 단계는 [Marinara Engine 업데이트](../UPGRADING.md#android-termux)를 참고하세요.

런처는 업데이트하는 동안 로컬 pnpm 캐시에서 쓰지 않는 패키지도 정리합니다. 예전 릴리스가 쌓여 저장 공간을 몇 기가바이트씩 차지하는 일을 막아 줍니다. 채팅과 설정은 건드리지 않습니다.

## 다른 기기에서 Marinara 열기

런처는 같은 Wi-Fi에 있는 다른 기기가 Marinara에 접속할 수 있게 하지만, 로그인을 설정하기 전까지는 그 기기들을 막아 둡니다. [자주 묻는 질문](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)과 [원격 접근](../REMOTE_ACCESS.md)을 참고하세요.

업데이트 후 다른 기기에서 로그인할 수 없다면 [업데이트 후 접속이 막혔을 때](../REMOTE_ACCESS.md#locked-out-after-updating)를 참고하세요. Termux에서 다음 명령을 실행하면 앱 로그인이 삭제되고 모든 브라우저에서 로그아웃됩니다.

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## 관련 가이드

- [Marinara Engine 설치](../INSTALLATION.md)
- [iOS / iPadOS PWA 가이드](ios-pwa.md)
- [Marinara Engine 업데이트](../UPGRADING.md)
- [자주 묻는 질문](../FAQ.md)
