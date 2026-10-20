// ──────────────────────────────────────────────
// Avatar setup on each avatar agent's Agent editor page (lane: base)
// ──────────────────────────────────────────────
// Pick a character or persona, turn its avatar on or off, choose the kind chats show and the lip sync,
// blink and idle-motion switches, and preview it. Below that, AVATAR_KIND_SETUP_PANELS for the focused kind
// (AVATAR_KIND_AGENT) import, remove and map faces, and on the 2D page AVATAR_GENERATION_PANEL makes one
// from a sprite. Not in Sprite Cards.
import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AVATAR_2D_AGENT_ID,
  AVATAR_3D_AGENT_ID,
  AVATAR_AGENT_IDS,
  AVATAR_KINDS,
  type AvatarAgentId,
  type AvatarConfigUpdate,
  type AvatarFeatureFlags,
  type AvatarKind,
  type AvatarOwnerRef,
  type AvatarOwnerType,
} from "@marinara-engine/shared";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { useAvatarModel, useAvatarModelActions, useAvatarModelList } from "../../../hooks/use-avatar-models";
import { useCharacterSprites, useCharacters, usePersonas } from "../../../hooks/use-characters";
import { parseCharacterDisplayData } from "../../../lib/character-display";
import { cn } from "../../../lib/utils";
import { AVATAR_GENERATION_PANEL, AVATAR_KIND_SETUP_PANELS, type AvatarAgentSetupProps } from "../contract";
import { AvatarModelStatus } from "../director/AvatarModelStatus";
import { buildPngtuberLayersFromSprites } from "../renderers/pngtuber/pngtuber-layers";
import { pickAvatarKind, withSpriteAvatar } from "../stage/avatar-stage-logic";
import { avatarAgentKinds } from "./avatar-setup-logic";
import { AvatarSetupPreview } from "./AvatarSetupPreview";

const KIND_LABEL_KEYS: Record<AvatarKind, { name: string; help: string }> = {
  pngtuber: { name: "avatars.setup.kind.pngtuber", help: "avatars.setup.kind.pngtuberHelp" },
  "mesh-avatar": { name: "avatars.setup.kind.meshAvatar", help: "avatars.setup.kind.meshAvatarHelp" },
  vrm: { name: "avatars.setup.kind.vrm", help: "avatars.setup.kind.vrmHelp" },
};

const FEATURE_KEYS: ReadonlyArray<readonly [keyof AvatarFeatureFlags, string, string]> = [
  ["lipSync", "avatars.setup.features.lipSync", "avatars.setup.features.lipSyncHelp"],
  ["blink", "avatars.setup.features.blink", "avatars.setup.features.blinkHelp"],
  ["idleMotion", "avatars.setup.features.idleMotion", "avatars.setup.features.idleMotionHelp"],
];

const SELECT_CLASS =
  "w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
const CARD_CLASS = "rounded-xl bg-[var(--secondary)]/55 ring-1 ring-[var(--border)]";

function ownerValue(owner: AvatarOwnerRef): string {
  return `${owner.ownerType}:${owner.ownerId}`;
}

function parseOwnerValue(value: string): AvatarOwnerRef | null {
  const separator = value.indexOf(":");
  if (separator < 0) return null;
  const ownerType = value.slice(0, separator) as AvatarOwnerType;
  const ownerId = value.slice(separator + 1);
  return (ownerType === "character" || ownerType === "persona") && ownerId ? { ownerType, ownerId } : null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AvatarAgentSetup({ agentId }: AvatarAgentSetupProps) {
  const { t } = useTranslation();
  const kinds = useMemo(() => avatarAgentKinds(agentId), [agentId]);
  const { data: rawCharacters = [] } = useCharacters();
  const { data: personas = [] } = usePersonas();
  const { data: summaries } = useAvatarModelList();
  const [selectedOwner, setSelectedOwner] = useState("");
  const owner = useMemo(() => parseOwnerValue(selectedOwner), [selectedOwner]);

  const owners = useMemo(() => {
    const avatarOwners = new Set(
      (summaries ?? [])
        .filter((summary) => summary.kinds.some((kind) => kinds.includes(kind)))
        .map((summary) => ownerValue(summary.owner)),
    );
    const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name);
    const characters = rawCharacters
      .filter((row): row is { id: string; data: unknown } => typeof row.id === "string" && "data" in row)
      .map((row) => ({ value: `character:${row.id}`, name: parseCharacterDisplayData(row).name || row.id }))
      .sort(byName);
    const personaOptions = personas
      .map((persona) => ({ value: `persona:${persona.id}`, name: persona.name }))
      .sort(byName);
    return { characters, personas: personaOptions, avatarOwners };
  }, [kinds, personas, rawCharacters, summaries]);

  // Start on someone who already has an avatar for this agent, when there is one.
  useEffect(() => {
    if (selectedOwner || owners.avatarOwners.size === 0) return;
    const first = [...owners.characters, ...owners.personas].find((option) => owners.avatarOwners.has(option.value));
    if (first) setSelectedOwner(first.value);
  }, [owners, selectedOwner]);

  return (
    <div
      className="space-y-4"
      data-avatar-setup={agentId}
      onDragOver={(event) => {
        // File names may be hidden until drop; allow a file to reach the project hint below.
        if (agentId === AVATAR_3D_AGENT_ID && event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (
          agentId !== AVATAR_3D_AGENT_ID ||
          !Array.from(event.dataTransfer.files).some((file) => /\.vroid$/iu.test(file.name))
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        toast.error(t("avatars.vrm.vroidProject"));
      }}
    >
      <AvatarModelStatus />
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-[var(--foreground)]">{t("avatars.setup.owner.label")}</span>
        <select
          value={selectedOwner}
          onChange={(event) => setSelectedOwner(event.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">{t("avatars.setup.owner.placeholder")}</option>
          {(
            [
              ["avatars.setup.owner.characters", owners.characters],
              ["avatars.setup.owner.personas", owners.personas],
            ] as const
          ).map(([groupKey, options]) =>
            options.length > 0 ? (
              <optgroup key={groupKey} label={t(groupKey)}>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {owners.avatarOwners.has(option.value)
                      ? t("avatars.setup.owner.hasAvatar", { name: option.name })
                      : option.name}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
      </label>
      {owner ? (
        <OwnerAvatarSetup key={selectedOwner} agentId={agentId} kinds={kinds} owner={owner} />
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">{t("avatars.setup.owner.empty")}</p>
      )}
    </div>
  );
}

/** One character's or persona's setup; remounted per owner, so its focus and messages reset. The kind panels
 *  below it own importing, removing and the faces; this part holds what applies to every kind. */
function OwnerAvatarSetup({
  agentId,
  kinds,
  owner,
}: {
  agentId: AvatarAgentId;
  kinds: readonly AvatarKind[];
  owner: AvatarOwnerRef;
}) {
  const { t } = useTranslation();
  const { data: config = null, isLoading: configLoading } = useAvatarModel(owner);
  const spritesQuery = useCharacterSprites(owner.ownerId);
  const sprites = spritesQuery.data ?? (spritesQuery.isLoading ? null : []);
  const { save: update } = useAvatarModelActions(owner);
  const [chosenKind, setChosenKind] = useState<AvatarKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On the 2D page, expression sprites are a PNGTuber avatar until one is saved, as they are in chats.
  const spriteList = spritesQuery.data;
  const fromSprites = useMemo(
    () => (kinds.includes("pngtuber") && spriteList ? buildPngtuberLayersFromSprites(spriteList) : null),
    [kinds, spriteList],
  );
  const avatar = useMemo(() => withSpriteAvatar(owner, config, fromSprites), [config, fromSprites, owner]);
  // The kind chats show when every avatar agent is on.
  const shownKind = avatar
    ? pickAvatarKind(
        { activeKind: avatar.activeKind, kinds: AVATAR_KINDS.filter((kind) => avatar.kinds[kind]) },
        AVATAR_AGENT_IDS,
      )
    : null;
  const focusedKind =
    chosenKind ??
    (shownKind && kinds.includes(shownKind) ? shownKind : null) ??
    kinds.find((kind) => avatar?.kinds[kind]) ??
    kinds[0]!;

  const save = async (change: AvatarConfigUpdate) => {
    setError(null);
    try {
      await update.mutateAsync(change);
    } catch (saveError) {
      setError(errorMessage(saveError, t("avatars.setup.saveFailed")));
    }
  };

  if (configLoading) {
    return (
      <Loader2
        size="1rem"
        className="animate-spin text-[var(--muted-foreground)]"
        aria-label={t("avatars.setup.loading")}
      />
    );
  }

  const busy = update.isPending;
  const focusedData = avatar?.kinds[focusedKind];
  const KindPanel = AVATAR_KIND_SETUP_PANELS[focusedKind];
  const GenerationPanel = AVATAR_GENERATION_PANEL;
  const onChanged = () => setError(null);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="min-w-0 space-y-4">
        {avatar ? (
          <SettingsSwitch
            label={t("avatars.setup.enabled.label")}
            description={t("avatars.setup.enabled.description")}
            checked={avatar.enabled}
            disabled={busy}
            onChange={(enabled) => void save({ enabled })}
            labelPosition="start"
            className={cn("w-full justify-between p-3", CARD_CLASS)}
          />
        ) : null}

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-xs font-semibold text-[var(--foreground)]">
            {t("avatars.setup.kind.label")}
          </legend>
          {kinds.map((kind) => (
            <label
              key={kind}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-xl p-3 ring-1 transition-colors",
                focusedKind === kind
                  ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                  : "bg-[var(--secondary)]/55 ring-[var(--border)] hover:bg-[var(--accent)]",
              )}
            >
              <input
                type="radio"
                name={`avatar-kind-${agentId}`}
                value={kind}
                checked={focusedKind === kind}
                onChange={() => setChosenKind(kind)}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[var(--foreground)]">
                  {t(KIND_LABEL_KEYS[kind].name)}
                </span>
                <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                  {t(KIND_LABEL_KEYS[kind].help)}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                {shownKind === kind
                  ? t("avatars.setup.kind.shown")
                  : avatar?.kinds[kind]
                    ? t("avatars.setup.kind.setUp")
                    : t("avatars.setup.kind.notSetUp")}
              </span>
            </label>
          ))}
        </fieldset>

        {focusedData && shownKind !== focusedKind ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              // A sprite avatar is saved as it shows, so the kind chats switch to is set up.
              onClick={() =>
                void save({
                  activeKind: focusedKind,
                  ...(config?.kinds[focusedKind] ? {} : { kinds: { [focusedKind]: focusedData } }),
                })
              }
              className="mari-editor-action mari-editor-action--compact px-3"
            >
              {t("avatars.setup.kind.makeActive")}
            </button>
            {busy ? <Loader2 size="1rem" className="animate-spin text-[var(--muted-foreground)]" /> : null}
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[var(--marinara-app-accent-static)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)]"
          >
            <AlertTriangle size="0.875rem" className="mt-px shrink-0 text-[var(--marinara-app-accent-static)]" />
            <span className="min-w-0">{error}</span>
          </p>
        ) : null}

        {avatar ? (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-[var(--foreground)]">{t("avatars.setup.features.title")}</h4>
            {FEATURE_KEYS.map(([key, label, description]) => (
              <SettingsSwitch
                key={key}
                label={t(label)}
                description={t(description)}
                checked={avatar.features[key]}
                disabled={busy}
                onChange={(value) => void save({ features: { [key]: value } })}
                labelPosition="start"
                className={cn("w-full justify-between p-3", CARD_CLASS)}
              />
            ))}
          </section>
        ) : null}

        <Suspense fallback={<Loader2 size="1rem" className="animate-spin text-[var(--muted-foreground)]" />}>
          <KindPanel owner={owner} config={config} onChanged={onChanged} />
          {agentId === AVATAR_2D_AGENT_ID ? (
            <GenerationPanel owner={owner} config={config} onChanged={onChanged} />
          ) : null}
        </Suspense>
      </div>

      <div className="order-first md:order-none">
        <p className="mb-1.5 text-xs font-semibold text-[var(--foreground)]">{t("avatars.setup.preview.title")}</p>
        <AvatarSetupPreview owner={owner} config={avatar} kind={focusedKind} sprites={sprites} />
      </div>
    </div>
  );
}
