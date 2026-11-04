# iOS / iPadOS PWA 가이드

이 가이드에서는 iPhone이나 iPad에서 Marinara Engine을 쓰는 방법을 설명합니다. Apple은 이 기기들에서 Marinara 서버를 실행하는 것을 허용하지 않으므로, 다른 기기에서 실행되는 서버를 Safari로 엽니다. 그런 다음 홈 화면에 PWA로 저장할 수 있습니다. PWA(Progressive Web App)는 앱처럼 자체 창에서 열리는 웹사이트입니다.

## 빠른 시작

1. 컴퓨터, 홈 서버, Android 휴대폰 중 하나에 Marinara를 설치하고 시작하세요(아래 목록 참고). 계속 실행해 두세요.
2. 그 컴퓨터에서 로그인을 설정하세요. [원격 접근](../REMOTE_ACCESS.md#option-1-login-recommended)을 참고하세요.
3. 그 컴퓨터의 IP 주소를 확인하세요(아래 참고).
4. iPhone이나 iPad에서 **Safari**를 열고, `http://` 뒤에 그 IP 주소와 `:7860`을 붙인 주소로 이동하세요.

iPhone이나 iPad에서는 `127.0.0.1`을 쓰지 마세요. 이 주소는 iPhone 자신을 가리킵니다.

## 서버를 실행하는 곳

서버는 다음에서 실행할 수 있습니다.

- Windows PC: [Windows 설치 가이드](windows.md).
- Mac 또는 Linux 컴퓨터: [macOS / Linux 설치 가이드](macos-linux.md).
- Termux를 설치한 Android 휴대폰: [Android (Termux) 설치 가이드](android-termux.md).
- Docker 또는 Podman 컨테이너: [컨테이너로 실행하기](containers.md).

## Safari에서 접속하기

시작하기 전에: 서버가 실행 중이어야 하고, 내 기기의 접속을 허용해야 합니다. 보통은 로그인으로 허용합니다. [원격 접근](../REMOTE_ACCESS.md)을 참고하세요.

1. 서버 기기와 iPhone 또는 iPad를 집의 Wi-Fi처럼 같은 네트워크에 연결하세요. 다른 곳에서 접속하려면 Tailscale을 쓰세요. Tailscale은 인터넷을 통해 기기들을 하나의 사설 네트워크로 묶어 주는 무료 도구입니다.
2. 서버 기기의 IP 주소를 확인하세요. 서버 컴퓨터의 터미널(명령을 입력하는 창)에서 명령 하나를 실행하고, `192.168.1.42`와 같은 형태의 주소를 읽으세요.

   - Windows(Command Prompt): `ipconfig`. **IPv4 Address**(IPv4 주소)를 읽으세요.
   - Linux: `hostname -I`.
   - macOS: `ipconfig getifaddr en0`.

3. **Safari**를 열고 다음 주소로 이동하세요. `<host-ip>`는 그 IP 주소로 바꾸세요. 기본 포트는 `7860`입니다.

```text
http://<host-ip>:7860
```

4. Marinara 홈 화면이 나타납니다.

로그인 페이지가 보이면 서버의 사용자 이름과 비밀번호로 로그인하세요. 설정 페이지가 보이면 서버 로그에 나온 1회용 설정 코드를 입력하고 사용자 이름과 비밀번호를 정하세요. [원격 접근](../REMOTE_ACCESS.md)을 참고하세요.

작동하지 않는 경우: 서버가 아직 실행 중인지, 두 기기가 같은 네트워크나 Tailscale에 연결되어 있는지 확인하세요. IP 주소와 포트도 확인하세요. [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

## 홈 화면에 추가하기

1. **Safari**에서 Marinara 서버를 여세요.
2. 공유 버튼을 누르세요. 위쪽 화살표가 그려진 사각형 아이콘입니다.
3. 공유 시트를 아래로 스크롤해 **Add to Home Screen**(홈 화면에 추가)을 누르세요.
4. 이름을 바꾸고 싶으면 바꾼 뒤 **Add**(추가)를 누르세요.

홈 화면에 Marinara 아이콘이 생깁니다. 이 아이콘을 누르면 Safari 주소 표시줄 없이 자체 창에서 Marinara가 열립니다.

## 앱이 이상하게 동작하면 HTTPS 쓰기

PWA는 `https://`로 시작하는 안전한 연결인 HTTPS에서 가장 잘 동작합니다. 일반 `http://` 주소도 Safari에서는 동작합니다. 다만 일부 iOS와 iPadOS 버전은 일반 `http://` 주소의 홈 화면 앱을 제한합니다. 그럴 때는 Marinara를 HTTPS로 제공하거나, Safari 북마크로 두고 쓰세요.

Tailscale만으로는 주소가 HTTPS가 되지 않습니다. HTTPS를 제공하는 Tailscale 구성을 쓰거나, 서버 운영자에게 Marinara를 HTTPS 뒤에 두어 달라고 요청하세요. [원격 접근](../REMOTE_ACCESS.md#serving-over-https)을 참고하세요.

<a id="clearing-and-reinstalling-the-pwa"></a>

## PWA 지우고 다시 설치하기

Safari가 예전 버전의 앱을 계속 보여 주거나, 저장해 둔 앱이 멈춰 버릴 때가 있습니다. 다시 설치하면 대개 해결됩니다. 채팅, 캐릭터, 설정은 서버에 있으므로 다시 설치해도 지워지지 않습니다.

1. 홈 화면의 Marinara 아이콘을 길게 누르세요.
2. 앱을 제거하는 항목을 누른 뒤 확인하세요.
3. iPhone 또는 iPad에서 **Settings**(설정) 앱을 여세요.
4. **Safari**를 누르세요. 최신 iOS와 iPadOS 버전에서는 **Apps**를 누른 다음 **Safari**를 눌러야 할 수 있습니다.
5. **Advanced**(고급)를 누른 다음 **Website Data**(웹사이트 데이터)를 누르세요.
6. Marinara 주소로 된 항목을 찾으세요. 보이지 않으면 **Show All Sites**(모든 사이트 표시)를 누르세요.
7. 그 항목을 왼쪽으로 밀고 **Delete**(삭제)를 누르세요.
8. **Safari**에서 Marinara를 다시 열고, 위의 단계에 따라 홈 화면에 다시 추가하세요.

## 문제 해결

**Safari에서 페이지가 열리지 않습니다.** 서버가 실행 중인지, 두 기기가 같은 네트워크나 Tailscale에 연결되어 있는지, IP 주소와 포트 `7860`이 맞는지 확인하세요. [원격 접근](../REMOTE_ACCESS.md)과 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

**업데이트 후 Safari에 로그인 또는 설정 페이지가 나옵니다.**

- `/login`에서 서버의 사용자 이름과 비밀번호로 로그인하세요.
- 로그인이 없다면 서버 로그에 나온 1회용 설정 코드를 설정 페이지에 입력하세요.
- 서버가 코드를 출력하지 않는다면 서버 기기의 **Settings → Advanced → Access**(설정 → 고급 → 접근)에서 로그인을 설정하세요.
- **403**은 iPhone이 `IP_ALLOWLIST`에 없다는 뜻일 수 있습니다. 그 목록은 서버 운영자가 바꿉니다.
- PWA에서는 서버 로그인을 초기화할 수 없습니다. 서버 운영자가 서버의 Marinara 폴더에서 `node scripts/reset-login.mjs`를 실행하거나(Docker에서는 `docker exec <container> node scripts/reset-login.mjs`), `.env`로 설정한 로그인을 바꿔야 합니다.

[업데이트 후 접속이 막혔을 때](../REMOTE_ACCESS.md#locked-out-after-updating)를 참고하세요.

**Safari가 예전 빌드를 계속 보여 줍니다.** 페이지를 다시 불러오세요. 그래도 예전 모습이면 위의 단계에 따라 PWA를 다시 설치하세요.

**생성 중 홈 화면 앱이 닫히거나 빈 화면이 됩니다.** 앱을 다시 열고 채팅으로 돌아가세요. 정상인 서버는 계속 작업합니다. 채팅 답변과 Illustrator 이미지 요청은 서버에서 계속 실행되고, 다시 연 채팅은 작업이 끝나면 새로 고쳐집니다. **Stop**(중지)은 여전히 선택한 채팅의 생성을 취소합니다. 빈 화면이 계속 반복되면 Support Diagnostics(지원 진단 정보)와 함께 보고하세요.

**저장이 조용히 실패한다는 빨간 배너가 표시됩니다.** iPhone이나 iPad의 문제가 아니라 서버가 보내는 네트워크 신뢰 경고입니다. 서버 운영자가 내 주소를 신뢰하도록 설정해야 합니다. [원격 접근](../REMOTE_ACCESS.md#why-is-my-save-blocked-csrf)을 참고하세요.

**권한이 필요한 작업이 막힙니다.** 일부 관리 작업에는 서버 운영자에게 받은 관리자 시크릿(두 번째 비밀번호)이 필요합니다. iPhone이나 iPad의 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)에 저장하세요. [원격 접근](../REMOTE_ACCESS.md#admin-access-and-privileged-actions)을 참고하세요.

## 관련 가이드

- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)
- [자주 묻는 질문](../FAQ.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
- [Android (Termux) 설치 가이드](android-termux.md)
