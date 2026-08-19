# Marinara Engine 설치

이 가이드에서는 사용 중인 기기에 맞는 Marinara Engine 설치 방법을 고르도록 안내합니다. Marinara는 내 컴퓨터에서 직접 실행되므로 채팅과 데이터가 밖으로 나가지 않습니다. 아래 플랫폼마다 단계별 가이드가 따로 있고, 표에서 바로 연결됩니다.

## 플랫폼 고르기

Marinara를 실행할 기기에 맞는 가이드를 고르세요.

| 플랫폼 | 설치 가이드 |
|---|---|
| Windows | [Windows 설치](installation/windows.md) |
| macOS 또는 Linux | [macOS / Linux 설치](installation/macos-linux.md) |
| Docker 또는 Podman | [컨테이너로 실행하기](installation/containers.md) |
| Android 휴대폰 또는 태블릿 | [APK 다운로드](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) · [Android 설치 가이드](installation/android-termux.md) |
| iPhone 또는 iPad | [iOS / iPadOS](installation/ios-pwa.md) |

고르기 전에 알아 둘 점이 몇 가지 있습니다.

- **iPhone 또는 iPad**에서는 Marinara가 서버를 직접 실행하지 않습니다. 서버는 컴퓨터나 홈 서버, 또는 Android 기기에서 실행하고, iPhone이나 iPad에서는 Safari로 접속합니다. 자세한 방법은 iOS 가이드에서 설명합니다.
- **Android**에서는 Marinara가 **Termux** 안에서 실행됩니다. Termux는 Android에 작은 Linux 환경을 만들어 주는 무료 앱입니다. APK 직접 다운로드를 누르고 Android의 필수 설치 및 Termux 권한 확인을 승인하면 앱이 비공개 localhost 인증 정보를 자동으로 처리합니다. 설치 프로그램은 Android 서명 정보나 이 로컬 비밀 값을 요구하지 않습니다.

## 어떤 방법을 골라야 할까요

처음이라 설정을 최대한 줄이고 싶다면 다음 중 하나를 고르세요.

- **Windows**에서는 **Windows 설치 프로그램**을 쓰세요. 필요한 것을 모두 다운로드해서 설정하고, 바탕 화면 바로 가기까지 만들어 줍니다.
- **Android**에서는 위의 **APK 다운로드** 링크를 쓰세요. 다운로드한 파일을 열고 앱에서 **Install / Start Marinara**를 누르세요.
- **macOS**, **Linux**, 홈 서버에서는 **Docker**를 쓰세요. 명령어 하나로 앱이 실행됩니다. 이미지 안에 Node.js와 모든 의존성, 빌드가 끝난 앱이 들어 있습니다. Node.js를 설치하고 앱을 직접 빌드하는 과정을 건너뛸 수 있습니다.

터미널 사용이 익숙하고 코드를 직접 고칠 생각이라면 소스에서 실행하는 방법을 쓰세요. "소스에서 실행"은 코드를 다운로드해서 내 컴퓨터에서 앱을 빌드한다는 뜻입니다. **Windows**, **macOS 및 Linux**, **Android (Termux)** 가이드에 모두 이 방법이 나와 있습니다.

## 기본 시스템 요건

- 서버를 실행할 수 있는 컴퓨터나 기기가 필요합니다. Windows, macOS, Linux, Android를 지원합니다.
- 소스에서 실행하려면 **Node.js** 24 버전과 **Git**이 필요합니다. Node.js가 앱을 실행하고, Git이 코드를 다운로드하고 업데이트합니다. 두 프로그램의 다운로드 링크는 각 플랫폼 가이드에 있습니다.
- **Docker**와 **Podman**으로 설치할 때는 Node.js가 필요 없습니다. 다만 권장하는 Compose 방식은 프로젝트 파일을 다운로드할 때 Git을 사용합니다. 자세한 내용은 컨테이너 가이드에 있습니다.
- 기본값으로 앱은 내 컴퓨터의 다음 주소에서 실행됩니다.

```text
http://127.0.0.1:7860
```

- `127.0.0.1`은 내 컴퓨터를 가리키는 주소이고, `7860`은 기본 포트입니다. 같은 네트워크에 있는 휴대폰이나 다른 기기에서 Marinara에 접속하려면 [자주 묻는 질문](FAQ.md)의 LAN 접근 부분을 참고하세요.

## 설치 후 다음 단계

Marinara가 실행되고 브라우저에 열렸다면 [Marinara Engine 시작하기](home/welcome.md)를 읽어 보세요. 연결 추가하기, 캐릭터 만들기 또는 가져오기, 채팅 시작하기까지 처음 해야 할 일을 차례대로 안내합니다.

설치한 앱을 나중에도 최신 상태로 유지하는 방법은 [Marinara Engine 업데이트](UPGRADING.md)를 참고하세요.

## 관련 가이드

- [Windows 설치](installation/windows.md)
- [macOS / Linux 설치](installation/macos-linux.md)
- [컨테이너로 실행하기](installation/containers.md)
- [Android (Termux) 설치](installation/android-termux.md)
- [iOS / iPadOS](installation/ios-pwa.md)
- [Marinara Engine 업데이트](UPGRADING.md)
- [Marinara Engine 시작하기](home/welcome.md)
