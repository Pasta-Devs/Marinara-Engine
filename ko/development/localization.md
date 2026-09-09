# UI 지역화

Marinara Engine은 앱 인터페이스 문구만 번역합니다. 모델 프롬프트, 직접 작성한 콘텐츠, 생성된 채팅
내용, 식별자, 프로토콜 값, 파일 경로, 저장된 기계용 값은 그대로 둡니다.

영어는 기준 로케일이자 실행 중 대체 언어입니다. 그래서 커뮤니티 번역이 빠져 있어도 번역 키나 빈 컨트롤이
아니라 영어 문구가 표시됩니다.

인터페이스 언어는 **Settings > General > App Behavior > Language**(설정 > 일반 > 앱 동작 > 언어)에서
고릅니다. 여기서 바뀌는 것은 Marinara의 조작 요소와 안내 문구이며, 모델 프롬프트나 직접 작성한 콘텐츠, 채팅 메시지는 그대로입니다.

영어 이외의 언어를 선택하면 필요한 경우 해당 언어 팩을 다운로드합니다. **Refresh language pack**(언어 팩 새로 고침)으로 최신 번역을 받을 수 있습니다. 다운로드한 팩은 `DATA_DIR/ui-packs`에 저장되며 오프라인에서도 작동합니다. 다운로드에 실패해도 현재 언어와 설치된 팩은 바뀌지 않습니다. 시작하거나 업데이트할 때 팩을 자동으로 다운로드하지 않습니다.

번역을 함께 제공하던 버전에서 처음 업그레이드하면 이전에 선택한 영어 이외의 언어가 영어로 돌아갑니다. 해당 언어를 다시 선택하여 다운로드하세요. 사용자 콘텐츠와 다른 설정은 바뀌지 않습니다.

## 지원하는 인터페이스 언어

| 언어 | 로케일 파일 | 표기 방향 |
| --- | --- | --- |
| 아랍어 | `ar.json` | 오른쪽에서 왼쪽 |
| 중국어 간체 | `zh-Hans.json` | 왼쪽에서 오른쪽 |
| 영어 | `en.json` | 왼쪽에서 오른쪽 |
| 프랑스어 | `fr.json` | 왼쪽에서 오른쪽 |
| 독일어 | `de.json` | 왼쪽에서 오른쪽 |
| 힌디어 | `hi.json` | 왼쪽에서 오른쪽 |
| 일본어 | `ja.json` | 왼쪽에서 오른쪽 |
| 한국어 | `ko.json` | 왼쪽에서 오른쪽 |
| 폴란드어 | `pl.json` | 왼쪽에서 오른쪽 |
| 포르투갈어(브라질) | `pt-BR.json` | 왼쪽에서 오른쪽 |
| 러시아어 | `ru.json` | 왼쪽에서 오른쪽 |
| 스페인어 | `es.json` | 왼쪽에서 오른쪽 |

영어를 원본 카탈로그로 관리합니다. 커뮤니티 카탈로그는 기계 번역의 도움으로 만들어졌으며 해당 언어에 능숙한 분의 수정을 환영합니다. UI 텍스트 추출은 아직 진행 중이므로 번역 키가 없는 텍스트는 계속 영어로 표시됩니다.

## 로케일 파일

기준이 되는 영어 카탈로그의 위치는 그대로입니다:

```text
packages/client/src/localization/locales/en.json
```

커뮤니티 팩은 문서의 언어별 폴더와 별도로 [`docs-i18n`의 `ui/`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui)에 있습니다. 각 BCP-47 로케일은 `ui/pl.json`, `ui/ko.json`, `ui/pt-BR.json` 같은 JSON 파일 하나를 사용하며, 함께 생성되는 `ui/manifest.json`에 파일 크기와 SHA-256 해시가 기록됩니다. 로케일 코드의 대소문자를 정확히 유지하세요. 아랍어 문서 팩이 없어도 아랍어 UI는 지원됩니다. 영어는 애플리케이션과 함께 로드됩니다. 커뮤니티 팩은 명시적인 요청으로 다운로드하고 로컬 서버에서 읽습니다.

```json
{
  "_meta": {
    "locale": "pl",
    "direction": "ltr"
  },
  "chat.input.placeholder": "Napisz odpowiedź…",
  "common.actions.save": "Zapisz"
}
```

인터페이스 영역별로 묶은 의미 기반 키를 쓰세요. 영어 문장을 키로 쓰면 문구를 조금만 다듬어도 모든 번역이
무효가 되므로 금지합니다.

## 번역 규칙

- 값만 번역합니다. 의미 기반 키의 이름은 바꾸지 마세요.
- `{{name}}` 같은 치환 토큰과 `<strong>` 같은 서식 태그는 그대로 두세요.
- 번역 키는 알파벳순으로 유지하세요.
- Marinara Engine 같은 제품명은 프로젝트가 공식 현지 이름을 채택하기 전까지 그대로 두세요.
- `en.json`의 의미와 어조를 맞추고, 영어 원문에 없는 동작이나 약속을 덧붙이지 마세요.
- 번역한 라벨이 데스크톱과 모바일 화면에 들어가는지 확인하세요.

기능 영역의 번역을 준비하는 동안 커뮤니티 팩에서 일시적으로 키를 생략할 수 있습니다. 누락된 키는 영어로 표시됩니다. 팩 검증기는 번역 비율과 오래된 키를 보고하며, Engine은 오래된 키를 무시합니다. 빈 번역(기존의 의도적으로 비워 둔 접미사 예외 제외), 잘못된 메타데이터, 변경된 보간 또는 서식 있는 텍스트 토큰은 검증을 통과하지 못합니다. 키 이름 변경과 삭제는 팩에도 반영하거나 `[ui-i18n]` 후속 이슈로 추적해야 합니다.

기능 PR에서는 기준 영어 키를 추가하거나 업데이트해야 하지만 커뮤니티 팩까지 수정할 필요는 없습니다. 유용한 번역을 제공할 수 있을 때만 커뮤니티 값을 번역하세요. 키 목록을 같게 맞추려고 모든 언어 파일에 영어 값을 복사하지 마세요. 폴백이 이미 영어 텍스트를 제공하며, 키를 비워 두면 번역자에게 불필요한 병합 충돌을 줄일 수 있습니다.

기계 번역도 PR에서 그렇다고 밝히면 초안으로 환영합니다. 해당 언어에 능숙한 사람이 용어, 어조, 잘림, 모바일
배치를 검토한 다음에야 그 로케일을 검토 완료로 표시할 수 있습니다.

## 기존 번역 수정 제안하기

문구를 조금 고치는 정도라면 GitHub 웹 편집기만으로 충분합니다.

1. [`ui/`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui)에서
   해당 로케일 파일을 여세요.
2. 연필 아이콘을 눌러 파일을 편집하세요. 필요하면 GitHub가 포크 생성을 제안합니다.
3. 번역된 값만 바꾸세요. 키, `{{name}}`처럼 문장 부호에 민감한 토큰, JSON 문법은 그대로
   두어야 합니다.
4. 포크에 만든 전용 브랜치에 변경을 커밋하세요.
5. 아래 명령으로 팩 매니페스트를 갱신하고 검증한 다음, `staging`이나 `main`이 아닌 **`docs-i18n`**을 대상으로 풀 리퀘스트를 여세요. ([`validate-packs.mjs`](#%EC%83%88-%EC%96%B8%EC%96%B4-%EB%B2%88%EC%97%AD-%EC%A0%9C%EC%B6%9C%ED%95%98%EA%B8%B0))
6. PR 설명에는 언어, 어떤 의미를 바로잡았는지, 그리고 해당 언어에 능숙한 사람인지 기계 번역을 썼는지
   적으세요.

제목은 `Improve French UI translation`처럼 붙이세요. 한 로케일에 대한 관련 수정 여러 건은 PR 하나로 묶어도
됩니다. 관련 없는 코드 변경은 따로 분리하세요.

## 새 언어 번역 제출하기

새 언어를 추가할 때는 영어 원문을 참조할 Engine `staging` 체크아웃을 준비하고 `docs-i18n`에서 작업하세요:

`/path/to/Engine`은 `packages/client/src/localization/locales/en.json`이 있는 별도의 기존 `staging` 브랜치 체크아웃을 뜻합니다. 다음 명령은 번역 작업용 체크아웃을 추가로 만듭니다.

```bash
git clone https://github.com/YOUR-NAME/Marinara-Engine.git
cd Marinara-Engine
git checkout docs-i18n
git pull
git checkout -b translation/LOCALE
```

그다음 순서는 이렇습니다.

1. Engine 체크아웃의 기준 `en.json`을 `ui/it.json`이나 `ui/pt-PT.json` 같은 `ui/<locale>.json`으로 복사하세요.
2. `_meta.locale`은 `.json`을 뗀 파일 이름과 같게 두세요.
3. `_meta.direction`은 `ltr` 또는 `rtl`로 설정하세요.
4. 위 규칙에 따라 값을 번역하세요. 새 로케일은 영어 카탈로그 전체를 옮기는 쪽이 좋지만, 일부만 채워도
   나머지는 영어로 대체됩니다.
5. 매니페스트를 생성하고 팩 검증기를 실행하세요(Node.js만 필요하며 의존성 설치는 필요하지 않습니다). Engine 체크아웃의 영어 카탈로그를 기준으로 번역 비율을 보고합니다:

   ```bash
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json --write-manifest
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json
   ```

6. 새 언어는 `packages/shared/src/utils/ui-locales.ts`의 `UI_LANGUAGE_CODES`에 코드를 추가하는 작은 Engine PR도 필요합니다. 기존 팩 업데이트에는 Engine 변경이 필요하지 않습니다. 게시한 뒤 **Settings > General**에서 언어를 선택하고 데스크톱과 모바일 모두에서 확인하세요. 긴 레이블, 툴팁, 로딩 및 오류 상태, 텍스트 방향을 점검하세요.
7. 브랜치를 포크에 푸시하고
   [풀 리퀘스트를 여세요](https://github.com/Pasta-Devs/Marinara-Engine/compare). 이때 base로
   `Pasta-Devs/Marinara-Engine:docs-i18n`을 고르세요.

PR 설명에는 로케일, 번역 출처, 언어 숙련도나 검토 수준, 실행한 검증 명령, 그리고 아직 원어민 검토가 필요한
부분을 적으세요. PR 템플릿은 사실대로 채우고, 직접 확인한 수동 항목만 체크하세요.

## 클라이언트 코드에서 번역 사용하기

React 컴포넌트는 `useTranslation`을 씁니다.

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();
return <button>{t("common.actions.save")}</button>;
```

모듈 수준의 UI 설정에는 번역된 값 대신 번역 키를 저장하세요. 그래야 페이지를 새로 고치지 않아도 언어 변경이
바로 반영됩니다. React를 쓰지 않는 클라이언트 헬퍼는 `packages/client/src/localization/i18n.ts`가 내보내는
`translate` 함수를 쓸 수 있습니다.

화면에 보이는 문구는 모두 번역 대상입니다. 라벨, 플레이스홀더, 툴팁, 접근성 이름, 대체 텍스트, 로딩 및 빈
상태, 토스트, 확인 문구, 고정 튜토리얼이 여기에 들어갑니다. 프롬프트나 직접 작성한 콘텐츠는 UI 번역기를 거치게 하지 마세요.

Settings 컨트롤, 도움말 툴팁, 창 제목처럼 예전부터 공용으로 쓰던 요소는 아직 옮기지 못한 호출부를 위해 기준
영어 카탈로그 값과 정확히 일치하는 문자열도 인식합니다. 다만 이는 과도기용 호환 장치일 뿐 권장 방식이 아닙니다.
새로 만들거나 크게 고친 컴포넌트는 `t("area.control.label")` 형태의 의미 기반 키를 직접 써야 합니다. `en.json`에 없는 영어 문장은 번역되지 않습니다.

저장소 지역화 검사는 클라이언트 TSX에 남은 미번역 인터페이스 문구도 점검합니다.

```bash
pnpm localization:ui-check
```

이 검사는 화면에 보이는 JSX, 문자열에 바로 끼워 넣은 라벨과 안내문, 접근성 이름, 플레이스홀더, 로딩 및 빈
상태, 토스트, 확인 문구를 살핍니다. `code`, `pre`, `script`, `style` 요소 안의 리터럴 내용은 일부러
제외했습니다. 명령어, 설정 값, URL, 매크로처럼 기계가 읽는 예시는 원문 그대로여야 하기 때문입니다.
사용자가 작성한 값, 생성된 값, 저장된 값, 프롬프트 값, 프로토콜 값도 마찬가지로 인터페이스 번역기 바깥에 두어야 합니다.

## 다운로드형 에이전트 인터페이스

Engine이 관리하는 에이전트 화면은 기준 영어와 다운로드한 `docs-i18n/ui` 팩을 사용합니다. 다운로드 가능한 기능 클라이언트의 번역은 Marinara-Agents 저장소에서 각각 관리합니다.

capability 커스텀 요소는 모두 선택된 로케일을 `lang` 속성과 `dir` 속성으로 함께 전달받고, 다음 값도 받습니다.

```ts
capabilityProps.localization = {
  locale: "pl",
  direction: "ltr",
};
```

로케일이 바뀌면 기존 `marinara-capability-props` 이벤트가 발생합니다. 패키지 UI는 함께 들어 있는 로케일을 고르고, 없으면 패키지의 영어로 대체한 다음, 이 이벤트가 오면 다시 그려야 합니다.
