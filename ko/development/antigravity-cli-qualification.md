# Antigravity CLI 구독 연동 조건 검토

[#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143)에 관한 개발자 조사 기록입니다. 2026-10-23에 처음 확인했고, 2026-11-19에 공식 Windows용 `agy` 1.5.11 및 1.5.12로 다시 확인했습니다. Marinara Engine에는 Antigravity 구독 연결이 **구현되어 있지 않습니다**. 이 이슈는 계획 없음으로 닫힌 상태입니다. 사용자 지정 에이전트의 제외 설정으로 이번에 시험한 후크는 실행되지 않았지만, 전역에서 발견된 플러그인의 MCP 하위 프로세스는 두 버전 모두에서 시작되었습니다. 실행 격리 요건은 아직 충족하지 못했습니다.

## 확인된 공식 인터페이스

공식 `agy` CLI는 저장된 인증 정보를 이용한 계정 로그인과 대화형 인터페이스 없는 텍스트 생성을 지원합니다. 문서화된 프로토콜에는 `init`, `step_update`, `result` 이벤트가 있으며, 스트리밍 입력에는 stdin을 통해 JSON 사용자 메시지를 전달합니다. Windows 재검사에서는 `agy models`가 `gemini-4-neon-high`를 표시했고, 이미 로그인한 Google AI Pro 계정으로 해당 모델에 보낸 제한 시간 내 요청이 성공했습니다. 계정에서 사용할 수 있는 모델은 이 예시에서 추정하지 말고 설치된 CLI에서 가져오세요. `--print-timeout 0`은 완료될 때까지 기다리며, `--disable-slash-commands`는 print 모드의 명령 확장을 비활성화합니다. [헤드리스 모드](https://antigravity.google/docs/cli/headless/)와 [CLI 플래그 참조](https://antigravity.google/docs/cli/reference/)를 참고하세요.

CLI의 계정 로그인은 운영체제의 인증 정보 저장소를 사용합니다. 별도의 Gemini API 키 모드에는 `modelProvider: "gemini"`와 `GEMINI_API_KEY`가 필요합니다. 구독 어댑터가 이 과금 경로를 알리지 않고 선택해서는 안 됩니다. Python SDK에 문서화된 프로그래밍 방식의 인증 수단은 Gemini API 키, Vertex/Google Cloud 인증 정보, 로컬 모델입니다. 이 수단들은 SDK 기반 대체 구현에서 개인용 구독 인증을 사용할 수 있다는 근거가 되지 않습니다. [인증](https://antigravity.google/docs/install/#programmatic-authentication)과 [SDK 개요](https://antigravity.google/docs/sdk/overview/)를 참고하세요.

## 현재 실행 격리 결과

공식 사용자 지정 에이전트 정의는 도구, MCP, 사용자 지정 항목의 제어 기능을 제공합니다. 플러그인 가이드에 따르면 `inheritCustomizations`는 상속하는 스킬, 규칙, 후크를 제어하고 `inheritMcp`는 상속하는 작업 공간 MCP 서버를 제어합니다. `excludeDefaultComponents: true`의 당시 발표에는 호출 후 후크가 유지된다고 명시되어 있으므로, 그 플래그만으로는 격리를 보장할 수 없습니다. 아래의 설정 조합은 1.5.11에서 시험용 후크를 막았지만, 모든 MCP 하위 프로세스의 시작을 막지는 못했습니다. [사용자 지정 하위 에이전트](https://antigravity.google/docs/subagents/), [플러그인 만들기](https://antigravity.google/docs/build-plugins/), [CLI 변경 기록](https://antigravity.google/docs/changelog)을 참고하세요.

후크는 작업 공간, 전역 파일 `~/.gemini/config/hooks.json`, 설치된 플러그인에서 올 수 있습니다. 세션, 모델 호출, 도구, 중지 이벤트를 포함합니다. 현재 설정 문서와 [공식 설정 스키마](https://antigravity.google/schemas/v1/settings.json)는 `settings.json`의 `hooks` 항목을 읽지 않는다고 명시합니다. 여기에 빈 항목을 써도 실제 후크 공급원은 비활성화되지 않습니다. [후크](https://antigravity.google/docs/hooks)와 [CLI 설정](https://antigravity.google/docs/settings?tab=cli)을 참고하세요.

설치된 1.5.11의 도움말에는 `--settings`로 `settings.json` 키를 현재 세션에서만 재정의할 수 있으며 값을 인라인이나 파일로 전달한다고 나옵니다. 영구 설정을 다시 쓰지 않고 작업 공간 신뢰와 권한을 임시로 설정할 수 있습니다. 그러나 별도의 설정 프로필을 제공하지는 않습니다. `--settings '{"hooks":{}}'`는 종료 코드 1과 `unknown setting "hooks"`를 반환합니다. 설치된 버전의 도움말에는 후크 비활성화 옵션이나 인증을 유지하는 격리 프로필 옵션이 없었습니다.

현재 설정 문서에서는 `/hooks`로 후크를 추가, 편집, 전환할 수 있고 변경 사항은 설정 파일에 저장한다고 설명합니다. 재검사에서 헤드리스 `-p "/hooks" --output-format json`은 구조화된 목록을 반환했습니다. 목록과 저장된 스위치 상태가 이후 호출에서 실행 가능한 사용자 지정 항목을 제외한다는 보장은 없습니다. 디렉터리를 바꾸거나, `tools` 목록을 비우거나, 도구를 피하도록 지시하거나, 시작 후 중단하는 것만으로는 실행 격리를 증명할 수 없습니다.

제삼자 연동 보고서는 조사의 단서입니다. 실제 동작이 없는 도구, 에이전트 확인 로그, 사용자 지정 설정 상속에 관한 주장은 Engine이 의존할 수 있는 보장이 되기 전에 공식 릴리스에서 재현되어야 합니다.

## 2026년 10월 릴리스 검사

[공식 설치 프로그램](https://antigravity.google/cli/install.sh)과 [Darwin ARM64 릴리스 매니페스트](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json)를 설치 프로그램 실행 없이 검사했습니다. 매니페스트가 선택한 것은 [버전이 고정된 `agy` 1.4.6 Darwin ARM64 압축 파일](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz)과 다음 압축 파일 SHA-512입니다.

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

압축 파일의 체크섬이 일치했습니다. 바이너리는 이 작업 전용 임시 디렉터리에 풀었습니다. 네트워크 접근, 홈 디렉터리 읽기/쓰기, 키체인 서비스 접근을 차단한 macOS 샌드박스에서 `--version`과 `--help`만 실행했습니다. 두 호출 모두 성공적으로 종료되었습니다. 도움말에는 후크 비활성화, 격리된 프로필, 설정 디렉터리 옵션이 없었습니다.

이 조사에서는 CLI 설치나 인증, 인증 정보 확인, 모델 호출, 로그인된 계정의 모델 목록 조회, 후크 실행 테스트를 **수행하지 않았습니다**. 공개 플래그 목록을 뒷받침할 뿐, 격리가 불가능하다고 증명하거나 구독을 통한 생성을 검증하지는 않습니다.

## 2026년 11월 Windows 검사

설치된 `agy`는 버전 1.5.11을 보고했습니다. SHA-512는 [공식 Windows AMD64 매니페스트](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json)에서 확인한 체크섬과 일치했지만, 당시 매니페스트 응답은 보관하지 않았습니다. 계속 갱신되는 매니페스트는 나중에 1.5.12로 바뀌었습니다. 검토 중에 [버전이 지정된 1.5.11 Windows 실행 파일](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe)을 별도로 다운로드해 실행하지 않고 해시를 계산했습니다. 234,827,416바이트인 파일의 SHA-512는 설치된 실행 파일의 값과 일치했습니다.

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

검사 전용 임시 작업 공간의 `.agents/agents/me-isolation-probe.md`에 다음 프런트매터를 넣어 테스트했습니다.

```yaml
name: me-isolation-probe
description: Harmless execution-isolation qualification fixture.
mainAgent: true
subagent: false
tools: []
inheritCustomizations: false
inheritMcp: false
excludeDefaultComponents: true
commandExecutionPolicy: off
```

공식 [사용자 지정 에이전트 프런트매터 참조](https://antigravity.google/docs/subagents/)에는 `mainAgent`, `subagent`, `tools`, `commandExecutionPolicy`가 나옵니다. 상속과 제외 제어는 위에서 링크한 플러그인 가이드와 변경 기록에 설명되어 있습니다. 설정을 조합한 상태로 검사했으므로, 에이전트를 성공적으로 선택했다는 사실만으로 각 필드가 독립적으로 적용되었는지는 확인할 수 없습니다.

생성에는 `--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>`를 사용하고 하위 프로세스에 별도로 55초 제한을 뒀습니다. 인라인 JSON 설정은 임시 작업 공간을 신뢰하도록 지정하고, 기본 에이전트 모드를 고르고, 사용자 지정 상태 및 제목 스크립트를 비활성화하고, 아래의 권한 모드를 선택했습니다. 권한 검사를 건너뛰지 않았습니다.

설정 객체는 다음 형식이었습니다. `<temporary-workspace>`는 검사 디렉터리로 바꿨고, `toolPermission`에는 표의 각 행에 해당하는 권한 모드를 지정했습니다.

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

검사용 하위 프로세스 환경에서 API 키와 ADC 환경 스위치를 제거했습니다. 인증 정보를 추출하거나 복사하지 않았습니다.

시험용 후크는 `SessionStart`, `PreInvocation`, `PostInvocation`, `Stop` 이벤트 이름을 각각 별도의 표식 파일에 추가했습니다. 로컬 Python MCP 테스트 구성은 stdio로 `initialize`와 `tools/list`에 답하기 전에 시작 표식을 추가했습니다. 작업 공간 MCP 설정에는 `.agents/mcp_config.json`을 사용했습니다. 플러그인은 `plugin.json`, `hooks.json`, `mcp_config.json`을 포함했으며, [사용자 지정 항목 검색](https://antigravity.google/docs/customization-discovery/)에 설명된 대로 `.agents/plugins.json` 또는 `~/.gemini/config/plugins.json`의 `entries` 매니페스트로 검색했습니다. 후크, MCP, 파일 읽기 대조군은 동일한 테스트 구성과 세션 설정에서 `--agent`만 뺐습니다. 존재하지 않는 이름 검사는 유효한 `--agent me-isolation-probe`와 찾을 수 없는 에이전트 이름을 비교했습니다.

| 검사 | 대조군 | 사용자 지정 에이전트 |
| --- | --- | --- |
| 작업 공간 및 전역 후크, 작업 공간에서 발견된 플러그인 후크(`strict` 권한) | 각 소스에서 네 이벤트 모두 표식을 남김 | 후크 표식 없음 |
| 작업 공간 MCP와 작업 공간에서 발견된 플러그인 MCP(`strict` 권한) | 두 하위 프로세스 모두 시작 표식을 남김 | 두 시작 표식 모두 나타나지 않음 |
| 전역에서 발견된 플러그인 후크(`request-review` 권한) | 네 이벤트 모두 표식을 남김 | 후크 표식 없음 |
| 전역에서 발견된 플러그인 MCP(`request-review` 권한) | 하위 프로세스가 시작 표식을 남김 | 하위 프로세스가 여전히 시작 표식을 남김 |
| 예측할 수 없는 테스트 값을 읽도록 명시한 `view_file` 요청(`request-review` 권한) | 테스트 값을 반환함 | `FILE_UNAVAILABLE`을 반환하고 테스트 값은 반환하지 않음 |
| 존재하지 않는 `--agent` 이름(`strict` 권한) | `--agent me-isolation-probe`로 생성을 완료함 | 유효하지 않은 이름은 종료 코드 1, 오류 결과, 사용량 0을 반환하고 후크와 MCP 표식을 남기지 않음 |

전역에서 발견된 플러그인 MCP 결과는 `strict` 권한으로, 호출마다 새 시작 표식 경로를 써서 두 번 재현했습니다. 두 사용자 지정 에이전트 요청 모두 종료 코드 0으로 끝났고 두 하위 프로세스 모두 표식을 남겼습니다. 앞선 대조군의 쓰기 작업이 지연되어도 새로운 경로에는 쓸 수 없었습니다. 생성한 답변이 MCP 도구를 쓰지 않았어도, 하위 프로세스의 시작이 여전히 관찰된 차단 요인입니다.

파일 읽기 프롬프트는 `Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`였으며 임시 테스트 파일의 절대 경로를 넣었습니다. 사용자 지정 에이전트의 Markdown 본문에는 파일을 읽지 못하면 `FILE_UNAVAILABLE`로 답하라고 적었습니다.

조사 도중 공식 매니페스트가 갱신되었을 때 [1.5.12 Windows 실행 파일](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe)을 검사용 디렉터리에 다운로드했습니다. 설치된 CLI는 교체하지 않았습니다. 보관한 다음 매니페스트 응답으로 SHA-512를 확인했습니다.

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

1.5.12에서 같은 기존 로그인과 `request-review` 권한으로, 전역에서 발견된 플러그인과 파일 읽기의 대조군 및 사용자 지정 에이전트 검사를 되풀이했습니다. 대조군은 플러그인 후크 이벤트를 모두 실행하고 MCP 하위 프로세스를 시작했으며 테스트 값을 반환했습니다. 사용자 지정 에이전트는 `FILE_UNAVAILABLE`을 반환하고 후크를 억제했지만, 여전히 MCP 하위 프로세스를 시작했습니다. 두 생성 요청 모두 종료 코드 0으로 끝났습니다. 표의 다른 행은 1.5.11에서만 검사했습니다.

스트림의 `init.agent`에는 선택한 사용자 지정 에이전트가 표시되었고, 1.5.11에서 별도 프롬프트를 보내자 해당 에이전트의 Markdown 본문에만 정의한 표식이 반환되었습니다. 그러나 `init.tools`는 대조군과 사용자 지정 에이전트 모두에서 `run_command`와 `view_file`을 포함한 동일한 기본 제공 도구를 나열했습니다. 이 목록만으로 실제 도구 접근 가능 여부를 판단할 수 없습니다. 파일 읽기 검사에서 확인한 동작은 도구 하나의 것이며 나머지 도구는 검증이 필요합니다.

전역 테스트 파일은 기존 파일이 없던 후크와 매니페스트 경로에만 배타적으로 만들었으며, 내용을 확인한 후 제거했습니다. 임시 전역 파일 두 개를 제거했고 영구 CLI 설정의 해시가 검사 전과 일치했습니다. CLI는 일상적인 대화 상태를 유지했습니다. 검사에서 기존 전역 설정을 교체하지 않았습니다.

검사에서는 인증 정보의 내용을 확인하지 않았으며 인증은 공식 CLI 안에서 처리했습니다.

실제 Windows 검사에서는 구독 인증으로 생성할 수 있음을 확인했고 후크에 대한 초기 우려의 범위를 좁혔습니다. 전역에서 발견된 플러그인의 MCP가 여전히 시작되므로 어댑터는 요건을 충족하지 못합니다. 독립 실행 전역 MCP 서버, 상속된 스킬, 규칙 및 하위 에이전트, 실제 동작을 수행할 수 있는 모든 도구, 취소, 출력이 오래 없는 경우의 동작, Linux/macOS에서 실제 실행은 아직 시험하지 않았습니다. CLI 변경 기록의 최신 플러그인 정책 및 샌드박스 수정 사항만으로 일반 개인 구독 요청에서 실행 가능한 모든 사용자 지정 항목이 제외되는지는 확인할 수 없습니다.

## 어댑터 제공 전에 필요한 증거

1. 어떤 요청도 실행할 수 있기 전에 전역 및 작업 공간 후크, 플러그인, 스킬, 규칙, 하위 에이전트, MCP 서버, 실제 동작을 수행할 수 있는 도구를 제외하는 지원된 방법을 확립하세요. 일반적인 계정 로그인은 공식 CLI 안에서 처리하고, 토큰을 추출하거나 복사하지 마세요.
2. 실제 공식 CLI와 제어된 로컬 모델 테스트 대역을 사용해 이 방법을 검증하세요. 전역 및 작업 공간 후크와 플러그인/MCP에 관찰 가능한 테스트 표식을 설치하고 규칙과 도구 요청도 준비하세요. 격리된 실행과 더불어, 격리가 없으면 표식을 관찰할 수 있음을 보여 주는 음성 대조군도 검증하세요.
3. 선택한 사용자 지정 에이전트가 실행 전에 올바르게 확인되는지 증명하세요. 지원하지 않는 버전, 찾지 못한 에이전트 이름, 알 수 없는 목록 형식, 결론이 불분명한 격리 검사는 거부하세요. 내부 로그 문구나 시작 시 비어 보이는 도구 목록에 의존하지 마세요.
4. 하위 프로세스 입출력 제한, 비공개 임시 파일과 정리, 취소, 0이 아닌 종료 코드와 결과 오류 처리, 활동을 고려하는 시간 초과 테스트를 추가하세요. 표시되는 텍스트 없이 오래 사고하는 경우도 포함해야 합니다. 공식 명령으로 계정별 모델을 가져오고 선택한 모델과 지원되는 추론 강도를 유지하세요.
5. 기존 연결/제공자 계약을 재사용하세요. Claude SDK의 `settingSources: []` 같은 옵션은 해당 제공자 전용이며 `agy`로 옮길 수 있는 플래그가 아닙니다. 실제 인증, 구독 과금, 실제 기기 플랫폼에서 아직 검증하지 못한 부분을 명확히 밝히세요.

Windows의 1.5.11 및 1.5.12 검사에서는 일부 조건을 충족했지만 하위 프로세스가 시작되는 문제가 재현됩니다. #8143은 계획 없음으로 닫힌 상태입니다. 이번 재검사로 이슈가 다시 열리거나 런타임 작업이 승인되지는 않습니다. 유지관리자가 결정하고 검증이 완료될 때까지 런타임 제공자 항목을 추가하지 마세요.
