use crate::state::AppState;
use std::fs;

pub(crate) fn block_collection_file(state: &AppState, collection: &str) {
    let collection_path = state
        .storage
        .root()
        .join("collections")
        .join(format!("{collection}.json"));
    if let Some(parent) = collection_path.parent() {
        fs::create_dir_all(parent).expect("collection parent should be created");
    }
    fs::create_dir(collection_path).expect("collection path should be blockable");
}
