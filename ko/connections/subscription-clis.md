# Claude, ChatGPT, Grok 구독 연결

세 가지 서비스에서는 API 키 대신 이미 요금을 내고 있는 요금제로 채팅할 수 있습니다. **Claude (Subscription)**, **OpenAI (ChatGPT)**, **Grok CLI (Subscription)**입니다. 작은 명령줄 도구(CLI)를 설치하고 한 번 로그인하면 Marinara Engine이 그 로그인을 재사용합니다. Marinara에 붙여넣을 것은 아무것도 없습니다.

필요한 요금제는 다음과 같습니다.

- **Claude (Subscription)**: Anthropic Pro 또는 Max, 또는 Claude Code가 받아 주는 다른 요금제.
- **OpenAI (ChatGPT)**: ChatGPT 계정. 사용량 한도는 요금제에 따라 다릅니다.
- **Grok CLI (Subscription)**: SuperGrok 또는 X Premium+.

## 구독 계정 추가하기

시작하기 전에 알아 둘 점이 있습니다. CLI는 Marinara 서버를 실행하는 컴퓨터에 설치되어 있고 로그인되어 있어야 합니다. Marinara 화면을 보는 휴대전화나 브라우저가 아닙니다. Marinara가 다른 컴퓨터나 Docker에서 실행된다면 1단계와 2단계를 그곳에서 하세요. `npm` 명령에는 Node.js가 필요하며, 소스에서 Marinara를 설치했다면 이미 있습니다. [설치](../INSTALLATION.md)를 참고하세요.

1. Marinara를 실행하는 컴퓨터에서 터미널을 여세요. 터미널은 명령을 입력하는 창입니다. Windows에서는 PowerShell을, macOS에서는 Terminal을 여세요.
2. 사용하는 서비스의 설치 명령을 실행한 다음 로그인 명령을 실행하세요. 도구가 자체 로그인 단계를 보여 줍니다. 보통은 로그인할 웹 페이지가 열립니다.

| 서비스 | 설치 | 로그인 |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | 아래 참고 | `grok login` |

Grok의 경우 앱에 다음 설치 명령이 표시됩니다. 내 시스템에서 실행되지 않으면 x.ai가 제공하는 Grok CLI 안내를 따르세요.

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. Marinara에서 상단 바의 **Connections**(연결)를 클릭한 다음 **Add**(추가)를 클릭하세요.
4. **Chat**(채팅) 아래에서 사용하는 서비스를 클릭하세요. 이 서비스들에는 **Sign in**(로그인) 태그가 붙어 있습니다.
5. 창에 **Sign in first**(먼저 로그인하세요)라는 안내가 실행할 명령과 함께 표시됩니다. 키 입력란은 없습니다. **Connect**(연결)를 클릭하세요. Marinara가 로그인을 테스트합니다. **Connected**(연결됨)가 표시되면 정상입니다.
6. 목록에서 모델을 고른 다음 **Done**(완료)을 클릭하세요. Grok CLI에서는 모델을 비워 둘 수도 있으며, 그러면 CLI 자체 기본값을 씁니다([Grok CLI (Subscription)](#grok-cli-subscription) 참고).

채팅에서 메시지를 보내 확인하세요. 답변이 오면 정상입니다.

작동하지 않는 경우:

- **Marinara could not use the login on this computer.**(Marinara가 이 컴퓨터의 로그인을 사용할 수 없습니다.) Marinara 컴퓨터에 CLI가 설치되어 있지 않거나 로그인되어 있지 않습니다. 그 컴퓨터에서 로그인 명령을 실행한 다음 **Try again**(다시 시도)을 클릭하세요.

## Claude (Subscription)

여기부터 나오는 섹션은 선택 설정입니다. 채팅하는 데는 필요하지 않습니다.

이 서비스는 Claude Code를 통해 내 Claude 요금제를 사용합니다. 모델 편집기(**Edit model**(모델 편집))에는 추가 컨트롤 세 가지가 있습니다. 프롬프트 캐싱, **Fast mode**(빠른 모드), **Diagnose model routing**(모델 라우팅 진단)입니다.

### 확장 토큰 캐싱

프롬프트 캐싱을 쓰면 Claude가 프롬프트의 앞부분을 재사용하므로, 반복되는 요청이 한도를 덜 씁니다. **Prompt caching → Extended token caching (1 hour)**(프롬프트 캐싱 → 확장 토큰 캐싱(1시간))는 1시간 캐시를 요청하며, 메시지 사이에 쉬는 시간이 있을 때 도움이 됩니다. Claude Code 2.1.242 이상이 필요합니다. Marinara는 이 설정을 요청과 함께 보내며, 저장된 Claude 설정은 바꾸지 않습니다.

꺼져 있으면 Claude는 내 계정에 맞는 자체 기본값을 씁니다. [Claude Code 프롬프트 캐싱](https://code.claude.com/docs/en/prompt-caching)을 참고하세요.

### 빠른 모드

**Fast mode → Use Claude Code fast-mode routing**(빠른 모드 → Claude Code 빠른 모드 라우팅 사용)은 기본값이 꺼짐입니다. 꺼 둔 채로 두세요. Claude Code에 더 빠른 모델 등급을 요청하는 설정이지만, 앱에 따르면 현재 모델에는 그런 등급이 더 이상 없습니다. 그래서 켜도 쓸모 있는 일을 하지 않으며 오히려 부담이 늘 수 있습니다. 켜려고 하면 **Turn on fast mode?**(이 설정은 켜지 마세요!)라는 제목의 대화 상자가 나타납니다. **Keep it off**를 클릭하세요.

### 모델 라우팅 진단

Opus 같은 큰 모델을 요청했는데 더 작은 모델이 응답한 것 같을 때 **Diagnose model routing**을 쓰세요.

1. 모델을 고르세요. 모델을 정하기 전까지 버튼은 비활성 상태입니다.
2. **Diagnose model routing**을 클릭하세요. Marinara가 저장하지 않은 변경 사항을 먼저 저장합니다.
3. 결과를 확인하세요. Marinara가 Claude Code 로그인을 통해 실제 프롬프트를 보내고, 계정에 어떤 모델로 청구되었는지 알려 줍니다.

## OpenAI (ChatGPT)

이 서비스는 Codex CLI를 통해 내 ChatGPT 계정을 사용합니다. Marinara는 로컬 Codex 로그인 파일을 읽고, 가능하면 세션을 갱신합니다.

Codex가 답하기 전에 생각하는 정도를 정하려면 **Edit model**을 열고 **Use custom defaults for this model**(이 연결에 사용자 지정 기본값 사용)을 켠 다음 **Reasoning Effort**(추론 강도)를 고르세요. 처음 값은 **Default**(기본값)이며, Codex가 그 모델에 쓰는 단계를 그대로 유지합니다. 채팅에서는 **Advanced Parameters**(고급 매개변수)에서 따로 단계를 고를 수 있습니다. 프리셋에 지정한 단계는 이 값을 바꾸지 않습니다. 폴백으로 쓰이는 Codex 모델은 자기 단계만 따르며, 그 모델을 쓰는 에이전트는 모델의 단계를 사용합니다. 표시되는 단계는 고른 모델에서 쓸 수 있는 단계와 같습니다.

## Grok CLI (Subscription)

이 서비스는 Marinara 컴퓨터에서 Grok CLI를 실행합니다. 다른 서비스와 다른 점이 두 가지 있습니다.

- 스트리밍을 지원하지 않습니다. 답변이 한 단어씩 나타나지 않고 한꺼번에 표시됩니다.
- 컨텍스트 창의 기본값은 32,000 토큰입니다. 토큰은 모델이 세는 작은 텍스트 조각입니다. 프롬프트가 크면 CLI 자체의 턴 제한에 걸릴 수 있으므로 기본값을 낮게 둡니다. 모델에서 **Max Context Window**(최대 컨텍스트 크기)를 더 크게 설정할 수 있습니다.

모델 편집기의 **Use the Grok CLI default**(Grok CLI 기본값 사용)는 모델을 비워 두어 CLI가 직접 고르게 합니다. 편집기는 `grok-composer-2.5-fast`를 롤플레이에 보통 가장 무난한 모델로 안내합니다. Marinara가 CLI를 헤드리스로 실행하면서 Grok 자체의 도구, 기억 기능, 웹 검색, 계획, 하위 에이전트를 꺼 두기 때문입니다.

## 요금제 사용량

Claude (Subscription)과 OpenAI (ChatGPT) 계정은 요금제 한도를 얼마나 썼는지 보여 줄 수 있습니다.

1. 계정 행의 **⋯**을 클릭하고 **Edit account**(계정 편집)를 고른 다음 **Usage and balance**(사용량 및 잔액)를 여세요.
2. 외부 조회가 꺼져 있으면 **Turn on**(켜기)을 클릭하세요.
3. **Show the usage meter on the card**(카드에 사용량 미터 표시)를 켠 다음 저장하세요.

한도 기간마다 사용한 비율과 초기화 시점을 보여 주는 막대가 표시됩니다. 예를 들면 `58% · resets in 2h`입니다. 이 계정이 활성 상태인 동안에는 같은 막대가 채팅의 연결 선택기와 채팅의 **Connection**(연결) 설정에도 나타납니다. **Shuffle**(셔플)에는 나타나지 않습니다.

- 막대는 Marinara뿐 아니라 요금제의 모든 사용량을 셉니다. Claude라면 Claude Code와 claude.ai가 포함됩니다. ChatGPT라면 Codex CLI 같은 모든 Codex 사용량이 포함됩니다. chatgpt.com의 채팅에는 별도의 한도가 있으며 포함되지 않습니다.
- 서비스는 기간마다 비율만 보고하며 토큰 수는 보고하지 않습니다.
- 한 번 읽을 때마다 Marinara 컴퓨터의 CLI에 CLI 자체 사용량 명령이 보여 주는 것과 같은 데이터를 요청합니다. 모델에 메시지를 보내지 않으며 요금제를 전혀 쓰지 않습니다. 새로고침 버튼을 누르면 다시 읽습니다.
- 기간이 하나뿐인 요금제에는 막대가 하나 표시됩니다.
- Claude Code는 사용량 데이터를 실험적 기능으로 표시합니다. 새 버전에서 이 데이터가 바뀌면 막대에 틀린 숫자 대신 오류와 다시 시도 버튼이 표시됩니다.

## 이 서비스의 제약

- 유료 요금제(또는 조건을 충족하는 ChatGPT 요금제)와 Marinara 컴퓨터에 로그인된 CLI가 필요합니다.
- 세 서비스 모두 임베딩을 제공하지 않습니다. 로어북 시맨틱 검색과 기억 회상에는 임베딩용 계정이 따로 필요합니다.
- **Send test message**(테스트 메시지 전송)는 먼저 모델을 골라야 쓸 수 있습니다. Grok CLI는 예외입니다.

## 관련 가이드

- [AI 제공자에 연결하기](connecting-to-a-provider.md)
- [지원하는 AI 제공자](providers-reference.md)
