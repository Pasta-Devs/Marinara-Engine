/**
 * The single source of truth for settings navigation: every tab, section and
 * searchable control the Settings panel exposes.
 *
 * Extracted from `components/panels/SettingsPanel.tsx` so surfaces that only
 * need to *point at* a setting — the omnibar, Professor Mari — can read it
 * without importing the 8500-line panel. Nothing here renders, imports an icon
 * or touches a store, so it stays cheap to depend on.
 *
 * Adding a setting: add it here and the omnibar finds it. There is no second
 * list to update. `omnibar-settings.test.ts` fails if a row ever points at an
 * id this file does not define.
 */

/** The six settings tabs. `SettingsPanel`'s `TABS` is pinned to this union. */
/**
 * Owned here rather than in `ui.store` so this module stays free of store
 * imports. `ui.store` re-exports it for the callers that set it as a jump
 * target.
 */
export const QUICK_REPLIES_SETTINGS_CONTROL_ID = "quick-replies" as const;

export type SettingsTabId = "general" | "appearance" | "generations" | "addons" | "import" | "advanced";

export type SettingsSectionId =
  | "application"
  | "notifications"
  | "responses"
  | "input-editing"
  | "text-rules"
  | "game-playback"
  | "overall-generations"
  | "image-generation"
  | "video-generation"
  | "game-assets"
  | "app-style"
  | "text-scale"
  | "chat-display"
  | "roleplay-tracker"
  | "roleplay-messages"
  | "game-presentation"
  | "motion-backgrounds"
  | "conversation-theme"
  | "chat-backgrounds"
  | "prompt-overrides"
  | "personal-extensions"
  | "theme-library"
  | "profile-marinara"
  | "sillytavern-import"
  | "admin-access"
  | "updates"
  | "support-diagnostics"
  | "request-timeouts"
  | "parameters"
  | "message-tools"
  | "backup-export"
  | "storage-optimization"
  | "danger-zone";

export type SettingsSectionMeta = {
  id: SettingsSectionId;
  tab: SettingsTabId;
  label: string;
  description: string;
  aliases: string[];
};

export type SettingsControlKind = "Toggle" | "Slider" | "Select" | "Input" | "Picker" | "Button group";

export type SettingsSearchableControlMeta = {
  id: string;
  sectionId: SettingsSectionId;
  label: string;
  description: string;
  aliases: string[];
  kind: SettingsControlKind;
};

export type SettingsSearchResult =
  | { type: "section"; section: SettingsSectionMeta }
  | { type: "control"; control: SettingsSearchableControlMeta; section: SettingsSectionMeta };

/**
 * Tab-level destinations. `SettingsPanel`'s own `TABS` owns the icon and the
 * i18n keys for rendering; this owns the id, the search copy and the aliases.
 * The panel pins its ids to this union with `satisfies`, so the two cannot
 * drift apart on ids.
 */
export const SETTINGS_TABS: readonly {
  id: SettingsTabId;
  label: string;
  description: string;
  aliases: readonly string[];
}[] = [
  {
    id: "general",
    label: "App Behavior",
    description: "Language, responses, input, notifications, and playback.",
    aliases: ["general", "application", "notifications", "responses", "input", "editing"],
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, chat display, art, motion, and backgrounds.",
    aliases: ["appearance", "style", "display", "font", "background"],
  },
  {
    id: "generations",
    label: "Generations",
    description: "Image, video, asset, and prompt defaults.",
    aliases: ["generation", "image", "video", "assets", "prompts"],
  },
  {
    id: "addons",
    label: "Addons",
    description: "Personal extensions and custom themes.",
    aliases: ["addons", "extensions", "custom css", "themes"],
  },
  {
    id: "import",
    label: "Imports",
    description: "Profiles, assets, and data transfer.",
    aliases: ["import", "restore", "profile", "transfer"],
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Updates, diagnostics, backups, and tools.",
    aliases: ["advanced", "admin", "debug", "backup", "diagnostics", "storage"],
  },
];

export const SETTINGS_SECTIONS: readonly SettingsSectionMeta[] = [
  {
    id: "application",
    tab: "general",
    label: "App Behavior",
    description: "Language, safety confirmations, achievements, music, and playful extras.",
    aliases: ["language", "delete", "confirm", "music", "achievements", "mini mari", "app"],
  },
  {
    id: "notifications",
    tab: "general",
    label: "Notifications",
    description: "Notification sounds and background notifications by mode.",
    aliases: ["notifications", "sound", "ping", "browser", "background replies", "conversation", "roleplay", "game"],
  },
  {
    id: "responses",
    tab: "general",
    label: "Responses",
    description: "How replies arrive, save, and paginate.",
    aliases: ["streaming", "speed", "messages", "pagination", "trim", "model endings"],
  },
  {
    id: "input-editing",
    tab: "general",
    label: "Input & Editing",
    description: "Message input behavior and fast edit controls.",
    aliases: [
      "enter",
      "send",
      "microphone",
      "speech",
      "swipe",
      "reroll",
      "double click",
      "arrow up",
      "quick replies",
      "post only",
      "guide reply",
      "impersonate",
    ],
  },
  {
    id: "text-rules",
    tab: "general",
    label: "Text Rules",
    description: "Formatting applied to chat text.",
    aliases: ["quotes", "bold", "dialogue", "latex", "symbols", "typographic"],
  },
  {
    id: "game-playback",
    tab: "general",
    label: "Game Playback",
    description: "Game mode reading and navigation.",
    aliases: ["game", "text speed", "auto play", "middle mouse", "navigation", "vn"],
  },
  {
    id: "overall-generations",
    tab: "generations",
    label: "Overall Generations",
    description: "Shared behavior for image and video generation requests.",
    aliases: ["media", "image", "video", "queue", "prompt review", "generation"],
  },
  {
    id: "image-generation",
    tab: "generations",
    label: "Image Generation",
    description: "Image canvas defaults and style profiles.",
    aliases: ["image", "background", "portrait", "selfie", "style profiles"],
  },
  {
    id: "video-generation",
    tab: "generations",
    label: "Video Generation",
    description: "Video duration, clip behavior, and reusable video settings.",
    aliases: ["video", "clip", "duration", "conversation call", "animated", "scene"],
  },
  {
    id: "game-assets",
    tab: "import",
    label: "Game Assets",
    description: "Asset folders for music, ambience, sprites, and backgrounds.",
    aliases: ["assets", "music", "ambient", "sfx", "sprites", "backgrounds", "folder"],
  },
  {
    id: "app-style",
    tab: "appearance",
    label: "App Style",
    description: "Theme family, color scheme, accent, and app chrome controls.",
    aliases: ["theme", "accent", "rgb", "cursor", "background", "style", "color scheme"],
  },
  {
    id: "text-scale",
    tab: "appearance",
    label: "Text & Scale",
    description: "Fonts, display size, chat text colors, and legibility controls.",
    aliases: [
      "font",
      "google fonts",
      "display size",
      "chat font",
      "text",
      "stroke",
      "outline",
      "chrome text",
      "legibility",
    ],
  },
  {
    id: "chat-display",
    tab: "appearance",
    label: "Conversation Display",
    description: "Conversation layout and shared message text presentation.",
    aliases: ["chat", "conversation", "messages", "timestamps", "token", "model", "grouping"],
  },
  {
    id: "roleplay-tracker",
    tab: "appearance",
    label: "Tracker Panel",
    description: "Roleplay HUD tracker panel, card layout, and tracker portrait behavior.",
    aliases: ["roleplay", "tracker", "hud", "cards", "thoughts", "temperature", "portrait"],
  },
  {
    id: "roleplay-messages",
    tab: "appearance",
    label: "Roleplay Presentation",
    description: "Classic and Visual Novel display, avatars, sprites, and message opacity.",
    aliases: ["roleplay", "avatar", "sprite", "message", "bubble", "opacity", "portrait"],
  },
  {
    id: "game-presentation",
    tab: "appearance",
    label: "Game Presentation",
    description: "Game VN art scale and dialogue display.",
    aliases: ["game", "vn", "dialogue", "portrait", "sprite", "full body", "presentation"],
  },
  {
    id: "motion-backgrounds",
    tab: "appearance",
    label: "Atmosphere",
    description: "Roleplay weather and atmospheric effects.",
    aliases: ["motion", "weather", "effects", "atmosphere", "rain", "snow", "fog", "roleplay"],
  },
  {
    id: "conversation-theme",
    tab: "appearance",
    label: "Conversation Theme",
    description: "Conversation-mode background gradient by color scheme.",
    aliases: ["conversation", "gradient", "theme", "dark", "light"],
  },
  {
    id: "chat-backgrounds",
    tab: "appearance",
    label: "Backgrounds",
    description: "Chat background images, blur, and default roleplay background.",
    aliases: ["background", "blur", "scene", "image", "roleplay background", "chat background"],
  },
  {
    id: "prompt-overrides",
    tab: "generations",
    label: "Prompt Overrides",
    description: "Reusable image and video prompt templates.",
    aliases: ["prompt", "template", "override", "video prompt", "image prompt"],
  },
  {
    id: "personal-extensions",
    tab: "addons",
    label: "Personal Extensions",
    description: "Sandboxed extension drafts authored by Professor Mari.",
    aliases: ["extensions", "addons", "local code", "browser", "server", "professor mari"],
  },
  {
    id: "theme-library",
    tab: "addons",
    label: "Theme Library",
    description: "Synced themes and custom theme CSS.",
    aliases: ["themes", "custom css", "css", "library", "export theme"],
  },
  {
    id: "profile-marinara",
    tab: "import",
    label: "Profile & Marinara",
    description: "Restore full profiles or import individual Marinara files.",
    aliases: ["profile", "import", "restore", "marinara", "json", "zip"],
  },
  {
    id: "sillytavern-import",
    tab: "import",
    label: "SillyTavern Import",
    description: "Bring over characters, chats, presets, and lorebooks.",
    aliases: ["sillytavern", "st", "character", "chat", "preset", "lorebook", "import"],
  },
  {
    id: "admin-access",
    tab: "advanced",
    label: "Admin Access",
    description: "Admin authorization for privileged actions.",
    aliases: ["admin", "secret", "access", "authorization"],
  },
  {
    id: "updates",
    tab: "advanced",
    label: "Updates",
    description: "Version and update controls.",
    aliases: ["update", "version", "refresh", "release"],
  },
  {
    id: "support-diagnostics",
    tab: "advanced",
    label: "Support Diagnostics",
    description: "Copy technical details for support tickets.",
    aliases: ["support", "diagnostics", "system info", "gpu", "model", "ticket", "bug report"],
  },
  {
    id: "request-timeouts",
    tab: "advanced",
    label: "Request timeouts",
    description: "Adjust how long text, agents and media wait for a slow backend.",
    aliases: ["timeout", "slow", "koboldcpp", "images", "video", "seconds", "backend"],
  },
  {
    id: "parameters",
    tab: "advanced",
    label: "Parameters",
    description: "Reusable numeric controls for provider-specific request fields.",
    aliases: ["custom parameters", "generation", "provider", "min p", "min_p"],
  },
  {
    id: "message-tools",
    tab: "advanced",
    label: "Message Tools",
    description: "Message maintenance and repair utilities.",
    aliases: ["messages", "tools", "repair", "cleanup"],
  },
  {
    id: "backup-export",
    tab: "advanced",
    label: "Backup & Export",
    description: "Backups and manual export tools.",
    aliases: ["backup", "export", "download", "archive", "automatic", "scheduled"],
  },
  {
    id: "storage-optimization",
    tab: "advanced",
    label: "Storage Optimization",
    description: "Find and remove abandoned avatar files.",
    aliases: ["storage", "avatar", "cleanup", "optimize", "orphan", "abandoned"],
  },
  {
    id: "danger-zone",
    tab: "advanced",
    label: "Danger Zone",
    description: "Destructive reset and expunge actions.",
    aliases: ["danger", "reset", "delete", "clear", "expunge", "destructive"],
  },
] as const;

// Keyed by plain string: lookups come from persisted UI state and omnibar rows,
// which are only strings until this map validates them.
export const SETTINGS_SECTION_BY_ID = new Map<string, SettingsSectionMeta>(
  SETTINGS_SECTIONS.map((section) => [section.id, section]),
);

export const SETTINGS_SEARCHABLE_CONTROLS: readonly SettingsSearchableControlMeta[] = [
  {
    id: "hide-chat-help-button",
    sectionId: "application",
    label: "Hide chat Help button",
    description: "Remove the Help button from Conversation, Roleplay, and Game chats.",
    aliases: ["help", "guide", "tutorial", "overlay", "question mark"],
    kind: "Toggle",
  },
  {
    id: "language",
    sectionId: "application",
    label: "Language",
    description: "Choose the app language.",
    aliases: ["locale", "translation"],
    kind: "Select",
  },
  {
    id: "docs-language",
    sectionId: "application",
    label: "Documentation Language",
    description: "Choose the language for Marinara's built-in guides.",
    aliases: [
      "documentation",
      "guides",
      "docs",
      "manual",
      "spanish",
      "español",
      "german",
      "deutsch",
      "french",
      "français",
      "portuguese",
      "português",
      "brazilian",
      "polish",
      "polski",
      "russian",
      "русский",
      "japanese",
      "日本語",
      "korean",
      "한국어",
      "chinese",
      "simplified",
      "简体中文",
      "中文",
      "hindi",
      "हिन्दी",
    ],
    kind: "Select",
  },
  {
    id: "confirm-before-delete",
    sectionId: "application",
    label: "Confirm before deleting",
    description: "Ask before permanently deleting chats, characters, or other items.",
    aliases: ["delete", "confirmation", "safety"],
    kind: "Toggle",
  },
  {
    id: "android-status-bar",
    sectionId: "application",
    label: "Android status bar",
    description: "Show the time, battery level, and notification icons in the Android app.",
    aliases: ["android", "battery", "clock", "time", "notifications", "fullscreen"],
    kind: "Toggle",
  },
  {
    id: "achievements",
    sectionId: "application",
    label: "Achievements",
    description: "Show the Home achievements button and unlock notifications.",
    aliases: ["home", "badges", "unlock"],
    kind: "Toggle",
  },
  {
    id: "music-player",
    sectionId: "application",
    label: "Music Player",
    description: "Show the compact Music Player.",
    aliases: ["spotify", "youtube", "music dj"],
    kind: "Toggle",
  },
  {
    id: "mini-mari",
    sectionId: "application",
    label: "Mini Mari surprise visits",
    description: "Allow rare Chibi Professor Mari messages while scrolling.",
    aliases: ["chibi", "professor", "surprise"],
    kind: "Toggle",
  },
  {
    id: "professor-mari-navigation",
    sectionId: "application",
    label: "Professor Mari navigation",
    description: "Show Professor Mari's deterministic navigator on Home.",
    aliases: ["home", "helper", "navigation", "navigator", "where is", "find"],
    kind: "Toggle",
  },
  {
    id: "mari-permissions-mode",
    sectionId: "application",
    label: "Professor Mari Permissions Mode",
    description: "When Mari may stage or apply workspace changes: Auto, Manual, Accept edits, Plan, or Bypass.",
    aliases: ["mari", "permissions", "mode", "plan", "bypass", "accept", "manual", "approve"],
    kind: "Select",
  },
  {
    id: "notification-position",
    sectionId: "notifications",
    label: "Notification position",
    description: "Choose where error messages and other notifications appear.",
    aliases: ["error", "toast", "top", "bottom", "position"],
    kind: "Select",
  },
  {
    id: "notification-conversation-sound",
    sectionId: "notifications",
    label: "Conversation mode notification sound",
    description: "Play a ping for Conversation replies.",
    aliases: ["sound", "ping", "convo"],
    kind: "Toggle",
  },
  {
    id: "notification-roleplay-sound",
    sectionId: "notifications",
    label: "Roleplay mode notification sound",
    description: "Play a ping for Roleplay replies.",
    aliases: ["sound", "ping", "rp"],
    kind: "Toggle",
  },
  {
    id: "notification-game-sound",
    sectionId: "notifications",
    label: "Game mode notification sound",
    description: "Play a ping for Game replies.",
    aliases: ["sound", "ping"],
    kind: "Toggle",
  },
  {
    id: "notification-unfocused-only",
    sectionId: "notifications",
    label: "Only when Marinara is unfocused",
    description: "Play notification sounds only while Marinara is not focused.",
    aliases: ["sound", "background", "unfocused"],
    kind: "Toggle",
  },
  {
    id: "browser-background-notifications",
    sectionId: "notifications",
    label: "Background replies browser notifications",
    description: "Show browser notifications for background Conversation replies.",
    aliases: ["browser", "notifications", "conversation"],
    kind: "Toggle",
  },
  {
    id: "mobile-background-notifications",
    sectionId: "notifications",
    label: "Background replies mobile notifications",
    description: "Show native Android notifications for background Conversation replies.",
    aliases: ["mobile", "android", "notifications", "conversation"],
    kind: "Toggle",
  },
  {
    id: "enable-streaming",
    sectionId: "responses",
    label: "Enable streaming",
    description: "Show AI responses as they generate.",
    aliases: ["stream", "typewriter", "response"],
    kind: "Toggle",
  },
  {
    id: "streaming-speed",
    sectionId: "responses",
    label: "Streaming speed",
    description: "Tune how fast streamed tokens appear.",
    aliases: ["speed", "typewriter", "tokens"],
    kind: "Slider",
  },
  {
    id: "trim-incomplete-output",
    sectionId: "responses",
    label: "Trim incomplete sentences from the response",
    description: "Trim trailing unfinished sentences from AI responses.",
    aliases: ["trim", "unfinished", "sentence"],
    kind: "Toggle",
  },
  {
    id: "messages-per-page",
    sectionId: "responses",
    label: "Messages per page",
    description: "Control how many messages load at once.",
    aliases: ["pagination", "load more", "history"],
    kind: "Input",
  },
  {
    id: "speech-to-text",
    sectionId: "input-editing",
    label: "Speech-to-text microphone",
    description: "Show a microphone button in chat inputs.",
    aliases: ["microphone", "dictation", "speech"],
    kind: "Toggle",
  },
  {
    id: "intuitive-swipe-navigation",
    sectionId: "input-editing",
    label: "Intuitive swipe navigation",
    description: "Use keyboard arrows or touch swipes to move between generations.",
    aliases: ["swipes", "arrows", "alternate generations"],
    kind: "Toggle",
  },
  {
    id: "reroll-past-newest-swipe",
    sectionId: "input-editing",
    label: "Reroll past the newest swipe",
    description: "Create a reroll when swiping past the newest assistant message.",
    aliases: ["swipe", "reroll", "regenerate"],
    kind: "Toggle",
  },
  {
    id: "up-arrow-edits-last-message",
    sectionId: "input-editing",
    label: "Up Arrow edits last message",
    description: "Open the most recent message for editing with Up Arrow.",
    aliases: ["keyboard", "edit", "shortcut"],
    kind: "Toggle",
  },
  {
    id: "double-click-edits-messages",
    sectionId: "input-editing",
    label: "Double-click edits messages",
    description: "Edit Roleplay messages with double-click or double-tap.",
    aliases: ["double tap", "edit", "roleplay"],
    kind: "Toggle",
  },
  {
    id: "bold-dialogue",
    sectionId: "text-rules",
    label: "Bold dialogue in quotes",
    description: "Bold quoted dialogue text in chat display.",
    aliases: ["quotes", "dialogue", "formatting"],
    kind: "Toggle",
  },
  {
    id: "convert-latex-symbols",
    sectionId: "text-rules",
    label: "Convert LaTeX symbols",
    description: "Display common LaTeX commands as regular symbols.",
    aliases: ["math", "symbols", "formatting"],
    kind: "Toggle",
  },
  {
    id: "quote-style",
    sectionId: "text-rules",
    label: "Quote style",
    description: "Choose how quotation marks are unified.",
    aliases: ["quotes", "dialogue", "punctuation"],
    kind: "Button group",
  },
  {
    id: "color-inline-names",
    sectionId: "text-rules",
    label: "Color Character Names in Text",
    description: "Color character names and aliases inline in message text.",
    aliases: ["names", "aliases", "color", "gradient", "characters"],
    kind: "Toggle",
  },
  {
    id: "disable-inline-name-gradients",
    sectionId: "text-rules",
    label: "Force Solid Colors for Inline Names",
    description: "Replace gradient name colors with the brightest solid color inline.",
    aliases: ["gradient", "solid", "names", "readability"],
    kind: "Toggle",
  },
  {
    id: "game-instant-text-reveal",
    sectionId: "game-playback",
    label: "Instantly reveal game text",
    description: "Skip the Game mode narration typewriter effect.",
    aliases: ["game", "typewriter", "instant"],
    kind: "Toggle",
  },
  {
    id: "game-middle-mouse-navigation",
    sectionId: "game-playback",
    label: "Mouse-wheel + click navigation",
    description: "Navigate Game mode with mouse wheel and background clicks.",
    aliases: ["middle mouse", "scroll", "game navigation"],
    kind: "Toggle",
  },
  {
    id: "game-narration-speed",
    sectionId: "game-playback",
    label: "Game narration speed",
    description: "Tune the Game mode narration typewriter speed.",
    aliases: ["game", "typewriter", "speed"],
    kind: "Slider",
  },
  {
    id: "game-auto-play-delay",
    sectionId: "game-playback",
    label: "Game auto-play segment delay",
    description: "Pause between Game mode auto-play narration segments.",
    aliases: ["autoplay", "game", "delay"],
    kind: "Slider",
  },
  {
    id: "queue-media-generation",
    sectionId: "overall-generations",
    label: "Queue media generation requests",
    description: "Send image and video generation jobs one at a time per connection.",
    aliases: ["media", "image", "video", "queue", "generation"],
    kind: "Toggle",
  },
  {
    id: "image-prompt-review",
    sectionId: "overall-generations",
    label: "Expose media prompts before sending",
    description: "Review generated image and Gallery video prompts before sending.",
    aliases: [
      "image",
      "video",
      "media",
      "prompt",
      "review",
      "selfie",
      "noodle",
      "avatar",
      "portrait",
      "sprite",
      "animated expression",
    ],
    kind: "Toggle",
  },
  {
    id: "image-background-size",
    sectionId: "image-generation",
    label: "Background image size",
    description: "Set default generated background dimensions.",
    aliases: ["image", "resolution", "canvas"],
    kind: "Input",
  },
  {
    id: "image-illustration-size",
    sectionId: "image-generation",
    label: "Illustration image size",
    description: "Set default generated illustration dimensions.",
    aliases: ["image", "resolution", "canvas", "illustrator"],
    kind: "Input",
  },
  {
    id: "image-game-size",
    sectionId: "image-generation",
    label: "Game scene image size",
    description: "Set the default dimensions for generated Game scene illustrations.",
    aliases: ["image", "resolution", "canvas", "game", "illustrator"],
    kind: "Input",
  },
  {
    id: "image-portrait-size",
    sectionId: "image-generation",
    label: "Portrait image size",
    description: "Set default generated portrait dimensions.",
    aliases: ["image", "resolution", "canvas", "character"],
    kind: "Input",
  },
  {
    id: "image-character-sheet-size",
    sectionId: "image-generation",
    label: "Character sheets",
    description: "Set character reference sheet dimensions independently of backgrounds.",
    aliases: ["image", "resolution", "canvas", "character", "reference", "sheet"],
    kind: "Input",
  },
  {
    id: "image-selfie-size",
    sectionId: "image-generation",
    label: "Selfie image size",
    description: "Set default generated selfie dimensions.",
    aliases: ["image", "resolution", "canvas", "conversation"],
    kind: "Input",
  },
  {
    id: "image-style-profiles",
    sectionId: "image-generation",
    label: "Style Profiles",
    description: "Tune reusable image prompt style profiles.",
    aliases: ["image", "style", "danbooru", "anime", "realistic"],
    kind: "Select",
  },
  {
    id: "video-scene-duration",
    sectionId: "video-generation",
    label: "Scene video fallback length",
    description: "Set fallback duration for generated scene videos.",
    aliases: ["video", "duration", "length"],
    kind: "Input",
  },
  {
    id: "video-animated-expression-duration",
    sectionId: "video-generation",
    label: "Animated expression length",
    description: "Set animated expression clip duration.",
    aliases: ["video", "expression", "sprite", "duration"],
    kind: "Input",
  },
  {
    id: "visual-theme",
    sectionId: "app-style",
    label: "Visual Style",
    description: "Switch between Marinara and SillyTavern visual themes.",
    aliases: ["theme", "style", "sillytavern", "marinara"],
    kind: "Button group",
  },
  {
    id: "theme-mode",
    sectionId: "app-style",
    label: "Color Scheme",
    description: "Switch between dark and light mode.",
    aliases: ["theme", "dark", "light", "mode"],
    kind: "Select",
  },
  {
    id: "desktop-sidebar-width",
    sectionId: "app-style",
    label: "Desktop sidebar width",
    description:
      "Adjust both desktop sidebars. Their contents adapt to the available space; mobile panels keep their existing layout.",
    aliases: ["sidebar", "width", "resize", "left panel", "right panel"],
    kind: "Slider",
  },
  {
    id: "custom-cursor",
    sectionId: "app-style",
    label: "Custom Mouse Pointer",
    description: "Use Marinara's accent-colored cursor.",
    aliases: ["cursor", "mouse", "pointer"],
    kind: "Toggle",
  },
  {
    id: "app-background-color",
    sectionId: "app-style",
    label: "Background Color",
    description: "Set the main app shell background color.",
    aliases: ["background", "theme", "gradient"],
    kind: "Picker",
  },
  {
    id: "app-accent-color",
    sectionId: "app-style",
    label: "Accent Color",
    description: "Set the shared app accent color.",
    aliases: ["primary", "theme", "highlight"],
    kind: "Picker",
  },
  {
    id: "accent-pulse",
    sectionId: "app-style",
    label: "Accent Pulse",
    description: "Animate the selected accent color.",
    aliases: ["accent", "animation", "motion"],
    kind: "Toggle",
  },
  {
    id: "rgb-mode",
    sectionId: "app-style",
    label: "RGB Mode",
    description: "Cycle the app accent through Marinara's rainbow palette.",
    aliases: ["rainbow", "accent", "color"],
    kind: "Toggle",
  },
  {
    id: "font-family",
    sectionId: "text-scale",
    label: "Font",
    description: "Choose the font used across the app.",
    aliases: ["typography", "typeface"],
    kind: "Select",
  },
  {
    id: "display-size",
    sectionId: "text-scale",
    label: "Display Size",
    description: "Adjust the base font size across the app.",
    aliases: ["font size", "scale", "readability"],
    kind: "Select",
  },
  {
    id: "chat-font-size",
    sectionId: "text-scale",
    label: "Chat Font Size",
    description: "Adjust the font size of chat messages.",
    aliases: ["text size", "message size", "readability"],
    kind: "Slider",
  },
  {
    id: "chat-text-color",
    sectionId: "text-scale",
    label: "Chat Text Color",
    description: "Control the main chat message text color.",
    aliases: ["font color", "message color"],
    kind: "Picker",
  },
  {
    id: "default-dialogue-color",
    sectionId: "text-scale",
    label: "Default Dialogue Color",
    description: "Choose the dialogue highlight used by cards without their own dialogue color.",
    aliases: ["quote color", "character dialogue", "persona dialogue"],
    kind: "Toggle",
  },
  {
    id: "chat-chrome-text-color",
    sectionId: "text-scale",
    label: "Chat Chrome Text Color",
    description: "Control ordinary chrome copy color in chat-adjacent UI.",
    aliases: ["chrome", "text color", "tracker"],
    kind: "Picker",
  },
  {
    id: "text-outline-width",
    sectionId: "text-scale",
    label: "Text Outline / Stroke",
    description: "Tune chat text outline width and color.",
    aliases: ["stroke", "outline", "readability"],
    kind: "Slider",
  },
  {
    id: "conversation-layout",
    sectionId: "chat-display",
    label: "Chat Layout",
    description: "Switch Conversation messages between linear rows and bubbles.",
    aliases: ["conversation", "bubbles", "linear"],
    kind: "Button group",
  },
  {
    id: "conversation-always-display-swipe-menu",
    sectionId: "chat-display",
    label: "Always display swipe menu",
    description:
      "Show swipe arrows and the counter from the first response. Turn off to show them only after regeneration.",
    aliases: ["conversation", "swipe", "regenerate", "arrows"],
    kind: "Toggle",
  },
  {
    id: "roleplay-always-display-swipe-menu",
    sectionId: "roleplay-messages",
    label: "Always display swipe menu",
    description:
      "Show swipe arrows and the counter from the first response. Turn off to show them only after regeneration.",
    aliases: ["roleplay", "swipe", "regenerate", "arrows"],
    kind: "Toggle",
  },
  {
    id: "conversation-avatar-shape",
    sectionId: "chat-display",
    label: "Avatar Shape",
    description: "Choose circular or square avatars in Conversation mode.",
    aliases: ["conversation", "avatar", "circle", "square"],
    kind: "Button group",
  },
  {
    id: "show-characters-in-persona-pickers",
    sectionId: "message-tools",
    label: "Show Characters in Persona Pickers",
    description: "Allow character cards to appear as user identities in chat.",
    aliases: ["persona", "character", "play as", "identity"],
    kind: "Toggle",
  },
  {
    id: "tracker-panel",
    sectionId: "roleplay-tracker",
    label: "Tracker Panel",
    description: "Show or hide the Roleplay HUD tracker panel.",
    aliases: ["tracker", "hud", "roleplay"],
    kind: "Toggle",
  },
  {
    id: "tracker-replace-hud-icons",
    sectionId: "roleplay-tracker",
    label: "Replace tracker HUD icons",
    description: "Hide the old world/player tracker icon strip.",
    aliases: ["tracker", "hud", "icons"],
    kind: "Toggle",
  },
  {
    id: "tracker-expression-sprites",
    sectionId: "roleplay-tracker",
    label: "Use expression sprites for tracker portraits",
    description: "Allow tracker portraits to use Expression Engine sprites.",
    aliases: ["tracker", "sprites", "portraits"],
    kind: "Toggle",
  },
  {
    id: "tracker-panel-background",
    sectionId: "roleplay-tracker",
    label: "Panel background",
    description: "Pick the Tracker panel background.",
    aliases: ["tracker", "background", "color"],
    kind: "Picker",
  },
  {
    id: "tracker-desktop-size",
    sectionId: "roleplay-tracker",
    label: "Desktop size",
    description: "Choose the Tracker panel desktop width.",
    aliases: ["tracker", "width", "compact", "expanded"],
    kind: "Button group",
  },
  {
    id: "tracker-thought-display-mode",
    sectionId: "roleplay-tracker",
    label: "Thought display mode",
    description: "Choose how featured character thoughts open.",
    aliases: ["tracker", "thoughts", "dock", "floating"],
    kind: "Button group",
  },
  {
    id: "tracker-stat-display-mode",
    sectionId: "roleplay-tracker",
    label: "Stat display mode",
    description: "Choose whether persona and character stats use compact bars or circular gauges.",
    aliases: ["tracker", "stats", "bars", "gauges", "circular"],
    kind: "Button group",
  },
  {
    id: "tracker-docked-thoughts",
    sectionId: "roleplay-tracker",
    label: "Always show Docked thoughts",
    description: "Keep docked tracker thoughts visible inside character cards.",
    aliases: ["tracker", "thoughts", "dock"],
    kind: "Toggle",
  },
  {
    id: "tracker-temperature-unit",
    sectionId: "roleplay-tracker",
    label: "Temperature unit",
    description: "Switch tracker temperature displays between Celsius and Fahrenheit.",
    aliases: ["tracker", "weather", "celsius", "fahrenheit"],
    kind: "Toggle",
  },
  {
    id: "roleplay-vn-display",
    sectionId: "roleplay-messages",
    label: "Visual Novel display",
    description: "Show one completed paragraph at a time above the composer.",
    aliases: ["roleplay", "vn", "visual novel", "classic", "presentation", "history"],
    kind: "Toggle",
  },
  {
    id: "roleplay-vn-autoplay",
    sectionId: "roleplay-messages",
    label: "Auto-play VN paragraphs",
    description: "Advance Roleplay Visual Novel paragraphs automatically, waiting for speech when it is playing.",
    aliases: ["roleplay", "vn", "autoplay", "tts", "speech", "reading"],
    kind: "Toggle",
  },
  {
    id: "roleplay-vn-autoplay-delay",
    sectionId: "roleplay-messages",
    label: "Paragraph delay",
    description: "Set the time between Roleplay Visual Novel paragraphs when auto-play is enabled.",
    aliases: ["roleplay", "vn", "autoplay", "delay", "reading"],
    kind: "Slider",
  },
  {
    id: "roleplay-vn-portrait-scale",
    sectionId: "roleplay-messages",
    label: "Dialogue portrait scale",
    description: "Adjust Roleplay Visual Novel portraits.",
    aliases: ["roleplay", "vn", "portrait", "scale"],
    kind: "Slider",
  },
  {
    id: "roleplay-vn-sprite-scale",
    sectionId: "roleplay-messages",
    label: "Full-body sprite scale",
    description: "Adjust Roleplay Visual Novel full-body sprites.",
    aliases: ["roleplay", "vn", "sprite", "scale"],
    kind: "Slider",
  },
  {
    id: "roleplay-message-opacity",
    sectionId: "roleplay-messages",
    label: "Roleplay Messages Background Opacity",
    description: "Adjust roleplay bubble background opacity.",
    aliases: ["roleplay", "opacity", "messages"],
    kind: "Slider",
  },
  {
    id: "roleplay-reduced-paint-effects",
    sectionId: "roleplay-messages",
    label: "Reduced paint effects",
    description: "Flatten costly Roleplay transparency, shadows, and scene overlays.",
    aliases: ["roleplay", "performance", "firefox", "slow", "paint", "effects"],
    kind: "Toggle",
  },
  {
    id: "show-roleplay-thinking-in-messages",
    sectionId: "roleplay-messages",
    label: "Show Thinking In Messages",
    description: "Show model reasoning above the response inside Roleplay message bubbles.",
    aliases: ["roleplay", "reasoning", "thinking", "thoughts", "messages"],
    kind: "Toggle",
  },
  {
    id: "keep-roleplay-thinking-expanded",
    sectionId: "roleplay-messages",
    label: "Don't Collapse Thinking",
    description: "Keep inline model reasoning expanded when the response starts.",
    aliases: ["roleplay", "reasoning", "thinking", "collapse", "expanded"],
    kind: "Toggle",
  },
  {
    id: "scrollable-avatars",
    sectionId: "roleplay-messages",
    label: "Scrollable Avatars",
    description: "Keep roleplay avatars visible while scrolling long messages.",
    aliases: ["roleplay", "avatars", "sticky"],
    kind: "Toggle",
  },
  {
    id: "narrator-cycling-avatars",
    sectionId: "roleplay-messages",
    label: "Narrator's Cycling Avatars",
    description: "Cycle Narrator avatars or show active characters together.",
    aliases: ["roleplay", "narrator", "avatars", "cycle", "group"],
    kind: "Toggle",
  },
  {
    id: "roleplay-avatar-style",
    sectionId: "roleplay-messages",
    label: "Roleplay Avatars",
    description: "Choose how avatars sit next to roleplay messages.",
    aliases: ["avatar", "portrait", "circles", "rectangles"],
    kind: "Button group",
  },
  {
    id: "roleplay-avatar-scale",
    sectionId: "roleplay-messages",
    label: "Message avatar scale",
    description: "Adjust the default roleplay message avatar scale.",
    aliases: ["avatar", "portrait", "scale"],
    kind: "Slider",
  },
  {
    id: "roleplay-sprite-scale",
    sectionId: "roleplay-messages",
    label: "Default sprite scale",
    description: "Adjust the default roleplay sprite scale.",
    aliases: ["sprite", "scale", "roleplay"],
    kind: "Slider",
  },
  {
    id: "game-dialogue-portrait-scale",
    sectionId: "game-presentation",
    label: "Dialogue portrait scale",
    description: "Adjust Game mode dialogue portrait scale.",
    aliases: ["game", "avatar", "portrait", "scale"],
    kind: "Slider",
  },
  {
    id: "game-full-body-sprite-scale",
    sectionId: "game-presentation",
    label: "Full-body sprite scale",
    description: "Adjust Game mode full-body sprite scale.",
    aliases: ["game", "sprite", "scale"],
    kind: "Slider",
  },
  {
    id: "chat-list-backgrounds",
    sectionId: "chat-backgrounds",
    label: "Chat list backgrounds",
    description: "Show each chat's background as a banner behind its row in the chat list.",
    aliases: ["sidebar", "chat list", "banner", "background", "row"],
    kind: "Button group",
  },
  {
    id: "game-dialogue-display",
    sectionId: "game-presentation",
    label: "Game Dialogue Display",
    description: "Choose a classic dialogue box or segment history display.",
    aliases: ["game", "vn", "history"],
    kind: "Button group",
  },
  {
    id: "game-text-effects",
    sectionId: "game-presentation",
    label: "Game text effects",
    description: "Animate dramatic words and explicit text-effect tags in Game mode.",
    aliases: ["game", "text", "animation", "effects", "accessibility", "motion"],
    kind: "Toggle",
  },
  {
    id: "weather-effects",
    sectionId: "motion-backgrounds",
    label: "Dynamic weather effects",
    description: "Show animated weather particles from story context.",
    aliases: ["weather", "rain", "snow", "fog"],
    kind: "Toggle",
  },
  {
    id: "release-channel",
    sectionId: "updates",
    label: "Release Channel",
    description: "Choose which release channel update checks follow.",
    aliases: ["updates", "branch", "version"],
    kind: "Select",
  },
  {
    id: "restart-server",
    sectionId: "admin-access",
    label: "Restart Server",
    description: "Gracefully restart the Marinara server from this browser.",
    aliases: ["server", "restart", "maintenance", "remote"],
    kind: "Button group",
  },
  {
    id: "copy-support-diagnostics",
    sectionId: "support-diagnostics",
    label: "Copy Diagnostics",
    description: "Copy version, build, system, GPU, and active model details for support.",
    aliases: ["support", "diagnostics", "system info", "gpu", "model", "clipboard"],
    kind: "Button group",
  },
  {
    id: "custom-generation-parameters",
    sectionId: "parameters",
    label: "Custom generation parameters",
    description: "Create reusable numeric provider parameters for chats and connections.",
    aliases: ["parameter", "provider", "min p", "min_p", "range", "tooltip"],
    kind: "Input",
  },
  {
    id: QUICK_REPLIES_SETTINGS_CONTROL_ID,
    sectionId: "input-editing",
    label: "Quick replies",
    description: "Show alternate draft actions beside Send.",
    aliases: ["post only", "guide reply", "impersonate"],
    kind: "Toggle",
  },
  {
    id: "show-message-timestamps",
    sectionId: "message-tools",
    label: "Show message timestamps",
    description: "Display date and time on chat messages.",
    aliases: ["time", "date", "metadata"],
    kind: "Toggle",
  },
  {
    id: "show-model-name",
    sectionId: "message-tools",
    label: "Show model name on messages",
    description: "Display which AI model generated each response.",
    aliases: ["model", "metadata"],
    kind: "Toggle",
  },
  {
    id: "show-token-usage",
    sectionId: "message-tools",
    label: "Show token usage on messages",
    description: "Display prompt and completion token counts.",
    aliases: ["tokens", "context", "cost"],
    kind: "Toggle",
  },
  {
    id: "show-message-numbers",
    sectionId: "message-tools",
    label: "Show message numbers",
    description: "Display message numbers in chats.",
    aliases: ["metadata", "index"],
    kind: "Toggle",
  },
  {
    id: "guide-generations",
    sectionId: "message-tools",
    label: "Guide swipes/regens with chat input",
    description: "Use the current draft as regeneration direction.",
    aliases: ["guided", "regenerate", "swipes"],
    kind: "Toggle",
  },
  {
    id: "include-reasoning-in-exports",
    sectionId: "message-tools",
    label: "Include reasoning in exports",
    description: "Include hidden thinking metadata in chat exports.",
    aliases: ["reasoning", "thinking", "exports"],
    kind: "Toggle",
  },
  {
    id: "debug-mode",
    sectionId: "message-tools",
    label: "Debug mode",
    description: "Log model payloads in the server console.",
    aliases: ["debug", "logs", "prompt", "console"],
    kind: "Toggle",
  },
  {
    id: "automatic-backups",
    sectionId: "backup-export",
    label: "Automatic backups",
    description: "Schedule full backups and choose how many automatic archives to retain.",
    aliases: ["backup", "daily", "weekly", "monthly", "scheduled"],
    kind: "Toggle",
  },
  {
    id: "automatic-backups-kept",
    sectionId: "backup-export",
    label: "Automatic backups kept",
    description: "Retain between 1 and 9999 automatic backup archives without affecting manual backups.",
    aliases: ["backup", "retention", "history", "rotate", "automatic"],
    kind: "Input",
  },
  {
    id: "avatar-storage-optimization",
    sectionId: "storage-optimization",
    label: "Optimize avatar storage",
    description: "Find old avatar image files that are no longer referenced by Marinara data.",
    aliases: ["storage", "avatar", "cleanup", "orphan", "abandoned", "disk space"],
    kind: "Button group",
  },
] as const;

export function searchSettings(query: string, localize: (englishText: string) => string): SettingsSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const parts = normalized.split(/\s+/u).filter(Boolean);

  const controlResults = SETTINGS_SEARCHABLE_CONTROLS.flatMap((control) => {
    const section = SETTINGS_SECTION_BY_ID.get(control.sectionId);
    if (!section) return [];
    const haystack = [
      control.label,
      localize(control.label),
      control.description,
      localize(control.description),
      control.kind,
      localize(control.kind),
      section.label,
      localize(section.label),
      section.description,
      localize(section.description),
      ...control.aliases,
    ]
      .join(" ")
      .toLowerCase();
    return parts.every((part) => haystack.includes(part)) ? [{ type: "control" as const, control, section }] : [];
  });

  const sectionResults = SETTINGS_SECTIONS.filter((section) => {
    const haystack = [
      section.label,
      localize(section.label),
      section.description,
      localize(section.description),
      ...section.aliases,
    ]
      .join(" ")
      .toLowerCase();
    return parts.every((part) => haystack.includes(part));
  }).map((section) => ({ type: "section" as const, section }));

  return [...controlResults, ...sectionResults];
}
