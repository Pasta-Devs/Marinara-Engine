import type { AchievementEvent } from "@marinara-engine/shared";
import { trackAchievementEvent } from "../hooks/use-achievements";
import { useChatStore } from "../stores/chat.store";
import { isMobileShellViewport, useUIStore, type HomeRequest } from "../stores/ui.store";
import { requestProfessorMariOpen } from "./professor-mari-open";
import type { ProfessorMariNavigationTarget } from "./professor-mari-navigation";
import { isOmnibarSettingsTarget, SETTINGS_SEARCHABLE_CONTROLS } from "./settings-registry";
import { overhaulSettingsTabFor, overhaulSettingsTabForClassicTab } from "../components/overhaul/settings-tabs";
import { isOverhaulLook, isOverhaulMobile, useOverhaulStore } from "../stores/overhaul.store";
import { openLibrarySection } from "../components/overhaul/library-navigation";

const DISCORD_INVITE_URL = "https://discord.com/invite/KdAkTg94ME";
const SUPPORT_URL = "https://ko-fi.com/marinara_spaghetti";

/** The same achievement events Home's own Discord, Ko-fi and Credits links fire. */
function trackWindow(event: AchievementEvent) {
  void trackAchievementEvent(event, { keepalive: true }).catch(() => undefined);
}

/** Leave the current chat or editor, show Home, then let Home open the surface. */
function openHomeWith(request: HomeRequest) {
  const ui = useUIStore.getState();
  useChatStore.getState().setActiveChatId(null);
  ui.closeAllDetails();
  ui.closeRightPanel();
  ui.requestHome(request);
}

export function executeStateNavigation(target: ProfessorMariNavigationTarget): boolean {
  const ui = useUIStore.getState();
  if (target.kind === "home") {
    useChatStore.getState().setActiveChatId(null);
    ui.closeAllDetails();
    ui.closeRightPanel();
  } else if (target.kind === "professor") {
    useChatStore.getState().setActiveChatId(null);
    ui.closeAllDetails();
    ui.closeRightPanel();
    requestProfessorMariOpen();
  } else if (target.kind === "chats") {
    ui.setSidebarOpen(true);
    ui.closeRightPanel();
  } else if (target.kind === "chat") {
    // On the phone shell the sidebar is a full-screen sheet, so opening it here
    // would cover the chat we just navigated to (F3, slice 41); closing it when
    // it was already open before this navigation covers the same case for a
    // sheet the user had open beforehand, not just one this action would have
    // opened (O4 item 6).
    if (isMobileShellViewport()) ui.setSidebarOpen(false);
    else ui.setSidebarOpen(true);
    ui.closeRightPanel();
    useChatStore.getState().setActiveChatId(target.chatId);
  } else if (target.kind === "panel") {
    // New layout: a Library section is a page of its own, not just the highlighted pane entry.
    if (isOverhaulLook()) openLibrarySection(target.panel);
    else ui.openRightPanel(target.panel);
  } else if (target.kind === "settings" && isOmnibarSettingsTarget(target)) {
    // Q2: these live in the omnibar's settings view, which keeps the omnibar open.
    ui.openOmnibarSettings(target.controlId ?? null);
    return true;
  } else if (target.kind === "settings") {
    ui.setSettingsTab(target.tab);
    ui.setSettingsTargetControlId(target.controlId ?? null);
    ui.setSettingsTargetSectionId(target.sectionId ?? null);
    // New layout: Settings is a Library page; it reads the target above, picks its own tab and
    // scrolls to the row (H3: these results used to close the omnibar and open nothing).
    if (isOverhaulLook()) {
      const sectionId =
        target.sectionId ??
        SETTINGS_SEARCHABLE_CONTROLS.find((control) => control.id === target.controlId)?.sectionId ??
        null;
      const tab = overhaulSettingsTabFor(sectionId) ?? overhaulSettingsTabForClassicTab(target.tab);
      if (tab) useOverhaulStore.getState().setSettingsTab(tab);
      openLibrarySection("settings");
    } else ui.openRightPanel("settings");
  } else if (target.kind === "surface") {
    if (target.surface === "card-downloads") ui.openBotBrowser();
    else if (target.surface === "character-library") ui.openCharacterLibrary();
    else if (target.surface === "persona-library") ui.openPersonaLibrary();
    else if (target.surface === "agent-catalog") ui.openAgentCatalog();
    else if (target.surface === "schedules") {
      // The Schedules page is part of the new layout; the classic layout keeps it in the Chats footer.
      if (isOverhaulLook()) {
        ui.closeAllDetails();
        useOverhaulStore.getState().openSchedules();
        if (isOverhaulMobile()) ui.setSidebarOpen(false);
      } else ui.setSidebarOpen(true);
    } else ui.openGameAssetsBrowser();
  } else if (target.kind === "resource") {
    if (target.resource === "character") ui.openCharacterDetail(target.id);
    else if (target.resource === "persona") ui.openPersonaDetail(target.id);
    else if (target.resource === "preset") ui.openPresetDetail(target.id);
    else if (target.resource === "lorebook")
      ui.openLorebookDetail(target.id, target.entryId ? { initialTab: "entries", entryId: target.entryId } : undefined);
    else ui.openAgentDetail(target.id);
  } else if (target.kind === "window") {
    if (target.window === "documentation") ui.openModal("docs-viewer");
    else if (target.window === "tutorial") ui.setHasCompletedOnboarding(false);
    else if (target.window === "discord") {
      trackWindow("discord_clicked");
      window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer");
    } else if (target.window === "support") {
      trackWindow("kofi_clicked");
      window.open(SUPPORT_URL, "_blank", "noopener,noreferrer");
    } else if (target.window === "credits") {
      trackWindow("credits_viewed");
      openHomeWith({ kind: "credits" });
    } else if (target.window === "faq" || target.window === "widgets") openHomeWith({ kind: target.window });
  } else openHomeWith({ kind: "tab", tab: target.packageId });
  ui.setOmnibarOpen(false);
  return true;
}
