# Antigravity CLI 구독 연동 조건 검토

이 문서는 [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143)에 관한 개발자 조사 노트이며, 확인 날짜는 2026-10-23입니다. Marinara Engine에는 Antigravity 구독 연결이 **구현되어 있지 않습니다**. 아직 필요한 조건은 Engine의 텍스트 생성 요청 중에 수명 주기 후크를 비롯한 CLI 도구와 전역 사용자 지정 설정의 실행을 막을 수 있는, 지원되고 검증 가능한 방법입니다.

## 확인된 공식 인터페이스

공식 `agy` CLI는 저장된 인증 정보를 이용한 계정 로그인과 대화형 인터페이스 없는 텍스트 생성을 지원합니다. 문서화된 프로토콜에는 `init`, `step_update`, `result` 이벤트가 있으며, 스트리밍 입력에는 stdin을 통해 JSON 사용자 메시지를 전달합니다. `agy models`는 사용 가능한 모델을 나열하며, 문서에는 `gemini-4-argon-high`와 `gemini-4-argon-medium` 예시가 있습니다. 계정에서 실제로 사용할 수 있는 모델은 예시에서 추정하지 말고 설치된 CLI에서 가져와야 합니다. `--print-timeout 0`은 완료될 때까지 기다리며, `--disable-slash-commands`는 print 모드의 명령 확장을 비활성화합니다. [헤드리스 모드](https://www.antigravity.google/docs/cli/headless/)와 [CLI 플래그 참조](https://www.antigravity.google/docs/cli/reference/)를 참고하세요.

CLI의 계정 로그인은 운영체제의 인증 정보 저장소를 사용합니다. 별도의 Gemini API 키 모드에는 `modelProvider: "gemini"`와 `GEMINI_API_KEY`가 필요합니다. 구독 어댑터가 이 과금 경로를 알리지 않고 선택해서는 안 됩니다. Python SDK에 문서화된 프로그래밍 방식의 인증 수단은 Gemini API 키, Vertex/Google Cloud 인증 정보, 로컬 모델입니다. 이 수단들은 SDK 기반 대체 구현에서 개인용 구독 인증을 사용할 수 있다는 근거가 되지 않습니다. [인증](https://www.antigravity.google/docs/install/#programmatic-authentication)과 [SDK 개요](https://www.antigravity.google/docs/sdk/overview/)를 참고하세요.

## 실행 격리 보장의 부재

공식 사용자 지정 에이전트 정의는 도구, MCP, 사용자 지정 설정에 대한 제어를 제공합니다. 변경 내역에는 `inheritCustomizations`, `inheritMcp`, `excludeDefaultComponents`도 문서화되어 있습니다. 하지만 `excludeDefaultComponents: true` 발표에는 모델 호출 후 후크가 명시적으로 유지됩니다. 따라서 이 옵션만으로는 텍스트 생성 요청이 모든 실행 가능한 후크를 제외한다고 증명할 수 없습니다. [사용자 지정 하위 에이전트](https://www.antigravity.google/docs/subagents/)와 [CLI 변경 내역](https://www.antigravity.google/docs/changelog)을 참고하세요.

후크는 작업 공간, 전역 파일 `~/.gemini/config/hooks.json`, 설치된 플러그인에서 올 수 있습니다. 세션, 모델 호출, 도구, 중지 이벤트를 포함합니다. 현재 설정 문서와 [공식 설정 스키마](https://antigravity.google/schemas/v1/settings.json)는 `settings.json`의 `hooks` 항목을 읽지 않는다고 명시합니다. 여기에 빈 항목을 써도 실제 후크 공급원은 비활성화되지 않습니다. [후크](https://www.antigravity.google/docs/hooks)와 [CLI 설정](https://www.antigravity.google/docs/settings?tab=cli)을 참고하세요.

문서화된 CLI 플래그와 설정에는 요청별 후크 비활성화 옵션이나 계정 인증을 유지하는 격리된 설정/프로필 디렉터리 옵션이 없습니다. 읽기 전용 `/hooks` 목록은 유용한 증거이지만, 문서가 이후 모델 호출에 고정된 후크 없는 설정을 사용한다고 보장하지는 않습니다. 디렉터리 변경, 빈 `tools` 목록, 도구 사용을 피하라는 지시, 시작 후 중단은 실행 격리를 증명하기에 충분하지 않습니다.

제삼자 연동 보고서는 조사의 단서입니다. 실제 동작이 없는 도구, 에이전트 확인 로그, 사용자 지정 설정 상속에 관한 주장은 Engine이 의존할 수 있는 보장이 되기 전에 공식 릴리스에서 재현되어야 합니다.

## 로컬 릴리스 조사

[공식 설치 프로그램](https://antigravity.google/cli/install.sh)과 [Darwin ARM64 릴리스 매니페스트](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json)를 설치 프로그램 실행 없이 검사했습니다. 매니페스트가 선택한 것은 [버전이 고정된 `agy` 1.4.6 Darwin ARM64 압축 파일](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz)과 다음 압축 파일 SHA-512입니다.

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

압축 파일의 체크섬이 일치했습니다. 바이너리는 이 작업 전용 임시 디렉터리에 풀었습니다. 네트워크 접근, 홈 디렉터리 읽기/쓰기, 키체인 서비스 접근을 차단한 macOS 샌드박스에서 `--version`과 `--help`만 실행했습니다. 두 호출 모두 성공적으로 종료되었습니다. 도움말에는 후크 비활성화, 격리된 프로필, 설정 디렉터리 옵션이 없었습니다.

이 조사에서는 CLI 설치나 인증, 인증 정보 확인, 모델 호출, 로그인된 계정의 모델 목록 조회, 후크 실행 테스트를 **수행하지 않았습니다**. 공개 플래그 목록을 뒷받침할 뿐, 격리가 불가능하다고 증명하거나 구독을 통한 생성을 검증하지는 않습니다.

## 어댑터 제공 전에 필요한 증거

1. 어떤 요청도 실행할 수 있기 전에 전역 및 작업 공간 후크, 플러그인, 스킬, 규칙, 하위 에이전트, MCP 서버, 실제 동작을 수행할 수 있는 도구를 제외하는 지원된 방법을 확립하세요. 일반적인 계정 로그인은 공식 CLI 안에서 처리하고, 토큰을 추출하거나 복사하지 마세요.
2. 실제 공식 CLI와 제어된 로컬 모델 테스트 대역을 사용해 이 방법을 검증하세요. 전역 및 작업 공간 후크와 플러그인/MCP에 관찰 가능한 테스트 표식을 설치하고 규칙과 도구 요청도 준비하세요. 격리된 실행과 더불어, 격리가 없으면 표식을 관찰할 수 있음을 보여 주는 음성 대조군도 검증하세요.
3. 선택한 사용자 지정 에이전트가 실행 전에 올바르게 확인되는지 증명하세요. 지원하지 않는 버전, 찾지 못한 에이전트 이름, 알 수 없는 목록 형식, 결론이 불분명한 격리 검사는 거부하세요. 내부 로그 문구나 시작 시 비어 보이는 도구 목록에 의존하지 마세요.
4. 하위 프로세스 입출력 제한, 비공개 임시 파일과 정리, 취소, 0이 아닌 종료 코드와 결과 오류 처리, 활동을 고려하는 시간 초과 테스트를 추가하세요. 표시되는 텍스트 없이 오래 사고하는 경우도 포함해야 합니다. 공식 명령으로 계정별 모델을 가져오고 선택한 모델과 지원되는 추론 강도를 유지하세요.
5. 기존 연결/제공자 계약을 재사용하세요. Claude SDK의 `settingSources: []` 같은 옵션은 해당 제공자 전용이며 `agy`로 옮길 수 있는 플래그가 아닙니다. 실제 인증, 구독 과금, 실제 기기 플랫폼에서 아직 검증하지 못한 부분을 명확히 밝히세요.

실행 경계가 확립되기 전까지 #8143은 열린 상태로 두며, 런타임 제공자 항목을 추가해서는 안 됩니다.
