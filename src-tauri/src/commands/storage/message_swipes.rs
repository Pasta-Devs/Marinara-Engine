use super::shared::{
    collapse_excess_blank_lines, compact_message_swipe_fields_for_storage, json_object_value,
    materialize_message_swipe_fields, normalize_typed_json_fields, swipe_scoped_extra,
    sync_message_patch_content_to_active_swipe,
};
use crate::state::AppState;
use marinara_core::{ensure_object, new_id, now_iso, AppError, AppResult};
use marinara_storage::FileStorage;
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, HashMap, HashSet};

pub(crate) const COLLECTION: &str = "message-swipes";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct MessageSwipeMaterialization {
    pub(crate) include_swipes: bool,
    pub(crate) include_swipe_count: bool,
    pub(crate) include_swipe_previews: bool,
    pub(crate) search_swipes: bool,
    pub(crate) materialize_active_swipe: bool,
}

impl MessageSwipeMaterialization {
    pub(crate) fn summary() -> Self {
        Self {
            include_swipes: false,
            include_swipe_count: true,
            include_swipe_previews: true,
            search_swipes: false,
            materialize_active_swipe: false,
        }
    }

    pub(crate) fn full() -> Self {
        Self {
            include_swipes: true,
            include_swipe_count: true,
            include_swipe_previews: true,
            search_swipes: false,
            materialize_active_swipe: true,
        }
    }

    pub(crate) fn for_message_output(options: Option<&Value>, has_search: bool) -> Self {
        let Some(fields) = options
            .and_then(|value| value.get("fields"))
            .and_then(Value::as_array)
        else {
            return Self {
                search_swipes: has_search,
                ..Self::full()
            };
        };
        let has_field = |name: &str| fields.iter().any(|field| field.as_str() == Some(name));
        Self {
            include_swipes: has_field("swipes"),
            include_swipe_count: has_field("swipeCount"),
            include_swipe_previews: has_field("swipePreviews"),
            search_swipes: has_search,
            materialize_active_swipe: has_field("swipes") || has_field("extra"),
        }
    }

    fn needs_sidecars(self) -> bool {
        self.include_swipes
            || self.include_swipe_count
            || self.include_swipe_previews
            || self.search_swipes
            || self.materialize_active_swipe
    }
}

fn message_id(message: &Value) -> AppResult<String> {
    message
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::invalid_input("Message is missing an id"))
}

fn optional_chat_id(message: &Value) -> Option<String> {
    message
        .get("chatId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned)
}

fn sidecar_row_id(message_id: &str, index: usize) -> String {
    format!("{message_id}::swipe::{index}")
}

fn sidecar_index(row: &Value) -> usize {
    row.get("index")
        .and_then(Value::as_u64)
        .map(|index| index as usize)
        .unwrap_or(0)
}

fn sidecar_message_id(row: &Value) -> Option<&str> {
    row.get("messageId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
}

fn sidecar_matches_message_id(row: &Value, message_id: &str) -> bool {
    sidecar_message_id(row) == Some(message_id)
}

fn sort_swipes(swipes: &mut [Value]) {
    swipes.sort_by(|a, b| {
        sidecar_index(a).cmp(&sidecar_index(b)).then_with(|| {
            let a_created = a.get("createdAt").and_then(Value::as_str).unwrap_or("");
            let b_created = b.get("createdAt").and_then(Value::as_str).unwrap_or("");
            a_created.cmp(b_created)
        })
    });
}

fn sidecar_summary_fields(materialization: MessageSwipeMaterialization) -> Vec<String> {
    let mut fields = ["messageId", "index", "createdAt", "content", "characterId"]
        .into_iter()
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if materialization.materialize_active_swipe {
        fields.push("extra".to_string());
    }
    fields
}

fn strip_message_derived_fields(object: &mut Map<String, Value>) -> bool {
    let mut changed = false;
    for field in ["swipes", "swipeCount", "swipePreviews"] {
        changed |= object.remove(field).is_some();
    }
    changed
}

pub(crate) fn take_swipes_for_storage(message: &mut Value) -> AppResult<Option<Vec<Value>>> {
    let Some(object) = message.as_object_mut() else {
        return Ok(None);
    };
    compact_message_swipe_fields_for_storage(object);
    let swipes = match object.remove("swipes") {
        Some(Value::Array(swipes)) => Some(swipes),
        Some(_) => {
            return Err(AppError::invalid_input(
                "Message swipes must be a JSON array",
            ));
        }
        None => None,
    };
    object.remove("swipeCount");
    object.remove("swipePreviews");
    Ok(swipes)
}

fn normalize_swipe_row(
    message_id: &str,
    chat_id: Option<&str>,
    message_created_at: Option<&str>,
    index: usize,
    swipe: &Value,
) -> AppResult<Value> {
    let mut object = swipe.as_object().cloned().unwrap_or_default();
    let now = now_iso();
    object.insert(
        "id".to_string(),
        Value::String(sidecar_row_id(message_id, index)),
    );
    object.insert(
        "messageId".to_string(),
        Value::String(message_id.to_string()),
    );
    if let Some(chat_id) = chat_id {
        object.insert("chatId".to_string(), Value::String(chat_id.to_string()));
    }
    object.insert("index".to_string(), json!(index));
    if let Some(Value::String(content)) = object.get_mut("content") {
        *content = collapse_excess_blank_lines(content);
    }
    object
        .entry("createdAt".to_string())
        .or_insert_with(|| Value::String(message_created_at.unwrap_or(&now).to_string()));
    object
        .entry("updatedAt".to_string())
        .or_insert_with(|| Value::String(now));
    normalize_typed_json_fields(COLLECTION, &mut object)?;
    Ok(Value::Object(object))
}

fn swipe_rows_for_message(message: &Value, swipes: &[Value]) -> AppResult<Vec<Value>> {
    let message_id = message_id(message)?;
    let chat_id = optional_chat_id(message);
    let created_at = message.get("createdAt").and_then(Value::as_str);
    swipes
        .iter()
        .enumerate()
        .map(|(index, swipe)| {
            normalize_swipe_row(&message_id, chat_id.as_deref(), created_at, index, swipe)
        })
        .collect()
}

fn sort_sidecar_rows(rows: &mut [Value]) {
    rows.sort_by(|a, b| {
        a.get("messageId")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(b.get("messageId").and_then(Value::as_str).unwrap_or(""))
            .then_with(|| sidecar_index(a).cmp(&sidecar_index(b)))
    });
}

pub(crate) fn normalize_message_rows_and_sidecars(
    messages: Vec<Value>,
    sidecars: Vec<Value>,
) -> AppResult<(Vec<Value>, Vec<Value>)> {
    let (messages, sidecars, _) = normalize_message_rows_and_sidecars_inner(messages, sidecars)?;
    Ok((messages, sidecars))
}

fn normalize_message_rows_and_sidecars_inner(
    mut messages: Vec<Value>,
    sidecars: Vec<Value>,
) -> AppResult<(Vec<Value>, Vec<Value>, bool)> {
    let message_ids = messages
        .iter()
        .filter_map(|message| {
            message
                .get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|id| !id.is_empty())
                .map(ToOwned::to_owned)
        })
        .collect::<HashSet<_>>();
    let mut changed = false;
    let mut sidecar_by_key: BTreeMap<(String, usize), Value> = BTreeMap::new();
    for row in sidecars {
        let Some(message_id) = row
            .get("messageId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(ToOwned::to_owned)
        else {
            changed = true;
            continue;
        };
        if !message_ids.contains(&message_id) {
            changed = true;
            continue;
        }
        let key = (message_id, sidecar_index(&row));
        if sidecar_by_key.insert(key, row).is_some() {
            changed = true;
        }
    }

    for message in &mut messages {
        let Some(object) = message.as_object_mut() else {
            continue;
        };
        let message_id = match object.get("id").and_then(Value::as_str) {
            Some(id) if !id.trim().is_empty() => id.trim().to_string(),
            _ => continue,
        };
        let Some(mut swipes) = object.get("swipes").and_then(Value::as_array).cloned() else {
            if strip_message_derived_fields(object) {
                changed = true;
            }
            continue;
        };
        let active_index = object
            .get("activeSwipeIndex")
            .and_then(Value::as_u64)
            .map(|index| index as usize)
            .unwrap_or(0);
        let parent_extra = object.get("extra").cloned();
        preserve_parent_active_extra(&mut swipes, active_index, parent_extra.as_ref());
        object.insert("swipes".to_string(), Value::Array(swipes.clone()));
        materialize_message_swipe_fields(message);
        if let Some(object) = message.as_object_mut() {
            compact_message_swipe_fields_for_storage(object);
            let compacted_swipes = object.get("swipes").and_then(Value::as_array).cloned();
            if let Some(compacted_swipes) = compacted_swipes {
                swipes = compacted_swipes;
            }
        }
        sidecar_by_key.retain(|(existing_message_id, _), _| existing_message_id != &message_id);
        let rows = swipe_rows_for_message(message, &swipes)?;
        for (index, row) in rows.into_iter().enumerate() {
            sidecar_by_key.insert((message_id.clone(), index), row);
        }
        if let Some(object) = message.as_object_mut() {
            strip_message_derived_fields(object);
        }
        changed = true;
    }

    let sidecars = sidecar_by_key.into_values().collect::<Vec<_>>();
    Ok((messages, sidecars, changed))
}

fn prepare_message_create_row(state: &AppState, value: Value) -> AppResult<Value> {
    let mut object = ensure_object(value)?;
    let had_id = object
        .get("id")
        .and_then(Value::as_str)
        .is_some_and(|id| !id.trim().is_empty());
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(new_id);
    if had_id && state.storage.get("messages", &id)?.is_some() {
        return Err(AppError::invalid_input(format!(
            "messages/{id} already exists"
        )));
    }
    let now = now_iso();
    object.insert("id".to_string(), Value::String(id));
    object
        .entry("createdAt".to_string())
        .or_insert_with(|| Value::String(now.clone()));
    object
        .entry("updatedAt".to_string())
        .or_insert_with(|| Value::String(now));
    normalize_typed_json_fields("messages", &mut object)?;
    Ok(Value::Object(object))
}

fn message_row_for_write(message: Value, force_updated_at: bool) -> AppResult<(String, Value)> {
    let id = message_id(&message)?;
    let mut object = ensure_object(message)?;
    let now = now_iso();
    object.insert("id".to_string(), Value::String(id.clone()));
    object
        .entry("createdAt".to_string())
        .or_insert_with(|| Value::String(now.clone()));
    if force_updated_at {
        object.insert("updatedAt".to_string(), Value::String(now));
    } else {
        object
            .entry("updatedAt".to_string())
            .or_insert_with(|| Value::String(now));
    }
    normalize_typed_json_fields("messages", &mut object)?;
    Ok((id, Value::Object(object)))
}

fn write_message_and_swipes(
    state: &AppState,
    message: Value,
    swipes: Vec<Value>,
    force_updated_at: bool,
) -> AppResult<Value> {
    let (message_id, message) = message_row_for_write(message, force_updated_at)?;
    let replacement = swipe_rows_for_message(&message, &swipes)?;
    state
        .storage
        .update_collections_atomically(vec!["messages", COLLECTION], move |collections| {
            let messages = collections[0].rows_mut();
            let mut replaced = false;
            for row in messages.iter_mut() {
                if row.get("id").and_then(Value::as_str) == Some(message_id.as_str()) {
                    *row = message.clone();
                    replaced = true;
                    break;
                }
            }
            if !replaced {
                messages.push(message.clone());
            }

            let sidecars = collections[1].rows_mut();
            sidecars.retain(|row| !sidecar_matches_message_id(row, &message_id));
            sidecars.extend(replacement);
            sort_sidecar_rows(sidecars);

            Ok(message)
        })
}

pub(crate) fn replace_message_with_swipes(
    state: &AppState,
    message: Value,
    swipes: Vec<Value>,
) -> AppResult<Value> {
    write_message_and_swipes(state, message, swipes, true)
}

fn preserve_parent_active_extra(swipes: &mut [Value], active_index: usize, extra: Option<&Value>) {
    let Some(extra) = swipe_scoped_extra(extra) else {
        return;
    };
    if swipes.is_empty() {
        return;
    }
    let active_index = active_index.min(swipes.len().saturating_sub(1));
    let Some(Value::Object(swipe)) = swipes.get_mut(active_index) else {
        return;
    };
    let mut merged = json_object_value(swipe.get("extra"))
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let Some(parent) = extra.as_object() else {
        return;
    };
    for (key, value) in parent {
        merged.entry(key.clone()).or_insert_with(|| value.clone());
    }
    swipe.insert("extra".to_string(), Value::Object(merged));
}

fn preserve_embedded_parent_active_extra(message: &mut Value) {
    let Some(object) = message.as_object_mut() else {
        return;
    };
    let Some(mut swipes) = object.get("swipes").and_then(Value::as_array).cloned() else {
        return;
    };
    let active_index = object
        .get("activeSwipeIndex")
        .and_then(Value::as_u64)
        .map(|index| index as usize)
        .unwrap_or(0);
    let parent_extra = object.get("extra").cloned();
    preserve_parent_active_extra(&mut swipes, active_index, parent_extra.as_ref());
    object.insert("swipes".to_string(), Value::Array(swipes));
}

fn initial_swipe_for_message(message: &Value) -> Value {
    let mut swipe = Map::new();
    swipe.insert(
        "content".to_string(),
        Value::String(
            message
                .get("content")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        ),
    );
    if let Some(extra) = swipe_scoped_extra(message.get("extra")) {
        swipe.insert("extra".to_string(), extra);
    }
    Value::Object(swipe)
}

fn public_swipes_from_rows(rows: &[Value]) -> Vec<Value> {
    rows.iter()
        .enumerate()
        .map(|(index, row)| {
            let mut object = row.as_object().cloned().unwrap_or_default();
            object.insert("index".to_string(), json!(index));
            Value::Object(object)
        })
        .collect()
}

fn swipe_previews_from_rows(rows: &[Value]) -> Vec<Value> {
    rows.iter()
        .map(|row| {
            let mut preview = Map::new();
            preview.insert(
                "content".to_string(),
                Value::String(
                    row.get("content")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                ),
            );
            if let Some(character_id) = row.get("characterId") {
                preview.insert("characterId".to_string(), character_id.clone());
            }
            Value::Object(preview)
        })
        .collect()
}

fn apply_sidecar_swipes(
    message: &mut Value,
    swipes: &[Value],
    materialization: MessageSwipeMaterialization,
) {
    if swipes.is_empty() {
        if let Some(object) = message.as_object_mut() {
            if materialization.include_swipes || materialization.search_swipes {
                object.remove("swipes");
            }
            if materialization.include_swipe_count {
                object.insert("swipeCount".to_string(), json!(0));
            }
            if materialization.include_swipe_previews {
                object.insert("swipePreviews".to_string(), Value::Array(Vec::new()));
            }
        }
        return;
    }

    let should_insert_swipes = materialization.include_swipes
        || materialization.search_swipes
        || materialization.materialize_active_swipe;
    if let Some(object) = message.as_object_mut() {
        if should_insert_swipes {
            object.insert(
                "swipes".to_string(),
                Value::Array(public_swipes_from_rows(swipes)),
            );
        }
        if materialization.include_swipe_count {
            object.insert("swipeCount".to_string(), json!(swipes.len()));
        }
        if materialization.include_swipe_previews {
            object.insert(
                "swipePreviews".to_string(),
                Value::Array(swipe_previews_from_rows(swipes)),
            );
        }
    }
    if materialization.include_swipes {
        materialize_message_swipe_fields(message);
    } else if materialization.materialize_active_swipe {
        materialize_missing_active_swipe_extra(message);
        if !materialization.search_swipes {
            if let Some(object) = message.as_object_mut() {
                object.remove("swipes");
            }
        }
    }
}

fn materialize_missing_active_swipe_extra(message: &mut Value) {
    let Some(object) = message.as_object_mut() else {
        return;
    };
    let active_index = object
        .get("activeSwipeIndex")
        .and_then(Value::as_u64)
        .map(|index| index as usize)
        .unwrap_or(0);
    let Some(swipes) = object.get("swipes").and_then(Value::as_array) else {
        return;
    };
    let Some(active_swipe) = swipes.get(active_index.min(swipes.len().saturating_sub(1))) else {
        return;
    };
    let Some(active_extra) = swipe_scoped_extra(active_swipe.get("extra")) else {
        return;
    };
    let Some(active_extra) = active_extra.as_object() else {
        return;
    };
    let mut merged = json_object_value(object.get("extra"))
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    for (key, value) in active_extra {
        merged.entry(key.clone()).or_insert_with(|| value.clone());
    }
    object.insert("extra".to_string(), Value::Object(merged));
}

pub(crate) fn migrate_nested_message_swipes(storage: &FileStorage) -> AppResult<()> {
    let messages = storage.list("messages")?;
    let sidecars = storage.list(COLLECTION)?;
    let (messages, sidecars, changed) =
        normalize_message_rows_and_sidecars_inner(messages, sidecars)?;
    if changed {
        storage.replace_all_many(vec![(COLLECTION, sidecars), ("messages", messages)])?;
    }
    Ok(())
}

pub(crate) fn materialize_message(
    state: &AppState,
    message: &mut Value,
    include_swipes: bool,
) -> AppResult<()> {
    let materialization = if include_swipes {
        MessageSwipeMaterialization::full()
    } else {
        MessageSwipeMaterialization::summary()
    };
    materialize_message_for_output(state, message, materialization)
}

pub(crate) fn materialize_message_for_output(
    state: &AppState,
    message: &mut Value,
    materialization: MessageSwipeMaterialization,
) -> AppResult<()> {
    let Some(id) = message
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned)
    else {
        return Ok(());
    };
    if !materialization.needs_sidecars() {
        return Ok(());
    }
    if message.get("swipes").and_then(Value::as_array).is_some() {
        preserve_embedded_parent_active_extra(message);
        materialize_message_swipe_fields(message);
        if !materialization.include_swipes {
            if let Some(object) = message.as_object_mut() {
                object.remove("swipes");
            }
        }
        return Ok(());
    }
    let filter_values = HashSet::from([id.clone()]);
    let mut swipes = if materialization.include_swipes {
        state
            .storage
            .list_where_in(COLLECTION, "messageId", &filter_values)?
    } else {
        let fields = sidecar_summary_fields(materialization);
        state.storage.list_projected_where_in(
            COLLECTION,
            "messageId",
            &filter_values,
            &fields,
            &Map::new(),
        )?
    };
    sort_swipes(&mut swipes);
    apply_sidecar_swipes(message, &swipes, materialization);
    Ok(())
}

pub(crate) fn materialize_messages(
    state: &AppState,
    messages: &mut [Value],
    include_swipes: bool,
) -> AppResult<()> {
    let materialization = if include_swipes {
        MessageSwipeMaterialization::full()
    } else {
        MessageSwipeMaterialization::summary()
    };
    materialize_messages_for_output(state, messages, materialization)
}

pub(crate) fn materialize_messages_for_output(
    state: &AppState,
    messages: &mut [Value],
    materialization: MessageSwipeMaterialization,
) -> AppResult<()> {
    if !materialization.needs_sidecars() {
        return Ok(());
    }
    let ids = messages
        .iter()
        .filter_map(|message| {
            message
                .get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|id| !id.is_empty())
                .map(ToOwned::to_owned)
        })
        .collect::<HashSet<_>>();
    if ids.is_empty() {
        return Ok(());
    }
    let mut grouped: HashMap<String, Vec<Value>> = HashMap::new();
    let sidecars = if materialization.include_swipes {
        state.storage.list_where_in(COLLECTION, "messageId", &ids)?
    } else {
        let fields = sidecar_summary_fields(materialization);
        state.storage.list_projected_where_in(
            COLLECTION,
            "messageId",
            &ids,
            &fields,
            &Map::new(),
        )?
    };
    for row in sidecars {
        let Some(message_id) = row
            .get("messageId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|id| ids.contains(*id))
        else {
            continue;
        };
        grouped.entry(message_id.to_string()).or_default().push(row);
    }
    for swipes in grouped.values_mut() {
        sort_swipes(swipes);
    }
    for message in messages {
        if message.get("swipes").and_then(Value::as_array).is_some() {
            preserve_embedded_parent_active_extra(message);
            materialize_message_swipe_fields(message);
            if !materialization.include_swipes {
                if let Some(object) = message.as_object_mut() {
                    object.remove("swipes");
                }
            }
            continue;
        }
        let Some(id) = message.get("id").and_then(Value::as_str) else {
            continue;
        };
        let swipes = grouped.get(id).map(Vec::as_slice).unwrap_or(&[]);
        apply_sidecar_swipes(message, swipes, materialization);
    }
    Ok(())
}

#[cfg(test)]
pub(crate) fn swipes_for_message(state: &AppState, message_id: &str) -> AppResult<Vec<Value>> {
    let ids = HashSet::from([message_id.to_string()]);
    let mut swipes = state.storage.list_where_in(COLLECTION, "messageId", &ids)?;
    sort_swipes(&mut swipes);
    Ok(public_swipes_from_rows(&swipes))
}

pub(crate) fn delete_for_messages(state: &AppState, message_ids: &[String]) -> AppResult<usize> {
    if message_ids.is_empty() {
        return Ok(0);
    }
    let ids = message_ids
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    state.storage.delete_where_matching(COLLECTION, |row| {
        sidecar_message_id(row).is_some_and(|message_id| ids.contains(message_id))
    })
}

pub(crate) fn delete_message_rows_with_swipes(
    state: &AppState,
    message_ids: &[String],
) -> AppResult<usize> {
    if message_ids.is_empty() {
        return Ok(0);
    }
    let requested_ids = message_ids
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    state
        .storage
        .update_collections_atomically(vec!["messages", COLLECTION], move |collections| {
            let messages = collections[0].rows_mut();
            let original_message_count = messages.len();
            let mut deleted_ids = HashSet::new();
            messages.retain(|row| {
                let should_delete = row
                    .get("id")
                    .and_then(Value::as_str)
                    .is_some_and(|id| requested_ids.contains(id));
                if should_delete {
                    if let Some(id) = row.get("id").and_then(Value::as_str) {
                        deleted_ids.insert(id.to_string());
                    }
                }
                !should_delete
            });
            let deleted = original_message_count.saturating_sub(messages.len());
            if deleted == 0 {
                return Ok(0);
            }

            let sidecars = collections[1].rows_mut();
            sidecars.retain(|row| {
                sidecar_message_id(row).is_none_or(|message_id| !deleted_ids.contains(message_id))
            });

            Ok(deleted)
        })
}

pub(crate) fn delete_message_rows_for_chats_with_swipes(
    state: &AppState,
    chat_ids: &HashSet<String>,
) -> AppResult<usize> {
    if chat_ids.is_empty() {
        return Ok(0);
    }
    state
        .storage
        .update_collections_atomically(vec!["messages", COLLECTION], move |collections| {
            let messages = collections[0].rows_mut();
            let original_message_count = messages.len();
            let mut deleted_message_ids = HashSet::new();
            messages.retain(|row| {
                let should_delete = row
                    .get("chatId")
                    .and_then(Value::as_str)
                    .is_some_and(|chat_id| chat_ids.contains(chat_id));
                if should_delete {
                    if let Some(id) = row.get("id").and_then(Value::as_str) {
                        deleted_message_ids.insert(id.to_string());
                    }
                }
                !should_delete
            });
            let deleted = original_message_count.saturating_sub(messages.len());

            let sidecars = collections[1].rows_mut();
            sidecars.retain(|row| {
                let matches_chat = row
                    .get("chatId")
                    .and_then(Value::as_str)
                    .is_some_and(|chat_id| chat_ids.contains(chat_id));
                let matches_deleted_message = sidecar_message_id(row)
                    .is_some_and(|message_id| deleted_message_ids.contains(message_id));
                !(matches_chat || matches_deleted_message)
            });

            Ok(deleted)
        })
}

pub(crate) fn create_message(state: &AppState, message: Value) -> AppResult<Value> {
    let message = prepare_message_create_row(state, message)?;
    persist_created_message_swipes(state, message)
}

fn persist_created_message_swipes(state: &AppState, mut message: Value) -> AppResult<Value> {
    if message.get("swipes").is_some() {
        preserve_embedded_parent_active_extra(&mut message);
        materialize_message_swipe_fields(&mut message);
        let swipes = take_swipes_for_storage(&mut message)?.unwrap_or_default();
        let mut updated = write_message_and_swipes(state, message, swipes, false)?;
        materialize_message(state, &mut updated, true)?;
        return Ok(updated);
    }
    let swipes = vec![initial_swipe_for_message(&message)];
    let mut updated = write_message_and_swipes(state, message, swipes, false)?;
    materialize_message(state, &mut updated, true)?;
    Ok(updated)
}

pub(crate) fn patch_message_update(
    state: &AppState,
    message_id: &str,
    patch: Value,
) -> AppResult<Value> {
    let normalized = super::shared::normalize_update_patch("messages", patch)?;
    let patch_object = normalized.as_object().cloned().unwrap_or_default();
    let mut message = state
        .storage
        .get("messages", message_id)?
        .ok_or_else(|| AppError::not_found(format!("messages/{message_id} was not found")))?;
    materialize_message(state, &mut message, true)?;
    {
        let object = message
            .as_object_mut()
            .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
        for (key, value) in patch_object.clone() {
            object.insert(key, value);
        }
        sync_message_patch_content_to_active_swipe(object, &patch_object);
    }
    materialize_message_swipe_fields(&mut message);
    let swipes = take_swipes_for_storage(&mut message)?.unwrap_or_default();
    let mut updated = write_message_and_swipes(state, message, swipes, true)?;
    materialize_message(state, &mut updated, true)?;
    Ok(updated)
}

pub(crate) fn update_message_content_if_unchanged(
    state: &AppState,
    chat_id: &str,
    message_id: &str,
    expected_content: &str,
    content: &str,
) -> AppResult<Option<Value>> {
    let content = collapse_excess_blank_lines(content);
    let mut message = state
        .storage
        .get("messages", message_id)?
        .ok_or_else(|| AppError::not_found(format!("messages/{message_id} was not found")))?;
    materialize_message(state, &mut message, true)?;
    {
        let object = message
            .as_object_mut()
            .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
        let current_chat_id = object.get("chatId").and_then(Value::as_str).unwrap_or("");
        if current_chat_id != chat_id {
            return Ok(None);
        }
        let current_content = object.get("content").and_then(Value::as_str).unwrap_or("");
        if current_content != expected_content {
            return Ok(None);
        }
        let mut patch = Map::new();
        patch.insert("content".to_string(), Value::String(content.clone()));
        object.insert("content".to_string(), Value::String(content));
        sync_message_patch_content_to_active_swipe(object, &patch);
    }
    materialize_message_swipe_fields(&mut message);
    let swipes = take_swipes_for_storage(&mut message)?.unwrap_or_default();
    let mut updated = write_message_and_swipes(state, message, swipes, true)?;
    materialize_message(state, &mut updated, true)?;
    Ok(Some(updated))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root(label: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-message-swipes-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        path
    }

    fn test_state(label: &str) -> AppState {
        AppState::from_data_dir(temp_root(label), Vec::new())
            .expect("test app state should initialize")
    }

    #[test]
    fn migration_moves_nested_swipes_to_sidecar_and_strips_message_rows() {
        let root = temp_root("migrate");
        let storage = FileStorage::new(root.join("data")).expect("storage should initialize");
        storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "old active",
                    "activeSwipeIndex": 1,
                    "extra": { "persistent": "keep", "thinking": "old" },
                    "swipeCount": 2,
                    "swipePreviews": [{ "content": "stale" }],
                    "swipes": [
                        { "content": "first", "extra": { "thinking": "first thought" } },
                        { "content": "second", "extra": { "thinking": "second thought" } }
                    ]
                })],
            )
            .expect("messages should seed");

        migrate_nested_message_swipes(&storage).expect("migration should succeed");
        migrate_nested_message_swipes(&storage).expect("migration should be idempotent");

        let messages = storage.list("messages").expect("messages should list");
        assert_eq!(messages.len(), 1);
        assert!(messages[0].get("swipes").is_none());
        assert!(messages[0].get("swipeCount").is_none());
        assert!(messages[0].get("swipePreviews").is_none());
        assert_eq!(messages[0]["content"], "second");
        assert_eq!(messages[0]["extra"]["persistent"], "keep");
        assert!(messages[0]["extra"].get("thinking").is_none());

        let sidecars = storage
            .list(COLLECTION)
            .expect("message swipes should list");
        assert_eq!(sidecars.len(), 2);
        assert_eq!(sidecars[0]["messageId"], "message-1");
        assert_eq!(sidecars[0]["chatId"], "chat-1");
        assert_eq!(sidecars[0]["index"], json!(0));
        assert_eq!(sidecars[0]["content"], "first");
        assert_eq!(sidecars[0]["extra"]["thinking"], "first thought");
        assert_eq!(sidecars[1]["index"], json!(1));
        assert_eq!(sidecars[1]["content"], "second");
        assert_eq!(sidecars[1]["extra"]["thinking"], "second thought");
    }

    #[test]
    fn migration_replaces_stale_sidecars_for_nested_message_swipes() {
        let root = temp_root("migrate-replace-stale-sidecars");
        let storage = FileStorage::new(root.join("data")).expect("storage should initialize");
        storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "fresh",
                    "activeSwipeIndex": 0,
                    "swipes": [{ "content": "fresh" }]
                })],
            )
            .expect("messages should seed");
        storage
            .replace_all(
                COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 0,
                        "content": "stale first"
                    }),
                    json!({
                        "id": "message-1::swipe::1",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 1,
                        "content": "stale extra"
                    }),
                    json!({
                        "id": "orphan::swipe::0",
                        "chatId": "chat-old",
                        "messageId": "orphan",
                        "index": 0,
                        "content": "orphaned old content"
                    }),
                ],
            )
            .expect("sidecars should seed");

        migrate_nested_message_swipes(&storage).expect("migration should replace stale sidecars");

        let sidecars = storage
            .list(COLLECTION)
            .expect("message swipes should list");
        assert_eq!(sidecars.len(), 1);
        assert_eq!(sidecars[0]["messageId"], "message-1");
        assert_eq!(sidecars[0]["index"], json!(0));
        assert_eq!(sidecars[0]["content"], "fresh");
    }

    #[test]
    fn normalize_strips_stale_derived_fields_when_message_has_no_sidecars() {
        let (messages, sidecars) = normalize_message_rows_and_sidecars(
            vec![json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "fresh",
                "activeSwipeIndex": 0,
                "swipeCount": 2,
                "swipePreviews": [{ "content": "stale child" }]
            })],
            Vec::new(),
        )
        .expect("message rows should normalize");

        assert!(sidecars.is_empty());
        assert!(messages[0].get("swipes").is_none());
        assert!(messages[0].get("swipeCount").is_none());
        assert!(messages[0].get("swipePreviews").is_none());
        assert_eq!(messages[0]["content"], "fresh");
    }

    #[test]
    fn materialize_without_sidecars_clears_stale_swipes_and_reports_empty_summary() {
        let state = test_state("materialize-empty-sidecars-strip-derived");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "fresh",
                    "activeSwipeIndex": 0,
                    "swipeCount": 2,
                    "swipePreviews": [{ "content": "stale child" }]
                })],
            )
            .expect("messages should seed");

        let mut message = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should not fail")
            .expect("message should exist");
        materialize_message(&state, &mut message, true).expect("message should materialize");

        assert!(message.get("swipes").is_none());
        assert_eq!(message["swipeCount"], json!(0));
        assert_eq!(message["swipePreviews"], json!([]));
        assert_eq!(message["content"], "fresh");
    }

    #[test]
    fn malformed_top_level_swipes_are_rejected_before_sidecar_write() {
        let mut message = json!({
            "id": "message-1",
            "chatId": "chat-1",
            "role": "assistant",
            "content": "fresh",
            "swipes": {}
        });

        let error = take_swipes_for_storage(&mut message)
            .expect_err("malformed top-level swipes should reject");

        assert_eq!(error.code, "invalid_input");
    }

    #[test]
    fn delete_message_rows_with_swipes_replaces_parent_and_sidecar_together() {
        let state = test_state("delete-message-row-with-sidecar");
        state
            .storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "message-1", "chatId": "chat-1", "content": "delete me" }),
                    json!({ "id": "message-2", "chatId": "chat-1", "content": "keep me" }),
                ],
            )
            .expect("messages should seed");
        state
            .storage
            .replace_all(
                COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 0,
                        "content": "delete sidecar"
                    }),
                    json!({
                        "id": "message-2::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-2",
                        "index": 0,
                        "content": "keep sidecar"
                    }),
                ],
            )
            .expect("sidecars should seed");

        let deleted = delete_message_rows_with_swipes(&state, &["message-1".to_string()])
            .expect("message and sidecar should delete together");

        assert_eq!(deleted, 1);
        let messages = state
            .storage
            .list("messages")
            .expect("messages should list");
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0]["id"], "message-2");
        let sidecars = state
            .storage
            .list(COLLECTION)
            .expect("message swipes should list");
        assert_eq!(sidecars.len(), 1);
        assert_eq!(sidecars[0]["messageId"], "message-2");
    }

    #[test]
    fn delete_message_rows_for_chats_with_swipes_removes_sidecars_by_deleted_message_id() {
        let state = test_state("delete-chat-message-sidecars");
        state
            .storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "message-1", "chatId": "chat-1", "content": "delete me" }),
                    json!({ "id": "message-2", "chatId": "chat-2", "content": "keep me" }),
                ],
            )
            .expect("messages should seed");
        state
            .storage
            .replace_all(
                COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "stale-chat-id",
                        "messageId": "message-1",
                        "index": 0,
                        "content": "delete by message id"
                    }),
                    json!({
                        "id": "message-2::swipe::0",
                        "chatId": "chat-2",
                        "messageId": "message-2",
                        "index": 0,
                        "content": "keep sidecar"
                    }),
                ],
            )
            .expect("sidecars should seed");
        let chat_ids = HashSet::from(["chat-1".to_string()]);

        let deleted = delete_message_rows_for_chats_with_swipes(&state, &chat_ids)
            .expect("chat messages and sidecars should delete together");

        assert_eq!(deleted, 1);
        let messages = state
            .storage
            .list("messages")
            .expect("messages should list");
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0]["id"], "message-2");
        let sidecars = state
            .storage
            .list(COLLECTION)
            .expect("message swipes should list");
        assert_eq!(sidecars.len(), 1);
        assert_eq!(sidecars[0]["messageId"], "message-2");
    }

    #[test]
    fn materialize_message_adds_sidecar_summary_without_replacing_parent_fields() {
        let state = test_state("materialize");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "second",
                    "activeSwipeIndex": 1,
                    "extra": { "persistent": "keep" }
                })],
            )
            .expect("messages should seed");
        state
            .storage
            .replace_all(
                COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 0,
                        "content": "first"
                    }),
                    json!({
                        "id": "message-1::swipe::1",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 1,
                        "content": "second",
                        "extra": { "thinking": "second thought" }
                    }),
                ],
            )
            .expect("sidecar rows should seed");

        let mut message = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should not fail")
            .expect("message should exist");
        materialize_message(&state, &mut message, false).expect("message should materialize");

        assert!(message.get("swipes").is_none());
        assert_eq!(message["swipeCount"], json!(2));
        assert_eq!(message["activeSwipeIndex"], json!(1));
        assert_eq!(message["content"], "second");
        assert_eq!(message["extra"]["persistent"], "keep");
        assert!(message["extra"].get("thinking").is_none());
        assert_eq!(
            message["swipePreviews"],
            json!([{ "content": "first" }, { "content": "second" }])
        );
        assert!(state
            .storage
            .get("messages", "message-1")
            .expect("stored message lookup should not fail")
            .expect("stored message should exist")
            .get("swipes")
            .is_none());
    }

    #[test]
    fn active_extra_projection_uses_sidecar_without_returning_swipes() {
        let state = test_state("active-extra-projection-strips-sidecars");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "active parent",
                    "activeSwipeIndex": 1,
                    "extra": { "persistent": "keep" }
                })],
            )
            .expect("messages should seed");
        state
            .storage
            .replace_all(
                COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 0,
                        "content": "first",
                        "extra": { "thinking": "first thought" }
                    }),
                    json!({
                        "id": "message-1::swipe::1",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 1,
                        "content": "active parent",
                        "extra": { "thinking": "active thought" }
                    }),
                ],
            )
            .expect("sidecars should seed");

        let mut message = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should not fail")
            .expect("message should exist");
        materialize_message_for_output(
            &state,
            &mut message,
            MessageSwipeMaterialization {
                include_swipes: false,
                include_swipe_count: false,
                include_swipe_previews: false,
                search_swipes: false,
                materialize_active_swipe: true,
            },
        )
        .expect("message should materialize");

        assert!(message.get("swipes").is_none());
        assert_eq!(message["extra"]["persistent"], "keep");
        assert_eq!(message["extra"]["thinking"], "active thought");
    }

    #[test]
    fn batched_full_materialization_accepts_trimmed_legacy_sidecar_message_ids() {
        let state = test_state("batch-full-materialize-trimmed-sidecar-message-id");
        let mut messages = vec![json!({
            "id": "message-1",
            "chatId": "chat-1",
            "role": "assistant",
            "content": "active parent",
            "activeSwipeIndex": 0
        })];
        state
            .storage
            .replace_all(
                COLLECTION,
                vec![json!({
                    "id": "message-1::swipe::0",
                    "chatId": "chat-1",
                    "messageId": " message-1 ",
                    "index": 0,
                    "content": "legacy padded message id",
                    "extra": { "thinking": "trimmed thought" }
                })],
            )
            .expect("sidecars should seed");

        materialize_messages_for_output(&state, &mut messages, MessageSwipeMaterialization::full())
            .expect("messages should materialize");

        assert_eq!(messages[0]["content"], "legacy padded message id");
        assert_eq!(messages[0]["swipeCount"], json!(1));
        assert_eq!(messages[0]["extra"]["thinking"], "trimmed thought");
        assert_eq!(
            messages[0]["swipes"][0]["content"],
            "legacy padded message id"
        );
    }

    #[test]
    fn single_full_materialization_accepts_trimmed_legacy_sidecar_message_ids() {
        let state = test_state("single-full-materialize-trimmed-sidecar-message-id");
        let mut message = json!({
            "id": "message-1",
            "chatId": "chat-1",
            "role": "assistant",
            "content": "active parent",
            "activeSwipeIndex": 0
        });
        state
            .storage
            .replace_all(
                COLLECTION,
                vec![json!({
                    "id": "message-1::swipe::0",
                    "chatId": "chat-1",
                    "messageId": " message-1 ",
                    "index": 0,
                    "content": "legacy padded message id",
                    "extra": { "thinking": "trimmed thought" }
                })],
            )
            .expect("sidecars should seed");

        materialize_message_for_output(&state, &mut message, MessageSwipeMaterialization::full())
            .expect("message should materialize");

        assert_eq!(message["content"], "legacy padded message id");
        assert_eq!(message["swipeCount"], json!(1));
        assert_eq!(message["extra"]["thinking"], "trimmed thought");
        assert_eq!(message["swipes"][0]["messageId"], " message-1 ");
        assert_eq!(message["swipes"][0]["content"], "legacy padded message id");
    }

    #[test]
    fn replacing_message_swipes_removes_trimmed_legacy_sidecar_rows() {
        let state = test_state("replace-trimmed-legacy-sidecar-message-id");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "old",
                    "activeSwipeIndex": 0
                })],
            )
            .expect("message should seed");
        state
            .storage
            .replace_all(
                COLLECTION,
                vec![json!({
                    "id": "message-1::swipe::0",
                    "chatId": "chat-1",
                    "messageId": " message-1 ",
                    "index": 0,
                    "content": "legacy padded message id"
                })],
            )
            .expect("sidecars should seed");

        replace_message_with_swipes(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "replacement",
                "activeSwipeIndex": 0
            }),
            vec![json!({ "content": "replacement" })],
        )
        .expect("message should replace");

        let sidecars = state
            .storage
            .list(COLLECTION)
            .expect("sidecars should list");
        assert_eq!(sidecars.len(), 1);
        assert_eq!(sidecars[0]["messageId"], "message-1");
        assert_eq!(sidecars[0]["content"], "replacement");
    }

    #[test]
    fn deleting_message_rows_removes_trimmed_legacy_sidecar_rows() {
        let state = test_state("delete-trimmed-legacy-sidecar-message-id");
        state
            .storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "message-1", "chatId": "chat-1", "content": "delete me" }),
                    json!({ "id": "message-2", "chatId": "chat-1", "content": "keep me" }),
                ],
            )
            .expect("messages should seed");
        state
            .storage
            .replace_all(
                COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "stale-chat-id",
                        "messageId": " message-1 ",
                        "index": 0,
                        "content": "delete sidecar"
                    }),
                    json!({
                        "id": "message-2::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-2",
                        "index": 0,
                        "content": "keep sidecar"
                    }),
                ],
            )
            .expect("sidecars should seed");

        let deleted = delete_message_rows_with_swipes(&state, &["message-1".to_string()])
            .expect("message and trimmed sidecar should delete together");

        assert_eq!(deleted, 1);
        let sidecars = state
            .storage
            .list(COLLECTION)
            .expect("sidecars should list");
        assert_eq!(sidecars.len(), 1);
        assert_eq!(sidecars[0]["messageId"], "message-2");
    }

    #[test]
    fn create_message_keeps_response_compatible_but_persists_sidecar_swipes() {
        let state = test_state("create");
        let created = create_message(
            &state,
            json!({
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "activeSwipeIndex": 1,
                "extra": { "persistent": "keep" },
                "swipes": [
                    { "content": "first" },
                    { "content": "second", "extra": { "thinking": "second thought" } }
                ]
            }),
        )
        .expect("message should create");
        let message_id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("created message should have id")
            .to_string();

        assert_eq!(created["content"], "second");
        assert_eq!(created["swipeCount"], json!(2));
        assert_eq!(
            created["swipes"]
                .as_array()
                .expect("response should include swipes")
                .len(),
            2
        );

        let stored = state
            .storage
            .get("messages", &message_id)
            .expect("stored message lookup should not fail")
            .expect("stored message should exist");
        assert!(stored.get("swipes").is_none());
        assert_eq!(stored["content"], "second");

        let sidecars = state
            .storage
            .list(COLLECTION)
            .expect("sidecar rows should list");
        assert_eq!(sidecars.len(), 2);
        assert_eq!(sidecars[0]["messageId"], message_id);
    }

    #[test]
    fn create_message_without_embedded_swipes_creates_initial_sidecar_swipe() {
        let state = test_state("create-initial-sidecar");
        let created = create_message(
            &state,
            json!({
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "extra": {
                    "hiddenFromAI": true,
                    "generationInfo": { "model": "first-model" }
                }
            }),
        )
        .expect("message should create");
        let message_id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("created message should have id")
            .to_string();

        assert_eq!(created["swipeCount"], json!(1));
        assert_eq!(created["swipes"][0]["content"], json!("first"));
        assert_eq!(created["extra"]["hiddenFromAI"], json!(true));
        assert_eq!(
            created["swipes"][0]["extra"]["generationInfo"]["model"],
            json!("first-model")
        );

        let stored = state
            .storage
            .get("messages", &message_id)
            .expect("stored message lookup should not fail")
            .expect("stored message should exist");
        assert!(stored.get("swipes").is_none());
        let sidecars = state
            .storage
            .list(COLLECTION)
            .expect("sidecar rows should list");
        assert_eq!(sidecars.len(), 1);
        assert_eq!(sidecars[0]["messageId"], message_id);
        assert_eq!(sidecars[0]["index"], json!(0));
        assert_eq!(sidecars[0]["content"], json!("first"));
    }
}
