import { useMemo, type CSSProperties } from "react";
import { MessageSquare } from "lucide-react";
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

function parseCharacterIds(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

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
    () => Array.from(new Set(recentChats.flatMap(({ chat }) => parseCharacterIds(chat.characterIds)))),
    [recentChats],
  );
  const summaries = useCharacterSummaries(characterIds);
  const spritePreviews = useCharacterSpritePreviews(characterIds);
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

  if (feed.isPending) {
    return (
      <div
        className="grid h-full auto-rows-fr gap-2.5 md:grid-cols-2 xl:grid-cols-3"
        role="status"
        aria-label={t("home.recentChats.loading")}
      >
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-2xl bg-[var(--muted)]/45" />
        ))}
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
    <div className="grid h-full auto-rows-fr gap-2.5 md:grid-cols-2 xl:grid-cols-3" data-component="RecentChats">
      {recentChats.map(({ chat, latestMessage }) => {
        const chatMode = chat.mode === "roleplay" || chat.mode === "game" ? chat.mode : "conversation";
        const mode = MODE_BADGE[chatMode];
        const chatCharacterIds = parseCharacterIds(chat.characterIds);
        const spriteCharacterIds = Array.isArray(chat.spriteCharacterIds) ? chat.spriteCharacterIds : [];
        const spriteDisplayModes = Array.isArray(chat.spriteDisplayModes) ? chat.spriteDisplayModes : [];
        const spriteExpressions = chat.spriteExpressions ?? {};
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
            className="group relative min-h-36 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--recent-chat-accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--recent-chat-accent)_10%,var(--card))] p-3.5 text-left shadow-[0_16px_34px_-28px_color-mix(in_srgb,var(--recent-chat-accent)_60%,transparent)] transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--recent-chat-accent)_76%,var(--border))] hover:bg-[color-mix(in_srgb,var(--recent-chat-accent)_15%,var(--card))] hover:shadow-[0_19px_36px_-25px_color-mix(in_srgb,var(--recent-chat-accent)_72%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--recent-chat-accent)] motion-reduce:transform-none"
          >
            {background ? (
              <img
                src={background}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover opacity-20 transition-opacity duration-300 group-hover:opacity-30"
              />
            ) : null}
            <span className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--card)_96%,transparent)_0%,color-mix(in_srgb,var(--card)_86%,transparent)_48%,color-mix(in_srgb,var(--recent-chat-accent)_18%,transparent)_100%)]" />
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
              <span className="absolute bottom-3 right-3 h-20 w-20 overflow-hidden rounded-full border-2 border-[var(--recent-chat-accent)]/60 bg-[var(--card)] shadow-lg shadow-black/30">
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
                size="4.5rem"
                className="absolute -bottom-2 right-1 text-[var(--recent-chat-accent)] opacity-15"
                aria-hidden="true"
              />
            )}

            <span className={cn("relative z-10 block min-w-0", sprite || character?.avatarUrl ? "pr-[30%]" : "pr-3")}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--recent-chat-accent)_48%,transparent)] bg-[color-mix(in_srgb,var(--recent-chat-accent)_14%,var(--card))] px-2 py-1 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[var(--recent-chat-accent)]">
                <ChatModeIcon mode={chatMode} size="0.7rem" aria-hidden="true" /> {t(mode.labelKey)}
              </span>
              <span className="mt-2 block line-clamp-2 text-sm font-semibold leading-tight text-[var(--foreground)]">
                {chat.name}
              </span>
              <span className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
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
