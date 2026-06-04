use marinara_core::{ensure_object, new_id, now_iso, AppError, AppResult};
use marinara_security::validate_collection_name;
use serde::de::{DeserializeSeed, MapAccess, SeqAccess, Visitor};
use serde::Deserializer as _;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::{BufRead, BufReader, Cursor, ErrorKind, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, RwLock,
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const MESSAGE_REVERSE_READ_CHUNK_SIZE: u64 = 1024 * 1024;
const STORAGE_SAVE_DEBOUNCE_MS: u64 = 750;

#[derive(Default)]
struct StorageCache {
    collections: HashMap<String, CachedCollection>,
    projected_lists: HashMap<ProjectionCacheKey, CachedProjectedList>,
}

struct CachedCollection {
    rows: Vec<Value>,
    dirty: bool,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct ProjectionCacheKey {
    collection: String,
    shape: ProjectionShape,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct ProjectionShape {
    fields: Vec<String>,
    field_selections: Vec<(String, Vec<String>)>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct CollectionFileStamp {
    len: u64,
    modified_nanos: u128,
    content_signature: u64,
}

struct CachedProjectedList {
    rows: Vec<Value>,
    stamp: Option<CollectionFileStamp>,
}

struct AtomicUpdateGuard {
    active: Arc<AtomicBool>,
}

impl Drop for AtomicUpdateGuard {
    fn drop(&mut self) {
        self.active.store(false, Ordering::SeqCst);
    }
}

pub struct AtomicCollectionRows {
    collection: String,
    rows: Vec<Value>,
}

impl AtomicCollectionRows {
    pub fn collection(&self) -> &str {
        &self.collection
    }

    pub fn rows(&self) -> &[Value] {
        &self.rows
    }

    pub fn rows_mut(&mut self) -> &mut Vec<Value> {
        &mut self.rows
    }
}

#[derive(Clone)]
pub struct FileStorage {
    root: PathBuf,
    lock: Arc<RwLock<()>>,
    cache: Arc<RwLock<StorageCache>>,
    flush_scheduled: Arc<AtomicBool>,
    atomic_update_active: Arc<AtomicBool>,
}

impl FileStorage {
    pub fn new(root: impl Into<PathBuf>) -> AppResult<Self> {
        let root = root.into();
        fs::create_dir_all(root.join("collections"))?;
        Ok(Self {
            root,
            lock: Arc::new(RwLock::new(())),
            cache: Arc::new(RwLock::new(StorageCache::default())),
            flush_scheduled: Arc::new(AtomicBool::new(false)),
            atomic_update_active: Arc::new(AtomicBool::new(false)),
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn flush(&self) -> AppResult<()> {
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.flush_dirty_collections_locked()
    }

    pub fn list(&self, collection: &str) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || self.read_collection_no_recovery(collection),
            || self.read_collection(collection),
        )
    }

    pub fn list_where(
        &self,
        collection: &str,
        filters: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || self.read_collection_filtered_no_recovery(collection, filters),
            || self.read_collection_filtered(collection, filters),
        )
    }

    pub fn list_where_in(
        &self,
        collection: &str,
        filter_field: &str,
        filter_values: &HashSet<String>,
    ) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || self.read_collection_where_in_no_recovery(collection, filter_field, filter_values),
            || self.read_collection_where_in(collection, filter_field, filter_values),
        )
    }

    pub fn list_projected(
        &self,
        collection: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || self.read_collection_projected_no_recovery(collection, fields, field_selections),
            || self.read_collection_projected(collection, fields, field_selections),
        )
    }

    pub fn list_projected_where_in(
        &self,
        collection: &str,
        filter_field: &str,
        filter_values: &HashSet<String>,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || {
                self.read_collection_projected_where_in_no_recovery(
                    collection,
                    filter_field,
                    filter_values,
                    fields,
                    field_selections,
                )
            },
            || {
                self.read_collection_projected_where_in(
                    collection,
                    filter_field,
                    filter_values,
                    fields,
                    field_selections,
                )
            },
        )
    }

    pub fn list_messages_for_chat(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || self.read_messages_for_chat_no_recovery(chat_id),
            || self.read_messages_for_chat(chat_id),
        )
    }

    pub fn list_messages_for_chat_projected(
        &self,
        chat_id: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || self.read_messages_for_chat_projected_no_recovery(chat_id, fields, field_selections),
            || self.read_messages_for_chat_projected(chat_id, fields, field_selections),
        )
    }

    pub fn list_message_ids_for_chat(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || self.read_message_ids_for_chat_no_recovery(chat_id),
            || self.read_message_ids_for_chat(chat_id),
        )
    }

    pub fn count_messages_for_chat(&self, chat_id: &str) -> AppResult<usize> {
        self.read_locked_or_recover(
            || self.read_message_count_for_chat_no_recovery(chat_id),
            || self.read_message_count_for_chat(chat_id),
        )
    }

    pub fn list_messages_for_chat_page(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || self.read_messages_for_chat_page_no_recovery(chat_id, limit, before),
            || self.read_messages_for_chat_page(chat_id, limit, before),
        )
    }

    pub fn list_messages_for_chat_page_projected(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_locked_or_recover(
            || {
                self.read_messages_for_chat_page_projected_no_recovery(
                    chat_id,
                    limit,
                    before,
                    fields,
                    field_selections,
                )
            },
            || {
                self.read_messages_for_chat_page_projected(
                    chat_id,
                    limit,
                    before,
                    fields,
                    field_selections,
                )
            },
        )
    }

    pub fn get(&self, collection: &str, id: &str) -> AppResult<Option<Value>> {
        self.read_locked_or_recover(
            || self.read_collection_find_by_id_no_recovery(collection, id),
            || self.read_collection_find_by_id(collection, id),
        )
    }

    pub fn get_projected(
        &self,
        collection: &str,
        id: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Option<Value>> {
        self.read_locked_or_recover(
            || {
                self.read_collection_find_by_id_projected_no_recovery(
                    collection,
                    id,
                    fields,
                    field_selections,
                )
            },
            || self.read_collection_find_by_id_projected(collection, id, fields, field_selections),
        )
    }

    pub fn create(&self, collection: &str, value: Value) -> AppResult<Value> {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        self.create_locked(collection, value, false)
    }

    pub fn create_immediate(&self, collection: &str, value: Value) -> AppResult<Value> {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        self.create_locked(collection, value, true)
    }

    fn create_locked(
        &self,
        collection: &str,
        value: Value,
        write_immediately: bool,
    ) -> AppResult<Value> {
        let mut object = ensure_object(value)?;
        let had_id = object
            .get("id")
            .and_then(Value::as_str)
            .is_some_and(|id| !id.trim().is_empty());
        let id = object
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| !id.trim().is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(new_id);
        if had_id && self.read_collection_find_by_id(collection, &id)?.is_some() {
            return Err(AppError::invalid_input(format!(
                "{collection}/{id} already exists"
            )));
        }
        let now = now_iso();
        object.insert("id".to_string(), Value::String(id.clone()));
        object
            .entry("createdAt".to_string())
            .or_insert_with(|| Value::String(now.clone()));
        object
            .entry("updatedAt".to_string())
            .or_insert_with(|| Value::String(now));
        let record = Value::Object(object);
        if !write_immediately
            && matches!(collection, "messages" | "chats")
            && !had_id
            && !self.is_collection_cached(collection)?
        {
            self.append_collection_row(collection, &record)?;
            return Ok(record);
        }
        let mut rows = self.read_collection(collection)?;
        rows.retain(|row| row.get("id").and_then(Value::as_str) != Some(id.as_str()));
        rows.push(record.clone());
        if write_immediately {
            self.write_collection_immediate(collection, &rows)?;
        } else {
            self.write_collection(collection, &rows)?;
        }
        Ok(record)
    }

    pub fn upsert_with_id(&self, collection: &str, id: &str, value: Value) -> AppResult<Value> {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        let mut rows = self.read_collection(collection)?;
        let mut object = ensure_object(value)?;
        let now = now_iso();
        object.insert("id".to_string(), Value::String(id.to_string()));
        object
            .entry("createdAt".to_string())
            .or_insert_with(|| Value::String(now.clone()));
        object
            .entry("updatedAt".to_string())
            .or_insert_with(|| Value::String(now));
        let record = Value::Object(object);
        rows.retain(|row| row.get("id").and_then(Value::as_str) != Some(id));
        rows.push(record.clone());
        self.write_collection(collection, &rows)?;
        Ok(record)
    }

    pub fn patch(&self, collection: &str, id: &str, patch: Value) -> AppResult<Value> {
        self.patch_with(collection, id, patch, |_, _| Ok(()))
    }

    pub fn patch_many(
        &self,
        collection: &str,
        patches: Vec<(String, Value)>,
    ) -> AppResult<Vec<Value>> {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        let normalized_patches = patches
            .into_iter()
            .map(|(id, patch)| Ok((id, ensure_object(patch)?)))
            .collect::<AppResult<Vec<_>>>()?;
        let mut rows = self.read_collection(collection)?;
        for (id, _) in &normalized_patches {
            if !rows
                .iter()
                .any(|row| row.get("id").and_then(Value::as_str) == Some(id.as_str()))
            {
                return Err(AppError::not_found(format!(
                    "{collection}/{id} was not found"
                )));
            }
        }
        let now = now_iso();
        let mut updated = Vec::with_capacity(normalized_patches.len());
        for (id, patch) in normalized_patches {
            let row = rows
                .iter_mut()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(id.as_str()))
                .ok_or_else(|| AppError::not_found(format!("{collection}/{id} was not found")))?;
            let Some(object) = row.as_object_mut() else {
                return Err(AppError::invalid_input("Stored record is not an object"));
            };
            for (key, value) in patch {
                object.insert(key, value);
            }
            object.insert("updatedAt".to_string(), Value::String(now.clone()));
            updated.push(Value::Object(object.clone()));
        }
        self.write_collection(collection, &rows)?;
        Ok(updated)
    }

    pub fn patch_if<F>(
        &self,
        collection: &str,
        id: &str,
        mut patch_row: F,
    ) -> AppResult<Option<Value>>
    where
        F: FnMut(&mut Map<String, Value>) -> AppResult<bool>,
    {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        let mut rows = self.read_collection(collection)?;
        let mut found = false;
        let mut patched = None;
        for row in &mut rows {
            if row.get("id").and_then(Value::as_str) != Some(id) {
                continue;
            }
            found = true;
            let Some(object) = row.as_object_mut() else {
                return Err(AppError::invalid_input("Stored record is not an object"));
            };
            if !patch_row(object)? {
                return Ok(None);
            }
            object.insert("updatedAt".to_string(), Value::String(now_iso()));
            patched = Some(Value::Object(object.clone()));
            break;
        }
        if !found {
            return Err(AppError::not_found(format!(
                "{collection}/{id} was not found"
            )));
        }
        let Some(record) = patched else {
            return Ok(None);
        };
        self.write_collection(collection, &rows)?;
        Ok(Some(record))
    }

    pub fn patch_with<F>(
        &self,
        collection: &str,
        id: &str,
        patch: Value,
        mut after_patch: F,
    ) -> AppResult<Value>
    where
        F: FnMut(&mut Map<String, Value>, &Map<String, Value>) -> AppResult<()>,
    {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        let mut rows = self.read_collection(collection)?;
        let patch = ensure_object(patch)?;
        let mut found = None;
        for row in &mut rows {
            if row.get("id").and_then(Value::as_str) != Some(id) {
                continue;
            }
            let Some(object) = row.as_object_mut() else {
                return Err(AppError::invalid_input("Stored record is not an object"));
            };
            for (key, value) in &patch {
                object.insert(key.clone(), value.clone());
            }
            after_patch(object, &patch)?;
            object.insert("updatedAt".to_string(), Value::String(now_iso()));
            found = Some(Value::Object(object.clone()));
            break;
        }
        let Some(record) = found else {
            return Err(AppError::not_found(format!(
                "{collection}/{id} was not found"
            )));
        };
        self.write_collection(collection, &rows)?;
        Ok(record)
    }

    pub fn delete(&self, collection: &str, id: &str) -> AppResult<bool> {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        let mut rows = self.read_collection(collection)?;
        let before = rows.len();
        rows.retain(|row| row.get("id").and_then(Value::as_str) != Some(id));
        let deleted = rows.len() != before;
        if deleted {
            self.write_collection(collection, &rows)?;
        }
        Ok(deleted)
    }

    pub fn delete_where(&self, collection: &str, filters: &Map<String, Value>) -> AppResult<usize> {
        self.delete_where_matching(collection, |row| row_matches_filters(row, filters))
    }

    pub fn delete_where_matching<F>(&self, collection: &str, mut predicate: F) -> AppResult<usize>
    where
        F: FnMut(&Value) -> bool,
    {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        let mut rows = self.read_collection(collection)?;
        let before = rows.len();
        rows.retain(|row| !predicate(row));
        let deleted = before.saturating_sub(rows.len());
        if deleted > 0 {
            self.write_collection(collection, &rows)?;
        }
        Ok(deleted)
    }

    pub fn delete_messages_for_chats(&self, chat_ids: &HashSet<String>) -> AppResult<usize> {
        if chat_ids.is_empty() {
            return Ok(0);
        }
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        let mut rows = self.read_collection("messages")?;
        let before = rows.len();
        rows.retain(|row| {
            row.get("chatId")
                .and_then(Value::as_str)
                .is_none_or(|chat_id| !chat_ids.contains(chat_id))
        });
        let deleted = before.saturating_sub(rows.len());
        if deleted > 0 {
            self.write_collection("messages", &rows)?;
        }
        Ok(deleted)
    }

    pub fn replace_all(&self, collection: &str, rows: Vec<Value>) -> AppResult<()> {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        self.write_collection_immediate(collection, &rows)
    }

    pub fn replace_all_many(&self, replacements: Vec<(&str, Vec<Value>)>) -> AppResult<()> {
        self.replace_all_many_and_then(replacements, || Ok(()))
    }

    pub fn update_collections_atomically<F, T>(
        &self,
        collections: Vec<&str>,
        update: F,
    ) -> AppResult<T>
    where
        F: FnOnce(&mut [AtomicCollectionRows]) -> AppResult<T>,
    {
        let _atomic_update = self.begin_atomic_update()?;
        let mut entries = {
            let _guard = self
                .lock
                .write()
                .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
            self.flush_dirty_collections_locked()?;

            let mut loaded = Vec::with_capacity(collections.len());
            let mut seen_paths = HashSet::new();
            for collection in collections {
                let path = self.collection_path(collection)?;
                if !seen_paths.insert(path) {
                    return Err(AppError::invalid_input(format!(
                        "Duplicate collection update: {collection}"
                    )));
                }
                loaded.push(AtomicCollectionRows {
                    collection: collection.to_string(),
                    rows: self.read_collection_no_recovery(collection)?,
                });
            }
            loaded
        };

        let original_rows = entries
            .iter()
            .map(|entry| (entry.collection.clone(), entry.rows.clone()))
            .collect::<Vec<_>>();

        let output = update(&mut entries)?;

        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.flush_dirty_collections_locked()?;
        for (collection, rows) in &original_rows {
            if self.read_collection_no_recovery(collection)? != *rows {
                return Err(AppError::new(
                    "storage_conflict",
                    format!("Collection changed during atomic update: {collection}"),
                ));
            }
        }
        let replacements = entries
            .iter()
            .map(|entry| (entry.collection.as_str(), entry.rows.clone()))
            .collect::<Vec<_>>();
        self.replace_all_many_locked(replacements, || Ok(()))?;
        Ok(output)
    }

    pub fn replace_all_many_and_then<F>(
        &self,
        replacements: Vec<(&str, Vec<Value>)>,
        after_install: F,
    ) -> AppResult<()>
    where
        F: FnOnce() -> AppResult<()>,
    {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        self.replace_all_many_locked(replacements, after_install)
    }

    pub fn clear_all(&self) -> AppResult<()> {
        self.ensure_writes_available()?;
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.ensure_writes_available()?;
        let collections = self.root.join("collections");
        if collections.exists() {
            fs::remove_dir_all(&collections)?;
        }
        fs::create_dir_all(collections)?;
        self.clear_collection_cache()?;
        Ok(())
    }

    fn collection_path(&self, collection: &str) -> AppResult<PathBuf> {
        validate_collection_name(collection)?;
        Ok(self
            .root
            .join("collections")
            .join(format!("{collection}.json")))
    }

    fn begin_atomic_update(&self) -> AppResult<AtomicUpdateGuard> {
        self.atomic_update_active
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| {
                AppError::new(
                    "storage_transaction_active",
                    "Storage atomic update is already active",
                )
            })?;
        Ok(AtomicUpdateGuard {
            active: self.atomic_update_active.clone(),
        })
    }

    fn ensure_writes_available(&self) -> AppResult<()> {
        if self.atomic_update_active.load(Ordering::SeqCst) {
            return Err(AppError::new(
                "storage_transaction_active",
                "Storage writes cannot run during an atomic collection update",
            ));
        }
        Ok(())
    }

    fn cached_rows(&self, collection: &str) -> AppResult<Option<Vec<Value>>> {
        validate_collection_name(collection)?;
        let cache = self
            .cache
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
        Ok(cache
            .collections
            .get(collection)
            .map(|cached| cached.rows.clone()))
    }

    fn cached_dirty_rows(&self, collection: &str) -> AppResult<Option<Vec<Value>>> {
        validate_collection_name(collection)?;
        let cache = self
            .cache
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
        Ok(cache
            .collections
            .get(collection)
            .filter(|cached| cached.dirty)
            .map(|cached| cached.rows.clone()))
    }

    fn is_collection_cached(&self, collection: &str) -> AppResult<bool> {
        validate_collection_name(collection)?;
        let cache = self
            .cache
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
        Ok(cache.collections.contains_key(collection))
    }

    fn cache_collection(&self, collection: &str, rows: &[Value], dirty: bool) -> AppResult<()> {
        validate_collection_name(collection)?;
        let mut cache = self
            .cache
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
        if dirty {
            cache
                .projected_lists
                .retain(|key, _| key.collection != collection);
        }
        cache.collections.insert(
            collection.to_string(),
            CachedCollection {
                rows: rows.to_vec(),
                dirty,
            },
        );
        Ok(())
    }

    fn clear_collection_cache(&self) -> AppResult<()> {
        let mut cache = self
            .cache
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
        cache.collections.clear();
        cache.projected_lists.clear();
        Ok(())
    }

    fn invalidate_projected_cache_for_collection(&self, collection: &str) -> AppResult<()> {
        validate_collection_name(collection)?;
        let mut cache = self
            .cache
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
        cache
            .projected_lists
            .retain(|key, _| key.collection != collection);
        Ok(())
    }

    fn dirty_collection_count(&self) -> usize {
        self.cache
            .read()
            .map(|cache| {
                cache
                    .collections
                    .values()
                    .filter(|collection| collection.dirty)
                    .count()
            })
            .unwrap_or(0)
    }

    fn schedule_dirty_flush(&self) {
        if self.flush_scheduled.swap(true, Ordering::SeqCst) {
            return;
        }
        let storage = self.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(STORAGE_SAVE_DEBOUNCE_MS));
            if let Err(error) = storage.flush() {
                eprintln!("[storage] delayed flush failed: {}", error.message);
            }
            storage.flush_scheduled.store(false, Ordering::SeqCst);
            if storage.dirty_collection_count() > 0 {
                storage.schedule_dirty_flush();
            }
        });
    }

    fn flush_dirty_collections_locked(&self) -> AppResult<()> {
        let dirty = {
            let cache = self
                .cache
                .read()
                .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
            cache
                .collections
                .iter()
                .filter(|(_, cached)| cached.dirty)
                .map(|(collection, cached)| (collection.clone(), cached.rows.clone()))
                .collect::<Vec<_>>()
        };
        for (collection, rows) in dirty {
            self.write_collection_file(&collection, &rows)?;
            let mut cache = self
                .cache
                .write()
                .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
            if let Some(cached) = cache.collections.get_mut(&collection) {
                cached.dirty = false;
            }
        }
        Ok(())
    }

    fn read_locked_or_recover<T>(
        &self,
        read_only: impl FnOnce() -> AppResult<T>,
        recover: impl FnOnce() -> AppResult<T>,
    ) -> AppResult<T> {
        let read_result = {
            let _guard = self
                .lock
                .read()
                .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
            read_only()
        };

        match read_result {
            Ok(value) => Ok(value),
            Err(error) => {
                if self.atomic_update_active.load(Ordering::SeqCst) {
                    return Err(error);
                }
                let _guard = self
                    .lock
                    .write()
                    .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
                if self.atomic_update_active.load(Ordering::SeqCst) {
                    return Err(error);
                }
                recover()
            }
        }
    }

    fn read_collection(&self, collection: &str) -> AppResult<Vec<Value>> {
        if let Some(rows) = self.cached_rows(collection)? {
            return Ok(rows);
        }
        let rows = self.read_collection_from_disk(collection)?;
        self.cache_collection(collection, &rows, false)?;
        Ok(rows)
    }

    fn read_collection_no_recovery(&self, collection: &str) -> AppResult<Vec<Value>> {
        if let Some(rows) = self.cached_rows(collection)? {
            return Ok(rows);
        }
        let rows = self.read_collection_from_disk_no_recovery(collection)?;
        self.cache_collection(collection, &rows, false)?;
        Ok(rows)
    }

    fn read_collection_from_disk(&self, collection: &str) -> AppResult<Vec<Value>> {
        let path = self.collection_path(collection)?;
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(&path)?;
        if raw.trim().is_empty() {
            return Ok(Vec::new());
        }
        parse_collection_rows(collection, &raw)
            .or_else(|error| self.recover_collection_after_read_error(collection, &path, error))
    }

    fn read_collection_from_disk_no_recovery(&self, collection: &str) -> AppResult<Vec<Value>> {
        let path = self.collection_path(collection)?;
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(&path)?;
        if raw.trim().is_empty() {
            return Ok(Vec::new());
        }
        parse_collection_rows(collection, &raw)
    }

    fn read_collection_filtered(
        &self,
        collection: &str,
        filters: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        Ok(self
            .read_collection(collection)?
            .into_iter()
            .filter(|row| row_matches_filters(row, filters))
            .collect())
    }

    fn read_collection_filtered_no_recovery(
        &self,
        collection: &str,
        filters: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        Ok(self
            .read_collection_no_recovery(collection)?
            .into_iter()
            .filter(|row| row_matches_filters(row, filters))
            .collect())
    }

    fn read_collection_where_in(
        &self,
        collection: &str,
        filter_field: &str,
        filter_values: &HashSet<String>,
    ) -> AppResult<Vec<Value>> {
        self.read_collection_where_in_inner(collection, filter_field, filter_values, true)
    }

    fn read_collection_where_in_no_recovery(
        &self,
        collection: &str,
        filter_field: &str,
        filter_values: &HashSet<String>,
    ) -> AppResult<Vec<Value>> {
        self.read_collection_where_in_inner(collection, filter_field, filter_values, false)
    }

    fn read_collection_where_in_inner(
        &self,
        collection: &str,
        filter_field: &str,
        filter_values: &HashSet<String>,
        recover_on_fallback: bool,
    ) -> AppResult<Vec<Value>> {
        if filter_values.is_empty() {
            return Ok(Vec::new());
        }
        if let Some(rows) = self.cached_rows(collection)? {
            return Ok(rows
                .into_iter()
                .filter(|row| row_string_field_matches_in(row, filter_field, filter_values))
                .collect());
        }

        let path = self.collection_path(collection)?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }

        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(FilteredRowsWhereInVisitor {
            filter_field,
            filter_values,
        }) {
            Ok(rows) => Ok(rows),
            Err(_) => {
                let rows = if recover_on_fallback {
                    self.read_collection(collection)?
                } else {
                    self.read_collection_no_recovery(collection)?
                };
                Ok(rows
                    .into_iter()
                    .filter(|row| row_string_field_matches_in(row, filter_field, filter_values))
                    .collect())
            }
        }
    }

    fn read_collection_projected(
        &self,
        collection: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_collection_projected_inner(collection, fields, field_selections, true)
    }

    fn read_collection_projected_no_recovery(
        &self,
        collection: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_collection_projected_inner(collection, fields, field_selections, false)
    }

    fn read_collection_projected_inner(
        &self,
        collection: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
        recover_on_fallback: bool,
    ) -> AppResult<Vec<Value>> {
        if fields.is_empty() {
            return Ok(Vec::new());
        }
        let field_set: HashSet<String> = fields.iter().cloned().collect();
        let nested_field_sets = selected_nested_fields(field_selections);
        if let Some(rows) = self.cached_dirty_rows(collection)? {
            return Ok(rows
                .into_iter()
                .map(|row| project_row(row, &field_set, &nested_field_sets))
                .collect());
        }

        let cache_key = ProjectionCacheKey {
            collection: collection.to_string(),
            shape: projection_shape(fields, &nested_field_sets),
        };
        let path = self.collection_path(collection)?;
        let stamp = collection_file_stamp(&path)?;
        if let Some(rows) = self.cached_projected_list_rows(&cache_key, stamp)? {
            return Ok(rows);
        }

        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }

        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(ProjectedRowsVisitor {
            fields: &field_set,
            field_selections: &nested_field_sets,
        }) {
            Ok(rows) => {
                self.cache_projected_list(&cache_key, &rows, stamp)?;
                Ok(rows)
            }
            Err(_) => {
                let rows = if recover_on_fallback {
                    self.read_collection(collection)?
                } else {
                    self.read_collection_no_recovery(collection)?
                };
                let projected = rows
                    .into_iter()
                    .map(|row| project_row(row, &field_set, &nested_field_sets))
                    .collect::<Vec<_>>();
                self.cache_projected_list(&cache_key, &projected, stamp)?;
                Ok(projected)
            }
        }
    }

    fn read_collection_projected_where_in(
        &self,
        collection: &str,
        filter_field: &str,
        filter_values: &HashSet<String>,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_collection_projected_where_in_inner(
            collection,
            filter_field,
            filter_values,
            fields,
            field_selections,
            true,
        )
    }

    fn read_collection_projected_where_in_no_recovery(
        &self,
        collection: &str,
        filter_field: &str,
        filter_values: &HashSet<String>,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_collection_projected_where_in_inner(
            collection,
            filter_field,
            filter_values,
            fields,
            field_selections,
            false,
        )
    }

    fn read_collection_projected_where_in_inner(
        &self,
        collection: &str,
        filter_field: &str,
        filter_values: &HashSet<String>,
        fields: &[String],
        field_selections: &Map<String, Value>,
        recover_on_fallback: bool,
    ) -> AppResult<Vec<Value>> {
        if fields.is_empty() || filter_values.is_empty() {
            return Ok(Vec::new());
        }
        let field_set: HashSet<String> = fields.iter().cloned().collect();
        let nested_field_sets = selected_nested_fields(field_selections);
        if let Some(rows) = self.cached_dirty_rows(collection)? {
            return Ok(rows
                .into_iter()
                .filter(|row| row_string_field_matches_in(row, filter_field, filter_values))
                .map(|row| project_row(row, &field_set, &nested_field_sets))
                .collect());
        }

        let path = self.collection_path(collection)?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }

        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(ProjectedRowsWhereInVisitor {
            filter_field,
            filter_values,
            fields: &field_set,
            field_selections: &nested_field_sets,
        }) {
            Ok(rows) => Ok(rows),
            Err(_) => {
                let rows = if recover_on_fallback {
                    self.read_collection(collection)?
                } else {
                    self.read_collection_no_recovery(collection)?
                };
                Ok(rows
                    .into_iter()
                    .filter(|row| row_string_field_matches_in(row, filter_field, filter_values))
                    .map(|row| project_row(row, &field_set, &nested_field_sets))
                    .collect())
            }
        }
    }

    fn read_collection_find_by_id(&self, collection: &str, id: &str) -> AppResult<Option<Value>> {
        self.read_collection_find_by_id_inner(collection, id, true)
    }

    fn read_collection_find_by_id_no_recovery(
        &self,
        collection: &str,
        id: &str,
    ) -> AppResult<Option<Value>> {
        self.read_collection_find_by_id_inner(collection, id, false)
    }

    fn read_collection_find_by_id_projected(
        &self,
        collection: &str,
        id: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Option<Value>> {
        self.read_collection_find_by_id_projected_inner(
            collection,
            id,
            fields,
            field_selections,
            true,
        )
    }

    fn read_collection_find_by_id_projected_no_recovery(
        &self,
        collection: &str,
        id: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Option<Value>> {
        self.read_collection_find_by_id_projected_inner(
            collection,
            id,
            fields,
            field_selections,
            false,
        )
    }

    fn read_collection_find_by_id_inner(
        &self,
        collection: &str,
        id: &str,
        recover_on_fallback: bool,
    ) -> AppResult<Option<Value>> {
        if let Some(rows) = self.cached_rows(collection)? {
            return Ok(rows
                .into_iter()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(id)));
        }
        let path = self.collection_path(collection)?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(None);
        }
        match read_pretty_record_by_id_from_file(&path, id) {
            Ok(Some(row)) => return Ok(Some(row)),
            Ok(None) => {}
            Err(_) => {}
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(FindRowByIdVisitor { id }) {
            Ok(row) => Ok(row),
            Err(_) => {
                let rows = if recover_on_fallback {
                    self.read_collection(collection)?
                } else {
                    self.read_collection_no_recovery(collection)?
                };
                Ok(rows
                    .into_iter()
                    .find(|row| row.get("id").and_then(Value::as_str) == Some(id)))
            }
        }
    }

    fn read_collection_find_by_id_projected_inner(
        &self,
        collection: &str,
        id: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
        recover_on_fallback: bool,
    ) -> AppResult<Option<Value>> {
        if fields.is_empty() {
            return self.read_collection_find_by_id_inner(collection, id, recover_on_fallback);
        }

        let field_set: HashSet<String> = fields.iter().cloned().collect();
        let nested_field_sets = selected_nested_fields(field_selections);
        if let Some(rows) = self.cached_dirty_rows(collection)? {
            return Ok(rows
                .into_iter()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(id))
                .map(|row| project_row(row, &field_set, &nested_field_sets)));
        }

        let path = self.collection_path(collection)?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(None);
        }

        match read_pretty_projected_record_by_id_from_file(
            &path,
            id,
            &field_set,
            &nested_field_sets,
        ) {
            Ok(Some(row)) => return Ok(Some(row)),
            Ok(None) => {}
            Err(_) => {}
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(ProjectedRowByIdVisitor {
            id,
            fields: &field_set,
            field_selections: &nested_field_sets,
        }) {
            Ok(row) => Ok(row),
            Err(_) => {
                let rows = if recover_on_fallback {
                    self.read_collection(collection)?
                } else {
                    self.read_collection_no_recovery(collection)?
                };
                Ok(rows
                    .into_iter()
                    .find(|row| row.get("id").and_then(Value::as_str) == Some(id))
                    .map(|row| project_row(row, &field_set, &nested_field_sets)))
            }
        }
    }

    fn read_messages_for_chat(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        self.read_messages_for_chat_inner(chat_id, true)
    }

    fn read_messages_for_chat_no_recovery(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        self.read_messages_for_chat_inner(chat_id, false)
    }

    fn read_messages_for_chat_projected(
        &self,
        chat_id: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_messages_for_chat_projected_inner(chat_id, fields, field_selections, true)
    }

    fn read_messages_for_chat_projected_no_recovery(
        &self,
        chat_id: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_messages_for_chat_projected_inner(chat_id, fields, field_selections, false)
    }

    fn read_messages_for_chat_projected_inner(
        &self,
        chat_id: &str,
        fields: &[String],
        field_selections: &Map<String, Value>,
        recover_on_fallback: bool,
    ) -> AppResult<Vec<Value>> {
        if fields.is_empty() {
            return Ok(Vec::new());
        }
        let field_set: HashSet<String> = fields.iter().cloned().collect();
        let nested_field_sets = selected_nested_fields(field_selections);
        if let Some(rows) = self.cached_dirty_rows("messages")? {
            return Ok(rows
                .into_iter()
                .filter(|row| row.get("chatId").and_then(Value::as_str) == Some(chat_id))
                .map(|row| project_row(row, &field_set, &nested_field_sets))
                .collect());
        }

        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }

        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(ProjectedMessageRowsForChatVisitor {
            chat_id,
            fields: &field_set,
            field_selections: &nested_field_sets,
        }) {
            Ok(rows) => Ok(rows),
            Err(_) => {
                let rows = if recover_on_fallback {
                    self.read_messages_for_chat(chat_id)?
                } else {
                    self.read_messages_for_chat_no_recovery(chat_id)?
                };
                Ok(rows
                    .into_iter()
                    .map(|row| project_row(row, &field_set, &nested_field_sets))
                    .collect())
            }
        }
    }

    fn read_messages_for_chat_inner(
        &self,
        chat_id: &str,
        recover_on_fallback: bool,
    ) -> AppResult<Vec<Value>> {
        if let Some(rows) = self.cached_rows("messages")? {
            return Ok(rows
                .into_iter()
                .filter(|row| row.get("chatId").and_then(Value::as_str) == Some(chat_id))
                .collect());
        }
        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(MessageRowsForChatVisitor { chat_id }) {
            Ok(rows) => Ok(rows),
            Err(_) => {
                let rows = if recover_on_fallback {
                    self.read_collection("messages")?
                } else {
                    self.read_collection_no_recovery("messages")?
                };
                Ok(rows
                    .into_iter()
                    .filter(|row| row.get("chatId").and_then(Value::as_str) == Some(chat_id))
                    .collect())
            }
        }
    }

    fn read_message_ids_for_chat(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        self.read_message_ids_for_chat_inner(chat_id, true)
    }

    fn read_message_ids_for_chat_no_recovery(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        self.read_message_ids_for_chat_inner(chat_id, false)
    }

    fn read_message_ids_for_chat_inner(
        &self,
        chat_id: &str,
        recover_on_fallback: bool,
    ) -> AppResult<Vec<Value>> {
        if let Some(rows) = self.cached_dirty_rows("messages")? {
            return Ok(rows
                .into_iter()
                .filter(|row| row.get("chatId").and_then(Value::as_str) == Some(chat_id))
                .filter_map(|row| {
                    let id = row.get("id")?.clone();
                    let mut object = Map::new();
                    object.insert("id".to_string(), id);
                    Some(Value::Object(object))
                })
                .collect());
        }
        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(MessageIdRowsForChatVisitor { chat_id }) {
            Ok(rows) => Ok(rows),
            Err(_) => {
                let rows = if recover_on_fallback {
                    self.read_collection("messages")?
                } else {
                    self.read_collection_no_recovery("messages")?
                };
                Ok(rows
                    .into_iter()
                    .filter(|row| row.get("chatId").and_then(Value::as_str) == Some(chat_id))
                    .filter_map(|row| {
                        let id = row.get("id")?.clone();
                        let mut object = Map::new();
                        object.insert("id".to_string(), id);
                        Some(Value::Object(object))
                    })
                    .collect())
            }
        }
    }

    fn read_message_count_for_chat(&self, chat_id: &str) -> AppResult<usize> {
        self.read_message_count_for_chat_inner(chat_id, true)
    }

    fn read_message_count_for_chat_no_recovery(&self, chat_id: &str) -> AppResult<usize> {
        self.read_message_count_for_chat_inner(chat_id, false)
    }

    fn read_message_count_for_chat_inner(
        &self,
        chat_id: &str,
        recover_on_fallback: bool,
    ) -> AppResult<usize> {
        if let Some(rows) = self.cached_rows("messages")? {
            return Ok(rows
                .iter()
                .filter(|row| row.get("chatId").and_then(Value::as_str) == Some(chat_id))
                .count());
        }
        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(0);
        }
        if let Some(count) = count_pretty_messages_for_chat(&path, chat_id)? {
            return Ok(count);
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        match deserializer.deserialize_seq(MessageCountForChatVisitor { chat_id }) {
            Ok(count) => Ok(count),
            Err(_) => {
                if recover_on_fallback {
                    Ok(self.read_messages_for_chat(chat_id)?.len())
                } else {
                    Ok(self.read_messages_for_chat_no_recovery(chat_id)?.len())
                }
            }
        }
    }

    fn read_messages_for_chat_page(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        self.read_messages_for_chat_page_inner(chat_id, limit, before, true)
    }

    fn read_messages_for_chat_page_no_recovery(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        self.read_messages_for_chat_page_inner(chat_id, limit, before, false)
    }

    fn read_messages_for_chat_page_inner(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
        recover_on_fallback: bool,
    ) -> AppResult<Vec<Value>> {
        if limit == 0 {
            return Ok(Vec::new());
        }
        if let Some(rows) = self.cached_rows("messages")? {
            let mut rows = rows
                .into_iter()
                .filter(|row| row.get("chatId").and_then(Value::as_str) == Some(chat_id))
                .collect::<Vec<_>>();
            apply_message_page(&mut rows, limit, before);
            return Ok(rows);
        }
        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }

        match read_pretty_message_page_from_file(&path, chat_id, limit, before) {
            Ok(Some(rows)) => return Ok(rows),
            Ok(None) => {}
            Err(_) => {}
        }

        let mut rows = if recover_on_fallback {
            self.read_messages_for_chat(chat_id)?
        } else {
            self.read_messages_for_chat_no_recovery(chat_id)?
        };
        apply_message_page(&mut rows, limit, before);
        Ok(rows)
    }

    fn read_messages_for_chat_page_projected(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_messages_for_chat_page_projected_inner(
            chat_id,
            limit,
            before,
            fields,
            field_selections,
            true,
        )
    }

    fn read_messages_for_chat_page_projected_no_recovery(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
        fields: &[String],
        field_selections: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        self.read_messages_for_chat_page_projected_inner(
            chat_id,
            limit,
            before,
            fields,
            field_selections,
            false,
        )
    }

    fn read_messages_for_chat_page_projected_inner(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
        fields: &[String],
        field_selections: &Map<String, Value>,
        recover_on_fallback: bool,
    ) -> AppResult<Vec<Value>> {
        if limit == 0 || fields.is_empty() {
            return Ok(Vec::new());
        }

        let field_set: HashSet<String> = fields.iter().cloned().collect();
        let nested_field_sets = selected_nested_fields(field_selections);
        if let Some(rows) = self.cached_rows("messages")? {
            let mut rows = rows
                .into_iter()
                .filter(|row| row.get("chatId").and_then(Value::as_str) == Some(chat_id))
                .collect::<Vec<_>>();
            apply_message_page(&mut rows, limit, before);
            return Ok(rows
                .into_iter()
                .map(|row| project_row(row, &field_set, &nested_field_sets))
                .collect());
        }

        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }

        match read_pretty_projected_message_page_from_file(
            &path,
            chat_id,
            limit,
            before,
            &field_set,
            &nested_field_sets,
        ) {
            Ok(Some(rows)) => return Ok(rows),
            Ok(None) => {}
            Err(_) => {}
        }

        let mut rows = if recover_on_fallback {
            self.read_messages_for_chat(chat_id)?
        } else {
            self.read_messages_for_chat_no_recovery(chat_id)?
        };
        apply_message_page(&mut rows, limit, before);
        Ok(rows
            .into_iter()
            .map(|row| project_row(row, &field_set, &nested_field_sets))
            .collect())
    }

    fn cached_projected_list_rows(
        &self,
        key: &ProjectionCacheKey,
        stamp: Option<CollectionFileStamp>,
    ) -> AppResult<Option<Vec<Value>>> {
        let cache = self
            .cache
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
        Ok(cache
            .projected_lists
            .get(key)
            .filter(|cached| cached.stamp == stamp)
            .map(|cached| cached.rows.clone()))
    }

    fn cache_projected_list(
        &self,
        key: &ProjectionCacheKey,
        rows: &[Value],
        stamp: Option<CollectionFileStamp>,
    ) -> AppResult<()> {
        let mut cache = self
            .cache
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage cache lock poisoned"))?;
        cache.projected_lists.insert(
            key.clone(),
            CachedProjectedList {
                rows: rows.to_vec(),
                stamp,
            },
        );
        Ok(())
    }

    fn write_collection(&self, collection: &str, rows: &[Value]) -> AppResult<()> {
        self.cache_collection(collection, rows, true)?;
        self.schedule_dirty_flush();
        Ok(())
    }

    fn write_collection_immediate(&self, collection: &str, rows: &[Value]) -> AppResult<()> {
        self.write_collection_file(collection, rows)?;
        self.invalidate_projected_cache_for_collection(collection)?;
        self.cache_collection(collection, rows, false)?;
        Ok(())
    }

    fn write_collection_file(&self, collection: &str, rows: &[Value]) -> AppResult<()> {
        let path = self.collection_path(collection)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        refresh_collection_backup(&path)?;
        write_file_atomically(&path, &serde_json::to_vec_pretty(rows)?)?;
        Ok(())
    }

    fn append_collection_row(&self, collection: &str, record: &Value) -> AppResult<()> {
        let path = self.collection_path(collection)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            self.write_collection_immediate(collection, std::slice::from_ref(record))?;
            return Ok(());
        }

        let mut file = fs::File::open(&path)?;
        let mut cursor = file.metadata()?.len();
        let mut byte = [0_u8; 1];
        while cursor > 0 {
            cursor -= 1;
            file.seek(SeekFrom::Start(cursor))?;
            file.read_exact(&mut byte)?;
            if !byte[0].is_ascii_whitespace() {
                break;
            }
        }
        if byte[0] != b']' {
            let mut rows = self.recover_collection_after_read_error(
                collection,
                &path,
                AppError::invalid_input(format!(
                    "Collection {collection} did not contain a JSON array"
                )),
            )?;
            rows.push(record.clone());
            self.write_collection_immediate(collection, &rows)?;
            return Ok(());
        }

        let mut before_close = cursor;
        let mut is_empty = false;
        while before_close > 0 {
            before_close -= 1;
            file.seek(SeekFrom::Start(before_close))?;
            file.read_exact(&mut byte)?;
            if byte[0].is_ascii_whitespace() {
                continue;
            }
            is_empty = byte[0] == b'[';
            break;
        }

        refresh_collection_backup(&path)?;
        let tmp = unique_sibling_path(&path, "tmp")?;
        let mut source = fs::File::open(&path)?;
        let mut output = fs::File::create(&tmp)?;
        std::io::copy(&mut Read::by_ref(&mut source).take(cursor), &mut output)?;
        let serialized = serde_json::to_string_pretty(record)?;
        let indented = serialized
            .lines()
            .map(|line| format!("  {line}"))
            .collect::<Vec<_>>()
            .join("\n");
        if is_empty {
            output.write_all(format!("\n{indented}\n]\n").as_bytes())?;
        } else {
            output.write_all(format!(",\n{indented}\n]\n").as_bytes())?;
        }
        output.sync_all()?;
        fs::rename(tmp, path)?;
        Ok(())
    }

    fn recover_collection_after_read_error(
        &self,
        collection: &str,
        path: &Path,
        error: AppError,
    ) -> AppResult<Vec<Value>> {
        let backup = backup_path_for(path)?;
        if backup.exists() {
            match parse_collection_file(collection, &backup) {
                Ok(rows) => {
                    eprintln!(
                        "[storage] {collection} collection file is corrupt; recovering from backup. primary={} backup={} error={}",
                        path.display(),
                        backup.display(),
                        error.message
                    );
                    preserve_corrupt_file(path)?;
                    self.write_collection_immediate(collection, &rows)?;
                    return Ok(rows);
                }
                Err(backup_error) => {
                    eprintln!(
                        "[storage] {collection} collection file and backup are corrupt; preserving both and recreating an empty collection. primary={} backup={} primary_error={} backup_error={}",
                        path.display(),
                        backup.display(),
                        error.message,
                        backup_error.message
                    );
                    preserve_corrupt_file(path)?;
                    preserve_corrupt_file(&backup)?;
                    self.write_collection_immediate(collection, &[])?;
                    return Ok(Vec::new());
                }
            }
        }

        eprintln!(
            "[storage] {collection} collection file is corrupt and no backup exists; preserving it and recreating an empty collection. primary={} error={}",
            path.display(),
            error.message
        );
        preserve_corrupt_file(path)?;
        self.write_collection_immediate(collection, &[])?;
        Ok(Vec::new())
    }

    fn replace_all_many_locked<F>(
        &self,
        replacements: Vec<(&str, Vec<Value>)>,
        after_install: F,
    ) -> AppResult<()>
    where
        F: FnOnce() -> AppResult<()>,
    {
        self.flush_dirty_collections_locked()?;
        let transaction_id = storage_transaction_id();
        let mut pending = Vec::new();
        let mut seen_paths = HashSet::new();
        let prepare_result = (|| -> AppResult<()> {
            for (index, (collection, rows)) in replacements.iter().enumerate() {
                let path = self.collection_path(collection)?;
                if !seen_paths.insert(path.clone()) {
                    return Err(AppError::invalid_input(format!(
                        "Duplicate collection replacement: {collection}"
                    )));
                }
                let existed = match fs::symlink_metadata(&path) {
                    Ok(metadata) => {
                        if !metadata.file_type().is_file() {
                            return Err(AppError::io(std::io::Error::other(format!(
                                "Collection path is not a regular file: {}",
                                path.display()
                            ))));
                        }
                        true
                    }
                    Err(error) if error.kind() == ErrorKind::NotFound => false,
                    Err(error) => return Err(error.into()),
                };
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent)?;
                }
                let tmp = collection_transaction_path(&path, &transaction_id, index, "tmp")?;
                let backup = collection_transaction_path(&path, &transaction_id, index, "backup")?;
                pending.push(PendingCollectionReplacement {
                    path,
                    tmp,
                    backup,
                    existed,
                });
                let item = pending
                    .last()
                    .expect("pending collection replacement should exist");
                fs::write(&item.tmp, serde_json::to_vec_pretty(rows)?)?;
            }
            Ok(())
        })();
        if let Err(error) = prepare_result {
            cleanup_pending_collection_temps(&pending);
            return Err(error);
        }

        let mut backed_up = Vec::new();
        let mut installed = Vec::new();
        let result = (|| -> AppResult<()> {
            for (index, item) in pending.iter().enumerate() {
                if !item.existed {
                    continue;
                }
                fs::rename(&item.path, &item.backup)?;
                backed_up.push(index);
            }
            for (index, item) in pending.iter().enumerate() {
                fs::rename(&item.tmp, &item.path)?;
                installed.push(index);
            }
            after_install()?;
            Ok(())
        })();

        if let Err(error) = result {
            if let Err(rollback_error) =
                rollback_collection_replacements(&pending, &backed_up, &installed)
            {
                cleanup_pending_collection_temps(&pending);
                return Err(AppError::new(
                    "storage_rollback_failed",
                    format!(
                        "{error}; additionally failed to roll back collection import: {rollback_error}"
                    ),
                ));
            }
            cleanup_pending_collection_transaction_files(&pending);
            return Err(error);
        }

        cleanup_pending_collection_transaction_files(&pending);
        for (collection, rows) in replacements {
            self.invalidate_projected_cache_for_collection(collection)?;
            self.cache_collection(collection, &rows, false)?;
        }
        Ok(())
    }
}

impl Drop for FileStorage {
    fn drop(&mut self) {
        if Arc::strong_count(&self.cache) == 1 && self.dirty_collection_count() > 0 {
            let _ = self.flush();
        }
    }
}

fn parse_collection_rows(collection: &str, raw: &str) -> AppResult<Vec<Value>> {
    let parsed: Value = serde_json::from_str(raw)?;
    match parsed {
        Value::Array(rows) => Ok(rows),
        _ => Err(AppError::invalid_input(format!(
            "Collection {collection} did not contain a JSON array"
        ))),
    }
}

fn parse_collection_file(collection: &str, path: &Path) -> AppResult<Vec<Value>> {
    let raw = fs::read_to_string(path)?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    parse_collection_rows(collection, &raw)
}

fn backup_path_for(path: &Path) -> AppResult<PathBuf> {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::invalid_input("Invalid collection path"))?;
    Ok(path.with_file_name(format!("{file_name}.bak")))
}

fn unique_sibling_path(path: &Path, suffix: &str) -> AppResult<PathBuf> {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::invalid_input("Invalid collection path"))?;
    let nonce = storage_transaction_id();
    Ok(path.with_file_name(format!("{file_name}.{suffix}-{nonce}")))
}

fn looks_nul_filled(path: &Path) -> bool {
    let Ok(mut file) = fs::File::open(path) else {
        return false;
    };
    let mut byte = [0_u8; 1];
    matches!(file.read(&mut byte), Ok(0)) || matches!(byte.first(), Some(0))
}

fn refresh_collection_backup(path: &Path) -> AppResult<()> {
    if !path.exists() || looks_nul_filled(path) {
        return Ok(());
    }
    let backup = backup_path_for(path)?;
    let backup_tmp = unique_sibling_path(&backup, "tmp")?;
    fs::copy(path, &backup_tmp)?;
    sync_file(&backup_tmp)?;
    fs::rename(&backup_tmp, backup)?;
    Ok(())
}

fn preserve_corrupt_file(path: &Path) -> AppResult<()> {
    if !path.exists() {
        return Ok(());
    }
    let target = unique_sibling_path(path, "corrupted")?;
    fs::rename(path, target)?;
    Ok(())
}

fn write_file_atomically(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let tmp = unique_sibling_path(path, "tmp")?;
    fs::write(&tmp, bytes)?;
    sync_file(&tmp)?;
    fs::rename(tmp, path)?;
    Ok(())
}

fn sync_file(path: &Path) -> AppResult<()> {
    fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)?
        .sync_all()?;
    Ok(())
}

fn row_matches_filters(row: &Value, filters: &Map<String, Value>) -> bool {
    let Some(object) = row.as_object() else {
        return false;
    };
    filters
        .iter()
        .all(|(key, expected)| object.get(key) == Some(expected))
}

fn row_string_field_matches_in(
    row: &Value,
    filter_field: &str,
    filter_values: &HashSet<String>,
) -> bool {
    row.get(filter_field)
        .is_some_and(|value| string_value_matches_in(value, filter_values))
}

fn string_value_matches_in(value: &Value, filter_values: &HashSet<String>) -> bool {
    value
        .as_str()
        .map(str::trim)
        .is_some_and(|value| filter_values.contains(value))
}

struct FindRowByIdVisitor<'a> {
    id: &'a str,
}

impl<'de, 'a> Visitor<'de> for FindRowByIdVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON array")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut found = None;
        while let Some(row) = seq.next_element_seed(FindRowByIdSeed { id: self.id })? {
            if row.is_some() {
                found = row;
                break;
            }
        }
        if found.is_some() {
            while seq.next_element::<serde::de::IgnoredAny>()?.is_some() {}
        }
        Ok(found)
    }
}

struct FindRowByIdSeed<'a> {
    id: &'a str,
}

impl<'de, 'a> DeserializeSeed<'de> for FindRowByIdSeed<'a> {
    type Value = Option<Value>;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(FindRowByIdRowVisitor { id: self.id })
    }
}

struct FindRowByIdRowVisitor<'a> {
    id: &'a str,
}

impl<'de, 'a> Visitor<'de> for FindRowByIdRowVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a record object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut object = Map::new();
        let mut matches_id = None;
        while let Some(key) = map.next_key::<String>()? {
            if matches_id == Some(false) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            let value = map.next_value::<Value>()?;
            if key == "id" {
                let is_match = value.as_str() == Some(self.id);
                matches_id = Some(is_match);
                if !is_match {
                    object.clear();
                    continue;
                }
            }
            object.insert(key, value);
        }

        Ok(matches_id.unwrap_or(false).then_some(Value::Object(object)))
    }
}

struct ProjectedRowByIdVisitor<'a> {
    id: &'a str,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> Visitor<'de> for ProjectedRowByIdVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON array")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut found = None;
        while let Some(row) = seq.next_element_seed(ProjectedRowByIdSeed {
            id: self.id,
            fields: self.fields,
            field_selections: self.field_selections,
        })? {
            if row.is_some() {
                found = row;
                break;
            }
        }
        if found.is_some() {
            while seq.next_element::<serde::de::IgnoredAny>()?.is_some() {}
        }
        Ok(found)
    }
}

struct ProjectedRowByIdSeed<'a> {
    id: &'a str,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> DeserializeSeed<'de> for ProjectedRowByIdSeed<'a> {
    type Value = Option<Value>;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(ProjectedRowByIdRowVisitor {
            id: self.id,
            fields: self.fields,
            field_selections: self.field_selections,
        })
    }
}

struct ProjectedRowByIdRowVisitor<'a> {
    id: &'a str,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> Visitor<'de> for ProjectedRowByIdRowVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a record object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut object = Map::new();
        let mut matches_id = None;
        while let Some(key) = map.next_key::<String>()? {
            if matches_id == Some(false) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            if key == "id" {
                let value = map.next_value::<Value>()?;
                let is_match = value.as_str() == Some(self.id);
                matches_id = Some(is_match);
                if !is_match {
                    object.clear();
                    continue;
                }
                if self.fields.contains(&key) {
                    object.insert(key, value);
                }
                continue;
            }

            if !self.fields.contains(&key) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            let value = if let Some(nested_fields) = self.field_selections.get(&key) {
                map.next_value_seed(ProjectedNestedSeed {
                    fields: nested_fields,
                })?
            } else {
                map.next_value::<Value>()?
            };
            object.insert(key, value);
        }

        Ok(matches_id.unwrap_or(false).then_some(Value::Object(object)))
    }
}

fn selected_nested_fields(
    field_selections: &Map<String, Value>,
) -> HashMap<String, HashSet<String>> {
    field_selections
        .iter()
        .filter_map(|(field, selection)| {
            let nested = selection
                .as_array()?
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect::<HashSet<_>>();
            (!nested.is_empty()).then(|| (field.clone(), nested))
        })
        .collect()
}

fn projection_shape(
    fields: &[String],
    field_selections: &HashMap<String, HashSet<String>>,
) -> ProjectionShape {
    let mut normalized_fields = fields.to_vec();
    normalized_fields.sort();
    normalized_fields.dedup();
    let mut normalized_selections = field_selections
        .iter()
        .map(|(field, selections)| {
            let mut nested = selections.iter().cloned().collect::<Vec<_>>();
            nested.sort();
            nested.dedup();
            (field.clone(), nested)
        })
        .collect::<Vec<_>>();
    normalized_selections.sort_by(|a, b| a.0.cmp(&b.0));
    ProjectionShape {
        fields: normalized_fields,
        field_selections: normalized_selections,
    }
}

fn collection_file_stamp(path: &Path) -> AppResult<Option<CollectionFileStamp>> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let modified_nanos = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    Ok(Some(CollectionFileStamp {
        len: metadata.len(),
        modified_nanos,
        content_signature: collection_content_signature(path, metadata.len())?,
    }))
}

fn collection_content_signature(path: &Path, len: u64) -> AppResult<u64> {
    let mut file = fs::File::open(path)?;
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    len.hash(&mut hasher);
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.write(&buffer[..bytes_read]);
    }
    Ok(hasher.finish())
}

fn project_row(
    row: Value,
    fields: &HashSet<String>,
    field_selections: &HashMap<String, HashSet<String>>,
) -> Value {
    let Some(object) = row.as_object() else {
        return row;
    };
    let mut projected = Map::new();
    for field in fields {
        let Some(value) = object.get(field) else {
            continue;
        };
        let next = field_selections
            .get(field)
            .map(|nested| project_nested_value(value.clone(), nested))
            .unwrap_or_else(|| value.clone());
        projected.insert(field.clone(), next);
    }
    Value::Object(projected)
}

fn project_nested_value(value: Value, fields: &HashSet<String>) -> Value {
    match value {
        Value::Object(object) => Value::Object(project_object_nested_fields(&object, fields)),
        Value::String(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(Value::Object(object)) => {
                Value::Object(project_object_nested_fields(&object, fields))
            }
            _ => Value::String(raw),
        },
        other => other,
    }
}

fn project_object_nested_fields(
    object: &Map<String, Value>,
    fields: &HashSet<String>,
) -> Map<String, Value> {
    let mut projected = Map::new();
    for field in fields {
        insert_projected_nested_field(&mut projected, object, field);
    }
    projected
}

fn insert_projected_nested_field(
    projected: &mut Map<String, Value>,
    source: &Map<String, Value>,
    path: &str,
) {
    let Some((head, tail)) = path.split_once('.') else {
        if let Some(value) = source.get(path) {
            projected.insert(path.to_string(), value.clone());
        }
        return;
    };
    let Some(value) = source.get(head) else {
        return;
    };
    let Some(nested_source) = object_value(value) else {
        return;
    };
    let entry = projected
        .entry(head.to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !entry.is_object() {
        *entry = Value::Object(Map::new());
    }
    if let Some(nested_projected) = entry.as_object_mut() {
        insert_projected_nested_field(nested_projected, &nested_source, tail);
    }
}

fn object_value(value: &Value) -> Option<Map<String, Value>> {
    match value {
        Value::Object(object) => Some(object.clone()),
        Value::String(raw) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|value| value.as_object().cloned()),
        _ => None,
    }
}

struct FilteredRowsWhereInVisitor<'a> {
    filter_field: &'a str,
    filter_values: &'a HashSet<String>,
}

impl<'de, 'a> Visitor<'de> for FilteredRowsWhereInVisitor<'a> {
    type Value = Vec<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON array of filtered records")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut rows = Vec::new();
        while let Some(row) = seq.next_element_seed(FilteredRowWhereInSeed {
            filter_field: self.filter_field,
            filter_values: self.filter_values,
        })? {
            if let Some(row) = row {
                rows.push(row);
            }
        }
        Ok(rows)
    }
}

struct FilteredRowWhereInSeed<'a> {
    filter_field: &'a str,
    filter_values: &'a HashSet<String>,
}

impl<'de, 'a> DeserializeSeed<'de> for FilteredRowWhereInSeed<'a> {
    type Value = Option<Value>;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(FilteredRowWhereInVisitor {
            filter_field: self.filter_field,
            filter_values: self.filter_values,
        })
    }
}

struct FilteredRowWhereInVisitor<'a> {
    filter_field: &'a str,
    filter_values: &'a HashSet<String>,
}

impl<'de, 'a> Visitor<'de> for FilteredRowWhereInVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a filtered record object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut object = Map::new();
        let mut matches_filter = None;
        while let Some(key) = map.next_key::<String>()? {
            if key == self.filter_field {
                let value = map.next_value::<Value>()?;
                let is_match = string_value_matches_in(&value, self.filter_values);
                matches_filter = Some(is_match);
                if is_match {
                    object.insert(key, value);
                } else {
                    object.clear();
                }
                continue;
            }

            if matches_filter == Some(false) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            object.insert(key, map.next_value::<Value>()?);
        }

        Ok(matches_filter
            .unwrap_or(false)
            .then_some(Value::Object(object)))
    }
}

struct ProjectedRowsVisitor<'a> {
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> Visitor<'de> for ProjectedRowsVisitor<'a> {
    type Value = Vec<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON array of records")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut rows = Vec::new();
        while let Some(row) = seq.next_element_seed(ProjectedRowSeed {
            fields: self.fields,
            field_selections: self.field_selections,
        })? {
            rows.push(row);
        }
        Ok(rows)
    }
}

struct ProjectedRowsWhereInVisitor<'a> {
    filter_field: &'a str,
    filter_values: &'a HashSet<String>,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> Visitor<'de> for ProjectedRowsWhereInVisitor<'a> {
    type Value = Vec<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON array of filtered records")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut rows = Vec::new();
        while let Some(row) = seq.next_element_seed(ProjectedRowWhereInSeed {
            filter_field: self.filter_field,
            filter_values: self.filter_values,
            fields: self.fields,
            field_selections: self.field_selections,
        })? {
            if let Some(row) = row {
                rows.push(row);
            }
        }
        Ok(rows)
    }
}

struct ProjectedRowWhereInSeed<'a> {
    filter_field: &'a str,
    filter_values: &'a HashSet<String>,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> DeserializeSeed<'de> for ProjectedRowWhereInSeed<'a> {
    type Value = Option<Value>;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(ProjectedRowWhereInVisitor {
            filter_field: self.filter_field,
            filter_values: self.filter_values,
            fields: self.fields,
            field_selections: self.field_selections,
        })
    }
}

struct ProjectedRowWhereInVisitor<'a> {
    filter_field: &'a str,
    filter_values: &'a HashSet<String>,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> Visitor<'de> for ProjectedRowWhereInVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a filtered record object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut object = Map::new();
        let mut matches_filter = None;
        while let Some(key) = map.next_key::<String>()? {
            if key == self.filter_field {
                let value = map.next_value::<Value>()?;
                let is_match = string_value_matches_in(&value, self.filter_values);
                matches_filter = Some(is_match);
                if is_match && self.fields.contains(&key) {
                    object.insert(key, value);
                } else if !is_match {
                    object.clear();
                }
                continue;
            }

            if matches_filter == Some(false) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            if !self.fields.contains(&key) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            let value = if let Some(nested_fields) = self.field_selections.get(&key) {
                map.next_value_seed(ProjectedNestedSeed {
                    fields: nested_fields,
                })?
            } else {
                map.next_value::<Value>()?
            };
            object.insert(key, value);
        }

        Ok(matches_filter
            .unwrap_or(false)
            .then_some(Value::Object(object)))
    }
}

struct ProjectedRowSeed<'a> {
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> DeserializeSeed<'de> for ProjectedRowSeed<'a> {
    type Value = Value;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(ProjectedRowVisitor {
            fields: self.fields,
            field_selections: self.field_selections,
        })
    }
}

struct ProjectedRowVisitor<'a> {
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> Visitor<'de> for ProjectedRowVisitor<'a> {
    type Value = Value;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a record object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut object = Map::new();
        while let Some(key) = map.next_key::<String>()? {
            if !self.fields.contains(&key) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            let value = if let Some(nested_fields) = self.field_selections.get(&key) {
                map.next_value_seed(ProjectedNestedSeed {
                    fields: nested_fields,
                })?
            } else {
                map.next_value::<Value>()?
            };
            object.insert(key, value);
        }
        Ok(Value::Object(object))
    }
}

struct ProjectedNestedSeed<'a> {
    fields: &'a HashSet<String>,
}

impl<'de, 'a> DeserializeSeed<'de> for ProjectedNestedSeed<'a> {
    type Value = Value;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_any(ProjectedNestedVisitor {
            fields: self.fields,
        })
    }
}

struct ProjectedNestedVisitor<'a> {
    fields: &'a HashSet<String>,
}

impl<'de, 'a> Visitor<'de> for ProjectedNestedVisitor<'a> {
    type Value = Value;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a nested object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut object = Map::new();
        while let Some(key) = map.next_key::<String>()? {
            if self.fields.contains(&key) {
                object.insert(key, map.next_value::<Value>()?);
            } else if let Some(child_fields) = selected_child_paths(self.fields, &key) {
                let value = map.next_value_seed(ProjectedNestedSeed {
                    fields: &child_fields,
                })?;
                if !value.as_object().is_some_and(Map::is_empty) {
                    object.insert(key, value);
                }
            } else {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
            }
        }
        Ok(Value::Object(object))
    }

    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(project_nested_value(
            Value::String(value.to_string()),
            self.fields,
        ))
    }

    fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(project_nested_value(Value::String(value), self.fields))
    }

    fn visit_none<E>(self) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Value::Null)
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Value::Null)
    }

    fn visit_bool<E>(self, value: bool) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Value::Bool(value))
    }

    fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Value::Number(value.into()))
    }

    fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(Value::Number(value.into()))
    }

    fn visit_f64<E>(self, value: f64) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(serde_json::Number::from_f64(value)
            .map(Value::Number)
            .unwrap_or(Value::Null))
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut values = Vec::new();
        while let Some(value) = seq.next_element::<Value>()? {
            values.push(value);
        }
        Ok(Value::Array(values))
    }
}

fn selected_child_paths(fields: &HashSet<String>, key: &str) -> Option<HashSet<String>> {
    let prefix = format!("{key}.");
    let children = fields
        .iter()
        .filter_map(|field| field.strip_prefix(&prefix).map(ToOwned::to_owned))
        .collect::<HashSet<_>>();
    (!children.is_empty()).then_some(children)
}

struct MessageRowsForChatVisitor<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> Visitor<'de> for MessageRowsForChatVisitor<'a> {
    type Value = Vec<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a messages JSON array")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut rows = Vec::new();
        while let Some(row) = seq.next_element_seed(MessageRowForChatSeed {
            chat_id: self.chat_id,
        })? {
            if let Some(row) = row {
                rows.push(row);
            }
        }
        Ok(rows)
    }
}

struct MessageRowForChatSeed<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> DeserializeSeed<'de> for MessageRowForChatSeed<'a> {
    type Value = Option<Value>;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(MessageRowForChatVisitor {
            chat_id: self.chat_id,
        })
    }
}

struct MessageRowForChatVisitor<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> Visitor<'de> for MessageRowForChatVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a message object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut object = Map::new();
        let mut matches_chat = None;
        while let Some(key) = map.next_key::<String>()? {
            if matches_chat == Some(false) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            let value = map.next_value::<Value>()?;
            if key == "chatId" {
                let is_match = value.as_str() == Some(self.chat_id);
                matches_chat = Some(is_match);
                if !is_match {
                    object.clear();
                    continue;
                }
            }
            object.insert(key, value);
        }

        Ok(matches_chat
            .unwrap_or(false)
            .then_some(Value::Object(object)))
    }
}

struct ProjectedMessageRowsForChatVisitor<'a> {
    chat_id: &'a str,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> Visitor<'de> for ProjectedMessageRowsForChatVisitor<'a> {
    type Value = Vec<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a messages JSON array")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut rows = Vec::new();
        while let Some(row) = seq.next_element_seed(ProjectedMessageRowForChatSeed {
            chat_id: self.chat_id,
            fields: self.fields,
            field_selections: self.field_selections,
        })? {
            if let Some(row) = row {
                rows.push(row);
            }
        }
        Ok(rows)
    }
}

struct ProjectedMessageRowForChatSeed<'a> {
    chat_id: &'a str,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> DeserializeSeed<'de> for ProjectedMessageRowForChatSeed<'a> {
    type Value = Option<Value>;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(ProjectedMessageRowForChatVisitor {
            chat_id: self.chat_id,
            fields: self.fields,
            field_selections: self.field_selections,
        })
    }
}

struct ProjectedMessageRowForChatVisitor<'a> {
    chat_id: &'a str,
    fields: &'a HashSet<String>,
    field_selections: &'a HashMap<String, HashSet<String>>,
}

impl<'de, 'a> Visitor<'de> for ProjectedMessageRowForChatVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a message object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut object = Map::new();
        let mut matches_chat = None;
        while let Some(key) = map.next_key::<String>()? {
            if key == "chatId" {
                let value = map.next_value::<Value>()?;
                matches_chat = Some(value.as_str() == Some(self.chat_id));
                if matches_chat == Some(true) && self.fields.contains(&key) {
                    object.insert(key, value);
                }
                continue;
            }

            if matches_chat == Some(false) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            if !self.fields.contains(&key) {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
                continue;
            }

            let value = if let Some(nested_fields) = self.field_selections.get(&key) {
                map.next_value_seed(ProjectedNestedSeed {
                    fields: nested_fields,
                })?
            } else {
                map.next_value::<Value>()?
            };
            object.insert(key, value);
        }

        Ok(matches_chat
            .unwrap_or(false)
            .then_some(Value::Object(object)))
    }
}

struct MessageIdRowsForChatVisitor<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> Visitor<'de> for MessageIdRowsForChatVisitor<'a> {
    type Value = Vec<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a messages JSON array")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut rows = Vec::new();
        while let Some(row) = seq.next_element_seed(MessageIdRowForChatSeed {
            chat_id: self.chat_id,
        })? {
            if let Some(row) = row {
                rows.push(row);
            }
        }
        Ok(rows)
    }
}

struct MessageIdRowForChatSeed<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> DeserializeSeed<'de> for MessageIdRowForChatSeed<'a> {
    type Value = Option<Value>;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(MessageIdRowForChatVisitor {
            chat_id: self.chat_id,
        })
    }
}

struct MessageIdRowForChatVisitor<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> Visitor<'de> for MessageIdRowForChatVisitor<'a> {
    type Value = Option<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a message object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut id = None;
        let mut matches_chat = None;
        while let Some(key) = map.next_key::<String>()? {
            match key.as_str() {
                "id" => {
                    id = Some(map.next_value::<Value>()?);
                }
                "chatId" => {
                    let value = map.next_value::<Value>()?;
                    matches_chat = Some(value.as_str() == Some(self.chat_id));
                }
                _ => {
                    let _ = map.next_value::<serde::de::IgnoredAny>()?;
                }
            }
        }

        if matches_chat != Some(true) {
            return Ok(None);
        }

        let mut object = Map::new();
        if let Some(id) = id {
            object.insert("id".to_string(), id);
        }
        Ok(Some(Value::Object(object)))
    }
}

struct MessageCountForChatVisitor<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> Visitor<'de> for MessageCountForChatVisitor<'a> {
    type Value = usize;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a messages JSON array")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut count = 0;
        while let Some(matches_chat) = seq.next_element_seed(MessageCountForChatSeed {
            chat_id: self.chat_id,
        })? {
            if matches_chat {
                count += 1;
            }
        }
        Ok(count)
    }
}

struct MessageCountForChatSeed<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> DeserializeSeed<'de> for MessageCountForChatSeed<'a> {
    type Value = bool;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_map(MessageCountForChatRowVisitor {
            chat_id: self.chat_id,
        })
    }
}

struct MessageCountForChatRowVisitor<'a> {
    chat_id: &'a str,
}

impl<'de, 'a> Visitor<'de> for MessageCountForChatRowVisitor<'a> {
    type Value = bool;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a message object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut matches_chat = false;
        while let Some(key) = map.next_key::<String>()? {
            if key == "chatId" {
                let value = map.next_value::<Value>()?;
                matches_chat = value.as_str() == Some(self.chat_id);
            } else {
                let _ = map.next_value::<serde::de::IgnoredAny>()?;
            }
        }
        Ok(matches_chat)
    }
}

fn count_pretty_messages_for_chat(path: &Path, chat_id: &str) -> AppResult<Option<usize>> {
    let encoded_chat_id = serde_json::to_string(chat_id)?;
    let pretty_field = format!("\"chatId\": {encoded_chat_id}");
    let compact_field = format!("\"chatId\":{encoded_chat_id}");
    let file = fs::File::open(path)?;
    let reader = BufReader::new(file);
    let mut saw_chat_id_field = false;
    let mut count = 0;

    for line in reader.lines() {
        let line = line?;
        let trimmed = line.trim_start();
        if !trimmed.starts_with("\"chatId\"") {
            continue;
        }
        saw_chat_id_field = true;
        if trimmed.starts_with(&pretty_field) || trimmed.starts_with(&compact_field) {
            count += 1;
        }
    }

    Ok(saw_chat_id_field.then_some(count))
}

fn is_pretty_top_level_record_end(line: &str) -> bool {
    line.starts_with("  }") && matches!(line.trim(), "}" | "},")
}

fn read_pretty_message_page_from_file(
    path: &Path,
    chat_id: &str,
    limit: usize,
    before: Option<&str>,
) -> AppResult<Option<Vec<Value>>> {
    let mut file = fs::File::open(path)?;
    let mut position = file.metadata()?.len();
    let before_cursor = before.map(parse_storage_message_cursor);
    let mut rows_newest_first = Vec::new();
    let mut record_lines_newest_first: Vec<Vec<u8>> = Vec::new();
    let mut in_record = false;
    let mut saw_record = false;

    let mut carry = Vec::new();
    while position > 0 {
        let read_len = position.min(MESSAGE_REVERSE_READ_CHUNK_SIZE) as usize;
        position -= read_len as u64;

        let mut block = vec![0_u8; read_len];
        file.seek(SeekFrom::Start(position))?;
        file.read_exact(&mut block)?;
        block.extend_from_slice(&carry);

        let mut line_ranges = Vec::new();
        let mut line_start = 0;
        for (index, byte) in block.iter().enumerate() {
            if *byte == b'\n' {
                line_ranges.push(line_start..index);
                line_start = index + 1;
            }
        }
        line_ranges.push(line_start..block.len());

        let first_line_is_partial = position > 0;
        for line_index in (0..line_ranges.len()).rev() {
            if first_line_is_partial && line_index == 0 {
                continue;
            }
            let line = &block[line_ranges[line_index].clone()];
            if !in_record {
                if is_top_level_message_record_end(line) {
                    saw_record = true;
                    in_record = true;
                    record_lines_newest_first.clear();
                    record_lines_newest_first.push(line.to_vec());
                }
                continue;
            }

            record_lines_newest_first.push(line.to_vec());
            if !is_top_level_message_record_start(line) {
                continue;
            }

            let mut record_bytes = join_reverse_lines(&record_lines_newest_first);
            strip_trailing_json_comma(&mut record_bytes);
            let row: Value = serde_json::from_slice(&record_bytes)?;
            if row.get("chatId").and_then(Value::as_str) == Some(chat_id)
                && message_is_before_cursor(&row, before_cursor.as_ref())
            {
                rows_newest_first.push(row);
                if rows_newest_first.len() >= limit {
                    rows_newest_first.reverse();
                    return Ok(Some(rows_newest_first));
                }
            }

            in_record = false;
            record_lines_newest_first.clear();
        }

        carry = if first_line_is_partial {
            block[line_ranges[0].clone()].to_vec()
        } else {
            Vec::new()
        };
    }

    if in_record || !saw_record {
        return Ok(None);
    }

    rows_newest_first.reverse();
    Ok(Some(rows_newest_first))
}

fn read_pretty_projected_message_page_from_file(
    path: &Path,
    chat_id: &str,
    limit: usize,
    before: Option<&str>,
    fields: &HashSet<String>,
    field_selections: &HashMap<String, HashSet<String>>,
) -> AppResult<Option<Vec<Value>>> {
    let mut file = fs::File::open(path)?;
    let mut position = file.metadata()?.len();
    let before_cursor = before.map(parse_storage_message_cursor);
    let mut rows_newest_first = Vec::new();
    let mut record_lines_newest_first: Vec<Vec<u8>> = Vec::new();
    let mut in_record = false;
    let mut saw_record = false;

    let mut carry = Vec::new();
    while position > 0 {
        let read_len = position.min(MESSAGE_REVERSE_READ_CHUNK_SIZE) as usize;
        position -= read_len as u64;

        let mut block = vec![0_u8; read_len];
        file.seek(SeekFrom::Start(position))?;
        file.read_exact(&mut block)?;
        block.extend_from_slice(&carry);

        let mut line_ranges = Vec::new();
        let mut line_start = 0;
        for (index, byte) in block.iter().enumerate() {
            if *byte == b'\n' {
                line_ranges.push(line_start..index);
                line_start = index + 1;
            }
        }
        line_ranges.push(line_start..block.len());

        let first_line_is_partial = position > 0;
        for line_index in (0..line_ranges.len()).rev() {
            if first_line_is_partial && line_index == 0 {
                continue;
            }
            let line = &block[line_ranges[line_index].clone()];
            if !in_record {
                if is_top_level_message_record_end(line) {
                    saw_record = true;
                    in_record = true;
                    record_lines_newest_first.clear();
                    record_lines_newest_first.push(line.to_vec());
                }
                continue;
            }

            record_lines_newest_first.push(line.to_vec());
            if !is_top_level_message_record_start(line) {
                continue;
            }

            let mut record_bytes = join_reverse_lines(&record_lines_newest_first);
            strip_trailing_json_comma(&mut record_bytes);
            if let Some((row, created_at, id)) = read_projected_pretty_message_record(
                &record_bytes,
                chat_id,
                fields,
                field_selections,
            )? {
                if message_parts_are_before_cursor(&created_at, &id, before_cursor.as_ref()) {
                    rows_newest_first.push(row);
                    if rows_newest_first.len() >= limit {
                        rows_newest_first.reverse();
                        return Ok(Some(rows_newest_first));
                    }
                }
            }

            in_record = false;
            record_lines_newest_first.clear();
        }

        carry = if first_line_is_partial {
            block[line_ranges[0].clone()].to_vec()
        } else {
            Vec::new()
        };
    }

    if in_record || !saw_record {
        return Ok(None);
    }

    rows_newest_first.reverse();
    Ok(Some(rows_newest_first))
}

fn read_projected_pretty_message_record(
    record_bytes: &[u8],
    chat_id: &str,
    fields: &HashSet<String>,
    field_selections: &HashMap<String, HashSet<String>>,
) -> AppResult<Option<(Value, String, String)>> {
    let mut reader = BufReader::new(Cursor::new(record_bytes));
    let mut in_record = false;
    let mut matches_chat = None;
    let mut projected = Map::new();
    let mut id = String::new();
    let mut created_at = String::new();

    while let Some(line) = read_json_line(&mut reader)? {
        let trimmed = line.trim_start();

        if !in_record {
            if trimmed.starts_with('{') {
                in_record = true;
                continue;
            }
            if trimmed.trim().is_empty() {
                continue;
            }
            return Ok(None);
        }

        if is_pretty_top_level_record_end(&line) {
            return Ok(matches_chat.unwrap_or(false).then_some((
                Value::Object(projected),
                created_at,
                id,
            )));
        }

        let Some((field, value_start)) = pretty_json_field(&line, 4)? else {
            continue;
        };

        match field.as_str() {
            "chatId" => {
                let value = read_pretty_json_value(&mut reader, value_start)?;
                matches_chat = Some(value.as_str() == Some(chat_id));
                if matches_chat == Some(true) && fields.contains(&field) {
                    projected.insert(field, value);
                } else if matches_chat == Some(false) {
                    projected.clear();
                }
            }
            "id" => {
                let value = read_pretty_json_value(&mut reader, value_start)?;
                id = value.as_str().unwrap_or_default().to_string();
                if matches_chat != Some(false) && fields.contains(&field) {
                    projected.insert(field, value);
                }
            }
            "createdAt" => {
                let value = read_pretty_json_value(&mut reader, value_start)?;
                created_at = value.as_str().unwrap_or_default().to_string();
                if matches_chat != Some(false) && fields.contains(&field) {
                    projected.insert(field, value);
                }
            }
            _ if matches_chat == Some(false) => {
                skip_pretty_json_value(&mut reader, value_start)?;
            }
            _ if fields.contains(&field) => {
                let value = if let Some(nested_fields) = field_selections.get(&field) {
                    read_pretty_projected_nested_value(&mut reader, value_start, nested_fields, 6)?
                } else {
                    read_pretty_json_value(&mut reader, value_start)?
                };
                projected.insert(field, value);
            }
            _ => {
                skip_pretty_json_value(&mut reader, value_start)?;
            }
        }
    }

    Ok(None)
}

fn join_reverse_lines(lines_newest_first: &[Vec<u8>]) -> Vec<u8> {
    let mut bytes = Vec::new();
    for line in lines_newest_first.iter().rev() {
        if !bytes.is_empty() {
            bytes.push(b'\n');
        }
        bytes.extend_from_slice(line);
    }
    bytes
}

fn is_top_level_message_record_start(line: &[u8]) -> bool {
    trim_ascii_end(line) == b"  {"
}

fn is_top_level_message_record_end(line: &[u8]) -> bool {
    matches!(trim_ascii_end(line), b"  }" | b"  },")
}

fn trim_ascii_end(bytes: &[u8]) -> &[u8] {
    let mut end = bytes.len();
    while end > 0 && bytes[end - 1].is_ascii_whitespace() {
        end -= 1;
    }
    &bytes[..end]
}

fn strip_trailing_json_comma(bytes: &mut Vec<u8>) {
    while bytes.last().is_some_and(u8::is_ascii_whitespace) {
        bytes.pop();
    }
    if bytes.last() == Some(&b',') {
        bytes.pop();
    }
}

fn read_pretty_record_by_id_from_file(path: &Path, id: &str) -> AppResult<Option<Value>> {
    let file = fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut record_lines: Vec<String> = Vec::new();
    let mut in_record = false;
    let mut saw_array_start = false;
    let mut saw_record = false;
    let expected_id_line = format!("\"id\": {}", serde_json::to_string(id)?);

    let mut line = String::new();
    loop {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            break;
        }
        let line = line.trim_end_matches('\n').to_string();
        let trimmed = line.trim_start();

        if !in_record {
            if trimmed.starts_with('[') {
                saw_array_start = true;
                continue;
            }
            if trimmed.starts_with(']') {
                break;
            }
            if trimmed.trim().is_empty() {
                continue;
            }
            if trimmed.starts_with('{') {
                in_record = true;
                saw_record = true;
                record_lines.clear();
                record_lines.push(line);
                continue;
            }
            return Ok(None);
        }

        let is_id_line =
            trimmed.strip_suffix(',').unwrap_or(trimmed).trim_end() == expected_id_line;
        record_lines.push(line);
        if is_id_line {
            loop {
                let mut next_line = String::new();
                let bytes = reader.read_line(&mut next_line)?;
                if bytes == 0 {
                    return Ok(None);
                }
                let next_line = next_line.trim_end_matches('\n').to_string();
                let is_end = is_pretty_top_level_record_end(&next_line);
                record_lines.push(next_line);
                if is_end {
                    let mut raw = record_lines.join("\n").into_bytes();
                    strip_trailing_json_comma(&mut raw);
                    let row: Value = serde_json::from_slice(&raw)?;
                    if row.get("id").and_then(Value::as_str) == Some(id) {
                        return Ok(Some(row));
                    }
                    in_record = false;
                    record_lines.clear();
                    break;
                }
            }
        }

        if is_pretty_top_level_record_end(
            record_lines.last().map(String::as_str).unwrap_or_default(),
        ) {
            in_record = false;
            record_lines.clear();
        }
    }

    if !saw_array_start || in_record || !saw_record {
        return Ok(None);
    }
    Ok(None)
}

fn read_pretty_projected_record_by_id_from_file(
    path: &Path,
    id: &str,
    fields: &HashSet<String>,
    field_selections: &HashMap<String, HashSet<String>>,
) -> AppResult<Option<Value>> {
    let file = fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut in_record = false;
    let mut saw_array_start = false;
    let mut saw_record = false;
    let mut matches_id = None;
    let mut projected = Map::new();

    while let Some(line) = read_json_line(&mut reader)? {
        let trimmed = line.trim_start();

        if !in_record {
            if trimmed.starts_with('[') {
                saw_array_start = true;
                continue;
            }
            if trimmed.starts_with(']') {
                break;
            }
            if trimmed.trim().is_empty() {
                continue;
            }
            if trimmed.starts_with('{') {
                in_record = true;
                saw_record = true;
                matches_id = None;
                projected.clear();
                continue;
            }
            return Ok(None);
        }

        if is_pretty_top_level_record_end(&line) {
            if matches_id == Some(true) {
                return Ok(Some(Value::Object(projected)));
            }
            in_record = false;
            matches_id = None;
            projected.clear();
            continue;
        }

        let Some((field, value_start)) = pretty_json_field(&line, 4)? else {
            continue;
        };

        if field == "id" {
            let value = read_pretty_json_value(&mut reader, value_start)?;
            let is_match = value.as_str() == Some(id);
            matches_id = Some(is_match);
            if is_match {
                if fields.contains(&field) {
                    projected.insert(field, value);
                }
            } else {
                projected.clear();
            }
            continue;
        }

        if matches_id == Some(false) {
            skip_pretty_json_value(&mut reader, value_start)?;
            continue;
        }

        if fields.contains(&field) {
            let value = if let Some(nested_fields) = field_selections.get(&field) {
                read_pretty_projected_nested_value(&mut reader, value_start, nested_fields, 6)?
            } else {
                read_pretty_json_value(&mut reader, value_start)?
            };
            projected.insert(field, value);
        } else {
            skip_pretty_json_value(&mut reader, value_start)?;
        }
    }

    if !saw_array_start || in_record || !saw_record {
        return Ok(None);
    }
    Ok(None)
}

fn read_pretty_projected_nested_value<R: BufRead>(
    reader: &mut R,
    first_value: String,
    fields: &HashSet<String>,
    field_indent: usize,
) -> AppResult<Value> {
    let trimmed = first_value.trim();
    if !trimmed.starts_with('{') || json_container_depth_delta(trimmed) <= 0 {
        return read_pretty_json_value(reader, first_value)
            .map(|value| project_nested_value(value, fields));
    }

    let end_indent = field_indent.saturating_sub(2);
    let mut projected = Map::new();
    while let Some(line) = read_json_line(reader)? {
        if is_pretty_object_end(&line, end_indent) {
            return Ok(Value::Object(projected));
        }

        let Some((field, value_start)) = pretty_json_field(&line, field_indent)? else {
            continue;
        };
        if fields.contains(&field) {
            let value = read_pretty_json_value(reader, value_start)?;
            projected.insert(field, value);
        } else if let Some(child_fields) = selected_child_paths(fields, &field) {
            let value = read_pretty_projected_nested_value(
                reader,
                value_start,
                &child_fields,
                field_indent + 2,
            )?;
            if !value.as_object().is_some_and(Map::is_empty) {
                projected.insert(field, value);
            }
        } else {
            skip_pretty_json_value(reader, value_start)?;
        }
    }

    Err(AppError::invalid_input(
        "Projected pretty JSON object ended unexpectedly",
    ))
}

fn read_pretty_json_value<R: BufRead>(reader: &mut R, first_value: String) -> AppResult<Value> {
    let mut lines = vec![first_value];
    let mut depth = json_container_depth_delta(lines[0].trim());
    while depth > 0 {
        let Some(line) = read_json_line(reader)? else {
            return Err(AppError::invalid_input(
                "Pretty JSON value ended unexpectedly",
            ));
        };
        depth += json_container_depth_delta(line.trim());
        lines.push(line);
    }
    parse_pretty_json_value(lines)
}

fn skip_pretty_json_value<R: BufRead>(reader: &mut R, first_value: String) -> AppResult<()> {
    let mut depth = json_container_depth_delta(first_value.trim());
    while depth > 0 {
        let Some(line) = read_json_line(reader)? else {
            return Err(AppError::invalid_input(
                "Pretty JSON value ended unexpectedly",
            ));
        };
        depth += json_container_depth_delta(line.trim());
    }
    Ok(())
}

fn parse_pretty_json_value(lines: Vec<String>) -> AppResult<Value> {
    let mut raw = lines.join("\n").into_bytes();
    strip_trailing_json_comma(&mut raw);
    Ok(serde_json::from_slice(&raw)?)
}

fn pretty_json_field(line: &str, indent: usize) -> AppResult<Option<(String, String)>> {
    if line.len() <= indent || !line.starts_with(&" ".repeat(indent)) {
        return Ok(None);
    }
    if line
        .as_bytes()
        .get(indent)
        .is_some_and(u8::is_ascii_whitespace)
    {
        return Ok(None);
    }
    let trimmed = line.trim_start();
    if !trimmed.starts_with('"') {
        return Ok(None);
    }
    let Some((raw_key, raw_value)) = trimmed.split_once(':') else {
        return Ok(None);
    };
    let key = serde_json::from_str::<String>(raw_key)?;
    Ok(Some((key, raw_value.trim_start().to_string())))
}

fn is_pretty_object_end(line: &str, indent: usize) -> bool {
    let bytes = line.as_bytes();
    let value_index = indent;
    let suffix_index = value_index + 1;
    bytes
        .get(..indent)
        .is_some_and(|prefix| prefix.iter().all(|byte| *byte == b' '))
        && bytes.get(value_index) == Some(&b'}')
        && matches!(bytes.get(suffix_index), None | Some(b','))
        && matches!(line.trim(), "}" | "},")
}

fn read_json_line<R: BufRead>(reader: &mut R) -> AppResult<Option<String>> {
    let mut line = String::new();
    if reader.read_line(&mut line)? == 0 {
        return Ok(None);
    }
    Ok(Some(line.trim_end_matches(['\r', '\n']).to_string()))
}

fn json_container_depth_delta(value: &str) -> i32 {
    let mut depth = 0;
    let mut in_string = false;
    let mut escaped = false;
    for byte in value.bytes() {
        if in_string {
            if escaped {
                escaped = false;
                continue;
            }
            match byte {
                b'\\' => escaped = true,
                b'"' => in_string = false,
                _ => {}
            }
            continue;
        }

        match byte {
            b'"' => in_string = true,
            b'{' | b'[' => depth += 1,
            b'}' | b']' => depth -= 1,
            _ => {}
        }
    }
    depth
}

fn parse_storage_message_cursor(cursor: &str) -> (String, Option<String>) {
    let mut parts = cursor.splitn(2, '|');
    let created_at = parts.next().unwrap_or_default().to_string();
    let id = parts
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    (created_at, id)
}

fn message_is_before_cursor(row: &Value, before: Option<&(String, Option<String>)>) -> bool {
    let created_at = row.get("createdAt").and_then(Value::as_str).unwrap_or("");
    let id = row.get("id").and_then(Value::as_str).unwrap_or("");
    message_parts_are_before_cursor(created_at, id, before)
}

fn message_parts_are_before_cursor(
    created_at: &str,
    id: &str,
    before: Option<&(String, Option<String>)>,
) -> bool {
    let Some((before_created_at, before_id)) = before else {
        return true;
    };
    created_at < before_created_at.as_str()
        || (created_at == before_created_at.as_str()
            && before_id.as_deref().is_some_and(|cursor_id| id < cursor_id))
}

fn apply_message_page(rows: &mut Vec<Value>, limit: usize, before: Option<&str>) {
    rows.sort_by(|a, b| {
        let a_created_at = a.get("createdAt").and_then(Value::as_str).unwrap_or("");
        let b_created_at = b.get("createdAt").and_then(Value::as_str).unwrap_or("");
        let a_id = a.get("id").and_then(Value::as_str).unwrap_or("");
        let b_id = b.get("id").and_then(Value::as_str).unwrap_or("");
        a_created_at.cmp(b_created_at).then_with(|| a_id.cmp(b_id))
    });

    let before_cursor = before.map(parse_storage_message_cursor);
    if before_cursor.is_some() {
        rows.retain(|row| message_is_before_cursor(row, before_cursor.as_ref()));
    }
    if rows.len() > limit {
        let keep_from = rows.len() - limit;
        rows.drain(0..keep_from);
    }
}

struct PendingCollectionReplacement {
    path: PathBuf,
    tmp: PathBuf,
    backup: PathBuf,
    existed: bool,
}

fn rollback_collection_replacements(
    pending: &[PendingCollectionReplacement],
    backed_up: &[usize],
    installed: &[usize],
) -> AppResult<()> {
    let mut first_error = None;
    for index in installed.iter().rev() {
        if let Err(error) = remove_path_if_exists(&pending[*index].path) {
            first_error.get_or_insert(error);
        }
    }
    for index in backed_up.iter().rev() {
        let item = &pending[*index];
        match path_exists_no_follow(&item.backup) {
            Ok(true) => {}
            Ok(false) => continue,
            Err(error) => {
                first_error.get_or_insert(error);
                continue;
            }
        }
        if let Err(error) = fs::rename(&item.backup, &item.path) {
            first_error.get_or_insert(AppError::from(error));
        }
    }
    if let Some(error) = first_error {
        return Err(error);
    }
    Ok(())
}

fn cleanup_pending_collection_temps(pending: &[PendingCollectionReplacement]) {
    for item in pending {
        let _ = remove_path_if_exists(&item.tmp);
    }
}

fn cleanup_pending_collection_transaction_files(pending: &[PendingCollectionReplacement]) {
    for item in pending {
        let _ = remove_path_if_exists(&item.tmp);
        let _ = remove_path_if_exists(&item.backup);
    }
}

fn collection_transaction_path(
    path: &Path,
    transaction_id: &str,
    index: usize,
    kind: &str,
) -> AppResult<PathBuf> {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::invalid_input("Invalid collection path"))?;
    Ok(path.with_file_name(format!(
        "{file_name}.profile-import-{transaction_id}-{index}.{kind}"
    )))
}

fn storage_transaction_id() -> String {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("{}-{nonce}", std::process::id())
}

fn path_exists_no_follow(path: &Path) -> AppResult<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn remove_path_if_exists(path: &Path) -> AppResult<()> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };
    if metadata.is_dir() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }
    Ok(())
}

pub fn record_id(value: &Value) -> Option<&str> {
    value.get("id").and_then(Value::as_str)
}

pub fn merge_object_field(
    record: &mut Value,
    field: &str,
    patch: Map<String, Value>,
) -> AppResult<()> {
    let object = record
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Stored record is not an object"))?;
    let current = object
        .entry(field.to_string())
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input(format!("{field} is not an object")))?;
    for (key, value) in patch {
        current.insert(key, value);
    }
    object.insert("updatedAt".to_string(), Value::String(now_iso()));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_storage_root(test_name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "marinara-storage-{test_name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("temporary storage root should be created");
        path
    }

    fn corruption_sentinel_count(root: &Path, file_name: &str) -> usize {
        fs::read_dir(root.join("collections"))
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(&format!("{file_name}.corrupted-"))
            })
            .count()
    }

    #[test]
    fn replace_all_many_updates_multiple_collections() {
        let root = temp_storage_root("replace-many");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all_many(vec![
                ("characters", vec![json!({ "id": "character-1" })]),
                ("personas", vec![json!({ "id": "persona-1" })]),
            ])
            .unwrap();

        assert_eq!(storage.list("characters").unwrap()[0]["id"], "character-1");
        assert_eq!(storage.list("personas").unwrap()[0]["id"], "persona-1");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn update_collections_atomically_reads_and_replaces_multiple_collections() {
        let root = temp_storage_root("update-collections-atomically");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all(
                "messages",
                vec![json!({ "id": "message-1", "content": "old" })],
            )
            .unwrap();
        storage
            .replace_all(
                "message-swipes",
                vec![json!({ "id": "message-1::swipe::0", "messageId": "message-1" })],
            )
            .unwrap();

        let updated = storage
            .update_collections_atomically(vec!["messages", "message-swipes"], |collections| {
                collections[0]
                    .rows_mut()
                    .push(json!({ "id": "message-2", "content": "new" }));
                collections[1]
                    .rows_mut()
                    .push(json!({ "id": "message-2::swipe::0", "messageId": "message-2" }));
                Ok(collections[0].rows().len())
            })
            .unwrap();

        assert_eq!(updated, 2);
        assert_eq!(storage.list("messages").unwrap().len(), 2);
        assert_eq!(storage.list("message-swipes").unwrap().len(), 2);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn update_collections_atomically_rejects_duplicate_collections_before_update() {
        let root = temp_storage_root("update-collections-duplicate");
        let storage = FileStorage::new(&root).unwrap();
        let mut update_ran = false;

        let error = storage
            .update_collections_atomically(vec!["messages", "messages"], |_| {
                update_ran = true;
                Ok(())
            })
            .expect_err("duplicate collections should reject before update runs");

        assert_eq!(error.code, "invalid_input");
        assert!(!update_ran);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn update_collections_atomically_rejects_reentrant_writes_without_side_effects() {
        let root = temp_storage_root("update-collections-reentrant");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all(
                "messages",
                vec![json!({ "id": "message-1", "content": "old" })],
            )
            .unwrap();

        let error = storage
            .update_collections_atomically(vec!["messages"], |collections| {
                assert_eq!(collections[0].collection(), "messages");
                assert_eq!(storage.list("messages")?.len(), 1);
                storage.create(
                    "personas",
                    json!({ "id": "persona-1", "name": "reentrant" }),
                )?;
                collections[0]
                    .rows_mut()
                    .push(json!({ "id": "message-2", "content": "callback" }));
                Ok(())
            })
            .expect_err("reentrant writes should reject instead of deadlocking or persisting");

        assert_eq!(error.code, "storage_transaction_active");
        let rows = storage.list("messages").unwrap();
        assert_eq!(rows.len(), 1);
        assert!(rows
            .iter()
            .any(|row| row.get("id").and_then(Value::as_str) == Some("message-1")));
        assert!(!rows
            .iter()
            .any(|row| row.get("id").and_then(Value::as_str) == Some("message-2")));
        assert!(storage.list("personas").unwrap().is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn update_collections_atomically_reads_targets_without_recovery_side_effects() {
        let root = temp_storage_root("update-collections-no-target-recovery");
        let storage = FileStorage::new(&root).unwrap();
        let collection = root.join("collections").join("messages.json");
        let backup = root.join("collections").join("messages.json.bak");
        fs::write(&collection, b"\0\0\0not-json").unwrap();
        fs::write(
            &backup,
            serde_json::to_vec_pretty(&json!([{ "id": "message-1" }])).unwrap(),
        )
        .unwrap();
        let mut update_ran = false;

        storage
            .update_collections_atomically(vec!["messages"], |_| {
                update_ran = true;
                Ok(())
            })
            .expect_err("atomic target reads should fail instead of recovering in place");

        assert!(!update_ran);
        assert_eq!(fs::read(&collection).unwrap(), b"\0\0\0not-json");
        assert!(backup.exists());
        assert_eq!(corruption_sentinel_count(&root, "messages.json"), 0);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn update_collections_atomically_reentrant_reads_do_not_recover_collections() {
        let root = temp_storage_root("update-collections-no-read-recovery");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all("messages", vec![json!({ "id": "message-1" })])
            .unwrap();
        let collection = root.join("collections").join("personas.json");
        let backup = root.join("collections").join("personas.json.bak");
        fs::write(&collection, b"\0\0\0not-json").unwrap();
        fs::write(
            &backup,
            serde_json::to_vec_pretty(&json!([{ "id": "persona-1" }])).unwrap(),
        )
        .unwrap();

        storage
            .update_collections_atomically(vec!["messages"], |_| {
                storage.list("personas")?;
                Ok(())
            })
            .expect_err("reentrant read recovery should not write during atomic update");

        assert_eq!(fs::read(&collection).unwrap(), b"\0\0\0not-json");
        assert!(backup.exists());
        assert_eq!(corruption_sentinel_count(&root, "personas.json"), 0);
        assert_eq!(
            storage.list("messages").unwrap(),
            vec![json!({ "id": "message-1" })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn corrupt_collection_and_backup_are_preserved_and_recreated_empty() {
        let root = temp_storage_root("corrupt-collection-and-backup");
        let storage = FileStorage::new(&root).unwrap();
        let collection = root.join("collections").join("messages.json");
        let backup = root.join("collections").join("messages.json.bak");
        fs::write(&collection, b"\0\0\0not-json").unwrap();
        fs::write(&backup, b"{ bad backup").unwrap();

        let rows = storage.list("messages").unwrap();

        assert!(rows.is_empty());
        assert_eq!(fs::read_to_string(&collection).unwrap(), "[]");
        assert!(!backup.exists());
        assert_eq!(
            fs::read_dir(root.join("collections"))
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name().to_string_lossy().contains(".corrupted-"))
                .count(),
            2
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn corrupt_collection_recovers_from_valid_backup() {
        let root = temp_storage_root("corrupt-collection-valid-backup");
        let storage = FileStorage::new(&root).unwrap();
        let collection = root.join("collections").join("messages.json");
        let backup = root.join("collections").join("messages.json.bak");
        fs::write(&collection, b"\0\0\0").unwrap();
        fs::write(
            &backup,
            serde_json::to_vec_pretty(&json!([{ "id": "message-1", "chatId": "chat-1" }])).unwrap(),
        )
        .unwrap();

        let rows = storage.list("messages").unwrap();

        assert_eq!(rows, vec![json!({ "id": "message-1", "chatId": "chat-1" })]);
        assert_eq!(
            serde_json::from_str::<Value>(&fs::read_to_string(&collection).unwrap()).unwrap(),
            json!([{ "id": "message-1", "chatId": "chat-1" }])
        );
        assert!(backup.exists());
        assert_eq!(
            fs::read_dir(root.join("collections"))
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("messages.json.corrupted-"))
                .count(),
            1
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn valid_collection_does_not_create_corruption_sentinels() {
        let root = temp_storage_root("valid-collection-no-corruption-sentinel");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all("messages", vec![json!({ "id": "message-1" })])
            .unwrap();

        assert_eq!(
            storage.list("messages").unwrap(),
            vec![json!({ "id": "message-1" })]
        );
        assert_eq!(
            fs::read_dir(root.join("collections"))
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name().to_string_lossy().contains(".corrupted-"))
                .count(),
            0
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn writes_refresh_backup_without_copying_nul_corruption() {
        let root = temp_storage_root("write-refreshes-backup");
        let storage = FileStorage::new(&root).unwrap();
        let collection = root.join("collections").join("messages.json");
        let backup = root.join("collections").join("messages.json.bak");

        storage
            .replace_all("messages", vec![json!({ "id": "old-message" })])
            .unwrap();
        storage
            .replace_all("messages", vec![json!({ "id": "new-message" })])
            .unwrap();

        assert_eq!(
            serde_json::from_str::<Value>(&fs::read_to_string(&backup).unwrap()).unwrap(),
            json!([{ "id": "old-message" }])
        );

        fs::write(&collection, b"\0\0\0").unwrap();
        storage
            .replace_all("messages", vec![json!({ "id": "safe-message" })])
            .unwrap();

        assert_eq!(
            serde_json::from_str::<Value>(&fs::read_to_string(&backup).unwrap()).unwrap(),
            json!([{ "id": "old-message" }])
        );
        assert_eq!(
            serde_json::from_str::<Value>(&fs::read_to_string(&collection).unwrap()).unwrap(),
            json!([{ "id": "safe-message" }])
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repeated_writes_refresh_existing_backup() {
        let root = temp_storage_root("repeated-write-refreshes-backup");
        let storage = FileStorage::new(&root).unwrap();
        let backup = root.join("collections").join("messages.json.bak");

        storage
            .replace_all("messages", vec![json!({ "id": "first" })])
            .unwrap();
        storage
            .replace_all("messages", vec![json!({ "id": "second" })])
            .unwrap();
        storage
            .replace_all("messages", vec![json!({ "id": "third" })])
            .unwrap();

        assert_eq!(
            serde_json::from_str::<Value>(&fs::read_to_string(&backup).unwrap()).unwrap(),
            json!([{ "id": "second" }])
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_rejects_duplicate_caller_provided_id_without_mutating_existing_row() {
        let root = temp_storage_root("create-rejects-duplicate-id");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .create(
                "characters",
                json!({
                    "id": "duplicate-test",
                    "name": "Original"
                }),
            )
            .expect("initial create should succeed");

        let error = storage
            .create(
                "characters",
                json!({
                    "id": "duplicate-test",
                    "name": "Replacement"
                }),
            )
            .expect_err("duplicate create should fail");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(error.message, "characters/duplicate-test already exists");
        let original = storage
            .get("characters", "duplicate-test")
            .unwrap()
            .expect("original row should remain");
        assert_eq!(original["name"], "Original");
        assert_eq!(original["id"], "duplicate-test");
        assert!(original.get("createdAt").is_some());
        assert!(original.get("updatedAt").is_some());
        assert_eq!(
            storage.list("characters").unwrap(),
            vec![json!({
                "id": original["id"].clone(),
                "name": original["name"].clone(),
                "createdAt": original["createdAt"].clone(),
                "updatedAt": original["updatedAt"].clone()
            })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_consumes_remaining_rows_after_match() {
        let root = temp_storage_root("get-consumes-remaining-rows");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![
                    json!({ "id": "match", "name": "Match" }),
                    json!({ "id": "after-match", "name": "After Match" }),
                ],
            )
            .unwrap();

        let record = storage
            .get("characters", "match")
            .expect("get should not leave unread JSON trailing the first match")
            .expect("matching row should be returned");

        assert_eq!(record["id"], "match");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_projected_returns_matching_row_without_unrequested_fields() {
        let root = temp_storage_root("get-projected-skips-unrequested-fields");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![
                    json!({
                        "id": "skip-me",
                        "data": { "name": "Skip", "description": "ignore" },
                        "avatar": "ignore"
                    }),
                    json!({
                        "id": "target",
                        "data": {
                            "name": "Rina",
                            "description": "large prompt text",
                            "extensions": { "depth_prompt": { "prompt": "large nested prompt" } }
                        },
                        "avatar": "large image payload"
                    }),
                ],
            )
            .unwrap();
        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert("data".to_string(), json!(["name"]));

        let record = storage
            .get_projected("characters", "target", &fields, &selections)
            .expect("projected get should read")
            .expect("target row should exist");

        assert_eq!(
            record,
            json!({ "id": "target", "data": { "name": "Rina" } })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_projected_bypasses_clean_full_row_cache() {
        let root = temp_storage_root("get-projected-bypasses-clean-cache");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!({
                    "id": "target",
                    "data": { "name": "Cached", "description": "cached prompt" },
                    "avatar": "cached image payload"
                })],
            )
            .unwrap();

        let collection = root.join("collections").join("characters.json");
        fs::write(
            &collection,
            serde_json::to_vec_pretty(&json!([
                {
                    "id": "target",
                    "data": { "name": "Disk", "description": "disk prompt" },
                    "avatar": "disk image payload"
                }
            ]))
            .unwrap(),
        )
        .unwrap();

        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert("data".to_string(), json!(["name"]));

        let record = storage
            .get_projected("characters", "target", &fields, &selections)
            .expect("projected get should read from disk when cache is clean")
            .expect("target row should exist");

        assert_eq!(
            record,
            json!({ "id": "target", "data": { "name": "Disk" } })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_projected_uses_dirty_cache_before_disk() {
        let root = temp_storage_root("list-projected-uses-dirty-cache");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!({
                    "id": "target",
                    "data": { "name": "Disk", "description": "disk prompt" },
                    "avatar": "disk image payload"
                })],
            )
            .unwrap();
        storage
            .cache_collection(
                "characters",
                &[json!({
                    "id": "target",
                    "data": { "name": "Dirty", "description": "dirty prompt" },
                    "avatar": "dirty image payload"
                })],
                true,
            )
            .unwrap();

        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert("data".to_string(), json!(["name"]));

        let rows = storage
            .list_projected("characters", &fields, &selections)
            .expect("projected list should honor dirty cache");

        assert_eq!(
            rows,
            vec![json!({ "id": "target", "data": { "name": "Dirty" } })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_projected_caches_clean_projection_shapes_until_file_changes() {
        let root = temp_storage_root("list-projected-caches-clean-shapes");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!( {
                    "id": "target",
                    "data": { "name": "Disk", "description": "large prompt" },
                    "avatar": "large image payload"
                })],
            )
            .unwrap();

        let fields = vec!["id".to_string(), "data".to_string()];
        let reversed_fields = vec!["data".to_string(), "id".to_string()];
        let mut selections = Map::new();
        selections.insert("data".to_string(), json!(["name"]));

        let first = storage
            .list_projected("characters", &fields, &selections)
            .expect("first projected list should read");
        assert_eq!(
            first,
            vec![json!({ "id": "target", "data": { "name": "Disk" } })]
        );

        let second = storage
            .list_projected("characters", &reversed_fields, &selections)
            .expect("same projection shape should read");
        assert_eq!(second, first);
        let projected_cache_len = storage
            .cache
            .read()
            .expect("cache lock should be readable")
            .projected_lists
            .len();
        assert_eq!(projected_cache_len, 1);

        std::thread::sleep(Duration::from_millis(5));
        let collection = root.join("collections").join("characters.json");
        fs::write(
            &collection,
            serde_json::to_vec_pretty(&json!([
                {
                    "id": "target",
                    "data": { "name": "Changed", "description": "changed large prompt" },
                    "avatar": "changed large image payload"
                }
            ]))
            .unwrap(),
        )
        .unwrap();

        let changed = storage
            .list_projected("characters", &fields, &selections)
            .expect("projected list should notice changed collection file");
        assert_eq!(
            changed,
            vec![json!({ "id": "target", "data": { "name": "Changed" } })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_projected_cache_detects_same_length_rewrite() {
        let root = temp_storage_root("list-projected-cache-same-length-rewrite");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!({
                    "id": "target",
                    "data": { "name": "Alpha", "description": "large prompt" },
                    "avatar": "large image payload"
                })],
            )
            .unwrap();

        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert("data".to_string(), json!(["name"]));

        let first = storage
            .list_projected("characters", &fields, &selections)
            .expect("first projected list should read");
        assert_eq!(
            first,
            vec![json!({ "id": "target", "data": { "name": "Alpha" } })]
        );

        let collection = root.join("collections").join("characters.json");
        let replacement = serde_json::to_vec_pretty(&json!([
            {
                "id": "target",
                "data": { "name": "Bravo", "description": "large prompt" },
                "avatar": "large image payload"
            }
        ]))
        .unwrap();
        assert_eq!(
            replacement.len() as u64,
            fs::metadata(&collection)
                .expect("collection should exist")
                .len()
        );
        fs::write(&collection, replacement).unwrap();

        let changed = storage
            .list_projected("characters", &fields, &selections)
            .expect("projected list should notice same-length file rewrite");
        assert_eq!(
            changed,
            vec![json!({ "id": "target", "data": { "name": "Bravo" } })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn collection_content_signature_hashes_large_unsampled_bytes() {
        let root = temp_storage_root("collection-content-signature-large");
        let collection = root.join("collections").join("characters.json");
        fs::create_dir_all(collection.parent().unwrap()).unwrap();

        let mut bytes = vec![b'a'; 20_000];
        fs::write(&collection, &bytes).unwrap();
        let len = fs::metadata(&collection).unwrap().len();
        let first_signature = collection_content_signature(&collection, len).unwrap();

        bytes[6_000] = b'b';
        fs::write(&collection, &bytes).unwrap();

        assert_eq!(fs::metadata(&collection).unwrap().len(), len);
        assert_ne!(
            collection_content_signature(&collection, len).unwrap(),
            first_signature
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_projected_cache_is_invalidated_by_writes() {
        let root = temp_storage_root("list-projected-cache-invalidated-by-writes");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!({
                    "id": "target",
                    "data": { "name": "Before", "description": "large prompt" },
                    "avatar": "large image payload"
                })],
            )
            .unwrap();

        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert("data".to_string(), json!(["name"]));

        storage
            .list_projected("characters", &fields, &selections)
            .expect("projected list should read");
        assert_eq!(
            storage
                .cache
                .read()
                .expect("cache lock should be readable")
                .projected_lists
                .len(),
            1
        );

        storage
            .patch(
                "characters",
                "target",
                json!({ "data": { "name": "After", "description": "changed large prompt" } }),
            )
            .expect("patch should update character");

        assert_eq!(
            storage
                .cache
                .read()
                .expect("cache lock should be readable")
                .projected_lists
                .len(),
            0
        );
        let rows = storage
            .list_projected("characters", &fields, &selections)
            .expect("projected list should read updated dirty rows");
        assert_eq!(
            rows,
            vec![json!({ "id": "target", "data": { "name": "After" } })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_projected_cache_is_invalidated_by_replace_all_many() {
        let root = temp_storage_root("list-projected-cache-invalidated-by-replace-many");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!({
                    "id": "target",
                    "data": { "name": "Before", "description": "large prompt" },
                    "avatar": "large image payload"
                })],
            )
            .unwrap();

        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert("data".to_string(), json!(["name"]));

        storage
            .list_projected("characters", &fields, &selections)
            .expect("projected list should read");
        assert_eq!(
            storage
                .cache
                .read()
                .expect("cache lock should be readable")
                .projected_lists
                .len(),
            1
        );

        storage
            .replace_all_many(vec![(
                "characters",
                vec![json!({
                    "id": "target",
                    "data": { "name": "After", "description": "changed prompt" },
                    "avatar": "large image payload"
                })],
            )])
            .expect("replace_all_many should update character");

        assert_eq!(
            storage
                .cache
                .read()
                .expect("cache lock should be readable")
                .projected_lists
                .len(),
            0
        );
        let rows = storage
            .list_projected("characters", &fields, &selections)
            .expect("projected list should read replaced rows");
        assert_eq!(
            rows,
            vec![json!({ "id": "target", "data": { "name": "After" } })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_projected_applies_dotted_nested_field_selections() {
        let root = temp_storage_root("get-projected-dotted-nested-fields");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!({
                    "id": "target",
                    "data": {
                        "name": "Rina",
                        "description": "large prompt text",
                        "extensions": {
                            "avatarCrop": { "x": 0.2 },
                            "backstory": "large extension prompt",
                            "fav": true,
                            "importMetadata": {
                                "card": { "spec": "chara_card_v2" },
                                "embeddedLorebook": { "entries": ["large"] }
                            },
                            "nameColor": "#ff99aa"
                        }
                    },
                    "avatar": "large image payload"
                })],
            )
            .unwrap();
        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert(
            "data".to_string(),
            json!([
                "name",
                "extensions.avatarCrop",
                "extensions.fav",
                "extensions.importMetadata.card",
                "extensions.nameColor"
            ]),
        );

        let record = storage
            .get_projected("characters", "target", &fields, &selections)
            .expect("projected get should read")
            .expect("target row should exist");

        assert_eq!(
            record,
            json!({
                "id": "target",
                "data": {
                    "name": "Rina",
                    "extensions": {
                        "avatarCrop": { "x": 0.2 },
                        "fav": true,
                        "importMetadata": {
                            "card": { "spec": "chara_card_v2" }
                        },
                        "nameColor": "#ff99aa"
                    }
                }
            })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_projected_pretty_fast_path_returns_deep_dotted_field_from_disk() {
        let root = temp_storage_root("get-projected-pretty-fast-path-deep-dotted-field");
        let storage = FileStorage::new(&root).unwrap();
        let collection_dir = root.join("collections");
        fs::create_dir_all(&collection_dir).unwrap();
        fs::write(
            collection_dir.join("characters.json"),
            serde_json::to_vec_pretty(&json!([
                {
                    "id": "target",
                    "data": {
                        "name": "Rina",
                        "extensions": {
                            "importMetadata": {
                                "card": { "spec": "chara_card_v2" },
                                "embeddedLorebook": { "entries": ["ignore"] }
                            },
                            "backstory": "ignore"
                        }
                    },
                    "avatar": "ignore"
                }
            ]))
            .unwrap(),
        )
        .unwrap();

        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert(
            "data".to_string(),
            json!(["extensions.importMetadata.card"]),
        );

        let record = storage
            .get_projected("characters", "target", &fields, &selections)
            .expect("projected get should use pretty fast path")
            .expect("target row should exist");

        assert_eq!(
            record,
            json!({
                "id": "target",
                "data": {
                    "extensions": {
                        "importMetadata": {
                            "card": { "spec": "chara_card_v2" }
                        }
                    }
                }
            })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_projected_uses_pretty_id_fast_path_before_trailing_rows() {
        let root = temp_storage_root("get-projected-pretty-id-fast-path");
        let storage = FileStorage::new(&root).unwrap();
        let collection = root.join("collections").join("characters.json");
        fs::write(
            &collection,
            r#"[
  {
    "id": "target",
    "data": {
      "name": "Rina",
      "description": "large prompt text"
    },
    "avatar": "large image payload"
  },
  {
    "id": "trailing-row",
    "data":
"#,
        )
        .unwrap();
        let fields = vec!["id".to_string(), "data".to_string()];
        let mut selections = Map::new();
        selections.insert("data".to_string(), json!(["name"]));

        let record = storage
            .get_projected("characters", "target", &fields, &selections)
            .expect("projected get should use the pretty id fast path")
            .expect("target row should exist");

        assert_eq!(
            record,
            json!({ "id": "target", "data": { "name": "Rina" } })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_projected_preserves_selected_array_fields() {
        let root = temp_storage_root("get-projected-preserves-selected-arrays");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!({
                    "id": "target",
                    "alternateGreetings": [
                        {
                            "content": "hello",
                            "metadata": { "tone": "warm" }
                        }
                    ],
                    "avatar": "large image payload"
                })],
            )
            .unwrap();
        let fields = vec!["id".to_string(), "alternateGreetings".to_string()];
        let mut selections = Map::new();
        selections.insert("alternateGreetings".to_string(), json!(["content"]));

        let record = storage
            .get_projected("characters", "target", &fields, &selections)
            .expect("projected get should read")
            .expect("target row should exist");

        assert_eq!(
            record,
            json!({
                "id": "target",
                "alternateGreetings": [
                    {
                        "content": "hello",
                        "metadata": { "tone": "warm" }
                    }
                ]
            })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_projected_preserves_selected_array_fields() {
        let root = temp_storage_root("list-projected-preserves-selected-arrays");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "characters",
                vec![json!({
                    "id": "target",
                    "alternateGreetings": [
                        {
                            "content": "hello",
                            "metadata": { "tone": "warm" }
                        }
                    ],
                    "avatar": "large image payload"
                })],
            )
            .unwrap();
        let fields = vec!["id".to_string(), "alternateGreetings".to_string()];
        let mut selections = Map::new();
        selections.insert("alternateGreetings".to_string(), json!(["content"]));

        let rows = storage
            .list_projected("characters", &fields, &selections)
            .expect("projected list should read");

        assert_eq!(
            rows,
            vec![json!({
                "id": "target",
                "alternateGreetings": [
                    {
                        "content": "hello",
                        "metadata": { "tone": "warm" }
                    }
                ]
            })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_projected_where_in_streams_legacy_sidecar_rows() {
        let root = temp_storage_root("list-projected-where-in");
        FileStorage::new(&root).unwrap();
        let sidecar = root.join("collections").join("message-swipes.json");
        fs::write(
            &sidecar,
            serde_json::to_vec_pretty(&json!([
                {
                    "id": "message-1::swipe::0",
                    "messageId": "message-1",
                    "index": 0,
                    "content": "first",
                    "extra": { "large": "ignored" },
                    "createdAt": "2026-01-01T00:00:00Z"
                },
                {
                    "id": "message-1::swipe::1",
                    "messageId": "message-1",
                    "index": 1,
                    "content": "second",
                    "extra": { "large": "ignored" },
                    "createdAt": "2026-01-01T00:00:01Z"
                },
                {
                    "id": "message-1::swipe::2",
                    "messageId": " message-1 ",
                    "index": 2,
                    "content": "trimmed legacy id",
                    "extra": { "large": "ignored" },
                    "createdAt": "2026-01-01T00:00:02Z"
                },
                {
                    "id": "message-2::swipe::0",
                    "messageId": "message-2",
                    "index": 0,
                    "content": "skip",
                    "extra": { "large": "ignored" },
                    "createdAt": "2026-01-01T00:00:03Z"
                },
                {
                    "id": "missing-message-id",
                    "index": 0,
                    "content": "skip missing parent",
                    "extra": { "large": "ignored" },
                    "createdAt": "2026-01-01T00:00:04Z"
                }
            ]))
            .unwrap(),
        )
        .unwrap();

        let storage = FileStorage::new(&root).unwrap();

        let fields = ["messageId", "index", "content"]
            .into_iter()
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        let values = HashSet::from(["message-1".to_string()]);
        let rows = storage
            .list_projected_where_in("message-swipes", "messageId", &values, &fields, &Map::new())
            .expect("projected filtered rows should read");

        assert_eq!(
            rows,
            vec![
                json!({
                    "messageId": "message-1",
                    "index": 0,
                    "content": "first"
                }),
                json!({
                    "messageId": "message-1",
                    "index": 1,
                    "content": "second"
                }),
                json!({
                    "messageId": " message-1 ",
                    "index": 2,
                    "content": "trimmed legacy id"
                })
            ]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_where_in_streams_full_legacy_sidecar_rows() {
        let root = temp_storage_root("list-where-in-full-sidecars");
        FileStorage::new(&root).unwrap();
        let sidecar = root.join("collections").join("message-swipes.json");
        fs::write(
            &sidecar,
            serde_json::to_vec_pretty(&json!([
                {
                    "id": "message-1::swipe::0",
                    "messageId": "message-1",
                    "index": 0,
                    "content": "first",
                    "extra": { "thinking": "first thought" },
                    "createdAt": "2026-01-01T00:00:00Z",
                    "providerMetadata": { "finishReason": "stop" }
                },
                {
                    "id": "message-2::swipe::0",
                    "messageId": "message-2",
                    "index": 0,
                    "content": "skip",
                    "extra": { "thinking": "skip thought" },
                    "createdAt": "2026-01-01T00:00:01Z"
                },
                {
                    "id": "message-1::swipe::1",
                    "messageId": "message-1",
                    "index": 1,
                    "content": "second",
                    "extra": { "thinking": "second thought" },
                    "createdAt": "2026-01-01T00:00:02Z",
                    "customField": "preserved"
                },
                {
                    "id": "message-1::swipe::2",
                    "messageId": " message-1 ",
                    "index": 2,
                    "content": "trimmed legacy id",
                    "extra": { "thinking": "trimmed thought" },
                    "createdAt": "2026-01-01T00:00:03Z"
                }
            ]))
            .unwrap(),
        )
        .unwrap();

        let storage = FileStorage::new(&root).unwrap();
        let values = HashSet::from(["message-1".to_string()]);
        let rows = storage
            .list_where_in("message-swipes", "messageId", &values)
            .expect("filtered full rows should read");

        assert_eq!(
            rows,
            vec![
                json!({
                    "id": "message-1::swipe::0",
                    "messageId": "message-1",
                    "index": 0,
                    "content": "first",
                    "extra": { "thinking": "first thought" },
                    "createdAt": "2026-01-01T00:00:00Z",
                    "providerMetadata": { "finishReason": "stop" }
                }),
                json!({
                    "id": "message-1::swipe::1",
                    "messageId": "message-1",
                    "index": 1,
                    "content": "second",
                    "extra": { "thinking": "second thought" },
                    "createdAt": "2026-01-01T00:00:02Z",
                    "customField": "preserved"
                }),
                json!({
                    "id": "message-1::swipe::2",
                    "messageId": " message-1 ",
                    "index": 2,
                    "content": "trimmed legacy id",
                    "extra": { "thinking": "trimmed thought" },
                    "createdAt": "2026-01-01T00:00:03Z"
                })
            ]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_messages_for_chat_returns_only_matching_messages() {
        let root = temp_storage_root("list-messages-for-chat");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "a-1", "chatId": "chat-a", "content": "first" }),
                    json!({ "id": "b-1", "chatId": "chat-b", "content": "skip me" }),
                    json!({ "id": "a-2", "chatId": "chat-a", "content": "second" }),
                ],
            )
            .unwrap();

        let rows = storage.list_messages_for_chat("chat-a").unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0]["id"], "a-1");
        assert_eq!(rows[1]["id"], "a-2");
        assert_eq!(rows[1]["content"], "second");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delete_where_removes_all_matching_rows() {
        let root = temp_storage_root("delete-where");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "a-1", "chatId": "chat-a", "content": "first" }),
                    json!({ "id": "b-1", "chatId": "chat-b", "content": "skip me" }),
                    json!({ "id": "a-2", "chatId": "chat-a", "content": "second" }),
                ],
            )
            .unwrap();

        let mut filters = Map::new();
        filters.insert("chatId".to_string(), Value::String("chat-a".to_string()));

        let deleted = storage.delete_where("messages", &filters).unwrap();

        assert_eq!(deleted, 2);
        assert_eq!(
            storage.list("messages").unwrap(),
            vec![json!({ "id": "b-1", "chatId": "chat-b", "content": "skip me" })]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_message_ids_for_chat_projects_ids_without_content() {
        let root = temp_storage_root("list-message-ids-for-chat");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "a-1", "chatId": "chat-a", "content": "first" }),
                    json!({ "id": "b-1", "chatId": "chat-b", "content": "skip me" }),
                    json!({ "id": "a-2", "chatId": "chat-a", "content": "second" }),
                ],
            )
            .unwrap();

        let rows = storage.list_message_ids_for_chat("chat-a").unwrap();

        assert_eq!(rows, vec![json!({ "id": "a-1" }), json!({ "id": "a-2" })]);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_messages_for_chat_projected_skips_unrequested_fields() {
        let root = temp_storage_root("list-messages-for-chat-projected");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all(
                "messages",
                vec![
                    json!({
                        "id": "skip-me",
                        "chatId": "chat-b",
                        "content": "skip",
                        "extra": { "large": "ignored" },
                        "swipes": [{ "content": "skip swipe", "extra": { "thinking": "skip thought" } }]
                    }),
                    json!({
                        "id": "target",
                        "chatId": "chat-a",
                        "content": "stored content",
                        "extra": { "large": "ignored", "hiddenFromAI": true },
                        "swipes": [{ "content": "active swipe", "extra": { "thinking": "visible thought", "large": "ignored" } }]
                    }),
                ],
            )
            .unwrap();
        let fields = vec![
            "id".to_string(),
            "chatId".to_string(),
            "content".to_string(),
            "extra".to_string(),
        ];
        let mut selections = Map::new();
        selections.insert("extra".to_string(), json!(["thinking", "hiddenFromAI"]));

        let rows = storage
            .list_messages_for_chat_projected("chat-a", &fields, &selections)
            .unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "target");
        assert_eq!(rows[0]["chatId"], "chat-a");
        assert_eq!(rows[0]["content"], "stored content");
        assert_eq!(rows[0]["extra"], json!({ "hiddenFromAI": true }));
        assert!(rows[0].get("swipes").is_none());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn count_messages_for_chat_counts_matching_rows_without_projection() {
        let root = temp_storage_root("count-messages-for-chat");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "a-1", "chatId": "chat-a", "content": "first" }),
                    json!({ "id": "b-1", "chatId": "chat-b", "content": "skip me" }),
                    json!({ "id": "a-2", "chatId": "chat-a", "content": "second" }),
                ],
            )
            .unwrap();

        assert_eq!(storage.count_messages_for_chat("chat-a").unwrap(), 2);
        assert_eq!(storage.count_messages_for_chat("chat-b").unwrap(), 1);
        assert_eq!(storage.count_messages_for_chat("missing").unwrap(), 0);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_reads_pretty_record_by_id_when_data_precedes_id() {
        let root = temp_storage_root("get-pretty-record-by-id");
        let storage = FileStorage::new(&root).unwrap();
        let collection = root.join("collections").join("characters.json");
        fs::write(
            &collection,
            r#"[
  {
    "data": {
      "description": "large skipped payload",
      "name": "Skip"
    },
    "id": "skip-me"
  },
  {
    "data": {
      "description": "target payload",
      "name": "Target"
    },
    "id": "target"
  }
]"#,
        )
        .unwrap();

        let row = storage.get("characters", "target").unwrap().unwrap();

        assert_eq!(row["id"], "target");
        assert_eq!(row["data"]["name"], "Target");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_pretty_record_by_id_ignores_nested_id_matches() {
        let root = temp_storage_root("get-pretty-record-ignore-nested-id");
        let storage = FileStorage::new(&root).unwrap();
        let collection = root.join("collections").join("characters.json");
        fs::write(
            &collection,
            r#"[
  {
    "id": "owner",
    "data": {
      "book": {
        "id": "target"
      },
      "name": "Wrong"
    }
  },
  {
    "id": "target",
    "data": {
      "name": "Target"
    }
  }
]"#,
        )
        .unwrap();

        let row = storage.get("characters", "target").unwrap().unwrap();

        assert_eq!(row["id"], "target");
        assert_eq!(row["data"]["name"], "Target");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_falls_back_for_compact_collection_json() {
        let root = temp_storage_root("get-compact-record-by-id");
        let storage = FileStorage::new(&root).unwrap();
        let collection = root.join("collections").join("characters.json");
        fs::write(
            &collection,
            r#"[{"data":{"name":"Skip"},"id":"skip-me"},{"data":{"name":"Target"},"id":"target"}]"#,
        )
        .unwrap();

        let row = storage.get("characters", "target").unwrap().unwrap();

        assert_eq!(row["id"], "target");
        assert_eq!(row["data"]["name"], "Target");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_messages_for_chat_page_returns_latest_matching_messages() {
        let root = temp_storage_root("list-messages-for-chat-page");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "a-1", "chatId": "chat-a", "createdAt": "2026-01-01T00:00:01Z", "content": "first" }),
                    json!({ "id": "b-1", "chatId": "chat-b", "createdAt": "2026-01-01T00:00:02Z", "content": "skip me" }),
                    json!({ "id": "a-2", "chatId": "chat-a", "createdAt": "2026-01-01T00:00:03Z", "content": "second" }),
                    json!({ "id": "a-3", "chatId": "chat-a", "createdAt": "2026-01-01T00:00:04Z", "content": "third" }),
                ],
            )
            .unwrap();

        let rows = storage
            .list_messages_for_chat_page("chat-a", 2, None)
            .unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0]["id"], "a-2");
        assert_eq!(rows[1]["id"], "a-3");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_messages_for_chat_page_respects_before_cursor() {
        let root = temp_storage_root("list-messages-for-chat-page-before");
        let storage = FileStorage::new(&root).unwrap();

        storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "a-1", "chatId": "chat-a", "createdAt": "2026-01-01T00:00:01Z", "content": "first" }),
                    json!({ "id": "a-2", "chatId": "chat-a", "createdAt": "2026-01-01T00:00:02Z", "content": "second" }),
                    json!({ "id": "a-3", "chatId": "chat-a", "createdAt": "2026-01-01T00:00:03Z", "content": "third" }),
                    json!({ "id": "b-1", "chatId": "chat-b", "createdAt": "2026-01-01T00:00:04Z", "content": "skip me" }),
                ],
            )
            .unwrap();

        let rows = storage
            .list_messages_for_chat_page("chat-a", 2, Some("2026-01-01T00:00:03Z|a-3"))
            .unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0]["id"], "a-1");
        assert_eq!(rows[1]["id"], "a-2");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn replace_all_many_rejects_invalid_collection_before_replacing_anything() {
        let root = temp_storage_root("replace-many-invalid");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all("characters", vec![json!({ "id": "old-character" })])
            .unwrap();

        let error = storage
            .replace_all_many(vec![
                ("characters", vec![json!({ "id": "new-character" })]),
                ("../bad", vec![json!({ "id": "bad" })]),
            ])
            .expect_err("invalid collection should reject the batch");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(
            storage.list("characters").unwrap()[0]["id"],
            "old-character"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn replace_all_many_rejects_duplicate_collections_before_replacing_anything() {
        let root = temp_storage_root("replace-many-duplicate");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all("characters", vec![json!({ "id": "old-character" })])
            .unwrap();

        let error = storage
            .replace_all_many(vec![
                ("characters", vec![json!({ "id": "new-character" })]),
                ("characters", vec![json!({ "id": "duplicate-character" })]),
            ])
            .expect_err("duplicate collection should reject the batch");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(
            storage.list("characters").unwrap()[0]["id"],
            "old-character"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn replace_all_many_rejects_non_file_collection_before_replacing_anything() {
        let root = temp_storage_root("replace-many-non-file");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all("characters", vec![json!({ "id": "old-character" })])
            .unwrap();
        let message_path = root.join("collections").join("messages.json");
        fs::create_dir(&message_path).unwrap();

        let error = storage
            .replace_all_many(vec![
                ("characters", vec![json!({ "id": "new-character" })]),
                ("messages", vec![json!({ "id": "message-1" })]),
            ])
            .expect_err("non-file collection should reject the batch");

        assert_eq!(error.code, "io_error");
        assert_eq!(
            storage.list("characters").unwrap()[0]["id"],
            "old-character"
        );
        assert!(message_path.is_dir());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn replace_all_many_rolls_back_when_after_install_fails() {
        let root = temp_storage_root("replace-many-after-install-fails");
        let storage = FileStorage::new(&root).unwrap();
        storage
            .replace_all("characters", vec![json!({ "id": "old-character" })])
            .unwrap();

        let error = storage
            .replace_all_many_and_then(
                vec![("characters", vec![json!({ "id": "new-character" })])],
                || {
                    Err(AppError::new(
                        "asset_install_failed",
                        "asset install failed",
                    ))
                },
            )
            .expect_err("after-install failure should reject the batch");

        assert_eq!(error.code, "asset_install_failed");
        assert_eq!(
            storage.list("characters").unwrap()[0]["id"],
            "old-character"
        );

        fs::remove_dir_all(root).unwrap();
    }
}
