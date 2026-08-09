import { useMemo, type CSSProperties } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import { normalizeAvatarCrop, type AvatarCrop } from "@marinara-engine/shared";
import { useCharacterSpritePreviews, useCharacterSummaries, type SpriteInfo } from "../../hooks/use-characters";
import { useHomeFeed } from "../../hooks/use-home-feed";
import { useGameAssetManifest } from "../../hooks/use-game-assets";
import { resolveAssetTag } from "../../lib/asset-fuzzy-match";
import { chatBackgroundMetadataToUrl } from "../../lib/backgrounds";
import { gameAssetFileUrl } from "../../lib/game-asset-urls";
import { resolveSpriteExpression } from "../../lib/sprite-expression-match";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import { useTranslation } from "react-i18next";
import { ChatModeIcon } from "./ChatModeIcon";

const MODE_BADGE = {
  conversation: {
    labelKey: "home.recentChats.mode.conversation",
    accent: "oklch(0.79 0.16 205)",
  },
  roleplay: {
    labelKey: "home.recentChats.mode.roleplay",
    accent: "oklch(0.76 0.19 52)",
  },
  game: {
    labelKey: "home.recentChats.mode.game",
    accent: "oklch(0.73 0.21 345)",
  },
} as const;

function messagePreview(role: string, content: string, fallback: string, youLabel: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return role === "user" ? `${youLabel}: ${normalized}` : normalized;
}

type PreviewSprite = {
  asset: SpriteInfo;
  layout: "expression" | "full-body";
};

function selectPreviewSprite(
  sprites: SpriteInfo[],
  expression: string | null,
  displayModes: Array<"expressions" | "full-body">,
): PreviewSprite | null {
  const expressionSprites = sprites.filter((sprite) => !sprite.expression.toLowerCase().startsWith("full_"));
  const fullBodySprites = sprites.filter((sprite) => sprite.expression.toLowerCase().startsWith("full_"));
  const requested = expression?.trim() || "neutral";

  if (displayModes.includes("full-body")) {
    const fullBody =
      resolveSpriteExpression(fullBodySprites, `full_${requested}`) ??
      resolveSpriteExpression(fullBodySprites, "full_neutral") ??
      fullBodySprites[0] ??
      null;
    if (fullBody) return { asset: fullBody, layout: "full-body" };
  }

  if (displayModes.includes("expressions")) {
    const expressionSprite = resolveSpriteExpression(expressionSprites, requested) ?? expressionSprites[0] ?? null;
    return expressionSprite ? { asset: expressionSprite, layout: "expression" } : null;
  }

  return null;
}

function resolveGameBackground(
  tag: string | null,
  assets: Record<string, { path: string }> | null | undefined,
): string | null {
  const value = tag?.trim();
  if (!value || value === "black" || value === "none") return null;
  if (/^(?:https?:|data:|blob:|\/)/iu.test(value)) return chatBackgroundMetadataToUrl(value, 620);
  if (!assets) return null;
  const resolvedTag = resolveAssetTag(value, "backgrounds", assets);
  return gameAssetFileUrl(assets[resolvedTag]?.path ?? assets[value]?.path);
}

export function RecentChats() {
  const { t } = useTranslation();
  const feed = useHomeFeed();
  const gameAssets = useGameAssetManifest();
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);
  const recentChats = useMemo(() => feed.data?.recentChats ?? [], [feed.data?.recentChats]);
  const characterIds = useMemo(
    () => Array.from(new Set(recentChats.flatMap(({ chat }) => chat.characterIds))),
    [recentChats],
  );
  const summaries = useCharacterSummaries(characterIds);
  const gameBackgrounds = useMemo(
    () =>
      new Map(
        recentChats.map(({ chat }) => [
          chat.id,
          chat.mode === "game" ? resolveGameBackground(chat.gameBackgroundTag, gameAssets.data?.assets) : null,
        ]),
      ),
    [gameAssets.data?.assets, recentChats],
  );
  const characterLookup = useMemo(() => {
    const lookup = new Map<string, { name: string; avatarUrl: string | null; avatarCrop: AvatarCrop | null }>();
    for (const character of summaries.data ?? []) {
      lookup.set(character.id, {
        name: character.name,
        avatarUrl: character.avatarUrl,
        avatarCrop: normalizeAvatarCrop(character.avatarCrop),
      });
    }
    return lookup;
  }, [summaries.data]);
  const previewCharacterIds = useMemo(
    () =>
      recentChats.flatMap(({ chat }) => {
        const stagedCharacterIds =
          chat.spriteCharacterIds.length > 0
            ? chat.spriteCharacterIds.filter((id) => chat.characterIds.includes(id))
            : chat.characterIds;
        const characterId =
          stagedCharacterIds.find((id) => characterLookup.has(id)) ??
          stagedCharacterIds[0] ??
          chat.characterIds.find((id) => characterLookup.has(id)) ??
          chat.characterIds[0];
        return characterId ? [characterId] : [];
      }),
    [characterLookup, recentChats],
  );
  const spritePreviews = useCharacterSpritePreviews(previewCharacterIds);

  if (feed.isPending) {
    return (
      <div
        className="grid h-full min-h-0 grid-rows-3 gap-1.5 md:auto-rows-fr md:grid-rows-none md:gap-2.5 md:grid-cols-2 xl:grid-cols-3"
        role="status"
        aria-label={t("home.recentChats.loading")}
      >
        {[0, 1, 2].map((item) => (
          <div key={item} className="min-h-0 animate-pulse rounded-xl bg-[var(--muted)]/45 md:h-36 md:rounded-2xl" />
        ))}
      </div>
    );
  }

  if (feed.isError) {
    return (
      <div
        className="flex h-full min-h-36 flex-col justify-end rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--destructive)_55%,var(--border))] p-4"
        role="alert"
      >
        <MessageSquare className="mb-3 text-[var(--destructive)]" size="1.25rem" aria-hidden="true" />
        <p className="text-sm font-semibold text-[var(--foreground)]">{t("home.recentChats.errorTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {t("home.recentChats.errorDescription")}
        </p>
        <button
          type="button"
          onClick={() => void feed.refetch()}
          className="mt-3 inline-flex min-h-8 w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)]"
        >
          <RefreshCw size="0.78rem" aria-hidden="true" />
          {t("home.recentChats.retry")}
        </button>
      </div>
    );
  }

  if (recentChats.length === 0) {
    return (
      <div className="flex h-full min-h-36 flex-col justify-end rounded-2xl border border-dashed border-[var(--border)]/70 p-4">
        <MessageSquare className="mb-3 text-[oklch(0.79_0.16_205)]" size="1.25rem" aria-hidden="true" />
        <p className="text-sm font-semibold text-[var(--foreground)]">{t("home.recentChats.emptyTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {t("home.recentChats.emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid h-full min-h-0 grid-rows-3 gap-1.5 md:auto-rows-fr md:grid-rows-none md:gap-2.5 md:grid-cols-2 xl:grid-cols-3"
      data-component="RecentChats"
      data-mobile-limit="3"
    >
      {recentChats.map(({ chat, latestMessage }, index) => {
        const chatMode = chat.mode;
        const mode = MODE_BADGE[chatMode];
        const chatCharacterIds = chat.characterIds;
        const spriteCharacterIds = chat.spriteCharacterIds;
        const spriteDisplayModes = chat.spriteDisplayModes;
        const spriteExpressions = chat.spriteExpressions;
        const stagedCharacterIds =
          spriteCharacterIds.length > 0
            ? spriteCharacterIds.filter((id) => chatCharacterIds.includes(id))
            : chatCharacterIds;
        const characterId =
          stagedCharacterIds.find((id) => characterLookup.has(id)) ??
          stagedCharacterIds[0] ??
          chatCharacterIds.find((id) => characterLookup.has(id)) ??
          chatCharacterIds[0] ??
          null;
        const character = characterId ? characterLookup.get(characterId) : null;
        const displayModes =
          spriteDisplayModes.length > 0 ? spriteDisplayModes : (["expressions", "full-body"] as const);
        const sprite = characterId
          ? selectPreviewSprite(spritePreviews.get(characterId) ?? [], spriteExpressions[characterId] ?? null, [
              ...displayModes,
            ])
          : null;
        const background = gameBackgrounds.get(chat.id) ?? chatBackgroundMetadataToUrl(chat.background, 620);
        const style = { "--recent-chat-accent": mode.accent } as CSSProperties;

        return (
          <button
            key={chat.id}
            type="button"
            onClick={() => setActiveChatId(chat.id)}
            style={style}
            data-has-sprite={sprite ? "true" : "false"}
            data-sprite-layout={sprite?.layout}
            className={cn(
              "group relative min-h-0 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--recent-chat-accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--recent-chat-accent)_10%,var(--card))] p-2 text-left shadow-[0_16px_34px_-28px_color-mix(in_srgb,var(--recent-chat-accent)_60%,transparent)] transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--recent-chat-accent)_76%,var(--border))] hover:bg-[color-mix(in_srgb,var(--recent-chat-accent)_15%,var(--card))] hover:shadow-[0_19px_36px_-25px_color-mix(in_srgb,var(--recent-chat-accent)_72%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--recent-chat-accent)] motion-reduce:transform-none md:min-h-36 md:rounded-2xl md:p-3.5",
              index >= 3 && "hidden md:block",
            )}
          >
            {background ? (
              <img
                src={background}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full scale-[1.02] object-cover opacity-20 blur-[0.75px] saturate-[0.9] transition-opacity duration-300 group-hover:opacity-30"
                data-recent-chat-background
              />
            ) : null}
            <span
              className="absolute inset-0 bg-[color-mix(in_srgb,var(--card)_68%,transparent)]"
              data-recent-chat-veil
            />
            <span className="absolute inset-y-0 left-0 w-1 bg-[var(--recent-chat-accent)] shadow-[0_0_20px_color-mix(in_srgb,var(--recent-chat-accent)_72%,transparent)]" />

            {sprite ? (
              <img
                src={sprite.asset.url}
                alt=""
                loading="lazy"
                decoding="async"
                className={cn(
                  "absolute bottom-0 right-0 origin-bottom object-contain object-bottom object-center opacity-95 drop-shadow-[0_10px_18px_rgba(0,0,0,0.48)] transition-transform duration-300 ease-out group-hover:scale-[1.025] motion-reduce:transition-none",
                  sprite.layout === "full-body"
                    ? "h-[96%] w-[46%] px-1 pt-1"
                    : "h-[90%] w-[44%] pb-1 pr-1",
                )}
              />
            ) : character?.avatarUrl ? (
              <span className="absolute bottom-2 right-2 h-14 w-14 overflow-hidden rounded-full border-2 border-[var(--recent-chat-accent)]/60 bg-[var(--card)] shadow-lg shadow-black/30 md:bottom-3 md:right-3 md:h-20 md:w-20">
                <img
                  src={character.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  style={getAvatarCropStyle(character.avatarCrop)}
                  loading="lazy"
                />
              </span>
            ) : (
              <ChatModeIcon
                mode={chatMode}
                size="3rem"
                className="absolute -bottom-1 right-1 text-[var(--recent-chat-accent)] opacity-15 md:-bottom-2 md:[width:4.5rem] md:[height:4.5rem]"
                aria-hidden="true"
              />
            )}

            <span
              className={cn(
                "relative z-10 block min-w-0",
                sprite || character?.avatarUrl ? "pr-[25%] md:pr-[30%]" : "pr-2 md:pr-3",
              )}
            >
              <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--recent-chat-accent)_48%,transparent)] bg-[color-mix(in_srgb,var(--recent-chat-accent)_14%,var(--card))] px-1.5 py-0.5 text-[0.52rem] font-bold uppercase tracking-[0.1em] text-[var(--recent-chat-accent)] md:gap-1.5 md:px-2 md:py-1 md:text-[0.625rem] md:tracking-[0.12em]">
                <ChatModeIcon mode={chatMode} size="0.7rem" aria-hidden="true" /> {t(mode.labelKey)}
              </span>
              <span className="mt-1 block truncate text-xs font-semibold leading-tight text-[var(--foreground)] md:mt-2 md:line-clamp-2 md:whitespace-normal md:text-sm">
                {chat.name}
              </span>
              <span className="mt-0.5 line-clamp-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)] md:mt-1.5 md:line-clamp-3 md:text-xs md:leading-relaxed">
                {latestMessage
                  ? messagePreview(
                      latestMessage.role,
                      latestMessage.content,
                      t("home.recentChats.noPreview"),
                      t("home.recentChats.you"),
                    )
                  : t("home.recentChats.noPreview")}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
