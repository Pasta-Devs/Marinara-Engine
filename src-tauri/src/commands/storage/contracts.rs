#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum TypedJsonKind {
    JsonArray,
    NullableJsonArray,
    JsonObject,
    NullableJsonObject,
    Boolish,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct TypedJsonField {
    pub(crate) name: &'static str,
    pub(crate) kind: TypedJsonKind,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum DeleteCleanup {
    ActivateDefaultChatPreset,
    ClearConnectionFolder,
    ClearLorebookReferences,
    DeleteCharacterGallery,
    DeleteLorebookChildren,
    DeleteMessageTrackerSnapshots,
    DeletePromptChildren,
    RemoveOwnedMedia,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct StorageCollectionContract {
    pub(crate) name: &'static str,
    pub(crate) profile: bool,
    pub(crate) startup_json_repair: bool,
    pub(crate) create_default_fields: &'static [&'static str],
    pub(crate) typed_json_fields: &'static [TypedJsonField],
    pub(crate) delete_cleanup: &'static [DeleteCleanup],
}

const EMPTY_FIELDS: &[TypedJsonField] = &[];
const EMPTY_DEFAULTS: &[&str] = &[];
const EMPTY_CLEANUP: &[DeleteCleanup] = &[];

const CHAT_FIELDS: &[TypedJsonField] = &[
    array("characterIds"),
    array("activeLorebookIds"),
    array("activeAgentIds"),
    array("activeToolIds"),
    array("memories"),
    array("notes"),
    nullable_object("metadata"),
    nullable_object("gameState"),
];
const MESSAGE_FIELDS: &[TypedJsonField] = &[
    array("swipes"),
    array("images"),
    array("attachments"),
    nullable_object("extra"),
];
const CHARACTER_GROUP_FIELDS: &[TypedJsonField] = &[array("characterIds")];
const PERSONA_GROUP_FIELDS: &[TypedJsonField] = &[array("personaIds")];
const LOREBOOK_FIELDS: &[TypedJsonField] =
    &[array("tags"), array("characterIds"), array("personaIds")];
const LOREBOOK_ENTRY_FIELDS: &[TypedJsonField] = &[
    array("keys"),
    array("secondaryKeys"),
    array("characterFilterIds"),
    array("characterTagFilters"),
    array("generationTriggerFilters"),
    array("additionalMatchingSources"),
    array("activationConditions"),
    boolish("enabled"),
    boolish("constant"),
    boolish("selective"),
    boolish("matchWholeWords"),
    boolish("caseSensitive"),
    boolish("useRegex"),
    boolish("preventRecursion"),
    boolish("locked"),
    boolish("excludeFromVectorization"),
    nullable_object("relationships"),
    nullable_object("dynamicState"),
    nullable_object("schedule"),
];
const CONNECTION_FIELDS: &[TypedJsonField] = &[
    nullable_object("defaultParameters"),
    nullable_object("capabilities"),
    nullable_object("providerMetadata"),
    boolish("isDefault"),
    boolish("default"),
    boolish("useForRandom"),
    boolish("defaultForAgents"),
];
const CUSTOM_TOOL_FIELDS: &[TypedJsonField] = &[object("parametersSchema")];
const GAME_STATE_SNAPSHOT_FIELDS: &[TypedJsonField] = &[
    array("presentCharacters"),
    array("recentEvents"),
    nullable_object("playerStats"),
    nullable_object("metadata"),
    nullable_array("personaStats"),
];
const GAME_CHECKPOINT_FIELDS: &[TypedJsonField] =
    &[nullable_object("snapshot"), nullable_object("metadata")];
const CHAT_PRESET_FIELDS: &[TypedJsonField] = &[
    object("parameters"),
    object("settings"),
    boolish("isDefault"),
    boolish("default"),
    boolish("isActive"),
    boolish("active"),
];
const PROMPT_FIELDS: &[TypedJsonField] = &[
    array("sectionOrder"),
    array("groupOrder"),
    array("variableOrder"),
    object("variableValues"),
    object("parameters"),
    object("defaultChoices"),
    array("variableGroups"),
];
const PROMPT_SECTION_FIELDS: &[TypedJsonField] = &[nullable_object("markerConfig")];
const PROMPT_VARIABLE_FIELDS: &[TypedJsonField] = &[array("options")];
const PERSONA_FIELDS: &[TypedJsonField] = &[
    array("tags"),
    array("altDescriptions"),
    array("savedStatusOptions"),
    nullable_object("avatarCrop"),
    nullable_object("personaStats"),
];
const AGENT_FIELDS: &[TypedJsonField] = &[object("settings")];
const REGEX_SCRIPT_FIELDS: &[TypedJsonField] = &[array("placement"), array("trimStrings")];

const CHAT_DEFAULTS: &[&str] = &["metadata", "gameState", "characterIds"];
const CONNECTION_DEFAULTS: &[&str] = &["enabled"];
const CONNECTION_FOLDER_DEFAULTS: &[&str] = &["color", "collapsed", "sortOrder", "order"];
const CHARACTER_DEFAULTS: &[&str] = &["data", "comment", "avatarPath"];
const LOREBOOK_DEFAULTS: &[&str] = &[
    "description",
    "category",
    "imagePath",
    "scanDepth",
    "tokenBudget",
    "recursiveScanning",
    "maxRecursionDepth",
    "characterId",
    "characterIds",
    "personaId",
    "personaIds",
    "chatId",
    "isGlobal",
    "enabled",
    "excludeFromVectorization",
    "tags",
    "generatedBy",
    "sourceAgentId",
];
const PERSONA_DEFAULTS: &[&str] = &[
    "description",
    "comment",
    "personality",
    "scenario",
    "backstory",
    "appearance",
    "avatarPath",
    "isActive",
    "tags",
    "altDescriptions",
    "avatarCrop",
];
const PROMPT_DEFAULTS: &[&str] = &[
    "description",
    "sectionOrder",
    "groupOrder",
    "variableGroups",
    "variableValues",
    "parameters",
    "defaultChoices",
    "isDefault",
];
const CHAT_PRESET_DEFAULTS: &[&str] = &["settings", "isDefault", "default", "isActive", "active"];
const AGENT_DEFAULTS: &[&str] = &["enabled", "credit"];

const LOREBOOK_CLEANUP: &[DeleteCleanup] = &[
    DeleteCleanup::DeleteLorebookChildren,
    DeleteCleanup::ClearLorebookReferences,
    DeleteCleanup::RemoveOwnedMedia,
];
const PROMPT_CLEANUP: &[DeleteCleanup] = &[DeleteCleanup::DeletePromptChildren];
const CHAT_PRESET_CLEANUP: &[DeleteCleanup] = &[DeleteCleanup::ActivateDefaultChatPreset];
const CONNECTION_FOLDER_CLEANUP: &[DeleteCleanup] = &[DeleteCleanup::ClearConnectionFolder];
const CHARACTER_CLEANUP: &[DeleteCleanup] = &[
    DeleteCleanup::RemoveOwnedMedia,
    DeleteCleanup::DeleteCharacterGallery,
];
const MEDIA_CLEANUP: &[DeleteCleanup] = &[DeleteCleanup::RemoveOwnedMedia];
const MESSAGE_CLEANUP: &[DeleteCleanup] = &[DeleteCleanup::DeleteMessageTrackerSnapshots];

pub(crate) const COLLECTIONS: &[StorageCollectionContract] = &[
    contract(
        "characters",
        true,
        true,
        CHARACTER_DEFAULTS,
        EMPTY_FIELDS,
        CHARACTER_CLEANUP,
    ),
    contract(
        "character-groups",
        true,
        true,
        EMPTY_DEFAULTS,
        CHARACTER_GROUP_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "character-versions",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "personas",
        true,
        true,
        PERSONA_DEFAULTS,
        PERSONA_FIELDS,
        MEDIA_CLEANUP,
    ),
    contract(
        "persona-groups",
        true,
        true,
        EMPTY_DEFAULTS,
        PERSONA_GROUP_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "lorebooks",
        true,
        true,
        LOREBOOK_DEFAULTS,
        LOREBOOK_FIELDS,
        LOREBOOK_CLEANUP,
    ),
    contract(
        "lorebook-entries",
        true,
        true,
        EMPTY_DEFAULTS,
        LOREBOOK_ENTRY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "lorebook-folders",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "prompts",
        true,
        true,
        PROMPT_DEFAULTS,
        PROMPT_FIELDS,
        PROMPT_CLEANUP,
    ),
    contract(
        "prompt-groups",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "prompt-sections",
        true,
        true,
        EMPTY_DEFAULTS,
        PROMPT_SECTION_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "prompt-variables",
        true,
        true,
        EMPTY_DEFAULTS,
        PROMPT_VARIABLE_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "prompt-overrides",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "chat-presets",
        true,
        true,
        CHAT_PRESET_DEFAULTS,
        CHAT_PRESET_FIELDS,
        CHAT_PRESET_CLEANUP,
    ),
    contract(
        "agents",
        true,
        true,
        AGENT_DEFAULTS,
        AGENT_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "agent-runs",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "agent-memory",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "themes",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "extensions",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "connections",
        true,
        true,
        CONNECTION_DEFAULTS,
        CONNECTION_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "connection-folders",
        true,
        false,
        CONNECTION_FOLDER_DEFAULTS,
        EMPTY_FIELDS,
        CONNECTION_FOLDER_CLEANUP,
    ),
    contract(
        "chats",
        true,
        true,
        CHAT_DEFAULTS,
        CHAT_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "chat-folders",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "messages",
        true,
        true,
        EMPTY_DEFAULTS,
        MESSAGE_FIELDS,
        MESSAGE_CLEANUP,
    ),
    contract(
        "custom-tools",
        true,
        true,
        EMPTY_DEFAULTS,
        CUSTOM_TOOL_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "regex-scripts",
        true,
        true,
        EMPTY_DEFAULTS,
        REGEX_SCRIPT_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "app-settings",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "gallery",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        MEDIA_CLEANUP,
    ),
    contract(
        "character-gallery",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        MEDIA_CLEANUP,
    ),
    contract(
        "background-metadata",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "sprites",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "knowledge-sources",
        true,
        false,
        EMPTY_DEFAULTS,
        EMPTY_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "game-state-snapshots",
        true,
        true,
        EMPTY_DEFAULTS,
        GAME_STATE_SNAPSHOT_FIELDS,
        EMPTY_CLEANUP,
    ),
    contract(
        "game-checkpoints",
        true,
        true,
        EMPTY_DEFAULTS,
        GAME_CHECKPOINT_FIELDS,
        EMPTY_CLEANUP,
    ),
];

pub(crate) fn collection_contract(collection: &str) -> Option<&'static StorageCollectionContract> {
    COLLECTIONS
        .iter()
        .find(|contract| contract.name == collection)
}

pub(crate) fn profile_collections() -> impl Iterator<Item = &'static str> {
    COLLECTIONS
        .iter()
        .filter(|contract| contract.profile)
        .map(|contract| contract.name)
}

pub(crate) fn startup_json_repair_collections() -> impl Iterator<Item = &'static str> {
    COLLECTIONS
        .iter()
        .filter(|contract| contract.startup_json_repair)
        .map(|contract| contract.name)
}

const fn contract(
    name: &'static str,
    profile: bool,
    startup_json_repair: bool,
    create_default_fields: &'static [&'static str],
    typed_json_fields: &'static [TypedJsonField],
    delete_cleanup: &'static [DeleteCleanup],
) -> StorageCollectionContract {
    StorageCollectionContract {
        name,
        profile,
        startup_json_repair,
        create_default_fields,
        typed_json_fields,
        delete_cleanup,
    }
}

const fn array(name: &'static str) -> TypedJsonField {
    TypedJsonField {
        name,
        kind: TypedJsonKind::JsonArray,
    }
}

const fn nullable_array(name: &'static str) -> TypedJsonField {
    TypedJsonField {
        name,
        kind: TypedJsonKind::NullableJsonArray,
    }
}

const fn object(name: &'static str) -> TypedJsonField {
    TypedJsonField {
        name,
        kind: TypedJsonKind::JsonObject,
    }
}

const fn nullable_object(name: &'static str) -> TypedJsonField {
    TypedJsonField {
        name,
        kind: TypedJsonKind::NullableJsonObject,
    }
}

const fn boolish(name: &'static str) -> TypedJsonField {
    TypedJsonField {
        name,
        kind: TypedJsonKind::Boolish,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn registry_has_unique_collection_names() {
        let mut names = HashSet::new();
        for contract in COLLECTIONS {
            assert!(
                names.insert(contract.name),
                "duplicate storage contract for {}",
                contract.name
            );
        }
    }

    #[test]
    fn registry_answers_core_contract_questions() {
        let connections = collection_contract("connections").expect("connections contract");
        assert!(connections.profile);
        assert!(connections.startup_json_repair);
        assert!(connections.create_default_fields.contains(&"enabled"));
        assert!(connections
            .typed_json_fields
            .iter()
            .any(|field| field.name == "defaultForAgents" && field.kind == TypedJsonKind::Boolish));

        let lorebooks = collection_contract("lorebooks").expect("lorebooks contract");
        assert!(lorebooks
            .delete_cleanup
            .contains(&DeleteCleanup::DeleteLorebookChildren));
        assert!(lorebooks
            .delete_cleanup
            .contains(&DeleteCleanup::ClearLorebookReferences));
    }
}
