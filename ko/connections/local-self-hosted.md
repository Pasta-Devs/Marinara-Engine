# 로컬 모델 또는 자체 호스팅 모델 연결하기

이 가이드에서는 직접 쓰는 컴퓨터나 서버에서 돌아가는 AI 모델에 Marinara Engine을 연결하는 방법을 설명합니다. Ollama, LM Studio, KoboldCpp처럼 많이 쓰는 로컬 모델 서버와 그 서버를 쓰는 데 필요한 설정을 함께 다룹니다.

## 자체 호스팅이란

자체 호스팅 모델은 직접 관리하는 하드웨어에서 돌아가는 AI 모델입니다. 로컬 모델 서버를 설치하면 그 서버가 모델을 불러오고, 컴퓨터 안의 웹 주소에서 요청을 받아 응답합니다. Marinara Engine은 유료 클라우드 서비스 대신 그 주소와 통신합니다.

많이 쓰는 로컬 모델 서버로는 Ollama, LM Studio, KoboldCpp가 있습니다. 모두 컴퓨터에서 직접 돌아가며 외부에 공개되지 않는 엔드포인트를 제공합니다. 엔드포인트는 서버가 요청을 기다리는 웹 주소입니다.

이 가이드는 직접 설치해서 돌리는 외부 로컬 서버를 다룹니다. Marinara에는 별도의 서버가 필요 없는 작은 내장 모델도 함께 들어 있습니다. 그쪽을 쓰려면 [Local Model 설정](local-model.md) 가이드를 참고하세요.

시작하기 전에 로컬 모델 서버가 설치되어 있고, 실행 중이며, 모델까지 불러온 상태인지 확인하세요. Marinara는 그 서버를 대신 실행해 주지 않습니다. 이미 돌아가는 서버에 연결할 뿐입니다.

## Custom 연결 만들기

Marinara는 **Custom (OAI-Compatible)** 제공자를 통해 로컬 서버에 연결합니다. OAI 호환이란 서버가 OpenAI Chat Completions API와 같은 요청 형식을 쓴다는 뜻입니다. Ollama, LM Studio, KoboldCpp 모두 이 형식을 지원합니다.

다음 순서대로 연결을 만드세요.

1. 앱 오른쪽에서 **Connections**(연결) 패널을 여세요.
2. **Add**(추가)를 클릭하세요. **Add account**(계정 추가) 창이 열립니다.
3. 1단계에서 **Custom (OAI-Compatible)**을 선택하세요. **On your computer**(내 컴퓨터) 아래에 있습니다.
4. 2단계에서 **Address**(주소) 입력란에 로컬 서버의 주소를 입력하세요(아래 표 참고).
5. **API key**(API 키) 입력란은 비워 두세요. 대부분의 로컬 서버는 키가 필요 없습니다. 연결에 `Ollama Local` 같은 이름을 붙이려면 **More options**(추가 옵션)를 열고 **Name (optional)**(이름, 선택 사항)에 입력하세요.
6. **Connect**(연결)를 클릭하세요.
7. 3단계에서 서버가 알려 주는 목록 중 모델을 고르세요. 모델 ID를 직접 입력해도 됩니다. **Done**(완료)을 클릭하세요.

이제 **Connections** 패널에 연결이 보이고, 그 아래에 모델이 묶여 있습니다. 채팅에서 쓰기 전에 먼저 테스트하세요. 아래 "연결 테스트하기" 절을 참고하세요.

로컬 서버에서는 **API Key**(API 키) 입력란이 선택 사항입니다. **Custom (OAI-Compatible)** 제공자를 고르면 이 입력란 아래에 안내가 표시됩니다. Ollama, LM Studio, KoboldCpp 같은 로컬 모델은 키를 비워 두어도 되고, 대신 **Address**만 설정하면 된다는 내용입니다.

## 많이 쓰는 로컬 서버의 기본 URL

**Address**는 기본 URL이라고도 하며, 로컬 서버가 어디에서 요청을 기다리는지 Marinara에 알려 줍니다. 서버마다 기본 주소와 포트가 정해져 있습니다. 포트는 서버가 컴퓨터에서 사용하는 번호가 붙은 통로입니다. 사용 중인 서버에 맞는 주소를 쓰세요.

| 로컬 서버 | 엔드포인트 |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |

여기서 `localhost`는 "지금 이 컴퓨터"라는 뜻입니다. Marinara와 모델 서버가 같은 컴퓨터에서 돌아간다면 위 주소를 그대로 쓰면 됩니다.

**Address** 입력란에는 안전 경고가 함께 표시됩니다. "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." 직접 준비했거나 완전히 믿을 수 있는 주소만 입력하세요.

### Windows 방화벽 주의 사항

Windows에서는 로컬 서버가 돌아가고 있는데도 차단될 수 있습니다. **Custom (OAI-Compatible)** 제공자를 고르면 편집기에 이런 안내가 표시됩니다. 프록시나 로컬 서버가 감지되지 않으면 Windows Defender 방화벽이 연결을 막고 있을 수 있습니다. Windows 보안을 열고 방화벽 및 네트워크 보호, 방화벽을 통해 앱 허용으로 들어가 Node.js나 사용 중인 서버 프로그램을 추가하면 해결됩니다.

## Treat as local/custom endpoint 토글

연결 편집기에는 **Local / Custom Endpoint**(로컬/사용자 지정 엔드포인트) 섹션이 있고, 그 안에 **Treat as local/custom endpoint**(로컬/사용자 지정 엔드포인트로 취급) 토글이 있습니다. 기본값은 꺼짐입니다. 자체 호스팅 엔드포인트나 프록시를 거치는 엔드포인트, 특히 로컬 네트워크의 모델 서버를 가리키는 사용자 지정 웹 주소를 쓸 때 켜세요.

이 토글이 꺼져 있으면 Marinara는 알지 못하는 모델에 대해 도구 호출을 조심스럽게 처리합니다. 토글을 켜면 Marinara가 항상 도구 호출을 시도합니다. 또한 Professor Mari가 네이티브 도구 호출만 쓰지 않고 대체 방식(JSON 도구 프로토콜)도 쓰게 됩니다. Professor Mari는 앱에 내장된 어시스턴트입니다.

Professor Mari가 도구를 쓴 뒤 그대로 멈춘다면 이 토글을 켜세요. 엔드포인트가 OpenAI 호환이라고 하면서 도구 호출이 제대로 되지 않을 때도 켜면 됩니다. 로컬 모델이 토글 없이도 잘 작동한다면 꺼 둔 채로 써도 됩니다.

## 다른 컴퓨터의 서버에 연결하기

Marinara는 같은 컴퓨터에 접속하는 연결은 언제나 허용합니다. `localhost`나 `127.0.0.1` 같은 주소를 루프백 주소라고 하며, "지금 이 컴퓨터"라는 뜻입니다. 이런 주소는 추가 설정 없이 항상 연결에 사용할 수 있습니다.

모델 서버가 집이나 사무실 네트워크의 다른 컴퓨터에서 돌아간다면 그 주소는 사설 네트워크 주소입니다. Marinara는 안전을 위해 사설 네트워크 주소를 기본적으로 차단합니다. 허용하려면 Marinara 서버를 운영하는 사람이 환경 변수를 설정해야 합니다. 환경 변수는 서버가 시작할 때 읽어 들이는 설정값입니다.

서버의 `.env` 파일에 다음 줄을 추가하세요.

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

파일을 저장하고 Marinara 서버를 다시 시작해야 변경 내용이 적용됩니다. 그 뒤에는 `http://192.168.1.50:11434/v1`처럼 네트워크의 다른 컴퓨터를 가리키는 기본 URL을 쓸 수 있습니다.

Android에서는 이 설정을 따로 지정하지 않으면 기본적으로 켜져 있습니다. `.env` 파일과 서버 설정에 대한 자세한 내용은 [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

## 연결 테스트하기

계정 추가 과정의 **Connect**가 이미 연결을 확인했습니다. 모델 편집기 맨 아래에는 한 번 더 확인할 수 있는 **Connection Tests**(연결 테스트) 카드가 있습니다. 채팅에서 이 연결에 의존하기 전에 먼저 사용하세요.

1. **Connections** 패널에서 내 모델을 클릭하세요. 모델 편집기가 열립니다.
2. **Test Connection**(연결 테스트)을 클릭하세요. 기본 URL과 설정이 실제로 닿는지 확인하고 걸린 시간을 알려 줍니다.
3. 아직 모델을 고르지 않았다면 지금 고르세요.
4. **Send Test Message**(테스트 메시지 전송)를 클릭하세요. 선택한 모델에 "hi"라는 단어를 보내고 답변을 보여 줍니다.

두 테스트가 모두 성공하면 로컬 모델을 채팅에서 쓸 수 있습니다. 채팅을 열고 그 채팅의 설정에서 이 연결을 선택하거나, 채팅 입력란의 **Connections** 메뉴를 사용하세요.

같은 모델로 에이전트 활성화 질문 같은 결정에도 답할 수 있으며 Marinara가 모델을 한 번 더 불러올 필요가 없습니다. 연결 설정에서 **Use this model for decisions**(이 모델을 결정에 사용)를 클릭하세요. [Decision 모델](decision-models.md#on-a-server-you-already-run)을 참고하세요.

테스트가 실패하면 먼저 로컬 서버가 계속 돌아가고 있는지, 모델이 불러와져 있는지 확인하세요. 그다음 **Address**가 서버의 주소와 포트에 정확히 일치하는지 확인하세요. 다른 컴퓨터의 서버라면 `PROVIDER_LOCAL_URLS_ENABLED`를 설정했는지, Marinara 서버를 다시 시작했는지도 확인하세요.

## 관련 가이드

- [AI 제공자에 연결하기](connecting-to-a-provider.md)
- [Local Model 설정](local-model.md)
- [Decision 모델](decision-models.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
