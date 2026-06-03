use super::*;

pub(super) fn import_parented_records(
    state: &AppState,
    items: Vec<Value>,
    collection: &str,
    owner_field: &str,
    owner_id: &str,
    parent_field: &str,
    label: &str,
) -> AppResult<HashMap<String, String>> {
    let mut created_ids = Vec::new();
    let result = (|| -> AppResult<HashMap<String, String>> {
        let mut id_map = HashMap::new();
        let mut pending_parents = Vec::new();
        for item in items {
            let old_id = item
                .get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let old_parent_id = item
                .get(parent_field)
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let mut record = ensure_object(item)?;
            record.remove("id");
            record.remove(owner_field);
            record.insert(owner_field.to_string(), Value::String(owner_id.to_string()));
            if old_parent_id.is_some() {
                record.insert(parent_field.to_string(), Value::Null);
            }
            let created = state.storage.create(collection, Value::Object(record))?;
            let new_id = created_record_id(&created, label)?;
            created_ids.push(new_id.clone());
            if let Some(old_id) = old_id {
                id_map.insert(old_id, new_id.clone());
            }
            if let Some(old_parent_id) = old_parent_id {
                pending_parents.push((new_id, old_parent_id));
            }
        }
        for (record_id, old_parent_id) in pending_parents {
            if let Some(new_parent_id) = id_map.get(&old_parent_id) {
                let mut patch = Map::new();
                patch.insert(
                    parent_field.to_string(),
                    Value::String(new_parent_id.clone()),
                );
                state
                    .storage
                    .patch(collection, &record_id, Value::Object(patch))?;
            }
        }
        Ok(id_map)
    })();

    result.map_err(|error| rollback_created_records_error(state, collection, &created_ids, error))
}

fn rollback_created_records_error(
    state: &AppState,
    collection: &str,
    record_ids: &[String],
    error: AppError,
) -> AppError {
    let mut rollback_errors = Vec::new();
    rollback_created_records_collect(state, collection, record_ids, &mut rollback_errors);
    append_marinara_rollback_errors(
        error,
        &format!("imported {collection} records"),
        rollback_errors,
    )
}

pub(super) fn rollback_created_records_collect(
    state: &AppState,
    collection: &str,
    record_ids: &[String],
    rollback_errors: &mut Vec<String>,
) {
    if collection == "messages" {
        if let Err(error) =
            crate::storage_commands::message_swipes::delete_for_messages(state, record_ids)
        {
            rollback_errors.push(format!("message-swipes for messages: {error}"));
        }
    }
    for record_id in record_ids.iter().rev() {
        if let Err(rollback_error) = state.storage.delete(collection, record_id) {
            rollback_errors.push(format!("{record_id}: {rollback_error}"));
        }
    }
}

pub(super) fn rollback_records_by_field_collect(
    state: &AppState,
    collection: &str,
    field: &str,
    value: &str,
    rollback_errors: &mut Vec<String>,
) {
    let mut filters = Map::new();
    filters.insert(field.to_string(), Value::String(value.to_string()));
    if let Err(error) = state.storage.delete_where(collection, &filters) {
        rollback_errors.push(format!("{collection} where {field}={value}: {error}"));
    }
}

pub(super) fn rollback_managed_child_dir(
    state: &AppState,
    root: &str,
    child: &str,
    rollback_errors: &mut Vec<String>,
) {
    if child.trim().is_empty() || child.contains('/') || child.contains('\\') {
        rollback_errors.push(format!("{root}/{child}: invalid managed child id"));
        return;
    }
    let path = state.data_dir.join(root).join(child);
    let metadata = match fs::symlink_metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            rollback_errors.push(format!("{}: {error}", path.display()));
            return;
        }
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        rollback_errors.push(format!("{} is not a managed directory", path.display()));
        return;
    }
    if let Err(error) = fs::remove_dir_all(&path) {
        rollback_errors.push(format!("{}: {error}", path.display()));
    }
}

pub(super) fn append_marinara_rollback_errors(
    error: AppError,
    context: &str,
    rollback_errors: Vec<String>,
) -> AppError {
    if rollback_errors.is_empty() {
        error
    } else {
        AppError::new(
            "storage_rollback_failed",
            format!(
                "{error}; additionally failed to roll back {context}: {}",
                rollback_errors.join("; ")
            ),
        )
    }
}
