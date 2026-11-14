import { useCallback, useEffect, useState } from "react";
import { Image, MapPin, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  GALLERY_BACKGROUND_PIN_PREFIX,
  LOCATION_BACKGROUND_PIN_LIMIT,
  LOCATION_BACKGROUND_PIN_SHOWN_KEY,
  LOCATION_BACKGROUND_PINS_KEY,
  splitLocationBackgroundNames,
  type LocationBackgroundPin,
} from "@marinara-engine/shared";
import { useChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useChatOwnerBackgrounds, type OwnerBackground } from "../../hooks/use-chat-gallery-owners";
import { readLocationBackgroundPins, useLocationPinStatus } from "../../hooks/use-location-background-pins";
import { useSpatialContext } from "../../hooks/use-spatial-context";
import { chatUsesWorldMaps } from "../../hooks/use-scene-shelter";
import { chatBackgroundMetadataToUrl, chatBackgroundUrlToMetadata } from "../../lib/backgrounds";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { BackgroundPicker } from "../panels/settings/BackgroundPicker";
import { SETTINGS_BUTTON_CLASS } from "../panels/settings/SettingControls";

const FIELD_CLASS =
  "w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/60 focus:border-[var(--primary)]/50 max-sm:!text-base";

function newPinId(): string {
  try {
    return `pin_${crypto.randomUUID().slice(0, 12)}`;
  } catch {
    return `pin_${Math.random().toString(36).slice(2, 14)}`;
  }
}

/** "John's bedroom, Smith House" -> "John's bedroom": the most specific part names the pin. */
function firstPlacePart(location: string): string {
  return (location.split(/\s*[,;|>]\s*|\s+[-–—]\s+/u).find((part) => part.trim()) ?? location).trim().slice(0, 80);
}

/** One pinned place: its picture, the name the story uses, other wordings and an optional map place. */
function PinRow({
  pin,
  here,
  mapPlaces,
  onChange,
  onRemove,
}: {
  pin: LocationBackgroundPin;
  here: boolean;
  mapPlaces: Array<{ id: string; name: string }> | null;
  onChange: (next: LocationBackgroundPin) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const defaultBackground = useUIStore((state) => state.defaultRoleplayBackground);
  const onDefaultChange = useUIStore((state) => state.setDefaultRoleplayBackground);
  const [name, setName] = useState(pin.names[0] ?? "");
  const [aliases, setAliases] = useState(pin.names.slice(1).join(", "));
  useEffect(() => {
    setName(pin.names[0] ?? "");
    setAliases(pin.names.slice(1).join(", "));
  }, [pin.names]);

  const commitNames = () => {
    const names = splitLocationBackgroundNames([name, aliases].filter(Boolean).join(","));
    // The first name stays first even when it repeats an alias.
    const first = name.trim();
    const ordered = first ? [first, ...names.filter((entry) => entry !== first)] : names;
    if (ordered.join("\u0000") !== pin.names.join("\u0000")) onChange({ ...pin, names: ordered });
  };
  const url = chatBackgroundMetadataToUrl(pin.background, 160);
  const label = pin.names[0] || t("chat.settings.locationPins.unnamed");

  return (
    <div
      data-location-pin={pin.id}
      data-location-pin-here={here ? "true" : "false"}
      // Flat like the rest of Chat settings: rows split by a hairline, no card.
      className="flex items-start gap-2 border-b border-[var(--border)]/60 pb-2 last-of-type:border-b-0"
    >
      <BackgroundPicker
        chatFloatingPanel
        showRoleplayDefault={false}
        selected={chatBackgroundMetadataToUrl(pin.background)}
        onSelect={(next) => onChange({ ...pin, background: chatBackgroundUrlToMetadata(next) ?? "" })}
        defaultRoleplayBackground={defaultBackground}
        onDefaultChange={onDefaultChange}
        trigger={(openLibrary) => (
          // ov- class: Chat settings restyles plain rounded buttons as chips; this one is a picture.
          <button
            type="button"
            onClick={openLibrary}
            title={t("chat.settings.locationPins.choosePicture", { place: label })}
            aria-label={t("chat.settings.locationPins.choosePicture", { place: label })}
            className={cn(
              "ov-location-pin-thumb relative block w-16 shrink-0 overflow-hidden max-sm:w-14 rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 transition-shadow hover:ring-[var(--primary)]/50",
              here ? "ring-2 ring-[var(--primary)]" : "ring-[var(--border)]",
            )}
          >
            {url ? (
              // The picture sets the height (5:4), since phones let Chat settings buttons grow to fit.
              <img
                src={url}
                alt=""
                className="block aspect-[5/4] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="flex aspect-[5/4] w-full items-center justify-center">
                <Image size="1rem" aria-hidden />
              </span>
            )}
            {here && (
              <span
                className="absolute inset-x-0 bottom-0 bg-[var(--primary)] py-px text-center text-[0.5625rem] font-semibold uppercase tracking-wide text-[var(--primary-foreground)]"
                title={t("chat.settings.locationPins.hereHint")}
              >
                {t("chat.settings.locationPins.here")}
              </span>
            )}
          </button>
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitNames}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          placeholder={t("chat.settings.locationPins.namePlaceholder")}
          aria-label={t("chat.settings.locationPins.name")}
          className={cn(FIELD_CLASS, "font-medium")}
        />
        <input
          type="text"
          value={aliases}
          onChange={(event) => setAliases(event.target.value)}
          onBlur={commitNames}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          placeholder={t("chat.settings.locationPins.aliasesPlaceholder")}
          aria-label={t("chat.settings.locationPins.aliases")}
          className={cn(FIELD_CLASS, "text-[0.6875rem]")}
        />
        {mapPlaces && mapPlaces.length > 0 && (
          <select
            value={pin.placeId ?? ""}
            onChange={(event) => onChange({ ...pin, placeId: event.target.value || null })}
            aria-label={t("chat.settings.locationPins.mapPlace")}
            className={cn(FIELD_CLASS, "text-[0.6875rem]")}
          >
            <option value="">{t("chat.settings.locationPins.noMapPlace")}</option>
            {mapPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="shrink-0">
        <button
          type="button"
          onClick={onRemove}
          title={t("chat.settings.locationPins.remove", { place: label })}
          aria-label={t("chat.settings.locationPins.remove", { place: label })}
          className="ov-location-pin-remove flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] max-sm:h-10 max-sm:w-10"
        >
          <X size="0.875rem" />
        </button>
      </div>
    </div>
  );
}

/** A background from a character's or persona's gallery: a pin that follows them into every chat. */
function GalleryPinRow({ background, here }: { background: OwnerBackground; here: boolean }) {
  const { t } = useTranslation();
  const placesText = background.title;
  return (
    <div
      data-location-pin={`${GALLERY_BACKGROUND_PIN_PREFIX}${background.imageId}`}
      data-location-pin-here={here ? "true" : "false"}
      className="flex items-center gap-2 border-b border-[var(--border)]/60 pb-2 last-of-type:border-b-0"
    >
      <span
        className={cn(
          "relative block w-16 shrink-0 overflow-hidden rounded-md bg-[var(--secondary)] ring-1 max-sm:w-14",
          here ? "ring-2 ring-[var(--primary)]" : "ring-[var(--border)]",
        )}
      >
        <img
          src={background.url}
          alt=""
          className="block aspect-[5/4] w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {here && (
          <span
            className="absolute inset-x-0 bottom-0 bg-[var(--primary)] py-px text-center text-[0.5625rem] font-semibold uppercase tracking-wide text-[var(--primary-foreground)]"
            title={t("chat.settings.locationPins.hereHint")}
          >
            {t("chat.settings.locationPins.here")}
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-[var(--foreground)]" title={placesText}>
          {placesText}
        </span>
        <span className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
          {t("chat.settings.locationPins.fromGallery", { name: background.owner.name })}
        </span>
      </div>
    </div>
  );
}

/** Chat settings > Background: pictures pinned to story places (Roleplay). */
export function LocationBackgroundPins({ chatId, metadata }: { chatId: string; metadata: unknown }) {
  const { t } = useTranslation();
  const updateMeta = useUpdateChatMetadata();
  const pins = readLocationBackgroundPins(metadata);
  const status = useLocationPinStatus();
  const { data: chat } = useChat(chatId);
  // Gallery backgrounds that name places follow their character or persona into every chat.
  const galleryPlaces = useChatOwnerBackgrounds(chat).filter((background) => background.places);
  const chatBackground = useUIStore((state) => state.chatBackground);
  const mapsActive = chatUsesWorldMaps(metadata);
  const spatial = useSpatialContext(chatId, mapsActive);
  const mapPlaces = mapsActive
    ? (spatial.data?.definition?.locations ?? [])
        .filter((place) => place.status !== "archived")
        .map((place) => ({ id: place.id, name: place.name }))
    : null;

  const ownStatus = status.chatId === chatId;
  const hereText = ownStatus ? status.location || status.place?.name || "" : "";
  const herePinId = ownStatus ? (status.match?.pin.id ?? null) : null;
  const currentBackground = chatBackgroundUrlToMetadata(chatBackground);

  const save = useCallback(
    (next: LocationBackgroundPin[], extra: Record<string, unknown> = {}) =>
      updateMeta.mutate({ id: chatId, [LOCATION_BACKGROUND_PINS_KEY]: next, ...extra }),
    [chatId, updateMeta],
  );

  const addEmpty = () => save([...pins, { id: newPinId(), names: [], placeId: null, background: "" }]);
  const pinHere = () => {
    if (!currentBackground || !hereText) return;
    const id = newPinId();
    const name = status.location ? firstPlacePart(status.location) : (status.place?.name ?? "");
    // Already showing, so remember it as shown: the follower won't flip anything.
    save(
      [...pins, { id, names: name ? [name] : [], placeId: status.place?.id ?? null, background: currentBackground }],
      {
        [LOCATION_BACKGROUND_PIN_SHOWN_KEY]: id,
      },
    );
  };
  const atLimit = pins.length >= LOCATION_BACKGROUND_PIN_LIMIT;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3" data-location-pins>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--muted-foreground)]">
          {t("chat.settings.locationPins.title")}
        </span>
        {pins.length > 0 && (
          <span className="text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">{pins.length}</span>
        )}
      </div>
      <p className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {t("chat.settings.locationPins.help", { user: "{{user}}" })}
      </p>
      {pins.map((pin) => (
        <PinRow
          key={pin.id}
          pin={pin}
          here={pin.id === herePinId}
          mapPlaces={mapPlaces}
          onChange={(next) => save(pins.map((entry) => (entry.id === pin.id ? next : entry)))}
          onRemove={() => save(pins.filter((entry) => entry.id !== pin.id))}
        />
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={addEmpty} disabled={atLimit} className={SETTINGS_BUTTON_CLASS}>
          <Plus size="0.75rem" aria-hidden />
          {t("chat.settings.locationPins.add")}
        </button>
        {hereText && !herePinId && currentBackground && !atLimit && (
          <button
            type="button"
            onClick={pinHere}
            className={cn(SETTINGS_BUTTON_CLASS, "min-w-0 max-w-full")}
            title={t("chat.settings.locationPins.pinHereHint")}
          >
            <MapPin size="0.75rem" aria-hidden className="shrink-0" />
            <span className="truncate">
              {t("chat.settings.locationPins.pinHere", {
                place: status.location ? firstPlacePart(status.location) : (status.place?.name ?? ""),
              })}
            </span>
          </button>
        )}
      </div>
      {galleryPlaces.length > 0 && (
        <>
          <span className="pt-1 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("chat.settings.locationPins.galleryTitle")}
          </span>
          {galleryPlaces.map((background) => (
            <GalleryPinRow
              key={`${background.owner.type}:${background.owner.id}:${background.imageId}`}
              background={background}
              here={herePinId === `${GALLERY_BACKGROUND_PIN_PREFIX}${background.imageId}`}
            />
          ))}
        </>
      )}
      {hereText && (
        <p className="truncate text-[0.625rem] text-[var(--muted-foreground)]" title={hereText}>
          {t("chat.settings.locationPins.now", { place: hereText })}
        </p>
      )}
    </div>
  );
}
