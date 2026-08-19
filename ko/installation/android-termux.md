# Android (Termux) 설치 가이드

이 가이드에서는 Android 휴대폰이나 태블릿에서 Marinara Engine을 실행하는 방법을 설명합니다. Marinara는 Android용 무료 Linux 환경인 Termux 안에서 돌아갑니다. Android 앱으로 간편하게 설치할 수도 있고, Termux 터미널에서 직접 설치할 수도 있습니다.

## Termux와 F-Droid란

Termux는 휴대폰에 작은 Linux 시스템과 명령줄을 만들어 주는 무료 앱입니다. Marinara Engine은 Android 네이티브 앱이 아니라 Linux 서버라서 Termux가 필요합니다.

F-Droid는 Android용 무료 오픈 소스 앱 스토어입니다. Marinara 자동 설정은 안정적인 Termux F-Droid 빌드를 다운로드합니다. Termux에는 별도의 실험적인 Google Play 빌드도 있습니다. 이미 설치되어 있다면 Marinara가 공식 서명자를 인식하지만 이 가이드에서는 여전히 F-Droid를 권장합니다.

Termux는 여기에서 설치하세요: [F-Droid의 Termux](https://f-droid.org/en/packages/com.termux/). 서명이 일치해야 하므로 Termux나 플러그인 앱을 서로 다른 출처에서 섞지 마세요. 출처별 자세한 내용은 [Termux 공식 설치 안내](https://github.com/termux/termux-app#installation)를 참고하세요.

## Android 앱(APK)으로 설치하기

가장 간단한 방법은 Marinara Engine Android 앱을 쓰는 것입니다. APK는 Android 앱 설치 파일입니다. 이 앱은 작은 도우미 역할을 합니다. Termux를 대신 설정해 주고, 로컬 서버가 켜지면 Marinara를 열어 줍니다. 실제 작업은 여전히 Termux가 하기 때문에 Android가 몇 가지 시스템 확인 창을 띄웁니다. 미리 빌드된 APK 설치에는 서명 키, 비밀번호, 로컬 접근 비밀 값, `CSRF_TRUSTED_ORIGINS` 변경이 필요하지 않습니다. 앱이 비공개 localhost 인증 정보를 자동으로 생성하고 교환합니다. `CSRF_TRUSTED_ORIGINS`에 `null`을 추가하지 마세요. 의도적으로 설정되지 않은 값으로 취급되며 APK 핸드셰이크에 필요하지 않습니다.

1. [최신 Android APK 다운로드](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)를 누르세요.
2. APK를 설치한 다음 앱을 여세요.
3. **Install / Start Marinara**(Marinara 설치/시작)를 누르세요.
4. Termux가 아직 설치되어 있지 않다면 Android의 설치 확인 창을 승인하세요. 그래야 앱이 F-Droid에서 Termux를 다운로드해 설치할 수 있습니다.
5. Android가 물어보면 **Run commands in Termux environment**(Termux 환경에서 명령 실행) 권한을 허용하세요.
6. Termux가 설정을 막는다면 앱이 `allow-external-apps` 명령을 대신 복사해 줍니다. 그 명령을 Termux에 한 번 붙여넣은 다음 **Install / Start Marinara**를 다시 누르세요.
7. Termux가 의존성을 설치하고 Marinara를 빌드할 때까지 기다리세요. 첫 빌드는 몇 분 걸립니다.
8. Termux 작업이 끝나면 Marinara Engine 앱으로 돌아오세요. 로컬 서버가 준비되면 앱이 자동으로 연결하고 로그인합니다.

일반 앱처럼 홈 화면 아이콘으로 Marinara를 열고 싶다면 이 Android 앱이 그 아이콘을 제공합니다. Termux 서버를 감싸는 껍데기이므로 서버를 먼저 설정해야 합니다. Android의 설치 확인 창과 권한 요청을 건너뛰지는 못하지만 Marinara 설치 비밀 값을 설정하라고 요구하지 않습니다.

## Termux에서 직접 설치하기

앱을 쓰고 싶지 않다면 Marinara를 직접 설치할 수 있습니다. Termux를 열고 다음 명령 하나를 붙여넣으세요:

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

이 명령 하나가 5가지 일을 처리합니다:

1. Termux 패키지를 업데이트합니다.
2. Git과 Node.js를 설치합니다. Marinara는 Node.js 24, 25, 26 버전을 지원합니다.
3. 아직 설치되어 있지 않다면 Marinara Engine을 다운로드합니다.
4. 런처(`start-termux.sh`)를 실행 가능한 상태로 만듭니다.
5. 런처를 처음으로 실행합니다.

런처는 앱의 의존성을 설치하고 기기에서 Marinara를 빌드한 뒤 로컬 서버를 시작합니다. Node.js 버전이 너무 낮으면 업데이트도 함께 처리합니다. 첫 실행은 앱을 빌드하느라 느리지만 이후 실행은 훨씬 빠릅니다.

작업이 끝나면 Android 브라우저에서 다음 주소를 여세요:

```
http://127.0.0.1:7860
```

Marinara는 `PORT`(앱이 사용하는 네트워크 포트)에 지정된 포트에서 요청을 받습니다. 기본값은 7860입니다. `PORT`를 다른 값으로 설정했다면 그 번호를 쓰세요.

팁: 앱 같은 아이콘을 만들려면 브라우저 메뉴를 열고 Marinara를 홈 화면에 추가하는 항목을 선택하세요. 정확한 메뉴 이름은 브라우저마다 다릅니다.

## Marinara 다시 시작하기

처음 설정을 마친 뒤에는 설치를 반복할 필요가 없습니다. Termux를 열고 다음을 실행하세요:

```
cd Marinara-Engine
./start-termux.sh
```

런처는 업데이트를 확인한 다음 Marinara를 시작합니다. GitHub를 확인하지 않고 현재 설치본을 바로 시작하려면 `--skip-update`를 붙이세요:

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

런처는 의존성을 업데이트하는 동안 로컬 pnpm 캐시에서 더 이상 참조되지 않는 패키지도 정리합니다. 예전 릴리스가 쌓여 휴대폰 저장 공간을 몇 기가바이트씩 차지하는 일을 막아 줍니다. Marinara의 채팅, 설정을 비롯한 사용자 데이터는 건드리지 않습니다.

## 다른 기기에서 접근하기

런처는 기본적으로 로컬 네트워크에서 Marinara에 접근할 수 있게 합니다. 같은 Wi-Fi에 연결된 노트북이나 다른 휴대폰에서 열 수 있다는 뜻입니다. 알맞은 주소를 찾는 단계별 안내는 [자주 묻는 질문](../FAQ.md)을 참고하세요.

## 업데이트

런처(`./start-termux.sh`)를 실행할 때마다 GitHub에 새 버전이 있는지 확인하고 업데이트한 뒤 시작합니다. 그래서 최신 상태를 유지하는 가장 쉬운 방법은 평소처럼 Marinara를 시작하는 것입니다.

설치된 상태 그대로 업데이트 없이 시작하려면 건너뛰기 플래그를 쓰세요:

```
./start-termux.sh --skip-update
```

실행할 때마다 설치된 Engine 버전을 그대로 유지하려면 프로젝트의 `.env`에 `AUTO_UPDATE_ENABLED=false`를 추가하세요. 이렇게 해도 수동 업데이트 명령이나 **Settings → Advanced → Updates**는 그대로 쓸 수 있습니다.

앱 안에서 업데이트를 확인할 수도 있습니다. **Settings**(설정)를 열고 **Advanced**(고급) 탭으로 이동한 다음 **Updates**(업데이트) 섹션을 여세요. **Check for Updates**(업데이트 확인)를 클릭하면 새 릴리스가 있는지 확인할 수 있습니다. 앱 안의 **Apply Update**(업데이트 적용) 버튼은 기본적으로 꺼져 있고 별도 설정이 필요합니다. 활성화하고 사용하는 방법은 [Marinara Engine 업데이트](../UPGRADING.md)를 참고하세요.

## 관련 가이드

- [Marinara Engine 설치](../INSTALLATION.md)
- [iOS / iPadOS PWA 가이드](ios-pwa.md)
- [Marinara Engine 업데이트](../UPGRADING.md)
- [자주 묻는 질문](../FAQ.md)
