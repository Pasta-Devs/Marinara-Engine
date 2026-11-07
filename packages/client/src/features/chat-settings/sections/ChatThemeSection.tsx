// ──────────────────────────────────────────────
// Chat settings > Theme (theming panel, batch 5)
//
// One chat can wear its own custom theme. "Follow the app" uses whatever theme is active in
// Appearance; "Default look" turns custom themes off for this chat. A chat with one character
// can make its pick that character's default, so its other chats get it too.
// ──────────────────────────────────────────────
import { ChevronDown, Palette } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Chat } from "@marinara-engine/shared";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { useThemes } from "../../../hooks/use-themes";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useUIStore } from "../../../stores/ui.store";

const FOLLOW = "__follow__";
const DEFAULT = "__default__";

export function ChatThemeSection({ chat, style }: { chat: Chat; style?: CSSProperties }) {
  const { t } = useTranslation();
  const { data: themes = [] } = useThemes();
  const updateMeta = useUpdateChatMetadata();
  const characterDefaults = useUIStore((s) => s.characterThemeDefaults);
  const setCharacterThemeDefault = useUIStore((s) => s.setCharacterThemeDefault);
  const metadata = (chat.metadata ?? {}) as { themeId?: unknown };
  const own = typeof metadata.themeId === "string" ? metadata.themeId : undefined;
  const characterId = chat.characterIds?.length === 1 ? chat.characterIds[0]! : null;
  const characterDefault = characterId ? characterDefaults[characterId] : undefined;
  const effective = own ?? characterDefault;
  const value = effective === undefined ? FOLLOW : effective === "" ? DEFAULT : effective;
  const appTheme = themes.find((theme) => theme.isActive) ?? null;
  const missing = effective && !themes.some((theme) => theme.id === effective);

  // While the pick is the character's default (and the chat has none of its own), changing it
  // changes the default; otherwise it is this chat's own pick.
  const characterWide = characterId !== null && characterDefault !== undefined && own === undefined;
  const choose = (next: string) => {
    const themeId = next === FOLLOW ? null : next === DEFAULT ? "" : next;
    if (characterWide && characterId) setCharacterThemeDefault(characterId, themeId);
    else updateMeta.mutate({ id: chat.id, themeId });
  };
  const toggleCharacterWide = (checked: boolean) => {
    if (!characterId) return;
    if (checked) {
      setCharacterThemeDefault(characterId, own ?? "");
      updateMeta.mutate({ id: chat.id, themeId: null });
    } else {
      setCharacterThemeDefault(characterId, null);
      if (characterDefault !== undefined) updateMeta.mutate({ id: chat.id, themeId: characterDefault });
    }
  };

  return (
    <ChatSettingsSection
      id="chat-theme"
      style={style}
      label={t("theming.chat.label", "Theme")}
      icon={<Palette size="0.875rem" />}
      summary={
        value === FOLLOW
          ? t("theming.chat.followShort", "Follows the app")
          : value === DEFAULT
            ? t("theming.chat.defaultShort", "Default look")
            : (themes.find((theme) => theme.id === value)?.name ?? "")
      }
      help={t(
        "theming.chat.help",
        'Give this chat its own custom theme. Themes can also style chats by tag with :root[data-chat-tags~="tag"].',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="relative min-w-0">
          <select
            value={missing ? FOLLOW : value}
            onChange={(event) => choose(event.target.value)}
            aria-label={t("theming.chat.label", "Theme")}
            className="mari-preset-native-select w-full appearance-none truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          >
            <option value={FOLLOW}>
              {appTheme
                ? t("theming.chat.followNamed", "Follow the app ({{name}})", { name: appTheme.name })
                : t("theming.chat.follow", "Follow the app")}
            </option>
            <option value={DEFAULT}>{t("theming.chat.default", "Default look (no custom theme)")}</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            size="0.75rem"
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
        </div>
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]" data-chat-theme-source>
          {own !== undefined
            ? t("theming.chat.sourceChat", "This chat's own pick.")
            : characterDefault !== undefined
              ? t("theming.chat.sourceCharacter", "From this character's default, used in their one-on-one chats.")
              : t("theming.chat.sourceApp", "From the app's theme in Settings > Appearance.")}{" "}
          {t("theming.chat.sourcePages", "Settings and the Library always use the app's theme.")}
        </p>
        {characterId && value !== FOLLOW ? (
          <label className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={characterWide}
              onChange={(event) => toggleCharacterWide(event.target.checked)}
            />
            {t("theming.chat.characterWide", "Use it for every chat with this character")}
          </label>
        ) : null}
      </div>
    </ChatSettingsSection>
  );
}
