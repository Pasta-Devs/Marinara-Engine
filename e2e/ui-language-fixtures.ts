import type { Page } from "@playwright/test";

// Small excerpts of the moved packs, not a second bundled translation catalog.
const titles: Record<string, string> = {
  ar: "سلوك التطبيق",
  de: "App-Verhalten",
  es: "Comportamiento de la aplicación",
  fr: "Comportement de l’application",
  hi: "ऐप का व्यवहार",
  ja: "アプリの動作",
  ko: "앱 동작",
  pl: "Działanie aplikacji",
  "pt-BR": "Comportamento do aplicativo",
  ru: "Поведение приложения",
  "zh-Hans": "应用行为",
};

export async function mockUILanguagePacks(page: Page) {
  const installed = new Set(["en"]);
  const downloads: string[] = [];
  let failDownload = false;
  await page.route("**/api/ui-languages{,/**}", async (route) => {
    const language = new URL(route.request().url()).pathname.split("/")[3];
    if (!language) return route.fulfill({ json: { installed: [...installed] } });
    if (route.request().method() === "POST") {
      downloads.push(language);
      if (failDownload) return route.fulfill({ status: 502, json: { error: "Offline fixture" } });
      installed.add(language);
      return route.fulfill({ json: { language } });
    }
    if (!installed.has(language)) return route.fulfill({ json: null });
    return route.fulfill({
      json: {
        _meta: { locale: language, direction: language === "ar" ? "rtl" : "ltr" },
        "settings.application.title": titles[language],
        ...(language === "pl"
          ? {
              "navigation.topbar.settings": "Ustawienia",
              "settings.application.androidStatusBar.label": "Pokaż pasek stanu Androida",
              "settings.common.search": "Szukaj w ustawieniach",
              "settings.controls.confirmBeforeDelete.label": "Potwierdzaj przed usunięciem",
              "settings.tabs.general.label": "Ogólne",
            }
          : {}),
        ...(language === "ko"
          ? {
              "ui.agents.customagentrepositoriesmodal.repositoryAgentsWillBeImported":
                "{{warning}} 에이전트 {{count}}개를 가져옵니다.",
              "ui.agents.agentcatalogview.catalogSummary":
                "{{availableCount}}개 사용 가능 • {{installedCount}}개 설치됨",
              "ui.modals.stbulkimportmodal.selectedItems": "{{count}}개 선택됨",
              "ui.modals.stbulkimportmodal.importWarnings": "경고 {{count}}개",
              "ui.ui.spritegenerationmodal.noVideoGenerationConnectionsFound":
                '동영상 생성 연결이 없습니다. 설정 → 연결에서 "동영상 생성" 제공자 유형으로 추가하세요.',
            }
          : {}),
      },
    });
  });
  return {
    installed,
    downloads,
    setOffline: (value: boolean) => {
      failDownload = value;
    },
  };
}
