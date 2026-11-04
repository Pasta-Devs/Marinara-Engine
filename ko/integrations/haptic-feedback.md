# Haptic Feedback 설정

햅틱 피드백은 채팅 도중 AI 캐릭터가 연결된 햅틱 기기(성인용 토이)에 촉감 신호를 보내는 기능입니다. 이 가이드에서는 보조 앱 설치, 채팅에 **Haptic Feedback** 에이전트 추가, 기기 연결, 촉감 설정 조절 방법을 설명합니다.

Marinara Engine이 기기와 직접 통신하지는 않습니다. 대신 무료 연동 앱인 **Intiface Central**에 명령을 보내고, 그 앱이 기기와 통신합니다. Intiface Central은 여러 토이와 앱이 지원하는 개방형 표준인 **Buttplug.io**를 사용합니다. Marinara는 네트워크 주소로 Intiface Central에 접속합니다. 햅틱 피드백은 채팅 에이전트(채팅에 추가하는 AI 도우미)입니다. Conversation(대화), Roleplay(롤플레이), Game(게임) 모드에서 작동합니다.

## 시작하기 전에

1. `https://intiface.com/central/`에서 **Intiface Central**을 설치하세요.
2. 앱을 열고 서버 시작 버튼으로 서버를 시작하세요.
3. 앱이 기기를 인식할 수 있도록 Intiface Central 안에서 기기를 페어링하세요.

Intiface Central이 실행 중이고 서버가 시작되어 있지 않으면 Marinara는 촉감 신호를 보낼 수 없습니다. **Haptic Feedback** 에이전트도 설치되어 있어야 합니다. [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요.

## Haptic Feedback 에이전트 추가하기

1. Conversation, Roleplay 또는 Game 채팅을 여세요.
2. **Chat Settings**(채팅 설정)를 열고 **Agents**(에이전트)로 이동하세요.
3. **Haptic Feedback** 에이전트를 추가하세요. **Agents** 목록에 **Haptic Feedback** 카드가 나타납니다.
4. 카드 위쪽의 **Haptic Feedback** 토글을 켜세요.

이 토글은 기본값이 꺼짐입니다. 꺼져 있으면 설명에 "Allow this agent to send touch cues during the chat."이라고 표시되고, 켜져 있으면 "Touch cues are enabled for this chat."이라고 표시됩니다. 토글을 켜면 AI가 글을 쓰는 동안 숨은 촉감 신호를 보냅니다. 이 신호는 채팅 텍스트로 표시되지 않으며, 연결된 모든 기기로 전달됩니다.

## 연결과 검색

카드를 열면 Marinara가 저장된 주소로 Intiface Central에 연결을 시도합니다. 상태 줄에는 연결되면 초록색 점이, 연결되지 않으면 빨간색 점이 표시됩니다. 그 옆에는 연결이 끊겨 있을 때 **Connect**(연결), 연결되어 있을 때 **Disconnect**(연결 해제)가 표시됩니다.

1. **Connect**를 클릭하세요. 연결에 성공하면 상태 줄에 "Connected"와 서버 주소가 표시됩니다.
2. 다시 검색하려면 **Scan for devices**(기기 검색)를 클릭하세요. 검색하는 동안 버튼에 "Scanning..."이 표시됩니다.

카드에는 "No devices found" 또는 기기 수가 표시되고, 기기마다 Intiface의 정확한 이름과 지원하는 동작이 나열됩니다. Marinara는 Haptic Agent에도 그 이름, 기능에서 판별한 토이 유형, 지원 동작을 전달합니다. 그래서 Haptic Agent는 모든 토이가 진동한다고 가정하지 않고 올바른 기기와 동작을 고릅니다.

작동하지 않는 경우: 연결에 실패하면 Intiface Central이 실행 중이고 서버가 시작되었는지 확인하라는 메시지가 웹사이트 링크와 함께 표시됩니다.

## 지원 동작과 패턴

Marinara는 Intiface가 기기에 대해 보고하는 모든 출력 유형을 사용합니다. 진동, 회전, 왕복 운동, 수축, 팽창, 선형 위치, 온도, 분사, 조명입니다. 선형 위치는 스트로크, 밀기, 펌프 동작 기기를 제어하고, 팽창은 공기압 펌프 기기를 제어합니다.

에이전트는 정지 이외의 모든 동작에 **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp**, **Impact** 패턴을 적용할 수 있습니다. 위치 패턴은 실제 이동 목표를 번갈아 지정하므로, 펌프나 스트로크 패턴이 여러 움직임을 한꺼번에 보내지 않고 시간에 따라 실행됩니다.

## Intiface URL 입력란

**Intiface URL**은 Intiface Central 서버의 WebSocket 주소입니다. WebSocket 주소는 두 앱이 서로 통신하는 데 쓰는 연결 주소입니다. 기본값은 다음과 같습니다.

```text
ws://127.0.0.1:12345
```

`127.0.0.1`은 지금 쓰고 있는 이 컴퓨터를 뜻합니다. 입력란을 비워 두면 Marinara는 서버 기본값을 사용하며, 이 기본값은 `.env`의 `INTIFACE_URL` 환경 변수로 바꿀 수 있습니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요. Marinara는 주소를 채팅과 함께 저장하고 이 브라우저에도 기억해 두므로, 여기서 여는 다른 채팅도 그 주소로 시작합니다.

주소는 이 Marinara 설치에만 남습니다. 채팅 내보내기, 내보낸 설정 프로필, **Export Profile**(프로필 내보내기) 파일에는 들어가지 않으며, 이런 파일을 가져와도 주소가 설정되지 않습니다. 채팅을 다른 설치로 옮긴 뒤에는 주소를 다시 입력하세요.

Marinara를 Docker로 실행하거나 다른 기기의 브라우저에서 열면 `127.0.0.1`로는 Intiface Central에 닿지 않습니다. Intiface Central을 실행하는 컴퓨터의 주소를 입력하세요. 숫자 부분은 그 컴퓨터의 실제 주소로 바꾸세요.

```text
ws://192.168.1.50:12345
```

## 터치 감도

카드에는 모든 채팅 모드에서 **Touch sensitivity**(터치 감도) 컨트롤이 표시됩니다. 이 컨트롤은 에이전트가 부드러운 출력과 강한 출력을 얼마나 쉽게 고를지 안내합니다. 상한은 아닙니다. 동작에 필요하면 어느 선택지든 전체 `0.0-1.0` 강도 범위를 사용할 수 있습니다. Marinara는 모든 명령을 Intiface의 물리적 범위에 맞춰 검증합니다.

| 선택지 | 느낌 |
|---|---|
| **Subtle**(약하게) | 더 부드러운 피드백을 선호합니다. |
| **Standard**(표준) | 대부분의 장면에 어울리는 균형 잡힌 피드백입니다. 기본값입니다. |
| **Intense**(강하게) | 강한 피드백을 더 쉽게 고릅니다. |

## 우발적 접촉

**Incidental contact**(우발적 접촉) 토글("Tiny taps for accidental brushes and bumps.")은 기본값이 꺼짐입니다. 꺼져 있으면 AI는 작은 우발적 접촉을 무시하고 의도적이거나 확실한 접촉에만 신호를 보냅니다. 스치거나 부딪히는 접촉에도 작은 탭 신호를 받으려면 켜세요.

<a id="use-it-from-another-device"></a>

## 다른 기기에서 사용하기

기본적으로 Marinara는 Marinara 서버를 실행하는 컴퓨터에서 보낸 햅틱 명령만 받아들입니다. 기기 제어를 비공개로 유지하기 위해서입니다. 그래서 다른 곳에 있는 서버에 접속하는 휴대폰이나 다른 기기에서 Marinara를 열면 햅틱 피드백이 작동하지 않습니다. 연결, 검색, 명령 동작이 모두 거부됩니다.

허용하려면 서버 설정 `HAPTICS_ALLOW_REMOTE`를 켜고, 로그인이나 관리자 시크릿 같은 접근 보호를 설정하세요. [서버 설정 참고 문서](../CONFIGURATION.md)와 [원격 접근](../REMOTE_ACCESS.md) 가이드를 참고하세요. 관리자 접근 정보는 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)에서 입력합니다.

## 잘 작동하지 않을 때

AI가 기기를 전혀 작동시키지 않으면 다음을 순서대로 확인하세요.

1. Intiface Central이 열려 있고 서버가 시작되었는지 확인하세요.
2. 기기가 페어링되어 있고, **Scan for devices**를 클릭한 뒤 목록에 나타나는지 확인하세요.
3. 상태 점이 초록색이고 **Haptic Feedback** 토글이 켜져 있는지 확인하세요.
4. 휴대폰이나 원격 기기에서 쓰고 있다면 [다른 기기에서 사용하기](#use-it-from-another-device)를 참고하세요.

Intiface Central이 연결되지 않았거나 연결된 기기가 없으면 Marinara는 신호를 조용히 건너뛰고 채팅에 오류를 표시하지 않습니다.

## 관련 가이드

- [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)
- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)
