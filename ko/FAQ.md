# 자주 묻는 질문

이 가이드에서는 Marinara Engine에 대해 자주 나오는 질문에 짧게 답합니다. 답변마다 전체 단계가 담긴 가이드로 연결됩니다.

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

## 휴대폰이나 다른 기기에서 Marinara Engine에 접근하려면 어떻게 하나요?

Marinara는 컴퓨터 한 대에서 서버로 실행되고, 브라우저로 열어서 씁니다. 시작 스크립트는 다른 기기도 서버에 닿을 수 있게 해 두지만, 호스트 컴퓨터에서 로그인(사용자 이름과 비밀번호)을 설정하기 전까지는 접근 제어가 이를 차단합니다. 그때까지 원격 기기에는 **Access blocked** 페이지만 표시됩니다.

1. 호스트 컴퓨터에서 Marinara를 계속 실행해 두세요.
2. 호스트의 로컬 IP 주소를 확인하세요. Windows에서는 `ipconfig`를 실행하고 **IPv4 Address** 값을 읽으세요. macOS나 Linux에서는 `hostname -I`를 실행하세요.
3. 다른 기기의 브라우저에서 `http://<host IP>:7860`을 여세요. 예를 들면 `http://192.168.1.42:7860`입니다. `7860`은 기본 포트입니다.
4. 로그인을 설정하세요. 다른 기기에서 Marinara를 열면 차단 페이지에 **Setup code**(설정 코드) 입력 양식이 있습니다. 호스트 컴퓨터의 서버 로그에서 1회용 코드를 찾은 다음(Docker에서는 `docker logs <container> 2>&1 | grep "setup code"` 실행), 새 사용자 이름, 비밀번호와 함께 입력하세요. 또는 호스트에서 이미 로그인된 브라우저로 **Settings → Advanced → Access**(설정 → 고급 → 접근)를 여세요.
5. 로그인하세요. 비밀번호를 입력하지 않고 기기를 더 추가하려면 **Settings → Advanced → Access**의 **Add a device**(기기 추가)를 쓰세요.

일반 데스크톱 설치에서는 같은 컴퓨터(`127.0.0.1`)에서 열 때 비밀번호가 필요 없습니다. 같은 컴퓨터의 리버스 프록시는 원격 방문자로 취급되어 로그인이 필요합니다. 모든 선택지, 설정 코드, Docker에 관한 내용은 [원격 접근](REMOTE_ACCESS.md#option-1-login-recommended)을 참고하세요. 두 기기가 서로 다른 네트워크에 있으면 Tailscale을 쓰세요. [Tailscale로 어디서든 접속하기](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale)를 참고하세요. 접속이 되지 않으면 [문제 해결](TROUBLESHOOTING.md)을 참고하세요.

## Marinara 전용 모바일 앱이 있나요?

별도의 네이티브 앱은 없습니다. 휴대폰이나 태블릿에서는 브라우저로 웹 앱을 쓰세요. 대부분의 브라우저는 **Add to Home Screen**(홈 화면에 추가)이나 **Install App**(앱 설치)을 제공하며, 이렇게 하면 웹 앱이 PWA(Progressive Web App, 브라우저 바 없이 앱처럼 열리는 웹사이트)로 저장됩니다.

Android에서는 [최신 APK를 다운로드](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)할 수도 있습니다. APK는 Termux를 통해 휴대폰에서 Marinara를 실행합니다. [Android (Termux) 설치 가이드](installation/android-termux.md)를 참고하세요. iPhone과 iPad는 [iOS / iPadOS PWA 가이드](installation/ios-pwa.md)를 참고하세요.

Android 앱의 런처에는 **Open in browser**(브라우저에서 열기), **Retry connection**(연결 다시 시도), **Install / Start Marinara**(Marinara 설치/시작)가 있습니다. 나중에 선택을 바꾸려면 **Settings → General → App Behavior → Open Android launcher (app or browser)**(설정 → 일반 → 앱 동작 → Android 런처 열기 (앱 또는 브라우저))를 사용하세요. 이전 APK에서는 `/android-login`에서 수동으로 로그인합니다.

<a id="can-i-play-with-other-people"></a>

## 다른 사람과 함께 플레이할 수 있나요?

네. 선택적 멀티플레이어를 쓰면 여러 사람이 Conversation, Roleplay, Game 하나를 함께 쓸 수 있습니다. 모두가 설정을 켠 다음 호스팅하거나 참여합니다. 게스트에게는 AI 키가 필요 없습니다. 비밀번호가 있다고 모르는 호스트가 안전해지는 것은 아닙니다. 켜기 전에 [멀티플레이어 설정, 경고 및 제한](CONFIGURATION.md#optional-multiplayer)을 읽으세요.

## 채팅 모드 3가지는 무엇인가요?

- **Conversation**(대화): 메신저 앱처럼 캐릭터와 주고받는 채팅입니다.
- **Roleplay**(롤플레이): 서술과 캐릭터 아바타가 어우러진 몰입형 이야기 장면입니다.
- **Game**(게임): AI 게임 마스터가 진행하는 텍스트 어드벤처입니다.

모드를 고르려면 [Marinara Engine 시작하기](home/welcome.md#choose-a-chat-mode)를 참고하세요.

## Conversation 스케줄에 쓰이는 시간대는 어떻게 바꾸나요?

Conversation을 열고 Chat Settings(채팅 설정)에서 **Schedule timezone**(스케줄 시간대)을 고르세요. **Use device**(기기 설정 사용)를 고르면 기기의 시간대로 되돌아갑니다. 이 설정은 모든 Conversation 채팅에 적용되는 전역 설정 하나이며, 같은 서버에 연결된 다른 기기에도 동기화됩니다. [Conversation Mode: 시작하기](conversation/getting-started.md)를 참고하세요.

## 각 Conversation 채팅마다 스케줄이 따로 있나요?

아니요. 스케줄은 캐릭터에 속하므로 그 캐릭터와 나누는 모든 Conversation 채팅이 같은 스케줄을 씁니다. **Character Editor → Convo → Weekly schedule**(캐릭터 편집기 → 대화(콘보) → 주간 일정)에서 편집하세요.

한 채팅에서만 즉시 답장을 받으려면 그 채팅의 Chat Settings에서 **Conversation schedules**(Conversation 스케줄)를 끄세요. **dnd** 같은 수동 상태 지정은 여전히 적용되며, 이 지정도 캐릭터에 속하므로 모든 채팅에 적용됩니다. 지정을 해제하려면 **clear**를 사용하세요.

## Marinara를 쓰려면 API 키가 필요한가요?

네, 온라인 AI 서비스를 쓰려면 필요합니다. **API 키**는 AI 서비스에서 받는 비밀 코드로, Marinara가 그 서비스의 내 계정을 쓸 수 있게 해 줍니다. 채팅을 시작하려면 계정이 하나 이상 있어야 합니다. **Connections**(연결)를 열고 **Add**(추가)를 클릭한 다음, 서비스를 고르고 키를 붙여넣고 **Connect**(연결)를 클릭하세요. [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요.

키가 필요 없는 선택지도 있습니다. 구독형 옵션(Claude, ChatGPT, Grok)은 명령줄 도구로 로그인합니다. **Built-in model**(내장 모델)은 내 컴퓨터에서 실행됩니다. [내장 모델 설정](connections/local-model.md)을 참고하세요.

## 어떤 AI 제공자를 지원하나요?

Marinara는 텍스트, 이미지, 동영상 생성을 위해 OpenAI, Anthropic, Google Gemini, OpenRouter를 비롯한 많은 서비스를 지원하며, Ollama, LM Studio, KoboldCpp 같은 **OpenAI-compatible** 서버도 지원합니다. 전체 목록은 [지원하는 AI 제공자](connections/providers-reference.md)에 있습니다. 추가하는 방법은 [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요.

## Marinara를 쓰려면 돈을 내야 하나요?

Marinara는 무료입니다. 비용은 사용하는 AI 서비스가 청구하는 만큼 냅니다. 돈을 들이지 않고 시험해 볼 수 있는 선택지도 있습니다. **Pollinations** 이미지는 키가 필요 없고, **Stable Horde**는 무료이며, **Built-in model**은 내 컴퓨터에서 실행됩니다. 구독형 옵션은 이미 가입해 두었을 수 있는 유료 요금제를 씁니다.

## API 키는 안전한가요?

네. 모든 API 키는 저장되기 전에 AES-256으로 암호화됩니다. 계정과 프로필을 내보낼 때는 비밀 값이 빠지므로, 전체 백업 ZIP에 쓸 때를 포함해 **Import Profile**(프로필 가져오기)을 쓴 뒤에는 키를 다시 입력하세요. 전체 백업 ZIP에는 암호화된 기록과 그 기록을 푸는 키 파일이 함께 들어 있으므로 외부에 공개하지 마세요. [백업과 복원](data/backup-and-restore.md)을 참고하세요.

## 캐릭터 카드란 무엇인가요?

캐릭터 카드는 AI 캐릭터의 프로필을 저장해 둔 것으로, 이름, 아바타, 성격, 배경 이야기, 인사말이 담깁니다. 카드는 **Character Editor**에서 만들거나 다른 앱에서 가져옵니다. [캐릭터 만들기와 편집](characters/creating-and-editing-characters.md)을 참고하세요.

## 로어북이란 무엇이며, 여러 캐릭터에 함께 쓰려면 어떻게 하나요?

로어북은 세계 설정을 모아 둔 것입니다. 각 항목은 채팅에 트리거 단어가 나올 때만 프롬프트에 들어갑니다. 다음과 같이 쓸 수 있습니다.

1. 로어북 편집기에서 **Linked Characters**(연결된 캐릭터)나 **Linked Personas**(연결된 페르소나)를 채우세요. 그러면 그 캐릭터나 페르소나가 있는 모든 채팅에서 로어북이 작동합니다.
2. 채팅 하나에 붙이려면 **Chat Settings → Lorebooks → Add Lorebook**(채팅 설정 → 로어북 → 로어북 추가)을 여세요.
3. 개별 항목을 특정 캐릭터에게만 적용되도록 제한하세요.

[로어북](lorebooks/overview.md)을 참고하세요.

## 에이전트란 무엇인가요?

에이전트는 채팅이 진행되는 동안 장면 추적이나 지도 추가처럼 한 가지 일을 맡아 처리하는 선택형 AI 도우미입니다. 새로 설치한 상태에는 에이전트가 하나도 없습니다. **Agents → Agent Organizer**(에이전트 → Agent Organizer)를 열고 에이전트를 골라 설치하세요. 그런 다음 **Chat Settings**에서 채팅마다 켜세요. [에이전트](agents/agents-overview.md)를 참고하세요.

## Noodle은 어떻게 설정하나요?

Noodle은 캐릭터들을 위한 가상의 로컬 소셜 네트워크입니다. **Agents → Agent Organizer**에서 **Noodle**을 설치하고, 안내가 나오면 Marinara를 다시 시작한 다음, **Home → Noodle**(홈 → Noodle)을 여세요. [Noodle: 앱 안의 소셜 타임라인](agents/noodle.md)을 참고하세요.

## 캐릭터가 왜 답하지 않나요?

대개 채팅에 계정이나 모델이 없거나, API 키가 잘못되었거나, 계정의 크레딧이 떨어진 경우입니다. [캐릭터가 답하지 않을 때](TROUBLESHOOTING.md#my-character-does-not-reply)를 참고하세요.

## 캐릭터가 왜 이전 메시지를 기억하지 못하나요?

모델이 한 번에 읽을 수 있는 글의 양은 정해져 있어서, 채팅이 길어지면 오래된 메시지가 빠집니다. 이를 돕는 도구가 두 가지 있습니다. **Memory Recall**(기억 회상)은 관련된 이전 메시지를 다시 불러오고, 요약은 오래된 메시지를 짧은 줄거리로 압축합니다. 둘 다 **Chat Settings**에 있습니다. 긴 Roleplay 채팅에는 **Chat Settings → Memory Recall**의 **Advanced Memory Recall**(고급 기억 회상)을 쓰세요. [Memory Recall과 채팅 요약](agents/memory.md)을 참고하세요.

## 데이터는 어떻게 백업하나요?

**Settings → Advanced → Backup & Export**(설정 → 고급 → 백업 및 내보내기)를 열고 **Download Backup**(백업 다운로드)을 클릭하세요. 데이터와 업로드한 파일이 담긴 `.zip` 파일이 저장됩니다. 복원하려면 **Settings → Imports**(설정 → 가져오기)의 **Import Profile (JSON/ZIP)**(프로필 가져오기 (JSON/ZIP))을 쓰세요. 같은 섹션에서 매일, 매주, 매월 백업을 실행하도록 설정할 수도 있습니다. [백업과 복원](data/backup-and-restore.md)을 참고하세요.

## 확장 기능은 어떻게 동작하며, 외부 코드를 가져올 수 있나요?

기본 상태에서는 Professor Mari만 Personal Extension 초안을 만듭니다. 초안은 꺼진 상태로 시작하며, 실행되기 전에 정확한 코드를 직접 승인해야 합니다. 외부 코드 가져오기는 호스트가 `.env`에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정하고 **Settings → Advanced → Danger Zone**(설정 → 고급 → 위험 구역)에서 경고에 동의하기 전까지 숨겨져 있습니다. [개인 확장](extending/personal-extensions.md)을 참고하세요.

## 데이터는 어디에 저장되나요?

Marinara를 실행하는 컴퓨터의 설치 폴더 안 `data` 폴더에 저장됩니다. 클라우드에는 아무것도 저장되지 않습니다. [데이터를 저장하는 위치](data/where-data-is-stored.md)를 참고하세요.

## 업데이트하면 데이터가 사라지나요?

아니요. 업데이트해도 캐릭터, 채팅, 설정은 그대로 남습니다. 그래도 먼저 백업해 두세요. 이전 버전으로 되돌아가면 새 버전에만 저장되는 데이터를 잃을 수 있습니다. [Marinara Engine 업데이트](UPGRADING.md)와 [이전 버전으로 다운그레이드하기](UPGRADING.md#downgrading-to-an-older-version)를 참고하세요.

## Professor Mari는 무엇을 할 수 있나요?

Professor Mari는 홈 화면에 있는 내장 어시스턴트입니다. 앱을 설명하고, 부탁하면 캐릭터, 페르소나, 로어북, 프리셋을 만들거나 편집합니다. 변경할 때마다 **Undo**(되돌리기)가 있는 카드가 표시됩니다. [Professor Mari](home/professor-mari.md)를 참고하세요.

## Storyboard 에이전트는 무엇이고 Game Mode에서 어떻게 쓰나요?

완성된 이야기 텍스트를 이미지로 바꾸는 에이전트입니다. **Agents → Agent Organizer**에서 **Storyboard**를 설치한 다음 채팅에서 켜세요. [스토리보드 에이전트 가이드](game/storyboard.md)를 참고하세요.

## 통화에서 캐릭터가 소리 내어 말할 수 있나요?

네, Conversation 모드에서 됩니다. **Connections**에 **Text to Speech**(TTS)가 설정되어 있어야 합니다. 마이크 음성 인식을 포함한 단계는 [Conversation 음성 통화와 영상 통화](conversation/calls.md)를 참고하세요.

## Marinara로 이미지를 만들 수 있나요?

네. 키가 필요 없는 **Pollinations**나 유료 서비스 같은 이미지 생성 계정을 추가하세요. [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요.

## 앱 안에서 문서를 읽으려면 어떻게 하나요?

홈 화면의 북마크에서 **Documentation**(문서)을 클릭하세요. 휴대폰에서는 먼저 북마크 메뉴를 여세요. 홈의 FAQ에서 **Open Documentation**(문서 열기)을 클릭해도 됩니다.

## 도움을 받거나 버그를 신고하려면 어디로 가야 하나요?

[문제 해결](TROUBLESHOOTING.md)부터 확인하세요. 홈에서 **Discord**를 누르면 커뮤니티 채팅이, **Support**(지원)를 누르면 프로젝트 지원 페이지가 열립니다. 버그 신고와 기능 요청은 프로젝트의 GitHub 페이지에서 하세요.

## 관련 가이드

- [문제 해결](TROUBLESHOOTING.md)
- [설치](INSTALLATION.md)
- [원격 접근](REMOTE_ACCESS.md)
- [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)
