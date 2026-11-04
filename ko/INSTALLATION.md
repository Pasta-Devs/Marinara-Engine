# Marinara Engine 설치

Marinara는 내 기기에서 실행됩니다. 아래에서 내 기기에 맞는 가이드를 고르세요.

## 플랫폼 고르기

| 내 기기 | 가이드 |
| --- | --- |
| Windows | [Windows 설치](installation/windows.md) |
| macOS 또는 Linux | [macOS / Linux 설치](installation/macos-linux.md) |
| Docker 또는 Podman | [컨테이너로 실행하기](installation/containers.md) |
| Android 휴대폰 또는 태블릿 | [Android 설치 가이드](installation/android-termux.md) |
| iPhone 또는 iPad | [iOS / iPadOS](installation/ios-pwa.md) |

## 어떤 방법을 골라야 하나요?

- **Windows:** Windows 설치 프로그램을 쓰세요. 필요한 것을 모두 설정하고 바탕 화면 바로 가기를 추가합니다.
- **Android:** [APK를 다운로드](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)하세요. 다운로드한 파일을 연 다음 앱에서 **Install / Start Marinara**(Marinara 설치/시작)를 누르세요.
- **macOS, Linux 또는 홈 서버:** 다음 중 하나를 고르세요. 네이티브 가이드는 런처 스크립트로 Marinara를 컴퓨터에서 바로 실행합니다. Docker는 Node.js가 필요 없고 아무것도 빌드하지 않지만, Docker를 먼저 설치해야 합니다.
- **iPhone 또는 iPad:** 이 기기에서는 Marinara 서버를 실행할 수 없습니다. 컴퓨터, 홈 서버 또는 Android 기기에서 실행한 다음 Safari로 여세요. 방법은 iOS 가이드에서 설명합니다.
- **코드를 직접 고치고 싶다면:** 소스에서 실행하세요. 코드를 다운로드해서 내 기기에서 앱을 빌드한다는 뜻입니다. Windows, macOS 및 Linux, Android 가이드에 모두 이 방법이 나와 있습니다.

Android에서 Marinara는 휴대폰에 작은 Linux 시스템을 만들어 주는 무료 Android 앱인 **Termux** 안에서 실행됩니다. APK가 Termux를 대신 설정해 줍니다.

## 필요한 것

- 소스에서 실행하려면 **Node.js** 24, 25 또는 26과 **Git**이 필요합니다. Node.js는 앱을 실행합니다. Git은 코드를 다운로드하고 업데이트합니다. 두 프로그램의 다운로드 링크는 각 플랫폼 가이드에 있습니다.
- Docker나 Podman에는 Node.js가 필요 없습니다. 권장하는 Compose 설정은 프로젝트 파일을 다운로드할 때 Git을 한 번 사용합니다.

## Marinara 열기

Marinara가 실행 중이면 같은 기기의 브라우저에서 다음 주소를 여세요. 다른 기기에서는 이 주소를 쓰지 마세요.

```text
http://127.0.0.1:7860
```

`127.0.0.1`은 이 기기를 뜻합니다. `7860`은 앱이 요청을 받는 번호인 기본 포트입니다. 런처(Marinara를 시작하는 스크립트)는 같은 네트워크의 다른 기기도 Marinara에 접속할 수 있게 하지만, 로그인을 설정하기 전까지 그 기기들은 차단됩니다. Docker나 Podman 설치는 포트 줄을 바꾸기 전까지 이 기기에서만 응답합니다. [컨테이너로 실행하기](installation/containers.md#open-marinara-from-another-device)를 참고하세요.

## 휴대폰에서 Marinara 열기

1. 컴퓨터, 홈 서버 또는 Android 휴대폰에 Marinara를 설치하고 시작하세요.
   Docker나 Podman이라면 먼저 [다른 기기에서 Marinara 열기](installation/containers.md#open-marinara-from-another-device)를 따라 하세요.
2. 그 기기에서 로그인을 설정하세요. [원격 접근](REMOTE_ACCESS.md#option-1-login-recommended)을 참고하세요.
3. 그 기기의 IP 주소를 찾으세요. 방법은 [자주 묻는 질문](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)에 나와 있습니다.
4. 휴대폰에서 `http://` 뒤에 IP 주소와 `:7860`을 붙인 주소를 여세요.

iPhone이라면 [iOS / iPadOS](installation/ios-pwa.md)를 참고하세요.

## 설치 후

연결을 추가하고, 캐릭터를 만들거나 가져오고, 채팅을 시작하려면 [Marinara Engine 시작하기](home/welcome.md)를 읽으세요. 나중에 업데이트하려면 [Marinara Engine 업데이트](UPGRADING.md)를 참고하세요.

## 관련 가이드

- [Windows 설치](installation/windows.md)
- [macOS / Linux 설치](installation/macos-linux.md)
- [컨테이너로 실행하기](installation/containers.md)
- [Android (Termux) 설치](installation/android-termux.md)
- [iOS / iPadOS](installation/ios-pwa.md)
- [Marinara Engine 업데이트](UPGRADING.md)
- [Marinara Engine 시작하기](home/welcome.md)
