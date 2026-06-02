use super::*;

pub(super) fn created_record_id(record: &Value, label: &str) -> AppResult<String> {
    record
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::new("storage_error", format!("Created {label} is missing an id")))
}

pub(super) fn flush_import_writes(state: &AppState) -> AppResult<()> {
    state.storage.flush()
}

pub(super) fn append_rollback_errors(
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

pub(super) fn rollback_created_records(
    state: &AppState,
    collection: &str,
    record_ids: &[String],
    rollback_errors: &mut Vec<String>,
) {
    for record_id in record_ids.iter().rev() {
        if let Err(error) = state.storage.delete(collection, record_id) {
            rollback_errors.push(format!("{collection}/{record_id}: {error}"));
        }
    }
}

fn rollback_records_by_field(
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

pub(super) fn rollback_lorebook_tree(
    state: &AppState,
    lorebook_id: &str,
    rollback_errors: &mut Vec<String>,
) {
    rollback_records_by_field(
        state,
        "lorebook-entries",
        "lorebookId",
        lorebook_id,
        rollback_errors,
    );
    rollback_records_by_field(
        state,
        "lorebook-folders",
        "lorebookId",
        lorebook_id,
        rollback_errors,
    );
    rollback_created_records(
        state,
        "lorebooks",
        &[lorebook_id.to_string()],
        rollback_errors,
    );
}

pub(super) fn rollback_managed_file_path(
    state: &AppState,
    folder: &str,
    absolute_path: &str,
    rollback_errors: &mut Vec<String>,
) {
    let managed_dir = state.data_dir.join(folder);
    let path = Path::new(absolute_path);
    let Ok(managed_dir) = fs::canonicalize(&managed_dir) else {
        return;
    };
    let path = match fs::canonicalize(path) {
        Ok(path) => path,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            rollback_errors.push(format!("{absolute_path}: {error}"));
            return;
        }
    };
    if !path.starts_with(&managed_dir) {
        rollback_errors.push(format!(
            "{} is outside managed import folder {}",
            path.display(),
            managed_dir.display()
        ));
        return;
    }
    if path.is_file() {
        if let Err(error) = fs::remove_file(&path) {
            rollback_errors.push(format!("{}: {error}", path.display()));
        } else if let Some(parent) = path.parent() {
            let _ = fs::remove_dir(parent);
        }
    }
}
