# Marinara가 데이터를 저장하는 위치

이 가이드에서는 Marinara Engine이 데이터를 보관하는 폴더를 찾는 방법과, 데이터를 옮기거나 복사할 때 어떤 부분을 챙겨야 하는지 설명합니다.

Marinara는 내 컴퓨터에서 직접 실행되고, 캐릭터, 채팅, 설정을 그 컴퓨터에 저장합니다. 다만 답변을 생성할 때는 연결해 둔 AI 서비스로 채팅 내용을 보냅니다.

## 데이터 폴더 찾기

만든 모든 것은 서버를 실행하는 컴퓨터의 폴더 한 곳에 모입니다. 이 폴더가 데이터 폴더입니다. 이 폴더의 설정 이름은 `DATA_DIR`이며, 서버를 시작하기 전에 서버에 전달하는 값(환경 변수)입니다. **Settings**(설정)에서는 찾을 수 없습니다.

- 기본적으로는 서버 파일 옆에 있는 `data`라는 폴더입니다.
- 공식 Docker 컨테이너에서는 `/app/data`입니다.
- 정확한 경로를 보려면 Marinara를 시작한 창(터미널 또는 콘솔)을 확인하세요. 시작할 때 `[storage] DATA_DIR=`로 시작하고 경로가 이어지는 줄이 출력됩니다. 그 창을 찾을 수 없다면 Marinara 폴더 안에서 `data`라는 폴더를 찾아보세요.

폴더를 옮기려면 `DATA_DIR`을 설정하고 Marinara를 다시 시작하세요. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

## 폴더 안에 들어 있는 것

텍스트 데이터는 `storage` 폴더에 있습니다. 캐릭터, 채팅, 메시지, 로어북, 프리셋, 연결이 여기에 들어갑니다. Marinara는 이 데이터를 작은 파일 여러 개로 저장합니다. 이전 구조에서 업그레이드한 뒤에는 `storage/tables/`에 이름이 `.pre-shard`로 끝나는 예전 사본이 보일 수 있습니다. Marinara는 이 사본을 지우지 않습니다. 모든 것이 잘 동작하면 직접 지워서 공간을 확보해도 됩니다.

이미지, 오디오 등 다른 파일은 `storage` 옆의 각자 폴더에 들어 있습니다. 폴더 이름은 다음과 같습니다.

| 폴더 | 저장되는 내용 |
| --- | --- |
| `avatars` | 캐릭터와 페르소나의 아바타 |
| `sprites` | 캐릭터 스프라이트 이미지 |
| `avatar-models` | **2D Avatars**(2D 아바타)와 **3D Avatars**(3D 아바타) 에이전트의 파일. PNGTuber 그림과 3D 모델 등 |
| `backgrounds` | 업로드한 채팅 배경 |
| `gallery` | 갤러리 이미지 |
| `fonts` | 추가한 사용자 지정 글꼴 |
| `knowledge-sources` | 지식 에이전트용으로 업로드한 파일 |
| `game-assets` | Game Mode 에셋 |
| `game-scene-videos` | Game Mode 장면 영상 |
| `conversation-call-character-videos` | Conversation 통화용 캐릭터 영상 |
| `custom-emojis` | 사용자 지정 이모지 이미지 |
| `custom-stickers` | 사용자 지정 스티커 이미지 |
| `notification-sounds` | 사용자 지정 알림 소리 |
| `long-term-memory` | 장기 기억 에이전트의 데이터 |
| `lorebooks/images`, `prompts/images`, `agents/images`, `connections/images` | 로어북, 프리셋, 에이전트, 계정에 첨부한 이미지 |

데이터 폴더에는 `backups/`([자동 백업](backup-and-restore.md#automatic-backups))와 암호화 키 파일도 있습니다. **Download Backup**(백업 다운로드)에는 표에 있는 모든 폴더, `storage`, 키 파일이 들어갑니다. 개발자는 [파일 네이티브 저장소](../development/file-storage.md)를 읽어 보세요.

## 암호화 키 파일 보관하기

Marinara는 저장한 API 키를 암호화합니다. 이때 쓰는 키는 데이터 폴더 안의 `.encryption-key` 파일입니다.

이 파일 없이 데이터를 새 컴퓨터로 복사하면 Marinara는 저장된 API 키를 읽을 수 없습니다. 그러면 키를 다시 입력해야 합니다. 이 파일은 데이터 폴더의 나머지와 함께 복사하세요.

일부 환경에서는 파일 대신 `ENCRYPTION_KEY` 환경 변수로 키를 전달합니다. 그 경우에는 복사할 파일이 없습니다. 그 값을 따로 안전하게 보관하세요. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

## Android에서 데이터 복사하기

Android에서는 데이터 폴더가 루팅 없이는 접근할 수 없는 앱 저장 영역에 있으므로 폴더를 복사할 수 없습니다. **Settings** → **Advanced**(고급) → **Backup & Export**(백업 및 내보내기) → **Download Backup**을 사용하세요. `.zip`에는 `.encryption-key` 파일이 있으면 함께 들어갑니다. [Marinara 백업과 복원](backup-and-restore.md)을 참고하세요.

자동 백업도 같은 앱 저장 영역에 저장됩니다. 앱을 제거하거나 초기화하면 실제 데이터와 함께 사라질 수 있으니 사본을 다른 곳에도 보관하세요.

## 관련 가이드

- [Marinara 백업과 복원](backup-and-restore.md)
- [데이터 지우기와 초기화](clearing-data.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
- [파일 네이티브 저장소](../development/file-storage.md)
