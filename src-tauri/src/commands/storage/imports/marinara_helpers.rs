use super::*;

pub(super) fn data_string_name(record: &Value) -> Option<String> {
    record
        .get("data")
        .and_then(|data| data.get("name"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

pub(super) fn data_image_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .filter(|value| value.starts_with("data:image/"))
        .map(ToOwned::to_owned)
}

pub(super) fn remove_fields(value: &mut Value, fields: &[&str]) {
    if let Some(object) = value.as_object_mut() {
        for field in fields {
            object.remove(*field);
        }
    }
}

pub(super) fn hydrate_metadata_timestamps(value: &mut Value) {
    let Some(metadata) = value.get_mut("metadata").and_then(Value::as_object_mut) else {
        return;
    };
    if metadata.contains_key("timestamps") {
        return;
    }
    let created_at = metadata.get("createdAt").cloned();
    let updated_at = metadata.get("updatedAt").cloned();
    if created_at.is_none() && updated_at.is_none() {
        return;
    }
    metadata.insert(
        "timestamps".to_string(),
        json!({
            "createdAt": created_at.unwrap_or(Value::Null),
            "updatedAt": updated_at.unwrap_or(Value::Null)
        }),
    );
}

pub(super) fn inherit_wrapper_timestamps(record: &mut Value, wrapper: &Value) {
    let Some(timestamps) = wrapper
        .get("metadata")
        .and_then(|metadata| metadata.get("timestamps"))
        .cloned()
    else {
        return;
    };
    let Some(object) = record.as_object_mut() else {
        return;
    };
    let metadata = object
        .entry("metadata".to_string())
        .or_insert_with(|| json!({}));
    if let Some(metadata) = metadata.as_object_mut() {
        metadata
            .entry("timestamps".to_string())
            .or_insert(timestamps);
    }
}

pub(super) fn apply_import_timestamps(record: &mut Value, payload: &Value) {
    let mut timestamp_payload = payload.clone();
    hydrate_metadata_timestamps(&mut timestamp_payload);
    apply_timestamp_overrides(record, &Value::Null, &timestamp_payload);
}

pub(super) fn array_from_envelope(
    data: &Value,
    envelope: &Map<String, Value>,
    key: &str,
) -> Vec<Value> {
    data.get(key)
        .or_else(|| envelope.get(key))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

pub(super) fn remap_imported_child_order(
    value: Option<&Value>,
    id_map: &HashMap<String, String>,
    fallback: &[String],
) -> Vec<String> {
    let mut ordered = Vec::new();
    if let Some(items) = value.and_then(Value::as_array) {
        for item in items {
            let Some(old_id) = item.as_str() else {
                continue;
            };
            let Some(new_id) = id_map.get(old_id) else {
                continue;
            };
            if !ordered.iter().any(|id| id == new_id) {
                ordered.push(new_id.clone());
            }
        }
    }
    for new_id in fallback {
        if !ordered.iter().any(|id| id == new_id) {
            ordered.push(new_id.clone());
        }
    }
    ordered
}
