# 개인 확장

Personal Extension(개인 확장)은 Marinara에 버튼, 패널, 도우미 기능을 추가하는 작은 코드입니다. Professor Mari가 대신 작성해 줄 수 있으며, 실행할지는 언제나 직접 정합니다. 이 가이드에서는 확장을 검토하고, 활성화하고, 내보내고, 복구하는 방법을 설명합니다. 직접 작성하려면 [Personal Extensions 작성](writing-personal-extensions.md)을 참고하세요.

## 확장 종류 구분하기

| 이름 | 설명 |
| --- | --- |
| Personal Extension | Professor Mari가 대신 작성한 확장입니다. **Settings → Addons**(설정 → 애드온) 아래에 초안으로 나타납니다. |
| External Extension(외부 확장) | 다른 사람이 만든 확장이나 직접 작성한 확장입니다. [서드파티 가져오기 허용하기](#allow-third-party-imports)의 추가 단계가 필요합니다. |
| Browser Extension | 브라우저 안의 샌드박스에서 실행됩니다. 기본적으로 안전합니다. |
| Server Extension | Marinara를 실행하는 컴퓨터에서 운영체제 샌드박스 안에 실행됩니다. 지원되는 플랫폼이 필요합니다. |
| Full page access(전체 페이지 접근) | 샌드박스를 없애는 권한입니다. 완전히 신뢰하는 코드에만 쓰세요. |

## 공유받은 확장 설치하기

시작하기 전에 [서드파티 가져오기 허용하기](#allow-third-party-imports)의 두 단계를 마치세요. 이 단계를 마치지 않으면 가져오기 버튼이 숨겨져 있습니다.

1. **Settings → Addons**를 여세요. **External Extensions**(외부 확장) 아래에서 `.zip`, `.json`, `.css`, `.js` 파일은 **Import Extension File**(확장 파일 가져오기)을, 폴더는 **Import Extension Folder**(확장 폴더 가져오기)를 선택하세요.
2. 새 초안을 여세요. 초안은 비활성화되어 있으며 코드와 해시를 보여 줍니다. 해시는 바로 그 코드의 짧은 지문입니다(Marinara는 SHA-256을 사용합니다).
3. 코드와 **Requested access**(요청된 접근 권한) 목록을 읽으세요.
4. 그 버전을 그대로 받아들일 때만 **Review and Run**(검토 및 실행)을 선택하세요. 그러면 확장이 활성화된 것으로 표시됩니다.

작동하지 않는 경우: 가져오기 버튼이 없으면 두 단계 중 하나를 마치지 않은 것입니다. `.env`를 바꾼 뒤에는 Marinara를 다시 시작해야 한다는 점을 잊지 마세요.

## Professor Mari가 만든 확장 검토하기

시작하기 전에 [Professor Mari](../home/professor-mari.md)에게 확장을 만들어 달라고 요청하세요. Professor Mari는 코드를 저장할 수는 있지만 승인하거나 활성화할 수는 없습니다. 이 섹션에는 New Draft 버튼도, 가져오기 컨트롤도 없습니다.

1. **Settings → Addons → Personal Extensions**(설정 → 애드온 → 개인 확장)를 여세요. 초안이 없으면 "Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash."(Mari 교수님에게 확장 만들기를 요청하세요. 사용자가 활성화하고 정확한 코드 해시를 승인하기 전에는 아무것도 실행되지 않습니다.)라고 표시됩니다.
2. 초안을 열고 코드를 읽으세요. 해시와 **Requested access** 목록을 확인하세요.
3. 그 버전을 그대로 받아들일 때만 **Review and Run**을 선택하세요.

모든 초안은 비활성화 상태로 시작합니다. 코드를 편집하거나, 권한을 바꾸거나, 개정판을 복원하면 확장이 비활성화되고 승인을 다시 받아야 합니다.

> **경고:** 샌드박스는 코드가 할 수 있는 일을 제한할 뿐, 코드를 믿을 수 있게 만들어 주지는 않습니다. 해로운 확장도 감시 장치(폭주하는 코드를 멈추는 타이머)가 멈출 때까지 프로세서 시간을 낭비하거나, 한도까지 자기 저장소를 채우거나, 로그로 사용자를 속일 수 있습니다. 전체 페이지 확장은 의도적으로 샌드박스를 포기합니다. 활성화하기 전에 코드를 읽고, 서드파티 코드는 모든 줄을 검사하세요.

작동하지 않는 경우: Professor Mari가 편집하거나 개정판을 복원하면 초안이 비활성화 상태로 돌아갑니다. 다시 검토하고, 대화 상자에 표시된 해시가 읽은 코드의 해시와 같은지 확인하세요.

## 확장이 할 수 있는 일

Browser Extension은 브라우저 안의 샌드박스(격리된 영역)에서 실행됩니다. Marinara의 페이지, 쿠키, 브라우저 저장소, 네트워크에는 접근할 수 없습니다. 할 수 있는 일은 다음과 같습니다.

- 전용 저장소를 두고 로그 쓰기
- Marinara가 현재 테마로 그리는 버튼, 메뉴 항목, 패널 추가하기
- 열려 있는 채팅의 ID 읽기
- 해당 권한을 승인한 경우에만 현재 캐릭터나 페르소나의 일부 필드 읽기

전체 목록은 [Personal Extensions 작성](writing-personal-extensions.md#what-a-browser-extension-can-do)에 있습니다.

Server Extension은 운영체제 샌드박스 안에서 별도의 Node 프로세스(서버 컴퓨터에서 실행되는 프로그램)로 실행됩니다. Marinara 파일, 사용자 파일, 서버 시크릿, 네트워크, 자식 프로세스, 워커, 네이티브 애드온에는 접근할 수 없습니다.

<a id="platform-support"></a>

### 플랫폼 지원

Browser Extension은 브라우저가 샌드박스로 격리하므로 어디서나 동작합니다. Server Extension에는 지원되는 운영체제 샌드박스가 필요합니다. 샌드박스가 없는 환경에서는 비활성화 상태로 남으며, Marinara는 샌드박스 없이는 절대 실행하지 않습니다.

| 플랫폼 | Server Extension |
| --- | --- |
| macOS | macOS 샌드박스인 Seatbelt로 격리 |
| Linux(Bubblewrap 있음) | Linux 샌드박스 도구인 Bubblewrap으로 격리 |
| Linux(`bwrap` 없음) | 비활성화. `bwrap`을 설치하세요 |
| Docker(기본값) | 비활성화. 컨테이너 권한 제한 |
| Windows | 비활성화. Browser Extension을 쓰세요 |
| Android | 비활성화. Browser Extension을 쓰세요 |

Browser Extension은 모든 플랫폼에서 샌드박스로 격리됩니다. 전체 페이지 External Extension은 어떤 플랫폼에서도 격리되지 않으며, 언제나 명시적인 신뢰가 필요합니다.

공식 Docker 이미지에는 Bubblewrap이 들어 있지만, 기본 컨테이너는 Bubblewrap에 필요한 중첩 네임스페이스와 마운트를 만들 수 없습니다. Marinara는 실행 중에 샌드박스를 검사하고, 컨테이너가 허용하지 않으면 Server Extension을 비활성화된 상태로 둡니다. Docker 권한을 재정의하는 방법과 그에 따른 보안상의 절충은 [문제 해결](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available)을 참고하세요.

Windows와 Android에는 지원되는 프로세스 샌드박스가 없으므로 Server Extension을 쓸 수 없습니다. Browser Extension을 쓰거나, macOS 또는 `bwrap`이 설치된 Linux에서 Marinara 서버를 실행하세요.

<a id="allow-third-party-imports"></a>

## 서드파티 가져오기 허용하기

서드파티 가져오기는 다른 사람이 작성한 코드를 실행하므로 기본적으로 잠겨 있고 화면에도 나오지 않습니다. 두 단계를 거치면 열립니다.

1. Marinara를 실행하는 컴퓨터의 `.env` 파일에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정한 다음 Marinara를 다시 시작하세요. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.
2. **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)을 열고, 데이터 삭제 컨트롤 아래로 스크롤한 다음, 경고를 읽고 **Allow third-party extension imports**(서드파티 확장 가져오기 허용)를 켜세요.

그러면 **Settings → Addons**에 파일과 폴더 가져오기 컨트롤이 있는 **External Extensions**가 표시됩니다. 지원 형식은 다음과 같습니다.

- `.personal-extension.zip` 및 호환되는 `.zip` 패키지
- `.json` 매니페스트
- `.css`
- `.js`, `.mjs`, `.cjs`
- `.server.js`, `.server.mjs`, `.server.cjs`

가져온 확장에는 승인이 따라오지 않으며, 확장이 스스로 활성화할 수도 없습니다. 대부분의 Browser Extension은 안전한 샌드박스 안에 그대로 두는 편이 좋습니다. **Full page access**가 표시된 패키지는 다릅니다.

- 코드가 샌드박스 없이 Marinara의 페이지 안에서 실행됩니다.
- 채팅과 카드를 읽고, 브라우저 저장소를 사용하고, 네트워크 요청을 보내고, Marinara 자체 API를 호출할 수 있습니다.
- 그 버전을 직접 검사하고 신뢰할 수 있을 때만 활성화하세요.
- Professor Mari의 초안은 이 권한을 요청할 수 없습니다.

구형 레코드, 프로필로 가져온 레코드, 수동으로 저장한 레코드, 출처를 알 수 없는 레코드도 외부 확장으로 취급합니다. 이런 레코드는 숨겨진 채로 승인할 수 없으며, 두 단계를 모두 마치기 전에는 실행되지 않습니다.

두 단계 중 하나라도 끄면 가져온 확장이 모두 비활성화됩니다. 다시 켜도 확장이 다시 실행되지는 않습니다. 전체 페이지 확장이 남긴 변경이 있으면 페이지를 새로 고치세요.

작동하지 않는 경우: 가져오기 컨트롤이 나타나지 않으면 두 단계를 모두 마쳤는지, 그리고 서버 컴퓨터에서 접속했거나 **Settings → Advanced → Admin Access**(설정 → 고급 → 관리자 접근)에 관리자 시크릿을 저장했는지 확인하세요.

## 내보내기, 개정판, 복구

확장의 내보내기 동작을 쓰면 옮겨 쓸 수 있는 패키지를 다운로드할 수 있습니다. 내보낸 패키지와 복원한 패키지는 비활성화 상태를 유지합니다. 개정판을 복원해도 비활성화된 초안으로 돌아갑니다.

**Settings → Addons → Extension revision history**(설정 → 애드온 → 확장 수정 기록)에서 모든 개인 확장과 외부 확장의 이전 코드 버전을 몇 개 보관할지 정합니다. 기본값은 **10**입니다. **0**부터 **10**까지 고를 수 있으며, **0**이면 기록이 꺼집니다. 한도를 줄이면 오래된 개정판을 영구적으로 삭제하기 전에 확인을 요청합니다. 현재 코드, 승인, 활성화 상태, 저장된 확장 데이터는 보존됩니다. Professor Mari를 통한 편집에도 같은 한도가 적용됩니다.

확장이 이상하게 동작하면 **Disable**(비활성화)를 선택하세요. 화면을 쓸 수 없다면 Marinara를 중지하고 해당 `installed_extensions` 레코드의 `enabled` 값을 `"false"`로 바꾸세요. `approvedHash`는 절대 직접 설정하지 마세요.

## 관련 가이드

- [Personal Extensions 작성](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [서버 설정](../CONFIGURATION.md)
- [Marinara 백업과 복원](../data/backup-and-restore.md)
- [원격 접근](../REMOTE_ACCESS.md)
