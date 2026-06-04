use super::shared::*;
use super::*;

pub(crate) fn duplicate_persona(state: &AppState, id: &str) -> AppResult<Value> {
    let mut record = get_required(state, "personas", id)?;
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
    state.storage.create("personas", record)
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
