# Noodle 프롬프트 내부 구조(개발자용)

Noodle의 생성 프롬프트가 코드 어디에 있는지, 어떻게 고치는지, 최종 프롬프트를 어떻게 확인하는지 정리한 개발자용 참고 문서입니다. 일반 사용자는 Noodle의 Settings 패널에서 설정하면 됩니다. `docs/noodle/`의 Noodle 가이드를 참고하세요.

Noodle은 다운로드 가능한 패키지입니다. 라우트(`/api/noodle`, 패키지가 활성화될 때 등록)와 생성 코드는 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)의 Noodle 패키지 안, `packages/noodle/src/engine/packages/server/src/` 아래에 있습니다. 아래 표에서 **package**로 표시한 소스는 그 폴더를 기준으로 한 경로입니다. Engine에는 공용 Noodle 스키마와 타입, Noodle 저장소, Settings에 나열되는 등록된 프롬프트 재정의, 그리고 `packages/server/src/services/noodle/noodle-prompt.ts`의 기본 타임라인 프롬프트 텍스트가 남아 있습니다. 패키지는 `services/prompt-overrides/registry/noodle.ts`와 `services/noodle/noodle-prompt.ts`의 자체 사본을 가지고 있습니다.

## 프롬프트 소스 맵

Noodle에는 조립된 타임라인 프롬프트 1개, 코드에 직접 작성된 프로필 프롬프트 1개, 그리고 등록된 프롬프트 재정의 3개가 있습니다. 재정의 중 2개는 타임라인 시스템 프롬프트용이고 1개는 게시물 이미지용입니다.

| 용도 | 소스 | 주요 심볼 | 수정 방법 |
| ---- | ---- | --------- | --------- |
| 타임라인 게시물, 답글, 팔로우, 설문, 투표, 요약 | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` | 시스템 메시지는 **Noodle Timeline Prompt** 재정의 뒤에 **Noodle Timeline Voice & Tone** 재정의(둘 다 아래 참고)를 이어 붙인 것입니다. 사용자 메시지 2개, 컨텍스트(계정, 페르소나, 프로필, 스케줄, 로어, 사용자가 동의한 채팅 컨텍스트, 타임라인, 켜진 기능과 할당량), `# JSON Output Format` 메시지는 코드에서 조립합니다. |
| 타임라인 기본 시스템 프롬프트 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt**에서 수정하거나, 코드에서 `noodle-prompt.ts`의 `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT`를 바꿉니다. 기본값에는 성인 플랫폼, 페르소나 작성 주체, 상호작용, JSON 규칙이 들어 있으므로 다시 쓰면 `noodleGeneratedRefreshSchema` 파싱이 깨질 수 있습니다. |
| 타임라인 어조 지시(기본 프롬프트 뒤에 덧붙임) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone**에서 수정하거나, 코드에서 등록된 기본값(`noodle-prompt.ts`의 `noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)`)을 바꿉니다. 수정하지 않은 기본값은 Noodle 설정 `enableEnhancedTimelineWriting`(`ctx.enhanced`)과 무작위 사용자 허용 여부를 따르며, 앞의 설정을 꺼 두면 원래의 한 줄짜리 어조 지시가 그대로 나옵니다. 재정의 문구를 한 번 저장하면 이 설정들과 무관하게 저장한 문구가 우선합니다. |
| 캐릭터 계정의 최초 프로필 | **package** `services/noodle/noodle-public-profiles.service.ts` | `generateMissingNoodleProfiles()` | 코드 안의 시스템 메시지와 사용자 메시지를 직접 수정합니다. 참가자 선정이 먼저 실행되고, 선정된 캐릭터 계정 중 `profileGenerated`가 없는 계정만 이 프롬프트로 넘어갑니다. |
| 생성된 게시물의 이미지 프롬프트 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image**에서 수정하거나, 코드에서 등록된 기본값을 바꿉니다. |
| Noodle 전용 기본 이미지 지시 | `packages/shared/src/schemas/noodle.schema.ts` | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | UI에서 Noodle 설정을 바꾸거나, 코드에서 스키마 기본값을 바꿉니다. |
| 타임라인 생성에 들어가는, 사용자가 동의한 채팅 컨텍스트 | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildOptedInChatContext()` | 컨텍스트 조립 방식을 코드에서 바꿉니다. 동의 여부는 각 채팅의 설정에 그대로 남습니다. |
| 타임라인 게시물과 답글의 이미지 입력 | **package** `services/noodle/noodle-vision.ts` | `prepareNoodleVisionAttachments()` | 이미지 선택, 정규화, 개수 제한, 텍스트 전용 호환 대체 동작을 코드에서 바꿉니다. |
| 채팅 프롬프트에 들어가는 Noodle 활동 | **package** `services/noodle/noodle-context.ts` | `buildRecentSocialMediaActivityBlock()` | 패키지는 이를 `noodle:prompt-context` 서비스로 등록합니다. 필터링이나 블록 조립 방식을 코드에서 바꿉니다. 대상 모드와 항목 개수 제한은 Noodle Settings에서 사용자가 정하고, 감싼 블록에는 8,192 토큰이라는 상한이 걸려 있습니다. |
| 생성 결과의 JSON 계약 | `packages/shared/src/schemas/noodle.schema.ts` | `noodleGeneratedRefreshSchema` | 프롬프트, 라우트 처리, 공용 타입, 회귀 테스트 범위를 함께 손볼 때만 바꿉니다. |
| 타임라인 생성에 들어가는 로어북의 세계관 컨텍스트 | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()`(`processLorebooks()` 호출) | Noodle 설정 **Lorebook context**(`enableLorebookContext`, 기본값 꺼짐)로 켜고 끕니다. 그룹 채팅에서 쓰는 다중 캐릭터용 `processLorebooks()`를 그대로 재사용하되, `noodle-prompt.ts`의 `noodleLorebookTokenBudget()`이 계산한 Noodle 전용 토큰 예산을 씁니다. 이 예산은 활성 캐릭터 수에 따라 조정되며 8,192 토큰을 넘지 않습니다. Noodle에는 고정과 쿨다운 타이밍 상태를 저장할 채팅별 슬롯이 없기 때문에 `previewOnly: true`로 실행됩니다. |

프로필 프롬프트는 Prompt Overrides UI에 나오지 않습니다. **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone**, **Noodle Post Image** 템플릿은 나옵니다. **Noodle image generation**(`enableImagePrompts`)이 켜져 있으면 Noodle 설정 **Image instructions (sent to your LLM)**이 타임라인 모델로 전달되고, 모델은 각 게시물의 이미지 아이디어를 쓸 때 이를 따릅니다. 기본 **Noodle Post Image** 템플릿은 더 이상 이 지침을 덧붙이지 않지만, 사용자 지정 템플릿에서는 여전히 `${userInstructions}`로 쓸 수 있습니다.

이미지 서비스(**package** `services/noodle/noodle-public-images.service.ts`)는 `NOODLE_IMAGE_POST`를 불러온 다음, 그 결과를 `compileImagePrompt()`에 통과시키고 나서 이미지 제공자에 보냅니다. 따라서 최종 요청은 선택한 이미지 스타일 프로필과 연결 기본값에도 영향을 받습니다.

## 최종 프롬프트 확인하기

Debug Mode를 켠 상태에서 새로고침을 직접 실행하면, 최종 프로필 메시지와 타임라인 모델 메시지가 공용 서버 로거로 기록됩니다. 다음 줄을 찾으세요.

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

타임라인 이미지 데이터는 디버그 로그에 base64로 기록되지 않습니다. 로그에 남는 텍스트에는 모델에 보낸 것과 같은 게시물/답글 첨부 키와 네이티브 이미지 입력 개수만 담깁니다. Noodle은 이 입력을 `noodle-vision.ts`에서 정규화하고 개수를 제한합니다. 제공자가 이미지 인식 콘텐츠를 명시적으로 거부하면, 패키지는 그 사실을 로그로 남기고 미리 조립해 둔 텍스트 전용 대체 프롬프트를 보냅니다.

이미지의 경우 **Settings -> Generations -> Overall Generations**에서 **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)을 켜면, 요청을 보내기 전에 최종적으로 컴파일된 긍정 프롬프트와 부정 프롬프트를 확인하고 수정할 수 있습니다.

## 안전하게 수정하기

프롬프트 조립은 호환성이 쉽게 깨지는 위험한 경계입니다. 수정할 때는 프롬프트, `noodleGeneratedRefreshSchema`, 라우트 처리, Noodle 멘션 및 설문 회귀 테스트가 서로 어긋나지 않게 유지하세요. Engine에서는 최소한 다음을 실행하세요.

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

패키지가 소유한 코드의 변경은 Marinara-Agents에서 그 저장소의 `staging` 브랜치를 대상으로 작업하고 검증합니다.

## 관련 가이드

- [Noodle: 앱 안의 소셜 타임라인](../noodle/overview.md)
- [Noodle 설정과 채팅 반영](../noodle/settings.md)
- [선택 설치 에이전트 및 기능 패키지](optional-agent-packages.md)
- [아키텍처 지도(개발자용)](architecture-map.md)
