use super::shared::*;
use super::*;

pub(crate) fn duplicate_persona(state: &AppState, id: &str) -> AppResult<Value> {
    let mut record = get_required(state, "personas", id)?;
    let duplicate_avatar = duplicate_managed_persona_avatar(state, id, &record)?;
    let object = record
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Persona is not an object"))?;
    object.remove("id");
    if let Some(name) = object
        .get("name")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        object.insert("name".to_string(), Value::String(format!("{name} Copy")));
    }
    object.insert("isActive".to_string(), Value::Bool(false));
    object.insert("active".to_string(), Value::Bool(false));
    match duplicate_avatar {
        DuplicatePersonaAvatar::Copied {
            asset_url,
            absolute_path,
            filename,
        } => {
            if object.contains_key("avatar") {
                object.insert("avatar".to_string(), Value::String(asset_url.clone()));
            }
            object.insert("avatarPath".to_string(), Value::String(asset_url));
            object.insert("avatarFilePath".to_string(), Value::String(absolute_path));
            object.insert("avatarFilename".to_string(), Value::String(filename));
        }
        DuplicatePersonaAvatar::MissingManagedMetadata => {
            object.insert("avatarFilePath".to_string(), Value::Null);
            object.insert("avatarFilename".to_string(), Value::Null);
        }
        DuplicatePersonaAvatar::None => {}
    }
    state.storage.create("personas", record)
}

enum DuplicatePersonaAvatar {
    Copied {
        asset_url: String,
        absolute_path: String,
        filename: String,
    },
    MissingManagedMetadata,
    None,
}

fn duplicate_managed_persona_avatar(
    state: &AppState,
    persona_id: &str,
    record: &Value,
) -> AppResult<DuplicatePersonaAvatar> {
    let avatar_path = media_uploads::managed_record_file_path(
        state,
        "avatars/personas",
        record,
        "avatarFilePath",
        "avatarFilename",
    )?;
    let Some(avatar_path) = avatar_path else {
        return Ok(if has_managed_persona_avatar_metadata(record) {
            DuplicatePersonaAvatar::MissingManagedMetadata
        } else {
            DuplicatePersonaAvatar::None
        });
    };

    let filename_hint = record
        .get("avatarFilename")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(persona_id);
    let stored = media_uploads::persist_image_file_copy(
        state,
        "avatars/personas",
        filename_hint,
        &avatar_path,
    )?;
    Ok(DuplicatePersonaAvatar::Copied {
        asset_url: stored.asset_url,
        absolute_path: stored.absolute_path,
        filename: stored.filename,
    })
}

fn has_managed_persona_avatar_metadata(record: &Value) -> bool {
    ["avatarFilePath", "avatarFilename"]
        .iter()
        .any(|field| record.get(*field).is_some_and(|value| !value.is_null()))
}

pub(crate) fn activate_persona(state: &AppState, id: &str) -> AppResult<Value> {
    get_required(state, "personas", id)?;
    let personas = state.storage.list("personas")?;
    for persona in personas {
        let Some(persona_id) = persona.get("id").and_then(Value::as_str) else {
            continue;
        };
        let active = persona_id == id;
        let is_active = persona
            .get("isActive")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let active_alias = persona
            .get("active")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if is_active == active && active_alias == active {
            continue;
        }
        state.storage.patch(
            "personas",
            persona_id,
            json!({ "isActive": active, "active": active }),
        )?;
    }
    get_required(state, "personas", id)
}
