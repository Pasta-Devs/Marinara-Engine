# 자주 묻는 질문

이 가이드에서는 Marinara Engine에 대해 가장 많이 나오는 질문에 답합니다. 답변은 주제별로 묶었습니다. 더 자세한 내용이 필요하면 각 답변에 연결된 전체 가이드를 참고하세요.

## 휴대폰이나 다른 기기에서 Marinara Engine에 접근하려면 어떻게 하나요?

Marinara Engine은 컴퓨터 한 대에서 로컬 서버로 실행되고, 웹 브라우저로 열어서 씁니다. 여기서는 같은 네트워크에 있는 휴대폰, 태블릿, 다른 컴퓨터에서 접근하는 방법을 설명합니다.

시작 스크립트(`start.sh`, `start.bat`, `start-termux.sh`)는 이미 서버가 모든 네트워크 인터페이스(`0.0.0.0`)에서 요청을 받도록 설정해 둡니다. 그래서 다른 기기도 네트워크로 서버에 닿을 수 있지만, 접근 제어가 기본적으로 이를 차단합니다. 호스트 컴퓨터에서 접근을 설정하기 전까지 원격 기기에는 설정 방법이 적힌 **Access blocked** 페이지만 표시됩니다.

다음 단계를 따르세요:

1. 호스트 컴퓨터에서 Marinara를 계속 실행해 두세요.
2. 호스트 컴퓨터에서 접근 제어를 설정하세요. Basic Auth(사용자 이름과 비밀번호) 또는 IP 허용 목록(신뢰하는 기기 주소 목록) 중 하나입니다. [원격 접근](REMOTE_ACCESS.md)에서 두 방식을 차례로 안내하며, 완전히 신뢰할 수 있는 사설 네트워크용 우회 설정도 다룹니다.
3. 호스트 컴퓨터의 로컬 IP 주소를 확인하세요. Windows에서는 다음 명령을 실행하고 **IPv4 Address** 값을 읽으세요:

```
ipconfig
```

macOS나 Linux에서는 다음 명령을 실행하세요:

```
hostname -I
```

4. 다른 기기에서 웹 브라우저를 열고 호스트 IP 주소 뒤에 포트를 붙여 접속하세요. 기본 포트는 `7860`입니다:

```
http://192.168.1.42:7860
```

`192.168.1.42`는 자신의 호스트 IP 주소로 바꾸세요.

5. 브라우저가 Basic Auth 사용자 이름과 비밀번호를 물으면 로그인하세요. 대신 **Access blocked** 페이지가 보이면 호스트에서 2단계를 먼저 마치세요.

일반 데스크톱 설치에서는 같은 컴퓨터(`127.0.0.1`)에서 열 때 비밀번호가 필요 없습니다. APK가 관리하는 Android 설치는 다른 Android 앱이 Marinara로 가장하지 못하도록 localhost에 비공개 로그인을 추가하지만 Android 래퍼가 해당 인증 정보를 자동으로 생성하고 사용합니다. 다른 기기는 접근 제어(Basic Auth 또는 IP 허용 목록)를 설정하기 전까지 차단됩니다. 각 방식은 [원격 접근](REMOTE_ACCESS.md)에서 설명합니다.

두 기기가 같은 네트워크에 있지 않다면 Tailscale 같은 도구가 도움이 됩니다. Tailscale은 기기마다 고정된 사설 주소를 부여합니다. 그러면 Marinara를 공개 인터넷에 노출하지 않고도 어디서든 접속할 수 있습니다. 접속이 되지 않으면 [문제 해결](TROUBLESHOOTING.md)을 참고하세요.

## Marinara 전용 모바일 앱이 있나요?

별도의 네이티브 모바일 앱은 없습니다. 휴대폰이나 태블릿에서도 브라우저로 같은 웹 앱을 씁니다. 대부분의 모바일 브라우저는 **Add to Home Screen**(홈 화면에 추가)이나 **Install App**(앱 설치) 기능을 제공하는데, 이렇게 설치하면 브라우저 주소 표시줄 없이 실제 앱처럼 쓸 수 있습니다. 이런 방식을 PWA(Progressive Web App, 앱처럼 설치할 수 있는 웹사이트)라고 부릅니다.

Android에서는 [최신 APK를 직접 다운로드](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)할 수도 있습니다. Termux를 통해 휴대폰에서 Marinara가 실행됩니다. 설치에 서명 키, 비밀번호, 로컬 접근 비밀 값은 필요하지 않습니다. Android 권한 확인은 [Android (Termux) 설치 가이드](installation/android-termux.md)를 참고하세요. iPhone과 iPad는 [iOS / iPadOS PWA 가이드](installation/ios-pwa.md)를 참고하세요.

Android 래퍼는 APK가 관리하는 Termux 서버를 열 때 자동으로 로그인합니다. 비공개 인증 정보는 같은 휴대폰의 다른 브라우저에서 서버를 의도적으로 열 때만 표시됩니다. `/android-login`을 열고 Termux에서 `cat ~/.marinara-engine/android-secret`을 실행한 다음 표시된 값을 붙여 넣으세요. 로컬 `mari` CLI도 런처가 관리하는 같은 비밀 값을 자동으로 읽습니다. 수동 Termux 설치에는 localhost와 네트워크 접근의 일반 규칙이 적용됩니다.

## 채팅 모드 3가지는 무엇인가요?

Marinara에는 채팅 모드가 3가지 있고, 채팅 목록을 열면 탭으로 표시됩니다:

- **Conversation**(대화): 채팅 앱에서 캐릭터에게 메시지를 보내듯 문자 메시지나 DM 형식으로 주고받는 채팅입니다.
- **Roleplay**(롤플레이): 서술과 캐릭터 아바타가 어우러진 몰입형 이야기 장면이며, 캐릭터 일러스트를 곁들일 수도 있습니다.
- **Game Mode**(게임 모드): 게임 마스터가 진행하는 텍스트 어드벤처이며, 장면 이미지와 동영상을 함께 쓸 수 있습니다.

모드마다 시작 가이드가 따로 있습니다. 원하는 모드부터 시작한 다음 심화 가이드를 살펴보세요.

## Conversation 스케줄에 쓰이는 시간대는 어떻게 바꾸나요?

Conversation을 열고 **Chat Settings**(채팅 설정)에서 **Schedule timezone**(스케줄 시간대)을 고르거나, Conversation 설정 과정에서 스케줄을 만들 때 함께 고르세요. Marinara는 처음에 기기가 알려 주는 시간대를 씁니다. 여기서 지원하는 IANA 시간대를 골라도 되고, **Use device**(기기 설정 사용)를 선택해 되돌려도 됩니다. 이 설정은 모든 Conversation 채팅에 한꺼번에 적용되는 전역 설정 하나이며, 서버에서 보내는 자율 메시지에도 적용되고, 같은 Marinara 서버에 연결된 다른 기기에도 동기화됩니다.

## Marinara를 쓰려면 API 키가 필요한가요?

거의 항상 필요합니다. **연결**은 Marinara가 AI 서비스 한 곳에 접속하는 방법을 저장해 둔 것입니다. 어떤 제공자인지, 어떤 모델인지, 그리고 그곳에 접속할 로그인 정보가 함께 들어갑니다. **API 키**는 비밀번호와 비슷한 비밀 문자열입니다. AI 제공자에게서 받아 두면 Marinara가 대신 그 제공자와 통신할 수 있습니다.

채팅을 시작하려면 연결이 하나 이상 있어야 합니다. 연결을 만들려면 **Connections**(연결) 패널을 열고 **New**(새로 만들기)를 클릭한 뒤 제공자를 고르고 **API Key**(API 키)를 붙여넣은 다음 모델을 고르세요. 전체 과정은 [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)에서 설명합니다.

API 키를 아예 쓰지 않는 제공자도 몇 곳 있습니다. 구독형 옵션(Claude, ChatGPT, Grok)은 대신 명령줄 도구로 로그인하고, 내장 Local Model은 키 없이 사용 중인 컴퓨터에서 바로 실행됩니다.

## 어떤 AI 제공자를 지원하나요?

Marinara는 여러 제공자를 지원합니다. 연결마다 하나씩 고르면 됩니다.

채팅과 롤플레이 텍스트에는 **OpenAI**, **OpenAI (ChatGPT)**, **Anthropic**, **Claude (Subscription)**, **Grok CLI (Subscription)**, **Google Gemini**, **Google Vertex AI**, **Mistral**, **Cohere**, **OpenRouter**, **NanoGPT**, **xAI / Grok**, 그리고 Ollama, LM Studio, KoboldCpp처럼 로컬이나 직접 띄운 모델을 위한 **Custom (OAI-Compatible)**을 고를 수 있습니다.

이미지 생성에는 **OpenAI (DALL-E)**, **Stability AI**, **Together AI**, **NovelAI**, **OpenRouter Images**, **xAI / Grok Imagine**, **Venice.ai**, **Atlas Cloud**, **Pollinations**, **Stable Horde**, **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **RunPod Serverless (ComfyUI)**, **Draw Things**, **NanoGPT**, **Block Entropy** 등이 있습니다.

동영상 생성에는 **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **Atlas Cloud**, **Seedance 2.0**, 그리고 로컬 **ComfyUI**의 API 형식 워크플로가 있습니다.

연결은 한 번에 여러 개 저장해 두고 채팅마다 다른 연결을 지정할 수 있습니다. [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요.

## Marinara를 쓰려면 돈을 내야 하나요?

Marinara 자체는 무료이고 사용 중인 컴퓨터에서 실행됩니다. 비용은 고른 AI 제공자가 청구하는 만큼 내며, 금액은 제공자와 모델에 따라 다릅니다.

돈을 들이지 않고 시험해 볼 수 있는 선택지도 있습니다. **Pollinations** 이미지 생성은 키가 필요 없습니다. **Stable Horde**는 무료이고, 키는 우선순위를 높여 더 빠르게 쓰고 싶을 때만 넣으면 됩니다. 내장 **Local Model**(로컬 모델)은 키 없이 컴퓨터에서 바로 실행됩니다. 구독형 옵션(Claude, ChatGPT, Grok)은 쓴 만큼 내는 API 키 대신 이미 가입해 둔 유료 요금제를 활용합니다.

## API 키는 안전한가요?

네, 안전합니다. Marinara Engine이 모든 API 키를 AES-256으로 암호화한 뒤 디스크에 저장합니다. 연결과 프로필을 내보낼 때는
비밀 값이 빠집니다. 전체 백업은 다릅니다. 암호화된 기록이 들어 있고, 암호화 키 파일이 있다면 그 기록을 푸는 데 필요한 키 파일까지
함께 담기므로 전체 백업 ZIP 파일은 외부에 공개하지 마세요.

프로필 가져오기는 비밀 값을 의도적으로 빼고 처리합니다. 그래서 프로필을 가져온 뒤에는 API 키를 하나씩 다시 입력해야 하며,
전체 백업 ZIP 파일에 **Import Profile**(프로필 가져오기)을 쓸 때도 마찬가지입니다. 데이터 폴더 전체를 수동으로 복원할 때는 짝이 되는 암호화 키
파일까지 함께 복원하면 암호화된 키가 그대로 유지됩니다.

## 캐릭터 카드란 무엇인가요?

**캐릭터 카드**는 AI 캐릭터의 프로필을 저장해 둔 것입니다. 이름, 아바타, 성격, 배경 이야기, 인사말이 담깁니다. 카드는 **Character Editor**(캐릭터 편집기)에서 만들고 편집합니다. 다른 앱에서 만든 카드를 가져올 수도 있습니다. [캐릭터 만들기와 편집](characters/creating-and-editing-characters.md)을 참고하세요.

## 로어북이란 무엇이며, 여러 캐릭터에 함께 쓰려면 어떻게 하나요?

**로어북**은 세계 설정을 모아 둔 항목의 묶음입니다. 각 항목은 채팅에 그 키워드가 나올 때만 프롬프트에 정보를 더합니다. 덕분에 토큰을 아끼면서 설정을 일관되게 유지합니다. 로어북 하나의 적용 범위를 정하는 방법은 3가지입니다. 상황에 맞는 것을 고르세요:

1. 캐릭터나 페르소나에 연결합니다. 로어북 편집기에서 **Linked Characters**(연결된 캐릭터) 또는 **Linked Personas**(연결된 페르소나)를 채우세요. 그러면 연결한 캐릭터가 들어 있는 채팅이나 연결한 페르소나를 쓰는 채팅에서 로어북이 작동합니다. 두 입력란 모두 여러 개를 받으므로 원하는 캐릭터를 전부 추가하세요.
2. 채팅 하나에 붙입니다. **Chat Settings**를 열고 **Lorebooks**(로어북) 섹션에서 **Add Lorebook**(로어북 추가)을 쓰세요. 특정 채팅에만 해당하는 설정일 때 이 방법을 씁니다.
3. 항목별로 캐릭터를 걸러 냅니다. 공용 로어북 안에서 항목마다 특정 캐릭터가 있을 때만 작동하도록 지정할 수 있습니다. 일부 항목이 특정 캐릭터 전용인 큰 세계관 로어북에 잘 맞습니다.

기능 전체 설명은 [로어북](lorebooks/overview.md)을 참고하세요.

## 에이전트란 무엇인가요?

**에이전트**는 채팅이 진행되는 동안 한 가지 일을 맡아 처리하는 선택형 AI 기능입니다. 현재 장면 추적, 글의 품질 감시, 지도나 통화 추가, Conversation 테이블 게임 진행 등이 그 예입니다. 새로 설치한 상태에는 선택형 에이전트가 하나도 없습니다. **Agents**(에이전트) 패널을 열고 **Download Agents**(에이전트 다운로드)를 클릭한 뒤 항목 설명을 읽고 설치하세요. 그런 다음 **Chat Settings**에서 채팅마다 호환되는 에이전트를 활성화하세요. 설치한 공식 패키지에 호환되는 업데이트가 나오면 Marinara가 다운로드하기 전에 확인합니다. **No**를 고르면 현재 버전이 유지되고, Download Agents에 **Update**가 남아 나중에 쓸 수 있습니다. 호스트가 오프라인이거나 검증에 실패하면 설치된 버전이 그대로 동작합니다. 카탈로그에서 패키지를 통째로 제거할 수도 있습니다. [에이전트](agents/agents-overview.md)와 공개 [Marinara-Agents 저장소](https://github.com/Pasta-Devs/Marinara-Agents)를 참고하세요.

## Noodle은 어떻게 설정하나요?

Noodle은 Marinara에 들어 있는, 캐릭터들이 쓰는 가상의 로컬 소셜 네트워크입니다. **Noodle** 탭을 열고 그 안의 **Settings**(설정)를 여세요. 캐릭터나 캐릭터 폴더를 초대하고, **Refresh**(새로고침) 아래에서 생성에 쓸 연결을 고른 다음, **Refresh now**(지금 새로고침)를 선택해 첫 게시물을 만드세요. 자동 새로고침 시각, 이미지 생성, 무작위 사용자, 채팅으로 이어 가기도 설정할 수 있습니다.

전체 안내는 [Noodle: 앱 안의 소셜 타임라인](noodle/overview.md)과 [Noodle 설정과 채팅 반영](noodle/settings.md)을 참고하세요.

## 캐릭터가 왜 이전 메시지를 기억하지 못하나요?

AI 모델이 한 번에 담을 수 있는 글의 양은 정해져 있습니다. 그래서 채팅이 길어지면 오래된 메시지가 시야에서 밀려납니다. Marinara에는 이를 보완하는 기억 기능이 2가지 있습니다:

- **Memory Recall**(기억 회상)은 이전 메시지를 검색해 가장 관련 있는 부분만 조용히 프롬프트에 다시 넣습니다. **Chat Settings**의 **Memory Recall**에서 켜세요.
- 요약은 오래된 메시지를 짧게 압축합니다. Roleplay 채팅은 **Chat Summary**(채팅 요약)를, Conversation 채팅은 **Automatic Summarization**(자동 요약)을 씁니다.

설정 방법과 자세한 내용은 [Memory Recall과 채팅 요약](agents/memory.md)에서 설명합니다.

## 데이터는 어떻게 백업하나요?

**Settings**를 열고 **Advanced**(고급) 탭으로 이동해 **Backup & Export**(백업 및 내보내기) 섹션에서 **Download Backup**(백업 다운로드)을 클릭하세요. 그러면 데이터와 업로드한 파일이 담긴 `.zip` 파일 하나가 저장됩니다. 나중에 복원할 때는 **Settings**의 **Imports**(가져오기) 탭에서 **Import Profile (JSON/ZIP)**을 쓰고 같은 `.zip` 파일을 고르세요.

같은 섹션에서 매일, 매주, 매월 순환하는 자동 백업을 켤 수도 있습니다. 전체 백업 ZIP 파일에는 암호화된 기록과 그 기록을
푸는 데 필요한 키 파일이 함께 들어갈 수 있으므로 외부에 공개하지 마세요. **Import Profile**은 제공자의 비밀 값을 여전히
비워 두므로, 가져온 뒤에는 키를 다시 입력하세요. 전체 안내는
[백업과 복원](data/backup-and-restore.md)을 참고하세요.

## 확장 기능은 어떻게 동작하며, 외부 코드를 가져올 수 있나요?

기본 상태에서는 Professor Mari만 Personal Extension 초안을 만들 수 있습니다. 초안은 비활성 상태로 시작하며, 코드를 직접 확인하고 정확한 SHA-256 해시를 승인해야 실행됩니다.

브라우저에서 도는 코드는 기본적으로 불투명 출처 iframe 안의 전용 Worker에서 실행됩니다. 제한된 로그 기록, 비공개 저장, 타이머, 정리, 선언형 UI 기능에 더해 현재 활성 채팅과 캐릭터의 불투명 ID를 받으므로, Notepad 같은 확장 기능이 채팅별 상태를 유지할 수 있습니다. Browser Extension은 그 채팅에 참여하는 캐릭터 카드나 그 채팅에 선택된 페르소나에 한정된 스냅샷을 따로 요청할 수 있습니다. 이런 권한은 정확한 해시를 승인할 때 함께 표시되며, 승인하지 않으면 해당 기록은 전달되지 않습니다. 샌드박스 안의 확장 기능은 메시지, 캐릭터나 페르소나 라이브러리 전체, 선언하지 않은 필드, 채팅 메타데이터, DOM 접근, 네트워크 접근, 변경 API를 어떤 경우에도 받지 못합니다. 서버 코드는 지원되는 macOS와 Linux 호스트에서 OS 샌드박스가 적용된 별도 프로세스로 실행되며, 브라우저의 채팅 컨텍스트를 받지 않습니다.

외부 확장 기능 가져오기는 기본적으로 숨겨져 있습니다. 먼저 호스트 운영자가 `.env`에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정해야 하고, 그다음 **Settings → Advanced → Danger Zone**에서 경고에 동의해야 합니다. 두 관문이 모두 열리기 전까지는 외부 기록이, 수동으로 저장한 것이든 프로필로 가져온 것이든, 목록에 나타나지 않고 승인할 수도 실행할 수도 없습니다.

External Extension은 예전 방식과의 호환 때문에 Marinara의 DOM이 정말로 필요할 때 **Full page access**(페이지 전체 접근)를 요청할 수 있습니다. 이 권한에는 샌드박스가 적용되지 않습니다. 승인한 바로 그 코드가 Marinara 페이지 안에서 실행되며, 페이지 내용, 브라우저 저장소, 네트워크 API, 현재의 동일 출처 세션에 접근할 수 있습니다. Professor Mari가 만든 초안은 이 권한을 요청할 수 없습니다. 해당 버전의 코드를 직접 확인하고 믿을 수 있을 때만 켜세요. 껐는데도 등록이 해제되지 않은 변경이 남아 있으면 페이지를 새로 고치세요. [개인 확장](extending/personal-extensions.md)을 참고하세요.

## 데이터는 어디에 저장되나요?

모든 데이터는 Marinara를 실행하는 컴퓨터의 설치 폴더 안 `data` 폴더에 있습니다. 캐릭터, 채팅, 페르소나, 로어북, 프리셋, 설정이 전부 그곳에 저장됩니다. 클라우드에는 아무것도 저장되지 않습니다. [데이터를 저장하는 위치](data/where-data-is-stored.md)를 참고하세요.

## 업데이트하면 데이터가 사라지나요?

아니요. Marinara를 업데이트해도 캐릭터, 채팅, 설정은 그대로 남습니다. 그래도 큰 업데이트 전에는 만일을 대비해 백업해 두는 편이 좋습니다. 플랫폼별 업데이트 방법은 [Marinara Engine 업데이트](UPGRADING.md)를 참고하세요.

## Professor Mari는 무엇을 할 수 있나요?

Professor Mari는 홈 화면에 있는 내장 어시스턴트입니다. **Ask Professor Mari**(Professor Mari에게 묻기) 버튼으로 열 수 있습니다. 앱 사용법을 설명하고 설정을 도와줍니다. 평범한 말로 부탁하면 데이터를 만들거나 고쳐 주기도 합니다. 캐릭터, 페르소나, 로어북, 프롬프트 프리셋(저장해 둔 프롬프트 틀), 새 채팅이 그 대상입니다.

여러 단계에 걸친 생성과 편집을 일일이 입력하지 않아도 되도록, 입력란 위에 빠른 답장 제안 칩도 보여 줍니다.

데이터를 바꾸면 **Keep**(유지)과 **Restore**(복원) 버튼이 있는 확인 카드가 나타나므로, 원하지 않는 변경은 되돌릴 수 있습니다. Professor Mari는 어디까지나 도움을 주는 기능이고, 버전에 따라 달라지는 내용까지 이 가이드를 대신하지는 못합니다. 할 수 있는 일의 전체 목록은 [Professor Mari](home/professor-mari.md)를 참고하세요.

Professor Mari는 평범한 Marinara 소스 파일도 편집할 수 있습니다. 다만 의존성 파일, 런처, 설치 프로그램, CI 워크플로는 명시적인 검토를 기다립니다. 변경에 공개 npm 라이브러리가 필요하면 Marinara가 실제로 확정된 버전과 레지스트리 무결성 정보를 보여 준 뒤, 라이프사이클 스크립트를 끈 채로 설치합니다.

참고: 일반적인 원격 주소에서는 Professor Mari가 데이터를 바꾸는 작업에 Basic Auth와 관리자 시크릿이 모두 필요합니다. 신뢰하는 네트워크나 허용 목록에 있는 경로에서는 [원격 접근](REMOTE_ACCESS.md)에서 설명하는 우회 설정을 쓸 수 있습니다.

## Storyboard 에이전트는 무엇이고 Game Mode에서 어떻게 쓰나요?

다운로드해서 쓰는 **Storyboard** 에이전트는 완성된 이야기 텍스트를 순서가 정해진 키프레임 이미지로 바꾸고, 키프레임마다 짧은 클립으로 움직이게 만들 수도 있습니다. **Game Mode**에서는 완료된 게임 마스터(GM) 서술 턴 하나를 스토리보드로 엮어 플로팅 뷰어나 게임 배경에 프레임을 보여 줍니다. **Roleplay**에서는 새로 오간 대화를 모아 본문 안에 에피소드로 엮습니다.

Game Mode에서 쓰려면 **Agents > Download Agents**에서 **Storyboard**를 설치하세요. 게임을 열고 **Chat Settings > Agents**로 이동해 **Enable Agents**(에이전트 활성화)와 **Enable Storyboards**(스토리보드 활성화)를 켠 다음, 해당 게임이나 전역 Storyboard 설정에서 이미지 연결을 지정하세요. GM 서술 턴을 하나 끝낸 뒤 **Gallery**(갤러리)를 열고 **Create storyboard**(스토리보드 만들기)를 클릭하세요. 뷰어를 다시 열 때는 **View storyboard**(스토리보드 보기)를 쓰세요.

Game 스토리보드를 자동으로 만들려면 **Automatic Storyboard Illustrations**(자동 스토리보드 일러스트)를 켜세요. 클립까지 원한다면 **Automatic Storyboard Animations**(자동 스토리보드 애니메이션)도 켜고 Video Generation 연결을 고르세요. 새 게임 마법사의 **Storyboard Optimized**(스토리보드 최적화) 연출은 GM 서술 방식만 다듬을 뿐, 에이전트를 설치하거나 활성화하지는 않습니다. Game과 Roleplay의 설정, 프롬프트, 뷰어, 마이그레이션 동작, 문제 해결은 [스토리보드 에이전트 가이드](game/storyboard.md)를 참고하세요.

## 통화에서 캐릭터가 소리 내어 말할 수 있나요?

네, **Conversation** 모드에서 됩니다. 음성 통화와 영상 통화는 Conversation 전용 기능입니다. 캐릭터의 목소리를 들으려면 먼저 **Connections** 패널에서 **Text to Speech**(음성 합성)를 설정하세요.

마이크로 말을 걸고 싶은데 브라우저 자체 음성 인식이 미덥지 않다면, 먼저 **Agents > Download Agents**에서 **Calls**를 설치하세요. 그다음 **Connections** 패널을 열고 **Local Model** 카드를 펼친 뒤 **Local Speech Model**(로컬 음성 모델)에서 **Whisper Tiny (Multilingual)** 또는 **Whisper Base (Multilingual)**를 고르고 **Download Whisper**(Whisper 다운로드)를 클릭하세요. Calls를 제거하면 함께 다운로드한 Whisper 파일도 지워져 디스크 공간을 되찾습니다. 통화 설정 전체는 [Conversation 음성 통화와 영상 통화](conversation/calls.md)를 참고하세요.

## Marinara로 이미지를 만들 수 있나요?

네. 이미지 생성 연결을 추가하세요. 예를 들어 키가 필요 없는 **Pollinations**를 쓰거나 유료 제공자를 쓰면 됩니다. 그러면 Marinara가 캐릭터 아바타, 장면 일러스트, 셀카, Roleplay나 Game Mode의 Storyboard 에이전트 키프레임을 만들 수 있습니다. 추가 방법은 [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요.

## 앱 안에서 문서를 읽으려면 어떻게 하나요?

설치본에는 가이드 전체가 함께 들어 있습니다. 앱을 벗어나지 않고 읽을 수 있습니다:

- 홈 화면 아래쪽 **Replay Tutorial**(튜토리얼 다시 보기) 옆에 있는 **Documentation**(문서) 버튼을 클릭하세요.
- 홈 화면의 FAQ에서 문서에 관한 질문을 열고 **Open Documentation**(문서 열기)을 클릭하세요.

두 버튼 모두 같은 앱 내 뷰어를 엽니다. 뷰어는 모든 가이드를 목록으로 보여 주고 Marinara 안에서 바로 표시합니다.

## 도움을 받거나 버그를 신고하려면 어디로 가야 하나요?

증상별로 정리된 [문제 해결](TROUBLESHOOTING.md)부터 확인하세요. 홈 화면 아래쪽의 **Discord** 버튼을 누르면 커뮤니티 채팅이, **Support**(지원) 버튼을 누르면 프로젝트 지원 페이지가 열립니다. 버그 신고와 기능 요청은 프로젝트의 GitHub 페이지를 이용하세요.

## 관련 가이드

- [문제 해결](TROUBLESHOOTING.md)
- [설치](INSTALLATION.md)
- [원격 접근](REMOTE_ACCESS.md)
- [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)
