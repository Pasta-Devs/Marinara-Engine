/**
 * Row builders for the omnibar's searchable entity data. One function per
 * category, each pure given its raw rows, the lookup maps it needs, the label
 * bag and a translate function — no hooks, no store access, no mutations.
 *
 * `preview` stays a thunk: preview data is only built for the focused row, so
 * building it here for every entity would undo that.
 */
import type { Chat, Lorebook, Persona, PromptPreset } from "@marinara-engine/shared";
import type { AgentConfigRow } from "../hooks/use-agents";
import type {
  CommandCenterCategoryLabels,
  CommandCenterChatModeLabels,
} from "../components/command-center/command-center-visuals";
import { formatDate, readNamedRow, readString } from "./omnibar-row-readers";
import { buildCharacterPreviewModel } from "./character-preview";
import { parseCharacterDisplayData } from "./character-display";
import { buildLorebookPreviewModel } from "./lorebook-preview";
import { resolvePresetArtwork } from "./preset-artwork";
import { getAvatarCropStyle } from "./utils";

const LOREBOOK_CATEGORY_FALLBACKS: Record<Lorebook["category"], string> = {
  world: "World",
  character: "Character",
  npc: "NPC",
  spellbook: "Spellbook",
  uncategorized: "Uncategorized",
};

/** The `t` shape these builders need, without the i18next generic machinery. */
export type OmnibarTranslate = (key: string, fallback: string, options?: Record<string, unknown>) => string;

/** Minimal `{ id, name }` view of a connection row. */
export type OmnibarNamedRow = { id: string; name: string };

export type OmnibarChatRowsInput = {
  chats: readonly Chat[];
  characterById: ReadonlyMap<string, unknown>;
  connectionById: ReadonlyMap<string, OmnibarNamedRow>;
  personaById: ReadonlyMap<string, Persona>;
  chatModeLabels: CommandCenterChatModeLabels;
  t: OmnibarTranslate;
};

export function buildOmnibarChatRows({
  chats,
  characterById,
  connectionById,
  personaById,
  chatModeLabels,
  t,
}: OmnibarChatRowsInput) {
  return chats.map((chat) => {
    const linkedCharacters = (chat.characterIds ?? []).slice(0, 2).flatMap((id) => {
      const linked = characterById.get(id) as Record<string, unknown> | undefined;
      if (!linked) return [];
      const display = parseCharacterDisplayData({
        data: linked.data,
        comment: linked.comment as string | null | undefined,
      });
      return [{ display, avatarPath: readString(linked.avatarPath) }];
    });
    const linkedDisplay = linkedCharacters[0]?.display;
    const connection = chat.connectionId ? connectionById.get(chat.connectionId) : undefined;
    const persona = chat.personaId ? personaById.get(chat.personaId) : undefined;
    const updated = formatDate(chat.lastMessageAt ?? chat.updatedAt);
    return {
      id: chat.id,
      name: chat.name,
      mode: chat.mode,
      preview: () => ({
        kind: "chat" as const,
        title: chat.name,
        categoryLabel: chatModeLabels[chat.mode],
        subtitle: linkedCharacters.map((item) => item.display.name).join(", ") || undefined,
        media: linkedCharacters[0]?.avatarPath
          ? {
              src: linkedCharacters[0].avatarPath,
              alt: linkedDisplay?.name ?? chat.name,
              kind: "avatar" as const,
              avatarCropStyle: getAvatarCropStyle(linkedDisplay?.avatarCrop),
            }
          : undefined,
        facts: [
          {
            label: t("commandCenter.preview.lastUpdated", "Last updated"),
            value: updated ?? t("commandCenter.values.unknown", "Unknown"),
          },
          ...(connection
            ? [{ label: t("commandCenter.preview.connection", "Connection"), value: connection.name }]
            : []),
          ...(persona ? [{ label: t("commandCenter.preview.persona", "Persona"), value: persona.name }] : []),
          ...(chat.metadata?.tags?.length
            ? [{ label: t("commandCenter.preview.tags", "Tags"), value: chat.metadata.tags.join(", ") }]
            : []),
          ...(chat.metadata?.enableAgents !== undefined
            ? [
                {
                  label: t("commandCenter.preview.agents", "Agents"),
                  value: chat.metadata.enableAgents
                    ? t("commandCenter.values.enabled", "Enabled")
                    : t("commandCenter.values.disabled", "Disabled"),
                },
              ]
            : []),
        ],
      }),
    };
  });
}

export type OmnibarCharacterRowsInput = {
  characters: readonly unknown[];
  lorebookNamesByCharacter: ReadonlyMap<string, string[]>;
  categoryLabels: CommandCenterCategoryLabels;
  t: OmnibarTranslate;
};

export function buildOmnibarCharacterRows({
  characters,
  lorebookNamesByCharacter,
  categoryLabels,
  t,
}: OmnibarCharacterRowsInput) {
  return characters.flatMap((item) => {
    const row = readNamedRow(item);
    if (!row) return [];
    const character = buildCharacterPreviewModel(item, {
      lorebookCount: lorebookNamesByCharacter.get(row.id)?.length ?? 0,
    });
    if (!character) return [];
    return [
      {
        kind: "character" as const,
        ...row,
        name: character.name,
        description: character.summary ?? character.description,
        searchText: [
          character.summary,
          character.comment,
          character.description,
          character.creator,
          ...character.tags,
        ].filter((value): value is string => Boolean(value)),
        preview: () => ({
          kind: "character" as const,
          title: character.name,
          description: character.summary ?? character.description,
          categoryLabel: categoryLabels.character,
          media: character.avatarSrc
            ? {
                src: character.avatarSrc,
                alt: character.name,
                kind: "avatar" as const,
                avatarCropStyle: character.avatarCropStyle,
              }
            : undefined,
          metadataLine:
            [
              character.creator
                ? t("commandCenter.preview.byCreator", "by {{creator}}", { creator: character.creator })
                : null,
              character.version
                ? t("commandCenter.preview.versionShort", "v{{version}}", { version: character.version })
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
          facts: character.lorebookCount
            ? [{ label: t("commandCenter.preview.lorebooks", "Lorebooks"), value: character.lorebookCount }]
            : [],
          tags: character.tags.slice(0, 6).concat(
            character.tags.length > 6
              ? [
                  t("commandCenter.preview.moreTags", "+{{count}}", {
                    count: character.tags.length - 6,
                  }),
                ]
              : [],
          ),
        }),
      },
    ];
  });
}

export type OmnibarPersonaRowsInput = {
  personas: readonly Persona[];
  lorebookNamesByPersona: ReadonlyMap<string, string[]>;
  categoryLabels: CommandCenterCategoryLabels;
  t: OmnibarTranslate;
  /** Called when the row's toggle activates a persona. */
  onActivatePersona: (id: string) => void;
};

export function buildOmnibarPersonaRows({
  personas,
  lorebookNamesByPersona,
  categoryLabels,
  t,
  onActivatePersona,
}: OmnibarPersonaRowsInput) {
  return personas.map((item) => ({
    kind: "persona" as const,
    id: item.id,
    name: item.name,
    description: item.description,
    preview: () => ({
      kind: "persona" as const,
      title: item.name,
      description: item.description,
      categoryLabel: categoryLabels.persona,
      media: item.avatarPath
        ? {
            src: item.avatarPath,
            alt: item.name,
            kind: "avatar" as const,
            avatarCropStyle: getAvatarCropStyle(item.avatarCrop),
          }
        : undefined,
      facts: [
        ...(item.creator ? [{ label: t("commandCenter.preview.creator", "Creator"), value: item.creator }] : []),
        ...(item.personaVersion
          ? [{ label: t("commandCenter.preview.version", "Version"), value: item.personaVersion }]
          : []),
        ...(lorebookNamesByPersona.get(item.id)?.length
          ? [
              {
                label: t("commandCenter.preview.lorebooks", "Lorebooks"),
                value: lorebookNamesByPersona.get(item.id)!.join(", "),
              },
            ]
          : []),
        ...(item.comment ? [{ label: t("commandCenter.preview.note", "Note"), value: item.comment }] : []),
      ],
      badges: [
        ...(item.tags?.length
          ? [t("commandCenter.preview.tagsValue", "Tags: {{tags}}", { tags: item.tags.join(", ") })]
          : []),
        ...(item.isActive ? [t("commandCenter.values.active", "Active")] : []),
      ],
      accent: item.nameColor,
    }),
    control: {
      type: "toggle" as const,
      label: item.isActive
        ? t("commandCenter.actions.activePersona", "Active persona")
        : t("commandCenter.actions.activatePersona", "Activate persona"),
      value: item.isActive,
      onChange: (value: string | boolean) => value === true && !item.isActive && onActivatePersona(item.id),
    },
  }));
}

export type OmnibarLorebookRowsInput = {
  lorebooks: readonly Lorebook[];
  characterNameById: ReadonlyMap<string, string>;
  personaById: ReadonlyMap<string, Persona>;
  categoryLabels: CommandCenterCategoryLabels;
  t: OmnibarTranslate;
  /** Called when the row's toggle enables or disables a lorebook. */
  onSetLorebookEnabled: (id: string, enabled: boolean) => void;
};

export function buildOmnibarLorebookRows({
  lorebooks,
  characterNameById,
  personaById,
  categoryLabels,
  t,
  onSetLorebookEnabled,
}: OmnibarLorebookRowsInput) {
  return lorebooks.map((item) => {
    const linkedNames = [
      ...(item.characterIds ?? []).map((id) => characterNameById.get(id)),
      ...(item.personaIds ?? []).map((id) => personaById.get(id)?.name),
    ].filter((name): name is string => Boolean(name));
    const lorebook = buildLorebookPreviewModel(item, { linkedNames });
    return {
      kind: "lorebook" as const,
      id: item.id,
      name: item.name,
      description: lorebook.description,
      preview: () => ({
        kind: "lorebook" as const,
        title: lorebook.name,
        description: lorebook.description,
        categoryLabel: categoryLabels.lorebook,
        media: lorebook.imageSrc ? { src: lorebook.imageSrc, alt: lorebook.name, kind: "artwork" as const } : undefined,
        metadataLine:
          [
            typeof lorebook.entryCount === "number"
              ? t("commandCenter.preview.entryCountValue", "{{count}} entries", { count: lorebook.entryCount })
              : null,
            t(
              `commandCenter.values.lorebookCategory.${lorebook.category}`,
              LOREBOOK_CATEGORY_FALLBACKS[lorebook.category],
            ),
            lorebook.isGlobal ? t("commandCenter.values.global", "Global") : t("commandCenter.values.scoped", "Scoped"),
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
        status: {
          label: lorebook.enabled
            ? t("commandCenter.values.enabled", "Enabled")
            : t("commandCenter.values.disabled", "Disabled"),
          tone: lorebook.enabled ? ("success" as const) : ("neutral" as const),
        },
        supportingInfo: lorebook.linkedNames.length
          ? t("commandCenter.preview.linkedToValue", "Linked to {{names}}", {
              names: lorebook.linkedNames.slice(0, 3).join(", "),
            }) +
            (lorebook.linkedNames.length > 3
              ? t("commandCenter.preview.moreLinked", " +{{count}}", { count: lorebook.linkedNames.length - 3 })
              : "")
          : undefined,
        tags: lorebook.tags
          .slice(0, 6)
          .concat(
            lorebook.tags.length > 6
              ? [t("commandCenter.preview.moreTags", "+{{count}}", { count: lorebook.tags.length - 6 })]
              : [],
          ),
      }),
      control: {
        type: "toggle" as const,
        label: item.enabled
          ? t("commandCenter.actions.disableLorebook", "Disable lorebook")
          : t("commandCenter.actions.enableLorebook", "Enable lorebook"),
        value: item.enabled,
        onChange: (value: string | boolean) => onSetLorebookEnabled(item.id, value === true),
      },
    };
  });
}

export type OmnibarPresetRowsInput = {
  presets: readonly PromptPreset[];
  categoryLabels: CommandCenterCategoryLabels;
  t: OmnibarTranslate;
  /** Called when the row's toggle makes a preset the default. */
  onSetDefaultPreset: (id: string) => void;
};

export function buildOmnibarPresetRows({ presets, categoryLabels, t, onSetDefaultPreset }: OmnibarPresetRowsInput) {
  return presets.map((item) => {
    const artwork = resolvePresetArtwork(item);
    return {
      kind: "preset" as const,
      id: item.id,
      name: item.name,
      description: item.description,
      preview: () => ({
        kind: "preset" as const,
        title: item.name,
        description: item.description,
        categoryLabel: categoryLabels.preset,
        media: artwork ? { src: artwork, alt: item.name, kind: "artwork" as const } : undefined,
        status: item.isDefault
          ? { label: t("commandCenter.values.default", "Default"), tone: "success" as const }
          : undefined,
        facts: [
          { label: t("commandCenter.preview.author", "Author"), value: item.author },
          { label: t("commandCenter.preview.wrapFormat", "Wrap format"), value: item.wrapFormat },
          { label: t("commandCenter.preview.sections", "Sections"), value: item.sectionOrder.length },
          { label: t("commandCenter.preview.groups", "Groups"), value: item.groupOrder.length },
        ],
      }),
      control: {
        type: "toggle" as const,
        label: item.isDefault
          ? t("commandCenter.actions.defaultPreset", "Default preset")
          : t("commandCenter.actions.setDefaultPreset", "Set default preset"),
        value: item.isDefault,
        onChange: (value: string | boolean) => value === true && !item.isDefault && onSetDefaultPreset(item.id),
      },
    };
  });
}

export type OmnibarAgentRowsInput = {
  agents: readonly AgentConfigRow[];
  connectionById: ReadonlyMap<string, OmnibarNamedRow>;
  categoryLabels: CommandCenterCategoryLabels;
  t: OmnibarTranslate;
};

export function buildOmnibarAgentRows({ agents, connectionById, categoryLabels, t }: OmnibarAgentRowsInput) {
  return agents.map((item) => ({
    kind: "agent" as const,
    id: item.type,
    name: item.name,
    aliases: [item.type],
    description: item.description,
    preview: () => ({
      kind: "agent" as const,
      title: item.name,
      description: item.description,
      categoryLabel: categoryLabels.agent,
      media: item.imagePath ? { src: item.imagePath, alt: item.name, kind: "artwork" as const } : undefined,
      status: {
        label:
          item.enabled === "true"
            ? t("commandCenter.values.enabled", "Enabled")
            : t("commandCenter.values.disabled", "Disabled"),
        tone: item.enabled === "true" ? ("success" as const) : ("neutral" as const),
      },
      facts: [
        { label: t("commandCenter.preview.phase", "Phase"), value: item.phase },
        { label: t("commandCenter.preview.type", "Type"), value: item.type },
        ...(item.connectionId
          ? [
              {
                label: t("commandCenter.preview.connection", "Connection"),
                value: connectionById.get(item.connectionId)?.name ?? item.connectionId,
              },
            ]
          : []),
      ],
    }),
  }));
}

export type OmnibarConnectionRowsInput = {
  connections: readonly unknown[];
  categoryLabels: CommandCenterCategoryLabels;
  t: OmnibarTranslate;
};

export function buildOmnibarConnectionRows({ connections, categoryLabels, t }: OmnibarConnectionRowsInput) {
  return connections.flatMap((item) => {
    const row = readNamedRow(item);
    if (!row) return [];
    const record = item as Record<string, unknown>;
    const provider = typeof record.provider === "string" ? record.provider : undefined;
    const model = typeof record.model === "string" ? record.model : undefined;
    const imagePath = typeof record.imagePath === "string" ? record.imagePath : undefined;
    return [
      {
        ...row,
        provider,
        model,
        isDefault: record.isDefault === true,
        imagePath,
        preview: () => ({
          kind: "connection" as const,
          title: row.name,
          categoryLabel: categoryLabels.connection,
          subtitle: provider,
          media: imagePath ? { src: imagePath, alt: row.name, kind: "artwork" as const } : undefined,
          status:
            record.isDefault === true
              ? {
                  label: t("commandCenter.preview.defaultConnection", "Default connection"),
                  tone: "success" as const,
                }
              : undefined,
          facts: [
            ...(model ? [{ label: t("commandCenter.preview.model", "Model"), value: model }] : []),
            ...(provider ? [{ label: t("commandCenter.preview.provider", "Provider"), value: provider }] : []),
            ...(readString(record.context)
              ? [{ label: t("commandCenter.preview.context", "Context"), value: readString(record.context)! }]
              : []),
            ...(readString(record.maxContext)
              ? [
                  {
                    label: t("commandCenter.preview.maxContext", "Max context"),
                    value: readString(record.maxContext)!,
                  },
                ]
              : []),
          ],
        }),
      },
    ];
  });
}
