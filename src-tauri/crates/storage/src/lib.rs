use marinara_core::{ensure_object, new_id, now_iso, AppError, AppResult};
use marinara_security::validate_collection_name;
use serde::de::{DeserializeSeed, MapAccess, SeqAccess, Visitor};
use serde::Deserializer as _;
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::fs;
use std::fmt;
use std::io::{BufReader, ErrorKind, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

const MESSAGE_REVERSE_READ_CHUNK_SIZE: u64 = 1024 * 1024;

#[derive(Clone)]
pub struct FileStorage {
    root: PathBuf,
    lock: Arc<RwLock<()>>,
}

impl FileStorage {
    pub fn new(root: impl Into<PathBuf>) -> AppResult<Self> {
        let root = root.into();
        fs::create_dir_all(root.join("collections"))?;
        Ok(Self {
            root,
            lock: Arc::new(RwLock::new(())),
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn list(&self, collection: &str) -> AppResult<Vec<Value>> {
        let _guard = self
            .lock
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.read_collection(collection)
    }

    pub fn list_where(
        &self,
        collection: &str,
        filters: &Map<String, Value>,
    ) -> AppResult<Vec<Value>> {
        let _guard = self
            .lock
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.read_collection_filtered(collection, |row| {
                let Some(obj) = row.as_object() else {
                    return false;
                };
                filters
                    .iter()
                    .all(|(key, expected)| obj.get(key) == Some(expected))
            })
    }

    pub fn list_messages_for_chat(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        let _guard = self
            .lock
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.read_messages_for_chat(chat_id)
    }

    pub fn list_message_ids_for_chat(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        let _guard = self
            .lock
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.read_message_ids_for_chat(chat_id)
    }

    pub fn list_messages_for_chat_page(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        let _guard = self
            .lock
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.read_messages_for_chat_page(chat_id, limit, before)
    }

    pub fn get(&self, collection: &str, id: &str) -> AppResult<Option<Value>> {
        let _guard = self
            .lock
            .read()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.read_collection_find_by_id(collection, id)
    }

    pub fn create(&self, collection: &str, value: Value) -> AppResult<Value> {
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
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
        let now = now_iso();
        object.insert("id".to_string(), Value::String(id.clone()));
        object
            .entry("createdAt".to_string())
            .or_insert_with(|| Value::String(now.clone()));
        object
            .entry("updatedAt".to_string())
            .or_insert_with(|| Value::String(now));
        let record = Value::Object(object);
        if collection == "messages" && !had_id {
            self.append_collection_row(collection, &record)?;
            return Ok(record);
        }
        let mut rows = self.read_collection(collection)?;
        rows.retain(|row| row.get("id").and_then(Value::as_str) != Some(id.as_str()));
        rows.push(record.clone());
        self.write_collection(collection, &rows)?;
        Ok(record)
    }

    pub fn upsert_with_id(&self, collection: &str, id: &str, value: Value) -> AppResult<Value> {
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
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
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
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
            for (key, value) in patch {
                object.insert(key, value);
            }
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
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        let mut rows = self.read_collection(collection)?;
        let before = rows.len();
        rows.retain(|row| row.get("id").and_then(Value::as_str) != Some(id));
        let deleted = rows.len() != before;
        if deleted {
            self.write_collection(collection, &rows)?;
        }
        Ok(deleted)
    }

    pub fn delete_where(
        &self,
        collection: &str,
        filters: &Map<String, Value>,
    ) -> AppResult<usize> {
        self.delete_where_matching(collection, |row| row_matches_filters(row, filters))
    }

    pub fn delete_where_matching<F>(&self, collection: &str, mut predicate: F) -> AppResult<usize>
    where
        F: FnMut(&Value) -> bool,
    {
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        let mut rows = self.read_collection(collection)?;
        let before = rows.len();
        rows.retain(|row| !predicate(row));
        let deleted = before.saturating_sub(rows.len());
        if deleted > 0 {
            self.write_collection(collection, &rows)?;
        }
        Ok(deleted)
    }

    pub fn replace_all(&self, collection: &str, rows: Vec<Value>) -> AppResult<()> {
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.write_collection(collection, &rows)
    }

    pub fn replace_all_many(&self, replacements: Vec<(&str, Vec<Value>)>) -> AppResult<()> {
        self.replace_all_many_and_then(replacements, || Ok(()))
    }

    pub fn replace_all_many_and_then<F>(
        &self,
        replacements: Vec<(&str, Vec<Value>)>,
        after_install: F,
    ) -> AppResult<()>
    where
        F: FnOnce() -> AppResult<()>,
    {
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        self.replace_all_many_locked(replacements, after_install)
    }

    pub fn clear_all(&self) -> AppResult<()> {
        let _guard = self
            .lock
            .write()
            .map_err(|_| AppError::new("lock_error", "Storage lock poisoned"))?;
        let collections = self.root.join("collections");
        if collections.exists() {
            fs::remove_dir_all(&collections)?;
        }
        fs::create_dir_all(collections)?;
        Ok(())
    }

    fn collection_path(&self, collection: &str) -> AppResult<PathBuf> {
        validate_collection_name(collection)?;
        Ok(self
            .root
            .join("collections")
            .join(format!("{collection}.json")))
    }

    fn read_collection(&self, collection: &str) -> AppResult<Vec<Value>> {
        let path = self.collection_path(collection)?;
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(path)?;
        if raw.trim().is_empty() {
            return Ok(Vec::new());
        }
        let parsed: Value = serde_json::from_str(&raw)?;
        match parsed {
            Value::Array(rows) => Ok(rows),
            _ => Err(AppError::invalid_input(format!(
                "Collection {collection} did not contain a JSON array"
            ))),
        }
    }

    fn read_collection_filtered<F>(
        &self,
        collection: &str,
        predicate: F,
    ) -> AppResult<Vec<Value>>
    where
        F: FnMut(&Value) -> bool,
    {
        let path = self.collection_path(collection)?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        Ok(deserializer.deserialize_seq(FilterRowsVisitor { predicate })?)
    }

    fn read_collection_find_by_id(&self, collection: &str, id: &str) -> AppResult<Option<Value>> {
        let path = self.collection_path(collection)?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(None);
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        Ok(deserializer.deserialize_seq(FindRowByIdVisitor { id })?)
    }

    fn read_messages_for_chat(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        Ok(deserializer.deserialize_seq(MessageRowsForChatVisitor { chat_id })?)
    }

    fn read_message_ids_for_chat(&self, chat_id: &str) -> AppResult<Vec<Value>> {
        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut deserializer = serde_json::Deserializer::from_reader(reader);
        Ok(deserializer.deserialize_seq(MessageIdRowsForChatVisitor { chat_id })?)
    }

    fn read_messages_for_chat_page(
        &self,
        chat_id: &str,
        limit: usize,
        before: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        if limit == 0 {
            return Ok(Vec::new());
        }
        let path = self.collection_path("messages")?;
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            return Ok(Vec::new());
        }

        if let Some(rows) = read_pretty_message_page_from_file(&path, chat_id, limit, before)? {
            return Ok(rows);
        }

        let mut rows = self.read_messages_for_chat(chat_id)?;
        apply_message_page(&mut rows, limit, before);
        Ok(rows)
    }

    fn write_collection(&self, collection: &str, rows: &[Value]) -> AppResult<()> {
        let path = self.collection_path(collection)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(rows)?)?;
        fs::rename(tmp, path)?;
        Ok(())
    }

    fn append_collection_row(&self, collection: &str, record: &Value) -> AppResult<()> {
        let path = self.collection_path(collection)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        if !path.exists() || fs::metadata(&path)?.len() == 0 {
            self.write_collection(collection, std::slice::from_ref(record))?;
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
            return Err(AppError::invalid_input(format!(
                "Collection {collection} did not contain a JSON array"
            )));
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

        let tmp = path.with_extension("json.tmp");
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

    fn replace_all_many_locked<F>(
        &self,
        replacements: Vec<(&str, Vec<Value>)>,
        after_install: F,
    ) -> AppResult<()>
    where
        F: FnOnce() -> AppResult<()>,
    {
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
                let existed = path_exists_no_follow(&path)?;
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
        Ok(())
    }
}

fn row_matches_filters(row: &Value, filters: &Map<String, Value>) -> bool {
    let Some(object) = row.as_object() else {
        return false;
    };
    filters
        .iter()
        .all(|(key, expected)| object.get(key) == Some(expected))
}

struct FilterRowsVisitor<F> {
    predicate: F,
}

impl<'de, F> Visitor<'de> for FilterRowsVisitor<F>
where
    F: FnMut(&Value) -> bool,
{
    type Value = Vec<Value>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON array")
    }

    fn visit_seq<A>(mut self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut rows = Vec::new();
        while let Some(row) = seq.next_element::<Value>()? {
            if (self.predicate)(&row) {
                rows.push(row);
            }
        }
        Ok(rows)
    }
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
            while seq
                .next_element::<serde::de::IgnoredAny>()?
                .is_some()
            {}
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
    let Some((before_created_at, before_id)) = before else {
        return true;
    };
    let created_at = row.get("createdAt").and_then(Value::as_str).unwrap_or("");
    let id = row.get("id").and_then(Value::as_str).unwrap_or("");
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
