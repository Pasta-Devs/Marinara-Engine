# Marinara Engine 문제 해결

이 가이드에서는 Marinara Engine에서 자주 겪는 문제와 해결 방법을 정리했습니다. 증상에 맞는 항목을 찾아 순서대로 따라 하세요. 여기서 해결되지 않으면 마지막 항목인 도움 더 받기를 참고하세요.

## 가장 먼저 해 볼 것

많은 문제는 아래 두 단계만으로 해결됩니다.

1. 페이지를 강제로 새로고침하세요. Windows나 Linux에서는 **Ctrl+Shift+R**, Mac에서는 **Cmd+Shift+R**을 누르세요.
2. Marinara가 실행 중인 터미널 창, 즉 서버 콘솔에 빨간색 오류 줄이 있는지 확인하세요. 대개 그 줄이 진짜 원인을 알려 줍니다.

팀에 도움을 요청할 생각이라면 먼저 **Debug mode**(디버그 모드)를 켜서 서버가 프롬프트와 응답을 기록하게 하세요. 이 가이드 마지막의 도움 더 받기를 참고하세요.

## 설치와 실행 문제

### Windows: pnpm 설치 중 EPERM 또는 corepack 서명 오류

pnpm은 Marinara가 코드를 설치할 때 쓰는 패키지 관리자입니다. `EPERM: operation not permitted`나 corepack 서명 검증 실패가 나타나면 corepack이 Node 설치 폴더에 파일을 쓰지 못한 것입니다.

다음 중 하나를 골라 해결하세요.

1. 터미널을 마우스 오른쪽 버튼으로 클릭하고 Run as administrator를 선택한 다음 런처를 다시 실행하세요.
2. pnpm을 직접 설치하세요. 다음 명령을 실행한 뒤 런처를 다시 실행하세요.

```bash
npm install -g pnpm
```

3. 관리자 권한 터미널에서 corepack을 업데이트한 다음 런처를 다시 실행하세요.

```bash
npm install -g corepack
```

### Windows: 공유 패키지 빌드 중 `'pnpm' is not recognized` 오류

Marinara v2.3.0은 Corepack으로 pnpm을 실행하는 데까지는 성공했지만, 공유 패키지 빌드 단계에서 전역 `pnpm` 실행 파일을 한 번 더 실행하려다 실패했습니다. v2.3.1에서는 이 중첩된 요구 사항을 없앴습니다. 실패한 런처를 닫고 `start.bat`을 다시 실행하면 수정된 빌드 스크립트를 받아 온 뒤 다시 빌드합니다. 데이터를 지울 필요는 없습니다.

체크아웃 자체가 업데이트되지 않으면 Marinara 폴더에서 `git pull`을 실행한 다음 다시 시작하세요. v2.3.0을 그대로 쓴다면 임시 방편으로 고정된 버전의 패키지 관리자를 전역 설치하고, 런처를 다시 실행한 뒤 평소대로 업데이트하세요.

```bash
npm install -g pnpm@10.33.2
```

### Linux: 설치 중 ERR_PNPM_ENAMETOOLONG

이전 설치가 긴 폴더 경로를 남겨 둔 상태입니다. Marinara 폴더에서 중간에 끊긴 설치 파일을 지우고 런처를 다시 실행하세요.

```bash
rm -rf node_modules .pnpm .pnpm-store
```

그런 다음 `./start.sh`로 Marinara를 다시 시작하세요. 직접 설치하는 경우에는 폴더를 지운 뒤 `pnpm install`을 실행하세요.

### 설치 중 ERR_PNPM_TRUST_DOWNGRADE

거의 대부분 설치가 중간에 끝난 상태입니다. 먼저 런처를 다시 실행해 작업 공간을 복구하게 하세요. 직접 설치하는 경우에는 Marinara 폴더에서 다음 명령 하나를 실행하세요.

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## 화면이 비어 있거나 예전 모습으로 보일 때

서버는 돌아가는데 브라우저에 빈 페이지가 뜨거나, 업데이트한 뒤에도 앱이 예전 버전처럼 보일 때가 있습니다. 브라우저가 웹 앱의 캐시된 사본을 붙들고 있어서 생기는 현상입니다.

1. 강제로 새로고침하세요(**Ctrl+Shift+R** 또는 **Cmd+Shift+R**).
2. 그래도 해결되지 않으면 **Settings**(설정)를 열고 **Advanced**(고급) 탭의 **Updates**(업데이트) 항목에서 **Refresh App**(앱 새로고침)을 클릭하세요.

**Refresh App**은 웹 앱을 캐시해 두는 브라우저 서비스 워커(화면 뒤에서 동작하는 스크립트)와 브라우저 캐시를 지운 뒤 페이지를 다시 불러옵니다. 데이터는 바뀌지 않습니다. 채팅과 설정을 비롯해 기기에 저장된 데이터는 그대로 남습니다. 서버 코드는 업데이트하지 않으므로 진짜 업데이트를 대신하지는 못합니다. 앱 자체를 업데이트하려면 [Marinara Engine 업데이트](UPGRADING.md)를 참고하세요.

## 다운로드 에이전트 문제

**Agents → Download Agents**(에이전트 → 에이전트 다운로드)에서 카탈로그를 사용할 수 없다고 나오면, 브라우저뿐 아니라 Marinara 서버가 돌아가는 컴퓨터도 GitHub HTTPS로 공식 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 카탈로그에 접근할 수 있어야 합니다. 이미 설치한 에이전트는 오프라인에서도 현재 버전 그대로 동작합니다. 서버의 연결을 되살린 다음 **Refresh**(새로고침)나 **Try again**(재시도)을 클릭하면 카탈로그를 둘러보고 업데이트를 확인할 수 있습니다.

설치한 지도나 통화 기능이 보이지 않으면 Marinara Engine을 완전히 종료했다가 다시 실행하세요. 경로를 추가하는 이런 패키지는 다음 프로세스 시작 전까지 **Restart required** 상태로 남습니다. Conversation 게임은 다릅니다. 현재 Engine 빌드는 설치 즉시 활성화합니다. 설치가 실패했다면 카탈로그를 새로고침한 뒤 게임이 준비 상태로 표시되는지 확인하세요. 채팅의 **Commands**(명령어) 설정에 게임을 추가하는 것은 캐릭터가 스스로 게임을 시작하게 하고 싶을 때만 필요하며, 슬래시 명령어로 직접 실행할 때는 필요하지 않습니다.

오래된 설치본에서 첫 패키지 마이그레이션이 끝나지 않더라도 `data/capability-packages` 폴더나 채팅 데이터를 지우지 마세요. Marinara는 마이그레이션을 미완 상태로 두고 다음 시작 때 다시 시도합니다. 카탈로그에 접근할 수 없는 동안에도 기존의 채팅 선택과 설정은 그대로 저장되어 있습니다.

패키지의 체크섬, 선언된 파일 목록, Engine 버전 범위, 아카이브 경로가 공식 카탈로그와 다르면 다운로드를 거부합니다. 먼저 Marinara Engine을 업데이트하고 카탈로그를 새로고침한 뒤 다시 시도하세요. 데이터 폴더에 아티팩트를 직접 풀어 넣지 마세요.

에이전트 업데이트는 시작할 때 자동으로 적용되지 않습니다. 호환되는 최신 버전이 있으면 Marinara가 적용할지 묻습니다. **No**를 선택하면 설치된 버전이 그대로 유지되고, **Update** 버튼은 **Agents → Download Agents**에 계속 남아 있습니다. 업데이트가 실패해도 설치된 버전은 등록된 상태로 남고, 새로 업데이트한 서버 런타임이 시작 시 자체 점검에 실패하면 이전 버전으로 되돌아갑니다.

## 다른 기기에서 Marinara에 접근하기

휴대폰, 태블릿, 같은 네트워크의 다른 컴퓨터에서 Marinara에 접근할 수 없다면 아래 항목을 차례로 확인하세요.

- 접근할 수 있는 주소로 서버를 바인딩하세요. 서버는 기본적으로 `127.0.0.1`(루프백, 즉 자기 컴퓨터에서만 접근 가능)에서 요청을 기다립니다. 셸 런처는 `HOST=0.0.0.0`을 알아서 설정해 줍니다. `pnpm start`로 직접 실행했다면 `.env` 파일에 `HOST=0.0.0.0`을 먼저 설정하세요.
- 두 기기가 같은 Wi-Fi 네트워크에 있는지 확인하세요.
- 방화벽이 포트를 막고 있지 않은지 확인하세요. 기본 포트는 `7860`이며, `PORT`로 지정한 값이 있으면 그 포트입니다.
- 접근 제어를 설정하세요. 일반 네트워크나 공개 클라이언트에서 접근할 때는 `.env`에 `BASIC_AUTH_USER`와 `BASIC_AUTH_PASS`를 설정하세요. 루프백은 비밀번호 없이 그대로 쓸 수 있습니다. Tailscale을 통한 직접 통신과 같은 호스트의 Docker 브리지 또는 감지된 컨테이너 게이트웨이는 기본적으로 신뢰합니다. 프록시를 거친 Docker 트래픽은 `REQUIRE_AUTH_FOR_DOCKER_PROXY=false`를 직접 설정하지 않는 한 일반적인 인증이 필요합니다.
- 그 기기에서 백업, 데이터 삭제, 업데이트처럼 권한이 필요한 작업을 하려면 서버 `.env`에 `ADMIN_SECRET`을 설정하세요. 그런 다음 같은 값을 그 기기의 **Settings** > **Advanced** > **Admin Access**(관리자 접근)에 붙여넣고 **Save**(저장)를 클릭하세요.
- 공개 도메인이나 리버스 프록시 도메인을 쓰는데 **Untrusted request host**가 나타나면 `.env`의 `TRUSTED_HOSTS`에 정확한 호스트 이름을 추가하세요. 휴대폰, LAN 컴퓨터, Tailscale 피어가 쓰는 직접 IP 주소는 자동으로 계속 허용됩니다.

전체 절차는 [원격 접근](REMOTE_ACCESS.md)과 [자주 묻는 질문](FAQ.md)을 참고하세요.

## 저장이 차단되거나 설정이 유지되지 않을 때

저장이 된 것처럼 보이는데 다시 불러오면 원래대로 돌아간다면 Marinara의 교차 사이트 보호 기능이 저장을 막고 있는 것입니다. CSRF(교차 사이트 요청 위조) 보호는 데이터를 바꾸는 동작을 지켜 주며, 정해진 브라우저 출처만 신뢰합니다.

다음 중 하나 또는 둘 다 나타납니다.

- 이 출처를 신뢰할 수 없어 저장이 조용히 실패한다는 빨간색 배너가 화면 위쪽에 표시됩니다.
- **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected**, **Save blocked: origin not trusted** 중 하나가 제목인 토스트가 뜹니다.

루프백, 사설 네트워크 주소, Tailscale, Docker 브리지는 자동으로 신뢰합니다. 그래서 이 문제는 보통 공개 IP 주소나 도메인 이름으로 Marinara에 접근할 때만 생깁니다. 해당 주소를 `.env`의 `CSRF_TRUSTED_ORIGINS`에 추가하세요. 둘 이상이면 쉼표로 구분해 나열합니다. 예를 들면 다음과 같습니다.

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

다시 시작할 필요는 없습니다. 배너의 Copy 버튼을 누르면 필요한 줄이 그대로 입력됩니다. 자세한 내용은 [원격 접근](REMOTE_ACCESS.md)을 참고하세요.

## 연결과 생성 오류

생성 오류는 화면 아래쪽에 토스트로 표시됩니다. 연결에 실패했다면 토스트가 원인을 알려 줍니다. 토스트는 읽고 복사할 수 있을 만큼 오래 떠 있습니다.

- **No API connection configured for this chat**: 채팅에 연결이 선택되어 있지 않습니다. **Connections**(연결) 패널을 열어 연결을 만든 다음 채팅에 지정하세요. [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)를 참고하세요. API 키는 제공자가 발급하는 비밀 문자열이며, 이 값이 있어야 Marinara가 그 제공자의 모델을 쓸 수 있습니다.
- 모델이 특정 파라미터를 받지 않는 경우: 어떤 파라미터인지는 토스트에 나옵니다. **Chat Settings**(채팅 설정) > **Advanced Parameters**(고급 매개변수)를 열고 그 파라미터를 찾으세요. 이름 옆의 스위치를 끄면 됩니다(툴팁에 "This parameter is sent to the model"이라고 표시됩니다).
- 모델이 특정 파라미터를 요구하는 경우: 같은 방법으로 찾은 다음, 그 파라미터 옆의 스위치를 켜세요.
- **The AI returned an empty response. Try sending your message again.**: 메시지를 다시 보내세요. 같은 문제가 계속되면 다른 모델이나 다른 연결로 바꿔 보세요.
- **A generation is already in progress for this chat**: 답변 하나가 아직 스트리밍 중입니다. 끝날 때까지 기다리거나 Stop 버튼을 클릭한 뒤 다시 시도하세요.
- **No connections are marked for the random pool**: 무작위 연결 라우팅을 켰지만 후보로 지정한 연결이 하나도 없습니다. 후보에 연결을 하나 이상 추가하거나 무작위 라우팅을 끄세요.

## Local Model 문제

**Local Model**(로컬 모델)은 API 키 없이 자기 컴퓨터에서 돌아가는 AI 모델입니다. 일부 오류 메시지에서는 이 기능을 사이드카라고 부릅니다.

- 런타임 설치가 **Sidecar runtime install is disabled**로 실패하면 서버가 안전을 위해 이 동작을 꺼 둔 것입니다. 자기 컴퓨터에서는 `.env`에 `SIDECAR_RUNTIME_INSTALL_ENABLED=true`를 설정하세요. 다른 기기에서 작업한다면 먼저 관리자 시크릿을 **Settings** > **Advanced** > **Admin Access**에 붙여넣으세요.
- 모델 다운로드나 설정이 다른 기기(네트워크 주소나 Docker)에서 실패한다면 이때도 관리자 시크릿이 필요할 수 있습니다. 자기 컴퓨터에서는 관리자 시크릿이 필요 없습니다. 시크릿을 붙여넣는 위치는 바로 위 항목을 참고하세요.
- 함께 제공되는 llama.cpp, MLX, uv, MLX 의존성 잠금 파일 검사에서 파일 크기나 SHA-256이 맞지 않는다고 나오면, Marinara가 압축을 풀거나 설치하기 전에 그 파일을 버렸거나 거부한 것입니다. Marinara를 업데이트하거나 다시 설치한 뒤 재시도하세요. 거부된 아티팩트를 직접 실행하거나 풀거나 편집하거나 검사를 우회하지 마세요.

### 메인테이너용: 고정된 로컬 런타임 업데이트

GitHub가 생성하는 소스 아카이브는 커밋 내용이 그대로여도 바이트 단위까지 똑같이 유지된다는 보장이 없습니다. 사용자 컴퓨터에서 나온 바이트를 그대로 받아들이거나 검증을 느슨하게 만들어 불일치를 "해결"하지 마세요. 런타임 입력을 다시 고정하는 작업은 검토를 거친 Engine 변경으로만 진행합니다.

1. 변하지 않는 업스트림 리비전이나 릴리스 자산을 고르고 업스트림 변경 사항을 검토하세요.
2. 아티팩트를 임시 폴더에 다운로드하고 정확한 바이트 수를 기록한 뒤 SHA-256 다이제스트를 직접 계산하세요.
3. `runtime-integrity-manifest.ts`에 리비전, URL, 크기, 다이제스트를 반영하세요. MLX는 Apple Silicon과 Python 3.12 환경에서 고정된 uv 버전으로 `.in` 파일에서 `packages/server/src/assets/mlx-runtime-requirements.lock`을 다시 생성하고, 의존성 변경을 하나하나 검토한 다음 `requirementsLockSha256`을 업데이트하세요.
4. `pnpm regression:runtime-integrity`와 `pnpm check`를 실행하고, 해당 플랫폼에서 실제로 런타임을 처음부터 설치해 보세요.
5. 검토를 마친 Engine 업데이트를 배포한 뒤에 사용자에게 재시도를 안내하세요. 체크섬을 수동으로 무시하는 수단은 제공하지 마세요.

전체 설정 방법은 [Local Model 설정](connections/local-model.md)을 참고하세요.

## 기억 기능과 요약

### Memory Recall이 아무것도 기억하지 못할 때

**Memory Recall**(기억 회상)은 이전 메시지를 검색해 가장 관련 있는 내용을 프롬프트에 조용히 다시 넣어 줍니다. 아무것도 기억하지 못하는 것 같다면 다음을 확인하세요.

1. **Chat Settings** > **Memory Recall**을 열고 **Enable Memory Recall**(이전 기억 불러오기)이 켜져 있는지 확인하세요.
2. **Access memories for this chat**(이 채팅의 기억에 접근)을 여세요. **Memories for This Chat**(이 채팅의 기억) 창에서 각 조각의 상태를 확인하세요.
3. 상태가 **Waiting for vector**이면 기억을 아직 처리하는 중입니다. 잠시 기다렸다가 다시 채팅하세요.
4. 상태가 **Embedding unavailable**이면 동작하는 임베딩 소스가 하나도 없다는 뜻입니다. 임베딩용 연결을 설정하거나, 내장 로컬 모델이 로드되도록 두세요. [Local Model 설정](connections/local-model.md)을 참고하세요.

기억은 새 메시지가 5개 이상 쌓여야 만들어집니다. 또한 회상은 새로 보낸 메시지와 많이 비슷한 기억만 보여 주므로, 기억이 있어도 아무것도 나오지 않을 수 있습니다.

### 요약이 생성되지 않을 때

채팅 요약을 만들려면 동작하는 텍스트 연결이 필요합니다.

- Roleplay 모드에서는 **Chat Summary**(채팅 요약) 팝오버를 열고 연결이 지정되어 있는지 확인하세요. 오래된 채팅을 따라잡으려면 **Backfill Summary**(요약 백필)를 쓰세요.
- Conversation 모드에서는 **Automatic Summarization**(자동 요약)을 열고 **Backfill**(백필)로 실패한 날짜를 다시 시도하세요.
- 채팅에서 에이전트 쓰기 승인을 요구하도록 설정했다면 AI 요약은 검토를 거쳐야 반영됩니다.
- 잘못된 API 키처럼 어떤 이유로든 요약이 계속 실패하면 시간을 두고 다시 시도합니다. 연결을 고친 다음 **Backfill**을 쓰세요.

## Card Browser 문제

**Card Browser**(카드 브라우저)에서는 공개 캐릭터 사이트를 검색해 캐릭터를 가져올 수 있습니다. 상단 바의 **Card Browser** 아이콘으로 연 다음 **Download Cards**(카드 다운로드)를 클릭하세요.

- JannyAI 검색이나 캐릭터 페이지가 Cloudflare 차단으로 실패하면 Marinara가 안내 메시지를 보여 줍니다. 같은 브라우저에서 JannyAI 사이트에 한 번 접속해 차단을 푼 뒤 다시 시도하라는 내용입니다.
- 서버를 다시 시작한 뒤 CharacterTavern이나 Pygmalion 로그인이 풀리는 것은 정상입니다. 이 로그인 정보는 서버 메모리에만 있어서 다시 시작하면 사라집니다. 로그인 창을 열고 쿠키나 토큰을 다시 붙여넣으세요.

## 미디어 생성 문제

### 복잡한 장면에서 스프라이트 배경 정리가 잘 되지 않을 때

생성한 정지 스프라이트는 보통 투명도를 그대로 쓰거나, 화면에 맞춰 고른 단색 크로마 매트를 씁니다. 내장 정리 기능은 예전 방식인 흰색 매트도 인식하고, 피사체 안쪽의 세부를 살리며, 알파 가장자리를 부드럽게 다듬고, 매트 색이 번진 부분을 없앱니다. 다만 사진으로 찍은 방, 세밀한 풍경, 짙은 그림자, 배경과 색이 비슷한 피사체는 선택 사항인 AI 대체 방식이 필요할 수 있습니다.

```bash
pnpm backgroundremover:install
```

그런 다음 Marinara를 다시 시작하고 스프라이트 생성 창에서 **Reapply Cleanup**(정리 다시 적용)을 클릭하세요. 이때도 Marinara는 내장 매트 방식을 먼저 시도하고, 가장자리가 고르지 않을 때만 AI 모델을 씁니다. 설치가 실패하면 다음을 확인하세요.

- Python 3.9에서 3.11까지의 버전이 설치되어 있는지 확인하세요. 더 최신 버전에서는 느린 네이티브 빌드로 넘어갈 수 있습니다.
- `pnpm backgroundremover:reinstall`로 도구를 다시 빌드하세요.
- 문제를 살펴보는 동안 AI 대체 방식 없이 자동 매트 정리만 쓰려면 `.env`에 `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin`을 설정하세요.

### Game Mode나 Roleplay 스토리보드가 나타나지 않을 때

Game Mode Storyboards는 완성된 GM 서술을 키프레임 이미지와 선택 사항인 클립으로 만들어 줍니다. Roleplay Storyboards는 주고받은 메시지를 묶어 어시스턴트 응답 뒤에 결과를 바로 보여 줍니다.

- **Agents** > **Download Agents**에서 **Storyboard**를 설치했는지 확인한 다음, 해당 채팅에서 **Enable Agents**(에이전트 활성화)와 **Enable Storyboards**(스토리보드 활성화)를 켜세요.
- 장면 동영상을 직접 만들려면 먼저 **Gallery**(갤러리) 이미지를 생성하거나 업로드한 다음 그 이미지의 **Video**(비디오) 또는 **Animate** 동작을 쓰세요. **Gallery**는 **Images**(이미지)와 **Videos**(동영상)를 탭으로 나누므로 **Videos** 탭을 확인하세요.
- Game Mode Storyboards를 자동으로 쓰려면 **Chat Settings** > **Agents**(에이전트) > **Storyboards**(스토리보드)를 열고 **Automatic Storyboard Illustrations**(자동 스토리보드 일러스트)가 켜져 있는지 확인하세요. 클립까지 원한다면 **Automatic Storyboard Animations**(자동 스토리보드 애니메이션)도 켜세요.
- Roleplay에서는 채팅에 **Storyboard** 에이전트를 추가하세요. **Still images**(정지 이미지)나 **Animations**(애니메이션)를 고르고 **Messages per episode**(에피소드당 메시지 수)를 설정한 다음 스토리보드용 이미지 연결을 선택하세요. **Manual only**로 두면 갤러리의 **Create storyboard**(스토리보드 만들기)에서 직접 실행합니다.
- 키프레임 이미지에는 이미지 연결이 필요합니다. 클립에는 동영상 연결도 필요합니다.
- 모든 캐릭터를 한데 묶은 사용자 지정 프롬프트가 더 잘 맞는다면 **Use NovelAI Character Prompts**(NovelAI 캐릭터 프롬프트 사용)를 끄세요.
- 느린 제공자에서는 시간 초과가 날 수 있습니다. `.env`의 `IMAGE_GEN_TIMEOUT_MS`나 `VIDEO_GEN_TIMEOUT_MS` 값을 늘린 다음 Marinara를 다시 시작하세요. 서버는 이 값을 시작할 때만 읽습니다.

두 워크플로에 대한 설명은 [스토리보드 에이전트 가이드](game/storyboard.md), 게임 준비 방법은 [Game Mode: 시작하기](game/getting-started.md)를 참고하세요.

### Game Mode 세계 생성에서 JSON 오류가 날 때

모델이 잘못된 JSON을 돌려줘서 게임 시작이 실패하면 Marinara는 턴 전체를 버리지 않고 **Repair JSON** 창을 엽니다. JSON은 모델이 반드시 지켜서 돌려줘야 하는 구조화된 텍스트 형식입니다.

1. 편집기에서 괄호, 쉼표, 필드를 고치세요. 텍스트가 제대로 해석되면 배너에 **JSON is valid.**라고 표시됩니다.
2. **Format**(형식 정리)을 클릭하면 형태가 보기 좋게 정리됩니다.
3. **Apply Repaired JSON**(수정한 JSON 적용)을 클릭하면 응답 전체를 다시 생성하지 않고 그대로 사용합니다.

## 음성, 통화, TTS

- 통화 중에 캐릭터가 말하지 않으면 Text to Speech가 설정되지 않은 것입니다. **Connections** > **Text to Speech**(음성 합성)를 열어 켜고, 소스를 고르고, 키를 입력하고, 목소리를 고른 다음 저장하세요. 목소리가 없는 캐릭터는 텍스트로만 나옵니다.
- 마이크가 동작하지 않으면 로컬 음성 모델이 필요할 수 있습니다. **Agents > Download Agents**에서 **Calls**를 설치한 다음 **Connections** > **Local Model**을 열고 카드를 펼쳐 **Local Speech Model**(로컬 음성 모델)을 찾아 Whisper 모델을 고르고 **Download Whisper**(Whisper 다운로드)를 클릭하세요. 특히 Firefox는 브라우저 음성 인식 기능이 없어서 이 과정이 필요합니다. Calls를 제거하면 디스크 공간 확보를 위해 Whisper 모델도 함께 삭제됩니다.
- Lite 빌드에서 **Local Whisper is disabled in Lite mode** 메시지가 나오면, 그 경량 빌드로는 로컬 음성 모델을 돌릴 수 없다는 뜻입니다. 대신 일반 Marinara 설치본을 쓰세요.

### 원격이나 네트워크 설치 환경에서 Music DJ의 Spotify 로그인이 실패할 때

Music DJ 에이전트의 Spotify 모드는 OAuth를 씁니다. OAuth는 Spotify가 로그인을 대신 처리한 뒤 콜백 주소로 되돌려 보내는 방식입니다. 리디렉션 URI가 바로 그 콜백 주소이며, Spotify는 `https://` 주소나 루프백 주소 `http://127.0.0.1`만 받아들입니다. 일반 네트워크 IP 주소는 거부합니다.

- localhost로 Marinara에 접근한다면 편집기에 `127.0.0.1` 콜백이 표시됩니다. 그 주소를 Spotify에 등록하면 로그인이 완료됩니다.
- HTTPS로 Marinara에 접근한다면 편집기에 HTTPS 콜백이 표시됩니다. 그 주소를 등록하세요.
- HTTPS가 앞단에서 끝나고 호스트가 일치하지 않으면 `.env`의 `SPOTIFY_REDIRECT_URI`에 공개 콜백 주소를 설정하세요.
- 일반 HTTP 네트워크 설치 환경에서는 팝업이 열리지 않지만 주소 표시줄에는 유효한 코드가 그대로 남아 있습니다. 팝업에서 전체 URL을 복사하세요. 그런 다음 Connect 버튼 아래의 **Browser couldn't reach the callback?**을 펼쳐 붙여넣으세요. 붙여넣은 URL은 10분 동안 유효합니다.

장기적으로 가장 깔끔한 해결책은 서버를 HTTPS 뒤에 두는 것입니다. Marinara Engine 2.2.0 기준으로 확인했습니다. Spotify는 2025년 2월에 이 규칙을 강화했습니다.

## 저장소와 데이터

### 업데이트 후에 데이터가 사라진 것처럼 보일 때

업데이트한 뒤 채팅이나 프리셋이 사라진 것처럼 보이더라도 아직 데이터 폴더를 지우지 마세요. Marinara는 실제로 쓰는 데이터를 데이터 폴더 안의 `storage` 폴더에 보관합니다.

컴퓨터의 다음 두 위치에 `storage` 폴더가 있는지 모두 확인하세요.

1. `packages/server/data/`
2. `data/`

서버는 시작할 때 자신이 찾아낸 데이터 폴더와 storage 폴더 경로를 출력합니다.

### 백업이나 내보내기에서 403이 반환될 때

루프백 세션에서는 관리자 시크릿 없이도 백업을 만들 수 있습니다. 다른 기기, 네트워크 주소, Docker에서 접근할 때는 백업과 프로필 내보내기에 추가 절차가 필요합니다. 서버에 `ADMIN_SECRET`을 설정하고 같은 값을 **Settings** > **Advanced** > **Admin Access**에 저장하세요. 루프백에서도 시크릿을 요구하려면 `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`를 설정하세요.

## Android와 Docker

### Android 앱이 Connecting이나 Waiting for Server에서 멈출 때

Android 앱은 Termux를 감싼 얇은 껍데기입니다. Termux는 Android용 Linux 터미널 앱이고, 실제 Marinara 서버는 그 안에서 돌아갑니다.

1. **Install / Start Marinara**를 탭하세요.
2. Android가 Termux 설치를 물으면 안내에 따라 허용하세요.
3. Android가 Termux에서 명령을 실행해도 되는지 물으면 허용하세요.
4. 런처가 끝나고 서버가 시작될 때까지 기다린 다음 앱으로 돌아오세요.

앱과 Termux가 같은 포트를 쓰는지도 확인하세요. 기본값은 `7860`입니다. 다른 포트로 앱을 빌드했다면 Termux의 `.env`에도 같은 `PORT`를 설정하세요.

### Android localhost에서 로그인 페이지가 열리거나 401/503이 반환될 때

APK가 관리하는 Termux 설치는 설치마다 다른 비공개 비밀 값으로 localhost를 보호합니다. Android 앱은 자동으로 인증합니다. 같은 휴대폰의 다른 브라우저에서는 `/android-login`을 열고 다음 Termux 명령으로 표시된 값을 붙여 넣으세요.

```bash
cat ~/.marinara-engine/android-secret
```

로컬 `mari` CLI도 같은 파일을 자동으로 읽습니다. 401은 붙여 넣은 비밀 값이나 인증 챌린지가 거부되었다는 뜻입니다. `/android-login`을 새로 고치고 현재 값을 붙여 넣으세요. 503은 서버가 잘못된 형식으로 설정된 비밀 값을 받았다는 뜻입니다. `./start-termux.sh`로 다시 시작하세요. 런처에서 비밀 파일이 잘못되었거나 비어 있다고 알리면 Android 앱으로 돌아가 **Install / Start Marinara**를 탭하여 APK가 다시 만들게 하세요. 이 비밀 값을 스크린샷이나 문제 보고서에 넣지 마세요.

### Android 업데이트가 종료 코드 134로 멈출 때

종료 코드 134는 대개 빌드 도중 Android의 메모리가 부족했다는 뜻입니다. 최신 런처로 다시 업데이트하세요.

```bash
./start-termux.sh
```

그래도 멈춘다면 다른 Android 앱을 종료하고 Termux를 다시 연 다음 명령을 한 번 더 실행하세요.

### Marinara 실행 중 Termux가 종료되거나 다시 시작될 때

서버가 실행되는 동안 런처는 Android wake lock을 요청하고 각 서버 세션을 `~/.marinara-engine/logs/`에 저장합니다. 예기치 않게 다시 시작된 뒤에는 가장 최신 `server-*.log` 파일을 보고서에 첨부하세요. 파일 끝에 Marinara 또는 Node 오류가 없다면 Android나 휴대전화 제조사가 서버 프로세스 밖에서 Termux를 종료했을 가능성이 큽니다.

Android 설정에서 Termux의 백그라운드 실행을 허용하고 배터리 최적화 대상에서 제외하세요. Termux:API 부가 기능을 지원하는 기기에서는 해당 부가 기능과 `termux-api` 패키지를 설치해 `termux-wake-lock`을 사용할 수 있게 하세요. 모든 제조사별 프로세스 종료를 막을 수는 없지만, 흔한 유휴 정지 원인을 없애고 영구 로그에 애플리케이션 수준 오류의 증거를 남길 수 있습니다.

### 의존성을 설치하다가 Android 저장 공간이 부족해질 때

빌드된 Marinara 앱은 몇 기가바이트나 되지 않고, Noodle도 자체 AI 모델을 다운로드하지 않습니다. 업데이트 도중 임시로 용량을 많이 차지하는 원인은 대개 pnpm의 의존성 저장소와 가상 저장소이며, 여러 릴리스를 거쳤거나 강제 재설치가 중간에 끊긴 뒤에 특히 심합니다.

현재 런처는 예전 릴리스에서 남은 패키지를 정리하고, 같은 업데이트에서 의존성 저장소를 두 번 이상 새로 만들지 않습니다. 예전 런처가 이미 기기를 가득 채웠다면 런처를 업데이트하고 참조되지 않는 캐시를 비운 다음 다시 시도하세요.

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

`data`, `storage`, `marinara-engine.db`는 지우지 마세요. 채팅과 설정이 들어 있을 수 있습니다. 명령이 그래도 멈춘다면 `Installing dependencies`부터 시작하는 줄을 그대로 모으고, 휴대폰의 남은 저장 공간과 메모리 수치를 함께 적어 보고하세요.

### Android에서 Stable과 Staging을 오갈 때 앱 내 업데이트가 실패할 때

채널을 바꾸면(Stable ↔ Staging) 의존성을 거의 전부 다시 설치하게 되는데, 저장 장치가 느린 Termux에서는 보통 업데이트보다 훨씬 오래 걸립니다. 이제 앱 내 업데이트 기능이 Android에서는 각 단계에 시간을 더 줍니다. 예전에 `Update failed: Command failed: corepack pnpm ... install`만 남기고 멈추던 채널 전환도 이제는 끝까지 진행됩니다.

그래도 업데이트가 실패하면 오류 메시지에 어느 단계에서 실패했는지와 그 단계 출력의 마지막 부분이 함께 나옵니다. 그 메시지를 읽어 보세요. 실제 의존성 문제나 잠금 파일 오류는 거기에 적혀 있습니다. 오류 힌트에 나온 수동 명령으로 Termux에서 직접 업데이트할 수도 있고, 먼저 공간을 확보할 수도 있습니다.

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

### Noodle에 `Etc/Unknown`이 표시되거나 스케줄의 시간대가 어긋날 때

Conversation 스케줄은 Conversation Chat Settings나 캐릭터 스케줄 편집기를 열고 **Schedule timezone**(스케줄 시간대)을 고르세요. 이 선택은 전역으로 적용되어 화면 뒤에서 보내는 자율 메시지를 포함한 모든 Conversation 채팅에 반영되며, **Use device**(기기 설정 사용)로 되돌릴 수 있습니다.

Conversation에서 따로 지정하지 않은 Noodle이나 서버 작업은 `.env`에서 비어 있는 `TZ=` 줄을 지우고 Marinara를 다시 시작해 서버가 호스트의 시간대를 물려받게 하세요. 호스트 기본값을 직접 정하려면 `TZ=Europe/Warsaw`나 `TZ=America/New_York` 같은 유효한 IANA 이름을 설정하세요. 현재 릴리스는 빈 값을 설정하지 않은 것으로 처리하지만, Node의 시간대 상태와 예약 작업을 일관되게 다시 만들려면 여전히 다시 시작해야 합니다.

### 볼륨 마운트에서 컨테이너 권한이 거부될 때

Docker나 Podman 컨테이너가 데이터 볼륨에서 권한 오류로 실패한다면 다음을 확인하세요.

- 업데이트 후 이름 있는 볼륨을 쓴다면 최신 이미지를 받아 `docker compose pull && docker compose up -d`로 다시 시작하세요. 공식 이미지는 시작할 때 소유권을 바로잡습니다.
- 바인드 마운트를 쓴다면 호스트 폴더를 사용자 및 그룹 ID `1000`이 쓸 수 있게 하거나, 이름 있는 볼륨으로 바꾸세요.
- Fedora, RHEL처럼 SELinux를 쓰는 시스템에서는 볼륨 마운트에 `:Z` 접미사를 붙이세요.

### Raspberry Pi 4에서 Lite 컨테이너가 크래시할 때

Raspberry Pi 4나 비슷한 ARM 기기에서 AI 요청을 보낼 때마다 lite 컨테이너가 다시 시작된다면 종료 코드를 확인하세요. 종료 코드 132나 SIGILL이라면 일부 ARM 칩에서 lite 이미지의 Node 빌드에 생기는 알려진 업스트림 문제입니다. SIGILL은 CPU가 실행할 수 없는 명령을 프로그램이 만났다는 뜻입니다.

일반(lite가 아닌) 이미지는 영향을 받지 않습니다. 업스트림 수정이 나오기 전까지는 그 기기에서 일반 이미지를 쓰세요. 영향을 받는 것으로 알려진 lite 이미지는 `1.5.7-lite`와 `1.5.8-lite`입니다. Marinara Engine 2.2.0 기준으로 확인했습니다.

### Addons에 External Extensions가 보이지 않을 때

이 항목은 두 안전 관문이 모두 열릴 때까지 일부러 숨겨 둡니다.

1. 호스트의 `.env`에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정하세요.
2. 설정 감시기가 변경을 읽어 갈 때까지 2초 정도 기다린 다음 **Settings → Advanced → Danger Zone**을 열고 데이터 삭제 관련 항목 아래로 스크롤해 **Allow third-party extension imports**(서드파티 확장 가져오기 허용)를 켜세요.

Danger Zone의 스위치가 비활성화되어 있다면 호스트 쪽 플래그가 아직 false이거나 앱이 변경을 아직 감지하지 못한 것입니다. [서버 설정](CONFIGURATION.md)에서 설명하는, 실제로 사용 중인 `.env` 경로를 편집했는지 확인하세요. Docker에서는 보통 `/app/data/.env`입니다.

관문 중 하나라도 닫혀 있으면 외부, 레거시, 프로필로 가져온, 수동으로 저장한, 출처를 알 수 없는 확장 기록은 표시되지도 실행되지도 않습니다. 관문을 다시 열어도 자동으로 다시 활성화되지는 않습니다.

### 가져온 브라우저 확장이 나타나지만 동작하지 않을 때

**Settings → Addons → External Extensions**에서 확장을 열고 **Requested access**를 확인하세요. 기능 선언 없이 `marinara.extension` v1 형식을 쓰는 예전 패키지는 **Full page access**(페이지 전체 접근)로 표시됩니다. 직접 확인하고 신뢰하는 해시만 승인하세요.

예전 패키지를 기능 목록이 비어 있는 상태로 다시 내보냈다면 Marinara는 안전한 샌드박스 확장으로 취급합니다. 이 경우 DOM에 의존하는 코드는 동작하지 않습니다. 매니페스트에 `full_page_access`를 추가하는 것은 그 코드가 Marinara 페이지 전체, 브라우저 저장소, 네트워크 API, 같은 출처의 세션에 접근하게 된다는 점을 이해했을 때만 하세요.

전체 페이지 확장을 비활성화한 뒤에도 툴바 항목, 오버레이, 리스너, 화면 변화가 남아 있다면 Marinara를 새로고침하세요. 페이지 코드는 Marinara가 관리하는 호환성 API 밖에서도 부작용을 만들 수 있어서 정리는 최선을 다하는 수준입니다.

### Server Extension이 지원되는 샌드박스가 없다고 할 때

Server Extension은 macOS Seatbelt나 Linux Bubblewrap이 있어야만 실행됩니다. Linux 호스트에 `bwrap`을 설치한 다음 Marinara를 다시 시작하세요. Windows, Android를 비롯해 지원되지 않는 호스트에서는 메인 서버 프로세스로 대신 실행하지 않고 일부러 Server Extension 실행을 거부합니다. Browser Extension은 그대로 불투명 출처 Worker 샌드박스를 쓸 수 있습니다.

## 도움 더 받기

그래도 해결되지 않으면 먼저 자세한 정보를 모으세요.

1. **Settings** > **Advanced** > **Message Tools**(메시지 도구)를 열고 **Debug mode**를 켜세요. 그러면 프롬프트와 응답 페이로드가 서버 콘솔에 기록되어 그대로 공유할 수 있습니다.
2. 운영 체제, Node.js 버전, 서버 콘솔의 오류 전문을 적어 두세요.

디버그 출력을 공유하기 전에 API 키, 접근 토큰, 관리자 시크릿, 비공개 프롬프트, 비공개 채팅 내용은 지우세요.

그런 다음 커뮤니티에 문의하세요.

- 열려 있는 이슈 읽어 보기: https://github.com/Pasta-Devs/Marinara-Engine/issues
- 커뮤니티의 도움을 받을 수 있는 Discord 참여하기: https://discord.com/invite/KdAkTg94ME
- 위에서 모은 정보를 담아 버그 리포트 등록하기: https://github.com/Pasta-Devs/Marinara-Engine/issues

## 관련 가이드

- [자주 묻는 질문](FAQ.md)
- [서버 설정 참고 문서](CONFIGURATION.md)
- [원격 접근](REMOTE_ACCESS.md)
- [Marinara Engine 업데이트](UPGRADING.md)
- [AI 제공자에 연결하기](connections/connecting-to-a-provider.md)
- [Local Model 설정](connections/local-model.md)
- [Game Mode: 시작하기](game/getting-started.md)
- [설정 개요](settings/settings-overview.md)
