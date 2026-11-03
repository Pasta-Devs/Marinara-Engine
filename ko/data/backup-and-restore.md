# Marinara 백업과 복원

이 가이드에서는 Marinara Engine 데이터를 사본으로 저장하고 나중에 되돌리는 방법을 설명합니다. 업데이트하기 전, 새 기기로 옮기기 전, [데이터를 지우기](clearing-data.md) 전에 활용하세요.

## 어떤 방법을 쓸까요

| 방법 | 만들어지는 것 | 쓰는 경우 |
| --- | --- | --- |
| **Download Backup**(백업 다운로드) | 모든 데이터와 파일이 든 `.zip` 파일 하나. | 모든 것을 한 번에 담은 완전한 사본이 필요할 때. |
| **Export Profile**(프로필 내보내기) | 계정 데이터(캐릭터, 채팅, 로어북 등)를 담은 더 작은 파일. | 비밀 값이 없는 사본이나 다른 도구용 파일이 필요할 때. |

`.zip`은 여러 파일을 담고 있는 파일 하나입니다. 두 방법 모두 **Settings**(설정) → **Advanced**(고급) → **Backup & Export**(백업 및 내보내기)에 있습니다. 복원은 **Settings** → **Imports**(가져오기) → **Profile & Marinara**(프로필 및 Marinara)에서 합니다.

**시작하기 전에:** Marinara를 실행하는 컴퓨터에서는 이 도구들을 바로 쓸 수 있습니다. 휴대폰, 태블릿 등 다른 기기에서는 서버에 관리자 시크릿을 설정하고, 같은 값을 **Settings** → **Advanced** → **Admin Access**(관리자 접근)에 입력하세요. 관리자 시크릿은 서버의 `.env` 파일에 `ADMIN_SECRET` 설정으로 넣는 비밀번호입니다. [서버 설정 참고 문서](../CONFIGURATION.md)의 "관리자 권한 API(ADMIN_SECRET)" 섹션과 [원격 접근](../REMOTE_ACCESS.md)을 참고하세요.

## Download Backup

1. **Settings** → **Advanced**를 여세요.
2. **Backup & Export**에서 **Download Backup**을 클릭하세요. 버튼에 **Creating backup…**(백업 만드는 중…)이 표시됩니다.
3. 브라우저가 물으면 파일을 저장하세요. 묻지 않으면 다운로드 폴더에서 찾으세요.

`.zip`에는 다음이 들어 있습니다.

- 저장된 텍스트 데이터(캐릭터, 채팅, 로어북, 프리셋, 연결, 설정)
- 업로드하거나 생성한 파일. 아바타, 스프라이트, 배경, 갤러리 이미지, 글꼴, 사용자 지정 이모지와 스티커, 사용자 지정 알림 소리 등입니다.
- `.encryption-key` 파일(있는 경우)
- 파일을 직접 복원하는 방법을 적은 `RESTORE.txt` 메모([직접 복원하기](#restore-by-hand) 참고)

폴더 이름은 [Marinara가 데이터를 저장하는 위치](where-data-is-stored.md)를 참고하세요.

> **경고:** 백업에는 저장된 API 키와 그 키를 푸는 `.encryption-key` 파일이 들어 있습니다. 절대 남에게 공유하지 마세요. 남이 볼 수 없는 곳에 보관하세요.

Android에서는 앱의 데이터 폴더에 접근할 수 없으므로, 기기 밖으로 사본을 꺼내는 방법은 **Download Backup**뿐입니다.

작동하지 않는 경우: "Backup preparation timed out after one hour."라는 메시지가 보이면 다시 시도하세요. 다른 기기에서 다운로드할 수 없다면 **Admin Access**를 확인하세요(위 내용 참고).

<a id="automatic-backups"></a>

## 자동 백업

Marinara는 Marinara를 실행하는 컴퓨터에서 일정에 맞춰 전체 백업을 만들 수 있습니다.

1. **Settings** → **Advanced** → **Backup & Export**를 여세요.
2. **Automatic backups**(자동 백업)를 켜세요.
3. **Daily**(매일), **Weekly**(매주), **Monthly**(매달) 중 하나를 고르세요.
4. **Automatic backups kept**(보관할 자동 백업 수)를 1에서 9999 사이로 정하세요.

Marinara는 이 기능을 켠 직후에 첫 백업을 만듭니다. 실행이 끝날 때마다 최신 백업을 설정한 개수만큼 남기고 더 오래된 자동 백업을 지웁니다. **Download Backup**으로 직접 만든 백업은 지우지 않습니다.

자동 백업은 데이터 폴더 안의 `backups/` 폴더에 저장됩니다. 가장 최신 백업은 `marinara-automatic-backup.zip`입니다. 이전 백업에는 이름에 날짜와 시각이 붙습니다. 형식은 **Download Backup**과 같습니다.

새 아카이브가 완성될 때까지 이전 아카이브를 보관하므로, 실행할 때마다 전체 아카이브 하나를 더 저장할 여유 공간이 필요합니다. 공간이 부족하면 Marinara는 해당 실행을 건너뛰고 설정 옆에 이유를 표시합니다. 공간이 생기면 다시 시도합니다.

> **팁:** 데이터 폴더 바깥에도 사본을 하나 더 보관하세요. 디스크가 고장 나거나 앱을 지우면 자동 백업도 함께 사라집니다.

## 프로필 내보내기

1. **Settings** → **Advanced** → **Backup & Export**를 여세요.
2. **Export Profile**을 클릭하세요. 같은 제목의 창이 열립니다.
3. 형식을 고르세요.
4. 브라우저가 파일을 다운로드합니다.

- **Marinara Native**는 캐릭터, 페르소나, 채팅, 로어북, 프리셋, 에이전트, 테마, Personal Extension 코드, 미디어를 유지합니다. API 키, 웹훅 주소, 일부 채팅 설정은 복원하지 않습니다([API 키 다시 입력하기](#enter-your-keys-again) 참고). Marinara에서 복원할 수 있습니다.
- **Compatible JSON**은 다른 도구용으로 일반 캐릭터, 페르소나, 로어북 파일을 담은 `.zip`을 만듭니다. Marinara에서는 복원할 수 없습니다.

네이티브 프로필은 `marinara-profile.json`으로 다운로드됩니다. 너무 크면 Marinara가 대신 ZIP 파일을 제안합니다. **Export ZIP**(ZIP 추출)을 클릭하면 `marinara-profile.zip`을 다운로드합니다.

네이티브 프로필은 Personal Extension 코드는 유지하지만, 활성화 여부와 승인 여부는 유지하지 않습니다. 복원한 확장은 모두 비활성화된 채로 들어옵니다. **Settings** → **Addons**(애드온)에서 다시 검토하세요.

## Import Profile로 복원하기

**Import Profile**(프로필 가져오기)은 프로필 파일이나 **Download Backup** `.zip`을 불러옵니다.

1. **Settings** → **Imports**를 여세요.
2. **Profile & Marinara**에서 **Import Profile (JSON/ZIP)**(프로필 가져오기 (JSON/ZIP))을 클릭하세요.
3. `marinara-profile.json`, `marinara-profile.zip`, 백업 `.zip` 중 하나를 고르세요. 버튼에 **Scanning Profile...**(프로필 스캔 중...)이 표시됩니다.
4. **Import Profile** 창을 읽으세요. Marinara가 찾은 내용을 보여 주고, 가져오기를 되돌릴 수 없다고 경고합니다.
5. **Import**(가져오기)를 클릭하세요. 중단하려면 **Cancel**(취소)을 클릭하세요. 버튼에 **Importing Profile...**(프로필 가져오는 중...)이 표시되고 진행 막대가 따라옵니다. 끝나면 프로필을 가져왔다는 메시지가 나타납니다.

작동하지 않는 경우:

- `localhost`, `127.0.0.1`, `[::1]`로 Marinara를 열지 않았다면 프로필 가져오기에는 HTTPS가 필요합니다. 이때 오류 메시지는 "Profile import requires HTTPS outside local development."입니다. HTTPS 주소로 Marinara를 여세요.
- `.zip`에 미디어 파일이 일부 빠져 있어도 가져오기는 끝까지 진행됩니다. 경고가 빠진 파일 목록을 보여 주고, Marinara는 나머지를 가져옵니다.

같은 프로필을 두 번 가져오면 Marinara는 항목을 복사하지 않고 기존 항목을 업데이트합니다. 아주 오래된 버전에서 만든 프로필은 중복을 만들 수 있습니다.

<a id="enter-your-keys-again"></a>

## API 키 다시 입력하기

**Import Profile**은 **Download Backup** `.zip`을 고르더라도 API 키와 웹훅 주소를 복원하지 않습니다. API 키는 서비스가 발급해 주는 비밀 코드입니다. 프로필 파일과 백업 안의 프로필에서는 이런 값이 비워져 있습니다. 그래서 새 컴퓨터에서 가져온 뒤에는 이 값들을 다시 입력해야 합니다.

1. 상단 바에서 **Connections**(연결)를 여세요.
2. 사용하는 계정을 하나씩 열고 API 키를 입력한 다음 저장하세요. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.
3. 웹훅 주소를 쓰는 사용자 지정 도구마다 그 주소를 다시 입력하세요.

주소나 키가 들어 있는 일부 채팅 설정(Discord, DeepL, Intiface)도 비워진 채로 들어옵니다. 각 채팅의 **Chat Settings**(채팅 설정)에서 다시 입력하세요.

가져오기를 해도 같은 설치에 이미 설정해 둔 키는 지워지지 않습니다.

## 새 컴퓨터로 옮기기

1. 새 컴퓨터에 Marinara를 설치하고 시작하세요. [설치](../INSTALLATION.md)를 참고하세요.
2. **Settings** → **Imports** → **Profile & Marinara**를 열고 **Import Profile (JSON/ZIP)**을 클릭하세요.
3. **Download Backup** `.zip`이나 프로필 파일을 고르고 **Import**를 클릭하세요.
4. 위에서 설명한 대로 API 키를 다시 입력하세요.

백업에 든 키 파일은 아래처럼 데이터 폴더 전체를 직접 복사할 때만 도움이 됩니다.

<a id="restore-by-hand"></a>

## 직접 복원하기

**Import Profile**을 쓸 수 없을 때만 이 방법을 쓰세요. `.zip` 안에는 `marinara-backup-...` 같은 폴더 하나가 있고, 그 안에 `RESTORE.txt` 메모가 들어 있습니다.

1. Marinara를 종료하세요.
2. 백업의 압축을 푸세요.
3. 압축을 푼 폴더에서 폴더들과 `.encryption-key` 파일을 데이터 폴더로 복사하세요. [Marinara가 데이터를 저장하는 위치](where-data-is-stored.md)를 참고하세요.
4. Marinara를 시작하세요.

`.encryption-key` 파일은 `storage` 폴더와 함께 두세요. 그렇지 않으면 저장된 API 키를 읽을 수 없습니다.

**Backup & Export**의 **Existing backups**(기존 백업) 목록은 평소에 비어 있습니다. 이 목록은 필요하지 않습니다.

## 관련 가이드

- [Marinara가 데이터를 저장하는 위치](where-data-is-stored.md)
- [데이터 지우기와 초기화](clearing-data.md)
- [Marinara Engine 업데이트](../UPGRADING.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [원격 접근: 로그인과 IP 허용 목록](../REMOTE_ACCESS.md)
