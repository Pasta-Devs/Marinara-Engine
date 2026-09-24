# iOS / iPadOS PWA 가이드

이 가이드에서는 iPhone이나 iPad에서 Marinara Engine을 쓰는 방법을 설명합니다. iOS와 iPadOS에서는 Marinara 서버를 기기 안에서 직접 실행할 수 없습니다. 대신 다른 기기에서 돌아가는 서버에 접속한 다음, 그 화면을 홈 화면에 웹 앱으로 저장해서 씁니다.

## 서버는 다른 기기에서 실행합니다

Marinara Engine은 두 부분으로 나뉩니다. 실제 작업을 처리하는 서버와, 브라우저에서 보는 웹 앱입니다. iPhone과 iPad에서는 Apple이 서버 실행을 허용하지 않습니다. 그래서 서버는 다른 곳에서 실행하고, iPhone이나 iPad의 Safari로 그 서버를 엽니다.

서버는 다음 중 어디에서든 실행할 수 있습니다.

- Windows PC([Windows 설치 가이드](windows.md) 참고).
- Mac 또는 Linux 컴퓨터([macOS / Linux 설치 가이드](macos-linux.md) 참고).
- Termux를 설치한 Android 휴대폰([Android (Termux) 설치 가이드](android-termux.md) 참고).
- Docker 또는 Podman 컨테이너([컨테이너로 실행하기](containers.md) 참고).

iPhone이나 iPad는 네트워크를 통해 그 서버에 접속합니다. 웹사이트를 여는 것과 똑같은 방식이고, 그 웹사이트가 직접 돌리는 Marinara 서버라는 점만 다릅니다.

## Safari에서 접속하기

호스트 기기에서 서버가 실행 중인 상태에서 다음 단계를 따르세요.

1. 호스트 기기와 iPhone 또는 iPad가 같은 네트워크에 있는지, 아니면 둘 다 같은 Tailscale 네트워크에 연결되어 있는지 확인하세요. LAN은 집의 Wi-Fi처럼 같은 장소에서 쓰는 내부 네트워크를 뜻합니다. Tailscale은 인터넷을 통해 기기들을 하나의 사설 네트워크로 묶어 주는 무료 도구입니다.
2. 호스트 서버 주소를 확인하세요. 아래 예시와 같은 형태입니다. `<host-ip>` 자리에는 호스트 기기의 LAN 또는 Tailscale IP 주소를 넣으세요. 기본 포트는 `7860`입니다.

```
http://<host-ip>:7860
```

3. iPhone 또는 iPad에서 **Safari**를 여세요.
4. Safari 주소 표시줄에 그 주소를 입력하고 이동하세요.
5. 브라우저에 Marinara 홈 화면이 나타나면 성공입니다.

페이지가 열리지 않거나 비밀번호를 묻는 화면이 나오면 아래 문제 해결 절을 확인하세요. 네트워크 접근과 비밀번호는 서버를 운영하는 쪽에서 관리합니다. 이런 서버 설정은 iPhone이나 iPad가 아니라 [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)에서 다룹니다.

## 홈 화면에 추가하기

Marinara를 PWA로 저장하면 일반 앱처럼 열 수 있습니다. PWA는 Progressive Web App의 줄임말로, 자체 창과 홈 화면 아이콘을 가지고 실행되는 웹사이트를 말합니다.

1. **Safari**에서 Marinara 서버를 여세요(위 단계 참고).
2. 공유 버튼을 누르세요. 위쪽 화살표가 그려진 사각형 아이콘입니다.
3. 공유 시트를 아래로 넘긴 다음 **Add to Home Screen**(홈 화면에 추가)을 누르세요.
4. 이름을 바꾸고 싶으면 바꾼 뒤 **Add**(추가)를 누르세요.
5. 홈 화면에 Marinara 아이콘이 생깁니다.

이 아이콘을 누르면 Safari 주소 표시줄 없이 자체 창에서 Marinara가 열립니다.

## HTTPS 참고 사항

PWA는 HTTPS에서 가장 안정적으로 동작합니다. HTTPS는 암호화된 안전한 웹 연결을 뜻하며, 주소 앞에 붙은 `https://`로 알 수 있습니다.

LAN 안에서 쓰는 일반 HTTP 주소도 Safari에서 평소 사용에는 문제가 없습니다. 다만 iOS나 iPadOS 버전에 따라 일반 `http://` 주소에서는 독립 실행형 PWA 동작이 제한되기도 합니다. 그럴 때는 Marinara를 HTTPS로 제공하세요.

Tailscale은 기기마다 고정된 사설 주소를 주고 접속 성공률을 높여 주지만, Tailscale만으로 `http://` 주소가 HTTPS로 바뀌지는 않습니다. HTTPS를 명시적으로 제공하는 Tailscale 구성을 쓰거나, 서버를 운영하는 쪽에 Marinara를 HTTPS 뒤에 두어 달라고 요청하세요.

이런 방법은 [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)에서 설명합니다. 일반 HTTP 주소로 만든 홈 화면 앱이 말썽을 부린다면, 홈 화면 앱 대신 Safari 북마크로 두는 방법도 있습니다.

## PWA 삭제 후 다시 설치하기

Safari가 예전 버전의 앱을 계속 보여 주거나, 저장해 둔 웹 앱이 먹통이 될 때가 있습니다. 이럴 때는 홈 화면 앱을 다시 설치하면 대개 해결됩니다.

1. 홈 화면의 Marinara 아이콘을 길게 누르세요.
2. 앱을 제거하거나 삭제하는 항목을 누른 뒤 확인하세요.
3. iPhone 또는 iPad에서 **Settings**(설정) 앱을 여세요.
4. **Safari**를 누르세요. 최신 iOS와 iPadOS 버전에서는 **Apps** 안의 **Safari**에 있을 수 있습니다.
5. **Advanced**(고급)를 누른 다음 **Website Data**(웹사이트 데이터)를 누르세요.
6. Marinara 호스트 주소로 된 항목을 찾으세요. 목록에 보이지 않으면 **Show All Sites**(모든 사이트 표시)를 누르세요.
7. 그 항목을 왼쪽으로 밀고 **Delete**(삭제)를 누르세요. 해당 서버의 오래된 저장 파일이 지워집니다.
8. Safari에서 접속하기 단계에 따라 **Safari**에서 Marinara를 다시 여세요.
9. 홈 화면에 추가하기 단계에 따라 홈 화면에 다시 추가하세요.

채팅, 캐릭터, 설정은 iPhone이나 iPad가 아니라 서버에 저장됩니다. 홈 화면 앱을 다시 설치해도 지워지지 않습니다.

## 문제 해결

**Safari에서 페이지가 열리지 않습니다.** 호스트 기기에서 서버가 아직 실행 중인지 확인하세요. 두 기기가 같은 네트워크 또는 같은 Tailscale에 연결되어 있는지도 확인하세요. IP 주소와 포트 `7860`이 맞는지 다시 보세요. 네트워크 문제를 더 깊이 살펴보려면 [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)과 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

**Safari가 사용자 이름과 비밀번호를 묻습니다.** 서버를 운영하는 쪽에서 원격 기기용 비밀번호 보호를 켜 둔 상태입니다. 서버를 운영하는 사람에게 사용자 이름과 비밀번호를 받으세요. 설정 방법은 [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)에서 다룹니다.

**Safari가 예전 빌드를 계속 보여 줍니다.** 먼저 페이지를 새로고침하세요. 그래도 예전 화면 그대로라면 위의 PWA 삭제 후 다시 설치하기 단계를 따르세요.

**생성 중 홈 화면 앱이 닫히거나 빈 화면이 됩니다.** 다시 열어 채팅으로 돌아가세요. 정상인 서버를 다시 시작할 필요는 없습니다. 브라우저 연결이 끊겨도 자동 채팅 답변과 Illustrator만 사용하는 수동 또는 재시도 이미지 요청은 서버에서 계속 실행됩니다. 다시 연 채팅은 미완료 작업을 확인하고, 끝나면 저장된 메시지와 갤러리 이미지를 새로고침합니다. **Stop**(중지)은 계속 선택한 채팅의 생성을 취소합니다. 빈 화면이 반복되면 Support Diagnostics와 다시 열었을 때 채팅이 복구되는지를 보고하세요. 이 복구가 모든 iOS 브라우저 장애를 진단하거나 예방하지는 않습니다.

**저장이 조용히 실패한다는 빨간 배너가 표시됩니다.** iPhone이나 iPad의 문제가 아니라 서버가 보내는 네트워크 신뢰 경고입니다. 서버를 운영하는 쪽에서 접속 주소를 신뢰 목록에 넣어야 합니다. [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)과 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.

**권한이 필요한 작업이 막힙니다.** 일부 관리 작업에는 서버를 운영하는 쪽에서 받은 관리자 시크릿이 필요합니다. iPhone이나 iPad에서는 **Settings**, **Advanced**, **Admin Access**(관리자 접근) 순으로 들어가 그 값을 저장합니다. 관리자 시크릿이 무엇이고 어떻게 받는지는 [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)에서 설명합니다.

## 관련 가이드

- [원격 접근: Basic Auth와 IP 허용 목록](../REMOTE_ACCESS.md)
- [자주 묻는 질문](../FAQ.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
- [Android (Termux) 설치 가이드](android-termux.md)
