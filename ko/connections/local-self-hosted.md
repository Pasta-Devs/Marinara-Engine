# 로컬 모델 또는 자체 호스팅 모델 연결하기

이 가이드에서는 Ollama, LM Studio, KoboldCpp, llama.cpp 같은 프로그램을 통해 내 컴퓨터나 서버에서 돌아가는 AI 모델에 Marinara Engine을 연결하는 방법을 설명합니다. 별도의 서버 없이 Marinara가 직접 실행하는 작은 모델은 [내장 모델 설정](local-model.md)을 참고하세요.

## Custom 연결 만들기

앱에서는 이런 계정을 **OpenAI-compatible**(OpenAI 호환)이라고 부릅니다. 서버가 OpenAI 채팅 API와 같은 요청 형식을 받는다는 뜻입니다. Ollama, LM Studio, KoboldCpp, llama.cpp 모두 이 형식을 받습니다.

시작하기 전에 모델 서버를 설치하고, 실행하고, 모델을 불러오세요. 예를 들어 `ollama.com`에서 Ollama를 다운로드하고 안내에 따라 모델을 받으세요. Marinara는 서버에 연결할 뿐이며 서버를 대신 실행해 주지 않습니다. 서버는 내 컴퓨터의 웹 주소에서 요청에 응답하며, 이 주소를 엔드포인트라고 합니다.

1. 상단 바에서 **Connections**(연결)를 클릭한 다음 **Add**(추가)를 클릭하세요. **Add account**(계정 추가) 창이 열립니다.
2. **Chat**(채팅) 아래에서 사용하는 서버를 클릭하세요. **Ollama**, **LM Studio**, **KoboldCpp**, **llama.cpp** 중 하나입니다. 이 타일에는 **Self-hosted**(자체 호스팅) 태그가 붙어 있습니다. 다른 서버라면 **OpenAI-compatible address**(OpenAI 호환 주소)를 클릭하세요.
3. **Server address**(서버 주소)를 확인하세요. 이름이 나온 네 서버는 주소가 미리 채워져 있습니다. 다른 서버라면 그 서버의 주소를 입력하세요. 아래 표를 참고하세요.
4. **API key (optional)**(API 키, 선택 사항)은 비워 두세요. 대부분의 로컬 서버는 키가 필요 없습니다. 계정에 이름을 붙이려면 **Name (optional)**(이름, 선택 사항)에 입력하세요.
5. **Connect**(연결)를 클릭하세요. Marinara가 주소를 테스트합니다. **Connected**(연결됨)가 표시되면 서버에 접속한 것입니다.
6. 다음 단계는 Main 모델이 이미 있는지에 따라 다릅니다. Main 모델이 없거나 새 채팅에서 Add를 열었다면 창에 서버가 알려 주는 모델이 표시됩니다. 하나를 고르거나 **Search or enter model ID…**(검색 또는 모델 ID 입력…)에 모델 ID를 입력한 다음 **Done**(완료)을 클릭하세요. 이미 Main 모델이 있다면 창이 닫히고 계정이 추가되었다는 메시지가 표시됩니다. 그런 다음 계정의 **⋯**을 클릭하고 **Add model**(모델 추가)을 고르세요.

이제 패널에 계정이 표시됩니다. 본격적으로 쓰기 전에 먼저 테스트하세요([연결 테스트하기](#test-the-connection) 참고).

작동하지 않는 경우:

- **Marinara could not reach**라는 메시지가 나옵니다. Marinara가 그 주소에 접속하지 못했다는 뜻입니다. 서버가 실행 중인지, 주소와 포트가 맞는지 확인하세요. **Continue anyway**(그래도 계속)는 테스트를 통과하지 않은 채로 계정을 저장합니다.
- 주소가 다른 컴퓨터에 있습니다. [다른 컴퓨터의 서버에 연결하기](#reach-a-server-on-another-computer)를 참고하세요.

## 많이 쓰는 로컬 서버의 주소

포트는 서버가 컴퓨터에서 사용하는 번호가 붙은 통로입니다. `localhost`는 지금 이 컴퓨터라는 뜻이므로, Marinara와 서버가 같은 컴퓨터에서 돌아간다면 이 주소를 그대로 쓰면 됩니다.

| 서버 | 주소 |
| --- | --- |
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |
| llama.cpp | `http://localhost:8080/v1` |

**Edit model**(모델 편집)의 주소 입력란에는 "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys."라는 경고가 표시됩니다. 직접 준비했거나 완전히 믿을 수 있는 주소만 입력하세요.

Windows에서는 서버가 실행 중이어도 차단될 수 있습니다. Marinara가 서버를 감지하지 못한다면 Windows Defender 방화벽이 막고 있을 수 있습니다. **Windows Security → Firewall & network protection → Allow an app through firewall**(Windows 보안 → 방화벽 및 네트워크 보호 → 방화벽을 통해 앱 허용)을 열고 Node.js나 사용 중인 서버 프로그램을 추가하세요.

<a id="test-the-connection"></a>

## 연결 테스트하기

**Connect**가 이미 주소를 확인했습니다. 모델 편집기에는 한 번 더 확인할 수 있는 **Provider tests**(연결 테스트) 카드가 있습니다.

1. **Connections** 패널에서 내 모델을 클릭하세요. 모델 편집기가 열립니다.
2. **Test provider**(연결 테스트)를 클릭하세요. 주소에 접속할 수 있는지 확인하고 걸린 시간을 보여 줍니다.
3. 아직 모델을 고르지 않았다면 고른 다음 **Send test message**(테스트 메시지 전송)를 클릭하세요. 짧은 메시지를 보내고 답변을 보여 줍니다.

두 테스트가 모두 통과하면 채팅을 열고 **Model for this chat**(이 채팅의 모델)에서 이 계정을 고르세요. [한 채팅에 쓸 모델 고르기](connecting-to-a-provider.md#choosing-a-model-for-one-chat)를 참고하세요.

테스트가 실패하면 서버가 모델을 불러온 채로 실행 중인지, 주소와 포트가 정확히 일치하는지 확인하세요. 다른 컴퓨터의 서버라면 아래 단계도 확인하세요.

<a id="reach-a-server-on-another-computer"></a>

## 다른 컴퓨터의 서버에 연결하기

`localhost`나 `127.0.0.1` 같은 주소는 언제나 쓸 수 있습니다. 모델 서버가 네트워크의 다른 컴퓨터에 있다면 Marinara는 그 사설 주소를 기본적으로 차단합니다. Marinara 서버를 운영하는 사람이 환경 변수로 허용할 수 있습니다. 환경 변수는 서버가 시작할 때 읽어 들이는 설정입니다.

1. 서버의 `.env` 파일을 여세요. 일반 설치라면 Marinara 프로젝트 폴더에 있습니다. Docker와 Podman은 [서버 설정 참고 문서](../CONFIGURATION.md#edit-the-env-file)를 참고하세요.
2. 다음 줄을 추가하세요.

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

3. 파일을 저장하고 Marinara 서버를 다시 시작하세요.
4. `http://192.168.1.50:11434/v1`처럼 다른 컴퓨터의 주소를 쓰세요.

Android에서는 이 설정을 따로 지정하지 않으면 기본적으로 켜져 있습니다.

## 판정에 모델 사용하기

같은 모델이 두 번째 사본을 불러오지 않고도 에이전트 활성화 확인 같은 판정 질문에 답할 수 있습니다. 패널에서 그 모델의 **⋯**을 클릭하고 **Use this model for decisions**(이 모델을 결정에 사용)를 고르세요. 이 항목은 모델 이름이 있는 OpenAI 호환 모델에 표시됩니다. [Decision 모델](decision-models.md#on-a-server-you-already-run)을 참고하세요.

## Treat as local/custom endpoint 토글

**Edit model**에서 **Local / custom endpoint**(로컬/사용자 지정 엔드포인트) 아래에 **Treat as local/custom endpoint**(로컬/사용자 지정 엔드포인트로 취급) 토글이 있습니다. 기본값은 꺼짐입니다. 계정에 묶여 있지 않은 이전 모델에만 표시됩니다. 지금 추가하는 모델에는 표시되지 않습니다.

알려진 서비스가 아닌 프록시나 자체 호스팅 서버라면 켜세요. 켜면 Marinara가 항상 도구 호출을 시도하며, Professor Mari가 네이티브 도구 호출만 쓰는 대신 대체 도구 방식(JSON 도구 프로토콜)도 쓸 수 있게 됩니다. Professor Mari가 도구를 쓴 뒤 멈추거나, 서버가 OpenAI 호환이라고 하면서 도구 호출을 제대로 처리하지 못한다면 켜세요. 이 토글 없이도 모델이 잘 작동한다면 꺼 두세요.

## 관련 가이드

- [AI 제공자에 연결하기](connecting-to-a-provider.md)
- [내장 모델 설정](local-model.md)
- [Decision 모델](decision-models.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
