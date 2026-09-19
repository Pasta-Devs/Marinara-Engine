# Claude, ChatGPT, Grok 구독 연결

이 가이드에서는 API 키 대신 계정 로그인으로 인증하는 세 가지 연결, **Claude (Subscription)**, **OpenAI (ChatGPT)**, **Grok CLI (Subscription)**을 설명합니다. 작은 명령줄 도구를 설치해 한 번만 로그인해 두면 Marinara Engine이 그 계정으로 채팅합니다. 명령줄 도구(CLI)는 터미널 창에 명령을 입력해서 실행하는 프로그램입니다.

## 구독 연결이란

Marinara Engine의 연결은 대부분 API 키를 씁니다. API 키는 비밀번호 같은 비밀 문자열이며, 연결에 붙여넣으면 AI 서비스가 그 계정으로 요금을 청구합니다.

이 세 가지 연결은 방식이 다릅니다. API 키 대신 로컬 로그인을 사용합니다. 직접 쓰는 컴퓨터에서 CLI에 로그인해 두면 Marinara가 그 로그인을 그대로 재사용합니다. Marinara에 붙여넣을 것은 아무것도 없습니다.

계정에 아래 CLI 중 하나를 통한 이용 권한이 포함되어 있다면 구독 연결을 쓰세요.

- **Claude (Subscription)** 연결은 Anthropic **Pro** 또는 **Max** 구독을 사용합니다.
- **OpenAI (ChatGPT)** 연결은 ChatGPT 계정을 사용합니다.
- **Grok CLI (Subscription)** 연결은 **SuperGrok** 또는 **X Premium+** 계정을 사용합니다.

## 먼저 준비할 것

필요한 계정은 제공자마다 다릅니다.

- **Claude (Subscription)**: Claude Code 구독 로그인을 지원하는 Claude 요금제가 필요합니다.
- **OpenAI (ChatGPT)**: 조건을 충족하는 무료 및 유료 ChatGPT 요금제를 지원합니다. 사용량 한도는 요금제마다 다릅니다.
- **Grok CLI (Subscription)**: SuperGrok 또는 X Premium+가 필요합니다.

세 제공자 모두, Marinara 서버를 실행하는 바로 그 컴퓨터에 CLI가 설치되어 있고 로그인되어 있어야 합니다. Marinara 화면을 보는 브라우저나 휴대전화가 아닙니다. Marinara가 CLI를 로컬에서 실행하므로 로그인 정보도 서버와 같은 곳에 있어야 합니다.

Marinara를 직접 쓰는 컴퓨터에서 실행한다면 그 컴퓨터가 서버입니다. 다른 컴퓨터나 Docker에서 실행한다면 CLI도 그곳에 설치하고 로그인하세요.

## Claude (Subscription)

Anthropic Pro 또는 Max 구독이 필요합니다. Visual Studio Code를 비롯한 다른 Anthropic 도구에서 쓰는 것과 같은 로그인입니다.

1. Marinara를 실행하는 컴퓨터에서 Claude Code CLI를 설치하세요.

```
npm i -g @anthropic-ai/claude-code
```

2. 한 번 로그인하세요.

```
claude auth login
```

3. Marinara에서 **Connections**(연결) 패널을 열고 **New**(새로 만들기)를 클릭하세요.
4. **Create Connection**(연결 만들기) 창에서 이름을 입력하고 제공자로 **Claude (Subscription)**을 고른 다음 **Create**(만들기)를 클릭하세요.
5. 편집기에 **API Key**(API 키) 입력란과 **Base URL**(기본 URL) 입력란이 없는 것을 확인하세요. 필요 없다는 안내 패널이 함께 표시됩니다.
6. **Model**(모델) 드롭다운에서 Opus나 Sonnet 계열 같은 Claude 모델을 고르세요.
7. **Save**(저장)를 클릭한 다음 **Send Test Message**(테스트 메시지 전송)를 클릭하세요. 짧은 답변이 돌아오면 로그인이 정상입니다.

Claude 구독 연결은 텍스트 채팅만 지원합니다. 이 연결에는 **Fast Mode**(빠른 모드)와 **Diagnose Model Routing**(모델 라우팅 진단)이라는 두 가지 추가 컨트롤이 있으며, 아래에서 설명합니다.

## OpenAI (ChatGPT)

ChatGPT 계정이 필요합니다. Marinara는 Codex CLI 로그인을 통해 채팅을 주고받습니다.

1. Marinara를 실행하는 컴퓨터에서 Codex CLI를 설치하세요.

```
npm i -g @openai/codex
```

2. 한 번 로그인하세요.

```
codex login
```

3. Marinara에서 **Connections** 패널을 열고 **New**를 클릭하세요.
4. **Create Connection** 창에서 이름을 입력하고 제공자로 **OpenAI (ChatGPT)**를 고른 다음 **Create**를 클릭하세요.
5. **Model** 드롭다운에서 모델을 고르세요. 목록은 가능하면 ChatGPT 세션에서 가져오고, 그렇지 못하면 내장 목록을 씁니다.
6. **Save**를 클릭한 다음 **Send Test Message**를 클릭해 답변이 오는지 확인하세요.

Marinara는 로컬에 저장된 Codex 로그인 파일을 읽고, 가능한 경우 세션을 자동으로 갱신합니다.

## Grok CLI (Subscription)

SuperGrok 또는 X Premium+ 계정이 필요합니다.

1. Marinara를 실행하는 컴퓨터에서 Grok CLI를 설치하세요.

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. 한 번 로그인하세요.

```
grok login
```

3. Marinara에서 **Connections** 패널을 열고 **New**를 클릭하세요.
4. **Create Connection** 창에서 이름을 입력하고 제공자로 **Grok CLI (Subscription)**을 고른 다음 **Create**를 클릭하세요.
5. 모델을 고르거나, **Model** 입력란을 비워 두어 CLI 기본값을 쓰세요. 롤플레이에는 보통 `grok-composer-2.5-fast`가 가장 무난합니다.
6. **Save**를 클릭한 다음 **Send Test Message**를 클릭하세요. 이 연결은 모델을 고르지 않아도 테스트할 수 있습니다.

Grok CLI에는 특이한 점이 두 가지 있습니다. 스트리밍을 지원하지 않아 답변이 한 단어씩 나타나지 않고 한꺼번에 표시됩니다. 그리고 컨텍스트 창 기본값이 32000 토큰으로 다른 제공자보다 작은데, 프롬프트가 너무 크면 CLI 자체의 턴 제한에 걸리기 때문입니다.

Grok 모델 목록을 불러오려면 **Model** 섹션의 **Fetch Models from Grok CLI** 버튼을 쓰세요.

## Claude 프롬프트 캐시 유지 시간

Claude 연결 편집기의 **Prompt Caching → Extended token caching (1 hour)** 옵션은 메시지 사이에 긴 간격을 둘 수 있도록 1시간 캐시를 요청합니다. Claude Code **2.1.242 이상**이 필요합니다. Marinara는 저장된 Claude 설정을 바꾸지 않고 해당 요청에만 설정을 전달합니다.

옵션을 끄면 기본 대화와 Agent SDK 요청은 Claude의 기본 동작을 따릅니다. 현재 구독 요금제 한도 내 사용은 1시간이며, 추가 사용, 크레딧 또는 API 과금은 5분입니다. Claude Code 자체의 하위 에이전트는 별도로 설정하지 않으면 5분을 사용하며, 서버가 제어하는 일부 보조 요청은 1시간을 사용할 수 있습니다. 이 값을 덮어쓰는 기존 CLI 환경 변수는 계속 우선 적용됩니다. [Claude Code 프롬프트 캐싱](https://code.claude.com/docs/en/prompt-caching)을 참고하세요.

디버그 로그는 SDK가 보고한 사용량에 따라 5분 캐시 쓰기와 1시간 캐시 쓰기를 구분합니다. 비용 환산에는 일반 API 토큰 요금 배수를 사용하며, 구독 청구 금액을 나타내는 것은 아닙니다. SDK가 유지 시간별 쓰기 내역을 제공하지 않으면 추정 비용은 알 수 없는 상태로 남습니다.

## API 키 입력란이 없는 이유

세 구독 제공자 모두 **API Key** 입력란과 **Base URL** 입력란이 숨겨져 있습니다. 의도된 동작입니다. 로그인 정보는 서버 컴퓨터의 CLI 안에 있으므로 Marinara에 입력할 것이 없습니다.

제공자를 잘못 골라서 키 입력란이 보이지 않는 것이라면, 제공자 목록에서 원래 쓰려던 제공자로 다시 바꾸세요. API 기반 제공자에서는 키 입력란이 다시 나타납니다.

## Fast Mode(Claude 전용)

**Claude (Subscription)** 편집기에는 **Fast Mode** 섹션이 있고 그 안에 **Use Claude Code fast-mode routing**(Claude Code 빠른 모드 라우팅 사용) 토글이 하나 있습니다. 기본값은 꺼짐입니다.

그대로 꺼 두세요. 앱 안에서도 이 기능이 지금은 아무 일도 하지 않는다고 안내합니다. Claude Code에 더 빠른 모델 등급을 요청하는 기능이지만, 현재 Claude 모델에는 그런 등급이 없습니다. 켜 봐야 얻는 것은 없고 오히려 부담만 늘 수 있습니다. 이 토글은 Anthropic이 기능을 되살릴 경우를 대비해 화면에 남겨 둔 것뿐입니다.

켜려고 하면 **YOU DON'T WANT THIS SETTING ON!**이라는 제목의 확인 창이 나타납니다. **Keep it off**를 고르세요.

## Diagnose Model Routing(Claude 전용)

**Claude (Subscription)** 편집기의 테스트 영역에는 **Diagnose Model Routing** 버튼이 있습니다. Claude 모델을 하나 요청했는데 더 작은 모델이 응답한 것 같을 때 쓰세요.

1. 모델을 고르고 **Save**를 클릭하세요. 모델을 고르기 전까지 이 버튼은 비활성 상태입니다.
2. **Diagnose Model Routing**을 클릭하세요.
3. 결과를 확인하세요. Marinara가 Claude Code 로그인을 통해 실제 프롬프트를 한 번 보내고, 계정에 실제로 청구된 모델이 무엇인지 알려 줍니다.

Opus 같은 큰 모델을 요청했는데 조용히 Sonnet이나 Haiku로 내려가는 상황을 이 방법으로 잡아낼 수 있습니다.

## 알아 둘 제약

- 이 연결들은 유료 구독과, 서버 컴퓨터에 로그인해 둔 CLI가 있어야 씁니다.
- 세 연결 모두 임베딩을 지원하지 않습니다. 로어북 시맨틱 검색과 기억 기능에는 임베딩용 연결이 따로 필요합니다.
- **Claude (Subscription)** 연결은 텍스트 채팅만 지원합니다.
- **Grok CLI (Subscription)** 연결은 스트리밍을 지원하지 않고, 컨텍스트 창도 작게 시작합니다.
- **Send Test Message**는 모델을 먼저 골라야 쓸 수 있습니다. 다만 Grok CLI는 모델 없이도 테스트할 수 있습니다.

## 관련 가이드

- [AI 제공자에 연결하기](connecting-to-a-provider.md)
- [지원하는 AI 제공자](providers-reference.md)
