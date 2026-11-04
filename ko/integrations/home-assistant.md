# Home Assistant 연동

이 연동을 사용하면 AI 캐릭터가 채팅에서 조명, 냉난방, 커버, 미디어 플레이어 같은 실제 스마트홈 기기를 조작할 수 있습니다. Home Assistant 자동화가 Marinara Engine으로 메시지를 보낼 수도 있습니다. Home Assistant는 스마트홈 기기를 위한 무료 오픈 소스 플랫폼입니다. Home Assistant를 쓰지 않는다면 이 가이드는 필요 없습니다.

## 연동으로 추가되는 것

연동 기능은 Home Assistant 안에 설치되어 Home Assistant와 Marinara 서버를 이어 주는 작은 프로그램입니다. 처음 설정할 때 다음 항목을 자동으로 만듭니다. 도구 주소를 복사하거나 도구를 직접 설정할 일은 없습니다.

- Presets 패널의 **Functions**(기능) 섹션에 들어가는 스마트홈 도구. [사용자 지정 도구](../extending/custom-tools.md)를 참고하세요.
- **Home Assistant**라는 이름의 에이전트 하나. 에이전트는 채팅과 함께 실행되는 AI 도우미입니다. [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요.
- Home Assistant에서 Marinara를 살펴보고 제어할 수 있게 해 주는 Home Assistant 엔티티(기기, 센서, 컨트롤).

## 시작하기 전에

- Home Assistant 버전 2024.1.0 이상.
- Home Assistant에 설치된 HACS. HACS는 Home Assistant Community Store로, 사용자 지정 연동을 설치하는 도구입니다.
- 실행 중이며 Home Assistant가 돌아가는 컴퓨터에서 접근할 수 있는 Marinara. 기본 주소는 `localhost:7860`입니다.
- Marinara의 `.env` 파일에 설정한 `WEBHOOK_LOCAL_URLS_ENABLED=true`.

`.env` 파일은 Marinara 서버의 설정을 담은 일반 텍스트 파일입니다. 파일 위치는 [서버 설정](../CONFIGURATION.md)을 참고하세요. 연동 기능은 웹훅을 씁니다. 웹훅은 한 앱이 다른 앱으로 데이터를 보낼 수 있게 해 주는 웹 주소입니다. Home Assistant의 웹훅은 암호화되지 않은 로컬 `http` 주소인데, Marinara는 안전을 위해 이런 주소를 기본적으로 차단합니다. 이 설정은 그런 주소를 허용합니다. 다음 줄을 추가하고 저장하세요. 다시 시작하지 않아도 보통 몇 초 안에(최대 약 30초) 적용됩니다.

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### Home Assistant가 다른 기기에서 돌아가는 경우

연동 기능은 사용자 이름이나 비밀번호 없이 접속하며, 설정 양식에도 이를 입력하는 칸이 없습니다.

- 같은 컴퓨터: 별다른 작업 없이 바로 연결됩니다.
- 다른 기기: Marinara가 기본적으로 연결을 차단합니다. `.env`의 `IP_ALLOWLIST`에 그 기기의 IP 주소(네트워크에서 기기를 가리키는 숫자 주소)를 추가하세요. 완전히 신뢰할 수 있는 가정용 네트워크라면 대신 `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true`로 설정해도 됩니다.
- Marinara가 `BASIC_AUTH_USER`와 `BASIC_AUTH_PASS`(로그인)를 쓰면 연동 기능은 로그인할 수 없습니다. 이때는 같은 컴퓨터나 `IP_ALLOWLIST`에 있는 기기에서만 동작합니다.

어떤 방법을 고를지는 [원격 접근](../REMOTE_ACCESS.md)을 참고하세요.

## 연동 기능 설치하기

### HACS에 추가하기

1. Home Assistant에서 **HACS**를 여세요.
2. 점 세 개 메뉴를 열고 **Custom repositories**를 클릭하세요.
3. 저장소 입력란에 `https://github.com/Pasta-Devs/Marinara-Engine`을 입력하세요.
4. 카테고리를 **Integration**으로 지정하고 **Add**를 클릭하세요.
5. **Marinara Engine**을 검색해 설치하세요.
6. Home Assistant를 다시 시작하세요.

### 설정하기

1. **Settings → Devices & Services**로 이동해 **Add Integration**을 클릭하세요.
2. **Marinara Engine**을 검색하세요.
3. Marinara가 실행 중인 **Host**와 **Port**를 입력하세요. 기본값은 `localhost`와 `7860`입니다.
4. **Submit**을 클릭하세요.

작동하지 않는 경우: Home Assistant가 Marinara에 접근할 수 없으면 오류를 표시합니다. [문제 해결](#troubleshooting)을 참고하세요.

설정에 성공하면 연동 기능이 Home Assistant에 비공개 웹훅을 등록하고, 그 웹훅을 가리키는 도구를 Marinara의 **Functions** 섹션에 만들고, 활성화된 도구를 모두 담은 **Home Assistant** 에이전트를 만들고, 아래에서 설명하는 엔티티를 만듭니다.

## 채팅에 에이전트 추가하기

에이전트를 만들었다고 해서 모든 채팅에 붙지는 않습니다. 스마트홈을 제어하려는 채팅마다 추가하세요.

1. 채팅을 열고 **Chat Settings**(채팅 설정)를 클릭하세요.
2. **Agents**(에이전트) 섹션을 여세요.
3. **Home Assistant** 에이전트를 추가하세요.

Roleplay(롤플레이), Conversation(대화), Game Mode(게임 모드) 채팅에서 동작합니다. 추가하고 나면 그 채팅의 AI가 도구를 쓸 수 있습니다. 따로 켜야 하는 항목은 없습니다.

### 작동하는지 확인하기

1. 그 채팅에 `Turn on the office lights`처럼 평범한 요청을 입력해 보내세요.
2. AI가 `ha_turn_on` 같은 도구를 호출하고 조명이 켜져야 하며, 그다음 AI가 결과를 알려 줍니다.

아무 반응이 없으면 `WEBHOOK_LOCAL_URLS_ENABLED=true`가 설정되어 있는지 확인하고 [문제 해결](#troubleshooting)을 참고하세요.

## AI가 쓸 수 있는 도구 고르기

도구는 8가지 카테고리로 나뉩니다. Marinara가 쓸 수 있는 카테고리를 고르려면 **Settings → Devices & Services**를 열고 **Marinara Engine**을 클릭한 다음 **Configure**를 클릭하세요. 옵션은 두 가지입니다.

- **Primary Chat**: Home Assistant 서비스가 기본으로 대상으로 삼는 채팅입니다.
- **Exposed Tool Categories**: Marinara가 쓸 수 있는 카테고리입니다.

| 카테고리 | 기본값 | 도구 |
|---|---|---|
| Lights & Switches | 켜짐 | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate | 켜짐 | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) | 켜짐 | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks | 꺼짐 | ha_lock, ha_unlock |
| Media Players | 켜짐 | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts | 켜짐 | ha_activate_scene, ha_run_script |
| Query | 켜짐 | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) | 꺼짐 | ha_call_service |

> **경고:** **Generic Service Calls (Advanced)**는 AI가 Home Assistant의 어떤 서비스든 호출할 수 있게 합니다. **Locks**는 AI가 문을 잠그고 열 수 있게 합니다. 둘 다 기본적으로 꺼져 있습니다. 원할 때만 켜세요.

대부분의 도구는 기기 하나나 방 이름을 받습니다. 방 이름을 주면 그 방에서 일치하는 모든 기기에 동작합니다. 카테고리 변경은 **Marinara Sync HA Tools**를 누르거나 Home Assistant를 다시 시작하면 적용됩니다.

## Home Assistant 엔티티

연동 기능은 **Marinara Engine**이라는 이름의 기기 아래에 다음 엔티티를 만듭니다.

| 엔티티 | 종류 | 하는 일 |
|---|---|---|
| Marinara Chat Count | Sensor | Marinara 채팅의 총 개수 |
| Marinara Active Agent Count | Sensor | 활성화된 Marinara 에이전트 수 |
| Marinara Active Chat | Select | 서비스가 대상으로 삼을 채팅을 고릅니다 |
| Marinara Agent: (name) | Switch | 에이전트 하나를 켜거나 끕니다. 에이전트마다 스위치가 하나씩 있습니다 |
| Marinara Abort Generation | Button | 생성 중인 AI 응답을 취소합니다 |
| Marinara Sync HA Tools | Button | 모든 도구를 다시 보내고 Home Assistant 에이전트를 다시 만듭니다 |

연동 기능은 30초마다 Marinara에 새 채팅과 에이전트가 있는지 확인하므로, 방금 만든 항목은 나타나기까지 최대 30초가 걸릴 수 있습니다.

### 설정을 바꾼 뒤 동기화하기

**Marinara Engine** 기기 페이지에서 **Marinara Sync HA Tools**를 누르세요. 기존 도구를 그 자리에서 갱신하고, **Home Assistant** 에이전트를 삭제했다면 다시 만들고, 카테고리를 끈 도구는 비활성화합니다(삭제하지는 않습니다). Marinara에서 Home Assistant 도구를 직접 편집하지 마세요. 다음 동기화 때 편집 내용을 덮어쓰고 도구를 다시 켭니다.

## 자동화로 Marinara 제어하기

연동 기능은 자동화에 쓸 Home Assistant 서비스를 두 개 추가합니다. 이 서비스는 Marinara가 아니라 Home Assistant 안에서 실행됩니다. 둘 다 기본적으로 **Primary Chat**을 대상으로 삼습니다.

### Send Message (marinara_engine.send_message)

- `message`: 메시지 본문입니다. 필수 항목입니다.
- `chat_id`: 메시지를 보낼 채팅입니다. 비워 두면 Primary Chat을 씁니다.
- `role`: `user`, `assistant`, `system`, `narrator` 중 하나입니다. 기본값은 `user`입니다.
- `trigger_generation`: true이면 AI도 답변합니다. 기본값은 false입니다.

다음 자동화는 현관문이 열리면 AI에 알려 줍니다.

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

눈에 보이는 메시지 없이 AI 답변을 시작합니다.

- `chat_id`: 대상 채팅입니다. 비워 두면 Primary Chat을 씁니다.
- `user_message`: 답변 차례에 함께 넣을 메시지입니다. 선택 사항입니다.

<a id="troubleshooting"></a>

## 문제 해결

### 설정 양식에서 연결할 수 없다고 나옵니다

Marinara가 실행 중인지, **Host**와 **Port**가 Marinara가 수신 중인 주소와 일치하는지 확인하세요(기본값 `localhost`와 `7860`). Home Assistant가 다른 기기에 있으면 그 기기가 `IP_ALLOWLIST`에 없는 한 Marinara가 차단합니다. 연동 기능은 비밀번호를 보낼 수 없으므로 로그인으로 보호된 Marinara도 연동 기능을 거부합니다. [원격 접근](../REMOTE_ACCESS.md)을 참고하세요. 이 규칙은 설정을 마친 뒤에도 적용됩니다. 나중에 Marinara가 그 기기를 차단하면 센서와 채팅 목록이 조용히 갱신을 멈춥니다.

### AI가 기기 도구를 쓰려고 하는데 아무 일도 일어나지 않습니다

웹훅 호출이 차단되었을 가능성이 큽니다. `.env`에 `WEBHOOK_LOCAL_URLS_ENABLED=true`를 추가하고 저장하세요. 이 설정이 없으면 `http`가 허용되지 않는다거나 사설 주소가 거부되었다는 메시지와 함께 도구 호출이 실패할 수 있습니다. Marinara와 Home Assistant가 같은 컴퓨터에 있으면 연동 기능이 내부 주소를 자동으로 씁니다. Marinara가 다른 기기에 있다면 그 기기에서 Home Assistant의 로컬 주소에 접근할 수 있는지 확인하세요.

### Functions에 도구가 나타나지 않습니다

**Marinara Sync HA Tools**를 누르거나 Home Assistant를 다시 시작한 다음 Presets 패널의 **Functions**를 확인하세요.

### 채팅에 Home Assistant 에이전트가 없습니다

Marinara의 Agents에 그 에이전트가 있는지 확인하세요. 없다면 **Marinara Sync HA Tools**를 눌러 다시 만드세요. 그런 다음 **Chat Settings → Agents**에서 에이전트를 추가하세요.

### 웹훅 주소 직접 찾기

각 도구에 주소가 이미 들어 있으므로 이 주소가 필요한 경우는 드뭅니다. Home Assistant에서 **Settings → Devices & Services → Marinara Engine**을 여세요. 웹훅은 다음 형태를 씁니다. 여기서 8123은 Home Assistant의 기본 포트입니다.

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## 제거하기

Home Assistant의 **Settings → Devices & Services → Marinara Engine**에서 연동을 삭제하세요. 그러면 엔티티가 사라집니다. Marinara의 **Functions** 섹션에 있는 도구와 **Home Assistant** 에이전트는 남습니다. 더 이상 필요 없다면 Marinara에서 직접 삭제하세요.

## 관련 가이드

- [사용자 지정 도구](../extending/custom-tools.md)
- [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)
- [서버 설정](../CONFIGURATION.md)
- [원격 접근](../REMOTE_ACCESS.md)
